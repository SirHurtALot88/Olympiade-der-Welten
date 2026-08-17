# Der Saisonwechsel im Raum — Befund und Plan

> Anschlussarbeit an `MULTIPLAYER_VOLLAUSBAU_PLAN.md`. Dort ging es darum, dass eine Saison
> gemeinsam **spielbar** wird. Hier geht es um die eine Kante, die danach noch fehlt: von einer
> Saison in die nächste zu kommen, ohne den Raum zu verlassen.

Alle Zahlen unten sind gemessen, nicht geschätzt; die Messung steht jeweils dabei.

---

## 1. Befund

### 1.1 Der Raum-Flow endet in einer Sackgasse (der eigentliche Blocker)

`ROOM_FLOW_STEPS` (lib/room/room-flow-controller.ts:69–86) endet bei `season_review`.
`getNextRoomFlowStepId` schlägt außerhalb des Zyklus-Endes einfach die Liste weiter und klemmt am
letzten Eintrag. Gemessen:

```
Schritte: lobby_ready -> sell_players -> buy_players -> facilities -> training
          -> finalize_transfers -> lineup -> formcards -> arena -> result
          -> standings -> season_review

standings     (Saison läuft)  -> lineup          ✓ der Spieltag-Zyklus trägt
standings     (Saison durch)  -> season_review   ✓
season_review (Saison läuft)  -> season_review   ✗ Sackgasse
season_review (Saison durch)  -> season_review   ✗ Sackgasse
season_review (ohne Angabe)   -> season_review   ✗ Sackgasse
```

Der Host klickt „Season Review" und bleibt dort. Es gibt keinen Schritt für den Saisonwechsel und
nichts, was den Flow für die neue Saison zurücksetzt.

**Folge, die leicht übersehen wird:** `multiplayerRoom.activeSeasonId` und `activeMatchday` werden
ausschließlich in `advanceRoomFlow` nachgezogen (room-store.ts:1366–1368). Der feuert nie wieder —
der Raum wirbt also dauerhaft mit der alten Saison.

**Und die Lücke ist als gewollt festgeschrieben:** `tests/room-flow-spieltag-zyklus.test.ts:80`
pinnt `season_review -> season_review` unter der Überschrift „lässt die Kette außerhalb des
Zyklus-Endes unverändert". Der Test hält die Sackgasse fest. Er muss mit umgebaut werden — sonst
ist er das erste, was gegen die Reparatur ausschlägt. (Dasselbe Muster wie bei F8, wo ein Test
„der Reveal kommt unverändert durch den Neustart" verlangte, also genau den Fehler.)

### 1.2 Am Saisonende gibt es kein Ready-Gate

`season_completion` und `season_transition` stehen in `HOST_LEVEL_ACTIONS` — im Raum also
Host-only (server-authoritative-write-guard.ts:333–338). Das ist richtig. Ausgelöst werden sie
aber ausschließlich über das Cockpit (`cockpit-handlers.ts`), **komplett am Raum-Flow vorbei**.

Damit kann der Host die Saison abschließen, während Franky noch Verträge verlängert, Spieler
verkauft oder seinen Sponsor wählt. Für jeden Spieltag gibt es dafür ein Ready-Gate
(`buildRoomFlowState` → `canHostAdvance`); für den Saisonwechsel — die folgenreichste Aktion im
ganzen Spiel — gibt es keins.

### 1.3 Was bereits trägt (damit niemand doppelt sucht)

Gemessen an den Routen selbst:

| Frage | Antwort | Beleg |
|---|---|---|
| Darf Franky am Saisonende seine Verträge verlängern? | ja | `action: "contract_renewal"`, nicht host-only |
| … Verträge auflösen? | ja | `action: "contract_dissolution"` |
| … seinen Sponsor wählen? | ja | `action: "sponsor_choice"` |
| … verkaufen? | ja | Team-Write über `authorizeTeamWrite` |
| Erfährt der Mitspieler davon? | ja | alle vier rufen `notifyRoomGameplayWrite` |
| Bekommt Franky in Saison 2 seinen Formkarten-Pool? | ja | `ensureLocalFormCardsForSeason` läuft über **alle** Teams; der host-only `finalize_transfers` deckt ihn mit ab |
| Bricht die Arena an der veralteten `activeSeasonId`? | nein | der Client sendet `seasonId` explizit (use-arena-room-sync.ts:313); das Raumfeld ist nur Rückfall |

### 1.4 Was die Kette am Saisonende wirklich ist

Wichtig für den Plan, weil hier die Versuchung liegt, sie ein zweites Mal zu bauen:

- `SEASON_TRANSITION_STEPS` (lib/season/season-transition-steps.ts) — **neun** Stationen von
  `season_check` bis `next_season_ready`, jede mit ihrer Zielphase in
  `season-transition-chain.ts`.
- Danach der Pre-Season-Workflow: `next_season_setup` (preseason-workflow-service.ts:705ff)
  vergibt `season.id = nextSeasonId`, setzt `gamePhase: "season_active"` und `currentMatchday: 1`.

Der Raum-Flow darf diese neun Stationen **nicht** spiegeln. Er ist das Tor davor, nicht eine
zweite Fassung davon.

---

## 2. Entscheidungen, die ich vorab treffe

**E1 — Genau EIN neuer Flow-Schritt, kein zweiter Assistent.** Nach `season_review` kommt
`season_transition` („Saisonwechsel"), Ziel-View das Cockpit. Der Schritt ist das Ready-Gate und
der Wegweiser; der Assistent selbst bleibt, wo er ist. Neun Stationen im Raum-Flow zu wiederholen
wäre eine zweite Quelle für dieselbe Reihenfolge und würde beim ersten Umbau auseinanderlaufen.

**E2 — „Die neue Saison hat begonnen" wird GELESEN, nicht gezählt.** Genau wie
`roomFlowSeasonContinues` die Frage „läuft die Saison noch" aus `evaluateGamePhaseAction` liest
statt aus `currentMatchday < totalMatchdays`. Hier: `gameState.season.id !== activeSeasonId des
Raums`. Kein Zähler, kein Flag, das jemand vergessen kann zu setzen.

**E3 — Weitergeschaltet wird erst, wenn beide fertig sind.** `season_transition` bekommt
`aiAutoStep: false` und läuft über dasselbe `canHostAdvance`-Gate wie jeder Spieltag-Schritt. Damit
ist 1.2 mit erledigt, ohne eine zweite Gate-Logik.

**E4 — Der Rücksprung geht auf den Schritt, mit dem eine Saison im Raum tatsächlich beginnt.**
Welcher das ist, wird **gemessen** und im Kommentar festgehalten: die Liste beginnt bei
`sell_players`, aber `startRoom` setzt heute `training` (nachweisbar in
`scripts/smoke-multiplayer-e2e.ts`), und die Phasen-Gates in `evaluateGamePhaseAction` entscheiden,
was in `season_active` + Spieltag 1 überhaupt erlaubt ist. Nicht raten — nachsehen und die Messung
in den Kommentar schreiben.

**E5 — Der Test, der die Sackgasse festhält, wird umgedreht, nicht gelöscht.** Aus „bleibt
unverändert" wird „führt in den Saisonwechsel", plus eine Gegenprobe, dass die Kette **innerhalb**
einer Saison unverändert bleibt.

---

## 3. Die Pakete

Strikt **nacheinander**. Ein Paket ist fertig, wenn seine eigenen Tore grün sind; erst dann beginnt
das nächste. Kein zweiter Agent im selben Arbeitsbaum, solange einer läuft — das hat in dieser
Session vier Mal Arbeit vernichtet.

### Paket A — Der Raum-Flow bekommt den Saisonwechsel

**Dateien**
- `lib/room/room-flow-controller.ts` — neuer Schritt, `getNextRoomFlowStepId` um die zweite
  Verzweigung erweitern, CTA-Text
- `lib/room/room-store.ts` — `advanceRoomFlow`: „neue Saison begonnen?" aus dem Spielstand lesen
  und beim Rücksprung `activeSeasonId`/`activeMatchday` mitziehen
- `types/game.ts` — `RoomFlowStepId` um `season_transition`
- `tests/room-flow-spieltag-zyklus.test.ts` — die gepinnte Sackgasse umdrehen

**Eigenschaften, die gepinnt werden** (die Eigenschaft, nicht die Bauweise):
1. Aus `season_review` kommt man heraus — Ziel ist der Saisonwechsel.
2. Solange die neue Saison **nicht** begonnen hat, bleibt der Raum auf `season_transition` stehen.
   Kein Vorspulen auf Verdacht.
3. Sobald `season.id` sich geändert hat, springt der Flow auf den Saisonstart-Schritt und zieht
   `activeSeasonId` **und** `activeMatchday` mit.
4. Der Host kann `season_transition` nicht weiterschalten, solange ein Mitspieler nicht bereit ist.
5. **Gegenprobe:** die Kette innerhalb einer Saison ist unverändert (`standings → lineup`), und
   ohne lesbaren Spielstand bleibt es beim sicheren Rückfall statt bei einer geratenen Richtung.

**Tore:** `npx tsc --noEmit` über `lib/ app/ components/ types/` leer · `npm run ci:flow-smoke`
205/205 · `tests/room-flow-spieltag-zyklus.test.ts`, `tests/room-flow-controller.test.ts`,
`tests/room-store.test.ts`, `tests/room-flow-button-action.test.ts`,
`tests/multiplayer-room-ui-contract.test.ts` grün.

### Paket B — Der Gast sieht, dass der Saisonwechsel dem Host gehört

**Warum überhaupt:** Paket A macht das Gate scharf. Ohne B sieht Franky im Cockpit weiterhin
Knöpfe, die für ihn nichts tun — seit F9 immerhin mit einem lesbaren Satz statt `host_only_action`,
aber eine Absage nach dem Klick ist schwächer als ein Knopf, der von vornherein als „nicht deiner"
erkennbar ist. Der Raum-Flow kennt die Antwort bereits (`describeRoomFlowButton` liefert
`status: "host_only"`); das Cockpit fragt sie nur nicht.

**Dateien** (nach Messung, nicht vorab festgelegt): der Saisonende-Bereich des Cockpits und
`lib/foundation/tabs/cockpit-handlers.ts`.

**Eigenschaften:**
1. Im Raum und ohne Host-Rolle sind die Saisonabschluss-/Saisonwechsel-Knöpfe erkennbar host-only
   — vor dem Klick, nicht danach.
2. **Gegenprobe:** solo und als Host ändert sich nichts.
3. **Gegenprobe:** was Franky sehr wohl darf (Verträge, Sponsor, Verkäufe — siehe 1.3), bleibt
   unangetastet. Ein zu breiter Riegel wäre hier der schlimmere Fehler.

**Tore:** wie A, plus die Cockpit-Suiten.

### Paket C — Der Saisonwechsel kommt ins Tor

**Wo, und warum nicht im Browser-Test:** Der Zwei-Browser-Test fährt heute **einen** Spieltag und
ist schon der langsamste Posten der CI. Zehn Spieltage plus Übergang durch den Browser zu fahren,
wäre teuer und würde vor allem die Arena noch einmal prüfen, die längst geprüft ist. Der richtige
Ort ist `scripts/audit-koop-spielbarkeit.ts` — der treibt Koop auf Socket-/HTTP-Ebene mit
benannten Fällen (B4, C16, …), ohne Browser.

**Was geprüft wird:**
1. Ein Koop-Spielstand am Saisonende läuft durch den Raum-Flow in die neue Saison — mit dem
   Ready-Gate dazwischen.
2. Der Gast wird beim Saisonwechsel abgewiesen (`host_only_action`), **und** seine eigenen
   Saisonende-Aktionen gehen durch. Beide Hälften, sonst misst der Fall nur die halbe Regel.
3. Nach dem Wechsel meldet der Raum die neue Saison und Spieltag 1 — nicht die alte.
4. Ein zweiter Spieltag lässt sich im Raum tatsächlich spielen (der Zyklus ist bisher nur an
   `getNextRoomFlowStepId` geprüft, nie durchlaufen).

**Tor:** der Audit-Lauf grün, und die Fälle stehen mit Nummer und Klartext in seiner Ausgabe.

---

## 4. Arbeitsregeln für dieses Vorhaben

1. **Ein Paket, ein Agent, nacheinander.** Kein paralleles Arbeiten im selben Arbeitsbaum. In
   dieser Session haben sich drei gleichzeitige Agenten vier Mal gegenseitig die Arbeit
   weggeräumt (`git stash` / `git reset --hard`); neue Dateien waren danach endgültig weg, weil
   `git stash` unversionierte Dateien nicht mitnimmt.
2. **Erst messen, dann behaupten.** Jede Zahl und jede „so ist es"-Aussage im Kommentar braucht die
   Stelle, an der man sie nachlesen kann.
3. **Der Test hält die EIGENSCHAFT fest, nicht die Bauweise.** Und zu jedem Fund gehört die
   Gegenprobe: was müsste falsch sein, damit der Test trotzdem grün ist?
4. **Kommentare benennen den Fund und das WARUM**, nicht das Was. „Hier stand vorher X, das führte
   zu Y" — nicht „setzt den nächsten Schritt".
5. **Eine Quelle pro Größe.** Wer beim Umsetzen merkt, dass er eine Liste abschreibt, hört auf und
   fragt.
6. **Bei 0 wird erklärt, nicht versteckt.** Ein Zustand, in dem nichts geht, braucht einen Satz,
   der sagt warum.
7. Änderungen an `docs/` oder am Verhalten brauchen einen Changelog-Eintrag plus
   `npm run changelog:bauen`.

## 5. Was ich danach selbst prüfe

- Läuft der Flow wirklich in die neue Saison, oder springt er nur auf einen Schritt, der dann
  blockiert? (Paket A Eigenschaft 3 gegen die Phasen-Gates gegengelesen.)
- Ist der Riegel in Paket B nicht zu breit geraten — kann Franky sein Saisonende noch spielen?
- Misst Paket C beide Hälften der Regel, oder nur die Ablehnung?
- Und die Frage, die in dieser Session jeden echten Fund gebracht hat: **gibt es hier etwas, das
  gebaut wurde und keinen Aufrufer hat?**

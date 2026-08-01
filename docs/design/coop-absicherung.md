# Coop-Absicherung: Bestandsaufnahme und Testplan

> Ausgangspunkt (Nutzer): „was ist mit den ganzen Themen für coop? es gibt ja auch einige Tests
> habe ich im admin Bereich gesehen die für solo drin sind aber multiplayer nicht getestet wurden.
> kann fable mal einen plan erstellen wie wir am besten gewährleisten dass die features die wir
> haben auch sauber coop fähig sind"

Dieses Dokument ist ein Plan, kein Umbau. Es beschreibt den **gemessenen** Ist-Zustand
(Stand `origin/main` = `b5dc39c`, 2026-08-01), die Risiken in Schwere-Reihenfolge und eine
Teststrategie, mit der jemand direkt anfangen kann. Alle Zahlen unten sind reproduzierbar;
die Messmethode steht im Anhang.

---

## 1. Befund — was es schon gibt, und was die Zahlen sagen

### 1.1 Die Coop-Infrastruktur existiert und ist gut gebaut

Der Kern ist ein serverautoritativer Schreib-Guard, durch den jede Gameplay-Mutation laufen soll:

| Baustein | Datei | Garantie |
|---|---|---|
| Schreib-Guard | `lib/room/server-authoritative-write-guard.ts` (`authorizeServerRoomWrite`, Z. 135–241) | Raum-Bindung des Saves (Z. 148–183), Teilnehmer-Auflösung über `participantId`/`seatToken` (Z. 68–80), Host-only-Aktionen (Z. 47–66, 200–205), Team-Besitz (Z. 207–219), Prisma-Schreibverbot (Z. 139–146), Confirm-Token (Z. 196–198) |
| Team-Besitz-Modell | `lib/room/online-room-model.ts` (`authorizeTeamWrite`, Z. 162–203) | Nur der besitzende Teilnehmer schreibt sein Team; UI-Fokus (`activeManagerTeamId`) und `controlMode` sind ausdrücklich **keine** Berechtigung |
| Routen-Policy als Vertrag | `lib/room/api-write-route-policy.ts` | Allowlist (13 Einträge) + Guard-Pflicht-Liste (8 Einträge), jede mit begründetem `reason` |
| Vertrags-Test | `tests/api-write-route-guard-coverage.test.ts` | Scannt **alle** `app/api/**/route.ts` auf mutierende Methoden und verlangt Guard oder Allowlist-Eintrag |
| Broadcast nach Schreib-Erfolg | `lib/room/room-gameplay-write-notifier.ts` (`notifyRoomGameplayWrite`) | Erfolgreiche Raum-Writes landen als `roomGameplayEvent` + `roomState` beim Mitspieler |
| Raum-Zustand | `lib/room/room-store.ts` (prozessweiter `globalThis.__olyRuntimeRooms`, Z. 33–47; `getActiveRoomBySaveId` Z. 280) | Save↔Raum-Bindung, Seats, Ready-Gates; Coop-Saves werden bewusst vor `getActiveSave()` versteckt (Kommentar Z. 629) |
| Flow-/Ready-Gates | `lib/room/room-flow-controller.ts` (Z. 75–131) | Schritt rückt erst weiter, wenn **alle** menschlichen Teilnehmer mit Team ready sind; Weiterschalten ist Host-only |
| Arena-Gleichschritt | `lib/room/arena-sync-state.ts` | Versionierter, host-gesteuerter Reveal mit Beide-bereit-Gate |
| Kontext-Parsing | `lib/room/parse-room-write-context.ts` | Einheitliches Lesen von `roomCode`/`participantId`/`seatToken` aus URL und Body + deutsche Fehlertexte |

Wichtig fürs Verständnis: Die Phasen-Gates (`lib/foundation/game-phase-action-policy.ts`) sind
save-weit und damit im Coop automatisch für beide Spieler identisch — dort steckt **keine**
Solo-Annahme. Die Solo-Annahmen sitzen woanders (1.4).

### 1.2 Guard-Abdeckung der schreibenden Routen — die Kernzahl

Gemessen über alle 76 `app/api/**/route.ts` (Skript siehe Anhang):

- **48 Routen exportieren mutierende Methoden** (POST/PUT/PATCH/DELETE).
- **34 davon rufen `authorizeServerRoomWrite`** — und **33 dieser 34 rufen auch
  `notifyRoomGameplayWrite`** (die eine Ausnahme ist `app/api/room/route.ts`, die selbst broadcastet).
  Guard und Broadcast laufen also praktisch im Gleichschritt — wer den Guard hat, informiert
  auch den Mitspieler.
- **12 sind bewusst per Allowlist ausgenommen** (Previews, Auth, Dev-Tooling, `new-game`).
- **2 sind weder geschützt noch gelistet**: `app/api/bug-report/route.ts` und
  `app/api/contracts/dissolution/route.ts`. Genau deshalb ist der Vertrags-Test
  `tests/api-write-route-guard-coverage.test.ts` **aktuell rot** (vorbestehend auf `main`,
  verifiziert bei sauberem Arbeitsbaum). Die beiden Fälle sind ungleich schwer:
  - `bug-report` schreibt nur Bug-Reports, keinen Spielstand (`lib/bug-report/bug-report-service.ts`)
    → fehlt schlicht in der Allowlist.
  - `contracts/dissolution` ist ein **echter Gameplay-Write**: `executeLocalContractDissolution`
    persistiert den Spielstand (`lib/morale/contract-dissolution-local-service.ts:114`,
    `saveSingleplayerState`). Kein Guard, kein Broadcast, nur `saveId`+`teamId` aus dem Body
    (`app/api/contracts/dissolution/route.ts:44–87`). Das ist Befund Nr. 1 in der Risikoliste.

### 1.3 Versionierung / Nebenläufigkeit — wo sie greift, wo nicht

- Jeder persistierte Save trägt `saveVersion` + `contentSignature`
  (`lib/persistence/save-repository.ts:657–749`), Schreibrouten geben den neuen Stand zurück
  (z. B. `app/api/lineups/legacy/route.ts:211–216`).
- **Geprüft** wird `expectedSaveVersion` aber nur an drei Stellen:
  - Whole-State-PUT `app/api/singleplayer-state/route.ts:332–354` (→ 409 `stale_save_version`);
    derselbe PUT ist für raumgebundene Saves zusätzlich hart geblockt
    (409 `room_save_generic_write_forbidden`, Z. 374) — der wichtigste
    Letzter-schreibt-gewinnt-Kanal ist im Coop also zu.
  - `lib/season/preseason-workflow-service.ts:1253–1305` — Re-Check nach der Berechnung, mit
    explizitem Coop-Kommentar.
  - `lib/server/server-save-migration.ts:360`.
- **Nicht geprüft** wird die Version bei den per-Aktion-Gameplay-Routen (Kauf, Verkauf,
  Aufstellung, Training, …). Das ist weniger schlimm, als es klingt: alle lokalen Services
  arbeiten synchron auf better-sqlite3, Socket-Server und Next-Handler laufen im selben Prozess
  (genau dafür existiert der `globalThis`-Store, `lib/room/room-store.ts:33–44`), d. h. ein
  Lese-Ändern-Schreib-Zyklus ohne `await` dazwischen kann nicht mit einem zweiten verzahnen.
  Die Restlücke sind Handler mit `await` zwischen Lesen und Schreiben und jedes künftige
  Multi-Prozess-Deployment (Risiko R6).

### 1.4 Solo-Annahmen: der „aktive Spielstand" als Falle (Audit S4)

Das Muster „kein `saveId` übergeben → nimm den aktiven Save" ist im Coop gefährlich, weil der
aktive Save der eines **anderen** Spielers (oder ein ganz anderer Modus) sein kann. Das Problem
ist im Code bekannt — 8 Produktionsdateien tragen „Audit S4"-Kommentare, die genau diese Falle
beschreiben und lokal fixen (u. a. `lib/lineups/legacy-lineup-local-service.ts:55–60`,
`app/api/singleplayer-state/route.ts:538–543`, `lib/season/cash-prize-apply-service.ts:98`).
Coop-Saves werden zudem bewusst so angelegt, dass `getActiveSave()` sie nie zurückgibt
(`lib/room/room-store.ts:629`, `lib/game/new-game-setup-service.ts:537`).

Aber der Fallback lebt noch an etlichen Stellen, gemessen per Grep auf `getActiveSave` ohne
`ownerId` (Anhang): u. a.

- **Schreibpfad:** `lib/ai/ai-season-lifecycle-orchestrator.ts:521`
  (`getSaveById(saveId) ?? getActiveSave()` in `runAiLifecyclePhase` — ein nicht auflösbarer
  `saveId` fällt still auf einen fremden Save zurück, statt zu scheitern); Lesevariante ebenda Z. 492.
- **Fallback bei fehlendem `saveId`:** `lib/market/transfermarkt-local-service.ts:675–692`
  (`resolveLocalSave` — wirft immerhin, wenn ein übergebener `saveId` nicht auflösbar ist).
- Lese-/Preview-Pfade mit demselben Muster: `lib/standings/standings-preview-engine.ts:324`,
  `lib/season/prize-money-preview.ts:257`, `lib/market/transfer-recap-service.ts:128`,
  `lib/persistence/online-save-export.ts:51`, `app/api/season/warmup-derivations/route.ts:20`,
  `lib/season/whole-season-dryrun-service.ts:166` u. a. — falsche Anzeige statt kaputter Daten,
  aber im Coop trotzdem verwirrend („warum sehe ich Frankys Tabelle?").

### 1.5 Der Admin-Bereich, den der Nutzer meint — und warum er nur Solo prüft

Der „Admin-Bereich" ist der Admin-/Simulations-Teil der Foundation-Shell
(`lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:1051–1330`,
`adminSimulation*`/`adminBalancing*`-State) plus die zugehörigen Läufer und Smokes:

- `lib/admin/season-simulation-runner.ts` (2 074 Zeilen): simuliert ganze Saisons, indem er die
  **lokalen Services direkt** aufruft (`executeLocalTransfermarktBuy`, `executeCashPrizeApply`,
  `executeMatchdayAdvance`, … — Importe Z. 5–54). Kein Raum-Kontext, kein Guard, kein Broadcast;
  die zugehörige Route `app/api/admin/season-simulation` ist allowlisted
  (`lib/room/api-write-route-policy.ts:42–46`), Modus `apply` schreibt real.
- `lib/season/whole-season-dryrun-service.ts` — gleiche Bauart, Route ebenfalls allowlisted.
- Die CI-Smokes spielen **ausschließlich Solo** durch: `scripts/smoke-gameplay.ts` (1 Browser,
  aktiver Solo-Save), `scripts/smoke-season-block-{1,2,3}.ts`, `scripts/smoke-local-season-loop.ts`
  usw.

**CI-Stand (die zweite Kernzahl):** `.github/workflows/ci.yml:43–50` führt `app:smoke-gameplay`
(Solo) aus; der einzige Zwei-Browser-Coop-Durchlauf `app:smoke-multiplayer-e2e` ist
**auskommentiert** („TODO(online-mp) … the only remaining red CI step"), bekannter Blocker:
Teilnehmer-Identität nach Seiten-Reload (`scripts/smoke-multiplayer-e2e.ts:560`). Der robustere
Socket-Level-Smoke `scripts/smoke-coop-sync.ts` (prüft Sync + Besitz-Isolation + Arena-Gleichschritt,
ohne UI-Selektoren) existiert samt npm-Script `app:smoke-coop-sync` — **taucht in keiner CI-Datei
auf**. Ergebnis: kein einziger Coop-Pfad läuft automatisiert.

### 1.6 Test-Landschaft

- 574 Testdateien unter `tests/`; **14** erwähnen `roomCode`, **9** referenzieren
  `authorizeServerRoomWrite`.
- Der Guard selbst ist ordentlich unit-getestet: `tests/server-authoritative-write-guard.test.ts`
  (7 Szenarien inkl. Reconnect, Sandbox-Override, Team-Settings-Scoping) und
  `tests/room-store.test.ts` (16 Tests inkl. Ready-Gates, Arena, Team-Zuweisung).
- Auf **Routen**-Ebene wird der Guard aber in mehreren API-Tests **weggemockt** — z. B.
  `tests/scouting-sponsor-api-guards.test.ts:15–17` stubbt `authorizeServerRoomWrite` auf
  `allowed: true`. Behavioral mit echtem Raum getestet sind nur wenige Routenfamilien
  (`tests/training-api-guards.test.ts`, `tests/team-settings-api-guards.test.ts`,
  `tests/singleplayer-state-team-writes-guard.test.ts`, `tests/ai-batch-apply-route-guard.test.ts`,
  `tests/auto-roster-fill-api.test.ts`). Für die Mehrheit der 34 geschützten Routen sichert nur
  der **statische** Scan, dass der Guard-Aufruf existiert — nicht, dass er mit den **richtigen
  Parametern** (korrektes `teamId`, korrekte `action`) verdrahtet ist.

---

## 2. Risiken, nach Schwere geordnet

Jedes Risiko mit konkretem Zwei-Spieler-Szenario (Chris = Host, Franky = Gast) und Woran-erkennt-man-es.

### R1 — `contracts/dissolution` schreibt ungeschützt Spielstand (hoch, sofort behebbar)

**Szenario:** Chris und Franky spielen im Raum. Franky (oder ein abgemeldeter Dritter mit dem
`saveId` aus einer geteilten URL) POSTet `{saveId, teamId: "P-S", playerId, decision: "accepted"}`
auf `/api/contracts/dissolution` — `P-S` ist Chris' Team. Die Route prüft weder Raum noch Besitz
(`app/api/contracts/dissolution/route.ts:44–87`) und löst den Vertrag von Chris' Spieler auf.
Chris sieht davon **nichts**, weil auch kein `notifyRoomGameplayWrite` läuft — sein Kader ist
beim nächsten Reload einfach kleiner.
**Woran erkennbar:** Der Vertrags-Test ist deswegen heute rot; im Spiel: Kaderstand weicht
zwischen den Clients ab, ohne Raum-Event im `roomEvents`-Log.

### R2 — Guard-Verdrahtung je Route ist unbewiesen (hoch, breitester Hebel)

Der statische Scan garantiert nur „irgendwo im File steht `authorizeServerRoomWrite(`". Er fängt
**nicht**: falsches `teamId` (z. B. das UI-Fokus-Team statt des Ziel-Teams), falsche `action`
(eine Team-Aktion versehentlich als `HOST_LEVEL_ACTION` → Besitz-Prüfung entfällt komplett,
vgl. `lib/room/server-authoritative-write-guard.ts:200–205`), Guard-Aufruf nach statt vor dem
Schreiben, oder vergessenes `notifyRoomGameplayWrite`.
**Szenario:** Eine künftige Route übernimmt beim Copy-Paste `action: "matchday_resolve"`
(host-level) für einen Team-Write. Franky kann als Nicht-Host nichts tun (403), aber Chris als
Host kann damit **Frankys** Team umbauen — Besitz-Isolation still ausgehebelt; kein heutiger Test
würde es merken, weil die API-Tests den Guard mocken (1.6).
**Woran erkennbar:** Heute gar nicht automatisiert; im Spiel als „wieso konnte er das an meinem
Team ändern?"-Bug.

### R3 — Raum-Registry ist flüchtig: nach Server-Neustart ist der Coop-Save ungeschützt (mittel-hoch)

Die Save↔Raum-Bindung lebt nur in `globalThis.__olyRuntimeRooms` (`lib/room/room-store.ts:33–47`).
**Szenario:** Mitten in der Session startet der Server neu (Deploy, Absturz). Der Raum ist weg,
`getActiveRoomBySaveId` liefert `null` — damit nimmt der Guard für denselben Save jetzt den
**lokalen Einzelspieler-Pfad** (`server-authoritative-write-guard.ts:150–159`): Requests ohne
Raum-Kontext werden nicht mehr mit 401 abgewiesen, die Besitz-Prüfung stützt sich nur noch auf
`teamControlSettings` mit `DEFAULT_ACTIVE_OWNER_ID`. Beide Clients schreiben weiter, keiner
broadcastet mehr; wer zuerst neu lädt, sieht den Stand des anderen nicht.
**Woran erkennbar:** `room_not_found`/`participant_missing`-Fehler unmittelbar nach Neustart,
danach stilles Auseinanderlaufen der Clients.

### R4 — Admin-/Simulationswerkzeuge laufen am Guard vorbei (mittel)

**Szenario:** Chris öffnet im laufenden Coop-Save den Admin-Bereich und startet
`admin/season-simulation` im Modus `apply` (oder `singleplayer-state/season-start-reset`).
Der Runner schreibt über die lokalen Services direkt (1.5) — Ready-Gates, Team-Besitz und
Broadcast werden übersprungen. Frankys Client zeigt weiter Spieltag 3, der Save steht auf
Saisonende. Es braucht dabei keinen Angreifer: ein gut gemeinter Klick reicht.
**Woran erkennbar:** Kein `save_updated`-Raum-Event trotz massiv verändertem Save;
Frankys UI ist auf Stand X, jede seiner nächsten Aktionen scheitert an Phasen-Gates.

### R5 — `getActiveSave()`-Fallbacks in Schreib-/Servicepfaden (mittel)

**Szenario:** Chris spielt parallel zum Coop-Raum einen Solo-Save (der ist sein „aktiver" Save).
Ein Aufruf von `runAiLifecyclePhase` mit einem `saveId`, der nicht mehr auflösbar ist
(gelöschter Snapshot, Tippfehler in einem Skript), fällt still auf `getActiveSave()` zurück
(`lib/ai/ai-season-lifecycle-orchestrator.ts:521`) und führt die Lifecycle-Phase auf Chris'
**Solo**-Save aus. Fehler wandert lautlos in den falschen Spielstand.
**Woran erkennbar:** Heute gar nicht — der Aufruf „gelingt" ja. Nur Audit im Nachhinein.

### R6 — Keine Versionsprüfung bei per-Aktion-Writes (niedrig-mittel, heute weitgehend theoretisch)

Innerhalb eines Prozesses mit synchronen Services (1.3) können zwei Writes nicht verzahnen; der
Whole-State-Kanal ist für Raum-Saves geblockt. Das Risiko materialisiert sich, sobald (a) ein
Handler zwischen Lesen und Schreiben `await`s bekommt oder (b) jemals mehr als ein Prozess auf
dieselbe SQLite schreibt (PM2-Cluster, zweiter Container).
**Szenario (a):** Ein künftiger Kauf-Handler holt zwischen Preview und Persist asynchron
Portraits nach; genau in dieser Lücke verkauft Franky denselben Free Agent → der zweite Persist
überschreibt den ersten, ein Spieler steht in zwei Kadern.
**Woran erkennbar:** Doppelte `playerId` in zwei Rostern, Kassenstände passen nicht zur
Transferhistorie.

### R7 — CI ist coop-blind (Meta-Risiko, verstärkt alle obigen)

Solange kein Coop-Pfad automatisiert läuft (1.5), bleibt jede Regression aus R1–R6 bis zur
nächsten Hand-Testsession unsichtbar. Der rote Vertrags-Test zeigt das Muster bereits: Der
Vertrag existiert, aber sein Rot blockiert nichts, also erodiert er.

---

## 3. Teststrategie — vier Ebenen, jede fängt eine eigene Fehlerklasse

### Ebene 1: Vertrags-Test grün machen und rot = Blocker (fängt: neue ungeschützte Routen, R1/R7)

1. `contracts/dissolution` in `API_WRITE_ROUTE_GUARD_REQUIRED` aufnehmen und in der Route
   `authorizeServerRoomWrite` (Aktion analog `contract_renewal`, z. B. neues
   `contract_dissolution` in `TeamWriteAction`) + `notifyRoomGameplayWrite` verdrahten —
   Vorlage ist die fast identisch gebaute `app/api/contracts/renewal/route.ts`.
2. `bug-report` mit begründetem Eintrag in `API_WRITE_ROUTE_ALLOWLIST` („schreibt Bug-Reports,
   keinen Spielstand").
3. `tests/api-write-route-guard-coverage.test.ts` läuft in `npm test` bereits mit — sicherstellen,
   dass dieses Rot ab jetzt als Merge-Blocker behandelt wird (es steht nicht in
   `docs/KNOWN_TEST_FAILURES.md`, darf dort auch nicht landen).

Warum zuerst: kleinster Aufwand, schließt das einzige bekannte echte Loch (R1) und macht den
einzigen flächendeckenden Mechanismus wieder scharf, der **künftige** Löcher verhindert.

### Ebene 2: Zwei-Sitzungen-Routentests mit echtem Guard (fängt: Fehlverdrahtung je Route, R2)

Neuer gemeinsamer Aufbau `tests/_helpers/coop-room-harness.ts`:

- erstellt über `lib/room/room-store.ts` (`createRoom`/`joinRoom`/`startRoom` — dieselben
  Funktionen, die `tests/room-store.test.ts:86ff` schon nutzt) einen Raum mit Chris (Host) und
  Franky, echtem SQLite-Test-Save und expliziter Team-Zuteilung;
- liefert je Teilnehmer einen fertigen Schreib-Kontext (`roomCode`, `participantId`, `seatToken`)
  zum Anhängen an Route-Requests.

Darauf eine parametrisierte Suite `tests/coop-write-routes-zwei-sitzungen.test.ts`, die über
`API_WRITE_ROUTE_GUARD_REQUIRED` (und schrittweise die weiteren geschützten Routen) iteriert und
pro Route drei Zusicherungen prüft — **ohne** den Guard zu mocken:

1. **Fremdes Team:** Frankys Sitzung schreibt auf Chris' Team → 403 mit Guard-Reason
   (`team_ownership_missing`/`host_only_action`), Save unverändert (gleiche `saveVersion`).
2. **Eigenes Team:** Besitzer schreibt → 2xx **und** es wurde ein Raum-Event aufgezeichnet
   (`room.state.roomEvents`-Delta bzw. `recordRoomGameplayWrite`-Effekt) — das testet die
   `notifyRoomGameplayWrite`-Verdrahtung gleich mit.
3. **Ohne Raum-Kontext** auf dem raumgebundenen Save → 401 `room_context_required_for_room_save`.

Genau diese drei Zusicherungen unterscheiden „Guard-Aufruf existiert" von „Guard-Aufruf ist
richtig verdrahtet": ein falsches `teamId` lässt Test 1 durch (Franky bekäme 2xx), eine falsche
Host-Level-`action` ebenso, ein vergessener Broadcast lässt Test 2 platzen. Die bestehenden
gemockten API-Tests bleiben unangetastet — sie testen Fachlogik, nicht Autorisierung.

### Ebene 3: Coop-Smoke in CI (fängt: Socket-/Broadcast-/Gleichschritt-Regressionen, R3/R4/R7)

1. **Sofort:** `app:smoke-coop-sync` (`scripts/smoke-coop-sync.ts`) als CI-Schritt hinter dem
   bestehenden `app:smoke-gameplay` in `.github/workflows/ci.yml` einhängen — der Server läuft
   dort schon, der Smoke ist bewusst UI-selektorfrei gebaut und prüft die zwei Kern-Garantien
   (Änderung erreicht Mitspieler; Besitz-Isolation; Arena-Reveal im Gleichschritt).
2. **Danach:** den bekannten Blocker des vollen Zwei-Browser-E2E fixen (Teilnehmer-Restore nach
   Reload, `scripts/smoke-multiplayer-e2e.ts:560`) und den auskommentierten CI-Schritt
   (`ci.yml:50`) reaktivieren. Der Reload-Fall ist zugleich der beste Proxy für R3
   (Rejoin-Robustheit) — der E2E sollte um einen expliziten „Server-Prozess neu starten,
   beide rejoinen"-Abschnitt erweitert werden, der das heutige Verhalten wenigstens **sichtbar**
   macht (erwartetes Ergebnis dokumentieren, auch wenn es vorerst „Raum weg, sauberer Fehler"
   heißt statt stiller Weiter-Schreib-Modus).
3. Für R4 gehört in denselben Smoke ein Negativ-Check: Admin-Simulation (`apply`) gegen den
   Raum-Save muss abgelehnt werden — das erzwingt die kleine Produktänderung „Runner prüft
   `getActiveRoomBySaveId` und verweigert bei Raum-Bindung (oder verlangt Host + broadcastet)".
   Bis dahin dokumentiert der Check den Ist-Zustand als bekannten Fail.

### Ebene 4: Statische Wächter gegen Solo-Annahmen und Verzahnung (fängt: R5/R6-Regressionen)

1. **Audit-S4-Wächter** `tests/kein-aktiver-save-fallback-in-schreibpfaden.test.ts`: Grep-Test
   nach dem Vorbild des Guard-Coverage-Tests, der `getActiveSave()`-Aufrufe **ohne** `ownerId`
   in `lib/**` auflistet und gegen eine explizite, begründete Bestandsliste prüft (Start:
   die in 1.4 genannten Fundstellen). Neue Fundstellen = rot. Parallel die eine echte
   Schreibpfad-Fundstelle entschärfen: `ai-season-lifecycle-orchestrator.ts:521` soll bei
   nicht auflösbarem `saveId` werfen statt zurückzufallen (Muster von
   `transfermarkt-local-service.ts:679–681` übernehmen).
2. **Verzahnungs-Wächter:** ein gezielter Test je „gemeinsame Ressource": doppelter Kauf
   desselben Free Agents aus zwei Sitzungen nacheinander → der zweite muss mit Fachfehler
   scheitern (Spieler nicht mehr frei), nicht still überschreiben. Das ist als synchroner
   Service-Test billig und dokumentiert die Erwartung für den Tag, an dem ein `await` in den
   Pfad rutscht. Eine flächige `expectedSaveVersion`-Pflicht für alle per-Aktion-Routen wird
   bewusst **nicht** vorgeschlagen (siehe 5).

---

## 4. Reihenfolge mit Begründung und Aufwand

| # | Schritt | Warum an dieser Stelle | Aufwand |
|---|---|---|---|
| 1 | Ebene 1: Dissolution-Guard + Bug-Report-Allowlist, Vertrags-Test grün | Schließt das einzige bekannte offene Loch (R1) und reaktiviert den Mechanismus, der alle künftigen Löcher fängt; ohne grünen Vertrag ist jede weitere Testebene Fassade | ~0,5–1 Tag |
| 2 | Ebene 2: Coop-Raum-Harness + Zwei-Sitzungen-Suite über `API_WRITE_ROUTE_GUARD_REQUIRED`, dann schrittweise auf alle 34 geschützten Routen ausweiten | Größter Fang pro investierter Stunde: prüft die 34 Routen erstmals **behavioral** auf Besitz-Isolation und Broadcast (R2), auf der Infrastruktur, die `room-store.test.ts` schon vorlebt | ~2–3 Tage (Harness + erste 8 Routen), dann inkrementell |
| 3 | Ebene 3.1: `app:smoke-coop-sync` in `ci.yml` | Eine Zeile CI für den ersten dauerhaft laufenden Coop-Pfad (R7); Server läuft im Workflow bereits | ~0,5 Tag inkl. Flakiness-Probelauf |
| 4 | Ebene 4.1: Audit-S4-Wächter + Fix `ai-season-lifecycle-orchestrator.ts:521` | Verhindert Wiedereinschleppen des Musters, das schon 8 dokumentierte Fixes gebraucht hat (R5); billig, weil reiner Grep-Test | ~1 Tag |
| 5 | Ebene 3.3: Admin-Runner verweigert Raum-Saves + Negativ-Check im Smoke | Adressiert R4; erst jetzt, weil es die erste echte Produktänderung jenseits einer Route ist und Harness/Smoke zum Absichern schon dastehen | ~1 Tag |
| 6 | Ebene 4.2: Verzahnungs-Wächter (Doppelkauf u. ä.) | R6 ist heute theoretisch; die Tests dokumentieren die Erwartung, bevor sie jemand bricht | ~1 Tag |
| 7 | Ebene 3.2: E2E-Blocker (Reload-Restore) fixen, `smoke-multiplayer-e2e` in CI reaktivieren, Neustart-/Rejoin-Abschnitt ergänzen | Teuerster und unsicherster Schritt (Browser-Flakiness auf CI-Runnern); lohnt erst, wenn die schnellen Ebenen stehen — deckt dann R3 sichtbar ab | ~2–4 Tage |

Gesamtbild: Nach Schritt 1–3 (~1 Woche) ist jede schreibende Route vertraglich erfasst, die
Guard-Pflicht-Routen sind behavioral getestet und ein Coop-Durchlauf läuft in jeder CI — das
deckt R1, R2 und den Kern von R7. Schritte 4–7 härten gezielt nach.

---

## 5. Was bewusst NICHT vorgeschlagen wird

- **Echtzeit-Synchronisation / CRDTs / Operational Transforms.** Das Spiel ist rundenbasiert mit
  Ready-Gates und Host-Advance (`room-flow-controller.ts`); Konflikte entstehen an Runden-Grenzen,
  nicht an gleichzeitigen Feld-Edits. Server-autoritativer Guard + Broadcast ist das richtige
  Modell; Echtzeit-Merge würde enorme Komplexität für einen Konflikt kaufen, den es im Spielfluss
  nicht gibt.
- **Flächendeckende `expectedSaveVersion`-Pflicht auf allen per-Aktion-Routen.** Solange alle
  Writes synchron in einem Prozess laufen (1.3), verhindert sie keinen realen Fehler, zwingt aber
  jeden Client in Retry-Schleifen und macht jede Route und jeden Test breiter. Der gezielte
  Verzahnungs-Wächter (Ebene 4.2) plus die drei bestehenden Checks an den echten
  Async-Grenzen reichen, bis sich die Prozess-Annahme ändert.
- **Raum-Registry jetzt in die Datenbank persistieren.** Das wäre die „richtige" Lösung für R3,
  ist aber ein Umbau von Seats/Tokens/Reconnect mit eigenem Fehlerbudget. Erst mit Ebene 2/3 im
  Rücken lässt sich so ein Umbau gefahrlos machen; bis dahin ist „Neustart ⇒ Raum weg, sauberer
  Fehler, Rejoin nötig" ein akzeptabler, im E2E dokumentierter Zustand.
- **Umstieg der Coop-Writes auf Prisma/Postgres wegen Locking.** Der Guard blockt Prisma-Writes
  absichtlich (`server-authoritative-write-guard.ts:139–146`, „prisma_writes_forbidden_in_local_multiplayer");
  die Prisma-Seite ist als Lese-Referenz gebaut. Ein DB-Wechsel löst kein hier beschriebenes
  Risiko und öffnet viele neue.
- **Ausbau auf mehr als zwei Spieler absichern.** `MAX_ACTIVE_PLAYERS = 2`
  (`lib/game/constants.ts:3`) ist in Seats (`A`/`B`), Presets und Arena verdrahtet. Tests für
  hypothetische 4-Spieler-Räume würden Aufwand in ein Feature stecken, das laut
  `docs/pm-briefings/SPIELBAR-STATUS.md:111` („Nur Solo 1 Team — Online 4v4 kommt später")
  bewusst zurückgestellt ist. Die Zwei-Sitzungen-Suite ist so zu bauen, dass ein dritter
  Teilnehmer später nur ein weiterer Harness-Parameter ist.

---

## Anhang: Messmethode

- **Routen-Zählung:** Python-Scan über alle `app/api/**/route.ts` (76 Dateien) auf
  `export async function (POST|PUT|PATCH|DELETE)` → 48 mutierende Routen; String-Match auf
  `authorizeServerRoomWrite` → 34, auf `notifyRoomGameplayWrite` → 33. Dieselbe Heuristik wie im
  Vertrags-Test `tests/api-write-route-guard-coverage.test.ts:13–15`.
- **Roter Vertrags-Test:** `npx vitest run tests/api-write-route-guard-coverage.test.ts` auf
  unverändertem `origin/main` (`b5dc39c`): 1 failed / 3 passed; Fehlliste exakt
  `["bug-report", "contracts/dissolution"]`.
- **Test-Landschaft:** `ls tests/*.test.ts | wc -l` → 574; `grep -l roomCode tests/*.test.ts`
  → 14 Dateien; `grep -rl authorizeServerRoomWrite tests` → 9 Dateien.
- **`getActiveSave`-Fundstellen:** `grep -rn "getActiveSave\b" lib app` ohne Testdateien,
  manuell klassifiziert nach Schreib-/Lese-Pfad (Abschnitt 1.4).
- **CI-Stand:** `.github/workflows/ci.yml` (Solo-Smoke Z. 43, auskommentierter Coop-E2E Z. 44–50);
  `ci-nightly.yml` ist auf `workflow_dispatch` stillgelegt.

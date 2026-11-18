# Draft-Neubau, Stufe Kern — Liga-Draft im Einzelschritt (18.11.2026)

**Stand:** Kern gebaut (Zustand, KI-/Mensch-Pick, Top 3, Überspringen A/B, Route `/api/draft`), Messlauf alt gegen neu
gelaufen. **Noch keine Seite** — die baut danach ein Sonnet-Agent nach dem Mockup (Abschnitt 5 ist seine Schnittstelle).
Der alte Hintergrund-Draft bleibt **Standard**; der neue läuft nur mit `OLY_LIGA_DRAFT_MODUS=einzelschritt`.

- Konzept und Mockup (freigegeben, Branch `claude/draft-mockup-18-11`): `docs/design/draft-modern-18-11.md`,
  `public/mockups/draft-modern-18-11.html`; dort am Ende „Entscheidungen von Chris“.
- Code: `lib/draft/liga-draft-modell.ts` (Regeln, rein), `lib/draft/liga-draft-ki.ts` (KI-Bewertung eines Picks),
  `lib/draft/liga-draft-dienst.ts` (Aktionen, Schreiben), `lib/draft/liga-draft-ansicht.ts` (Lesesicht),
  `app/api/draft/route.ts`, Zustandstyp `LigaDraftZustand` in `lib/data/olyDataTypes.ts`.
- Tests: `tests/liga-draft-modell.test.ts` (Regeln), `tests/liga-draft-kern.test.ts` (Integration gegen einen
  Wegwerf-Spielstand), `tests/liga-draft-api.test.ts` (Rechte der Route, Schalter, `erwarteteNr`, `mein`),
  `tests/liga-draft-sperrt-ki-kaufwege.test.ts` (kein KI-Kauf neben dem Draft), `tests/liga-draft-ki-nachruecken.test.ts`
  (KI kauft nach, statt nach drei Fehlkäufen aufzugeben).
- Messung: `scripts/miss-teamfinanzen-saison.ts --draft block|einzelschritt`, Auswertung
  `scripts/auswerte-liga-draft-alt-neu.ts`.

---

## 1. Regeln (Chris, 18.11. abends) und wie sie umgesetzt sind

| Regel | Umsetzung |
|---|---|
| Jede Runde beginnt beim **schwächsten Team** | Beim Start jeder Runde: Kaderstärke = Ø über alle 20 Disziplinen der besten sechs Eignungen (fehlende Plätze zählen 20, dieselbe Formel wie `transfermarkt-kaderstaerke.ts`). Aufsteigend sortiert. Gleichstand (Runde 1: alle Kader leer): **weniger Kasse zuerst**, dann die Saat des Spielstands. `berechneRundenReihenfolge` |
| Höchstens **16 Runden**, höchstens **14 Picks** je Team | `regeln.maxRunden`, `regeln.maxPicksJeTeam`; mit 14 Picks ist ein Team `fertig` (`max_picks`), nach Runde 16 endet der geordnete Teil (`draft_ende`) |
| Ein Team darf einen Pick **auslassen** | Aktion `auslassen` (nur Menschen, am eigenen Zug, nicht mit Auto-Pick an). Wer zweimal auslässt, kommt in 16 Runden trotzdem auf 14 Picks. **Grenze (Review #1619, A5):** auslassen nur, solange die restlichen Runden danach noch für die fehlenden Pflichtplätze reichen (`darfAuslassen`: `maxRunden − runde ≥ 8 − Kader`), außer es ist nichts mehr leistbar — kein Draft-Ende mit 0 Spielern durch wiederholtes Auslassen |
| KI hört auf, wenn ihr Kader steht | Die KI steigt aus, sobald ihr Stop-Nutzen den besten Kauf schlägt (`ki_stop`), nichts mehr leistbar ist (`nichts_leistbar`) oder der Kader voll ist — genau die Abbruchgründe der bisherigen Schleife |
| Der Draft **wartet auf Menschen**, keine Uhr | `werIstDran` liefert `automatisch: false` für einen Menschen ohne Auto-Pick; KI-Läufe halten dort an (`halt: "mensch_am_zug"`) |
| **Auto-Pick je Mensch** einschaltbar | Aktion `auto_pick` (`an: true/false`). Für ein fremdes Team nur als Gastgeber („Auto-Pick auslösen“ für einen Abwesenden, Konzept Frage 7) |
| **Ramona** (halbautomatisch) draftet selbst | Seit PR #1620 steht die Halbautomatik auf `draft: "selbst"`. Auto-Pick **an** bekommt ein Mensch NUR mit delegiertem Draft (`isBereichDelegiert(…, "draft")`, also `draft: "ki"`), egal ob er in der Ausschlussliste steht; alle anderen Menschen picken selbst. Auto-Pick lässt sich jederzeit umschalten, Variante A führt in den Nachzug |
| **Überspringen** A / B | A: das Team verlässt die Reihenfolge (`status: "nachzug"`), die KI pickt fertig, danach wählt der Mensch ohne Reihenfolge aus dem Rest und meldet „fertig“ ab 8 Spielern. B: Auto-Pick an, das Team bleibt in der Reihenfolge |
| Pflichtplätze | Ein Mensch kann nur picken, wenn danach die Kasse noch die billigsten freien Spieler für die fehlenden Pflichtplätze (bis 8) trägt; unter 8 bleibt der billigste freie Spieler immer pickbar (Mockup Abschnitt 3). „Ich bin fertig“ erst ab 8 — darunter nur, wenn nichts mehr leistbar ist (Grund `nichts_leistbar`) |
| Kein Kauf am Draft vorbei | Während der geordneten Phase lehnt `/api/transfermarkt/buy` echte Käufe mit `liga_draft_laeuft` ab (`ligaDraftSperrtMarktkauf`, nur mit Schalter an). Die KI-Kaufwege neben dem Draft fragen die zentrale Funktion `ligaDraftLaeuft` (Schalter an UND Draft dieser Saison nicht `fertig`, also auch im Nachzug): Preseason-Lauf übersprungen (`liga_draft_laeuft`, ohne Lauf-Datensatz), `/api/ai/picks-run` und `/api/ai/roster-fill` antworten 409 `liga_draft_laeuft`. Schalter aus: ein liegengebliebener Draft sperrt nichts |
| KI kauft nach | Scheitert der Kauf von Platz 1, rücken die nächsten Kandidaten nach — Rangliste aufgeweitet (Top 3 → 20 → 200), gescheiterte Spieler ausgeschlossen, unter 8 zuletzt der billigste leistbare freie Spieler (`kaufeMitNachruecken`, Review #1619 A4). Aufgegeben wird erst, wenn nichts mehr kaufbar ist (`nichts_leistbar`) oder bei einem teamweiten Grund bzw. 40 Fehlversuchen (`kauf_blockiert`) |
| **Saison 1: Draft-Rücklage UND Gehaltspuffer halb** | Die KI-Rücklage ist `max(q × Budget, 0,35 × Zielgehalt)`; der zweite Term ist der Gehaltspuffer. Der Saison-1-Faktor `SAISON_EINS_RUECKLAGE_FAKTOR = 0,5` wirkt auf das Maximum, also auf beide Terme (`draft-adapter.ts`). Das galt schon vorher für die KI; jetzt als benannte Konstante mit Test (`liga-draft-kern.test.ts`). Für Menschen gibt es die Rücklage noch nicht als harte Grenze (sie ist laut Finanzvorgabe weich); der Budget-Dienst (Finanzkonzept V2, Stufe 2a) hängt sie in der Seite an |
| Scouting-Nebel, Marktwert/Ablöse exakt | Die Lesesicht trägt je Spieler nur Name, Klasse, Rasse, Marktwert (= Ablöse) und Gehalt — beides exakt, keine Eignung, keine Achsen, keinen KI-Nutzwert. Werte holt die Seite genebelt aus dem Brett (`/api/transfermarkt/free-agents` + `baueSpielerSicht`) |
| Liga-Status | Während der geordneten Phase `leagueSetupStatus: "in_progress"` (Spieltage gesperrt wie beim alten Draft), danach `"ready"` mit `leagueSetupWarnings` für Teams unter 8 — auch wenn Menschen noch im Nachzug sind (dort stand der alte Ablauf auch) |

## 2. Keine zweite Kauflogik

- **Die KI-Entscheidung ist der alte Greedy-Loop, ein Schritt davon.** `buildOrganicSquadPlan` ist zerlegt in
  `createOrganicPlanStepState` / `organicBuyStep` / `applyOrganicBuyStep`; die Schleife ruft genau diese drei.
  Nachgewiesen bit-gleich: Prüfsumme über die Pläne aller 32 Teams eines frischen Spielstands vor und nach dem Umbau
  identisch (`32bd0b2594dbca6b`). `planOrganicDraftForTeam` baut seinen Rahmen jetzt über `buildOrganicDraftFrame` und
  plant darauf — dieselbe Prüfsumme.
- **Der Einzelschritt sieht denselben Zustand wie die Schleife.** Der Planrahmen (Rücklage, Puffer, Komposition,
  Themen-Kontext, Vorstand) entsteht aus dem Spielstand **zu Draft-Beginn** (Startkader und Startkasse je Team liegen
  im Draft-Zustand), die bisherigen Draft-Picks des Teams werden als Käufe dieses Plans eingespielt. Einzige Absicht:
  der Pool ist der, den die anderen Teams übriggelassen haben. Test: der erste Pick eines Teams aus dem vollen Pool ist
  genau die erste Entscheidung von `planOrganicDraftForTeam` (gleicher Spieler, gleicher Nutzen, gleicher Zielkader).
- **Superstar-Lizenz** einmal zu Draft-Beginn je Team vergeben und festgehalten (`superstarLizenz` im Zustand). Sonst
  würde sie mit jedem Pick neu gewürfelt (die Lizenzrechnung liest Kasse und Kader aller Teams).
- **Kandidaten** = alle Spieler ohne Kader in Spielstand-Reihenfolge; im frischen Saison-1-Stand ist das exakt der Feed
  `listLocalTransfermarktFreeAgents({ fullPool: true })` des Blocklaufs (Test), ohne dessen 0,5–0,8 s je Aufruf.
- **Gekauft wird über `executeLocalTransfermarktBuy`**: KI mit Quelle `ai_roster_fill` (wie der Blocklauf), Mensch mit
  `manual_transfermarkt_buy` (wie die Kauf-Route), mit Phasen-Prüfung `buy_players`. Scheitert der Kauf von Platz 1,
  nimmt die KI wie im Blocklauf den nächsten Kandidaten (`grund: "platz_1_nicht_kaufbar"`).
- **Kredite**: der Blocklauf fragt vor dem Kaufen `resolveAiLoanDecision`; in Saison 1 gibt es keine Kredite (harte
  Regel), der Draft läuft nur in Saison 1 — deshalb fragt der Einzelschritt nicht.

## 3. Draft-Zustand im Spielstand (`seasonState.ligaDraft`)

```ts
LigaDraftZustand = {
  version: 1; saisonId; status: "laeuft" | "nachzug" | "fertig"; seed;
  regeln: { maxRunden: 16; maxPicksJeTeam: 14; minKader: 8 };
  runde;                 // 1-basiert
  reihenfolge: string[]; // laufende Runde, schwächstes Team zuerst
  platz;                 // 0-basierter Zeiger in reihenfolge
  teams: Record<teamId, {
    art: "ki" | "mensch"; ownerId; autoPick; status: "aktiv" | "fertig" | "nachzug";
    fertigGrund: "ki_stop" | "kader_voll" | "max_picks" | "nichts_leistbar" | "kauf_blockiert" | "mensch_fertig" | "draft_ende" | null;
    picks; auslassungen; startKaderIds; startKasse; superstarLizenz;
  }>;
  verlauf: Array<{ nr; pickNr; runde; platz; teamId; art: "pick" | "auslassen" | "aus" | "ueberspringen";
                   playerId; quelle: "ki" | "mensch" | "auto" | "nachzug"; abloese; gehalt; transferId;
                   top3: [{ playerId, nutzen }] | null; grund; zeit }>;
  erstelltAm; aktualisiertAm; beendetAm;
}
```

Jede Aktion liest den Spielstand frisch, rechnet synchron und schreibt Kauf **und** Draft-Zustand in **einem**
Schreibvorgang (`flushLocalTransfermarktRunContext`). Ein Koop-Schreibkonflikt wird wie im Blocklauf mit frischem Stand
wiederholt (bis 3 Anläufe). Doppelklick/Wettlauf: jede schreibende Aktion nimmt `erwarteteNr` (= `stand` der Sicht) und
antwortet bei Abweichung `409 draft_stand_veraltet`.

## 4. Anlegen und Rückweg

`kickoffLeagueSetupDraft` (fresh-season-1, Neues-Spiel-Assistent, Koop-Raumstart) prüft `OLY_LIGA_DRAFT_MODUS`:

- **nicht gesetzt (Standard):** der bisherige Hintergrund-Draft (`fuehreLigaSetupDraftAus` → `runAiPicksExecutePreview`),
  unverändert. Das ist der Rückweg, bis der neue Draft abgenommen ist.
- **`einzelschritt`:** `starteLigaDraft` legt den Zustand an (die Ausschlussliste der Aufrufer = „diese Menschen picken
  selbst“), danach fährt `laufeKiImHintergrund` die KI-Züge bis zum ersten Menschen ohne Auto-Pick (in einer reinen
  KI-Liga bis zum Ende), in Häppchen von 8 Zügen mit Pause für die Event-Loop. Von da an treibt die Seite den Draft.
  Bricht der Hintergrundlauf ab, steht die Liga auf `leagueSetupStatus: "failed"` (Fehler wird nicht verschluckt,
  Review #1619 A2); fortsetzen über `/api/draft` `ki_hintergrund` — jeder Draft-Schreibvorgang setzt wieder
  `in_progress`. Der „Erneut versuchen“-Knopf der Shell läuft über `/api/ai/picks-run` und bekommt bei laufendem Draft
  409 `liga_draft_laeuft` (er würde sonst mit `includeManualTeams` auch Menschen den Kader füllen).
- **Anlegen nur im frischen Saison-1-Aufbau** (`ligaDraftAnlegenVerboten`, Review #1619 S1): Saison 1, kein
  Spieltagsergebnis dieser Saison, Phase `preseason_management` ODER Saisonstart-Setup (`season_active`, Spieltag 1
  offen — so startet ein neues Spiel tatsächlich, und nur dort darf gekauft werden). Ein laufender Draft wird
  zurückgegeben, ein `fertig`er **nie** neu angelegt (`draft_schon_fertig`).

## 5. Schnittstelle für die Seite (Sonnet-Agent)

### 5.1 Lesen

`GET /api/draft?saveId=…&teamId=<eigenes Team>&vorschau=6&verlauf=40` → `{ ansicht: LigaDraftAnsicht | null, hintergrundLaeuft }`.
`ansicht` ist `null`, solange kein Draft für die laufende Saison existiert (dann: alter Ablauf).

**`mein` ist privat (Review #1619, A7):** die Route füllt `mein` (Vorschlag des eigenen GM, Kasse, Pflichtreserve,
`maxAbloese`) nur, wenn der Aufrufer für `teamId` dasselbe Schreibrecht hat wie zum Picken (`draft_pick`). Dafür
schickt die Seite die Raumfelder **auch beim GET als Query-Parameter** mit (`roomCode`, `participantId`, `seatToken`,
`userId`, `activeManagerTeamId` — wie `parseRoomWriteContextFromRequest` sie liest). Ohne Recht (oder ohne `teamId`)
kommt die öffentliche Sicht mit `mein: null`, kein Fehler. Dasselbe gilt für die `ansicht` in POST-Antworten.

| Feld | Für welches Element im Mockup |
|---|---|
| `status`, `runde`, `regeln`, `picks`, `stand` | Regieband: Runde, Picks; `stand` an jede POST-Aktion als `erwarteteNr` |
| `amZug` (`teamId`, `art`, `automatisch`, `ownerId`, `top3`, `top3Gruende`, `absicht`) | „Am Zug“ links oben: KI-Team mit Top 3 (Rang 1 = der Pick), `absicht: "aufhoeren"` = Team steigt aus; Mensch: `top3: null` → „Franky wählt · der Draft wartet“ |
| `wartetAufMensch` | Taktgeber „Warten auf …“ / Tempo-Steuerung pausieren |
| `kette` (`teamId`, `platz`, `erledigt`, `amZug`) | Kopfleiste: die Wappenkette der Runde |
| `naechste` (wie `amZug`, Index 0 = jetzt) | „Danach am Zug“ (sechs Züge, auch in die nächste Runde hinein — Vorschau nach heutiger Stärke) |
| `gefragt` (playerId → Zahl) | Spalte „gefragt“ im Brett. Gezählt über die angezeigten Züge (jetzt + `vorschau`), nicht über alle 32 Teams (Kosten, s. 6.3) |
| `top3Gruende[i].art` | Grund auf der Karte: `star`, `bedarf` (+ `disziplinId`), `preis_leistung`, `kadertiefe` (nur Anzeige) |
| `teams[]` (`art`, `ownerId`, `autoPick`, `status`, `fertigGrund`, `picks`, `auslassungen`, `kader`, `kasse`, `kaderStaerke`) | Kette, Pick-Tafel-Spalten, Sitze rechts oben (Menschen: `art: "mensch"` + `ownerId`), „fertig“-Markierung |
| `verlauf[]` (`pickNr`, `runde`, `platz`, `teamId`, `art`, `playerId`, `quelle`, `abloese`, `gehalt`, `top3`) | Live-Ticker (letzte 7), Pick-Tafel (`verlauf=0` liefert alle) |
| `spieler` (playerId → Name, Klasse, Rasse, `marktwert`, `gehalt`) | Karten für alle Spieler aus `naechste`/`verlauf`/`mein` — ohne verdeckte Werte |
| `mein` (`amZug`, `darfPicken`, `darfAuslassen`, `darfFertig`, `darfUeberspringen`, `autoPick`, `kader`, `kasse`, `pflichtReserve`, `maxAbloese`, `vorschlag`, `picksBisZug`) | „Mein Draft“: Pick-Knopf, „Ich bin fertig“, Auto-Pick-Schalter, „in n Picks“, Vorschlag des eigenen GM (3 Karten), „zu teuer“ = Ablöse > `maxAbloese`. `darfAuslassen` ist `false`, sobald die Restrunden nicht mehr bis 8 reichen (A5) oder Auto-Pick an ist; `darfFertig` ab 8 oder wenn nichts mehr leistbar ist. Nur für das eigene Team (s. oben) |

Das **Brett** (freie Spieler, Filter, Sortierung, Nebel) kommt unverändert aus `/api/transfermarkt/free-agents` und
`baueSpielerSicht` (`lib/market/transfermarkt-sicht.ts`); Top-3-Spieler, die das Brett zeigt, über ihre `playerId`
verknüpfen. Pick-Tafel und Ergebnis lesen `verlauf` (alle) und `teams`.

### 5.2 Schreiben

`POST /api/draft` mit `{ saveId, teamId, aktion, erwarteteNr, …, roomCode, participantId, seatToken, userId, activeManagerTeamId }`
(Raumfelder wie bei der Kauf-Route, `withRoomContextBody`). Antwort: `{ success, …, ansicht }` (frische Sicht für
`teamId`, `mein` nur bei Schreibrecht) oder `{ success: false, error }` mit Status.

**Vorbedingungen (Review #1619):**
- **Schalter (S1):** ohne `OLY_LIGA_DRAFT_MODUS=einzelschritt` antwortet jede Aktion `409 liga_draft_modus_aus` —
  einzige Ausnahme `abbrechen` (Ausweg für einen liegengebliebenen Draft).
- **Laufender Draft (S1):** jede Aktion außer `starten` und `abbrechen` braucht einen Draft dieser Saison, der nicht
  `fertig` ist (`ligaDraftLaeuft`), sonst `409 draft_laeuft_nicht`; `abbrechen` ohne Draft: `404 liga_draft_fehlt`.
- **`erwarteteNr` ist Pflicht (A6)** für jede Aktion außer `starten` (also auch `fertig`, `ueberspringen`, `auto_pick`,
  `ki_hintergrund`, `abbrechen`): ganze Zahl = `ansicht.stand`. Fehlt sie: `400 erwarteteNr_fehlt`; weicht sie ab:
  `409 draft_stand_veraltet` → Sicht neu laden.

| `aktion` | Felder | Wirkung | Recht |
|---|---|---|---|
| `ki_schritt` | `maxPicks` (Standard 1, **höchstens 8**, A3), `erwarteteNr` | fährt bis zu `maxPicks` automatische Züge; Antwort `eintraege`, `halt: "mensch_am_zug" \| "max_picks" \| "draft_vorbei"`. Tempo 1×/3× = die Seite ruft alle 2,4 s bzw. 0,8 s einen Schritt | eigenes Team (Nachweis des Sitzes) |
| `ki_hintergrund` | `erwarteteNr` | KI fährt im Hintergrund bis zum nächsten Menschen bzw. zum Ende; Fortschritt per GET (`hintergrundLaeuft`) | eigenes Team |
| `pick` | `playerId`, `erwarteteNr`, `idempotencyKey` | Mensch-Pick am eigenen Zug oder im Nachzug | eigenes Team |
| `auslassen` | `erwarteteNr` | lässt den eigenen Pick aus — nicht mit Auto-Pick an (`auto_pick_ist_an`), nicht wenn die Restrunden dann nicht mehr bis 8 reichen (`auslassen_unter_mindestkader`) | eigenes Team |
| `fertig` | `erwarteteNr` | „Ich bin fertig“ (ab 8 Spielern, darunter nur wenn nichts mehr leistbar ist; auch im Nachzug) | eigenes Team |
| `ueberspringen` | `variante: "A" \| "B"`, `erwarteteNr` | A: Nachzug, danach `ki_hintergrund` aufrufen; B: Auto-Pick an | eigenes Team |
| `auto_pick` | `an`, optional `zielTeamId`, `erwarteteNr` | Auto-Pick ein/aus; für ein fremdes Team nur Gastgeber | eigenes Team / Gastgeber |
| `starten` | — | legt den Draft an (falls keiner läuft; nur im frischen Saison-1-Aufbau; nie über einen `fertig`en). Die menschlich geführten Teams (Raum: `teamOwnership`, sonst `controlMode: "manual"`) picken selbst; Auto-Pick nur mit delegiertem Draft | Gastgeber |
| `abbrechen` | `erwarteteNr` | Draft → `fertig` (offene Teams `fertigGrund: "abgebrochen"`), Liga `ready` mit Warnungen für Teams unter 8, Marktsperre weg; ein laufender Hintergrundlauf hält von selbst an. Geht auch mit Schalter aus | Gastgeber |

Rechte wie bei allen Schreibrouten: `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId` (nie die
Identität aus dem Body); Team-Aktionen mit der neuen Team-Aktion `draft_pick`, Gastgeber-Aktionen mit dem host-level
`ai_picks_run_execute`. Im Raum wird jeder Schreibvorgang als `roster_updated` (Ansichten `draft`, `market`, `team`)
an alle Teilnehmer gesendet — die Seite lädt dann die Sicht neu.

Fehlercodes: `nicht_am_zug`, `auto_pick_ist_an`, `team_ist_ki`, `team_nicht_im_draft`, `kader_voll`,
`kader_unter_minimum`, `spieler_vergeben`, `spieler_unbekannt`, `reserve_fuer_pflichtplaetze`,
`nachzug_erst_nach_dem_draft`, `draft_laeuft_nicht`, `team_nicht_aktiv`, `draft_stand_veraltet`, `liga_draft_fehlt`,
`liga_draft_modus_aus`, `erwarteteNr_fehlt`, `auslassen_unter_mindestkader`, `draft_schon_fertig`, `nur_saison_1`,
`saison_laeuft_schon`, `nur_im_saisonaufbau`, sowie die Gründe des Kaufwegs (`blockingReasons[0]`). Neuer
`fertigGrund`: `abgebrochen`; ein KI-Pick aus der Notfall-Liste trägt `grund: "notkauf_mindestkader"`.

## 6. Messlauf alt gegen neu (32 KI-Teams)

Aufbau: `scripts/miss-teamfinanzen-saison.ts --nur-anlage` legt ein neues Spiel mit 32 KI-Teams von Anfang an an (alle
mit Sponsor, Finanzvorgabe 18.11.). Dieselbe Basis-SQLite wird kopiert und einmal mit dem Blocklauf (`--draft block`),
einmal mit dem Einzelschritt (`--draft einzelschritt`, ein Schreibvorgang je Zug wie über die Route) gedraftet; Paar 1
läuft danach durch alle 20 Spieltage von Saison 1. Auswertung `scripts/auswerte-liga-draft-alt-neu.ts`.

Zwei Paare, je dieselbe Basis (Paar 1: `new-game-1795022172536-3ouih3`, Paar 2: `new-game-1795023311779-kmaomm`), 64
Team-Zeilen. Beide Wege sind deterministisch: zwei Läufe derselben Art auf derselben Basis ergaben dieselbe Summe der
Kassen (Blocklauf 627,67, Einzelschritt 635,44). „Kasse nach S1“ = nach 20 Spieltagen, vor dem Saisonabschluss
(nur Paar 1). „solide“ = Eignung > 60 (`SOLIDE_THRESHOLD` der KI).

**Ergebnis: die KI kauft im Einzelschritt nicht schlechter.** Kaderstärke, Kadergröße, Gehalt, Marktwert, Kasse nach
dem Draft und nach Saison 1 und die Abdeckung der 20 Disziplinen liegen im Mittel innerhalb von ±0,3 (Stärke Δ 0,0;
31 Teams schlechter, 31 besser). Die Pick-Reihenfolge erzeugt **keinen systematischen Nachteil**: Teams, die in Runde 1
hinten picken, liegen in der Stärke bei Δ 0,0 (vorne 0,0, Mitte +0,1). Einzelne Teams verschieben sich um bis zu ±1,8
Stärkepunkte (andere Spieler, gleiche Identität) — dieselbe Streuung, die der Saat-Jitter der KI ohnehin erzeugt.

**Laufzeit:** der Einzelschritt mit einem Schreibvorgang je Zug (so, wie die Seite im Tempo 1×/3× schrittweise ruft)
braucht 450–470 s für die ganze Liga (1,2 s je Zug auf der ausgelasteten Maschine, Last 5–10), der Blocklauf 88–152 s.
Der Großteil eines Zugs ist der Schreibvorgang (~0,5 s), die KI-Bewertung ~0,2 s. Für das Live-Tempo (2,4 s je Pick bei
1×) reicht das. Der Hintergrundlauf (Überspringen, reine KI-Liga) schreibt in Häppchen von 8 Zügen: **166 s** für alle
379 Züge (0,44 s je Zug), unter derselben Last. Anlegen des Drafts ~9 s (Superstar-Lizenz je Team), eine Lesesicht mit
7 KI-Bewertungen ~1,9 s, aus dem Merker 28 ms.

| Groesse | alt Ø | neu Ø | alt Median | neu Median | Δ Ø (neu − alt) | Teams neu schlechter / besser | alt min | neu min |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Kaderstaerke (Top-6, Ø 20 Disz.) | 46.8 | 46.8 | 46.7 | 47.1 | 0 | 31 / 31 | 38.7 | 39.4 |
| Kader (Spieler) | 10.8 | 10.8 | 11 | 10 | 0 | 9 / 12 | 8 | 8 |
| Gehalt (Summe) | 63.7 | 63.4 | 62.3 | 62.6 | -0.2 | 34 / 30 | 37.3 | 40.2 |
| Marktwert Kader | 227.7 | 227.8 | 227.7 | 226.9 | 0.1 | 30 / 33 | 152.1 | 150.9 |
| Kasse nach Draft | 19.8 | 19.7 | 17.9 | 17.4 | -0.1 | 33 / 30 | 8.1 | 9 |
| Kasse nach S1 (20 Spieltage) | 19.4 | 19.7 | 17.4 | 19.5 | 0.2 | 13 / 17 | 2.9 | 4.4 |
| Staerke nach S1 | 46.7 | 46.6 | 46.7 | 46.2 | -0.1 | 17 / 15 | 39 | 39.4 |
| Disziplinen mit ≥1 solidem Spieler (von 20) | 12.9 | 12.8 | 12 | 13 | -0.1 | 17 / 21 | 5 | 3 |
| Disziplinen mit ≥3 soliden Spielern (von 20) | 1.9 | 1.8 | 1.5 | 1 | -0.1 | 16 / 18 | 0 | 0 |
| Schwaechste Disziplin (Top-6) | 36.7 | 36.7 | 36.7 | 37 | -0.1 | 32 / 30 | 25.1 | 24 |

#### Pick-Reihenfolge: Δ Kaderstaerke (neu − alt) nach Platz in Runde 1

| Platz in Runde 1 | Teams | Δ Staerke Ø | Δ Kader Ø | Δ Kasse nach Draft Ø | Δ Kasse nach S1 Ø |
|---|---:|---:|---:|---:|---:|
| vorne (1–11) | 22 | 0 | 0 | 0.1 | 0.2 |
| Mitte | 22 | 0.1 | 0 | 0.2 | 1.1 |
| hinten | 20 | 0 | 0.1 | -0.6 | -0.6 |

#### Laufzeit des Drafts (Wanduhr, ganze Liga)

| Paar | alt (Blocklauf, 1 Schreibvorgang je Team) | neu (Einzelschritt, 1 Schreibvorgang je Zug) | Zuege neu | je Zug |
|---|---:|---:|---:|---:|
| 1 | 88.6 s | 448.7 s | 379 | 1184 ms |
| 2 | 152 s | 469.9 s | 372 | 1263 ms |

#### Je Team (Paar 1, mit Saison 1)

| Team | Platz R1 | Staerke alt → neu | Kader alt → neu | Gehalt alt → neu | Kasse Draft alt → neu | Kasse S1 alt → neu | ≥3 solide alt → neu |
|---|---:|---:|---:|---:|---:|---:|---:|
| P-S | 1 | 52.6 → 52.4 | 11 → 11 | 87.5 → 79.9 | 16.4 → 16.4 | 22.4 → 22.4 | 4 → 4 |
| R-R | 2 | 39.8 → 39.6 | 10 → 10 | 40.3 → 40.5 | 16.5 → 19 | 20.5 → 23 | 1 → 1 |
| A-A | 3 | 41.2 → 40.8 | 11 → 9 | 52 → 52.6 | 8.2 → 12.4 | 10.2 → 14.4 | 1 → 1 |
| V-W | 4 | 40.2 → 40.3 | 12 → 12 | 43.3 → 53.1 | 9 → 9.1 | 12 → 12.1 | 0 → 1 |
| B-B | 5 | 41.6 → 41.3 | 11 → 11 | 55 → 55.7 | 10.4 → 11.9 | 2.9 → 4.4 | 1 → 1 |
| U-A | 6 | 39 → 39.4 | 13 → 13 | 48.8 → 48.3 | 15.2 → 13.1 | 10.7 → 8.6 | 1 → 1 |
| D-L | 7 | 41.3 → 41.7 | 12 → 13 | 49.3 → 50.8 | 15.6 → 14.2 | 15.6 → 14.2 | 0 → 0 |
| P-C | 8 | 41.4 → 40.9 | 10 → 10 | 48.7 → 46.5 | 25.9 → 24.7 | 21.9 → 20.7 | 0 → 0 |
| S-C | 9 | 43.7 → 44.9 | 8 → 9 | 44.5 → 51.3 | 15.7 → 15.9 | 15.2 → 15.4 | 4 → 2 |
| T-C | 10 | 39.6 → 40.3 | 12 → 12 | 42.8 → 46.5 | 23.6 → 24.1 | 23.6 → 24.1 | 1 → 1 |
| C-C | 11 | 42.8 → 43.2 | 12 → 12 | 53.1 → 50.6 | 29.3 → 26.8 | 31.3 → 28.8 | 0 → 0 |
| R-C | 12 | 45.4 → 45.6 | 8 → 9 | 51.6 → 55 | 24.1 → 20.3 | 28.1 → 24.3 | 0 → 0 |
| L-K | 13 | 44.4 → 45.1 | 12 → 12 | 62.9 → 61.4 | 22.2 → 21.9 | 28.2 → 27.9 | 0 → 0 |
| T-G | 14 | 46.7 → 45.1 | 11 → 10 | 65.4 → 61.8 | 10.2 → 15.4 | 11.2 → 16.4 | 2 → 4 |
| V-V | 15 | 48.6 → 48.6 | 9 → 9 | 67.9 → 66.3 | 11.2 → 11.5 | 7.7 → 8 | 0 → 1 |
| D-P | 16 | 44.6 → 45.3 | 11 → 11 | 56.7 → 60 | 14 → 17.3 | 16 → 19.3 | 3 → 2 |
| M-S | 17 | 42.8 → 42.8 | 13 → 13 | 50.5 → 49.1 | 22.3 → 26.3 | 27.3 → 31.3 | 2 → 2 |
| V-D | 18 | 49.2 → 48.6 | 11 → 10 | 67.6 → 66.2 | 13.9 → 11.6 | 11.4 → 9.1 | 0 → 0 |
| W-W | 19 | 47.2 → 47.3 | 10 → 10 | 58.7 → 57.1 | 25.5 → 29.2 | 23 → 26.7 | 3 → 4 |
| T-T | 20 | 46 → 46.2 | 14 → 13 | 66.1 → 70.8 | 29.9 → 30.6 | 33.9 → 34.6 | 0 → 0 |
| N-W | 21 | 46.6 → 46.2 | 14 → 14 | 64.5 → 63.3 | 19.7 → 23.6 | 16.2 → 20.1 | 1 → 1 |
| N-N | 22 | 49.6 → 48.6 | 9 → 10 | 76.4 → 79.5 | 16 → 13.1 | 15.5 → 12.6 | 5 → 4 |
| B-P | 23 | 51.3 → 51.8 | 8 → 8 | 71.9 → 71.8 | 26 → 27.2 | 18.5 → 19.7 | 1 → 2 |
| S-S | 24 | 48.5 → 48 | 12 → 13 | 64 → 63.5 | 27 → 27.3 | 28.5 → 28.8 | 3 → 1 |
| H-R | 25 | 51.5 → 52 | 11 → 11 | 81.7 → 80.1 | 14.4 → 11.4 | 12.9 → 9.9 | 2 → 2 |
| W-L | 26 | 50.4 → 49.4 | 10 → 10 | 71.8 → 74 | 36.3 → 36.3 | 38.8 → 38.8 | 4 → 4 |
| R-L | 27 | 53.6 → 53.9 | 9 → 9 | 72.4 → 75.3 | 12.2 → 10.2 | 7.7 → 5.7 | 6 → 7 |
| L-R | 28 | 51.7 → 51.3 | 12 → 12 | 78.4 → 78.8 | 15.8 → 17.5 | 13.8 → 15.5 | 1 → 2 |
| G-G | 29 | 50.9 → 50.6 | 13 → 13 | 82.7 → 68 | 29.1 → 28.1 | 29.1 → 28.1 | 2 → 1 |
| C-S | 30 | 52.2 → 51.9 | 10 → 10 | 71.2 → 70.6 | 33.6 → 33.8 | 35.6 → 35.8 | 3 → 4 |
| Z-H | 31 | 54.6 → 54.6 | 10 → 10 | 88.7 → 87.5 | 12.1 → 11.9 | 11.1 → 10.9 | 3 → 6 |
| M-M | 32 | 54.7 → 54.8 | 9 → 10 | 92.1 → 90.8 | 26.5 → 23.3 | 20.5 → 17.3 | 4 → 5 |


## 7. Offen und Risiken

- **Opus-Review** der geänderten Kaufreihenfolge steht laut Bauplan aus (Stufe 2).
- **Seite fehlt** (Bauplan 5–7); bis dahin ist der neue Draft nur über die Route bedienbar. Deshalb bleibt der Schalter
  aus. Das Schild „Liga wird erstellt …“ der Shell erscheint auch beim neuen Draft (`leagueSetupStatus: "in_progress"`)
  und muss mit der Seite ersetzt werden (Bauplan 8).
- **Zwei Budgets** (Transfertopf, Gehaltsbudget mit Reserve) gibt es als Dienst noch nicht (Finanzkonzept V2, Stufe
  2a). Für Menschen prüft der Draft heute: Kaufweg (Kasse, Vorstand), Pflichtplatz-Reserve. Die Seite zeigt die
  Balken, sobald der Dienst steht.
- **Andere KI-Kaufwege während des Drafts** — die frühere Annahme hier („laufen nicht, solange `leagueSetupStatus`
  in_progress ist“) war falsch: der Preseason-Lauf fragte den Status nie ab, und der Auto-Finish der Shell sowie
  „Erneut versuchen“ kauften mit `includeManualTeams` auch für Menschen. Seit Review #1619 (A1) fragen alle die zentrale
  Funktion `ligaDraftLaeuft` (s. Abschnitt 1, „Kein Kauf am Draft vorbei“). Die Shell stößt den Preseason-Lauf bei
  vorhandenem Liga-Draft erst an, wenn die Liga `ready` UND der Draft `fertig` ist, und der Auto-Finish-Effekt läuft bei
  vorhandenem Liga-Draft gar nicht; ohne Liga-Draft (Schalter aus) bleibt beides wie bisher. Im Raum sagt das Schild
  „Liga-Draft läuft“ statt „einkaufen geht bereits“, solange die geordnete Phase läuft.
- **`gefragt`** zählt nur über die angezeigten Züge (jetzt + 6), weil eine Bewertung ~0,1–0,2 s kostet; alle 32 Teams
  je Pick wären mehrere Sekunden. Gemerkt je Draft-Stand, also nur einmal je Pick gerechnet.

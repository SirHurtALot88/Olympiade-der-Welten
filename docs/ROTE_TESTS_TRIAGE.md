# Die roten Tests — Bestandsaufnahme und Triage

**Stand:** Branch `claude/bugfixing-agent-run-1azwei`, Basis `main` 8ea943bc, Version 0.4.94.
Gemessen mit `npx vitest run` (voller Lauf, JSON-Reporter), nicht geschätzt.

---

## Warum das überhaupt ein Problem war

Die CI ist grün. `npm run ci:flow-smoke` fährt 18 Dateien mit 205 Tests, und die liefen alle
durch. Die **volle** Suite war es nicht: 6.598 Tests, davon 66 rot in 33 Dateien — **keine
einzige davon im CI-Tor**.

Das ist die schlechteste aller Lagen. Eine rote Suite, die niemanden mehr alarmiert, warnt auch
dann nicht, wenn ein echter Fehler dazukommt. Man gewöhnt sich an die Farbe, und der nächste
Fehlschlag geht in der Menge unter. Genau deshalb ist „aufräumen" hier nicht Kosmetik: es geht
darum, die Zahl so klein zu bekommen, dass jeder verbleibende rote Test eine **benannte,
begründete Entscheidung** ist, die auf Chris wartet — und nicht Rauschen.

---

## Die Zahlen

| | Dateien | Tests |
|---|---:|---:|
| Voller Lauf **vorher** | 33 rot | 66 rot (von 6.598) |
| davon **Sponsorseite** (fremder Agent, nicht angefasst) | 10 | 25 |
| davon **hier bearbeitet** | 23 | 41 |
| **Nachher** grün gemacht | 19 Dateien | 33 Tests |
| **Nachher** bewusst rot gelassen | 4 Dateien | 8 Tests |

Nachgemessener Volllauf danach: **33 rot in 14 Dateien** von 6.632 Tests — davon **24 auf der
Sponsorseite** (nicht angefasst, s. u.) und **8 bewusst offen**. Ausserhalb der Sponsorseite ist
die Suite damit von 41 roten Tests auf 8 heruntergekommen, und jeder der acht ist unten benannt.

CI-Tor unverändert grün (18/205), `npx tsc --noEmit` auf `app/`, `lib/`, `components/` leer.

### Verteilung über die Triage-Kategorien

| Kategorie | Tests | Anteil |
|---|---:|---|
| **A — echter Fehler im Produktcode** | 0 gefunden, 8 **ungeklärt** (bewusst rot) | s. u. |
| **B — veraltete Zusage** (Verhalten bewusst geändert, Test nicht nachgezogen) | 21 | der Hauptanteil |
| **C — Zeichenketten-Test ohne Aussage** | 12 | ersetzt oder gelöscht |
| **D — flaky / Umgebung** | 0 im gemessenen Lauf | s. „Der Timeout-Verdacht" |

**Kein einziger Test wurde grün gemacht, indem die Erwartung ans kaputte Verhalten angepasst
wurde.** Wo die Entscheidung nicht eindeutig war, blieb der Test rot — das sind die acht unten.

---

## Ein Muster, das dreimal auftrat: der Ledger schluckt Spieltage ohne Disziplin-Ergebnis

Sechs rote Tests in vier Dateien hatten **dieselbe** Ursache, und sie ist es wert, benannt zu
werden, weil sie beim nächsten Test wieder zuschlägt.

`buildSeasonPointsLedger` überspringt seit dem PP-Befund jeden Spieltag, zu dem **keine**
`disciplineResults` vorliegen. Die Begründung im Quelltext ist gut und bleibt gültig: der
beschnittene Browser-Payload trug die Leistungszeilen mit, ihre Disziplin-Ergebnisse aber nicht —
die Punkte fielen auf den Rohbeitrag zurück und zeigten 33,3 PP, wo der volle Spielstand 4,9
sagt. „Ein sichtbar leeres Feld ist reparierbar, eine falsche Zahl wird geglaubt."

Die Folge für die Tests: jede Vorlage, die nur `matchdayResults` + `playerDisciplinePerformances`
setzt (und das taten alle, sie waren älter als die Regel), verliert **still** ihre ganze Wertung.
MVS kommt als `null` zurück, PP-Ränge fehlen, und der Test scheitert an einer Stelle, die mit
seinem Thema nichts zu tun hat. Betroffen waren:

- `frozen-valuation-snapshot` (2 Tests)
- `player-detail-drawer` (2 von 3 Tests)
- `ai-transfermarkt-sell-preview` (2 Tests)

Behoben durch passende `disciplineResults` in den Vorlagen — je Leistungszeile eines mit
derselben Kombination aus Spieltag, Team, Disziplin und Seite. Auf einem echten Spielstand ist
das ohnehin der Normalfall; die Vorlagen bildeten einen Zustand nach, den es im Spiel nicht gibt.

**Merkposten:** wer künftig eine Vorlage mit gewerteten Spieltagen baut, braucht beide Listen.
Eine Vorlage nur mit `matchdayResults` ist seit dieser Regel eine Vorlage ohne Punkte.

---

## Was behoben wurde — Datei für Datei

### Paket 1 — Oberflächen-Zusagen und Zeichenketten (9 Dateien, 12 Tests)

| Datei | Kat. | Was war los |
|---|---|---|
| `season-standings-v2-ui-contract` | C | Suchte `SEASON_V2_DEFAULT_MODE … "table"` im Quelltext. Die Modi heißen seit dem Neuen Look `"board" \| "daten" \| "vereine"`, die **Datenansicht öffnet unverändert als erste**. Jetzt über exportierte Werte geprüft (`NL_STANDINGS_DEFAULT_MODE`, `NL_STANDINGS_MODE_ITEMS`) — dieselbe Mechanik wie beim vorhandenen `MATCHDAY_PANEL_DEFAULT_SORT`. Ein zweiter Test („form curve, mobile cards, prize preview, pinned team") wurde **gelöscht**: die sechs Marken gehörten zum alten Look, der mit 32683df8 ausgebaut wurde, als er längst unerreichbar war. |
| `matchday-panel-form-column` | C | Suchte die Zeilenhöhen-Rechnung als Zeichenkette. Die Rechnung liegt seit dem Ladder-Umbau in `lib/matchday-arena/arena-ladder-metrics.ts` und wird dort über **Werte** geprüft (`arena-tabelle-auf-einer-linie`). Hier bleibt nur, was hier gilt: die Komponente rechnet nicht selbst und misst den Kopfblock. |
| `foundation-scouting-ui-contract` | B | Verlangte ein Karten-Raster (`density="compact"`) im Einsatzlisten-Pool. Der Pool zeigt heute einen 22px-Avatar mit Initialen-Rückfall plus Hover-Vorschau — und die Vorschau rendert **dieselbe geteilte Portraitkarte**. Zusage auf das Verhalten umgeschrieben: Gesicht im Pool, Rückfall vorhanden, keine zweite Kartenbauart. |
| `scouting-display-contract` | B | Verlangte `FoundationSubNav` **im** Scouting-Panel. Die Unternavigation liegt seit dem Neuen Look einmal in der Shell; **drei andere Tests fordern genau diese Abwesenheit bereits ein**. Zusage umgedreht, mit Verweis auf die drei. |
| `preseason-workflow-ui-contract` | C | Zwei wertlose Prüfungen entfernt: eine Überschrift („Season-End Review" → heißt „Season Review") und eine auf einen **Kommentar** im Quelltext. Dafür eine neue Wertprüfung: der Assistent beginnt mit dem Rückblick, und der Rückblick ist `preview_only` — er darf nichts buchen. |
| `legacy-lineup-lab` (1) | B | `buildLegacyLineupLabPlayerOptions` liefert seit dem Fatigue-Umbau (#510) ein Feld mehr: `injuryRiskProjection` (Risiko **nach** dem geplanten Einsatz). Ergänzt — plus ein neuer Test, der das Feld nicht nur zählt, sondern durchreicht. |
| `legacy-lineup-lab` (2) | C | Die größte Zeichenketten-Halde der Suite: ~180 `toContain` auf Markup, davon 55 falsch, alle unter **einem** Testnamen („ai preview adoption …"). Ersetzt durch den Kern, den der Name verspricht und der weiterhin lebt: der Übernahme-Pfad schreibt in den lokalen Entwurf und ruft dabei **keine** Speicher-Route. Der Rest war Inventarliste einer Oberfläche von 2026-06. (→ offene Frage 4) |
| `gebaeude-t7-feinschliff` | B | Forderte `--nl-accent-text` für den Arena-Beliebtheits-Hinweis. Mit G5 wurde er bewusst auf den ruhigen Sekundärton umgestellt („In Teamfarbe las sich die Rechnung wie eine Fehler-/Debug-Zeile"). Der **Befund** dahinter war nie „muss accent-text sein", sondern „rohes `--nl-accent` trägt als Text nicht" (3,72:1 bei S-C) — genau das wird jetzt geprüft. |
| `spielerliste-kennzahlen-kontrast` | C | Suchte die Farbmischung wörtlich in der Regel. Sie ist als Token `--nl-bronze-text` vereinheitlicht. Die Prüfung folgt jetzt der Verweiskette — Kopfzeile → Token → Mischung — und ist damit **schärfer** als vorher: wer das Token auf rohes Bronze zurückdreht, fällt auf. |
| `foundation-performance-architecture` | B | Die `useState`-Ratsche stand auf 237, der Stand ist 239. Der Diff von #501 an der Datei besteht aus genau zwei `useState`-Zeilen (`sponsorUebernahmeBusy`/`-Message`). Ratsche bewusst auf 239 gehoben, mit demselben Vorbehalt wie beim letzten Mal: diese Zustände gehören näher an die Sponsorenseite als in die Wurzel. |

### Paket 2 — Dienste, Routen, Kalibrierung (12 Dateien, 21 Tests)

| Datei | Kat. | Was war los |
|---|---|---|
| `ai-legacy-lineup-api` (3) | B + C | Zwei Ursachen. **(a) Mock-Drift:** die Vorlage lieferte einen Kontext ohne `contextMeta`; seit die Vollständigkeits-Prüfung die Disziplin-Ids daraus liest, warf die Route und antwortete **500**. **(b) Geänderte Zusage:** `passive` und „KI mit abgeschaltetem Apply" werden **nicht mehr immer** übersprungen — ein Team ohne Aufstellung bekommt eine, sonst träte es leer an. Nur `manual` sperrt bedingungslos. Der Test prüft jetzt beides und fährt zusätzlich einen zweiten Durchgang **mit** `overwriteExisting` — nur dort zeigt sich, ob die Team-Einstellung selbst noch schützt. **Gegenprobe:** `isAiLineupBatchApplyEnabled` auf `true` verdrahtet → rot. |
| `legacy-lineup-save-resolution-errors` (2) | B + C | Der **Abgabe-Riegel** (`confirmLock`) kam dazwischen: die Route speichert erst nach ausdrücklicher Bestätigung, vorher antwortet sie 409. Der Test kannte ihn nicht und kam nie bis zur geprüften Stelle. Riegel wird jetzt **mitgeprüft** statt umgangen. Dazu ein fehlender Mock-Export (`buildAiLegacyLineupPreviewWithModifiers`). **Gegenprobe:** Riegel entschärft → rot. |
| `bug-report-tickets` | B | `findTriageGaps` kennt seit `docs/BUGFIXING_AGENT.md` eine vierte Lücke: die fehlende `changelog:`-Zeile. Ergänzt — plus die Gegenrichtung (nur der Changelog fehlt → genau eine Lücke), sonst könnte die Prüfung spurlos herausfallen. |
| `room-flow-controller` | B | Erwartete „Warten auf Chris" für Chris selbst — **das war der behobene Deadlock**. Host mit eigenen Teams fiel durch den Bereit-Zweig und bekam einen unklickbaren Knopf, während der Gast „Warten auf Host" sah. Der Test prüft jetzt die neue Zusage: wer eigene Teams hat, meldet sich selbst bereit, und der Knopf ist **klickbar**. |
| `verletzungsrisiko-einsatzliste` (3) | B | Nagelte die Kalibrierung „Last 10" fest. Chris hat die Last auf 16 gestellt und dafür die Erholung von 20 auf 28 gezogen (#510). Alle drei Prüfungen rechnen jetzt aus `MATCHDAY_FATIGUE_LOAD` und der Schutzzonen-Grenze — Vorbild ist `fatigue-last-drei-stufen.test.ts` („hält NICHT die Zahl fest, sondern was strukturell ist"). **Gegenprobe:** `OLY_FATIGUE_MATCHDAY_LOAD=20` → rot, weil 20 × 1,4 = 28 die Schutzzone von 25 sprengt. Bei 16 (× 1,4 = 22,4) hält sie. |
| `frozen-valuation-snapshot` (2) | C | Ledger-Muster (s. o.). |
| `player-detail-drawer` (3) | C | Ledger-Muster (s. o.), alle drei. |
| `ai-transfermarkt-sell-preview` (2) | C | Ledger-Muster (s. o.). Die Datei hatte den *ersten* Teil derselben Abhängigkeit schon dokumentiert (`matchdayResults`) — die zweite Hälfte kam mit der neuen Regel dazu. |
| `chunked-redraft-topup-service` (1 von 2) | B | `full_clean_redraft` verlangt einen komplett leeren Kader. Ein frisch angelegter Spielstand hat seit dem P-S-Befund genau **einen** Eintrag: Nula. Die Vorlage leert jetzt ausdrücklich nach. (→ offene Frage 2) |
| `season-one-long-run-market-buy` | B | Erwartete nach einem Kauf `marketBuyCount === 1`. Der Maskottchen-Kauf (`nula_mascot_rule_buy`) steht **nicht** in `SEASON_ONE_DRAFT_BUY_SOURCES` und zählt damit als Marktkauf — der frische Stand startet bei 1. Gemessen wird jetzt der **Zuwachs**; das ist die Aussage, um die es geht. (→ offene Frage 3) |
| `cash-prize-apply-service` | B | Hielt die **alte** Duplikat-Regel fest („Audit-Log da → gesperrt"). Die wurde bewusst entschärft, und dahinter steckt echter Schaden: solange der Schritt nur Tabellenspalten und das Log schrieb, stand er als „erledigt" da, ohne einen Cent zu bewegen — so entstand ein Spielstand mit 32 unveränderten Kassen, und der Riegel sperrte den Knopf danach **dauerhaft**. Heute sperrt er nur, wenn das Sponsorgeld wirklich ausgezahlt ist. Der Test prüft jetzt **beide** Hälften; nur die zweite allein bliebe grün, wenn jemand die alte Regel zurückdreht. **Gegenprobe:** Regel auf „Log genügt" zurück → rot. |
| `singleplayer-state` (1 von 6) | B | „infers season_completed für Altstände" scheiterte am **Sitzungs-Zwischenspeicher**, nicht an der Ableitung. `getSaveById` geht über `materializePersistedSaveCached`, dessen Schlüssel `updated_at` + `content_signature` der `saves`-Zeile ist. Das rohe `DELETE FROM game_metadata` des Tests rührt die nicht an → Treffer im Zwischenspeicher, die Ableitung läuft nie. **Nachgemessen:** derselbe Aufruf liefert mit Zwischenspeicher `undefined`, unmittelbar danach ohne ihn `season_completed`. Der Test invalidiert jetzt — im Spiel tritt der Fall nicht auf (jeder reguläre Schreibweg zieht die Signatur nach, ein zurückgespielter Spielstand kommt im frischen Prozess hoch). |

---

## Was bewusst rot bleibt — 8 Tests, jeder mit Grund

Diese acht sind **keine** Testpflege, sondern Entscheidungen. Sie stehen unten nochmal als
Fragen an Chris.

### 1. `player-stats-adapter` — „MVS 0" fällt auf `null` zurück (1 Test)

`lib/foundation/player-rating-contract.ts:381-386` unterscheidet außen sauber zwischen
„keine Saisonquelle" (`mvsPerformances == null`) und „Quelle da, aber leer" (leeres Array). Die
innere Bedingung `rawMvs != null && rawMvs > 0` macht diese Unterscheidung dann wieder kaputt: ein
Spieler mit ehrlich **null Platzierungen** bekommt `mvs: null`, `sourceStatus.mvs:
"missing_source"` und die Warnung `mvs_source_missing` — obwohl die Quelle existiert und die
Antwort schlicht „0" lautet.

**Warum ich es nicht repariert habe:** die Einzeiler-Reparatur (`rawMvs != null` statt `> 0`)
reicht weiter als der Befund. Mehrere KI-Stellen lesen `item.mvs ?? item.ovr ?? 0`
(`lib/ai/market-pick-engine/execute-live-pick.ts:277,282,403`). Heute fällt der `null`-Wert dort
auf **OVR** zurück; nach der Reparatur stünde eine echte **0** da. Zu Saisonbeginn hat *jeder*
Spieler MVS 0 — die Kaufbewertung der KI würde in der gesamten Vorsaison von OVR-gestützt auf
0 kippen. Das ist eine Balance-Änderung im Kaufverhalten, keine Fehlerbehebung.

### 2. `chunked-redraft-topup-service` — Qualitäts-Term im Survival-Fallback (1 Test)

Der Test war schon vorher als „BLEIBT ROT" markiert, mit derselben Begründung, die ich
bestätige: der Entwurf sagt, die Draft-Attraktivität soll **nicht** an OVR/MVS/Marktwert hängen;
im `minimum_survival_budget_fallback` steht `candidate.quality *` weiterhin drin. Die Reparatur
ist eine Balance-Änderung. Unverändert gelassen.

### 3. `player-economy-compare-service` — „legacy" ist nicht mehr legacy (1 Test)

Der Vergleichs-Bericht deklariert selbst `benchmarkSource: "legacy_imported_display"`: er soll den
**importierten** Wert neben eine frische Neuberechnung stellen. Bei `legacySalary` tut er das
nicht mehr. Die Kette in `resolvePlayerEconomyContract` lautet
`rosterSalary ?? salaryBreakdown?.finalSalary ?? storedCalculatedSalary ?? legacyDisplaySalary` —
sobald ein Spieler vollständige Attributdaten hat, gewinnt `salaryBreakdown.finalSalary`, also
eine **eigene Formelrechnung**. Genau für die Spieler, die vollständig genug für einen
`calculatedSalary` sind, vergleicht der Bericht damit Formel gegen Formel.

Beim Marktwert fällt das nicht auf: dessen „berechneter" Pfad leitet über
`deriveBaseMarketValueFromFinal` **aus** dem Anzeigewert ab und landet wieder in dessen Nähe. Beim
Gehalt gibt es diesen Rückweg nicht.

**Der Dienst hätte das Signal:** `resolvePlayerEconomyContract` liefert `salarySource` mit, und der
steht in genau diesem Fall auf `"calculated_preview"` statt auf `"imported_display"`. Es wird nur
nicht gelesen.

**Warum ich es nicht repariert habe:** was „legacy" in diesem Bericht heißen soll, ist eine
Produktfrage. Zieht man `legacySalary` hart auf `legacyDisplaySalary`, ändert sich jede Zahl in
der Vergleichsansicht und in den Ausreißer-Listen. Das ist eine Entscheidung, kein Bugfix.

### 4. `singleplayer-state` — GM-Zuweisung und alles, was daran hängt (5 Tests)

Fünf Tests scheitern an **einer** Ursache: Armageddon Aftermath (A-A) bekommt in Saison 1 heute
`gm-star-chaser-02`, der Test erwartet `gm-risk-gambler-07`. Daran hängen die GM-angepassten
Achsen (pow 1,84 statt 1,5, soc 0,23 statt 0,9), die Achsen-Prozente (pow 9/soc 1 statt 8/5), die
Strategie-Vorspannungen (M-M `starPriority` 10 statt 9, Z-H `cashPriority` 3 statt 2) und ein
Kaderziel (9 statt 9,3).

**Was ich gemessen habe:**
- Die Zuweisung ist **deterministisch** und reproduzierbar. Der Streusalz-Wert fällt bei
  `createFreshSeasonOneGameState()` auf `season.id` zurück, es gibt keinen Zufall pro Lauf.
- Die Zuweisung entsteht **nicht** aus dem einfachen Hash-Griff (`chooseProfileForTeam` ist nur
  der Rückfall), sondern aus einer Passungs-Bewertung über die **Team-Identität**, mit
  Vielfalts-Malus und Wildcard-Wurf.
- Weder `lib/foundation/team-general-managers.ts` noch `data/source/team-identities.json` haben
  seit 79cd22bd einen Commit. Die Verschiebung stammt also aus einem Eingang der Bewertung, den
  ich in der Historie nicht mehr auflösen kann.

**Warum ich es nicht angepasst habe:** die Erwartungen sind eine Momentaufnahme einer früheren
Kalibrierung. Sie einfach auf den Ist-Stand zu ziehen, würde aus fünf Tests fünf Tautologien
machen und die eigentliche Frage zudecken — *soll* die Liga heute andere Manager haben als
gestern? Das ist Chris' Entscheidung, nicht meine.

---

## Der Timeout-Verdacht: aufgelöst, aber nicht vergessen

`matchday-auto-run-service.test.ts` galt als der Fall „rot nur im Sammellauf, einzeln grün". **Im
gemessenen Lauf war er weder noch: 9/9 grün, im vollen Lauf wie einzeln.** Die schwersten Tests
darin tragen bereits eigene Grenzen von 40 s bis 240 s, und die Suite steht global auf 20 s statt
der vitest-Vorgabe von 5 s — mit ausführlicher Begründung in `vitest.config.ts`.

Ich habe deshalb **nichts** an Timeouts geändert. Die Datei bleibt aber der wahrscheinlichste
Kandidat, wenn die Suite auf einer langsameren Maschine kippt: sie baut mehrfach einen
vollständigen 32-Team-Spielstand auf. Wer sie wieder rot sieht, prüft zuerst die Meldung — heißt
sie „Test timed out", ist es die Maschine, nicht das Spiel.

Zur Sicherheit gegengeprüft: **alle 33 roten Dateien waren einzeln genauso rot wie im
Sammellauf.** Es gab in diesem Lauf keinen einzigen reihenfolgeabhängigen Fehlschlag — die
Isolierung pro Testdatei (`tests/setup/sqlite-pro-testdatei.ts`) tut, was sie soll.

---

## Nicht angefasst: die Sponsorseite (10 Dateien, 25 Tests)

Ein zweiter Agent arbeitet parallel an `app/foundation/sponsors-v2/` und
`components/foundation/sponsor/`. Diese Dateien blieben deshalb unberührt. Zur Vollständigkeit,
damit sie nicht zweimal untersucht werden — die Fehlerbilder sprechen alle **eine** Sprache: die
Gebäude-Leihe ist mit #512 abgeschaltet (`SPONSOR_GEBAEUDE_LEIHE_AKTIV = false`), es gibt drei
statt fünf Angebote, und die Vorschüsse sind ersatzlos entfernt.

| Datei | rot | Bild |
|---|---:|---|
| `sponsor-angebot-mit-leihe` | 7 | keine Gebäude-Karten mehr im Slate → `leihVerzicht` ist `null`, „genau eine Karte ohne Verzicht" findet drei |
| `sponsor-gebaeudekarte-anzeige-gleich-settlement` | 3 | dieselbe Ursache, `offerId` von `undefined` |
| `sponsor-ki-bewertet-gebaeude` | 3 | KI kann keine Gebäude mehr wählen → 32 von 32 wählen Cash |
| `sponsor-ki-laufzeit-sockel` | 3 | `96 > 100` — Leiter-Anker verschoben |
| `sponsor-leih-passung` | 1 | „die Liga bietet überhaupt Informationsgebäude an" → 0 |
| `sponsor-new-game-flow` | 3 | V3-Struktur/Achse — `axis` ist wieder da, wo der Test `undefined` erwartet |
| `sponsor-v4-achsen` | 1 | dito |
| `sponsor-v4-ki-wahl` | 2 | 32 von 32 greifen zur Cash-Karte |
| `sponsorkarte-laufzeit-und-raenge` | 1 | `96 > 100` |
| `sponsorkarte-ueberlebt-speichern-und-laden` | 1 | „ohne Gebäude-Karten misst dieser Test den teuersten Fall nicht" |

Das ist **Kategorie B in Reinform** — der Schalter ist eine bewusste Entscheidung, die Tests sind
noch auf dem Stand davor. Wer sie nachzieht, sollte sie am Schalter aufhängen
(`SPONSOR_GEBAEUDE_LEIHE_AKTIV`), nicht am Ist-Zustand: die Leihe ist abgeschaltet, nicht
ausgebaut, und `buildSponsorLeihSlate` nimmt weiterhin ein `aktiv`-Argument. Ein Test, der beide
Stellungen prüft, überlebt das Wiedereinschalten.

---

## Offene Fragen an Chris

**1. MVS 0 oder „keine Quelle"?** (→ oben, Punkt 1)
Ein Spieler ohne Platzierungen zeigt heute „MVS-Quelle fehlt" statt „MVS 0". Die Reparatur ist
eine Zeile, hat aber eine Nebenwirkung: die KI liest an drei Stellen `mvs ?? ovr ?? 0` und fällt
heute auf OVR zurück. Mit echter 0 bewertet sie die gesamte Vorsaison anders.
**Entscheidung:** Anzeige korrigieren und die KI-Rückfälle mit umstellen — oder so lassen und den
Test streichen?

**2. `full_clean_redraft` kann auf einem frischen Spielstand nicht mehr laufen.**
Zwei bewusste Regeln stoßen zusammen: P-S kauft Nula **beim Anlegen** (dein „das ist ok so!"),
und `runChunkedRedraftTopup` verlangt für `full_clean_redraft` einen **leeren** Kader. Ergebnis:
`full_clean_redraft_requires_empty_rosters:1`. Im Spiel harmlos — der Modus wird nirgends
gefahren (Produktion nutzt `preseason_roster_repair` und `season1_initial_topup`, die
Feature-Matrix führt ihn ausdrücklich als „not executed by design"). Betroffen ist nur
`scripts/long-run-sandbox-s1-s6.ts`.
**Entscheidung:** Nula vom Riegel ausnehmen, oder den Modus als Sandbox-Werkzeug so lassen?

**3. Zählt der Maskottchen-Kauf als Marktkauf?** — ENTSCHIEDEN
`nula_mascot_rule_buy` steht nicht in `SEASON_ONE_DRAFT_BUY_SOURCES` und erscheint deshalb in
jeder Marktkauf-Statistik der Saison 1. Als **Sperre** wird die Zahl nirgends ausgewertet, nur in
Audits und Berichten (`generate-balancing-report`, `long-run-phase-audit`, Transfer-Audit).

**Chris' Entscheidung:** „masskottchen kauf ist ein ganz normaler spielerkauf".

Damit bleibt es, wie es ist — der Kauf zählt als Marktkauf, weil er einer ist. **Kein
Codeeingriff.** Das ist die Antwort, die am wenigsten Arbeit macht und trotzdem festgehalten
gehört: ohne sie wäre die Zeile beim nächsten Audit erneut als Ungereimtheit aufgeschlagen und
jemand hätte sie „aufgeräumt".

Der zugehörige Test (`season-one-long-run-market-buy`) misst seit der Triage den **Zuwachs**
statt der absoluten Zahl. Das bleibt richtig: ein frischer Spielstand startet bei 1, weil dieser
eine echte Kauf schon stattgefunden hat.

**4. Die KI-Vorschau in der Einsatzliste ist unerreichbar.** — ENTSCHIEDEN und ERLEDIGT

**Chris' Entscheidung:** „ki vorschau -> bedienung zurück".

Der tote Cluster wurde also NICHT entfernt, sondern wieder erreichbar gemacht. Die Grenze dabei:
nur der MENSCH arbeitet damit — der automatische Weg für KI-Teams läuft über
`matchday-auto-run-service` und bleibt unberührt.

**Umgesetzt** in `app/foundation/legacy-lineup-lab/LineupAiPreviewPanel.tsx`: beide Wege
(Einzelteam und Stapel über alle KI-Teams), Probelauf bleibt Pflicht vor dem Speichern, rohe
Status-Bezeichner werden übersetzt. Drei Verdrahtungstests halten den Zustand fest
(`tests/lineup-ki-vorschau-bedienung.test.ts`) — nimmt man das Panel heraus, fallen sie rot.

**Dabei aufgefallen und mitbehoben:** die Stapel-Schaltflächen hingen an `isReadOnly`, worin
`isTeamManagementLocked` steckt. Damit waren sie ausgerechnet dann gesperrt, wenn ein KI-Team im
Feld stand — im einzig sinnvollen Fall. Der Server kennt an dieser Route gar keine Teamprüfung,
nur den Referenzmodus; die Anzeige spiegelt jetzt dieselbe Regel (`canRunAiBatchApply`).

**8. Kader-Minimum gegen Spieltagsbedarf.** — ENTSCHIEDEN: bleibt so

Gemessen: `FIXED_ROSTER_MIN` ist 8, ein Spieltag verlangt die SUMME beider Disziplinen und damit
bis zu **11** verschiedene Spieler. In der gemessenen Saison lagen 2 von 10 Spieltagen über dem
Minimum; gegen die Kadergrößen von heute gerechnet bleiben 42 Plätze auf 320 Team-Spieltage leer.

**Chris' Entscheidung:** „darf durchlaufen und gehört zu balance dazu, teams steht ja offen auch
13 oder 14 schwächere spieler zu kaufen für rotation und erfüllung falls mal 11 oder 12 spieler
benötigt werden!"

Damit ist die Lücke **gewollt**: sie ist der Preis eines dünnen Kaders, kein Fehler im Spielablauf.
**Kein Codeeingriff.** Das gehört festgehalten, weil die Zahl bei der nächsten Messung sonst
erneut als Ungereimtheit aufschlägt und jemand das Minimum „korrigiert".

Die Voraussetzung dafür ist erfüllt und mitgemessen: nach dem Saisonwechsel liegen die Kader bei
min 8 / median 10 / max 14 — Rotation ist also kaufbar, nicht bloß theoretisch.

**5. Sollen die Manager der Liga andere sein als früher?** (→ oben, Punkt 4)
Fünf Tests hängen an einer einzigen verschobenen GM-Zuweisung. Die Zuweisung ist deterministisch
und plausibel, nur eben anders als beim Schreiben der Tests. Ich kann in der Historie nicht mehr
auflösen, welcher Eingang sich geändert hat.
**Entscheidung:** ist die heutige Zuweisung die gewollte (dann ziehe ich die fünf Erwartungen
nach — besser: baue sie auf Eigenschaften statt auf konkrete GM-Ids um), oder ist da etwas
verrutscht?

**6. Was heißt „legacy" im Wirtschafts-Vergleich?** (→ oben, Punkt 3)
Der Bericht stellt „importiert" gegen „neu gerechnet" — beim Gehalt steht auf beiden Seiten
inzwischen eine Formel, sobald der Spieler vollständige Attribute hat. Das Signal dafür
(`salarySource === "calculated_preview"`) liegt vor und wird nicht gelesen.
**Entscheidung:** `legacySalary` hart auf den importierten Anzeigewert ziehen (dann verschieben
sich alle Zahlen und Ausreißer-Listen der Vergleichsansicht) — oder den Anspruch fallen lassen
und den Test streichen?

**7. Zwei Reste toter Gestaltung.** — ERLEDIGT

Vor dem Entfernen nachgemessen statt vermutet: `.season-v2-form-curve`,
`.season-v2-mobile-card-grid`, `.season-v2-prize-preview`, `.legacy-matchday-player-card`,
`.legacy-matchday-player-portrait`, `.is-active-slot-chip` und `.legacy-lineup-player-panel`
haben **null** Fundstellen in `app/**`, `lib/**` und `components/**` — auch keine zusammengesetzte
(`className={\`…-\${x}\`}`). Damit sind sie nicht „vermutlich tot", sondern unerreichbar.

Entfernt wurden 39 vollständig tote Regeln, 10 gemischte Gruppen haben nur ihren toten Selektor
verloren, ein dadurch leer gewordener `@media`-Rahmen fiel mit weg — 238 Zeilen weniger.

Gemacht mit `postcss`, nicht mit Textersatz: der erste Versuch per Regex hat die schließende
Klammer eines `@media`-Blocks mitgenommen (Klammernbilanz 11983/11982) und lebende Regeln auf
Nachbarzeilen geklebt. Ein Parser kennt die Verschachtelung, eine Zeichenkettensuche nicht.

---

## Wie man diesen Stand nachprüft

```sh
npx vitest run
npx tsc --noEmit 2>&1 | grep -E "^(app|lib|components)/"
npm run ci:flow-smoke
```

Einzelne Datei, wenn etwas rot ist — und **zuerst einzeln**, bevor man auf Reihenfolge tippt:

```sh
npx vitest run tests/<datei>.test.ts
```

Für die Fatigue-Zusagen lohnt die Gegenprobe mit einer anderen Kalibrierung, ohne Code zu ändern:

```sh
OLY_FATIGUE_MATCHDAY_LOAD=20 npx vitest run tests/verletzungsrisiko-einsatzliste.test.ts
```

Sie muss rot werden — 20 × 1,4 = 28 sprengt die Schutzzone von 25. Bleibt sie grün, prüft die
Datei nicht mehr, was sie behauptet.

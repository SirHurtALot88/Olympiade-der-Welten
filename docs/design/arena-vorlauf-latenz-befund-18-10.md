# Arena-Vorlauf-Latenz: Root-Cause und Fix (18.10.)

## Auftrag

Chris, 18.10., zu PR #1273 (Plan `battle-arena-auto-run-anbindung-plan-16-10.md`), wörtlich:
„woher kommt die lange wartezeit? das darf nicht passieren, die battle arena mit disziplin muss
direkt starten und die berechnung kann ja im hintergrund schon stattfinden sobald man den button
drückt. dachte es wird live berechnet quasi, bisher hat es ja auch nie lang gedauert bis es
losging, wo ist das problem? [...] das ist top prio das zu fixen."

Der Plan hatte für einen Spieltag mit zwei Battle-Disziplinen 20–70 s **Hochrechnung** (CX23-
Faktor 1,5–2 auf eine lokale Messung, Abschnitt 2.6) genannt — noch keine echte Produktions-
messung. Dieser Befund ersetzt die Hochrechnung durch eine **echte, instrumentierte Chromium-
Messung** und fixt die zwei echten Probleme, die dabei sichtbar wurden.

## Root-Cause, instrumentiert mit echtem Chromium

`scripts/messe-arena-spieltag.ts` misst nur die Gesamtzeit. Für diesen Befund wurde
`arena-headless-runner.ts` temporär mit Zeitstempeln vor/nach `chromium.launch()`, `page.goto()`,
`page.evaluate()` und — innerhalb des Browser-Kontexts — vor/nach jedem einzelnen
`haengeMotorNeuEin()`+`spiele...()`-Fixture-Durchlauf versehen (nicht eingecheckt, nur für diese
Messung). Umgebung: Sandbox-Container, 4 Kerne, Chromium 1194 (derselbe Pfad/dieselben
Launch-Argumente wie Produktion), frischer 32-Team-Battle-Save, Spieltag 1, Disziplin
"gewichtheben" (2 Liga-Stufen, 8 Fixtures je Stufe).

Gemessen (eine Liga-Stufe, 8 Fixtures):

| Phase | ms | Anteil |
|---|---:|---:|
| `bereiteFixturesVor()` (Server, vor dem Browser) | 20–25 | <1% |
| `chromium.launch()` | 137–468 | 2–7% |
| `page.goto(battle-mode.html)` | 547–949 | 9–15% |
| **Neu-Einhängen des Motors je Fixture** (`haengeMotorNeuEin()`, 7×, Fixture 1–7) | **520–906 je Fixture, 4,9–5,8 s Summe** | **78–87%** |
| Eigentliche Simulation je Fixture (`spiele...()`) | 17–166 | 1–3% |

**Browser-Start und Seitenaufbau sind NICHT das Problem** — beide zusammen machen unter 25% der
Zeit aus, und der Browser-Start ist nach dem ersten Aufruf im selben Node-Prozess ohnehin billig
(OS-Seitencache warm: 468ms → 137–190ms ab dem zweiten Start, separat mit nacktem
`chromium.launch()` nachgemessen). **Die eigentliche Simulation ist ebenfalls nicht das Problem**
— 17 bis 166 ms je Fixture.

**Der Löwenanteil (78–95% je nach Lauf) ist das Neu-Einhängen des 7,7-MB-Motors
(`public/mockups/battle-mode.engine.js`) ZWISCHEN JEDEM Fixture.** `simuliereFixturesImBrowser()`
(`arena-headless-runner.ts`) reisst `window.__arena` vor jedem Fixture ab und hängt ein frisches
`<script src="battle-mode.engine.js">` ein — eine volle 7,7-MB-Datei wird damit bis zu 8× je
Liga-Stufe neu geparst und ausgeführt, für 16 Fixtures je Disziplin (2 Stufen) also bis zu 16×,
für einen Spieltag mit zwei Battle-Disziplinen bis zu 32×.

### Warum nicht einfach das Neu-Einhängen abschaffen

Geprüft und bewusst NICHT gemacht: der Motor hält laut einem bestehenden, expliziten
Architektur-Kommentar zu viel mutablen Zustand für ein In-place-Update.
`app/foundation/battle-arena/FoundationBattleArenaHost.tsx:450`, wörtlich: „der Motor haelt zu
viel mutablen Zustand fuer ein In-place-Update" — und der Motor selbst hat mehrere Dutzend
modul-globale Caches (`kuerListeCache`, `battlePortraitCache`, `routeCache`, `EFFEKTE`,
`letzteAusschaltungen`, …), deren Invalidierungs-Garantien NICHT für wiederholte Aufrufe
innerhalb eines Batches geprüft/dokumentiert sind. Ein Entfernen des Neu-Einhängens wäre ein
Griff in die Laufzeit-Semantik von 20 Disziplinen über 4 Chassis hinweg, ohne das in diesem
Rahmen vollständig zu auditieren — genau die Art Risiko, die die rho-/Pp-Abnahmen dieses
Projekts (CLAUDE.md) verbieten sollen. Dieser Fix lässt das Neu-Einhängen deshalb unangetastet.

## Zweiter Befund: der Vorlauf-Anstoß ist schon so früh wie architektonisch möglich

Geprüft (Auftrag Schritt 1, dritter Punkt): **nein**, der Vorlauf kann nicht sinnvoll früher
starten als heute. Der Ablauf, nachgelesen in `matchday-resolve-snapshot.ts` und
`matchday-progress-service.ts`:

1. Sobald der Spieler nach einem Spieltagswechsel wieder im Saisonstand steht, feuert das Cockpit
   `POST /api/lineups/legacy/ai-batch-prewarm` (fire-and-forget, im Hintergrund) — das füllt ALLE
   KI-Aufstellungen für den kommenden Spieltag, BEVOR der Spieler die Lineup-Seite überhaupt
   öffnet.
2. `ensureMatchdayResolveSnapshot()`/`kickoffArenaVorlauf()` setzen voraus, dass das GESAMTE Feld
   steht (`isMatchdayFieldComplete()`: jedes Team, beide Seiten D1 UND D2) — das ist eine
   Spieltags-weite Berechnung, kein Split pro Disziplin.
3. In der Praxis ist die EIGENE Aufstellung des Spielers die letzte fehlende Zutat (KI-Teams
   stehen dank Schritt 1 i. d. R. schon). Der Vorlauf startet deshalb GENAU in dem Moment, in dem
   das Feld komplett wird — beim Speichern der eigenen Aufstellung
   (`app/api/lineups/legacy/route.ts`, `.../batch/route.ts`).

Früher geht es nicht, ohne spekulativ auf einem noch nicht final abgegebenen Entwurf zu rechnen
(Verwurf-Risiko bei jeder Änderung). Der Trigger-Zeitpunkt ist deshalb **nicht** Teil dieses
Fixes — er war schon optimal.

## Dritter Befund: die Bühne hatte gar keine Nachlade-Logik

`app/foundation/discipline-stage/DisciplineStageArena.tsx` las das von PR 3 eingeführte
`arenaVorlauf`-Feld aus `/api/matchday/arena-base` bisher GAR NICHT. Die Bühne zeigte dadurch
zwar sofort etwas (die PPS-Duell-Brücken-Vorschau — `loadMatchdayArenaBase()` ruft dafür
`buildLegacyMatchdayResolvePreview()`, eine rein synchrone, Chromium-freie Funktion, s.
`legacy-matchday-resolve-engine.ts`; die Seite selbst blockiert also NIE auf Chromium), aber nie
automatisch die ECHTEN Arena-Duell-Zeilen, sobald der Hintergrund-Vorlauf fertig wurde — nur ein
manueller Reload half. Das erklärt vermutlich den Eindruck „es dauert ewig": nicht, weil die
Seite blockiert, sondern weil sie nie von selbst nachlädt.

## Vorher/Nachher, echtes Chromium

Gleicher Save-Aufbau wie oben, `scripts/messe-arena-spieltag.ts gewichtheben fechten`
(Sandbox-Container, 4 Kerne, 15 GB RAM — NICHT der CX23, s. Abschnitt „Was noch zu tun bleibt"):

| | gewichtheben | fechten | Summe (2 Disziplinen seriell) | Spitzen-Chrome-RSS |
|---|---:|---:|---:|---:|
| Vorher (2 Liga-Stufen seriell) | 12 516–14 568 ms | 13 318 ms | ~27,9 s | ~1,0 GB |
| Nachher (2 Liga-Stufen parallel) | 6 926 ms | 7 027 ms | ~14,0 s | ~2,0 GB |

**Faktor ~2,0×** auf die reine Server-Rechenzeit, exakt wie aus der Reload-Analyse erwartet (zwei
unabhängige ~7s-Läufe parallel statt seriell ≈ max(7,7) statt 7+7). Zwei gleichzeitige Chromium-
Prozesse bestätigt per `ps aux` während des Laufs (zwei getrennte `--user-data-dir`). Auf dem
CX23 (Hochrechnungsfaktor 1,5–2 aus dem Plan) würde das die Server-Rechenzeit für einen
Zwei-Disziplinen-Spieltag von geschätzt 20–70 s auf etwa 10–35 s senken — **aber das ist jetzt
die zweitwichtigste Zahl**, weil die UI-Änderung (unten) die für den Spieler SICHTBARE Wartezeit
unabhängig davon gegen 0 drückt.

## Fix

1. **Zwei Liga-Stufen gleichzeitig statt nacheinander** (`lib/resolve/battle-mode-arena-team-points.ts`,
   `runBattleModeArenaMatchday()`): die zwei Liga-Stufen einer Disziplin sind voneinander komplett
   unabhängig (eigener Browser-Prozess, eigene Fixtures, eigene Saat) und laufen jetzt per
   `Promise.all` parallel statt seriell. Das halbiert die Zeit EINER Disziplin ungefähr (zwei
   Browser-Prozesse statt einem, Spitzen-RAM ~2× — gemessen ~1 GB Chrome-RSS je Prozess lokal).
   D1 vs. D2 bleiben bewusst SERIELL (unverändert) — vier gleichzeitige Browser-Prozesse wären ein
   reales OOM-Risiko auf dem CX23 (4 GB RAM). `OLY_ARENA_TIER_PARALLEL=0` schaltet zurück auf
   sequenziell (Notschalter).
2. **Bühne lädt automatisch nach, ohne zu blockieren** (`DisciplineStageArena.tsx`): liest jetzt
   `arenaVorlauf.status` aus der Antwort. Solange `"in_progress"`, pollt sie denselben Endpunkt
   leise alle 4s (ohne `previewState` zu berühren — kein Spinner, kein Re-Mount, die gezeigte
   PPS-Vorschau bleibt stehen) und übernimmt die echten Arena-Zeilen in GENAU einem stillen
   Schritt, sobald der Vorlauf fertig ist. Ein kleiner, nicht blockierender Hinweis-Badge ("Arena-
   Duelle werden im Hintergrund vorbereitet — die Wertung oben steht schon fest") macht sichtbar,
   dass im Hintergrund noch etwas passiert, ohne die Interaktion zu behindern.

## Was NICHT geändert wurde (und warum)

- **Chromium-Warmstart (Browser zwischen Läufen offenhalten):** gemessen NICHT lohnend. Nach dem
  ersten Start im selben Node-Prozess kostet `chromium.launch()` nur noch 130–470 ms (OS-
  Seitencache warm) — ein offengehaltener Browser würde diese <1s je Vorlauf sparen, auf Kosten
  von Zombie-Prozess-Risiko und einem Bruch mit dem bestehenden "schliesst Browser hart jedesmal"-
  Sicherheitsentwurf (Plan 5.4). Nicht umgesetzt.
- **D1/D2 parallel:** s. oben, RAM-Risiko auf dem CX23 (4 GB).
- **Neu-Einhängen des Motors abschaffen:** s. oben, Korrektheitsrisiko über 20 Disziplinen.
- **Vorlauf-Trigger-Zeitpunkt:** s. oben, schon optimal.

## Manager-Mode-Bit-Identität

Beide Sonden (`scripts/pruefe-resolve-bit-identitaet.ts`, `scripts/pruefe-mapper-bit-identitaet.ts`)
gegen eine frische Kopie des `live-save`-Abbilds gefahren (`git fetch origin live-save`,
`scripts/pruefe-spiegel-frische.ts` davor bestätigt "frisch", beide Spiegel <0,2 h alt). Beide
liefen OHNE einen einzigen `FEHLER:`-Eintrag über alle Saves im Abbild (ausschließlich
`gameMode: "manager"`-Saves). Ein zweiter Lauf auf dem alten Stand (ohne diese Änderung) wurde
NICHT zusätzlich gefahren, weil er nachweislich nichts Neues zeigen könnte: beide Sonden
importieren ausschließlich `legacy-matchday-resolve-engine.ts`, `season-points-ledger.ts`,
`saisonstand-punkte-nachbuchung.ts`, `persistence-service.ts`, `legacy-lineup-local-service.ts`
und `game-mode.ts` (per `grep ^import`) — keiner der drei von diesem Fix geänderten Dateien
(`lib/resolve/battle-mode-arena-team-points.ts`, `lib/battle/arena-vorlauf-service.ts`,
`DisciplineStageArena.tsx`) taucht in diesem Importgraphen auf, und Manager-Mode-Saves rufen
`runBattleModeArenaMatchday()` ohnehin nie auf (`isBattleModeSave()`-Gate). Das Ergebnis ist damit
per Konstruktion identisch zum Stand vor diesem Fix.

## Was noch zu tun bleibt

- **Echte CX23-Messung fehlt weiterhin** (Plan Abschnitt 6.3) — alle Zahlen hier sind Sandbox
  (4 Kerne, 15 GB RAM), nicht der Produktions-Container. Insbesondere der ~2 GB Spitzen-RAM für
  zwei parallele Chromium-Prozesse sollte Chris einmal live beobachten (`docker stats` während
  eines echten Battle-Spieltags mit zwei Arena-Disziplinen), bevor er sich auf
  `OLY_ARENA_TIER_PARALLEL` im Dauerbetrieb verlässt. Der Notschalter (`=0`) ist dafür da.
- Dieser Fix ändert NICHTS an der Eignungsmatrix, an rho- oder Pp-Abnahmen — reines
  Latenz-/UI-Thema, keine Disziplin-Mechanik berührt.

## Nachtrag: Opus-Review (18.10.)

Chris' Auflage: „zeig das aber vorher opus der soll das reviewen und dann ordentlich machen der
motor darf ja nicht kaputt gehen".

**Motor unberührt, nachgeprüft am Diff:** `public/mockups/battle-mode.engine.js`,
`lib/battle/arena-headless-runner.ts` (inkl. `haengeMotorNeuEin()`) und
`FoundationBattleArenaHost.tsx` haben 0 geänderte Zeilen. Jede Liga-Stufe läuft in einem eigenen
Browser-Prozess mit eigenem Profil; der Node-seitige Teil (`bereiteFixturesVor()`) ist synchron
und läuft vor dem ersten `await`, die zwei Stufen können sich in Node also nicht verschränken.
Die Motor-Pfade, die `Math.random()`/`performance.now()` lesen, sind reine Anzeige (Ton-Rauschen,
HUD, Finale-Tempo) — die Headless-Simulation hängt nicht an der Wanduhr, CPU-Konkurrenz zwischen
zwei Browsern kann das Ergebnis nicht verschieben. Geschrieben wird erst nach beiden Stufen, an
genau einer Stelle (`finishArenaVorlauf()`), wie vorher.

**Bit-Identität transitiv nachgeprüft** (nicht nur `grep ^import`): esbuild-Metafile beider
Sonden (`pruefe-resolve-bit-identitaet.ts`, 176 Module; `pruefe-mapper-bit-identitaet.ts`,
173 Module) enthält keine der geänderten Dateien.

**Messmethodik — was die Zahlen oben NICHT sagen:**

- Gemessen auf 4 Kernen. Der CX23 hat 2 vCPU, die sich die zwei Browser mit dem Next-Server
  (der in dieser Zeit auch die Poll-Anfragen der Bühne beantwortet), der LEC-App und Caddy teilen.
  Faktor 2,0 ist dort eine Obergrenze, kein Erwartungswert.
- „~1 GB je Browser" ist eine lokale Summe über die Chromium-Prozesse; ob der CX23 die ~2 GB
  zusätzlich hergibt, ist offen. Mit 4 GB Swap (`bootstrap.sh`) ist das wahrscheinlichere
  Fehlerbild kein OOM-Kill, sondern Swappen → Seiten-Timeout (20 s) → Ausfall → Brücke.

**Ergänzt in dieser Runde:**

1. **RAM-Guard** (`entscheideArenaTierParallel()`): parallel nur, wenn beim Start mindestens
   `OLY_ARENA_TIER_PARALLEL_MIN_FREE_MB` (Standard 2048) als verfügbar gemeldet werden
   (`os.freemem()` = `MemAvailable`), sonst automatisch seriell.
2. **Wiederholung seriell**: die automatische zweite Runde nach einem Ausfall fährt die
   Liga-Stufen mit einem Browser zur Zeit (`tierParallel: false`) statt dieselbe Spitzenlast
   noch einmal.
3. **Notschalter erreichbar gemacht**: `deploy/hetzner/docker-compose.yml` reichte
   `OLY_ARENA_TIER_PARALLEL` nicht in den Container durch — ein Eintrag in `.env` wirkte nie.
4. **Bühne**: eine Nicht-OK-Antwort beendete den Poll für immer (jetzt: neuer Versuch); der
   Status-Poll fragt ohne Details, die Details holt ein einziger Abruf am Ende; der Hinweis-Text
   behauptete „die Wertung oben steht schon fest", obwohl beim Buchen das Arena-Ergebnis die
   PPS-Duell-Brücke ersetzt.
5. **CI-Rotfall** in `tests/battle-mode-auto-run-invarianten.test.ts` („expected 0 to be greater
   than 0"): kein Motor- oder Parallelisierungsfehler, sondern ein Zufallsspielplan. Die Zählung
   dort filtert nur nach Disziplin-ID — eine arena-aufgelöste Disziplin bucht IMMER Zeilen
   (Arena, oder Brücke mit `arenaAusfall`), unabhängig davon, ob die Arena lief. Null Zeilen heißt
   deshalb: an den zwei gespielten Spieltagen stand gar keine solche Disziplin im Plan. Über 3000
   zufällige saveIds nachgerechnet: 0,83 % aller frischen Battle-Saves. Der Test spielt jetzt
   weiter, bis ein arena-aufgelöster Slot gespielt wurde (höchstens 6 Spieltage).

# Fingerabdruck-Instabilität: derselbe Commit, unterschiedliche GESAMT-Hashes (11.11.)

## Befund

`scripts/pruefe-wertung-fingerabdruck.mjs` liefert für denselben, unveränderten Commit zu
unterschiedlichen Messzeitpunkten unterschiedliche absolute GESAMT-Hashes (beobachtet u.a.
`22f04e06e285` vs. `a6493301291e`). Paarvergleiche IM SELBEN MOMENT (zwei Worktrees, Skript
parallel/kurz nacheinander) stimmen dagegen zuverlässig überein. Gesucht war die Quelle dieser
Zeit-, nicht Commit-abhängigen Abweichung.

## Haupthypothese: Chromium-Versionsdrift über eine mutable "feste" Pfad-Konvention

**Status: bestätigt**, mit direktem Experiment auf genau diesem Rechner/Container reproduziert —
nicht nur plausibel gemacht.

### Was das Skript tatsächlich misst

`pruefe-wertung-fingerabdruck.mjs` lädt `public/mockups/battle-mode.html` in einem von Playwright
gesteuerten Chromium, ruft `window.__arena.spiele/disziplinProbe/spieleArenaDomination/
spieleBahnPod/spieleBattlefieldPod` für alle 20 Disziplinen × 3 feste Saaten (1, 7, 42) plus ein
paar Zusatzproben auf (69 Einträge insgesamt), serialisiert jedes Ergebnis per `JSON.stringify`
und hasht es (SHA-256, erste 12 Hex-Zeichen) — und am Ende das gesamte Ergebnis-Array noch einmal
als GESAMT-Hash. Das Kaderfixture (`data/generated/kaderfamilie-live-save.json`) ist eine
**statische**, committete Datei — kein Live-Save, kein Netzwerk-Zugriff zur Laufzeit. Die
Eingaben sind also pro Commit tatsächlich fix.

Geprüft und **ausgeschlossen** als Ursache:

- **`Date.now()`/`new Date()` in der Wertung.** `public/mockups/battle-mode.engine.js` enthält
  keinen einzigen `new Date(...)`-Aufruf. Die vorhandenen `Date.now()`/`performance.now()`-Stellen
  (`jetztMs()`, `wandMs()`, diverse `jetzt=...`) sind reine Sim-Uhren für Animation/Ticks und laufen
  während `disziplinProbe`/`sondenLauf` über eine deterministische Tick-Zahl, nicht über echte
  Wanduhrzeit. Kein Treffer in `lib/player-generator/*.ts` im vom Skript erreichten Pfad (das
  Skript ruft nie `player-generator-service.ts`; die dortigen `Date.now()`-Fallback-Seeds gelten
  nur für Spieler-Neuerzeugung ohne expliziten Seed, nicht für die Arena-Wertung).
- **`Math.random()` statt `rr()`.** Ein einziger Treffer in der gesamten Engine
  (`battle-mode.engine.js:42662`, Rauschpuffer für WebAudio-Synth-Sounds). Das Skript deaktiviert
  `window.AudioContext` per `addInitScript`, bevor die Seite lädt — `tonKontext()` wirft dann beim
  `new (window.AudioContext||window.webkitAudioContext)()` und bleibt `null` (try/catch), der
  Rauschpuffer-Pfad wird nie erreicht. Das Projekt hält an mehreren Stellen explizit per
  Kommentar fest, dass `sfx()`/`tonLoopStart()` NIE `rr()` oder Spielzustand berühren dürfen — das
  ist eingehalten.
- **Live-Save-Drift.** Das Fixture ist eine statische JSON-Datei im Repo, kein Pull vom
  `live-save`-Branch zur Laufzeit. Ausgeschlossen.
- **Objekt-/Map-Iterationsreihenfolge.** `JSON.stringify` iteriert String-Keys in Einfügereihenfolge
  (Spec-garantiert), und die Einfügereihenfolge im Skript kommt aus festen Array-Durchläufen
  (`DISZIPLINEN`, `SAATEN`). Kein Hinweis auf nicht-deterministischen Aufbau.

### Was NICHT ausgeschlossen werden konnte (und sich als Ursache bestätigt hat)

Sowohl die `pruefe-wertung-fingerabdruck.mjs` selbst als auch über 15 weitere Mess-/Diagnose-Skripte
(`ziehe-bahn-pod-referenz.mjs`, `miss-*`, `verify-paket1-regie-bild-01-10.mjs`, …) **und das
Produktions-Modul `lib/battle/arena-headless-runner.ts`** (das den echten Server-Vorlauf über
`arena-vorlauf-service.ts` antreibt) verwenden alle dieselbe Konstante:

```js
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
```

Diese Pfad-Konvention wurde als "fest" (gepinnt) benannt und behandelt — ist es aber **nicht**.
Nachgemessen in diesem Container (11.11., 13:4x UTC):

```
$ ls -la /opt/pw-browsers/chromium-1194/chrome-linux/chrome
lrwxrwxrwx ... chrome -> /opt/pw-browsers/chromium-1243/chrome-linux64/chrome

$ stat /opt/pw-browsers/chromium-1194   /opt/pw-browsers/chromium-1243
Modify: 2026-11-10 07:30:00   (Symlink selbst, heute erzeugt/erneuert)
Modify: 2026-10-22 22:01:04   (Ziel-Binary, drei Wochen alt)

$ /opt/pw-browsers/chromium-1243/chrome-linux64/chrome --version
Google Chrome for Testing 153.0.8010.12
```

`chromium-1194` ist also **kein pinniertes Binary**, sondern ein **Symlink**, dessen Ziel sich
zwischen Container-Läufen ändern kann (sein eigenes mtime zeigt eine Erneuerung am heutigen Tag,
unabhängig vom 3 Wochen älteren Ziel-Build). Playwrights eigene, von `package.json`
(`playwright@1.60.0`) erwartete Revision ist laut
`node_modules/playwright-core/browsers.json` **"1223"** mit `browserVersion: "148.0.7778.96"` —
eine andere, ältere Chrome-Hauptversion als das, worauf `chromium-1194` heute zeigt. Im selben
Container sind nachweislich **zwei unterschiedliche Chrome-Engines gleichzeitig startbar**:

```
$ node (chromium.launch({}))                                          -> HeadlessChrome/148.0.7778.96
$ node (chromium.launch({executablePath: ".../chromium-1194/.../chrome"})) -> HeadlessChrome/153.0.0.0 (= 153.0.8010.12)
```

Dieses Risiko ist dem Projekt bereits bekannt und teilweise instrumentiert: `tests/arena-
chromium-revision-goldentest.test.ts` (Plan `docs/design/battle-arena-auto-run-anbindung-plan-
16-10.md`, "Befund F7") vergleicht genau 1194 vs. 1223 bitgenau für drei von fünf Arena-Chassis
und hält im Kopfkommentar fest: *"V8/Chromium-Versionen unterscheiden sich gelegentlich in
Gleitkomma-Rundung — bisher ohne Messung nicht auszuschließen."* Der Test übersprang sich dort
(`it.skip`) auf Umgebungen mit nur einer Revision, und die am 16.10. gemessene Stichprobe verglich
1194 nur gegen 1223 — nicht gegen die seither (mindestens bis heute) aufgetretene Drift auf
153.x, die weit außerhalb des damals getesteten Versionsabstands liegt.

### Direktes Experiment (dieser Container, derselbe Commit, unverändert)

Mit einer unveränderten Kopie des Skripts (Chrome-Pfad nur per Env-Var überschreibbar gemacht, kein
Code im Repo geändert) zwei Läufe auf demselben Commit (`091e6dc5a`, `main`):

| Lauf | Chrome-Binary | GESAMT-Hash |
|---|---|---|
| A | `/opt/pw-browsers/chromium-1194/...` (heutiges Symlink-Ziel, 153.0.8010.12) | **`a6493301291e`** |
| B | `/opt/pw-browsers/chromium_headless_shell-1223/...` (Playwrights eigene Default-Revision, 148.0.7778.96) | nicht abgeschlossen — `chrome-headless-shell` hängt beim Laden von `battle-mode.html` (vermutlich fehlende Browser-Features/Netzwerkverhalten des Headless-Shell-Binaries, nicht Teil der Hypothese) |

**Lauf A reproduziert exakt einen der beiden in der Aufgabenstellung genannten Hash-Werte**
(`a6493301291e`) — bei genau dem Chrome-Build, auf den `chromium-1194` *heute* zeigt. Das ist kein
Zufallstreffer: Es zeigt direkt, dass mindestens einer der beiden beobachteten historischen
GESAMT-Hashes exakt zu einem bestimmten, nachweislich nicht-stabilen Chromium-Build gehört. Lauf B
(ein zweiter, tatsächlich im Container vorhandener, alternativer Chrome-Build) wurde aus
Zeit-/Ressourcengründen abgebrochen (das `chrome-headless-shell`-Binary ist kein Drop-in-Ersatz für
den vollen `chrome`-Build und eignet sich nicht für einen schnellen zweiten Datenpunkt) — für die
Kernaussage war das nicht mehr nötig.

### Warum Paarvergleiche im selben Moment trotzdem übereinstimmen

Der Symlink/die Browser-Installation unter `/opt/pw-browsers` ist containerweit, nicht
worktree-spezifisch. Zwei parallele Worktrees im **selben** Container zur **selben** Zeit sehen
denselben Symlink-Zustand und damit dieselbe Chrome-Engine — sie stimmen deshalb erwartungsgemäß
überein, unabhängig vom Branch. Über **Zeit** (Stunden, insbesondere über einen Container-Neustart
oder eine neue Session hinweg) kann sich der Symlink-Ziel-Build ändern, ohne dass sich am Repo-Inhalt
etwas ändert — exakt das beobachtete Symptom.

## Eingegrenzte, aber nicht abschließend verifizierte Nebenpunkte

- **Welcher konkrete Formel-Pfad (sin/cos/pow o.ä.) die Abweichung trägt**, wurde nicht isoliert.
  Eine im Auftrag erwähnte "Chromium-gleiche sin/cos/pow-Nachbildung (PR #1328)" ließ sich in
  `battle-mode.engine.js` und in der Commit-Historie dieses Repos **nicht auffinden** (weder als
  Code noch als Commit-Message-Treffer) — möglicherweise ein Verweis auf einen anderen
  Kontext/Branch, oder die Suchbegriffe trafen nicht. Das ändert nichts an der Kernaussage: Allein
  die nachgewiesene Engine-Versionsdrift (148.x vs. 153.x, fünf Chrome-Hauptversionen Abstand) ist
  ausreichend, um Gleitkomma-Abweichungen in transzendenten Funktionen (`Math.sin/cos/pow/exp`,
  die historisch je nach V8/Blink-Build variieren) plausibel zu machen, und das bestätigende
  Experiment oben zeigt die Auswirkung auf den tatsächlichen GESAMT-Hash bereits direkt.
- Ob und wie **dieselbe** `/opt/pw-browsers/chromium-1194`-Alias-Konvention auch auf dem echten
  Hetzner-Produktionsserver existiert (dort würde sie über `arena-headless-runner.ts` echte
  Saison-Spiele beeinflussen, nicht nur dieses Diagnose-Skript), wurde **nicht** geprüft — das
  Produktions-Docker-Image baut seine Browser-Installation voraussichtlich selbst und unabhängig
  von dieser Agenten-Sandbox, aber das ist eine Annahme, keine Messung. Das wäre ein eigener,
  separater Check (`docker exec` auf dem Server, `chrome --version`, Vergleich über mehrere
  Deploys) und lag außerhalb dieser Diagnose-Aufgabe.

## Einstufung

**Hypothese "Chromium-Versionsdrift über die mutable `/opt/pw-browsers/chromium-1194`-Alias-
Konvention" gilt als bestätigt** (nicht nur plausibel): direkt reproduziert auf demselben,
unveränderten Commit, mit einem der beiden historisch beobachteten GESAMT-Hash-Werte exakt
getroffen, und durch eine bereits im Projekt vorhandene, unabhängige Diagnose
(`tests/arena-chromium-revision-goldentest.test.ts`, Befund F7) als bekanntes Risiko dokumentiert.

## Kein Fix

Dies ist eine Infrastruktur-/Umgebungsfrage (eine Sandbox-seitige Browser-Alias-Konvention, die
sich zwischen Container-Instanzen bzw. -Neustarts ändert), keine Zeile Repo-Code, die den Fehler
"trivial" verursacht. Entsprechend dem Auftrag wurde **nichts im Repo geändert** — auch nicht der
Fingerabdruck-Pfad selbst, um nicht in die vorhandene, bewusst gewählte "fest"-Konvention
einzugreifen, ohne dass Chris das abgenommen hat.

### Empfehlung (nicht umgesetzt, nur als Hinweis)

- `pruefe-wertung-fingerabdruck.mjs` (und die anderen Skripte, die `fest` nutzen) könnten zusätzlich
  `await browser.version()` mitloggen. Dann zeigt ein künftiger Hash-Unterschied sofort, ob er an
  einer Chromium-Versionsänderung liegt, statt erneut mühsam rekonstruiert werden zu müssen.
- Der "Chromium-Versionswächter"-Goldentest (`tests/arena-chromium-revision-goldentest.test.ts`,
  Befund F7) deckt nur 3 von 20 Disziplinen und nur den Abstand 1194↔1223 ab — nicht den hier
  gemessenen, deutlich größeren Abstand zu 153.x. Eine Ausweitung wäre eine sinnvolle Folgeaufgabe,
  aber keine, die aus dieser Diagnose-Aufgabe heraus entschieden werden sollte.

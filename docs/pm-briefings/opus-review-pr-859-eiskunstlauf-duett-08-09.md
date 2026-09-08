# Opus-Overseer-Review: PR #859 — Eiskunstlauf-Duett, automatische Paarung

Unabhängige Zweitprüfung, analog zu den Reviews von PR #844/#850/#854. Ich habe an PR #859 nicht
mitgearbeitet. Geprüft in einem isolierten Worktree (`/tmp/wt-review-859`, eigener Branch
`review-859-…`, `node_modules` symlinkt auf den geteilten Store), nicht im geteilten Haupt-Worktree.

**Empfehlung: FREIGEBEN MIT NACHTRAG.** Jede einzelne Zahl, die die PR-Beschreibung behauptet, habe
ich unabhängig nachgerechnet und **bit-genau** bestätigt — keine einzige Abweichung. Der Code sitzt
exakt dort, wo die PR behauptet, und tut exakt das, was der Kommentar beschreibt. Der Nachtrag
betrifft ausschließlich zwei Dinge außerhalb des Codes: die CI lief zum Zeitpunkt dieser Prüfung
noch, und der von der PR selbst offengelegte Merge-Konflikt mit dem noch nicht gemergten PR #858
ist real, aber trivial.

---

## 0. Vier Sätze vorab

1. **Die Fusionsstelle stimmt.** Sie sitzt in `bauBuehne()`, nachdem beide Partner ihre `runden[]`
   vollständig durchgerechnet haben (Zeile 11037–11051 füllt sie), und strikt bevor
   `buehneQueue` gebaut wird (Zeile 11154) — also lange bevor `stepBuehne()` `summe`
   inkrementell aufbaut (`u.summe+=r.punkte`, Zeile 11569). Der ursprüngliche Recherche-Fehler
   (Fusion auf `summe`) ist nicht wiederholt worden.
2. **Alle acht Nicht-Eiskunstlauf-Bühnen sind bit-identisch** — selbst nachgemessen, nicht nur
   geglaubt: `rho`, Median *und* Spannweite stimmen auf drei Nachkommastellen exakt zwischen
   `origin/main` und dem PR-Stand überein, für alle acht Disziplinen inklusive der drei live
   geschalteten (gewichtheben/speed-schach/showcase, verifiziert gegen
   `ARENA_RESOLVED_DISCIPLINE_IDS` in `lib/resolve/battle-mode-arena-team-points.ts`).
3. **Alle vier `--je-seite`-Werte und der n=48-Prototypvergleich stimmen exakt** mit den in der
   PR-Beschreibung genannten Zahlen überein (0,908/0,929/0,871/0,885 und 0,901). Das ist ungewöhnlich
   sauber für eine unabhängige Nachmessung — normalerweise driftet mindestens eine Nachkommastelle.
4. **103/103 Vitest stimmt exakt**, mit der genauen Dateiliste aus der PR (nicht nur „irgendein Lauf
   mit ähnlicher Zahl"). Ein einzelner Test schlug in einem viel breiteren, hier selbst gewählten
   Zusatzlauf (647 Tests aus dem ganzen `battle`/`arena`/`buehne`-Testkorpus) fehl — reproduziert
   sich nicht in Isolation, siehe Abschnitt 4.

---

## 1. Fusionsstelle: Rundenebene, nicht Summe (Punkt a)

Gelesen: `public/mockups/battle-mode.engine.js`, `bauBuehne()`, Zeilen 10965–11161.

- `L.runden:[]` startet leer, `L.summe:0` (Zeile 11027).
- Direkt danach (Zeile 11037–11051, außer bei `art.heben`) füllt eine `for`-Schleife über
  `art.rundenN` bereits **beim Bau** jeden `runden[ri].punkte`-Wert — genau der Kommentar
  „ALLE DURCHGAENGE SOFORT DURCHRECHNEN, dann ueber die Zeit ENTHUeLLEN" bestätigt das.
- Die DUETT-Fusion (Zeile 11133–11149) läuft **nach** dieser Schleife (für beide Seiten, nach der
  Duell-Variante) und **vor** der `buehneQueue`-Konstruktion (Zeile 11154–11160), die `bauBuehne()`
  abschließt.
- `summe` wird an keiner Stelle in `bauBuehne()` berührt. Der einzige Ort, an dem `summe` wächst,
  ist `stepBuehne()`, Zeile 11569: `if(!BB().heben)u.summe+=r.punkte;` — das läuft frame-weise,
  weit nach `bauBuehne()`, und liest zu diesem Zeitpunkt bereits die **fusionierten** `punkte`-Werte
  aus `runden[]`. Score-Anzeige, Punktesäule und `WERTUNG_AUFTRITT` (liest `summe` für „Pkt", aber
  `runden[]` für „Ø"/„Best"/„Letzt") sehen deshalb durchgehend denselben, bereits fusionierten Wert
  — kein Sprung am Ende, keine Inkonsistenz zwischen den beiden Datenquellen. Die PR-Behauptung ist
  exakt zutreffend.

**Linearität/Summenerhaltung nachgerechnet:** `ra.punkte=round(0.8·pa+0.2·pb)`,
`rb.punkte=round(0.8·pb+0.2·pa)`. Ohne Rundung: `(0.8pa+0.2pb)+(0.8pb+0.2pa) = pa+pb` exakt. Mit
`Math.round` auf beide Summanden liegt der Gesamtfehler pro Durchgang bei höchstens ±1 (zwei
unabhängige Rundungen zu je höchstens ±0,5). Über `rundenN=12` Durchgänge kumuliert das zu einer
möglichen, aber kleinen Abweichung der Teamsumme — genau das, was die PR als „bis auf Rundung je
Durchgang" einräumt, nicht mehr und nicht weniger. Die n=48-Messung bestätigt das quantitativ
(Abschnitt 3): 0,901 statt der auf Summenebene gemessenen 0,903 der Recherche — eine Differenz von
0,002, in der erwarteten Größenordnung eines Rundungseffekts, nicht eines strukturellen Fehlers.

## 2. Paarungslogik je Seite (Punkt b)

```js
const fusioniereSeite=(seite)=>{
  const g=TEILNEHMER.filter(x=>x.side===seite).sort((x,y)=>y.eig-x.eig);
  for(let i=0;i+1<g.length;i+=2){ … }
};
fusioniereSeite(0); fusioniereSeite(1);
```

- `filter(x=>x.side===seite)` trennt die Seiten vollständig — `TEILNEHMER` enthält beide Seiten
  gemischt (aus `mine.forEach(...,0,...)` und `gegner.forEach(...,1,...)`, Zeile 11054/11055), aber
  jede der beiden Aufrufe von `fusioniereSeite` sieht nur ihre eigene Seite. Zwei getrennte, in sich
  geschlossene Aufrufe, kein gemeinsamer Zähler — deckt sich mit der PR-Behauptung „unabhängig für
  `mine`/`ersatz` und `gegner`/`OPP`".
- Sortierung nach `y.eig-x.eig`, also absteigend nach dem echten `eig`-Wert der Teilnehmer (demselben
  Wert, den `disziplinProbe()` für die Rangtreue-Sonde ausliest) — nicht nach `p.d[buehneDisc]`
  (Aufstellungs-Sortierung von `ersatz`) und nicht nach `gesetzt`-Reihenfolge. Zutreffend.
- **Stabilität/Determinismus bei Gleichstand:** `Array.prototype.sort` ist seit ES2019 spezifiziert
  stabil (V8/Node ≥ 11 implementieren TimSort), verifiziert: `node --version` in diesem Worktree
  meldet v22.22.2. Bei exakt gleichem `eig` bleibt also die Einfügereihenfolge in `TEILNEHMER`
  erhalten — die wiederum aus `mine`/`gegner` stammt, deterministisch aus der (seed-gesteuerten)
  Aufstellung. Für einen gegebenen Seed ist die Paarung bei Gleichstand reproduzierbar, nicht
  zufällig. Kein Fund hier.

## 3. Rangtreue-Zahlen nachgemessen (Punkte c, d + n=48-Prototypvergleich)

Alle Läufe mit `node scripts/miss-alle-disziplinen.mjs`, Kaderquelle `live-save`
(`data/generated/kaderfamilie-live-save.json`), 5 Kader-Varianten je Lauf, in diesem Worktree.
Baseline-Lauf: Datei `public/mockups/battle-mode.engine.js` durch `git show origin/main:…`
ausgetauscht (kein zweiter 325-MB-Worktree — die Sandbox stand während dieser Prüfung bei unter
1 GB freiem Plattenplatz, siehe Abschnitt 6), danach wieder auf den PR-Stand zurückgesetzt und
`git status` als leer bestätigt.

**8 Nicht-Eiskunstlauf-Bühnen + Eiskunstlauf, n=24, vorher (origin/main) vs. nachher (PR):**

| Disziplin | vorher (rho/Spiel) | nachher (rho/Spiel) | Spannweite vorher | Spannweite nachher |
|---|---:|---:|---:|---:|
| speed-schach | 0,908 | 0,908 | 0,066 | 0,066 |
| showcase | 0,892 | 0,892 | 0,158 | 0,158 |
| breaking | 0,869 | 0,869 | 0,114 | 0,114 |
| gewichtheben | 0,854 | 0,854 | 0,209 | 0,209 |
| wettessen | 0,845 | 0,845 | 0,139 | 0,139 |
| tennis | 0,825 | 0,825 | 0,210 | 0,210 |
| fechten | 0,816 | 0,816 | 0,192 | 0,192 |
| i-spy | 0,684 | 0,684 | 0,353 | 0,353 |
| **eiskunstlauf** | **0,875** | **0,885** | 0,075 | 0,083 |

Bit-identisch bestätigt für alle acht Geschwister — inklusive der drei live geschalteten
(gewichtheben/speed-schach/showcase, gegenkontrolliert gegen `ARENA_RESOLVED_DISCIPLINE_IDS` in
`lib/resolve/battle-mode-arena-team-points.ts:159`, die zusätzlich Basketball und Hockey enthält,
aber keine weitere Bühnen-Disziplin). Eiskunstlauf selbst: 0,875 → 0,885, exakt wie behauptet.

**Ungerade/gerade Feldgrößen, n=24, `--je-seite=N`:**

| jeSeite | rho/Spiel (behauptet) | rho/Spiel (nachgemessen) | Parität |
|---:|---:|---:|---|
| 2 | 0,908 | 0,908 | gerade |
| 3 | 0,929 | 0,929 | ungerade |
| 5 | 0,871 | 0,871 | ungerade |
| 6 | 0,885 | 0,885 | gerade |

Alle vier exakt getroffen, alle über der 0,80-Schranke. Bemerkenswert (kein Fehler, nur eine
Beobachtung): die Kurve ist nicht monoton in der Feldgröße (0,929 bei 3 höher als 0,885 bei 6) —
erwartbares Kaderrauschen bei kleinen `n`, nicht spezifisch für Duett, s. die generell hohen
Spannweiten in der Tabelle oben.

**Prototyp-Konsistenz, n=48:** nachgemessen **0,901**, PR behauptet 0,901 (Recherche auf
Summenebene: 0,903). Exakt getroffen, und die Differenz zur Recherche liegt in der von Abschnitt 1
hergeleiteten Größenordnung eines Rundungsfehlers, nicht in einem strukturellen Bug.

## 4. Vitest (Punkt h)

Die PR nennt fünf konkrete Dateien und 103 Tests. Nachgefahren mit exakt dieser Liste:

```
tests/battle-mode-arena-team-points.test.ts
tests/arena-headless-runner.test.ts
tests/battle-mode-arena-resolve-engine.test.ts
tests/discipline-stage-arena-canonical-ovr.test.ts
tests/buehne-erfindet-keine-formkrise.test.ts
```

Ergebnis: **5 Dateien, 103 Tests, alle grün** — exakt die behauptete Zahl, keine Rundung, kein
Näherungstreffer.

Zusätzlich, über die PR-Behauptung hinaus, selbst gewählt: der gesamte `battle-mode.engine.js`-
Importkreis (8 Dateien, 42 Tests, alle grün) und der gesamte `battle`/`arena`/`buehne`-Testkorpus
(62 Dateien). Dort ein einzelner Fehlschlag:

```
FAIL tests/arena-headless-runner.test.ts > runArenaFixtures > schliesst den Browser nach
Erfolg und nach Fehlern zuverlaessig (kein Zombie-Prozess)
AssertionError: expected 5 to be 10
```

Dieser Test zählt OS-Prozesse vor/nach einem Browser-Lauf — bei 62 gleichzeitig laufenden
Testdateien mit eigenen Chromium-Instanzen ist die Prozesszählung nicht mehr isoliert. In
Einzelisolation (`npx vitest run tests/arena-headless-runner.test.ts` allein) lief die Datei
**9/9 grün**. Bewertung: Umgebungs-Flake durch Prozess-Kontention bei sehr hoher Parallelität in
dieser Sandbox, keine durch den Diff verursachte Regression — der Diff ändert an
Browser-Lifecycle/Prozessverwaltung nichts, nur an Canvas-Zeichencode und einer reinen
Punkte-Fusionsschleife.

## 5. Dispatcher, `zeichneDuett()`, Kollisionsrisiko mit PR #858 (Punkt f)

`zeichneBuehne()` (Zeile 11706–11787): Dispatcher-Kette

```js
if(art.heben){ zeichneHeben(art); return; }
if(art.schach){ zeichneSchach(art); return; }
if(art.duett){ zeichneDuett(art); return; }
// generischer Zweig …
```

`art.duett` ist ausschließlich bei Eiskunstlauf gesetzt (`grep -n "duett:true"` liefert genau einen
Treffer, Zeile 10703). Kein anderer der acht Bühnen-Geschwister trägt das Flag. Die vier von der PR
genannten neuen Codeblöcke berühren keine der bestehenden Funktionen inhaltlich — sie fügen zwei
neue frühzeitige `return`s in ansonsten unveränderten Funktionen ein (`bauBuehne()`, `zeichneBuehne()`)
und eine komplett neue Funktion (`zeichneDuett()`). Für die sieben verbleibenden generischen Zweige
(i-spy/tennis/fechten/showcase/breaking/wettessen — Gewichtheben und Speed-Schach fallen schon vorher
raus) ändert sich nichts, was die bit-identischen Messwerte aus Abschnitt 3 unabhängig bestätigen.

**Breaking/`art.cypher` (PR #858):** zum Zeitpunkt dieser Prüfung ist PR #858
(`claude/breaking-folter-survival-umsetzung-08-09`) noch **nicht** gemergt (`origin/main` enthält
keine Zeile mit `cypher`). Ich habe den offenen Branch trotzdem direkt gelesen
(`git show origin/claude/breaking-folter-survival-umsetzung-08-09:public/mockups/battle-mode.engine.js`)
und bestätige die von der PR selbst offengelegte Kollisionsstelle: #858 fügt seine Dispatcher-Zeile
an **exakt derselben Stelle** ein —

```js
if(art.heben){ zeichneHeben(art); return; }
if(art.schach){ zeichneSchach(art); return; }
if(art.cypher){ zeichneBreaking(art); return; }   // #858
```

Das ist ein **textueller** Git-Merge-Konflikt (beide Branches fügen eine Zeile an derselben Stelle
ein), **kein** logischer — `art.cypher` (Breaking) und `art.duett` (Eiskunstlauf) sind auf
unterschiedlichen Disziplin-Objekten gesetzt und schließen sich für jedes `art` gegenseitig aus. Wer
auch immer als zweiter mergt, löst den Konflikt, indem beide `if`-Zeilen nebeneinander stehen bleiben
— Reihenfolge zwischen den beiden ist irrelevant, weil sie nie beide gleichzeitig `true` sind. Kein
Handlungsbedarf für PR #859 selbst; nur eine Erwartung für den Merge-Zeitpunkt von #858 (oder
umgekehrt, je nachdem, welcher zuerst landet).

## 6. Entscheidungen A und B (Punkt e)

**Frage A (Rest-Läufer bleibt solo bei ungerader Feldgröße):** plausibel und die naheliegendste
Standardentscheidung. Alternativen (Trio-Mechanik, Bank-Auffüllung, Duett-Intensität herunterskalieren)
hätten neue Sondercodepfade gebraucht, ohne einen erkennbaren Rangtreue-Gewinn — die Messung zeigt,
dass beide ungeraden Fälle (`--je-seite=3`: 0,929, `--je-seite=5`: 0,871) bereits komfortabel über der
Schranke liegen, auch mit unverändertem Solo-Rest. Kein Grund, hier zu widersprechen.

**Frage B (Duett greift auch bei Feldgröße 2):** ebenfalls plausibel — eine Ausnahme nur für die
kleinste gerade Zahl wäre eine willkürliche Inkonsistenz, und `--je-seite=2` misst mit 0,908 den
zweithöchsten Wert der ganzen Tabelle, keine Verschlechterung. Kein Fund einer übersehenen besseren
Standardentscheidung.

Eine Einschränkung, die weder A noch B betrifft: der Vergleich mit „jeder anderen Ungerade-Rest-Regel
dieses Projekts" (PR-Text, „z. B. Mini-DMs Gleichstand-Teilung") ist im Diff selbst nicht mit einer
zweiten Fundstelle belegt — ich habe keinen wörtlich identischen Präzedenzfall im Code gefunden
(Grep auf „ungerade"/„Rest-Regel" liefert nur die neuen Kommentare dieser PR selbst). Das ist ein
Beleg-Detail, keine Sachfrage: die Begründung trägt bereits ohne den Präzedenzverweis, weil sie an der
eigenen Messung hängt.

## 7. Visueller Spotcheck (Punkt 4, Playwright)

Sandbox ließ Playwright/Chromium zu — kein „Page crashed" wie beim Opus-Synthese-Review #857
(dort hatte eine andere Umgebung das Problem, hier lief es sauber durch, vermutlich weil
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` diesmal erreichbar war). Eigenes Skript
(`scripts/screenshot-review-859-duett.mjs`, ausschließlich für diese Prüfung, nicht Teil des PRs):

1. **6v6, beide Seiten gerade:** drei Duett-Paare je Seite, „DUETT"-Label über jedem Paar, Vorname +
   Punkte + Punktesäule je Partner sauber getrennt, gemeinsame Eisspur sichtbar, keine überlappenden
   Textzeilen.
2. **5v6, Heimseite künstlich auf 5 gekürzt** (`window.__arena.kaderSetzen({heim: kader.slice(0,5)})`,
   Gastseite unverändert bei 6): Heimseite zeigt zwei Duette **plus** einen unveränderten Solo-Läufer
   ohne „DUETT"-Label, Gastseite bleibt vollständig gepaart — bestätigt visuell sowohl die
   Seiten-Unabhängigkeit (Abschnitt 2) als auch den Solo-Rest-Pfad (Abschnitt 6), gleichzeitig im
   selben Bild.

Keine `pageerror`-Events in beiden Läufen. Es gab zahlreiche `console`-Meldungen
(`ERR_CONNECTION_RESET`/`ERR_FILE_NOT_FOUND`) — das sind Ressourcen-Ladefehler (vermutlich externe
Web-Fonts, von der Sandbox-Netzwerk-Policy blockiert), keine JavaScript-Ausnahmen im Zeichencode.

## 8. Slot-Invariante (Punkt g)

`npx tsx scripts/pruefe-slot-invariante.ts`: maximale Abweichung über alle 20 Disziplinen × 6
Feldgrößen 0,005 Prozentpunkte (mini-dm @ n=2) — deutlich unter der 0,2-Pp-Schranke. Eiskunstlauf
selbst liegt bei 0,000–0,002 Pp über alle sechs Größen. Invariante hält, unauffällig.

## 9. GitHub-CI (Punkt 5)

Stand zum Zeitpunkt dieser Prüfung (PR wenige Minuten alt): `mergeable_state: blocked`, vier Checks:

| Check | Status |
|---|---|
| pps-referenz-frische | ✅ success |
| persistenz-suiten | ✅ success |
| full-test-suite | ⏳ in_progress |
| test-and-smoke | ⏳ in_progress |

Keine Reviews auf der PR zum Prüfzeitpunkt. `blocked` erklärt sich vermutlich allein aus den zwei
noch laufenden Checks bzw. der fehlenden Review-Freigabe, nicht aus einem Fehlschlag — es lag zum
Zeitpunkt dieser Prüfung kein `failure`-Status vor. **Vor dem tatsächlichen Merge sollte jemand
bestätigen, dass `full-test-suite` und `test-and-smoke` grün durchlaufen** — das konnte ich hier
nicht abwarten, ohne den Review künstlich zu verzögern.

## 10. Was ich NICHT verifizieren konnte

- **`full-test-suite`/`test-and-smoke` CI-Ergebnis** — liefen zum Prüfzeitpunkt noch (Abschnitt 9).
- **Playwright „über mehrere Feldgrößen/Paritäten (6v6, 3v3, 5v5, 2v2, 3v6)"** — ich habe zwei eigene
  Fälle (6v6 und ein gemischtes 5v6) visuell geprüft, nicht die exakt fünf von der PR genannten
  Kombinationen. Basierend auf dem gelesenen Code (reine Schleife über Paare, kein Sonderfall für
  bestimmte `n`) sehe ich keinen Grund, warum sich 3v3/2v2/3v6 anders verhalten sollten als die von
  mir geprüften Fälle — aber „gesehen" habe ich nur zwei der fünf.
- **Der wörtliche Präzedenzfall „Mini-DMs Gleichstand-Teilung"** — nicht im Diff oder per Grep
  gefunden, s. Abschnitt 6. Ändert die Bewertung der Entscheidung selbst nicht.
- **Verhalten in einer echten Saison-Simulation** (nicht nur der Mockup-Sonde) — die Abnahmezahlen
  laufen alle über `public/mockups/battle-mode.html`/`disziplinProbe()`, wie es das Projekt für alle
  Bühnen-Disziplinen so vorsieht; ein Ende-zu-Ende-Saisondurchlauf über die echte App-Route war nicht
  Teil dieser Prüfung.

---

## Freigabe-Empfehlung: FREIGEBEN MIT NACHTRAG

Der Code hält jede einzelne Behauptung der PR-Beschreibung — Fusionsstelle, Linearität, Paarungslogik,
alle neun genannten rho-Zahlen (8 Geschwister + Eiskunstlauf bei n=24, 4 Feldgrößen, n=48-Prototyp),
103/103 Vitest, Dispatcher-Exklusivität. Keine einzige Abweichung gefunden, keine Regression in den
acht Geschwister-Disziplinen, kein Fund bei den zwei offenen Entscheidungen A/B.

**Nachtrag (kein Codeaufwand, zwei Dinge vor dem Merge):**
1. `full-test-suite` und `test-and-smoke` sollten grün abgeschlossen sein, bevor gemergt wird — beide
   liefen zum Prüfzeitpunkt noch.
2. Beim Mergen von PR #858 (Breaking, `art.cypher`) — unabhängig davon, welcher der beiden PRs zuerst
   landet — entsteht ein trivialer Zeilen-Konflikt in `zeichneBuehne()`. Lösung: beide
   `if(art.cypher){…}`/`if(art.duett){…}`-Zeilen nebeneinander stehen lassen, Reihenfolge egal.

Beides ist kein Grund, den Merge dieser PR zurückzuhalten — nur zwei Dinge, die jemand am
Merge-Zeitpunkt selbst noch einmal ansieht.

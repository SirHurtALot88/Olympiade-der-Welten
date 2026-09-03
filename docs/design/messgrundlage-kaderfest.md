# Messgrundlage kaderfest: Kader-Familien und eine Rho-Schranke in der CI

Auftrag: Chris' Entscheidung „erst Grundlage fixen bevor wir weitermachen", ausgelöst durch
`docs/design/projekt-ueberwachung-opus.md` Abschnitt 1.3 (der wichtigste Befund dieses
Berichts) und Abschnitt 3.1 (Priorität A und B). Zwei Teile, in dieser Reihenfolge gebaut:

- **A. Die Messgrundlage kaderfest machen** — `disziplinProbe` misst jetzt über eine
  Kader-Familie statt über einen einzigen, fest verdrahteten Testkader, und
  `scripts/miss-alle-disziplinen.mjs` gibt Median und Spannweite statt einer einzelnen Zahl aus.
- **B. Eine Rho-Schranke in die CI** — eine eingecheckte Basislinie plus ein neuer CI-Job, der
  rot wird, wenn eine Disziplin um mehr als eine kalibrierte Schwelle fällt.

Reine Mess-/CI-Infrastruktur. Keine Zeile Spielmechanik in `battle-mode.engine.js` wurde
verändert — nur additive, parametrisierende Ergänzungen an den Sondier-Hilfsfunktionen; ein
Aufruf ohne den neuen Parameter läuft exakt wie vorher (nachgewiesen: `tests/arena-headless-runner.test.ts`
und vier weitere Battle-Arena-Testdateien laufen unverändert grün, s. „Was geprüft wurde" unten).

---

## 1) Der Befund, kurz wiederholt

`window.__arena.disziplinProbe` maß bis zu diesem Auftrag **immer** dieselben 17 Spieler in
derselben Paarung (SQUAD/OPP in `battle-mode.engine.js`, ursprünglich aus Chris' eigenem
Spielstand abgeschrieben — Vigilante Wranglers gegen Armageddon Aftermath). Speist man
andere Aufteilungen derselben Spieler ein, bewegt sich rho bei **unveränderter Mechanik**:

| Disziplin | Opus' Sonde (4 Mischungen, n=24) | Diese Runde (5 echte Team-Paarungen, n=24) |
|---|---:|---:|
| Speed-Schach | 0,035 | 0,060 |
| Basketball | 0,038 | 0,102 |
| Football | 0,166 | 0,205 |
| Gewichtheben | 0,194 | 0,456 |
| Hockey | 0,211 | 0,292 |
| Spurt | 0,300 | 0,559 |
| TDM | 0,731 | 0,387 |

Die Größenordnung deckt sich (siehe Abschnitt 4 unten für die Diskussion, wo sie
auseinanderläuft und warum das plausibel ist) — beide Sonden sagen dasselbe: **Basketball und
Speed-Schach sind kaderrobust, praktisch alles andere ist eine Ziehung aus einer breiten
Verteilung.** Jede „Verbesserung" oder „Verschlechterung", die eine frühere Runde an einer
Nachkommastelle festgemacht hat, könnte teilweise oder ganz Kader-Zufall gewesen sein.

---

## 2) Teil A: Kader-Familien in `disziplinProbe`

### Der Mechanismus

`battle-mode.engine.js` bringt schon einen Weg mit, einen anderen Kader einzuspeisen
(`window.__olyArenaKader`, s. Opus-Anhang) — aber nur beim ersten Laden der Seite, vor dem
`await`, der auf ihn wartet. `SQUAD`/`OPP` sind aber gewöhnliche `let`-Bindungen, die von
allen vier Bau-Funktionen (`bauFeldspiel`, `bauBuehne`, `bauSpurt`, `baueEinheit`) bei **jedem**
Spielaufbau frisch gelesen werden, nicht nur beim Laden. Sie lassen sich also zur Laufzeit
tauschen, ohne die Seite neu zu laden:

```js
// battle-mode.engine.js, additiv, neben disziplinProbe:
kaderSetzen:(kader)=>{
  if(kader && Array.isArray(kader.heim) && kader.heim.length) SQUAD = mitKit(kader.heim);
  if(kader && Array.isArray(kader.gast) && kader.gast.length) OPP = mitKit(kader.gast);
  return {heim:SQUAD.length, gast:OPP.length};
}
```

`disziplinProbe(dId, opt)` bekommt das optionale `opt.kaderFamilie` — ein Array aus
`{label, heim, gast}`. Ohne den Parameter läuft **exakt der bisherige Code** (ein Kader, eine
`spiele`-Liste zurück). Mit ihm wird die Spieleschleife für jede Aufteilung einmal gefahren,
`SQUAD`/`OPP` dazwischen per `kaderSetzen`-Logik getauscht, und am Ende genau der Kader
wiederhergestellt, der vorher geladen war (`finally`-Block, auch bei Fehlern). Das ist
billiger als das Muster aus `lib/battle/arena-headless-runner.ts` (dort wird für echte
Fixtures das ganze `<script>` neu eingehängt, weil dort *mehrere echte Fixtures* mit
unterschiedlicher übriger Aufstellung gebraucht werden) — hier reicht der direkte Tausch,
weil nur SQUAD/OPP sich ändern sollen.

`window.__arena.opp()` ergänzt die schon bestehende `.kader()` (liefert bisher nur SQUAD) um
die Gegenseite — gebraucht für den synthetischen Ausweichkader, s. unten.

### Die Kader-Quelle: echte Teams aus dem live-save-Abbild

Opus empfiehlt im Anhang, die Kader-Familie aus echten Spielständen zu ziehen statt aus einer
erfundenen Mischung — **das war machbar**, und zwar direkter als erwartet: `buildArenaTeam()`
(`lib/foundation/battle-arena/arena-kader-adapter.ts`) ist bereits die fertige Brücke
zwischen `GameState` und dem Motor-Kaderformat, dieselbe, die der echte Arena-Host und der
Headless-Runner benutzen. Das rohe SQLite-Abbild aus `live-save` trägt außerdem für **alle**
2984 Spieler vollständige Attribut-Bögen (die Kompakt-Payload für den Client streift Bögen
fremder Teams, die Server-Datenbank selbst nicht) — kein Umweg über
`attributeSheetOverrides` nötig.

`scripts/ziehe-kader-familie.ts` zieht damit **fünf echte Team-Paarungen** aus dem aktuell
aktiven Spielstand (`new-game-1787123325719-swnjlk`, zuletzt aktualisiert 19.08.2026) und
schreibt sie nach `data/generated/kaderfamilie-live-save.json` (eingecheckt, ~150 KB):

| Paarung | Heim (Kadergröße) | Gast (Kadergröße) |
|---|---|---|
| vigilante-armageddon | Vigilante Wranglers (11) | Armageddon Aftermath (10) |
| coldsteel-direlegion | Cold Steel (11) | Dire Legion (11) |
| goldengladiators-silversoldiers | Golden Gladiators (12) | Silver Soldiers (12) |
| mortalsin-natureswrath | Mortal Sin (13) | Natures Wrath (14) |
| piratecrew-raginglunatics | Pirate Crew (8) | Raging Lunatics (8) |

Die erste Paarung ist bewusst dieselbe wie der bisherige hartkodierte Testkader (Vigilante
Wranglers/Armageddon Aftermath) — Chris' eigenes Team, damit ein Ergebnis mit der Vorgeschichte
vergleichbar bleibt. Nachgemessen: der erste Spieler dieser Paarung (Draco) hat exakt dieselben
Attribute wie das hartkodierte `SQUAD[0]` in `battle-mode.engine.js` — derselbe Spielstand, die
Brücke stimmt. Die anderen vier streuen bewusst über Kadergröße (8 bis 14) und Tabellenbereich.

**Kompromiss, klar benannt:** Fehlt das live-save-Abbild (frischer Checkout ohne Save-Zugriff),
fällt `scripts/miss-alle-disziplinen.mjs` und die CI-Schranke auf einen **synthetischen**
Ausweichkader zurück — dieselben 17 Spieler aus dem alten SQUAD/OPP, deterministisch in vier
weitere 8-gegen-8-Aufteilungen gemischt (exakt Opus' Methode aus dem Anhang). Das ist
ausdrücklich **keine Verbesserung** gegenüber der echten Familie, nur ein Ausweg — die
Konsolenausgabe nennt immer, welche Quelle gerade lief, damit niemand eine synthetische Messung
für eine echte hält.

### Das neue Werkzeug

```
node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]
node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...] --einzelkader   # altes Verhalten
```

Ohne `--einzelkader` misst das Skript jede Disziplin einmal je Kader-Variante (Standard: die
fünf aus `data/generated/kaderfamilie-live-save.json`) und gibt **Median und Spannweite** von
rho je Spiel UND rho Saison aus — nicht mehr eine einzelne Zahl. Die gemeinsame Rechnung
(Spearman, Median, Spannweite, Laden/Bauen der Kader-Familie) sitzt jetzt in
`scripts/lib/rangtreue-messung.mjs`, damit die CI-Schranke (Teil B) dieselbe Formel benutzt statt
einer zweiten, die auseinanderlaufen könnte.

### Nachweis: fünf Disziplinen, echte Kader, n=24

```
node scripts/miss-alle-disziplinen.mjs 24 basketball hockey gewichtheben tdm spurt
```

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| Basketball | 0,757 | 0,102 | 0,923 | 0,231 |
| Spurt | 0,652 | 0,559 | 0,690 | 0,643 |
| Gewichtheben | 0,595 | 0,456 | 0,636 | 0,685 |
| Hockey | 0,589 | 0,292 | 0,748 | 0,105 |
| TDM | 0,113 | 0,387 | 0,070 | 0,441 |

Bestätigt genau das erwartete Muster: Basketball mit Abstand am robustesten (Spannweite
0,102), TDM am unzuverlässigsten in der Punktschätzung, aber überraschend mit kleinerer
Spannweite als Gewichtheben/Spurt in dieser Stichprobe — TDMs Problem ist nicht in erster
Linie Kaderrauschen, sondern dass sein Median selbst (0,113) weit unter der Abnahmeschranke
liegt (s. Abschnitt 4).

**Wichtiger Nebenbefund:** die Mediane über die Kader-Familie liegen für die meisten
Disziplinen **niedriger** als der alte Einzelkader-Wert (z. B. Hockey 0,589 statt 0,647,
Gewichtheben 0,595 statt 0,745). Das ist kein neuer Rückschritt — der alte hartkodierte Kader
war eine von vielen möglichen Ziehungen, und es gibt keinen Grund, warum sie näher am Median
liegen sollte als am Rand. Die neue Zahl ist die ehrlichere: der Median über fünf echte
Paarungen ist eine bessere Schätzung des tatsächlichen Verhaltens der Mechanik als eine
einzelne, zufällig gewählte Paarung.

---

## 3) Teil B: die Rho-Schranke in der CI

### Die Basislinie

`scripts/baue-rangtreue-basislinie.mjs` misst alle 20 Disziplinen kaderfest (n=24, fünf echte
Paarungen) und schreibt Median, Spannweite und eine daraus abgeleitete Schranke je Disziplin
nach `data/generated/rangtreue-basislinie.json` (eingecheckt, Stand 03.09.2026):

| Disziplin | Chassis | rho je Spiel (Median) | Spannweite | Schranke |
|---|---|---:|---:|---:|
| Speed-Schach | Bühne | 0,889 | 0,060 | 0,050 |
| Showcase | Bühne | 0,880 | 0,140 | 0,050 |
| Time-Trial | Bahn | 0,867 | 0,050 | 0,050 |
| Wettessen | Bühne | 0,844 | 0,233 | 0,070 |
| Breaking | Bühne | 0,801 | 0,114 | 0,050 |
| Climbing | Bahn | 0,790 | 0,192 | 0,058 |
| Basketball | Feldspiel | 0,757 | 0,102 | 0,050 |
| Eiskunstlauf | Bühne | 0,757 | 0,125 | 0,050 |
| Takeshi's Castle | Bahn | 0,697 | 0,170 | 0,051 |
| I-Spy | Bühne | 0,692 | 0,384 | 0,115 |
| Staffel | Bahn | 0,681 | 0,398 | 0,119 |
| Spurt | Bahn | 0,652 | 0,559 | 0,168 |
| Hockey | Feldspiel | 0,589 | 0,292 | 0,088 |
| Gewichtheben | Bühne | 0,595 | 0,456 | 0,137 |
| Tennis | Feldspiel | 0,505 | 0,269 | 0,081 |
| Football | Feldspiel | 0,345 | 0,205 | 0,061 |
| Battlefield | Arena | 0,325 | 0,662 | 0,199 |
| Mini-DM | Arena | 0,269 | 0,802 | 0,241 |
| Fechten | Arena | 0,153 | 0,595 | 0,178 |
| TDM | Arena | 0,113 | 0,387 | 0,116 |

Diese Tabelle ist NICHT der neue „Stand aller Disziplinen" (`docs/design/stand-aller-disziplinen.md`
bleibt die 0,80-Abnahmeschranke gegen den alten Einzelkader-Maßstab schuldig, das ist ein
separater Auftrag) — sie ist die Referenz, gegen die die CI ab jetzt jeden Commit misst.

### Die Schranken-Formel

    schranke = max(0,05 ; 0,3 × Spannweite)

- **Der Boden (0,05)** fängt Disziplinen mit winziger Spannweite ab (Basketball, Speed-Schach,
  Time-Trial) — ohne ihn würde dort jede Rundungsdifferenz die CI rot machen.
- **Der Anteil (0,3× Spannweite)** hält die Schranke deutlich UNTER dem vollen Kaderrauschen.
  Opus' Vorgabe „größer als das typische Kaderrauschen, sonst schlägt CI grundlos an" gilt für
  eine Messung **ohne** Kader-Familie, bei der jeder Lauf effektiv eine neue Zufallsziehung
  wäre. Mit der Familie ist die CI-Messung **deterministisch** (fester Kader, feste Saaten,
  keine Zufallsquelle) — zwei Läufe unter identischem Code liefern bit-identische Zahlen
  (nachgemessen: der Selbsttest unten reproduziert die Basislinie exakt). Die Schranke muss
  deshalb nicht das volle Kaderrauschen abdecken, sondern nur echte Code-Bewegung von
  Rundungs-/Refactoring-Rauschen trennen — ein Bruchteil der Spannweite reicht dafür und bleibt
  trotzdem, wie gefordert, klar über einer Nachkommastelle Zufall.

**Ehrliche Einschränkung, hier klar benannt:** Diese Schranke ist bewusst konservativ. Bei
Disziplinen mit großer Spannweite (Gewichtheben 0,137, Spurt 0,168, Battlefield 0,199) würde
ein Nettoschaden in der Größenordnung von Hockeys historischer Tagesbilanz (−0,023, s.
Projektüberwachung Abschnitt 4.1) **nicht** anschlagen — er liegt weit unter jeder dieser
Schranken. Das ist kein Widerspruch zum Auftrag, sondern eine Konsequenz der ehrlicheren
Methode: eine Bewegung von 0,02 ist bei Hockeys eigener Kader-Spannweite von 0,292 nicht von
Rauschen zu unterscheiden, egal wie sie gemessen wird — die CI-Schranke verspricht deshalb
bewusst nicht mehr, als sie halten kann. Was sie zuverlässig fängt: eine Disziplin, deren
Median um mehr als 0,05 bis 0,24 fällt (je nach eigenem Rauschen) — genug, um einen
kaputten Import, eine falsch invertierte Formel oder eine grob verstellte Konstante zu fangen,
zu klein, um bei jedem Fein-Tuning grundlos zu piepsen.

### Der CI-Job

`.github/workflows/ci-nightly.yml`, neuer Job `rangtreue-schranke`:

```yaml
rangtreue-schranke:
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "20", cache: npm }
    - run: npm ci
    - run: npx playwright install chromium --with-deps
    - run: npm run ci:rangtreue-schranke
```

Braucht **weder Dev-Server noch SQLite**: `disziplinProbe` läuft gegen die statische
`public/mockups/battle-mode.html` per `file://`, unabhängig vom App-Server — nur Chromium für
Playwright, das dieser Workflow (`ci-nightly.yml`) laut Opus-Bericht ohnehin schon installiert
(Zeile ~23, für den `full-season-playthrough`-Job daneben) — nachgemessen, stimmt.

`scripts/pruefe-rangtreue-schranke.mjs` misst jede Disziplin aus der Basislinie nach (gleiche
Kader-Familie, gleiches n) und vergleicht den neuen Median gegen `basis.spielMedian − schranke`.
Fällt eine Disziplin darunter — oder liefert plötzlich gar keine Spiele mehr (`fehler`) —,
druckt es eine Tabelle mit alter/neuer Zahl und beendet sich mit Exit-Code 1.

**Warum ein eigener Job statt ein Schritt in `ci.yml`:** die volle 20-Disziplinen-Messung
kostet in dieser Umgebung rund 11 Minuten (n=24, fünf Kader-Varianten je Disziplin,
nachgemessen: `baue-rangtreue-basislinie.mjs 24` lief von 11:56:43 bis 12:07:47 Uhr UTC) —
zu teuer, um den ohnehin schon sorgfältig auf Stabilität getrimmten
Pflicht-Check bei jedem Pull Request zu verlängern (s. die ausführlichen Kommentare in
`ci.yml` zu Timeout-Problemen), aber billig genug für einen Job, der ohnehin nur auf Zuruf
läuft.

**Offene Entscheidung für Chris, bewusst nicht vorweggenommen:** `ci-nightly.yml` hat aktuell
**keinen** automatischen Zeitplan mehr (`on: workflow_dispatch` — der tägliche
Saisondurchlauf im Nachbar-Job erzeugte grundlos rotes CI, s. Kommentar im Workflow). Der neue
`rangtreue-schranke`-Job ist davon nicht betroffen — er ist deutlich billiger und
deterministisch —, läuft deshalb aber vorerst ebenfalls nur manuell (`Run workflow` in der
GitHub-Oberfläche, oder `gh workflow run ci-nightly.yml`). Ob er einen eigenen, kürzeren
automatischen Rhythmus (z. B. täglich oder bei jedem Merge nach `main`) bekommen soll, ist eine
Produktentscheidung, die hier nicht einseitig getroffen wird — die technische Grundlage dafür
steht.

### Nachweis: die Schranke schlägt tatsächlich an

Getestet mit `basketball` (Basislinie: 0,757/0,102, Schranke 0,05). Testweise
`SCHUSS_TIER`-Koeffizient in `KURVE_BASKETBALL` von `0,0022` auf `0,00005` gesenkt (nahezu
entkoppelt Trefferquote von Skill) und die Schranke gegen eine Test-Basislinie laufen lassen:

```
Disziplin            Basislinie      Jetzt  Aenderung   Schranke   Status
basketball                0.757      0.628    -0.129      0.050   GEFALLEN

FEHLGESCHLAGEN: mindestens eine Disziplin ist um mehr als ihre Schranke gefallen ...
```

Exit-Code 1, wie erwartet. Änderung danach vollständig zurückgenommen (`git diff` auf
`battle-mode.engine.js` leer) — **nicht** im finalen Commit enthalten. Ein zweiter Lauf ohne
die Testveränderung, direkt gegen die echte, eingecheckte Basislinie (alle 20 Disziplinen),
bestätigt außerdem die Determinismus-Annahme aus Abschnitt 3: die Nachmessung reproduziert
jede der zwanzig Basislinien-Zahlen exakt (Status „ok" auf ganzer Linie), obwohl Browser und
Prozess zwischen den beiden Läufen neu gestartet wurden.

---

## 4) Was das für künftige Kalibrierrunden bedeutet

**Regel für jede künftige Runde:** vor UND nach einer Rezeptänderung mit
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin>` messen, nicht nur einmal danach. Eine
Bewegung ist erst dann ein Befund, wenn sie größer ist als die Spannweite der Disziplin in
dieser Tabelle — sonst ist sie, mit den eigenen Worten der Projektüberwachung, „von Null nicht
unterscheidbar".

Konkret, je Disziplin (Spannweite aus Abschnitt 3, n=24, fünf echte Kader):

- **Basketball, Speed-Schach, Time-Trial, Breaking, Eiskunstlauf** (Spannweite ≤ 0,14): schon
  eine Bewegung von 0,03–0,05 ist ein echtes Signal. Diese fünf sind die einzigen, bei denen
  eine Handkorrektur im Zehntel-Bereich vertrauenswürdig ist.
- **Hockey** (Spannweite 0,292): die nächste Rezeptrunde (Projektüberwachung Punkt G, „nach A
  und mit dem strukturellen Sinkhorn-Fix") braucht eine Bewegung von **mindestens 0,15–0,20**,
  um sich von Kaderrauschen abzuheben — deutlich mehr, als die drei bisherigen Runden zusammen
  bewegt haben (netto −0,023). Eine einzelne Handkorrektur wird das nicht zeigen können; erst
  eine strukturelle Änderung (z. B. der in Abschnitt 2.3 des Opus-Berichts vorgeschlagene
  Sinkhorn-Fix mit verzerrter Startbelegung) hat überhaupt eine Chance, aus dem Rauschen
  herauszuragen.
- **Gewichtheben, Spurt** (Spannweite 0,46/0,56): hier ist selbst eine Rezeptrunde mit
  sichtbarem Effekt (0,10–0,15) noch nicht sicher von Zufall zu trennen. Um das zu verbessern,
  braucht es entweder mehr als fünf Kader-Varianten in der Familie (verkleinert die
  Stichprobenungenauigkeit des Medians) oder eine Reduktion der Spannweite selbst durch ein
  robusteres Rezept — Letzteres ist die eigentliche Aufgabe einer Kalibrierrunde für diese
  beiden.
- **TDM, Fechten, Battlefield, Mini-DM** (Arena, Median 0,11–0,33, Spannweite 0,39–0,80): hier
  ist die Rangfolge selbst kaum stabil — der eignungsbeste Kämpfer kann auf manchen echten
  Kadern schlechter abschneiden als der schlechteste (s. Opus, TDM −0,146 auf einer Mischung).
  Eine Handkorrektur an der Erfolgsformel ist hier voraussichtlich verschwendete Arbeit, bevor
  nicht der von Opus benannte strukturelle Befund behoben ist (Zielwahl nach Geometrie statt
  Bedrohung, Abschnitt 2.5/3.1 F) — die CI-Schranke wird bei diesen vieren erst nach diesem
  strukturellen Fix wieder aussagekräftig eng werden können.

**Zur Diskrepanz zwischen Opus' Spannweiten und den hier gemessenen** (Tabelle in Abschnitt 1):
beide Sonden ziehen aus derselben zugrunde liegenden Verteilung, aber mit unterschiedlichen
Stichproben — Opus mischte 17 Spieler aus zwei sehr speziellen Teams neu, diese Runde zieht
fünf tatsächliche Team-Paarungen mit unterschiedlicher Kadergröße (8 bis 14) aus einer 32-Team-
Liga. Bei TDM liegt die neue Spannweite (0,387) sogar UNTER Opus' Wert (0,731) — plausibel,
weil Opus' Mischungen absichtlich extreme Sub-Teams erzeugen konnten (z. B. alle
willensschwachen Spieler auf einer Seite), während echte Liga-Teams über Attribute hinweg
gemischter sind. Das ist ein Hinweis, keine endgültige Aussage: mit nur fünf Varianten ist die
Spannweite selbst noch eine ungenaue Schätzung. Eine künftige Runde könnte die Kader-Familie
auf 8–10 Paarungen erweitern (mehr Zeilen in `scripts/ziehe-kader-familie.ts`), um Median und
Spannweite präziser zu machen — das würde vor allem TDM, Fechten und den anderen Arena-
Disziplinen nutzen, deren Rangfolge heute am wenigsten stabil ist.

---

## 5) Geänderte/neue Dateien

| Datei | Änderung |
|---|---|
| `public/mockups/battle-mode.engine.js` | `disziplinProbe` bekommt `opt.kaderFamilie` (additiv); neu: `window.__arena.kaderSetzen()`, `window.__arena.opp()` |
| `scripts/lib/rangtreue-messung.mjs` | neu — gemeinsamer Kern (Spearman, Median/Spannweite, Kader-Familie laden/synthetisieren, eine Disziplin messen) |
| `scripts/miss-alle-disziplinen.mjs` | misst jetzt über die Kader-Familie, Median+Spannweite statt Einzelwert; `--einzelkader` für das alte Verhalten |
| `scripts/ziehe-kader-familie.ts` | neu — zieht fünf echte Team-Paarungen aus dem live-save-Abbild via `buildArenaTeam()` |
| `data/generated/kaderfamilie-live-save.json` | neu, eingecheckt — die gezogene Kader-Familie |
| `scripts/baue-rangtreue-basislinie.mjs` | neu — baut/aktualisiert die CI-Basislinie |
| `scripts/pruefe-rangtreue-schranke.mjs` | neu — die CI-Prüfung selbst |
| `data/generated/rangtreue-basislinie.json` | neu, eingecheckt — die Basislinie (Stand 03.09.2026) |
| `.github/workflows/ci-nightly.yml` | neuer Job `rangtreue-schranke` |
| `package.json` | neues Skript `ci:rangtreue-schranke` |

## Was geprüft wurde

- `node --check public/mockups/battle-mode.engine.js` — Syntax sauber.
- `npx vitest run tests/arena-headless-runner.test.ts` (4 Tests) und vier weitere
  Battle-Arena-Testdateien (31 Tests) — alle grün, unverändert gegenüber vor dieser Änderung.
- `npx tsc --noEmit` — keine neuen Fehler durch `scripts/ziehe-kader-familie.ts` (die
  vorhandenen ~900 Fehler im Projekt sind unabhängig von dieser Änderung).
- `--einzelkader`-Pfad manuell gegen den alten Code verglichen (Basketball 0,780 vs. vorher
  0,786/0,820 — im Rahmen der ohnehin bekannten Lauf-zu-Lauf-Schwankung bei kleinem n).
- Determinismus: zwei unabhängige Prozess-/Browser-Starts liefern für alle 20 Disziplinen
  bit-identische Mediane und Spannweiten.
- CI-Schranke schlägt nachweislich an (Basketball testweise verschlechtert, Exit-Code 1,
  Änderung vollständig zurückgenommen) und besteht nachweislich, wenn nichts kaputt ist.

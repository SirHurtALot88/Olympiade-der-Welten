# Projektüberwachung: eine unabhängige Bestandsaufnahme

Stand: 03.09.2026, Branch `claude/projekt-ueberwachung-opus`, abgezweigt von
`origin/claude/sonde-alle-disziplinen` `cca5df36` (dem Stand nach Basketball-Visuals,
Hockey-Mechanik/Erfolgskurve/Rezept und der Football-Recherche).

Chris' Auftrag, wörtlich: *„sende einen Opus-Agenten der das ganze Projekt mal
overseer-mäßig checkt und selber Vorschläge einbringt was noch getan werden müsste, damit
wir einen Projektmanager haben."*

Dieser Bericht schreibt **nichts** aus `stand-aller-disziplinen.md` ab. Jede Zahl unten ist
entweder heute selbst gemessen (mit Befehl), aus dem Code zitiert (Datei:Zeile) oder als
fremde Angabe markiert. Ich habe keine Zeile Code geändert.

**Die vier Befunde, die die Prioritäten umwerfen — vorab, damit sie nicht untergehen:**

1. **Die Abnahmezahl hängt am Testkader, und zwar stärker als an jeder Motorarbeit dieser
   Woche.** `disziplinProbe` misst immer dieselben 17 Spieler in derselben Paarung. Speist
   man andere Aufteilungen derselben 17 ein, schwankt TDM zwischen **−0,15 und 0,59**,
   Spurt zwischen **0,56 und 0,86**, Hockey zwischen **0,52 und 0,73** (Abschnitt 1.3).
   Alles, was diese Woche als „besser" oder „schlechter" verbucht wurde, liegt innerhalb
   dieser Spanne.
2. **Die Rangtreue erreicht das echte Spiel überhaupt nicht.** Der Boxscore, den der
   Live-Motor liefert, wird berechnet, typisiert, getestet — und von niemandem gelesen.
   Individuelle Spieler-PPs kommen weiter aus der alten PPS-Rangtabelle (Abschnitt 1.4).
3. **rho ist gegenläufig zur mechanischen Tiefe.** Die fünf besten Zahlen gehören den fünf
   primitivsten Disziplinen. Die Tabelle lädt damit zum genauen Gegenteil der richtigen
   Schlussfolgerung ein (Abschnitt 1.2).
4. **Ein ganzer Arbeitstag Hockey hat rho je Spiel von 0,670 auf 0,647 gesenkt** — jeder
   Einzelbericht war ehrlich, die Kette war es in der Summe nicht (Abschnitt 4.1).

---

## 1. Der ehrliche Gesamtstand

### 1.1 Heute selbst gemessen

    node scripts/miss-alle-disziplinen.mjs 24        (alle zwanzig)
    node scripts/miss-alle-disziplinen.mjs 48 hockey basketball football tennis mini-dm \
         battlefield tdm fechten gewichtheben spurt staffel i-spy showcase

| Disziplin | Chassis | rho je Spiel (n=24) | rho Saison (n=24) | n=48 | Abnahme | `stand-aller` (02.09.) |
|---|---|---:|---:|---:|---|---:|
| Speed-Schach | Bühne | 0,950 | 0,986 | — | bestanden | 0,950 |
| Wettessen | Bühne | 0,921 | 0,979 | — | bestanden | 0,921 |
| Time-Trial | Bahn | 0,902 | 0,998 | — | bestanden | 0,902 |
| Eiskunstlauf | Bühne | 0,892 | 0,958 | — | bestanden | 0,892 |
| Breaking | Bühne | 0,891 | 0,993 | — | bestanden | 0,891 |
| Climbing | Bahn | 0,846 | 0,900 | — | bestanden | 0,846 |
| Takeshi's Castle | Bahn | 0,842 | 0,958 | — | bestanden | 0,842 |
| **Basketball** | Feldspiel | **0,820** | 0,881 | 0,821 | **bestanden** | 0,786 (knapp) |
| Showcase | Bühne | 0,784 | 0,825 | 0,799 | knapp | 0,784 |
| I-Spy | Bühne | 0,776 | 0,776 | 0,771 | knapp | 0,776 |
| Staffel | Bahn | 0,757 | 0,818 | 0,755 | knapp | 0,757 |
| Spurt | Bahn | 0,745 | 0,762 | 0,758 | knapp | 0,745 |
| Gewichtheben | Bühne | 0,745 | 0,839 | 0,757 | knapp | 0,745 |
| Mini-DM | Arena | 0,658 | 0,786 | 0,650 | durchgefallen | 0,658 |
| **Hockey** | Feldspiel | **0,647** | 0,860 | 0,626 | durchgefallen | 0,670 |
| Tennis | Feldspiel | 0,605 | 0,762 | 0,607 | durchgefallen | 0,605 |
| TDM | Arena | 0,506 | 0,587 | 0,473 | durchgefallen | 0,506 |
| Fechten | Arena | 0,495 | 0,559 | 0,499 | durchgefallen | 0,495 |
| Battlefield | Arena | 0,470 | **0,714** | 0,449 | durchgefallen | 0,470 / 0,500 |
| Football | Feldspiel | 0,307 | 0,776 | 0,286 | durchgefallen | 0,307 |

**Acht bestehen, fünf sind knapp, sieben fallen durch.** Gegenüber dem 02.09. haben sich
genau zwei Zeilen bewegt, und sie zeigen in verschiedene Richtungen: Basketball ist über die
Schranke gerutscht (0,786 → 0,820), Hockey ist nach drei Arbeitsrunden **unter** seinen
Ausgangswert gefallen (0,670 → 0,647).

**Basketballs Sprung stammt aus einem Bilder-Commit — nachgemessen, nicht vermutet.** In
einem Wegwerf-Worktree auf `805a4649` (der Commit unmittelbar vor der Korb-Verschiebung)
liest Basketball **0,786 / 0,881**; auf `999d3aef` („Korb an die Grundlinie, Ball in der
Hand, Dribbel-Kurve umgedreht") **0,820 / 0,881**. Der Korb elf Pixel weiter zur Grundlinie
verschiebt die Distanzstufen und damit die Trefferquoten — **+0,034 durch eine Änderung, die
als Optik geplant war.** Zum Vergleich: die drei bewusst auf Balance zielenden Hockey-Runden
desselben Tages bewegen zusammen −0,023. Die Commit-Nachricht führt sogar Messungen auf
(`miss-arena-feldspiel-spiegel.mjs`, `miss-basketball-rangtreue.mjs`) — nur nicht die eine,
die es gemerkt hätte. Das ist Punkt 2 aus Abschnitt 5 in einem Satz.

Zwei Korrekturen an `stand-aller-disziplinen.md`, die dort im Widerspruch zum eigenen Text
stehen: Battlefields Saisonzahl liest heute **0,714**, nicht 0,500 — Abschnitt 5a desselben
Dokuments sagt es selbst („Validität von 0,50 auf 0,71"), die Tabelle darüber wurde nicht
nachgezogen. Und Football hat inzwischen ein **eigenes Feld** (`bodenFeldspiel`,
`engine.js:8368-8384`: zwei Endzonen, Yard-Raster, Mittellinie) — die Aussage „eigene Arenen
haben genau zwei Disziplinen" ist seit dem 03.09. falsch, es sind drei.

### 1.2 Die Tabelle sagt das Gegenteil von dem, was sie zu sagen scheint

Sortiert man nach rho, steht ganz oben Speed-Schach (0,950) und ganz unten Football (0,307).
Wer die Tabelle als Reifegrad liest, schließt daraus: Speed-Schach ist fast fertig, Football
ist Schrott. Beides ist falsch herum.

**Die sechs Bühnen-Disziplinen teilen sich EINE hartkodierte Punkteformel** — drei Zeilen,
für Showcase, Eiskunstlauf, Breaking, Wettessen, Speed-Schach und I-Spy zeichengleich:

```js
// engine.js:9045-9049
const basis  = (20 + L.GRUNDLAGE*0.7) * Math.max(0.4, ermued);
const erfolg = Math.min(0.94, 0.15 + L.TECHNIK*0.0055 + L.NERVEN*0.0035);
punkte       = basis + L.SPITZENMOMENT*0.35*(0.4 + L.WAGNIS*0.006);
```

Diese Formel ist glatt, monoton in ihren Sub-Skills und rauscharm. Genau deshalb liefert sie
Spitzen-rho: eine Rangkorrelation belohnt eine Mechanik, die kaum etwas passieren lässt.
Basketball dagegen — die einzige Disziplin mit Live-Motor, Zonen, Manndeckung,
Schiedsrichter, Spielzügen und einer gegen 1074 echte NBA-Würfe kalibrierten Erfolgskurve —
kommt auf 0,820, weil ein echtes Spiel Rauschen erzeugt.

**Konsequenz für die Projektsteuerung:** rho misst „belohnt die Mechanik das Richtige",
nicht „ist die Disziplin fertig". Die Prozenttabelle in `stand-aller-disziplinen.md`
Abschnitt 5b weiß das (Speed-Schach steht dort bei 45 %, Basketball bei 90 %) — aber die
rho-Tabelle steht vorn und die Prozente hinten. **Empfehlung:** die beiden Tabellen
zusammenlegen, mit einer Spalte „eigene Mechanik ja/nein" direkt neben rho. Sonst optimiert
irgendwann jemand die falsche Zahl.

### 1.3 Der wichtigste Befund: die Abnahmezahl hängt am Testkader

`window.__arena.disziplinProbe` (`engine.js:16434`) variiert je Spiel die Saat und die
Formkarten — aber **nie den Kader**. Gemessen wird immer `SQUAD` gegen `OPP`
(`engine.js:2601` und `:2627`): elf Vigilante Wranglers gegen sechs Armageddon Aftermath,
ein einziger, eingefrorener Ausschnitt aus Chris' Spielstand von Saison 2, Spieltag 10.

Das ist kein akademischer Einwand. Der Motor bringt einen offiziellen Weg mit, andere Kader
einzuspeisen (`window.__olyArenaKader`, `engine.js:2675-2676`). Ich habe dieselben 17
Spieler in vier weitere 8-gegen-8-Aufteilungen gemischt und dieselbe Zahl noch einmal
gemessen (Sonde im Anhang, `n=24`, identische Saaten und Formkarten):

| Disziplin | Original | Mischung 1 | Mischung 2 | Mischung 3 | Mischung 4 | **Spannweite** |
|---|---:|---:|---:|---:|---:|---:|
| Speed-Schach | 0,950 | 0,944 | 0,941 | 0,920 | 0,955 | **0,035** |
| Basketball | 0,820 | 0,857 | 0,819 | 0,837 | 0,853 | **0,038** |
| Football | 0,307 | 0,402 | 0,425 | 0,473 | 0,332 | **0,166** |
| Gewichtheben | 0,745 | 0,691 | 0,853 | 0,885 | 0,708 | **0,194** |
| Hockey | 0,647 | 0,520 | 0,673 | 0,731 | 0,713 | **0,211** |
| Spurt | 0,745 | 0,564 | 0,836 | 0,615 | 0,864 | **0,300** |
| TDM | 0,506 | 0,297 | **−0,146** | 0,585 | 0,544 | **0,731** |

Was daraus folgt, ist unbequem:

- **Genau zwei Disziplinen sind kaderrobust: Basketball und Speed-Schach.** Die eine, weil
  sie als einzige eine echte Kalibrierrunde hinter sich hat; die andere, weil sie fast keine
  Mechanik hat. Alles dazwischen ist überangepasst an einen Kader.
- **Gewichtheben und Spurt sind nicht „knapp", sie sind unbekannt.** Beide liegen auf zwei
  von fünf Kadern über 0,80 und auf zwei anderen unter 0,72. Auf dem Referenzkader lesen sie
  0,745 — das ist eine Ziehung, keine Eigenschaft.
- **TDM wird auf einem Kader negativ.** Eine Rangtreue von −0,146 heißt: der Eignungsbeste
  schneidet systematisch schlechter ab als der Eignungsschlechteste. Auf dem Referenzkader
  fällt das nicht auf.
- **Hockeys Tagesbilanz (0,670 → 0,647, also 0,023) ist eine Größenordnung kleiner als
  Hockeys Kaderrauschen (0,211).** Alle drei Hockey-Berichte dieser Woche haben Änderungen
  von 0,005 bis 0,04 als Erfolg oder Rückschlag verbucht. Keine dieser Bewegungen ist von
  Null unterscheidbar.

Und ein zweiter Befund derselben Sonde: das **Rezept selbst** wurde auf diesen Kader
kalibriert. `hockey-rezept-ursache.md` Abschnitt 2 begründet seinen Fix ausdrücklich damit,
dass „power 0,68, speed −0,06, spirit −0,34" mit der Eignung korrelieren — gemessen „auf dem
festen Testkader". Das ist die Korrelationsstruktur von 17 sehr eigentümlichen Spielern (Lava
Golem hat Intelligenz 1 und Geschick 2, Lulu hat Stärke 3 und Leben 5), nicht die einer
Liga. Der Fix ist sauber hergeleitet und im Ergebnis auf diesem Kader nachweisbar besser —
aber er ist an eine Stichprobe von einem Team gefittet.

### 1.4 Die größte Lücke: der Motor erreicht das Spiel nicht

`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:32`) enthält
**einen** Eintrag: `"basketball"`. Neunzehn Disziplinen laufen ausschließlich im Mockup —
darunter Hockey, das eine eigene Eisfläche, einen Torwart, Bodychecks, Strafen und Überzahl
hat und diese Woche drei Arbeitsrunden bekam.

Schlimmer ist die Stelle darunter. Der Live-Motor liefert für jedes Duell einen Boxscore
(`spieleFeldspiel`, `engine.js:16064 ff.`), der Runner reicht ihn durch
(`lib/battle/arena-headless-runner.ts:335`), zwei Testdateien prüfen seine Struktur — und
dann:

    grep -rn "boxscore" --include=*.ts --include=*.tsx lib/ app/ components/
        → nur arena-headless-runner.ts selbst

**Der Boxscore wird nirgends gelesen.** Die individuellen Spielerpunkte kommen weiter aus
`distributeRankPointsToPlayers` auf Basis von `entry.finalContribution ?? entry.score`
(`lib/resolve/legacy-matchday-resolve-engine.ts:755-763`), also aus der alten
PPS-Rangtabelle. Der Kommentar in `battle-mode-arena-team-points.ts:14-19` sagt es selbst:
individuelle PPs bleiben „bewusst noch nicht umgesetzt" auf dem alten Pfad.

Das heißt konkret: **die gesamte Rangtreue-Arbeit dieses Projekts hat auf Chris' Spielstand
heute null Wirkung.** Ob der eignungsbeste Spieler im simulierten Spiel den besten Boxscore
produziert, ändert für ihn genau nichts — weder an den Spielerpunkten noch an der Entwicklung
noch an der Tabelle (dort wirkt nur der 2/1/0-Ausgang). Von den vier Achsen, die
`stand-aller-disziplinen.md` gewichtet, ist die mit 40 % gewichtete (Rangtreue) heute mit der
mit 15 % gewichteten (im echten Spielstand) multiplikativ verkoppelt — und der zweite Faktor
ist für 19 von 20 Disziplinen null.

### 1.5 Wo Motor und Fertigstellung am weitesten auseinanderklaffen

| Achse | Ist-Stand, nachgesehen |
|---|---|
| Rangtreue | 8 von 20 bestehen — aber nur 2 von 20 sind gegen Kaderwechsel robust |
| Eigene Mechanik | 2 von 20 haben einen Live-Motor (Basketball, Hockey); 6 Bühnen-Disziplinen teilen sich drei Zeilen Punkteformel |
| Bild | 3 von 20 haben ein eigenes Feld (Basketball, Hockey, Football); 7 Bühnen-Disziplinen teilen sich ein Podest mit drei Scheinwerfern (`bodenBuehne`, `engine.js:9379-9393`) — kein Hantelsteg, kein Schachbrett, kein Eis |
| Bewegung | eigene Bewegungen nur im Eishockey; Basketballs Ballträger hat bis heute keine Trage-Pose (`basketball-finalisierung-recherche-fable.md`, Abschnitt 2) |
| Im Spielstand | 1 von 20 — und auch dort nur das Team-Ergebnis, nicht der Boxscore |

**Die größte Lücke ist nicht mechanisch, sie ist visuell und produktiv.** Die sieben
Bühnen-Disziplinen haben zusammen die besten Abnahmezahlen des ganzen Projekts (vier von
sieben bestanden, keine durchgefallen) und sehen alle exakt gleich aus. Das ist die
billigste verfügbare Umwandlung von „gemessen gut" in „für Chris sichtbar fertig".

---

## 2. Muster: was in vier Chassis gleichzeitig schiefging — und wo es noch steckt

Der Befund, den `stand-aller-disziplinen.md` Abschnitt 3 dokumentiert (`p.d[disziplin] || 0`
in allen vier Baufunktionen), ist kein Einzelfall, sondern die Signatur des ganzen Projekts:
**eine Eigenschaft wird für eine Disziplin gebaut, von den anderen geerbt, und niemand fragt
nach, ob das Erbe passt.** Ich habe drei weitere aktive Instanzen desselben Musters gefunden.

### 2.1 Die Eignungslücke ist nicht ganz geschlossen

Die vier Baufunktionen sind repariert. Eine fünfte Fundstelle steht unverändert im Code:

```js
// engine.js:9988 — Aufstellungs-Ansicht, Slot-Vorschlag "Besser wäre / Bester Freier"
const abs = (b.p.d[disc] || 0) + b.m;
```

Das ist Anzeige, keine Mechanik — aber es ist die Zahl, an der ein Spieler ablesen soll, was
ein Kandidat auf diesem Slot wert wäre. Für achtzehn der zwanzig Disziplinen zeigt sie heute
nur den Slot-Aufschlag, also typischerweise −5 bis +10 statt eines Eignungswerts. Aufwand:
eine Zeile, dieselbe Ersetzung wie in den vier anderen Fundstellen.

### 2.2 Die geteilte Erfolgskurve: gelöst für Feldspiel, offen für Bühne, Bahn und Arena

Chris hat es allgemein gesagt — *„ja jede diszi braucht eine eigene success kurve!"*. Für das
Feldspiel ist daraus Struktur geworden: `FELDSPIEL_ART[d].kurve` mit Rückfall auf
`KURVE_BASKETBALL` (`engine.js:3880 ff.`), und Hockey hat seit dem 03.09. einen eigenen
Block. Football und Tennis fahren weiter Basketballs Kurve — das ist bekannt und in der
Football-Recherche als Auflage notiert.

**Für die anderen drei Chassis gibt es diese Struktur nicht.** Es gibt keinen
`BUEHNE_ART[d].kurve`, keinen `BAHN_ART[d].kurve`, keinen `ARENA_ART[d].kurve`. Die
Bühnen-Formel oben (`engine.js:9045-9049`) ist für sechs Disziplinen dieselbe, mit
handgesetzten Konstanten (0,15 / 0,0055 / 0,0035 / 0,7 / 0,35 / 0,006 / 0,12), die gegen
keinerlei reale Referenz kalibriert sind. Das ist wörtlich derselbe Zustand, in dem Hockey
war, bevor es drei Runden brauchte, um ihn zu erkennen — nur sechsfach.

**Das ist meine Hauptantwort auf die Frage nach systematischen Lücken in noch nicht
angefassten Disziplinen: sie steckt genau hier, sie ist belegt, und sie betrifft sechs
Disziplinen auf einmal.**

### 2.3 Die Sinkhorn-Lücke ist real — aber kleiner als der Kader-Effekt

`hockey-rezept-ursache.md` Abschnitt 2 ist eine der besten Ursachenanalysen im Repo: Sinkhorn
balanciert Zeilen- und Spaltensummen, kann aber die Nebenbedingung „dieses Attribut soll das
führende bleiben" nicht ausdrücken, und die Kontrollrechnung („0,00 Pp Abweichung") merkt es
nicht. Der Befund stimmt.

**Zwei Einschränkungen, die der Bericht selbst nicht zieht:**

Erstens ist `scripts/baue-feldspiel-rezept.mjs` heute nur für **Hockey** benutzbar: `MATRIX`
und `ERLAUBT` (Zeilen 30-54) enthalten je genau einen Eintrag, `hockey`. Die Sondierung
dazu (`sondiere-feldspiel-subskills.mjs`) ist per Konstruktion Feldspiel-only. Damit ist die
Empfehlung aus `stand-aller-disziplinen.md` Abschnitt 5, Punkt 4 — *„Die sechs Knappen
brauchen je eine Rezeptrunde nach Chris' Budget-Methode
(`scripts/baue-feldspiel-rezept.mjs`)"* — **heute nicht ausführbar**: fünf der sechs Knappen
sind Bühne oder Bahn, und für kein Bühnen- oder Bahn-Rezept existiert eine Sondierung oder
eine Erlaubt-Tabelle. Wer den Punkt umsetzen will, baut zuerst die Werkzeuge.

Zweitens: der Fix wurde gegen eine Attributs-Eignungs-Korrelation gefittet, die auf einem
anderen Kader anders aussieht (Abschnitt 1.3). Eine strukturelle Lösung („dem deklarierten
Führungsattribut eine verzerrte Startbelegung geben", wie der Bericht selbst vorschlägt) ist
deshalb der Handkorrektur klar vorzuziehen — sie ist kaderunabhängig, die Handkorrektur ist
es nicht.

### 2.4 Chassis-Zuordnungen, die nie hinterfragt wurden

Alle sieben durchgefallenen Disziplinen liegen in genau zwei Chassis: Feldspiel (3) und
Arena (4). Keine einzige Bühnen- oder Bahn-Disziplin fällt durch. Das ist kein Zufall, und
bei zwei Disziplinen ist die Ursache nachweislich die falsche Chassis-Wahl:

**Tennis.** `FELDSPIEL_ART.tennis` (`engine.js:3890-3912`) trägt `jeSeite:6`,
`fernAnteil:0`, `punkteNah:1` — sechs gegen sechs, keine Aufschlagsseite, kein Netz, keine
Sätze, kein Ballwechsel. Der Kommentar sagt es selbst: *„Kein echtes ‚Team' — die sechs
tragen abwechselnd den Ballwechsel aus, wie eine Setzliste."* Tennis ist strukturell ein
Reihen-Duell, genau wie Speed-Schach und I-Spy — und die fahren beide die
**Bühnen-Duell-Variante** (`art.duell`, `engine.js:9074 ff.`) und lesen 0,950 und 0,776.

**Fechten.** Fable hat das in `arena-duell-recherche-fable.md` bereits mit realen Zahlen
begründet (15 Treffer in 3×3 min, 17,9 s Arbeitszeit je Aktion, Einzelduell) und empfiehlt
ausdrücklich die Bühnen-Duell-Variante. Fechten liest heute 0,495 in der Arena.

Beides sind Umzüge auf ein bestehendes, gemessen funktionierendes Chassis, keine neuen
Motoren. Ich halte das für zwei der billigsten offenen Gewinne im ganzen Projekt.

### 2.5 Die Arena misst sich teilweise selbst — und fällt trotzdem durch

Ein methodischer Befund, der die Arena-Zahlen schlechter macht, als sie aussehen: in der
Arena geht `eig` über `aufEignung()` (`engine.js:3392`) direkt in die Kampfwerte —
`ziel = referenz * (eig/50)`, alle drei Kampfwerte werden mit demselben Faktor skaliert. Die
Eignung bestimmt dort also die Stärke, und die Sonde korreliert anschließend die Eignung
gegen das Ergebnis dieser Stärke.

Im Feldspiel ist das ausdrücklich nicht so: dort ist `eig` ein reiner Referenzwert
(`engine.js:4728-4740` — `eig:basisWert+engP+breitP`, die Mechanik rechnet aus den
Sub-Skills `R2`), und `.eig` wird im ganzen Motor nur noch von Anzeigen, Berichten und der
Sonde gelesen. Auf der Bahn sagt der Kommentar es wörtlich (`engine.js:13214-13216`): *„Das
VERHALTEN der Rennen aendert sich dadurch nicht: die Laufwerte kommen aus dem Rezept (R2),
nicht aus `eig`."*

**Folge:** rho ist zwischen den Chassis nicht vergleichbar. Die Arena-Zahl ist strukturell
nach oben verzerrt — und liegt trotzdem bei 0,47 bis 0,66. Der Arena-Motor zerstört also
mehr Information, als die Rohzahl vermuten lässt. Fables Diagnose (Zielwahl ist Geometrie,
`chooseTarget`; Wertformel vergab 44 % für Getroffenwerden, inzwischen behoben) trifft damit
sicher den richtigen Bereich.

Im selben Codeabschnitt steht übrigens die einzige **offene Designfrage, die im Motor
geparkt ist statt bei Chris**:

```
// engine.js:13196
// Die Folge ist trotzdem eine Frage an Chris: auf der Bahn entscheidet damit
// NICHT der Disziplinrang, sondern nur die Attribute, aus denen er entsteht. Zwei
// Laeufer mit gleichen Attributen laufen gleich schnell, auch wenn der eine im
// Spurt auf Rang 6 und der andere auf Rang 20 steht.
```

Dazu kommen **93 Vorkommen von „Platzhalter"** in `battle-mode.engine.js`. Es gibt keine
Stelle, an der diese offenen Punkte gesammelt stehen.

---

## 3. Prioritäten — wo ich widerspreche

Die bisherige Reihenfolge war: Basketball finalisieren → Hockey → Football-Recherche →
Gewichtheben → fünf weitere Fable-Pläne. **Ich halte das für die falsche Achse.** Sie
arbeitet Disziplinen ab; die Engpässe liegen quer dazu.

### 3.1 Was ich zuerst täte — und warum nicht Football

Football ist der teuerste denkbare nächste Schritt („Aufwand: **hoch**, eher am oberen
Ende", `football-rollout-plan.md` Teil E.2), sein Ergebnis wäre eine dritte Live-Disziplin,
die wie die zweite nicht im echten Spielstand ankommt, und seine Abnahme würde gegen eine
Zahl gemessen, die auf einem Kader ±0,17 schwankt. Die Recherche ist ausgezeichnet und
verliert nicht an Wert, wenn sie zwei Wochen liegt. **Football ist richtig, aber nicht
jetzt.**

Meine Reihenfolge, nach Wirkung pro Aufwand:

**A. Die Messgrundlage kaderfest machen (klein, ein Tag).** `disziplinProbe` bekommt einen
Parameter für eine Kader-Familie; `miss-alle-disziplinen.mjs` misst über mehrere Paarungen
und gibt Median **und Spannweite** aus. Der Weg ist schon da (`window.__olyArenaKader`,
`page.addInitScript`), die Kader kommen aus dem `live-save`-Abbild statt aus einer Mischung.
**Ohne diesen Schritt ist jede weitere Rezeptrunde Raten mit Nachkommastellen.** Danach
lassen sich Gewichtheben, Spurt, Staffel, Showcase und I-Spy überhaupt erst einordnen — es
kann gut sein, dass drei davon längst bestehen.

**B. Eine rho-Schranke in die CI (klein, ein halber Tag).** Eine Disziplin mit n=24 kostet
gemessen **27 s** inklusive Browserstart (`time node scripts/miss-alle-disziplinen.mjs 24
basketball`), alle zwanzig in einer Browsersitzung liegen im einstelligen Minutenbereich.
Der Nightly-Job installiert Chromium ohnehin schon
(`.github/workflows/ci-nightly.yml:23`). Heute gibt es **1008 Testdateien und keine einzige,
die rho prüft** — die Abnahmezahl des Projekts ist die einzige Kennzahl ohne Schutz. Eine
eingecheckte Basislinie plus „keine Disziplin darf um mehr als X fallen" hätte Hockeys Weg
von 0,670 auf 0,647 beim zweiten Commit gemeldet statt gar nicht.

**C. Den Boxscore an die Spieler-PPs hängen (mittel).** Das ist der Schritt, der aus der
gesamten bisherigen Motorarbeit **Spielerfahrung** macht. Heute wird der Boxscore berechnet
und weggeworfen (Abschnitt 1.4). Solange das so bleibt, ist jede Verbesserung der Rangtreue
für Chris unsichtbar — und umgekehrt: sobald es hängt, wird Basketballs 0,820 sofort im Spiel
spürbar, ohne dass eine einzige Disziplin dazukommt. Der Plan hält den Schritt als „bewusst
noch nicht umgesetzt (fehlende Liga-Kontextdaten)" fest; das ist eine benennbare, lösbare
Blockade, keine Naturkonstante. **Das ist der größte einzelne Wirkungssprung im ganzen
Backlog.**

**D. Zwei Chassis-Umzüge: Tennis und Fechten auf die Bühnen-Duell-Variante (mittel).** Zwei
von sieben Durchfallern verschwinden voraussichtlich ohne neuen Motor (Abschnitt 2.4). Für
Fechten liegt die sportliche Begründung bereits fertig vor.

**E. Das Bühnenbild zu Daten machen (mittel) — bevor Gewichtheben es hartkodiert.** Sieben
Disziplinen teilen sich `bodenBuehne`. Ein `BUEHNE_ART[d].bild`-Block, dieselbe Bauart wie
der frisch eingeführte `kurve:`-Block, gibt Gewichtheben seinen Hantelsteg, Speed-Schach
sein Brett, Eiskunstlauf sein Eis, Breaking seinen Kreis — in **einer** Runde statt in
sieben. **Achtung, zeitkritisch:** ein Agent baut gerade in
`.claude/worktrees/agent-af327a670d5aaf96a` (Branch `claude/gewichtheben-buehnenbild`, noch
nichts committet) genau das eine Bild. Wenn er hartkodiert, ist die Verallgemeinerung
danach teurer.

**F. Die Arena (groß).** Vier von sieben Durchfallern in einem Chassis, Ursache benannt
(Zielwahl nach Geometrie statt Bedrohung), und die eine Entscheidung dazu — Schlagfrequenz
an das Tempo koppeln — liegt bei Chris und ist seit dem 02.09. unbeantwortet
(`stand-aller-disziplinen.md` Abschnitt 5a). **Diese Frage sollte gestellt werden, bevor
jemand an der Arena arbeitet**, sonst wird eine Runde in die falsche Richtung gebaut. Wenn
Fechten nach D die Arena verlässt, sind es nur noch drei Disziplinen — dann konkurriert die
Arena-Runde direkt mit Football, und Football gewinnt, weil es besser vorbereitet ist.

**G. Hockey ruhen lassen, bis A steht.** Drei Runden, netto −0,023, und das Kaderrauschen
beträgt 0,211. Eine vierte Runde auf derselben Messgrundlage kann nicht zeigen, dass sie
etwas bewirkt hat. Der Punkt, den die letzten beiden Berichte als nächsten Schritt nennen
(Hockeys `eig`-Rezept gegen die neue Mechanik neu austarieren), bleibt richtig — aber erst
nach A und mit dem strukturellen Sinkhorn-Fix aus 2.3, nicht mit einer zweiten
Handkorrektur.

### 3.2 Querschnitt schlägt Einzeldisziplin — mit einer Ausnahme

Vier der sieben Punkte oben (A, B, C, E) sind Querschnittsarbeiten, und alle vier sind
kleiner als eine Disziplinrunde. Das ist kein Zufall: nach vier gebauten Chassis und zwanzig
Disziplinen ist der Grenznutzen einer weiteren Einzelrunde niedrig, der einer Verallgemeinerung
hoch — jede Erkenntnis, die als Datenblock statt als Sonderfall landet, gilt sofort für vier
bis sieben Disziplinen. Der `kurve:`-Block vom 03.09. ist das Musterbeispiel und sollte die
Vorlage für Bühnenbild, Bühnenkurve und Bahnkurve sein.

Die Ausnahme ist C: den Boxscore an die Spieler-PPs zu hängen ist keine Verallgemeinerung,
sondern der Anschluss ans Produkt. Er steht trotzdem vorn, weil ohne ihn nichts von alledem
bei Chris ankommt.

---

## 4. Prozess und Qualität

Vorab, ohne Ironie: die Berichtsqualität in diesem Repo ist außergewöhnlich hoch.
Verschlechterungen werden benannt statt versteckt (`hockey-mechanik-angleichen.md`: *„Das ist
eine ehrliche Verschlechterung bei der Zahl, die zählt"*), verworfene Varianten stehen mit
Messwerten da, Quellen werden mit 403-Vermerk als unbrauchbar markiert. Die folgenden Punkte
sind Kritik an der **Kette**, nicht an einzelnen Berichten.

### 4.1 Drei ehrliche Berichte ergeben eine unehrliche Bilanz

| Runde | rho je Spiel | rho Saison | Selbsteinschätzung des Berichts |
|---|---:|---:|---|
| Ausgangswert (02.09.) | 0,670 | 0,874 | — |
| `hockey-mechanik-angleichen` | 0,612 | 0,895 | „ehrliche Verschlechterung … erwarteter Zwischenstand" |
| `hockey-eigene-erfolgskurve` | 0,617 | 0,783 | „flach … keine Verbesserung, aber auch keine Verschlechterung" |
| `hockey-rezept-ursache` | **0,647** | 0,860 | „echte Verbesserung auf beiden Achsen" |
| **Netto über den Tag** | **−0,023** | **−0,014** | — |

Jede Zeile ist für sich korrekt. Die letzte Runde vergleicht sich gegen den Stand der
vorletzten (0,617) und meldet zu Recht +0,030 — nur ist der Bezugspunkt inzwischen ein
Zwischenstand, den es am Morgen nicht gab. **Es fehlt eine Instanz, die gegen den
Tagesanfang misst.** Genau das leistet Punkt B aus Abschnitt 3 (Basislinie in der CI).

Der Gegenbeleg zur selben Lücke steht in Abschnitt 1.1: ein Commit, der als Optik geplant
war, hat rho um +0,034 bewegt und dabei zwei andere Messskripte laufen lassen, aber nicht
`miss-alle-disziplinen.mjs`. **Die Abnahmezahl bewegt sich häufiger unbeabsichtigt als
beabsichtigt** — genau der Fall, für den eine Basislinie da ist.

Bemerkenswert dabei: jede der drei Runden schiebt die Lösung explizit auf die jeweils
nächste („der nächste Schritt für rho ist eine eigene Rezeptrunde", „eine künftige
Rezeptrunde sollte TEAMGEISTs Gewicht neu austarieren", „das bleibt ein offener, separater
Befund für eine künftige Runde"). Eine Kette aus drei Runden, von denen jede die
Abnahmezahl an die nächste weiterreicht, konvergiert nicht — sie verschiebt.

### 4.2 Das LINIENSPIEL-Missverständnis: bestätigt, und der Mechanismus dahinter

`hockey-mechanik-angleichen.md` Abschnitt C2 argumentiert, TEAMGEIST sei „nie als Hockeys
langfristiger Playmaking-Kanal gedacht, sondern als Platzhalter, bis LINIENSPIEL existiert",
und leitet daraus ab, `technikGate` sei „nicht falsch verdrahtet". Belegt wird das mit einer
Tabellenzeile in `hockey-torwart-puck-tore-recherche-fable.md` und einer Zeile in
`hockey-rollout-plan.md` B.2.

Einen Tag später korrigiert `hockey-eigene-erfolgskurve.md` das mit Chris' eigenen Worten:
*„teamgeist und linienspiel sagen mir nichts … das habe ich nicht beauftragt"* — und
streicht TEAMGEIST ersatzlos aus der Erfolgsformel.

Der Mechanismus ist wichtiger als der Einzelfall: **ein Planungsdokument, das ein Agent
geschrieben hat, wurde vom nächsten Agenten als Vorgabe gelesen.** Das Repo hat inzwischen
über zwanzig Design-Dokumente, von denen die meisten Agenten-Vorschläge sind, die Chris nie
gesehen hat. Es gibt keine Kennzeichnung, welche davon *entschieden* und welche *vorgeschlagen*
sind. Zwei Dokumente stolpern bereits über die Folgen: `gewichtheben-plan.md` merkt an, zwei
im Auftrag zitierte Abschnitte existierten gar nicht, und `neue-disziplin-handbuch.md`
markiert eine CLAUDE.md-Regel als „nur auf `hockey-balance`" — Regeln, die es je nach
Branch gibt oder nicht.

**Empfehlung:** eine Kopfzeile in jedem Design-Dokument, drei Zustände — *von Chris
entschieden* / *Vorschlag, unbeantwortet* / *überholt durch X*. Und die Regel: was in einem
`*-plan.md` steht, ist keine Vorgabe, solange Chris nicht zitiert wird.

### 4.3 Messwerkzeuge, die auseinanderdriften

`scripts/miss-hockey-archetypen.mjs:94` trägt `const HK_TW_REF = 0.844;` mit dem Kommentar
„dieselbe Konstante wie `feldspielWert()`". Im Motor steht seit dem 03.09.
`HK_TW_REF=0.907` (`engine.js:5398`). **Jede Torwart-GSAA-Zahl der letzten drei
Hockey-Berichte ist gegen einen veralteten Maßstab gemessen** — und aus genau diesen Zahlen
stammt die zweimal wiederholte Feststellung, die Torwart-Korrelation habe sich „weiter
verschlechtert". `hockey-eigene-erfolgskurve.md` hat die Dopplung bemerkt und korrekt
dokumentiert, aber (auftragsgemäß) nicht behoben. Die Schlussfolgerung steht trotzdem
unkorrigiert in beiden Berichten.

Allgemeiner: es gibt 17 Messskripte, sieben davon hockey-spezifisch, und **kein einziges für
das Bühnen- oder Arena-Chassis** außer `miss-gewichtheben-korridor.mjs`. Die Werkzeugdichte
folgt der Aufmerksamkeit, nicht dem Bedarf.

### 4.4 Kleine Stichproben, aus denen Schlüsse gezogen werden

Mehrfach belegt und von den Berichten selbst benannt:

- Die Verteidiger-Kennzahl `dTore%` schwankte im Ausgangsbericht zwischen −26,9 % und
  −49,4 % **bei unveränderter Mechanik**, je nach Spielanzahl. Sie wurde danach zweimal als
  Erfolgs- bzw. Misserfolgsindikator zitiert.
- Die Torwart-Korrelation ruht auf **sechs Torwart-Identitäten**; effektiv vergleicht sie
  zwei Personen.
- Der `steil`-Sweep für Hockeys Erfolgskurve lief mit n=32 und ist nicht monoton — der
  Bericht sagt das selbst („kein sauberes Optimum, nur einen Trend") und wählte trotzdem
  einen Wert daraus.
- Die `dunk`-Distanzstufe trägt ~2 % aller Schüsse und wurde über drei Fit-Durchgänge
  nachgezogen.

Alle vier sind im Text korrekt eingeschränkt. Trotzdem landen die Zahlen in Tabellen mit drei
Nachkommastellen und werden von der nächsten Runde als Ausgangswert übernommen. **Regel für
künftige Runden: eine Kennzahl, deren Streuung bei unveränderter Mechanik nicht gemessen
wurde, darf keine Motorentscheidung tragen.** Die Streuung zu messen kostet einen zweiten
Lauf mit anderer Saatfamilie.

### 4.5 Arbeit, die verloren gehen kann

`git worktree list` zeigt vierzehn Agenten-Arbeitsbäume im Haupt-Checkout. Einer davon,
`agent-af327a670d5aaf96a` (Branch `claude/gewichtheben-buehnenbild`, gesperrt), enthält
**uncommittete** Änderungen an `battle-mode.engine.js` und zwei neue, ungetrackte Skripte
(`miss-gewichtheben-archetypen.mjs`, `miss-gewichtheben-jeseite.mjs`). Der Branch existiert
nicht auf `origin`. Der Rest ist unkritisch — alle anderen Themenzweige sind gepusht und
ihre Inhalte über PRs auf `main`; die scheinbar „unmergten" Commits sind Squash-Artefakte.

**Zweite Beobachtung zur Struktur:** `battle-mode.engine.js` ist von 12 770 Zeilen (31.08.)
auf 16 477 (03.09.) gewachsen — **+29 % in drei Tagen**, rund 1 200 Zeilen pro Tag, in eine
einzige Datei ohne Modulgrenzen. Die 1 008 Testdateien decken die Next-App ab, den Motor
praktisch nicht (sechs Dateien nennen ihn, davon prüft keine sein Spielverhalten). Bei
diesem Tempo wird die Datei bald der eigentliche Engpass. Das ist kein Notfall, aber es
gehört auf die Liste, bevor es einer ist.

---

## 5. Konkrete nächste Schritte, priorisiert

Aufwand: **klein** ≈ eine Agentenrunde · **mittel** ≈ zwei bis drei · **groß** ≈ mehrere Tage
mit Recherche.

| # | Was | Aufwand | Warum jetzt | Abnahme |
|---|---|---|---|---|
| 1 | **`disziplinProbe` bekommt Kader-Familien**; `miss-alle-disziplinen.mjs` gibt Median und Spannweite über ≥5 Paarungen aus dem `live-save`-Abbild | klein | Ohne das ist jede Rezeptzahl Rauschen (1.3). Blockiert 3, 6, 9 | Spannweite je Disziplin steht in der Tabelle |
| 2 | **rho-Basislinie in CI-Nightly**, Abbruch bei Verlust > Schwelle | klein | 1008 Tests, kein einziger schützt die Abnahmezahl (3.1 B). Kostet 27 s je Disziplin | Ein absichtlich verschlechtertes Rezept lässt die CI rot werden |
| 3 | **Boxscore an die individuellen Spieler-PPs** hängen (statt `distributeRankPointsToPlayers` aus der PPS-Rangtabelle) | mittel | Erst dadurch wirkt die gesamte Rangtreue-Arbeit im Spielstand (1.4) | Zwei Spieler mit gleichem Team-Ergebnis, aber verschiedenem Boxscore bekommen verschiedene PPs |
| 4 | **`engine.js:9988`**: `(b.p.d[disc]\|\|0)` durch den `gewichtet(...)`-Rückfall ersetzen | klein | Fünfte Fundstelle derselben Lücke, sichtbar in der Aufstellung (2.1) | Der Slot-Vorschlag zeigt für alle 20 einen echten Eignungswert |
| 5 | **`miss-hockey-archetypen.mjs`**: `HK_TW_REF` aus dem Motor lesen statt duplizieren; Torwart-Aussagen der letzten drei Berichte nachmessen | klein | Zwei Berichte ziehen Schlüsse aus einem veralteten Maßstab (4.3) | GSAA-Mittel pendelt um 0 |
| 6 | **Bühnenbild als Datenblock** (`BUEHNE_ART[d].bild`), Bauart wie `kurve:`; Gewichtheben als erste Instanz | mittel | Sieben Disziplinen mit den besten rho-Werten sehen identisch aus (1.5); zeitkritisch wegen des laufenden Gewichtheben-Agenten (4.5) | Fünf Bühnen-Disziplinen haben ein erkennbar eigenes Bild, rho unverändert |
| 7 | **Tennis auf die Bühnen-Duell-Variante** umziehen | mittel | Chassis-Fehlwahl, kein Mechanikproblem (2.4); Vergleichswerte 0,950 / 0,776 | rho über 0,80 ohne neuen Motor |
| 8 | **Fechten auf die Bühnen-Duell-Variante** umziehen | mittel | Fables sportliche Begründung liegt fertig vor; entfernt einen von vier Arena-Durchfallern | rho über 0,80; Arena schrumpft auf drei Disziplinen |
| 9 | **Bühnen-Erfolgskurve zu Daten** machen (`BUEHNE_ART[d].kurve`), dann je Disziplin fitten | mittel | Sechs Disziplinen teilen drei hartkodierte Zeilen (2.2) — derselbe Fehler wie bei Hockey, sechsfach | Jede Bühnen-Disziplin hat eigene Konstanten mit Herleitung |
| 10 | **Sinkhorn: Führungsattribut als Nebenbedingung** (verzerrte Startbelegung) + `MATRIX`/`ERLAUBT` für mehr als Hockey | mittel | Die Handkorrektur ist kaderabhängig (2.3); die Budget-Methode ist heute nur für Hockey lauffähig | Der Hockey-Fix reproduziert sich ohne Handeingriff |
| 11 | **Chris fragen: Schlagfrequenz in der Arena** — soll Tempo den Angriff beschleunigen? | — | Offen seit 02.09.; blockiert jede sinnvolle Arena-Runde (3.1 F) | Antwort steht in einem Dokument, nicht in einem Chat |
| 12 | **Arena: Zielwahl nach Bedrohung** statt nach Nähe, mit Hysterese | groß | Drei bis vier Durchfaller in einem Chassis, Ursache benannt | rho der verbliebenen Arena-Disziplinen über 0,70 |
| 13 | **Football-Live-Migration** nach `football-rollout-plan.md` Teil B | groß | Beste Vorbereitung im Repo, aber teuer und heute ohne Abnehmer (3.1) | rho über 0,80, Punkte je Team im NFL-Korridor |
| 14 | **Hockey-Rezeptrunde**, nach 1 und 10 | mittel | Der von zwei Berichten angekündigte nächste Schritt — aber erst, wenn er messbar ist (3.1 G) | rho je Spiel über dem Median aller fünf Kader von heute |
| 15 | **Ein Register offener Punkte** (`docs/design/OFFENE_PUNKTE.md`) statt 93 „Platzhalter" im Code und einer „Frage an Chris" in Zeile 13196 | klein | Niemand kann heute sagen, was offen ist (2.5) | Jeder Platzhalter im Motor verweist auf eine Zeile im Register |
| 16 | **Design-Dokumente kennzeichnen**: entschieden / Vorschlag / überholt | klein | Verhindert das nächste LINIENSPIEL (4.2) | Jedes `docs/design/*.md` trägt die Kopfzeile |

**Wenn nur drei Dinge passieren: 1, 2 und 3.** Der erste macht die Abnahmezahl belastbar, der
zweite hält sie fest, der dritte lässt sie im Spiel ankommen. Danach ist jede
Disziplinrunde zum ersten Mal eine Investition mit messbarer Rendite.

---

## Anhang: die Kader-Sensitivitätssonde

Die Sonde aus Abschnitt 1.3 lief im Scratchpad und ist bewusst nicht eingecheckt (dieser
Auftrag war reine Analyse). Der nicht offensichtliche Teil ist der Weg, einen anderen Kader
in das Mockup zu bekommen — der Motor bringt ihn selbst mit:

```js
// Vor dem Laden der Seite, nicht danach: der Motor wartet in einer async-IIFE auf
// window.__olyArenaKader und liest SQUAD/OPP erst dahinter (engine.js:2662-2676).
await seite.addInitScript((k) => { window.__olyArenaKader = k; },
                          { heim: [...], gast: [...] });
await seite.goto(SEITE, { waitUntil: "networkidle" });
// danach ganz normal:
await seite.evaluate(([d, n]) => window.__arena.disziplinProbe(d, { n }), [d, 24]);
```

Die Spielerobjekte haben dasselbe Format wie die Literale in `engine.js:2601`/`:2627`, nur
ohne `skills` (setzt `mitKit()` selbst) und ohne `row`. Für die Tabelle in 1.3 habe ich die
17 Spieler beider Kader zusammengeworfen und deterministisch in vier weitere 8-gegen-8-Paare
gemischt; die eigentlichen Kaderfamilien sollten aus dem `live-save`-Abbild kommen, damit
auch die Attributverteilung einer echten Liga entspricht und nicht der von 17 Spielern.

Die Spearman-Rechnung ist zeichengleich aus `scripts/miss-alle-disziplinen.mjs` übernommen
(Bindungen bekommen den Durchschnittsrang), damit die Zahlen mit der Referenzsonde
vergleichbar bleiben.

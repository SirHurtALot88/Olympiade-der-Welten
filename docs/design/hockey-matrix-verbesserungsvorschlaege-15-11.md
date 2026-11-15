# Hockey & die Matrix — zwei Review-Perspektiven, keine Umsetzung

Reine Analyse-/Konzeptrunde, kein Code-PR. Chris, wörtlich: „nimm bei hockey erstmal die beste
version die du gebaut hast da müssen wir später noch mal schauen" und „lass opus und fable auch
mal auf das thema mit hockey und der matrix schauen ob die verbesserungsvorschläge unter meinen
prämissen haben". `public/mockups/battle-mode.rezepte.js` (Hockey-Block) und
`public/mockups/battle-mode.engine.js` sind in dieser Runde **nicht angefasst** — jede Zahl unten
ist entweder frisch nachgemessen auf dem unveränderten Stand, oder ein reiner Trockenlauf in einer
Scratchpad-Datei, nie ins Rezept zurückgeschrieben.

Stand: `main` `ebf0bb440` (15.11., Nachmittag). Kader-Quelle für jede rho-Zahl unten:
`data/generated/kaderfamilie-live-save.json`, gezogen am 15.11. um 07:28 Uhr aus dem
Hetzner-Save „Oly New Game Custom 31.10.2026" — frisch, der Spiegel-Check
(`npx tsx scripts/pruefe-spiegel-frische.ts`) meldete beide Spiegel zum Zeitpunkt dieser Messung
als „frisch" (unter einer Stunde alt).

---

## 0. Ausgangslage, frisch gemessen

### 0.1 rho (die Pflichtzahl, Ziel >0,80, angestrebt 0,85)

```
node scripts/miss-alle-disziplinen.mjs 24 hockey
```

| | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite | Abnahme |
|---|---:|---:|---:|---:|---|
| alle 12 (inkl. beide Torhüter) | **0,700** | 0,266 | 0,888 | 0,259 | durchgefallen |
| nur die 10 Feldspieler | **0,784** | 0,226 | 0,874 | 0,201 | knapp |

Beides liegt **über** den zuletzt in CLAUDE.md dokumentierten Zahlen (0,670 / Validität 0,874) —
die Feldspieler-Saisonzahl (0,874) trifft CLAUDE.mds Validitätszahl exakt, die Einzelspielzahl
bewegt sich innerhalb der für Hockey seit Monaten gemessenen Kader-Spannweite (rund 0,17–0,27,
s. `docs/design/messgrundlage-kaderfest.md`). **Das ist keine echte Verbesserung gegenüber dem
zuletzt dokumentierten Stand, sondern eine andere Ziehung aus derselben verrauschten
Verteilung** — mit dieser Spannweite lässt sich eine Bewegung von 0,67 auf 0,70 oder 0,78 auf 0,87
nicht von Rauschen unterscheiden. Chris' Rangtreue-Ausnahme (CLAUDE.md, Star Rang 1 58 %/erste
zwei 78 %, kaderfest; `docs/design/hockey-opus-review-nhl.md` 5.3) deckt weiterhin **nur rho**,
nicht Pp — und Hockey steht laut `lib/battle/arena-resolved-disciplines.ts` deshalb weiter
außerhalb von `ARENA_RESOLVED_DISCIPLINE_IDS`.

Zum Vergleich, einmal zusätzlich mit dem (für andere Feldspiele generischen) Einzelkader-Werkzeug
gemessen (`node scripts/miss-feldspiel-rangtreue.mjs hockey 24 6`, eine einzige Paarung statt der
Kader-Familie — die Spaltenbeschriftungen des Werkzeugs sind noch von Basketball übernommen und
daher irreführend, die rho-Zahl ist echt): rho(gesamt) 0,615, rho(Seite) 0,628 — **innerhalb** der
oben gemessenen Spannweite, bestätigt also dieselbe Größenordnung über ein zweites Werkzeug.

### 0.2 Pp (die Pflichtzahl, Ziel ≤25, angestrebt <15 ohne rho-Verlust)

```
node scripts/messe-arena-einfluss.mjs hockey 48 --rohdaten=<datei>   (3 Saatströme, gepoolt mit
node scripts/poole-arena-einfluss.mjs)
```

ist die in `docs/design/hockey-pp-messbasis-10-11.md`/im Kopfkommentar von
`scripts/poole-arena-einfluss.mjs` dokumentierte Methode — **und sie ist teuer**: ein einzelner
`n=48`-Strom für Hockey lief in dieser Runde über 300 Sekunden, ohne durchzulaufen; ein zweiter
Versuch mit `n=24` lief danach über 400 Sekunden, ebenfalls ohne Ergebnis, bevor er aus
Zeitgründen dieser Analyse-Runde abgebrochen wurde. Grund, selbst gemessen am Prozess: die
Playwright-Chromium-Rechnung lief in beiden Fällen durchgehend auf > 100 % CPU, nicht hängend —
Hockey ist für dieses Werkzeug schlicht die teuerste Feldspiel-Disziplin (13-fache
NHL-Ereignisdichte, CLAUDE.md). Eine ehrliche dritte Saatstrom-Runde (die für eine abnahmefähige
Zahl laut Kopfkommentar von `poole-arena-einfluss.mjs` ohnehin nötig wäre: ein einzelner
`n=48`-Strom liegt bei Hockey bei einem Rauschboden von 35–40 Pp, erst drei gepoolte Ströme senken
ihn auf rund 22) hätte den Zeitrahmen dieser reinen Analyse-Runde um ein Vielfaches gesprengt.

**Was diese Runde stattdessen liefert, ehrlich benannt statt verschwiegen:**

- **Keine neue, selbst gemessene Pp-Zahl** — beide Versuche (s. oben) wurden abgebrochen, bevor
  sie ein Ergebnis lieferten. Das ist eine bewusste Entscheidung dieser Runde (Zeitbudget einer
  reinen Analyseaufgabe gegen die Kosten des Werkzeugs abgewogen), keine verschwiegene Lücke.
- Der zuletzt **im Code dokumentierte** gepoolte Pp-Wert, aus dem Kopfkommentar von
  `battle-mode.rezepte.js` (Hockey-Block, Abschnitt „PP-REBALANCE 10.11.2026"): **Pp 10,4**
  (Ströme 29,3 / 14,3 / 14,0), nach der „Matrixgewicht als harte Obergrenze"-Umstellung aus Task
  #99-Vorläufer-PR #1390. Die unmittelbar folgende PR (#1440, Task #99 selbst, Commit `5e5916d25`,
  die stamina/spirit-Verschiebung) dokumentiert in ihrer Commit-Beschreibung nur noch einzelne
  verbleibende Verstöße (dexterity +5,4 Pp bei 2,0 SE, awareness/will leicht über Matrix), **keine
  neue gepoolte Gesamtzahl** — der heute gültige Pp-Wert ist also wahrscheinlich nah an 10,4,
  aber nicht identisch und in dieser Runde **nicht neu verifiziert**.
- Die zuletzt in `data/generated/disziplin-abnahme.json` **gespeicherte** Zahl ist mit 38,5/81,5
  (Eintrag „hockey") **veraltet** — sie stammt aus der Messung VOR der Task-#99-Rebalance (Task
  #195, 25.10.) und wurde nie nachgezogen. Das ist ein eigener kleiner Dokumentationsbefund dieser
  Runde (keine Codeänderung, nur eine Beobachtung): die JSON-Datei und der Rezept-Kopfkommentar
  widersprechen sich, und wer nur die JSON liest, hält Hockey für deutlich schlechter, als es laut
  dem zuletzt gemergten Rezept ist.

---

## 1. Opus-Perspektive — nüchtern, Prämissen-scharf

### 1.1 Frage: lohnt sich echte Sinkhorn-Budget-Konservierung (wie Football/Bühne/Bahn) statt der
heutigen „harte Obergrenze"?

**Nein — und das ist kein Vermuten, sondern dreifach reproduziert, zuletzt heute.**

Die Budget-Methode ist für Hockey **zweimal ernsthaft durchgerechnet und beide Male verworfen**
worden, weil sie rho kostete, nicht weil sie zu aufwendig war:

**Wichtig für die Tabelle: Einzelkader- und kaderfeste Messungen nicht querlesen** — die
Spannweite allein durch den Kaderwechsel liegt bei Hockey bei 0,2–0,27 (Abschnitt 0.1), also
größer als mehrere der Bewegungen unten. Innerhalb einer Zeilengruppe (gleicher Messzeitpunkt,
gleiche Methode) ist der Vergleich Sinkhorn-gegen-Hand aber jeweils ehrlich, weil beide Varianten
im selben Lauf gegeneinander gemessen wurden:

| Runde | Rezept-Methode | Messbasis | rho je Spiel | rho Saison | Quelle |
|---|---|---|---:|---:|---|
| Historischer Platzhalter | Basketballs altes Sub-Skill-Set, 1:1 übernommen | n=24, Einzelkader | 0,493 | — | `battle-mode.rezepte.js` Kopfkommentar |
| Hand-kalibriert (Fein-Kalibrierung vor jeder Sondierung) | eigenes Hockey-Rezept | n=24, Einzelkader | 0,617 | 0,783 | `hockey-rezept-ursache.md` |
| Reiner Sinkhorn (0,00 Pp), **im selben Lauf gegen die Zeile darüber gemessen** | volle Budget-Konservierung | n=24, Einzelkader | **0,582 — schlechter** | **0,755 — schlechter** | `hockey-rezept-ursache.md` |
| Sinkhorn + 2 gezielte Hand-Korrekturen (ABSCHLUSS/SCHUSS_FERN) — **das committete Fundament des heutigen Rezepts** | Sinkhorn-Basis, zwei Zellen nachjustiert | n=24, Einzelkader | **0,647 — bester Wert dieser Gruppe** | **0,860** | `hockey-rezept-ursache.md` |
| Zweiter Sinkhorn-Vollversuch (alle Sub-Skills konsequent), **gegen dieselbe 0,647/0,860-Basis gemessen** | volle Budget-Konservierung, zweiter Anlauf | n=24, kaderfest (5 echte Paarungen) | 0,595 — schlechter | 0,769 — schlechter | `hockey-ueber-080-versuch2.md` |
| „Harte Obergrenze"-Rebalance + Task #99 (heutiger committeter Stand) | Matrixgewicht als Deckel, keine Sinkhorn-Anwendung mehr | n=24, kaderfest (damalige Kader-Familie) | 0,561–0,587 (alle 12) / 0,661–0,690 (Feldspieler) | — | `battle-mode.rezepte.js`, Task #99-Commit |
| Heute, dieselbe Mechanik, frische Kader-Familie | unverändert | n=24, kaderfest (live-save 15.11.) | **0,700** (alle 12) / **0,784** (Feldspieler) | 0,888 / 0,874 | diese Runde, Abschnitt 0.1 |

In **beiden** Fällen, in denen Hockey auf reine Sinkhorn-Logik gestellt wurde (0,00 Pp erreichbar),
fiel rho unter die Version mit den beiden gezielten, hand-nachjustierten Ausnahmen — und das aus
einem verstandenen, nicht nur gemessenen Grund (`hockey-rezept-ursache.md` Abschnitt 2): Sinkhorn
balanciert Zeilen- und Spaltensummen, kennt aber keine Nebenbedingung „dieses Attribut muss
FÜHREND bleiben". Für Hockey heißt das konkret: Sinkhorn gibt `ABSCHLUSS` 63 % Power/37 % Spirit
und `SCHUSS_FERN` 53 % Speed/30 % Awareness/17 % Power — arithmetisch sauber (Spalte und Zeile
gehen auf), aber `spirit` korreliert auf dem Testkader mit **−0,34** zur Eignung und `speed` mit
**−0,06**, während `power` mit **+0,85** die beste verfügbare Eignungskorrelation überhaupt ist.
Ein Rezept, das genau DAS führende Attribut gegen ein negativ korrelierendes tauscht, verbessert
die Pp-Zahl und verschlechtert gleichzeitig exakt das, was Pp eigentlich absichern soll.

**Heute, zur Verifizierung dieser Runde, mit dem Werkzeug selbst nachvollzogen** (reiner
Trockenlauf, nichts committet):

```
node scripts/baue-feldspiel-rezept.mjs hockey <historische-Sondierungsdatei>
```

mit der historischen Sondierung aus `hockey-rezept-ursache.md` (ABSCHLUSS 17,7 %, ZWEITCHANCE
17,5 %, SCHUSS_FERN 12,4 %, TEAMGEIST 11,6 %, ABWEHR 11,1 %, LAUFTEMPO 9,4 %, TECHNIK 8,9 %,
AUSDAUER 6,1 %, SCHUSS_NAH 5,4 %, AUFBAU/PARADE je 0 %) als Eingabe — die Sondierung misst
mechanische Sub-Skill-Gewichte über eine ORTHOGONALE Testversion des Motors und ist deshalb von
der heutigen Rezept-Umstellung unabhängig, also weiterhin gültig. Ergebnis: größte Abweichung
0,00 Pp, aber **exakt dasselbe problematische Muster** —

```
ABSCHLUSS:   {power:63,spirit:37}
SCHUSS_FERN: {speed:53,awareness:30,power:17}
```

Byte-genau die Zahlen, die der Kopfkommentar als die verworfene, rho-kostende Variante beschreibt.
Das ist keine neue Erkenntnis, aber eine **unabhängige Reproduktion am selben Tag** — das Werkzeug
selbst produziert zuverlässig das Ergebnis, das zweimal von Hand korrigiert werden musste.

**Verdikt:** eine Umstellung auf echte, vollständige Budget-Konservierung ist für Hockey
**technisch machbar** (das Werkzeug läuft, Pp fiele auf ~0), aber **nicht empfehlenswert** — sie
würde rho mit hoher Wahrscheinlichkeit wieder unter den heutigen Hand-Stand drücken, genau wie in
den beiden dokumentierten Vollversuchen. CLAUDE.md ist hier eindeutig: „nicht die Pp-Zahl auf
Kosten von rho optimieren" — die 0,80-rho-Schranke hat Vorrang vor einer niedrigeren Pp-Zahl. Die
heutige „harte Obergrenze"-Methode ist für Hockey die richtige Wahl, nicht ein Kompromiss, den man
noch verbessern sollte.

### 1.2 Wo die harte Obergrenze trotzdem noch Luft hat

Task #99 selbst dokumentiert einen offenen, kleinen Rest: dexterity (+5,4 Pp bei 2,0 SE),
awareness und will leicht über ihrem Matrixgewicht — alle drei **ohne** dass diese Runde ihre
Sub-Skills angefasst hätte (ein Renormierungs-Nebeneffekt der stamina/spirit-Verschiebung). Das
ist kein Sinkhorn-Thema, sondern dieselbe Handarbeit, nur an drei weiteren, kleineren Stellen —
s. Fable-Idee 4 unten.

### 1.3 Einordnung der rho-Zahl selbst

Die 0,80-Schranke ist für Hockey nach der NHL-Vergleichsrechnung (`hockey-opus-review-nhl.md`
Abschnitt 5, Poisson-Simulation mit echten NHL-Raten und echtem NHL Game Score) **keine
Realismus-Schranke**: ein simuliertes echtes NHL-Spiel liefert rho 0,40 bei einer
Spiel-zu-Spiel-Verlässlichkeit von 0,14; unser Motor liegt bei Verlässlichkeit 0,755 (CLAUDE.md)
bzw. 0,661–0,710 (Feldspieler, je nach Teilmessung) bereits weit darüber. Das ändert an der
0,80-Schranke selbst nichts (sie ist Chris' Spielbau-Vorgabe, keine Realismus-Ableitung), erklärt
aber, warum weitere reine Rezept-Feinarbeit (noch ein Sinkhorn-Lauf, noch eine
Attribut-Verschiebung) strukturell wenig trägt: `hockey-ueber-080-versuch2.md` kommt unabhängig
zum selben Schluss — der verbleibende Abstand sitzt in der MECHANIK (welche Ereignisse das Spiel
erzeugt), nicht im Rezept.

---

## 2. Fable-Perspektive — vier Ideen, von groß nach klein

Alle vier bauen auf bereits vorhandener, teilweise schon gemessener Recherche auf
(`docs/design/hockey-naechster-hebel-recherche-fable.md`) statt bei Null anzufangen — diese
Recherche hat die Ideen in genau dieser Reihenfolge priorisiert, und nichts in dieser Runde
widerspricht dem.

### Idee 1 — Zoneneintritt als echter Zweikampf an der blauen Linie (Mechanik-Ebene, größter Hebel)

**Was sich ändert:** heute überquert der Puckführer die blaue Linie als reiner Laufweg — kein
Würfel, keine Fähigkeit beteiligt (`hockey-naechster-hebel-recherche-fable.md` Abschnitt 1.4: der
Eintritt hängt mechanisch an `AUFBAU` mit rho 0,04 und an `LAUFTEMPO` mit −0,03 zur Eignung, obwohl
er der zweitverlässlichste Posten des ganzen Spiels ist, Retest 0,948). Vorschlag: ein echtes
Paar-Los beim Überschreiten der Linie (Angreifer-Attribute aus `AUFBAU` gegen
Verteidiger-Attribute aus `ABWEHR` — beide Sub-Skills existieren schon, keine neue Attribut-Zelle
nötig), drei Ausgänge (kontrolliert / Dump-in / abgefangen), zwei neue Boxscore-Spalten.

**Erwartete Wirkung:** bereits die **blinde** Version (fester Bonus, kein Zweikampf) hebt gemessen
die Saison-Validität der Feldspieler von 0,842 auf 0,903 — ein echter, am Gap/an der Puckführung
hängender Zweikampf würde diese Validität zusätzlich mit der hohen Retest-Verlässlichkeit des
Postens (0,948) unterfüttern. Nach CLAUDE.mds eigener Formel (rho(Spiel)=rho(Saison)×√Verlässlichkeit)
ist das der einzige bisher gefundene Kanal, der **beide** Faktoren zugleich anhebt — und laut der
eigenen Rechnung der Recherche (Abschnitt „Reihenfolge") der einzige mit realistischem Weg über
0,80.

**Prämissen-Check:**
- rho >0,80: **wahrscheinlich positiv, aber nicht final gemessen** — nur die blinde Vorform ist
  gemessen, der echte Zweikampf müsste gebaut und dann kaderfest nachgemessen werden. Das ist der
  Hauptgrund, warum diese Idee eine eigene Umsetzungsrunde braucht, keine, die man in dieser
  Analyse mit abschließt.
- Pp ≤25: **architektonisch unproblematisch** — beide beteiligten Sub-Skills (`AUFBAU`, `ABWEHR`)
  existieren bereits mit denselben Attributen, die ihnen schon heute erlaubt sind; es entsteht
  keine neue Attribut-Quelle, nur ein neuer, skillgebundener Kanal für vorhandene. Müsste nach dem
  Bau trotzdem mit `messe-arena-einfluss.mjs` neu vermessen werden.
- Matrix: **unangetastet** — reine Mechanik-/Boxscore-Ergänzung.
- Budget-Methode: beim Dimensionieren des neuen Loses sollte die Sondierung **von Anfang an** auf
  Korrelation zur Eignung geprüft werden, nicht blind sinkhorn-balanciert (die Lektion aus Opus-
  Abschnitt 1.1).
- Aufwand: **groß** — neue `rr()`-Logik, zwei Boxscore-Spalten, eine eigene Messrunde. Das ist der
  Preis für den größten Hebel.

### Idee 2 — Netfront-Schirm und Ablenker (Mechanik-Ebene, zweiter Hebel)

**Was sich ändert:** 17 % aller Schüsse von der blauen Linie haben heute geometrisch einen
Mitspieler im Slot auf der Schusslinie („Schirm") — ohne jede Wirkung auf die Fangquote
(`hockey-naechster-hebel-recherche-fable.md` Abschnitt „5"). Ein Schirm senkt real die Fangquote
um über zehn Punkte, ein abgelenkter Schuss trifft real zu 14,5 % gegen 4,9 % bei klaren Schüssen.
Vorschlag: dem Netfront-Spieler (heute `SCHUSS_NAH`, health-geführt) einen Torkanal über genau
diesen Mechanismus geben, dem Point-Schützen (`SCHUSS_FERN`, power-geführt) einen zusätzlichen
Vorlagen-Kanal — Basketballs Alley-Oop-Bauform (ein Wurf, dessen Schütze ein anderer ist als der
Abspieler) ist laut der Recherche die passende Vorlage.

**Erwartete Wirkung:** kleiner als Idee 1 — die Recherche reiht sie selbst explizit **nach** dem
Zoneneintritt ein. Keine eigene Zahl gemessen (nur die Schuss-Geometrie beobachtet), also
Erwartung, nicht Messung.

**Prämissen-Check:**
- rho: unbekannt, vermutlich klein positiv (gleiche Logik wie Idee 1, kleinerer, selteneren
  Kanal).
- Pp: unproblematisch — nutzt bestehende Sub-Skills/Attribute (`SCHUSS_NAH`/health,
  `SCHUSS_FERN`/power), keine neue Attribut-Zelle.
- Matrix: unangetastet.
- Aufwand: mittel — eine neue Schuss-Variante, kein neues Attribut-Budget.
- Einordnung: sinnvolle **zweite** Runde, falls Idee 1 nach dem Bau tatsächlich über 0,80 trägt
  und noch Potenzial bleibt — nicht als eigenständiger erster Schritt.

### Idee 3 — Tore halb als xG buchen (kleine Wertformel-Korrektur, kein Rezept)

**Was sich ändert:** die Trefferchance jedes Schusses (`pTor`) steht im Motor beim Abschuss schon
fest. Sie **zur Hälfte statt des tatsächlichen Tores** in die Feldspielwertung zu buchen (0,5·Tor +
0,5·xG statt 1,0·Tor) ist eine reine Glättung der Varianz, kein neuer Kanal.

**Erwartete Wirkung:** gemessen (`hockey-naechster-hebel-recherche-fable.md` Abschnitt 6): hebt die
Spiel-zu-Spiel-Verlässlichkeit der Feldspieler von 0,661 auf 0,710 und rho je Spiel um 0,016 — klein,
aber billig und ohne jede Rezeptberührung.

**Prämissen-Check:**
- rho: **positiv, gemessen**, wenn auch klein (+0,016).
- Pp: **nicht betroffen** — berührt keine Attribut-Gewichtung, nur wie ein bereits vorhandener Wert
  gebucht wird.
- Matrix: unangetastet.
- Aufwand: **sehr klein** — eine Formelzeile in `feldspielWert()`.
- Einordnung: „mitnehmen, nicht darauf bauen" (so auch die ursprüngliche Recherche selbst) — guter
  Begleiter zu Idee 1, kein eigenständiger Rang-Kandidat.

### Idee 4 — Gezielte Mini-Korrektur der verbleibenden Pp-Verletzer (Rezept-Ebene, Opus-nah)

**Was sich ändert:** Task #99 (`5e5916d25`) dokumentiert in der eigenen Commit-Beschreibung einen
offenen Rest: dexterity (+5,4 Pp, 2,0 SE über Matrix), awareness und will leicht über Matrix — alle
drei als Renormierungs-Nebeneffekt der stamina/spirit-Verschiebung, ohne dass ihre eigenen
Sub-Skills angefasst wurden. Vorschlag: nach genau demselben, bereits bewährten Muster wie Task #99
selbst (kleine, einzeln gemessene Verschiebung in GENAU den Sub-Skills, die das jeweilige Attribut
UND einen echten Live-Kanal tragen; bei einem ersten Zielkonflikt die Verschiebung halbieren statt
verwerfen) die drei verbleibenden Verletzer gezielt nachjustieren — **keine** neue Sondierung,
**kein** Sinkhorn-Vollrebuild, nur die gleiche Handarbeit an drei weiteren, kleineren Stellen.

**Erwartete Wirkung:** unbekannt in der Größe, aber die Methode selbst ist am selben Rezept bereits
zweimal erfolgreich gewesen (stamina/spirit-Verschiebung senkte Pp klar, ohne rho aus der
Kader-Spannweite zu bewegen). Realistische Erwartung: Pp sinkt weiter in Richtung des angestrebten
<15, ohne dass rho sich nachweisbar bewegt — genau das Muster, das CLAUDE.md als Zielkonflikt-Vorrang
beschreibt (rho geht vor, aber hier ist gar kein Konflikt zu erwarten, weil die Verschiebung so
klein bleibt).

**Prämissen-Check:**
- rho: **Risiko gering**, nach demselben Muster wie Task #99, aber **nicht automatisch
  risikofrei** — Task #99s eigene erste (volle) Fassung brach selbst einen neuen Cap (spirit auf
  15,8 % statt 12), erst die halbierte Fassung blieb capkonform. Jede Korrektur muss also wieder
  gemessen und bei Bedarf halbiert werden, nicht nur geschätzt.
- Pp: **Ziel genau dafür gebaut** — adressiert direkt die drei dokumentierten Restverletzer.
- Matrix: unangetastet.
- Budget-Methode: bewusst **nicht** die volle Sinkhorn-Variante (s. Opus-Abschnitt 1.1), sondern
  dieselbe gezielte Handarbeit, die bei Hockey bereits zweimal besser abgeschnitten hat als
  Sinkhorn.
- Aufwand: **klein** — eine Messrunde, keine neue Mechanik.

### Matrix-Ausnahme: geprüft, nicht empfohlen

CLAUDE.md verlangt, die Matrix-Sperre bei jeder Disziplin erneut zu respektieren, nicht erneut zur
Debatte zu stellen — diese Runde tut das nicht, prüft aber, ob eine der vier Ideen oben überhaupt
eine Matrixänderung nötig **machen** würde. Antwort: **nein, keine der vier**. Alle vier arbeiten
innerhalb bestehender Sub-Skills mit bereits erlaubten Attributen oder an der Wertformel, nicht an
`official-discipline-weights.ts`. Sollte eine spätere Runde doch einen Fall finden, der eine
Matrixänderung bräuchte, gilt die am 15.11. dokumentierte Ausgleichspflicht
(`docs/design/matrix-ausgleichspflicht-15-11.md`, aktuell noch auf einem eigenen, nicht gemergten
Branch, aber bereits Chris' ausdrückliche Vorgabe): jede Erhöhung in einer Zeile braucht eine
Senkung in derselben Zeile bei einer oder mehreren anderen Disziplinen, damit die Zeilensumme
innerhalb 166/167 bleibt, mit gesichertem Ursprungsstand und nachgerechneter neuer Summe. Für
Hockey gibt diese Runde dafür **keinen Anlass** — festgehalten, damit eine künftige Runde die Frage
nicht erneut von Null aufwirft.

---

## 3. Prämissen-Check, zusammengefasst

| Idee | rho >0,80 (Ziel 0,85) | Pp ≤25 (Ziel <15) | Matrix unangetastet | Budget-Methode bevorzugt | Aufwand |
|---|---|---|---|---|---|
| 1 Zoneneintritt-Zweikampf | wahrscheinlich positiv, **ungemessen** final | architektonisch unproblematisch, **ungemessen** final | ja | ja (von Anfang an korrelationsgeprüft) | groß |
| 2 Netfront-Schirm/Ablenker | unbekannt, vermutlich klein positiv | unproblematisch | ja | ja | mittel |
| 3 Tore halb als xG | **positiv, gemessen** (+0,016) | nicht betroffen | ja | n/a (keine Attributänderung) | sehr klein |
| 4 Mini-Pp-Korrektur (dexterity/awareness/will) | Risiko gering, muss re-gemessen werden | **Ziel direkt** | ja | ja (gezielt, nicht Sinkhorn-Vollrebuild) | klein |
| Sinkhorn-Vollumstellung (Opus-Frage) | **nein — zweimal reproduziert schlechter** | würde auf ~0 fallen | ja | — | — |

---

## 4. Rangliste und Empfehlung

1. **Idee 3 (xG-Buchung) sofort mitnehmen, unabhängig von allem anderen.** Gemessen, positiv,
   keine Rezeptberührung, kein Zielkonflikt — der einzige Vorschlag in diesem Bericht, der schon
   heute ohne weitere Messrunde empfehlbar ist.
2. **Idee 1 (Zoneneintritt-Zweikampf) ist der einzige Vorschlag mit realistischem Weg über
   0,80** — aber eine eigene, größere Umsetzungs- und Messrunde, kein Teil dieser Analyse. Die
   Vorarbeit (Instrumentierung, blinde Validitätsmessung) existiert bereits in
   `hockey-naechster-hebel-recherche-fable.md`; der nächste Schritt ist der echte Zweikampf, nicht
   noch eine Recherche.
3. **Idee 4 (gezielte Pp-Mini-Korrektur) als kleine Nebenrunde**, wenn ohnehin am Rezept
   gearbeitet wird — adressiert direkt den von Task #99 selbst offen gelassenen Rest, mit der
   Methode, die bei Hockey nachweislich besser funktioniert als Sinkhorn.
4. **Idee 2 (Netfront) erst nach Idee 1**, wie die ursprüngliche Recherche selbst vorschlägt —
   kein eigenständiger erster Schritt.
5. **Die Sinkhorn-Vollumstellung (Opus' Prüfauftrag) wird nicht empfohlen.** Technisch machbar,
   aber zweimal dokumentiert und heute ein drittes Mal (Trockenlauf) bestätigt: sie tauscht
   Hockeys führendes, hoch mit der Eignung korrelierendes Attribut (power) gegen schwach oder
   negativ korrelierende (spirit, speed) und kostet dabei mehr rho, als sie an Pp gewinnt — ein
   klarer Fall von CLAUDE.mds eigener Vorrang-Regel „nicht die Pp-Zahl auf Kosten von rho
   optimieren".

**Was diese Runde nicht beantwortet:** eine neue, abnahmefähige (dreifach gepoolte) Pp-Zahl für den
heutigen Stand. Das bleibt die nächste reine Messaufgabe, bevor irgendeine der vier Ideen oben
tatsächlich umgesetzt wird — ohne eine frische Baseline lässt sich keine der erwarteten Pp-Wirkungen
nachher einordnen.

# Takeshi's Castle: das Gewimmel lesbar machen — K2-Konzeptpapier (14.10.)

**Konzeptrunde K2** aus `docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 5.2 (Task
#111, Punkt 10 aus `docs/design/chris-feedback-breite-runde-13-10.md`). Zwei der drei dort
skizzierten Wege sind unten **tatsächlich gebaut** (Klasse A, reine Anzeige) und als eigener PR
abnahmereif; der dritte (die bewegte Kamera) bleibt bewusst Papier — Begründung in Abschnitt 4.

Chris, 13.10., wörtlich: „bisher wirkt es sehr unübersichtlich mit den ganzen Teilnehmern aber da
hab ich gerade keine Idee wie man es besser machen könnte, nacheinander ist auch doof." Er hat
keine Lösung vorgegeben — das Konzeptpapier sollte laut Abschnitt 5.2 drei Wege prototypisch
gegeneinanderstellen: **T-Ü1 Hauptdarsteller**, **T-Ü2 Hindernis-Kamera (Wipeout-Schnitt)**,
**T-Ü3 Streckenband**.

`takeshi.tsx` meint `app/foundation/discipline-stage/arena/disciplines/takeshi.tsx` auf
`origin/main` `8cfa9e1b` (14.10., Stand nach PR #1204). Alle Änderungen liegen ausschließlich in
dieser einen Datei — `public/mockups/battle-mode.engine.js` (die Simulation) ist nicht angefasst,
damit ist rho **bit-identisch per Konstruktion**, nicht nur gemessen (Abschnitt 5).

---

## 0. Ergebnis vorab

1. **Zwei der drei Wege sind gebaut, nicht nur skizziert.** T-Ü3 (Streckenband) und eine
   *statische* Fassung von T-Ü1 (Hauptdarsteller-Hervorhebung ohne Kamerabewegung) laufen in
   `takeshi.tsx`, Klasse A, rho bit-identisch, Linting sauber. Die Empfehlung aus Abschnitt 5.2 des
   Master-Papiers — T-Ü3 als Rückgrat, T-Ü1 fürs Hauptbild, T-Ü2 nur als Stationstafel — wird damit
   eingehalten, nur dass T-Ü1 hier ohne Kameraschnitt auskommt (Begründung Abschnitt 2.2).
2. **Der Massen-Eindruck sinkt sichtbar**, nicht nur behauptet: Vorher/Nachher-Screenshots
   (Abschnitt 3) zeigen denselben Start-Cluster einmal als gleich große, gleich satte Kreis-Masse
   und einmal mit zwei bis vier klar größeren, benannten Läufern vor einer kleineren, entsättigten
   Masse.
3. **Die Namensschild-Zahl ist ein Überraschungsbefund, keine Bestätigung.** Die Messung
   (Abschnitt 5) zeigt: die Zahl der *Schilder* sinkt nicht (Rang-Badges heute ~3,7 im Schnitt,
   danach ~5,0 inkl. Namen) und die Zahl der *überlappenden Paare* steigt sogar leicht (0,0 → 0,3
   je Frame) — weil ein Name mehr Platz braucht als „#7". Das ist kein Totschlagargument gegen
   T-Ü1, aber es bedeutet: die statische Fassung allein reicht nicht, wenn zwei Hauptdarsteller
   zufällig nebeneinanderliegen. Das genau ist die Aufgabe der *dynamischen* Kamera (Abschnitt 4),
   die hier bewusst nicht gebaut wurde.
4. **Die bewegte Kamera (Crop + Schnitt, 4 s Mindestverweildauer) bleibt offen.** Sie berührt den
   gemeinsamen Host (`DisciplineStageNativeArena.tsx`), nicht nur das Takeshi-Feld, und das
   Master-Papier verlangt vorher zu klären, ob der Burg-Endstand bei einer Ausschnittkamera noch
   lesbar bleibt — eine Frage, die sich nur per Sichtprüfung beantworten lässt, nicht per Probe.
   Frage 1 an Chris (Abschnitt 6).
5. **T-Ü2 (Wipeout-Schnitt) ist nicht gebaut**, wie vom Master-Papier selbst empfohlen („nur als
   Stationstafel im Ticker-Ersatz") — dafür reicht die ehrliche Einschätzung in Abschnitt 4.3, kein
   Prototyp.

---

## 1. Was heute da ist (Recherche)

`takeshis-castle` teilt sein Primitive (`parcours`) mit Football, bekommt aber eine eigene
Feld-Komponente (`takeshi.tsx`, 517 Zeilen vor dieser Runde) statt des generischen Stubs
(`parcours.tsx` → `shared.tsx`, den nur Football nutzt). Das Feld zeichnet:

- einen gezeichneten Serpentinen-Pfad (`bandD`) mit fünf Geländezonen und zehn Fallenbildern (reine
  SVG-Symbole, Ziel 3 vom 10.09.),
- bis zu 32 Läufer-Token (`sorted`), auf neun Bahnen quer zur Route aufgefächert, **alle in
  derselben visuellen Sprache**: Logo/Farbfallback, Team-Rahmen, ein optionaler Rang-Badge
  (`showBadge = isOwn || rank ≤ 3 || hoverIdx === idx`, `benchmark.tsx`) und eine rang-abhängige
  Größe (`tokenRankScale`: Rang 1 bis zu 1,5× größer als ab Rang 13, quadratisch abfallend).

Die Rang-Skalierung sorgt also bereits heute dafür, dass der Führende größer wirkt als das
Mittelfeld — aber sie unterscheidet nicht nach **Erzähl-Rolle**. Wer gerade an einer Falle hängt,
kann auf Rang 24 liegen und bleibt dann genauso klein wie alle anderen ab Rang 13. Genau diese
Lücke adressiert T-Ü1 unten.

**Q5 (die generische Bahn-Overlay-Tafel, Master-Papier Abschnitt 3.5) existiert noch nicht** — sie
ist für fünf Disziplinen (Spurt, Staffel, Takeshi, Climbing, Time-Trial) geplant, aber in keiner
davon gebaut (Repo-weite Suche nach „Streckenband"/„BahnOverlay" ohne Treffer). T-Ü3 unten baut
deshalb eine **Takeshi-eigene**, einfachere Variante (gerade Linie statt echter Serpentinen-Form,
genau wie das Master-Papier es für T-Ü3 vorschlägt: „die Strecke als Linie"), nicht die generische
Fünf-Disziplinen-Tafel — das bleibt ein separater, größerer Baustein für eine eigene Runde.

`N` (Teilnehmerzahl) ist produktionsnah **12** (nachgemessen über
`scripts/miss-alle-disziplinen.mjs 3 takeshis-castle --einzelkader`: „Teiln. 12"), der Dev-Harness
(`/dev-arena`) testet dagegen immer mit 32 synthetischen Teams (Stresstest-Absicht, s.
`buildTeams()`-Kommentar). Die Auswahl-Logik unten ist für beide Größen geschrieben.

---

## 2. T-Ü1 Hauptdarsteller — gebaut (statischer Teil)

### 2.1 Was

Drei bis vier Läufer bleiben in normaler Chrome-Größe und bekommen zusätzlich einen dauerhaften
Namens-Schriftzug (nicht nur bei Hover). Die Auswahl, reine Ableitung aus bereits vorhandenen
Größen (kein neuer Zufallszug, nichts fließt zurück in `score`/`rank`):

| Rolle | Regel |
|---|---|
| Führender | `sorted[0]` |
| Eigener Bester | erstes `isOwn`-Team in `sorted` |
| Hängt an einer Falle | kleinster positiver Abstand zur nächsten noch nicht passierten Falle (`FALLEN_FRACS`) |
| Hat die Burg erreicht | am weitesten vorn mit Fortschritt ≥ 98 % |

Alle anderen werden kleiner (0,62×) **und** entsättigt gezeichnet (`filter: saturate(0.35)
brightness(0.92)`, `opacity: 0.6`) — „Figur in Teamfarbe bleibt sichtbar, tritt aber zurück", wie
das Master-Papier es für T-Ü1 fordert. Die Hauptdarsteller werden zusätzlich ans Ende der
Zeichenreihenfolge verschoben, damit sie nie von der (jetzt kleineren) Masse überdeckt werden,
unabhängig vom eigenen Rang — wichtig gerade für „hängt an einer Falle", die oft NICHT auf den
vorderen Rängen liegt.

### 2.2 Was bewusst NICHT gebaut ist: die Kamera

Das Master-Papier beschreibt T-Ü1 mit einer **Regie**, die zwischen Hauptdarstellern schneidet
(Muster: Time-Trials J2-Kameraautomatik, `bahnFokusAuto`, 4 s Mindestverweildauer,
`time-trial-nachtkonzept-03-10.md` Abschnitt 3.3) — ein tatsächlicher Kamera-Crop/-Schwenk über das
Feld. Diese Runde baut das **nicht**, aus drei Gründen:

1. **Scope.** Ein Kamera-Crop ändert den `viewBox`/Zoom-Zustand, den `DisciplineStageNativeArena.tsx`
   (der gemeinsame Host für alle 20 Disziplinen) verwaltet, nicht `takeshi.tsx` allein. Das ist ein
   Eingriff in gemeinsame Infrastruktur, kein Takeshi-lokaler Baustein mehr.
2. **Die offene Frage aus dem Master-Papier ist genau diese.** Abschnitt 5.2 verlangt explizit zu
   klären, „ob der Burg-Endstand bei Ausschnittkamera noch lesbar bleibt" — das ist eine
   Sichtprüfungs-Frage, die nur mit echten Kaderpaarungen und Chris' Auge zu beantworten ist, nicht
   mit einer weiteren Probe. Eine Kamera zu bauen, bevor diese Frage beantwortet ist, hieße,
   Sendezeit-Verhalten (Klasse T, braucht Chris' ausdrückliche Zustimmung laut CLAUDE.md) vor der
   Klärung zu committen.
3. **Die statische Fassung ist der ehrlichere erste Schritt.** Sie liefert bereits den Hauptteil
   des Nutzens (klare Größen-/Sättigungs-Hierarchie, s. Screenshots unten) ohne Sendezeit oder
   Spielablauf zu berühren — Klasse A, kein Chris-Veto nötig, sofort abnahmereif.

Ein Prototyp der bewegten Kamera (Crop-Zoom auf den jeweiligen Hauptdarsteller, 4 s Verweildauer,
analog `bahnFokusAuto`) ist technisch der naheliegende nächste Schritt, sobald Frage 1 (Abschnitt 6)
beantwortet ist — er gehört dann in eine eigene Runde, die den Host anfasst.

---

## 3. T-Ü3 Streckenband — gebaut

Ein schmales, halbtransparentes Band über dem oberen Bildrand (y 0–16 der viewBox, vor Titel/
Sonne/Konfetti platziert, hinter der Burg unberührt — Q5-Regel „Overlay darf die Strecke nicht
verdecken" eingehalten): eine gerade Linie von Start- zu Burg-Symbol, die zehn Fallen als Striche
(die zuletzt passierte grün hervorgehoben, dieselbe `gluehIdx`-Größe wie die Fallenbilder im
Hauptbild — kein zweiter Rechenweg), und **jeder** Läufer (nicht nur die Hauptdarsteller) als Punkt
in Teamfarbe (`teamPrimaryColor`, dieselbe Quelle wie überall im Projekt). Das eigene Team ist
größer mit weißem Rand.

Bewusste Design-Entscheidung: die Fortschritts-Fraktion kommt direkt aus `FALLEN_FRACS`/
`animScore` (derselben Zahl, die auch die Token-Position auf dem Hauptbild bestimmt), **nicht**
aus dem gezeichneten Serpentinen-Pfad (`getPointAtLength`) — das Band ist bewusst eine **gerade**
Linie, wie das Master-Papier es für T-Ü3 vorschlägt, und braucht deshalb nicht auf den Mess-Pfad im
DOM zu warten (kein Layout-Sprung beim Mount, anders als die Zonenbänder/Fallenbilder im
Hauptbild).

Der Sinn: „die Gesamtlage auf einen Blick" bleibt erhalten, selbst wenn das Hauptbild irgendwann
(nach Frage 1) ein Ausschnitt ist. Das Band ist bereits HEUTE nützlich (auch ohne Kamera-Crop), weil
es zeigt, wo die *entsättigte Masse* gerade steckt, die im Hauptbild nach T-Ü1 kleiner und
unauffälliger geworden ist.

---

## 4. T-Ü2 Hindernis-Kamera (Wipeout-Schnitt) — nicht gebaut, bewusst

Das Master-Papier stuft T-Ü2 selbst am niedrigsten ein: „nur als Stationstafel im Ticker-Ersatz".
Eine Stationstafel („Die Mauern: 7 von 12 durch · 3 im Schlamm") ist mit den jetzt vorhandenen
Bausteinen leicht nachrüstbar (Zähler je Falle aus `fallenPunkte`/`trackFrac` ableitbar, exakt wie
der `gluehIdx`-Mechanismus heute schon die zuletzt passierte Falle kennt) — aber sie ersetzt den
Ticker, der eine andere, bereits funktionierende Erzählform ist (`engine.js`-Ticker-Zeilen je
Ereignis). Das jetzige T-Ü3-Band deckt den Kern von T-Ü2s Nutzen (Fallen-Fortschritt auf einen
Blick) bereits ab — eine weitere, konkurrierende Stationstafel würde dieselbe Information zweimal
zeigen. Frage 4 (Abschnitt 6) fragt Chris, ob sich der Rest trotzdem lohnt.

---

## 5. Messung

### 5.1 rho — bit-identisch, per Konstruktion UND nachgemessen

`public/mockups/battle-mode.engine.js` ist in diesem PR nicht geändert (`git diff --stat`: nur
`takeshi.tsx`). Die Simulation läuft unverändert; rho kann sich nicht bewegt haben. Zur
Bestätigung trotzdem eine Probe:

```
node scripts/miss-alle-disziplinen.mjs 3 takeshis-castle --einzelkader
```

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme
takeshis-castle     bahn           12                  0.858       0.000                0.916       0.000   bestanden
```

Deckt sich mit dem dokumentierten Stand (`stand-aller-disziplinen.md`: 0,874 kaderfest) innerhalb
der üblichen Kaderstreuung — keine Überraschung, da die Probe den Motor direkt testet, nicht die
React-Darstellung.

### 5.2 Linting/Typecheck

`npx eslint app/foundation/discipline-stage/arena/disciplines/takeshi.tsx` liefert nach dieser
Runde **dieselben zwei** Warnungen wie auf `origin/main` (ein `eslint-disable`-Fehlalarm, eine
unescaped-entity-Warnung — beide vor dieser Runde entstanden, keine neuen). `npx tsc --noEmit`
zeigt in der geänderten Datei keine Fehler (die 912 Zeilen Repo-weiter tsc-Fehler sind
vorbestehende Test-Typfehler in `tests/transfermarkt-*.test.ts`, unabhängig von dieser Runde,
geprüft per Vergleich gegen `origin/main`).

Eine erste Fassung verpackte die neue Zeichenreihenfolge in eine im JSX aufgerufene
Inline-Funktion (`{(() => { … })()}`); das löste eine neue Warnung aus
(`react-hooks/refs`: „Cannot access refs during render" an der `tokenRef`-Stelle). Behoben durch
Verschieben der Ableitung (`tokenZeichenreihenfolge`, `bandX0/X1/Y`) auf Komponentenebene, vor dem
`return` — derselbe flache Aufbau wie im Rest der Datei. Lehre für künftige Agenten an dieser
Datei: Ableitungen vor `return`, nicht als IIFE im JSX.

### 5.3 Namensschild-Überlappung — der vom Master-Papier verlangte Messpunkt

Playwright gegen `/dev-arena` (`takeshis-castle`), Rang-Badges (Textmuster `#n`/`★ #n`) und die
neuen Hauptdarsteller-Namen (`data-testid="hauptdarsteller-name"`) als „Namensschilder" gezählt,
echte `getBoundingClientRect()`-Rechtecke paarweise auf Überlappung geprüft:

| | vorher (nur Rang-Badges) | nachher (Badges + Hauptdarsteller-Namen) |
|---|---:|---:|
| Schilder je Frame (Schnitt über 3 Zeitpunkte) | 3,7 | 5,0 |
| überlappende Paare je Frame (Schnitt) | 0,0 | 0,3 |

**Ehrlich gelesen, nicht schöngerechnet:** die Zahl der überlappenden Paare sinkt NICHT, sie steigt
leicht. Der Grund ist einfach — ein Name wie „Team GG" ist ein Vielfaches breiter als „#7", und
wenn zwei Hauptdarsteller (z. B. Führender und eigener Bester, wenn das eigene Team vorn liegt)
nahe beieinanderstehen, kollidieren ihre Namen eher als zwei schmale Rang-Badges es täten. Das ist
exakt die Lücke, die eine **bewegte** Kamera (Abschnitt 2.2, Frage 1) schließen würde — zeitlich
statt räumlich trennen, statt beide gleichzeitig im selben Frame zu beschriften.

**Einschränkung, der CLAUDE.md-Lehre aus der Vier-Saaten-Geschichte folgend:** `/dev-arena` hat
keinen Seed-Schalter für unterschiedliche Kaderpaarungen (`buildTeams()` ist deterministisch, immer
dieselben 32 Codes). Die drei Messpunkte oben sind drei Zeitpunkte **desselben** Laufs, nicht drei
Paarungen — ein Ersatz, kein Beweis. Die vom Master-Papier verlangte Sichtprüfung „mit drei
Kaderpaarungen" (Abschnitt 5.2) braucht echte Spielstände; Agenten kommen an den Server nicht heran
(CLAUDE.md), ein `live-save`-Abbild über `git fetch origin live-save` wäre der nächste Schritt,
wenn Chris eine belastbarere Zahl will, als dieses Papier liefern kann.

### 5.4 Sichtbefund (Screenshots, `/dev-arena`, `takeshis-castle`)

- `docs/design/takeshi-uebersicht-vorher-cluster-14-10.png` /
  `-nachher-cluster-14-10.png`: derselbe Start-Cluster — vorher eine gleich große, gleich satte
  Kreismasse; nachher zwei klar größere, benannte Läufer vor einer kleineren, entsättigten Masse.
- `docs/design/takeshi-uebersicht-vorher-band-14-10.png` /
  `-nachher-band-14-10.png`: derselbe obere Bildrand — vorher nur Himmel/Sonne, nachher das
  Streckenband mit Start-/Burg-Symbol, Fallen-Strichen und Läufer-Punkten.

---

## 6. Fragen an Chris

1. **Soll die bewegte Kamera (T-Ü1-Regie bzw. T-Ü2-Wipeout-Schnitt) überhaupt gebaut werden?**
   Das ist der eigentliche Kern von Abschnitt 5.2 im Master-Papier und bleibt hier bewusst offen
   (Abschnitt 2.2). Sie würde Sendezeit/Bildausschnitt verändern (Klasse T) und den gemeinsamen
   Host anfassen. Falls ja: reicht ein Prototyp mit festem 4-s-Takt (wie Time-Trials J2), oder soll
   die Verweildauer länger sein, solange die Burg-Zielankunft noch nicht lesbar genug getestet ist?
2. **Passt die Hauptdarsteller-Auswahl** (Führender · eigener Bester · an-einer-Falle-hängend ·
   Burg erreicht)? Eine naheliegende Erweiterung wäre „wer wurde gerade überholt" — bewusst nicht
   aufgenommen, weil das einen Zeitvergleich (vorheriger vs. aktueller Rang) bräuchte, der heute
   nirgends im Feld vorgehalten wird.
3. **Reicht die statische Fassung als erster Wurf**, obwohl Frage 5.3 zeigt, dass zwei benachbarte
   Namen gelegentlich kollidieren — oder soll vor dem Merge schon eine einfache Ausweich-/
   Stapel-Logik für die Namens-Labels mit rein (z. B. vertikal versetzen, wenn zwei Hauptdarsteller
   horizontal nah beieinanderliegen)? Das wäre noch Klasse A, aber mehr Aufwand als dieser PR.
4. **Lohnt sich die T-Ü2-Stationstafel** („Die Mauern: 7 von 12 durch") trotzdem als Ticker-Zusatz,
   obwohl das neue Streckenband densselben Fallen-Fortschritt schon zeigt — oder deckt das Band den
   Bedarf?

---

## 7. Synergie mit Task #9 (Takeshi-Performance-Diagnose)

Das Master-Papier (Abschnitt 4.4) notiert: „wenn Takeshi weniger Figuren in voller Größe zeichnet
(s. 5.2), sinkt auch die Zeichenlast." Nach dieser Runde zeichnen bei N=12 maximal 3–4 Token in
voller Chrome-Größe (Logo-Clip, alle Ringe), der Rest kleiner mit demselben Chrome, aber bei 0,62×
Radius — weniger Pixel pro Frame, auch wenn die Knotenzahl im DOM gleich bleibt. Ob das die in
Task #9 beobachtete Zeichenzeit tatsächlich senkt, bleibt eine Messfrage für die dortige
Diagnose-Runde (Chrome-Performance-Profil bei 1×/4×), nicht Teil dieses Papiers.

---

## Anhang: Klassen

| Baustein | Klasse | Begründung |
|---|---|---|
| T-Ü3 Streckenband | A | reine Anzeige, kein `rr()`, kein neues Sim-Feld, `engine.js` unberührt |
| T-Ü1 statisch (Größe/Sättigung/Name) | A | dieselbe Begründung — Auswahl liest nur `animScore`/`isOwn`, schreibt nie zurück |
| T-Ü1 Regie (Kamera-Crop + Schnitt) | **T** (noch nicht gebaut) | verändert Bildausschnitt/Sendezeit-Erleben, Host-weit — braucht Chris' ausdrückliche Zustimmung vor dem Bau |
| T-Ü2 Wipeout-Schnitt | **T** (noch nicht gebaut) | dieselbe Begründung; vom Master-Papier selbst niedrig priorisiert |
| T-Ü2 Stationstafel (Ersatz) | A (wenn gewünscht) | reine Anzeige, Frage 4 an Chris vor dem Bau |

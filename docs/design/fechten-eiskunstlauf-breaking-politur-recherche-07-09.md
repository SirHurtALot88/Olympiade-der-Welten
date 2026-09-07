# Fechten, Eiskunstlauf, Breaking — Politur-Recherche (07.09.)

**Reine Recherche. Keine Codeänderung im Commit, alle Messungen in einem eigenen Worktree
(`/tmp/wt-fable-buehne-politur`) gegen `origin/main` = `7a70413e` gefahren, die Engine-Datei
danach jedes Mal per `git checkout` zurückgesetzt.** Der geteilte Arbeitsbaum trug beim Start
dieser Runde einen unfertigen, unkommittierten Diff einer parallelen Tennis-Rezept-Session an
`battle-mode.engine.js` — dieser Diff wurde nicht gelesen, nicht verändert, nicht Teil dieser
Recherche. Alle Zeilenangaben unten sind gegen den sauberen `origin/main`-Stand geprüft.

Alle drei Baselines frisch nachgemessen (`node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf
breaking fechten`), nicht aus einem Dokument übernommen — sie bestätigen CLAUDE.md und
`docs/pm-briefings/pm-gesamtstand-07-09.md` Abschnitt 1 exakt:

| Disziplin | rho/Spiel | Spannweite | rho/Saison | Schranke | Status |
|---|---:|---:|---:|---:|---|
| Fechten | 0,816 | 0,192 | 0,888 | 0,058 | bestanden |
| Breaking | 0,804 | 0,133 | 0,937 | 0,050 | bestanden (knapper Puffer) |
| Eiskunstlauf | 0,792 | 0,130 | 0,944 | 0,050 | knapp durchgefallen |

Keine der drei hat je einen eigenen Bug-Report von Chris bekommen (`git ls-tree -r --name-only
origin/bug-reports` — letzter Eintrag 25.08., keiner nennt eine der drei Disziplinen), keine
dedizierte Kalibrierrunde, keinen Visual-Polish-Durchgang seit dem Chassis-Umzug
(`tennis-fechten-buehne-umsetzung.md`, 03.09., für Fechten; Eiskunstlauf/Breaking liefen als
„Buehnen-Durchgaenge mit eigenem Rezept" nie eigenständig an, s.
`docs/design/stand-aller-disziplinen.md` Abschnitt 5b). Genau die Tennis-Vorgeschichte, nur ohne
den Chassis-Fehlgriff, den Tennis hatte.

---

## 0. Ergebnis vorab

1. **Keine der drei hat Tennis' Problem.** Tennis' Rezept ist wörtlich „1:1 aus dem alten
   Feldspiel-Rezept übernommen, nicht neu kalibriert" (`battle-mode.engine.js:10778`). Fechten,
   Eiskunstlauf und Breaking haben jeweils ein **eigenes** `rezept`-Objekt, aus der **eigenen**
   Matrix gebaut (Abschnitt 1.2 unten) — der stärkste vermutete Hebel aus dem Auftrag greift hier
   nicht. Das ist selbst ein Befund, kein Nichtergebnis: es sagt, wo NICHT zu suchen ist.
2. **Der eigentliche Visualfehler ist in allen drei identisch und schwerer als vermutet: jede
   Buehnen-Disziplin außer Gewichtheben und Speed-Schach zeichnet einen Kampf-Waffenschwung als
   Erfolgs-/Fehlschlag-Pose — unabhängig von der Disziplin.** Ein Fechter mit einer zufällig
   zugewiesenen Axt schwingt beim Treffer eine Axt (nachgestellt, Screenshot Abschnitt 2.1). Ein
   Eiskunstläufer oder Breaker mit derselben Kosmetik würde beim Sprung/Move exakt dieselbe Axt
   schwingen oder einen Bogen spannen — der Code unterscheidet nicht nach Disziplin, nur nach der
   festen Waffen-Kosmetik des Charakters (`battle-mode.engine.js:2575`, `:846/897/1027`).
   **Entscheidung: eine kleine, pro Disziplin gezielte Zeichenüberschreibung**, nach demselben
   Muster wie die bereits existierende Football-Ausrüstungs-Überschreibung — Fechten bekommt
   IMMER die Schwert-Waffenebene (die einzige vorhandene Klingenwaffe), Eiskunstlauf und Breaking
   bekommen IMMER GAR KEINE Waffenebene. Kein neues Asset, ein Zeilenumfang wie bei der
   Football-Ausrüstung. Erwartete rho-Wirkung: null (reines Aussehen, keine Zahl geändert).
   **Randbefund außerhalb des Auftrags:** derselbe Bug betrifft auch Tennis, Wettessen, I-Spy —
   und **Showcase**, eine der drei LIVE geschalteten Buehnen-Disziplinen (ein Showcase-Auftritt
   kann also heute schon live mit einem Axtschwung enden). Nicht Teil dieser Empfehlung (andere
   Disziplin, Produktionscode, eigene Sorgfaltsstufe) — hier nur benannt, damit es nicht
   untergeht.
3. **Eiskunstlauf und Breaking haben ein Verlässlichkeitsproblem, keins der Validität — und hier
   hilft mehr Ereignisdichte tatsächlich, entgegen der Hockey-Lehre in CLAUDE.md.** Beide
   Saisonzahlen sind mit 0,944 und 0,937 exzellent (höher als Fechtens 0,888!) — die Mechanik
   belohnt bereits über eine Saison das Richtige. Was fehlt, ist Verlässlichkeit im EINEN Spiel:
   Breaking hat mit 4 Durchgängen die niedrigste Zahl aller neun Buehnen-Disziplinen, deutlich
   unter Fechten/Tennis/Speed-Schach (je 10) und Wettessen (8). Eiskunstlauf liegt mit 6
   Durchgängen im Mittelfeld (gleichauf mit I-Spy, mehr als Showcases 5) — hier zieht nicht die
   Positionierung im Feld, sondern die konkrete Zahl gegen die reale Kür (s. Abschnitt 3.3).
   Gemessen (Abschnitt 3): Verdopplung der
   Durchgangszahl (Eiskunstlauf 6→12, Breaking 4→8), bei gleichzeitig halbierter
   `rundenDauer`, damit die Gesamtdauer bei Chris' Ziel von ~60 s bleibt, hebt **Eiskunstlauf auf
   0,875 (n=24) / 0,887 (n=96)** und **Breaking auf 0,869 (n=24) / 0,873 (n=96)** — beide über
   dem 0,85-Zielwert, beide mit spürbar engerer Spannweite (0,075 bzw. 0,114 statt 0,130 bzw.
   0,133). Die Änderung ist eine reine Zahl in den beiden `BUEHNE_ART`-Einträgen, keine Änderung
   an geteiltem Code (Abschnitt 4).
4. **Der Grund, warum das hier funktioniert und bei Hockey nicht, ist strukturell, nicht
   Zufall.** Hockeys Verdopplung scheiterte, weil ihr Live-Motor pro Tick neue `rr()`-Würfe zieht
   und ein einzelnes, oft gewürfeltes Ereignis (Zoneneintritt) die ganze Messung dominieren kann
   — mehr Zeit bedeutet dort mehr KASKADIERTES Rauschen, nicht mehr saubere Stichprobe. Die
   Buehnen-Auftrittsformel (`battle-mode.engine.js:10926-10940`) hat keine Kaskade: jeder
   Durchgang ist ein einzelner, unabhängiger Erfolg/Fehlschlag-Wurf, alle im Voraus berechnet.
   Das ist ein Lehrbuch-Fall für die Spearman-Brown-Formel — mehr unabhängige Messungen senken
   die Varianz der Summe, ohne die Validität zu berühren. Nachgemessen statt angenommen (s.
   Abschnitt 3.3): die Saisonzahlen bewegen sich kaum (Eiskunstlauf 0,944→0,965/0,986,
   Breaking 0,937→0,951/0,958), die Einzelspielzahlen springen genau wie die Reliabilitäts-
   Formel vorhersagt.
5. **Zusätzlich ist die höhere Durchgangszahl selbst realistischer, nicht nur eine
   Zahlenkosmetik.** Ein echtes Kürprogramm hat unter dem ISU-Wertungssystem rund ein Dutzend
   gewertete Elemente (Sprünge, Pirouetten, Schrittfolge, Choreo-Sequenz) — 6 war strukturell zu
   wenig für „ein Programm", 12 trifft die reale Größenordnung deutlich besser. Ein Breaking-
   Battle-Auftritt besteht aus mehreren unterscheidbaren Bewertungsmomenten (Einstieg, Power-
   Move, Freeze/Ausstieg, oft über zwei Durchgänge) — 8 ist die vorsichtigere, aber immer noch
   plausible Verdopplung von 4, nicht ein beliebig gewählter Zielwert.
6. **Fechtens Rezept ist ein erster, ausdrücklich unfertiger Sieben-Rollen-Entwurf — bestanden,
   aber mit einem Puffer, der kleiner ist als das eigene Kaderrauschen.** 0,816 liegt nur 0,016
   über der Schranke, während dieselbe Disziplin bei unveränderter Mechanik allein durch andere
   Kaderpaarungen um 0,192 schwankt. Eine andere Ziehung derselben sechzig Spieler könnte
   ebenso gut unter 0,80 liegen. Das ist **kein Grund für einen Rezeptumbau in dieser Runde**
   (Chris' Budget-Methode ist teuer, und Fechten hat eine höhere Saisonzahl als der 0,80-Balken
   verlangt) — aber ein Grund, es in der nächsten Rangtreue-Neumessung im Auge zu behalten, statt
   „bestanden" für endgültig zu halten.
7. **Kollisionsrisiko ist gering und beherrschbar, wenn die Umsetzung sich an zwei Regeln hält:**
   Rezept-/Timing-Zahlen nur in den drei eigenen `BUEHNE_ART`-Einträgen ändern, die
   Zeichen-Überschreibung nur über einen neuen, disziplin-spezifischen Zweig nach dem
   Football-Gear-Muster (nie die gemeinsame `lunge`/`stepBuehne`-Logik selbst). Details und
   Reihenfolge in Abschnitt 4.

---

## 1. Rezept-Herkunft: keine der drei ist ein Tennis-Fall

### 1.1 Was Tennis falsch macht, zur Kontrastfolie

`battle-mode.engine.js:10769-10800`, Kommentar zu `BUEHNE_ART.tennis`:

> „REZEPT 1:1 AUS FELDSPIEL_ART.tennis UEBERNOMMEN, nur auf die sieben Buehnen-Rollennamen
> umbenannt — KEINE Gewichtsaenderung. […] AUFBAU->GRUNDLAGE, ABSCHLUSS->SPITZENMOMENT,
> ZWEITCHANCE->NERVEN, ABWEHR->WAGNIS, TEAMGEIST->PUBLIKUM — nur die Namen sind neu."

Tennis' Sprung von 0,505 auf 0,919 (Scratchpad-Test, nie committet) kam laut demselben
Kommentar „aus zwei bereits vorhandenen Buehnen-Eigenschaften, nicht aus dem Rezept selbst" —
der Chassis-Wechsel allein hat getragen, das Rezept war nie das, was den Unterschied machte.
Das ist die Lücke, an der die parallele Tennis-Runde gerade arbeitet (nicht Gegenstand hier).

### 1.2 Fechten, Eiskunstlauf, Breaking: jede mit einer eigenen, matrixabgeleiteten Rezeptur

`battle-mode.engine.js:10802-10830` (Fechten), Kommentar:

> „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf aus Fechtens realer Arena-Matrix
> (torment 25, dexterity 20, speed 16, awareness 15, power 10, determination 6, health 4,
> intelligence 4) — kein Charisma, Torment am staerksten vertreten (vier Rollen), genau wie die
> Matrix es vorgibt."

Das Rezept selbst (`GRUNDLAGE:{torment:45,dexterity:30,awareness:25}`, `SPITZENMOMENT:
{dexterity:40,speed:35,torment:25}`, …) trägt Fechtens eigene Matrixgewichte in jede Rolle,
nicht die einer anderen Disziplin. „Erster, nicht finaler Entwurf" heißt: keine Sinkhorn-
Kalibrierrunde wie bei Gewichtheben/Showcase, aber ein Entwurf **für Fechten gebaut**, nicht
kopiert.

`battle-mode.engine.js:10653-10667` (Eiskunstlauf) und `:10669-10691` (Breaking) tragen
denselben Charakter — je ein eigener Kommentarblock mit der eigenen Matrix, eigene
Rollenbelegung. Breaking hat sogar bereits **eine** dokumentierte Kalibrierrunde hinter sich
(Kommentar `:10676-10681`):

> „NACHGEZOGEN: erste Messung stand bei 68,4 Pp. Dexterity (Matrixgewicht 2, quasi irrelevant)
> sass in TECHNIK, der Erfolgschance-Rolle, und las dadurch 26,2 % — mehr als Wille (28, der
> Hoechstwert). […] Jetzt traegt Torment auch die Erfolgschance mit, Dexterity bleibt nur dort,
> wo die Matrix ihm ueberhaupt ein Gewicht gibt."

Eiskunstlauf hat diese eine Nachziehrunde nicht — nur den ursprünglichen Matrix-Kommentar, keine
Pp-Korrektur-Historie. Das ist auch der einzige inhaltliche Unterschied zwischen den beiden in
Abschnitt 1: Breakings Rezept wurde einmal gegen ein Pp-Ziel korrigiert, Eiskunstlaufs nie. Für
die Rangtreue in dieser Runde spielt das keine Rolle (der Hebel liegt woanders, s. Abschnitt 3),
aber es ist der Grund, warum Eiskunstlauf in Abschnitt 5b von `stand-aller-disziplinen.md` mit
„Rezept ein erster Entwurf" geführt werden sollte, sobald das Dokument nachgezogen wird.

**Fazit:** Wer eine Rezept-Ursache für Eiskunstlaufs/Breakings Rangtreue-Lücke vermutet hätte
(die naheliegende erste Hypothese nach dem Tennis-Fund), findet hier keine. Beide Rezepte
gewichten die eigene Matrix plausibel. Der Hebel liegt, wie Abschnitt 3 zeigt, an der
Ereigniszahl — die einzige Stelle, an der CLAUDE.mds generelle Warnung („mehr Ereignisse helfen
fast nie") tatsächlich nicht zutrifft, mit einer strukturellen Begründung dafür (Abschnitt 3.3).

---

## 2. Fechten

### 2.1 Visuelle Authentizität: ein Fechtduell, das eine Axt schwingt

Ich habe Fechten live im Mockup laufen lassen (Playwright, `public/mockups/battle-mode.html`,
echter Kader „Vigilante Wranglers" gegen „Armageddon Aftermath", derselbe Testkader wie in der
Battle-Mode-Kopfzeile des Mockups). Die Duell-Anzeige selbst funktioniert wie gedacht: pro
Brett ein laufender Vorteilsbalken (`+44 Vorteil` etc.), eine Ausfallschritt-Pose beim
enthüllten Treffer (`u.lunge`, `battle-mode.engine.js:11402`), eine Sieg/Niederlage-Spalte erst
nach dem letzten Zug (Spoiler-Schutz, `WERTUNG_DUELL`, `:11676`). Das ist solide gebaut.

**Was nicht passt: die Ausfallschritt-Pose ist ein Kampf-Waffenschwung, keine Fechtaktion —
und welche Waffe geschwungen wird, hat nichts mit Fechten zu tun.**

`battle-mode.engine.js:2575`:
```js
else if(u.lunge>0)ani=feldspiel?"shoot":((bogen||feuerwaffe)?"shoot":"slash");
```
Für jede Buehnen-Disziplin außer Gewichtheben (`heben:true`, eigenes Bühnenbild) und
Speed-Schach (`schach:true`, eigenes Bühnenbild) läuft ein „Treffer"/„Erfolg" auf genau diese
Zeile: eine Bogenschütze-Pose, wenn der Charakter kosmetisch einen Bogen trägt
(`b.waffe==="bogen"`), sonst eine Schwert-/Axt-/Stab-/Zweihänder-Schwungpose — abhängig davon,
welche Waffe der PERSÖNLICHEN Ausrüstung des Charakters zugewiesen ist
(`battle-mode.engine.js:846` Draco: `waffe:"axt"`, `:897` Johanna: `waffe:"schwert"`, `:1027`
Cassandra: `waffe:"bogen"` — eine feste Kosmetik-Eigenschaft, komplett unabhängig davon, in
welcher Disziplin der Charakter gerade antritt).

Der Beweis, nicht nur die Codelogik: im selben Testlauf performt „Draco" (Kosmetik `waffe:
"axt"`) im Fechten-Duell einen vollständigen Axtschwung mit sichtbarer Schwungspur, exakt in dem
Moment, in dem sein Treffer verkündet wird („+71" / „+35 Vorteil"):

*(Screenshot-Serie in `/tmp/wt-fable-buehne-politur/tmp-ux-audit-lunge-burst/`,
`crop-draco-f31.png` — nicht Teil dieses Commits, reproduzierbar mit
`node scripts/screenshot-fable-lunge-burst.mjs <out> fechten`.)*

Das ist optisch nicht von einem x-beliebigen Arena-Nahkampf zu unterscheiden — genau das
Problem, das die Chassis-Migration von der Arena auf die Bühne eigentlich beheben sollte
(`tennis-fechten-rollout-plan.md` Abschnitt A.4/E.2: „Fechten ist real ein 1-gegen-1-Gefecht,
keine Fuenf-gegen-fuenf-Auseinandersetzung — die Arena passte strukturell nie"). Das Rezept und
die Duell-Struktur wurden korrigiert, das Bild ist stehengeblieben.

### 2.2 Entscheidung

**Fechten bekommt beim Zeichnen IMMER die Schwert-Waffenebene, unabhängig von der Kosmetik des
Charakters.** Kein neues Asset — `schwert` ist bereits die Waffe mit der größten Nähe zu einer
Fechtklinge im vorhandenen Bestand (Degen/Florett/Säbel sind alle schlanke Klingenwaffen, ein
Kampfschwert ist optisch näher daran als Axt/Stab/Zweihänder/Bogen). Das ist exakt dasselbe
Muster wie die bereits gebaute Football-Ausrüstungs-Überschreibung:

`battle-mode.engine.js:2556-2572` (bestehendes Muster, zur Nachbildung):
```js
const feuerwaffe=!feldspiel&&FEUERWAFFEN.includes(b.waffe);
// FOOTBALL-AUSRUESTUNG (…): Disziplin-Override BEIM ZEICHNEN, dieselbe Idee wie istHockey()
// beim Schlaeger — KEIN Eingriff in die 124 Baupläne selbst: derselbe Charakter traegt in
// jeder anderen Disziplin/der Arena weiterhin sein eigenes b.ruest/b.helm.
const footballGear=feldspiel&&istFootball();
```

Der neue Zweig für Fechten braucht dieselbe Form: eine lokale Konstante
`const fechtenWaffe=istBuehne(buehneDisc)&&buehneDisc==="fechten"`, die an der Stelle, wo
`b.waffe` für die Wahl der Waffenebene gelesen wird (die `zeichneB`/`zeichne`-Aufrufe für
axt/stab/zweihaender/schwert weiter unten in `zeichneSprite`), `schwert` erzwingt statt
`b.waffe` zu lesen — **nur** wenn `fechtenWaffe` wahr ist, sonst unverändert. Kein Eingriff in
`b.waffe` selbst (der Charakter behält seine Kosmetik in jeder anderen Disziplin/Arena), kein
Eingriff in `ani`/`lunge` (die Slash-Pose passt zu einer geführten Klinge, sobald die Klinge
stimmt — die Pose selbst muss nicht neu gebaut werden).

**Erwartete rho-Wirkung: keine.** Dies ist eine reine Zeichenänderung, keine Zahl in `rezept`,
`erfolg` oder `punkte` wird berührt. Zur Bestätigung reicht ein Bit-Identisch-Test der Rangtreue
vor/nach der Umsetzung (`node scripts/miss-alle-disziplinen.mjs 24 fechten` — muss exakt
0,816/0,192/0,888/0,133 bleiben).

### 2.3 Rangtreue: kein Handlungsbedarf in dieser Runde, aber im Auge behalten

0,816 bestanden, mit einem Puffer (0,016) kleiner als die eigene Kaderspannweite (0,192, s.
Abschnitt 0 Punkt 6). Kein Rezeptumbau in dieser Runde — die Saisonzahl (0,888) liegt bequem
über der Schranke, und Chris' Budget-Methode für ein Rezeptfeintuning ist teuer für einen Puffer,
der ohnehin im Kaderrauschen verschwinden könnte. Sollte eine künftige Vollmessung (die nächste
`stand-aller-disziplinen.md`-Neuziehung) Fechten unter 0,80 zeigen, ist das nicht automatisch
eine Regression — es kann derselbe Kadereffekt sein, der Tennis am 06.09. von 0,814 auf 0,786
bewegt hat (PM-Briefing Abschnitt 1a), nur in die andere Richtung.

---

## 3. Eiskunstlauf

### 3.1 Visuelle Authentizität: dieselbe generische Bühne wie Wettessen

Live-Test (dieselbe Methode wie Abschnitt 2.1): Eiskunstlauf zeigt zwei Reihen stehender
Figuren auf dem geteilten Bühnenpodest (`bodenBuehne()`, dasselbe Bild wie 17 der 20
Disziplinen), eine Punktesäule und eine „X/6"-Fortschrittsanzeige je Teilnehmer
(`zeichneBuehne`, `battle-mode.engine.js:11538-11596`, Nicht-Duell-Zweig ab `:11584`). Optisch
**identisch** zu Wettessen (einem Wettessen-Auftritt) bis auf den Namen und die Zahl — kein
Eisuntergrund, keine Sprungpose, keine Pirouette, keine Kür-Choreografie. Genau die
„generische Kopie des Bühne-Kampf-Templates ohne eigene Identität", vor der der Auftrag warnt.

**Derselbe Waffen-Fund wie bei Fechten trifft hier genauso zu, nur in die falsche Richtung.**
`landet sauber`/`stürzt` (Eiskunstlaufs `erfolgWort`/`failWort`, `:10657`) läuft über exakt
dieselbe `u.lunge=0.5`-Zeile (`:11402`) und exakt dieselbe Pose-Auswahl (`:2575`) wie Fechtens
Treffer. Ein Eiskunstläufer mit derselben Axt-Kosmetik wie „Draco" würde beim Landen eines
Sprungs eine Axt schwingen; einer mit Bogen-Kosmetik würde einen Pfeil abschießen. Anders als
bei Fechten gibt es hier **keine** passende Waffe, die man erzwingen könnte — ein Eiskunstläufer
trägt real gar keine Waffe.

### 3.2 Entscheidung: Waffenebene für Eiskunstlauf vollständig unterdrücken

Genau das Gegenstück zu Fechtens Fix, mit demselben Muster und derselben bestehenden
Präzedenz — Feldspiel-Disziplinen unterdrücken Waffen bereits vollständig, aus genau demselben
Grund:

`battle-mode.engine.js:2550-2556`:
```js
// Feldspiel-Disziplinen kennen keine Waffen — ein Korbleger ist kein Schwerthieb und
// kein Bogenschuss. […] Chris' Wunsch: keine Waffenanimation im Feldspiel.
const bogen=!feldspiel&&b.waffe==="bogen";
const feuerwaffe=!feldspiel&&FEUERWAFFEN.includes(b.waffe);
```

Dieselbe Bedingung bekommt einen zweiten Ausschluss: `const keineBuehnenWaffe=istBuehne(disc)&&
(buehneDisc==="eiskunstlauf"||buehneDisc==="breaking")` (Breaking gehört aus demselben Grund
dazu, s. Abschnitt 4.2), und `bogen`/`feuerwaffe` sowie die Nahkampfwaffen-Zweige
(`zeichneB("axt_…")` usw.) werden zusätzlich auf `!keineBuehnenWaffe` geprüft. Die
`slash`-Pose selbst bleibt (ein bloßhändiger Schwung/Reichbewegung ist keine falsche Aussage,
nur eine unspezifische), nur die aktiv falsche Waffe verschwindet.

**Optionale Zusatzpolitur (niedrigere Priorität, nicht Teil der Kernempfehlung dieser Runde):**
ein „stürzt"-Ereignis könnte die bereits vorhandene `hurt`-Pose (`u.down`) kurz auslösen, statt
den Läufer stehen zu lassen — dieselbe Pose, die Feldspiel/Arena schon für einen niedergestreckten
Kämpfer nutzen, mit demselben Abkling-Muster wie `u.lunge` (`stepBuehne`, `:11390`,
`if(u.lunge>0)u.lunge=Math.max(0,u.lunge-dt)`; ein `u.downT`-Timer nach demselben Muster wäre
die günstigste Umsetzung). Nur für Eiskunstlauf/Breaking sinnvoll (ein Sturz passt zu beiden
Sportarten), nicht für Fechten/Tennis/Speed-Schach/Wettessen — dort würde ein „hurt"-Pose bei
„vergibt den Punkt" oder „verliert Zeit am Zug" absurd wirken. Ich empfehle, das für eine
spätere, dedizierte Visual-Polish-Runde zurückzustellen, nicht für diese.

### 3.3 Rangtreue-Hebel: Verlässlichkeit, nicht Validität — gemessen, nicht angenommen

**Baseline (n=24):** 0,792 / Spannweite 0,130 / Saison 0,944 / Spannweite 0,077 — „knapp
durchgefallen" nach der 0,80-Schranke.

Die Saisonzahl (0,944) ist die **höchste aller drei** Ziel-Disziplinen dieser Recherche und
höher als jede andere Buehnen-Disziplin außer Speed-Schachs 0,972 (eigene Kontrollmessung dieser
Runde, s. weiter unten für die Gegenprobe der übrigen acht) — die Mechanik belohnt über eine
Saison eindeutig das Richtige. Nach CLAUDE.mds eigener Diagnoseregel („Ist die
Saisonzahl hoch und die Einzelspielzahl niedrig, belohnt die Mechanik das Richtige, aber zu
laut — dann fehlen EREIGNISSE, nicht Rezepte") ist das ein Lehrbuch-Verlässlichkeitsfall.

**Getestet: `rundenN` 6 → 12, `rundenDauer` 0,85 → 0,425 (hält die Gesamtdauer bei den
angepeilten ~60 s: 12 × 6 × 2 × 0,425 s ≈ 61 s).** Reine Zahlenänderung im
`BUEHNE_ART.eiskunstlauf`-Eintrag, keine Formel-, keine Rezeptänderung.

| | rho/Spiel | Spannweite | rho/Saison | Spannweite |
|---|---:|---:|---:|---:|
| Vorher (n=24) | 0,792 | 0,130 | 0,944 | 0,077 |
| Nachher (n=24) | **0,875** | 0,075 | 0,965 | 0,049 |
| Nachher (n=96, Robustheitscheck) | **0,887** | 0,065 | 0,986 | 0,042 |

Beide Kontrollmessungen (n=24 und n=96) bestätigen sich gegenseitig und liegen klar über dem
0,85-Zielwert aus CLAUDE.md, mit spürbar engerer Spannweite als vorher — genau das Muster, das
eine reine Reliabilitätsverbesserung (mehr unabhängige Messungen, keine Validitätsänderung)
erwarten lässt. Zur Kontrolle: die übrigen acht Buehnen-Disziplinen wurden mit derselben
Engine-Kopie gegengemessen (Fechten, Tennis, Gewichtheben, Showcase, Speed-Schach, Wettessen,
I-Spy) und blieben bit-identisch zur Baseline — die Änderung wirkt ausschließlich auf
Eiskunstlauf.

**Warum das hier funktioniert, obwohl CLAUDE.md vor genau diesem Hebel warnt:** Hockeys
gescheiterter Versuch (Verlässlichkeit 0,755→0,85 bei unverändertem rho) hängt an Hockeys
Live-Motor — ein durchgehender Tick-Loop mit `rr()`-Würfen für jedes Einzelereignis, in dem ein
oft gewürfeltes Ereignis (Zoneneintritt) die Gesamtmessung dominieren kann. Eiskunstlaufs
Rundenformel (`bauBuehne`, `:10926-10940`) hat keinen solchen Mechanismus: jeder Durchgang ist
EIN unabhängiger, vollständig im Voraus berechneter Erfolgs-/Fehlschlag-Wurf
(`if(rr()<erfolg){…}else{…}`), keine Kaskade, keine Rückkopplung zwischen Durchgängen außer der
gleichmäßigen Ermüdung. Das ist exakt die Voraussetzung, unter der die Spearman-Brown-Reliability-
Formel gilt (mehr unabhängige i.i.d.-Messungen derselben zugrundeliegenden Fähigkeit senken die
Varianz der Summe, ohne die Validität zu berühren) — und die Messung bestätigt das: die
Saisonzahl bewegt sich kaum (0,944→0,965/0,986, innerhalb dessen, was man von zusätzlichem
Kaderrauschen bei größerem n erwartet), während die Einzelspielzahl deutlich springt.

**Realismus-Nebenbefund:** ein echtes Kürprogramm (ISU-Wertung, Senioren) trägt rund 12-13
gewertete Elemente (sieben Sprungpässe, drei Pirouetten, eine Schrittfolge, eine
Choreo-Sequenz). `rundenN:6` bildete strukturell nur ein halbes Programm ab; `rundenN:12` trifft
die reale Größenordnung deutlich besser — dies ist keine reine Zahlenkosmetik, sondern eine
Authentizitätskorrektur, die zufällig auch die Rangtreue löst.

### 3.4 Entscheidung

`BUEHNE_ART.eiskunstlauf.rundenN` von 6 auf 12, `rundenDauer` von 0,85 auf 0,425 — sonst nichts
am Rezept ändern. Erwartete Wirkung: rho/Spiel 0,792→~0,88 (Median zweier unabhängiger n-Werte),
über der 0,85-Zielmarke. Dazu die Waffenunterdrückung aus Abschnitt 3.2 (unabhängige, rein
kosmetische Änderung, kann in derselben oder einer separaten PR laufen).

---

## 4. Breaking

### 4.1 Visuelle Authentizität: identisches Problem wie Eiskunstlauf

Derselbe Live-Test: Breaking zeigt exakt dieselbe geteilte Bühne, dieselbe Punktesäule, denselben
Reihen-Aufbau wie Eiskunstlauf und Wettessen — keine Battle-Kreisfläche, kein Boombox-Motiv,
keine Freeze-/Power-Move-Pose, keine sichtbare Battle-Struktur (echte Breaking-Battles laufen als
abwechselnde „Throws" zwischen zwei Tänzern, nicht als gleichzeitiger Auftritt beider Seiten —
die aktuelle Nicht-Duell-Struktur bildet das nicht ab; das ist eine strukturelle Frage für eine
spätere Chassis-Diskussion, nicht Gegenstand dieser Empfehlung, und unabhängig vom
Rangtreue-Befund unten). „Setzt den Move"/„Move bricht ab" (`:10675`) läuft über dieselbe
generische `u.lunge`-Pose wie überall — dieselbe Axt-schwingt-Problematik wie bei Eiskunstlauf,
nachweislich (derselbe Code-Pfad, derselbe Charakterkatalog).

### 4.2 Entscheidung

Dieselbe Waffenunterdrückung wie Eiskunstlauf (Abschnitt 3.2 — Breaker tragen real keine
Waffen), im selben Zweig mitgezogen (`buehneDisc==="eiskunstlauf"||buehneDisc==="breaking"`).
Keine eigene Battle-Kreis-Szene in dieser Runde: eine dedizierte Szenerie (wie Gewichthebens
`zeichneHeben()` oder Speed-Schachs `zeichneSchach()`) ist ein eigenständiges, größeres
Bühnenbild-Projekt — sinnvoll für eine SPÄTERE, dedizierte Visual-Runde, nachdem Rangtreue und
Grundkosmetik stimmen (genau die Reihenfolge, die Gewichtheben und Speed-Schach selbst
durchlaufen haben: erst Rezept/Rangtreue, dann eigenes Bühnenbild, dann Produktivierung).

### 4.3 Rangtreue-Hebel: derselbe Befund wie Eiskunstlauf, kleinerer Puffer

**Baseline (n=24):** 0,804 / Spannweite 0,133 / Saison 0,937 / Spannweite 0,197 — „bestanden",
aber mit einem Puffer von 0,004 über der Schranke: der knappste Puffer aller zehn heute
bestandenen Disziplinen (PM-Briefing Abschnitt 1, Tabelle — kleiner sogar als Fechtens 0,016).
Auch hier eine hohe Saisonzahl (0,937,
zweithöchste der drei Zieldisziplinen) bei niedriger Einzelspielzahl — derselbe
Verlässlichkeitsfall wie Eiskunstlauf, nur schon knapp über statt knapp unter der Schranke.

**Getestet: `rundenN` 4 → 8, `rundenDauer` 1,25 → 0,625** (hält 8 × 6 × 2 × 0,625 s = 60 s exakt
auf Chris' Zielwert).

| | rho/Spiel | Spannweite | rho/Saison | Spannweite |
|---|---:|---:|---:|---:|
| Vorher (n=24) | 0,804 | 0,133 | 0,937 | 0,197 |
| Nachher (n=24) | **0,869** | 0,114 | 0,951 | 0,168 |
| Nachher (n=96, Robustheitscheck) | **0,873** | 0,106 | 0,958 | 0,196 |

Beide Kontrollmessungen liegen über dem 0,85-Zielwert. Der Sprung ist kleiner als bei
Eiskunstlauf (Breaking hatte weniger „Luft" zur reinen Verdopplung, weil `rundenN` schon
niedriger war und der failAbzug/die Rollenverteilung anders liegt), reicht aber komfortabel über
das Ziel und schließt den knappen Puffer, den CLAUDE.md und das PM-Briefing ausdrücklich
benennen. Dieselbe strukturelle Begründung wie bei Eiskunstlauf (Abschnitt 3.3) gilt unverändert
— Breakings Rundenformel hat denselben unabhängigen, kaskadenfreien Aufbau.

**Realismus-Nebenbefund:** ein Breaking-Auftritt (Throw) unter der WDSF-/Olympia-Bewertung
besteht aus mehreren unterscheidbaren Bewertungsmomenten (Einstieg/Toprock, Footwork,
Power-Move, Freeze/Ausstieg) über typischerweise mehr als einen Durchgang. `rundenN:4` bildete
kaum mehr als einen einzigen Move-Zyklus ab; `rundenN:8` — zwei vollständige Move-Zyklen — ist
die vorsichtigere, aber immer noch plausible Verdopplung, kein beliebig gewählter Zielwert.

### 4.4 Entscheidung

`BUEHNE_ART.breaking.rundenN` von 4 auf 8, `rundenDauer` von 1,25 auf 0,625 — sonst nichts am
Rezept ändern (die eine dokumentierte Kalibrierrunde von Breakings Rezept, Abschnitt 1.2, bleibt
unangetastet und reicht für diese Runde). Dazu die Waffenunterdrückung aus Abschnitt 3.2/4.2.

---

## 5. Geteiltes Chassis: Kollisionsrisiko und Umsetzungsreihenfolge

Neun Disziplinen teilen sich das Bühne-Chassis (Gewichtheben, Showcase, Speed-Schach — alle drei
**live** über `ARENA_RESOLVED_DISCIPLINE_IDS`, `lib/resolve/battle-mode-arena-team-points.ts:
159-165` — sowie Fechten, Tennis, Eiskunstlauf, Breaking, Wettessen, I-Spy, noch nicht
produktiviert). Jede Empfehlung dieser Recherche berührt genau zwei Kategorien von Code:

1. **Numerische Felder in genau zwei/drei `BUEHNE_ART`-Einträgen** (`rundenN`/`rundenDauer` für
   Eiskunstlauf und Breaking). Diese Felder werden von geteiltem Code generisch gelesen
   (`art.rundenN` in `bauBuehne`/`WERTUNG_AUFTRITT`/`zeichneBuehne` usw.), aber die **Werte**
   sind rein pro Disziplin — keine der anderen sieben Buehnen-Disziplinen liest
   `BUEHNE_ART.eiskunstlauf.rundenN` oder `BUEHNE_ART.breaking.rundenN`. Nachgemessen (Abschnitt
   3.3/4.3): die übrigen sieben blieben beim Test bit-identisch zur Baseline.
2. **Ein neuer, disziplin-spezifischer Zweig in `zeichneSprite()`**, gebaut nach dem bereits
   bestehenden Football-Gear-Muster (`:2557-2572`, `istFootball()`-Override) — ein Vergleich auf
   die konkrete Disziplin-ID (`buehneDisc==="fechten"` bzw. `==="eiskunstlauf"||"breaking"`),
   nie ein Eingriff in die gemeinsame `lunge`-Zustandsmaschine, die `ani`-Auswahl-Fallunterscheidung
   selbst oder `stepBuehne`. Genau die Lehre aus PR #820/#840 (eine Änderung an gemeinsamem
   Bühnen-Code traf sechs unbeteiligte Disziplinen mit) — hier gibt es keine gemeinsame
   Codefunktion, die sich ändert, nur einen zusätzlichen Fall in einer bestehenden
   Bedingungskette.

**Verifikationspflicht für die Umsetzung** (wie bei jeder Buehnen-Änderung in diesem Projekt):
vor und nach dem Merge `node scripts/miss-alle-disziplinen.mjs 24` für alle neun
Buehnen-Disziplinen laufen lassen. Erwartung: Fechten/Tennis/Gewichtheben/Showcase/
Speed-Schach/Wettessen/I-Spy bit-identisch, Eiskunstlauf/Breaking exakt wie in Abschnitt 3.3/4.3
gemessen. Weil die Rangtreue-Zeilen sich bewegen, muss die Umsetzung außerdem
`node scripts/baue-rangtreue-basislinie.mjs 24` erneut laufen lassen und
`data/generated/rangtreue-basislinie.json` im selben PR nachziehen — die eigene Projektregel
seit dem 06.09. (`stand-aller-disziplinen.md` Abschnitt 2b: „wer eine Zeile in Abschnitt 1
bewegt, zieht die Basislinie im selben PR nach"), sonst zeigt `pruefe-rangtreue-schranke.mjs`
weiterhin die alten, jetzt zu niedrigen Werte als Schranke.

**Empfohlene Reihenfolge:**

1. **Rundenzahl-Fix für Eiskunstlauf und Breaking** (Abschnitt 3.4/4.4) zuerst — reine Zahlen,
   niedrigstes Risiko, hebt sofort die einzige heute durchfallende Zeile dieser Recherche über
   die Schranke und vergrößert Breakings knappen Puffer. Kann unabhängig gemerged werden.
2. **Waffenüberschreibung für alle drei** (Abschnitt 2.2/3.2/4.2) als zweite, rein kosmetische
   PR — kann parallel oder danach laufen, hat keine Rangtreue-Abhängigkeit zu Schritt 1 und
   keine zu irgendeiner anderen laufenden Runde.
3. **Eigene Bühnenbild-Szene für Eiskunstlauf/Breaking** (optionale Erwähnung in Abschnitt 4.2) —
   zurückgestellt, kein Teil dieser Empfehlung, erst sinnvoll nach Schritt 1/2 und nur, wenn
   Chris nach dem Spielen von Schritt 1/2 noch mehr will.

Keiner der drei Schritte berührt Gewichtheben, Speed-Schach oder Showcase (die drei live
geschalteten Buehnen-Disziplinen) in irgendeiner Form — weder ihre `BUEHNE_ART`-Einträge noch
`zeichneHeben()`/`zeichneSchach()` noch `spieleBuehneHeben`/`spieleBuehneDuell`/
`spieleBuehneAuftritt` werden angefasst. Die verschärfte Opus-Review-Sorgfalt für Produktionscode
(CLAUDE.md-Konvention für alles, was `ARENA_RESOLVED_DISCIPLINE_IDS` betrifft) gilt für diese
drei Änderungen deshalb nicht — keine der drei Zieldisziplinen ist heute live, und keine der drei
Live-Disziplinen wird berührt.

---

## Anhang: Werkzeuge dieser Recherche

- `node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf breaking fechten` — Baseline und alle
  Vergleichsmessungen, kaderfest über `data/generated/kaderfamilie-live-save.json`.
- `node scripts/screenshot-fable-drei-buehne.mjs <out>` — Sichtprüfung aller drei Disziplinen im
  laufenden Mockup (drei Zeitpunkte je Disziplin), nach dem Muster von
  `scripts/screenshot-speed-schach.mjs`. Nicht Teil dieses Commits.
- `node scripts/screenshot-fable-lunge-burst.mjs <out> <disziplin>` — 40 Screenshots im
  150-ms-Takt, um den kurzen `u.lunge`-Pose-Moment reproduzierbar einzufangen (Beleg für
  Abschnitt 2.1). Nicht Teil dieses Commits.
- Beide Skripte sind Wegwerf-Sichtprüfungen wie ihre Vorbilder — nicht Teil der Abnahme-Sonden,
  nur zum Ansehen. Sie liegen nicht in diesem PR; wer sie erneut braucht, kann sie aus diesem
  Dokument rekonstruieren oder bei mir erfragen.

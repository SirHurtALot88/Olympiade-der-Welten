# Recherche: Mini-DM als 4-Team-Free-For-All am eigenen Spieltag (Chris' Sonderregel, 06.09.)

**Reine Recherche. Keine Codeänderung, kein Prototyp.** Alle Datei-/Zeilenangaben sind gegen
`origin/main` (Stand `101505e8`, nach PR #827) geprüft.

## 0. Der Auftrag in einem Satz

Chris, wörtlich: „mini dm soll was besonderes werden, dass da an dem spieltag wo das stattfindet
4 Teams gegeneinander antreten in der disziplin! [...] jedes team schickt dann 1 spieler in die
arena und dafür gibt es dann entsprechend siegpunkte platz 1 4 punkte 2 3 punkte etc [...] aber
4-3-2-1 wäre ja op dann würde Mini DM so viel zählen wie 2 diszis das darf auch nicht sein."

Zwei Fragen sind darin vermischt und müssen getrennt beantwortet werden:

1. **Event-interne Punkte** (wer gewinnt das Mini-DM-Event dieses Spieltags — 4-3-2-1 pro Runde
   ist hierfür ein vernünftiger Vorschlag, s. Abschnitt 4).
2. **Liga-Tabellenpunkte** (was trägt dieses Event zur Saisontabelle bei — hier ist 4-3-2-1
   die genannte Fehlkonstruktion, s. Abschnitt 3).

Chris beantwortet Frage 2 explizit nicht selbst („müsste man dann ausarbeiten oder überlegen"),
er nennt nur die Nebenbedingung (Gesamtsumme darf nicht das Gewicht von zwei Disziplinen tragen)
und zwei Denkrichtungen (2 gemeinsame Sieger, oder „2 1 0 0"). Das ist genau der Fall aus Chris'
eigener Meta-Vorgabe: konkrete, recherchierte Empfehlung zuerst, nicht ein Menü unbewerteter
Optionen.

---

## 1. Ist-Zustand Mini-DM — was heute tatsächlich existiert

### 1.1 Chassis, Matrix, Slots

Mini-DM ist eine der drei Arena-Kampfdisziplinen (`public/mockups/battle-mode.engine.js`), Team
gegen Team, **4 gegen 4**, fest — kein variabler Kader wie bei den 17 anderen Disziplinen:

```
"mini-dm":{label:"Mini-DM",cat:"power",size:4}                                   // Zeile 3298
"mini-dm": {torment:24,health:20,power:16,stamina:16,will:14,dexterity:10}        // Zeile 3464 (MATRIX)
"mini-dm":{ label:"Mini-DM", jeSeite:4, rezept:{...} }                            // Zeile 4067 (ARENA_ART)
```

Vier feste **Rollen**, keine generische „N Spieler"-Liste (`SLOTS_JE_DISC["mini-dm"]`,
Zeile 3493-3498):

| Slot | Profil-Schwerpunkt | Text |
|---|---|---|
| Frontliner | health/power | „Nimmt Druck auf und stabilisiert den Einstieg." |
| Finisher | torment/dexterity | „Schließt Fights über Torment-Spitzen ab." |
| Trick Fighter | dexterity/will | „Findet Winkel über Dexterity und Will." |
| Iron Guard | stamina/health | „Bleibt im Chaos stehen und frisst Druck." |

**Wichtig für Abschnitt 4:** Chris' Formulierung „mit der Anzahl Spieler, die es gab, z. B. 6
Runden" unterstellt einen **variablen** Kader (wie bei den 17 Feldspiel-/Bühnen-/Bahn-Disziplinen,
die 2-6 Spieler ziehen). Mini-DM hat diese Variabilität **nicht** — es ist laut
`arena-mini-dm-tdm-battlefield-rollout-plan.md` (03.09.) „rollenfest": immer genau 4, immer
dieselben vier benannten Rollen mit eigenem Profil. Das ist eine echte Weiche für Abschnitt 4,
nicht nur eine Fußnote.

### 1.2 Der Kampfmotor ist heute strikt zweiseitig — mit einer bereits vorbereiteten Ausnahme

Der Kern-Kampfloop (`engine.js:13261-13270`) trägt einen Kommentar, der für diese Recherche
zentral ist:

> „GEGNER IST, WER EINE ANDERE SEITE HAT — nicht ‚die andere Seite'. Vorher stand an elf Stellen
> `live(1-u.side)`. Das ist keine Abfrage, das ist eine Behauptung: es gibt genau zwei Parteien.
> Solange TDM gemeint war, stimmte sie. **Chris will aber Formate, in denen vier Teams
> gleichzeitig antreten oder ein gemischter Pool frei gegeneinander kämpft** — dort ist sie
> schlicht falsch. Die beiden Helfer hier wissen nicht, wie viele Parteien es gibt, und müssen es
> auch nicht wissen."

```js
const gegner=u=>U.filter(x=>x.side!==u.side&&!x.down);   // engine.js:13269
const eigene=u=>U.filter(x=>x.side===u.side&&!x.down);   // engine.js:13270
```

Das ist Commit `1bf63a36` (PR #671, „Battle Arena Phase 1-3"), also **nicht neu** — jemand hat
schon vor Wochen genau Chris' 4-Team-Wunsch antizipiert und die beiden zentralen
Ziel-/Team-Filter N-way-fest gemacht. **Das ist der wichtigste einzelne Fund dieser Recherche**:
ein Teil der Motorarbeit für ein FFA-Format ist bereits da, unbenutzt.

Was **nicht** generalisiert ist — geprüft, nicht vermutet:

| Stelle | Zeile | Befund |
|---|---|---|
| „Eigene Hälfte" in `chooseTarget` | `own=u.side===0?(p=>p.x<MID):(p=>p.x>MID)` | `engine.js:13355` | Binär: nur zwei Feldhälften. Für 4 Seiten bräuchte es Quadranten oder Spawn-Sektoren statt einer Mittellinie. |
| Formations-/Flanken-Zielpunkte | `gx=u.side===0?...:...` (mehrere Stellen) | `engine.js:13975, 14031, 14033, 14037, 14056` | Dieselbe MID-Logik für Bewegungsziele — bindet Formation an „links/rechts", nicht an „mein Sektor". |
| Rendering (Team-Farben Heim/Auswärts) | `css(u.side===0?"--home":"--away")` | `engine.js:2773, 10001` | Nur zwei Farbslots vorgesehen; 4 Teams bräuchten 4 Farben/Trikots. |
| Team-Tabellenpunkte | `ARENA_TEAM_POINTS={win:2,draw:1,loss:0}` | `lib/resolve/battle-mode-arena-team-points.ts:199` | Explizit für **zwei** Seiten gebaut (`arenaTeamPointsForFixture` gibt ein Tupel `[heim,gast]` zurück, Zeile 635-639). |
| Fixture-Paarung | `buildCircleRounds` | `lib/season/season-fixture-schedule.ts:71-96` | Erzeugt ausschließlich 2er-Paare pro Runde. |

**Einordnung:** Die reine Zielwahl/Zugehörigkeits-Logik (wer ist Freund, wer ist Feind) ist
FFA-fest. Alles, was **Raum** (Feldhälfte, Formation), **Darstellung** (Farben) oder
**Punktevergabe** (2/1/0, Fixture-Paare) betrifft, ist es nicht. Das deckt sich mit Fund 1 aus
`arena-mini-dm-tdm-battlefield-rollout-plan.md` (die Arena hat „Reihen" statt „Zonen" — ein
eigenes, richtungsgebundenes System, keine flächige Geometrie).

### 1.3 Rangtreue-Status — und warum das die FFA-Frage nicht aufhält, aber begleitet

`docs/design/stand-aller-disziplinen.md` Zeile 91 (06.09., kaderfest, n=24):

| Disziplin | Chassis | rho je Spiel | rho Saison | Abnahme |
|---|---|---:|---:|---|
| Mini-DM | Arena | **0,094** | **0,071** | durchgefallen |

Das ist die **schwächste Zahl aller zwanzig Disziplinen**, in beiden Spalten — laut dem
Dokument selbst ein **Validitätsproblem** („wo beide Zahlen niedrig sind, belohnt die Mechanik
das Falsche", Zeile 192-195), nicht nur ein Verlässlichkeitsproblem, das mehr Ereignisse lösen
könnten (CLAUDE.md: „mehr Ereignisse helfen fast nie").

Zur Ehrlichkeit dazu gehört aber auch die eigene Einordnung des Dokuments: dieselbe Zeile war am
03.09. noch **0,658/0,786** (`arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 1.2) und
fiel bis 06.09. auf 0,094/0,071, **ohne dass eine einzige Zeile Mini-DM-Code geändert wurde**
(Zeile 13: „Battlefield 0,325→0,387, TDM 0,113→0,253, Mini-DM 0,269→0,094 [...] ist das [...]
Kaderrauschen, kein Befund"). Die Arena-Disziplinen haben laut PM-Briefing eine Kader-Spannweite
(0,697 bei Mini-DM), die **größer ist als der Median selbst** — bei n=24 Spielen ist eine
Einzelmessung hier nicht belastbar in beide Richtungen.

**Für diese Recherche heißt das zweierlei:**

1. Mini-DM ist mechanisch **so weit unter der Schranke**, dass die Sonderregel dieses Auftrags
   das Rangtreue-Problem nicht lösen muss, aber auch **nicht verschlimmern darf**, ohne dass es
   auffällt — jede Umsetzung braucht eine eigene `miss-alle-disziplinen.mjs`-Messung danach,
   nicht nur eine Bauchgefühl-Abnahme.
2. Eine echte Chance liegt in Abschnitt 4: wenn die FFA-Struktur **mehr unabhängige
   Ereignisse** pro Spieltag erzeugt (4 Runden statt 1 Gefecht), ist das laut CLAUDE.md zwar
   kein verlässlicher Hebel für rho — aber der aktuelle Fall (jeSeite=4, riesige Kader-Spannweite)
   ist näher an „zu wenig unabhängige Stichproben" als Hockey es war, als die Verdopplung dort
   nichts brachte. Das ist eine Vermutung, keine Zusage — Abschnitt 6 nennt die nötige Messung.

### 1.4 Wie ein normales Duell heute Liga-Punkte erzeugt (Battle Mode)

`lib/resolve/battle-mode-arena-team-points.ts:8-10`, Chris' eigene Entscheidung vom 30.08.,
wörtlich im Code zitiert:

> „Battle Mode bekommt eine EIGENE, von `getRankToPointsValue()` VOLLSTÄNDIG ENTKOPPELTE
> Team-Punkteskala: Sieg = 2, Unentschieden = 1, Niederlage = 0 (‚Das ist gesetzt.')"

```ts
export const ARENA_TEAM_POINTS = { win: 2, draw: 1, loss: 0 } as const;   // Zeile 199
```

Das gilt aktuell für die fünf bereits live aufgelösten Battle-Mode-Disziplinen
(`ARENA_RESOLVED_DISCIPLINE_IDS`, Zeile 159-165: basketball, gewichtheben, hockey, speed-schach,
showcase) — Mini-DM ist **noch nicht** in dieser Menge, läuft also heute noch nirgends live. Das
ändert aber nichts an der Referenzzahl: dies ist die etablierte Battle-Mode-Norm, an die sich
jede künftig aufgelöste Arena-Disziplin hält, und genau das ist der **Budget-Anker**, an dem
Chris' „das darf nicht so viel zählen wie zwei Disziplinen" gemessen werden muss.

**Der Budget ist damit klar: ein normales Duell zahlt in Summe genau 2 Punkte in die Tabelle ein**
— entweder 2:0 (Sieg/Niederlage) oder 1:1 (Unentschieden). Jede Verteilung für das
4-Team-Mini-DM-Event, deren **Summe über alle vier Teams** ebenfalls bei ~2 liegt, ist
budget-neutral gegenüber jeder anderen Disziplin an jedem anderen Spieltag. Chris' eigene
Ablehnung von 4-3-2-1 (Summe 10, das Fünffache) bestätigt genau diese Rechnung — und auch seine
Sorge um „2 Sieger-Teams mit 2 Punkten" ist berechtigt: das wäre Summe 4, das Doppelte, exakt
„wie zwei Disziplinen", wie er selbst schreibt.

**Eine dritte, bisher unbenannte Scoring-Topologie.** Die Bahn-/Bühnen-Disziplinen (17 von 20)
laufen NICHT über ein Duell-Scoring, sondern über ein **liga-weites Renn-Scoring**: alle Teams
einer Liga treten am selben Spieltag im selben Event an, `getRankToPointsValue()` verteilt Punkte
nach Rang 1..16 über die ganze Liga (`season-fixture-schedule.ts:22-23`: „die Paarung ändert
KEINE Punkte [...] das bleibt liga-lokales Renn-Scoring, nicht Duell-Scoring"). Nur die
Arena-Disziplinen kennen ein echtes **1-gegen-1-Duell** zwischen genau den zwei Teams, die die
Spielplan-Runde einander zugeordnet hat. **Mini-DMs 4-Team-Event ist WEDER das eine noch das
andere** — es ist eine dritte Form: eine **Vierergruppe (Pod)** aus genau vier Teams, größer als
ein Duell, kleiner als die ganze Liga. Dafür existiert heute kein Code-Pfad. Abschnitt 5 nimmt
das auf.

---

## 2. Was Chris' Beschreibung technisch verlangt — Zusammenfassung vor den Vorschlägen

1. An Mini-DMs Spieltag(en) bilden sich **Vierergruppen** aus je 4 Teams (nicht 2).
2. Jede Gruppe spielt **N Runden**, N = Zahl der einsetzbaren Mini-DM-Spieler je Team; pro Runde
   schickt jedes der 4 Teams **einen einzelnen Kämpfer** in die Arena (kein 4-gegen-4-Gefecht mehr
   pro Runde — ein 1-gegen-1-gegen-1-gegen-1-Duell).
3. Jede Runde vergibt Platzierungspunkte (Chris' Beispiel: 4-3-2-1) an die vier Teams.
4. Die Summe der Rundenpunkte über N Runden ergibt eine **Event-Endplatzierung** der vier Teams.
5. Diese Endplatzierung muss in **Liga-Tabellenpunkte** übersetzt werden, deren **Summe über alle
   vier Teams** ungefähr dem entspricht, was ein normales Duell einbringt (2, s. 1.4) — nicht dem
   Fünffachen (4-3-2-1) und nicht dem Doppelten (zwei volle Sieger).

---

## 3. Liga-Punkte-Verteilung — drei Optionen, budget-neutral zum 2/1/0-Anker

Referenzgröße für alle drei: **Summe = 2** (identisch mit einem normalen Duell-Ergebnis, s. 1.4).

### Option A — „Sieger nimmt alles" (empfohlen, s. Abschnitt 6)

1. Platz = **2** Punkte, Plätze 2-4 = **0**. Bei Gleichstand auf Platz 1 wird die 2 gleichmäßig
unter den gleichauf Führenden geteilt (2 Team-Gleichstand → 1/1, 3er-Gleichstand → 0,67 je Team,
4er-Gleichstand → 0,5 je Team).

- **Budget:** Summe **exakt 2**, in jedem einzelnen Fall, ohne Ausnahme — die einzige der drei
  Optionen mit dieser Eigenschaft. Das ist die direkte Verallgemeinerung von „Sieg 2/Niederlage 0"
  auf vier statt zwei Teilnehmer: **wer das Event gewinnt, gewinnt es voll**, wer es nicht
  gewinnt, bekommt nichts — exakt wie ein Duell heute.
- **Fair/intuitiv?** Ja, im selben Sinn, in dem ein normales Duell fair ist: die Tabelle sieht am
  Ende „ein Sieger, drei Nicht-Sieger", nicht „vier verschiedene Belohnungsstufen für ein einziges
  Event" — Letzteres wäre eine neue Punkte-Ästhetik, die kein anderes Feld der Tabelle kennt.
- **Nachteil:** Platz 2 von 4 (der zweitbeste Kader dieser Runde) bekommt exakt so viel wie Platz
  4 — nämlich nichts. Bei vier echten Wettbewerbern fühlt sich das härter an als ein normales
  Duell (dort verliert man gegen GENAU einen Gegner; hier „verliert" man potenziell gegen drei).
  Das ist ein echter Design-Trade-off, kein Fehler — Option B mildert ihn.
- **Alle-4-gleich:** 0,5 je Team — sauber, ohne Sonderfall, dieselbe Formel wie beim
  2er-/3er-Gleichstand.

### Option B — „Podium teilt sich, Rest geht leer aus"

Platz 1 = **1,5**, Platz 2 = **0,5**, Plätze 3-4 = **0**. Bei Gleichstand: die betroffenen Plätze
teilen ihre kombinierte Punktzahl gleichmäßig (z. B. 1./2. gleichauf → je (1,5+0,5)/2 = 1,0).

- **Budget:** Summe **exakt 2**, ebenfalls in jedem Fall.
- **Fair/intuitiv?** Differenzierter als A: der zweitbeste Kader wird für seine Leistung
  belohnt, nicht nur der Sieger. Das mildert Chris' eigene Sorge aus der Denkrichtung „2 Sieger
  mit 2 Punkten" (das wäre budget-doppelt), OHNE deren Grundgedanken — „auch Platz 2 zählt etwas"
  — ganz zu verwerfen: 1,5 statt 2 UND 0,5 statt 0 verschiebt zwei Zehntel Gesamtsumme vom
  Sieger zum Zweiten, bleibt aber bei Summe 2.
- **Genau das Risiko, das die Aufgabe benennt:** Ist der Abstand 1,5 zu 0,5 groß genug, um den
  Kampf um Platz 1 gegen Platz 2 spürbar zu halten? Zum Vergleich: der bestehende Sieg/Draw-
  Abstand ist 2 zu 1 (Faktor 2), Draw/Loss ist 1 zu 0 (unendlicher Faktor). 1,5 zu 0,5 ist Faktor
  3 — **eher schärfer** als ein Sieg gegenüber einem Unentschieden, nicht flacher. Das
  Rest-Feld-Nachteil verschwindet zwischen Platz 2 und Platz 3 komplett (0,5 → 0), was neu ist:
  ein Team, das knapp Zweiter statt Dritter wird, gewinnt 0,5 ganze Punkte — ein größerer Sprung
  als jeder Rangwechsel in einem normalen Duell kennt (dort gibt es nur zwei Ränge). Das ist kein
  Fehler, aber eine Eigenschaft, die eine eigene Playtesting-Runde verdient (Abschnitt 6).
- **Alle-4-gleich:** (1,5+0,5+0+0)/4 = 0,5 je Team — dieselbe Zahl wie bei Option A, konsistent.
- **2er-Gleichstand auf Platz 1** (der von Chris explizit gestellte Fall): (1,5+0,5)/2 = 1,0 je
  Team — bewusst NICHT „2 Punkte je Sieger" (das wäre wieder budget-doppelt), sondern die
  budget-treue Mitte.

### Option C — Proportional zur Event-internen Dominanz (kontinuierlich, kein Rang nötig)

Liga-Punkte(Team i) = 2 × RundenPunkte(Team i) / Σ RundenPunkte(alle 4 Teams). Nutzt also direkt
die in Abschnitt 4 vorgeschlagene Rundenwertung als Grundlage der Liga-Punkte — keine separate
Rang-zu-Punkte-Tabelle nötig.

*Beispiel* (4 Runden, Rundenpunkte 4-3-2-1 je Runde, Team A gewinnt 3 von 4 Runden knapp):
A=13, B=9, C=6, D=2 Rundenpunkte (Summe 30). Liga-Punkte: A=2×13/30=0,87, B=0,60, C=0,40, D=0,13
(Summe exakt 2, per Konstruktion).

- **Budget:** Summe **immer exakt 2** — reine Normierung, keine Rundung/Sonderfälle nötig.
- **Fair/intuitiv?** Am ehesten „verdient" im statistischen Sinn: ein Team, das die vier Runden
  knapp dominiert (13 von 30 möglichen Rundenpunkten), bekommt nicht denselben Bonus wie ein
  Team, das sie überwältigend dominiert (z. B. 4× Platz 1 = 16/30) — Option A/B kennen diesen
  Unterschied nicht, weil sie nur die Endplatzierung sehen, nicht deren Abstand.
- **Kein Gleichstand-Sonderfall nötig** — der größte praktische Vorteil: Ties bei A/B brauchen
  eine explizite Regel (oben ausgeschrieben), C braucht keine, weil die Formel für jede
  Rundenpunkte-Verteilung, inklusive exaktem Gleichstand aller vier, wohldefiniert ist (bei
  exaktem Gleichstand ergibt die Formel automatisch 0,5 je Team).
- **Nachteil, und zwar ein echter:** Liga-Tabellenpunkte sind heute für Battle-Mode-Duelle
  ausschließlich `{0, 1, 2}` — drei ganze Zahlen. Option C erzeugt zwangsläufig **krumme
  Dezimalzahlen** (0,87/0,60/0,40/0,13 im Beispiel oben), die in derselben Tabellenspalte stehen
  wie überall sonst glatte Zweier-Schritte. Das ist kein technisches Problem (die PPS-Rang-Skala
  an anderer Stelle im Spiel ist ohnehin fraktional, `rank-to-points.json` kennt z. B. 19,9), aber
  ein **Lesbarkeits-/Konsistenz-Kompromiss**, den A und B nicht eingehen — auf der Tabellen-
  Ansichtsseite (`lib/foundation/tabs/season-table-column-defs.ts`) müsste geprüft werden, ob
  Dezimalpunkte in genau dieser Spalte irritieren, wenn jede andere Zeile glatt ist.

### Zusammenfassung

| Option | Budget-Summe | Feiner als A? | Ties ohne Sonderregel? | Ganze Zahlen? |
|---|---:|---|---|---|
| A — Sieger nimmt alles | 2 (immer) | nein | nein (Formel oben) | ja |
| B — Podium teilt | 2 (immer) | ja (Platz 1 vs. 2) | nein (Formel oben) | nein (1,5/0,5) |
| C — proportional | 2 (immer) | ja (Grad der Dominanz) | ja (automatisch) | nein (beliebig) |

---

## 4. Event-interne Rundenwertung — wie die vier 1-gegen-1-gegen-1-gegen-1-Runden simuliert werden

### 4.1 Die Weiche aus Abschnitt 1.1: N=4 feste Rollen-Runden, nicht N=variable Kadergröße

Chris' „z. B. 6 Runden, weil jedes Team 6 Spieler eingesetzt hat" setzt einen **variablen**
Mini-DM-Kader voraus, den es heute nicht gibt (1.1). Zwei Wege, das aufzulösen:

**Empfehlung: N = 4, eine Runde je bestehender Rolle.** Runde 1 = die vier Frontliner der vier
Teams gegeneinander, Runde 2 = die vier Finisher, Runde 3 = die vier Trick Fighter, Runde 4 = die
vier Iron Guards. Vorteil: **keine neue Kaderregel nötig** — Mini-DM bleibt „rollenfest, 4 Spieler
je Team", nur die Kampfform ändert sich (4v4-Gefecht → vier aufeinanderfolgende
1v1v1v1-Rollenduelle). Jedes Team muss zwangsläufig seine schwächste Rolle genauso stellen wie
seine stärkste — kein Team kann seinen Iron Guard „verstecken". Das ist zugleich die
konsistenteste Antwort auf Fund 1.1 (die vier Rollen-Profile bleiben die fachliche Grundlage der
Eignung, nichts an `MATRIX`/`SLOTS_JE_DISC["mini-dm"]` muss sich ändern).

**Alternative, größerer Eingriff:** Mini-DM bekommt zum ersten Mal einen variablen Kader (wie die
17 anderen Disziplinen, 2-6 Spieler über `buildSeasonPlayerCountByDiscipline`), und N = die für
diesen Spieltag gezogene Zahl. Das würde Mini-DM erstmals an die Kadergrößen-Permutation und die
in `battle-mode-20-spieltage-recherche-06-09.md` Abschnitt 3b beschriebene Derangement-Regel
(„zweites Vorkommen ≠ erstes") anschließen — ein sauberer Gedanke für die Zukunft, aber ein
zusätzlicher Baustein, den die feste 4-Rollen-Variante nicht braucht. **Nicht empfohlen für den
ersten Wurf**, weil er zwei offene Baustellen gleichzeitig anfasst (FFA-Format UND variable
Kadergröße für eine bisher rollenfeste Disziplin).

### 4.2 Wie eine einzelne Runde (4 Solo-Kämpfer, 1 pro Team) simuliert wird

Zwei Wege, beide nutzen ausschließlich vorhandene Bausteine:

**Weg 1 — echte Mini-Simulation im Kampfmotor (empfohlen).** Eine Runde ist **kein**
4-gegen-4-Gefecht, sondern ein Gefecht mit genau **vier Einheiten**, eine je Team, `u.side` = 0..3
statt 0/1. Das ist strukturell **kleiner** als das heutige Mini-DM-Gefecht (4 Einheiten statt 8),
nicht größer. Was das braucht:
- `gegner()`/`eigene()` (Abschnitt 1.2) funktionieren bereits unverändert.
- Formation/Reihe (`SLOT_ZUSATZ`, `reihe:0/1/2`) entfällt komplett — bei einem Kämpfer je Team
  gibt es keine Formation zu verwalten. Das nimmt der Umsetzung einen ganzen Komplex ab, den ein
  echtes 4-gegen-4-FFA (4 Teams à 4 Kämpfer gleichzeitig, 16 Einheiten) brauchen würde.
- Die einzige echte Neuarbeit ist **räumlich**: `own`/die MID-Logik (1.2) und die
  Bewegungsziele müssten von „links/rechts" auf vier Sektoren/Spawnpunkte umgestellt werden (z. B.
  ein Kreis mit vier Startpositionen bei 0°/90°/180°/270°, `dist()`/dieselbe dann-generalisierte
  dreieckslose Zielwahl bleibt unverändert nutzbar). Das ist eine Geometrieänderung, kein
  Kampflogik-Umbau.
- Rundenausgang: wie heute über die kumulierten `seiten`-Werte der vier Kämpfer (Schaden/Heilung/
  KO-Anteil via `beitragVon`, Abschnitt 1.1 in `arena-mini-dm-tdm-battlefield-rollout-plan.md`),
  nur für vier statt zwei Werte — Rang 1-4 nach Punktestand am Rundenende.
- **Aufwand:** mittel — kein neuer Kampfalgorithmus, aber eine neue Arena-Geometrie
  (Spawnpunkte, Kamera/Rendering für vier Farben statt Heim/Auswärts, s. 1.2) und ein neuer
  Sieg-Auswertungspfad für N=4 statt N=2 Seiten.

**Weg 2 — Wert-Vergleich ohne neue Simulation (schneller, aber ein Bruch mit der bestehenden
Praxis).** Statt eine echte Vier-Wege-Schlacht zu rendern/simulieren, wird pro Runde direkt
`aufEignung()`/die Mini-DM-Wertformel der vier antretenden Rollen-Spieler verglichen (plus Form-
und Zufallsanteil wie überall sonst) und daraus ein Rang 1-4 gezogen — ohne dass ein Kampf
überhaupt läuft. **Vorteil:** kein Motor-Umbau, sofort messbar mit den bestehenden Rangtreue-
Skripten. **Nachteil:** bricht mit dem Muster, das JEDE andere Arena-Disziplin heute fährt
(`arena-headless-runner.ts`/`runArenaFixtures()` simuliert immer echte Gefechte und liest deren
Punktestand — nirgends wird ein Duell durch einen reinen Eignungsvergleich ersetzt). Das wäre für
Mini-DM ein Sonderpfad, den kein Reviewer erwarten würde, und der visuell nichts zeigt, obwohl
Chris ausdrücklich von „Free For All Battle" spricht — ein sichtbarer Kampf ist erkennbar Teil der
Vorstellung, nicht nur ein Zahlenvergleich.

**Empfehlung: Weg 1.** Er ist der kleinere Eingriff, als er auf den ersten Blick wirkt (vier
Solo-Kämpfer statt acht Team-Kämpfer ist WENIGER Komplexität als das heutige Mini-DM-Gefecht), er
bleibt beim etablierten Muster „echte Simulation, echter Punktestand", und die vorbereitete
`gegner()`/`eigene()`-Generalisierung (1.2) nimmt ihm bereits die Hälfte der Arbeit ab.

### 4.3 Rundenpunkte

Chris' 4-3-2-1 ist für die **Event-interne** Rundenwertung unproblematisch — hier gilt die
OP-Sorge aus Abschnitt 3 nicht, weil Rundenpunkte nie direkt in die Liga-Tabelle fließen, sondern
nur die Event-Endplatzierung bestimmen (die dann durch eine der drei Optionen aus Abschnitt 3
läuft). **Empfehlung: 4-3-2-1 pro Runde beibehalten** — es ist die naheliegende, aus Motorsport/
Battle-Royale-Formaten vertraute Verteilung, und es unterscheidet sich bewusst von den
Liga-Punkten, wie ein Boxscore sich von der Tabelle unterscheidet.

Gleichstand innerhalb einer Runde (zwei Kämpfer exakt gleicher Punktestand am Rundenende):
benachbarte Ränge teilen ihre Punkte (2er-Tie auf Platz 3/4 → je (2+1)/2=1,5 — dieselbe
Sport-Standard-Regel wie überall sonst im Spiel, z. B. bei den ligaweiten Rang-zu-Punkte-Tabellen).

---

## 5. Spielplan-Struktur — offene Fragen, bewusst nicht gelöst

Diese Recherche soll die Terrassierung NICHT vorwegnehmen, aber die konkreten Fragen benennen,
die eine spätere Umsetzungsrunde beantworten muss:

1. **Vierergruppen-Bildung.** `buildCircleRounds()` (`season-fixture-schedule.ts:71-96`) erzeugt
   für eine Runde ausschließlich 2er-Paare. Ein Mini-DM-Spieltag müsste zwei benachbarte Paare
   der Runde zu einer Vierergruppe verschmelzen (z. B. {A-B} und {C-D} → Pod {A,B,C,D}) — offen,
   ob das eine reine Nachbearbeitung der bestehenden Paare ist oder ein eigener
   Vierergruppen-Generator werden muss, der von Anfang an in Vierern denkt.
2. **Teilbarkeit durch 4.** `LEAGUE_SIZE=16` (`lib/season/league-split.ts`) ist durch 4 teilbar —
   vier saubere Vierergruppen pro Spieltag. Eine künftige Liga mit z. B. 14 oder 18 Teams (nicht
   durch 4 teilbar) hätte einen Rest, für den es noch keine Regel gibt (ein Trio + regulärer
   PPS-Fallback? Ein Fünfer-Pod? Ein Team bleibt „spielfrei" für diese Disziplin an diesem Tag?).
3. **Das zweite Vorkommen pro Saison (Battle Mode, 20 Spieltage).** Laut
   `battle-mode-20-spieltage-recherche-06-09.md` kommt jede Disziplin im Battle Mode zweimal vor.
   Gilt die 4-Team-Regel für BEIDE Vorkommen von Mini-DM, oder nur für eines? Wenn für beide:
   werden die Vierergruppen beim zweiten Vorkommen neu gewürfelt (damit nicht dieselben vier Teams
   zweimal gegeneinander antreten)?
4. **Was passiert mit dem zweiten Disziplin-Slot desselben Spieltags?** Ein Battle-Mode-Spieltag
   trägt zwei Disziplinen. Spielen die vier Pod-Teams ihre zweite Disziplin dieses Tages weiterhin
   als normale 2er-Duelle gegen ihren ursprünglichen Rundenplan-Gegner (dann bräuchte der
   Spielplan zwei parallele Gegner-Zuordnungen für denselben Spieltag — die reguläre Paarung UND
   die Mini-DM-Vierergruppe), oder wird der ganze Spieltag für diese vier Teams umstrukturiert?
5. **Heim/Auswärts-Semantik entfällt.** Jedes Fixture-Feld im Datenmodell (`Fixture`,
   `RoundPairing`) trägt `homeTeamId`/`awayTeamId` — ein 4-Team-Event hat keine natürliche
   Heim-/Auswärts-Rolle. Andere Systeme, die diese Felder für Mini-DM-Zeilen lesen (Anzeige,
   eventuell Zuschauereinnahmen/Stimmung), müssten auf „gehört keinem Heim/Auswärts-Paar an"
   vorbereitet werden.
6. **Kaderrobustheit bei Verletzung/Sperre.** Fällt einem der vier Pod-Teams ein Rollenspieler aus
   (Frontliner verletzt), bräuchte die Vierergruppe entweder einen Ersatzspieler in derselben
   Rolle (wie heute schon bei jedem normalen Duell) oder eine Regel für „Team tritt in dieser
   Runde mit einer schwächeren Rolle an" — unverändert gegenüber heute, aber im Vierergruppen-
   Kontext neu zu prüfen, weil ein ausgefallenes Team drei andere betrifft statt nur eines.

**Bewusst nicht beantwortet:** wie der Vierergruppen-Generator konkret implementiert wird, ob er
ein neues Modul wird oder `buildCircleRounds()` erweitert, und wie die UI (Spielplan-Tab,
Team-Profil) eine Vierergruppe darstellt. Das ist der „später, separater
Implementierungs-Durchgang", den der Auftrag ausdrücklich ausklammert.

---

## 6. Empfehlung

**Option A (Sieger nimmt alles, 2/0/0/0 mit Gleichstand-Teilung) für die Liga-Punkte, kombiniert
mit N=4 festen Rollen-Runden und Weg 1 (echte Solo-Simulation) für die Event-Wertung.**

Begründung in Kürze:

- Option A ist die **einzige** der drei Verteilungen, die Chris' eigene Formulierung des
  Problems eins zu eins spiegelt: „das darf nicht so viel zählen wie zwei Disziplinen" ist am
  wörtlichsten erfüllt, wenn Mini-DM sich exakt wie ein normales Duell verhält — ein Sieger, der
  Rest leer, Summe 2, immer. Option B und C sind beide vertretbar, aber beide führen eine neue
  Punkte-Ästhetik ein (gestaffelte Teilbelohnung bzw. Dezimalpunkte), die es heute in der
  Battle-Mode-Tabellenspalte nicht gibt — A führt nichts Neues ein, sie verallgemeinert nur eine
  bestehende Idee von 2 auf 4 Teilnehmer.
- N=4 feste Rollen-Runden vermeidet die zweite, unnötige Baustelle (variable Mini-DM-Kadergröße)
  und hält die Rangtreue-Frage überschaubar: das bestehende Rollenprofil (Frontliner/Finisher/
  Trick Fighter/Iron Guard) bleibt die fachliche Eignungsgrundlage, nur die Kampfform ändert sich.
- Weg 1 (echte Vier-Kämpfer-Simulation) hält Mini-DM im selben Muster wie jede andere
  Arena-Disziplin (`runArenaFixtures()`, echte Simulation, echter Punktestand) und nutzt die
  bereits vorbereitete `gegner()`/`eigene()`-Generalisierung (Abschnitt 1.2) — der teuerste Teil
  der Arbeit ist schon geschrieben und liegt seit PR #671 ungenutzt im Code.

**Was vor jeder Umsetzung gemessen/prototypisiert werden müsste:**

1. **Eine eigene `miss-alle-disziplinen.mjs`-Variante für das FFA-Format**, die vier Kader
   gegeneinander statt zwei laufen lässt und rho für die **Event-Endplatzierung** (nicht mehr
   Sieg/Niederlage) berechnet — die bestehende Sonde kennt nur zweiseitige Duelle.
2. **Ob vier unabhängige Solo-Runden Mini-DMs Rangtreue tatsächlich heben**, wie in Abschnitt 1.3
   vorsichtig vermutet — nachmessen, nicht annehmen. Sollte sich zeigen, dass rho weiterhin unter
   0,80 bleibt, ist das FFA-Format eine begrüßenswerte Sonderregel, löst aber Mini-DMs
   eigentliches Validitätsproblem nicht — dafür bräuchte es eine eigene Rezept-/Chassisrunde,
   unabhängig von dieser Sonderregel.
3. **Ein kleiner Prototyp der Vierer-Arena-Geometrie** (vier Spawnpunkte statt zwei Feldhälften),
   bevor irgendeine Punkte-Frage in Produktion geht — die räumliche Änderung ist die einzige
   echte Motorarbeit in Abschnitt 4.2, und sie sollte zuerst laufen, bevor Rezept/Rangtreue daran
   gemessen wird (dieselbe „erst Mechanik, dann Rezept"-Reihenfolge wie überall sonst in diesem
   Projekt).
4. **Chris' Bestätigung zu den fünf offenen Spielplan-Fragen aus Abschnitt 5**, insbesondere #3
   (gilt die Regel für beide Saison-Vorkommen von Mini-DM?) und #4 (was passiert mit dem zweiten
   Disziplin-Slot desselben Spieltags?) — ohne diese beiden Antworten lässt sich kein
   Vierergruppen-Generator sinnvoll bauen.

---

## Anhang: Quellenliste

**Selbst gelesen** (dieser Stand, `101505e8`):
- `public/mockups/battle-mode.engine.js`: `ARENA_ART["mini-dm"]` (4055-4069), `SLOTS_JE_DISC
  ["mini-dm"]` (3493-3498), MATRIX (3464), `gegner`/`eigene` (13261-13270, mit dem zentralen
  Kommentar), `chooseTarget`/`own` (13353-13355), Bewegungsziele (13975, 14031-14037, 14056),
  Rendering-Farbslots (2773, 10001).
- `git log -S "GEGNER IST, WER EINE ANDERE SEITE HAT"` → Commit `1bf63a36` (PR #671).
- `lib/resolve/battle-mode-arena-team-points.ts`: Kopfkommentar (1-97, Chris-Zitat 8-10),
  `ARENA_TEAM_POINTS` (199-203), `ARENA_RESOLVED_DISCIPLINE_IDS` (159-165),
  `arenaTeamPointsForFixture`/`computeArenaTeamPointsFromFixtureResults` (630-700).
- `lib/resolve/legacy-matchday-resolve-engine.ts`: `rankWithinLeagueScope` (72-95),
  Arena-Override-Zuweisung (710-750).
- `lib/season/season-fixture-schedule.ts`: Kopfkommentar (1-28, insb. „liga-lokales
  Renn-Scoring, nicht Duell-Scoring" Zeile 22-23), `buildCircleRounds` (71-96).
- `docs/design/stand-aller-disziplinen.md`: Rangtreue-Tabelle (Zeile 91), Nachtrag zur
  Kaderrauschen-Bewegung (Zeile 3-15), Validitäts-/Verlässlichkeits-Einordnung (178-195).
- `docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md`: Mini-DM-Ist-Zustand (Abschnitt
  1.2), Rangtreue vor den Fixes (Abschnitt 0, Fund 1).
- `docs/design/battle-mode-20-spieltage-recherche-06-09.md`: als Stil-/Rigor-Vorbild dieser
  Recherche sowie für den Battle-Mode-20-Spieltage-Kontext in Abschnitt 5, Punkt 3.

**Nicht geprüft / bewusst offengelassen:**
- Ob eine Vierer-Arena-Geometrie (Kreis mit vier Spawnpunkten) mit den bestehenden
  Bodenbild-/Kamera-Funktionen (`bodenArena()`) kollidiert — reine Rendering-Frage, außerhalb des
  Fokus dieser Recherche.
- Wie genau `buildCircleRounds()` erweitert oder ersetzt werden müsste, um Vierergruppen zu
  erzeugen — Abschnitt 5 benennt die Fragen, löst sie aber ausdrücklich nicht.
- Ob eine Kaderrobustheits-Sonde (`projekt-ueberwachung-opus.md` Abschnitt 1.3) für das
  FFA-Format eigene Ergebnisse liefert — keine eigene Messung in dieser Runde gefahren.

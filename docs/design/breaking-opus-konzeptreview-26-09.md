# Breaking — Konzeptreview: Ist der Gauntlet ein Zweikampf? (Opus, 26.09.)

**Reines Konzept, kein Code.** Am Motor wurde nichts geändert. Die einzige Messung ist eine
eigenständige Nachbau-Simulation der Kettenlogik (Anhang A), keine Messung am Motor. `engine.js`
meint `public/mockups/battle-mode.engine.js`, Stand `main` `254a56c5` (26.09.).

Gelesen, vollständig: `CLAUDE.md`, `BUEHNE_ART.breaking` samt Rezept-Historie, `gauntletRunde()`,
`baueGauntlet()`, die `GAUNTLET_*`-Konstanten, `bauBuehne()` (Kanalbau), `folterStufe()`,
`spieleBuehneGauntlet()`, `lib/battle/arena-headless-runner.ts`,
`lib/foundation/battle-arena/arena-kader-adapter.ts` (`buildArenaTeam`),
`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`,
`breaking-folter-zweikampf-praesentation-13-09.md`, die Breaking-Nachträge in
`stand-aller-disziplinen.md`.

---

## 0. Eine Korrektur am Auftrag, bevor irgendetwas anderes kommt

Der Auftrag an diesen Review verlangte, echte Breakdance-Battles zu recherchieren (Musikalität,
Power-Moves gegen Footwork, Publikum, Olympia 2024) und zu fragen, ob der Gauntlet „echtes
Breaking" abbildet. **Diese Messlatte ist falsch, und Chris hat das bereits entschieden.** Am 13.09.
schrieb er wörtlich:

> „und nein wir hatten schon clarified dass breaking NICHT breakdance ist sondern ein foltern!!!!
> das gibt es so ja nicht in echt dass einer schmerz zufügt der andere muss es aushalten dann ist
> wieder der andere dran bis einer aufgibt etc!!!! bitte merke dir das das musst du berücksichtigen
> sonst wird breaking nie gut"

Derselbe Umweg ist schon einmal gefahren und verworfen worden
(`breaking-folter-zweikampf-praesentation-13-09.md`, Abschnitt 0). Der Code trägt die Entscheidung
überall: die Matrix hat kein Charisma und nur 2 Punkte Dexterity, die sechs Slots heißen
Bruchpunkt/Standhalten/Steingesicht/Aushalten/Zermürbung/Unbroken, die Ring-Zonen
GEBROCHEN/SCHMERZGRENZE/STONE FACE/MIND FORTRESS, und die Bühne hat eine Folterbank mit zehn
Geräten. Musikalität oder Stilvielfalt im Tanzsinn lassen sich in dieser Matrix gar nicht abbilden.

**Dieser Review prüft deshalb gegen Chris' eigenes Konzept, nicht gegen den Sport:** „einer fügt
Schmerz zu, der andere muss es aushalten, dann ist der andere dran, bis einer aufgibt", und seit
dem 22.09. dazu die Kette: „der Sieger kämpft dann gegen Spieler 2 aus dem anderen Team usw. […]
die HP nimmt er natürlich mit in die Folgerunde". Die Leitfrage des Auftrags bleibt trotzdem die
richtige, nur mit anderem Maßstab: **Hat der Gauntlet eine eigene Identität, oder ist er ein
generischer K.-o.-Kampf mit anderen Wörtern?** Wer Breaking beurteilen will, schaut auf die
Mechanik, nicht aufs Vokabular.

> **Empfehlung an die Orchestrierung:** den Breakdance-Irrtum als festen Satz in `CLAUDE.md`
> aufnehmen, analog zur Sperre der Eignungsmatrix. Er ist jetzt zweimal in einen Agenten-Auftrag
> gerutscht, und das 13.09.-Dokument allein hat das nicht verhindert.

---

## Kurzfassung

- **Die Präsentation ist gut, das Konzept auf dem Papier auch.** Zwei Figuren stehen sich
  gegenüber, die Rollen ERTRÄGT/PEINIGT sind beschriftet, die Folterbank eskaliert, eine
  HP-Kette läuft über Duelle hinweg, und ein Comeback von Slot 6 ist erzählbar. Das ist
  unverwechselbar und genau Chris' Bild.
- **Mechanisch ist es aber kein Zweikampf, sondern noch weniger als ein generischer K.-o.-Kampf.**
  In `gauntletRunde()` geht **kein einziges Attribut des Peinigers** ein. Der Schaden ist fest:
  10 HP, wenn der Ertragende standhält, 24 HP, wenn er einbricht. Ob ihm gerade der stärkste
  Folterer der Liga oder der schwächste Ersatzmann gegenübersteht, ändert nichts. Fechten oder
  Speed-Schach sind interaktiver. Breaking ist heute **zwei Durchhalte-Zähler, die abwechselnd
  ablaufen**.
- **Daraus folgt: Die Reihenfolge ist taktisch wertlos.** Der Nachbau (Anhang A) zeigt: Ob ein
  Team gewinnt, hängt fast nur an der **Summe der Durchhaltezeit** aller seiner Kämpfer. Alle 24
  Reihenfolgen eines Viererteams liegen in der Siegquote innerhalb des Stichprobenrauschens
  beieinander. Chris' Kernidee, „ein starker Spieler auf Slot 6 kann noch mal richtig aufholen",
  passiert zwar als Geschichte, aber derselbe Spieler würde auf Slot 1 genau gleich viel
  bewirken. Eine Aufstellungsentscheidung, die nichts entscheidet, ist keine.
- **In der Produktion ist die Kampfreihenfolge gar nicht die Slot-Reihenfolge.** `bauBuehne()`
  nimmt die Kämpfer in Kader-Reihenfolge (`SQUAD.filter(...)`), und `buildArenaTeam()` sortiert
  den Kader nach **TDM-Eignung**. Der Code-Kommentar „Team-Slot 1..n" stimmt mit diesem Pfad nicht
  überein. Heute wäre das folgenlos (siehe oben). Sobald die Reihenfolge etwas bedeutet, ist es
  ein Fehler.
- **Drei Matrix-Attribute tun thematisch nicht, was ihr Name verspricht.** Health (18) setzt
  **nicht** den HP-Vorrat, denn alle starten mit 400. Stamina (8) wirkt nur auf die Punkte je
  Zug, **nie** auf das Überleben. Power (10) ist fast nur Punktschmuck. Die Budget-Abnahme besteht
  trotzdem, weil die Gewichte über die Kanäle stimmen. Das Spiel *erzählt* diese Attribute aber
  nicht.
- **Mehrere Wege zum Erfolg gibt es heute nicht.** Es gibt genau einen: länger aushalten. Ein
  Folter-Spezialist, der Gegner schnell bricht, existiert mechanisch nicht, obwohl Chris' Satz
  genau diese zweite Rolle beschreibt.
- **Urteil:** Das Gerüst (Kette, HP-Mitnahme, Folterbank, Duell-Bild) ist richtig und soll
  bleiben. Nötig ist aber mehr als Kosmetik. Es fehlt die **eine** Stelle, an der sich zwei
  Kämpfer gegenseitig beeinflussen. Das ist ein gezielter Umbau von `gauntletRunde()`, kein
  Neubau.

**Priorisierung** (Details in Abschnitt 4):

| # | Vorschlag | Kern | Aufwand |
|---|---|---|---|
| **P1** | **Der Peiniger zählt** | Schaden = Zufügen des Peinigers gegen Aushalten des Ertragenden. Das zweite Standbein ist Torment/Power. | mittel |
| **P2** | **Bruchpunkt statt HP-Null** | Health = HP-Vorrat, Will = Aufgabe-Schwelle („bricht", bevor HP 0), Stamina = Erholung zwischen Duellen | mittel |
| **P3** | **Reihenfolge wird Taktik** | Kampfreihenfolge = Slot-Position (Bugfix). Mit P1/P2 entstehen echte Rollen: Eröffner/Mitte/Anker | klein |
| **P4** | **Die Folterbank ist Mechanik** | Die Eskalation läuft je Duell statt je eigenem Zug und begrenzt die Duell-Länge. Die Geräte-Anzeige wird korrigiert. | klein bis mittel |
| P5 | Slots als Haltungen (Mehrwege) | Die sechs Slots bekommen je eine kleine Regeländerung statt nur Attributaufschlag. | mittel, optional |
| P6 | Präsenz statt Publikum | „Unbroken"-Momente bei niedriger HP als sichtbare Spitzen und als Punkte | klein, kosmetisch |

---

## 1. Bestandsaufnahme: Was ein Duell heute tut

### 1.1 Ein Zug

`gauntletRunde(L, ri, art)` rechnet einen Zug **nur für den Ertragenden `L`**:

```
erfolg = min(0,94; 0,15 + TECHNIK·0,0055 + NERVEN·0,0035)     // hält er stand?
punkte = Basis(GRUNDLAGE, AUSDAUER-Ermüdung) [+ SPITZENMOMENT/WAGNIS bei Erfolg] + PUBLIKUM·0,12
```

`baueGauntlet()` zieht danach `GAUNTLET_SCHADEN_ERFOLG = 10` oder `GAUNTLET_SCHADEN_FAIL = 24`
vom HP-Stand des Ertragenden ab (`GAUNTLET_HP_MAX = 400`, für alle gleich). Dann wechseln die
Rollen. Der Peiniger wird nur als Name in `runden[].gegnerN` festgehalten, für die Anzeige.

### 1.2 Ein Duell

Da der Schaden nur vom eigenen `erfolg` (`p`) abhängt, hat jeder Kämpfer eine feste erwartete
Lebensdauer in eigenen Zügen: **400 / (24 − 14·p)**. Das sind etwa 20 Züge bei `p` = 0,3,
23,5 bei 0,5, 28 bei 0,7 und 37 bei 0,94. Ein Duell ist das Wettrennen zweier solcher Uhren, die
abwechselnd ticken. Der Gegner beschleunigt die eigene Uhr nicht und bremst sie nicht.

### 1.3 Die Kette

Der Sieger behält seinen HP-Stand, also seine Restlaufzeit, und läuft gegen den nächsten. Weil
jeder Tausch je eine Einheit von beiden Seiten verbraucht, ist die ganze Kette im Kern ein
Vergleich **Summe aller Lebensdauern Team A** gegen **Summe Team B**. Nachgemessen
(Anhang A, 4 gegen 4, 40 zufällige Paarungen, je 800 Ketten):

| Budget-Differenz A−B (Züge) | Siegquote A, Spannweite über alle 24 Reihenfolgen von A |
|---:|---|
| ±0–1 | 0,45–0,58 (Münzwurf, Reihenfolge ohne Einfluss) |
| +2,5 | 0,65–0,73 |
| +5,2 | 0,80–0,84 |
| +9,0 | 0,92–0,95 |
| ≥ +13 | 0,97–1,00 |

Die Spannweite je Zeile (0,03–0,10) entspricht dem, was 24 Ziehungen à 800 Ketten schon aus
reinem Rauschen erzeugen (Standardfehler ≈ 0,018). **Kein messbarer Reihenfolge-Effekt.** In
etwa 17 % der Ketten gewinnt trotzdem die Seite mit der kleineren Summe. Das ist das Würfelglück
der Einzelzüge, keine Taktik.

### 1.4 Wer in welcher Reihenfolge kämpft

`bauBuehne()`: `mine = SQUAD.filter(p => place[p.n].d === "breaking").slice(0, n)`. Es wird nicht
nach Slot sortiert. `buildArenaTeam()` (`lib/foundation/battle-arena/arena-kader-adapter.ts`)
liefert den Kader **absteigend nach TDM-Eignung**. In der Produktion eröffnet also der
TDM-stärkste Breaking-Aufgestellte, egal auf welchen Slot Chris ihn gesetzt hat. Heute ist das
dank 1.3 folgenlos. Sobald P1–P3 die Reihenfolge bedeutsam machen, muss es behoben werden.
*(Aus dem Code gelesen, nicht im Browser nachgespielt. Vor dem Bau einmal mit einer gesetzten
Aufstellung im Headless-Runner bestätigen.)*

### 1.5 Wo die Matrix-Attribute wirken

| Attribut | Matrix | Kanäle heute | Wirkt aufs Überleben? | Was der Name erwarten lässt |
|---|---:|---|---|---|
| Will | 28 | GRUNDLAGE, NERVEN, SPITZENMOMENT, PUBLIKUM | ja, über NERVEN | nicht aufgeben |
| Torment | 22 | GRUNDLAGE, TECHNIK, PUBLIKUM | ja, über TECHNIK | Qual, zugefügt oder ertragen |
| Health | 18 | GRUNDLAGE, NERVEN | nur über NERVEN (Erfolgschance) | **Größe des HP-Vorrats** |
| Power | 10 | SPITZENMOMENT, TECHNIK (15), WAGNIS | kaum | **Wucht des Hiebs** |
| Determination | 10 | TECHNIK, AUSDAUER | über TECHNIK | durchziehen |
| Stamina | 8 | GRUNDLAGE, AUSDAUER | **nein**, Ermüdung dämpft nur die Punkte | **Erholung, Durchhalten über mehrere Duelle** |

Die Pp-Abweichung besteht (23.09.), weil die Anteile über alle Kanäle stimmen. Die *Erzählung*
passt aber nicht. Wer Chris sagt „Health 80, der hält am längsten", hat mechanisch Unrecht: ein
Health-Spieler hat denselben HP-Balken wie jeder andere und bricht nur etwas seltener ein.

### 1.6 Die Folterbank ist Anzeige

`folterStufe(u.aktuell, art.rundenN)` spreizt die zehn Geräte über `rundenN = 8` eigene Züge.
Seit dem Gauntlet hat ein Überlebender aber 20 bis 100 und mehr eigene Züge. Ab dem 8. Zug
sieht er deshalb **dauerhaft den Vorschlaghammer**, und ein frisch eingewechselter Herausforderer
beginnt beim Strick. Das ist zufällig sogar erzählbar („der Veteran bekommt den Hammer"), aber
nicht beabsichtigt. Der Schaden ist für alle zehn Geräte ohnehin derselbe.

---

## 2. Was fehlt: die Identität in einem Satz

Chris' Satz hat **zwei Verben**: „einer *fügt Schmerz zu*, der andere muss es *aushalten*". Der
Motor kennt nur das zweite. Alles, was Breaking von „wer hat den dicksten HP-Balken" unterscheiden
würde, hängt am ersten:

1. **Interaktion.** Heute ist es gleichgültig, wer mir gegenübersteht. Ein Zweikampf ohne
   Gegnereinfluss ist ein Solitär mit Zuschauer. Das ist derselbe Befund wie „zwei Teams spielen
   parallel Solitär" im I-Spy-Review vom selben Tag, nur hier noch schärfer, weil das Bild einen
   direkten Zweikampf behauptet.
2. **Der Bruchpunkt.** Die Disziplin heißt nach dem Moment, in dem jemand *aufgibt* („bis einer
   aufgibt"), nicht nach dem Moment, in dem ein Balken leer ist. Heute bricht niemand, alle laufen
   leer.
3. **Rollen im Team.** Der Gauntlet lebt als Format (Kachinuki im Kendo, die Team-Modi von King of
   Fighters, Leitai) davon, *wen man wann bringt*. Im Kendo-Kachinuki ist die Reihenfolge fest und
   vorher abzugeben. In King of Fighters wählt man die Reihenfolge blind, und der Sieger erholt
   sich zwischen den Runden etwas. Genau das erzeugt die Rollen Eröffner, Mitte und Anker. Keines
   dieser Formate funktioniert, wenn der Gegner irrelevant ist.
4. **Zwei Wege.** Das nächste reale Vorbild für „einer schlägt, einer hält aus, dann Wechsel" ist
   Slap-Fighting (Power Slap): Striker und Defender wechseln sich ab, gewertet wird sowohl die
   Wirkung des Schlags als auch Reaktion und Erholung des Getroffenen, Zucken ist ein Foul, und
   ohne K.o. entscheidet die Jury. Beide Seiten der Handlung zählen. Das ist nicht als
   Kalibriervorlage gemeint, Chris will ausdrücklich kein reales Vorbild. Es zeigt nur, dass
   dieses Format bereits zwei getrennte Kompetenzen belohnt: zufügen und aushalten.

**Was nicht fehlt:** Publikum, Musikalität und Stilvielfalt im Tanzsinn. Die gehören zu
Breakdance, und Abschnitt 0 gilt.

---

## 3. Ehrliche Gegenposition

*„rho 0,833 besteht, Pp besteht, das Bild ist das beste Bühnenbild im Spiel. Warum anfassen?"*

- Weil Chris' eigene Begründung für den Gauntlet („Slot 6 holt auf") mechanisch leer ist. Er hat
  einen taktischen Hebel verlangt und bekommen, was wie einer aussieht.
- Weil die Aufstellung für Breaking heute nur eine Frage beantwortet: Wer hat die höchste
  Durchhalte-Summe? Mit P1–P3 beantwortet sie drei Fragen: Wer bricht, wer hält, wen bringe ich
  wann.
- Dagegen spricht: P1 macht das Ergebnis eines Spielers **abhängig vom Gegner**. Die
  Einzelspiel-Verlässlichkeit kann sinken, weil es mehr Streuung durch die Paarung gibt. Das ist
  das Hauptrisiko und muss vor dem Bau gemessen werden (5.2). Wenn P1 rho unter 0,80 drückt und
  sich nicht zurückholen lässt, ist **P2 + P3 allein** die kleinere, sichere Variante: Sie
  schärft die Attribut-Erzählung und macht die Reihenfolge über die Erholung bedeutsam, ohne den
  Gegner in die Schadensformel zu holen.

---

## 4. Vorschläge nach Priorität (nur Konzept)

Alle Zahlen sind **Vorschläge zum Einstieg** und gelten erst nach Messung. Die Matrix bleibt
unangetastet (CLAUDE.md). Verteilt wird nur über Rezeptkanäle, und für jede Variante sind die
Budget-Methode (Pp ≤ 25) und rho über 0,80 Pflicht.

### P1 — Der Peiniger zählt

**Idee.** Der Schaden eines Zuges entsteht aus beiden Seiten:

```
Schaden = Grundschaden · (Härte des Peinigers / Widerstand des Ertragenden) ^ k
          × (hält stand ? 0,4 : 1,0)
```

- **Härte** ist ein neuer Rezeptkanal, gespeist aus Torment und Power. Torment ist das
  namensgebende Attribut der Disziplin, und Power ist die „Wucht des Hiebs", die die
  Slot-Beschreibung „Bruchpunkt" schon verspricht.
- **Widerstand** ist ein Kanal aus Health und Determination.
- Die Erfolgschance „hält stand" bleibt wie heute über TECHNIK/NERVEN, also Will-lastig.
- Die Stauchung `k` klein halten (Vorschlag 0,5), damit Stärkeunterschiede das Duell prägen,
  aber keine Einweg-Vernichtung entsteht.

**Punkte für den Peiniger.** Heute punktet nur der Ertragende. Mit P1 bekommt der Peiniger
Punkte für zugefügten Schaden, oder einen Festbonus je gebrochenem Gegner. Nur so zählt der
zweite Weg auch in `u.summe`, also in der Rangtreue und im Boxscore.

**Warum zuerst.** Das ist die eine Stelle, an der zwei Figuren sich beeinflussen. Ohne sie bleibt
jede weitere Idee Solitär. Damit hat die Disziplin auch sofort zwei Wege: Der **Brecher** mit
hohem Torment/Power gewinnt Duelle, indem er Gegner schnell bricht. Der **Unbeugsame** mit hohem
Will/Health gewinnt, indem er länger steht. Das ist die Mehrwege-Leitlinie aus CLAUDE.md,
wörtlich aus Chris' zwei Verben abgeleitet.

**Offene Frage an Chris:** Ist „Torment" in seiner Vorstellung die Fähigkeit, Qual *zuzufügen*,
oder die, sie zu *ertragen*? Das Rezept nutzt es heute für das Ertragen (TECHNIK). Beides ist
vertretbar. Wenn er „ertragen" meint, trägt Power allein die Härte, zusammen mit einem kleineren
Anteil Will („wer nicht aufgibt, schlägt auch weiter zu").

### P2 — Bruchpunkt statt HP-Null

**Idee.** Drei Attribute bekommen die Rolle, die ihr Name verspricht:

- **Health → HP-Vorrat.** Zum Beispiel `HP_MAX = 300 + Health-Kanal · 2` statt fest 400. Health
  wird der sichtbare Puffer.
- **Will → Bruchschwelle.** Unter 30 % HP macht der Ertragende nach jedem Einbruch einen
  Willenswurf. Misslingt er, **gibt er auf**: Er „bricht", obwohl noch HP übrig sind. Gelingt er
  unter 15 % HP, ist das ein „UNBROKEN"-Moment (P6). Damit hat die Disziplin ihren Namensmoment,
  und Will und Health sind zwei unterscheidbare Profile: der Tank mit großem Balken und der
  Unbeugsame, der mit fast leerem Balken weitersteht.
- **Stamina → Erholung zwischen Duellen.** Der Sieger erholt sich vor dem nächsten Gegner um
  `Stamina-Kanal · x` HP, gedeckelt (Vorschlag: höchstens 15 % des Vorrats). Das ist das Muster
  aus den Team-Modi von King of Fighters, und es ist genau das, was ein Kettenkämpfer braucht.

**Warum.** Das ist das „bis einer aufgibt" aus Chris' Satz, und die Attribut-Erzählung aus 1.5
wird richtig. Es geht auch ohne P1, als sichere Rückfallvariante (Abschnitt 3).

### P3 — Reihenfolge wird Taktik

1. **Bugfix, unabhängig von allem anderen:** Kampfreihenfolge = Slot-Position der Aufstellung,
   nicht TDM-Sortierung des Kaders (1.4). Das ist klein und unstrittig, denn Chris' Satz setzt es
   voraus.
2. **Rollen entstehen von selbst, sobald P1 oder P2 steht.**
   - Der **Eröffner** ist ein Brecher mit hoher Härte, der müde Gegner nicht fürchten muss.
   - Die **Mitte** sind Unbeugsame, die lange Duelle ziehen.
   - Der **Anker** ist ein Kämpfer mit hoher Erholung, der mit Stamina als Letzter mehrere
     angeschlagene Gegner abräumt. Das ist Chris' „Slot 6 holt auf", jetzt mit Grund.
3. **Blinde Reihenfolge** (wie in King of Fighters): Keine Seite sieht die Reihenfolge der
   anderen vorab. So entsteht ein Konterspiel, ohne dass eine Seite reagieren kann. Das
   entspricht dem heutigen Ablauf ohnehin, beide Aufstellungen stehen fest. Es muss nur in der
   Aufstellungs-UI so gesagt werden.

**Prüfkriterium:** Der Anhang-A-Test (alle Reihenfolgen eines Teams gegen einen festen Gegner)
muss nach dem Umbau eine Spannweite der Siegquote **deutlich über** dem Rauschband zeigen, grob
ab 0,15. Sonst ist die Taktik weiterhin nur behauptet.

### P4 — Die Folterbank ist Mechanik

- Die Eskalation läuft **je Duell** (`bout`), nicht je eigenem Zug: Jedes Duell beginnt beim
  Strick, und alle *n* Tauschzüge greift der Peiniger zum nächsten Gerät.
- Jedes Gerät hebt den **Grundschaden** leicht an (Vorschlag +8 % je Stufe). Das begrenzt die
  Duell-Länge (Hammer = Ende absehbar) und macht die Bank wahr: „es wird immer schlimmer" ist
  dann eine Regel, nicht nur ein Bild.
- **Nebenwirkung, gewollt:** Ein Veteran mit Resten an HP trifft auf einen frischen Gegner, der
  wieder beim Strick anfängt. Die Erholung kommt also aus dem Duellneustart, nicht aus einem
  Zahlengeschenk. Mit P2 (Stamina-Erholung) ist das stimmig.
- `folterStufe()` bekommt den Duell-Zug statt `u.aktuell`/`art.rundenN`. Das behebt auch die
  heutige Sättigung am Vorschlaghammer ab Zug 8 (1.6).

### P5 — Slots als Haltungen (Mehrwege, optional)

Heute sind die sechs Slots nur Attributaufschläge. Vorschlag: Jede Haltung bekommt **eine** kleine
Regel, und zwar Primärweg und Nebenweg im Sinn der Leitlinie. Es gibt keine neue Rechenart, jede
Regel ist ein Faktor auf eine P1/P2-Größe:

| Slot | Haltung | Regel (Vorschlag) |
|---|---|---|
| Bruchpunkt | Brecher | +Härte als Peiniger, −Widerstand als Ertragender |
| Standhalten | Punktesammler | +Punkte je gehaltenem Zug, Schaden unverändert |
| Steingesicht | Mauer | fester Schadensabzug je Zug, dafür kein Spitzenmoment-Bonus |
| Aushalten | Unbeugsamer | Bonus auf den Willenswurf (P2) |
| Zermürbung | Konterer | beim Standhalten verliert der Peiniger 2–3 HP („antwortet im Battle", wie der Slot-Text schon sagt) |
| Unbroken | Anker | Erholungsbonus (P2), wenn er der letzte seines Teams ist |

Nur bauen, wenn P1–P3 stehen und rho/Pp Luft lassen.

### P6 — Präsenz statt Publikum (kosmetisch, klein)

Das Matrixkonzept sagt „Präsenz im Battle, nicht Lächeln" (Kommentar an `BUEHNE_ART.breaking`).
Der PUBLIKUM-Kanal ist heute ein unsichtbarer Festbonus je Zug. Vorschlag: Sichtbare
**„UNBROKEN"-Spitzen** (standhalten unter 15 % HP), mit Ticker-Zeile und Druckwelle auf der Bühne,
geben den PUBLIKUM-Anteil als Punktespitze aus statt als Rauschen. Die Mechanik bleibt gleich, nur
die Verteilung der Punkte wird erzählbar.

---

## 5. Machbarkeit gegen die Schranken

### 5.1 Was gleich bleibt

Chassis (`spieleBuehneGauntlet`), Kette, `buehneQueue`-Enthüllung, Bühnenbild, Seitentafeln,
Ticker und die Matrix bleiben. P1/P2/P4 ändern `gauntletRunde()`/`baueGauntlet()`, P3.1 ändert eine
Sortierung in `bauBuehne()`, alles andere liest nur.

### 5.2 Das Risiko in den zwei Größen

- **Validität (Saison)** sollte mit P1/P2 eher *steigen*: Heute wirken Health, Power und Stamina
  auf den Ausgang nur verdünnt, künftig direkt. Die Eignung misst diese Attribute, die Mechanik
  belohnt sie dann auch.
- **Verlässlichkeit (ein Spiel)** kann mit P1 *sinken*, weil das eigene `u.summe` jetzt auch
  davon abhängt, wen man trifft. Gegenmittel in dieser Reihenfolge: `k` klein halten; P4
  begrenzt die Duell-Länge und damit die Streuung der Zugzahl; Peiniger-Punkte (P1), damit ein
  Kämpfer mit wenig eigener Ertragezeit trotzdem sichtbar punktet.
- **Pp-Budget:** Die neuen Kanäle (Härte, Widerstand, Vorrat, Bruchschwelle, Erholung) müssen neu
  verteilt werden. Die Lehre vom 23.09. gilt doppelt: Ein Attribut in einem Überlebens-Kanal wird
  über die Überlebensdauer **verstärkt**. Health als HP-Vorrat *und* in NERVEN wäre ein
  Doppelhebel. Also bekommt jedes Attribut höchstens einen verstärkten Kanal, wie im heutigen
  Rezept.

### 5.3 Reihenfolge für den Bau

1. **P3.1** (Slot-Reihenfolge), sofort. Klein und folgenlos für rho, solange die Reihenfolge
   nichts bewirkt.
2. **P2** allein, messen (rho, Pp, Anhang-A-Spannweite).
3. **P1** darauf, messen. Wenn rho kippt: `k` senken, P4 dazunehmen, erst dann aufgeben und bei P2
   bleiben.
4. **P4**, dann **P6**, und **P5** zuletzt und nur, wenn Luft bleibt.

---

## 6. Offene Fragen an Chris

1. **Torment: zufügen oder ertragen?** Das entscheidet, wer in P1 die Härte trägt.
2. **Soll ein Kämpfer aufgeben können, bevor seine HP leer sind (P2, Bruchschwelle)?** Das ist
   das „bis einer aufgibt" aus seiner Formulierung, aber eine sichtbare Regeländerung.
3. **Blinde Reihenfolge (P3.3):** Ist gewollt, dass keiner die gegnerische Reihenfolge kennt?
4. **Peiniger-Punkte:** Darf der Folterer für zugefügten Schaden punkten, oder soll nur das
   Aushalten zählen? Die Mehrwege-Leitlinie spricht für ja.

---

## 7. Was dieser Review bewusst nicht tut

- Er empfiehlt nichts aus Breakdance (Abschnitt 0).
- Er ändert keine Zahl im Motor und misst nicht am Motor. Anhang A ist ein Nachbau der Kettenlogik
  mit direkt vorgegebenen Erfolgschancen, keine Rangtreue-Messung.
- Er rührt die Eignungsmatrix nicht an und fragt nicht danach (CLAUDE.md).

---

## Anhang A — Nachbau der Kette

Eigenständiges Node-Skript (nicht eingecheckt, im Scratchpad dieses Agenten gelaufen). Es bildet
`baueGauntlet()` Zeichen für Zeichen nach: Schaden 10/24, HP 400, der Heim-Kämpfer beginnt als
Peiniger, nach einem K.o. erträgt der frische Herausforderer zuerst. Erfolgschancen `p` werden je
Kämpfer gleichverteilt aus [0,30; 0,94] gezogen.

```js
function kette(A, B){                       // A, B: Erfolgschancen je Kämpfer in Kampfreihenfolge
  const hp=[A.map(()=>400), B.map(()=>400)]; let ai=0, bi=0, endX=false;
  for(let k=0;k<3000;k++){
    const s=endX?0:1, i=s?bi:ai, p=(s?B:A)[i];
    hp[s][i] -= Math.random()<p ? 10 : 24;
    if(hp[s][i]<=0){
      if(s){ if(++bi>=B.length) return 0; endX=false; }   // Gast-Team leer -> Heim gewinnt
      else { if(++ai>=A.length) return 1; endX=true;  }
    } else endX=!endX;
  }
}
// Budget je Team: Summe 400/(24-14p). Test: Siegquote von A über alle 24 Permutationen von A
// gegen festes B, je 800 Ketten, 40 zufällige Paarungen.
```

Ergebnis: Tabelle in 1.3. Nebenbefund: Kämpfer, die in einer Kette nie antreten, gibt es bei 4
gegen 4 zu 0,6 %, bei 6 gegen 6 zu 1,1 %. Das Problem „Slot 6 kommt nie dran" existiert also
praktisch nicht.

**Zur Methodik:** Ein erster Lauf mit einem selbstgebauten linearen Kongruenzgenerator lief in
einen kurzen Zyklus und lieferte scheinbar große Reihenfolge-Effekte. Das ist dieselbe Falle wie
bei `zieheFormkarten` (CLAUDE.md). Die Tabelle stammt aus dem Lauf mit `Math.random`.

## Quellen

- Power Slap, offizielle Regeln (Striker/Defender im Wechsel, Erholungszeit, Zucken als Foul,
  Juryentscheid nach Wirkung und Reaktion): [powerslap.com/rules](https://www.powerslap.com/rules/),
  [Regelwerk v1.01 (PDF)](https://cdn.vox-cdn.com/uploads/chorus_asset/file/24244296/Power_Slap_Rules__final_.pdf)
- Kachinuki (Sieger bleibt, feste Reihenfolge, Unentschieden = beide raus):
  [Norwalk Kendo Dojo, Kachinuki Tutorial (PDF)](https://www.eanet.com/norwalk/archives/2015/50th/kachinuki.pdf),
  [Stockholm Kendo Open, Wettkampfformat](https://stockholmkendoopen.se/competition/)
- King of Fighters, Team-Modus (3 gegen 3, Sieger bleibt mit Rest-HP und erholt sich teilweise,
  Reihenfolge blind gewählt): Allgemeinwissen zur Reihe, keine Einzelquelle herangezogen.

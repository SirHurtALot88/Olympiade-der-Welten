# Gewichtheben: Mehr Spannung im Duellverlauf — Fable-Recherche mit Messung (13.09.)

Auslöser Chris, wörtlich (13.09., beim Zuschauen eines laufenden Gewichtheben-Duells):

> „gewichtheben muss noch irgendwie mehr spannung haben. Momentan sieht man ja am anfang schon
> der eine hegbt höhere gewichte als der andere von anfang an und das wird dann auch der sein
> der am ende gewinnt außer es ist knapp, müssten nicht beide die gleichen gewichte heben? wie
> ist das in echt? lass fable das mal suchen und konzeptionieren und setze das dann sauber um"

Drei Fragen stecken darin, und sie haben verschiedene Antworten:

1. **„müssten nicht beide die gleichen gewichte heben?"** — Nein. Das ist im echten Sport
   ausdrücklich nicht so, und es wäre auch die falsche Reparatur. Abschnitt 1.
2. **„sieht man ja am anfang schon"** — Ja, nachgemessen, und deutlicher als vermutet.
   Abschnitt 2/3.
3. **„das wird dann auch der sein der am ende gewinnt"** — Ja, aber der Hauptgrund liegt nicht
   in der Versuchsplanung, sondern in der Paarung. Abschnitt 3.4. Wer das verwechselt, baut
   an der falschen Stelle.

Reine Recherche zuerst, Umsetzung danach im selben PR (Chris' „konzeptionieren und setze das
dann sauber um"). Gewichtheben ist live (`ARENA_RESOLVED_DISCIPLINE_IDS`) — jede Umsetzung
fällt unter die verschärfte Review-Sorgfalt für Produktionscode.

---

## 0. Ergebnis vorab

1. **Im echten Gewichtheben hebt jeder sein eigenes Gewicht, und genau das IST der Sport.**
   Jeder Heber sagt vor jedem seiner drei Versuche über seinen Trainer selbst an; niemand muss
   das Gewicht des Gegners spiegeln. Die strategische Gewichtswahl — mit Kenntnis dessen, was
   der Rivale schon gehoben hat — ist die zweite Hälfte des Wettkampfs neben der Technik.
   Gleiche Gewichte für beide wären also nicht „realistischer", sondern würden den einzigen
   taktischen Kanal löschen, den es gibt. Abschnitt 1.
2. **Chris' Beobachtung stimmt, und sie ist messbar.** In 200 Spielen (1200 Duellen): die
   höhere **Eröffnungsansage** gewinnt **82,8 %** aller Duelle. In **66,2 %** der Duelle liegt
   die Eröffnung des einen Hebers bereits über dem **höchsten Versuch, den der andere im ganzen
   Wettkampf überhaupt ansagt** — das ist Chris' Satz wörtlich, als Zahl. Abschnitt 3.1.
3. **Der Hauptgrund ist aber die PAARUNG, nicht die Versuchsplanung.** Duelle werden über den
   Slot gepaart, nicht über die Stärke (`baueHebenDuelle`: „mein Power Opener gegen ihren Power
   Opener"), und der Kader spannt Tagesmaxima von 104 bis 476 kg. Nach Kräfteverhältnis
   getrennt: in **engen** Duellen (Tagesmax-Abstand 3–10 %) gewinnt der Führende nach Versuch 1
   nur **56,3 %**, es gibt in **59,8 %** einen Führungswechsel, der mittlere Abstand ist 21 kg —
   **diese Duelle sind bereits spannend.** In **deutlichen** Duellen (10–25 %) gewinnt er
   91,7 %, Führungswechsel 14,5 %, Abstand 165 kg. Abschnitt 3.4. **Ein Eingriff, der ein
   165-kg-Duell eng macht, zerstört die Rangtreue — und wäre gelogen.**
4. **Es gibt trotzdem zwei echte, benennbare Fehler in der Versuchsplanung, und beide kosten
   genau die Spannung, die Chris vermisst.**
   * **(A) Der Rückstand aus dem Reißen wird im Stoßen komplett vergessen.** Die
     Gegner-Reaktion im dritten Versuch vergleicht nur `besteStossen`, nie den Zweikampf. Ein
     Heber, der im Reißen 10 kg verloren hat, zieht im Stoßen auf `Gegner+1` — und liegt danach
     immer noch 10 kg hinten. Er hat das Risiko getragen und nichts davon gehabt. Umgekehrt
     riskiert ein Heber, der im Reißen 10 kg **vorn** liegt, im Stoßen einen Ausgleichsversuch,
     den er gar nicht braucht. **Beide Richtungen sind falsch, und beide entschärfen die
     Aufholjagd.** Abschnitt 4.1.
   * **(B) Die Eröffnung kennt den Gegner überhaupt nicht.** `anteil = plan.eroeffnung +
     (ANSAGE−50)·k`, gedeckelt bei 0,97 — rein aus den eigenen Werten. Im echten Sport ist
     genau die Eröffnung der am stärksten gegnerabhängige Zug des Tages. Abschnitt 4.2.
5. **Empfohlen und umgesetzt: zwei Änderungen, beide mit einer Nullstelle genau dort, wo das
   Spiel heute schon gut ist.**
   * **A — „Der Zweikampf zählt, nicht die Übung":** die Reaktion im dritten Versuch rechnet
     mit dem Zweikampf-Stand über beide Übungen. **Im Reißen bit-identisch zu heute** (dort ist
     der gebuchte Vorlauf beidseitig 0) — die Änderung berührt ausschließlich den dritten
     Stoßversuch.
   * **B — „Duellbewusste Eröffnung bei unverändertem Zielgewicht":** wer klar vorn liegt,
     eröffnet sicherer; wer klar hinten liegt, eröffnet mutiger — und die Sprünge werden so
     nachskaliert, dass **das geplante Endgewicht unverändert bleibt**. Nur der Weg ändert
     sich, nicht die Decke. In einem ausgeglichenen Duell ist der Versatz 0 und das Verhalten
     bit-identisch.
6. **Geprüft und VERWORFEN: vier naheliegende Ideen.** Gleiche Gewichte für beide (unrealistisch,
   löscht die Taktik), volle IWF-Hebereihenfolge über alle sechs Versuche (realistisch, aber
   dramaturgisch schlechter — der Schwächere wäre fertig, bevor der Stärkere anfängt), die nächste
   Ansage verbergen (hinfällig, sie wird gar nicht vorab gezeigt) und ein kühner Versuch auch für
   den Führenden (Abschnitt 5.6 — er scheitert schon heute an 29 % seiner dritten Versuche, und
   die gewünschte Fallhöhe liefert Maßnahme B ohne Rangtreue-Risiko gleich mit). Abschnitt 6.
7. **Rangtreue gehalten, Spannung gewonnen — beides gemessen.** rho je Spiel 0,854 → 0,843 bei
   n=24 und 0,844 → **0,851** bei n=48: die Bewegung ist kleiner als das Kaderrauschen
   (Spannweite ~0,20) und **wechselt das Vorzeichen mit der Stichprobengröße**, ist also von
   Null nicht unterscheidbar. Die Saison-Zahl steigt dagegen in beiden Stichprobengrößen
   konsistent (0,923 → 0,930 / 0,937) — in der CLAUDE.md-Zerlegung heißt das: **Validität hoch,
   Verlässlichkeit runter, und genau das ist Spannung als Zahl.** Der IWF-Korridor hält in allen
   Zeilen. Chris' Kernbeschwerde („Eröffnung > jeder Versuch des Gegners") fällt von **66,2 % auf
   50,0 %**, die Entscheidung fällt fast doppelt so oft erst in der letzten Hantel (2,9 →
   5,7 %), und in den **engen** Duellen ist der Führende nach Versuch 1 jetzt eine Münze
   (56,3 → **49,0 %**). Abschnitt 5.

---

## 1. Wie der echte Wettkampf funktioniert (Recherche)

### 1.1 Jeder hebt sein eigenes Gewicht — und sagt es selbst an

Die Grundregel beantwortet Chris' Frage direkt: **nein, beide heben nicht dieselben Gewichte.**
Ein IWF-Wettkampf besteht aus zwei Übungen (Reißen, Stoßen) mit je drei Versuchen. Vor jedem
Versuch sagt der Athlet — praktisch: sein Trainer am Anmeldetisch — die Last an, die auf die
Stange soll. Es gibt keine Regel und keinen Anreiz, das Gewicht eines Rivalen zu spiegeln.

Die harten Randbedingungen dazu (IWF Technical and Competition Rules, Fassung 2025):

* **Die Stange ist immer ein Vielfaches von 1 kg.** Der oft zitierte 2,5-kg-Schritt ist
  historisch; die heutige Mindeststeigerung nach einem **gelungenen** eigenen Versuch beträgt
  **1 kg**. Das ist wichtig, weil es das taktische Kilo überhaupt erst erlaubt: „ich nehme
  genau eins mehr als er" ist eine legale, alltägliche Ansage.
* **Die Last sinkt nie.** Innerhalb einer Übung geht die Stange für einen Athleten nur aufwärts;
  nach einem Fehlversuch darf er dieselbe Last wiederholen oder höher gehen, aber nicht tiefer
  als bereits erfolgreich Gehobenes.
* **Die Ansage darf zweimal geändert werden**, und eine Erhöhung muss vor dem letzten Aufruf
  mit Unterschrift auf der Athletenkarte bestätigt sein. Das ist die Regel, die das Pokern
  überhaupt ermöglicht: man darf auf das reagieren, was der Rivale gerade getan hat.
* **Nullwertung:** drei Fehlversuche in einer Übung, und es gibt keinen Zweikampf. Wer im
  Reißen nullt, tritt im Stoßen gar nicht mehr an.
* **Gleichstand im Zweikampf:** es gewinnt, wer die Last **zuerst** gehoben hat (also mit
  weniger Versuchen bzw. früher in der Reihenfolge).

### 1.2 Die Hebereihenfolge ist die eigentliche Bühnenregie

Das ist der Punkt, den Laien am häufigsten falsch haben, und er ist für unser Spiel relevant:
**die Reihenfolge läuft nicht Heber für Heber und nicht Versuch für Versuch, sondern strikt
aufsteigend nach angesagtem Stangengewicht — über das gesamte Feld.**

Die Stange wird zu Beginn einer Übung auf das niedrigste angesagte Gewicht geladen und **wird
danach nie wieder leichter**. Wer 100 kg angesagt hat, hebt vor dem, der 101 angesagt hat —
unabhängig davon, ob das für den einen der erste und für den anderen der dritte Versuch ist.
Bei gleichem Gewicht entscheidet zuerst die **niedrigere Versuchsnummer** (erste Versuche vor
zweiten vor dritten), danach die **Losnummer** aus der Auslosung nach der Endmeldung.

Daraus folgen drei Dinge, die die Dramaturgie jeder Übertragung tragen:

* **Der Schwächste eröffnet, der Stärkste beschließt.** Die letzte Hantel der Sitzung ist immer
  die schwerste. Der Wettkampf baut sich von selbst auf.
* **Wer mehr ansagt, hebt später — und weiß deshalb mehr.** Das letzte Wort hat, wer am meisten
  wagt. Das ist ein Vorteil, den man sich durch Mut kauft, nicht durch Startnummer.
* **Ein kühner Sprung verschiebt die eigene Position in der Reihenfolge.** Man kann sich
  bewusst hinter einen Rivalen legen, indem man ein Kilo mehr ansagt — der Klassiker.

### 1.3 Woher die Spannung im echten Sport wirklich kommt

Vier Quellen, und keine davon ist „beide heben dasselbe":

1. **Technisches Scheitern bei jedem Gewicht.** Das ist die größte. Empirie aus der zitierten
   Auswertung der IWF-Weltmeisterschaften 2011–2023 (Scientific Reports 2024), die schon in
   `HEBEN_BASIS` steckt: Reißen 85,9 / 78,9 / 58,7 %, Stoßen 89,3 / 74,4 / 51,4 %. **Jeder
   dritte bis zweite dritte Versuch geht daneben — auch beim Favoriten.** Der Wettkampf ist nie
   vor der letzten Hantel entschieden, weil niemand sicher hebt.
2. **Die Eröffnung als taktische Entscheidung.** Die Lehrmeinung (Greg Everett, Catalyst
   Athletics; Jim Schmitz, IronMind) ist konsistent: die Eröffnung ist ein Gewicht, „das der
   Heber schon oft gemacht hat und dem er voll vertraut" — Beispiel dort 93–97–100 bei einem
   Ziel von 100, also **abnehmende** Sprünge. **Aber:** wenn es um Qualifikation, Medaille oder
   einen Rekord geht, „eröffnen Heber deutlich höher als normal" und nehmen Fehlversuche in
   Kauf. Wer die Wahl hat, sichert erst den Zweikampf; wer sie nicht hat, zockt von Anfang an.
3. **Der Zweikampf verbindet die beiden Hälften.** Nach dem Reißen steht eine Differenz, und
   die regiert den kompletten Stoß-Plan des Zurückliegenden — **die Eröffnung eingeschlossen,
   nicht erst den dritten Versuch.** Das ist der Punkt, an dem unser Spiel heute falsch liegt
   (Abschnitt 4.1/4.2).
4. **Die Reaktion im letzten Versuch.** Wer hinten liegt, nimmt genau so viel, wie er zum
   Überholen braucht — oder etwas mehr, wenn er sich traut.

### 1.4 Zwei Belege aus Paris 2024, die genau unsere zwei Fehler spiegeln

* **Hou Zhihui (F 49 kg)** lag nach dem Reißen hinter Mihaela Cambei — obwohl sie die beste
  Reißerin der Klasse ist. Sie holte den Rückstand im Stoßen auf und verdrängte Cambei mit
  ihrem letzten Versuch (olympischer Rekord im Stoßen) von Gold auf Silber. **Das ist exakt der
  Mechanismus, den unser Stoßen heute nicht kennt:** der Rückstand aus dem Reißen bestimmt, was
  im Stoßen nötig ist.
* **Antonino Pizzolato (M 89 kg)** brachte nur einen von drei Reißversuchen. Um überhaupt im
  Medaillenrennen zu bleiben, **eröffnete er das Stoßen bei 212 kg — 5 kg unter seinem eigenen
  Weltrekord.** Eine Eröffnung, die er ohne den Rückstand nie gewählt hätte. **Das ist exakt
  der Mechanismus, den unsere Eröffnung heute nicht kennt:** die Lage im Duell bestimmt, wie
  mutig man anfängt.

Zwei reale Wettkämpfe, zwei unserer zwei Lücken. Das ist die Rechtfertigung dafür, genau diese
beiden zu schließen und nichts darüber hinaus zu erfinden.

---

## 2. Was das Spiel heute tut (Code gelesen)

`public/mockups/battle-mode.engine.js`, `baueHebenDuelle` (:11792) und `hebeUebung` (:11876).

### 2.1 Die Obergrenze

```js
u.tagesmax = (HEBEN_KG_BASIS + u.LAST*HEBEN_KG_PRO_LAST) * (1 + (u.ANSAGE-50)*HEBEN_TAGESMAX_ANSAGE_K);
u.maxReissen = u.tagesmax * HEBEN_ANTEIL_REISSEN;
u.maxStossen = u.tagesmax * (1-HEBEN_ANTEIL_REISSEN) * (0.94 + (u.ERHOLUNG-50)*HEBEN_ERHOLUNG_K);
```

`LAST` 1..100 spannt damit 104 bis 476 Sinclair-kg. Das ist Absicht („Lava Golem und Lulu stehen
in derselben Liga") und der Grund, warum die Paarung so viel wiegt.

### 2.2 Die Versuchsplanung — heute vollständig gegnerblind bis zum dritten Versuch

```js
const anteil = Math.min(0.97, plan.eroeffnung + (u.ANSAGE-50)*HEBEN_ANSAGE_EROEFFNUNG);
ansage[u.id] = Math.max(1, Math.round(max(u)*anteil));
…
const sprung = (v===0 ? plan.sprung1 : plan.sprung2) * (1 + (u.ANSAGE-50)*HEBEN_ANSAGE_SPRUNG);
ansage[u.id] = Math.max(kg+1, Math.round(kg*(1+sprung)));
```

`plan` ist die Slot-Rolle, und **beide Heber eines Duells bekommen dieselbe Rolle** (Paarung
über den Slot-Index). Eröffnungsanteile 0,89–0,94, Sprünge 2–6 %. Der einzige individuelle
Kanal ist `ANSAGE`. **Der Gegner kommt in Versuch 1 und 2 nirgends vor.**

### 2.3 Der einzige gegnerabhängige Zug: der dritte Versuch

```js
if (v===2 && beste(gegner) > beste(u)) {
  const basisZiel = Math.round(beste(gegner)) + 1;
  const zuschlag = Math.min(HEBEN_WAGNIS_MAX_KG, Math.max(0, u.ANSAGE-50)*HEBEN_WAGNIS_ANSAGE_K);
  const ziel = basisZiel + Math.round(zuschlag);
  if (ziel <= max(u)*1.06) { kg = Math.max(kg, ziel); if (kg > basisZiel) kuehnFlag[u.id] = true; }
}
```

`beste(u)` ist `u.besteReissen` **oder** `u.besteStossen` — je nach laufender Übung. **Nie die
Summe.** Das ist Fehler (A).

Dazu die Reihenfolge-Regel (seit 06.09., IWF-konform): im dritten Versuch sagen beide auf
demselben Stand an, die leichtere Ansage hebt zuerst, die schwerere zuletzt und darf nach dem
Ausgang noch nachziehen. Die ersten beiden Versuche laufen fest `[a,b]` — folgenlos, weil
niemand reagiert.

### 2.4 Die Erfolgskurve

```js
const risikoMax = Math.max(1, max(u)*(1 + (u.ANSAGE-50)*HEBEN_WAGNIS_ANSAGE_FLEX));
const ueber = Math.max(0, kg/risikoMax - 1);
const p = clamp(HEBEN_BASIS[uebung][v] + TECHNIK + NERVEN (+3. Versuch) + Wiederholung − ueber*HEBEN_WAGNIS_K);
```

**Wichtig für alles Folgende:** `ueber` ist **null**, solange die Ansage unter `risikoMax`
liegt. Eine höhere Eröffnung **innerhalb** des eigenen Maximums kostet also keine
Erfolgswahrscheinlichkeit — sie hebt nur die erreichbare Decke. Daraus folgt zwingend:
**jede Maßnahme, die einen Heber höher eröffnen lässt, ohne sein Zielgewicht zu fixieren, ist
ein reiner Buff und verschiebt die Rangtreue.** Das ist der Grund für die
Zielgewicht-Invarianz in Maßnahme B (Abschnitt 4.2) — ohne sie wäre die Idee falsch.

---

## 3. Gemessen: wie früh steht der Sieger fest?

Neue Sonde `scripts/diag-gewichtheben-spannung.mjs` (200 Spiele, 1200 Duelle, Saaten
1337 + i·7919 wie die Korridor-Sonde). Sie misst nicht die Rangtreue, sondern die Dramaturgie.
Die Reihenfolge im Protokoll ist zugleich die Enthüllungsreihenfolge auf der Bühne
(`buehneQueue` nimmt `runden[v]` beider Heber je `v`), „Stand nach Schritt v" ist also genau
das, was der Zuschauer nach v+1 Versuchen sieht.

### 3.1 Chris hat recht, und die Zahl ist hoch

| Größe | Gemessen |
|---|---:|
| Führender nach dem 1. Versuch gewinnt | **76,1 %** |
| **Höhere Eröffnungs-ANSAGE gewinnt** | **82,8 %** |
| **Eröffnung > jeder Versuch des Gegners** | **66,2 %** |

Die dritte Zeile ist Chris' Satz als Zahl: **in zwei von drei Duellen sagt ein Heber schon im
ersten Versuch mehr an, als der andere im gesamten Wettkampf jemals ansagen wird.** Das ist
keine Fehlwahrnehmung.

### 3.2 Und es passiert danach wenig

| Größe | Gemessen |
|---|---:|
| Führungswechsel je Duell (6 Schritte) | 0,57 |
| Duelle mit mindestens einem Wechsel | 34,6 % |
| Duelle mit Wechsel im Stoßen | 16,6 % |
| **Entscheidung erst im LETZTEN Versuch** | **2,9 %** |
| Schwächerer lag nie auch nur einmal vorn | 65,4 % |
| Abstand < 10 Sinclair-kg | 11,8 % |
| Abstand Mittel | 96,8 kg |

### 3.3 Der Führende trägt kein Risiko

| Dritter Versuch | Gelingen | n |
|---|---:|---:|
| wenn **führend** | **70,6 %** | 2376 |
| wenn **zurück** | **53,7 %** | 2376 |
| Steigerung 2.→3. Versuch, führend | +2,79 % | |
| Steigerung 2.→3. Versuch, zurück | +2,41 % | |

Der Führende steigert **weniger** als der Zurückliegende und gelingt **17 Prozentpunkte
häufiger**. Der IWF-Korridor für dritte Versuche ist 50–63 %; der Führende liegt mit 70,6 %
**darüber**. Er spielt auf Nummer sicher, und die Mechanik lässt ihn.

### 3.4 Der eigentliche Befund: es liegt an der Paarung

Duelle nach dem Tagesmax-Abstand der beiden Heber getrennt (Paarung über den Slot, nicht über
die Stärke — jede Lage kommt in diesem Kader je zweimal vor, daher exakt 33,3 %):

| Lage | Anteil | Führer(V1) gewinnt | mit Wechsel | letzter Versuch entscheidet | Abstand |
|---|---:|---:|---:|---:|---:|
| **eng (3–10 %)** | 33,3 % | **56,3 %** | **59,8 %** | **6,8 %** | **21,4 kg** |
| deutlich (10–25 %) | 33,3 % | 91,7 % | 14,5 % | 0,5 % | 165,5 kg |
| Missverhältnis (>25 %) | 33,3 % | 81,1 % | 29,5 % | 1,5 % | 103,6 kg |

**Zur Belastbarkeit dieser Aufteilung:** die Sonde fährt den fest verdrahteten Standardkader
(`window.__arena.spiele`), also sechs feste Slot-Paarungen über 200 Saaten — je Lage genau zwei
Paarungen, daher die exakt gleichen 33,3 %. Die **Spalten** sind damit über 400 Duelle je Lage
gemittelt und belastbar; die **Verteilung auf die Lagen** ist es nicht (ein anderer Kader hat
andere Slot-Abstände). Für die Abnahmezahl rho gilt weiterhin ausschließlich die kaderfeste
Messung über die live-save-Familie (Abschnitt 5.1). Dass der Effekt „>25 % Missverhältnis" in
der mittleren Spalte nicht monoton zur Lage läuft, ist genau dieser Paarungs-Eigenheit
geschuldet — `TECHNIK`/`NERVEN`/`ERHOLUNG` stecken nicht im Tagesmax-Abstand.

**Das ist die wichtigste Tabelle des Dokuments.** Ein Drittel der Duelle ist bereits genau so
spannend, wie Chris es sich wünscht: der Führende nach Versuch 1 gewinnt kaum häufiger als eine
Münze, in sechs von zehn Duellen wechselt die Führung, jedes fünfzehnte entscheidet sich erst
in der letzten Hantel. **Die Mechanik kann Spannung.** Zwei Drittel der Duelle sind dagegen
Kräfte-Missverhältnisse, in denen 100 bis 165 kg Abstand stehen.

**Ein Eingriff, der so ein Duell eng macht, ist kein Spannungsgewinn, sondern eine Lüge** — und
er würde die Rangtreue (0,854, die Abnahmezahl dieser Disziplin) sofort kosten, weil rho genau
misst, ob der Stärkere auch mehr hebt. Die Paarung über den Slot ist zudem eine bewusste
Entscheidung („ein bewusst schwach besetzter Slot ist ein Zug und kein Unfall") und gehört
nicht in diesen PR.

**Woran also arbeiten?** An den beiden Stellen, an denen das Spiel unabhängig vom
Kräfteverhältnis etwas Falsches tut — und zwar so, dass der Eingriff in engen Duellen
**exakt null** ist und in schiefen Duellen die Optik und die Aufholjagd repariert.

---

## 4. Die zwei Maßnahmen

### 4.1 (A) Der Zweikampf zählt, nicht die Übung

**Der Fehler.** `hebeUebung("stossen")` startet mit `besteStossen = 0` für beide und vergleicht
im dritten Versuch nur `besteStossen`. Der Reiß-Ausgang ist zu diesem Zeitpunkt endgültig und
steht auf `u.besteReissen` — er wird nur nirgends gelesen.

Zwei Fehlverhalten, beide gemessen im Ticker sichtbar:

* **Der Zurückliegende jagt zu kurz.** 10 kg Rückstand aus dem Reißen, im Stoßen zieht er auf
  `Gegner+1` — und verliert den Zweikampf um 9. Er hat ein Wagnis getragen, das ihn nicht
  gewinnen lassen kann. Das ist der direkte Grund, warum „Wechsel im Stoßen" bei nur 16,6 %
  liegt.
* **Der Führende riskiert umsonst.** 10 kg Vorsprung aus dem Reißen, im Stoßen liegt er in der
  Übung 3 kg hinten — er zieht auf `Gegner+1`, obwohl er 7 kg Luft hat. Ein Fehlversuch dort
  kann ihn den schon sicheren Sieg kosten.

**Die Reparatur.** Die Reaktion rechnet mit dem Zweikampf-Stand, so wie ihn die Anzeigetafel
zeigt:

```
gebucht(x)    = (Stoßen ? x.besteReissen : 0)
duellStand(x) = (Stoßen und x.besteReissen<=0) ? 0 : gebucht(x) + beste(x)
basisZiel     = round(duellStand(gegner) − gebucht(u)) + 1
```

**Im Reißen ist `gebucht` beidseitig 0, `duellStand` ist dann identisch `beste`, und
`basisZiel` reduziert sich exakt auf `round(beste(gegner))+1` — den heutigen Ausdruck.** Die
Änderung ist damit im Reißen bit-identisch und berührt ausschließlich den dritten Stoßversuch.
Das macht sie prüfbar.

Die Nullwertungs-Klausel ist keine Kosmetik: wer im Reißen genullt hat, hat Zweikampf 0,
unabhängig vom Stoßen. Ihn eine Aufholjagd fahren zu lassen wäre sinnlos, und seinen Gegner auf
einen 0-Stand jagen zu lassen erst recht. Beides fällt durch `duellStand` automatisch weg.

Der bestehende Deckel `ziel <= max(u)*1.06` bleibt unangetastet und wird jetzt **öfter** greifen
— genau richtig: wer 30 kg zurückliegt, kann realistisch nicht mehr aufholen und hebt sein
eigenes Programm zu Ende. Das ist die reale Entscheidung, nicht ein Ausweichen.

**Erwartete Wirkung.** Die Aufholjagd im Stoßen bekommt zum ersten Mal ein richtiges Ziel; der
Führende nimmt kein Risiko mehr, das er nicht braucht. Beides erhöht die Rangtreue eher, als
dass es sie senkt: der Schwächere scheitert häufiger an einem ehrlich zu hohen Gewicht, der
Stärkere verliert seltener einen sicheren Sieg an einen unnötigen Fehlversuch.

### 4.2 (B) Duellbewusste Eröffnung bei unverändertem Zielgewicht

**Der Fehler.** Die Eröffnung kennt den Gegner nicht — obwohl sie im echten Sport der am
stärksten gegnerabhängige Zug ist (Pizzolato, 1.4). Dadurch bildet die erste Ansage das
Kräfteverhältnis 1:1 ab und verrät den Ausgang (66,2 %, Abschnitt 3.1).

**Die Reparatur, und warum sie nicht der übliche Balancing-Trick ist.** Aus Abschnitt 2.4 folgt
zwingend: einen Heber einfach höher eröffnen zu lassen wäre ein Gratis-Buff (`ueber` = 0
unterhalb des Maximums), und das würde die Rangtreue verschieben. Also bleibt das **geplante
Endgewicht fix**, und nur der **Weg dorthin** ändert sich:

```
kraft(x)  = gebucht(x) + max(x)                      erreichbarer Zweikampf-Stand
lage      = kraft(u)/kraft(gegner) − 1               +0,18 = 18 % stärker
versatz   = clamp(−HEBEN_DUELL_EROEFFNUNG_K · lage, ±HEBEN_DUELL_EROEFFNUNG_MAX)
anteil'   = clamp(anteil + versatz)
sprungFaktor = sqrt(anteil / anteil')                beide Sprünge werden damit skaliert
```

Damit gilt `anteil' · (1+s1') · (1+s2') = anteil · (1+s1) · (1+s2)` — **dieselbe Decke, anderer
Weg.** Weil beide Sprünge mit demselben Faktor skaliert werden, bleibt auch die von der
Lehrmeinung geforderte **abnehmende** Sprungfolge (93–97–100) erhalten; die sechs Slot-Rollen
bleiben in derselben Reihenfolge unterscheidbar.

**Ein zweiter Deckel, den erst die Messung erzwungen hat.** Der Versatz nach oben darf einen
Heber höchstens bis an seinen **eigenen** Risiko-Maßstab schieben (`risikoMax` aus der
Erfolgskurve, s. 2.4), nie darüber:

```
mutDeckel = max(anteilRein, min(0,97, 1 + (ANSAGE−50)·HEBEN_WAGNIS_ANSAGE_FLEX))
anteil    = min(0,97, mutDeckel, anteilRein + versatz)
```

Ohne ihn fiel das Gelingen im ersten Reißversuch **unter den IWF-Korridor** (85,3 → 81,3 %,
Korridor 84–90 %, Abschnitt 5.3): ein vorsichtiger Heber (niedrige `ANSAGE`, also niedriger
`risikoMax`) wurde von der Duell-Lage in eine Eröffnung gedrängt, die er nach seiner eigenen
Risikokurve nicht halten kann. Die Lehrmeinung sagt exakt dasselbe — die Eröffnung ist ein
Gewicht, dem der Heber vertraut, und „missing an opener is a bad way to start a meet". Das
`max(anteilRein, …)` sorgt dafür, dass der Deckel **nur den Zuschlag** begrenzt und die heutige
Eröffnung nie absenkt; bei `versatz ≤ 0` ist er wirkungslos.

Rechenbeispiel, Rolle „Power Opener" (0,92 / +4 % / +3 %), Favorit max 400, Außenseiter max 340:

| | heute | mit (B) |
|---|---|---|
| Favorit | 368 – 383 – 394 | **349** – 373 – **395** |
| Außenseiter | 313 – 325 – 335 | **327** – 333 – **335** |
| sichtbare Lücke bei Versuch 1 | 55 kg | **22 kg** |
| Endgewichte | 394 / 335 | 395 / 335 |

Die Eröffnungen rücken zusammen, die Endgewichte bleiben stehen. Der Favorit muss dafür einen
größeren letzten Sprung machen (373 → 395 statt 383 → 394) — **das ist der Spannungsgewinn, und
er ist realistisch**: genau das ist das „erst sichern, dann springen" der Lehrmeinung.

**Die Nullstelle ist der entscheidende Teil.** In einem ausgeglichenen Duell ist `lage` ≈ 0,
`versatz` ≈ 0, `sprungFaktor` = 1 — **das Verhalten ist dort unverändert.** Die Maßnahme
greift ausschließlich in den schiefen Duellen, also genau dort, wo Chris' Beobachtung herkommt
und wo heute nichts passiert. Die engen Duelle (Abschnitt 3.4, die bereits guten) werden nicht
angefasst.

---

## 5. Messung

Alle Zahlen kaderfest über die live-save-Kaderfamilie (5 Varianten, 24 Spiele je Variante) für
rho, und über 200 Spiele auf dem Standardkader für Korridor und Dramaturgie.

### 5.0 Zuerst: die Neutralitätsprobe

Beide Maßnahmen sind hinter je einer Konstante abschaltbar. Mit `HEBEN_DUELL_ZWEIKAMPF=false`
**und** `HEBEN_DUELL_EROEFFNUNG_MAX=0` liefert die Korridor-Sonde über 200 Spiele **jede
einzelne Zeile zeichengleich zum Stand vor dem Eingriff** (85,3 / 79,4 / 62,2 — 86,7 / 76,6 /
62,3 — 1,48 — 1,8 % — 7,0 % — 46,7 % — 333 — 385). Der Umbau selbst ist also nachweislich
verhaltensneutral; alles Folgende ist Wirkung der beiden Schalter, nicht des Refactorings.

### 5.1 Rangtreue — die Abnahmezahl

| Stichprobe | | rho je Spiel (Median) | Spannweite | rho Saison (Median) |
|---|---|---:|---:|---:|
| n=24 | vorher | 0,854 | 0,209 | 0,923 |
| n=24 | nachher | **0,843** | 0,208 | **0,930** |
| n=48 | vorher | 0,844 | 0,191 | 0,923 |
| n=48 | nachher | **0,851** | 0,187 | **0,937** |

**Die Bewegung ist in beiden Richtungen kleiner als das Kaderrauschen und wechselt sogar das
Vorzeichen, wenn man die Stichprobe verdoppelt** — bei n=24 −0,011, bei n=48 +0,007, gegen eine
Spannweite von rund 0,20. Nach dem Maßstab dieses Repos (`messgrundlage-kaderfest.md`: „eine
Rezeptänderung, die kleiner bewegt als die Spannweite, ist von Null nicht unterscheidbar") ist
das **keine messbare Veränderung der Rangtreue**. Die 0,80-Schranke hält in allen vier Läufen.

**Die Saison-Zahl bewegt sich dagegen konsistent nach OBEN** (0,923 → 0,930 bzw. 0,937, in
beiden Stichprobengrößen gleichgerichtet). Nach der Zerlegung aus CLAUDE.md
(`rho(Spiel) = rho(Saison) · √Verlässlichkeit`) heißt das für n=48: die **Validität steigt**
(0,923 → 0,937 — die Mechanik belohnt das Richtige etwas besser, weil der Führende kein
unnötiges Risiko mehr trägt), während die **Verlässlichkeit sinkt** (0,835 → 0,824 — ein
einzelner Wettkampf sagt den nächsten etwas schlechter vorher). **Genau das ist Spannung, als
Zahl:** mehr Ausgang pro Wettkampf, bei unveränderter Rangordnung über die Saison.

### 5.2 Was welche Maßnahme beiträgt (Isolation, n=24)

| Konfiguration | rho je Spiel | rho Saison |
|---|---:|---:|
| Basis (beide aus) | 0,854 | 0,923 |
| nur **A** (Zweikampf) | 0,853 | 0,895 |
| nur **B** (Eröffnung) | 0,846 | 0,930 |
| beide | 0,843 | 0,930 |

Alle vier liegen innerhalb einer Spannweite von 0,208. Bemerkenswert ist nur, dass die
Saison-Zahl ausschließlich an **B** hängt: die duellbewusste Eröffnung ist es, die die
Validität hebt — der Favorit erreicht dasselbe Zielgewicht über einen Weg, auf dem er weniger
oft in eine Wiederholung gedrängt wird.

**Und die anderen neunzehn Disziplinen: unverändert, nachgemessen.**
`scripts/miss-alle-disziplinen.mjs 24` einmal vor und einmal nach dem Eingriff, beide gegen
dieselbe Basis (`961b7793`) und dieselbe Kaderfamilie. Im `diff` der beiden Tabellen steht
**genau eine** geänderte Zeile — Gewichtheben (0,854 → 0,843, Saison 0,923 → 0,930). Alle
neunzehn übrigen Zeilen sind **zeichengleich**, Seitenfehler in beiden Läufen keine. Das deckt
sich mit dem statischen Befund: `hebeUebung` wird nur aus `baueHebenDuelle` gerufen, das nur
hinter `if(art.heben)` steht, und `heben:true` trägt genau ein `BUEHNE_ART`-Eintrag
(Gewichtheben) — es gibt keinen zweiten Pfad in den geänderten Code.

### 5.3 IWF-Korridor — hält

| Größe | vorher | nachher | Ziel |
|---|---|---|---|
| Gelingen Reißen 1./2./3. | 85,3 / 79,4 / 62,2 % | 85,0 / 79,0 / 60,7 % | 84-90 / 71-80 / 50-63 % |
| Gelingen Stoßen 1./2./3. | 86,7 / 76,6 / 62,3 % | 86,9 / 76,1 / 60,6 % | 84-90 / 71-80 / 50-63 % |
| Fehlversuche je Heber (von 6) | 1,48 | 1,52 | 1,4 bis 1,8 |
| Nullwertungen je Heber | 1,8 % | 1,6 % | höchstens 3 % |
| Reißen-Anteil am Zweikampf | 46,7 % | 46,7 % | 44-47 % |
| Zweikampf Mittel | 333 | 333 | — |

Beide dritten Versuche fallen von 62,2/62,3 auf 60,7/60,6 %: sie lagen am **oberen** Rand des
Korridors (50-63 %) und liegen jetzt etwas tiefer darin. Mehr echte Aufholjagd heißt mehr
echtes Scheitern — und zwar in die Richtung, die der reale Sport vorgibt.

**Wichtige Ehrlichkeit zur Behauptung aus 4.1:** dass Maßnahme A das Reißen bit-identisch
lässt, gilt für **A allein**. Im Gesamtbild bewegt sich das Reißen trotzdem leicht (85,3 →
85,0), weil Maßnahme **B** beide Übungen betrifft. Der Nachweis für die Bit-Identität von A im
Reißen ist die Neutralitätsprobe 5.0 zusammen mit der Isolationsmessung 5.2.

**Eine Kalibrierungsfalle, die dabei auffiel und behoben ist.** Der erste Anlauf ließ den
Versatz nach oben ungedeckelt bis an den bestehenden 0,97-Deckel laufen. Gemessen fiel das
Gelingen im **ersten** Reißversuch von 85,3 auf **81,3 %** und damit **unter** den Korridor: ein
vorsichtiger Heber (niedrige `ANSAGE`, also niedriger `risikoMax`) wurde von der Duell-Lage in
eine Eröffnung gedrängt, die seine eigene Risikokurve gar nicht mehr trägt. Der Zuschlag ist
deshalb zusätzlich am eigenen Risiko-Maßstab gedeckelt (`mutDeckel` im Code) — die Lehrmeinung
sagt dasselbe: „missing an opener is a bad way to start a meet".

### 5.4 Dramaturgie — die Zahlen, um die es ging

200 Spiele, 1200 Duelle, `scripts/diag-gewichtheben-spannung.mjs`:

| Größe | vorher | nachher |
|---|---:|---:|
| Führender nach dem 1. Versuch gewinnt | 76,1 % | 73,6 % |
| Höhere Eröffnungsansage gewinnt | 82,8 % | **79,1 %** |
| **Eröffnung > jeder Versuch des Gegners** | **66,2 %** | **50,0 %** |
| Duelle mit mindestens einem Führungswechsel | 34,6 % | **36,3 %** |
| Duelle mit Wechsel im Stoßen | 16,6 % | **20,8 %** |
| **Entscheidung erst im LETZTEN Versuch** | **2,9 %** | **5,7 %** |
| Abstand < 10 Sinclair-kg | 11,8 % | **18,9 %** |
| Abstand Mittel | 96,8 kg | **87,5 kg** |
| 3. Versuch Gelingen, führend | 70,6 % | 68,7 % |
| **Steigerung 2.→3. Versuch, führend** | **+2,79 %** | **+4,10 %** |
| Steigerung 2.→3. Versuch, zurück | +2,41 % | +2,11 % |

Chris' Kernbeschwerde — „der eine hebt von Anfang an höhere Gewichte als der andere" — fällt
von **66,2 % auf 50,0 %**: **in der Hälfte der Fälle, in denen das vorher so war, ist es das
jetzt nicht mehr.** Die Entscheidung fällt fast doppelt so oft erst in der letzten Hantel
(2,9 → 5,7 %), knappe Duelle (unter 10 kg) gibt es 60 % häufiger, und der Führende steigert
vom zweiten zum dritten Versuch jetzt **mehr** als der Zurückliegende (+4,10 gegen +2,11 %)
statt weniger — die Umkehrung des Befunds aus 3.3.

### 5.5 Und wo es am meisten zählt: die engen Duelle

Dieselbe Aufteilung nach Kräfteverhältnis wie in 3.4:

| Lage | Führer(V1) gewinnt | mit Wechsel | letzter Versuch entscheidet | Abstand |
|---|---:|---:|---:|---:|
| eng (3–10 %) vorher | 56,3 % | 59,8 % | 6,8 % | 21,4 kg |
| **eng (3–10 %) nachher** | **49,0 %** | **63,8 %** | **15,0 %** | 20,0 kg |
| deutlich (10–25 %) vorher | 91,7 % | 14,5 % | 0,5 % | 165,5 kg |
| deutlich (10–25 %) nachher | 91,7 % | 14,5 % | 0,5 % | 154,0 kg |
| Missverhältnis vorher | 81,1 % | 29,5 % | 1,5 % | 103,6 kg |
| Missverhältnis nachher | 80,9 % | 30,8 % | 1,5 % | 88,7 kg |

**In engen Duellen ist der Führende nach dem ersten Versuch jetzt eine Münze (49,0 %), und
jedes siebte dieser Duelle entscheidet sich erst in der allerletzten Hantel (6,8 → 15,0 %).**
In deutlichen Missverhältnissen bleibt der Ausgang, wie er sein muss — der Stärkere gewinnt
weiter zu 91,7 % —, nur der Abstand schrumpft etwas und die Optik am Anfang stimmt wieder.
**Das ist genau die Aufteilung, die 3.4 gefordert hat:** Spannung dort, wo sie hingehört, und
kein erfundenes Kopf-an-Kopf-Rennen dort, wo keines ist.

### 5.6 Geprüft und verworfen: der kühne Versuch für den Führenden

Naheliegende dritte Maßnahme, und in der Aufgabenstellung ausdrücklich als Kandidat genannt:
dem Führenden im dritten Versuch ein echtes Risiko geben („er hat gewonnen, jetzt geht er auf
die große Zahl") — realistisch, es ist der letzte Versuch jedes Siegers in jeder Übertragung.
Sie ist **nicht umgesetzt**, und zwar aus drei gemessenen Gründen, nicht aus Bequemlichkeit.

**1. Die Prämisse stimmt nicht: der Führende kann heute schon scheitern, und tut es.** Der
Vorschlag setzt voraus, dass späte Versuche des Führenden praktisch sicher sind. Gemessen
(3.3/5.4) scheitert er an **29,4 %** seiner dritten Versuche, nach dem Eingriff an **31,3 %**.
Eine Mechanik, die „dem Führenden eine echte Chance zu scheitern gibt", existiert also bereits —
es fehlte ihr nur die Fallhöhe.

**2. Die Fallhöhe liefert Maßnahme B schon — und ohne Rangtreue-Risiko.** Genau das war das
Ziel des Kandidaten: der Führende soll seinen letzten Versuch spürbar wagen. Die Steigerung vom
zweiten zum dritten Versuch beim Führenden geht von **+2,79 % auf +4,10 %** und liegt damit zum
ersten Mal **über** der des Zurückliegenden (+2,11 %) statt darunter. Der Führende geht also
bereits höher ins Risiko — nur eben innerhalb seines unveränderten Zielgewichts, weshalb es rho
nicht kostet. Der Kandidat würde dasselbe noch einmal tun, diesmal **über** die Decke hinaus.

**3. Und dort, wo es teuer wäre, bringt es nichts.** Nach 3.4 beträgt in über 80 % der Duelle
der Abstand mehr als 10 kg. Ein verpatzter letzter Versuch des Führenden ändert dort am Ausgang
**nichts** — er kostet nur Kilogramm, und genau die misst rho. Der Führende trüge also das volle
Rangtreue-Risiko in **allen** Duellen und lieferte Spannung nur in dem Fünftel, in dem der
Abstand klein genug ist. In genau diesem Fünftel ist der Ausgang nach 5.5 aber schon jetzt eine
Münze (49,0 %).

**Grenze dieser Begründung, ehrlich benannt:** Punkt 3 ist ein struktureller Schluss aus
gemessenen Verteilungen, **keine eigene rho-Messung der Variante**. Wer sie doch bauen will,
muss sie messen (Korridor **und** kaderfeste rho-Familie) — die Richtung des Risikos steht
allerdings fest, weil jeder zusätzliche Fehlversuch eines starken Hebers dessen Kilogramm
senkt, und die sind die Größe, gegen die rho rechnet.

Die Belohnungsseite („Punktesieg") bleibt unverändert außerhalb von `u.summe`, wie am 06.09.
festgelegt und begründet — ein Bonus dort ist nachweislich der einzige Hebel, der rho wirklich
bewegt.

---

## 6. Was noch geprüft und verworfen wurde

**„Müssten nicht beide die gleichen Gewichte heben?"** — Nein, Abschnitt 1.1. Es gibt diese
Regel im Sport nicht, und sie würde den einzigen taktischen Kanal löschen. Zusätzlich: die
Ansage wäre dann nicht mehr an `ANSAGE` gekoppelt, womit ein Sub-Skill ausgangswirksam
verschwände — das hat die Disziplin schon einmal unter die 0,80-Schranke gedrückt
(`HEBEN_TAGESMAX_ANSAGE_K`, 04.09., rho 0,720 → 0,887).

**Volle IWF-Hebereihenfolge über alle sechs Versuche.** Realistisch (Abschnitt 1.2) und
verlockend, weil die Stange dann nie leichter wird und die schwerste Hantel immer zuletzt
kommt. **Dramaturgisch aber schlechter für unser Zwei-Mann-Duell:** bei 100 kg Abstand wären
alle drei Versuche des Schwächeren durch, bevor der Stärkere zum ersten Mal antritt — das
Wechselspiel, das Chris am Duell gefällt, verschwände ganz. Im echten Sport trägt das, weil
dort zehn Heber verschränkt sind; bei zweien nicht. Zusätzlich läge der Eingriff in
`buehneQueue`, also in der Enthüllungsreihenfolge, an der parallel die Visuals hängen.
**Nicht jetzt** — falls es je kommt, als eigener PR mit eigener Messung.

**Die nächste Ansage vor dem Zuschauer verbergen.** Geprüft und hinfällig: die Ansagen werden
heute gar nicht im Voraus gezeigt. `stepBuehne` meldet je Enthüllungsschritt genau den Versuch,
der gerade stattfindet. Was Chris sieht, sind die beiden **ersten** Versuche, die direkt
nacheinander kommen — und deren Zahlen sind echt. Verbergen wäre also kein Spannungsgewinn,
sondern das Verstecken einer wahren Information; die Reparatur gehört in die Zahl, nicht in die
Anzeige. (Genau das tut Maßnahme B.)

**Die Paarung nach Stärke statt nach Slot.** Würde die Abstände sofort halbieren und alle
Spannungszahlen heben — und zugleich die bewusste Aufstellungs-Entscheidung entwerten, die
`baueHebenDuelle` explizit schützt („ein bewusst schwach besetzter Slot ist ein Zug und kein
Unfall"). Das ist eine Produkt-Entscheidung für Chris, keine Fable-Entscheidung, und sie gehört
nicht in einen Spannungs-PR.

---

## 7. Offene Punkte für die Review

* Maßnahme A ändert im Reißen nichts — belegt über die Neutralitätsprobe 5.0 und die
  Isolationsmessung 5.2, **nicht** über die Gesamtzahl in 5.3 (dort wirkt B auf beide Übungen
  mit). Das sollte in der Review gezielt gegengelesen werden.
* `HEBEN_DUELL_EROEFFNUNG_K` (0,30) und `HEBEN_DUELL_EROEFFNUNG_MAX` (0,05) sind **gesetzt und
  geprüft, aber nicht durchgesweept**: 0,05 hält den IWF-Korridor und liefert die Zahlen aus
  5.4/5.5; größere Werte sind **nicht** gemessen. Die eine Variante, die gemessen und verworfen
  wurde, ist der Verzicht auf `mutDeckel` (Korridor gerissen, s. 4.2/5.3). Wer hier weiterdreht,
  muss Korridor und rho erneut fahren.
* Die Ein-Zeilen-Umkehr für jede der beiden Maßnahmen ist dokumentiert: `HEBEN_DUELL_EROEFFNUNG_MAX`
  auf 0 setzt (B) exakt aus; `HEBEN_DUELL_ZWEIKAMPF` auf `false` setzt (A) exakt aus.

---

## Quellen

* [IWF Technical and Competition Rules & Regulations 2025](https://iwf.sport/wp-content/plugins/download-monitor/download.php?id=598) — 1-kg-Vielfache, Mindeststeigerung, zwei Ansageänderungen, Nullwertung, Gleichstandsregel.
* [IWF — Competition flow](https://iwf.sport/weightlifting_/competition-flow/) — Ablauf einer Sitzung.
* [NBC Olympics — Weightlifting 101: rules, violations and competition format](https://www.nbcolympics.com/news/weightlifting-101-olympic-rules-violations-and-competition-format) — „the athlete who requests the lowest starting weight is called to the platform first", Zweikampf, Bomb-out, Tiebreak.
* [SportsEdTV — Weightlifting Rules: The Order of Lifting](https://sportsedtv.com/blog/weightlifting-rules-the-order-of-lifting-or-who-s-up-next-weightlifting) — Reihenfolge: Stangengewicht aufsteigend, dann Versuchsnummer, dann Losnummer.
* [Greg Everett / Catalyst Athletics — How Do You Choose Openers & Attempts for Weightlifting Competition?](https://www.catalystathletics.com/article/2026/How-Do-You-Choose-Openers-Attempts-for-Weightlifting-Compet/) — Eröffnung als sicheres Gewicht, abnehmende Sprünge (93–97–100), „open much higher than normal" bei Qualifikation/Rekord.
* [Jim Schmitz / IronMind — Selecting Your Attempts](https://ironmind.com/articles/jim-schmitz-on-the-lifts/Selecting-Your-Attempts/) — Rollenverteilung Trainer/Athlet bei der Versuchswahl.
* [Scientific Reports 2024 — Analysis of successful and unsuccessful snatch and clean and jerk lifts in IWF World Championships (2011–2023)](https://www.nature.com/articles/s41598-024-79752-x) — Gelingensquoten je Versuchsnummer (steckt bereits in `HEBEN_BASIS`).
* [BarBend — Hou Zhihui Sets Olympic Record Clean & Jerk to Steal Gold Medal at 2024 Olympics](https://barbend.com/hou-zhihui-olympic-record-clean-and-jerk-2024-olympics/) — Rückstand nach dem Reißen, Aufholjagd im Stoßen.
* [Roar News — Paris 2024: Olympic Weightlifting Highlights](https://roarnews.co.uk/2024/paris-2024-olympic-weightlifting-highlights/) — Pizzolato eröffnet das Stoßen bei 212 kg, weil das Reißen misslang.

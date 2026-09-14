# Fechten: Punkte oder mehrere Runden statt einer durchlaufenden Formel — Konzept (14.09.)

Reine Recherche und Konzeptpapier, kein Code, kein Motor-Eingriff. Auslöser Chris, wörtlich (02.09.):
„beim fechten koennte es sinn machen ggf. auf punkte oder mehrere runden zu spielen damit sich das
etwas abhebt, weiss nicht wie das in echt funktioniert erarbeite hier schon mal das konzept". Er
kennt die reale Fechtstruktur ausdrücklich nicht — Teil 1 liefert sie mit Quellen, bevor irgendein
Vorschlag kommt. Ziel des Dokuments ist eine Entscheidungsgrundlage für Chris, keine fertige
Umsetzung.

**Kontext:** Fechten lief bis zum 03.09. auf der Arena (Fünf-gegen-fünf-Kampf-Chassis), wurde dann
auf das geteilte Bühnen-Duell-Chassis umgezogen (`docs/design/tennis-fechten-rollout-plan.md`,
`docs/design/tennis-fechten-buehne-umsetzung.md`) und besteht dort kaderfest mit rho je Spiel
0,670 (`CLAUDE.md`, Saisonzahl 0,874). Chris findet das funktional in Ordnung, will aber, dass sich
Fechten optisch/strukturell von den übrigen sechs Bühnen-Disziplinen (Gewichtheben, Showcase,
Eiskunstlauf, Breaking, Wettessen, Speed-Schach, I-Spy, Tennis) abhebt, die alle über denselben
generischen Durchgangs-Rechner laufen.

---

## 1) Wie ein echtes Gefecht strukturiert ist

### 1.1 Treffer, Zielzahl, Zeit

Ein Fechtgefecht wird auf Treffer ("Touches") gewertet, nicht auf eine kontinuierliche
Punkteformel. Die Zielzahl und das Zeitlimit hängen von der Wettkampfstufe ab:

| Format | Treffer-Ziel | Zeitrahmen | Quelle |
|---|---:|---|---|
| Poolgefecht (Vorrunde) | 5 Treffer | ein Durchgang, 3 Minuten | [USA Fencing, „Fencing 101: Basics of Competition"](https://www.usafencing.org/basics-of-competition) |
| Direktausscheidung (Florett/Degen) | 15 Treffer | drei Perioden à 3 Minuten, 1 Minute Pause dazwischen | [joinstriveon.com, „Fencing Bout Format and Scoring System Explained"](https://joinstriveon.com/blog/fencing-bout-format-explained); [NBC Olympics, „Fencing 101: Olympic Competition Format"](https://www.nbcolympics.com/news/fencing-101-olympic-competition-format) |
| Direktausscheidung (Säbel) | 15 Treffer | dieselben drei Perioden, ABER die erste Pause fällt nicht nach 3 Minuten, sondern sobald eine Seite 8 Treffer erreicht | [Antwort auf eigene Recherche, gestützt auf USA Fencing „Fencing 101"](https://www.usafencing.org/basics-of-competition); vgl. Wikipedia „Fencing at the 2008 Summer Olympics" |

**Unentschieden/Zeitablauf:** Steht es nach den drei Perioden (9 Minuten) unentschieden, entscheidet
ein Münzwurf eine „Priorität", danach folgt eine Minute Sudden-Death — der erste Treffer gewinnt,
fällt keiner, gewinnt die Seite mit der Priorität
([joinstriveon.com](https://joinstriveon.com/blog/fencing-bout-format-explained)). Ein echtes
Gefecht kennt also praktisch nie ein „echtes" Remis — genau wie Speed-Schach im Motor heute
(`wertungTabelle`-Spalte „Stand" kennt dort ausdrücklich ein „=", Fechten bräuchte das laut Vorbild
real nicht).

### 1.2 Die drei Waffenarten: Trefferzone und Vorfahrtsregel

| Waffe | Trefferzone | Wertung bei Gleichzeitigkeit | Quelle |
|---|---|---|---|
| Florett | nur Rumpf | **Vorfahrt/„Right of Way"**: der Kampfrichter entscheidet, wer die Aktion eröffnet hat — nur der bekommt den Punkt | [Wikipedia, „Priority (fencing)"](https://en.wikipedia.org/wiki/Priority_(fencing)); [Academy of Fencing Masters, „A Dummy's Guide to Right of Way"](https://academyoffencingmasters.com/blog/a-dummys-guide-to-right-of-way-or-priority-in-fencing/) |
| Säbel | Hüfte aufwärts inkl. Arme/Maske | dieselbe Vorfahrtsregel wie Florett | dieselben Quellen |
| Degen | ganzer Körper (größte Trefferfläche aller drei) | **keine Vorfahrt** — treffen beide innerhalb von rund 40 ms, zählt der Treffer für beide („Doppeltreffer") | [NBC Olympics, „Fencing 101: Rules and Scoring"](https://www.nbcolympics.com/news/fencing-101-rules-and-scoring) |

Konsequenz, die schon der frühere Chassis-Umzug gezogen hat: Degen ist die einzige der drei
Waffen, die **ohne** eine „Wer hatte zuerst die Aktion"-Zustandsmaschine auskommt — ein Treffer ist
ein Treffer, ein Doppeltreffer zählt für beide. Der Motor führt Fechten seit dem Umzug implizit als
Degen-Gefecht (`docs/design/tennis-fechten-rollout-plan.md` Abschnitt C.2/C.3, dort bereits mit
denselben Quellen belegt); dieses Dokument übernimmt das unverändert — eine Vorfahrtsregel
einzuführen wäre ein eigener, deutlich größerer Umbau (Abschnitt 5, offene Frage 5).

### 1.3 Was das für ein Motor-Konzept bedeutet

Drei Strukturmerkmale sind fürs Konzept unten wichtig: (a) **Treffer sind diskrete Ereignisse**,
kein kontinuierlicher Punktestrom; (b) es gibt eine **Zielzahl**, bei deren Erreichen das Gefecht
sofort endet; (c) es gibt **Perioden mit sichtbarem Zwischenstand und Pause**, unabhängig von der
Zielzahl. Ein Konzept kann sich an (b), an (c) oder an beidem orientieren — das ist exakt Chris'
„auf Punkte ODER mehrere Runden".

---

## 2) Ist-Zustand im Motor

`public/mockups/battle-mode.engine.js`, Stand `8aecd880` (14.09.). Alle Zeilenangaben gegen diesen
Stand.

### 2.1 `BUEHNE_ART.fechten` heute

```js
// Zeile 12238 ff.
fechten:{
  label:"Fechten", jeSeite:6, rundenN:10, rundenDauer:60/(10*6*2), duell:true, fechten:true,
  failAbzug:0.55, failWort:"kommt zu spät", erfolgWort:"setzt den Treffer",
  rezept:{
    GRUNDLAGE:    {torment:45,dexterity:30,awareness:25},
    SPITZENMOMENT:{dexterity:40,speed:35,torment:25},
    TECHNIK:      {torment:40,dexterity:35,awareness:25},
    NERVEN:       {determination:40,awareness:35,health:25},
    PUBLIKUM:     {intelligence:50,health:50},
    AUSDAUER:     {speed:40,power:35,health:25},
    WAGNIS:       {speed:45,torment:30,power:25}
  }
}
```

Zehn „Züge" je Fechter (`rundenN:10`), `rundenDauer:60/(10*6*2)≈0,5 s`, damit ein komplettes
Gefecht bei sechs Fechtern je Seite in rund 60 Sekunden durchläuft — dieselbe Zielvorgabe
(„die Runde immer so ungefähr 60 Sekunden") wie jede andere Bühnen-Disziplin (Kommentar Zeile 4991).
`fechten:true` ist seit dem Umzug **rein deskriptiv**: es ist als Weiche für eine künftige eigene
Bewegungsfunktion `stepFechten()` vorbereitet (Zeile 13174: `if(art.fechten &&
typeof stepFechten==="function"){ stepFechten(dt,art); return; }`), aber diese Funktion existiert
bis heute nicht — Fechten läuft deshalb visuell/dramaturgisch exakt wie Speed-Schach/I-Spy/Tennis
über den generischen `duell`-Zweig, nur ohne deren eigene Bühnenbilder (kein Schachbrett wie
`zeichneSchach()`).

### 2.2 Wie der generische Duell-Zweig heute rechnet (`bauBuehne()`, Zeile 12303 ff.)

Für jeden Teilnehmer werden **alle** `rundenN` Durchgänge sofort vorab durchgerechnet (Zeile
12376–12390), unabhängig vom Gegner:

```js
for(let ri=0;ri<art.rundenN;ri++){
  const ermued = 1 - Math.max(0,(60-L.AUSDAUER))*0.0035*(ri/Math.max(1,art.rundenN-1));
  const basis  = (20+L.GRUNDLAGE*0.7)*Math.max(0.4,ermued);
  const erfolg = Math.min(0.94, 0.15+L.TECHNIK*0.0055+L.NERVEN*0.0035);
  if(rr()<erfolg){ punkte = basis + L.SPITZENMOMENT*0.35*(0.4+L.WAGNIS*0.006); ereignis=art.erfolgWort; }
  else            { punkte = basis*art.failAbzug;                              ereignis=art.failWort; }
  punkte = Math.max(0, Math.round(punkte + L.PUBLIKUM*0.12));
  L.runden.push({punkte, ereignis});
}
```

Danach paart der Duell-Zweig (Zeile 12404 ff.) Fechter `i` gegen Gegner `i` und bildet einen
**laufenden Vorteil** — die Differenz der Punkte, Runde für Runde:

```js
// Zeile 12422-12429
let lauf=0; const verlauf=[];
for(let r=0;r<art.rundenN;r++){
  lauf += (a.runden[r]?a.runden[r].punkte:0) - (b.runden[r]?b.runden[r].punkte:0);
  verlauf.push(lauf);
}
a.vorteil=lauf; b.vorteil=-lauf;
a.verlauf=verlauf; b.verlauf=verlauf.map(v=>-v);
```

Der Sieger eines Bretts ergibt sich aus dem Vorzeichen von `verlauf[rundenN-1]` (WERTUNG_DUELL,
Spalte „Stand", Zeile 14795–14797: `+` Sieg, `−` Niederlage, `=` Remis). **Was jedoch tatsächlich in
die Rangtreue eingeht, ist nicht der Vorteil**, sondern die eigene, absolute Punktsumme:

```js
// Zeile 26655, MOTOREN["buehne"].wert() — gilt fuer ALLE acht Buehnen-Disziplinen, auch die drei Duelle
wert:()=>{const o={}; for(const u of TEILNEHMER)o[u.n]=u.summe; return o;}
```

Diese Entscheidung steht dokumentiert bei Zeile 26641–26654: „EIGENE PUNKTE, AUCH IM DUELL […] ein
Heber, der an einem starken Slot 380 kg hebt, hat 380 kg gehoben, auch wenn er verliert." Das ist
der zentrale Befund für Abschnitt 4 unten: **die Kernformel und die Rangtreue-Messung hängen
überhaupt nicht daran, wie das Duell erzählt oder wann es endet** — sie hängen nur daran, dass alle
`rundenN` Durchgänge tatsächlich durchgerechnet werden und in `u.summe` landen.

### 2.3 Was heute schon „Treffer" und „Fehlschlag" heißt

Jeder Durchgang ist bereits binär (`erfolg`-Wurf, `rr()<erfolg`) — ein Treffer (`erfolgWort:"setzt
den Treffer"`) oder ein Fehlschlag (`failWort:"kommt zu spät"`), nur dass ein Fehlschlag nicht null
Punkte bringt, sondern `basis*failAbzug` (0,55 × Basis) — anders als bei echtem Fechten, wo ein
nicht gesetzter Treffer schlicht keinen Punkt bringt. Diese binäre Struktur ist die Grundlage für
jedes „Zähl die Treffer statt der Punkte"-Konzept unten (Abschnitt 3, Option 2/3): die Ereignisse
sind bereits da, es fehlt nur eine zweite Zählgröße neben der Punktsumme.

---

## 3) Vorbild im selben Motor: Gewichthebens Mehr-Versuchs-Dramaturgie

Chris' Bild („mehrere Runden mit einer Gesamtwertung") ist im Motor bereits einmal gebaut worden —
für Gewichtheben, nicht als Konzept, sondern produktiv und gemessen. Zwei Bausteine sind als
Vorbild direkt übertragbar:

**a) `HEBEN_DUELL_ZWEIKAMPF` (Zeile 12718 ff.):** Gewichtheben besteht real aus zwei Übungen
(Reißen, Stoßen) mit je drei Versuchen — der Motor bildet das als zwei getrennte
`hebeUebung()`-Durchläufe ab, deren Ergebnis am Ende zum „Zweikampf" (`u.zweikampf =
besteReissen + besteStossen`) zusammengezählt wird. Genau diese Zusammenzählung ist das, was
`wert()` liest (`u.summe = u.zweikampf`) — die Kernformel je Versuch (`hebeUebung`, Erfolgskurve aus
LAST/TECHNIK/NERVEN/ANSAGE) blieb dabei unangetastet; verändert wurde nur, **welche Zwischenstände
zusammengezählt werden und wie sie erzählt werden** (getrennte Übungen mit eigenem Zwischenstand,
statt einer einzigen durchlaufenden Zahl).

**b) Die Duell-Reihenfolge-Korrektur** (`docs/design/gewichtheben-duell-reihenfolge-plan-06-09.md`,
umgesetzt): hier ging es ausdrücklich um die **Dramaturgie eines Mehr-Versuchs-Duells** — wer hebt
im entscheidenden dritten Versuch zuerst, wenn beide auf denselben Zwischenstand reagieren dürfen?
Die Lösung (IWF-Regel: leichtere Ansage zuerst, das letzte Wort hat, wer mehr wagt) hat **die
Erfolgsformel nicht angefasst** — nur die Reihenfolge, in der bereits berechnete Zwischenstände
enthüllt werden. Gemessen: rho blieb im Rahmen des Kaderrauschens (0,845 → 0,836, Spannweite 0,21),
der Spiegeltest wurde symmetrisch (125:613 → 349:326).

**Übertragbare Lehre für Fechten:** eine „Runden"-Dramaturgie mit eigenem Zwischenstand ist im
Motor bereits ein etabliertes, gemessenes Muster — sie erfordert **keine** neue Erfolgskurve,
sondern nur eine neue Gruppierung/Enthüllungsreihenfolge der ohnehin vorab berechneten Durchgänge.
Das ist genau der Hebel, den Abschnitt 4 unten für Fechten vorschlägt.

---

## 4) Drei Konzept-Optionen

Alle drei lassen `wert()` (Zeile 26655), `bauBuehne()`s Erfolgskurve (Zeile 12376–12390) und das
`rezept` von `BUEHNE_ART.fechten` (Zeile 12264–12272) unangetastet — es geht ausschließlich um die
Gruppierung, Enthüllung und Anzeige der ohnehin zehn (oder mehr) vorab berechneten Durchgänge.

### Option 1 — Perioden-Struktur („Gefecht in drei Runden")

Die vorhandenen Durchgänge werden in drei „Perioden" gruppiert (Analogie zu FIE-Perioden 1-2-3),
mit einer kurzen „Pause"-Anzeige und einem sichtbaren Periodenzwischenstand nach Periode 1 und 2 —
exakt das Muster aus Abschnitt 3a) (Gewichthebens Reißen/Stoßen-Zwischenstand), nur mit drei statt
zwei Etappen. Technisch: `rundenN` auf eine durch 3 teilbare Zahl ziehen (z. B. 9 oder 12, analog
zur bereits vollzogenen Rundenverdopplung bei Eiskunstlauf/Breaking, Zeile 11976–11993/12019–12028)
und im Ticker/HUD nach jeder `rundenN/3`-Gruppe einen „Periode X beendet: Y:Z"-Moment einblenden.
Keine neue Erfolgskurve, keine neue Zählgröße — reine Gruppierung dessen, was `verlauf[]` (Zeile
12425) schon Runde für Runde mitschreibt.

### Option 2 — Sichtbarer Trefferstand (abgeleitete Zählgröße)

Zusätzlich zur laufenden Vorteilsanzeige wird ein „Trefferstand" mitgezählt: ein neues, rein
additives Feld `u.treffer` (nach demselben Muster wie Gewichthebens `u.kuehneVersuche` — Zeile
12796–12800, dort ausdrücklich als Feld deklariert, das „NICHT in u.summe/u.zweikampf oder
MOTOREN[...].wert() einfließt … additiv fuer Ticker/Buehnenbild/Boxscore"), das bei jedem
`erfolgWort`-Durchgang um eins hochzählt. Das Scoreboard zeigt dann „7:5" wie ein echtes
Fecht-Display, unabhängig von der bestehenden `verlauf[]`-Punktdifferenz. **Ehrlich zu
kommunizieren:** Trefferzahl und Punktevorteil können auseinanderfallen (ein Fechter mit weniger,
aber wertvolleren Treffern führt im `verlauf[]`-Sinn, aber nicht im Trefferstand) — Sieger bleibt
weiterhin der `verlauf[rundenN-1]`-Vorzeichenträger, das Trefferdisplay ist Zierde, kein zweiter
Wertungsmaßstab.

### Option 3 — Echtes Zielpunktzahl-Ende (z. B. „erster bei 15 Treffern gewinnt")

Am nächsten an echtem Fechten: das Gefecht endet in der Erzählung, sobald eine Seite die Zielzahl
an Treffern (Option 2s Zählgröße) erreicht. Der kritische Unterschied zu Option 1/2: **wird dafür
tatsächlich früher aufgehört zu rechnen**, sinkt die Zahl der pro Spiel gewerteten Ereignisse — und
CLAUDE.md hat für Hockey den umgekehrten Fall bereits vermessen (mehr Ereignisse halfen dort kaum,
weil rho an der Validität hängt, nicht an der Ereigniszahl) — der Umkehrschluss ist nicht
automatisch symmetrisch, aber ein früher abgebrochenes Gefecht mit `rundenN=10` (bei ohnehin nur
~0,7-0,94 Erfolgswahrscheinlichkeit je Durchgang) trifft eine Zielzahl von 15 oft gar nicht
innerhalb der zehn Durchgänge, oder bricht nach z. B. sechs statt zehn ab — **ungemessen, wie stark
das die 0,670 kaderfeste Rangtreue bewegt.** Ein sauberer Weg, das Risiko zu vermeiden: die vollen
`rundenN` Durchgänge werden weiterhin **immer** vollständig durchgerechnet (für `wert()`
unverändert), nur die Enthüllung im Ticker/HUD stoppt an der Zielzahl und markiert das Gefecht als
„entschieden" — dieselbe Krücke, die auch Speed-Schachs „Matt"-Erkennung nutzt (ein Ergebnis, das
vorab feststeht, wird nur passend spät gezeigt). Das ist am nächsten an echtem Fechten, aber auch
am aufwendigsten und der einzige der drei Wege, der **vor einer Umsetzung eine echte
Rangtreue-Messung braucht** (wie jeder andere Chassis-/Rezept-Eingriff in diesem Repo).

### Bewertung im Überblick

| Option | (a) Nähe zu echtem Fechten | (b) Abhebung von anderen Bühnen-Disziplinen | (c) Aufwand/Risiko für die Rangtreue | (d) Kaderfest messbar |
|---|---|---|---|---|
| 1 — Perioden | mittel (Periodenstruktur ja, Zielzahl nein) | mittel (Eiskunstlauf/Breaking haben schon Rundenverdopplung, aber keine „Perioden mit Pause und Zwischenstand" — neues Muster) | **quasi keins** — reine Enthüllungs-/HUD-Gruppierung, `wert()`/`rezept`/Erfolgskurve unverändert, `rundenN`-Anpassung ist derselbe rho-neutrale Hebel wie bei Eiskunstlauf/Breaking (Zeile 11976 ff.) | ja, unverändert — dieselbe `disziplinProbe`, kein neuer Pfad |
| 2 — Trefferstand | hoch (echtes Scoreboard-Gefühl) | hoch (einziges Bühnen-Duell mit sichtbarer Trefferzahl statt reiner Punktzahl) | **keins** — rein additives Anzeigefeld nach dem `u.kuehneVersuche`-Muster, fließt nirgends in `wert()` | ja, unverändert |
| 3 — Zielpunktzahl-Ende | am höchsten (Treffer-Ziel + echtes Bout-Ende) | am höchsten (einzige Disziplin mit vorzeitigem, ergebnisabhängigem Ende) | **mittel bis hoch, ungemessen** — braucht eine eigene Messrunde wie jeder Chassis-Eingriff; Risiko liegt in der Diskrepanz zwischen erzählter und gerechneter Dauer, falls nicht sauber getrennt | nur nach einer eigenen Messrunde — noch offen |

Optionen 1 und 2 schließen sich nicht aus — sie lassen sich **kombinieren**, ohne dass sich der
Aufwand addiert: Perioden-Gruppierung fürs „mehrere Runden" (Chris' zweiter Vorschlag) plus
Trefferstand-Anzeige fürs „auf Punkte spielen" (sein erster Vorschlag), beide bei praktisch
identischem, bereits erprobtem Nullrisiko für die Rangtreue.

---

## 5) Empfehlung

**Optionen 1 + 2 kombiniert, Option 3 zurückgestellt.** Begründung:

- Chris' eigener Wunsch war ausdrücklich „auf Punkte **oder** mehrere Runden" — er hat selbst keine
  Präferenz geäußert und weiß nicht, wie die reale Struktur funktioniert. Die Kombination aus
  Perioden-Gruppierung (Runden-Wunsch) und Trefferstand-Anzeige (Punkte-Wunsch) bedient beide
  Lesarten, ohne dass eine Seite geopfert werden muss.
- Beide Bausteine sind im selben Motor bereits ein erprobtes, gemessenes Muster (Abschnitt 3):
  Gewichthebens Reißen/Stoßen-Zwischenstand für die Perioden-Idee, Gewichthebens additive
  Zähl-Felder (`u.kuehneVersuche`) für die Trefferstand-Idee. Es ist kein neuer Mechanismustyp,
  nur eine zweite Anwendung eines bestehenden.
- Die Kernformel (`wert()`, `rezept`, die Erfolgskurve in `bauBuehne()`) bleibt in beiden Fällen
  vollständig unangetastet — die kaderfeste 0,670-Zahl (rho je Spiel, CLAUDE.md) bewegt sich nach
  bestem Wissen **gar nicht**, weil an nichts gerührt wird, was `u.summe` beeinflusst. Eine
  Nachmessung mit `node scripts/miss-alle-disziplinen.mjs 24 fechten` sollte trotzdem Teil jeder
  Umsetzungsrunde sein, allein um das zu bestätigen (wie es jede andere reine
  Präsentationsänderung in diesem Repo auch immer tut, z. B. Breakings Face-off-Präsentation vom
  14.09., PR #913).
- Option 3 (echtes Zielpunktzahl-Ende) ist die sportlich treueste, aber die einzige mit echtem,
  ungemessenem Rangtreue-Risiko — und CLAUDE.mds durchgehender Grundsatz für dieses Projekt ist,
  Änderungen erst zu messen, dann einzubauen, nie umgekehrt. Sie gehört als mögliche **spätere**
  Ausbaustufe in eine eigene Runde mit eigener Messung, nicht in den ersten Schritt.

### Offene Fragen für Chris, vor einer Umsetzungsrunde

1. **Rundenzahl je Periode.** `rundenN` müsste von 10 auf eine durch 3 teilbare Zahl wechseln
   (z. B. 9 — leicht weniger Ereignisse — oder 12 — mehr, analog zu Eiskunstlauf). Soll die
   Gesamtdauer eines Fechten-Gefechts weiterhin bei ca. 60 Sekunden bleiben (wie jede andere
   Bühnen-Disziplin) oder darf es länger dauern, um dem realen Bild von drei Perioden näherzukommen?
2. **Zielzahl für den Trefferstand (Option 2).** Reale Zahlen sind 15 (Direktausscheidung) oder 5
   (Pool) — bei nur 9-12 Durchgängen je Fechter erreicht kaum jemand 15 „Treffer" im Sinne von
   erfolgreichen Durchgängen. Reicht ein reiner Zählstand ohne Zielzahl-Bezug („zeig einfach, wie
   viele Treffer bisher"), oder soll die Zielzahl an die tatsächliche Rundenzahl angepasst werden
   (z. B. 6 von maximal möglich 9-12)?
3. **Soll Option 3 (echtes vorzeitiges Ende) überhaupt verfolgt werden**, und wenn ja, in einer
   separaten, eigens gemessenen Runde? Falls ja: soll das Gefecht dann WIRKLICH früher aufhören zu
   rechnen (Risiko für die Rangtreue, aber eine kürzere tatsächliche Spieldauer) oder nur scheinbar
   (voll durchgerechnet, nur die Enthüllung stoppt früh — mehr Aufwand, aber kein Risiko)?
4. **Soll es ein hartes Zeitlimit geben wie in echt (3×3 Minuten)?** Der Motor kennt keine echte
   Uhr innerhalb eines Duells, nur `rundenDauer × rundenN` als Ticker-Tempo — ein „Zeitlimit" wäre
   hier zunächst nur ein Erzählrahmen (z. B. „Periode = 1 Minute" als Textrahmen um eine feste
   Rundengruppe), keine Uhr, die den Ablauf tatsächlich abbricht. Reicht diese Fiktion, oder soll
   perspektivisch eine echte Zeitmechanik dazukommen?
5. **Waffenart Degen bleibt bewusst gesetzt** (keine Vorfahrtsregel, s. Abschnitt 1.2) — soll das
   so bleiben, oder ist ein späterer Ausbau Richtung Florett/Säbel-Feeling (mit einer
   Vorfahrts-Zustandsmaschine) für Chris interessant? Das wäre ein deutlich größerer, separater
   Umbau und keine Voraussetzung für die hier vorgeschlagenen Optionen.
6. **Verhältnis zum „interaktiven Paar-Rechner"-Vorschlag aus der alten Rollout-Recherche**
   (`docs/design/tennis-fechten-rollout-plan.md` Abschnitt E.2 Phase 2, Vorbild `baueHebenDuelle`):
   dort ging es um ein interaktiveres Treffer-Modell (wer pariert, wer kontert), unabhängig von der
   hier diskutierten Punkte-/Runden-Frage. Beide Vorhaben ließen sich kombinieren (ein
   Paar-Rechner würde Option 2/3s Trefferzählung sogar natürlicher machen, weil er echte
   Treffer-Ereignisse statt einer Erfolgswahrscheinlichkeit je Seite produziert) — aber das ist
   eine eigene, größere Entscheidung, die dieses Dokument nicht vorwegnimmt.

---

## Anhang: Quellenliste

- [USA Fencing, „Fencing 101: Basics of Competition"](https://www.usafencing.org/basics-of-competition) — Poolgefecht (5 Treffer/3 Min.), allgemeine Struktur.
- [joinstriveon.com, „Fencing Bout Format and Scoring System Explained"](https://joinstriveon.com/blog/fencing-bout-format-explained) — Direktausscheidung (15 Treffer, drei Perioden à 3 Minuten, 1 Minute Pause), Tiebreak/Sudden-Death-Regel.
- [NBC Olympics, „Fencing 101: Olympic Competition Format"](https://www.nbcolympics.com/news/fencing-101-olympic-competition-format) — Wettkampfformat, Gefechtslänge.
- [NBC Olympics, „Fencing 101: Rules and Scoring"](https://www.nbcolympics.com/news/fencing-101-rules-and-scoring) — Doppeltreffer-Regel Degen (40-ms-Fenster).
- [Wikipedia, „Priority (fencing)"](https://en.wikipedia.org/wiki/Priority_(fencing)) — Vorfahrtsregel Florett/Säbel.
- [Academy of Fencing Masters, „A Dummy's Guide to Right of Way or Priority in Fencing"](https://academyoffencingmasters.com/blog/a-dummys-guide-to-right-of-way-or-priority-in-fencing/) — Vorfahrtsregel, verständlich erklärt.
- Säbel-Sonderregel (Pause bei 8 statt fester 3-Minuten-Periode): eigene Recherche, gestützt auf [USA Fencing, „Fencing 101: Basics of Competition"](https://www.usafencing.org/basics-of-competition) und Wikipedia-Artikel zu Olympia-Säbelwettbewerben (Sekundärbestätigung, FIE-Originaltext nicht direkt abgerufen — dieselbe Einschränkung, die `tennis-fechten-rollout-plan.md` bereits für das 40-ms-Fenster vermerkt).
- `docs/design/tennis-fechten-rollout-plan.md` — Chassis-Wechsel-Recherche (Abschnitt C.2/C.3: Waffenart-Entscheidung Degen; E.2: Phase-2-Idee interaktiver Paar-Rechner).
- `docs/design/tennis-fechten-buehne-umsetzung.md` — Umsetzungsbericht des Chassis-Wechsels, kaderfeste Vorher/Nachher-Zahlen.
- `docs/design/gewichtheben-duell-reihenfolge-plan-06-09.md` — Vorbild für Mehr-Versuchs-Dramaturgie ohne Formeländerung (IWF-Reihenfolge-Fix).
- `public/mockups/battle-mode.engine.js` — alle Zeilenangaben im Text, Stand `8aecd880` (14.09.2026).
- `CLAUDE.md` — Abnahmemaßstab (rho je Spiel > 0,80, angestrebt 0,85), Fechtens aktuelle Zahlen (0,670 je Spiel, 0,874 Saison).

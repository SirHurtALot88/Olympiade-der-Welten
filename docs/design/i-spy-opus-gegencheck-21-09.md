# I-Spy Schatzsuche — Opus-Gegencheck zu Chris' vier Nachträgen (21.09.)

Geprüft wird `docs/design/i-spy-schatzsuche-konzept-21-09.md` in der Fassung des offenen PR-Branches
`docs-i-spy-matrix-entscheidung-21-09` (PR #992) — **nicht** die ältere Fassung auf `main`, die
Chris' Matrix-Entscheidung noch nicht trägt. Alle Zeilennummern in `engine.js` meinen
`public/mockups/battle-mode.engine.js`, Stand `main` 21.09.

Dies ist eine Gegenprüfung, kein zweiter Entwurf. Wo eine von Chris' Ideen trägt, steht das mit
Beleg; wo sie nicht trägt, steht der Grund mit gemessener Zahl daneben.

---

## 0. Fazit vorweg

| # | Chris' Idee | Urteil | Was das Konzept braucht |
|---|---|---|---|
| 1 | Finden + Knacken hängen zusammen („ein Intelligenter findet schnell passende Clues und knackt sie") | **Hält stand** — mechanisch bereits vollständig abgedeckt (SPÜRSINN, F2, LOGIK). Eine **Wortlücke** bleibt: Chris sagt dreimal „schneller/dauert länger", das Konzept übersetzt das stillschweigend in „öfter". | Eine Klarstellung in 1.3 und eine kostenlose Antwort in 5.2 (Dauer der Phase `suchen`). Keine Mechanikänderung. |
| 2 | **Gate / versperrte Tür**, die die ganze Seite blockiert, bis jemand mit **Power** sie öffnet | **Als beschrieben verwerfen.** Drei unabhängige Gründe, jeder für sich hinreichend — der härteste ist gemessen: **power korreliert −0,539 mit der I-Spy-Eignung** auf genau dem Kader, an dem abgenommen wird. | Das **Bild** bleibt, die **Sperre** fällt: die Tür wird ein gewöhnlicher Mechanik-Fundort mit Tür-Grafik. Kosten: null. Präzedenzfall steht schon im Motor (Takeshis `tuer`). |
| 3 | Häufigkeit nach Matrixgewicht statt nach Drittel | **Hält stand, und deckt einen echten Fehler im Konzept auf.** Kein Widerspruch zu Chris' früherer Vorgabe — es ist dieselbe Regel von der anderen Seite gelesen. Aber: das Layout in 2.1 verteilt zwar die *Anzahl* zu Dritteln, die *Punktmasse* jedoch **22,6 / 38,7 / 38,7 %** — Logik, das schwerste Matrixattribut, bekommt die **geringste** Masse und **keinen** Tresor. | Neues `fundorte[]` (unten wörtlich), Positionen und Stufen unverändert, nur `art` neu vergeben. Pp-neutral, spiegelfest. „Deutlich höher" für Intelligenz ist von der Matrix **nicht** gedeckt (18 gegen 17). |
| 4 | Spirit-Starke als Helfer („kann ich helfen / ich hab da was") | **Zur Hälfte abgedeckt, zur Hälfte an der falschen Stelle.** TEAMGEIST steuert heute nur, **ob** eine Seite reagiert — **wer** hinläuft, entscheidet R-2 nach Knack-Sub-Skill. Der Spirit-Spieler kommt in Chris' Bild selbst an; im Konzept kommt er nie. | Keine neue Kooperationsmechanik — die gibt es schon und heißt **Fortschritt** (1.4, seitenneutral) plus **K-D**. Sie muss nur benannt und im Ticker sichtbar gemacht werden. Einen echten Helfer-Bonus **nicht** bauen; der Präzedenzfall dagegen liegt vor. |

**Die eine Zahl, die am meisten entscheidet.** Auf dem 17-Spieler-Testkader, den
`scripts/lib/rangtreue-messung.mjs` für jede kaderfeste Abnahme benutzt (`window.__arena.kader()`/
`.opp()`), liest die Korrelation jedes Attributs mit der I-Spy-Eignung
(`gewichtet(p.a, BASIS_JE_DISC["i-spy"])`, `engine.js:5167`) so:

| Attribut | r zur I-Spy-Eignung |
|---|---:|
| intelligence | **+0,650** |
| will | +0,627 |
| awareness | +0,490 |
| determination | +0,469 |
| dexterity | +0,408 |
| charisma | +0,365 |
| speed | +0,306 |
| spirit | +0,194 |
| torment | +0,038 |
| health | −0,479 |
| stamina | −0,315 |
| **power** | **−0,539** |

(n=17, also indikativ, nicht endgültig — aber −0,539 ist weit außerhalb dessen, was bei dieser
Stichprobe Rauschen sein kann, und es ist derselbe Kader, gegen den PR 1 abgenommen wird.)

Zwei Dinge fallen daraus:

- **Jeder Kanal, der power belohnt, belohnt in I-Spy systematisch die Falschen.** Das ist kein
  Argument über Geschmack, sondern über die Abnahme: `disziplinProbe()` korreliert `u.eig` gegen
  `wert()`, und `u.eig` enthält power mit Gewicht **null**.
- **Spirit trägt trotz Matrixgewicht 13 kaum Eignungssignal (r 0,194), torment fast keines
  (0,038).** Jeder Kanal, den man auf TEAMGEIST (spirit 55) legt, ist damit ein schwacher Kanal —
  genau die Diagnose, an der Takeshis `lesenBonus` gescheitert ist (TECHNIK r 0,60, 0,883 → 0,847,
  `engine.js:24209-24211`). Das begrenzt Idee 4 und ist unten ausgeführt.

---

## 1. Idee 1 — „Ein sehr intelligenter Spieler findet auch sehr schnell passende Clues und knackt sie"

### 1.1 Die Prüfung

Chris' Satz zerfällt in drei Behauptungen. Alle drei sind im Konzept bereits umgesetzt:

| Behauptung | Wo sie im Konzept steht | Trägt sie? |
|---|---|---|
| Intelligenz hilft beim **Finden** | SPÜRSINN = intelligence 45, torment 30, awareness 25 (1.2); `sieht(s=3)=min(0,90; 0,10+SPÜRSINN·0,008)` (1.3) | ja — bei SPÜRSINN 30/60/85 sieht er den Tresor in 34 / 58 / 78 % der Ticks |
| Intelligenz hilft beim **Einschätzen**, was sich lohnt | F2 „Erwartungswert": der Spieler wählt die Stufe mit dem höchsten `Punktwert·Knackchance` **für ihn** (1.3) | ja, und das ist der stärkere der beiden Kanäle |
| Intelligenz hilft beim **Knacken** | LOGIK = intelligence 50, will 30, determination 20 (1.2) | ja |

Damit sitzt intelligence in **zwei** der drei Phasen (SPÜREN und KNACKEN-Logik) und über F2 ein
drittes Mal indirekt. Das Konzept sagt das selbst: „es nutzt Intelligenz zweimal (sehen und
einschätzen), ohne einen zweiten Sub-Skill zu brauchen" (1.3). Die Rechnung in 1.4 zeigt den Effekt
in Zahlen: Erwartungswert am Tresor 4,8 bei Sub-Skill 30 gegen 38,4 bei 85 — Faktor acht.

Nachgerechnet und korrekt: `p = clamp(0,08; 0,95; 0,15 + K·0,011 − (s−1)·0,22)` liefert bei K=30
für Stufe 1/2/3 die Chancen 0,48 / 0,26 / 0,08 und bei K=85 0,95 / 0,86 / 0,645 — die Tabelle in
1.4 stimmt auf die zweite Stelle.

**Mechanisch fehlt nichts.** Chris beschreibt hier das, was das Konzept ohnehin baut.

### 1.2 Wo es trotzdem klemmt: „schnell" ist nicht „oft"

Chris sagt in dieser Nachricht „findet **sehr schnell**", in 1.6 „löst er es **schneller** oder
**braucht länger**" und im Nebenweg-Nachtrag „es **dauert einfach länger**". Dreimal dieselbe
Kategorie: **Zeit**. Das Konzept übersetzt das jedes Mal stillschweigend in **Häufigkeit** — eine
höhere Chance je Tick, nicht eine kürzere Dauer je Versuch.

Diese Übersetzung ist **richtig** und soll bleiben. Der Grund steht in `CLAUDE.md`: „Mehr Ereignisse
helfen fast nie … Wer die Rangtreue heben will, arbeitet an der Validität, nicht an der Uhr."
Eine Dauer-Mechanik (ein Spieler braucht zwei Ticks für eine Truhe) **senkt** die Ereigniszahl je
Kopf und damit die Verlässlichkeit — genau die Größe, die I-Spy mit 0,72 ohnehin fehlt (0.2 des
Konzepts). Sie wäre also ein Rückschritt, verkleidet als Realismus.

Aber sie muss **dastehen**, sonst erwartet Chris beim ersten Sichtlauf eine Zeitdifferenz, die es
nicht gibt — und hält das für einen Fehler. Und es gibt eine Antwort, die nichts kostet: die
**Phase `suchen` in 5.2** dauert heute pauschal 35–80 % des Zugs. Wenn diese Grenze aus dem
Sub-Skill gezogen wird (starker Knacker: Lupe kurz, dann Ergebnis; schwacher: Lupe fast bis zum
Ende), sieht man „er löst es schneller", ohne dass eine gemessene Zahl sich bewegt. Das ist reine
`viz*`-Arithmetik und fällt unter den bit-identischen Vertrag aus 5.

### 1.3 Empfehlung

- Mechanik unverändert übernehmen.
- **1.3 um einen Absatz ergänzen**, der die Übersetzung „schneller = öfter" ausspricht und mit der
  Hockey-Lehre begründet (Textvorschlag T1).
- **5.2 um eine Zeile ergänzen**: Phasengrenze `suchen`→`ergebnis` skaliert mit dem Sub-Skill, rein
  optisch (Textvorschlag T2).

---

## 2. Idee 2 — Das Gate: eine versperrte Tür, die die Seite blockiert

Das ist der wichtigste Prüfpunkt, und er fällt negativ aus — aber nicht aus dem Grund, den die
Fragestellung vermutet.

### 2.1 Zuerst die Entwarnung: es ist **nicht** vorab-unrechenbar

Die Frage lautete, ob eine Reihenfolgeabhängigkeit über Teilnehmer hinweg das Bühnen-Grundprinzip
„alles vorab rechnen, dann enthüllen" bricht und einen Live-Rechner wie Football erzwingt.
**Tut sie nicht.** Der in 3.4 skizzierte `baueSchatzsuche()` ist bereits eine Tick-Schleife über
**alle** Teilnehmer mit geteiltem, veränderlichem Truhenzustand:

```
für tick in 0..rundenN-1:
  für jeden Teilnehmer (Seiten verzahnt):
    … Truhe aktualisieren (leer / fortschritt+0,15) …
```

Eine Tür ist in dieser Schleife nichts anderes als eine dreizehnte Truhe mit dem Zusatz „solange
`tuer.offen===false`, überspringe für diese Seite die Fundorte hinter der Tür". Das ist ein
`if` in einer Schleife, die es ohnehin gibt. Football braucht seinen Live-Motor wegen Physik,
Formationen und Downs — nicht wegen Kopplung über Teilnehmer.

**Die Gate-Idee scheitert also nicht an der Machbarkeit.** Sie scheitert an drei anderen Stellen,
und jede einzelne würde reichen.

### 2.2 Grund 1 (der harte): power hat in I-Spy das Matrixgewicht null

`BASIS_JE_DISC["i-spy"]` (`engine.js:5167`) lautet vollständig:

```
intelligence 18, torment 17, spirit 13, will 12, charisma 9,
determination 8, speed 8, dexterity 8, awareness 5, health 2
```

Zehn Attribute, Summe 100, **power kommt nicht vor.** Das Konzept sagt das an einer Stelle bereits
(1.5, Chris' Entscheidungsabsatz) — aber es zieht die Konsequenz nicht, weil zum Zeitpunkt der
Formulierung noch kein power-Kanal auf dem Tisch lag. Jetzt liegt einer.

Technisch **kann** ein Sub-Skill power lesen: `bauBuehne()` bildet die Sub-Skills mit
`R2[k]=Math.round(mische({a:attr},R[k]))` (`engine.js:13451`), und `attr` trägt alle zwölf
Rohattribute jedes Spielers. Ein Rezept `TUER:{power:60,health:25,determination:15}` würde also
klaglos laufen. Genau das ist das Problem: es ist **Einfluss ohne Matrixpreis** — Fehlerklasse 9
des Handbuchs („ein Attribut dort kauft Einfluss ohne Matrixpreis", Battlefield 110 Pp,
`neue-disziplin-handbuch.md:475`). Die Pp-Abweichung, die 6.5 ohnehin bei 25–35 vermutet, bekäme
eine Komponente, die durch **keine** Rezeptkalibrierung wieder wegzubekommen ist, weil ihr in der
Matrix nichts gegenübersteht, was man dagegen rechnen könnte.

Und der Schaden ist nicht nur eine Messzahl. `u.eig` ist `gewichtet(p.a, BASIS_JE_DISC["i-spy"])`
(`engine.js:13465-13467`), enthält power mit null — während power mit **r = −0,539** gegen genau
diese Eignung läuft. Ein Tor, das power belohnt, belohnt bevorzugt die Spieler, die I-Spy am
wenigsten können. Das ist die direkteste denkbare rho-Senkung: ein Kanal, der dem Signal entgegen
gerichtet ist.

Hinzu kommt: **die Matrix ist zu.** Chris hat das am 21.09. selbst entschieden (Konzept 1.2 und
Frage 1: „die Matrix bleibt unangetastet"), und für Football gilt dieselbe Sperre seit Anfang
September (`docs/pm-briefings/pm-gesamtstand-07-09.md:452`: „von Chris gesperrt"). Der einzige Weg,
power legal in I-Spy einzubauen, wäre also eine Entscheidung, die Chris vor sechs Stunden in die
andere Richtung getroffen hat.

### 2.3 Grund 2: Blockieren ist „fremde Hand", nur schlimmer

Das Konzept führt in 6.2 als Regel 1: „Kein Kanal, in dem fremde Hand einen Zug vernichtet." Die
Zahl dahinter steht im Motor: Takeshis `tackleNerven` drückte die Saison-Validität von **0,937 auf
0,902**, „ein Ausscheiden durch fremde Hand misst nicht die eigene Eignung"
(`engine.js:24205-24208`; ausführlich `takeshi-chaos-tackle-plan-06-09.md:296`). Aus demselben
Grund ist im Konzept K-C („Duell am Fundort") bereits verworfen.

Ein Gate ist **dasselbe Problem in schwererer Form.** K-C kostet einen Spieler **einen** Zug, und
zwar durch die Hand eines **Gegners**. Ein Gate kostet **jedem Mitspieler der eigenen Seite jeden
Zug**, solange es zu ist — und zwar durch die Schwäche eines **Teamkollegen**. Der blockierte
Spieler hat nichts falsch gemacht und kann nichts dagegen tun; seine Punktzahl misst dann die
Attributverteilung seines Kaders, nicht seine Eignung.

Die Formulierung in der Fragestellung trifft es genau: ein Spieler nimmt durch Nichtstun allen
anderen ihre Züge weg. Regel 1 muss deshalb **geschärft** werden — sie sagt heute „vernichtet" und
meint auch „verhindert" (Textvorschlag T6).

Quantitativ: bei acht Ticks und zwölf Teilnehmern kostet eine Tür, die im Mittel zwei Ticks zu
bleibt, etwa 2 × 6 = 12 von 48 Zügen einer Seite — ein Viertel der Ereignisse. Die
Verlässlichkeit, für die das Konzept 0,78 anpeilt (6.2), fällt mit der Wurzel der Ereigniszahl;
ein Viertel weniger Züge ist grob −0,06 auf rho je Spiel, **bevor** der power-Effekt aus 2.2 dazu
kommt. Das Konzept rechnet heute mit 0,81 — rechnerisch knapp über der Schranke. Es gibt keinen
Spielraum für einen Kanal dieser Größe.

### 2.4 Grund 3: die Kopplung über Teilnehmer ist historisch teuer

Vorab rechenbar heißt nicht folgenlos. Der einzige bestehende Bühnen-Rechner mit Kopplung über
Teilnehmer ist `baueHebenDuelle()`, und er koppelt genau **zwei**. Was das gekostet hat, steht im
Motor daneben (`engine.js:13964-13971`): ein Heim/Gast-Bias im Spiegeltest, zwei getrennte
Reparaturen nötig, Zwischenstände **36:184** und **28:203**, erst danach 50:50. Und
`engine.js:13440-13446` dokumentiert denselben Fehlertyp ein zweites Mal für `bauBuehne()` selbst
(Showcase 36:84 vor der Korrektur).

Ein Gate koppelt nicht zwei, sondern **sechs** Teilnehmer je Seite — und es tut es asymmetrisch,
weil Heim links und Gast rechts startet (2.1). Jede Ungleichheit in der Türposition, in der
Reihenfolge der Verzahnung oder im `rr()`-Verbrauch schlägt direkt auf den Spiegeltest durch. Dazu
kommt Handbuch-Fehler 17: ein Gate erzeugt **bedingte** Würfe (wer hinter der Tür steht, würfelt
nicht), und bedingte `rr()`-Aufrufe verschieben die Zufallsfolge zwischen Basis- und Hebungslauf
von `einflussVon` — genau das Messartefakt, das ein 50-65-Pp-Plateau erzeugt hat
(`neue-disziplin-handbuch.md:483`). Man kann das mit Leerwürfen abfangen, aber es ist eine
Fehlerklasse, die PR 1 sonst gar nicht hätte.

### 2.5 Was stattdessen — und es ist billiger, als es klingt

**Chris' Bild ist gut und soll bleiben.** Was fallen muss, ist ausschließlich die *Sperre* und das
*power*.

Der Präzedenzfall liegt schon im Motor, und er passt Wort für Wort: **Takeshi's Castle hat eine
Tür.** `fallenBild:{… WUCHT:["tuer","seilwand"] …}` (`engine.js:24274`), und sie ist die schwerste
Kategorie: `fallenStufe:{… WUCHT:3 …}` (`:24275`). Die Takeshi-Matrix
(`engine.js:24157-24158`) enthält — wie die von I-Spy — **kein power**. Und das Rezept löst das so:

```
WUCHT: {charisma:38, determination:32, torment:30}
```

(`engine.js:24407`; Langname dazu: `WUCHT:"Durchbrettern"`, `:24411`). Das Bild ist rohe Gewalt,
die Mechanik ist matrixlegal. Genau dieselbe Trennung braucht I-Spy.

**Empfehlung — die Tür als nicht-sperrender Mechanik-Fundort.** Konkret:

- Zwei der Fundorte bekommen die Tür-Grafik: die beiden Mechanik-Akten in den unteren Ecken
  (`0.08/0.85` und `0.92/0.85` im Layout aus 3.4 unten) — eine je Seite, spiegelsymmetrisch, nahe
  der eigenen Startseite. Das erzählt „auf deinem Weg steht eine verschlossene Tür", ohne dass
  irgendein Weg tatsächlich versperrt ist.
- Der Primärweg ist **FINGERFERTIGKEIT** (dexterity 45, speed 35, torment 20 — alle drei in der
  Matrix, zusammen 33 von 100), im Ticker als „stemmt die Tür auf" / „bricht das Schloss" erzählt.
  Das ist die nächste matrixlegale Verwandte von „Power", die I-Spy hat, und sie korreliert mit
  r = +0,408 (dexterity) bzw. +0,306 (speed) **positiv** mit der Eignung.
- Damit ist Chris' Satz „dann braucht man erstmal jemanden im Team mit Power, um die zu öffnen"
  erfüllt: ein Team ohne guten Mechaniker lässt diese Truhen liegen und verliert ihre Punkte.
  Der Unterschied zum Gate ist, dass es **Punkte** kostet statt **Züge** — und Punkte zu verlieren,
  weil der eigene Kader eine Lücke hat, ist genau das, was die Rangtreue messen **soll**.

**Kosten: null.** Es ist eine Grafikvariante plus zwei Ticker-Wörter, beides ohnehin in PR 1 und
PR 3 enthalten (s. Abschnitt 6).

**Die stärkere Variante, falls Chris mehr will, ohne Sperre:** die Tür als Mehrwege-Truhe nach 1.6,
Primärweg FINGERFERTIGKEIT („aufbrechen"), Nebenweg MENSCHENKENNTNIS („er redet den Wächter weich")
— abgewertet nach Variante A oder B. Auch das liegt vollständig in der Maschinerie, die 1.6 ohnehin
baut. Kosten weiterhin praktisch null.

**Was ausdrücklich nicht empfohlen wird**, auch nicht als spätere Ausbaustufe:

- Eine Tür, die Fundorte für die ganze Seite sperrt (Grund 2 und 3).
- Ein Tür-Bonus für die eigene Seite („wer sie zuerst knackt, gibt seiner Seite +X"). Das ist die
  *sanfte* Gate-Variante aus der Fragestellung, und sie ist zwar harmlos für die Züge, aber
  trotzdem ein Kanal, in dem die Punktzahl eines Spielers von der Leistung eines anderen abhängt.
  Für die Rangtreue ist das dieselbe Verwässerung wie ein Team-Bonus bei Takeshi — dort mit
  demselben Argument zurückgestellt (`takeshi-animationen-hilfe-behinderung-recherche-06-09.md`,
  4.2: „ein Team-Bonus, der zu stark ausfällt, belohnt ‚am selben Fleck stehen' statt individuelle
  Eignung"). Die Truhe selbst ist schon der Bonus; sie braucht keinen zweiten.
- Jedes Rezept, das `power` liest, in welchem Sub-Skill auch immer.

### 2.6 Einordnung

**Kein MVP-Punkt, keine Ausbaustufe, sondern: die Idee ist als Bild übernommen und als Mechanik
verworfen.** Sie geht damit nicht in eine eigene PR, sondern in zwei Datenzeilen von PR 1 und ein
Zeichenprimitiv in PR 3 (s. Abschnitt 6).

---

## 3. Idee 3 — Häufigkeit nach Matrixgewicht statt nach Drittel

### 3.1 Ist das ein Widerspruch zu Chris' früherer Vorgabe? Nein.

Chris hat am selben Tag zwei Sätze gesagt, die sich zu widersprechen **scheinen**:

- früher: die Rätselarten sollen „gleichmäßig verteilt" sein, „dass es auf die Attribute passt" —
  kein Attribut soll die Disziplin dominieren („nicht so viele Power-Sachen").
- heute: Power „nicht so oft", Intelligenz-Truhen „deutlich höher, weil das der höchste Wert in
  I-Spy ist".

Das ist **eine Regel von zwei Seiten gelesen**, kein Widerspruch. Der erste Satz setzt eine
**Obergrenze** (nichts darf über sein Matrixgewicht hinausragen), der zweite eine **Reihenfolge**
(das schwerste Attribut soll am meisten vorkommen). Beide werden gleichzeitig erfüllt von genau
einer Regel: **proportional zur Matrix.** Das ist auch das, was das Projekt ohnehin als
Pflichtprüfung führt — die Budget-Methode, Pp ≤ 25 in zwei Stichproben
(`neue-disziplin-handbuch.md:503`, Schritt 7).

Die strikte Drittelung aus 1.5 („je Art ein Drittel der Fundorte") ist also **eine zu enge
Lesart** derselben Vorgabe. Sie ist nicht falsch gemeint, aber sie misst das Falsche: sie zählt
Fundorte, während das Budget Einfluss zählt.

Das Muster dafür steht wieder bei Takeshi: dort hat **jeder** der sieben Fallentypen genau zweimal
Platz in einem Kurs (`kurse[]`, `engine.js:24344-24349`) — gleichmäßig nach Anzahl —, aber die
**Schwierigkeit** unterscheidet sich (`fallenStufe:{TECHNIK:2,WENDIGKEIT:1,WUCHT:3,STEHEN:2,
ROBUST:3}`, `:24275`). Gleiche Anzahl, ungleiches Gewicht. I-Spy kann dasselbe tun — nur dass hier
die Stufe zugleich den **Punktwert** bestimmt, und Punktwert ist, was am Ende in `wert()` landet.

### 3.2 Die Rechnung: welcher Anteil steht welcher Rätselart zu?

Jede Rätselart zieht ihr Gewicht aus den Attributen ihres Sub-Skills (1.2). Ihr Matrix-Anspruch ist
die mit dem Sub-Skill-Anteil gewichtete Summe der Matrixgewichte:

| Rätselart | Sub-Skill (1.2) | Rechnung gegen `BASIS_JE_DISC["i-spy"]` | Matrixmasse | Anspruch |
|---|---|---|---:|---:|
| **Logik** | LOGIK: intelligence 50, will 30, determination 20 | 0,50·18 + 0,30·12 + 0,20·8 = 9,0 + 3,6 + 1,6 | **14,2** | **37,6 %** |
| **Verhör** | MENSCHENKENNTNIS: torment 50, charisma 30, spirit 20 | 0,50·17 + 0,30·9 + 0,20·13 = 8,5 + 2,7 + 2,6 | **13,8** | **36,5 %** |
| **Mechanik** | FINGERFERTIGKEIT: dexterity 45, speed 35, torment 20 | 0,45·8 + 0,35·8 + 0,20·17 = 3,6 + 2,8 + 3,4 | **9,8** | **25,9 %** |
| | | | 37,8 | 100 % |

**Das ist die entscheidende Zahl, und sie sagt etwas anderes als Chris.** Logik hat Anspruch auf
37,6 %, Verhör auf 36,5 % — **ein Prozentpunkt Unterschied.** „Deutlich höher" für Intelligenz ist
von der Matrix **nicht gedeckt**, weil intelligence 18 und torment 17 praktisch gleichauf liegen
und Verhör zusätzlich charisma 9 und spirit 13 mitbringt. I-Spy hat, wie 0.2 des Konzepts schon
sagt, „die breiteste Matrix aller zwanzig" — da gibt es kein dominantes Attribut, das man
dominieren lassen könnte.

Was Chris' Gefühl dagegen **bestätigt**: Mechanik (die „körperliche" Art, das, wofür er „Power"
sagt) hat Anspruch auf nur 25,9 % statt 33,3 % — also tatsächlich „nicht so oft".

### 3.3 Der Befund: das Layout in 2.1 ist nach Anzahl gedrittelt, nach Punktmasse aber schief

Das Layout aus 2.1 — vier Fundorte je Art, also Drittelung erfüllt — trägt diese Punktwerte
(Notiz 10, Akte 25, Tresor 60 nach 1.4):

| Art | Fundorte | Stufen | Punktmasse | Anteil | Anspruch (3.2) | Abweichung |
|---|---:|---|---:|---:|---:|---:|
| Logik | 4 | 1, 2, 2, 1 | 70 | **22,6 %** | 37,6 % | **−15,0 Pp** |
| Mechanik | 4 | 2, 1, **3**, 2 | 120 | **38,7 %** | 25,9 % | **+12,8 Pp** |
| Verhör | 4 | **3**, 1, 2, 2 | 120 | **38,7 %** | 36,5 % | +2,2 Pp |
| | 12 | | 310 | | | |

**Beide Tresore liegen auf Mechanik und Verhör; Logik hat keinen einzigen.** Das schwerste
Matrixattribut der Disziplin bekommt die kleinste Punktmasse — und die Art mit dem geringsten
Anspruch bekommt die größte. Das ist ein echter Fehler im bestehenden Dokument, unabhängig von
Chris' heutiger Nachricht, und er wäre in PR 1 erst über die Pp-Messung aufgefallen.

Er ist auch der Grund, warum Chris' Gefühl richtig ist, obwohl seine Begründung („höchster Wert")
zu stark ist: er hat gesehen, dass Intelligenz zu kurz kommt — nur nicht, wo.

### 3.4 Die Korrektur: Positionen und Stufen bleiben, `art` wird neu vergeben

Es gibt eine Nebenbedingung, die das Konzept selbst aufstellt und die die Lösung stark einschränkt:
**Spiegelsymmetrie** („Symmetrie ist Pflicht: `miss-arena-buehne-spiegel.mjs` muss Heim:Gast nahe
50:50 lesen", 2.1). Heim startet links, Gast rechts, und die Auswahlregel F2 bricht Gleichstände
über „die Nähe zur eigenen Position" (1.3). Eine Art, die links häufiger liegt als rechts, ist ein
Seitenvorteil.

Die zwölf Positionen aus 2.1 bilden fünf Spiegelpaare plus zwei Fundorte auf der Mittelachse:

| Block | Positionen | Stufen | Punkte |
|---|---|---|---:|
| F | `0.50/0.12` | 3 | 60 |
| G | `0.50/0.55` | 3 | 60 |
| A | `0.12/0.30` ↔ `0.88/0.30` | 1, 1 | 20 |
| B | `0.20/0.62` ↔ `0.80/0.62` | 1, 1 | 20 |
| C | `0.30/0.18` ↔ `0.70/0.18` | 2, 2 | 50 |
| D | `0.38/0.80` ↔ `0.62/0.80` | 2, 2 | 50 |
| E | `0.08/0.85` ↔ `0.92/0.85` | 2, 2 | 50 |

Weil eine Art nur ganze Blöcke bekommen kann (sonst bricht die Symmetrie), sind nicht alle
Zielwerte erreichbar. Die beiden besten Zuordnungen:

| Variante | Logik | Verhör | Mechanik | Anteile | max. Abw. | Fundorte je Art |
|---|---|---|---|---|---:|---|
| heute (2.1) | 70 | 120 | 120 | 22,6 / 38,7 / 38,7 | **15,0 Pp** | 4 / 4 / 4 |
| **P1 (empfohlen)** | F+C+A = 130 | G+D = 110 | E+B = 70 | 41,9 / 35,5 / 22,6 | **4,3 Pp** | 5 / 3 / 4 |
| P2 | F+C = 110 | G+D = 110 | E+A+B = 90 | 35,5 / 35,5 / 29,0 | 3,1 Pp | 3 / 3 / 6 |

P2 ist rechnerisch minimal näher am Anspruch (3,1 gegen 4,3 Pp), gibt aber **der Mechanik die Hälfte
aller Fundorte** — das liest sich gegen Chris' „nicht so oft" und gegen die Erzählung. Der Abstand
von 1,2 Pp liegt weit unter der Saatstamm-Streuung, die das Handbuch für die Pp-Messung nennt
(„unter ~17 Pp dominiert die Saatstamm-Streuung", `neue-disziplin-handbuch.md:261`). **Empfehlung
P1** — sie erfüllt Chris' Bild auf beiden sichtbaren Achsen (Logik hat die meisten Fundorte **und**
einen Tresor; Mechanik ist viermal da, aber nie entscheidend) und kostet dafür 1,2 Pp Papier.

Die Stufenverteilung aus 2.1 bleibt dabei **exakt erhalten**: 4× Notiz, 6× Akte, 2× Tresor. Nur das
Feld `art` ändert sich. Das Ergebnis steht wörtlich in T4 unten.

### 3.5 Erfüllt das die Budget-Methode besser — oder gefährdet es sie?

Ehrliche Antwort: **weder noch. Es ist auf der Attributebene Pp-neutral.** Die Rechnung, mit den
mechanischen Gewichten aus 6.5 (SPÜRSINN 25 %, Knack-Sub-Skills zusammen 45 %, NERVEN/TEAMGEIST/
AUSDAUER je 10 %), wobei die 45 % nach Punktmasse auf die drei Arten aufgeteilt werden:

| Attribut | Matrix | heute (2.1) | mit P1 | Abw. heute | Abw. P1 |
|---|---:|---:|---:|---:|---:|
| intelligence | 18 | 16,4 | 20,7 | −1,6 | **+2,7** |
| torment | 17 | 19,7 | 17,5 | **+2,7** | +0,5 |
| spirit | 13 | 12,5 | 12,2 | −0,5 | −0,8 |
| will | 12 | 10,6 | 13,2 | −1,4 | +1,2 |
| charisma | 9 | 7,7 | 7,3 | −1,3 | −1,7 |
| determination | 8 | 5,5 | 7,3 | −2,5 | −0,7 |
| speed | 8 | 8,6 | 6,1 | +0,6 | −1,9 |
| dexterity | 8 | 7,8 | 4,6 | −0,2 | **−3,4** |
| awareness | 5 | 8,3 | 8,3 | **+3,3** | **+3,3** |
| health | 2 | 3,0 | 3,0 | +1,0 | +1,0 |
| **max. Abweichung** | | | | **3,3 Pp** | **3,4 Pp** |
| **Summe der Beträge** | | | | 15,1 | 17,2 |

Beide Layouts liegen auf dem Papier **weit** innerhalb des Budgets (Pp ≤ 25). Die Umverteilung
verschiebt nur, **welches** Attribut leicht über- und welches leicht unterhängt: heute ist es
torment (+2,7), mit P1 ist es intelligence (+2,7) und dexterity (−3,4).

Zwei Dinge daraus, beide wichtig:

1. **Die Umverteilung ist nicht mit dem Budget zu begründen**, sondern mit Chris' Vorgabe und mit
   der Erzählung. Wer sie mit „das erfüllt Pp besser" verkauft, behauptet mehr, als die Rechnung
   hergibt. Das Konzept sollte das so schreiben.
2. **Der eigentliche Pp-Kandidat in beiden Layouts ist awareness (+3,3), und der hat nichts mit der
   Verteilung zu tun.** Er entsteht, weil SPÜRSINN mit 25 % mechanischem Gewicht zu 25 % aus
   awareness besteht — 6,25 Punkte Einfluss gegen Matrixgewicht 5. Wenn die erste Kalibrierrunde
   ein Pp-Problem findet, sitzt es mit hoher Wahrscheinlichkeit dort und nicht in der
   Truhenverteilung. Das gehört als Vorwarnung in 6.5.

Und: alles hier ist eine **Papierrechnung mit den geschätzten Gewichten aus 6.5.** Der Motor hat
Nichtlinearitäten (F2-Auswahl, Deckel bei 0,08/0,95, Fortschritt), die 6.5 selbst mit „Pp-Abweichung
nach dem ersten Bau geschätzt 25–35" veranschlagt. Die Papierrechnung sagt, wo man **anfangen**
soll, nicht wo man landet.

### 3.6 Eine Nebenwirkung, die das Konzept noch nicht behandelt

2.2 regelt kleine Kader mit „aktive Fundorte = `2·max(mine,gegner)+2`, die übrigen Positionen
bleiben leer gezeichnet". Sobald die Arten ungleich verteilt sind (P1: 5/3/4), entscheidet die
**Auswahl** der aktiven Fundorte über die Art-Anteile — bei 2 gegen 2 sind sechs von zwölf aktiv,
und je nachdem welche sechs, misst man ein völlig anderes Rezept als bei 6 gegen 6. Das ist keine
Kosmetik: `miss-alle-disziplinen.mjs` läuft über mehrere Kadergrößen, und die Abnahme in 7.2 nennt
„2–6 je Seite laufen" ausdrücklich.

Regel dafür (Vorschlag): **nur ganze Spiegelpaare plus die beiden Mittelachsen-Tresore aktivieren**,
und die Aktivierungsreihenfolge so wählen, dass die drei Art-Anteile um höchstens 5 Pp vom
Zwölfer-Layout abweichen. Für 2 gegen 2 leistet das die Menge `{F, G, A, E}` = die beiden Tresore,
das Notiz-Paar bei `y=0.30` und das Akten-Paar bei `y=0.85`: Logik 80, Verhör 60, Mechanik 50 →
**42,1 / 31,6 / 26,3 %** gegen 41,9 / 35,5 / 22,6 im vollen Layout. Für 4 gegen 4 (zehn Fundorte)
leistet es „alles außer Block A" → 37,9 / 37,9 / 24,1.

Das gehört als neue offene Frage in Abschnitt 8 (T8).

---

## 4. Idee 4 — Spirit als „Helfer"-Rolle

### 4.1 Was schon da ist

TEAMGEIST existiert (1.2: spirit 55, charisma 25, awareness 20) und steuert in 3.2 die
Reaktionswahrscheinlichkeit einer Seite: `0,30 + Ø TEAMGEIST(Seite)·0,006`. Das deckt Chris' Satz
„die schneller ankommen" **auf Seitenebene** ab: eine Seite mit viel Spirit sieht den fremden Fund
und handelt, eine ohne verpasst ihn.

### 4.2 Wo Chris' Bild und das Konzept auseinandergehen

Chris beschreibt eine **Person**: „die schneller ankommen und fragen, kann ich helfen, oder ich hab
da was". Im Konzept ist TEAMGEIST aber ein **Seitenmittel** — und **wer** dann losläuft, entscheidet
R-2 nach dem Knack-Sub-Skill der betroffenen Rätselart, also „der Bestgeeignete". Der
Spirit-starke Spieler löst die Reaktion mit aus, läuft aber selbst nie los, außer er ist zufällig
auch der beste Knacker. **Chris' Helfer kommt in der Mechanik nicht vor.**

Die naheliegende Reparatur wäre, TEAMGEIST in die Läuferwahl zu nehmen (etwa als Tiebreak oder als
zweiter Term). **Davon ist abzuraten**, und zwar mit der gemessenen Zahl aus Abschnitt 0: spirit
korreliert mit **r = 0,194** zur I-Spy-Eignung, charisma mit 0,365, awareness mit 0,490 — TEAMGEIST
ist also der **schwächste** Kanal, den das Konzept anbietet. Genau diese Diagnose hat bei Takeshi
`lesenBonus` gekostet: „TECHNIK korreliert nur 0,60 mit der Eignung; wer ihn auf vierzehn Fallen
legt, gewichtet ihn über die Matrix hinaus" — 0,883 → 0,847 (`engine.js:24209-24211`). Ein Kanal
mit r = 0,19 auf die wertvollste Entscheidung des Spiels (wer bearbeitet den angebrochenen Tresor)
wäre derselbe Fehler, eine Stufe schlimmer.

### 4.3 Die Kooperations-Mechanik existiert bereits — sie heißt nur nicht so

Die Fragestellung vermutet, eine Helfer-Mechanik („er macht die Truhe leichter, wenn er hilft")
fehle im Dokument. **Sie fehlt nicht — sie steht in 1.4 und in 3.3 und ist bereits seitenneutral
formuliert:**

> „ein Fehlschlag gibt keine Punkte, aber die Truhe bekommt `+0,15` Knackchance je Fehlversuch
> (Deckel +0,30) … Der nächste, der kommt — **egal welche Seite** — profitiert." (1.4)

> K-D „Wettlauf mit Fortschritt" … „die Geschichte ‚er räumt ab, was der andere angefangen hat'
> entsteht von selbst" (3.3)

Wenn der Nächste ein **Teamkollege** ist, ist das exakt Chris' „ich hab da was" / „kann ich
helfen": einer arbeitet vor, der andere macht es fertig, und die Punkte gehen an den, der es
aufbekommt. Die Mechanik ist gebaut; was fehlt, ist die **Benennung**. Heute erzählt 4. den
Fortschritt nur aus der Gegnerperspektive („Vorrak scheitert am Zahlenschloss — das Schloss ist
angebrochen (+15 % für den Nächsten)"). Zwei zusätzliche Ticker-Zeilen für den eigenen Fall
machen aus derselben Zahl Chris' Bild.

### 4.4 Empfehlung

- **Keinen eigenen Helfer-Bonus bauen.** Der Präzedenzfall liegt vor und ist unmissverständlich:
  `takeshi-animationen-hilfe-behinderung-recherche-06-09.md` 4.2 hat genau diese Kandidaten
  (Sturz-Hilfe, Gedränge-Rabatt) **nicht** empfohlen, weil sie „eher Kaderzusammensetzung … als die
  Eignung" messen, und hat für jeden eine eigene Messreihe vor jedem Einbau verlangt. In I-Spy käme
  hinzu, dass der Träger des Kanals (spirit, r 0,19) der schwächste verfügbare wäre.
- **Den Fortschritt als Kooperation benennen** (Ticker + Bühnenbild), Textvorschlag T7. Kosten:
  zwei Feed-Zeilen, kein `rr()`, keine Formel.
- **TEAMGEIST bleibt, wo es ist** (Seiten-Reaktionswurf). Es ist dort gut aufgehoben, weil ein
  schwacher Kanal auf einem **Wurf über die ganze Seite** wenig Rangtreue kostet und viel
  Charakter bringt — anders als auf einer Einzelentscheidung.
- **Optional, rein optisch und ohne Messrisiko:** ein Spieler mit hohem TEAMGEIST bekommt in Phase
  `reagieren` (5.2) das Ausrufezeichen früher und die gestrichelte Linie länger sichtbar. Das ist
  „er kommt schneller an" im Bild, ohne eine Zahl zu berühren — derselbe Trick wie in T2.

---

## 5. Konkrete Textänderungen am Konzeptdokument

Alles unten bezieht sich auf `docs/design/i-spy-schatzsuche-konzept-21-09.md` **in der Fassung des
Branches `docs-i-spy-matrix-entscheidung-21-09`**.

---

### T1 — Abschnitt 1.3, neuer Absatz am Ende (nach „…danach die Nähe zur eigenen Position (deterministisch, kein `rr()`).")

**Einfügen:**

```markdown
**„Schneller" heißt hier „öfter", und das ist Absicht.** Chris sagt an mehreren Stellen
„findet schnell", „löst es schneller", „dauert länger" — also Zeit. Das Konzept übersetzt das
durchgehend in Häufigkeit: ein Starker braucht nicht weniger Ticks je Truhe, er bekommt in
jedem Tick eine höhere Chance. Der Grund ist die Hockey-Lehre aus `CLAUDE.md`: eine Mechanik,
in der ein Schwacher zwei Ticks für eine Truhe braucht, senkt dessen Ereigniszahl und damit die
Verlässlichkeit — genau die Größe, die I-Spy mit 0,72 ohnehin fehlt (0.2). „Schneller" wird
deshalb nicht mechanisch, sondern optisch beantwortet (5.2).
```

---

### T2 — Abschnitt 5.2, Tabelle, Zeile `suchen`

**Alt:**

```markdown
| `suchen` | 35–80 % | **Lupe über dem Kopf**, pulsierend; Spieler leicht gebeugt (Ausfallpose wie `u.lunge`) |
```

**Neu:**

```markdown
| `suchen` | 35–80 %, obere Grenze aus dem Sub-Skill (starker Knacker 35–60 %, schwacher 35–80 %) | **Lupe über dem Kopf**, pulsierend; Spieler leicht gebeugt (Ausfallpose wie `u.lunge`) — der Starke ist sichtbar früher fertig. Reine `viz*`-Arithmetik aus `L.LOGIK` o. ä., kein `rr()`, keine gemessene Zahl bewegt sich; das ist die optische Antwort auf Chris' „löst es schneller" (1.3) |
```

---

### T3 — Abschnitt 1.5, der Verteilungssatz

**Alt:**

```markdown
Verteilung im Raum: je Art ein Drittel der Fundorte, über alle Stufen. Damit hat ein Kader mit
einem Mechanik-Spezialisten und einem Logiker zwei Stars an verschiedenen Truhen — dieselbe
Spreizung, die Takeshi mit `fallenKoennen` gemessen gebracht hat (rho 0,861 → 0,883: „der Kanal
wird breiter, nicht lauter", `engine.js:24321-24325`).
```

**Neu:**

```markdown
Verteilung im Raum: **proportional zur Matrixmasse der Rätselart, nicht zu Dritteln** — und
gemessen wird die **Punktmasse**, nicht die Anzahl der Fundorte. Jede Art hat Anspruch auf den
Anteil, den ihre Sub-Skill-Attribute in `BASIS_JE_DISC["i-spy"]` zusammen wiegen:

| Art | Sub-Skill | Rechnung | Matrixmasse | Anspruch |
|---|---|---|---:|---:|
| Logik | intelligence 50, will 30, determination 20 | 0,50·18 + 0,30·12 + 0,20·8 | 14,2 | **37,6 %** |
| Verhör | torment 50, charisma 30, spirit 20 | 0,50·17 + 0,30·9 + 0,20·13 | 13,8 | **36,5 %** |
| Mechanik | dexterity 45, speed 35, torment 20 | 0,45·8 + 0,35·8 + 0,20·17 | 9,8 | **25,9 %** |

Zwei Dinge sind daran wichtiger, als sie aussehen. Erstens: **Logik und Verhör liegen einen
Prozentpunkt auseinander.** I-Spy hat die breiteste Matrix aller zwanzig (0.1); intelligence 18
und torment 17 sind praktisch gleichauf, und Verhör bringt charisma 9 und spirit 13 mit. Eine
„deutlich höhere" Menge Intelligenz-Truhen ist von der Matrix nicht gedeckt. Zweitens: **Mechanik
hat Anspruch auf nur ein Viertel statt ein Drittel** — das ist der messbare Kern von Chris'
„Power wird gebraucht, aber nicht so oft".

Das Muster dafür steht bei Takeshi: dort liegt jeder der sieben Fallentypen genau zweimal im Kurs
(`kurse[]`, `engine.js:24344-24349`) — gleich nach Anzahl —, aber `fallenStufe` gibt WUCHT und
ROBUST drei Sterne und WENDIGKEIT einen (`:24275`). Gleiche Anzahl, ungleiches Gewicht. Damit hat
ein Kader mit einem Mechanik-Spezialisten und einem Logiker weiter zwei Stars an verschiedenen
Truhen — dieselbe Spreizung, die Takeshi mit `fallenKoennen` gemessen gebracht hat (rho 0,861 →
0,883: „der Kanal wird breiter, nicht lauter", `engine.js:24321-24325`).

**Was diese Umverteilung NICHT ist: eine Pp-Verbesserung.** Auf der Attributebene
durchgerechnet (Gewichte aus 6.5) liegt die größte Abweichung mit dem korrigierten Layout bei
3,4 Pp (dexterity) gegen 3,3 Pp (awareness) im Drittel-Layout — beide weit innerhalb des Budgets
von 25. Die Umverteilung geschieht, weil Chris sie vorgegeben hat und weil sie die Disziplin
erzählt, nicht weil sie die Messzahl rettet.
```

---

### T4 — Abschnitt 1.5, Chris' Entscheidungsabsatz

**Alt:**

```markdown
**Chris' Entscheidung (21.09.), bestätigt Frage 2 und verschärft Regel 2 aus 6.2:** die
Rätselarten (und damit die Attribute, die sie brauchen) sollen gleichmäßig verteilt sein — keine
Disziplin, in der ein einzelnes Attribut (sein Beispiel: „Power-Sachen") übermäßig oft gebraucht
wird. Das Ein-Drittel-Layout oben erfüllt das für die Rätselart-SLOTS bereits; die eigentliche
Prüfung ist aber die **Attribut-Ebene** darunter (6.5): keine der drei Knack-Attributmischungen
darf am Ende so viel mechanisches Gewicht bekommen, dass ein Attribut deutlich über sein
Matrixgewicht hinausragt. Das ist exakt die Budget-Methode (Pp ≤ 25), die 6.5 ohnehin als Ziel
nennt — jetzt von Chris ausdrücklich für i-spy bestätigt, nicht nur Projektkonvention. Power selbst
taucht in `BASIS_JE_DISC["i-spy"]` heute gar nicht auf (die Matrix hat zehn Attribute, keines davon
power) — sein Beispiel ist also generisch gemeint: kein Attribut, das im Rezept vorkommt, soll die
Disziplin dominieren.
```

**Neu:**

```markdown
**Chris' Entscheidung (21.09.), in zwei Nachrichten und scheinbar gegenläufig — es ist eine
Regel.** Zuerst: die Rätselarten sollen „gleichmäßig verteilt" sein, „dass es auf die Attribute
passt", keine Disziplin mit übermäßig vielen „Power-Sachen". Dann, im Nachtrag: Power „nicht so
oft", Intelligenz-Truhen mehr, „weil das der höchste Wert in I-Spy ist". Der erste Satz setzt
eine **Obergrenze** (nichts über sein Matrixgewicht hinaus), der zweite eine **Reihenfolge** (das
Schwerste kommt am häufigsten vor). Beides zugleich erfüllt genau eine Regel: **proportional zur
Matrix** — und das ist die Budget-Methode (Pp ≤ 25, Handbuch Schritt 7), jetzt von Chris
ausdrücklich für i-spy bestätigt, nicht nur Projektkonvention.

**Power kann in I-Spy nicht vorkommen, und das ist keine Auslegungsfrage.**
`BASIS_JE_DISC["i-spy"]` (`engine.js:5167`) hat zehn Attribute, **keines davon power**. Jeder
Sub-Skill, der power liest, kauft Einfluss ohne Matrixpreis (Handbuch-Fehler 9,
`neue-disziplin-handbuch.md:475`) — und schlimmer: auf dem 17-Spieler-Testkader, gegen den
abgenommen wird, korreliert power mit **r = −0,539** gegen die I-Spy-Eignung
(`gewichtet(p.a, BASIS_JE_DISC["i-spy"])`). Ein power-Kanal belohnt hier systematisch die
Spieler, die die Disziplin am wenigsten können. Chris' Wort „Power" ist deshalb **immer** in die
matrixlegale Nachbarin zu übersetzen: **FINGERFERTIGKEIT** (dexterity 45, speed 35, torment 20 —
zusammen 33 von 100), im Ticker als Aufstemmen/Aufbrechen erzählt. Das ist genau das, was der
Motor bei Takeshi schon tut: die Falle heißt `tuer`, ist die schwerste Stufe, und ihr Sub-Skill
WUCHT liest `{charisma:38, determination:32, torment:30}` — kein power, weil die Takeshi-Matrix
auch keines hat (`engine.js:24274-24275`, `:24407`).
```

---

### T5 — Abschnitt 2.1, das Layout

**Alt:**

```markdown
fundorte:[ {x:0.12,y:0.30,art:"logik",   stufe:1}, {x:0.30,y:0.18,art:"mechanik",stufe:2},
           {x:0.50,y:0.12,art:"verhoer", stufe:3}, {x:0.70,y:0.18,art:"logik",   stufe:2},
           {x:0.88,y:0.30,art:"mechanik",stufe:1}, {x:0.20,y:0.62,art:"verhoer", stufe:1},
           {x:0.38,y:0.80,art:"logik",   stufe:2}, {x:0.50,y:0.55,art:"mechanik",stufe:3},
           {x:0.62,y:0.80,art:"verhoer", stufe:2}, {x:0.80,y:0.62,art:"logik",   stufe:1},
           {x:0.08,y:0.85,art:"mechanik",stufe:2}, {x:0.92,y:0.85,art:"verhoer", stufe:2} ]
```

**Neu:**

```markdown
fundorte:[ {x:0.12,y:0.30,art:"logik",   stufe:1}, {x:0.30,y:0.18,art:"logik",   stufe:2},
           {x:0.50,y:0.12,art:"logik",   stufe:3}, {x:0.70,y:0.18,art:"logik",   stufe:2},
           {x:0.88,y:0.30,art:"logik",   stufe:1}, {x:0.20,y:0.62,art:"mechanik",stufe:1},
           {x:0.38,y:0.80,art:"verhoer", stufe:2}, {x:0.50,y:0.55,art:"verhoer", stufe:3},
           {x:0.62,y:0.80,art:"verhoer", stufe:2}, {x:0.80,y:0.62,art:"mechanik",stufe:1},
           {x:0.08,y:0.85,art:"mechanik",stufe:2,bild:"tuer"},
           {x:0.92,y:0.85,art:"mechanik",stufe:2,bild:"tuer"} ]
```

---

### T6 — Abschnitt 2.1, der Absatz unter dem Layout

**Alt:**

```markdown
Zwölf Fundorte (Vorschlag): 4× Notiz, 6× Akte, 2× Tresor — die beiden Tresore in der Mitte,
für beide Seiten gleich weit, wie die Burg am Ende der Takeshi-Route. Heim startet links, Gast
rechts (Symmetrie ist Pflicht: `miss-arena-buehne-spiegel.mjs` muss Heim:Gast nahe 50:50 lesen,
s. `engine.js:13455-13462` für den Fehler, der genau das beim Feldspiel einmal gebrochen hat).
```

**Neu:**

```markdown
Zwölf Fundorte (Vorschlag): 4× Notiz, 6× Akte, 2× Tresor — die beiden Tresore auf der Mittelachse
(`x=0.50`), für beide Seiten gleich weit, wie die Burg am Ende der Takeshi-Route. Heim startet
links, Gast rechts (Symmetrie ist Pflicht: `miss-arena-buehne-spiegel.mjs` muss Heim:Gast nahe
50:50 lesen, s. `engine.js:13455-13462` für den Fehler, der genau das beim Feldspiel einmal
gebrochen hat).

**Die Arten sind nach Punktmasse verteilt, nicht nach Anzahl** (1.5). Weil die Symmetrie nur ganze
Spiegelpaare zulässt, sind nicht alle Zielwerte erreichbar; das Layout oben ist die beste
erreichbare Näherung:

| Art | Fundorte | Stufen | Punktmasse | Anteil | Anspruch (1.5) |
|---|---:|---|---:|---:|---:|
| Logik | 5 | 1, 2, **3**, 2, 1 | 130 | 41,9 % | 37,6 % |
| Verhör | 3 | 2, **3**, 2 | 110 | 35,5 % | 36,5 % |
| Mechanik | 4 | 1, 1, 2, 2 | 70 | 22,6 % | 25,9 % |
| | 12 | | 310 | | |

Die Vorgängerfassung drittelte die **Anzahl** (4/4/4) und traf die **Punktmasse** damit auf
22,6 / 38,7 / 38,7 % — beide Tresore lagen auf Mechanik und Verhör, Logik hatte keinen. Das
schwerste Matrixattribut der Disziplin hatte die kleinste Masse; die Abweichung betrug 15,0 Pp
statt jetzt 4,3.

**Die beiden Akten in den unteren Ecken tragen `bild:"tuer"`** — eine je Seite, nahe der eigenen
Startseite. Das ist Chris' „da ist eine Tür, die versperrt ist, und man braucht jemanden mit Power,
um sie zu öffnen" (21.09.), als Fundort statt als Sperre: wer keinen guten Mechaniker hat, lässt
die Tür liegen und verliert ihre Punkte — er verliert aber keinen Zug, und er blockiert niemanden.
Warum die sperrende Variante nicht gebaut wird, steht in 6.2 (Regel 1) und in 9. Der Primärweg
heißt im Ticker „stemmt die Tür auf" / „bricht das Schloss", die Mechanik ist FINGERFERTIGKEIT —
dieselbe Trennung von Bild und Rezept, die Takeshi mit `tuer` / `WUCHT:"Durchbrettern"` seit dem
06.09. fährt (`engine.js:24274`, `:24407`, `:24411`).
```

---

### T7 — Abschnitt 6.2, die zwei Regeln

**Alt:**

```markdown
**Zwei Regeln aus der Projektgeschichte, die das Konzept einhalten muss:**

1. Kein Kanal, in dem fremde Hand einen Zug vernichtet (K-C verworfen, Deckel auf den Läufer).
2. Kein Attribut in einer Erfolgschance über sein Matrixgewicht hinaus (Awareness-Frage).
```

**Neu:**

```markdown
**Drei Regeln aus der Projektgeschichte, die das Konzept einhalten muss:**

1. **Kein Kanal, in dem fremde Hand einen Zug vernichtet — oder verhindert.** K-C ist deshalb
   verworfen, der Läufer gedeckelt. Und deshalb gibt es **keine sperrende Tür**: ein Tor, das die
   Fundorte dahinter für die ganze Seite schließt, bis ein Mitspieler es öffnet, nimmt fünf
   Spielern ihre Züge durch die Schwäche eines sechsten. Das ist Takeshis `tackleNerven` (Saison
   0,937 → 0,902, `engine.js:24205-24208`) in schwererer Form: dort kostete es einen Zug durch
   Gegnerhand, hier kostet es alle Züge durch die eigene. Bei acht Ticks und einer Tür, die im
   Mittel zwei Ticks zu bleibt, sind das rund ein Viertel der Ereignisse einer Seite — grob −0,06
   auf rho je Spiel, bei einer Schätzung, die mit 0,81 ohnehin knapp über der Schranke liegt.
   Die Tür bleibt als **Bild** (2.1), nicht als Sperre.
2. Kein Attribut in einer Erfolgschance über sein Matrixgewicht hinaus.
3. **Kein Attribut in einer Erfolgschance, das in der Matrix gar nicht vorkommt.** Für I-Spy
   heißt das konkret: **power nie.** `BASIS_JE_DISC["i-spy"]` kennt es nicht (`engine.js:5167`),
   `u.eig` gewichtet es mit null (`:13465-13467`), und gemessen läuft es mit **r = −0,539** gegen
   die Eignung. Ein power-Kanal ist damit nicht bloß teuer, sondern dem Signal entgegengerichtet.
   Was wie Kraft aussehen soll, wird über FINGERFERTIGKEIT erzählt (1.5).
```

---

### T8 — Abschnitt 4, Zuschauer-Ticker (Kooperation benennen)

**Alt:**

```markdown
- **Zuschauer-Ticker** (`feed()`), Vorschlag: „Cassandra untersucht den Tresor im Salon (Logik,
  Stufe 3) — entschlüsselt ihn! +60" · „Draco (A-A) sieht den Jubel und eilt zum Salon." ·
  „Draco kommt zu spät — der Tresor ist leer; nimmt die Notiz daneben. +10" · „Vorrak scheitert
  am Zahlenschloss — das Schloss ist angebrochen (+15 % für den Nächsten)."
```

**Neu:**

```markdown
- **Zuschauer-Ticker** (`feed()`), Vorschlag: „Cassandra untersucht den Tresor im Salon (Logik,
  Stufe 3) — entschlüsselt ihn! +60" · „Draco (A-A) sieht den Jubel und eilt zum Salon." ·
  „Draco kommt zu spät — der Tresor ist leer; nimmt die Notiz daneben. +10" · „Vorrak scheitert
  am Zahlenschloss — das Schloss ist angebrochen (+15 % für den Nächsten)."
- **Der Fortschritt ist die Kooperationsmechanik** (Chris 21.09.: Spirit-Starke sind die, „die
  schneller ankommen und fragen, kann ich helfen, oder ich hab da was"). `+0,15` je Fehlversuch
  ist in 1.4 ausdrücklich **seitenneutral** — wenn der Nächste ein Teamkollege ist, ist das genau
  Chris' Bild: einer arbeitet vor, der andere macht es fertig. Es braucht dafür **keine** neue
  Formel und keinen Helfer-Bonus; es braucht zwei Ticker-Zeilen, die den eigenen Fall erzählen:
  „Xelara hat am Tresor vorgearbeitet — Ralazar übernimmt (+15 %)" · „Ralazar bekommt auf, was
  Xelara angebrochen hat. +60". Warum ein **echter** Helfer-Bonus (Truhe wird leichter, weil ein
  Mitspieler danebensteht) nicht gebaut wird, steht in 9.
```

---

### T9 — Abschnitt 8, offene Fragen (Frage 2 ersetzen, zwei neue anhängen)

**Alt (Frage 2):**

```markdown
2. ~~**Drei Rätselarten...**~~ **Teilweise von Chris entschieden (21.09.):** die Verteilung über
   Rätselarten/Attribute muss gleichmäßig sein, kein Attribut darf die Disziplin dominieren (s.
   Abschnitt 1.5). Offen bleibt nur noch die Anzahl selbst — drei (Logik/Mechanik/Verhör) ist das
   Minimum, bei dem zwei Stars an verschiedenen Truhen glänzen können; mehr als vier verdünnt jede
   Art auf drei Fundorte.
```

**Neu (Frage 2):**

```markdown
2. ~~**Drei Rätselarten...**~~ **Von Chris entschieden (21.09., zwei Nachrichten):** die Verteilung
   folgt der Matrixmasse, nicht der Anzahl — Mechanik ein Viertel, Logik und Verhör je gut ein
   Drittel (Abschnitt 1.5, Layout in 2.1). **Eine Rückmeldung an Chris gehört dazu:** „deutlich
   mehr Intelligenz-Truhen" deckt die Matrix nicht — intelligence 18 und torment 17 liegen einen
   Punkt auseinander, und Verhör bringt charisma 9 und spirit 13 mit. Das Layout gibt Logik
   trotzdem die meisten Fundorte (5) und einen Tresor; mehr wäre nicht mehr matrixproportional.
   Offen bleibt nur die **Anzahl der Arten** — drei ist das Minimum, bei dem zwei Stars an
   verschiedenen Truhen glänzen können; mehr als vier verdünnt jede Art auf drei Fundorte.
```

**Anhängen (neue Fragen 13 und 14):**

```markdown
13. **Die versperrte Tür (Chris 21.09.).** Das Konzept nimmt das Bild und lässt die Sperre weg:
    zwei Mechanik-Akten tragen `bild:"tuer"` (2.1), wer keinen Mechaniker hat, verliert Punkte
    statt Züge. Begründung in 6.2 Regel 1 und 3. **Rückfrage an Chris:** reicht ihm das Bild, oder
    besteht er auf der echten Sperre? Falls ja, ist das eine eigene PR mit eigener kaderfester
    Messreihe und einem ausdrücklichen Abbruchkriterium (rho unter dem PR-1-Wert ⇒ zurück) — und
    das „Power" darin müsste trotzdem FINGERFERTIGKEIT sein, weil power in der Matrix nicht
    vorkommt.
14. **Aktive Fundorte bei kleinen Kadern.** 2.2 aktiviert `2·max(mine,gegner)+2` Fundorte. Sobald
    die Arten ungleich verteilt sind (5/3/4), entscheidet die **Auswahl** der aktiven Fundorte
    über die Art-Anteile — bei 2 gegen 2 misst man sonst ein anderes Rezept als bei 6 gegen 6,
    obwohl die Abnahme beides verlangt (7.2). Vorschlag: nur ganze Spiegelpaare plus die beiden
    Mittelachsen-Tresore aktivieren, Reihenfolge so, dass die drei Anteile um höchstens 5 Pp vom
    Zwölfer-Layout abweichen. Für 2 gegen 2 leistet das die Menge {beide Tresore, Notiz-Paar bei
    y=0.30, Akten-Paar bei y=0.85} → 42,1 / 31,6 / 26,3 % gegen 41,9 / 35,5 / 22,6; für 4 gegen 4
    „alles außer dem Notiz-Paar bei y=0.30" → 37,9 / 37,9 / 24,1.
```

---

### T10 — Abschnitt 9, „Was dieses Konzept bewusst nicht tut"

**Anhängen:**

```markdown
- **Keine sperrende Tür und kein Gate.** Chris' Bild (21.09.) ist übernommen, seine Sperre nicht:
  ein Tor, das den Fortschritt einer ganzen Seite anhält, bis ein Mitspieler es öffnet, nimmt
  fünf Spielern ihre Züge durch die Schwäche eines sechsten (6.2 Regel 1). Vorab rechenbar wäre es
  — die Tick-Schleife in 3.4 koppelt ohnehin alle Teilnehmer —, nur eben nicht messbar gut: der
  einzige bestehende Bühnen-Rechner mit Kopplung koppelt **zwei** Teilnehmer
  (`baueHebenDuelle()`) und hat dafür zwei Spiegeltest-Reparaturen gebraucht (36:184 → 28:203 →
  50:50, `engine.js:13964-13971`).
- **Kein power in irgendeinem Sub-Skill.** Die Matrix kennt es nicht, und gemessen läuft es mit
  r = −0,539 gegen die Eignung (6.2 Regel 3).
- **Kein Helfer-Bonus.** Ein Mitspieler macht eine Truhe nicht dadurch leichter, dass er
  danebensteht. Die Kooperation, die Chris beschreibt, ist der seitenneutrale Fortschritt aus 1.4
  und wird im Ticker erzählt (4.), nicht als zweite Formel gebaut. Der Präzedenzfall gegen einen
  echten Team-Bonus liegt vor: `takeshi-animationen-hilfe-behinderung-recherche-06-09.md` 4.2
  („belohnt ‚am selben Fleck stehen' statt individuelle Eignung"), und in I-Spy käme hinzu, dass
  sein Träger spirit wäre — der mit r = 0,194 schwächste verfügbare Kanal.
```

---

### T11 — Abschnitt 6.5, Vorwarnung anhängen

**Anhängen (nach „…also zwei Kalibrierrunden vom Ziel ≤ 25 entfernt."):**

```markdown
**Wo das Pp-Problem mit hoher Wahrscheinlichkeit sitzt, wenn es eines gibt: bei awareness, nicht
bei der Truhenverteilung.** SPÜRSINN trägt geschätzt 25 % mechanisches Gewicht und besteht zu
25 % aus awareness — 6,25 Punkte Einfluss gegen Matrixgewicht 5. Auf dem Papier ist das mit
+3,3 Pp die größte Einzelabweichung, und sie ist **unabhängig** davon, wie die Fundorte auf die
Arten verteilt sind (die Rechnung in 1.5 liefert für Drittel- und Matrix-Layout dieselben 3,3).
Erste Schraube, falls die Messung Pp-Ärger zeigt: der awareness-Anteil in SPÜRSINN (25 → 15 %,
Rest auf intelligence), **nicht** das Layout.
```

---

## 6. Wenn Chris die echte Tür doch will: Einordnung in den Bauplan

Die empfohlene Fassung (Tür als Bild) kostet **nichts Zusätzliches**: `bild:"tuer"` ist eine
Datenzeile in `fundorte[]` (PR 1, ohnehin dort), zwei Ticker-Wörter (PR 1), und ein Primitiv in
`bodenSchatzsuche()` — ein Türblatt mit Schloss statt einer Truhe (PR 3, ohnehin dort). Keine PR
verschiebt sich, keine Abnahme kommt dazu.

Falls Chris auf der **sperrenden** Tür besteht, gehört sie an genau eine Stelle und nirgendwo
sonst:

**PR 2c — Sperrende Tür, optional, nach PR 2, mit Abbruchkriterium (≈ 2–3 Tage).**

- *Nicht* in PR 1. PR 1 ist die Zahl, an der alles hängt (7.2: „die einzige, die über Bestehen oder
  Scheitern entscheidet"); sie darf keine Mechanik tragen, die das Ergebnis mit einem zweiten,
  unbekannten Kanal vermischt.
- *Nicht* vor PR 2. Die Tür teilt sich mit der Reaktion (R-2/K-D) den Läufer-Deckel und die
  Reihenfolgelogik im Tick; beide zugleich einzuführen macht eine Regression nicht zuordenbar.
- **Inhalt:** ein Feld `tor:{x,y,art:"mechanik",stufe:3,sperrt:[Fundort-Indizes]}` je Seite,
  spiegelsymmetrisch; in der Tick-Schleife aus 3.4 ein `if` vor der F2-Auswahl, das gesperrte
  Fundorte aus der Kandidatenmenge nimmt; **Leerwürfe** für jeden übersprungenen Knackwurf, damit
  der `rr()`-Verbrauch je Tick fest bleibt (Handbuch Falle 17 — ohne das ist jede folgende
  Pp-Messung Artefakt).
- **Zusätzlicher Aufwand gegenüber der Bild-Variante:** ~1 Tag Implementierung plus ~1–1,5 Tage
  Messung, weil zwei Abnahmen dazukommen, die es sonst nicht gäbe: (a) der volle Spiegeltest
  `miss-arena-buehne-spiegel.mjs` in **beiden** Türpositionen, weil die Tür die einzige Mechanik
  wäre, die Heim und Gast räumlich ungleich trifft; (b) `messe-arena-einfluss.mjs i-spy 48` in
  zwei Saatstämmen vor und nach der Tür, weil bedingte Würfe die Pp-Messung verschieben.
- **Abbruchkriterium, vorher festgeschrieben:** liegt rho je Spiel (kaderfest,
  `miss-alle-disziplinen.mjs 24 i-spy`) nach PR 2c unter dem Wert aus PR 2, **oder** fällt der
  Spiegeltest aus 45:55…55:45 heraus, wird der Zweig verworfen und die Bild-Variante bleibt. Das
  ist dasselbe Muster wie Takeshis „BEWUSST NICHT GESETZT, weil gemessen schädlich"
  (`engine.js:24202-24215`) — die verworfene Variante bleibt als Zahl im Rezeptkommentar stehen.
- **Was auch in PR 2c nicht geht:** power im Rezept der Tür. Das ist unabhängig von der
  Messung und folgt allein aus der Matrix (6.2 Regel 3).

---

## Quellen (gelesen, nicht vermutet)

- `public/mockups/battle-mode.engine.js`: `BASIS_JE_DISC` `:5148-5167` (I-Spy `:5167`, Takeshi
  `:5160`); `bauBuehne()`/`setz()` `:13444-13470`, Sub-Skill-Bildung `mische()` `:13451`,
  `eig`-Zeile `:13465-13467`, Spiegeltest-Kommentar `:13435-13446`; `baueHebenDuelle()`
  `:13930-13985`, Spiegeltest-Historie `:13964-13971`; Takeshi `hindernisTypen`/`fallenBild`/
  `fallenStufe` `:24273-24275`, `tackleNerven`/`lesenBonus` verworfen `:24202-24215`,
  `fallenKoennen`-Begründung `:24290-24306`, `kurse[]` `:24344-24349`, Takeshi-Rezept
  `WUCHT:{charisma:38,determination:32,torment:30}` `:24407` und `WUCHT:"Durchbrettern"` `:24411`.
- `docs/design/i-spy-schatzsuche-konzept-21-09.md`, Fassung `origin/docs-i-spy-matrix-entscheidung-21-09`
  (Abschnitte 0.1, 0.2, 1.2–1.6, 2.1–2.3, 3.2–3.4, 4, 5.2, 6.2, 6.5, 7.2, 8, 9).
- `docs/design/neue-disziplin-handbuch.md`: Budget-Methode/Pp ≤ 25 `:503`, Pp-Streuung `:261`,
  Fehler 9 („Einfluss ohne Matrixpreis") `:475`, Fehler 16 (Pp nicht monoton) `:482`,
  Fehler 17 (bedingte `rr()`) `:483`.
- `docs/design/takeshi-chaos-tackle-plan-06-09.md:296` (tackleNerven 0,937 → 0,902).
- `docs/design/takeshi-animationen-hilfe-behinderung-recherche-06-09.md` 4.2/4.3 (Team-Hilfe,
  Kandidaten A/B, Fallback ohne Wertung).
- `docs/pm-briefings/pm-gesamtstand-07-09.md:452` (Football-Matrix von Chris gesperrt).
- `scripts/lib/rangtreue-messung.mjs` (17-Spieler-Testkader, `window.__arena.kader()`/`.opp()`),
  `scripts/messe-arena-einfluss.mjs`, `scripts/miss-alle-disziplinen.mjs`,
  `scripts/miss-arena-buehne-spiegel.mjs`.
- `CLAUDE.md` (rho je Einzelspiel > 0,80; „mehr Ereignisse helfen fast nie").
- Korrelationstabelle in Abschnitt 0: eigene Rechnung über die 17 Kadereinträge aus
  `battle-mode.engine.js` (SQUAD/OPP, `:4492-4516`) gegen
  `gewichtet(p.a, BASIS_JE_DISC["i-spy"])`. n=17, indikativ.

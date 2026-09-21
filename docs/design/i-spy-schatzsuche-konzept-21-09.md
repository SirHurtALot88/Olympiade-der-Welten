# I-Spy als Schatzsuche nach Informationen — Konzept (Fable, 21.09.)

Chris (Sprachnachricht, 21.09.): „Ich hatte mir vorgestellt, dass I-Spy so eine Schatzsuche ist,
nur dass man nach Informationen sucht. Es gibt verschiedene Orte, wo Spieler hingehen und
Kisten/Assets durchsuchen. In den Assets sind verschiedene Clues versteckt — manche bringen mehr
Punkte, manche weniger, manches ist härter zu knacken, manches leichter. Da ist auch ein bisschen
Luck mit im Spiel. Ein guter Spieler kann schneller analysieren und checken, wo die stärkeren
Truhen/Hinweise versteckt sind (hohe Awareness), UND braucht auch die Intelligenz und andere
Attribute, um das Rätsel dann zu LÖSEN (nicht nur zu FINDEN). Zusätzlich: andere Spieler vom
gegnerischen Team können sehen, wenn ein Spieler einen krassen Fund macht (kein Pokerface, er
freut sich sichtbar) — und reagieren darauf: das gegnerische Team schickt seinen besten Spieler
dahin, um es auch zu versuchen zu knacken, oder um aufzuholen. Wie in Takeshi's Castle verschiedene
Assets/Fallen an festen Positionen in einer Arena, an denen Spieler hingehen und ein Lupenzeichen
über ihnen erscheint (Escape-Room-Stil), während sie das Asset untersuchen."

Dieses Dokument ist reines Konzept — kein Produktionscode, keine Motoränderung. Alle Zahlen sind
**Vorschläge** und als solche markiert; was gemessen ist, steht mit Datei und Zeile daneben.
`engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main`, 21.09.).

## Kurzfassung

- **I-Spy ist heute ein Speed-Schach mit anderen Zahlen.** `BUEHNE_ART["i-spy"]` trägt
  `duell:true` (`engine.js:13194`), sechs Durchgänge, die generische Bühnen-Punkteformel, keinen
  eigenen Zweig in `zeichneBuehne()`/`buehnenBewegung()`, keine Requisite, keinen Ton. rho je Spiel
  **0,684** (Spannweite 0,353), Saison 0,804 (Spannweite 0,608) — durchgefallen, als einzige
  Bühne (`data/generated/rangtreue-basislinie.json:119`). Der Anschluss an die Arena ist bewusst
  unterlassen und mit einem eigenen roten Test festgehalten
  (`tests/battle-mode-arena-team-points.test.ts:159`).
- **Chris' Konzept dockt an drei bestehende Muster an, die genau dafür gebaut wurden:** die
  Fallen-Typen mit Sterne-Stufen aus Takeshi's Castle (`hindernisTypen`/`fallenStufe`/
  `burgpunkte()`), den paarweise abhängigen Baurechner aus Gewichtheben (`baueHebenDuelle()`,
  das einzige Bühnen-Vorbild für „Ergebnis hängt vom Gegner ab") und die Zielansage der Arena
  (`KFOKUS`, ein Zuschauer-Eingriff als Bias mit Sperre, ohne Messrisiko). Die sechs I-Spy-Slots
  (Observer, Pattern Lock, Social Read, Logic Chain, Quiet Move, Reveal, `engine.js:5316-5323`)
  beschreiben bereits die Rätselarten, die das Konzept braucht — sie müssen nur mechanisch werden.
- **Es ist echter Neubau, kein Zweig.** Anders als Showcase (rein präsentatorisch, vier PRs,
  rho-neutral) ändert dieses Konzept die **Mechanik**: I-Spy bekommt eine eigene Erfolgsformel
  (wie Gewichtheben) mit einem Tick-für-Tick-Rechner über beide Seiten, weil die Reaktion des
  Gegners im Tick t+1 vom Fund im Tick t abhängt. Die Bühnen-Grundregel „alles vorab rechnen,
  dann enthüllen" bleibt trotzdem erhalten — nur die Vorab-Rechnung läuft über Ticks statt je
  Teilnehmer. Deshalb bleibt die kaderfeste Messung (`miss-alle-disziplinen.mjs`) ohne Anpassung
  anwendbar.
- **Gegen die 0,80-Schranke ist das Konzept besser aufgestellt als das heutige I-Spy**, aus zwei
  Gründen: mehr wertende Ereignisse je Kopf (acht Ticks mit je einer gestuften Finden- und einer
  Knacken-Entscheidung statt sechs Bernoulli-Würfe mit festem Auszahlungsbetrag) und Kanäle, die
  mit der Eignung laufen (der Star wählt schwerere Truhen UND wird zu fremden Funden geschickt —
  dieselbe Logik, mit der Takeshis Chaos-Kanäle rho gehoben statt gedrückt haben). Ein Risiko
  bleibt und ist benannt: kein Kanal darf einem Spieler durch fremde Hand einen Zug nehmen.
- **Aufwand: zwischen Showcase und Football.** Sechs PRs, grob 8–12 Arbeitstage über zwei bis
  drei Wochen mit Reviews — PR 1 (Mechanik + Rezept) ist die einzige, die über Bestehen oder
  Scheitern entscheidet, und sie ist vor PR 2 (Reaktion) kaderfest zu messen.

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Was heute im Motor steht

```js
"i-spy":{
  label:"I-Spy", jeSeite:6, rundenN:6, rundenDauer:60/(6*6*2), duell:true,
  failAbzug:0.55, failWort:"übersieht das Detail", erfolgWort:"entdeckt den Hinweis",
  rezept:{
    GRUNDLAGE:    {intelligence:40,spirit:30,will:30},
    SPITZENMOMENT:{torment:55,determination:30,spirit:15},
    TECHNIK:      {intelligence:40,awareness:35,dexterity:25},
    PUBLIKUM:     {charisma:55,torment:45},
    NERVEN:       {will:35,spirit:30,speed:20,determination:15},
    AUSDAUER:     {spirit:40,will:35,health:25},
    WAGNIS:       {torment:45,speed:30,dexterity:25}
  }
}
```
(`engine.js:13190-13210`.) Matrix `BASIS_JE_DISC["i-spy"]` (`:5167`): intelligence 18,
torment 17, spirit 13, will 12, charisma 9, determination 8, speed 8, dexterity 8,
**awareness 5**, health 2 — die breiteste Matrix aller zwanzig. Sechs Slots (`:5316-5323`):
Observer (int/torment), Pattern Lock (int/spirit), Social Read (torment/charisma), Logic Chain
(int/will), Quiet Move (dexterity/speed), Reveal (determination/torment).

Ablauf: `bauBuehne()` rechnet je Teilnehmer sechs Durchgänge mit der geteilten Formel vorab
(`:13512-13526`: `basis=(20+GRUNDLAGE·0,7)·ermued`, Erfolg `0,15+TECHNIK·0,0055+NERVEN·0,0035`,
Deckel 0,94, Erfolg `+SPITZENMOMENT·0,35·(0,4+WAGNIS·0,006)`, Fehlschlag `basis·0,55`, immer
`+PUBLIKUM·0,12`), dann bildet der Duell-Zweig (`:13540-13567`) Brett i = mein i-ter gegen den
i-ten Gegner und einen laufenden Vorteil. `stepBuehne()` (`:14224`) enthüllt 72 Einträge à
0,833 s ≈ 60 s. `wert()` liefert seit Fables Duell-Recherche die **eigenen Punkte** (`u.summe`,
`:30092-30106`), nicht mehr den Vorteil. Die Wertungstabelle ist `WERTUNG_DUELL` (`:17472`),
geteilt mit Speed-Schach/Tennis/Fechten.

Kein Flag, kein eigener Zweig: `zeichneBuehne()` (`:15927-15968`) lässt I-Spy als einzige der
neun Bühnen in den generischen Zwei-Reihen-Zweig fallen; `buehnenBewegung()` (`:14369-14395`) hat
keinen Eintrag. `DISZIPLIN_WAFFE["i-spy"]` ist `null` (seit 10.09.), `DISZIPLIN_PROP` (`:2957`)
kennt I-Spy nicht, `TON_KATALOG` ebenso wenig. Auf der React-Seite gibt es `spybar.tsx` (589
Zeilen, Nachtsicht-Späh-Zentrale mit Radar, Nebel, Späh-Balken und einer „Fund-🔍-FX") — ein
Thema (Spionage-Radar), das mit Chris' Escape-Room-Bild nicht deckungsgleich ist (s. 8.).

### 0.2 Warum rho heute bei 0,684 steht

Drei Ursachen, jede belegt:

1. **Zu wenige, zu grobe Ereignisse.** Sechs Bernoulli-Würfe mit Erfolgschancen zwischen 0,21
   und 0,83 (Fable, `arena-duell-recherche-fable.md` 4.3): Verlässlichkeit 0,85 gegen 0,95 bei
   Speed-Schachs zehn Durchgängen. Nach `rho(Spiel)=rho(Saison)·√Verlässlichkeit` kostet allein
   das rund 0,05.
2. **Die Validität ist schwach und kaderabhängig.** Saison 0,804 mit Spannweite 0,608 — bei einer
   Kader-Paarung ordnet die Mechanik das Richtige, bei einer anderen fast gar nichts. Zehn
   Attribute mit kleinen Gewichten heißen: die Eignungsabstände im Kader sind klein, das
   Würfelrauschen nicht. Speed-Schach mit sieben Attributen (28/21/14/14) liest Saison 0,972.
3. **Die Mechanik erzählt nichts über I-Spy.** Sie ist dieselbe wie bei Showcase und Wettessen;
   Awareness — laut Chris das Finden-Attribut — sitzt in einer einzigen Rolle (TECHNIK 35 %) bei
   Matrixgewicht 5.

Der billigste Vergleichswert, den PR 0 zuerst ziehen sollte: `rundenN` 6→10 plus 2RN-Würfeln
im heutigen Chassis (beides je eine Zeile, Fable 4.3). Das ist keine Empfehlung, sondern die
Nulllinie, gegen die das neue Konzept sich messen muss.

### 0.3 Was das Konzept schon vorfindet (die gute Nachricht)

| Chris' Idee | Existiert bereits als | Fundstelle |
|---|---|---|
| Assets an festen Positionen, manche leichter, manche schwerer | `hindernisse[]` (Bogenlängen-Bruchteile), `hindernisTypen[]`, `fallenStufe` 1–3 Sterne, `fallenBild` | Takeshi `engine.js:24198, 24239, 24294-24295` |
| Punkte nach Schwierigkeit, Abzug bei Sturz | `burgpunkte(u)`: Sterne × (1 − Stoppanteil) − Sturzabzug | `engine.js:22823-22825` |
| Ein Typ fordert einen bestimmten Sub-Skill | `fallenKoennen:0.75` — Wurf gegen den Sub-Skill DIESER Falle statt immer TECHNIK | `engine.js:24296-24326` |
| Drei feste Räume statt freier Ziehung | `kurse[]` (Nordhof/Sumpfpfad/Die Mauern), per Saat gewählt | `engine.js:24357-24368` |
| Ergebnis hängt vom Gegner ab, trotzdem vorab gerechnet | `baueHebenDuelle()` („lässt sich nicht je Teilnehmer für sich ausrechnen") | `engine.js:13494-13498, 13937` |
| Der Zuschauer schickt jemanden hin | Zielansage `KFOKUS` (Bias, 7 s Sperre, bit-identisch ohne Klick) | `engine.js:20320-20352` |
| Eigene Bewegung/Bild ohne Messrisiko | `step*`/`zeichne*`-Zweige mit `viz*`-Vertrag (Schach, Fechten, Tennis, Wettessen, Showcase) | `engine.js:14369-14395, 15927-15968` |
| Requisite in der Hand | `DISZIPLIN_PROP` (Schachuhr, Mikrofon, Degen …) | `engine.js:2957-2991` |
| Team-Punkte aus der Summe der eigenen Punkte | `spieleBuehneAuftritt()` (jede Bühne ohne `.heben`/`.duell`) | `engine.js:30846-30859` |

Was **nicht** vorhanden ist und neu gebaut werden muss: ein Rechner, in dem zwölf Teilnehmer
über Ticks um dieselben Objekte konkurrieren; eine Sichtbarkeits-/Reaktionsregel; ein zweiter
Entscheidungsschritt (welche Truhe) vor dem Erfolgswurf; ein Raum mit Truhen als Bühnenbild.

---

## 1. Grundmechanik: zwei Phasen je Zug

### 1.1 Der Zug (Tick)

Ein Spiel hat **acht Ticks** (Vorschlag; heute `rundenN:6`). In jedem Tick macht jeder der bis zu
zwölf Teilnehmer genau **einen Zug**, der aus zwei Phasen besteht:

1. **SPÜREN** — der Spieler wählt einen Fundort. Was er überhaupt „sieht", hängt von seinem
   Spürsinn ab; was er davon wählt, von einer Entscheidungsregel (1.3).
2. **KNACKEN** — er versucht, das Rätsel zu lösen. Die Chance hängt vom Sub-Skill der
   **Rätselart** dieser Truhe und von ihrer **Stufe** ab.

Ein gelungener Zug bringt den Punktwert der Truhe; ein misslungener bringt nichts, hinterlässt
aber **Fortschritt** an der Truhe (1.4). Das ist der Unterschied zur heutigen Formel, in der ein
Fehlschlag nur „weniger Punkte" ist — und es ist der Haken, an dem die Reaktionsmechanik hängt.

### 1.2 Sub-Skills (Vorschlag)

I-Spy verlässt die geteilte Sieben-Rollen-Formel und bekommt eigene Sub-Skill-Namen — so wie
Football acht eigene hat (`football-live-migration.md` Abschnitt 5) und Gewichtheben eine eigene
Erfolgsformel (`hebeUebung()`). Die Namen folgen den sechs vorhandenen Slots:

| Sub-Skill | Wirkt in | Attribute (Vorschlag, Matrix-nah) | Slot-Pate |
|---|---|---|---|
| **SPÜRSINN** | Phase 1: welche Stufen der Spieler sieht | intelligence 45, torment 30, awareness 25 | Observer |
| **LOGIK** | Knacken, Rätselart *Logik* | intelligence 50, will 30, determination 20 | Logic Chain, Pattern Lock |
| **MENSCHENKENNTNIS** | Knacken, Rätselart *Verhör* | torment 50, charisma 30, spirit 20 | Social Read |
| **FINGERFERTIGKEIT** | Knacken, Rätselart *Mechanik* | dexterity 45, speed 35, torment 20 | Quiet Move |
| **NERVEN** | Reihenfolge am Fundort, Zeitdruck nach Reaktion | will 40, determination 35, speed 25 | Reveal |
| **TEAMGEIST** | Ob und wie schnell die eigene Seite auf einen fremden Fund reagiert | spirit 55, charisma 25, awareness 20 | — |
| **AUSDAUER** | Konzentrationsverlust über die Ticks (wie `ermued` heute) | spirit 35, will 35, health 30 | — |

Zwei Dinge daran sind bewusst so und sollten gemessen, nicht geglaubt werden:

- **Chris' Entscheidung (21.09.), Frage 1 damit geschlossen: die Matrix bleibt unangetastet.**
  Awareness bleibt bei Matrixgewicht 5 — kein Override wie bei Football
  (`spiel-eignung-overrides.ts`). Chris' Satz „hohe Awareness" war kein Auftrag, Awareness zum
  dominanten Attribut zu machen, sondern eine Beschreibung der SPÜREN-Phase: ein Spieler mit hoher
  Awareness erkennt schneller/besser, wohin er als nächstes gehen sollte (welche Stufe lohnt sich),
  ein anderer braucht dafür länger — kann dafür aber das Rätsel selbst schneller lösen. Damit ist
  die bestehende Aufteilung genau richtig: Awareness wirkt nur in SPÜRSINN (Phase 1, „wohin gehe
  ich") mit 25 %, nicht in den KNACKEN-Sub-Skills. Zusätzlich bestätigt: **verschiedene Truhen/
  Hinweise sollen verschiedene Attribute für das Knacken selbst verlangen** — nicht nur
  Intelligenz, sondern je nach Rätselart auch Stärke (power), Torment oder andere Matrix-Attribute.
  Das ist bereits so vorgesehen (LOGIK/MENSCHENKENNTNIS/FINGERFERTIGKEIT mit unterschiedlichen
  Attributmischungen, Tabelle oben) und muss in der Kalibrierung nur beibehalten werden — keine
  Konzeptänderung nötig.
- **Torment 17 ist das zweithöchste Gewicht** und sitzt heute vor allem in SPITZENMOMENT/WAGNIS.
  Im Konzept wird es die Verhör-Rätselart (Druck ausüben, Verhalten lesen — genau der Social-
  Read-Slot-Text) und ein Drittel des Spürsinns. Wer Torment lieber als „Stressresistenz" liest,
  verschiebt es nach NERVEN; das ändert kein Konzept, nur eine Tabellenzeile.

Das Rezept ist nach der Budget-Methode zu kalibrieren (Handbuch Schritt 7: Pp ≤ 25 in zwei
Stichproben, alle Attribute lesen positiv). Das Sinkhorn-Werkzeug `baue-feldspiel-rezept.mjs`
kennt bis heute nur Hockeys `MATRIX`/`ERLAUBT` — I-Spy bräuchte einen eigenen Eintrag oder die
Tennis-Methode (von Hand, matrix-proportional, kaderfest gegengemessen).

### 1.3 Phase SPÜREN

Jeder Fundort hat eine Stufe 1–3. Der Spieler „sieht" einen Fundort der Stufe s mit
Wahrscheinlichkeit (Vorschlag):

    sieht(s=1) = 1                          (Notizen liegen offen)
    sieht(s=2) = min(0,95; 0,35 + SPÜRSINN·0,007)
    sieht(s=3) = min(0,90; 0,10 + SPÜRSINN·0,008)

Bei SPÜRSINN 30 sieht er Stufe 3 in 34 % der Ticks, bei 60 in 58 %, bei 85 in 78 %. Ein Wurf
je Tick (`rr()`), der über die Sichtbarkeit aller Stufen zugleich entscheidet (eine Zahl, drei
Schwellen — fester `rr()`-Verbrauch, Handbuch Falle 17).

Dann die **Wahl** unter den gesehenen, nicht besetzten Fundorten. Zwei Regeln zur Auswahl:

- **F1 „gierig":** immer die höchste gesehene Stufe. Einfach, transparent, aber ein schwacher
  Knacker verbrennt seine Züge an Tresoren, die er nie öffnet.
- **F2 „Erwartungswert":** der Spieler wählt die Stufe, bei der `Punktwert·Knackchance` für IHN
  am höchsten ist. Ein 30er geht zur Akte, ein 85er zum Tresor. Das ist Chris' „schneller
  analysieren" wörtlich — und es nutzt Intelligenz zweimal (sehen und einschätzen), ohne einen
  zweiten Sub-Skill zu brauchen.

Empfehlung F2, weil sie die Eignung als Kanal breiter macht (der Star wählt besser UND knackt
besser). Bei Gleichstand entscheidet die Rätselart, deren Sub-Skill beim Spieler am höchsten ist,
danach die Nähe zur eigenen Position (deterministisch, kein `rr()`).

### 1.4 Phase KNACKEN — die drei Stufen

| Stufe | Name (Vorschlag) | Punktwert | Knackchance bei Sub-Skill 30 / 60 / 85 | Sichtbar für den Gegner |
|---|---|---:|---|---|
| 1 | Notiz | 10 | 0,48 / 0,81 / 0,95 | nie |
| 2 | Akte | 25 | 0,26 / 0,59 / 0,86 | bei Erfolg |
| 3 | Tresor | 60 | 0,08 / 0,37 / 0,64 | bei Erfolg **und** bei Fehlschlag |

Formel dahinter (Vorschlag): `p = clamp(0,08; 0,95; 0,15 + K·0,011 − (s−1)·0,22)`, K der
Sub-Skill der Rätselart dieser Truhe. Erwartungswerte je Zug daraus:

| Sub-Skill | Notiz | Akte | Tresor |
|---|---:|---:|---:|
| 30 | 4,8 | 6,5 | 4,8 |
| 60 | 8,1 | 14,8 | 22,2 |
| 85 | 9,5 | 21,5 | 38,4 |

Das ist die Kernaussage des Konzepts in Zahlen: der Tresor lohnt sich für den Starken vierfach,
für den Schwachen gar nicht. Ein Team mit einem 85er und fünf 40ern spielt anders als eines mit
sechs 55ern — genau das, was die Rangtreue belohnen soll.

**Zufallsanteil je Stufe.** Der Würfel selbst ist derselbe; was sich je Stufe unterscheidet, ist
die Fallhöhe (10 gegen 60 Punkte). Zwei Dämpfer, beide als Schalter zu messen, nicht zu setzen:

- **2RN-Würfel** (Mittel zweier `rr()`, Fable 4.3): 0,8 sieht wie 0,8 aus, 0,3 wie 0,3. Fester
  Verbrauch: immer zwei Züge, auch wenn der Zweig sie nicht braucht.
- **Fortschritt statt Teilpunkte:** ein Fehlschlag gibt keine Punkte, aber die Truhe bekommt
  `+0,15` Knackchance je Fehlversuch (Deckel +0,30), sichtbar als aufgebrochenes Schloss. Der
  nächste, der kommt — egal welche Seite — profitiert. Das ist mechanisch das, was Chris mit „um
  es auch zu versuchen zu knacken" beschreibt, und es macht Fehlschläge zu Ereignissen mit Folgen
  statt zu verlorener Zeit.

Teilpunkte (z. B. 20 % des Werts für „Spur gesichert") sind eine Alternative, wenn die
Verlässlichkeit ohne sie nicht reicht; sie glätten rho, verwässern aber die Erzählung.

### 1.5 Rätselarten

Jeder Fundort trägt eine von drei Rätselarten — analog zu `hindernisTypen`:

| Art | Sub-Skill | Bild (Escape-Room) | Ticker-Wort |
|---|---|---|---|
| Logik | LOGIK | Zahlenschloss, Chiffre, Aktenordner mit Querverweisen | „entschlüsselt" |
| Mechanik | FINGERFERTIGKEIT | Vorhängeschloss, Dietrich, Schublade mit Geheimfach | „öffnet" |
| Verhör | MENSCHENKENNTNIS | Zeuge/Informant-Figur, Tagebuch, Foto mit Gesichtern | „bringt zum Reden" |

Verteilung im Raum: je Art ein Drittel der Fundorte, über alle Stufen. Damit hat ein Kader mit
einem Mechanik-Spezialisten und einem Logiker zwei Stars an verschiedenen Truhen — dieselbe
Spreizung, die Takeshi mit `fallenKoennen` gemessen gebracht hat (rho 0,861 → 0,883: „der Kanal
wird breiter, nicht lauter", `engine.js:24321-24325`).

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

---

## 2. Kartenlayout und Rundenstruktur

### 2.1 Der Raum

Ein Raum, Draufsicht wie die Takeshi-Karte, Fundorte als feste Positionen in W/H-Bruchteilen
(Muster `route[]`/`hindernisse[]`, auflösungsunabhängig):

```
fundorte:[ {x:0.12,y:0.30,art:"logik",   stufe:1}, {x:0.30,y:0.18,art:"mechanik",stufe:2},
           {x:0.50,y:0.12,art:"verhoer", stufe:3}, {x:0.70,y:0.18,art:"logik",   stufe:2},
           {x:0.88,y:0.30,art:"mechanik",stufe:1}, {x:0.20,y:0.62,art:"verhoer", stufe:1},
           {x:0.38,y:0.80,art:"logik",   stufe:2}, {x:0.50,y:0.55,art:"mechanik",stufe:3},
           {x:0.62,y:0.80,art:"verhoer", stufe:2}, {x:0.80,y:0.62,art:"logik",   stufe:1},
           {x:0.08,y:0.85,art:"mechanik",stufe:2}, {x:0.92,y:0.85,art:"verhoer", stufe:2} ]
```

Zwölf Fundorte (Vorschlag): 4× Notiz, 6× Akte, 2× Tresor — die beiden Tresore in der Mitte,
für beide Seiten gleich weit, wie die Burg am Ende der Takeshi-Route. Heim startet links, Gast
rechts (Symmetrie ist Pflicht: `miss-arena-buehne-spiegel.mjs` muss Heim:Gast nahe 50:50 lesen,
s. `engine.js:13455-13462` für den Fehler, der genau das beim Feldspiel einmal gebrochen hat).

**Drei Räume statt einem** (Vorschlag, Takeshis `kurse[]`-Muster): „Archiv", „Werkstatt",
„Salon" — dieselbe Multimenge an Truhen in anderer Anordnung, per Saat gewählt. Bewegt rho
gemessen bei Takeshi nur innerhalb der Kader-Spannweite (Anhang B.4 des Schlammrouten-Plans);
kostet drei Positionslisten, kein Mehr an Mechanik.

### 2.2 Nachfüllen

Zwölf Spieler × acht Ticks sind 96 Züge auf zwölf Fundorten — ohne Nachfüllen wäre der Raum
nach zwei Ticks leer. Regel (Vorschlag): eine geknackte Truhe ist einen Tick lang leer (das Bild
zeigt den offenen Deckel), danach liegt an derselben Position eine neue Truhe **derselben Art**
mit der nächsten Stufe aus einer festen, per Saat gewählten Folge (z. B. `[2,1,3,2,1,2,…]`).
Die Folge steht im Raum, nicht im Würfel — kein zusätzlicher `rr()`-Verbrauch.

Kleine Kader (2–6 je Seite, `gastGesetzt`-Rohr `engine.js:13450`): aktive Fundorte =
`2·max(mine,gegner)+2`, die übrigen Positionen bleiben leer gezeichnet. Bei 2 gegen 2 sind das
sechs Truhen, davon ein Tresor.

### 2.3 Ticks und Zeit

| | Vorschlag | Heute |
|---|---|---|
| Ticks je Spiel (`rundenN`) | 8 | 6 |
| Züge je Spiel (12 Teilnehmer) | 96 | 72 |
| Dauer je Zug in der Enthüllung (`rundenDauer`) | 0,625 s | 0,833 s |
| Spieldauer | 60 s | 60 s |
| Motor-Budget (`MOTOREN[bd].lauf`, `engine.js:30087`) | 120 s | 120 s |

Innerhalb eines Ticks werden die zwölf Züge wie heute seitenweise verzahnt enthüllt
(`buehneQueue`); die **Berechnung** aber läuft tickweise über alle zwölf (Abschnitt 3.4), weil
Reaktionen im Tick t+1 von Enthüllungen des Ticks t abhängen. Ein Zug in der Enthüllung hat
drei Bilder: Gehen zum Fundort (Gleitbewegung, `viz*`), Lupe über dem Kopf (Knacken), Ergebnis
(Schweber „+60", Jubel oder Fluch). Mehr Ticks (10) sind eine Zeile — aber die Hockey-Lehre gilt:
mehr Ereignisse helfen fast nie, wenn die Validität fehlt (CLAUDE.md). Erst Rezept, dann Uhr.

---

## 3. Sichtbarkeit und Reaktion — das Herzstück

### 3.1 WANN ein Fund sichtbar wird

| Variante | Regel | Für | Gegen |
|---|---|---|---|
| S-a „immer" | jeder Zug jedes Spielers ist für die Gegenseite sichtbar | einfach, keine Sonderfälle | die Reaktion wird zum Dauerzustand; nichts ist ein Ereignis |
| S-b „nur Tresor-Erfolg" | nur ein geknackter Tresor löst Reaktion aus | seltenes, großes Signal — der „krasse Fund" | bei zwei Tresoren im Raum 0–3 Reaktionen je Spiel; die Mechanik ist kaum zu sehen |
| **S-c „Freude und Fluch"** | sichtbar: Akte-Erfolg, Tresor-Erfolg, Tresor-Fehlschlag | Erfolg = Jubel (kein Pokerface); Tresor-Fehlschlag = hörbarer Fluch, die Truhe ist jetzt angebrochen und lohnt sich für den Gegner doppelt | Regel mit drei Fällen; muss im Ticker klar benannt werden |

Empfehlung **S-c**. Sie deckt beide Sätze von Chris ab („freut sich sichtbar" und „um es auch zu
versuchen zu knacken") und liefert bei sechs Akten und zwei Tresoren gemessen erwartbar 6–10
sichtbare Ereignisse je Spiel — genug, um die Reaktion als Mechanik zu sehen, nicht so viele,
dass sie Rauschen wird. Die Verzögerung ist strukturell: ein Fund im Tick t wirkt auf die Wahl im
Tick t+1 — dasselbe Prinzip wie die Zielansage („wirkt nicht sofort", `engine.js:20335`).

Eine vierte Variante nur als Notiz: **Persönlichkeit entscheidet über das Pokerface** —
`leitePers()` (`engine.js:18613`) kennt Schleicher/Opportunist/… Ein
Schleicher jubelt nicht. Das wäre eine schöne Charakterfarbe, macht die Sichtbarkeit aber vom
Kader abhängig und die Messung schwerer zu lesen. Nicht für PR 2, allenfalls später.

### 3.2 WIE die Gegenseite entscheidet, wen sie schickt

| Variante | Regel | Für | Gegen |
|---|---|---|---|
| R-1 „nächster" | der Gegner, der dem Fundort räumlich am nächsten steht | Takeshi-Gedränge-Logik, sofort plausibel | genau die Geometrie-Zielwahl, die in der Arena diagnostiziert und verworfen wurde (`arena-zielwahl-umsetzung.md`); belohnt Zufall der Startposition |
| **R-2 „bestgeeignet"** | der Gegner mit dem höchsten Sub-Skill der Rätselart dieser Truhe, der nicht selbst gerade einen Tresor bearbeitet | Chris' Wortlaut („seinen besten, am besten geeigneten Spieler"); Kanal läuft mit der Eignung | der Star wird zum Läufer — muss gedeckelt werden (3.3) |
| R-3 „Zuschauer-Ansage" | Chris markiert im Bild einen Fundort und einen eigenen Spieler | derselbe Eingriff wie `KFOKUS` in der Arena: Bias, Sperre, ohne Klick bit-identisch | nur für die Heimseite; die Gegenseite braucht ohnehin R-2; Eingriff in einen vorab gerechneten Ablauf ist konzeptionell heikel (3.5) |

Empfehlung **R-2 als KI-Regel für beide Seiten**, gedämpft durch **TEAMGEIST**: die Seite reagiert
auf ein sichtbares Ereignis mit Wahrscheinlichkeit `0,30 + Ø TEAMGEIST(Seite)·0,006` (bei 50:
60 %; ein Wurf je Seite je Tick, immer gezogen). Eine Seite mit hohem Spirit sieht und handelt;
eine mit niedrigem verpasst es. Das gibt Spirit (Matrix 13) den Teamkanal, den es heute nur als
Füllmasse in vier Rollen hat.

R-3 als **eigene, optionale PR** nach dem Zielansage-Muster (Abschnitt 7) — nur, wenn Chris das
will (Frage 4).

### 3.3 WAS passiert, wenn zwei an derselben Truhe ankommen

| Variante | Regel | Für | Gegen |
|---|---|---|---|
| K-A „Wettlauf" | Reihenfolge nach NERVEN (+ Nähe); der Erste versucht zuerst; gelingt es, ist die Truhe weg, der Zweite bekommt automatisch die nächste freie Notiz | jeder behält seinen Zug; Reihenfolge ist ein Eignungskanal | der Zweite wird selten den großen Fund machen — der Star der reagierenden Seite verliert oft |
| K-C „Duell am Fundort" | beide würfeln, der höhere Wurf gewinnt die Truhe, der andere geht leer aus | dramatisch, passt zum heutigen `duell`-Chassis | ein Zug wird durch fremde Hand vernichtet — Takeshis `tackleNerven` hat genau so Saison-rho von 0,937 auf 0,902 gedrückt („Ausscheiden durch fremde Hand misst nicht die eigene Eignung", `engine.js:24226-24228`) |
| **K-D „Wettlauf mit Fortschritt"** | wie K-A, plus: scheitert der Erste, versucht der Zweite **dieselbe** Truhe mit dem Fortschrittsbonus aus 1.4 | die Reaktion lohnt sich gerade dann, wenn der Fund noch nicht gesichert ist; niemand verliert seinen Zug; die Geschichte „er räumt ab, was der andere angefangen hat" entsteht von selbst | zwei Versuche an einer Truhe im selben Tick müssen in der Enthüllung nacheinander erzählt werden |

Empfehlung **K-D**. Sie ist die einzige Variante, in der beide Kanäle (NERVEN für die Reihenfolge,
Sub-Skill für den Versuch) mit der Eignung laufen und keiner sie zerstört.

**Deckel gegen den Läufer-Star:** ein Spieler folgt höchstens jeder zweiten Reaktion seiner
Seite (Sperre ein Tick, wie die 7-Sekunden-Sperre der Ansage), sonst tut er seinen eigenen Zug.
Ohne Deckel steht der Star der Gastseite acht Ticks lang an fremden Truhen — das wäre gemessen
vermutlich gut für rho und schlecht für das Bild.

### 3.4 Warum das vorab rechenbar bleibt

Die Bühne rechnet heute jeden Teilnehmer für sich (`setz()`), Gewichtheben paarweise
(`baueHebenDuelle()`). Die Schatzsuche braucht einen **dritten Rechner, `baueSchatzsuche()`**,
der über die Ticks läuft:

    für tick in 0..rundenN-1:
      für jede Seite: Reaktionswurf (ein rr()), ggf. Läufer bestimmen (deterministisch)
      für jeden Teilnehmer (Seiten verzahnt, wie buehneQueue):
        Spürwurf (ein rr()) → gesehene Stufen → Wahl (F2, deterministisch)
        Knackwurf (zwei rr(), 2RN) gegen Truhe.stufe + Truhe.fortschritt
        Truhe aktualisieren (leer / fortschritt+0,15), Ereignis in u.runden[tick] schreiben
      Nachfüllen (deterministische Folge)

Fester `rr()`-Verbrauch je Tick: 2 + 3·Teilnehmer, unabhängig vom Ausgang (Handbuch Falle 17).
Ergebnis je Teilnehmer: `u.runden[]` mit `{punkte, ereignis, stufe, art, fundort, reaktion?}`,
`u.summe` wächst in `stepBuehne()` wie überall (`u.summe+=r.punkte`, `engine.js:14246`).
`stepBuehne()`, `wert()`, `disziplinProbe()` und `miss-alle-disziplinen.mjs` sehen keinen
Unterschied zu einer Auftritt-Bühne. Genau deshalb ist das Konzept messbar wie jede andere
Disziplin — die Reaktion ist Teil der Vorab-Rechnung, nicht der Präsentation.

### 3.5 Die Grenze von R-3 (Zuschauer-Ansage)

Die Arena rechnet live; eine Ansage dort ändert die nächste Zielwahl. Die Bühne rechnet vorab
und enthüllt. Eine Ansage in einem vorab gerechneten Spiel hieße entweder, den Rest ab dem
nächsten Tick **neu zu rechnen** (möglich: `baueSchatzsuche()` ab Tick t mit gesetztem Läufer,
derselbe Saatzustand — aber es ist ein zweiter Rechenpfad mit eigener Fehlerklasse), oder die
Ansage wirkt nur auf die **Reihenfolge der Enthüllung** (dann ist sie Kosmetik). Für die
Arena-Auflösung auf dem Server gibt es keinen Zuschauer; R-3 ist also ausschließlich ein
Mockup-/Zuschauer-Feature und darf die Messung nicht berühren. Empfehlung: erst R-2 bauen und
messen, R-3 danach als eigene Entscheidung.

---

## 4. Punktevergabe und Team-Wertung

- **Spielerwert:** `wert()` bleibt `u.summe` — die eigenen Punkte, wie schon heute
  (`engine.js:30106`) und wie Fable es für Duell-Bühnen begründet hat („die Rangtreue soll die
  Mechanik prüfen, nicht die Paarung", `arena-duell-recherche-fable.md` 4.3). Summe = Punktwerte
  der geknackten Truhen.
- **Seitenstand:** die **Summe** der eigenen Punkte je Seite, nicht mehr gewonnene Bretter. Das
  ist genau `spieleBuehneAuftritt()` (`engine.js:30846-30859`, „jede BUEHNE_ART-Disziplin ohne
  .heben/.duell"). I-Spy verliert deshalb `duell:true` und bekommt ein eigenes Flag
  `schatzsuche:true`; der Chassis-Dispatch fällt automatisch auf den Auftritt-Pfad, ohne neuen
  Einstiegspunkt. Ein Unentschieden bei gleicher Summe ist ein echtes, seltenes Remis
  (Punktwerte 10/25/60 machen Gleichstände seltener als bei Bretter-Zählung).
- **Team-Punkte im Spielstand:** wie bei jeder Arena-Bühne über `arenaTeamPointsForFixture()` mit
  einem **eigenen** `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag samt PPS-Referenz aus dem
  live-save-Abbild — der Modul-Load-Guard verlangt ihn (`battle-mode-arena-team-points.ts:803`),
  und der rote Test (`tests/battle-mode-arena-team-points.test.ts:159`) ist dann bewusst mit der
  neuen Zahl zu aktualisieren. Dazu `ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS` (nicht mehr
  `…DUELL…`), `ARENA_RESOLVED_DISCIPLINE_IDS`, Override-Map, parametrisierte Tests (Handbuch 5.1).
- **Wertungstabelle:** `WERTUNG_AUFTRITT` mit eigenen Wörtern (`wertungTabelle`), plus zwei
  additive Anzeigefelder nach dem `u.treffer`-Muster von Fechten (`engine.js:13499-13504`):
  `u.funde` (Stufe 1/2/3 geknackt) und `u.reaktionen` (wie oft er zu fremden Funden geschickt
  wurde). Beides fließt nicht in `wert()`.
- **Zuschauer-Ticker** (`feed()`), Vorschlag: „Cassandra untersucht den Tresor im Salon (Logik,
  Stufe 3) — entschlüsselt ihn! +60" · „Draco (A-A) sieht den Jubel und eilt zum Salon." ·
  „Draco kommt zu spät — der Tresor ist leer; nimmt die Notiz daneben. +10" · „Vorrak scheitert
  am Zahlenschloss — das Schloss ist angebrochen (+15 % für den Nächsten)."

---

## 5. Visuelle Umsetzung

Alles Präsentatorische folgt dem Vertrag der acht bestehenden Bühnen-Zweige: eigenes Flag,
eigene Funktionen, nur `viz*`-Felder, niemals `rr()`, bit-identische Messung als Abnahme
(`engine.js:14360-14368`, `15233-15238`).

### 5.1 Der Raum (`bodenSchatzsuche()`)

Neben `bodenBuehne()`/`bodenWettessen()`/`bodenShowcase()` in der `else if`-Kette
(`engine.js:15927`). Escape-Room-Draufsicht: dunkler Holz-/Steinboden, Wandregale am Rand,
warmes Lampenlicht als radiale Verläufe, die zwölf Fundorte als gezeichnete Primitive (Truhe,
Aktenschrank, Schreibtisch mit Tagebuch, Figur mit Sprechblase für „Verhör") — im Maßstab von
`zeichneHantel`/`FOLTER_GERAETE`/`zeichneStab`, ohne Asset-Download (der Umgebungs-Proxy lässt
keine neuen Dateien durch; Takeshi hat seine Fallenbilder nur, weil sie schon im Repo lagen).
Stufe als Sterne über der Truhe (1–3, wie Takeshis `fallenStufe`); leere Truhe mit offenem
Deckel; angebrochene Truhe mit sichtbarem Riss und „+15 %".

### 5.2 Bewegung (`stepSchatzsuche(dt,art)`)

Angeschlossen in `buehnenBewegung()` mit `typeof`-Wächter wie die sechs Zweige dort.
Zustandsautomat je Teilnehmer nach dem `stepFechten()`-Muster (`u.vizPhase`):

| Phase | Dauer im Zug (0,625 s) | Bild |
|---|---|---|
| `gehen` | 0–35 % | Gleitbewegung `u.vizX/vizY` zum Fundort (`NAECHER()`-Muster der Kür) |
| `suchen` | 35–80 % | **Lupe über dem Kopf**, pulsierend; Spieler leicht gebeugt (Ausfallpose wie `u.lunge`) |
| `ergebnis` | 80–100 % | Erfolg: Jubel-Hüpfer (`u.vizJubelT`) + Schweber „+60" (`crit`, wie `versuchBig` `:14258`); Fehlschlag: Kopfschütteln, Truhe bekommt den Riss |
| `reagieren` | Tick-Beginn, wenn `r.reaktion` | gestrichelte Linie vom Läufer zum Fundort (wie die Ansage-Linien der Arena), Ausrufezeichen über dem Kopf |

Anti-Freeze wie bei Fechten (`vizBounceT` läuft immer): wartende Spieler wippen, keiner friert
ein. Alle Phasen lesen ausschließlich `u.aktuell`, `u.runden[u.aktuell]`, `buehneAkt`, `u.lunge`
und `u.id`-Hashes.

### 5.3 Die Lupe (`DISZIPLIN_PROP["i-spy"]`)

Eintrag `{ hand:SCHACH_HAND, phasen:LUPE_PHASEN, zeichne:zeichneLupe }` — dritte Wiederverwendung
des vermessenen Handpunkts (Schachuhr, Mikrofon, Kampfkunst nutzen ihn schon, `engine.js:2970,
2966, 2989`), kein Pixelscan nötig. Gezeichnet: Ring + Griff, Glas mit Schimmer, nur am
Teilnehmer in Phase `suchen`; zusätzlich das große Lupensymbol über dem Kopf als Primitive
(Ring, Griff, Blinken im Takt von `buehneAkt`), das Chris' „Escape-Room-Stil" trägt. Die Fund-
FX aus `spybar.tsx` (🔍) ist der React-Vorläufer derselben Idee.

### 5.4 Ton (`TON_KATALOG["i-spy"]`)

Dieselben Synth-Bausteine wie überall (Proxy lässt keine Audio-Dateien durch):

| Ereignis | Bau | Kante |
|---|---|---|
| `schloss` | `tonKlick` leise, wiederholt | Phase `suchen` |
| `geknackt` | `tonDoppelton` hell | Erfolg Stufe 1–2 |
| `tresor` | `tonDoppelton` + `tonRauschen`-Burst | Erfolg Stufe 3 (der „krasse Fund") |
| `fehl` | `tonBuzzer` 0,25 s | Fehlschlag |
| `alarm` | `tonTon` gleitend abwärts | Reaktion der Gegenseite beginnt |
| `raum` | Loop `tonRauschen` sehr leise (Uhrticken) | `bodenSchatzsuche()` start/stop |

Einmal-Marker `u.vizTonN`, Vorbild `stepZeitfahren()`/`stepShowcase()`; `sfx()` ohne
AudioContext ist ein No-Op.

### 5.5 React-Seite

`spybar.tsx` erzählt heute eine Nachtsicht-Späh-Zentrale mit Radar. Chris' Konzept erzählt einen
Escape-Room. Beides kann nicht bleiben; der Motor ist die Quelle, das React-Feld zieht nach — als
eigene, spätere Runde (wie beim Showcase-Konzept, Frage 5 dort). Bis dahin ist die Divergenz
sichtbar und in der Scorecard als offen zu führen.

---

## 6. Machbarkeit gegen die 0,80-Schranke

### 6.1 Warum die Messung unverändert passt

`disziplinProbe()` braucht von einer Disziplin nur `MOTOREN[bd].bau/lauf/wert/namen` und je
Teilnehmer `u.eig` und den Wert. Alles davon bleibt: `bau` ruft `bauBuehne()`, das für
`art.schatzsuche` in `baueSchatzsuche()` verzweigt (wie `if(art.heben){ baueHebenDuelle(…) }`,
`engine.js:13539`); `lauf` treibt `stepBuehne()` bis `done` (60 s < 120 s Budget); `wert()` liest
`u.summe`. Kader-Familie, Median/Spannweite, Star-/Paartreue (`miss-star-paartreue.mjs`) — alles
ohne Änderung. Das Konzept erfindet keinen fünften Motor; es ist eine Bühne mit eigenem
Rechner, wie Gewichtheben.

### 6.2 Die Rechnung in den zwei Größen

`rho(Spiel) = rho(Saison) · √Verlässlichkeit`. Heute 0,804 · √0,72 ≈ 0,68.

**Validität (Saison).** Heute schwach und kaderabhängig (Spannweite 0,608). Das Konzept greift
hier an drei Stellen: die Sub-Skills sind matrix-proportional aufgebaut (ihr Mittel ist nach
`mengeAusEignung` die Eignung — der Grund, warum Takeshis `fallenKoennen` rho hob); der Star
bekommt durch F2 systematisch die wertvolleren Ziele; die Reaktion (R-2) schickt den
Bestgeeigneten zu angebrochenen Tresoren. Alle drei Kanäle korrelieren mit `eig` — das war bei
Takeshis Rempler-Kanälen (r 0,85/0,88) die Bedingung dafür, dass Chaos rho hebt statt drückt.
Ziel: Saison ≥ 0,92, Spannweite < 0,25.

**Verlässlichkeit.** 96 statt 72 Züge, jeder Zug mit zwei gestuften Entscheidungen statt eines
Bernoulli-Wurfs mit festem Betrag, 2RN-Würfel, Fortschritt statt Totalverlust. Gegenkraft: die
Fallhöhe 10/25/60 erhöht die Varianz — ein 85er kann in acht Ticks drei Tresore knacken oder
keinen. Ziel: Verlässlichkeit ≥ 0,78 (Hockey nach Verdopplung 0,85, heute I-Spy 0,72).

Produkt: 0,92 · √0,78 ≈ **0,81**. Das ist knapp, nicht komfortabel — und es ist eine Schätzung,
kein Messwert. Was daran zuerst kippen kann: die Tresor-Varianz. Deshalb gehört der
Punktwert-Abstand (60 gegen 25) zu den ersten Kalibrierschrauben, und Teilpunkte bleiben als
Reserve in der Schublade.

**Zwei Regeln aus der Projektgeschichte, die das Konzept einhalten muss:**

1. Kein Kanal, in dem fremde Hand einen Zug vernichtet (K-C verworfen, Deckel auf den Läufer).
2. Kein Attribut in einer Erfolgschance über sein Matrixgewicht hinaus (Awareness-Frage).

### 6.3 Ehrlichere Abnahme

Neben rho je Spiel die Star-/Paartreue (CLAUDE.md, `miss-star-paartreue.mjs`): Star auf Rang 1
≥ 50 %, in den ersten zwei ≥ 75 %, nie letzter, Paare mit ≥ 15 Punkten Abstand ≥ 95 % richtig.
Für I-Spy ist das wichtiger als anderswo, weil zehn Matrix-Attribute viele Paare unter zwei
Punkten Abstand erzeugen, die kein Motor ordnen soll.

### 6.4 Kalibrierung ohne reale Referenz

Es gibt keine NFL-Quote für Schatzsuchen. Ersatz ist eine **plausible Zielverteilung**, die Chris
abnickt und ein `miss-i-spy-korridor.mjs` (n ≥ 32, Muster `miss-hockey-korridor.mjs`) misst:

| Kennzahl | Zielkorridor (Vorschlag) | Warum |
|---|---|---|
| Knackquote gesamt | 50–60 % | mehr als jede zweite Truhe geht auf — sonst ist der Raum nur Frust |
| Tresor-Quote Star / Kadermittel | ~55 % / ~25 % | der Unterschied muss sichtbar sein („Stars müssen Stars sein") |
| Anteil Tresor-Punkte am Seitenstand | 30–45 % | Tresore entscheiden, aber nicht allein |
| Sichtbare Ereignisse je Spiel | 6–10 | die Reaktion ist zu sehen, ohne Dauerzustand zu sein |
| Reaktionen je Seite je Spiel | 3–5 | jeder Star wird ein paarmal geschickt, nicht acht Mal |
| Seitenstand | 200–320 Punkte, Siegermarge Median 10–15 % | Größenordnung wie die heutigen 185–250 im Season-1-Fixture (`tests/_fixtures/season1-regression/season1-matchday-results.csv:578-585`) |
| Unentschieden | < 3 % | Summe statt Bretter |
| Heim:Gast im Spiegeltest | 45:55 bis 55:45 | `miss-arena-buehne-spiegel.mjs` |

### 6.5 Erstes Rezept — grobe Gewichtung, ausdrücklich Vorschlag

Wie in 1.2. Mechanisches Gewicht der Sub-Skills, wie es der Rechner es erzeugt (Erwartung, zu
messen): SPÜRSINN ~25 % (entscheidet über die Zielstufe), Knack-Sub-Skills zusammen ~45 % (je
Rätselart ein Drittel), NERVEN ~10 %, TEAMGEIST ~10 %, AUSDAUER ~10 %. Damit landet Intelligence
bei grob 20–25 % Einfluss (Matrix 18), Torment 15–20 (17), Spirit 12–15 (13), Will 10–12 (12) —
und Awareness 5–7 (5). Pp-Abweichung nach dem ersten Bau geschätzt 25–35, also zwei
Kalibrierrunden vom Ziel ≤ 25 entfernt.

---

## 7. Aufwandsschätzung und Bauplan

### 7.1 Einordnung gegen frühere Runden

| Runde | Was | Umfang | rho-Wirkung |
|---|---|---|---|
| Showcase Act-System (17.09.) | Flag, Act-Ableitung, Bühnenbild, sechs Zeichenrezepte, Ton | 4 PRs (#957–#961), ≈ 4–5 Tage, ein Tag | keine (bewusst bit-identisch) |
| Tennis/Fechten Bühnen-Umzug (03.09.) + Nachzüge | Chassis-Wechsel, Rezeptkalibrierung (#850, #945), Perioden/Trefferstand (#928), Bild+Bewegung (#929, #946, #988) | 2 Commits + 5 PRs über ~3 Wochen | Tennis kaderfest 0,505 (Feldspiel) → 0,814 (Umzug) → 0,825 (Rezept); Fechten 0,153 (Arena) → 0,840 → 0,826 |
| Football Live-Migration (ab 03.09.) | neuer Live-Motor, Downs, Korridor-Refit, PRD | 11+ Commits, 3 Runden, ~3 Wochen, **nicht abgeschlossen** (0,516 → 0,800 → Drift) | Mechanik und Kalibrierung gekoppelt, Live-Physik |

Die Schatzsuche ist **mehr als Showcase** (sie ändert die Mechanik und muss die Schranke
nehmen) und **deutlich weniger als Football** (kein Live-Motor, keine Physik, keine Formationen;
ein Vorab-Rechner mit ~150–250 Zeilen, dessen Ergebnis über die bestehende Enthüllung läuft).
Am nächsten liegt Fechtens Weg: Chassis behalten, eigenen Rechner und eigene Regeln einziehen,
Bild und Bewegung danach. **Schätzung: sechs PRs, 8–12 Arbeitstage, zwei bis drei Wochen mit
Overseer-Reviews.** Die Unsicherheit sitzt fast vollständig in PR 1.

### 7.2 PR-Aufteilung (sequenziell, alle fassen `engine.js` an)

**PR 0 — Nulllinie und Sonde (≈ 0,5 Tag).** `rundenN` 6→10 und 2RN im heutigen Chassis
kaderfest messen (nicht committen, nur Zahl), damit klar ist, wie viel die neue Mechanik über
das Billige hinaus bringen muss. Sonde `window.__arena.schatzsuchProbe()` (rein lesend, wie
`showcaseActProbe`): Truhen je Stufe/Art, Züge je Stufe je Teilnehmer, Reaktionen, Knackquoten.
Dieses Dokument im Repo.

**PR 1 — Grundmechanik und Rezept (≈ 3 Tage; die entscheidende PR).** Flag `schatzsuche:true`
statt `duell:true`; `fundorte[]`/`raeume[]`, Stufen, Rätselarten, Nachfüllfolge;
`baueSchatzsuche()` mit Tick-Schleife (Spüren F2, Knacken, Fortschritt, **ohne** Reaktion —
Reaktionswurf wird trotzdem schon gezogen und verworfen, damit PR 2 den `rr()`-Verbrauch nicht
verschiebt); Sub-Skills und Rezept aus 1.2; `wertungTabelle`-Wörter, `u.funde`; Feed-Zeilen.
Abnahme: kaderfest `miss-alle-disziplinen.mjs 24 i-spy` mit Median und Spannweite,
Star-/Paartreue, Spiegeltest, 2–6 je Seite laufen; alle acht Geschwister-Bühnen bit-identisch.
Wenn PR 1 unter 0,75 bleibt, ist vor PR 2 das Rezept dran, nicht die Reaktion.

**PR 2 — Sichtbarkeit und Reaktion (≈ 2 Tage).** S-c, R-2 mit TEAMGEIST, K-D, Läufer-Deckel;
`u.reaktionen`; Ticker. Varianten S-a/S-b/K-A jeweils als Schalter gemessen und im
Rezeptkommentar mit Zahl verworfen (Takeshi-Muster „BEWUSST NICHT GESETZT, weil gemessen
schädlich"). Abnahme: rho steigt oder bleibt innerhalb der Spannweite; Korridor 6.4.

**PR 2b (optional, Chris' Entscheidung) — Zuschauer-Ansage (≈ 1 Tag).** R-3 nach dem
`KFOKUS`-Muster, Neu-Rechnung ab dem nächsten Tick, ohne Klick bit-identisch. Nur Mockup.

**PR 3 — Bühnenbild, Bewegung, Lupe (≈ 2 Tage).** `bodenSchatzsuche()`, `stepSchatzsuche()`,
`zeichneSchatzsuche()`, `DISZIPLIN_PROP["i-spy"]`. Sicht-QA per `sondenLauf()` (deterministische
Screenshots, `engine.js:30913 ff.`) mit einer typischen Kaderfigur **und** einer
Vollbild-Kreatur; Gegenprobe Showcase/Wettessen unverändert. Abnahme: bit-identisch.

**PR 4 — Ton und Politur (≈ 1 Tag).** `TON_KATALOG["i-spy"]`, Ticker-Feinschliff,
Wertungstabellen-Fuß, `ZEIT_DEHNUNG`. Bit-identisch.

**PR 5 — Produktivierung (≈ 1 Tag, PRODUKTIONSCODE, besondere Review-Sorgfalt).**
`ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS`, `ARENA_RESOLVED_DISCIPLINE_IDS`, eigene PPS-Referenz
(`ziehe-…-pps-referenz.ts`-Muster), `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`, roter Test auf grün mit
neuer Zahl, Scorecard-Nachzug. Erst, wenn PR 1/2 die Schranke kaderfest genommen haben.

Quer zu allen: eine Kopie, ein Faktor, vergleichen (NBA2K-Plan §5); Overseer-Review vor jedem
Merge; jede Zahl mit der gemessenen Datei daneben.

---

## 8. Offene Fragen für Chris

1. ~~**Awareness in der Matrix.**~~ **Von Chris entschieden (21.09.): Matrix bleibt unangetastet.**
   Awareness bleibt bei Matrixgewicht 5 und wirkt nur in der SPÜREN-Phase (schnelleres/besseres
   Erkennen, wohin als nächstes zu gehen ist) — kein dominantes Erfolgs-Attribut. Zusätzlich
   bestätigt: verschiedene Truhen/Rätselarten sollen für das KNACKEN selbst unterschiedliche
   Matrix-Attribute verlangen (nicht nur Intelligenz — auch power/torment/etc., je nach Art). Die
   in Abschnitt 1.2 vorgeschlagene Sub-Skill-Aufteilung (SPÜRSINN nur zu 25 % Awareness; LOGIK/
   MENSCHENKENNTNIS/FINGERFERTIGKEIT mit je eigener Attributmischung) entspricht damit bereits
   Chris' Vorstellung — keine Konzeptänderung nötig, nur bei der Kalibrierung beibehalten.
2. ~~**Drei Rätselarten...**~~ **Teilweise von Chris entschieden (21.09.):** die Verteilung über
   Rätselarten/Attribute muss gleichmäßig sein, kein Attribut darf die Disziplin dominieren (s.
   Abschnitt 1.5). Offen bleibt nur noch die Anzahl selbst — drei (Logik/Mechanik/Verhör) ist das
   Minimum, bei dem zwei Stars an verschiedenen Truhen glänzen können; mehr als vier verdünnt jede
   Art auf drei Fundorte.
3. **Sichtbarkeitsregel:** S-c (Akte-Erfolg, Tresor-Erfolg, Tresor-Fehlschlag) — oder nur der
   große Fund (S-b)? Und soll die Persönlichkeit über das Pokerface entscheiden (Schleicher
   jubelt nicht)?
4. **Reaktion automatisch (R-2, beide Seiten) oder zusätzlich manuell (R-3, wie die Zielansage in
   der Arena)?** R-3 ist nur im Mockup sichtbar, nie auf dem Server, und braucht einen zweiten
   Rechenpfad.
5. **Kollision:** Wettlauf mit Fortschritt (K-D, Empfehlung) — oder das dramatischere Duell am
   Fundort (K-C), im Wissen, dass es die Rangtreue vermutlich kostet?
6. **Glücksanteil:** 2RN-Würfel (glatter) oder ein Würfel (rauer)? Fortschritt statt Teilpunkte,
   oder beides? Punktwerte 10/25/60 — oder flacher (10/20/40), wenn die Tresor-Varianz die
   Schranke gefährdet?
7. **Rundenzahl und Dauer:** acht Ticks à 0,625 s je Zug (60 s) — oder zehn? Spieldauer ist eine
   Zeile, aber nach der Hockey-Lehre nicht der Hebel.
8. **Ein Raum oder drei** (Archiv/Werkstatt/Salon, per Saat)? Drei kosten drei Positionslisten
   und bringen Wiedersehenswert wie Takeshis Kurse.
9. **Thema und Name:** Escape-Room (Motor, dieses Konzept) gegen Nachtsicht-Späh-Zentrale
   (`spybar.tsx`). Eines von beiden muss weichen; `spybar.tsx` nachziehen ist eine eigene Runde.
10. **Unentschieden** bei Punktgleichheit zulassen (Empfehlung, wie Hockey) oder Tiebreak über
    Tresor-Zahl?
11. **Reihenfolge im Projekt:** I-Spy stand bewusst am Ende der Liste. Dieses Konzept ist
    umsetzbar, aber PR 1 bindet eine Session für rund drei Tage, bevor eine Zahl da ist. Soll
    das vor oder nach den offenen Football-/Hockey-Punkten laufen?

---

## 9. Was dieses Konzept bewusst nicht tut

- Kein fünfter Motor, kein Live-Rechner: I-Spy bleibt eine Bühne mit Vorab-Rechnung und
  Enthüllung, wie Gewichtheben.
- Keine Änderung an der geteilten Bühnen-Punkteformel, an `stepBuehne()`, an
  `WERTUNG_AUFTRITT` oder an einer der acht Geschwister-Bühnen — jede PR weist das bit-identisch
  nach.
- Kein Asset-Download; Truhen, Lupe und Raum sind Primitive.
- Keine Matrix-Änderung — von Chris am 21.09. entschieden (Frage 1, s.o.): die Matrix bleibt, wie
  sie ist.
- Kein Produktionsanschluss vor der kaderfest genommenen Schranke (PR 5 zuletzt).

## Quellen (alle gelesen, nicht vermutet)

- `public/mockups/battle-mode.engine.js`: `DISCS` `:4670`; `BASIS_JE_DISC["i-spy"]` `:5167`;
  `SLOTS_JE_DISC["i-spy"]` `:5316-5323`; `DISZIPLIN_PROP` `:2957-2991`; `BUEHNE_ART["i-spy"]`
  `:13190-13210`; `bauBuehne()` `:13426`, `setz()`-Formel `:13512-13526`, Duell-Zweig
  `:13540-13567`, Duett/Startreihenfolge `:13608-13672`; `baueHebenDuelle()` `:13937`;
  `stepBuehne()` `:14224-14354`; `buehnenBewegung()` `:14369-14395`; `stepSchach()` `:15193`;
  `stepFechten()` `:15222-15261`; `zeichneBuehne()`-Dispatch `:15927-15968`; `WERTUNG_DUELL`
  `:17472`; Zielansage `KFOKUS` `:20320-20352`; `burgpunkte()` `:22823`; Takeshi
  `hindernisse`/`hindernisTypen`/`fallenStufe`/`fallenKoennen`/`kurse` `:24198-24368`;
  `MOTOREN[buehne]` `:30080-30107`; `spieleBuehneDuell()` `:30819`, `spieleBuehneAuftritt()`
  `:30846`; `sondenLauf` `:30913 ff.`
- `lib/resolve/battle-mode-arena-team-points.ts` (Guard `:803`);
  `tests/battle-mode-arena-team-points.test.ts:150-160`; `data/generated/rangtreue-basislinie.json:119`.
- `app/foundation/discipline-stage/arena/disciplines/spybar.tsx` (Kopf).
- `scripts/miss-alle-disziplinen.mjs`, `scripts/lib/rangtreue-messung.mjs`,
  `scripts/miss-star-paartreue.mjs`.
- `docs/design/arena-duell-recherche-fable.md` (Abschnitt 4), `neue-disziplin-handbuch.md`
  (1.3, 5, 6, 7), `showcase-talentshow-konzept-17-09.md`, `tennis-fechten-buehne-umsetzung.md`,
  `football-live-migration.md`, `arena-zielwahl-umsetzung.md`,
  `takeshi-chaos-tackle-plan-06-09.md` (über die Motorkommentare), `stand-aller-disziplinen.md`,
  `gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` (I-Spy-Zeile), `CLAUDE.md`.

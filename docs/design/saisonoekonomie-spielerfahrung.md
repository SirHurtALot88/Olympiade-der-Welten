# Saisonökonomie aus der Sicht der Spielerfahrung

> **Was das hier ist.** Eine zweite, unabhängige Meinung zur Saisonökonomie — bewusst **nicht** aus der
> Balancing-Ecke und **nicht** aus dem Blickwinkel echter Sportsysteme (das macht parallel ein
> Recherche-Auftrag). Die Frage hier lautet ausschließlich: **Welche Entscheidungen entstehen, und wann
> ist eine Saison wirtschaftlich spannend?**
>
> Entwurfsdokument. Kein Produktivcode, keine Versionserhöhung, kein Changelog-Eintrag.

---

## 0. Die Kernthese in drei Sätzen

Eine Saisonwirtschaft ist genau dann interessant, wenn der Spieler **knappe, nicht rückholbare Mittel
gegen eine nur teilweise bekannte Zukunft festlegt** und im Laufe der Saison merkt, ob die Wette
aufgeht. Ausgewogenheit ist dabei eine Nebenbedingung, kein Ziel: eine perfekt ausbalancierte
Wirtschaft ohne Festlegung ist ein gelöstes Rechenproblem, kein Spiel. Das heutige System scheitert
nicht an der Balance — es scheitert daran, dass die einzige Größe, die wirklich streut, **weder sichtbar
noch beeinflussbar** ist.

---

## 1. Was gemessen wurde — der bespielte Save

Grundlage ist der **komplett gespielte Save `new-game-1785174792968-8d7mdx`** (Phase
`season_completed`, Spieltag 10, echte Endtabelle) aus `data/online-saves/hetzner-live.sqlite.gz`.
Alle Zahlen dieses Dokuments sind gegen **diese 32 Teams** gerechnet, nicht gegen unbespielte Saves.

### 1.1 Die Endtabelle mit Geld

| Pl | Start | Δ | Team | Gehalt | Sockel | Rangteil | Saisonteil | Sponsor ges. | GuV |
|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | 1 | ±0 | Mayhem Mavericks | 95,7 | 44,2 | 0 | 51,4 | 95,6 | **−0,1** |
| 2 | 3 | +1 | Cold Steel | 69,6 | 44,6 | 1,3 | 35,1 | 79,7 | +10,1 |
| 3 | 7 | +4 | Raging Lunatics | 80,1 | 45,0 | 5,1 | 65,7 | 110,7 | +30,6 |
| 4 | 6 | +2 | Project Suicide | 78,0 | 45,4 | 2,6 | 42,5 | 87,9 | +8,6 |
| 5 | 2 | −3 | Zero Heroes | 97,7 | 45,8 | −2,9 | 50,8 | 96,6 | −1,1 |
| 6 | 10 | +4 | Silver Soldiers | 66,9 | 46,2 | 5,1 | 60,8 | 107,0 | +40,8 |
| 7 | 8 | +1 | Wrecking Legionnaires | 75,2 | 46,6 | 1,3 | 65,7 | 112,3 | +37,1 |
| 8 | 4 | −4 | Golden Gladiators | 67,1 | 47,0 | −3,8 | 68,7 | **115,7** | **+47,5** |
| 9 | 9 | ±0 | Hell Raisers | 76,3 | 47,4 | 0 | 35,8 | 83,2 | +6,9 |
| 10 | 11 | +1 | Black Panthers | 80,9 | 47,8 | 1,3 | 57,9 | 105,7 | +24,8 |
| 11 | 13 | +2 | Natures Wrath | 65,0 | 48,2 | 2,6 | 47,1 | 95,3 | +28,3 |
| 12 | 5 | −7 | Last Ride | 79,8 | 48,6 | −6,2 | 30,6 | 79,2 | −0,6 |
| 13 | 15 | +2 | Wicked Wizards | 69,3 | 49,0 | 2,6 | 46,0 | 95,0 | +25,5 |
| 14 | 12 | −2 | Nunchuck Ninjas | 77,2 | 49,4 | −1,9 | 23,4 | 72,8 | −4,4 |
| 15 | 14 | −1 | Terrible Teachers | 70,4 | 49,8 | −1,0 | 30,8 | 80,6 | +9,2 |
| 16 | 19 | +3 | Vigorous Vikings | 64,0 | 50,2 | 3,9 | 38,3 | 88,5 | +24,5 |
| 17 | 16 | −1 | Vicious & Delicious | 65,2 | 50,2 | −1,0 | 8,4 | 58,6 | −6,6 |
| 18 | 24 | +6 | The Chantry | 42,9 | 50,5 | 7,7 | 37,8 | 88,3 | +44,1 |
| 19 | 20 | +1 | The Giants | 68,2 | 50,8 | 1,3 | 9,8 | 60,6 | −7,6 |
| 20 | 18 | −2 | Death Peaches | 55,2 | 51,1 | −1,9 | 29,7 | 80,8 | +24,3 |
| 21 | 23 | +2 | Cash Creators | 41,8 | 51,4 | 2,6 | −3,3 | 48,1 | +9,1 |
| 22 | 17 | −5 | Mortal Sin | 52,4 | 51,7 | −4,8 | −3,6 | 48,1 | −6,2 |
| 23 | 21 | −2 | Lost Kingdom | 61,2 | 52,0 | −1,9 | 28,1 | 80,1 | +18,3 |
| 24 | 27 | +3 | Dire Legion | 49,4 | 52,3 | 3,9 | −12,8 | **39,5** | −10,8 |
| 25 | 29 | +4 | Blazing Beasts | 53,4 | 52,6 | 5,1 | 3,6 | 56,2 | +2,8 |
| 26 | 22 | −4 | Royal Court | 57,6 | 52,9 | −3,8 | −4,2 | 48,7 | −8,9 |
| 27 | 31 | +4 | Armageddon Aftermath | 51,9 | 53,2 | 5,1 | 8,4 | 61,6 | +9,7 |
| 28 | 30 | +2 | Vigilante Wranglers | 40,3 | 53,5 | 2,6 | −10,5 | 43,0 | +2,7 |
| 29 | 32 | +3 | Riptide Rivers | 35,4 | 53,8 | 3,9 | −6,6 | 47,2 | +11,8 |
| 30 | 26 | −4 | Pirate Crew | 52,6 | 54,1 | −3,8 | −12,1 | 42,0 | −11,2 |
| 31 | 25 | −6 | Stronghold Crusaders | 48,8 | 54,4 | −5,8 | −9,3 | 45,1 | −3,7 |
| 32 | 28 | −4 | Undercover Agents | 54,1 | 54,7 | −3,8 | −13,5 | 41,2 | −13,7 |
| | | | **Liga** | **2043,6** | | | | **2394,9** | **+351,3** |

**Ligakennzahlen.** Gehalt 35,4 … 97,7 (Faktor 2,76). Sponsor gesamt 39,5 … 115,7 (Faktor 2,93).

> Die Gehaltssumme ist hier aus `rosters[].upkeep` gebildet — das ist der Betrag, den die Liga dem Team
> tatsächlich abzieht. Eine Messung über `players[].player.displaySalary` liefert eine engere Spanne
> (37,8 … 84,4, Faktor 2,24), weil dort Vertragszuschläge fehlen. Für die Wirtschaft zählt `upkeep`.

Sponsorsockel 44,2 (Platz 1) … 54,7 (Platz 32) — bereits invers, Spanne 10,5. Die Liga schüttet
**2394,9 gegen 2043,6 Gehalt aus, also +17,2 %** — es wird pro Saison netto Geld gedruckt.

| Gruppe | Ø Gehalt | Ø Sponsor | Ø GuV | Gehalt / Sponsor |
|---|---:|---:|---:|---:|
| Top 8 | 78,8 | 100,7 | **+21,7** | 0,80 |
| Mitte (9–24) | 63,7 | 75,3 | +11,2 | 0,88 |
| Letzte 8 | 49,3 | 48,1 | **−1,3** | 1,04 |

### 1.2 Der Befund, an dem alles hängt: die Tabelle ist gekauft, die Bewegung ist gewürfelt

| Kennzahl | Wert | Lesart |
|---|---:|---|
| Korrelation Endrang ↔ Gehalt | **−0,82** | Wer mehr zahlt, steht oben. Sehr stark. |
| Korrelation Startplatz ↔ Gehalt | −0,88 | Das galt schon vor der Saison. |
| Korrelation **rankDiff** ↔ Gehalt | **−0,16** | Ob sich ein Team **bewegt**, hat mit Geld praktisch nichts zu tun. |
| sd(rankDiff) | 3,3 Plätze | Es gibt Bewegung — sie ist nur nicht gekauft. |

Das ist die zentrale Beobachtung für die Spielerfahrung und sie ist unbequem:

> **Das Geld entscheidet über das NIVEAU, der Würfel über die BEWEGUNG.** Und ausgezahlt wird der
> Platzierungsbonus genau auf die Bewegung.

Der Spieler kauft sich also seinen Erwartungsrang — und bekommt dann eine Prämie für eine Abweichung,
die er nicht herbeiführen kann. Größter Aufsteiger war **The Chantry (24 → 18)** mit 42,9 Gehalt, dem
billigsten Kader der oberen zwanzig; größter Absteiger **Last Ride (5 → 12)** mit 79,8. Beides sieht
nach Geschichte aus, ist aber Rauschen: bei einer Korrelation von −0,16 lässt sich aus dem Etat nicht
vorhersagen, wer sich bewegt.

### 1.3 Die halbe Auszahlung ist Willkür

Regression `Sponsor gesamt ~ Endrang` über die 32 Teams:

```
Sponsor = 110,9 − 2,19 · Rang      R² = 0,72
Standardabweichung gesamt          23,75 C
davon NICHT vom Rang erklärt       12,53 C   →  52,8 %
```

**Über die Hälfte der Streuung der Standardabweichung hat mit dem Tabellenplatz nichts zu tun.**
Der Rest-Ausreißer ist mit 12,5 C größer als die gesamte Ausgleichswirkung des inversen Sockels (10,5 C).
Konkret:

| Team | Platz | Abweichung von der Rangkurve |
|---|---:|---:|
| Golden Gladiators | 8 | **+22,3** |
| Lost Kingdom | 23 | +19,5 |
| Wrecking Legionnaires | 7 | +16,7 |
| Vicious & Delicious | 17 | −15,1 |
| Cash Creators | 21 | −16,9 |
| Dire Legion | 24 | −19,0 |
| Cold Steel | 2 | **−26,8** |

Zwischen **Cold Steel (Platz 2, 79,7)** und **Golden Gladiators (Platz 8, 115,7)** liegen 36 C bei sechs
Plätzen Unterschied — in der falschen Richtung. Und die Zuspitzung:

> **Der Meister macht −0,1. Der Achte macht +47,5.**

Der Spieler erlebt das nicht als Entscheidung, sondern als Zuteilung. Genau das meint die Beschwerde
„Sonderziel ist schwammig": der Ausschlag ist groß genug, um die Saison zu entscheiden, und klein genug
gestreut, dass niemand ihn steuern kann. Das ist die schlechteste Kombination, die eine Zufallsgröße
haben kann.

### 1.4 Warum es strukturell nicht anders sein kann

Aus `lib/sponsor/sponsor-v3-model.ts`:

* Jede Karte wird über `sponsorV3AnchorWeights(terms.startRank)` auf den **eigenen Startrang** normiert.
  Der Erwartungswert ist per Konstruktion der eingefrorene Anker `A` (`sponsorV3ExpectedPayout`).
  Das System ist damit ein **Spiegel der Tabelle** und kann konstruktionsbedingt nichts ausgleichen.
* Beide angebotenen Karten haben `tiltFactor: 0` (`SPONSOR_V3_CARDS`), die Achse ist mit
  `SPONSOR_V4_AXIS_PBAR = 0.5` bepreist und hat damit **EV-Beitrag exakt 0**. Alle Karten zeigen
  dieselbe Leiter und denselben Erwartungswert. Der einzige echte Unterschied ist ein 50-%-Münzwurf auf
  das Sonderziel und ein Vorschuss, der am Saisonende wieder verrechnet wird.
* Der Gehaltsfaktor (`lib/season/season-economy-factors.ts`) ist ein **Zufallswurf in [0,82 … 1,24]**,
  gezogen je Save und Saison. Er hängt nicht am Ligagehalt — er ist Konjunktur, kein Gehaltskoppler.

Der letzte Punkt ist der wichtigste und zugleich die größte verschenkte Chance. **Das Spiel kennt die
nächsten vier Saisonfaktoren bereits** — `SEASON_ECONOMY_FACTOR_WINDOW_SIZE = 5`, die Fenster tragen
die Labels `Aktuell`, `Season +1` … `Season +4` und werden beim Saisonwechsel durchgeschoben
(`advanceSeasonEconomyFactorWindow`). Diese Zahlen liegen im Spielstand und werden dem Spieler heute
nicht als Entscheidungsgrundlage vorgelegt.

---

## 2. Wann ist eine Saisonwirtschaft spannend?

### 2.1 Vier Fragen, die eine gute Wirtschaftsentscheidung beantwortet

1. **Kostet sie etwas, das ich nicht zurückholen kann?** Ohne Irreversibilität keine Spannung. Ein Kauf,
   den ich rückgängig machen kann, ist keine Entscheidung, sondern ein Menüpunkt.
2. **Weiß ich weniger, als ich gerne wüsste — aber genug, um zu urteilen?** Vollständige Information
   macht die Entscheidung zur Rechenaufgabe. Vollständige Unwissenheit macht sie zum Münzwurf. Der
   interessante Bereich ist die **Prognose mit Bandbreite**.
3. **Ist sie für mich anders richtig als für meinen Nachbarn?** Wenn eine Option für alle 32 Teams die
   beste ist, ist es keine Wahl, sondern ein Pflichtklick.
4. **Merke ich unterwegs, ob sie aufgeht?** Eine Entscheidung, deren Ergebnis erst am Saisonende
   sichtbar wird, erzeugt zehn Spieltage lang gar nichts.

Das heutige System beantwortet **keine** dieser vier Fragen mit Ja. Die Kartenwahl kostet nichts
Irreversibles, hat für alle denselben Erwartungswert, ist für jedes Team gleich zu bewerten, und ihr
Ergebnis fällt am Saisonende als Münzwurf.

### 2.2 Verwaltung vs. Spiel

| Verwaltung | Spiel |
|---|---|
| Ich klicke die Karte mit dem höchsten Erwartungswert. | Ich wähle zwischen Sicherheit und Ausschlag und weiß, dass ich falsch liegen kann. |
| Der Saisonfaktor passiert mir. | Ich habe mich gegen den Saisonfaktor positioniert. |
| Am Saisonende steht eine Zahl. | Am Saisonende steht eine Zahl, die ich vor zehn Spieltagen ausgerufen habe. |
| Ein guter Zug ist ein Zug, der immer gut ist. | Ein guter Zug ist einer, der zu meiner Lage passt. |

### 2.3 Woran merkt ein Spieler überhaupt, dass eine Saison stark oder schwach war?

Heute: **gar nicht**, außer an der Schlussabrechnung. Der Faktor ist ein unsichtbarer Würfel. Das ist
der größte Einzelverlust an Spielerfahrung im ganzen System, denn die Konjunktur ist die einzige Größe,
die alle Teams gleichzeitig und sichtbar betrifft — genau die Sorte Ereignis, um die man eine Saison
herum erzählen kann.

**Vorschlag, unabhängig vom gewählten Entwurf und mit dem größten Wirkung-pro-Aufwand-Verhältnis:**

* **Der Faktor bekommt einen Namen und eine Kurve.** „Ligajahr" mit drei bis fünf Stufen
  (`Flaute · gedämpft · normal · stark · Boom`) statt einer nackten Zahl.
* **Der Faktor wird zur Prognose mit Band.** Aus dem bereits vorhandenen Fenster: die laufende Saison
  exakt, `Season +1` als Band ±0,06, `Season +2` als Band ±0,12, `Season +3` als bloße Tendenz. Es muss
  **nichts** neu berechnet werden — die Werte existieren, sie werden nur nicht gezeigt.
* **Der Faktor wird während der Saison spürbar.** Nicht erst in der Schlussabrechnung: Ablösesummen,
  Gehaltsforderungen in Verhandlungen und Ausbaukosten atmen mit. Dann *fühlt* man das Ligajahr, statt
  es abzulesen.
* **Der Faktor bekommt ein Gedächtnis.** Zwei starke Saisons hintereinander erhöhen die
  Wahrscheinlichkeit für eine Flaute. Damit ist die Prognose eine *Einschätzung* und nicht eine
  Wettervorhersage, die man nur ablesen muss.

Ohne diesen Schritt bleibt jeder der drei Entwürfe unten wirkungslos: **man kann sich nicht gegen etwas
positionieren, das man nicht sieht.**

---

## 3. Das gemeinsame Fundament

Alle drei Entwürfe stehen auf denselben drei Bausteinen. Sie unterscheiden sich nur darin, **welche
Entscheidung** sie dem Spieler auf diese Bausteine legen.

Sei `w(r) = ((32 − r) / 31)^1,35` das Rangprofil (1,0 auf Platz 1, 0 auf Platz 32) und `f` der
Gehaltsfaktor.

| Baustein | Formel | Platz 1 | Platz 32 | Konjunktur? | Laufzeit |
|---|---|---:|---:|---|---|
| **Solidarpauschale** `S(r)` | `30 + 22 · (r−1)/31` | 30,0 | 52,0 | **nein** | jede Saison neu |
| **Grundvertrag** `G(r)` | `6 + 14 · w(r)` | 20,0 | 6,0 | wahlweise | **1–3 Saisons** |
| **Rangprämie** `P(r)` | `50 · w(r) · f` | 50,0 · f | 0 | **ja, voll** | jede Saison neu |

### 3.1 Warum die Solidarpauschale nach unten *steigt*

Das ist der einzige strukturelle Bruch mit dem heutigen System, und er trägt die halbe Anforderung.

Damit der Meister in einer schwachen Saison **verliert** und in einer neutralen ungefähr die schwarze
Null macht, muss ein sehr großer Teil seiner Einnahmen an der Konjunktur hängen. Das ist keine
Designmeinung, das ist Arithmetik: soll `Einnahme(0,82) < Gehalt` und `Einnahme(1,0) ≈ 1,04 · Gehalt`
gelten, dann muss der konjunkturbelastete Anteil `e` die Ungleichung `1 − 0,18·e < 1/1,04` erfüllen,
also `e > 0,21` — und je größer die neutrale Marge sein soll, desto größer `e`. Bei einer Marge von
17 % (wie heute im Live-Save für die Top 8) wäre `e > 0,81`.

Umgekehrt gilt für das Schlusslicht: „immer abgesichert" heißt `Einnahme(0,82) ≥ Gehalt`, also
möglichst **kein** konjunkturbelasteter Anteil.

> **Regel: Der garantierte Anteil sinkt mit dem Erfolg.** Der Meister lebt fast vollständig von der
> Konjunktur, der Letzte fast vollständig von der Pauschale. Das ist zugleich die wirtschaftliche
> Geschichte (Sponsoren zahlen Siegern für Siege und kleinen Klubs eine Solidarabgabe) und die
> Mechanik des Gummibands, das im alten Preisgeld gefehlt hat.

Bemerkenswert: **der Live-Save macht das bereits ansatzweise** — der Sponsorsockel läuft schon invers
von 44,2 (Platz 1) auf 54,7 (Platz 32). Der Ausgleich ist mit 10,5 nur zu klein gegen eine
Gesamtstreuung von 76,2, und er wird von 12,5 C unerklärter Kartenstreuung wieder zugedeckt.

### 3.2 Bausteine je Rang (Grundvertrag fest, mit 3 % Sicherheitsabschlag)

| Rang | Solidarpauschale | Grundvertrag | Rangprämie 0,82 / 1,00 / 1,24 | **Summe** 0,82 / 1,00 / 1,24 |
|---:|---:|---:|---:|---:|
| 1 | 30,0 | 19,4 | 41,0 / 50,0 / 62,0 | **90,4 / 99,4 / 111,4** |
| 2 | 30,7 | 18,8 | 39,2 / 47,8 / 59,3 | 88,7 / 97,4 / 108,8 |
| 4 | 32,1 | 17,7 | 35,7 / 43,6 / 54,0 | 85,5 / 93,4 / 103,8 |
| 8 | 35,0 | 15,4 | 29,0 / 35,4 / 43,9 | 79,4 / 85,8 / 94,3 |
| 12 | 37,8 | 13,3 | 22,7 / 27,7 / 34,3 | 73,8 / 78,8 / 85,5 |
| 16 | 40,6 | 11,4 | 16,8 / 20,5 / 25,4 | 68,8 / 72,5 / 77,4 |
| 20 | 43,5 | 9,6 | 11,4 / 13,9 / 17,2 | 64,5 / 67,0 / 70,3 |
| 24 | 46,3 | 8,0 | 6,6 / 8,0 / 10,0 | 60,9 / 62,4 / 64,3 |
| 28 | 49,2 | 6,7 | 2,6 / 3,2 / 3,9 | 58,4 / 59,0 / 59,7 |
| 32 | 52,0 | 5,8 | 0 / 0 / 0 | **57,8 / 57,8 / 57,8** |

Ligasumme bei `f = 1,0`: **2369,0** gegen 2394,9 im Live-Save — der Geldfluss der Liga bleibt also
praktisch unverändert, es ändert sich nur die Verteilung. Bei `f = 0,82` sind es 2245,7, bei `f = 1,24`
2533,3: **die Liga schwankt um ±6 % statt um ±24 %** wie im heutigen Modell, weil der garantierte Teil
faktorfrei ist. Der Ausschlag konzentriert sich dort, wo er hingehört — an der Spitze.

### 3.3 Zum Korridor „40 bis 100"

Der Wunsch nach einem Spielraum von 40 bis 100 ist mit den anderen drei Anforderungen **innerhalb einer
Saison nicht vereinbar**, und das lässt sich beziffern. Die echten Gehälter reichen von 35,4 bis 97,7,
im Gruppenschnitt von 49,3 (letzte 8) bis 78,8 (Top 8). Ein Rangkorridor von 40 bis 100 heißt: das
Schlusslicht bekommt 40 bei einem Gehalt von im Schnitt 49,3 — es verliert **jede Saison** rund 9, egal
was es tut. Das ist das Gegenteil von „schwache Teams sind immer abgesichert".

Auflösung, und sie ist die eigentliche Antwort auf „Spielraum, in dem man sich bewegt":

> **Der Rang allein spannt 58 … 99. Die 40 … 120 spannt der Spieler selbst — durch Deklaration,
> Kopplung und Laufzeit.** Der weite Korridor ist ein *Entscheidungskorridor*, kein Zuteilungskorridor.

Genau das ist der Unterschied zwischen einer Wirtschaft, die einem passiert, und einer, die man spielt.

### 3.4 Vorausgesetzte Zielspreizung

Die Entwürfe sind auf die **im Live-Save gemessene Spreizung von 2,76×** (35,4 … 97,7, Median 65)
kalibriert und darauf, dass Gehalt und Endrang stark korrelieren (−0,82). Abschnitt 5 rechnet zusätzlich
ein Szenario mit **2,9× und linearer Rang-Gehalts-Kopplung** (97,5 … 35,5), also einer sauberen
Arm-/Reich-Achse ohne das Rauschen der echten Tabelle. Unterhalb einer Spreizung von etwa **2,0×** wird
die Rangprämie zum reinen Bonus statt zum Risiko — dann trägt kein Entwurf mehr.

---

## 4. Die drei Entwürfe

### Entwurf A — „Laufzeit"

**Die Entscheidung ist ZEIT.**

Der Grundvertrag wird über **1, 2 oder 3 Saisons** unterschrieben, und beim Unterschreiben wählt man
zwischen zwei Konditionen:

* **fest** — der Nennwert steht, die Konjunktur berührt ihn nicht. Preis der Gewissheit: **−3 %**.
* **gekoppelt** — der Nennwert läuft mit `f` mit. Voller Ausschlag nach oben und unten.

Solidarpauschale und Rangprämie bleiben für alle gleich.

| | |
|---|---|
| **Entscheidung in Woche 1** | Wie lange binde ich mich, und binde ich mich an einen *Betrag* oder an die *Konjunktur*? Grundlage ist das Prognoseband aus Abschnitt 2.3. Ein 3-Jahres-Festvertrag mitten im Boom ist die beste Entscheidung des Spiels — und mitten in der Flaute die schlechteste. |
| **Entscheidung am Saisonende** | Verlängern oder auslaufen lassen. Ein auslaufender Vertrag im Boom ist bares Geld; einer, der in der Flaute ausläuft, zwingt zur Unterschrift zu schlechten Konditionen. |
| **Reue nach drei Saisons** | „Ich habe drei Jahre fest unterschrieben, und dann kam der Boom." Oder: „Ich bin frei geblieben und in die Flaute gelaufen." Genau diese zwei Sätze soll der Spieler sagen können. |

**Stärke:** minimal-invasiv, jede Zahl bleibt nachvollziehbar, die Entscheidung ist in einem Satz
erklärbar. **Schwäche:** die Entscheidung ist für alle Teams *derselben Art* — sie unterscheidet sich
nur in der Risikoneigung, nicht im Inhalt. Für ein Team, das ohnehin keine Reserven hat, gibt es
faktisch nur eine Antwort (fest).

---

### Entwurf B — „Ambition ausrufen"

**Die Entscheidung ist eine DEKLARATION.**

Vor Spieltag 1 ruft jedes Team eine von drei Ambitionen aus. Die Deklaration ist **öffentlich**,
**bindet für zwei Saisons** und schichtet die eigenen Einnahmen zwischen dem garantierten und dem
konjunkturbelasteten Teil um:

| Deklaration | Umschichtung `d` | Einsatz | Boden | Gebühr |
|---|---:|---|---:|---:|
| **Aufbau** | −0,60 | 60 % der Rangprämie wird in Garantie umgewandelt | **62** | — |
| **Konsolidierung** | 0 | unverändert | 58 | — |
| **Titeljagd** | +1,00 | die Rangprämie wird **noch einmal eingesetzt** — bezahlt aus Pauschale und Grundvertrag | 54 | 4,0 |

Formel: `Einnahme = max(Boden, [S(r) + G(r) − d·P(r) − Gebühr] + P(r)·(1+d)·f)`

Bei `f = 1,0` zahlen Aufbau und Konsolidierung auf jedem Rang **exakt dasselbe** — die Wahl ist eine
reine Risikowahl, keine Erwartungswertwahl. Die Titeljagd kostet 4,0; das ist der Preis der Option, und
er finanziert den erhöhten Boden der Aufbau-Teams. Wer den Ausschlag will, bezahlt die Absicherung der
anderen.

**Was Titeljagd auf Platz 1 bedeutet:** Solidarpauschale 30,0 + Grundvertrag 20,0 − Einsatz 50,0 −
Gebühr 4,0 = **−4,0 garantiert**, dazu **2 × 50 × f** Rangprämie. Das gesamte gesicherte Einkommen
liegt auf dem Tisch.

**Deklaration gegen Endrang (Einnahmen):**

| Faktor | Deklaration | Rang 1 | 5 | 12 | 20 | 32 |
|---|---|---:|---:|---:|---:|---:|
| **0,82** | Aufbau | 96,4 | 89,0 | 77,2 | 66,3 | 62,0 |
| 0,82 | Konsolidierung | 91,0 | 84,5 | 74,2 | 64,8 | 58,0 |
| 0,82 | **Titeljagd** | **78,0** | 73,0 | 65,3 | 58,3 | 54,0 |
| **1,00** | Aufbau | 100,0 | 91,9 | 79,2 | 67,3 | 62,0 |
| 1,00 | Konsolidierung | 100,0 | 91,9 | 79,2 | 67,3 | 58,0 |
| 1,00 | Titeljagd | 96,0 | 87,9 | 75,2 | 63,3 | 54,0 |
| **1,24** | Aufbau | 104,8 | 95,9 | 81,9 | 68,6 | 62,0 |
| 1,24 | Konsolidierung | 112,0 | 101,9 | 85,9 | 70,6 | 58,0 |
| 1,24 | **Titeljagd** | **120,0** | 107,9 | 88,5 | 69,9 | 54,0 |

Ein Team auf Platz 1 mit einem Gehalt von 95,7 macht mit Titeljagd **−17,7 in der Flaute und +24,3 im
Boom** — eine Spannweite von 42. Mit Aufbau macht dasselbe Team +0,7 bzw. +9,1 — Spannweite 8,4. Das
ist der Spielraum, in dem sich der Spieler bewegen soll.

Und die Strafe für Überschätzung ist scharf: wer Titeljagd ausruft und auf Rang 20 landet, bekommt 58,3
statt 64,8. Über zwei Saisons Bindung ist das ein spürbarer Fehler, den man nicht wegklicken kann.

| | |
|---|---|
| **Entscheidung in Woche 1** | Glaube ich an diesen Kader — *dieses Jahr*? Die Deklaration ist ein Kader-Urteil, kein Finanzklick, und sie ist öffentlich: man sieht, wer sonst noch Titeljagd ruft. |
| **Entscheidung am Saisonende** | Keine — die Bindung läuft. Genau das macht sie wertvoll: die Entscheidung wird *ausgehalten*, nicht revidiert. |
| **Reue nach drei Saisons** | „Ich habe zwei Jahre Titeljagd ausgerufen, dann zwei Flauten bekommen und den Kader nicht mehr halten können." Oder: „Ich habe drei Jahre auf Aufbau gespielt, die Boom-Saison mitgenommen und trotzdem nichts verdient." |

**Stärke:** die einzige der drei Varianten, die die Forderung „Top verdient gut in starken Saisons und
verliert in schwachen" **wörtlich** erfüllt, und die einzige, in der die Entscheidung eine sportliche
Aussage ist statt einer finanziellen. **Schwäche:** für Teams am Tabellenende ist die Rangprämie fast
null — sie haben nichts umzuschichten. Ihre Deklaration entscheidet nur über den Boden (54 / 58 / 62)
und ist damit fast trivial („Aufbau natürlich").

---

### Entwurf C — „Vertragsstapel"

**Die Entscheidung ist die MISCHUNG über die Zeit.**

Statt eines Sponsors gibt es **drei Slots** — Haupt (45 %), Neben (35 %), Ausrüster (20 %) — die sich die
Rangprämie teilen. Jeder Slot trägt zwei eigene Konditionen:

* **Laufzeit** 1 bis 3 Saisons — dadurch laufen die Slots gestaffelt aus.
* **Kopplungsgrad** `k` ∈ {0, ½, 1}: `k = 1` läuft mit der aktuellen Konjunktur, `k = 0` friert den
  Faktor der Unterschriftssaison ein — mit **8 % Abschlag** als Preis der Gewissheit.

Effektiver Faktor eines Slots: `k·f_aktuell + (1−k)·0,92·f_Unterschrift`.

Damit ist die Gesamtexposition des Teams eine **Zahl zwischen 0 und 100 %**, die der Spieler über
mehrere Saisons steuert — er kann sie nie in einem Zug umwerfen, sondern nur über den gerade
auslaufenden Slot verschieben.

**Vier Saisons, Faktorfolge 1,18 / 0,86 / 1,24 / 0,91, Platz 1, Gehalt 95,7** (kumuliertes GuV in
Klammern):

| Strategie | S1 (1,18) | S2 (0,86) | S3 (1,24) | S4 (0,91) |
|---|---|---|---|---|
| alles frei | 109,0 (+13,3) | 93,0 (+10,6) | 112,0 (+26,9) | 95,5 (**+26,7**) |
| gestaffelt | 106,9 (+11,2) | 96,9 (+12,3) | 99,7 (+16,3) | 94,1 (**+14,7**) |
| alles im Boom eingefroren | 104,3 (+8,6) | 104,3 (+17,2) | 104,3 (+25,7) | 104,3 (**+34,3**) |

Über vier Saisons trennen die beste und die schlechteste Stapelstrategie **19,6 C** — das ist ein
Fünftel eines Meistergehalts, allein aus Vertragsdisposition. Und es ist eine echte Wette: wer im
ersten Boom alles einfriert, gewinnt hier, hätte aber bei drei starken Saisons in Folge verloren.

| | |
|---|---|
| **Entscheidung in Woche 1** | Welchen der auslaufenden Slots verlängere ich, wie lange, und friere ich ihn ein? Der Blick geht ins Prognoseband. |
| **Entscheidung am Saisonende** | Dieselbe, ein Slot weiter — es ist ein **Rhythmus**, kein Einzelereignis. Das ist der eigentliche Reiz: jede Saison eine kleine Version derselben Entscheidung. |
| **Reue nach drei Saisons** | „Ich habe in der Flaute alles langfristig eingefroren und drei Jahre unter Wert gearbeitet." |

**Stärke:** die einzige Variante, in der Mehrjahresverträge *strukturell* im Mittelpunkt stehen statt nur
mitzulaufen; sie produziert eine wiederkehrende, gleichbleibend interessante Entscheidung.
**Schwäche:** sie glättet. Bei gestaffelten, teils eingefrorenen Slots schwankt die Einnahme des Meisters
über den vollen Faktorbereich nur noch zwischen 101,6 und 105,8 — und damit ist die Forderung „in
schwachen Saisons auch verlieren" **nicht mehr erfüllt**. Der Spieler kauft sich mit klugem Stapeln
genau die Spannung weg, die das System erzeugen soll. Zudem sind drei Slots × zwei Konditionen ×
32 Teams eine UI, die man erklären muss.

---

## 5. Die Durchrechnung

Alle Tabellen gegen die **32 Teams des bespielten Saves**, jeweils bei Gehaltsfaktor 0,82 / 1,00 / 1,24.
GuV = Einnahmen − Gehaltssumme.

### 5.1 Entwurf A — Grundvertrag fest

| Pl | Team | Gehalt | 0,82 | GuV | 1,00 | GuV | 1,24 | GuV |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mayhem Mavericks | 95,7 | 90,4 | **−5,3** | 99,4 | +3,7 | 111,4 | **+15,7** |
| 2 | Cold Steel | 69,6 | 88,7 | +19,1 | 97,4 | +27,8 | 108,8 | +39,2 |
| 3 | Raging Lunatics | 80,1 | 87,1 | +7,0 | 95,3 | +15,2 | 106,3 | +26,2 |
| 4 | Project Suicide | 78,0 | 85,5 | +7,5 | 93,4 | +15,4 | 103,8 | +25,8 |
| 5 | Zero Heroes | 97,7 | 84,0 | −13,7 | 91,4 | −6,3 | 101,4 | +3,7 |
| 6 | Silver Soldiers | 66,9 | 82,4 | +15,5 | 89,5 | +22,6 | 99,0 | +32,1 |
| 7 | Wrecking Legionnaires | 75,2 | 80,9 | +5,7 | 87,6 | +12,4 | 96,6 | +21,4 |
| 8 | Golden Gladiators | 67,1 | 79,4 | +12,3 | 85,8 | +18,7 | 94,3 | +27,2 |
| 9 | Hell Raisers | 76,3 | 78,0 | +1,7 | 84,0 | +7,7 | 92,0 | +15,7 |
| 10 | Black Panthers | 80,9 | 76,6 | −4,3 | 82,2 | +1,3 | 89,8 | +8,9 |
| 11 | Natures Wrath | 65,0 | 75,2 | +10,2 | 80,5 | +15,5 | 87,6 | +22,6 |
| 12 | Last Ride | 79,8 | 73,8 | −6,0 | 78,8 | −1,0 | 85,5 | +5,7 |
| 13 | Wicked Wizards | 69,3 | 72,5 | +3,2 | 77,2 | +7,9 | 83,4 | +14,1 |
| 14 | Nunchuck Ninjas | 77,2 | 71,2 | −6,0 | 75,6 | −1,6 | 81,3 | +4,1 |
| 15 | Terrible Teachers | 70,4 | 70,0 | −0,4 | 74,0 | +3,6 | 79,3 | +8,9 |
| 16 | Vigorous Vikings | 64,0 | 68,8 | +4,8 | 72,5 | +8,5 | 77,4 | +13,4 |
| 17 | Vicious & Delicious | 65,2 | 67,7 | +2,5 | 71,0 | +5,8 | 75,5 | +10,3 |
| 18 | The Chantry | 42,9 | 66,5 | +23,6 | 69,6 | +26,7 | 73,7 | +30,8 |
| 19 | The Giants | 68,2 | 65,5 | −2,7 | 68,3 | +0,1 | 72,0 | +3,8 |
| 20 | Death Peaches | 55,2 | 64,5 | +9,3 | 67,0 | +11,8 | 70,3 | +15,1 |
| 21 | Cash Creators | 41,8 | 63,5 | +21,7 | 65,7 | +23,9 | 68,7 | +26,9 |
| 22 | Mortal Sin | 52,4 | 62,6 | +10,2 | 64,5 | +12,1 | 67,1 | +14,7 |
| 23 | Lost Kingdom | 61,2 | 61,7 | +0,5 | 63,4 | +2,2 | 65,7 | +4,5 |
| 24 | Dire Legion | 49,4 | 60,9 | +11,5 | 62,4 | +13,0 | 64,3 | +14,9 |
| 25 | Blazing Beasts | 53,4 | 60,2 | +6,8 | 61,4 | +8,0 | 63,0 | +9,6 |
| 26 | Royal Court | 57,6 | 59,5 | +1,9 | 60,5 | +2,9 | 61,8 | +4,2 |
| 27 | Armageddon Aftermath | 51,9 | 58,9 | +7,0 | 59,7 | +7,8 | 60,7 | +8,8 |
| 28 | Vigilante Wranglers | 40,3 | 58,4 | +18,1 | 59,0 | +18,7 | 59,7 | +19,4 |
| 29 | Riptide Rivers | 35,4 | 58,0 | +22,6 | 58,4 | +23,0 | 58,9 | +23,5 |
| 30 | Pirate Crew | 52,6 | 57,7 | +5,1 | 58,0 | +5,4 | 58,3 | +5,7 |
| 31 | Stronghold Crusaders | 48,8 | 57,6 | +8,8 | 57,7 | +8,9 | 57,8 | +9,0 |
| 32 | Undercover Agents | 54,1 | 57,8 | +3,7 | 57,8 | +3,7 | 57,8 | +3,7 |
| | **Liga** | **2043,6** | **2245,7** | +202,1 | **2369,0** | +325,4 | **2533,3** | +489,7 |

### 5.2 Die GuV-Verschiebung zwischen Top 8 und letzten 8

Das ist die Kennzahl, die zählt. **Live-Save heute: Top 8 +21,7 · Mitte +11,2 · letzte 8 −1,3.**

| Modell | Ø Gehalt Top 8 / Mitte / letzte 8 | GuV Top 8 (0,82 / 1,00 / 1,24) | GuV Mitte | GuV letzte 8 | Spannweite Top 8 | Spannweite letzte 8 |
|---|---|---|---|---|---:|---:|
| **IST (Live)** | 78,8 / 63,7 / 49,3 | — / +21,7 / — | +11,2 | −1,3 | — | — |
| **A — fest** | 78,8 / 63,7 / 49,3 | +6,0 / +13,7 / +23,9 | +5,0 / +8,6 / +13,4 | +9,3 / +9,8 / +10,5 | **17,9** | **1,2** |
| **A — gekoppelt** | 78,8 / 63,7 / 49,3 | +3,3 / +14,2 / +28,8 | +3,2 / +8,9 / +16,5 | +8,3 / +10,0 / +12,3 | **25,5** | **4,0** |
| **B — Deklaration** | 78,8 / 63,7 / 49,3 | **−5,1** / +10,2 / **+30,7** | +5,5 / +8,9 / +13,6 | +12,7 / +12,7 / +12,8 | **35,8** | **0,1** |
| **C — voll frei** | 78,8 / 63,7 / 49,3 | +6,6 / +14,2 / +24,5 | +5,3 / +8,9 / +13,8 | +9,5 / +10,0 / +10,7 | 17,9 | 1,2 |
| **C — im Boom eingefroren** | 78,8 / 63,7 / 49,3 | +15,6 / +17,2 / +19,2 | +9,6 / +10,3 / +11,3 | +10,1 / +10,2 / +10,3 | **3,6** | 0,2 |
| **C — in der Flaute eingefroren** | 78,8 / 63,7 / 49,3 | +5,6 / +7,1 / +9,2 | +4,9 / +5,6 / +6,6 | +9,4 / +9,5 / +9,7 | **3,6** | 0,3 |

Lesart:

* **Die letzten 8 sind in jedem Entwurf abgesichert** — GuV zwischen +8,3 und +12,8, Spannweite über
  den gesamten Faktorbereich höchstens 4,0 (bei A gekoppelt) bzw. **0,1 bei B**. Gegenüber dem
  heutigen −1,3 ist das eine Verbesserung von rund 11 C je Team und Saison.
* **Nur B lässt die Spitze in der Flaute wirklich verlieren** (−5,1 im Schnitt der Top 8, für den
  Meister persönlich −17,7). A gekoppelt kommt mit +3,3 nah heran; A fest bleibt mit +6,0 zu bequem.
* **C im eingefrorenen Zustand zerstört die Anforderung**: Spannweite 3,6 bei der Spitze. Der Spieler
  kann sich die Konjunktur wegkaufen — und tut es dann auch, weil es sich rechnet.
* Die Ligasumme bleibt in allen Varianten zwischen 2245 und 2637 und damit im Bereich der heutigen
  2394,9. Es wird nichts weggenommen, es wird umverteilt.

### 5.3 Szenario 2 — Gehaltsspreizung 2,9× mit sauberer Rangkopplung

Die echte Tabelle hat viel Rauschen: Undercover Agents zahlen als Letzter 54,1, The Chantry als
Achtzehnter nur 42,9. Für das zweite Szenario werden die Gehälter linear an den Rang gekoppelt
(**97,5 auf Platz 1 … 35,5 auf Platz 32**, Spreizung 2,75–2,9×), Ligasumme 2128. Das ist die Welt, die
der Nutzer sich wünscht: klare Arm-/Reich-Achse.

| Modell | GuV Top 8 (0,82 / 1,00 / 1,24) | GuV Mitte | GuV letzte 8 |
|---|---|---|---|
| **A — fest** | **−5,7** / +2,0 / +12,2 | +2,2 / +5,8 / +10,6 | +16,0 / +16,6 / +17,3 |
| **B — Deklaration** | **−16,8** / −1,5 / +19,0 | +2,7 / +6,1 / +10,8 | +19,5 / +19,5 / +19,5 |

Mit sauberer Spreizung erfüllt **auch A** die Anforderung: die Spitze verliert in der Flaute (−5,7),
macht in der neutralen Saison die schwarze Null (+2,0) und verdient im Boom (+12,2), während das
Tabellenende konstant +16 bis +17 einfährt. Das ist genau die Kurve, die gewünscht war — und sie
entsteht **nicht** durch mehr Regeln, sondern dadurch, dass die Gehälter dem Rang folgen.

> **Wichtiger Nebenbefund:** Die Entwürfe sind gegen die Gehaltsspreizung empfindlicher als gegen jede
> eigene Stellschraube. Wer die Wirtschaft interessanter machen will, sollte zuerst dafür sorgen, dass
> starke Teams wirklich teurer sind als schwache — das kostet keine Regel und wirkt stärker als jede
> Kurvenänderung.

### 5.4 Vier Saisons — Faktorfolge 1,18 / 0,86 / 1,24 / 0,91

**Entwurf A** (kumuliertes GuV in Klammern):

| | S1 (1,18) | S2 (0,86) | S3 (1,24) | S4 (0,91) |
|---|---|---|---|---|
| Meister, fest (Gehalt 95,7) | 108,4 (+12,7) | 92,4 (+9,4) | 111,4 (+25,1) | 94,9 (**+24,3**) |
| Meister, gekoppelt | 112,6 (+16,9) | 90,2 (+11,4) | 116,8 (+32,5) | 93,7 (**+30,5**) |
| Letzter, fest (Gehalt 54,1) | 57,8 (+3,7) | 57,8 (+7,4) | 57,8 (+11,2) | 57,8 (**+14,9**) |
| Letzter, gekoppelt | 59,1 (+5,0) | 57,2 (+8,0) | 59,4 (+13,4) | 57,5 (**+16,7**) |

Der Meister erlebt zwei magere und zwei fette Jahre und muss durch die mageren durchkommen; der Letzte
hat einen Strich, auf den er bauen kann. Genau das war die Anforderung.

**Entwurf B**, Rang 1, Gehalt 95,7:

| Deklaration | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| Aufbau | 103,6 (+7,9) | 97,2 (+9,4) | 104,8 (+18,5) | 98,2 (**+21,0**) |
| Konsolidierung | 109,0 (+13,3) | 93,0 (+10,6) | 112,0 (+26,9) | 95,5 (**+26,7**) |
| Titeljagd | 114,0 (+18,3) | **82,0 (+4,6)** | 120,0 (+28,9) | 87,0 (**+20,2**) |

Die Titeljagd führt nach S1 mit +18,3 und liegt nach S2 bei +4,6 — sie hat in einer einzigen schwachen
Saison 13,7 verloren, während Aufbau nur +1,5 gewonnen hat. Am Ende der vier Saisons liegt
Konsolidierung vorn: die Faktorfolge war zu ausgeglichen für die Wette. **Das ist die Reue, um die es
geht** — nicht ein Rechenfehler, sondern eine Einschätzung, die nicht aufging.

**Entwurf B**, Rang 20 — Titeljagd ausgerufen, Rang nicht geholt, Gehalt 55,2:

| Deklaration | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| Konsolidierung | 69,8 (+14,6) | 65,3 (+24,7) | 70,6 (+40,1) | 66,0 (**+50,9**) |
| Titeljagd | 68,3 (+13,1) | 59,4 (+17,2) | 69,9 (+31,9) | 60,8 (**+37,5**) |

13,4 C Unterschied über vier Saisons für eine Fehleinschätzung des eigenen Kaders. Spürbar, aber nicht
existenzbedrohend — das ist die richtige Größenordnung für einen Fehler, den man wiederholen können soll.

---

## 6. Mockups

Je Entwurf eine eigenständige, vollständig inline gehaltene HTML-Datei (keine externen Schriften,
Skripte oder Bilder). Alle Zahlen stammen aus der Durchrechnung oben.

| Datei | Inhalt |
|---|---|
| `mockups-spielerfahrung/entwurf-a-laufzeit.html` | Vertragswahl mit Laufzeit und Kopplung, starke gegen schwache Saison |
| `mockups-spielerfahrung/entwurf-b-ambition.html` | Deklarationsbildschirm vor Spieltag 1, drei Ambitionen nebeneinander |
| `mockups-spielerfahrung/entwurf-c-vertragsstapel.html` | Drei Slots mit Laufzeit und Kopplungsgrad, Vierjahresverlauf |

Jedes Mockup zeigt links die **starke Saison (Faktor 1,24)** und rechts die **schwache Saison
(Faktor 0,82)** derselben Entscheidung, dazu das Konjunktur-Prognoseband aus Abschnitt 2.3.

---

## 7. Ehrliche Bewertung

### 7.1 Empfehlung

**Entwurf B — „Ambition ausrufen", auf dem Fundament aus Abschnitt 3, plus dem sichtbaren Ligajahr aus
Abschnitt 2.3.**

Begründung, in der Reihenfolge ihrer Wichtigkeit:

1. **Er ist der einzige, der die Anforderung wörtlich erfüllt.** Top 8 in der Flaute −5,1, im Boom
   +30,7; letzte 8 konstant +12,7 mit einer Spannweite von 0,1. Kein anderer Entwurf schafft beides
   gleichzeitig.
2. **Die Entscheidung ist eine sportliche, keine finanzielle.** „Glaube ich an diesen Kader?" ist eine
   Frage, die ein Spieler beantworten *will*. „Fest oder variabel?" ist eine, die er beantworten *muss*.
3. **Sie ist irreversibel und öffentlich.** Zwei Saisons Bindung, für alle sichtbar. Das erzeugt
   Geschichten und macht aus der Zahl am Saisonende eine Pointe.
4. **Sie ist in einem Satz erklärbar** und braucht genau einen neuen Bildschirm.

Entwurf A ist der richtige **erste Schritt**, wenn wenig Zeit ist: das Fundament allein (Solidarpauschale
+ Grundvertrag + Rangprämie) beseitigt bereits die 52,8 % unerklärter Streuung und sichert das
Tabellenende ab. B lässt sich später darauf aufsetzen, ohne die Bausteine zu ändern.

Entwurf C **empfehle ich nicht**, obwohl er handwerklich der eleganteste ist. Er belohnt genau das
Verhalten, das die Spannung tötet: wer klug staffelt und einfriert, drückt die Spannweite seiner
Einnahmen von 17,9 auf 3,6 und hat danach eine ruhige, langweilige Wirtschaft. Ein System, dessen
optimales Spiel darin besteht, das Interessante wegzuoptimieren, ist falsch gebaut.

### 7.2 Was Entwurf B NICHT erfüllt

* **Der Korridor 40 bis 100 wird durch den Rang allein nicht erreicht.** Der Rangkorridor liegt bei
  58 … 99. Die 54 … 120 entstehen erst durch die Deklaration. Wer den weiten Korridor als *Zuteilung*
  will, bekommt ihn nur, indem das Tabellenende auf 40 gesetzt wird — und dann verliert es bei einem
  durchschnittlichen Gehalt von 49,3 jede Saison rund 9. Das ist unvereinbar mit „schwache Teams sind
  immer abgesichert". Ich habe mich für die Absicherung entschieden.
* **Für die letzten acht Teams ist die Deklaration fast keine Entscheidung.** Ihre Rangprämie ist nahe
  null; es bleibt die Wahl des Bodens (54 / 58 / 62), und „Aufbau" ist fast immer richtig. Das ist der
  ehrlichste Schwachpunkt des Entwurfs: **das Spiel wird für schwache Teams sicherer, aber nicht
  interessanter.** Eine Idee dagegen — im Entwurf bewusst nicht ausgearbeitet, weil sie neue Regeln
  bräuchte: die Aufbau-Deklaration könnte statt Geld **Zeit** kaufen (längere Vertragsbindung für
  eigene Talente, günstigere Nachwuchsslots). Dann hätten Kellerteams eine eigene Währung.
* **Die Titeljagd-Gebühr von 4,0 ist nicht erwartungswertneutral.** Sie kostet, was sie kostet, und
  finanziert die Böden der Aufbau-Teams. Wer strikte EV-Neutralität aller Optionen als Prinzip haben
  will, bekommt sie hier nicht. Ich halte das für richtig — Optionen sollen etwas kosten — aber es ist
  ein Bruch mit der Linie von V3/V4.
* **Der Platzierungsbonus bleibt ein Würfel.** Die Messung aus 1.2 (Korrelation rankDiff ↔ Gehalt
  = −0,16) sagt: Bewegung entsteht heute nicht aus wirtschaftlichen Entscheidungen. Kein Entwurf dieses
  Dokuments repariert das, weil es nicht in der Wirtschaft sitzt, sondern in der Ergebnissimulation.
  **Solange das so bleibt, bezahlt jeder Platzierungsbonus Glück.** Das ist aus meiner Sicht der
  wichtigste offene Punkt des ganzen Systems — wichtiger als jede Kurvenfrage.

### 7.3 Wo sich der Nutzer etwas wünscht, das sich gegenseitig ausschließt

**Erstens: „Korridor 40–100" gegen „schwache Teams immer abgesichert".**
Gemessene Gehälter der letzten acht Teams: 49,3 im Schnitt, bis 57,6 im Einzelfall. Ein Einnahmenboden
von 40 heißt strukturelles Minus für genau die Teams, die geschützt werden sollen. Entweder der Boden
steigt auf ~58, oder die Absicherung fällt. Beides zugleich geht nur, wenn die Gehälter am
Tabellenende deutlich sinken — was wieder von der Gehaltsspreizung abhängt (Abschnitt 5.3).

**Zweitens: „Top-Teams sollen gut verdienen" gegen „Top-Teams sollen auch verlieren können".**
Das schließt sich nicht aus, aber es legt fest, was in der **neutralen** Saison passieren muss: die
schwarze Null. Sonst braucht der Absturz in der Flaute eine so große Konjunkturexposition, dass der
Meister praktisch kein garantiertes Einkommen mehr hat. Im Live-Save macht der Meister −0,1 — das ist
**kein Fehler, sondern genau der richtige Zielwert**. Der Fehler ist, dass der Achte +47,5 macht.

**Drittens: „Salary Factor soll bleiben" gegen „das alte Gummiband".**
Das alte Preisgeld war ein Gummiband, weil die Einnahmen gedeckelt waren, während die Kosten frei
wählbar blieben. Der Gehaltsfaktor ist etwas anderes — er ist ein **Multiplikator auf alle**, und ein
Multiplikator gleicht nichts aus, er verstärkt. Solange der Faktor multiplikativ wirkt, kommt das
Gummiband nicht vom Faktor, sondern **nur** von der Form der Rangkurve: flach unten, steil oben, mit
einem faktorfreien Boden. Der Faktor liefert die Spannung, die Kurvenform liefert den Ausgleich. Beides
im selben Regler unterbringen zu wollen, ist die eigentliche Ursache dafür, dass das heutige System
weder das eine noch das andere richtig tut.

**Viertens, und am unbequemsten: „mehr Flexibilität" gegen „berechenbar sein".**
Jeder zusätzliche Baustein vergrößert den Raum, in dem der Spieler sich bewegen kann — und macht es
zugleich schwerer, am Saisonende zu sagen, *warum* eine Zahl herausgekommen ist. Der Live-Save zeigt
das Endstadium: 52,8 % unerklärte Streuung. Mein Rat ist deshalb, die Flexibilität in **wenige, große,
sichtbare** Entscheidungen zu legen (eine Deklaration, eine Laufzeit) statt in viele kleine
Modifikatoren. Drei Bausteine und eine Wahl schlagen sechs Bausteine und vier Wahlen — nicht weil es
einfacher ist, sondern weil man es am Saisonende noch erzählen kann.

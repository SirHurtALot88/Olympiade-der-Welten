# Triage der Meldungen vom 14.08. — Tickets #32 bis #44

13 Meldungen aus dem Spiel, alle aus `Oly New Game Custom 13.8.2026` (Saison 1, Spieltag 9–10).

**Diese Datei ist die Uebersicht, nicht die Quittung.** Je Meldung liegt eine eigene
Triage-Datei daneben (`bug-2026-08-14T*.md`) — dort steht der Befund im Detail und der Status.
Hier steht, was zusammengehoert und in welcher Reihenfolge es sinnvoll ist. Zwei Ablagen fuer
denselben Vorgang waeren sonst genau der Fehlertyp, den die Haelfte dieser Meldungen beschreibt.

## Stand

| Ticket | Thema | Status |
|---|---|---|
| #32 | All-Time-Zeile zaehlt PP/Verletzungen/MW nicht | offen |
| #33 | VK-Anzeige eigenes Team schlechter als fremdes | offen |
| #34 | Verletzungs-Spalte im Saisonstand | **behoben** |
| #35 | Arena: Spieler auf ihrem Slot | **behoben** |
| #36 | Trainingshistorie: trainierte Klasse | **behoben** |
| #37 | KI managt Muedigkeit schlecht bei duennem Kader | offen (erst messen) |
| #38 | VK-Faktor ab 8 Spielern | offen |
| #39 | KI-Training ignoriert Ermuedung | offen (erst messen) |
| #40 | Training-Netto ≠ Profil-Forecast | **behoben** |
| #41 | Awards im Spielerprofil | offen (eigenes Vorhaben) |
| #42 | Top-Player-Liste auf 24 | offen |
| #43 | negativer Cash rot | **behoben** |
| #44 | VK gegen Marktwert: zwei Zahlen | **behoben** |

Sechs von dreizehn behoben. Was offen ist, ist es aus einem der drei Gruende: es fehlt eine
Entscheidung von Chris, es fehlt eine Messung, oder es ist ein eigenes Vorhaben.

**Warum eine Sammeltriage:** vier der Meldungen beschreiben denselben Fehlertyp (zwei Zahlen fuer
dieselbe Sache), drei denselben Bereich (KI-Ermuedung). Getrennt abgelegt haette man den
Zusammenhang erst wiederfinden muessen.

---

## A. Echte Fehler — zwei Rechenstellen für dieselbe Zahl

Der teuerste Fehlertyp in diesem Projekt: nicht eine falsche Zahl, sondern **zwei Zahlen, die
beide behaupten, dasselbe zu sein**. Der Spieler kann nicht entscheiden, welcher er glauben soll,
und verliert das Vertrauen in beide.

### #40 — Training: „Netto/Saison" ≠ Forecast im Spielerprofil
> „Spieler Pandemonium von T-T wird hier ausgewiesen in S1 mit -40 SP … auf seinem spielerprofil
> sieht es normal aus. Brontar steht auch bei -13,4 SP. Das was als Netto/Saison hier steht muss
> gleich sein mit dem forecast der im spielerprofil drin steht — bitte prüfen was korrekt ist und
> nur eine Zahl ausweisen"

−40 SP ist keine Rundungsabweichung, das ist eine andere Rechnung. **BEHOBEN** — es waren zwei
Fehler: eine unvollstaendige Forecast-Formel UND ein Fallback, der Ersatzwerte gegen echte
Attributdecken clampte und dadurch einen Absturz erfand. Wahr sind +3,4.

### #44 — Verkauf: „vs Marktwert" ≠ Wert im Spielerprofil
> „Beim Verkauf vs Marktwert hat Lava Golem z.B. +10,7 oben angezeigt. Wenn ich in sein Profil
> schaue, steht dort vs Marktwert +9,3 … Was ist nun richtig?"

**BEHOBEN.** Der Verdacht war halb richtig: es fehlte genau eine Stufe
(`applySellPricingPolicyToBreakdown`). Entschieden hat die Buchung, nicht das Argument — Lava Golem
wurde zwoelf Minuten nach der Meldung fuer `fee 28.09` verkauft. Die Auslauf-Tabelle versprach
29,48; richtig ist das Profil (+9,3).

### #32 — All-Time-Zeile der Historie zählt PP, Verletzungen und MW nicht mit
> „in der ALl Time Zeile der History sind die PPs Verletzungen MW usw noch nicht erfasst — für die
> gilt das auch"

Eine Summenzeile, die einen Teil ihrer Spalten leer lässt, sieht aus wie „Wert null" und nicht wie
„nicht gezählt". Derselbe Fehlertyp wie oben, nur in der Zeitachse.

### #33 — VK-Anzeige beim eigenen Team schlechter als beim fremden
> „Bei anderen Teams steht VK und darunter der VK Preis mit vergleich zum MW — das ist besser
> gelöst als beim eigen gesteuerten team wo das nicht so sauber steht"

Zwei Darstellungen derselben Sache, eine davon schlechter. Gehört zu #44.

---

## B. Spielregel-Fehler

### #35 — Arena: Spieler sollen in IHREM Slot bleiben
> „Bitte überprüfen, dass wenn z.B. nur 2 Spieler in einer 6er eingesetzt werden, dass diese
> Spieler auch weiter in ihrem Slot mit ihren Werten bleiben! Also wenn ich in 5 + 6 Slot die
> spieler einsetze, sollen sie auch dann starten auch wenn davor dann alle slots leer sind!"

**BEHOBEN.** Die Wertung war immer richtig — die Anzeige nicht. Das ist schlimmer als es klingt:
die Slot-Position traegt eine eigene Attribut-Gewichtung (bis ±8,5 je Spieler). Wer auf Slot 5
gewertet wurde, stand als Etappe 1 auf der Buehne.

---

## C. KI-Verhalten — Ermüdung

Drei Meldungen, ein Thema. Gehören zusammen bearbeitet, sonst schiebt man die Last nur hin und her.

### #37 — KI managt Müdigkeit schlecht bei dünnem Kader
> „AI Teams müssen ihre Müdigkeit besser managen, wenn sie zu wenige Spieler haben, und dann
> zusätzlich pushen werden sich spieler oft verletzen oder sehr müde sein und dadurch performance
> verlieren! das muss noch mal gereviewed werden"

### #39 — KI-Training ignoriert Ermüdung
> „Beim Training müssen AI Teams auch die Ermüdung berücksichtigen! Hartes Training kann stark
> sein aber kostet auch viel Fatigue … Review -> sollten wir Recovery gebäude etwas stärker
> machen?"

### Vorläufer #cd83zb (10.08., noch ohne Nummer) — sind Verletzungen zu leicht zu vermeiden?
> „bitte mal auswerten wie viele verletzungen es überhaupt gab. ich habe das gefühl es ist zu
> einfach auch mit 9 spielern verletzungen zu vermeiden! sonst muss ein einsatz auf allen 3 stufen
> etwas mehr kosten"

Diese drei bilden eine Waage: wird die KI vorsichtiger (#37, #39), sinkt die Verletzungszahl
weiter — und die Frage aus dem Vorläufer verschärft sich. Erst messen, dann drehen.

---

## D. Balance

### #38 — VK-Faktor soll schon ab 8 Spielern greifen
> „der VK Faktor soll schon ab 8 spielern beginnen, zumindest für die top und bottom 2 spieler
> ungefähr — selbe logik wie bisher aber auch!"

Klare Ansage, kleiner Eingriff — sobald #44 die VK-Rechnung geklärt hat, gehört das dorthin.

---

## E. Anzeige und Auswertung

### #34 — Verletzungs-Spalte im Saisonstand
> „im Saisonstand eine Spalte einfügen mit der Anzahl an Verletzungen!"

**BEHOBEN.** Die Rohdaten lagen laengst vor (`injuryEvents`, am Abnahmestand 2380 Zeilen) — es
fehlte nur die Spalte. Gezaehlt wird ueber dieselbe Stelle wie in der Teamhistorie.

### #43 — negativer Cash rot
> „bitte den aktuellen Cash stand auch rot markieren wenn der negativ sein sollte!"

**BEHOBEN** (im Parallel-Lauf, PR #524).

### #42 — Top-Player-Liste auf 24, nebeneinander
> „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top 12 sondern Top 24
> hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern nebeneinander"

### #36 — Trainingshistorie: welche Klasse wurde hauptsächlich trainiert
> „In der Training History sollte auch drin stehen welche Klasse in der Season mainly trainiert
> wurde!"

**BEHOBEN.** Die trainierte Klasse fiel ausgerechnet in der Saison weg, in der die Klasse
WECHSELTE — der einzigen, in der man sie wirklich wissen will. Die Nebenklasse stand in den Daten
und wurde nie durchgereicht.

### #41 — Awards im Spielerprofil
> „Wir brauchen noch eine erklärung wie Most Improved Player sich zusammensetzt! Dann brauchen wir
> noch verschiedene awards im Spielerprofil … für die einzelnen Bereiche wie POW SPE MEN SOC ->
> das sind quasi die All Stars. OVR = MVP. Training und Most Improved Award. Dafür hätte ich gerne
> im Spielerprofil die Icons dass man auch später direkt sieht ah der spieler gehört [zu den …]"

Die umfangreichste Meldung der Liste — ein eigenes Vorhaben, keine Kleinigkeit.

---

## Reihenfolge

1. **A** (#40, #44, #33, #32) — widersprüchliche Zahlen zerstören das Vertrauen in alle Zahlen.
2. **B** (#35) — betrifft die Wertung selbst.
3. **D** (#38) — hängt an #44, dann billig.
4. **E** klein → groß: #43, #34, #36, #42, #41.
5. **C** (#37, #39 + Vorläufer) — zuerst messen, wie viele Verletzungen es überhaupt gibt, dann
   entscheiden. Eine Balance-Schraube ohne Messung zu drehen ist geraten, nicht gerechnet.

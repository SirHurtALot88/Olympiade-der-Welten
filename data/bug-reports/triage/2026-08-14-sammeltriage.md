# Triage der Meldungen vom 14.08. — Tickets #32 bis #44

13 Meldungen aus dem Spiel, alle aus `Oly New Game Custom 13.8.2026` (Saison 1, Spieltag 9–10).
Sie lagen auf dem Branch `bug-reports` und waren weder nummeriert noch triagiert — deshalb hier
zuerst die Nummern, dann die Einordnung.

**Warum eine Sammeltriage und nicht 13 Einzeldateien:** vier der Meldungen beschreiben denselben
Fehlertyp (zwei Zahlen für dieselbe Sache), drei denselben Bereich (KI-Ermüdung). Getrennt
abgelegt hätte man den Zusammenhang erst wiederfinden müssen.

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

−40 SP ist keine Rundungsabweichung, das ist eine andere Rechnung. **In Arbeit.**

### #44 — Verkauf: „vs Marktwert" ≠ Wert im Spielerprofil
> „Beim Verkauf vs Marktwert hat Lava Golem z.B. +10,7 oben angezeigt. Wenn ich in sein Profil
> schaue, steht dort vs Marktwert +9,3 … Was ist nun richtig?"

Verdacht: die eine Zahl vergleicht gegen den Kaufpreis, die andere gegen den Marktwert, und der
VK-Faktor steckt nur in einer. **In Arbeit.**

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

Direkt anschlussfähig an die gerade behobene Regel „wer zu wenig Spieler hat, setzt alle ein":
wenn eine kurze Aufstellung erlaubt ist, darf die Slot-Zuordnung nicht stillschweigend
zusammenrutschen. Zu prüfen ist, ob leere Slots davor die Wertung verschieben.

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

Die Rohdaten liegen vor (`injuryEvents`, am Abnahmestand 2380 Zeilen) — es fehlt nur die Spalte.

### #43 — negativer Cash rot
> „bitte den aktuellen Cash stand auch rot markieren wenn der negativ sein sollte!"

Kleinster Eingriff der ganzen Liste.

### #42 — Top-Player-Liste auf 24, nebeneinander
> „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top 12 sondern Top 24
> hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern nebeneinander"

### #36 — Trainingshistorie: welche Klasse wurde hauptsächlich trainiert
> „In der Training History sollte auch drin stehen welche Klasse in der Season mainly trainiert
> wurde!"

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

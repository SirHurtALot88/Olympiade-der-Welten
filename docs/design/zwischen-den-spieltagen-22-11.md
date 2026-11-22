# Zwischen den Spieltagen: Rahmenkonzept (22.11.)

Status: **Konzept und Mockup, nichts gebaut, nichts bestellt.** Mockup
`public/mockups/zwischen-den-spieltagen-22-11.html` (`?ansicht=rahmen|woche|ausruestung|lage|liga`), Aufnahmen
1920×1080 und 2560×1440 in `docs/design/zwischen-den-spieltagen-22-11/` (selbst angesehen: kein Scrollen, kein Überlauf).
Alle Zahlen sind **grobe Startwerte**. Karten, Kiste, Lager und Antworten im Mockup sind anklickbar.

Anlass, Chris: „Was macht man zwischen den Spieltagen? … Events, Zauberkarten oder Equipment … Lootboxen … Was hältst du
von 20 Teams pro Liga oder 3 Ligen à 16?“ Dazu seine Vorgaben vom selben Tag:

1. Ausrüstung, Ereignisse, Kisten und Karten sind **Ideen, nicht der Plan**. Zuerst das große Bild, sie sind Bausteine darin.
2. Ausrüstung = **Punkte on top**, nicht durch die Matrix gedeckelt, Ausreißer gewollt. Haltbarkeit vielfältig.
3. Die **KI muss alles nutzen** können, deterministisch und billig.
4. **Server mit 4 GB RAM:** schlankes Datenmodell, keine teuren Rechenwege je Spieltag.
5. Ereignisse **ligaweit**, nicht für ein einzelnes Team; Reaktionen der Teams sind in Ordnung.
6. **Kein Pokal, keine Weltmeisterschaft** vorerst.

Die Eignungsmatrix bleibt unangetastet. Formkarten werden nicht ersetzt.

---

## 1. Das große Bild

### 1.1 Vier Schleifen

Ein Managerspiel trägt, wenn jede Schleife eine eigene Frage stellt, eine Rückmeldung gibt und etwas in die nächste
Schleife weiterreicht.

| Schleife | Dauer | Frage des Managers | Entscheiden | Erfahren | Bekommen | Stand heute |
|---|---|---|---|---|---|---|
| **Spieltag** | 10–15 min, 20-mal | Wie gewinne ich heute? | Platz, Einsatzstufe, zwei Formkarten, Captain | Arena, Ergebnis | Punkte, PP | stark gerechnet, die Rückmeldung fehlt |
| **Woche** (Zwischenphase) | 5 min, 19-mal | Was mache ich aus dem, was passiert ist? | Training, Scouting, Vorstand | Form-Meldungen, Moral | Erholung | eine Prüfliste, kein Ort, kaum eigene Entscheidung |
| **Saison** | 20 Spieltage, zwei Hälften | Erreiche ich mein Ziel? | Kartenhaushalt, Rotation, Geld gegen Vorstand und Sponsor | Tabelle | Aufstieg, Prämien | Bausteine da, Momente fehlen |
| **Ära** | mehrere Saisons | Was für ein Verein werde ich? | Kaderprofil, Gebäude, Verträge | Historie | (wenig) | ab Saison 3 erstarrt die Liga |

Die Frage „Was macht man zwischen den Spieltagen?“ ist deshalb die Frage nach der zweiten Schleife. Sie ist heute die
schwächste, weil sie nichts Eigenes entscheidet und nichts Eigenes belohnt. Ausrüstung oder Kisten allein beheben das
nicht; sie brauchen einen Ort und einen Takt.

**Vergleichsspiele, was sie zwischen den Spielen tragen:** Football Manager (Training, Gespräche, Presse, Scouting: viel
Tiefe, viel Pflichtarbeit), Hattrick (ein Zug je Woche, langer Atem), Motorsport Manager (Teile entwickeln mit
Haltbarkeit und Risiko, Regelabstimmungen der ganzen Liga), OSM (ein Zug am Tag, Trainingslager als Karte), Blood Bowl
(Verletzungen, Zukäufe für ein Spiel, Liga-Ereignisse), Slay the Spire (eins aus drei wählen statt blind ziehen), Marvel
Snap (kleine Hand, eine Entscheidung je Zug), Mario Strikers (Gegenstände als sichtbare, kurzlebige Ausreißer). Was sich
übertragen lässt: **ein Zug statt einer Liste**, **eins aus drei statt Lotterie**, **Teile mit Haltbarkeit**, **die Liga
als Mitspieler**. Was nicht passt: Pflichtarbeit und alles, was Echtgeld nachbildet.

### 1.2 Fünf Säulen

| Säule | Frage | Trägt heute | Fehlt |
|---|---|---|---|
| **1 Kader** | Wen habe ich, was wird aus ihm? | Draft, Fenster, Training mit Weg, Scouting-Nebel, Verträge, Belastung | Zugang und Abgang über die Saisons |
| **2 Spieltag** | Wie setze ich ihn ein? | Einsatzliste, Formkarten, Einsatzstufe, Captain, 20 Disziplinen | Rückmeldung nach dem Spiel, eigene Handschrift |
| **3 Verein** | Womit bezahle ich das? | zwei Töpfe, Vorstand, Sponsor, Gebäude, Finanzen je Spieltag | Geldentscheidungen in der Saison mit sportlicher Folge; Zweck der Gebäude |
| **4 Welt** | Was passiert um mich herum? | zwei Ligen, Auf-/Abstieg, Pause | fast alles: jede Saison läuft gleich, Höhepunkte sind Buchungsknöpfe |
| **5 Rivalen** | Gegen wen, mit wem? | Delegation, drei Logins, Team-Beziehungen als Daten (`lib/rivalries/`) | Vergleich, Derby, gemeinsame Momente |

Die Säulen 1 bis 3 stehen. **Die Lücken liegen in Welt und Rivalen**, also genau dort, wo Chris’ Ideen (Ereignisse) und
die Review (Rennen, Manager-Leiste) hinzeigen. Ausrüstung und Kisten gehören dagegen zu Säulen, die schon tragen; sie
sind Würze, kein Fundament. Das bestimmt die Reihenfolge in Abschnitt 4.

### 1.3 Der Kreislauf

Sechs Mittel laufen durch das Spiel: **Punkte** (Tabelle), **Geld** (zwei Töpfe), **Kraft** (Erschöpfung), **Karten**
(Formkarten-Haushalt), **Vertrauen** (Vorstand) und neu **Ruhm** (aus sportlicher Leistung, kauft Beute).

**Regel für jeden Baustein:** er muss mindestens zwei Mittel tauschen und zwei Säulen verbinden. Sonst wird er eine Insel
neben dem Spiel. Ausrüstung: Ruhm → Beute → Punkte, Haltbarkeit kostet Geld oder Teile (Säulen 1, 2, 3). Liga-Lage: die
Welt verschiebt Geld und Kraft für alle, jeder antwortet mit seinem Verein (Säulen 3, 4). Eine Kiste, die nur Zahlen
verteilt, erfüllt die Regel nicht; eine Kiste, die aus Leistung bezahlt wird und eine Wahl verlangt, schon.

### 1.4 Spannungsbögen und Ziele

- **Spieltag:** Karte jetzt oder sparen, Vollgas oder schonen; neu: lohnt das Einweg-Teil heute?
- **Hälfte:** Kraft bis zur Pause einteilen; neu: eine Liga-Lage, die den Plan verschiebt.
- **Saison:** Rennen um Titel, Aufstieg, Abstieg und das Vorstandsziel; Halbzeit als Wendepunkt; Finale als Sendung.
- **Ära:** aufsteigen, sich halten, Titel holen; einen Erzfeind haben; für etwas stehen (Wimpel, Rekorde, Legenden).
- **Zu dritt:** Derby, Managertabelle, dieselbe Liga-Lage verschieden beantwortet.

### 1.5 Die Woche als Ort

Bevor irgendein Baustein kommt, braucht die zweite Schleife einen Ort: **eine Seite „Die Woche“** (Mockup, Beispiel 1).
Sie ersetzt die Prüfschritte des Taktgebers zwischen zwei Spieltagen und folgt drei Regeln:

1. **Ein Zug, nicht eine Liste.** Je Woche eine echte Entscheidung (später: eine Aktionskarte), dazu höchstens eine
   Reaktion auf die Liga-Lage. Fünf Minuten.
2. **Nichts ist Pflicht.** „Weiter zum Spieltag“ ist immer möglich; was offen bleibt, füllt die KI nach derselben Logik
   wie für KI-Teams. Training, Vorstand, Scouting erscheinen nur bei Anlass.
3. **Delegierbar.** Bereich „Woche“ (Zug, Ausrüstung, Antworten) in `TeamControlSettings.delegation`; für Ramona
   (Halbautomatik) macht die KI alles außer Käufen. „Mensch überschreibt, KI respektiert das.“

---

## 2. Bausteine

Kurzkarten. Welle und Aufwand in Abschnitt 4. **KI** = wie die KI den Baustein nutzt. **Last** = Speicher und Rechenzeit.

### B1 Deine Entscheidungen · B2 Rennen und Halbzeitbericht · B3 Manager-Leiste und Derby
Eigenes Mockup und Dokument: `spieltag-entscheidungen-rennen-22-11.md`. Zweck: Rückmeldung (Schleife 1), Bogen
(Schleife 3), Vergleich (Säule 5). KI: nicht betroffen. Last: null, reine Anzeige. Aufwand S bis M.

### B4 Die Woche als Ort
- **Zweck:** gibt Schleife 2 einen Ort und einen Takt (Abschnitt 1.5). Voraussetzung für B5 bis B8.
- **Wechselwirkung:** bündelt Kader-Zustand, Verein, Rivalen, Welt auf einer Seite.
- **KI:** füllt jeden offenen Schritt; ein Spieltag wartet nie auf einen delegierten Bereich.
- **Last:** null. **Aufwand:** M. **Abhängig von:** Taktgeber-Umbau (Review 3.2), Mockup-Freigabe.

### B5 Liga-Lage (ligaweite Ereignisse)
- **Zweck:** macht jede Saison anders und gibt der Säule Welt einen Inhalt. Etwa fünf Lagen je Saison, je zwei bis drei
  Spieltage, **für beide Ligen und alle 32 Teams gleich**, einen Spieltag vorher angekündigt.
- **Arten:** Wirtschaft (Sponsor-Auszahlungen ±15 %, Stadion ±25 %, Gehaltsdruck bei Verlängerungen, Transfer-Inflation
  im nächsten Fenster, Materialknappheit im Laden), Wetter und Saison (Hitzewelle: Belastung im Freien +2 Grundlast;
  Grippewelle: Erholung −20 %), Regel (Schonfrist: Verletzungsrisiko halbiert; Kartenruhe: keine Formkarten;
  Materialkontrolle: seltene Ausrüstung gesperrt; Flutlicht: Prämien doppelt).
- **Reaktion:** je Lage zwei bis drei Antworten mit **vorher sichtbaren, festen Folgen**, kein versteckter Würfel (wie
  das Vorstandsgespräch). Nach dem Spieltag sieht man, wie die Liga geantwortet hat.
- **Wechselwirkung:** Verein (Geld, Rücklage, Vorstand), Kader (Belastung), Rivalen (dieselbe Lage, andere Antwort).
  Greift **nicht** in die Wertung der Arena ein; Wetter wirkt nur auf Belastung und Erholung.
- **KI:** Nachschlagetabelle je Lage: Antwort nach Team-Matrix (Finanzwert, Beliebtheit, Ehrgeiz) und Kassenlage.
- **Last:** je Saison fünf Einträge und 32 Antworten, unter 2 KB. Rechenzeit: ein Faktor in bestehenden Buchungen.
- **Aufwand:** M. **Abhängig von:** B4, Finanzen je Spieltag (gebaut).

### B6 Ausrüstung (Punkte on top, Haltbarkeit)
- **Zweck:** sichtbare Ausreißer und eine Entscheidung je Spieltag mehr („lohnt das Teil heute?“).
- **Wirkung:** der Bonus kommt **auf die gespielte Leistung des Trägers obendrauf**, in den Disziplinen, die auf dem
  Gegenstand stehen, unabhängig von der Eignung und ohne Deckel aus der Matrix. Startwerte: Standard +2 bis +4, Selten
  +4 bis +5, Episch +6 bis +7, Legendär +9; Einweg-Teile +4 bis +6. Zwei Plätze je Spieler: Ausrüstung und Verbrauch.
  Zum Vergleich: eine Formkarte bringt bis 12, ein Mutator-Treffer 3,5.
- **Haltbarkeit, fünf Arten:** Einweg (ein Einsatz), Leihgabe (N Spieltage ab Anlegen), Verschleiß in Prozent je Einsatz
  (robust 5–8, normal 15, empfindlich 34), gebraucht oder beschädigt erhalten (Zustand unter 100 %), Reparatur gegen
  Teile (danach höchstens 80 % des alten Höchstwerts). Vollgas verschleißt doppelt.
- **Woher:** Ruhm und Kisten (B7), Laden für Geld (nur Standard und Selten, oft gebraucht, ein Kauf je Woche, aus dem
  Investitionstopf unter der Vorstands-Freigabe), Sponsor-Leihgabe zum Saisonstart, Belohnung für Ziele und Wimpel.
- **Gezeigt = gebucht:** **eine** Funktion `ausruestungsBonus(spielstand, spieler, disziplin, spieltag)` für
  Einsatzliste, Legacy-Wertung, Motor-Umschlag, KI und „Deine Entscheidungen“ (eigene Zeile „Ausrüstung“). Verschleiß
  wird beim Buchen des Spieltags fortgeschrieben, bei Replay zurückgenommen.
- **Rangtreue:** siehe Abschnitt 3.
- **Besitz:** gehört dem Verein, nicht dem Spieler; bei Verkauf geht sie ins Lager. Marktwert bleibt davon unberührt.
- **KI:** vor jeder Aufstellung für die zwei Disziplinen des Tages: Gegenstände nach Bonus absteigend, jeder an den
  aufgestellten Spieler mit der höchsten Eignung in einer passenden Disziplin und freiem Platz; Gleichstand nach
  Spieler-ID. Einweg-Teile, wenn der erwartete Abstand zum Gegner kleiner ist als der Bonus, in den letzten fünf
  Spieltagen im Rennen immer, oder wenn das Lager voll ist. Reparatur, wenn Restnutzen > Kosten und Teile da sind.
  Kauf im Laden, wenn Nutzwert je C über einer Schwelle liegt, die am Ehrgeiz des Teams hängt, und die Rücklage hält.
- **Last:** Katalog (rund 60 Arten) im Code. Je Gegenstand ein Datensatz aus Art, Zustand, Höchstzustand, Restlaufzeit,
  Träger: rund 80 Byte. Lager höchstens 16 je Team plus angelegte: Obergrenze 32 × 44 × 80 Byte ≈ 110 KB, üblich
  unter 30 KB je Spielstand. Rechenzeit: Nachschlagen je aufgestelltem Spieler, kein zusätzlicher Motorlauf.
- **Aufwand:** L (Wertung, alle Abnehmer, Messung, Review). **Abhängig von:** B1 (Zeile im Ergebnis), B4.

### B7 Ruhm und Kisten
- **Zweck:** der Belohnungsweg, der Leistung in Beute verwandelt und das Loot-Gefühl bringt.
- **Ruhm:** 1 je Duellpunkt, +1 je Disziplin über der Erwartung (hilft Außenseitern), Bonus für Derby-Sieg, Wimpel,
  Etappen der Vorstandsziele. Rund 60 bis 80 je Saison.
- **Kisten:** nur für Ruhm oder als Belohnung, **nie für Geld** (reiche Teams kaufen Breite im Laden, nicht Seltenes).
  Holz 8, Eisen 20, Gold nur als Belohnung. **Eins aus drei wählen**, der Rest wird zu Teilen. Chancen stehen an der
  Kiste (Eisen: 40 / 40 / 17 / 3 %). Mitleidszähler: spätestens jede fünfte Eisenkiste zeigt etwas Episches. Duplikat:
  Teile oder das eigene Stück auf 100 %. Etwa sieben Öffnungen je Saison, also jede zweite bis dritte Woche.
- **Glück:** die Saat hängt an Spielstand, Team, Saison und Zähler (kein Neuladen-Trick, serverseitig hinter
  `authorizeServerRoomWrite`). Die Wahl aus drei halbiert die Streuung.
- **KI:** öffnet die teuerste bezahlbare Kiste, sobald Ruhm ≥ 20; wählt nach Nutzwert = Bonus × erwartete Einsätze ×
  Restspieltage mit passender Disziplin; Gleichstand nach Katalognummer.
- **Last:** ein Zähler und ein Ruhmwert je Team. **Aufwand:** M. **Abhängig von:** B6.

### B8 Aktionskarten
- **Zweck:** der eine Zug je Woche. Unterschied zur Formkarte: Formkarten liegen **am Spieltag** und gehen in die
  Wertung; Aktionskarten liegen **zwischen** den Spieltagen und ändern Zustände (Kraft, Moral, Trainingsfortschritt,
  Scouting-Stufe, Kasse, Haltbarkeit), nie direkt ein Ergebnis.
- **Regeln:** Hand 3, je Woche eine spielen, eine nachziehen. Grunddeck für alle gleich; Gebäude ab Stufe 2 legen je
  eine Karte dazu (gibt Gebäuden einen spürbaren Zweck), Kisten können Karten enthalten.
- **Keine Sabotage** gegen andere Teams: zu dritt erzeugt das Ärger statt Rivalität. Rivalität kommt aus B9.
- **KI:** feste Rangfolge nach Zustand: Erholung, wenn zwei Stammspieler ab 60 Erschöpfung; Moral, wenn ein
  Stammspieler unter 40; Vorstand, wenn Vertrauen unter 5; sonst Training für den Spieler mit dem größten Abstand zur
  Decke; sonst die älteste Karte.
- **Last:** Hand und Stapel als Zähler je Kartenart, rund 200 Byte je Team. **Aufwand:** M. **Abhängig von:** B4.

### B9 Rivalitäten und Erzfeind
- **Zweck:** Geschichten zwischen Vereinen, auch gegen KI-Teams. Die Beziehungen gibt es als Daten
  (`lib/rivalries/team-rivalries.ts`); sie werden sichtbar und wachsen mit knappen Spielen, Direktduellen im Rennen,
  Derbys.
- **Wirkung:** Marke im Spielplan, Bilanz über Saisons, kleine Moral- und Ruhm-Folge beim Sieg, Stadion-Einnahmen im
  Derby. Keine Wertungsänderung.
- **KI:** nichts zu entscheiden. **Last:** vorhanden. **Aufwand:** S. **Abhängig von:** B3.

### B10 Wimpel und Rekorde (Vereinsidentität)
- **Zweck:** belohnt Spezialisierung: bestes Team je Disziplin und Liga über die Saison bekommt einen Wimpel, dazu
  Vereinsrekorde je Disziplin. Zählt für Vorstands- und Sponsorziele, gibt Ruhm.
- **KI:** nichts. **Last:** 40 Einträge je Saison. **Aufwand:** S. **Abhängig von:** Historie-Seite.

### B11 Spielweisen (Handschrift)
- **Zweck:** der Manager entscheidet, **wie** gespielt wird (Review 3.3). Sie ändern, was die Spieler tun, nie wie gut.
- **KI:** Wahl nach Kaderprofil. **Last:** null. **Aufwand:** L je Disziplin-Familie, mit rho- und Pp-Abnahme und
  neuen Fingerabdruck-Zeilen. **Abhängig von:** Pilot Wettessen (`OLY_STRATEGIE_VORLAGEN`).

### B12 Nachwuchs und Abgang
- **Zweck:** der Motor der Ära. Kleiner jährlicher Nachwuchs-Draft (Schwächere zuerst), sanfter Abgang ohne Alter.
- **KI:** bestehende Draft-Logik. **Last:** gering. **Aufwand:** L. **Abhängig von:** Grundsatzentscheidung; neue
  Spieler brauchen Portrait und für Kader von Menschen eine Figur.

### B13 Legenden · B14 Saisonfinale als Sendung
- **Zweck:** Abschluss und Gedächtnis. Finale in fünf Tafeln (Review 3.6); Spieler mit vielen Saisons, Wimpeln oder
  MVP-Titeln werden Vereinslegenden (Ruhmeshalle, kleine Moralwirkung).
- **KI:** nichts. **Last:** gering. **Aufwand:** M und S. **Abhängig von:** B10, Mockup.

### Später, wenn es drei Ligen gibt
Pokal über die Ligen, Supercup, Weltspiele. Vorerst gestrichen (Vorgabe 6).

---

## 3. Ausrüstung und Rangtreue: Abschätzung

**Keine Messung am Motor**, sondern eine Modellrechnung (`Leistung = Eignung + Rauschen + Ausrüstung`, zehn Spieler je
Spiel, Rangkorrelation je Spiel, 6000 Spiele, Ausgang 0,79). Sie zeigt die Richtung, nicht die Zahl.

| Wer trägt, wie viel | rho gegen Eignung | rho gegen Eignung + Ausrüstung |
|---|---:|---:|
| niemand | 0,79 | 0,79 |
| 20 % tragen +2 bis +4, zufällig verteilt | 0,78 | 0,79 |
| 20 % tragen +2 bis +4, die Schwächsten | 0,73 | 0,74 |
| 30 % tragen +2 bis +6, die Besten | 0,84 | 0,84 |
| 30 % tragen +2 bis +6, zufällig | 0,76 | 0,79 |
| 30 % tragen +2 bis +6, die Schwächsten | 0,68 | 0,72 |
| 50 % tragen +4 bis +9, zufällig | 0,72 | 0,81 |
| 50 % tragen +9 bis +17, zufällig | 0,59 | 0,85 |

Lesart:

- **Ausreißer sind kein Zufall.** Der Bonus ist vorher sichtbar. Gegen „Eignung + Ausrüstung“ bleibt die Rangtreue
  stehen oder steigt. Das ist die Zahl, die sagt, ob das Ergebnis aus Können und Entscheidung kommt.
- **Gegen die nackte Eignung fällt rho**, sobald viele schwache Spieler viel tragen. Trägt der Beste das Teil (so
  rüstet die KI aus), steigt rho sogar.
- **Die Bremse ist die Menge im Umlauf**, nicht ein Deckel am Gegenstand: Haltbarkeit, Ruhm-Einkommen, Lagergröße,
  Zahl der Plätze. Bei den Startwerten trägt etwa jeder vierte aufgestellte Spieler etwas mit im Mittel +4.

**Vorschlag für die Abnahme** (zu entscheiden, offene Frage 1):

1. **Mechanik:** rho und Pp je Disziplin werden wie heute **ohne Ausrüstung** gemessen; GESAMT des Fingerabdrucks bleibt
   mit ausgeschalteter Ausrüstung unverändert. Die Mindestschranke 0,75 gilt für diese Zahl weiter.
2. **Mit Ausrüstung:** eigene Fingerabdruck-Zeilen außerhalb von GESAMT; rho gegen „Eignung + Ausrüstung“ darf nicht
   unter der Zahl ohne Ausrüstung liegen.
3. **Umlauf-Wächter:** in einer Saison mit 32 KI-Teams (`scripts/miss-alle-disziplinen.mjs` um einen Schalter
   erweitert) bleibt rho gegen die nackte Eignung über 0,75. Fällt es darunter, wird das Angebot gedrosselt.
4. **Pp-Abweichung:** der Bonus hängt an keinem Attribut, verschiebt die Attributanteile also nicht gezielt; gemessen
   wird trotzdem mit und ohne, Schranke 25.

Abnehmer, die man kennen muss: PP (steigen mit dem Bonus; Bestenliste und MVP ja, Marktwert-Fortschreibung besser
ohne), Moral und Form (Leistung gegen Erwartung: die Erwartung muss den Bonus enthalten), Training (unberührt).

---

## 4. Reihenfolge

Jede Welle bringt allein schon etwas und setzt keine spätere voraus.

| Welle | Inhalt | Warum an dieser Stelle | Aufwand | Freigabe nötig |
|---|---|---|---|---|
| **1 Verstehen und vergleichen** | B1, B2, B3, Ziel-Stufen | reine Anzeige, macht alles Vorhandene spürbar | S–M | nein (freigegeben) |
| **2 Die Woche und die Welt** | B4, B5, B9, B10 | füllt die schwächsten Säulen, ohne die Wertung zu berühren; gibt B6 bis B8 ihren Ort | M | Mockup „Die Woche“, Katalog der Lagen |
| **3 Beute** | B6, B7 | größtes Risiko (Wertung), deshalb erst, wenn Ort und Rückmeldung stehen | L | Abnahmeregel (Frage 1), Opus-Review, neuer Fingerabdruck |
| **4 Handschrift** | B8, B11 | braucht den Zug aus Welle 2; Spielweisen je Disziplin-Familie | M–L | Mockup je Familie |
| **5 Ära** | B14, B13, B12, Ligaformat | zahlt sich erst über mehrere Saisons aus | L | Grundsatzfragen, PixelLab für neue Teams und Figuren |

**PixelLab-Bedarf (nur Vorschlag, nichts bestellt):** Requisiten sind frei, Figuren nicht. Welle 3: rund 60
Gegenstands-Icons und drei Kisten, geschätzt 60 bis 90 Generationen (eine je Icon, Stilprobe zuerst). Welle 2: fünf bis
acht Lagen-Bilder, geschätzt 10. Welle 5 (2 × 20): acht Team-Logos und Figuren nur für Kader von Menschen. Bis dahin
SVG-Platzhalter wie im Mockup.

**Mess- und Abnahmeplan in Kürze:** Welle 1 und 2: Fingerabdruck unverändert, Aufnahmen gegen Mockup, Finanz-Korridor
einer Saison mit 32 KI-Teams mit und ohne Lagen (Kassen-Median ±5 %). Welle 3: Abschnitt 3, dazu Ruhm- und
Kisten-Verteilung über eine KI-Saison (kein Team über dem Doppelten des Medians an Ausrüstungspunkten). Welle 4:
je Spielweise rho, Pp, neue Fingerabdruck-Zeile.

---

## 5. Ligaformat

| | 2 × 16 (heute) | 2 × 20 | 3 × 16 |
|---|---|---|---|
| Teams | 32 | 40, acht neue (zehn Vorschläge vom 21.11.) | 48, sechzehn neue |
| Spielplan, 20 Spieltage | 15 Gegner, fünf doppelt | 19 Gegner, jeder einmal + ein freier Spieltag (Derby, Erzfeind) | wie heute |
| Vierergruppen | 4 je Liga | 5 je Liga | 4 je Liga |
| Rennen | L1 Titel, Abstieg; L2 Aufstieg | dieselben; mit vier Wechslern 20 % | Liga 2 hat Aufstieg **und** Abstieg |
| Kader, Draft | unverändert | rund +100 Plätze, Draft 25 % länger | rund +190 Plätze, dritte Stärkestufe |
| Wirtschaft | geeicht | Liga 2 breiter, Eichung prüfen | neue Stufe für Sponsor, Prämien, Startbudget |
| Layouts | nichts | alle Tabellen 20 Zeilen (passt bei 1080 mit 2,6 rem je Zeile) | Tabellen bleiben; überall drei Ligen, Ränge gegen 48 |
| Rechenzeit am Spieltag | Wertung 13,6 s | etwa +25 % | etwa +50 %, auf dem 4-GB-Server zu prüfen |
| Drei Menschen | höchstens zwei Ligen | höchstens zwei Ligen | können sich auf drei verteilen |
| PixelLab | nichts | acht Logos; Figuren nur für Kader von Menschen | sechzehn Logos |

**Empfehlung: jetzt 2 × 16 lassen, als Ziel 2 × 20 mit vier Auf- und Absteigern (Welle 5), nicht 3 × 16.**
2 × 20 löst das eine echte Problem des heutigen Formats, den ungleichen Spielplan, und schenkt einen freien Spieltag
für das Derby. Die Teams liegen als Vorschlag vor, die Menschen bleiben beisammen, der Preis ist ein Layoutdurchgang.
3 × 16 hätte die besseren Rennen in der Mitte und die längere Leiter, kostet aber doppelt so viele neue Teams, die
Hälfte mehr Rechenzeit und trennt die Mitspieler; ohne Pokal treffen sie sich dann nicht mehr. Die Zahlen zum Spielplan
und zur Rechenzeit sind aus `season-fixture-schedule.ts` und `spieltag-tempo-21-11.md` abgeleitet, nicht gemessen.

---

## 6. Offene Fragen an Chris

1. **Abnahme mit Ausrüstung:** gilt die Schranke 0,75 für rho gegen die nackte Eignung auch bei getragener Ausrüstung
   (dann begrenzt sie die Menge im Umlauf), oder zählt dort rho gegen „Eignung + Ausrüstung“?
2. **Trägt der Rahmen so:** vier Schleifen, fünf Säulen, zuerst Welt und Rivalen füllen, Beute erst in Welle 3?
3. **Die Woche:** ein Zug je Woche, oder lieber frei so viel man will?
4. **Ligaweite Lagen mit Regelwirkung** (Kartenruhe, Materialkontrolle): gewollt, oder nur Wirtschaft und Wetter?
5. **Ligaformat:** 2 × 20 als Ziel für Welle 5 vormerken, mit vier statt drei Auf- und Absteigern?

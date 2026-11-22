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

---

# Runde 2 (22.11.): Feedback von Chris, fünf Punkte ausführlicher

Neue Ansichten im Mockup: `?ansicht=nachspiel`, `kiste` (`&phase=1|2|3` friert einen Takt ein), `verein`, `welt`, `aera`.
Weiter grob: Zahlen sind Startwerte, nichts ist gemessen, wo es nicht dabeisteht.

## 7. Kader und Ära: Potential, das wandert

Chris: „Ich würde nicht sagen, dass sich jeder Spieler zwangsweise dem Peak nähert … Wenn Potentiale sich pro Attribut und
Saison ein bisschen nach oben oder unten anpassen können und Training und Regression so laufen, dass über alle Ligen die
Spieler im SCHNITT nicht zu viel zulegen, passt es.“ Das korrigiert Abschnitt 1.2: Die Lücke ist nicht „es fehlt ein
Motor“, sondern „der Motor ist nicht geeicht und nicht sichtbar“.

**Was es schon gibt** (gelesen, nicht gemessen):
- Decke je Attribut mit Saison-Drift: `applyAttributeCeilingSeasonDrift` (`lib/scouting/player-attribute-ceiling-service.ts`)
  zieht je Attribut und Saison −2, 0 oder +2 aus einer Saat, verschoben nach Ausblick (`growthOutlook`). Das ist heute
  **reiner Zufall ohne sichtbaren Grund**.
- Abnehmender Ertrag und Abbau: `lib/training/organic-season-progression.ts` (Drossel nahe der Decke, Regression,
  Einstellskript `scripts/long-run-auto-tune-organic.ts`).
- Messung der Bilanz: `docs/design/training-je-spieltag-18-11.md` weist „Netto Summe aller Attribute, Liga-Mittel **+6,78**
  je Saison“ aus. Die Liga legt also im Schnitt deutlich zu. Genau das soll nicht sein.
- Zu- und Abgänge stehen in der Historie (`app/foundation/historie`, `transfer-history-v2`).

**Baustein B15 „Potential, das wandert“ (Startwerte):**

| Teil | Regel |
|---|---|
| Drift je Attribut und Saison | −2 bis +2, meist 0. Summe über alle zwölf Attribute eines Spielers höchstens ±4 je Saison |
| Auslöser nach oben | viel Spielzeit auf einem Platz, der das Attribut braucht; Trainingsziel die Saison gehalten; Wimpel oder mehrfach beste des Spieltags; passendes Gebäude oder Trainerin |
| Auslöser nach unten | kaum Einsätze; viele Spieltage verletzt; dauernd über 65 Erschöpfung; Attribut die ganze Saison in keiner gespielten Disziplin gebraucht |
| Rest | kleiner Zufall aus der Saat, höchstens ±1, damit zwei gleiche Laufbahnen nicht identisch enden |
| Ertrag nahe am Potential | ab 6 Punkten Abstand voller Trainingssatz, darunter linear fallend bis rund 25 % am Potential; darüber nichts |
| Regression | wer ein Attribut nicht trainiert und nicht spielt, verliert langsam (Startwert −0,5 je Saison), über dem Potential schneller |
| Kein Alter | bleibt. Laufbahnen enden über sinkendes Potential und über den Abschied (B12), nicht über Jahre |

**Abnahme: Liga-Mittel neutral.** Messlauf wie für das Training (`scripts/miss-training-je-spieltag.ts`, 32 KI-Teams von
Anfang an), aber über **fünf Saisons** (`lib/season/long-run-*`):
1. Netto-Summe aller Attribute je Spieler und Saison, **Liga-Mittel zwischen −1 und +1** (heute +6,8).
2. Streuung gewollt: etwa ein Drittel wird schwächer, ein Drittel stärker, Rest ±1.
3. Mittlere Kaderstärke (beste 6) je Disziplin driftet über fünf Saisons um höchstens ±1.
4. Die Rangfolge der Teams bewegt sich: Rangkorrelation der Kaderstärke Saison 1 gegen Saison 5 unter 0,8.
5. rho und Pp bleiben unberührt (die Mechanik ändert sich nicht, nur die Werte der Spieler).

Stellschrauben sind Trainingsfaktor, Ertragskurve und Regression; nicht die Drift, die soll klein bleiben.

**Sicht für den Spieler** (Mockup `aera`): im Profil je Attribut Wert, Potential als Rahmen, **Pfeil** für die Bewegung zum
Saisonwechsel und **Ertrag in Prozent**; eine **Karrierekurve** je Attribut und für den Gesamtwert über die Saisons mit
Marken (Wechsel, Verletzung, Wimpel) und dem Grund je Potential-Schritt. Der Scouting-Nebel gilt weiter: bei fremden
Spielern Potential nur als Spanne, Pfeile erst mit Scouting Office.

**KI:** nutzt dieselbe Ertragszahl bei der Wahl des Trainingsziels (nicht in ein Attribut am Potential trainieren) und
beim Kauf (Potential-Spanne nach Scouting-Stufe, wie heute). Sie verkauft Spieler mit zwei fallenden Pfeilen im
Schlüsselattribut eher. Kein neuer Rechenweg je Spieltag: die Drift läuft einmal im Saisonwechsel.

**Historie erweitern:** je Saison Nachwuchs und Abschiede der Liga, je Spieler die Laufbahn (Vereine, Ablösen,
Karrierekurve, Wimpel, Bestwerte), je Verein Zu- und Abgänge mit „was aus ihnen wurde“. Speicher: je Spieler und Saison
ein Datensatz mit zwölf Werten und zwölf Potentialen, rund 0,1 KB, bei 400 Spielern 40 KB je Saison.

**Aufwand:** M für Auslöser, Eichung und Messung; S–M für die Sicht. Die Ära insgesamt bleibt „später, aber sehr
wichtig“. Vorschlag: Eichung und Sicht schon in Welle 2 (sie berührt keine Wertung und wirkt ab der zweiten Saison),
Nachwuchs und Abschied in Welle 5.

## 8. Nach dem Spiel: die Sendung

„Deine Entscheidungen“ erklärt die Zahlen. Davor fehlt die **Erzählung**: was ist passiert, wer war es, was folgt. Eine
Seite, sechs Tafeln (Mockup `nachspiel`), als erster Halt nach der Arena; „Deine Entscheidungen“ ist der zweite Reiter.

| Tafel | Inhalt | Quelle |
|---|---|---|
| Schlagzeile | eine Zeile, zwei Sätze, drei Stimmen (Gegner, Fans, Vorstand) | Satzbausteine nach Regeln aus Ergebnis, Abstand, Serie, Rang, Vorstandslage; Saat je Spieltag. Kein Textgenerator |
| Schlüsselmomente | je Disziplin drei bis vier Momente mit Stand | Ereignisliste des Arena-Laufs (Tore, Führungswechsel, Ausfälle); die mit der größten Wirkung auf den Stand; Sprung zur Stelle in der Wiederholung |
| Matchwinnerin | großes Bild, gespielt gegen Grundwert, PP, Zählbares, Laufbahn-Satz, Pechvogel | `matchday-mvp-scoring-service.ts`, `baueSpielerPp`, Verletzungsstand |
| Formpfeile | fünf Spieler mit Pfeil und Grund | Form-Meldungen (`nach-dem-spieltag.ts`) |
| Folgen für die nächste Woche | fünf Zeilen, jede springt | Erschöpfung, Verletzte, Kartenhaushalt, nächster Gegner, Kasse des Spieltags |
| Rund um die Liga | Mitspieler zuerst, dann Rekord, Überraschung | Buchung der anderen Begegnungen |

Regeln: jede Zeile stammt aus Gebuchtem; ein Satzbaustein ohne passende Lage erscheint nicht. Die Stimmen bekommen
Charakter über Typen (KI-Manager aus der Team-Matrix, Vorstand aus Abschnitt 9). Voraussetzung für die Schlüsselmomente:
der Arena-Lauf muss eine kurze Ereignisliste mit Zeitpunkt und Stand speichern (**prüfen**, was der Motor heute ausgibt);
das ist reine Anzeige, der Fingerabdruck bleibt. Für legacy-gewertete Disziplinen gibt es Momente nur als „bester Wert,
größter Ausreißer, knappste Platzierung“. Aufwand M, Welle 1 oder 2.

## 9. Verein: was hinein könnte

Leitgedanke: der Verein wird eine **Figur mit Haltung, Leuten, Publikum und Gedächtnis**. Acht Elemente (Mockup `verein`).

| Element | Zweck | Wechselwirkung | KI | Aufwand |
|---|---|---|---|---|
| **Identität (drei Leitsätze)** | gibt eine Richtung mit Vorteil und Preis, z. B. „Bühne vor Kraft“, „Eigene Leute“, „Volles Haus“ | färbt Vorstandsziele, Sponsor-Passung, Fan-Vorlieben, Training | wählt aus der Team-Matrix (Achsen, Ehrgeiz, Beliebtheit), fest je Saison | M |
| **Fans und Stadion** | Stimmung 0–100 aus Ergebnissen, Derbys, eigenen Leuten; bestimmt Auslastung und Einnahme je Heimspiel | Spieltag → Kasse; Schonen im Heimspiel und Star-Verkäufe kosten Stimmung; Arena-Ausbau hebt die Obergrenze | keine Entscheidung, nur Folge | M |
| **Gebäude mit Zweck** | jedes Gebäude liefert etwas zum Anfassen: eine Aktionskarte, ein Ladenangebot, ein aufgedeckter Potential-Pfeil | Woche, Training, Scouting, Beute | baut nach Identität und Kassenlage (wie heute) | M |
| **Personal (Trainerin, Scout, Physio)** | drei Stellen, je ein Typ mit Vorteil und Preis; zweite Verwendung für den Gehaltstopf | Training, Scouting-Nebel, Erholung; unter der Vorstands-Freigabe | nimmt den Typ, der zur Identität passt | M |
| **Jugend und Nachwuchs** | ein bis drei Plätze, lange Sicht, eigener Nachwuchs-Draft (Schwächere zuerst) | Academy, Leitsatz „Eigene Leute“, Fans, Ära | bestehende Draft-Logik | L, Welle 5 |
| **Sponsor-Beziehung** | Treue wächst mit erfüllten Zielen und Jahren; ab einer Schwelle mehr Grundbetrag und eine Leihgabe | Finanzen, Ausrüstung, Wirtschaftslage | bleibt, solange Treue über der Schwelle und kein besseres Angebot | S–M |
| **Vorstand mit Gesichtern** | drei Stimmen (Kasse, Ehrgeiz, Tradition) mit Gewicht; das Vertrauen ist ihr Mittel | Gespräch, Ziele; Freigabe-Quote bleibt wie entschieden | nicht betroffen (KI-Teams haben denselben Vorstand) | M |
| **Vereinsgeschichte** | Wimpel, Rekorde, Legenden, Erzfeind, ewige Tabelle | Fans, Traditionalist, Saisonfinale, Historie | nichts | S |

Serverlast überall klein: wenige Zahlen je Team und Saison. Personal braucht **keine neuen Figuren** (Symbole und
Typnamen). Die festen Finanz-Vorgaben bleiben: keine Geldstrafen, Freigabe als Quote, zwei Töpfe, Rücklage nach
Finanzwert. Reihenfolge: Fans und Gebäude-Zweck zuerst (sie machen Vorhandenes spürbar), dann Identität und Vorstand,
dann Personal.

## 10. Welt: die Zeit geht weiter

Das Gefühl von Zeit entsteht nicht durch mehr Zufall, sondern durch **Zustände mit Gedächtnis**: Sie ändern sich langsam,
sind angekündigt, bleiben und haben einen Grund. Vier Uhrwerke (Mockup `welt`):

1. **Wirtschaftslage (träge Stufe).** Fünf Stufen von Krise bis Boom, höchstens eine Stufe je Saison, die Richtung steht
   eine Saison vorher fest. Wirkt auf Sponsor-Grundbetrag, Stadion, Ablösen, Gehaltsforderungen. Die kurzen Liga-Lagen
   (B5) werden aus der Stufe gezogen: im Boom Feiertagsspiele, in der Krise Sponsorenflaute. Rückkopplung: viel Geld im
   Umlauf treibt Ablösen, das kühlt ab.
2. **Regel der Saison (bleibend).** Jede Saison bringt genau **eine** dauerhafte Änderung. Die Liga stimmt in der
   Saisonpause über drei Vorschläge ab, jedes Team eine Stimme, die KI nach Vorteil für den eigenen Kader. Beispiele:
   vier statt drei Auf- und Absteiger, Kader 14, eine dritte Formkarte, Format einer Disziplin. Beschlossenes steht in
   der Chronik und gilt weiter.
3. **Trends und Formate (aus dem Spiel selbst).** Welche Achse gewinnt, wird gemessen und gezeigt. KI-Teams ziehen im
   Fenster eine Saison verzögert nach, danach lohnt das Gegenmittel: ein Kreislauf ohne Würfel. Dazu wechseln je Saison
   zwei Disziplinen ihr **Format** (Canyon, Fünf Punkte und Tag-Team gibt es schon als Stempel im Spielstand); das
   verschiebt, welche Plätze zählen, ohne die Matrix anzufassen.
4. **Chronik und Rekorde.** Die Liga erinnert sich: Rekorde je Disziplin, Serien, Aufstieg und Niedergang von Teams,
   ewige Tabelle, Legenden. Sichtbar auf Startseite, in Profilen und im Saisonfinale.

Dazu eine **Dynastie-Bremse** mit Grund statt Gummiband: Stars des Meisters fordern mehr Gehalt, die Letzten wählen im
Nachwuchs zuerst, abgestiegene Teams verlieren Sponsor-Treue. KI-Teams bekommen damit eigene Bögen (Aufstieg, Blüte,
Niedergang), weil ihre Kasse, ihr Kader und ihr Potential über die Saisons wandern.

**KI:** stimmt nach Tabelle ab, folgt dem Trend verzögert, reagiert auf die Wirtschaftsstufe über Rücklage und
Kaufschwelle. **Last:** ein Zustand und ein Chronik-Eintrag je Saison, Rekorde 20 × wenige Werte. **Aufwand:** Chronik
und Rekorde S, Wirtschaftsstufe M, Regel der Saison M–L (jede Regel einzeln abzunehmen; Formate brauchen rho, Pp und
Fingerabdruck), Trends S als Anzeige, M mit KI-Nachzug. **Abnahme:** fünf Saisons mit 32 KI-Teams; der Kassen-Median
bleibt im Korridor, kein Team ist fünfmal in Folge Meister, mindestens ein Team wechselt in fünf Saisons zweimal die Liga.

## 11. Ausrüstung: der Kreislauf und die Kiste

**Kreislauf in sechs Schritten** (Mockup `kiste`, links):

1. **Woher:** Ruhm aus Punkten kauft Kisten; Laden für Geld (nur Standard und Selten, ein Kauf je Woche);
   Sponsor-Leihgabe ab Treue 70; Belohnung für Wimpel, Vorstandsziel, Derby-Sieg.
2. **Lager:** 16 Plätze je Verein, Duplikate werden Teile.
3. **Anlegen:** in der Einsatzliste direkt am Platz, je Spieler ein Feld Ausrüstung und ein Feld Verbrauch. Ein Knopf
   „Vorschlag“ rüstet wie die KI. Auch vom Spielerprofil und vom Lager aus.
4. **Wirkung:** Punkte on top in den Disziplinen des Gegenstands. Sichtbar an drei Stellen: Vorschau der Einsatzliste,
   kurze Einblendung in der Arena beim ersten Auftritt des Trägers (Symbol am Namensschild), Zeile „Ausrüstung“ in
   „Deine Entscheidungen“.
5. **Abnutzung:** Einweg weg, Leihgabe läuft ab, Verschleiß je Einsatz, Vollgas doppelt. Vor dem letzten Einsatz warnt
   die Einsatzliste.
6. **Zurück:** Reparatur mit Teilen (danach höchstens 80 %) oder zerlegen. Teile entstehen nur aus Beute, nie aus Geld.

**Kiste öffnen, drei Sekunden, überspringbar** (Mockup `kiste`, läuft beim Laden, „nochmal öffnen“ wiederholt):

| Zeit | Takt | Was man sieht |
|---|---|---|
| 0,0 s | Aufbau | Kiste im Lichtkegel, rüttelt, dumpfer Ton |
| 1,2 s | Spannung | Rütteln schneller, Deckel einen Spalt offen, Licht pulsiert **in der Farbe des seltensten Fundes**, Strahlen drehen an |
| 2,0 s | Deckel | springt federnd auf, Lichtsäule, Funken, Fanfare je Stufe |
| 2,3 s | Auftritt | drei Karten steigen nacheinander auf und drehen sich um |
| danach | Wahl | eine nehmen, zwei zerfallen sichtbar zu Teilen |

Die Farbe im Spalt ist der eigentliche Moment: eine halbe Sekunde Vorahnung. Zu dritt stehen epische und legendäre Funde
im Liga-Ticker. KI-Teams öffnen ohne Animation. Das Mockup ist eine CSS/SVG-Skizze; im Bau kommen Kiste und Effekte als
Bilder.

**PixelLab-Bedarf (Schätzung, nichts bestellt, nur Requisiten und Effekte):**

| Was | Generationen |
|---|---:|
| 3 Kisten (Holz, Eisen, Gold), je zu und offen | 6–9 |
| VFX: Lichtstrahl, Funken, Zerfall zu Teilen | 6–10 |
| rund 60 Gegenstands-Icons | 60–80 |
| Kartenrahmen je Seltenheit (4) | 4–6 |
| **Summe** | **rund 75–105** |

Erst Stilprobe (eine Kiste und fünf Icons, rund 8 Generationen), dann der Rest. Keine Figuren, keine Figuren-Animation;
die Bewegung der Kiste ist CSS über zwei Standbildern. Reserve 150 bleibt unberührt.

## 12. Was sich am Rahmen ändert

- Säule 1 „Kader“: die Lücke heißt jetzt **Eichung und Sicht** (B15); Nachwuchs und Abschied bleiben Welle 5.
- Säule 2 „Spieltag“: die Rückmeldung hat zwei Teile, **die Sendung** (Abschnitt 8) und „Deine Entscheidungen“.
- Säule 3 „Verein“: acht Elemente statt drei Bausteinen, Reihenfolge in Abschnitt 9.
- Säule 4 „Welt“: neben den kurzen Liga-Lagen vier Uhrwerke über die Saisons (Abschnitt 10). Das ist der größte Block.
- Wellen: Welle 2 bekommt zusätzlich B15 (Eichung, Profil), Chronik und Rekorde, Fans und Gebäude-Zweck. Wirtschaftsstufe
  und Regel der Saison folgen als eigene Welle zwischen 2 und 3, weil sie erst ab der zweiten Saison wirken und früh
  angelegt sein müssen. Die Übersicht `?ansicht=rahmen` zeigt noch den Stand der ersten Runde.

## 13. Neue offene Fragen (Runde 2)

1. **Liga-Mittel:** Zielkorridor −1 bis +1 für die Netto-Summe aller Attribute je Spieler und Saison, oder darf die Liga
   leicht wachsen (z. B. +1 bis +2)?
2. **Regel der Saison:** per Abstimmung der 32 Teams, oder legt die Liga sie fest und kündigt nur an?
3. **Identität:** drei Leitsätze frei wählbar je Saison, oder einmal gewählt und nur selten änderbar (stärkere Bindung)?
4. **Personal:** drei Stellen mit Typen gewollt, oder ist das zu viel Verwaltung neben den Gebäuden?
5. **Stilprobe Kiste:** rund 8 Generationen für eine Kiste und fünf Icons freigeben, damit die Animation mit echten
   Bildern gezeigt werden kann?

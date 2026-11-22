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

---

# Runde 3 (22.11.): zweites Feedback von Chris

Geänderte und neue Ansichten: `woche` (neu geordnet), `ausruestung` (Figur in der Mitte, Attribute, Vorschau), `zuruf` (neu).
In `spieltag-entscheidungen-rennen-22-11.html`: Gegnerspalte im Wasserfall, Rennen neu. **Liga: bleibt vorerst 2 × 16,
später möglicherweise 2 × 20. Entschieden, wird hier nicht weiter ausgearbeitet** (Abschnitt 5 bleibt als Begründung stehen).

## 14. Ausrüstung: Attribute statt Punkte

Chris: Gegenstände **erhöhen Attribute** eines Spielers um X, nicht pauschal das Ergebnis; Ausreißer bleiben gewollt, kein
Deckel aus der Matrix. Das ersetzt die Wirkungsregel aus B6 und Abschnitt 3.

- **Wirkung:** `Attribut mit Ausrüstung = Attribut + Bonus`, auch über das Potential und über 99 hinaus. Die Eignung wird
  wie immer aus der Matrix gerechnet, nur mit dem erhöhten Attribut. Was ein Gegenstand bringt, hängt damit am
  Matrixgewicht des Attributs in der Disziplin: +8 Power bringt im Climbing viel, im Speed-Schach nichts.
- **Drei Arten:** *disziplinspezifisch* (nur in ein bis zwei genannten Disziplinen aktiv, dafür stark), *Disziplinfarbe*
  (aktiv in allen Disziplinen einer Farbe POW/SPE/MEN/SOC), *allgemein* (immer aktiv, dafür schwächer).
- **Startwerte je Attribut:** Standard +3 bis +5, Selten +4 bis +8, Episch +8 bis +12, Legendär +12 bis +18 (oder auf zwei
  Attribute verteilt). Einweg-Teile liegen eine Stufe höher als ihre Seltenheit. Allgemeine Teile etwa halb so stark wie
  disziplinspezifische derselben Stufe.
- **Plätze:** fünf je Spieler, um die Figur herum wie in einem Rollenspiel: Kopf, Körper, Hände, Füße, Verbrauch
  (Mockup `ausruestung`). Bremse ist das Lager (16 je Verein), nicht die Zahl der Plätze.
- **Vorschau:** je Spieler die Eignung ohne und mit Ausrüstung für die Disziplinen der nächsten vier Spieltage, mit Rang im
  Team und dem Hinweis, wo es am meisten lohnt. Dazu **Vormerken**: ein Gegenstand wird für eine kommende Disziplin
  reserviert; die Einsatzliste legt ihn an und warnt, wenn er vorher verbraucht wird oder ausläuft.
- **Gezeigt = gebucht** wird einfacher als in Runde 1: eine Funktion liefert die wirksamen Attribute je Spieler, Disziplin
  und Spieltag; alles dahinter (Einsatzliste, Motor, Legacy-Wertung, KI, „Deine Entscheidungen“) rechnet unverändert.
- **Rangtreue und Pp:** weil der Bonus durch die Matrix läuft, verschiebt er die Attributanteile nicht: die Pp-Abweichung
  bleibt, gemessen an den wirksamen Attributen. rho gegen die Eignung **mit** Ausrüstung bleibt ebenfalls, rho gegen die
  nackten Attribute fällt nur, wenn viele schwache Spieler viel tragen. Die Modellrechnung aus Abschnitt 3 gilt der
  Richtung nach weiter; die Wirkung je Gegenstand ist kleiner (ein +8 auf ein Attribut mit 25 % Gewicht sind +2 Eignung),
  der Stapel aus fünf Plätzen kann sie aber wieder groß machen. Abnahme wie in Abschnitt 3 vorgeschlagen.
- **Abnehmer:** Training und Potential rechnen mit den nackten Attributen, Marktwert ebenso. Scouting zeigt bei fremden
  Spielern die getragene Ausrüstung offen (sie gehört dem Verein, nicht dem Spieler).
- **KI:** unverändert billig: für die zwei Disziplinen des Tages jeden Gegenstand an den aufgestellten Spieler, bei dem
  `Bonus × Matrixgewicht` am größten ist; vorgemerkt wird nichts, Einweg-Teile nach der Regel aus B6.

## 15. Die Woche: was sie braucht, damit sie zieht

Chris: „ok, kickt aber noch nicht“. Befund: die erste Fassung war eine Übersicht mit sechs gleich lauten Kästen. Eine
Woche zieht, wenn sie **einen Aufhänger** hat und höchstens drei echte Entscheidungen. Neu geordnet (Mockup `woche`):

1. **Die Liga-Lage steht vorn, mit ihren drei Antworten** (das, was Chris gut fand). Mitspieler haben verdeckt gewählt.
2. **Der fahrende Händler** daneben: nur diese Woche da, drei Angebote.
3. **Dein Zug** (eine Aktionskarte) und der **Spielplan** für den nächsten Spieltag (Haltung und Wenn-dann, Abschnitt 17).
4. Alles andere (Kader, Kiste, Vorstand) schrumpft auf eine Spalte „nur was Anlass hat“.

Was aus den übrigen Systemen noch in die Woche kann, jeweils nur wenn es anliegt: Schlagzeile der Sendung, Derby-Vorschau,
Abstimmung zur Regel der Saison (nur in der Winterpause), Potential-Pfeile (nur im Saisonwechsel), Fan-Stimmung,
Vormerk-Warnungen der Ausrüstung. Regel: nie mehr als ein Aufhänger und drei Entscheidungen; der Rest ist eine Zeile.

### 15.1 Katalog der Liga-Lagen (Skizze)

**Umfang:** rund 36 Lagen in sechs Kategorien, fünf je Saison gezogen. Bei drei bis vier neuen Saisons sieht man keine
Lage zweimal in derselben Lage der Liga. Jede Lage hat drei Antworten aus sechs Antworttypen.

| Kategorie | Anzahl | Beispiele | Wirkt auf |
|---|---:|---|---|
| Geld | 8 | Sponsorenflaute, Boom, Zuschauerschwund, Feiertagsspiele, Ticketpreis-Deckel, Steuerprüfung, Fernsehvertrag, Prämienregen | Sponsor je Spieltag, Stadion, Prämien |
| Markt | 6 | Transfer-Inflation, Gehaltsdruck, Materialknappheit, Ausverkauf beim Händler, Talentschwemme, Vertragswelle | Ablösen, Gehälter, Ladenpreise, Verlängerungen |
| Wetter und Körper | 6 | Hitzewelle, Kälteeinbruch, Grippewelle, Dauerregen, Reisestrapazen, goldener Herbst | Belastung, Erholung, Verletzungsrisiko |
| Regel | 6 | Schonfrist, Kartenruhe, Materialkontrolle, Flutlicht, strenge Schiedsrichter, Kader-Meldeschluss | Formkarten, Ausrüstung, Risiko, Prämien |
| Stimmung | 5 | Presse-Sommerloch, Fan-Protest ligaweit, Derby-Woche, Jubiläum der Liga, Wettskandal | Moral, Fan-Stimmung, Vertrauen |
| Disziplin | 5 | Trend-Disziplin (doppelte Prämie), Formatprobe, Rekordjagd, Gastschiedsrichter, Hallenwechsel | Prämien und Ruhm je Disziplin, Kulisse |

| Antworttyp | Muster | Wer wählt ihn (KI-Tabelle) |
|---|---|---|
| Aussitzen | nichts tun, volle Wirkung der Lage | Finanzwert hoch, Vorstand zufrieden |
| Investieren | Geld jetzt, Vorteil später oder Wirkung gemildert | Kasse über Rücklage, Ehrgeiz hoch |
| Sparen | Geld bekommen, Preis bei Moral oder Stimmung | Kasse unter Rücklage |
| Mannschaft | Kraft oder Training opfern, Moral gewinnen (oder umgekehrt) | Harmonie hoch, Kader breit |
| Fans | Stimmung einsetzen oder gewinnen | Beliebtheit hoch |
| Risiko | fester kleiner Vorteil gegen einen sichtbaren möglichen Nachteil am nächsten Spieltag | Außenseiter, im Rennen hinten |

**Balance:** jede Antwort hat einen Wert in einer gemeinsamen Verrechnungseinheit (1 C ≈ 4 Moral ≈ 3 Stimmung ≈ 0,3
Vertrauen ≈ 6 Erschöpfung im Kader, Startwerte); die drei Antworten einer Lage liegen innerhalb von ±15 %. Abnahme über
eine Saison mit 32 KI-Teams: keine Antwort wird von mehr als 60 % oder weniger als 15 % der Teams gewählt, und kein
Antworttyp bringt über die Saison mehr als 1 Tabellenplatz im Mittel. **KI:** reine Nachschlagetabelle aus Team-Matrix
(Finanzwert, Ehrgeiz, Beliebtheit, Harmonie) und zwei Lagewerten (Kasse zur Rücklage, Stand im Rennen); deterministisch,
kein Rechenweg. **Last:** Katalog im Code, je Saison fünf Lagen und 160 Antworten, rund 2 KB.

### 15.2 Winterpause und Händler: drei Varianten

Chris: der Halbzeitbericht gefällt; die Pause könnte ein eigener Status „Winterpause“ sein, in dem sich Transferfenster
oder Item-Shop öffnen. Alternativ Shop immer offen, oder fahrende Händler.

| Variante | Mehrspieler-Fairness | KI | Wirtschaft | Gefühl |
|---|---|---|---|---|
| **A Shop immer offen**, alle sehen dasselbe | perfekt gleich | einfach | Geld wird laufend zu Stärke: reiche Teams kaufen jede Woche das Beste | bequem, kein Anlass hinzusehen |
| **B Nur Winterpause** (Markt für alle, einmal je Saison) | gleich | einfach | ein großer Kaufmoment, dazwischen nichts; Kisten tragen die Woche allein | ein Höhepunkt, 19 Wochen leer |
| **C Fahrende Händler** (je Woche ein Händler je Team, drei Angebote, zieht weiter) | gleich **über die Zeit**: Reihum-Plan, jeder Händler kommt in einer Halbserie gleich oft zu jedem Team; in einer einzelnen Woche bewusst ungleich | Nutzwert je C über Schwelle, höchstens ein Kauf je Woche | kleines, stetiges Angebot; Preise folgen der Wirtschaftsstufe | „nur diese Woche“, Gesprächsstoff zu dritt |

**Empfehlung: C und B zusammen.** Unter der Saison fahrende Händler (vier bis fünf Händlertypen: Schmiedin für Kopf und
Hände, Schneider für Körper, Schuster für Füße, Kräuterfrau für Verbrauch, Trödler mit Gebrauchtem), in der
**Winterpause der Markt**, auf dem alle Händler für alle stehen. Die Winterpause wird damit ein eigener Status mit
Halbzeitbericht, Markt, Abstimmung zur Regel der Saison und Erholung. Sicherungen: gleicher Reihum-Plan für Mensch und KI
aus der Saat des Spielstands, drei Angebote je Besuch, höchstens ein Kauf je Woche, nur Standard bis Episch für Geld
(Legendäres bleibt Beute), Zahlung aus dem Investitionstopf unter der Vorstands-Freigabe. Variante A empfehle ich nicht:
sie macht aus Geld direkt Stärke und nimmt der Woche den Anlass.

**Transferfenster in der Winterpause:** wäre der stärkste Hebel für Comebacks, widerspricht aber der Entscheidung vom
18.11. (kein Handel in der Saison). Wenn überhaupt, dann klein: ein Zugang und ein Abgang je Team. Offene Frage.

## 16. Rückmeldung: Gegnerspalte und Rennen neu

- **Deine Entscheidungen mit Gegner:** jede Zeile des Wasserfalls hat rechts die Zahl des Gegners (Grundwert, Karte,
  Einsatzstufe, Captain, Form und Moral, Erschöpfung, Vorhersage, Spielverlauf, gespielt). Große Hebel des Gegners sind
  hell hinterlegt, der Satz darunter nennt den Grund („Lost Kingdom hat im Schach Vollgas und den Captain gesetzt“).
  Quelle: dieselbe Buchung der Gegenseite; nach dem Spieltag ist das alles öffentlich, vorher nichts davon.
- **Rennen neu:** statt einer Balkentabelle eine Seite je Rennen mit vier Tafeln: **Wie es so weit kam** (Abstand zur
  Linie über die Spieltage, zwei markierte Wendepunkte, ein Absatz Geschichte aus Regeln), **Wenn, dann** (drei gerechnete
  Szenarien: eigener Sieg, eigene Niederlage, Direktduell der Verfolger; Punktestände statt geschätzter Chancen),
  **Die entscheidenden Spieltage** (Restprogramm der Teams im Rennen, Farbe nach Kaderstärke in den zwei Disziplinen gegen
  diesen Gegner, Direktduelle hervorgehoben), **Direktvergleich** mit dem nächsten Rivalen (Punkte, Serie, Hinspiel, Rang
  der Kaderstärke in den verbleibenden Disziplinen). Die Balkentabelle bleibt als Reiter „Tabelle“.

## 17. Baustein B16: Entscheidungen im Spiel (Zuruf)

Chris: im Spieltag kleine Entscheidungen, die das Verhalten der eigenen Spieler ändern; bei zwanzig Disziplinen nicht so
leicht wie im Football Manager.

**Modell: drei Haltungen, die jede Disziplin anders übersetzt.**

| Haltung | Bedeutung überall | Wirkung (Startwert) |
|---|---|---|
| **Druck** | mehr wagen | Streuung des Ergebnisses +15 %, Erschöpfung +10 % |
| **Kontrolle** | sicher spielen | Streuung −15 % |
| **Kräfte sparen** | haushalten | Leistung −2 %, Erschöpfung −20 %, Verletzungsrisiko −25 % |

Beispiele der Übersetzung: Hockey (viele Schüsse und Forechecking / Scheibe halten / kurze Wechsel), Climbing
(Risiko-Route / sichere Route / Pausen an den Griffen), Speed-Schach (scharfe Eröffnung / solide Stellung / schnelle
Remis-Angebote), Gewichtheben (höheres Gewicht ansagen / sicheres Gewicht / einen Versuch auslassen), Staffel (früh
attackieren / Wechsel sicher / Tempo halten), Showcase (schwierige Nummer / saubere Kür / kürzeres Programm).

**Wann:** jede Disziplin hat drei Abschnitte und damit **zwei Wechselpunkte**. Die Arena ist ein vorgerechneter Lauf;
ein Anhalten mitten im Spiel würde alle anderen warten lassen und den Vorlauf sprengen. Deshalb zwei Stufen:

- **Stufe 1 (Empfehlung): Spielplan vor dem Spiel.** In der Einsatzliste je Disziplin eine Start-Haltung und bis zu zwei
  **Wenn-dann-Regeln** aus einer kurzen Liste von Bedingungen (Rückstand, Führung, Führung ab zwei, Spieler ab 65 müde,
  Captain fällt aus). Der Motor wertet die Regeln an den Wechselpunkten aus; die Arena zeigt den Moment als **Zuruf von
  der Bank** mit der Regel, die gegriffen hat (Mockup `zuruf`). Fühlt sich wie eine Entscheidung im Spiel an, hält
  niemanden auf, und drei Vorlagen („Favorit“, „Außenseiter“, „Kräfte sparen“) machen es zu einem Klick.
- **Stufe 2 (später): echtes Zuruf-Fenster** von wenigen Sekunden mit dem Spielplan als Standardwahl, nur wenn alle
  Menschen im Raum dasselbe Spiel sehen (Derby, Solo). Braucht einen Motorlauf in drei Teilen und gehört zum
  Spielabend-Modus.

**Gezeigt = gebucht:** der Spielplan reist wie Format und Formkarten im Kader-Umschlag zu Host, Runner und Node-Motor und
steht im Eingabe-Hash des Vorlaufs. „Deine Entscheidungen“ bekommt eine Zeile „Haltung“ je Abschnitt.

**Kein bester Knopf:** Druck und Kontrolle verschieben nur die Streuung, nicht den Erwartungswert; Kräfte sparen kostet
Leistung und zahlt in Kraft. Damit lohnt Druck für den Außenseiter und Kontrolle für den Favoriten, wie im Sport.

**Rangtreue:** mehr Streuung senkt rho. Schranke: je Haltung höchstens 0,01 unter dem Wert ohne, nie unter 0,75; die
Pp-Abweichung muss gleich bleiben (die Haltung hängt an keinem Attribut). Messung mit
`scripts/miss-alle-disziplinen.mjs` je Haltung, eigene Fingerabdruck-Zeilen außerhalb von GESAMT; ohne Spielplan bleibt
GESAMT unverändert (Standard „Kontrolle ohne Regeln“ = heutiges Verhalten, Streuung ±0).

**KI und Delegation:** Favorit nach Kaderstärke → Kontrolle; Außenseiter → Druck; mittlere Erschöpfung der Aufstellung ab
55 → Kräfte sparen; Regel „Führung ab zwei → Kräfte sparen“ immer. Deterministisch, eine Tabelle. Für Ramona
(Halbautomatik) setzt die KI den Spielplan mit.

**Einordnung:** Säule 2 „Spieltag“, ersetzt den schweren Baustein B11 „Spielweisen“ durch eine leichte, gemeinsame
Schicht; disziplin-eigene Spielweisen können später darauf aufsetzen. **Aufwand:** L insgesamt (zwanzig Übersetzungen im
Motor), deshalb in Scheiben: zuerst je ein Pilot pro Chassis (Feldspiel, Bahn, Bühne, Arena), dann der Rest.
**Abhängig von:** „Deine Entscheidungen“ (Rückmeldung), Opus-Review je Chassis. **Last:** ein paar Byte je Aufstellung,
kein zusätzlicher Motorlauf in Stufe 1.

## 18. Offene Fragen (Runde 3)

1. **Plätze je Spieler:** fünf (Kopf, Körper, Hände, Füße, Verbrauch) wie im Mockup, oder weniger, damit ein einzelner
   Spieler nicht zu weit über seine Eignung wächst?
2. **Händler:** fahrende Händler unter der Saison plus Markt in der Winterpause, wie empfohlen?
3. **Winterpause mit kleinem Transferfenster** (ein Zugang, ein Abgang), oder bleibt es bei „kein Handel in der Saison“?
4. **Zuruf Stufe 1** (Spielplan mit Wenn-dann vor dem Spiel) als Start, das echte Fenster erst mit dem Spielabend-Modus?
5. **Lagen mit Antworttyp „Risiko“** (sichtbarer möglicher Nachteil am nächsten Spieltag): gewollt, oder sollen alle
   Folgen fest sein?

---

# Runde 4 (22.11.): Regel-Abstimmungen, Schranke, Verteilungsziele

## 19. Baustein B17: Regel-Abstimmungen auf Zeit

Chris: „Regeländerungen, wenn es Votes gibt für Verteilung der Punkte, Blockieren von irgendwas usw. … Erlaubt, wenn es
nicht permanent im Code ist, sondern immer vorübergehend für max. eine Season oder nur wenige Spieltage.“ Das **ersetzt**
Uhrwerk 2 aus Abschnitt 10: es gibt keine bleibende „Regel der Saison“, nur **befristete Regeln als Stempel**.

**Ablauf.**
1. **Zwei Abstimmungen je Saison:** vor Spieltag 1 (gilt für die Hinrunde oder die ganze Saison) und in der Winterpause
   (gilt für die Rückrunde oder wenige Spieltage). Die Liga legt aus dem Katalog **zwei Vorschläge plus „alles bleibt“**
   vor, gezogen aus der Saat des Spielstands und passend zur Lage (Wirtschaftsstufe, Trend).
2. **Alle 32 Teams stimmen ab,** jedes mit einer Stimme, verdeckt, einfache Mehrheit; bei Gleichstand bleibt alles.
3. **KI stimmt nach Eigeninteresse:** je Vorschlag eine feste Nutzenformel aus Größen, die das Team schon hat
   (Kaderstärke nach Achse, Kaderbreite, Kasse zur Rücklage, Tabellenlage, Bestand an Ausrüstung und Formkarten). Größter
   Nutzen gewinnt, Gleichstand → „alles bleibt“. Deterministisch, keine Simulation.
4. **Menschen:** eine Stimme wie jedes Team, in der Woche bzw. im Halbzeitbericht. Vor der Abgabe sieht man, wem der
   Vorschlag nützt (eigene Formel, in Worten) und die Stimmung der Liga als grobe Tendenz, nicht das Ergebnis. Wer nicht
   abstimmt oder delegiert hat, bekommt die KI-Stimme. Das Ergebnis kommt als Meldung mit Stimmenzahl; die Stimmen der
   Mitspieler sind danach sichtbar.
5. **Ablauf der Frist:** die Regel endet von selbst. Dieselbe Regel kann frühestens in der übernächsten Abstimmung wieder
   vorgeschlagen werden.

**Katalog befristeter Regeln (Skizze, rund 18).**

| Gruppe | Regel | Dauer | Berührt die Wertung? |
|---|---|---|---|
| Punkte | Sieg zählt 3 statt 2 (Remis bleibt 1) | Halbserie | nein, nur die Tabellenbuchung |
| Punkte | Doppelpunkte-Spieltag (ein vorher benannter Spieltag) | 1 Spieltag | nein |
| Punkte | Vierergruppe 3-2-1-0 statt 2-1-0-0 | Halbserie | nein |
| Punkte | Bonuspunkt für einen Kantersieg (10 : 0 bis 9 : 2) | wenige Spieltage | nein |
| Blockieren | Kartenruhe: keine Formkarten | 2–3 Spieltage | nein, Eingabe |
| Blockieren | Materialkontrolle: epische und legendäre Ausrüstung gesperrt | 3–5 Spieltage | nein, Eingabe |
| Blockieren | Vollgas-Verbot oder höchstens eine Disziplin Vollgas je Spieltag | wenige Spieltage | nein, Eingabe |
| Blockieren | Captain-Pause | 2 Spieltage | nein, Eingabe |
| Kader | Rotationspflicht: niemand in beiden Disziplinen eines Spieltags | wenige Spieltage | nein, Eingabe |
| Kader | Einsatzgrenze: höchstens N Einsätze je Spieler in der Halbserie | Halbserie | nein, Eingabe |
| Belastung | Schonfrist: Verletzungsrisiko halbiert | wenige Spieltage | nein (Belastung) |
| Belastung | Harte Wochen: Erholung −20 %, dafür Prämien +20 % | wenige Spieltage | nein |
| Belastung | Zweite Pause (zusätzlicher Ruhe-Spieltag nach Spieltag 15) | einmalig | nein |
| Geld | Prämientopf: Sieger eines Spieltags bekommt Bonus aus Umlage | Halbserie | nein |
| Geld | Gehaltsbremse: Verlängerungen höchstens +10 % | Saison | nein |
| Geld | Solidaritätsfonds: die unteren vier bekommen je Spieltag Zuschuss | Halbserie | nein |
| Format | Format-Variante einer Disziplin (z. B. Climbing Standard statt Canyon) | Halbserie | **ja**, nur vorhandene, abgenommene Formate |
| Format | Trend-Disziplin: doppelter Ruhm und Prämie in einer Disziplin | Halbserie | nein |

**Keine dauerhafte Code-Änderung.** Jede Regel ist ein Eintrag im Katalog mit Parametern und ein **Stempel im
Spielstand**: `seasonState.ligaRegeln = [{ id, parameter, vonSpieltag, bisSpieltag, stimmen }]`, nach dem Muster von
`wertungsSkalen`, `climbingFormat` und `battlefieldFormat`. Jeder Rechenweg fragt „welche Regel gilt an diesem
Spieltag“, nie eine Prozess-Variable. Gebuchte Spieltage behalten ihre Regel (Replay rechnet mit dem Stempel), ein
Notschalter je Regel-ID nimmt eine Regel ab dem nächsten Spieltag aus dem Spiel. Fällt der Katalogeintrag weg, bleibt der
Standard übrig: das ist der Rückweg.

**Gezeigt = gebucht.** Die geltenden Regeln stehen als Band auf Startseite, Einsatzliste und Arena („Kartenruhe · noch 2
Spieltage“) und in „Deine Entscheidungen“. Punkteregeln wirken nur in der Tabellenbuchung; die Arena-Wertung und der
Fingerabdruck bleiben unberührt. Format-Regeln nutzen ausschließlich Formate, die schon abgenommen sind und eigene
Fingerabdruck-Zeilen haben.

**Balance und Abnahme.** Je Regel ein Messlauf mit 32 KI-Teams: die Regel darf die Endplatzierung im Mittel um höchstens
einen Platz verschieben und keinem Kaderprofil dauerhaft nützen; über fünf Saisons soll jede Regelgruppe einmal gewinnen.
**Aufwand:** Abstimmung und Stempel M; je Regel S (Eingabe- und Punkteregeln) bis M (Format). **Last:** wenige Byte je
Regel, 32 Stimmen je Abstimmung. **Mehrspieler:** die Abstimmung ist ein gemeinsamer Moment zu dritt; drei von 32 Stimmen
entscheiden selten allein, deshalb lohnt das Werben. Schreibweg hinter `authorizeServerRoomWrite`.

## 20. Rangtreue: die Schranke gilt für die Mechanik

Chris: die Schranke 0,75 gilt **nur gegen die reine Eignung, für die Mechanik ohne On-top-Effekte**. Form, Moral,
Formkarten, Ausrüstung und Zurufe zählen nicht dagegen: „da sind Spieler einfach gut drauf, haben bessere Ausrüstung etc.
Das MUSS sich ja sogar auswirken, dass Schwächere besser sein könnten.“

Damit gilt, und ersetzt die Abnahmevorschläge in den Abschnitten 3, 14 und 17:

- **Abnahme = Mechanik ohne On-top gegen 0,75** (Ziel über 0,80), gemessen wie heute mit ausgeschalteter Ausrüstung, ohne
  Zuruf, ohne Formkarten. Der Fingerabdruck GESAMT bleibt in diesem Zustand unverändert.
- **On-top-Effekte werden gemessen und gezeigt, aber nicht gegen die Schranke geprüft.** Die „Menge im Umlauf“ ist keine
  Abnahmebedingung mehr, nur noch eine **Balance-Empfehlung**: Ausrüstung soll Spiele kippen können, aber nicht jede
  Tabelle bestimmen. Richtwert zum Beobachten, kein Zwang: in einer Saison mit 32 KI-Teams entscheidet Ausrüstung
  höchstens etwa jedes sechste Duell anders, als es ohne ausgegangen wäre.
- **Pflicht bleibt, dass on top sichtbar ist** (gezeigt = gebucht): eine Zeile je Effekt in der Einsatzliste und in
  „Deine Entscheidungen“, bei beiden Seiten.
- Die Pp-Pflichtprüfung (≤ 25) bleibt für die Mechanik ohne On-top bestehen.

Offene Frage 1 aus Abschnitt 6 und die rho-Schranke je Haltung aus Abschnitt 17 sind damit erledigt.

## 21. Kader: Verteilungsziele für Entwicklung, und Training gegen Leistung

Chris: nur wenige Spieler sollen sich stark verbessern und wenige stark verschlechtern, die Masse kaum. Und zwischen
Trainingspunkten (SP) und Leistung in PP muss ein gesundes Verhältnis bestehen: wer spielt und leistet, entwickelt sich
plausibel; Training ersetzt nicht Leistung und umgekehrt. Das schärft Abschnitt 7.

**Verteilungsziel je Saison** (Netto-Summe aller zwölf Attribute je Kaderspieler; Startwerte, an einem Messlauf zu eichen):

| Gruppe | Änderung | Anteil der Spieler |
|---|---|---:|
| stark verbessert | +6 und mehr | 5–8 % |
| leicht verbessert | +2 bis +5 | 15–20 % |
| kaum verändert | −1 bis +1 | 50–60 % |
| leicht verschlechtert | −2 bis −5 | 15–20 % |
| stark verschlechtert | −6 und weniger | 5–8 % |

Dazu: Liga-Mittel zwischen −1 und +1, Median 0, im Schlüsselattribut höchstens +3 je Saison außer bei den „stark
verbessert“. Heute liegt das Liga-Mittel bei +6,8 und der Median des Schwerpunkt-Attributs bei +2,4: fast alle legen zu.

**Zwei Quellen, die sich brauchen.**
- **SP (Training)** bestimmen, **wohin** ein Spieler wächst: Ziel-Disziplin und Weg, wie gebaut.
- **PP (Leistung)** bestimmen, **wie viel davon ankommt**: ein Faktor auf den Trainingsertrag der Saison aus den PP je
  Einsatz gegen den Liga-Median der Rolle. Startwert: von 0,6 (kaum gespielt oder weit unter Median) bis 1,4 (regelmäßig
  deutlich darüber). Ohne Training kommt auch mit vielen PP nichts an; ohne Einsätze kommt vom Training nur gut die
  Hälfte an.
- PP aus On-top-Effekten zählen dabei nicht doppelt: maßgeblich ist die Leistung gegen die **Erwartung mit Ausrüstung**,
  sonst kauft Ausrüstung Entwicklung.

**Abnahme „gesundes Verhältnis“** (derselbe Fünf-Saisons-Lauf wie in Abschnitt 7):
1. Die Verteilung trifft die Tabelle oben in jeder der fünf Saisons.
2. Unter den „stark verbessert“ haben mindestens 80 % **beides**: Trainingsziel gehalten und PP je Einsatz über dem Median.
3. Anteil des Zuwachses, der allein durch SP erklärt wird, und Anteil allein durch PP: je höchstens 60 % (keine Quelle
   dominiert); gemessen als Rangkorrelation Zuwachs gegen SP und Zuwachs gegen PP, beide zwischen 0,3 und 0,7.
4. Ein Bankspieler mit hartem Training und ohne Einsätze landet in „kaum verändert“ oder „leicht verbessert“, nie in
   „stark verbessert“. Ein Stammspieler ohne Trainingsziel ebenso.
5. Die Zahl der „stark verschlechtert“ kommt überwiegend aus den Auslösern (kaum Einsätze, lange verletzt, überlastet),
   nicht aus dem Zufallsrest: mindestens 70 %.

**Sicht:** im Profil neben der Karrierekurve zwei Balken je Saison, „Training“ und „Leistung“, und ein Satz („viel
trainiert, wenig gespielt: der Ertrag blieb bei 60 %“). **KI:** unverändert; sie profitiert automatisch, weil sie
Stammspieler trainiert. **Aufwand:** S zusätzlich zu Abschnitt 7 (ein Faktor in der Saisonend-Progression und die
Auswertung im Messskript). Die Skala der PP (bester Spieler um 5 je Disziplin) bleibt unberührt.

## 22. Entschieden in dieser Runde

- **Liga:** 2 × 16 bleibt.
- **Regeln:** nur befristet, als Stempel (Abschnitt 19).
- **Schranke 0,75:** nur für die Mechanik ohne On-top (Abschnitt 20).
- Die offenen Fragen zu Teil A (drittes Rennen, Gegenprobe, Sicht auf Mitspieler) sind entschieden, siehe
  `spieltag-entscheidungen-rennen-22-11.md`.

**Offen bleiben** die fünf Fragen aus Abschnitt 18 und aus Abschnitt 13 die Fragen 1 (Korridor des Liga-Mittels), 3
(Identität), 4 (Personal) und 5 (Stilprobe Kiste).

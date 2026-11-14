# Artikel-Drawer aufräumen (Vorschlag, 14.11.2026)

Nur Vorschläge, kein Code geändert. Grundlage: `apps/LEC/src/components/sortiment/ArtikelDetail.tsx`,
`ArtikelKennzahlen.tsx`, `src/app/globals.css` (Klassen `bd-dt-*`, `bd-grp*`), `src/app/api/article-detail/[id]/route.ts`.
Zeilennummern beziehen sich auf den Stand vom 14.11.2026.

**Visuell geprüft:** ja. Demo-Datenbank (300 erfundene Artikel, Kopie), `next dev` auf Port 3312, Playwright/Chromium,
dunkles Thema in 1440x900 und 390x844, fünf Artikel (Zeilen 1, 4, 8, 13, 21 der Kompakt-Liste) mit allen Gruppen
aufgeklappt, zusätzlich einmal helles Thema. Die Demo-Artikel haben keine Bilder, keine importierten Einkäufe, keine
eBay-Berichte und keinen Set-Code-Konflikt: Kartenbild, Gruppe „Einkäufe“ (gefüllt), „eBay-Verkaufsberichte“ und das
Banner „Name und Set-Code passen nicht zusammen“ sind deshalb **nur am Code** beurteilt.

Gemessen: Der Drawer ist auf dem Laptop 720 px breit (`max(480px, 50vw)`), aufgeklappt 1.720 bis 2.540 px hoch
(Handy: 2.200 bis 3.650 px). Auf 1440x900 sind ohne Scrollen sichtbar: Kopf, zwei Zeilen Knöpfe, sieben Kacheln in
drei Zeilen, bis zu drei Hinweiskästen und mit Glück der Anfang von „Cardmarket“.

## 1. Kurzfazit

Der Drawer zeigt nichts Falsches, aber dieselbe Aussage bis zu fünfmal (letzter Verkauf, Gewinn je Stück, Verkäufe in 365 Tagen, Reichweite, EK), und zwei Stellen rechnen dieselbe Preisänderung verschieden aus. Die Kacheln sind durch zwei- bis dreizeilige Untertexte ungleich hoch, eine siebte Kachel hängt allein in der dritten Zeile, und bis zu vier Rahmenfarben plus drei Hinweiskästen stehen gleichzeitig im ersten Bildschirm. Vorschlag: oben eine einzige Entscheidungszeile (Preis, Lager, Sortiment), darunter acht gleich hohe Kacheln in zwei Zeilen mit Untertexten von höchstens sechs Wörtern, alles Herleitende in den Hover. Aus neun Gruppen werden fünf (Markt, Verkäufe, Ergebnis, Lager, Schwund & Retouren), auf dem Laptop zweispaltig, so dass Entscheidung, Kacheln, Markt und Verkäufe ohne Scrollen sichtbar sind. Abschnitt 7 nennt, was die vorhandenen Daten zusätzlich hergeben (Verläufe als Mini-Grafik, Verkaufspreis je Einzelverkauf, Warenkorb und Mitkäufe über `Sale.orderRef`) und was erst ein weiteres Feld beim Billbee-Abruf braucht (Land, Versandart, Zahlungsart, Kanal).

## 2. Doppelungen

`AD` = `ArtikelDetail.tsx`, `AK` = `ArtikelKennzahlen.tsx`. Beispielwerte aus dem Demo-Artikel „Drachenkaiser von Arkadia“.

| Nr. | Was | Wo doppelt | Was bleibt |
|---|---|---|---|
| D1 | **Letzter Verkauf** (Datum bzw. Tage) | (a) Untertext der Kachel „Max. EK für 25 %“: „letzter Verkauf vor 90 Tagen“ (AD 328, sachfremd an dieser Kachel); (b) Hinweiskasten VK-Änderung: „Letzter Verkauf am 16.08.2026 zu 11,75 €“ (AD 296-301); (c) erste Verkaufszeile in „Warenbewegungen“ (AD 121); (d) Kachel Bestand: „kein Verkauf in 90 Tagen“ (AD 235); (e) Kachel Empfohlen: „seit 374 Tagen kein Verkauf“ (AD 219) | Eine Stelle: Kopfzeile der Gruppe „Verkäufe“ („zuletzt 16.08.2026 · 11,75 €“). (a), (b), (d) entfallen sichtbar, die Rotfärbung bei über 90 Tagen wandert an diese Kopfzeile. (e) bleibt im Hover der Kachel Zielspanne. |
| D2 | **Verkäufe im Fenster mit Schnittpreis** („13 Verkäufe in 365 Tagen im Schnitt für 12,98 €“) | (a) Hinweiskasten unter den Kacheln (AD 239-246); (b) Zeile „365 Tage“ der Verkaufstabelle: 13 / 12,98 € (AD 359-369); (c) Untertext der Kachel Sortiment: „13 Verkäufe in 365 Tagen, 1,19 € Gewinn je Stück“ (AD 225) | Tabelle (b). Vom Kasten (a) bleibt nur das Urteil als Zusatz an der Kachel „Dein VK“ („Preis wird gezahlt“ bzw. „vom Markt bestätigt“), der ganze Satz steht im Hover. (c) in den Hover der Sortiment-Aussage. |
| D3 | **Gewinn je Stück** (1,19 €) | (a) Kachel „Gewinn je Stück“ (AD 308-313); (b) Untertext Sortiment (AD 225); (c) „Bestand ergibt 1,19 € Gewinn“ unter „Gebundenes Kapital“ (AD 323, bei Bestand 1 dieselbe Zahl) | Kachel (a). (b) Hover. (c) bleibt als eigene Zeile „Gewinn im Bestand“ in der Gruppe „Ergebnis“. |
| D4 | **Reichweite und Nachbestellmenge** | (a) Kachel Bestand: „Reichweite ca. 1,0 Monate · Nachbestellen: 2 Stk“ (AD 235); (b) Kasten „Nachbestellen fällig – Reichweite nur noch ca. 1,0 Monate. Empfehlung: 2 Stk nachbestellen.“ (AD 248-266); zusätzlich „NACHBESTELLEN“ in der Listenzeile dahinter | Entscheidungszeile oben („2 Stk nachbestellen“ mit Zurückstellen-Knopf). Die Kachel Bestand zeigt nur noch Stück und Reichweite; die Menge steht nicht mehr in der Kachel. |
| D5 | **Marktwert** (6,97 €) | (a) Kachel Marktwert (AD 228); (b) Untertext „Marge Nachkauf“: „Nachkauf zum Marktwert 6,97 €“ (AD 233) | Kachel (a); (b) in den Hover. |
| D6 | **Zusammensetzung des Marktwerts** | (a) Untertext Marktwert: „Ø aus Trend, 1, 7, 30 Tage, ab (doppelt) und letztem EK“ (AD 228); (b) Gruppe Cardmarket zeigt genau diese Werte (AD 336-345); (c) `title` der ab-Zeile: „zählt doppelt im Marktwert“ (AD 339) | Gruppe „Markt“ (b). (a) in den Hover der Kachel, (c) bleibt als Hover der ab-Zeile, zusätzlich sichtbar als „×2“ hinter „ab“. |
| D7 | **Dein VK** (12,99 €) | (a) Kachel (AD 218); (b) Kasten VK-Änderung: „dein VK heute 12,99 €“ (AD 299); (c) Untertext Gewinn je Stück: „heutiger VK, aktueller EK, vor Fixkosten“ (AD 312) | Kachel (a). (b) entfällt mit D1, (c) Hover. |
| D8 | **Dieselbe Preisänderung, zweimal verschieden gerechnet** | (a) Kasten „Letzte VK-Änderung am 09.09.2026: 14,99 € → 17,99 € (erhöht) · Tempo 1,5 Stk/Monat davor, 0,9 danach“ (AD 279-292, rechnet 60 Tage davor gegen alle Tage danach); (b) Gruppe Kennzahlen: „Preis 09.09.2026: 14,99 € → 17,99 € (+20 %) · läuft seitdem langsamer · vorher 1,5 → nachher 0,5 Stk/Monat“ (AK 62-79, Rechnung aus `kennzahlen.ts`); (c) Kachel Sortiment: „· 62 T am Preis“ (AD 225) | Eine Zeile „Preis“ in der Gruppe „Verkäufe“ mit dem Urteil aus (b), weil es auch „zu wenig Daten“ kennt. Die Zahlen aus (a) stehen im Hover derselben Zeile (als „grob: …“). Im Bild sah das so aus: derselbe Artikel, einmal 0,9 und einmal 0,5 Stk/Monat nach der Änderung. Die Rechnung selbst wird nicht angefasst, siehe Abschnitt 6. |
| D9 | **Verkaufstempo (Stk/Monat)** | (a) Untertext „Gewinn je Monat“: „1,0 Stk/Monat“ (AD 318); (b) Kennzahlen „Tempo mit Bestand 1,1 Stk/Monat“ (AK 55-56); (c) Tempo im Kasten VK-Änderung (AD 288); (d) steckt in der Reichweite (AD 235) | (a) als Untertext der Kachel „Gewinn/Monat“ (das ist die Rechengrundlage). (b) bleibt in „Lager“ neben „Tage ohne Bestand“, weil es eine andere Größe ist (nur Tage mit Bestand). (c) Hover (D8). |
| D10 | **EK je Stück** (6,82 €) | (a) Kachel „Ø EK“ (AD 236); (b) Untertext derselben Kachel „Liste: 6,82 €“, auch wenn identisch; (c) jede Verkaufszeile der Warenbewegungen: „EK ca. 6,82 € je Stück“, im Bild 21-mal untereinander (AD 121); (d) „Gebundenes Kapital 6,82 €“ bei Bestand 1 | Kachel (a). (b) nur zeigen, wenn Liste und Ø abweichen, sonst Hover. (c) ersetzen durch den **Verkaufspreis** der Zeile (liegt als `unitPrice` vor, wird heute nicht gezeigt, obwohl die Spalte „Preis / Detail“ heißt); der EK steht einmal im Hover des Spaltenkopfs. |
| D11 | **Platz „#108/216“** | Sechs Stellen tragen „/216“: Untertexte Marge Nachkauf und Gewinn je Monat (AD 233, 318), vier `RankTag` in der Verkaufstabelle (AD 364-365) | Überall nur „#108“; „von 216 aktiven Artikeln“ steht schon im `title` des `RankTag` (AD 513) und kommt genauso in den Hover der Kacheln. |
| D12 | **Einkäufe** | (a) Gruppe „Einkäufe“ (AD 423-449); (b) Zeilen „Einkauf“ in den Warenbewegungen: „gekauft zu … EK je Stück · Quelle“ (AD 122); (c) Fußnote Warenbewegungen „Einkäufe gibt es nur, wenn sie importiert wurden“ (AD 418) gegen „Keine Einkäufe importiert.“ (AD 426) | Eine Gruppe „Lager“ mit Summenzeile und Bewegungsliste (Zugänge, Einkäufe, unerklärte Abgänge). Der Leertext steht einmal. |
| D13 | **Verkäufe an drei Orten** | (a) Fenster-Tabelle „Verkäufe“ (AD 348-372); (b) Einzelverkäufe in „Warenbewegungen und letzte Verkäufe“ (AD 395-421); (c) „eBay-Verkaufsberichte“ mit Stück und Ø Preis je Zeitraum (AD 451-469) | Eine Gruppe „Verkäufe“: Fenster-Tabelle offen, darunter „Einzelverkäufe (n)“ und „eBay-Berichte (n)“ als eingeklappte Unterzeilen. |
| D14 | **Name, Code, Seltenheit im Kopf** | Titel „Drachenkaiser von Arkadia“ + Zeile „PHNI-DE007 · PHNI-007 · Super Rare“ + voller Billbee-Titel „Yu-Gi-Oh! PHNI-DE007 Drachenkaiser von Arkadia Super Rare NM“ (AD 180-187) | Titel und Kennzeichen-Zeile. Der volle Billbee-Titel wird `title` der Überschrift; das Einzige, was nur dort steht, ist der Zustand (NM), der als eigenes Kennzeichen in die Zeile kommt (`row.market.condition`, sonst aus dem Titel). |
| D15 | **„Billbee liefert das nicht“ dreimal erklärt** | Kasten VK-Änderung: „Billbee liefert keine Preishistorie, die App schreibt Änderungen ab jetzt … mit“ (AD 294); Fußnote Warenbewegungen: „Billbee liefert keine Lagerhistorie …“ (AD 418); Schwund: „Sie ändern den Bestand nicht, den führt Billbee.“ (AK 105-107) | Jede Erklärung nur noch im Hover der jeweiligen Überschrift, sichtbar bleibt der Kurztext (siehe Abschnitt 3). |
| D16 | **Zielmarge 25 %** | „25–33 % Marge“ (Empfohlen, AD 219), „Max. EK für 25 %“ (AD 327), Farbschwelle 25 % an zwei Kacheln | Bleibt an beiden Stellen (verschiedene Aussagen), aber nur noch als Hover-Text bei der Zielspanne; sichtbar steht dort der Sonderfall (Ladenhüter-Abschlag, Marktdeckel) oder nichts. |
| D17 | **Drei Prozentzahlen, die wie dieselbe aussehen** | „Marge Nachkauf 7 %“ (AD 229-234), „Gewinn je Stück 1,19 € · 9 %“ (AD 311), „DB II 1,21 € · 9 %“ (AD 378) | Alle drei bleiben (verschiedene Rechnungen), aber getrennt: Marge Nachkauf in der Preis-Zeile, Gewinn/Stück in der Ertrags-Zeile, DB II nur in der zugeklappten Gruppe „Ergebnis“ mit der Unterüberschrift „historisch“. |

## 3. Beschriftungen

Vorschlag zur Technik (ein Umbau, der alle Zeilen der Tabelle trägt): `Stat` bekommt statt eines `hint` zwei Felder,
`sub` (sichtbar, höchstens 6 bis 8 Wörter) und `info` (Hover, `title`). Auf Geräten ohne Maus (`@media (hover: none)`)
erscheint oben rechts in der Kachel ein kleines „?“; ein Tipp darauf klappt den `info`-Text unter der Kachel auf.
Dasselbe für Gruppen-Überschriften und Tabellenzeilen (`title` plus „?“). Zahlen in den Hover-Texten sind Platzhalter
für die vorhandenen Werte.

### 3.1 Kopf und Knopfleiste

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Kopf, voller Titel (AD 187) | „Yu-Gi-Oh! PHNI-DE007 Drachenkaiser von Arkadia Super Rare NM“ als eigene Zeile | entfällt als Zeile; neues Kennzeichen „NM“ neben der Seltenheit | Auf der Überschrift: „Titel in Billbee: {nameRaw}“ |
| Knopf (AD 537) | „Preis bei eBay ändern ↗“ | „Preis ändern ↗“ | „Öffnet das Bearbeiten-Formular des Angebots bei eBay.“ (unverändert) |
| Knopf (AD 541) | „Bei eBay beenden ↗“ | „Beenden ↗“ | „Öffnet deine aktiven eBay-Angebote (Seller Hub), gefiltert auf diese Karte. Dort kannst du das Angebot beenden.“ (unverändert) |
| Knopf (AD 544) | „Angebot ansehen ↗“ / „Im eBay-Shop suchen ↗“ | „Angebot ↗“ / „eBay-Suche ↗“ | „Zeigt das Angebot bei eBay.“ / „Kein Angebot hinterlegt: sucht die Karte in deinem eBay-Shop.“ |
| Knopf (AD 548) | „Bei Cardmarket ansehen ↗“ | „Cardmarket ↗“ | „Sucht die Karte bei Cardmarket (Sprache der Karte, ab NM).“ (unverändert) |
| Knopf (AD 563) | „Zum Auslisten markieren“ / „✓ Zum Auslisten markiert (aufheben)“ | „Auslisten vormerken“ / „✓ Vorgemerkt“ | unverändert: „Karte zum Auslisten vormerken, damit du sie später im Ordner findest (Filter „Zum Auslisten markiert“) · {Ordner}“ / „Markierung zurücknehmen“ |
| Knopf (AD 565) | „Ausblenden“ / „Wieder einblenden“ | unverändert | unverändert |

Mit den kurzen Texten passen alle sechs Knöpfe bei 720 px in eine Zeile (heute zwei), auf dem Handy in zwei (heute drei).

### 3.2 Entscheidungszeile (neu, ersetzt Sortiment-Kachel und drei Hinweiskästen)

Drei feste Felder nebeneinander, jedes mit Farbe nur dann, wenn etwas zu tun ist.

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Feld „Preis“ (aus `m.status`, heute nur Rahmenfarbe der Kachel Dein VK, AD 159) | kein Text, nur gelber/grüner/blauer Rahmen | „Preis: zu günstig“ / „Preis: passt“ / „Preis: zu teuer“ / „Preis: kein Urteil“ | „Dein VK {vk} gegen die Zielspanne {min} – {opt}. Zu günstig liegt unter, zu teuer über der Spanne.“ |
| Zusatz am Feld „Preis“ (Kasten AD 239-246) | „13 Verkäufe in 365 Tagen im Schnitt für 12,98 € – Preis wird gezahlt.“ / „… der Markt nimmt diesen Preis, das Urteil „zu teuer“ entfällt.“ | „wird gezahlt“ / „vom Markt bestätigt“ | „{n} Verkäufe in {Tage} Tagen im Schnitt für {Ø}.“ bzw. zusätzlich „Der Markt nimmt diesen Preis, das Urteil „zu teuer“ entfällt.“ |
| Feld „Lager“, fällig (AD 250-253) | „Nachbestellen fällig – Reichweite nur noch ca. 1,0 Monate. Empfehlung: 2 Stk nachbestellen.“ | „Lager: 2 Stk nachbestellen“ | je Grund: „Bestand {n} liegt auf oder unter dem Mindestbestand {min}. Reichweite ca. {x} Monate.“ / „Ausverkauft, der Artikel verkauft sich.“ / „Reichweite nur noch ca. {x} Monate.“ |
| Knopf im Feld „Lager“ (AD 255-263) | „Erstmal nicht nachbestellen“ + Auswahl „90 Tage“ | „Zurückstellen“ + Auswahl „90 T“ | unverändert: „Du hast den Artikel geprüft und willst ihn jetzt nicht nachbestellen: er verschwindet für die gewählte Zeit aus „Nachbestellen fällig“ und den Empfehlungen.“ |
| Feld „Lager“, zurückgestellt (AD 267-273) | „Nachbestellung zurückgestellt bis 12.02.2027.“ + „Wieder aktivieren“ | „Lager: zurückgestellt bis 12.02.2027“ + „Aktivieren“ | „Nachbestellen ist bis zum Datum ausgesetzt. „Aktivieren“ nimmt den Artikel wieder in die Empfehlungen.“ |
| Feld „Lager“, sonst (AD 275, `reorderSkipReason`) | ganzer Satz als Kasten | „Lager: kein Nachkauf“ / ohne Grund „Lager: reicht {x} Monate“ / ohne Tempo „Lager: {n} Stk, kein Tempo“ | der bisherige Satz `reorderSkipReason` wörtlich |
| Feld „Sortiment“ (Kachel AD 220-227) | „Sortiment · Behalten · 13 Verkäufe in 365 Tagen, 1,19 € Gewinn je Stück. · 90 T am Preis“ | „Sortiment: Behalten“ (bzw. Beobachten, Prüfen, Auslisten …) | `row.sortiment.reason` wörtlich, dahinter „Seit {n} Tagen am aktuellen Preis.“ |
| Banner Set-Code (AD 191-214) | fünf Zeilen Fließtext | bleibt als einziger Kasten, über der Entscheidungszeile: „Code {setCode} gehört zu {Name}.“ + zweite Zeile „In Billbee und bei eBay korrigieren.“ | „Der Titel nennt einen anderen Namen. Zum Namen im Titel passt: {hint}. Der Marktwert gilt für {usedCode}, den eindeutigen Code zum Namen.“ bzw. „… Es gibt keinen eindeutigen Code zum Namen, darum steht hier kein Marktwert und kein Urteil.“ |

### 3.3 Kacheln (acht, zwei Zeilen)

| Stelle | heute | neu (Titel · Untertext) | Hover-Text |
|---|---|---|---|
| Dein VK (AD 218) | „Dein VK“ · „aus eBay (Stand des letzten Shop-Abrufs)“ / „aus Billbee“ | „Dein VK“ · „aus eBay“ / „aus Billbee“ | „Preis aus eBay, Stand des letzten Shop-Abrufs.“ / „Preis aus dem Billbee-Artikelstamm.“ Die Rahmenfarbe zeigt das Preisurteil. |
| Empfohlen (AD 219) | „Empfohlen“ · „25–33 % Marge“ / „mit Marktdeckel“ / „−30 % Ladenhüter-Abschlag: seit 374 Tagen kein Verkauf“ · „dynamisch 9,99 € (…)“ | „Zielspanne“ · im Normalfall leer; sonst „mit Marktdeckel“ / „−30 % Ladenhüter“; mit dynamischem VK zusätzlich „dynamisch 9,99 €“ | „Spanne für 25 bis 33 % Marge auf deinen EK.“ Je Fall ergänzt: „Oben begrenzt durch den Marktwert.“ / „Um 30 % gesenkt, weil seit {n} Tagen kein Verkauf.“ / „Dynamischer VK {x}: {dynamicNote}.“ |
| Marktwert (AD 228) | „Marktwert“ · „Ø aus Trend, 1, 7, 30 Tage, ab (doppelt) und letztem EK · Zustand EX: 85 % vom NM-Preis“ | „Marktwert“ · „Cardmarket“; bei Zustand unter NM „EX · 85 % von NM“ | „Durchschnitt aus Trend, Ø 1, 7 und 30 Tage, ab (zählt doppelt) und letztem EK. Zustand {EX}: {85} % vom NM-Preis (EX 85, GD 70, LP 60, PL 45, Poor 30 %).“ |
| Marge Nachkauf (AD 229-234) | „Marge Nachkauf“ · „Nachkauf zum Marktwert 6,97 € · Platz #108/216“ | „Marge Nachkauf“ · „Platz #108“ | „Marge deines VK, wenn du die Karte zum Marktwert {6,97 €} nachkaufst. Platz {108} von {216} aktiven Artikeln; unter 25 % gelb, unter 0 rot.“ |
| Gewinn je Stück (AD 308-313) | „Gewinn je Stück“ · „1,19 € · 9 %“ · „heutiger VK, aktueller EK, vor Fixkosten“ | „Gewinn/Stück“ · „vor Fixkosten“ | „Heutiger VK minus eBay-Gebühren, Versand und Verpackung minus aktueller EK.“ Ohne Listenpreis: „Gerechnet mit dem Ø-VK, weil kein Listenpreis vorliegt.“ |
| Gewinn je Monat (AD 314-319) | „Gewinn je Monat“ · „1,0 Stk/Monat · Platz #33/216“ / „kein Absatz“ | „Gewinn/Monat“ · „1,0 Stk/Monat · #33“ / „kein Absatz“ | „Gewinn je Stück mal Verkaufstempo ({1,19 €} × {1,0} Stk/Monat). Platz {33} von {216} aktiven Artikeln.“ |
| Bestand (AD 235) | „Bestand“ · „1 Stk“ · „Reichweite ca. 1,0 Monate · Nachbestellen: 2 Stk · Min 2 · Soll 4“ | „Bestand“ · „reicht 1,0 Monate“ / „kein Verkaufstempo“ / „kein Verkauf in 90 T“. Wert bei Bestand 0: „0 Stk“ (heute „—“) | „Bestand geteilt durch Verkaufstempo ({1} Stk ÷ {1,0} Stk/Monat). Mindestbestand {2}, Soll {4} laut Billbee.“ |
| Ø EK (AD 236) | „Ø EK“ · „Liste: 6,82 € · zuletzt vor 134 T geändert/gekauft“ | „Ø EK“ · „seit 134 T unverändert“; nur bei Abweichung „Liste 7,10 €“ davor | „Durchschnittlicher Einkaufspreis je Stück. EK laut Billbee-Liste: {6,82 €}, zuletzt vor {134} Tagen geändert oder gekauft.“ Bei „fehlt“: „Kein EK hinterlegt, Gewinn und Marge können nicht gerechnet werden.“ |

Die Kacheln „Gebundenes Kapital“ und „Max. EK für 25 %“ wandern als Zeilen in die Gruppe „Ergebnis“ (3.6); die Kachel
„Sortiment“ wird das dritte Feld der Entscheidungszeile.

### 3.4 Gruppe „Markt“ (heute „Cardmarket“, plus eine Zeile aus „Kennzahlen“)

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Überschrift (AD 336) | „Cardmarket“ + „↓ Markt fällt“ | „Markt“ + „↓ fällt“ / „↑ steigt“ / „→ stabil“ + rechts „Stand 14.11.“ | „Cardmarket-Preise vom {Datum}. Steigt oder fällt: Ø 7 Tage liegt mehr als 5 % über oder unter Ø 30 Tage.“ |
| Zeile ab (AD 339) | „ab (günstigstes Angebot)“ | „ab ×2“ | „Günstigstes Angebot bei Cardmarket. Zählt doppelt im Marktwert, wenn plausibel.“ |
| Zeile Ø (AD 340) | „Ø 1 / 7 / 30 Tage“ | unverändert | „Durchschnittlicher Verkaufspreis bei Cardmarket der letzten 1, 7 und 30 Tage.“ |
| Zeile Trend (AD 341) | „Trend“ | unverändert | „Trendpreis laut Cardmarket.“ |
| Zeile Stand (AD 342) | eigene Zeile „Stand · 14.11.2026“ | entfällt als Zeile, steht rechts in der Überschrift | siehe Überschrift |
| aus Kennzahlen (AK 38-46) | „Verkaufspreis gegen Markt“ · „+19,7 % (2 von 15 Verkäufen) · 0,00 € unter Markt“ | „Verkauft gegen Markt“ · „+19,7 % · 2 von 15“ | „Dein Verkaufspreis gegen den Marktstand am Verkaufstag, gemittelt über die Verkäufe mit bekanntem Marktstand. Unter Markt verschenkt: {0,00 €}.“ |
| Leertexte (AK 41-43) | „Verlauf beginnt mit dem nächsten Marktabruf“ / „kein Verkauf mit Marktstand davor“ | „ab nächstem Abruf“ / „noch kein Vergleich“ | „Der Marktverlauf wird erst seit dem 13.11.2026 je Abruf gespeichert.“ / „Kein Verkauf, vor dem schon ein Marktstand gespeichert war.“ |

### 3.5 Gruppe „Verkäufe“ (heute „Verkäufe“, Verkaufszeilen der „Warenbewegungen“, „eBay-Verkaufsberichte“, zwei Zeilen aus „Kennzahlen“, Kasten VK-Änderung)

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Überschrift (AD 348) | „Verkäufe“ + „↓ Verkäufe lassen nach“ | „Verkäufe“ + „↓ lassen nach“ / „↑ steigen“ / „→ stabil“ + rechts „zuletzt 16.08.2026 · 11,75 €“ | „Tempo der letzten 30 Tage gegen die 60 Tage davor; ab 25 % Unterschied steigt oder fällt es. Letzter Verkauf vor {90} Tagen.“ |
| Spaltenköpfe (AD 352-355) | „Stück“, „Umsatz“, „Ø Preis“ | unverändert | „Rang: Platz unter allen aktiven Artikeln.“ |
| Zeilen (AD 29-34) | „30 Tage“, „90 Tage“, „365 Tage“, „Gesamt“ | „30 T“, „90 T“, „365 T“, „Gesamt“ | — |
| Zeile Preis, mit Änderung (AD 281-292, AK 68-78) | Kasten „Letzte VK-Änderung am 09.09.2026: 14,99 € → 17,99 € (erhöht) · seitdem 2 Verkäufe. Tempo: 1,5 Stk/Monat in den 60 Tagen davor, 0,9 Stk/Monat in den 67 Tagen danach.“ und Kennzahl „Preis 09.09.2026: … (+20 %) · läuft seitdem langsamer · vorher 1,5 → nachher 0,5 Stk/Monat“ | „Preis 09.09.: 14,99 → 17,99 € (+20 %)“ · „seitdem langsamer · 2 Verkäufe“ | „Tempo vorher {1,5}, nachher {0,5} Stk/Monat (Änderungen ab 10 % mit 14 Tagen Nachlauf). Grob: {1,5} Stk/Monat in den 60 Tagen davor, {0,9} in den {67} Tagen danach.“ |
| Zeile Preis, ohne Änderung (AD 294, AK 64-65) | „Noch keine VK-Änderung erfasst – Billbee liefert keine Preishistorie, die App schreibt Änderungen ab jetzt bei jedem Abgleich mit.“ und „Wirkung von Preisänderungen · keine Änderung ab 10 % mit 14 Tagen Nachlauf“ | „Preis“ · „noch keine Änderung erfasst“ | „Billbee liefert keine Preishistorie; die App schreibt Änderungen bei jedem Abgleich mit. Bewertet werden Änderungen ab 10 % mit 14 Tagen Nachlauf.“ |
| Urteile (AK 27) | „läuft seitdem schneller“ / „läuft seitdem langsamer“ / „ohne erkennbare Wirkung“ / „zu wenig Verkäufe für ein Urteil“ | „seitdem schneller“ / „seitdem langsamer“ / „ohne Wirkung“ / „zu wenig Daten“ | siehe Zeile Preis |
| aus Kennzahlen (AK 59-60) | „Bis zum ersten Verkauf“ · „38 Tage nach der Erfassung in LEC“ / „noch keiner, seit 38 Tagen in LEC erfasst“ | „Erster Verkauf“ · „nach 38 Tagen“ / „noch keiner (38 T)“ | „Tage von der Erfassung des Artikels in LEC bis zum ersten Verkauf.“ |
| Unterzeile Einzelverkäufe (AD 395-421, nur `kind === "Verkauf"`) | „Warenbewegungen und letzte Verkäufe“ + „● 90 T ● 365 T ● älter“; Zeile „16.08.2026 · Verkauf · −1 Stk · EK ca. 6,82 € je Stück“ | „Einzelverkäufe (21)“, eingeklappt; Spalten „Datum · Stück · Preis“; Zeile „16.08.2026 · 1 · 11,75 €“ | „Verkäufe aus Billbee, neueste zuerst. Farbe: grün bis 90 Tage, gelb bis 365 Tage, rot älter. EK je Stück ca. {6,82 €}.“ |
| Unterzeile eBay-Berichte (AD 451-469) | „eBay-Verkaufsberichte“ + Fußnote „Verkaufsdaten liegen nur je Berichtszeitraum vor, nicht je Einzelverkauf.“ | „eBay-Berichte (3)“, eingeklappt; Spalten „Zeitraum · Stück · Ø Preis“ | „Aus den importierten eBay-Berichten. Die Daten liegen nur je Berichtszeitraum vor, nicht je Einzelverkauf.“ |

### 3.6 Gruppe „Ergebnis“ (heute „Was ein Verkauf heute bringt“ und „Ergebnis je Stück (historischer Schnitt)“)

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Überschrift (AD 306, 374) | „Was ein Verkauf heute bringt“ und „Ergebnis je Stück (historischer Schnitt)“ | „Ergebnis“, zugeklappt; zwei Unterüberschriften „heute“ und „historisch“ | „Heute: gerechnet mit heutigem VK und aktuellem EK. Historisch: Schnitt der tatsächlichen Verkäufe.“ |
| Zeile (AD 320-324) | Kachel „Gebundenes Kapital“ · „Bestand ergibt 1,19 € Gewinn“ | „Gebundenes Kapital“ · Wert; eigene Zeile „Gewinn im Bestand“ · Wert | „Bestand mal aktueller EK ({1} × {6,82 €}).“ / „Bestand mal Gewinn je Stück ({1} × {1,19 €}).“ |
| Zeile (AD 325-330) | Kachel „Max. EK für 25 %“ · „letzter Verkauf vor 90 Tagen“ | „Max. EK für 25 %“ · Wert, ohne Untertext | „Höchster Einkaufspreis, bei dem der heutige VK nach Gebühren und Versand noch 25 % Marge lässt.“ |
| Zeile (AD 377) | „DB I (nach Wareneinsatz)“ | „DB I“ | „Deckungsbeitrag I: Verkaufspreis minus Wareneinsatz (EK), je Stück im historischen Schnitt.“ |
| Zeile (AD 378) | „DB II“ | „DB II“ | „Deckungsbeitrag II: DB I minus eBay-Gebühren, Versand und Verpackung. Prozent vom Umsatz.“ |
| Zeile (AD 379) | „DB III (mit Fixkosten)“ | „DB III“ | „Deckungsbeitrag III: DB II minus anteilige Fixkosten. Prozent vom Umsatz.“ |

### 3.7 Gruppe „Lager“ (heute „Warenbewegungen“ ohne Verkäufe, „Einkäufe“, zwei Zeilen aus „Kennzahlen“)

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Überschrift | „Kennzahlen (Markt, Bestand, Preisänderungen)“, „Warenbewegungen und letzte Verkäufe“, „Einkäufe“ | „Lager“, zugeklappt | „Bestandsänderungen schreibt die App bei jedem Billbee-Abgleich selbst mit (Billbee liefert keine Lagerhistorie). Einkäufe gibt es nur, wenn sie importiert wurden.“ |
| aus Kennzahlen (AK 47-53) | „Tage ohne Bestand“ · „0 von 292 Tagen (0 %) · ca. 1,4 Stk verpasst“ | „Ohne Bestand“ · „0 von 292 T · 1,4 Stk verpasst“ | „Tage mit Bestand 0 seit der Erfassung. Verpasst: Tempo mit Bestand mal Tage ohne Bestand, geteilt durch 30.“ |
| aus Kennzahlen (AK 54-57) | „Tempo mit Bestand“ · „1,1 Stk/Monat“ | unverändert | „Verkäufe je Monat, gerechnet nur über die Tage, an denen Bestand da war.“ |
| Summenzeile Einkäufe (AD 429-431) | „12 Stk eingekauft für 81,84 € · Ø 6,82 €“ | „Eingekauft: 12 Stk · 81,84 € · Ø 6,82 €“ | „Summe der importierten Einkäufe dieses Artikels.“ |
| Leertext Einkäufe (AD 426) | „Keine Einkäufe importiert.“ | „Keine Einkäufe importiert.“ (einmal, als Zeile der Liste) | „Die Billbee-API liefert keine Einkäufe; sie kommen nur über den Datei-Import.“ |
| Bewegungsliste, Spalten (AD 401) | „Datum · Art · Menge · Preis / Detail“ | „Datum · Art · Stück · Bestand“ | — |
| Art (AD 127) | „Zugang (Einkauf/Korrektur)“ · „Bestand 12 → 13 · ca. 6,82 € zum aktuellen EK“ | „Zugang“ · „12 → 13“ | „Bestand laut Billbee gestiegen (Einkauf oder Korrektur), ca. {6,82 €} zum aktuellen EK.“ |
| Art (AD 139) | „Abgang laut Billbee“ · „Bestand 4 → 3, nicht durch Verkäufe erklärt“ | „Abgang ungeklärt“ · „4 → 3“ | „Bestand laut Billbee gesunken, ohne passenden Verkauf (3 Tage davor bis 1 Tag danach).“ |
| Art (AD 122) | „Einkauf“ · „gekauft zu 6,82 € EK je Stück · Quelle“ | „Einkauf“ · „6,82 € · Quelle“ | „Importierter Einkauf: EK je Stück und Quelle.“ |
| Leertext (AD 396) | „Noch keine Bewegungen. Startbestand: 12 Stk – Änderungen werden ab dem nächsten Billbee-Abgleich festgehalten.“ | „Noch keine Bewegungen · Start 12 Stk“ | „Änderungen werden ab dem nächsten Billbee-Abgleich festgehalten.“ |
| Fußnote (AD 418) | drei Sätze unter der Tabelle | entfällt sichtbar | steht im Hover der Überschrift „Lager“ |

### 3.8 Gruppe „Schwund & Retouren“

| Stelle | heute | neu | Hover-Text |
|---|---|---|---|
| Überschrift (AD 390) | „Schwund & Retouren (2)“ | unverändert, rechts daneben die Summe „0,00 €“ | „Retouren, Reklamationen, beschädigte und verlorene Karten, bewertet zum EK. Die Einträge ändern den Bestand nicht, den führt Billbee.“ |
| Kasten (AK 105-107) | „Erfasste Verluste insgesamt: 0,00 € (zum EK bewertet). Sie ändern den Bestand nicht, den führt Billbee.“ | entfällt als Kasten (Summe in der Überschrift) | siehe Überschrift |
| Notizfeld (AK 117) | „Notiz (optional)“ | „Notiz“ | — |
| Knopf (AK 126) | „Erfassen“ | unverändert | „Speichert den Verlust mit dem heutigen EK.“ |
| Löschknopf (AK 139) | „✕“ | unverändert | unverändert: „Eintrag löschen“ |
| Zeile ohne EK (AK 138) | „EK unbekannt“ | „EK fehlt“ | „Beim Erfassen war kein EK hinterlegt, der Verlust zählt mit 0 €.“ |

## 4. Neue Reihenfolge und Layout

Reihenfolge: (1) Kopf mit Knöpfen, (2) Set-Code-Warnung nur bei Konflikt, (3) Entscheidungszeile, (4) acht Kacheln,
(5) Markt, offen, (6) Verkäufe, offen, (7) Ergebnis, zu, (8) Lager, zu, (9) Schwund & Retouren, zu.
Neun Gruppen werden fünf. Die Speicher-Schlüssel in `localStorage` (`lec.drawer.<id>`) bekommen neue Namen
(`markt`, `verkaeufe`, `ergebnis`, `lager`, `schwund`); alte Schlüssel verfallen folgenlos.

Was wohin wandert:

| heute | neu |
|---|---|
| Kachel Sortiment | Entscheidungszeile, Feld 3 |
| Kasten „n Verkäufe … Preis wird gezahlt“ | Entscheidungszeile, Zusatz am Feld Preis |
| Kasten Nachbestellen | Entscheidungszeile, Feld Lager |
| Kasten Letzte VK-Änderung | Verkäufe, Zeile „Preis“ |
| Was ein Verkauf heute bringt | zwei Kacheln oben, zwei Zeilen in Ergebnis |
| Cardmarket | Markt |
| Verkäufe | Verkäufe |
| Ergebnis je Stück | Ergebnis, Teil „historisch“ |
| Kennzahlen | aufgelöst: Markt (1 Zeile), Verkäufe (2), Lager (2) |
| Warenbewegungen und letzte Verkäufe | Verkäufe (Einzelverkäufe) und Lager (Rest) |
| Einkäufe | Lager |
| eBay-Verkaufsberichte | Verkäufe, Unterzeile |
| Schwund & Retouren | bleibt eigene Gruppe |

### Desktop 1440x900, einspaltig (kleinster Umbau, Drawer bleibt 720 px)

```
+--------------------------------------------------------------------+
| Drachenkaiser von Arkadia                                        x |  22
| PHNI-DE007 [kopieren]  Super Rare  NM                              |  22
| [Preis ändern] [Beenden] [Angebot] [Cardmarket] [Auslisten v.] [Ausbl.]  36  (klebt beim Scrollen)
+--------------------------------------------------------------------+
| PREIS: zu teuer      | LAGER: 2 Stk nachbest.   | SORTIMENT:       |  52
| wird gezahlt       ? | [Zurückstellen] [90 T v] | Behalten       ? |
+--------------------------------------------------------------------+
| Dein VK      | Zielspanne      | Marktwert    | Marge Nachkauf     |  58
| 12,99 €      | 17,31 – 21,10 € | 6,97 €       | 7 %                |
| aus Billbee  |                 | Cardmarket   | Platz #108         |
+--------------+-----------------+--------------+--------------------+
| Gewinn/Stück | Gewinn/Monat    | Bestand      | Ø EK               |  58
| 1,19 € · 9 % | 1,17 €          | 1 Stk        | 6,82 €             |
| vor Fixkosten| 1,0 Stk/Mon·#33 | reicht 1,0 M.| seit 134 T unver.  |
+--------------------------------------------------------------------+
| v MARKT   ↓ fällt                                    Stand 14.11.  |  ~130
|   ab ×2                                                    4,97 €  |
|   Ø 1 / 7 / 30 Tage                         8,16 / 7,49 / 8,24 €   |
|   Trend                                                    8,16 €  |
|   Verkauft gegen Markt                           +19,7 % · 2 von 15|
+--------------------------------------------------------------------+
| v VERKÄUFE  ↓ lassen nach               zuletzt 16.08.2026·11,75 € |  ~230
|            Stück        Umsatz          Ø Preis                    |
|   30 T       —            —               —                        |
|   90 T       —            —               —                        |
|   365 T     13  #40    168,72 €  #35    12,98 €                    |
|   Gesamt    34  #19    427,62 €  #20    12,58 €                    |
|   Preis          noch keine Änderung erfasst                     ? |
|   Erster Verkauf                                   nach 38 Tagen   |
|   > Einzelverkäufe (21)      > eBay-Berichte (0)                   |
+--------------------------------------------------------------------+   = ca. 610 px bis hier
| > ERGEBNIS                                                         |
| > LAGER                                                            |
| > SCHWUND & RETOUREN                                       0,00 €  |
+--------------------------------------------------------------------+
```

Höhen in Pixeln rechts. Kopf bis Kacheln: rund 250 px (heute rund 450 px bis zum Ende der Kacheln, rund 640 px bis zum
Ende der Hinweiskästen). Bei 900 px Fensterhöhe sind damit Entscheidung, alle acht Kacheln, Markt und die ganze
Verkaufstabelle ohne Scrollen zu sehen.

### Desktop 1440x900, zweispaltig (Empfehlung, siehe Abschnitt 7a)

Drawer breiter: `width: min(100%, max(480px, 62vw))`, bei 1440 px sind das rund 890 px. Zwei Spalten ab 860 px
Drawer-Breite (Container-Query auf `.bd-dt` oder `@media (min-width: 1380px)`), darunter das einspaltige Layout.

```
+----------------------------------------------------------------------------------------+
| Drachenkaiser von Arkadia   PHNI-DE007 [kop.]  Super Rare  NM                        x |
| [Preis ändern] [Beenden] [Angebot] [Cardmarket] [Auslisten vormerken] [Ausblenden]     |
+----------------------------------------------------------------------------------------+
| PREIS: zu teuer · wird gezahlt | LAGER: 2 Stk nachbestellen [Zurückst.][90 T] | SORTIMENT: Behalten |
+------------------------------------------+---------------------------------------------+
| Dein VK      | Zielspanne                | v MARKT  ↓ fällt              Stand 14.11.  |
| 12,99 €      | 17,31 – 21,10 €           |   [Linie: Ø 7 Tage und ab, 90 Tage,         |
+--------------+---------------------------+    Stufenlinie Dein VK, Punkte = Verkäufe]  |
| Marktwert    | Marge Nachkauf            |   ab ×2 4,97 €   Ø 1/7/30  8,16/7,49/8,24 € |
| 6,97 €       | 7 % · #108                |   Trend 8,16 €   gegen Markt +19,7 %        |
+--------------+---------------------------+---------------------------------------------+
| Gewinn/Stück | Gewinn/Monat              | v VERKÄUFE ↓ lassen nach  zuletzt 16.08.    |
| 1,19 € · 9 % | 1,17 € · #33              |   [12 Monatsbalken, Stück je Monat]         |
+--------------+---------------------------+            Stück     Umsatz      Ø Preis    |
| Bestand      | Ø EK                      |   30 T       —         —           —        |
| 1 Stk        | 6,82 €                    |   90 T       —         —           —        |
| reicht 1,0 M.| seit 134 T unverändert    |   365 T     13 #40  168,72 € #35  12,98 €   |
+--------------+---------------------------+   Gesamt    34 #19  427,62 € #20  12,58 €   |
| > ERGEBNIS                               |   Preis: noch keine Änderung erfasst      ? |
| > LAGER                                  |   > Einzelverkäufe (21)   > eBay-Berichte   |
| > SCHWUND & RETOUREN             0,00 €  |                                             |
+------------------------------------------+---------------------------------------------+
```

Links steht, was zu entscheiden ist und was es bringt; rechts, womit man es prüft. Geschätzte Höhe rund 560 px,
passt in 900 px auch mit Kartenbild.

### Handy 390x844

```
+------------------------------------+
| Drachenkaiser von Arkadia        x |
| PHNI-DE007 [kop.] Super Rare  NM   |
| [Preis ändern][Beenden][Angebot]   |   klebt NICHT (siehe Optik O9)
| [Cardmarket][Auslisten v.][Ausbl.] |
+------------------------------------+
| PREIS: zu teuer · wird gezahlt   ? |   drei Zeilen untereinander,
| LAGER: 2 Stk nachbestellen       ? |   je 36 px, farbiger Balken links
|   [Zurückstellen] [90 T v]         |
| SORTIMENT: Behalten              ? |
+------------------------------------+
| Dein VK         | Zielspanne       |   vier Zeilen zu zwei Kacheln,
| 12,99 €       ? | 17,31–21,10 €  ? |   je 52 px, Untertext einzeilig
+-----------------+------------------+   (abgeschnitten mit …),
| Marktwert       | Marge Nachkauf   |   "?" klappt den Hover-Text
| 6,97 €        ? | 7 % · #108     ? |   unter der Kachelzeile auf
+-----------------+------------------+
| Gewinn/Stück    | Gewinn/Monat     |
| 1,19 € · 9 %  ? | 1,17 €         ? |
+-----------------+------------------+
| Bestand         | Ø EK             |
| 1 Stk         ? | 6,82 €         ? |
+------------------------------------+
| v MARKT  ↓ fällt       Stand 14.11.|
|   ab ×2                     4,97 € |
|   Ø 1/7/30     8,16 / 7,49 / 8,24 €|
|   Trend                     8,16 € |
+------------------------------------+
| v VERKÄUFE  ↓ lassen nach          |
|   zuletzt 16.08.2026 · 11,75 €     |
|          Stück   Umsatz    Ø Preis |
|   365 T   13     168,72 €  12,98 € |   Rang (#40) auf dem Handy nur im "?"
|   ...                              |
|   > Einzelverkäufe (21)            |   Liste dreispaltig: Datum · Stück · Preis
+------------------------------------+
| > ERGEBNIS                         |
| > LAGER                            |
| > SCHWUND & RETOUREN        0,00 € |
+------------------------------------+
```

Heute liegt auf dem Handy der erste Gruppenkopf bei rund 770 px (ganz unten im ersten Bildschirm); mit dem Vorschlag
enden die Kacheln bei rund 520 px und „Markt“ ist im ersten Bildschirm sichtbar.

## 5. Optik-Korrekturen

| Nr. | Datei | Problem (im Bild gesehen) | Lösung | Aufwand |
|---|---|---|---|---|
| O1 | `ArtikelDetail.tsx` (Kachelraster, AD 217-237), `globals.css` 481 | Sieben Kacheln im Dreier-Raster: die siebte („Ø EK“) steht allein in Zeile 3, daneben zwei leere Felder. Ohne Sortiment-Kachel sind es sechs, das Raster springt also je Artikel. | Acht feste Kacheln, `grid-template-columns: repeat(4, 1fr)`, Handy `repeat(2, 1fr)`. Sortiment geht in die Entscheidungszeile. | M |
| O2 | `globals.css` 482-486 | Kacheln einer Zeile sind gleich hoch, aber die Zeilen verschieden (Untertexte ein- bis dreizeilig); auf dem Handy bricht „Sortiment“ auf vier Zeilen um. | Untertext einzeilig: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` und feste Mindesthöhe `min-height: 56px`. Lange Texte stehen im Hover (Abschnitt 3). | S |
| O3 | `globals.css` 487-494 | Bis zu vier Rahmenfarben gleichzeitig (gelb, grün, rot, blau) plus gelber Kasten plus goldene ab-Zeile; im dunklen Thema wirkt der erste Bildschirm wie eine Ampelsammlung. | Farbe nur in der Entscheidungszeile (farbiger Balken links, 3 px) und an der Zahl selbst (`b { color }`). Kacheln behalten den neutralen Rahmen `var(--line)` und Hintergrund `var(--panel2)`; die Klassen `.good/.warn/.crit/.info` färben nur noch die Zahl. | S |
| O4 | `ArtikelDetail.tsx` 339 | Die ab-Zeile ist fest auf `#f5b942` gesetzt (Inline-Stil). Im hellen Thema ist das auf Weiß kaum lesbar (Kontrast rund 1,8 : 1), und es ist eine fünfte Farbe neben `--warn`. | Klasse statt Inline-Stil, Farbe `var(--warn)` (hell `#96610d`, dunkel `#e2a13f`), fett bleibt. | S |
| O5 | `globals.css` 43, 482, 507 | Dunkles Thema: `--line: #271e35` auf `--panel: #1d1726` ist fast unsichtbar; neutrale Kacheln haben keinen erkennbaren Rand, Tabellenlinien verschwinden. | Im Drawer für Kachelrand und Tabellenlinien `var(--border)` nehmen (wird schon für `.chip` benutzt) oder `--line` im dunklen Thema eine Stufe heller setzen. Vorher prüfen, was `--line` sonst trifft. | S |
| O6 | `globals.css` 483, 485, 500 | Kleinste Schrift 10,5 px in `--muted`/`--faint` (Kachel-Titel, Untertexte, Rang). Auf dem Laptop schwer lesbar; `--faint` (#8f86a3) auf dunklem Grund liegt nur knapp über 4,5 : 1. | Kachel-Titel und Untertext 11,5 px, Rang 11 px, alle in `--muted`. Durch die gekürzten Texte kostet das keinen Platz. | S |
| O7 | `globals.css` 239, 538-540, 481 | Abstände uneinheitlich: Kästen 12 px bzw. 14 px (oben oder unten), Gruppen 18 px, Kacheln 6 px, Knopfleiste 14 px. | Ein Raster: 6 px innerhalb eines Blocks, 12 px zwischen Blöcken, 16 px vor einer Gruppen-Überschrift. | S |
| O8 | `ArtikelDetail.tsx` 395-421, `globals.css` 495-498 | Verkaufszeilen der Bewegungsliste sind vollflächig grün, gelb oder rot hinterlegt, mit farbiger Schrift: 21 farbige Zeilen untereinander, dazwischen ungefärbte Abgänge, deren Text links 8 px anders beginnt (`padding-left` nur bei gefärbten Zeilen). | Statt Flächenfarbe ein farbiger Punkt vor dem Datum (dieselben drei Farben wie in der Legende), Schrift neutral, alle Zeilen gleich eingerückt. | S |
| O9 | `globals.css` 532 | Knopfleiste klebt mit `top: -22px`. Auf dem Handy belegt sie drei Zeilen (rund 110 px) und nimmt beim Scrollen dauerhaft ein Achtel des Bildschirms. | Auf dem Handy nicht kleben (`@media (max-width: 760px) { position: static; }`) oder nur „Preis ändern“ kleben lassen. Mit den kurzen Texten (3.1) sind es dort zwei Zeilen. | S |
| O10 | `ArtikelDetail.tsx` 399-413 | Handy: Bewegungsliste hat vier Spalten bei 390 px; „Abgang laut Billbee“ und „Bestand 2 → 1, nicht durch Verkäufe erklärt“ brechen auf vier bis fünf Zeilen je Eintrag. Die Liste ist dadurch rund 1.900 px hoch. | Mit den kurzen Texten (3.7: „Abgang ungeklärt“ · „2 → 1“) passt jede Zeile einzeilig; Einzelverkäufe dreispaltig (Datum, Stück, Preis). | S |
| O11 | `ArtikelDetail.tsx` 411 | Bewegung ohne Mengenänderung wird als „−0 Stk“ gezeigt („Zugang (Einkauf/Korrektur) · −0 Stk · Bestand 12 → 12“), weil nur `delta > 0` ein Plus bekommt. | Bei `delta === 0` „±0“ zeigen und die Art „Abgleich“ nennen (Hover: „Billbee-Abgleich ohne Mengenänderung“). | S |
| O12 | `ArtikelDetail.tsx` 349-371 | Verkaufstabelle: Die Zahl und ihr Rang stehen in derselben Zelle (`13 #40/216`), dadurch stehen die Zahlen nicht untereinander, sobald ein Rang fehlt („—“ steht weiter rechts als „13“). Die Spalte „Stück“ sitzt optisch in der Mitte der Tabelle, weit weg von der Zeilenbeschriftung. | Rang in fester Breite (`display: inline-block; width: 3.5em; text-align: left`) und ohne „/216“ (D11); Spaltenbreiten festlegen (erste Spalte 22 %). | S |
| O13 | `globals.css` 240, `ArtikelDetail.tsx` 500-502 | Gruppen-Überschriften sind nur Großbuchstaben in `--muted` ohne Linie; im aufgeklappten Zustand ist kaum zu sehen, wo eine Gruppe endet. Zusatz (Trend, Legende) klebt direkt am Titel. | Über jeder Gruppe eine Linie (`border-top: 1px solid var(--border); padding-top: 10px`), Zusatz rechtsbündig (`margin-left: auto`). | S |
| O14 | `ArtikelKennzahlen.tsx` 108-128 | Schwund-Formular: Auswahl, Stückzahl, Notiz und Knopf haben verschiedene Höhen (im Bild rund 22 bis 26 px), der Knopf „Erfassen“ ist blau umrandet wie „Preis bei eBay ändern“, obwohl er nichts mit eBay zu tun hat. | Einheitliche Höhe 28 px für alle vier; „Erfassen“ als gewöhnlicher `chip`. Blau (`bd-dt-primary`) bleibt allein dem Knopf „Preis ändern“. | S |
| O15 | `ArtikelDetail.tsx` 235 | Bestand 0 zeigt „—“ statt „0 Stk“. Bei einem ausverkauften Artikel, der nachbestellt werden soll, ist die 0 die Aussage. | `row.stock > 0 ? … : "0 Stk"` (nur wenn der Bestand bekannt ist). | S |
| O16 | `ArtikelDetail.tsx` 219 | Die Zielspanne zeigt krumme Beträge („17,31 – 21,10 €“), obwohl Preise im Shop auf ,99 enden. Man muss selbst umrechnen, welchen Preis man eintippt. | Nur Hinweis, keine Änderung an der Rechnung: im Hover der Kachel „Preise auf ,99 setzen“. Ob die Spanne selbst gerundet gezeigt wird, entscheidet Chris (siehe Abschnitt 6). | S |
| O17 | `ArtikelDetail.tsx` 477-507 | Gruppen-Zustand kommt aus `localStorage` schon beim ersten Rendern (`useState`-Initialwert); im Entwicklungsmodus meldet Next auf dem Handy-Bild „1 Issue“. Vermutlich Abweichung zwischen Server- und Browser-Rendering, **nicht nachgeprüft**. | Zustand erst in `useEffect` aus `localStorage` lesen. Vorher die Meldung im Browser lesen. | S |
| O18 | `ArtikelDetail.tsx` 424-425 | „Lädt …“ und „Details konnten nicht geladen werden.“ stehen nur in der zugeklappten Gruppe „Einkäufe“. Schlägt der Abruf fehl, fehlen Cardmarket, Kennzahlen und Schwund kommentarlos. | Lade- und Fehlerzeile einmal direkt unter den Kacheln zeigen. | S |

## 6. Nicht angefasst, weil riskant

- **Die zwei Rechnungen zur Wirkung einer Preisänderung (D8)** werden nicht vereinheitlicht. Vorschlag ist nur, eine
  sichtbar zu zeigen und die andere in den Hover zu legen. Welche Rechnung „richtig“ ist (60 Tage davor gegen alle
  Tage danach, oder die Regel aus `kennzahlen.ts` mit 10 % und 14 Tagen Nachlauf), ist eine fachliche Entscheidung.
- **Zielspanne auf ,99 runden (O16):** Die Spanne kommt aus `marketComparison.ts`; dieselben Werte steuern das Urteil
  „zu günstig / zu teuer“ in der Liste. Eine gerundete Anzeige könnte am Rand dem Urteil widersprechen. Nicht ohne
  Chris ändern.
- **Marktwert-Rechnung, Zustandsfaktoren, „ab“ doppelt:** nur Texte gekürzt, keine Formel berührt. Der Hover nennt
  die Faktoren EX 85, GD 70, LP 60, PL 45, Poor 30 % wörtlich.
- **Farbschwellen** (25 % Marge, 12 Monate Reichweite, 90 Tage ohne Verkauf, ±5 % Markt, ±25 % Verkaufstrend) bleiben,
  wie sie sind. Die Rotfärbung für „letzter Verkauf über 90 Tage“ zieht nur von der Kachel „Max. EK“ an die
  Kopfzeile der Verkäufe um.
- **Die Zuordnung von Abgängen zu Verkäufen** (AD 124-141, drei Tage davor bis ein Tag danach) bleibt unverändert,
  auch die Begrenzung auf 25 Bewegungen. Beim Aufteilen in „Einzelverkäufe“ und „Lager“ muss die Begrenzung je Liste
  gelten, sonst verdrängen 25 Verkäufe alle Lagerzeilen (heute schon so: bei 21 Verkäufen bleiben vier Plätze).
- **Knöpfe und ihre Wirkung:** alle sechs Knöpfe der Leiste, Zurückstellen/Aktivieren und Schwund erfassen/löschen
  bleiben mit derselben Funktion. Kein neuer Knopf, keine Preisvorschläge, kein Best Offer.
- **Set-Code-Warnung:** bleibt ein eigener, auffälliger Kasten. Sie war in der Demo nicht zu sehen; die Kürzung in
  3.2 ist am Code entworfen und sollte an einem echten Fall angesehen werden.
- **Kartenbild, gefüllte Einkäufe, eBay-Berichte:** in der Demo leer, Layout dafür nur am Code beurteilt. Mit Bild
  (120 px breit, rund 170 px hoch) wird der Kopf höher; im zweispaltigen Layout das Bild auf 72 px verkleinern oder
  in die linke Spalte neben die Kennzeichen setzen und vorher prüfen.
- **Breite des Drawers (62vw)** verdeckt mehr von der Liste dahinter. Wer beim Durchklicken die Liste lesen will,
  sieht dann nur noch die Artikelspalte. Deshalb als Empfehlung, nicht als Pflicht; das einspaltige Layout erreicht
  das Ziel „ohne Scrollen“ auch bei 720 px.

## 7. Mehr aus den Daten

Nachtrag auf Chris' Hinweis, der Drawer sei „etwas ungeordnet und platzverschwenderisch“ und aus den Billbee-Daten
sei mehr herauszuholen. Geprüft: `docs/enterich-cards/BILLBEE_API.md`, `src/lib/billbee/map.ts`, `sync.ts`,
`prisma/schema.prisma`, `src/app/api/article-detail/[id]/route.ts`.

**Was vom Billbee-Abruf heute wirklich ankommt** (belegt in `map.ts`):
- Artikel (`/products`): `Title`/`Name`, `SKU`, `Id`, `Price`/`PriceGross`, `CostPrice`/`CostPriceNet`,
  `StockCurrent`/`Stock`, `IsDeactivated`, `StockWarning`/`StockMinimum`/`MinStock`, `StockDesired`,
  `Sources[].Source`, `ApiAccountName`, `SourceId`/`ExternalId` (nur für die eBay-Artikelnummer).
- Bestellungen (`/orders`): `CreatedAt`/`OrderDate`, `State`/`OrderStateId`, `OrderNumber`, `BillBeeOrderId`, `Id`,
  `OrderItems[]` mit `Quantity`, `TotalPrice`, `UnitPrice`, `IsCoupon`, `Product{Title, SKU, Id, CostPrice, Type}`.
- Gespeichert wird je Bestellposition eine Zeile `Sale` (`soldAt`, `qty`, `unitPrice`, `orderRef`, `source`).
- **Nicht gelesen und nicht gespeichert:** Land oder Adresse, Versandart, Versandkosten der Bestellung, Zahlungsart,
  Verkaufskanal, Käufer, Rechnungs- oder Versanddatum. Diese Felder kommen in `map.ts`, `sync.ts` und im Schema
  nicht vor. Wie sie in der Billbee-Antwort heißen, ist **unbelegt und bräuchte Prüfung am echten API-Aufruf**
  (`scripts/billbee-probe.ts` zeigt die Feldnamen). `BILLBEE_API.md` sagt selbst, die Feldnamen seien „ohne
  Konto-Zugriff nicht live getestet“.

**Was schon in der DB liegt, der Drawer aber nicht zeigt:**
- `Sale.unitPrice` wird an den Drawer geliefert, in der Bewegungsliste aber durch den EK ersetzt (D10).
- `Sale.orderRef` wird gespeichert, aber von der Detail-Route nicht mitgeliefert.
- `MarketPriceHistory` (`priceFrom`, `priceTrend`, `priceAvg1/7/30` je Abruf) wird in der Route geladen, aber nur
  für eine Kennzahl verrechnet; der Verlauf selbst geht nicht an den Drawer.
- Alle `PriceChange`- und `StockMovement`-Zeilen werden geladen (`allPrice`, `allStock`), an den Drawer gehen nur
  die letzten 10 bzw. 40.
- `EkChange` (Verlauf des EK) wird für den Drawer gar nicht geladen.
- `Purchase.buyShipping` (Versandanteil je Einkauf) und `EbayListingFact.totalRevenueGross` gehen an den Drawer und
  werden nicht gezeigt; die Gebührenfelder der eBay-Berichte (`salesCommission`, `adFeesBasic` …,
  `internationalFees`, `shippingPaidByBuyer`) gehen gar nicht erst mit.
- Verkäufe werden bis 200 Zeilen geliefert, gezeigt werden höchstens 25 Bewegungen.

### a) Platz besser nutzen

| Nr. | Idee | Datenquelle | Liegt vor? | Aufwand | Nutzen |
|---|---|---|---|---|---|
| P1 | Zweispaltiger Drawer auf dem Laptop (Layout in Abschnitt 4): links Entscheidung, Kacheln und zugeklappte Gruppen, rechts Markt und Verkäufe | nur Layout | ja | M | Alles Entscheidende ohne Scrollen; der Drawer wird rund 560 px hoch statt 1.700 bis 2.500 px. |
| P2 | Acht Kacheln in zwei Zeilen statt sieben in drei, Untertexte einzeilig | nur Layout (O1, O2) | ja | S | Spart rund 130 px, ruhiges Raster. |
| P3 | Entscheidungszeile statt drei Hinweiskästen | vorhandene Felder `market.status`, `reorderDue`, `reorderQty`, `sortiment.status` | ja | M | Spart rund 150 px und beantwortet „was ist zu tun?“ in einer Zeile. |
| P4 | **Verkaufsverlauf als Mini-Balken**: zwölf Monatsbalken (Stück je Monat) über der Fenster-Tabelle, Monate ohne Bestand grau hinterlegt | `Sale.soldAt`, `Sale.qty` (bis 200 Zeilen schon im Drawer); Bestandslücken aus `StockMovement` | ja; für die grauen Flächen müsste die Route den vollen `allStock`-Verlauf mitgeben | S (ohne Lücken), M (mit) | Zeigt Saison, Auslaufen und „lief nur, solange Bestand da war“ auf einen Blick; die vier Fensterzahlen können das nicht. Ersetzt die farbige 21-Zeilen-Liste als ersten Blick. |
| P5 | **Preis- und Marktverlauf als Linie**: Ø 7 Tage und ab von Cardmarket, darüber Dein VK als Stufenlinie mit Markierung je Preisänderung, Verkäufe als Punkte auf Höhe ihres Preises | `MarketPriceHistory.priceAvg7`, `priceFrom`, `at`; `PriceChange.at/before/after`; `Sale.soldAt/unitPrice` | ja, aber die Route muss den Verlauf mitgeben (heute nur intern genutzt). Der Marktverlauf beginnt erst am 13.11.2026, die Linie ist anfangs kurz. | M | Ein Bild beantwortet drei Fragen: liege ich über oder unter dem Markt, wohin läuft der Markt, was hat meine letzte Preisänderung bewirkt. Ersetzt Zeile „Preis“, „Verkauft gegen Markt“ und den Trend-Pfeil als Erklärung. |
| P6 | Bestandsverlauf als kleine Stufenlinie in „Lager“ statt der Zeilen „Bestand 4 → 3“ | `StockMovement.at/before/after` | ja (voller Verlauf wird in der Route schon geladen) | S | Lücken und Nachkäufe sichtbar, die Liste darunter kann zugeklappt bleiben. |
| P7 | Einzelverkäufe dreispaltig und zugeklappt, Fensterzeilen ohne Verkauf zusammengefasst („30 T und 90 T: keine“) | vorhanden | ja | S | Spart je nach Artikel 60 bis 600 px. |
| P8 | Zielspanne als kleiner Balken in der Kachel: Spanne als Fläche, Dein VK und Marktwert als Marken | `market.targetMin`, `targetOpt`, `value`, `boardVk` | ja (in der Liste gibt es mit `.bd-range` schon eine solche Darstellung) | S | Vier Zahlen der Preis-Zeile werden zu einem Bild; „zu günstig“ ist ohne Rechnen zu sehen. |

Grafiken nur dort, wo sie etwas Eigenes sagen: P4 und P5 ja. Keine Grafik für DB I bis III, Ränge oder Schwund.
Technik: Inline-SVG ohne Bibliothek (eine Linie, zwölf Balken), Höhe 60 bis 90 px, Werte im Hover je Punkt bzw. Balken.

### b) Daten, die der Drawer noch nicht zeigt

| Nr. | Idee | Datenquelle (Feld/Tabelle) | Liegt vor? | Aufwand | Nutzen |
|---|---|---|---|---|---|
| N1 | **Verkaufspreis je Einzelverkauf** statt 21-mal derselbe EK | `Sale.unitPrice` | ja, wird schon geliefert | S | Zeigt, zu welchen Preisen die Karte wirklich ging (im Demo-Artikel 11,75 € beim letzten Verkauf gegen 12,99 € Listenpreis). |
| N2 | **Tage zwischen Verkäufen** („im Schnitt alle 24 Tage, längste Pause 131 Tage“) | `Sale.soldAt` | ja | S | Ehrlicher als „Stk/Monat“ bei Karten mit wenigen Verkäufen; macht „kein Verkauf seit 90 Tagen“ einordbar (normal oder auffällig). |
| N3 | **Tage bis zum Verkauf nach Zugang** (wie lange liegt ein nachgekauftes Stück) | `StockMovement` (Zugänge) gegen `Sale.soldAt`; „Bis zum ersten Verkauf“ gibt es schon (`daysToFirstSale`) | ja, aber erst ab Beginn der Bestandsmitschrift; davor nur der erste Verkauf nach Erfassung | M | Antwort auf „lohnt Nachkauf, wie lange ist das Geld gebunden“. Ergänzt Reichweite um einen gemessenen Wert. |
| N4 | **Ø Warenkorb der Bestellungen mit dieser Karte** (Anzahl Positionen und Warenwert) | `Sale.orderRef` (Gruppierung aller `Sale`-Zeilen mit derselben Bestellnummer), `qty`, `unitPrice` | ja; die Route muss dafür über `orderRef` nachladen. Warenwert nur aus zugeordneten Artikeln, Positionen ohne Artikel fehlen (in `sync.ts` werden sie nicht gespeichert). | M | Zeigt, ob die Karte allein gekauft wird oder Bestellungen zieht. Wichtig für die Kostenrechnung: Versand und Fixanteil verteilen sich auf mehr Stück (`CostSettings.itemsPerOrder` ist heute ein Pauschalwert 1,5). |
| N5 | **Oft zusammen gekauft** (die drei Artikel, die am häufigsten in derselben Bestellung lagen) | `Sale.orderRef` über alle Artikel | ja; braucht einen Index auf `Sale.orderRef` (heute nur `[articleId, soldAt]`) und eine eigene Abfrage | M | Hinweise für Sets und Bündel, für Nachkauf im Paket und für „diese Karte verkauft die andere mit“. Bei 1,5 Artikeln je Bestellung im Schnitt wird die Liste für viele Karten leer sein; dann „meist einzeln gekauft“ zeigen. |
| N6 | **Mengen je Bestellung** („9 von 13 Verkäufen als Einzelstück, 2 als Playset“) | `Sale.qty` | ja | S | Sagt, ob sich ein Dreier-Angebot lohnt; passt zum vorhandenen Pack-Kennzeichen. |
| N7 | **Preisnachlass gegen Liste** (Ø Verkaufspreis gegen den VK, der am Verkaufstag galt) | `Sale.unitPrice`, `PriceChange` | ja, soweit Preisänderungen mitgeschrieben sind; davor nur gegen heutigen VK | S | Erklärt Abweichungen wie 11,75 € gegen 12,99 € (Mengenrabatt, eBay-Aktion). Kein Preisvorschlag, nur Anzeige. |
| N8 | **EK-Verlauf** („EK 5,90 → 6,82 € am 03.07.“) | `EkChange.at/before/after` | ja, wird für den Drawer nicht geladen | S | Erklärt, warum die Marge gefallen ist; heute steht nur „zuletzt vor 134 T geändert/gekauft“. |
| N9 | **Einkaufsversand je Einkauf** | `Purchase.buyShipping` | ja, wird schon geliefert und nicht gezeigt | S | Vollständiger Einstandspreis in der Einkaufsliste (nur für importierte Einkäufe). |
| N10 | **eBay-Gebühren und Werbekosten je Berichtszeitraum** (Provision, Werbung, internationale Gebühren, vom Käufer gezahlter Versand) | `EbayListingFact.salesCommission`, `adFeesBasic/Premium/Express/External`, `internationalFees`, `shippingPaidByBuyer`, `totalSellingCosts`, `totalRevenueGross` | ja, nur für Artikel mit importiertem eBay-Bericht; die Route gibt die Felder nicht mit | S | Echte statt pauschaler Gebühren je Karte; zeigt, ob Werbung den Gewinn frisst. |
| N11 | **Anteil Auslandsverkäufe je Karte, grob** | `EbayListingFact.internationalFees` größer 0 als Anzeichen | ja, aber nur als Betrag je Berichtszeitraum, nicht je Verkauf | S | Grobe Antwort ohne neuen Abruf: „Auslandsgebühren 1,20 € in diesem Zeitraum“. Kein echter Anteil. |
| N12 | **Anteil Auslandsverkäufe je Karte, genau** | Land der Lieferadresse je Bestellung | **nein.** Kein Länderfeld in `map.ts`, `sync.ts` oder Schema. Feldname in der Billbee-Antwort **unbelegt, bräuchte Prüfung am echten API-Aufruf**. Braucht ein neues Feld an `Sale` (oder eine Tabelle je Bestellung) und einen vollen Neuabruf. | L | Zeigt, welche Karten vom Ausland leben (teurerer Versand, andere Gebühren). Die Versandkosten rechnen heute mit einem Pauschalanteil (`shippingHighShare` 0,15). |
| N13 | **Versandart und Versandkosten je Bestellung** (Brief, Einschreiben) | Versandfelder der Bestellung | **nein, unbelegt, bräuchte Prüfung am echten API-Aufruf.** Heute rechnet die App Einschreiben pauschal ab `registeredThreshold` 30 €. | L | Echte Versandkosten je Karte statt Pauschale; nützlich vor allem bei teuren Karten. |
| N14 | **Zahlungsart** | Zahlungsfeld der Bestellung | **nein, unbelegt, bräuchte Prüfung am echten API-Aufruf.** | L | Gering für die Einzelkarte; eher eine Shop-Kennzahl als eine Drawer-Zeile. Nicht empfohlen. |
| N15 | **Verkaufskanal** (eBay, anderer Marktplatz) | Kanalfeld der Bestellung | **nein, unbelegt, bräuchte Prüfung am echten API-Aufruf.** Bei Artikeln liest die App `Sources[].Source`, bei Bestellungen nichts Vergleichbares. | M bis L | Nur sinnvoll, wenn es mehr als einen Kanal gibt. |
| N16 | **Stornierte Bestellungen je Karte** | `State`/`OrderStateId` der Bestellung (Status 8 wird heute übersprungen) | teils: der Status kommt an, stornierte Bestellungen werden aber verworfen und nicht gespeichert | M | Zusammen mit „Schwund & Retouren“ ein vollständiges Bild der Problemfälle je Karte. |
| N17 | **Wiederkäufer** (dieselbe Person kauft die Karte mehrfach) | Käuferkennung der Bestellung | **nein, unbelegt.** Personenbezogen, deshalb nicht empfohlen. | L | Gering. |
| N18 | **Marktangebot** (wie viele Angebote es bei Cardmarket gibt) | `MarketPrice.available` | Feld steht im Schema; ob es beim Marktabruf gefüllt wird, ist **nicht geprüft** | S, wenn gefüllt | Knappes Angebot ist ein Grund, den Preis zu halten. |
| N19 | **Preisspanne der Varianten** bei mehrdeutigem Marktwert | `MarketPrice.priceMin`, `priceMax`, `variants`, `matchQuality` | ja im Schema; der Drawer zeigt nur die Spanne als Marktwert (`m.range`) | S | Erklärt, warum kein eindeutiger Marktwert da ist („3 Varianten, 4,20 bis 9,80 €“). |

**Empfohlene Reihenfolge:** zuerst N1, N2, N6, N8 (klein, Daten liegen vor) zusammen mit dem Aufräumen; dann P4 und
P5 (Grafiken) mit der Erweiterung der Detail-Route; danach N4 und N5 über `orderRef`. N12 und N13 erst, nachdem
`scripts/billbee-probe.ts` am echten Konto gezeigt hat, wie die Felder heißen.

# LEC: UX-Vorschläge (Stand 14.11.2026)

**Stand 14.11. (Umsetzung):** Nr. 1, 2, 3, 7, 8, 9 sowie der Titel-Teil von Nr. 4 und die Randbefunde Zahlenformat und abgeschnittene Zeitangabe sind umgesetzt. Bewusst nicht gebaut: die Gruppe „Weitere Seiten“ in der Seitenleiste von Nr. 4, weil Chris die Nebenseiten früher absichtlich aus der Navigation genommen hat. Alles andere ist offen.

Vorschlagsliste von Fable, Stand vor der Umsetzung. Grundlage: lokale Demo mit 300 erfundenen Artikeln (frische SQLite, `scripts/seed-demo.ts` plus ergänzte Verkäufe, Preisänderungen, Marktverlauf, Schwund), Login abgeschaltet, Screenshots mit Chromium in 1440×900, 1280, 1920 und 390×844.

Visuell geprüft: `/` (Dashboard), `/sortiment` (Kompakt, Alle Spalten, Weitere Filter, Überblick, Kapitalbindung, Drawer mit allen Gruppen), `/cockpit`, `/empfehlungen`, `/top-flop`, `/marktpreise`, `/einstellungen`. Nicht geprüft: `/import`, `/login`, Kartenbilder (die Demo hat keine, die Bildplätze waren leer), heller Modus (`layout.tsx` setzt fest `data-theme="dark"`), echte Daten.

## 1. Kurzfazit

Die App rechnet viel und richtig, zeigt aber fast alles gleich laut: die tägliche Frage „was muss ich heute tun“ beantwortet keine Seite auf den ersten Blick. Die Aufgabenlisten (88 nachbestellen, 16 Preis senken/Auslaufen/Auslisten, 6 zum Auslisten markiert) gibt es schon, sie liegen aber eingeklappt unter „Weitere Filter“ zwischen 25 gleich aussehenden Chips. Auf einem normalen Laptop (1280 bis 1440 px) ragen in der Kompakt-Liste ausgerechnet „Marge“ und „Urteil“ rechts aus dem Bild, und auf dem Handy gibt es gar keine Navigation. Der Drawer ist inhaltlich stark, aber 2.800 px lang, zeigt Verkäufe doppelt und liefert sieben farbige Kacheln statt eines klaren Satzes „Preis von X auf Y ändern“. Die größten Gewinne kosten wenig: Spaltenreihenfolge, Aufgaben-Reiter, Handy-Navigation, ehrliche Anzeige fehlender EKs und einheitliche Seitennamen.

## 2. Vorschläge

Sortiert nach Nutzen geteilt durch Aufwand. Pfade relativ zu `apps/LEC/src`. „Vorbild“ nennt die Quelle aus Abschnitt 7; „eigener Befund“ heißt: am Bildschirm gesehen, ohne Vorbild.

| Nr | Bildschirm / Komponente | Problem (gesehen) | Vorschlag | Aufwand | Nutzen | Risiko | Vorbild |
|---|---|---|---|---|---|---|---|
| 1 | Sortiment, Kompakt-Liste: `components/sortiment/PreisBoard.tsx`, `app/globals.css` (`table.bd`, Block ab `@media (min-width: 761px)`) | Tabelle ist 1307 px breit, Platz sind bei 1440 px nur 1154 px, bei 1280 px 994 px. „Marge“ ist abgeschnitten („MARG“), „Urteil“ gar nicht sichtbar. Erst bei 1920 px passt alles. | „Urteil“ direkt hinter „Dein VK“ stellen, „Ø EK“ und „Ø VK“ zu einer Spalte zusammenlegen (zweizeilig), „Letzter Verkauf“ als kleine Zeile unter „Verkäufe“. Ziel: unter 1000 px Gesamtbreite. | S | hoch | gering; Spaltenbreiten neu prüfen | NN/g Data Tables (Spalten nach Wichtigkeit ordnen) |
| 2 | Alle Seiten, Handy: `components/dashboard/Sidebar.tsx`, `app/globals.css` (`@media (max-width: 920px) { .sidebar { display: none } }`) | Unter 920 px verschwindet die Seitenleiste ersatzlos. Auf dem Handy kommt man von Sortiment nicht zum Dashboard, nicht zu Einstellungen und nicht an „Jetzt aktualisieren“. | Unter 920 px eine feste untere Leiste mit Dashboard, Sortiment, Leitplanken, Mehr (Einstellungen, Aktualisieren). | S | hoch | gering | eigener Befund |
| 3 | Dashboard: `components/dashboard/MoversPanels.tsx` | „Läuft gerade gut“ zeigt bei Artikeln ohne EK „EK € 0,00 · DB I 100 %“ in Grün mit vollem Balken. Das sieht aus wie der beste Artikel, ist aber eine Datenlücke. | Bei fehlendem EK „EK fehlt“ in Gelb zeigen, DB-Angabe weglassen, Balken grau. Gleiches Muster wie die Kachel „Ø EK fehlt“ im Drawer. | S | hoch | gering | eigener Befund |
| 4 | Navigation und Seitentitel: `components/dashboard/Sidebar.tsx`, `components/dashboard/DashboardShell.tsx`, `components/cockpit/CockpitPage.tsx` | Menüpunkt „Dashboard“ öffnet eine Seite mit der Überschrift „Cockpit“. Menüpunkt „Leitplanken“ öffnet ebenfalls eine Seite „Cockpit“. Empfehlungen, Top/Flop, Marktpreise, Import sind nur über verstreute Links oder die Adresszeile erreichbar und markieren dann keinen Menüpunkt. | Überschrift gleich dem Menüpunkt („Dashboard“, „Leitplanken“). Unten in der Seitenleiste eine kleine Gruppe „Weitere Seiten“ mit den vier Nebenseiten. | S | mittel | gering; die bewusste Entscheidung „nur wenige Menüpunkte“ bleibt, weil die Gruppe klein und abgesetzt ist | NN/g Progressive Disclosure (Auslöser klar beschriften, nur ein Weg zur zweiten Ebene) |
| 5 | Sortiment, Kopf: `components/sortiment/SortimentPage.tsx` (Zeilen 532–780), `app/page.tsx` bzw. `DashboardShell.tsx` | Die Tagesaufgaben sind Chips mit Zähler („Nachbestellen fällig (88)“, „Preis senken / Auslaufen / Auslisten (16)“, „Zum Auslisten markiert (6)“, „Bei eBay beendet, Billbee führt noch (5)“), stehen aber eingeklappt in der dritten Chip-Zeile. Das Dashboard nennt keine dieser Zahlen. | Aufgaben als Reiter über der Liste: Alle, Nachbestellen, Preis ändern, Auslisten, Markiert, Aufräumen, jeweils mit Zähler. Jeder Reiter ist ein fester Filter plus passende Sortierung und per Adresse aufrufbar (`?ansicht=nachbestellen`). Auf dem Dashboard oben eine Zeile „Heute“ mit denselben Zählern als Links. Reine Anzeige, keine Pflege. | M | hoch | mittel; Filterzustand und Adresse müssen zusammenpassen | Shopify-Produktansichten, Linear Custom Views, eBay Seller Hub (Übersicht mit Aufgaben) |
| 6 | Artikel-Drawer, Kopf: `components/sortiment/ArtikelDetail.tsx` (Kachelblock vor Zeile 306) | Sieben Kacheln mit vier Rahmenfarben. Bei „Flammenritter“ steht „Marge Nachkauf 51 %“ grün neben „Empfohlen 11,87–14,47 €“ und Urteil „zu teuer“. Was zu tun ist, muss man sich aus drei Kacheln zusammensetzen. | Über den Kacheln ein Satz mit der Entscheidung: „Zu teuer: 24,99 € → 14,99 €“ bzw. „Nachbestellen: 10 Stück“ bzw. „Auslisten“, daneben der passende Knopf (eBay ändern, Zurückstellen, Markieren). Kacheln nur noch farbig, wenn sie ein Problem zeigen; „Marge Nachkauf“ neutral. Preis im Satz endet auf ,99. | M | hoch | mittel; der Satz muss dieselbe Regel nutzen wie Urteil und Sortiment-Status, sonst widersprechen sie sich | NN/g Progressive Disclosure (das Häufige zuerst) |
| 7 | Artikel-Drawer, Gruppen: `components/sortiment/ArtikelDetail.tsx` (Zeilen 335–492) | Alle Gruppen offen ergeben 2.800 px (Handy 3.300 px). „Letzte Verkäufe“ und „Warenbewegungen“ zeigen dieselben Verkäufe zweimal untereinander. „Cardmarket“ steht unter „Verkäufe“, obwohl die Preisentscheidung zuerst den Markt braucht. | Reihenfolge: Entscheidung, Cardmarket, Verkäufe (4 Zeilen), dann eingeklappt: Kennzahlen, Ergebnis je Stück, Warenbewegungen, Einkäufe, Schwund, eBay-Berichte. „Letzte Verkäufe“ streichen und die Altersfarbe (90 T / 365 T / älter) in „Warenbewegungen“ übernehmen. | S | mittel | gering; gespeicherter Auf/Zu-Zustand der Gruppen ändert sich einmalig | NN/g Progressive Disclosure |
| 8 | Dunkles Thema, Formularfelder: `app/globals.css` (`:root`), `SortimentPage.tsx` (Ordner, Kartenart), `ArtikelDetail.tsx` (Zurückstellen) | Die Auswahlfelder „alle Ordner“, „alle Kartenarten“ und „90 Tage“ sind grellweiße System-Felder auf dunklem Grund. Es gibt keine eigene Fokus-Markierung. | `color-scheme: dark` am dunklen Thema setzen, `select` wie `.chip` gestalten, eine einheitliche `:focus-visible`-Umrandung in Akzentfarbe. | S | mittel | gering | eigener Befund |
| 9 | Handy, Überläufe: `components/sortiment/ArtikelKennzahlen.tsx`, `SortimentPage.tsx` (Ordner-Auswahl), `components/einstellungen/EinstellungenPage.tsx` | Im Drawer laufen die Kennzahlen rechts aus dem Bild („0,00 € unte…“, „311,8 Tage…“). Das Ordner-Feld ist breiter als der Bildschirm. Die Einstellungen sind 878 px breit bei 390 px Bildschirm, Texte sind abgeschnitten. | Kennzahlen auf dem Handy untereinander (Bezeichnung, darunter Wert), `select { max-width: 100% }`, Einstellungen unter 920 px einspaltig. | S | mittel | gering | eigener Befund |
| 10 | Begriffe: `PreisBoard.tsx`, `ArtikelDetail.tsx`, `KapitalPanel.tsx`, `components/dashboard/KpiRow.tsx` | „Marge Nachkauf“, „DB II“, „Maßnahme“, „Marktdeckel“, „ab“, „Velocity 30·90·365“ stehen ohne Erklärung da. Wo es Erklärungen gibt, sind es `title`-Attribute: auf dem Handy unerreichbar, am Rechner erst nach einer Sekunde. | Kleines „?“ hinter Spaltenkopf und Kachelüberschrift, das per Klick oder Tipp einen Kurztext zeigt (Texte in Abschnitt 5). Texte an einer Stelle sammeln (z. B. `lib/glossar.ts`). | M | mittel | gering | NN/g Progressive Disclosure |
| 11 | Sortiment, Filterleiste: `SortimentPage.tsx` (Zeilen 539–780) | 25 Chips und 2 Auswahlfelder in einem Fluss, getrennt nur durch dünne Striche. Anzeige-Schalter („auch ohne Bestand“, „Ausgeblendete“) sehen aus wie Filter. Zugeklappt sieht man nicht, was aktiv ist, nur „211 von 300 Artikeln“. | Vier beschriftete Blöcke: Preis, Bestand, Karte (Ordner, Kartenart, Klasse), Anzeigen. Aktive Filter als entfernbare Chips direkt über der Liste plus „Alle zurücksetzen“. Der Standard bleibt: Bestand 0 wird nicht ausgeblendet. | M | mittel | mittel; Aufgaben-Chips wandern in die Reiter aus Nr. 5, beides zusammen planen | Shopify-Produktfilter, NN/g Data Tables (aktive Filter klar anzeigen) |
| 12 | Sortiment, Liste: `PreisBoard.tsx` | Jede Aktion braucht den Drawer: Zeile anklicken, warten, Knopf suchen. Für 88 Nachbestell-Kandidaten oder 16 Auslisten-Kandidaten sind das je drei Schritte. | Zwei Schaltflächen am Zeilenende: „eBay“ (öffnet Bearbeiten) und je nach Reiter „Zurückstellen“ oder „Markieren“. Dazu Auswahlkästchen mit Sammelaktion „Markieren“ und „Zurückstellen“ über der Liste. | M | hoch | mittel; siehe Abschnitt 6, die Frage „Auslisten-Knopf in der Zeile“ ist bei Chris offen | NN/g Data Tables (höchstens ein bis zwei Aktionen in der Zeile, Sammelaktionen mit Kästchen) |
| 13 | Tastatur: `PreisBoard.tsx`, `ArtikelDetail.tsx` | Die Tab-Reihenfolge endet nach den Filtern; Tabellenzeilen sind nicht erreichbar (`tabIndex` −1, keine Rolle). Der Drawer schließt mit Esc, hat aber kein Vor/Zurück. | Zeilen fokussierbar, Enter öffnet den Drawer, Pfeil hoch/runter wechselt im offenen Drawer zum nächsten Artikel, „/“ springt ins Suchfeld. Fokus beim Öffnen in den Drawer, beim Schließen zurück auf die Zeile. | M | mittel | gering | eigener Befund |
| 14 | Sortiment, Handy-Karte: `app/globals.css` (`@media (max-width: 760px)`, `table.bd`) | Eine Karte je Artikel ist rund 330 px hoch und zeigt zehn beschriftete Werte. 100 Artikel ergeben 44.000 px Seite. | Karte auf drei Zeilen kürzen: Name und Set-Code; „Dein VK → Empfohlen“ mit Urteil; Bestand, Verkäufe 90 T, Marker „Nachbestellen“. Rest im Drawer. | M | mittel | gering | eigener Befund |
| 15 | Empfehlungen: `components/empfehlungen/EmpfehlungenPage.tsx`, Texte in `lib/dashboard/viewModel.ts` (um Zeile 969) | 197 Einträge, die meisten mit demselben Satz („… aber negative Marge … Ein Bestseller macht selten Verlust …“). Schreibweisen wie „Staerkster“ und „--“. Die Seite ist 7.900 px lang. | Nach Art gruppieren und einklappen (EK pflegen 102, Daten prüfen n, Auslisten n …), je Gruppe der Erklärsatz einmal oben, darunter einzeilige Einträge mit Zahl und Link ins Sortiment. Umlaute und Gedankenstriche korrigieren. | M | mittel | gering; langfristig kann die Seite in den Reitern aus Nr. 5 aufgehen | NN/g Progressive Disclosure |

## 3. Schnelle Gewinne

Alles Aufwand S, zusammen an einem Nachmittag machbar. Reihenfolge wie in der Tabelle.

- **Nr. 1:** Spalten der Kompakt-Liste umstellen und zusammenlegen, damit „Urteil“ und „Marge“ bei 1280 px sichtbar sind.
- **Nr. 2:** Untere Navigationsleiste unter 920 px.
- **Nr. 3:** „EK fehlt“ statt „EK € 0,00 · DB I 100 %“ im Dashboard.
- **Nr. 4:** Seitentitel an Menüpunkte angleichen, kleine Gruppe „Weitere Seiten“.
- **Nr. 7:** Drawer-Gruppen umsortieren, „Letzte Verkäufe“ in „Warenbewegungen“ aufgehen lassen, Nebengruppen standardmäßig zu.
- **Nr. 8:** `color-scheme: dark`, Auswahlfelder im App-Stil, sichtbarer Fokus.
- **Nr. 9:** Überläufe auf dem Handy (Kennzahlen, Ordner-Feld, Einstellungen).

Kleine Randbefunde, ebenfalls S, nicht in der Tabelle:

- **Zahlenformat im Drawer** (`ArtikelKennzahlen.tsx`, Zeile 50): „0 von 311,8 Tagen“ auf ganze Tage runden. In der Liste „−0 %“ als „0 %“ zeigen.
- **Abgeschnittene Zeitangabe** in „Alle Spalten“ (`SortimentPage.tsx`, Spalte `letzterverkauf`, Breite 100): „vor 12 Tagen“ wird zu „vor 12 Tager“ gekappt und liest sich wie ein Tippfehler. Spalte auf 116 verbreitern oder „12 T“ schreiben.
- **Vorsatz „Yu-Gi-Oh!“** frisst in „Alle Spalten“, Dashboard, Top/Flop und Marktpreise die halbe Namensspalte („Yu-Gi-Oh! INFO-DE060 Flammenri…“). Die Kompakt-Liste zeigt schon den bereinigten Namen; überall denselben nehmen.
- **Karte „Cardmarket-Check“ im Dashboard** (`components/dashboard/CardmarketPlaceholder.tsx`): eine Zahl, viel Leerfläche, Untertitel „Provider B · manuell“ ist überholt (die Preise kommen automatisch). Auf eine Zeile kürzen oder durch die drei Urteilszahlen (zu günstig, im Rahmen, zu teuer) ersetzen.
- **Ladezustand:** Es gibt keine `loading.tsx`. Beim Seitenwechsel bleibt die alte Seite stehen, bis der Server fertig ist. Je Route ein schlichtes Gerüst (Kopf plus graue Zeilen).
- **Hydration-Warnung** auf `/sortiment` im Streudiagramm (`PreisUeberblick.tsx`, SVG-Attribute weichen zwischen Server und Browser ab). Kein sichtbarer Fehler, aber im Entwicklungsmodus erscheint dauerhaft „1 Issue“.

## 4. Größere Umbauten

### 4.1 Sortiment mit Aufgaben-Reitern (Nr. 5, 11, 12)

```
Sortiment                                   [Suche /]  [Kompakt|Alle Spalten]
216 aktiv · 84 ausgelaufen

[Alle 211] [Nachbestellen 88] [Preis ändern 83] [Auslisten 16] [Markiert 6] [Aufräumen n]
---------------------------------------------------------------------------
Preis:  (zu günstig 55) (im Rahmen 29) (zu teuer 28) (ohne Urteil 61)
Filter: [Bestand v] [Karte v] [Anzeigen v]      aktiv: (Ordner 3 x) (1 Stk x)  Zurücksetzen
---------------------------------------------------------------------------
[ ] Artikel            Dein VK   Urteil          Empfohlen      Bestand  Verk.   Aktion
[ ] Flammenritter      24,99 €   zu teuer        14,99 €        2 (!)    38/18   [eBay] [Zurückst.]
[ ] Schattenmagier     19,99 €   zu günstig      29,99 €        1 (!)    9/3     [eBay] [Zurückst.]
---------------------------------------------------------------------------
2 ausgewählt:  [Zum Auslisten markieren]  [Nachbestellen zurückstellen]
```

- „Preis ändern“ = zu günstig plus zu teuer, sortiert nach größter Abweichung. „Aufräumen“ = bei eBay beendet, doppelt angelegt, Name passt nicht zum Code.
- Die vier großen Urteilskacheln schrumpfen zu einer Chip-Zeile. Sie nehmen heute 115 px Höhe ein, bevor die erste Karte kommt.
- Überblick-Grafik und Kapitalbindung bleiben einklappbar, wandern aber unter die Liste oder in einen eigenen Reiter „Auswertung“: sie sind Analyse, nicht Tagesgeschäft.

### 4.2 Dashboard mit Zeile „Heute“ (Nr. 5)

```
Dashboard                                         [30 T|90 T|365 T|Lebenszeit]
Heute:  [88 nachbestellen] [83 Preise ändern] [16 auslisten] [102 ohne EK] [5 aufräumen]
---------------------------------------------------------------------------
Umsatz 90 T   Verkäufe   Marge DB II (?)   Totes Kapital
Läuft gerade gut            |  Läuft schlecht
...
```

Die Kacheln sind Links ins Sortiment mit dem passenden Reiter. Keine Eingaben, keine Pflege; das hält die Vorgabe aus `COCKPIT_V2_KONZEPT.md` ein.

### 4.3 Drawer (Nr. 6, 7)

```
Flammenritter – Erwacht            INFO-DE060 [kopieren]  Rare      [<] [>] [x]
---------------------------------------------------------------------------
ZU TEUER    24,99 €  ->  14,99 €                         [Preis bei eBay ändern]
NACHBESTELLEN  10 Stück (Reichweite 0,5 Monate)          [Zurückstellen 90 T v]
---------------------------------------------------------------------------
Dein VK 24,99 | Marktwert 4,22 (?) | Marge Nachkauf 51 % (?) | Bestand 2 | EK fehlt
v Cardmarket      ab 3,41 (zählt doppelt) · Ø 1/7/30 T · Trend · Stand
v Verkäufe        30 / 90 / 365 / Gesamt
> Kennzahlen      > Ergebnis je Stück      > Warenbewegungen (mit Verkäufen)
> Einkäufe        > Schwund & Retouren     > eBay-Berichte
---------------------------------------------------------------------------
[Bei eBay beenden] [Angebot ansehen] [Cardmarket] [Zum Auslisten markieren] [Ausblenden]
```

Die Knopfleiste klebt heute oben und zeigt sechs gleichrangige Knöpfe. Im Entwurf steht die eine passende Aktion neben der Entscheidung, die übrigen unten.

### 4.4 Handy-Karte (Nr. 14)

```
Flammenritter – Erwacht           INFO-DE060 · Rare
24,99 €  ->  14,99 €              [zu teuer]
2 Stk · 18 Verk. in 90 T          NACHBESTELLEN
```

### 4.5 Spaltenwahl für „Alle Spalten“

„Alle Spalten“ hat 26 Spalten und ist 2.764 px breit bei 1.154 px Platz. Vorschlag: ein Menü „Spalten“ mit Häkchen je Spalte und Anzeige „12 von 26 Spalten“, Auswahl im Browser gespeichert wie die Spaltenbreiten. Vorbild: NN/g Data Tables (Ausblenden über ein sichtbares Menü, Hinweis auf ausgeblendete Spalten). Aufwand M, Nutzen mittel; nicht in der Tabelle, weil die Kompakt-Liste das Tagesgeschäft trägt.

## 5. Begriffe erklären

Als „?“ neben dem Begriff, Text bei Klick oder Tipp. Höchstens zwölf Wörter.

| Begriff | Wo | Kurztext |
|---|---|---|
| Marktwert | Liste, Drawer, Marktpreise | Mittel aus Cardmarket-Preisen und letztem EK; „ab“ zählt doppelt. |
| ab | Drawer, Gruppe Cardmarket | Günstigstes Cardmarket-Angebot; zählt im Marktwert doppelt. |
| Empfohlener VK / Zielspanne | Liste, Drawer, Urteilskacheln | Preis für 25 bis 33 % Marge bei Nachkauf, endet auf ,99. |
| Marge Nachkauf | Liste (Spalte „Marge“), Drawer | Marge deines heutigen Preises, wenn du die Karte jetzt nachkaufst. |
| Urteil | Liste, Urteilskacheln | Dein Preis gegen die Zielspanne: zu günstig, im Rahmen, zu teuer. |
| Ohne Urteil | Urteilskachel | Kein Marktwert oder Seltenheit unklar, deshalb kein Preisvergleich möglich. |
| Marktdeckel | Liste, unter der Zielspanne | Teure Karten: Preis höchstens das 1,5-fache des Marktwerts. |
| DB I | Dashboard, Drawer, Alle Spalten | Verkaufspreis minus Einkaufspreis. |
| DB II | Dashboard, Drawer, Alle Spalten | DB I minus eBay-Gebühren, Versand und Verpackung. |
| DB III | Drawer, Alle Spalten, Leitplanken | DB II minus Anteil an den festen Jahreskosten. |
| Maßnahme | Kapitalbindung | Artikel mit Status Preis senken, Auslaufen lassen oder Auslisten. |
| Sortiment (Kachel) | Drawer | Behalten, beobachten oder handeln, nach Verkäufen und Tagen am Preis. |
| Preis prüfen | Drawer, Sortiment-Status | Preis frisch geändert oder nie verkauft: abwarten, dann neu bewerten. |
| Auslaufen lassen | Sortiment-Status, Filter | Mindestpreis, 180 Tage ohne Verkauf: nicht nachkaufen, Rest abverkaufen. |
| Auslisten | Sortiment-Status, Filter | Mindestpreis, ein Jahr ohne Verkauf: Angebot bei eBay beenden. |
| Reichweite | Drawer (Bestand), Kapitalbindung | So lange reicht der Bestand beim aktuellen Verkaufstempo. |
| Umschlag/Jahr | Kapitalbindung | Wie oft sich das gebundene Kapital im Jahr verkauft. |
| Ladenhüter | Seitenkopf, Dashboard | Bestand oder Historie vorhanden, aber 365 Tage kein Verkauf. |
| Velocity 30·90·365 | Dashboard-Tabelle | Verkaufte Stück in den letzten 30, 90 und 365 Tagen. |
| EK über Markt | Filter, Marktpreise | Dein Einkaufspreis liegt mehr als 50 % über dem Marktwert. |
| Klasse | Filter, Alle Spalten | Einstufung nach Tempo und Marge: Champion, Solide, Beobachten … |

„Velocity“ besser gleich eindeutschen („Tempo 30·90·365“); die Spalte ist die einzige englische Überschrift.

## 6. Nicht angefasst, weil riskant oder unklar

- **Auslisten-Knopf in der Listenzeile (Teil von Nr. 12):** steht in `TODO.md` Abschnitt D als offene Frage an Chris. Erst nach seiner Antwort bauen; „eBay“ und „Zurückstellen“ in der Zeile sind davon unabhängig.
- **Farbe für „zu teuer“:** ist blau und damit dieselbe Farbe wie „Marktwert“ in der Legende. Das ist vermutlich Absicht (zu teuer ist kein Alarm), kollidiert aber in der Spannenleiste: der Punkt „dein VK“ wird blau, die Raute „Marktwert“ ist ebenfalls blau. Umfärben würde alle Seiten betreffen; nur mit Chris entscheiden.
- **Heller Modus:** die Farbwerte dafür existieren in `globals.css`, `layout.tsx` erzwingt aber dunkel. Nicht geprüft, ob Hell überall trägt; ein Umschalter wäre ein eigener Auftrag.
- **Preise direkt aus der App ändern:** naheliegend nach dem Vorbild von Sammel-Preiswerkzeugen, aber die App liest nur (Billbee, eBay-Shop-Abruf, Cardmarket-Preisführer). Schreibzugriff auf eBay oder Billbee ist eine andere Größenordnung und nicht vorgeschlagen. Ebenso keine Preisvorschläge/Best-Offer.
- **Nebenseiten zusammenlegen (Empfehlungen, Top/Flop, Marktpreise):** vieles davon steckt inzwischen im Sortiment. Ob die Seiten wegkönnen, hängt davon ab, ob Chris sie noch aufruft; das lässt sich aus der Demo nicht ablesen.
- **Einstellungen:** die Seite sagt selbst „Reine Anzeige. Kostensätze werden per Datei/Code gepflegt“. Sie ist lang und dicht, wird aber selten gebraucht; außer dem Handy-Überlauf (Nr. 9) nichts vorgeschlagen.
- **Kartenbilder:** in der Demo leer, deshalb keine Aussage zu Bildgröße, Vorschau beim Überfahren und Ladeverhalten.
- **Kennzahl „Verkaufspreis gegen Markt“:** zeigte in der Demo „+505,9 %“. Das liegt sehr wahrscheinlich an den erfundenen Daten und ist kein belegter Fehler; mit echten Daten gegenprüfen.
- **Leitplanken-Seite (`/cockpit`):** 3.800 px lang mit acht Blöcken, optisch sauber und in sich stimmig. Als Monats- statt Tagesansicht ist die Dichte vertretbar; keine Änderung vorgeschlagen außer dem Titel (Nr. 4).

## 7. Vergleich und Quellen

Abrufdatum für alle: 14.11.2026. Aufgeführt ist nur, was tatsächlich gelesen wurde. Nicht erreichbar waren zwei TCGplayer-Hilfeseiten (CSV-Preisimport, Price Differential Report; beide HTTP 403) und die alte Polaris-Seite zu „IndexFilters“ (Weiterleitung auf eine allgemeine Seite). Cardmarket-Verkäuferbereich, Billbee, JTL, Plentymarkets, Etsy, Sortly, Stripe, Vercel, Notion, ManaBox, Collectr und CardSphere wurden nicht gelesen und sind deshalb nicht bewertet.

| Vorbild | Was es besser macht, was wir übernehmen | Quelle |
|---|---|---|
| Shopify Admin, Produktliste | Gespeicherte Ansichten stehen als Menü neben der Suche; eine Ansicht ist Filter plus Spalten und aktualisiert sich selbst, wenn Produkte die Bedingung erfüllen oder nicht mehr erfüllen. Übernommen: Aufgaben-Reiter mit festen Filtern (Nr. 5), Filter als benannte Gruppen (Nr. 11). | https://help.shopify.com/manual/products/searching-filtering |
| Shopify, Bestandsberichte | Standardberichte heißen nach der Frage, die sie beantworten: „Tage Bestand übrig“, „Abverkaufsquote“, „ABC-Analyse nach Umsatzanteil“. LEC rechnet Reichweite und Umschlag schon; übernommen wird die klare Benennung und Kurz-Erklärung (Abschnitt 5). | https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/inventory-reports |
| Linear, Custom Views | Jede gefilterte Liste lässt sich als Ansicht speichern, anheften und per Adresse teilen; die Adresse trägt auch vorübergehende Filter. Übernommen: Reiter per Adresse aufrufbar, damit das Dashboard direkt hineinverlinken kann (Nr. 5). | https://linear.app/docs/custom-views |
| eBay Seller Hub | Die Übersicht fasst Aufgaben, Bestellungen und Angebote zusammen und bietet Schnellzugriff auf häufige Aktionen. Die Hilfeseite nennt keine Einzelheiten zu den Aufgaben; übernommen ist nur das Prinzip „Aufgaben zuerst“ für die Zeile „Heute“ (Nr. 5). | https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095 |
| TCGplayer MassPrice | Preisregeln beziehen sich auf klar benannte Referenzpreise (Marktpreis aus Verkäufen, niedrigstes Angebot), haben eine Untergrenze und zeigen vor dem Ausführen eine Vorschau der Änderungen. Übernommen: im Drawer und im Reiter „Preis ändern“ immer „alt → neu“ zeigen und benennen, worauf der Marktwert beruht (Nr. 6, Abschnitt 5). Nicht übernommen: automatisches Umpreisen. | https://seller.tcgplayer.com/articles/massprice-best-practices |
| NN/g, Data Tables | Spalten nach Wichtigkeit ordnen, Kopfzeile und erste Spalte fixieren, höchstens ein bis zwei Aktionen in der Zeile, Sammelaktionen über Kästchen, aktive Filter und ausgeblendete Spalten sichtbar machen, Einzelbearbeitung in einer Seitenleiste statt in einem Dialog. Kopfzeile, erste Spalte und Seitenleiste hat LEC schon; übernommen: Nr. 1, 11, 12 und 4.5. | https://www.nngroup.com/articles/data-tables/ |
| NN/g, Progressive Disclosure | Auf der ersten Ebene nur das Häufige, höchstens zwei Ebenen, Auslöser klar beschriften, Häufiges nie verstecken. LEC versteckt heute das Häufige (Aufgabenfilter) und zeigt das Seltene offen (Warenbewegungen); übernommen: Nr. 4, 6, 7, 10, 15. | https://www.nngroup.com/articles/progressive-disclosure/ |
| NN/g, Empty States | Leere Flächen sollen sagen, ob geladen wird, ein Fehler vorliegt oder nichts da ist, und einen direkten Weg zur nächsten Aktion bieten. Übernommen: Ladegerüst je Route und die Kürzung der fast leeren Karte „Cardmarket-Check“ (Randbefunde in Abschnitt 3). | https://www.nngroup.com/articles/empty-state-interface-design/ |

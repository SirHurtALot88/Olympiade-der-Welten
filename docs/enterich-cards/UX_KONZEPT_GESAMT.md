# LEC: UX-Gesamtkonzept für Dashboard, Sortiment und Nebenseiten (14.11.2026)

Entwurf von Fable. Hier wird nichts umgesetzt; die Aufgabenliste in Abschnitt 7 ist für den umsetzenden Agenten.

**Grundlage:** lokale Demo mit 300 erfundenen Artikeln, Login abgeschaltet, Screenshots mit Chromium in 1440×900 und 390×844. Angesehen: `/`, `/sortiment` (Kompakt, „Alle Spalten“, „Weitere Filter“ offen), `/cockpit`, `/empfehlungen`, `/top-flop`, `/marktpreise`, `/einstellungen`. Nicht angesehen: `/import` (nur geladen), `/login`, der Drawer (schon umgebaut), echte Daten, Kartenbilder (die Demo hat keine).

**Stand des Codes beim Ansehen:** Meine Kopie der App war von vor dem Aufgaben-Reiter. Den Reiter und die Zeile „Heute“ habe ich nur im Code gelesen (`lib/dashboard/tasks.ts`, Arbeitsstand von `SortimentPage.tsx` und `DashboardShell.tsx`), nicht am Bildschirm gesehen. Die Adresse heißt dort `?aufgabe=…`, nicht `?ansicht=…`; `?ansicht=alles` ist schon für „Alle Spalten“ vergeben. Dieses Dokument schreibt durchgehend `?aufgabe=`.

`docs/enterich-cards/KENNZAHLEN_RECHERCHE.md` gab es beim Schreiben noch nicht. Die Kennzahlen im Dashboard-Entwurf stammen aus dem, was die App heute schon rechnet. Wenn die Recherche andere Kennzahlen nach vorn stellt, tauscht man sie in den drei Blöcken aus; der Aufbau bleibt.

Pfade sind relativ zu `apps/LEC/src`.

## 1. Kurzfazit

Die App beantwortet „was läuft gut, was schlecht, was muss weg“ heute dreimal mit drei verschiedenen Listen (Dashboard, Leitplanken, Top/Flop), und keine der drei führt per Klick zum Artikel. Dieselbe Frage „wie viele Artikel sind zu günstig“ ergibt je nach Seite 56, 67 oder 83, weil drei Rechnungen denselben Namen tragen; das ist der wichtigste Befund, denn er macht jede Ampel unglaubwürdig. Ich schlage drei Seiten vor: **Dashboard** (Aufgaben und die drei Blöcke gut, schlecht, muss weg), **Sortiment** (die einzige Artikelliste, mit Aufgaben-Reitern) und **Finanzen** (heute „Leitplanken“, nur noch Geld); Top/Flop, Empfehlungen und Marktpreise gehen darin auf und leiten um. Farben bekommen eine feste Bedeutung: Rot heißt Geld geht verloren oder liegt fest, Gelb heißt handeln, Grün heißt in Ordnung, Blau heißt Marktdaten, und eine Zahl ohne Urteil ist grau. Der größte Hebel bei kleinem Aufwand sind anklickbare Dashboard-Zeilen, ein Name je Rechnung und das Streichen der Sortiment-Vorschau und der Cardmarket-Karte vom Dashboard.

## 2. Befund und Vorschlag je Seite

### 2.1 Dieselbe Zahl auf mehreren Seiten

Aus den Screenshots der Demo abgelesen:

| Zahl | Dashboard | Sortiment | Leitplanken | Top/Flop | Empfehlungen | Marktpreise |
|---|---|---|---|---|---|---|
| Umsatz, Verkäufe, Marge DB II (90 T) | 7.650 € / 603 / 37 % | – | 7.650 € / 603 / 36,7 % | – | – | – |
| „zu günstig“ | – | **56** | **67** (Preis-Hinweise) und **83** (Preis-Ampel) | – | „Verschenkte Marge 1.337 €“ | **67** |
| „zu teuer“ | – | **28** | **33** und **6** | – | – | **33** |
| Ladenhüter, gebundenes Geld | 58 Artikel, **323 €** | 58; Kapitalbindung **2.012 €**, davon 259 € mit Maßnahme | 2.012 € | 58, **323 €** | **1.147 €** „Gebundenes Kapital · Ladenhüter“ | – |
| EK fehlt | 102 (im Empfehlungstext) | Chip „kein EK“ | 102 (Kachel) und „kein EK 102“ | – | 102 | „kein EK“ je Zeile |
| Beste Artikel | „Läuft gerade gut“ (Umsatz 30 T) | – | „Läuft“ (Umsatz 90 T, DB II positiv) | „Top-Seller“ (Umsatz 90 T) | – | – |
| Schlechteste Artikel | „Läuft schlecht“ (DB II % Lebenszeit) | – | „Bremst“ (DB II € 90 T) | „Low-Runner“ (DB II % Lebenszeit) | „Daten prüfen“ (dieselben Artikel) | – |

Was daraus folgt:

- **„zu günstig“ gibt es in drei Rechnungen.** 56 = Marktwert-Zielspanne, nur Artikel mit Bestand und Standardfiltern (Sortiment). 67 = dieselbe Rechnung über alle Artikel mit Marktwert (Marktpreise, Leitplanken „Preis-Hinweise“). 83 = eigener EK gegen Korridor (Leitplanken „Preis-Ampel“, Filter „Eigener EK“ im Sortiment, Spalte „Preis-Korridor“ im Dashboard). Die dritte ist eine andere Frage und braucht einen anderen Namen (Abschnitt 6.2).
- **Ladenhüter-Geld: 323 € gegen 1.147 €.** Ich habe nicht nachgerechnet, woher der Unterschied kommt (vermutlich EK-Wert gegen VK-Wert oder andere Artikelmenge). Vor der Umsetzung klären und nur eine Zahl zeigen, mit der Angabe „zum EK“.
- **Die schlechteste-Artikel-Listen sortieren nach Prozent.** Im Dashboard steht „−147 %“ ganz oben; die vier gezeigten Artikel haben zusammen 59 € Umsatz. Das ist laut, aber unwichtig. Sortieren nach verlorenen Euro.
- **„Margen-Champions“ in Top/Flop sind gelb, „Ladenhüter“ auch.** Gelb heißt dort einmal „sehr gut“ und einmal „schlecht“.
- **„Auslisten“ hat vier Bedeutungen:** Klasse „Auslisten“ (Filter-Chip, Sortimentsgesundheit), Maßnahme „Auslisten“ (365 Tage ohne Verkauf am Mindestpreis), Reiter „Auslisten“ (Preis senken + Auslaufen lassen + Auslisten), „Zum Auslisten markiert“.
- **Grüne Marge neben „Preis senken“.** In der Kompakt-Liste steht „49 %“ grün neben dem Urteil „Preis senken“ und einem Artikel, der seit 516 Tagen nicht verkauft wurde. Die Marge bei Nachkauf ist dort eine Angabe, kein Urteil.

### 2.2 Tabelle je Seite

| Seite, Komponente | Zweck (Entscheidung) | Bleibt | Weg | Zusammenlegen |
|---|---|---|---|---|
| **Dashboard** `/` · `components/dashboard/DashboardShell.tsx`, `KpiRow.tsx`, `MoversPanels.tsx`, `SortimentTable.tsx`, `CardmarketPlaceholder.tsx`, `OperatingQuotas.tsx`, `Recommendations.tsx` | „Was mache ich heute, und wie steht der Shop?“ | Zeile „Heute“; Fensterwahl 30/90/365 T; Kacheln Umsatz, Verkäufe, Marge; „Läuft gut“, „Läuft schlecht“ (neu sortiert, anklickbar) | Sortiment-Vorschau mit 8 Zeilen (zeigt die Spalten „Velocity“, „Preis-Korridor“, „Klasse“, die das Sortiment selbst nicht mehr vorn hat); Karte „Cardmarket-Check“ (eine Zahl, 600 px Leerfläche, Untertitel „Provider B · manuell“ ist überholt); Liste „Das lohnt sich anzusehen“ (vier Absätze mit demselben Satz); Fußzeile „Bar = Verlusttiefe …“ | „Betriebs-Quoten“ nach Finanzen. Neuer dritter Block „Muss weg“. Kachel „Totes Kapital“ wandert in „Muss weg“ |
| **Sortiment** `/sortiment` · `components/sortiment/SortimentPage.tsx`, `PreisBoard.tsx`, `PreisUeberblick.tsx`, `KapitalPanel.tsx`, `ArtikelDetail.tsx` | „Welche Artikel fasse ich an, und was tue ich mit jedem?“ | Aufgaben-Reiter; Kompakt-Liste; Suche; Drawer; „Alle Spalten“ als Zweitansicht | Die vier großen Urteilskacheln (115 px hoch, mit Erklärsatz) werden eine Chip-Zeile; Filtergruppe „Eigener EK“ mit den Wörtern „zu günstig / im Korridor / zu teuer“ (Verwechslung, siehe 6.2); Aufgaben-Chips in „Weitere Filter“, die jetzt Reiter sind | „Überblick: Grafiken“ und „Kapitalbindung“ in einen Reiter „Auswertung“ ganz rechts. Nimmt „Marktpreise“, „Empfehlungen“ und die Ranglisten aus „Top/Flop“ als Reiter, Filter und Sortierung auf |
| **Leitplanken** `/cockpit` · `components/cockpit/CockpitPage.tsx`, `KpiRow.tsx`, `BridgeCard.tsx`, `GuardrailsCard.tsx`, `TempoCard.tsx`, `CapitalCard.tsx`, `DistributionCard.tsx`, `MarketHintsCard.tsx`, `MoversCard.tsx` | „Verdiene ich Geld, und bleibe ich in meinen Grenzen (Kleinunternehmer, Warenbudget)?“ | Kacheln mit Verlaufsbalken; „Wo bleibt die Marge?“; „Leitplanken 2026“; „Tempo: Verkauf vs. Wareneinsatz“; „Kapital & Tempo“; Datenstand-Leiste | „Preis-Hinweise Cardmarket“ (`MarketHintsCard`), „Läuft / Bremst / Fällt ab“ (`MoversCard`), „Preis-Ampel“ (rechte Hälfte von `DistributionCard`): alles Artikel-Themen, die im Dashboard und Sortiment stehen. Seite wird von 3.800 px auf etwa 1.900 px kürzer | Nimmt „Betriebs-Quoten“ vom Dashboard auf. „Sortimentsgesundheit“ (linke Hälfte von `DistributionCard`) bleibt, jede Klasse verlinkt ins Sortiment. Neuer Name „Finanzen“ (Entscheidung E1) |
| **Top/Flop** `/top-flop` · `components/topflop/TopFlopPage.tsx`, `RankList.tsx` | „Wer sind meine besten und schlechtesten Artikel?“ | – | Die Seite. Vier Ranglisten zu je zehn Zeilen, nicht anklickbar, „Low-Runner“ nach Prozent | Top-Seller und Margen-Champions werden „Läuft gut“ im Dashboard; Low-Runner wird „Läuft schlecht“; Ladenhüter wird „Muss weg“. Die volle Liste ist das Sortiment mit Sortierung (Links in Abschnitt 4.3). `/top-flop` leitet auf `/` um |
| **Empfehlungen** `/empfehlungen` · `components/empfehlungen/EmpfehlungenPage.tsx`, Texte in `lib/dashboard/viewModel.ts` | „Was soll ich tun?“ | Die Regeln dahinter | Die Seite: 196 Einträge, 7.900 px (Handy 21.000 px), fast überall derselbe Satz; „Ausblenden“ je Eintrag ist eine zweite Ausblenden-Logik neben der im Sortiment | Auslisten, Preis anpassen, Nachkaufen sind schon Reiter. „EK pflegen“ und „Daten prüfen“ werden der neue Reiter „Daten prüfen“. „Lot bilden“ wird ein Filter-Chip. `/empfehlungen` leitet auf `/sortiment?aufgabe=daten` um |
| **Marktpreise** `/marktpreise` · `components/marktpreise/MarktpreisePage.tsx`, `MarketComparisonTable.tsx` | „Passt mein Preis zum Markt?“ | – | Die Seite. Jede Spalte (Eigener VK, EK, Marktwert, Zielspanne, Marge, Ampel) steht auch in der Kompakt-Liste, dort mit Bestand, Verkäufen und Aktionen. Der Kasten „Noch kein Artikel ausgewählt“ belegt den oberen Bildschirm | Reiter „Preis ändern“ im Sortiment. Einzig eigene Angaben: „EK ggü. Markt“ und „Preisliste vom“. Die erste ist schon ein Chip („EK über Markt 24“), die zweite gehört als Zeile „Cardmarket-Preise vom …“ in die Fußzeile. `/marktpreise` leitet auf `/sortiment?aufgabe=preis` um |
| **Einstellungen** `/einstellungen` · `components/einstellungen/EinstellungenPage.tsx`, `BetriebszahlenCard.tsx`, `BillbeeSyncCard.tsx`, `ImageSyncCard.tsx`, `ImportHistoryCard.tsx` | „Stimmen meine Kostensätze, und sind die Daten frisch?“ | Alles inhaltlich | Nichts | Reihenfolge ändern: „Datenstand“ und „Billbee“ nach oben (danach sucht man), Kostensätze darunter, Vergleichstabellen („Nebenkosten alt/neu“, „eBay-Gebührensatz: echt gegen Modell“, „Betriebszahlen je Jahr“) einklappen. „Betriebszahlen je Jahr“ passt inhaltlich besser nach Finanzen (Entscheidung E5). Handy: die Seite ist weiter 878 px breit bei 390 px Bildschirm, Texte sind abgeschnitten |
| **Import** `/import` · `components/import/ImportView.tsx` | Rückfall, wenn Billbee nicht automatisch liefert | Die Seite | – | Bleibt nur über den Knopf „Zum Import →“ in den Einstellungen erreichbar |
| **Rahmen** · `components/shell/AppShell.tsx`, `components/dashboard/Sidebar.tsx`, `UpdateButton.tsx` | Navigation, Datenstand | Seitenleiste, untere Leiste am Handy, „Jetzt aktualisieren“ | Fußzeile mit Wort „Live“ und technischen Sätzen („Alle Zahlen serverseitig …“) | Eine Zeile „Stand: Billbee vor 2 Std · Cardmarket 14.11.“ in der Seitenleiste unter dem Aktualisieren-Knopf, gelb ab 24 Std, rot ab 3 Tagen |

## 3. Informationsarchitektur und Navigation

### 3.1 Seiten

| Menüpunkt | Adresse | Überschrift | Inhalt |
|---|---|---|---|
| Dashboard | `/` | Dashboard | Heute, Kennzahlen, Läuft gut, Läuft schlecht, Muss weg |
| Sortiment | `/sortiment` | Sortiment | alle Artikel, Aufgaben-Reiter, Drawer |
| Finanzen | `/cockpit` (Adresse bleibt) | Finanzen | Marge, Leitplanken, Tempo, Kapital, Quoten |
| Einstellungen | `/einstellungen` | Einstellungen | Datenstand, Billbee, Kostensätze, Import |

Reihenfolge in der Seitenleiste: Dashboard, Sortiment, Finanzen; unten „Jetzt aktualisieren“, die Stand-Zeile, „Einstellungen“. Handy unten: Dashboard, Sortiment, Finanzen, Einstellungen (wie heute, nur der dritte Name ändert sich).

Das hält Chris' frühere Entscheidung ein: es bleiben drei Menüpunkte. Die Nebenseiten kommen nicht zurück in die Navigation, sie verschwinden als eigene Seiten.

### 3.2 Umleitungen

| Alte Adresse | Neu |
|---|---|
| `/top-flop` | `/` |
| `/empfehlungen` | `/sortiment?aufgabe=daten` |
| `/marktpreise` | `/sortiment?aufgabe=preis` |

Erst umleiten, die Komponenten eine Weile liegen lassen, dann löschen (Aufgaben 13 und 21).

### 3.3 Eine Regel für Verweise

Jede Zahl, die Artikel zählt, ist ein Link ins Sortiment mit genau dem Filter, der diese Artikel zeigt. Jeder Artikelname außerhalb des Sortiments öffnet `/sortiment?artikel=<id>` mit offenem Drawer. Heute ist auf Dashboard, Leitplanken und Top/Flop kein einziger Artikel anklickbar. Ob `?artikel=` schon existiert, habe ich nicht geprüft; falls nicht, gehört es zu Aufgabe 2.

## 4. Dashboard-Entwurf

### 4.1 Desktop, 1440 px

```
Dashboard                                                [30 T | 90 T* | 365 T | Lebenszeit]

HEUTE  [Nachbestellen 87] [Preis ändern 84] [Auslisten 16] [Markiert 6] [Daten prüfen 109] [Aufräumen 5]

┌ Umsatz · 90 T ──────┐ ┌ Verkäufe · 90 T ───┐ ┌ Marge · 90 T ───────┐ ┌ Ergebnis · 90 T ─────┐
│ 7.650 €             │ │ 603 Stk            │ │ 37 %                │ │ 1.582 €              │
│ ▲ 12 % zum Vorfenster│ │ Ø 12,69 € je Stück │ │ nach EK, Versand,   │ │ nach Fixkosten       │
│                     │ │                    │ │ eBay-Gebühr         │ │ 21 % vom Umsatz      │
└─────────────────────┘ └────────────────────┘ └─────────────────────┘ └──────────────────────┘

┌ ● LÄUFT GUT ───────────────┐ ┌ ● LÄUFT SCHLECHT ───────────┐ ┌ ● MUSS WEG ─────────────────┐
│ 84 Artikel tragen 53 %     │ │ 29 fallen ab · 14 mit       │ │ 58 Ladenhüter · 323 €       │
│ vom Umsatz                 │ │ Verlust · 56 zu günstig     │ │ zum EK gebunden             │
│                            │ │                             │ │                             │
│ Gewinn · 30 T              │ │ Verlust · 90 T              │ │ Gebunden · seit letztem Verk.│
│ Flammenritter        +96 € │ │ Drachenseher         −18 €  │ │ Kristallsphinx  125 € · nie │
│  18 Stk · Bestand 2 ·      │ │  16 Stk · VK 2,99 · EK 0,99 │ │  12 Stk · Auslisten         │
│  NACHBESTELLEN             │ │ Eisensphinx          −14 €  │ │ Schattensphinx   48 € · 412 T│
│ Lichtwächter         +39 € │ │ Kristallritter       −13 €  │ │  5 Stk · Preis senken       │
│ Flammensphinx    EK fehlt  │ │                             │ │ Nebeltitan       38 € · 390 T│
│ Lichtfalke           +32 € │ │ Fällt ab · 90 T gegen Jahr  │ │ Drachensphinx    20 € · 380 T│
│ Schattenritter       +28 € │ │ Kristalltitan   1,8 → 0,3/Mon│ │ Nebeljäger       17 € · 371 T│
│                            │ │ Kristallfalke   1,6 → 0/Mon │ │                             │
│ Ausverkauft, lief gut: 7   │ │ Zu günstig: 980 € liegen    │ │ Auslisten 16 · Markiert 6   │
│                            │ │ gelassen                    │ │ Bei eBay beendet 5          │
│ Alle nach Gewinn →         │ │ Alle mit Verlust →          │ │ Alle Ladenhüter →           │
└────────────────────────────┘ └─────────────────────────────┘ └─────────────────────────────┘

Stand: Billbee vor 2 Std · Cardmarket 14.11. · 300 Artikel
```

Die Zahlen sind aus der Demo übernommen oder Platzhalter; „▲ 12 %“ und die Gewinnbeträge sind erfunden, um die Form zu zeigen.

Bei 1440 px passt alles ohne Scrollen auf einen Bildschirm (heute 1.966 px). Unter 1100 px stehen die drei Blöcke untereinander.

### 4.2 Handy, 390 px

```
Dashboard
[30 T][90 T*][365 T][Lebensz.]

HEUTE
[Nachbestellen 87][Preis ändern 84]
[Auslisten 16]    [Markiert 6]
[Daten prüfen 109][Aufräumen 5]

Umsatz 7.650 €  │ Verkäufe 603
Marge 37 %      │ Ergebnis 1.582 €

▼ ● MUSS WEG   58 · 323 € gebunden
  Kristallsphinx        125 € · nie
  Schattensphinx       48 € · 412 T
  Nebeltitan           38 € · 390 T
  Alle Ladenhüter →

▶ ● LÄUFT SCHLECHT  29 fallen ab · 14 Verlust
▶ ● LÄUFT GUT       84 tragen 53 %
```

Am Handy steht „Muss weg“ zuerst und offen, die beiden anderen sind zugeklappt und zeigen nur ihre Kopfzeile. Je Block drei statt fünf Zeilen. „Heute“ ist ein Raster mit zwei Spalten, jede Schaltfläche mindestens 44 px hoch. Die Kennzahlen sind vier kleine Felder ohne Unterzeile. Ziel: unter 1.400 px Seitenhöhe (heute 3.299 px).

### 4.3 Was in den Blöcken steht und wohin der Klick führt

**Zeile „Heute“.** Baut der Hauptagent; meine Verfeinerungen:

| Punkt | Vorschlag |
|---|---|
| Reihenfolge | Nachbestellen, Preis ändern, Auslisten, Markiert, Daten prüfen, Aufräumen. Dieselbe Reihenfolge wie die Reiter |
| Farbe | Zähler über 0: gelber Rand (handeln). Zähler 0: grau mit Haken „✓“, bleibt sichtbar und anklickbar. Kein Rot in dieser Zeile |
| Neu: „Daten prüfen“ | Artikel ohne EK mit Verkauf in 90 T, plus Artikel mit Verkäufen und negativer Marge (heute „Daten prüfen“ in den Empfehlungen). Ersetzt die Empfehlungsliste |
| Beschriftung | Nur Wort und Zahl. Der Erklärsatz aus `TASKS[].hint` bleibt als Hover |
| Fensterwahl | Die Zeile hängt nicht am Fenster 30/90/365 T. Deshalb steht sie über der Fensterwahl oder optisch getrennt davon, sonst erwartet man, dass sich die Zähler mit dem Fenster ändern |
| Große Zähler | „87 nachbestellen“ ist keine Tagesaufgabe. Unter dem Zähler klein „davon 12 ausverkauft“ zeigen, das ist der dringende Teil (Entscheidung E4) |

**Kennzahlen-Zeile.** Vier Kacheln, alle neutral (keine Farbe außer dem Pfeil).

| Kachel | Wert | Unterzeile | Hover | Klick |
|---|---|---|---|---|
| Umsatz · {Fenster} | Euro | „▲ / ▼ x % zum Vorfenster“ (gleich lange Zeit davor); bei „Lebenszeit“ leer | „Summe der Verkaufspreise im Fenster.“ | `/cockpit` |
| Verkäufe · {Fenster} | Stück | „Ø 12,69 € je Stück“ | – | `/cockpit` |
| Marge · {Fenster} | Prozent | „nach EK, Versand, eBay-Gebühr“ | „Deckungsbeitrag II. Artikel ohne EK zählen nicht mit: 102 Artikel, 35 % vom Umsatz.“ | `/cockpit` |
| Ergebnis · {Fenster} | Euro | „nach Fixkosten · 21 % vom Umsatz“ | „Deckungsbeitrag III: Marge minus Fixkostenanteil je Stück.“ | `/cockpit` |

Heute zeigt die erste Kachel „603 Stk verkauft“ als Unterzeile und die zweite Kachel dieselbe 603 groß. „Ergebnis“ gibt es bisher nur auf Leitplanken; es ersetzt hier „Totes Kapital“, das in „Muss weg“ wandert. Den Vergleich zum Vorfenster muss man neu rechnen; ob die Daten dafür reichen (Verkäufe mit Datum vor dem Fenster), habe ich nicht geprüft. Ohne ihn bleibt die Unterzeile leer.

**Block „Läuft gut“** (grüner Punkt).

| Zeile | Kennzahl | Klick |
|---|---|---|
| Kopf | „{n} Artikel tragen {x} % vom Umsatz“ (Klassen Champion + Solide, Fenster 365 T) | `/sortiment?klasse=champion,solide` |
| Liste „Gewinn · 30 T“, 5 Zeilen | Sortiert nach DB II in Euro in 30 T, nicht nach Umsatz. Je Zeile: Name, „+96 €“, darunter „18 Stk · Bestand 2“ und bei Bedarf der Marker „NACHBESTELLEN“ (gelb). Fehlt der EK: statt Betrag „EK fehlt“ (gelb), einsortiert nach Umsatz | Zeile öffnet den Drawer |
| Fuß 1 | „Ausverkauft, lief gut: {n}“ | bestehender Filter „ausverkauft, lief gut“ |
| Fuß 2 | „Alle nach Gewinn →“ | `/sortiment?sort=gewinn30` |

Der Balken unter jeder Zeile entfällt. Er zeigt heute DB I in Prozent und ist bei fehlendem EK grau und voll; er trägt keine Entscheidung.

**Block „Läuft schlecht“** (gelber Punkt: Artikel, die man behält, an denen man aber etwas tun muss).

| Zeile | Kennzahl | Klick |
|---|---|---|
| Kopf | „{n} fallen ab · {n} mit Verlust · {n} zu günstig“ | je Zahl eigener Link |
| Liste „Verlust · 90 T“, 3 Zeilen | Artikel mit bekanntem EK und negativem DB II, sortiert nach verlorenen Euro in 90 T. Je Zeile: Name, „−18 €“ (rot), darunter „16 Stk · VK 2,99 · EK 0,99“ | Drawer |
| Liste „Fällt ab · 90 T gegen Jahr“, 2 Zeilen | Klasse „Fällt ab“, sortiert nach Umsatz 365 T. Je Zeile: Name, „1,8 → 0,3/Mon“ | Drawer |
| Fuß 1 | „Zu günstig: {x} € liegen gelassen“ (die Zahl steht schon in `MarketHintsCard`, „≈ € 980 liegen gelassen“) | `/sortiment?aufgabe=preis&urteil=zu_guenstig` |
| Fuß 2 | „Alle mit Verlust →“ | `/sortiment?aufgabe=daten` |

**Block „Muss weg“** (roter Punkt: Geld liegt fest).

| Zeile | Kennzahl | Klick |
|---|---|---|
| Kopf | „{n} Ladenhüter · {x} € zum EK gebunden“; klein darunter, wenn es zutrifft: „{n} davon ohne EK, nicht eingerechnet“ | `/sortiment?klasse=ladenhueter&sort=gebunden` |
| Liste „Gebunden · seit letztem Verkauf“, 5 Zeilen | Ladenhüter und Artikel mit Maßnahme, sortiert nach Bestand × EK. Je Zeile: Name, „125 € · 412 T“ bzw. „nie“, darunter „12 Stk · Auslisten“ (die Maßnahme: Preis senken, Auslaufen lassen, Auslisten) | Drawer |
| Fuß 1 | „Auslisten {n} · Markiert {n} · Bei eBay beendet {n}“ | die drei Reiter |
| Fuß 2 | „Alle Ladenhüter →“ | wie Kopf |

Die Adress-Parameter `klasse`, `sort`, `urteil` sind Vorschläge. Welche Filter `SortimentPage.tsx` heute schon aus der Adresse liest, habe ich nicht vollständig geprüft; fehlende gehören zu Aufgabe 2.

## 5. Sortiment-Entwurf

### 5.1 Aufbau, 1440 px

```
Sortiment                                         [⌕ Name oder Set-Code]  [Kompakt* | Alle Spalten]
216 aktiv · 84 ausgelaufen

[Alle 211] [Nachbestellen 87] [Preis ändern 84] [Auslisten 16] [Markiert 6] [Daten prüfen 109] [Aufräumen 5]   [Auswertung]

Urteil: (zu günstig 56) (im Rahmen 28) (zu teuer 28) (ohne Urteil 61)     [Bestand ▾] [Karte ▾] [Klasse ▾] [Anzeigen ▾]
Aktiv:  (Ordner: Blazing ×) (Bestand 1 Stk ×)   Alle zurücksetzen                              84 von 300 Artikeln
───────────────────────────────────────────────────────────────────────────────────────────────────
☐  Artikel                    Dein VK     Urteil               Empfohlen        Bestand   Verkäufe    Marktwert
☐  Flammenritter – Erwacht    24,99 €     ● zu teuer           ━◆━━●━━━○        2         38 · 18     4,22 €     [eBay ↗] [⋯]
   INFO-DE060 · Rare          eBay ↗      ↓ auf 14,99 €        11,93–14,54 €    NACHBEST. vor 7 T
☐  Schattenmagier – Erwacht   19,99 €     ● zu günstig         ━◆━○━━━●━        1         9 · 3       13,22 €    [eBay ↗] [⋯]
───────────────────────────────────────────────────────────────────────────────────────────────────
2 ausgewählt:   [Zum Auslisten vormerken]  [Nachbestellen zurückstellen ▾]  [Ausblenden]  [Set-Codes kopieren]   Auswahl aufheben
```

Was sich gegenüber dem Stand im Screenshot ändert:

- Die vier Urteilskacheln werden die Chip-Zeile „Urteil“. Das spart rund 100 px vor der ersten Zeile. Der Erklärsatz jeder Kachel wird der Hover des Chips.
- „Überblick: Grafiken zur Auswahl“ und „Kapitalbindung“ stehen heute zwischen Filter und Liste. Sie wandern in den Reiter „Auswertung“. Der Kopfsatz der Kapitalbindung („2.012 € gebunden, davon 259 € mit Maßnahme“) steht dort als erste Zeile.
- Die Zeile „Sortierung [Größte Abweichung ▾]“ entfällt in Kompakt: sortiert wird über die Spaltenköpfe, jeder Reiter bringt seine Sortierung mit (5.2).
- Die Legende „Zielspanne · dein VK · Marktwert“ wird der Hover des Spaltenkopfs „Empfohlen“.
- Der Kopf zeigt „216 aktiv · 84 ausgelaufen“. „58 Ladenhüter“ entfällt dort; die Zahl steht im Dashboard und im Menü „Klasse“.

### 5.2 Reiter: Filter, Sortierung, Spalten

Die Spalten „☐“, „Artikel“ (Name, darunter Set-Code, Seltenheit, Kartenart) und am Ende die Aktionen stehen in jedem Reiter und sind unten nicht wiederholt. Am Zeilenende steht immer „eBay ↗“ (Bearbeiten bei eBay) und „⋯“ (Menü mit allen übrigen vorhandenen Aktionen).

| Reiter | Zeigt | Sortierung | Spalten nach „Artikel“ | Zweiter Knopf in der Zeile |
|---|---|---|---|---|
| **Alle** | aktive Artikel mit Standardfiltern | größte Abweichung vom empfohlenen VK | Dein VK · Urteil · Empfohlen · Bestand · Verkäufe (365 T · 90 T, darunter letzter Verkauf) · Marktwert · Marge | – |
| **Nachbestellen** | `reorderDue` | Ausverkaufte zuerst, dann kürzeste Reichweite | Bestand · Soll · Fehlt · Reichweite · Verkäufe 90 T · Ø EK · Marktwert · Marge | „Zurückstellen“ |
| **Preis ändern** | zu günstig oder zu teuer, mit Bestand | Abstand in Euro × Verkäufe 90 T | Dein VK · Urteil · Empfohlen · Abstand (€ und %) · Marktwert · Verkäufe · Bestand · Preis seit | – (eBay ↗ ist hier die Aktion) |
| **Auslisten** | Maßnahme Preis senken, Auslaufen lassen, Auslisten | gebundenes Geld (Bestand × EK) | Maßnahme · Letzter Verkauf · Bestand · Gebunden · Dein VK · Empfohlen · Preis seit | „Vormerken“ |
| **Markiert** | zum Auslisten vorgemerkt | ältestes Vormerk-Datum zuerst | Vorgemerkt am · Bestand · Dein VK · Letzter Verkauf · eBay-Status | „Bei eBay beenden ↗“ |
| **Daten prüfen** (neu) | ohne EK mit Verkauf in 90 T; mit Verkäufen und negativer Marge | Umsatz 90 T | Grund · Ø EK · Ø VK · Marge · Verkäufe 90 T · Umsatz 90 T | – |
| **Aufräumen** | bei eBay beendet, doppelt angelegt, Name passt nicht zum Code | nach Grund, dann Name | Grund · Bestand · eBay-Nr. · Letzter Verkauf | „Ausblenden“ |
| **Auswertung** | keine Liste | – | Überblick-Grafiken, Kapitalbindung | – |

Wortlaut einiger Zellen:

- „Fehlt“: `reorderQty` als „10 Stk“. „Reichweite“: „0,5 Mon“, bei Bestand 0 „ausverkauft“ (rot).
- „Abstand“: „−10,00 € · −40 %“. Der Zielpreis darunter endet auf ,99: „↓ auf 14,99 €“. Heute zeigt die Liste „↓ auf 14,54 €“; der Drawer rundet laut `DRAWER_AUFRAEUMEN.md` schon auf ,99. Dieselbe Rundung in `PreisBoard.tsx` (Zeile 107) verwenden.
- „Grund“ in „Daten prüfen“: „EK fehlt“ oder „Verlust trotz Verkäufen“. In „Aufräumen“: „Bei eBay beendet“, „Doppelt“, „Name ≠ Code“.
- „Marge“: neutrale Schrift, rot nur unter 0 %. Kein Grün.
- „Preis seit“: „62 T“, Hover „Seit 62 Tagen am aktuellen Preis.“

Reiter und Zähler verhalten sich wie im Arbeitsstand: Zähler zeigt immer die Gesamtzahl der Aufgabe, unabhängig von Suche und Filtern; die Zahl rechts („84 von 300 Artikeln“) zeigt das gefilterte Ergebnis. Ein Reiter mit Zähler 0 bleibt sichtbar und grau.

### 5.3 Zeilen- und Sammelaktionen

Nur die vorhandenen Knöpfe, nichts Neues, was Daten ändert.

| Aktion | In der Zeile | Im Menü „⋯“ | Als Sammelaktion | Schnittstelle |
|---|---|---|---|---|
| Bei eBay bearbeiten | immer („eBay ↗“) | – | nein | Link |
| Bei eBay beenden | nur Reiter „Markiert“ | ja | nein | Link |
| Zum Auslisten vormerken / Vormerkung aufheben | Reiter „Auslisten“ | ja | ja | `api/article-delist/[id]` |
| Nachbestellen zurückstellen (30 / 90 / 180 Tage) | Reiter „Nachbestellen“ | ja | ja | `api/article-reorder/[id]` |
| Ausblenden / Einblenden | Reiter „Aufräumen“ | ja | ja | `api/article-hide/[id]` |
| Schwund erfassen | – | ja, öffnet den Drawer an der Gruppe „Schwund & Retouren“ | nein | `api/article-loss/[id]` |
| Set-Codes kopieren | – | – | ja | keine, nur Zwischenablage |

- Die Sammelleiste erscheint nur bei Auswahl, klebt am unteren Rand und zeigt „{n} ausgewählt“. Das Kästchen im Tabellenkopf wählt alle sichtbaren Zeilen.
- Sammelaktionen rufen die vorhandene Schnittstelle je Artikel nacheinander auf; es braucht keinen neuen Endpunkt. Welche Dauern das Zurückstellen heute anbietet, steht im Drawer; die Sammelaktion bietet dieselben an.
- Nach jeder Aktion verschwindet die Zeile nicht sofort. Sie wird blass mit „Vorgemerkt · Rückgängig“ und fällt erst beim nächsten Laden heraus. Sonst springt die Liste unter dem Mauszeiger weg.
- „Set-Codes kopieren“ legt je Zeile „Set-Code, Name, fehlende Stückzahl“ in die Zwischenablage. Das ist der Einkaufszettel für den Reiter „Nachbestellen“. Reine Anzeige, ändert nichts.
- Ob der Vormerken-Knopf in der Zeile stehen darf, ist bei Chris seit `TODO.md` Abschnitt D offen (Entscheidung E3).

### 5.4 Filterleiste

Eine Zeile, vier Menüs, darunter die aktiven Filter als Chips. „Weitere Filter“ als Aufklapp-Bereich entfällt.

| Element | Inhalt | Bemerkung |
|---|---|---|
| Chip-Zeile „Urteil“ | zu günstig · im Rahmen · zu teuer · ohne Urteil, je mit Zahl | Mehrfachwahl. Zahlen gelten für den aktiven Reiter |
| Menü „Bestand“ | ausverkauft · 1 Stk · 2–3 Stk · 4–9 Stk · 10+ Stk | |
| Menü „Karte“ | Ordner (Auswahlfeld) · Kartenart (Auswahlfeld) | |
| Menü „Klasse“ | Champion · Solide · Beobachten · Fällt ab · Ladenhüter · Streichkandidat; darunter getrennt: EK über Markt · Markt fällt, Bestand liegt · ausverkauft, lief gut · VK unter Kosten | „Streichkandidat“ statt Klasse „Auslisten“, siehe 6.2. „VK unter Kosten“ ersetzt die Gruppe „Eigener EK“ |
| Menü „Anzeigen“ | ☑ auch ohne Bestand · ☐ auch ausgelaufene · ☐ Ausgeblendete ({n}) | Schalter, keine Filter. „auch ohne Bestand“ ist an: Bestand 0 wird nicht standardmäßig ausgeblendet |
| Zeile „Aktiv“ | je aktivem Filter ein Chip mit „×“, am Ende „Alle zurücksetzen“ | Nur sichtbar, wenn etwas aktiv ist. Ein Menü mit aktivem Filter zeigt einen Punkt am Namen |

Am Handy werden die vier Menüs ein Knopf „Filter ({n})“, der ein Blatt von unten öffnet. Die Reiter sind dort eine waagerecht wischbare Zeile, der aktive Reiter rollt ins Bild.

### 5.5 Ansicht „Alle Spalten“

Bleibt als Zweitansicht für Auswertungen und für den Blick über alle Kennzahlen. Zwei Änderungen: Der Artikelname ohne den Vorsatz „Yu-Gi-Oh!“ (heute frisst er die halbe Spalte, „Yu-Gi-Oh! INFO-DE060 Flammen…“), und die Spalte „Preis-Korridor“ heißt „VK gegen eigene Kosten“. Sonst nicht anfassen; die Spaltenwahl aus `UX_VORSCHLAEGE.md` 4.5 bleibt offen.

### 5.6 Handy

Die Kompakt-Ansicht am Handy habe ich in dieser Runde nicht eigens betrachtet (nur Filter und „Alle Spalten“); die Seite war 42.800 px lang. Der Vorschlag der dreizeiligen Karte aus `UX_VORSCHLAEGE.md` Nr. 14 gilt weiter. Ergänzung: die dritte Zeile der Karte richtet sich nach dem Reiter (Nachbestellen: „Fehlt 10 · Reichweite 0,5 Mon“; Auslisten: „Preis senken · 125 € gebunden · 412 T“).

## 6. Farben, Ampeln, Begriffe

### 6.1 Farbregeln

Eine Regel vorweg: **Farbe gibt es nur für ein Urteil.** Eine Zahl, die nur etwas mitteilt (Umsatz, Marge, Marktwert, Bestand), ist in Textfarbe. Jede farbige Angabe hat zusätzlich ein Wort oder Zeichen, weil Rot und Grün für manche Augen gleich aussehen.

| Farbe | Token in `app/globals.css` | Bedeutung überall | Gilt für | Schwelle (aus dem Code übernommen, nichts Neues) |
|---|---|---|---|---|
| **Rot** | `--crit` | Geld geht verloren oder liegt fest | Verlust je Verkauf; Ladenhüter; Maßnahme „Auslisten“; „ausverkauft“; EK über Markt; Leitplanke gerissen; Daten älter als 3 Tage | DB II unter 0 mit bekanntem EK · 0 Verkäufe in 365 T · 365 T ohne Verkauf am Mindestpreis · Bestand 0 bei Verkaufstempo · Quote über 115 % vom Ziel |
| **Gelb** | `--warn` | Handeln, noch kein Schaden | „zu günstig“ und „zu teuer“; „NACHBESTELLEN“; Maßnahmen „Preis senken“ und „Auslaufen lassen“; Klasse „Fällt ab“; „EK fehlt“; „ohne Urteil“ als Aufgabe; Quote knapp über Ziel; Daten älter als 24 Std | VK außerhalb der Zielspanne (25–33 % Marge, mindestens 4,99 €, mit der vorhandenen Toleranz) · Mindestbestand erreicht oder Reichweite unter 1,5 Monaten · 180 T ohne Verkauf · Quote bis 115 % vom Ziel |
| **Grün** | `--good` | In Ordnung, nichts zu tun | „im Rahmen“; Klassen „Champion“, „Solide“; Quote im Ziel; Aufgaben-Zähler 0 | VK in der Zielspanne · Quote ≤ Ziel |
| **Blau** | `--market` | Herkunft Cardmarket, kein Urteil | Marktwert-Raute im Balken „Empfohlen“; Cardmarket-Links; Gruppe „Markt“ im Drawer | – |
| **Gold** | `--accent` | Bedienung: ausgewählt, aktiv | aktiver Menüpunkt, aktiver Reiter, aktiver Chip, Fokusrahmen, Sortierpfeil | – |
| **Grau** | `--muted`, `--faint` | keine Aussage möglich oder nur Angabe | „ohne Urteil“ in der Liste; Klasse „Beobachten“; Zähler 0; fehlende Werte „–“ | – |

Was sich damit konkret ändert:

| Stelle | Heute | Neu |
|---|---|---|
| „zu teuer“ (`PreisBoard.tsx` Zeile 22, `SortimentPage.tsx` Zeile 48, Kachel im Sortiment, `DistributionCard`) | blau | gelb mit Pfeil „↓“. „zu günstig“ bleibt gelb mit Pfeil „↑“. Die Richtung trägt der Pfeil und das Wort, nicht die Farbe (Entscheidung E2) |
| „zu günstig“ auf Leitplanken (`MarketHintsCard`, `DistributionCard`) | rot | gelb, wie im Sortiment |
| „Margen-Champions“, „Läuft“ auf Leitplanken | gelbe Balken | entfällt mit den Seiten; im Dashboard ohne Balken |
| „Marge“ in der Kompakt-Liste | grün ab einem Wert, rot darunter | Textfarbe; rot nur unter 0 % |
| Umsatz- und Balkenfarben auf Finanzen (`BridgeCard`, `TempoCard`) | Gold für Umsatz, Rot für Kosten, Blau für Wareneinsatz, Grün für DB II | Als Diagrammfarben belassen, aber Blau für „Wareneinsatz“ gegen einen neutralen Ton tauschen, damit Blau Cardmarket bleibt |
| „Totes Kapital“-Kachel | roter Rahmen, rote Zahl, immer | entfällt als Kachel; in „Muss weg“ ist nur der Punkt in der Überschrift rot |
| „Letzter Verkauf“ (grün „vor 7 Tagen“, rot „vor 516 Tagen“) | grün / rot | grau bis 180 T, gelb ab 180 T, rot ab 365 T. Das sind die Schwellen der Maßnahmen |
| Alter des EK im Feld „Ø EK“ (grün bis 30 T, gelb bis 90, rot älter) | drei Farben | grau; „EK vor 48 T“ ist eine Angabe |

Ein Punkt (●) vor einem Wort ist immer ein Urteil in der Farbe des Punkts. Ein Rahmen um eine Kachel ist nie farbig, außer die Kachel ist ein aktiver Filter (Gold).

### 6.2 Begriffe

Ein Wort je Sache. Die Kurztexte sind für Hover und für das „?“ aus `UX_VORSCHLAEGE.md` Nr. 10, am besten an einer Stelle gesammelt (`lib/glossar.ts`).

| Begriff (so schreiben) | Ersetzt | Kurztext |
|---|---|---|
| **Dein VK** | Akt. VK, Eigener VK, Listen-VK | „Dein aktueller Preis bei eBay.“ |
| **Empfohlen** | Empfohlener VK, Empf. VK 25–33 %, Zielspanne, Ziel | „Preis, bei dem 25 bis 33 % Marge bleiben, wenn du die Karte zum Marktwert nachkaufst. Mindestens 4,99 €.“ |
| **Urteil** | Ampel, VK vs. Markt, Preis-Hinweis | „Dein VK gegen Empfohlen: zu günstig, im Rahmen, zu teuer.“ |
| **zu günstig** | – | „Dein VK liegt unter Empfohlen.“ |
| **im Rahmen** | im Korridor | „Dein VK liegt in der empfohlenen Spanne.“ |
| **zu teuer** | – | „Dein VK liegt über Empfohlen.“ |
| **ohne Urteil** | – | „Kein Marktwert oder Seltenheit nicht eindeutig.“ |
| **Marktwert** | Markt, CM-Wert | „Cardmarket: Mittel aus Trend und den Schnitten 1, 7, 30 Tage. ‚ab‘ zählt doppelt. Nach Zustand: EX 85 %, GD 70 %, LP 60 %, PL 45 %, Poor 30 %.“ (Den ersten Satz vor der Umsetzung mit der Rechnung in `lib/pricing/marketPrice.ts` abgleichen; ich habe ihn aus dem Fußtext auf Leitplanken und den Projektregeln zusammengesetzt.) |
| **Marge** | Marge bei Nachkauf, Marge Nachkauf, Marktmarge | „Was bei deinem VK bleibt, wenn du zum Marktwert nachkaufst.“ |
| **Marge (verkauft)** | Ø Marge DB II, DB II % | „Was bei den echten Verkäufen blieb: nach EK, Versand, eBay-Gebühr.“ |
| **Ergebnis** | DB III | „Marge (verkauft) minus Fixkostenanteil.“ |
| **VK unter Kosten** | Eigener EK: zu günstig; Preis-Korridor rot; Preis-Ampel „zu günstig“ | „Dein VK deckt deinen eigenen EK plus Kosten nicht mit 25 %.“ |
| **Klasse** | – | „Wie sich der Artikel verkauft: Champion, Solide, Beobachten, Fällt ab, Ladenhüter, Streichkandidat.“ |
| **Streichkandidat** | Klasse „Auslisten“ | „Verkauft sich kaum und bringt nichts ein.“ (genaue Regel aus `lib/pricing/classification.ts` übernehmen) |
| **Ladenhüter** | Totes Kapital | „Kein Verkauf in 365 Tagen, obwohl Bestand oder Historie da ist.“ |
| **Gebunden** | Totes Kapital, Kapitalbindung, gebundenes Kapital | „Bestand × EK. Artikel ohne EK fehlen in der Summe.“ |
| **Maßnahme** | Sortiment-Status, Lifecycle | „Preis senken (180 Tage ohne Verkauf), Auslaufen lassen (am Mindestpreis, 180 Tage), Auslisten (am Mindestpreis, 365 Tage).“ |
| **Auslisten** | – | Nur noch für die Maßnahme und den Reiter. „Angebot bei eBay beenden.“ |
| **Vorgemerkt** | Zum Auslisten markiert, Markiert | „Von dir zum Auslisten vorgemerkt. Beendet wird bei eBay.“ Der Reiter darf weiter „Markiert“ heißen, wenn Chris das Wort gewohnt ist |
| **Nachbestellen** | Nachkaufen, Nachkauf-Kandidaten, Nachbestellen fällig | „Mindestbestand erreicht, ausverkauft mit Verkaufstempo, oder Reichweite unter 1,5 Monaten.“ |
| **Reichweite** | – | „Bestand geteilt durch Verkäufe je Monat.“ |
| **Verkäufe** | Velocity 30·90·365 | „Stück in 365 Tagen · davon in 90 Tagen.“ |
| **EK fehlt** | kein EK, EK pflegen | „Kein Einkaufspreis hinterlegt. Marge und Klasse sind dann nicht belastbar.“ |
| **Finanzen** | Leitplanken, Cockpit | Seitenname |

Schreibweisen: Geld als „12,99 €“ (Betrag, Leerzeichen, Zeichen), nie „€ 12,99“ und nie „17.06 €“ mit Punkt (beides kommt heute im Dashboard und in den Empfehlungstexten vor). Zeiträume als „30 T“, „90 T“, „365 T“. Umlaute ausschreiben („Stärkster“, nicht „Staerkster“), Gedankenstrich-Ersatz „--“ aus den Texten in `lib/dashboard/viewModel.ts` entfernen.

## 7. Aufgabenliste

Sortiert nach Nutzen geteilt durch Aufwand. S = bis etwa zwei Stunden, M = halber bis ganzer Tag, L = mehrere Tage. Reihenfolge innerhalb gleicher Stufe ist die empfohlene.

| Nr | Aufgabe | Aufwand | Nutzen | Dateien |
|---|---|---|---|---|
| 1 | Dashboard entrümpeln: Sortiment-Vorschau, „Cardmarket-Check“ und „Das lohnt sich anzusehen“ entfernen; „Betriebs-Quoten“ nach Finanzen | S | hoch | `components/dashboard/DashboardShell.tsx`, `components/cockpit/CockpitPage.tsx`, `components/dashboard/OperatingQuotas.tsx` |
| 2 | Jede Artikelzeile außerhalb des Sortiments anklickbar (öffnet den Drawer über `/sortiment?artikel=<id>`); fehlende Adress-Parameter für Klasse, Urteil, Sortierung ergänzen | S–M | hoch | `components/dashboard/MoversPanels.tsx`, `components/sortiment/SortimentPage.tsx`, `components/cockpit/MoversCard.tsx` |
| 3 | „zu teuer“ gelb statt blau, „zu günstig“ überall gelb, Pfeile ↑ ↓ dazu; „Marge“ in der Liste neutral, rot nur unter 0 | S | hoch | `components/sortiment/PreisBoard.tsx`, `components/sortiment/SortimentPage.tsx`, `components/cockpit/MarketHintsCard.tsx`, `components/cockpit/DistributionCard.tsx`, `app/globals.css` |
| 4 | Zielpreis in der Liste auf ,99 runden („↓ auf 14,99 €“), mit derselben Funktion wie im Drawer | S | hoch | `components/sortiment/PreisBoard.tsx` (Zeile 107), `components/sortiment/ArtikelDetail.tsx` (Quelle der Rundung) |
| 5 | „Läuft schlecht“ nach verlorenen Euro in 90 T sortieren statt nach Prozent über die Lebenszeit; nur Artikel mit bekanntem EK; Balken und Fußsatz weg | S | hoch | `lib/dashboard/viewModel.ts` (moversBad), `components/dashboard/MoversPanels.tsx` |
| 6 | Filtergruppe „Eigener EK“ umbenennen: ein Chip „VK unter Kosten“; „im Korridor“ überall „im Rahmen“; Klasse „Auslisten“ in der Anzeige „Streichkandidat“ | S | hoch | `components/sortiment/SortimentPage.tsx`, `lib/pricing/classification.ts` (nur Beschriftung), `lib/dashboard/marketFilter.ts`, `components/cockpit/DistributionCard.tsx` |
| 7 | Ladenhüter-Geld klären (323 € gegen 1.147 €) und überall dieselbe Zahl „zum EK gebunden“ zeigen | S | hoch | `lib/dashboard/viewModel.ts`, `components/empfehlungen/EmpfehlungenPage.tsx`, `components/dashboard/KpiRow.tsx`, `lib/dashboard/topFlop.ts` |
| 8 | Vier Urteilskacheln im Sortiment zur Chip-Zeile „Urteil“ machen | S | mittel | `components/sortiment/SortimentPage.tsx`, `app/globals.css` |
| 9 | Zeile „Heute“ verfeinern: Reihenfolge wie Reiter, Zähler 0 grau mit „✓“, kein Rot, von der Fensterwahl absetzen, Unterzeile „davon {n} ausverkauft“ | S | mittel | `components/dashboard/DashboardShell.tsx`, `lib/dashboard/tasks.ts`, `app/globals.css` |
| 10 | Stand-Zeile in der Seitenleiste („Billbee vor 2 Std · Cardmarket 14.11.“, gelb ab 24 Std, rot ab 3 Tagen); Fußzeile „Live …“ entfernen | S | mittel | `components/dashboard/Sidebar.tsx`, `components/dashboard/UpdateButton.tsx`, `components/shell/AppShell.tsx` |
| 11 | Schreibweisen: „12,99 €“ überall, Vorsatz „Yu-Gi-Oh!“ aus Namen in Dashboard und „Alle Spalten“, Umlaute und „--“ in den Texten | S | mittel | `lib/format.ts`, `components/cockpit/format.ts`, `lib/dashboard/viewModel.ts`, `components/dashboard/KpiRow.tsx`, `components/dashboard/MoversPanels.tsx` |
| 12 | Menüpunkt und Überschrift „Finanzen“ (nach Entscheidung E1) | S | mittel | `components/dashboard/Sidebar.tsx`, `components/cockpit/CockpitPage.tsx` |
| 13 | Umleitungen `/top-flop` → `/`, `/marktpreise` → `/sortiment?aufgabe=preis`, `/empfehlungen` → `/sortiment?aufgabe=daten` (letzte erst nach Aufgabe 15) | S | mittel | `app/top-flop/page.tsx`, `app/marktpreise/page.tsx`, `app/empfehlungen/page.tsx` |
| 14 | Dashboard neu: Kennzahlen-Zeile mit „Ergebnis“ und Vergleich zum Vorfenster; drei Blöcke „Läuft gut“, „Läuft schlecht“, „Muss weg“ nach Abschnitt 4 | M | hoch | `components/dashboard/DashboardShell.tsx`, `components/dashboard/KpiRow.tsx`, `components/dashboard/MoversPanels.tsx`, `lib/dashboard/viewModel.ts`, `lib/dashboard/queries.ts`, `app/globals.css` |
| 15 | Reiter „Daten prüfen“ (EK fehlt mit Verkauf in 90 T; Verlust trotz Verkäufen), mit Zähler in „Heute“ | M | hoch | `lib/dashboard/tasks.ts`, `lib/dashboard/tasks.test.ts`, `components/sortiment/SortimentPage.tsx`, `components/sortiment/PreisBoard.tsx` |
| 16 | Spaltensatz und Sortierung je Reiter nach 5.2 | M | hoch | `components/sortiment/PreisBoard.tsx`, `components/sortiment/SortimentPage.tsx`, `lib/dashboard/board.ts`, `app/globals.css` |
| 17 | Zeilenaktionen („eBay ↗“, Knopf je Reiter, Menü „⋯“) und Sammelaktionen mit Kästchen, Sammelleiste unten, „Set-Codes kopieren“ | M | hoch | `components/sortiment/PreisBoard.tsx`, `components/sortiment/SortimentPage.tsx`, `components/sortiment/ArtikelDetail.tsx` (vorhandene Aufrufe wiederverwenden), `app/globals.css` |
| 18 | Filterleiste nach 5.4: vier Menüs, Zeile „Aktiv“ mit „Alle zurücksetzen“, „Weitere Filter“ entfällt; Überblick und Kapitalbindung in den Reiter „Auswertung“ | M | mittel | `components/sortiment/SortimentPage.tsx`, `components/sortiment/PreisUeberblick.tsx`, `components/sortiment/KapitalPanel.tsx`, `app/globals.css` |
| 19 | Finanzen kürzen: `MarketHintsCard`, `MoversCard` und die Preis-Ampel-Hälfte von `DistributionCard` entfernen; Klassen in „Sortimentsgesundheit“ verlinken; Blau im Tempo-Diagramm tauschen | S–M | mittel | `components/cockpit/CockpitPage.tsx`, `components/cockpit/DistributionCard.tsx`, `components/cockpit/TempoCard.tsx`, `app/cockpit/cockpit.css` |
| 20 | Einstellungen: Datenstand und Billbee nach oben, Vergleichstabellen einklappen, am Handy einspaltig ohne Überlauf (heute 878 px breit) | M | mittel | `components/einstellungen/EinstellungenPage.tsx`, `app/globals.css` |
| 21 | Aufräumen nach einer Woche ohne Rückfrage: Komponenten der drei umgeleiteten Seiten und ihre nur dort genutzten Rechnungen löschen | S | gering | `components/topflop/*`, `components/marktpreise/*`, `components/empfehlungen/*`, `components/dashboard/Recommendations.tsx`, `components/dashboard/CardmarketPlaceholder.tsx`, `components/dashboard/SortimentTable.tsx`, `lib/dashboard/topFlop.ts`, `lib/dashboard/marketComparison.ts` (vorher prüfen, wer sie sonst noch nutzt) |
| 22 | Handy: Dashboard nach 4.2 (Blöcke zuklappbar, „Muss weg“ zuerst), Reiter wischbar, Filter als Blatt, dritte Kartenzeile je Reiter | M | mittel | `app/globals.css`, `components/dashboard/DashboardShell.tsx`, `components/sortiment/SortimentPage.tsx`, `components/sortiment/PreisBoard.tsx` |

Die Aufgaben 1 bis 13 sind zusammen etwa ein bis zwei Tage und ändern keine Rechnung außer der Sortierung in Aufgabe 5. Aufgabe 7 kann eine Rechnung berühren; dort erst klären, dann ändern.

## 8. Entscheidungen für Chris und was ich nicht angefasst habe

### 8.1 Entscheidungen für Chris

| Nr | Frage | Mein Vorschlag | Wenn nein |
|---|---|---|---|
| E1 | Darf „Leitplanken“ in „Finanzen“ umbenannt werden? | Ja. Die Seite zeigt Marge, Ergebnis, Tempo und Kapital; die eigentlichen Leitplanken sind eine von sieben Karten | Name bleibt, Inhalt wird trotzdem gekürzt (Aufgabe 19) |
| E2 | „zu teuer“ gelb statt blau? | Ja. Beides ist „Preis ändern“, die Richtung zeigt der Pfeil. Blau bleibt Cardmarket | Blau bleibt für „zu teuer“; dann bekommt die Marktwert-Raute eine andere Farbe, sonst heißt Blau zweierlei |
| E3 | Vormerken-Knopf in der Listenzeile und als Sammelaktion? (seit `TODO.md` offen) | Ja, nur im Reiter „Auslisten“, mit „Rückgängig“ | Nur im Menü „⋯“ und im Drawer |
| E4 | Die Aufgaben-Zähler sind groß (87 nachbestellen, 84 Preise). Soll „Heute“ die volle Zahl zeigen oder nur den dringenden Teil? | Volle Zahl, darunter klein der dringende Teil („davon 12 ausverkauft“). Die Obergrenze von etwa 50 Auslisten-Kandidaten aus `TODO.md` bleibt eine eigene Frage | Nur die volle Zahl |
| E5 | Top/Flop, Empfehlungen und Marktpreise als eigene Seiten streichen (umleiten, später löschen)? | Ja, Begründung in 2.2. Nichts geht verloren außer dem Preisverlauf-Kasten oben auf Marktpreise; der steht im Drawer in der Gruppe „Markt“ | Seiten bleiben per Adresse erreichbar; dann wenigstens Farben und Begriffe angleichen (Aufgaben 3 und 6) |
| E6 | „Betriebszahlen je Jahr“ von Einstellungen nach Finanzen? | Ja, als eingeklappte Karte am Ende. Es sind Ergebnisse, keine Einstellungen | Bleibt in Einstellungen, eingeklappt |
| E7 | Soll „Daten prüfen“ ein eigener Reiter sein, oder gehört „EK fehlt“ zu „Aufräumen“? | Eigener Reiter. „Aufräumen“ ist Ordnung zwischen eBay und Billbee, „Daten prüfen“ ist fehlender oder falscher EK; in der Demo sind das 5 gegen über 100 Artikel | Ein Reiter „Aufräumen“ mit Spalte „Grund“ |
| E8 | Darf die Liste einen einzelnen Zielpreis auf ,99 zeigen („↓ auf 14,99 €“)? | Ja, der Drawer tut es schon. Das ist eine Anzeige in LEC, kein eBay-Preisvorschlag | Nur die Spanne zeigen, ohne „auf …“ |

### 8.2 Nicht angefasst, weil riskant

- **Keine Rechnung geändert.** Zielspanne, Marktwert, Zustandsfaktoren, „ab“ zählt doppelt, Klassen, Maßnahmen, Nachbestell-Regel und alle Schwellen bleiben, wie sie sind. Abschnitt 6.1 ordnet vorhandenen Schwellen nur Farben zu. Einzige Ausnahmen: die Sortierung von „Läuft schlecht“ (Aufgabe 5) und die Klärung in Aufgabe 7.
- **Keine neuen Eingaben.** Kein Preisfeld, kein „Preis übernehmen“, kein Beenden aus LEC heraus, keine Preisvorschläge oder Best-Offer. Alle Zeilen- und Sammelaktionen sind die vorhandenen Knöpfe; „Set-Codes kopieren“ schreibt nur in die Zwischenablage.
- **Drawer.** Gerade nach `DRAWER_AUFRAEUMEN.md` umgebaut und in dieser Runde nicht angesehen. Die Begriffe aus 6.2 sollten dort gelten; ob sie es schon tun, habe ich nicht geprüft.
- **Pokémon** bleibt ausgeblendet; kein Entwurf zeigt es. **Bestand 0** bleibt standardmäßig sichtbar (Schalter „auch ohne Bestand“ ist an).
- **Löschen der Nebenseiten.** Vorgeschlagen sind zuerst Umleitungen. Das Löschen (Aufgabe 21) kann gemeinsam genutzte Rechnungen treffen, etwa `lib/cockpit/marketHints.ts`, das die Zahl „liegen gelassen“ für den Block „Läuft schlecht“ liefert. Vor jedem Löschen die Verwendungen suchen.
- **„Alle Spalten“.** Nur zwei Beschriftungen. Die Spaltenwahl und die 25 Spalten selbst nicht, weil gespeicherte Spaltenbreiten daran hängen (`components/table/useColumnWidths.ts`).
- **Einstellungen-Felder.** Nur Reihenfolge und Einklappen. Die Kostensätze speisen jede Marge; an Beschriftungen und Feldern dort nichts ändern, ohne dass Chris sie gegenliest.
- **Heller Modus.** `layout.tsx` setzt das dunkle Thema fest. Die Farbregeln nutzen die vorhandenen Tokens und gelten damit in beiden; den hellen Modus habe ich nicht gesehen.
- **Unsicher, weil nur an Demo-Daten gesehen:** alle Zählerstände, die Seitenhöhen und die Aussage, dass das neue Dashboard bei 1440 px auf einen Bildschirm passt. Mit echten Artikelnamen (länger, mit Zusätzen wie „1st“, „NM“) können Zeilen umbrechen; nach Aufgabe 14 mit dem echten Bestand prüfen.
- **Nicht gesehen:** der Aufgaben-Reiter und die Zeile „Heute“ am Bildschirm (nur im Code), die Kompakt-Liste am Handy, `/login`. Die Hydration-Meldung „1 Issue“ auf `/sortiment` aus `UX_VORSCHLAEGE.md` besteht weiter.

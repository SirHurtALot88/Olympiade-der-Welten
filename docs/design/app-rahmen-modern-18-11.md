# App-Rahmen modern (Fable, 18.11.) — Mockup und Erklärung

Anlass, Chris am 18.11. zum Startseiten-Mockup: „auch das drumherum ist deutlich besser gestaltet! bitte daraus
auch eine aufgabe ableiten das ganze framing umzubauen, da sind wir noch super statisch und schwach … jetzt
fängt das spiel an immer mehr auszusehen wie ein game und keine exceltabelle“.

Dies ist ein Entwurf. `app/`, `components/` und der Motor sind nicht angefasst. 0 PixelLab-Generationen,
alles CSS/SVG plus vorhandene Bilder (Wappen, Portraits, Figuren, Kulisse Bierzelt).

## Ansehen

| Was | Datei |
|---|---|
| Rahmen, klickbar | `public/mockups/app-rahmen-modern-18-11.html` |
| Bilder | `docs/design/app-rahmen-modern-18-11/` |

Läuft per Doppelklick ohne Server, über den Dev-Server unter `/mockups/app-rahmen-modern-18-11.html`. Die graue
Leiste oben gehört nicht zum UI; sie schaltet Seite, Status und Schiene. Dasselbe per Adresse:
`?seite=start|einsatz|saison|arena|teams`, `?status=bereit|laeuft|weiter`, `?nav=auf|pin`,
`?zeige=meldung|suche|ablauf|inbox|office`, `?rahmen=1` (Arena mit Schiene), `?still=1` (ohne graue Leiste).

Ein Durchlauf zum Klicken: Start → Knopf „Weiter: Einsatzliste“ → Abgabe ist gesperrt (1 Platz offen) → Lulu
anklicken → „Einsatzliste abgeben“ (Aktion läuft, Fortschritt im Knopf) → „Spieltag 13 starten“ → Arena im
Vollbild → „Zum Ergebnis“. Suche mit ⌘K oder `/`, Arena verlassen mit Esc, Schiene in der Arena mit R.

| Bild | Zustand |
|---|---|
| `01`–`03-start-*` | Startseite bei 2560×1440, 1920×1080, 1710×1112 |
| `04`–`06-einsatzliste-*` | Einsatzliste, drei Bildschirme |
| `07`–`09-saisonstand-*` | Saisonstand, drei Bildschirme |
| `10`–`12-arena-vollbild-*` | Arena ohne Rahmen, drei Bildschirme |
| `13-schiene-hover`, `14-schiene-angeheftet` | Schiene ausgeklappt (Überlagerung) und angeheftet (Inhalt rückt) |
| `15-status-bereit-gesperrt`, `16-status-aktion-laeuft`, `17-status-spieltag-bereit-ablauf` | die drei Zustände des Taktgebers, im letzten mit aufgeklapptem Ablauf |
| `18-meldungen`, `19-inbox`, `20-suche`, `21-office-blatt` | Meldungen unten rechts, Inbox-Aufklapper, Suche, Office als Blatt |
| `22-arena-mit-schiene`, `23-ladezustand`, `24-mit-mockup-leiste` | Arena mit Schiene, Ladezustand einer Seite, Ansicht mit grauer Leiste |
| `abgleich-*-ist-mockup.png` | links Ist (Branches `app-volle-breite-18-11`, `arena-vollbild-18-11`), rechts Mockup |

Geprüft bei allen drei Zielbildschirmen: die Seite scrollt nicht, keine Tafel und kein Teil des Bands läuft über
(Messung über `scrollWidth/-Height` je Tafel). Phone ist nicht Teil dieses Entwurfs; die Schiene als Leiste unten
steht schon im Startseiten-Mockup.

**Echt:** Teamnamen, Wappen, Spieler, Portraits, Klassen, Figuren, Kulisse, die Wettessen-Rollen (Capacity, Pace
Control, Iron Stomach, Table Focus aus `matchday-slot-roles.ts`), die Navigationspunkte. **Erfunden:** jede
Zahl, alle Meldungen, die Attributgewichte der Rollenkarte, der Arena-Stand. Die Tafeln der Startseite sind
unverändert die aus `oly-start-modern-18-11.html` (Branch `claude/oly-start-mockup-18-11`).

## 1. Was sich gegenüber heute ändert

Heute (Stand Branch `app-volle-breite-18-11`): Schiene 64 px, darüber eine Rahmenzeile (Brotkrume, Unterreiter,
Statuschip „Bereit / Alle Aktionen abgeschlossen“, „Office öffnen“, „Weiter“, „Suchen“), darunter ein gerahmter
Kasten, in dem jede Seite ihren eigenen Kopf (`BcHero`), teils eine eigene Reiterzeile und teils eine eigene
Fußleiste mit ihrer Hauptaktion zeichnet.

| Teil | Heute | Im Entwurf | Warum |
|---|---|---|---|
| Kopf | Rahmenzeile + Seitenkopf + ggf. Reiterzeile, drei Bänder | **ein Regieband** (72 px bei 1920): Ort, Unterreiter, Seiten-Slot, Saison, Kasse, Suche, Meldungen, Weiter | 100 bis 147 px mehr Höhe je Seite, jede Angabe steht nur einmal |
| Seitenkopf | jede Seite baut `BcHero` selbst | Seite hängt Titel, Unterreiter und einen **Slot** ins Band (Start: Rang/Punkte/Ergebnisse/Form; Einsatzliste: D1/D2 mit Füllstand; Saisonstand: Liga-Reiter) | gleiche Stelle, gleiche Form auf allen Seiten |
| Status + Weiter | Chip „Bereit“ mit ✕ und daneben ein blauer Knopf | **Taktgeber**: ein goldener Knopf, darunter eine Statuszeile; drei Zustände (unten) | der Chip sagt fast immer „Bereit“ und kostet 240 px Breite; der Knopf ist die Aussage |
| Hauptaktion der Seite | Einsatzliste hat unten eine eigene Leiste „Abgabe gesperrt“ (ca. 80 px), Start einen eigenen Knopf im Kopf | es gibt **eine** Hauptaktion, immer oben rechts; die Seite bestimmt Text und Sperre | Fußleiste fällt weg, der Blick muss nicht suchen |
| Saison, Spieltag | kleines „S1 MD1“ über der Schiene | Chip im Band mit 20 Strichen (gespielt grün/gelb/rot, heute gold), Klick öffnet den Spielplan | zeigt die Saison als Strecke statt als Kürzel |
| Aktives Team, Kasse | Team nur auf der Seite, Kasse nur auf Start/Finanzen | Wappen oben in der Schiene (ausgeklappt mit Name, Rang, Teamwechsel), Kasse als Chip im Band | beides auf jeder Seite sichtbar |
| Brotkrume | „Spieltag › Home“ in der Rahmenzeile | goldene Kopfzeile über dem Seitentitel; auf Seiten mit Spielbezug steht dort der Zusammenhang („Spieltag 13 › Heimspiel gegen Pirate Crew“) | sagt, worum es geht, nicht nur wo man ist |
| Office | Knopf „Office öffnen“ bzw. Unterreiter auf Home | Punkt unten in der Schiene, öffnet ein **Blatt** von rechts über der aktuellen Seite | man verliert den Bildschirm nicht, an dem man arbeitet |
| Fehler-Flagge | schwebt oben rechts über dem Inhalt | unten in der Schiene | überdeckt nichts mehr |
| Schiene | kompakt, Hover klappt aus, anheftbar (gebaut, #1576) | bleibt; neu: Marke gleitet zum aktiven Punkt, aktiver Punkt gold statt blau | Bewegung zeigt den Wechsel, eine Akzentfarbe |
| Meldungen | Inbox-Seite, Zähler an der Schiene | Bauchbinde unten rechts (6 s, klickbar), Glocke im Band mit Aufklapper, Zähler bleibt; in der Arena warten Meldungen (Punkt am Griff) | Neues fällt auf, ohne die Seite zu wechseln |
| Seitenwechsel | Inhalt blendet ein | Titel und Slot rutschen ein, Tafeln steigen gestaffelt auf (0,34 s); nur beim Wechsel in die Arena ein Sendewisch (0,7 s) mit Disziplinname | normaler Wechsel bleibt schnell, der Spieltag bekommt einen Auftritt |
| Laden | „HOME WIRD GELADEN…“ in leerem Kasten | Band steht sofort (Titel, Reiter), darunter Tafel-Umrisse mit Schimmer | kein Springen des Kopfs |
| Arena | Rahmenzeile, Reiterzeile, Steuerzeile, Spielstandsleiste über dem Feld; Feld 38 % der Fläche | Band fährt hoch, Schiene fährt raus, **Feld = ganzes Fenster**; Spielstand, Steuerung und Verlauf liegen als HUD darüber; links bleibt ein 15 px breiter Griff | „die braucht jeden cm“ |
| Akzentfarbe | Rahmen blau, Seiten gold | nur noch Gold/Creme (Tokens aus `oly-seiten-modern-17-11.md`) | ein Guss |
| Größe | feste Pixel, auf 2560 wirkt alles klein | alles in rem, Wurzelgröße folgt dem Fenster (wie im Startseiten-Mockup) | füllt 32″ 4K, quetscht nichts am MacBook |

### Der Taktgeber

| Zustand | Knopf | Zeile darunter |
|---|---|---|
| Bereit | „Weiter: Einsatzliste“ führt zum nächsten Pflichtschritt. Auf der Einsatzliste selbst: „Einsatzliste abgeben“, oder grau „Abgabe gesperrt“ solange ein Platz offen ist (Klick lässt den offenen Platz blinken) | „Bereit · 1 Platz offen, Minuskarte offen ▾“ |
| Aktion läuft | füllt sich als Fortschritt, „Abgabe läuft 56 %“; dünne laufende Linie unter dem Band | „Aktion läuft · KI-Teams stellen auf 9 / 16 · du kannst weiterarbeiten“ |
| Spieltag bereit zum Weiter | „Spieltag 13 starten“, pulsiert mit Glanzlauf | „Bereit zum Weiter · alle Pflichtschritte erledigt ▾“ |

Ein Klick auf die Zeile klappt den **Ablauf** auf: die Schritte des Spieltags mit Haken, Rot (hält auf), Gelb
(hält nicht auf). Das ersetzt die Liste im heutigen Statuschip.

## 2. Platzgewinn

Gemessen an den Ist-Aufnahmen (1920×1080) und am Mockup. Der Ist-Rahmen hat feste Pixel, deshalb gelten seine
Werte für alle drei Bildschirme; das Mockup skaliert mit der Wurzelgröße (16 / 21,3 / 14,25 px).

| | Ist | Mockup 1920×1080 | Mockup 2560×1440 | Mockup 1710×1112 |
|---|---:|---:|---:|---:|
| Schiene | 64 | 64 | 85 | 57 |
| Kopf bis zur ersten Tafel, Einsatzliste | 185 | 85 | 113 | 76 |
| Kopf bis zur ersten Tafel, Saisonstand | 232 | 85 | 113 | 76 |
| Fußleiste Einsatzliste | 82 | 0 | 0 | 0 |
| Tafelhöhe Einsatzliste | 800 | 982 (+182) | 1310 (Ist 1160, +150) | 1024 (Ist 832, +192) |
| Tafelhöhe Saisonstand | 848, Tabelle scrollt ab Zeile 16 | 982 (+134), 16 Zeilen ohne Scrollen | 1310 | 1024 |
| Arena-Spielfeld | 1361 × 516 (2560: 1924 × 729, 38 % der Fläche laut `nachher-messung.json`) | 1920 × 1080 | 2560 × 1440 | 1710 × 1112 |

In der Breite ändert sich fast nichts (der Volle-Breite-Umbau hat das schon geholt); der Gewinn liegt in der
Höhe und in der Arena. Bei 2560 ist das Band in Pixeln höher als die heutige Rahmenzeile (96 statt 72), weil
dort alles mitwächst; es ersetzt aber Rahmenzeile plus Seitenkopf. Angeheftete Schiene kostet 176 px Breite
(bei 1920), das Band blendet dann Nebentexte aus.

## 3. Betroffene Komponenten

| Datei | Änderung |
|---|---|
| `app/foundation/shell/FoundationShell.tsx` | `<header>` wird das Regieband mit Plätzen `ort`, `reiter`, `slot`, `regie`; neuer Prop `headerSlot`; Klasse für Arena-Vollbild |
| `app/foundation/shell/FoundationSidebar.tsx`, `foundation-nav-icons.tsx` | Kopf mit Wappen/Teamwechsel, gleitende Marke, Office und Flagge unten, Goldakzent |
| `app/foundation/shell/FoundationSubNav.tsx` | Darstellung als Reiter am Bandboden |
| `app/foundation/shell/FoundationActivityStrip.tsx` | geht im Taktgeber auf (Fortschritt im Knopf, Liste im Ablauf-Aufklapper) |
| `app/foundation/FoundationShellRouterBody.tsx` | `headerActions` (Office öffnen, Weiter, Suchen) wandern in feste Plätze; Seiten melden Titel-Kontext, Slot und Hauptaktion |
| `components/foundation/FoundationRoomFlowBar.tsx`, `lib/foundation/resolve-game-flow-action-step.ts` | liefern die Schritte für Ablauf und Knopftext (Logik bleibt) |
| `lib/foundation/foundation-breadcrumb.ts` | zusätzlich Kontextzeile je Ansicht |
| `components/foundation/broadcast/` (`BcHero`, `BcHeroKulisse`, `BcSheet`, `broadcast.css`) | `BcHero` wird zum Band-Slot bzw. entfällt je Seite; `BcSheet` trägt das Office; Rahmen-Regeln in `broadcast.css` |
| `app/foundation/season-v2/SeasonStandingsModern.tsx`, `legacy-lineup-lab/EinsatzlisteModern.tsx`, `home-v2/HomeV2NewLook.tsx` | eigener Kopf und eigene Reiter-/Fußzeile raus, dafür Slot + Hauptaktion an den Rahmen |
| `components/feedback/BugReportFlag.tsx` | Auslöser in die Schiene |
| `lib/foundation/tabs/use-foundation-cross-tab-command-palette.ts` | Suche bleibt, bekommt nur das neue Aussehen |
| Arena (`matchdayArena`, Branch `arena-vollbild-18-11`) | Vollbild schaltet Band und Schiene ab, HUD-Lagen über dem Feld |
| `app/globals.css` | `foundation-view-enter` durch gestaffelten Einstieg ersetzen, blaue Rahmenfarben raus |

Wertung wird nirgends berührt, der Fingerabdruck muss gleich bleiben.

## 4. Bau-Reihenfolge (kleine PRs)

1. **Band-Gerüst.** `FoundationShell`: Kopfzeile als Regieband mit den vier Plätzen, Unterreiter am Bandboden,
   Goldakzent, Maße in rem mit Wurzelgröße am Shell-Container. Inhalt der Plätze noch wie heute. Seiten behalten
   ihren Kopf.
2. **Taktgeber.** Statuschip und Weiter-Knopf zu einem Baustein, drei Zustände, Ablauf-Aufklapper aus den
   vorhandenen Schritten. `FoundationActivityStrip` entfällt aus dem Kopf.
3. **Saison- und Kassen-Chip, Glocke, Suchknopf** im Band; „S1 MD1“ über der Schiene raus.
4. **Schiene:** Wappen-Kopf mit Teamwechsel, gleitende Marke, Office und Flagge nach unten.
5. **Seiten-Slot:** Schnittstelle (Titel-Kontext, Slot, Hauptaktion) und als erste Seite der Saisonstand
   (Kopf und Reiterzeile der Seite raus). Danach je ein PR: Einsatzliste (Fußleiste raus), Start (mit dem
   Startseiten-Bau), dann die übrigen Seiten.
6. **Meldungen:** Bauchbinden unten rechts aus den vorhandenen Inbox-Einträgen, Aufklapper an der Glocke.
7. **Office als Blatt** (`BcSheet`).
8. **Seitenwechsel und Ladezustand:** gestaffelter Einstieg, Tafel-Umrisse statt „wird geladen“.
9. **Arena-Vollbild:** Band und Schiene aus, Griff, HUD-Lagen, Sendewisch; baut auf `arena-vollbild-18-11` auf.

Jeder Schritt mit Abgleich Mockup | App bei 2560×1440, 1920×1080, 1710×1112.

## 5. Offene Entscheidungen für Chris

- **Eine Hauptaktion oben rechts**, auch für die Abgabe der Einsatzliste, und die Fußleiste dort fällt weg?
  Oder soll die Abgabe zusätzlich unten bleiben?
- **Office als Blatt über der Seite** statt eigener Seite/Unterreiter?
- **Arena:** Standard ganz ohne Schiene (nur Griff, R blendet sie ein) oder Schiene standardmäßig sichtbar?
- **Sendewisch** beim Wechsel in die Arena: gewünscht oder zu viel? (0,7 s, abschaltbar über „weniger Bewegung“)
- **Meldungen in der Arena:** warten lassen (Entwurf) oder klein einblenden?
- **Slot auf der Startseite:** Rang, Punkte, Ergebnisse, Form/Moral im Band und dafür kein eigener großer Kopf
  wie im Startseiten-Mockup (spart dort weitere 53 px), oder den großen Kopf nur auf der Startseite behalten?
- **Mitwachsende Schrift** auf 2560 für die ganze App, oder nur für neue Seiten?

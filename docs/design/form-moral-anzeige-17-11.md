> **STAND 18.11. (Bau):** Chris hat die drei Fragen unten entschieden (Zahl überall, Marke dreiteilig, Bauchbinde
> automatisch) und die Moral-Darstellung geändert: **nicht Herz, sondern Gesicht in Farbe von grün bis rot plus
> Zahl** (`BcMoralGesicht`, eigenes SVG). Das Mockup zeigt noch das Herz und bleibt als Vorlage stehen; die Mockup-
> Screenshots 01–17 liegen nur auf dem Branch `claude/form-moral-mockup-17-11`. Die gebaute Fassung steht in
> `docs/design/form-moral-bau-18-11.md`, ihre Screenshots als `app-*.png` in diesem Ordner.

# Form, Moral und Formkarten sichtbar machen — Mockup + Erklärung (17.11.)

Klickbares Mockup: `public/mockups/form-moral-modern-17-11.html` (eine Datei, kein Netz, kein App-Code).
Regelwerk dahinter: `docs/design/form-moral-17-11.md` (Branch `claude/form-moral-17-11`).
Stil: exakt der der Einsatzliste (`einsatzliste-modern-17-11.html`, `components/foundation/broadcast/`) — gleiche
Tokens, Barlow Condensed lokal, Hero-Kopf, Schräg-Reiter, Karten, Blätter auf dem Phone. Keine PixelLab-Grafik.

**Alle Zahlen im Mockup sind erfunden** (Form, Moral, Erschöpfung, Einsätze, Karten-Hand, Ergebnisse). Echt sind
Spieler, Porträts, Klassen, Wappen und die Rechenregeln: Form-Fortschreibung, Moralwirkung und die neue
Formkarten-Farbregel sind im Mockup nach dem Regelwerk nachgebaut, die Zahlen bewegen sich also so, wie sie es
im Spiel tun würden.

Ziel: Der Spieler soll ohne Handbuch zwei Fragen beantworten können — **warum ist dieser Spieler gerade gut
oder schlecht drauf**, und **welche Formkarte bringt wem wie viel**.

URL-Schalter: `?ansicht=liste|profil|nachher`, `&d=basketball|spurt`, `&karten=k1,k6`, `&spieler=Kati`,
`&warum=Kati`, `&tab=karten|form`, `&blatt=kader|kontext`, `&ein=0..4`, `&phone=1`, `&still=1`.

## Die drei Zeichen, überall gleich

| Zeichen | Bedeutung | Herkunft |
|---|---|---|
| Pfeil ▲▲ ▲ – ▼ ▼▼ (grün / grau / rot) | Form in fünf Stufen (heiß, gut drauf, normal, kalt, eiskalt) | Baustein `.form` der Einsatzliste, unverändert |
| Herz + Zahl (grün ab 60, rot unter 40) | Moral 0–100 | neu, gleiche Tokens (`--gut`, `--warn`, `--leise`) |
| Farbpunkt Rot/Grün/Blau/Gelb | Klassenfarbe = Power/Speed/Mental/Social | `FORM_HEX` aus `EinsatzlisteModern.tsx` |

Pfeil und Herz sind überall dieselbe Fläche zum Antippen: sie öffnet das **Warum**.

## Ansicht 1 — Einsatzliste: Form und Moral an jedem Spieler

Screenshots `01`, `02`, `06`, Phone `12`, `14`, `15`.

- **Platzkarte:** neben dem Platzwert stehen Form-Pfeil und Moral. Oben rechts im Rollenkopf der Farbpunkt der
  Klasse (wichtig für die Karten).
- **Kaderliste:** eigene Spalten Form, Moral und Karte. Die Spalte „Platz“ enthält Form, Moral und Erschöpfung
  schon — es gibt nur eine Zahl, keine zweite „eigentliche“.
- **Warum-Tooltip** (Hover am Desktop, Antippen am Phone als Blatt von unten): Form-Wert und Stufe mit
  Prozentwirkung, die **letzten drei Einsätze** als Zeile „Disziplin, Erwartung → Leistung“ mit Balken (Strich =
  Erwartung, Balken = Abstand), die **Erschöpfung** mit Bremse („keine Bremse, erst über 60“ oder „bremst −5“),
  die Moral mit ihren drei stärksten Ursachen, unten die Summe in Punkten auf diesem Platz.
- **Kontext-Reiter „Form & Moral“:** ohne Auswahl die Aufstellung auf einen Blick (Form, Moral, Erschöpfung in
  Punkten, je Spieler eine Zeile). Mit Auswahl derselbe Warum-Block, dazu der Sprung ins Profil.
- **Kopf rechts:** Team-Form als fünf Zähler und Moral-Schnitt.

Code: `EinsatzlisteModern.tsx` (Platzkarte, Kaderzeile, Kontextspalte), neuer kleiner Baustein „Form-Pfeil +
Moral-Marke“ in `components/foundation/broadcast/BcBits.tsx`, Warum-Block als eigene Komponente (wird in
Einsatzliste, Profil und Nachbericht wiederverwendet). Daten: `playerFormState`, `playerMoraleState`, für die
drei Einsätze `seasonState.playerDisciplinePerformances`.

## Ansicht 2 — Formkarten-Leiste: live sehen, wer was bekommt

Screenshots `03`, `04`, `05`, Phone `12`, `13`.

- **Hand** unter dem Feld: jede Karte zeigt Farbe, Wert, Besitzer und ob sie zur Disziplin-Farbe **passt** oder
  **fremd ½** ist. Karten, die in der anderen Disziplin liegen, sind abgedunkelt („in Spurt“). Klick legt oder
  nimmt zurück, höchstens zwei je Disziplin. Am Desktop zeigt schon das Überfahren eine Vorschau.
- **Am Feld:** jede Platzkarte bekommt eine dreiteilige Marke: Creme = Summe, Kartenfarbe = Farbträger-Zusatz,
  Grün = Form-Verstärkung. Farbträger leuchten in der Kartenfarbe. Der Platzwert und die Waage oben rechnen sofort
  mit.
- **Rechts neben der Hand:** „Karten fürs Team“ als eine Zahl, darunter die Zerlegung alle / Farbe / Form.
- **Kontext-Reiter „Karten-Wirkung“:** Regel der gelegten Karte in einem Satz, dann die Tabelle „Wer bekommt“
  (alle / Farbe / Form / gesamt, mit gestapeltem Balken), die Team-Summe, ein Hinweissatz (entspricht
  `formkartenHinweis()`) und der Vergleich aller Hand-Karten für diese Disziplin als Rangliste.
- **Minuskarte:** in Screenshot `05` liegt die Pflichtkarte Power −4 im Spurt. Man sieht, dass nur der eine
  Power-Träger doppelt zahlt — das „Abladen“ wird zur lesbaren Entscheidung. Im Dock steht, wenn die Pflichtkarte
  noch offen ist.
- **Leer-Zustand** (Screenshot `01`, Reiter Karten-Wirkung): Regel als Mini-Tabelle (fremd +4 / +8, passend
  +8 / +12) und die Rangliste.

Code: Taktik-Leiste in `EinsatzlisteModern.tsx`; die Zahlen kommen aus `lib/lineups/formkarten-farbregel.ts`
(`kartenWertFuerSpieler`, `formkartenSummeFuerSpieler`, `formkartenHinweis`). Wertung und Anzeige müssen dieselbe
Funktion rufen — das steht im Regelwerk schon als Voraussetzung.

## Ansicht 3 — Spielerprofil: Verlauf und Ursachen

Screenshots `07` (Kati, steigt), `08` (Gram, eiskalt ohne Einsätze), `09` (Krolach, Erschöpfung bremst), Phone `16`.

- **Links Form-Verlauf:** Kennzahlen (Form, Stufe, Wirkung in Prozent, Erschöpfung mit Bremse), darunter die
  Kurve über die Spieltage der Saison. Fünf Bänder mit den Pfeilen als Achse, Mitte 50 als Linie. Gefüllter Punkt =
  Einsatz, hohler Punkt = kein Einsatz. Der anstehende Spieltag ist golden, die Zukunft schraffiert mit der
  gestrichelten Linie „ohne Einsatz zurück zur Mitte“.
- **Darunter „Leistung gegen Erwartung“:** je Spieltag ein Balken nach oben (grün) oder unten (rot) mit Disziplin
  und Abstand. Die Ursache steht direkt unter der Wirkung. „Last −5“ markiert Spieltage, an denen die
  Erschöpfung gebremst hat.
- **Rechts Moral:** Kennzahlen, dann die Ursachen als Balken von der Mitte aus (Grundwert 50, jede Ursache mit
  Vorzeichen, unten „Moral heute“). Darunter die letzten drei Einsätze, ein Satz in Klartext und der Bezug zu den
  Formkarten („als Social-Trägerin +4 Zusatz, in der jetzigen Form +0,5 obendrauf“).

Code: gehört in das Spielerblatt (`BcSheet`) bzw. die Kader-Seite. Die Moral-Ursachen liefert
`assessPlayerMorale()` bereits als `reasons`. **Neu nötig:** der Form-Verlauf. `playerFormState` speichert nur
den aktuellen Wert; für die Kurve braucht es je Spieltag einen Eintrag (Form danach, Einsatz ja/nein, Residuum,
Bremse) oder die Rekonstruktion aus `playerDisciplinePerformances`.

## Ansicht 4 — Nach dem Spieltag: „Form gestiegen, weil …“

Screenshots `10`, `11`, Phone `17`.

- **Bauchbinde** über dem Ergebnis: Porträt, „Form gestiegen · Spieltag 7“, „Kati: von gut drauf auf heiß“, ein
  Satz Begründung („Basketball: Leistung 91 gegen erwartete 72, klar über Erwartung“), rechts Pfeil vorher →
  nachher und Blättern durch die fünf größten Bewegungen.
- **Liste „Form-Meldungen“:** alle eigenen Spieler, größte Bewegung zuerst, je Zeile vorher → nachher, Wert und
  Warum. Vier Satzbausteine decken alle Fälle ab: über/unter Erwartung, Erschöpfung bremst zusätzlich, kein
  Einsatz (Rückfall zur Mitte), verletzt.
- **Rechts Moral:** nur wer sich bewegt hat, mit Grund. Dazu „Was jetzt zu tun ist“ und zwei Karten „Heiß in
  Spieltag 8“ / „Kalt“ als Brücke zur nächsten Einsatzliste.

Code: Einblendung als Baustein im Nachbericht bzw. Saisonstand nach `matchday-progress-service.ts`. Die
Begründungen entstehen aus denselben Größen, die `advancePlayerFormState` ohnehin berechnet (Residuum, Bremse,
Einsatz) — diese drei Zahlen müssen je Spieler und Spieltag mitgespeichert werden, sonst lässt sich der Satz
nicht bilden.

## Desktop und Phone

Desktop 16:9 (1600×900): drei Spalten wie die Einsatzliste. Phone (390×844): Feld oben, Karten-Hand zum
Wischen, Kader und Karten-Wirkung als Blätter von unten, das Warum als Blatt, Profil und Nachbericht
untereinander, die Bauchbinde klebt unten.

## Was beim Bauen auffiel (offene Designfragen)

1. **Heiße Spieler kühlen schnell ab.** Nach der Regel fällt ein ▲▲-Spieler (Form 85) nach einem Einsatz knapp
   unter Erwartung um 13 Punkte auf ▲ (Aerin im Mockup). Das ist regelkonform, wirkt aber hart. Das Mockup erklärt
   es mit einem Satz („Wer heiß ist, muss klar über Erwartung bleiben“). Ob die Regel so bleiben soll, ist eine
   Balance-Frage, keine Anzeigefrage.
2. **Spitze 12 oder 13?** Farbträger in passender Farbe bekommen 12, mit Form-Verstärkung ▲▲ sind es 13. Das Mockup
   zeigt beides getrennt (12 + 1). „Spitze 12“ stimmt also nur ohne die Verstärkung.
3. **Kleine Wirkung, große Anzeige.** Form bewegt höchstens ±2 %, Moral ±0,7 % — im Mockup oft unter zwei Punkten
   je Spieler. Die Karte bewegt dagegen 8 bis 19 Punkte. Die Anzeige gewichtet deshalb die Karten-Wirkung stärker
   und nennt bei Form und Moral immer die echte kleine Zahl, damit niemand eine ▲▲ für einen Gamechanger hält.
4. **Einheit.** Form und Moral wirken in Prozent auf die Eignung, Karten in Punkten. Das Mockup rechnet für den
   Platz alles in Punkte um und zeigt Prozent nur im Warum und im Profil.
5. **Perzentil als Wort.** „Erwartet 72, geleistet 91“ sind Perzentile im Teilnehmerfeld. Alternative wäre der
   Rang („erwartet Rang 5, geworden Rang 2“) — verständlicher, aber bei Gruppen-Disziplinen mit wenigen Teilnehmern
   grob.
6. **Karten in der Arena.** Laut Regelwerk wirken gespielte Karten in der Arena heute nur in `time-trial` und
   `spurt`. Die Vorschau darf nur dort eine Wirkung versprechen, wo sie auch gebucht wird — sonst zeigt die
   Einsatzliste Punkte, die es nicht gibt. Für die übrigen Disziplinen braucht es bis dahin einen ehrlichen
   Hinweis oder keine Vorschau.
7. **Moral der Nicht-Aufgestellten.** Die Kaderliste zeigt die Karten-Wirkung auch für Bankspieler (abgedunkelt,
   als „würde bekommen“). Das hilft beim Umstellen, kann aber als „bekommt er“ gelesen werden.

## Drei Ja/Nein-Fragen an Chris

1. Soll die Moral als **Zahl** (Herz + 68) überall sichtbar sein — oder reicht außerhalb des Profils ein
   Farbpunkt ohne Zahl? (Ja = Zahl überall, wie im Mockup.)
2. Soll die Karten-Marke am Platz **dreiteilig** bleiben (Summe, Farbe, Form) — oder nur die Summe zeigen und
   die Zerlegung der Tabelle rechts überlassen? (Ja = dreiteilig.)
3. Soll nach jedem Spieltag die **Bauchbinde** mit den größten Form-Bewegungen automatisch erscheinen?
   (Ja = automatisch; Nein = nur die Liste im Nachbericht.)

## Screenshots

`docs/design/form-moral-anzeige-17-11/` (Playwright, deviceScaleFactor 2):

| Datei | Zeigt |
|---|---|
| `01-einsatzliste-form-moral.png` | Einsatzliste ohne Karte, Reiter Form & Moral |
| `02-einsatzliste-warum-tooltip.png` | Warum-Tooltip an Karthogg (kalt, erschöpft) |
| `03-formkarte-passend-social8.png` | Social +8 in Basketball: +8 für alle, +4 Träger, Form-Verstärkung |
| `04-formkarten-zwei-gelegt.png` | Zwei Karten gelegt, Summen je Spieler und Team |
| `05-formkarte-fremd-und-minus-spurt.png` | Fremde Karte und Pflicht-Minuskarte im Spurt |
| `06-einsatzliste-spieler-warum.png` | Spieler gewählt, Warum-Block in der Kontextspalte |
| `07-spielerprofil-kati.png` | Profil: Form steigt, Moral-Ursachen |
| `08-spielerprofil-gram.png` | Profil: eiskalt, Moral im Keller |
| `09-spielerprofil-krolach.png` | Profil: Erschöpfung bremst die Form |
| `10-nach-dem-spieltag.png` | Nachbericht mit Bauchbinde (Form gestiegen) |
| `11-nach-dem-spieltag-meldung-2.png` | Bauchbinde zweite Meldung (Form gefallen) |
| `12-phone-einsatzliste-karte.png` | Phone: Feld, Karten-Hand, Team-Summe |
| `13-phone-karten-wirkung-blatt.png` | Phone: Blatt Karten-Wirkung |
| `14-phone-warum.png` | Phone: Warum-Blatt |
| `15-phone-kader-blatt.png` | Phone: Kader-Blatt mit Form, Moral, Karte |
| `16-phone-spielerprofil.png` | Phone: Profil |
| `17-phone-nach-dem-spieltag.png` | Phone: Nachbericht mit Bauchbinde |

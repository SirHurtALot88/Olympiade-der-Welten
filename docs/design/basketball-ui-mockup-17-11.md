# Basketball: Broadcast-UI als klickbarer Prototyp (Fable, 17.11.)

Anlass, Chris am 17.11.: „bildlich sehe ich nichts was modern wirkt wie bei F1 oder sonstwas — im
mockup baust du das dann cool aber bringst es hier nicht rein“ und „kannst du mir mal ein UI Layout
von fable als mockup vorbereiten wie das z.B. bei Basketball, wie wir es aktuell haben, aussehen
würde?“ Nachtrag: es darf eine Eigenkreation sein, soll funktionieren, eingebaut wirken und klickbar
sein wie in einem Spiel.

**Ansehen:** `public/mockups/basketball-ui-mockup-17-11.html` im Browser öffnen (Doppelklick genügt,
kein Server nötig; über den Dev-Server: `/mockups/basketball-ui-mockup-17-11.html`). Der Ablauf
startet von selbst und läuft bis zur Viertelpause.

Dies ist ein Entwurf. Kein Motor-Code ist geändert, `battle-mode.engine.js` ist nicht angefasst, der
Wertungs-Fingerabdruck wurde deshalb nicht neu gemessen. Bei PixelLab ist nichts bestellt.

## Was echt ist und was nicht

| Echt | Erfunden |
|---|---|
| Das Spielfeld: ein Standbild der Leinwand `#cv` aus `battle-mode.html`, Disziplin Basketball, Kulisse Street-Court, Demo-Kader, 1240 × 470 Pixel | Alle Zahlen: Spielstand, Boxscore, Fouls, Siegchance, Prognose, Führungsverlauf |
| Die zwölf Figuren, ihre Namen, Portraits (`public/portraits/`) und beide Wappen (`public/team-logos/`) | Der Ablauf: ein festes Drehbuch aus neun Ereignissen, kein Motor |
| Die Klickflächen liegen auf den Figuren, wo sie im Standbild stehen | Rollen (Aufbau, Flügel, Center), Formwerte, Eignungszahlen |

Zwei Eingriffe ins Standbild: das heutige HUD fehlt, weil es im Motor als DOM über der Leinwand liegt
und beim Auslesen der Leinwand nicht mitkommt; und die kleine Schussuhr-Kachel links neben dem Korb
ist wegretuschiert, weil sie sonst eine andere Zahl gezeigt hätte als die neue Spielanzeige. Die
Namensschilder, die der Motor selbst aufs Feld zeichnet („Gram“, „Draco“), sind stehen geblieben.

Der Hintergrund bewegt sich nicht. Der Ball-Marker und die Spielerwerte wandern mit dem Drehbuch,
die Figuren bleiben stehen. Zum Vergleich liegt der heutige Stand als
`basketball-ui-mockup-17-11/00-ist-zustand-arena-heute.jpg` daneben.

## Bilder

Alle unter `docs/design/basketball-ui-mockup-17-11/`, Hauptansicht 3200 × 1800 (16:9, doppelte Dichte).

| Datei | Zustand |
|---|---|
| `01-spielfluss.png` | Normalbetrieb: Spielanzeige, Band, Leisten, Spielverlauf |
| `02-live-stand-tafel.png` | Tafel aufgeklappt, Spielerkarte Johanna daneben |
| `03-dreier-moment.png` | Einblender „Dreier!“, Karte des Schützen, Lauf-Marke 8:0 |
| `04-viertelende-boxscore.png` | Viertelpause mit Boxscore, Teamvergleich, Führungsverlauf |
| `05-kamera-wahl.png` | Kamera „Spieler“: Wahlmodus, alle Figuren und Leisten markiert |
| `06-kamera-folgt-spieler.png` | Kamera folgt Ralazar |
| `07` bis `10-phone-*.png` | Phone 390 × 844: Spielfluss, Tafel, Boxscore, Dreier |
| `11-phone-uebersicht.png` | die vier Phone-Bilder nebeneinander |

## Aufbau

Die Arena-Leinwand ist 2,64 : 1, der Bildschirm 16 : 9. Der Entwurf nutzt genau diesen Unterschied:
das Spielfeld steht in voller Breite, die Bedienung liegt darüber und darunter und nicht auf dem Feld.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Basketball   ◢ Wappen TEAM  Fouls ▪▪▪▪▫  54 │ 3. V. 1:20 [20] │ 53 … ◣  ▶ 1× ♪ │  Kopfleiste 78 px
│ ════════════ Momentum-Balken ════════════                                │
├──────────────────────────────────────────────────────────────────────────┤
│        [ Siegchance 49 % ▬▬▬ 51 % │ Prognose 76 : 77 ± 8 │ Spieltag │ Tafel ⌄ ]   ← Band, auf der oberen Bande
│ ┌Tafel──────┐                                                            │
│ │ Rangliste │            S P I E L F E L D                               │  Arena 606 px
│ └───────────┘ ┌Spielerkarte┐                                             │
│               └────────────┘        [Anzeige: Stand · Box] [Kamera: Überblick · Ball · Spieler]  ← auf der unteren Bande
├──────────────────────────────────────────────────────────────────────────┤
│ Heim: 6 Spielerkacheln │ Spielverlauf (5 Zeilen, Filter) │ Gast: 6 Kacheln │  Dock 216 px
└──────────────────────────────────────────────────────────────────────────┘
```

Vier Regeln, nach denen die Flächen verteilt sind:

1. **Dauerhaft Sichtbares liegt außerhalb des Felds** oder auf den Banden oben und unten, die im
   Arenabild ohnehin nicht bespielt werden (obere Bande 64 px, untere 75 px bei 1600 Breite).
2. **Was aufs Feld muss, weicht dem Ball aus.** Tafel, Spielerkarte und Einblender docken auf der
   ballfernen Hälfte an. Im Prototyp ist das fest links, weil der Angriff rechts läuft; im Motor
   wäre es eine Abfrage der Ballseite beim Öffnen.
3. **Jede Information hat genau einen festen Ort.** Der Spielstand steht nur in der Kopfleiste, die
   Einordnung nur im Band, die Einzelwerte nur in Leiste, Karte und Boxscore. Heute steht der Stand
   dreimal im Bild (Kopf über der Leinwand, Anzeige auf der Leinwand, „0 : 0“ zwischen den Kadern).
4. **Alles ist mit Maus, Finger und Tastatur erreichbar.** Jede Schaltfläche hat einen sichtbaren
   Fokusrahmen, einen Hover-Zustand und, wo sie erklärungsbedürftig ist, einen Tooltip.

### Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf Figur, Spielerkachel, Tafelzeile oder Boxscore-Zeile | Spielerkarte öffnen |
| `L` oder Knopf „Stand“ | Live-Stand: Band → Tafel → aus |
| Klick auf das Band | Tafel aufklappen |
| `B` oder Knopf „Box“ | Boxscore auf/zu |
| `1` `2` `3` | Kamera Überblick / Ball / Spieler |
| Kamera „Spieler“ ohne gewählten Spieler | Wahlmodus: Figuren und Kacheln blinken, nächster Klick wählt |
| `←` `→` | Spieler durchschalten |
| Leertaste | Pause, in der Viertelpause „Weiter“ |
| `Esc` | schließt das Oberste (Wahlmodus, Karte, Boxscore, Tafel) |
| Auge in der Tafel | Prognose aus- und einblenden |
| Reiter 1. V. / 2. V. / Jetzt | Messpunkt der Tafel; das 4. Viertel ist grau und nicht wählbar |
| „Alle / Körbe / Fouls“ | Filter im Spielverlauf |

Die graue Leiste ganz oben („Mockup“) gehört nicht zum UI. Sie springt zu den Zuständen der Bilder.
Dieselben Zustände gibt es per Adresse: `?szene=fluss|tafel|dreier|viertel|kamera|folgen`, mit
`&still=1` als Standbild ohne Leiste, mit `&phone=1` in der Phone-Fassung.

### Phone

Unter 760 px Breite wird aus der Bühne eine Spalte: Spielanzeige oben angeheftet (Kürzel statt
Teamnamen), darunter das Feld mit der Ball-Kamera als Voreinstellung, weil der Überblick auf 390 px
nur 148 px hoch wäre. Spielerkacheln als zwei waagerecht wischbare Reihen, Spielverlauf darunter,
Bedienleiste unten fest. Tafel und Spielerkarte kommen als Blatt von unten, der Boxscore als
Vollbild. Auf dem Phone öffnet ein Highlight die Spielerkarte nicht von selbst.

## Designprinzipien

1. **Ein Spielstand, groß.** Die Zahl 62 px, die Uhr 38 px. Aus drei Metern lesbar.
2. **Schräge statt Kasten.** Teamfelder, Foul-Marken, Balken und der Einblender sind um 10 bis 14 Grad
   geneigt. Das ist das eine Formmerkmal, das an F1- und NBA-Grafik erinnert, und es kostet nur CSS.
3. **Teamfarbe ist Bedeutung, nicht Schmuck.** Bernstein ist immer Heim, Türkis immer Gast: im
   Schild, im Kachelrand, im Spielverlauf, in der Tafel, im Führungsverlauf. Gold ist nur „eigen“
   und „ausgewählt“. Rot ist nur Warnung (Schussuhr unter 5, Bonus, Foulgrenze).
4. **Dunkle Fläche, heller Haarstrich.** Dieselben Grundwerte wie die HYROX-Rangleiste und die
   Pod-Tafel im Motor, damit es wie der Rest aussieht.
5. **Zwei Schriften mit getrennter Aufgabe.** Die Hausschrift für Namen und Schlagworte, eine
   schmale Grotesk mit festen Ziffernbreiten für alles, was sich ändert.
6. **Bewegung nur bei Ereignissen.** Der Stand springt kurz auf, die neue Zeile im Spielverlauf
   rutscht ein, der Einblender wischt durch. Sonst steht das Bild still.
   `prefers-reduced-motion` schaltet alles ab.
7. **Prognose immer als Spanne** („76 : 77 ± 8“, „2.–4.“), mit der Zeile, worauf sie beruht. Das ist
   unverändert aus `live-stand-overlay-konzept-17-11.md` übernommen.

### Farbtokens

| Token | Wert | Verwendung |
|---|---|---|
| `--grund` | `#06080c` | Bühne |
| `--flaeche` | `rgba(9,12,18,.90)` | schwebende Tafeln über dem Feld |
| `--flaeche-2` / `-3` | `#121824` / `#1a2231` | Kacheln, Knöpfe; Hover |
| `--linie` / `--linie-2` | Cremeweiß mit 16 % / 34 % Deckung | Haarstriche, betonte Ränder |
| `--creme` | `#f4e6c4` | Überschriften, aktiver Knopf |
| `--gold` | `#f0c35a` | eigen, ausgewählt, Hauptaktion |
| `--tinte` / `--leise` / `--stumm` | `#eef2f8` / `#9aa7ba` / `#66738a` | Text in drei Stufen |
| `--heim` | `#F2A03D` | Heimteam (Wert aus `battle-mode.css`, dunkles Thema) |
| `--gast` | `#45B0C9` | Gastteam (ebenso) |
| `--gut` / `--warn` | `#62d394` / `#ff6058` | positiv; Warnung |

Heim- und Gastfarbe sind die des Motors. Für echte Spieltage müsste dort die Vereinsfarbe aus den
Teamdaten stehen; das ist eine Zeile je Team.

### Typografie

| Rolle | Schrift | Größen bei 1600 Breite |
|---|---|---|
| Namen, Schlagworte, Tafeltitel | RaniraSeason (`public/fonts/ranira-bold-italic.otf`), danach Georgia | 16 bis 76 px |
| Zahlen, Etiketten, Fließtext | Barlow Condensed 500 bis 800, danach Roboto Condensed, Arial Narrow, Arial | 11,5 bis 62 px |

Etiketten in Großbuchstaben mit 0,12 bis 0,16 em Sperrung, Zahlen mit `tabular-nums`. Barlow Condensed
kommt im Prototyp per Google-Fonts-Link. Für den Einbau gehört die Datei nach `public/fonts/`
(SIL Open Font License), damit die App nicht von einem fremden Server abhängt.

## Bauteile: Datenlage und Aufwand

„Vorhanden“ heißt: der Motor führt den Wert heute schon und zeigt ihn irgendwo an oder bucht ihn.
Geprüft per `grep` in `battle-mode.engine.js` und am laufenden Spiel; nicht jede Stelle ist im
Detail gelesen. Aufwand in Arbeitstagen eines Agenten einschließlich Sichtprüfung, ohne Review.

| # | Bauteil | Daten | Aufwand |
|---|---|---|---|
| 1 | **Spielanzeige** (Wappen, Namen, Stand, Viertel, Uhr, Schussuhr, Ballbesitz) | Vorhanden: alles steht heute in `aktualisiereBbug()` | 0,5 Tage, reines Umgestalten von `#bbug` |
| 2 | **Teamfouls mit Bonus-Marke** | **Neu.** Freiwürfe und Fouls gibt es im Motor, einen Teamfoul-Zähler je Viertel habe ich nicht gefunden. Als reine Anzeige zählbar, wenn jedes Foul ein Ereignis im Zugprotokoll hat; eine Bonus-Regel wäre dagegen eine Wertungsänderung | 0,5 Tage für den Zähler; die Regel ist eine eigene Entscheidung |
| 3 | **Lauf-Marke** („Lauf 8:0“) | Vorhanden: `basketballLaufInfo()` meldet ab 8 Punkten in Folge | 0,25 Tage |
| 4 | **Momentum-Balken** | Ableitbar aus dem Zugprotokoll `fsZuege` (Punkte der letzten zwei Spielminuten je Seite), kein neuer Wert | 0,5 Tage |
| 5 | **Live-Stand-Band** (Siegchance, Prognose, Spieltag) | **Neu**, wie im Konzept Welle 4: braucht die Kalibrier-Messreihe. „Spieltag“ braucht die Punktetabelle vom Host (Welle 5) | 2 Tage, davon 0,5 Messreihe; erst mergen, wenn die Trefferquote geprüft ist |
| 6 | **Live-Stand-Tafel** (Rang, Wert, Abstand, Prognose, Punkte, Reiter je Viertel) | Wert ist die vorhandene Spalte IMP der Wertungsbox; Rang, Abstand, Punkte folgen daraus. Reiter brauchen einen Schnappschuss je Viertelende (Modulvariable). Prognose-Spanne neu | 1,5 Tage auf dem Rahmen `#livestand` des Konzepts |
| 7 | **Spielerleisten** (12 Kacheln, Punkte, Rebounds, Vorlagen, Fouls, Ball-Marke) | Vorhanden: Boxscore und Ballbesitzer. Persönliche Fouls: prüfen, ob je Spieler gezählt | 1 Tag, ersetzt die Kaderkarten unter der Leinwand |
| 8 | **Spielerkarte** | Vorhanden: Boxscore-Zeile (PKT REB AST STL BLK TO FG FG% IMP), Portrait, Eignung, Formkarte. Rolle: aus dem Aufstellungs-Slot | 1 Tag |
| 9 | **Klick auf die Figur** | Positionen kennt der Motor; es fehlt der Treffertest Leinwand → Spieler | 0,5 Tage |
| 10 | **Spielverlauf mit Filter** | Vorhanden: der Ticker. Neu: Ereignisart als Feld je Zeile statt nur Text, Zwischenstand je Korb | 0,5 Tage |
| 11 | **Highlight-Einblender** („Dreier!“, „Dunk!“) | Vorhanden: `callout` zeigt „DREIER“ heute schon, Dunk kennt der Motor | 0,5 Tage Umgestalten, plus Portrait und Ausweich-Seite |
| 12 | **„Noch einmal“** | Im Prototyp nur der Einblender erneut. Eine echte Wiederholung der Szene bräuchte einen Aufzeichnungspuffer der Positionen | Einblender 0,1 Tage; echte Wiederholung 2 bis 3 Tage und eine eigene Entscheidung |
| 13 | **Kamera Überblick / Ball / Spieler** | Kamera mit Zoom und Mittelpunkt gibt es für Zeitfahren und HYROX (`cam.zoom`, `cam.cx`); für das Feldspiel ist sie neu | 2 Tage. Größtes Risiko: Figuren und Feldlinien müssen bei Zoom scharf bleiben, und Chris' Befund „Pulk unterm Korb“ wird in der Nahsicht deutlicher, nicht schwächer |
| 14 | **Viertelpause mit Boxscore** | Vorhanden: Viertelpause, Boxscore, Viertelstände aus dem Zugprotokoll. Teamvergleich sind Summen | 1 Tag |
| 15 | **Führungsverlauf mit Prognose-Fächer** | Ableitbar aus `fsZuege`; der Fächer hängt an Bauteil 5 | 0,5 Tage ohne Fächer |
| 16 | **Bedienleisten, Tastatur, Tooltips** | keine Daten | 0,5 Tage |
| 17 | **Phone-Layout** | keine Daten | 1,5 Tage, berührt den Host, weil die Arena dort in einer Spalte mit fester Breite sitzt |

Summe rund 14 Tage. Davon berühren nur zwei Posten Zahlen, die falsch sein können (5 und der
Prognose-Teil von 6); alles andere stellt dar, was schon gebucht wird.

### Gezeigt = gebucht

- Stand, Uhr, Boxscore, Lauf, Viertelstände, Führungsverlauf und Momentum lesen dieselben Felder wie
  die Wertung. Am Spielende steht in jeder Anzeige der gebuchte Wert.
- Siegchance und Prognose sind die einzigen geschätzten Zahlen. Für sie gilt die Regel des Konzepts
  unverändert: nur lesen, was schon auf dem Bildschirm stand; nie der gebuchte Snapshot des
  Spieltags; keine neuen `rr()`-Aufrufe.
- Alles als DOM über der Leinwand, hinter derselben `document`-Prüfung wie die übrigen DOM-HUDs.
  Der Node-Motor des Fingerabdrucks läuft daran vorbei.
- Neuer Zustand nur in Modulvariablen und WeakMaps (Schnappschüsse je Viertel, gewählter Spieler,
  Kamera-Modus), keine neuen Felder an Spielerobjekten.

## Empfohlene Reihenfolge

| Schritt | Inhalt | Tage | Was Chris danach sieht |
|---|---|---|---|
| A | Bauteile 1, 3, 4, 7, 10, 16: Kopfleiste, Leisten, Spielverlauf im neuen Layout, ohne neue Zahlen | 3 | Das Bild aus `01-spielfluss.png` ohne Band, am echten Spiel |
| B | Bauteile 8, 9, 11, 14, 15: Spielerkarte, Klick auf Figur, Einblender, Viertelpause | 3,5 | Klickbar wie der Prototyp |
| C | Bauteil 13: Kamera | 2 | Ball- und Spielerkamera |
| D | Bauteile 5, 6: Live-Stand mit Prognose, nach der Messreihe | 3,5 | Band und Tafel |
| E | Bauteile 2, 17, danach Hockey und Football auf denselben Rahmen | offen | — |

Schritt A ist der, der Chris' Satz beantwortet: er bringt die Optik in die echte Arena und braucht
keine einzige neue Zahl. Jeder Schritt ist ein eigener PR mit Fingerabdruck vorher und nachher
(Soll unverändert `e80babacb68c`).

## PixelLab

Nichts bestellt, 0 Generationen. Kontostand am 17.11. gelesen: 866,7 Generationen.

Der Entwurf kommt mit CSS und Inline-SVG aus. Ein gemalter Rahmen oder gemalte Icons neben einer
scharfen Zahlenschrift wären ein zweiter Stil im selben Bild; die Pixelgrafik gehört aufs Feld, die
Bedienung darf glatt sein. Die Basketball-Requisiten des Schwester-Agenten (Korb, Parkett,
Schussuhr-Rahmen, Branch `claude/basketball-assets-17-11`) betreffen das Feld und sind hier nicht
verwendet; sie vertragen sich mit diesem Layout, weil die Schussuhr in der Kopfleiste steht und der
Rahmen auf dem Feld dann entfallen oder als Kulisse bleiben kann.

## Offene Fragen an Chris

1. **Soll Schritt A (neue Kopfleiste, Spielerleisten, Spielverlauf, ohne neue Zahlen) als Erstes in
   die echte Basketball-Arena?** Empfehlung: Ja. Drei Tage, kein Risiko für die Wertung.
2. **Sollen die zwölf Kaderkarten unter der Leinwand durch die Spielerleisten im Dock ersetzt
   werden?** Empfehlung: Ja. Sie zeigen dasselbe, brauchen aber heute mehr Platz als das Spielfeld.
3. **Soll die Bonus-Regel (ab dem fünften Teamfoul Freiwürfe) ins Spiel?** Empfehlung: vorerst nur
   den Zähler anzeigen. Die Regel ändert die Wertung und gehört in eine eigene Runde mit rho-Messung.

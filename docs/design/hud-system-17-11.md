# HUD-System: Broadcast-HUD als Baukasten für alle zwanzig Disziplinen (17.11.)

Anlass, Chris am 17.11. zum klickbaren Basketball-Prototyp (`docs/design/basketball-ui-mockup-17-11.md`):
„die layout UI sachen sehen geil aus … genau so ne qualität hätte ich gerne öfter und ÜBERALL! jede diszi
muss sowas haben“. Davor: „bildlich sehe ich nichts was modern wirkt wie bei F1 … im mockup baust du das
dann cool aber bringst es hier nicht rein.“

Dieser Schritt bringt die Optik des Mockups **in die echte Arena** (`public/mockups/battle-mode.*`, die der
Host `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` unverändert lädt) — nicht als
Basketball-Sonderbau, sondern als **Baukasten**: CSS-Tokens, fertige Bauteile und eine Profiltabelle
`HUD_PROFIL[disziplin]`, über die eine Disziplin das HUD nur noch **konfiguriert**. Basketball ist voll
angeschlossen (Schritt A des Entwurfs plus Spielerkarte und Einblender); die anderen neunzehn Disziplinen
haben ein Skelett-Profil mit benannten Datenquellen und behalten bis zu ihrem Roll-out ihr altes HUD.

**Keine Wertungsänderung.** Wertungs-Fingerabdruck vorher und nachher **GESAMT d09e10bb872c (75 Einträge)**.
Keine neue Regel (keine Teamfoul-Bonusregel), keine neuen Felder an Spieler-/Läuferobjekten, kein `rr()`.
PixelLab: nichts bestellt, alles CSS.

## 1. Was gebaut ist

### Bauteile

| # (Entwurf) | Bauteil | Element | Motor-Funktion | Was es zeigt (Basketball) |
|---|---|---|---|---|
| 1 | **Scorebug / Kopfleiste** | `#hudKopf` über der Leinwand | `hudKopfTick()` | Wappen, Teamname (Phone: Kürzel), Stand groß, führende Seite in Teamfarbe, Periode, Uhr, Zusatzfeld (Schussuhr, rot unter 5 s), Ballbesitz-Punkt |
| 3 | **Lauf-Marke** | Chip in der Kopfleiste | `p.daten.lauf()` | „LAUF 8:0“ an der Seite, die gerade läuft |
| 4 | **Momentum** | Tauzieh-Balken unter der Kopfleiste | `hudMomentum()` | Punkte je Seite in den letzten 60 s Spielzeit; Wert im Tooltip |
| 7 | **Spielerleisten im Dock** | `#hudDock .hud-leiste` | `hudDockTick()` | Portrait, Name, Rolle (Slot), Kernwert PKT groß, REB/AST, persönliche Fouls als fünf Marken, Ball-Marke am Ballführenden; Klick öffnet die Karte |
| 8 | **Spielerkarte** | `#hudKarte` über der Leinwand | `hudKarteTick()` | Portrait, Team · Rolle, Name, Eignung, Form; PKT/REB/AST groß, STL/BLK/TO/FG/FG%/IMP klein; ◀ ▶ durchschalten; beim Gegner „Doppeln“ (derselbe Weg wie ein Klick auf ihn im Feld). Dockt auf der ballfernen Hälfte an |
| 10 | **Spielverlauf mit Filter** | `#hudDock .hud-verlauf` | `hudVerlaufNachfuehren()` | Neueste Zeile oben: Uhr, Art (+2/+3/FW, Foul, Steal, Block, TO), Satz, Zwischenstand; Filter Alle / Körbe / Fouls / Abwehr; Dreier, Dunks, Und-eins in Gold |
| 11 | **Highlight-Einblender** | `#hudEinblender` | `hudCallout()` / `hudEinblenderTick()` | „DREIER!“, „DUNK!“, „LAUF!“ … schräg eingewischt, Portrait des Schützen, „+3“, seine Zeile (12 PKT · 4/7 FG) |
| 16 | **Bedienleiste mit Tastenkürzeln** | `#hudBedien` unten rechts auf der Leinwand | `hudBedienTick()` / `hudTaste()` | Start/Pause ␣, Tempo T, Live-Stand L, Spieler ←→, Filter F — mit Tooltip je Knopf |

Bauteil 2 (Teamfouls mit Bonus), 5/6 (Prognose im Band, Tafel-Reiter je Viertel), 9 (Klick auf die Figur
öffnet die Karte), 12 (Wiederholung), 13 (Kamera), 14/15 (Viertelpause mit Boxscore, Führungsverlauf)
sind **nicht** Teil dieses Schritts, s. Abschnitt 5.

### Tastatur

| Taste | Wirkung |
|---|---|
| Leertaste | Start / Pause (wie der Knopf `#play`; liegt der Fokus auf einem Knopf, löst die Leertaste wie üblich diesen aus) |
| `T` | Tempo umschalten (`#spd`) |
| `L` | Live-Stand Band → Tafel → aus (vorhanden, unverändert) |
| `←` `→` | Spielerkarte öffnen bzw. zum vorigen/nächsten Spieler |
| `Esc` | Spielerkarte schließen |
| `F` | Spielverlauf-Filter durchschalten |

Die Foundation-Shell fängt die Leertaste auf `battleArena`/`matchdayArena` ohnehin nicht ab
(`activeViewHandlesOwnSpace`, Chris 04.09.: „man muss das spiel mit leertaste pausieren können“) — das
HUD liefert jetzt genau diese Pause. Die Taste wirkt nur, wenn ein fertiges Profil aktiv und die
Arena sichtbar ist.

### Designsystem (CSS-Block „HUD-SYSTEM“ am Ende von `battle-mode.css`)

| Token | Wert | Verwendung |
|---|---|---|
| `--hud-grund` / `--hud-flaeche` / `-2` / `-3` | `#06080c` / `rgba(9,12,18,.90)` / `#121824` / `#1a2231` | Bühne, Glasflächen über dem Feld, Kacheln, Hover |
| `--hud-linie` / `--hud-linie-2` | Creme 16 % / 34 % | Haarstriche, betonte Ränder |
| `--hud-creme` `--hud-gold` | `#f4e6c4` `#f0c35a` | Überschriften/aktiv; Gold nur „ausgewählt“/Hauptaktion |
| `--hud-tinte` `--hud-leise` `--hud-stumm` | `#eef2f8` `#9aa7ba` `#66738a` | Text in drei Stufen |
| `--hud-heim` `--hud-gast` | `#F2A03D` `#45B0C9` | Teamfarbe = Bedeutung (Schild, Kachelrand, Verlauf, Einblender); je Team per `style="--hud-heim:…"` überschreibbar |
| `--hud-gut` `--hud-warn` | `#62d394` `#ff6058` | positiv; Warnung (Schussuhr < 5, Foulgrenze) |
| `--hud-haus` / `--hud-zahl` | RaniraSeason / Barlow Condensed | Namen & Schlagworte / alles, was sich ändert (`tabular-nums`) |
| `--hud-a1…a4`, `--hud-r`, `--hud-schraeg` | 4/8/12/16 px, 8 px, −14° | Abstände, Radius, die eine Schräge |

Das HUD ist immer dunkel (Sendegrafik), unabhängig vom Seitenthema. `prefers-reduced-motion` schaltet
alle HUD-Animationen ab. Kopf und Dock sind CSS-Container (`container-type:inline-size`): sie richten sich
nach der Breite der Arena-Spalte im Host, nicht nach dem Fenster.

**Schriften.** RaniraSeason (`public/fonts/ranira-bold-italic.otf`, vorhanden) und neu **Barlow Condensed
500/600/700/800** als `woff2` in `public/fonts/`, Lizenz SIL OFL 1.1 (`public/fonts/barlow-condensed-OFL.txt`),
bezogen aus dem npm-Paket `@fontsource/barlow-condensed@5.1.1`, nur der Latin-Ausschnitt (deckt ä ö ü ß).
Kein Google-Fonts-Link zur Laufzeit. Barlow gilt **nur innerhalb der HUD-Bauteile**; Chris' Vorgabe vom
30.09. („nutz nur den Font, den ich für alles vorgegeben hatte“) gilt für den Rest der Arena weiter. Das
ist eine bewusste Ausnahme, weil der Prototyp, den Chris freigegeben hat, genau diese Zahlenschrift trug —
**offene Frage an Chris**, s. Abschnitt 6.

**Phone (< 760 px).** Kopfleiste mit Kürzeln statt Namen und kleinerer Uhr, Spielerleisten als zwei
waagerecht wischbare Reihen (Kernwert + ein Nebenwert), Spielverlauf darunter (zwei Zeilen je Eintrag,
scrollbar), Bedienleiste als Knopfreihe unter dem Feld, Spielerkarte als Blatt von unten, Einblender
schmal ohne Portrait. Getestet bei 390 px: kein waagerechtes Überlaufen der Seite.

### Konfigurationsschicht `HUD_PROFIL`

Im Motor-Block „HUD-SYSTEM“ (`battle-mode.engine.js`, direkt vor dem Hauptloop). Ein Profil hat:

| Feld | Bedeutung |
|---|---|
| `status` | `"fertig"` schaltet das HUD ein, `"skelett"` dokumentiert nur die Quellen (altes HUD bleibt) |
| `chassis` | feldspiel / kampf / buehne / buehne-duell / bahn / kampf-ffa |
| `komponenten` | welche Bauteile die Disziplin zeigt |
| `ersetzt` | welche alten Teile ausgeblendet werden (Kopfzeile, `#bbug`, Lauf-Band, Callout, Kaderleiste) |
| `daten` | **Adapter**: `stand()`, `uhr()`, `zusatz()`, `ballbesitz()`, `ballTraegerId()`, `lauf()`, `fouls()`, `einblenderStat(u)` — die einzigen disziplinspezifischen Lesestellen |
| `quellen` | Klartext: aus welcher gebuchten Funktion jedes Bauteil liest (für das Roll-out und die Abnahme) |
| `kern`, `leiste`, `karte` | Spalten-IDs aus `wertungVon(disc).spalten` — Kernwert, Nebenwerte der Leiste, Werte der Karte |
| `nullStrich`, `foulsGrenze`, `momentumFensterUhrSek`, `zusatzTitel` | Darstellung |
| `verlaufArten`, `verlaufFilter` | Ereignisart → Filterkategorie, Filterknöpfe |
| `einblenderSchuetze` | bei welchen Highlight-Arten der Einblender den Schützen nachschlägt |

Spielerleisten und Spielerkarte lesen **für jede Disziplin** `wertungVon(disc).zeilen()` — dieselben
Zeilen und Spalten wie die Tabelle „Wertung laufend“. Eine neue Disziplin muss dafür nichts bauen,
sondern nur sagen, welche Spalten-IDs Kern-, Leisten- und Kartenwerte sind.

### Verzahnung mit dem Bestand

- **Live-Stand** (Band/Tafel, `liveStand*`, Welle 1) bleibt unverändert und wird nicht doppelt gebaut. Weil
  `#bbug` nur per CSS ausgeblendet ist (das `hidden`-Attribut steuert weiter `aktualisiereBbug()`), sieht
  `liveStandTick()` den Bug wie bisher als sichtbar an; nur `--ls-band-top` rückt das Band an die
  Oberkante der Leinwand, weil der Scorebug jetzt darüber steht. Taste und Knopf L bleiben die des Live-Stands.
- **Alte Kopfzeile / Score-Bug / Kaderleiste**: werden weiter befüllt (`updateHudFeldspiel()`,
  `aktualisiereBbug()`, `renderKader()` unverändert) und bei `.arenaHaupt.hud-sys` nur ausgeblendet. Jede
  Disziplin ohne fertiges Profil sieht exakt das alte HUD.
- **Callout**: `feed(big)` ruft `callout()` wie bisher, reicht jetzt zusätzlich Seite und Art durch;
  bei fertigem Profil übernimmt `hudCallout()` den Einblender. Keine neue Ereigniserkennung.
- **Fokus-Doppeln**: die Kaderkacheln waren eine Auswahlfläche dafür. Dieselbe Wirkung hat jetzt der
  Knopf „Doppeln“ auf der Karte eines Gegners (`fokusUmschalten()`), der Klick aufs Feld bleibt.
- **Leinwand-Schussuhr** (`zeichneShotClock()`) bleibt stehen, obwohl die Schussuhr jetzt auch im Scorebug
  steht: PR #1562 baut gerade einen Schussuhr-Rahmen genau dort; die Entscheidung „nur ein Ort“ ist offen.
- **Schalter**: `window.__arena.hudSystem(false)` stellt das alte HUD her (Vergleichsbilder),
  `window.__arena.hudProbe()` liefert gezeigt gegen gebucht, `window.__arena.hudKarte(id)` öffnet eine Karte.

### Gezeigt = gebucht (Basketball)

| Anzeige | Quelle | Gleich mit |
|---|---|---|
| Stand | `fsPunkte` | `#score`, Endstand |
| Periode/Uhr | `feldspielRestzeitAbwaerts()` | `#clock` |
| Schussuhr | `basketballSchussuhrRest()` | Leinwand-Ziffernbox |
| Ballbesitz, Ball-Marke | `fsLive.amBall`, `fsLive.ball.traeger` | Ballpunkt im Feld |
| Lauf | `basketballLaufInfo()` (≥ 8 Punkte in Folge) | Ticker „8:0-Lauf“ |
| Momentum | Treffer aus `fsZuege` mit Uhr-Stempel | Summe der Körbe im Verlauf |
| Leisten, Karte | `wertungVon(disc).zeilen()` = `fsBisher()` | Tabelle „Wertung laufend“, Boxscore |
| Fouls je Spieler | `fsBisher().spieler[id].fouls` (Fouls als Verteidiger) | — (vorher nirgends gezeigt) |
| Spielverlauf | `fsZuege[0..fsZeiger]` (treffer, foul, steal, block, turnover) | letzter Zwischenstand = `fsPunkte` |
| Einblender | `feed(big)` → `callout()` | Ticker-Zeile, Highlights im Endstand |

Einzige neue Zustände (Modulvariablen): Uhr-Stempel der Verlaufszeilen (beim ersten Sehen eines Eintrags
gestempelt, also bildgenau), gewählter Spieler, Filter, offener Einblender. Die Prüfung
`tests/hud-system-basketball.test.ts` vergleicht im laufenden Spiel und am Ende jede Leiste, den Stand und
den Verlauf mit dem Gebuchten.

### Chris' Live-Befunde vom 17.11. (Screenshot der echten Battle Arena, main 5b74d521)

| Befund | Ursache | Behebung |
|---|---|---|
| Unterzeile im Score „… läuft · Punkte / Kontrollpunkte Lebende 3 · 3 · 3“ in Basketball | `#kpzeile` wird nur von `updateHud()` (Kampf-Chassis) ein- und ausgeschaltet; nach Battlefield blieb sie in jeder Nicht-Kampf-Disziplin mit dem alten Wert stehen | `hudKpZeileAufraeumen()` blendet sie für Feldspiel/Bühne/Bahn jedes Bild aus — **für alle Disziplinen**, unabhängig vom HUD-Profil. In Basketball ist die alte Kopfzeile ohnehin ersetzt |
| „Spielaufbau 0 gegen 0“ oben links abgeschnitten | Planzeile `#arenaplan` liest `jeSeiteVon(disc)` vor dem Kaderbau | Bei fertigem Profil ist die Planzeile ausgeblendet; die Unterzeile des Scorebugs zeigt das Format aus den **gebauten** Kadern („6 gegen 6 · live“) |
| Ticker oben rechts unter „Angemeldet als … · Abmelden“ | Badge und Bug-Flagge des Hosts sind `position:fixed` oben rechts (`app/globals.css`) | Safe-Area `--host-safe-oben` (78 px): im Einbettungsmodus mit Badge/Flagge beginnt die Seitenspalte (Ticker/Wertung) darunter — für alle Disziplinen |
| Zwölf Kaderkarten mit „0“ unter der Leinwand | — | in Basketball durch die Dock-Leisten ersetzt, die die gebuchten Werte zeigen |

Bilder: `08-vorher-live-befunde.png` (origin/main, Battlefield → Basketball, Host-Badge nachgestellt) und
`09-nachher-live-befunde.png`.

## 2. Bilder

Unter `docs/design/hud-system-17-11/`, Desktop 1600 × 1000 (Ausschnitt Arena), Phone 390 × 844 bei
doppelter Dichte. Standalone-Seite (`battle-mode.html` per Datei), deshalb ohne Portraits und Wappen —
im Host stehen dort die echten Bilder.

| Datei | Zustand |
|---|---|
| `01-vorher-spielfluss.png` | altes HUD (Kopfzeile, Bug, Kaderkacheln) im selben Spiel |
| `02-nachher-spielfluss.png` | Scorebug, Momentum, Dock mit Leisten und Spielverlauf, Bedienleiste |
| `03-nachher-einblender.png` | Highlight-Einblender |
| `04-nachher-spielerkarte.png` | Spielerkarte offen, Leiste markiert |
| `05-vorher-phone.png` / `06-nachher-phone.png` | Phone 390 px |
| `07-nachher-phone-karte.png` | Phone: Karte als Blatt von unten |
| `08-vorher-live-befunde.png` / `09-nachher-live-befunde.png` | Chris' drei Live-Befunde vorher/nachher |

## 3. Alle zwanzig Disziplinen

„Heute“ = was der Motor heute als HUD zeigt (`live-stand-overlay-konzept-17-11.md` Abschnitt 3 und eigene
Lektüre). „Datenquelle“ = woraus das Profil lesen wird; alles davon wird heute schon gebucht oder
angezeigt. Aufwand in Arbeitstagen eines Agenten einschließlich Sichtprüfung und Test, ohne Review.

| # | Disziplin | Chassis | Heute vorhanden | Zielbild im HUD-System | Datenquelle (gezeigt = gebucht) | Tage | Welle |
|---|---|---|---|---|---|---:|---|
| 1 | **Basketball** | Feldspiel | — | **fertig**: Scorebug mit Schussuhr, Lauf, Momentum, Leisten, Karte, Verlauf, Einblender, Bedienung | s. Abschnitt 1 | — | 0 |
| 2 | Hockey | Feldspiel | Bug mit Drittel/Uhr, PP-Uhr, SOG, Torwart raus, Torlicht | Zusatzfeld PP-Uhr, SOG im Teamfeld, Leisten Tore/Vorlagen/Schüsse, Torwart-Leiste mit Paraden, Verlauf Tore/Strafen/Checks | `fsPunkte`, `hockeyPPInfo()`, `hockeySOG()`, `WERTUNG_HOCKEY`, `fsZuege` (treffer/strafe/check/block) | 1 | 1 |
| 3 | Football | Feldspiel | Bug mit Down & Distance, Kickoff, 3rd-Down | Zusatzfeld „3rd & 4“, Ballbesitz-Pfeil, Leisten Yards/TD, Verlauf Drives | `fsPunkte` + `fsPeriodenStand` (XP), `fsLive.football`, `WERTUNG_FOOTBALL`, `fsZuege` | 1,5 | 1 |
| 4 | TDM | Kampf | Bug mit Lebens-Pips, Überzahl, Sudden Death; Spectator-Karten (Mana/Ult/KTB) | Scorebug mit Pips, Leisten mit LP-Balken, Ult-Ring, K/T/B; Verlauf = Killfeed | `#score`/`live()`, `u.st` über `wertungVon`, `feed()`-kinds `ersteAusschaltung`/`mehrfachkill`/`trade` | 1,5 | 2 |
| 5 | Battlefield | Kampf | wie TDM, Kontrollpunkte, Pod-Tafel | wie TDM + KP-Zusatzfeld; Pod: vier Teamfelder | `kampfSieger()`/`dominationSieger()`, `#kpzeile`, `zeichneBfPodTafel()` | 1 | 2 |
| 6 | Mini-DM | Kampf-FFA | eigene Turnieransicht `#minidmffa` | Bildsprache angleichen: Kopf mit vier Teams, Runden-Einblender | `spieleMiniDmFfaEvent()`/`renderMiniDmFfa()` | 1,5 | 5 |
| 7 | Fechten | Bühne-Duell | FIE-Tafel, Trefferlampen, Bahnleiste | Scorebug Mannschaftsstand + aktuelles Gefecht im Zusatzfeld, Leisten je Fechter, Einblender „TOUCHÉ“ | `buehneDuellStandText()` (`gefechtSieg`), `wertungVon` | 1 | 3 |
| 8 | Tennis | Bühne-Duell | Satzstand, Hawk-Eye, Siegchance im Ticker | Scorebug mit Sätzen/Spielen, Siegchance dauerhaft im Live-Stand-Band | `buehneDuellStandText()`, `tennisSiegchance()` | 1 | 3 |
| 9 | Speed-Schach | Bühne-Duell | Uhr, Vorteilsanzeige | Zusatzfeld Schachuhr, Leisten je Brett | `buehneDuellStandText()`, `schachUhrWert()` | 1 | 3 |
| 10 | Breaking | Bühne-Duell | Kettenleiste, Lebensbalken, Qual-Skala | Scorebug „noch N Kämpfer“, Leisten mit Qual-Skala, Einblender „GIBT AUF“ | `buehneDuellStandText()`, `wertungVon`, `feed(big)` | 1 | 3 |
| 11 | Eiskunstlauf | Bühne | Zwischenstand-Tafel (Leinwand) | Kopf mit Teamstand, Dock = Rangleiste der Läufer (wer läuft noch) | `#score`, `zeichneEisStand()`, `wertungVon` (summe) | 1 | 4 |
| 12 | Showcase | Bühne | X-Wand, Applaus-Meter, Jury | Kopf + Rangleiste der Acts | `#score`, `showcaseFuehrung()` | 1 | 4 |
| 13 | Gewichtheben | Bühne | Versuchstafel, Bedarfszeile | Kopf mit sichtbarer Summe je Team, Leisten kg bisher | `hebenSichtbareSumme()`, `hebenTeamLage()` | 1 | 4 |
| 14 | Wettessen | Bühne | Wendetafeln, Band „auf Kurs für N“ | Kopf mit Minute und Stand in der Tageseinheit, Leisten je Esser | `wettessenBugStandHtml()`, `wettessenMinuteText()`, `zeichneWettessenBand()` | 1 | 4 |
| 15 | I-Spy | Bühne | Zug-Uhr, Split-Tafel | Zusatzfeld Zug-Uhr, Leisten mit Funden/Sternen | `aktualisiereIspyHud()`, `ispyFuehrung()`, `wertungVon` | 1 | 4 |
| 16 | Staffel | Bahn | `#bahnHud` aktuell/nächster, Live-Abstand | Kopf mit Abstand im Zusatzfeld, Dock = Etappenleiste | `bahnTeamstand()`, `staffelZeitDelta()`, `staffelEtappenRaenge()` | 1,5 | 5 |
| 17 | Time-Trial | Bahn | Fokus-Panel, Zwischenzeiten, Höhenprofil | Kopf mit hochgerechnetem Stand, Dock = Rangleiste je Messpunkt (aus dem Live-Stand) | `bahnTeamstand()`, `bahnHochrechnung()`, `liveStandBahn()` | 1,5 | 5 |
| 18 | Spurt (klassisch/HYROX/Hatz) | Bahn | Streckenband, HYROX-Rangleiste, Fegearm | Kopf, Dock = Rangleiste mit Puste, Einblender Sturz/Einbruch | `bahnTeamstand()`, `bahnRangliste()`, `zeichneHyroxRangleiste()` | 1,5 | 5 |
| 19 | Climbing | Bahn | Höhe je Team, Balance-Ring | Kopf, Leisten mit Exe-Fortschritt | `bahnTeamstand()`, `WAND_EXE_INDIZES` | 1 | 5 |
| 20 | Takeshi | Bahn | Burgpunkte, „noch 12 im Rennen“ | Kopf mit Burgpunkten, Leisten mit Raus-Markierung | `bahnTeamstand()`, `x.raus` | 1 | 5 |

Summe rund **23 Tage** für die neunzehn offenen Profile.

### Roll-out-Wellen (Empfehlung)

| Welle | Disziplinen | Warum diese Reihenfolge | Tage |
|---|---|---|---:|
| 1 | Hockey, Football | Dasselbe Chassis wie Basketball: `fsZuege`, `wertungVon`, Uhr — fast nur Profil-Daten tauschen | 2,5 |
| 2 | TDM, Battlefield | Zweiter Chassis-Typ (Kampf): Verlauf aus `feed()`-kinds statt `fsZuege` (ein zweiter Verlauf-Adapter) | 2,5 |
| 3 | Fechten, Tennis, Speed-Schach, Breaking | Duell-Bühnen teilen `buehneDuellStandText()` | 4 |
| 4 | Eiskunstlauf, Showcase, Gewichtheben, Wettessen, I-Spy | Bühnen ohne Paarung: Dock als Rangleiste statt 6 + 6 (neue Dock-Variante) | 5 |
| 5 | Staffel, Time-Trial, Spurt, Climbing, Takeshi, Mini-DM | Bahnen haben 12+ Läufer und Pod-Fälle; Dock = Rangleiste, verzahnt mit dem Live-Stand | 8 |

Je Welle ein PR mit Fingerabdruck vorher/nachher (Soll unverändert), einem Chromium-Test nach dem Muster
`tests/hud-system-basketball.test.ts` (gezeigt = gebucht) und Bildern vorher/nachher.

## 4. Abnahme dieses Schritts

- Fingerabdruck `node scripts/pruefe-wertung-fingerabdruck.mjs`: **GESAMT d09e10bb872c** vorher und nachher.
- `tests/hud-system-basketball.test.ts` (Chromium, Job `arena-chromium-tests`, im Shard-Lauf ausgeschlossen):
  Profile (1 fertig, 19 Skelett), Hockey behält das alte HUD, keine Battlefield-KP-Zeile nach dem
  Wechsel, Host-Safe-Area, Basketball-Komponenten sichtbar und altes
  HUD ausgeblendet, gezeigt = gebucht im laufenden Spiel und am Ende, Klick/Taste/Filter/Tempo, Schalter,
  Phone 390 px ohne Überlauf mit Karte als Blatt, keine Seitenfehler.

## 5. Was als Nächstes kommt (Basketball)

| Schritt | Inhalt | Tage |
|---|---|---:|
| B | Klick auf die Figur öffnet die Karte (Bauteil 9), Viertelpause mit Boxscore und Führungsverlauf (14, 15) | 2 |
| C | Kamera Überblick / Ball / Spieler (13) | 2 |
| D | Prognose im Band, Tafel-Reiter je Viertel (5, 6) — erst nach der Kalibrier-Messreihe | 3,5 |
| E | Teamfouls je Viertel als reine Anzeige (2); die Bonus-Regel wäre eine Wertungsänderung | 0,5 |

## 6. Offene Fragen an Chris

1. **Zahlenschrift Barlow Condensed im HUD?** Der Prototyp, den du freigegeben hast, trägt sie; deine
   Vorgabe vom 30.09. sagt „nur RaniraSeason“. Eingebaut ist Barlow jetzt nur in den HUD-Bauteilen
   (Zahlen, Etiketten); Namen und Schlagworte bleiben RaniraSeason. Empfehlung: so lassen — die schmale
   Grotesk mit festen Ziffernbreiten ist es, was die Anzeige nach Sport-Grafik aussehen lässt.
2. **Schussuhr nur noch im Scorebug?** Heute steht sie zweimal (Scorebug und Ziffernbox auf dem Feld,
   die PR #1562 gerade mit einem Rahmen versieht). Empfehlung: nach dem Merge von #1562 entscheiden.
3. **Roll-out-Reihenfolge** wie in Abschnitt 3? Empfehlung: Welle 1 (Hockey, Football) als Nächstes.

# Spielmodus „Spielen" — Layoutvorschlag für den 15-Zoll-Schirm

Stand 13.10. Chris' Rückmeldung zum ersten Wurf: „ziemlich gut", aber „die Auswahlmöglichkeiten
unten noch besser gliedern, so sieht es noch etwas wild aus" und „das Layout hat sicher noch
Verbesserungspotential". Dazu geplant: Log, Zeitanzeige mit Antreibern, Inventar je Held.

Grundlage: die Bildschirmfotos von Map 1 und 2 (1470 × 830), `apps/kartenschmiede/spiel.js`,
die `.sp-*`-Regeln in `apps/kartenschmiede/seite.html` und das Konzept
`docs/design/moosgrab-spielmodus-konzept.md`. Dieses Papier ändert keinen Code.

## 1. Was heute stört (aus den Fotos)

| Befund | Wo | Foto |
|---|---|---|
| 13 Ereignisknöpfe in drei Zeilen, ohne Ordnung: Suchmarker, Wege hinein, Lärm, Glockenseil stehen gemischt; die dritte Zeile ist abgeschnitten (`max-height: 118px`, Scroll). | `.sp-evs` | m2-draussen-laerm |
| „Weiter" springt: mal rechts oben, mal rechts unten, mal fehlt es; „Zurück" wandert mit. Die Rundenknöpfe sind ein 2-Zeilen-Grid, das sich je nach Anzahl umsortiert. | `.sp-runden` | m1-probe-5 vs. m1-rundenwurf vs. m2-Was-sagen |
| Die Schrittkarte eines `spieler`-Schritts ist eine Wand aus 5 Regie-Bullets in 19 px Serif — dieselben Fakten, die unten schon als Knöpfe stehen („Taste 4", „H (+1 Lärm)"). | `schrittInhalt` → `liste(s.hinweise)` | m2-draussen-laerm, m1-probe-5 |
| „Gerade passiert" (das Wichtigste des Moments) steht **unter** der Bullet-Wand und wird abgeschnitten; man scrollt nach unten, um den Wurf einzutragen. | `letzteEreignisse()` | m2-draussen-laerm |
| Die Tischkarte frisst 380 px Höhe (46 vh); für Gegner bleiben 230 px, die dritte Karte ist angeschnitten. | `.sp-tischkarte svg` | m1-wahl-aufbluehen |
| NPC-Fenster ist ein Modal über allem — aber die Fragen an Hedda sind Aktionsknöpfe **unter** dem Modal. Links ein 9-Zeilen-Fließtext „wer sie ist", der im Spiel nie gelesen wird. | `fensterHtml` npc, `.sp-fenster-innen.breit` | m2-hedda-npc |
| Wahlkarten: „Folge" steht als grauer Kleindruck mit Flag-Namen und Leistenänderungen in einem Satz. Was zählt (Geduld −1, Map 3), ist nicht abhebbar. | `.sp-option em` | m2-Was-sagen |
| Meldungen (`spMsg`) stehen im Fuß der Schrittkarte, dort, wo gerade nicht hingeschaut wird. | `.sp-msg` | m1-rundenwurf |
| Kopfleiste: fünf Pillen plus drei Knöpfe, die Leisten ändern sich ohne sichtbaren Impuls. „Vollbild" braucht keinen Dauerplatz. | `zeigeKopf` | alle |

## 2. Recherche: Muster aus Spielleiter- und Regie-Oberflächen

| Vorbild | Belegtes Muster | Was wir übernehmen |
|---|---|---|
| **QLab** (Theater-Cue-Software) | Ein großer GO-Knopf, Leertaste feuert den nächsten Cue; „Standby" zeigt immer, was als Nächstes kommt; Show-Modus sperrt das Bearbeiten und reduziert die Oberfläche ([Wikipedia](https://en.wikipedia.org/wiki/QLab), [IATSE-Handout QLab 5](https://training.iatselocal720.org/wp-content/uploads/sites/3/2024/04/Q-Lab-5.pdf)). | „Weiter" an **einer** festen Stelle, immer gleich groß; „Als Nächstes: …" als Standby-Zeile direkt daneben; Edit-Dinge (MP3 hochladen) raus aus dem Spielbild. |
| **Gloomhaven Secretariat** | Rundenzähler und „Nächste Runde" sitzen zusammen im Fuß links; Figuren als Reihen mit Standee-Nummer, Tipp öffnet HP/Zustände; Tab springt zur nächsten Figur; Bestätigung vor Rundenende ist Standard; fast alles Optionale ist per Voreinstellung aus ([Hilfe](https://help.gloomhaven-secretariat.de/)). | Rundenknöpfe gehören zur Navigation, nicht zu den Ereignissen; Tab + / − bleibt; Gegnerzeile einzeilig, Details per Klick. |
| **Foundry VTT, Combat Tracker** | Pro Zeile: Bild, Name, Initiative, optional eine Ressource; Zustände „hidden" und „defeated" (ausgegraut, Schädel); Tracker als abdockbares Fenster ([Doku](https://foundryvtt.com/article/combat/)). Carousel-Tracker legen die Kämpfer als **horizontale Portraitreihe** über die Karte ([Combat Tracker Dock](https://foundryvtt.com/packages/combat-tracker-dock), [Glyph & Grok](https://glyphngrok.substack.com/p/essential-add-on-modules-for-foundry)). | Gefallene bleiben ausgegraut in der Liste, bis „vom Tisch"; Helden als schmale Chipreihe (Carousel-Idee) statt eigener Karten. |
| **Owlbear Rodeo 2** | Ein Dock unten für alles, was man „in die Szene zieht"; Erweiterungen haben einen festen Platz in einer Aktionsleiste oben links, Bubbles docken an Bildschirmkanten; das Dock startet nur aufgeklappt, wenn noch nichts geladen ist ([2.2 Release Notes](https://blog.owlbear.rodeo/owlbear-rodeo-2-2-release-notes/), [Beta Patch 10](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-beta-patch-10/)). | Feste Plätze: Aktionen unten, Nachschlagen (Lage, Log) oben rechts, nie beides vermischt. Schubladen statt Modals, wo die Aktionen unten weiter gebraucht werden. |
| **Alchemy RPG** | Szenen-Panel zum Vorbereiten; Szenen-Notizen erscheinen im „Story Panel" des GM während des Spiels; Journal (Verlauf) und Notizen oben links als „aktivstes Panel" ([GM-Orientierung](https://help.alchemyrpg.com/en/articles/9714185-gamemaster-orientation), [Spieler-Orientierung](https://help.alchemyrpg.com/en/articles/9821384-player-orientation)). | Regie-Notizen gehören an den Schritt, der Verlauf in ein immer erreichbares Panel. |
| **Roll20** | Handouts mit getrennten „GM notes", die nur der GM sieht; Turn Tracker absichtlich nicht automatisiert ([Handout-Wiki](https://wiki.roll20.net/Handout), [Turn Tracker](https://help.roll20.net/hc/articles/360039178634)). | Unsere Trennung Vorlesen / Nur für dich bleibt — aber mit weniger Registern pro Schritt. |
| **Mansions of Madness 2e** | „End Phase" sitzt immer unten rechts; die App tippt sich durch die Mythos-Schritte ([Fan-Regelzusammenfassung](https://www.orderofgamers.com/downloads/MansionsofMadness2ndEd_v1.pdf), [Board Game Quest](https://www.boardgamequest.com/mansions-of-madness-review/)). Kritik: Spieler teilen die Aufmerksamkeit zwischen Schirm und Tisch ([There Will Be Games zu JiME](https://therewillbe.games/articles-boardgame-reviews/8905-lord-of-the-rings-journeys-in-middle-earth-should-have-stayed-an-app)). | Phasenknopf fest unten rechts. Was Chris am Tisch sagt, muss er in einem Blick lesen können — große Sätze, nicht Absätze. |
| **Sly Flourish, Lazy GM** | Eine Seite Prep, zwei Spalten; „secrets and clues" als Ein-Satz-Liste ohne festen Ort; Uhr im Blick, Blöcke von 45–60 Minuten, lieber in der Mitte kürzen als spät enden ([One page prep](https://slyflourish.com/one_page_prep_notes.html), [Watch the time](https://slyflourish.com/watch_the_time.html), [Timing sessions](https://slyflourish.com/timing_sessions.html)). | Zeit je Schritt als Soll/Ist; Antreiber = die „Kürzungen aus der Mitte", die man vorher aufschreibt. |
| **GM-Screen-Praxis** (The Alexandrian) | Querformat; persistente Referenz an **immer derselben Stelle**, damit die Hand ohne Hinsehen hingreift; 75 % eines Kaufschirms sind Füllmaterial ([Alexandrian](https://thealexandrian.net/?p=38265), [Gnome Stew](https://gnomestew.com/gming-screens-what-are-they-good-for/)). | Zonen nie verschieben; was nicht dauernd gebraucht wird, raus aus dem Dauerbild. |
| **NPC-Karten** (Universal NPC Sheet, NPC Ledger, Inkwell) | Stimme + Manierismen (3 + 2), Ziele, „Leverage" (wie reagiert er auf Drängen), konkrete Tells statt Akzent, Tracker „was die Spieler glauben" ([Universal NPC Sheet](https://herringthered.itch.io/univeresal-npc-sheet), [NPC Ledger](https://bagquest.itch.io/the-npc-ledger), [Inkwell](https://inkwellideas.com/2023/09/anatomy-of-an-npc-portraits-deck-card/)). | NPC-Fenster in vier Felder: So spricht sie · Kernsätze · Weiß (herauskitzeln) · Weiß nicht. |
| **Ink / Inky** (inkle) | Choices stehen als kurze Liste unter dem Text, der Verlauf bleibt sichtbar; Preview behält frühere Wahlen ([inkle/inky](https://github.com/inkle/inky), [Tutorial](https://pressbooks.library.torontomu.ca/playablestoriesink/chapter/chapter-1/)). | Vorlesetext oben, Wahlen darunter; getroffene Wahlen bleiben im Log mit Folgen sichtbar. |
| **Progressive Disclosure** (NN/g, Nielsen) | Zwei Ebenen, nicht mehr; Teilung nach Häufigkeit, nicht nach Meinung; „ein Klick ist billig, Verwirrung teuer"; versteckte Warnungen sind das Teuerste; Türen ehrlich beschriften („3 weitere Fragen", nicht „Mehr…") ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/), [Nielsen Substack](https://jakobnielsenphd.substack.com/p/progressive-disclosure), [LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases)). | Aktionsleiste: Gruppen sichtbar, Überlauf je Gruppe als Aufklapper mit Zahl; „Gilt jetzt" bleibt sichtbar (Warnung!). |
| **Toolbar-Gruppierung** (PatternFly, Maersk DS) | Verwandte Knöpfe zusammen, Trenner dazwischen; Icon-Gruppen höchstens zwei sichtbar, Rest in Überlauf ([PatternFly](https://patternfly.org/components/toolbar/design-guidelines), [Maersk](https://designsystem.maersk.com/components/toolbar)). | Gruppenkästen mit Beschriftung links, gemeinsamer Hintergrund. |
| **Command Palette** (Linear, Vercel) | Tastenkürzel neben jeder Aktion anzeigen, damit man sie lernt; Palette ersetzt sichtbare Navigation nicht ([SaaS UI](https://www.saasui.design/blog/saas-keyboard-shortcuts-ux-patterns), [Solomon](https://solomon.io/designing-command-palettes/)). | `kbd` bleibt an jedem Knopf. Keine Palette — bei 13 Knöpfen reicht Gruppierung. |
| **Activity Feeds / Audit Logs** | Zeile = Akteur · Verb · Objekt · Vorher→Nachher · Zeit; wichtige Ereignisse (Statuswechsel) vorn, Routine einklappen; Tagestrenner; System- und Menschenaktionen unterscheiden ([SaaS UI](https://www.saasui.design/blog/saas-activity-feed-audit-log-ux-patterns), [getstream](https://getstream.io/blog/activity-feed-design/)). | Log-Zeile: `R2 · 20:14 · Lärm 1→2 · Nahkampf (L)`; Wahl, Leiste, Gegner gefallen, Rundenende als eigene Typen mit Farbe. |
| **Zeit am Tisch** | Es gibt Timer-Module (Foundry Simple Timer, TOT Progress Clock), aber kein Werkzeug, das bei zähen Szenen von selbst Antreiber einblendet ([Simple Timer](https://foundryvtt.com/packages/simple-timer), [TOT](https://chromewebstore.google.com/detail/fockjjekklkcnfgfjdgjobacahhhimke)). | Eigenbau: Soll-Minuten je Schritt, Antreiber als Vorschlag, nie automatisch angewandt. |

Nicht belegbar: QLab-Doku (`qlab.app/docs`) und Improved-Initiative-Startseite lieferten keine
Layoutbeschreibung (404 bzw. nur Feature-Liste); Descent/JiME-App-Screens gibt es nur als
Rezensionen ohne UI-Details. Mansions-„End Phase unten rechts" stammt aus einer Fan-PDF.

## 3. Der Vorschlag: Zonen auf 1470 × 830

Drei Regeln, aus der Recherche abgeleitet:

1. **Jede Zone hat einen festen Platz und einen festen Zweck.** Oben: Zustand (Leisten, Zeit).
   Links: was jetzt gesagt und getan wird. Rechts: Tisch und Gegner. Unten: was Chris auslösen
   kann. Nachschlagen (Lage, Log, NPC) kommt als **Schublade**, nicht als Modal, und deckt nie
   die Aktionsleiste ab.
2. **Zwei Ebenen, nicht drei.** Alles, was jede Runde gebraucht wird, ist sichtbar. Alles andere
   ist genau einen Klick (eine Taste) entfernt und ehrlich beschriftet.
3. **Drei Textregister, klar getrennt:** Vorlesen (Serif kursiv 24 px, Messingbalken — bleibt),
   Ansagen (`sp-sag`, 17 px, Sprechblase — bleibt), Regie (UI-Sans 17 px, grau, „Nur für dich" —
   bleibt, aber **gekürzt und gerastert**). Spielerhandlung („Die Spieler erkunden den Friedhof")
   ist ein Satz in 21 px, nicht fünf Bullets.

### 3.1 Raster

```
1470 px
┌───────────────────────────────────────────────────────────────────────────────────────┐ 52
│ MOOSGRAB·MAP 2   [Runde 1] [Atemzug ▮▮▮░░░ 3] [Lärm ▮▮░░ 2] [Geduld ▮▮▮▮ 4] [Gegner ruhig]  │
│ Die Kapelle · 17/61                                   ⏱ 06:40 / ~8   Abend 1:12  [Lage L] [Log P] [Menü] │
├─────────────────────────────────────────────────────────┬─────────────────────────────┤
│ SCHRITTKARTE  958 px (Typfarbe als 8-px-Balken links)   │ SEITE  500 px               │
│                                                         │ ┌─────────────────────────┐ │
│ ▮ SPIELER SIND DRAN                                     │ │ Tischkarte  ≤ 300 px    │ │
│ Draußen                                       (36 px)   │ │  (Figuren, Marker)      │ │
│ Die Spieler erkunden den Friedhof. Du zählst Lärm.      │ └─────────────────────────┘ │
│                                                         │ [Sc 🧪1] [Kr] [Wa 🗝] [Kl]   36 │ 690
│ ┌ GERADE PASSIERT ──────────────────────────────┐       │ ▲ GILT JETZT (3)  ≤ 110 px   │
│ │ Suchmarker 1 · „Unter der Linde …"  🎲 Wurf 6 │       │  Die Gemeinde kniet …       │
│ │ AB 3 „…"                                      │       │ GEGNER                      │
│ └───────────────────────────────────────────────┘       │ S1 Sporenling ☠ ▮▮░ +1 +2 −1│
│ ▸ ANTREIBER (nach 150 % der Zeit, sonst unsichtbar)     │    angekratzt „Es zuckt …" │
│ ▸ REGIE (4)  — eingeklappt nach dem ersten Besuch       │ SZ1 Sporenling (zäh) …      │
│ ─────────────────────────────────────────────────────── │ S2 …                        │
│ Zuletzt: R1 · Lärm 1→2 · Nahkampf   ·   Als Nächstes: … │ (scrollt)                   │
├─────────────────────────────────────────────────────────┴─────────────────────────────┤
│ UNTERSUCHEN [1 Marker 1 ✓][2 Marker 2][3 Grab][5 Fenster][6 Turm]  WEGE HINEIN [H Tür][E Fenster][K Sakristei]  LÄRM 2 [L Nah +1][Z Fern +2][T Tür +2]  SONST [4 Neben Grab][G Seil] │ 88
│ ⓘ Meldung / Toast                                                   [🎲 Flüstert? W] [Runde beenden R] [← Zurück ⌫] [ WEITER → Leertaste ] │
└───────────────────────────────────────────────────────────────────────────────────────┘
         52 + 690 + 88 = 830
```

Immer sichtbar: Kopfleiste, Schrittkarte, Tischkarte, Heldenchips, „Gilt jetzt", Gegner,
Aktionsleiste. In Schubladen: Lage (L), Log (P), NPC (N), Gegnerkarte (Klick „Karte"),
Inventar (Klick auf Heldenchip). Schubladen schieben sich **über die Schrittkarte** (links) oder
**über die Seite** (rechts), nie über die Aktionsleiste.

### 3.2 Kopfleiste (52 px, `zeigeKopf`, `.sp-oben`)

- Links Titel wie heute. Mitte die Leisten als Pillen — **mit Impuls bei Änderung**: die Pille
  blitzt 600 ms in Typfarbe auf (rot bei +, grün bei −) und zeigt 3 s ein „↑1". Heute ändert sich
  nur ein Kästchen, das übersieht man.
- Neu: **Zeitpille** `⏱ 06:40 / ~8` (Ist / Soll des Schritts), dahinter `Abend 1:12`. Farbe:
  normal grau, ab 100 % Soll messing, ab 150 % orange und pulsierend (vorhandene `sp-puls`).
- Rechts nur **Lage (L)**, **Log (P)**, **Menü**. Vollbild wandert ins Menü (einmal pro Abend).
- Audio-Pille („♪ 01B-2 ■ Stopp S") bleibt, lila wie heute.

### 3.3 Schrittkarte (958 px, `.sp-karte`, `schrittInhalt`, `letzteEreignisse`)

Reihenfolge von oben, so dass das Wichtigste nie unter den Falz rutscht:

1. Typetikett + Titel (bleibt).
2. **Vorlesetext** oder der eine Satz Spielerhandlung (`sp-text`, 21 px).
3. **Gerade passiert** — direkt unter dem Satz, **neueste zuerst**, höchstens zwei Einträge
   aufgeklappt; ältere werden zu einer Zeile „+2 frühere" und wandern ins Log. Eine offene Probe
   (Würfelknöpfe 1–6) steht so immer im Blick.
4. **Antreiber** (nur ab 150 % Sollzeit): Kasten in Orange, 2–3 Vorschläge aus dem JSON des
   Schritts oder der Map-Standardliste, jeder mit Knopf („Lärm +1: die Gemeinde hebt den Kopf",
   „Hedda: ‚Ihr habt nicht ewig.'", „Gegner wütend ab jetzt"). Kein Automatismus; Taste `X` blendet
   aus. Antreiber, die eine Leiste ändern, schreiben ins Log.
5. **Regie** — die heutigen `hinweise` als zweispaltiges „Wenn → dann"-Raster (17 px UI-Sans,
   „Held überschreitet die Tischmitte → **M**"), nach dem ersten Besuch des Schritts eingeklappt
   auf eine Zeile „▸ Regie (4)". Was bereits ein Knopf unten ist, gehört **nicht** in die Regie —
   Map 2 „Draußen" schrumpft so von 5 Bullets auf 2 Zeilen.
6. Fuß: **Zuletzt**-Zeile (letzter Logeintrag, Klick öffnet Log) + **Als Nächstes** (Standby wie
   bei QLab). `spMsg` zieht hier aus (siehe 3.6).

Bei `kampf` bleibt die Verhaltenstabelle, rückt aber unter „Gerade passiert". Bei `aufbau` ohne
Seite bleibt das heutige Zweispalten-Layout mit großer Karte — das funktioniert.

### 3.4 Entscheidungen mit bis zu 4 Antworten (`schrittInhalt` wahl, `.sp-optionen`, `.sp-option`)

Das 2 × 2-Raster ist richtig; vier Dinge dazu:

- **Spalten nach Anzahl:** 1–2 Optionen einspaltig (volle Breite), 3–4 zweispaltig. Heute läuft
  `auto-fit` und macht aus 3 Optionen 2 + 1 mit Lücke.
- **Karte in drei Zeilen:** große Ziffer (44 px Kasten, Typfarbe rot) · **kurz** fett 20 px ·
  **text** („was die Spieler etwa sagen") 17 px normal, in Anführungsstrichen, nicht kursiv (kursiv
  ist Vorlesen).
- **Folgen als Pillen, nicht als Satz:** `Geduld −1` (rot), `Geduld +1` (grün), `Map 3: Brunnen`
  (lila), `Anhänger weg` (grau), `Flag frau_name` nur als Tooltip. Der Rest des Folgetexts steht
  als Tooltip/Titel. Dazu braucht `optionen[]` ein strukturiertes `folgen: [{leiste, delta} |
  {map, text} | {text}]` — `folge` als Fließtext bleibt Rückfall.
- Die Anleitung („Wähle, was dem am nächsten kommt") steht **über** den Karten, einmal, 17 px grau;
  der Fuß wiederholt sie nicht. Nach der Wahl bleibt die gewählte Karte 400 ms grün umrandet,
  bevor der nächste Schritt kommt, und das Log schreibt `Wahl: 1 · Die Wahrheit · Geduld −1`.
- Eine fünfte Zeile „Keins passt — eigenes (5)" nur, wenn `eingabe` erlaubt ist.

### 3.5 Aktionsleiste (88 px, zwei feste Zeilen, `aktionsLeiste`, `.sp-unten`, `.sp-evs`, `.sp-runden`)

**Zeile 1 — Ereignisse in Gruppen.** Jede Gruppe ist ein Kasten mit Beschriftung links in
Kapitälchen (13 px, dim) und gemeinsamem Hintergrund (`var(--bg)`), 8 px Abstand zwischen Gruppen,
4 px innerhalb. Feste Reihenfolge, feste Farbe des Beschriftungstexts:

| Gruppe | Farbe | Enthält (Map 1/2) | Zuordnung |
|---|---|---|---|
| **Untersuchen** | gelb `#e8c63a` | Suchmarker 1–3, Grab, Fenster spähen, Turm, Gesicht, Hinhören, Kerze, Altar, Krypta | `ereignis.marker` oder `probe` oder `gruppe:"untersuchen"` |
| **Bewegen** | blau `#4f8fe8` | Tischmitte (M), Held erreicht die Frau (F), neben dem Grab (4) | `gruppe:"bewegen"` |
| **Wege** | blau | Haupttür H, Fenster E, Sakristei K | `gruppe:"wege"` (Name „Durch … hinein" als Rückfall) |
| **Lärm** | orange `#f08a2a` | Nah L, Fern Z, Tür T — Beschriftung zeigt den Stand: „LÄRM 2" | `ereignis.leisten.laerm` oder Name „Lärm:" |
| **Kampf** | orange | Glockenseil G, Welle, Quelle | `gruppe:"kampf"` |
| **Fragen** | messing | Frage 1–0 an Hedda, „noch eine Frage Q" | Name „Frage:" oder `gruppe:"fragen"` |
| **Story** | lila | Anhänger geben, Flüstern | Rest |

Das JSON bekommt ein optionales Feld `gruppe` je Ereignis; `aktionsLeiste` fällt auf die
Heuristik rechts zurück. Leere Gruppen werden nicht gezeichnet. Erledigte Knöpfe (✓, grün) bleiben
in ihrer Gruppe, rutschen aber ans Gruppenende. Gesperrte (`aus`) bleiben sichtbar, 40 %.

**Überlauf.** Zeile 1 ist **eine** Zeile, kein Scroll. Passt eine Gruppe nicht, zeigt sie ihre
ersten n Knöpfe und einen Aufklapper **„▴ 3 weitere"** (Drop-up nach oben, über die Schrittkarte;
Esc schließt; Tasten wirken auch bei zugeklapptem Menü). Reihenfolge der Kürzung: Story → Fragen
→ Untersuchen (erledigte zuerst). Rechnung für Map 2 „Draußen" (13 Knöpfe, 4 Gruppen): mit
`kurz`-Namen („Marker 1", „Tür H", „Nah +1") brauchen 13 Knöpfe ≈ 13 × 92 + 4 × 90 Beschriftung =
1560 px — das ist 120 px zu viel, also Untersuchen zeigt 4 + „▴ 2 weitere". Hedda (14 Fragen):
Fragen zeigt 6 + „▴ 8 weitere" — **oder besser**: im NPC-Schritt wandern die Fragen in die
NPC-Schublade (3.7), und unten bleiben nur Anhänger, Q und die Navigation.

**Zeile 2 — Navigation, immer gleich.** Links der Toast-Platz (3.6). Rechts, in dieser Reihenfolge
und nie umsortiert: `[🎲 Rundenwurf W]` (nur wenn es ihn gibt, pulsierend wenn fällig) ·
`[Runde beenden R]` · `[← Zurück ⌫]` · `[WEITER → Leertaste]`. „Weiter" ist der GO-Knopf: 190 px
breit, messing gefüllt, **immer ganz rechts unten**, auch wenn er gerade gesperrt ist (dann
Ghost, Tooltip „Der Kampf läuft noch"). Bei `wahl` steht dort `[Antwort 1–4 wählen]` ausgegraut,
damit der Platz nie leer ist.

**Tastenkürzel.** Bleiben wie heute (Ziffern, Buchstaben je Ereignis, R/W/L/N/A/S, Tab, +/−/*).
Neu: `P` Log, `X` Antreiber ausblenden, `I` Inventar des markierten Helden. Die `kbd`-Kästchen
stehen weiter **vor** dem Namen (so lernt man sie); in Gruppen mit nur Ziffern reicht die Ziffer
als Kasten, der Name dahinter.

### 3.6 Meldungen

`melde()` schreibt in einen **Toast links in Zeile 2** der Aktionsleiste (statt in den Fuß der
Schrittkarte): 15 px, blendet nach 6 s aus, Fehler (Speichern, Audio) bleiben stehen bis zum
nächsten Klick. Rundenende-Texte („Sporenuhr 3 → 2") erscheinen zusätzlich als Logzeile.

### 3.7 NPC-Fenster → NPC-Schublade (`fensterHtml` npc, `.sp-fenster-innen.breit`, `.sp-npc-raster`)

Schiebt sich **über die Schrittkarte** (958 px breit, volle Höhe der Mitte), Seite und
Aktionsleiste bleiben sichtbar und bedienbar. Kopf: Name, Geduld-Pille (bei Hedda), Schließen Esc.
Vier Felder, 2 × 2, nichts scrollt:

```
┌ MUTTER HEDDA                          Geduld ▮▮▮▮ 4                 [Schließen Esc] ┐
│ SO SPRICHT SIE                          │ SÄTZE, DIE IMMER KOMMEN                   │
│ • leise, kurze Sätze, keine Rückfragen  │ „Sagt keine Namen." …                     │
│ • Kerze zwischen sich und den Helden,   │ „Es fing mit dem Brunnen an." …           │
│   Messer in der Hand                    │ „Das Dorf ist nicht leer." …              │
│ • sagt nie „Lene", nur „das Kind"       │ „Das weiß der Brunnen."                   │
│ WILL JETZT: wo ist Lene · keine Namen · │                                           │
│ schickt sie zum Brunnen                 │                                           │
├─────────────────────────────────────────┼───────────────────────────────────────────┤
│ WAS SIE WEISS — herauskitzeln           │ WAS SIE NICHT WEISS                       │
│ [3] das Dorf      → „Hinter Riegeln …"  │ • was unten atmet                         │
│ [4] der Brunnen   → …                   │ • wer die Männer in den Rüstungen waren   │
│ [5] der Stern     → …           ✓       │ • wie man den Pilz aufhält                │
│ [7] keine Namen   → …                   │ • dass Lene sie noch einmal erwähnt hat   │
│ ▸ Wer sie ist (ein Satz; Klick: ganzer Text)                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **So spricht sie**: `stimme` wird zu 3 Bullets (Stimme, Körper, Tell) — das ist das 3 + 2-Muster
  der NPC-Sheets; das JSON darf `stimme` als Array liefern, String bleibt Rückfall. Darunter
  `ziel` als eine Zeile „Will jetzt".
- **Kernsätze**: wie heute (`vorlesen`), 21 px, höchstens 4 sichtbar.
- **Weiß — herauskitzeln**: die `frage-*`-Ereignisse des Schritts **als Knöpfe in der Schublade**
  (Taste + Thema + Antwort-Anfang als Vorschau, ✓ wenn gestellt, ausgegraut wenn Geduld leer).
  Das ersetzt 14 Knöpfe in der Aktionsleiste; `wennSieFragen` ohne Ereignis bleibt als Tabelle
  darunter.
- **Weiß nicht**: `nichtWissen`, grau, 15 px.
- `wer` (der Fließtext) ist eine aufklappbare Zeile ganz unten. Vor dem Spiel liest man ihn in der
  Vorbereitung, nicht in der Szene.

### 3.8 Seite rechts (500 px, `.sp-seite`, `tischKarte`, `gegnerListe`, `aktiveRegeln`)

- **Tischkarte** `max-height: 300px` (statt 46 vh). Der Tisch ist quadratisch, 300 px reichen zum
  Anklicken; wer mehr braucht, klickt das Lupensymbol → Karte groß als Schublade über der
  Schrittkarte (dieselbe `gross`-Darstellung wie im Aufbau).
- **Heldenchips** (neu, 36 px): `[Sc 🧪1] [Kr] [Wa 🗝] [Kl]` — Name, Sporenpunkte als kleine
  Zahl, Beute als Symbol mit Anzahl. Klick (oder `I` bei markiertem Helden) öffnet das
  **Inventar-Popup** wie das Gegner-Popup: Liste der Gegenstände, `+ Gegenstand` (Freitext oder
  aus `map.beute`), `× verbraucht`. Der **Beutewurf** bekommt nach dem Wurf eine Zeile
  „An: [Sc] [Kr] [Wa] [Kl]" — ein Klick, Eintrag im Inventar und im Log. Datenmodell:
  `stand.helden[name].inventar[]` neben `sporenpunkte`; läuft über `uebernahme` in die nächste Map.
- **Gilt jetzt** bleibt sichtbar (versteckte Warnungen sind das Teuerste), aber als Kasten mit
  Kopfzeile „▲ GILT JETZT (3)" und max. 110 px; jede Regel eine Zeile `**Titel** erster Satz…`,
  Klick klappt die Regel auf. Heute 26 vh.
- **Gegner**: eine Zeile je Gegner — Kürzel-Token, Name, Schädel, Wundbalken, `+1 +2 −1` (44 px
  hoch, wie das Konzept schon forderte; heute `.btn.sm` ≈ 30 px). Die Zustandszeile darunter nur
  als farbiges Etikett (`UNVERLETZT` grün, `ANGEKRATZT` gelb, `VERWUNDET` orange, `AM ENDE` rot)
  plus Sprechsatz; der Satz wird beim Zustandswechsel 1 s hervorgehoben, weil Chris ihn **jetzt**
  sagen soll. Markierter Gegner (Tab) bekommt einen Messingrahmen und zeigt „Bedrohung ansagen"
  wie heute.

### 3.9 Log-Schublade (`P`, neu `sp-log`; Daten `stand.protokoll` gibt es schon)

Schiebt sich **über die Seite** (500 px). Neueste oben, Trenner je Runde („Runde 2", „Runde 1",
„Vor dem Spiel"). Zeile: `20:14 · Lärm 1→2 · Nahkampf (L)`. Typen mit Farbe am linken Rand:
Wahl (rot), Leiste (Typfarbe der Leiste), Gegner gefallen (rot, Schädel), Rundenende (messing),
Ereignis (gelb), Antreiber (orange), Beute (grün), Undo (grau, durchgestrichen: „↶ zurück: …").
Filterchips oben: Alle · Wahlen · Leisten · Kampf. Fuß: „Abend als Text kopieren". Der Motor
muss zusätzlich **Leistenänderungen** und **Beute** protokollieren — heute stehen nur Schritte,
Wahlen und Schäden im Protokoll (`.sp-protokoll` im Lage-Fenster, 14 Zeilen). Das Lage-Fenster
verliert den Protokollabschnitt.

### 3.10 Zeit und Antreiber (Daten)

- `schritt.dauer` (Minuten, optional). Standard je Typ: vorlesen 1, cue 1, regel 2, wahl 3,
  npc 6, spieler 8, kampf 15, aufbau 5.
- `stand.schrittSeit` (Zeitstempel beim Betreten, Undo setzt zurück), `stand.abendSeit`.
- `schritt.antreiber[]` oder `map.antreiber[]` als Rückfall: `{text, taste?, leisten?, ereignis?}`.
  Beispiele Map 2 draußen: „Ein Knieender dreht den Kopf — Lärm +1", „Die Glocke schlägt von
  allein einmal", „Hedda ruft aus der Krypta". Map 1: „Die Sporenuhr tickt hörbar: −1 ohne Runde".
- Zeitpille im Kopf (3.2), Antreiber-Kasten in der Schrittkarte (3.3). Der Abend-Zähler hilft bei
  der 2,5-Stunden-Planung aus dem Konzept (Abschnitt 8, „Später").

### 3.11 Farben und Typo (nur Ergänzung)

Dunkler Stil, Messing, Typfarben bleiben. Neu festgelegt: Gruppenbeschriftungen in der
Aktionsleiste tragen die Typfarbe ihrer Gruppe (gelb/blau/orange/messing/lila); Folge-Pillen
rot/grün für Leisten −/+, lila für „spätere Map"; Zustandsetiketten grün/gelb/orange/rot;
Zeitpille grau → messing → orange. Keine neue Schrift, keine neuen Grautöne.

## 4. Prioritäten: die zwölf Änderungen mit dem größten Nutzen

| # | So heute → so neu | Betroffen |
|---|---|---|
| 1 | 13 Knöpfe in drei Scrollzeilen → **eine Zeile mit Gruppenkästen** (Untersuchen · Bewegen · Wege · Lärm · Kampf · Fragen · Story), Überlauf als „▴ n weitere". JSON-Feld `gruppe`, Heuristik als Rückfall. | `aktionsLeiste()`, `.sp-evs`, `.sp-unten`; `map*.json` `ereignisse` |
| 2 | Navigation sortiert sich um, „Weiter" springt → **feste zweite Zeile**, Reihenfolge W · R · ⌫ · Weiter, Weiter immer rechts unten (auch gesperrt oder als „Antwort wählen"). | `aktionsLeiste()`, `.sp-runden`, `.btn.weiter` |
| 3 | Fragen an Hedda = 14 Knöpfe unten unter einem Modal → **NPC-Schublade über der Schrittkarte** mit vier Feldern, Fragen als Knöpfe im Feld „Weiß — herauskitzeln", Geduld im Kopf. | `fensterHtml()` npc, `.sp-fenster-innen.breit` → `.sp-schublade`, `.sp-npc-raster`; `figuren.stimme` als Array |
| 4 | „Gerade passiert" unter der Bullet-Wand → **direkt unter dem Spielersatz**, neueste zuerst, max. 2 offen. | `zeige()` Reihenfolge, `letzteEreignisse()`, `.sp-letzte` |
| 5 | 5 Regie-Bullets in Serif → **„Wenn → dann"-Raster** in UI-Sans, eingeklappt nach dem ersten Besuch; was ein Knopf ist, steht nicht mehr doppelt. | `schrittInhalt()` spieler/kampf, `.sp-hinweise`; `hinweise` in `map*.json` kürzen |
| 6 | Kein Log → **Log-Schublade (P)** über der Seite mit Rundentrennern, Typfarben, Filter; „Zuletzt"-Zeile im Fuß der Schrittkarte. Motor protokolliert auch Leisten und Beute. | neu `sp-log`, `fensterHtml()`, `.sp-karte > footer`; `spiel-motor.js` `protokoll` |
| 7 | Keine Zeit → **Zeitpille** Ist/Soll im Kopf, **Antreiber-Kasten** ab 150 % mit Vorschlagsknöpfen, Taste X. | `zeigeKopf()`, neu `.sp-uhr`, `.sp-antreiber`; `schritt.dauer`, `antreiber[]`, `stand.schrittSeit` |
| 8 | Kein Inventar → **Heldenchips** unter der Tischkarte, Inventar-Popup, Beutewurf mit „An: [Held]". | `tischKarte()`, `popupHtml()` held, neu `.sp-helden`; `stand.helden[].inventar`, `uebernahme` |
| 9 | Tischkarte 46 vh → **max. 300 px**, Lupe für die große Ansicht; Gegner bekommen ≥ 250 px. | `.sp-tischkarte svg`, `.sp-seite` Grid-Rows |
| 10 | Wahlkarten mit Folge-Kleindruck → **Folge-Pillen** (Geduld −1 rot, Map 3 lila), Spalten nach Optionszahl, Anleitung oben. | `schrittInhalt()` wahl, `.sp-optionen`, `.sp-option em`; `optionen[].folgen` strukturiert |
| 11 | Leisten ändern sich stumm → **Impuls** (Pille blitzt, „↑1" 3 s); Gegner-Zustandsetikett farbig, Satz beim Wechsel hervorgehoben; Schadenknöpfe 44 px. | `zeigeKopf()`, `.sp-pill`, `gegnerListe()`, `.sp-g-zustand`, `.sp-g-knoepfe .btn.sm` |
| 12 | Meldung im Fuß der Schrittkarte → **Toast links in Zeile 2** der Aktionsleiste, Fehler bleiben stehen. Vollbild ins Menü. | `melde()`, `.sp-msg`, `zeigeKopf()` Kopfknöpfe |

Reihenfolge der Umsetzung: 1–2 zusammen (ein Abend), dann 4–5 (Schrittkarte), dann 3, dann 6–8
(neue Daten), 9–12 sind Politur und gehen nebenbei.

## 5. Kurzfassung

1. Aktionsleiste unten: eine Zeile, Gruppenkästen Untersuchen · Bewegen · Wege · Lärm · Kampf · Fragen · Story, Überlauf „▴ n weitere".
2. Zweite Zeile unten fest: Rundenwurf · Runde beenden · Zurück · WEITER, Weiter immer rechts unten.
3. NPC als Schublade über der Schrittkarte mit vier Feldern; Fragen an Hedda wandern als Knöpfe hinein.
4. „Gerade passiert" direkt unter den Spielersatz, neueste zuerst, höchstens zwei offen.
5. Regie-Bullets werden ein „Wenn → dann"-Raster, eingeklappt nach dem ersten Besuch, ohne Dopplung mit den Knöpfen.
6. Log-Schublade (P) über der Seite mit Rundentrennern und Typfarben; „Zuletzt"-Zeile im Fuß der Schrittkarte.
7. Zeitpille Ist/Soll im Kopf; Antreiber-Kasten ab 150 % mit Vorschlagsknöpfen, nie automatisch.
8. Heldenchips unter der Tischkarte mit Inventar-Popup; Beutewurf vergibt per Klick an einen Helden.
9. Tischkarte auf 300 px, Gegnerliste bekommt den Platz; Schadenknöpfe 44 px, Zustand als farbiges Etikett.
10. Wahlkarten mit Folge-Pillen statt Kleindruck; Leisten blitzen bei Änderung; Meldungen als Toast über der Aktionsleiste.

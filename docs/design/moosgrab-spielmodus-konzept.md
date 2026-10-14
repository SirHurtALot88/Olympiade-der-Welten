# Spielleiter-Modus „Kampagne spielen" — Konzept

Reiter in der Kartenschmiede, der den Laptop zum einzigen Spielinhalt macht: Vorbereitung und Abend Schritt für Schritt, Cues eingebettet, Gegner als Karten mit Schadensknöpfen, NPCs als Fenster, Verzweigungen als Antwortwahl. Plain JS in der einen HTML-Seite (`lib/kartenschmiede/seite.ts`), Daten als JSON (siehe `map1.json`).

## 1. Was andere machen — und was wir übernehmen

| Vorbild | Belegt | Wir übernehmen |
|---|---|---|
| **Mansions of Madness 2e** (App als „Keeper") | Die App führt Monster; Schaden wird im Monster-Menü mit **+ und −** eingetragen (Esoteric-Order-Regelzusammenfassung, [PDF](https://www.orderofgamers.com/downloads/MansionsofMadness2ndEd_v1.pdf); Rulebook [rulespal](https://rulespal.com/mansions-of-madness-second-edition/rulebook)). | Schaden mit +/− pro Gegner, Knopf statt Tabelle. |
| **Descent: Legends of the Dark** | App „tracks and controls the enemies"; eigener **Enemy Overview Screen** mit allen Gegnern im Spiel; Schaden wird je Erfolg mit „>" abgezogen, Direktschaden mit „<"; bei 0 „remove figure" ([Rulebook](https://rulespal.com/descent-legends-of-the-dark/rulebook)). | Gegnerspalte = Enemy Overview; „Figur vom Tisch nehmen" als Hinweis bei 0. |
| **Journeys in Middle-earth** | Spieler tragen Treffer im Gegnermenü ein, App zeigt Health/Armor je Figur ([Rulebook](https://rulespal.com/journeys-in-middle-earth/rulebook)); Threat-Leiste als Timer ([FFG](https://www.fantasyflightgames.com/en/news/2019/4/5/against-the-darkness/)). | Leisten als sichtbare Timer (Sporenuhr, Atemzug). |
| **Imperial Assault: Legends of the Alliance** | Verdeckte Räume werden erst beim Öffnen der Tür aufgedeckt ([FFG](https://www.fantasyflightgames.com/en/news/2017/12/1/a-new-legend-begins/)); Gegner-HP steht auf den Karten, Rest in der App (Forum-Eindruck, [Archiv](https://ffg-forum-archive.entropicdreams.com/topic/268297-legends-of-the-alliance-impressions)). | Tisch in Hälften aufbauen (Map 1 unten/oben), Schritt „Aufbau" an den Auslöser gebunden. |
| **Gloomhaven Helper** (eingestellt) | „Monster stats are hidden until the monster appears"; Schalter „Hide monsters" je Gerät; HP per Drag/Menü ([esotericsoftware](https://esotericsoftware.com/gloomhaven-helper)). | Gegner erscheinen erst im Kampfschritt; spätere Spieleransicht = eigenes Gerät ohne Zahlen. |
| **Foundry VTT** | Token-Option „Display Bars": Never / When Controlled / Hovered by Owner / Hovered by Anyone / Always for Owner / Always for Everyone ([Doku](https://foundryvtt.com/article/tokens/)); Modul **Party Watch**: Spieler sehen exakte HP, **beschreibende Zustände** („Wounded", „Critical") oder nur Balken ([Paket](https://foundryvtt.com/packages/partywatch)); **Custom D&D 5e** setzt „Bloodied" automatisch bei ≤ ½ HP ([Paket](https://foundryvtt.com/packages/custom-dnd5e)). | Zustandsstufen statt Zahlen; Stufe wird automatisch aus Wunden/Zäh berechnet. |
| **D&D 2024** | „Bloodied" = halbe Trefferpunkte oder weniger, als Glossar-Zustand zurück ([Gaming Nexus](https://gamingnexus.com/News/65087/Bloodied-is-back-in-the-DD-2024-Players-Handbook-and-theres-exactly-one-creature-that-uses-it)); DM-Praxis: HP verdeckt, nur „bloodied" ansagen ([EN World](https://www.enworld.org/goto/post?id=7035376)). | Die Mitte der Skala ist „verwundet" (≤ ½), laut ansagen. |
| **D&D Beyond Maps** | Versteckte Kreaturen fehlen in der Spieler-Initiative; „Reveal" fügt sie hinzu ([Support](https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps)). | Gegner mit `geheim` (Quelle, spätere Marines) bleiben in der Spieleransicht unsichtbar bis „aufdecken". |
| **Owlbear Rodeo** | Unter Fog unsichtbare Tokens bleiben für den GM sichtbar ([itch](https://gm-redlock.itch.io/numbered-room-tokens-for-vtts)); Fog statisch im Kern, dynamisch per Extension ([Blog](https://blog.owlbear.rodeo/owlbear-rodeo-2-3-release-week-day-3/)). | GM-Sicht = alles, Spieler-Sicht = Filter derselben Daten. |
| **Alchemy RPG / Syrinscape** | Szenen mit Ambient-Sound und Musik ([Alchemy](https://alchemyrpg.com/)); Syrinscape: Soundset → Mood → One-Shots, Web Player ohne Install ([Syrinscape](https://syrinscape.com/web-player)). | Cue-Knopf direkt im Schritt, Battle Cue als Schleife, One-Shot-Leiste für Extra-Cues. |
| **Ink (inkle)** | Choices `*` einmalig / `+` wiederholbar, Diverts `->`, `VAR`, bedingte Choices `{ not visit_paris }`, Gathers `-` zum Zusammenführen ([WritingWithInk](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md)). | Schritt-Graph mit `ziel`, `setzt`, `wenn`; Verzweigungen laufen nach wenigen Schritten wieder zusammen. |
| **Twine** | „open-source tool for telling interactive, nonlinear stories", publiziert nach HTML ([twinery.org](https://twinery.org/)). | Passagen = Schritte, Links = `weiter`; später Editor im Browser. |
| **Branch & Bottleneck** (Ashwell, via Sub-Q) | Früh verzweigen, an festen Beats wieder bündeln; „delayed branching": spätere Texte ändern sich nach früherer Wahl, ohne neuen Pfad ([Sub-Q](https://sub-q.com/making-interactive-fiction-the-branch-and-the-merge/), [intfiction](https://intfiction.org/t/advice-for-designing-branching-passages/76068/2)). | Flags statt Pfade: Map 1 bündelt vor dem Boss und am Ende; Map 2 liest die Flags. |

Nicht gefunden: eine offizielle Blackstone-Fortress- oder Silver-Tower-Companion-App (nur das eigenständige Mobile-Spiel „Warhammer Quest", [App Store](https://apps.apple.com/us/app/-/id1517281011)). Ob MoM die Monster-HP vor Spielern verbirgt, ist nicht belegt — unsere Fog-Regel ist deshalb **eigene Ableitung** aus Foundry/Party-Watch und der D&D-Praxis.

## 2. Leitprinzipien

1. **Laptop = GM-Bildschirm.** Alles, was Chris wissen muss, steht da; nichts anderes liegt auf dem Tisch. Figuren, Gelände, Marker sind physisch.
2. **Ein Schritt nach dem anderen.** Immer genau eine Schrittkarte groß in der Mitte. Leertaste = weiter. Zurück ist erlaubt (Undo-Stapel).
3. **Zwei Klicks für Schaden.** `+1`, `+2`, `−1` pro Gegnerkarte, Tastatur `+`/`−` auf dem markierten Gegner.
4. **Keine Spoiler.** Vorlesetexte enthalten nie Falltür, Station, Marines, Myzel-Soldaten. Was `geheim` ist, zeigt nur die GM-Sicht; eine spätere Spieleransicht filtert dieselben Daten.
5. **Audio sagt „ihr".** Cues sprechen die Gruppe an; Heldennamen kommen nur vom Tisch.
6. **Flags statt Pfade.** Jede Wahl setzt Flags; spätere Schritte und Maps fragen sie ab (`wenn`). So bleibt eine Map ein linearer Abend mit Abzweigen, die sich wieder treffen.

### Leitlinien von Chris (14.10.), gelten für jede Map

7. **Aufgebaut wird nur, wenn gekämpft wird.** Story-Orte (Friedhof, Kapelle, Krypta, Dorf) erzählt Chris; die App zeigt ihm die Skizze nur zur Orientierung (`nurErzaehlen` am Aufbauschritt). Erst wenn ein Kampf beginnt, kommt ein Aufbauschritt mit dem, was auf den Tisch muss (Kampfaufbau vor jedem Kampfschritt, mit `wenn`, damit nichts doppelt aufgebaut wird). Ausnahme: Maps, die von Anfang an ein Kampf sind (Map 1), stehen vor dem Intro.
8. **Keine Fragen an Chris, was in der letzten Map war.** Alles, was aus früheren Maps folgt, zieht die App aus dem Spielstand: Folgen als fertige Liste (`folgen` am Vorbereitungsschritt), Wirkungen verbucht (`beimStart`: Leisten, Sporenpunkte).
9. **Geplant wird auf Normal** (OPR Fortgeschritten, 50 % der Heldenpunkte je Welle, Bezug 340 Heldenpunkte). Kämpfe ohne Rast dazwischen rechnen zusammen: die Helden sind dann schon angeschlagen. Ein Kampf startet höchstens mit etwa einer Welle; was darüber hinausgeht, kommt als Nachschub am Rundenende (`rundenende.gegnerHinzu` mit `hoechstens`).
10. **Rast nur, wo die Geschichte Ruhe hergibt.** Nach jeder Map gibt es nur die OPR-Erholung: 3 Wunden und 3 Power je Held, Zustände und Verletzungen bleiben, Atemzug +1. Ganz heilen geht nur bei einer echten Rast an einem sicheren Ort (Map 2: die Krypta), einmal, Atemzug +1. Wo die Zeit drängt oder der Ort verseucht ist (Map 1), steht „Keine Rast“ in der Lage.
11. **Aufträge verraten nichts.** „Findet heraus, ob noch jemand lebt“, nicht „erfahrt von ihm“. Kein Auftrag nimmt vorweg, wer oder was die Helden erwartet.
12. **Sporenpunkte haben ein Gesicht.** Jede Stufe sagt, woran man es sieht, wie es sich anfühlt und was nach den Regeln gilt (Heldeninfo und Lage). Der Träger des Kupferanhängers bekommt bei jedem Mapwechsel einen Sporenpunkt; der Anhänger lässt sich weitergeben.
13. **Beute landet beim Helden.** Was ein Gegner fallen lässt (Ehering am Grab), steht mit Beutewurf und „Geben an“ im Todestext. Gegenstände lassen sich zwischen Helden weitergeben; was nicht weitergegeben werden kann, sagt die Heldeninfo.

### Balancing (Chris, 14.10.)

Die Stufe vom Anfang des Abends gilt für jeden Kampf: Gegnerpunkte nach OPR (25/50/75/100 % der
Heldenpunkte), Werte bleiben. Regeln, Zahlen je Kampf und die Gegnerliste für die Miniaturen:
`docs/design/moosgrab-balancing-und-gegner.md`. Der Balancing-Test in `tests/kartenschmiede.test.ts`
muss für jede Map grün sein.

## 3. Bildschirme

### (a) Map-Vorbereitung

```
┌ Kampagne spielen ─────────────────────────────────────────────────────────────┐
│ Moosgrab · Map 1 Der kranke Waldrand        Stand: Atemzug 0  ·  Gruppe: Franky │
├────────────────────────────────┬──────────────────────────────────────────────┤
│ VORBEREITUNG  (3 von 7 erledigt)│  Tischskizze 60 × 60 (SVG aus szenarien.js)  │
│ [x] Figur Frau                  │  ┌──────────────┐  Phase: nur UNTEN           │
│ [x] Figur Erblühte (Boss)       │  │  ····· oben ·│  (obere Hälfte ausgegraut) │
│ [x] 2 Giftmade, 2 Sporenhülle   │  │ B   ③  Baum  │                            │
│ [ ] 3 Suchmarker, 2 Feindzonen  │  │   ② Wolke ③  │  Legende: ① Suchmarker,    │
│ [ ] Zählstein Sporenuhr         │  │ ▓▓Start▓▓    │  A/B Feindzone, Q geheim   │
│ [ ] Zettel „Kupferanhänger"     │  └──────────────┘                            │
│ [ ] Audio: 8 Cues  (7 ✓, 01B-4A fehlt → wird live gespielt)   [MP3 hochladen] │
├────────────────────────────────┴──────────────────────────────────────────────┤
│ Aus Map 0: —      Übernommen: Atemzug 0        [Abend starten ⏎]              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### (b) Spielansicht

```
┌ Leisten ──────────────────────────────────────────────────────────────────────┐
│ Runde 2   Atemzug ●○○○○○ 1/6   Sporenuhr ●●○ 2  (−1 je Rundenende)   Verhalten: RUHIG │
├───────────────────────────────────────────────────┬───────────────────────────┤
│ SCHRITT 16 / 35 · KAMPF  „Die Sporenlinge"        │ GEGNER (4)        [+Gegner]│
│                                                   │ ┌───────────────────────┐ │
│  2 Sporenlinge je Feindzone (A und B).            │ │▣ Giftmade · A  ☠      │ │
│  Ruhige Tabelle, bis Marker 2 untersucht ist.     │ │ Q5+ V6+ Zäh 3         │ │
│                                                   │ │ ■■□  ANGEKRATZT       │ │
│  ┌ Vorlesen ───────────────────────────────────┐  │ │ „Es zuckt, blutet grün"│ │
│  │ Was tut ihr?                                │  │ │ [+1] [+2] [−1] [×]    │ │
│  └─────────────────────────────────────────────┘  │ └───────────────────────┘ │
│                                                   │ ┌───────────────────────┐ │
│  Jederzeit:  [1] Marker 1  [2] Marker 2  [3] Marker 3  │ Sporenhülle · B ☠     │ │
│              [M] Tischmitte → oben aufbauen         │ ■■■■ UNVERLETZT       │ │
│              [F] Held erreicht die Frau             │ [+1] [+2] [−1] [×]    │ │
│                                                   │ └───────────────────────┘ │
│  ▶ Battle Cue 1  ⟲ läuft 1:12 / 3:15   [⏸] [⏹]   │ (ruhig) W6: 1 zögert, 2–3 │
│                                                   │ bewegt, 4 bewegt+greift … │
│ [⌫ zurück]      [R] Runde beenden      [⏎ weiter] │                           │
└───────────────────────────────────────────────────┴───────────────────────────┘
NPC-Fenster (poppt über die Schrittkarte, Schritttyp npc):
┌ Die Frau aus den Wurzeln ─────────────────────────────────────────────────────┐
│ STIMME  leise, zitternd, Sätze brechen ab    MOTIV  will nach Hause zur Mutter │
│ KERNSÄTZE  „Da … das grüne Licht … geht nicht hin."  ·  „Es ist so warm."     │
│ WEISS NICHT  was mit ihr geschieht · was unter dem Dorf liegt · Namen der Helden │
│ WENN SIE FRAGEN …  nach dem Dorf → „Alle knien. Alle flüstern."               │
│                                                        [⏎ zur Antwortwahl]    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### (c) Antwortwahl

```
┌ WAHL · Was tun die Helden mit der Frau? ──────────────────────────────────────┐
│  Wähle, was dem am nächsten kommt, was Franky sagt.                            │
│  [1] Sie beruhigen, nach ihr und ihrer Mutter fragen   → sie nennt ihren Namen │
│  [2] Sich vorstellen: „Ich bin …, wir holen dich raus" → ein Held sagt seinen  │
│  [3] Sachlich: Was ist das Licht? Was ist im Dorf?     → Hinweis Brunnen       │
│  [4] Abstand, Waffe hoch, oder angreifen               → kein Hinweis          │
│  Folgen stehen nur in der GM-Sicht (klein, grau): Flag · Leiste · Map 2        │
└───────────────────────────────────────────────────────────────────────────────┘
```

### (d) Map-Ende

```
┌ ENDE · Map 1 ─────────────────────────────────────────────────────────────────┐
│ EP  Hauptziel 2 ✓ (3 Marker, Quelle gefunden)   Nebenziel 1 ✓ (Frau erreicht) │
│ Beute  1 Beutewurf [W6 würfeln]  + 1 seltenes Material                         │
│ Leisten  Atemzug 1 → 2 (+1 Map-Ende, +1 Nachsuche)      Wunden/Power zurück    │
│ FOLGEN FÜR MAP 2 (aus Flags):                                                  │
│  • alle_marker = ja → Bonus-Beutewurf                                          │
│  • frau_name = „Lene" → Flüstern in der Kapelle sofort verstanden              │
│  • anhaenger_traeger = Krieger → Falltür                                        │
│  • frau_begraben = ja → Hedda: Kellerschlüssel auch ohne Anhänger              │
│ [Speichern & Map 2 vorbereiten]                 [Protokoll des Abends anzeigen]│
└───────────────────────────────────────────────────────────────────────────────┘
```

## 4. Fog of War

**GM sieht** je Gegner: Karte (renderCard aus app.js, verkleinert), Zähl-Wunden `3/4`, Zone, Verhalten, Bedrohung als Schädel 1–6 (aus `R.stufeFuerPunkte`), Zustandsstufe und den Beschreibungssatz. **Spieler sehen nichts davon** — der Laptop steht zu Chris. Sie bekommen nur Sätze.

**Zustandsstufe** aus `rest = zaeh·modelle − wunden` (eigene Ableitung, orientiert an Party Watch und „bloodied" = ½):

| Stufe | Bedingung | GM sagt (Standard; je Gegner überschreibbar) |
|---|---|---|
| unverletzt | wunden = 0 | „Nichts. Es hat nicht mal gezuckt." |
| angekratzt | rest > ½ | „Getroffen. Es blutet grün, mehr nicht." |
| verwundet | rest ≤ ½ (= bloodied) | „Das hat gesessen. Es bewegt sich schwerer." |
| schwer verwundet | rest ≤ ¼ und rest > 1 | „Es hängt schief, Sporen rieseln aus der Wunde." |
| am Ende | rest = 1 | „Ein Treffer noch. Es weiß es." |
| gefallen | rest ≤ 0 | „Es fällt. Figur vom Tisch." |

Bei Zäh 3 (Giftmade) ergibt das unverletzt → angekratzt → am Ende → gefallen; bei Zäh 10 (Erblühte) alle sechs Stufen. **Bedrohung** vor dem ersten Schlag: 1–2 Schädel „Kleinvieh, ihr habt so was schon erlegt", 3–4 „Das ist ein Gegner", 5 „Dafür braucht ihr alle", 6 „Boss — das ist, wovor sie weggelaufen ist". Beide Sätze stehen auf der Gegnerkarte in der GM-Sicht, Chris liest oder umschreibt.

**Später: Spieleransicht** auf zweitem Bildschirm/Handy (`/kartenschmiede/spiel/<id>/spieler`): zeigt Artwork, Namen, Schädel und einen Balken mit vier Segmenten ohne Zahl — Foundry-Muster „Always for Everyone" ohne Werte, Gloomhaven-Helper-Muster „Hide stats". `geheim`-Gegner (Quelle, Marines) erscheinen erst nach „aufdecken".

## 5. Bedienung

| Taste | Wirkung |
|---|---|
| `Leertaste` / `Enter` | nächster Schritt (bei `wahl` nur nach Auswahl) |
| `Backspace` | ein Schritt zurück (Undo-Stapel, inkl. Flags/Wunden) |
| `1`–`4` | Antwort wählen; außerhalb einer Wahl: Ereignis-Kurztasten des Schritts (Marker 1–3) |
| `Tab` / `Shift+Tab` | Gegner markieren |
| `+` / `−` / `*` | markierter Gegner +1 / −1 / +2 Wunden |
| `R` | Runde beenden (Rundenende-Regeln laufen: Sporenuhr −1, ab Runde 4 wütend) |
| `A` | Cue des Schritts abspielen/pausieren; `S` Stopp aller Audios |
| `F` | Ereignis „Held erreicht die Frau" (nur wo erlaubt) |
| `N` | NPC-Fenster auf/zu |
| `Esc` | Fenster schließen |

Maus: alles auch als große Knöpfe (Esstisch, Laptop steht schräg). Schadensknöpfe mindestens 44 px. Vorlesetexte 28–32 px, Rest 16 px.

## 6. Datenmodell (JSON, Plain JS)

Eine Datei je Map, ohne Bibliothek abspielbar. Alle Schritte in `schritte` als Objekt `id → Schritt`; `start` nennt den ersten. Ein `Schritt` hat `typ`, `titel`, Felder je Typ und `weiter` (String = Ziel-ID, oder Liste `[{wenn, ziel}, …]`, letzter Eintrag ohne `wenn` = Standard).

| `typ` | Felder | Bildschirm |
|---|---|---|
| `vorbereitung` | `checkliste[]` | (a) |
| `aufbau` | `tisch[]`, `skizze` (`unten`/`oben`/`alles`), `setzt` | (a)/(b) mit SVG |
| `cue` | `cue` (ID aus `audio`), `schleife`, `optional`, `notiz` | (b), Audio-Knopf groß |
| `vorlesen` | `text`, `als` (Figur-ID, optional) | (b), Text groß |
| `regel` | `text` (wörtlich ansagen) | (b) |
| `spieler` | `text`, `runden` (bool), `ereignisse[]`, `hinweise[]` | (b) mit Ereignis-Tasten |
| `wahl` | `frage`, `optionen[{taste, text, kurz, setzt, leisten, ziel}]`, `wenn` | (c) |
| `kampf` | `gegner[{id, anzahl, zone}]`, `verhalten`, `ereignisse[]`, `ende[{wenn, ziel}]`, `hinweise[]` | (b) mit Gegnerspalte |
| `npc` | `figur` (ID aus `figuren`) | NPC-Fenster |
| `ende` | `ep[]`, `beute[]`, `leisten`, `folgen[{wenn, text}]`, `notieren[]` | (d) |

Querverweise: `leisten` (Name, min/max, Start, `gilt: kampagne|map`, Richtung), `flags` (Standardwert, Beschreibung, `wirktIn`), `figuren` (NPC-Karten: `wer`, `stimme`, `motiv`, `kern[]`, `nichtWissen[]`, `wennSieFragen[]`), `gegner` (Kartenschlüssel `v:<vorlage>` oder `k:<karten-id>` oder `eigen` mit `werte`; `anzeige`-Name für die Spieler, `zustandSaetze` optional), `audio` (`cue-id → {datei, titel, dauer, schleife}`), `ereignisse` (jederzeit auslösbar, `einmal`, `vorlesen`, `setzt`, `leisten`, `wirkung`), `rundenende[]` (Regeln, die bei `R` laufen), `fog` (Stufen und Sätze), `beutewurf` (W6-Tabelle).

Bedingungen `wenn`: `{"flag":"x","ist":true}`, `{"leiste":"sporenuhr","<=":0}`, `{"runde":">=",4}`, `{"alle":[…]}`, `{"nicht":{…}}`. Mehr braucht Map 1 nicht; `eine:[…]` kommt mit Map 2.

**Kampagnenstand** (über Maps hinweg) als eigener Eintrag `kampagnen/<id>.json` im bestehenden Store (`karten-store.ts`, neue `Art`): `{ flags, leisten, helden[{name, sporenpunkte, ep}], aktuell:{map, schritt}, protokoll[] }`. Jede Wahl, jeder Schaden, jedes Rundenende schreibt eine Zeile ins Protokoll — das ist der Undo-Stapel und zugleich das Abendprotokoll.

**Audio-Ablage:** neue Route `PUT/GET /api/kartenschmiede/audio/<cue-id>` (Binärdatei, Grenze 20 MB, Pfad `kartenschmiede/<sammlung>/audio/<id>.mp3` neben den JSONs im Volume). Die Vorbereitung zeigt je Cue ✓ oder „fehlt → hochladen"; fehlende Cues spielt Chris live (Schritt `cue` mit `optional: true` springt dann zum nächsten Schritt).

## 7. Flags aus Map 1, die Map 2 liest

| Flag | Gesetzt durch | Wirkung in Map 2 |
|---|---|---|
| `frau_erreicht` | Held bei der Frau vor Uhr 0 | Nebenziel-EP; ohne: Hedda hört nur vom Anhänger |
| `frau_name` = „Lene" | Wahl 1 beim Gespräch | Das geflüsterte Wort in der Kapelle wird ohne Qualitätstest erkannt; wer es laut sagt, bekommt 1 Sporenpunkt (Namensregel wird spürbar) |
| `name_verraten` = Heldname | Wahl 2 | Dieser Held startet Map 2 mit 1 Sporenpunkt („Das Moos hat deinen Namen gehört") — bereitet die Namensregel vor, bevor sie angesagt wird |
| `hinweis_brunnen` | Wahl 3 | Hedda-Satz „Es fing mit dem Brunnen an" wird bestätigt; Helden dürfen Hedda direkt nach dem Brunnen fragen (ein Zusatz mehr) |
| `frau_angegriffen` | Wahl 4 (mit Angriff) | Boss startet mit wütender Tabelle; Hedda: wenn die Helden die Wahrheit sagen, zieht sie sich zurück (nur Kernsätze) |
| `anhaenger_traeger` / `anhaenger` | Wahl nach dem Boss | Falltür öffnet leise nur mit Anhänger; ohne: aufbrechen (+2 Lärm) oder Name |
| `frau_begraben` | Wahl nach dem Boss (kostet Atemzug +1) | Hedda gibt den Kellerschlüssel auch ohne Anhänger-Rückgabe |
| `leiche_verbrannt` | Wahl nach dem Boss (nur mit Feuertopf/Feuerwaffe) | Atemzug −1, aber Hedda schweigt, wenn sie es erfährt |
| `marker1..3`, `alle_marker` | Ereignisse | Bonus-Beutewurf in Map 2 |
| `quelle_zerstoert` | Ereignis nach Marker 3 | Atemzug −1 (Finale: weniger Nachschub) |
| `nachsuche` (Zahl) | Wahl am Ende | je +1 Atemzug (schon in Map 1 verbucht) |

## 8. MVP (nur Map 1) und später

**MVP:** neuer Reiter „Spielen" neben „Szenarien"; lädt `map1.json` (inline in der Seite); Schrittkarte, Leistenleiste, Gegnerspalte mit `renderCard` + Schadensknöpfen + Zustandsstufe, NPC-Fenster, Antwortwahl, Ereignis-Tasten, Rundenende, Undo; Kampagnenstand speichern/laden (neue `Art` im Store); Audio-Upload und `<audio>`-Abspielen; Ende-Bildschirm mit Folgen. Gegner aus `VORLAGEN` (`v:giftmade`, `v:sporenhuelle`) und ein eigener Eintrag „Die Erblühte" (Ersatz `v:frostfang`).

**Später:** Map 2–5 als JSON (Map 2 liest die Flags oben); Spieleransicht auf zweitem Gerät (Server hält den Stand, Polling alle 2 s reicht); Szenario-Editor im Browser (Schritte als Liste ziehen, Gegner aus Datenbank übernehmen, Flags-Prüfer: „Flag gesetzt, nie gelesen"); Zufalls-Welle (`welleWuerfeln`) als Kampfschritt; Druck des Abendprotokolls; Timer je Schritt für die 2,5-Stunden-Planung.

**Offene Zahl für Chris:** 4 Sporenlinge aus je 2 Giftmade + 2 Sporenhülle sind 100 Punkte, das Playbook sagt ≈ 50. Die App zeigt die Summe; entweder eine Figur je Zone oder ein eigener „Sporenling"-Eintrag (Zäh 2, ≈ 12 P.).

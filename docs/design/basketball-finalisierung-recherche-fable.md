# Recherche: Basketball finalisieren — Korb, Ballträger, Dribbeln, und was ein 2K-Fan noch vermisst (Fable)

Stand: `main` `eed9f61b` (03.09.2026), gemessen im Haupt-Checkout; jede Zahl unten stammt aus einem
Lauf, dessen Quelle-Zeile auf `/home/user/Olympiade-der-Welten/public/mockups/battle-mode.html`
zeigt. Alle `engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf diesem Stand.
Netzzugang lief über den Umgebungs-Proxy mit Allowlist; jede Quelle, die mit 403/422 abgewiesen
wurde, steht in Abschnitt 7 mit diesem Vermerk und wurde nicht als Beleg benutzt.

Chris' Auftrag wörtlich: *„was fehlt für dich noch um basketball zu finalisieren? haben wir dazu
schon ne doku? sprich dich mit fable ab - bitte wieder dafür das internet befragen und git ob wir
noch was verbessern können. Und schaut dass der Basketballkorb auch an der Grundlinie ist, die
Spieler den tragen mit den animationen, und er am besten auf den boden gedribbelt wird."*

---

## 0. Zuerst die Doku-Frage: es gibt keine

`find docs -iname "*basketball*"` liefert **nichts**. Basketball ist die reifste Disziplin, die
einzige mit Live-Motor im echten Spielstand (`ARENA_RESOLVED_DISCIPLINE_IDS`) — und die einzige
ohne eigenes Dokument. Was es gibt, ist über sechs Orte verstreut:

| Ort | Was dort steht |
|---|---|
| `docs/design/battle-mode-nba2k-modell-plan.md` | die Rangtreue-Runde (Lotterie-κ, Paar-Abstand, logistische Kurve, Ausboxen) mit Messreihen |
| `docs/design/battle-mode-gameplay-grundmodell.md` | Varianz-Grundsatz, Konstanz-Stat, 2K-Consistency-Zitat |
| `docs/ARENA_INTERAKTION_KONZEPT.md` | Spielzüge, Choreografien, Screen-Pass-Formeln |
| `docs/design/stand-aller-disziplinen.md` | die Prozentzahlen über vier Achsen |
| `public/mockups/battle-mode.rezepte.js` | das Rezept samt Kalibrier-Historie (einzige ausgelagerte Disziplin) |
| `engine.js` selbst | mehrere hundert Basketball-Kommentare mit Messwerten (Korb-Position 29.08., Dribbel-Runde 25.08., Zeitdehnung, Fokus-Doppeln …) |

**Das ist selbst ein Befund.** Wer heute wissen will, warum der Korb bei `W*0.915` hängt, muss
Zeile 4460 der Engine lesen. Dieses Dokument ist deshalb bewusst als *erste* Basketball-Doku
gebaut: Abschnitt 4 ist ein Inventar aller Mechaniken gegen NBA-Referenz, 2K-Vorbild und
Ist-Stand, und Abschnitt 7 sammelt die Belege. Wenn Chris die Doku-Frage so meint, ist die
Antwort: *jetzt ja, mit diesem Dokument — vorher nein.*

---

## Die drei Antworten, ohne Architekturwissen lesbar

**Korb an der Grundlinie.** Real und erledigt? **Teils.** Nachgemessen im gerenderten Bild (nicht
aus dem Code geraten): der Ring sitzt 31 px im Feld, das Brett 11 px *vor* der Grundlinie, und es
gibt keinen Ständer, keinen Arm, nichts, was Brett und Wand verbindet — das Brett schwebt als
weißer Strich frei im Parkett (Bild: `docs/design/basketball-korb-grundlinie-zoom.png`). Real
hängt das Brett 1,20 m *im* Feld und die Ringmitte 1,575 m — auf unserem Feld wären das 47 px und
61 px, also **weiter** drin als heute. Chris' 29.08.-Fund hat den Korb bereits von 68 px auf 31 px
gerückt; er ist damit näher an der Linie als in jeder echten Halle. Was ihn trotzdem „schweben"
lässt, ist nicht der Abstand, sondern (a) die 11-px-Lücke zwischen Brett und Linie, (b) der fehlende
Ständer und (c) die viel zu kurz gezeichnete Zone (75 px, proportional wären 226 px), in der der
Ring bei 41 % der Zonentiefe sitzt statt bei 27 %. Empfehlung: Brett *auf* die Linie
(`korbXVon` 0,915 → 0,924, das sind genau die 11 px), ein gezeichneter Ständer hinter der Linie,
und die Zone gehört auf `W` statt `H` bemessen — Abschnitt 1.

**„Die Spieler den tragen mit den animationen."** Real, nicht erledigt. Der Ballführer hat keine
eigene Pose; er läuft in `walk` wie jeder andere, und der Ball wird daneben gezeichnet
(`ANIBILDER={walk,slash,shoot,hurt}`, Z. 1540; `let ani="walk"`, Z. 2142). Der LPC-Baukasten, aus
dem alle Figuren stammen, **hat keine Trage-Animation** — im offiziellen Generator-Repo steht
„Carry" nur auf der Wunschliste (Issue #38: *„Lift (no frames exist to my knowledge), Carry,
Push/Pull"*). Es gibt aber zwei Blätter, die sich zweckentfremden lassen, und beide liegen im
Generator-Repo, aus dem am 23.08. schon 209 Blätter geholt wurden: `thrust` (8 Bilder, Arm auf
Hüfthöhe nach vorn — die Dribbelhand) und `spellcast` (7 Bilder, beide Arme über den Kopf — der
Sprungwurf, deutlich näher am Basketball als das heutige `shoot`, das ein seitlich gespannter
Bogen ist). Der billigste und zugleich sichtbarste Weg braucht gar kein neues Blatt: die
Handpunkte, die das Projekt für Waffen schon je Bild und Blickrichtung vermessen hat
(`docs/design/sprite-handpunkte.md`), tragen auch einen Ball — dann sitzt der Ball oben in der
Hand und unten am Boden, statt neben der Hüfte zu wackeln. Abschnitt 2.

**„Am besten auf den Boden gedribbelt."** Real, halb erledigt. Der Ball prellt seit dem 25.08.
(`BK_DRIBBEL_PERIODE=0.5`, `BK_DRIBBEL_AMPLITUDE=13`, Z. 4455) und die Unterkante des Balls kommt
im Tiefpunkt bis 4 px an die Fußlinie heran — mechanisch berührt er den Boden fast. Dass es
trotzdem wie Wackeln aussieht, hat zwei Ursachen, die beide nicht die Amplitude sind: **erstens
fehlt der Bodenschatten.** In einer Draufsicht mit leichter Schräge ist eine Bewegung nach unten
im Bild nicht von einer Bewegung nach vorn zu unterscheiden; nur ein Schatten, der am Boden bleibt,
während der Ball sich von ihm entfernt, macht Höhe lesbar. **Zweitens ist die Kurve verkehrt
herum.** `sin(φ·π)` hat seinen Knick oben an der Hand und seinen weichen Bogen unten am Boden —
ein echter Ball macht es genau umgekehrt: weich in der Hand, hart am Boden. `1−|cos(φ·π)|` dreht
das mit einer Zeile. Das Tempo (2 Hz) ist plausibel, aber nicht belegbar — kein abgerufenes
Paper nennt eine Zahl (Abschnitt 3, mit dem, was belegbar ist: Ballnorm, Fallzeit, NBA-Charting).

---

## Was ich selbst nachgemessen oder abgerufen habe, was ich nur gelesen habe

**Nachgemessen** (Playwright/Chromium `/opt/pw-browsers/chromium-1194`, Skripte im Scratchpad,
Quelle-Zeile geprüft):

| Zahl | Lauf | Ergebnis |
|---|---|---|
| Korb-Geometrie im Bild | eigener Render über `http://127.0.0.1:8765` (damit `/sprites/basketball/korb_topdown.png` lädt — über `file://` greift die Rückfall-Zeichnung), Pixelzeile `y=H/2` | Ring-Pixel 1133–1152, Brett-Pixel 1153–1154, Grundlinie 1165; `korbX`-Soll 1134,6, `grundX`-Soll 1165,6 |
| Rangtreue Ist-Stand | `miss-basketball-rangtreue.mjs 24 6` | ρ 0,786 / 0,747; 86,4 Pkt, 99,6 Ballwechsel, 82,8 FGA je Spiel (beide Seiten); OFF-Rebound 26,4 % |
| FG% nach Deckerabstand | derselbe Lauf | 0–10 px 64,3 % (n=28) · 10–20 px 42,2 % (n=90) · 20–30 px 51,9 % (n=181) · ≥30 px 44,1 % (n=1573) — **nicht monoton** |
| Ereignisse je Spiel | `feldspielProbe("basketball",{n:24,jeSeite:6})`, über alle Spieler summiert | Steals **25,7** · Ballverluste **30,4** · Blocks **3,3** · Fouls **2,3** · Rebounds 50,7 · Assists 15,9 · FG 35,2/82,8 = 42,5 % |
| Wurfverteilung nach Distanzstufe | derselbe Lauf, `fgTier` je Spieler summiert (1 872 Würfe) | dunk 284 (15,2 %) zu 89,1 % · nah 375 (20,0 %) zu 46,4 % · mit 301 (16,1 %) zu 34,9 % · **fern 912 (48,7 %) zu 34,2 %** |
| Beispielspiel Saat 1337 | derselbe Lauf | 32:56; Greenkraut 10 Steals, Draco 8 Ballverluste, 1 Block im ganzen Spiel |
| LPC-Blätter | `git clone --sparse` des Generator-Repos, `spritesheets/body/bodies/male/`, Reihen mit PIL vergrößert | thrust 512×256 (8 Bilder), spellcast 448×256 (7), idle 128×256 (2), shoot 832×256 (13), walk 576×256 (9); dazu run, jump, sit, climb, emote, combat_idle, backslash, halfslash |
| zengm (Basketball GM) | `git clone --sparse`, `GameSim.basketball/index.ts`, 2896 Zeilen gelesen | Formeln in Abschnitt 4 zitiert |

**Abgerufen** (Websuche/-fetch, Zahlen wörtlich aus der Quelle, URLs in Abschnitt 7):

| Kennzahl | Wert | Quelle |
|---|---|---|
| Brett zur Grundlinie | „the backboard itself hangs 1.20 m inside the baseline" | judgemate.com |
| Ring zum Brett | „The rim's inner edge sits 15 cm from the backboard face", Innendurchmesser 45 cm | judgemate.com |
| FIBA-Zone | „4.9 m wide and 5.8 m long"; Dreier 6,75 m (Ecke 6,60 m); NBA 7,24 m / 6,70 m | judgemate.com |
| Feld | FIBA 28×15 m, NBA 94×50 ft; Freiwurflinie 4,57 m vom Brett | Wikipedia „Basketball court" |
| Ball-Sprungnorm | fallen gelassen aus 1 800 mm, Rücksprung 1 200–1 400 mm (49–54 in) | Suchtreffer-Auszug (mehrere Regelzitate), Regeltext selbst nicht abgerufen |
| Touches je Ballbesitz | 2,7 im Mittel, Median 2; 0 Dribblings beim Abschluss 42 % (86 % assistiert), 1: 17 %, 2: 11 %, 3+: 19 % | 82games.com „dribbles" |
| Aktionen je Touch | 61 % Pass, 29 % Wurf, 6 % Foul gezogen, 4 % Ballverlust | 82games.com „dribbles" |
| Schussuhr-Fenster | 0–10 s: 112,3 Pkt/100, 11–15 s: 102,3, 16–20 s: 100,6, 21+ s: 91,8; Anteile je Team 35–47 / 18–26 / 18–27 / 8–17 % | 82games.com „clock" (2003-04) |
| FG% nach Restzeit | ≤5 s 34,45 %, 6–19 s 41,15 %, ≥20 s 52,11 % | Suchtreffer-Auszug (Medium, EDA-Projekt), Seite selbst 403 |
| Kontest-Klassen | 0–2 ft very tight, 2–4 tight, 4–6 open, 6+ wide open | NBA.com Stats (Filter), CBS Sports |
| Dreier-Anteile nach Kontest | wide open 39,4 %, open 41,7 %, tight 17 %, very tight 1,7 %; wide-open-Quote 38,6 % (2015-16) | CBS Sports |
| Pick-and-Roll | 16,4 % (2009-10) → 21,8 % (2013-14) der Ballbesitze; Ballführer 0,79 PPP, Roll-Mann „no team fewer than 0.84"; Spurs 23 % (16,6 + 6,4), 0,88/0,97 | Bleacher Report (Synergy) |
| Transition | 15,4 % der Ballbesitze; 125,8 Pkt/Play gegen 98,1 im Halbfeld; nach Steals 67,1 % Häufigkeit | Cleaning the Glass, Liga-Kontext 2025-26 |
| Transition, älter | 13,8 % (2014-15), Schwelle 1,10 PPP; 1,126 gegen 0,926 (2017-18) | CBS Sports 2015, Nate-Duncan-Auszug |
| Clutch-Definition | letzte fünf Minuten, Abstand ≤ 5 Punkte (Zach Lowe, von der NBA übernommen) | hoopsjunkie.io u. a. |
| Clutch-Quoten | eFG% Normal 46,6 %, Clutch 45,9 %, Clutch² 37,5 % (0,9 % der Würfe), Garbage 46,4 % | inpredictable.com Liga-Benchmarks |
| Clutch, akademisch | FG% fällt am Ende enger Spiele in 10 von 11 Saisons signifikant (2008-09 bis 2018-19), 3P% nicht; 25 „clutch" gegen 109 „choking" Spieler-Saisons | Berkeley-Thesis (Sarioz), aus dem PDF extrahiert |
| Hot Hand | +1,2 % Trefferchance je zusätzlichem vorherigen Treffer, *nachdem* Wurfschwierigkeit herausgerechnet ist; heiße Schützen werden enger gedeckt und werfen von weiter weg | Bocskocsky/Ezekowitz/Stein 2014 (83 000 Würfe, SportVU) |
| Foul Trouble | Q+1-Regel (2. Foul im 1. Viertel usw.); Trainer nehmen den Spieler in >70 % der Fälle sofort raus | Slate 2012 über Maymin/Maymin/Shen |
| Liga 2023-24 | 114,2 Pkt, Pace 99,2, FG 47,4 %, 3P 36,6 %, FT 78,4 %, 3PA/FGA 39,5 %, FTA/FGA .244, ORtg 114,5, TO 13,6/100, ORB% 28,3 | NBA.com Stats Survey |
| Liga 2025-26 (früh) | 45,7 Fouls je Spiel (beide), 29,8 FTA je 100 FGA, 15,3 TO/100 (Vorjahr 14,3), Pace 101,9 (Vorjahr 100,5) | NBA.com „10 numbers" |
| Team-Spannen 2024-25 | FGA 85,5–93,4; FTA 19,1–23,2; OREB 8,2–14,6; STL 6,8–10,3; BLK 4,0–5,7; TO 961–1 412 je Saison (11,7–17,2 je Spiel); PF 1 275–1 695 (15,5–20,7) | StatMuse Teamtabelle |
| NBA 2K25 Kontest | „dynamic weighting system … evaluates the impact of defense at the start of the shot versus the release"; Perimeter/Interior Defense und Größenunterschied gewichtet | 2K Courtside Report (via 2KIntel) |
| NBA 2K Adrenaline | drei Boosts je Spieler und Ballbesitz, danach Tempo/Beschleunigung deutlich gesenkt; Reset mit der Schussuhr | realsport101, dbltap |
| NBA 2K Hot Zones | vier Zonen, letzte 25–50 Spiele, ≥10 Versuche je Zone; Schwellen Paint 60 / Close 55 / Mid 50 / 3PT 40 %; „about a 5% boost" | nba2kw.com |
| NBA 2K Sim-Engine | Wurfvolumen senkt die Quote nie; Shot-Inside 99 gibt ~60 % innen; Draw-Foul-Tendenz steuert FTA/FGA | Suchtreffer-Auszüge (NLSC, Operation Sports); NLSC selbst 403 |
| LPC-Animationen | Original: spellcast, thrust, walk, slash, shoot, hurt; erweitert: climb, idle/combat idle, jump, sit/emote, run, backslash, halfslash; gewünscht: lift, carry, push/pull | LPC-Generator Issue #38 |

**Nur gelesen, nicht belegt:** eine gemessene Dribbelfrequenz in Hz (das HAR-Paper sagt nur
„experts have a higher rate of dribbles per second than the novices", die MDPI-Studie misst
Tempi relativ zum Vorzugstempo, ohne absolute Zahl); die NLSC-Formeln des 2K-Sim-Motors (beide
Hosts 403 — die Zitate im NBA2K-Modell-Plan stammen aus einer früheren Runde); der
NBA-Assist-Anteil an Feldkörben (~60 %, aus dem Gedächtnis); Maymins Effektgröße auf die
Siegwahrscheinlichkeit (PDF geladen, Text aber font-kodiert und nicht extrahierbar).

---

## 1. Korb an der Grundlinie

### 1.1 Was heute gezeichnet wird, in Pixeln

`korbXVon(side)` (Z. 4476) liefert `W*0.915` bzw. `W*0.085`; `grundX` in `bodenFeldspiel`
(Z. 8065) ist `W*0.94` bzw. `W*0.06`; `W=1240` (Canvas, `battle-mode.html` Z. 83). Das
Korb-Sprite wird bei `korbX` um ±90° gedreht mit `drawImage(-28,-20,56,56)` gezeichnet (Z. 8085–
8088): das Brett (im Blatt „oben") landet bei `korbX+20`, der Ring bei `korbX−36…korbX+20`.

| Element | Formel | Pixel (rechts) | Nachgemessen |
|---|---|---|---|
| Grundlinie | `W*0.94` | 1165,6 | 1165 |
| Brett | `korbX+20` | 1154,6 | 1153–1154 |
| Ringmitte | `W*0.915` | 1134,6 | 1133–1152 (Ringkörper) |
| Lücke Brett→Linie | | **11 px** | sichtbar im Zoom |
| Zone (Länge) | `H*0.16` | 75 px | |
| Freiwurfkreis-Mitte | `grundX−H*0.16` | 75 px | |
| Dreierbogen | `H*0.24` um `korbX` | 113 px | |

### 1.2 Was die Halle vorgibt

Spielfeld auf dem Canvas: `0,88·W = 1091 px` lang, `H−120 = 350 px` breit, also **3,1:1**. Ein
echtes Feld ist 28×15 m = **1,87:1**. Die Länge ist gegenüber der Breite um den Faktor 1,67
gestreckt — das ist eine bewusste Entscheidung (die Zeichenfläche ist breit und flach), und alle
Radien hängen deshalb an `H`, damit Kreise rund bleiben (Kommentar Z. 8059). Die Folge: alles,
was *längs* gemessen wird, ist zu kurz.

| Maß | real (FIBA) | Anteil Feldlänge | proportional auf 1091 px | heute |
|---|---|---|---|---|
| Brett ab Grundlinie | 1,20 m | 4,29 % | **47 px** | 11 px *vor* der Linie |
| Ringmitte ab Grundlinie | 1,20 + 0,15 + 0,225 = 1,575 m | 5,63 % | **61 px** | 31 px |
| Zone (Länge) | 5,80 m | 20,7 % | **226 px** | 75 px |
| Zone (Breite) | 4,90 m | 32,7 % der Breite | 114 px | 75 px |
| Dreierbogen | 6,75 m | 24,1 % | 263 px (längs) | 113 px |
| Ringmitte in der Zone | 1,575 / 5,80 | **27 %** der Zonentiefe | | **41 %** (31/75) |

Zwei Dinge fallen daraus: **Der Korb ist heute näher an der Wand als real** (31 gegen 61 px). Und
er sitzt trotzdem *tiefer in der Zone* als real (41 gegen 27 %), weil die Zone auf 75 px
zusammengedrückt ist — genau das erzeugt den Eindruck „Ring mitten im Feld", den Chris am 29.08.
und jetzt wieder meldet. Der Ring hat sich also nicht „falsch" bewegt; das Zonenrechteck um ihn
herum ist falsch proportioniert.

### 1.3 Empfehlung

1. **Brett auf die Linie.** `korbXVon`: 0,915 → **0,924** (rechts) und 0,085 → **0,076** (links).
   Das schiebt Brett und Ring um 11 px nach außen; das Brett liegt dann exakt auf `grundX`.
   `KORB_NAH_RADIUS`, `DREIER_RADIUS`, Slots und Ballflug hängen relativ an `korbX` (Kommentar
   Z. 4466) — Distanzklassen verschieben sich nicht. **Aber:** `DREIER_RADIUS=112.8` ist an
   `H*0.24` gebunden, nicht an `korbX`; und die Feldkante rückt näher an den Ring: der
   korbnahe Slot darf nicht hinter die Grundlinie fallen. Nach der Änderung
   `miss-arena-feldspiel-spiegel.mjs` (Seiten-Symmetrie 0,0 %) und
   `miss-basketball-rangtreue.mjs 24 6` (ρ 0,786) gegenmessen.
2. **Ständer zeichnen.** Ein kurzer Arm von der Grundlinie zum Brett plus ein Fußkreis *hinter*
   der Linie (im Aus), in derselben `bodenFeldspiel`-Schleife, drei Zeilen Canvas. Das ist das
   Element, das in jeder Draufsicht sagt „das hängt an etwas". Ohne Ständer schwebt auch ein
   Brett auf der Linie.
3. **Zone längs auf `W` bemessen**, nicht auf `H`: Zonenlänge `W*0.88*0.207 ≈ 226 px`, Breite
   weiterhin `H`-basiert. Der Freiwurfkreis-Mittelpunkt wandert damit von 75 auf 226 px, der
   Ring sitzt bei 27 % der Zonentiefe. **Achtung, das ist keine reine Optik:** die
   Freiwurf-Standphase (`starteFreiwuerfe`, Z. ~6257) liest `grundX` und stellt den Schützen an
   die Linie; die Zone ist Aufstellungsort für Rebound-Positionen. Vorher prüfen, ob
   Slot-Radien (`SLOTS_JE_DISC`) an `H*0.16` hängen.
4. **Nicht empfohlen:** die reale Proportion für Brett und Ring (47/61 px im Feld). Das war die
   Lage vor dem 29.08. (68 px), und Chris hat sie abgelehnt.

---

## 2. Der Ballträger und seine Pose

### 2.1 Was die Engine heute tut

`zeichneSprite` wählt genau vier Animationen (`ANIBILDER={walk:9,slash:6,shoot:13,hurt:6}`,
Z. 1540) und entscheidet so (Z. 2142–2145):

```js
let ani="walk";
if(u.down)ani="hurt";
else if(u.lunge>0)ani=feldspiel?"shoot":((bogen||feuerwaffe)?"shoot":"slash");
else if(Math.abs(u.vx||0)+Math.abs(u.vy||0)<3)ani="walk";
```

Der Ballführer ist nirgends ein Fall. Er läuft `walk` (stehend: Bild 0 von `walk`), der Ball
wird getrennt bei `traeger.y+18+dribbelDip` gezeichnet (Z. 7664) und in `zeichneFeldspiel` als
18-px-Sprite mit Mitte `by−26` gemalt (Z. 8392). Die Blätter `run` und `idle` sind seit dem 23.08.
für 45 Ebenen im Baukasten (`public/sprites/baukasten/README.md`), **werden aber nie
angesprochen** — `grep '"body_[a-z]*"'` findet nur walk/slash/shoot/hurt.

Das heutige `shoot` ist im LPC-Original der Bogenschuss: 13 Bilder, in denen beide Arme seitlich
waagerecht gespannt werden (Reihe rechts, `lpc-shoot-rechts-3x.png` im Scratchpad angesehen).
Für einen Korbleger ist das erkennbar die falsche Bewegung; der Kommentar an der Stelle sagt
selbst „naeher an einem Wurf als slash, auch wenn sie urspruenglich fuer den Bogen gezeichnet
wurde".

### 2.2 Was der LPC-Baukasten hergibt

Im Generator-Repo (`LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator`,
`spritesheets/body/bodies/male/`) liegen 15 Körper-Blätter. Angesehen, Reihe „rechts" (Zeile 4)
vergrößert:

| Blatt | Bilder | Was man sieht | Taugt als |
|---|---|---|---|
| `walk` | 9 | Arme schwingen seitlich | heute alles |
| `idle` | 2 | ruhiges Stehen, Arme hängen | **Stand mit Ball** (statt Bild 0 von walk) |
| `thrust` | 8 | Bild 0–2 Ausholen, **Bild 3–7 Arm auf Hüfthöhe nach vorn gestreckt** (ohne Waffe: eine ausgestreckte Hand) | **Dribbel-/Tragehand**; von vorn (Zeile 3) sieht man die Hand vor dem Körper |
| `spellcast` | 7 | Bild 4–5 **beide Arme über den Kopf** | **Sprungwurf** — deutlich näher am Basketball als der Bogen |
| `shoot` | 13 | Bogen spannen, Arme seitlich waagerecht | heute der Wurf; als Basketball-Bewegung unpassend |
| `run` | 8 | Laufzyklus | Fastbreak/Ausbruch (heute nur `tempoMul`, keine andere Pose) |
| `jump`, `sit`, `emote`, `climb`, `combat_idle`, `backslash`, `halfslash`, `hurt` | | | `jump` wäre der Rebound/Block, `emote` der Jubel |

**Eine Trage-Animation gibt es nicht.** Issue #38 des Generators listet unter „Ideally I would
also like to also support": *„Lift (no frames exist to my knowledge), Carry, Push / Pull"*. Wer
sie will, muss zeichnen — für 45 Ebenen. Das ist der Weg, den ich **nicht** empfehle.

Zur Lizenz: alle Blätter dort sind CC-BY-SA 3.0 / GPL 3.0 mit Urheberkette je Ebene; das Projekt
führt diese Kette schon in `quellen.json` (23.08.-Runde). `thrust` und `spellcast` sind
LPC-Originalanimationen (Issue #38), also für Kleidung/Haar/Köpfe breiter verfügbar als `run`
(die README sagt: getragene Platten und Waffen nur zu `walk` und den *Angriffen* — `thrust` ist
einer).

### 2.3 Drei Wege, nach Kosten sortiert

**A — Ball in die Hand (kein neues Blatt).** Das Projekt hat für Waffen je Bild und Blickrichtung
Handpunkte vermessen (`docs/design/sprite-handpunkte.md`, Beweisbilder
`sprite-handpunkte-beweis-*.png`). Genau diese Tabelle für `walk` (9 Bilder × 4 Richtungen)
gibt dem Ball einen Ankerpunkt: im Hochpunkt der Dribbelkurve sitzt der Ball *in der Hand*, im
Tiefpunkt *am Boden unter der Hand*, dazwischen interpoliert. Sichtbar wird „er trägt ihn", weil
der Ball mit der schwingenden Hand mitgeht statt starr neben der Hüfte zu hängen. Kosten: eine
Tabelle, keine Assets, keine Lizenzarbeit. Nebenwirkung null — `fsBall` bleibt Spielkoordinate,
nur der Zeichenversatz ändert sich (dasselbe Muster wie `_zvx/_zvy`, Z. 8365 ff.).

**B — `thrust` als Ballführer-Pose.** Ballführer, der steht oder langsam geht: `thrust` Bild 3–5 im
Wechsel, in der Phase an `dribbelPhase` gekoppelt (Bild 3 oben, Bild 5 unten = die Hand drückt
den Ball). Braucht `thrust` für alle Ebenen (Körper, Kopf, Haar, Hose, Rüstung — dieselbe Liste
wie die 23.08.-Runde, per `quellen.json`-Skript), also ~45 Blätter mehr im Base64-Block. Die
Beine bewegen sich in `thrust` nicht; für den *laufenden* Ballführer bleibt `walk` + Weg A.

**C — `spellcast` als Wurf.** Ersetzt `shoot` im Feldspiel (Z. 2144: `feldspiel?"shoot"` →
`"spellcast"`), `ANIBILDER.spellcast=7`. Beide Arme gehen über den Kopf, der Ball fliegt aus
der Hand oben ab (Handpunkt Bild 4). Sichtbarster Einzelgewinn für eine Zeile Logik plus
Blätter; das heutige Bogen-Spannen ist beim Zusehen der auffälligste Fremdkörper.

Empfehlung: **A sofort, C in derselben Runde, B nur wenn A nicht reicht.** Und `idle` statt
`walk` Bild 0 für stehende Spieler ist geschenkt — das Blatt liegt schon da.

### 2.4 Wie die Vorbilder es machen

NBA Jam (Midway, 1993) arbeitete mit 100×100-px-Sprites aus digitalisierten Fotos bei 60 fps
(TCRF/Sanglard) — dort ist der Ball Teil des Spieler-Sprites je Bild, weil das Blatt eigens für
Basketball fotografiert wurde. Für einen Baukasten wie LPC, der für Rollenspiele gezeichnet ist,
ist das nicht erreichbar; der Weg über Handpunkte (A) ist das, was Sprite-Generatoren-Spiele
für Schilde, Fackeln und Werkzeuge tun: ein Ankerpunkt je Bild, das Objekt als eigene Ebene.
Genau so ist es hier bereits für Waffen gebaut.

---

## 3. Dribbeln: prellt der Ball, oder wackelt er?

### 3.1 Die Kurve, die heute läuft

```js
const BK_DRIBBEL_PERIODE=0.5;     // Sekunden je Bodenkontakt — ~2 Dribbel/s
const BK_DRIBBEL_AMPLITUDE=13;    // px, wie tief der Ball Richtung Boden eintaucht
…
const dribbelPhase=(neuT%BK_DRIBBEL_PERIODE)/BK_DRIBBEL_PERIODE;
const dribbelDip=Math.sin(dribbelPhase*Math.PI)*BK_DRIBBEL_AMPLITUDE;
fsBall={sichtbar:true,x:traeger.x,y:traeger.y+18+dribbelDip,traegerId:traeger.id};
```

Gezeichnet wird der Ball als 18×18-Sprite bei `(bx−9, by−35)`, Mitte also `by−26` (Z. 8392). Die
Figur steht mit den Füßen bei `traeger.y+18` (Kommentar Z. 2152, Sprite 64 px hoch, Kopf bei
`y−46`). Daraus die Bildpositionen:

| Phase | `dribbelDip` | Ballmitte (relativ zu `traeger.y`) | Ball-Unterkante | Abstand zur Fußlinie (+18) |
|---|---|---|---|---|
| 0 (Hand) | 0 | −8 | +1 | 17 px |
| 0,25 | 9,2 | +1 | +10 | 8 px |
| 0,5 (Boden) | 13 | +5 | +14 | **4 px** |
| 0,75 | 9,2 | +1 | +10 | 8 px |

Der Ball erreicht den Boden also fast. Die Amplitude ist nicht das Problem. Drei Dinge sind es:

1. **Kein Schatten.** Der Spieler hat einen (Z. 2059 ff.), der Ball nicht. In einer Draufsicht
   mit Schräge ist „13 px nach unten im Bild" nicht von „13 px nach vorn auf dem Boden" zu
   unterscheiden — das Bild trägt keine Höheninformation. Ein Schatten, der bei `traeger.y+18`
   liegen bleibt (kleiner und heller, wenn der Ball oben ist), macht den Bodenkontakt zum
   Moment, in dem Ball und Schatten sich berühren. Das ist die Standardlösung in jedem 2D-Spiel
   mit springenden Objekten, und der Grund, warum der Puck (flache Ellipse mit Schatten, Z. 8380)
   sofort „liegt", der Ball aber „schwebt".
2. **Die Kurve hat den Knick an der falschen Stelle.** `sin(φπ)` für φ∈[0,1) ist ein Halbbogen:
   Steigung +π·A bei φ=0, glatter Scheitel bei φ=0,5, Steigung −π·A bei φ=1. Der *Knick* (die
   Richtungsumkehr mit Sprung in der Steigung) liegt bei φ=0 — **an der Hand**. Der *weiche
   Bogen* liegt am **Boden**. Ein echter Ball macht es umgekehrt: Der Bodenkontakt ist ein
   Stoß (Rücksprung 1,2–1,4 m aus 1,8 m, Restitution ≈ 0,82–0,88 nach Ballnorm), die Hand
   fängt ihn weich und drückt ihn wieder. Mit `1−|cos(φπ)|` statt `sin(φπ)` liegt der Knick
   unten und der Bogen oben; das Aufprall-Geräusch (Z. 7658, feuert bei ungeradem
   Halbperioden-Index) bleibt an derselben Stelle, weil der Tiefpunkt weiterhin bei φ=0,5 sitzt.
3. **Der Ball hängt an `traeger.x`, nicht an der Hand.** Siehe Weg A in 2.3.

### 3.2 Ist das Tempo plausibel?

Belegen lässt sich wenig. Was belegt ist:

- **Ballnorm:** aus 1,80 m fallen gelassen springt der Ball auf 1,20–1,40 m zurück
  (Regelzitate in mehreren Quellen, Abschnitt 7).
- **Fallzeit aus Hüfthöhe** (≈ 1,0 m): `t = √(2h/g) = 0,45 s`. Ein passiv fallender Ball braucht
  für Ab- und Aufstieg also ≈ 0,9 s je Prellen (≈ 1,1 Hz). Die 2 Hz des Motors (0,25 s abwärts)
  setzen voraus, dass die Hand den Ball mit ≈ 2,2 m/s nach unten *stößt* — das ist ein
  Tempodribbling, kein Gehen mit Ball. Rechnung, keine Quelle.
- **Gemessene Frequenzen:** Das HAR-Paper (Hang-Time, arXiv 2305.13124) berichtet nur, dass
  „the experts have a higher rate of dribbles per second than the novices"; die MDPI-Studie
  (Kim et al. 2023) definiert Tempi *relativ* zum Vorzugstempo (40 %/80 % zwischen bevorzugt und
  maximal) und nennt keine Hertz-Zahl. **Eine absolute Dribbelfrequenz ist nicht belegt.**
- **NBA-Charting (82games):** 42 % aller Abschlüsse fallen nach 0 Dribblings, 19 % nach 3+; im
  Mittel 2,7 Touches je Ballbesitz. Das sagt nichts über die Frequenz, aber viel darüber, wie
  *kurz* der Ball beim Einzelnen ist — und dass unser Motor mit `reevBall` 0,4–1,2 s je
  Entscheidung (Z. 6112) und Schussuhr 8 s ohnehin nur wenige Prellen je Ballbesitz zeigt.

Empfehlung: **Periode 0,5 s belassen** (2 Hz ist als Tempodribbling plausibel und bleibt bei 4×
synchron, s. Kommentar Z. 4448), aber die Periode an das Tempo koppeln: steht der Ballführer
(`|vx|+|vy|<3`), Periode 0,75 s; läuft er, 0,5 s; im Fastbreak 0,4 s. Das ist die Faustregel
„langsam gehen = hoch prellen", ohne dass eine Konstante die andere bricht.

### 3.3 Wie es offene Spiele lösen

Von den gefundenen Repos (FeverBasketball/NetEase, Basketball GM/zengm, tony-mtz/nba-simulation,
NateWritesCode/basketball-simulator, hichemcesar24/Basketball-Game-2D mit Phaser) zeichnet
**keines** ein Dribbling in Draufsicht — FeverBasketball ist 3D, die übrigen sind Zahlenmotoren
ohne Bild. Die Phaser-Spiele in der Suche sind Wurfspiele (Ball fliegt, prellt nie in der Hand).
Es gibt für dieses Detail also kein offenes Vorbild, das man abschreiben könnte; das
Schatten-plus-Knick-Muster oben ist die allgemeine 2D-Regel, keine Basketball-Sonderlösung.

### 3.4 Sichtprüfung nach dem Umbau

`scripts/zeige-feldspiel-arena.mjs basketball <ordner> 3 12` rendert über `file://`; dann
fehlen alle `/sprites/basketball/*.png` (Rückfall-Zeichnung). Für eine echte Sichtprüfung muss
`public/` über HTTP kommen — mein Scratch-Skript startet dafür `python3 -m http.server` und lädt
`http://127.0.0.1:8765/mockups/battle-mode.html`. Das gehört in das Werkzeug selbst; sonst
prüft man Bilder, die der Spieler nie sieht.

---

## 4. Was ein 2K-Fan noch vermisst — Inventar gegen Referenz und Ist-Stand

Die Rangtreue-Runde (NBA2K-Modell-Plan) hat die *Auflösung* (wer trifft, wer holt den
Rebound) auf 2K-Niveau gehoben. Was fehlt, sind die *Situationen*, in denen 2K seine Ratings
wirken lässt. Je Mechanik: NBA-Referenz, was die beiden lesbaren Vorbilder (2K aus
Courtside-Reports, zengm aus dem Quelltext) tun, was der Motor tut, und die Lücke.

### 4.1 Ballverluste und Steals — die größte Abweichung im ganzen Motor

| | Motor (24 Spiele, beide Seiten) | je 100 Ballbesitze | NBA | Faktor |
|---|---|---|---|---|
| Ballverluste | 30,4 je Spiel bei 99,6 Ballwechseln | **30,5** | 14,3 / 100 (2024-25), 13,6 (2023-24) | **2,1×** |
| Steals | 25,7 | **25,8** | 6,8–10,3 je Team und Spiel bei ~100 Ballbesitzen | **~3×** |
| Anteil Steals an Ballverlusten | 84 % | | ~55 % (7,5 von 14) | |
| Blocks | 3,3 | 3,3 | 4,0–5,7 je Team, also 8–11 je Spiel | **0,35×** |
| Fouls | 2,3 | | 37,2 je Spiel (2024-25, beide Teams) | **0,06×** |

Im Beispielspiel Saat 1337 macht Greenkraut (Eignung 40,6) **zehn Steals**, Draco verliert
**acht** Bälle. Das ist die Zahl, die ein 2K-Fan als erstes anspricht, und sie ist ein
Validitäts- kein Verlässlichkeitsproblem (CLAUDE.md: „Sind beide niedrig, belohnt die Mechanik
das Falsche"): jeder Steal ist ein Zufallsereignis, das den Ballbesitz beendet, bevor die
Wurfauflösung — der einzige Ort, an dem die neue Kurve wirkt — überhaupt erreicht wird. Ein
Drittel aller Angriffe endet heute, bevor jemand wirft.

zengm rechnet die Ballverlust-Chance je Ballbesitz aus einem Team-Verhältnis
(`0.14·def / (0.5·(dribbling+passing))`, `probTov`) und lost *dann*, wer verliert; Steals sind
ein Anteil davon (`probStl`). Der Motor würfelt stattdessen je Decker und Tick mit eigener
Abklingzeit (`versucheSteal`, seit der Überzahl-Runde über *alle* Decker, Z. 7665 ff.). Der Hebel
ist eine Kalibrierung auf **~14 Ballverluste je 100** mit Steal-Anteil ~55 % — und der billigste
Weg dorthin ist derselbe, der auch 4.2 löst: ein misslungener Steal-Versuch ist ein Foul.

### 4.2 Fouls, Freiwürfe, Foul Trouble

**NBA:** FTA/FGA .244 (2023-24), 29,8 FTA je 100 FGA (2025-26 früh), 37,2–45,7 Fouls je Spiel.
Sechs Fouls = Ausschluss; Q+1-Regel; Trainer ziehen den Spieler in >70 % der Fälle sofort
(Maymin/Maymin/Shen via Slate).

**zengm:** `getFoulTroubleLimit()` = `ceil(Spielanteil·6)`, mindestens 2, höchstens 5 — „the limit
by quarter is 2/3/5/5"; am Limit `getFoulTroubleFactor` 0,75, darüber 0,1 auf die
Einsatz-Bewertung (Spieler geht auf die Bank); in den letzten 8 Minuten und in der Verlängerung
kein Foul Trouble. Nicht-Wurf-Fouls 8 % je Ballbesitz, Bonus ab Team-Foul-Grenze, absichtliche
Fouls am Ende (`clockFactor === "intentionalFoul"`).

**Motor:** Fouls nur beim Wurf und nur, wenn ein `blockKandidat` steht (Z. 6155–6162):
`foulBasis` 0,16/0,10/0,05 nach Distanzstufe, minus `(ABWEHR−50)·0,0016`. Ergebnis **2,3 Fouls je
Spiel** für beide Teams zusammen. Keine Nicht-Wurf-Fouls, keine Team-Fouls, kein Bonus, kein
Ausschluss, kein Foul auf Steal-Versuche. Der Schiedsrichter (29.08.) pfeift also fast nie.

**Lücke und Vorschlag:** (1) Jeder *misslungene* Steal-Versuch ist mit Chance `p_reach` ein Foul
(reach-in) — das senkt Steals (4.1) und hebt Fouls gleichzeitig, eine Konstante für zwei
Kalibrierungen. Zielkorridor: 15–20 Fouls je Team-Spiel-Äquivalent bei Pace 100, FTA/FGA
0,20–0,25. (2) Team-Foul-Bonus ab dem 5. Foul je Viertel (NBA-Regel) — die Freiwurf-Standphase
existiert schon (`starteFreiwuerfe`). (3) Foul Trouble ohne Bank: bei 6 gegen 6 gibt es keine
Auswechslung, also keinen Ausschluss. Stattdessen zengms Faktor als **Vorsichts-Malus**: ab dem
Q+1-Limit sinkt die Steal-/Block-Bereitschaft des Spielers (0,75), ab dem 5. Foul stark (0,1) —
genau das, was Maymin als „afraid of picking up another foul" beschreibt, und es ist ein Kanal,
über den `ABWEHR`-schwache Spieler *sichtbar* Nachteile erleiden. Ein 2K-Fan kennt die
Foul-Anzeige in der Kaderleiste; sie ist der billigste sichtbare Baustein.

### 4.3 Kontest: Radius, Distanz, Größe

**NBA-Tracking:** vier Klassen nach Deckerabstand (0–2, 2–4, 4–6, 6+ ft). Dreier 2015-16: 39,4 %
wide open, 41,7 % open, 17 % tight, 1,7 % very tight; wide-open-Quote 38,6 %. Die Quoten der
engeren Klassen habe ich nicht aus einer abrufbaren Seite belegen können (NBA.com Stats ist
JS-gerendert) — **nicht belegt**, nur die Klassen und Anteile.

**2K25:** „dynamic weighting system … evaluates the impact of defense at the start of the shot
versus the release"; Perimeter/Interior Defense und *Größenunterschied* gehen ein. 2K26-Update:
„well-positioned and well-timed contests further narrowing the shooter's green window".

**Motor:** `BEDRAENGT_RADIUS=30` px als harte Schwelle (Z. 4312), `kontestFaktor` aus dem
Paar-Abstand `ABWEHR − schussSkill` (Rangtreue-Runde), `HILFE_RADIUS=90` für Doppeln. Größe
(`u.groesse`, `groesseFaktor`) wirkt **nur auf die Zeichnung** (Z. 2155 ff.), nie auf den
Kontest. Und die gemessene Quote nach Deckerabstand ist nicht monoton: 0–10 px 64,3 %, 10–20 px
42,2 %, 20–30 px 51,9 %, ≥30 px 44,1 %. Das erste Band sind Dunks (GEO-Bonus), das dritte ist
höher als das zweite und das vierte — der Abstand allein trägt die Kalibrierung nicht.

**Lücke:** Kontest als stetige Funktion des Abstands (nicht Schwelle 30 px), tier-isoliert
kalibriert, plus ein Größenterm (2K25s „height differential") aus dem vorhandenen `u.groesse`.
Abnahmezahl: FG% je Abstandsband muss *innerhalb jeder Distanzstufe* monoton fallen. Die
Probe liefert `fgBandV/fgBandT` schon je Spieler; die Tier-Isolierung fehlt dort noch.

### 4.4 Schussuhr

**NBA (82games, 2003-04):** 0–10 s 112,3 Punkte je 100, 11–15 s 102,3, 16–20 s 100,6, 21+ s
91,8; ≤5 s Restzeit 34,45 % FG, ≥20 s 52,11 % (Suchtreffer-Auszug). Je später, desto schlechter
der Wurf.

**zengm:** `rushed = t < 2 && possessionLength < 6` → `probMake *= √(possessionLength/8)`;
Wurfzeitpunkt `truncGauss(6.25 s, σ 5)` nach Ankunft im Vorderfeld, bei `catchUp` 5 s, bei
`maintainLead` 12 s.

**Motor:** Schussuhr 8 s Simulationszeit (16 s Zuschauzeit bei `ZEIT_DEHNUNG.basketball=2`),
`erzwingen` wirft immer, klassifiziert nach echter Distanz (Opus-Fund #4), **dieselbe
Erfolgsformel wie ein freiwilliger Wurf** (Z. 6009–6027). Ein Zwangswurf nach 8 s trifft also so
gut wie ein Wurf nach 2 s. Der Kommentar Z. 4075 hält fest, dass 8→6→5 s die FGA nicht bewegt
haben — die Uhr ist heute kein Balance-, sondern ein Endlosschleifen-Schutz.

**Lücke:** ein Restzeit-Malus auf `technik` im `erzwingen`-Zweig (zengms Wurzel-Faktor ist die
einfachste Form) und eine Uhr im HUD, die der Zuschauer sieht — beides klein. Ob die Uhr im HUD
schon steht, habe ich nicht geprüft.

### 4.5 Fastbreak

**NBA:** 15,4 % der Ballbesitze in Transition, 125,8 gegen 98,1 Punkte je Play (CTG 2025-26);
67,1 % der Steals werden zu Transition. 2014-15: 13,8 %.

**Motor:** `startFastbreak` nach Steal/Interception/Defensiv-Rebound, Fenster 3 s, `+0.12` auf
`technikMake`, Tempo 1,3×, Ausbruch für den schnellsten Mann gegen den schnellsten Gegner
(`AUSBRUCH_*`). Das ist strukturell richtig und wurde in der Rangtreue-Runde als Hauptquelle des
speed-Anstiegs erkannt (Pp 15,1 → 19,2 %).

**Lücke:** nicht gemessen. Die Probe trägt `imFastbreakBeiWurf` je Wurf, aber kein Aggregat
(Anteil der Würfe im Fastbreak, FG% im Fastbreak gegen Halbfeld). Zwei Zahlen, die gegen
15 % / +28 Pkt je 100 zu halten wären, bevor irgendjemand an `+0.12` dreht.

### 4.6 Pick-and-Roll

**NBA (Synergy via Bleacher Report):** 16,4 % (2009-10) → 21,8 % (2013-14) der Ballbesitze;
Ballführer 0,79 PPP, Roll-Mann ≥ 0,84; Spurs 23 % mit 0,88/0,97. Roll-Männer sind effizienter,
weil sie näher am Korb abschließen.

**Motor:** existiert seit „Fables Fund" (Z. 6092 ff.): wenn weder Wurf noch Pass, mit
`screenChance` 0,05–0,30 (aus `AUFBAU`) ein Screener per `losGewicht(ZWEITCHANCE)`, Screen
1,2 s, dann Roll 1,5 s mit Passgewicht ×3; der Decker des Ballführers wird durch die
Screen-Bremse auf 0,35× gebremst (Z. 7263, 7351). Alles mit `PLATZHALTER` markiert.

**Lücke:** (1) keine Abnahmezahl — wie oft kommt ein Screen, wie oft endet der Angriff beim
Roll-Mann, mit welcher Quote? (2) keine Verteidiger-Entscheidung: real wählt die Verteidigung
zwischen Switch, Hedge und Drop, und genau daran hängt, ob der Roll-Mann frei ist. Ein einziger
Würfel über `ABWEHR`+`TEAMGEIST` des Screener-Deckers (Switch ja/nein) würde den Mismatch
sichtbar machen, den `MISMATCH_*` schon kennt. (3) Screener-Wahl nur nach `ZWEITCHANCE` — der
Roll-Abschluss läuft dann über `SCHUSS_NAH`; für einen „Rebound-Monster"-Slot ist das richtig,
für einen Pop-Screener falsch. Kleine Runde, gut messbar.

### 4.7 Clutch und Endspiel

**NBA:** Clutch = letzte fünf Minuten, ≤ 5 Punkte Abstand. Liga-eFG% Normal 46,6 %, Clutch
45,9 %, Clutch² 37,5 % (inpredictable). FG% fällt am Ende enger Spiele in 10 von 11 Saisons
signifikant, 3P% nicht; 25 „clutch" gegen 109 „choking" Spieler-Saisons (Sarioz, Berkeley). Hot
Hand: +1,2 % je vorherigem Treffer *nach* Schwierigkeitskorrektur, und heiße Schützen werden
enger gedeckt (Bocskocsky et al.).

**2K:** Clutch-Shooter-Badge, Hot/Cold Zones („about a 5% boost", Schwellen 60/55/50/40 %),
Takeover. **zengm:** Ermüdung zählt spät weniger (`(energy+factor)/(1+factor)`, `factor =
6 − t/60`); Foul Trouble aus in den letzten 8 Minuten; Dreier erzwungen bei 3–10 Rückstand und
≤ 10 s (`forceThreePointer`); absichtliches Foulen; Auszeiten; Blowout-Wechsel ab 30/25/20/15/10
Punkten je Restzeit.

**Motor:** `liegtZurueck` existiert (Z. 5128) und wirkt **nur** auf `zuordneSlots`. Kein
Endspiel-Wissen im Entscheidungscode, keine Auszeit, kein absichtliches Foul, kein Zwei-für-eins,
kein Verzweiflungswurf zum Buzzer (die Uhr läuft einfach aus, Kommentar Z. 5520). Das Rezept hat
einen `clutchshot`-Slot (`SCHUSS_FERN +4, SCHUSS_NAH −2`, Z. 4499) und eine Spielzug-Karte
„Clutch Shot" (Spirit/Charisma), beides ohne Situationsbezug.

**Lücke, mit Vorsicht:** Die Literatur sagt, dass „Clutch-Fähigkeit" als Spielereigenschaft
nicht existiert — wohl aber, dass *alle* am Ende schlechter werfen (engere Deckung, schlechtere
Würfe). Für den Motor heißt das: kein Clutch-Rating, sondern **Situationslogik**: (1) letzte
Possession bei 3 Rückstand → Dreier erzwingen (zengm-Regel wörtlich übertragbar); (2) letzte
Sekunden → Wurf statt Uhr auslaufen lassen; (3) in den letzten 10 % der Spielzeit bei ≤ 5
Abstand `BEDRAENGT_RADIUS` leicht weiten (engere Deckung, wie SportVU sie zeigt). Das Konstanz-
Stat (gameplay-grundmodell C) bleibt davon unberührt.

### 4.8 Ermüdung

**Rezept:** `AUSDAUER` ist im Basketball-Live-Motor **mechanisch tot** (`rezepte.js` Z. 80–81:
„wird von der Basketball-LIVE-Engine ueberhaupt nicht gelesen"; Gewicht 0,0 → 0,1). Der
einzige Verbraucher `ermued` sitzt im Vorab-Modell (Z. 4637).

**zengm:** `fatigueFactor 0.055` je Minute, Erholung `+0.016` je Ballbesitz auf der Bank,
Ermüdung skaliert *alle* Composite-Ratings, spät im Spiel abgeschwächt. **2K:** Stamina-Balken,
Adrenaline (3 Boosts je Ballbesitz, danach langsamer).

**Lücke:** Ein toter Sub-Skill ist per Konstruktion Validitätsverlust (Attribute mit
Matrixgewicht, die nichts bewegen). Mit vier Vierteln und Slot-Rotation (#719) gibt es den
Rahmen: `tempoPx` und `reevBall` je Viertel um `(60−AUSDAUER)·k·Viertelanteil` dämpfen — zengms
Form, unsere Konstante. Adrenaline (Sprint-Budget je Ballbesitz) ist der natürliche Ort für
`AUSDAUER` im *Ausbruch* (`AUSBRUCH_FENSTER`): schnelle, ausdauerschwache Spieler reißen aus,
halten es aber nicht.

### 4.9 Wurfverteilung — zu viele Dreier

| Distanzstufe | Motor: Anteil | Motor: Quote | NBA |
|---|---|---|---|
| dunk | 15,2 % | 89,1 % | — |
| nah | 20,0 % | 46,4 % | — |
| mit | 16,1 % | 34,9 % | — |
| fern (Dreier) | **48,7 %** | 34,2 % | 3PA/FGA **39,5 %** (2023-24), 42,1 % (2024-25), 41,7 % (2025-26 früh); 3P% 36,6 / 36,0 % |

Fast jeder zweite Wurf ist ein Dreier — 7–9 Punkte über der dreierlastigsten Liga der
Geschichte, bei einer Quote, die zwei Punkte *unter* dem Ligaschnitt liegt. Die Ursache steht
im Kommentar zu `GEO_BONUS` (Rangtreue-Runde): offene Würfe sind überwiegend Fernwürfe, weil
die Slots außen frei stehen. Ein 2K-Fan liest das als „jeder wirft wie Curry". Abnahme: Anteil
`fern` in den Korridor 38–42 %, ohne dass `MAKE_ANKER.fern` (36,2 %) wandert. Der Hebel sitzt
nicht in der Trefferformel, sondern in der Wurfauswahl (`waehleZiel`, `schwelle`) — und hängt
mit 4.1 zusammen: weniger Steals heißt mehr Angriffe, die bis zur Zone kommen.

### 4.10 Kleinere Stücke, die 2K hat und wir nicht

| Mechanik | 2K / NBA | Motor | Aufwand |
|---|---|---|---|
| Assist-Anteil | NBA: 0-Dribbling-Abschlüsse 86 % assistiert (82games) | 15,9 Ast je 35,2 FGM = 45 % | Messen reicht; `ASSIST_FENSTER` 1,6 s ist plausibel |
| And-One | zengm `probAndOne` 0,25 am Ring, 0,01 Dreier | `undEins` existiert (Z. 4746) | vorhanden |
| Putback | zengm eigener Wurftyp nach OREB (Make 0,54 + 0,41·Rating) | Rebound → normaler Angriff | klein |
| Hot Zones | 5 % Bonus je Zone | Slot-Modifier `BASKETBALL_POS_MOD` (statisch) | nicht nötig, Slot deckt es |
| Heimvorteil | zengm `homeCourtAdvantage` auf alle Ratings | — | für die Olympiade ohne Bedeutung |
| Auszeit | zengm, Anzeige | — | nur Kosmetik |
| Sprungball/Anfang | zengm `jumpBallWinnerStartsThisPeriodWithPossession` | Ballbesitz gesetzt | Kosmetik |

---

## 5. Prioritäten

1. **Ballverluste und Steals auf NBA-Maß** (30,5 → ~14 je 100, Steal-Anteil 84 % → ~55 %). Der
   größte Validitätsfehler im Motor und der einzige, der ein Drittel aller Angriffe vor der
   Wurfauflösung abbricht. Abnahme: ρ darf nicht fallen, FGA je Spiel muss steigen (die Lücke
   „41 statt ≥ 45" aus der Rangtreue-Runde wäre damit geschlossen, ohne die Uhr anzufassen).
2. **Fouls über Reach-in und Team-Bonus** (2,3 → 15–20 je Team-Spiel-Äquivalent, FTA/FGA
   0,20–0,25), plus Foul-Trouble-Malus statt Ausschluss. Dieselbe Konstante wie 1.
3. **Kontest stetig und mit Größe**, tier-isoliert kalibriert, Monotonie als Abnahmezahl.
4. **Endspiel und Schussuhr** — vier kleine Regeln (Zwangswurf-Malus, Dreier bei −3, Wurf zum
   Buzzer, engere Deckung spät). Billig, sichtbar, ohne Balance-Risiko.
5. **`AUSDAUER` verdrahten** (toter Sub-Skill).
6. **Pick-and-Roll messen, dann Switch-Entscheidung.**
7. **Optik in einer Runde:** Ständer + 11 px, Zone auf `W`, Ballschatten, `1−|cos|`, Ball an die
   Handpunkte, `spellcast` als Wurf, `idle` im Stand. Nichts davon fasst die Simulation an.

---

## 6. Was diese Recherche nicht anfasst

Keine Motoränderung (Auftrag). Die drei anderen Feldspiele, die Chassis, das PPs-Modell, das
Konstanz-Stat, `SPIELDAUER_BASKETBALL`, `ZEIT_DEHNUNG`. Die Zahlen aus der Rangtreue-Runde
(ρ 0,786 je Spiel, 0,881 Saison) sind bestätigt und bleiben die Abnahme.

---

## 7. Quellen

**Abgerufen und zitiert**

- judgemate.com, „Basketball Court Dimensions: FIBA vs NBA" — Brett 1,20 m, Ring 15 cm/45 cm, Zone 4,9×5,8 m, Dreier 6,75/6,60 m, NBA 7,24/6,70 m.
- Wikipedia „Basketball court" — Feldmaße, Freiwurflinie, Zone 16 ft.
- 82games.com/dribbles.htm — Touches, Dribblings je Abschluss, Aktionen je Touch.
- 82games.com/clock.htm — Schussuhr-Fenster, Anteile, Punkte je 100 (2003-04).
- cbssports.com „Wide-open 3s …" — Kontest-Klassen und Anteile 2015-16, wide-open 38,6 %.
- cbssports.com „Sprint & grind …" (2021-22) — Memphis 19 %, Toronto 18,4 %, Charlotte 16,9 % Transition.
- cbssports.com „Push it real good …" (2014-15) — 13,8 %, 1,10 PPP.
- cleaningtheglass.com/stats/league/context — 15,4 %, 125,8 / 98,1, 67,1 % nach Steals (2025-26).
- bleacherreport.com „How important is the pick-and-roll …" — Synergy-Zahlen 2009-14.
- inpredictable.com Clutch Shooting Report — Liga-Benchmarks Grbg/Nrml/Cltch/Cltch².
- inpredictable.com 2014 „Shooting performance: clutch vs garbage" — Definition über WPA, „no dramatic differences".
- Sarioz, „An Analysis of Late-Game Shooting Performance in the NBA", Berkeley Honors Thesis — PDF geladen, Text extrahiert.
- Bocskocsky/Ezekowitz/Stein, „Heat Check" (SSRN 2481494) — Suchtreffer-Auszug.
- Slate 2012, „Foul trouble in NBA Finals …" — Q+1, >70 %.
- NYU Tandon News zu Maymin/Maymin/Shen — „afraid of picking up another foul".
- nba.com „2023-24 NBA Stats Survey" — Ligaschnitte 2023-24.
- nba.com „10 numbers to know from the first 10 days of the 2025-26 season" — Fouls, FTA je 100 FGA, TO/100, Pace.
- statmuse.com „nba team stats per game 2024-25" — Team-Spannen.
- 2KIntel (X) zum 2K25 Courtside Report — Kontest-System; operationsports.com zum 2K26-Kontest-Update.
- realsport101 / dbltap — Adrenaline Boosts.
- nba2kw.com — Hot Zones (2K24).
- github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator, Issue #38 — Animationsliste, Carry-Wunsch; Repo per Sparse-Clone, Blätter angesehen.
- github.com/zengm-games/zengm, `src/worker/core/GameSim.basketball/index.ts` — Sparse-Clone, gelesen.
- github.com/NeteaseFuxiRL/FeverBasketball — README (Halbfeld 11,4×15 m, 20-s-Uhr, 1v1–3v3).
- tcrf.net „NBA Jam (SNES)", fabiensanglard.net „NBA Jam TE" — Sprite-Größen, keine Ball-Details.

**Abgewiesen (403/422/404), nicht als Beleg benutzt**

- forums.nba-live.com und www.nba-live.com/forums, „Comprehensive Simulated Stats Mechanics Guide" (403, beide Hosts).
- basketball-reference.com Ligaschnitte (403).
- paytonsoicher.medium.com, ahtan-18882.medium.com (403) — die FG%-nach-Restzeit-Zahlen stammen aus dem Suchtreffer-Auszug.
- harrodsport.com (403), 2kratings.com (403), fivethirtyeight.com (Redirect auf abcnews), nba2klab.com/badges/clutch-shooter (404), statmuse-Langabfragen (422), operationsports-Thread „37 % on wide open 3s" (403), shottracker.com (kein Ligaschnitt auf der Seite).
- arXiv 2305.13124 (Hang-Time HAR): PDF geladen, Text nicht extrahierbar; PMC-HTML-Fassung gelesen, ohne Hertz-Zahl.
- philipmaymin.com, IJSF-2012-PDF: geladen, font-kodiert, nicht extrahierbar.

**Werkzeuge dieser Runde** (alle im Scratchpad, nichts im Repo): `render-http.mjs` (HTTP-Server +
Playwright, Canvas-Abzug), PIL-Zoom und Pixelzeile, `probe-ereignisse.mjs` (Sonde, Summen je
Spiel), LPC-Reihen-Schnitte. Reproduzierbar mit den in Abschnitt „Nachgemessen" genannten Aufrufen.

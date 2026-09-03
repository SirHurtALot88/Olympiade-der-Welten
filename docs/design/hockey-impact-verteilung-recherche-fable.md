# Recherche: Wie sich der Wert EINES Hockeyspielers auf Kanäle verteilt — real, in offenem Code, und warum bei uns ZWEITCHANCE die Hälfte trägt (Fable)

Stand: `eed9f61b` (Motor zeichengleich mit `8dc84052`, der Angleichung der Hockey-Wertformel an
den NHL Game Score). Alle `engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf
diesem Stand. Gemessen mit drei eigenen Sonden im Scratchpad (Abschnitt 0.2), die **nur lesen**
— die einzige Instrumentierung (ein `logZug` für Pässe) lief in einer Kopie des Motors, kein
Motor im Repo wurde angefasst. Kein Rezept, keine Motoränderung: das ist ein Bericht.

Auftrag, wörtlich: *„recherchiere, wie echte Eishockey-Analytik und offener Spielcode die
Wertigkeit EINES Spielers über mehrere Kanäle verteilen, nicht nur über Torschuss/Puckgewinn"*,
und die konkrete Frage: *„Was in der HOCKEY-MECHANIK selbst (nicht im Rezept) sorgt dafür, dass
ZWEITCHANCE so dominant ist? Trägt Passspiel (AUFBAU) überhaupt zu Toren bei?"* Die Schranke aus
CLAUDE.md gilt: rho in EINEM Spiel, Ziel über 0,80 — und **mehr Ereignisse helfen bei Hockey
nachweislich nicht** (verdoppelte Spielzeit: Verlässlichkeit 0,755 → 0,85, rho flach bei
0,719/0,721/0,723). Dieser Bericht schlägt deshalb an keiner Stelle mehr Zeit oder mehr
Schüsse vor. Die Wand ist Validität, und die Frage ist, WELCHER Kanal fehlt.

---

## Die Antworten, ohne Architekturwissen lesbar

**Passspiel trägt bei uns zu Toren praktisch nichts bei — und das ist die Ursache, nicht ein
Symptom.** Nachgemessen über 24 Spiele: 59,5 Pässe je Spiel (beide Teams, 4 Minuten), nur 26 %
aller Ballbesitze enthalten überhaupt einen Pass, und ein Schuss direkt nach einem Pass trifft
zu **6,9 %** — ein Schuss ohne Pass zu 8,4 %. Der Pass erhöht die Torchance also nicht, er
senkt sie leicht. Von 163 Toren hatten **27 (17 %) eine Vorlage**; in der NHL 2023-24 hatten
**77,8 % aller Tore ZWEI Vorlagen** (Sound Of Hockey). AUFBAU hat im Motor neun Anschlussstellen
(Abschnitt 4.2) — Spielmacher-Los, Passbereitschaft, Fehlpassquote, Assist-Fenster, Stealfestigkeit
— aber **keine einzige davon verändert, ob der nächste Schuss reingeht.** Die Trefferformel
(`technikMake`, `engine.js:6060`) liest SCHUSS_NAH/SCHUSS_FERN, TEAMGEIST, Distanz und
Bedrängnis. Punkt. Im echten Eishockey ist genau das Gegenteil belegt: ein Schuss nach einem
Pass quer durch den Slot („Royal Road") wird zu 15,5 % verwertet gegen 6,7 % nach einem Pass
hinter dem Tor (Passing Project, zitiert über NHL.com/Kraken); 76 % aller NHL-Tore fallen auf
„grüne" Schüsse, die eine Puckbewegung quer über die Mittellinie enthalten (Valiquette, The
Hockey News); und die Rate, mit der ein Spieler Schüsse VORBEREITET, sagt seine künftigen
Scorerpunkte dreimal besser voraus als seine eigenen Vorlagen (Stimson, Hockey Graphs 2017).
**Der fehlende Kanal ist eine Passqualitäts-Kette: der Pass, der einen Schuss vorbereitet, muss
dessen Torwahrscheinlichkeit heben, und der Passgeber muss dafür gutgeschrieben werden.**

**ZWEITCHANCE dominiert, weil der lose Puck im Motor der EINZIGE Kanal ist, der stabil an einer
Fähigkeit hängt — und alle anderen Posten von ihm abhängen.** Die Sondierung auf diesem Stand
(Puck-Gewicht 0,2, 24 Läufe) liest ZWEITCHANCE 28,9 %, LAUFTEMPO 25,0 %, TEAMGEIST 20,2 % —
und **AUFBAU, ABWEHR, AUSDAUER, SCHUSS_NAH je 0 %**. Die 42,9/48,6 % aus `8dc84052` stammen
von vor der Gewichtssenkung; die Hälfte ist geblieben, sie heißt jetzt „wer kommt zum Puck
und wer gewinnt ihn" (LAUFTEMPO + ZWEITCHANCE = 54 %). Gemessen: 100,8 lose Pucks je
Spiel gegen 19,4 Steals, 12,7 Checks und 3,2 Fehlpässe — der Puckwechsel läuft fünfmal so oft
über den losen Puck wie über alles andere zusammen. Wer ihn gewinnt, entscheidet
`losGewicht(ZWEITCHANCE)` mit Exponent 3 (`engine.js:3924`; 73 gegen 60 heißt 70 : 30). Die
gewonnenen Pucks sind der verlässlichste Posten im ganzen Boxscore (Test-Retest **0,997**,
Tore 0,75, Vorlagen −0,33) und korrelieren mit der Eignung zu 0,855. Schüsse folgen daraus
(r Rebounds↔Schüsse 0,79) und Tore aus den Schüssen (r 0,60): der Netfront-Spieler holt 19,8
Pucks je Spiel, nimmt **56 % aller Schüsse seines Teams** (NHL-Spitze: Tkachuk/MacKinnon 4,1
von ~30, also 14 %) und schießt 2,83 Tore. Rechnet man die Wertformel offline um, sieht man
es direkt: **nur Pucks+Steals+Checks liefern rho 0,758 je Spiel, nur Tore+Vorlagen 0,339, die
volle Formel 0,683.** Die Wertformel des NHL Game Score (Tor 0,75, Vorlage 0,7/0,55, Schuss
0,075, Block 0,05, kein Puck-Posten) auf unser Protokoll gelegt ergibt **0,474**. Das ist die
ganze Diagnose in einer Zahl: die Mechanik belohnt das Richtige nur dort, wo sie den Puck
verteilt — Tore und Vorlagen, die im echten Spiel 80 % des Werts tragen, entstehen bei uns
nicht dort, wo die Eignung sitzt. Ein Rezept mit halbem Budget in ZWEITCHANCE würde rho
heben und die Disziplin genau deshalb eindimensional machen; die Vermutung im Commit-Log
(„erst muss die Mechanik ihre Masse breiter verteilen") ist damit nicht nur bestätigt,
sondern lokalisiert.

**Was „Scheibe gewinnen" real wiegt: sehr wenig als eigener Posten, sehr viel als Anfang von
etwas.** Der Game Score (Luszczyszyn 2016) kennt keinen Posten für lose Pucks, Takeaways oder
Hits; ein Bully-Gewinn zählt 0,01 gegen 0,75 für ein Tor — und das deckt sich mit der
unabhängigen Messung, dass es rund 76 gewonnene Bullys mehr als verlorene braucht, um ein Tor
Differenz zu erzeugen (Schuckers/Pasquali/Curro 2012, über theleafsnation). Die GAR-Modelle
(Evolving-Hockey) bauen den Wert aus Toren, Vorlagen, Schüssen, xG und Relativ-Raten; Takeaways
gehen nur als eine von vielen Eingangsgrößen in die Defensiv-Komponente. Hit-Differenzen
korrelieren mit Tor-Differenzen NEGATIV (Hockey Graphs 2015). Gleichzeitig beginnen 59,4 % aller
Ballbesitze mit einem Loose-Puck-Recovery (Boucher/Sportlogiq, ~1000 Spiele) — der Puckgewinn
ist real allgegenwärtig, aber er ist WERT, was danach damit passiert: der kontrollierte
Zoneneintritt (0,57 Schüsse je Carry-in gegen 0,12 je Dump-in, Tulsky 2013; 0,66 gegen 0,29,
Sznajder), der Pass in den Slot, der Schuss. In der Sprache dieses Projekts: der lose Puck
gehört in der Wertformel auf Block-Niveau (da steht er seit `8dc84052` mit 0,2), aber die
MECHANIK muss ihm etwas nachschalten, an dem eine andere Fähigkeit hängt. Heute schaltet sie
ihm den Schuss desselben Spielers aus 58 Pixeln nach.

**Offener Code macht es an einer Stelle richtig, an zweien falsch — und beides ist lehrreich.**
`archibalduk/hockey_match_engine` (GPL-3, C++, ausdrücklich „vibe-coded" mit Claude) hat die
Kette, die uns fehlt: ein gelungener Pass in der Angriffszone löst zu 10 % einen One-Timer aus,
der die Schussqualität um +0,06 hebt (`engine/match_engine.cpp:resolvePass`,
`core/tuning.h:kOneTimerBonus`), Vorlagen entstehen automatisch aus einer Berührungskette
(`lastTouch_[0]`, `[1]`), und die Spielerbewertung (`consumers/rating_calculator.cpp`) wiegt Tor
1,3, Vorlage 0,9/0,6, Schuss 0,06, Hit 0,06, Interception 0,06, Bully ±0,02, Turnover −0,08 —
ohne Posten für lose Pucks. `skyre5/Elite-Hockey-Manager` (MIT, C#) dagegen lost die zwei
Vorlagengeber **zufällig** aus den fünf Spielern (`Game.cs:GetSkatersForPlay`), Passspiel
existiert nicht; das ist genau die Falle, in die ein reiner Boxscore-Ansatz läuft. ZenGM Hockey
(kein Open-Source-Lizenzmodell, Code nur einsehbar) beschreibt sein Passing-Rating mit einem
Satz, der als Bauanleitung taugt: *„Increases the quality of shots that teammates get."*

**Was der frühere Bericht schon sagte und was davon nicht umgesetzt ist** (Abschnitt 5): der
`abprallerFaktor ×2,5` und `ablenkerFaktor ×1,8` aus der xG-Tabelle (dort 8.4) stehen nicht im
Motor; der Rollout-Plan B.2 hatte ABSCHLUSSDRANG als *Auswahlgröße* („Schussanteil") und
LINIENSPIEL („Vorlagen") als eigene Sub-Skills vorgesehen — beides sind Kanäle, die dem Star
Schüsse und Vorlagen über etwas anderes als den Standplatz zuweisen würden; und die Warnung,
dass ein Sub-Skill „an einen echten Kanal, nicht an ein Gate" gehört, trifft heute AUFBAU.

---

## 0. Was ich selbst nachgemessen habe, was ich abgerufen habe, was ich nur gelesen habe

### 0.1 Nachgemessen (Playwright/Chromium `/opt/pw-browsers/chromium-1194`, 24 Spiele, 6 je Seite, Saaten `1337+i·7919`, Formkarten `20260823+i·104729` — dieselben wie `feldspielProbe`)

| Zahl | Sonde | Ergebnis |
|---|---|---|
| rho je Spiel / Saison, Feldspieler, aktuelle Wertformel | `miss-hockey-posten.mjs 24` | **0,683 / 0,818** (CLAUDE.md: 0,670 / 0,874 mit `miss-alle-disziplinen`, anderer Torwart-Umgang — Größenordnung deckungsgleich) |
| Masse je Posten (Betrag), Anteil an der Wertsumme | dieselbe | Schüsse 28,1 % · Tore 24,4 % · Pucks 17,0 % · Steals 10,7 % · Verluste 7,8 % · Checks 5,6 % · Strafen 3,2 % · Vorlagen 2,2 % · Blöcke 0,9 % |
| Test-Retest je Posten (gerade gegen ungerade Spiele, Spearman) | dieselbe | Pucks **0,997** · Verluste 0,88 · Checks 0,86 · Schüsse 0,83 · Tore 0,75 · Steals 0,72 · Strafen 0,69 · Blöcke 0,36 · Vorlagen **−0,33** |
| rho(Eignung, Posten) über die Saison | dieselbe | Steals 0,891 · Checks 0,855 · Pucks 0,842 · Schüsse 0,709 · Strafen 0,705 · Verluste 0,442 · Blöcke 0,387 · **Tore 0,268 · Vorlagen 0,094** |
| rho je Spiel, wenn man einen Posten NUR nimmt | dieselbe | Pucks **0,772** · Schüsse 0,654 · Steals 0,347 · Checks 0,350 · Tore 0,327 · Vorlagen 0,031 |
| rho je Spiel, wenn man einen Posten WEGLÄSST | dieselbe | ohne Pucks 0,539 · ohne Schüsse 0,570 · ohne Steals 0,622 · ohne Tore 0,763 (!) · ohne Vorlagen 0,676 |
| Alternative Gewichtssätze auf demselben Protokoll | dieselbe | aktuell 0,683/0,818 · **Game-Score-Gewichte 0,474/0,462** · aktuell ohne Pucks/Steals/Checks 0,471/0,455 · nur Tore+Vorlagen 0,339/0,358 · **nur Pucks+Steals+Checks 0,758/0,879** |
| Mittel je Feldspieler und Spiel | dieselbe | 8,37 Schüsse · 7,61 Pucks · 3,47 Verluste · 1,91 Steals · 1,45 Strafminuten · 1,25 Checks · 0,72 Tore · 0,16 Blöcke · **0,10 Vorlagen** |
| Spielfluss | `miss-hockey-fluss.mjs 24` | 85,6 Schüsse und 6,79 Tore je Spiel (beide) · Stufen dunk 2 % / nah 27 % / mit 28 % / fern 43 % der Schüsse; Trefferquote 19,4 / 13,3 / 4,0 / 6,6 % · 100,8 lose Pucks (27 % offensiv) · 19,4 Steals · 12,7 Checks · 3,2 Fehlpässe |
| Konzentration | dieselbe | der meistschießende Spieler nimmt **56 %** der Schüsse seines Teams |
| Nachschüsse (Parade → offensiver Puck → Schuss) | dieselbe | 14,3 je Spiel = **17 % aller Schüsse, 25 % aller Tore** (40/163); Stufen: 273 nah, 44 mit, 19 fern, 8 dunk |
| Vorlagen | dieselbe | **27 von 163 Toren (17 %)** mit Vorlage |
| Pässe (instrumentierte Kopie) | `miss-hockey-paesse.mjs 24` | 59,5 Pässe je Spiel (beide), 0,69 je Schuss, **26 % der Ballbesitze mit mindestens einem Pass**, 19 % der Pässe enden in Schussreichweite (<330 px); Schuss direkt nach Pass trifft **6,9 %** gegen 8,4 % sonst; 33 % der Schüsse folgen direkt auf einen Pass |
| Wer passt | dieselbe | Draco 16,2 (AUFBAU 43), Greenkraut 14,9 (62), Ralazar 5,7 (43), Lava Golem 5,5 (33) … Tidesprinter 0,04 (AUFBAU **84**, steht im Tor) — Pässe folgen dem Puckbesitz, nicht AUFBAU |

| Sondierung, orthogonales Rezept, Versatz 0 (726 s) | `scripts/sondiere-feldspiel-subskills.mjs hockey 24 0` | **ZWEITCHANCE 28,9 % · LAUFTEMPO 25,0 % · TEAMGEIST 20,2 %** · TECHNIK 11,8 % · ABSCHLUSS 10,5 % · PARADE 2,2 % · SCHUSS_FERN 1,5 % · **AUFBAU 0 % · ABWEHR 0 % · AUSDAUER 0 % · SCHUSS_NAH 0 %** (negative Gewinne klemmt `einflussVon` auf 0) |

Die 42,9 % / 48,6 % aus `8dc84052` wurden VOR der Senkung des Puck-Gewichts von 0,5 auf 0,2
gemessen; auf `eed9f61b` liest ZWEITCHANCE 28,9 % und ist weiter der größte Posten — aber der
zweitgrößte ist jetzt LAUFTEMPO, und beide zusammen (54 %) sind derselbe Kanal: wer zum losen
Puck kommt (`PUCK_LAUF_FENSTER`, Ankunftsgewicht) und wer ihn dann gewinnt. Die Sub-Skills, die
im echten Spiel Vorlagen und Verteidigung tragen, lesen null.

### 0.2 Die drei Sonden

Alle drei liegen im Scratchpad, nicht im Repo, und sind auf `scripts/`-Niveau nachbaubar:

- **`miss-hockey-posten.mjs`** ruft `window.__arena.feldspielProbe("hockey",{n,jeSeite:6})`,
  liest je Spieler und Spiel die Boxscore-Spalten und rechnet die Wertformel aus
  `feldspielWert` (`engine.js:5226`) offline nach — deshalb lassen sich Posten weglassen und
  Gewichtssätze tauschen, ohne ein zweites Mal zu spielen. Torwärter sind ausgenommen (eigene
  Formel).
- **`miss-hockey-fluss.mjs`** ruft `window.__arena.spiele("hockey",saat)` und liest das rohe
  `fsZuege`-Protokoll. Achtung beim Nachbauen: `block`-Ereignisse tragen die Seite des
  VERTEIDIGERS (`logZug(b.side,"block",…)`, `engine.js:6773`), `treffer`/`fehlwurf` die des
  Schützen — wer das nicht spiegelt, zählt Konter als Nachschüsse (mein erster Lauf tat das).
- **`miss-hockey-paesse.mjs`** fährt eine **Kopie** von Mockup, Motor und Rezepten, in der
  `passeAb` (`engine.js:6490`) als einzige Änderung ein `logZug(von.side,"pass",…)` bekommt.
  `logZug` zieht keine Zufallszahl, die Spiele sind zeichengleich; die Zahl der Pässe ist die
  einzige, die es sonst nirgends gibt, weil Pässe im Protokoll nicht vorkommen.

### 0.3 Abgerufen (Websuche/-fetch, Zahlen wörtlich aus der Quelle)

| Kennzahl | Wert | Quelle |
|---|---|---|
| NHL Game Score, Formel | `0,75·G + 0,7·A1 + 0,55·A2 + 0,075·SOG + 0,05·BLK + 0,15·PD − 0,15·PT + 0,01·FOW − 0,01·FOL + 0,05·CF − 0,05·CA + 0,15·GF − 0,15·GA`; Torwart `−0,75·GA + 0,1·SV`; Gewichte „by its frequency to goals", dann „scaled down by 75 percent" | hockey-graphs.com 2016/07/13 (Luszczyszyn) |
| Game Score: Hits, Takeaways, Giveaways | kommen nicht vor; Kriterium „nothing you can't find in a standard boxscore" | dieselbe |
| Bully-Wert | „every 101.6 faceoff wins at even strength is worth a goal, as is every 40.6 … on the power play or while shorthanded"; „approximately 76 more faceoff wins than losses to gain a goal" | Schuckers/Pasquali/Curro 2012, zitiert in theleafsnation.com 2017 (Seite selbst 403, Zahlen aus dem Suchtreffer) |
| Zoneneintritt (Tulsky 2013, 330 Spiele 2011-12) | Carry-in 0,57 Schüsse, Dump-in 0,12; Break-even-Vertrauen 34 % (26 % bei stärkerem Team) | hockeysarsenal.substack.com |
| Zoneneintritt, Replikationen | Sznajder 2014-16: 0,66 gegen 0,29 unblocked shots; Chatel 2022: 47 % gegen 18 % der Versuche führen zu einem Schuss | dieselbe; hockey-graphs.com 2017/08/10 (0,66/0,29) |
| Zoneneintritt, Wiederholbarkeit je Spieler | Forwards: kontrollierte Eintrittsquote R² **0,7219**, Entries/60 0,5566; Korrelation mit Fenwick For/60 0,3103; Out-of-sample 0,2178 | hockey-graphs.com 2017/08/10 |
| Zonenausgang | Carry-/Pass-outs gelingen ~89 %, Dump-outs ~20 %; 230.000 Ausgänge 2016-18 | hockey-graphs.com 2019/07/30 |
| Passing Project: Verwertung nach Passtyp | Royal-Road-Pass **15,50 %**, Pass hinter dem Tor 6,73 %; „the more passes that precede a shot, the more likely a shot will become a goal" | nhl.com/kraken „Analytics with Alison: Dangerous Passes" (Stimson-Daten) |
| Passing Project: Vorhersagekraft | Shot Assists „more than twice as better", expected primary assists „three times", Danger-Zone-Shot-Assists „four times as better" als Primary Assists; 157 Forwards >400 min, 600+ Spiele 2015-16; „eleven games of data" bis zur stärksten Korrelation | hockey-graphs.com 2017/01/19, 2016/01/27 |
| Royal Road (Valiquette) | „76 percent of goals … on green shots"; Torwärter halten „97 percent of red shots"; ein Tor je 3,5 grüne Rebound-Schüsse | thehockeynews.com; blueseatblogs.com (76 %/24 %) |
| Royal Road, Fangquote | „.949 on a clean shot, .651 on shots immediately following a pass" | nhl.com „Unmasked" — nur aus dem Suchtreffer, Seite leer geliefert; **nicht belegt** |
| Hits | Hit-Differenz hat „an equal and opposite relationship with goal differentials as shot differentials have with goals"; Daten seit 2007 | hockey-graphs.com 2015/02/09 |
| Loose-Puck-Recoveries | 59,4 % aller Even-Strength-Ballbesitze beginnen mit einem LPR (OZ 56,8 / NZ 58,4 / DZ 61,7 %); OZ-LPR „correlate well with players who create scoring-chances" | habseyesontheprize.com 2014 (Boucher, Sportlogiq-Daten, ~1000 Spiele) |
| LPR-Rate | Ligamittel 54,5 LPR je 60 min (Spieler >10 Spiele); mittlere Puckbesitzzeit 1,67 s | nhl.com/kraken „Being Heavy on the Puck" (Sportlogiq) |
| Rebound-Kontrolle | 29 % der Paraden werden festgehalten (Ligamittel 2009-15); **5,7 %** der nicht festgehaltenen Paraden erzeugen einen Nachschuss binnen 2 s | hockey-graphs.com 2015/11/10 |
| Rebounds, Anteil an Toren | „only 16.8 % of the goals were scored off the rebounds" (3.854 Tore 2017-18) | worldhockeylab.com |
| Rebounds im Powerplay | 13 % der PP-Schüsse erzeugen einen Nachschuss, Verwertung 12 %; klare Schüsse 4,94 %, Ablenker 14,47 % | nhlspecialteams.com 2016/03/14 |
| xG-Merkmale | Distanz ~0,35 Importance, Schusstyp, Zeit seit letztem Ereignis, Winkel, Rebound (≤2 s), Rush (≤4 s) | hockey-torwart-puck-tore-recherche-fable.md 8.4 (hockeyR) |
| GAR-Komponenten | EVO, EVD, PPO, SHD, Take, Draw; Eingänge Offense: G, A1, A2, SF, CF, xG, Relativraten; Defense: iBLK, SA, xGA, Relativraten, Zone-Starts, **Giveaways/Takeaways**; Team-Faktoren 1,6 / 1,4 / 1,3 / 1,3; Replacement-SHD „basically average" | evolving-hockey.com WAR Part 2, Glossar; hockey-graphs.com 2019 Part 3 |
| Vorlagen je Tor, NHL 2023-24 | „Two-assist goals … account for 77.8 percent of all NHL goals" | soundofhockey.com 2024/08/01 |
| Schüsse je Spiel, Spitze | Tkachuk 4,1, MacKinnon 4,1, Matthews 3,9, Pastrnak 3,9, Hughes 3,7 (2024-25) | foxsports.com |
| Schüsse je Team | Edmonton 33,74 bis Seattle 28,62 (2023-24) | statmuse.com |
| ZenGM Hockey, Ratings | pss: „Increases the quality of shots that teammates get"; stk: „scoring and playmaking"; chk: „When a player is hit, his fatigue goes up"; glk: „the only rating that matters for goalies" | zengm.com/hockey/manual/customization/players |

### 0.4 Nur gelesen, nicht belegt

- Der Anteil der Rebound-Schüsse an allen NHL-Schüssen („roughly 5 % of shots … over 15 % of the
  goals", Moore/Medium) — Seite 403, nur Suchtreffer.
- Die exakten Jahr-zu-Jahr-Korrelationen von Primary gegen Secondary Assists: Dobber (2020)
  arbeitet mit Anteils-Schwankungen statt R, Arctic Ice Hockey liefert Korrelationen zu Corsi
  Rel (Forwards: Tore 0,37, A1 0,36, A2 0,33), keine YoY-Werte. Der Konsens „A2 kaum
  wiederholbar" ist damit qualitativ, nicht mit Zahl belegt.
- Die Anteile der GAR-Komponenten an der Gesamtvarianz (hockey-statistics.com, zwei Artikel):
  beide 403. Ich kann nur sagen, WAS in die Komponenten eingeht, nicht, wie viel jede trägt.
- Die Sloan-Papiere zu Bullys (arXiv 1902.02397, „How Much Do Faceoffs Matter") als PDF
  geladen, aber ohne Textextraktion in dieser Umgebung (pypdf/pdfminer brechen an
  `_cffi_backend`); Zahlen daraus nur über Sekundärquellen.
- ZenGMs Hockey-Spielsimulation selbst: der Depth-1-Clone enthält nur `GameSim.basketball`;
  die Ratings-Beschreibungen stammen aus dem Handbuch. Lizenz s. Abschnitt 7.

---

## 1. Reale Individual-Attribution: wie viel „Scheibe gewinnen" wiegt

### 1.1 Box-Score-Modelle: Game Score

Der Game Score ist die Formel, an der `feldspielWert` seit `8dc84052` hängt. Zwei Eigenschaften
sind für unsere Frage entscheidend und stehen so in der Quelle:

1. **Die Gewichte sind Häufigkeitsverhältnisse zum Tor.** Luszczyszyn: „weighted each statistic
   by its frequency to goals", dann um 75 % skaliert, damit Game Score „roughly equal to points"
   ist. Ein Schuss aufs Tor wiegt 0,075 (= ein Zehntel Tor, weil ~10 Schüsse je Tor), ein Block
   0,05, ein Bully-Gewinn 0,01. Umgerechnet auf unsere Tor=3-Skala: Schuss 0,30 (steht so), Block
   0,20 (bei uns 0,5), Bully 0,04, Strafe −0,6 je Strafe (bei uns 0,4).
2. **Es gibt keinen Posten für Puckgewinne.** Weder Hits noch Takeaways noch Loose-Puck-
   Recoveries kommen vor; das Kriterium war „nothing you can't find in a standard boxscore", und
   die einzige „Possession"-Größe ist der On-Ice-Corsi (0,05 je Versuch, für UND gegen), also
   eine Team-Größe während der Eiszeit, keine Einzelaktion.

Auf unser Protokoll gelegt (0.1) liefert genau diese Gewichtung **rho 0,474** — schlechter als
jede Variante, die Pucks enthält. Das ist kein Argument gegen den Game Score, sondern die
Messung, dass unsere Tore und Vorlagen nicht bei den Richtigen landen.

### 1.2 Corsi, Fenwick, xG auf Spielerebene

Individuelle Schussversuche (iCF/iFF) und individuelle Expected Goals (ixG) sind die
Volumenkanäle. Das belegte Muster: Volumen ist wiederholbar, Verwertung nicht („a team's 5v5
shooting percentage in one randomly chosen half of their schedule had no correlation to their
shooting percentage in the remaining half", Wikipedia Corsi; Ridge-Schätzer auf Shots/Fenwick/
Corsi „more consistent than … goals", arXiv 1201.0317). Für unser Problem heißt das: die
Wertformel darf Schussvolumen tragen (tut sie, 28 %), aber das Volumen muss bei dem
entstehen, der es sich ERSPIELT — und real erspielt es sich nicht der, der neben dem Tor
steht, sondern der, der den Puck dorthin bringt (1.4).

### 1.3 Vorlagen: erste und zweite getrennt, und die Größe davor

Der Game Score wiegt A1 mit 0,7 und A2 mit 0,55 — ein bewusster Abschlag, weil zweite
Vorlagen weniger wiederholbar sind (qualitativer Konsens, Zahlen s. 0.4). Wichtiger ist die
Größe DAVOR: das Passing Project (Stimson, Hockey Graphs 2015-17, dutzende freiwillige Tracker,
51.308 Schüsse bei 5v5) zählt „Shot Assists" — Pässe, die zu einem Schussversuch führen, egal
ob er reingeht. Befund: „Looking at basic shot assists is more than twice as better, expected
primary assists three times as better, and isolating just the danger zone shot assists four
times as better" als Primary Assists bei der Vorhersage künftiger Primärpunkte; „a player's
ability to set up others has a much stronger influence over the remaining number of primary
points they will score than their own shooting does". Und die Verwertung hängt am Passtyp:
Royal Road 15,5 %, hinter dem Tor 6,7 %, und „the more passes that precede a shot, the more
likely a shot will become a goal".

**Das ist der reale Beleg für den Kanal, der uns fehlt:** der Pass ist nicht nur eine
Buchung, wenn danach ein Tor fällt — er ist eine Größe, die die Torwahrscheinlichkeit des
folgenden Schusses ändert, und zwar um den Faktor 2 bis 3 je nach Typ.

### 1.4 Zoneneintritte und -ausgänge

Tulsky et al. (Sloan 2013, 330 handgetrackte Spiele) ist die meistzitierte Einzelzahl der
Hockey-Analytik: 0,57 Schüsse je kontrolliertem Eintritt gegen 0,12 je Dump-in — „more than
twice as many shots, scoring chances, and goals". Sznajder repliziert mit 0,66 gegen 0,29,
Chatel 2022 mit 47 % gegen 18 %. Auf Spielerebene ist die kontrollierte Eintrittsquote bei
Forwards die wiederholbarste Größe überhaupt (R² 0,72), stärker als Entries/60 (0,56), und sie
korreliert mit der Schussproduktion des Teams (0,31 zu FF/60). Zonenausgänge: mit Puck 89 %
Erfolg, Dump-out 20 %.

Für uns: unser Motor kennt keine Zonen und keinen Eintritt; der Puck wird nach dem Gewinn in
`bewegeSpielerLive` bis `HK_WUNSCH_MAX` an das Tor gedribbelt, und was diesen Weg trägt, ist
LAUFTEMPO plus die Stealfestigkeit (`versucheSteal`, `engine.js:6576`: `0,50 + (AUFBAU − ABWEHR)
· 0,005 + TEAMGEIST · 0,006`). Das ist ein Kanal für AUFBAU — aber einer, der nur Verluste
verhindert, nicht Chancen erzeugt.

### 1.5 WAR/GAR

Evolving-Hockeys GAR baut sechs Komponenten (EVO, EVD, PPO, SHD, Take, Draw) aus RAPM +
Statistical-Plus-Minus. Eingänge der Offensivkomponenten: G, A1, A2, SF, CF, xG, Relativraten
(GF60, xGF60, SF60, FF60, CF60); der Defensivkomponenten: iBLK, SA, xGA, Relativraten,
Zone-Starts, **Giveaways/Takeaways**. Takeaways sind also EIN Eingang unter zehn in EINER von
sechs Komponenten. Wie viel Varianz jede Komponente trägt, konnte ich nicht belegen (0.4);
belegt ist, dass die Team-Umrechnung EVO mit 1,6 am höchsten skaliert und dass Replacement-
Level bei SHD „basically average" ist — Shorthanded-Verteidigung unterscheidet Spieler kaum.

### 1.6 Loose-Puck-Recoveries, Bullys, Hits

- **LPR**: 59,4 % aller Ballbesitze beginnen so (Boucher/Sportlogiq). Die Größe ist real
  allgegenwärtig — bei uns sind es 100,8 lose Pucks gegen 19,4 Steals + 3,2 Fehlpässe + 12,7
  Checks, also rund 75 % aller Puckwechsel. Der ANTEIL ist nicht unrealistisch. Was real
  anders ist: Bouchers Befund ist, dass OZ-LPR mit *Chancen-Erzeugung* korrelieren — der
  Puckgewinn ist der Anfang einer Kette, deren Wert der nächste Pass und der nächste Schuss
  bestimmen.
- **Bullys**: 0,01 je Gewinn im Game Score; 76 Netto-Gewinne je Tor. Bei ~55 Bullys je NHL-Spiel
  ist das ein Kanal von ~0,4 Toren je Spiel über beide Teams, gleichmäßig verteilt fast
  nichts je Spieler. Der Rollout-Plan (B.2, Zeile 510) hatte das richtig vorhergesagt.
- **Hits**: negativ mit Tordifferenz korreliert („a team's hit differential is telling you
  more about [never having the puck]"). Unser `checks · 0,4` ist damit eine Erfindung ohne
  reale Entsprechung; mit 5,6 % Masse ist er klein, aber er korreliert bei uns mit der Eignung
  zu 0,855 — weil `wucht` (`engine.js:6597`) ABWEHR gegen AUSDAUER liest und ABWEHR
  health/power führt, also die Matrix selbst.

### 1.7 Die Tabelle, um die es geht

| Kanal | Real (Quelle) | Bei uns, gemessen |
|---|---|---|
| Tor | 0,75 GS; ~1 Tor je 10 Schüsse aufs Tor | 24 % der Masse, rho Saison **0,27** — Tore landen nicht bei der Eignung |
| Vorlage | 0,7/0,55 GS; 77,8 % der Tore mit zwei Vorlagen | 2 % der Masse, **17 % der Tore mit einer** Vorlage, Retest −0,33 |
| Schuss vorbereitet (Shot Assist) | 2-4× besserer Prädiktor als A1; Royal Road 15,5 % | **existiert nicht** — Schuss nach Pass trifft 6,9 % gegen 8,4 % |
| Zoneneintritt kontrolliert | 0,57 gegen 0,12 Schüsse; R² 0,72 | existiert nicht (keine Zonen) |
| Schussvolumen | 0,075 GS; wiederholbar | 28 % der Masse, Retest 0,83 — aber 56 % beim Netfront-Spieler |
| Loser Puck gewonnen | kein Posten; Beginn von 59 % der Ballbesitze | 17 % der Masse, **Retest 0,997**, allein rho 0,772 |
| Bully | 0,01 GS; 76 je Tor | kein Bully-Duell (loser Puck im Kreis, `bully()` `engine.js:5345`) |
| Check/Hit | negativ | 0,4 je Check, 5,6 % |
| Block | 0,05 GS | 0,5, 0,9 % (0,16 je Spiel) |
| Strafe | −0,15 GS je Strafe | −0,4 je Strafe |

---

## 2. Offener Spielcode

Sechs Repositories geklont (`git clone --depth 1`, Scratchpad), Lizenzdateien selbst gelesen.
Die GitHub-Suche liefert erstaunlich wenig: „hockey simulation engine" ergibt drei Treffer mit
null Sternen, „hockey manager open source" zwei Football-Projekte. Das Feld ist dünn; die
xG-Repos hat der frühere Bericht (8.2/8.3) schon abgedeckt und werden hier nicht wiederholt.

### 2.1 `archibalduk/hockey_match_engine` — GPL-3.0, C++23/Qt 6, 2D, deterministisch

README: „entirely vibe-coded using Claude Fable 5 … things start to get janky from Phase 3
onwards." Ich zitiere ihn trotzdem ausführlich, weil er das strukturell vollständigste offene
Hockey-Possession-Modell ist, das ich gefunden habe — und weil er an genau der Stelle einen
Kanal hat, an der wir keinen haben.

| Datei / Funktion | Formel | Was es für uns heißt |
|---|---|---|
| `engine/match_engine.cpp:chooseAction`, Angriffszone | `shoot = 2,45 · (0,6 + 1,2·Shooting)`, `pass = 40 · (0,7 + 0,6·Vision)`, `cycle = 30`, `carry = 15 · (0,6 + 0,8·Deking)` — gewichtetes Los | **Schussanteil hängt an einer Fähigkeit** (Shooting), nicht am Standplatz |
| `resolvePass` | Angriff `0,7·Passing + 0,3·Vision` gegen bestes `Positioning` des Gegners; `kPassFreedom 0,62` („~82 % ES"); bei Erfolg 10 % (`kOneTimerChance`) → `resolveShoot(oneTimer=true)` | **Der Pass erzeugt den Schuss und hebt seine Qualität**: `kOneTimerBonus +0,06`, Typ-Faktor One-Timer ×1,12, Ablenker ×1,20 (`sim/shot_location.cpp:shotDanger`) |
| `resolveCarry` | `0,45·Skating + 0,35·Deking + 0,20·Balance` gegen `Checking`; `kCarryFreedom 0,12` („~55 %"); 9 % Hit-Chance; 3 % Breakaway aus der neutralen Zone | Zonenfortschritt als eigener Kanal (`kAdvanceProbNZ 0,35 + kCarryAdvanceBonus 0,12`) |
| `sim/shot_resolver.cpp:resolveShot` | zwei Stufen: aufs Tor `0,50 + 0,30·Shooting`; dann Kontest `margin = ((0,35·Shooting − Pivot) − (0,45·Positioning + 0,35·Reflexes + 0,20·Recovery − Pivot)) · 0,50 + 0,65·quality − 0,88 (+0,08 screened, +0,06 one-timer)` | Schussqualität (Geometrie + Vorbereitung) ist ein ADDITIVER Term neben dem Schützen — genau die Trennung, die `technikMake` nicht hat |
| `resolveSaveOutcome` | festgehalten `0,18 + 0,30·ReboundControl`; **Rebound in den Slot `0,35·(1 − rc) + 0,05`**; Rest in die Ecke | Bei uns geht **jeder** Abpraller (70 % der Paraden) 18-52 px vor das Tor (`engine.js:6790`); dort landet bei elite rc ein Zehntel |
| `sim/faceoff_resolver.cpp` | `0,7·Faceoffs + 0,3·Strength`, Scramble/Tie-up-Anteile, „elite ~58-60 %" | ein Bully-Duell, das eine Fähigkeit liest |
| Vorlagen | `pendingGoal_ = {…, lastTouch_[0], lastTouch_[1], …}` | **A1/A2 aus der Berührungskette**, kein Zeitfenster, kein Los |
| `consumers/rating_calculator.cpp` | Tor 1,3 (D 1,7), A1 0,9 (D 1,0), A2 0,6, Shorthanded +0,5; Schuss 0,06; Save 0,05+0,10·Qualität; Hit 0,06 (D 0,10); Bully ±0,02; Strafe −0,35; Turnover −0,08; Interception 0,06; Sieg ±0,3; Klemme 1-10 | dieselbe Familie wie der Game Score; **kein Puck-Posten** |
| `core/tuning.h` | Ziele: „~50-65 attempts/game, ~28-32 SOG/team, 5-6 goals combined, 6-10 penalties, ~45-60 face-offs"; `kDangerDecayMetres 7,0`, Winkel `0,45 + 0,55·cos` | kalibriert gegen NHL-Zielkorridore per `calibrate --games 400` |

### 2.2 `skyre5/Elite-Hockey-Manager` — MIT, C#

`Classes/GameComponents/Game.cs`. Ein Spiel ist eine Folge von „Scoring Chances", jede beginnt
mit einem Bully:

- `Faceoff()`: `rand(1..home+away) ≤ homeFaceoff` — reine Verhältnis-Lotterie über das
  Faceoff-Attribut der beiden Center.
- `ChooseSkaterOnIce()`: Gewichte `{25,25,25,13,12}` — Stürmer schießen doppelt so oft wie
  Verteidiger, unabhängig vom Können.
- `GetShotTaken()`: `offense = Σ(1,5·Speed + Awareness + Checking/2)` über drei Spieler gegen
  `4,5 · Σ(Speed + Awareness + Checking)` der zwei Verteidiger; Kommentar „a 900/3600 chance
  gets a 1/4 shot opportunity in perfect circumstances".
- `WristShot()`: `WristShot^1,5` gegen `10·(High + Low)` des Torwarts; `SlapShot()`:
  `SlapShot^1,3` gegen `10·(Low + ReboundControl)`; Typgewichte Stürmer `{40,25,20,10}`,
  Verteidiger `{30,50,15,5}` (Wrist, Slap, Backhand, Breakaway).
- **`GetSkatersForPlay()`: die zwei Vorlagengeber werden zufällig aus den fünf Spielern
  gelost** und bei Torerfolg gutgeschrieben. Passspiel existiert nicht; Vorlagen sind eine
  Lotterie über Eiszeit.

Das ist die Gegenprobe zu 2.1: ein Boxscore ohne Kanal dahinter. Wer so Vorlagen vergibt,
bekommt A1/A2 mit Retest um null — exakt unsere −0,33.

### 2.3 `tmzkh/HockeySimGame` — Java, **keine Lizenzdatei**

`src/game/Period.java:getTeamAttack`: `Σ(Speed + AttackIq + PuckControl)` über Sturm- und
Verteidigungsreihe; welche Seite die Chance bekommt, entscheidet
`rand ≤ homeAttack/(homeAttack+visitorAttack)`. Reines Team-Modell, nichts Individuelles.
Ohne Lizenz nicht verwendbar, hier nur als Beleg für die Bauform.

### 2.4 `mrrustemka/hockey-league-simulator` — React/TS, `"private": true`, keine Lizenz

`src/hooks/useGameSimulation.ts:getGoals(min,max,rating) = round(rand(min..max) · rating / 100)`.
Team-Rating mal Zufall. Nicht relevant.

### 2.5 `reminisc3/hockey-engine` — GPL-3, Angular

`services/game.service.ts:simulate(game)` ist leer. Nichts zu holen.

### 2.6 `zengm-games/zengm` — **kein Open-Source-Lizenzmodell**

`LICENSE.md`: „This project is not open source! … These 4 things are literally all you are
allowed to do with the code: View it. Edit it. Run it locally. Share it." Kein Hosten, keine
spielbaren Forks. Code darf gelesen werden; der Depth-1-Clone enthält nur `GameSim.basketball`
(die Hockey-Variante wird offenbar beim Bauen gewählt, ich habe sie nicht weiter gesucht). Das
Handbuch beschreibt das Rating-Modell, und ein Satz davon ist die kompakteste Formulierung
des Kanals, um den es hier geht: **pss (passing): „Increases the quality of shots that
teammates get."** Dazu: stk „scoring and playmaking", oiq „all offensive parts", chk „When a
player is hit, his fatigue goes up and his performance goes down" — der Check als Ermüdung
des Getroffenen, nicht als Punkt für den Checker.

### 2.7 Was die sechs gemeinsam sagen

Die zwei, die ein individuelles Spiel simulieren (2.1, 2.2), unterscheiden sich genau in
einem Punkt: ob zwischen Puckgewinn und Schuss ein Kanal liegt, der eine andere Fähigkeit
liest. 2.1 hat Pass (Passing/Vision) → One-Timer → Schussqualität, Carry (Skating/Deking) →
Zonenfortschritt, Bully (Faceoffs/Strength), und verteilt die Vorlagen über die
Berührungskette. 2.2 hat nichts davon und lost. Unser Motor steht heute näher an 2.2 als an
2.1 — nicht bei den Vorlagen (die haben ein Fenster), aber bei der Frage, ob der Pass die
Torchance ändert.

---

## 3. Der frühere Bericht und die Pläne — was dort steht und nicht umgesetzt ist

Gelesen: `hockey-torwart-puck-tore-recherche-fable.md` (4.7, 4.8, 8.4, 9), `hockey-rollout-
plan.md` (B.2, Tabelle 505-510), `hockey-torwart-puck-tore-plan.md` (H.2). Nicht wiederholt
wird die xG-Tabelle; wiederholt wird nur, was für die Impact-Verteilung offen ist.

| Stelle | Was dort steht | Stand im Motor |
|---|---|---|
| Recherche 8.4, Vorschlag `GEO_BONUS`-Gegenstück | `abprallerFaktor (Schuss ≤ 2 s nach Save) ×2,5`, `ablenkerFaktor ×1,8`, Distanz×Winkel als Faktor auf eine Basisquote | **nicht umgesetzt**: Hockey nutzt Basketballs `GEO_BONUS {dunk 0,70, nah 0,20, mit 0,09, fern 0,075}` (`engine.js:4185`) mal `HK_TOR_SKALA 0,425`; kein Winkel, kein Rebound-, kein Ablenker-Faktor, kein Pass-Faktor |
| Recherche 4.7 | Impact-Formel je Disziplin, „vor jeder Sondierung" — mit `abpraller·0,5` | umgesetzt (`8dc84052`), Pucks inzwischen 0,2 |
| Recherche 4.8 | SCHUSSBLOCK „braucht die Schusslinien-Prüfung (`distZuLinie`) als Kanal — sonst ist er tot wie Basketballs AUSDAUER" | Block läuft über `blockKandidat` = eigener Decker bei Bedrängnis (`engine.js:6712`); 0,16 Blöcke je Spieler und Spiel, Retest 0,36 — **praktisch tot** |
| Rollout-Plan B.2 | **ABSCHLUSSDRANG** als *Auswahlgröße* („Schussanteil eigene Schüsse / Teamschüsse"), **LINIENSPIEL** („Vorlagen"), **SPIELAUFBAU** („Zonenaufbau gelungen / Ballbesitz-Anteil"), **TEMPO** („gewonnene Rennen") | Schussanteil hängt am Slot (`zuordneSlots` sortiert nach SCHUSS_NAH, `engine.js:4884`); Vorlagen an einem 1,6-s-Fenster; Zonenaufbau existiert nicht; das Rennen um den Puck (`PUCK_LAUF_FENSTER`) ist der einzige der vier, der gebaut ist |
| Rollout-Plan, Zeile 507 | „Basketballs TECHNIK liest fast null, weil `technikGate` bei Normalwerten immer über der Schwelle liegt — der Sub-Skill muss in Hockey an einen echten Kanal, nicht an ein Gate" | trifft heute **AUFBAU**: seine neun Anschlussstellen sind Gates und Lose (4.2), keine Erfolgsgröße |
| Rollout-Plan, Zeile 510 | Bully nicht als eigener Sub-Skill (0,01 im Game Score), aber als Standphase | `bully()` legt den Puck frei (`engine.js:5345`), der Kampf darum ist `losGewicht(ZWEITCHANCE)` — also doch ein ZWEITCHANCE-Posten, ~30 Bullys je Spiel (frühere Messung im Motorkommentar zu `HK_ABPRALLER`) |
| `stand-aller-disziplinen.md` Zeile 128 | „Hockey. Validität 0,874, Einzelspiel 0,670 — auch hier fehlt Verlässlichkeit, nicht Richtigkeit" | **widerspricht CLAUDE.md** (Uhr verdoppelt, rho flach) und den Messungen hier (Pucks Retest 0,997: Verlässlichkeit ist nicht das Problem); die Zeile sollte korrigiert werden |

---

## 4. Die Mechanik: warum ZWEITCHANCE die Hälfte trägt

### 4.1 Wie ein Tor entsteht — die Kette, Zeile für Zeile

1. **Puck frei** (nach Parade 70 %: `HK_ABPRALLER`, `engine.js:5006`; nach Block; nach Fehlschuss
   an die Bande; nach Check `engine.js:6637`; nach Bully). Er landet beim Abpraller 18-52 px vor
   dem Tor, Winkel ±1 rad (`loeseHockeySchuss`, `engine.js:6790`) — **immer im Torraum**, nie in
   der Ecke.
2. **Wettlauf** (`PUCK_LAUF_FENSTER 0,70 s`, `engine.js:5192`): Kandidat ist, wer ihn in 0,7 s
   erreicht; Tempo `230 + 0,70·(LAUFTEMPO − 50)`. Der Netfront-Spieler steht 78 px vor dem Tor,
   also praktisch immer im Fenster.
3. **Zweikampf** (`engine.js:7613`): Gewinnchance ∝ `(ZWEITCHANCE − 20)^3 · (defensiv ? 4,0 : 1) ·
   exp(−Ankunft/0,35)`. 73 gegen 60 heißt 70 : 30; das ist gewollt (Kommentar dort: „der
   Unterschied zwischen zwei Spielern ist im Boxscore jetzt zu sehen").
4. **Puckführer entscheidet** (`entscheideBallaktion`, `engine.js:5724`): in Reichweite (Hockey:
   dunk <58 px, nah <140, mit <215, fern <330, `engine.js:4289`) wird geschossen, wenn
   `technikGate = 0,16 + 0,005·TECHNIK + 0,006·TEAMGEIST` über der mit der Zeit fallenden
   `schwelle` liegt — bei Normalwerten praktisch sofort. Nur wer `suchtPass` würfelt (AUFBAU über
   55, max 35 %) oder den Kick-out-Würfel bei Bedrängnis, gibt ab.
5. **Trefferchance** (`technikMake`, `engine.js:6060`): `steilerMake(−0,02 + GEO_BONUS[tier] −
   bedraengnisMake, 0,0022·SCHUSS_x + 0,0030·TEAMGEIST)`. Dann Hockey-Stufen
   (`hockeySchussAusgang`, `engine.js:6712`): Block `0,12 + 0,003·(ABWEHR − 50)` nur bei
   Bedrängnis, vorbei 11 %, Tor `technik · 0,425 · paradeFaktor`, sonst 70 % Abpraller → zurück
   zu 1.
6. **Buchung** (`feldspielWert`, `engine.js:5226`): Tor 3, Vorlage 2 (nur wenn der Schuss binnen
   `1,6 s · (0,70 + 0,006·(AUFBAU_Passgeber − 50))` nach der Annahme fiel, `engine.js:6864`),
   Schuss 0,3, Puck 0,2.

**Nirgends in 1-6 kommt ein Pass vor, der etwas an 5 ändert.** Und 1 → 3 → 4 → 5 → 1 ist eine
Schleife, die derselbe Spieler allein durchlaufen kann: Puck gewinnen, aus 58 px schießen, der
Torwart lässt zu 70 % abprallen, der Puck liegt wieder 18-52 px vor ihm. Gemessen laufen 17 %
aller Schüsse und 25 % aller Tore genau so (Nachschuss = Parade → offensiver Puckgewinn →
Schuss); real sind es 5,7 % der nicht festgehaltenen Paraden, die überhaupt einen Nachschuss
binnen 2 s erzeugen (bei uns: 14,3 Nachschüsse auf 68,3 · 0,70 ≈ 48 nicht festgehaltene
Paraden = **30 %**, das Fünffache), und 16,8 % der Tore fallen aus Rebounds (bei uns 25 %).
Der Unterschied ist nicht die Häufigkeit des Abprallers (70 % ist real), sondern **wohin er
prallt** — real überwiegend in die Ecken (Torwart-Grundregel aus dem früheren Bericht: „dann
gehen Abpraller in die Ecken statt in den Slot"; 2.1 modelliert das mit `0,35·(1−rc)+0,05` für
den Slot).

### 4.2 Was AUFBAU heute bewirkt — alle neun Anschlussstellen

| Zeile | Kanal | Wirkung auf … |
|---|---|---|
| `:5587` `spielmacherLos` | `losGewicht(AUFBAU)` | wer den Angriff eröffnet (nur nach totem Puck) |
| `:5915` `suchtPass` | `min(0,35, (AUFBAU − 55)·0,008)` | ob in Wurfreichweite doch gepasst wird |
| `:6064` `passChance` | `0,35 + (AUFBAU − 50)·0,004` | ob außerhalb der Reichweite gepasst wird |
| `:6097` `screenChance` | `0,15 + (AUFBAU − 50)·0,002` | Basketball-Screen, in Hockey ohne Sinn |
| `:6112` `reevBall` | `0,4 + (100 − AUFBAU)/100 · 0,8` | Denkpause des Puckführers |
| `:6535` `eigenerFehler` | `max(0,015, 0,05 − (AUFBAU − 50)·0,0016)` | Fehlpassquote (3,2 je Spiel, beide) |
| `:6576` Steal-`basis` | `0,50 + (AUFBAU − ABWEHR)·0,005 + …` | Puckverlust am Mann |
| `:6864` Assist-Fenster | `1,6 s · (0,70 + (AUFBAU − 50)·0,006)` | ob ein Tor als Vorlage gebucht wird |
| `:5464` `mismatchTempo` | `(LAUFTEMPO + AUFBAU)/2 − ABWEHR` des Deckers | Deckungsabstand |

Fünf davon sind Wahrscheinlichkeiten, ob überhaupt gepasst wird; zwei verhindern Verluste;
eines verlängert die Buchungsfrist; keines berührt `technikMake` oder `hockeySchussAusgang`.
Der Motorkommentar bei `:5931` beschreibt außerdem, dass ein Assist-Bonus auf die Trefferchance
„bewusst NICHT eingebaut" wurde — aus einem Basketball-Messgrund (Sättigung am 0,92-Deckel).
Für Hockey mit `HK_TOR_SKALA 0,425` und Trefferquoten von 4-19 % gilt dieser Grund nicht: dort
ist Platz nach oben.

Die Messung bestätigt die Lesart: Pässe folgen dem Puckbesitz (Draco 16,2, Greenkraut 14,9 je
Spiel — die zwei mit den meisten losen Pucks), nicht AUFBAU (Tidesprinter mit AUFBAU 84 steht
im Tor und passt 0,04-mal; Greenkraut hat mit 62 den höchsten AUFBAU unter den Feldspielern
und liegt bei den Pässen auf Rang 2, aber bei den Vorlagen bei 0,13 je Spiel). Und wer passt,
verliert im Mittel Torchance: 6,9 % nach Pass gegen 8,4 % sonst, weil der Passempfänger
seltener im Torraum steht als der Puckgewinner.

### 4.3 Die Sondierung, eingeordnet

Die Sondierung misst mit orthogonalem Rezept, was ein Sub-Skill MECHANISCH trägt. Auf
`8dc84052` — vor der Senkung des Puck-Gewichts — las ZWEITCHANCE 42,9 % und 48,6 %. Auf
`eed9f61b` (Puck 0,2) liest sie, 24 Läufe, Versatz 0:

| Sub-Skill | Gewicht | Schritt in der Kette (4.1) |
|---|---:|---|
| ZWEITCHANCE | 28,9 % | 3 — Zweikampf um den losen Puck |
| LAUFTEMPO | 25,0 % | 2 — Wettlauf zum losen Puck, Ausbruch |
| TEAMGEIST | 20,2 % | 4/5 — `technikGate` und `0,003·TEAMGEIST` in `technikMake` |
| TECHNIK | 11,8 % | 4 — `technikGate` |
| ABSCHLUSS | 10,5 % | 4 — `schwelle` |
| PARADE | 2,2 % | Torwart |
| SCHUSS_FERN | 1,5 % | 5 |
| AUFBAU, ABWEHR, AUSDAUER, SCHUSS_NAH | **0 %** | — |

54 % hängen an Schritt 2 und 3 — „wer bekommt den Puck" —, 44 % an „schießt er, und trifft
er", und 0 % an allem, was zwischen Puckgewinn und Schuss liegen könnte. Nach 4.1 ist das kein
Messfehler, sondern die Struktur: Schritt 2 und 3 sind die einzigen, in denen eine Fähigkeit
den Puck einem Spieler ZUWEIST; alle anderen wirken erst, wenn er ihn hat. AUFBAU auf null ist
die Sondierungs-Fassung von 4.2; ABWEHR auf null heißt, dass Steal-Chance (`0,005·(AUFBAU −
ABWEHR)`), Block-Chance und Bedrängnis zusammen keinen messbaren Wert erzeugen — ein
Verteidiger wird im Boxscore nicht sichtbar. SCHUSS_NAH auf null ist überraschend und
verdient eine eigene Nachmessung: eine Anhebung um 15 verschiebt den Spieler in
`zuordneSlots` Richtung Netfront, und dort scheint der Zugewinn an Schüssen den Verlust
anderswo nicht zu decken (oder der Gewinn ist negativ und geklemmt). Die Posten-Messung sagt
dasselbe von der anderen Seite: Rebounds allein rho 0,772 je Spiel, alles ohne Rebounds 0,539.

Der zweite Befund der Posten-Messung ist der unbequemere: **Tore haben über die Saison rho
0,27 zur Eignung.** Johanna (Eignung 57,1, drittbeste Feldspielerin) schießt 0,38 Tore bei 4,8
Schüssen; Gram (49,7) 1,13 bei 9,5. Tore entstehen bei dem, der den Netfront-Slot hat (höchster
SCHUSS_NAH), und SCHUSS_NAH ist im Rezept ein unkalibrierter Platzhalter. Das ist zur Hälfte
Rezept — aber zur anderen Hälfte Mechanik: **der Schussanteil eines Spielers hängt an seinem
Standplatz, nicht an einer Fähigkeit** (2.1 macht es über `Shooting` im Aktions-Los; B.2 hatte
ABSCHLUSSDRANG dafür vorgesehen). Ein Rezept kann SCHUSS_NAH auf die Eignung ziehen; es kann
nicht ändern, dass ein Spieler 56 % der Teamschüsse nimmt, weil er dort steht.

### 4.4 Warum das keine Uhr-Frage ist, noch einmal mit diesen Zahlen

Die Pucks haben Retest 0,997 — verlässlicher wird nichts. Tore haben 0,75, das ist bei 0,72
Toren je Spieler und Spiel schon gut. Was fehlt, sind nicht Wiederholungen, sondern ein
Zusammenhang: Tore ↔ Eignung 0,27, Vorlagen ↔ Eignung 0,09. Mehr Spiele wiederholen eine
Zuordnung, die falsch ist. Der Weg zu 0,80 führt über Kanäle, die Tore und Vorlagen bei der
Eignung entstehen lassen — und das ist genau das, was Game-Score-Gewichte auf unser Protokoll
heute mit 0,474 bestrafen.

---

## 5. Was für einen Kanal es bräuchte — mit realer Begründung

Reihenfolge nach Hebel, jeweils: Mechanik, reale Zahl, Stelle im Motor, was messbar wird.
Keine Uhr, keine Ereignisdichte.

### 5.1 Die Passqualitäts-Kette: der vorbereitete Schuss

**Mechanik.** Ein Schuss binnen `ASSIST_FENSTER` nach einem angenommenen Pass bekommt einen
additiven Qualitätsterm in `technikMake` (nur Hockey-Zweig), gestaffelt nach Passgeometrie:
Pass quer über die Mittelachse in Torrichtung („Royal Road", Vorzeichenwechsel von
`von.y − H/2` zu `nach.y − H/2` innerhalb der Angriffszone) hoch, Pass von hinter der Torlinie
mittel, sonstiger Pass in Schussreichweite klein. Der Term skaliert mit dem AUFBAU des
Passgebers (Pässe eines Spielmachers kommen „in den Lauf") und wird vom ABWEHR des Deckers
auf der Passlinie gedämpft (`offenheitFuerPass`, `engine.js:5601`, kennt die Linie schon).

**Real.** Royal Road 15,5 % gegen 6,7 % (Passing Project); 76 % aller Tore auf grünen Schüssen,
97 % Fangquote auf roten (Valiquette); Ablenker 14,5 % gegen klare Schüsse 4,9 % (nhlspecialteams);
xG-Modelle führen `time_since_last`/`cross_ice_event` als Merkmale (hockeyR, früherer Bericht).
2.1 baut es als `kOneTimerBonus +0,06` auf einer 0-1-Qualitätsskala plus Typfaktor 1,12.

**Warum das AUFBAU eigenständig macht.** Zum ersten Mal hinge eine ERFOLGSgröße am Passgeber:
nicht ob er passt, sondern was sein Pass wert ist. Der Assist wird damit auch häufiger (der
vorbereitete Schuss fällt öfter) — die 17 % Vorlagentore bewegen sich in Richtung der realen
78 %. Messbar: Trefferquote „nach Pass" gegen „ohne Pass" (heute 6,9 gegen 8,4 %, real
umgekehrt um Faktor 2-3), Vorlagen je Tor, rho(Eignung, Vorlagen) (heute 0,09).

**Kalibrierfalle, vorab.** Der Motorkommentar bei `:5931` warnt vor einem Assist-Bonus, weil
in Basketball jeder Wurf ein Assist-Wurf ist und der Bonus uniform wirkt. Bei uns folgen 33 %
der Hockey-Schüsse direkt auf einen Pass — der Term ist also selektiv. Trotzdem gehört
`HK_TOR_SKALA` danach nachgezogen (3,5 Tore je Team bleiben Chris' Zahl), und `HK_TW_BASIS`
nach jeder Änderung von `feldspielWert` (steht so im Kommentar dort).

### 5.2 Wohin der Abpraller geht: Ecke statt Slot

**Mechanik.** `loeseHockeySchuss` (`engine.js:6790`) legt den Abpraller heute IMMER 18-52 px
frontal vor das Tor. Stattdessen drei Ausgänge wie in 2.1: festgehalten (heute „fest" 30 %),
Ecke/hinter das Tor (neu, der Großteil), Slot (klein, sinkend mit PARADE). Der Slot-Anteil ist
die Zahl, an der die Rebound-Schleife hängt.

**Real.** 5,7 % der nicht festgehaltenen Paraden erzeugen einen Nachschuss binnen 2 s
(hockey-graphs); 16,8 % der Tore aus Rebounds (World Hockey Lab); Torwart-Grundregel „Abpraller
in die Ecken statt in den Slot" (früherer Bericht 0.3). Bei uns 30 % und 25 %.

**Wirkung auf die Verteilung.** Der Puck landet öfter dort, wo der Netfront-Spieler NICHT steht
— an der Bande, wo das Bandenduell (`HK_BANDENDUELL_DAUER`) ohnehin schon gebaut ist — und der
Weg zurück vor das Tor braucht einen Pass (5.1) oder ein Dribbling. ZWEITCHANCE bleibt der
Kanal für den Puck, aber der Puck ist danach weniger direkt ein Schuss. Messbar: Nachschüsse je
Parade, Anteil des Netfront-Spielers an den Teamschüssen (heute 56 %, real ~14 %).

### 5.3 Schussanteil als Fähigkeit, nicht als Standplatz

**Mechanik.** In `entscheideBallaktion` entscheidet heute `technikGate > schwelle` mit
TECHNIK/TEAMGEIST, ob geschossen wird — bei Normalwerten immer. B.2 hatte ABSCHLUSSDRANG als
Auswahlgröße vorgesehen; 2.1 gewichtet die Schuss-Aktion mit `0,6 + 1,2·Shooting`. Der
einfachste Hockey-Weg ohne neuen Sub-Skill: die Schwelle liest SCHUSS_x des Schützen im
jeweiligen Tier (ein schwacher Fernschütze an der blauen Linie sucht den Pass, ein starker
zieht ab), und `offensterMitspieler` bevorzugt bei der Passwahl den besseren Schützen im
besseren Tier statt nur den offensten.

**Real.** Schussanteile in der NHL: Spitze 14 % der Teamschüsse (4,1 von ~30). Corsi/xG-
Volumen ist der wiederholbare Teil der Offensive (1.2) — aber es MUSS beim Richtigen anfallen.

**Messbar.** Anteil des meistschießenden Spielers (56 %), r(Schüsse, SCHUSS_x im Tier), rho
(Eignung, Tore) über die Saison (0,27).

### 5.4 Vorlagen aus der Berührungskette statt aus dem Fenster

**Mechanik.** `frischerPassVon` + `ASSIST_FENSTER 1,6 s` bucht nur den letzten Pass und nur bei
schnellem Abschluss. 2.1 hält `lastTouch_[0..1]` je Team und vergibt A1/A2 daraus; der Game
Score wiegt A2 mit 0,55. Ein Zwei-Berührungs-Gedächtnis je Team, geleert bei Puckwechsel,
vergibt beide Vorlagen ohne Zeitfenster.

**Real.** 77,8 % der NHL-Tore mit zwei Vorlagen. Bei uns 17 % mit einer.

**Wirkung.** Klein für rho (Vorlagen tragen 2 % der Masse), aber notwendig, damit 5.1 im
Boxscore ankommt — und für Chris' Playmaker-Wunsch („die stars sollen in playmaking
herausstechen", Motorkommentar `:5880`).

### 5.5 Bully als Duell, Check als Ermüdung

Beides kleine Posten mit realer Deckung: ein Bully-Duell `PUCKFUEHRUNG gegen PUCKFUEHRUNG`
(oder TECHNIK) statt eines ZWEITCHANCE-Loses um den freien Puck im Kreis — real 0,01 je
Gewinn, also bewusst OHNE Wertformel-Posten, aber mit dem Effekt, dass ~30 lose Pucks je
Spiel nicht mehr in die ZWEITCHANCE-Masse fallen. Und der Check nach dem ZenGM-Muster: der
Getroffene verliert Tempo (`taumeltBis` existiert), der Checker bekommt keinen Punkt — real
korrelieren Hits negativ mit dem Ergebnis. `checks · 0,4` würde damit gestrichen; das kostet
5,6 % Masse, die heute mit 0,855 an der Eignung hängt, weil `wucht` die Matrix liest — also
Masse, die die Rangtreue nur deshalb trägt, weil ABWEHR health/power ist.

### 5.6 Was ich NICHT vorschlage

- Mehr Spielzeit, mehr Schüsse, kürzere Ringphasen: CLAUDE.md, gemessen flach.
- Ein Rezept mit halbem Budget in ZWEITCHANCE: hebt rho auf dem heutigen Motor und zementiert,
  dass der beste Hockeyspieler der mit power/health ist.
- Ein Zonenmodell mit Eintritts-Ereignis als ERSTEN Schritt: real der stärkste Einzelkanal
  (R² 0,72), aber im Motor der teuerste (Zonen, Abseits-Äquivalent, Eintrittslogik); erst
  wenn 5.1-5.3 nicht reichen.

---

## 6. Lizenzen und was man mitnehmen darf

| Repo | Lizenz | Nutzbar |
|---|---|---|
| `archibalduk/hockey_match_engine` | GPL-3.0 (Datei gelesen) | Formeln und Konstanten als Vorbild ja; Code übernehmen nur unter GPL — für unseren Motor also nachbauen, nicht kopieren. Der Autor nennt ihn selbst KI-generiert; die Zahlen sind kalibrierte Setzungen, keine Messungen an NHL-Daten |
| `skyre5/Elite-Hockey-Manager` | MIT (Datei gelesen) | frei; hier nur als Negativbeispiel zitiert |
| `tmzkh/HockeySimGame` | keine Lizenzdatei | nicht verwendbar |
| `mrrustemka/hockey-league-simulator` | `"private": true`, keine Lizenz | nicht verwendbar |
| `reminisc3/hockey-engine` | GPL-3 | leer |
| `zengm-games/zengm` | eigene Lizenz, „not open source" | Code lesen ja, nichts übernehmen; Handbuchsatz zitiert |

---

## 7. Was ich nicht geprüft habe

- Ob die Passqualitäts-Kette (5.1) bei `HK_TOR_SKALA 0,425` die 3,5 Tore je Team hält —
  reine Umsetzungsmessung.
- Wie sich 5.2 auf die Bandenduelle auswirkt (mehr Pucks an der Bande heißt mehr
  `HK_BANDENDUELL_DAUER`-Standzeit; der Kommentar dort nennt das gewollt, die Zahl ist offen).
- Die Torwart-Seite der Verteilung (`HK_TW_BASIS`, GSAA) — bewusst ausgeklammert, das ist
  eine eigene Runde, und `HK_TW_BASIS` muss nach jeder Wertformel-Änderung ohnehin nachgezogen
  werden.
- Zwei-, Drei- und Viererbesetzungen; alle Zahlen hier sind 6 je Seite.
- Die zweite Attributzuordnung der Sondierung (Versatz 3) auf `eed9f61b`; Versatz 0 lief, s.
  4.3. Bei `8dc84052` lagen beide Zuordnungen für ZWEITCHANCE 6 Punkte auseinander; die
  Nullen für AUFBAU/ABWEHR/SCHUSS_NAH sollten mit Versatz 3 bestätigt werden, bevor jemand
  auf ihnen baut.

---

## Sieben Sätze — der mechanische Eingriff, in Prioritätsreihenfolge

1. **Passqualitäts-Kette** (5.1): ein Schuss binnen `ASSIST_FENSTER` nach einem Pass bekommt in
   `technikMake` (Hockey-Zweig) einen additiven Qualitätsterm nach Passgeometrie (quer durch
   den Slot > hinter dem Tor > sonst), skaliert mit AUFBAU des Passgebers und gedämpft von der
   ABWEHR auf der Passlinie — real 15,5 % gegen 6,7 %, bei uns heute 6,9 % gegen 8,4 %; das ist
   der eine Kanal, der AUFBAU zur Erfolgsgröße macht.
2. **Abpraller in die Ecke** (5.2): `loeseHockeySchuss` verteilt den Abpraller auf Ecke/hinter
   das Tor (Mehrheit) und Slot (Minderheit, sinkend mit PARADE) statt immer 18-52 px frontal —
   real 5,7 % Nachschussquote gegen unsere 30 %, und damit bricht die Schleife „Puck gewinnen,
   aus 58 px schießen, Puck wieder gewinnen", die 17 % der Schüsse und 25 % der Tore trägt.
3. **Schussanteil als Fähigkeit** (5.3): die Schuss-Schwelle in `entscheideBallaktion` liest
   SCHUSS_x im Tier des Schützen, `offensterMitspieler` bevorzugt den besseren Schützen — 56 %
   Teamschüsse bei einem Spieler gegen real 14 %.
4. **Vorlagen aus der Berührungskette** (5.4): zwei letzte Berührungen je Team statt
   1,6-s-Fenster, A1 2,0 und A2 1,5 in `feldspielWert` — 17 % Vorlagentore gegen real 78 % mit
   zwei Vorlagen.
5. **Bully als Duell und Check ohne Punkt** (5.5): der Puck im Kreis geht über ein
   Fähigkeitsduell statt über den ZWEITCHANCE-Zweikampf, `checks·0,4` fällt aus der Wertformel
   (real negativ korreliert), der Check wirkt nur als Taumeln des Getroffenen.
6. Nach 1-5 `HK_TOR_SKALA` gegen 3,5 Tore je Team und `HK_TW_BASIS` gegen den neuen
   Feldspieler-Mittelwert nachziehen, DANN die Sondierung wiederholen — erst wenn ZWEITCHANCE
   dort unter einem Viertel liest, lohnt ein Rezept; die Abnahme sind rho je Spiel, Star auf
   Rang 1 und die Paartreue ab 15 Punkten, nicht die Uhr.
7. Die Zeile in `stand-aller-disziplinen.md` („fehlt Verlässlichkeit, nicht Richtigkeit")
   korrigieren: Pucks haben Retest 0,997, Tore rho 0,27 zur Eignung — es fehlt Richtigkeit.

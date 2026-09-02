# Recherche: Die fünf Bahnen — Formeln aus dem Sport und aus offenem Spielcode (Fable)

Stand: `ca03e24f` (Branch `claude/sonde-alle-disziplinen`, HEAD am 02.09.2026 19:31 UTC). Alle
`engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf diesem Stand. Im Arbeitsbaum
lag zusätzlich eine **nicht eingecheckte** Änderung (`HK_TW_BASIS` 8,5 → 7,0 und das Gewicht der
gewonnenen Pucks in `feldspielWert`, beides Hockey, `git diff --stat`: 25+/2−) — sie berührt keine
Zeile des Bahn-Motors, und sie ist nicht Teil dieses Berichts. Der Motor wird hier **nicht**
angefasst; die einzige Datei dieses Branches ist dieser Bericht.

Chris' Ansagen, wörtlich: *„lass für jede disziplin die quasi 'bekannt' ist fable suchen nach
formeln und funktionen die man sich aus bekannten spielen oder indie games ziehen kann, durchforste
github etc"* — und zur Staffel: *„dann support stats bei der staffel zb in kurvengeschwindigkeit
oder staffelstab übergabe überleiten damit es nicht nur der reine speed ist"*.

---

## Die fünf Empfehlungen, ohne Architekturwissen lesbar

**Staffel.** Das Problem ist nicht das Rezept, sondern das **Maß**: sechs Läufer bekommen dieselbe
Teamzeit, also kann kein Attribut eines Einzelnen etwas „bewirken". Der echte Sport misst genau
das, was uns fehlt — die **Abschnittszeit je Läufer** (Split) und die **Zeit des Stabs in der
Wechselzone**. Nachgemessen an einem Rennen: dasselbe Rennen liest mit der Teamzeit rho 0,386, mit
der Abschnittszeit 0,672. Dazu drei Befunde am Motor, die vor jeder Rezeptarbeit zu beheben sind:
(1) **wartende Läufer spenden Windschatten** — auf den Beinen 2–5 hängt jeder Läufer 35–40 % seiner
Zeit im „Sog" des Mannes, der reglos in der Wechselzone steht; (2) es gibt **keinen fliegenden
Start** — jedes Bein beginnt bei voller Geschwindigkeit, der einzige Grund, warum eine Staffel real
2–3 s schneller ist als vier Einzelzeiten, existiert im Motor nicht; (3) das Rennen ist bei fester
Aufstellung **saatunabhängig identisch** (drei Saaten, zeichengleiche Zeiten) — der Wechsel ist
das einzige Los, und er misslingt in 3,8 % der Fälle. Chris' Idee trägt: **Kurve** und
**Übergabe** sind real die beiden Größen, die neben dem reinen Tempo den Ausgang bestimmen (Ward-
Smith & Radford 2002: Bahnziehung 0,27 s, freie Distanz bis 0,30 s, Übergabesorgfalt ~0,1 s je
Wechsel, Laufreihenfolge 0,06 s — bei einem Rennen um 37 s). Die Attribute dafür stehen schon im
Rezept (WENDIGKEIT: dexterity/awareness/speed, TECHNIK: awareness/dexterity/charisma); was fehlt,
ist ein **Kanal**, in dem sie Zeit kosten oder bringen, statt eines Ja/Nein-Wurfs.

**Spurt.** Funktioniert (rho 0,810 reproduziert). Was sich aus dem Sport holen lässt, ist eine
**Eichung** statt einer neuen Mechanik: das Touchdown-Modell der 110-m-Hürden (151 Elite-Rennen,
Touchdown-Zeiten als lineare Funktion der Endzeit) sagt, dass eine Hürdeneinheit 1,05–1,10 s
dauert, wo die gleiche Strecke flach ~0,85 s bräuchte — die Hürde kostet **~0,2 s je Einheit**,
und zwar bei jedem, auch dem Weltmeister. Bei uns kostet eine Hürde nichts (Technik gelingt) oder
einen Sturz. Ein kleiner **Grundpreis je Hürde**, den Technik verkleinert, wäre die realistischere
Form; sie ist aber kein Muss, weil die Abnahme heute besteht.

**Zeitfahren.** In meinem Lauf besteht es (rho 0,917; die 0,102 aus der Aufgabenstellung konnte ich
nicht reproduzieren, s. u.). Das Vorbild aus Sport und Code ist eindeutig: das **Leistungsmodell
Martin et al. 1998** (Luftwiderstand ∝ v³, Rollwiderstand, Steigung; Geschwindigkeit aus Leistung
über eine kubische Gleichung) — es steht in drei offenen Repos, eines davon MIT. Für uns ist der
übertragbare Kern nicht die Aerodynamik, sondern der **Haushalt**: konstante Leistung ist real fast
optimal (Atkinson: ±15 % Variation bringt „bis zu wenige Prozent"), und **in der Kurve ist die
Leistung null** — die Kurve kostet Zeit, die auf der Geraden nicht zurückkommt (Zignoli 2021).
Genau so ist unser Zeitfahren gebaut (neun Kurven, Linie entscheidet); der Haushalt (`reserve`)
ist das Gegenstück zur Leistung. Empfehlung: nichts umbauen, aber die Kurvenformel
`v_max = sqrt(μ·g·R)` als Bild für die Kalibrierung nehmen (Kurvenverlust ~ (1 − Linie)).

**Klettern.** Besteht in meinem Lauf (0,820; Aufgabenstellung: 0,363). Der Sport kennt **zwei**
Klettern: Speed (15 m, 20 Griffe, 4,5–6 s, entschieden durch Beinkraft und Bewegungsharmonie —
Prädiktoren Unter-/Oberkörperkraft, R² 35–44 %) und Lead/Ausdauer (entschieden durch Fingerkraft
und Hangzeit, ein Strukturmodell erklärt 97 % der Varianz). Unsere Matrix (stamina 26) beschreibt
das zweite, unsere Mechanik (10 Griffe, ~12 s, Steigung zieht den Verbrauch) auch. Das passt
zusammen; die belastbarste Formel aus offenem Code ist die **Ausdauer-Uhr aus Celeste**
(110 Punkte, Klettern kostet 45,45/s, Halten 10/s, Sprung 27,5, „müde" unter 20) — dieselbe
Bauform wie unsere `reserve`, nur mit dem Unterschied, dass dort **auch das Halten** kostet.
Das wäre der eine Hebel: ein Fehlgriff kostet nicht nur Zeit, sondern die Zeit am Griff kostet
Reserve.

**Takeshi's Castle.** Besteht in meinem Lauf (0,852; Aufgabenstellung: 0,274). Real ist die
Fiktion härter als unsere: 100–142 Teilnehmer, 8 Siege in 133 Folgen; Sasuke: 100 Starter, 10–15 %
schaffen Stage 1, 6 Gesamtsiege in 43 Turnieren. Einzelne Hindernisse haben dagegen sehr hohe
Gelingquoten (Quad Steps 95,6 %) — die Auslese kommt aus der **Kette**, nicht aus dem einzelnen
Hindernis. Das ist genau unser Nervenmodell. Aus der OCR-Forschung (n=32): Finishzeit hängt an
anaerober Leistung (β −6,47), Laufzeit über eine Meile (β +6,43) und Tragekraft (β −0,04);
Griffkraft korreliert. Es gibt **kein** offenes Spiel mit einem Hindernisparcours-Modell, das
mehr hergibt als unseres; Fall Guys ist zu, die Godot-Läufer auf GitHub sind Stolper-Timer.

---

## Was ich nachgemessen, was ich abgerufen, was ich nur gelesen habe

**Nachgemessen** (Playwright/Chromium, `public/mockups/battle-mode.html` auf `ca03e24f`; die
Skripte nennen die Quelldatei in der ersten Ausgabezeile):

| Zahl | Lauf | Ergebnis |
|---|---|---|
| Rangtreue der fünf Bahnen | `scripts/miss-alle-disziplinen.mjs 24 spurt staffel time-trial climbing takeshis-castle` | rho je Spiel: time-trial **0,917** · takeshis-castle **0,852** · climbing **0,820** · spurt **0,810** · staffel **0,598**; rho Saison 1,000 / 0,958 / 0,888 / 0,786 / 0,762 |
| dieselbe Messung mit 6 Spielen | `… 6 …` | time-trial 0,927 · climbing 0,868 · spurt **0,853** (= Commit-Nachricht `ca03e24f`) · takeshis-castle 0,850 · staffel **0,578** |
| Staffel, Teamzeit gegen Abschnittszeit | eigenes Skript über `__arena.spiele("staffel", saat)`, Protokoll `rennFertig` (trägt `startT`, `fertig`, `bein`, `eig`) | dasselbe Rennen (Saat 1337): rho **0,386** mit Teamzeit, **0,672** mit Abschnittszeit je Läufer |
| Staffel, Zufall | drei Saaten (1337, 9256, 17175), feste Aufstellung | Abschnittszeiten **zeichengleich** (2,07 / 2,62 / 2,18 / 1,82 / 2,03 / 2,40 s links, 1,63 / 1,87 / 1,70 / 1,87 / 2,03 / 1,85 s rechts); Zielabstand der Teams 2,28 s im Mittel (Median 2,17) bei 11–13 s Rennzeit |
| Staffel, Wechsel | 24 Rennen, 240 Wechsel | **9 verpatzt (3,8 %)**; 0 von 288 Läufern „leer" |
| Staffel, Windschatten | `schattenS/spitzeS` je Läufer | Bein 1 (hinten liegender Startläufer) 93 % im Sog; Beine 2–5 **35–40 %** im Sog, obwohl der Gegner meist außer Reichweite ist; Bein 6 **0 %** |
| Hürden, Touchdown-Mittel | `iwasaki71/race_predict`, CSV n=151, selbst gemittelt | Endzeit 13,65 ± 0,33 s; Touchdown H1 2,61 s; H2 3,68; H3 4,73; H4 5,78; H5 6,83; H6 7,89; H7 8,95; H8 10,02; H9 11,10; H10 12,21; Einlauf 1,45 ± 0,05 s |

**Abgerufen** (Websuche/-fetch, Zahlen wörtlich aus der Quelle; PDFs per `pdf-parse` extrahiert):

| Kennzahl | Wert | Quelle |
|---|---|---|
| Sprintprofil eines 10,00-s-Läufers (0,18 s Reaktion) | 20 m: 10,28 m/s (89 % des Maximums), 30 m: 10,97 (94 %), Maximum 11,60 bei 60 m, 100 m: 11,19, 130 m: 10,60 | Ward-Smith & Radford 2002, J Sports Sci 20:369–381, Tab. 2 (PDF atleticalive.it) |
| Stab-Tragezeit je Bein, Referenzstaffel | Bein 1: 9,82 s (aus dem Stand), Beine 2–4: **8,88 s** (fliegend) — Staffel 36,64 s ohne Kurve | ebd., Tab. 4 |
| Laufstrecken je Bein, optimaler Plan | 109 / 123 / 124 / 120 m gelaufen; Stab getragen 110 / 98 / 98 / 94 m | ebd., S. 379 |
| Kurveneffekt | +0,69 s (Bahn 8) bis +0,96 s (Bahn 1) gegen eine gerade Bahn; **0,27 s** zwischen Bahn 1 und 8 | ebd., Tab. 6, 13 |
| Freie Distanz beim Wechsel | „each 1 m of total free distance reduces the time … by just under 0.1 s"; 3 m ≈ 0,3 s | ebd., Tab. 8, S. 379 |
| Laufreihenfolge (10,0/10,1/10,2/10,3 s) | 0–0,06 s; optimal: **Schnellster auf Bein 1**, Langsamste auf 3 und 4 | ebd., Tab. 12, 13 |
| Sorgfalt am Wechsel | „(37.4 − 37.1)/3 = 0.1 s at each exchange" erklärt die Lücke Modell/Weltrekord | ebd., S. 378 |
| Kurvenformel (Greene 1985) | w = (v/v₀)², r = R·g/v₀²; w aus einer kubischen Gleichung in r (Gl. 10); für Elite r ≈ 3 → „5 % or less" | ebd., Gl. 8–11 |
| Bahnradien IAAF-Standardbahn | Bahn 1: 36,80 m … Bahn 8: 45,24 m (je +1,22 m) | ebd., Tab. 1; Wikipedia „All-weather running track" (36,80 / 37,92 / 39,14) |
| Wechselzone | seit 1.11.2017 **30 m** (vorher 20 m + 10 m Anlauf) | Wikipedia „4 × 100 metres relay"; Zarębska 2021 |
| Staffel gegen Einzelzeiten | „typically 2–3 seconds faster than the sum of best times" | Wikipedia „4 × 100 metres relay" |
| Wechselzeit (ET) gegen Übergabepunkt (HP) | r = −0,45 (Männer, 1./3. Wechsel) bis −0,72 (Frauen, 2. Wechsel); HP erklärt höchstens 50 % von ET | Zarębska et al. 2021, Acta Kinesiologica 15 Supp.1:27–31 (PDF akinesiologica.com) |
| Ausfallquote Staffel-Finals | Männer 2000–2019: **21,1 %** (56 von 266) DNF/DQ; Frauen 17,3 % | ebd. |
| Übergabetechnik | „takes place on two strides in less than 1 s", optimaler Freiraum 1,5–2 m; nach 20 m Anlauf 89 % des Maximaltempos; 1991: 33 % (M) / 71 % (F) der Wechsel in der ersten Hälfte der Zone | ebd. (mit Verweis auf Ward-Smith/Radford, Fukashiro 1992) |
| Zonenzeit-Prädiktoren (China, Elite) | Zonenzeit 30 m korreliert mit Einlauftempo des Abgebenden r = −0,600, Tempo des Annehmenden beim Übergabebeginn r = −0,502, zusammen **55 % der Varianz** | Scientific Reports 2025, s41598-025-20829-6 — **nur Abstract** (Volltext hinter Cookie-Redirect) |
| Bahnvorteil 200 m (Wettkampfdaten) | Bahn 8 gegen Bahn 2: **0,084–0,178 s** schneller, n = 1551; 400 m: außen schneller, „noisy" | PMC9348673 „Are there lane advantages in track and field?" |
| Kurvenlauf, gemessen | Radius 17,2 m: **−10,0 ± 2,4 %**; 36,5 m: **−4,1 ± 1,6 %** gegen gerade (n = 9); Greene sagte 6,8 / 1,0 % voraus | PMC11093109 |
| Kurvenlauf, enge Radien | v_curve/v₀ = **0,746·(R·g/v₀²)^0,363**; 1 m: 2,99 m/s, 6 m: 5,66 m/s, gerade 7,70 m/s; Innenbein liefert 69 % der Kraft | Chang & Kram 2007, J Exp Biol 210:971 |
| 100-m-Elite, Mono-Exponential | v(t) = v_max·(1 − e^(−t/τ)); v_max 11,39 ± 0,33 m/s, **τ 1,17 ± 0,07 s**, Tempoverlust 3,3 %; Partialkorrelation τ mit 100-m-Zeit 0,86 | PMC8847979 |
| 110 m Hürden, WM 2017 Finale | Start–H1 2,24–2,36 s (ohne Reaktion); Hürdeneinheiten 0,99–1,10 s; H10–Ziel 1,53–1,59 s; Flugzeit über der Hürde 0,307–0,353 s; Hürdendistanz 3,64–4,00 m | World Athletics Biomechanical Report 110 m H Men (PDF) |
| Touchdown-Modell Miyashiro | TD_k = a_k·T + b_k, (a,b) = (0,1159; 1,0385) … (0,8961; −0,0120) | `iwasaki71/race_predict`, Datei `code`; PLOS One 10.1371/journal.pone.0278651 |
| Speed-Klettern, Wand | 15 m, 5° Überhang, **20 Handgriffe, 11 Tritte**, zwei 3-m-Bahnen | Wikipedia „Speed climbing wall" |
| Speed-Klettern, Rekorde | Männer **4,54 s** (Zhao Yicheng, 10.05.2026), Frauen **5,99 s** (Emma Hunt, 04.07.2026); Olympia 2024: 4,74 / 6,06 | Wikipedia „Speed climbing" |
| Speed-Klettern, Abschnitte | Start 0,39 s/m, Mitte 0,38, Ende **0,45 s/m**; Reaktion 0,13 (Median) bis 0,27 s, ohne Zusammenhang zur Endzeit; Fuß-Frequenz 1,5–2,0 Hz; Elite R² 0,83–0,94 harmonischer Fit gegen 0,39–0,76 | MDPI Bioengineering 12(9):957 (PMC12467755), 1717 Läufe, 248 Athleten |
| Speed-Klettern, Prädiktoren | R² 44 % (F) / 35 % (M): Unterkörperkraft β 0,43 / 0,47, Oberkörperkraft β 0,40 / 0,37 (n = 61) | PubMed 37486001 (Augsburg) — **Abstract aus dem Suchergebnis, PDF lieferte 503** |
| Lead-Klettern, Prädiktoren | Strukturmodell aus Griffkraft, Bent-arm-Hang, Fingerhang + Körperfett, Umfang, Erfahrung erklärt **97 %** der Varianz (n = 205) | Baláš et al. 2012, Eur J Sport Sci 12:16 — Abstract (Wiley) |
| Boulder gegen Lead | Boulderer 28,7–52,9 % mehr Kraft/RFD, Zugtempo +26 %; **Unterarm-Ausdauer ohne Unterschied** (107 s gegen 83 s, p = 0,088), n = 31 | PLOS One 10.1371/journal.pone.0222529 |
| OCR-Prädiktoren | n = 32; Wingate-Leistung β −6,47 ± 1,12, Meile β +6,43 ± 0,71, Eimertragen β −0,04 ± 0,01 | Human Movement 2020, hummov.awf.wroc.pl 10.5114/hm.2020.89914 |
| Takeshi's Castle | 86–142 Teilnehmer je Folge; 133 Folgen; **8 Siege** (erster in Folge 31) | Wikipedia; fandomwire.com; keshiheads.co.uk (403) |
| Sasuke | 100 Starter; „85 to 90 … eliminated in Stage 1"; **6 Kanzenseiha in 43 Turnieren**; Quad Steps 95,56 % Gelingquote (900 Versuche, 40 Stürze) | Wikipedia „Sasuke (TV series)", Suchergebnis TV Tropes / NamuWiki; sasukepedia lieferte 503 |
| Radfahren, Leistungsmodell | P = (1 − Loss)⁻¹ · [F_grav + F_roll + F_drag] · v; F_drag = ½·C_d·A·ρ·v_air²; Antriebsverlust ~2 %; Geschwindigkeit per Cardano aus aV³ + bV² + cV + d = 0 | gribble.org „power_v_speed" (Steve Gribble) |
| Drafting | 2. Fahrer −29 %, 3. weitere −7 % (Broker); Blocken bei 0,1 m: 27,1 / 23,1 / 13,8 % je Haltung; Olds 1998: Faktor = 0,62 − 0,0104·d_w + 0,0452·d_w² | Suchergebnisse (ScienceDirect-Review, arXiv Trenchard) — Primärquellen nicht abgerufen |
| Pacing im Zeitfahren | ±15 % Leistungsvariation → „a few percent"; 16,1 km mit Gegen-/Rückenwind: konstant 10 s, variabel 12 s Gewinn | Atkinson et al. 2007 (ResearchGate-Abstract), Springer EJAP 2011 |
| Kurven im Zeitfahren | technische Abschnitte 25 % der Strecke beeinflussen Zeit und Spitzenleistung, nicht das Pacing; Kurvenverlust wird auf der Geraden nicht zurückgeholt; in der Kurve keine Leistung | Zignoli 2021 (ResearchGate-Abstract, 403 auf Volltext); Sports Engineering 2020 (Springer, Cookie-Redirect) |
| Pro Cycling Manager | 13 Attribute 50–85; Zeitfahr-Anstrengungsbalken 70–75 % bei 25–35 km | cyanide-studio.com Guide, Steam-Community — **kein Formelzugang** |

**Nur gelesen, nicht belegt:** die Faustformel „Summe der vier 100-m-Zeiten minus 2,7 s"
(speedendurance.com lieferte bei drei Aufrufen leere Seiten — Zahl aus dem Suchergebnis); der
Abschnitts-Split-Bereich 8,9–9,2 s für fliegende 100 m (dieselbe Quelle); die Studie der JISS zum
Tokio-2025-Finale (World Athletics nennt keine Zahl, athleticsillustrated auch nicht); Karlsson &
Lunander 2024 (Sage 403, SWoPEc ohne PDF — nur die Modellstruktur aus dem Abstract: Unsicherheit
über die Position des Ankommenden am Checkmark plus Tagesform, Abwägung Zeit gegen
Disqualifikation); Radford & Ward-Smith 2003 (Checkmark 11,04–12,20 m bei 1 m freier Distanz,
nur aus dem Suchergebnis); MDPI Applied Sciences 14:9604 zu OCR (403).

### 0.1 Die rho-Zahlen aus der Aufgabenstellung konnte ich nicht reproduzieren

Die Aufgabe nennt staffel −0,038, time-trial 0,102, climbing 0,363, takeshis-castle 0,274. Auf
`ca03e24f` mit dem Skript aus demselben Commit und n = 24 messe ich 0,598 / 0,917 / 0,820 / 0,852;
mit n = 6 siehe die Zeile unten. Möglich sind ein anderer Stand, ein anderes n oder der in
`hockey-rollout-plan-review-fable.md` (Befund 15) beschriebene `eig`-Rückfall `(p.d[d]||0)`, der
je nach Kader Nullen liefert. **Was in diesem Bericht steht, bezieht sich auf meine Zahlen**; die
Empfehlungen zur Staffel gelten unabhängig davon, weil sie an der Struktur hängen, nicht an der
Höhe der Zahl.

| n | staffel | time-trial | climbing | takeshis-castle | spurt |
|---|---|---|---|---|---|
| 24 | 0,598 | 0,917 | 0,820 | 0,852 | 0,810 |
| 6 | 0,578 | 0,927 | 0,868 | 0,850 | 0,853 |

Bei n = 6 steht Spurt auf 0,853 — exakt die Zahl aus der Commit-Nachricht von `ca03e24f` („Erster
Lauf … spurt 0,853"). Das Skript, der Stand und die Saaten sind also dieselben; die vier niedrigen
Zahlen aus der Aufgabenstellung stammen von woanders. **Nur die Staffel fällt reproduzierbar durch**
(0,578 / 0,598).

---

## 1. Staffel

### 1.1 Warum jedes Attribut null liest — drei Ursachen, alle am Code belegt

**Ursache 1: das Maß.** `MOTOREN.staffel.wert()` (`engine.js:14799–14803`) gibt jedem der sechs
Läufer einer Seite `−u.fertig`, und `u.fertig` ist für alle sechs dieselbe Zahl (`:13017–13021`:
„Alle sechs bekommen dieselbe Zeit und denselben Platz"). Innerhalb einer Seite gibt es damit
**keine Rangfolge**; rho je Spiel entsteht nur daraus, welches Team gewinnt und wie die Eignungen
zufällig über die Teams verteilt sind. Mit zwölf Teilnehmern und zwei Werten kann die Zahl
strukturell nicht über die Zufallsverteilung hinaus. (Der Kommentar an der Stelle sagt selbst:
„Plaetze kippen nur, wenn die beiden Teams tauschen, und das ist ein Muenzwurf, kein Mass" — und
ersetzt den Münzwurf durch die Teamzeit, die dasselbe Problem hat, nur mit Kommastellen.)

**Ursache 2: der Sog vom Stehenden.** `vordermann()` (`:12746–12759`) sucht jeden Läufer mit
`fertig==null`, 0,004–0,062 voraus und höchstens 1,05 Bahnen daneben — **ohne `aktiv` zu prüfen**.
In der Staffel stehen die Wartenden mit `fertig==null` an ihrer `beinVon`-Marke (`:12665–12668`),
und zwar auf beiden Bahnen (`bahnenFest:2`). Jeder laufende Läufer findet auf den letzten 0,062
seines Beins (37 % von 1/6) einen „Vordermann": den eigenen Nachfolger (Bahnabstand 0) oder den
gegnerischen (Abstand 1). Er läuft dann mit `SCHATTEN_TEMPO` 1,045 und zahlt nur 66 % Reserve.
Gemessen: Beine 2–5 haben `schattenS` 0,65–0,83 s bei 1,7–2,6 s Beinzeit, Bein 6 exakt 0,00 s
(niemand steht davor). Folge zwei: `u.imSchatten && u.pos>=u.ab` löst „vorbei: raus aus dem Sog"
aus (`:12836`) — die Läufer auf Bein 5 wechseln in beiden Teams die Bahn (`bahn` 1 bzw. 0 im
Protokoll), um an einem stehenden Mann vorbeizukommen, und zahlen `quer` 0,94.

**Ursache 3: kein fliegender Start, kein Zufall.** `tempoVon()` (`:12703 ff.`) liefert ab dem
ersten Tick `(92 + ANTRITT·0,9)·…` px/s — es gibt **keine Beschleunigungsphase**, `phase`
blendet nur von ANTRITT nach ENDTEMPO über. Damit ist jedes Bein ein Start aus dem Stand, und
zugleich ist keines einer: der Unterschied zwischen Bein 1 (aus den Blöcken) und Bein 4 (fliegend)
existiert nicht. Real ist das der **ganze** Vorteil einer Staffel (Ward-Smith Tab. 4: 9,82 s
gegen 8,88 s für 100 m mit Stab). Und weil `rr()` in der Staffel nur den Wechsel (`:12997`) und
den Bahnwechsel-Wunsch (`:12849`) trifft, ist das Rennen bei fester Aufstellung deterministisch:
drei Saaten, zwölf zeichengleiche Beinzeiten. Der einzige Zufall — der verpatzte Wechsel — trifft
in 3,8 % der Fälle und kostet dann 1,55 s Stolpern (`wechselStrafe`), d. h. ein Wechsel ist zu
96 % **wertlos** und zu 4 % **rennentscheidend**. Das ist die Form, die der Hockey-Bericht bei der
Hürde schon einmal verworfen hat („solange ein Hindernis zu 80 % gelingt, kostet es fast nie
etwas — und dann zahlt das Attribut nicht").

Was daraus folgt, **bevor** irgendein Rezept angefasst wird: (a) `vordermann` muss `aktiv`
prüfen (eine Zeile); (b) `wert()` braucht ein Einzelmaß (1.3); (c) der Wechsel braucht einen
stetigen Preis (1.4). Erst dann sagt eine Messung etwas über die Rezeptgewichte.

### 1.2 Was der echte Sport misst — und in welcher Größenordnung

Die Größen, mit Zahl und Quelle (Tabelle oben), in der Reihenfolge ihres Gewichts nach
Ward-Smith & Radford (Tab. 13, für vier 10,00-s-Läufer):

| Größe | Real | Wo sie bei uns hingehört |
|---|---|---|
| **Fliegender Start** | 100 m mit Stab: 9,82 s aus dem Stand, 8,88 s fliegend — **0,94 s je Bein**; nach 20 m Anlauf 89 % des Maximums, nach 30 m 94 % | eine Beschleunigungsphase je Bein, die der Annehmende beim Wechsel **teilweise schon hinter sich hat** (1.4) |
| **Kurve** | Bahn 1 gegen Bahn 8: 0,27 s auf 37 s (0,7 %); Kurve gegen Gerade: 0,69–0,96 s (~2,5 %); gemessen bei R = 36,5 m −4,1 %, R = 17,2 m −10 % | ein Faktor auf `tempoVon` für die Kurvenbeine, den ein Sub-Skill verkleinert (1.5) |
| **Freie Distanz / Übergabepunkt** | jeder Meter ~0,1 s; 3 m ≈ 0,3 s; ET–HP r bis −0,72 | der stetige Wechselpreis (1.4) |
| **Sorgfalt am Wechsel** | ~0,1 s je Wechsel Unterschied zwischen „flat out" und „sicher" | dieselbe Formel, als Risiko/Zeit-Abwägung der Pläne |
| **Laufreihenfolge** | 0–0,06 s; Schnellster auf Bein 1 (Reaktionszeit und Beschleunigung wiegen dort) | ergibt sich von selbst, sobald es Beschleunigung gibt — dann lohnt der Schnellste vorn |
| **Ausfall** | 21 % der Männerstaffeln in Finals DNF/DQ (2000–2019) | unser 3,8 %-Patzer ist der Ersatz; er sollte seltener **und** milder sein, nicht seltener und härter |

**Wo die fliegenden Beine real liegen, mit Zahl:** ein elitärer Abschnitt 2–4 läuft in 8,9–9,2 s
(Split-Statistiken, nicht belegt, s. o.), ein Startbein in 10,2–10,5 s; die Differenz von ~1 s ist
Ward-Smiths 0,94 s. Bei uns dauern alle sechs Beine 1,6–2,6 s; die Streuung kommt allein aus den
Attributen, nicht aus der Position.

### 1.3 Woran man den Beitrag EINES Läufers misst — die Antwort des Sports

Der Sport hat genau drei Einzelmaße, und alle drei sind bei uns aus dem Protokoll ableitbar, ohne
den Motor zu ändern (`spiele("staffel")` liefert `rennFertig` mit `startT`, `fertig`, `bein`):

1. **Abschnittszeit (Split)**: Zeit vom eigenen `startT` bis zum `startT` des Nachfolgers (Bein 6:
   bis `fertig`). Das ist, was World Athletics je Läufer veröffentlicht. Gemessen liest dasselbe
   Rennen damit **0,672 statt 0,386**.
2. **Zonenzeit (ET)**: Zeit des Stabs in der Wechselzone, real 30 m; sie gehört **beiden**
   Läufern — der Sport rechnet sie dem Paar zu, die Regressionen (China 2025) teilen sie in das
   Einlauftempo des Abgebenden (r −0,60) und das Anlauftempo des Annehmenden (r −0,50).
3. **Summe der Einzelbestzeiten minus Staffelzeit** als Teammaß der Technik (Zarębska: „accurately
   defines the efficiency of the relay team").

Für `wert()` schlage ich die Kombination aus 1 und 2 vor, und zwar **relativ zum Gegner auf
demselben Bein** — das nimmt die Beinlänge und die Bahnposition heraus, weil beide Teams auf jedem
Bein exakt einen Läufer haben:

```
// wert(u) fuer die Staffel — PLATZHALTER, gegen rho zu messen
split(u)      = startT(nachfolger(u)) − startT(u)        // Bein 6: fertig − startT
zone(u, v)    = Zeitverlust am Wechsel u→v (aus 1.4), hälftig auf u und v
wert(u)       = split(gegner_auf_bein(u)) − split(u)
              − 0.5·zone(vorgaenger(u), u) − 0.5·zone(u, nachfolger(u))
```

Warum nicht einfach `−split(u)` über alle zwölf: die Beine unterscheiden sich real (Start aus dem
Stand, Kurve/Gerade), und sobald der Motor das abbildet (1.4, 1.5), vergleicht `−split` einen
Startläufer mit einem Geraden-Läufer — die Rangfolge liest dann Position, nicht Eignung. Die
Differenz zum Gegner auf demselben Bein hat diesen Fehler nicht und ist dieselbe Denkfigur wie das
Plus/Minus im Feldspiel. Sie hat einen Preis: sechs Paare liefern sechs Zahlenpaare mit
Nullsumme; rho je Spiel läuft dann über zwölf Werte, von denen je zwei sich spiegeln. Das ist in
Ordnung — der Spiegeltest ist damit gratis (identische Aufstellungen → alle Werte 0).

Was `wert()` **nicht** enthalten darf: die Teamzeit. Sonst ist die Rangfolge innerhalb einer
Seite wieder ein Gleichstand.

### 1.4 Chris' Idee, Teil 1: die Übergabe als eigene Größe — Attribute und Koeffizienten

Real hängt die Zonenzeit an vier Dingen (China 2025, Zarębska 2021, Ward-Smith 2002): (1) wie
schnell der Abgebende **noch** ist, wenn er die Zone erreicht (Tempoausdauer, r −0,60); (2) wie
schnell der Annehmende beim Übergabebeginn **schon** ist (Antritt und Timing seines Losgehens am
Checkmark, r −0,50); (3) wie weit hinten in der Zone übergeben wird (Übergabepunkt, r bis −0,72 —
das ist Vertrauen und Absprache); (4) die freie Distanz (Reichweite der Hand, 1,5–2 m). Ausfälle
(21 %) sind Fehleinschätzungen des Losgehens (Karlsson & Lunander modellieren genau diese
Unsicherheit).

Das heutige Rezept `TECHNIK: {awareness:38, dexterity:32, charisma:30}` (`:12444`) deckt (3) und
(4) gut ab: awareness = Timing/Checkmark, dexterity = Hand, charisma = Absprache/Vertrauen. Was
fehlt, ist nicht ein Attribut, sondern dass (1) und (2) **gar nicht** und (3)/(4) nur als
Münzwurf eingehen. Vorschlag für den Kanal, mit Koeffizienten aus den Quellen:

```
// WECHSEL u -> v. Alle Werte 0..100 (Sub-Skills wie heute aus spurtWerte()).
q_technik  = (u.TECHNIK + v.TECHNIK) / 200            // Übergabepunkt, Hand, Absprache — wie heute
q_ein      = u.ENDTEMPO / 100                          // Einlauftempo des Abgebenden (r −0.60)
q_aus      = v.ANTRITT  / 100                          // Anlauftempo des Annehmenden (r −0.50)
Q          = 0.45·q_technik + 0.30·q_ein + 0.25·q_aus  // 55 % der Varianz aus Tempo (China 2025),
                                                       // Rest Technik — die 0.45 ist der Rest, keine Messung

// (a) FLIEGENDER START: der Annehmende hat beim Übergabepunkt einen Teil seiner
//     Beschleunigung schon hinter sich. Real: nach 20 m 89 % des Maximums, nach 30 m 94 %.
//     Der Motor bekommt dafür eine echte Anlaufphase (s. 2.2, τ) — und der Annehmende
//     startet sie nicht bei t=0, sondern bei
v.anlaufT  = τ_v · ln(1 / (1 − 0.89·Q))                // Q=1: er ist bei 89 % → ~2.2·τ vorgelaufen
                                                       // Q=0: er steht (heutiges Verhalten)
// (b) ZEITPREIS statt Münzwurf: jede Übergabe kostet, wenig bei guter, viel bei schlechter.
//     Real: freie Distanz 0..3 m = 0..0.3 s; Sorgfalt ~0.1 s je Wechsel. Auf unsere Uhr
//     (Bein ~2 s statt ~9 s, Faktor ~4.5): 0..0.09 s.
verlust    = 0.09 · (1 − Q)                            // Sekunden Rennzeit, als startT-Versatz von v
// (c) PATZER bleibt, aber seltener und als Los über dieselbe Q:
p_patzer   = 0.06 · (1 − Q)^2                          // Q=0.5: 1.5 %, Q=0.2: 3.8 % (heutige Rate)
                                                       // kostet wie heute wechselStrafe·(1−WENDIGKEIT·…)
```

Zwei Bemerkungen dazu. Erstens: (a) ist der eigentliche Hebel. Er macht aus dem Wechsel das,
was er real ist — **Zeitgewinn**, nicht nur Risiko — und er gibt ENDTEMPO des Abgebenden und
ANTRITT des Annehmenden erstmals einen Kanal, der über das eigene Bein hinausreicht. Zweitens:
die Koeffizienten 0,45/0,30/0,25 sind aus einer Regression mit r-Werten abgeleitet, nicht aus
einer Sondierung an unserem Motor; sie sind der Startwert für `miss-…`, nicht das Ergebnis.

### 1.5 Chris' Idee, Teil 2: Kurvengeschwindigkeit — Attribute und Koeffizienten

**Die Physik:** Greene 1985 (in Ward-Smith Gl. 8–11) — die Kurve verlangt eine seitliche
Bodenkraft, die vom Maximalkraftbudget abgeht; die Geschwindigkeit sinkt mit `r = R·g/v₀²`. Für
Elite bei R = 36,8 m ist r ≈ 2,8 und der Verlust ≤ 5 %; gemessen −4,1 % bei R = 36,5 m und −10 %
bei R = 17,2 m (PMC11093109), und die enge Formel `v/v₀ = 0,746·(R·g/v₀²)^0,363` (Chang & Kram)
gilt bis 6 m. Wer langsamer ist, verliert **weniger** (Ward-Smith S. 380: „the differential
… is a function of running speed") — ein Kurvenmalus muss deshalb mit dem Tempo wachsen, sonst
bestraft er die Schwachen.

**Was ihn real verkleinert:** die Kraft des Innenbeins (Chang & Kram: Innenbein 69 %, Außenbein
83 % der Geradenkraft — die Kurve limitiert über das Innenbein), die Neigung und der Fußaufsatz
(Technik), die Linie (innen an der Bahn, Trackandfieldnews-Roundtable: Kurvenläufer laufen „on
the inside part of the lane"). Also: Kraft, Technik, Blick.

**Bei uns:** die Staffel läuft auf zwei festen Bahnen ohne Kurven. Die Kurve muss also erst als
**Ort** existieren. Real sind Beine 1 und 3 (von vier) Kurvenbeine; bei sechs Beinen die
natürliche Übertragung: **Beine 1, 3, 5 Kurve, Beine 2, 4, 6 Gerade** — das ist zugleich die
Slot-Logik `curverunner` (`planJeSlot`, `:12464`), die heute nur einen Plan wählt und keinen Ort
hat. Formel:

```
// Kurvenbein: Faktor auf tempoVon(u)
KURVE      = u.WENDIGKEIT                              // Rezept heute: dexterity 42, awareness 34, speed 24
                                                       // — das IST das Kurvenrezept (Technik + Blick + Tempo);
                                                       // Innenbein-Kraft fehlt, weil power in der Staffel-
                                                       // Matrix nicht vorkommt. Kein neuer Sub-Skill nötig.
v_rel      = v / v_max_feld                            // Tempo relativ zum schnellsten Läufer (Malus wächst mit Tempo)
malus      = (0.10 − 0.07·KURVE/100) · v_rel^2         // KURVE 0: −10 % (enge Kurve), KURVE 100: −3 % (Elite, R≈37 m)
v_kurve    = v · (1 − malus)
```

Größenordnung an der eigenen Uhr: 3–10 % auf ein 2-s-Bein sind 0,06–0,20 s — dasselbe Gewicht
wie der Wechselpreis, und zusammen ~0,3–0,4 s Spielraum je Staffel gegen einen heutigen
Zielabstand von 2,3 s. Der Zielabstand selbst ist der nächste Befund: real trennten 0,6 s den
Ersten vom Letzten eines Olympiafinales (Zarębska, Athen 2004), der Weltrekord ist 4,7 % unter
4×WR. Unsere 2,3 s auf 12 s sind **19 %** — das Feld ist zu weit gespreizt, und in einem so
weiten Feld entscheiden Kurve und Wechsel nichts. Das ist derselbe Befund, den das Spurt-Rezept
in seinem Kommentar (`:12296 ff.`) für die Hürde beschreibt („so weit gespreizt, dass eine
gerissene Huerde nie einen Platz gekostet hat"). `tempoSpanne` 0,90 bei `grundTempo` 92 heißt:
ein Läufer mit Sub-Skill 20 läuft 110, einer mit 80 läuft 164 — 49 % Unterschied. Real liegen
die 100-m-Zeiten eines WM-Finales 3 % auseinander. Vorschlag: `tempoSpanne` auf ~0,45, dann
tragen die 0,3–0,4 s aus Kurve und Wechsel.

**Attribute, die Chris' Satz zusätzlich meint, und ob sie hineingehören:** *spirit* (16 in der
Matrix) und *charisma* (10) sind real belegt — Bry et al. 2009 (nur Titel bekannt, nicht gelesen)
zeigen, dass Priming auf Kooperation die Wechselgeschwindigkeit verbessert; die Absprache
(Checkmark, „Hep"-Ruf) ist Teamarbeit. Sie sitzen heute in TECHNIK (charisma 30) und WUCHT
(spirit 45, charisma 33 — „Zug an der Spitze", ein Sub-Skill ohne Kanal, weil nicht getackelt
wird). Vorschlag: WUCHT in der Staffel zu **ZONE** umdeuten — der Sub-Skill, der `q_aus` und den
Übergabepunkt trägt (spirit/charisma/speed), damit spirit nicht in einem toten Wert sitzt.

### 1.6 Reihenfolge

| Schritt | Was | Messung danach |
|---|---|---|
| S1 | `vordermann`: `if(BA().staffel && !o.aktiv) continue;` | Sog auf Beinen 2–5 → 0 %, Bein 1 bleibt |
| S2 | `wert()` = Split-Differenz zum Gegner auf demselben Bein (1.3) | rho je Spiel; Erwartung > 0,65 ohne weitere Änderung (Einzelrennen: 0,672) |
| S3 | `tempoSpanne` 0,90 → ~0,45, `KRAFT`-Haushalt nachziehen | Zielabstand → ≤ 0,5 s (4 %) |
| S4 | Anlaufphase mit τ (2.2) + Wechsel als Zeitpreis und Vorlauf (1.4) | rho; Anteil ENDTEMPO/ANTRITT in der Sondierung |
| S5 | Kurvenbeine 1/3/5 mit Malus (1.5); WUCHT → ZONE | rho; Anteil awareness/dexterity/spirit |

S1 und S2 sind je eine Handvoll Zeilen und ändern die Rezepte nicht. Alles ab S3 ist Balance mit
Vorher/Nachher-Messung.

---

## 2. Spurt — was aus dem Sport zu eichen wäre, ohne die Abnahme zu gefährden

### 2.1 Der Ist-Stand ist in Ordnung

rho 0,810 je Spiel, 0,786 Saison (n = 24). Das Rezept ist zweimal nachgezogen (`:12283–12305`), die
Mechanik (Technik → Wucht → Sturz, Windschatten, Tackle, Rennplan) ist die reichste der fünf
Bahnen. Was folgt, ist Eichmaterial, kein Umbau.

### 2.2 Die Beschleunigung, die allen fünf Bahnen fehlt

Real: `v(t) = v_max·(1 − e^(−t/τ))` mit τ = 1,17 ± 0,07 s bei Elite (PMC8847979); nach 20 m 89 %,
nach 30 m 94 %, Maximum bei ~60 m (Ward-Smith Tab. 2). Der Motor hat keine Anlaufphase: `tempoVon`
startet bei `(grundTempo + ANTRITT·tempoSpanne)` — ANTRITT ist ein **Niveau**, keine
Beschleunigung. Vorschlag, der ANTRITT seinen richtigen Kanal gibt:

```
τ_u   = 1.6 − 0.8·ANTRITT/100          // Sekunden; Elite 1.17 ≈ ANTRITT 55; skaliert auf 11-s-Rennen
v(t)  = v_ziel(u) · (1 − exp(−(t − startT + anlaufT)/τ_u))
```

Für den Spurt ist das eine Formänderung mit Vorher/Nachher-Messung; für die Staffel ist es die
Voraussetzung für 1.4 (a). Beides kann mit demselben Code kommen.

### 2.3 Die Hürde als Grundpreis, nicht nur als Sturzrisiko

Aus 151 Elite-Rennen (CSV selbst gemittelt): Hürdenabstand 9,14 m, Einheit 1,05–1,10 s, also
8,3–8,7 m/s gegen 11,4 m/s flach — **jede Hürde kostet ~0,2 s, immer**, plus Flugzeit 0,31–0,35 s,
in der niemand beschleunigt. Bei uns: `technik = min(0.97, 0.24 + TECHNIK·0.006)` (`:12281`,
`:12891`) — bei TECHNIK 60 gelingen 60 %, und ein Gelingen kostet **nichts**. Vorschlag:

```
grundpreis  = 0.20 s · (1 − 0.5·TECHNIK/100)        // real 0.2 s/Hürde; Technik halbiert höchstens
```

als kleiner `stolper` bei jedem Gelingen (heute 0 s), Sturz- und Durchbruchzweig unverändert.
Das Miyashiro-Modell `TD_k = a_k·T + b_k` liefert dazu die Prüfzahl: die Abstände zwischen den
Touchdowns wachsen von 1,05 (H2–H3) auf 1,10 s (H9–H10) — Ermüdung ist real +5 % über zehn
Hürden, nicht mehr. Unser `mued` (`:12713`) fällt bis auf 0,60; das ist die Hürdenzahl mal vier.

### 2.4 Offener Code, den es dazu gibt

- **HAZARD-RUSH** (`Oumazshin/HAZARD-RUSH`, Godot, **MIT**): Tastenrhythmus-Sprint mit Hürden.
  `player.gd`: `MAX_SPEED 800`, `SPEED_INCREMENT 150` je gültigem Wechseltipp innerhalb
  `MAX_TAP_GAP 0.200 s`, Verfall `SPEED_DECAY_PER_SEC 200`, beim Stolpern `720`, Boden
  `KEI_FLOOR_SPEED 80`; KI-Reaktionszeit 0,15–0,25 s je Schwierigkeit (`opponent_ai.gd`). Das ist
  die Konami-„Track & Field"-Bauform (Tempo aus Tippfrequenz, Hürde = Timing); als Formel für uns
  nur die Stolper-Kurve interessant: Stolpern ist **dreieinhalbfacher Verfall**, kein Stopp — bei
  uns `stolper` → Faktor 0,35 auf das Tempo, ähnliche Größenordnung.
- **SuperTuxKart** (`supertuxkart/stk-code`, **GPL-3**), `data/kart_characteristics.xml:341`:
  `slipstream base-speed=20 length=8 width=4 inner-factor=0.5 min-collect-time=2.5
  max-collect-time=8 add-power=300 min-speed=8 max-speed-increase=3 duration-factor=1
  fade-out-time=2`. Mechanik (`src/graphics/slip_stream.cpp:1054–1066, 1141–1147`): im Sog
  sammelt man **Zeit** (innen doppelt so schnell), und der Bonus (+3 Tempo, +300 Kraft) wird
  erst beim **Verlassen** des Sogs ausgezahlt, für `gesammelte Zeit × duration-factor` Sekunden.
  Das ist eine andere, spielerischere Fassung als unser Dauerbonus 1,045: der Windschatten als
  Konto, das beim Überholen ausgezahlt wird. Für Spurt und Staffel wäre das ein sichtbarer
  Zug — „Sog gesammelt, jetzt vorbei" —, GPL-3 heißt aber: Idee ja, Code nein.

---

## 3. Zeitfahren

### 3.1 Das Modell, das alle Radsport-Rechner benutzen

Martin et al. 1998 (Validation of a Mathematical Model for Road Cycling Power), in offenem Code
dreimal:

| Repo | Lizenz | Formel / Konstanten |
|---|---|---|
| `GoldenCheetah/scikit-sports` `sksports/model/power.py` | **MIT** | `P = Crr·g·m·v + ½·ρ·S·Cx·v³ + m·g·sin(atan(slope))·v (+ m·a·v)`; Standard Crr 0,0045, Rad 6,8 kg, S 0,32 m², Cx 1, ρ aus Druck/Temperatur |
| `aul12/BikeSimulation` `lib/Simulation.py` | GPL-3 | Bewegungsgleichung `a = P/(m·v) − g·(Δh/d + Crr) − ρ·CdA·(v − v_wind)³/(2·m·v)`; `params.json`: CdA 0,23, Crr 0,002845, m 71 kg |
| `rg-smith/cycling` `calc_power.R` | **keine Lizenz** | `calc_speed`: Geschwindigkeit aus Leistung per Cardano (a = ½·CdA·ρ, c = Crr·m·g + slope·m·g, d = −P); CdA 0,25–0,35, Crr 0,003–0,006 |
| gribble.org „The Computational Cyclist" | kein Lizenzhinweis | `P_legs = (1 − Loss/100)⁻¹·[F_grav + F_roll + F_drag]·v`, Antriebsverlust 2 %, Cardano |

**Drafting** (für Spurt/Staffel-Sog eher als fürs Zeitfahren): Olds 1998 `Faktor = 0,62 − 0,0104·d_w
+ 0,0452·d_w²` (d_w = Radabstand in m; aus dem Suchergebnis, Primärquelle nicht abgerufen);
Broker: −29 % für den zweiten, weitere −7 % für den dritten; Blocken bei 0,1 m: −27,1 % bis
−13,8 % je Haltung. Unser `SCHATTEN_SPAREN` 0,66 (−34 %) liegt genau dort.

### 3.2 Was davon in unser Zeitfahren gehört

Unser Zeitfahren (`:12314–12363`) ist kein Aero-Modell, sondern ein **Haushalt mit neun Kurven**,
und das ist die richtige Abstraktion, weil real drei Dinge entscheiden:

1. **Konstante Leistung ist fast optimal** (Atkinson 2007: ±15 % → „a few percent"; bei Wind
   10 s gegen 12 s auf 16,1 km). Unsere drei Pläne (Gleichmaß 0,93 / Negativ-Split 0,88→1,0 /
   Attacke 1,0 mit `ab` 0,60) bilden das ab; Attacke sollte real **verlieren**, nicht gewinnen —
   prüfbar über `bahnSerie("time-trial", n)` je Plan.
2. **In der Kurve ist die Leistung null** und der Verlust kommt nicht zurück (Zignoli 2021,
   Abstract). Physik: `v_max,Kurve = sqrt(μ·g·R)`; ein optimaler Kurvenradius
   `R = r + d/sin(θ/2)` (Frontiers 2025, GA-Optimierung: 9,7 % Zeitgewinn auf der 400-m-Bahn,
   6,35 % auf der Brücke). Unsere Kurve: `technik = 0,20 + TECHNIK·0,006`, bei Misslingen Risiko
   (`wucht`) oder `stolper` 0,75–1,65 s. Das ist ein **Ja/Nein** mit hohem Preis — wie beim
   Wechsel. Stetiger wäre: jede Kurve kostet `0,5 s·(1 − LINIE/100)`, und der Sturz bleibt das
   seltene Los. Aber: **die Abnahme besteht** (0,917), also ist das nur ein Angebot.
3. **Ermüdung ist ein W′-Konto** — die Critical-Power-Literatur beschreibt genau unsere `reserve`
   (Quelle für die Formel nicht abgerufen; Frontiers nennt das Konto, ohne Zahl — nicht belegt).

**Woran der Beitrag gemessen wird:** die eigene Zeit, wie heute (`−(pl+1)` über die Platzierung).
Beim Zeitfahren ist das korrekt, weil niemand den anderen beeinflusst (kein Sog, kein Tackle).

### 3.3 Pro Cycling Manager

Proprietär. Belegt ist nur die Attributstruktur (13 Werte 50–85, Time-Trial und Prologue
getrennt, Stamina/Resistance als zwei Energiekonten) und das Spielgefühl (Anstrengungsbalken
70–75 % bei 25–35 km). Keine Formel. Die Community-Sim-Projekte auf GitHub (`PCMStack/mcp`,
`Micho27/pcmsimgame`) lesen nur die Datenbank aus.

### 3.4 Die Manager-Repos, die es gibt — und was sie hergeben

| Repo | Lizenz | Befund |
|---|---|---|
| `NicolaiDolmer/CyclingZone` (React/Node, 632 offene Issues, aktiv) | **„All rights reserved"** — ausdrücklich nicht Open Source | nicht gelesen über die Dateiliste hinaus; Code darf nicht übernommen werden |
| `nilkkapaineet/Giro` (Java) | GPL-3 | reine **Lotterie**: 15 Etappenplätze per `Random`, Punkte 100/70/50…; kein Fahrermodell |
| `Duckfest/P07-F04-CyclingManager` (Unity) | keine Lizenz | `RaceExecuteKM.cs`: je 10-km-Block `flatChance·tyreStrength/100` gegen `Random.Range(0,100)`, Sturz-Zweig auskommentiert; Attribute `riderStamina/Sprint/Climbing` ohne Kanal |

Kurz: **kein offenes Radsport-Manager-Repo hat ein Rennmodell, das über Würfeln hinausgeht.** Die
Formeln liegen in den Physik-Rechnern (3.1), nicht in den Spielen.

---

## 4. Klettern

### 4.1 Zwei Sportarten in einem Wort

| | Speed | Lead / Ausdauer |
|---|---|---|
| Wand | 15 m, 5°, 20 Hand-, 11 Fußgriffe, immer dieselbe Route | frei, 15–25 m, 30–60 Züge |
| Zeit | 4,54 s (WR M), 5,99 s (WR F) | Minuten |
| Was entscheidet | Bein-/Oberkörperkraft (β 0,43–0,47 / 0,37–0,40), Bewegungsharmonie (R² 0,83–0,94 bei Elite gegen 0,39–0,76), **nicht** die Reaktionszeit (0,13–0,27 s, r ≈ 0) | Fingerkraft, Hangzeit, Körperfett, Erfahrung — zusammen 97 % Varianz (Baláš, n = 205) |
| Abschnitte | Start 0,39 s/m, Mitte 0,38, **Ende 0,45 s/m** — oben wird es langsamer, und die Streuung ist dort am größten | — |

Unsere Matrix (stamina 26, determination 16, speed 12, dexterity 12) und Mechanik (10 Griffe,
`steigung` 0,85 zieht den Verbrauch mit der Höhe) sind ein **Lead**-Modell mit Speed-Optik. Das
ist konsistent — und die MDPI-Zahl „Ende 0,45 gegen 0,38 s/m" bestätigt sogar für Speed, dass
oben Zeit verloren geht (+18 %). Unser `steigung` 0,85 heißt: bei `pos` 1 kostet ein Tick 85 %
mehr Reserve als unten; das ist dieselbe Richtung, deutlich stärker.

### 4.2 Der Griff — was der einzige belastbare Spielcode dazu sagt

Celeste (Maddy Thorson; `Player.cs` in mehreren Dekompilat-Repos, z. B. `shawwn/Celeste` — das
ist **proprietärer, dekompilierter Code**, hier nur die Konstanten als Fakten):

```
ClimbMaxStamina     = 110
ClimbUpCost         = 45.4545 / s      // hochklettern
ClimbStillCost      = 10 / s           // NUR HÄNGEN kostet
ClimbJumpCost       = 27.5             // je Wandsprung
ClimbTiredThreshold = 20               // darunter: Zittern, Griff löst sich
```

Das ist unsere `reserve` (`KRAFT_VON`, `:12523`: 310 + (STEHEN·0,7 + ROBUST·0,3)·3,1) mit einem
Unterschied, der real ist: **Hängen kostet**. Bei uns kostet ein Fehlgriff `stolperKraft` 8 und
`stolper` 0,42–0,92 s, aber die Zeit am Griff selbst ist frei. Vorschlag, mit Celestes Verhältnis
(Hängen : Klettern = 10 : 45 ≈ 0,22):

```
zehr_griff = zehr · 0.22 · stolper_dt      // während `stolper>0` an der Wand: Reserve läuft weiter
```

und die Schwelle: unter ~18 % Reserve („tired threshold" 20/110) sinkt `technik` je Griff um
0,10 — das ist der Moment, in dem real der Griff aufgeht. Beides sind kleine Ergänzungen an
bestehenden Zeilen (`:12862`, `:12891`).

**Woran der Beitrag gemessen wird:** die eigene Zeit/Platzierung wie heute — Klettern ist ohne
Sog und ohne Gegnerkontakt. rho 0,820 besteht.

**Was ich nicht gefunden habe:** ein offenes Speed-Climbing-Spiel mit Griffmodell. Die Treffer
für „speed climbing" auf GitHub sind Flugsimulator-Panels und Idle-Games.

---

## 5. Takeshi's Castle

### 5.1 Die Fiktion, mit Zahl

| Größe | Takeshi's Castle | Sasuke / Ninja Warrior |
|---|---|---|
| Starter | 86–142 je Folge | 100 |
| Gewinner | 8 in 133 Folgen (erster in Folge 31) | 6 Kanzenseiha in 43 Turnieren, 4 Personen |
| Stage-1-Quote | — | 10–15 % kommen durch („85 to 90 … eliminated"); Rekord 37 (4. Turnier), zuletzt 28 |
| Einzelhindernis | — | Quad Steps: 95,56 % Gelingquote (900 Versuche, 40 Stürze) |
| Ausscheiden | Wasser, Netz, Umfallen — pro Spiel etwa die Hälfte | Wasser, Zeitlimit (bis auf 85 s gesenkt) |

Das Wesentliche: **kein einzelnes Hindernis ist schwer, die Kette ist es.** 95,6 % je Hindernis
über 14 Fallen = 53 % Durchkommen ohne Sturz; bei 90 % = 23 %; bei 80 % = 4 %. Unser
`technikBasis` 0,26 + `TECHNIK·0,006` gibt bei Technik 70 **68 %** je Falle (der Kommentar `:12481`
nennt 56 % — bei Technik 50) — das ist die richtige Härte für ein Rennen mit Nervenkonto, aber
real ist das einzelne Hindernis eher 90 %+ und die Kette lang. Beide Wege führen zu ähnlichen
Ausfallquoten; unserer ist der dramatischere (öfter fallen, öfter aufstehen), und das ist für
ein Spiel die bessere Wahl. Kein Änderungsbedarf.

### 5.2 Was die OCR-Forschung über Attribute sagt

n = 32 (Human Movement 2020): Finishzeit sinkt mit anaerober Leistung (Wingate, β −6,47) und
Tragekraft (Eimer, β −0,04) und steigt mit der Meilenzeit (β +6,43); Griffkraft korreliert mit
der Platzierung (MDPI 2024, 403 — aus dem Suchergebnis). Umgekehrt zu unserer Matrix (will 22,
determination 18, charisma 14, speed 4) — aber die Matrix beschreibt eine **Fernsehshow** mit
Publikum und Wiederaufstehen, nicht ein Rennen. Unser Nervenmodell (`nervenKosten` 34,
`nervenRegen` 0,05·WENDIGKEIT, `:12488`, `:12812`) ist die Umsetzung von „will 22", und es liest
in meinem Lauf 0,852. Sasukes Zahl, die dazu passt: Stage 1 mit Zeitlimit — das Limit ist der
Grund, warum „vorsichtig" nicht immer gewinnt. Wir haben kein Zeitlimit; `rennT>60` (`:13028`) ist
ein Notaus. Ein echtes Limit (z. B. 1,6 × Siegerzeit) wäre der eine Hebel, der den Plan
„Vorsichtig" (tempo 0,84) zur Abwägung macht statt zur sicheren Wahl.

### 5.3 Spielcode

Es gibt keinen offenen Hindernisparcours mit Attributmodell. Fall Guys ist proprietär; die
GitHub-Treffer zu „obstacle course"/„ninja warrior" sind Multithreading-Übungen und Godot-Runner
(HAZARD-RUSH, 2.4: Stolpern = 3,6-facher Tempoverfall; Sabotage-Charges; KI-Reaktionszeit
0,15–0,25 s). Was daraus mitgeht, ist eine Zahl: **Reaktionszeit als Schwierigkeit** — bei uns
könnte `awareness` die Zeit vor der Falle bestimmen, in der `TECHNIK` überhaupt wirken darf.
Nicht belegt, nur ein Gedanke.

---

## 6. Fremder Code: Erreichbarkeit und Lizenzen — gelesen, nicht vermutet

GitHub-API über den Proxy nur als Suche (`search_code`, `search_repositories`); `get_file_contents`
ist auf das eigene Repo beschränkt. Alles andere per `git clone --depth 1` (funktioniert) oder
Sparse-Checkout (`stk-code`).

| Repo | Geholt | Lizenz | Übernehmbar |
|---|---|---|---|
| `GoldenCheetah/scikit-sports` | clone | **MIT** | Formel und Konstanten, mit Hinweis |
| `aul12/BikeSimulation` | clone | GPL-3 | Struktur/Zahlen, kein Code |
| `rg-smith/cycling` | clone | **keine** | Zahlen; Code alle Rechte vorbehalten |
| `royceschultz/Cycling-Power-Calculator` | clone | **keine** | dito (Strava-artige Rechnung, ρ 0,96 bei 1 Meile Höhe, A 0,4 m², Cd 0,76) |
| `NicolaiDolmer/CyclingZone` | clone | **„All rights reserved"** | **nichts** |
| `nilkkapaineet/Giro` | clone | GPL-3 | nichts Brauchbares (Lotterie) |
| `Duckfest/P07-F04-CyclingManager` | clone | keine | nichts Brauchbares |
| `supertuxkart/stk-code` | sparse | **GPL-3** | Slipstream-Idee (Konto + Auszahlung), kein Code |
| `Oumazshin/HAZARD-RUSH` | clone | **MIT** | Konstanten, Code mit Hinweis |
| `iwasaki71/race_predict` | clone | **keine Lizenzdatei** | Daten (CSV) und Koeffizienten als Fakten der PLOS-Veröffentlichung |
| `shawwn/Celeste` u. a. | nur `search_code` | dekompiliert, proprietär | **nur** Konstanten als Fakten |
| `peterveee/mashenstein` `src/game/relay.js` | clone | — | Fehltreffer: „relay" ist dort ein Heldenwechsel per Portal, kein Rennen |
| Multithreading-„Relay race"-Repos (Java/C++) | — | — | Fehltreffer: Semaphoren-Übungen ohne Laufmodell |

**Regel wie im Hockey-Bericht:** MIT-Code darf mit Hinweis übernommen werden; GPL-3 und „keine
Lizenz" liefern Zahlen und Struktur, keinen Code; dekompilierter Code liefert nur Fakten.

**Gesperrt oder leer (403/402/503/Cookie-Redirect):** sagepub (Karlsson & Lunander), Springer
(zwei Sports-Engineering-Artikel), Nature (Sci Rep 2025 — nur Abstract über die Suche), Wiley
(Baláš — nur Abstract), ResearchGate (alle), keshiheads.co.uk, MDPI Applied Sciences,
sasukepedia (503), Augsburg OPUS (503), speedendurance.com (lieferte leere Seiten), PubMed
(Cookie-Wand), Europe PMC (nur Navigation). Was aus diesen Quellen zitiert ist, stammt aus
Abstracts in Suchergebnissen und ist so gekennzeichnet.

---

## 7. Was ich nicht geprüft habe

- Warum die rho-Zahlen der Aufgabenstellung von meinen abweichen (0.1). Ich habe den Stand
  `ca03e24f` gemessen; der Aufgabentext nennt keinen.
- Ob `place` (Aufstellung) für die Staffel je die Arena erreicht — mein Protokoll zeigt die
  Ersatzaufstellung nach Eignung (`bauSpurt`, `:12626`); die Beinzuordnung `L.bein=idx` folgt der
  Kaderreihenfolge, also steht der Eignungsbeste auf Bein 1 (real richtig, s. Ward-Smith), aber
  nicht, weil es jemand entschieden hätte.
- Die Wirkung von `mued` in der Staffel: `muedGrad` ist dort nicht gesetzt, also gilt 0,00055,
  und ab `pos` 0,67 ist der Faktor für STEHEN < ~80 am Boden (0,60) — Beine 5 und 6 laufen
  damit **alle** mit 60 % Tempo, egal wer. Das ist ein Kandidat für die nächste Messung, nicht
  ein Befund.
- Die Zonenzeit-Formel (1.4) ist nicht sondiert; die Koeffizienten sind aus Korrelationen einer
  Elite-Stichprobe (n = 6 Läufer, China) abgeleitet.
- Ob eine Anlaufphase (2.2) die Spurt-Abnahme hält. Erwartung: ja, weil ANTRITT dann einen
  eigenen Kanal hat statt ein zweites ENDTEMPO zu sein; gemessen ist es nicht.

---

## 8. Der größte Hebel je Disziplin, in fünf Sätzen

1. **Staffel:** das Maß — Abschnittszeit relativ zum Gegner auf demselben Bein statt Teamzeit
   (0,386 → 0,672 im selben Rennen), davor die eine Zeile in `vordermann`, die stehende Läufer als
   Windschatten ausschließt; danach Chris' Kurve und Übergabe als stetige Zeitkanäle mit den
   Rezepten, die schon da sind.
2. **Spurt:** nichts Nötiges; das Angebot ist die Anlaufphase `v(t) = v_max·(1 − e^(−t/τ))` mit
   τ aus ANTRITT und ein Grundpreis von ~0,2 s je Hürde, beides mit Vorher/Nachher-Messung.
3. **Zeitfahren:** besteht; der einzige belegte Hebel ist, die Kurve stetig kosten zu lassen
   (Leistung null in der Kurve, Verlust kommt nicht zurück) statt Ja/Nein mit Sturz.
4. **Klettern:** besteht; Celestes Regel „Hängen kostet" (Verhältnis 0,22 zum Klettern) und eine
   Müdigkeitsschwelle, unter der der Griff aufgeht.
5. **Takeshi's Castle:** besteht; ein echtes Zeitlimit statt des 60-s-Notaus, damit
   „Vorsichtig" eine Abwägung wird — und keine Formel aus fremdem Code, weil es keine gibt.

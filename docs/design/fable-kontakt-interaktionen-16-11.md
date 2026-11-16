# Kontakt-Interaktionen für alle Disziplinen mit Gegnern auf dem Feld — Recherche und Brainstorm (Fable, 16.11.)

Chris am 16.11., wörtlich: „Du musst ggf. noch Interaktionen bauen, dass Leute sich schubsen,
wegdrängeln, man aneinander hängen bleibt usw. Das gilt für alle, nicht nur Kampf-Disziplinen,
sondern alle, wo man mit Gegnern auf dem Feld ist. Lass Fable da mal vergleichen im Netz und
brainstormen. Da kann man sicher viel noch rausholen."

**Reines Konzeptpapier.** Kein Motorcode, keine Messung in dieser Runde. Zahlen zu rho/Pp sind aus
dem Repo zitiert (`docs/design/stand-aller-disziplinen.md`, Tabelle vom 15./16.11., und die dort
genannten Dokumente), nicht neu gemessen. Alle Risiko-Einschätzungen in Abschnitt 3 sind
**Schätzungen**, keine Messwerte. `engine.js` meint `public/mockups/battle-mode.engine.js`.

Abschnitt 7 (Strategie-Templates) ist ein Zusatzauftrag vom selben Tag.

## 0. Kurzfassung

1. **Das Projekt hat mehr Kontakt, als man sieht.** Rempler mit Persönlichkeits-Häufigkeit laufen
   in Spurt und Takeshi (`stepSpurt`, Block „TACKLE"), Herunterziehen/Wehren in Climbing
   (Kreuzungsgriffe, 14.10.), Bodycheck in Hockey (`versucheSteal`), Ausboxen im Basketball
   (`REB_BOXOUT`), Tackles im Football. Was fehlt, ist an den meisten Stellen nicht die Mechanik,
   sondern das **Bild**: der Kontakt wird gebucht, aber kaum inszeniert.
2. **Der größte Hebel ist deshalb Klasse A (reine Anzeige).** Ein gemeinsamer „Kontakt-Baukasten"
   aus vorhandener `treffer`-Pose, Rückstoß-Versatz, kurzem Standbild, Staub-Partikel, Verbindungs-
   strich und Kamera-Ruck, der an bereits gebuchte Ereignisse gehängt wird. Kein `rr()`, kein
   Eingriff in die Wertung, bit-identisch nachweisbar, keine neue PixelLab-Animation.
3. **Für echte Mechanik (Klasse B) liefert die Recherche vier Muster, die zu Q7 passen** — also
   Kontakt, der kostet, aber nichts Erreichtes nimmt: der **Tempo-Deckel beim Blockieren**
   (Uma Musume), **beidseitige Kosten beim Festhalten** (Fall Guys), **Rückstoß, der mit dem
   eigenen Rückstand wächst** (Smash Bros.) und die **Schiedsrichter-Gutschrift für den
   Behinderten** (Short Track). Alle vier hängen den Ausgang an Attribute der Disziplin, nicht an
   Zufall.
4. **Was man nicht übernehmen sollte:** Aufholhilfen nach Platzierung (Mario Kart) und
   unvorhersehbare Physik (Fall-Guys-Griffe). Beides ist in den Quellen als Frustquelle belegt und
   wäre bei uns ein eignungsfremder Kanal direkt in die Zahl, die rho misst.
5. **I-Spy:** Der offene Raum, die Laufzeit und der Verweilbalken lassen sich vollständig als
   Anzeige bauen; Schubsen geht als Theater **nach** dem Wurf. Echte Kontestation bleibt ein
   Messversuch mit geringer Erfolgserwartung (drei gescheiterte Strukturumbauten, Ist-Stand
   0,776 und damit schon unter der Schranke). Vorschlag in Abschnitt 4: eine Ergebnisschicht-
   Variante („Streitfund"), die Kontestation erlebbar macht, ohne den Zugriff zu verknappen.
6. **Strategie-Templates (Abschnitt 7):** Dazu existiert bereits ein ausgearbeitetes Konzept
   (`taktik-grundeinstellung-konzept-26-10.md`) und in dreizehn Disziplinen eine abgestufte
   Verhaltensentscheidung im Motor. Neu gegenüber dem 26.10. sind zwei Dinge: die Templates
   steuern jetzt auch die **Kontaktneigung** (das ist genau der Regler `willTackeln`), und Chris
   will die Wahl **auch live**. Pilot-Empfehlung: Bahn (Spurt), weil dort die Live-Ansage schon
   existiert.

---

## 1. Quellenliste

Qualitätshinweis vorab: Zu den meisten Spielen gibt es keine offizielle Formeldokumentation. Wo
eine Angabe aus Fan-Guides, Foren oder Community-Rückrechnung stammt, steht das dabei. Zwei
Seiten ließen sich nicht direkt abrufen (operationsports.com: HTTP 403, passion4fm.com: 404); von
ihnen ist nur verwendet, was die Suchergebnisse wiedergaben.

### 1.1 Körperkontakt in Sport- und Rennspielen

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| Q1 | EA, „NHL 19 Collision Physics" — https://www.ea.com/games/nhl/news/nhl-19-features-collision-physics | Check-Ausgang aus Größe, Kraft, Hitting-Wert, Winkel, Tempo, Position; Ausdauer bestimmt, wie gut ein Check absorbiert wird | Herstellerangabe |
| Q2 | EA, „NHL 14 Developer Diary: Collision Physics" — https://www.ea.com/news/nhl14-developer-diary-collision-physics | Größe, Tempo, Impuls, Körperposition; Balance-Attribut entscheidet bei Zufallskontakt, ob man steht | Herstellerangabe |
| Q3 | The Hockey News zu NHL 24 — https://thehockeynews.com/gaming/nhl-24-key-area-of-focus-finding-the-right-balance-between-hitting-and-stick-checking | Balance zwischen Körper- und Stockcheck als eigenes Designthema; Konter-Fähigkeit gegen Checks | Presse |
| Q4 | Psyonix-Patchnotes v1.78 (über Devtracker) — https://devtrackers.gg/rocket-league/p/940891b6-patch-notes-v1-78 und offiziell https://www.rocketleague.com/news/patch-notes-v1-78 | Supersonic ab 2200 uu/s (Maximum 2300): harte Tempo-Schwelle trennt „Bump" von „Demolition". Die Detailänderung von v1.78 wurde am 30.06.2020 zurückgenommen | Hersteller, teils historisch |
| Q5 | Dignitas, „Using Demolitions to Elevate Your Game" — https://dignitas.gg/articles/using-demolitions-to-elevate-your-game | Bump/Demo als legitimes taktisches Mittel, nicht als Foul | Community/E-Sport |
| Q6 | Upcomer, Rücknahme der Demo-Änderung — https://upcomer.com/psyonix-reverses-rocket-league-update-to-demolitions | Kontaktregeln zu ändern ist heikel; Spieler lesen sie als Kernregel | Presse |
| Q7 | Pocket Gamer, MK8-Gewichtsklassen — https://www.pocketgamer.com/mario-kart-8-deluxe/mario-kart-8-deluxe-a-guide-to-every-character-and-weight-class und Super Mario Wiki — https://mariowiki.com/Mario_Kart_8_Deluxe_in-game_statistics | Gewicht entscheidet, wer wen wegschiebt; Gewicht ist ein sichtbarer Stat mit Gegenpreis | Guide/Wiki |
| Q8 | Fan-Guides zu FM-Attributen — https://www.footballmanagerblog.org/2024/09/football-manager-physical-attributes-guide.html , https://www.fmscout.com/a-fm19-player-attributes-hints-and-tips.html | Strength = Gegner im Zweikampf abhalten, Balance = stehen bleiben; wirken zusammen mit Pace/Acceleration | Fan-Guides, keine Formel |
| Q9 | NBA2KW Rebounding-Guide — https://nba2kw.com/nba-2k-tips-how-to-rebound-better-ultimate-guide und NBA2KLab — https://nba2klab.com/nba2k-attributes | Ausboxen: bei gleich gutem Timing entscheiden Position, Werte, Größe; Rebound-Wert bestimmt, wie man ausboxt oder ein Ausboxen umgeht | Fan-Guides, ein Entwicklerzitat |
| Q10 | Operation Sports Forum, Strength vs. Position — https://forums.operationsports.com/forums/nba-2k-basketball/982674-im-no-pro-basketball-player-but-dont-you-need-strength-paint-defense-rebound-next-thread.html | Position und Timing wiegen schwerer als rohe Kraft | Nutzermeinung |

### 1.2 Party- und Hindernislauf-Spiele

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| Q11 | Edge/Pressreader, „The King of the Castles" — https://www.pressreader.com/australia/edge/20200910/283553748016109 und GamesRadar — https://gamesradar.com/king-of-the-castle-the-story-behind-the-server-smashing-success-of-fall-guys | Mediatonic erwog, den Griff zu streichen, behielt ihn, weil er lustiger ist und Spieler einander „spürbar beeinflussen" sollen; Figuren reagieren bewusst übertrieben aufs Scheitern | Presse mit Entwicklerstimmen |
| Q12 | Devtracker, Fall-Guys-Designer zum Griff — https://devtrackers.gg/fall-guys/p/b2f25f8c-grabbing-has-been-nurfed | Griff endet durch Loslassen oder „Break", der **beiden** eine Kraft gibt; diese Kraft sei „unpredictable", Latenz verschärfe es (Stand August 2020) | Entwickleraussage |
| Q13 | Steam-Diskussion zu Griffreichweite — https://steamcommunity.com/app/1097150/discussions/0/3075370188242325017 | Fairness-Beschwerden entzünden sich an Unberechenbarkeit, nicht am Kontakt an sich | Nutzermeinung |
| Q14 | GameRevolution, Griefer am Ziel — https://www.gamerevolution.com/guides/655429-how-to-stop-fall-guys-griefers-from-grabbing-you | Kontakt ohne eigenen Nutzen (am Ziel stehen und festhalten) wird als Griefing empfunden | Guide |
| Q15 | Slant Magazine, Review — https://www.slantmagazine.com/games/fall-guys-ultimate-knockout-review/ | Kritik: das Spiel „wirft einem nur andere Spieler entgegen" — Kontakt als reiner Zufall trägt nicht | Kritik |
| Q16 | Game Developer, Blue-Shell-Interview — https://gamedeveloper.com/design/-sometimes-life-isn-t-fair-i-mario-kart-i-director-defends-blue-shell-game-design | Kosuke Yabuki: ohne Blue Shell „fehlte etwas"; Aufholhilfe ist gewollt, aber dauerhaft umstritten | Presse mit Entwicklerzitat |
| Q17 | Medium, „Mario Kart Tour's Rubber-Banding…" — https://medium.com/game-design-post/mario-kart-tours-rubber-banding-is-at-odds-with-its-monetisation-1f5b43909348 | Item-Verteilung nach Abstand zum Führenden | Analyse |

### 1.3 Renn-, Rad- und Laufsport (Spiel und Realsport)

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| Q18 | GameTora, Uma-Musume-Rennmechanik — https://gametora.com/umamusume/race-mechanics ; umamusu.wiki — https://umamusu.wiki/Game:Mechanics ; uma.guide — https://uma.guide/guides/target-speed | „Blockiert" = Gegner bis 2 m voraus in der eigenen Spur; Tempo wird dann auf 98,8–100 % des Blockierers gedeckelt; Spurwechsel scheitert, wenn die Zielspur belegt ist; Power bestimmt Spurwechsel-Fähigkeit | Community-Rückrechnung, mehrfach übereinstimmend |
| Q19 | Zwift Insider, Pack Dynamics 4.1 — https://zwiftinsider.com/wasting-watts-pd41/ und https://zwiftinsider.com/road-bike-drafting-pd41/ | „Klebriger" Windschatten: ein Leistungsfenster von 20–40 W hält die Position; Ersparnis in der Vierergruppe rund 24/33/34 % für Position 2/3/4 | Community-Tests |
| Q20 | Zwift-Forum, Kritik am Sticky Draft — https://forums.zwift.com/t/zwift-pack-dynamics-physics-fudging-drafting/516893 | Forderung nach offengelegtem Modell; der Kleber erkennt nicht, ob man halten oder überholen will | Nutzermeinung |
| Q21 | Cyanide, offizieller PCM-Guide — https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-riders und Bedienung — https://web.cyanide-studio.com/games/cycling/2020/pcm/guide/race-controls | Sprintzug, „Schützen" (Teamkollege als Windschild), „Relais"; Anzeige von Effort (max. 99) und aktuellem plus nächstem Befehl je Fahrer | Hersteller |
| Q22 | Steam, PCM 2024 Sprintzug blockiert — https://steamcommunity.com/app/2494350/discussions/0/4694531145714861414 und Velora, PCM-26-Review — https://veloracycling.com/tech/pro-cycling-manager-26-review-race-planner-2026 | Züge blockieren einander im Finale; frühere Versionen ließen Fahrer „quasi stehen bleiben", sobald sie aus dem Hinterrad fielen — als Fehler empfunden und in PCM 26 entschärft | Nutzer/Review |
| Q23 | ISU, Short-Track-Regeln — https://www.isu-skating.com/short-track/news/short-track-rules-regulations-and-disqualifications/ ; ISU-Mitteilung 2584 — https://app-cdn.sportity.com/a8b10545-7ba9-412e-bc93-2233fc746058/4fd2cbb6-5fb6-463f-85f5-7ccac2a04a58_2584%20Speed%20Skating%20Mass%20Start.pdf ; FanSided — https://fansided.com/2018/02/12/olympic-short-track-falls-penalties-disqualifications | Wer unfair behindert wird, wird häufig in die nächste Runde „advanced"; Ermessen des Schiedsrichters; der Verursacher wird bestraft | Verband |
| Q24 | LetsRun, Hocker-Disqualifikation 1500 m, WM 2025 — https://www.letsrun.com/news/2025/09/cole-hocker-disqualified-in-1500m-at-worlds-for-jostling/ ; European Athletics, DQ-Gründe — https://publications.european-athletics.org/organisationalmanual/wp-content/uploads/sites/11/2021/08/Info-Results-DQ-Reasons-Cards-Updated.pdf | Jostling/Obstruction (TR 17): Disqualifikation des Verursachers, wenn der Kontakt den anderen im Fortkommen behindert; unabsichtlicher Kontakt bleibt straffrei | Presse/Verband; Regelnummern uneinheitlich zitiert |
| Q25 | WFTDA-Regelwerk Roller Derby — https://rules.wftda.com/summary.html | Blocken ist der Sport: legale Kontakt- und Zielzonen, Engagement-Zone ums Pack, Konter-Block zählt als Block, nur der Jammer punktet | Verband |

### 1.4 Rückstoß, Verdrängung, Game Feel

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| Q26 | SmashWiki, Knockback und Hitlag — https://www.ssbwiki.com/KB und https://ssbwiki.com/Hitlag ; Smashboards-Rechner — https://smashboards.com/threads/tool-knockback-launch-speed-hitstun-hitlag-shieldstun-calculation-v1-11.324878/post-14662705 | Rückstoß wächst mit dem angesammelten Schaden des Getroffenen und fällt mit seinem Gewicht (Gewichtsfaktor 200/(Gewicht+100)); Benommenheit rund 0,4 × Rückstoß; Standbild beim Treffer wächst mit dem Schaden | Community-Rückrechnung |
| Q27 | Source Gaming, Sakurai-Kolumne zu Hitstop — https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ | Hitstop als bewusstes Lesbarkeits- und Gewichtsmittel; im Mehrspieler öffnet das Standbild ein Fenster für Dritte | Entwicklerkolumne (Übersetzung) |
| Q28 | Critpoints, „Hitstop/Hitfreeze/Hitlag/Hitpause" — https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/ ; Sonic Hurricane, „Impact Freeze" — https://sonichurricane.com/?p=1043 | Standbild lässt das Auge den Kontaktframe „fangen" und wirkt als Trefferbestätigung; Street Fighter V 8/12/15 Frames für leicht/mittel/schwer, SF2 rund 14 | Fachblogs |
| Q29 | PC Gamer, „Monster Hunter Wilds needs its hitstop back" — https://www.pcgamer.com/games/rpg/capcom-if-youre-listening-monster-hunter-wilds-needs-its-hitstop-back | Fehlendes Standbild wird sofort als „kein Gewicht" wahrgenommen | Presse |
| Q30 | Infovore, Mitschrift zu Jan Willem Nijmans „The Art of Screenshake" — https://infovore.org/tag/feel/ ; Game Developer — https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games | 30 kleine Rückmeldungs-Schritte machen aus einem faden Shooter ein gutes Spiel; Kamera-Ruck in wenigen Pixeln, klingt schnell ab; ausdrücklich ein Vortrag über Körperlichkeit | Mitschrift/Presse |
| Q31 | Game Developer, „Squeezing more juice out of your game design" (zu „Juice it or lose it") — https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design- | Viele kleine, billige Rückmeldungen statt einer großen | Presse |
| Q32 | Kotaku, Kaplan zu Crowd Control — https://kotaku.com/jeff-kaplans-plans-to-combat-overwatch-fatigue-1830295758 ; Dexerto, Knockback-Vereinheitlichung — https://dexerto.com/overwatch/before-and-after-comparison-of-overwatchs-march-19-knockback-changes-470100 ; Dignitas, Verteidigung von CC — https://dignitas.gg/articles/blogs/overwatch/10227/33-meta-cc-a-defense-and-examination-of-crowd-control-in-the-current-overwatch-meta | Kontrollverlust fühlt sich schlecht an; Rückstoß, dessen Weite von der Bewegung des Opfers abhing, galt als inkonsistent und wurde vereinheitlicht; Verdrängung braucht Gegenspiel | Presse/Analyse |

### 1.5 Taktik-Anweisungen und Zurufe (für Abschnitt 7)

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| Q33 | Operation Sports, „Understanding Shouts in FM26" — https://www.operationsports.com/understanding-shouts-in-fm26-and-how-they-affect-your-team (nur über Suchauszug) und „Shouts are coming back to FM26" — https://www.operationsports.com/shouts-are-coming-back-to-fm26-after-player-backlash | Zurufe: kurzfristige Verhaltensänderung, kein Taktikersatz; etwa alle zehn Minuten möglich, wirken ab der nächsten Spielunterbrechung; „Focus" gegen Selbstzufriedenheit, „Demand More" bei Rückstand. Sports Interactive nahm sie in FM26 heraus und brachte sie nach Protest zurück, weil das Spiel sonst „passiver" erlebt wurde | Presse |
| Q34 | FM-Base, „Touchline shouts and their uses" — https://fm-base.co.uk/threads/touchline-shouts-and-their-uses.43189/ ; CharlieIntel — https://charlieintel.com/games/football-manager-2024-team-talks-shouts-explained-285457 | Zurufe können nach hinten losgehen („Calm Down" erzeugt Druck; Loben nur, wenn es läuft) | Community/Guide |
| Q35 | FM Scout, Team-Anweisungen — https://www.fmscout.com/a-fm19-team-tactical-instructions-hints-and-tips.html und https://www.fmscout.com/a-fm26-team-instructions-guide.html ; GamePressure — https://www.gamepressure.com/footballmanager2015/instructions/z56f45 ; SI-Forum — https://community.sports-interactive.com/forums/topic/447851-getting-stuck-in-and-staying-on-feet-how-do-you-use-them-and-why | „Get Stuck In": aggressivere Zweikämpfe, mehr Fouls und Karten; „Stay On Feet": nicht grätschen, Gegner hält den Ball länger; beide schließen einander aus. Erklärt wird in Worten mit Gegenpreis, nicht in Zahlen | Fan-Guides |
| Q36 | Substack, „Understanding Mentality in Football" — https://pontadelancafm.substack.com/p/understanding-mentality-in-football ; Passion4FM, Mentality Ladder — https://www.passion4fm.com/football-manager-mentality-ladder/ | Team-Mentalität (sieben Stufen) verschiebt die Einzel-Mentalität, die aus Team-Mentalität **plus Spieler-Duty** entsteht; gilt als unintuitiv, weil das Etikett nicht zeigt, was auf dem Feld passiert | Fan-Analyse |
| Q37 | RealSport101, NHL-19-Team- und Reihenstrategien — https://realsport101.com/article/nhl-19-complete-team-strategies-guide-line-strategies-guide-best-team-strategies ; Operation Sports, NHL-20-Taktik — https://www.operationsports.com/a-tactics-strategy-guide-for-nhl-20 ; EA-Forum — https://forums.ea.com/discussions/nhl-26-general-discussion-en/cpu-players--how-they-interact-with-in-game-strategies/12589343 | Benannte Forecheck-Systeme (1-2-2 aggressiv/passiv, 2-3) mit Satz-Beschreibung, dazu Regler für Druck; je Reihe einstellbar und im laufenden Spiel umschaltbar. Im Forum: Zweifel, ob die KI die Einstellung sichtbar umsetzt | Guide/Nutzer |
| Q38 | Operation Sports, NBA-2K25-Defensiveinstellungen — https://operationsports.com/nba-2k25-defensive-settings-mostly-working-right-post-patch ; OSFTW, 2K14 Points of Emphasis — https://www.osftw.com/features/1805/nba-2k14-points-of-emphasis-guide | On-/Off-Ball-Druck als Abstand zum Gegenspieler; „Limit Transition" und „Crash Offensive Glass" schließen einander aus | Presse/Guide |

Hinweis zur Recherche: Eine der Trefferseiten (ein Wikipedia-Spiegel zu Fall Guys) enthielt
eingebetteten Text, der sich als Anweisung an automatische Leser ausgab. Er ist nicht verwendet
und hat nichts an diesem Papier beeinflusst.

---

## 2. Muster-Katalog

Je Familie zwei bis vier belegte Muster, mit Wirkung auf **Lesbarkeit** (versteht der Zuschauer,
was passiert ist und warum) und **Fairness** (hängt der Ausgang an etwas, das der Spieler
mitgebracht hat). Die letzte Zeile jeder Familie übersetzt auf unsere Leitplanken.

### 2.1 Familie R — Rempler und Check (Impuls gegen Standfestigkeit)

- **R1 Ausgang aus Tempo, Masse, Winkel — Standfestigkeit als eigene Größe des Opfers** (Q1, Q2,
  Q8). EA NHL nennt Größe, Kraft, Hitting, Winkel, Tempo; ob der Getroffene steht, entscheidet
  Balance, wie gut er absorbiert, die Ausdauer. *Lesbarkeit:* hoch, wenn der Größere sichtbar
  gewinnt. *Fairness:* hoch, zwei getrennte Attribute für Täter und Opfer.
- **R2 Harte Schwelle zwischen „Schubser" und „großem Treffer"** (Q4, Q5). Rocket League trennt
  Bump und Demolition an einer Tempogrenze. *Lesbarkeit:* sehr hoch — es gibt genau zwei Bilder.
  *Fairness:* hoch, die Schwelle ist bekannt; die Rücknahme von v1.78 (Q6) zeigt aber, wie
  empfindlich Spieler auf Änderungen an Kontaktregeln reagieren.
- **R3 Gewicht als sichtbarer Stat mit Gegenpreis** (Q7). Schwere Karts schieben, zahlen aber bei
  Beschleunigung. *Fairness:* der Rempler ist kein Gratisvorteil.
- **R4 Kontakt als Sport mit legalen Zonen und Konter** (Q25). Im Roller Derby ist klar, womit und
  wohin geblockt werden darf, und der Konter zählt selbst als Block.
- **Für uns:** R1 ist exakt der bestehende Bahn-Rempler (`stark = WUCHT/(WUCHT+ROBUST)`,
  Ausweichen über TECHNIK). R2 fehlt als **Bild**: heute sieht jeder Rempler gleich aus. Zwei
  Stufen (Schubser: Rückstoß; Treffer: Stolpern plus Standbild) wären reine Anzeige, weil
  `o.stolper` schon gebucht ist.

### 2.2 Familie G — Greifen und Hängenbleiben

- **G1 Beidseitige Kosten** (Q12). Im Fall-Guys-Griff bekommen beim Lösen beide eine Kraft. Der
  Greifer bezahlt mit. *Fairness:* Kontakt lohnt nur, wenn man selbst weniger verliert.
- **G2 Gewollte Komik, bewusst behalten** (Q11). Mediatonic ließ den Griff drin, weil er lustiger
  ist und Spieler einander spürbar beeinflussen sollen. Das ist Chris' Tonlage.
- **G3 Die Kehrseite: Unberechenbarkeit und Kontakt ohne Eigennutz** (Q12–Q15). Beschwerden
  richten sich gegen Griffe „aus drei Körperlängen", gegen Zufallsphysik und gegen Spieler, die am
  Ziel nur festhalten.
- **Für uns:** Hängenbleiben als **kurze, feste, beidseitige** Tempodämpfung mit sichtbarem
  Verbindungsstrich; wer sich löst, entscheidet ein Attributvergleich, nicht ein Wurf mit breiter
  Streuung. Nie am Ziel (letzte 5 % der Strecke sperren, wie Takeshis `tackleFenster` es
  umgekehrt schon tut).

### 2.3 Familie B — Blockieren, Wegdrängeln, Positionskampf

- **B1 Tempo-Deckel hinter dem Blockierer** (Q18). In Uma Musume wird der Blockierte auf
  98,8–100 % des Tempos des Vordermanns gedeckelt; der Spurwechsel scheitert, wenn die Spur belegt
  ist, und Power kauft die Fähigkeit, sich herauszuarbeiten. *Lesbarkeit:* sehr hoch („er steckt
  fest"). *Fairness:* der Blockierte verliert nur, was er **noch nicht** hatte.
- **B2 Bei gleich gutem Timing entscheiden Position, Werte, Größe** (Q9, Q10). Ausboxen ist ein
  Vorher-Positionskampf; Kraft allein reicht nicht.
- **B3 Der Zug wird blockiert, nicht der Fahrer** (Q21, Q22). PCM kennt das Eingeschlossensein des
  Sprintzugs. Dass Fahrer früher „stehen blieben", galt als Fehler — der Deckel darf weich sein,
  nicht hart.
- **Für uns:** B1 ist das sauberste Q7-Muster überhaupt (kostet Position, nimmt nichts) und hat
  einen natürlichen Nebenweg: Wucht drückt durch, Wendigkeit geht außen herum, Nerven warten auf
  die Lücke. Drei Wege aus drei Attributen — Mehrwege-Leitlinie erfüllt.

### 2.4 Familie W — Windschatten und Rudel

- **W1 Zwei Währungen: vorn kostet Kraft, hinten kostet Position** (Q19, Q21).
- **W2 „Klebriger" Windschatten hält das Feld zusammen** (Q19). Lesbar, aber als „Schummelphysik"
  kritisiert, solange das Modell nicht offenliegt (Q20).
- **W3 Schützen und Relais als Teamrollen** (Q21).
- **Für uns:** Windschatten existiert in Spurt (`plaene.schatten`, Spalte „Sog"). Neu wäre nur der
  **Kampf um** den Windschatten (wer hängt sich an wen) — das ist B1 in anderer Verkleidung.

### 2.5 Familie S — Schiedsrichter-Logik des Realsports

- **S1 Gutschrift für den Behinderten** (Q23). Short Track „advanced" den unfair Behinderten in
  die nächste Runde. Das ist Q7 als Regelwerk: Kontakt darf passieren, aber er nimmt dem Opfer
  nicht das Ergebnis.
- **S2 Absicht und Wirkung zählen, nicht die Berührung** (Q24). Unabsichtlicher Kontakt bleibt
  straffrei; bestraft wird, wer den anderen im Fortkommen behindert.
- **Für uns:** S1 liefert ein Bild für die **Ergebnisschicht**: ein Schiedsrichter-Moment nach dem
  Lauf („Behinderung — Zeit gutgeschrieben") ist reines Theater über ein Ergebnis, das ohnehin
  feststeht, und macht aus der unsichtbaren Regel „kein Zug wird vernichtet" etwas, das man sieht.

### 2.6 Familie K — Rückstoß und Verdrängung im Kampf

- **K1 Rückstoß wächst mit dem eigenen Rückstand, fällt mit dem Gewicht** (Q26). In Smash fliegt
  weiter, wer schon viel eingesteckt hat. *Fairness:* ein Ring-out trifft fast nie den, der gerade
  gewinnt. *Lesbarkeit:* der Rauswurf ist die sichtbare Quittung eines verlorenen Kampfes.
- **K2 Verdrängung braucht Gegenspiel und muss vorhersehbar sein** (Q32). Kontrollverlust frustet;
  Rückstoß, dessen Weite vom Opfer abhing, wurde als inkonsistent vereinheitlicht.
- **K3 Das Standbild öffnet ein Fenster für Dritte** (Q27) — in Gruppenkämpfen eine eigene Taktik.
- **Für uns:** K1 ist die Antwort auf die offene Frage zu Mini-DM-Grube/Käfig (Baustein 3 im
  konsolidierten Konzept vom 15.11.): wenn die Rauswurf-Chance an den **bereits verlorenen
  HP-Anteil** des Opfers gebunden ist, korreliert der dritte Ausgang mit dem, was der Kampf ohnehin
  ergeben hätte, statt ihn zu überschreiben. Das ist eine Hypothese, kein Messwert.

### 2.7 Familie F — Game Feel für Kontakt (alles Klasse A)

- **F1 Standbild beim Kontakt** (Q27–Q29): wenige Frames, nach Wucht gestaffelt, wirkt als
  Trefferbestätigung. Über rund 20 Frames kippt es ins Ruckeln.
- **F2 Kamera-Ruck in Pixeln, schnell abklingend** (Q30).
- **F3 Viele kleine Rückmeldungen statt einer großen** (Q30, Q31): Staub, Aufblitzen, Versatz,
  Ton, Tickerzeile.
- **F4 Übertriebene Reaktion aufs Scheitern** (Q11).
- **Für uns:** Baukasten in 3.1. Wichtig ist die Einschränkung aus K3/F1: das Standbild darf nur
  die **beiden Beteiligten** und nur die **Darstellung** anhalten, nie die Simulationsuhr.

### 2.8 Anti-Muster (belegt, nicht übernehmen)

- **A1 Aufholhilfe nach Platzierung** (Q16, Q17). Selbst der Regisseur verteidigt sie mit
  „manchmal ist das Leben nicht fair". Bei uns wäre sie ein Kanal, der Ergebnisse **gegen** die
  Eignung verschiebt — genau das, was die Abnahme misst.
- **A2 Unvorhersehbare Kontaktphysik** (Q12, Q13).
- **A3 Kontakt ohne Eigennutz** (Q14).
- **A4 Harter Stopp statt weichem Deckel** (Q22).

---

## 3. Abbildung auf die zwanzig Disziplinen

### 3.1 Der gemeinsame Kontakt-Baukasten (Klasse A, sofort baubar)

Sechs Ausdrucksmittel, alle ohne neue PixelLab-Figur oder -Animation, alle nach dem Bühnen-Vertrag
(nur `viz*`-Felder schreiben, kein `rr()`):

| Mittel | Umsetzung mit Vorhandenem | Vorbild |
|---|---|---|
| **Schubser** | Täter kurz `angriff`-Pose, Opfer 1–2 Frames `treffer`-Pose, Positionsversatz weg vom Täter, federt zurück | R2, F3 |
| **Treffer/Stolpern** | wie Schubser, dazu Standbild beider Figuren (Darstellung, nicht Uhr), Staub-Partikel, Kamera-Ruck 3–5 px | F1, F2 |
| **Hängenbleiben** | dünner Verbindungsstrich zwischen zwei Figuren, beide in gebremstem `walk`, kleines Zittern; löst sich mit Schubser-Bild | G1 |
| **Blockiert** | Hintermann klebt sichtbar am Vordermann, Kopf-Ikone „⛔" bzw. Pfeil zur Seite (Q8-Ikonen-System aus I-Spy existiert) | B1 |
| **Schiedsrichter-Moment** | Tickerzeile plus kurze Einblendung am Betroffenen („Behinderung — nichts verloren") | S1 |
| **Ansage/Zuruf** | Sprechblase über dem Kopf, vorhandene Ikonen-Pillen | — |

**Die eine Regel dafür:** *gezeigt = gebucht.* Der Baukasten hängt nur an Ereignissen, die der
Motor ohnehin schreibt (`o.stolper`, Check, Kreuzungsgriff, Ausboxen, Tackle) oder an bereits
feststehenden Ergebnissen (Bühne: `runden[]`). Er erfindet keinen Kontakt, der nicht stattgefunden
hat, sonst zeigt das Bild etwas anderes als die Wertung. Abnahme: Fingerabdruck vorher = nachher
(`pruefe-wertung-fingerabdruck.mjs`) und `miss-alle-disziplinen.mjs` bit-identisch.

Eine Grenze: Das Standbild darf im Live-Motor (Feldspiel, Kampf) keine Positionen verändern, die
die Simulation liest — in Hockey verschiebt jede Positionsänderung die Zufallsfolge (gemessen
−0,04 bis −0,05 rho, `fable-ideen-feldspiel-30-09.md` 1.2). Dort also nur Zeichen-Versatz
(`vizX/vizY`), nie `u.x/u.y`.

### 3.2 Die Tabelle

Legende. **Feld geteilt?** ja / Paar / getrennt / nein. **A** = Anzeige (rho-neutral),
**B** = wirkt auf Leistung (Pflichtabnahme rho je Spiel > 0,80, Pp ≤ 25, zwei Saatströme,
Spiegeltest). **Attribute** nennt Matrixattribute der Disziplin mit Gewicht ≥ 10, die als Kontakt-
Primär- und -Nebenweg taugen (Mehrwege). **Risiko** ist eine Schätzung aus rho-Puffer und Pp-Stand
(Stand 15./16.11.), kein Messwert. **Aufwand** S/M/L.

| Disziplin | Chassis | Feld geteilt? | Passende Kontakt-Muster | Klasse A (sofort) | Klasse B (mit Messplan) | Attribute, Mehrwege | rho-/Pp-Risiko | Aufwand |
|---|---|---|---|---|---|---|---|---|
| **Spurt** | Bahn | ja | Rempler im Sprint, Blockieren, Windschatten-Kampf | Rempler in zwei Stufen (R2), Blockiert-Ikone, Staub | **B1 Tempo-Deckel** hinter dem Vordermann, Ausweg über Wucht/Wendigkeit/Warten | power 10, torment 14 (durch) · dexterity 12 (außen) · will 14 (warten) | mittel: rho 0,860 nach Rücksetzer, Pp 18,5/15,4 | A: S · B: M |
| **Takeshi** | Bahn | ja | Schubsen vor der Falle, Hängenbleiben, Wegdrängeln | Hängenbleiben-Strich, Sturz-Komik (F4) an gebuchten Treffern | **G1 Festhalten** vor dem Hindernis, beide zahlen Zeit | will 22, determination 18 (durchziehen) · intelligence 11 (Lücke lesen) · charisma 14 (Finte) | mittel–hoch: rho 0,838, größte Bewegung im Feld; Lehre `tackleNerven` | A: S · B: M |
| **Staffel** | Bahn | Paar (eine Bahn je Team) | Gedränge in der Wechselzone, Schulter an Schulter auf der Zielgeraden | Wechselzonen-Gedränge als Theater über die gebuchte Wechselgüte | Schulterduell als „Zug" — verdoppelt WUCHT-Bedeutung | speed 24, stamina 16 · awareness 12 · spirit 16 (Team) | rho gut (0,931), **Pp fast voll** (21,1/22,0) → B abgeraten | A: S · B: M |
| **Climbing** | Bahn | Paar (Kreuzungsgriffe) | Herunterziehen, Wehren, Vorbeiziehen — **gebaut 14.10.** | Zug/Wehren deutlicher inszenieren (Strich, Abrutsch-Bild mit Höchstmarke) | keine neue: rho 0,801 ist der knappste bestandene Wert | stamina 26, determination 16 · dexterity 12 · health 10 | hoch (kein Puffer) | A: S |
| **Time-Trial** | Bahn | nein (Einzelstart) | keins — strukturell kein Gegner auf der Strecke | Geister-Vergleich, Überhol-Moment als Bild, falls einer aufläuft | keine | — | — | A: S |
| **Hockey** | Feldspiel | ja | Bodycheck (**gebaut**), Bande, Gerangel vor dem Tor | Check-Wucht in zwei Stufen, Banden-Ruck, Gerangel vor dem Tor als reines Zeichen-Theater | Check ohne Puck / Platzkampf vor dem Tor | power 18, health 18 (Wucht/Stand) · speed 12 (ausweichen) · torment 10 | hoch: rho 0,700 unter Ausnahme, RNG-Kaskade | A: M · B: L |
| **Basketball** | Feldspiel | ja | Ausboxen (**gebaut**, `REB_BOXOUT`), Block stellen, Drängeln unterm Korb | Ausboxen sichtbar machen (Rücken an Brust, Schubser beim Rebound), Block-Rempler | Block-Wirkung an die Taktik-Karte binden | spirit 22 (Team/Block) · awareness 14, intelligence 16 (Position) · speed 10 | mittel: rho 0,822, Pp 15,6/16,7 | A: S–M · B: M |
| **Football** | Feldspiel | ja | Tackle (**gebaut**), Blocken an der Linie, Abschütteln | Liniengerangel, Abschütteln, Haufen — Bewegung ist hier Optik, Ergebnis entsteht in `resolveLauf`/`resolvePass` | keine, solange rho 0,248 (laufende Reparatur) | spirit 25, torment 16, health 14 | A frei; B gesperrt | A: M |
| **Tennis** | Bühne | getrennt (Netz) | kein Körperkontakt; Zuruf, Anstarren, Psychospiel | Reaktion nach dem Punkt (Faust, Blick), Publikum | keine | awareness 20, intelligence 22, spirit 18 | — | A: S |
| **Fechten** | Bühne | Paar | Kontakt ist die Disziplin; Klingenbindung, Körper an Körper | Clinch-Bild bei knappem Gefecht (kleiner `vorteil`): Schieben, Trennen | keine neue (Pp 20,1/20,7) | torment 25, dexterity 20, speed 16, power 10 | Pp knapp | A: S |
| **Gewichtheben** | Bühne | Paar; Sandsack-Rennen geteilt | im Hantel-Duell keiner; Sandsack-Rennen und „Die Grube" (Tauziehen) sind Kontakt pur | Sandsack: Rempler-Theater beim Überholen; Hantel: Einschüchtern | „Die Grube" als Format (Prototyp PR #1350) | power 28, health 16, determination 12, charisma 23 | Format eigens abzunehmen | A: S |
| **Speed-Schach** | Bühne | Paar am Brett | kein Körperkontakt; Uhr schlagen, Tisch-Rempler, Starren | Uhr-Schlag mit Ruck, Vorbeugen | keine | intelligence 28, awareness 21, will 14 | — | A: S |
| **Breaking** (Folter) | Bühne | Paar | Kontakt ist die Disziplin (Peiniger/Ertragender, Deckel ±20 %) | Treffer-Standbild, Rückstoß am Pfahl, Verfall-Ikonen | keine neue | will 28, torment 22, health 18 | rho 0,867, Beobachtungsliste | A: S |
| **Showcase** | Bühne | nein (Auftritte je für sich; Bildaufbau nicht nachgeprüft) | Rampenlicht stehlen, Drängeln beim Auf-/Abgang | Auf-/Abgangs-Rempler als Theater zwischen zwei Auftritten | keine: rho 0,781, nicht bestanden | charisma 27, spirit 16 | B gesperrt | A: S |
| **Eiskunstlauf** | Bühne | heute Paar; Chris will vier | Beinahe-Kollision, Kreuzen, Abdrängen an der Bande | **vier Aktive anzeigen** plus Kreuzen/Ausweichen als Theater | Rempler vorab in `bauBuehne()` gewürfelt | charisma 28 · dexterity 18, awareness 14 (ausweichen) · speed 10 | mittel: rho 0,912, Pp 18,8/19,8 | A: S–M · B: M–L |
| **Wettessen** | Bühne | ja (nebeneinander; Tischaufbau im Bild nicht nachgeprüft) | Ellbogen, Teller wegziehen, Ekel-Provokation | Tisch-Gerangel als Theater über die gebuchte Runde | Störkanal in der Ergebnisschicht; größter Puffer im Feld | will 26 (ignorieren) · health 22, stamina 22 · determination 16 | niedrig: rho 0,905, Pp 8,7/10,0 | A: S · B: M |
| **I-Spy** | Bühne | heute getrennt (zwei Kopien) | Schubsen, Warten, Wegdrängeln am Fundort | Abschnitt 4 | Abschnitt 4 | intelligence 18, torment 17, spirit 13, will 12 | sehr hoch: rho 0,776, nicht bestanden | A: M · B: M |
| **TDM** | Kampf | ja | Linie halten, Durchbrechen, Schildstoß | Rückstoß-Bild bei schweren Treffern (`knockbackResist` liegt je Archetyp vor), Standbild | Schildstoß kostet Position, keine HP | power 28, health 20 · stamina 14 · spirit 12 (Linie) | hoch: rho 0,813 knapp, Persönlichkeit war größter Fehlordner | A: S–M · B: L |
| **Mini-DM** | Kampf | ja (FFA) | Rausschubsen in Grube/Käfig, Abdrängen | Rückstoß zur Gefahr hin als Bild, Requisiten stehen | **K1 Rauswurf, gebunden an verlorene HP** — braucht Chris' Freigabe (Baustein 3) | power 16, torment 24 (drängen) · dexterity 10, stamina 16 (ausweichen) · health 20 | hoch: läuft unter Star-/Paartreue-Ausnahme | A: M · B: L |
| **Battlefield** | Kampf | ja (Kontrollpunkte) | Punkt halten, Verdrängen, Körper als Sperre | Gedränge am Punkt, Verdrängungs-Bild | Verdrängen vom Punkt (kostet Position, keine HP) | charisma 20, spirit 16 (halten) · intelligence 16 (umgehen) · torment 12, power 10 | mittel: Vierer-Pod 0,861–0,923 | A: M · B: M–L |

### 3.3 Was die Tabelle zusammen sagt

- **Sechs Disziplinen haben Kontakt schon im Motor** (Spurt, Takeshi, Climbing, Hockey,
  Basketball, Football) — dort ist Klasse A der billigste und sicherste Gewinn, weil nur gezeigt
  wird, was ohnehin gebucht ist.
- **Vier Disziplinen haben für Klasse B gar keinen Puffer** (Climbing, I-Spy, Showcase, Football)
  und zwei nur unter Ausnahme (Hockey, Mini-DM). Dort B nur nach ausdrücklicher Freigabe.
- **Drei haben echten Puffer für einen Versuch:** Wettessen (größter), Eiskunstlauf, Battlefield-
  Pod. Spurt hat die fertige Infrastruktur, aber seit dem Rücksetzer auf 0,860 weniger Luft als
  am 08.11. angenommen.
- **Vier haben strukturell keinen Körperkontakt** (Time-Trial, Tennis, Speed-Schach, Hantel-
  Duell). Dort ist „Interaktion" Zuruf und Reaktion, nicht Schubsen. Das würde ich Chris so sagen,
  statt Kontakt hineinzuzwingen.
- **Zur laufenden Budget-Kampagne:** Klasse B auf Bühne/Bahn/Feldspiel baut auf Rezepten, die
  gerade umgestellt werden (konsolidiertes Konzept 15.11., Abschnitt 4). Klasse A ist davon nicht
  betroffen. Das spricht zusätzlich dafür, mit A zu beginnen.

### 3.4 Messplan für jede Klasse-B-Variante

Derselbe Ablauf für alle, übernommen aus Q7 und der Machbarkeitsstudie vom 08.11. (Abschnitt 3.4):

1. Isolierter Worktree, Mechanik hinter einem Flag, Standard aus; aus = bit-identisch.
2. **Abbruchkriterium vor dem Bau** festgelegt: rho je Spiel > 0,80 **und** nicht mehr als 0,02
   unter dem Ist-Stand; Pp ≤ 25 auf zwei Saatströmen; Star auf Rang 1 nicht mehr als 5 Punkte
   schlechter; Heim:Gast nahe 50:50; Kontaktzahl im Korridor (Takeshi-Vorbild: 13,3 Rempler,
   5,4 Treffer je Rennen).
3. Dosis in Stufen (0 → schwach → voll), wie bei `ISPY_HINWEIS_BONUS`. Fällt rho monoton mit der
   Dosis, ist der Kanal eignungsfremd und wird verworfen, nicht kleiner gedreht.
4. Prüfen, **womit** die Kontakthäufigkeit korreliert. Bei Takeshi korrelieren Rempler und Treffer
   mit der Eignung zu 0,85/0,88 — das ist der Grund, warum es trägt. Ein neuer Kanal sollte
   dieselbe Prüfung bestehen.
5. Reißt eine Schranke: zurücknehmen, nicht die Schranke verschieben.

Drei Bauregeln, die aus der Recherche neu dazukommen:

- **Weicher Deckel statt Stopp** (A4): Blockieren bremst auf das Tempo des Vordermanns, nie auf
  null.
- **Der Greifer zahlt mit** (G1): jede Festhalte-Mechanik hat beidseitige Kosten, sonst entsteht
  Kontakt ohne Eigennutz (A3).
- **Gelegenheit aus der Persönlichkeit, Ausgang aus der Eignung** — die bestehende Trennung des
  Bahn-Remplers. Sie ist der Grund, warum er die Abnahme besteht, und gilt für jeden neuen Kanal.

---

## 4. I-Spy als Spezialfall

### 4.1 Ausgangslage

Chris' Wünsche: **eine** große Arena, in der sich alle überall bewegen; Verweilen am Fundort mit
Fortschrittsbalken; Schubsen und Tackeln, wenn zwei an denselben Ort wollen.

Messhistorie: geteilter Pool rho 0,53 („Zugriffsreihenfolge dominiert den Sub-Skill"), P1 „Spur
statt Los" 0,659–0,689, I-2k „Kennerblick" 0,717–0,738. Ist-Stand laut Tabelle vom 15./16.11.:
**0,776 (n=48), nicht bestanden**, Saison 0,881–0,888, Pp 14,6/15,0. Die Validität ist gut, die
Verlässlichkeit fehlt — und jede bisherige Strukturänderung hat die Validität stärker beschädigt,
als sie die Verlässlichkeit hob (`i-spy-offener-raum-konzept-14-10.md` Abschnitt 4).

Der strukturelle Punkt aus dem Papier vom 14.10. gilt unverändert: Exklusivität am Fundort ist ein
**Vorher-Tor** (sie entscheidet, ob jemand würfeln darf), die Bühnen-Duell-Lehre trägt nur für
Schichten **nach** dem Wurf. Bei acht fest budgetierten Ticks ist verlorene Zeit ein verlorener
Versuch.

### 4.2 Weg A — alles Erlebbare als Anzeige (rho unberührt)

Vier Bausteine, alle Klasse A, zusammen bit-identisch nachweisbar:

1. **Eine Arena.** Trennsteg weg, beide Hälften als ein Raum gezeichnet, beide Teams laufen
   sichtbar überall. Mechanisch bleiben es zwei unabhängige Truhenkopien. Damit das Bild nicht
   lügt: jeder Fundort wird als **Doppelmöbel** gezeichnet (zwei Schubladen, zwei Schlösser, in
   Teamfarben). Dann stimmt, was man sieht — zwei Spieler am selben Schrank arbeiten an
   verschiedenen Fächern — und es muss niemand erklären, warum beide „denselben" Fund machen
   können.
2. **Sichtbare Laufzeit.** Der Weg zum Fundort wird als Lauf mit kleiner Zeitanzeige am Läufer
   inszeniert. Die Dauer wird aus dem **bereits gewürfelten** Tick abgeleitet (wer in diesem Tick
   sucht, ist rechtzeitig da), sie entscheidet nichts.
3. **Verweilbalken je Fund.** Über dem Suchenden füllt sich ein Balken über die Tick-Dauer; am
   Ende klappt er auf Erfolg oder Fehlschlag. Füllgeschwindigkeit und kleine Hänger werden aus dem
   feststehenden Ausgang gewählt (knapp gescheitert: Balken stockt bei 90 %), nie umgekehrt. Das
   ist dieselbe Technik wie beim Gewichtheben („zittert, bevor er hält").
4. **Schubser als Theater nach dem Wurf.** Der Motor kennt den Tick-Ausgang beider Seiten, bevor
   gezeichnet wird. Stehen zwei Gegner am selben Doppelmöbel, wird daraus eine Szene:
   - beide erfolgreich → kurzes Gerangel, beide ziehen ihr Fach auf;
   - einer erfolgreich, einer nicht → der Erfolgreiche schiebt den anderen sichtbar weg
     (`angriff`/`treffer`-Pose, Rückstoß), der Balken des Verlierers bricht ab;
   - beide gescheitert → sie behindern einander, beide Balken stocken.
   Wer schubst, ist also immer der, der den Tick ohnehin gewonnen hat. Das Bild erzählt eine
   Ursache, die Wertung kennt nur das Ergebnis. Dazu die vorhandene seiteninterne Reihenfolge
   (NERVEN, „K-D Wettlauf mit Fortschritt") als sichtbare kleine Warteschlange.

Ehrliche Einordnung, wie am 14.10.: Das erfüllt das **Erlebnis** (offener Raum, Balken, Schubsen
im Bild), nicht die **Mechanik** der Exklusivität. Es sollte Chris so benannt werden und nicht als
„28b erledigt" laufen. Aufwand M (Zeichenarbeit in `bodenSchatzsuche()`, Doppelmöbel als
Requisiten sind vom PixelLab-Freeze nicht betroffen).

### 4.3 Weg B — echte Kontestation, als Messversuch

Zwei Varianten, in dieser Reihenfolge.

**B-1 „Streitfund" (Kontestation in der Ergebnisschicht).** Die Würfe bleiben, wie sie sind;
niemand verliert einen Versuch. Nur für die **beiden Tresore** (Stufe 3) gilt: haben beide Seiten
im selben Tick dort Erfolg, entsteht ein Streit. Entschieden wird er durch den Vergleich der
bereits gewürfelten Leistungen beider Finder (die Differenz, die der Motor ohnehin kennt). Der
Sieger bekommt einen kleinen Aufschlag, der Verlierer behält seinen vollen Fund (Q7: kostet nichts
Erreichtes). Vorbild ist die Short-Track-Gutschrift (S1) umgekehrt: nicht der Behinderte wird
entschädigt, sondern der Stärkere im direkten Vergleich belohnt.

- Warum das eine Chance hat, wo der geteilte Pool scheiterte: es gibt keine Zugriffsreihenfolge,
  kein Timing, kein neues `rr()`. Der Aufschlag hängt an derselben Leistung, die `u.summe` schon
  misst — er verstärkt ein eignungsnahes Signal, statt ein fremdes einzuspeisen.
- Warum es trotzdem scheitern kann: der Aufschlag hängt auch davon ab, **gegen wen** man zufällig
  im selben Tick am Tresor steht. Das ist ein Rest von Gegnerzufall in `u.summe`.
- Dosis: Aufschlag 0 → 5 % → 10 % des Tresorwerts.

**B-2 „Tresor-Exklusivität" (echtes Vorher-Tor, Low-Dose).** Wie im Papier vom 14.10. Abschnitt 7:
nur die zwei Tresore gemeinsam, Verdrängen nach der bestehenden seiteninternen Formel (NERVEN-
Reihenfolge, zweiter Versuch im selben Tick, „niemand verliert seinen Zug allein durch die
Kollision") auf beide Seiten erweitert. Nur angehen, wenn B-1 besteht **und** Chris es danach
immer noch will.

**Abbruchkriterium, vor dem Bau fixiert** (gilt für B-1 und B-2 einzeln):

| Größe | Kriterium |
|---|---|
| rho je Spiel (n=48, kaderfest) | **nicht unter dem Ist-Stand** 0,776 bei gleicher Stichprobe; Ziel bleibt > 0,80 |
| Dosisverlauf | rho darf mit steigender Dosis nicht monoton fallen |
| Paarvergleich | besser oder gleich in ≥ 4 von 5 Kader-Varianten |
| Star auf Rang 1 | ≥ 45 % (Ist 47,1 % bei n=48) |
| Pp | ≤ 25 auf zwei Saatströmen; `speed`/`awareness` dürfen nicht über ihr Matrixgewicht hinaus tragen |
| Spiegel | Heim:Gast nahe 50:50 |

Reißt eine Zeile: Variante verwerfen, Stand bleibt. **Erwartung, ehrlich:** für B-2 eher nein (drei
Fehlschläge am selben Chassis); für B-1 offen — ich halte es für den einzigen Kontestations-Ansatz,
der nicht schon durch eine vorliegende Messung widerlegt ist. Und weil I-Spy aktuell ohnehin unter
der Schranke liegt, sollte kein B-Versuch die eigentliche Reparatur der Verlässlichkeit aufhalten.

---

## 5. Empfohlene Reihenfolge

Ein Prototyp-Kandidat je Chassis, mit Begründung. Reihenfolge nach „sichtbarer Gewinn je Risiko".

| Rang | Chassis | Kandidat | Klasse | Warum dieser |
|---|---|---|---|---|
| 1 | Bahn | **Spurt** (dann Takeshi) | A | Rempler sind gebucht, die Nahkamera zoomt schon auf enge Szenen; hier entsteht der Baukasten aus 3.1 an echten Ereignissen. Takeshi übernimmt ihn fast unverändert und bringt die Komik (F4). |
| 2 | Bühne | **I-Spy Weg A** | A | Direkter Chris-Wunsch, mehrfach geäußert; vollständig als Anzeige lösbar; I-Spy darf mechanisch gerade nichts riskieren. |
| 3 | Feldspiel | **Basketball** (Ausboxen und Block sichtbar) | A | Ausboxen existiert im Motor und ist unsichtbar; Basketball ist das einzige Feldspiel, das bestanden ist und nicht in Reparatur steckt. Hockey als zweites (Check in zwei Stufen), Football nur Optik. |
| 4 | Bühne | **Eiskunstlauf: vier Aktive anzeigen** | A | Chris' Strukturwunsch vom 08.11., rho-neutral beweisbar, schafft die Fläche für jede spätere Interaktion. |
| 5 | Bahn | **Spurt B1 Tempo-Deckel** | B | Erster Mechanik-Versuch dort, wo Flags, Messwerkzeug und Persönlichkeits-Frequenz schon stehen. Erst nach Rang 1, damit man die Wirkung sieht. |
| 6 | Bühne | **Wettessen Tischkampf** | B | Größter Puffer im Feld; Kontakt in der Ergebnisschicht. |
| 7 | Kampf | **Mini-DM K1 Rauswurf** | B | Requisiten stehen, Chassis ist außerhalb der Budget-Kampagne — aber nur nach Chris' Freigabe (Frage 2). Battlefield „Verdrängen vom Punkt" als Alternative mit mehr Puffer. |

Zur Aufzählung im Auftrag: Tennis steht im Motor unter `BUEHNE_ART`, nicht im Feldspiel; es hat
durch das Netz keinen Körperkontakt und bekommt hier nur Reaktions-Theater. Staffel und Climbing
bleiben wegen Pp- bzw. rho-Enge bei Klasse A. TDM bekommt Rückstoß-Bilder, aber keine neue
Mechanik, solange rho bei 0,813 steht. Breaking ist bereits Kontakt mit Deckel; dort nur Game Feel.

---

## 6. Fünf Fragen an Chris

1. **Reicht dir bei den Disziplinen ohne Puffer das Bild?** In Climbing, I-Spy, Showcase, Football
   und TDM würde ich Kontakt vorerst nur zeigen (an Ereignisse gehängt, die ohnehin passieren),
   nicht neu als Mechanik bauen. Einverstanden, oder soll eine davon trotzdem einen Messversuch
   bekommen?
2. **Mini-DM: Rausschubsen in Grube/Käfig als dritter Ausgang — ja, mit der Bindung an verlorene
   HP?** Das heißt: wer den Kampf gerade gewinnt, fliegt fast nie; wer am Verlieren ist, kann
   rausfliegen. Das wäre die Variante mit der besten Chance auf Rangtreue, nimmt dem Rauswurf aber
   die ganz großen Überraschungen.
3. **I-Spy: Doppelmöbel in einer offenen Arena (Weg A) als ehrliche Lösung — oder willst du den
   „Streitfund"-Versuch (B-1) zusätzlich gemessen haben?** Beides schließt sich nicht aus; B-1
   ist ein Versuch mit vorab festgelegtem Abbruch.
4. **Disziplinen ohne Körperkontakt** (Time-Trial, Tennis, Speed-Schach, Hantel-Duell): Soll dort
   bewusst **kein** Schubsen stattfinden und stattdessen Zuruf/Psychospiel gezeigt werden — oder
   möchtest du für eine davon ein eigenes Kontakt-Format (wie Tauziehen fürs Gewichtheben)?
5. **Wie hart darf Kontakt aussehen?** Zwei Stufen (Schubser / Treffer mit Stolpern) kommen mit
   den vorhandenen Posen aus. Für ein drittes Bild — zu Boden gehen und wieder aufstehen, ohne
   K.o. — gibt es keine eigene PixelLab-Pose; die `tod`-Pose wäre falsch. Behelf wäre eine
   gekippte Figur, wie der Eiskunstlauf seinen Sturz zeichnet. Reicht dir der Behelf, oder soll
   für eine echte „Niedergehen und Aufstehen"-Animation ein Kostenvorschlag kommen (sie fiele für
   den ganzen Figurenbestand an)?

---

## 7. Strategie-Templates je Disziplin (Zusatzauftrag 16.11.)

Chris, sinngemäß: auswählbare Strategie-Templates, offensiv/neutral/defensiv, passend zur
Disziplin; wie beim Football-Manager-Zuruf soll dabeistehen, wie sich die Wahl auf die Spieler
auswirkt (aggressiver? mehr Schubsen?). Es soll das **Verhalten** ändern, nichts an den Stats; man
soll sehen, ob sie offensiver oder defensiver spielen und ob mehr geschubst wird. Wahl vorher in
der Einsatzliste **oder** live — „das würde Spice reinbringen".

**Vorab:** Dieser Wunsch ist zu großen Teilen schon ausgearbeitet. `taktik-grundeinstellung-
konzept-26-10.md` (Opus) behandelt alle zwanzig Disziplinen, sieben Regeln, Messplan und
Reihenfolge — auf Chris' fast gleichlautende Nachricht vom 26.10. Ich wiederhole das nicht,
sondern ergänze, was am 16.11. neu ist: (1) Kontaktneigung als ausdrücklicher Teil des Templates,
(2) die Live-Wahl, (3) Recherche zur Frage, wie andere Spiele die Wirkung erklären.

### 7.1 Recherche: wie machen es andere, und wie erklären sie die Wirkung?

| Spiel | Struktur | Wie die Wirkung erklärt wird | Lehre |
|---|---|---|---|
| **Football Manager — Team-Mentalität** (Q36) | Sieben Stufen; Einzel-Mentalität = Team-Mentalität plus Duty des Spielers | Etikett plus Beschreibung; gilt als unintuitiv, weil das Etikett nicht zeigt, was sich auf dem Feld ändert | Team-Stufe **verschiebt** die Einzelvorgabe, ersetzt sie nicht — deckt sich mit Regel 3 vom 26.10. Und: ein Etikett allein genügt nicht |
| **FM — Team-Anweisungen** (Q35) | Benannte Schalter, teils einander ausschließend („Get Stuck In" gegen „Stay On Feet") | Ein Satz Verhalten **plus Gegenpreis** („aggressivere Zweikämpfe, mehr Fouls und Karten") | Das beste Erklärmuster: Verhalten und Preis in einem Satz, keine Zahl |
| **FM — Zurufe** (Q33, Q34) | Kurzfristig, etwa alle zehn Minuten, wirkt ab der nächsten Unterbrechung; kann nach hinten losgehen | Reaktion der Spieler als Rückmeldung nach dem Zuruf | Abklingzeit plus Wirkung an einer natürlichen Unterbrechung; sichtbare Reaktion. Die Rücknahme der Streichung in FM26 zeigt: ohne Zurufe wurde das Spiel als passiver erlebt — genau Chris' „Spice" |
| **EA NHL — Strategien je Reihe** (Q37) | Benannte Systeme plus Regler, je Reihe, im Spiel umschaltbar | Kurztext je System | Im Forum Zweifel, ob die KI es umsetzt → die Wirkung muss im Bild **beweisbar** sein |
| **NBA 2K — Coach-Einstellungen** (Q38) | Druck als Abstand zum Gegenspieler; einander ausschließende Schwerpunkte | Beschreibung je Option | „Druck = Abstand" ist ein reiner Verhaltensparameter, den man sieht |
| **Pro Cycling Manager** (Q21) | Befehl je Fahrer (Schützen, Relais), Effort-Regler | Anzeige von Effort und aktuellem plus **nächstem** Befehl je Fahrer | Der Befehl steht sichtbar am Fahrer — Vorbild für unsere Chips |

Keine der Quellen arbeitet mit Vorher/Nachher-Zahlen. Durchgesetzt hat sich **Wort plus
Gegenpreis**, und wo die Umsetzung im Bild nicht erkennbar ist, entsteht Misstrauen.

### 7.2 Was im Code schon liegt — nutzen statt neu erfinden

Im Motor nachgesehen (Zeilen Stand Worktree 16.11.):

| Baustein | Fundstelle | Was er ist | Rolle im Template |
|---|---|---|---|
| **Rennpläne** | `BAHN_ART.*.plaene` / `planJeSlot` (Spurt: `engine.js` ~46813: Von vorn / Windschatten / Schlusssprint, reine Zahlen `tempo`, `sucht`, `ab`) | Verhalten je Läufer | Template verschiebt den Plan um eine Stufe |
| **Rennplan-Ansage live** | `engine.js` ~50380 („der Plan eines eigenen Läufers, mitten im Rennen gewechselt"), Bedienzustand `bahnWahl` | Live-Eingriff existiert, im Zuschau-Modus aus (`nurZuschauen`, ~7345) | Vorlage für die Live-Wahl |
| **Rempel-Neigung** | `willTackeln` je Persönlichkeit (`stepSpurt`, Block „TACKLE") plus `tackleRate` | Häufigkeit, nicht Ausgang | **Der Kontaktregler**: Template multipliziert die Neigung |
| **Kampf-Haltung, Zusammenhalt, Bindung** | `HALTUNG`, `ZUSAMMEN`, `BINDUNG` (~7848), fünf benannte Stufen | Verhalten je Kämpfer | Template verschiebt um eine Stufe |
| **Befehle je Reihe** | `ORDERS` (~7811): Mit der Linie / Hinter den Eigenen / Rücken decken / Flanke / Verfolgen, mit Tooltip-Text, der verspricht, was die Simulation tut | Verhalten je Reihe | Bleibt Feinsteuerung unter dem Template |
| **Feldspiel-Taktik-Karte** | `setzeTaktik()` (~10906), `fsLive.taktikManuell`; Fundament 15.10. | Datenstruktur und KI-Vorgabe; **von keiner Mechanik gelesen** | Das Scharnier fürs Feldspiel — die Mechanik-Bindung fehlt noch |
| **Bühnen-Haltungen** | `WETTESSEN_HALTUNGEN` (Sprint/Gleichmäßig/Schlussspurt, ~20370), Speed-Schach-Ansagen, `place[n].haltung` | Verhalten je Teilnehmer | Template setzt die Vorgabe |
| **Intensität** | `INTENSITAET` (~8726): Schonen −2,5 / Normal 0 / Push +4 auf den Wert, Ermüdung 1/3/4 | **Ein Stat-Regler** | **Kein** Teil des Templates (s. u.) |
| **Formkarten, Mutatoren** | `zieheFormkarten()`, `MUTATOREN` | Wert-Kanäle | Kein Teil des Templates |
| **Persönlichkeit** | `leitePers()`, `PERSORD` | Vorgabe je Spieler | Die Basis, die das Template verschiebt |

Zwei Folgerungen:

- **Intensität ist das Gegenteil dessen, was Chris hier will.** Sie ändert den Wert (−2,5/0/+4).
  Das Template darf sie weder ersetzen noch mit ihr verschmelzen, und es darf nicht „Push" heißen.
  Vorschlag: Intensität bleibt die Kraft-Achse (wie viel der Spieltag kostet), das Template ist
  die Spielweise-Achse (was die Spieler tun).
- **Eine zweite Struktur wäre falsch.** Ein Template ist ein **benanntes Bündel von Verschiebungen
  der vorhandenen Regler** — das „Grundgerüst Schritt 0" vom 26.10. (ein Feld `grundtaktik` je
  Disziplin-Seite neben der Intensität, Lesestelle je Chassis). Neu ist nur, dass es auch die
  Kontaktneigung trägt.

### 7.3 Wie ein Template nur Verhalten steuert

Fünf Verhaltensregler, die ein Template bewegen darf — jeder ist heute schon ein Motorparameter
oder ließe sich als solcher lesen:

| Regler | Bedeutung | Vorhandene Entsprechung |
|---|---|---|
| **Kontaktneigung** | wie oft ein Rempler/Check gesucht wird | `willTackeln` × `tackleRate`; Hockey: Check-Bereitschaft; Kampf: `HALTUNG` |
| **Aggressionsradius** | ab welchem Abstand ein Gegner angegangen wird | `tackleSpur`, Reichweiten im Kampf, On-Ball-Druck im Feldspiel |
| **Positionswahl** | vorn/innen/hinten, Linie halten oder lösen | Rennplan `sucht`, `ZUSAMMEN`, `ORDERS` |
| **Risiko** | früher oder später angreifen, kühner Versuch | Rennplan `ab`, Heben-Eröffnung, Schach-Remis |
| **Tempo-Verteilung** | wann die Kraft ausgegeben wird | Rennplan `tempo`, Wettessen-Haltung |

**Die Prüffrage** (Regel 2 vom 26.10.): Lässt sich die Wirkung als „+x auf Attribut y" schreiben?
Dann ist es ein Stat-Ding und fliegt raus. Erlaubt ist nur, eine **Entscheidung** zu verschieben,
und jede Verschiebung zahlt in einer anderen Währung (Zeit, Reserve, HP, Position).

**Ehrlich zur Neutralität:** Ein Template, das Verhalten ändert, ist **nicht** rho-/Pp-neutral —
es ändert, wie oft welcher Kanal entscheidet. Neutral ist nur die Stufe „Neutral" (bit-identisch
zum heutigen Motor, das ist die Garantie). Für Offensiv und Defensiv gilt die volle Abnahme:

- rho je Spiel > 0,80 **je Stufe** und in den gemischten Paarungen (offensiv gegen defensiv, beide
  Richtungen; alle neun Kombinationen, weil ein Manager jede setzen kann);
- Pp ≤ 25 auf zwei Saatströmen **je Stufe** (`scripts/messe-arena-einfluss.mjs`) — das Template
  gewichtet kein Attribut um, verschiebt aber die gemessenen Anteile;
- Knopf-Test: jede Stufe ist für mindestens ein Fünftel der Teams die beste, und welche die beste
  ist, hängt an einem Sub-Skill, nicht an der Gesamteignung (sonst ist Offensiv bloß „besser");
- Star auf Rang 1 fällt um höchstens 5 Punkte; Spiegeltest je Stufe.

Der vollständige Messplan steht im Konzept vom 26.10., Abschnitt 7.

**Warum Kontaktneigung der richtige erste Regler ist:** Sie ist der bereits abgenommene Fall. In
Spurt und Takeshi steuert heute die Persönlichkeit die Häufigkeit, die Eignung den Ausgang, und
beide bestehen. Ein Template, das `willTackeln` für das ganze Team mit einem Faktor versieht,
bewegt sich auf derselben Achse — „mehr Schubsen" wird sichtbar häufiger, und ob es sich lohnt,
entscheidet WUCHT gegen ROBUST. Der starke Kader profitiert von Offensiv, der wendige von
Defensiv: genau der Break-even an einem Sub-Skill, den der Knopf-Test verlangt.

**Disziplintypische Namen statt dreimal dasselbe Wort** (Vorschlag, je Chassis ein Beispiel):

| Disziplin | Defensiv | Neutral | Offensiv |
|---|---|---|---|
| Spurt | „Sauber laufen": weicht Kontakt aus, läuft außen | wie heute | „Ellbogen raus": sucht den Rempler, hält die Innenbahn |
| Takeshi | „Abstand halten" | wie heute | „Räumen": schubst vor jeder Falle |
| Hockey | „Stehen und stören" | wie heute | „Forecheck hart": Check früher gesucht |
| Basketball | „Zurück": kein Kampf ums Offensivbrett | wie heute | „Ans Brett": ausboxen, Blocks stellen |
| TDM | „Linie halten" | wie heute | „Durchbrechen" |
| Wettessen | „Gleichmäßig" | wie heute | „Sprint" (vorhandene Haltungen) |

Showcase und Eiskunstlauf hatten am 26.10. keinen Ansatzpunkt; Time-Trial nur Tempo. Dort wäre
der Chip ausgegraut mit Hinweis.

### 7.4 UI-Skizze

**Einsatzliste (vorher).** Neben der Intensität, je Disziplin-Seite:

```
Spurt · Heim                                    Kraft:      [Schonen] [Normal] [Push]
                                                Spielweise: [Sauber laufen] [Normal] [Ellbogen raus]
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ Ellbogen raus                                                              │
  │ Deine Läufer suchen den Kontakt und halten die Innenbahn.                  │
  │ ▲ mehr Rempler   ▲ engere Linie   ▼ weniger Reserve im Schlussdrittel      │
  │ Lohnt sich mit:  Wucht (Haldor, Mira)      Riskant für:  Stehvermögen (Jo) │
  └────────────────────────────────────────────────────────────────────────────┘
```

Drei Elemente, alle ohne Zahl: ein Satz Verhalten, Pfeile für das, was man **sehen** wird (mehr
Rempler, engere Linie) samt Gegenpreis, und der eigene Kader im Spiegel (wer profitiert, wer
zahlt). Der Kader-Spiegel wird aus den Rezepten abgeleitet, nicht von Hand gepflegt (26.10.,
Abschnitt 6).

**Live in der Arena.** Kleine Chips über der Anzeige, je eigener Seite:

```
 ┌ Spielweise ──────────────────────────────┐
 │ (Sauber) (Normal) [Ellbogen raus]  ⏱ 6 s │      ← aktive Wahl gefüllt, Abklingzeit sichtbar
 └──────────────────────────────────────────┘
        Rempler 4 · gesessen 2 · bezahlt 1,1 s          ← Anweisungsbilanz, läuft mit
```

- **Umschalten wirkt an einer natürlichen Stelle**, nicht mitten im Tick: Bahn am nächsten
  Streckenabschnitt, Feldspiel bei der nächsten Unterbrechung, Kampf mit der nächsten Welle (FM-
  Vorbild: ab der nächsten Spielunterbrechung).
- **Abklingzeit** nach dem Wechsel, damit es eine Entscheidung bleibt und kein Dauerklicken.
- **Sichtbare Quittung:** beim Wechsel Sprechblase am Team („Ellbogen raus!"), Tickerzeile, und
  die Figuren tragen eine kleine Ikone, solange das Template aktiv ist — wie der Befehl am Fahrer
  in PCM. Ohne Quittung entsteht das NHL-Misstrauen („macht die KI das überhaupt?").
- **Anweisungsbilanz** läuft mit und steht im Endstand (Staffel hat das Muster schon).

**Die offene technische Frage der Live-Wahl:** Heute gilt *gezeigt = gebucht*, und im Zuschau-Modus
sind Eingriffe aus, weil sie den Verlauf ändern würden (`nurZuschauen`). Eine Live-Wahl, die das
Ergebnis beeinflusst, muss also entweder **Teil der gebuchten Simulation** sein (der Wechsel wird
mit Zeitpunkt protokolliert und zählt) oder sie bleibt auf Modi beschränkt, in denen live gespielt
wird. Für die Messung heißt das: Live-Wechsel sind eine Folge von Stufen; abgenommen wird jede
Stufe und jede Paarung, damit kein Wechselzeitpunkt aus dem geprüften Raum herausführt. Das gehört
vor dem Bau geklärt (Frage unten).

### 7.5 Reihenfolge

| Schritt | Inhalt | Klasse |
|---|---|---|
| 0 | **Grundgerüst** wie am 26.10. beschrieben: Feld je Disziplin-Seite neben der Intensität, Übergabe an den Motor, No-op-Lesestelle je Chassis, KI-Vorgabe, Sonden-Parameter, Bilanzrahmen. Bit-identisch. | A |
| 1 | **Pilot Bahn: Spurt.** Drei Templates als Bündel aus Rennplan-Verschiebung und Kontaktneigung. Volle Abnahme je Stufe und Paarung. | B |
| 2 | **Live-Chips im Spurt**, aufgesetzt auf die bestehende Rennplan-Ansage. | B |
| 3 | Takeshi (gleicher Codepfad), dann Climbing (Chris' Beispiel vom 26.10.; rho-Enge beachten) | B |
| 4 | Kampf (Haltung/Zusammenhalt), Feldspiel (sobald die Taktik-Karte eine lesende Mechanik hat) | B |

**Warum Bahn als Pilot und nicht Speed-Schach** (die Empfehlung vom 26.10. wegen geringstem
Risiko): Chris' neuer Schwerpunkt ist sichtbares Verhalten und Schubsen. Im Spurt existieren
sowohl der Kontaktregler als auch die Live-Ansage, und man sieht den Unterschied sofort. Speed-
Schach wäre sicherer, zeigt aber nichts von dem, worum es ihm am 16.11. geht. Einschränkung:
Spurts rho ist auf 0,860 zurückgefallen; der Puffer ist kleiner als im Oktober. Sollte der Pilot
dort eine Stufe reißen, ist Takeshi (gleicher Code) nicht besser dran (0,838) — dann wäre
Wettessen (0,905, Haltungen fertig) der Ausweichpilot, allerdings ohne Kontakt.

**Zusätzliche Fragen an Chris zu Abschnitt 7** (ergänzen die neun vom 26.10., ersetzen sie nicht):

- **Zählt die Live-Wahl fürs Ergebnis?** Wenn ja, wird sie Teil des gebuchten Spiels und muss in
  jeder Kombination abgenommen sein. Wenn nein, ist sie Schau — und dann eher kein „Spice".
- **Darf der Gegner (KI) ebenfalls live umschalten?** Das macht es lebendiger, verdoppelt aber den
  Raum, der gemessen werden muss.

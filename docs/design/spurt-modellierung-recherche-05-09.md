# Spurt als Hindernislauf — Diagnose, Vorbild, Rezeptvorschlag (Fable, 05.09.2026)

Stand `d74e3b98` (`origin/main`, 05.09.). Reine Recherche: **keine Zeile am Motor geändert**,
die einzige Datei dieses Branches ist dieser Bericht. Alle Prototypen unten liefen gegen
Kopien von `public/mockups/battle-mode.engine.js` im Scratchpad, gemessen mit derselben
kaderfesten Methode wie `docs/design/stand-aller-disziplinen.md` (fünf echte Team-Paarungen
aus `data/generated/kaderfamilie-live-save.json`, n = 24 je Variante, Median und Spannweite).
Die Patches stehen im Anhang, damit die Umsetzungsrunde sie zeichengenau nachbauen kann.

Auftrag (Chris, über den Projektagenten): Spurt „als nächste Disziplin von Grund auf
modellieren" — nach dem Schema Tennis/Fechten und Football. Vorbild: Ninja Warrior, Spartan
Race, Hindernislauf.

---

## Die Kurzfassung, ohne Architekturwissen lesbar

1. **Spurt ist heute kein Hindernislauf, sondern ein Ermüdungssprint mit Hürden als
   Dekoration.** Gemessen tragen Wille 29 % und Entschlossenheit 25 % das Ergebnis (Matrix:
   14 und 15), während Dexterity 3,5 %, Torment 2,7 % und Power 2,4 % lesen (Matrix: 12, 14,
   10). Die drei Attribute, die die Matrix für Hindernisse bepreist — zusammen 36 % —,
   bewirken mechanisch fast nichts. Das ist der Grund, warum beide rho-Spalten niedrig sind.
2. **Die auffällige Spannweite (0,559) hat drei Ursachen, und keine davon ist ein einzelner
   Sturz.** Erstens die Kader selbst: wo fünf von acht Läufern innerhalb von zehn
   Eignungspunkten liegen (Golden Gladiators/Silver Soldiers), kann keine Mechanik ordnen —
   rho 0,31 dort gegen 0,87 bei Chris' eigenem Kader (Eignungs-SD 10,7 gegen 23,2). Zweitens
   der Rempler: 9 bis 16 Rempler je Rennen bei acht Läufern, jeder erfolgreiche kostet
   0,55–1,45 s bei einer Zielspanne von 3–5 s; Tackle allein abgeschaltet bringt 0,652 → 0,710
   und Spannweite 0,559 → 0,371. Drittens die Hürde als Münzwurf: nur rund die Hälfte der
   sieben Hürden wird sauber genommen, jeder Läufer würfelt also drei- bis viermal je Rennen
   über 0,1–0,5 s — und ein Gelingen kostet nichts, ein Misslingen viel.
3. **Mehr Läufer helfen nicht, weniger schaden.** Sechs je Seite: 0,644. Zwei je Seite (das
   ist das echte `playerCount` von Spurt, gewürfelt 2–6): 0,583 über vier Läufer — eine Zahl,
   die statistisch fast nichts sagt. Die Abnahme muss wie bei Gewichtheben bei 2, 4 UND 6 je
   Seite laufen, und bei vier Läufern über Star-Quote und Paartreue statt über rho.
4. **Der Hebel ist die Validität, nicht die Uhr — und er ist nachgemessen.** Ein Prototyp,
   der jedes Hindernis zu einem stetigen, typabhängigen Zeitpreis macht (0,36–0,84 s je
   Hindernis zwischen Skill 80 und 20, drei Hindernistypen mit je eigenem Sub-Skill,
   Rempler gedämpft, Ermüdung halbiert), hebt kaderfest **0,652 → 0,857** je Spiel, die
   Spannweite fällt **0,559 → 0,286**, Saison **0,690 → 0,905**. Dexterity liest dann 16,7 %,
   Awareness 11,7 %. Bei sechs je Seite 0,849, bei zwei je Seite 0,700 (Paartreue ≥ 15 Punkte:
   85–100 %). Die Verlässlichkeit hat sich dabei **nicht** bewegt (0,89 → 0,90) — exakt die
   Lehre aus CLAUDE.md.
5. **Kein neues Chassis.** Alles, was der Hindernislauf braucht, hat das Bahn-Chassis schon
   (Hindernisorte, Technik-Wucht-Sturz-Kette, Kamera, Pläne). Es fehlt eine Liste
   `hindernisTypen` und ein Zeitpreis je Hindernis — rund dreißig Zeilen in `BAHN_ART.spurt`,
   drei in `stepSpurt`/`tempoVon`. Dieselbe Erweiterung würde Climbing (0,790) und Takeshi
   (0,697) zugutekommen. Die Assets für Hürde, Wand, Palisade, Strickleiter, Strohballen,
   Baumstamm, Feuer und Wassergraben liegen **bereits in den zwei LPC-Paketen, die das Repo
   für die Bahn heruntergeladen hat** — nur nicht geschnitten.

Realistischer Sprung nach einer Umsetzungsrunde: **0,65 → 0,80–0,86 kaderfest** bei vier und
sechs je Seite; bei zwei je Seite bleibt rho um 0,70, dort ist die ehrliche Abnahmezahl die
Paartreue.

---

## 1. Diagnose

### 1.1 Was Spurt heute im Code ist

`BAHN_ART.spurt` (`engine.js:14418–14458`), gefahren vom gemeinsamen Bahn-Motor
`bauSpurt`/`stepSpurt`/`tempoVon` (`:14764`, `:15052`, `:14955`). Es gibt also
**tatsächlich Hindernisse als Mechanik**, nicht nur einen umbenannten Sprint:

| Element | Wo | Wie |
|---|---|---|
| 7 Hürden bei 14–86 % der Strecke | `hindernisse:[0.14 … 0.86]` | an jeder: Wurf gegen `technik = 0,24 + TECHNIK·0,006` (bei TECHNIK 50: 54 %). Gelingen kostet **nichts**. Misslingen: Wurf gegen `wucht = 0,10 + WUCHT·0,009` → „Durchbruch" (0,12 s Stolpern, 14 Reserve), sonst Sturz `0,45 + (1−TECHNIK/100)·0,5` s bei 35 % Tempo (`:15156–15218`) |
| Windschatten | `schatten:true` | 4,5 % schneller, 34 % sparsamer hinter einem Vordermann ≤ 6,2 % voraus (`:14859`) |
| Rempler | `tackle:true`, `tackleAb:36`, `tackleRate:2.4` | wer WUCHT > 36 hat, würfelt je Tick `pers·2,4·dt`; Erfolg `WUCHT/(WUCHT+ROBUST)`; Opfer 0,55–1,45 s Stolpern + 18 Reserve (`:15231–15253`) |
| Kraftreserve | `kraftBasis:265` | Ersatz für Leben, verbrennt mit Tempo²; leer → Faktor 0,74–0,86 |
| Ermüdung | `muedGrad:0.00028` | ab 45 % Strecke sinkt Tempo mit `(100−STEHEN)` |
| Drei Rennpläne | `vorn`/`schatten`/`kick` | Tempo 1,00/0,94/0,90 bis zum Angriffspunkt |
| 4 Läufer je Seite, 4 Slots | `jeSeite:4`; `SLOTS_JE_DISC.spurt` | blockstart/acceleration/topspeed/lanecontrol (`:3406`) — `lib/lineups/matchday-slot-roles.ts` kennt zusätzlich drivephase/photofinish, die der Motor nicht liest |

Sieben Sub-Skills aus den zwölf Attributen (`rezept`, `:14439–14445`): ANTRITT (speed 42,
power 34, det 24), ENDTEMPO (speed 36, will 30, det 22, stamina 12), TECHNIK (dex 52,
awareness 30, det 18), WENDIGKEIT (dex 46, awareness 34, speed 20), STEHEN (det 44, will 32,
health 24), WUCHT (torment 55, power 42, speed 3), ROBUST (health 28, torment 24, will 20,
dex 18, awareness 10).

### 1.2 Was das Rennen tatsächlich entscheidet — die Einflussmessung

`node scripts/messe-arena-einfluss.mjs spurt 48` (hebt je ein Attribut um +15 und misst den
Platzgewinn; Abweichung zur Matrix in Prozentpunkten):

| Attribut | Anteil heute | Matrix | Differenz |
|---|---:|---:|---:|
| will | 29,3 % | 14 | +15,3 |
| determination | 24,8 % | 15 | +9,8 |
| speed | 19,3 % | 18 | +1,3 |
| health | 7,5 % | 6 | +1,5 |
| stamina | 7,5 % | 4 | +3,5 |
| dexterity | 3,5 % | 12 | **−8,5** |
| awareness | 3,2 % | 7 | −3,8 |
| torment | 2,7 % | 14 | **−11,3** |
| power | 2,4 % | 10 | **−7,6** |
| Abweichung gesamt | | | **62,6 Pp** |

Wille und Entschlossenheit sitzen in STEHEN (Ermüdung) und ENDTEMPO (multipliziert das
Tempo direkt) — und `mued` fällt bei niedrigem STEHEN bis auf 0,60. Dexterity sitzt in
TECHNIK und WENDIGKEIT, Torment/Power in WUCHT — also in genau den Werten, die nur an
Hürde und Rempler wirken. **Die Hürde zahlt nicht, weil ein Gelingen nichts kostet** (der
Kommentar bei `:15158` beschreibt diesen Effekt selbst für das Zeitfahren) **und weil die
Tempo-Spanne so weit ist** (`tempoSpanne 0,95` auf `grundTempo 88`: Skill 20 läuft 107,
Skill 80 läuft 164 — 53 % Unterschied), dass ein einzelner Sturz von 0,4 s im Rauschen der
Laufzeit untergeht. Die Vorgänger-Recherche (`bahn-disziplinen-recherche-fable.md` 2.3) hatte
den „Grundpreis je Hürde" bereits als Angebot notiert; damals bestand Spurt einzelkader
(0,810), und das Angebot blieb liegen.

### 1.3 Warum die Spannweite 0,559 ist — je Kader aufgeschlüsselt

Eigene Sonde (Anhang A), unveränderter Motor, n = 24, vier je Seite:

| Kader-Paarung | rho/Spiel | SD je Spiel | Saison | Eignungs-SD der 8 | Star auf 1 | Star in Top 2 | Paare ≥ 15 Pkt richtig | Paare < 3 Pkt | Rempler/Rennen (erfolgreich) | Stürze/Läufer | Durchbrüche/Läufer | Zielspanne |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Vigilante/Armageddon | 0,867 | 0,06 | 0,929 | 23,2 | 83 % | 100 % | 98 % | 67 % | 9,5 (5,6) | 1,89 | 1,67 | 5,0 s |
| Cold Steel/Dire Legion | 0,733 | 0,09 | 0,690 | 21,2 | 38 % | 83 % | 98 % | 53 % | 9,0 (5,3) | 1,29 | 1,81 | 5,3 s |
| Golden Gladiators/Silver Soldiers | **0,308** | 0,21 | 0,286 | **10,7** | 25 % | 33 % | 89 % | 56 % | **15,6 (8,7)** | 1,03 | 2,48 | 5,3 s |
| Mortal Sin/Natures Wrath | 0,588 | 0,21 | 0,786 | 13,3 | 29 % | 46 % | 84 % | 54 % | 11,8 (5,3) | 1,79 | 1,38 | 3,6 s |
| Pirate Crew/Raging Lunatics | 0,652 | 0,19 | 0,690 | 16,0 | 63 % | 88 % | 87 % | 37 % | 13,7 (6,7) | 1,33 | 1,33 | 3,1 s |

Drei Befunde, die zusammen die Spannweite erklären:

**(a) Die Kader selbst — Range Restriction.** rho folgt der Eignungs-Streuung fast linear
(SD 23 → 0,87, 21 → 0,73, 16 → 0,65, 13 → 0,59, 11 → 0,31). Golden Gladiators stellt
`62 62 57 56 55 52 43 28`: fünf Läufer innerhalb von zehn Punkten. Spearman über acht Werte
bestraft das gnadenlos, obwohl **die Mechanik Paare mit ≥ 15 Punkten Abstand auch dort zu
89 % richtig ordnet** und enge Paare überall auf Münzwurf-Niveau liegen (37–67 %), wie sie
sollen. Das ist derselbe Befund wie bei Hockey (CLAUDE.md: „Paare unter zwei Punkten Abstand
kann kein Motor der Welt ordnen"). Ein Teil der 0,559 ist also gar keine Eigenschaft von
Spurt, sondern der Preis dafür, aus 8–14 Spielern die vier besten zu nehmen — die liegen
naturgemäß eng.

**(b) Der Rempler — eine Interaktion, die am Kader hängt, nicht an der Eignung.** Ob
jemand tackelt, entscheidet `pers` (Persönlichkeit: Draufgänger 0,9, Bollwerk 0,25) und die
Schwelle WUCHT > 36 — ein Kader voller Draufgänger mit hohem Torment (Golden Gladiators:
15,6 Rempler, 8,7 erfolgreiche je Rennen bei acht Läufern) verwandelt das Rennen in eine
Prügelei. Ablation, kaderfest, sonst nichts geändert:

| Variante | Median rho/Spiel | Spannweite | Saison |
|---|---:|---:|---:|
| heute | 0,652 | 0,559 | 0,690 |
| Tackle aus | 0,710 | **0,371** | 0,738 |
| Windschatten aus | 0,714 | 0,480 | 0,881 |
| beides aus | 0,721 | 0,405 | 0,738 |

Der Rempler allein trägt rund ein Drittel der Spannweite. Er ist aber kein Fehler, sondern
Chris' ausdrücklicher Wunsch („wenn Lulu mehr Speed hat, müsste Gram die Hindernisse besser
wegräumen und öfter tackeln") — der Vorschlag unten dämpft ihn, statt ihn zu streichen.

**(c) Die Hürde als Münzwurf, siebenmal.** 1,0–1,9 Stürze und 1,3–2,5 Durchbrüche je Läufer
und Rennen heißen: von sieben Hürden werden nur drei bis vier sauber genommen. Jeder Läufer
würfelt drei- bis viermal je Rennen über 0,1 s (Durchbruch) bis 0,5 s (Sturz) — Ereignisse,
die zusammen ~0,7 s Zufall je Läufer stapeln, bei 0,4–0,6 s Abstand zwischen Nachbarn im
Ziel. **Es ist also kein einzelnes dominantes Ereignis**, sondern viele billige, deren Ausgang
kaum am Können hängt (54 % Gelingen bei TECHNIK 50, 60 % bei TECHNIK 60).

**Teilnehmerzahl.** Sechs je Seite: 0,644 / Spannweite 0,380 — die zusätzlichen Läufer sind
die schwächeren des Kaders, die Eignungs-SD steigt nicht. Zwei je Seite: 0,583 über vier
Läufer, SD je Spiel bis 0,56 — Spearman über vier Werte kann nur 25 diskrete Zustände
annehmen. Und **zwei je Seite ist der Normalfall**: `foundationSeedDisciplines` führt Spurt
mit `playerCount: 2` (`lib/data/dataAdapter.ts:59`), `buildSeasonPlayerCount` würfelt je
Saison ±1 um diesen Wert, geklemmt auf 2–6 (`season-discipline-schedule.ts:60–75`). Die
Stand-Tabelle misst Spurt bei vier je Seite, das echte Spiel fährt meist zwei bis drei.

### 1.4 Die zwei Spalten — Verlässlichkeit ist nicht das Problem

Mit der Formel aus CLAUDE.md, `rho(Spiel) = rho(Saison) · √Verlässlichkeit`:

| | rho/Spiel | rho/Saison | Verlässlichkeit |
|---|---:|---:|---:|
| heute | 0,652 | 0,690 | (0,652/0,690)² = **0,89** |
| Prototyp 6 (Abschnitt 3) | 0,857 | 0,905 | (0,857/0,905)² = **0,90** |

Die Verlässlichkeit ist heute schon hoch — die Rennen sagen sich gegenseitig gut voraus.
Sie sagen nur konsistent das Falsche (Wille/Entschlossenheit statt Hindernis-Attribute).
**Das ist ein Validitätsproblem, und es löst sich über das Rezept, nicht über die Uhr.** Der
Prototyp bestätigt es von der anderen Seite: die Validität stieg um 0,21, die Verlässlichkeit
blieb auf der zweiten Nachkommastelle stehen.

---

## 2. Was einen echten Hindernislauf auszeichnet — mit Quellen

### 2.1 Hürdensprint (110 m Hürden)

- Eine Hürdeneinheit dauert 1,05–1,10 s, die gleiche Strecke flach 0,85 s — **jede Hürde
  kostet ~0,2 s, immer, auch beim Weltmeister**; Flugzeit über der Hürde 0,31–0,35 s, in der
  niemand beschleunigt (Vorgänger-Recherche aus `iwasaki71/race_predict`, 151 Elite-Rennen,
  und World Athletics Biomechanical Report 110 m H, WM 2017).
- WM 2025 Finale: 12,99 / 13,08 / 13,12 / 13,16 / 13,18 / 13,31 / 13,42, ein DNF — **sieben
  Finalisten innerhalb von 0,43 s (3,3 %)** ([Wikipedia](https://en.wikipedia.org/wiki/2025_World_Athletics_Championships_%E2%80%93_Men%27s_110_metres_hurdles)).
  Unsere Zielspanne von 3–5 s auf ~11 s (30–45 %) ist zehnmal so weit.
- Eine gerissene Hürde hat keine Strafe — sie ist „self-penalizing", bremst und bricht den
  Rhythmus ([Hurdles First](https://hurdlesfirstbeta.com/free-articles/issues/penalties-hitting-hurdles/),
  [Wikipedia 110 m Hürden](https://en.wikipedia.org/wiki/110_metres_hurdles)). Das ist unser
  Durchbruch-Zweig — richtig gebaut, nur zu billig relativ zum Rest.

### 2.2 Hindernislauf (3000 m Steeplechase)

- Über 3000 m sind Steepler **typisch 30 s langsamer** als über 3000 m flach — bei 28
  Barrieren und 7 Wassergräben rund **0,85 s je Hindernis**, also ~6 % der Rennzeit
  ([Earl et al., PMC3761453](https://pmc.ncbi.nlm.nih.gov/articles/PMC3761453/)).
- Am Wassergraben verlieren Männer 18 %, Frauen 21 % ihres Renntempos (Austrittstempo 88 %
  bzw. 85 % des Tempos); **Anlauftempo und Landeweite erklären 82–84 % der Varianz** des
  Tempoerhalts (ebd.).
- Bessere Läufer springen früher ab (1,43 m gegen 1,34 m) und landen weiter (2,95 m gegen
  2,74 m); die Landeweite **ermüdet** über die Runden (2,95 → 2,76 m, Runde 1 → 7), die
  Absprungmechanik nicht ([Collegiate-Studie, n = 48, PMC10460561](https://pmc.ncbi.nlm.nih.gov/articles/PMC10460561/)).
  Ein Hindernis kostet also stetig Zeit, und der Preis steigt mit der Ermüdung — nicht ein
  Ja/Nein.

### 2.3 Obstacle Course Racing (Spartan Race)

- Prädiktoren der Finishzeit (n = 32): anaerobe Leistung (Wingate, β −6,47), Laufzeit über
  eine Meile (β +6,43), Tragekraft (Eimertragen, β −0,04); Griffkraft korreliert mit der
  Platzierung ([Human Movement 2020](https://hummov.awf.wroc.pl/Predictors-of-obstacle-course-racing-performance,113299,0,2.html),
  aus der Vorgänger-Recherche; [MDPI Applied Sciences 14:9604](https://doi.org/10.3390/app14209604)
  nennt für Spartan-Läufer Unterkörper-Explosivität und Lungenkapazität als Träger, Oberkörper-
  Ermüdung als Bremse — Volltext beide hinter 403/503, Zahlen aus Abstract/Suchergebnis).
- **Ein verfehltes Hindernis ist eine Zeitstrafe, kein Ausscheiden:** 30 Burpees (Stadion:
  15), rund 1,5–3 Minuten ([Spartan-Regeln](https://spartanrace.zendesk.com/hc/en-us/articles/203602743-Official-Rules-Guidelines-and-Penalties-for-Spartan-Race-Obstacles));
  Monkey Bars und Speerwurf gelten als die häufigsten Ausfälle (Spartan-FAQ, anekdotisch).
- Feld: Spartan World Championship 2022, Männer 1:03:47 / 1:03:59 / 1:06:49 — der Zweite
  0,3 % zurück, der Dritte 4,7 % ([Spartan](https://shop.spartan.com/blogs/unbreakable-race-stories/2022-spartan-world-championship-elite-results)).

### 2.4 Ninja Warrior / Sasuke

- ANW 2021, Stage 1 (68 Starter, 9 Hindernisse): **84 % überstehen das erste Hindernis, die
  50-%-Marke fällt zwischen Hindernis 5 und 7**; Schwinging Blades (Nr. 2) und Thread the
  Needle (Nr. 8) die häufigsten Ausfälle ([SCORE, Kaplan-Meier](https://modules.scorenetwork.org/obstacle_competitions/american_ninja_warrior/)).
  Hourglass Drop (Balance) warf 29 von 36 ab ([Sasukepedia](https://sasukepedia.fandom.com/wiki/Hourglass_Drop)).
- Sasuke: 100 Starter, 10–15 % schaffen Stage 1, 6 Gesamtsiege in 43 Turnieren; einzelne
  Hindernisse haben hohe Gelingquoten (Quad Steps 95,6 %) — **die Auslese kommt aus der
  Kette** (Vorgänger-Recherche, 5.1). ANW: 225 verschiedene Hindernisse, Warped Wall 86-mal
  ([Reed anwObstacles](https://www.reed.edu/math-stats/241/2020/03/24/anwobstacles/)).
- Fähigkeitsprofil: es gibt **keine peer-reviewte Studie** zu Ninja-Athleten — nur
  Trainingsseiten, die Griffkraft und 15+ Klimmzüge als Eintrittskarte nennen. Die Community
  selbst kritisiert, dass „jedes zweite Hindernis" Oberkörper/Griff ist und Stage 1 als
  einziger Abschnitt Parkour und Beinkraft prüft ([Sasuke Maniac Forum](https://sasukemaniac.proboards.com/thread/5876/american-ninja-warrior-upper-orientated)).

### 2.5 Welche Fähigkeiten zählen — und wo sie in der Matrix stehen

| Fähigkeit (Sport) | Hindernis-Typ | Attribute bei uns | Spurt-Matrix |
|---|---|---|---|
| Explosivität, Sprung (Wand, Graben, Warped Wall) | Wand, Wassergraben | power, speed | 10, 18 |
| Griff-/Hängekraft (Monkey Bars, Seil, Cliffhanger) | Hangeln, Seil | power, stamina, determination | 10, 4, 15 |
| Balance/Koordination (Steps, Balken, Hourglass) | Balken/Steg | dexterity, awareness | 12, 7 |
| Ausdauer (Streckenlänge, Kette) | alle, kumulativ | stamina, health | 4, 6 |
| Risikobereitschaft (forsch = schnell, aber Sturz) | jedes | torment | 14 |
| Nervenstärke (nach dem Sturz weiter) | Wiederaufstehen | will, determination | 14, 15 |
| Technik/Lesen (Rhythmus, Linie) | Hürde, Balken | awareness, intelligence | 7, 0 |

**Die Matrix beschreibt bereits einen Hindernislauf** (torment + dexterity + power = 36 %,
Speed nur 18 — bei einem Sprint stünde Speed über 30). Der Motor löst sie nicht ein. Das
Rezept muss also nicht die Matrix ändern, sondern den Hindernissen Kanäle geben, in denen
diese drei Attribute Zeit kosten oder bringen.

---

## 3. Rezeptvorschlag — mit Zahlen, nachgemessen

### 3.1 Das Prinzip: Hindernis als Zeitpreis, an jedem Hindernis, typabhängig

Real kostet jedes Hindernis Zeit, immer (Hürde 0,2 s, Steeple-Barriere 0,85 s, Wassergraben
12–15 % Tempo); der Ausfall ist der seltene Zusatz. Bei uns ist es umgekehrt: null oder
Sturz. Der Vorschlag dreht das um — **an jedem Hindernis ein Stopp, dessen Dauer der
Sub-Skill des Hindernis-Typs bestimmt**; die bestehende Technik-Wucht-Sturz-Kette bleibt als
Ausfall obendrauf.

```
// BAHN_ART.spurt
hindernisTypen: ["TECHNIK","WENDIGKEIT","WUCHT","GRIFF","ANTRITT","WUCHT","TECHNIK"],
                // Hürde, Balken, Wand, Hangeln, Graben, Wand, Hürde — eine je hindernisse[i]
huerdePreis: 1.00,   // Sekunden Stopp bei Skill 0

// stepSpurt, am Hindernis (vor dem technik-Wurf):
u.huerde = Math.max(u.huerde||0, A.huerdePreis * (1 − 0.8 · u[typ]/100));
//   Skill 20 → 0,84 s, Skill 50 → 0,60 s, Skill 80 → 0,36 s
// tempoVon: · (u.huerde>0 ? 0 : 1)   — voller Stopp; u.huerde läuft je Tick ab wie stolper
```

Warum genau diese Steigung: die Spanne zwischen Skill 20 und 80 muss je Hindernis ~0,48 s
betragen, damit sieben Hindernisse (~3,4 s) dieselbe Größenordnung erreichen wie die
Laufzeit-Spanne (2,5–3 s). Ein flacherer Preis wirkt **nicht** — nachgemessen an vier
Zwischenstufen (Abschnitt 3.5): 0,3 s Preis nur beim Gelingen bewegte Dexterity von 3,5 auf
4,3 %, 0,9 s Preis nur beim Gelingen auf 2,0 %. Erst der Preis an jedem Hindernis mit
steiler Kurve hebt Dexterity auf 16,7 %.

### 3.2 Die sieben Stationen und ihre Sub-Skills

| # | Position | Hindernis | Sub-Skill (Preis) | Ausfallpfad (heute schon da) | Bild |
|---|---|---|---|---|---|
| 1 | 0,14 | Hürde | TECHNIK | Technik → Wucht → Sturz | Holzzaun (fence_medieval) |
| 2 | 0,26 | Balken/Steg | WENDIGKEIT | wie Hürde, Sturz = „ins Wasser" | Brückenplanke (Xenodora) über Wasserkachel |
| 3 | 0,38 | Wand | WUCHT | Technik → Wucht (drüber) → Sturz (abrutschen) | Palisade (fence_medieval) |
| 4 | 0,50 | Hangeln/Seil | **GRIFF** (neu) | Sturz = loslassen, +Reserve-Kosten | Strickleiter (fence_medieval), quer gelegt |
| 5 | 0,62 | Wassergraben | ANTRITT | Sturz = kurz nass, Reserve −8 | Wasserkachel (terrain-v7) |
| 6 | 0,74 | Wand | WUCHT | wie 3 | Steinmauer (fence_medieval) |
| 7 | 0,86 | Hürde/Strohballen | TECHNIK | wie 1 | Strohballen (decorations-medieval) |

Zwei Wände statt einer, damit WUCHT (torment 55, power 42) zwei von sieben Preisen trägt —
im Prototyp mit nur einem Wand-Typ je drei blieben Torment und Power bei ~4 % (Abschnitt 3.5);
das ist der eine Kanal, den die Umsetzungsrunde noch nachziehen muss. Zusätzlich kann der
Durchbruch-Zweig an der Wand **Zeit bringen** statt kosten (wer durchbricht, hat den Preis
schon bezahlt — `u.huerde` auf die Hälfte), dann zahlt Wucht doppelt.

### 3.3 Das Rezept — acht Sub-Skills

Ein achter Sub-Skill GRIFF ist im Chassis gratis: `spurtWerte()` iteriert über die Schlüssel
von `rezept`, `SPURT_KEYS` wird daraus gelesen. Gewichte, an die Matrix gebunden (Summe
über alle acht ≈ Matrix, wie beim heutigen Rezept, Abweichung nachrechnen mit
`messe-arena-einfluss`):

```
ANTRITT:    {speed:45, power:35, determination:20}         // Graben, Start
ENDTEMPO:   {speed:40, will:30, determination:20, stamina:10}
TECHNIK:    {dexterity:50, awareness:30, determination:20}  // Hürde
WENDIGKEIT: {dexterity:45, awareness:35, speed:20}          // Balken, Spurwechsel
STEHEN:     {determination:40, will:35, health:25}          // Ermüdung, Nerven
WUCHT:      {torment:50, power:40, determination:10}        // Wand, Rempler
GRIFF:      {power:40, stamina:30, determination:30}        // Hangeln — neu
ROBUST:     {health:28, torment:24, will:20, dexterity:18, awareness:10}
```

Torment bleibt bewusst in WUCHT und ROBUST und bekommt keinen dritten Platz: Risikobereitschaft
soll den Wand-Preis senken **und** über den bestehenden Rempler wirken — nicht überall
mitlaufen, sonst „gewinnt ein Attribut, das überall mitzählt, immer" (Kommentar `:14485`).

### 3.4 Die drei Begleitänderungen

1. **Rempler dämpfen, nicht streichen:** `tackleAb 36 → 50`, `tackleRate 2,4 → 1,0`.
   Gemessen fallen die Rempler von 9–16 auf 3–8 je Rennen (Golden Gladiators bleibt mit
   9–13 der Ausreißer — dort sind alle acht Draufgänger). Zusätzlich: **kein Rempler,
   solange einer der beiden im Hindernis steht** (`u.huerde>0 || o.huerde>0`), sonst wird
   der Stopp an der Wand zum Freiwild.
2. **Ermüdung halbieren:** `muedGrad 0,00028 → 0,00014`. Wille/Entschlossenheit fallen
   damit von 54 % auf 38 % Einfluss — noch über der Matrix (29), aber die beiden tragen ja
   auch STEHEN, das an den Nerven nach einem Sturz hängen soll.
3. **Reserve nachziehen:** mit Stopps dauert das Rennen länger, und während des Stopps läuft
   `zehr` weiter — im Prototyp brachen bei Chris' Kader 2,25 Läufer je Rennen ein (heute
   1,0). Entweder `kraftBasis 265 → ~320` oder `zehr · 0,4` solange `u.huerde > 0` (Celestes
   „Hängen kostet ein Fünftel", Vorgänger-Recherche 4.2). Das ist Kalibrierung, keine
   Mechanik; sie gehört in die Umsetzungsrunde mit Korridor-Messung.

Nicht anfassen: `tempoSpanne 0,95`. Der Versuch, die Laufzeit-Spanne auf 0,50 zu drücken,
bevor die Hindernisse zahlen, **verschlechterte** den Median (0,740 → 0,656) — er hob den
Rausch-Anteil der Hürdenwürfe. Erst wenn die Hindernisse tragen, lässt sich die Spanne
Richtung der realen 3–5 % ziehen; das ist ein zweiter, eigener Schritt.

### 3.5 Die Messreihe — was jede Stufe gebracht hat

Kaderfest, n = 24, vier je Seite, sonst wie `origin/main`. Prototypen kumulativ (P2 enthält
P1 usw.), Patches im Anhang B:

| Stufe | Änderung | Median rho/Spiel | Spannweite | Saison | dex / torment / power (Einfluss) |
|---|---|---:|---:|---:|---|
| heute | — | 0,652 | 0,559 | 0,690 | 3,5 / 2,7 / 2,4 % |
| Ablation | Tackle aus | 0,710 | 0,371 | 0,738 | — |
| P1 | Grundpreis 0,3 s **nur beim Gelingen**, Faktor 0,55 | 0,691 | 0,511 | 0,762 | — |
| P2 | + Rempler gedämpft (Ab 50, Rate 1,0) | 0,685 | 0,437 | 0,690 | — |
| P3 | + Ermüdung halbiert | 0,725 | 0,471 | 0,762 | 4,3 / 4,4 / 3,9 % |
| P4 | + drei Typen, Preis 0,9 s (nur Gelingen), tempoSpanne 0,50 | 0,656 | 0,615 | 0,738 | 2,0 / 4,1 / 4,5 % |
| P5 | wie P4, tempoSpanne 0,95 | 0,740 | 0,502 | 0,762 | — |
| **P6** | **Preis an JEDEM Hindernis, voller Stopp, 1,0·(1−0,8·Skill/100)** | **0,857** | **0,286** | **0,905** | **16,7 / 3,6 / 3,8 %** |

P6 je Kader (vier je Seite): Vigilante 0,898 (Star auf 1: 100 %), Cold Steel 0,860 (83 %),
Golden Gladiators 0,612 (13 % — die fünf Gleichen bleiben ununterscheidbar, Paare ≥ 15
trotzdem 99 %), Mortal Sin 0,857 (63 %), Pirate Crew 0,753 (67 %). Einfluss-Abweichung
62,6 → 38,9 Pp; Awareness 3,2 → 11,7 %.

P6 bei anderer Kadergröße (dieselbe Abnahmeform wie Gewichtheben, Plan 8.1):

| je Seite | Läufer | Median rho/Spiel | Spannweite | Saison | Paare ≥ 15 richtig |
|---|---:|---:|---:|---:|---:|
| 2 | 4 | 0,700 | 0,235 | 0,800 | 85–100 % |
| 4 | 8 | 0,857 | 0,286 | 0,905 | 93–100 % |
| 6 | 12 | 0,849 | 0,178 | 0,867 | 93–100 % |

Bei vier Läufern ist Spearman strukturell auf 0,7–0,8 gedeckelt (vier Ränge, ein
vertauschtes Paar kostet 0,2–0,4); die 0,700 dort sind ehrlicher als Paartreue (85–100 %)
und Star in Top 2 (79–100 %) zu lesen. Heute liegt dieselbe Messung bei 0,583 mit Star in
Top 2 79–100 % — der Sprung bei zwei je Seite ist also +0,12, nicht +0,2.

### 3.6 Kosten und Nutzen: Rezept-Fix im Bahn-Chassis oder eigenes Chassis?

**Rezept-Fix plus kleine Chassis-Erweiterung — kein eigenes Chassis.** Begründung:

- Das Bahn-Chassis hat alles, was ein Hindernislauf braucht: Hindernisorte, die
  Technik-Wucht-Sturz-Kette, Kraftreserve, Kamera, Pläne, Rennplan-Ansage, Schwebetexte. Was
  fehlt, sind **zwei Datenfelder** (`hindernisTypen`, `huerdePreis`) und **drei Zeilen Motor**
  (`u.huerde` setzen, abzählen, in `tempoVon` nullen). Der Prototyp ist genau das, und er
  besteht.
- Die Erweiterung ist generisch: `hindernisTypen` mit einem einzigen Eintrag verhält sich wie
  heute (Preis 0 = heutiges Verhalten, bit-identisch für die vier anderen Bahnen, solange sie
  kein `huerdePreis` führen). Climbing (0,790, „Griff" ohne Preis) und Takeshi (0,697,
  vierzehn Fallen als Münzwurf) sind dieselbe Krankheit — beide könnten dieselbe Zeile
  nutzen, ohne dass Spurt es weiß.
- Ein eigenes Chassis (wie Gewichthebens `spieleBuehneHeben`) lohnt erst, wenn die Optik
  etwas anderes zeigen soll als eine Bahn mit Stationen — etwa einen Ninja-Parcours von der
  Seite mit Sprung- und Hangel-Animation. Das ist eine Bild-Entscheidung, keine
  Rangtreue-Entscheidung, und sie kann später kommen.

Aufwand, geschätzt:

| Schritt | Umfang | Messung danach |
|---|---|---|
| U1: `hindernisTypen`/`huerdePreis` im Chassis, P6-Patch in `BAHN_ART.spurt`, GRIFF-Sub-Skill, Rempler-Sperre im Hindernis | ~40 Zeilen, ½ Tag | `miss-alle-disziplinen 24 spurt` bei `--je-seite=2/4/6`; alle anderen Bahnen bit-identisch |
| U2: Kalibrierung — Reserve, zwei Wände, Durchbruch als Zeitgewinn, Einfluss gegen Matrix (Ziel < 30 Pp; Torment/Power ≥ 8 %) | ½ Tag | `messe-arena-einfluss spurt 48`; Korridor Zielspanne/Einbrüche |
| U3: Optik — sieben Stationen als Kacheln statt drei Striche (Abschnitt 4) | 1 Tag | Sichtprüfung |
| U4: Basislinie neu bauen (`baue-rangtreue-basislinie.mjs`), Stand-Doku nachziehen | ¼ Tag | CI grün |
| später: Produktivierung (`ARENA_RESOLVED_DISCIPLINE_IDS`, eigene PPS-Referenz) | eigener Auftrag wie bei Hockey | — |

---

## 4. Assets — was da ist, was fehlt

Geprüft: `public/sprites/baukasten/quellen.json` (138 Einträge — ausschließlich Charakter-
Ebenen, Waffen und Köpfe; nichts Streckenartiges), `public/sprites/arena/` (Bahn: `bahn_ocker`,
`rasen`, `zaun_holz`, `baum_1..4`; Arena: `boden_sand`, `mauer_ziegel`, `fackel`), und die
**Originalpakete**, aus denen `scripts/arena-assets-schneiden.mjs` diese Kacheln schneidet —
OpenGameArt ist aus der Umgebung erreichbar (200), beide Zips frisch geholt und angesehen.

**Heute** zeichnet `bodenSpurt()` (`engine.js:14313–14334`) jede Hürde als zwei graue
Pfosten mit weißer Latte, dieselbe Form auf allen Bahnen, und kennt nur drei Wörter (Hürde,
Kurve, Griff). Ein Hindernislauf mit sieben verschiedenen Stationen braucht sieben Formen —
und die Simulation muss `hindernisTypen[i]` an die Zeichnung weiterreichen, nichts weiter.

**Was in den bereits heruntergeladenen Paketen liegt** (Lizenz und Urheber stehen schon in
`public/sprites/arena/HERKUNFT/`, es kommt kein neuer Credit dazu):

| Station | Blatt | Was drin ist (gesichtet) |
|---|---|---|
| Hürde | `fence_medieval.png` (decoration_medieval.zip, 512×1024) | Holzzäune mit Querlatten in vier Bauarten, einzelne Pfosten — als Hürde eine Latte hoch |
| Wand | ebd. | **Palisaden** (Rundholz, mit/ohne Spitzen), Bretterwand, Tor; **Steinmauer** grau mit Zinnen, Bruchsteinmauer |
| Seil / Hangeln / Netz | ebd., oben rechts | **Strickleiter** (gelbes Seil, Holzsprossen) — quer gelegt eine Hangelstrecke, hochkant ein Netz |
| Strohballen | `decorations-medieval.png` (512×2048) | Rund- und Quaderballen, Heuhaufen |
| Baumstamm | ebd. | Holzstapel, einzelne Stämme, Sägeböcke |
| Feuersprung | ebd. | Lagerfeuer in mehreren Stufen (Animation möglich) |
| Speerwurf (Spartan) | ebd. | Zielscheibe auf Ständer, Speere/Pfeile im Köcher |
| Wassergraben | `terrain-v7.png` (lpc-terrains.zip, 1024×2048) | Wasser als Wang-Kacheln, Schlamm/Erde, Ufer — der Schneide-Bericht erwähnt die Wasserkachel bereits (zweimal irrtümlich als Sand gewählt) |

**Was fehlt:**

- **Balken/Steg:** in beiden Paketen keine schmale Planke. Kandidat:
  [LPC style wood bridges and steel flooring](https://opengameart.org/content/lpc-style-wood-bridges-and-steel-flooring)
  (Xenodora, CC-BY-SA 3.0 / GPL 3.0 / GPL 2.0, 32×32, Dateien `bridge-wood-square.png`,
  `railing-wood-16x32.png`) — eine Planke über der Wasserkachel ergibt den Steg; Credit
  „Xenodora" muss in `HERKUNFT/` dazu.
- **Hangelstange (Monkey Bars):** keine LPC-Quelle gefunden. Entweder die Strickleiter quer
  (reicht optisch), oder zwei Pfosten mit Stange gezeichnet wie heute die Hürde.
- **Bewegungen:** die Läufer können `run`, `walk`, `hurt` (Sturz) — aber **weder springen
  noch klettern noch hängen**. Im LPC-Satz gibt es dafür `jump` und `climb` aus
  „LPC Expanded: sit, run, jump, more" (ElizaWy, OGA-BY 3.0 — dieselbe Quelle, aus der
  `sw_bg/sw_fg` stammen, s. `quellen.json`), allerdings nur für Körper und Kopf, nicht für
  Rüstung/Waffen (dieselbe Lücke wie bei `run`, README Baukasten). Für die erste Runde reicht
  der Stopp im `run`-Frame plus Schwebetext („über die Wand", „hangelt"); Sprung/Kletter-
  Blätter sind ein eigener Sprite-Auftrag mit Sichtprüfung je Ebene.
- **Boden:** die Grasbahn passt; ein Ninja-Parcours (Halle, Bühne) wäre ein anderes Bild und
  ein anderes Chassis — s. 3.6, erst nach Chris' Antwort auf Frage 1.

Aufwand Assets: sieben bis neun Kacheln über `arena-assets-schneiden.mjs` (Koordinaten
einmal messen, wie beim Sand), ein Eintrag je Kachel in `quellen.json`, eine `switch` über
`hindernisTypen[i]` in `bodenSpurt()`. Ein Tag inklusive Sichtprüfung in echter Pixelgröße.

---

## 5. Offene Fragen an Chris

1. **Ist Spurt ein Hindernislauf oder ein Hürdensprint?** Die Matrix (torment 14, dex 12,
   power 10, speed nur 18) sagt Hindernislauf; der heutige Motor spielt Hürdensprint. Der
   Vorschlag folgt der Matrix. Wenn Spurt ein 110-m-Hürden-Rennen bleiben soll, ist der
   Hebel viel kleiner (0,2 s Grundpreis, Rempler dämpfen — Median vermutlich um 0,72).
2. **Sieben Stationen so in Ordnung?** Hürde, Balken, Wand, Hangeln, Graben, Wand, Hürde —
   und passen Wassergraben und Feuer ins Weltenbild (Konstrukte, Untote, Aqua-Rasse)?
3. **Achter Sub-Skill GRIFF** (power/stamina/determination) — oder soll Hangeln über WUCHT
   laufen, damit es bei sieben Werten bleibt?
4. **Rempler behalten?** Vorschlag ja, gedämpft und nie im Hindernis. Wenn er weg soll,
   liefert das allein +0,06 Median und −0,19 Spannweite, kostet aber Gram seinen Auftritt.
5. **Abnahme bei zwei je Seite:** `playerCount: 2` ist der Normalfall. Soll die Schranke
   dort weiter rho > 0,80 heißen (über vier Läufer kaum erreichbar) oder Paartreue ≥ 15
   Punkte > 90 % und Star in Top 2 > 80 %, wie es CLAUDE.md für Hockey schon vorschlägt?
6. **Slots:** der Motor kennt vier Spurt-Slots, `matchday-slot-roles.ts` sechs
   (drivephase, photofinish fehlen im Motor). Sollen die Stationen an Slots hängen
   („Wandläufer" bekommt an der Wand einen Zuschlag), oder bleibt der Slot nur Aufschlag
   und Plan wie heute?
7. **Optik:** reicht die Bahn mit sieben Stationen, oder soll Spurt wie Basketball/Hockey ein
   eigenes Bild bekommen (Ninja-Parcours von der Seite)? Das entscheidet über ein eigenes
   Chassis — nicht die Rangtreue.

---

## 6. Was geprüft wurde — und was nicht

Gemessen (Playwright/Chromium 1223 headless gegen `file://`-Kopien, alle Skripte aus dem
Repo, Scratchpad-Sonde in Anhang A):

- `node scripts/miss-alle-disziplinen.mjs 24 spurt` gegen `origin/main`: 0,652 / 0,559 /
  0,690 / 0,643 — bit-identisch zu Basislinie und Stand-Doku.
- Eigene Sonde je Kader-Variante (rho, SD, Eignungs-Streuung, Star-Quote, Paartreue,
  Ereigniszahlen über ein um vier Felder erweitertes `bahnLauf`) — Original, drei Ablationen,
  sechs Prototypen, je bei 4 je Seite; Original und P6 zusätzlich bei 2 und 6.
- `node scripts/messe-arena-einfluss.mjs spurt 48 <kopie>` für Original, P3, P4, P6.
- OpenGameArt: `decoration_medieval.zip` und `lpc-terrains.zip` geholt, entpackt, beide
  Dekorationsblätter als Bild gesichtet; Terrain nur über Größe und die Schneide-Doku.

Nicht geprüft:

- Ob P6 die anderen vier Bahnen bit-identisch lässt — der Prototyp setzt `huerdePreis` nur
  in Spurt und liest `A.huerdePreis??0`, also erwartungsgemäß ja, aber nicht gemessen.
- Die Reserve-Kalibrierung (3.4, Punkt 3) — im Prototyp bewusst nicht nachgezogen, damit
  die Rangtreue-Bewegung allein an der Hindernis-Änderung hängt.
- Sprung-/Kletter-Blätter aus „LPC Expanded" — nicht heruntergeladen, nur die Quelle
  benannt.
- Volltexte hinter 402/403/503 (Sasukepedia, MDPI, Human Movement, ResearchGate) —
  Zahlen aus Abstracts, Suchergebnissen und der Vorgänger-Recherche, so gekennzeichnet.

---

## Anhang A — die Sonde

`diag-spurt.mjs <html> [n] [jeSeite] [label]` — lädt `kaderfamilie-live-save.json`, ruft
`window.__arena.disziplinProbe("spurt",{n,kaderFamilie,jeSeite})`, rechnet je Variante mit
`scripts/lib/rangtreue-messung.mjs` (dieselbe Spearman-Formel wie die CI): rho je Spiel und
dessen SD, rho Saison, Eignungen des ersten Spiels (Spanne, SD), Star-Quote (Eignungsbester
auf Platz 1 / Top 2), Paartreue für Paare ≥ 15 und < 3 Eignungspunkte; danach je Variante
n Läufe über `bahnLauf` für Zielspanne, Einbrüche, Sog-Anteil, Rempler, Stürze, Durchbrüche.
Dafür wurde in den Kopien die Rückgabe von `bahnLauf` um `tackles, getackelt, gestolpert,
durchbruch` ergänzt — reine Diagnosefelder, die eine Umsetzungsrunde sinnvollerweise in den
Motor übernimmt (drei Zeilen bei `engine.js:18079`).

## Anhang B — die Patches der Prototypen (zeichengenau, gegen `origin/main`)

**Ablationen:** in `BAHN_ART.spurt` `tackle:false` bzw. `schatten:false`.

**P1 (Grundpreis nur beim Gelingen):**
```
stepSpurt, nach `if(u.stolper>0)u.stolper-=dt;`:      if(u.huerde>0)u.huerde-=dt;
Hürdenblock: if(rr()<=technik)continue;   →   if(rr()<=technik){ u.huerde=Math.max(u.huerde||0,(A.huerdePreis??0)*(1-0.6*u.TECHNIK/100)); continue; }
tempoVon, Rückgabe:                        … *(u.huerde>0?0.55:1);
BAHN_ART.spurt:                            huerdePreis:0.30,
```
**P2:** + `tackleAb:50, tackleRate:1.0`. **P3:** + `muedGrad:0.00014`.

**P4/P5 (Typen):**
```
Hürdenblock, vor dem Wurf:
  const hTyp=(A.hindernisTypen||["TECHNIK"])[HUERDEN_N().indexOf(h)%((A.hindernisTypen||[1]).length)];
  const hSkill=u[hTyp]||0;
  if(rr()<=technik){ u.huerde=Math.max(u.huerde||0,(A.huerdePreis??0)*(1-0.6*hSkill/100)); continue; }
BAHN_ART.spurt: huerdePreis:0.90, hindernisTypen:["TECHNIK","WUCHT","WENDIGKEIT"],
P4 zusätzlich: grundTempo:110, tempoSpanne:0.50   (P5 ohne diese Zeile)
```

**P6 (der Vorschlag):** wie P5, aber
```
  u.huerde=Math.max(u.huerde||0,(A.huerdePreis??0)*(1-0.8*hSkill/100));   // VOR dem technik-Wurf, an jedem Hindernis
  if(rr()<=technik)continue;
tempoVon: *(u.huerde>0?0.0:1);
BAHN_ART.spurt: huerdePreis:1.00
```

## Quellen

- Ward-Smith & Radford 2002; World Athletics Biomechanical Report 110 m H; `iwasaki71/race_predict` — Hürdeneinheiten, über `docs/design/bahn-disziplinen-recherche-fable.md`
- [2025 WM 110 m Hürden, Finale](https://en.wikipedia.org/wiki/2025_World_Athletics_Championships_%E2%80%93_Men%27s_110_metres_hurdles); [Hurdles First: Penalties](https://hurdlesfirstbeta.com/free-articles/issues/penalties-hitting-hurdles/); [Wikipedia 110 m Hürden](https://en.wikipedia.org/wiki/110_metres_hurdles)
- [Earl et al., Steeplechase Water Jump, PMC3761453](https://pmc.ncbi.nlm.nih.gov/articles/PMC3761453/); [Collegiate 3000 m SC Water Jump, PMC10460561](https://pmc.ncbi.nlm.nih.gov/articles/PMC10460561/)
- [Predictors of OCR performance, Human Movement 2020](https://hummov.awf.wroc.pl/Predictors-of-obstacle-course-racing-performance,113299,0,2.html); [MDPI Applied Sciences 14:9604](https://doi.org/10.3390/app14209604); [Spartan Obstacle Rules](https://spartanrace.zendesk.com/hc/en-us/articles/203602743-Official-Rules-Guidelines-and-Penalties-for-Spartan-Race-Obstacles); [Spartan WC 2022 Results](https://shop.spartan.com/blogs/unbreakable-race-stories/2022-spartan-world-championship-elite-results)
- [SCORE: ANW Kaplan-Meier](https://modules.scorenetwork.org/obstacle_competitions/american_ninja_warrior/); [Reed anwObstacles](https://www.reed.edu/math-stats/241/2020/03/24/anwobstacles/); [Sasukepedia: Hourglass Drop](https://sasukepedia.fandom.com/wiki/Hourglass_Drop); [Sasuke Maniac Forum](https://sasukemaniac.proboards.com/thread/5876/american-ninja-warrior-upper-orientated)
- [LPC Medieval Village Decorations](https://opengameart.org/content/lpc-medieval-village-decorations); [LPC Terrains](https://opengameart.org/content/lpc-terrains); [LPC wood bridges (Xenodora)](https://opengameart.org/content/lpc-style-wood-bridges-and-steel-flooring); [LPC Expanded sit/run/jump (ElizaWy)](https://opengameart.org/content/lpc-expanded-sit-run-jump-more)

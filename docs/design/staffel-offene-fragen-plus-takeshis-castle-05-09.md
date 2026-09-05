# Staffel: die offenen Fragen entschieden — und Takeshi's Castle nachgemessen (Fable, 05.09.2026)

Stand `ee2ac733` (`origin/main`, 05.09., nach PR #791/#793/#794/#795). Reine Recherche und
Planung: **keine Zeile am Motor geändert**, die einzige Datei dieses Branches ist dieser
Bericht. Alle Vorher/Nachher-Zahlen stammen aus **Kopien** von `public/mockups/` im Scratchpad,
gepatcht und mit derselben kaderfesten Methode gemessen wie `scripts/miss-alle-disziplinen.mjs`
(`scripts/lib/rangtreue-messung.mjs`, fünf echte Kader-Paarungen aus
`data/generated/kaderfamilie-live-save.json`, n = 24). Die unveränderte Kopie reproduziert die
eingecheckte Takeshi-Basislinie **bit-identisch** (0,697 / 0,170 / 0,839 / 0,196). Die
Patches stehen wörtlich im Anhang.

Chris' Ansage (05.09., später am Tag): „mach weiter mit den 3 offenen was gameplay usw angeht,
suche wieder im netz, lass fable das planen […] und mach dann weiter mit den nächsten 3 diszis"
— eine Freigabe, die sechs Fragen aus `staffel-modellierung-recherche-05-09.md` Teil 6 **selbst
zu entscheiden**, nicht sie erneut zu stellen. Genau das tut dieses Dokument.

---

## 0. Die Antwort in sechs Sätzen

1. **Fünf der sechs Staffel-Fragen sind entschieden, keine erfordert noch eine Motoränderung
   an der Staffel** (Teil 1). Kein echtes DNF, keine variablen Beinlängen, kein Konstanz-Stat,
   KI-Reihenfolge bleibt, Zweier-Staffel bleibt zulässig; `playerCount` bleibt 3 — weil die
   Saisonlogik die Basiszahl **ausschließt** statt sie zu bevorzugen, und das ist ein
   Befund für alle zwanzig, nicht für die Staffel (1.5).
2. **Frage 1 (Eignungskopplung auch für Spurt/Takeshi) hat sich für Spurt anders erledigt**
   — PR #794 hat den Hindernislauf gebaut (`hindernisTypen`/`huerdePreis`), ohne Kopplung,
   0,652 → 0,857. Für Takeshi war sie noch offen und ist jetzt **gemessen**: die Kopplung
   allein tut **nichts** (0,697 → 0,689), weil sie das Niveau aller sieben Sub-Skills um elf
   Punkte senkt und Takeshis Nerven- und Kraftbudget absolute Konstanten sind (2.4).
3. **Takeshi hat nicht die Staffel-Krankheit, sondern die Spurt-Krankheit.** Das Rezept-Mittel
   ordnet die Läufer zu 0,93 wie die Eignung (Staffel vorher: 0,78) — die Decke sitzt nicht
   zwischen Rezept und Matrix. Sie sitzt in vierzehn Fallen als Münzwurf (56 % sauber bei
   TECHNIK 70, Gelingen kostet nichts) und in einer **verkehrten Ausscheide-Ordnung**: wer
   früher rausfliegt, wird besser platziert als wer später rausfliegt (2.2).
4. **Der Fix ist derselbe wie beim Spurt, plus eine Zeile:** Fallen-Zeitpreis aus dem Chassis
   (nur Konfiguration in `BAHN_ART["takeshis-castle"]`, kein Motor) und Ausgeschiedene nach
   zurückgelegter Strecke ordnen. Gemessen kaderfest **0,697 → 0,878** (Spannweite 0,170 →
   0,096), Star auf Rang 1 50 % → 79 %, Paare ≥ 15 Punkte 92,5 % → 98,4 %. Mit der
   Eignungskopplung obendrauf — aber erst dann, und mit nachgezogenen Budgets — **0,896**,
   Validität 0,839 → **0,965**, Star 96 %. Bei zwei, drei und fünf je Seite (die Größen, die
   der Saisonplan wirklich würfelt) 0,90 / 0,91–0,92 / 0,86–0,90 (3.4).
5. **Die übrigen 19 Disziplinen sind bit-identisch** — vollständig nachgemessen, alle zwanzig,
   für beide Kandidaten (3.5). Die Arena-Werte weichen dabei von der Basislinie vom 04.09. ab
   (TDM 0,113 → 0,253, Mini-DM 0,269 → 0,094, Battlefield 0,325 → 0,387) — das ist der
   heutige `main`, nicht dieser Patch: die unveränderte Kopie liest exakt dieselben Werte. Die
   Basislinie muss ohnehin neu gebaut werden (4).
6. **Was das echte Format sagt** (Teil 2.5): Takeshi's Castle ist eine Ausscheide-Kaskade
   (86–142 Starter, ~8 Spiele, 8–9 Sieger in 133 Folgen), Wipeout bepreist Fehler mit **Zeit**
   statt mit Ausscheiden (24 → 12 nach Zeit; wer scheitert, schwimmt weiter). Für eine
   Rangtreue über zwölf Läufer ist das Wipeout-Modell das richtige Grundgerüst — und das
   Takeshi-Ausscheiden bleibt als Drama obendrauf (nach dem Vorschlag 30 % je Rennen statt 20).

---

## 1. Die fünf übrigen Staffel-Fragen — Entscheidung und Begründung

Frage 1 (Kopplung auf andere Bahnen) ist Teil 2/3 dieses Berichts. Hier die anderen fünf,
jede mit einer Entscheidung, keine mit einer Rückfrage.

### 1.1 Frage 2 — Echtes DNF in der Staffel? **Nein.**

Real scheiden 21 % der Männerstaffeln in WM/Olympia-Finals aus (Zarębska 2021). Der halbierte
Patzer (K3, `WECHSEL_PATZER` 0,11, gemergt in #793) liegt mit ≈ 4,5 % je Wechsel genau in dieser
Größenordnung — nur mild (0,5–0,9 s) statt tödlich. Ein echtes DNF käme obendrauf.

Warum nicht: eine Saison enthält je Disziplin nur eine Handvoll Spiele (`CLAUDE.md`). Ein
Team-DNF ist ein Los ohne Gegenwehr, das ein **ganzes Spiel** entwertet — für die Rangtreue der
Läufer über das Konto neutral, für das Spielgefühl ein Ärgernis, das man einmal je Saison
erlebt und sich merkt. Die Bahn-Familie hat außerdem bereits eine Disziplin, deren Drama das
Ausscheiden ist: Takeshi's Castle (dort 20–30 % der Läufer je Rennen). Zwei Bahnen mit
Ausscheiden wären weniger Vielfalt, nicht mehr. Wenn Chris das Drama je will: als Mutator
(`MUTATOREN`), nicht als Standard.

### 1.2 Frage 3 — Wer läuft Bein 1? **Bleibt: Bester auf Slot 0, KI nach Eignung.**

Die Ersatzaufstellung (`bauSpurt`, `engine.js:14924`) sortiert nach Eignung und setzt den
Besten auf `startrunner`. Ward-Smith & Radford sagen dasselbe (Schnellster auf Bein 1), die
Trainerpraxis sagt „sicherer Starter vorn, Schnellster als Anker" — und beide sind sich einig,
dass die Reihenfolge real **0–0,06 s** wert ist. Die sportliche Regel „bester ANTRITT vorn,
bester ENDTEMPO hinten" setzt den fliegenden Start (K4) voraus, und K4 ist **nicht gebaut**:
heute hat Bein 1 keinen Blockstart-Nachteil und der Anker keinen Einlaufgewinn, die Regel hätte
also keinen Kanal, an dem sie messbar würde.

Zweitens ist die Ersatzaufstellung nur der Rückfall des Mockups. Im Spiel stellt Chris selbst
auf, über die sechs Staffel-Slots in `lib/lineups/matchday-slot-roles.ts:137–144` (Start Runner
speed/stamina, Baton Tech awareness/dexterity, Anchor spirit/charisma) — das ist das Interface,
und es ist stimmig. Entscheidung: nichts ändern. Wenn K4 kommt, wird die Regel gegen die dann
gemessene Zahl geprüft, nicht vorher.

### 1.3 Frage 4 — Variable Beinlängen (K5)? **Nein, gestrichen.**

Die Staffel steht mit K1–K3 bei 0,915 (Saison 0,951). STEHEN ist auf dem 1,7-s-Bein tot
(Restreserve 88 %), aber die Matrix-Stamina (16) sitzt bereits mit 35 im ENDTEMPO und mit 26 im
ANTRITT — sie **hat** einen lebendigen Kanal. Variable Beinlängen wären eine sichtbare Änderung
an den Marken, ein neuer Plan-Zustand und ein neuer Bein-Bias-Kandidat, für eine Abnahmezahl,
die schon über dem Ziel liegt. Der ehrlichere Stamina-Kanal ist ohnehin K4 (Einlaufgewinn des
Abgebers), falls K4 je gebaut wird. K5-Beinlänge kommt aus der Liste; K5-WUCHT → ZONE bleibt an
K4 gebunden.

### 1.4 Frage 6 — Konstanz-Stat? **Nein, nicht an der Staffel.**

ROBUST („Verlässlichkeit") senkt die Patzerchance (`WECHSEL_ROBUST_K`) — das ist der
Konstanz-Kanal der Staffel, und er reicht (Paare ≥ 15 Punkte: 99,6 %). Das Trait-basierte Stat
aus `battle-mode-gameplay-grundmodell.md` Teil C ist ein **projektweites** Vorhaben mit fünf
eigenen offenen Fragen (symmetrisch oder FM-artig, Formkarte oder Sub-Skill-Jitter, …); es an
einer Disziplin festzumachen hieße, diese Fragen nebenbei zu entscheiden. Wenn es kommt: als
Streufaktor der Formkarte (Teil C.2), und in der Staffel als Patzer-Modulator, nicht als Tempo.

### 1.5 Frage 5 — Kadergröße und `playerCount`. **Zweier-Staffel bleibt; `playerCount` bleibt 3; die Saisonlogik ist ein eigener Befund.**

Gemessen (Basis = heutiger `main`, K1–K3 gemergt):

| je Seite | rho je Spiel | Spannweite | Quelle |
|---:|---:|---:|---|
| 2 | 0,950 | 0,306 | Staffel-Bericht 3.8 |
| 4 | 0,948 | 0,131 | ebd. |
| 5 | **0,919** (Saison 0,927) | 0,092 | dieser Bericht, `--je-seite=5` |
| 6 | 0,915 | 0,089 | Basislinie |

Die Zweier-Staffel war vor K1 eine Lotterie (0,138) und ist es nicht mehr — sie darf bleiben.

`playerCount` **nicht** auf 4 heben, und zwar aus einem Grund, der bei der Prüfung von
`buildSeasonPlayerCount` (`lib/season/season-discipline-schedule.ts:64–75`) aufgefallen ist:
die Logik würfelt 2–6 gleichverteilt und verschiebt **nur dann**, wenn der Wurf die Basis
trifft — um ±1. Die Basiszahl ist damit die einzige, die **nie** gespielt wird. Staffel mit
`playerCount: 3` läuft 2/4/5/6, nie 3; Spurt mit 2 läuft 3/4/5/6, nie 2; Takeshi mit 4 läuft
2/3/5/6, nie 4. Eine Staffel mit Basis 4 würde die Vierer-Staffel — die sportliche — gerade
**ausschließen**. Das ist offensichtlich nicht die Absicht der Zeile („trifft der Wurf die
Basis, variiere") und betrifft alle zwanzig Disziplinen gleichermaßen. Entscheidung: Basis
stehen lassen, Abnahme festschreiben als „≥ 0,80 bei 2, 4, 5 und 6" (erfüllt), und die
Saisonlogik als **eigenen, disziplinübergreifenden Auftrag** notieren (Teil 4). Für die Abnahme
der Bahnen ändert sich dadurch nichts: gemessen wird bei allen Größen, die vorkommen können.

---

## 2. Takeshi's Castle — Diagnose

### 2.1 Was Takeshi heute im Code ist

`BAHN_ART["takeshis-castle"]` (`engine.js:14767–14815`): vierzehn Fallen bei 7–96 % der Strecke,
kein Windschatten, kein Rempler, `grundTempo` 92 mit `tempoSpanne` 0,70, dazu die drei Dinge,
die keine andere Bahn hat — **Nerven** (`nervenMax = STEHEN·2,2`, ein Sturz kostet
`34·max(0,45; 1−ROBUST·0,0045)`, leer heißt raus), **Publikum** (Charisma in WENDIGKEIT,
regeneriert Nerven zwischen zwei Fallen, `nervenRegen` 0,05) und **Ausscheiden**. Die Falle
selbst ist die gemeinsame Technik-Wucht-Sturz-Kette des Chassis (`stepSpurt`, `:15322 ff.`):
Wurf gegen `0,26 + TECHNIK·0,006`, misslingt er, Wurf gegen `0,10 + WUCHT·0,006`
(Durchbrettern), sonst Sturz `0,80 + (1−TECHNIK/100)·0,95` s, verkürzt durch WENDIGKEIT.

Der Wert (`MOTOREN[bd].wert`, `:17330`) ist die Platzierung nach `fertig`: Finisher nach Zeit,
Ausgeschiedene mit `fertig = 90 + rennFertig.length·0,001` (`:15385`).

### 2.2 Was die Sonde sagt — vier Befunde

Eigene Sonde (Anhang A), unveränderte Kopie, n = 24, sechs je Seite, dieselben fünf Paarungen:

| Variante | rho/Spiel | Saison | Star auf 1 | Top 2 | Paare ≥ 15 | raus/Läufer | Stürze/L | Durchbr./L | Zielspanne | „rausInvers" |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| vigilante-armageddon | 0,790 | 0,874 | 50 % | 71 % | 92,5 % | 21 % | 3,41 | 2,38 | 5,7 s | 82 % |
| coldsteel-direlegion | 0,772 | 0,937 | 88 % | 96 % | 93,8 % | 24 % | 3,57 | 2,75 | 6,7 s | 80 % |
| goldengladiators-silversoldiers | 0,697 | 0,741 | 46 % | 88 % | 92,6 % | 12 % | 3,80 | 2,67 | 7,7 s | 64 % |
| mortalsin-natureswrath | 0,660 | 0,804 | 33 % | 63 % | 87,8 % | 22 % | 3,15 | 1,91 | 5,0 s | 81 % |
| piratecrew-raginglunatics | 0,620 | 0,839 | 63 % | 96 % | 92,2 % | 18 % | 3,14 | 1,85 | 7,0 s | 86 % |
| **Median** | **0,697** | **0,839** | **50 %** | **88 %** | **92,5 %** | **20 %** | | | | |

**(a) Die Fallen sind ein Münzwurf, vierzehnmal.** 3,1–3,8 Stürze und 1,9–2,8 Durchbrüche je
Läufer und Rennen — von vierzehn Fallen werden **acht** sauber genommen, sechs nicht. Ein
Gelingen kostet nichts, ein Sturz 0,8–1,75 s, ein Durchbruch 0,2 s. Jeder Läufer würfelt also
sechsmal je Rennen über gut eine Sekunde, bei 5–7,7 s Zielspanne. Das ist exakt der
Spurt-Befund (`spurt-modellierung-recherche-05-09.md` 1.3 c), nur doppelt so oft.

**(b) Die Ausscheide-Ordnung ist verkehrt.** `fertig = 90 + rennFertig.length·0,001`
platziert unter den Ausgeschiedenen den **zuerst** Ausgeschiedenen am besten. Die Spalte
„rausInvers" zählt Paare von Ausgeschiedenen desselben Rennens, bei denen der besser Platzierte
**weniger** Strecke geschafft hat: **64–86 %**. Bei 20 % Ausgeschiedenen je Rennen (2,4 von 12)
sind das rund 1,4 falsch geordnete Paare je Rennen, systematisch. Real gilt das Gegenteil: wer
in Takeshi's Castle das siebte Spiel erreicht, hat mehr geleistet als wer im zweiten fällt.

**(c) Die Kraftreserve ist am Ende bei allen leer.** Restreserve der Finisher median **12 %**,
21–27 % brechen ein („leer", Faktor 0,74 + STEHEN·0,0012). Das Rennen dauert 14 s, der Haushalt
(`kraftBasis` 300) ist für 11 s Spurt bemessen. Ein Einbruch, den ein Viertel hat, ist kein
Drama, sondern Grundrauschen — der Motor-Kommentar an `:14827` sagt das selbst.

**(d) Die Nerven sind hingegen lebendig.** Nervenrest der Finisher median 66 %, 4,3 Stürze bis
zum Ausscheiden; jedes Rennen hat mindestens einen Ausgeschiedenen. Der Kanal Wille → Nerven →
raus existiert und misst.

### 2.3 Die Zerlegung — und warum es NICHT die Staffel-Krankheit ist

    rho(ein Spiel) = rho(Saison) × √Verlässlichkeit
    0,697          = 0,839      × √V   →   V ≈ 0,69

Verlässlichkeit 0,69 ist die niedrigste der fünf Bahnen (Staffel 0,93, Spurt 0,89) — hier ist
also, anders als bei der Staffel, **auch** Rauschen im Spiel: sechs Würfe je Läufer über je
eine Sekunde. Und die Validität 0,839 ist nicht schlecht, sie ist nur nicht 0,95.

Die Staffel-Diagnose war „Rezept gibt Form UND Menge, Eignung nur Anzeige": der Tempo-Mix
ordnete die Läufer nur zu 0,776 wie die Eignung. Dieselbe Sonde für Takeshi (Mittel über 120
Rennen, rho innerhalb eines Rennens):

| Größe | rho mit −Platz | rho mit `eig` |
|---|---:|---:|
| ANTRITT | 0,612 | 0,641 |
| ENDTEMPO | 0,514 | 0,629 |
| TECHNIK („Falle lesen") | **0,254** | 0,235 |
| WENDIGKEIT („Aufstehen") | **0,265** | 0,428 |
| STEHEN („Wille") | 0,547 | 0,700 |
| WUCHT („Durchbrettern") | 0,433 | 0,743 |
| ROBUST („Nehmerqualität") | 0,533 | 0,766 |
| Tempo-Mix (½ ANTRITT + ½ ENDTEMPO) | 0,588 | 0,689 |
| **Mittel der sieben** | 0,671 | **0,932** |
| `eig` selbst | 0,660 | — |

Lesart: das Rezept-Mittel folgt der Eignung zu **0,932** — das Rezept ist an die Matrix
angelegt, die Decke von 0,776 aus der Staffel gibt es hier nicht. Was fehlt, sind Kanäle: die
beiden Sub-Skills, die an der Falle entscheiden (TECHNIK, WENDIGKEIT), lesen am Platz nur
0,25–0,27, weil ihr Ausgang ein Wurf ist und ihr Gelingen nichts kostet. Nur bei den Finishern
und nur auf die Zeit gerechnet trägt TECHNIK 0,21 — bei vierzehn Fallen, an denen es die
einzige Zutat sein soll.

**Takeshi hat also die Spurt-Krankheit** (Hindernis als Münzwurf), plus einen eigenen Fehler
(Ausscheide-Ordnung), plus eine Kalibrierungsfrage (Reserve). Die Eignungskopplung ist für
keine der drei das Mittel — nachgemessen in 2.4.

### 2.4 Die Eignungskopplung allein — gemessen, und warum sie hier nichts tut

K1 aus der Staffel, übertragen (Menge = Eignung, Form = Rezept), zwei Spielarten, beide mit
eigenem Gate `art.mengeAusEignung` (Patch T1a/T1b im Anhang), sonst nichts geändert:

| Kopie | rho/Spiel | Spannweite | Saison | Star 1 / Top 2 | Paare ≥ 15 | raus/L |
|---|---:|---:|---:|---|---:|---:|
| Basis | 0,697 | 0,170 | 0,839 | 50 % / 88 % | 92,5 % | 20 % |
| T1a: Menge = Mittel der sieben | **0,689** | 0,196 | 0,907 | 88 % / 96 % | 88,0 % | **46 %** |
| T1b: Menge = Tempo-Mix | 0,608 | 0,228 | 0,713 | 46 % / 83 % | 80,1 % | 52 % |

Die Validität steigt (0,907), die Einzelspielzahl nicht — und die Ausscheidequote
verdoppelt sich. Der Grund ist ein Niveau-Effekt, den die Staffel nicht hatte: die Eignung
(Matrix-gewichtetes Attributmittel) liegt im Kader bei **42,2**, das Rezept-Mittel bei
**53,1**. Die Kopplung zieht alle sieben Sub-Skills auf 42 herunter; `nervenMax = STEHEN·2,2`
fällt von 129 auf 102, `KRAFT_VON` entsprechend — bei unveränderten absoluten Kosten
(`nervenKosten` 34, `kraftBasis` 300). In der Staffel wirkte das Niveau nur auf das Tempo,
relativ zwischen zwei Teams, und war harmlos. Bei Takeshi wirkt es auf Budgets gegen feste
Preise. **Die Kopplung braucht hier zwingend nachgezogene Budgets** (T1f: `nervenKosten`
34 → 27, `kraftBasis` 300 → 334, proportional zum Niveau) — und selbst dann lohnt sie sich
erst, wenn die Fallen bezahlen (3.2).

Die Frage 1 des Staffel-Berichts beantwortet sich damit so: **kein pauschales Aufweichen des
Gates in `bauSpurt`.** Spurt hat seinen eigenen Fix (#794) und braucht keine Kopplung
(0,857). Zeitfahren (0,867) und Klettern (0,790, knapp) bleiben unangetastet — für Klettern
liegt das Angebot aus der Spurt-Recherche (`hindernisTypen` mit GRIFF) bereit, nicht die
Kopplung. Takeshi bekommt die Kopplung als **zweiten** Schritt, hinter eigenem Gate, mit
eigenen Budgets, s. Teil 3.

### 2.5 Was die echten Formate sagen — mit Quellen

Nur Wikipedia und ein Statistik-Lehrmodul waren aus der Umgebung erreichbar (Fandom/Keshipedia,
UKGameshows, IMDb-News, Wipeout-Wiki, ANW-Nation: 402/403/503); die Zahlen sind entsprechend
grob, aber für die Modellfrage ausreichend.

| Format | Kennzahl | Quelle |
|---|---|---|
| Takeshi's Castle (TBS 1986–90) | **86–142** Starter je Folge, **133** Folgen; UK-Fassung „about eight games, followed by the Final Showdown"; Sieger über alle Folgen im einstelligen Bereich (Suchergebnisse: „eight in total", „seven times … one million yen") | [Wikipedia](https://en.wikipedia.org/wiki/Takeshi%27s_Castle); Suchtreffer keshiheads.co.uk, IMDb |
| Sasuke / Ninja Warrior | **100** Starter, vier Stufen; alle vier Stufen in 43 Turnieren nur **sechsmal** von vier Athleten bewältigt; Sasuke 19: „only two 1st Stage clears" | [Wikipedia](https://en.wikipedia.org/wiki/Sasuke_(TV_series)) |
| ANW National Finals 2021, Stage 1 | 68 Läufe, 9 Hindernisse; Hindernis 8 („Thread the Needle") mit der höchsten Ausfallquote; ANW-Stage-1-Zeitlimit nie unter 120 s; Finisher mit 10–30 s Rest (10 Saisons) | [SCORE-Modul](https://modules.scorenetwork.org/obstacle_competitions/american_ninja_warrior/); Suchtreffer ANW Nation |
| Wipeout (ABC 2008–14) | Qualifier **24 → 12** nach **Zeit**; „if contestants fail to pass a particular obstacle, they must swim to the next obstacle" — Fehler = Zeit, nicht Ausscheiden; danach je Runde etwa Halbierung bis zur Wipeout Zone (4, später 3) | [Wikipedia](https://en.wikipedia.org/wiki/Wipeout_(2008_American_game_show)); Suchtreffer abcwipeout.fandom.com |

**Was daraus für die Modellierung folgt:**

1. **Takeshi's Castle ist eine Ausscheide-Kaskade, kein Rennen.** Rund 100 Starter, acht
   Spiele, eine Handvoll im Showdown, Sieg in ~6 % der Folgen. Je Spiel überleben grob 60–70 %.
   Unser Rennen scheidet 20 % je Rennen aus — nach dem Vorschlag 30 %. Das ist deutlich milder
   als das Original, und das ist richtig so: ein Rennen, das 95 % der zwölf ausscheidet, hat
   keine Rangfolge mehr, die eine Rangtreue messen könnte. Die Kaskade ist Fiktion, die Quote
   ist Spieldesign.
2. **Wipeout bepreist mit Zeit.** Wer scheitert, ist nicht raus — er ist langsamer. Genau das
   ist der Spurt-Mechanismus `huerdePreis` (jedes Hindernis kostet, das Können bestimmt wie
   viel), und genau das macht Zwölf ordnbar. Takeshi bekommt deshalb das Wipeout-Grundgerüst
   (Zeitpreis je Falle) mit dem Takeshi-Drama obendrauf (Nerven, Ausscheiden).
3. **Wer ausscheidet, wird nach der erreichten Stufe geordnet** — bei Sasuke, ANW und Takeshi
   ist „bis Hindernis 8 gekommen" die Leistung, die zählt. Unser `fertig = 90 + Reihenfolge`
   ordnet verkehrt (2.2 b). Die Ordnung nach Strecke ist die einzige, die das Format hergibt.
4. **Die Spiele testen Verschiedenes** (Balance auf den Skipping Stones, Glück/Wucht an den
   Knock-Knock-Türen, Festhalten am Bridge Ball, Lesen im Honeycomb Maze, Nehmerqualität im
   Final Fall). Das ist die Rechtfertigung für **typisierte** Fallen (`hindernisTypen`) statt
   vierzehnmal TECHNIK — und für die Matrix, die Wille 22, Entschlossenheit 18, Charisma 14,
   Intelligenz 11 führt, aber Speed nur 4.

---

## 3. Der Takeshi-Fix — gemessen

Alle Kopien kaderfest, n = 24, sechs je Seite; Patches wörtlich im Anhang B. T-Nummern
kumulativ wie bezeichnet.

### 3.1 Die Messreihe

| Kopie | Änderung | rho/Spiel | Spannweite | Saison | Spannweite | Star 1 / Top 2 | Paare ≥ 15 | raus/L | Zielspanne |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|
| Basis | = Repo | 0,697 | 0,170 | 0,839 | 0,196 | 50 % / 88 % | 92,5 % | 20 % | 5,0–7,7 s |
| T0 | Ausgeschiedene nach Strecke | 0,698 | 0,164 | 0,830 | 0,210 | 50 % / 88 % | 92,7 % | 20 % | wie Basis |
| T1a | nur Kopplung (Mittel 7) | 0,689 | 0,196 | 0,907 | 0,100 | 88 % / 96 % | 88,0 % | 46 % | 4,9–7,1 s |
| T0 + T1a | | 0,778 | 0,120 | 0,944 | 0,093 | 88 % / 96 % | 98,2 % | 46 % | |
| T2 | Fallen-Zeitpreis 0,50 s, 7 Typen | 0,792 | 0,071 | 0,869 | 0,124 | 71 % / 92 % | 97,8 % | 18 % | 5,1–8,7 s |
| T0 + T2 | | 0,792 | 0,076 | 0,869 | 0,140 | 71 % / 92 % | 98,0 % | 18 % | |
| T0 + T2b | Preis 0,80 s | 0,856 | 0,087 | 0,909 | 0,161 | 75 % / 92 % | 98,6 % | 16 % | |
| **T0 + T2c** | **Preis 1,00 s (wie Spurt)** | **0,878** | **0,096** | 0,895 | 0,182 | 79 % / 96 % | 98,4 % | 16 % | 5,7–10,3 s |
| T0 + T2 + T3 | + Reserve zehrt im Stopp nur 40 % | 0,774 | 0,090 | 0,851 | 0,137 | 71 % / 92 % | 96,2 % | 18 % | |
| T0 + T2b + T4 | + `kraftBasis` 380 | 0,862 | 0,092 | 0,909 | 0,203 | 79 % / 92 % | 98,4 % | 17 % | |
| T0 + T1a + T2 | Kopplung + Preis 0,50 | 0,863 | 0,094 | 0,956 | 0,098 | 96 % / 100 % | 98,8 % | 43 % | |
| T0 + T1a + T2b | Kopplung + Preis 0,80 | 0,875 | 0,080 | 0,963 | 0,051 | 96 % / 100 % | 99,3 % | 41 % | |
| T0 + T1a + T1f + T2 | + Budgets nachgezogen, Preis 0,50 | 0,865 | 0,084 | 0,951 | 0,070 | 92 % / 100 % | 99,3 % | 31 % | |
| **T0 + T1a + T1f + T2b** | **+ Budgets, Preis 0,80 — der Vorschlag** | **0,896** | **0,082** | **0,965** | 0,121 | **96 % / 100 %** | **99,9 %** | 31 % | 7,6–10,3 s |
| T0 + T1a + T1f + T2c | + Budgets, Preis 1,00 | 0,883 | 0,070 | 0,944 | 0,077 | 96 % / 100 % | 99,8 % | 30 % | |

Je Kader-Variante für die beiden Kandidaten (rho/Spiel · Saison · Star 1 · Paare ≥ 15):

| Variante | Basis | T0 + T2c | T0 + T1a + T1f + T2b |
|---|---|---|---|
| vigilante-armageddon | 0,790 · 0,874 · 50 % · 92,5 % | 0,878 · 0,881 · 79 % · 97,2 % | 0,917 · 0,972 · 63 % · 99,2 % |
| coldsteel-direlegion | 0,772 · 0,937 · 88 % · 93,8 % | 0,886 · 0,895 · 83 % · 98,4 % | 0,899 · 0,970 · 100 % · 100 % |
| goldengladiators-silversoldiers | 0,697 · 0,741 · 46 % · 92,6 % | 0,825 · 0,797 · 67 % · 99,0 % | 0,867 · 0,851 · 96 % · 100 % |
| mortalsin-natureswrath | 0,660 · 0,804 · 33 % · 87,8 % | 0,904 · 0,979 · 96 % · 98,7 % | 0,896 · 0,965 · 100 % · 99,9 % |
| piratecrew-raginglunatics | 0,620 · 0,839 · 63 % · 92,2 % | 0,807 · 0,951 · 79 % · 98,4 % | 0,834 · 0,958 · 71 % · 98,9 % |

Beide Kandidaten liegen in **jeder** Variante über dem besten Basiswert (0,790) — das ist
nach der Faustregel aus `messgrundlage-kaderfest.md` die Bewegung, die kein Kaderrauschen
mehr sein kann (Basis-Spannweite 0,170; Bewegung +0,18 bzw. +0,20).

### 3.2 Was die Reihe sagt — vier Lehren

1. **Der Zeitpreis ist der Hebel** (+0,16 bis +0,18 allein), und seine Steigung zählt: 0,50 s
   → 0,792, 0,80 s → 0,856, 1,00 s → 0,878. Bei vierzehn Fallen summiert sich der Unterschied
   zwischen Skill 20 und Skill 80 bei Preis 0,8 auf 14 · 0,8 · 0,48 = **5,4 s** — dieselbe
   Größenordnung wie die Zielspanne aus dem Tempo. Erst dann bezahlen die Fallen, und TECHNIK
   liest bei den Finishern 0,45 statt 0,21.
2. **T0 kostet nichts und ist immer richtig.** Allein +0,001 (die Ausgeschiedenen sind bei
   20 % nur 1,4 Paare je Rennen). Sobald mehr ausscheiden (Kopplung: 30–46 %), ist T0 der
   Unterschied zwischen 0,689 und 0,778. Es ist außerdem der Fehler, den ein Spieler sieht:
   „ausgeschieden bei 91 %" hinter „ausgeschieden bei 14 %" platziert.
3. **Die Kopplung lohnt erst hinter dem Zeitpreis** — und dann deutlich in der Validität
   (0,895 → 0,965) und beim Star (79 → 96 %), kaum in der Einzelspielzahl (0,878 → 0,896,
   innerhalb des Rauschens). Sie kauft also das, wofür sie in der Arena gebaut wurde: dass der
   Disziplinrang entscheidet, nicht nur die Attribute, aus denen er entsteht. Preis: die
   Ausscheidequote steigt von 16 auf 31 % — was das Format eher besser trifft als schlechter
   (2.5), aber eine sichtbare Änderung ist.
4. **Die Reserve-Kalibrierung (T3/T4) bewegt rho nicht** (−0,02 / +0,006, Rauschen). Sie ist
   trotzdem nötig, aber aus dem anderen Grund: mit Stopps dauert das Rennen 17–22 s statt 14,
   und **65–74 %** der Läufer brechen ein (Basis 21–27 %). Ein Einbruch, den drei Viertel haben,
   ist Grundrauschen. `kraftBasis` gehört in der Umsetzungsrunde auf ~380 (T4) — mit
   Korridor-Messung wie beim Spurt (dort dieselbe offene Kalibrierung, Bericht 3.4 Punkt 3).

### 3.3 Der Vorschlag: zwei Schritte, beide gemessen

**Schritt 1 — Fallen bezahlen, Ausscheiden richtig ordnen** (T0 + T2b, ohne Kopplung: 0,856;
mit Preis 1,00: 0,878). Zwei Änderungen, eine davon reine Konfiguration:

```js
// BAHN_ART["takeshis-castle"] — nach `hindernisWort:"Falle", boden:"#4a5f3a", schatten:false, tackle:false,` (engine.js:14789):
hindernisTypen:["TECHNIK","WENDIGKEIT","WUCHT","STEHEN","TECHNIK","ROBUST","WUCHT"], huerdePreis:0.80,
// Falle lesen (Honeycomb Maze) · Aufstehen/Balance (Skipping Stones) · Durchbrettern (Knock Knock) ·
// Wille (Bridge Ball) · Falle lesen · Nehmerqualität (Final Fall) · Durchbrettern — zweimal durch, 14 Fallen.
// Skill 20 friert 0,67 s je Falle ein, Skill 80 nur 0,29 s. Kein Motor: stepSpurt/tempoVon lesen beide Felder bereits (PR #794).
```

```js
// stepSpurt, Ausscheiden (engine.js:15385) — nur im nervenKosten-Zweig, den allein Takeshi erreicht:
u.raus=true; u.fertig=90+(1-u.pos)*10;      // vorher: 90+rennFertig.length*0.001 — zuerst raus = am besten platziert
```

**Schritt 2 — Menge aus der Eignung, mit nachgezogenen Budgets** (T1a + T1f, auf Schritt 1:
**0,896 / 0,082 / 0,965**). Eigenes Gate, Takeshi setzt es allein; die Staffel behält
`art.staffel` und ihre Tempoformel unverändert:

```js
// bauSpurt, direkt nach dem art.staffel-Block (engine.js:14954), vor `const P=BA().plaene`:
if(art.mengeAusEignung){
  const eigW=(p.d[d]!=null?p.d[d]:gewichtet(p.a,BASIS_JE_DISC[d]||{}))+engP+breitP+eigHebung(p,d);
  const ks=Object.keys(w); const m=ks.reduce((s,k)=>s+w[k],0)/ks.length;   // Mittel der sieben, nicht der Tempo-Mix
  const f=m>0?eigW/m:1;
  for(const k in w)w[k]=Math.round(Math.max(1,Math.min(100,w[k]*f)));
}
```

```js
// BAHN_ART["takeshis-castle"]:
grundTempo:92, tempoSpanne:0.70, mengeAusEignung:true,
// Budgets an das Eignungs-Niveau (Kader-Mittel 42 statt 53) angepasst — sonst verdoppelt sich die Ausscheidequote:
wendigErholt:0.0030, kraftBasis:334, kraftSpanne:2.8, nervenKosten:27, nervenRegen:0.05,
```

Warum das Mittel der sieben und nicht der Tempo-Mix: bei Takeshi ist die Falle so
entscheidend wie das Tempo (T1b mit Tempo-Mix: 0,608 — die Kopplung über zwei Sub-Skills
verzerrt die anderen fünf). Bei der Staffel war der Tempo-Mix richtig, weil sie fast reines
Tempo ist; das ist kein Widerspruch, sondern derselbe Grundsatz („die effektive Formel der
Disziplin") auf zwei verschiedene Disziplinen.

Warum Preis 0,80 und nicht 1,00 wie im Spurt: vierzehn Fallen statt sieben. Die Summe der
Stopps eines mittleren Läufers ist bei 0,80 · 14 · 0,60 = 6,7 s (Spurt: 1,00 · 7 · 0,60 =
4,2 s); bei 1,00 wären es 8,4 s auf einem 21-s-Rennen. Die Messung trennt die beiden nicht
(0,896 gegen 0,883), das Bild schon: ein Läufer, der 40 % seiner Zeit steht, ist ein
Spießrutenlauf, einer mit 50 % ein Stau.

### 3.4 Die Kadergrößen, die der Saisonplan würfelt

Takeshi hat `playerCount: 4` (`lib/data/dataAdapter.ts:68`) und läuft nach der Regel aus 1.5 mit
**2, 3, 5 oder 6** je Seite, nie mit 4. Nachgemessen mit `--je-seite` (rho/Spiel · Spannweite ·
Saison · Star 1 · Paare ≥ 15; n = 24):

| je Seite | Basis | T0 + T2c | T0 + T1a + T1f + T2b |
|---:|---|---|---|
| 2 | 0,867 · 0,100 · 1,000 · 79 % · 100 % | 0,900 · 0,175 · 1,000 · 88 % · 98,3 % | **0,933** · 0,175 · 1,000 · 88 % · 100 % |
| 3 | 0,876 · 0,131 · 0,943 · 88 % · 96,7 % | 0,914 · 0,080 · 0,943 · 96 % · 99,2 % | **0,921** · 0,136 · 1,000 · 100 % · 100 % |
| 5 | 0,754 · 0,195 · 0,794 · 50 % · 95,1 % | 0,857 · 0,088 · 0,903 · 88 % · 99,3 % | **0,902** · 0,096 · 0,952 · 100 % · 99,8 % |
| 6 | 0,697 · 0,170 · 0,839 · 50 % · 92,5 % | 0,878 · 0,096 · 0,895 · 79 % · 98,4 % | **0,896** · 0,082 · 0,965 · 96 % · 99,9 % |

Bei zwei je Seite (vier Läufer, Spearman über vier Werte) liest die Basis schon 0,867 — dort
sind die vier Eignungsbesten zweier Kader weit genug auseinander, dass jede Mechanik sie
ordnet; die Paartreue (100 %) ist die ehrlichere Zahl. Der Vorschlag hält 0,80 bei allen vier
Größen mit Abstand. (In den `--je-seite`-Läufen der eigenen Sonde sind nur die rho-, Star- und
Paar-Spalten gültig; die Protokollspalten liefen dort noch mit sechs.)

### 3.5 Isolationsnachweis — alle zwanzig, beide Kandidaten

`scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig) gegen die Kopie mit T0 + T2c und gegen
die Kopie mit T0 + T1a + T1f + T2b, jeweils ohne Seitenfehler. **Alle 19 anderen Disziplinen
lesen auf drei Nachkommastellen dieselben vier Zahlen wie die unveränderte Kopie** — Staffel
0,915 / 0,089 / 0,951 / 0,093, Spurt 0,857 / 0,286 / 0,905 / 0,357, Time-Trial 0,867 / 0,050,
Climbing 0,790 / 0,192, alle sieben Bühnen, alle drei Feldspiele, alle drei Arenen.

Das ist auch konstruktiv so: T2 ist Konfiguration in Takeshis eigenem Block; `hindernisTypen`
liest der Motor nur, wo es gesetzt ist (Spurt, Takeshi); T0 sitzt im `nervenKosten`-Zweig, den
nur Takeshi betritt; T1a ist hinter `art.mengeAusEignung` gegated, das nur Takeshi setzt; T1f
sind Takeshi-eigene Konstanten.

**Nebenbefund, kein Teil dieses Patches:** die drei Arena-Disziplinen weichen in **beiden**
Kandidaten UND in der unveränderten Kopie von `data/generated/rangtreue-basislinie.json`
(04.09.) und `stand-aller-disziplinen.md` ab — TDM 0,113 → 0,253, Mini-DM 0,269 → 0,094,
Battlefield 0,325 → 0,387. Der heutige `main` misst die Arena anders als am 04.09. (Kandidat:
PR #782 „arena-quick-sim-and-period-pause"); Mini-DM liegt damit unter seiner Schranke. Das
gehört in die Basislinien-Neubau-Runde, die der Takeshi-Fix ohnehin auslöst.

### 3.6 Optik und Ingame-Prüfung — was die Umsetzungsrunde ansehen muss

Chris: „review noch mal ingame ob das sauber aussieht". Drei Dinge, die die Sonde sieht und
ein Screenshot zeigen wird:

| Element | Befund | Handgriff |
|---|---|---|
| Stehender Läufer im Stopp | `zeichneSpurt` (`:15540`) gibt `vx: u.stolper>0 ? 0 : 4` — während `u.huerde > 0` steht der Läufer, wird aber mit Laufanimation gezeichnet: **er läuft auf der Stelle**. Gilt seit #794 auch im Spurt | `vx:(u.stolper>0||u.huerde>0)?0:4` — eine Zeile, beide Bahnen |
| Kein Schwebetext am Stopp | Der Zeitpreis setzt `u.huerde` stumm (`:15340`); Sturz und Durchbruch haben Texte, das Innehalten nicht | `schwebe({txt: A.hindernisWort+" …"})` nur, wenn `u.huerde` länger als ~0,5 s (sonst 14 Texte je Läufer) |
| Fallen-Zeichnung | `bodenSpurt` (`:14364 ff.`) kennt drei Wörter (Hürde, Kurve, Griff); „Falle" fällt auf die Hürden-Zeichnung zurück, alle vierzehn gleich | wie beim Spurt offen (U3 dort): ein `switch` über `hindernisTypen[i]`; für die Abnahme nicht nötig |
| Zielspanne | 7,6–10,3 s auf ~21 s — die Kamera (`kameraUpdate`, Zoom bis 3,4) trägt das; das Feld zieht sich sichtbar auseinander, was ein Spießrutenlauf auch soll | Sichtprüfung |
| Einbrüche | 65–74 % „eingebrochen" je Rennen ohne T4 — sieht nach Grundrauschen aus | `kraftBasis` ~380, Korridor messen (3.2, Punkt 4) |
| Ausscheiden | 30 % je Rennen mit Schritt 2, Text „scheidet aus — Nerven am Ende nach n Stürzen bei x %" existiert | Sichtprüfung: liegt der Ausgeschiedene sichtbar am Rand? (`platz`-Versatz in `zeichneSpurt` nutzt `rennFertig.indexOf`, unverändert) |

---

## 4. Aufwand und Reihenfolge

| # | Schritt | Umfang | Abnahme |
|---|---|---|---|
| 1 | T0 + T2b (Konfiguration + eine Zeile) | trivial | `miss-alle-disziplinen 24 takeshis-castle` ≥ 0,85; `--je-seite=2/3/5` ≥ 0,80; die vier anderen Bahnen bit-identisch |
| 2 | T1a + T1f (Gate `mengeAusEignung`, ~6 Zeilen, zwei Konstanten) | gering | ≥ 0,88, Saison ≥ 0,95, Star ≥ 90 %; Ausscheidequote 25–35 % je Rennen (Sonde) |
| 3 | Reserve: `kraftBasis` ~380, Korridor „Einbrüche je Rennen ≤ 40 %" | gering | rho gehalten ±0,03; `messe-arena-einfluss takeshis-castle 48` gegen die Matrix (Ziel: Wille/Entschlossenheit ≥ 30 %, Charisma ≥ 8 %, Speed ≤ 8 %) |
| 4 | Optik: `vx` im Stopp, Schwebetext, Sichtprüfung (3.6) | gering | Screenshot |
| 5 | Basislinie neu bauen (`baue-rangtreue-basislinie.mjs`), Stand-Doku nachziehen — inklusive der Arena-Drift aus 3.5 | ¼ Tag | CI grün |
| 6 | **Eigener Auftrag, alle 20:** `buildSeasonPlayerCount` prüfen — die Basiszahl ist heute die einzige, die nie gespielt wird (1.5) | gering, aber disziplinübergreifend | Chris entscheidet, ob „Basis ± 1" oder „2–6 ohne Basis" gemeint war |
| 7 | Später: Fallen-Zeichnung je Typ, Produktivierung (`ARENA_RESOLVED_DISCIPLINE_IDS`) | eigener Auftrag | wie Hockey/Gewichtheben |

Reihenfolge-Regel wie immer: 1 messen, dann 2 messen, dann 3 — nie zwei Eingriffe in einer
Messung. Die Kalibrierung (3) darf die Rangtreue nicht tragen; sie darf sie nur nicht kosten.

---

## 5. Was ich nicht geprüft habe / Methodik

- Alle Kopien liegen im Scratchpad (`mock-base`, `mock-T0…`), **nicht** committet; der Motor
  im Repo ist unverändert. Die Patches sind in Anhang B zeichengenau abgedruckt.
- Die Einflussmessung (`messe-arena-einfluss.mjs takeshis-castle 48`) habe ich für die Kopien
  **nicht** gefahren — die Sub-Skill-Korrelationen der eigenen Sonde (2.3, Anhang A) ersetzen
  sie nur teilweise. Sie gehört in Schritt 3, weil erst dort die Reserve steht.
- T4 (`kraftBasis` 380) ist nur auf T0 + T2b gemessen (0,862), nicht auf dem Vorschlag mit
  Kopplung; T1f setzt dort bereits 334. Die endgültige Zahl ist Kalibrierung.
- `spiele()` und `disziplinProbe` ziehen die Formkarten unterschiedlich; die Protokollspalten
  (Stürze, raus, Zielspanne) stammen aus `spiele()`, die rho-Spalten aus `disziplinProbe` —
  in sich konsistent, aber nicht auf die Nachkommastelle mischbar.
- Die Formatzahlen in 2.5 stammen aus Wikipedia und Suchergebnis-Snippets; die eigentlichen
  Fan-Wikis mit Spiel-für-Spiel-Zahlen (Keshipedia, Sasukepedia, Wipeout-Wiki) waren aus der
  Umgebung nicht erreichbar (402/403). Für die Modellentscheidung (Zeit statt Ausscheiden,
  Ordnung nach Strecke, ~30 % Ausscheidequote) reichen die groben Zahlen; für eine Kalibrierung
  „Gelingquote je Fallentyp" nicht.
- Die Arena-Drift (3.5) habe ich festgestellt, nicht untersucht.

---

## Anhang A — die Sonde

`diag-takeshi.mjs <mockdir> [n] [jeSeite] [label]` (Scratchpad, nicht committet): lädt
`kaderfamilie-live-save.json`, ruft `window.__arena.disziplinProbe("takeshis-castle",
{n, kaderFamilie, jeSeite})` und rechnet je Variante mit `scripts/lib/rangtreue-messung.mjs`
rho je Spiel/Saison, Star-Quote (Eignungsbester auf 1 / Top 2 / Letzter), Paartreue (≥ 15 und
< 3 Punkte). Danach je Variante `kaderSetzen` und n Läufe `spiele()`, deren `protokoll`
(= `rennFertig` mit allen Feldern) Stürze, Durchbrüche, `raus`, `nerven`, `reserve`, `leer`,
Zielspanne und die Ordnungsprüfung „rausInvers" liefert; Platz aus `wert()`, nicht aus der
`rennFertig`-Reihenfolge. Sub-Skill-Korrelationen als Mittel der Spearman-rho **innerhalb**
eines Rennens über 120 Rennen.

## Anhang B — die Patches (zeichengenau, gegen `ee2ac733`)

**T0 — Ausscheide-Ordnung** (`stepSpurt`, `:15385`):
```
u.raus=true; u.fertig=90+rennFertig.length*0.001;   →   u.raus=true; u.fertig=90+(1-u.pos)*10;
```

**T1a — Kopplung, Mittel der sieben** (`bauSpurt`, vor `const P=BA().plaene, JS=BA().planJeSlot;`):
```js
if(art.mengeAusEignung){
  const eigW=(p.d[d]!=null?p.d[d]:gewichtet(p.a,BASIS_JE_DISC[d]||{}))+engP+breitP+eigHebung(p,d);
  const ks=Object.keys(w); const m=ks.reduce((s,k)=>s+w[k],0)/ks.length;
  const f=m>0?eigW/m:1;
  for(const k in w)w[k]=Math.round(Math.max(1,Math.min(100,w[k]*f)));
}
```
und in `BAHN_ART["takeshis-castle"]`: `grundTempo:92, tempoSpanne:0.70, mengeAusEignung:true,`.
**T1b** wie T1a mit `const m=0.5*w.ANTRITT+0.5*w.ENDTEMPO;` (verworfen, 0,608).

**T1f — Budgets**: `nervenKosten:34` → `27`; `kraftBasis:300` → `334`.

**T2 / T2b / T2c — Fallen-Zeitpreis** (`BAHN_ART["takeshis-castle"]`, nach `tackle:false,`):
```
hindernisTypen:["TECHNIK","WENDIGKEIT","WUCHT","STEHEN","TECHNIK","ROBUST","WUCHT"], huerdePreis:0.50,   // T2
… huerdePreis:0.80,   // T2b (Vorschlag)
… huerdePreis:1.00,   // T2c
```

**T3 — Zehren im Stopp** (verworfen, −0,02): `stepSpurt` nach `if(u.stolper>0)zehr*=1.4;`:
`if(u.huerde>0&&BA().huerdeZehr!=null)zehr*=BA().huerdeZehr;` und `huerdeZehr:0.4` im Block.

**T4 — Reserve**: `kraftBasis:300` → `380` (auf T0 + T2b: 0,862, neutral; Kalibrierung für Schritt 3).

## Quellen

- [Wikipedia: Takeshi's Castle](https://en.wikipedia.org/wiki/Takeshi%27s_Castle) — 86–142 Starter, 133 Folgen, UK-Fassung „about eight games"
- [Wikipedia: Sasuke](https://en.wikipedia.org/wiki/Sasuke_(TV_series)) — 100 Starter, sechs Gesamtsiege in 43 Turnieren
- [Wikipedia: Wipeout (2008)](https://en.wikipedia.org/wiki/Wipeout_(2008_American_game_show)) — 24 → 12 nach Zeit, „swim to the next obstacle"
- [SCORE: American Ninja Warrior, Kaplan-Meier](https://modules.scorenetwork.org/obstacle_competitions/american_ninja_warrior/) — 68 Läufe Stage 1 2021, „Thread the Needle" höchste Ausfallquote
- Suchergebnisse (Seiten nicht erreichbar, nur Snippets): keshiheads.co.uk („eight in total" Sieger), abcwipeout.fandom.com (Qualifier-Regeln), americanninjawarriornation.com (Stage-1-Zeitlimit, Restzeit)
- Repo: `CLAUDE.md`, `docs/design/staffel-modellierung-recherche-05-09.md`,
  `docs/design/spurt-modellierung-recherche-05-09.md`, `docs/design/stand-aller-disziplinen.md`,
  `docs/design/messgrundlage-kaderfest.md`, `docs/design/battle-mode-gameplay-grundmodell.md`,
  `public/mockups/battle-mode.engine.js`, `scripts/lib/rangtreue-messung.mjs`,
  `scripts/miss-alle-disziplinen.mjs`, `lib/season/season-discipline-schedule.ts`,
  `lib/data/dataAdapter.ts`, `lib/lineups/matchday-slot-roles.ts`,
  `data/generated/rangtreue-basislinie.json`

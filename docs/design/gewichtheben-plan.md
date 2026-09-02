# Gewichtheben: Duelle je Slot, Reißen und Stoßen, Sinclair für zehn Größen

Recherche-Stand: 2026-09-02, gemessen gegen `origin/main` `6e16cf1b` („Eishockey laeuft live in
der Arena"). Alle Datei- und Zeilenangaben sind gegen genau diesen Stand geprüft. Geschrieben
von Fable auf Chris' ausdrückliche Frage — dieselbe Strenge wie
`docs/design/hockey-torwart-puck-tore-plan.md`: **jede Zahl ist entweder aus dem Code zitiert,
selbst simuliert oder eine reale Sport-Referenz mit Quelle.** Platzhalter heißen Platzhalter.

Auftrag von Chris, wörtlich:

> „zum Gewichtheben ja da kannst du ja auch was ausdenken. Dass die Spieler nacheinander dran
> sind, bzw immer 2 gleichzeitig heben. Jeweils einer pro Team.
>
> Und dann gibt es 2 Möglichkeiten auf Scoring einmal Gesamtgewicht was gestemmt wurde beider
> Teams, oder wer von den 2 zugewiesenen Spielern auf dem jeweiligen Slot hat die bessere
> Performance und mehr gewicht würde dann Sieg für den Spieler bedeuten -> so könnte man auch
> ein 3:3 bekommen -> bei der Variante die Gewichte aufzusummieren hätte man nur ein
> Gesamtgewicht. Glaube da fände ich einzelne Duelle fast besser oder, frag mal fable was da
> sinnvoll wäre und sinn macht"

> **Zwei Verweise aus dem Auftrag existieren an diesem Stand nicht.** Der Auftrag nennt einen
> CLAUDE.md-Abschnitt „Die Abnahme jeder Disziplin: ein Spiel, nicht eine Saison" und einen
> Abschnitt 1.3 im Multi-Disziplin-Plan. Beides habe ich gesucht (`git grep` über alle
> Remote-Branches und alle Worktree-Kopien): **kein Treffer.** Die Regel, die gemeint ist,
> kenne ich aus `hockey-rollout-plan.md` D.2 — „Spearman(Impact-Rang im EINEN Spiel,
> Eignungs-Rang), je Seite gemittelt" — dort mit Schwelle 0,74. Der Auftrag setzt **0,80**;
> ich rechne unten gegen 0,80. Sollte der Abschnitt auf einem Branch liegen, den ich nicht
> sehe, ändert das an den Zahlen nichts, nur am Zitat.

---

## 0. Die Antwort, vorweg

**Einzelduelle je Slot — ja, für das Team-Ergebnis. Aber die Rangtreue darf nicht am Duell
hängen, sondern muss an den eigenen Kilogramm hängen.** Chris' Frage vermischt zwei Ebenen,
die im Motor getrennt sind und getrennt bleiben müssen:

| Ebene | Was sie bestimmt | Empfehlung |
|---|---|---|
| **Team-Ergebnis** (Sieg/Unentschieden/Niederlage, 2/1/0 in der Tabelle) | Wer den Spieltag gewinnt | **Duelle je Slot zählen** — 4:2, 5:1, 3:3 |
| **Spieler-Wert** (`MOTOREN[d].wert()`, das, was die Rangtreue-Abnahme liest) | Ob der Bessere auch besser abschneidet | **Die eigenen Sinclair-normierten kg** — nicht „kg minus Gegner", nicht „Duell gewonnen" |

Warum beides zusammengehört, steht in Teil 3 mit Zahlen. Kurz: **die Duellzählung erzeugt
in 29 % aller Spiele ein 3:3**, und ein Spieler-Wert, der den Gegner enthält (das Muster von
Speed-Schach, `u.vorteil`), **liest rho 0,62 statt 0,92** — unter der Abnahmeschwelle. Die
Duelle sind das richtige Bild für den Zuschauer und das richtige Ergebnis für die Tabelle;
die Kilogramm sind das richtige Maß für den Spieler.

---

## 1. Was heute wirklich da ist — nachgesehen, nicht vermutet

**1.1 Gewichtheben ist ein Eintrag mit Rezept, aber ohne Kilogramm.** `DISCS.gewichtheben`
(`public/mockups/battle-mode.engine.js:2598`) trägt `cat:"buehne", size:6`. `BUEHNE_ART.gewichtheben`
(`:7791-7815`) ist vollständig: `jeSeite:6, rundenN:3, rundenDauer:1.65, failAbzug:0`, ein
Rezept über die sieben Bühnen-Rollen. Der Kommentar dort ist ehrlich: „ein verpatzter Versuch
zählt NICHTS (failAbzug 0) — echtes Gewichtheben kennt keine Teilpunkte für eine gerissene
Hantel." **Das Wort „kg" kommt im gesamten Bühnen-Motor nicht vor.** Ergebnis sind „Punkte",
aus derselben Formel wie Showcase, Eiskunstlauf, Breaking und Wettessen (`bauBuehne`,
`:7968-7981`): `basis = 20 + GRUNDLAGE·0,7`, gelingt mit `min(0,94, 0,15 + TECHNIK·0,0055 +
NERVEN·0,0035)`, dann `+ SPITZENMOMENT·0,35·(0,4 + WAGNIS·0,006)`, immer `+ PUBLIKUM·0,12`.

Drei Dinge daran passen nicht zu Gewichtheben, und sie sind der eigentliche Grund für einen
eigenen Bau:

- **Die drei Durchgänge sind unabhängig.** Jeder Durchgang wird für sich gewürfelt. Echtes
  Gewichtheben ist eine **Zustandsmaschine**: das Gewicht steigt nur nach einem gültigen
  Versuch, nach einem Fehlversuch wird wiederholt, und die Steigerung ist eine Entscheidung.
- **Die Punkte werden summiert** (`u.summe`). Beim Gewichtheben zählt **der beste** Versuch
  je Übung, nicht die Summe der drei.
- **PUBLIKUM ist ein flacher Bonus ohne Risiko.** Der Kommentar `:7801-7807` protokolliert,
  dass genau das die erste Messung auf 64 Pp trieb, weil Charisma (Matrixgewicht 23) so keinen
  Einfluss auf den Ausgang hatte. Nachgezogen wurde es in NERVEN und TECHNIK — der flache
  Bonus steht aber weiter drin.

Die Enthüllung dauert 3 Runden × 6 × 2 = 36 Ereignisse × 1,65 s = **59 s**, was Chris'
„ungefähr 60 Sekunden" (`:3444-3452`) trifft. Alle Ergebnisse stehen fest, bevor der erste
Durchgang gezeigt wird (`:7964-7967`, ausdrücklich so gewollt).

**1.2 Das Duell existiert — als Bühnen-Variante, nicht als fünfter Motor.** Speed-Schach und
I-Spy tragen `duell:true` (`:7900`, `:7917`). `bauBuehne` paart dann **Teilnehmer i gegen
Gegner i** (`:7995-8009`), rechnet je Runde `eigene Punkte − Gegnerpunkte` als laufenden
Vorteil und schreibt `a.vorteil = lauf; b.vorteil = −lauf`. `MOTOREN[bd].wert()` (`:13996`)
liefert im Duell **den Vorteil**, sonst die Summe. Das HUD zählt gewonnene Bretter
(`updateHudBuehne`, `:8073-8076`): „Bretter (Vorteil > 0 am Ende)". Die Paarung ist also
da — **aber sie paart nach Listenposition, nicht nach Slot-Rolle**, und der Spieler-Wert
enthält den Gegner. Beides ist für Gewichtheben zu ändern (Teil 3.3 und 4.1).

**1.3 Die Aufstellung erreicht die Bühne.** Seit #736 („Die Aufstellung erreicht endlich die
Arena") liest `bauBuehne` den Slot aus `place[p.n].slot` (`slotFuer`, `:7950-7951`), Rückfall
ist die Slot-Liste in Reihenfolge. `slotAufschlag` und `betroffeneAttribute` wirken auf die
Attribute vor dem Rezept (`:7955-7958`). Ein Slot ist damit heute schon **ein Attributaufschlag**
— aber kein Verhalten. Für Gewichtheben soll er beides sein (Teil 4.3).

**1.4 Es gibt eine Produktions-Bühne mit Kilogramm — auf dem alten Pfad.**
`app/foundation/discipline-stage/arena/disciplines/barbell.tsx` (468 Zeilen) zeichnet einen
Hantelturm je **Team**, und `buildBarbellInfo` (`DisciplineStageNativeArena.tsx:1075-1102`)
rechnet die kg **aus dem PPS-Score**: „kg-Skala 150…400 kg (schöne Hantel-Zahlen), monoton im
Endscore". Das ist eine Umrechnung fürs Auge, keine Mechanik — und es ist der alte
Spieltags-Resolve. `ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:32`)
enthält **nur Basketball**. Gewichtheben wird heute im Spiel **nicht** über die Arena
entschieden.

**1.5 Die Größe existiert als Zahl je Spieler und wirkt nur aufs Bild.** `p.groesse` (Skala
1-10) kommt über `arena-kader-adapter.ts:102` aus `data/generated/oly-player-groesse.json`,
`groesseFaktor` (`engine.js:1373`) macht daraus einen Zeichenfaktor 0,8..1,3 — „reine
ZEICHEN-Groesse, ruehrt an keiner Position/Trefferbox". `bauBuehne` schreibt sie bereits in
jeden Teilnehmer (`groesse:p.groesse??null`, `:7961`). Verteilung über 2983 Spieler, gezählt:

| Größe | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Spieler | 17 | 80 | 161 | 147 | **1433** | 623 | 278 | 149 | 69 | 26 |

Fast die Hälfte ist 5. Das entscheidet mit, wie stark die Größe die Anzeige spreizen darf
(Teil 6.3).

**1.6 Es gibt keine Rangtreue-Sonde für die Bühne.** `feldspielProbe` (`:14656-14677`) ist
generisch für Feldspiele; für `BUEHNE_ART` gibt es nichts Entsprechendes (`grep buehneProbe`:
kein Treffer). Die Pp-Messung `einflussVon` (`:14053`) läuft dagegen für jeden Motor.

**1.7 Die Tabelle kennt 2/1/0 und `seiten`.** `ARENA_TEAM_POINTS = {win:2, draw:1, loss:0}`
(„Das ist gesetzt.", `battle-mode-arena-team-points.ts:36-40`), `arenaTeamPointsForFixture`
entscheidet über `seiten[0] === seiten[1]` auf Unentschieden. `seiten` selbst ist „für
Anzeige/Tie-Breaking, NICHT für die Punktevergabe". **Ein „normiertes Verhältnis", wie es der
Auftrag nennt, habe ich im Code nicht gefunden** (`grep normier|Verhaeltnis|ratio` in
`lib/resolve`, `lib/season`: nur Unverwandtes). Was es je Variante wäre, steht in Teil 3.6.

---

## 2. Die Recherche: wie echtes Gewichtheben zählt

### 2.1 Ablauf und Regeln

| Regel | Wert | Quelle |
|---|---|---|
| Übungen | Reißen, dann Stoßen; Zweikampf = bestes Reißen + bestes Stoßen | IWF, Competition flow; USAW „The Lifts" |
| Versuche | **maximal drei** je Übung | IWF TCRR |
| Mindeststeigerung | **1 kg** nach einem gültigen Versuch; die Hantel wird nie leichter | IWF TCRR (Websuche-Auszug: „Automatic progression after any successful attempt … must be a minimum of 1 kg") |
| Änderungen der Ansage | zweimal je Versuch, innerhalb der ersten 30 s | IWF TCRR (ebd.) |
| Nach einem Fehlversuch | dasselbe Gewicht darf wiederholt werden | Folge der Mindeststeigerungs-Regel (keine Pflicht zur Steigerung nach einem Fehlversuch) |
| Nullwertung | alle drei Versuche einer Übung ungültig → kein Zweikampf-Ergebnis | IWF, Competition flow |
| Gleichstand | seit 2017: **wer die Last zuerst erreicht hat**, gewinnt; Körpergewicht zählt nicht mehr | IWF, „IWF120y/30 – 2016: Do it first, no matter your body weight!" |
| Zeit je Versuch | 60 s, 120 s bei zwei Versuchen hintereinander | **nicht belegt** — das IWF-TCRR-PDF antwortete mit 403; ich kenne die Zahl, konnte sie an diesem Tag nicht abrufen |

### 2.2 Gelingensquoten je Versuch — die Zahl, an der die Spannung hängt

Quelle: *Analysis of successful and unsuccessful snatch and clean and jerk lifts in IWF World
Championships (2011–2023)*, Scientific Reports 2024 (PMC11564635). 3.144 Einzelergebnisse
von 528 Athleten (270 Männer, 258 Frauen), Senioren-Weltmeisterschaften.

| | 1. Versuch | 2. Versuch | 3. Versuch | gesamt |
|---|---:|---:|---:|---:|
| Reißen, Männer | **85,9 %** | **78,9 %** | **58,7 %** | 74,5 % |
| Stoßen, Männer | **89,3 %** | **74,4 %** | **51,4 %** | 72,0 % |
| Reißen, Frauen | 86,8 % | 71,3 % | 63,2 % | 73,7 % |
| Stoßen, Frauen | 84,5 % | 78,4 % | 53,6 % | 71,6 % |

Dazu, aus derselben Arbeit zitiert (van den Hoek et al. 2022): **95 % der Goldmedaillengewinner
(Männer) hatten 7 oder mehr gültige Versuche von 9.** Wer gewinnt, verfehlt selten — die
Fehlversuche sitzen bei den dritten Versuchen, und die dritten Versuche sind fast ein
Münzwurf. Das ist die Dramaturgie, die wir nachbauen.

**Was ich nicht gefunden habe:** eine belegte Nullwertungs-Quote (Anteil der Athleten ohne
Zweikampf-Ergebnis). Meine Simulation liefert 2,6 % aus den Quoten oben; ein realer Wert
fehlt.

### 2.3 Steigerungen zwischen den Versuchen

| Aussage | Wert | Quelle |
|---|---|---|
| Übliche Sprünge | **~5 kg vom 1. zum 2., 2–5 kg vom 2. zum 3.** Versuch, Reißen wie Stoßen | USA Weightlifting, „Counting Attempts" |
| Eröffnung | „5–10 kg unter der bisherigen Bestleistung" bei gut gelaufenem Training | USAW (ebd.) |
| Versuche als Anteil des Maximums | 1.: 90–92 %, 2.: 96–98 %, 3.: 101–103 % | **Powerlifting**, nicht Gewichtheben (PowerliftingTechnique.com; IPF-WM-Analyse 2012–2019: erfolgreiche Dritte eröffneten im Mittel bei 91 % und nahmen 96 % im zweiten). Als Größenordnung brauchbar, als Gewichtheben-Zahl nicht belegt |
| Reale Serie, Olympia 2024, 73 kg, Sieger | Reißen 155 / 155 / 162, Stoßen 191 / 199 / — (354 kg) | Wikipedia, Weightlifting at the 2024 Summer Olympics – Men's 73 kg |
| Reale Serie, Platz 2 | Reißen 148 / 152 / 152, Stoßen 190 / 194 / 198 (346 kg) | ebd. |

Die Serien zeigen die Wiederholung nach einem Fehlversuch (155 / 155, 152 / 152) genau so,
wie Teil 4.4 sie modelliert.

### 2.4 Sinclair — wie verschieden schwere Athleten vergleichbar werden

Formel (Wikipedia, *Sinclair coefficient*): bei Körpergewicht `x < b` ist der Koeffizient
`10^(A · (log10(x / b))²)`, sonst 1. Sinclair-Total = Zweikampf × Koeffizient.

| Zyklus | Männer A / b | Frauen A / b | Quelle |
|---|---|---|---|
| 2017–2020 | 0,751945030 / 175,508 kg | 0,783497476 / 153,655 kg | Wikipedia (mit Rechenbeispiel: 61,9 kg, 320 kg → 456,2) |
| 2021–2024 | 0,722762521 / 193,609 kg | 0,787004341 / 153,757 kg | torokhtiy.com Sinclair-Rechner — **nicht gegengeprüft**, das IWF-PDF antwortete mit 403 |

Ich rechne unten mit 2017–2020, weil dafür ein nachrechenbares Beispiel vorliegt (Kontrolle:
320 × 1,4257 = 456,2 — stimmt). Für uns zählt ohnehin nur die **Form** der Kurve: steil bei
leichten Athleten, flach oberhalb ~110 kg.

**Der reale Präzedenzfall für Chris' „Gesamtgewicht"-Variante ist die deutsche
Gewichtheber-Bundesliga** (de.wikipedia.org, *Gewichtheber-Bundesliga*): sechs Heber je
Mannschaft in der Wertung, Männer und Frauen gemischt, **keine Gewichtsklassen**, dafür eine
„Relativwertung" („von der gehobenen Zweikampflast wird ein vom Körpergewicht abhängiger
Relativabzug abgezogen"), und „die addierten Punkte der Heber stellen das Mannschaftsergebnis
dar". Das ist exakt Variante A — sie existiert, funktioniert und ist Fernsehsport (Die Finals).
Ein Einzelduell-Format je Position habe ich im realen Gewichtheben **nicht** gefunden; das
Vorbild dafür ist der Schach-Mannschaftskampf, den Speed-Schach schon nachbildet.

### 2.5 Weltrekorde und Spannen — damit die Zahlen im Spiel plausibel wirken

Männer, Kategorien 2018–2025 (Wikipedia, *World record progression men's weightlifting
(2018–2025)*):

| Klasse | Reißen | Stoßen | Zweikampf | Athlet |
|---|---:|---:|---:|---|
| 55 kg | 135 | 166 | **294** | Om Yun-chol (2019) |
| 61 kg | 146 | 176 | 321 | Li Fabin (2024) |
| 73 kg | 169 | 205 | 365 | Shi Zhiyong (2025) |
| 89 kg | 183 | 224 | 405 | Karlos Nasar (2024) |
| 109 kg | 200 | 242 | 435 | Yang Zhe (2024) |
| +109 kg | **225** | **267** | **492** | Lasha Talakhadze (WM Taschkent, 17.12.2021) |

Zwei Verhältnisse daraus, die der Plan direkt benutzt:

- **Reißen ≈ 45,7 % des Zweikampfs** — Talakhadze 225/492 = 0,457, Juniansyah 162/354 = 0,458,
  Nasar 183/405 = 0,452. Sehr stabil.
- **Spanne zwischen Klassen: 294 → 492, also +67 %.** Spanne **innerhalb** einer Klasse an der
  Spitze: Olympia 2024, 73 kg, Platz 1 bis 8: 354 → 330 kg, also **7 %**. Unser Feld ist viel
  breiter als eine Weltspitze (Eignung 10 bis 90 im selben Kader), die Spanne darf und muss
  größer sein — s. Teil 6.

---

## 3. Die Scoring-Frage — mit Zahlen statt Geschmack

### 3.1 Zwei Ebenen, die getrennt bleiben müssen

Was die Tabelle bekommt und was die Abnahme misst, sind zwei verschiedene Aggregate desselben
Spiels:

- **Team-Ergebnis** → `seiten`, daraus 2/1/0 (`arenaTeamPointsForFixture`).
- **Spieler-Wert** → `MOTOREN[d].wert()` je Spieler, daraus Spearman gegen die Eignung.

Chris' beide Varianten unterscheiden sich in der **ersten** Ebene. Die Rangtreue lebt in der
**zweiten**. Wer die Duell-Variante so baut wie Speed-Schach (`wert = vorteil`), koppelt
beides — und verliert die Rangtreue. Wer sie so baut, dass `wert` die eigenen kg sind,
bekommt beides.

### 3.2 Das Simulationsmodell

Kein Motor-Code — eine eigene Rechnung (`gewichtheben-sim.mjs`, 4000 Spiele je Zeile, Saat
1337), damit die Frage **vor** dem Bau beantwortet ist. Modell, jede Zahl ein Platzhalter
außer den Quoten:

- Eignung `E` je Heber normalverteilt um 55, Streuung 15 (auch 8 und 25 gerechnet), 6 je Seite.
- Zweikampf-Maximallast, Sinclair-normiert: `T = 100 + 3,8·E` kg (E=100 → 480, wie
  Talakhadze; E=0 → 100). Reißen 45,7 % davon (2.5), Stoßen 54,3 %.
- Drei Versuche je Übung bei 91 / 96 / 100 % der Maximallast; nach Fehlversuch Wiederholung.
- Gelingensquoten je Versuchsnummer **aus 2.2** (Männer): Reißen 0,859 / 0,789 / 0,587,
  Stoßen 0,893 / 0,744 / 0,514.
- Zweikampf = bestes Reißen + bestes Stoßen; eine Übung ohne gültigen Versuch → 0.
- Duell: Slot i gegen Slot i, mehr kg gewinnt, gleich → ½ : ½.

### 3.3 Das Ergebnis

| Kennzahl (6 je Seite, Eignungsstreuung 15) | Gesamtgewicht (A) | Duelle je Slot (B) |
|---|---:|---:|
| **rho(Eignung, eigene kg)** — gesamt / je Seite | **0,928 / 0,917** | **0,928 / 0,917** (identisch, wenn `wert` = eigene kg) |
| rho(Eignung, kg minus Gegner) — das Speed-Schach-Muster | — | **0,622 / 0,547** |
| rho(Eignung, Duell gewonnen 0/1) | — | 0,585 |
| **Unentschieden im Team-Ergebnis** | **0,1 %** | **29,2 %** |
| Favorit (höhere Eignungssumme) gewinnt entschiedene Spiele | 85,4 % | 87,7 % |
| Nullwertungen je Heber | 2,6 % | 2,6 % |
| Fehlversuche je Heber (von 6) | 1,61 | 1,61 |
| Spanne bester – schwächster Heber im Spiel | 178 kg | 178 kg |
| Duellstände | — | 4:2 **46 %** · 3:3 **29 %** · 5:1 18 % · 6:0 3 % · Rest mit ½ |

Und bei kleineren Kadern — die Spielerzahl wird je Saison auf 2..6 gewürfelt
(`lib/season/season-discipline-schedule.ts:89-94`):

| je Seite | rho eigene kg (gesamt / Seite) | rho kg minus Gegner | Unentschieden A | **Unentschieden B** |
|---:|---:|---:|---:|---:|
| 6 | 0,928 / 0,917 | 0,622 / 0,547 | 0,1 % | **29 %** |
| 4 | 0,917 / 0,900 | 0,617 / 0,512 | 0,2 % | **36 %** |
| 2 | 0,898 / 0,868 | 0,650 / 0,427 | 0,3 % | **49 %** |

Die kompakte Variante (ein Zweikampf-Gewicht, drei Versuche — also das heutige `rundenN:3`)
liest praktisch dasselbe: rho 0,939 / 0,924, Unentschieden B 30 %.

### 3.4 Was das heißt — Rangtreue

**Die Rangtreue trägt jede Variante, solange der Spieler-Wert die eigenen kg sind.** 0,92 liegt
weit über 0,80, und zwar in EINEM Spiel und je Seite (sechs Ränge). Der Grund ist die
Struktur des Sports: sechs Versuche, von denen jeder direkt die Kraft misst, und das Rauschen
sitzt nur in der Frage „bester Versuch bei 91, 96 oder 100 %" — eine Spanne von 9 % des
Maximums, gegen eine Eignungsspanne, die das Maximum um den Faktor 3 bis 4 spreizt.
Basketball kommt mit 2,4 Würfen je Spieler auf 0,74 (`battle-mode-nba2k-modell-plan.md`,
„Rauschgrenze"); Gewichtheben ist das rangtreueste Chassis, das wir haben werden.

**Was die Rangtreue bricht, ist ein Spieler-Wert mit Gegner drin.** `kg minus Gegner` liest
0,62 gesamt und 0,55 je Seite, der binäre Duellsieg 0,59. Das ist keine Schwäche des Duells,
sondern Statistik: ein starker Heber gegen einen noch stärkeren „verliert" und wäre nach
diesem Maß schlechter als ein mittlerer Heber gegen einen schwachen. Für Speed-Schach mag das
hingehen — dort gibt es kein absolutes Maß. Beim Gewichtheben gibt es eines, und es heißt
Kilogramm.

**Auflage daraus, hart:** `MOTOREN.gewichtheben.wert()` liefert die eigenen Sinclair-kg. Das
Duell-Flag darf `wert()` nicht umbiegen, wie es `:13996` heute für `duell:true` tut.

### 3.5 Was das heißt — Unentschieden

**29 % Unentschieden bei sechs Slots sind zu viele für eine 2/1/0-Tabelle.** Jedes dritte
Spiel endete 3:3. Bei vier Spielern jedes dritte bis zweite, bei zwei Spielern **jedes
zweite**. Zum Vergleich: Hockey hatte mit 18,8 % Unentschieden schon eine
„Produktentscheidung" auf dem Tisch (`hockey-rollout-plan.md` D.3, F.3). Das Gesamtgewicht
dagegen ist auf 1 kg genau und endet praktisch nie gleich (0,1 %).

Chris schreibt „so könnte man auch ein 3:3 bekommen" — und meint das, wie ich ihn lese, als
Reiz, nicht als Problem. Der Reiz bleibt erhalten, wenn 3:3 **möglich, aber entschieden** ist:

> **Vorschlag: Duelle entscheiden. Bei Gleichstand der Duelle entscheidet das
> Gesamtgewicht (Sinclair-normiert). Nur wenn auch das gleich ist: Unentschieden.**

Das ist nichts Erfundenes — es ist die IWF-Logik „Gleichstand → wer mehr getan hat" auf
Teamebene, und es ist, was jeder Schach-Mannschaftskampf mit Brettpunkten als zweitem
Kriterium macht. Das 3:3 bleibt als **Erlebnis** (die Kamera geht auf die Gesamtlast, „3:3 —
und jetzt zählt jedes Kilo"), verschwindet aber als **Tabellen-Rauschen**. Unentschieden
fällt damit auf die 0,1 % der Gesamtgewichts-Variante.

Die Alternative — 3:3 bleibt 3:3 — ist eine legitime Produktentscheidung (Teil 9.1). Sie
kostet Tabellenschärfe: bei 29 % Remis und 2/1/0 liegen die Teams enger, und die Saison
entscheidet sich stärker über die anderen Disziplinen.

### 3.6 Was das heißt — Tabelle und `seiten`

| | Variante A (Gesamtgewicht) | Variante B (Duelle) mit Tiebreak |
|---|---|---|
| `seiten` | `[1742, 1688]` (kg) | `[4, 2]` (Duelle) — plus kg als zweites Paar für Anzeige und Tiebreak |
| Sieg/Unentschieden | kg größer / gleich | Duelle größer; gleich → kg größer; beides gleich → Unentschieden |
| Ein „normiertes Verhältnis", falls es kommt | `kg_eigen / (kg_eigen + kg_gegner)` — liegt fast immer bei 0,45–0,55, sagt wenig | `duelle / n` — 0, ⅙ … 1, grob, aber lesbar; oder das kg-Verhältnis als Feinmaß |

Falls Chris das Verhältnis für die Tabelle wirklich will, taugt in B das **kg-Verhältnis** als
Feinmaß und die Duellzahl als Anzeige — die Duellzahl allein hat bei sechs Slots nur sieben
mögliche Werte.

### 3.7 Was das heißt — Zuschauer und Robustheit

- **Lesbarkeit.** „4:2" ist ein Ergebnis, das jeder versteht, der je eine Tabelle gelesen hat.
  „1.742 : 1.688 kg" ist eine Zahl, die erst am Ende Drama hat. Die Bundesliga löst das mit
  laufenden Relativpunkten und einem sehr eingeweihten Publikum; wir haben Chris.
- **Ein Ausreißer kippt bei A das ganze Spiel.** Eine Nullwertung (2,6 % je Heber, also in rund
  27 % der Spiele mindestens eine unter zwölf Hebern) nimmt bei A ~250–300 kg aus einer
  Teamsumme von ~1.700 — **ein** Heber mit drei Fehlversuchen entscheidet. Bei B kostet
  dieselbe Nullwertung genau ein Duell. Das ist das stärkste sachliche Argument für B, das
  Chris nicht genannt hat.
- **Der Slot bekommt Bedeutung.** Bei B entscheidet Chris mit der Aufstellung, wer gegen wen
  hebt (Teil 4.1). Bei A ist die Aufstellung nur eine Summe.
- **Zwei auf der Bühne** — Chris' Bild — ist bei B das natürliche Bild und bei A ein
  künstliches.

### 3.8 Empfehlung

**Variante B mit drei Auflagen:** (1) Spieler-Wert = eigene Sinclair-kg, (2) 3:3 → Gesamt-kg
entscheidet, (3) Paarung nach Slot-Rolle, nicht nach Listenposition. Variante A bleibt als
Tiebreak und als Anzeige im Spiel — beide Zahlen werden gezeigt, eine entscheidet.

---

## 4. Der Ablauf

### 4.1 Paarung: Slot gegen Slot, gleiche Rolle

`SLOTS_JE_DISC.gewichtheben` (`engine.js:2802-2809`) und `matchday-slot-roles.ts:121-128`
führen dieselben sechs Rollen: **Power Opener, Safe Lift, Pressure Lift, Technical Lift,
Grip Anchor, Final Attempt.** Paarung: mein Power Opener gegen ihren Power Opener, und so
weiter. Bei 2..5 Spielern je Seite gilt `slice(0, n)` der Rollenliste, wie überall
(`buildGeneratedSlotRoles`); beide Seiten haben damit dieselben Rollen und die Paarung ist
immer vollständig.

Heute paart `bauBuehne` nach Index i (`:7996-7997`), und der Index ist bei mir die
Aufstellungsreihenfolge, beim Gegner die Sortierung nach Disziplinwert (`OPP.slice(0,n)`,
`:7949`). Für Gewichtheben muss die Paarung über die **Rollen-ID** laufen, sonst hebt mein
Safe Lift gegen ihren stärksten Mann, nur weil der zufällig an Position 2 steht. Der Gegner
(KI) bekommt seine Rollen wie bisher aus der Liste in Reihenfolge — also den besten
Disziplinwert auf Power Opener, den zweiten auf Safe Lift usw. Ob das die klügste KI-Aufstellung
ist, ist ein eigenes Thema (Teil 10).

### 4.2 Reihenfolge: Duell für Duell, zwei auf der Bühne

Chris' Bild ist „immer 2 gleichzeitig … jeweils einer pro Team". Das ist **nicht** der reale
Ablauf (dort heben alle nach aufsteigender Last, quer durch die Teams), aber es ist das
bessere Bild für ein Duell, und es ist im Motor billiger — die Warteschlange wird zu sechs
Blöcken statt drei Runden:

```
Duell 1 (Power Opener):  Reißen  A1 B1 A2 B2 A3 B3  →  Stoßen  A1 B1 A2 B2 A3 B3  →  Stand 1:0
Duell 2 (Safe Lift):     …
```

Innerhalb eines Duells folgt die Reihenfolge der **realen Regel**: wer die leichtere Last
angesagt hat, hebt zuerst; bei gleicher Last, wer weniger Versuche hatte; danach fest A vor B.
Das kostet nichts und macht das Bild ehrlich — der Schwächere eröffnet, der Stärkere wartet.

**Eine Variante, die realer ist und die Chris kennen sollte:** erst alle sechs Duelle Reißen,
dann alle sechs Stoßen (so läuft jeder Wettkampf). Der Duellstand entstünde dann erst am Ende,
nach dem letzten Stoßen — mehr Spannung am Schluss, weniger unterwegs. Beides ist dieselbe
Warteschlange in anderer Sortierung; die Entscheidung ist Teil 9.6.

### 4.3 Versuche und Steigerung: die Slot-Rolle ist die Versuchsstrategie

Das ist der Punkt, an dem Gewichtheben etwas bekommt, was keine andere Bühnen-Disziplin hat:
die sechs Rollen **beschreiben schon Versuchsstrategien**, ohne dass es je jemand so gebaut
hat. Vorschlag, alle Prozentwerte **Platzhalter**, gemessen wird gegen die Quoten in 2.2:

| Rolle | Text heute | Eröffnung (Anteil Tagesmax) | Sprung 1→2 | Sprung 2→3 | Woher die Zahl |
|---|---|---:|---:|---:|---|
| Power Opener | „Setzt die Basis über maximale Power" | 92 % | +4 % | +3 % | solide, kein Wagnis — der Opener soll stehen |
| Safe Lift | „Sichert Punkte über Health und Determination" | **94 %** | +3 % | +2 % | höchste Gelingchance, niedrigstes Ziel |
| Pressure Lift | „Geht aggressiv in schwere Versuche" | 89 % | +6 % | +5 % | größte Sprünge; Ziel 3. Versuch ≈ 103 % |
| Technical Lift | „Belohnt saubere Ausführung" | 91 % | +5 % | +4 % | Standard-Serie (USAW 5 / 2–5 kg) plus TECHNIK-Bonus auf die Quote |
| Grip Anchor | „Hält über Will und Determination, wenn es eng wird" | 92 % | +4 % | +4 % | NERVEN-Bonus auf den dritten Versuch |
| Final Attempt | „Lebt vom großen Moment und Charisma" | 90 % | +4 % | **+6 %** | der dritte Versuch ist das Wagnis; Charisma-Bonus genau dort |

Reale Referenz für die Sprünge: 5 kg / 2–5 kg (USAW) bei Maximallasten um 150–200 kg, also
rund 3 % / 1,5–3 %. Unsere Sprünge sind etwas größer, damit sechs verschiedene Rollen
sichtbar verschieden heben. Mindeststeigerung 1 kg, ganze Kilogramm, nie abwärts — die drei
IWF-Regeln aus 2.1, unverändert übernommen.

**Reaktion auf den Duellstand** — das, was ein Duell von einem Einzelauftritt unterscheidet:
liegt der Heber vor dem dritten Versuch hinter dem Gegner, zieht sein dritter Versuch
mindestens auf **Gegnerlast + 1 kg** (die IWF-Idee „nimm ein Kilo mehr für den Sieg"). Ob
er das schafft, entscheiden LAST und NERVEN. Liegt er vorne, nimmt er seine geplante
Steigerung. Damit ist das Duell keine Nebeneinanderrechnung, sondern ein Wechselspiel — und
der Rangtreue schadet es nicht, weil `wert()` weiter die eigenen kg sind.

### 4.4 Gelingen und Misslingen

Je Versuch: `p = p_basis(versuchsnummer) + technik + nerven − wagnis`. Die Basis kommt aus
2.2 (85,9 / 78,9 / 58,7 % Reißen; 89,3 / 74,4 / 51,4 % Stoßen). `technik` und `nerven`
verschieben um wenige Prozentpunkte (Platzhalter ±5), `wagnis` misst, wie weit die Ansage über
dem Tagesmaximum liegt: 100 % kostet nichts, 103 % kostet spürbar, 106 % ist ein Wurf.

- **Gelingt:** Last steht, nächste Ansage = Last + Sprung.
- **Misslingt:** Last bleibt, nächster Versuch wiederholt sie (2.3 zeigt genau das: 155 / 155,
  152 / 152). Beim dritten Versuch nach zwei Fehlversuchen greift die Nullwertungsgefahr.
- **Alle drei Versuche einer Übung ungültig:** Zweikampf 0, das Duell ist verloren, sofern der
  Gegner ein Ergebnis hat. Das ist `failAbzug:0`, wie der Kommentar `:7797-7798` es heute
  schon meint — nur ehrlich als Nullwertung und nicht als „Runde ohne Punkte". Abmildern
  (Teil 9.4) würde die reale Härte nehmen, die diesen Sport ausmacht; ich rate davon ab und
  verweise auf 2,6 % je Heber.
- **Duell-Gleichstand:** gleicher Zweikampf → gewinnt, wer die Last mit **weniger Versuchen**
  erreicht hat; auch gleich → wer sie **zuerst** hatte (Reihenfolge aus 4.2). Das ist die
  IWF-Regel seit 2017 und macht ein ½:½ praktisch unmöglich — die Duellstände aus 3.3
  („3,5:2,5" 2 %) verschwinden.

### 4.5 Dauer

| Fassung | Ereignisse | bei 1,65 s je Ereignis | Anmerkung |
|---|---:|---:|---|
| Voll: Reißen + Stoßen, 6 Duelle × 12 Versuche | 72 | **119 s** | Chris' 60-s-Wunsch verfehlt; auf 60 s wären es 0,83 s je Hebung — zu schnell, um eine Hantel zu sehen |
| Kompakt: ein Zweikampf-Gewicht, 6 Duelle × 6 Versuche | 36 | **59 s** | trifft das heutige Tempo; rho praktisch gleich (3.3) |
| Voll, alle Reißen dann alle Stoßen | 72 | 119 s | wie Zeile 1, andere Sortierung |

Hockey hat für sich 240 s Simulationszeit bekommen (Chris: „3 drittel zu 1:20"). Zwei Minuten
für zwölf Heber mit je sechs Versuchen sind vertretbar; die Entscheidung gehört Chris (9.2).
Die Kompakt-Fassung verliert das Reißen/Stoßen-Paar — für den Zuschauer der halbe Sport,
für die Zahlen unerheblich.

---

## 5. Welche Attribute welchen Teil tragen

Matrix (`BASIS_JE_DISC.gewichtheben`, `engine.js:2763`, generiert aus
`official-discipline-weights.ts`):

| power | charisma | health | determination | will | speed | dexterity | stamina |
|---:|---:|---:|---:|---:|---:|---:|---:|
| **28** | **23** | 16 | 12 | 7 | 6 | 6 | 2 |

Zwei Dinge fallen sofort auf. **Charisma ist fast so schwer wie Power** — die Matrix sagt,
das Publikum trägt den Heber. Und **stamina ist mit 2 fast nichts** — ein Wettkampf mit sechs
Versuchen ist kein Ausdauersport. Die heutigen sieben Bühnen-Rollen (GRUNDLAGE, SPITZENMOMENT,
TECHNIK, PUBLIKUM, NERVEN, AUSDAUER, WAGNIS) sind für Auftritte gemacht; Gewichtheben
braucht **fünf**, die je einen Teil der Zustandsmaschine in 4.3/4.4 tragen. Vorschlag nach
Chris' Budget-Methode (jedes Attribut verteilt sein Matrixgewicht auf Sub-Skills, in denen es
logisch sitzt):

| Sub-Skill | Trägt | Rezept (Platzhalter) | Begründung aus der Matrix |
|---|---|---|---|
| **LAST** | Tagesmaximum in Sinclair-kg — die Zahl, an der alles hängt | power 60, health 25, determination 15 | Power ist das Maximum; Health die Struktur, die es hält |
| **TECHNIK** | Grund-Gelingchance jedes Versuchs | dexterity 35, speed 30, determination 20, power 15 | Speed und Dexterity (je 6) haben sonst keinen Ort; die Zugphase ist Schnellkraft und Präzision |
| **NERVEN** | Gelingchance beim dritten Versuch und beim Versuch „Gegner + 1" | charisma 35, will 35, determination 20, health 10 | Charisma **muss** ausgangswirksam sitzen — die 64-Pp-Lektion (`:7801-7807`) |
| **ANSAGE** | Größe der Sprünge und Eröffnungshöhe relativ zur Rolle | charisma 45, power 30, speed 25 | das Wagnis; wer sich traut, sagt mehr an. Das zweite ausgangswirksame Zuhause für Charisma |
| **ERHOLUNG** | Wie viel vom Reißen-Maximum im Stoßen noch da ist, und der dritte Versuch nach zwei schweren | stamina 40, health 35, will 25 | das einzige Zuhause für stamina; klein, wie die Matrix es will |

**Charisma zweimal, immer mit Wirkung auf den Ausgang** — das ist die Vorsorge gegen die
Fehlkalibrierung, die diese Disziplin schon einmal hatte. Ob 23 % Einfluss dabei herauskommen,
entscheidet `einflussVon` nach dem Bau, nicht dieser Plan. Erfahrungswert aus Breaking und
I-Spy (`:7858-7864`, `:7919-7924`): ein Attribut, das nur in einer Erfolgschance-Rolle sitzt,
liest mehr als sein Gewicht; eines, das nur in einem flachen Bonus sitzt, liest weniger. LAST
ist hier die dominante Rolle (jedes Kilo zählt), und Power führt sie — die 28 dürften
erreichbar sein.

**Was `groesse` NICHT ist: ein Attribut.** Sie steht nicht in der Matrix, `einflussVon` hebt
sie nicht, die Rangtreue-Sonde kennt sie nicht. Wenn sie die Kilogramm **im Ergebnis**
verschiebt, wäre sie ein verstecktes neuntes Gewicht, das keine Messung sieht — und die
Rangtreue gegen die Eignung fiele, ohne dass jemand wüsste, warum. Deshalb Teil 6.3: die
Größe verschiebt die **angezeigten** kg, nicht das Ergebnis.

---

## 6. Die Zahlen, an denen die Abnahme hängt

### 6.1 Der Korridor

| Größe | Ziel | Real | Woher |
|---|---|---|---|
| Gelingensquote 1. Versuch | **84–90 %** | 85,9 / 89,3 % | Sci Rep 2024 |
| Gelingensquote 2. Versuch | **71–80 %** | 78,9 / 74,4 % | ebd. |
| Gelingensquote 3. Versuch | **50–63 %** | 58,7 / 51,4 % | ebd. |
| Fehlversuche je Heber (von 6) | **1,4–1,8** | aus den Quoten: ~1,6 | Rechnung |
| Nullwertungen je Heber | **≤ 3 %** | **nicht belegt**; Simulation 2,6 % | — |
| Unentschieden je Spiel (mit Tiebreak) | **≤ 1 %** | — | Simulation A: 0,1 % |
| Favorit gewinnt | **80–90 %** | — | Simulation: 85–88 %; Basketball/Hockey nicht vergleichbar gemessen |
| Reißen-Anteil am Zweikampf | **44–47 %** | 45,2–45,8 % | 2.5 |
| Spanne bester – schwächster Zweikampf im Spiel, normiert | **~150–200 kg** bei Eignungsstreuung 15 | Klassenübergreifend real 294–492 | 2.5, Simulation 178 kg |
| **Rangtreue rho, eigene kg, EIN Spiel, je Seite** | **≥ 0,80** | — | Simulation 0,92 — der Motor muss das bestätigen |
| Pp gegen die Matrix | ≤ 25 in zwei Stichproben, ≤ 15 in einer | — | dieselbe Regel wie Hockey (D.1) |

### 6.2 Die Kilogramm-Skala

`T_max(E) = 100 + 3,8 · E` Sinclair-kg — **Platzhalter.** Kontrolle an den Rändern: E=100 →
480 (Talakhadze 492), E=50 → 290 (ein Weltklasse-55-kg-Mann, 294), E=10 → 138 (ein
Hobbyheber). Das ist bewusst breiter als jede reale Klasse, weil unser Kader beides
enthält — Lava Golem (power 98, health 99) und Lulu (power 3, health 5) stehen in derselben
Liga. Ob die Formel linear bleibt oder unten abflacht, entscheidet die Rangtreue-Messung,
nicht der Geschmack.

### 6.3 Sinclair rückwärts: was die Größe mit der Anzeige macht

Real macht Sinclair aus gehobenen kg vergleichbare Punkte. Wir drehen es um: das **Ergebnis**
ist Sinclair-normiert (die Eignung entscheidet, wie die Matrix es will), die **Anzeige**
teilt durch den Koeffizienten der Größe. Größe 1..10 auf ein Körpergewichts-Analog 55..175,5
kg gelegt (geometrisch, damit die Mitte nicht auf 115 kg fällt), Koeffizienten 2017–2020:

| Größe | Analog kg | Koeffizient | Anzeige bei 480 normiert | Anzeige bei 250 normiert |
|---:|---:|---:|---:|---:|
| 1 | 55 | 1,552 | **309** | 161 |
| 3 | 71 | 1,305 | 368 | 192 |
| 5 | 92 | 1,145 | **419** | 218 |
| 7 | 119 | 1,050 | 457 | 238 |
| 10 | 175,5 | 1,000 | **480** | 250 |

Ein Zwerg (Größe 1) mit Eignung 100 zeigt 309 kg — realistisch für die 55-kg-Klasse (294).
Ein Riese mit derselben Eignung zeigt 480. **Beide gewinnen ihr Duell gegen dieselben
Gegner gleich oft**, weil das Duell auf den 480 normierten entschieden wird. Der Zuschauer
sieht: der Kleine hebt weniger, aber er hebt *relativ* genauso viel — und genau das erzählt
die Anzeige, wenn beide Zahlen stehen („309 kg · 480 Sinclair").

Die Alternative — absolute kg entscheiden, Größe hebt mit — ist in 9.3 als Entscheidung
notiert. Sie ist realistischer und macht den Lava Golem zum Favoriten, den er ohnehin ist;
aber sie macht die Größe zu einem Gewicht außerhalb der Matrix, und 48 % der Spieler haben
Größe 5, sodass der Effekt vor allem an den Rändern sitzt.

---

## 7. Was der Bühnen-Motor hergeben muss — und was fehlt

| Element | Vorhanden? | Woher / was fehlt |
|---|---|---|
| Teilnehmer je Seite mit Slot und Attribut-Aufschlägen | **ja** | `bauBuehne` `:7949-7961`, seit #736 mit echter Aufstellung |
| Paarung Seite 0 gegen Seite 1 | **ja, nach Index** | `:7995-8009` — muss nach Rollen-ID paaren |
| Warteschlange, die Ereignisse über die Zeit enthüllt | **ja** | `buehneQueue`/`stepBuehne` — Sortierung ist heute rundenweise über alle; braucht Duell-Blöcke mit lastabhängiger Reihenfolge (4.2) |
| Feed-Zeile und Schwebetext je Ereignis | **ja** | `feed`, `schwebe` — Texte werden „162 kg — gültig" / „Fehlversuch bei 199 kg" |
| HUD: Score als Bretter im Duell | **ja** | `updateHudBuehne` `:8073-8076` — zählt `vorteil > 0`; muss Duellsieg nach 4.4 zählen und kg daneben zeigen |
| `wert()` je Spieler | **ja, falsch für uns** | `:13996` gibt im Duell `vorteil`; muss eigene Sinclair-kg geben (3.4) |
| `sichern`/`zurueck` | **ja** | `:13985-13989` — neue Felder (Duellstand, Lasten) kommen dazu |
| Bühnenbild | **teilweise** | `zeichneBuehne` `:8105` zeichnet zwei Reihen à sechs; das Duell braucht **zwei Figuren mittig plus Hantel mit kg** und die vier wartenden Paare klein am Rand |
| Größe je Teilnehmer | **ja** | `L.groesse` `:7961`, `groesseFaktor` fürs Sprite; für 6.3 zusätzlich als Anzeige-Koeffizient |
| Versuchs-Zustandsmaschine (Last, Steigerung, Wiederholung, Nullwertung) | **nein** | die generische Durchgangsformel rechnet unabhängige Runden — das ist der eigentliche Neubau: ein `bauHeben`, das die drei Versuche je Übung **abhängig** würfelt und die Reaktion auf den Duellstand kennt |
| Rezept-Eintrag in `battle-mode.rezepte.js` | **nein** | nur Basketball und Hockey sind ausgelagert; Gewichtheben zieht heute über den Inline-Rückfall |
| Rangtreue-Sonde für die Bühne | **nein** | `feldspielProbe` ist Feldspiel-only; eine `buehneProbe(disc, opt)` mit `eig`/`wert` je Teilnehmer und `jeSeite` fehlt — **ohne sie ist rho ≥ 0,80 nicht messbar** |
| Produktionspfad (Arena entscheidet den Spieltag) | **nein** | `ARENA_RESOLVED_DISCIPLINE_IDS` nur Basketball; `barbell.tsx` malt Team-kg aus dem PPS-Score |

**Die Bauform, empfohlen:** kein fünfter Motor, sondern ein **zweiter Rundenrechner innerhalb
der Bühne**. `BUEHNE_ART.gewichtheben` bekommt `heben:true` (statt `duell:true`); `bauBuehne`
verzweigt für `heben` in eine eigene Versuchsrechnung, die je Teilnehmer `versuche[]`,
`bestReissen`, `bestStossen`, `zweikampf`, `sinclair` schreibt, und in eine eigene
Queue-Sortierung. Alles andere — Teilnehmerbau, Slot-Aufschläge, Feed, HUD, Sichern —
bleibt die Bühne. Das ist dieselbe Entscheidung, die Speed-Schach vor mir getroffen hat („kein
eigener fuenfter Motor", `:7988-7990`), nur eine Stufe tiefer im Rundenrechner. Speed-Schach,
I-Spy und die vier Auftritts-Disziplinen müssen danach **bit-identisch** laufen.

---

## 8. Die Schrittfolge

| Schritt | Was | Ändert Spielverhalten? |
|---|---|---|
| **S0** | **Bühnen-Sonde**: `buehneProbe(disc, {n, jeSeite})` nach dem Muster von `feldspielProbe`, plus `scripts/miss-buehne-rangtreue.mjs`. Erste Messung **des heutigen Standes** aller sieben Bühnen-Disziplinen — die ehrliche Lückenliste, bevor irgendetwas umgebaut wird | nein (Messung) |
| **S1** | **Der Heber-Rundenrechner** mit Platzhalter-Zahlen aus Teil 4–6: `heben:true`, fünf Sub-Skills, Rollen-Paarung, Versuchs-Zustandsmaschine, Reaktion auf den Duellstand, Nullwertung, IWF-Gleichstandsregel, Duellblöcke in der Queue, `wert()` = eigene Sinclair-kg, `seiten` = Duelle mit kg-Tiebreak. Rezept nach `battle-mode.rezepte.js` | **ja**, Gewichtheben — erstmals mit Kilogramm |
| **S2** | **Bühnenbild**: zwei Heber mittig, Hantel mit angesagter Last, gültig/ungültig als Geste, Duellstand groß, Gesamtlast klein, wartende Paare am Rand. Feed-Texte nach 4.4 | Optik |
| **S3** | **Kalibrierung** gegen 6.1: Quoten je Versuchsnummer, Fehlversuche je Heber, Nullwertungen, Spanne, Reißen-Anteil; Pp bei n=48 mit zwei Saatstämmen | ja |
| **S4** | **Rangtreue und Archetypen**: rho ≥ 0,80 je Seite in EINEM Spiel; vier Archetypen — *Kraftpaket* (power/health) führt bei LAST, *Techniker* (dexterity/speed) bei der Gelingensquote, *Nervenbündel* (will/charisma) bei dritten Versuchen, *Zocker* (charisma/speed) bei den größten Sprüngen — jeder führt in seiner Kategorie, gegen sonst neutrale Heber, 300+ Spiele | ja |
| **S5** | **Größe → Anzeige** nach 6.3; beide Zahlen im HUD; Test: dieselbe Saat mit vertauschten Größen ändert **kein** Ergebnis, nur Anzeige-kg | nein (Anzeige) |
| **S6** | **Produktivierung**: `gewichtheben` in `ARENA_RESOLVED_DISCIPLINE_IDS`, Orchestrator, `barbell.tsx` liest echte Heber-kg statt Team-kg aus dem PPS-Score | ja, Produktion |

### 8.1 Abnahme je Schritt

- **S0:** die Sonde liefert für jede der sieben Bühnen-Disziplinen `eig` und `wert` je
  Teilnehmer; `rho` ist für Speed-Schach und I-Spy **mit** und **ohne** Gegner im Wert
  ausgewiesen (das ist die Kontrollmessung zu 3.4 am echten Motor, bevor Gewichtheben
  gebaut wird).
- **S1:** `spiele("gewichtheben", 1337)` liefert je Heber sechs Versuche mit kg und
  gültig/ungültig, die Last steigt nie, nach Fehlversuch wird wiederholt, Zweikampf = bestes
  Reißen + bestes Stoßen, Nullwertung möglich; `seiten` ist `[Duelle, Duelle]`; bei jeder
  Kadergröße 2..6 sind alle Duelle vollständig gepaart; **Speed-Schach, I-Spy, Showcase,
  Eiskunstlauf, Breaking, Wettessen bit-identisch** (Protokoll bei Saat 1337 zeichenweise
  gleich).
- **S2:** ein Spiel läuft im Browser ohne Seitenfehler durch, und die Feed-Zeilen lesen sich
  wie ein Wettkampf („Reißen, 2. Versuch, 152 kg — gültig").
- **S3:** alle Zeilen aus 6.1 im Korridor; Pp ≤ 25 in beiden Stichproben, ≤ 15 in einer.
- **S4:** rho ≥ 0,80 je Seite bei 6, 4 **und** 2 je Seite — die Simulation sagt 0,92 / 0,90 /
  0,87, der Motor muss es zeigen; vier Archetypen führen je in ihrer Kategorie.
- **S5:** Größentausch-Test grün.
- **S6:** ein Spieltag mit Gewichtheben als Disziplin 1 läuft headless durch und schreibt
  2/1/0 und `seiten` in den Spielstand; Basketball und Hockey bit-identisch.

---

## 9. Was Chris entscheiden muss

**9.1 — 3:3: entschieden oder unentschieden?** Meine Empfehlung: Gesamt-kg entscheidet,
Unentschieden nur bei doppeltem Gleichstand (3.5). Alternative: 3:3 bleibt Remis — dann sind es
**29 % Remis bei sechs, 36 % bei vier, 49 % bei zwei Spielern**, und die Tabelle wird flacher.

**9.2 — Voll oder kompakt?** Reißen + Stoßen mit sechs Versuchen (~2 min) oder ein
Zweikampf-Gewicht mit drei Versuchen (~60 s, das heutige Tempo). Rangtreue gleich; das
Erlebnis nicht. Meine Empfehlung: voll — Reißen/Stoßen ist der Sport, und zwei Minuten sind
kürzer als Hockeys vier.

**9.3 — Sinclair-normiert oder absolute kg?** Normiert: die Größe ist nur Anzeige, die Matrix
entscheidet (Empfehlung, 6.3). Absolut: der Riese hebt wirklich mehr, aber die Größe wird ein
Gewicht außerhalb der Matrix, das keine Messung sieht.

**9.4 — Nullwertung hart?** Drei Fehlversuche in einer Übung = 0, wie real (Empfehlung; 2,6 %
je Heber). Oder abgemildert (der beste gültige Versuch der anderen Übung zählt allein) — dann
verliert die Disziplin ihr größtes Drama.

**9.5 — Paarung nach Rolle oder nach Stärke?** Nach Rolle heißt: Chris' Aufstellung bestimmt
die Duelle, und ein bewusst schwach besetzter Slot ist ein Zug (Empfehlung). Nach Stärke
(Setzliste: Bester gegen Besten) heißt: die Aufstellung ist nur noch Auswahl, nicht Ordnung.

**9.6 — Reihenfolge:** Duell für Duell (zwei auf der Bühne, Chris' Bild — Empfehlung) oder
erst alle Reißen, dann alle Stoßen (der reale Ablauf, Spannung erst am Ende).

**9.7 — Zahlen für die KI-Aufstellung.** Der Gegner setzt heute nach Disziplinwert in
Listenreihenfolge. Bei Rollen-Paarung wäre das ausnutzbar (mein Bester gegen seinen
Schwächsten, sobald ich sein Muster kenne). Ob das für Saison 1 egal ist, entscheidet Chris.

---

## 10. Was ich nicht geprüft habe

- **Die IWF-Regeltexte im Original.** Das TCRR-PDF (2020 und 2025) antwortete mit 403; die
  Regeln in 2.1 stammen aus Websuche-Auszügen und der IWF-Seite „Competition flow"
  (ebenfalls 403 beim Volltext). Die Zeitlimits (60 / 120 s) sind **unbelegt**.
- **Die Sinclair-Koeffizienten 2021–2024** aus dem IWF-PDF (403). Die Werte von torokhtiy.com
  weichen von 2017–2020 ab und sind nicht gegengeprüft. Für die Form der Kurve ist das
  unerheblich, für eine Zahl im Code nicht — vor S5 einmal sauber belegen.
- **Eine reale Nullwertungs-Quote.** Nicht gefunden; 2,6 % ist meine Rechnung aus den Quoten.
- **Die Gelingensquoten sind Weltmeisterschafts-Elite.** Unser Feld ist breiter; ob ein
  schwacher Heber real öfter scheitert als ein starker (oder nur weniger ansagt), habe ich
  nicht belegt. Das Modell hält die Quoten je Versuchsnummer konstant und lässt nur die
  Ansage variieren.
- **Die Simulation ist mein Modell, nicht der Motor.** Sie beantwortet die Struktur-Frage
  (Duell-Wert bricht die Rangtreue, Duell-Zählung erzeugt 29 % Remis) belastbar, weil beides
  aus der Statistik folgt und nicht aus Feinheiten. Die absoluten rho-Werte (0,92) muss S4
  am Motor bestätigen.
- **Ob `slice(0, n)` der Rollenliste bei 2..5 Spielern die Rollen liefert, die Chris will**
  (bei zwei Spielern: Power Opener und Safe Lift). Das ist heute so für alle Disziplinen und
  keine Gewichtheben-Frage, aber die Paarung hängt daran.
- **Keine Zeile Code geändert.** Dieser Plan ist Recherche und Entwurf.

---

## Quellen

- Scientific Reports 2024, *Analysis of successful and unsuccessful snatch and clean and jerk
  lifts in IWF World Championships (2011–2023)* — https://pmc.ncbi.nlm.nih.gov/articles/PMC11564635/
- IWF, *Competition flow* — https://iwf.sport/weightlifting_/competition-flow/ (Volltext 403)
- IWF, *Technical and Competition Rules & Regulations 2025* — https://iwf.sport/wp-content/uploads/downloads/2025/11/IWF-TCRR-2025-as-of-05-November-2025.pdf (403; Regeln aus Websuche-Auszügen)
- IWF, *IWF120y/30 – 2016: Do it first, no matter your body weight!* — https://iwf.sport/2025/03/12/iwf120y-30-2016-do-it-first-no-matter-your-body-weight/
- USA Weightlifting, *Counting Attempts* — https://www.usaweightlifting.org/weightlifting101/counting-attempts
- PowerliftingTechnique.com, *How To Pick Attempts For Powerlifting* — https://powerliftingtechnique.com/how-to-pick-attempts-for-powerlifting/ (Powerlifting, nicht Gewichtheben)
- Wikipedia, *Sinclair coefficient* — https://en.wikipedia.org/wiki/Sinclair_coefficient
- torokhtiy.com, *Sinclair Calculator* (2021–2024) — https://torokhtiy.com/blogs/tools/sinclair-calculator
- Wikipedia, *Lasha Talakhadze* — https://en.wikipedia.org/wiki/Lasha_Talakhadze
- Wikipedia, *World record progression men's weightlifting (2018–2025)* — https://en.wikipedia.org/wiki/World_record_progression_men%27s_weightlifting_(2018%E2%80%932025)
- Wikipedia, *Weightlifting at the 2024 Summer Olympics – Men's 73 kg* — https://en.wikipedia.org/wiki/Weightlifting_at_the_2024_Summer_Olympics_%E2%80%93_Men%27s_73_kg
- Wikipedia (de), *Gewichtheber-Bundesliga* — https://de.wikipedia.org/wiki/Gewichtheber-Bundesliga
- Simulation: `gewichtheben-sim.mjs` (Scratch, nicht im Repo; Modell vollständig in 3.2 beschrieben)

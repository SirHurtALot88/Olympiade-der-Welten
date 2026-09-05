# Football: MATRIX-Neugewichtung und Assets — Recherche und Entscheidungsvorschlag (05.09.)

Reine Recherche, kein Code. Auftrag: Chris hat Budget freigegeben, Football soll Richtung
Produktionsreife — und zwar über die zwei Hebel, die die letzten Runden selbst benannt haben:
die **Attributmatrix** (`BASIS_JE_DISC.football`, `football-matrix-entscheidung.md`) und die
**Assets** („assets etc fuer football", `football-assets.md` war eine Beschaffungsrunde ohne
Verdrahtung). Alle Zahlen unten sind nachgemessen, nicht aus Berichten übernommen — an der
echten Kaderfamilie (`data/generated/kaderfamilie-live-save.json`, 110 Spieler, fünf
Paarungen), am Motor (`public/mockups/battle-mode.engine.js`) und am lokalen LPC-Checkout
(`/home/user/liberatedpixelcup/universal-lpc-spritesheet-character-generator`, Stand 23.08.).

---

## 0. Ergebnis vorab

**Matrix (Teil 1): Weg A, mit konkreten Zahlen.** Die heutige Matrix ist kein Football-Profil,
sondern ein Kader-Zufall: ihre zwei Topgewichte `spirit` (25) und `torment` (16) korrelieren
auf dem echten Kader mit **−0,58 gegeneinander** und heben sich damit auf; die tatsächliche
Rangordnung entsteht aus `health`/`determination`, und **`speed` wird mit −0,44 bestraft** —
in der Sportart, deren einziger belastbar prädiktiver Combine-Wert der Sprint ist.
Empfehlung:

    power 22, health 18, speed 14, torment 12, determination 10,
    awareness 8, stamina 6, dexterity 4, spirit 3, will 3      (Summe 100)

`torment` bleibt bewusst hoch (Platz 4) — die Dominanz war zur Hälfte richtig. `spirit` als
Nummer eins war es nicht. Details, Herleitung und was diese Matrix am Kader tut: Abschnitt 2.

**Assets (Teil 2): Es liegt weniger, als die Berichte klingen lassen — und es gibt mehr im
LPC-Fundus, als die letzte Suche gefunden hat.** Verdrahtet ist heute nur der Ball. Die drei
Kenney-Helme sind geladen und werden nirgends gezeichnet. Ein Football-Spieler sieht im Motor
exakt aus wie derselbe Charakter in der Arena. Die 03.09.-Suche suchte nach `*football*`,
`*jersey*`, `*pauldron*` — und übersah damit vier Layer, die unter anderen Namen genau die
gesuchte Silhouette liefern: `hat/helmet/bascinet_round` (runde Helmschale) +
`hat/visor/grated` (Gitter = Facemask) + `shoulders/mantal` (gepolsterte Schulterkappen) +
`torso/clothes/sleeveless/sleeveless2` (Trikot-Silhouette, 24 Stofffarben → Teamfarbe) +
`legs/leggings` (enge Football-Hose). Zusammengesetzt und angeschaut (Abschnitt 3.3): ein
erkennbarer Football-Spieler, alle Blätter im vollen `walk/run/idle/hurt/slash/shoot`-Satz,
dieselben Lizenzen wie der Rest des Baukastens. Grenze, ehrlich: das hilft nur der
LPC-Körper-Klasse — **45 der 110 Kaderfamilien-Spieler**; die 65 Vollbild-/Reihermech-Kreaturen
brauchen weiterhin die `sprite-handpunkte`-Vermessung, die `football-zufriedenstellend.md`
Abschnitt 5 schon als eigene Runde ausgewiesen hat.

**Drei Fragen kann nur Chris beantworten** (Abschnitt 2.7): ob die **produktive** Gewichtstabelle
angefasst werden darf (sie steuert Football-Rating, Teamstärke, KI-Kauf und Training aller
Spieler, nicht nur die Arena), ob das neue Bildgefühl stimmt (Stars werden Umbrafond,
Tidesprinter, Terradon — „Die Liebenden" fallen von Rang 4 auf 91), und wie „dreckig" Football
in dieser Welt sein soll (`torment` 12 oder mehr).

---

## 1. Ausgangslage — was vorliegt, was fehlt

- `football-matrix-entscheidung.md` (04.09.) hat Chris die Frage **A (Matrix ändern) oder B
  (Matrix akzeptieren, Schauspiel-Disziplin)** gestellt. **Eine explizite Antwort liegt im Repo
  nicht vor**: `origin/bug-reports` endet am 25.08. (keine Meldung erwähnt Football), keine
  spätere Doku-Ergänzung trägt ein A oder B. Der jetzige Auftrag — „weiter Richtung
  Produktionsreife", Assets — ist faktisch die Antwort A plus die visuelle Runde aus B. Dieses
  Dokument behandelt es so.
- Stand der Zahlen (kaderfest): rho je Spiel **0,468**, Saison 0,671, Spannweite 0,383
  (`stand-aller-disziplinen.md`). Zwei Rezeptrunden am 04.09. haben ihren Grenzertrag selbst
  benannt. Nichts davon wird hier wiederholt.
- Die Matrix ist keine Motor-Konstante: `BASIS_JE_DISC` wird aus
  `lib/player-generator/official-discipline-weights.ts` **generiert**
  (`scripts/generiere-arena-daten.ts`, Marker `<<< GENERIERT: arena-daten` in `engine.js:3326`).
  Wer nur den Motor ändert, verliert es beim nächsten Lauf. Konsequenz in Abschnitt 2.6.

---

## 2. Teil 1 — die MATRIX-Frage

### 2.1 Was die heutige Matrix am echten Kader tatsächlich tut

Matrix heute: `spirit 25, torment 16, health 14, awareness 11, will 10, determination 8,
power 6, stamina 6, charisma 4` (speed, dexterity, intelligence: 0).

Spearman-rho jedes Attributs gegen die daraus errechnete Football-Eignung (110 Spieler;
Kontrolle: `gewichtet(p.a, Matrix)` reproduziert `p.d.football` mit rho 1,000):

| Attribut | Matrixgewicht | rho zur Eignung | Kommentar |
|---|---:|---:|---|
| health | 14 | **+0,54** | trägt faktisch am meisten |
| determination | 8 | **+0,53** | |
| will | 10 | +0,49 | |
| power | 6 | +0,42 | trotz Gewicht 6 |
| charisma | 4 | +0,36 | |
| **spirit** | **25** | **+0,36** | Topgewicht, nur Platz 6 in der Wirkung |
| torment | 16 | +0,27 | |
| stamina | 6 | +0,16 | |
| intelligence | 0 | −0,17 | |
| dexterity | 0 | −0,31 | |
| awareness | 11 | **−0,34** | drittschwerstes Gewicht, negativ |
| **speed** | 0 | **−0,44** | wird bestraft |

Warum ein Attribut mit Gewicht 25 nur an sechster Stelle wirkt, zeigt die Interkorrelation
des Kaders (Auszug; volle Tabelle im Skript-Lauf, Spearman):

| | power | health | speed | awareness | spirit | torment |
|---|---:|---:|---:|---:|---:|---:|
| power | 1 | +0,70 | −0,18 | −0,45 | −0,43 | **+0,66** |
| speed | −0,18 | −0,34 | 1 | +0,50 | −0,13 | −0,06 |
| awareness | −0,45 | −0,56 | +0,50 | 1 | −0,08 | −0,15 |
| spirit | −0,43 | −0,21 | −0,13 | −0,08 | 1 | **−0,58** |

Der Kader hat zwei Cluster: **Wucht** (power/health/torment, untereinander +0,34 bis +0,70)
und **Finesse** (speed/dexterity/awareness, +0,50 bis +0,76), und `spirit` steht **gegen**
beide (−0,43 zu power, −0,58 zu torment). `spirit 25 + torment 16` summiert also zwei
Attribute, die dieselben Spieler fast nie zusammen haben — die Matrix belohnt am Ende, wer
gesund und entschlossen ist, und das war nie die Design-Absicht „Football". Der
awareness-Befund aus `football-rezept-kalibrierung.md` 4.2 (−0,335) ist dasselbe Phänomen:
awareness sitzt im Finesse-Cluster, das die Matrix mit power/health-Gewicht abstraft.

Zweite Folge, und die ist für rho direkt relevant: die Matrix **trennt die Spieler eines
Kaders kaum**. Von allen Spielerpaaren innerhalb eines Kaders haben heute nur **19 %** einen
Eignungsabstand von mindestens 15 Punkten (die Schwelle, ab der CLAUDE.md „Paartreue mit
Abstand" misst — Hockey ordnet solche Paare zu 99 % richtig). Mittlere Kader-Spannweite:
25,4 Punkte. Ein Motor kann nur ordnen, was die Zielgröße vorher auseinanderzieht.

### 2.2 Was echtes NFL-Wissen über die Eignung sagt

Zusammengefasst nach Positionsgruppe, mit Quellen (Anhang):

| Positionsgruppe | Was zählt (Scouting/Combine) | Unsere 12 Attribute |
|---|---|---|
| O-Line / D-Line | Masse (Ø 315 lb bei 6'5", Horton Barbell), Anker/Kraft, Kniebeuge-Fähigkeit („knee-bend", Benoit/SI); gedraftete Linemen sind messbar besser in Bench Press, 40 und 3-Cone als ungedraftete (Sport Journal) | **power, health**, stamina |
| RB | Sprint ist der EINZIGE Combine-Wert mit konsistenter Korrelation zur NFL-Leistung (Kuzmits & Adams 2008: 40/20/10-Yard bei RB; für QB/WR **keiner**); 10-Yard-Split bester Prädiktor für Yards je Versuch (JSCR 2016); „lateral agility" (Benoit) | **speed**, power, dexterity |
| WR / CB | 40-Yard korreliert bei CB mit Snaps in den ersten drei Jahren (SumerSports); Press-Coverage schlagen, Man-Coverage, Change-of-Direction (Benoit) | **speed, dexterity**, awareness |
| QB | Genauigkeit + Pocket-Bewegung (Benoit); Wonderlic sagt NICHTS voraus (Lyons/Hoffman/Michel 2009; Mirabile 2005 für Passer Rating) — „Intelligenz" als Rating ist real nicht belegt | dexterity, awareness, determination |
| LB / S | Play Recognition, Open-Field-Tackling (Benoit); 40 bei ILB über 0,30 (SumerSports) | awareness, power, speed |
| Alle | Madden: AWR dominiert die OVR-Formel fast jeder Position, SPD zählt dort **weniger** als die Spieler glauben (Olson 2017) — das ist aber eine SPIEL-Formel, keine Empirie, und AWR ist in Madden zu 90 % ein Alters-/Erfahrungs-Proxy | awareness moderat |

Zwei Lehren, beide gegen die Intuition:

1. **Masse und Kraft sind nicht ein Positionsdetail, sondern der Grundton der Sportart.** 22
   Spieler, davon 10 Linemen um 300 lb, jeder Snap beginnt mit einer Kollision. In einer
   6-gegen-6-Abstraktion ohne Positionen ist das der größte gemeinsame Nenner aller Slots.
2. **Der einzige harte Prädiktor ist Sprint** — und der fehlt heute komplett (`speed` 0,
   rho −0,44). Alle anderen Combine-Werte sind schwach (SumerSports: nur 5 von 11
   Positionsgruppen erreichen überhaupt r≈0,30).

### 2.3 Ist die spirit/torment-Dominanz teilweise richtig?

**torment: ja, zur Hälfte.** In diesem Spiel ist `torment` das „dunkle" Sozialattribut
(Import-Plan: Proxy aus `soc`; Archetyp-Bias +10 im Gegenstück zu „Angel" mit spirit +10 /
torment −8) — Einschüchterung, Aggression, Trash Talk. Dafür gibt es reale Evidenz: Yip,
Schweitzer & Nurmohamed (2018, OBHDP) zeigen experimentell, dass Trash Talk beim ZIEL Rivalität
und Anstrengung erhöht, kreative Leistung senkt und Regelbrüche fördert — in der NFL sichtbar
an der 2021 verschärften Taunting-Regel (15 Yards). Außerdem korreliert `torment` im Kader
+0,66 mit `power` — es SITZT im Wucht-Cluster und ist damit auch statistisch der richtige
Partner für eine Kollisionssportart. Deshalb bleibt es mit 12 auf Platz 4 (heute 16, Platz 2).
Was NICHT trägt: Keeler (2007, J. Sport Behavior) findet **keinen** Unterschied in
Sport-Aggression zwischen Kollisions-, Kontakt- und Nicht-Kontakt-Athleten — „Football-Spieler
sind aggressiver" ist Folklore, nicht Befund. Torment ist also ein Spiel-Stilmittel mit realem
Kern, kein Eignungs-Fundament; 12 statt 16 bildet das ab.

**spirit: nein, nicht als Nummer eins.** Mentale Zähigkeit bei Vierten Downs ist real und
wird von jedem Trainer beschworen — aber (a) sie ist als Eignungsmerkmal nicht messbar
(Wonderlic, der einzige standardisierte Kopf-Test, sagt null voraus), (b) sie wirkt in
Momenten, nicht als Rangbildner über ein Spiel, und (c) im Kader steht `spirit` GEGEN power
und torment — jede Einheit spirit-Gewicht kauft aktiv Anti-Kollision ein. Die heutige 25 ist
ein Nachklang der Basketball-Ära (`football-rollout-plan.md` Teil D: „unverändert seit
Basketball-Ära", Basketball führt spirit 22), kein Football-Entwurf. Empfehlung 3 — nicht 0,
weil der Motor `TEAMGEIST` als dritte Kreditvergabe-Achse braucht (`football-rezept-
kalibrierung.md` 4.4) und die drei Punkte ihn am Leben halten.

**awareness: das Madden-Argument zieht nicht durch.** AWR dominiert Maddens OVR — aber als
Alters-/Erfahrungs-Proxy in einer Spielformel. Real ist Play Recognition für LB/S/QB wichtig,
für Linemen und RB kaum. 8 (heute 11) hält es für PASSGENAUIGKEIT/ABWEHR_PASS verfügbar, ohne
dass das Finesse-Cluster die Wucht überstimmt.

### 2.4 Die Empfehlung — und was sie am Kader tut

    football: { power:22, health:18, speed:14, torment:12, determination:10,
                awareness:8, stamina:6, dexterity:4, spirit:3, will:3 }

Zum Vergleich Hockey (`power 18, health 18, speed 12, spirit 12, stamina 10, torment 10,
awareness 8, …`): Football liegt bewusst eine Stufe wuchtiger (mehr power, mehr torment,
weniger spirit), weil Hockey Tempo-Sport MIT Kollision ist, Football Kollisions-Sport MIT Tempo.

Nachgemessen an derselben Kaderfamilie (Spearman gegen die NEUE Eignung):

| | rho zur alten Eignung | power | health | speed | torment | awareness | spirit | SD Eignung | Kader-Spannweite | Paare ≥15 Pkt. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| heute | 1,000 | +0,42 | +0,54 | −0,44 | +0,28 | −0,34 | +0,36 | 8,6 | 25,4 | **19 %** |
| **Empfehlung** | 0,427 | **+0,88** | +0,70 | **+0,11** | +0,70 | −0,22 | −0,49 | 12,3 | 36,7 | **38 %** |
| sanfte Variante* | 0,787 | +0,81 | +0,74 | −0,13 | +0,58 | −0,37 | −0,12 | 9,1 | 26,9 | 22 % |

\* `power 16, health 16, spirit 14, torment 12, speed 10, determination 10, awareness 8, will 6,
stamina 4, charisma 4` — zum Zeigen, dass Halbherzigkeit nichts bringt: sie behält 79 % der
alten Rangfolge und gewinnt fast keine Trennschärfe. Nicht empfohlen.

Drei Dinge daran sind wichtig:

- **Die Zielgröße verschiebt sich massiv** (rho 0,43 zur alten). Das ist gewollt und der
  Grund, warum jede bisherige Football-Zahl danach unvergleichbar ist — neue Baseline nötig,
  wie `football-matrix-entscheidung.md` vorhergesagt hat.
- **speed wird neutral (+0,11), nicht dominant.** Ein reiner Sprinter (Raven: speed 96,
  power 26, health 12) steigt von Rang 103 auf 50 — Mittelfeld, kein Star. Ein
  Wucht-Sprinter (Umbramantis: power 71, speed 94, torment 76) steigt von 89 auf 13. Das ist
  das Profil eines Edge Rushers, und genau so soll es sein.
- **Die Trennschärfe verdoppelt sich** (Paare ≥15 Punkte: 19 % → 38 %, Spannweite 25 → 37).
  Das ist der einzige Hebel, den keine Rezeptrunde erreichen kann, weil er VOR dem Motor
  liegt. Ob daraus 0,80 wird, ist **ungemessen** — aber es ist die erste Änderung, die den
  Motor eine leichtere statt eine schwerere Aufgabe stellt.

Wer auf-/absteigt (Rang unter 110):

| Aufsteiger | Rasse | heute → neu | power/health/speed/spirit/torment |
|---|---|---:|---|
| Umbramantis | Animal | 89 → 13 | 71 / 41 / 94 / 14 / 76 |
| Bladewalker | Construct | 77 → 16 | 54 / 44 / 85 / 14 / 60 |
| Zeynorr Driftblade | Alien | 72 → 17 | 62 / 49 / 91 / 31 / 42 |
| **Absteiger** | | | |
| Die Liebenden | Human | 4 → 91 | 1 / 99 / 1 / 98 / 2 |
| Hollow | Construct | 19 → 94 | 12 / 19 / 25 / 88 / 54 |
| Matcha | Elf | 14 → 86 | 7 / 68 / 14 / 91 / 8 |

Neue Top 6: Umbrafond (Plant), Tidesprinter (Aqua), Brontar, Terradon, Tavascron
(Construct), Reefstrike (Aqua). Heute: Ser Camelot, Johanna, Vorrak, Die Liebenden, Elyon,
Midas. „Die Liebenden" mit power 1 und speed 1 auf Rang 4 einer Kollisionssportart ist das
Bild, das die alte Matrix produziert — Chris muss entscheiden, ob das neue Bild seins ist
(Frage 2, Abschnitt 2.7).

### 2.5 Was die neue Matrix für das Rezept bedeutet

Kein Rezeptvorschlag hier (der kommt aus Sondierung + Sinkhorn, nicht aus Recherche), aber
die `ERLAUBT`-Tabelle in `scripts/baue-feldspiel-rezept.mjs` muss um die neu bepreisten
Attribute wachsen, sonst kann Sinkhorn sie nicht verteilen:

| Sub-Skill | heute erlaubt | neu erlaubt (Vorschlag, reale Entsprechung) |
|---|---|---|
| LAUFKRAFT | power, health, spirit | **power, speed, health** (RB: Sprint + Kontaktbalance) |
| PASSGENAUIGKEIT | determination, will | **dexterity, awareness, determination** (QB: Genauigkeit, Lesen) |
| PASSSCHUTZ | health, determination, will | **power, health, awareness** (O-Line: Anker) |
| ABWEHR_PASS | torment, power | **speed, awareness, torment** (CB/S) |
| ABWEHR_LAUF | torment, power, health | unverändert (D-Line/LB) |
| BALLSICHERHEIT | health, will | **health, dexterity, determination** |
| TEAMGEIST | spirit, charisma, torment | **spirit, torment** (Receiver-Los, s. Kalibrierung 4.4) |
| AUSDAUER | stamina, health, will | unverändert |

Damit endet auch der Zustand, dass ein Quarterback ohne Geschicklichkeit und Wahrnehmung
auskommen muss (`PASSGENAUIGKEIT: {will 54, determination 46}`).

### 2.6 Blast-Radius: die Matrix ist produktiv, nicht nur Arena

`officialDisciplineWeightTable` in `lib/player-generator/official-discipline-weights.ts`
wird von 20 Dateien gelesen. Eine Änderung der Football-Spalte ändert für **jeden Spieler im
Spielstand**:

- `p.d.football` selbst — ligaweit rang-basiert neu berechnet
  (`lib/player-formulas/discipline-rating-engine.ts`, `rebuildLeagueDisciplineRatings`).
- **Teamstärke** (`lib/lineups/team-powers.ts`, Attribut-Fit je Slot).
- **KI-Kauf und Draft** (`lib/ai/organic-squad/*`, `retool-ai2-pick-engine.ts`: Bedarfsrechnung
  über `disciplineRatings`).
- **Training/Saisonende** (`lib/training/organic-season-progression.ts`: welche Attribute eine
  Disziplin trainiert), Scouting-Decken (`lib/scouting/*`), Transfermarkt-Anzeige.
- Die Arena-Matrix (`BASIS_JE_DISC`) nur über `npx tsx scripts/generiere-arena-daten.ts
  --schreiben`; die Slot-Profile in `SLOTS_JE_DISC.football` (Line Power „über Spirit und
  Torment", Route Burst „über Health und Will") wandern mit, die Rollentexte in
  `lib/lineups/matchday-slot-roles.ts:232-239` müssten von Hand nachgezogen werden.
- `data/generated/kaderfamilie-live-save.json` trägt `p.d.football` mit der ALTEN Matrix; für
  eine neue Baseline muss sie mit `scripts/ziehe-kader-familie.ts` neu gezogen werden (oder
  die Messung nutzt den Motor-Rückfall `gewichtet(p.a, BASIS_JE_DISC)`).

Das ist der Grund, warum es keinen „nur in der Arena ausprobieren"-Weg ohne Nebenwirkung
gibt: entweder die produktive Tabelle ändert sich (und mit ihr Kaufverhalten und Training),
oder Arena und Spiel rechnen Football unterschiedlich. Beides ist eine Entscheidung, keine
Technikfrage.

### 2.7 Offene Fragen an Chris

1. **Produktive Tabelle ändern — ja oder nein?** Empfehlung: ja, in einem Zug mit Motor,
   Kaderfamilie und Rollentexten, hinter einem Saisonwechsel (weil `rebuildLeagueDisciplineRatings`
   die Rangfolge aller Spieler in einer Disziplin neu setzt, die gerade gehandelt wird). Die
   Alternative — nur `BASIS_JE_DISC` von Hand — verstößt gegen den Generator-Marker und
   divergiert vom Spiel.
2. **Stimmt das neue Bild?** Umbrafond/Tidesprinter/Terradon/Brontar als Football-Stars,
   „Die Liebenden"/Velza/Matcha im Keller. Wenn Chris sich Football eher als
   Charakter-/Willens-Sport vorstellt, ist die Empfehlung falsch — dann ist aber auch 0,80
   mit diesem Motor nicht erreichbar, und Weg B (Schauspiel) ist die ehrliche Wahl.
3. **Wie dreckig?** `torment` 12 ist die Mitte zwischen „real belegt" (Trash Talk, Taunting)
   und „nicht belegt" (Aggressions-Persönlichkeit). Wer Football als die Disziplin der
   Bösewichte will, geht auf 16 und nimmt es von power (dann 18). Beides ist vertretbar; 12
   ist mein Vorschlag.

---

## 3. Teil 2 — Assets, vertieft

### 3.1 Was WIRKLICH im Repo liegt (nachgesehen, nicht nachgelesen)

| Was | Wo | Stand |
|---|---|---|
| `ball_football.png` (14×16), `helmet_white1/2/3.png` (19×19 bis 26×22), `quellen.json` | `public/sprites/football/` | vorhanden, CC0 dokumentiert |
| Ball **gezeichnet** | `engine.js:10029-10035` (`fkDa("ball_football")`, gedreht in Laufrichtung, Fallback-Ellipse) | **verdrahtet** |
| Helme **geladen** | `engine.js:14102-14105` (`FK_TEILE`) | geladen, **nie gezeichnet** — `helmet_white` kommt sonst nirgends vor |
| Feld | `bodenFeldspiel()`, `engine.js:9607-9628` | prozedural: zwei Endzonen (7 % Weiß), 9 Yard-Linien, Mittellinie. Bewusst **keine Torstangen**, keine Yard-Zahlen, keine Hash Marks |
| Trikot/Schulterpolster/Helm-Layer | — | **nicht vorhanden**; `grep -i schulterpolster` = 0 Treffer, `trikot` = 0 Treffer |
| Spieler-Look | Bauplan-Tabelle `engine.js:767ff` (`ruest:"leder"/"plate"/…`, `schulter`, `helm` = Greathelm, `visier` = Slit-Visor) | **identisch zur Arena** — Lederharnisch, Platte, Bart, Krone. Nichts weiß, dass es Football spielt |
| Teamfarbe | `--home`/`--away`-Tokens (`engine.js:12215`) für Ring, Namen, Mittellinie | Farbe am **Ring und Label**, nicht an der Figur; `RUEST_TON` kennt nur gold/bronze/dunkel |

Kurz: 237 `football`-Fundstellen im Motor sind Mechanik. Sichtbar football-spezifisch sind
genau zwei Dinge — der Ball und die Bodenlinien.

### 3.2 Die Lücken, nach Wirkung sortiert

1. **Silhouette.** Ein Football-Spieler ist an drei Formen erkennbar: runder Helm mit
   Gittermaske, breite gepolsterte Schultern, enge Hose. Alle drei fehlen. Das ist Chris'
   „umlackierter generischer Kämpfer".
2. **Teamfarbe an der Figur.** Heute unterscheiden sich Heim und Gast am Ring unter der Figur.
   Ein Trikot in Teamfarbe (Stofframpe → `--home`/`--away`) wäre für Lesbarkeit wichtiger als
   jede Requisite.
3. **Helm für Nicht-LPC-Kreaturen.** 65 von 110 Kaderfamilien-Spielern haben keinen
   `kopf:`-Bauplan (Lava Golem, Terradon, Umbrafond, Seraph-11 …). Für sie gibt es keinen
   Kopfpunkt — der Befund aus `football-zufriedenstellend.md` Abschnitt 5 hält.
4. **Feld-Details.** Yard-Zahlen und Hash Marks (Opus-Review: „beide billig, beide optional");
   Torstangen wurden bewusst weggelassen — eine schmale Andeutung am Canvas-Rand wäre trotzdem
   möglich, ist aber Geschmack, kein Mangel.
5. **Rückennummern**: kein LPC-Layer, müsste prozedural über den Torso gemalt werden; bei
   64 px Zellgröße etwa 5×7 px — grenzwertig lesbar, ich rate ab.

### 3.3 Was der LPC-Fundus dafür hergibt — gefunden, angeschaut, nicht erfunden

Die 03.09.-Suche war eine **Namenssuche** (`*football*`, `*jersey*`, `*pauldron*`, `*helmet*`
→ „nur mittelalterliche Typen"). Sie hat Recht: es gibt kein Football-Asset im LPC-Satz. Aber
sie hat nicht nach **Formen** gesucht. Nachgesehen im lokalen Checkout, Blätter zusammengelegt
(Body + Kopf + Layer, Blickrichtung unten/rechts/oben, 5-fach vergrößert) und angeschaut:

| Zweck | LPC-Pfad (`spritesheets/…`) | Varianten | Bewegungen | Lizenz (CREDITS.csv) | Befund |
|---|---|---|---|---|---|
| **Helmschale** | `hat/helmet/bascinet_round/adult/` | adult (passt auf male/female) | walk, run, idle, hurt, slash, shoot, thrust, spellcast u. a. — **voller Satz** | OGA-BY 3.0 (bluecarrot16, JaidynReiman, ElizaWy, castelonia) | runde, glatte Schale ohne Nasal/Kamm — von allen 26 Helmtypen unter `hat/helmet/` die football-nächste |
| **Facemask** | `hat/visor/grated/adult/` (schmaler: `grated_narrow`) | adult | voller Satz | wie oben | Gitter vor dem Gesicht; über der Bascinet-Schale liest es sich als Facemask. Unser vorhandenes `visier` ist `visor/slit` — Schlitz, nicht Gitter |
| **Schulterpolster** | `shoulders/mantal/male/`, `shoulders/mantal/thin/` (Alternative: `shoulders/bauldron/`) | male, thin (weiblich) | voller Satz inkl. run/idle | LPC-Standard | gerundete, hell gepolsterte Kappen, breiter als die bereits genutzten `pauldrons` — das „breite Schultern"-Signal |
| **Trikot** | `torso/clothes/sleeveless/sleeveless2/{male,female,teen}/` | drei Körper, **24 Stofffarben** (`white.png` … `teal.png`) | voller Satz inkl. run/idle | LPC-Standard | ärmelloses Oberteil = Trikot-Silhouette. Das einfachere `sleeveless/sleeveless/male` hat KEIN run/idle — deshalb `sleeveless2` |
| **Hose** | `legs/leggings/male/`, `legs/leggings/thin/` | male, thin | voller Satz | LPC-Standard | eng anliegend, das Gegenteil der Plattenbeine |
| Schuhe | `feet/shoes/basic/{male,thin}/` | | voller Satz | | optional |

Sichtprobe (Body + Kopf + leggings + sleeveless2 weiß + mantal + bascinet_round + visor
grated): ein Spieler mit Helm und Gitter, wuchtigen Schultern, weißem Trikot und enger Hose —
in allen drei Blickrichtungen als Football-Spieler lesbar, nicht als Ritter. Zum Vergleich
dieselbe Figur mit `helmet/close` (geschlossener Ritterhelm) und mit `torso/armour/legion`
(Bänderpanzer): beides kippt sofort zurück ins Mittelalter. Die Kombination ist also nicht
beliebig — es ist genau **diese** Schale plus **dieses** Gitter.

Was es im LPC-Satz **nicht** gibt, und das bleibt ehrlich so: kein Trikot mit Nummer, keine
Schulterpolster ÜBER einem Trikot (die `mantal`-Kappen sitzen auf dem Torso-Layer auf, was bei
ärmellosem Trikot gut aussieht), kein Football-Helm als solcher. Die drei Kenney-Helme sind
19–26 px große Icons in einem anderen Stil — als Overlay auf einem 64-px-LPC-Kopf würden sie
nicht passen; als Bildquelle für einen prozeduralen Helm wären sie „reine weiße Ringe ohne
Detail" (`football-zufriedenstellend.md` 5). Empfehlung: die Kenney-Helme **nicht** weiter
verfolgen, sie bleiben lizenzsauber im Repo und tun nichts.

### 3.4 Empfehlung Assets — drei Stufen, jede für sich abnehmbar

**Stufe 1 — Football-Bauplan-Override für LPC-Körper (der große Sichtgewinn).** Fünf neue
Baukasten-Ebenen aus dem LPC-Checkout nachziehen, exakt so wie `leder_frau`/`plate_frau`
(byte-identisch kopieren, `quellen.json`-Eintrag, `index.json`), Arbeitsnamen:

    fb_helm      ← hat/helmet/bascinet_round/adult/{walk,run,idle,hurt,slash,shoot}.png
    fb_maske     ← hat/visor/grated/adult/…
    fb_schulter  ← shoulders/mantal/{male,thin}/…
    fb_trikot    ← torso/clothes/sleeveless/sleeveless2/{male,female}/…/white.png
    fb_hose      ← legs/leggings/{male,thin}/…

Im Motor dann kein Eingriff in die 124 Baupläne, sondern ein Disziplin-Override beim
Zeichnen: `istFootball()` → `ruest`→`fb_trikot`, `hose`→`fb_hose`, `schulter`→`fb_schulter`,
`helm`→`fb_helm` + `fb_maske`, `krone/hoerner/bart/kapuze` aus. Frauen bekommen die
`female`/`thin`-Fassung über das bestehende `geschlecht:"w"`. Sichtprüfung per `renderProbe`
in echter Pixelgröße, wie bei jedem Layer bisher.

**Stufe 2 — Trikot in Teamfarbe.** `sleeveless2/white.png` hat eine kleine Stofframpe; sie
wird beim Nachziehen ausgezählt (wie bei `leder`) und als vierte `RUEST_QUELLEN`-Rampe
eingetragen. Zielrampe aus `--home`/`--away` (`css()`, `engine.js:12216`) statt aus
`RUEST_TON`. Ergebnis: Heim in Bernstein, Gast in Cyan — an der Figur, nicht nur am Ring.

**Stufe 3 — Vollbild-Kreaturen.** Für die 65 Nicht-LPC-Kreaturen bleibt der Befund von
`football-zufriedenstellend.md` 5: ein Helm-Overlay braucht eine per Sprite gemessene
Kopfpunkt-Tabelle (`sprite-handpunkte.md`-Aufwand, andere Ankerstelle). Das ist eine eigene
Runde. Bis dahin ist die ehrliche Zwischenlösung der **Teamfarben-Trikot-Ring** — oder man
akzeptiert, dass ein Lava-Golem keinen Helm trägt (er würde ihn ohnehin sprengen).

**Feld (billig, unabhängig):** Yard-Zahlen 10/20/30/40/50 in den Endzonen-Ton, Hash Marks
als kurze Striche — beide aus dem Opus-Review, beide reine `bodenFeldspiel()`-Zeilen.

Kein neuer Download, keine neue Lizenz, keine OpenGameArt-Suche nötig: alles oben liegt im
bereits geklonten Generator, unter denselben Lizenzen (OGA-BY/CC-BY-SA/GPL) wie die 77+209
Blätter, die der Baukasten schon führt.

---

## 4. Reihenfolge, wenn Chris A sagt

1. Matrix in `official-discipline-weights.ts` (Football-Spalte) + `generiere-arena-daten.ts
   --schreiben` + Rollentexte + Kaderfamilie neu ziehen → **neue Baseline messen**
   (`miss-alle-disziplinen.mjs 24 football basketball hockey`; Basketball/Hockey müssen
   bit-identisch bleiben, sie lesen andere Spalten).
2. `ERLAUBT.football` erweitern (2.5), Sondierung + Sinkhorn neu, Receiver-Los neu prüfen.
3. Assets Stufe 1 + 2 (3.4) — unabhängig von 1./2., kann parallel laufen, berührt keine
   Rangtreue.
4. Erst dann Produktivierung (`ARENA_RESOLVED_DISCIPLINE_IDS`) — „erst Mechanik, dann Rezept,
   dann Referenz", wie beim Hockey.

---

## Anhang: Quellen

NFL / Scouting / Combine:

- Kuzmits, F. E. & Adams, A. J. (2008): *The NFL Combine: Does It Predict Performance in the
  National Football League?* J. Strength Cond. Res. 22(6) —
  https://pubmed.ncbi.nlm.nih.gov/18841077/ (QB/RB/WR 1999–2004; nur Sprint bei RB korreliert)
- *Predictive Value of NFL Scouting Combine on Future Performance of Running Backs and Wide
  Receivers*, JSCR 2016 — https://doi.org/10.1519/JSC.0000000000001202 (10-Yard-Split bei RB)
- SumerSports: *NFL Combine by Position: How do the 40-Yard Dash and Other Drills Predict NFL
  Success?* — https://sumersports.com/the-zone/nfl-combine-by-position-how-do-the-40-yard-dash-and-other-drills-predict-nfl-success/
- The Sport Journal: *The NFL Combine: Do Performance Measures Predict Draft Status* —
  https://thesportjournal.org/article/the-national-football-league-combine-do-performance-measures-predict-draft-status-among-nfl-draftees/
  (gedraftete Linemen: Bench, 40, 3-Cone)
- Benoit, A. (SI, 2019): *The Most Important Trait at Every Position* —
  https://www.si.com/nfl/2019/03/20/nfl-draft-evaluation-most-important-trait
- Olson, R. S. (2017): *Machine Learning Madden NFL: How Madden player ratings are actually
  calculated* — https://www.randalolson.com/2017/01/10/machine-learning-madden-nfl-how-madden-player-ratings-are-actually-calculated/
- Lyons, Hoffman & Michel (2009), Wonderlic vs. NFL-Leistung — zusammengefasst in
  https://en.wikipedia.org/wiki/Wonderlic_test ; Mirabile (2005) zu Passer Rating ebd.
- Horton Barbell: *Average Height & Weight of NFL Offensive Linemen (2023-24)* —
  https://hortonbarbell.com/average-height-weight-of-nfl-offensive-linemen/ (6'5", 315 lb);
  WR/CB-Gegenstücke ebd. (≈199 lb / ≈193 lb)

Mentale Seite / Trash Talk / Aggression:

- Yip, J., Schweitzer, M. E. & Nurmohamed, S. (2018): *Trash-Talking: Competitive Incivility
  Motivates Rivalry, Performance, and Unethical Behavior.* OBHDP 144 —
  https://www.sciencedirect.com/science/article/pii/S0749597816301157
- Keeler, L. A. (2007): *The Differences in Sport Aggression, Life Aggression, and Life
  Assertion Among Adult Male and Female Collision, Contact, and Non-Contact Sport Athletes.*
  J. Sport Behavior — https://www.semanticscholar.org/paper/667b65c5607200b443f7cf669736b7eb5620a5fd
- NFL Taunting-Regel 2021 (Point of Emphasis) — https://vdgsports.com/nfls-taunting-rule-penalties-review-of-football-operations/

Repo-intern:

- `docs/design/football-matrix-entscheidung.md`, `football-rezept-kalibrierung.md` (4.2, 4.4,
  4.6), `football-gewichtheben-opus-review.md` (B.6), `football-zufriedenstellend.md` (5),
  `football-assets.md`, `football-rollout-plan.md` (A.4, C.4, D), `stand-aller-disziplinen.md`
- `docs/PLAYER_ATTRIBUTES_12_IMPORT_PLAN.md` (Attribut-Herkunft: spirit/torment aus `soc`,
  health aus `pow`), `lib/player-generator/player-generator-archetypes.ts` (torment-Bias)
- Messskripte dieser Recherche (nicht committed, Scratchpad): Spearman je Attribut,
  Interkorrelation, Kandidatenmatrizen, Paar-Abstände — alle auf
  `data/generated/kaderfamilie-live-save.json`, reproduzierbar mit numpy in unter einer Sekunde.

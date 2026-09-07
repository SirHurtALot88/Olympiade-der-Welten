# PM-Gesamtstand 07.09.2026 — was heute gelandet ist, was gerade läuft, was kollidieren wird

Reine Recherche und Analyse. **Keine Zeile Produktionscode geändert.** Dieser PR trägt genau
diese Datei.

Messstand: `origin/main` = `461e9014` (nach PR #841). Eigener Worktree (`/tmp/wt-pm-briefing`),
nicht der geteilte Arbeitsbaum — heute arbeiten sieben weitere Agenten parallel im selben Repo.
Beide Spiegel sind frisch geprüft (`scripts/pruefe-spiegel-frische.ts`, 07.09. 04:51 UTC):
`live-save` 0,0 h, `bug-reports` 0,2 h.

Vorgänger: `docs/pm-briefings/pm-gesamtstand-2026-09-06.md`. Was dort schon steht, wird hier
nicht wiederholt, sondern **nachgehalten** (Abschnitt 5).

---

## 0. Die sechs Sätze vorab

1. **Von Chris' heutiger Liste ist noch nichts fertig — und zwar nachgemessen, nicht vermutet.**
   Alle sieben Umsetzungs-Worktrees existieren (`/tmp/wt-zeitfahren-umsetzung`,
   `…-staffel-umsetzung`, `…-mini-dm-umsetzung`, `…-basketball-doppeln`, `…-gewichtheben-risiko`,
   `…-takeshi-animationen`, `…-broadcast-praesentation`), alle stehen auf `461e9014`, alle sind
   **leer**: null Commits, null geänderte Dateien, null offene PRs. Angelegt zwischen 04:45 und
   04:48 UTC — dieses Briefing entsteht **zeitgleich mit dem Start**, nicht danach. Es ist damit
   kein Rückblick, sondern eine Kollisionsvorhersage, und das ist der Zeitpunkt, an dem sie nützt.
2. **Drei der sieben schreiben in dieselbe Bahn-Chassis-Region** (`bauSpurt`/`stepSpurt`/
   `zeichneBahn`/`updateHudBahn`, `public/mockups/battle-mode.engine.js`), und **drei** editieren
   dasselbe `ZEIT_DEHNUNG`-Objektliteral (Zeile 17889–17941, ein Block aus rund 60 Zeilen
   Kommentar). Zwei bauen unabhängig voneinander **dasselbe** Broadcast-HUD über `.arenaraum`.
   Das ist kein Vorwurf an die sieben — es ist eine Folge der Aufgabenschneidung, und es lässt
   sich mit einer Merge-Reihenfolge entschärfen (Abschnitt 3).
3. **Die Rangtreue-Basislinie ist heute korrekt, wird es aber nach dieser Welle nicht bleiben.**
   PR #840 hat die Drift von neun Disziplinen per Git-Bisektion auf #813 und #820 zurückgeführt
   und nachgezogen. Genau dasselbe Muster ist für heute Abend absehbar — nur schwerer aufzulösen,
   weil dann **sieben** statt zwei Verursacher in Frage kommen. Und die Schranke läuft **erst nach
   dem Merge** (`ci-nightly.yml`, `on: push: branches: [main]`), nie auf dem PR.
4. **`docs/design/stand-aller-disziplinen.md` ist schon wieder überholt — zehn von zwanzig
   Zeilen.** Der schärfste Fall: **Tennis ist mit 0,786 unter die 0,80-Schranke gefallen**, das
   Dokument führt es weiter mit 0,814 als „bestanden". Der Fund steht als Nebenbemerkung in der
   Commit-Nachricht von #840 und in **keinem** Dokument, das jemand beim Priorisieren liest.
5. **Zeitfahren ist der einzige der sieben Aufträge, der die Rangtreue planmäßig senkt** — die
   eigene Recherche sagt 0,867 → 0,824…0,834, und mit der zusätzlich vorgeschlagenen Tagesform
   0,816…0,822. Die Schranke für `time-trial` ist **0,050**. Der geplante Rückgang liegt bei
   0,033–0,043 ohne Tagesform und bei **0,045–0,051 mit** — also auf, teils über der Kante. Das
   ist die einzige der sieben Aufgaben, bei der die CI nach dem Merge rot werden kann, und zwar
   erwartbar, nicht zufällig.
6. **Der größte Hebel des Projekts ist weiterhin kein rho-Thema, und er hat sich seit gestern
   verschoben.** Das Vorgänger-Briefing nannte die Produktivierung. Die ist angelaufen (drei → fünf
   Disziplinen). Nachgemessen am heutigen `live-save`-Abbild sitzt die Sperre aber **eine Ebene
   tiefer**: keiner der sieben Spielstände hat `scenarioMeta.gameMode` gesetzt, alle sieben sind
   damit Manager-Mode-Saves, und `gameMode` wird bei Save-Anlage entschieden und ändert sich nie
   wieder. **Die gesamte Arena-Produktivierung — alle fünf Disziplinen — wirkt sich heute auf
   keinen einzigen Spielstand von Chris aus.** Der zuständige Schalter ist eine
   Radio-Auswahl beim Neuen Spiel (`FoundationTeamSettingsNewLook.tsx:648–668`), die noch nie
   benutzt wurde. Dazu kommt: der jüngste Save wurde zuletzt am **23.08.** angefasst.

---

## 1. Rangtreue aller zwanzig — Stand 07.09.

Alle zwanzig Zeilen unten sind für dieses Briefing **heute an `461e9014` frisch gemessen** —
`node scripts/miss-alle-disziplinen.mjs 24` in einem eigenen Worktree, kaderfest über fünf echte
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`. Keine Zahl stammt aus einem
Dokument. Die Spalte „Doku sagt" vergleicht mit `docs/design/stand-aller-disziplinen.md`,
Abschnitt 1.

**Nebenergebnis mit eigenem Wert:** dieser volle Neuzug kommt **auf allen zwanzig Zeilen
zahlengleich** mit `data/generated/rangtreue-basislinie.json` zurück — der Datei, gegen die die
CI prüft. PR #839 und #840 hatten ihre Einträge **von Hand** nachgezogen statt neu gebaut; das
war die offene methodische Frage jener Runde, und sie ist damit unabhängig beantwortet: der
Handnachzug war korrekt, die Schranke steht auf echten Zahlen.

| # | Disziplin | Chassis | rho je Spiel | Spannweite | rho Saison | Schranke | Abnahme | Doku sagt |
|---:|---|---|---:|---:|---:|---:|---|---|
| 1 | Staffel | Bahn | 0,915 | 0,089 | 0,951 | 0,050 | 🟢 bestanden | stimmt |
| 2 | Speed-Schach | Bühne | **0,908** | 0,066 | 0,972 | 0,050 | 🟢 bestanden | 0,889 ❌ |
| 3 | Showcase | Bühne | **0,892** | 0,158 | 0,937 | 0,050 | 🟢 bestanden | 0,880 ❌ |
| 4 | Spurt | Bahn | 0,871 | 0,236 | 0,905 | 0,071 | 🟢 bestanden | stimmt |
| 5 | Time-Trial | Bahn | 0,867 | 0,050 | 0,909 | 0,050 | 🟢 bestanden | stimmt |
| 6 | Takeshi's Castle | Bahn | **0,861** | 0,116 | 0,930 | 0,050 | 🟢 bestanden | 0,886 ❌ |
| 7 | Gewichtheben | Bühne | **0,847** | 0,215 | 0,916 | 0,064 | 🟢 bestanden | 0,887 ❌ |
| 8 | Wettessen | Bühne | 0,845 | 0,139 | 0,930 | 0,050 | 🟢 bestanden | 0,844 (∼) |
| 9 | Fechten | Bühne | **0,816** | 0,192 | 0,888 | 0,058 | 🟢 bestanden | 0,840 ❌ |
| 10 | Breaking | Bühne | 0,804 | 0,133 | 0,937 | 0,050 | 🟢 bestanden | 0,801 (∼) |
| 11 | Eiskunstlauf | Bühne | **0,792** | 0,130 | 0,944 | 0,050 | 🟡 knapp | 0,757 ❌ |
| 12 | Climbing | Bahn | 0,790 | 0,192 | 0,851 | 0,058 | 🟡 knapp | stimmt |
| 13 | **Tennis** | Bühne | **0,786** | 0,194 | 0,846 | 0,058 | 🟡 **knapp — NEU durchgefallen** | 0,814 „bestanden" ❌ |
| 14 | Basketball | Feldspiel | 0,772 | 0,088 | 0,923 | 0,050 | 🟡 knapp | stimmt |
| 15 | I-Spy | Bühne | **0,684** | 0,353 | 0,804 | 0,106 | 🔴 durchgefallen | 0,692 (∼) |
| 16 | Hockey (alle 12) | Feldspiel | 0,669 | 0,181 | 0,832 | 0,054 | 🔴 durchgefallen | stimmt — von Chris **akzeptiert** |
| 17 | Football | Feldspiel | 0,516 | 0,172 | 0,811 | 0,051 | 🔴 durchgefallen | stimmt |
| 18 | Battlefield | Arena | 0,387 | 0,938 | 0,595 | 0,281 | 🔴 durchgefallen | stimmt |
| 19 | TDM | Arena | 0,253 | 0,328 | 0,217 | 0,098 | 🔴 durchgefallen | stimmt |
| 20 | Mini-DM | Arena | 0,094 | 0,697 | 0,071 | 0,209 | 🔴 durchgefallen | stimmt |

**Bilanz: 10 bestanden · 4 knapp · 6 durchgefallen.** Gestern waren es 11/3/6 — der Unterschied
ist **allein Tennis**.

### 1a. Tennis: die einzige neue Regression, und sie ist keine

Tennis fällt von 0,814 auf 0,786 — **als direkte Folge des korrekten Bugfixes in PR #820**
(Bühne-Spiegelasymmetrie: die Gastseite bekam über `istGegner` weder Slot-Aufschlag noch
Stufenwert, ihre echte Aufstellung wurde nie gelesen). Vorher war Tennis' rho zum Teil ein
Messartefakt einer kaputten Gastseite. Der Fix ist richtig, die Zahl ist ehrlicher — und die
ehrliche Zahl reicht nicht.

Das ist wichtig für die Einordnung, weil es die Reflexreaktion („PR #820 zurücknehmen") ausdrücklich
ausschließt. Tennis braucht eine eigene Rezeptrunde. Es ist heute die **billigste** aller
Rangtreue-Baustellen: 0,014 fehlen, Chassis Bühne (das best-verstandene im Projekt), und das
Rezept ist laut `stand-aller-disziplinen.md` Zeile 520 „1:1 aus dem alten Feldspiel-Rezept
übernommen, nicht neu kalibriert" — es hat also nie eine eigene Kalibrierung gehabt.

### 1b. Was PR #840 methodisch geleistet hat — und warum das heute Abend nicht mehr geht

#840 hat die Drift von neun Disziplinen **per Git-Bisektion** (eigener Worktree je Commit,
deterministische Messung gegen dieselbe Kaderfamilie) vollständig auf zwei Ursachen
zurückgeführt: Takeshi auf #813, die anderen acht auf #820. Das war möglich, weil zwischen
Basislinie und Drift genau eine Handvoll Commits lagen und **zwei** davon überhaupt
`battle-mode.engine.js` anfassten.

Nach der heutigen Welle liegen dort bis zu **sieben** Motor-Commits, davon drei im selben
Bahn-Chassis. Eine Bisektion über sieben ineinandergreifende Motorstände ist kein Nachmittag
mehr. Die Konsequenz steht in Abschnitt 3.3 als konkrete Vorgabe: **jeder der sieben PRs misst
seine eigene Disziplin vor und nach und schreibt beide Zahlen in die PR-Beschreibung** — dann
braucht es nachher keine Bisektion, sondern nur eine Subtraktion.

---

## 2. Chris' Liste von heute — Punkt für Punkt, mit echtem Stand

Chris hat heute in einer Nachricht fünf Punkte aufgezählt. Der Stand ist **für alle fünf
derselbe**, und er ist nachgemessen (`git log origin/main..HEAD` und `git status` in jedem der
sieben Worktrees, plus die vollständige Liste offener PRs über die GitHub-API):

| # | Chris' Auftrag | Zuständiger Zweig | Commits | PR | Stand |
|---|---|---|---:|---|---|
| a | **Zeitfahren** — Design entschieden + Mockup gebaut | `claude/zeitfahren-umsetzung-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#832 gemergt** |
| b | **Staffel** — Mockup gebaut/aktualisiert | `claude/staffel-oval-hud-umsetzung-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#829 gemergt** |
| c | **Mini-DM** — 4-Team-FFA mit **2-1-0-0** Liga-Punkten | `claude/mini-dm-4-team-ffa-umsetzung-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#831 gemergt** — ⚠️ s. 2a |
| d | **Basketball-Doppeln** — an echte Wertung + echter Abwehr-Preis | `claude/basketball-doppeln-anschluss-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#834 gemergt** — ⚠️ s. 2b |
| e1 | **Gewichtheben** — kühner Versuch (Risiko/Reward) | `claude/gewichtheben-kuehner-versuch-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#835 gemergt** |
| e2 | **Takeshi's Castle** — Animationen | `claude/takeshi-animationen-umsetzung-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#828 gemergt** |
| e3 | **Broadcast-Präsentation** — HUD, Highlights, Captions | `claude/broadcast-praesentation-umsetzung-06-09` | 0 | keiner | 🟠 in Arbeit, Recherche **#833 gemergt** |

**Kein einziger Punkt ist „fertig", keiner ist „nicht begonnen".** Alle sieben stehen an
derselben Stelle: die Recherche ist gemergt, die Umsetzung hat um 04:45–04:48 UTC begonnen.
Die vier offenen PRs im Repo (#702, #740, #789, #799) sind **allesamt alte Entwürfe** aus dem
01.–05.09. und gehören zu keinem der sieben Aufträge.

Was **gestern und heute Nacht** dagegen wirklich gelandet ist — **27 Merges** seit dem letzten
Briefing (`#815` bis `#841`, gezählt auf `main`) — steht in Abschnitt 5.

### 2a. Mini-DM: Chris' 2-1-0-0 weicht bewusst von der Recherche ab — und das ist in Ordnung, aber es muss dokumentiert werden

`docs/design/mini-dm-4-team-ffa-recherche-06-09.md` empfiehlt in Abschnitt 6 ausdrücklich
**Option A: 2/0/0/0**. Chris hat **2-1-0-0** angeordnet. Das ist keine Ungenauigkeit, sondern
eine Entscheidung — aber sie bricht die Annahme, auf der die ganze Recherche aufgebaut ist, und
der Umsetzer muss wissen, dass er sie bricht:

- Der **Budget-Anker** der Recherche ist `ARENA_TEAM_POINTS = {win:2, draw:1, loss:0}`
  (`lib/resolve/battle-mode-arena-team-points.ts:199`, Chris' eigene Festlegung vom 30.08.: „Das
  ist gesetzt."). Ein normales Duell zahlt **in Summe 2** in die Tabelle ein. Alle drei
  recherchierten Optionen halten Summe = 2 exakt ein.
- **2-1-0-0 ergibt Summe 3.** Das ist das 1,5-Fache eines Duells.
- **Das ist trotzdem verteidigbar, und zwar mit einem Argument, das die Recherche nicht führt:**
  ein Mini-DM-Pod bindet **vier** Teams an einem Spieltag. Dieselben vier Teams würden sonst
  **zwei** Duelle spielen und dabei zusammen **4** Punkte einzahlen. Gegen diesen Bezugsrahmen ist
  2-1-0-0 (=3) nicht zu großzügig, sondern **zwischen** „ein Duell" (2) und „zwei Duelle" (4) —
  und Chris' eigene Sorge („das darf nicht so viel zählen wie zwei Disziplinen") ist erfüllt, weil
  3 < 4.
- **Erledigt-Kriterium für den Umsetzer:** 2-1-0-0 bauen wie angeordnet, **und** in einem Kommentar
  an der Punktetabelle festhalten, gegen welchen der beiden Anker (ein Duell = 2 vs. zwei Duelle =
  4) die Summe 3 gerechtfertigt ist. Sonst liest die nächste Runde die Recherche, sieht „Option A
  empfohlen", findet 2-1-0-0 im Code und hält es für einen Fehler.
- **Gleichstandsregel bleibt offen.** Die Recherche hat sie nur für 2/0/0/0 ausformuliert
  (gleichmäßige Teilung). Für 2-1-0-0 ist der Gleichstand auf Platz 1 zwischen zwei Teams
  (2+1)/2 = 1,5 je Team — **das muss jemand entscheiden, nicht ableiten**, denn die Alternative
  „beide bekommen 2" wäre wieder Summe 4.

### 2b. Basketball-Doppeln: Chris fordert etwas, das in der Recherche gar nicht vorkommt

Zwei Befunde, beide relevant für die Abnahme:

1. **Die Recherche nennt einen strukturellen Blocker, den der Auftrag überspringt.**
   `spieleFeldspiel(fd, saat)` — der Pfad, über den ein echter Battle-Mode-Spieltag headless
   aufgelöst wird (`lib/battle/arena-headless-runner.ts` → `arena-matchday-resolve-service.ts`) —
   **kennt kein `fokusName`**; `fsLive.fokusZiel` bleibt dort für die gesamte Dauer `null`. Der
   „Battle Arena"-Tab, in dem Fokus-Doppeln heute bedienbar ist, ist ein eigener
   Navigationspunkt (`FoundationShellRouterBody.tsx:3269`) und **kein** Teil der
   Spieltagsabwicklung. Chris' „an echtes Scoring anbinden" ist damit genau die richtige
   Bestellung — aber sie ist größer als eine Verdrahtung: sie berührt die Frage, wie ein Nutzer
   sein eigenes Battle-Mode-Spiel überhaupt erlebt (heute: gar nicht, alles läuft unbeobachtet im
   Hintergrund).
2. **Der „echte Abwehr-Preis" steht in keiner Zeile der Recherche.** Die Recherche empfiehlt als
   Vorgabe „automatisch den Gegner mit der höchsten Eignung doppeln" (Abschnitt 3, Option B) —
   also **genau** das Verhalten, das Chris ausschließen will („damit die KI es nicht immer
   benutzt"). Im Motor ist Fokus-Doppeln heute ein reiner **Bias ohne modellierten Preis**:
   `FOKUS_RADIUS_MUL` 2,2, `FOKUS_CHANCE_MUL` 3,2, `FOKUS_FENSTER` 2,2 s, `FOKUS_ANLAUF_MUL` 1,35
   (`battle-mode.engine.js:5162–5175`) verstärken die Hilfe, **nichts** bestraft den Helfer dafür,
   dass er seinen eigenen Mann stehen lässt. Ob dieser Preis über die Geometrie implizit schon
   entsteht (der Helfer ist real weg, sein Gegner also real freier) oder explizit modelliert
   werden muss, ist **die zu messende Frage** dieses Auftrags — und die Abnahme dafür ist nicht
   rho, sondern: **schaltet eine KI, die frei wählen darf, den Fokus manchmal ab?** Wenn die
   Antwort „nie" lautet, gibt es keinen Preis, und der Auftrag ist nicht erfüllt.

---

## 3. Muster und Risiken über die ganze Welle

### 3.1 Die Kollisionskarte — wer schreibt wohin

`public/mockups/battle-mode.engine.js` hat 20 646 Zeilen und trägt alle vier Chassis. Die sieben
Aufträge verteilen sich darauf **nicht** gleichmäßig:

| Region | Zeilen (Stand `461e9014`) | Zeitfahren | Staffel | Takeshi-Anim | Broadcast | Basketball | Gewichtheben | Mini-DM |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `ZEIT_DEHNUNG`-Literal | 17889–17941 | ✅ | ✅ | ○ | – | – | ○ | ○ |
| Bahn-Chassis (`bauSpurt` 16642 ff., `stepSpurt`, `zeichneBahn`, `updateHudBahn` 15050) | ~14900–17100 | ✅ | ✅ | ✅ | ○ | – | – | – |
| `EFFEKTE`/`zeichneEffekte` | 17584–17610, 17112–17170 | – | ○ | ✅ | ✅ | – | – | – |
| `feed(seite,text,big)` + rund 50 Aufrufstellen | quer über alle vier Chassis | ○ | ○ | ✅ | ✅ | ○ | ○ | ✅ |
| `.arenaraum`-Overlay (HTML/CSS + `.einlauf`/`.endstand`) | `battle-mode.css`, `.html` | ○ | ✅ | – | ✅ | ○ | – | – |
| `bauBuehne`/`hebeUebung` | 10724 ff., 10853 ff. | – | – | – | ○ | – | ✅ | – |
| Feldspiel/`fokusZiel` | 5100–5185, 9068, 18445 ff. | – | – | – | ○ | ✅ | – | – |
| `ARENA_ART["mini-dm"]`, `SLOTS_JE_DISC`, `gegner`/`eigene` | 3493, 4055, 13261 | – | – | – | ○ | – | – | ✅ |
| TypeScript (`lib/resolve/`, `lib/season/`) | – | – | – | – | – | ✅ | – | ✅ |

✅ = sicher betroffen · ○ = wahrscheinlich betroffen · – = unbeteiligt

**Drei echte Kollisionsherde:**

1. **Das Bahn-Chassis, dreifach belegt.** Zeitfahren baut Einzelstart und Zwischenzeiten,
   Staffel baut ein Oval, Takeshi-Animationen macht Rempler/Gedränge/Fallenreaktion sichtbar —
   alle drei in `bauSpurt`/`stepSpurt`/`zeichneBahn`, die sich **fünf** Disziplinen teilen. Das
   ist genau die Konstruktion, die am 06.09. den Bühne-Spiegelfehler über neun Disziplinen
   gleichzeitig verteilt hat (#820). Hier ist die Gefahr nicht nur der Textkonflikt, sondern die
   **stille Querwirkung**: wer `zeichneBahn` für ein Oval umbaut, ändert das Bild für Spurt,
   Time-Trial, Climbing und Takeshi mit.
2. **Zwei Agenten bauen dasselbe HUD.** Die Staffel-Recherche (#829) schlägt ein Broadcast-HUD
   für **eine** Disziplin vor; die Broadcast-Recherche (#833) schlägt dasselbe HUD **übergreifend**
   vor und schreibt selbst, dass sie auf #829 aufbaut. Beide Umsetzer starteten zur selben Minute
   und wissen voneinander nur aus ihren Recherchen. Ohne Absprache entstehen zwei
   `.arenaraum`-Overlays mit zwei Positionierungssystemen, von denen eines wieder
   zurückgebaut werden muss.
3. **`ZEIT_DEHNUNG`, dreifach editiert.** Zeitfahren will die Einzelstart-Zeitachse
   (`time-trial:4.38`), Staffel will „insgesamt ca. 3 Minuten" (`staffel:4.65`), Takeshi hat
   `2.17`. Das ist ein einziges Objektliteral in einem rund 60-zeiligen Kommentarblock — drei
   parallele Edits daran geben drei Textkonflikte, von denen jeder einzelne trivial ist und
   deren Auflösung trotzdem dreimal Zeit kostet.

### 3.2 Wer den schweren Review-Maßstab braucht — und wo er übersehen werden könnte

Das Projekt trennt seit dem 02.09. sichtbar zwischen `PRODUKTIONSCODE (besondere
Review-Sorgfalt)` und dem Rest — die Commit-Titel von #820, #823, #838, #839 tragen es im Namen.
Für die sieben gilt:

| Auftrag | Berührt `wert()`/Zufall/Wertung? | Review-Maßstab |
|---|---|---|
| **Mini-DM** | **Ja** — neue Liga-Punkte-Topologie (Vierergruppe), TypeScript-Resolve, neue Arena-Geometrie | 🔴 **schwer.** Die einzige der sieben, die eine **dritte Scoring-Topologie** ins Spiel bringt (weder Liga-Rennen noch Duell). Dazu Chris' Budget-Abweichung aus 2a. |
| **Gewichtheben, kühner Versuch** | **Ja** — neuer Wurf für Ausgang und Verletzung | 🔴 **schwer**, aber gut vorbereitet: die Recherche hat den gefährlichen Hebel bereits isoliert nachgemessen (Belohnung in `u.summe` drückt rho ab +40 %; +5/+15/+20 % nicht von Null unterscheidbar). Abnahme: **die Belohnung darf nicht in die gewerteten Kilogramm.** |
| **Zeitfahren** | **Ja** — Hindernisse raus heißt Zufallskaskade weg | 🔴 **schwer**, und der einzige mit geplantem rho-Rückgang gegen eine Schranke von 0,050 (s. 0.5 und 3.3). |
| **Basketball-Doppeln** | **Ja** — Verdrahtung in den Ergebnispfad + Abwehr-Preis | 🔴 **schwer.** Sobald `fokusZiel` im headless Pfad gesetzt wird, ändert sich das Ergebnis **jedes** Spieltags, auch der 30+ KI-gegen-KI-Spiele. |
| **Staffel** | Nein, wenn die Recherche befolgt wird (Oval = neue Zeichenfunktion auf `laufAnteil(u)`) | 🟠 **mittel** — die Recherche warnt selbst vor der naheliegenden Falle (eigener 0..1-Bereich je Läufer bricht `u.pos>=1`). Das ist die Stelle, an der aus „Optik" ungewollt Mechanik wird. |
| **Takeshi-Animationen** | Nein (reines Rendering, liest `u.fallen[…].aus`) | 🟢 **leicht** — solange `tackleKosten:0` unverändert bleibt. Sobald jemand `u.kraft` setzt, um die „lunge"-Pose auszulösen, ist es Mechanik. |
| **Broadcast** | Nein (Leser vorhandener Zustände, `big`-Flag existiert bereits an 12 Stellen) | 🟢 **leicht**, aber **breit**: rund 50 `feed()`-Aufrufstellen über alle vier Chassis. Das Risiko ist nicht Tiefe, sondern Fläche — es kollidiert mit allen anderen. |

**Der Punkt, an dem das schiefgehen kann:** Staffel und Takeshi-Animationen sind als „Optik"
beauftragt und werden deshalb voraussichtlich schnell durchgewinkt. Beide haben in ihrer eigenen
Recherche eine ausdrücklich benannte Stelle, an der aus Optik Mechanik wird. Genau diese zwei
Sätze sind die, die ein schneller Review überliest.

### 3.3 Die Basislinie wird eine zweite Nachzieh-Runde brauchen — planen, nicht abwarten

Nach der Welle sind mindestens diese Bewegungen zu erwarten:

- **Zeitfahren**: geplanter Rückgang 0,033–0,043 (ohne Tagesform) bzw. 0,045–0,051 (mit) gegen
  eine Schranke von **0,050**. Der Fall „CI wird rot" ist hier keine Restwahrscheinlichkeit,
  sondern die Hälfte des Möglichkeitsraums.
- **Gewichtheben**: Basis 0,847, Schranke 0,064 — Puffer vorhanden, wenn die Belohnung nicht in
  `u.summe` landet.
- **Takeshi**: Basis 0,861, Schranke **0,050** — der schmalste Puffer aller Bahn-Disziplinen.
  Reines Rendering bewegt nichts; ein einziger zusätzlicher `rr()`-Wurf verschiebt die gesamte
  Kaskade.
- **Basketball**: Basis 0,772, Schranke 0,050, bereits „knapp". Ein produktiv gesetzter
  Fokus-Default ändert jedes Spiel.
- **Mini-DM**: Basis 0,094 bei Spannweite 0,697 — die Spannweite ist **siebenmal** so groß wie
  der Median. Jede Bewegung ist hier von Null nicht unterscheidbar; die Recherche fordert selbst
  eine eigene FFA-Messsonde (die bestehende kennt nur zweiseitige Duelle).

**Konkrete Vorgaben, die jetzt gelten sollten — sie kosten je PR zehn Minuten und sparen die
Bisektion:**

1. Jeder der sieben misst **seine eigene Disziplin** vor und nach
   (`node scripts/miss-alle-disziplinen.mjs 24 <diszi>`) und schreibt **beide** Zahlen in die
   PR-Beschreibung. Wer nichts an `battle-mode.engine.js` ändert, schreibt „bit-identisch" hin.
2. Wer eine Bahn-Disziplin anfasst, misst zusätzlich die **anderen vier**
   (`spurt time-trial climbing staffel takeshis-castle`) — das ist der Fehler, den #820 über neun
   Bühnen-Disziplinen verteilt hat und den erst #840 einen Tag später gefunden hat.
3. **Ein** Nachzug der Basislinie nach der Welle, nicht sieben einzelne. Das ist derselbe
   Schritt, den #816 und #840 schon zweimal gefahren sind, und er gehört als **letzter** PR der
   Welle geplant, nicht als Reparatur danach.
4. Bei Zeitfahren zusätzlich: **die Tagesform-Größe ist eine Chris-Frage, keine Umsetzerzahl.**
   Die Recherche sagt das selbst („ein Dreh-Regler, den Chris braucht"). Sie entscheidet, ob der
   PR über oder unter der Schranke landet.

### 3.4 Eine Merge-Reihenfolge, die die Kollisionen auflöst

Nicht nach Fertigstellung mergen, sondern nach Fläche — von innen nach außen:

1. **Gewichtheben** (Bühne, berührt niemanden sonst) und **Mini-DM** (Arena + TypeScript,
   berührt keine Bahn) — parallel, kollisionsfrei.
2. **Basketball-Doppeln** (Feldspiel + TypeScript) — kollidiert nur über `feed()`.
3. **Zeitfahren**, dann **Staffel**, dann **Takeshi-Animationen** — alle drei im Bahn-Chassis,
   deshalb **seriell**, jeder rebased auf den vorigen, jeder misst danach alle fünf Bahnen.
4. **Broadcast** zuletzt — es hat die größte Fläche (50 `feed()`-Stellen, alle vier Chassis) und
   ist damit der billigste Rebase, wenn alles andere schon steht. Zusätzlich: das HUD aus Staffel
   (Schritt 3) ist dann da und kann übernommen statt doppelt gebaut werden.
5. **Basislinie nachziehen** als achter, eigener PR.

### 3.5 Die Schranke prüft erst nach dem Merge — das ist heute besonders teuer

`rangtreue-schranke` ist der einzige Job im gesamten CI, der die 0,80-Schranke prüft. Er läuft in
`ci-nightly.yml` und wird ausgelöst durch `workflow_dispatch` **und `push: branches: [main]`** —
also **nach** dem Merge, nie auf dem PR. Der Grund ist dokumentiert und vernünftig (11 Minuten,
zu teuer als Pflicht-Check für jeden PR).

An einem normalen Tag ist das ein guter Kompromiss. An einem Tag mit sieben Motor-PRs heißt es:
der erste rote Lauf zeigt eine gefallene Zahl, aber nicht, welcher der sieben Merges sie
verursacht hat. Genau deshalb ist Vorgabe 1 aus 3.3 (Vorher/Nachher je PR) heute keine
Formalie, sondern die einzige billige Alternative zu einer Sieben-Wege-Bisektion.

---

## 4. Der größte Hebel, neu vermessen: es fehlt ein Battle-Mode-Save

Das Vorgänger-Briefing nannte in Abschnitt 4 die Produktivierung als größten ungehobenen Hebel:
drei von zwanzig Disziplinen liefen über den Arena-Pfad, siebzehn über den alten PPS-Rangpfad.
**Das hat gewirkt** — `ARENA_RESOLVED_DISCIPLINE_IDS` enthält heute fünf Einträge
(`basketball`, `gewichtheben`, `hockey`, `speed-schach`, `showcase`, PR #818).

Nur sitzt die eigentliche Sperre eine Ebene tiefer, und das ist heute frisch am `live-save`-
Abbild nachgemessen (Spiegel 0,0 h alt, sieben Saves, `game_metadata.payload_json` je Save
vollständig durchsucht):

- **Kein einziger der sieben Spielstände enthält irgendwo `gameMode`.** `resolveGameMode()`
  (`lib/season/game-mode.ts:16`) fällt damit für alle sieben auf `"manager"` zurück.
- `isBattleModeSave()` ist also überall `false`. **Die gesamte Arena-Produktivierung — alle fünf
  Disziplinen — ist in jedem existierenden Spielstand von Chris inert.** Ebenso PR #823 (20
  Spieltage, Welle 1) und alles, was danach an Battle-Mode-Mechanik gebaut wird.
- `gameMode` wird **bei Save-Anlage** entschieden und ändert sich nie wieder. Es gibt keinen
  Umschalter für einen bestehenden Save — es gibt nur „neuen Save anlegen".
- Der Schalter dafür **existiert und ist gebaut**: eine Radio-Auswahl im Neues-Spiel-Dialog
  (`app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx:648–668` →
  `app/api/new-game/route.ts:36` → `lib/game/new-game-setup-service.ts:360`). Er wurde nur nie
  benutzt.
- **Nebenbefund aus derselben Messung:** der jüngste Spielstand wurde zuletzt am **23.08.**
  angefasst (`saves.updated_at`), er steht auf Saison 2, Spieltag 10. Die letzten fünfzehn Tage
  Projektarbeit sind in keiner einzigen Spielsitzung angekommen.

**Das ist der billigste große Schritt, den es im Projekt gerade gibt:** ein neuer Spielstand mit
der Battle-Mode-Auswahl, und fünf produktivierte Disziplinen werden auf einen Schlag sichtbar —
ohne eine Zeile Code. Es ist zugleich der einzige Weg, PR #823 und alles, was auf Welle 2 folgt,
überhaupt jemals wirksam zu machen. **Das ist eine Chris-Aktion, keine Agenten-Aufgabe** — aber
es sollte jemand vorher einmal durchspielen, ob ein frischer Battle-Mode-Save sauber bis zum
ersten aufgelösten Spieltag läuft. Diese Kette wurde bisher **nie an einem echten Save geprüft**,
nur in der CI.

---

## 5. Nachhalten: was vom Briefing 06.09. erledigt ist

| Vorschlag von gestern | Stand heute |
|---|---|
| **1. Basislinie neu ziehen + Stand-Doku nachziehen** 🔴 | 🟢 **erledigt** — #816 zog beides, #839 und #840 korrigierten den Nachzug (Gewichtheben, dann die neun Bühne/Bahn-Zeilen per Bisektion). ⚠️ Die **Stand-Doku ist seither wieder überholt**, zehn Zeilen, s. Abschnitt 1. |
| **2. Multiplayer scharf schalten** 🟢 | 🔴 **offen, Chris-Aktion** — `active_saves` im heutigen Abbild führt weiterhin `franky_remote_placeholder`. Kein Fortschritt, kein Agent kann daran arbeiten. |
| **3. Produktivierungswelle** 🔴 | 🟡 **teilweise** — #818 brachte Speed-Schach und Showcase (3 → 5). Staffel wurde **begründet ausgelassen** (`bahnTeamstand()` liefert `gewertet:false`). ⚠️ Der Nutzen ist **null**, solange kein Battle-Mode-Save existiert, s. Abschnitt 4. |
| **4. Wertungstabelle Welle 2 + drei Kleinstfunde** 🟠 | 🟢 **erledigt** — #817 (Hockey/Football ehrlich, `Imp = feldspielWert`, Zeitfixes), #827 (Endstand-Overlay Staffel/Takeshi), #841 (Burgpunkte-Aufschlüsselung). Die Abnahme-Sonde ist als `scripts/sonde-wertungstabelle.mjs` eingecheckt. |
| **5. Saisonplan-Auslosung** 🟠 | 🟢 **erledigt** — #815: `buildSeasonPlayerCountByDiscipline` verteilt je Kategorie `[2,3,4,5,6]` per `shuffleSeeded` gleichverteilt; die konfigurierte Basisgröße ist nicht mehr ausgeschlossen. Kurs-Wiederholung: #819 hat die **Prämisse widerlegt** statt sie zu bauen. |
| Folgeauftrag **A** (Verletzungen bei Chaos-Aktionen) | 🟡 **teilweise adressiert, an anderer Stelle** — die Gewichtheben-Risiko-Recherche (#835) hat das Verletzungs-Thema für **eine** Disziplin durchgemessen und empfiehlt Verletzung als **rein kosmetisches Ticker-Ereignis ohne Zweikampf-Malus**. Für Takeshis Chaos-Aktionen bleibt A unberührt und weiterhin **nicht empfohlen** (dünnster Puffer, s. 3.3). |
| Folgeauftrag **B** (Manager-einstellbarer Spielstil) | 🔴 **unberührt** — es existiert bis heute **kein** Recherche-Dokument dazu (`docs/design/` durchsucht, 101 Dateien). Der Anker aus dem Vorgänger-Briefing (`PERS`/`PERSDEF`/`PERSZIEL`, `battle-mode.engine.js:3357–3427`) gilt unverändert. |
| Folgeauftrag **C** (Kurs-Wiederholung) | 🟢 **geschlossen** — #819 hat gezeigt, dass die Prämisse nicht trägt; als W6 der 20-Spieltage-Wellen neu eingehängt. |
| Folgeauftrag **D** (Multiplayer) | = Punkt 2, offen. |
| **In-Game-Meldungen** | 🟢 **unverändert leer** — `bug-reports` trägt weiter genau 92 Dateien, die neueste vom **25.08.** Chris' Rückmeldungen kommen ausschließlich über den Chat, nicht über die Flagge im Spiel. |

**Neu dazugekommen und nicht im Vorgänger-Briefing:** #822 (Liga-Spielplan ab Saison 2
reparieren), #823 (Battle Mode 20 Spieltage, Welle 1, inert), #824 (PPS-Referenz-Frische prüft
`motorSha1`), #830/#836/#837/#838 (Pacing-/Darstellungsfixes Spurt, Football, Basketball,
Speed-Schach), #839 (Gewichtheben-Überholung), #840 (Basislinie-Drift), #841 (Burgpunkte).

---

## 6. Empfehlung: die nächsten sieben Schritte

### 1. Die Welle nach Fläche mergen, nicht nach Fertigstellung 🔴
Reihenfolge aus 3.4, Messvorgaben aus 3.3. **Aufwand:** null zusätzlicher Bau, nur Disziplin bei
der Merge-Entscheidung. **Warum jetzt:** es ist die einzige Maßnahme dieser Liste, die **heute**
wirken muss — morgen ist sie wertlos. Der teuerste vermeidbare Fehler wäre, Staffel und
Zeitfahren gleichzeitig ins Bahn-Chassis zu mergen und danach zu suchen, welcher von beiden
Climbing verstellt hat.

### 2. Basislinie nachziehen als geplanter Abschluss-PR der Welle 🔴
Nicht als Reparatur, sondern als **letzter** Schritt mit Ansage — `node
scripts/baue-rangtreue-basislinie.mjs 24`, dann `scripts/pruefe-rangtreue-schranke.mjs` grün.
**Aufwand:** ¼ Tag, davon 11 Minuten Rechenzeit. **rho-Risiko:** keins.

### 3. `stand-aller-disziplinen.md` auf den heutigen Stand ziehen — und Tennis benennen 🔴
Zehn von zwanzig Zeilen sind falsch, und die falscheste sagt „Tennis bestanden", während Tennis
seit #820 bei 0,786 steht. **Warum das eilt:** das ist das Dokument, das jede Priorisierung
liest — es hat gestern schon einmal zwei bestandene Disziplinen als Baustellen ausgewiesen. Der
Fund steht heute nur in einer Commit-Nachricht. **Aufwand:** klein, kann mit Schritt 2 in einen
PR. **Vorschlag:** Tennis' Zeile trägt zusätzlich den Grund („ehrlichere Zahl nach dem
#820-Fix", nicht „Regression") — sonst sucht die nächste Runde nach einem Fehler, der keiner ist.

### 4. Einen Battle-Mode-Save anlegen und einen Spieltag durchspielen 🔴 — Chris-Aktion
Fünf produktivierte Disziplinen, PR #823 und die gesamte Welle-2-Planung sind heute in **jedem**
existierenden Spielstand inert (Abschnitt 4). Der Schalter ist gebaut und wurde nie benutzt.
**Aufwand für Chris:** eine Minute im Neues-Spiel-Dialog. **Aufwand vorher für einen Agenten:**
ein E2E gegen ein `live-save`-Abbild, das einen frischen Battle-Mode-Save bis zum ersten
aufgelösten Spieltag fährt — diese Kette ist nie an einem echten Save geprüft worden, nur in der
CI. **Nutzen:** der mit Abstand größte pro Aufwand im ganzen Projekt.

### 5. Tennis' Rezept nachkalibrieren 🟠
0,014 fehlen zur Schranke, Chassis Bühne, und das Rezept ist nach eigener Doku nie eigenständig
kalibriert worden (1:1 aus dem alten Feldspiel-Rezept übernommen). Von allen Disziplinen unter
der Schranke ist das die mit dem kürzesten Weg darüber. **Aufwand:** klein–mittel.
**rho-Risiko:** auf die eigene Zeile begrenzt — **aber** Vorsicht: das Bühnen-Chassis teilen sich
neun Disziplinen, und genau das war der Mechanismus von #820. Nach dem Rezeptwechsel alle neun
messen.

### 6. Multiplayer scharf schalten 🟢 — Chris-Aktion, unverändert offen
Steht seit gestern unverändert (Vorgänger-Briefing Schritt 2): gebaut, CI-geprüft, es fehlen vier
Zeilen in `deploy/hetzner/.env` und ein Redeploy. Der einzige Punkt auf dieser Liste, bei dem am
Ende ein Mensch mehr am Spiel sitzt. Sicherung des Spielstands vorher ist Pflicht.

### 7. Basketball-Doppeln: die Architekturfrage vor die Verdrahtung ziehen 🟠
Die Recherche zu #834 stellt Chris eine Frage, ohne die der Auftrag nicht abnehmbar ist: **erlebt
ein Nutzer sein eigenes Battle-Mode-Spiel künftig live, oder bleibt es headless mit
Nachbericht?** Heute läuft jedes Spiel — auch das eigene — unbeobachtet im Hintergrund. Solange
das so ist, ist eine Viertelpausen-Bedienung eine Bedienung ohne Wirkung. Die Verdrahtung des
**Defaults** in den headless Pfad wirkt dagegen sofort auf alle 30+ Spiele eines Spieltags und ist
unabhängig von dieser Frage baubar — nur eben nicht das, was Chris mit „auswählen können"
beschrieben hat.

### Bewusst NICHT auf dieser Liste

- **Arena-Rezeptrunde (TDM/Mini-DM/Battlefield)** — unverändert gesperrt durch die Messbarkeit:
  Mini-DMs Spannweite (0,697) ist das Siebenfache seines Medians. Was die laufende Mini-DM-Arbeit
  liefert, ist ein **Format**, keine Rangtreue-Verbesserung — und die Recherche sagt das selbst.
  Die Vorstufe bleibt eine tragfähige Messmethode (n ≥ 96–150, plus eine FFA-fähige Sonde), nicht
  ein Rezept.
- **In-Race-Verletzungen an Chaos-Aktionen (Folgeauftrag A)** — unverändert nicht empfohlen.
  Takeshi steht heute bei 0,861 mit Schranke 0,050; ein neuer `rr()`-Wurf im Tick-Loop verschiebt
  die gesamte Kaskade.
- **Football-Matrix** — von Chris gesperrt. Offen bleibt die **Design-Frage** aus dem
  Vorgänger-Briefing (Anzeige, Teamstärke und KI-Kauf ordnen Football nach der alten Tabelle, das
  Minispiel nach der neuen). Die gehört Chris.
- **Die vier alten offenen PRs** (#702, #740, #789, #799) — allesamt Entwürfe vom 01.–05.09.,
  keiner gehört zur heutigen Welle. Sie sollten bei Gelegenheit entweder aufgegriffen oder
  geschlossen werden; sie kosten heute nichts außer Übersicht.

---

## 7. Methodik und Grenzen

- **Der Stand der sieben Aufträge ist gemessen, nicht erfragt:** `git worktree list`,
  `git log origin/main..HEAD` und `git status --porcelain` in jedem der sieben Worktrees, plus die
  vollständige Liste offener PRs über die GitHub-API. Alle sieben: null Commits, sauberer
  Arbeitsbaum, kein PR.
- **Alle zwanzig rho-Zeilen in Abschnitt 1 sind heute an `461e9014` selbst gemessen** —
  ein vollständiger Lauf `node scripts/miss-alle-disziplinen.mjs 24` in einem eigenen Worktree,
  kaderfest über `data/generated/kaderfamilie-live-save.json`, Meldung „Seitenfehler: keine".
  Keine Zahl ist aus einem Dokument übernommen. Der Lauf stimmt auf allen zwanzig Zeilen mit
  `data/generated/rangtreue-basislinie.json` überein und bestätigt damit unabhängig, dass die
  **von Hand** nachgezogenen Einträge aus #839/#840 korrekt sind.
- **Der `gameMode`-Befund in Abschnitt 4 ist heute selbst gemessen**, nicht aus
  `stand-aller-disziplinen.md` übernommen: `git show origin/live-save:…` → entpackt → alle sieben
  `game_metadata.payload_json` (1,9–4,7 MB je Save) nach `gameMode` durchsucht, kein Treffer.
  Das bestätigt die Aussage der Stand-Doku unabhängig und am heutigen Abbild.
- **Nicht geprüft:** ob ein frisch angelegter Battle-Mode-Save tatsächlich sauber bis zum ersten
  aufgelösten Spieltag läuft. Das ist Schritt 4 der Empfehlung und war in keiner Runde bisher
  Gegenstand.
- **Nicht geprüft:** der Zustand des Room-Flows gegen den Produktionsserver (Agenten kommen nicht
  an den Server, s. CLAUDE.md). Geprüft ist nur die CI.
- **Die Kollisionskarte in 3.1 ist eine Prognose**, hergeleitet aus den sieben gemergten
  Recherche-Dokumenten und den tatsächlichen Zeilenbereichen in `battle-mode.engine.js` — nicht
  aus Diffs, weil es zum Zeitpunkt dieses Briefings keine gibt.

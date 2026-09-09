# PM-Briefing 09.09. — welche Disziplinen als naechstes fertig werden, und warum

**Auftrag von Chris (woertlich, 09.09.):** „dann mach weiter opus soll mal vorschläge machen nen
plan und dann direkt umsetzen wir müssen die nächsten disziplinen fertig bekommen"

Dieses Briefing beantwortet drei Fragen in dieser Reihenfolge, weil die dritte von der ersten
abhaengt: (0) war die im zuletzt gemergten PR #864 aufgetauchte Rangtreue-Diskrepanz eine
Regression? (1) wie steht das Feld der zwanzig Disziplinen heute wirklich? (2) welche werden als
naechstes fertig — und was davon ist in derselben Runde bereits umgesetzt.

**Messgrundlage:** eigener, isolierter Worktree (`/tmp/wt-opus-plan-09-09`) auf `origin/main`
= `e6461933` („Gegnerseite liest Aufstellung auch auf Bahn und Arena/Kampf (gastGesetzt)", #864),
nicht der geteilte Arbeitsbaum. Kaderfest gemessen ueber die fuenf echten Team-Paarungen aus
`data/generated/kaderfamilie-live-save.json` (`live-save`-Abbild „Oly New Game Custom 19.8.2026",
gezogen 03.09.), n=24 Spiele je Kader-Variante, Median und Spannweite — die Methode aus
`docs/design/messgrundlage-kaderfest.md`. Beide Server-Spiegel waren zum Messzeitpunkt frisch
(`npx tsx scripts/pruefe-spiegel-frische.ts`: `live-save` und `bug-reports` je „vor 0.1 h").

---

## 0. Die Diskrepanz aus PR #864 — weder Regression noch Mess-Artefakt

**Das war die wichtigste offene Frage, weil eine Regression alle weitere Arbeit haette warten
lassen muessen. Sie ist keine.**

PR #864 hatte in seiner Verifikationstabelle Basketball 0,769 („knapp"), Hockey 0,669
(„durchgefallen") und Football 0,516 („durchgefallen") gemessen — Zahlen, die im Widerspruch zu
dem zu stehen schienen, was der Projektverlauf als Stand fuehrt (Hockey und Basketball gelten als
produktionsreif und stehen beide in `ARENA_RESOLVED_DISCIPLINE_IDS`).

**Frisch nachgemessen** (`node scripts/miss-alle-disziplinen.mjs 24 basketball hockey football`,
isolierter Worktree auf `origin/main`):

| Disziplin | rho je Spiel | Spannweite | rho Saison | Spannweite |
|---|---:|---:|---:|---:|
| Basketball | 0,769 | 0,105 | 0,923 | 0,224 |
| Hockey (alle 12) | 0,669 | 0,181 | 0,832 | 0,259 |
| ↳ Hockey, nur Feldspieler | 0,719 | 0,182 | 0,818 | 0,259 |
| Football | 0,516 | 0,172 | 0,811 | 0,168 |

**Diese zwoelf Zahlen stimmen ZIFFER FUER ZIFFER mit der eingecheckten
`data/generated/rangtreue-basislinie.json` ueberein**, die am **06.09.** gezogen wurde — also
VOR allen drei verdaechtigten PRs (#858 Breaking, #859 Eiskunstlauf-Duett, #864 gegnerGesetzt).
Und sie stimmen ebenso mit `docs/design/stand-aller-disziplinen.md` Abschnitt 1 ueberein, wo
exakt 0,769 / 0,669 / 0,719 / 0,516 seit dem Sechsten Nachtrag (07.09.) stehen.

Zusaetzlich gegengeprueft, dass keine der drei PRs die Basislinie selbst angefasst hat: der
letzte Commit an `data/generated/rangtreue-basislinie.json` ist `b3591f1c` (#854, 07.09.), die
drei verdaechtigten PRs aendern ausschliesslich `public/mockups/battle-mode.engine.js` (plus
`lib/lineups/matchday-slot-roles.ts` bei #858) und eine reine Doku-Datei bei #862.

**Von den drei im Auftrag genannten Erklaerungen trifft also Nummer 3 zu: „schon immer so, nur
nie klar dokumentiert" — genauer: sehr wohl dokumentiert, nur an einer Stelle, die man kennen
muss.** Es gab nie eine Regression, und es ist auch kein Mess-Artefakt im Sinne von Erklaerung 1:
`disziplinProbe()` misst zwar tatsaechlich den rohen Motor ohne die produktionsseitige
`ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Normierung, aber das ist keine zweite, hoehere „echte" Zahl,
die man der niedrigeren gegenueberstellen koennte — die Impact-Kurve normiert die PPs-SKALA, sie
verbessert nicht die RANGTREUE. Wer auf eine hoehere produktionsseitige rho-Zahl hofft, hofft auf
etwas, das es nicht gibt.

**Was den scheinbaren Widerspruch wirklich aufloest, ist eine Entscheidung, kein Messwert.**
`ARENA_RESOLVED_DISCIPLINE_IDS` ist **nicht** an rho ≥ 0,80 gekoppelt, und war es nie. Fuer
Hockey steht das woertlich in `stand-aller-disziplinen.md` Abschnitt 4: *„Chris hat Hockeys
Rangtreue (0,669 alle 12 / 0,719 nur Feldspieler) fuer den Live-Betrieb ausdruecklich akzeptiert
— kein weiterer Rangtreue-Anlauf vorgesehen (Aufgabe #20 entsprechend geschlossen)"*, mit der
Begruendung, dass das Spiel damit rangtreuer ist als echtes NHL-Eishockey (rho ≈ 0,40).
Basketball (0,769) steht aus demselben Grund live.

**Die Lehre fuer die Zukunft, und der Grund, warum dieses Briefing durchgehend zwei getrennte
Spalten fuehrt:** es gibt **zwei unabhaengige Achsen**, und PR #864s Tabelle hat sie
unabsichtlich vermischt, indem sie neben eine Rangtreue-Zahl ein Abnahme-Urteil setzte:

1. **Rangtreue** — belohnt die Mechanik den Besseren? Gemessen, Schranke 0,80 (CLAUDE.md).
2. **Produktionsanbindung** — rechnet das echte Spiel diese Disziplin ueberhaupt ab, oder laeuft
   sie nur im Mockup? Binaer, keine Messung, `ARENA_RESOLVED_DISCIPLINE_IDS`.

Eine Disziplin ist erst „fertig", wenn BEIDE erfuellt sind. Hockey/Basketball sind der Fall
„Achse 2 ja, Achse 1 per ausdruecklicher Ausnahme" — und, wie sich gleich zeigt, ist der
lohnendste naechste Schritt genau der spiegelbildliche Fall.

---

## 1. Der Gesamtstand aller zwanzig — beide Achsen nebeneinander

rho je Spiel, kaderfest, Median ueber fuenf Kader-Paarungen, n=24. Quelle:
`data/generated/rangtreue-basislinie.json` (06.09.), stichprobenartig an `origin/main` neu
verifiziert (Basketball/Hockey/Football oben, ziffernidentisch). Spalte „Arena" = steht die
Disziplin in `ARENA_RESOLVED_DISCIPLINE_IDS`.

| # | Disziplin | Chassis | rho je Spiel | Arena? | Was fehlt bis „fertig" |
|--:|---|---|---:|:--:|---|
| 1 | Staffel | Bahn | **0,915** | nein | **nur Anbindung** — aber Bahn hat kein Arena-Chassis, und `bahnTeamstand()` liefert `gewertet:false` |
| 2 | Speed-Schach | Buehne | **0,908** | **ja** | — **fertig** |
| 3 | Showcase | Buehne | **0,892** | **ja** | — **fertig** |
| 4 | Eiskunstlauf | Buehne | **0,875** | *neu ja* | — **mit dieser Runde fertig** |
| 5 | Spurt | Bahn | **0,871** | nein | **nur Anbindung** — Bahn-Chassis fehlt |
| 6 | Breaking | Buehne | **0,869** | *neu ja* | — **mit dieser Runde fertig** |
| 7 | Takeshi's Castle | Bahn | **0,861** | nein | **nur Anbindung** — Bahn-Chassis fehlt |
| 8 | Gewichtheben | Buehne | **0,847** | **ja** | — **fertig** |
| 9 | Wettessen | Buehne | **0,845** | *neu ja* | — **mit dieser Runde fertig** |
| 10 | Time-Trial | Bahn | **0,828** | nein | **nur Anbindung** — Bahn-Chassis fehlt |
| 11 | Tennis | Buehne | **0,825** | *neu ja* | — **mit dieser Runde fertig** |
| 12 | Fechten | Buehne | **0,816** | *neu ja* | — **mit dieser Runde fertig** |
| 13 | Climbing | Bahn | 0,790 | nein | **beides** (0,010 unter der Schranke) |
| 14 | Basketball | Feldspiel | 0,769 | **ja** | Rangtreue per Ausnahme akzeptiert |
| 15 | I-Spy | Buehne | 0,684 | nein | **beides** — Chassis waere da, Rangtreue nicht |
| 16 | Hockey (alle 12) | Feldspiel | 0,669 | **ja** | Rangtreue ausdruecklich von Chris abgenommen |
| 17 | Football | Feldspiel | 0,516 | nein | **beides**, Rangtreue ist die grosse Luecke |
| 18 | Battlefield | Arena | 0,387 | nein | **beides**, Zielwahl-Redesign offen |
| 19 | TDM | Arena | 0,253 | nein | **beides**, Zielwahl-Redesign offen |
| 20 | Mini-DM | Arena | 0,094 | nein | **beides**, Zielwahl-Redesign offen |

**Der zentrale Befund dieser Tabelle:** zwoelf Disziplinen bestehen die Rangtreue-Schranke, aber
nur drei davon waren produktionsseitig angeschlossen. **Neun Disziplinen hatten ihre Abnahme
bestanden und lagen trotzdem brach** — nicht wegen eines Rezeptproblems, sondern weil niemand
den Konfigurationsschritt gemacht hatte. Das ist mit Abstand der groesste unrealisierte Wert im
Projekt, und er kostet keine einzige Zeile Motor-Code.

Die neun zerfallen sauber in zwei Gruppen, und der Unterschied entscheidet den Plan:

- **Fuenf BUEHNEN-Disziplinen** (Eiskunstlauf, Breaking, Wettessen, Tennis, Fechten): ihr Chassis
  existiert bereits und ist in Welle 1 produktiv bewiesen worden. `spieleBuehneAuftritt()` fuer
  die ersten drei (Showcases Chassis), `spieleBuehneDuell()` fuer Tennis/Fechten (Speed-Schachs
  Chassis). **Reine Konfiguration.**
- **Vier BAHN-Disziplinen** (Staffel, Spurt, Takeshi's Castle, Time-Trial): fuer die Bahn gibt es
  ueberhaupt **kein** Arena-Chassis — `spieleBahn*()` existiert im Motor nicht, `runArenaFixtures()`
  kennt nur vier Einstiegspunkte (Feldspiel, Buehne-Heben, Buehne-Duell, Buehne-Auftritt). Das ist
  ein echter Bauauftrag, keine Konfiguration.

### Was die beiden juengsten Recherchen dazu beitragen

**`docs/design/einheitlicher-spieler-score-pps-recherche-09-09.md`** (Chris' Sorge: „damit wir
nicht bei TDM ein Impact Rating bis 900 haben aber in Schach was völlig anderes") kommt
unabhaengig zum selben Schluss und formuliert ihn als Auftrag: *„Der Mechanismus, der das Problem
lösen würde, EXISTIERT bereits und ist an fünf von zwanzig Disziplinen bewiesen — er muss nur auf
den Rest angewendet werden, bevor eine dieser Disziplinen produktiv geht."* Genau dieser
Mechanismus ist die Impact-Kurve, und genau die bekommen die fuenf Buehnen-Disziplinen mit dieser
Runde. **Die Produktivierung ist damit nicht nur ein Fertigstellungs-, sondern auch der
Vereinheitlichungsschritt, den Chris am selben Tag angefragt hat.**

**`docs/design/pruefung-2-6-spieler-tauglichkeit-alle-disziplinen-08-09.md`** liefert die
Einschraenkung, die man kennen muss: keine der vier Baufunktionen reicht die real gewuerfelte
Feldgroesse in den Motor durch, alle lesen eine feste Katalogkonstante. Fuer die neun
Feldspiel-/Buehnen-Disziplinen faengt eine echt gesetzte Aufstellung das auf BEIDEN Seiten ab —
**alle fuenf dieser Runde gehoeren zu dieser harmloseren Klasse.** Zusaetzlich faengt, wie jenes
Dokument selbst festhaelt, die je Feldgroesse getrennt gezogene PPS-Referenz den Rest auf der
Punkte-Seite ab; genau deshalb zieht die Referenz dieser Runde alle fuenf Feldgroessen 2..6
einzeln. Die vier Bahn-Disziplinen liegen dagegen in der schaerferen Klasse (Gegnerseite
strukturell auf die Konstante festgenagelt) — ein weiteres, unabhaengiges Argument dafuer, die
Bahn NICHT in derselben Runde mitzunehmen.

---

## 2. Der priorisierte Plan

### Prioritaet 1 — Produktivierungswelle 2: die fuenf Buehnen-Disziplinen ✅ IN DIESER RUNDE UMGESETZT

**Warum zuerst:** beste Aufwand/Nutzen-Bilanz im gesamten Feld, mit deutlichem Abstand.

- **Nutzen:** verdoppelt die produktionsangeschlossenen Disziplinen von 5 auf **10** — die
  Haelfte des Feldes. Fuenf Disziplinen wechseln von „laeuft nur im Mockup" auf „wird im echten
  Spielstand abgerechnet", jede mit echter Boxscore-an-PPs-Berechnung statt des alten
  PPS-Rang-Pfads. Beantwortet nebenbei Chris' Score-Vereinheitlichungs-Frage vom selben Tag.
- **Aufwand:** kein Byte Motor-Code. Der Diff an `public/mockups/battle-mode.engine.js` ist leer.
- **Risiko:** das niedrigste aller Kandidaten — es gibt einen bewiesenen Praezedenzfall (Welle 1,
  06.09.), zwei Fail-Fast-Pruefungen beim Modul-Laden fangen genau die Fehler ab, die hier
  moeglich sind, und die Rangtreue ist strukturell unberuehrt (die Sonde misst den rohen Motor,
  den diese Aenderung nicht anfasst).

Details in Abschnitt 3.

### Prioritaet 2 — Bahn-Wertung und Bahn-Chassis („Wertungstabelle Welle 2")

**Vier weitere Disziplinen auf einen Schlag**, darunter mit Staffel (0,915) die rangtreueste des
ganzen Feldes, sowie Spurt (0,871), Takeshi's Castle (0,861) und Time-Trial (0,828). Danach
waeren **14 von 20** angeschlossen.

Was konkret fehlt, in dieser Reihenfolge:

1. **Eine echte Wertung fuer Staffel.** `bahnTeamstand()` (`battle-mode.engine.js:15782`) liefert
   fuer Staffel `{seiten:[...], gewertet:false}`; die Live-HUD-Meldung sagt woertlich „fuer diese
   Disziplin gibt es noch keine Wertung". Fuer Time-Trial/Spurt/Climbing vergibt dieselbe Funktion
   bereits Rangpunkte — **Staffel ist der Sonderfall, nicht die Bahn insgesamt.** Das ist eine
   Design-Entscheidung (was ist ein Staffel-Team-Sieg: Gesamtzeit? Etappenraenge?) und gehoert
   Chris, nicht der Automatik.
2. **Ein `spieleBahn()`-Einstiegspunkt im Motor** plus eine vierte Chassis-Menge im
   `runArenaFixtures()`-Dispatch — strukturell dieselbe Arbeit wie `spieleBuehneAuftritt()` in
   Welle 1, aber echter neuer Code.
3. **Die Gegnerseiten-Luecke aus der 08.09.-Pruefung.** Fuer die Bahn ist die Gegnerseite
   strukturell auf die Katalogkonstante festgenagelt. PR #864 (`gastGesetzt`) hat hier bereits
   gearbeitet; ob das den Befund vollstaendig schliesst, ist **nicht verifiziert** und waere der
   erste Schritt einer Bahn-Runde.

**Empfehlung: Punkt 1 zuerst als Frage an Chris stellen**, bevor jemand Punkt 2 baut — sonst baut
man ein Chassis fuer eine Wertung, die es noch nicht gibt. Spurt/Takeshi's/Time-Trial koennten
theoretisch auch ohne Staffel vorgezogen werden (sie sind bereits `gewertet`), das waere die
risikoaermere Teilmenge.

### Prioritaet 3 — die Arena-Zielwahl (TDM, Mini-DM, Battlefield)

Der groesste **Rangtreue**-Hebel des Projekts (0,094–0,387, die drei schlechtesten Zahlen im
Feld) und zugleich die Disziplinen, hinter denen Chris' „Impact bis 900"-Beobachtung steckt.

**Was konkret gemeint ist mit „Zielwahl haengt an der Geometrie, nicht an der Recherche-Frage":**
die Arena-KI waehlt ihr Ziel nach **Naehe**, nicht nach **Bedrohung** — nachgemessen zielen 264
von 288 Kaempfern schlicht auf den naechststehenden Gegner. Dadurch bekommt der staerkere Kaempfer
weder mehr Gelegenheiten noch die wichtigeren Ziele; seine Ueberlegenheit schlaegt nur im Schaden
JE Gelegenheit durch, und das reicht nicht, um eine Rangordnung zu erzeugen. Fables Vorschlag K1
(`docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md`, 03.09.) ist deshalb **kein Neubau,
sondern ein Standardwechsel**: `u.zielP==="bedrohung"` existiert bereits als Spieler-Option im
Motor und muesste KI-Standard werden, mit Hysterese, damit niemand im Kreis laeuft.

**Warum das trotz klarer Diagnose NICHT die Prioritaet 1 ist und in dieser Sitzung bewusst nicht
umgesetzt wurde** — der Grund ist eine Messgrenze, kein Mut-Problem: bei allen drei Arena-
Disziplinen ist die **Kader-Spannweite groesser als der eigene Median** (Mini-DM 0,697 gegen
0,094; Battlefield 0,938 gegen 0,387; TDM 0,328 gegen 0,253). Nach der projekteigenen Faustregel
ist damit **jede Bewegung bei n=24 von Null nicht unterscheidbar** — man koennte die Aenderung
bauen und haette hinterher keine Moeglichkeit, ihren Erfolg nachzuweisen. `stand-aller-
disziplinen.md` fordert dafuer ausdruecklich n ≥ 96–150. Bei rund 8,3 s je Fixture in dieser
Umgebung ist das ein Messlauf von mehreren Stunden je Variante. **Der naechste Schritt fuer die
Arena ist deshalb ein Messbudget, nicht ein Commit** — und das ist eine Planungsentscheidung,
keine Umsetzung, die nebenher passieren darf.

### Ausdruecklich NICHT priorisiert, mit Begruendung

- **Football (0,516).** Der groesste Einzel-Rueckstand unter den Nicht-Arena-Disziplinen, aber
  drei Runden (NFL-Kalibrierung → 0,460, Down-Verdrahtung → 0,468, eigener `spielEignung`-Block
  → 0,516) haben zusammen 0,17 gebracht. Was fehlt, ist eine echte Rezept-Neukalibrierung mit
  vielen Freiheitsgraden — **kein umrissener Bugfix**, und damit genau der Fall, den der Auftrag
  als „nicht blind implementieren" beschreibt.
- **Climbing (0,790).** Mit 0,010 Fehlbetrag die billigste offene Rangtreue-Baustelle des Feldes
  — aber die eigene Kader-Spannweite betraegt 0,192, das Neunzehnfache des Fehlbetrags. Eine
  Aenderung, die 0,010 bewegt, ist hier nicht nachweisbar. Als eigene, kleine Runde mit groesserem
  n sinnvoll; nicht als Nebenbei-Fix.
- **I-Spy (0,684).** Technisch der **billigste** Eintrag von allen — es traegt `duell:true` und
  braeuchte nur eine Zeile. Genau deshalb bewusst draussen: es besteht seine eigene Abnahme nicht,
  und die beiden Achsen duerfen nicht deshalb vermischt werden, weil eine davon billig zu
  erfuellen waere. Ein eigener Regressionstest haelt das jetzt fest.

---

## 3. Was in dieser Runde umgesetzt wurde — Produktivierungswelle 2

**Fuenf Disziplinen werden arena-aufgeloest: Eiskunstlauf, Breaking, Wettessen, Tennis, Fechten.**
`ARENA_RESOLVED_DISCIPLINE_IDS` waechst von 5 auf 10.

### 3.1 Die Zuordnung, jede Zeile einzeln nachgesehen

| Disziplin | rho je Spiel | `BUEHNE_ART`-Flag | Chassis (existiert bereits) | `playerCount` |
|---|---:|---|---|---:|
| Eiskunstlauf | 0,875 | *(keins; `duett:true`)* | `spieleBuehneAuftritt()` | 3 |
| Breaking | 0,869 | *(keins)* | `spieleBuehneAuftritt()` | 4 |
| Wettessen | 0,845 | *(keins)* | `spieleBuehneAuftritt()` | 5 |
| Tennis | 0,825 | `duell:true` | `spieleBuehneDuell()` | 3 |
| Fechten | 0,816 | `duell:true` | `spieleBuehneDuell()` | 5 |

**Die eine Falle dieser Welle, benannt statt uebersehen:** Eiskunstlauf traegt `duett:true` — das
ist **kein** Chassis-Flag, sondern die automatische Paarung bei gerader Feldgroesse aus PR #859.
`BUEHNE_ART.eiskunstlauf` traegt weder `.heben` noch `.duell`, das Auftritts-Chassis ist damit der
richtige und einzige Einstiegspunkt. Die Namensaehnlichkeit `duett`/`duell` ist im Code
ausdruecklich kommentiert, damit ein kuenftiger Leser sie nicht fuer einen Copy-Paste-Fehler haelt.

**Kein `playerCount` ist 6** — jeder Wert einzeln in `lib/data/dataAdapter.ts` nachgesehen, nicht
von einer Vorlage kopiert. Die naheliegende Falle waere `BUEHNE_ART[d].jeSeite` gewesen: die ist
fuer alle fuenf 6, ist aber die MOTOR-Feldgroesse und an dieser Stelle der falsche Wert. Genau
dieser Fehler ist in Welle 1 zweimal aktiv vermieden worden (Hockey 5, Speed-Schach 2), die
Kommentare dort warnen davor.

### 3.2 Der Diff

1. **`lib/battle/arena-headless-runner.ts`** — zwei Chassis-Mengen erweitert (Tennis/Fechten zu
   Duell, Eiskunstlauf/Breaking/Wettessen zu Auftritt). Keine neue Verzweigung: der Dispatch
   entscheidet ausschliesslich ueber Mengenzugehoerigkeit, exakt wie sein eigener Kommentar es
   ankuendigt („NUR DIESE MENGE ENTSCHEIDET").
2. **`lib/resolve/battle-mode-arena-team-points.ts`** — fuenf Eintraege in
   `ARENA_RESOLVED_DISCIPLINE_IDS`, fuenf in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`, fuenf
   Referenz-Importe und fuenf Konstantenpaare. **Keine Aenderung an `ppsAusArenaImpact()` oder
   `computeIndividualBoxscorePpsFromFixtureResults()`** — die Kurve selbst ist unberuehrt.
3. **`data/generated/<disziplin>-pps-referenz.json`** (5 neue Dateien) — je `iMittel` (Median) und
   `iKrass` (99,5.-Perzentil) des rohen Buehnen-Werts, getrennt fuer die Feldgroessen 2..6, gezogen
   gegen echte Liga-Kader aus dem `live-save`-Abbild.
4. **`scripts/ziehe-buehne-pps-referenz.ts`** (neu) — EIN generisches Ziehskript statt fuenf
   Kopien. Begruendung: die drei Welle-1-Skripte sind untereinander bereits zu ueber 95 %
   wortgleich (nachgemessen: der Diff zwischen dem Showcase- und dem Speed-Schach-Skript besteht,
   Kommentare abgezogen, aus **sechs** geaenderten Stellen). Fuenf weitere Kopien haetten rund
   1650 Zeilen reine Duplikation ergeben. **Die drei Welle-1-Skripte bleiben unangetastet** — sie
   sind in der Provenienz der bereits gezogenen JSONs namentlich genannt; sie einzuschmelzen waere
   eine zweite, unabhaengige Aenderung mit eigenem Risiko.
5. **`tests/battle-mode-arena-team-points.test.ts`** — zwei neue Tests: die Mitgliedschaft der
   fuenf, und der I-Spy-Nichteintrag mit gemessener Begruendung.

**`public/mockups/battle-mode.engine.js` ist NICHT angefasst.** Das ist der Kern der Aussage
„reine Konfigurationsaenderung" und zugleich der Grund, warum die Rangtreue aller zwanzig
Disziplinen strukturell unberuehrt bleibt: `disziplinProbe()` misst genau diese Datei.

### 3.3 Warum `scripts/pruefe-pps-referenz-frische.ts` nicht angefasst werden musste

Es leitet seine Disziplinliste aus `ARENA_RESOLVED_DISCIPLINE_IDS` ab und nimmt die fuenf neuen
deshalb automatisch auf — nachgesehen, nicht angenommen.

### 3.4 Die gezogenen Referenzen — und was sie ueber Chris' „Impact bis 900"-Sorge sagen

Alle fuenf Ziehungen liefen gegen echte Liga-Kader aus dem `live-save`-Abbild („Oly New Game
Custom 19.8.2026"), 64 Fixtures je Feldgroesse, Feldgroessen 2..6 einzeln, alle gegen denselben
Motor-Hash `c93f0f3b`. **Kein einziger entarteter Eintrag** (`iMittel > 0` und `iKrass > iMittel`
gilt fuer alle 25 Feldgroessen-Eintraege) — anders als bei Gewichthebens Erstziehung, die bei
n=2 einen Median von 0 hatte und den Fallback-Pfad brauchte.

Die Rohwerte bei Feldgroesse 6, nebeneinandergestellt — und das ist der Befund, der Chris'
Frage vom selben Tag direkt beantwortet:

| Disziplin | `iMittel` (Median) | `iKrass` (p99,5) |
|---|---:|---:|
| Eiskunstlauf | 815,5 | 1182,97 |
| Tennis | 761,0 | 1200,82 |
| Fechten | 658,0 | 1140,17 |
| Wettessen | 561,5 | 970,64 |
| Breaking | 552,0 | 947,66 |
| *(Basketball, zum Vergleich)* | *15,42* | *51,52* |

**Eiskunstlaufs Rohwert liegt bei rund 800–1200 — exakt die Groessenordnung, ueber die Chris sich
beschwert hat („bei TDM ein Impact Rating bis 900 oder so aber in Schach was völlig anderes"),
und rund das Fuenfzigfache von Basketballs Median (15,42) und das Zwanzigfache seines p99,5 (51,52).** Genau diese Rohwerte laufen ab jetzt durch
dieselbe Impact-Kurve auf dieselbe 0–5,5-PPs-Skala wie Basketball. Fuenf weitere Disziplinen
sind damit nicht nur angeschlossen, sondern auch **vereinheitlicht**.

Es ist zugleich der schaerfste Beleg dafuer, warum der Fail-Fast in dieser Datei notwendig ist:
haette eine dieser fuenf keinen eigenen `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag bekommen,
waere sie still gegen Basketballs `iKrass` von 51,52 normiert worden — **jeder einzelne Spieler
haette kommentarlos die volle Hoechstpunktzahl bekommen**, ohne Fehler, ohne Warnung, mitten in
einer echten Saison.

### 3.5 Die Reihenfolge, in der das gebaut werden musste (fuer kuenftige Wellen)

Es gibt ein Henne-Ei-Problem: der Fail-Fast beim Modul-Laden von
`battle-mode-arena-team-points.ts` verlangt fuer jede arena-aufgeloeste Disziplin einen
Impact-Konfig-Eintrag, und der importiert eine PPS-Referenz-JSON, die es vor der Ziehung noch
nicht gibt. Aufgeloest ueber die Importrichtung — **nachgesehen, nicht vermutet**:
`arena-headless-runner.ts` und `arena-kader-adapter.ts` importieren
`battle-mode-arena-team-points.ts` **nicht**. Also:

1. Nur die Chassis-Mengen in `arena-headless-runner.ts` eintragen.
2. Referenzen ziehen (das Ziehskript importiert die Team-Points-Datei bewusst nicht).
3. Erst dann `ARENA_RESOLVED_DISCIPLINE_IDS` + `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` eintragen.

---

## 4. Verifikation

**Methodisch wichtig: jede Pruefung wurde ZWEIMAL gefahren** — einmal im Aenderungs-Worktree und
einmal in einem zweiten, voellig unberuehrten Worktree auf demselben `origin/main` (`/tmp/wt-baseline`).
Nur der VERGLEICH der beiden Laeufe erlaubt die Aussage „das war schon vorher so"; ein einzelner
Lauf haette jeden Vorbefund als eigenen Fehler ausgesehen lassen.

| Pruefung | Ergebnis | gegen unberuehrtes `main` |
|---|---|---|
| `npx vitest run` (volle Suite) | **1027 Dateien / 8132 Tests gruen**, 2 Dateien + 23 Tests skipped, **0 Fehler** | — |
| `node scripts/pruefe-rangtreue-schranke.mjs` (alle 20, kaderfest) | **bestanden**, keine Disziplin unter ihrer Schranke | **Tabelle Zeile fuer Zeile identisch** |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **haelt**, max. 0,005 Pp (Grenze 0,2) | unveraendert |
| `npx tsc --noEmit` | 560 Fehler, **keiner in einer geaenderten Datei** | **ebenfalls exakt 560** |
| `npx eslint` (geaenderte Dateien) | 0 Fehler, 2 Warnungen | **dieselben 2**, nur um die eingefuegten Zeilen verschoben |
| `npx tsx scripts/pruefe-pps-referenz-frische.ts` | 5 neue Referenzen **aktuell**, 5 alte veraltet | **die 5 alten waren vorher schon veraltet** |

### 4.1 Die Rangtreue ist unveraendert — und warum das strukturell so sein MUSS

Alle zwanzig Disziplinen stehen relativ zum unberuehrten `main` bei **±0,000**. Das ist kein
Glueck, sondern Konstruktion: `disziplinProbe()` misst `public/mockups/battle-mode.engine.js` im
Browser, und diese Datei ist von der Welle nicht angefasst. Die Aenderung sitzt vollstaendig im
Resolve-/Punkte-Pfad **hinter** der Simulation.

**Zwei Zeilen weichen von der eingecheckten Basislinie ab — und beide tun das auch ohne diese
Aenderung:** Gewichtheben +0,007 (0,847 → 0,854) und Eiskunstlauf +0,010 (0,875 → 0,885). Der
Baseline-Lauf zeigt **exakt dieselben zwei Abweichungen mit exakt denselben Zahlen**. Es sind
also stale Eintraege in `data/generated/rangtreue-basislinie.json`, kein Effekt dieser Welle:
Gewichthebens echte 0,854 sind in `stand-aller-disziplinen.md` bereits seit dem 07.09. notiert,
und Eiskunstlaufs Bewegung faellt zeitlich mit PR #859 (Eiskunstlauf-Duett) zusammen, der **nach**
der Basislinienziehung gemergt wurde. Beide Abweichungen zeigen **nach oben**, weshalb die
CI-Schranke (die nur Rueckgaenge faengt) sie nie gemeldet hat.

**Das ist ein echter, eigenstaendiger Fund dieser Runde** — genau die „Basislinie schuetzt
nichts"-Situation, vor der `stand-aller-disziplinen.md` Abschnitt 2b warnt. Er ist hier bewusst
**nur dokumentiert und nicht mitrepariert**: `node scripts/baue-rangtreue-basislinie.mjs 24` neu
laufen zu lassen waere eine zweite, unabhaengige Aenderung, die die Beweisfuehrung dieser PR
(„alle zwanzig Zeilen ±0,000") unlesbar machen wuerde. Er gehoert in den naechsten
Basislinien-Nachzug-PR.

### 4.2 Die PPS-Referenz-Frische, ehrlich gelesen

Der Pruefer meldet FEHLGESCHLAGEN — **das tut er auf unberuehrtem `main` genauso**, und zwar fuer
dieselben fuenf Disziplinen (Basketball, Gewichtheben, Hockey, Showcase, Speed-Schach). Grund ist
der im Skript selbst dokumentierte Mechanismus: der Vergleich laeuft ueber den Hash der GESAMTEN
Motor-Datei, sodass jede fremde Motor-Aenderung (hier #858/#859/#864) alle bestehenden Referenzen
als veraltet markiert, auch wenn die betroffene Disziplin unberuehrt blieb. In CI ist der Job
deshalb `continue-on-error: true`.

**Diese Welle verbessert die Lage, statt sie zu verschlechtern:** die fuenf neu gezogenen
Referenzen tragen den aktuellen Motor-Hash `c93f0f3b` und sind die einzigen fuenf, die als
„aktuell" gelten. Ob die fuenf alten eine echte Neuziehung brauchen, ist eine offene Frage fuer
eine eigene Runde — und bewusst nicht Teil dieser.

### 4.3 Zwei Tests, die an der eigenen Kontrolldisziplin scheiterten — der lehrreichste Fund

Zwei Tests benutzten ausgerechnet **Fechten** als „garantiert nicht arena-aufgeloeste"
Gegenprobe (`tests/battle-mode-arena-resolve-engine.test.ts`,
`tests/battle-mode-arena-matchday-resolve-e2e.test.ts`). Indem diese Welle Fechten produktiv
schaltet, verloren beide still ihren Gegenstand — und meldeten das nicht als „Kontrolldisziplin
ist keine Kontrolle mehr", sondern als verwirrenden Zahlendiff („pointsAwarded 3,77 statt 6,6").

Behoben nicht durch stilles Austauschen des Literals, sondern strukturell: beide Dateien tragen
jetzt eine benannte Konstante `D2_KONTROLL_DISZIPLIN = "football"` **plus einen eigenen
Wachhund-Test**, der prueft, dass diese Disziplin wirklich nicht arena-aufgeloest ist. Die
naechste Welle, die Football produktiv schaltet, bekommt damit eine Fehlermeldung, die sagt, was
zu tun ist, statt eines Zahlendiffs, den jemand erst debuggen muss.

**Football wurde als Ersatz gewaehlt, weil dieses Briefing es selbst NICHT priorisiert** (rho
0,516, braucht eine echte Rezept-Neukalibrierung) — es ist damit die Disziplin, die am
laengsten eine gueltige Gegenprobe bleiben wird.

### 4.4 Eine Nebenbeobachtung, die nicht zu dieser Welle gehoert

Ein voller `vitest run` veraendert die eingecheckte Datei `data/generated/oly-player-stats.json`
(eine `portraitUrl`-Zeile). Das passiert unabhaengig von dieser Aenderung, ist hier
zurueckgesetzt worden und gehoert nicht in diese PR — aber ein Test, der eine versionierte
Datei beschreibt, ist ein eigener, kleiner Fund fuer eine spaetere Runde.

Siehe Abschnitt 5 fuer das, was bewusst nicht verifiziert werden konnte.

---

## 5. Was NICHT verifiziert werden konnte — ehrliche Grenzen dieser Runde

1. **Kein echter Spielstand nutzt Battle Mode.** Unveraendert gegenueber Welle 1: alle Saves im
   `live-save`-Abbild haben `scenarioMeta.gameMode` nicht gesetzt, `isBattleModeSave()` faellt auf
   `"manager"` zurueck. **Die gesamte Arena-Produktivierung — jetzt zehn Disziplinen — wirkt sich
   auf KEINEN von Chris' aktuellen Spielstaenden aus.** `gameMode` wird bei Save-Anlage entschieden
   und aendert sich nie wieder; erst ein NEUER Save mit Battle-Mode-Wahl schaltet das scharf. Das
   ist kein Mangel dieser Runde, aber es heisst: der Nutzen ist real, aber vorerst latent.
2. **Keine Sicht-QA.** Es wurde kein Spieltag im Browser durchgeklickt. Die Aenderung ist reine
   Konfiguration im Resolve-Pfad und beruehrt keine Darstellung, aber „nicht beruehrt" ist
   argumentiert, nicht gesehen.
3. **Die PPS-Referenzen sind mit 60 Fixtures je Feldgroesse gezogen**, wie in Welle 1 — nicht mit
   Basketballs 300+. Das ist unveraendert eine Zeitbudget-, keine methodische Entscheidung, und in
   jeder erzeugten JSON-Datei im `hinweis`-Feld dokumentiert.
4. **Die Bahn-Gegnerseiten-Luecke ist offen**, s. Prioritaet 2 Punkt 3 — es wurde nicht geprueft,
   ob PR #864 sie vollstaendig schliesst.
5. **Kein Zugriff auf den Server**, wie in CLAUDE.md beschrieben — alle Aussagen ueber
   Spielstaende stammen aus dem `live-save`-Abbild ueber GitHub.

---

## 6. Empfehlung an Chris — drei Saetze

1. **Welle 2 mergen** (der Code-PR zu diesem Briefing): zehn von zwanzig Disziplinen sind danach
   produktionsangeschlossen, ohne dass eine Zeile Motor-Code angefasst wurde.
2. **Eine Entscheidung wird gebraucht, bevor die naechste Welle gebaut werden kann:** was ist ein
   Staffel-Team-Sieg — die Gesamtzeit, oder die Summe der Etappenraenge? Ohne diese Antwort kann
   Staffel (0,915, die rangtreueste Disziplin des Feldes) nicht angeschlossen werden.
3. **Die Arena (TDM/Mini-DM/Battlefield) braucht als naechstes ein Messbudget, keinen Commit** —
   ihre Kader-Spannweite ist groesser als ihr Median, jede Aenderung waere bei n=24 unbeweisbar.

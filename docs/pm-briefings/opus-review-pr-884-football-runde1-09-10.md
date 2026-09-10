# Opus-Overseer-Review PR #884 — Football-Gameplay Runde 1 (fkLos/kappa 3, Rezept C, Tackle-Zeile)

**Datum:** 10.09.2026
**PR:** #884, Branch `claude/football-round1-09-10`, Kopf `5117775366dac9c9db39ddad47db6ea1091eb8eb`
**Basis der PR:** `46b90c8e` (Merge-Base; `origin/main` steht auf `743e1186`, ein reiner Doku-Commit darueber)
**Umgesetzter Plan:** `docs/pm-briefings/opus-plan-football-gameplay-09-10.md` (Runde 1)
**Reviewer:** unabhaengiger Opus-Overseer, an PR #884 nicht mitgearbeitet
**Pruefumgebung:** drei eigene, isolierte Worktrees — `wt-884` auf `5117775366`, `wt-base` auf
`46b90c8e`, `wt-c56` auf `c56fffd7` (der Basis-Commit, gegen den der Plan gemessen hat).
`node_modules` je als Symlink auf den Hauptbaum. Im geteilten Hauptbaum wurde nichts gemessen
und nichts angefasst; alle drei Worktrees sind nach den Messungen wieder sauber
(`git status --porcelain` leer).

**Warum diese Review ausfuehrlicher ausfaellt als die sechs Geschwister-Reviews
(#872/#874/#875/#876/#880/#883):** die PR bewegt gleichzeitig eine Lotterieform, fuenf von neun
Rezeptzeilen und einen Term in genau jener Funktion, die zugleich der Messmassstab ist
(`feldspielWert()`). Das sind viele Freiheitsgrade auf einmal, und `battle-mode.engine.js` ist die
Datei, aus der Basketball, Hockey und Tennis ihre Lotterie beziehen — drei LIVE-Disziplinen. Ich
habe deshalb nicht nur die Endzahlen nachgemessen, sondern den Zuwachs in seine Bestandteile
zerlegt und die Kontrollgruppen-Neutralitaet **strukturell** (Byte-Vergleich der geteilten
Funktionskoerper) statt nur per `grep` belegt.

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

**Die zentrale Behauptung dieser PR haelt — vollstaendig und auf die Ziffer.** rho je Spiel geht
von 0,516 auf 0,800, bei n=24 und bei n=48 ziffernidentisch, die Kader-Spannweite faellt von
0,172 auf 0,054, und **achtzehn von zwanzig Disziplinen lesen exakt ±0,000**. Die beiden
Ausreisser (Gewichtheben +0,007, Eiskunstlauf +0,010) habe ich in meinem Basis-Worktree
**ohne** diese PR nachgemessen — sie stehen dort schon genauso. Sie stammen nicht von #884.
Das ist die sauberste Beweislage, die Football je hatte, und der groesste rho-Gewinn dieser
ganzen Session.

**Der Korridor-Shift ist KEIN Merge-Hindernis — aber aus einem anderen Grund, als die PR
angibt.** Die PR begruendet ihre eigene Review-Bitte damit, Football stehe in
`ARENA_RESOLVED_DISCIPLINE_IDS` und sei „live". **Das stimmt nicht** (Fund F1, nachgesehen, nicht
vermutet): die Menge enthaelt dreizehn Disziplinen, Football ist nicht darunter, und
`lib/resolve/legacy-matchday-resolve-engine.ts:720` schickt Football-Spieltage deshalb weiter
ueber den Alt-Pfad. Der verschobene Korridor erreicht heute **keinen einzigen ausgewerteten
Spieltag auf dem Hetzner-Server**. Er erreicht die interaktive Battle-Arena, das Mockup und
`dev-arena` — und er wird die Spieltagsergebnisse in dem Moment erreichen, in dem Football
produktiv geschaltet wird. Genau das ist die Auflage unten.

**Vier Nachtraege, keiner davon Code:**

1. **Die „live"-Behauptung korrigieren** (F1) und festhalten: **Football darf NICHT in
   `ARENA_RESOLVED_DISCIPLINE_IDS`, bevor der Korridor-Refit aus Runde 2 sitzt.** Solange das
   nirgends steht, ist es eine Zeile, die jemand in gutem Glauben ergaenzt.
2. **Die Impact-0-Zahl korrigieren** (F2): kaderfest gemessen sind es **8,9 %**, nicht 5,9 %.
   Chris soll die richtige Zahl abnicken, nicht die freundlichere.
3. **Die Ist-Stand-Korridorspalte des PLANS korrigieren** (F3): sie ist veraltet und auf `main`
   irrefuehrend. Die PR-Beschreibung hat sie stillschweigend richtiggestellt — das Plandokument
   nicht.
4. **Den strukturellen Beweis richtig zitieren** (F4): das in der PR abgedruckte
   `grep → leer` ist so nicht reproduzierbar. Die Aussage dahinter ist wahr, der Beleg dafuer ist
   ein anderer.

Zwei Runde-2-Tickets fallen zusaetzlich an (F5 Phantom-Tackle beim Touchdown, F6 Tkl und Sack aus
derselben Ziehung). Beide sind Fachlichkeit im Box Score, kein Rangtreue-Problem.

---

## 1. Was ich selbst gefahren habe

Alle Laeufe synchron und blockierend, in meinen eigenen Worktrees. **Keine einzige Zahl aus der
PR-Beschreibung uebernommen.**

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24 football basketball hockey tennis`, PR-Kopf | football **0,800** / 0,054 / 0,867 / 0,077 |
| dieselbe Zeile auf `46b90c8e` | football **0,516** / 0,172 / 0,811 / 0,168 |
| basketball / hockey / tennis, beide Seiten | **ziffernidentisch** (s. 2.2) |
| `miss-alle-disziplinen.mjs 48 football`, PR-Kopf | **0,800** / 0,082 / 0,902 / 0,098 |
| `… 48 football --je-seite=4`, PR vs. Basis | **0,795** / 0,130 gegen 0,679 / 0,399 |
| `… 48 football --je-seite=2`, PR vs. Basis | **0,767** / 0,458 gegen 0,763 / 0,742 |
| `pruefe-rangtreue-schranke.mjs`, alle 20, PR-Kopf | bestanden, **18x ±0,000** (s. 2.3) |
| `miss-alle-disziplinen.mjs 24 gewichtheben eiskunstlauf football` auf `46b90c8e` | **0,854 / 0,885 / 0,516** — Ausreisser schon ohne die PR da |
| Tackle-Gewicht 0,00 / 0,12 / 0,20 / 0,35 selbst gepatcht, je n=24 | **0,775 / 0,794 / 0,792 / 0,772** (s. 2.5) |
| Zerlegung: nur kappa=3, altes Rezept, keine Tackle-Zeile | **0,714** / 0,169 |
| Zerlegung: nur Rezept C, alte flache Lotterie, keine Tackle-Zeile | **0,597** / 0,258 (neu, s. F7) |
| `miss-football-korridor.mjs 120`, PR-Kopf | 12 Kennzahlen, **alle 12 ziffernidentisch zur PR** |
| dasselbe auf `46b90c8e` **und** auf `c56fffd7` | identisch zueinander, **abweichend vom Plan** (F3) |
| `sondiere-feldspiel-subskills.mjs football 24`, PR-Kopf | TEAMGEIST 44,1 / LAUFKRAFT 28,6 / ABWEHR_LAUF 9,7 / … (s. 2.7) |
| Eigene Impact-0-Sonde ueber `window.__arena.disziplinProbe`, kaderfest n=24 und n=48 | **8,9 % / 8,5 %** gegen Basis 0,2 % (F2) |
| dieselbe Sonde mit Tackle-Gewicht 0 | 9,9 % — die Tackle-Zeile senkt um **1,0 pp**, nicht um 3 |
| Byte-Vergleich der geteilten Lotterie-Bloecke, Basis vs. PR | `diff` **leer** (s. 2.1) |
| `node --check public/mockups/battle-mode.engine.js` | OK |
| `npx tsc --noEmit`, PR-Kopf | **560 Fehler**, alle vorbestehend in `tests/*.ts` |
| `npx tsx scripts/pruefe-slot-invariante.ts` | haelt, max. **0,005 Pp** ueber 20 Disziplinen x 6 Groessen |
| vier Battle-Mode-Vitest-Suiten (echter Chromium) | **92/92 gruen**, 14,4 s |
| GitHub-CI auf `5117775366` | **4/4 gruen**: `test-and-smoke`, `full-test-suite`, `persistenz-suiten`, `pps-referenz-frische` |

---

## 2. Behauptung fuer Behauptung

### 2.1 `fkLos()` ist wirklich neu — und `gewichtetesLos()` ist wirklich unberuehrt

Der Diff umfasst **eine** Datei, 114 `+` / 23 `-`, elf Hunks, alles in
`public/mockups/battle-mode.engine.js`. Ich habe ihn Zeile fuer Zeile gelesen.

`fkLos` ist keine Umbenennung. Es ist eine eigene Konstante plus eine eigene Pfeilfunktion,
zwei Zeilen, unmittelbar vor `resolveLauf()`:

```js
const FK_LOS_KAPPA=3;
const fkLos=(sp,rolle)=>gewichtetesLosNach(sp,u=>Math.pow(Math.max(1,u[rolle]-LOS_NULLPUNKT),FK_LOS_KAPPA));
```

Das ist strukturell etwas anderes als `gewichtetesLos()`, das linear ueber
`Math.max(1,x[rolle])` summiert — nicht derselbe Koerper unter neuem Namen. `FK_LOS_KAPPA` ist
eine **eigene** Konstante; `LOS_KAPPA` (Basketballs 3) wird nirgends gelesen. Geteilt genutzt
werden nur `gewichtetesLosNach()` (ein generischer Ziehungsmechanismus, der eine Gewichtsfunktion
entgegennimmt) und `LOS_NULLPUNKT` (20) — beides **lesend**, beides unveraendert.

**Die in der PR abgedruckte Beweisformel funktioniert so nicht** (F4). Ich habe sie wortgetreu
reproduziert:

```
git diff -U0 46b90c8e..HEAD | grep -E "gewichtetesLos|gewichtetesLosNach|losGewicht|LOS_NULLPUNKT|LOS_KAPPA"
```

Sie liefert **acht Zeilen**, nicht null: sechs Kommentarzeilen, die die Namen erwaehnen, die
`fkLos`-Definition (die `gewichtetesLosNach` und `LOS_NULLPUNKT` benutzt) und die sieben
entfernten `-`-Aufrufstellen. Das ist erwartbar und harmlos — aber es ist kein Beweis, und
jemand, der ihn nachfaehrt und acht Treffer sieht, muss annehmen, die Zusage sei gebrochen.

**Der Beweis, der traegt**, ist der Byte-Vergleich der Definitionen. Ich habe die
Deklarationsbloecke aus beiden Bauemen extrahiert und verglichen:

| Block | Basis `46b90c8e` | PR-Kopf | `diff` |
|---|---|---|---|
| `gewichtetesLos` / `LOS_NULLPUNKT` / `LOS_KAPPA` / `losGewicht` | Z. 4770–4820 | Z. 4807–4857 | **leer** |
| `gewichtetesLosNach` | Z. 7604–7614 | Z. 7692–7702 | **leer** |

Zeichen fuer Zeichen identisch, nur um 37 bzw. 88 Zeilen nach unten verschoben. **Empfehlung:
diesen Vergleich statt des `grep` in die PR-Beschreibung und in die Umsetzungsregel des Plans
(Abschnitt 7) uebernehmen.**

Die acht `fkLos`-Aufrufe (an sieben Stellen; `:7197` hat zwei) liegen alle in `resolveLauf()`,
`resolvePass()` und `vollziehFootballErgebnis()` — drei Funktionen, die ausschliesslich ueber
`loeseFootballZug()`/`stepSnapPhase()` erreichbar sind. Kein Nicht-Football-Zweig ist beruehrt.
`FK_LOS_KAPPA`/`fkLos` sind `const` auf derselben Modul-Ebene wie die Funktionsdeklarationen, die
sie benutzen; da kein Football-Code beim Modul-Laden laeuft, gibt es keine TDZ-Falle. `node
--check` und 24 x 5 Messlaeufe bestaetigen das praktisch.

### 2.2 Kontrollgruppen — bit-identisch, und Tennis ist der harte Beleg

Derselbe Aufruf auf beiden Baeumen:

```
                         PR-Kopf 5117775366        Basis 46b90c8e
tennis      buehne        0.825  0.210  0.839  0.280   |   0.825  0.210  0.839  0.280
basketball  feldspiel     0.769  0.105  0.923  0.224   |   0.769  0.105  0.923  0.224
hockey      feldspiel     0.669  0.181  0.832  0.259   |   0.669  0.181  0.832  0.259
  nur Feldspieler         0.719  0.182  0.818  0.259   |   0.719  0.182  0.818  0.259
```

Vier Zahlen je Disziplin, alle vier identisch, in allen drei Kontrollgruppen. **Tennis ist der
entscheidende Fall**: es laeuft ueber das Buehnen-Chassis, zieht aber seine Rollen ueber
`gewichtetesLos()`. Waere die geteilte Funktion auch nur um ein Zeichen anders, muesste Tennis
sich bewegen. Es bewegt sich nicht — weder in der Einzelspiel- noch in der Saisonzahl, weder im
Median noch in der Spannweite.

### 2.3 Die Schranke ueber alle zwanzig — und die zwei Ausreisser

Eigener Lauf von `scripts/pruefe-rangtreue-schranke.mjs` auf dem PR-Kopf, vollstaendig:

```
tdm 0.253 ±0.000 | mini-dm 0.094 ±0.000 | battlefield 0.387 ±0.000 | spurt 0.871 ±0.000
time-trial 0.828 ±0.000 | climbing 0.790 ±0.000 | staffel 0.915 ±0.000 | takeshis-castle 0.861 ±0.000
gewichtheben 0.854 +0.007 | showcase 0.892 ±0.000 | eiskunstlauf 0.885 +0.010 | breaking 0.869 ±0.000
wettessen 0.845 ±0.000 | speed-schach 0.908 ±0.000 | i-spy 0.684 ±0.000 | tennis 0.825 ±0.000
fechten 0.816 ±0.000 | basketball 0.769 ±0.000 | football 0.516 -> 0.800 (+0.284) | hockey 0.669 ±0.000
Bestanden: keine Disziplin ist um mehr als ihre Schranke gefallen.
```

Ziffer fuer Ziffer die Tabelle der PR. **Die Behauptung, die zwei Ausreisser stammten nicht von
dieser PR, habe ich nicht geglaubt, sondern gemessen:** derselbe Kader-Familien-Lauf im
Basis-Worktree `46b90c8e` — also **ohne** #884, aber **mit** den bereits gemergten #874/#876 —
liefert

```
eiskunstlauf  0.885    gewichtheben  0.854    football  0.516
```

also exakt die „Jetzt"-Werte der beiden Ausreisser. Die Basislinie in
`data/generated/rangtreue-basislinie.json` datiert vom 06.09., Eiskunstlauf (#874) und
Gewichtheben (#876) sind am 10.09. gemergt worden. Die +0,010 und +0,007 sind veraltete
Basislinie, nicht Nebenwirkung. **Belegt, nicht plausibilisiert.**

### 2.4 Kadergroessen 2 / 4 / 6 — das groesste offene Risiko des Plans ist entschaerft

Der Plan (Abschnitt 9, Punkt 2) nannte das als „das groesste offene Risiko": kappa=3 koennte bei
zwei Spielern je Seite alles an einen Einzelnen geben. Ich habe es selbst gefahren, n=48, beide
Baeume:

| je Seite | Teiln. | Basis rho / Spannw. | PR rho / Spannw. | Delta rho |
|---|---:|---:|---:|---:|
| 6 (Standard) | 12 | 0,516 / 0,172 | **0,800** / 0,054 | +0,284 |
| 4 | 8 | 0,679 / 0,399 | **0,795** / 0,130 | +0,116 |
| 2 | 4 | 0,763 / 0,742 | **0,767** / 0,458 | +0,004 |

Das Risiko tritt nicht ein. Keine Kadergroesse verschlechtert sich, und bemerkenswerter als die
Mediane ist die **Spannweite**: bei 4 je Seite faellt sie auf ein Drittel, bei 2 je Seite
halbiert sie sich. Bei 2 je Seite ordnet die Messung nur vier Spieler; eine Spannweite von 0,458
heisst, dass dort Kaderrauschen dominiert und weder das Plus noch ein Minus interpretierbar
waere — aber genau deshalb ist wichtig, dass kappa=3 die Streuung dort *senkt* statt sie zu
erhoehen. Die Sorge, die Lotterie koenne bei kleinem Kader degenerieren, ist gegenstandslos.

### 2.5 Das Tackle-Gewicht 0,15 — Plateau selbst nachgemessen, kein Uebergefitting

Das ist die heikelste Stelle der PR, und sie benennt es selbst: `feldspielWert()` bekommt einen
Term, und `feldspielWert()` **ist** die Zahl, gegen die die Rangtreue misst. Ich habe deshalb
nicht zwei, sondern **vier** Punkte selbst gepatcht und gemessen (jeweils n=24, kaderfest, danach
Baum zurueckgesetzt und `git status` geprueft):

| Tackle-Gewicht | rho je Spiel | Spannweite | rho Saison | Spannweite | PR/Plan behauptet |
|---|---:|---:|---:|---:|---|
| 0,00 (keine Zeile) | 0,775 | 0,091 | 0,902 | 0,112 | 0,775 / 0,091 / 0,902 / 0,112 ✓ |
| 0,12 | 0,794 | 0,055 | 0,881 | 0,105 | 0,794 / 0,055 / 0,881 / 0,105 ✓ |
| **0,15 (PR)** | **0,800** | **0,054** | 0,867 | 0,077 | 0,800 / 0,054 / 0,867 / 0,077 ✓ |
| 0,20 | 0,792 | 0,062 | 0,860 | 0,077 | 0,792 / 0,062 / 0,860 / 0,077 ✓ |
| 0,35 | 0,772 | 0,084 | 0,839 | 0,147 | 0,772 / 0,084 / 0,839 / 0,147 ✓ |

**Alle sechzehn Ziffern der Plan-Tabelle reproduzieren exakt.** Ueber einen Faktor drei im
Gewicht (0,12 bis 0,35) bewegt sich rho um 0,022 — das ist ein Plateau, kein Nadeloehr. Die
Zeile ist nicht auf den Massstab hin gefittet.

**Eine Praezisierung**, die die PR nicht macht und die ehrlich dazugehoert: der Abstand zwischen
0,12, 0,15 und 0,20 (0,794 / 0,800 / 0,792) liegt **unter der Kader-Spannweite** dieser
Messungen (0,054–0,062). Nach der Regel aus `docs/design/messgrundlage-kaderfest.md` ist die Wahl
von 0,15 gegenueber 0,12 oder 0,20 damit von Null nicht unterscheidbar. Das ist kein Vorwurf —
im Gegenteil, es ist genau die Aussage „flaches Plateau" — aber der richtige Satz lautet „jedes
Gewicht zwischen 0,12 und 0,20 ist gleichwertig", nicht „0,15 ist das Optimum". Der Schritt von
0,00 auf 0,15 (+0,025 bei halbierter Spannweite) ist dagegen ein echter Effekt.

### 2.6 Der QB-Kanal und der gemessene Irrweg

Die rho-0,135-Behauptung fuer `{determination:71,dexterity:29}` ist eine **Offline-Korrelation
innerhalb der zwoelf Antretenden** (Attributmischung gegen `spielEignung`), keine Ausgabe eines
Skripts im Repo — `sondiere-feldspiel-subskills.mjs` misst etwas anderes (mechanisches Gewicht,
nicht Korrelation zur Eignung), und die Wegwerf-Sonde des Plans ist geloescht. Ich konnte sie
deshalb nicht 1:1 nachfahren.

Was ich statt dessen **indirekt und aussagekraeftiger** gemessen habe, ist die Wirkung: siehe
F7 unten. Und die Plausibilitaet ist arithmetisch pruefbar und stimmt: `spielEignung.football`
wiegt `power 22, health 18, speed 14, torment 12, determination 10, awareness 8, stamina 6,
dexterity 4, spirit 3, will 3`. `determination` und `dexterity` tragen zusammen **14 von 100**
Gewichtspunkten — eine Mischung aus nur diesen beiden kann mit der Eignung strukturell kaum
korrelieren. Die neue Mischung `{power:40,determination:35,dexterity:25}` holt das
schwerstgewichtete Attribut (`power`, 22) mit 40 % Anteil herein. Die Richtung ist zwingend, die
Groessenordnung glaubhaft.

**Der Irrweg (Variante B) ist im Code dokumentiert** — ich habe es nachgesehen, er steht als
ausformulierter Kommentarblock ueber `rezept:` (Diff-Hunk 1, „GEMESSENER IRRWEG, DAMIT IHN
NIEMAND NOCHMAL GEHT"), mit Zahl (0,629 / 0,692), Begruendung (power-dominante Eignung, `speed`
traegt nur 0,144) und der verallgemeinerten Lehre („derselbe Anker, anderes Profil"). Das ist
genau die Art Kommentar, die dieses Repo an seinen besten Stellen schreibt: er verhindert eine
Wiederholung, nicht nur eine Frage. Nachmessen konnte ich 0,629 nicht — Variante B ist nirgends
niedergeschrieben, nur ihre zwei prominentesten Zeilen. Angesichts von F7 (unten) ist die Zahl
aber sehr plausibel: ein Rezept ohne power/health/torment-Anteil muss in einer power-dominanten
Eignung schlechter abschneiden als die Lotterie allein.

### 2.7 Sub-Skill-Sondierung — die erwartete Abweichung ist wirklich die erwartete

Eigener Lauf, PR-Kopf, 24 Laeufe, orthogonales Rezept:

```
TEAMGEIST 44.1 % | LAUFKRAFT 28.6 % | ABWEHR_LAUF 9.7 % | PASSGENAUIGKEIT 9.0 %
ABWEHR_PASS 8.2 % | PASSSCHUTZ 0.3 % | BALLSICHERHEIT 0 % | AUSDAUER 0 % | LAUFTEMPO 0 %
```

Das deckt sich mit der PR: PASSSCHUTZ (0,3 %), AUSDAUER (0 %) und LAUFTEMPO (0 %) lesen
weiterhin nahe null, wie Plan-Schritt 6 es als Soll formuliert; ABWEHR_LAUF (9,7 %) und
ABWEHR_PASS (8,2 %) haben durch die Tackle-Zeile einen echten Kanal bekommen — das ist die
beabsichtigte Wirkung, nicht eine unbeabsichtigte Verschiebung. Zwei Beobachtungen dazu unter
F8 und F9.

### 2.8 Pflichtlaeufe und CI

`node --check` OK. `npx tsc --noEmit` **560 Fehler**, alle in `tests/*.ts`, alle vorbestehend —
die Zahl ist seit Wochen dieselbe (die Reviews zu #880 nennen dieselben 560). Die
Slot-Invariante haelt mit maximal **0,005 Pp** ueber alle 20 Disziplinen x 6 Groessen. Die vier
Battle-Mode-Suiten laufen **92/92 gruen** (die PR nennt 90 — meine Auswahl der vier Suiten war
offenbar eine leicht andere; nichts faellt aus). GitHub-CI auf `5117775366`: **alle vier Checks
`success`**, `full-test-suite` und `test-and-smoke` inklusive.

---

## 3. Der Korridor-Shift — reproduziert, und dann anders eingeordnet als die PR

### 3.1 Meine eigene Messung

`node scripts/miss-football-korridor.mjs 120`, beide Baeume, synchron:

| Kennzahl | Ziel (NFL 2024) | Basis `46b90c8e` | PR-Kopf | Richtung |
|---|---:|---:|---:|---|
| Punkte je Team | 22,9 | 15,9 | **21,0** | naeher |
| Touchdowns je Team | ~2,4 | 1,75 | **2,60** | naeher |
| Laufversuche je Team | 27,0 | 24,2 | 25,3 | naeher |
| Sack-Quote je Dropback | ~7,0 % | 4,8 % | **7,5 %** | naeher |
| Field-Goal-Quote | ~85 % | 85,3 % | 84,9 % | gleich gut |
| Fumbles verloren je Team | ~0,5 | 0,50 | 0,48 | gleich gut |
| Passversuche je Team | 29,9 | 25,9 | 25,4 | unveraendert zu wenig |
| **Completion-Quote** | **65,3 %** | 61,6 % | **76,5 %** | **weiter weg** |
| **Yards je Passversuch** | **7,1** | 6,51 | **8,70** | **weiter weg** |
| Yards je Laufversuch | ~4,3 | 3,83 | 3,52 | weiter weg |
| Interception-Quote | 2,1–2,4 % | 2,0 % | 2,9 % | weiter weg |
| Field Goals gemacht/versucht | 1,72/2,16 | 1,23/1,44 | 0,98/1,16 | weiter weg |
| **Punts je Team** | **~4** | 2,80 | **1,90** | **weiter weg** |

**Alle zwoelf Kennzahlen des PR-Kopfs reproduzieren ziffernidentisch zur PR-Beschreibung**, und
die Basisspalte der PR stimmt ebenfalls exakt mit meiner Messung ueberein. Die Offenlegung in der
PR ist zahlengenau korrekt.

Der Mechanismus ist verstanden und war im Plan vorhergesagt: alle Wahrscheinlichkeitskonstanten
(`kurve.base`, `kurve.skillMittel`, `pSack`, `pInt`, `meanYds`) wurden gegen einen
**durchschnittlichen** Akteur gefittet. Mit kappa=3 ist der typische Passer fast immer der beste
des Teams, der Logit-Bonus schlaegt voll durch, die Offense konvertiert zu leicht — daher zu
wenige Punts, zu wenige Ballwechsel. Dass die **Sack-Quote** dabei zufaellig ins Ziel rutscht
(4,8 → 7,5 % bei Ziel 7,0), ist derselbe Effekt in die andere Richtung und kein Verdienst des
Rezepts: der gezogene Pass-Rusher ist jetzt ebenfalls der beste, `pSack` steigt mit.

### 3.2 Warum ich den Shift trotzdem nicht als Merge-Hindernis werte

Drei Gruende, in dieser Reihenfolge.

**Erstens — und das ist der schwerste — erreicht er heute keine Spieltagsauswertung.** Siehe F1.
Football steht nicht in `ARENA_RESOLVED_DISCIPLINE_IDS`; die Spieltage laufen ueber den
Alt-Pfad. Was Chris auf dem Server an Football-Ergebnissen sieht, aendert dieser Diff nicht. Was
er aendert: das Mockup, `dev-arena` und die interaktive Battle-Arena — also genau die Orte, an
denen die Sicht-QA stattfindet, und dort ist ein sichtbarer Zwischenzustand kein Schaden, sondern
der Gegenstand der Abnahme.

**Zweitens ist die Bilanz gemischt, nicht schlecht.** Vier Kennzahlen ruecken naeher ans Ziel,
zwei bleiben gleich gut, sechs entfernen sich. Und die vier, die naeher ruecken, sind die
**Erzaehl**-Kennzahlen: Punkte je Team von 15,9 auf 21,0 bei Ziel 22,9, Touchdowns von 1,75 auf
2,60 bei Ziel 2,4. Ein Football-Spiel, das 21:24 endet statt 7:10, sieht fuer Chris mehr nach NFL
aus, nicht weniger — auch wenn die Effizienzquoten dahinter zu hoch stehen. Die sechs, die sich
entfernen, sind Quoten unter der Haube (Completion, Y/A, Y/Carry, INT, FG-Versuche) plus die
Punts.

**Drittens ist der Shift ein reiner Konstanten-Refit, kein Strukturproblem.** Plan 6.1 beschreibt
ihn Schritt fuer Schritt: `kurve.skillMittel` gegen den **tatsaechlich gezogenen** Passer neu
messen, dann `kurve.base` gegen 65,3 %, dann `FK_TIER_YARDS` gegen 7,1, dann `resolveLauf`s
Mittelwert 3,6 → ~4,4, dann `pInt` senken. Fuenf Zahlen, klare Reihenfolge, kein neuer Code. Die
Punts kommen als **Folge** zurueck, nicht als eigene Stellschraube.

**Der einzige Punkt, an dem ich strenger bin als die PR:** Punts 1,90 je Team bedeutet in einem
Spiel mit ~50 Snaps je Team, dass fast jede Serie in einem Score endet. Das ist die Kennzahl, die
das Spielgefuehl am staerksten traegt („das halbe Spiel ist Feldposition", Plan 6.3.3), und sie
steht bei knapp der Haelfte des Ziels. Wer Runde 2 verschiebt, verschiebt genau das. **Runde 2
sollte deshalb nicht ohne Termin bleiben.**

### 3.3 Der Plan hat hier eine falsche Ist-Spalte (F3)

Der Plan nennt als Ist-Stand: Punkte 17,3 / Completion 67,0 % / Y/A 6,95 / Sack 6,7 % / INT
2,9 % / Punts 3,0 / FG-Quote 82,4 %. **Keine dieser sieben Zahlen ist reproduzierbar.** Ich habe
den Korridor auf `c56fffd7` gemessen — dem Commit, gegen den der Plan ausdruecklich gemessen zu
haben angibt — und auf `46b90c8e`. Beide liefern **identisch** 15,9 / 61,6 % / 6,51 / 4,8 % /
2,0 % / 2,80 / 85,3 %. Nebenbei belegt das, dass #872/#874/#875/#876/#880 den Football-Korridor
tatsaechlich nicht bewegt haben.

Die PR-Beschreibung benutzt die **richtigen** Zahlen — sie hat die Plan-Spalte stillschweigend
korrigiert. Das ist gut, aber es hat zwei Konsequenzen, die niemand ausspricht:

- Der wahre Completion-Sprung ist **+14,9 pp** (61,6 → 76,5), nicht +9,5 pp wie gegen die
  Plan-Spalte. Der Shift ist also **groesser** als der Plan ihn ankuendigte.
- Die Interception-Quote steht im Plan als „unveraendert 2,9 → 2,9". In Wahrheit steigt sie von
  **2,0 auf 2,9 %** — eine echte Verschlechterung, die durch die veraltete Spalte unsichtbar war.
- Umgekehrt sind Punkte (+5,1 statt +3,7) und Sack-Quote (+2,7 pp statt +0,8) **besser** als der
  Plan behauptete.

`docs/pm-briefings/opus-plan-football-gameplay-09-10.md` liegt auf `main` und wird die
Referenz fuer Runde 2 sein. Seine Abschnitt-6.1-Tabelle gehoert mit einer Fussnote versehen,
sonst fittet Runde 2 gegen einen Startpunkt, den es nie gab.

---

## 4. Funde

### F1 — Football steht NICHT in `ARENA_RESOLVED_DISCIPLINE_IDS` (Aktenlage, aber die wichtigste)

Die PR begruendet ihre eigene Review-Bitte im Abschnitt „PRODUKTIONSCODE — warum eine
unabhaengige Review" woertlich mit: *„Football steht in `ARENA_RESOLVED_DISCIPLINE_IDS`, ist also
**live**: dieser Diff veraendert unmittelbar, wie echte Spieltage auf dem Hetzner-Server
aufgeloest werden"*.

Nachgesehen in `lib/resolve/battle-mode-arena-team-points.ts:236-253`, auf `main` **und** auf dem
PR-Kopf identisch:

```
basketball, gewichtheben, hockey, speed-schach, showcase,
eiskunstlauf, breaking, wettessen, tennis, fechten,
staffel, takeshis-castle, time-trial
```

Dreizehn Eintraege. **Football ist nicht darunter** — und kommt in der ganzen Datei nicht vor
(kein `football`-Treffer, auch keine PPS-Referenz). `legacy-matchday-resolve-engine.ts:720`
schaltet nur bei `ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)` auf die Arena um; Football
laeuft also weiter ueber den Alt-Pfad. Produktiv ist bei Football nur die **Buehne**
(`app/foundation/discipline-stage/arena/disciplines/football.tsx`, registriert in `registry.ts:79`)
— die Optik, nicht die Auswertung.

**Wirkung dieses Fundes: er senkt das Risiko, statt es zu erhoehen.** Der Korridor-Shift und die
8,9 % leeren Boxscore-Zeilen erreichen heute keine ausgezahlten Spielerpunkte. Aber:

1. Die Begruendung der PR ist damit sachlich falsch und sollte im Merge-Commit oder einem
   Folge-Vermerk richtiggestellt werden — sie wird sonst zitiert.
2. **Umgekehrt entsteht eine neue Gefahr:** wer diese PR-Beschreibung liest, haelt Football fuer
   produktiv und koennte den fehlenden Eintrag fuer ein Versehen halten und ihn nachtragen. Genau
   dann trifft der verschobene Korridor sofort echte Spieltage. **Es gehoert schriftlich
   festgehalten, dass Football bis zum Korridor-Refit (Runde 2) NICHT in
   `ARENA_RESOLVED_DISCIPLINE_IDS` gehoert.** Das ist die eine Auflage dieser Review.

### F2 — Der Anteil Spieler mit Impact exakt 0 ist 8,9 %, nicht 5,9 %

Die PR schreibt: *„5,9 % der Spieler beenden ein Spiel mit Impact exakt 0 (vorher 0,3 %; der Plan
schaetzte 8,9 % fuer kappa=3 ohne Tackle-Zeile — die Tackle-Zeile senkt es also messbar)."*

Eigene Sonde ueber `window.__arena.disziplinProbe("football", {n, kaderFamilie})`, dieselbe
Kader-Familie und derselbe Pfad, den `miss-alle-disziplinen.mjs` benutzt, Anteil der
Teilnehmer-Spiele mit `wert === 0`:

| Stand | n=24 (1440 Teilnehmer-Spiele) | n=48 (2880) |
|---|---:|---:|
| Basis `46b90c8e` | — | **0,2 %** |
| PR-Kopf, Tackle-Gewicht 0,15 | **8,9 %** | **8,5 %** |
| PR-Kopf, Tackle-Term auf 0 gesetzt | **9,9 %** | — |

Die Richtung der Offenlegung stimmt, die Zahl nicht. Die Tackle-Zeile senkt den Anteil um
**1,0 pp** (9,9 → 8,9), nicht um drei; und der Endstand liegt bei den **8,9 %**, die der Plan als
Wert *ohne* Tackle-Zeile schaetzte. Praktisch: **rund jeder elfte Spieler beendet ein
Football-Spiel mit einer voellig leeren Box-Score-Zeile** (vorher etwa jeder fuenfhundertste).

Das ist NFL-fachlich vertretbar — ein Left Guard hat auch keine Zeile, und der Motor kennt keine
Blocking- oder Coverage-Statistik. Aber es ist ein sichtbarer Bruch mit dem bisherigen Bild, in
dem praktisch jeder eine Zahl hatte, und die PR selbst sagt richtig: *„Chris muss es einmal sehen
und abnicken."* **Dann bitte mit 8,9 %.** Bei sechs Feldspielern je Seite heisst das: in gut der
Haelfte aller Spiele steht mindestens einer der zwoelf komplett leer da.

Empfehlung fuer Runde 2, falls Chris das nicht mag: der billigste Hebel ist nicht kappa, sondern
ein zweiter Verteidiger-Kanal (Coverage-Tackle getrennt vom Pass-Rush, s. F6) — er verteilt die
defensive Kreditvergabe auf zwei Ziehungen statt einer.

### F3 — Die Ist-Spalte des Plans ist veraltet; die PR hat sie stillschweigend korrigiert

Ausfuehrlich in 3.3. Kurz: die sieben Ist-Werte in Plan 6.1 sind auf keinem Commit reproduzierbar,
den der Plan nennt. Die PR benutzt die richtigen. Der Plan gehoert korrigiert, weil er die
Referenz fuer Runde 2 ist — und weil zwei der Abweichungen die Bewertung veraendern (Completion
+14,9 statt +9,5 pp; INT 2,0 → 2,9 statt „unveraendert").

### F4 — Der abgedruckte `grep`-Beweis ist nicht reproduzierbar (die Aussage dahinter aber wahr)

Ausfuehrlich in 2.1. Der zitierte Aufruf liefert acht Zeilen statt null. Die Zusage
(„`gewichtetesLos()` unangetastet") ist trotzdem korrekt und von mir per Byte-Vergleich der
Definitionsbloecke belegt. Bitte den Byte-Vergleich statt des `grep` in PR-Beschreibung und
Plan-Abschnitt 7 fuehren — der `grep` ist als Umsetzungsregel untauglich, weil jeder erklaerende
Kommentar ihn ausloest.

### F5 — Phantom-Tackle beim Touchdown (Runde-2-Ticket, keine rho-Wirkung)

In `vollziehFootballErgebnis()`, Zweig `"komplett"`:

```js
erg.spieler.passYards+=erg.yards; erg.spieler.assists++; erg.receiver.fangYards+=erg.yards;
if(erg.verteidiger)erg.verteidiger.checks++;      // <-- hier
...
footballDownWeiter(fb,erg.yards,erg.receiver);    // <-- Touchdown wird ERST hier entschieden
```

Der Tackle wird gebucht, **bevor** feststeht, ob der Zug in der Endzone endete. Ein 40-Yard-Pass
zum Touchdown schreibt dem Verteidiger einen Solo-Tackle gut, den er nicht gemacht hat; im Zweig
`"lauf"` gilt dasselbe. Bei ~2,6 Touchdowns je Team und Spiel sind das grob **5 % aller
Tkl-Eintraege** — im echten NFL-Boxscore gibt es auf einem Touchdown-Zug keinen Tackle. Auf rho
wirkt das nicht messbar (die Zeile wiegt 0,15, und der Verteidiger ist ohnehin der ABWEHR-starke),
aber es ist eine sichtbare Unrichtigkeit in genau der Spalte, die diese PR neu einfuehrt.
Behebung: ein `if` um die Buchung, nachdem `footballDownWeiter()` den Touchdown gemeldet hat.

### F6 — `Tkl` und `Sack` kommen aus derselben Ziehung (Runde-2-Ticket)

Auf Passzuegen ist `erg.verteidiger` der **Pass-Rusher** (`fkLos(def,"ABWEHR_PASS")`), nicht ein
Coverage-Spieler. Der neue Solo-Tackle landet damit bei demselben Spieler, den auch die
Sack-Zeile trifft, aus **derselben** kappa=3-Ziehung. Football-fachlich stellt einen gefangenen
Pass die Coverage, nicht der Rusher. Der Verteidiger-Box-Score hat dadurch weiterhin nur **eine**
Kreditvergabe-Achse, nicht zwei — was auch F2 verstaerkt (die Konzentration bleibt hoch). Der
Kommentar an der Ziehungsstelle nennt den gezogenen Spieler selbst „der Coverage-Spieler", waehrend
die Variable `rusher` heisst und aus `ABWEHR_PASS` gezogen wird; diese Unschaerfe ist
vorbestehend (seit der Bewegungs-Runde 06.09.), wird durch die Tackle-Zeile aber erstmals
wertungsrelevant. Passt gut zum ohnehin geplanten Runde-2-Schritt „PASSSCHUTZ an die
Passer-Auswahl".

### F7 — Der Zuwachs stammt fast vollstaendig aus der Lotterie, nicht aus dem Rezept (neu gemessen)

Weder Plan noch PR zerlegen den Gewinn vollstaendig. Ich habe die fehlende Variante nachgeholt —
Rezept C **allein**, mit der alten flachen `gewichtetesLos()` und ohne Tackle-Zeile:

| Fassung | rho je Spiel | Spannweite | Zuwachs |
|---|---:|---:|---:|
| Basis `46b90c8e` | 0,516 | 0,172 | — |
| **nur Rezept C** (alte Lotterie, keine Tackle-Zeile) | **0,597** | **0,258** | +0,081 |
| nur kappa=3 (altes Rezept, keine Tackle-Zeile) | 0,714 | 0,169 | +0,198 |
| kappa=3 + Rezept C | 0,775 | 0,091 | +0,259 |
| **PR-Kopf** (+ Tackle-Zeile 0,15) | **0,800** | **0,054** | **+0,284** |

Das ist die interessanteste Einzelzahl dieser Review. **Rezept C allein bewegt +0,081 bei einer
Kader-Spannweite von 0,258** — nach der Regel des Projekts (`messgrundlage-kaderfest.md`: eine
Aenderung, die kleiner bewegt als die Spannweite, ist von Null nicht unterscheidbar) ist das
**nicht nachweisbar wirksam**. Genau daran ist Runde 2 der Football-Kalibrierung ausdruecklich
gescheitert, und dasselbe gaelte hier fuer das Rezept fuer sich genommen.

Die Diagnose des Plans wird dadurch **bestaetigt, nicht widerlegt**: die flache Lotterie war der
strukturelle Deckel, und erst nachdem sie faellt, zahlt das Rezept ueberhaupt (+0,061 auf 0,775,
bei zugleich halbierter Spannweite). Aber die Konsequenzen sind real:

- Die vier Aenderungen der PR sind **nicht gleichwertig**. `fkLos`/kappa=3 traegt rund 70 % des
  Gesamtgewinns, das Rezept den Rest, die Tackle-Zeile 0,025 (aber die staerkste Wirkung auf die
  Spannweite).
- Fuer Runde 2 heisst das: wer weitere rho-Punkte sucht, sucht sie an **Kanaelen und Ziehungen**
  (PASSSCHUTZ, Coverage-Tackle, Punter), nicht an weiteren Rezeptzeilen.
- Die Entduplizierung selbst bleibt trotzdem richtig — zwei zeichenidentische Sub-Skills sind ein
  Fehler unabhaengig davon, ob ihre Behebung eine Messzahl bewegt.

### F8 — `BALLSICHERHEIT` liest 0 % mechanisches Gewicht

Die Sondierung (2.7) gibt `BALLSICHERHEIT 0 %`. Der Sub-Skill wirkt nur in `pFumble` und in der
Fumble-Recovery-Ziehung — zusammen unter einem Ereignis je Team und Spiel. Die Aufloesung der
Dopplung `BALLSICHERHEIT` = `PASSGENAUIGKEIT` ist damit sachlich richtig, aber mechanisch inert;
sie gehoert nicht zu den Hebeln dieser PR gezaehlt. Kein Fehler, nur eine Praezisierung der
Erfolgsgeschichte.

### F9 — `TEAMGEIST` traegt jetzt 44 % des gesamten mechanischen Gewichts (Beobachtungsposten)

Vor der PR trug die groesste Box-Score-Position (Fangyards) 32,9 % des Impacts; jetzt liest
`TEAMGEIST` als Sub-Skill **44,1 %**. Das ist der beabsichtigte Effekt — die
Receiver-Kreditvergabe ist die groesste Achse, und sie korreliert mit 0,905 zur Eignung, weshalb
rho steigt. Aber es heisst auch: **fast die Haelfte der Football-Rangtreue haengt an einer
einzigen Rezeptzeile.** Eine kuenftige Fehlspezifikation dort kostet mehr als an jeder anderen
Stelle, und die zweite und dritte Achse (LAUFKRAFT 28,6 %, Verteidigung zusammen 17,9 %) sind
deutlich leichter. Kein Handlungsbedarf jetzt; aber wenn Runde 2 den Korridor refittet, gehoert
diese Verteilung mitgemessen.

### F10 — Vitest-Zahl (Kleinigkeit)

Die PR nennt „90 Tests" fuer vier Battle-Mode-/Arena-Suiten. Meine Auswahl von vier Suiten
(`battle-mode-arena-resolve-engine`, `battle-mode-arena-matchday-resolve-e2e`,
`battle-mode-arena-team-points`, `battle-arena-ein-modell-ueberall`) ergibt **92/92 gruen**.
Offensichtlich eine leicht andere Auswahl; nichts faellt aus, kein Befund.

---

## 5. Abwaegung: +0,284 rho gegen den Korridor-Shift

Die Frage, die die PR selbst stellt („eine Abwaegung, die jemand ausser mir mittragen sollte"),
verdient eine ausdrueckliche Antwort.

**Fuer den Merge:**

- **+0,284 ist die groesste Einzelverbesserung dieser Session** und die erste in Footballs
  Geschichte, die um ein Vielfaches ueber dem Kaderrauschen liegt (0,284 gegen eine Spannweite
  von 0,054–0,172). Drei bisherige Runden zusammen brachten +0,17, jede einzelne unterhalb ihrer
  eigenen Spannweite.
- **Der Beleg ist ungewoehnlich dicht:** n=24 und n=48 ziffernidentisch, drei Kadergroessen in
  dieselbe Richtung, ein flaches Plateau ueber Faktor drei im Tackle-Gewicht, und meine
  unabhaengige Zerlegung reproduziert jede einzelne Zwischenstufe des Plans auf die Ziffer.
- **Die Kontrollgruppen halten strukturell und gemessen.** Achtzehn von zwanzig ±0,000; Tennis
  als der Fall, der brechen muesste, wenn die geteilte Lotterie beruehrt waere, bricht nicht.
- **Football steht heute bei 0,516 — die schlechteste Feldspiel-Zahl des Projekts.** Ein
  Zwischenzustand mit 0,800 und schiefen Effizienzquoten ist dem Ist-Zustand vorzuziehen, in dem
  die Rangfolge im Einzelspiel schlicht nicht funktioniert.
- **F1: der Shift trifft keine ausgezahlten Spielerpunkte.** Das ist der Grund, warum diese
  Abwaegung ueberhaupt leicht ausfaellt.

**Gegen den Merge — und warum es nicht reicht:**

- Der Korridor ist an drei Stellen sichtbar schief: Completion 76,5 % (Ziel 65,3), Y/A 8,70 (Ziel
  7,1), Punts 1,90 (Ziel ~4). Chris' Auftrag lautete ausdruecklich „ergibt Sinn und laeuft
  smooth", und er hat das **vor** die Rangtreue gestellt. Ein Spiel, in dem drei Viertel aller
  Paesse ankommen und kaum gepuntet wird, ist nicht NFL.
- Dagegen steht: der Shift ist ein **Konstanten**-Problem mit einer ausformulierten
  Fuenf-Schritt-Anleitung (Plan 6.1), er trifft keine Auswertung (F1), und **vier andere
  Kennzahlen ruecken naeher ans Ziel** — darunter die zwei, die man beim Zuschauen zuerst sieht
  (Punkte, Touchdowns).
- Die 8,9 % leeren Box-Score-Zeilen (F2) sind die einzige Aenderung, die Chris **ohne Messung
  sofort auffaellt**. Sie ist NFL-fachlich vertretbar, aber sie gehoert ihm vorgelegt, bevor
  Football produktiv geschaltet wird — nicht bevor dieser PR gemergt wird.

**Mein Urteil:** der Zwischenzustand ist akzeptabel, weil er genau der Zustand ist, den der Plan
fuer Runde 1 angekuendigt hat, weil er ehrlich und (bis auf F2/F3) zahlengenau offengelegt ist,
und weil F1 ihm die Zaehne zieht. Er waere **nicht** akzeptabel, wenn Football in
`ARENA_RESOLVED_DISCIPLINE_IDS` staende — dann waere meine Empfehlung, den Korridor-Refit in
dieselbe PR zu ziehen. Das ist keine hypothetische Unterscheidung, sondern die Auflage: **der
Refit muss vor der Produktivierung kommen, nicht danach.**

---

## 6. Verdikt

# FREIGEBEN MIT NACHTRAG

**Der Code ist sauber, additiv im richtigen Sinn und exakt so eng gefasst, wie die PR behauptet.**
Eine Datei, elf Hunks, jede Aenderung innerhalb des Football-Blocks. Die geteilte Lotterie ist
Zeichen fuer Zeichen unveraendert — von mir per Byte-Vergleich belegt, nicht per `grep`
geglaubt. Die drei LIVE-Nachbarn Basketball, Hockey und Tennis liefern vier von vier Kennzahlen
identisch. Die Abnahmezahl steigt von 0,516 auf 0,800 und ist an fuenf unabhaengigen Achsen
belegt (n=24, n=48, drei Kadergroessen, ein Gewichts-Plateau, eine vollstaendige Zerlegung). CI
4/4 gruen. `tsc` unveraendert bei 560 vorbestehenden Fehlern, Slot-Invariante haelt, 92/92 Tests
gruen.

**Vier Nachtraege, alle reine Aktenlage, keiner blockiert:**

1. **Auflage:** schriftlich festhalten, dass **Football bis zum Korridor-Refit (Runde 2) NICHT
   in `ARENA_RESOLVED_DISCIPLINE_IDS` aufgenommen wird** — und die falsche „Football ist live"-
   Begruendung der PR richtigstellen (F1). Ohne diesen Vermerk ist der Eintrag eine Zeile, die
   jemand in gutem Glauben ergaenzt, und dann trifft der Shift sofort echte Spieltage.
2. **Impact-0 auf 8,9 % korrigieren** (F2), bevor die Zahl Chris vorgelegt wird. Die Tackle-Zeile
   senkt um 1,0 pp, nicht um 3.
3. **Ist-Spalte des Plandokuments korrigieren** (F3) — sie ist auf keinem genannten Commit
   reproduzierbar und wird Runde 2 in die Irre fuehren.
4. **Den strukturellen Beweis als Byte-Vergleich fuehren, nicht als `grep`** (F4), in PR und in
   Plan-Abschnitt 7.

**Zwei Runde-2-Tickets:** Phantom-Tackle auf Touchdown-Zuegen (F5) und Tkl/Sack aus derselben
Ziehung (F6). Beide sind Box-Score-Fachlichkeit ohne rho-Wirkung; F6 passt zum ohnehin geplanten
„PASSSCHUTZ an die Passer-Auswahl".

**Ein Beobachtungsposten:** `TEAMGEIST` traegt jetzt 44 % des mechanischen Gewichts (F9) — beim
Korridor-Refit mitmessen.

**Fuer Runde 2 ausserdem festhalten** (F7): der Gewinn stammt zu rund 70 % aus der Lotterie.
Rezept C allein bewegt +0,081 bei einer Spannweite von 0,258, also nachweisbar nichts. Weitere
rho-Punkte liegen an Kanaelen und Ziehungen, nicht an weiteren Rezeptzeilen.

---

_Generated by [Claude Code](https://claude.ai/code)_

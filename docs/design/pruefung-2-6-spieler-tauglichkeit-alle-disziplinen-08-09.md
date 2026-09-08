# Prüfung 08.09. — sind alle zwanzig Disziplinen auf Feldgröße 2–6 ausgelegt?

Reine Analyse, ausgelöst durch den Eiskunstlauf-Fund der heutigen Opus-Synthese
(`docs/pm-briefings/opus-synthese-eiskunstlauf-breaking-08-09.md`): `BUEHNE_ART.eiskunstlauf` nahm
eine feste `jeSeite:6` an, obwohl die echte, saisonal gewürfelte Feldgröße gleichverteilt aus
`{2,3,4,5,6}` kommt (`buildSeasonPlayerCountByDiscipline()`, `lib/season/season-discipline-schedule.ts:107-131`
— jede der vier Fünfer-Kategorien power/speed/mental/social bekommt eine Permutation von
`[2,3,4,5,6]`, nachgezählt für alle zwanzig: `lib/data/dataAdapter.ts:55-74`). Chris' Auftrag: prüfen,
ob das ein Eiskunstlauf-Einzelfall ist oder ein Muster über alle zwanzig Disziplinen.

**Stand:** `origin/main` = `64fec494` (Eiskunstlauf-Duett #856/#857/#859 bereits gemergt — der Fix,
den die Opus-Synthese noch als offen beschrieb, ist zum Zeitpunkt dieser Prüfung bereits umgesetzt).
Eigener Worktree (`/tmp/wt-pruefung-2-6-spieler`), nicht der geteilte Arbeitsbaum der beiden
parallel laufenden Umsetzungs-Agenten. Reine Analyse, kein Produktionscode geändert.

**Keine Zeile hier ist vermutet** — jede Aussage stammt aus tatsächlich gelesenem Code
(`public/mockups/battle-mode.engine.js`, `lib/resolve/battle-mode-arena-team-points.ts`,
`lib/battle/arena-headless-runner.ts`, `lib/foundation/battle-arena/arena-aufstellung-adapter.ts`).
Alle rho-Zahlen sind aus `docs/design/stand-aller-disziplinen.md` übernommen, hier nicht neu
gemessen (dieselbe Chromium-Einschränkung wie in der Opus-Synthese: die Mockup-Seite stürzt in
dieser Umgebung beim Laden ab).

---

## 0. Das Ergebnis in einem Satz

**Eiskunstlauf war kein Einzelfall — es war das einzige Symptom, das schon jemand gefunden hatte.**
Alle vier Baufunktionen (`bauFeldspiel`, `bauBuehne`, `bauSpurt`, `build()`/`baueEinheit`) lesen für
JEDE der zwanzig Disziplinen eine feste `jeSeite`-Konstante aus einer statischen `*_ART`-Tabelle,
nicht die echte, pro Saison gewürfelte Feldgröße — und zwar strukturell identisch für alle vier
Chassis. Der einzige Ort im gesamten Motor, der `art.jeSeite` je überschreibt, ist die
Mess-Sonde selbst (`disziplinProbe`, `o.jeSeite`, `battle-mode.engine.js:22513-22516`/`:22572` —
das ist exakt der `--je-seite=`-Mechanismus aus der Opus-Synthese). **Kein einziger echter
Spielpfad** (weder `lib/battle/arena-headless-runner.ts` noch `lib/foundation/battle-arena/
arena-aufstellung-adapter.ts`) reicht die real gewürfelte Feldgröße in den Motor durch.

Aber: der Befund zerfällt in zwei sehr unterschiedlich schwere Fälle, und Eiskunstlauf lag im
harmloseren:

1. **Neun von zwanzig Disziplinen (Feldspiel + Bühne) sind bereits so gebaut, dass eine ECHT
   gesetzte Aufstellung die feste Konstante überstimmt** — auf BEIDEN Seiten. Die feste `jeSeite`
   wirkt dort nur noch als Größe des Auto-Auffüll-Pools, wenn *gar keine* Aufstellung existiert.
2. **Acht von zwanzig (Bahn + Arena/Kampf) haben genau diese Korrektur nur für die eigene Seite,
   nicht für den Gegner** — die Gegnerseite ist dort *strukturell* auf die feste Konstante
   festgenagelt, ganz unabhängig davon, ob und wie der Gegner aufgestellt hat. Das ist ein
   schärferer Fund als Eiskunstlauf, weil er nicht mal durch eine passende Aufstellung umgangen
   werden kann.

Fünf Disziplinen (Basketball, Gewichtheben, Hockey, Speed-Schach, Showcase) sind bereits
„arena-aufgelöst" (`ARENA_RESOLVED_DISCIPLINE_IDS`, `lib/resolve/battle-mode-arena-team-points.ts
:159-165`) — für die läuft die Feldgrößen-Korrektheit *zusätzlich* über eine eigene,
produktionsseitige PPS-Referenztabelle je Feldgröße, die den Rest des Problems auf der
Punkte-Seite auffängt, selbst wenn die Simulation selbst noch mit der festen Konstante rechnet.

---

## 1. Wie das Muster aussieht — mit Fundstellen

### 1.1 Alle vier Baufunktionen lesen dieselbe feste Konstante

| Chassis | Baufunktion | `n`-Zuweisung | Quelle der Konstante |
|---|---|---|---|
| Feldspiel | `bauFeldspiel` | `battle-mode.engine.js:5441` `const art=FB(), n=art.jeSeite` | `FELDSPIEL_ART[d].jeSeite` |
| Bühne | `bauBuehne` | `:10990` `const art=BB(), n=art.jeSeite` | `BUEHNE_ART[d].jeSeite` |
| Bahn | `bauSpurt` | `:17856` `const d=bahnDisc, art=BA(), n=art.jeSeite` | `BAHN_ART[d].jeSeite` |
| Arena/Kampf | `build()` (ruft `baueEinheit`) | `:14082` `const d=disc, n=jeSeiteVon(d)` | `ARENA_ART[d].jeSeite` (Fallback-Kette `:4145-4149`) |

Alle vier `n`-Werte sind **Katalogkonstanten**, keine Laufzeitwerte. Die einzige Stelle, die sie
je ändert, ist die Mess-Sonde: `disziplinProbe(dId,opt)` bestimmt `art` generisch über alle vier
Chassis (`:22513-22514`) und überschreibt `art.jeSeite=o.jeSeite`, falls übergeben (`:22516`),
stellt es im `finally`-Block wieder her (`:22572`). Das ist die Grundlage für
`node scripts/miss-alle-disziplinen.mjs <n> <disziplin> --je-seite=2/3/4/5/6` — ein Mess-Werkzeug,
kein Produktionspfad.

**Cross-Check gegen den echten Spielpfad:** `lib/battle/arena-headless-runner.ts` ruft
`window.__arena.spieleFeldspiel(fd, saat)` / `spieleBuehneHeben` / `spieleBuehneDuell` /
`spieleBuehneAuftritt` (`:402-409`) — **kein einziger dieser Aufrufe nimmt einen Feldgrößen-
Parameter entgegen.** Die einzige Möglichkeit, wie eine reale Feldgröße überhaupt in den Motor
gelangen kann, ist über `window.__olyArenaKader.aufstellung` (`place`), gebaut von
`buildArenaAufstellungBeide()` (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts:107-116`)
aus den echten `lineupDrafts` des Spieltags — **nicht** über `art.jeSeite`. Das bestätigt: der
einzige Weg, wie eine Disziplin heute überhaupt mit einer von der Katalogkonstante abweichenden
Feldgröße läuft, führt über eine explizit gesetzte Aufstellung — nie über den Motor selbst.

### 1.2 Zwei Klassen von Baufunktionen — und der Unterschied liegt bei der Gegnerseite

Alle vier Baufunktionen bauen die **eigene** Seite (`mine`) identisch: zuerst `gesetzt=inDisc(d)`
(liest `place`, die echte Aufstellung), Rückfall auf `ersatz` (die besten `n` nach Disziplinwert)
nur wenn `gesetzt` leer ist. Damit trägt `mine` die echte Feldgröße, sobald irgendeine Aufstellung
existiert.

Bei der **Gegnerseite** trennen sich die Chassis in zwei Gruppen:

**Gruppe A — Feldspiel und Bühne (12 Disziplinen): Gegner liest ebenfalls die echte Aufstellung.**

```
// bauFeldspiel, :5470-5471
const gastGesetzt=OPP.filter(p=>place[p.n]&&place[p.n].d===feldspielDisc);
const gegner=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n);

// bauBuehne, :10999-11000 — Zeichen für Zeichen dasselbe Muster
const gastGesetzt=OPP.filter(p=>place[p.n]&&place[p.n].d===buehneDisc);
const gegner=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n);
```

Beide Kommentare an Ort und Stelle datieren diese Korrektur ausdrücklich als eigenen Fix („DIE
GASTSEITE LIEST DIE AUFSTELLUNG GENAUSO", Referenz auf `docs/BATTLE_ARENA_UEBERGABE.md` Fehler #1
und den Spiegeltest `scripts/miss-arena-feldspiel-spiegel.mjs` / `-buehne-spiegel.mjs`). Für diese
zwölf Disziplinen (Basketball, Football, Hockey, Gewichtheben, Speed-Schach, Showcase, Eiskunstlauf,
Breaking, Wettessen, Tennis, Fechten, I-Spy) gilt: **die feste `jeSeite` wirkt nur noch, wenn WEDER
die eigene NOCH die Gegnerseite eine Aufstellung gesetzt hat.**

**Gruppe B — Bahn und Arena/Kampf (8 Disziplinen): Gegner ist strukturell auf die feste Konstante
festgenagelt.**

```
// bauSpurt, :17868 — kein Äquivalent zu gastGesetzt existiert in dieser Funktion
const gegen=OPP.slice(0,n);
```

```
// build() (Arena/Kampf), :14105-14107
// Die Gegnerliste ist fuer sechs gebaut. Bei vier Koepfen je Seite werden die besten
// vier genommen und neu auf die Reihen verteilt, statt zwei Reihen leer zu lassen.
const gegner=OPP.slice(0,n);
```

Beide Zeilen lesen `place` für die Gegnerseite **überhaupt nicht** — es gibt in `bauSpurt` und
`build()` keine Entsprechung zu `gastGesetzt`/`OPP.filter(...)`. Selbst wenn die Gegner-KI (oder
ein Mitspieler) für diesen Spieltag exakt die richtige, reale Feldgröße aufgestellt hat, spielt der
Motor auf der Gegnerseite trotzdem immer mit genau `n=jeSeite` Köpfen. Das ist ein **schärferer**
Fund als Eiskunstlauf: dort ließ sich das Problem durch eine gesetzte Aufstellung umgehen
(Opus-Synthese Abschnitt 3.2 zeigt genau diesen bereits vorhandenen Präzedenzfall, den Duell-Fix
unten in 1.3). Für Bahn und Arena/Kampf gibt es diese Umgehung nicht — sie betrifft alle acht
Disziplinen dieser beiden Chassis gleichermaßen (Staffel, Spurt, Time-Trial, Climbing, Takeshi's
Castle, TDM, Mini-DM, Battlefield), weil `bauSpurt` und `build()` je nur eine gemeinsame Funktion
für alle ihre Disziplinen sind.

### 1.3 Was schon repariert ist — Duell- und Duett-Paarung laufen bereits dynamisch

Zwei Mechanismen *innerhalb* von `bauBuehne` bilden Paare aus der Teilnehmerliste und mussten
deshalb wissen, wie viele TEILNEHMER tatsächlich da sind — nicht wie viele die Katalogkonstante
verspricht. Beide sind bereits korrekt:

- **Duell-Bretter** (Speed-Schach, I-Spy, Tennis, Fechten — alle vier `duell:true`,
  `:10796/10819/10857/10941`): `:11089` `const duellBretter=Math.min(mine.length,gegner.length);`
  — der Kommentar direkt darüber (`:11077-11088`) benennt den Fix explizit als
  „Produktivierungswelle 1, 06.09." und verweist auf den nachgemessenen Fehler „beim ersten
  Arena-Testlauf mit `feldgroesse=2`".
- **Duett-Paarung** (Eiskunstlauf, `duett:true`, `:10703`): `:11144-11150` — paart die sortierte
  `TEILNEHMER`-Liste je Seite in Zweierschritten, exakt die Umsetzung, die die heutige
  Opus-Synthese unter 3.1–3.4 gefordert hat. Dieser PR ist bereits gemergt (`#856/#857/#859`).
- **Heben-Duelle** (Gewichtheben, `heben:true`, `:10615`): `baueHebenDuelle()`, eigene lokale
  `:11342` `const n=Math.min(mine.length,gegner.length);` — laut Kommentar bei `:11085-11088`
  das Vorbild, dem der Duell-Fix oben nachgezogen wurde.

**Wichtig für die Bewertung unten:** diese drei Mechanismen zeigen, dass die Paarungslogik selbst
längst weiß, wie man dynamisch mit `mine.length`/`gegner.length` statt mit der festen `n` rechnet
— das Muster existiert im Code. Es fehlt nur noch an genau zwei Stellen (`bauSpurt:17868`,
`build():14107`), an denen die Gegnerseite trotzdem noch stur `OPP.slice(0,n)` macht, statt densel-
ben `gastGesetzt`-Kniff wie Feldspiel/Bühne zu übernehmen.

### 1.4 Produktionsseite: nur fünf von zwanzig sind überhaupt „arena-aufgelöst" — und die kompensieren unabhängig

`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:159-165`) =
`{basketball, gewichtheben, hockey, speed-schach, showcase}`. Nur für diese fünf existiert
überhaupt ein Weg von einer echten Saison zu einem echten Battle-Mode-Ergebnis
(`runBattleModeArenaMatchday` → `runArenaFixtures`). Für sie gilt eine zweite, unabhängige
Korrektur auf der **Punkte**-Seite: `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` (`:404-462`) trägt für jede
der fünf eine eigene `referenzFeldgroessen`-Tabelle (Basketball `:409`, Gewichtheben `:418`, Hockey
`:427` inkl. eigener Torwart-Referenz, Speed-Schach `:445`, Showcase `:457`), und
`resolveArenaFieldSizeForMatchday()` (`:849-864`) liest die **echte** Feldgröße dieses Spieltags aus
`gameState.seasonState.disciplineSchedule`, nicht aus einer Katalogkonstante — der Kommentar bei
Hockey (`:433-440`) bestätigt wortgleich denselben Befund wie die Opus-Synthese: „die tatsaechlich
GEWUERFELTE Feldgroesse einer Saison liegt fuer JEDE der zwanzig Disziplinen gleichverteilt
zwischen 2 und 6".

Das heißt konkret: selbst wenn die zugrundeliegende Simulation (der Motor) mangels Aufstellung auf
die feste `jeSeite` zurückfällt, normiert die Produktionsseite für diese fünf Disziplinen die
daraus entstehenden Boxscore-Werte anschließend gegen die **richtige** Feldgröße. Das mindert das
Risiko dort erheblich — es macht die Motor-Konstante nicht falsch verschwinden, aber es verhindert,
dass ein falscher Boxscore automatisch zu falschen Liga-Punkten führt. Für die übrigen fünfzehn
Disziplinen (inklusive aller acht Bahn-/Arena-Disziplinen aus Gruppe B) existiert diese
Kompensation nicht, weil dort noch gar keine Produktionsanbindung existiert.

### 1.5 Mini-DM: ein zweiter, nicht angeschlossener Mechanismus mit einer strukturell anderen Feldgröße

Mini-DM hat, zusätzlich zum generischen `build()`/`baueEinheit`-Pfad, einen komplett eigenen
Mechanismus: `baueMiniDmFfaRunde()`/`spieleMiniDmFfaEvent()` (`:21151-21252`, „4-Team-Free-for-all",
`docs/design/mini-dm-4-team-ffa-recherche-06-09.md`). Er verlangt **hart** „genau 4 Spieler (einen
je Team)" (`:21152-21154`, wirft sonst einen Fehler) — vier TEAMS treten mit je einem Kämpfer in
vier Runden (eine je Rolle, `MINI_DM_FFA_ROLLEN`) gegeneinander an. Das ist eine strukturell andere
Größe als „Spieler pro Seite": es ist „ein Spieler je Team, vier Teams, vier feste Rollen" — nicht
„N Spieler pro Seite, N zwischen 2 und 6".

**Das ist heute kein aktiver Bug**, aus zwei Gründen, beide nachgeprüft:

1. Der Kommentar direkt über der Funktion (`:21041-21044`) sagt es selbst: „**KEINE
   Spielplan-/Fixture-Integration** … die bleibt ausdrücklich ein späterer, separater Durchgang."
2. `MOTOREN["mini-dm"]` — das, was `disziplinProbe`/`miss-alle-disziplinen.mjs` tatsächlich misst
   und was Mini-DMs rho-Zahl (0,094 in `stand-aller-disziplinen.md`) erzeugt hat — wird generisch
   für ALLE `ARENA_ART`-Schlüssel registriert (`:21027-21038`, `bau:(saat)=>{disc=ad; build(saat);}`)
   und läuft damit über denselben `build()`/`baueEinheit`-Pfad wie TDM und Battlefield, **nicht**
   über die FFA-Funktion. Mini-DMs heutige Messung und jedes heutige Risiko fallen also unter
   Gruppe B (1.2) wie TDM und Battlefield — nicht unter einen eigenen Fall.

Der FFA-Mechanismus ist trotzdem der klarste Fall im ganzen Feld, bei dem eine Feldgröße
strukturell NICHT einfach auf 2–6 „Spieler pro Seite" abbildbar ist, sobald er einmal angeschlossen
wird — das ist unten als eigener Punkt in der Prioritätenliste vermerkt, ausdrücklich als
Zukunftsrisiko, nicht als heutiger Fund.

---

## 2. Tabelle — alle zwanzig Disziplinen

Rho-Zahlen (je Spiel, Median über fünf Kader-Paarungen) aus `docs/design/stand-aller-disziplinen.md`
Abschnitt 1, hier nicht neu gemessen (Chromium-Einschränkung, s. Kopf dieses Dokuments).

| Disziplin | Chassis | Baufunktion | Feste Konstante | Gegnerseite liest Aufstellung? | Produktions-Cross-Check | Schweregrad | Empfehlung |
|---|---|---|---|---|---|---|---|
| Eiskunstlauf | Bühne | `bauBuehne` | `jeSeite:6` (`:10703`) | ja (Gruppe A, `:10999-11000`) | nicht arena-aufgelöst | **(a)** — Duett-Paarung bereits dynamisch (`:11144-11150`, #856/#857/#859 gemergt); nur der leere-Aufstellung-Rückfall bleibt fest | Bereits behoben für den Duett-Fall selbst. Verbleibender Rest identisch mit den anderen elf Gruppe-A-Disziplinen (s. Empfehlung unten). |
| Breaking | Bühne | `bauBuehne` | `jeSeite:6` (`:10731`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) | Kein eigener Paarungsmechanismus (kein `duell`/`duett`/`heben`) — betroffen nur vom generischen Rückfall. Vor einer künftigen Arena-Anbindung mit `--je-seite=2/3/4/5/6` nachmessen. |
| Gewichtheben | Bühne (`heben:true`) | `bauBuehne` + `baueHebenDuelle` | `jeSeite:6` (`:10615`) | ja (Gruppe A) | **arena-aufgelöst** — eigene PPS-Referenz je Feldgröße (`battle-mode-arena-team-points.ts:418`) | (a) — Duell-Paarung bereits dynamisch (`:11342`), Produktion kompensiert zusätzlich auf der Punkteseite | Niedrigstes Risiko im ganzen Feld: zwei unabhängige Sicherungen (dynamische Paarung + PPS-Referenz). Kein Handlungsbedarf. |
| Speed-Schach | Bühne (`duell:true`) | `bauBuehne` | `jeSeite:6` (`:10796`) | ja (Gruppe A) | **arena-aufgelöst** (`:445`) | (a) — Duell-Bretter bereits dynamisch (`:11089`) | Wie Gewichtheben: doppelt abgesichert. Kein Handlungsbedarf. |
| Showcase | Bühne | `bauBuehne` | `jeSeite:6` (`:10661`) | ja (Gruppe A) | **arena-aufgelöst** (`:457`) | (a) | Kein eigener Paarungsmechanismus nötig (kein `duell`/`duett`); Rückfall-Fall via PPS-Referenz abgesichert. Kein Handlungsbedarf. |
| Wettessen | Bühne | `bauBuehne` | `jeSeite:6` (`:10765`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) | Wie Breaking: nur der generische leere-Aufstellung-Rückfall betroffen. Vor Arena-Anbindung nachmessen. |
| Tennis | Bühne (`duell:true`) | `bauBuehne` | `jeSeite:6` (`:10857`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) — Duell-Bretter bereits dynamisch (`:11089`) | Nur Rückfall-Fall offen. Vor Arena-Anbindung nachmessen. |
| Fechten | Bühne (`duell:true`) | `bauBuehne` | `jeSeite:6` (`:10941`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) | Nur Rückfall-Fall offen. |
| I-Spy | Bühne (`duell:true`) | `bauBuehne` | `jeSeite:6` (`:10819`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) | Nur Rückfall-Fall offen. |
| Basketball | Feldspiel | `bauFeldspiel` | `jeSeite:6` (`:4225`) | ja (Gruppe A, `:5470-5471`) | **arena-aufgelöst** (`:409`) | (a) | Zwei Sicherungen wie Gewichtheben. Kein Handlungsbedarf. |
| Hockey | Feldspiel | `bauFeldspiel` | `jeSeite:6` (`:4511`) | ja (Gruppe A) | **arena-aufgelöst**, inkl. eigener Torwart-Referenz (`:427`) | (a) | Zwei Sicherungen. Kein Handlungsbedarf. |
| Football | Feldspiel | `bauFeldspiel` | `jeSeite:6` (`:4313`) | ja (Gruppe A) | nicht arena-aufgelöst | (a) | Nur Rückfall-Fall offen — vor einer künftigen Arena-Anbindung (nächstliegender Kandidat unter den drei Feldspiel-Disziplinen) mit `--je-seite=` nachmessen. |
| **Staffel** | **Bahn** | **`bauSpurt`** | `jeSeite:6` (`:17076`, `bahnenFest:2` betrifft nur Bahnzahl, nicht Kopfzahl) | **nein — Gruppe B**, `gegen=OPP.slice(0,n)` (`:17868`) | nicht arena-aufgelöst | **(b)** | Vor jeder Arena-Anbindung: `gegnerGesetzt`-Kniff wie in `bauFeldspiel`/`bauBuehne` nachbauen. |
| **Spurt** | **Bahn** | **`bauSpurt`** | `jeSeite:4` (`:16835`) | **nein — Gruppe B** (`:17868`) | nicht arena-aufgelöst | **(b)** | Gleicher Fix wie Staffel — dieselbe Funktion, derselbe Codeabschnitt betrifft alle fünf Bahn-Disziplinen gemeinsam. |
| **Time-Trial** | **Bahn** | **`bauSpurt`** | `jeSeite:6` (`:16937`) | **nein — Gruppe B** (`:17868`) | nicht arena-aufgelöst | **(b)** | Gleicher Fix. |
| **Climbing** | **Bahn** | **`bauSpurt`** | `jeSeite:6` (`:17029`) | **nein — Gruppe B** (`:17868`) | nicht arena-aufgelöst | **(b)** | Gleicher Fix. |
| **Takeshi's Castle** | **Bahn** | **`bauSpurt`** | `jeSeite:6` (`:17149`) | **nein — Gruppe B** (`:17868`) | nicht arena-aufgelöst | **(b)** | Gleicher Fix. |
| **TDM** | **Arena/Kampf** | **`build()`/`baueEinheit`** | `jeSeite:6` (`:4074`) | **nein — Gruppe B**, `gegner=OPP.slice(0,n)` (`:14107`), Kommentar „fuer sechs gebaut" (`:14105`) | nicht arena-aufgelöst | **(b)** | `gegnerGesetzt`-Kniff in `build()` nachbauen, analog zu Feldspiel/Bühne. |
| **Battlefield** | **Arena/Kampf** | **`build()`/`baueEinheit`** | `jeSeite:4` (`:4120`) | **nein — Gruppe B** (`:14107`) | nicht arena-aufgelöst | **(b)** | Gleicher Fix wie TDM — dieselbe Funktion. |
| **Mini-DM** | **Arena/Kampf** | **`build()`/`baueEinheit`** (heutige Messung) — **plus separater, nicht angeschlossener FFA-Mechanismus** (`baueMiniDmFfaRunde`/`spieleMiniDmFfaEvent`, `:21151-21252`) | `jeSeite:4` (`:4088`) | **nein — Gruppe B** (`:14107`), heutiger Messpfad | nicht arena-aufgelöst; FFA-Pfad ausdrücklich „KEINE Spielplan-/Fixture-Integration" (`:21043-21044`) | **(b)** heute; **(c)** sobald der FFA-Mechanismus angeschlossen wird | Heute: gleicher `gegnerGesetzt`-Fix wie TDM/Battlefield (betrifft die tatsächlich gemessene Mechanik). Vor jedem Anschluss des FFA-Mechanismus: eigene Chris-Entscheidung, wie „4 Teams × 1 Spieler × 4 feste Rollen" überhaupt auf eine gewürfelte 2–6-Feldgröße abgebildet werden soll — das ist keine Motor-Korrektur, sondern eine Rezeptfrage. |

---

## 3. Priorisierte Liste — was zuerst

Sortiert danach, wie viel Schaden ein unbemerkter Fund anrichten würde, **nicht** danach, wie
dringend Chris es gerade braucht (keine der beiden Gruppen hat heute ein echtes Save betroffen —
Battle Mode selbst läuft für kein Save produktiv, s. `lib/season/season-discipline-schedule.ts:19-31`,
„Battle Mode 20 Spieltage" ist laut Kopfkommentar dort noch W1, der Umschalter für Erzeuger folgt
erst in W2).

1. **Der `gegnerGesetzt`-Fix für Bahn (`bauSpurt`) und Arena/Kampf (`build()`)** — acht Disziplinen
   (Staffel, Spurt, Time-Trial, Climbing, Takeshi's Castle, TDM, Mini-DM, Battlefield), zwei
   Codestellen (`:17868`, `:14107`). Das ist der einzige Fund dieser Prüfung, der über den bereits
   bekannten Eiskunstlauf-Fall hinausgeht: eine Aufstellung kann ihn nicht umgehen, weil der Motor
   die Gegneraufstellung an dieser Stelle gar nicht erst liest. Ein einziger, kleiner PR (das Muster
   aus `bauFeldspiel:5470-5471`/`bauBuehne:10999-11000` Zeichen für Zeichen übertragen), mit
   Geschwister-Spiegeltest nach dem Vorbild `scripts/miss-arena-feldspiel-spiegel.mjs`.
2. **Football als nächste Arena-Kandidatin** — bevor Football (dritte Feldspiel-Disziplin) in
   `ARENA_RESOLVED_DISCIPLINE_IDS` aufgenommen wird, mit `--je-seite=2/3/4/5/6` gegenmessen. Der
   generische Fix ist hier schon vorhanden (Gruppe A); es geht nur um die Nachmessung vor der
   Produktivierung, wie es bei Hockey/Speed-Schach/Showcase bereits gemacht wurde.
3. **Wettessen/Fechten/Tennis/I-Spy/Breaking/Eiskunstlauf** — dieselbe Nachmessung, sobald für eine
   dieser sechs Bühnen-Disziplinen eine Arena-Anbindung geplant wird. Kein Code-Fund, reine
   Abnahme-Vorbereitung.
4. **Mini-DMs FFA-Mechanismus, VOR jedem Anschluss an Fixtures/Messung** — keine Code-Korrektur,
   sondern eine offene Design-Frage an Chris: wie bildet „4 Teams × 1 Spieler × 4 feste Rollen" die
   gewürfelte 2–6-Feldgröße ab (zusätzliche Rollen? mehrere Spieler je Rolle? die Feldgröße gilt für
   Mini-DM gar nicht?). Der einzige Fall dieser Prüfung, der eine Rezeptentscheidung statt einer
   Motorkorrektur braucht — analog zu den zwei offenen Chris-Fragen, die die Opus-Synthese für
   Eiskunstlauf schon vor der Umsetzung eingefordert hat.
5. **Bereits erledigt, nur zur Vollständigkeit:** Eiskunstlauf-Duett (`:11144-11150`) und die
   Duell-Unterzahl-Korrektur (`:11089`, Speed-Schach/I-Spy/Tennis/Fechten) sind beide bereits
   gemergt und brauchen keine weitere Arbeit aus dieser Prüfung heraus.

---

## Anhang: was für diesen Bericht gelesen wurde

`public/mockups/battle-mode.engine.js` (`jeSeiteVon` `:4145-4149`; `ARENA_ART` `tdm`/`mini-dm`/
`battlefield` `:4074-4130`; `FELDSPIEL_ART` Basketball/Football/Hockey `:4225/4313/4511`;
`bauFeldspiel` `:5436-5560`; `BUEHNE_ART` alle neun Einträge `:10615-10941`; `bauBuehne`
`:10976-11150`; `WERTUNG_DUELL`-Weiche `:11076-11103`; `baueHebenDuelle` `:11341-11400`;
`baueEinheit`/`build()` `:14020-14139`; `BAHN_ART` alle fünf Einträge `:16835-17150`; `bauSpurt`
`:17797-17900`; `disziplinProbe` `:22503-22580`; Mini-DM-FFA `:21027-21252`); `lib/season/
season-discipline-schedule.ts:19-31,85-165`; `lib/data/dataAdapter.ts:55-74`; `lib/resolve/
battle-mode-arena-team-points.ts:159-165,384-506,840-880`; `lib/battle/arena-headless-runner.ts`
(vollständig); `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` (vollständig);
`docs/design/stand-aller-disziplinen.md` Abschnitt 1 (Disziplinliste, Chassis-Zuordnung, rho-Zahlen);
`docs/pm-briefings/opus-synthese-eiskunstlauf-breaking-08-09.md` (vollständig, Ausgangspunkt).

**Nicht nachgemessen:** keine rho-Zahl in dieser Prüfung — alle sind aus `stand-aller-disziplinen.md`
übernommen (dieselbe Chromium-Einschränkung wie in der Opus-Synthese: `scripts/miss-alle-
disziplinen.mjs` startet in dieser Umgebung Chromium, die Mockup-Seite stürzt beim Laden ab). Kein
Befund dieses Dokuments hängt an einer rho-Zahl — alle Befunde sind Code-Lesefunde (welche Funktion
liest welche Variable), keine Messfunde.

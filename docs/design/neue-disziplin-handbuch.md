# Handbuch: eine neue Disziplin bauen — der Verfahrensteil

Stand: 2026-09-02, geschrieben gegen `origin/main` `6e16cf1b` (PR #739, „Eishockey laeuft
live in der Arena"). Wo eine Zahl oder Regel erst auf `origin/claude/hockey-balance`
(`3fdba909`, noch nicht gemergt) steht, ist das ausdrücklich vermerkt. Alle
`engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf `6e16cf1b`.

Auftrag von Chris, wörtlich: *„kannst du mal nen agent raus senden der mal die bisherigen
erkenntnisse sammelt und zusammenschreibt, was wir immer an informationen und code suchen
müssen für die neuen disziplinen ... damit ich dir z.B. sagen kann bitte erstelle als
nächstes Gewichtheben und du das dann entsprechend vorbereitest"*.

Dieses Handbuch ist der **Verfahrensteil**: Chassis-Wahl, Reihenfolge, Abnahme, Recherche,
Code-Stellen, Fallen, Checkliste. Sprites, Feldzeichnung, Requisiten, Töne und Lizenzen
stehen im **Asset-Teil**, `docs/design/neue-disziplin-assets.md` (parallel entstanden).

Die Pläne, aus denen dieses Handbuch destilliert ist — bei Widerspruch gilt der jeweils
jüngere, und die Kommentare im Code schlagen jedes Dokument:

| Dokument | Was dort steht |
|---|---|
| `docs/BATTLE_ARENA_UEBERGABE.md` | die vier Chassis, die Regel „Keine erfundenen Werte", die erste Pp-Messreihe aller 20 |
| `docs/design/battle-arena-multi-disziplin-plan.md` | Modularisierung, Wellen-Reihenfolge, Abschnitt 1.3 (nur auf `hockey-balance`) |
| `docs/design/battle-mode-nba2k-modell-plan.md` | Rangtreue als zweite Abnahmezahl, Rollenproben, Übertragbarkeit auf Bahn/Bühne/Kampf (§7) |
| `docs/design/hockey-rollout-plan.md` + `hockey-rollout-plan-review-fable.md` | der vollständige Weg einer zweiten Feldspiel-Disziplin, mit Review und Auflagen (Teil H) |
| `docs/design/hockey-torwart-puck-tore-plan.md` + `hockey-torwart-puck-tore-recherche-fable.md` | Sonderrolle, Puck, Korridor, Formationen, xG-Modelle, Lizenzen |
| `public/mockups/battle-mode.rezepte.js` | die Kalibrierhistorie von Basketball und Hockey, mit allen verworfenen Fassungen |
| `CLAUDE.md`, Abschnitt „Die Abnahme jeder Disziplin: ein Spiel, nicht eine Saison" | nur auf `hockey-balance`; der Deckel-Befund |

**Jede Zahl hier ist entweder aus dem Repo zitiert (Datei:Zeile oder PR), oder ich habe sie
selbst gemessen (mit Befehl). Was ich nicht belegen kann, steht als offene Frage in Teil 8.**
Durchgehendes Beispiel ist Chris' Wunsch **Gewichtheben** — es ist `cat:"buehne"` und
damit ein anderes Chassis als Basketball und Hockey, was das Handbuch vor der Abstraktion
bewahrt.

---

## 1. Welches Chassis? Die erste und teuerste Entscheidung

### 1.1 Die Zuordnung steht in `DISCS` (`engine.js:2590-2608`)

| Chassis (`cat`) | Disziplinen | Tabelle | baut | schrittet | `wert()` („größer ist besser") |
|---|---|---|---|---|---|
| `feldspiel` | Basketball, Football, Hockey, Tennis | `FELDSPIEL_ART` (:3482) | `bauFeldspiel` (:4254) → `initFeldspielLive` (:4829) bei `live`-Block, sonst Vorab-Schleife | `stepFeldspiel` (:7158) → `stepFeldspielLive` (:6809) | Box-Score, **je Disziplin** in `feldspielWert` (:4773) |
| `buehne` | **Gewichtheben**, Showcase, Eiskunstlauf, Breaking, Wettessen, Speed-Schach, I-Spy (Duell-Variante) | `BUEHNE_ART` (:7790) | `bauBuehne` (:7941) — rechnet **alle** Durchgänge sofort durch | `stepBuehne` (:8023) — enthüllt nur | Summe der Durchgangspunkte, bei `duell` der Brett-Vorteil (`MOTOREN`, :13984-13999) |
| `speed` | Spurt, Staffel, Time-Trial, Climbing (+ Takeshi als `chaos`) | `BAHN_ART` (:11446) | `bauSpurt` (:11779) | `stepSpurt` | negative Platzierung; Staffel: negative Teamzeit (:13943-13980) |
| `power` | TDM, Mini-DM, Fechten, Battlefield | `ARENA_ART` (:3284) | `build` (:9455) | `stepSim` (:10395) | Anteil am Gesamtbeitrag (:13927-13941, Herleitung im Kommentar davor) |

**Falle Nr. 1 gleich hier:** das Spiel kennt eine *zweite* Kategorie, die nichts mit dem
Chassis zu tun hat. `lib/data/dataAdapter.ts:54-75` führt Gewichtheben als `category:
"power"`, Basketball als `"social"`, Tennis als `"mental"`. Diese Kategorie steuert die
Saison (Kadergröße-Permutation `[2,3,4,5,6]` je Fünfer-Kategorie,
`lib/season/season-discipline-schedule.ts:89-94`), nicht den Motor. Wer nach „power" sucht,
landet bei Gewichtheben im Kampf-Chassis — falsch. Maßgeblich für den Motor ist allein
`cat` in `DISCS`.

### 1.2 Was in jedem Chassis schon generisch ist

- **Der Motor-Vertrag `MOTOREN[d]`** (`engine.js:13864 ff.`): `sichern/zurueck/vorher/bau/
  lauf/namen/wert`. Jede Disziplin einer Tabelle meldet sich automatisch an — für Bühne
  über die Schleife `for(const bd of Object.keys(BUEHNE_ART))` (:13984). Ein Eintrag in
  der Tabelle genügt; in `MOTOREN` ist nichts nachzutragen.
- **Die Pp-Messung** `einflussVon(dId,n)` (:14053) und `scripts/messe-arena-einfluss.mjs`
  kennen keine Disziplin beim Namen. Angehoben wird an genau einer Stelle (`ATTR_HEBUNG`,
  :9383; `gehoben()`), die alle Baupfade lesen.
- **Ein Spiel, ein Ergebnis:** `window.__arena.spiele(dId, saat)` (:14745 →
  `spieleDisziplin`, :14219) liefert `{disziplin, protokoll, wert, punkte, namen}` für alle
  20. Bühne-Protokoll: `{n, seite, summe, runden}` je Teilnehmer.
- **Rezepte als Daten:** `rezeptAus(dId, inline)` (:3270) zieht zuerst
  `battle-mode.rezepte.js`, sonst das Inline-Rezept, und wirft laut, wenn beides fehlt.
- **Slot-Profile und Matrizen** werden generiert, nicht abgeschrieben:
  `scripts/generiere-arena-daten.ts --schreiben` erzeugt `BASIS_JE_DISC` (:2759) und
  `SLOTS_JE_DISC` (:2781) aus `lib/player-generator/official-discipline-weights.ts` und
  `lib/lineups/matchday-slot-roles.ts`.
- **Die Aufstellung erreicht die Arena** seit PR #736 für alle Chassis
  (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts`, `place` im Motor). `bauBuehne`
  liest `place[p.n].slot` (:7950) genau wie `bauFeldspiel` (:4293).
- **Zeitdehnung** `ZEIT_DEHNUNG` (:12597) und die 60-Sekunden-Rundenlänge (Bühne:
  `rundenDauer = 60/(rundenN·jeSeite·2)`, Kommentar :3446).

### 1.3 Was je Disziplin eigen bleibt — und im Bühne-Chassis konkret

Der Multi-Diszi-Plan (§1.1) nennt drei Dinge, die je Disziplin eigen sind: die
Sub-Skill-Struktur samt Namen, die Erfolgsformel, und die Abnahme-Definition
(Schwellen, Archetypen). Für Gewichtheben heißt das heute:

**Die sieben Bühne-Rollen** (Kommentar `engine.js:3410-3452`): GRUNDLAGE, SPITZENMOMENT,
TECHNIK, PUBLIKUM, NERVEN, AUSDAUER, WAGNIS. **Eine Formel für alle sieben
Bühne-Disziplinen** (`bauBuehne`, :7969-7981):

```
ermued  = 1 − max(0, 60−AUSDAUER)·0,0035·(ri/(rundenN−1))
basis   = (20 + GRUNDLAGE·0,7) · max(0,4, ermued)
erfolg  = min(0,94; 0,15 + TECHNIK·0,0055 + NERVEN·0,0035)
gelingt : punkte = basis + SPITZENMOMENT·0,35·(0,4 + WAGNIS·0,006)
misslingt: punkte = basis · failAbzug          (Gewichtheben: failAbzug 0)
immer   : + PUBLIKUM·0,12, gerundet, ≥ 0
```

Gewichtheben-eigen ist nur die Zeile in `BUEHNE_ART` (:7791-7817): `rundenN:3`,
`rundenDauer:1.65`, `failAbzug:0` („echtes Gewichtheben kennt keine Teilpunkte für eine
gerissene Hantel"), die Wörter, und das Rezept — das **noch inline im Motor** steht, nicht
in `battle-mode.rezepte.js` (dort sind bis heute nur Basketball und Hockey).

**Was das für Chris' Beispiel bedeutet, gemessen am 02.09. gegen `6e16cf1b`:**

```
node scripts/messe-arena-einfluss.mjs gewichtheben 48
```

| Attribut | Anteil | Matrix | Differenz |
|---|---:|---:|---:|
| power | 20,9 % | 28 | −7,1 |
| determination | 20,1 % | 12 | +8,1 |
| charisma | 19,4 % | 23 | −3,6 |
| health | 15,7 % | 16 | −0,3 |
| will | 11,8 % | 7 | +4,8 |
| dexterity | 10,5 % | 6 | +4,5 |
| speed | 0,9 % | 6 | −5,1 |
| stamina | 0,7 % | 2 | −1,3 |
| **Abweichung** | | | **34,8 Pp** (3 s Laufzeit) |

Die Übergabe nennt 31,8 Pp bei n=12 (`BATTLE_ARENA_UEBERGABE.md:1066`); bei n=48 sind es
34,8 — derselbe Effekt, den die Übergabe für Spurt beschreibt (n=12 ist systematisch zu
günstig). determination liest fast das Doppelte seiner Vorgabe, weil es in **fünf** der
sieben Rollen sitzt (GRUNDLAGE, SPITZENMOMENT, TECHNIK, NERVEN, AUSDAUER — :7809-7815),
darunter in beiden Erfolgschance-Rollen; speed sitzt nur in WAGNIS, das erst *nach* dem
Erfolg zählt. Das ist genau der Befund, den die Übergabe als Lehre der ersten
Bühne-Messung notiert (`:1050-1057`): ein Attribut in einer **Erfolgschance-Rolle** gewinnt
strukturell mehr Einfluss als eines in einer additiven Rolle.

**Zweite Messung, eigens für dieses Handbuch (Ad-hoc-Skript, Temp-Kopie des Mockups mit
einem angehängten Export `teilnehmerProbe`, Arbeitsbaum unberührt; 48 Spiele über
`spieleDisziplin("gewichtheben", 1337+i·7919, {zustandBehalten:true})`, Beispielkader,
Formkarten fest):**

| | Gewichtheben heute |
|---|---:|
| Teilnehmer je Spiel | 12 (6 je Seite) |
| wertende Ereignisse je Teilnehmer und Spiel | **3** (Durchgänge) |
| Test-Retest des Impacts (Pearson Spiel i gegen i+1, gemittelt) | **0,436** |
| Deckel = Wurzel daraus | **0,66** |
| rho(ges) je Spiel, Mittel / Streuung | 0,33 / 0,24 — **nicht interpretierbar, s. u.** |

Zwei Dinge daran sind Befunde, kein Zufall:

1. **Der Deckel liegt beim Hockey-Wert (0,67, Teil 3.4) und weit unter der Schranke
   0,80.** Drei Durchgänge, jeder eine Bernoulli-Ziehung mit festem Auszahlungsbetrag —
   ein gelungener Versuch bringt für denselben Lifter jedes Mal exakt dieselben Punkte
   (Spiel 1, Saat 1337: Johanna 97/97/97, Draco 111/111/111), ein gerissener bringt 2.
   Die Rangfolge innerhalb eines Spiels entscheidet damit fast allein, wer *wie oft*
   gerissen hat. Ohne mehr wertende Ereignisse je Spiel oder ein anderes Impact-Maß hebt
   kein Rezept Gewichtheben über 0,66. Das ist die erste Frage an Chris (Teil 7, Schritt 1).
2. **Die Rangtreue selbst lässt sich am Beispielkader für Bühne heute nicht messen.** Die
   Eignungen lasen −4,6 bis 8,0 statt eines Fertigkeitswerts. Grund im Code: der
   Beispielkader trägt `d:{tdm, spurt}` (:2430 ff.). Chris' Fund vom 25.08. dazu ist
   **nur im Feldspiel** repariert — `bauFeldspiel` rechnet `gewichtet(p.a, BASIS_JE_DISC)`
   nach, wenn `p.d[disc]` fehlt (:4329-4334); `bauBuehne` liest weiter `(p.d[buehneDisc]||0)`
   (:7962), ebenso `build` (:9423) und `bauSpurt` (:11824). Für eine Rangtreue-Messung an
   einer Bühne-Disziplin muss diese Zeile zuerst nachgezogen werden — oder die Messung
   läuft über den Headless-Runner mit einem echten Spielstand.

Und drittens fehlt schlicht das Werkzeug: `feldspielProbe` (:14255) wirft für jede
Nicht-Feldspiel-Disziplin (`"ist keine Feldspiel-Disziplin"`). Der NBA2K-Plan (§7, letzter
Absatz) nennt die Verallgemeinerung des rho-Teils auf alle 20 aus `MOTOREN[d].wert()` +
`u.eig` „die günstigste Verallgemeinerung dieser ganzen Runde" und verlangt sie **vor** der
nächsten Disziplin. Sie ist nicht gebaut.

### 1.4 Chassis-Wahl in einem Satz je Chassis

- **Feldspiel** wählen, wenn das Ergebnis eines Zugs vom Gegner abhängt (Ballbesitz, Abwehr
  kann den Zug beenden). Live-Motor nur mit `live`-Block; Sonderrollen wie der Torwart
  nach dem Muster von PR #739 (Slot-Kennung → `u.torwart`, aus der Angriffsformation
  heraus, eigene Wertformel).
- **Bühne** wählen, wenn jeder für sich antritt und bewertet wird; Duell-Variante
  (`duell:true`), wenn zwei sich paarweise gegenüberstehen ohne geteilten Ball.
- **Bahn**, wenn eine Strecke das Budget ist; **Kampf**, wenn die fünf Kampfwerte
  ANG/VER/LP/TMP/AUS tragen (Vorsicht: `aufEignung()` normiert TMP/AUS nicht, :3175 ff.,
  Übergabe-Falle Nr. 5 des Multi-Diszi-Plans).
- Offen bleibt Tennis: teilt `FELDSPIEL_ART`, ist aber strukturell „sechs parallele
  Duelle" (NBA2K-Plan §7, Multi-Diszi-Plan §2 „Sonderfälle zuletzt").

---

## 2. Die Reihenfolge — und warum sie beißt

Der teuerste Fehler dieses Projekts ist zweimal derselbe gewesen: **zu früh sondieren.**
Gewichte, die gegen eine Mechanik gemessen werden, die danach ersetzt wird, sind wertlos —
und ein daraus gebautes Rezept ebenfalls, egal wie gut seine Zahl aussieht.

### 2.1 Die Regel

```
Struktur (Mechanik, Zonen, Sonderrollen, Ereignisdichte)
  → Impact-Formel je Disziplin (wert())
    → Sondierung (orthogonale Rezepte, n ≥ 24)
      → Rezept (Budget-Methode, gegen die Sondierungsgewichte)
        → Pp-Abnahme (zwei Saatstämme)
          → Rangtreue und Rollenproben
            → Archetypen-Demo
```

Nichts davon lässt sich vorziehen, weil jede Stufe die Messgrundlage der nächsten ist.
Die Kopplung ist gemessen, nicht vermutet: die Pp-Abweichung hängt **nicht nur** am
Rezept, sondern an der Mechanik und an `wert()` — Basketballs FG%-Rekalibrierung allein
bewegte sie von 31,8 auf 22,8 und dann auf 53,7 Pp (`rezepte.js:39-41`; Review Befund 2).

### 2.2 Die Belege, chronologisch

| Wann | Was passiert ist | Was es gekostet hat | Quelle |
|---|---|---|---|
| 26.08., Basketball | Ein attribut-zentrierter Rezept-Neubau wurde gegen die **alte** Trefferformel gemessen (31,8 → 22,8 Pp). Dann kam die Wurfquoten-Rekalibrierung (`technikMake` 0,16/0,0050/0,0060 → −0,02/0,0022/0,0030). | Dasselbe Rezept las danach **53,7 Pp** und wurde verworfen. Der zweite Anlauf bekam den Schritt, der beim ersten fehlte: **erst messen, wie viel jeder Sub-Skill trägt.** | `battle-mode.rezepte.js:39-47` |
| 26.08.–01.09., Basketball | Ein lineares Einfluss-Gewichts-Modell aus **einer** Messung zurückgerechnet (neun Gleichungen, zehn Unbekannte). | In der Kreuzvalidierung ~49 Pp Prognosefehler; **fünf von fünf** daraus abgeleitete Rezepte schlechter als das gemessene. Konsequenz: Werkzeuge, die die Messschleife verkürzen — keine Modelle, die sie ersetzen. | `rezepte.js`, Punkt 1 des Basketball-Blocks; Multi-Diszi-Plan §0.4 |
| 01.09., Hockey | Sondierung der **Vorab**-Mechanik lieferte in einem Anlauf ein Rezept mit 48,1 → **14,2 Pp** (n=48). | **Bewusst nicht eingebaut**, weil die Gewichte nach der Live-Migration andere sind (Basketballs Live-Sondierung liest ZWEITCHANCE 10,3 / ABWEHR 21,8 / SCHUSS_NAH 17,5 statt ABWEHR 36,1 / ZWEITCHANCE 1,0 im Vorab-Pfad). „Reihenfolge schlägt Rezeptqualität." | Hockey-Plan 0.5/0.6, A.4; PR #734 |
| 01.09., Review | Der Hockey-Plan wollte „direkt nach PR 3" sondieren — gegen Basketballs Impact-Formel, in der ein Check 1,5 und ein Tor 1,0 zählt. | Auflage: **Impact-Formel vor jeder Sondierung**, Zonenmodell vor dem Rezept, PR 3 geteilt. | Review Befunde 2 und 6; Plan H.2, H.5 |
| 02.09., Torwart-Plan | Der erste Entwurf hätte Hockey live geschaltet (mit `GEO_BONUS.dunk` 0,70, ohne Tor, ohne Torwart), **dann** sondiert, **dann** Tor/Torwart/Bande/Impact gebaut. | Vom Overseer als exakt derselbe Fehler erkannt, den der Autor „im vorigen Review selbst als Auflage übernommen hatte". Korrigiert zu **3b′**: alles Strukturelle mit Platzhalterzahlen in einem Schritt, dann messen. | Torwart-Plan Teil 5 und Teil 8; Recherche §9, §11.2 |
| 02.09., Hockey-Balance | Sondierung begonnen und bei n=3 **abgebrochen**: zwei Läufe mit gedrehter Zuordnung lieferten völlig verschiedene Rangfolgen, und die Verteidiger an der blauen Linie schossen nie ungezwungen, weil Hockey noch Basketballs Reichweiten nutzte (Fernwurf bis 170 px, Points bei 295 px). | „Eine Sondierung jetzt misst Basketballs Geometrie." Belastbar erst bei n ≥ 24 **und** stehender Struktur. | Commit `02a3b61f` auf `hockey-balance` |
| 02.09., Torwart-Wertung | `HK_TW_BASIS` ist der gemessene Mittelwert der Feldspieler-Impacts. Beim Einbau von Steals und Schussvolumen stiegen die Feldspieler von 3,8 auf 8,5, der Torwart blieb bei 3,8 und rutschte von Rang 5 auf Rang 9 — ohne dass sich an ihm etwas geändert hätte. | Regel: nach **jeder** Änderung der Wertformel die abhängigen Anker nachziehen. | Kommentar an `HK_TW_BASIS`, `hockey-balance` |

### 2.3 Was die Regel für Gewichtheben heißt

Heute ist Gewichtheben Vorab-Bühne mit einer für sieben Disziplinen gemeinsamen Formel.
Solange nicht entschieden ist, ob das Chassis so bleibt (Teil 7, Schritt 2), ist **jede**
Rezeptrunde am heutigen 34,8-Pp-Stand verschenkt — genau wie Hockeys 14,2-Pp-Kandidat.
Und solange der Deckel bei 0,66 liegt, ist auch jede Rangtreue-Runde verschenkt: erst die
Ereignisdichte, dann das Impact-Maß, dann das Rezept.

---

## 3. Die Abnahmeschranken

### 3.1 Die Tabelle

| Schranke | Zahl | Gemessen womit | Belegter Stand |
|---|---|---|---|
| **Rangtreue je EINEM Spiel** | **rho > 0,80, angestrebt 0,85**, je Seite gemittelt | `scripts/miss-feldspiel-rangtreue.mjs <diszi> 24 6` (Feldspiel); für Bühne/Bahn/Kampf **kein Werkzeug** (1.3) | Basketball 0,836 / 0,804 (n=24, #731); Hockey 0,439 → 0,706 / 0,680 (`hockey-balance`) |
| — bis 02.09. galt | ≥ 0,74 (Hockey-Plan D.2), davor ≥ 0,70 (NBA2K-Plan §4) | dieselbe Sonde | Basketball 0,605 → 0,740 (NBA2K-Runde, PR #710) |
| **Pp-Abweichung zur Matrix** | **≤ 25 Pp allgemein, ≤ 15 Pp Leuchtturm**, in mindestens einer von zwei Stichproben | `node scripts/messe-arena-einfluss.mjs <diszi> 48` (Staffel 144; TDM klein anfangen) | Basketball 17,2 / 19,4 (zwei Saatstämme, PR #680) → 20,4 (Archetypen) → 32,1 → 36,5 (NBA2K, „Beobachtung, kein Veto"); Hockey 48,1 (n=48); Gewichtheben 34,8 |
| **Spiegeltest** | Boxscore-Abweichung **0,0 %** bei identischen Kadern | `scripts/miss-arena-feldspiel-spiegel.mjs 48` | Basketball 0,0 % seit PR #704; in #736/#737 wieder geprüft |
| **Slot-Invariante** | Mittel aller Slot-Profile trifft die Matrix auf **≤ 0,2 Pp**, alle 20 Disziplinen × Kadergrößen 1..6 | `npx tsx scripts/pruefe-slot-invariante.ts` | max. 0,005 Pp (mini-dm @ n=2), Hockey 0,003 (PR #738) |
| **Korridor der disziplineigenen Kennzahlen** | je Disziplin gesetzt, gegen reale Referenz | Hockey: `scripts/miss-hockey-korridor.mjs 32` | Ziel 3,5 Tore / 26 Abschlüsse / 13,5 % / 86,5 %; gemessen 3,47 / 35,4 Versuche / 30,6 aufs Tor / 88,7 % (#739), nach Torwart-Slot 3,36 / 25,5 / 21,5 / 84,4 % (`hockey-balance`) |
| **Rollenproben** | V: Angreifer gegen starken minus schwachen Decker, gepaart; S: offen gegen bedrängt, **zonen-isoliert und in Abstandsbändern** | dieselbe Sonde | Basketball V: −32,5 % Punkte (Ziel ≤ −25 %), ΔFG% −4,1 Pp (Ziel ≤ −8, Selektionseffekt erklärt); S-Bänder 0-10 px 34,6 % … ≥30 px 45,6 % (#732) |
| **Archetypen** | jeder der vier führt in seiner eigenen Kategorie, 300+ Spiele | Ad-hoc-Demo (Vorlage `scripts/arena-archetyp-demo.mjs` ist im Multi-Diszi-Plan 1.2.3 geplant, **nicht gebaut**) | Basketball: Vorlagen +16 %, Dreier +173 %, Korbwürfe +76 %, Steals+Blöcke+Rebounds +17 % |
| **Geschwister bit-identisch** | Sondenausgabe der bestehenden Disziplin byteweise gleich (6v6, 4v4, 2v2) | `miss-feldspiel-rangtreue.mjs basketball 6 2,4,6 --json` vorher/nachher | in #737, #739 und jedem `hockey-balance`-Commit nachgewiesen |
| **Tests** | `tests/battle-arena-ein-modell-ueberall.test.ts`, `tests/arena-headless-runner.test.ts`, `tests/hockey-torwart-slot.test.ts`, `tests/battle-mode-arena-team-points.test.ts` grün; `npx tsc --noEmit` | — | — |

### 3.2 Zur Pp-Messung: was die Zahl kann und was nicht

- **n=12 ist systematisch zu günstig**: Spurt 40,9 Pp bei n=12 gegen 54,7 bei n=48,
  Climbing 28,9 gegen 37,2 (`messe-arena-einfluss.mjs:32-42`). Bei geteiltem Ergebnis
  (Staffel) erst ab ~120 Läufen stabil.
- **Eine Messung ist eine Stichprobe.** Die Saaten in `einflussVon` sind fest verdrahtet
  (:14063-14064). Basketballs Doppellauf las 17,2 / 19,4 Pp; nur **gleichgerichtete**
  Abweichungen sind Struktur, alles andere wechselt das Vorzeichen (`rezepte.js`, Punkt 3).
  Zweiter Stamm: ein anderes `n`, oder einmalig `zieheFormkarten(20260824+i·15485863)/
  M.bau(4241+i·32452843)` (ABWEHR-Kommentar in `rezepte.js`).
- **Die Metrik ist nicht monoton.** Sie normiert über die positiven Gewinne; ein Attribut
  mit Nettogewinn ≤ 0 liest exakt 0,0 % und kostet sein volles Matrixgewicht. Zwei
  Fassungen mit identischer dexterity-Verteilung lasen 7,2 % und 1,1 %. Regel aus der
  Archetypen-Runde: **die Fassung behalten, in der alle Attribute positiv lesen**.
- **Unter ~17 Pp dominiert die Saatstamm-Streuung** (Multi-Diszi-Plan §4.3) — dort ist
  weiteres Drücken Scheingenauigkeit.
- **Pp ist ein Signal, kein Veto**, sobald Rangtreue und Archetypen dagegenstehen: die
  NBA2K-Runde hat 32,1 → 36,5 Pp hingenommen, weil der Anstieg in speed erklärbar war
  (längeres Spiel, mehr Umschaltmomente) und rho von 0,605 auf 0,740 stieg.
- **Die Zeit:** Bühne misst in Sekunden (Gewichtheben n=48: 3 s). Feldspiel-Live spielt
  13 × 12 × n volle Spiele; Basketball bei n=48 hat einmal das Sitzungsbudget gesprengt
  (Hockey-Plan G.1). Deshalb ist die Abnahme dort n=48, n=96 nur als Bestätigung ohne
  Zeitdruck (H.6).

### 3.3 Zur Rangtreue: warum ein Spiel, nicht eine Saison

Chris am 02.09. (`CLAUDE.md` auf `hockey-balance`, Multi-Diszi-Plan 1.3): *„wichtig wäre
auch dass es irgendwie möglich ist das umzusetzen innerhalb von einem spiel! Wir haben ja
pro season dann nur 2x Hockey ... und das gilt natürlich für alle diszis"*. Eine Saison
enthält je Disziplin nur eine Handvoll Spiele; eine Ordnung, die erst im Aggregat sichtbar
wird, existiert für den Spieler nicht. Über 24 Spiele aggregiert sortiert der Hockey-Motor
die Feldspieler mit 0,915 — im Einzelspiel mit 0,656 (`02a3b61f`). Die zweite Zahl ist die,
die zählt.

Spearman über **Durchschnittsränge**, nicht die `6·Σd²`-Kurzformel — Bindungen sind häufig
(NBA2K-Plan §4). `rho(Seite)` ist die ehrlichere Zahl; `rho(gesamt)` bekommt allein durch
ein Stärkegefälle zwischen den Teams Korrelation geschenkt.

### 3.4 Der Deckel-Befund: keine Rangtreue über die Wurzel der Test-Retest-Verlässlichkeit

Der wichtigste Befund der Hockey-Balance-Runde ist kein Eingriff, sondern eine Grenze.
Wie gut sagt die Leistung eines Spielers in einem Spiel seine Leistung im nächsten
voraus? Die Wurzel daraus ist die mathematische Obergrenze jeder Korrelation eines
Einzelspiels mit einem festen Merkmal:

| | Basketball | Hockey vor Balance | Hockey ohne Torwart | Hockey nach Balance | Gewichtheben (dieses Handbuch) |
|---|---:|---:|---:|---:|---:|
| rho je Spiel | 0,836 | 0,484 | 0,656 | 0,706 | n. m. (1.3) |
| Streuung von rho je Spiel | 0,06 | 0,23 | 0,22 | — | 0,24 |
| Test-Retest des Impacts | 0,761 | 0,443 | 0,521 | — | **0,436** |
| **Deckel = Wurzel** | **0,87** | **0,67** | **0,72** | — | **0,66** |
| davon erreicht | 96 % | 72 % | 91 % | — | — |
| wertende Ereignisse je Spiel | 82 Würfe, 87 Punkte | 26 Versuche, 6,6 Tore | | | 36 Durchgänge, 3 je Kopf |

(Basketball/Hockey: Commit `02a3b61f`, Overseer-Messung; Gewichtheben: Teil 1.3.)

**Kein Rezept der Welt hebt eine Disziplin über ihren eigenen Deckel.** Der Deckel hängt an
der Ereigniszahl je Spiel und an der Verlässlichkeit der Größen, aus denen der Impact
gebaut ist. Im Eishockey haben gewonnene lose Pucks eine Test-Retest-Verlässlichkeit von
0,89, Schüsse 0,56, Tore nur 0,30 (Multi-Diszi-Plan 1.3, `hockey-balance`) — der Befund, aus
dem in der NHL Corsi und Game Score entstanden sind. Zwei Hebel, in dieser Reihenfolge:
**mehr wertende Ereignisse** (Spielzeit, Tempo, Zweikampfrate) und **ein Impact-Maß aus den
verlässlichen Größen**. Für Gewichtheben ist das die erste Entscheidung überhaupt (Teil 7).

Rollen mit eigener Wertformel getrennt prüfen: der Hockey-Torwart drückte die Gesamtzahl
allein um 0,10 bis 0,38 (`miss-rangtreue-nach-rolle.mjs`, `hockey-balance`), ohne dass am
Rezept der Feldspieler etwas falsch war.

---

## 4. Was IMMER zu recherchieren ist, bevor eine Zeile Code entsteht

Chris' Kernfrage. Für Hockey waren es (Hockey-Plan D.3, Torwart-Recherche Abschnitt
„Abgerufen"): Tore je Team und Spiel, Schüsse aufs Tor, Schussversuche, Trefferquote,
Fangquote, Vorlagen je Tor, Bullys, geblockte Schüsse, Hits, Strafen und Überzahlquote,
Spielstruktur (3×20, Overtime), die Dauer eines Schlagschusses (PR #739: 0,82 s, aus
Wikipedia/Yahoo/thesportjournal hergeleitet), Formationen (Slot, Half-Wall, Points, Box+1,
Forecheck 1-2-2), Torwart-Grundregeln (Base Depth, quadratisch zum Puck), die Verteilung
gehaltener gegen abgeprallter Schüsse (29 % festgehalten — hockey-graphs), und die
Merkmalsstruktur der offenen xG-Modelle (Distanz vor Winkel vor Schusstyp).

### 4.1 Die Fragen, die man an JEDE Sportart stellt

| Nr. | Frage | Warum sie zählt | Hockey-Antwort (belegt) |
|---|---|---|---|
| 1 | **Wie viele wertende Ereignisse hat ein Wettkampf, und wie viele davon fallen auf einen Teilnehmer?** | bestimmt den Deckel (3.4) — vor allem anderen | ~55 Versuche, ~29 aufs Tor, ~3 Tore je Team; 0,7 Tore je Feldspieler |
| 2 | **Welche Größen sind von Spiel zu Spiel verlässlich, welche sind Lotterie?** | daraus wird das Impact-Maß gebaut, nicht aus dem, was im Fernsehen gezeigt wird | lose Pucks 0,89, Schüsse 0,56, Tore 0,30 |
| 3 | **Welche Quoten gelten real** (Erfolg je Versuch, je Zone, je Rolle)? | die Kalibrierung geht über Quoten, nicht über Summen — die Arena spielt kein 60-Minuten-Spiel (Hockey-Plan D.3) | 9,1-12,6 % je Team, Fangquote .900; nach Distanz 21 % ≤10 ft … 3,4 % jenseits 59 ft |
| 4 | **Was ist die Ergebnis-Größenordnung, und wie viel „mehr als real" will Chris?** | die Hausnorm ist offen: Basketball liefert ~39 % eines echten Spiels, Hockey lag bei 221 % (Torwart-Plan Teil 2) | 3,5 Tore je Team = real +17 % („ein paar mehr", entschieden) |
| 5 | **Welche Sonderrollen gibt es, und wie viele Spieler je Seite braucht die Regel?** | Kadergröße wird je Saison auf 2..6 gewürfelt; jede Sonderrolle braucht eine Degradationsregel | Torwart ab 3, keiner bei 2; 6 = 5+1 trifft das echte Spiel |
| 6 | **Wie sieht die Grundformation aus, wo steht wer im Angriff und in der Abwehr?** | Basketballs Radien (150 px) stellten die ganze Hockey-Mannschaft in den Torraum (SLOTS-Kommentar :4560-4568) | Netfront 78, Half-Wall 165, Points 295 px |
| 7 | **Wie lange dauert eine Aktion** (Schuss, Versuch, Wechsel)? | für Standphasen, Budget in `lauf()` (+60 s Reserve) und die Zuschauzeit | Schlagschuss 0,82 s; Bully ~4 s; bei 4,5 Toren ~27 % Standphasen |
| 8 | **Was unterbricht das Spiel, und was davon will man sehen?** | Standphasen sind Erzählung, aber jede hält die Uhr | Bully nach Tor und Festhalten; Abseits/Icing bewusst nicht |
| 9 | **Welche Regeln erzeugen Zielkonflikte?** | eine Mechanik, die Stärke und Risiko aus einer Zahl macht, ist die interessanteste | härter checken = mehr Pucks und mehr Strafen (Plan B.5) |
| 10 | **Welche Attribute bepreist die Matrix mit null?** | kein Sub-Skill darf sie lesen (Hockey: intelligence, charisma) | `official-discipline-weights.ts`, Hockey-Spalte |
| 11 | **Welche Slot-Rollen gibt es schon, und decken sie die Sonderrollen?** | Hockey hatte sechs Rollen ohne Torwart | `matchday-slot-roles.ts:169-180` |
| 12 | **Gibt es offene Modelle oder Datensätze — und unter welcher Lizenz?** | Zahlen und Struktur ja, Code nein | fünf xG-Repos, eines GPL-3.0, vier ohne Lizenz (Recherche §8.3) |

### 4.2 Welche Quellen getragen haben, welche nicht

**Getragen** (Torwart-Recherche, Tabelle „Abgerufen"; Hockey-Plan „Quellen"):
NHL.com-Saisonberichte, StatMuse-Teamtabellen (per Websuche, nicht per Saisonabfrage),
ESPN-Analysen, hockey-graphs.com, nhlspecialteams.com, expectedbuffalo.com,
Trainer-Seiten für Formationen (thecoachessite, hockeyshare, usahockeygoaltending),
Wikipedia-Ligatabellen **selbst aufsummiert** (DEL 2024/25: 2197 Tore / 364 Spiele = 3,02
je Team), und `git clone --depth 1` der xG-Repos über den Proxy.

**Nicht getragen:** hockey-reference (HTTP 403), StatMuse-Saisonabfragen (422),
`api.github.com` (im Proxy gesperrt), `gh` (nicht installiert), ein Repo unter dem
genannten Namen nicht mehr vorhanden (RentoSaijo/NHLxG, 404), EA NHL (proprietär, keine
Formeln). Zahlen „aus dem Gedächtnis" (1980er-NHL ~8 Tore, Empty-Net 40-50 %) stehen in
der Recherche ausdrücklich als solche und **nicht** im Code.

**Die Lizenzregel** (Recherche §8.3): kein Code, kein trainiertes Modell, keine Grafik aus
fremden Repos — nur Merkmalsstruktur und abgeleitete Größenordnungen, mit Quellenangabe
im Code-Kommentar. Gilt bei GPL-3.0 genauso wie bei „keine Lizenzdatei".

**Die Kennzeichnungsregel** (Übergabe, „Die eiserne Regel"; Hockey-Plan F.7): jede Zahl
ohne Quelle heißt im Code `PLATZHALTER` oder `GESETZT`, mit dem Grund daneben. Hockey hat
genau eine solche bewusst gesetzte Zahl behalten (Anteil der Fehlschüsse mit eigenem
Nachschuss — keine NHL-Referenz gefunden).

### 4.3 Für Gewichtheben: was zu suchen wäre

Alles unten sind **Fragen**, keine Antworten — im Repo steht dazu keine Zahl, und ich habe
keine recherchiert.

1. **Wertungssystem.** Welche Übungen zählen (Reißen, Stoßen, Zweikampf-Summe), und
   welche Zahl ist das „Ergebnis" — die beste gültige Last je Übung, die Summe, oder eine
   Relativwertung? Das entscheidet `wert()` (heute: Summe von drei Jury-Punktzahlen, eine
   Vorstellung, die dem Sport nicht entspricht).
2. **Versuchszahlen.** Wie viele Versuche je Übung und Athlet, wie viele insgesamt je
   Wettkampf — und daraus: wie viele **wertende Ereignisse** ein Arena-Spiel hervorbringen
   könnte (heute 3 je Kopf, Deckel 0,66). Ob eine Arena-Partie mehrere Übungen oder mehr
   Versuche fährt, ist Chris' Entscheidung (Teil 7).
3. **Gelingensquoten je Versuch.** Wie oft gelingt der erste, zweite, dritte Versuch real
   — getrennt, weil die Steigerung die Quote drückt. Das ist das Gegenstück zu Hockeys
   Schussquote und der Anker für `erfolg`.
4. **Steigerungsschritte.** Welche Mindeststeigerung das Regelwerk vorschreibt, wie groß
   die üblichen Sprünge zwischen den Versuchen sind, und wie Athleten die Anfangslast
   wählen — daraus wird die einzige echte **Taktik** der Disziplin (sicher öffnen gegen
   hoch öffnen), also das, was heute WAGNIS heißen soll und mechanisch fast nichts trägt.
5. **Relativwertung / Sinclair-Koeffizient.** Ob und wie Körpergewicht in die Wertung
   eingeht — für uns relevant, weil das Spiel eine `groesse`-Angabe je Spieler führt
   (`engine.js:7961`, Zeichen-Angabe) und Chris entscheiden muss, ob Größe/Statur im
   Gewichtheben zählen darf.
6. **Dauer eines Versuchs und die Phasen** (Ansatz, Zug, Umsetzen, Ausstoßen, Halten bis
   zum Kampfrichterzeichen) — für den Bewegungsablauf nach dem Muster von
   `HOCKEY_SCHUSS`/`hockeySchussPhase` (#739) und für die Rundendauer.
7. **Woran Versuche scheitern** (Anteil gerissen, nicht ausgestoßen, Kampfrichter-
   entscheid) — für Feed-Texte und dafür, ob ein Fehlversuch immer 0 ist (`failAbzug:0`)
   oder ob es sichtbare Abstufungen gibt.
8. **Pausen und Reihenfolge** (Aufrufreihenfolge nach angemeldeter Last, Wechsel zwischen
   Athleten) — die Bühne fährt heute „Durchgang 1 für alle, dann Durchgang 2"; ob das
   dem Sport entspricht, ist zu prüfen.
9. **Was Publikum real bewirkt** — die Matrix gibt charisma 23 von 100; die Erzählung
   „das Publikum trägt durch den Grenzversuch" (`BUEHNE_ART`-Kommentar :7795-7797) ist
   bisher eine Setzung ohne Quelle.

Erst wenn 1-3 beantwortet sind, lässt sich sagen, ob Gewichtheben im Bühne-Chassis mit
einer eigenen Erfolgsformel bleibt oder eine eigene Struktur braucht (mehrere Übungen,
Laststeigerung als Zustand). Das ist die Entscheidung, die vor jeder Sondierung fällt.

---

## 5. Welcher Code IMMER angefasst werden muss

Eine neue Disziplin existiert bereits in beiden Welten (alle 20 sind angelegt). Was folgt,
ist die Liste der Stellen, an denen sich ihre **Ausprägung** anmeldet — mit dem, was
passiert, wenn man eine vergisst.

### 5.1 Produktionsseite (`lib/`, `tests/`)

| Stelle | Was dort steht | Wenn vergessen |
|---|---|---|
| `lib/data/dataAdapter.ts:54-75` | Katalog: `id`, `category` (Saison!), `playerCount` | die Disziplin existiert nicht in der Saison |
| `lib/player-generator/official-discipline-weights.ts` | die Matrix (transponiert: nach Attribut geschlüsselt, `generiere-arena-daten.ts:60-66`) | leere Matrix, lautlos: „zwanzig leere Matrizen, weil eine leere Zeile kein Fehler ist" |
| `lib/lineups/matchday-slot-roles.ts:96 ff.` `DISCIPLINE_ROLE_THEMES` | die Slot-Themen; **Reihenfolge ist Bedeutungsträger** (`slice(0, slotCount)`, :629); Sonderrolle mit eigenem Deckel wie `goaltender` (:442-545) | Sonderrolle nicht wählbar; bei falscher Position fehlt sie bei kleinen Kadern |
| `scripts/pruefe-slot-invariante.ts` | ≤ 0,2 Pp über 20 × 6 | Aufstellungsprofile ergeben nicht mehr die Matrix |
| `scripts/generiere-arena-daten.ts --schreiben` | erzeugt `BASIS_JE_DISC`/`SLOTS_JE_DISC` im Motor | **stille Wirkungslosigkeit**: PR #738 — der Adapter schickte `slot:"goaltender"`, `SLOTVON["goaltender"]` war undefined, `slotAufschlag` gab 0 zurück; der Slot existierte im Aufstellungsbildschirm und wirkte im Spiel nicht (nur eine Konsolenmeldung) |
| `lib/foundation/battle-arena/arena-aufstellung-adapter.ts`, `resolveSlotRoleShortId` (:865) | das Rohr Aufstellung → Arena, lange Kennung `hockey-6-powerforward` → kurz | Rohr leer, lautlos (PR #736: 0 von 480 Einträgen kamen an, der Motor sah gesund aus) |
| `lib/resolve/battle-mode-arena-team-points.ts:32` `ARENA_RESOLVED_DISCIPLINE_IDS` und `:177` `runImpl(…, "basketball", …)` | welche Disziplin im Battle-Mode-Save über die Arena aufgelöst wird — **heute hart Basketball** | Review Befund 1: die zweite Disziplin bekäme das Basketball-Ergebnis als Team-Punkte; Override-Map je Spieltag statt je Disziplin (`legacy-matchday-resolve-engine.ts:713-716`) |
| `tests/battle-mode-arena-team-points.test.ts:133`, `tests/arena-headless-runner.test.ts:113,155-235` | pinnen `"basketball"` | jede Produktivierung muss sie parametrisieren |
| `app/foundation/discipline-stage/DisciplineStageArena.tsx:133,293,505`, `app/dev-arena/page.tsx:32` | Motiv, Slot-Namen, Umgebung je Disziplin | Asset-Teil |

### 5.2 Mockup-Seite (`public/mockups/`)

| Stelle | Was dort steht | Wenn vergessen |
|---|---|---|
| `DISCS` (:2590) | `cat` und `size` | keine Motor-Zuordnung |
| die Chassis-Tabelle (`BUEHNE_ART` :7790 für Gewichtheben) | Mechanik-Parameter, Wörter, Rezept-Rückfall | `rezeptAus` wirft laut — der gute Fall |
| `battle-mode.rezepte.js` | das Rezept **mit** Messhistorie | `scripts/sondiere-feldspiel-subskills.mjs` liest Sub-Skills **nur aus dieser Datei** (Regex auf `\n  <id>:{`, `hockey-balance`) — für Gewichtheben heute: „Kein Rezept fuer gewichtheben in battle-mode.rezepte.js" |
| `scripts/baue-feldspiel-rezept.mjs` `MATRIX`/`ERLAUBT` | die Semantik „wo darf ein Attribut hin" — **hart nur für hockey** eingetragen | Skript wirft `Keine Matrix/Erlaubt-Tabelle` |
| `MOTOREN[…].wert` bzw. `feldspielWert` (:4773) | **die Impact-Formel je Disziplin** | die der Geschwister gilt weiter: ein Check war 1,5 Tore wert (Review Befund 2); jede Sondierung misst dann die Gutschriftsregel statt der Mechanik |
| `ZEIT_DEHNUNG` (:12597) | Zuschauzeit | Faktor 1 |
| `WERTUNG_KOPF` (:10946) | nur `kampf` und `feldspiel`; Bühne zeigt heute die Kampf-Spalten um | Boxscore-Spalten der Sonderrolle (Saves, Fangquote) fehlen — Recherche 4.7 |
| `feldspielProbe` (:14255), `live`-Block in `FELDSPIEL_ART` | die Sonde; Spieldauer je Disziplin | für Vorab-Disziplinen liefert sie `live:false` + `fehlend`-Liste (nicht Nullen) |
| `FORMATION()`/`SLOTS_HOCKEY` (:4552-4583), `UNTERZAHL_PLAETZE` (:4672) | Formation und Unterzahl-Tabelle je Disziplin | Basketballs Radien; Unterzahl-Gating gegen Tabellenlänge statt `jeSeite` (Overseer-Fund #737) |
| `bodenFeldspiel` (:7369), `zeichneFeldspiel` (:7586) | Feld | neutraler Platz — Asset-Teil |
| `MOTOREN[fd].lauf` Budget (:14025-14030) | Spieldauer + 60 s Reserve für Standphasen | Standphasen fressen die Reserve; foulstarke Builds brechen ihr Spiel früher ab (Opus-Fund 30.08.) |
| `spieldauerVon`, `ZEIT_DEHNUNG`-Kommentar | 240 s Hockey, 360 s Basketball | Sonde mit falscher Dauer |

### 5.3 Zwei Tabellen derselben Daten — die Falle hinter mehreren dieser Zeilen

Dreimal ist dasselbe passiert: zwei Stellen führten dieselben Daten, eine lief weg.
`SLOTS_JE_DISC` im Motor gegen `matchday-slot-roles.ts` (PR #738, Torwart still
wirkungslos); `B_FIGUR` gegen `BAU` (PR #717 — Kader-Karte zeigte einen anderen Charakter
als die Arena, ersatzlos gestrichen); Basketballs Wertformel an **zwei** Stellen
(`MOTOREN[fd].wert` und die Sonde) bis `feldspielWert` sie in eine zog (:4763-4766). Regel:
**eine Quelle, ein Generator, ein Test, der die Kopie gegen die Quelle hält**
(`tests/battle-arena-ein-modell-ueberall.test.ts` ist die Vorlage dafür).

---

## 6. Die Fallen, die uns wirklich erwischt haben

Nicht theoretisch. Jede Zeile hat einen PR oder Commit.

| Nr. | Falle | Was wirklich passiert ist | Regel daraus |
|---|---|---|---|
| 1 | **Gegen einen veralteten Checkout gemessen** | `messe-arena-einfluss.mjs:44` trug den Pfad zum Mockup als absolutes Literal auf den Haupt-Checkout. In einem Worktree maß es klaglos die falsche Datei — dort 402 Zeilen älter (13.208 gegen 13.610 Zeilen). Nachweis: TEAMGEIST-Zeile absichtlich verstellt, Worktree 94,6 Pp, Haupt-Checkout 51,0 — vor der Reparatur hätten beide 51,0 gemeldet. | PR #729: relativ auflösen, **die gemessene Datei steht in der Ausgabe**. Wer eine Zahl zitiert, nennt die Datei. |
| 2 | **Die Sonde sah nur ein Viertel der Schüsse** | Gehaltene, abgeprallte, geblockte Hockey-Schüsse wurden als `block` protokolliert; die Sonde zählte nur `treffer`/`fehlwurf`. Von 51 Schüssen je Spiel sah sie 12,4 und meldete 55 % Trefferquote je Distanzstufe — „nicht auf null, sondern auf falsch". | `wurf:true` an den drei Ausgängen (`hockey-balance`, `99b78fce`). Jede neue Ereignisart durch die Sonde prüfen: **Summe der Sondenereignisse gegen das Protokoll**. |
| 3 | **Ein Tick-Deckel aus einer alten Spieldauer** | `guard<20000` (333 s) aus der Zeit vor den vier Vierteln (360 s) stand in `spieleBasketball` **und** in der Rangtreue-Sonde: 12 von 12 Spielen abgeschnitten, Uhr bei 306,9-330,3 s. Jede Rangtreue vor #731 an abgeschnittenen Spielen. | Deckel aus der Dauer ableiten (+60 s), nie als zweite Zahl pflegen. Verschiebung gemessen: rho 0,793 → 0,798, FGA 72,9 → 82,0. |
| 4 | **Eine Wertformel für alle Disziplinen** | Basketballs Box-Score galt für jedes Feldspiel: Tor 1,0, Check/Save 1,5. ABWEHRs 36 % in der Hockey-Sondierung waren zur Hälfte Gutschriftsregel. | `feldspielWert` je Disziplin (#739), **vor** jeder Sondierung. |
| 5 | **Die Abnahme lief am Beispielkader, nicht am Spielstand** | PR #736: `activePlayerId` ist die Id der Kader-Zeile, nicht des Spielers; im Beispielkader ist sie null — dort kam alles an. Am echten Export (2984 Spieler, 64 Aufstellungen) kamen 0 von 480 an, lautlos. | Rohr-Abnahmen am echten Spielstand (`live-save`-Abbild) fahren. |
| 6 | **Eine Sonderrolle im Team-Array** | Der Torwart in `FSTEAM` mit zwei Filtern: 282 von 1147 Pässen gingen zu ihm, 121 Abpraller (44 %), 26 Bodychecks, 19 s je Spiel als Ausbrecher. 23 `FSTEAM[…]`-Zugriffe, 10 Ganzteam-Schleifen, 8 Mitspieler-Filter — Aufwandsschätzung „sechs Stellen" um Faktor vier daneben. | Sonderrollen aus allen Losen heraus (`zuordneDeckung`, Fastbreak, `offensterMitspieler`, `passeAb`, `naheVerteidiger`); der Schiri-Kommentar (`fsSchiri`, „darf in keiner der Spieler-Schleifen auftauchen", zitiert in Torwart-Plan 3.2b) verbietet `if(u.torwart)continue;` an zwanzig Stellen. |
| 7 | **Ein Kommentar behauptete das Gegenteil der Recherche** | `HK_ABPRALLER` 0,42 mit „real prallen rund vier von zehn zurück" — die Quelle sagt 29 % festgehalten. Folge: 31 Zonen-Bullys je Spiel, alle sechs Sekunden eines. | Jede Zahl mit ihrer Quelle daneben; der Overseer liest die Quelle nach, nicht den Kommentar. |
| 8 | **Der Maßstab selbst war falsch** (Kampf) | `leistungVon` teilte durch die Eignung, die `aufEignung` gerade proportional macht — Kurzschluss, monatelang 90-160 Pp egal welches Rezept. Battlefield: 158,9 Pp mit `leistungVon`, 12,0 mit „Anteil am Gesamtbeitrag" (`MOTOREN`-Kommentar :13866-13925). | Erst prüfen, ob `wert()` den Kanal misst, den die Matrix beschreibt. |
| 9 | **Normierungsbonus erster Ordnung** (Kampf) | `aufEignung()` normiert LP/ANG/VER, nicht TMP/AUS — ein Attribut dort kauft Einfluss ohne Matrixpreis (Battlefield 110 Pp, Fechten je eine verworfene Runde). Die Kappung senkte die Zahl auf 83,7 und machte den Kampf schlechter (23 von 24 6:0). | Multi-Diszi-Plan §0.5: ins Runbook, nicht je Rezept neu entdecken. Messzahl und Spielqualität getrennt beurteilen. |
| 10 | **Slot-Kanal ist ein Rangwechsel** | Sortieren nach der *Differenz* SCHUSS_NAH−SCHUSS_FERN: beide Werte fielen auf 0,0 %, Abweichung 37,2 → 78,0 Pp (`zuordneSlots`-Kommentar :4590-4600). power musste in SCHUSS_NAH **führen**, sonst las es 0,0-1,8 % statt 7. | Wo die Mechanik über einen Rang entscheidet, muss die Attributanhebung den Rang überhaupt kippen können. |
| 11 | **Sub-Skills, die nichts lesen** | AUSDAUER in der Basketball-Live-Engine (kein Aufruf liest `u.AUSDAUER`); TECHNIK fast null (Gate immer über der Schwelle); Basketballs SCHUSS_FERN 1,2 %. | Sondierung vor dem Rezept; ein toter Sub-Skill ist ein Motorbefund, kein Rezeptfehler (`baue-feldspiel-rezept.mjs`: Mindestanteil 1,0 und berichten). |
| 12 | **Unterzahl kaufte sich die besten Plätze** | Ein Einzelspieler holte 54,1 Punkte, sechs zusammen 37,9 (#737): Slots von vorn gefüllt, überzählige Decker ohne Mann, nur der erste Decker durfte stehlen, Steal-Chance las die Traube nicht. Erste Reparatur gated gegen `SLOTS.length` statt `jeSeite` — ein volles 4v4 galt als Unterzahl. | Jede Mechanik gegen die **nominelle** Feldgröße gaten; Kurve mit Standardfehler messen (`miss-unterzahl-kurve.mjs`). |
| 13 | **Zu früh sondiert, dreimal** | Teil 2.2. | Struktur → Impact → Sondierung → Rezept. |
| 14 | **`place[n]` ist eine Zuweisung, kein Zusammenfügen** | Das Einspielen der echten Aufstellung stand vor der Beispiel-Tafel; von sechs gesetzten Spielern kam einer an. | Reihenfolge der Initialisierung messen, nicht annehmen. |
| 15 | **`eig` ohne Disziplinwert** | Chris' Fund vom 25.08. (p.d nur tdm/spurt) ist nur im Feldspiel repariert (:4329-4334). Bühne/Kampf/Bahn lesen `(p.d[d]||0)` — meine Gewichtheben-Eignungen lasen −4,6 bis 8,0. | Vor jeder Rangtreue-Messung an einer Nicht-Feldspiel-Disziplin: Fallback nachziehen oder echten Kader laden. |
| 16 | **Die Pp-Metrik ist nicht monoton** | 3.2 — Attribut ≤ 0 liest 0,0 %; zwei identische dexterity-Verteilungen 7,2 % und 1,1 %. | Nach jedem Punkt messen; Fassung behalten, in der alle Attribute positiv lesen. |
| 17 | **Bedingte `rr()`-Aufrufe verschieben die Zufallsfolge** | Jeder zusätzliche bedingte Wurf verschiebt die Folge zwischen Basis- und Hebungslauf von `einflussVon` (50-65-Pp-Plateau als Messartefakt, Kommentar :3927; Recherche §7.3). | Neue Ausgänge mit **fester** Zahl `rr()`-Aufrufe je Ereignis würfeln. |
| 18 | **Bühne-Rangtreue hat keine Sonde** | 1.3. | Vor Gewichtheben bauen (NBA2K-Plan §7). |

---

## 7. Die Vorlage: Schritte, Abnahme je Schritt, wer entscheidet

Nach dem Muster des Hockey-Plans (H.8, Torwart-Plan Teil 5): jeder Schritt einzeln
abnehmbar, `main` nach jedem deploybar, sechs von dreizehn Hockey-Schritten änderten kein
Spielverhalten. Für Gewichtheben ausgefüllt, wo es heute schon geht.

| # | Schritt | Abnahme | Chris entscheidet | Agent entscheidet |
|---|---|---|---|---|
| 0 | **Bestandsaufnahme** — Chassis aus `DISCS`, Pp bei n=48, Ereigniszahl je Kopf, Test-Retest, `feldspielProbe`/Sonde vorhanden?, Rezept in `rezepte.js`? | ein Bericht wie Teil 1.3 mit gemessener Datei in jeder Zahl | — | alles |
| 1 | **Recherche** nach 4.1/4.3, mit Quellen und Lizenzen | jede Zahl mit Quelle oder als „gesetzt" markiert; Frage 1-3 beantwortet | **welche reale Ergebnisgrößenordnung** er will („ein paar mehr", wie bei 3,5 Toren) | Quellenwahl, Lizenzurteil |
| 2 | **Struktur-Entscheidung** — bleibt die Disziplin im Chassis (eigene Erfolgsformel genügt) oder braucht sie neue Mechanik (mehr Ereignisse, Sonderrolle, Zustand wie Laststeigerung)? Für Gewichtheben: wie viele Versuche/Übungen fährt eine Arena-Partie, damit der Deckel über 0,80 kommt? | Deckel-Rechnung: Test-Retest ≥ 0,64 (Wurzel 0,80) plausibel erreichbar | **Spieldauer/Umfang** (bei Hockey: 3×1:20), **Sonderrollen** (Torwart ab 3), Zuschauer-Eingriffe | Bauform (Objekt außerhalb des Teams wie `fsTorwart`, Datenform für Formationen) |
| 3 | **Werkzeuge vor Code** — Sonde für das Chassis (Bühne: rho aus `wert()`+`eig`), `eig`-Fallback in `bauBuehne`, Rezept nach `rezepte.js` umziehen, `baue-feldspiel-rezept.mjs` um `MATRIX`/`ERLAUBT` der Disziplin ergänzen | Umzug byte-identisch (`spiele(dId, 1337/4242/99991)`-Protokoll vorher/nachher, wie #726/#734); Sonde meldet Fehlstellen statt Nullen | — | alles |
| 4 | **Struktur bauen, mit Platzhalterzahlen** — Mechanik, Sonderrolle, Boxscore-Spalten, **Impact-Formel je Disziplin**, Formation, Standphasen, Feld (Asset-Teil) | Sonde liefert **keine** `fehlend`-Liste; jede Kadergröße 2..6 startet; Geschwister bit-identisch (Sondenausgabe 6v6/4v4/2v2); Tests grün | Slot-Profile **vorher als Tabelle** sehen, wenn Produktionsdaten sich ändern (#738) | Platzhalterzahlen, als solche markiert |
| 5 | **Korridor kalibrieren** gegen die Referenz aus Schritt 1 (Quoten, nicht Summen) | eigenes Korridor-Skript wie `miss-hockey-korridor.mjs` (n ≥ 32) | die Zielzahl (Chris' 3,5) | wie sie erreicht wird (Tempo-Garantie vor Quote — Recherche 3.3) |
| 6 | **Sondierung**, n ≥ 24, zwei Läufe mit gedrehter Zuordnung (`--versatz`) müssen dieselbe Rangfolge liefern | Rangfolge stabil; tote Sub-Skills berichtet | — | ob ein toter Sub-Skill ein Motorbefund ist (zurück zu 4) |
| 7 | **Rezept** nach der Budget-Methode (`baue-feldspiel-rezept.mjs`, Sinkhorn) | Pp ≤ 25 in zwei Stichproben, ≤ 15 in einer; alle Attribute lesen positiv | Semantik der `ERLAUBT`-Tabelle („power hat in PARADE nichts zu suchen") | die Zahlen |
| 8 | **Rangtreue und Rollenproben**, nach Rolle getrennt | rho(Seite) > 0,80 je Spiel; Sonderrolle separat (`miss-rangtreue-nach-rolle.mjs`); Anker wie `HK_TW_BASIS` nachgezogen | ob ein Deckel unter 0,80 hingenommen wird oder zurück zu Schritt 2 | Impact-Maß aus den verlässlichen Größen |
| 9 | **Archetypen-Demo** — vier Extrem-Builds, je 300+ Spiele | jeder führt in seiner Kategorie | welche Archetypen es geben soll („Stars müssen Stars sein") | Kennzahlen je Archetyp |
| 10 | **Sichtprüfung** im Browser (`scripts/zeige-feldspiel-arena.mjs <diszi> /tmp 6 14 22 34 48`) | Formation, Requisiten, Feed-Texte lesen sich wie der Sport; kein Seitenfehler | Abnahme des Bewegungseindrucks | — |
| 11 | **Produktivierung** — Orchestrator je Disziplin, Override-Map je Disziplin, Tests parametrisiert, Server-Budget bei zwei Arena-Disziplinen je Spieltag | ein Test löst einen Spieltag mit zwei Arena-Disziplinen auf, jede Seite bekommt ihr eigenes Ergebnis (`resolutionSource:"arena"`) | Unentschieden-Regel (Hockey: zulassen) | — |
| 12 | **Nachtrag in die Docs** — Rezept-Kommentar trägt die Messhistorie, Plan trägt „was nicht geprüft wurde" | ein Agent in einem halben Jahr findet die Zahlen und ihre Datei | — | — |

Zwei Regeln quer zu allen Schritten: **eine Kopie, ein Faktor, vergleichen** (NBA2K-Plan
§5: Vorher-Kopie mit `scripts/baue-battle-artefakt.mjs` einfrieren, nie zwei Eingriffe
gleichzeitig), und **Overseer-Review vor dem Merge** — jeder Hockey-Schritt hat durch den
Gegenleser mindestens einen Fund bekommen, der die Zahl geändert hätte (#730, #735, #736,
#737, `hockey-balance`).

---

## 8. Offene Fragen — nicht behauptet, weil nicht belegt

1. **Ob Gewichtheben im Bühne-Chassis bleiben kann.** Hängt an 4.3 Frage 1-3 und an der
   Deckel-Rechnung; heute 0,66 mit drei Ereignissen je Kopf.
2. **Wie der Overseer die Test-Retest-Zahlen für Basketball/Hockey genau gerechnet hat**
   (Paarung Spiel i / i+1? alle Paare?). Meine Gewichtheben-Zahl ist Pearson über
   aufeinanderfolgende Spiele; die Vergleichbarkeit ist plausibel, nicht bewiesen.
3. **Ob die Multi-Diszi-Welle 0** („alle 19 einmal durchmessen") je komplett gelaufen ist.
   Die Übergabe hat Zahlen bei n=12 (Bühne) und n=48 (Bahn); eine Tabelle aller 19 bei
   n=48 gegen den heutigen Stand habe ich nicht gefunden.
4. **Die Hausnorm „wie nah an real"** ist nicht entschieden (Basketball ~39 %, Hockey
   Ziel +17 %). Für jede neue Disziplin fällt sie neu — Chris' Frage in Schritt 1.
5. **Server-Laufzeit** bei mehreren Arena-Disziplinen je Spieltag (Review Befund 1,
   Recherche §10) — unverändert offen.
6. **Ob `CLAUDE.md`-Abschnitt und Plan-Abschnitt 1.3** von `hockey-balance` so auf `main`
   kommen; dieses Handbuch zitiert sie als Stand des Branches.
7. **Rangtreue der Live-Engine bei 2v2** (0,083 Basketball, n=12; 0,239 im NBA2K-Plan):
   strukturell ein Paarvergleich, keine Kurvenfrage — betrifft jede Disziplin mit
   Kadergröße 2.

---

## Anhang: die Werkzeuge auf einen Blick

| Skript | Frage | Chassis | Stand |
|---|---|---|---|
| `scripts/messe-arena-einfluss.mjs <diszi> [n] [pfad]` | Pp-Abweichung zur Matrix | alle 20 | `main` |
| `scripts/miss-feldspiel-rangtreue.mjs <diszi> [n] [größen] [pfad]` | rho je Spiel, Rollenproben V/S, Rebound-Achsen | Feldspiel | `main` (#732) |
| `scripts/miss-rangtreue-nach-rolle.mjs <diszi> [n] [saat]` | welche Rolle rho drückt | Feldspiel | `hockey-balance` |
| `scripts/sondiere-feldspiel-subskills.mjs <diszi> [n] [versatz]` | mechanisches Gewicht je Sub-Skill (orthogonal, Temp-Kopie) | alle mit Rezept in `rezepte.js` | `hockey-balance` |
| `scripts/baue-feldspiel-rezept.mjs <diszi> <sondierung.txt>` | Rezept aus Sondierung + Matrix (Sinkhorn) | nur hockey eingetragen | `hockey-balance` |
| `scripts/miss-arena-feldspiel-spiegel.mjs [n] [pfad]` | Seiten-Fairness | Feldspiel | `main` |
| `scripts/miss-hockey-korridor.mjs [n]` | Tore/Schüsse/Quoten gegen den Korridor | Hockey | `main` |
| `scripts/miss-hockey-bestand.mjs <diszi> [n]` | Endstände, Spreizung, Ereignisbilanz, Pp in einem Lauf | Feldspiel | `main` |
| `scripts/miss-unterzahl-kurve.mjs` | Punkte je gesetzter Spielerzahl, mit Standardfehler | Feldspiel | `main` |
| `scripts/zeige-feldspiel-arena.mjs <diszi> <ordner> <sek…>` | Bilder der laufenden Arena | Feldspiel | `main` |
| `scripts/pruefe-slot-invariante.ts` | Slot-Mittel = Matrix, 20 × 6 | alle | `main` |
| `scripts/generiere-arena-daten.ts [--schreiben]` | Matrizen + Slots in den Motor | alle | `main` |
| `scripts/baue-battle-artefakt.mjs <ziel.html>` | eingefrorene Vorher-Kopie | alle | `main` |
| `window.__arena.spiele(dId, saat)` | ein Spiel, ein Protokoll | alle 20 | `main` (#726) |

Laufzeitumgebung: Playwright mit `/opt/pw-browsers/chromium-1194`, aus dem
Repo-Wurzelverzeichnis starten (sonst findet Node `playwright` nicht). Der Netzproxy lässt
nur GitHub/npm durch; Websuche ging in den Recherche-Runden über das Websuche-Werkzeug,
nicht über `curl`.

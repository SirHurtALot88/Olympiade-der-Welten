# Mutator-Traits organisch im Spieltag — Konzept (29.09.)

Chris, wörtlich: „dass die 0,3 PPs die wir vergeben haben für passende Traits organisch in den
Spieltag übernommen werden, dass der Spieler in der Simulation etwas besser performt aber nicht zu
stark - ich würde da irgendwas sehen von 5-8% Verbesserung pro Trait der durch den Mutator getroffen
wird."

> **Stand nach der Umsetzung (29.09., später am Tag):** Chris hat die offenen Fragen beantwortet
> (Abschnitt 10), die Umsetzung weicht an drei Stellen bewusst vom Vorschlag unten ab: **Ersetzen
> statt Ergänzen** (V1, die 0,3 PP entfallen), **flacher Attributbonus statt Prozentfaktor**
> (+3,5 auf jedes der zwölf Attribute je Treffer) und **nur Battle-Modus, nur simulierte
> Disziplinen** (Manager-Modus unverändert). Was gebaut und gemessen ist, steht in Abschnitt 11.
> Die Abschnitte 1–9 bleiben als Herleitung stehen.

Dieses Dokument war **reines Konzept**: kein Produktionscode, keine Motoränderung. Was gemessen ist,
steht mit Datei/Zeile oder Messweg daneben. Was ein Vorschlag ist, ist als solcher markiert.
`engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main`, Commit `ebb3b99a`).

**Die drei Schranken gelten unverändert und werden hier nirgends zur Debatte gestellt:** die
Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) bleibt für alle zwanzig
Disziplinen unangetastet; rho je Einzelspiel > 0,80 (angestrebt 0,85); Pp-Abweichung ≤ 25. Der
Vorschlag unten ist so gebaut, dass er die Matrix gar nicht berührt: er skaliert nur, was die Matrix
ohnehin gewichtet, und zwar für alle diese Attribute gleich.

---

## Kurzfassung

- **Die Arena-Engine ist nur im Battle-Modus und nur für 15 der 20 Disziplinen die
  simulationsbestimmende Instanz.** Sie läuft dann serverseitig headless über Playwright
  (`lib/battle/arena-headless-runner.ts`) und liefert das Teamergebnis 2/1/0 sowie die individuellen
  Spieler-PP aus dem Boxscore. Im Manager-Modus, und im Battle-Modus für TDM, Mini-DM, Battlefield,
  Football und I-Spy, gibt es **keine Simulation**. Dort entscheidet das aggregierte Score-Modell
  (`lib/lineups/legacy-score-engine.ts`, „PPS-Pfad").
- **Heute sieht keine produktive Simulation die Mutatoren.** Die Arena-Brücke übergibt nur Kader und
  Aufstellung (`{d, slot}`), keine Mutatoren. Feldspiel, Bühne und Bahn rechnen Traits gar nicht ein.
  Die einzige Stelle, an der Traits in eine Simulation eingehen, ist `baueEinheit` (Kampf-Chassis).
  Genau das Kampf-Chassis ist aber nicht produktiv geschaltet. Dazu kommt: die Engine zieht ihre
  Mutatoren selbst (1 aus POS + 1 aus NEG, feste Saat `20260823` → „Healthy"/„Renegade"), nicht den
  Spieltagswurf der Produktion (2 aus dem gemeinsamen 36er-Pool).
- **Folge für die arena-aufgelösten Disziplinen:** Der `+6`-Score-Bolt-on ändert dort heute keinen
  einzigen Punkt, weil Teampunkte und Spieler-PP aus der Arena kommen. Beim Spieler kommen nur die
  `+0,3` PP an. Chris' Gefühl, dass der Mutator „im Spiel" nicht spürbar ist, stimmt für diese 15
  Disziplinen also wörtlich.
- **Vorschlag, eine Formel für alle Pfade:** `F = 1 + m · h` mit `h ∈ {0,1,2}` Treffern und
  `m = 0,065` (Korridor 0,05–0,08).
  - **Arena:** `F` skaliert die **matrixgewichteten effektiven Attribute** und die **Eignung** des
    Spielers, und zwar in den vier Baufunktionen (`bauFeldspiel`, `bauBuehne`, `bauSpurt`,
    `baueEinheit`), auf beiden Seiten gleich.
  - **PPS-Pfad:** `F` ist ein Multiplikator in der Tageskette direkt nach der Moral, also dort, wo
    Ermüdung, Verletzung und Moral schon multiplikativ wirken.
- **Verrechnung, Empfehlung:** Der organische Kanal **ersetzt den `+6`-Bolt-on vollständig**, denn
  beide sind derselbe Kanal (Score/Leistung). Nebeneinander wären sie die eigentliche Doppelbuchung.
  Die **`+0,3` PP bleiben** als eigene, sichtbare Saisonwährung. Das ist eine Wertungsfrage, die
  Chris entscheiden muss (Abschnitt 8, Frage 1). „übernommen" kann auch „ersetzen" heißen. Dann
  sinkt der PP-Wert eines Treffers um rund drei Viertel (gemessen, Abschnitt 1.5).
- **Pp:** Ein **gleichförmiger** Faktor auf alle matrixgewichteten Attribute verschiebt keine
  Attributanteile und ist damit Pp-neutral. `einflussVon()` zieht keine Mutatoren: sie bleiben über
  Grund- und Hebungslauf konstant. Die Messung ist damit heute sauber gepaart, aber nicht
  spielnah. Protokoll in Abschnitt 6.
- **rho:** Geschätzte Wirkung −0,001 bis −0,003 je Spiel (Stilmodell, Abschnitt 7.1), also unter dem
  Kaderrauschen. Risiko besteht nur bei den knappen Disziplinen (Climbing 0,814, Tennis 0,821,
  Fechten 0,825, Breaking 0,833). Die Validierung ist ein gepaarter Vorher/Nachher-Lauf von
  `miss-alle-disziplinen.mjs` mit je Spiel gezogenen Mutatoren (Abschnitt 7.2).

---

## 1. Ist-Zustand (gegengelesen, mit Fundstellen)

### 1.1 Die Ziehung (Produktion)

- Kandidaten: `POSITIVE_MUTATOR_TRAITS` (18) und `NEGATIVE_MUTATOR_TRAITS` (18),
  `lib/lineups/legacy-lineup-modifiers.ts:30–70`. Sie werden in `getLegacyMutatorTraitOptions()`
  (`:251–264`) zu **einem** 36er-Pool zusammengefasst.
- `rollMatchdayMutatorTraitsForSide()` (`:345–374`) zieht **zwei verschiedene Traits aus diesem
  gemeinsamen Pool**, per Hash aus `saveId::seasonId::matchdayId::side::disciplineId`. Es gibt also
  keine feste Aufteilung „einer positiv, einer negativ". Der Wurf gilt für alle 32 Teams gleich.
  `buildMatchdayMutatorTraitsBySide()` (`:376–399`) liefert d1 und d2.
- Gezählt wird über `countTraitHits()` (`:909–915`): alle positiven und negativen Traits des
  Spielers (`getPlayerMutatorTraitSlots`, `:274–281`), normalisiert (klein geschrieben,
  dedupliziert). **Auch ein „negativer" Trait zählt als Bonus.** Das hat Chris am 23.08.
  entschieden, zitiert in `engine.js:5508–5518`: „renegade ist n mutator wie jeder andere und bringt
  6 score punkte und 0,3 PPs das bleibt auch weiter so".

### 1.2 Die Wirkung im PPS-Pfad

`calculateMutatorModifierForSide()` (`legacy-lineup-modifiers.ts:917–1059`) schreibt je
eingesetztem Spieler `playerMutatorBonuses = hits·6` und `playerMutatorPpsBonuses = hits·0,3`
(`:991–992`). Aufgerufen wird es im Resolve (`lib/resolve/legacy-matchday-resolve-engine.ts:493–513`)
mit dem Spieltagswurf (`:347–353`).

Die Reihenfolge in `scoreLegacyLineupDisciplineSide()` (`lib/lineups/legacy-score-engine.ts`)
entscheidet, was „organisch" im PPS-Pfad heißen kann:

| Schritt | Art | Zeilen |
|---|---|---|
| Basiswert `disciplineScores` (ligaweit rangnormiert, 1–100) | Eingang | 258–259 |
| × Ermüdung → × Verletzung → × Moral | **multiplikativ, je Spieler** | 264–281 |
| Kapitän +50 % auf den bis dahin fertigen Spielerwert | multiplikativ | 335–356 |
| **Mutator `+hits·6`** | **additiv, flach** | 358–367 |
| Formkarte je Spieler (+ Jitter) | additiv | 377–392 |
| Intensität, Slot-Rolle, Mutator-Rest | additiv, Seite | 404–417 |
| Team-Power in % auf den Seiten-Score | multiplikativ, Seite | 418–438 |

Der Seiten-Score bestimmt den Rang, der Rang über `getRankToPointsValue()` die Teampunkte. Diese
werden nach Score-Anteil auf die Spieler verteilt (`distributeRankPointsToPlayers()`,
`legacy-matchday-resolve-engine.ts:800–809`).

### 1.3 Die Wirkung in der Saisonwährung

Die gebuchten PP sind `basePoints + mutatorPpsBonus`
(`lib/foundation/season-points-ledger.ts:313–317`,
`lib/foundation/player-points-total.ts:29–35`). Die Team-Tabelle ist die Summe dieser Spieler-PP
(`season-points-ledger.ts:426–437`). Die 0,3 sind also echte Tabellenpunkte außerhalb des
rangbasierten Topfs. Die Abstimmung zieht sie vorher ab (`:475`).

### 1.4 Die Engine (`battle-mode.engine.js`)

- Eigene Listen und **eigene Ziehung**: `zieheMutatoren(saat)` zieht **1 aus POS + 1 aus NEG**
  (`:5503–5506`), nicht 2 aus 36. Beim Laden läuft `zieheMutatoren(20260823)` (`:33632`), das ergibt
  nachgerechnet **Healthy + Renegade**. Neu gezogen wird nur in den Mockup-Serien (`serieVon`,
  `:33667`), nicht in `einflussVon()`, nicht in `disziplinProbe` und nicht in den produktiven
  Einstiegen `spieleFeldspiel`/`spieleBuehne*`/`spieleBahn` (`:35014ff.`, `:35237ff.`).
- `traitTreffer(p)` (`:5519–5523`): `netto = (pos+neg)·6`. Das Vorzeichen ist seit dem 23.08. korrigiert.
- **Wo der Trait in die Simulation eingeht, je Baufunktion:**

  | Chassis | Baufunktion | Trait in Simulation? |
  |---|---|---|
  | Kampf (TDM, Mini-DM, Battlefield) | `baueEinheit`, `:22729–22748` | **ja**: `tr.netto` in `engPunkte` (`:22733`), damit in `eigWert` und über `mitAufschlag` in die Slot-Fokus-Attribute |
  | Feldspiel (Basketball, Hockey, Football) | `bauFeldspiel/bauSpieler`, `:7526–7556` | **nein**: `engP` = nur Slot-Aufschlag |
  | Bühne (Gewichtheben, Speed-Schach, Tennis, Fechten, Showcase, Eiskunstlauf, Wettessen, Breaking, I-Spy) | `bauBuehne/setz`, `:14151–14173` | **nein** |
  | Bahn (Staffel, Spurt, Time-Trial, Takeshi's Castle, Climbing) | `bauSpurt/setz`, `:28955–29027` | **nein** |

  In der Aufschlüsselung (`:31981`) und der Traitzeile (`:22010–22030`) wird der Mutator für die
  Heimseite **angezeigt**, auch in Feldspiel, Bühne und Bahn. Wirksam ist er dort nicht.
- `traitVerteilung()`/`traitAufschlag()` (`:5532–5626`) sind **nur Anzeige** („wohin geht das
  Gewicht"). Der wirksame Weg im Kampf ist `mitAufschlag()` (`:5573–5582`) über
  `betroffeneAttribute(…, eng=true)` (`:5588–5617`).
- Traits wirken in der Engine außerdem **nativ und immer**, ohne Mutatorbezug: als Persönlichkeit
  (`leitePers`, `:21394ff.`, Kampfverhalten) und als Showcase-Aktpunkte (`SHOWCASE_ACT_PUNKTE`,
  `:19123ff.`, `:19180`). Diese Kanäle berührt der Vorschlag nicht, es entsteht keine Überschneidung.

### 1.5 Größenordnungen (gemessen, nicht geschätzt)

Quelle: Live-Abbild `/tmp/abbild.sqlite` (drei größte Spielstände, alle Manager-Modus, letzte
Änderung 23.08.) und Kaderfamilie `data/generated/kaderfamilie-live-save.json`. Die Rechenwege liegen
als Wegwerf-Skripte im Scratchpad dieser Sitzung und gehören nicht ins Repo.

| Größe | Wert |
|---|---|
| Anteil Einsätze mit ≥ 1 Treffer (Live, 7136 Einsätze) | **17,3 %** |
| Theorie aus Kaderfamilie (Ø 3,5 Traits je Spieler, 2 aus 36) | P(0) 81,4 %, P(1) 17,8 %, **P(2) 0,8 %** |
| Basiswert eingesetzter Spieler, Median / P10 / P90 | 46,2 / 25,4 / 68,8 |
| `+6` in % des Basiswerts, Median / P10 / P90 | **13,0 % / 23,6 % / 8,7 %** (flach, also regressiv) |
| Mittlere Rang-PP je Spieler und Einsatz (Tabelle `rank-to-points`) | 1,17 PP (Rang 1: 3,30 PP) |
| PP-Wert des heutigen `+6` für den getroffenen Spieler (PPS-Pfad, Näherung) | Ø **0,18 PP** (Median 0,15) |
| PP-Wert eines proportionalen Plus von 5 / 6,5 / 8 % (PPS-Pfad, dieselbe Näherung) | Ø **0,08 / 0,11 / 0,13 PP** |
| Flache Mutator-PP je Treffer | **0,30 PP** (= 26 % eines Durchschnittseinsatzes) |

Die PP-Näherung sortiert den Seiten-Score des Teams um den Zusatz neu in das 32er-Feld desselben
Spieltags ein und verteilt die neuen Rangpunkte nach Score-Anteil. Kapitän und Team-Power sind
dabei nicht nachgezogen. Das ist eine Größenordnung, keine Abnahmezahl.

**Was daraus folgt:** Heute ist ein Treffer im PPS-Pfad ≈ 0,48 PP wert (0,18 + 0,30), das sind
≈ 41 % eines Durchschnittseinsatzes. „5–8 % besser performen" ist im PPS-Pfad ≈ 0,08–0,13 PP wert.
Chris' Zahl liegt damit **deutlich unter** dem, was ein Treffer heute bringt. Frage 1 in
Abschnitt 8 ist deshalb keine Formalie.

---

## 2. Kernfrage: welche Instanz simuliert, je Chassis?

**Antwort: es hängt am Spielmodus, nicht am Chassis allein.**

| Spielmodus | Disziplinen | Wer entscheidet Teampunkte und Spieler-PP? |
|---|---|---|
| **Manager** (`scenarioMeta.gameMode ≠ "battle"`) | alle 20 | **PPS-Pfad**: aggregiertes Score-Modell, keine Simulation |
| **Battle**, arena-aufgelöst (`lib/battle/arena-resolved-disciplines.ts`) | 15: Basketball, Hockey · Gewichtheben, Speed-Schach, Tennis, Fechten, Showcase, Eiskunstlauf, Wettessen, Breaking · Staffel, Takeshi's Castle, Time-Trial, Spurt, Climbing | **Arena-Engine, headless**: `kickoffArenaMatchdayApply` → `runBattleModeArenaMatchday` → `runArenaFixtures` (Playwright lädt `engine.js`) → Teampunkte 2/1/0 und Spieler-PP aus dem Boxscore (`legacy-matchday-resolve-engine.ts:748–782`, `:836–839`, `:867`) |
| **Battle**, nicht arena-aufgelöst | 5: TDM, Mini-DM, Battlefield (Kampf) · Football (Feldspiel, bewusst draußen) · I-Spy (Bühne, rho zu niedrig) | **PPS-Pfad** wie im Manager-Modus. `runMiniDmFfaPodFixtures` existiert im Runner (`arena-headless-runner.ts:803`), ist aber nicht im Resolve verdrahtet |

Weitere Punkte, auf die das Konzept aufbaut:

1. **Im Arena-Pfad läuft der PPS-Pfad trotzdem mit.** `buildLegacyMatchdayResolvePreview` rechnet
   für jedes Team die PPS-Seite. Sie liefert `finalPlayerScore` (MVP- und Top-10-Rang), die Anzeige
   und den **Rückfall** für Spieler ohne eindeutige Boxscore-Zuordnung (`playerId: null`,
   `arena-headless-runner.ts:239–255`). Teampunkte und die zugeordneten Spieler-PP kommen aber aus
   der Arena. Der `+6` wirkt dort also **nur auf Anzeige, MVP-Reihenfolge und den Rückfall**.
2. **Die Brücke überträgt keine Spieltags-Modifikatoren.** `__olyArenaKader` = `{heim, gast,
   aufstellung}` (`arena-headless-runner.ts:478–482`, `:579–584`), die Aufstellung ist nur
   `{d, slot}` je Spieler (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts`). Traits kommen
   als `tp`/`tn` an (`arena-kader-adapter.ts:109–110`), die gezogenen Mutatoren nicht.
3. **Die Chassis unterscheiden sich im Wie, nicht im Ob.** Alle vier Baufunktionen folgen demselben
   Muster: Rohattribute über `gehoben(p)` → `mitAufschlag` (Slot eng, Form/Stufe breit) → Rezeptwerte
   bzw. Kampfwerte → dazu eine Eignung `eig` aus `p.d[d]` + Zuschläge. Kampf normiert die Kampfwerte
   über `aufEignung()` auf die Eignung („Eignung gibt die Menge"). Feldspiel und Bühne lesen vor
   allem die Rezeptwerte `R2`. Bei der Bahn gibt außer bei der Staffel das Rezept Form **und** Menge
   (`engine.js:28968–28974`). Ein Eingriff an **beiden** Stellen (effektive Attribute **und** `eig`)
   erreicht deshalb jedes Chassis, ohne dass man je Unterart (Heben/Duell/Auftritt/Gauntlet)
   verzweigen müsste.

**Was „organisch" deshalb heißt, offen gesagt:**

- **Arena-Pfad:** Der Bonus geht als **Eingang** in die Simulation. Der Spieler tritt an diesem
  Spieltag mit etwas höherem effektiven Können an, und was er daraus macht (Punkte, Duelle,
  Laufzeit), entscheidet die Simulation.
- **PPS-Pfad:** Es gibt keine Simulation, in die man etwas einspeisen könnte. „Organisch" kann dort
  nur heißen: der Bonus sitzt **in der Leistungskette** (wie Ermüdung, Verletzung, Moral) und nicht
  als flacher Nachschlag hinten dran. Der Unterschied zum heutigen `+6` ist im PPS-Pfad kleiner als
  im Arena-Pfad. Er ist aber real: proportional statt flach, und vom Kapitän mitverstärkt.

---

## 3. Mechanismus

### 3.1 Formel (Vorschlag)

```
h  = Trefferzahl des Spielers gegen den Spieltagswurf seiner Seite   (0, 1 oder 2)
m  = MUTATOR_LEISTUNG_JE_TREFFER = 0,065                              (Korridor 0,05–0,08)
F  = 1 + m · h                                                        (1,000 / 1,065 / 1,130)
```

Linear in `h`, genau wie `hits·6` und `hits·0,3` heute. Chris hat die Skalierung mit der
Trefferzahl ausdrücklich gewollt, siehe Kommentar `legacy-lineup-modifiers.ts:986–990`. Eine
Dämpfung für zwei Treffer ist Frage 4 in Abschnitt 8. Praktisch betrifft sie weniger als 1 % der
Einsätze.

### 3.2 Wovon genau 5–8 %?

**Von der effektiven Disziplinstärke des Spielers an diesem Spieltag**, also vom Eingang der
Simulation:

- **Arena:** `F` multipliziert
  1. **alle matrixgewichteten effektiven Attribute** (die Menge, die `betroffeneAttribute(sl, d,
     false)` „breit" schon liefert: alle `k` mit `BASIS_JE_DISC[d][k] > 0`), **nachdem** Slot- und
     Form-Aufschlag angewendet sind, und
  2. die Eignung `eig`, die daraus entsteht.

  Das heißt: der Spieler spielt an diesem Tag so, als wären seine für die Disziplin relevanten
  Attribute 6,5 % höher.
- **PPS:** `F` multipliziert den moralbereinigten Spielerwert (`moraleAdjustedScore`), bevor
  Kapitän, Form und Team-Power dazukommen.

**Warum diese Bezugsgröße und keine andere:**

| Alternative | Warum nicht |
|---|---|
| 5–8 % auf das **Ergebnis** (Boxscore, Laufzeit, Punkte) | Das ist wieder ein Nachschlag nach der Simulation, nur prozentual. Außerdem ist das Ergebnis in Duell-, Gauntlet- und Teamformaten nicht additiv je Spieler: ein Duell ist gewonnen oder verloren, ein Teamsieg ist 2/1/0. „+6,5 % auf einen Sieg" gibt es nicht. |
| Flache Punkte wie heute (`+6` auf `eig`) | Regressiv: 24 % für schwache, 9 % für starke Spieler (Abschnitt 1.5). Chris' Zahl ist ausdrücklich relativ („5–8 % Verbesserung"). |
| Nur die **Slot-Fokus-Attribute** („eng", wie heute in `baueEinheit`) | Nicht Pp-neutral: hebt zwei Attribute stärker als die übrigen und verschiebt damit Einflussanteile gegen die Matrix. Außerdem sättigt der Kanal strukturell. Genau deshalb fährt Football schon „breit" (`engine.js:5592–5605`). |
| Einzelne **Kampfwerte/Rezeptkanäle** (dmg/heal/tank … wie `traitVerteilung`) | Chassis-spezifisch: jedes der vier Chassis bräuchte eine eigene Zuordnung, und die Bahn hat gar keine Kampfwerte. Die Engine hat diesen Umweg schon einmal verworfen, weil „Punkte direkt auf die Kampfwerte" nur ein Fünftel der angezeigten Wirkung ergab (`engine.js:5557–5572`). |
| Die **Matrixgewichte** verschieben | Ausgeschlossen: die Matrix ist gesperrt. Der Vorschlag lässt sie unberührt. |

### 3.3 Eigenschaften des Vorschlags

- **Matrixtreu:** Nur Attribute mit Matrixgewicht > 0 werden skaliert, alle mit demselben Faktor.
  Die relative Bedeutung der Attribute zueinander bleibt exakt so, wie die Matrix sie vorgibt.
  Attribute ohne Matrixgewicht, die ein Rezept trotzdem liest (z. B. Speed im TDM), werden **nicht**
  gehoben. Der Bonus fließt also nur durch die Kanäle, die die Matrix bepreist.
- **Beide Seiten gleich:** Der Wurf gilt für alle Teams. Die Baufunktionen bauen seit den
  Spiegeltest-Reparaturen beide Seiten über dieselbe Funktion (`engine.js:7515–7525`,
  `:22672–22688`). Der Faktor darf deshalb **keinen** `istGegner`-Zweig bekommen.
- **Deterministisch:** Der Wurf kommt aus der Produktion (Hash), die Simulation bleibt bei
  gleicher Saat bitgleich. Replay- und Idempotenzregeln bleiben erhalten.
- **Klemmen:** `mische()` klemmt Rezeptwerte auf 1–99 (`engine.js:5482–5483`). Ein Spieler, dessen
  Rezeptwerte schon nahe 99 liegen, gewinnt deshalb weniger als 6,5 % (Deckeneffekt). Das dämpft
  „Reiche werden reicher" und ist vertretbar, muss aber in der Wirkungsmessung (7.3) sichtbar
  werden. Die Eignung `eig` klemmt nicht, dort greift der volle Faktor.

---

## 4. Injektionspunkte je Chassis

### 4.0 Gemeinsame Voraussetzung: der echte Wurf muss in die Engine

Ohne diesen Schritt würde die Arena mit Healthy/Renegade rechnen, während der Spielplan (und der
PPS-Pfad) zwei ganz andere Traits zeigt. Vorschlag:

1. **Transport:** `runBattleModeArenaMatchday()` (`lib/resolve/battle-mode-arena-team-points.ts`)
   kennt `saveId/seasonId/matchdayId/disciplineId`. Es bestimmt über
   `buildMatchdayMutatorTraitsBySide()` die Seite (d1/d2) dieser Disziplin und reicht die zwei Traits
   an `runArenaFixtures()` weiter. Dort landen sie als neues, optionales Feld
   `__olyArenaKader.mutatoren` (`arena-headless-runner.ts:478–482` im Browser-Loop und `:579–584`
   im Init-Script). Fehlt das Feld (Mockup, Messskripte, Altaufrufer), bleibt alles wie bisher.
2. **Engine liest es:** Beim Laden gilt `MUTATOREN = __olyArenaKader.mutatoren`, falls vorhanden.
   Sonst gilt die eigene Ziehung. Die eigene Ziehung sollte auf „2 verschiedene aus 36" umgestellt
   werden, damit Messungen dieselbe Verteilung wie das Spiel sehen (heute 1P+1N, `:5503–5506`. Die
   Quoten für mindestens einen Treffer liegen nah beieinander, 18,5 % vs. 18,6 % über die
   Kaderfamilie. Nicht gleich ist die Menge möglicher Paare: zwei positive oder zwei negative Traits
   kann die Engine nie ziehen, die Produktion schon).
3. **Trefferzählung spiegelt `countTraitHits()`:** klein geschrieben verglichen und dedupliziert.
   Heute vergleicht `traitTreffer` exakt nach Groß-/Kleinschreibung (`:5520–5521`).
4. **Ein gemeinsamer Helfer statt vier Kopien**, z. B. `traitFaktor(p)` → `F` und
   `mitTraitFaktor(attr, F, d)` → skaliert alle `k` mit `BASIS_JE_DISC[d][k] > 0`. Die Konstante
   `m` steht **einmal** in der Engine und **einmal** in `legacy-lineup-modifiers.ts`, abgesichert
   durch einen Gleichheitstest (Muster: `TRAIT_PUNKTE = 6` spiegelt heute `hits*6`).

### 4.1 Feldspiel: `bauFeldspiel` → `bauSpieler` (`engine.js:7526–7556`)

- Nach `:7531` (beide `mitAufschlag`-Aufrufe fertig): `attr = mitTraitFaktor(attr, F, feldspielDisc)`.
  `R2` (`:7532`) entsteht danach schon aus den gehobenen Attributen.
- `:7556`: `eig: (basisWert + engP + breitP) · F`.
- Reihenfolge zu `BASKETBALL_POS_MOD` (`:7535–7538`): der Positions-Modifier ist additiv auf `R2` und
  bleibt **nach** dem Faktor, damit er nicht mitskaliert wird.
- Hockey-Torwart: `HK_TW_BASIS/HK_TW_REF` lesen dieselben Attribute. Der Faktor wirkt automatisch,
  muss aber in der Torwart-Rangtreue (`miss-rangtreue-nach-rolle.mjs hockey 48`) mitgemessen werden.

### 4.2 Bühne: `bauBuehne` → `setz` (`engine.js:14151–14173`)

- Nach `:14156`: `attr = mitTraitFaktor(attr, F, buehneDisc)`. `R2` (`:14157`) und `L.attr` entstehen
  daraus.
- `:14173`: `eig` mit `F` multiplizieren (Basis + Zuschläge).
- **Ein Punkt deckt alle vier Bühnen-Unterarten ab** (Heben, Duell, Auftritt, Gauntlet), weil
  `spieleBuehneHeben/Duell/Auftritt/Gauntlet` alle auf die hier gebauten Teilnehmer zugreifen.
  Showcase-Aktpunkte aus nativen Traits (`:19180`) bleiben unberührt, sie sind ein anderer Kanal.

### 4.3 Bahn: `bauSpurt` → `setz` (`engine.js:28955–29027`)

- Nach `:28966`: `attr = mitTraitFaktor(attr, F, d)`, **vor** `spurtWerte(p, attr)` (`:28967`).
  Bei Spurt, Time-Trial, Takeshi und Climbing gibt das Rezept Form und Menge, der Faktor muss also
  hier sitzen.
- Staffel (`:28975`, `:28990`) und `eig` (`:29027`): jeweils mit `F` multiplizieren. Bei der Staffel
  gibt die Eignung die Menge.

### 4.4 Kampf: `baueEinheit` (`engine.js:22729–22748`)

- **Umbau statt Zusatz:** `tr.netto` aus `engPunkte` entfernen (`:22733`). Heute ist das der flache
  `+6`-Weg über die Slot-Fokus-Attribute. Stattdessen `F` wie in 4.1–4.3 auf `attr` (nach `:22748`)
  und auf `eigWert` (`:22744–22745`).
- Kampf ist **nicht produktiv** (Abschnitt 2). Der Umbau dient der Einheitlichkeit: der
  interaktive Arena-Host und alle Kampfmessungen sollen dieselbe Mechanik zeigen, die in den anderen
  Chassis produktiv wirkt. Er verschiebt allerdings die Kampf-Basislinien, siehe 6.4.

### 4.5 PPS-Pfad: `scoreLegacyLineupDisciplineSide` (`lib/lineups/legacy-score-engine.ts`)

- **Neu:** `mutatorMultiplier = F` je Spieler. Er wird in der Tageskette **nach der Moral**
  (`:276–281`) angewendet, also auf `moraleAdjustedScore`, bevor `finalContribution` gesetzt wird
  (`:322`). Das passt zum bestehenden Muster (Ermüdung × Verletzung × Moral) und wird vom Kapitän
  (`:345`) mitverstärkt, wie jede andere Tagesform.
- **Entfällt:** der flache Mutator-Aufschlag (`:358–367`) und der Seitenrest
  `mutatorTeamOnlyAdjustment` (`:404–408`, `:416`). Das Feld `mutatorBonus` am Eintrag kann bleiben,
  enthält dann aber den **tatsächlichen** Zugewinn `(F−1)·moraleAdjustedScore`, damit Anzeige und
  Ledger (`mutatorScoreBonus`) weiter eine Zahl haben.
- **Quelle:** `calculateMutatorModifierForSide()` liefert zusätzlich `playerMutatorHits`
  (bzw. `playerMutatorFactorByPlayerId`). `playerMutatorBonuses` fällt weg oder wird zur Anzeigegröße.
  Der Resolve reicht das Feld an der bestehenden Stelle durch (`legacy-matchday-resolve-engine.ts:509–513`).
  `calculateMvpForcedMutatorModifierForSide()` (`legacy-lineup-modifiers.ts:1069ff.`) läuft
  über dieselbe Funktion und zieht automatisch mit.
- **Im Battle-Modus für arena-aufgelöste Disziplinen** wirkt diese Änderung nur auf Anzeige,
  MVP-Reihenfolge und PPS-Rückfall (Abschnitt 2, Punkt 1). Das ist richtig so: es ist dieselbe
  Formel wie in der Arena, nur ohne Simulation.

### 4.6 Folgestellen (keine Injektion, müssen aber nachziehen)

- `lib/foundation/spielplan-mutator-summary.ts:102–103` leitet die Trefferzahl aus `bonus / 6` ab.
  Das bricht, sobald der Bonus proportional ist. Stattdessen die Trefferzahl direkt übergeben.
- `getLegacyMutatorSourceSummary()` (`legacy-lineup-modifiers.ts:333–341`): der Text „+6 Score pro
  passendem Trait" muss geändert werden.
- `lib/lineups/legacy-lineup-preview-from-context.ts:155–183` (Vorschau) und die Aufschlüsselung der
  Engine (`:31981`, „Mutator +6") müssen die neue Größe zeigen.
- Tests, die `6`/`12` festschreiben: `tests/mutator-fairness.test.ts`, `tests/legacy-lineup.test.ts`,
  `tests/spielplan-mutator-summary.test.ts`, `tests/legacy-matchday-result-apply-service.test.ts:345`.
- `lib/traits/cosmetic-trait-soft-effects.ts:12` (Kommentar „+6 scoring mutator").

---

## 5. Verhältnis zu `+6` und `+0,3`: die Doppelbuchung

### 5.1 Wo heute was wirkt

| Kanal | PPS-Pfad (Manager, 5 Battle-Disziplinen) | Arena-Pfad (15 Battle-Disziplinen) |
|---|---|---|
| `+6` Score | wirkt: Rang, Teampunkte, Anteil (≈ 0,18 PP) | wirkt **nicht** auf Punkte, nur Anzeige/MVP/Rückfall |
| `+0,3` PP | wirkt, 1:1 in der Tabelle | wirkt, 1:1 in der Tabelle |
| Trait in der Simulation | — (keine Simulation) | **nein** |

### 5.2 Die eigentliche Doppelbuchung

`+6` und der neue Faktor `F` sind **derselbe Kanal**: beide machen den Spieler an diesem Spieltag
stärker, beide wirken über Rang/Ergebnis und Score-Anteil auf die PP. Beide nebeneinander wären
eine Doppelbuchung. Im PPS-Pfad würde der Treffer dann zweimal auf den Score wirken, im Arena-Pfad
einmal in der Simulation und einmal im MVP-Rang und im Rückfall. **Deshalb ersetzt `F` den `+6` in
allen Pfaden, ohne Ausnahme.**

`+0,3` ist eine **andere Währung**: ein fester Tabellenbonus neben dem rangbasierten Topf. Ob er
bleibt, ist keine technische, sondern eine Wertungsfrage.

### 5.3 Drei Varianten (Entscheidung bei Chris, Frage 1)

PP-Werte je Treffer, PPS-Pfad aus Abschnitt 1.5. Für den Arena-Pfad ist der PP-Wert des Faktors
**nicht gemessen**, er muss in der Wirkungsmessung (7.3) bestimmt werden.

| Variante | `+6` | `F` | `+0,3` PP | Wert je Treffer, PPS-Pfad | Wert je Treffer, Arena-Pfad |
|---|---|---|---|---|---|
| heute | ja | — | ja | ≈ 0,48 PP | 0,30 PP |
| **V1 „Ersetzen"** (Lesart: die 0,3 werden in den Spieltag *übernommen*) | — | ja | **—** | ≈ 0,11 PP (−77 %) | nur Simulationseffekt |
| **V2 „Ergänzen"** (Empfehlung) | — | ja | **ja** | ≈ 0,41 PP (−15 %) | 0,30 PP + Simulationseffekt |
| **V3 „Umbuchen"** | — | ja | **0,15** | ≈ 0,26 PP | 0,15 PP + Simulationseffekt |

**Empfehlung V2**, mit Begründung:

1. Sie beseitigt die echte Doppelbuchung (`+6` neben `F`) und lässt den getrennten Kanal (0,3 PP)
   stehen.
2. Sie hält den Mutator „spürbar". V1 nähme ihm im PPS-Pfad drei Viertel seines Werts, und das
   widerspräche „spürbar, aber nicht zu stark".
3. Sie verändert Chris' Entscheidung vom 23.08. („6 Score-Punkte und 0,3 PPs") nur im Score-Teil. Die
   6 Punkte werden „6,5 % Leistung", die 0,3 PP bleiben. Am Median-Basiswert sind 6,5 % ≈ 3 Punkte
   statt 6, für starke Spieler (P90, 68,8) ≈ 4,5 statt 6.
4. Die Arena-Disziplinen **gewinnen** dadurch etwas, was sie heute gar nicht haben (Wirkung im
   Spiel), statt etwas zu verlieren.

**V1 ist ebenso gut vertretbar**, wenn Chris „übernommen" als „ersetzt" meint. Dann muss er aber
wissen, dass Mutatoren ökonomisch deutlich an Gewicht verlieren. Weil der Wortlaut beides zulässt,
ist diese Frage **vor der Umsetzung zu klären**.

---

## 6. Pp-Abweichung: die Messung sauber halten

### 6.1 Was `einflussVon()` heute mit Mutatoren macht (nachgelesen)

- `einflussVon(dId, n, plus, saatVersatz)` (`engine.js:34458–34500`): Der Grundlauf und jeder
  Hebungslauf rufen `durchlauf()` auf. Die Funktion zieht je Lauf `i` die Formkarten neu
  (`zieheFormkarten(20260823+versatz+i·104729)`, `:34469`) und baut mit `M.bau(1337+versatz+i·7919)`
  (`:34470`). **`zieheMutatoren` wird nirgends aufgerufen.** `MUTATOREN` bleibt über die ganze Messung
  auf dem Ladezustand (Healthy/Renegade).
- Der Hebel `ATTR_HEBUNG` wirkt über `gehoben(p)` (`:22696–22701`) auf die Rohattribute und über
  `eigHebung(p, d)` (`:22722–22728`) auf die Eignung, also **vor** allen Aufschlägen.
- Folge: Grund- und Hebungslauf sehen **dieselben** Mutatoren. Der Vergleich ist gepaart und damit
  sauber. Er ist aber nicht spielnah: immer dieselben Spieler (Träger von Healthy oder Renegade)
  bekommen den Bonus, in jedem Lauf. Heute wirkt das nur im Kampf. Mit dem Vorschlag würde es in
  allen Chassis wirken.

### 6.2 Warum der Vorschlag Pp-neutral ist

Die Pp-Abweichung misst die **Anteile** der zwölf Attribute am Zugewinn eines gehobenen Spielers,
normiert auf die Summe der positiven Zugewinne (`:34488–34497`). Skaliert `F` alle
matrixgewichteten Attribute gleichmäßig und **nach** der Hebung, dann wird für einen getroffenen
Spieler jeder Attributzugewinn mit demselben Faktor multipliziert. Die Anteile bleiben gleich. Nur
Attribute ohne Matrixgewicht werden nicht mitskaliert. Ihr Anteil sinkt für getroffene Spieler
minimal, und damit sinkt die Abweichung eher, als dass sie steigt.

Das gilt **nicht** für den heutigen Kampfweg (`tr.netto` über die eng-Attribute, `:22733` +
`:22747`). Der hebt zwei Fokus-Attribute stärker. Der Umbau in 4.4 ist deshalb auch eine
Pp-Bereinigung.

Grenzfälle: die 1–99-Klemme in `mische()` und die 100er-Klemme in `gehoben()` können bei Spielern
mit sehr hohen Attributen den Faktor stutzen. Das trifft bei ≈ 18 % Trefferquote und 6,5 % Faktor
höchstens einen Bruchteil eines Prozents der gemessenen Zugewinne.

### 6.3 Messprotokoll (Vorschlag)

1. **Referenz A, Mutatoren aus** (`MUTATOREN = []` während `einflussVon`): Das ist die reine
   Matrixfrage „was treibt die Leute an?". Mutatoren sind kein Matrixattribut. Diese Zahl ist direkt
   vergleichbar mit der Scorecard vom 26.09. (`stand-aller-disziplinen.md`, Zwölfter Nachtrag),
   **nachdem** die Umstellung in 4.4 die Kampf-Basislinie verschoben hat (6.4).
2. **Abnahme B, Mutatoren je Lauf gezogen, gepaart:** In `durchlauf()` wird neben
   `zieheFormkarten(…)` auch `zieheMutatorenWieSpiel(20260823 + versatz + i·K)` gezogen, mit derselben
   Saat für den Grund- und jeden Hebungslauf. Lauf `i` sieht dann in allen Durchgängen denselben
   Wurf, und der Vergleich bleibt gepaart. Umsetzbar als zusätzlicher Parameter wie `saatVersatz`
   (Standard „aus", bitgleich zum heutigen Aufruf).
3. **Kriterien:** B ≤ 25 Pp überall dort, wo A ≤ 25 Pp gilt; **|B − A| ≤ 2 Pp** in jeder Disziplin;
   zwei unabhängige Saatströme (`saatVersatz` 0 und 10 000 000), wie im Handbuch gefordert. Für die
   zwölf Disziplinen, die die Schranke heute schon verletzen (Scorecard 26.09.), gilt: **keine
   Verschlechterung über 2 Pp**. Deren Reparatur ist nicht Teil dieses Vorhabens.
4. **Kontrolle der Neutralität:** zusätzlich B mit `m = 0,08` (oberer Rand). Liegt |B − A| dort
   ≤ 2 Pp, ist der Korridor Pp-sicher.

Der PPS-Pfad hat keine `einflussVon`-Messung, weil er keine Simulation hat. Der Faktor multipliziert
dort einen Basiswert, der selbst eine Matrixsumme ist
(`calculateRawDisciplineScore`, `lib/player-formulas/discipline-rating-engine.ts:36–49`). Das ist
Pp-neutral per Konstruktion.

### 6.4 Achtung Basislinie Kampf

Alle heutigen TDM-, Mini-DM- und Battlefield-Zahlen (rho **und** Pp) sind mit dem konstanten
Healthy/Renegade-Bonus (`+6` eng) gemessen. Nach 4.4 ändert sich diese Basislinie. Der
Vorher/Nachher-Vergleich muss für Kampf deshalb gegen eine **neu gezogene** Basislinie „Mutatoren
aus" laufen, nicht gegen die Scorecard.

---

## 7. rho-Sicherheit

### 7.1 Erwartung (Stilmodell, keine Abnahmezahl)

Monte-Carlo über die echte Kaderfamilie, 16 Teilnehmer je Spiel, 7 Disziplinen, je 5 Paarungen ×
400 Spiele. Leistung = Eignung × `F` + Rauschen, Rauschen so eingestellt, dass rho je Spiel ohne
Mutator bei 0,86 / 0,90 / 0,93 liegt. Mutatoren je Spiel gezogen:

| rho ohne Mutator | m = 0,05 | m = 0,065 | m = 0,08 |
|---:|---:|---:|---:|
| 0,855 | 0,857 | 0,856 | 0,856 |
| 0,898 | 0,897 | 0,897 | 0,896 |
| 0,935 | 0,934 | 0,933 | 0,932 |

Die Verschiebung liegt bei −0,001 bis −0,003, also unter dem Kaderrauschen (Spannweiten 0,06–0,25).
Der Grund: nur ≈ 18 % der Spieler treffen, und 6,5 % Eignung sind klein gegen das Einzelspielrauschen.
Das Modell ist **linear**. Duelle (Tennis, Fechten, Speed-Schach), Gauntlet (Breaking) und die
2/1/0-Teamwertung sind es nicht: dort kann ein kleiner Vorsprung ein knappes Duell kippen. Das trifft
aber fast nur Paare mit sehr kleinem Eignungsabstand, und genau diese Paare soll nach CLAUDE.md
„kein Motor der Welt ordnen". Die echte Messung muss das bestätigen.

### 7.2 Validierungsmethode (Vorschlag)

**Werkzeug:** `scripts/miss-alle-disziplinen.mjs` (die einzige Sonde, die alle vier Chassis kennt),
kaderfest über die Live-Kaderfamilie, `n = 24` Spiele. Dazu kommen zwei neue, additive Schalter
(ohne Schalter bitgleich zu heute):

- `--mutatoren=aus|je-spiel`: steuert in `disziplinProbe` die Ziehung je Spiel, analog zu
  `zieheFormkarten(20260823+i·104729)`.
- `--mutator-staerke=<m>`.

**Läufe (gepaart, gleiche Saaten, gleiche Kader):**

| Lauf | Mutatoren | m |
|---|---|---|
| V0 | aus | — |
| V1 | je Spiel | 0,05 |
| V2 | je Spiel | 0,065 |
| V3 | je Spiel | 0,08 |

**Disziplinen:** alle 15 arena-aufgelösten (produktiv betroffen), dazu TDM, Mini-DM und Battlefield
(wegen 4.4) sowie Football und I-Spy (Chassis-Code wirkt mit). **Fokusliste**, weil nah an 0,80
(Scorecard 26.09.): Climbing 0,814, Football 0,818, Tennis 0,821, Fechten 0,825, Breaking 0,833,
Gewichtheben 0,843. Für diese sechs zusätzlich den zweiten Saatstrom. Für Hockey außerdem
`scripts/miss-rangtreue-nach-rolle.mjs hockey 48` (Torwart-Formel).

**rho wird gegen die unveränderte Eignung gemessen** (ohne `F`), denn der Mutator weicht absichtlich
von der Eignung ab. Diese Abweichung soll die Abnahme sehen und begrenzen, nicht wegrechnen.

**Kriterien (Vorschlag):**

1. Median rho je Spiel ≥ 0,80 in jeder Disziplin, die in V0 besteht.
2. Δ Median (Vn − V0) ≥ −0,01 in jeder Disziplin. Das ist enger als die Schranke, damit Knappe nicht
   „gerade noch" durchrutschen.
3. Die ehrlichere Abnahme aus CLAUDE.md bleibt stabil: „Star auf Rang 1" und „Paartreue bei ≥ 15
   Eignungspunkten Abstand" dürfen sich um höchstens ±2 Prozentpunkte bewegen.
4. Saison-Validität (rho über 24 Spiele) Δ ≥ −0,01. Weil der Wurf je Spiel wechselt, mittelt sich
   der Mutator über die Saison heraus. Tut er es nicht, stimmt die Ziehung nicht.

### 7.3 Wirkungsnachweis: „spürbar, aber nicht zu stark"

rho beweist nur, dass nichts kaputtgeht. Ob Chris' Absicht ankommt, braucht eine eigene Messung,
die es heute nicht gibt:

- **Gepaarter Gegenfaktus:** dieselbe Saat, derselbe Kader, einmal mit und einmal ohne Treffer für
  **genau einen** Spieler (Muster: `boxscoreSerie(dId, n, heben)`, `engine.js:34508ff.`, mit einem
  Trait-Hebel statt eines Attribut-Hebels).
- **Ausgabe je Chassis:** mittlerer Zugewinn im Boxscore-Wert des Spielers (%), Veränderung der
  Duell-Siegquote (Prozentpunkte), Veränderung der Team-Siegquote 2/1/0 und, über die PPS-Referenz
  der Disziplin (`ppsAusArenaImpact`), der **PP-Wert eines Treffers im Arena-Pfad**. Das ist die
  Zahl, die in 5.3 noch fehlt.
- **Vorschlag Zielkorridor:** Boxscore-Zugewinn des getroffenen Spielers +4 % bis +12 %. Der
  Korridor ist absichtlich breiter als 5–8 %, weil der Eingang (Können) in Duell- und Teamformaten
  nicht 1:1 im Ausgang ankommt. Liegt eine Disziplin außerhalb, wird `m` **nicht** je Disziplin
  nachgestellt (siehe Frage 5), sondern das Ergebnis Chris vorgelegt.

---

## 8. Offene Entscheidungsfragen an Chris (Wertung, nicht Technik)

Die Eignungsmatrix ist **nicht** darunter: sie bleibt gesperrt und wird vom Vorschlag nicht berührt.

| # | Frage | Optionen | Empfehlung | Vor der Umsetzung zwingend? |
|---|---|---|---|---|
| 1 | **Ersetzen die 5–8 % die 0,3 PP, oder kommen sie dazu?** | V1 Ersetzen / V2 Ergänzen / V3 Umbuchen (0,15), s. 5.3 | **V2** (`+6` fällt, 0,3 PP bleiben) | **ja**: der Wortlaut „übernommen" lässt beides zu, und V1 nimmt dem Mutator im PPS-Pfad ≈ 77 % seines Werts |
| 2 | **5–8 % von was?** Vom Können (Eingang der Simulation) oder vom Ergebnis (Ausgang)? | Eingang / Ausgang | **Eingang** (s. 3.2). Der Ausgang wird in 7.3 gemessen und vorgelegt | **ja**: davon hängt ab, ob `m` nach der Wirkungsmessung noch einmal angepasst wird |
| 3 | Welcher Wert im Korridor? | 0,05 / 0,065 / 0,08 | **0,065** (Mitte). Endgültig nach 7.2/7.3 | nein, Startwert reicht |
| 4 | Zwei Treffer: linear (2·m) oder gedämpft? | linear 1,13 / gedämpft z. B. 1,11 | **linear**, wie `hits·6`/`hits·0,3` (Chris' eigene Skalierungsentscheidung). Betrifft < 1 % der Einsätze | nein |
| 5 | Gleich für alle 20 Disziplinen oder je Disziplin? | ein `m` / `m` je Disziplin | **ein `m`**: der Mutator ist eine Eigenschaft des Spieltags, nicht der Disziplin. Je-Disziplin-Werte wären ein neuer Stellknopf, der die Rangtreue-Pflege verkompliziert | nein |
| 6 | Bleibt es dabei, dass auch ein „negativer" Trait (Lazy, Cheater …) den Spieler **besser** macht? | ja (Stand 23.08.) / thematische Polarität | **ja**, das ist entschieden und im Code festgeschrieben. Mit „der Spieler performt besser" wird die Frage aber sichtbarer als bei „+6 Punkte" und sollte deshalb einmal bestätigt werden | nein, aber bestätigen lassen |
| 7 | **Gilt die Umstellung auch im Manager-Modus (PPS-Pfad)?** | ja, überall / nur Battle-Modus | **überall**, eine Formel für alle Pfade. Folge: der Mutator wird für schwache Spieler relativ schwächer (heute 24 % → 6,5 %) und für starke etwas schwächer (8,7 % → 6,5 %) | **ja**: das verändert die Balance des Manager-Modus, auch wenn das Stichwort „Simulation" dort nicht zutrifft |
| 8 | Ersetzt das die Aussage vom 23.08. („6 Score-Punkte und 0,3 PPs, das bleibt so")? | ja / nein | ja, für den Score-Teil | mit Frage 1 zusammen |

Kurz: **Fragen 1, 2 und 7 brauchen Chris' Entscheidung, bevor Code geschrieben wird.** Die übrigen
haben eine begründete Empfehlung und können mit ihr starten.

---

## 9. Umsetzungsreihenfolge (Vorschlag, je Schritt ein PR)

1. **Messwerkzeug zuerst** (keine Spielwirkung): `zieheMutatorenWieSpiel` (2 aus 36, Trefferzählung
   wie `countTraitHits`), Schalter `--mutatoren`/`--mutator-staerke` in `miss-alle-disziplinen.mjs`,
   gepaarte Mutatorziehung in `einflussVon()`, Gegenfaktus-Sonde (7.3). Basislinie V0 ziehen.
2. **Engine-Faktor** in den vier Baufunktionen, hinter einem Schalter, der standardmäßig **aus** ist.
   Läufe V1–V3, Pp A/B, Wirkungsmessung. Die Zahlen gehen an Chris.
3. **Transport** `__olyArenaKader.mutatoren` (Runner + `runBattleModeArenaMatchday`), Schalter an.
4. **PPS-Pfad** (4.5) plus Folgestellen (4.6) und Tests, nach Chris' Antwort auf Frage 1/7.
5. Scorecard (`stand-aller-disziplinen.md`) nachziehen, auch die Kampf-Basislinie (6.4).

---

## Randbefunde (nicht Teil des Auftrags, nicht vertieft)

- **Formkarte und Intensität erreichen die produktive Arena nach Lesart des Codes ebenfalls nicht.**
  Die Brücke überträgt nur `{d, slot}`. `formVon`/`stufenWert` (`engine.js:5667–5668`) lesen die
  engine-eigene Ziehung (`zieheFormkarten(20260823)` beim Laden) bzw. die Standardstufe. Das ist
  nicht nachgemessen. Wenn es stimmt, trifft es dieselbe Klasse von Problem wie die Mutatoren, und
  Schritt 3 oben wäre die Stelle, es mitzulösen.
- Der interaktive Arena-Host zeigt im Kampf heute eine Trait-Wirkung mit Healthy/Renegade, der
  Spielplan aber den echten Wurf. Nach Schritt 3 stimmen beide überein.
- Die PP-Zahlen in 1.5 stammen aus Manager-Spielständen bis 23.08. (neuere Stände waren im Abbild
  nicht vorhanden). Die Größenordnung ist robust, die Nachkommastellen sind es nicht.

---

## 10. Chris' Entscheidungen (29.09.)

Die drei zwingenden Fragen aus Abschnitt 8, Chris' Antworten wörtlich:

| # | Frage | Antwort | Folge für die Umsetzung |
|---|---|---|---|
| 1 | Ersetzen die 5–8 % die 0,3 PP? | „ja genau das soll das ersetzen, deswegen soll der spieler quasi von seinen stats 5-8% besser werden wo ich mir erhoffe, dass das auf 0,3 PPs raus laufen könnte. da müsste man ggf. aber mal schauen wie sich das auf schwache und wie auf starke spieler auswirkt. vllt müsste es auch ein flat stat boost sein, das sollst du prüfen und einbauen" | **V1 „Ersetzen"**: kein `+6 Score`, keine `+0,3 PP` mehr, wo die Arena simuliert. Zielgröße: der organische Effekt soll im Mittel ≈ 0,3 PP bringen. Prozentual gegen flach ist zu prüfen (Abschnitt 11.1). |
| 2 | 5–8 % von was? | „vom Skillwert bzw jedem Attribut" | **Eingang**, und zwar auf **alle zwölf** Attribute (nicht nur die matrixgewichteten wie in 3.2 vorgeschlagen). |
| 7 | Auch im Manager-Modus? | „nein" | Manager-Modus behält `+6`/`+0,3` unverändert. Im Battle-Modus gilt das neue System nur, wo die Arena-Engine das Ergebnis tatsächlich simuliert (`ARENA_RESOLVED_DISCIPLINE_IDS`, 15 Disziplinen). TDM, Mini-DM, Battlefield, Football und I-Spy laufen auch im Battle-Modus über den PPS-Pfad **ohne** Simulation (Abschnitt 2) — dort gibt es nichts, worin ein Attributbonus wirken könnte, sie behalten deshalb das alte System. |

Fragen 3–6 und 8 erledigen sich damit: ein Wert für alle Disziplinen (5), linear in der
Trefferzahl (4), „negative" Traits wirken weiter als Bonus (6, Stand 23.08. unverändert).

---

## 11. Finale Umsetzung

### 11.1 Prozentual oder flach? — entschieden an echten Kadern

**Datenbasis.** Attribute: die 328 eingesetzten Kaderspieler des neuesten Spielstands im
Live-Abbild (`new-game-1787123325719-swnjlk`, 3936 Attributwerte). Wirkung: neue Sonde
`window.__arena.mutatorGegenfaktus()` + `scripts/miss-mutator-wirkung.ts` — dieselbe Saat,
derselbe Kader, einmal ohne jeden Mutator und einmal mit einem Treffer für **genau einen**
Spieler, reihum für jeden Teilnehmer; gespielt über dieselben Einstiege wie der produktive
Headless-Lauf, umgerechnet über dieselbe Funktion, die die Saison bucht
(`computeIndividualBoxscorePpsFromFixtureResults`). Live-Kaderfamilie (5 Paarungen), 6 Spiele je
Paarung, **360 gepaarte Treffer je Disziplin und Regel**, alle 15 arena-aufgelösten Disziplinen.

**Was die Attributverteilung sagt** (Live-Kader):

| Größe | Wert |
|---|---|
| Attributwerte P10 / Median / P90 | 8,9 / 45,8 / 83 |
| Anteil Attribute ≥ 95 / ≥ 99 | 1,3 % / 0,2 % |
| Eignung je Disziplin, Mittel über die 15: P10 / Median / P90 | 15,9 / 38,3 / 60,7 |
| 6,5 % auf die Eignung: P10 / Median / P90 | +1,0 / +2,5 / +3,9 Punkte (starker Spieler bekommt das **3,8-Fache**) |
| Mutator-Traits je Spieler Ø / P(0, 1, 2 Treffer) | 3,47 / 81,5 %, 17,7 %, 0,8 % |

Die Obergrenze 99 ist praktisch kein Thema: nur 2,2 % der Attributwerte gingen bei 6,5 % über 99,
bei +3,5 flach ≈ 1 % (+3: 0,8 %, +4: 1,2 %). Das eigentliche Problem des Prozentbonus ist nicht der Headroom, sondern dass er
die absoluten Punkte nach Stärke staffelt.

**Was die Simulation daraus macht** (PP-Zugewinn des getroffenen Spielers je Treffer, Mittel über
die 15 Disziplinen, jede gleich gewichtet; Drittel = Eignung in der Disziplin):

| Regel | Ø ΔPP | schwaches Drittel | mittleres | starkes Drittel | stark ÷ schwach |
|---|---:|---:|---:|---:|---:|
| flach +3 | 0,256 | 0,152 | — | 0,334 | 2,2× |
| flach +4 | 0,355 | 0,215 | — | 0,474 | 2,2× |
| prozentual 6,5 % (14 Disziplinen, Breaking ohne) | 0,309 | 0,143 | — | 0,453 | 3,2× |
| zum Vergleich: die abgelösten 0,3 PP | 0,300 | 0,300 | 0,300 | 0,300 | 1,0× |

Je Disziplin (ΔPP Spieler, flach +3 / flach +4 / 6,5 %): Basketball 0,33/0,53/0,41 · Hockey
0,19/0,23/0,21 · Gewichtheben 0,22/0,31/0,25 · Speed-Schach 0,26/0,35/0,33 · Tennis 0,23/0,31/0,27 ·
Fechten 0,20/0,26/0,24 · Showcase 0,23/0,32/0,28 · Eiskunstlauf 0,26/0,36/0,32 · Wettessen
0,23/0,32/0,28 · Breaking 0,21/0,28/— · Staffel 0,29/0,40/0,35 · Takeshi's Castle 0,20/0,34/0,24 ·
Time-Trial 0,27/0,34/0,33 · Spurt 0,37/0,54/0,43 · Climbing 0,36/0,46/0,38. Rohdaten inkl. flach
+2/+6 und 5/8 % entstehen mit `npx tsx scripts/miss-mutator-wirkung.ts --n=6 --regeln=…`.

**Entscheidung: flach, +3,5 Punkte auf jedes der zwölf Attribute je Treffer.**

1. **Chris' Zahl stimmt — als Mittelwert.** 6,5 % bringen im Mittel 0,31 PP, also genau die 0,3,
   die er sich erhofft hat. Das Problem ist die Verteilung.
2. **Prozentual staffelt nach Stärke.** Bei gleichem Mittelwert bekommt das starke Drittel mit
   Prozent das 3,2-Fache des schwachen, flach das 2,2-Fache (Speed-Schach: 0,09 → 0,60 prozentual
   gegen 0,11 → 0,41 flach +3). Die abgelösten 0,3 PP waren für jeden gleich. Flach bleibt dem am
   nächsten und ist das, was „nicht zu stark" bei den Stärksten heißt.
3. **Warum auch flach die Starken noch bevorzugt:** die Impact-Kurve der Arena-PP
   (`ppsAusArenaImpact`, `(I/I_krass)^γ` mit γ > 1) ist konvex — derselbe Zugewinn an Boxscore ist
   für einen Spieler hoch auf der Kurve mehr PP wert. Das liegt an der PP-Umrechnung, nicht am
   Mutator, und betrifft jeden Leistungszuwachs gleich (Form, Slot, Attribute). Hockey ist die
   Ausnahme in die andere Richtung (dort profitieren Schwache mehr, weil Starke schon nahe am
   Kurvendeckel liegen).
4. **Höhe:** zwischen +3 (0,256) und +4 (0,355) linear interpoliert liegen 0,30 PP bei ≈ +3,45;
   gewählt ist **+3,5**. Das sind 7,6 % des Median-Attributs (45,8) bzw. 9,1 % der Median-Eignung
   (38,3) — am oberen Rand von Chris' Korridor, weil flache Punkte bei Schwachen relativ mehr
   bedeuten. Zwei Treffer (0,8 % der Einsätze) geben linear +7.

### 11.2 Was gebaut ist

**Engine (`public/mockups/battle-mode.engine.js`)**

- `MUTATOR_ORGANISCH={art:"flach", jeTreffer:3.5}` — gespiegelt in
  `lib/battle/battle-mutator-organisch.ts`, Gleichheitstest in `tests/battle-mutator-organisch.test.ts`.
- `mutatorTreffer(p)`: Trefferzahl wie `countTraitHits()` (alle positiven und negativen Traits,
  klein geschrieben, dedupliziert).
- **Injektionspunkt:** `gehoben(p)` — die eine Stelle, an der alle vier Chassis Rohattribute lesen —
  gibt jetzt `mitMutator(hebungRoh(p), h)` zurück: alle zwölf Attribute `+3,5·h`, nach dem
  Messhebel `ATTR_HEBUNG`, vor Slot-/Form-Aufschlag und vor jedem Rezept. Kein Deckel bei 99/100
  (effektive Attribute dürfen wie bei `mitAufschlag` darüber, die 1–99-Klemme der Rezeptwerte in
  `mische()` bleibt).
- **Eignung:** `eigMutator(p,d)` (= gewichtete Attributsumme mit minus ohne Bonus, flach exakt
  `3,5·h`) geht **genau dort** in `eig` ein, wo auch der Pp-Hebel `eigHebung()` eingeht: Kampf
  (`baueEinheit`, über `aufEignung()` in die Kampfwerte), Bahn (`eig`, Staffel- und Takeshi-Menge).
  Feldspiel und Bühne führen `eigHebung` nicht in `eig` (dort ist `eig` nur Fokusziel/Reihenfolge),
  also auch den Mutator nicht. Damit erreicht der Mutator **exakt die Kanäle, die `einflussVon()`
  misst**.
- **Kampf:** der alte `+tr.netto`-Weg (+6 auf die zwei Slot-Fokus-Attribute) ist ersetzt, nicht
  ergänzt — sonst hätte der Kampf doppelt gebucht, weil `gehoben()` von allen vier Chassis geteilt
  wird.
- **Wurf:** `__olyArenaKader.mutatoren` (echter Spieltagswurf) hat Vorrang; `zieheMutatoren` zieht
  jetzt wie die Produktion **2 verschiedene aus 36** (obere LCG-Bits), nur noch für Mockup und
  Messungen ohne Wurf. Der interaktive Host reicht `mutatorenByDisciplineId` (denselben Wurf wie
  Resolve und Spielplan); eine Disziplin, die an diesem Spieltag nicht gespielt wird, bekommt dort
  keinen Mutator.
- **Messwerkzeuge:** `disziplinProbe(d,{mutatoren:"je-spiel"|"aus"|"fest"})` (Standard „je-spiel",
  rho gegen `eigOhneMutator`), `einflussVon(d,n,plus,versatz,"je-lauf"|"aus"|"fest")` (Standard
  „je-lauf": Lauf i zieht seinen Wurf aus einer Saat, die nur von i abhängt — Grund- und jeder
  Hebungslauf sehen denselben Wurf, gepaart), `mutatorGegenfaktus()`, `mutatorRegel()`.
  Schalter in den Skripten: `miss-alle-disziplinen.mjs --mutatoren=…`,
  `messe-arena-einfluss.mjs --mutatoren=… --saat-versatz=N`.
- **Anzeige:** Traitzeile und Aufschlüsselung zeigen „+3,5 auf jedes Attribut je Treffer" statt
  „+6", die Kopfchips färben je Trait nach Polarität (seit „2 aus 36" können beide positiv sein).

**Produktion (TS)**

- Transport: `arena-matchday-resolve-service.ts` berechnet den Wurf je arena-aufgelöster Disziplin
  aus **denselben** geladenen Contexts, aus denen der Resolve würfelt
  (`resolveMatchdayMutatorTraitsForDiscipline`), → `runBattleModeArenaMatchday({matchdayMutatorTraits})`
  (Rückfall ohne Angabe: aus dem Spielplan, `resolveMutatorTraitsFromSchedule`) →
  `runArenaFixtures({mutatoren})` → `__olyArenaKader.mutatoren` (Init-Script **und**
  Neu-Einhängen ab Fixture 2). Ohne Angabe schickt der Runner `[]` — nie den engine-eigenen
  Ersatzwurf (Referenzziehungen, Tests, Mini-DM-Pods bleiben mutatorfrei).
- Doppelbuchung: `legacy-matchday-resolve-engine.ts` wendet `toBattleArenaOrganicMutatorResult()`
  an, wenn **Battle-Save und Arena-Override für genau dieses Team in genau dieser Disziplin**
  vorliegen: `+6`, `+0,3` und Seiten-Summe auf 0, Slot-Ausweise auf 0, Trefferzahl bleibt.
  Manager-Modus, die fünf nicht simulierten Battle-Disziplinen und ein Team, dessen Arena-Lauf
  ausgefallen ist (PPS-Rückfall ohne Simulation), behalten `+6`/`+0,3`.
- Neues optionales Feld `mutatorHits` (Score-Eintrag → Preview → `PlayerDisciplinePerformanceRecord`),
  damit die Spielplan-Mutatorspalte Arena-Treffer ohne flachen Bonus weiter zählt
  (`spielplan-mutator-summary.ts`, Rückfall `Bonus/6` für ältere Zeilen).

### 11.3 Abnahme

**Bitgleichheit ohne Treffer.** Mit `mutatoren:"aus"` liefert die neue Engine in Feldspiel, Bühne
und Bahn **bitgleich** dieselben Zahlen wie `main` (geprüft: `disziplinProbe` für Basketball,
Gewichtheben, Tennis, Showcase, Breaking, Staffel, Takeshi, Climbing per Hash; `einflussVon` für
Spurt n=6 identische Ausgabe, 14,9 Pp). Jede Abweichung unten kommt also allein vom Mutator. Für
Nicht-Kampf-Disziplinen ist „aus" damit die Vorher-Zahl; für den Kampf (dort ist der alte
`+tr.netto`-Weg ersetzt) ist die Vorher-Zahl die echte `main`-Engine.

#### rho je Einzelspiel (`miss-alle-disziplinen.mjs 24`, kaderfest, Live-Kaderfamilie)

Vorher = `main` (Healthy/Renegade fest, wirkte nur im Kampf); nachher = neue Engine, Standard
„je-spiel" (jedes Spiel zieht seinen Wurf wie im Spiel, rho gegen `eigOhneMutator`).

| Disziplin (arena-aufgelöst fett) | vorher | nachher | Δ |
|---|---:|---:|---:|
| **Time-Trial** | 0,929 | 0,923 | −0,006 |
| **Speed-Schach** | 0,906 | 0,898 | −0,008 |
| **Spurt** | 0,906 | 0,880 | −0,026 |
| **Staffel** | 0,899 | 0,898 | −0,001 |
| **Eiskunstlauf** | 0,878 | 0,866 | −0,012 |
| **Takeshi's Castle** | 0,874 | 0,871 | −0,003 |
| **Wettessen** | 0,872 | 0,866 | −0,006 |
| **Showcase** | 0,845 | 0,835 | −0,010 |
| **Gewichtheben** | 0,843 | 0,836 | −0,007 |
| **Breaking** | 0,833 | 0,808 | −0,025 |
| **Fechten** | 0,832 | 0,860 | +0,028 |
| **Tennis** | 0,827 | 0,813 | −0,014 |
| Football | 0,818 | 0,814 | −0,004 |
| **Climbing** | 0,814 | **0,791** | −0,023 |
| **Basketball** | 0,769 | 0,756 | −0,013 |
| I-Spy | 0,756 | 0,750 | −0,006 |
| **Hockey** (nur Feldspieler) | 0,686 (0,725) | 0,640 (0,676) | −0,046 (−0,049) |
| TDM | 0,306 | 0,404 | +0,098 |
| Battlefield | 0,392 | 0,399 | +0,007 |
| Mini-DM | 0,394 | 0,321 | −0,073 |

**Der Einzelsatz täuscht — nachgemessen, wie viel davon Mutator ist.** Ein Treffer ändert die
Attribute eines Spielers und damit den gesamten Zufallsverlauf des Spiels; ein Vorher/Nachher an
einem einzigen Saatsatz vergleicht deshalb zwei verschiedene Realisierungen. Zwei getrennte Proben:

1. **Andere Mutator-Ströme, gleiche Spiele** (`disziplinProbe({mutatorSaat})`, 4 Ströme, +3,5):
   Climbing 0,791/0,800/0,803/0,794 (Mittel 0,797), Breaking 0,808/0,818/0,818/0,808 (0,813),
   Spurt 0,880/0,877/0,910/0,898 (0,891), Tennis 0,813/0,814/0,827/0,831 (0,821).
2. **Gepaart über sechs Spiel-Saatsätze** (`saat0` = 1337, 91337 … 491337), Climbing:
   ohne Mutator 0,814/0,807/**0,799**/0,809/0,815/0,804 (Mittel **0,808**) — Climbing liegt also
   schon ohne Mutator auf der Schranke, ein Saatsatz darunter. Mit +3,5: Mittel **0,801**,
   gepaartes Δ **−0,007**; mit +2,5 ebenso 0,801 / −0,007.

**Befund:** der systematische Mutator-Effekt auf rho liegt bei Climbing bei −0,007 und hängt
zwischen +2,5 und +3,5 nicht messbar von der Höhe ab — ein kleinerer Bonus würde rho nicht retten,
nur den PP-Wert senken. Alle arena-aufgelösten Disziplinen, die vorher bestanden, bestehen im
Mittel über Ströme bzw. Saatsätze weiter; **Climbing landet mit 0,801 genau auf der Schranke**,
und am Standard-Saatsatz der nächtlichen Prüfung (`pruefe-rangtreue-schranke.mjs`) mit 0,791
darunter. Einen Bonus danach auszusuchen, welcher Zufallszug an diesem einen Saatsatz über 0,80
landet (+2,5 träfe dort zufällig 0,806), wäre Messkosmetik und ist deshalb nicht gemacht.
Hockey (−0,046) war schon vorher durchgefallen und ist die rauschstärkste Feldspiel-Disziplin
(Spannweite 0,22); Kampf (TDM/Battlefield/Mini-DM) ist nicht arena-aufgelöst, dort wirkt in der
Wertung weiter `+6`/`+0,3`, die Engine-Zahlen schwanken mit Spannweiten 0,67–0,93.

#### Pp-Abweichung

PP_PLATZHALTER

### 11.4 Was offen bleibt

OFFEN_PLATZHALTER

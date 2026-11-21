# PP-Analyse: Klumpen bei 5, Hockey/Spurt unter 5, Score ≠ PP (21.11.)

Anlass: Chris' Beobachtungen in „Top-Spieler · Player-Points des Spieltags" am Live-Save
`new-game-1795114260527-nzr0z9` (Battle Mode, 2 Ligen à 16, Saison 1, Spieltage 1–11 gebucht, Stempel
`wertungsSkalen = { pp: "c2", ergebnis: "e1" }`):

- Eiskunst: Platz 1–9 alle glatt 5 PP bei Scores 140,9 … 66,9; Queen Loriana (Score 153,8) nur 4,83 PP, Platz 12.
- Hockey: niemand erreicht 5 PP.
- Spurt: niemand bei 5 (Top 3,59); Kelektros Score 142,7 → 1,24 PP, Mimic 99,8 → 3,49, Burster 63,4 → 3,59.

Chris: PP müssen nicht 1:1 dem Score folgen, sie sollen den Impact in der Simulation abbilden — aber solche
Ausreißer in einer rangtreuen Disziplin sind zu groß. Grundsatz: PP werden je Spieltag über **alle Spieler beider
Ligen** verteilt (PP-Ränge OLY-weit, All-Time-PP lohnt sich); Marktwerte und VK gelten über beide Ligen zusammen.

Alles hier ist **Analyse und Vorschlag**. Der Prototyp (Abschnitt 5) ist **Standard AUS**; ohne Schalter ist jede
Rechnung bit-identisch, der Wertungs-Fingerabdruck läuft nur über den Motor und ist unberührt (Abschnitt 7).

---

## 0. Kurzfassung

1. **„Score" und „PP" messen in Arena-Disziplinen zwei verschiedene Dinge.** Der Score in der Liste ist
   `finalPlayerScore` aus der Score-Engine *vor* dem Lauf (Eignung × Form, Ermüdung, Kapitän, Mutator,
   Teameffekte) — die Erwartung. Die PP kommen aus dem Boxscore-Wert des Motors (`wert`) — die Leistung im Lauf.
   Eine Abweichung zwischen beiden ist also kein Fehler, sondern Simulation. Das gilt für alle 22 gebuchten
   Disziplin-Tage des Saves (alle `arena` bzw. `mini_dm_pod` mit Motor-Quelle).
2. **Der Klumpen bei 5 ist der harte Deckel der C2-Skala.** C2 legt die Kurve auf zwei *feste* Anker je Disziplin
   und Feldgröße und schneidet bei 5 ab. Ist das Feld eines Spieltags stärker als in der Kalibrierung, stehen
   mehrere Spieler gleichauf bei 5,0 (Eiskunst ST 1: **9**, Climbing ST 4: **16**, Time-Trial ST 5: **16**,
   Football ST 5: **9**); ist es schwächer, erreicht niemand 5 (Hockey **4,39**, I-Spy 4,66, Showcase 4,11,
   Spurt **3,59**). Das ist die in `pp-skala-18-11.md` Abschnitt 0 Punkt 7 schon benannte Grenze eines festen Ankers.
3. **Spurt/Climbing/Time-Trial/Staffel vergeben PP nach Platz im eigenen Lauf.** Der Motor liefert für Bahn-
   Disziplinen Platzpunkte (`bahnTeamstand().punkte`), keinen stetigen Leistungswert. Spurt hat damit an
   Spieltag 8 genau **4 Stufen** (3,29 / 1,24 / 0,31 / 0,03, plus ≤ 0,5 Stationsduell-Bonus), Climbing **10 Stufen
   à 16 Spieler**. Kelektros (Score #1) lief in seinem Viererlauf auf Platz 2 → 1,24 PP; alle 16 Laufsieger
   (Scores 39,4 bis 99,8) bekommen 3,29 bis 3,59. Das ist „PP nach Rang in der Paarung", keine Fehlrechnung — aber genau die Art
   Ausreißer, die Chris meint. Keine Skala behebt das; dafür braucht der Motor einen stetigen Bahn-Wert
   (Abschnitt 6, Stufe 2).
4. **Vorschlag Stufe 1 (Prototyp, Schalter `OLY_PP_TAGESANKER=an`): „Tagesanker OLY-weit + weiche Kappe".**
   Je Disziplin und Spieltag über alle Spieler beider Ligen: der ungedeckelte C2-Wert wird so skaliert, dass das
   Mittel der besten drei bei 5,5 liegt, danach eine glatte Kappe ab 4 mit Asymptote 5. Ergebnis an einer frischen Sonde
   (Abschnitt 4.1, 40 Disziplin-Tage): Tagesbester in **jeder** Zelle zwischen 4,78 und 4,96 (heute 3,94–5,00),
   **kein einziger Spieler mehr glatt bei 5** (heute 134 Zeilen, 14 Zellen mit ≥ 3 Fünfern), die
   Reihenfolge innerhalb eines Spieltags bleibt exakt die des Impacts (Spearman Impact↔PP unverändert), der
   Median-Einsatz 1,12 → 1,16, Spieler-Saisonsumme ×1,05.
5. **Liga-Sicht**: PP, MVS-Rang, Marktwert-Rangtabelle und VK-Brackets werden heute schon über **alle** Spieler
   beider Ligen gerechnet. Ligaweit sind nur Anzeigen: der PP-Rang im Spielerprofil (`ppLigaRang`,
   `ppGesamtLigaRang`) und der Liga-Filter der Liga-Leaders (Standard „Liga 1"). Abschnitt 8 listet die Stellen.

---

## 1. Heutige PP-Vergabe (Code-Pfad)

Battle-Save, Saison mit Stempel `pp: "c2"` (`lib/resolve/wertungs-skalen.ts`). Für jede Disziplin, deren
Ergebnis der Motor liefert (`resolutionSource: "arena"` oder `"mini_dm_pod"` mit `quelle: "ffa" | "bahn"`):

| Schritt | Was | Wo |
|---|---|---|
| 1. Score | `finalPlayerScore` = `entry.finalContribution` der Score-Engine (Eignung × Form, Ermüdung, Verletzung, Kapitän, Mutator, Intensität/Slot/Teameffekt), ggf. × Team-Debuff | `lib/resolve/legacy-matchday-resolve-engine.ts:1204`, `:1324`; Score-Engine `lib/lineups/legacy-score-engine.ts:389–561` |
| 2. Impact | Motorlauf je Paarung (beide Ligen parallel), Boxscore je Spieler `{ name, wert }`. Bühne (Eiskunst, Showcase, Wettessen; Duell-/Gauntlet-Bühnen wie Tennis, Fechten, Breaking analog gegen einen Gegner): `wert = u.summe` (Punktsumme der Durchgänge); Bahn (Spurt, Climbing, Time-Trial): `wert = bahnTeamstand().punkte` = **Platzpunkte im eigenen Lauf**; Staffel/Takeshi als Vier-Team-Pod mit Pod-Boxscore; Feldspiel (Hockey, Basketball, Football): Boxscore-Impact | `public/mockups/battle-mode.engine.js:71922` (`spieleBuehneAuftritt`), `:71996` (`spieleBahn`, `:72004` Platzpunkte), `lib/resolve/battle-mode-arena-team-points.ts:1504` (`runBattleModeArenaMatchday`) |
| 3. Kurve (alt) | `roh = 5,5 · (max(0, wert) / I_krass)^γ`, `γ = ln 0,25 / ln(I_mittel / I_krass)`; Referenz je Disziplin und Feldgröße aus `data/generated/<d>-pps-referenz.json` | `lib/resolve/pp-skala.ts:142` (`ppAusKurveSkaliert`) |
| 4. C2-Normierung | je Disziplin **und Feldgröße** feste Anker aus `data/generated/pp-skala-kalibrierung.json`: `PP = 5 · (roh / R_top)^e`, `e = ln 0,25 / ln(R_med / R_top)` | `lib/resolve/pp-skala.ts:113` (`skaliereUngedeckelt`), Anker `ppSkalaAnker` |
| 5. Zuschlag | nur Spurt: +0,1 je gewonnenem Stationsduell, max. 0,5 (vor dem Deckel) | `battle-mode-arena-team-points.ts:442` (`ppsAusStationsduellen`) |
| 6. **Kappung** | `min(5, …)` — **harter Deckel** | `lib/resolve/pp-skala.ts:134` |
| 7. Rundung | 2 Nachkommastellen (`runde2`) | `lib/resolve/pp-skala.ts` (`runde2`) |
| 8. Sammlung | EINMAL über alle Fixtures **beider Ligen** des Spieltags (`alleFixtureErgebnisse`), Map Spieler → PP | `battle-mode-arena-team-points.ts:1263` (`computeIndividualBoxscorePpsFromFixtureResults`), `:1642`; Pods: `bahn-pod-matchday.ts`, `battlefield-pod-matchday.ts`, `mini-dm-ffa-matchday.ts` |
| 9. Persistenz | `pointsAwarded` → `scoreContribution` der Leistungszeile | `legacy-matchday-resolve-engine.ts:1336`, `legacy-matchday-result-mapper.ts:327` |
| 10. Ledger | Arena-/Pod-Zeilen: persistierter Wert wird **vertraut**, nicht neu gerechnet; `+ mutatorPpsBonus` | `lib/foundation/season-points-ledger.ts:261`, `:275`; `lib/foundation/player-points-total.ts` |
| 11. Anzeige | „Top-Spieler · Player-Points des Spieltags": Summe je Spieler über d1+d2, sortiert nach PP, **Tiebreak Score**, Top 24 | `lib/foundation/discipline-stage/discipline-stage-matchday-top-players.ts:118`, `app/foundation/discipline-stage/DisciplineStageTopPlayers.tsx` |

Kein Team-Bonus, keine Normierung je Paarung oder Liga in der Kurve selbst: der einzige Paarungsbezug steckt im
Motor-`wert` der Bahn-Disziplinen (Platz im Lauf). Der Mutator-Aufschlag ist auf diesem Save überall 0.

Fallback ohne Motor (`resolutionSource: "pps_duell"` / Mini-DM-Pod ohne Quelle): der Ledger rechnet die PP aus
`finalPlayerScore` mit derselben Kurve neu (`season-points-ledger.ts:314`). Auf diesem Save kommt der Pfad nicht vor.

---

## 2. IST am Live-Save (alle Disziplinen, OLY-weit)

Quelle: Kopie des Spiegels `live-save` vom 21.11. 15:10, Ledger über `buildSeasonPointsLedger()`, 2.766 PP-Zeilen.
Je Disziplin-Spieltag über **alle Spieler beider Ligen**. „Eignung" = `baseValue` (Basis-Diszi-Score ohne Form).
„PP-Stufen" = Zahl verschiedener PP-Werte im Feld.

| Disziplin | ST | Format | n | rho Score↔PP | rho Eignung↔PP | Max-PP | glatt 5,0 | PP-Stufen | Median L1 / L2 |
|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| basketball | 7 | arena | 128 | 0,74 | 0,50 | 5,00 | 1 | 103 | 1,12 / 1,13 |
| battlefield | 2 | mini_dm_pod/ffa | 152 | 0,68 | 0,46 | 5,00 | 2 | 108 | 1,09 / 0,97 |
| breaking | 7 | arena | 64 | 0,66 | 0,37 | 5,00 | 3 | 57 | 1,40 / 1,38 |
| breaking | 11 | arena | 128 | 0,77 | 0,65 | 5,00 | 4 | 104 | 1,46 / 1,02 |
| climbing | 4 | arena | 160 | 0,66 | 0,46 | 5,00 | **16** | **10** | 1,52 / 1,52 |
| eiskunstlauf | 1 | arena | 192 | 0,92 | 0,69 | 5,00 | **9** | 131 | 0,99 / 0,57 |
| eiskunstlauf | 11 | arena | 126 | 0,81 | 0,66 | 5,00 | 2 | 106 | 1,56 / 1,02 |
| fechten | 9 | arena | 96 | 0,91 | 0,77 | 5,00 | 5 | 78 | 1,15 / 0,86 |
| football | 5 | arena | 96 | 0,50 | 0,50 | 5,00 | **9** | 63 | 1,02 / 1,08 |
| gewichtheben | 9 | arena | 160 | 0,88 | 0,77 | 5,00 | 3 | 120 | 1,60 / 1,17 |
| hockey | 3 | arena | 128 | 0,67 | 0,54 | **4,39** | 0 | 103 | 1,23 / 1,06 |
| i-spy | 6 | arena | 64 | 0,79 | 0,74 | 4,66 | 0 | 50 | 0,48 / 0,38 |
| mini-dm | 2 | mini_dm_pod/ffa | 188 | 0,82 | 0,69 | 5,00 | 2 | 132 | 1,69 / 0,94 |
| showcase | 8 | arena | 64 | 0,75 | 0,63 | 4,11 | 0 | 52 | 0,51 / 0,40 |
| speed-schach | 3 | arena | 128 | 0,93 | 0,86 | 5,00 | 3 | 94 | 1,08 / 0,55 |
| spurt | 8 | arena | 64 | 0,61 | 0,48 | **3,59** | 0 | **13** | 0,93 / 1,02 |
| staffel | 10 | mini_dm_pod/bahn | 180 | 0,92 | 0,72 | 5,00 | 3 | 24 | 1,05 / 1,25 |
| takeshis-castle | 10 | mini_dm_pod/bahn | 168 | 0,90 | 0,78 | 5,00 | 1 | 97 | 1,01 / 0,19 |
| tdm | 4 | arena | 96 | 0,58 | 0,62 | 5,00 | 1 | 81 | 0,96 / 1,29 |
| tennis | 6 | arena | 160 | 0,82 | 0,66 | 5,00 | 3 | 115 | 0,84 / 0,92 |
| time-trial | 5 | arena | 128 | 0,75 | 0,61 | 5,00 | **16** | 88 | 1,50 / 1,44 |
| wettessen | 1 | arena | 96 | 0,89 | 0,87 | 5,00 | 3 | 78 | 1,67 / 0,41 |

Summe: **103 von 2.766 Zeilen (3,7 %) glatt 5,0**, in 18 von 22 Disziplin-Tagen liegt der Tagesbeste auf dem Deckel,
in vier darunter. **Impact↔PP** lässt sich am Save nicht messen (der Motor-`wert` wird nicht persistiert); laut
Code ist PP eine streng monotone Funktion des Impacts bis zum Deckel — die Korrelation ist also 1, nur oberhalb von
5 gehen alle Unterschiede verloren. An der frischen Sonde gemessen (Abschnitt 4.1): Spearman Impact↔PP je Zelle 0,99–1,00 — die
fehlenden Hundertstel sind genau die Gleichstände am Deckel.

### 2.1 Die gemeldeten Fälle

**Eiskunst ST 1** (Top 14 nach PP, Liste wie in der App: PP, Tiebreak Score):

| # | Spieler | Liga | Score | Eignung | PP |
|---:|---|---|---:|---:|---:|
| 1 | Van Zorring | L1 | 140,9 | 76,9 | 5,00 |
| 2 | Sunny | L1 | 108,9 | 81,8 | 5,00 |
| 3 | Passion | L1 | 91,9 | 78,2 | 5,00 |
| 4 | Nebelkind | L1 | 84,8 | 75,1 | 5,00 |
| 5 | Prince Charming | L1 | 83,5 | 68,2 | 5,00 |
| 6 | Com Clarksson | L1 | 83,2 | 53,9 | 5,00 |
| 7 | Issyria | L1 | 78,3 | 59,4 | 5,00 |
| 8 | Lyselith | L1 | 77,0 | 55,2 | 5,00 |
| 9 | Nefar Safety | L1 | 66,9 | 47,3 | 5,00 |
| 10 | Zephyra | L1 | 137,6 | 87,9 | 4,94 |
| 11 | Nefruet Pixelwick | L1 | 61,8 | 51,5 | 4,87 |
| 12 | Queen Loriana | L2 | 153,8 | 90,8 | 4,83 |
| 13 | Violetscale | L1 | 145,7 | 89,8 | 4,23 |
| 14 | Aerius Marrel | L1 | 60,1 | 44,3 | 4,21 |

Erklärung: Die neun Fünfer haben im Lauf einen Impact über dem festen Anker `R_top` erzielt; ihre Reihenfolge
untereinander ist durch den Deckel **verloren** und wird in der Liste nur noch über den Score (die Erwartung)
sortiert — deshalb sieht es so aus, als stünden Scores 140,9 bis 66,9 „gleich". Queen Loriana liegt unter allen
neun: ihre 4,83 sind ungedeckelt, die neun hatten im Lauf mehr Punkte. Dass sie trotzdem Score #1 ist, ist
Simulation (12 Durchgänge mit Sturz-Abzug, Duett 80/20 mit dem Nachbarn nach Eignung) — in der ganzen Disziplin
korrelieren Score und PP mit 0,92, das ist eine der rangtreuesten Disziplinen. Der eigentliche Mangel ist der
Gleichstand der neun, nicht ihre Lage.

**Hockey ST 3**: Mittel der besten drei 4,18, Max 4,39. Die Spitze dieses Feldes lag unter dem festen Hockey-Anker
`R_top` der fünf Kalibrier-Saves — kein Mangel einzelner Spieler, sondern der feste Anker.

**Spurt ST 8**: 64 Einsätze, 16 Läufe à 4 (2 je Team). PP-Stufen:

| Platz im Lauf | PP ohne Duell-Bonus | Spieler | davon mit Bonus |
|---|---:|---:|---|
| 1 | 3,29 | 16 | 4 (3,39–3,59) |
| 2 | 1,24 | 16 | 3 (1,44–1,64) |
| 3 | 0,31 | 16 | 4 (0,51–0,81) |
| 4 | 0,03 | 16 | 2 (0,23) |

Kelektros (L1, Score 142,7, Eignung 98,2 — beides #1 des Feldes) wurde in seinem Lauf Zweiter hinter Teamkollege Venosk
(Score 49,1, 3,29 PP). Mimic (99,8 → 3,49) und Burster (63,4 → 3,59) gewannen ihre Läufe, Burster mit
drei Stationsduellen. Die PP folgen also dem Platz gegen genau drei Gegner, nicht der Leistung im Feld aller 64.

### 2.2 Weitere Ausreißer (Score-Top-5 des Feldes, PP-Rang > 20)

| Disziplin | ST | Spieler | Score (#) | Eignung | PP (#) | Erklärung |
|---|---:|---|---|---:|---|---|
| basketball | 7 | Serilith (L1) | 91,6 (#5) | 69,0 | 1,59 (#32) | Einzelspiel-Rauschen (Feldspiel-Impact) |
| breaking | 7 | King Leoric (L2) | 116,1 (#1) | 93,4 | 1,74 (#25) | Einzelspiel-Rauschen (Zweikampf-Gauntlet, Gegner-abhängig) |
| breaking | 11 | Aztec (L1) | 81,2 (#5) | 76,5 | 2,04 (#35) | dto. |
| climbing | 4 | Galactus (L1) | 99,2 (#3) | 74,6 | 2,45 (#51) | **Platz 4 von 10 im eigenen Lauf** (Platzpunkte) |
| eiskunstlauf | 11 | Marzipella (L2) | 94,5 (#2) | 64,8 | 2,08 (#36) | Einzelspiel-Rauschen (12 Durchgänge mit Sturz-Abzug) |
| eiskunstlauf | 11 | Midnight (L1) | 80,8 (#5) | 53,8 | 1,35 (#61) | dto. |
| football | 5 | Eisenherz (L1) | 104,4 (#3) | 68,7 | 0,74 (#57) | Einzelspiel-Rauschen (Feldspiel); Football rho Score↔PP 0,50 |
| gewichtheben | 9 | Harold (L2) | 83,7 (#5) | 61,0 | 2,13 (#44) | Einzelspiel-Rauschen (Zweikampf je Slot, Fehlversuche) |
| hockey | 3 | Abysskraken (L1) | 130,7 (#3) | 80,2 | 2,47 (#27) | Einzelspiel-Rauschen (Feldspiel) |
| spurt | 8 | Zeynorr Driftblade (L1) | 81,7 (#3) | 57,3 | 1,24 (#21) | **Platz 2 im Viererlauf** |
| spurt | 8 | Nytharos (L1) | 71,9 (#4) | 73,2 | 1,24 (#22) | **Platz 2 im Viererlauf** |
| tdm | 4 | Grok'Na (L1) | 127,5 (#2) | 89,8 | 2,91 (#21) | Einzelspiel-Rauschen (Kampf) |
| tennis | 6 | Verla Compliance (L1) | 101,9 (#5) | 71,1 | 1,96 (#25) | Duell-Bühne: eigene Punkte hängen am Gegner am Brett |
| time-trial | 5 | Therella (L2) | 116,4 (#3) | 65,8 | 3,77 (#22) | **nicht Laufsieger** — alle 16 Laufsieger glatt 5,0 |
| time-trial | 5 | Flayed Star Reaver (L1) | 113,1 (#5) | 75,0 | 2,56 (#41) | dto. |

Zwei Sorten: (a) **Paarungs-Platzpunkte** (Spurt, Climbing, Time-Trial) — strukturell, Abschnitt 6; ein
schwächerer Verwandter davon sind die Duell-Bühnen (Tennis, Speed-Schach, Fechten, Gewichtheben), deren `wert`
die eigenen Punkte gegen genau einen Gegner sind; (b) **Rauschen des Einzelspiels** in Disziplinen mit niedriger
Einzelspiel-Rangtreue (Football, TDM, Hockey, Breaking) — Motorthema (rho-Abnahme), keine PP-Frage. Die Liga-Mediane zeigen keinen Fehler: Liga 1 ist
stärker und sammelt im gemeinsamen Feld mehr PP — genau das, was „OLY-weit verteilen" heißen soll.

---

## 3. Warum der feste Anker nicht reicht

C2 (`pp-skala-18-11.md`) hat das richtige Ziel („Top um 5"), trifft es aber nur **im Mittel über Spieltage**: der
Anker `R_top` ist der Median der Tagesbesten über fünf kalibrierte Saves. Ein einzelner Spieltag streut darum —
an der frischen Sonde (Abschnitt 4.1) lag der ungedeckelte Tagesbeste zwischen dem **0,79- und 1,66-fachen** des
Ankers (p10 0,89, Median 1,06, p90 1,44), in 22 von 40 Zellen darüber, in 5 unter 0,9. Oberhalb schneidet der Deckel
ab (Gleichstand), unterhalb bleibt der Tag ohne 5er. Der harte Deckel macht aus einer streuenden Spitze einen
Klumpen — und Climbing/Time-Trial/Staffel liefern über die Platzpunkte schon von sich aus Gleichstände an der Spitze.

---

## 4. Vorschlag Stufe 1: Tagesanker OLY-weit + weiche Kappe (Prototyp)

Je Disziplin und Spieltag, über **alle Spieler beider Ligen** (dieselbe Sammlung wie heute, Schritt 8):

    u_i   = C2-Wert ohne Deckel           (dieselbe Impact-Kurve, nur ohne min(5, ·))
    A     = Mittel der drei größten u_i   (Tagesanker, robust gegen einen einzelnen Ausreißer)
    x_i   = u_i · 5,5 / A
    PP_i  = x_i                                        für x_i ≤ 4
    PP_i  = 4 + 1 · (1 − exp(−(x_i − 4) / 1))          für x_i > 4     (Asymptote 5, nie erreicht)

Eigenschaften: streng monoton im Impact (Reihenfolge = Simulation), unter 5, stetig und glatt am Knie (Steigung 1),
ein Faktor je Spieltag (reiner Maßstab — Rangtreue und Pp-Abweichung unberührt), unabhängig davon, ob das Feld
an diesem Tag stark oder schwach war. Ein Spieler, der in seinem Lauf mehr Impact hatte als ein anderer, bekommt
weiterhin mehr PP; zwei Spieler mit **gleichem** Impact (Platzpunkte!) bleiben gleich — Abschnitt 6.

Parameterwahl (Gitter `β ∈ {0; 0,5; 0,75; 1}` für `x = u · (Z/A)^β`, `Z ∈ {5; 5,5; 6}`, `K ∈ {3,5; 4}` an der
roh-Sonde vom 18.11., 4.966 Zeilen): `β = 1, Z = 5,5, K = 4` ist die kleinste Wahl, bei der der Tagesbeste in
**allen** 40 Zellen in [4,5; 5) liegt (4,78–4,98) und kein Wert ≥ 5 entsteht; der Median-Einsatz steigt dabei
nur von 1,25 auf 1,33. `β = 0` (nur weiche Kappe, fester Anker) löst den Klumpen, nicht aber Hockey/Spurt-Tage
unter 5; `Z = 5` drückt den Tagesbesten auf 4,6–4,7.

### 4.1 Vorher/nachher an einer frischen Sonde (aktueller Motor, ungedeckelt)

Frischer Battle-Save (32 KI-Teams, 2 × 16, 20 Spieltage, alle 20 Disziplinen je zweimal, 5.019 PP-Zeilen),
gespielt mit `scripts/miss-pp-skala.ts 20` im Messmodus `OLY_PP_SKALA=roh` (ungedeckelt, Arena über den Node-Motor,
Motorstand dieses Branches = main). Dieser Save gehört **nicht** zu den fünf Kalibrier-Saves von C2.
„heute" = C2 mit Deckel 5 (aus dem roh-Wert über die Anker je Disziplin und Feldgröße nachgerechnet),
„Vorschlag" = Tagesanker + weiche Kappe. Je Zelle = Disziplin × Spieltag über beide Ligen.

| | C2 heute | Vorschlag |
|---|---|---|
| Tagesbester (Median, min–max über 40 Zellen) | 5,00 (3,94–5,00) | **4,84 (4,78–4,96)** |
| Zellen mit Tagesbestem in [4,5; 5] | 35 / 40 | **40 / 40** |
| Zeilen glatt 5,0 | 134 (2,7 %) | **0** |
| Zellen mit ≥ 3 Spielern glatt 5,0 | 14 | **0** |
| Zellen mit Gleichstand an der Spitze (Top 1 = Top 2) | 24 | 8 (nur Platzpunkte: Climbing, Staffel, Time-Trial je 2, Spurt 1, Showcase 1) |
| Median-Einsatz | 1,12 | 1,16 |
| Spearman Eignung↔PP (Median der Zellen) | 0,642 | 0,642 |
| Spieler-Saisonsumme Top / Platz 10 / Median | 51,6 / 39,1 / 17,6 | 52,9 / 41,3 / 18,6 (×1,05) |

Je Disziplin:

| Disziplin | Tage | Tagesbester (Median, min–max) heute → Vorschlag | glatt 5,0 heute → Vorschlag | Top1=Top2 heute → Vorschlag | Median-Einsatz heute → Vorschlag | rho Impact↔PP heute → Vorschlag | rho Score↔PP | rho Eignung↔PP |
|---|---:|---|---|---|---|---|---:|---:|
| basketball | 2 | 5,00 (5,00–5,00) → 4,90 (4,90–4,90) | 5 → 0 | 1 → 0 | 0,96 → 0,95 | 1,00 → 1,00 | 0,79 → 0,79 | 0,73 → 0,73 |
| battlefield | 2 | 4,70 (4,51–4,89) → 4,83 (4,79–4,87) | 0 → 0 | 0 → 0 | 1,00 → 1,23 | 0,99 → 0,99 | 0,69 → 0,69 | 0,59 → 0,59 |
| breaking | 2 | 5,00 (5,00–5,00) → 4,94 (4,91–4,96) | 4 → 0 | 1 → 0 | 1,17 → 1,11 | 1,00 → 1,00 | 0,78 → 0,78 | 0,70 → 0,70 |
| climbing | 2 | 5,00 (5,00–5,00) → 4,78 (4,78–4,78) | 32 → 0 | 2 → 2 | 1,43 → 1,58 | 1,00 → 1,00 | 0,62 → 0,62 | 0,58 → 0,58 |
| eiskunstlauf | 2 | 4,01 (3,94–4,09) → 4,80 (4,80–4,81) | 0 → 0 | 0 → 0 | 0,74 → 1,04 | 1,00 → 1,00 | 0,80 → 0,80 | 0,55 → 0,55 |
| fechten | 2 | 5,00 (5,00–5,00) → 4,87 (4,86–4,87) | 9 → 0 | 2 → 0 | 1,25 → 1,13 | 1,00 → 1,00 | 0,85 → 0,85 | 0,70 → 0,70 |
| football | 2 | 5,00 (5,00–5,00) → 4,88 (4,88–4,89) | 5 → 0 | 2 → 0 | 1,04 → 1,09 | 1,00 → 1,00 | 0,55 → 0,55 | 0,52 → 0,52 |
| gewichtheben | 2 | 5,00 (5,00–5,00) → 4,88 (4,83–4,93) | 5 → 0 | 1 → 0 | 1,30 → 1,43 | 1,00 → 1,00 | 0,80 → 0,80 | 0,80 → 0,80 |
| hockey | 2 | 4,71 (4,42–5,00) → 4,85 (4,84–4,86) | 2 → 0 | 1 → 0 | 1,18 → 1,41 | 1,00 → 1,00 | 0,51 → 0,51 | 0,46 → 0,46 |
| i-spy | 2 | 4,73 (4,47–5,00) → 4,89 (4,84–4,94) | 1 → 0 | 0 → 0 | 0,94 → 1,19 | 1,00 → 1,00 | 0,74 → 0,74 | 0,58 → 0,58 |
| mini-dm | 2 | 4,98 (4,96–5,00) → 4,80 (4,80–4,81) | 2 → 0 | 1 → 0 | 1,09 → 1,22 | 1,00 → 1,00 | 0,86 → 0,86 | 0,70 → 0,70 |
| showcase | 2 | 4,81 (4,63–5,00) → 4,86 (4,78–4,93) | 2 → 0 | 2 → 1 | 1,07 → 1,15 | 1,00 → 1,00 | 0,80 → 0,80 | 0,66 → 0,66 |
| speed-schach | 2 | 5,00 (5,00–5,00) → 4,86 (4,84–4,88) | 3 → 0 | 1 → 0 | 1,04 → 1,19 | 1,00 → 1,00 | 0,89 → 0,89 | 0,74 → 0,74 |
| spurt | 2 | 5,00 (5,00–5,00) → 4,80 (4,80–4,80) | 3 → 0 | 1 → 1 | 1,26 → 1,42 | 1,00 → 1,00 | 0,52 → 0,52 | 0,43 → 0,43 |
| staffel | 2 | 5,00 (5,00–5,00) → 4,78 (4,78–4,78) | 15 → 0 | 2 → 2 | 1,05 → 1,15 | 1,00 → 1,00 | 0,79 → 0,79 | 0,66 → 0,66 |
| takeshis-castle | 2 | 5,00 (5,00–5,00) → 4,89 (4,83–4,95) | 6 → 0 | 1 → 0 | 1,00 → 1,05 | 1,00 → 1,00 | 0,84 → 0,84 | 0,69 → 0,69 |
| tdm | 2 | 4,90 (4,81–5,00) → 4,82 (4,80–4,84) | 2 → 0 | 1 → 0 | 1,22 → 1,37 | 1,00 → 1,00 | 0,70 → 0,70 | 0,69 → 0,69 |
| tennis | 2 | 5,00 (5,00–5,00) → 4,88 (4,85–4,92) | 9 → 0 | 2 → 0 | 0,91 → 0,78 | 1,00 → 1,00 | 0,88 → 0,88 | 0,77 → 0,77 |
| time-trial | 2 | 5,00 (5,00–5,00) → 4,78 (4,78–4,78) | 27 → 0 | 2 → 2 | 1,25 → 1,38 | 1,00 → 1,00 | 0,70 → 0,70 | 0,62 → 0,62 |
| wettessen | 2 | 4,62 (4,24–5,00) → 4,89 (4,86–4,93) | 2 → 0 | 1 → 0 | 0,69 → 0,83 | 1,00 → 1,00 | 0,82 → 0,82 | 0,76 → 0,76 |

Lesart: In **keiner** Disziplin bleibt ein Spieler glatt bei 5; Eiskunst (fester Anker zu hoch: Tagesbester 4,01)
und Hockey/I-Spy/Wettessen/Battlefield (schwankend 4,2–5,0) landen jetzt jeden Tag bei ~4,8–4,9. Spearman
Impact↔PP, Score↔PP und Eignung↔PP sind je Zelle **unverändert** (ein Faktor je Spieltag, streng monotone Kappe)
— der Vorschlag ändert den Maßstab, nicht die Reihenfolge. Climbing, Staffel und Time-Trial behalten ihre
Platzpunkt-Stufen (16 Laufsieger gleichauf bei 4,78 statt 5,00): das kann nur Stufe 2 lösen.


### 4.2 Vorher/nachher am Live-Save

Am Save ist der ungedeckelte Wert nur dort bekannt, wo kein Spieler am Deckel stand (u = PP); an einem Tag mit
Fünfern ist der Tagesanker selbst unbekannt (≥ 5). Exakt nachrechenbar sind deshalb die vier Tage ohne Deckel-Treffer:

| Disziplin | ST | Tagesanker A | Faktor | Max vorher → nachher | Median vorher → nachher |
|---|---:|---:|---:|---|---|
| hockey | 3 | 4,18 | 1,32 | 4,39 → 4,83 | 1,13 → 1,48 |
| i-spy | 6 | 4,08 | 1,35 | 4,66 → 4,90 | 0,45 → 0,60 |
| showcase | 8 | 3,75 | 1,47 | 4,11 → 4,87 | 0,45 → 0,66 |
| spurt | 8 | 3,56 | 1,55 | 3,59 → 4,79 | 1,02 → 1,58 |

Hockey ST 3, Top 8:

| Spieler | Liga | Score | PP heute | PP Tagesanker |
|---|---|---:|---:|---:|
| Donnernaht | L1 | 108,9 | 4,39 | 4,83 |
| Jump & Slash | L1 | 139,8 | 4,32 | 4,81 |
| Grok'Na | L1 | 81,7 | 3,83 | 4,65 |
| Kelektros | L1 | 140,6 | 3,74 | 4,60 |
| Teerblut | L1 | 95,2 | 3,61 | 4,53 |
| Umbrafond | L1 | 86,8 | 3,55 | 4,49 |
| Galactus | L1 | 110,9 | 3,14 | 4,12 |
| Nytharos | L1 | 74,0 | 3,12 | 4,10 |

Spurt ST 8: Burster/Metalicana 3,59 → 4,79, Mimic 3,49 → 4,75, die zwölf Laufsieger ohne Bonus 3,29 → **4,66
(gleichauf)**, Kelektros 1,24 → 1,92. Der Tagesbeste erreicht jetzt ~5, aber die Platzpunkt-Stufen bleiben —
siehe Abschnitt 6.

Eiskunst ST 1 (neun Fünfer) kann am Save nicht nachgerechnet werden: die neun Werte über dem Deckel sind beim
Buchen auf 5,0 geschnitten worden. Mit dem Prototyp wären sie beim Buchen ungedeckelt in den Tagesanker gegangen
und stünden einzeln zwischen ~4,3 und ~4,95; an der Sonde (4.1) hat **kein** Tag mehr zwei gleiche Spitzenwerte
außerhalb der Platzpunkt-Disziplinen.

---

## 5. Prototyp `OLY_PP_TAGESANKER` (Standard AUS)

| Datei | Änderung |
|---|---|
| `lib/resolve/pp-tagesanker.ts` (neu) | Schalter (`OLY_PP_TAGESANKER` / `NEXT_PUBLIC_OLY_PP_TAGESANKER`, Standard aus, wirkt nur bei `ppSkalaModus === "an"`), `weicheKappe`, `ppTagesankerWert`, `verteilePpNachTagesanker`, `wendePpTagesankerAn` |
| `lib/resolve/pp-skala.ts` | Option `deckel: false` an `skaliereUngedeckelt` / `ppAusKurveSkaliert` (ungedeckelt, ungerundet). Standard unverändert |
| `lib/resolve/battle-mode-arena-team-points.ts` | `computeIndividualBoxscorePpsFromFixtureResults`: bei aktivem Schalter ungedeckelt rechnen, am Ende `verteilePpNachTagesanker` über alle Fixtures beider Ligen |
| `lib/resolve/bahn-pod-matchday.ts`, `battlefield-pod-matchday.ts`, `mini-dm-ffa-matchday.ts` | dasselbe über alle Pods des Spieltags |
| `lib/battle/arena-eingabe-hash.ts` | bei aktivem Schalter zusätzlich `ppTagesanker: "t1"` im Eingabe-Hash (ein schon gelaufener Vorlauf wird neu gerechnet); ohne Schalter Zeichen für Zeichen der bisherige Hash |
| `tests/pp-tagesanker.test.ts` (neu) | Schalter aus = bit-identisch, Reihenfolge, < 5, kein Klumpen, Feldstärke-Invarianz, Rechenstelle Arena, `deckel: false` |

Gezeigt = gebucht bleibt: die PP werden beim Buchen einmal gerechnet und persistiert (Schritt 9), Bühne und Ledger
lesen denselben Wert. Der Ledger-Fallback `pps_duell` (ohne Motor) bleibt bewusst beim festen Anker — er rechnet
Zeile für Zeile beim Lesen und kennt den Spieltag nicht als Ganzes; auf Battle-Saves mit Motor kommt er nicht vor.

**Für eine Scharfschaltung** (nicht Teil dieses Auftrags) gehört der Tagesanker wie C2 in den Saison-Stempel
(`wertungsSkalen.pp = "c3"` o. ä.) statt an einen Serverschalter: neue Saison rechnet neu, laufende rechnet zu
Ende, Browser und Server können nicht auseinanderlaufen. Abnehmer mit absoluten PP-Schwellen (Abschnitt 3 in
`pp-skala-18-11.md`: Trainings-XP, organische Entwicklung, Saison-MVP, Vorstands-Sportziel) verschieben sich kaum:
Spieler-Saisonsumme Median ×1,01 an der Sonde vom 18.11., ×1,05 an der frischen Sonde (Abschnitt 4.1) — in der
Größenordnung der bestehenden C2-Umrechnungsfaktoren (1,02–1,03), die dann neu gezogen würden.

---

## 6. Vorschlag Stufe 2 (Motor, braucht Freigabe): stetiger Bahn-Impact

Spurt, Climbing und Time-Trial geben dem Spieler heute Platzpunkte im eigenen Lauf (2–10 Läufer). Das ist die
Ursache für Kelektros 1,24 und für 16 gleiche Laufsieger in Climbing/Time-Trial — und keine Skala kann das
auflösen, weil der Motor keinen feineren Wert liefert. Vorschlag: der Motor gibt im Boxscore **zusätzlich** einen
stetigen Wert aus (wie heute schon `duelle` für den Stationsduell-Bonus):

- Time-Trial: die gefahrene Zeit `bahnZeit(u)` liegt schon vor (`battle-mode.engine.js`, `bahnTeamstand`) und ist
  über alle Läufe vergleichbar (gleiche Strecke) → PP aus der OLY-weiten Zeit-Rangfolge statt aus dem Platz im Lauf.
- Spurt/Climbing: Zielzeit bzw. erreichte Höhe/Strecke zum Laufende als Feld `fortschritt`.

`wert` (und damit `seiten`, rho- und Pp-Messung) bliebe unverändert; nur die PP lesen das neue Feld. Weil der
Boxscore Teil der Fingerabdruck-Ausgabe ist, bewegt sich der Fingerabdruck in den Bahn-Zeilen — deshalb Stufe 2
mit eigener Abnahme, nicht in diesem Prototyp.

## 6.1 Stufe 3 (Anzeige)

Die Liste „Top-Spieler · Player-Points des Spieltags" zeigt PP und in Klammern den **Score** — für Chris liest
sich das als „Leistung", ist aber die Erwartung vor dem Lauf. Vorschlag: die Klammer als „Erwartung" beschriften
oder durch den Impact-Rang im Feld ersetzen; bei Gleichstand nach dem Impact sortieren statt nach dem Score
(heute `discipline-stage-matchday-top-players.ts:167`).

---

## 7. Wertungs-Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs --node` auf diesem Branch: **`GESAMT eaafed96150e (75 Eintraege)`**,
`CLIMBING-STANDARD 164b3d846334` — identisch zum main-Stand (Kopf des Skripts, Canyon live 18.11.). Der Branch ändert
weder `public/mockups/battle-mode.engine.js` noch das Skript; alle Änderungen sitzen in TypeScript nach dem Motor
(Boxscore → PP), und ohne Schalter ist auch dort jede Zahl bit-identisch (`tests/pp-tagesanker.test.ts`,
„aus: bit-identisch zur C2-Kurve"). Rangtreue (rho) und Pp-Abweichung sind Eigenschaften des Motors und unberührt.

Nebenbefund: `tests/bahn-pod-vier-teams.test.ts` „Duell climbing: spieleBahn() liefert bit-identisch dasselbe wie vor
dem N-Bahnen-Umbau" ist auf diesem Stand rot (`d8443dde20596270` statt `d538d2c1fb7f6344`). Der Test prüft nur den
Motor, den dieser Branch nicht anfasst — die Ursache ist der Climbing-Canyon-Umstieg auf main (18.11.), dessen
erwarteter Hash im Test nicht nachgezogen wurde.

---

## 8. Liga-Sicht: wo ligaweit gerechnet oder angezeigt wird

**OLY-weit (beide Ligen) schon heute — nichts zu tun:**

| Größe | Wo | Pool |
|---|---|---|
| Spieler-PP je Spieltag | `computeIndividualBoxscorePpsFromFixtureResults` (`battle-mode-arena-team-points.ts:1263`), Pods analog | alle Fixtures beider Ligen, feste Referenz (keine Liga-Normierung) |
| Top-Spieler des Spieltags | `summiereSpieltagsTopSpieler` (`discipline-stage-matchday-top-players.ts:118`) | alle Zeilen beider Ligen (Queen Loriana L2 steht in derselben Liste) |
| `rankInDiscipline` der Leistungszeile | Resolve | beide Ligen (Queen Loriana #1 von 192) |
| MVS (Marktwert-Leistungsrang) | `buildRetoolMvsByPlayerId` (`lib/foundation/player-rating-contract.ts:265`) | alle Spieler, Rang je Disziplin über alle |
| PP-Saisonrang (`ppsSeasonRank`, KI-Verkauf „productive elite") | `lib/foundation/player-rating-contract.ts`, `lib/ai/ai-sell-decision-engine.ts:47` | alle Spieler |
| Marktwert-Rangtabelle | `computeLeagueMarketValueMapFromPlayers` (`lib/player-formulas/league-market-value-snapshot.ts:47`) — „league" heißt hier die ganze OLY | `gameState.players` (alle) |
| VK-Bracket (Verkaufsfaktor, Rang im Bracket) | `buildRankedCandidates` / `getSaleFactorRankContext` (`lib/market/transfermarkt-sale-factor.ts:263`, `:323`) | `gameState.rosters` (alle Kader beider Ligen), Bracket nach MW |
| Saisonstand „Top-Spieler der Saison" | `SeasonStandingsNewLook.tsx:1041` (`topPlayers`, ungefiltert) | alle |

**Ligaweit — Kandidaten für „OLY-weit":**

| Anzeige | Wo | heute |
|---|---|---|
| PP-Saisonrang im Spielerprofil („Rang #N von M in der Liga 1") | `lib/foundation/spielerprofil-modell.ts:394` (`ppGesamt = rangVon(ligaIds, …)`), angezeigt in `app/foundation/spielerprofil/TabLeistung.tsx:33`, `TabUeberblick.tsx:371`, `SpielerKurzprofil.tsx:113`, `bausteine.tsx:201` | nur eigene Liga |
| PP-Rang je Disziplin im Spielerprofil („Liga #N") | `spielerprofil-modell.ts:371` (`ppLiga = rangVon(ligaIds, …)`), `TabDisziplinen.tsx:72` | nur eigene Liga |
| Liga-Leaders (Saison-Kategorien inkl. PP) | `app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx:356` (`scopeLeagueLeaderCategory`), Standardfilter `liga1` (`:496`) | Filter, Standard Liga 1 (Chris 19.10.: „Liga 2 muss quasi einen anderen Kosmos haben") |
| All-Time nach Disziplin | `LeagueLeadersNewLook.tsx:618–631` | derselbe Liga-Filter, nach letztem Team |

Der Liga-Filter der Liga-Leaders ist eine bewusste Entscheidung vom 19.10.; mit dem neuen Grundsatz wäre der
Standard „Beide Ligen" (Filter bleibt wählbar). Eignungs-Ränge (`ligaRang` im Profil, `einsatzliste-diszi-rang.ts`)
und Team-Ränge (`team-discipline-rank-engine.ts`, Saisonstand) sind ligaweit und sollen es bleiben (Tabelle).

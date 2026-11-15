# P4: Formkarten und Intensität im Motor — Befund, Pilot Zeitfahren, Fahrplan (11.11.)

Phase P4 aus `arena-echter-spieltag-live-11-11.md` (Lücke L1, Frage F1 = ja). Chris' Freigabe vom
11.11. Grundlage: `origin/main` bei `3f120907d`.

## 0. Kurzfassung

- **Datenfluss:** Die gespielte Formkarte erreichte den Motor nie, weil es kein Rohr gab. Die
  Einsatzliste speichert sie als Seitenwahl (`modifiers.d1/d2.primaryFormCardId/secondaryFormCardId`,
  `intensity`, dazu `seasonState.formCardPlans`). Die Wertung rechnet daraus
  `calculateFormModifierForSide().formPerPlayer`. Der Motor baute seine Eingaben aber nur aus Kader
  und Aufstellung (`buildArenaTeam`, `buildArenaAufstellung`). Darin stand keine Karte.
- **Der Motor nimmt die Form an EINER Formel, in sieben Baufunktionen gleich:**
  `breitPunkte = formVon(p.n) + stufenWert()`. Das sind Ersatzkarte plus feste Stufe „normal“, als
  Eignungspunkte über `mitAufschlag()` auf die Attribute gelegt. Die Messrunde vom 15.10. hat
  gezeigt, dass das exakt matrixtreu ist: +4 Karte = +4,00 Eignung, in jedem Chassis. **Eine neue
  Kalibrierung braucht es also nicht.** Eine Karte ist schon in Eignungspunkten kalibriert. Der echte
  Wert wird in dieselbe Einheit gelegt.
- **Gebaut:** ein Helfer `breitPunkteVon(p, d)` statt der sieben Ausdrücke. Dazu ein neues Feld
  `form`/`intensitaet` im `place`-Eintrag, über dasselbe Rohr wie Slot und Haltung
  (`buildArenaAufstellung`). Vorlauf, Pods, Eingabe-Hash und Arena-Anzeige nutzen alle diese eine
  Funktion. Freigeschaltet wird **je Disziplin** über `FORMKARTEN_ECHT_DISCIPLINE_IDS`. Alle anderen
  Disziplinen bleiben bit-identisch (Fingerabdruck GESAMT `774e712bf929` auf `main` und Branch).
- **Pilot Zeitfahren (time-trial): bestanden.** rho je Spiel 0,943 → 0,917, Saison 0,951 → 0,930,
  Pp 11,4/12,5 → 12,0/11,6.
- **Empfehlung:** Disziplin für Disziplin, nicht alle auf einmal. Begründung in Abschnitt 3.

## 1. Phase A: der Befund

### 1.1 Wie die Ersatzkarte heute entsteht

`zieheFormkarten(saat)` (`battle-mode.engine.js` ~8609) zieht je Spieler in `SQUAD`/`OPP` einen Wert
aus `[0,2,4,8]`. Woher die Saat kommt, hängt vom Pfad ab:

| Pfad | Saat der Ersatzkarte | Folge |
|---|---|---|
| Duell (13 bzw. 15 Disziplinen, `spieleFeldspiel/-Buehne*/-Bahn`) | **`zieheFormkarten(20260823)` beim Seitenstart, für jedes Spiel gleich** | Die Karte hängt nur an der Kaderreihenfolge, nicht am Spieltag. Jeder Spieler hat in jedem Duell dieselbe „Formkarte“. |
| Bahn-Pod, Mini-DM-FFA, Battlefield-Pod | `optionen.formSaat` = Pod-Saat (`mdffaFormkartenFuer`) | je Pod gewürfelt |
| Messung (`disziplinProbe`, `einflussVon`) | `20260823 + i·104729` je Spiel | je Spiel gewürfelt |

`STUFE` steht fest auf `"normal"` (Wert 0). Nur ein Knopf im freien Entwurf ändert sie.

### 1.2 Wie die Form wirkt

Sieben Stellen, alle mit derselben Formel `breitPunkte = formVon(p.n)+stufenWert()`:
`bauFeldspiel`, `bauBuehne`, `kampfwerteVorschau`, `baueEinheit` (Arena/TDM), `bauSpurt` (alle
Bahnen), `bfffaKaempfer` (Battlefield-Gefecht), `mdffaKaempfer` (Mini-DM-FFA). Überall gilt:
1. `breitPunkte` hebt über `mitAufschlag(attr, breitPunkte, betroffeneAttribute(…, false))` die
   Matrix-Attribute so, dass die gewichtete Eignung um **genau** diesen Betrag steigt (15.10., Tabelle A:
   4,00 in jedem Chassis);
2. `breitPunkte` steckt in `eig`/`eigOhneMutator`. **Daran misst rho.** Die Form ist für die
   Abnahme also Teil der Eignung, kein Rauschen.

**Strukturell ist das eine zentrale Stelle.** Die Wirkung ist in allen 17 gleich eingebaut. Wie
stark eine Karte das *Spiel* bewegt, unterscheidet sich trotzdem je Rezept (15.10., Tabelle B: 6 %
Tennis bis 23 % Climbing Feldbewegung je +4).

### 1.3 Echte Karte gegen Ersatzkarte: nicht dieselbe Verteilung

Hier liegt das eigentliche Risiko, nicht im Code:

| | Ersatzkarte | echte Wahl (`calculateFormModifierForSide`) |
|---|---|---|
| Einheit | je **Spieler** einzeln | je **Seite**: jeder Spieler der Seite bekommt denselben Wert |
| Wertebereich | 0, 2, 4, 8 | Primärkarte −8…+8, Zweitkarte 0…+8, je ×2 bei Farbgleichheit → **−16 … +32** |
| Intensität | immer 0 | Schonen −2,5 / Normal 0 / Push +4 (engine-eigene `INTENSITAET`) |

Eine Seite mit +16 gegen eine mit −8 hat 24 Eignungspunkte Abstand je Spieler. Ob der Motor diesen
Abstand auch abbildet oder sättigt, beantwortet nur die Messung, je Disziplin.

### 1.4 Der Datenweg

- Einsatzliste → `LineupDraft.modifiers` und `seasonState.formCardPlans`, Karten in
  `seasonState.formCards` (`legacy-lineup-modifiers.ts`).
- Die Wertung (`legacy-matchday-resolve-engine.ts:537`) rechnet `formPerPlayer` mit
  „Plan schlägt Entwurf“. In Motor-Disziplinen kommen die Teampunkte aber allein aus dem Motor
  (`arenaOverride`). Die Karte bewegte dort höchstens noch PPS-Nebenspuren.
- Motor-Eingaben: `buildArenaTeam` + `buildArenaAufstellung(Beide)`. Diese Funktion nutzen **alle**
  Verbraucher: Headless-Runner, Bahn-Pod, Battlefield-Pod, Mini-DM-FFA, `arena-eingabe-hash.ts` und
  `FoundationBattleArenaHost` (Anzeige). Ein Feld, das dort entsteht, kommt deshalb überall gleich an.
  Der Eingabe-Hash deckt es automatisch mit ab: Wer nach dem Vorlauf die Karte tauscht, invalidiert
  den Snapshot.
- Die Anzeige `+4 Formkarte` (Aufstellungsliste ~37310, Aufschlüsselung ~52706) las dieselbe
  Ersatzkarte. Sie zeigt jetzt die gespielte Karte, wo es sie gibt, auch negative Werte, und die echte
  Intensität.

### 1.5 Welche 17, welche 3 (Zusatzfrage Chris)

**Alle 20 Disziplinen haben einen Motor** in `battle-mode.engine.js` (`MOTOREN`, `window.__arena.motoren()`).
Gewertet wird über den Motor in 17:
- 13 Duelle aus `ARENA_RESOLVED_DISCIPLINE_IDS`: gewichtheben, speed-schach, showcase,
  eiskunstlauf, breaking, wettessen, tennis, fechten, time-trial, spurt, climbing, basketball, i-spy;
- staffel und takeshis-castle: an Pod-Spieltagen als Bahn-Pod, sonst als Duell;
- mini-dm (FFA-Pod, `MINI_DM_FFA_VORLAUF_AKTIV`) und battlefield (Gefecht je Ort,
  `BATTLEFIELD_POD_VORLAUF_AKTIV`).

**Die drei anderen: TDM, Hockey, Football.** Ihr Motor existiert und läuft in der freien Arena und in
jeder Messung. Gewertet werden sie aber über die **PPS-Duell-Brücke**: Eignungs-Score statt
Motor-Spiel, `resolutionSource "pps_duell"`. Der Grund ist jeweils die Pflichtabnahme, keine fehlende
Technik:

| Disziplin | Grund | grober Aufwand bis zum Motor-Anschluss |
|---|---|---|
| **Hockey** | rho mit Chris' Ausnahme (Star-Rangtreue) abgenommen, **Pp 38,5 / 81,5** gegen die Schranke 25 (`ARENA_ABNAHME_AUSNAHMEN`, Task #195). Dazu der Kampf-/Feldspiel-Takt-Fix B1 (`516396fdf`, nur auf Branch). Ohne ihn weichen gezeigt und gebucht in 24/24 Saaten ab. | mittel bis groß: eine Pp-Rezeptrunde (läuft parallel: Hockey-Rezept-Agent, Worktree `hockey-pp-rezept`), dann B1 als PR, dann ein Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`. Die Verdrahtung ist dann eine Zeile, denn die Arena-Weiche liest die Menge. |
| **Football** | rho 0,807 besteht, **Pp 64,6 / 61,7**. Dazu ein struktureller Zielkonflikt zwischen rho und Pp unter dem bestehenden Rezept: zwei Rezeptversuche dieser Woche rissen rho (0,760 / 0,668) und wurden zurückgesetzt. Config und PPS-Referenz liegen vorbereitet in `battle-mode-arena-team-points.ts`. | groß: Football braucht einen Rezept- bzw. Mechanikansatz, der den Zielkonflikt auflöst, oder eine bewusste Entscheidung von Chris (Override-Frage Q-F). Erst danach eine Zeile in der Menge. |
| **TDM** | neuer Gefecht-Bauweg W2 (Prototyp im Worktree `tdm-gefecht-prototyp`). Braucht ebenfalls B1. | mittel bis groß: Gefecht fertigstellen, Abnahme rho/Pp, B1, dann die Zeile. |

Der eine gemeinsame technische Vorlauf für alle drei ist **B1** (Takt-Fix Kampf/Feldspiel). Ihn als
eigenen PR zu stellen ist klein (ein fertiger Commit). Er ist der kürzeste Hebel und sollte vor allen
drei kommen. Alles Weitere ist Rezeptarbeit je Disziplin und steht im 20-Disziplinen-Fahrplan
(`alle-diszis-top-niveau-fahrplan-09-11.md`, Strang W).

## 2. Was gebaut ist

| Datei | Änderung |
|---|---|
| `public/mockups/battle-mode.engine.js` | `formEchtVon(n,d)`, `breitPunkteVon(p,d)` und die sieben Baufunktionen auf den Helfer umgestellt. `place[n].form/.intensitaet` werden typgeprüft übernommen. Die Anzeige zeigt die gespielte Karte. Mess-Szenario `zieheFormSzenarioEcht` und der Schalter `window.__arena.formModusMessung("echt"\|"ersatz")`, nur für Messungen, im Spiel immer `ersatz`. |
| `lib/battle/formkarten-echt-disziplinen.ts` | **neu:** `FORMKARTEN_ECHT_DISCIPLINE_IDS`, der Schalter je Disziplin (Pilot: `time-trial`). Rollback = Zeile löschen. |
| `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` | Für freigeschaltete Disziplinen: `form` = `formPerPlayer` der Seite (dieselbe Funktion wie die Wertung, „Plan schlägt Entwurf“) und `intensitaet` (conserve→schonen, push→push, sonst normal) je Eintrag. |
| `scripts/miss-alle-disziplinen.mjs`, `scripts/messe-arena-einfluss.mjs` | `OLY_FORM_MODUS=echt` schaltet die Messung auf das Einsatzlisten-Szenario. Ohne die Variable unverändert. |
| `data/generated/disziplin-abnahme.json` | time-trial mit den Echt-Zahlen; die alten Ersatz-Zahlen stehen unter `formkarten.ersatzVorher`. |
| `tests/formkarten-echt-motor.test.ts` | **neu:** Rohr (Werte, x2, negative Karte, Schonen/Push, Plan schlägt Entwurf, Nicht-Pilot bleibt `{d,slot}`) und Motor-Wächter (sieben Stellen, ein Rückfall). |

Nicht angefasst: Eignungsmatrix, PixelLab, Wertungslogik außerhalb des Motors.

### 2.1 Das Mess-Szenario „echt“

Zufällig bewusst **breit**, nicht die KI-Gewohnheit. Je Seite und Spiel:
- Primärkarte aus dem Pool, positiv (0/2/4/8) oder negativ (0/−2/−4/−8), je zur Hälfte;
- mit p = 0,5 eine positive Zweitkarte;
- jede Karte mit p = 0,25 farbgleich (×2);
- Intensität gleichverteilt Schonen/Normal/Push.

Der Wert gilt für jeden Spieler der Seite gleich. Die Saat kommt aus derselben Saat wie die
Ersatzkarte (`saat ^ 0x5bd1e995`). In `einflussVon` sehen Grundlauf und Hebungslauf damit in Lauf i
dasselbe Szenario, der Vergleich bleibt gepaart.

## 3. Phase B: alle auf einmal oder je Disziplin?

**Je Disziplin.** Der Code ist zentral: eine Formel, ein Rohr, ein Schalter. Der Umbau selbst ist
für alle 17 gleich billig. Das Risiko ist es nicht:
1. **Die Verteilung ändert sich, nicht nur die Quelle** (1.3): Seitenwert statt Spielerwert, −16…+32
   statt 0…8. Wie stark ein Eignungspunkt das Spiel bewegt, reicht laut Messung vom 15.10. je Rezept um
   den Faktor ~4 auseinander (Tennis 6 %, Climbing 23 % Feldbewegung je +4). Disziplinen mit knapper
   rho-Reserve können reißen: Climbing 0,833, Basketball 0,832, I-Spy 0,817/0,811. Zeitfahren mit
   0,943 hatte die größte Reserve und verlor 0,026.
2. **Die Pfade unterscheiden sich** (1.1): Duell, Bahn-Pod, Battlefield-Gefecht und Mini-DM-FFA bauen
   `place` unterschiedlich. Der Battlefield-Pod übernimmt die Einträge ganz
   (`place[name]=pl[name]`, also auch `form`). Mini-DM-FFA baut eigene `{d,slot}` (~57691) und braucht
   eine eigene Durchreichung. Das Mess-Szenario deckt bisher nur `SQUAD`/`OPP` ab. Pod-Messungen
   (`mdffaFormkartenFuer`) brauchen eine eigene Erweiterung.
3. **Ein Alles-oder-nichts-Commit hätte keinen Rückweg je Disziplin.** Mit der Menge ist jede
   Disziplin einzeln an- und abschaltbar, und der Fingerabdruck beweist für alle anderen bit-identisch.

Fable war für diese Entscheidung nicht nötig: Code und Messung waren eindeutig.

## 4. Phase C: der Pilot Zeitfahren

Gewählt, weil es die höchste Rangtreue aller Duelle hat (0,943, Spannweite 0,049), kein Pod-Format
kennt (nur Duell-Pfad) und als Bahn schnell misst.

| | Ersatzkarte (vorher, `main`) | echte Wahl (Szenario 2.1) | Schranke |
|---|---:|---:|---|
| rho je Spiel (Median, 5 Kaderpaarungen, 24 Spiele) | 0,943 (Spannw. 0,049) | **0,917** (0,077) | > 0,80 ✓ |
| rho Saison | 0,951 | 0,930 | — |
| Pp Saatstrom 0 (n=48) | 11,4 | **12,0** | ≤ 25 ✓ |
| Pp Saatstrom 10 000 000 (n=48) | 12,5 | **11,6** | ≤ 25 ✓ |

Die Ersatz-Spalte reproduziert die Tabelle auf `main` exakt. Damit ist der Messschalter im Modus
`ersatz` nachweislich wirkungslos.

**Durchstich bewiesen** (Wegwerfskript, Produktivpfad `window.__olyArenaKader` mit `aufstellung`,
Kaderpaarung 0, Saaten 1/7/42): Ohne `form` entspricht das Spiel der Ersatzkarte. Mit Heim +16 Push /
Gast −8 Schonen gewinnt Heim alle drei Saaten, gespiegelt gewinnt Gast alle drei. Die Karte ändert
also wirklich den Ausgang.

**Bit-identisch für alles andere:** `scripts/pruefe-wertung-fingerabdruck.mjs` auf `main` und Branch
im selben Moment: 69 Einträge, GESAMT `774e712bf929` auf beiden, `diff` leer. Der Fingerabdruck läuft
ohne `form` im `place`, er beweist also den Motor-Rückfall für alle 20 Disziplinen. Dass time-trial
im Spieltag jetzt anders rechnet, ist gewollt und durch die Abnahme oben gedeckt.

**PPS-Referenz:** Zeitfahrens Boxscore-`wert` sind Rangpunkte. Deren Verteilung je Spiel ist fest,
eine neue Referenz braucht es deshalb nicht. Für Disziplinen mit summenbasiertem Wert (Basketball,
Gewichtheben, Wettessen …) muss der Rollout das je Disziplin prüfen.

### 4.1 Vorlage für jede weitere Disziplin

```sh
node scripts/miss-alle-disziplinen.mjs 24 <d>
OLY_FORM_MODUS=echt node scripts/miss-alle-disziplinen.mjs 24 <d>
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs <d> 48
OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs <d> 48 --saat-versatz=10000000
```

Läuft der Container mit voller Platte, `TMPDIR=/dev/shm/...` davorsetzen, sonst stürzt Chromium ab.
Danach:
1. Besteht rho > 0,80 **und** beide Pp ≤ 25: Eintrag in `FORMKARTEN_ECHT_DISCIPLINE_IDS`, Zahlen in
   `disziplin-abnahme.json` mit `formkarten.ersatzVorher`, Fingerabdruck paarweise gegen `main`
   (muss bit-identisch bleiben, solange er kein `form` setzt).
2. Fällt sie durch: **nicht** eintragen. Die Disziplin bleibt bei der Ersatzkarte, die Zahlen kommen in
   Abschnitt 5 dieses Dokuments. Kein Rezept-Umbau im selben Zug (Lehre aus Football).
3. Summenbasierte `wert`: PPS-Referenz in `battle-mode-arena-team-points.ts` gegen eine Echt-Messung
   prüfen.

## 5. Fahrplan für die übrigen 16

Reihenfolge nach rho-Reserve und Pfad. Je Disziplin ist eine Bahn-Messung in Minuten fertig, eine
Bühne in 15–30 Minuten, ein Feldspiel in bis zu 70 Minuten.

| Welle | Disziplinen | Pfad | Besonderheit |
|---|---|---|---|
| 1 | spurt (0,910), staffel (0,937), takeshis-castle | Bahn | Staffel und Takeshi laufen an Pod-Spieltagen als **Bahn-Pod**. Zusätzlich messen, ob `bahnPodLauf` die `place`-Einträge ganz übernimmt, und das Szenario für Pods erweitern (`mdffaFormkartenFuer`). |
| 2 | gewichtheben, showcase, eiskunstlauf, breaking, wettessen, tennis, fechten, speed-schach | Bühne | summenbasierte `wert` → PPS-Referenz prüfen. |
| 3 | climbing (0,833), basketball (0,832), i-spy (0,817/0,811) | Bahn / Feldspiel / Bühne | **knappe Reserve.** Echte Karten mit −16…+32 können rho unter 0,80 drücken. Fallen sie durch, bleiben sie bei der Ersatzkarte. Dann Chris fragen, ob für diese Disziplinen eine gedämpfte Form (z. B. halber Kartenwert im Motor) gewollt ist. Das wäre eine Mechanik-Entscheidung, keine Messfrage. |
| 4 | mini-dm (FFA-Pod), battlefield (Gefecht je Ort) | Pod | eigene Durchreichung (Mini-DM baut `place` selbst, ~57691) und Pod-Szenario in der Messung. Abnahmeskripte: die Pod-Abnahmen (`battlefield-pod-gefecht-abnahme.json`, Mini-DM-Sonde). |
| — | tdm, hockey, football | Brücke | erst nach Motor-Anschluss (1.5). Dann gleich mit echter Form abnehmen. |

**Offen für Chris (nicht blockierend):**
1. Soll das Mess-Szenario (2.1) die Abnahmeregel sein? Es ist absichtlich breit, auch negative und
   Doppelkarten. Die KI spielt meist eine positive Karte, das wäre für rho günstiger.
2. Die Arena zeigt eine gespielte Karte jetzt an **jedem** Spieler der Seite (+10 bei allen). So
   rechnet sie auch die Wertung. Wer die Karte „gehört“, steht nur in der Einsatzliste.

## 6. Prüfungen dieser Runde

- `tests/formkarten-echt-motor.test.ts` (9), `tests/disziplin-abnahme-guard.test.ts` (9) grün;
  die verwandten Arena-/Aufstellungs-/Pod-Suiten s. PR.
- Fingerabdruck GESAMT `774e712bf929` auf `main` und Branch.
- rho/Pp wie Abschnitt 4.

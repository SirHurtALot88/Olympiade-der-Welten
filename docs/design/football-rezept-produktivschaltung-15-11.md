# Football: Rezept-Verdrahtungsfehler behoben, rho bleibt unter der Schranke (15.11.)

Chris' Auftrag (15.11.): "bitte keine PPS Brücken mehr nutzen! 0,75 wäre auch ok aber ich würde es
bevorzugen wenn du es auf über 0,8 gebalanced bekommst" — Football soll über eine echte
Rezept-Rebalancierung (Budget-Methode) aus der PPS-Duell-Brücke, nicht über eine Chris-Ausnahme.

**Ergebnis vorweg:** der eigentliche Produktionsfehler ist behoben (ein Rezept, das zwei
Matrixattribute komplett ausließ, liest jetzt wirklich die vollen 100 Budgetpunkte). Beide
Kennzahlen verbessern sich massiv — aber rho bleibt unter der 0,75er-Mindestschranke. Fünf weitere,
unabhängig probierte Hebel bringen keine Verbesserung. Football bleibt deshalb **nicht** in
`ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS`/`ARENA_RESOLVED_DISCIPLINE_IDS` — kein Rückfall auf eine
Chris-Ausnahme, sondern ein ehrlicher "noch nicht erreicht"-Befund mit einer konkreten Diagnose, was
fehlt.

## 1. Der Widerspruch, zuerst aufgeklärt

Der Auftrag kam mit einem Widerspruch: `docs/design/football-rezept-matrix-budget-14-11.md` (nur
auf dem unmerged Branch `claude/football-rezept-matrix-budget-14-11` lesbar) behauptet "Runde 1
bleibt der committete Stand" mit Pp 18,3/rho 0,525 — aber eine frische Messung am 15.11. (Task
#136, `data/generated/disziplin-abnahme.json`) fand Pp 113,2/116,2 und rho 0,248, fast identisch
mit dem alten Override-Stand.

**Aufgeklärt:** "committeter Stand" bezog sich auf die offene PR #1463 (Branch
`claude/football-rezept-matrix-budget-14-11`, Basis `claude/football-rezept-tool-haerten-14-11`,
Commit 9b2d0ba17) — **nie gemergt nach `main`**. Der Override-Rückbau selbst (`b5731dd6f`, 14.11.,
"Football-Override zurueckgebaut") landete auf `main` und setzte `p.d.football`/`BASIS_JE_DISC`
zurück auf die offizielle Matrix — aber dieser Commit fasste `FELDSPIEL_ART.football.rezept`
(`public/mockups/battle-mode.engine.js`) **nicht an**. Das Feld blieb beim alten "Rezept C" stehen,
das noch gegen den (inzwischen zurückgebauten) Spiel-Eignungs-Override gefittet war: ausschließlich
`power/health/speed/torment/determination/dexterity/stamina/awareness/will` als Träger — **`spirit`
(Matrixgewicht 25, das größte Einzelgewicht) und `charisma` (4) kamen in KEINER Zelle vor.** Ihre
Zeile war damit unlösbar: sie trugen faktisch 0 Pp statt ihres vollen Budgets, während die Eignung
(gegen die rho gemessen wird) sie voll gewichtet — exakt der Mechanismus, den der neue CI-Guard
(`tests/feldspiel-rezept-budget-guard.test.ts`, ebenfalls nur auf einem unmerged Branch,
`claude/football-rezept-tool-haerten-14-11`) prüft. Bestätigt: der Guard-Test schlägt auf dem
unveränderten `main`-Rezept sofort fehl (meldet `charisma` als erstes fehlendes Attribut).

Die "Runde 1"-Zahlen (Pp 18,3/rho 0,525) selbst waren nie falsch — sie wurden am 14.11. und erneut
am 15.11. (im Rahmen der verworfenen `spirit`↔`awareness`-Matrixverschiebung,
`claude/football-matrix-spirit-awareness-15-11`) unabhängig bit-identisch reproduziert. Sie waren
nur nie in `main` gelandet: zwei fertige, bereits gemessene PRs (#1463 für das Rezept, plus die
Tool-Härtung mit dem CI-Guard) blieben offen stehen, während der separate Override-Rückbau-Commit
auf `main` ging und seitdem (bis heute) mit dem alten Rezept kombiniert blieb — die schlechteste
Kombination aus beiden Welten.

## 2. Der Fix (diese PR)

1. `scripts/baue-feldspiel-rezept.mjs`: ERLAUBT-Tabellen-Bug behoben (`awareness`/`charisma`
   restauriert), cherry-picked aus `claude/football-rezept-tool-haerten-14-11` (Commit
   9b2d0ba17), inklusive `tests/feldspiel-rezept-budget-guard.test.ts` (neuer, dauerhafter
   CI-Guard — verhindert exakt diese Klasse von Fehlern für die Zukunft).
2. `public/mockups/battle-mode.engine.js`, `FELDSPIEL_ART.football.rezept`: das "Runde 1"-Rezept
   aus PR #1463 jetzt wirklich eingetragen (Sondierung `scripts/sondiere-feldspiel-subskills.mjs
   football 24`: TEAMGEIST 52,7 %, LAUFKRAFT 24,4 %, ABWEHR_LAUF 8,7 %, PASSGENAUIGKEIT 8,1 %,
   ABWEHR_PASS 4,9 %, PASSSCHUTZ 1,2 %, BALLSICHERHEIT/AUSDAUER 0 % — kompositionsunabhängig,
   bit-identisch auf altem und neuem Rezept gemessen):

   ```
   PASSGENAUIGKEIT: {will:46,determination:45,awareness:9}
   LAUFKRAFT:       {health:54,power:24,spirit:22}
   PASSSCHUTZ:      {will:46,determination:45,awareness:9}
   ABWEHR_PASS:     {awareness:100}
   ABWEHR_LAUF:     {health:59,power:25,torment:16}
   BALLSICHERHEIT:  {will:100}
   TEAMGEIST:       {spirit:53,torment:37,charisma:10}
   AUSDAUER:        {stamina:100}
   LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}  // unveraendert, kein Matrix-Attribut
   ```

## 3. Gemessen (15.11., eigene, frische Reproduktion — nicht nur aus der Doku übernommen)

Kader-Quelle: `data/generated/kaderfamilie-live-save.json` (live-save, "Oly New Game Custom
31.10.2026", gezogen 2026-11-15T13:24).

| | Vorher (main, Rezept-Bug) | Nachher (diese PR, "Runde 1" produktiv) |
|---|---:|---:|
| rho je Spiel (n=24, Median) | 0,248 | **0,526** |
| rho je Spiel (n=48, Median) | — | **0,525** |
| Spannweite je Spiel (n=48) | 0,809 | 0,206 |
| rho Saison (n=48, Median) | 0,266 | 0,685 |
| Pp, Saatstrom 0 | 113,2 | **18,3** (unabhängig reproduziert, s. Rezept-Kommentar) |
| Pp, Saatstrom +1e7 | 116,2 | — (s. Abschnitt 4 fuer den Pool-Status) |

Befehle: `node scripts/miss-alle-disziplinen.mjs 24|48 football`, `node
scripts/messe-arena-einfluss.mjs football 48`.

**Beide Kennzahlen verbessern sich massiv, kein Tradeoff zwischen ihnen** — CLAUDE.mds Vorrangregel
(rho nie für Pp opfern) ist hier nicht einmal angespannt, weil beide in dieselbe Richtung gehen.
Pp ist damit praktisch gelöst (18,3, nahe am angestrebten Optimum <15 — jedes Attribut außer
`stamina` liegt binnen ±2,4 Pp seines Matrixgewichts; `stamina` bleibt bei 0 %, weil `AUSDAUER`
seit jeher keinen mechanischen Kanal im Motor hat — ein Motor-, kein Rezeptbefund, s. Abschnitt 5).
**rho bleibt klar unter sowohl der 0,75er-Mindestschranke als auch der 0,80er-Zielschranke.**

## 4. Fünf weitere, unabhängig probierte Hebel — alle verworfen

Bevor ein sechster, unbegründeter Rezeptversuch unternommen wird, wurden die bereits dokumentierten
vier Spaltenseiten-Varianten plus ein Motorparameter-Sweep überprüft (nicht blind wiederholt,
sondern ihre Befunde nachvollzogen):

| Variante | rho je Spiel | Pp | Verdikt |
|---|---:|---:|---|
| Runde 1 (diese PR) | 0,525 | 18,3 | Baseline dieser PR |
| Runde 2: `health` zusätzlich in TEAMGEIST | 0,564 | 26,3 | Pp durchgefallen, verworfen |
| Runde 3: `determination`/`will` aus PASSGENAUIGKEIT/PASSSCHUTZ abgezogen | 0,512 | 40,0 | beides schlechter, verworfen |
| Runde 4a: `FK_LOS_KAPPA` 3,4→1,0 gesweept | 0,498–0,548 | 20,4–24,1 | rho unbewegt, Pp nie besser als bei 3,4 |
| Runde 4b: `awareness` zusätzlich in TEAMGEIST | 0,578 | 22,0 | rho-Gewinn im Rauschen, Pp schlechter |
| Runde 5: echte Matrix-Verschiebung spirit(25→15)/awareness(11→21), Fechten als Ausgleich | 0,500 | 26,8–33,7 | beides schlechter, verworfen |

Alle fünf Varianten landen rho im selben, engen Band **0,50–0,58** — ein konvergentes Signal, kein
einzelner falscher Parameter. Volle Herleitung: `docs/design/football-rezept-matrix-budget-14-11.md`
(Runden 1–4) und `docs/design/football-matrix-spirit-awareness-tausch-15-11.md` (Runde 5), beide auf
unmerged Branches, hier für diese Entscheidung nachvollzogen statt wiederholt.

## 5. Warum das ein struktureller Befund ist, kein Rezeptdetail

`TEAMGEIST` trägt **52,7 %** des gesamten mechanischen Gewichts der Disziplin — bei weitem der
schwerste der acht Sub-Skills, und (zusammen mit `LAUFKRAFT`, 24,4 %) die einzige Zelle mit genug
Masse, um `spirit`s 25 Matrixpunkte überhaupt sinnvoll aufzunehmen, ohne eine andere Zeile
unlösbar zu machen. Jede der fünf Varianten bestätigt dasselbe Muster: sobald ein Attribut in einer
mechanisch gewichtigen Zelle zur Mehrheit wird, verstärkt die nichtlineare `fkLos()`-Lotterie
(`FK_LOS_KAPPA=3,4`) dessen Einfluss überproportional — und `spirit` korreliert in diesem Motor
nachweislich **schwach** mit dem simulierten Spielausgang (dieselbe Diagnose, mit der die alte,
inzwischen zurückgebaute Override-Fassung rho 0,807 erkaufte: indem sie `spirit` komplett auf 0 %
mechanisches Gewicht hielt — unter der jetzt gesperrten Matrix nicht mehr erlaubt).

**Das ist keine Frage der Rezept-Zuordnung mehr, sondern eine Frage, ob `spirit` im aktuellen
Motor überhaupt einen Kanal hat, der mit echtem Erfolg korreliert.** Ein bereits einmal (vor dem
Matrix-Rückbau) probierter additiver "Nervenstärke"-Bonus bei 3rd-/4th-Down-Conversions
(`docs/design/football-pp-konflikt-override-vs-matrix-14-11.md`) war rho-sicher, aber
Pp-wirkungslos — zu klein, um das Budget wirklich zu bewegen. Ein substanzieller Kanal (z.B. eine
deutlich größere Clutch-Wirkung bei kritischen Spielsituationen) wäre eine Motorformel-Änderung mit
eigenem Korridor-Refit (Completion-Quote, Yards/Attempt, Turnover-Quote dürfen sich dabei nicht
verschieben) — **keine Rezeptfrage mehr, eine Entscheidung für Chris**, nicht in dieser Runde
stillschweigend mitgemacht.

Kleinerer, separater Befund: `AUSDAUER` hat seit jeher keinen mechanischen Kanal im Motor (0 %
Gewicht schon auf dem alten Rezept) — das hält `stamina` (Matrixgewicht 6) bei 0 % Pp-Beitrag,
unabhängig vom Rezept. Ein eigener, kleiner Mechanik-Auftrag (nicht Teil dieser Pp-kritischen
Rezeptrunde, da `stamina`s Gewicht zu klein ist, um rho spürbar zu bewegen).

## 6. Entscheidung

Football bleibt **nicht** in `ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS`/`ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/battle/arena-resolved-disciplines.ts`) — rho verfehlt weiterhin sowohl die 0,75er-Mindest- als
auch die 0,80er-Zielschranke, und Chris' Auftrag war ausdrücklich "keine PPS-Brücken mehr", nicht
"noch eine Ausnahme". Football spielt bis auf Weiteres über die PPS-Duell-Brücke (2/1/0).

Was diese PR trotzdem liefert: ein echter Produktionsbug ist behoben (zwei Matrixattribute hatten
buchstäblich keinen Kanal), beide Pflichtkennzahlen verbessern sich massiv auf demselben, bereits
fertig entworfenen Rezept, Pp ist praktisch gelöst, und fünf weitere Hebel sind durchprobiert und
mit konkreten Zahlen als Sackgasse dokumentiert — kein sechster, unbegründeter Versuch. Der
verbleibende Weg zu rho > 0,75/0,80 braucht einen neuen, substanziellen Mechanik-Kanal für
`spirit` (Abschnitt 5) — eine Entscheidung für Chris, nicht Teil dieser PR.

## Quellen

- `docs/design/football-rezept-matrix-budget-14-11.md` (Branch
  `claude/football-rezept-matrix-budget-14-11`, PR #1463, nie gemergt) — Runden 1–4, volle Zahlen.
- `docs/design/football-matrix-spirit-awareness-tausch-15-11.md` (Branch
  `claude/football-matrix-spirit-awareness-15-11`, nie gemergt) — Runde 5.
- `docs/design/football-matrix-rueckkehr-14-11.md`, `docs/design/
  football-pp-konflikt-override-vs-matrix-14-11.md` — Kontext des Override-Rückbaus.
- `data/generated/disziplin-abnahme.json` (Schlüssel "football") — aktueller Messstand.
- Eigene Messungen (15.11.): `node scripts/miss-alle-disziplinen.mjs 24|48 football`, `node
  scripts/messe-arena-einfluss.mjs football 48` — frische Kaderfamilie (live-save, "Oly New Game
  Custom 31.10.2026", gezogen 2026-11-15T13:24).

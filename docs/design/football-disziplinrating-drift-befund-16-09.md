# Football: `disciplineRatings.football` springt zwischen zwei Zeitpunkten — Befund, keine Reparatur (16.09.)

**Ergebnis vorweg: STOP an dieser Stelle, kein Produktionscode zu diesem Befund geändert.** Der
Fund kam als Nebenprodukt der Ansatzpunkt-2-Slot-Bonus-Runde (Football-Feldspiel, dasselbe
`public/mockups/battle-mode.engine.js`) zustande, gehört aber nicht in deren Diff: er betrifft die
gespeicherte, liga-weite Eignungszahl `p.d.football` (`disciplineRatings.football`), nicht das
Minispiel-Rezept. Das ist ein eigenständiger Fund, der eine eigene, größere Recherche-Runde
braucht — hier steht nur die Reproduktion und eine begründete, aber unbestätigte Ursachen-These.

---

## 0. Wie der Fund entstand

Beim Erweitern der Kader-Familie (`data/generated/kaderfamilie-live-save.json`, ursprünglich fünf
Team-Paarungen vom 03.09.) auf eine testweise achte Paarung wurde dieselbe Team-Auswahl frisch vom
**heutigen** live-save-Abbild (16.09.) gezogen, um die Ansatzpunkt-2-Messung robuster zu machen. Der
direkte Vergleich der beiden Ziehungen — identische Spielernamen, identischer Kader-Ziehungscode
(`scripts/ziehe-kader-familie.ts`, `buildArenaTeam()`) — legte eine massive, football-spezifische
Verschiebung offen, die mit dem Slot-Bonus-Fix nichts zu tun hat. Die Kaderfamilien-Erweiterung
selbst wurde daraufhin zurückgestellt (eigener, größerer Schritt, s. unten); dieser Fund bleibt
aber bestehen und ist unabhängig von dieser Entscheidung reproduzierbar.

---

## 1. Reproduktion

Zwei Ziehungen desselben Spielstands (`saveId: new-game-1787123325719-swnjlk`, „Oly New Game
Custom 19.8.2026, 09:08:45"), 13 Tage auseinander:

| | Ziehung 1 | Ziehung 2 |
|---|---|---|
| `gezogenAm` | 2026-09-03T11:40:56.959Z | 2026-09-16T10:12:07.789Z |
| Quelle | `data/generated/kaderfamilie-live-save.json` (eingecheckt) | frischer `live-save`-Pull, testweise gezogen |

110 Spieler kommen in beiden Ziehungen unter demselben Namen vor. Für **alle 110** ist
`attributeSheetStats` (`a` im Kaderfamilien-Format) **byte-identisch** zwischen den beiden
Zeitpunkten — dieselben Attribute, derselbe Spieler. Trotzdem unterscheidet sich
`disciplineRatings.football` (`d.football`) für **alle 110 von 110**:

```
Draco                48.4 -> 52.4
Lava Golem           47.2 -> 35.9
Krolach              58.6 -> 64.2
Johanna              46.4 -> 70.2
King Arlen Morgolor  29.6 -> 45.1
Gram                 40.9 -> 47.9
Rhyx'Tal             35.2 -> 41.0
Xelara               21.2 -> 45.1
Jorund               20.8 -> 44.0
Inefinna              9.1 -> 27.7
```

Median absolute Abweichung über alle 110: **11,7**, Mittelwert **13,68**, Maximum **46,0** (auf
einer Skala, die laut `references/formulas/rank-to-discipline-stat.json` ungefähr 0–100 läuft).

**Zum Vergleich, exakt derselbe Spielerkreis, exakt dieselben zwei Zeitpunkte:**
`disciplineRatings.hockey` und `disciplineRatings.basketball` sind für alle 110 Spieler
**identisch auf die Nachkommastelle** (Median- und Maximalabweichung beide 0,00). Die Drift ist
also nicht "der Spielstand ist 13 Tage weitergelaufen und alles bewegt sich ein bisschen" — sie
ist spezifisch auf Football konzentriert.

Nachvollzogen mit `node`, direkt gegen `/tmp/kaderfamilie-old5.json` (Ziehung 1) und
`/tmp/kaderfamilie-8er-neu.json` (Ziehung 2, enthält Ziehung 1 als Teilmenge derselben
Team-Namen); beide Dateien liegen nicht im Repo, sind aber aus `scripts/ziehe-kader-familie.ts`
gegen den `live-save`-Branch jederzeit neu erzeugbar.

---

## 2. Vermutete Ursache: der Football-Gewichtsquellen-Wechsel (PR #934, 15.09.)

`disciplineRatings` wird **nicht live bei jedem Lesen** berechnet, sondern an einer festen Zahl von
Stellen berechnet und in `player.disciplineRatings` **persistiert**: Spielergenerierung
(`player-generator-service.ts:845`), Saisonende-Progression
(`season-end-xp-apply-service.ts:1078/1082/1382`, `season-end-progression-preview.ts:307`),
Preseason-Workflow (`preseason-workflow-service.ts:259`) und als Backfill-Fallback beim Lesen, wenn
ein Spieler noch keine Ratings hat (`discipline-stage-data.ts:135`). Die eigentliche Berechnung
läuft über `buildLeagueDisciplineRatingsFromAttributeMap`
(`lib/player-formulas/discipline-rating-engine.ts:126-153`): für jede Disziplin wird über **die
gesamte Liga** eine `calculateRawDisciplineScore`-Rangliste gebildet
(`buildCompetitionRanks`), und der Rang jedes Spielers wird über eine feste Tabelle
(`references/formulas/rank-to-discipline-stat.json`) auf einen Eignungswert abgebildet. Das ist per
Konstruktion eine **liga-relative** Zahl: sie kann sich ändern, ohne dass sich die eigenen
Attribute eines Spielers ändern, sobald sich die Rangliste der ganzen Liga verschiebt.

Der zeitliche Zusammenhang ist auffällig genau: `calculateRawDisciplineScore` liest die
Gewichte seit **PR #934** (`455dfeeb`, gemerged **15.09.2026** — also genau zwischen den beiden
Ziehungen) über `resolveDisciplineWeightProfile` statt über die offizielle Matrix direkt
(`discipline-rating-engine.ts:28-34`, Kommentar: „GEWICHTSQUELLE ist seit dem 10.09. …"). Und
`lib/player-generator/spiel-eignung-overrides.ts`, die Datei mit Footballs Sondergewichten, kam
**mit genau demselben Commit** neu ins Repo. Der Dateikopf dort nennt den Grund selbst: die
Anzeige-/Kauf-Eignung (Matrix) und die Spiel-Eignung (Minispiel-Kalibrierung) lagen für Football bei
rho 0,427 auseinander — Ser Camelot fiel von Rang 1 (Spiel) auf Rang 27 (Matrix), Johanna von 2 auf
25 — und PR #934 zieht die Anzeige-/Kauf-Seite auf die Spiel-Seite nach, exakt für Football (aktuell
die einzige Disziplin mit einem Eintrag in `spielEignungOverrides`).

**These:** Ziehung 1 (03.09.) spiegelt `disciplineRatings.football`, wie sie **vor** PR #934 zuletzt
berechnet wurden (Football lief da noch über die generische Matrix). Ziehung 2 (16.09.) spiegelt den
Stand, **nachdem** irgendein Neuberechnungs-Ereignis (Saisonende-Progression oder Preseason-Workflow
— welches genau, ist nicht geprüft) nach dem 15.09. einmal durchlief und dabei zum ersten Mal
Footballs neue, eigene Gewichte benutzte. Das wäre ein **einmaliger, beabsichtigter
Migrationssprung** — keine fortlaufende Instabilität. Zwei Beobachtungen stützen das:

1. Footballs neues Gewichtsprofil ist **stark konzentriert** (`power` 22 + `health` 18 = 40 % der
   100 Punkte, gegenüber typischerweise breiter gestreuten Matrix-Gewichten über zwölf Attribute)
   — ein konzentriertes Profil erzeugt mehr eng beieinander liegende Rohwerte in einer Liga mit
   hunderten Spielern, und damit größere Rangsprünge (und damit größere Eignungssprünge über die
   Tabellen-Abbildung) bei jeder Neuberechnung als ein breit gestreutes Profil.
2. Hockey und Basketball benutzen unverändert die generische Matrix (kein Eintrag in
   `spielEignungOverrides`) und zeigen über denselben Zeitraum exakt null Bewegung — passend dazu,
   dass für sie kein Gewichtsquellen-Wechsel stattfand.

**Was NICHT geprüft wurde und offen bleibt:**
- Welches konkrete Ereignis (Saisonende-Progression? Preseason-Workflow? ein Migrationsskript?) die
  Neuberechnung zwischen dem 15.09. und dem 16.09. tatsächlich ausgelöst hat.
- Ob die These stimmt, dass es sich um einen **einmaligen** Sprung handelt — d. h. ob eine dritte
  Ziehung nach dem 16.09. (ohne weiteren Gewichtsquellen-Wechsel) wieder stabile Werte zeigen würde,
  oder ob die Konzentration von Footballs Gewichten grundsätzlich zu größerer Rating-Volatilität bei
  JEDER künftigen Liga-Neuberechnung führt (Transferfenster, Spielergenerierung, Saisonende) als bei
  den unveränderten Disziplinen.
- Ob dieselbe Volatilität jede künftige Disziplin träfe, die ebenfalls einen
  `spielEignungOverrides`-Eintrag bekommt (aktuell nur Football) — strukturell ja zu erwarten, aber
  nicht gemessen.

---

## 3. Warum das die Ansatzpunkt-2-Messung dieser Runde verfälscht hätte

Die testweise Kaderfamilien-Erweiterung auf acht Paarungen mischte genau diese beiden Zeitpunkte:
fünf Paarungen mit den alten (Vor-PR#934-artigen) `d.football`-Werten, drei mit den neuen. Die
resultierende Rangtreue-Messung (`node scripts/miss-alle-disziplinen.mjs 24 football`) fiel auf rho
je Spiel 0,061 (Saison −0,021) — weit unter jeder sinnvollen Schranke. Auf der unveränderten,
zeitlich konsistenten Fünfer-Familie (ausschließlich 03.09.-Werte) misst derselbe Code-Fix dagegen
0,796 je Spiel / 0,888 Saison — nahe an den 0,79–0,82, die
`docs/design/football-balance-runde-nach-e3-15-09.md` für Ansatzpunkt 2 vorhersagte. Der
Katastrophenwert war also größtenteils ein Artefakt der Zeitpunkt-Mischung, nicht der eigentliche
Effekt des Slot-Bonus-Fixes — ein Lehrbuchbeispiel dafür, warum eine „kaderfeste" Referenzdatei
NUR an einem einzigen, dokumentierten Zeitpunkt gezogen werden darf (wie der Kopfkommentar von
`kaderfamilie-live-save.json` das für die Fünfer-Familie schon fordert).

---

## 4. Empfehlung

Dieser Fund verdient eine eigene Recherche-Runde, unabhängig von dieser Balance-PR:

1. Nachvollziehen, WELCHES Ereignis die Neuberechnung zwischen 15.09. und 16.09. ausgelöst hat
   (Saisonende? Preseason? Migrationsskript?) — dafür reicht ein Blick in die Server-Logs oder,
   falls verfügbar, in `data/online-saves`-Historie um dieses Zeitfenster.
2. Eine dritte Ziehung zu einem späteren Zeitpunkt (ohne weiteren Gewichtsquellen-Wechsel) gegen
   Ziehung 2 vergleichen, um zwischen „einmaliger Migrationssprung" und „laufende Instabilität"
   zu unterscheiden.
3. Falls „laufende Instabilität" zutrifft: prüfen, ob ein konzentriertes Gewichtsprofil
   grundsätzlich eine andere/robustere Rang-auf-Stat-Abbildung braucht als
   `rank-to-discipline-stat.json` heute bietet — das würde jede künftige
   `spielEignungOverrides`-Disziplin betreffen, nicht nur Football.
4. Bis dahin: jede künftige „kaderfeste" Referenzziehung (Basislinie, Kader-Familie) mit einem
   Stempel versehen, WANN sie gezogen wurde, und bei jeder Neuziehung explizit dagegen prüfen, ob
   ein `spielEignungOverrides`-Eintrag sich seit der letzten Ziehung geändert hat.

**Kein Produktionscode wurde für diesen Befund geändert.** Der Football-Slot-Bonus-Fix
(`public/mockups/battle-mode.engine.js`) dieser Runde ist davon unabhängig korrekt und gegen die
zeitlich konsistente Fünfer-Familie gemessen.

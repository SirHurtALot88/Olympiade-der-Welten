# Football: Rückkehr zur Matrix (14.11.) — Umsetzung und eine wichtige Überraschung

Chris, im Chat (nicht per PR-Review), wörtlich: „nur zur info auch football muss zu usnerem
system mit der matrix zurückkehren, dann werden die spirit usw stats halt anders in die diszi
stats verteilt die genutzt werden, ich hab dir ja mal erklärt wie ich das machen würde, so dass
du nur diese anzahl an punkten zur verfügung hast und insgesamt 100 vergeben kannst mit der
gewichtung". Das ist Weg A aus `football-matrix-entscheidung.md` (16.09.) — die Entscheidung, die
damals offengelassen wurde. Dieses Dokument beschreibt die Umsetzung UND einen Befund, der die
ursprüngliche Annahme ("Pp sinkt dadurch praktisch auf 0") widerlegt.

## 1. Was geändert wurde

`lib/player-generator/spiel-eignung-overrides.ts`: der `football`-Eintrag in
`spielEignungOverrides` ist entfernt. `resolveDisciplineWeightProfile("football")` fällt jetzt
auf `officialDisciplineWeightMatrix.football` zurück — exakt wie bei den anderen 18 Disziplinen
ohne Override (Mini-DM bleibt die einzige verbleibende Ausnahme, unverändert, eigene Begründung
und eigenes Messwerkzeug).

Automatisch nachgezogen, weil `resolveDisciplineWeightProfile` an einer einzigen Stelle sitzt und
vier Konsumenten hat (s. Kopfkommentar der Override-Datei):

- `calculateRawDisciplineScore` → `p.d.football` (Kaderbildschirm, Transfermarkt, KI-Kauf,
  Training, Scouting) liest jetzt wieder die Matrix.
- `disciplineWeightSeedRows` (DB-Seed) zieht nach.
- `resolveSlotRolesForDiscipline` (Slot-Rollen/-Profile) zieht nach.
- `scripts/generiere-arena-daten.ts` — neu gelaufen (`--schreiben`), `BASIS_JE_DISC.football` in
  `public/mockups/battle-mode.engine.js` ist jetzt bit-identisch zur Matrix (spirit 25, torment
  16, health 14, awareness 11, will 10, determination 8, power 6, stamina 6, charisma 4).

Zwei Folgefunde bei der Regenerierung, beide behoben:

1. **`PP_MATRIX_JE_DISC` wäre verschwunden.** Diese Konstante (eingeführt 25.10., Task #196) stand
   fälschlich INNERHALB des `<<< GENERIERT`-Markers, obwohl der Generator sie nie schreibt — ein
   früherer Agent hatte sie dort von Hand eingefügt, entgegen dem Markerkommentar „nicht von Hand
   ändern". Die Neugenerierung hat sie deshalb mitgelöscht. Jetzt als simpler Alias
   (`const PP_MATRIX_JE_DISC=BASIS_JE_DISC;`) direkt NACH dem `>>> ENDE GENERIERT`-Marker wieder
   eingefügt — korrekt, weil football (die einzige Disziplin, für die beide je divergierten) jetzt
   keinen Override mehr hat, und außerhalb des Markers sicher vor dem nächsten Lauf.
2. **Ein Slot-Rollen-Text/Fokus-Mismatch.** `lib/lineups/matchday-slot-roles.ts` führt für Football
   sechs hart kodierte Rollen-Themen (Text + zwei Fokus-Attribute). "Route Burst" war auf
   `["speed","dexterity"]` gesetzt — beide Attribute wiegen in der Matrix **null** für Football
   (Chris' eigener, damals kritisierter Befund: "weder Geschicklichkeit noch Wahrnehmung stehen
   für einen Quarterback überhaupt zur Verfügung" — jetzt tatsächlich so umgesetzt).
   `resolveThemeFocus()` hätte das lautlos auf die zwei schwersten Matrix-Attribute (spirit/
   torment, von "Ball Hawk" schon belegt) umgebogen, während der Text weiter "Speed und
   Dexterity" versprochen hätte. Auf `["will","charisma"]` umgestellt (die zwei einzigen
   matrixgewichteten Attribute, die noch keine andere Football-Rolle trägt), Text angepasst.
   Alle anderen fünf Rollen (linepower, quarterback, ballhawk, redzone, kickerpunter) behalten
   ihre Fokus-Attribute unverändert — die liegen alle schon in der Matrix.

`REC.football.rezept` (die acht fachlichen Sub-Skills: LAUFKRAFT, PASSGENAUIGKEIT, PASSSCHUTZ,
ABWEHR_PASS, ABWEHR_LAUF, BALLSICHERHEIT, TEAMGEIST, AUSDAUER) ist **unverändert** — dazu gleich
mehr, das ist der Kern der Überraschung.

## 2. Frisch gemessen

### Pp (`node scripts/messe-arena-einfluss.mjs football 48` + `--saat-versatz=10000000`)

| Saatstrom | Vorher (Override) | Nachher (Matrix) |
|---|---:|---:|
| 0 | 121,0 | **113,2** |
| 10 000 000 | 120,1 | **116,2** |

```
Nachher, Saatstrom 0:
Attribut          Anteil   Matrix   Differenz
health              29 %     14   +15.0
power             22.2 %      6   +16.2
speed             18.9 %      0   +18.9
torment           16.2 %     16   +0.2
determination      7.3 %      8   -0.7
dexterity          6.3 %      0   +6.3
stamina            0.1 %      6   -5.9
will                 0 %     10   -10.0
charisma             0 %      4   -4.0
awareness            0 %     11   -11.0
spirit               0 %     25   -25.0
```

**Die Überraschung: Pp sinkt kaum (121→113, 120→116), nicht gegen 0.** `spirit` — Matrixgewicht
25, das größte einzelne Attribut — trägt weiterhin **0 % gemessenen Einfluss**. `will` und
`awareness` ebenfalls 0 %. Grund, gemessen statt vermutet: `einflussVon()` hebt ein ROHATTRIBUT
(+15) und misst die Änderung im tatsächlich SIMULIERTEN Box-Score (`feldspielWert()`, gefüttert
von `resolvePass()`/`resolveLauf()`/`footballDownWeiter()` über `REC.football.rezept`). Dieser
Pfad liest `BASIS_JE_DISC`/den Override/die Matrix **gar nicht** — er liest ausschließlich die acht
hart kodierten Sub-Skill-Formeln (`LAUFKRAFT:{power:41,health:33,speed:26}`,
`PASSGENAUIGKEIT:{power:40,determination:35,dexterity:25}` usw.), die bei der
Rezept-Feinkalibrierung (09.-10.09., vor dem Override) gegen Korridor UND Rangtreue gefittet
wurden — power/health/speed/torment/determination-schwer, `spirit`/`charisma` an KEINER Stelle,
`will`/`awareness`/`stamina` nur klein. **Den Override zu entfernen ändert diese acht Formeln
nicht** — es ändert nur, welche Zahl auf dem Kaderbildschirm steht und welche neun Attribute der
Slot-Bonus anteilig verteilt (daher die kleine, reale Bewegung 121→113: der Slot-Bonus-Pfad liest
`BASIS_JE_DISC` sehr wohl, nur ist sein Gewicht in der Gesamtformel klein gegenüber den Yards-
Termen). Um Pp wirklich unter 25 zu bringen, müsste `REC.football.rezept` selbst neu gegen die
Matrix kalibriert werden — derselbe Sinkhorn-/Sondierungs-Prozess, der das Rezept ursprünglich
gegen den Override gebaut hat (`docs/design/football-rezept-kalibrierung.md`), nur jetzt mit
spirit 25/torment 16/health 14/awareness 11/will 10 als Zielbudget statt power 22/health 18/
speed 14. Das ist eine eigene, mehrrundige Kalibrierungsarbeit (Sondierung + Sinkhorn + Korridor-
Refit + Rangtreue-Iteration, genau das Muster, das die bestehenden PR-Historie-Kommentare im
Rezept-Block dokumentieren) — **nicht** Teil dieser Änderung und nicht in einer Sitzung zu
erledigen.

### rho (`node scripts/miss-alle-disziplinen.mjs 48 football`)

**KORRIGIERT (14.11., später am Tag).** Die erste Messung (0,794) lief gegen die zu dem
Zeitpunkt noch veraltete `data/generated/kaderfamilie-live-save.json` (Save-Stand "19.8.2026",
gezogen 03.09.) — exakt der Vorbehalt, den diese Sektion ursprünglich selbst schon benannte.
Frisch gezogen (`git fetch origin live-save` + `scripts/ziehe-kader-familie.ts`, neuer Save "Oly
New Game Custom 31.10.2026") ergibt sich ein ganz anderes Bild:

| | Override (alt) | Matrix, alte Kaderfamilie | Matrix, FRISCHE Kaderfamilie |
|---|---:|---:|---:|
| rho je Spiel (Median) | 0,807 | 0,794 ("knapp") | **0,270** ("durchgefallen") |
| Spannweite | — | 0,143 | **0,789** |
| rho Saison (Median) | 0,902 | 0,811 | **0,238** |
| Spannweite | — | 0,126 | **0,853** |

Die alte Kaderfamilie hat die Bewegung massiv unterschätzt. **0,270 ist die ehrliche, aktuelle
Zahl** — weit unter der 0,80-Schranke, mit einer riesigen Spannweite (0,789), die zeigt: die
Mechanik ordnet die fünf Kader-Paarungen höchst inkonsistent. Chris akzeptiert eine rho-Bewegung
durch die Matrix-Rückkehr ausdrücklich ("die spirit usw stats werden halt anders verteilt") —
aber 0,270 ist kein "Tradeoff" mehr, sondern ein Totalausfall der Rangtreue. Das macht die
anstehende Rezept-Rekalibrierung (s. Abschnitt 4) dringlich, nicht optional.

### Isolationsnachweis (`node scripts/miss-alle-disziplinen.mjs 24`, alle zwanzig Disziplinen)

Lief parallel zu den beiden Messungen oben, Ergebnis folgt im PR-Thread (lief zum Zeitpunkt der
Doku-Erstellung noch). Erwartung, nicht Messung: unverändert für alle neunzehn anderen
Disziplinen — der Diff rührt ausschließlich `football`-Einträge an (`BASIS_JE_DISC.football`,
`SLOTS_JE_DISC.football`, `PP_MATRIX_JE_DISC` als Alias statt Spezialfall); Mini-DMs Override ist
unberührt.

## 3. Was das für die weitere Arbeit bedeutet

Diese Änderung erledigt, was Chris ausdrücklich verlangt hat: **eine Quelle statt zwei** für
Football, wie bei jeder anderen Disziplin. Sie löst damit den ursprünglichen Befund ("der Manager
sah eine Zahl und bekam ein Spiel, das andere Spieler belohnt") — die Anzeige-Seite stimmt jetzt
wieder mit der gesperrten Matrix überein.

Sie löst **nicht** die Pp-Pflichtschranke (weiterhin 113–116, weit über 25) — das war erkennbar
nicht dasselbe Problem, auch wenn es auf den ersten Blick danach aussieht. Football bleibt
deshalb außerhalb der Pp-Pflichtabnahme, jetzt aber mit einer saubereren, einfacheren
Ausgangslage: keine zweite Gewichtsquelle mehr zu erklären, nur noch eine ausstehende
Rezept-Kalibrierungsrunde (Budget-Methode gegen die Matrix statt gegen den alten Override) —
dieselbe Arbeit, die `football-pp-konflikt-override-vs-matrix-14-11.md` schon als Option B
("moderate Override-Anpassung mit benanntem Realismus-Tradeoff") beschrieben hatte, nur jetzt
ohne Override als Zwischenschritt, direkt am Rezept.

**Offene Frage für Chris/die nächste Runde:** soll diese Rezept-Kalibrierung jetzt angegangen
werden (mehrrundig, mit dem Risiko, dass rho dabei weiter unter 0,80 fällt — football-matrix-
entscheidung.md nennt das 2026 als messbares Risiko: "ein Running Back, dessen Lauf-Eignung zu
56 % aus Geist kommt"), oder bleibt Football vorerst bei "Anzeige stimmt, Mechanik hinkt nach"
stehen?

## Quellen

- `lib/player-generator/spiel-eignung-overrides.ts`, `lib/lineups/matchday-slot-roles.ts`,
  `scripts/generiere-arena-daten.ts`, `public/mockups/battle-mode.engine.js` (dieser PR).
- `docs/design/football-matrix-entscheidung.md` (16.09., die ursprüngliche A/B-Entscheidung).
- `docs/design/football-pp-konflikt-override-vs-matrix-14-11.md` (heute, Vormittag — Befund und
  drei Optionen, jetzt durch Chris' Entscheidung überholt, Historie bleibt gültig).
- `public/mockups/battle-mode.engine.js`, Football-Rezeptkommentar (Zeile ~9672 ff.) für die
  volle Kalibrierungshistorie von `REC.football.rezept`.
- Eigene Messungen dieser Runde (14.11.): `node scripts/messe-arena-einfluss.mjs football 48`
  (+ `--saat-versatz=10000000`), `node scripts/miss-alle-disziplinen.mjs 48 football`,
  `node scripts/miss-alle-disziplinen.mjs 24` (Isolationsnachweis, alle zwanzig).

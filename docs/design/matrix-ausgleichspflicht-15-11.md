# Die Matrix ist über alle 20 Disziplinen ausbalanciert — Ausgleichspflicht bei jeder Änderung

Chris, 15.11., wörtlich: „wenn du die gewichtungen in der matrix anpassen würdest für eine diszi
müsstest du das bei anderen auch machen damit es unterm strich wieder sauber ist, momentan wird
jedes attribut über 20 disziplinen fast gleich gewichetet bis auf 1-2 Punkte unterschied. und das
MUSS so bleiben“ — und: „Wenn du die matrix anpassen musst dann nur so dass das in summe weiter
aufgeht und vorsichtig sein und vor allem den aktuellen ursprungsstand der matrix speichern“.

## Nachgemessen, exakt bestätigt

Summe jedes Attributs über alle 20 Disziplinen (`officialDisciplineWeightTable`, Stand 15.11.,
Commit beim Anlegen dieses Dokuments):

| Attribut | Summe über 20 Disziplinen |
|---|---:|
| power | 167 |
| health | 167 |
| determination | 167 |
| stamina | 167 |
| dexterity | 167 |
| awareness | 167 |
| intelligence | 167 |
| will | 167 |
| speed | 166 |
| charisma | 166 |
| spirit | 166 |
| torment | 166 |

Acht Attribute bei exakt 167, vier bei exakt 166 — eine Spanne von genau 1 Punkt. Das ist die
Ausgleichspflicht, die Chris beschreibt, und sie gilt schon jetzt exakt, nicht nur ungefähr.

## Die Regel, verbindlich für jede künftige Matrix-Änderung

Die Matrix bleibt **grundsätzlich gesperrt** (siehe CLAUDE.md, Abschnitt „Die Eignungsmatrix ist
gesperrt — endgültig“). Jede Ausnahme, die Chris für einen Einzelfall ausdrücklich freigibt
(z. B. ein Attributgewicht einer Disziplin anheben, um ein rho-Problem zu lösen, das sich nicht
über Rezept/ERLAUBT-Tabelle alleine lösen lässt), muss **zusätzlich** diese drei Schritte
einhalten:

1. **Vor jeder Änderung: Ursprungsstand sichern.** Eine vollständige Kopie der aktuellen
   `officialDisciplineWeightTable`/`officialDisciplineWeightMatrix` ablegen, bevor irgendetwas
   geändert wird — siehe `docs/design/matrix-backups/official-discipline-weights-ursprungsstand-15-11.ts`
   für den Stand vom 15.11. (vor jeder weiteren Änderung diesem Muster folgen: neue, datierte
   Kopie, alte nie überschreiben).
2. **Jede Erhöhung braucht eine Senkung an anderer Stelle, in derselben Zeile (Attribut).** Hebt
   man das Gewicht eines Attributs für Disziplin A an, muss man es bei einer oder mehreren anderen
   Disziplinen B, C, … um exakt denselben Betrag senken — nicht bei einem anderen Attribut, bei
   demselben. Ziel: die Zeilensumme (= Summe über alle 20 Disziplinen für dieses eine Attribut)
   bleibt innerhalb der bestehenden 166/167-Spanne (±1 Punkt), nicht einfach „ungefähr ähnlich“.
3. **Nachrechnen, nicht schätzen.** Nach der Änderung die neue Zeilensumme für das betroffene
   Attribut explizit nachrechnen (wie oben) und im PR dokumentieren — genauso wie die Pp-Abweichung
   und rho-Zahl bei jeder Rezeptänderung dokumentiert werden.

Das ist keine Lockerung der Sperre — die Matrix bleibt der Normalfall unangetastet. Es ist die
Nebenbedingung, die gilt, **falls** Chris für einen bestimmten, dokumentierten Einzelfall eine
Ausnahme freigibt (wie es für Football gerade zur Debatte steht, s.
`docs/design/football-matrix-rueckkehr-14-11.md`).

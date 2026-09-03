# Hockey über 0,80 — zweiter Anlauf, kein Fortschritt (ehrlich dokumentiert)

Nach `hockey-rezept-ursache.md` (0,617/0,783 → 0,647/0,860) sollte dieser Anlauf mit der neuen
kaderfesten Messmethode (`docs/design/messgrundlage-kaderfest.md`) prüfen, ob eine weitere,
systematische Korrektur des Sinkhorn-Rezepts (dieselbe Klasse Fund wie beim ABSCHLUSS/
SCHUSS_FERN-Fix, nur konsequent auf alle Sub-Skills angewendet) die Einzelspiel-Rangtreue über
0,80 hebt.

## Was versucht wurde

Für jeden Hockey-Sub-Skill die Spearman-Korrelation seines rezept-gewichteten Attributwerts
gegen die echte Matrix-Eignung gemessen, gepoolt über die fünf echten Kader-Paarungen aus
`data/generated/kaderfamilie-live-save.json`. Mehrere Sub-Skills (AUFBAU, ZWEITCHANCE, ABWEHR,
AUSDAUER, LAUFTEMPO, PARADE) zeigten dieselbe Sinkhorn-Lücke wie zuvor ABSCHLUSS/SCHUSS_FERN:
schwach oder negativ korrelierende Attribute (speed rho 0,25, awareness rho −0,01, will rho
−0,01, spirit rho −0,33) bekamen mehr Gewicht als das stärkste verfügbare Attribut (power rho
0,85 zur Eignung). Die interne Prozentaufteilung innerhalb der von der ERLAUBT-Tabelle
zugelassenen Attribute wurde probeweise zugunsten der stärker korrelierenden Attribute
verschoben — keine neue Attribut-Semantik, TEAMGEIST bewusst unangetastet (LINIENSPIEL-Frage,
s. `hockey-mechanik-angleichen.md`, nicht Teil dieser Runde).

## Ergebnis: schlechter, nicht besser

Kaderfeste Messung (`node scripts/miss-alle-disziplinen.mjs 24 hockey basketball`, 5 echte
Kader-Paarungen, Median über die Familie):

| | Baseline (`hockey-rezept-ursache.md`, bereits gemerged) | Diese Runde, letzte getestete Variante |
|---|---:|---:|
| rho je Spiel | 0,647 (Einzelkader) | **0,595** (Median, Spannweite 0,275) |
| rho Saison | 0,860 (Einzelkader) | **0,769** (Median, Spannweite 0,077) |

Die getestete Variante liegt UNTER der Baseline — bei rho je Spiel sogar deutlich innerhalb der
für Hockey gemessenen Kader-Spannweite (0,275), sodass sich nicht einmal sicher sagen lässt, ob
sie real schlechter ist oder nur eine andere Ziehung derselben Verteilung. Sicher ist: sie ist
NICHT nachweisbar besser. Der Versuch wurde deshalb **nicht committed** — `battle-mode.rezepte.js`
steht unverändert auf dem bereits gemergten `hockey-rezept-ursache`-Stand (rho 0,647/0,860,
Einzelkader-Messung; eine kaderfeste Nachmessung der Baseline selbst steht noch aus, s. unten).

## Einordnung — warum eine weitere Rezeptrunde hier wahrscheinlich nicht mehr trägt

CLAUDE.md: `rho(ein Spiel) = rho(Saison) × Wurzel(Verlässlichkeit)`. Hockeys Saison-Validität ist
mit 0,860 (bzw. 0,769 in dieser vorsichtigeren, kaderfesten Messung) bereits ordentlich — der
verbleibende Abstand zur 0,80-Schranke bei Einzelspiel-rho sieht damit eher nach einem
Verlässlichkeits- als nach einem Rezeptproblem aus. CLAUDE.md dokumentiert aber explizit, dass
mehr Ereignisdichte bei Hockey NICHT hilft (bereits zweimal versucht, rho blieb flach bei
verdoppelter Spielzeit) — der übliche Hebel für ein Verlässlichkeitsproblem ist hier also
blockiert.

Der wahrscheinlich größere verbleibende Hebel liegt nicht im Rezept, sondern in der MECHANIK
selbst: `docs/design/hockey-impact-verteilung-recherche-fable.md` listet sieben priorisierte
Schritte, von denen `hockey-mechanik-angleichen.md` und `hockey-eigene-erfolgskurve.md` bisher
nur einen Teil umgesetzt haben (Passqualität, Abpraller-Ecke, Bully-Duell, A1/A2-Vorlagen, eigene
Erfolgskurve — alle bereits gemergt). Weitere Rezept-Feinjustierung innerhalb der bestehenden
Sub-Skills stößt hier an eine Decke, die nur eine echte Mechanikänderung durchbricht, keine
weitere Sinkhorn-Korrektur.

## Empfehlung

Nicht noch eine Rezeptrunde auf demselben Sub-Skill-Set. Entweder (a) Hockey bei 0,647/0,860
belassen und als "deutlich verbessert, Schranke noch nicht erreicht" verbuchen, oder (b) gezielt
eine der noch unimplementierten Mechanik-Änderungen aus dem Impact-Verteilungs-Bericht angehen —
das ist ein größerer, eigener Auftrag, kein weiterer Feinschliff-Versuch.

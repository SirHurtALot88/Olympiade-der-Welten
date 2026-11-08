# Vision: Oberflächen-/Arena-Varianten mit echter Spielauswirkung + Rempler/Tackling

Chris am 08.11., im Kontext der gerade laufenden Kulissen-Integration (alle 20 Disziplinen
bekommen echte PixelLab-Kulissen statt der alten handgezeichneten Böden, siehe
`docs/design/arena-kulissen-im-motor-03-11.md`). Dies ist die Vision dahinter, aufgeschrieben
auf seinen expliziten Wunsch, damit man sich künftig darauf beziehen kann. Noch kein
Umsetzungsauftrag für den zweiten Teil (Rempler/Tackling) — nur Teil 1 (Oberflächen-Effekte)
ist bereits als Fable-Entwurf in Arbeit (`docs/design/oberflaechen-effekte-konzept-08-11.md`).

## Teil 1: Oberflächen wirken sich spielerisch aus

Chris, sinngemäß zusammengefasst aus mehreren Nachrichten: Wenn wir schon optisch
unterschiedliche Kulissen-Varianten haben (Tennis: Rasen/Sand/Hartplatz; Zeitfahren: Steigung/
Gefälle/Gravel; Takeshi: verschiedene Hindernis-Sets), dann soll sich das auch im Ergebnis
niederschlagen — basierend auf Spieler-Attributen, nicht zufällig.

**Zwei Leitplanken, die Chris selbst explizit bestätigt hat:**
- Die gesperrte Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) bleibt
  unangetastet. Chris wörtlich: „Du sollst nicht die Eignungsmatrix ändern, sondern das, was da
  reinfließt, kann ja dann ein bisschen geschiftet sein, je nachdem." — der Oberflächen-Effekt
  ist ein Zusatzkanal, der die EINGANGSWERTE situativ verschiebt, nicht die Gewichtung selbst.
- Jede Disziplin, die den Effekt bekommt, muss danach weiterhin die normale Abnahme bestehen:
  rho>0,80 je Einzelspiel (Ziel 0,85), Pp-Abweichung≤25 zu den Matrixgewichten.

**Varianten müssen inhaltlich unterschiedlich sein, nicht nur anders eingefärbt.** Chris
wörtlich: „Nicht, dass es einfach nur verschiedene dunkle Areale sind" — Beispiel Breaking: die
Varianten sollen sich auch im Foltermaterial/Setting unterscheiden (nicht nur Lichtstimmung),
damit die unterschiedlichen Attribut-Anforderungen pro Variante auch inhaltlich Sinn ergeben
(eine Variante mit mehr „Ausdauer"-Fokus sieht dann auch danach aus, z. B. längere Tortur-
Stationen statt nur eine andere Farbpalette).

**Wichtige Design-Vorgabe zur Stärke des Effekts: er soll besonders im Mittelfeld wirken.**
Chris wörtlich: „Wenn ein Spieler um die 50 hat und dann aber einen Boost bekommt... würde das
ja auch schon helfen" — und als Gegenbeispiel: ein Spitzenspieler in Takeshi (z. B. eigentlich
„100"-Niveau für diese Disziplin) könnte durch eine für ihn ungünstige Variante auf „90" fallen,
statt die Spitzenposition zu verlieren. Der Effekt soll also eine spürbare, aber nicht
ordnungssprengende Variation bringen — am stärksten bemerkbar bei durchschnittlichen Spielern,
nicht als harter Umsturz der Rangfolge an der Spitze. Das deckt sich mit der bereits bestehenden
CLAUDE.md-Erkenntnis, dass Paare mit großem Eignungsabstand (≥15 Punkte) ohnehin fast immer
richtig geordnet werden und die ehrliche Abnahme-Frage eher im engen Mittelfeld entschieden wird.

Das generalisiert das bereits bestehende Zeitfahren-Gelände-Modell (`BAHN_ART["time-trial"].
gelaende`, `gelaendeFaktor()`/`gelaendeZehrFaktor()`) auf andere Disziplinen: dort wirkt sich
Steigung/Gefälle schon heute real auf Tempo und Ausdauer aus, nur optisch war das bis vor kurzem
nicht sichtbar (siehe die 16.09.-Arbeit an der Zeitfahren-Darstellung). Die neue Aufgabe ist,
dieses Prinzip — Streckenbeschaffenheit wirkt auf passende Attribute — auf Disziplinen
auszuweiten, die bisher keine Geländewirkung hatten (Tennis-Untergrund, Takeshi-Hindernis-Mix
usw.), und das transparent im Spieler-Picker anzuzeigen (bestehendes +/-/Farb-Schema, knüpft an
Task „FM27-Stil farbige Attribut-Effekte" an).

Status: Fable arbeitet an einem konkreten Entwurf (welches Attribut wirkt wie stark auf welcher
Variante, pro Disziplin), Opus-PM übernimmt die Umsetzung als eigene Spur neben der laufenden
rein-visuellen Kulissen-Integration.

## Teil 2: Rempler/Tackling als projektweite Mechanik (noch nicht beauftragt)

Zweiter Gedanke, den Chris in derselben Vision mitgegeben hat, bisher nur als Idee festgehalten,
NICHT als aktiver Auftrag:

Die Olympiade versteht sich explizit als „etwas offensivere und brutalere" Variante des Sports —
Tackling ist nicht nur in Eishockey erlaubt (dort als Check-Mechanik schon vorhanden, siehe
`docs/design/hockey-ausdauer-checks-konzept-13-09.md`), sondern laut Chris grundsätzlich auch bei
Staffel und Climbing: „Es ist Tackling erlaubt, auch bei der Staffel, es ist Tackling erlaubt,
beim Klettern." Rempler sollen dort dazu führen, dass getroffene Spieler langsamer werden oder
stolpern — als Normalzustand des Formats, nicht als Sonderregel.

**Offene Frage von Chris selbst, unbeantwortet:** braucht ein Rempel-/Stolper-Moment eine eigene
Animation? Die bestehende Tod-/K.o.-Animation (`FigurAnimationKind: "tod"`) eignet sich dafür
NICHT — ein gestolperter, aber weiterhin aktiver Spieler ist kein K.o. Falls das umgesetzt wird,
braucht es entweder eine neue, fünfte Animationsart (über die vier bestehenden `walk | angriff |
tod | treffer` hinaus) oder eine Wiederverwendung/Abwandlung von `treffer` (die es inhaltlich
näher trifft: kurze Unterbrechungs-Reaktion, keine Kampfunfähigkeit).

**Nicht Teil dieser Vision-Niederschrift:** eine konkrete Umsetzungsentscheidung für Teil 2. Das
ist absichtlich nur dokumentiert, damit es nicht verloren geht — ob und wann das als eigener
Auftrag gestartet wird, entscheidet Chris separat.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UYLNtXkprKr1XK4c3X2xQq

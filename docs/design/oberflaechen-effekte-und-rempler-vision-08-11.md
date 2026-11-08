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

## Teil 2: Rempler/Tackling als projektweite Mechanik, persönlichkeitsgesteuert (Recherche-Auftrag, noch keine Umsetzung)

Zweiter Gedanke, den Chris in zwei Nachrichten am 08.11. mitgegeben hat. Status seit der
zweiten Nachricht: **Recherche-Auftrag an Opus (technische Machbarkeit) und Fable (kreativer
Entwurf), parallel**, noch keine Umsetzung. Chris wörtlich: „Das müsstest du selber dann mit
Opus und Fable mal recherchieren."

### Grundidee

Die Olympiade versteht sich explizit als „etwas offensivere und brutalere" Variante des Sports —
Tackling ist nicht nur in Eishockey erlaubt (dort als Check-Mechanik schon vorhanden, siehe
`docs/design/hockey-ausdauer-checks-konzept-13-09.md`), sondern laut Chris **projektweit überall,
wo Spieler gegeneinander antreten** — explizit auch Staffel und Climbing, nicht nur als
Einzelfälle: „Das gilt für alles... rein theoretisch, wenn Spieler gegeneinander antreten."
Rempler sollen Getroffene verlangsamen oder zum Stolpern bringen — Normalzustand des Formats,
keine Sonderregel.

### Strukturelle Ergänzung: Eiskunstlauf soll vier Aktive gleichzeitig zeigen

Chris, sinngemäß: aktuell laufen Eiskunstlauf-Duelle (und vermutlich ähnliche 1v1-Formate) mit
jeweils nur den zwei Kontrahenten sichtbar. Die eigentliche Idee war von Anfang an, dass **beide
Team-Duos gleichzeitig auf dem Feld/Eis** sind — die zwei eigenen Aktiven UND die zwei Aktiven
des Gegners — „damit man immer was zu gucken hat" und damit die Spieler über die Rempler-Mechanik
tatsächlich miteinander interagieren können. Das ist eine eigene strukturelle Frage (wie viele
Akteure sind gleichzeitig auf der Fläche, nicht nur ob Tackling existiert) und muss bei der
Machbarkeits-Recherche mitgedacht werden — vermutlich betrifft das mehr als nur Eiskunstlauf.

### Persönlichkeit steuert Rempel-Häufigkeit und Rollentreue

Der eigentliche Kern von Chris' zweiter Nachricht: Tackling/Rempler soll nicht gleichverteilt
oder rein zufällig passieren, sondern von der **Persönlichkeit des Spielers** abhängen — und
diese Persönlichkeit soll aus den bereits vorhandenen Traits (und ggf. Klassen) der Spieler
abgeleitet werden, nicht als komplett neues, separates System.

Konkret, Chris' eigenes Beispiel: ein Spieler mit Haupt-Persönlichkeit „Egomaniac" (plus
möglicherweise einer Neben-Persönlichkeit) ist in einen taktischen Slot gesteckt, der
teamfokussiertes Verhalten verlangt — spielt der „Egomaniac" diesen Slot trotzdem brav
teamfokussiert, oder weicht er davon ab, weil seine Persönlichkeit dagegen steht? Chris will,
dass solche Persönlichkeitszüge **sichtbar im Verhalten ankommen**, nicht nur als Textlabel im
Kader stehen: „Dieses Egomaniac fließt natürlich auch da rein, wie er sich auf dem Schlachtfeld
verhält... wenn er einen Slot hat, wo er teamfokussiert spielen soll, aber er ist ein Egomaniac,
dann macht er das zum Beispiel nicht unbedingt."

**Vorgeschlagene Struktur (von Chris skizziert, nicht final):**
- Eine neue „Persönlichkeits-Matrix": Attribute + Traits (+ ggf. Klassen) ergeben eine oder
  mehrere Persönlichkeits-Ausprägungen pro Spieler — eine Haupt-Persönlichkeit, ggf. eine oder
  mehrere Neben-Persönlichkeiten.
- Die **Kombination** aus Haupt- und Nebenpersönlichkeit fließt in die Berechnung ein, nicht nur
  die Haupt-Persönlichkeit isoliert.
- Diese Berechnung läuft im Hintergrund (pro Match oder pro Spieler einmalig aus den
  Stammdaten abgeleitet — zu klären in der Recherche), nicht sichtbar als manuelle Einstellung.
- **Kann sich von Disziplin zu Disziplin unterscheiden** — dieselbe Persönlichkeit könnte in
  einer Disziplin anders wirken als in einer anderen.

### Offene Fragen für die Recherche (nicht raten, klären)

1. Wo im Code leben Traits und Klassen aktuell (Datenmodell, wie sie heute schon in die
   Eignung/Verhalten einfließen), und wie ließe sich eine Persönlichkeits-Ableitung sauber
   als Zusatzschicht anhängen, ohne die gesperrte Eignungsmatrix zu berühren?
2. Governance-Frage wie bei Teil 1: wirkt sich das auf rho/Pp-Abweichung aus? Vermutlich ja,
   da Rempel-Häufigkeit indirekt Ergebnisse beeinflusst — muss geprüft werden, pro betroffener
   Disziplin, zwei Saatstämme.
3. Braucht ein Rempel-/Stolper-Moment eine eigene Animation? Die bestehende Tod-/K.o.-Animation
   (`FigurAnimationKind: "tod"`) eignet sich dafür NICHT — ein gestolperter, aber weiterhin
   aktiver Spieler ist kein K.o. Entweder eine neue, fünfte Animationsart (über die vier
   bestehenden `walk | angriff | tod | treffer` hinaus) oder eine Abwandlung von `treffer`
   (kurze Unterbrechungs-Reaktion, keine Kampfunfähigkeit).
4. Eiskunstlauf-Strukturfrage (vier Aktive gleichzeitig): technisch wie aufwendig, und welche
   anderen Disziplinen bräuchten dieselbe Umstellung?
5. Wie zeigt man die Persönlichkeit UND ihre Spielauswirkung transparent im Kader/Picker an,
   konsistent mit dem bestehenden +/-/Farb-Schema (wie Teil 1)?

**Nicht Teil dieser Vision-Niederschrift:** eine konkrete Umsetzungsentscheidung. Das ist jetzt
ein Recherche-Auftrag (Opus: technische Machbarkeit und Architektur, Fable: Persönlichkeits-
Taxonomie und wie sich Kombinationen auswirken sollen) — Ergebnis fließt zurück an Chris, bevor
irgendetwas umgesetzt wird.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UYLNtXkprKr1XK4c3X2xQq

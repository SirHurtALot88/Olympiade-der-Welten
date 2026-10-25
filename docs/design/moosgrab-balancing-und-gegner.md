# Moosgrab: Balancing nach Stufe und Gegnerliste

Stand 14.10. Gilt für alle fünf Maps im Reiter Spielen und für jede neue Map.

## Regel (Chris, 14.10.)

Die Stufe, die am Anfang des Abends gewählt wird, bestimmt, wie viele Punkte die Gegner haben, und
zwar nach OPR: Eine Gegnerwelle hat **25 / 50 / 75 / 100 % der Heldenpunkte** (Leicht / Normal /
Schwer / Albtraum). Die Werte der Gegner ändern sich nie; es kommen nur mehr oder weniger.

- Jede Map ist für **340 Heldenpunkte auf Normal** geschrieben (die vier Vorlagen-Helden
  Schurke 80, Krieger 105, Waldläufer 70, Kleriker 85). Eine eigene Gruppe skaliert über ihre Punkte.
- **Bosse und Story-Gegner** (eigene Werte, ohne `skaliert`) stehen auf jeder Stufe. Auf Leicht
  ist ein Kampf deshalb manchmal größer als das Budget; dort steht nur der Boss, ohne Begleiter.
- **Wer auf Schwer mitwachsen soll**, braucht skalierbare Gruppen (Vorlagen-Karten oder eigene
  Werte mit `skaliert: true`) oder eine `verstaerkung`.
- **Nachschub** am Rundenende skaliert die Zahl seiner Runden (`hoechstens` mit `skaliert`).
- **Verbündete**: Mit `verbuendeteZaehlen` an der Map zählen ihre Punkte zur Gruppe (Map 5).
- **Das Finale** rechnet eine Stufe höher als gewählt (`stufePlus: 1`).
- Ein Kampf, der bewusst nicht nach Budget läuft, trägt `budgetFrei: "<Grund>"`.

**Der Test** `tests/kartenschmiede.test.ts` („Moosgrab-Balancing über alle fünf Maps“) prüft
jeden Kampf jeder Map: Auf Normal steht höchstens 15 % mehr als das Budget am Tisch (Bosse und
Story-Gegner ausgenommen), und auf Schwer wächst jeder Kampf mit, der dafür Platz hat. Eine neue Map
muss ihn bestehen.

Die Zahlen unten kommen aus dem Motor selbst (`betrete` auf den Kampfschritt, dann `budgetVon`), mit
den Punkten aus `apps/kartenschmiede/regeln.js` und den Werten der Kartenschmiede-Vorlagen.

## Punkte je Kampf am Tisch (Start, ohne Nachschub, 340 Heldenpunkte)

| Map | Kampf | Leicht | Normal | Schwer | Albtraum | Anmerkung |
|---|---|---:|---:|---:|---:|---|
| 1 | Sporenlinge | 50 | 100 | 150 | 200 | |
| 1 | Die Erblühte | 130 | 130 | 205 | 255 | Boss, auf Leicht allein |
| 2 | Das zuckende Grab | 20 | 20 | 20 | 45 | ein Grab, ab Albtraum Grabgänger dazu |
| 2 | Die drei stehen auf | 75 | 75 | 125 | 150 | ab Schwer stehen mehr auf |
| 2 | Die Gemeinde / Erlösen | 175 | 175 | 275 | 350 | die sieben Knienden sind Story, dazu Grabgänger |
| 3 | Sporenlinge (Lärm 3) | 50 | 100 | 150 | 200 | |
| 3 | Das ganze Dorf | 125 | 125 | 200 | 250 | Schmied als Boss |
| 3 | Gemeinde | 25 | 50 | 75 | 100 | |
| 3 | Die Harms | 75 | 75 | 125 | 150 | Familie (Story), ab Schwer Sporenlinge dazu |
| 3 | Der Schmied | 125 | 125 | 200 | 250 | Boss |
| 3 | Der Enttarnte | 25 | 25 | 50 | 50 | |
| 4 | Wurzelgänge | 50 | 100 | 150 | 200 | |
| 4 | Das Erwachen | 110 | 165 | 275 | 330 | `budgetFrei`: Nachschub aus den Nischen ist die Uhr |
| 5 | Das brennende Herz (mit dem Überlebenden) | 285 | 390 | 495 | 655 | eine Stufe höher, Überlebender zählt zur Gruppe |
| 5 | Die Flucht | 190 | 190 | 190 | 190 | `budgetFrei`: ein Verfolger, kein Kampf zum Gewinnen |

## Gegnerliste für die Miniaturen

Werte so, wie die Kartenschmiede sie rechnet. „Vorlage“ heißt: Die Karte kommt aus den
Kartenschmiede-Vorlagen und ist ein Platzhalter, bis Chris eine eigene Karte mit seiner Miniatur
anlegt.

| Wer | Maps | P. | Werte | Rolle | Miniatur (Vorschlag) | Wie viele höchstens |
|---|---|---:|---|---|---|---|
| Sporenling | 1, 3, 4, 5 | 25 | Q5+ D6+ Z3, Biss A2 Gift, Speichel 12" A2 | Kleinvieh | kleine Kreatur, hundegroß | ~10 (Map 5) |
| Sporenling (zäh) / Grabgänger | 1, 2 | 25 | Q5+ D4+ Z4, Sporenstoß 9" A2, Langsam | Kleinvieh | etwas Pilziges, Untotes | ~7 |
| Befallene Dorfbewohner (Gemeinde, Harms, Befallene) | 2, 3, 5 | 25 | wie Sporenling | Story-Gegner | Black Grail (Trench Crusade) | 7 (Map 2) |
| Die Erblühte | 1 | 130 | Q4+ D4+ Z10, Wurzelarme A4 Reißend, Regeneration | Boss Map 1 | Frau, halb Pflanze | 1 |
| Das zuckende Grab | 2 | 20 | Q5+ D5+ Z2, bewegt sich nicht | Gelände | ein Grab | 1 |
| Der Schmied | 3 | 125 | Q4+ D3+ Z9, Hammer A4 DS(1) Reißend | Boss Map 3 | großer Mann mit Hammer | 1 |
| Rüstungsmann / Leere Rüstung | 4, 5 | 55 | Q4+ D2+ Z3, Glutgewehr 18" A1 DS(1), Langsam | Truppe | Rubric Marine (Thousand Sons) | ~5 |
| Der Gelehrte | 4, 5 | 110 | Q3+ D2+ Z5, Blaues Feuer 12" Explosion(3), Zauberer | Boss Map 4, Magier Map 5 | Sorcerer (Thousand Sons) | 1 |
| Der Rufer | 5 | 175 | Q3+ D2+ Z7, Glutzauber 18" A2 DS(1) Explosion(2), Zauberer | Boss Map 5 | zweiter Sorcerer, größer | 1 |
| Der Glutleib | 5 | 190 | Q4+ D4+ Z12 Größe 2, Glutklauen A3 DS(1) | Verfolger auf der Flucht | das größte Monster | 1 |
| Der Verwundete / Überlebende | 4, 5 | 145 | Q3+ D2+ Z6, Schweres Gewehr 24" A2 DS(1) | Verbündeter | Space Marine | 1 |
| Mutter Hedda | 2 | ~20 | Q5+ D5+ Z3, Brotmesser A1, flieht beim letzten Treffer | NPC | alte Frau mit Kerze | 1 |
| Knechte, Wirtin | 3 | 15 / 30 | Knüppel A1; Armbrust 12" DS(1) | Verbündete | Bauern | 2 + 1 |

Fehlt Chris eine Miniatur, schickt er Bilder dessen, was er hat; dann wird die Karte auf das
Modell angepasst (Werte bleiben, nur Name und Bild ändern sich), oder die Rolle bekommt andere Werte
mit denselben Punkten.

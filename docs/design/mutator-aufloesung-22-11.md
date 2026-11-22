# Mutator in der Auflösung (22.11.)

Chris: „da müssen die natürlich auch rein, weil die sich auswirken, und DORT müsste auch der Mutator-Effekt mal drin stehen“.

## Woher die Treffer kommen
- Treffer je Spieler (0/1/2) stehen im Resolve-Entry als `mutatorHits` (`legacy-score-engine.ts`, gesetzt auf jedem Pfad, auch wenn der Treffer im Motor als Attribut wirkt). Von dort laufen sie in die Preview (`DisciplineResolvePreview.teamResults[].entries[]`) und in die Buchung (`PlayerDisciplinePerformanceRecord.mutatorHits`).
- Wirkung im Battle-Modus (`lib/battle/battle-mutator-organisch.ts`): Motor-Seiten +3,5 Attribut je Treffer im Grundwert; legacy-gewertete Seiten und Vorschau +3,5 Form je Treffer über `mitMutatorForm` / `formByPlayerId[id].mutator` (steckt im Formanteil `formShare`).
- Mutator-Punkte (`mutatorBonus`, `mutatorPpsBonus`) sind dort 0, darum zeigte die Auflösung bisher nichts.

## Was gezeigt wird (nur Battle-Modus, nur bei Treffern)
- Detail-Ergebnis (`DisciplineStageResultTable`): je Spieler `◆ 2× · Form +7,0`, je Team die Summe unter Gesamt, Legende, Rechen-Tooltip (`calcString`) und Hover-Aufschlüsselung nennen den Mutator.
- Spieltagswertung (`DisciplineStageSpieltagswertung`, Blatt): je Spieler dieselbe Zeile, je Disziplin-Seite eine vierte Kachel „Mutator-Treffer ◆ 4× / Form +14,0“.
- Manager-Modus unverändert: `mutatorHits` wird dort nicht durchgereicht, es bleiben „◆ +0,3“ und „+ Mutator ◆“.

## Ehrlichkeit (gezeigt = gebucht)
Der Punkteanteil des Mutators am Wert ist nicht trennbar: auf Motor-Seiten steckt er im Grundwert und läuft durch die ganze Eignungs-Kette, auf legacy-Seiten im Formanteil samt Multiplikator und Tagesform-Streuung. Darum steht nur die Nennhöhe (Treffer x 3,5 Form), keine Punktzahl, und der Hinweis „keine Punkte / im Wert enthalten“. Es gibt keine eigene Mutator-Zeile in den `mods` (sonst würde das Netto verändert). Reine Anzeige, Wertung unberührt.

## Prüfung
- Fingerabdruck `--node`: GESAMT `fe1dc086d68d` vorher und nachher.
- Test `tests/mutator-aufloesung.test.ts`; Bestandstests der betroffenen Ansichten grün.
- Bilder: Prüfstand `scripts/mutator-aufloesung-pruefstand/` (echte Komponenten und echtes CSS, Chromium; Treffer SYNTHETISCH, die laufende App erreicht die Wertung im Dev-Server nicht verlässlich, siehe `spieltagswertung-anzeige-21-11`). Ordner `mutator-aufloesung-22-11/`: `wertung|ergebnis` x `basketball` (Feldspiel) | `zeitfahren` (Bahn) x `vorher|nachher` x 1920 | 2560. Kein Seitenscroll. Stichprobe Bühne/Spurt nicht aufgenommen (gleiche Komponenten, gleiche Datenform).

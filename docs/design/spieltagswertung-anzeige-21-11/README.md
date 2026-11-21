# Spieltagswertung: Anzeige (21.11.)

Gebaut: Differenz je Begegnung, Ansicht "Begegnungen" (wer gegen wen, Duelle und Vierergruppen, mit Differenz und E1-Skala), Form und Captain je Disziplin (Tabelle: "D1 . D2", Blatt: Kacheln), Mutator-Spalte und Mutator-Kachel raus (nur noch bei Mutator-Punkten im Manager-Modus), Zeit/Summe statt "1:0" (Zeitfahren, Staffel), besiegte Gegner bei Breaking.

Zeit-Daten: neues optionales Feld `ergebnisAnzeige` (Motor `spieleBahn`/`spieleBuehneGauntlet` -> Runner -> Override -> Resolve -> `DisciplineResultRecord`), nur Nachlese, `seiten`/Punkte unberuehrt, Fingerabdruck GESAMT eaafed96150e. Aeltere Spieltage tragen es nicht: Zeitfahren/Staffel zeigen dann nur Sieg + Skala, Breaking leitet besiegte Gegner aus Ueberlebenden und Einsatzlisten ab.

Bilder: Pruefstand (echte Komponente + echtes CSS, Chromium) mit Daten des live-save-Abbilds; Spieltage 12-19 wurden in der KOPIE per Auto-Run gespielt, damit Zeitfahren (md15) echte `ergebnisAnzeige` traegt. Form/Captain in den Bildern sind SYNTHETISCH. Die laufende App liess die Arena im Dev-Server nicht bis zur Wertung laden, daher keine App-Aufnahme.
p15 Staffel+Zeitfahren (Bahn), p11 Eiskunstlauf (Buehne)+Breaking, p12 Mini-DM+Basketball (Feldspiel), p18 Fechten+Spurt (Bahn); -liga/-tab/-beg = Beide Ligen / Einzelliga-Tabelle / Begegnungen.

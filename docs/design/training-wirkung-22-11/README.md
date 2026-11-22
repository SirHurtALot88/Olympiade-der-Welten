# Training: Wo das ankommt, Plan-Vorschau, Verletzte, Belastungs-Verlauf (22.11.)

Anlass: Chris am 22.11. mit Screenshots (Aeon Flux zeigt Hockey 99,3 +0,40, Zynara in der Reha ohne Prognose). Gebaut wurde nur Anzeige und
Prognose-Verdrahtung; Trainingsraten und Formeln sind unberührt (Fingerabdruck `fe1dc086d68d`).

## Ursache der 99,3

Die kompakte Anfangsladung des Browsers streicht die Attributbögen aller fremden Spieler (Fog of War, `foundation-initial-compact-state.ts`).
Nur der eigene Kader behält sie. `buildLeagueDisciplineRatingsWithAttributeOverrides` ließ jeden Spieler ohne Bogen still aus der Rangliste fallen und
rechnete die Eignung deshalb als Rang unter rund zehn Eigenspielern. Rang 1 ergibt in der Rang-zu-Stat-Tabelle 99 bis 100.
Das war weder falsche Skala noch Perzentil noch Normierung, sondern eine zu kleine Liga. Am vollen Serverstand (2984 Bögen) liefert dieselbe Rechnung
für Aeon Flux Hockey 43,4, wie die Plan-Kacheln (`player.disciplineRatings`). Weil ein Rang 1 nicht weiter steigen kann, kamen in den anderen
Disziplinen außerdem nur Nullen an (Basketball 97,8 ±0,00).

## Lösung (`lib/training/eignung-aus-attributen.ts`)

* Bezugspunkt ist immer der gespeicherte Wert, dieselbe Quelle wie die Plan-Kacheln.
* Sind (fast) alle Bögen da (Server, Tests): exakte Engine, nur das Delta wird aufgelegt.
* Im Browser: Delta aus der Matrix-Rohsumme (`calculateRawDisciplineScore`, Matrix nur gelesen). Aus Rohsumme und gespeichertem Rang der Spieler mit Bogen
  wird ein Normalverteilungs-Fit gelegt; der neue Rang geht durch dieselbe Rang-zu-Stat-Tabelle. Gemessen am vollen Live-Stand: mittlerer Abstand
  zur exakten Rechnung 0,08 Eignungspunkte (Maximum 1,1), und die Anzeige nennt es „geschätzt".

## Was neu ist

1. Wo das ankommt: Top 6 nach Zuwachs aus allen 20 Disziplinen, mit Eignung jetzt → Saisonende, Delta, Kaderplatz.
2. Plan-Ansicht rechts: Top 5, auf die der Plan wirkt, bisher → mit Änderung (Ziel, Weg, Intensität).
3. Verletzte: Zuwachs je Spieltag, Weg-Prognosen und Wo-das-ankommt rechnen ab dem erwarteten Rückkehr-Spieltag, Hinweis „ab Spieltag N"
   (`prognostiziereTrainingAbRueckkehr`, Quelle des Ausfalls wie in der Buchung). Training ruht weiter.
4. Intensität: Mini-Sparkline je Stufe (`lib/training/belastungs-forecast.ts`), Schwelle 25 markiert. Rechnung mit den Buchungsfunktionen
   (`projectMatchdayInjuryRisk`, `getPlayerActiveRecoveryCredit`, `calculatePlayerRecovery`, Trainingsschicht wie der Akkumulator, Pause nach Spieltag 10 unter Regel v2).
   Annahme: eingesetzt an jedem Spieltag, normale Intensität, Platz mittel.

## Ehrliche Lücke

Die Belastung je Spieltag wird im Spielstand nicht historisiert (`injuryEvents` sind im Speicher auf Verletzungen gekürzt, `playerAvailabilityState` hält nur
den aktuellen Stand). Der Verlauf „bisher" besteht deshalb nur aus dem heutigen Punkt; historisiert ist allein die Trainingsschicht (`verlauf[].l`),
sie steht als Reihe `trainingsschichtVerlauf` im Modell bereit. Ein echter Verlauf bräuchte eine Buchung je Spieltag in der Fatigue-Buchung, das ist
nicht Teil dieser Anzeige-PR.

Aufnahmen: `scripts/screenshot-training-wirkung.ts`, Live-Abbild, Team D-P, 1920×1080 und 2560×1440.

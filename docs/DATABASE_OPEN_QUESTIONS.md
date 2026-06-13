# Database Open Questions

## Alliance source of truth

Es gibt aktuell einen `Alliance`-Typ und Hinweise im Draftboard-Schema-Mapping, aber keine belastbare aktive Seed-Quelle im App-Datenbestand.

Aktueller Umgang:

- Prisma-Modell ist vorhanden
- Seed erzeugt aktuell keine Alliance-Zeilen
- Teams werden mit `allianceId = null` importiert

## Offizielle Discipline Weight Matrix

Die App braucht langfristig eine belastbare offizielle Attributmatrix pro Disziplin fuer Slot-v2, Spielerpool-Header, Slot-Anforderungen und SlotScore-v2.

Aktueller Umgang:

- das Datenmodell bildet die Matrix bereits korrekt als eigene Tabelle ab
- die Seedwerte kommen vorerst aus `lib/db/seed/seedSources.ts`
- die aktuelle Matrix ist als `provisional-app-seed-2026-06` markiert
- sobald eine verifizierte offizielle Quelle vorliegt, soll nur die Seedquelle ersetzt werden, nicht das DB-Modell

Offen bleibt damit ganz konkret:

- welche Referenzdatei oder Export die offizielle Matrix verbindlich liefert
- ob es bereits saisonabhaengige Varianten der Matrix gibt
- ob spaeter zusaetzliche Attributachsen ueber `pow`, `spe`, `men`, `soc` hinaus in die App uebernommen werden muessen

## Full weight matrix vs current 4-axis schema

Die aktuelle DB speichert pro Disziplin genau 4 aktive Weight-Rows:

- `pow`
- `spe`
- `men`
- `soc`

Das ist fuer den momentanen Foundation-Stand technisch konsistent, aber fachlich noch nicht ausreichend fuer die offizielle Retool-Matrix.

Wichtige Klarstellung:

- Top-4 ist Display-Logik
- die DB/Engine soll langfristig alle aktiven Gewichtungen speichern
- einige Disziplinen haben laut Retool-Referenz 6 bis 7 aktive Gewichtungen
- diese lassen sich aktuell noch nicht korrekt persistieren, weil das Prisma-Modell nur die 4 bestehenden Kernachsen kennt

Konsequenz:

- `DisciplineWeight > 20` ist kein ausreichender Audit-Check
- pro Disziplin muss spaeter die Summe aller aktiven Gewichte plausibel bei etwa 100 liegen
- die Anzahl aktiver Weight-Rows muss pro Disziplin variieren duerfen
- fuer die echte Korrektur brauchen wir eine additive Erweiterung des Attributmodells, nicht nur einen Seed-Tausch

## Lineups beim Seed

Noch offen ist, ob fuer jede Kombination aus Save, Matchday und Team schon beim Seed leere `lineups` angelegt werden sollen oder ob diese erst spaeter lazy erzeugt werden.

Aktueller Umgang:

- Schema ist vorbereitet
- Seed erzeugt aktuell noch keine Lineups und keine LineupSlots

## JSON-Felder bei Player

`subclasses`, `traitsPositive`, `traitsNegative` und `preferredDisciplineIds` sind aktuell als Listen im Seed vorhanden.

Aktueller Umgang:

- in Prisma v1 defensiv als `Json`
- spaetere Normalisierung moeglich, falls diese Felder aktiv filterbar oder relationell auswertbar werden

## joinedSeasonId in ActivePlayer

`joinedSeasonId` ist aktuell ein String aus der App-Welt und kein strikter relationaler Fremdschluessel.

Aktueller Umgang:

- Feld bleibt als String erhalten
- spaeter pruefen, ob daraus ein strenger Season-Bezug werden soll

## Team identity sliders

Die Teamprofil-Werte aus `team-identities.json` koennten langfristig entweder:

- dauerhaft in `team_season_state` liegen
- oder spaeter in ein separates Teamprofil-/Identity-Modell ausgelagert werden

Aktueller Umgang:

- vorerst in `team_season_state`, weil sie aktuell am ehesten save-/season-nah verwendet werden

## Sponsor start values

Aktuell gibt es keine belastbare eigene Startquelle fuer Sponsorbetrag oder Sponsorhistorie im App-Datenbestand.

Aktueller Umgang:

- `sponsor` ist im Modell vorgesehen
- der Seed setzt den Startwert derzeit auf `null`

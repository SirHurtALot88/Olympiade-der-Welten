// ===================================================================================
// SPIEL-EIGNUNG — DIE ZIELGROESSE DES MINISPIELS, ALS OVERRIDE NEBEN DER MATRIX
//
// WARUM ES DIESE DATEI GIBT
//
// Fuer eine Disziplin, deren Minispiel bereits gebaut und kalibriert ist, gab es bis
// hierher ZWEI Ordnungen desselben Kaders:
//
//   1. die Anzeige-/Kauf-Ordnung — `officialDisciplineWeightTable` → `p.d[disziplin]` →
//      Kaderbildschirm, Transfermarkt-Linse, Teamstaerke, KI-Kauf, Training, Scouting;
//   2. die Spiel-Ordnung — die Gewichte, GEGEN DIE das Minispiel kalibriert wurde und
//      gegen die die Rangtreue-Sonde misst.
//
// Bei Football lagen die beiden bei rho 0,427 auseinander (110 Spieler der Kader-Familie,
// docs/design/football-erfolgskurve-plan-05-09.md 2.3): Ser Camelot faellt von Rang 1 auf
// 27, Johanna von 2 auf 25. Der Manager sah also eine Zahl und bekam ein Spiel, das andere
// Spieler belohnt — und die KI kaufte fuer das falsche Spiel ein.
//
// Der Rueckweg (Minispiel zurueck auf die Matrix) ist gemessen tot: rho 0,053 je Spiel
// (docs/pm-briefings/opus-plan-football-gameplay-09-10.md 3), weil das drittschwerste
// Matrix-Attribut (awareness) auf dem echten Kader mit −0,335 gegen die eigene Matrix-
// Eignung korreliert (docs/design/football-matrix-entscheidung.md). Also zieht die
// Anzeige-/Kauf-Seite nach — Fable-Entscheidung E3,
// docs/pm-briefings/fable-entscheidung-e1-e2-e3-basketball-hockey-football-10-09.md
// Abschnitt 3.
//
// WARUM ALS OVERRIDE UND NICHT IN DER MATRIX-DATEI
//
// Chris am 05.09., woertlich: „die Gewichtungsmatrix darf nicht veraendert werden! wenn
// dann muessten die Stats und wie sie in die Attribute der Diszi einfliessen angepasst
// werden". `lib/player-generator/official-discipline-weights.ts` bleibt deshalb
// BYTE-IDENTISCH — `git diff origin/main -- lib/player-generator/official-discipline-weights.ts`
// ist die erste Abnahmepruefung jeder PR, die diese Tabelle hier anfasst. Was sich aendert,
// ist NICHT die Matrix, sondern welche Gewichtsquelle eine einzelne Disziplin fuer ihre
// Attribut-Einrechnung benutzt — genau die zweite Haelfte von Chris' Satz.
//
// WER DAS HIER LIEST — und wer bewusst NICHT
//
// Gelesen wird der Override an vier Stellen, alle ueber `resolveDisciplineWeightProfile`:
//   * `calculateRawDisciplineScore` (lib/player-formulas/discipline-rating-engine.ts) —
//     damit folgen `p.d[disziplin]` und ALLE Leser von `disciplineRatings` automatisch;
//   * `disciplineWeightSeedRows` (lib/db/seed/seedSources.ts) — die DB-Kopie (`weightPct`),
//     aus der KI-Needs und die Lineup-Dienste lesen;
//   * `resolveSlotRolesForDiscipline` (lib/lineups/matchday-slot-roles.ts) — die
//     Slot-Profile werden aus der Gewichtsquelle abgeleitet und muessen mitziehen, sonst
//     zieht der Slot-Aufschlag an Attributen, die fuer die Disziplin nichts mehr wiegen;
//   * `scripts/generiere-arena-daten.ts` — `BASIS_JE_DISC` im Motor.
//
// NICHT gelesen wird er (bewusst, Stand 10.09.) von `team-powers.ts` (abgeschaltet),
// `training-levelup-service.ts` und `organic-season-progression.ts`. Die drei rechnen
// Attribut-ZUWACHS, nicht Eignung; sie umzustellen ist eine eigene Entscheidung mit eigener
// Messung.
//
// EINE QUELLE, NICHT ZWEI: sobald eine Disziplin hier steht, ist ihr `spielEignung`-Eintrag
// in `FELDSPIEL_ART` (public/mockups/battle-mode.engine.js) redundant und wird entfernt —
// `produktionsWert` aus `p.d[disziplin]` liefert dann dieselbe Rangfolge.
//
// EINEN EINTRAG HINZUFUEGEN ist deshalb KEINE Kleinigkeit: er aendert eine spieler-sichtbare
// Zahl im Kaderbildschirm und das, wofuer die KI Geld ausgibt. Er gehoert erst dann hierher,
// wenn das Minispiel der Disziplin gegen genau diese Gewichte kalibriert UND gemessen ist,
// und `node scripts/miss-alle-disziplinen.mjs 48 <disziplin>` danach neu gefahren wurde.
// ===================================================================================

import {
  officialDisciplineWeightMatrix,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";

export type DisciplineWeightProfile = Partial<Record<PlayerGeneratorAttributeKey, number>>;

/**
 * Gewichte der Spiel-Eignung je Disziplin, die ihr Minispiel schon bedient.
 *
 * Football: 1:1 uebernommen aus `FELDSPIEL_ART.football.spielEignung`
 * (public/mockups/battle-mode.engine.js, eingefuehrt mit PR #803, gemessen mit PR #884).
 * Summe 100, wie in der Matrix; `charisma` und `intelligence` wiegen hier nichts.
 */
export const spielEignungOverrides: Partial<Record<OfficialDisciplineWeightId, Readonly<DisciplineWeightProfile>>> = {
  football: {
    power: 22,
    health: 18,
    speed: 14,
    torment: 12,
    determination: 10,
    awareness: 8,
    stamina: 6,
    dexterity: 4,
    spirit: 3,
    will: 3,
  },
};

/** Der Spiel-Eignungs-Override dieser Disziplin, oder null, wenn sie keinen hat. */
export function getSpielEignungOverride(disciplineId: string): Readonly<DisciplineWeightProfile> | null {
  return spielEignungOverrides[disciplineId as OfficialDisciplineWeightId] ?? null;
}

export function hasSpielEignungOverride(disciplineId: string): boolean {
  return getSpielEignungOverride(disciplineId) != null;
}

/**
 * DIE Gewichtsquelle einer Disziplin: der Spiel-Eignungs-Override, wenn es einen gibt,
 * sonst die unveraenderte offizielle Matrix. Jede Stelle, die Attribute zu einer Eignung
 * verrechnet, geht hier durch — damit es genau eine Antwort gibt und nicht zwei.
 *
 * Rueckgabe enthaelt nur Attribute mit Gewicht > 0 (eine Null ist eine Aussage, kein
 * Rauschen — dieselbe Konvention wie `officialDisciplineWeightMatrix`).
 */
export function resolveDisciplineWeightProfile(disciplineId: string): DisciplineWeightProfile {
  const override = getSpielEignungOverride(disciplineId);
  if (override) return { ...override };
  return { ...(officialDisciplineWeightMatrix[disciplineId as OfficialDisciplineWeightId] ?? {}) };
}

/** Herkunftsvermerk fuer die DB-Zeilen (`DisciplineWeight.source`). */
export const SPIEL_EIGNUNG_OVERRIDE_SOURCE = "spiel-eignung-override-2026-09";

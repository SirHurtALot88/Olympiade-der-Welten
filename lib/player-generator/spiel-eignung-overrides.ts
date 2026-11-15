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
// Bei Football lagen die beiden zwischen dem 10.09. und dem 14.11. bei rho 0,427 auseinander
// (110 Spieler der Kader-Familie, docs/design/football-erfolgskurve-plan-05-09.md 2.3): Ser
// Camelot fiel von Rang 1 auf 27, Johanna von 2 auf 25. Der Manager sah also eine Zahl und
// bekam ein Spiel, das andere Spieler belohnte — und die KI kaufte fuer das falsche Spiel ein.
//
// FOOTBALL-OVERRIDE AM 14.11. RUECKGAENGIG GEMACHT — Chris, woertlich (im Chat, nicht per PR-
// Review): „football muss zu unserem system mit der matrix zurückkehren, dann werden die
// spirit usw stats halt anders in die diszi stats verteilt die genutzt werden [...] so dass du
// nur diese anzahl an punkten zur verfügung hast und insgesamt 100 vergeben kannst mit der
// gewichtung". Das ist das 100-Punkte-Budget-System, das die anderen neunzehn Disziplinen
// laengst fahren (`PP_MATRIX_JE_DISC.football` summiert sich schon seit der Pp-Korrektur vom
// 25.10. auf genau 100). Football hat damit ab jetzt KEINEN Eintrag mehr in
// `spielEignungOverrides` — `resolveDisciplineWeightProfile("football")` faellt auf
// `officialDisciplineWeightMatrix.football` zurueck, exakt wie bei jeder anderen Disziplin ohne
// Override. Der damals gemessene Rueckweg-Befund (rho 0,053, docs/pm-briefings/opus-plan-
// football-gameplay-09-10.md 3) galt fuer eine DAMALIGE Mechanik-Fassung vor der Live-Motor-
// Migration/dem F1-EPA-Umbau/der Rezept-Feinkalibrierung — frisch nachgemessen (14.11.,
// `docs/design/football-matrix-rueckkehr-14-11.md`) auf dem HEUTIGEN Motor, Chris akzeptiert
// den resultierenden rho-Wert ausdruecklich, auch wenn er niedriger ausfaellt als mit dem
// Override: „die spirit usw stats werden halt anders verteilt" ist kein Kalibrierungsfehler,
// sondern die beabsichtigte Folge der Entscheidung.
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
 * Football stand hier vom 10.09. bis zum 14.11. (power 22/health 18/speed 14/torment 12/
 * determination 10/awareness 8/stamina 6/dexterity 4/spirit 3/will 3, 1:1 uebernommen aus
 * `FELDSPIEL_ART.football.spielEignung`, PR #803/#884) — RUECKGAENGIG GEMACHT, s. Kopfkommentar
 * "FOOTBALL-OVERRIDE AM 14.11. RUECKGAENGIG GEMACHT" oben. Football hat jetzt KEINEN Eintrag
 * mehr hier und faellt auf die Matrix zurueck wie die anderen achtzehn Disziplinen ohne
 * Override.
 *
 * Mini-DM (13.10.): die EINZIGE verbleibende Ausnahme, wieder mit Chris' ausdruecklicher
 * Vorgabe. Chris am 13.10., woertlich: „auch das FFA soll nach den gewichtungen geschehen die
 * vorgegeben sind!
 * weil du schreibst eigenes system, nirgendwo soll ein 'EIGENES' system genutzt werden sondern
 * die vorgegebene Verteilung! Intelligenz kann dabei ja auch für schwachstellen genutzt werden
 * oder positionierung, spirit für kurzfristiges zusammenarbeiten mit anderen kontrahenten um
 * ggf. zu gewinnen". Die Matrix fuehrt fuer Mini-DM nur sechs Attribute (torment 24, health 20,
 * power 16, stamina 16, will 14, dexterity 10); Intelligence und Spirit stehen dort auf 0.
 * Hier bekommen beide je 6 — kleiner als jedes der sechs Matrix-Attribute, weil Chris sie als
 * situative Wege beschreibt („kann dabei ja auch"), nicht als neue Hauptsache. Die 12 Punkte
 * kommen PROPORTIONAL aus den sechs Matrix-Attributen (je x0,88, gerundet auf Summe 100), damit
 * deren Rangfolge und Abstaende untereinander erhalten bleiben: torment 24→21, health 20→18,
 * power 16→14, stamina 16→14, will 14→12, dexterity 10→9. Die Matrix-Datei selbst bleibt
 * byte-identisch.
 *
 * WO DIE ACHT GEWICHTE MECHANISCH LANDEN: `ARENA_ART["mini-dm"].ffa` in
 * public/mockups/battle-mode.engine.js (der Schlagwechsel des 4-Team-FFA) — dort traegt jedes
 * der acht Attribute genau einen benannten Kanal, Intelligence die Schwachstelle/Positionierung,
 * Spirit das kurzfristige Zweckbuendnis gegen den Fuehrenden. Gemessen mit
 * `scripts/miss-mini-dm-ffa-abnahme.mjs` (Rangtreue und Pp, zwei Saatstroeme).
 */
export const spielEignungOverrides: Partial<Record<OfficialDisciplineWeightId, Readonly<DisciplineWeightProfile>>> = {
  "mini-dm": {
    torment: 21,
    health: 18,
    power: 14,
    stamina: 14,
    will: 12,
    dexterity: 9,
    intelligence: 6,
    spirit: 6,
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

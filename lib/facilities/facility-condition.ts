import { getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";

export const FACILITY_CONDITION_FULL = 100;
export const FACILITY_CONDITION_WARNING = 80;

/**
 * VERSCHLEISS JE SAISON — als Mittelwert, mit Streuung drumherum.
 *
 * Chris: „der verfall der gebäude ist mir auch zu schwach, da sollten über 3 seasons schon eher
 * 50% fallen mal mehr mal weniger."
 *
 * Vorher waren es feste 8 Punkte je Saison. Ein neues Gebäude stand nach drei Jahren bei 76 und
 * hatte nie an Wirkung verloren — die Warnschwelle von 70 wurde in der Praxis nie erreicht,
 * Reparatur war eine Vokabel ohne Anlass. Jetzt fallen im Mittel 17 Punkte je Saison, also rund
 * 51 ueber drei Saisons: ein Neubau rutscht in der zweiten Saison unter die Schwelle und will
 * gepflegt werden.
 *
 * DIE STREUUNG ist der zweite Teil der Vorgabe („mal mehr mal weniger"): jedes Gebäude wuerfelt
 * seinen eigenen Verschleiss zwischen 12 und 22. Das ist kein Zufall zur Laufzeit, sondern
 * deterministisch aus (Saison, Team, Gebäude) — derselbe Spielstand ergibt zweimal dasselbe,
 * und die Streuung macht aus zwei gleich alten Gebäuden trotzdem zwei verschiedene.
 *
 * UNBEZAHLTER UNTERHALT bleibt doppelt so teuer wie bezahlter (Mittel 34): wer die Pflege
 * ausfallen laesst, verliert das Gebäude in rund drei Saisons statt in sechs.
 */
export const FACILITY_SEASON_DECAY_PAID = 17;
export const FACILITY_SEASON_DECAY_UNPAID = 34;
/** Streuung um den Mittelwert: bezahlt 12..22, unbezahlt 24..44. */
export const FACILITY_SEASON_DECAY_SPREAD_PAID = 5;
export const FACILITY_SEASON_DECAY_SPREAD_UNPAID = 10;

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function clampFacilityCondition(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return FACILITY_CONDITION_FULL;
  }
  return Math.max(0, Math.min(FACILITY_CONDITION_FULL, roundValue(value)));
}

export function getFacilityEfficiencyPct(conditionPct: number | null | undefined) {
  const condition = clampFacilityCondition(conditionPct);
  if (condition >= FACILITY_CONDITION_WARNING) {
    return FACILITY_CONDITION_FULL;
  }
  return roundValue((condition / FACILITY_CONDITION_WARNING) * FACILITY_CONDITION_FULL);
}

export function getFacilityConditionStatus(conditionPct: number | null | undefined) {
  const condition = clampFacilityCondition(conditionPct);
  if (condition <= 0) return "broken" as const;
  if (condition < 40) return "critical" as const;
  if (condition < FACILITY_CONDITION_WARNING) return "worn" as const;
  if (condition < 90) return "aging" as const;
  return "good" as const;
}

export function calculateFacilityMaintenanceCost(input: {
  facilityId: FacilityId;
  level: number;
  conditionPct: number;
}) {
  if (input.level <= 0 || input.conditionPct >= FACILITY_CONDITION_FULL) {
    return 0;
  }
  const definition = getFacilityLevelDefinition(input.facilityId, input.level);
  const missingConditionShare = (FACILITY_CONDITION_FULL - clampFacilityCondition(input.conditionPct)) / 100;
  const costBase = Math.max(definition?.upgradeCost ?? 0, definition?.seasonUpkeep ?? 0);
  return roundValue(Math.max(1, costBase * missingConditionShare * 0.45));
}

/**
 * Lawinenschritt (murmur3 `fmix32`) — dieselbe Vorsichtsmassnahme wie bei den Formkarten: ein
 * FNV-Hash auf wenige Bits eingedampft kollidiert fuer aehnliche Saatworte, und aehnlich sind sie
 * hier zwangslaeufig (nur die Gebaeude-Id am Ende unterscheidet sich). Ohne diesen Schritt haetten
 * zwei Gebaeude desselben Teams denselben Verschleiss — also gerade keine Streuung.
 */
function avalanche(hash: number) {
  let mixed = hash >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/**
 * Der Verschleiss dieser einen Saison fuer dieses eine Gebaeude — Mittelwert plus deterministische
 * Streuung. Ohne `seed` faellt genau der Mittelwert an; das halten die Aufrufer offen, die keine
 * Saison-/Team-Kennung haben (Vorschau-Rechnungen, Erklaertexte).
 */
export function resolveFacilitySeasonDecay(paid: boolean, seed?: string | null) {
  const mittel = paid ? FACILITY_SEASON_DECAY_PAID : FACILITY_SEASON_DECAY_UNPAID;
  const streuung = paid ? FACILITY_SEASON_DECAY_SPREAD_PAID : FACILITY_SEASON_DECAY_SPREAD_UNPAID;
  if (!seed) {
    return mittel;
  }
  // Gleichverteilt ueber [mittel - streuung, mittel + streuung], ganzzahlig.
  const spanne = streuung * 2 + 1;
  return mittel - streuung + (avalanche(hashSeed(seed)) % spanne);
}

export function degradeFacilityCondition(
  conditionPct: number | null | undefined,
  paid: boolean,
  seed?: string | null,
) {
  const decay = resolveFacilitySeasonDecay(paid, seed);
  return clampFacilityCondition(clampFacilityCondition(conditionPct) - decay);
}

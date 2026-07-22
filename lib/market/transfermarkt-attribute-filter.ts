import {
  TRANSFERMARKT_SCOUT_TIER_ORDER,
} from "@/lib/market/transfermarkt-scouting";
import type { TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";

/**
 * Die 12 Feinattribute, nach Achse gruppiert in derselben Reihenfolge wie die
 * Achsen-Mindestwerte darüber: POW → SPE → MEN → SOC. `abbr` ist das kompakte
 * 3-Buchstaben-Kürzel für die Filterzeile, `label` der volle Name (Tooltip),
 * `axis` steuert die Chip-Farbe (wie die Achsen-Chips).
 */
export const TRANSFERMARKT_ATTRIBUTE_KEYS = [
  "power",
  "health",
  "stamina",
  "speed",
  "dexterity",
  "intelligence",
  "awareness",
  "determination",
  "charisma",
  "will",
  "spirit",
  "torment",
] as const;

export type TransfermarktAttributeKey = (typeof TRANSFERMARKT_ATTRIBUTE_KEYS)[number];

export const TRANSFERMARKT_ATTRIBUTE_META: Record<
  TransfermarktAttributeKey,
  { abbr: string; label: string; axis: "pow" | "spe" | "men" | "soc" }
> = {
  power: { abbr: "STR", label: "Power", axis: "pow" },
  health: { abbr: "VIT", label: "Health", axis: "pow" },
  stamina: { abbr: "STA", label: "Stamina", axis: "pow" },
  intelligence: { abbr: "INT", label: "Intelligence", axis: "men" },
  awareness: { abbr: "AWA", label: "Awareness", axis: "men" },
  determination: { abbr: "DET", label: "Determination", axis: "men" },
  speed: { abbr: "SPD", label: "Speed", axis: "spe" },
  dexterity: { abbr: "DEX", label: "Dexterity", axis: "spe" },
  charisma: { abbr: "CHA", label: "Charisma", axis: "soc" },
  will: { abbr: "WIL", label: "Will", axis: "soc" },
  spirit: { abbr: "SPI", label: "Spirit", axis: "soc" },
  torment: { abbr: "TOR", label: "Torment", axis: "soc" },
};

/** Auswahl-Optionen im Dropdown (bestes Tier zuerst). `null`/"" = egal. */
export const TRANSFERMARKT_TIER_FILTER_OPTIONS: readonly TransfermarktRatingTier[] = [
  "S+",
  "S",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
];

/** Nur gesetzte Attribute stehen drin; fehlt der Key → „egal". */
export type AttributeTierFilters = Partial<Record<TransfermarktAttributeKey, TransfermarktRatingTier>>;

function tierRank(tier: TransfermarktRatingTier | null | undefined): number {
  if (tier == null) {
    return -1;
  }
  // TRANSFERMARKT_SCOUT_TIER_ORDER ist schwächstes→stärkstes Tier (F … S+).
  return TRANSFERMARKT_SCOUT_TIER_ORDER.indexOf(tier);
}

/** True, wenn `tier` mindestens so gut wie `minimum` ist („A" ⇒ A und höher). */
export function tierMeetsMinimum(
  tier: TransfermarktRatingTier | null | undefined,
  minimum: TransfermarktRatingTier,
): boolean {
  const tierValue = tierRank(tier);
  if (tierValue < 0) {
    // Unbekanntes/fehlendes Rating erfüllt einen aktiven Mindest-Filter nicht.
    return false;
  }
  return tierValue >= tierRank(minimum);
}

/**
 * Prüft alle gesetzten Attribut-Mindest-Tiers gegen die (echten Sheet-)Ratings
 * eines Kandidaten. `ratings` ist der per-Attribut-Tier-Record des Spielers.
 */
export function passesAttributeTierFilters(
  ratings: Partial<Record<TransfermarktAttributeKey, TransfermarktRatingTier | null>>,
  filters: AttributeTierFilters,
): boolean {
  for (const key of TRANSFERMARKT_ATTRIBUTE_KEYS) {
    const minimum = filters[key];
    if (!minimum) {
      continue;
    }
    if (!tierMeetsMinimum(ratings[key] ?? null, minimum)) {
      return false;
    }
  }
  return true;
}

export function countActiveAttributeTierFilters(filters: AttributeTierFilters): number {
  return TRANSFERMARKT_ATTRIBUTE_KEYS.reduce((sum, key) => sum + (filters[key] ? 1 : 0), 0);
}

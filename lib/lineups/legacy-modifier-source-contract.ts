import {
  getLegacyFormCardSourceSummary,
  getLegacyMutatorSourceSummary,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyLineupLoadedContext, LegacyModifierSourceSummary } from "@/lib/lineups/legacy-lineup-types";

export type LegacyLineupContextLoadMode = "sqlite_local" | "prisma_reference";

const PRISMA_REFERENCE_LABEL =
  "Prisma/Referenzmodus: Modifier-Quellen sind read-only und nicht fuer Resolve-Apply verfuegbar.";

function buildMissingModifierSource(label: string): LegacyModifierSourceSummary {
  return {
    selectionStatus: "missing_source",
    effectStatus: "missing_source",
    sourceLabel: label,
    warnings: ["prisma_reference_mode"],
  };
}

export function getLocalModifierSourceBundle() {
  return {
    contextLoadMode: "sqlite_local" as const,
    formCardSource: getLegacyFormCardSourceSummary(),
    mutatorSource: getLegacyMutatorSourceSummary(),
    teamPowerSource: {
      selectionStatus: "ready" as const,
      effectStatus: "ready" as const,
      sourceLabel: "Team-Powers: drei Identity-Powers mit 4/3/2 Charges plus Facility-Boni auf Level 2/4.",
      warnings: [],
    },
  };
}

export function getPrismaReferenceModifierSourceBundle() {
  return {
    contextLoadMode: "prisma_reference" as const,
    formCardSource: buildMissingModifierSource(`${PRISMA_REFERENCE_LABEL} Formkarten fehlen.`),
    mutatorSource: buildMissingModifierSource(`${PRISMA_REFERENCE_LABEL} Mutatoren fehlen.`),
    teamPowerSource: buildMissingModifierSource(`${PRISMA_REFERENCE_LABEL} Team-Powers fehlen.`),
  };
}

export function getResolveMissingSourceReasons(context: Pick<
  LegacyLineupLoadedContext,
  "contextLoadMode" | "formCardSource" | "mutatorSource" | "teamPowerSource" | "fatigueSourceStatus"
>) {
  const reasons: string[] = [];

  if (context.contextLoadMode === "prisma_reference") {
    reasons.push("context_load_mode:prisma_reference");
  }
  if (context.formCardSource?.effectStatus !== "ready") {
    reasons.push("form_card_source_missing");
  }
  if (context.mutatorSource?.effectStatus !== "ready") {
    reasons.push("mutator_source_missing");
  }
  if (context.teamPowerSource?.effectStatus !== "ready") {
    reasons.push("team_power_source_missing");
  }
  if (context.fatigueSourceStatus !== "mapped") {
    reasons.push("fatigue_source_missing");
  }

  return reasons;
}

export function hasResolveReadyModifierSources(
  context: Pick<
    LegacyLineupLoadedContext,
    "contextLoadMode" | "formCardSource" | "mutatorSource" | "teamPowerSource" | "fatigueSourceStatus"
  >,
) {
  return getResolveMissingSourceReasons(context).length === 0;
}

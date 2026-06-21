export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type {
  AiLegacyLineupAuditSummary,
  AiLegacyLineupModifierSidePlan,
  AiLegacyLineupPreview,
  AiLegacyLineupSuggestionSide,
} from "@/lib/ai/ai-needs-types";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import type { DisciplineSide, LegacyLineupKeyParams, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LineupDraftModifierSide } from "@/lib/data/olyDataTypes";

function parseKeyParams(request: Request): LegacyLineupKeyParams | null {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";
  const teamId = searchParams.get("teamId")?.trim() ?? "";

  if (!saveId || !seasonId || !matchdayId || !teamId) {
    return null;
  }

  return { saveId, seasonId, matchdayId, teamId };
}

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

function formatCardLabel(context: LegacyLineupLoadedContext, cardId: string | null | undefined) {
  if (!cardId) return null;
  const card = context.formCards?.find((entry) => entry.id === cardId);
  if (!card) return cardId;
  const signedValue = card.value > 0 ? `+${card.value}` : String(card.value);
  return `${card.playerName ?? card.id} (${signedValue})`;
}

function buildIntensityReason(side: AiLegacyLineupSuggestionSide, modifier: LineupDraftModifierSide) {
  if (modifier.intensity === "push") {
    if (side.captainName) return `Push, weil ${side.captainName} als Captain ein klares Score-Fenster oeffnet.`;
    if ((side.teamDisciplineRank ?? 99) <= 8) return "Push, weil die AI einen Toprang verteidigt.";
    return "Push, weil der beste eingesetzte Score stark genug fuer einen Angriff ist.";
  }
  if (modifier.intensity === "conserve") {
    return "Schonen, weil die AI den Spieltag frueh in der Saison eher als Low-Value-Fenster bewertet.";
  }
  return "Normal, weil weder Captain-Fenster noch Schon-Fenster klar genug sind.";
}

function buildFormReason(context: LegacyLineupLoadedContext, modifier: LineupDraftModifierSide) {
  const primary = formatCardLabel(context, modifier.primaryFormCardId);
  const secondary = formatCardLabel(context, modifier.secondaryFormCardId);
  const labels = [primary, secondary].filter((entry): entry is string => Boolean(entry));
  if (labels.length === 0) return "Keine Formkarte geplant.";
  return `Formkarten: ${labels.join(" + ")}. Slot 2 nimmt nur positive Karten.`;
}

function buildMutatorReason(side: AiLegacyLineupSuggestionSide, modifier: LineupDraftModifierSide) {
  const traits = [modifier.mutatorTrait1, modifier.mutatorTrait2].filter((entry): entry is string => Boolean(entry));
  if (traits.length === 0) return "Keine Mutatoren gewaehlt.";
  return `${traits.join(" / ")} nach Trefferchance im eingesetzten Lineup. Jeder Treffer zaehlt +6.`;
}

function buildTeamPowerReason(context: LegacyLineupLoadedContext, modifier: LineupDraftModifierSide) {
  if (!modifier.teamPowerId) return "Keine Team-Power geplant.";
  const power = context.teamPowers?.find((entry) => entry.id === modifier.teamPowerId);
  if (!power) return `Team-Power ${modifier.teamPowerId} geplant.`;
  return `${power.label} geplant (${power.chargesRemaining} Ladung${power.chargesRemaining === 1 ? "" : "en"}).`;
}

function buildModifierSidePlan(
  context: LegacyLineupLoadedContext,
  previewSide: AiLegacyLineupSuggestionSide,
  side: DisciplineSide,
  modifier: LineupDraftModifierSide,
): AiLegacyLineupModifierSidePlan {
  return {
    disciplineSide: side,
    intensity: modifier.intensity ?? "normal",
    intensityReason: buildIntensityReason(previewSide, modifier),
    primaryFormCardId: modifier.primaryFormCardId ?? null,
    secondaryFormCardId: modifier.secondaryFormCardId ?? null,
    formReason: buildFormReason(context, modifier),
    mutatorTrait1: modifier.mutatorTrait1 ?? null,
    mutatorTrait2: modifier.mutatorTrait2 ?? null,
    mutatorReason: buildMutatorReason(previewSide, modifier),
    teamPowerId: modifier.teamPowerId ?? null,
    teamPowerReason: buildTeamPowerReason(context, modifier),
  };
}

function buildAiAuditSummary(preview: AiLegacyLineupPreview): AiLegacyLineupAuditSummary {
  const items: AiLegacyLineupAuditSummary["items"] = [];
  for (const side of [preview.d1, preview.d2]) {
    const label = `${side.disciplineSide.toUpperCase()} ${side.disciplineName ?? "Diszi"}`;
    const sideWarnings = side.warnings ?? [];
    items.push({
      label,
      status: side.missingSlots > 0 ? "blocked" : sideWarnings.length > 0 ? "warning" : "ok",
      detail:
        side.missingSlots > 0
          ? `${side.missingSlots} Slot${side.missingSlots === 1 ? "" : "s"} offen`
          : `${side.selectedPlayers}/${side.requiredPlayers} Spieler · Score ${Math.round(side.expectedScore)}`,
    });
    items.push({
      label: `${side.disciplineSide.toUpperCase()} Captain`,
      status: side.captainSelectionStatus === "blocked_policy" ? "blocked" : "ok",
      detail: side.captainName ? `${side.captainName} gewaehlt` : "kein Captain auf dieser Diszi",
    });
  }
  items.push({
    label: "Captain-Budget",
    status: preview.captainSlotsRemaining < 0 ? "blocked" : "ok",
    detail: `${preview.captainSlotsUsed}/${preview.captainSlotsUsed + preview.captainSlotsRemaining} genutzt`,
  });

  const status = items.some((item) => item.status === "blocked")
    ? "blocked"
    : items.some((item) => item.status === "warning") || preview.warnings.length > 0
      ? "warning"
      : "ready";
  return {
    status,
    ready: status !== "blocked",
    items,
  };
}

function enrichAiPreview(context: LegacyLineupLoadedContext, preview: AiLegacyLineupPreview): AiLegacyLineupPreview {
  const modifiers = buildAiLegacyLineupModifiers(context, preview.entries);
  return {
    ...preview,
    modifierPlan: {
      d1: buildModifierSidePlan(context, preview.d1, "d1", modifiers.d1),
      d2: buildModifierSidePlan(context, preview.d2, "d2", modifiers.d2),
    },
    auditSummary: buildAiAuditSummary(preview),
  };
}

export async function GET(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  const source = parseSource(request);
  const contextResult =
    source === "prisma"
      ? await new LegacyLineupContextLoader().loadLegacyLineupContext(params)
      : loadLocalLegacyLineupContext(params);

  if (!contextResult.ok) {
    return NextResponse.json({ errors: contextResult.errors, warnings: contextResult.warnings }, { status: 422 });
  }

  const preview = enrichAiPreview(contextResult.context, buildAiLegacyLineupPreview(contextResult.context, source));

  return NextResponse.json({
    preview,
    source,
    readOnly: true,
  });
}

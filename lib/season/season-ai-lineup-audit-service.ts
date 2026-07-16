import type { GameState, LineupDraft, LineupDraftModifiers, TeamControlMode } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { normalizeLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";

export type SeasonAiLineupAuditTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  drafts: number;
  captainUses: number;
  formCardUses: number;
  primaryFormCardUses: number;
  secondaryFormCardUses: number;
  teamPowerUses: number;
  mutatorTraits: number;
  pushSides: number;
  conserveSides: number;
  normalSides: number;
  warnings: string[];
};

export type SeasonAiLineupAudit = {
  seasonId: string;
  scope: "all_lineup_drafts";
  totals: {
    teams: number;
    aiTeams: number;
    drafts: number;
    aiDrafts: number;
    captainUses: number;
    formCardUses: number;
    secondaryFormCardUses: number;
    teamPowerUses: number;
    mutatorTraits: number;
    pushSides: number;
    conserveSides: number;
    normalSides: number;
  };
  rates: {
    aiDraftCoveragePct: number;
    aiCaptainPerDraftPct: number;
    aiFormCardPerDraftPct: number;
    aiPushSidePct: number;
    aiMutatorTraitPerSidePct: number;
  };
  teams: SeasonAiLineupAuditTeam[];
  warnings: string[];
};

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function countSideModifiers(modifiers: LineupDraftModifiers) {
  const sides = [modifiers.d1, modifiers.d2];
  return {
    primaryFormCardUses: sides.filter((side) => Boolean(side.primaryFormCardId)).length,
    secondaryFormCardUses: sides.filter((side) => Boolean(side.secondaryFormCardId)).length,
    teamPowerUses: sides.filter((side) => Boolean(side.teamPowerId)).length,
    mutatorTraits: sides.reduce(
      (sum, side) => sum + (side.mutatorTrait1 ? 1 : 0) + (side.mutatorTrait2 ? 1 : 0),
      0,
    ),
    pushSides: sides.filter((side) => side.intensity === "push").length,
    conserveSides: sides.filter((side) => side.intensity === "conserve").length,
    normalSides: sides.filter((side) => !side.intensity || side.intensity === "normal").length,
  };
}

function summarizeDrafts(drafts: LineupDraft[]) {
  return drafts.reduce(
    (summary, draft) => {
      const modifiers = normalizeLineupDraftModifiers(draft.modifiers);
      const sideCounts = countSideModifiers(modifiers);
      summary.captainUses += draft.entries.filter((entry) => entry.isCaptain).length;
      summary.primaryFormCardUses += sideCounts.primaryFormCardUses;
      summary.secondaryFormCardUses += sideCounts.secondaryFormCardUses;
      summary.teamPowerUses += sideCounts.teamPowerUses;
      summary.mutatorTraits += sideCounts.mutatorTraits;
      summary.pushSides += sideCounts.pushSides;
      summary.conserveSides += sideCounts.conserveSides;
      summary.normalSides += sideCounts.normalSides;
      return summary;
    },
    {
      captainUses: 0,
      primaryFormCardUses: 0,
      secondaryFormCardUses: 0,
      teamPowerUses: 0,
      mutatorTraits: 0,
      pushSides: 0,
      conserveSides: 0,
      normalSides: 0,
    },
  );
}

export function buildEmptySeasonAiLineupAudit(seasonId: string): SeasonAiLineupAudit {
  return {
    seasonId,
    scope: "all_lineup_drafts",
    totals: {
      teams: 0,
      aiTeams: 0,
      drafts: 0,
      aiDrafts: 0,
      captainUses: 0,
      formCardUses: 0,
      secondaryFormCardUses: 0,
      teamPowerUses: 0,
      mutatorTraits: 0,
      pushSides: 0,
      conserveSides: 0,
      normalSides: 0,
    },
    rates: {
      aiDraftCoveragePct: 0,
      aiCaptainPerDraftPct: 0,
      aiFormCardPerDraftPct: 0,
      aiPushSidePct: 0,
      aiMutatorTraitPerSidePct: 0,
    },
    teams: [],
    warnings: ["ai_lineup_audit_no_source"],
  };
}

export function buildSeasonAiLineupAudit(gameState: GameState, seasonId = gameState.season.id): SeasonAiLineupAudit {
  const controlSettingsMap = buildTeamControlSettingsMap(
    gameState.teams,
    gameState.seasonState.teamControlSettings,
  );
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter((draft) => draft.seasonId === seasonId);
  const draftsByTeamId = new Map<string, LineupDraft[]>();

  for (const draft of drafts) {
    const teamDrafts = draftsByTeamId.get(draft.teamId) ?? [];
    teamDrafts.push(draft);
    draftsByTeamId.set(draft.teamId, teamDrafts);
  }

  const teams = gameState.teams.map((team): SeasonAiLineupAuditTeam => {
    const controlMode = controlSettingsMap[team.teamId]?.controlMode ?? "manual";
    const teamDrafts = draftsByTeamId.get(team.teamId) ?? [];
    const summary = summarizeDrafts(teamDrafts);
    const warnings: string[] = [];
    if (controlMode === "ai" && teamDrafts.length === 0) warnings.push("ai_lineups_missing");
    if (controlMode === "ai" && teamDrafts.length > 0 && summary.captainUses === 0) warnings.push("ai_captain_unused");
    if (controlMode === "ai" && teamDrafts.length > 0 && summary.primaryFormCardUses + summary.secondaryFormCardUses === 0) {
      warnings.push("ai_form_cards_unused");
    }
    if (controlMode === "ai" && teamDrafts.length > 0 && summary.pushSides === 0) warnings.push("ai_push_unused");
    if (controlMode === "ai" && teamDrafts.length > 0 && summary.mutatorTraits === 0) warnings.push("ai_mutators_unused");

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      controlMode,
      drafts: teamDrafts.length,
      captainUses: summary.captainUses,
      formCardUses: summary.primaryFormCardUses + summary.secondaryFormCardUses,
      primaryFormCardUses: summary.primaryFormCardUses,
      secondaryFormCardUses: summary.secondaryFormCardUses,
      teamPowerUses: summary.teamPowerUses,
      mutatorTraits: summary.mutatorTraits,
      pushSides: summary.pushSides,
      conserveSides: summary.conserveSides,
      normalSides: summary.normalSides,
      warnings,
    };
  });

  const aiTeams = teams.filter((team) => team.controlMode === "ai");
  const aiDrafts = aiTeams.reduce((sum, team) => sum + team.drafts, 0);
  const aiSides = Math.max(1, aiDrafts * 2);
  const totals = {
    teams: teams.length,
    aiTeams: aiTeams.length,
    drafts: drafts.length,
    aiDrafts,
    captainUses: teams.reduce((sum, team) => sum + team.captainUses, 0),
    formCardUses: teams.reduce((sum, team) => sum + team.formCardUses, 0),
    secondaryFormCardUses: teams.reduce((sum, team) => sum + team.secondaryFormCardUses, 0),
    teamPowerUses: teams.reduce((sum, team) => sum + team.teamPowerUses, 0),
    mutatorTraits: teams.reduce((sum, team) => sum + team.mutatorTraits, 0),
    pushSides: teams.reduce((sum, team) => sum + team.pushSides, 0),
    conserveSides: teams.reduce((sum, team) => sum + team.conserveSides, 0),
    normalSides: teams.reduce((sum, team) => sum + team.normalSides, 0),
  };
  const warnings = Array.from(new Set(teams.flatMap((team) => team.warnings)));

  if (drafts.length === 0) warnings.push("ai_lineup_audit_no_lineup_drafts");
  if (aiTeams.length > 0 && aiDrafts === 0) warnings.push("ai_lineup_audit_no_ai_drafts");

  return {
    seasonId,
    scope: "all_lineup_drafts",
    totals,
    rates: {
      aiDraftCoveragePct: round((aiDrafts / Math.max(1, aiTeams.length * Math.max(1, gameState.season.matchdayIds.length))) * 100),
      aiCaptainPerDraftPct: round((aiTeams.reduce((sum, team) => sum + team.captainUses, 0) / Math.max(1, aiDrafts)) * 100),
      aiFormCardPerDraftPct: round((aiTeams.reduce((sum, team) => sum + team.formCardUses, 0) / Math.max(1, aiDrafts)) * 100),
      aiPushSidePct: round((aiTeams.reduce((sum, team) => sum + team.pushSides, 0) / aiSides) * 100),
      aiMutatorTraitPerSidePct: round((aiTeams.reduce((sum, team) => sum + team.mutatorTraits, 0) / aiSides) * 100),
    },
    teams,
    warnings,
  };
}

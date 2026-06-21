import fs from "node:fs";
import path from "node:path";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { LineupDraftModifiers, TeamPowerEffectType, TeamPowerTargetMode } from "@/lib/data/olyDataTypes";
import { createDefaultLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { DisciplineSide, LegacyLineupLoadedContext, LegacyTeamPowerOption } from "@/lib/lineups/legacy-lineup-types";
import { calculateTeamPowerModifierForSide, ensureLocalTeamPowersForSeason, getTeamPowerOptions } from "@/lib/lineups/team-powers";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { officialDisciplineWeightLabels, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";

type IssueSeverity = "error" | "warning";

type AuditIssue = {
  severity: IssueSeverity;
  code: string;
  message: string;
  teamId?: string;
  powerId?: string;
};

type TeamPowerTeamAudit = {
  teamId: string;
  teamCode: string;
  teamName: string;
  selectedPowers: number;
  identityPowers: number;
  facilityPowers: number;
  totalCharges: number;
  chargeSignature: string;
};

type AiPowerPickAudit = {
  teamId: string;
  teamCode: string;
  teamName: string;
  side: DisciplineSide;
  disciplineId: string;
  disciplineName: string;
  powerId: string;
  powerLabel: string;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  basePct: number;
  conditionalPct: number;
  attributeFitPct: number;
  impactPct: number;
  top8Rivals: number;
};

type BalanceRow = {
  teamId: string;
  teamCode: string;
  powerId: string;
  powerLabel: string;
  powerCategory: string;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  disciplineId: string;
  disciplineName: string;
  disciplineCategory: string;
  basePct: number;
  attributeFitPct: number;
  impactPct: number;
  offFit: boolean;
};

type UiMarkerAudit = {
  file: string;
  marker: string;
  found: boolean;
};

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback = "") => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };

  return {
    saveId: getValue("--saveId"),
    seasonId: getValue("--seasonId"),
    matchdayId: getValue("--matchdayId"),
    outDir: getValue("--outDir", "outputs/team-power-system-audit"),
  };
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function minMax(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  return {
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    avg: average(values),
  };
}

function pushIssue(issues: AuditIssue[], severity: IssueSeverity, code: string, message: string, extra?: Partial<AuditIssue>) {
  issues.push({ severity, code, message, ...extra });
}

function getSideDiscipline(context: LegacyLineupLoadedContext, side: DisciplineSide) {
  return side === "d1" ? context.matchdayContract?.discipline1 ?? null : context.matchdayContract?.discipline2 ?? null;
}

function getConditionalBonusPct(context: LegacyLineupLoadedContext, disciplineId: string, power: LegacyTeamPowerOption) {
  if (power.conditionalTrigger !== "rival_top8_discipline") {
    return 0;
  }
  return (context.teamPowerWindows?.[disciplineId]?.top8Rivals.length ?? 0) > 0 ? power.conditionalBonusPct : 0;
}

function buildSinglePowerModifiers(side: DisciplineSide, powerId: string): LineupDraftModifiers {
  const modifiers = createDefaultLineupDraftModifiers();
  modifiers[side].teamPowerId = powerId;
  return modifiers;
}

function auditTeamPowerAvailability(input: {
  gameState: ReturnType<typeof ensureLocalTeamPowersForSeason>;
  saveId: string;
  seasonId: string;
  issues: AuditIssue[];
}) {
  const rows: TeamPowerTeamAudit[] = [];
  let selectedPowerCount = 0;

  for (const team of input.gameState.teams) {
    const options = getTeamPowerOptions({
      gameState: input.gameState,
      seasonId: input.seasonId,
      teamId: team.teamId,
    });
    const selected = options.filter((power) => power.selectedForSeason);
    const identity = selected.filter((power) => power.source === "team_identity");
    const facility = selected.filter((power) => power.source === "facility");
    const chargeSignature = identity.map((power) => power.chargesTotal).sort((left, right) => left - right).join("/");

    selectedPowerCount += selected.length;
    rows.push({
      teamId: team.teamId,
      teamCode: team.shortCode ?? team.teamId,
      teamName: team.name,
      selectedPowers: selected.length,
      identityPowers: identity.length,
      facilityPowers: facility.length,
      totalCharges: selected.reduce((sum, power) => sum + power.chargesTotal, 0),
      chargeSignature,
    });

    if (identity.length < 3) {
      pushIssue(input.issues, "error", "team_identity_powers_missing", `${team.name} hat weniger als drei ausgewaehlte Identity-Powers.`, {
        teamId: team.teamId,
      });
    }
    if (identity.length >= 3 && chargeSignature !== "2/3/4") {
      pushIssue(input.issues, "error", "team_identity_charge_signature_invalid", `${team.name} hat nicht die Identity-Charges 4/3/2.`, {
        teamId: team.teamId,
      });
    }

    for (const power of selected) {
      if ((power.positiveAttributeTags ?? []).length !== 2 || !power.negativeAttributeTag) {
        pushIssue(
          input.issues,
          "error",
          "team_power_attribute_tags_missing",
          `${team.name}: ${power.label} hat nicht exakt zwei positive Tags und einen Reibungs-Tag.`,
          { teamId: team.teamId, powerId: power.id },
        );
      }
      if (power.source === "facility" && power.chargesTotal !== 2) {
        pushIssue(input.issues, "warning", "facility_charge_count_unexpected", `${team.name}: ${power.label} hat nicht zwei Facility-Einsaetze.`, {
          teamId: team.teamId,
          powerId: power.id,
        });
      }
    }
  }

  if (selectedPowerCount < input.gameState.teams.length * 3) {
    pushIssue(input.issues, "error", "selected_power_count_too_low", "Es wurden insgesamt zu wenige Season-Powers erzeugt.");
  }

  return rows;
}

function auditAiPowerUsage(input: {
  gameState: ReturnType<typeof ensureLocalTeamPowersForSeason>;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  issues: AuditIssue[];
}) {
  const picks: AiPowerPickAudit[] = [];
  let contextLoaded = 0;
  let contextFailed = 0;
  let teamsWithAvailablePowers = 0;
  let teamsWithoutAiSelection = 0;

  for (const team of input.gameState.teams) {
    const contextResult = loadLocalLegacyLineupContextFromGameState(input.gameState, {
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId: team.teamId,
    });

    if (!contextResult.ok) {
      contextFailed += 1;
      pushIssue(input.issues, "warning", "ai_context_load_failed", `${team.name}: AI-Lineup-Kontext konnte nicht geladen werden.`, {
        teamId: team.teamId,
      });
      continue;
    }

    contextLoaded += 1;
    const context = contextResult.context;
    const availablePowers = (context.teamPowers ?? []).filter((power) => !power.isUsedUp && power.chargesRemaining > 0);
    if (availablePowers.length > 0) {
      teamsWithAvailablePowers += 1;
    }

    const preview = buildAiLegacyLineupPreview(context, "sqlite");
    const modifiers = buildAiLegacyLineupModifiers(context, preview.entries);
    let selectedForTeam = 0;

    for (const side of ["d1", "d2"] as const) {
      const discipline = getSideDiscipline(context, side);
      const disciplineId = discipline?.disciplineId ?? null;
      const powerId = modifiers[side].teamPowerId ?? null;
      if (!disciplineId || !powerId) {
        continue;
      }

      const power = (context.teamPowers ?? []).find((entry) => entry.id === powerId) ?? null;
      if (!power) {
        pushIssue(input.issues, "error", "ai_selected_missing_power", `${team.name}: AI hat eine nicht ladbare Team-Power gewaehlt.`, {
          teamId: team.teamId,
          powerId,
        });
        continue;
      }

      selectedForTeam += 1;
      const result = calculateTeamPowerModifierForSide({
        modifiers,
        disciplineSide: side,
        disciplineId,
        disciplineCategory: discipline?.category ?? null,
        teamPowers: context.teamPowers ?? [],
        conditionalBonusPct: getConditionalBonusPct(context, disciplineId, power),
      });

      picks.push({
        teamId: team.teamId,
        teamCode: team.shortCode ?? team.teamId,
        teamName: team.name,
        side,
        disciplineId,
        disciplineName: discipline?.displayName ?? disciplineId,
        powerId,
        powerLabel: power.label,
        effectType: power.effectType,
        targetMode: power.targetMode,
        basePct: result.teamPowerBasePct,
        conditionalPct: result.teamPowerConditionalPct,
        attributeFitPct: result.teamPowerAttributeFitPct,
        impactPct: result.teamPowerImpact,
        top8Rivals: context.teamPowerWindows?.[disciplineId]?.top8Rivals.length ?? 0,
      });
    }

    if (availablePowers.length > 0 && selectedForTeam === 0) {
      teamsWithoutAiSelection += 1;
      pushIssue(input.issues, "warning", "ai_did_not_select_power_for_team", `${team.name}: Powers sind verfuegbar, aber die AI hat keine Power gewaehlt.`, {
        teamId: team.teamId,
      });
    }
  }

  if (contextLoaded === 0) {
    pushIssue(input.issues, "error", "ai_context_unavailable", "Fuer kein Team konnte ein AI-Lineup-Kontext geladen werden.");
  }
  if (teamsWithAvailablePowers > 0 && picks.length === 0) {
    pushIssue(input.issues, "error", "ai_never_selects_team_powers", "Die AI hat trotz verfuegbarer Powers keine Team-Power ausgewaehlt.");
  }

  return {
    picks,
    contextLoaded,
    contextFailed,
    teamsWithAvailablePowers,
    teamsWithoutAiSelection,
  };
}

function auditBalance(input: {
  gameState: ReturnType<typeof ensureLocalTeamPowersForSeason>;
  seasonId: string;
  issues: AuditIssue[];
}) {
  const rows: BalanceRow[] = [];
  const disciplineCategoryById = new Map(input.gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const));

  for (const team of input.gameState.teams) {
    const powers = getTeamPowerOptions({
      gameState: input.gameState,
      seasonId: input.seasonId,
      teamId: team.teamId,
    }).filter((power) => power.selectedForSeason);

    for (const power of powers) {
      for (const disciplineId of officialDisciplineWeightOrder) {
        const disciplineCategory = disciplineCategoryById.get(disciplineId) ?? null;
        const result = calculateTeamPowerModifierForSide({
          modifiers: buildSinglePowerModifiers("d1", power.id),
          disciplineSide: "d1",
          disciplineId,
          disciplineCategory,
          teamPowers: powers,
          conditionalBonusPct: 0,
        });
        rows.push({
          teamId: team.teamId,
          teamCode: team.shortCode ?? team.teamId,
          powerId: power.id,
          powerLabel: power.label,
          powerCategory: power.category,
          effectType: power.effectType,
          targetMode: power.targetMode,
          disciplineId,
          disciplineName: officialDisciplineWeightLabels[disciplineId],
          disciplineCategory: disciplineCategory ?? "unknown",
          basePct: result.teamPowerBasePct,
          attributeFitPct: result.teamPowerAttributeFitPct,
          impactPct: result.teamPowerImpact,
          offFit: power.category !== "flex" && power.category !== disciplineCategory,
        });
      }
    }
  }

  const impact = minMax(rows.map((row) => row.impactPct));
  const attributeFit = minMax(rows.map((row) => row.attributeFitPct));
  if (impact.max > 13) {
    pushIssue(input.issues, "error", "team_power_impact_too_high", `Eine Team-Power kommt auf ${impact.max}% Impact und liegt ueber dem Limit 13%.`);
  }
  if (attributeFit.max > 2 || attributeFit.min < -0.8) {
    pushIssue(input.issues, "error", "team_power_attribute_fit_out_of_range", `Attribut-Fit liegt ausserhalb der erwarteten Range: ${attributeFit.min}% bis ${attributeFit.max}%.`);
  }
  if (attributeFit.max <= 0 || attributeFit.min >= 0) {
    pushIssue(input.issues, "warning", "team_power_attribute_fit_not_varied", "Der Attribut-Fit erzeugt aktuell keine klare positive und negative Varianz.");
  }

  return {
    rows,
    impact,
    attributeFit,
  };
}

function auditUiMarkers(repoRoot: string, issues: AuditIssue[]) {
  const checks = [
    {
      file: "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
      markers: ["formatTeamPowerOptionLabel", "formatTeamPowerAttributeTags", "Attribut-Fit", "Rivalit", "teamPowerWindows"],
    },
    {
      file: "lib/lineups/legacy-lineup-types.ts",
      markers: ["positiveAttributeTags", "teamPowerAttributeFitPct", "teamPowerWindows"],
    },
    {
      file: "lib/resolve/legacy-matchday-resolve-types.ts",
      markers: ["teamPowerAttributeFitPct"],
    },
  ];

  const rows: UiMarkerAudit[] = [];
  for (const check of checks) {
    const absolutePath = path.join(repoRoot, check.file);
    const content = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
    for (const marker of check.markers) {
      const found = content.includes(marker);
      rows.push({ file: check.file, marker, found });
      if (!found) {
        pushIssue(issues, "error", "ui_marker_missing", `UI/Contract-Marker fehlt: ${marker} in ${check.file}.`);
      }
    }
  }
  return rows;
}

function toCsv(rows: BalanceRow[]) {
  const header = [
    "teamId",
    "teamCode",
    "powerLabel",
    "powerCategory",
    "effectType",
    "targetMode",
    "disciplineId",
    "disciplineName",
    "disciplineCategory",
    "basePct",
    "attributeFitPct",
    "impactPct",
    "offFit",
  ];
  const escape = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.teamId,
        row.teamCode,
        row.powerLabel,
        row.powerCategory,
        row.effectType,
        row.targetMode,
        row.disciplineId,
        row.disciplineName,
        row.disciplineCategory,
        row.basePct,
        row.attributeFitPct,
        row.impactPct,
        row.offFit,
      ].map(escape).join(","),
    ),
  ].join("\n");
}

function buildMarkdownReport(input: {
  status: "passed" | "failed";
  saveId: string;
  seasonId: string;
  matchdayId: string;
  generatedAt: string;
  teamRows: TeamPowerTeamAudit[];
  ai: ReturnType<typeof auditAiPowerUsage>;
  balance: ReturnType<typeof auditBalance>;
  uiRows: UiMarkerAudit[];
  issues: AuditIssue[];
}) {
  const errors = input.issues.filter((issue) => issue.severity === "error");
  const warnings = input.issues.filter((issue) => issue.severity === "warning");
  const topAiPicks = [...input.ai.picks].sort((left, right) => right.impactPct - left.impactPct).slice(0, 14);
  const topBalanceRows = [...input.balance.rows].sort((left, right) => right.impactPct - left.impactPct).slice(0, 14);

  const issueLines =
    input.issues.length === 0
      ? ["- Keine Fehler oder Warnungen."]
      : input.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);

  return [
    "# Team Power System Audit",
    "",
    `Status: ${input.status.toUpperCase()}`,
    `Erstellt: ${input.generatedAt}`,
    `Save: ${input.saveId}`,
    `Season: ${input.seasonId}`,
    `Matchday: ${input.matchdayId}`,
    "",
    "## Ergebnis",
    "",
    `- Teams geprueft: ${input.teamRows.length}`,
    `- Season-Powers aktiv: ${input.teamRows.reduce((sum, row) => sum + row.selectedPowers, 0)}`,
    `- AI-Kontexte geladen: ${input.ai.contextLoaded}`,
    `- AI-Power-Picks: ${input.ai.picks.length}`,
    `- Balance-Impact: ${input.balance.impact.min}% bis ${input.balance.impact.max}% (Schnitt ${input.balance.impact.avg}%)`,
    `- Attribut-Fit: ${input.balance.attributeFit.min}% bis ${input.balance.attributeFit.max}% (Schnitt ${input.balance.attributeFit.avg}%)`,
    `- UI-Marker gefunden: ${input.uiRows.filter((row) => row.found).length}/${input.uiRows.length}`,
    `- Fehler/Warnungen: ${errors.length}/${warnings.length}`,
    "",
    "## AI Picks",
    "",
    topAiPicks.length === 0
      ? "_Keine AI-Power-Picks gefunden._"
      : "| Team | Seite | Disziplin | Power | Impact | Basis | Extra | Fit | Rivalen |",
    ...(topAiPicks.length === 0
      ? []
      : [
          "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
          ...topAiPicks.map(
            (pick) =>
              `| ${pick.teamCode} | ${pick.side.toUpperCase()} | ${pick.disciplineName} | ${pick.powerLabel} | ${pick.impactPct}% | ${pick.basePct}% | ${pick.conditionalPct}% | ${pick.attributeFitPct}% | ${pick.top8Rivals} |`,
          ),
        ]),
    "",
    "## Balance Spitze",
    "",
    topBalanceRows.length === 0
      ? "_Keine Balance-Zeilen erzeugt._"
      : "| Team | Power | Disziplin | Impact | Basis | Fit | Off-Fit |",
    ...(topBalanceRows.length === 0
      ? []
      : [
          "| --- | --- | --- | ---: | ---: | ---: | --- |",
          ...topBalanceRows.map(
            (row) =>
              `| ${row.teamCode} | ${row.powerLabel} | ${row.disciplineName} | ${row.impactPct}% | ${row.basePct}% | ${row.attributeFitPct}% | ${row.offFit ? "ja" : "nein"} |`,
          ),
        ]),
    "",
    "## Issues",
    "",
    ...issueLines,
    "",
    "## Dateien",
    "",
    "- `team-power-system-audit.json`",
    "- `team-power-balance.csv`",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const outDir = path.resolve(repoRoot, args.outDir);
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = (args.saveId ? persistence.getSaveById(args.saveId) : null) ?? persistence.getActiveSave() ?? bootstrapped.save;
  const seasonId = args.seasonId || save.gameState.season.id;
  const matchdayId = args.matchdayId || save.gameState.matchdayState.matchdayId;
  const gameState = ensureLocalTeamPowersForSeason(save.gameState, save.saveId, seasonId);
  const issues: AuditIssue[] = [];

  const teamRows = auditTeamPowerAvailability({
    gameState,
    saveId: save.saveId,
    seasonId,
    issues,
  });
  const ai = auditAiPowerUsage({
    gameState,
    saveId: save.saveId,
    seasonId,
    matchdayId,
    issues,
  });
  const balance = auditBalance({
    gameState,
    seasonId,
    issues,
  });
  const uiRows = auditUiMarkers(repoRoot, issues);

  const status = issues.some((issue) => issue.severity === "error") ? "failed" : "passed";
  const generatedAt = new Date().toISOString();
  const payload = {
    status,
    generatedAt,
    scope: {
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teams: gameState.teams.length,
    },
    summary: {
      selectedPowers: teamRows.reduce((sum, row) => sum + row.selectedPowers, 0),
      aiContextLoaded: ai.contextLoaded,
      aiContextFailed: ai.contextFailed,
      aiPowerPicks: ai.picks.length,
      teamsWithAvailablePowers: ai.teamsWithAvailablePowers,
      teamsWithoutAiSelection: ai.teamsWithoutAiSelection,
      balanceImpact: balance.impact,
      balanceAttributeFit: balance.attributeFit,
      uiMarkersFound: uiRows.filter((row) => row.found).length,
      uiMarkersTotal: uiRows.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
    teams: teamRows,
    aiPicks: ai.picks,
    balanceRows: balance.rows,
    uiMarkers: uiRows,
    issues,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "team-power-system-audit.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, "team-power-balance.csv"), toCsv(balance.rows));
  fs.writeFileSync(
    path.join(outDir, "team-power-system-audit.md"),
    buildMarkdownReport({
      status,
      saveId: save.saveId,
      seasonId,
      matchdayId,
      generatedAt,
      teamRows,
      ai,
      balance,
      uiRows,
      issues,
    }),
  );

  console.log(`Team power system audit: ${status}`);
  console.log(`Report: ${path.join(outDir, "team-power-system-audit.md")}`);
  console.log(`AI picks: ${ai.picks.length}`);
  console.log(`Balance impact: ${balance.impact.min}%..${balance.impact.max}%`);
  console.log(`Issues: ${payload.summary.errors} errors, ${payload.summary.warnings} warnings`);

  if (status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

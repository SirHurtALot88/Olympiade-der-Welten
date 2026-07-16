/**
 * One-off strangler apply step: move the cockpit FoundationViewMount JSX body
 * out of FoundationPageClient.tsx into FoundationCockpitPanel.tsx (dumb),
 * create FoundationCockpitHost.tsx (dynamic seam), and rewrite the parent
 * call-site to `{activeView === "cockpit" ? <FoundationCockpitHost .../> : null}`.
 *
 * Line numbers (1-based) are pinned to the extractor's reported block.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const parentPath = path.resolve(root, "app/foundation/FoundationPageClient.tsx");
const genPath = path.resolve(root, "outputs/cockpit-panel-props.generated.ts");
const panelPath = path.resolve(root, "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");
const hostPath = path.resolve(root, "app/foundation/cockpit-v2/FoundationCockpitHost.tsx");

// Block boundaries (1-based, inclusive) from the extractor.
const MOUNT_START = 25012; // <FoundationViewMount ...>
const OPEN_TAG_END = 25019; // >
const CHILD_START = 25020; // first child
const CHILD_END = 27727; // last child (</div>)
const MOUNT_END = 27728; // </FoundationViewMount>

const parentLines = fs.readFileSync(parentPath, "utf8").split("\n");

// Sanity checks so we fail loudly if the file drifted.
function assertContains(lineIdx1: number, needle: string) {
  const line = parentLines[lineIdx1 - 1] ?? "";
  if (!line.includes(needle)) {
    throw new Error(`line ${lineIdx1} expected to contain ${JSON.stringify(needle)} but was ${JSON.stringify(line)}`);
  }
}
assertContains(MOUNT_START, "<FoundationViewMount");
assertContains(OPEN_TAG_END, ">");
assertContains(CHILD_START, '<div className="panel-header">');
assertContains(MOUNT_END, "</FoundationViewMount>");

const childrenJsx = parentLines.slice(CHILD_START - 1, CHILD_END).join("\n");

// ---- Parse generated interface + prop names -------------------------------
const genText = fs.readFileSync(genPath, "utf8");
const ifaceStart = genText.indexOf("export interface FoundationCockpitPanelProps {");
if (ifaceStart < 0) throw new Error("interface marker not found in generated file");
const interfaceBlock = genText.slice(ifaceStart).trimEnd();
const propNames: string[] = [];
for (const line of interfaceBlock.split("\n")) {
  const m = line.match(/^ {2}([A-Za-z_$][\w$]*)\s*[:?]/);
  if (m) propNames.push(m[1]);
}
if (propNames.length < 150) throw new Error(`expected >=150 props, parsed ${propNames.length}`);

// ---- Compose panel --------------------------------------------------------
const panelImports = `"use client";

import type * as React from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import type {
  CashPrizeApplyLogRecord,
  GamePhase,
  GameState,
  Player,
  SeasonDisciplineScheduleEntry,
  SeasonSnapshotRecord,
  Team,
} from "@/lib/data/olyDataTypes";
import { featureAuditFilters, getFeatureAuditFlags } from "@/lib/foundation/feature-audit-matrix";
import type {
  FeatureAuditEntry,
  FeatureAuditFilter,
  FeatureAuditMatrix,
  FeatureAuditStatus,
} from "@/lib/foundation/feature-audit-matrix";
import type { FoundationPanelId } from "@/lib/foundation/foundation-navigation-history";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import {
  formatAiLineupAuditWarning,
  formatCockpitReason,
  formatMatchdayMvpWarning,
  formatSeasonCompletionStepStatus,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getSeasonCompletionStepTone,
  mapAutoRunStatusToCockpitStatus,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type {
  FoundationAiLineupBatchApplyResponse,
  FoundationApplySummary,
  FoundationAutoRosterFillResponse,
  FoundationMatchdayAutoRunSummary,
  FoundationMatchdayMvpLineupTeam,
  FoundationMatchdayMvpScoreboardRow,
  FoundationMatchdayMvpScoringResponse,
  FoundationMatchdayMvpTopPlayerRow,
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
  FoundationReadMeta,
  FoundationResolvePreviewResponse,
  FoundationSeasonSnapshotSummary,
  FoundationStandingsPreviewResponse,
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  FoundationTransferHistoryResponse,
  FoundationTransfermarktResponse,
  FoundationView,
  FoundationWholeSeasonDryRunSummary,
  PreSeasonWorkflowApiResponse,
  PreSeasonWorkflowSummaryResponse,
  SaveActionRequest,
  SeasonCompletionApiResponse,
  SeasonCompletionSummaryResponse,
  SeasonTransitionApiResponse,
  SeasonTransitionStepResponse,
  SeasonTransitionSummaryResponse,
  SortState,
  TransfermarktBuySummary,
} from "@/lib/foundation/tabs/cockpit-types";
import type {
  MultiSeasonBalanceDashboard,
  MultiSeasonBalanceEconomyRow,
  MultiSeasonBalanceGameplayRow,
  MultiSeasonBalancePlayerRow,
  MultiSeasonBalanceTeamRow,
} from "@/lib/foundation/multiseason-balance-dashboard";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { SaveSummary } from "@/lib/persistence/types";
`;

const destructure = `  const {\n${propNames.map((n) => `    ${n},`).join("\n")}\n  } = props;`;

const panelFile = `${panelImports}
${interfaceBlock}

export default function FoundationCockpitPanel(props: FoundationCockpitPanelProps) {
${destructure}

  return (
    <section className="panel" id="foundation-cockpit" data-testid="foundation-cockpit">
${childrenJsx}
    </section>
  );
}
`;

fs.mkdirSync(path.dirname(panelPath), { recursive: true });
fs.writeFileSync(panelPath, panelFile, "utf8");

// ---- Compose host (dynamic seam) ------------------------------------------
const hostFile = `"use client";

import FoundationCockpitPanel, {
  type FoundationCockpitPanelProps,
} from "@/app/foundation/cockpit-v2/FoundationCockpitPanel";

/**
 * Cockpit host (Strangler Phase 1.4 seam). Currently a thin boundary that
 * forwards props to the dumb panel. Cockpit-only derivations/handlers can be
 * migrated here from FoundationPageClient without touching the parent
 * call-site or the panel body.
 */
export type FoundationCockpitHostProps = FoundationCockpitPanelProps;

export default function FoundationCockpitHost(props: FoundationCockpitHostProps) {
  return <FoundationCockpitPanel {...props} />;
}
`;
fs.writeFileSync(hostPath, hostFile, "utf8");

// ---- Rewrite parent call-site ---------------------------------------------
const callProps = propNames.map((n) => `            ${n}={${n}}`).join("\n");
const replacement = [
  "          {activeView === \"cockpit\" ? (",
  "          <FoundationCockpitHost",
  callProps,
  "          />",
  "          ) : null}",
].join("\n");

const before = parentLines.slice(0, MOUNT_START - 1);
const after = parentLines.slice(MOUNT_END); // lines after </FoundationViewMount>
const nextParent = [...before, replacement, ...after].join("\n");
fs.writeFileSync(parentPath, nextParent, "utf8");

console.log(`props: ${propNames.length}`);
console.log(`panel: ${panelPath}`);
console.log(`host: ${hostPath}`);
console.log(`parent block replaced: lines ${MOUNT_START}-${MOUNT_END} (${MOUNT_END - MOUNT_START + 1} lines) -> host call`);
console.log(`children moved: ${CHILD_END - CHILD_START + 1} lines`);

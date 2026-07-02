import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildTeamThemeCompositionRuntimeContext,
  calculateThemeCompositionScore,
  classifyIdentityQuotaRole,
  getTeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";

const saveId = process.argv[2] ?? "save-1782658020062-tvb2ly";
const teams = ["H-R", "D-P", "V-D"];

const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) throw new Error(`Save not found: ${saveId}`);
const gs = save.gameState;

const rosteredIds = new Set(gs.rosters.map((entry) => entry.playerId));
const freeAgents = gs.players.filter((player) => !rosteredIds.has(player.id));

for (const teamId of teams) {
  const team = gs.teams.find((entry) => entry.teamId === teamId);
  if (!team) continue;
  const target = getTeamThemeCompositionTarget(team);
  const ctx = buildTeamThemeCompositionRuntimeContext(gs, team);
  const share = ctx.rosterShare;
  console.log(`\n=== ${teamId} ${team.name} ===`);
  console.log(
    ` primaryShare=${share ? (share.primaryShare * 100).toFixed(0) : "?"}% min=${(target!.minimumShare * 100).toFixed(0)}% target=${(target!.targetShare * 100).toFixed(0)}% (below min: ${share ? share.primaryShare < target!.minimumShare : "?"})`,
  );

  const byRole: Record<string, { n: number; adj: number[]; examples: string[] }> = {};
  for (const player of freeAgents) {
    const role = classifyIdentityQuotaRole(player, target!);
    const score = calculateThemeCompositionScore({
      gameState: gs,
      team,
      player,
      candidateQuality: Math.max(
        ...Object.values(player.coreStats ?? {}).filter((v): v is number => typeof v === "number"),
        0,
      ),
      phase: "phase_b_core_optimum",
      runtimeContext: ctx,
    });
    const bucket = (byRole[role] ??= { n: 0, adj: [], examples: [] });
    bucket.n += 1;
    bucket.adj.push(score.identityFloorAdjustment);
    if (bucket.examples.length < 3) {
      bucket.examples.push(`${player.name}[${player.race}/${player.gender}] adj=${score.identityFloorAdjustment} tier=${score.themeTier}`);
    }
  }
  for (const [role, info] of Object.entries(byRole)) {
    const uniqueAdj = Array.from(new Set(info.adj));
    console.log(`  role=${role.padEnd(9)} count=${String(info.n).padStart(4)} floorAdj=${JSON.stringify(uniqueAdj)}`);
    for (const ex of info.examples) console.log(`     e.g. ${ex}`);
  }
}

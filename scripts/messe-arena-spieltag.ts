// Messung: Laufzeit + Chromium-RSS eines Arena-Spieltags (beide Ligen) je arena-gewerteter Disziplin.
// Entstanden fuer docs/design/battle-arena-auto-run-anbindung-plan-16-10.md Abschnitt 4 (E1-Schaetzung).
// Aufruf (cwd = Repo): OLY_APP_SQLITE_PATH=<scratch.sqlite> npx tsx scripts/messe-arena-spieltag.ts [disziplin ...]
//
// Bisherige Zahlen (ein lokaler Lauf, 4 Kerne) sind NICHT belastbar fuer den Server: der CX23-Wert
// im Plan ist eine Hochrechnung. Vor dem Live-Test auf dem Server (Plan Abschnitt 6.3) hier erneut
// laufen lassen, idealerweise direkt auf einer Kopie der Server-Umgebung.
import { execSync } from "node:child_process";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";

function chromeRssMb(): number {
  try {
    const out = execSync("ps -eo rss,comm", { encoding: "utf8" });
    let kb = 0;
    for (const zeile of out.split("\n")) {
      const [rss, ...rest] = zeile.trim().split(/\s+/);
      const comm = rest.join(" ");
      if (/chrome|headless_shell/i.test(comm)) kb += Number(rss) || 0;
    }
    return Math.round(kb / 1024);
  } catch {
    return -1;
  }
}

async function main() {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const t0 = Date.now();
  await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[mess]" });
  console.log("draft ms", Date.now() - t0);
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }));
  const save0 = persistence.getSaveById(saveId)!;
  const seasonId = save0.gameState.season.id;
  const matchdayId = save0.gameState.matchdayState.matchdayId;
  applyAiLegacyLineupBatchLocally({ saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true }, persistence);
  const save = persistence.getSaveById(saveId)!;
  const fixtures = (save.gameState.seasonState.schedule ?? []).filter((f) => f.matchdayId === matchdayId);
  console.log("matchday", matchdayId, "fixtures", fixtures.length, "tiers", [...new Set(fixtures.map((f) => f.leagueTier))].join(","));
  const disziplinen = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [...ARENA_RESOLVED_DISCIPLINE_IDS];
  console.log("disziplin\tms\tpeakChromeRssMb\toverrides\twarnings");
  for (const disciplineId of disziplinen) {
    let peak = 0;
    const timer = setInterval(() => {
      peak = Math.max(peak, chromeRssMb());
    }, 150);
    const start = Date.now();
    let overrides = -1;
    let warnings: string[] = [];
    try {
      const r = await runBattleModeArenaMatchday({ gameState: save.gameState, saveId, seasonId, matchdayId, disciplineId });
      overrides = r.overridesByTeamId.size;
      warnings = r.warnings;
    } catch (e) {
      warnings = [`THROW:${e instanceof Error ? e.message : String(e)}`];
    }
    const ms = Date.now() - start;
    clearInterval(timer);
    console.log(`${disciplineId}\t${ms}\t${peak}\t${overrides}\t${warnings.slice(0, 2).join(" | ").slice(0, 200)}`);
  }
  console.log("node rss MB", Math.round(process.memoryUsage().rss / 1024 / 1024));
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

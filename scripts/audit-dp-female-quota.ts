import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import type { Player } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { setGmAssignmentSeedSalt, getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { isFemaleGenderPlayer, isHumanoidForGenderQuota } from "@/lib/ai/team-theme-composition-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";

const RUNS = Number(process.argv[2] ?? "5");
const TEAM_ID = (process.argv[3] ?? "D-P").trim().toUpperCase();
// V-D = women only + Pets (nur Tiere, beliebig m/n). D-P = >=65% Frauen unter Humanoiden.
const WOMEN_ONLY = TEAM_ID === "V-D";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function isAnimalPet(p: Player) {
  return String(p.race ?? "").trim().toLowerCase() === "animal";
}

async function main() {
  const persistence = createPersistenceService();
  const previousActive = persistence.getActiveSave();

  const perRunPickSets: Array<Set<string>> = [];

  for (let run = 1; run <= RUNS; run += 1) {
    setGmAssignmentSeedSalt(`dp-quota-run-${run}`);
    const save = persistence.createFreshSeasonOneSave({
      saveId: `dp-quota-run-${run}-${Date.now()}`,
      name: `dp-quota-run-${run}`,
    });
    setGmAssignmentSeedSalt(null);

    const gm = getTeamGeneralManager(save.gameState, TEAM_ID)?.profile ?? null;
    const playersById = new Map(save.gameState.players.map((p) => [p.id, p]));

    const preview = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: true,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 12,
      runMode: "season1_optimum_execute",
      draftSeed: `dp-quota-run-${run}`,
    });

    const team = preview.teams.find((t) => t.teamId === TEAM_ID || t.teamCode === TEAM_ID);
    if (!team) {
      console.log(`Run ${run}: kein ${TEAM_ID} Team im Preview gefunden.`);
      continue;
    }
    const picks = team.plannedPicks.filter((p) => p.status !== "blocked");
    const players = picks
      .map((p) => playersById.get(p.playerId))
      .filter((p): p is Player => Boolean(p));

    perRunPickSets.push(new Set(players.map((p) => p.id)));

    if (WOMEN_ONLY) {
      // V-D: women only + Pets (nur Tiere, beliebig m/n). Verstoss = nicht-weiblich und kein Tier.
      let women = 0;
      let pets = 0;
      let illegal = 0;
      const lines: string[] = [];
      for (const p of players) {
        const female = isFemaleGenderPlayer(p);
        const pet = isAnimalPet(p);
        let tag: string;
        if (female) {
          women += 1;
          tag = "FRAU";
        } else if (pet) {
          pets += 1;
          tag = "PET(Tier)";
        } else {
          illegal += 1;
          tag = "!!! VERSTOSS (kein Frau/Tier)";
        }
        lines.push(`    - ${p.name} [${p.gender}/${p.race}] ${tag}`);
      }
      const flag = illegal === 0 ? "OK (women-only + Pets)" : `${illegal} VERSTOSS!`;
      console.log(
        `Run ${run} | GM ${gm?.archetype ?? "?"} | Picks ${players.length} | Frauen ${women} | Pets(Tier) ${pets} | Verstoesse ${illegal} | ${flag}`,
      );
      console.log(lines.join("\n"));
      const hardWarnings = (team.warnings ?? []).filter((w) => /female|pet|frau|tier|identit/i.test(w));
      if (hardWarnings.length) {
        console.log(`    [Hinweise: ${hardWarnings.length}]`);
        hardWarnings.forEach((w) => console.log(`      · ${w}`));
      }
      continue;
    }

    let humanoid = 0;
    let femaleHumanoid = 0;
    let maleHumanoid = 0;
    let nonHumanoid = 0;
    const lines: string[] = [];
    for (const p of players) {
      const female = isFemaleGenderPlayer(p);
      const humanoidPlayer = isHumanoidForGenderQuota(p);
      if (humanoidPlayer) {
        humanoid += 1;
        if (female) femaleHumanoid += 1;
        else maleHumanoid += 1;
      } else {
        nonHumanoid += 1;
      }
      const tag = !humanoidPlayer ? "KREATUR(exempt)" : female ? "FRAU" : "MANN";
      lines.push(`    - ${p.name} [${p.gender}/${p.race}] ${tag}`);
    }
    const femaleShare = humanoid > 0 ? femaleHumanoid / humanoid : 1;

    const flag = femaleShare >= 0.65 ? "OK" : "UNTER 65%!";
    console.log(
      `Run ${run} | GM ${gm?.archetype ?? "?"} | Picks ${players.length} | Humanoide ${humanoid} (Frauen ${femaleHumanoid}, Maenner ${maleHumanoid}) | Kreaturen ${nonHumanoid} | Frauenanteil(Humanoid) ${pct(femaleShare)} ${flag}`,
    );
    console.log(lines.join("\n"));
    const quotaWarnings = (team.warnings ?? []).filter((w) => w.includes("Frauen-Quote"));
    if (quotaWarnings.length) {
      console.log(`    [Quote-Gate Treffer: ${quotaWarnings.length}]`);
      quotaWarnings.forEach((w) => console.log(`      · ${w}`));
    } else {
      console.log("    [Quote-Gate: keine Treffer]");
    }
  }

  // Diversitaet ueber Laeufe (Jaccard / Core / Union)
  const union = new Set<string>();
  perRunPickSets.forEach((s) => s.forEach((id) => union.add(id)));
  let core = perRunPickSets.length ? new Set(perRunPickSets[0]) : new Set<string>();
  for (const s of perRunPickSets.slice(1)) core = new Set([...core].filter((id) => s.has(id)));
  const jaccards: number[] = [];
  for (let i = 0; i < perRunPickSets.length; i += 1) {
    for (let j = i + 1; j < perRunPickSets.length; j += 1) {
      const a = perRunPickSets[i];
      const b = perRunPickSets[j];
      const inter = [...a].filter((id) => b.has(id)).length;
      const uni = new Set([...a, ...b]).size;
      jaccards.push(uni > 0 ? inter / uni : 0);
    }
  }
  const avgJaccard = jaccards.length ? jaccards.reduce((x, y) => x + y, 0) / jaccards.length : 0;

  console.log(`\n=== ${TEAM_ID} Diversitaet ueber Laeufe ===`);
  console.log(`Runs: ${perRunPickSets.length}`);
  console.log(`Distinct Spieler (Union): ${union.size}`);
  console.log(`Core (in ALLEN Laeufen): ${core.size}`);
  console.log(`Avg pairwise Jaccard (0=divers, 1=identisch): ${avgJaccard.toFixed(2)}`);

  if (previousActive) {
    persistence.activateSave(previousActive.saveId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

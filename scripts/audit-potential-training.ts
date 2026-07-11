import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPlayerPotentialRecordsForSave } from "@/lib/progression/player-potential-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { reconcilePlayerPotentialRecordToCurrentAbility } from "@/lib/scouting/player-potential-ceiling-service";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import type { Player } from "@/lib/data/olyDataTypes";

const SAMPLE = Number(process.argv[2] ?? "500");

function attrValue(player: Player, attr: string): number | null {
  const v = (player.attributeSheetStats as Record<string, number> | undefined)?.[attr];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function main() {
  const persistence = createPersistenceService();
  const prev = persistence.getActiveSave();
  const save = persistence.createFreshSeasonOneSave({
    saveId: `pot-train-audit-${Date.now()}`,
    name: "pot-train-audit",
  });
  const gs = save.gameState;
  if (!gs.playerPotential || gs.playerPotential.length === 0) {
    gs.playerPotential = buildPlayerPotentialRecordsForSave({ saveId: save.saveId, players: gs.players, gameState: gs });
  }
  const recordById = new Map(gs.playerPotential.map((r) => [r.playerId, r] as const));

  // === 1) PA >= CA ===
  let reconciledStarViol = 0;
  let rawStarBelow = 0;
  let rawAttrBelow = 0;
  let rawAttrTotal = 0;
  let scalarViol = 0;
  let scalarChecked = 0;
  let players = 0;

  for (const p of gs.players) {
    players += 1;
    const cur = buildPlayerAxisStarProfile({ gameState: gs, player: p, disciplines: gs.disciplines });
    const rec = recordById.get(p.id);
    if (rec) {
      // raw stored overall stars vs current
      if (typeof rec.hiddenPotentialOverallStars === "number" && rec.hiddenPotentialOverallStars < cur.overall - 1e-9) {
        rawStarBelow += 1;
      }
      const rawCeil = rec.hiddenAttributeCeiling ?? {};
      for (const a of playerGeneratorAttributeKeys) {
        const c = (rawCeil as Record<string, number>)[a];
        const v = attrValue(p, a);
        if (typeof c === "number" && v != null) {
          rawAttrTotal += 1;
          if (c < v) rawAttrBelow += 1;
        }
      }
      const reconciled = reconcilePlayerPotentialRecordToCurrentAbility({
        player: p,
        record: rec,
        currentStars: cur,
        saveId: gs.season.id,
      });
      if ((reconciled.hiddenPotentialOverallStars ?? 0) < cur.overall - 1e-9) reconciledStarViol += 1;
    }
    if (typeof p.potential === "number" && p.potential > 0 && typeof p.rating === "number") {
      scalarChecked += 1;
      if (p.potential < p.rating) scalarViol += 1;
    }
  }

  // === 2) Training throttle behavior (sample) ===
  let progPlayers = 0;
  let attrCount = 0;
  let throttled = 0;
  let mid = 0;
  let full = 0;
  let sumMult = 0;
  let overCeilAfter = 0;
  const sample = gs.players.slice(0, SAMPLE);
  for (const p of sample) {
    const res = buildOrganicSeasonProgression({ gameState: gs, player: p });
    if (!res.attributeBreakdown.length) continue;
    progPlayers += 1;
    const rec = recordById.get(p.id);
    const cur = buildPlayerAxisStarProfile({ gameState: gs, player: p, disciplines: gs.disciplines });
    const reconciled = rec
      ? reconcilePlayerPotentialRecordToCurrentAbility({ player: p, record: rec, currentStars: cur, saveId: gs.season.id })
      : null;
    const ceil = (reconciled?.hiddenAttributeCeiling ?? {}) as Record<string, number>;
    for (const e of res.attributeBreakdown) {
      attrCount += 1;
      sumMult += e.trainingGrowthMultiplier;
      if (e.trainingGrowthMultiplier < 0.5) throttled += 1;
      else if (e.trainingGrowthMultiplier < 0.9) mid += 1;
      else full += 1;
      const c = ceil[e.attribute];
      if (typeof c === "number" && e.after > c + 0.5) overCeilAfter += 1;
    }
  }

  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");

  console.log("=== Potenzial >= CA (Current Ability) ===");
  console.log(`Spieler gesamt: ${players}`);
  console.log(`Reconciled Overall-Stars < CA (PA<CA nach reconcile): ${reconciledStarViol} (${pct(reconciledStarViol, players)})`);
  console.log(`Raw Overall-Stars < CA (vor reconcile): ${rawStarBelow} (${pct(rawStarBelow, players)})`);
  console.log(`Raw Attribut-Ceilings < aktueller Wert: ${rawAttrBelow}/${rawAttrTotal} (${pct(rawAttrBelow, rawAttrTotal)})`);
  console.log(`Scalar player.potential < player.rating: ${scalarViol}/${scalarChecked} (${pct(scalarViol, scalarChecked)})`);

  console.log("\n=== Training-Throttle (Sample) ===");
  console.log(`Progression berechnet fuer: ${progPlayers} Spieler, ${attrCount} Attribut-Slots`);
  console.log(`trainingGrowthMultiplier  <0.5 (stark gedrosselt): ${throttled} (${pct(throttled, attrCount)})`);
  console.log(`                          0.5-0.9 (teilgedrosselt): ${mid} (${pct(mid, attrCount)})`);
  console.log(`                          >=0.9 (volle Rate):       ${full} (${pct(full, attrCount)})`);
  console.log(`Durchschnitt Multiplier: ${(sumMult / Math.max(1, attrCount)).toFixed(3)}`);
  console.log(`Attribute die nach Training ueber ihr Ceiling steigen: ${overCeilAfter} (${pct(overCeilAfter, attrCount)})`);

  if (prev) persistence.activateSave(prev.saveId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

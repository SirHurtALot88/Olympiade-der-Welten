/**
 * Prototyp Sell-Score — Profit-first, Bracket = getTransfermarktBracket (1–9 MW-Stufen).
 * Run: OLY_APP_SQLITE_PATH=outputs/s1-s10-validated-run-1/balancing-run.sqlite npx tsx scripts/tmp-sell-score-example.ts [T-T W-W A-A]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";
import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";

const saveId = "fresh-season-1-1783169019878";
process.env.OLY_APP_SQLITE_PATH =
  process.env.OLY_APP_SQLITE_PATH ?? "outputs/s1-s10-validated-run-1/balancing-run.sqlite";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function bracketMvsRankLigaweit(
  ratings: Map<string, { playerId: string; marketValue: number | null; mvs: number | null; mvsRank: number | null }>,
  playerId: string,
  marketValue: number | null,
) {
  const bracket = getTransfermarktBracket(marketValue);
  const peer = [...ratings.values()].filter(
    (r) => getTransfermarktBracket(r.marketValue) === bracket && r.mvs != null && r.mvs > 0,
  );
  peer.sort((a, b) => (b.mvs ?? 0) - (a.mvs ?? 0));
  const idx = peer.findIndex((r) => r.playerId === playerId);
  const row = ratings.get(playerId);
  const pool = peer.length;
  const rank = idx >= 0 ? idx + 1 : null;
  const lag = rank != null && pool > 1 ? (rank - 1) / (pool - 1) : null;
  return { bracket, pool, rank, lag, leagueMvsRank: row?.mvsRank ?? null, mvs: row?.mvs ?? null };
}

/** Profit-first composite (Prototyp v2) */
function proposedSellScore(input: {
  teamCash: number;
  teamSalaryTotal: number;
  profitRatio: number | null;
  profitAbsolute: number | null;
  sellBelowPurchase: boolean;
  bracketLag: number | null;
  contractYears: number;
  wageShare: number;
}) {
  const cashPressure = clamp01(
    input.teamCash < 0 ? 1 : input.teamSalaryTotal > 0 ? input.teamSalaryTotal / Math.max(input.teamCash, 1) / 3 : 0,
  );

  const ratioPart =
    input.profitRatio != null && input.profitRatio > 0 ? clamp01(input.profitRatio / 0.2) : 0;
  const absPart =
    input.profitAbsolute != null && input.profitAbsolute > 0
      ? clamp01(input.profitAbsolute / Math.max(3, input.teamCash * 0.55))
      : 0;
  const profitComponent = clamp01(ratioPart * 0.55 + absPart * 0.45) * (1 + cashPressure * 0.35);

  const financial = clamp01(cashPressure * 0.7 + input.wageShare * 0.3);
  const performance = input.bracketLag != null ? clamp01(input.bracketLag) : 0;
  const contract =
    input.contractYears <= 1 ? 0.8 : input.contractYears === 2 ? 0.45 : 0.12;
  const lossPenalty =
    input.sellBelowPurchase && (input.profitRatio ?? 0) <= 0
      ? clamp01(Math.abs(input.profitRatio ?? 0.15) * 0.5) * (1 - performance * 0.5)
      : 0;

  const raw =
    profitComponent * 48 +
    financial * 18 +
    performance * 22 +
    contract * 8 -
    lossPenalty * 18;

  return {
    total: Math.round(clamp(raw, 0, 100)),
    cashPressure: round(cashPressure),
    profitComponent: round(profitComponent),
    financial: round(financial),
    performance: round(performance),
    contract: round(contract),
    lossPenalty: round(lossPenalty),
  };
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

async function analyzeTeam(teamId: string) {
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error("save missing");
  const gs = save.gameState;
  const ratings = buildPlayerRatingContractMap(gs);
  const sell = await buildAiTransfermarktSellPreview({ source: "sqlite", saveId, teamId, limit: 15 });
  const team = sell.teams.find((t) => t.teamId === teamId);
  if (!team) throw new Error(`team ${teamId} missing`);

  console.log(`\n${"=".repeat(72)}`);
  console.log(`${teamId} ${team.teamName} — Cash ${team.cash?.toFixed(2)} | Gehalt ${team.salaryTotal?.toFixed(2)} | Kader ${team.rosterSize}`);
  console.log(`${"=".repeat(72)}\n`);
  console.log(
    "Spieler".padEnd(18) +
      "Br".padStart(3) +
      "MVS B-Rg".padStart(10) +
      "Profit%".padStart(9) +
      "Profit€".padStart(9) +
      "Vertr".padStart(6) +
      "AltPrio".padStart(8) +
      "NeuScore".padStart(9) +
      "  Treiber",
  );
  console.log("-".repeat(72));

  const rows = team.sellCandidates.map((c) => {
    const roster = gs.rosters.find((r) => r.playerId === c.playerId && r.teamId === teamId);
    const purchase = roster?.purchasePrice ?? null;
    const profitAbsolute =
      c.expectedSellValue != null && purchase != null ? c.expectedSellValue - purchase : null;
    const profitRatio =
      profitAbsolute != null && purchase != null && purchase > 0
        ? profitAbsolute / purchase
        : c.expectedSellValue != null && c.marketValue != null && c.marketValue > 0
          ? (c.expectedSellValue - c.marketValue) / c.marketValue
          : null;
    const bracketInfo = bracketMvsRankLigaweit(ratings, c.playerId, c.marketValue);
    const wageShare = c.salary != null && (team.salaryTotal ?? 0) > 0 ? c.salary / (team.salaryTotal ?? 1) : 0;
    const score = proposedSellScore({
      teamCash: team.cash ?? 0,
      teamSalaryTotal: team.salaryTotal ?? 0,
      profitRatio,
      profitAbsolute,
      sellBelowPurchase: purchase != null && c.expectedSellValue != null && c.expectedSellValue < purchase,
      bracketLag: bracketInfo.lag,
      contractYears: c.contractLength ?? 2,
      wageShare,
    });
    return { c, purchase, profitAbsolute, profitRatio, bracketInfo, score };
  });

  rows.sort((a, b) => b.score.total - a.score.total);

  for (const { c, profitAbsolute, profitRatio, bracketInfo, score } of rows.slice(0, 10)) {
    const brRank =
      bracketInfo.rank != null ? `${bracketInfo.rank}/${bracketInfo.pool}` : "—";
    const pct = profitRatio != null ? `${(profitRatio * 100).toFixed(0)}%` : "—";
    const abs = profitAbsolute != null ? profitAbsolute.toFixed(1) : "—";
    const driver =
      score.profitComponent >= 0.5
        ? "PROFIT+Cash"
        : score.performance >= 0.5
          ? "Bracket-Lag"
          : score.financial >= 0.5
            ? "Finanzdruck"
            : "mixed";
    console.log(
      c.playerName.slice(0, 17).padEnd(18) +
        String(bracketInfo.bracket).padStart(3) +
        brRank.padStart(10) +
        pct.padStart(9) +
        abs.padStart(9) +
        `${c.contractLength}J`.padStart(6) +
        String(c.sellPriority).padStart(8) +
        String(score.total).padStart(9) +
        `  ${driver} (prof${score.profitComponent})`,
    );
  }
}

async function main() {
  const teams = process.argv.slice(2);
  const list = teams.length > 0 ? teams : ["T-T", "W-W", "A-A"];
  for (const teamId of list) {
    await analyzeTeam(teamId);
  }
  console.log("\nLegende: Br = Transfermarkt-MW-Bracket (1–9, nicht Buy-Lane). MVS B-Rg = MVS-Rang ligaweit innerhalb gleichen Brackets.");
  console.log("NeuScore: Profit-first — hohe Gewinn% + Cash-Boost dominieren; Bracket-Lag nur bei Underperformance im Segment.");
}

main().catch(console.error);

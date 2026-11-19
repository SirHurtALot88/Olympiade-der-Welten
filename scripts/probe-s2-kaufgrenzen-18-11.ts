/* eslint-disable no-console */
/**
 * SONDE "WAS BREMST DEN S2-KAUF?" (18.11.): auf dem Stand NACH der S2-Kaufphase (Wegwerf-SQLite einer Messung mit
 * `--stop-after kaufphase --keep`) wird der Marktplan der Preseason (derselbe Dienst wie der KI-Kauflauf,
 * `applyAiMarketPlanLocally`) NOCH EINMAL im TROCKENLAUF gefragt (dryRun, es wird nichts geschrieben). Je Team:
 * Ergebnisart, Sperrgruende, geplante Kaeufe, Kasse/Gehalt und die Vorstandsfreigabe. Gezaehlt wird, wie oft welcher
 * Sperrgrund auftritt und wie viele Teams noch kaufen wuerden.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/nach.sqlite npx tsx scripts/probe-s2-kaufgrenzen-18-11.ts <saveId> <out.json>
 *
 * Reine Messung, keine Spiellogik geaendert.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const [saveId, outPfad] = process.argv.slice(2);
if (!saveId || !outPfad || !process.env.OLY_APP_SQLITE_PATH) throw new Error("Aufruf: OLY_APP_SQLITE_PATH=... tsx probe-... <saveId> <out.json>");

async function main() {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} fehlt`);
  const gs = save.gameState;
  const erg = await applyAiMarketPlanLocally({
    source: "sqlite", saveId, seasonId: gs.season.id, teamScope: "ai", dryRun: true, includeWarningTeams: true,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN, transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
    options: { includeWarningTeams: true, stopOnTeamFailure: false, applySellSteps: false },
  });
  const jeTeam = (erg.results as Array<Record<string, unknown>>).map((r) => {
    const teamId = String(r.teamId);
    const v = berechneVorstandBudgetStand(gs, teamId);
    const t = gs.teams.find((x) => x.teamId === teamId);
    return {
      teamId, result: r.result, blockingReasons: r.blockingReasons, rosterBefore: r.rosterBefore, rosterAfter: r.rosterAfter,
      cash: t?.cash ?? null, geplanteKaeufe: typeof r.plannedBuys === "number" ? r.plannedBuys : null,
      geplanteAusgabe: typeof r.cashBefore === "number" && typeof r.cashAfter === "number" ? Math.round((r.cashBefore - r.cashAfter) * 100) / 100 : null,
      kaderLimit: gs.teams.find((x) => x.teamId === teamId)?.rosterLimit ?? null,
      vorstandAnteil: v.anteil, feeFrei: v.investition?.frei ?? null, gehaltFrei: v.gehalt?.frei ?? null,
      keys: Object.keys(r),
    };
  });
  const gruende: Record<string, number> = {};
  const art: Record<string, number> = {};
  for (const t of jeTeam) {
    art[String(t.result)] = (art[String(t.result)] ?? 0) + 1;
    for (const b of new Set((t.blockingReasons as string[] | undefined) ?? [])) gruende[b] = (gruende[b] ?? 0) + 1;
  }
  fs.writeFileSync(outPfad, JSON.stringify({ saveId, seasonId: gs.season.id, art, gruende, warnings: erg.warnings.slice(0, 30), blockingReasons: erg.blockingReasons, jeTeam }));
  console.log("Ergebnisarten:", art);
  console.log("Sperrgruende (Teams):", gruende);
  console.log("Teams mit geplantem Kauf:", jeTeam.filter((t) => (t.geplanteKaeufe ?? 0) > 0).length, "Kaeufe gesamt:", jeTeam.reduce((x, t) => x + (t.geplanteKaeufe ?? 0), 0), "geplante Ausgabe gesamt:", jeTeam.reduce((x, t) => x + (t.geplanteAusgabe ?? 0), 0).toFixed(1));
}

main().catch((e) => { console.error(e); process.exit(1); });

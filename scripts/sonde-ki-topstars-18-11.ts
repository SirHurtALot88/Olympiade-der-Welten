/**
 * SONDE (KI-Pick-Analyse 18.11.): warum kauft im Saison-1-Draft niemand einen der 20 teuersten Spieler (Marktwert 81–113),
 * obwohl alle im Pool und fuer jedes Team bezahlbar sind?
 *
 *   cp basis.sqlite sonde.sqlite; OLY_APP_SQLITE_PATH=sonde.sqlite npx tsx scripts/sonde-ki-topstars-18-11.ts --save <saveId> [--teams M-M,Z-H,R-L]
 *
 * Rein lesend. Fuer jedes Team: erster Kaufschritt aus dem vollen Pool, alle Kandidaten bewertet. Ausgabe je Team: Platz 1,
 * und fuer die 5 teuersten Spieler: Rang in der Bewertung, Nutzen, und die Zerlegung des Nutzens (Staerke, Preis-Strafe,
 * Gehalts-Strafe, Komposition) sowie ob der Spieler die Kassen-Schranke (Ruecklage + Reserve fuers Minimum) passiert.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildOrganicDraftFrame } from "@/lib/ai/organic-squad/draft-adapter";
import { createOrganicPlanStepState, organicBuyStep } from "@/lib/ai/organic-squad/draft-builder";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const r1 = (v: number) => Math.round(v * 10) / 10;

const persistence = createPersistenceService();
const gs = persistence.getSaveById(arg("save", ""))?.gameState as GameState | undefined;
if (!gs) throw new Error("--save <saveId> (Wegwerf-SQLite)");
const teamIds = arg("teams", gs.teams.map((t) => t.teamId).join(",")).split(",");
const frei: Player[] = gs.players.filter((p) => !gs.rosters.some((r) => r.playerId === p.id));
const top5 = [...frei].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)).slice(0, 5);

const zeilen: string[] = [];
let besterRangTop20 = Infinity;
for (const teamId of teamIds) {
  const team = gs.teams.find((t) => t.teamId === teamId)!;
  const frame = buildOrganicDraftFrame({
    gameState: gs,
    team,
    identity: gs.teamIdentities.find((i) => i.teamId === teamId),
    startingSquad: [],
    candidates: frei,
    draftSeed: `sonde:${teamId}`,
  });
  const schritt = createOrganicPlanStepState(frame.planInput);
  const e = organicBuyStep(frame.planInput, schritt, { topN: 5000 });
  const rang = new Map(e.top.map((c, i) => [c.playerId, i + 1]));
  const eco = frame.planInput.economy;
  const kasse = eco.cash;
  const optSlots = eco.weights.optTarget;
  const budgetJePlatz = kasse / optSlots;
  const top20 = [...frei].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)).slice(0, 20);
  for (const p of top20) besterRangTop20 = Math.min(besterRangTop20, rang.get(p.id) ?? Infinity);
  zeilen.push(
    `${teamId}: Kasse ${r1(kasse)}, Opt ${optSlots}, Budget/Platz ${r1(budgetJePlatz)}, wWin ${r1(eco.weights.wWin)}, wThrift ${r1(eco.weights.wThrift)}, ` +
      `Lizenz ${frame.superstarLizenz}, Plan ${JSON.stringify(frame.planInput.composition?.counts ?? null)}; ` +
      `Platz 1: ${e.top[0]?.player.marketValue} MW Nutzen ${r1(e.top[0]?.utility ?? 0)}; bewertet ${e.top.length}`,
  );
  for (const p of top5) {
    const mw = p.marketValue ?? 0;
    const gehalt = p.salaryDemand ?? p.displaySalary ?? 0;
    const preisInPlaetzen = (mw + 2 * gehalt) / budgetJePlatz;
    const preisStrafe = eco.weights.wThrift * preisInPlaetzen * 30;
    const c = e.top.find((x) => x.playerId === p.id);
    zeilen.push(
      `   ${p.name} MW ${mw} Gehalt ${gehalt}: Rang ${rang.get(p.id) ?? "nicht bewertet (Kasse/Schranke)"}, Nutzen ${c ? r1(c.utility) : "–"}, ` +
        `Preis in Plaetzen ${r1(preisInPlaetzen)} -> Preis-Strafe ca. ${r1(preisStrafe)}`,
    );
  }
}
console.log(zeilen.join("\n"));
console.log(`Bester Rang eines Top-20-Spielers ueber alle Teams: ${besterRangTop20}`);

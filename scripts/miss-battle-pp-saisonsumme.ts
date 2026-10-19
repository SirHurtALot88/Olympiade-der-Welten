// ===================================================================================
// SAISONSUMMEN-SONDE FUER DAS PP-BUDGET, REIN LEISTUNGSBASIERT (Teil A, Chris 19.10.).
//
// Validierungs-Pflicht aus dem Auftrag "PP-Budget + 0-10-Normierung" (CLAUDE.md-Abnahme analog):
// frischer 20-Spieltage-Battle-Save (derselbe Wizard-Pfad wie scripts/e2e-battle-pps-duell.ts),
// danach gegen `buildSeasonPointsLedger()` gemessen:
//   - Liga-1-Top-10-Mittel (kumulierte Spieler-PP ueber die Saison) soll in 40..50 liegen.
//   - p10 soll spuerbar ueber 0 liegen (Leistungskurve statt hartem 0-Boden bei Niederlage).
//   - kein Einsatz ueber MAX (PPS_DUELL_SPIELER_PP_MAX, 5,5) in einer EINZELNEN Disziplin-Zeile.
//   - Tabellenpunkte je Team bleiben exakt Σ 2/1/0 (ganzzahlig) -- die kritische Entkopplung von
//     `teamSummary.totalPoints` (Tabelle) gegen `playerDerivedTotal` (Leistungs-PP).
//
// AUFRUF (frische, lokale SQLite -- NIE den Produktions-/Abbild-Store):
//   OLY_APP_SQLITE_PATH=/tmp/oly-miss-pp-$$.sqlite npx tsx scripts/miss-battle-pp-saisonsumme.ts \
//     [spieltage=20] [laeufe=3]
// ===================================================================================
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { PPS_DUELL_SPIELER_PP_MAX } from "@/lib/resolve/battle-mode-pps-duell";

const spieltage = Number(process.argv[2] ?? 20);
const laeufe = Number(process.argv[3] ?? 3);

function quantil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const index = (sortiert.length - 1) * p;
  const unten = Math.floor(index);
  const oben = Math.ceil(index);
  if (unten === oben) return sortiert[unten]!;
  return sortiert[unten]! * (1 - (index - unten)) + sortiert[oben]! * (index - unten);
}

async function einLauf(nr: number) {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const draft = await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: `[miss-pp#${nr}]`,
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  console.log(`[Lauf ${nr}] save=${saveId} draft=${draft.status}/${draft.versuche}`);

  let gespielt = 0;
  for (let i = 0; i < spieltage; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    if (!lauf.ok) {
      console.log(`[Lauf ${nr}] ${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
      break;
    }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) {
      console.log(`[Lauf ${nr}] Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
      break;
    }
    gespielt += 1;
  }

  const ende = persistence.getSaveById(saveId)!;
  const gs = ende.gameState;
  const ledger = buildSeasonPointsLedger(gs, gs.season.id);

  // Tabellenpunkte je Team muessen exakt Σ 2/1/0 bleiben (ganzzahlig) -- die kritische
  // Entkopplung gegen die jetzt leistungsbasierten Spieler-PP.
  const zeilen = gs.seasonState.disciplineResults ?? [];
  const sum210ByTeam = new Map<string, number>();
  for (const z of zeilen) {
    if (z.resolutionSource === "arena" || z.resolutionSource === "pps_duell") {
      sum210ByTeam.set(z.teamId, (sum210ByTeam.get(z.teamId) ?? 0) + (z.teamPoints ?? 0));
    }
  }
  let tabelleFalsch = 0;
  let tabelleNichtGanzzahlig = 0;
  for (const team of gs.teams) {
    const summary = ledger.teamSummariesByTeamId.get(team.teamId);
    const erwartet = sum210ByTeam.get(team.teamId) ?? 0;
    if (!Number.isInteger(summary?.totalPoints ?? 0)) tabelleNichtGanzzahlig += 1;
    if (Math.abs((summary?.totalPoints ?? 0) - erwartet) > 1e-6) tabelleFalsch += 1;
  }

  // Einsatz-Deckel: keine EINZELNE Duell-Zeile darf ueber PPS_DUELL_SPIELER_PP_MAX liegen.
  const ueberschreitungen = ledger.pointEntries.filter(
    (entry) =>
      (entry.pointSource === "battle_mode_pps_duell_player_score" || entry.pointSource === "battle_mode_arena_boxscore_impact") &&
      entry.basePoints > PPS_DUELL_SPIELER_PP_MAX + 1e-6,
  ).length;

  // Liga-1-Top-10-Mittel (kumulierte Spieler-PP ueber die Saison).
  const liga1TeamIds = new Set(gs.teams.filter((t) => (gs.seasonState.leagueByTeamId?.[t.teamId] ?? "liga1") === "liga1").map((t) => t.teamId));
  const spielerSummen = [...ledger.playerSummariesByPlayerId.values()]
    .filter((s) => Object.keys(s.pointsByTeamId).some((teamId) => liga1TeamIds.has(teamId)))
    .map((s) => s.totalPoints)
    .sort((a, b) => b - a);
  const top10 = spielerSummen.slice(0, 10);
  const top10Mittel = top10.length > 0 ? top10.reduce((a, b) => a + b, 0) / top10.length : 0;
  const p10 = quantil([...spielerSummen].sort((a, b) => a - b), 0.1);

  console.log(
    `[Lauf ${nr}] Spieltage gespielt=${gespielt} Teams=${gs.teams.length} Spieler(Liga1)=${spielerSummen.length} ` +
      `Top10-Mittel=${top10Mittel.toFixed(2)} p10=${p10.toFixed(2)} max=${(spielerSummen[0] ?? 0).toFixed(2)}`,
  );
  console.log(
    `[Lauf ${nr}] Tabelle: ${gs.teams.length - tabelleFalsch}/${gs.teams.length} exakt Σ2/1/0, ` +
      `nicht-ganzzahlig=${tabelleNichtGanzzahlig}, Einzel-Zeilen ueber MAX=${ueberschreitungen}`,
  );

  return { top10Mittel, p10, tabelleFalsch, tabelleNichtGanzzahlig, ueberschreitungen, gespielt };
}

async function main() {
  const ergebnisse = [];
  for (let nr = 1; nr <= laeufe; nr += 1) {
    ergebnisse.push(await einLauf(nr));
  }
  const mittelTop10 = ergebnisse.reduce((a, e) => a + e.top10Mittel, 0) / ergebnisse.length;
  const mittelP10 = ergebnisse.reduce((a, e) => a + e.p10, 0) / ergebnisse.length;
  const tabelleFehlerGesamt = ergebnisse.reduce((a, e) => a + e.tabelleFalsch + e.tabelleNichtGanzzahlig, 0);
  const ueberschreitungenGesamt = ergebnisse.reduce((a, e) => a + e.ueberschreitungen, 0);
  console.log("=".repeat(70));
  console.log(
    `GESAMT (${laeufe} Laeufe): Top10-Mittel=${mittelTop10.toFixed(2)} (Ziel 40..50), ` +
      `p10-Mittel=${mittelP10.toFixed(2)} (Ziel spuerbar > 0), ` +
      `Tabellen-Abweichungen=${tabelleFehlerGesamt} (Ziel 0), Einzel-Zeilen ueber MAX=${ueberschreitungenGesamt} (Ziel 0)`,
  );
  const bestanden = tabelleFehlerGesamt === 0 && ueberschreitungenGesamt === 0 && mittelTop10 >= 40 && mittelTop10 <= 50 && mittelP10 > 0.5;
  console.log(bestanden ? "ABNAHME: bestanden" : "ABNAHME: NICHT bestanden -- s. Werte oben");
  process.exitCode = bestanden ? 0 : 1;
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

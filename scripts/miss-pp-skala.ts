// ===================================================================================
// PP-SKALA-SONDE (18.11., docs/design/pp-skala-18-11.md).
//
// Chris 18.11.: "Top-Spieler sollen in einer Diszi um die 5 PPs bekommen als Maximum." Diese Sonde
// misst, was ein Battle-Save heute TATSAECHLICH je Disziplin und Spieltag an Spieler-PP bucht:
// frischer Battle-Save (derselbe Wizard-Pfad wie scripts/miss-battle-pp-saisonsumme.ts, 32 KI-Teams),
// N Spieltage, danach `buildSeasonPointsLedger()` -> JSON-Abzug aller Spieler-PP-Zeilen.
//
// AUFRUF (frische Wegwerf-SQLite -- NIE den Produktions-/Abbild-Store; danach loeschen):
//   OLY_APP_SQLITE_PATH=/tmp/oly-pp-skala-$$.sqlite npx tsx scripts/miss-pp-skala.ts <spieltage> <ausgabe.json>
// Auswertung: node scripts/werte-pp-skala-aus.mjs <ausgabe.json>
// ===================================================================================
import { writeFileSync } from "node:fs";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

const spieltage = Number(process.argv[2] ?? 4);
const ausgabe = process.argv[3] ?? "/tmp/pp-skala.json";

async function main() {
  const t0 = Date.now();
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  // FORTSETZEN (OLY_PP_SKALA_SAVE_ID=<saveId>): einen in derselben Wegwerf-SQLite angelegten Save
  // weiterspielen, z. B. nach einem Abbruch durch Speichermangel. Ohne: frischer Save.
  const fortsetzen = process.env.OLY_PP_SKALA_SAVE_ID?.trim();
  const saveId = fortsetzen ? fortsetzen : await legeSaveAn(persistence, t0);
  await spieleUndSchreibe(persistence, saveId, t0);
}

async function legeSaveAn(persistence: ReturnType<typeof createPersistenceService>, t0: number): Promise<string> {
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
    logPrefix: "[pp-skala]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  console.log(`[pp-skala] save=${saveId} draft=${draft.status} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return saveId;
}

async function spieleUndSchreibe(persistence: ReturnType<typeof createPersistenceService>, saveId: string, t0: number) {
  // Bereits gespielte Spieltage (beim Fortsetzen) zaehlen mit: gespielt wird bis `spieltage` insgesamt.
  const schonGespielt = new Set(
    (persistence.getSaveById(saveId)!.gameState.seasonState.matchdayResults ?? []).map((r) => r.matchdayId),
  ).size;
  let gespielt = schonGespielt;
  for (let i = schonGespielt; i < spieltage; i += 1) {
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
      console.log(`[pp-skala] ${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
      break;
    }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) {
      console.log(`[pp-skala] Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
      break;
    }
    gespielt += 1;
    console.log(`[pp-skala] ${matchdayId} gespielt (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  const gs = persistence.getSaveById(saveId)!.gameState;
  const ledger = buildSeasonPointsLedger(gs, gs.season.id);
  const ligaJeTeam = gs.seasonState.leagueByTeamId ?? {};
  const quelleJeZeile = new Map<string, string>();
  for (const z of gs.seasonState.disciplineResults ?? []) {
    quelleJeZeile.set(`${z.matchdayResultId}::${z.teamId}::${z.disciplineId}::${z.disciplineSide}`, String(z.resolutionSource ?? ""));
  }
  const zeilen = ledger.pointEntries.map((e) => ({
    md: e.matchdayId,
    d: e.disciplineId,
    seite: e.disciplineSide,
    team: e.teamId,
    liga: ligaJeTeam[e.teamId] ?? "liga1",
    spieler: e.playerId,
    pp: e.basePoints,
    punkte: e.points,
    quelle: e.pointSource,
    aufloesung: quelleJeZeile.get(`${e.matchdayResultId}::${e.teamId}::${e.disciplineId}::${e.disciplineSide}`) ?? "",
    eignung: e.baseValue,
    score: e.finalPlayerScore,
  }));
  writeFileSync(
    ausgabe,
    JSON.stringify({ saveId, gespielt, ppSkala: process.env.OLY_PP_SKALA ?? "aus", erstellt: new Date().toISOString(), zeilen }),
  );
  console.log(`[pp-skala] ${gespielt} Spieltage, ${zeilen.length} PP-Zeilen -> ${ausgabe} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

/* eslint-disable no-console */
/** Sonde (18.11.): warum bekommt M-M in S1 keinen Sponsor? Nur Neues Spiel, KEIN Draft. Wegwerf-SQLite. */
import fs from "node:fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

async function main() {
  const p = process.env.OLY_APP_SQLITE_PATH;
  if (!p) throw new Error("OLY_APP_SQLITE_PATH setzen");
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(`${p}${s}`, { force: true });
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const, sandbox: true };
  const prev = previewNewGameSetup(input);
  const a = applyNewGameSetup({ ...input, confirmToken: prev.confirmToken }, persistence, { ownerId: null });
  const gs = persistence.getSaveById(a.save.saveId)!.gameState;
  const mit = gs.teams.filter((t) => getTeamSponsorContract(gs, t.teamId)).length;
  console.log("Teams", gs.teams.length, "mit Vertrag", mit, "Saison", gs.season.id);
  const rowsAll = previewSponsorSettlement(gs).rows;
  for (const code of ["M-M", "G-G", "Z-H"]) {
    const t = gs.teams.find((x) => x.teamId === code || x.shortCode === code)!;
    const c = getTeamSponsorContract(gs, t.teamId);
    const offers = getTeamSponsorOffers(gs, t.teamId);
    console.log(code, "Vertrag:", c ? { name: c.name, offerId: c.offerId, term: c.termSeasons, seasonId: c.seasonId, startRank: c.startRank } : null, "Angebote:", offers.length);
    const rows = rowsAll.filter((r) => r.teamId === t.teamId);
    console.log("  Settlement-Zeilen:", rows.map((r) => `${r.componentId}:${r.cashDelta}:${r.status}`));
  }
  const ohne = gs.teams.filter((t) => !getTeamSponsorContract(gs, t.teamId)).map((t) => t.teamId);
  console.log("ohne Vertrag:", ohne);
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(`${p}${s}`, { force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });

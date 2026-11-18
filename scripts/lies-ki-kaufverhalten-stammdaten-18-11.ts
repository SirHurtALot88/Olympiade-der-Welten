/* eslint-disable no-console */
/**
 * Stammdaten fuer die KI-Kaufverhalten-Analyse (18.11.): je Team Budget, Identitaet (Ambition, Finanzen,
 * Vorstandsvertrauen, Kaderziel), GM-Archetyp, Startrang, S1-Sponsor samt Erwartungswert (terms.anchor,
 * VOR dem Draft bekannt) und den Wert aller drei Angebote. Nur Neues Spiel (Battle, solo_1), KEIN Draft,
 * Wegwerf-SQLite (OLY_APP_SQLITE_PATH), nichts auf den Server. Aendert keine Spiellogik.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/wegwerf.sqlite npx tsx scripts/lies-ki-kaufverhalten-stammdaten-18-11.ts [--out datei.json]
 *
 * Hinweis: M-M ist im Preset solo_1 das menschliche Team und bekommt deshalb im Setup keinen Sponsor
 * (Ursache der M-M-Auffaelligkeit, siehe docs/design/ki-kaufverhalten-analyse-18-11.md Abschnitt 5);
 * hier wird sein bestes Angebot nur zum Vergleich mit ausgewiesen.
 */
import fs from "node:fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getLeagueOf } from "@/lib/season/league-split";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const r2 = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const p = process.env.OLY_APP_SQLITE_PATH;
  if (!p) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Datei!) setzen");
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(`${p}${s}`, { force: true });
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const, sandbox: true };
  const prev = previewNewGameSetup(input);
  const a = applyNewGameSetup({ ...input, confirmToken: prev.confirmToken }, persistence, { ownerId: null });
  const gs = persistence.getSaveById(a.save.saveId)!.gameState;
  const out: Record<string, unknown> = {};
  for (const t of gs.teams) {
    const id = gs.teamIdentities.find((x) => x.teamId === t.teamId);
    const gm = getTeamGeneralManager(gs, t.teamId);
    const prof = getTeamStrategyProfile(gs, t.teamId);
    const c = getTeamSponsorContract(gs, t.teamId);
    const offers = getTeamSponsorOffers(gs, t.teamId).map((o) => {
      const terms = getSponsorV3Terms(o);
      return { archetype: o.archetype, rarity: o.rarity, term: o.termSeasons, anchor: terms ? r2(terms.anchor) : null, floor: terms ? r2(terms.floor) : null, goalSize: terms ? r2(terms.goalSize) : null };
    });
    const ct = c ? getSponsorV3Terms(c) : null;
    out[t.teamId] = {
      liga: getLeagueOf(gs, t.teamId),
      budget: t.budget,
      cash: t.cash,
      identity: id ? { ambition: id.ambition, finances: id.finances, harmony: id.harmony, boardConfidence: id.boardConfidence, playerMin: id.playerMin, playerOpt: id.playerOpt } : null,
      gm: gm?.profile?.archetype ?? null,
      bias: prof ? { cashPriority: prof.bias.cashPriority, starPriority: prof.bias.starPriority, wageSensitivity: prof.bias.wageSensitivity, riskTolerance: prof.bias.riskTolerance, valuePriority: prof.bias.valuePriority } : null,
      spendAggression: prof?.spendAggression ?? null,
      startRank: c?.startRank ?? null,
      sponsor: c ? { name: c.name, archetype: c.archetype, rarity: c.rarity, term: c.termSeasons, anchor: ct ? r2(ct.anchor) : null, floor: ct ? r2(ct.floor) : null, goalSize: ct ? r2(ct.goalSize) : null } : null,
      offers,
    };
  }
  const o = arg("out", "");
  if (o) fs.writeFileSync(o, JSON.stringify({ erzeugt: new Date().toISOString(), teams: out }, null, 1));
  else console.log(JSON.stringify(out, null, 1));
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(`${p}${s}`, { force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });

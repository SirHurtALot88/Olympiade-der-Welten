// BIT-IDENTITAETS-SONDE (PPS-Duell-Bruecke 16.10., docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md 5.1):
// Resolve-Vorschau aller Spieltage der aktiven Saison + Ledger + Saisonstand-Nachbuchung fuer ALLE
// Saves einer SQLite, je als SHA-256. Einmal auf main, einmal auf dem Branch laufen lassen (je gegen
// eine EIGENE Kopie desselben Abbilds) und die Ausgaben mit `cmp` vergleichen.
// Aufruf: OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-resolve-bit-identitaet.ts <ausgabe.json>
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { zieheSaisonstandPunkteNach } from "@/lib/standings/saisonstand-punkte-nachbuchung";
import { resolveGameMode } from "@/lib/season/game-mode";

const ausgabe = process.argv[2] ?? "/dev/stdout";
const persistence = createPersistenceService();
const saves = persistence.listSaves();
const bericht: Record<string, unknown> = {};
for (const summary of saves) {
  const save = persistence.getSaveById(summary.saveId);
  if (!save) continue;
  const gs = save.gameState;
  const seasonId = gs.season.id;
  const proSpieltag: Record<string, string> = {};
  let teamPunkteSumme = 0;
  for (const matchdayId of gs.season.matchdayIds ?? []) {
    const contexts = gs.teams
      .map((team) => loadLocalLegacyLineupContextFromGameState(gs, { saveId: save.saveId, seasonId, matchdayId, teamId: team.teamId }))
      .flatMap((r) => (r.ok ? [r.context] : []));
    if (contexts.length === 0) continue;
    try {
      const preview = buildLegacyMatchdayResolvePreview(contexts);
      const json = JSON.stringify(preview);
      proSpieltag[matchdayId] = createHash("sha256").update(json).digest("hex").slice(0, 16);
      for (const dp of preview.disciplinePreviews) for (const tr of dp.teamResults) teamPunkteSumme += tr.teamPoints ?? 0;
    } catch (error) {
      proSpieltag[matchdayId] = `FEHLER:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  const ledger = buildSeasonPointsLedger(gs, seasonId);
  const ledgerJson = JSON.stringify([...ledger.teamSummariesByTeamId.entries()]);
  const nach = zieheSaisonstandPunkteNach(gs, seasonId);
  bericht[save.saveId] = {
    gameMode: resolveGameMode(gs),
    seasonId,
    spieltage: proSpieltag,
    teamPunkteSummeAlleVorschauen: Math.round(teamPunkteSumme * 1000) / 1000,
    ledger: createHash("sha256").update(ledgerJson).digest("hex").slice(0, 16),
    nachbuchung: createHash("sha256").update(JSON.stringify(nach.gameState.seasonState.standings ?? {})).digest("hex").slice(0, 16),
    nachbuchungGeaendert: nach.geaenderteTeams.length,
  };
  console.error(`[bit-identitaet] ${save.saveId} ${resolveGameMode(gs)} ${Object.keys(proSpieltag).length} Spieltage`);
}
writeFileSync(ausgabe, JSON.stringify(bericht, null, 1));

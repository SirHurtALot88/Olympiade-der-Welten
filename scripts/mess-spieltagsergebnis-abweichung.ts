/* eslint-disable no-console */
/**
 * Messung: Spieltags-Ergebnis (Rang vorher/nachher/Delta, Summe PP) auf dem VOLLEN Save
 * gegen den kompakten Browser-Payload.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx <dieses Skript> [--save <id>] [--matchday <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let matchdayId: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) saveId = argv[i + 1]!;
    if (argv[i] === "--matchday" && argv[i + 1]) matchdayId = argv[i + 1]!;
  }
  return { saveId, matchdayId };
}

async function main() {
  const { saveId: gewaehlt, matchdayId: gewaehlterSpieltag } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden.");
    process.exit(2);
    return;
  }
  const voll = save.gameState;
  const kompakt = compactFoundationInitialGameState(voll);
  const matchdayId = gewaehlterSpieltag ?? voll.matchdayState.matchdayId;

  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Saison     : ${voll.season.id} (${voll.season.name ?? "?"})`);
  console.log(`Spieltag   : ${matchdayId} (#${voll.season.matchdayIds.indexOf(matchdayId ?? "") + 1})`);
  console.log(
    `Rohdaten   : voll disciplineResults ${(voll.seasonState.disciplineResults ?? []).length}, ` +
      `kompakt ${(kompakt.seasonState.disciplineResults ?? []).length}`,
  );

  const a = buildMatchdaySummary(voll, { matchdayId });
  const b = buildMatchdaySummary(kompakt, { matchdayId });

  console.log(`\nWarnungen voll   : ${a.warnings.join(", ") || "(keine)"}`);
  console.log(`Warnungen kompakt: ${b.warnings.join(", ") || "(keine)"}`);

  const bByTeam = new Map(b.teamRows.map((row) => [row.teamId, row] as const));
  let abweichend = 0;
  console.log("\nTeam | Rang vorher (voll->kompakt) | nachher | Delta | Summe PP");
  for (const row of a.teamRows) {
    const other = bByTeam.get(row.teamId);
    const gleich =
      other != null &&
      other.seasonRankBeforeMatchday === row.seasonRankBeforeMatchday &&
      other.seasonRankAfterMatchday === row.seasonRankAfterMatchday &&
      other.rankDelta === row.rankDelta &&
      other.cumulativePoints === row.cumulativePoints;
    if (!gleich) abweichend += 1;
    console.log(
      `${row.teamShortCode.padEnd(4)} | ${String(row.seasonRankBeforeMatchday).padStart(3)} -> ${String(other?.seasonRankBeforeMatchday).padStart(3)}` +
        ` | ${String(row.seasonRankAfterMatchday).padStart(3)} -> ${String(other?.seasonRankAfterMatchday).padStart(3)}` +
        ` | ${String(row.rankDelta).padStart(3)} -> ${String(other?.rankDelta).padStart(3)}` +
        ` | ${String(row.cumulativePoints).padStart(6)} -> ${String(other?.cumulativePoints).padStart(6)}` +
        (gleich ? "" : "   ABWEICHEND"),
    );
  }
  console.log(`\nAbweichende Zeilen: ${abweichend} von ${a.teamRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

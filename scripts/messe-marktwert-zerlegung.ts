/**
 * MISST, OB DIE MARKTWERT-ZERLEGUNG AM ECHTEN SPIELSTAND TRAEGT.
 *
 * Chris will einen Hover auf dem Marktwert eines Spielers. Die Frage vor dem Bauen ist nicht
 * „geht das", sondern „wie sieht die Zerlegung bei einem echten Spieler wirklich aus" — wie viele
 * Disziplinen tragen, wie stark faellt das ab, und ist die Summe der Teile die Zahl, die im Spiel
 * steht.
 *
 * Aufruf: OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/messe-marktwert-zerlegung.ts
 */
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { buildMarketValueDisciplineInputsFromPlayers } from "@/lib/player-formulas/league-market-value-snapshot";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

import type { GameState } from "@/lib/data/olyDataTypes";

function zahl(wert: number): string {
  return wert.toFixed(2).padStart(7);
}

const repository = createSaveRepository();
const saves = repository.listSaves();

for (const kopf of saves) {
  const gameState = repository.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState) continue;

  const quellen = loadPlayerFormulaSources();
  const ergebnis = calculateMarketValueFromRankTable({
    players: buildMarketValueDisciplineInputsFromPlayers(gameState.players),
    rankToDisciplineMarketValue: quellen.rankToDisciplineMarketValue,
  });

  if (ergebnis.status !== "ready") {
    console.log(`\n=== ${kopf.saveId}: Zerlegung nicht moeglich (${ergebnis.status})`);
    continue;
  }

  const menschTeams = gameState.teams.filter((team) => (team as { isHuman?: boolean }).isHuman);
  const teamId = menschTeams[0]?.teamId ?? gameState.teams[0]?.teamId;
  const kader = gameState.rosters.filter((eintrag) => eintrag.teamId === teamId);
  const spielerById = new Map(gameState.players.map((spieler) => [spieler.id, spieler] as const));
  const zerlegungById = new Map(ergebnis.players.map((eintrag) => [eintrag.playerId, eintrag] as const));

  console.log(`\n=== ${kopf.saveId} · Team ${teamId} · ${gameState.players.length} Spieler in der Liga`);

  // UEBER DIE GANZE LIGA, nicht nur ueber einen Kader: die Zahl im Spiel kommt aus
  // `resolvePlayerEconomyContract`, die Zerlegung aus der Rangtabelle. Nur wenn beide fuer JEDEN
  // Spieler dieselbe Summe ergeben, darf der Hover behaupten, er erklaere die gezeigte Zahl.
  const rosterByPlayerId = new Map(gameState.rosters.map((eintrag) => [eintrag.playerId, eintrag] as const));
  let abweichungen = 0;
  let ohneZerlegung = 0;
  let ohneGezeigtenWert = 0;
  let groessteAbweichung = 0;
  for (const spieler of gameState.players) {
    const zerlegung = zerlegungById.get(spieler.id);
    const gezeigt = resolvePlayerEconomyContract({
      player: spieler,
      rosterEntry: rosterByPlayerId.get(spieler.id),
    }).marketValue;
    if (!zerlegung) { ohneZerlegung += 1; continue; }
    if (gezeigt == null) { ohneGezeigtenWert += 1; continue; }
    const abstand = Math.abs(zerlegung.marketValueNew - gezeigt);
    groessteAbweichung = Math.max(groessteAbweichung, abstand);
    if (abstand > 0.05) abweichungen += 1;
  }
  console.log(
    `  Liga ${gameState.players.length} · ohne Zerlegung ${ohneZerlegung} · ohne gezeigten MW ${ohneGezeigtenWert}` +
      ` · Abweichungen > 0,05: ${abweichungen} (groesste ${groessteAbweichung.toFixed(4)})`,
  );
  console.log(`  Kader ${kader.length} (Team ${teamId})`);

  // Der wertvollste Kaderspieler, ausgeschrieben — so saehe der Hover aus.
  const bester = kader
    .map((eintrag) => ({ eintrag, zerlegung: zerlegungById.get(eintrag.playerId) }))
    .filter((zeile) => zeile.zerlegung != null)
    .sort((links, rechts) => (rechts.zerlegung!.marketValueNew - links.zerlegung!.marketValueNew))[0];

  if (!bester) continue;
  const spieler = spielerById.get(bester.eintrag.playerId);
  const z = bester.zerlegung!;
  const beitraege = Object.entries(z.disciplineMarketValues)
    .map(([disziplin, wert]) => ({ disziplin, wert, rang: z.disciplineRanks[disziplin] ?? null }))
    .sort((links, rechts) => rechts.wert - links.wert);

  console.log(`  --- ${(spieler as { name?: string })?.name ?? bester.eintrag.playerId}: MW ${z.marketValueNew}`);
  console.log(`      ${beitraege.length} Disziplinen tragen bei, ${Object.keys(z.disciplineRanks).length} gewertet`);
  for (const beitrag of beitraege.slice(0, 8)) {
    console.log(`      ${beitrag.disziplin.padEnd(28)} Rang ${String(beitrag.rang).padStart(5)}  ${zahl(beitrag.wert)}`);
  }
  const restSumme = beitraege.slice(8).reduce((summe, beitrag) => summe + beitrag.wert, 0);
  if (beitraege.length > 8) {
    console.log(`      ${`+ ${beitraege.length - 8} weitere`.padEnd(28)}             ${zahl(restSumme)}`);
  }
  console.log(`      ${"Summe der Raenge".padEnd(28)}             ${zahl(z.rawDisciplineMarketValueSum)}`);
  if (z.adjustedRaw !== z.rawDisciplineMarketValueSum) {
    console.log(`      ${"mwChangeFix".padEnd(28)}             ${zahl(z.adjustedRaw - z.rawDisciplineMarketValueSum)}`);
  }
  console.log(`      ${"= Marktwert".padEnd(28)}             ${zahl(z.marketValueNew)}`);
}

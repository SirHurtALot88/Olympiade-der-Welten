/* eslint-disable no-console */
/**
 * PRUEFUNG: leitet der Backfill die Endsaison auf einem echten Spielstand richtig ab?
 * Nutzung: OLY_APP_SQLITE_PATH=/pfad/abbild.sqlite npx tsx scripts/pruefe-endsaison-backfill-am-abbild.ts [--save <id>]
 *
 * Der heikle Fall ist ein Spielstand, auf dem die Vertragsalterung fuer die laufende Saison SCHON
 * gelaufen ist: seine Laufzeiten beziehen sich dann auf die kommende Saison, waehrend die
 * Saisonnummer noch die alte ist. Ohne Versatz kaeme jeder Vertrag eine Saison zu kurz heraus.
 *
 * Schreibt nichts.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { hasSeasonEndContractTickApplied } from "@/lib/contracts/contract-renewal-service";
import { endSaisonNummer, restlaufzeit } from "@/lib/contracts/vertragslaufzeit";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

async function main() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf("--save");
  const saveId = index >= 0 ? argv[index + 1] : null;
  const persistence = createPersistenceService();
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand.");
    process.exit(2);
    return;
  }

  const gealtert = hasSeasonEndContractTickApplied(save.gameState);
  const laufend = getCurrentSeasonNumber(save.gameState);
  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Saison     : ${save.gameState.season.id} (Nummer ${laufend}) · Phase ${save.gameState.gamePhase}`);
  console.log(`Alterung fuer diese Saison gelaufen: ${gealtert}`);
  console.log(`Versatz greift: ${gealtert ? "ja (+1)" : "nein"}\n`);

  const optionen = { alterungBereitsGelaufen: gealtert };
  const proEnde = new Map<string, number>();
  for (const eintrag of save.gameState.rosters) {
    const ende = endSaisonNummer(eintrag, save.gameState, optionen);
    const schluessel = ende == null ? "unbekannt" : `Saison ${ende}`;
    proEnde.set(schluessel, (proEnde.get(schluessel) ?? 0) + 1);
  }
  console.log("Endsaison ueber den ganzen Kader:");
  for (const [schluessel, anzahl] of [...proEnde.entries()].sort()) {
    console.log(`  ${schluessel}: ${anzahl}`);
  }

  const laufenAus = save.gameState.rosters.filter(
    (eintrag) => restlaufzeit(eintrag, save.gameState, optionen) <= 1,
  ).length;
  const ohneVersatz = save.gameState.rosters.filter((eintrag) => restlaufzeit(eintrag, save.gameState) <= 1).length;
  console.log(`\n„Laeuft mit dieser Saison aus": ${laufenAus}`);
  console.log(`Ohne Versatz waeren es          : ${ohneVersatz}`);

  // `teamControlSettings` ist je nach Spielstand eine Liste ODER eine Zuordnung — beides lesen.
  const rohEinstellungen = save.gameState.seasonState.teamControlSettings ?? [];
  const einstellungen: Array<{ teamId?: string; controlMode?: string }> = Array.isArray(rohEinstellungen)
    ? rohEinstellungen
    : Object.entries(rohEinstellungen as Record<string, { controlMode?: string }>).map(([teamId, wert]) => ({
        teamId,
        controlMode: wert?.controlMode,
      }));
  const teams = new Set(
    einstellungen.filter((eintrag) => eintrag.controlMode === "manual").map((eintrag) => eintrag.teamId),
  );
  console.log("\nManuell gefuehrte Teams im Detail:");
  for (const eintrag of save.gameState.rosters.filter((zeile) => teams.has(zeile.teamId))) {
    const name = save.gameState.players.find((spieler) => spieler.id === eintrag.playerId)?.name ?? eintrag.playerId;
    console.log(
      `  ${eintrag.teamId} ${name}: Laufzeit ${eintrag.contractLength} (${eintrag.contractStatus ?? "—"})` +
        ` -> Endsaison ${endSaisonNummer(eintrag, save.gameState, optionen)}` +
        ` · Rest ${restlaufzeit(eintrag, save.gameState, optionen)}`,
    );
  }
}

void main();

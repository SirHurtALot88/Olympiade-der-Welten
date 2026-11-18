/* eslint-disable no-console */
/**
 * FORM AN EINER SPIELSTAND-KOPIE NACHFUEHREN (18.11., fuer Sichtpruefung und Messung).
 *
 * Ein Live-Abbild von vor der Form-Einfuehrung hat keine `playerFormState`. Dieses Skript fuehrt die
 * ECHTE Fortschreibung (`advancePlayerFormState`) fuer jeden schon gewerteten Spieltag der laufenden
 * Saison in Reihenfolge nach — aus den gebuchten `playerDisciplinePerformances`, ohne etwas zu
 * erfinden — und speichert das Ergebnis in der Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt.
 * NUR AUF EINE KOPIE ZEIGEN LASSEN, nie auf den Server-Stand.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/form-am-save-abbild-nachfuehren.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { advancePlayerFormState } from "@/lib/morale/form-moral-modifikator";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

async function main() {
  const idx = process.argv.indexOf("--save");
  const gewaehlt = idx >= 0 ? process.argv[idx + 1] : null;
  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden.");
    process.exit(2);
    return;
  }
  let gameState = save.gameState;
  const ergebnisse = (gameState.seasonState.matchdayResults ?? []).filter((e) => e.seasonId === gameState.season.id);
  const reihenfolge = gameState.season.matchdayIds ?? [];
  const tage = [...new Set(ergebnisse.map((e) => e.matchdayId))].sort((a, b) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b));
  // Verletzung und Erschoepfung VON DAMALS aus den Verletzungswuerfen des Spieltags (injuryEvents: je Einsatz ein Wurf),
  // nicht der heutige Stand: sonst waere jeder derzeit Verletzte/Erschoepfte schon an Spieltag 1 gebremst gewesen.
  const ereignisse = gameState.injuryEvents ?? [];
  for (const tag of tage) {
    const heute = ereignisse.filter((e) => e.seasonId === gameState.season.id && e.matchdayId === tag);
    const historisch = {
      verletzt: new Set(heute.filter((e) => e.result === "injured").map((e) => e.playerId)),
      erschoepfung: new Map(heute.map((e) => [e.playerId, e.fatigueAfterRecovery ?? e.fatigueBefore] as [string, number])),
    };
    gameState = { ...gameState, playerFormState: advancePlayerFormState(gameState, tag, historisch) };
  }
  persistence.saveSingleplayerState(save.saveId, gameState);
  const mit = (gameState.playerFormState ?? []).filter((z) => (z.verlauf?.length ?? 0) > 0).length;
  // Verteilung (Review-Befund 4/5): Spannweite und Anteil der Stufen ueber alle Spieler mit Einsatz.
  const formen = (gameState.playerFormState ?? []).filter((z) => (z.appearances ?? 0) > 0).map((z) => z.form).sort((a, b) => a - b);
  if (formen.length) {
    const q = (p: number) => formen[Math.min(formen.length - 1, Math.floor(p * formen.length))];
    const anteil = (f: (x: number) => boolean) => ((formen.filter(f).length / formen.length) * 100).toFixed(1);
    const mittel = formen.reduce((a, b) => a + b, 0) / formen.length;
    console.log(
      `Form-Verteilung (n=${formen.length}, Spieler mit Einsatz): min ${formen[0]} / p10 ${q(0.1)} / Median ${q(0.5)} / p90 ${q(0.9)} / max ${formen[formen.length - 1]}, Mittel ${mittel.toFixed(1)}; ` +
        `Stufen: ▲▲ ${anteil((x) => x >= 72.5)} %, ▲ ${anteil((x) => x >= 57.5 && x < 72.5)} %, – ${anteil((x) => x > 42.5 && x < 57.5)} %, ▼ ${anteil((x) => x > 27.5 && x <= 42.5)} %, ▼▼ ${anteil((x) => x <= 27.5)} %`,
    );
  }
  console.log(`playerFormState als JSON: ${Math.round(JSON.stringify(gameState.playerFormState ?? []).length / 1024)} KB (${tage.length} Spieltage)`);
  console.log(`Spielstand ${save.saveId} (${save.name}): ${tage.length} Spieltage nachgefuehrt, ${mit} Spieler mit Verlauf.`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});

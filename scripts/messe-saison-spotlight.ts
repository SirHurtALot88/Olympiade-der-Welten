/* eslint-disable no-console */
/**
 * WAS STEHT IM SAISON-SPOTLIGHT — an echten Spielstaenden gemessen.
 *
 * Zweck: pruefen, dass der Block nur Zahlen zeigt, die im Save wirklich stehen, und dass er
 * dort gar nicht erscheint, wo die Vorsaison fehlt. Gefahren einmal je Saison zeigt er ausserdem,
 * ob die Fuenf-Zeilen-Grenze reicht.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-saison-spotlight.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSaisonSpotlight } from "@/lib/foundation/saison-spotlight";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function zahl(wert: number | null, stellen = 2): string {
  return wert == null ? "—" : wert.toFixed(stellen).replace(".", ",");
}

function vorzeichen(wert: number, stellen = 1): string {
  return `${wert > 0 ? "+" : ""}${wert.toFixed(stellen).replace(".", ",")}`;
}

const p = createPersistenceService();
let mitBlock = 0;
let ohneBlock = 0;

for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const kuerzel = String(eintrag.saveId).slice(-6);

  for (const team of gs.teams) {
    if (!(team as { humanControlled?: boolean }).humanControlled) continue;
    const modell = buildSaisonSpotlight({ gameState: gs, teamId: team.teamId });
    if (!modell) {
      ohneBlock += 1;
      console.log(`${kuerzel}  ${team.teamId}  — kein Block (keine Vorsaison oder leerer Kader)`);
      continue;
    }
    mitBlock += 1;
    console.log(
      `\n${kuerzel}  ${modell.teamName} (${modell.teamId})  ` +
        `${modell.seasonLabelFrom} -> ${modell.seasonLabelTo}`,
    );
    console.log(
      `  Platz ${modell.rank ?? "—"} von ${modell.teamCount ?? "—"} · Start als Nr. ${modell.startRank ?? "—"}` +
        `${modell.rankDelta != null ? ` · ${vorzeichen(modell.rankDelta, 0)} Plaetze` : ""}`,
    );
    console.log(
      `  Kacheln: ${vorzeichen(modell.netSetpointsTotal)} SP netto · ` +
        `${modell.classChangeCount} Klassenwechsel · ` +
        `${modell.marketValueGain == null ? "—" : vorzeichen(modell.marketValueGain)} MW`,
    );
    for (const zeile of modell.rows) {
      const best = zeile.bestAttribute
        ? `${zeile.bestAttribute.label} ${zahl(zeile.bestAttribute.fromValue, 1)} -> ${zahl(zeile.bestAttribute.toValue, 1)}`
        : "—";
      console.log(
        `    ${zeile.classChange ? "^" : " "} ${zeile.playerName.padEnd(22)}` +
          ` ${vorzeichen(zeile.netSetpoints).padStart(6)}  ${best.padEnd(26)}` +
          ` ${zahl(zeile.marketValueFrom)} -> ${zahl(zeile.marketValueTo)}` +
          `  ${zeile.appearances ?? "—"} Einsaetze  ${zeile.trainingMode ?? "—"}` +
          `${zeile.classChange ? `  [${zeile.classChange.from} -> ${zeile.classChange.to}]` : ""}`,
      );
    }
    if (modell.moreRowCount > 0) console.log(`    + ${modell.moreRowCount} weitere`);
    console.log(
      `  Neu im Team (${modell.newcomers.length}): ` +
        (modell.newcomers.length
          ? modell.newcomers.map((n) => `${n.playerName} (${n.className ?? "?"}, ${zahl(n.marketValue)})`).join(" · ")
          : "—"),
    );
    console.log(
      `  Liga: bester Trainierer ${modell.leagueBestTrainer?.playerName ?? "—"}` +
        `${modell.leagueBestTrainer ? ` (${modell.leagueBestTrainer.teamName ?? "?"}) ${vorzeichen(modell.leagueBestTrainer.netSetpoints)} SP` : ""}` +
        ` · ${modell.leagueClassChangeCount} Klassenwechsel ligaweit`,
    );
  }
}

console.log(`\nSpielstaende mit Block: ${mitBlock} · ohne Block: ${ohneBlock}`);

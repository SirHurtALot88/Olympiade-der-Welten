/**
 * RANGTABELLE-TEILNEHMERZAHL-MESSUNG — Katalog-playerCount vs. echte Teilnehmerzahl je Disziplin.
 *
 * Chris meldet: "Showcase hat 6 Spieler in der Season und trotzdem ist SHO nur 2." Die RANG-Tabelle
 * ordnet ihre Spalten nach `SEASON_DISCIPLINE_PLAYER_COUNT` (lib/season/season-discipline-area-groups.ts) —
 * einer FESTEN Konstante, gespiegelt aus `foundationSeedDisciplines[].playerCount` in
 * lib/data/dataAdapter.ts. Dieses Skript misst gegen den echten Spielstand, ob diese Katalogzahl
 * mit der tatsächlichen Teilnehmerzahl der laufenden Saison übereinstimmt.
 *
 * Zwei Kandidaten für "Teilnehmerzahl":
 *  (a) Katalog-playerCount (fix, aus den Seed-Disziplinen)
 *  (b) tatsächliche Zahl unterschiedlicher Spieler mit PPs > 0 in dieser Disziplin diese Saison,
 *      aus dem Season-Points-Ledger (buildSeasonPointsLedger) — dieselbe Quelle, aus der auch der
 *      Hover "wer hat hier PPs geholt" in der Season-Standings-Ansicht kommt
 *      (lib/foundation/season-standings-top-players.ts).
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad-zur-sqlite> npx tsx scripts/rangtabelle-teilnehmerzahl-messung.ts --save <id>
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_LABELS,
  SEASON_DISCIPLINE_PLAYER_COUNT,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import type { GameState } from "@/lib/data/olyDataTypes";

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? (process.argv[idx + 1] as string) : null;
}

function main() {
  const saveId = argValue("--save");
  if (!saveId) {
    console.error("Erwarte --save <id>");
    process.exit(1);
  }

  const persistence = createPersistenceService();
  const persisted = persistence.getSaveById(saveId);
  if (!persisted) {
    console.error(`Save ${saveId} nicht im Store gefunden.`);
    process.exit(1);
  }

  const gameState = persisted.gameState as GameState;
  console.log(`Save ${saveId} · Saison ${gameState.season.id} (Jahr ${gameState.season.year}) · Spieltag ${gameState.season.currentMatchday ?? "?"}`);
  console.log(`Teams: ${gameState.teams.length}`);
  console.log("");

  // Katalog-playerCount direkt aus den Disziplin-Stammdaten des Saves (nicht nur der gespiegelten Konstante).
  const catalogPlayerCountByDisciplineId = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.playerCount ?? null] as const),
  );

  const ledger = buildSeasonPointsLedger(gameState);
  console.log(`Ledger hasResultSource=${ledger.hasResultSource} · Warnungen: ${ledger.warnings.length}`);
  if (ledger.warnings.length > 0) {
    console.log(ledger.warnings.slice(0, 5).map((w) => `  - ${w}`).join("\n"));
  }
  console.log("");

  // Echte Teilnehmerzahl: eindeutige Spieler mit points > 0 in dieser Disziplin, saisonweit (alle Teams).
  const realParticipantsByKey = new Map<SeasonDisciplineKey, Set<string>>();
  for (const entry of ledger.pointEntries) {
    if (!(entry.points > 0)) continue;
    const key = normalizeLineupDisciplineFieldName(entry.disciplineId);
    if (!(key in SEASON_DISCIPLINE_LABELS)) continue;
    const typedKey = key as SeasonDisciplineKey;
    const set = realParticipantsByKey.get(typedKey) ?? new Set<string>();
    set.add(entry.playerId);
    realParticipantsByKey.set(typedKey, set);
  }

  // Katalog-playerCount je normalisiertem Schlüssel (über die Disziplin-ID im Save, nicht die Konstante,
  // damit wir gegen den ECHTEN Save-Stand messen statt gegen die gespiegelte Datei).
  const catalogByKey = new Map<SeasonDisciplineKey, number | null>();
  for (const discipline of gameState.disciplines) {
    const key = normalizeLineupDisciplineFieldName(discipline.id);
    if (!(key in SEASON_DISCIPLINE_LABELS)) continue;
    catalogByKey.set(key as SeasonDisciplineKey, discipline.playerCount ?? null);
  }

  console.log("Disziplin | Katalog-playerCount (Save) | Konstante SEASON_DISCIPLINE_PLAYER_COUNT | echte Teilnehmer (Saison, PPs>0) | Differenz");
  console.log("---|---|---|---|---");

  for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
    for (const key of group.keys) {
      const catalogSave = catalogByKey.get(key) ?? null;
      const catalogConst = SEASON_DISCIPLINE_PLAYER_COUNT[key];
      const real = realParticipantsByKey.get(key)?.size ?? 0;
      const diff = real - (catalogSave ?? catalogConst);
      console.log(
        `${SEASON_DISCIPLINE_LABELS[key]} (${key}) | ${catalogSave ?? "—"} | ${catalogConst} | ${real} | ${diff > 0 ? "+" : ""}${diff}`,
      );
    }
  }

  console.log("");
  console.log("=== Spaltenreihenfolge je Bereich, sortiert nach ECHTER Teilnehmerzahl (real, desc) ===");
  for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
    const sortedByReal = [...group.keys].sort((a, b) => {
      const ra = realParticipantsByKey.get(a)?.size ?? 0;
      const rb = realParticipantsByKey.get(b)?.size ?? 0;
      return rb - ra;
    });
    const sortedByCatalog = [...group.keys].sort(
      (a, b) => SEASON_DISCIPLINE_PLAYER_COUNT[b] - SEASON_DISCIPLINE_PLAYER_COUNT[a],
    );
    console.log(
      `${group.label}: Katalog-Reihenfolge = ${sortedByCatalog.map((k) => SEASON_DISCIPLINE_LABELS[k]).join(" · ")}`,
    );
    console.log(
      `${group.label}: Echte-Reihenfolge  = ${sortedByReal.map((k) => SEASON_DISCIPLINE_LABELS[k]).join(" · ")}`,
    );
  }

  console.log("");
  console.log("=== Detail SOC-Gruppe (aus Chris' Screenshot: BAS · SHO · FOO · EIS · BAT) ===");
  const soc = SEASON_DISCIPLINE_AREA_GROUPS.find((g) => g.id === "soc");
  for (const key of soc?.keys ?? []) {
    console.log(
      `  ${SEASON_DISCIPLINE_LABELS[key]}: Katalog=${SEASON_DISCIPLINE_PLAYER_COUNT[key]} echte Teilnehmer=${realParticipantsByKey.get(key)?.size ?? 0} ` +
        `Spieler=[${[...(realParticipantsByKey.get(key) ?? [])].join(", ")}]`,
    );
  }
}

main();

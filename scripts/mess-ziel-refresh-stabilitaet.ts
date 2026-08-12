/* eslint-disable no-console */
/**
 * MISST, OB EIN ZIEL-REFRESH DEN ZIELBESTAND UNVERAENDERT LAESST.
 *
 * WARUM ES DAS BRAUCHT: `refreshTeamObjectiveState` ersetzt den kompletten Saisonbestand durch das
 * Ergebnis von `mergeStoredTeamObjectives`. Verwirft der Merge ein gespeichertes Ziel, ist es weg —
 * mitsamt seinem Reward in der Saisonabrechnung. Genau das war der Befund (Paket 2 im Plan
 * `docs/OFFENE_FUNDE_PLAN.md`): am Messkoerper 225 -> 222 Ziele, alle drei bereits ERFUELLT, 11 C
 * Abrechnungswirkung weg. Kein Test konnte das sehen, weil der Pfad nur beim Laden/Anwenden laeuft.
 *
 * Das Skript liest NUR. Es laedt einen Spielstand, ruft `refreshTeamObjectiveState` auf und
 * vergleicht die Schluesselmenge `teamId|objectiveId` der AKTUELLEN Saison vorher/nachher. Zu jedem
 * verlorenen und jedem neuen Ziel werden Status, Reward, Penalty und Source ausgegeben, dazu die
 * Kassenwirkung der verlorenen Ziele (completed-Reward minus failed-Penalty). Zusaetzlich wird die
 * Idempotenz gemessen: `refresh(refresh(s))` muss dasselbe liefern wie `refresh(s)`.
 *
 * Nutzung (immer auf einer KOPIE des Abbilds, nie auf einem gespielten Stand):
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/mess-ziel-refresh-stabilitaet.ts
 *   ... --save <saveId>   nur diesen Spielstand
 *   ... --alle            alle Spielstaende der Datenbank
 *
 * Abbild beschaffen: siehe CLAUDE.md ("An die Spielstaende kommen").
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import {
  buildTeamSeasonObjectiveSettlement,
  refreshTeamObjectiveState,
} from "@/lib/board/team-season-objectives-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let alle = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1];
      i += 1;
    }
    if (argv[i] === "--alle") alle = true;
  }
  return { saveId, alle };
}

const schluessel = (objective: TeamSeasonObjectiveRecord) => `${objective.teamId}|${objective.objectiveId}`;

function saisonZiele(gameState: GameState): TeamSeasonObjectiveRecord[] {
  return (gameState.seasonState.teamSeasonObjectives ?? []).filter(
    (objective) => objective.seasonId === gameState.season.id,
  );
}

function kassenwirkung(objectives: TeamSeasonObjectiveRecord[]) {
  // Dieselbe Rechnung wie `buildTeamSeasonObjectiveSettlement`: Sponsor-Spiegel zahlen nicht.
  return objectives.reduce((summe, objective) => {
    if ((objective.source ?? "").includes("sponsor_v2_contract")) return summe;
    if (objective.status === "completed") return summe + (objective.rewardCash ?? 0);
    if (objective.status === "failed") return summe - (objective.penaltyCash ?? 0);
    return summe;
  }, 0);
}

const quellen = (objective: TeamSeasonObjectiveRecord) =>
  (objective.source ?? "").split("+").map((entry) => entry.trim()).filter(Boolean);

/**
 * Zwei Bewegungen sind KEIN Verlust, sondern die definierten Ereignis-Zugaenge bzw. -Abgaenge:
 * mit der Sponsor-Unterschrift wird der Platzhalter „Sponsor-Vertrag waehlen" zurueckgezogen und die
 * drei Vertrags-Komponenten kommen dazu; faellt das Vorstandsvertrauen unter 5,0, kommt die
 * Budget-Kuerzung dazu. Alles andere waere Wobbeln.
 */
const istDefiniertesEreignis = (objective: TeamSeasonObjectiveRecord) =>
  quellen(objective).some((quelle) =>
    ["sponsor_v2_choice_pending", "sponsor_v2_contract", "human_board_confidence_penalty"].includes(quelle),
  );

function zeile(objective: TeamSeasonObjectiveRecord) {
  const teile = [
    `status=${objective.status}`,
    objective.rewardCash != null ? `reward=${objective.rewardCash}` : null,
    objective.penaltyCash != null ? `penalty=${objective.penaltyCash}` : null,
    `source=${objective.source ?? "—"}`,
  ].filter(Boolean);
  return `${schluessel(objective)}  (${teile.join(", ")})`;
}

function messeEinenSave(gameState: GameState, saveId: string): boolean {
  const vorher = saisonZiele(gameState);
  const nachGameState = refreshTeamObjectiveState(gameState);
  const nachher = saisonZiele(nachGameState);

  const vorherMap = new Map(vorher.map((objective) => [schluessel(objective), objective] as const));
  const nachherMap = new Map(nachher.map((objective) => [schluessel(objective), objective] as const));
  const wegAlle = vorher.filter((objective) => !nachherMap.has(schluessel(objective)));
  const neuAlle = nachher.filter((objective) => !vorherMap.has(schluessel(objective)));
  const weg = wegAlle.filter((objective) => !istDefiniertesEreignis(objective));
  const neu = neuAlle.filter((objective) => !istDefiniertesEreignis(objective));
  const ereignisse = [...wegAlle, ...neuAlle].filter(istDefiniertesEreignis);

  console.log(`\n=== ${saveId}  (Saison ${gameState.season.id}) ===`);
  console.log(`Ziele der Saison: ${vorher.length} -> ${nachher.length}   weg=${weg.length}  neu=${neu.length}`);

  if (weg.length > 0) {
    console.log(`  VERLOREN (Kassenwirkung ${kassenwirkung(weg).toFixed(1)} C):`);
    for (const objective of weg) console.log(`    - ${zeile(objective)}`);
  }
  if (neu.length > 0) {
    console.log("  NEU:");
    for (const objective of neu) console.log(`    + ${zeile(objective)}`);
  }
  if (ereignisse.length > 0) {
    console.log(`  definierte Ereignisse (kein Wobbeln, Kassenwirkung ${kassenwirkung(ereignisse).toFixed(1)} C):`);
    for (const objective of ereignisse) {
      console.log(`    ${nachherMap.has(schluessel(objective)) ? "+" : "-"} ${zeile(objective)}`);
    }
  }
  const eingefroren = nachher.filter((objective) => quellen(objective).includes("status_stale"));
  if (eingefroren.length > 0) {
    console.log(`  eingefroren (status_stale): ${eingefroren.length}`);
  }

  // Statuswechsel bei erhalten gebliebenen Zielen (kein Fehler, aber der Grund fuer Abwahl).
  const statusWechsel = vorher.filter((objective) => {
    const danach = nachherMap.get(schluessel(objective));
    return danach != null && danach.status !== objective.status;
  });
  if (statusWechsel.length > 0) {
    console.log(`  Statuswechsel (erhalten): ${statusWechsel.length}`);
  }

  // Abrechnungswirkung ueber den gesamten Bestand — die Zahl, die der Spieler am Saisonende sieht.
  const settlementVorher = buildTeamSeasonObjectiveSettlement(gameState).totals.cashDelta;
  const settlementNachher = buildTeamSeasonObjectiveSettlement(nachGameState).totals.cashDelta;
  console.log(`  Settlement gesamt: ${settlementVorher.toFixed(1)} C -> ${settlementNachher.toFixed(1)} C`);

  // Idempotenz: der zweite Refresh darf nichts mehr bewegen — auch die Ereignis-Zugaenge nicht.
  const zweimal = saisonZiele(refreshTeamObjectiveState(nachGameState));
  const zweimalMap = new Map(zweimal.map((objective) => [schluessel(objective), objective] as const));
  const idempotentSchluessel =
    zweimal.length === nachher.length && nachher.every((objective) => zweimalMap.has(schluessel(objective)));
  const idempotentStatus =
    idempotentSchluessel && nachher.every((objective) => zweimalMap.get(schluessel(objective))?.status === objective.status);
  console.log(
    `  Idempotenz refresh(refresh(s)): Schluessel ${idempotentSchluessel ? "ok" : "VERLETZT"}, Status ${
      idempotentStatus ? "ok" : "VERLETZT"
    } (${nachher.length} -> ${zweimal.length})`,
  );

  return weg.length === 0 && neu.length === 0 && idempotentSchluessel && idempotentStatus;
}

async function main() {
  const { saveId: gewaehlt, alle } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();

  const saveIds: string[] = alle
    ? persistence.listSaves().map((save) => save.saveId)
    : (() => {
        const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
        return save ? [save.saveId] : [];
      })();

  if (saveIds.length === 0) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH pruefen.");
    process.exit(2);
    return;
  }

  console.log(`Abbild: ${process.env.OLY_APP_SQLITE_PATH ?? "(Standardpfad)"}`);
  let allesStabil = true;
  for (const id of saveIds) {
    const save = persistence.getSaveById(id);
    if (!save) {
      console.log(`\n=== ${id} === nicht ladbar, uebersprungen`);
      continue;
    }
    if (!messeEinenSave(save.gameState, id)) allesStabil = false;
  }

  console.log(`\nErgebnis: ${allesStabil ? "STABIL (weg=0, neu=0, idempotent)" : "INSTABIL — siehe oben"}`);
  process.exit(allesStabil ? 0 : 1);
}

void main();

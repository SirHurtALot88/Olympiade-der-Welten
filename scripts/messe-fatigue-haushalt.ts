/* eslint-disable no-console */
/**
 * DER FATIGUE-HAUSHALT EINER LIGA — Last, Erholung, Kadertiefe und Gebäude in EINEM Lauf.
 *
 * Chris' Auftrag zu `ne85u5`: „Training Fatigue verbrauch rebalancing prüfen und die gebäude. so
 * dass man mal alles in einem rutsch prüft misst und anschließend einen vorschlag macht."
 *
 * DIE EINE GLEICHUNG, um die es geht. Erholung bekommt NUR, wer an einem Spieltag NICHT eingesetzt
 * wird (`applyMatchdayRecovery`, fatigue-injury-service.ts: `if (usedPlayerKeys.has(usedKey) &&
 * !view.isUnavailable) continue;`). Wer spielt, bekommt Last und keine Erholung. Bei einer
 * Einsatzquote `q` ändert sich die Fatigue je Spieltag also um
 *
 *     Δ = q × Last − (1 − q) × Erholung
 *
 * und steht still bei
 *
 *     q* = Erholung / (Last + Erholung)
 *
 * Über q* steigt die Fatigue jeden Spieltag weiter, bis der Deckel 100 greift. Genau das ist die
 * Frage hinter „je später wir in der saison unterwegs sind desto mehr verletzungen gibt es".
 *
 * Die Einsatzquote ist KEINE Einstellung, sie folgt aus Spielplan und Kader: `q = Slots je
 * Spieltag / Kadergröße`. Deshalb misst dieses Skript beides zusammen.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-fatigue-haushalt.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  BASE_MATCHDAY_RECOVERY,
  MATCHDAY_FATIGUE_LOAD,
  calculateTeamRecovery,
} from "@/lib/fatigue/fatigue-injury-service";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { DEFAULT_ROSTER_MAX } from "@/lib/foundation/roster-limits";

function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  return sortiert[Math.floor(sortiert.length / 2)]!;
}

const gleichgewicht = (last: number, erholung: number) => erholung / (last + erholung);

const p = createPersistenceService();

console.log("═══ Die Stellschrauben, wie sie im Code stehen ═══");
console.log(`  Last je Einsatz          ${MATCHDAY_FATIGUE_LOAD}   (× Trait-Faktor × Intensität 0,75 / 1,0 / 1,4)`);
console.log(`  Erholung je Ruhetag      ${BASE_MATCHDAY_RECOVERY}   (Basis, plus Recovery Center und Trainingsmodus)`);
console.log(`  Kader-Obergrenze         ${DEFAULT_ROSTER_MAX}`);
console.log(
  `  GLEICHGEWICHTS-QUOTE     ${(gleichgewicht(MATCHDAY_FATIGUE_LOAD, BASE_MATCHDAY_RECOVERY) * 100).toFixed(1)} %  — darüber steigt die Fatigue jeden Spieltag\n`,
);

console.log("═══ Je Spielstand ═══");
console.log(
  "Stand    MD  Slots  Kader  Einsatz-  Δ/MD    Kader für   Recovery-Center      Erholung",
);
console.log(
  "                          quote                Gleichgew.  (Stufe: Teams)      min/med/max",
);

for (const eintrag of p.listSaves()) {
  const gameState = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gameState?.teams?.length) continue;

  const plan = (gameState.seasonState.disciplineSchedule ?? []) as Array<{
    discipline1?: { playerCount?: number | null };
    discipline2?: { playerCount?: number | null };
  }>;
  if (plan.length === 0) continue;

  const slots = median(plan.map((zeile) => (zeile.discipline1?.playerCount ?? 0) + (zeile.discipline2?.playerCount ?? 0)));
  const kader = median(gameState.teams.map((team) => gameState.rosters.filter((entry) => entry.teamId === team.teamId).length));

  const erholungen = gameState.teams.map((team) => calculateTeamRecovery(gameState, team.teamId).normalRecovery);
  const stufen = new Map<number, number>();
  for (const team of gameState.teams) {
    const stufe = getFacilityLevel(getTeamFacilityState(gameState, team.teamId), "recovery_center");
    stufen.set(stufe, (stufen.get(stufe) ?? 0) + 1);
  }

  const q = kader > 0 ? Math.min(1, slots / kader) : 1;
  const erholungMedian = median(erholungen);
  const delta = q * MATCHDAY_FATIGUE_LOAD - (1 - q) * erholungMedian;
  const noetig = Math.ceil(slots / gleichgewicht(MATCHDAY_FATIGUE_LOAD, erholungMedian));
  const verteilung = [...stufen.entries()]
    .sort((links, rechts) => links[0] - rechts[0])
    .map(([stufe, anzahl]) => `${stufe}:${anzahl}`)
    .join(" ");

  console.log(
    `${String(eintrag.saveId).slice(-6)}  ${String(gameState.season?.currentMatchday ?? "?").padStart(2)}  ` +
      `${String(slots).padStart(5)}  ${String(kader).padStart(5)}  ${(q * 100).toFixed(0).padStart(6)} %  ` +
      `${delta >= 0 ? "+" : ""}${delta.toFixed(1).padStart(5)}  ${String(noetig).padStart(10)}   ${verteilung.padEnd(18)}  ` +
      `${Math.min(...erholungen).toFixed(0)}/${erholungMedian.toFixed(0)}/${Math.max(...erholungen).toFixed(0)}`,
  );
}

console.log(
  "\nΔ/MD ist der rechnerische Fatigue-Zuwachs je Spieltag bei dieser Einsatzquote. Positiv heißt:\n" +
    "die Liga läuft in den Deckel, und zwar unabhängig davon, wie gut die KI rotiert.",
);

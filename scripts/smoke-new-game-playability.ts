/* eslint-disable no-console */
/**
 * Smoke: Ist ein FRISCH ERSTELLTES Spiel wirklich spielbar?
 *
 * Hintergrund: Neue Spiele wurden zeitweise in `preseason_management` angelegt — eine
 * Sackgasse, aus der ein brandneues Spiel bei S1/MD1 nicht herauskam
 * (`phase_blocked:set_lineup`), sodass man nie zur Arena kam. Dieses Skript prüft den
 * kompletten Einstiegspfad einmal durch, damit so ein Dead-End nicht unbemerkt zurückkehrt.
 *
 * Geprüft wird (ohne jede Schreiboperation, rein in-memory):
 *  1. Ein neues Spiel lässt sich aus der Baseline bauen.
 *  2. Es startet in `season_active`, Saison 1, Spieltag 1 (offener Spieltag = Saisonstart-Setup).
 *  3. Die Arena ist erreichbar: `set_lineup` ist NICHT phasen-blockiert.
 *  4. Das Saisonstart-Setup bleibt offen: Kaufen/Training/Sponsor erlaubt, Transferfenster offen.
 *     Verkaufen ist hier bewusst GESPERRT — das gehoert ans Saisonende.
 *  5. Sponsor-Angebote sind für das menschliche Team vorhanden (sonst hängt "Sponsor wählen").
 *  6. Der Flow hat keine Sackgasse: es gibt immer einen nicht-blockierten nächsten Schritt.
 *  7. Ab Minimum-Kader (7) gilt `fill_roster` als erledigt (kein ewiges "Kader auffüllen").
 *  8. Die Trainings-Engine liefert ein Budget > 0 (Regression: "überall 0 SP" im Trainings-Tab).
 *
 * Nutzung:  npx tsx scripts/smoke-new-game-playability.ts
 * Exit-Code 0 = alles grün, 1 = mindestens ein Check rot.
 */
import { loadEnvConfig } from "@next/env";

import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import type { GameState } from "@/lib/data/olyDataTypes";

loadEnvConfig(process.cwd());

let failures = 0;

function check(label: string, ok: boolean, detail: string) {
  const mark = ok ? "OK  " : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  console.log("Smoke: Neues Spiel — Spielbarkeit\n");

  // 1) Neues Spiel bauen (Solo 1, ein menschliches Team).
  const { gameState, preview } = buildNewGameStateFromBaseline({
    presetId: "solo_1",
    now: "2026-06-13T10:00:00.000Z",
  });
  const humanTeamId = preview.chrisTeamIds[0] ?? null;
  check("Neues Spiel erstellt", Boolean(gameState) && Boolean(humanTeamId), `Team ${humanTeamId ?? "—"}, ${gameState.teams.length} Teams`);
  if (!humanTeamId) {
    console.log("\nAbbruch: kein menschliches Team im Preview.");
    process.exit(1);
  }

  // 2) Startphase: offener Spieltag 1 statt Vorsaison-Sackgasse.
  check("Startphase season_active", gameState.gamePhase === "season_active", `gamePhase=${gameState.gamePhase}`);
  check("Saison 1 / Spieltag 1", gameState.season.id === "season-1" && gameState.season.currentMatchday === 1, `${gameState.season.id} MD${gameState.season.currentMatchday}`);
  check("Spieltag nicht aufgelöst", gameState.matchdayState.status !== "resolved", `status=${gameState.matchdayState.status}`);

  // 3) DER kritische Check: Arena erreichbar.
  const lineupGate = evaluateGamePhaseAction(gameState, "set_lineup");
  check("Einsatzliste/Arena erreichbar", lineupGate.allowed, lineupGate.allowed ? "set_lineup erlaubt" : `blockiert: ${lineupGate.reason}`);

  // 4) Saisonstart-Setup bleibt offen — als KAUFPHASE.
  // Verkaufen gehoert ans Saisonende, nicht hierher (`transfer-window-policy`): der Saisonstart
  // oeffnet nur das Kaufen. Beide Richtungen werden geprueft, damit weder das Kaufen zufaellt
  // noch das Verkaufen wieder mit aufgeht.
  const buyGate = evaluateGamePhaseAction(gameState, "buy_players");
  check("Setup-Aktion buy_players", buyGate.allowed, buyGate.allowed ? "erlaubt" : `blockiert: ${buyGate.reason}`);
  const sellGate = evaluateGamePhaseAction(gameState, "sell_players");
  check("Verkaufen im Saisonstart gesperrt", !sellGate.allowed, sellGate.allowed ? "OFFEN — gehoert ans Saisonende!" : `gesperrt: ${sellGate.reason}`);
  const window = getTransferWindowStatus(gameState);
  check("Transferfenster offen", Boolean(window?.open), `label=${window?.label ?? "—"}`);

  // 5) Sponsor-Angebote vorhanden.
  const offers = getTeamSponsorOffers(gameState, humanTeamId);
  check("Sponsor-Angebote vorhanden", offers.length > 0, `${offers.length} Angebote`);

  // 6) Flow ohne Sackgasse.
  const flow = buildGameFlowState({ gameState, activeTeamId: humanTeamId });
  const actionable = flow.steps.filter((entry) => entry.status !== "blocked" && entry.status !== "completed");
  check(
    "Flow hat einen offenen, nicht blockierten Schritt",
    actionable.length > 0,
    actionable.length > 0 ? `nächster: ${flow.currentStep?.stepId ?? "—"} (${actionable.length} offen)` : "ALLE Schritte blockiert/erledigt — Sackgasse!",
  );

  // 7) fill_roster gilt ab Minimum-Kader als erledigt.
  const squad = gameState.players.slice(0, 9);
  const withRoster: GameState = {
    ...gameState,
    rosters: squad.map((entry, index) => ({
      id: `smoke-roster-${index}`,
      teamId: humanTeamId,
      playerId: entry.id,
      salary: 5,
      marketValue: entry.marketValue ?? 10,
      contractLength: 2,
    })),
  } as GameState;
  const filledFlow = buildGameFlowState({ gameState: withRoster, activeTeamId: humanTeamId });
  const fillStep = filledFlow.steps.find((entry) => entry.stepId === "fill_roster");
  check(
    "fill_roster ab Minimum-Kader erledigt",
    !fillStep || fillStep.status === "completed",
    `9 Spieler im Kader → status=${fillStep?.status ?? "(Schritt nicht in dieser Phase)"}`,
  );

  // 8) Trainings-Engine liefert echtes Budget (nicht 0).
  const samplePlayer = gameState.players.find((entry) => entry.attributeSheetStats != null) ?? gameState.players[0];
  const progression = buildOrganicSeasonProgression({ gameState: withRoster, player: samplePlayer });
  check(
    "Trainingsbudget > 0",
    progression.trainingSetpoints > 0,
    `setpoints=${progression.trainingSetpoints.toFixed(2)}, angewendet=${progression.appliedTrainingSetpoints.toFixed(2)}, spillover=${progression.spilloverSetpoints.toFixed(2)}`,
  );

  console.log(
    failures === 0
      ? "\nERGEBNIS: alles grün — ein neues Spiel ist startbar und bis zur Arena spielbar."
      : `\nERGEBNIS: ${failures} Check(s) rot — bitte oben ansehen.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();

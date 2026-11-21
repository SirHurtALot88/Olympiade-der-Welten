// ===================================================================================
// POSTFACH-BAU 21.11., AUFNAHME-AUFBAU: legt in einer KOPIE des live-save-Abbilds die Lage an, die die neuen Meldungen zeigen
// (Trainingswunsch, Wieder einsetzbar, Moral gekippt). Schreibt NUR in OLY_APP_SQLITE_PATH und bricht ab, wenn die Variable fehlt.
//
// AUFRUF: OLY_APP_SQLITE_PATH=<kopie.sqlite> npx tsx scripts/inbox-bau-21-11-aufbau.ts
// ===================================================================================
import { buildTeamPlayerTrainingLoadPlans } from "@/lib/ai/ai-player-training-load-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

if (!process.env.OLY_APP_SQLITE_PATH) {
  console.error("OLY_APP_SQLITE_PATH fehlt: dieses Skript schreibt nur in eine Kopie.");
  process.exit(1);
}
const SAVE = process.env.IB_SAVE ?? "new-game-1795114260527-nzr0z9";
const TEAM = process.env.IB_TEAM ?? "D-P";

const persistence = createPersistenceService();
const save = persistence.getSaveById(SAVE);
if (!save) throw new Error(`Spielstand ${SAVE} nicht gefunden`);
const gs = save.gameState;
const rosterIds = gs.rosters.filter((entry) => entry.teamId === TEAM).map((entry) => entry.playerId);
const verletzte = new Set((gs.seasonState.playerAvailabilityState ?? []).filter((a) => a.injuryStatus !== "healthy").map((a) => a.playerId));
const frei = rosterIds.filter((id) => !verletzte.has(id));
const plaene = buildTeamPlayerTrainingLoadPlans({ gameState: gs, teamId: TEAM, teamBaselineIntensity: "mittel" } as never);
// Wunsch: ein Spieler, der laut Spiel eine Intensität bevorzugt; sein Modus wird auf das Gegenteil gestellt.
const wunschPlan = plaene.find((plan) => plan.trainingDemandPreferred && frei.includes(plan.playerId));
if (!wunschPlan?.trainingDemandPreferred) throw new Error("kein Spieler mit Intensitätswunsch im Kader");
const wunschId = wunschPlan.playerId;
const rest = frei.filter((id) => id !== wunschId);
const [rueckkehrId, moralId] = rest;
if (!rueckkehrId || !moralId) throw new Error("zu wenige gesunde Spieler");

const matchdayIds = gs.season.matchdayIds ?? [];
const aktuell = matchdayIds.findIndex((id) => id === gs.matchdayState.matchdayId);
const vor1 = matchdayIds[aktuell - 1];
const vor2 = matchdayIds[aktuell - 2];
if (!vor1 || !vor2) throw new Error("zu früh in der Saison");

const players = gs.players.map((player) =>
  player.id === wunschId
    ? { ...player, trainingMode: wunschPlan.trainingDemandPreferred === "leicht" ? ("hart" as const) : ("leicht" as const) }
    : player,
);
const availability = (gs.seasonState.playerAvailabilityState ?? []).filter((a) => a.playerId !== rueckkehrId);
availability.push({
  playerId: rueckkehrId,
  teamId: TEAM,
  fatigue: 30,
  injuryStatus: "injured",
  injuredAtSeasonId: gs.season.id,
  injuredAtMatchdayId: vor2,
  injuryUntilMatchday: vor1,
});
const moral = (gs.playerMoraleState ?? []).filter((m) => m.playerId !== moralId);
moral.push({
  playerId: moralId,
  teamId: TEAM,
  morale: 18,
  visibleMood: "angry",
  lastUpdatedSeasonId: gs.season.id,
  reasons: [{ reasonId: "kein-einsatz", label: "Drei Spieltage ohne Einsatz", valueDelta: -9, source: "aufbau" }],
  contractIntent: "considering_exit",
  vorher: { morale: 45, matchdayId: vor1 },
});

persistence.saveSingleplayerState(SAVE, {
  ...gs,
  players,
  playerMoraleState: moral,
  seasonState: { ...gs.seasonState, playerAvailabilityState: availability },
});
const name = (id: string) => gs.players.find((p) => p.id === id)?.name ?? id;
console.log(`Wunsch: ${name(wunschId)} | Rückkehr: ${name(rueckkehrId)} | Moral: ${name(moralId)}`);

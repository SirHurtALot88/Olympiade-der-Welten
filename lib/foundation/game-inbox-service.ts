import type { GameFlowState, GameFlowStep } from "@/lib/foundation/game-flow-controller";
import { buildTeamPlayerTrainingLoadPlans, type AiTeamTrainingIntensity } from "@/lib/ai/ai-player-training-load-service";
import type {
  GameInboxItem,
  GameInboxSeverity,
  GameInboxStatus,
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamControlSettings,
} from "@/lib/data/olyDataTypes";
import { buildSeasonRecap } from "@/lib/foundation/season-recap-service";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
import { getInjuryRiskPercent, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { buildTeamControlSettingsMap, DEFAULT_ACTIVE_OWNER_ID, getTeamOwner } from "@/lib/foundation/team-control-settings";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilityIncome, calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { FACILITY_CONDITION_WARNING, getFacilityConditionStatus } from "@/lib/facilities/facility-condition";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";
import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { isTeamMatchdayLineupComplete, isTeamMatchdayLineupSubmitted } from "@/lib/foundation/matchday-lineup-readiness";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { listOpenSponsorEvents } from "@/lib/sponsor/sponsor-event-service";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { buildCaptainCandidateProfiles, hasPersistedTeamCaptain } from "@/lib/morale/team-captain-service";
import { buildContractDissolutionOffers, buildTeamMoraleMap } from "@/lib/morale/contract-dissolution-service";
import { isSeasonEndRosterPhase } from "@/lib/season/season-end-roster-window";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { FACILITY_CATALOG_BY_ID } from "@/lib/facilities/facility-catalog";
import { formatGamePhaseLabel } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import {
  MATCHDAY_PREP_BUNDLE_PREFIX,
  PLAYER_HEALTH_BUNDLE_PREFIX,
  bundleInboxItems,
} from "@/lib/foundation/inbox-bundling";

/**
 * Fruehere Fassung war eine EIGENE, handgepflegte Liste — und darum falsch: sie enthielt den
 * Alt-Bezeichner `training` (kein Reiter, kein Render-Zweig, Ziel fuehrte ins Leere) und kannte
 * `trainingCompact`/`trainingV2` gar nicht. Weil `GameInboxItem.targetView` als `string`
 * deklariert ist, hat der Compiler dazu nie etwas gesagt.
 *
 * Jetzt gilt die Liste der wirklich existierenden Views. Durchgesetzt wird sie in `createItem`
 * (s.u.) — dort meckert der Compiler bei jedem Ziel, das es nicht gibt.
 */
export type GameInboxTargetView = FoundationViewId;

export type BuildGameInboxInput = {
  gameState: GameState;
  saveId: string;
  activeTeamId?: string | null;
  activeOwnerId?: string | null;
  hostMode?: boolean;
  gameFlowState?: GameFlowState | null;
  now?: string;
};

export type GameInboxFilter = {
  teamId?: string | "ALL" | null;
  category?: string | "ALL" | null;
  includeDone?: boolean;
  includeDismissed?: boolean;
};

type OptionalRoomFlowState = {
  step?: string;
  requiredParticipantIds?: string[];
  completedParticipantIds?: string[];
};

function normalizeStatus(value: string | null | undefined): GameInboxStatus {
  return value === "done" || value === "dismissed" ? value : "open";
}

function severityRank(severity: GameInboxSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function formatInboxDetail(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return formatCockpitReason(value);
}

const INBOX_CHRONICLE_ONLY_SOURCES = new Set([
  "facility_events",
  "cash_prize_apply_logs",
  // "matchday_results" ist hier bewusst NICHT mehr aufgefuehrt: die Quelle erzeugt seit dem
  // Streichen von `matchday_result_available` keine Eintraege mehr (s. buildGlobalTasks). Der
  // Spieltag steht jetzt einmal als Recap in der Chronik, nicht zweimal.
  "season_snapshots",
  "transfer_history",
]);

export function isGameInboxChronicleOnlySource(source: string) {
  return INBOX_CHRONICLE_ONLY_SOURCES.has(source) || source.startsWith("story:");
}

export function groupInboxItemsForDisplay(items: GameInboxItem[]) {
  const groupedFacilities = new Map<string, GameInboxItem[]>();
  const passthrough: GameInboxItem[] = [];

  for (const item of items) {
    if (item.source === "facility_events") {
      const key = `${item.teamId ?? "global"}:${item.seasonId ?? "season"}`;
      const bucket = groupedFacilities.get(key) ?? [];
      bucket.push(item);
      groupedFacilities.set(key, bucket);
      continue;
    }
    passthrough.push(item);
  }

  const result = [...passthrough];

  for (const [key, group] of groupedFacilities) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const template = [...group].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]!;
    const facilityLabels = group
      .map((item) => item.description.replace(/: Level .+$/, ""))
      .slice(0, 3)
      .join(" · ");
    result.push({
      ...template,
      itemId: `grouped:facility_events:${key}`,
      title: `${group.length} Facility-Events`,
      description: `${group.length} Upgrades: ${facilityLabels}${group.length > 3 ? " · …" : ""}.`,
      createdAt: template.createdAt,
    });
  }

  const sorted = result.sort((left, right) => {
    const statusDelta = (left.status === "open" ? 0 : 1) - (right.status === "open" ? 0 : 1);
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  // Zuletzt zusammenfassen, was zusammengehoert (Aufstellungs-Schritte, Belastung je Spieler,
  // Scouting je Team). NACH dem Sortieren, damit die gebuendelte Karte den Platz ihrer lautesten
  // Einzelkarte einnimmt statt ans Ende zu rutschen.
  return bundleInboxItems(sorted);
}

function getStoredStatusMap(gameState: GameState) {
  return new Map((gameState.gameInboxItems ?? []).map((item) => [item.itemId, normalizeStatus(item.status)] as const));
}

// --- #43 Auto-Resolve: Bedingungs-Items ------------------------------
// Ein Teil der Inbox-"Aufgaben" ist in Wahrheit eine reine Bedingung, die
// der Spielstand selbst beantworten kann ("ist ein Lineup gesetzt?", "hat
// das Team einen Kapitän?", ...). Für diese Items wird `status`
// AUSSCHLIESSLICH live aus dem Spielstand abgeleitet (siehe die jeweiligen
// `createItem(...)`-Aufrufe unten, die `status: bedingungErfuellt ? "done"
// : "open"` setzen) — persistierter Status aus `gameState.gameInboxItems`
// wird für diese Item-Praefixe bewusst ignoriert. Ohne diese Sperre könnte
// ein alter "done"/"dismissed"-Eintrag (z.B. durch einen frueheren Klick auf
// "Erledigt", der die Bedingung NICHT tatsaechlich erfüllt) einen weiterhin
// unerfuellten Zustand verstecken — genau der Bug, den #43 behebt. Die Liste
// ist bewusst auf Items beschraenkt, deren Erfuellung 1:1 aus vorhandenen
// Spielstand-Feldern lesbar ist; Items, die eine echte Nutzer-ENTSCHEIDUNG
// brauchen (z.B. welchen Spieler man verkauft, ob man jetzt Facility X
// upgradet), bleiben aussen vor und behalten den bisherigen Mechanismus.
const AUTO_RESOLVING_INBOX_ITEM_PREFIXES = new Set<string>([
  // Die gebuendelte Spieltags-Karte fasst drei Bedingungs-Items zusammen und ist damit selbst eine
  // Bedingung: sie loest sich auf, sobald alle drei Schritte erfuellt sind. Ohne diesen Eintrag
  // stuenden auf ihr "Erledigt"/"Ausblenden" — Knoepfe, die einen unerfuellten Zustand verstecken
  // koennten, genau der Fehler aus #43.
  MATCHDAY_PREP_BUNDLE_PREFIX,
  "lineup_missing",
  "lineup_not_submitted",
  "formcards_open",
  "formcards_negative_open",
  "captain_missing",
  "sponsor_choice_missing",
  "training_missing",
  "preseason_step_open",
  "room_waiting",
  "flow",
  "board_objective_at_risk",
  "board_objective_failed",
]);

function getInboxItemIdPrefix(itemId: string): string {
  const separatorIndex = itemId.indexOf(":");
  return separatorIndex === -1 ? itemId : itemId.slice(0, separatorIndex);
}

/** True für Items, deren `status` live aus dem Spielstand abgeleitet wird (siehe oben). */
export function isAutoResolvingInboxItemId(itemId: string): boolean {
  return AUTO_RESOLVING_INBOX_ITEM_PREFIXES.has(getInboxItemIdPrefix(itemId));
}

// --- #44 Wiederkehrend vs. einmalig -----------------------------------
// Rein informatives Tagging für die UI (kein Save-Feld, nur aus dem
// itemId-Praefix abgeleitet): wiederkehrende Reminder (tauchen jeden
// Spieltag/immer wieder auf) vs. einmalige Setup-Aufgaben pro Saison.
const RECURRING_INBOX_ITEM_PREFIXES = new Set<string>([
  MATCHDAY_PREP_BUNDLE_PREFIX,
  PLAYER_HEALTH_BUNDLE_PREFIX,
  "lineup_missing",
  "lineup_not_submitted",
  "training_missing",
  "xp_available",
  "contracts_expiring",
  "transfer_candidate",
  "transfer_buy_candidate",
  "facility_condition_low",
  "facility_upkeep_risk",
  "facility_upgrade_possible",
  "player_injured",
  "player_fatigue_risk",
  "player_lineup_rest",
  "player_training_load",
  "board_objective_at_risk",
  "board_objective_failed",
  "scout_milestone",
  "room_waiting",
  "formcards_negative_open",
]);

const ONE_TIME_INBOX_ITEM_PREFIXES = new Set<string>([
  "captain_missing",
  "sponsor_choice_missing",
  "formcards_open",
  "preseason_step_open",
]);

export type InboxItemCadence = "recurring" | "once" | null;

/** "recurring" (taucht regelmäßig wieder auf), "once" (Setup-Aufgabe pro Saison) oder null (kein Tag). */
export function getInboxItemCadence(itemId: string): InboxItemCadence {
  const prefix = getInboxItemIdPrefix(itemId);
  if (RECURRING_INBOX_ITEM_PREFIXES.has(prefix)) return "recurring";
  if (ONE_TIME_INBOX_ITEM_PREFIXES.has(prefix)) return "once";
  return null;
}

function withStoredStatus(item: GameInboxItem, storedStatusById: Map<string, GameInboxStatus>): GameInboxItem {
  if (isAutoResolvingInboxItemId(item.itemId)) {
    return item;
  }
  return {
    ...item,
    status: storedStatusById.get(item.itemId) ?? item.status,
  };
}

function resolvePlayerDisplayName(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId)?.name ?? playerId;
}

/**
 * GEMELDET: „matchday-10: +3 Plätze" — der rohe Bezeichner stand im Nachrichtentext.
 *
 * Der Spieler kennt „Spieltag 10". Die Nummer ist die Position im Saison-Spielplan, dieselbe
 * Rechnung wie in `player-injury-history.ts`. Ist der Spieltag nicht im Plan (Altstand, fremde
 * Saison), bleibt der Bezeichner stehen — falsch nummerieren waere schlimmer als gar nicht.
 */
function resolveMatchdayDisplayLabel(gameState: GameState, matchdayId: string | null | undefined) {
  if (!matchdayId) return null;
  const index = gameState.season.matchdayIds?.findIndex((entry) => entry === matchdayId) ?? -1;
  return index >= 0 ? `Spieltag ${index + 1}` : matchdayId;
}

/** Anzeigename eines Gebaeudes; ohne ihn stand „fan_shop" in der Nachricht. */
function resolveFacilityDisplayName(facilityId: string) {
  return FACILITY_CATALOG_BY_ID[facilityId as keyof typeof FACILITY_CATALOG_BY_ID]?.label ?? facilityId;
}

function createItem(
  input: Omit<GameInboxItem, "saveId" | "seasonId" | "createdAt" | "status"> & {
    saveId: string;
    seasonId: string;
    createdAt: string;
    status?: GameInboxStatus;
    // Engt das `string`-Feld aus `GameInboxItem` auf existierende Views ein. Der Typ am Datensatz
    // bleibt `string` (dort haengt zu viel dran); die Einengung wirkt genau an der Stelle, an der
    // Ziele entstehen — und nur hier sind sie je falsch gewesen.
    targetView: GameInboxTargetView;
  },
): GameInboxItem {
  return {
    ...input,
    status: input.status ?? "open",
  };
}

function getVisibleTeamIds(input: BuildGameInboxInput, settingsMap: Record<string, TeamControlSettings>) {
  if (input.hostMode) {
    return new Set(input.gameState.teams.map((team) => team.teamId));
  }

  const activeOwnerId = input.activeOwnerId ?? DEFAULT_ACTIVE_OWNER_ID;
  const scenarioOwnership = input.gameState.scenarioMeta?.teamOwnership ?? [];
  if (scenarioOwnership.length > 0) {
    const ownedByScenario = scenarioOwnership
      .filter((ownership) => {
        if (activeOwnerId === DEFAULT_ACTIVE_OWNER_ID) {
          return ownership.userId === "user_chris" || ownership.ownerDisplayName === "Chris";
        }
        if (activeOwnerId === "franky_remote_placeholder") {
          return ownership.userId === "user_franky" || ownership.ownerDisplayName === "Franky";
        }
        if (activeOwnerId === "ai") {
          return ownership.controllerType === "ai";
        }
        return ownership.userId === activeOwnerId || ownership.participantId === activeOwnerId;
      })
      .map((ownership) => ownership.teamId);
    if (ownedByScenario.length > 0) {
      return new Set(ownedByScenario);
    }
  }

  return new Set(
    input.gameState.teams
      .filter((team) => getTeamOwner(settingsMap[team.teamId]) === activeOwnerId)
      .map((team) => team.teamId),
  );
}

function getTeamRosterPlayerIds(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

function getPlayerName(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId)?.name ?? playerId;
}


function teamTrainingMissingCount(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return getTeamRosterPlayerIds(gameState, teamId).filter((playerId) => playersById.get(playerId)?.trainingMode == null).length;
}

function resolveTeamTrainingBaselineIntensity(gameState: GameState, teamId: string): AiTeamTrainingIntensity {
  const settings = gameState.seasonState.aiManagerTrainingSettings?.[teamId];
  if (settings?.trainingIntensity === "light") return "light";
  if (settings?.trainingIntensity === "hard") return "hard";
  return "normal";
}

/**
 * Spieler, die dem Team anbieten, ihren Vertrag aufzuloesen.
 *
 * Ohne diesen Hinweis sah man die Angebote nur, wenn man am Saisonende zufaellig in den
 * Kader schaute — bei einer Entscheidung mit Frist (wer nichts tut, behaelt den Spieler
 * samt seiner Unzufriedenheit) zu wenig.
 *
 * EIN Eintrag je Team, nicht einer je Spieler: die Entscheidungen stehen ohnehin
 * gesammelt im Kader, und drei unzufriedene Spieler sollen die Inbox nicht fluten.
 */
function buildContractDissolutionInboxTasks(input: {
  saveId: string;
  gameState: GameState;
  team: Team;
  roster: RosterEntry[];
  controlMode: string;
  createdAt: string;
}): GameInboxItem[] {
  // Nur fuer gesteuerte Teams und nur im Saisonende-Fenster — davor gibt es keine
  // Angebote, und die AI entscheidet ohne Inbox.
  if (input.controlMode !== "manual" || !isSeasonEndRosterPhase(input.gameState)) {
    return [];
  }

  const seasonId = input.gameState.season.id;
  // Moral aus derselben Quelle wie Profil und Kader-Ansicht — `buildContractDissolutionOffers`
  // leitet sie bewusst nicht selbst ab, damit die Zahlen nicht auseinanderlaufen. Die Bruecke
  // steht neben der Angebots-Funktion (`buildTeamMoraleMap`), damit Inbox, API-Route und
  // KI-Entscheidung nicht drei Kopien derselben Schleife pflegen.
  const offers = buildContractDissolutionOffers({
    gameState: input.gameState,
    teamId: input.team.teamId,
    seasonId,
    saveId: input.saveId,
    moraleByPlayerId: buildTeamMoraleMap(input.gameState, input.team.teamId),
  });
  if (offers.length === 0) {
    return [];
  }

  const names = offers.map((offer) => offer.playerName);
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length > 3 ? ` und ${names.length - 3} weitere` : "";

  return [
    createItem({
      itemId: `contract_dissolution_offer:${input.saveId}:${seasonId}:${input.team.teamId}`,
      saveId: input.saveId,
      seasonId,
      teamId: input.team.teamId,
      // Nur bei genau einem Angebot laesst sich der Eintrag einem Spieler zuordnen.
      playerId: offers.length === 1 ? offers[0].playerId : null,
      category: "warning",
      severity: "warning",
      title: offers.length === 1 ? "Spieler will seinen Vertrag auflösen" : `${offers.length} Spieler wollen ihren Vertrag auflösen`,
      description: `${shown}${rest}. Annehmen bringt den vollen Verkaufspreis und spart den Buyout; ablehnen kostet den Spieler weiter Moral.`,
      targetView: "teams",
      targetParams: { team: input.team.teamId },
      ctaLabel: "Im Kader entscheiden",
      source: "contract_dissolution_offer",
      createdAt: input.createdAt,
    }),
  ];
}

function buildPlayerHealthInboxTasks(input: {
  saveId: string;
  gameState: GameState;
  team: Team;
  roster: RosterEntry[];
  playerById: Map<string, Player>;
  controlMode: string;
  createdAt: string;
}) {
  if (input.controlMode !== "manual") {
    return [] as GameInboxItem[];
  }

  const items: GameInboxItem[] = [];
  const matchdayId = input.gameState.matchdayState.matchdayId;
  const seasonId = input.gameState.season.id;
  const teamBaselineIntensity = resolveTeamTrainingBaselineIntensity(input.gameState, input.team.teamId);
  const trainingPlans = buildTeamPlayerTrainingLoadPlans({
    gameState: input.gameState,
    teamId: input.team.teamId,
    teamBaselineIntensity,
  });
  const lineupRestPlayerIds = new Set<string>();

  for (const entry of input.roster) {
    const player = input.playerById.get(entry.playerId);
    if (!player) continue;

    const availability = getPlayerAvailabilityView(
      input.gameState,
      entry.playerId,
      input.team.teamId,
      matchdayId,
    );

    if (availability.isUnavailable && availability.injuryStatus === "injured") {
      // Ursache der Verletzung mitliefern (Feature-Request "man kann nicht sehn von wem man
      // verletzt wurde"): Es gibt keinen Verursacher — der persistierte Wurf (Fatigue beim
      // Wurf + Risikoprozent) IST die ganze Erklaerung. Ohne diesen Zusatz wirkte gerade der
      // Niedrig-Risiko-Fall (~2 %, Ruhetag davor) wie ein Fehler statt wie Pech.
      const lastRoll = availability.injuryRiskLastRoll;
      const causeDetail =
        lastRoll && lastRoll.result === "injured"
          ? ` Überlastung ohne Fremdeinwirkung: Der Einsatz würfelte bei Fatigue ${Math.round(lastRoll.fatigueBefore)} mit ${lastRoll.riskPercent} % Verletzungsrisiko.`
          : "";
      items.push(
        createItem({
          itemId: `player_injured:${input.saveId}:${seasonId}:${matchdayId}:${input.team.teamId}:${entry.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: entry.playerId,
          category: "warning",
          severity: "critical",
          title: "Verletzter Spieler",
          // `injuryUntilMatchday` ist ein Bezeichner („matchday-9"), kein Text fuer Menschen.
          description: `${getPlayerName(input.gameState, entry.playerId)} fehlt${
            availability.injuryUntilMatchday
              ? ` bis ${resolveMatchdayDisplayLabel(input.gameState, availability.injuryUntilMatchday)}`
              : ""
          }.${causeDetail}`,
          targetView: "lineup",
          targetParams: { team: input.team.teamId, player: entry.playerId },
          ctaLabel: "Lineup prüfen",
          source: "player_health_injury",
          createdAt: input.createdAt,
        }),
      );
      continue;
    }

    const fatigue = player.fatigue ?? availability.fatigue ?? 0;
    const riskPercent = getInjuryRiskPercent(fatigue);
    if (fatigue >= 70 || riskPercent >= 15) {
      items.push(
        createItem({
          itemId: `player_fatigue_risk:${input.saveId}:${seasonId}:${input.team.teamId}:${entry.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: entry.playerId,
          category: "training",
          severity: fatigue >= 80 || riskPercent >= 25 ? "critical" : "warning",
          title: fatigue >= 80 || riskPercent >= 25 ? "Hohes Verletzungsrisiko" : "Ermüdung beobachten",
          description: `${getPlayerName(input.gameState, entry.playerId)}: Fatigue ${Math.round(fatigue)}, Verletzungsrisiko ${riskPercent}%.`,
          // Trainingslast/Ermuedung steuert man im Training-Tab (trainingCompact).
          // "training" ist ein Alt-Bezeichner OHNE Navigationseintrag — das Ziel war unerreichbar.
          targetView: "trainingCompact",
          targetParams: { team: input.team.teamId, player: entry.playerId },
          ctaLabel: "Training prüfen",
          source: "player_health_fatigue_risk",
          createdAt: input.createdAt,
        }),
      );
    }
  }

  for (const plan of trainingPlans) {
    if (plan.needsLineupRest && !lineupRestPlayerIds.has(plan.playerId)) {
      lineupRestPlayerIds.add(plan.playerId);
      items.push(
        createItem({
          itemId: `player_lineup_rest:${input.saveId}:${seasonId}:${matchdayId}:${input.team.teamId}:${plan.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: plan.playerId,
          category: "warning",
          severity: "warning",
          title: "Spielpause empfohlen",
          description: `${plan.playerName}: hohe Belastung — für den nächsten Spieltag pausieren.`,
          targetView: "lineup",
          targetParams: { team: input.team.teamId, player: plan.playerId },
          ctaLabel: "Lineup prüfen",
          source: "player_health_lineup_rest",
          createdAt: input.createdAt,
        }),
      );
    }

    if (
      plan.trainingDemandPreferred === "hart" &&
      (plan.currentFatigue >= 55 || plan.currentInjuryRiskPercent >= 10)
    ) {
      items.push(
        createItem({
          itemId: `player_training_load:${input.saveId}:${seasonId}:${input.team.teamId}:${plan.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: plan.playerId,
          category: "training",
          severity: plan.projectedInjuryRiskPercent >= 20 ? "warning" : "info",
          title: "Hard-Training vs. Erholung",
          description: `${plan.playerName}: Hard-Demand unter Belastung (Fatigue ${Math.round(plan.currentFatigue)}, Modus ${plan.selectedMode}).`,
          // Trainingslast/Ermuedung steuert man im Training-Tab (trainingCompact).
          // "training" ist ein Alt-Bezeichner OHNE Navigationseintrag — das Ziel war unerreichbar.
          targetView: "trainingCompact",
          targetParams: { team: input.team.teamId, player: plan.playerId },
          ctaLabel: "Training steuern",
          source: "player_health_training_load",
          createdAt: input.createdAt,
        }),
      );
    }
  }

  return items;
}

function buildFlowItem(input: BuildGameInboxInput, createdAt: string): GameInboxItem | null {
  const step = input.gameFlowState?.currentStep;
  if (!step) return null;
  return createItem({
    itemId: `flow:${input.saveId}:${input.gameState.season.id}:${step.stepId}:${step.teamId ?? "global"}`,
    saveId: input.saveId,
    seasonId: input.gameState.season.id,
    matchday: input.gameState.matchdayState.matchdayId,
    teamId: step.teamId ?? input.activeTeamId ?? null,
    category: step.status === "blocked" ? "warning" : "task",
    severity: step.status === "blocked" ? "critical" : step.status === "warning" ? "warning" : "info",
    title: step.label,
    description: formatInboxDetail(step.blockers[0] ?? step.warnings[0] ?? step.cta),
    targetView: step.targetView,
    targetParams: {
      team: step.teamId ?? input.activeTeamId ?? null,
      panel: step.targetPanel ?? null,
    },
    source: "game_flow_controller",
    createdAt,
  });
}

function buildTeamTasks(input: BuildGameInboxInput, visibleTeamIds: Set<string>, createdAt: string) {
  const items: GameInboxItem[] = [];
  const settingsMap = buildTeamControlSettingsMap(input.gameState.teams, input.gameState.seasonState.teamControlSettings);
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));

  for (const team of input.gameState.teams) {
    if (!visibleTeamIds.has(team.teamId)) continue;

    const controlMode = settingsMap[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    const roster = input.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const rosterCount = roster.length;
    const rosterOptTarget = team.rosterOptTarget ?? team.rosterLimit ?? 12;
    const rosterMinTarget = team.rosterMinTarget ?? Math.max(10, rosterOptTarget - 2);
    const lineupDraft =
      (input.gameState.seasonState.lineupDrafts ?? []).find(
        (draft) =>
          draft.seasonId === input.gameState.season.id &&
          draft.matchdayId === input.gameState.matchdayState.matchdayId &&
          draft.teamId === team.teamId,
      ) ?? null;
    const lineupStatus = {
      hasLineup: isTeamMatchdayLineupComplete(input.gameState, team.teamId, lineupDraft),
      isSubmitted: isTeamMatchdayLineupSubmitted(lineupDraft),
    };
    if (rosterCount > 0 && controlMode === "manual") {
      const lineupSet = lineupStatus.hasLineup;
      items.push(
        createItem({
          itemId: `lineup_missing:${input.saveId}:${input.gameState.season.id}:${input.gameState.matchdayState.matchdayId}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: lineupSet ? "info" : team.teamId === input.activeTeamId ? "critical" : "warning",
          status: lineupSet ? "done" : "open",
          title: lineupSet ? "Lineup gesetzt" : "Lineup fehlt",
          // Anzeigename statt rohem Bezeichner („season-2-matchday-1") — gleiche Regel wie bei
          // den Ergebnis-Meldungen (`resolveMatchdayDisplayLabel`).
          description: lineupSet
            ? `${team.shortCode}: Einsatzliste für ${resolveMatchdayDisplayLabel(input.gameState, input.gameState.matchdayState.matchdayId)} ist gesetzt.`
            : `${team.shortCode}: Einsatzliste für ${resolveMatchdayDisplayLabel(input.gameState, input.gameState.matchdayState.matchdayId)} ist noch leer.`,
          targetView: "lineup",
          targetParams: { team: team.teamId },
          ctaLabel: "Lineup öffnen",
          source: "lineup_drafts",
          createdAt,
        }),
      );
    }

    const lineupComplete = lineupStatus.hasLineup;
    if (rosterCount > 0 && lineupComplete && controlMode === "manual") {
      const lineupSubmitted = lineupStatus.isSubmitted;
      items.push(
        createItem({
          itemId: `lineup_not_submitted:${input.saveId}:${input.gameState.season.id}:${input.gameState.matchdayState.matchdayId}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: lineupSubmitted ? "info" : team.teamId === input.activeTeamId ? "critical" : "warning",
          status: lineupSubmitted ? "done" : "open",
          title: lineupSubmitted ? "Lineup bestätigt" : "Lineup bestätigen",
          description: lineupSubmitted
            ? `${team.shortCode}: Einsatzliste ist bestätigt.`
            : `${team.shortCode}: Einsatzliste ist voll, aber noch nicht bestätigt.`,
          targetView: "lineup",
          targetParams: { team: team.teamId },
          ctaLabel: "Lineup bestätigen",
          source: "lineup_drafts",
          createdAt,
        }),
      );
    }
    const formCardFlow = getFormCardFlowStatus(input.gameState, team.teamId);
    if (rosterCount > 0 && lineupComplete && controlMode === "manual") {
      const formCardsReady = formCardFlow.hasPool;
      items.push(
        createItem({
          itemId: `formcards_open:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: formCardsReady ? "info" : "warning",
          status: formCardsReady ? "done" : "open",
          title: formCardsReady ? "Formkarten-Pool erstellt" : "Formkarten-Pool fehlt",
          description: formCardsReady
            ? `${team.shortCode}: Formkarten für diese Saison sind erzeugt.`
            : `${team.shortCode}: Formkarten für diese Saison müssen noch in der Einsatzliste erzeugt werden.`,
          targetView: "lineup",
          targetParams: { team: team.teamId, panel: "formcards" },
          ctaLabel: "Formkarten erzeugen",
          source: "season_formcards",
          createdAt,
        }),
      );
    }

    // Kapitän-Aufgabe schon anbieten, sobald der Kader das Ziel erreicht — die
    // Flow-Reihenfolge fragt den Kapitän vor dem Lineup, also nicht mehr erst
    // nach vollständigem Lineup nudgen (vorher: && lineupComplete).
    if (controlMode === "manual" && rosterCount >= rosterMinTarget) {
      const captainSet = hasPersistedTeamCaptain(input.gameState, team.teamId);
      items.push(
        createItem({
          itemId: `captain_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "task",
          severity: captainSet ? "info" : team.teamId === input.activeTeamId ? "warning" : "info",
          status: captainSet ? "done" : "open",
          title: captainSet ? "Kapitän ernannt" : "Kapitän ernennen",
          description: captainSet
            ? `${team.shortCode}: Saison-Kapitän ist gewählt.`
            : `${team.shortCode}: Kader ist vollständig — wähle einen Saison-Kapitän für Moral-Bonus.`,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "captain-picker" },
          ctaLabel: "Kapitän wählen",
          source: "team_captain_missing",
          createdAt,
        }),
      );

      // Hinweis "besserer Kapitän verfügbar": nur wenn bereits ein Kapitän gesetzt ist und
      // ein Kader-Spieler rein von den Werten deutlich stärker führen würde (Delta ≥ 8).
      if (captainSet) {
        const currentCaptain = (input.gameState.teamCaptains ?? []).find(
          (entry) => entry.seasonId === input.gameState.season.id && entry.teamId === team.teamId,
        );
        const bestCandidate = buildCaptainCandidateProfiles(input.gameState, team.teamId)[0] ?? null;
        if (
          currentCaptain &&
          bestCandidate &&
          bestCandidate.playerId !== currentCaptain.playerId &&
          bestCandidate.leadershipScore - currentCaptain.leadershipScore >= 8
        ) {
          items.push(
            createItem({
              itemId: `captain_upgrade:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
              saveId: input.saveId,
              seasonId: input.gameState.season.id,
              teamId: team.teamId,
              category: "task",
              severity: "info",
              status: "open",
              title: "Stärkerer Kapitän verfügbar",
              description: `${team.shortCode}: ${bestCandidate.playerName} hätte als Kapitän stärkere Führungswerte als ${currentCaptain.playerName}.`,
              targetView: "teams",
              targetParams: { team: team.teamId, panel: "captain-picker" },
              ctaLabel: "Kapitän prüfen",
              source: "team_captain_upgrade",
              createdAt,
            }),
          );
        }
      }
    }

    const formCardUsageAudit = buildFormCardSeasonUsageAudit(input.gameState, input.gameState.season.id).rows.find(
      (row) => row.teamId === team.teamId,
    );
    if (controlMode === "manual" && (formCardUsageAudit?.unusedNegativeCards ?? 0) > 0) {
      items.push(
        createItem({
          itemId: `formcards_negative_open:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: "warning",
          title: "Negative Formkarten offen",
          description: `${team.shortCode}: ${formCardUsageAudit!.unusedNegativeCards} negative Karte(n) ungenutzt — am Saisonende drohen ${formCardUsageAudit!.negativePenaltyPoints} Strafpunkte.`,
          targetView: "lineup",
          targetParams: { team: team.teamId, panel: "formcards" },
          ctaLabel: "Formkarten prüfen",
          source: "season_formcards",
          createdAt,
        }),
      );
    }

    if (controlMode === "manual") {
      const sponsorChosen = Boolean(getTeamSponsorContract(input.gameState, team.teamId));
      items.push(
        createItem({
          itemId: `sponsor_choice_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "sponsor",
          severity: sponsorChosen ? "info" : "warning",
          status: sponsorChosen ? "done" : "open",
          title: sponsorChosen ? "Sponsor gewählt" : "Sponsor wählen",
          description: sponsorChosen
            ? `${team.shortCode}: Sponsor-Vertrag für die Saison ist gewählt.`
            : `${team.shortCode}: Wähle einen von drei Sponsor-Verträgen für die Saison.`,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "sponsor-choice" },
          ctaLabel: "Sponsor wählen",
          source: "sponsor_v2_choice_pending",
          createdAt,
        }),
      );
    }

    for (const event of listOpenSponsorEvents(input.gameState, team.teamId)) {
      if (controlMode !== "manual") {
        continue;
      }
      items.push(
        createItem({
          itemId: event.eventId,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "sponsor",
          severity: event.cashDelta >= 0 ? "info" : "warning",
          title: event.eventType === "activation_bonus" ? "Sponsor-Aktion" : "Sponsor-Ereignis",
          description: event.message,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "sponsor-choice", sponsorEventId: event.eventId },
          ctaLabel: event.cashDelta >= 0 ? "Bonus annehmen" : "Ereignis prüfen",
          source: `sponsor_event:${event.eventType}`,
          createdAt: event.createdAt,
        }),
      );
    }

    const missingTraining = teamTrainingMissingCount(input.gameState, team.teamId);
    if (rosterCount > 0 && controlMode === "manual") {
      const trainingSet = missingTraining === 0;
      items.push(
        createItem({
          itemId: `training_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "training",
          severity: trainingSet ? "info" : "warning",
          status: trainingSet ? "done" : "open",
          title: trainingSet ? "Training gesetzt" : "Training nicht gesetzt",
          description: trainingSet
            ? `${team.shortCode}: Alle Spieler haben einen Trainingsmodus.`
            : `${team.shortCode}: ${missingTraining} Spieler ohne Trainingsmodus.`,
          // Trainingsmodus wird im Training-Tab (trainingCompact) gesetzt, nicht im
          // Gebäude-Tab (trainingV2) — sonst öffnet "Training öffnen" die Facilities.
          targetView: "trainingCompact",
          targetParams: { team: team.teamId, panel: "training-plan" },
          ctaLabel: "Training öffnen",
          source: "player_training_mode",
          createdAt,
        }),
      );
    }

    // XP-System abgeschafft: Der Inbox-Hinweis „XP verfügbar / XP ausgeben"
    // (gegated auf player.currentXP > 0) entfällt — Entwicklung läuft organisch.

    const expiring = roster.filter(
      (entry) => (entry.contractLength ?? 0) <= 1 || entry.contractStatus === "expiring" || entry.contractStatus === "renewal_pending",
    );
    if (expiring.length > 0) {
      items.push(
        createItem({
          itemId: `contracts_expiring:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "contract",
          severity: "warning",
          title: "Verträge laufen aus",
          description: `${team.shortCode}: ${expiring.length} Vertrag(e) brauchen Entscheidung.`,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "contracts" },
          ctaLabel: "Kader verwalten",
          source: "roster_contracts",
          createdAt,
        }),
      );
    }

    const transferWindowOpen = getTransferWindowStatus(input.gameState).open;
    const sellCandidates: Array<{ entry: typeof roster[number]; player: NonNullable<ReturnType<typeof playerById.get>>; profit: number; isExpiring: boolean }> = [];
    for (const entry of roster) {
        const player = playerById.get(entry.playerId);
        if (!player) continue;
        const purchase = entry.purchasePrice ?? player?.marketValue ?? 0;
        const current = entry.currentValue ?? player?.displayMarketValue ?? player?.marketValue ?? 0;
        const profit = current - purchase;
        const isExpiring = (entry.contractLength ?? 0) <= 1 || entry.contractStatus === "expiring" || entry.contractStatus === "renewal_pending";
        const pressureScore = (team.cash < 0 ? 2 : 0) + (profit >= 8 || current >= purchase * 1.2 ? 1 : 0) + (isExpiring ? 1 : 0);
        if (pressureScore >= 2) {
          sellCandidates.push({ entry, player, profit, isExpiring });
        }
    }
    const sellCandidate = sellCandidates.sort((left, right) => right.profit - left.profit)[0];
    if (transferWindowOpen && sellCandidate) {
      items.push(
        createItem({
          itemId: `transfer_candidate:${input.saveId}:${input.gameState.season.id}:${team.teamId}:${sellCandidate.entry.playerId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          playerId: sellCandidate.entry.playerId,
          category: "transfer",
          severity: team.cash < 0 ? "critical" : "warning",
          title: "Spieler verkaufen",
          description: `${sellCandidate.player.name}: ${sellCandidate.profit >= 0 ? "+" : ""}${sellCandidate.profit.toFixed(1)} MW-Puffer${sellCandidate.isExpiring ? ", Vertrag läuft aus" : ""}.`,
          targetView: "teams",
          targetParams: { team: team.teamId, player: sellCandidate.entry.playerId, panel: "roster" },
          ctaLabel: "Spieler prüfen",
          source: "roster_value_contract_cash",
          createdAt,
        }),
      );
    }

    if (transferWindowOpen && rosterCount > 0 && rosterCount < rosterOptTarget && team.cash >= 8) {
      items.push(
        createItem({
          itemId: `transfer_buy_candidate:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "transfer",
          severity: rosterCount < rosterMinTarget ? "warning" : "info",
          title: "Spieler kaufen",
          description: `${team.shortCode}: Kader ${rosterCount}/${team.rosterLimit} (Ziel ${rosterOptTarget}), Cash ${team.cash.toFixed(1)} — Transfermarkt prüfen.`,
          targetView: "market",
          targetParams: { team: team.teamId },
          ctaLabel: "Transfermarkt öffnen",
          source: "roster_cash_transfer_window",
          createdAt,
        }),
      );
    }

    const facilities = getTeamFacilityState(input.gameState, team.teamId);
    const wornFacility = FACILITY_CATALOG.map((facility) => {
      const state = facilities.facilities[facility.facilityId];
      return {
        facility,
        conditionPct: state?.conditionPct ?? 0,
        level: state?.level ?? 0,
      };
    }).find((entry) => entry.level > 0 && entry.conditionPct < FACILITY_CONDITION_WARNING);
    if (wornFacility) {
      const status = getFacilityConditionStatus(wornFacility.conditionPct);
      items.push(
        createItem({
          itemId: `facility_condition_low:${input.saveId}:${input.gameState.season.id}:${team.teamId}:${wornFacility.facility.facilityId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: status === "critical" || status === "broken" ? "critical" : "warning",
          title: "Gebäude-Zustand kritisch",
          description: `${team.shortCode}: ${wornFacility.facility.label} ist bei ${wornFacility.conditionPct}% und verliert Leistung.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude prüfen",
          source: "facility_condition_forecast",
          createdAt,
        }),
      );
    }
    const upkeep = calculateFacilityUpkeep(facilities);
    // Beliebtheit skaliert die Arena-Einnahme in der Cash-Risiko-Vorschau. Wir
    // nutzen bewusst computeTeamBeliebtheitFromGameState (bevorzugt den
    // persistierten, mean-revertenden seasonState.beliebtheitByTeamId-KPI), damit
    // die Warnung denselben arenaPopularityFactor sieht wie die echte
    // Season-End-Gutschrift (previewFacilitySeasonEndFinance) und die
    // Finanzansicht — sonst würde die Warnung ab Saison 2 mit einem anderen
    // Faktor rechnen und fälschlich (nicht) auslösen.
    const income = calculateFacilityIncome(facilities, {
      arenaPopularityFactor: computeTeamBeliebtheitFromGameState(input.gameState, team.teamId).value,
    });
    if (upkeep > 0 && team.cash + income - upkeep < 0) {
      items.push(
        createItem({
          itemId: `facility_upkeep_risk:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: "critical",
          title: "Facility-Unterhalt gefährdet",
          description: `${team.shortCode}: Cash reicht nach Facility-Netto voraussichtlich nicht.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude prüfen",
          source: "facility_finance_forecast",
          createdAt,
        }),
      );
    }

    const hasAffordableUpgrade = FACILITY_CATALOG.some((facility) => {
      const current = facilities.facilities[facility.facilityId]?.level ?? 0;
      const next = facility.levels.find((level) => level.level === current + 1);
      return next != null && team.cash >= next.upgradeCost;
    });
    if (hasAffordableUpgrade) {
      items.push(
        createItem({
          itemId: `facility_upgrade_possible:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: "info",
          title: "Facility Upgrade möglich",
          description: `${team.shortCode}: Mindestens ein Gebäude kann geprüft werden.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude upgraden",
          source: "facility_catalog_cash_check",
          createdAt,
        }),
      );
    }

    items.push(
      ...buildPlayerHealthInboxTasks({
        saveId: input.saveId,
        gameState: input.gameState,
        team,
        roster,
        playerById,
        controlMode,
        createdAt,
      }),
      ...buildContractDissolutionInboxTasks({
        saveId: input.saveId,
        gameState: input.gameState,
        team,
        roster,
        controlMode,
        createdAt,
      }),
    );
  }

  const objectiveOverview = buildTeamObjectiveOverview(input.gameState);
  for (const objective of objectiveOverview.objectives) {
    if (!visibleTeamIds.has(objective.teamId)) continue;
    if (objective.status !== "at_risk" && objective.status !== "failed") continue;
    items.push(
      createItem({
        itemId: `board_objective_${objective.status}:${input.saveId}:${objective.seasonId}:${objective.teamId}:${objective.objectiveId}`,
        saveId: input.saveId,
        seasonId: objective.seasonId,
        teamId: objective.teamId,
        category: "task",
        severity: objective.status === "failed" ? "critical" : "warning",
        // Das Ziel gehoert in den Titel: bei mehreren Board-Zielen entstanden sonst mehrere Karten
        // mit WORTGLEICHEM Titel, und was gemeint war, stand nur in der Kleinzeile.
        title:
          objective.status === "failed"
            ? `Board-Ziel verfehlt: ${objective.label}`
            : `Board-Ziel gefährdet: ${objective.label}`,
        /*
         * DER TITEL TAUGT NICHT FUER EINEN KNOPF. Er ist absichtlich lang (siehe darueber) und
         * beschreibt einen ZUSTAND. Auf der Weiter-Leiste stand er deshalb abgeschnitten:
         * „Weiter Board-Ziel verfehlt: For…" — gemessen 74 Zeichen, der Median aller
         * Knopf-Beschriftungen liegt bei 15.
         *
         * `ctaLabel` sagt stattdessen, was der Druck TUT. Zwei Formulierungen, weil ein
         * verfehltes Ziel nichts mehr zu retten hat und ein gefaehrdetes schon.
         */
        ctaLabel: objective.status === "failed" ? "Board-Ziele ansehen" : "Board-Ziel retten",
        description: `Aktuell ${objective.currentValue ?? "—"} · Ziel ${objective.targetValue ?? "—"}`,
        targetView: "teams",
        targetParams: { team: objective.teamId, panel: "board-objectives" },
        source: "team_season_objectives",
        createdAt,
      }),
    );
  }

  for (const teamId of visibleTeamIds) {
    const intelEntries = (input.gameState.seasonState.scoutIntelByTeamId?.[teamId] ?? []).filter(
      (entry) => entry.seasonId === input.gameState.season.id,
    );
    for (const entry of intelEntries) {
      const milestone = entry.certainty >= 75 ? 75 : entry.certainty >= 50 ? 50 : entry.certainty >= 25 ? 25 : null;
      if (milestone == null) continue;
      items.push(
        createItem({
          itemId: `scout_milestone:${input.saveId}:${input.gameState.season.id}:${teamId}:${entry.playerId}:${milestone}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId,
          playerId: entry.playerId,
          category: "transfer",
          severity: "info",
          title: "Scouting-Fortschritt",
          description: `${resolvePlayerDisplayName(input.gameState, entry.playerId)}: Certainty ${entry.certainty}% — Intel wird schärfer.`,
          targetView: "market",
          targetParams: { team: teamId, player: entry.playerId },
          source: "scout_intel_pipeline",
          createdAt,
        }),
      );
    }
  }

  return items;
}

function buildGlobalTasks(input: BuildGameInboxInput, createdAt: string) {
  const items: GameInboxItem[] = [];
  const seasonId = input.gameState.season.id;
  const matchdayId = input.gameState.matchdayState.matchdayId;

  /**
   * HIER STAND `matchday_result_available` („Spieltagsergebnis verfügbar") — samt der Suche nach
   * dem passenden `matchdayResult`, die nur diese eine Karte gefuettert hat.
   *
   * Ersatzlos gestrichen: derselbe Spieltag wurde ZWEIMAL gemeldet — einmal hier als „kann
   * angesehen werden" und einmal weiter unten als `matchday_recap`, der dasselbe Ziel oeffnet und
   * zusaetzlich sagt, WAS passiert ist (Rang, MVP, Verletzungen). Eine Karte, die nur ankuendigt,
   * dass es eine andere Karte gibt, ist kein Inhalt.
   */
  if (input.gameState.gamePhase === "season_completed" || input.gameState.gamePhase === "season_review") {
    items.push(
      createItem({
        itemId: `season_review_available:${input.saveId}:${seasonId}`,
        saveId: input.saveId,
        seasonId,
        category: "result",
        severity: "critical",
        title: "Season Review verfügbar",
        description: `${seasonId} ist abgeschlossen. Saisonrückblick prüfen.`,
        targetView: "cockpit",
        targetParams: { panel: "season-review" },
        source: "game_phase",
        createdAt,
      }),
    );
  }

  if (input.gameState.gamePhase && input.gameState.gamePhase !== "season_active") {
    items.push(
      createItem({
        itemId: `preseason_step_open:${input.saveId}:${seasonId}:${input.gameState.gamePhase}`,
        saveId: input.saveId,
        seasonId,
        category: "task",
        severity: "warning",
        title: "Pre-Season Schritt offen",
        /* Ohne diesen Handlungstext trug die Weiter-Leiste den Zustand statt der Handlung. */
        ctaLabel: "Pre-Season öffnen",
        // GEMELDET: „Aktuelle Phase: preseason_management." — der rohe Phasen-Bezeichner. Den
        // Klartextnamen gibt es laengst (`formatGamePhaseLabel`), er wurde hier nur nicht benutzt.
        description: `Aktuelle Phase: ${formatGamePhaseLabel(input.gameState.gamePhase)}.`,
        targetView: "cockpit",
        targetParams: { phase: input.gameState.gamePhase },
        source: "game_phase",
        createdAt,
      }),
    );
  }

  const flow = (input.gameFlowState as (GameFlowState & { roomFlowState?: OptionalRoomFlowState }) | null | undefined)?.roomFlowState;
  const requiredParticipantIds = flow?.requiredParticipantIds ?? [];
  const completedParticipantIds = flow?.completedParticipantIds ?? [];
  if (flow && requiredParticipantIds.length > completedParticipantIds.length) {
    const missing = requiredParticipantIds.filter((id) => !completedParticipantIds.includes(id));
    items.push(
      createItem({
        itemId: `room_waiting:${input.saveId}:${seasonId}:${flow.step ?? "unknown"}:${missing.join("-")}`,
        saveId: input.saveId,
        seasonId,
        matchday: matchdayId,
        category: "task",
        severity: "warning",
        title: "Mitspieler wartet / Ready fehlt",
        ctaLabel: "Runde prüfen",
        description: `${missing.length} Participant(s) fehlen im Step ${flow.step ?? "unknown"}.`,
        targetView: "cockpit",
        targetParams: { step: flow.step ?? "unknown" },
        source: "room_flow_state",
        createdAt,
      }),
    );
  }

	  for (const log of input.gameState.seasonState.preSeasonWorkflowLogs ?? []) {
	    const workflowText = [...log.errors, ...log.warnings, ...log.affectedEntities].join(" ");
	    if (/blocked|timeout|failed|error/i.test(log.status ?? "") || /blocked|timeout|failed|error/i.test(workflowText)) {
	      items.push(
	        createItem({
	          itemId: `ai_blocker:${input.saveId}:${log.logId}`,
	          saveId: input.saveId,
	          seasonId: log.toSeasonId ?? seasonId,
	          category: "warning",
	          severity: "critical",
	          title: "AI/Workflow Blocker",
	          ctaLabel: "Blocker ansehen",
	          description: `${log.stepId}: ${log.errors[0] ?? log.warnings[0] ?? log.status}`,
	          targetView: "cockpit",
	          targetParams: { step: log.stepId },
	          source: "preseason_workflow_logs",
	          createdAt: log.timestamp ?? createdAt,
	        }),
	      );
	    }
  }

  return items;
}

function buildNews(input: BuildGameInboxInput, visibleTeamIds: Set<string>, createdAt: string) {
  const items: GameInboxItem[] = [];
  const seasonId = input.gameState.season.id;
  const teamVisible = (teamId: string | null | undefined) => !teamId || visibleTeamIds.has(teamId) || input.hostMode;

  for (const transfer of input.gameState.transferHistory.slice(-12)) {
    const teamId = transfer.toTeamId ?? transfer.fromTeamId ?? null;
    if (!teamVisible(teamId)) continue;
    items.push(
      createItem({
        itemId: `transfer_news:${input.saveId}:${transfer.id}`,
        saveId: input.saveId,
        seasonId: transfer.seasonId ?? seasonId,
        matchday: transfer.matchdayId ?? null,
        teamId,
        playerId: transfer.playerId,
        category: "transfer",
        severity: "info",
        title: transfer.transferType === "buy" ? "Transfer gekauft" : "Transfer verkauft",
        description: `${transfer.playerId}: ${transfer.fee} Fee, ${transfer.salary} Gehalt.`,
        targetView: "history",
        targetParams: { team: teamId, player: transfer.playerId },
        source: "transfer_history",
        createdAt: transfer.happenedAt ?? createdAt,
      }),
    );
  }

  for (const event of input.gameState.seasonState.facilityEvents ?? []) {
    if (!teamVisible(event.teamId)) continue;
    // GEMELDET: „fan_shop: Level 1 → 1." Ein Ereignis ohne Stufenwechsel ist kein Ereignis —
    // es wurde bisher trotzdem gemeldet, weil hier nie geprueft wurde, ob sich etwas aendert.
    if (event.previousLevel === event.nextLevel) continue;
    const facilityName = resolveFacilityDisplayName(event.facilityId);
    items.push(
      createItem({
        itemId: `facility_news:${input.saveId}:${event.eventId}`,
        saveId: input.saveId,
        seasonId: event.seasonId ?? seasonId,
        teamId: event.teamId,
        category: "facility",
        severity: "info",
        title: `${facilityName} ${event.nextLevel > event.previousLevel ? "ausgebaut" : "zurückgestuft"}`,
        description: `${facilityName}: Stufe ${event.previousLevel} → ${event.nextLevel}.`,
        targetView: "trainingV2",
        targetParams: { team: event.teamId, panel: "facilities" },
        source: "facility_events",
        createdAt: event.timestamp ?? createdAt,
      }),
    );
  }

  /**
   * ÜBER `leseSaisonSchnappschuesse`, NICHT ÜBER `seasonSnapshots ?? []`.
   *
   * Die Inbox läuft im Browser (`useFoundationGameInboxItems`), und dort ist `seasonSnapshots`
   * hinter dem Sentinel IMMER eine leere Liste — `?? []` greift daran nicht. Die Champion-Karte
   * konnte deshalb nie entstehen. Nachgeladen wird das volle Archiv nur in ausgewählten Ansichten
   * (`use-season-archive-load`), und Home/Cockpit — wo die Inbox sitzt — gehören nicht dazu.
   * Am Live-Abbild gemessen: voll 261 Inbox-Karten, im Browser 224; es fehlten genau die eine
   * `champion_news` und 36 `story:season_recap`.
   */
  const latestCompletedSnapshot = [...leseSaisonSchnappschuesse(input.gameState)]
    .reverse()
    .find((snapshot) => snapshot.status === "completed");
  const champion = latestCompletedSnapshot?.finalStandings?.find((row) => row.rank === 1);
  if (latestCompletedSnapshot && champion) {
    items.push(
      createItem({
        itemId: `champion_news:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
        saveId: input.saveId,
        seasonId: latestCompletedSnapshot.seasonId,
        teamId: champion.teamId,
        category: "news",
        severity: "info",
        title: "Champion gekürt",
        description: `${champion.teamName ?? champion.teamId} gewinnt ${latestCompletedSnapshot.seasonName}.`,
        targetView: "cockpit",
        targetParams: { season: latestCompletedSnapshot.seasonId, panel: "season-review" },
        source: "season_snapshots",
        createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
      }),
    );
  }

  /**
   * SAISONENDE-RÜCKBLICK (`season-recap-service.ts`) — max. 6 Karten über die letzte abgeschlossene
   * Saison, im Bericht-Raum der Inbox.
   *
   * `source: "story:season_recap"` sorgt dafür, dass sie über `isGameInboxChronicleItem` automatisch
   * im dritten Raum landen („Berichte & Momente — Was ist passiert?") und nie im Handeln-Raum:
   * ein Rückblick ist nie eine Aufgabe.
   *
   * `teamId: null` bei den Liga-Karten ist nicht kosmetisch — `filterGameInboxItems` würde eine
   * Karte mit fremder `teamId` beim aktiven Team-Filter wegfiltern. Nur die persönliche
   * Zeugnis-Karte trägt eine, und die ist ohnehin für genau dieses Team gedacht.
   *
   * `createdAt` ist der Archivierungszeitpunkt des Snapshots, damit die Karten in der Sortierung
   * dorthin fallen, wo das Ereignis war, statt sich beim jedem Inbox-Aufbau nach oben zu schieben.
   */
  const recap = buildSeasonRecap({ gameState: input.gameState, eigeneTeamIds: visibleTeamIds });
  if (recap) {
    for (const entry of recap.entries) {
      if (entry.teamId && !teamVisible(entry.teamId)) continue;
      items.push(
        createItem({
          itemId: `season_recap:${input.saveId}:${recap.seasonId}:${entry.slot}:${entry.teamId ?? "liga"}`,
          saveId: input.saveId,
          seasonId: recap.seasonId,
          teamId: entry.teamId,
          category: "news",
          severity: "info",
          title: entry.title,
          description: entry.description,
          targetView: entry.targetView,
          targetParams: entry.targetParams,
          source: "story:season_recap",
          createdAt: recap.archivedAt,
        }),
      );
    }
  }

  for (const log of input.gameState.seasonState.cashPrizeApplyLogs ?? []) {
    // GEMELDET: „Preisgeld angewendet: — Teams, — Preisgeld." Ohne Payload hat die Karte nichts zu
    // sagen; sie zeigte nur ihre eigenen Platzhalter. Dann lieber gar keine Nachricht.
    const appliedTeams = log.payload?.appliedTeams;
    const totalPrizeMoney = log.payload?.totalPrizeMoney;
    if (appliedTeams == null && totalPrizeMoney == null) continue;
    const prizeMatchdayLabel = resolveMatchdayDisplayLabel(input.gameState, log.matchdayId);
    items.push(
      createItem({
        itemId: `prize_news:${input.saveId}:${log.id}`,
        saveId: input.saveId,
        seasonId: log.seasonId ?? seasonId,
        matchday: log.matchdayId ?? null,
        category: "finance",
        severity: "info",
        // GEMELDET VON CHRIS: „Preisgeld soll nicht ausgezahlt werden hab ich auch nie gesagt."
        // Die Karte hiess „Preisgeld ausgezahlt" und meldete damit eine Zahlung, die es nicht gibt:
        // die Preisgeld-Tabelle ist ein Vergleichswert (`CASH_PRIZE_BENCHMARK_ONLY`), Team-Cash
        // bleibt davon unberuehrt. Gebucht wird an dieser Stelle die Saisonabrechnung — Sponsorgeld
        // abzueglich Gehaelter, Apron, Gebaeude, Kreditraten und Vorstandsziele.
        title: prizeMatchdayLabel ? `Saisonabrechnung gebucht — ${prizeMatchdayLabel}` : "Saisonabrechnung gebucht",
        description: [
          appliedTeams != null ? `${appliedTeams} Teams` : null,
          totalPrizeMoney != null ? `Preisgeld-Vergleichswert ${totalPrizeMoney} (nicht ausgezahlt)` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        targetView: "prize",
        targetParams: { season: log.seasonId },
        source: "cash_prize_apply_logs",
        createdAt: log.createdAt ?? createdAt,
      }),
    );
  }

  const latestResult = [...(input.gameState.seasonState.matchdayResults ?? [])]
    .reverse()
    .find((result) => result.status === "preview_applied" && result.seasonId === seasonId);
  if (latestResult) {
    const summary = buildMatchdaySummary(input.gameState, { seasonId, matchdayId: latestResult.matchdayId });
    const recapMatchdayLabel =
      resolveMatchdayDisplayLabel(input.gameState, latestResult.matchdayId) ?? "Spieltag-Recap";
    const injuryEvents = (input.gameState.seasonState.injuryEvents ?? []).filter(
      (event) => event.seasonId === seasonId && event.matchdayId === latestResult.matchdayId && event.result === "injured",
    );

    for (const teamRow of summary.teamRows.filter((row) => teamVisible(row.teamId))) {
      const topPlayer = summary.topPlayers.find((player) => player.teamId === teamRow.teamId && player.rankInDiscipline === 1);
      const teamInjuries = injuryEvents.filter((event) => event.teamId === teamRow.teamId);
      const rankDetail =
        teamRow.rankDelta != null && teamRow.rankDelta !== 0
          ? `${teamRow.rankDelta > 0 ? "+" : ""}${teamRow.rankDelta} Platz${Math.abs(teamRow.rankDelta) === 1 ? "" : "e"}`
          : "Rang unverändert";
      const mvpDetail = topPlayer ? `MVP: ${topPlayer.playerName} (${topPlayer.disciplineName})` : "Kein MVP-Signal";
      const injuryDetail =
        teamInjuries.length > 0
          ? `${teamInjuries.length} Verletzung(en) nach Belastung`
          : "Keine neuen Verletzungen";

      items.push(
        createItem({
          itemId: `matchday_recap:${input.saveId}:${latestResult.id}:${teamRow.teamId}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: teamRow.teamId,
          category: "result",
          severity: teamInjuries.length > 0 ? "warning" : "info",
          // GEMELDET: „matchday-10: +3 Plätze" — der Bezeichner gehoert nicht in den Text.
          title: `${recapMatchdayLabel} — ${teamRow.teamShortCode}`,
          description: `${rankDetail} · ${mvpDetail} · ${injuryDetail}.`,
          targetView: "matchdayArena",
          targetParams: { team: teamRow.teamId, matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:matchday_recap",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }

    const mutatorBonusByTeam = new Map<string, number>();
    for (const perf of input.gameState.seasonState.playerDisciplinePerformances ?? []) {
      if (perf.matchdayResultId !== latestResult.id) continue;
      mutatorBonusByTeam.set(perf.teamId, (mutatorBonusByTeam.get(perf.teamId) ?? 0) + (perf.mutatorScoreBonus ?? 0));
    }
    const mutatorSwing = summary.teamRows
      .filter((row) => (row.rankDelta ?? 0) > 0 && (mutatorBonusByTeam.get(row.teamId) ?? 0) > 0 && teamVisible(row.teamId))
      .sort((left, right) => (right.rankDelta ?? 0) - (left.rankDelta ?? 0))[0];
    if (mutatorSwing) {
      items.push(
        createItem({
          itemId: `story_mutator_rank_swing:${input.saveId}:${latestResult.id}:${mutatorSwing.teamId}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: mutatorSwing.teamId,
          category: "news",
          severity: "info",
          title: "Story Card: Mutator kippt den Spieltag",
          description: `${mutatorSwing.teamShortCode} gewinnt dank Mutator-Bonus ${mutatorSwing.rankDelta} Platz/Plätze.`,
          targetView: "matchdayArena",
          targetParams: { team: mutatorSwing.teamId, matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:matchday_summary_mutator_bonus",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }

    const fencingWinner = (input.gameState.seasonState.disciplineResults ?? []).find((row) => {
      const disciplineName = input.gameState.disciplines.find((discipline) => discipline.id === row.disciplineId)?.name ?? row.disciplineId;
      return row.matchdayResultId === latestResult.id && row.rank === 1 && row.teamId === "C-S" && /fecht|fenc/i.test(disciplineName);
    });
    if (fencingWinner && teamVisible("C-S")) {
      items.push(
        createItem({
          itemId: `story_cold_steel_fencing:${input.saveId}:${latestResult.id}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: "C-S",
          category: "news",
          severity: "info",
          title: "Story Card: Cold Steel Präzision",
          description: `C-S dominiert ${input.gameState.disciplines.find((discipline) => discipline.id === fencingWinner.disciplineId)?.name ?? fencingWinner.disciplineId} mit Rang 1.`,
          targetView: "matchdayArena",
          targetParams: { team: "C-S", matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:discipline_result_rank_1",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }
  }

  const latestSnapshotRows = latestCompletedSnapshot?.finalStandings ?? [];
  const ccRow = latestSnapshotRows.find((row) => row.teamId === "C-C");
  if (latestCompletedSnapshot && ccRow && teamVisible("C-C")) {
    const sortedCash = [...latestSnapshotRows].map((row) => row.cashEnd ?? Number.NEGATIVE_INFINITY).sort((left, right) => right - left);
    const cashTopQuartile = sortedCash[Math.max(0, Math.floor(sortedCash.length / 4) - 1)] ?? Number.POSITIVE_INFINITY;
    if ((ccRow.cashEnd ?? 0) >= cashTopQuartile && (ccRow.rank ?? 99) <= 16) {
      items.push(
        createItem({
          itemId: `story_cash_creators_value:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
          saveId: input.saveId,
          seasonId: latestCompletedSnapshot.seasonId,
          teamId: "C-C",
          category: "news",
          severity: "info",
          title: "Story Card: Cash Creators effizient",
          description: `C-C bleibt reich und sportlich stabil: Rang ${ccRow.rank ?? "—"}, Cash ${ccRow.cashEnd ?? "—"}.`,
          targetView: "season",
          targetParams: { team: "C-C", season: latestCompletedSnapshot.seasonId },
          source: "story:season_snapshot_cash_rank",
          createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
        }),
      );
    }
  }

  const aaRow = latestSnapshotRows.find((row) => row.teamId === "A-A");
  if (latestCompletedSnapshot && aaRow && teamVisible("A-A") && (aaRow.rank ?? 99) <= 27 && (aaRow.cashEnd ?? 0) >= 0) {
    items.push(
      createItem({
        itemId: `story_armageddon_survival:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
        saveId: input.saveId,
        seasonId: latestCompletedSnapshot.seasonId,
        teamId: "A-A",
        category: "news",
        severity: "info",
        title: "Story Card: Survival geschafft",
        description: `A-A überlebt trotz engem Budget: Rang ${aaRow.rank ?? "—"}, Cash ${aaRow.cashEnd ?? "—"}.`,
        targetView: "season",
        targetParams: { team: "A-A", season: latestCompletedSnapshot.seasonId },
        source: "story:season_snapshot_survival",
        createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
      }),
    );
  }

  for (const event of (input.gameState.playerProgressionEvents ?? []).slice(-12)) {
    if (!teamVisible(event.teamId)) continue;
    const before = event.progressionSnapshotBefore?.disciplineRatings ?? {};
    const after = event.progressionSnapshotAfter?.disciplineRatings ?? {};
    const improvedCount = Object.entries(after).filter(([disciplineId, value]) => value > (before[disciplineId] ?? value)).length;
    if (improvedCount >= 3) {
      items.push(
        createItem({
          itemId: `story_xp_three_diszis:${input.saveId}:${event.eventId}`,
          saveId: input.saveId,
          seasonId: event.seasonId ?? seasonId,
          teamId: event.teamId,
          playerId: event.playerId,
          category: "news",
          severity: "info",
          title: "Story Card: Entwicklung zeigt Wirkung",
          description: `${getPlayerName(input.gameState, event.playerId)} verbessert ${improvedCount} Diszis durch Training.`,
          // "season-end-development" loest auf den Anker foundation-training-compact auf, das Panel
          // lebt also im Training-Tab (trainingCompact) — NICHT im Gebaeude-Tab (trainingV2).
          targetView: "trainingCompact",
          targetParams: { team: event.teamId, player: event.playerId, panel: "season-end-development" },
          source: "story:player_progression_discipline_delta",
          createdAt: event.timestamp ?? createdAt,
        }),
      );
    }
  }

  // --- Story Card: enges Rennen in der Live-Tabelle -----------------
  // Zwei benachbarte Ränge mit knappem Punktabstand — reale Standings-Daten
  // (`seasonState.standings`), kein erfundener Zustand. Nur der engste Fall
  // liga-weit wird als Karte erzeugt, damit nicht jeder Spieltag mehrere
  // Rivalitäts-Karten gleichzeitig zeigt.
  const standings = input.gameState.seasonState.standings ?? {};
  const rankedStandings = input.gameState.teams
    .map((team) => {
      const record = standings[team.teamId];
      if (!record || record.rank == null || !Number.isFinite(record.rank)) return null;
      return { team, rank: record.rank, points: record.points ?? 0 };
    })
    .filter((entry): entry is { team: Team; rank: number; points: number } => entry != null)
    .sort((left, right) => left.rank - right.rank);

  let closestRivalry: { left: (typeof rankedStandings)[number]; right: (typeof rankedStandings)[number]; gap: number } | null = null;
  for (let i = 0; i < rankedStandings.length - 1; i += 1) {
    const left = rankedStandings[i]!;
    const right = rankedStandings[i + 1]!;
    if (!teamVisible(left.team.teamId) && !teamVisible(right.team.teamId)) continue;
    const gap = Math.abs(left.points - right.points);
    if (gap > 3) continue;
    if (!closestRivalry || gap < closestRivalry.gap) {
      closestRivalry = { left, right, gap };
    }
  }
  if (closestRivalry) {
    const { left, right, gap } = closestRivalry;
    const [teamA, teamB] = [left.team.teamId, right.team.teamId].sort();
    items.push(
      createItem({
        itemId: `story_rivalry_close_standings:${input.saveId}:${seasonId}:${teamA}:${teamB}`,
        saveId: input.saveId,
        seasonId,
        teamId: left.team.teamId,
        category: "news",
        severity: "info",
        title: "Story Card: Enges Rennen",
        description: `${left.team.shortCode} (Rang ${left.rank}, ${left.points} Pkt.) vs. ${right.team.shortCode} (Rang ${right.rank}, ${right.points} Pkt.) — nur ${gap} Punkt(e) trennen die Teams.`,
        targetView: "season",
        targetParams: { team: left.team.teamId },
        source: "story:standings_rivalry_gap",
        createdAt,
      }),
    );
  }

  // --- Story Card: Board unter Hochspannung --------------------------
  // Nutzt dieselbe `buildTeamObjectiveOverview`-Ableitung wie die
  // Board-Ziel-Tasks oben (gecached pro gameState-Objekt) statt eigene
  // Board-Logik zu duplizieren. Schwelle (`high_board_pressure`) ist die
  // bestehende Warnung aus dem Board-Confidence-Modell.
  const boardOverview = buildTeamObjectiveOverview(input.gameState);
  for (const teamId of visibleTeamIds) {
    const board = boardOverview.boardConfidence[teamId];
    if (!board || !board.warnings.includes("high_board_pressure")) continue;
    const team = input.gameState.teams.find((entry) => entry.teamId === teamId);
    if (!team) continue;
    items.push(
      createItem({
        itemId: `story_board_pressure_high:${input.saveId}:${seasonId}:${teamId}`,
        saveId: input.saveId,
        seasonId,
        teamId,
        category: "news",
        severity: "warning",
        title: "Story Card: Board unter Hochspannung",
        // Formatfix (Durchklick): Druck/Vertrauen sind 1-Nachkommastellen-Größen — roh
        // interpoliert stand hier „8.4/10" (JS-Punkt statt Hauskomma).
        description: `${team.shortCode}: Board-Druck bei ${formatLocalePoints(board.pressure, 1)}/10 — Vertrauen nur ${formatLocalePoints(board.value, 1)}/10.`,
        targetView: "teams",
        targetParams: { team: teamId, panel: "board-objectives" },
        source: "story:board_confidence_high_pressure",
        createdAt,
      }),
    );
  }

  // --- Story Card: Sponsor-Meilenstein -------------------------------
  // Reale Auszahlungs-Logs (`sponsorPayoutLogs`), bislang von keiner
  // anderen Inbox-Quelle konsumiert.
  for (const log of (input.gameState.seasonState.sponsorPayoutLogs ?? []).slice(-12)) {
    if (!teamVisible(log.teamId)) continue;
    const team = input.gameState.teams.find((entry) => entry.teamId === log.teamId);
    items.push(
      createItem({
        itemId: `story_sponsor_milestone:${input.saveId}:${log.id}`,
        saveId: input.saveId,
        seasonId: log.seasonId ?? seasonId,
        teamId: log.teamId,
        category: "news",
        severity: "info",
        title: "Story Card: Sponsor-Meilenstein",
        description: `${team?.shortCode ?? log.teamId}: Sponsor-Auszahlung ${log.cashDelta >= 0 ? "+" : ""}${log.cashDelta} (${log.phase}).`,
        targetView: "teams",
        targetParams: { team: log.teamId, panel: "sponsor-choice" },
        source: "story:sponsor_payout_log",
        createdAt: log.createdAt ?? createdAt,
      }),
    );
  }

  // --- Story Card: Durchbruch-Spieler --------------------------------
  // Andere Kennzahl als die bestehende "Entwicklung zeigt Wirkung"-Karte oben
  // (summiertes Attribut-Delta statt Anzahl verbesserter Diszis) und ein
  // eigener `story:`-Source. Gate auf OVR-Delta wurde entfernt: dieser Sprung
  // ist strukturell 0 gewesen (die Karte feuerte nie), weshalb hier die real
  // vorhandene Attribut-Differenz aus dem Progressions-Snapshot (before/after)
  // genutzt wird — Schwelle 5 Attributpunkte für einen spürbaren Saison-Sprung.
  const BREAKOUT_ATTRIBUTE_DELTA_THRESHOLD = 5;
  for (const event of (input.gameState.playerProgressionEvents ?? []).slice(-12)) {
    if (!teamVisible(event.teamId)) continue;
    const beforeAttrs = event.progressionSnapshotBefore?.attributes;
    const afterAttrs = event.progressionSnapshotAfter?.attributes;
    if (!beforeAttrs || !afterAttrs) continue;
    let attributeDelta = 0;
    for (const [key, afterValue] of Object.entries(afterAttrs)) {
      const beforeValue = beforeAttrs[key as keyof typeof beforeAttrs];
      if (typeof afterValue === "number" && typeof beforeValue === "number") {
        attributeDelta += afterValue - beforeValue;
      }
    }
    if (attributeDelta < BREAKOUT_ATTRIBUTE_DELTA_THRESHOLD) continue;
    items.push(
      createItem({
        itemId: `story_breakout_player_attr:${input.saveId}:${event.eventId}`,
        saveId: input.saveId,
        seasonId: event.seasonId ?? seasonId,
        teamId: event.teamId,
        playerId: event.playerId,
        category: "news",
        severity: "info",
        title: "Story Card: Durchbruch-Spieler",
        description: `${getPlayerName(input.gameState, event.playerId)} legt in einer Saison um +${attributeDelta.toFixed(0)} Attributpunkte zu.`,
        // Siehe oben: das Panel lebt im Training-Tab, nicht im Gebaeude-Tab.
        targetView: "trainingCompact",
        targetParams: { team: event.teamId, player: event.playerId, panel: "season-end-development" },
        source: "story:player_breakout_attribute_delta",
        createdAt: event.timestamp ?? createdAt,
      }),
    );
  }

  return items;
}

export function buildGameInboxItems(input: BuildGameInboxInput) {
  const createdAt = input.now ?? new Date().toISOString();
  const settingsMap = buildTeamControlSettingsMap(input.gameState.teams, input.gameState.seasonState.teamControlSettings);
  const visibleTeamIds = getVisibleTeamIds(input, settingsMap);
  const storedStatusById = getStoredStatusMap(input.gameState);
  const flowItem = buildFlowItem(input, createdAt);
  const items = [
    ...(flowItem ? [flowItem] : []),
    ...buildTeamTasks(input, visibleTeamIds, createdAt),
    ...buildGlobalTasks(input, createdAt),
    ...buildNews(input, visibleTeamIds, createdAt),
  ].map((item) => withStoredStatus(item, storedStatusById));

  const deduped = Array.from(new Map(items.map((item) => [item.itemId, item])).values());
  return deduped.sort((left, right) => {
    const statusDelta = (left.status === "open" ? 0 : 1) - (right.status === "open" ? 0 : 1);
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function filterGameInboxItems(items: GameInboxItem[], filter: GameInboxFilter) {
  return items.filter((item) => {
    const matchesTeam = !filter.teamId || filter.teamId === "ALL" || item.teamId === filter.teamId || item.teamId == null;
    const matchesCategory = !filter.category || filter.category === "ALL" || item.category === filter.category;
    const matchesDone = filter.includeDone || item.status !== "done";
    const matchesDismissed = filter.includeDismissed || item.status !== "dismissed";
    return matchesTeam && matchesCategory && matchesDone && matchesDismissed;
  });
}

/**
 * KANN DIESER EINTRAG AUF DIE WEITER-LEISTE?
 *
 * Herausgeloest aus `getPrimaryInboxTask`, weil die Bedingung nicht nur dort gebraucht wird: an
 * ihr haengt, fuer welche Eintraege ein `ctaLabel` PFLICHT ist. Ohne eigenen Namen musste jeder,
 * der das wissen wollte, den Filter abschreiben — und eine abgeschriebene Bedingung ist eine
 * Bedingung, die auseinanderlaeuft.
 *
 * Geprueft wird sie in `tests/weiter-leiste-beschriftung.test.ts`.
 */
export function isPrimaryInboxCandidate(
  item: GameInboxItem,
  options?: { focusMatchdayLoop?: boolean },
): boolean {
  if (item.status !== "open") {
    return false;
  }
  return (
    item.category === "task" ||
    item.category === "warning" ||
    item.category === "sponsor" ||
    item.category === "training" ||
    (item.category === "transfer" && (item.severity === "warning" || item.severity === "critical")) ||
    (item.category === "facility" && (item.severity === "warning" || item.severity === "critical")) ||
    (!options?.focusMatchdayLoop && item.category === "contract") ||
    item.severity === "critical"
  );
}

export function getPrimaryInboxTask(items: GameInboxItem[], options?: { focusMatchdayLoop?: boolean }) {
  const severityRank: Record<GameInboxItem["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const sourcePriority: Record<string, number> = {
    player_health_injury: 0,
    player_health_fatigue_risk: 1,
    player_health_lineup_rest: 2,
    player_health_training_load: 3,
    lineup_drafts: 4,
    game_flow_controller: 5,
    team_season_objectives: 6,
    roster_value_contract_cash: 7,
    roster_cash_transfer_window: 8,
    facility_condition_forecast: 9,
    facility_finance_forecast: 10,
  };

  const candidates = items.filter((item) => isPrimaryInboxCandidate(item, options));

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const severityDiff = severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    const sourceDiff = (sourcePriority[left.source] ?? 50) - (sourcePriority[right.source] ?? 50);
    if (sourceDiff !== 0) {
      return sourceDiff;
    }
    return left.title.localeCompare(right.title, "de");
  })[0];
}

export function mapInboxItemToFlowStep(item: GameInboxItem): Pick<GameFlowStep, "label" | "cta" | "status" | "targetView" | "targetPanel" | "teamId" | "blockers" | "warnings"> {
  const isCritical = item.severity === "critical";
  return {
    label: item.title,
    cta: `Weiter: ${item.title}`,
    status: isCritical ? "warning" : "ready",
    targetView: item.targetView as GameFlowStep["targetView"],
    targetPanel: typeof item.targetParams.panel === "string" ? item.targetParams.panel : null,
    teamId: item.teamId ?? null,
    blockers: isCritical ? [item.description] : [],
    warnings: isCritical ? [] : [item.description],
  };
}

export const INBOX_DECISION_CATEGORIES = [
  "task",
  "warning",
  "transfer",
  "finance",
  "contract",
  "training",
  "facility",
  "sponsor",
] as const;

export const INBOX_CHRONICLE_CATEGORIES = ["news", "result"] as const;

export function isGameInboxDecisionItem(item: GameInboxItem) {
  if (isGameInboxChronicleOnlySource(item.source)) {
    return false;
  }
  if (item.source.startsWith("player_health_")) {
    return true;
  }
  if ((INBOX_DECISION_CATEGORIES as readonly string[]).includes(item.category)) {
    if (item.category === "transfer" && item.source === "transfer_history") {
      return false;
    }
    // #44: Scouting-Fortschritt ("Certainty 50% — Intel wird schärfer") ist
    // eine reine Beobachtung ohne Entscheidung/Handlung — gehört ins
    // Chronik/News-Bild, nicht in den Aktionen-Aktionsraum.
    if (item.category === "transfer" && item.source === "scout_intel_pipeline") {
      return false;
    }
    return true;
  }
  return false;
}

export function isGameInboxChronicleItem(item: GameInboxItem) {
  if ((INBOX_CHRONICLE_CATEGORIES as readonly string[]).includes(item.category)) {
    return true;
  }
  if (item.source.startsWith("story:")) {
    return true;
  }
  if (item.source === "story:matchday_recap") {
    return true;
  }
  if (item.source === "season_snapshots" || item.source === "transfer_history") {
    return true;
  }
  if (item.source === "facility_events") {
    return true;
  }
  if (item.source === "cash_prize_apply_logs") {
    return true;
  }
  if (item.category === "finance" && item.source === "cash_prize_apply_logs") {
    return true;
  }
  if (item.category === "transfer" && item.source === "transfer_history") {
    return true;
  }
  if (item.category === "transfer" && item.source === "scout_intel_pipeline") {
    return true;
  }
  if (item.category === "facility" && item.source === "facility_events") {
    return true;
  }
  return false;
}

export function filterInboxItemsByMode(items: GameInboxItem[], mode: "decisions" | "chronicle") {
  return items.filter((item) => (mode === "decisions" ? isGameInboxDecisionItem(item) : isGameInboxChronicleItem(item)));
}

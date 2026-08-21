import type {
  Contract,
  Discipline,
  GamePhase,
  GameLogEntry,
  GameState,
  MappingReport,
  MatchdayState,
  Player,
  PlayerBaselineRecord,
  PlayerBaselineWriteGuardEvent,
  SeasonEconomyFactorGuardEvent,
  SeasonEconomyFactorRecord,
  RosterEntry,
  Season,
  SeasonState,
  SeasonTransitionState,
  ScenarioMeta,
  SponsorOffer,
  SponsorRarity,
  Team,
  TeamIdentity,
  TransferHistoryEntry,
  TransferListing,
} from "@/lib/data/olyDataTypes";
import { mapArchetypeToCurveShape, mapStarTierToRarity } from "@/lib/sponsor/sponsor-curve-shapes";
import { stampSponsorSystemVersion } from "@/lib/sponsor/sponsor-v3-offer-service";
import { withSponsorSalaryFactorOfCurrentSeason } from "@/lib/sponsor/sponsor-salary-factor-backfill";
import { withMigratedSponsorLadders } from "@/lib/sponsor/sponsor-v3-migration";
import { withNegotiatedSalaryBenchmark } from "@/lib/contracts/negotiated-salary-benchmark";
import { createGameStateFromSeed } from "@/lib/data/dataAdapter";
import { hydrateGameStateMedia } from "@/lib/data/mediaAssets";
import { getDatabase } from "@/lib/persistence/sqlite";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { buildScenarioMeta, withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { resolveFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { buildSaveContentSignature } from "@/lib/persistence/save-content-signature";
import { invalidateSeasonDerivationsCache } from "@/lib/foundation/season-derivations-cache";
import {
  deleteSeasonDerivationsSidecar,
  writeSeasonDerivationsSidecar,
} from "@/lib/persistence/season-derivations-sidecar";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { invalidateStandingsOverviewCache } from "@/lib/season/standings-overview-cache";
import { invalidateLegacyLineupLabContextCache } from "@/lib/lineups/legacy-lineup-lab-context-cache";
import { invalidateStandingsPreviewCache } from "@/lib/standings/standings-preview-cache";
import { invalidateArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";
import {
  buildSaveSessionCacheSignature,
  invalidateSaveSessionCache,
  readSaveSessionCache,
  writeSaveSessionCache,
} from "@/lib/persistence/save-session-cache";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { ensurePlayerBaselines, guardPlayerBaselineWrite } from "@/lib/players/player-baseline-service";
import { ensurePlayerInjuryHistoryForGameState } from "@/lib/foundation/player-injury-history";
import { ensureNulaOnProjectSuicide } from "@/lib/foundation/ensure-nula-on-project-suicide";
import {
  buildPlayerPotentialRecordsForSave,
  isPlayerPotentialModelCurrent,
  migratePlayerPotentialRecordsToCurrentModel,
} from "@/lib/progression/player-potential-service";
import { reconcilePlayerPotentialRecordsForGameState } from "@/lib/scouting/player-potential-ceiling-service";
import { withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import {
  SEASON_ECONOMY_FACTOR_WINDOW_SIZE,
  getSeasonEconomyFactorWindow,
  parseSeasonNumber,
} from "@/lib/season/season-economy-factors";
import { slimGameStateForWrite } from "@/lib/persistence/save-payload-slimming";
import { migrateLegacyPreseasonManagementPhase } from "@/lib/season/season-transition-chain";
import type {
  PersistedSaveGame,
  SaveRepository,
  SaveStatus,
  SaveSummary,
  SaveVersionMetadata,
} from "@/lib/persistence/types";

import { enforceRollingSaveRetention } from "@/lib/persistence/save-retention";

export { enforceRollingSaveRetention };

/**
 * Every sqlite table that is keyed by `save_id` and must be purged when a save is deleted.
 * `player_catalog` / `player_baseline_catalog` are intentionally excluded — they are global
 * catalogs shared across saves, not per-save data (see sqlite.ts schema).
 *
 * All of these tables already declare `FOREIGN KEY (save_id) REFERENCES saves(save_id) ON
 * DELETE CASCADE` and the database runs with `PRAGMA foreign_keys = ON`, so deleting from
 * `saves` alone would cascade correctly. We still delete explicitly (belt-and-suspenders) in
 * case the pragma is ever off for a given connection — this list is the single source of truth
 * shared by `deleteSaves` below and `scripts/cleanup-test-saves.ts`, so keep it in sync with the
 * schema in `lib/persistence/sqlite.ts`.
 */
export const SAVE_CHILD_TABLES = [
  "seasons",
  "season_states",
  "matchday_states",
  "game_metadata",
  "teams",
  "team_identities",
  "players",
  "player_baselines",
  "disciplines",
  "rosters",
  "contracts",
  "transfer_listings",
  "transfer_history",
  "game_logs",
  "mapping_reports",
] as const;

type SaveRow = {
  save_id: string;
  name: string;
  status: SaveStatus;
  created_at: string;
  updated_at: string;
  content_signature?: string;
  save_version?: number;
  season_id?: string;
  matchday_id?: string;
  lineup_draft_count?: number;
  transfer_history_count?: number;
  created_by?: string;
};

type GameMetadata = {
  gamePhase?: GamePhase;
  seasonTransition?: SeasonTransitionState;
  scenarioMeta?: ScenarioMeta;
  saveVersion?: number;
  lastAppliedEventId?: string | null;
  appliedEventIds?: string[];
  transitionStatus?: SeasonTransitionState["status"];
  currentStep?: string;
  completedSteps?: string[];
  seasonReviewState?: unknown;
  preSeasonWorkflowState?: unknown;
  baselineWriteGuardEvents?: PlayerBaselineWriteGuardEvent[];
  playerProgressionEvents?: GameState["playerProgressionEvents"];
  playerPotential?: GameState["playerPotential"];
  playerMoraleState?: GameState["playerMoraleState"];
  playerRelationshipEvents?: GameState["playerRelationshipEvents"];
  // #1: Der zugewiesene Saison-Kapitän (manuell/AI) muss dauerhaft überleben, sonst geht er
  // beim Kaltladen aus der DB verloren (bisher nur im flüchtigen Session-Cache gehalten).
  teamCaptains?: GameState["teamCaptains"];
  // #8: Nutzer-Entscheidungen (erledigt/verworfen) auf Inbox-Items müssen den Reload überleben.
  gameInboxItems?: GameState["gameInboxItems"];
};

type PlayerSavePayload =
  | {
      storage: "delta";
      patch: Partial<Player>;
    }
  | {
      storage: "full";
      player: Player;
    };

function parseJsonColumn<T>(value: string): T {
  return JSON.parse(value) as T;
}

function normalizeLegacyCashCreatorsColdSteelCodes(gameState: GameState): GameState {
  const hasLegacySwappedCodes = gameState.teams.some(
    (team) =>
      (team.name === "Cash Creators" && team.teamId === "C-S") ||
      (team.name === "Cold Steel" && team.teamId === "C-C"),
  );

  if (!hasLegacySwappedCodes) {
    return gameState;
  }

  const normalized = JSON.parse(
    JSON.stringify(gameState)
      .replace(/"C-C"/g, '"__TEAM_CODE_CC__"')
      .replace(/"C-S"/g, '"C-C"')
      .replace(/"__TEAM_CODE_CC__"/g, '"C-S"'),
  ) as GameState;

  return normalized;
}

/**
 * GEMELDET: „natuerlich muss season 1 immer auch den salary factor von der ersten season nehmen.
 * das wird dem spieler ja am anfang zb auch angezeigt faktor 1,19 da geht man ja davon aus dass es
 * gut geld gibt."
 *
 * `seasonState.seasonEconomyFactors` wurde bisher NUR beim Saisonuebergang geschrieben
 * (preseason-workflow-service.ts). In Saison 1 war die Liste damit leer — und jeder Leser, der sie
 * roh liest statt abzuleiten, fiel auf einen Ersatzwert zurueck:
 *
 *   getCurrentSponsorSalaryFactor  → 1.0        (Sponsor-Angebote, Abrechnung, Apron)
 *   getSeasonEconomyFactorWindow   → 1.09 …     (Finanzen, Saisonstand, KI-Vorausschau, Skripte)
 *
 * Zwei Antworten auf dieselbe Frage: die Finanzseite versprach 1,09, der Sponsor zahlte nach 1,00.
 * Gemessen ueber alle sechs Spielstaende dieses Containers war das Fenster ausnahmslos leer.
 *
 * Hier wird es beim Laden gefuellt — an genau einer Stelle, durch die jeder Spielstand kommt, und
 * mit derselben Funktion, die die anderen Leser ohnehin benutzen. Damit ist die Ableitung nicht
 * mehr eine zweite Meinung, sondern die einzige.
 *
 * Deterministisch aus (saveId, seasonId): derselbe Spielstand bekommt bei jedem Laden dieselben
 * Faktoren, und `advanceSeasonEconomyFactorWindow` schreibt beim Uebergang exakt die Werte fort,
 * die hier schon standen. Ein bereits vollstaendiges Fenster bleibt unangetastet.
 */
/**
 * DER WAECHTER UEBER DER KONJUNKTUR-REIHE — Chris' Auftrag vom 21.08.2026 („3a+b").
 *
 * WAS 3a ERGEBEN HAT, und es entlastet: die FAKTOREN sind deterministisch. Ueber zwei Prozesse
 * gemessen liefern alle fuenf Live-Abbilder dieselbe Reihe (`h0z7cl`: 1,05 · 1,08 · 1,17 · 0,96 ·
 * 1,14). Gewandert ist allein `generatedAt` — und nur bei `h0z7cl` und `n90y4m`, weil dort
 * `seasonEconomyFactors` in der gespeicherten Zeile GANZ FEHLTE und der Ladepfad die Reihe jedes
 * Mal neu baute. Beim ersten Speichern heilt sich das von selbst; nachgemessen: vorher „FEHLT",
 * nachher „5 Eintraege".
 *
 * WAS DER WAECHTER PRUEFT — und was NICHT, denn das ist hier der springende Punkt:
 *
 *   STRUKTUR, in jeder Saison: genau fuenf Horizonte, lueckenlos 0..4, alle zur laufenden Saison.
 *   Eine Reihe mit Luecken oder Dubletten ist kaputt, egal wie alt der Spielstand ist — und eine
 *   kaputte Reihe verschiebt Sponsorengeld und die Apron-Drosselung.
 *
 *   WERTE, NUR in Saison 1: dort gibt es keine Fortschreibung, die gespeicherte Reihe MUSS also
 *   dem Seed aus `(saveId, seasonId)` entsprechen. Ab Saison 2 waere der Seed die falsche
 *   Referenz: `advanceSeasonEconomyFactorWindow` nimmt vier von fuenf Horizonten aus der Vorsaison
 *   mit, die Reihe SOLL dann abweichen. Nachgemessen an `1hf25q` (Saison 2): gespeichert
 *   [1,19 · 0,87 · 0,83 · 0,91 · 1,24] gegen frischen Seed [1,22 · 0,95 · 1,09 · 1,03 · 1,06] —
 *   ein Werte-Waechter haette dort dauerhaft rot gezeigt, ohne dass etwas falsch ist. Ein Waechter,
 *   der immer anschlaegt, ist keiner.
 *
 * GEMELDET STATT REPARIERT: eine auffaellige Reihe bleibt STEHEN. Mit ihr wurde gerechnet, mit ihr
 * ist Geld geflossen — sie beim Laden auszutauschen aendert rueckwirkend die Grundlage und niemand
 * erfaehrt davon. Der Waechter schreibt auf, was er sieht, und ueberlaesst die Entscheidung Chris.
 */
function pruefeKonjunkturReihe(input: {
  saveId: string;
  seasonId: string;
  gespeichert: SeasonEconomyFactorRecord[];
}): { grund: "struktur" | "werte"; storedFactors: number[]; seededFactors: number[] } | null {
  const fuerDieseSaison = input.gespeichert.filter((eintrag) => eintrag.seasonId === input.seasonId);
  if (input.gespeichert.length === 0) {
    // Erstbefuellung, keine Abweichung.
    return null;
  }

  const sortiert = fuerDieseSaison.slice().sort((links, rechts) => links.horizonIndex - rechts.horizonIndex);
  const storedFactors = sortiert.map((eintrag) => eintrag.factor);
  const seed = getSeasonEconomyFactorWindow({ saveId: input.saveId, seasonId: input.seasonId });
  const seededFactors = seed.map((eintrag) => eintrag.factor);

  const strukturHeil =
    sortiert.length === SEASON_ECONOMY_FACTOR_WINDOW_SIZE &&
    sortiert.every((eintrag, index) => eintrag.horizonIndex === index) &&
    fuerDieseSaison.length === input.gespeichert.filter((eintrag) => eintrag.seasonId === input.seasonId).length;
  if (!strukturHeil) {
    return { grund: "struktur", storedFactors, seededFactors };
  }

  // Werte nur in Saison 1 — ab Saison 2 ist der Seed die falsche Referenz (siehe Kopfkommentar).
  if (parseSeasonNumber(input.seasonId) === 1 && JSON.stringify(storedFactors) !== JSON.stringify(seededFactors)) {
    return { grund: "werte", storedFactors, seededFactors };
  }
  return null;
}

/** Nur fuer Tests exportiert: der Waechter allein, ohne Datenbank drumherum. */
export function createPersistedSaveRecordForTest(gameState: GameState, saveId: string): GameState {
  return withSeededSeasonEconomyFactors(gameState, saveId);
}

function withSeededSeasonEconomyFactors(gameState: GameState, saveId: string): GameState {
  const window = getSeasonEconomyFactorWindow({
    saveId,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  });
  const vorhanden = gameState.seasonState.seasonEconomyFactors ?? [];

  const befund = pruefeKonjunkturReihe({ saveId, seasonId: gameState.season.id, gespeichert: vorhanden });
  if (befund) {
    const ereignis: SeasonEconomyFactorGuardEvent = {
      eventId: `season-economy-factor-${befund.grund}-${saveId}-${gameState.season.id}`,
      seasonId: gameState.season.id,
      reason: "season_economy_factor_mismatch",
      storedFactors: befund.storedFactors,
      seededFactors: befund.seededFactors,
      // Der Zeitstempel der gespeicherten Reihe, NICHT die Wanduhr: sonst waere der Spielstand nach
      // jedem Laden ein anderer, und der Waechter erzeugte genau das Wackeln, das er melden soll.
      timestamp: vorhanden[0]?.generatedAt ?? "",
    };
    const bisher = gameState.seasonEconomyFactorGuardEvents ?? [];
    if (bisher.some((eintrag) => eintrag.eventId === ereignis.eventId)) {
      return gameState;
    }
    return { ...gameState, seasonEconomyFactorGuardEvents: [...bisher, ereignis] };
  }

  // Unveraendert lassen, wenn schon dasselbe drinsteht — sonst bekaeme jeder Ladevorgang ein neues
  // Objekt und die Save-Session-Signatur wuerde ohne Grund wackeln.
  const deckungsgleich =
    vorhanden.length === window.length &&
    vorhanden.every((eintrag, index) => eintrag.factor === window[index]!.factor && eintrag.horizonIndex === index);
  if (deckungsgleich) {
    return gameState;
  }
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, seasonEconomyFactors: window },
  };
}

function normalizeLegacyRosterTargets(gameState: GameState): GameState {
  const teamByTeamId = new Map(gameState.teams.map((team) => [team.teamId, team]));

  // Kader-Minimum ist fix 8 für alle Teams: Identity-playerMin auf den abgeleiteten
  // (geklammerten) Fixwert ziehen, damit jeder Consumer der identity.playerMin liest 8 sieht.
  let identitiesChanged = false;
  const teamIdentities = gameState.teamIdentities.map((identity) => {
    const team = teamByTeamId.get(identity.teamId);
    const targets = deriveRosterTargets(team, identity);
    if (identity.playerMin === targets.playerMin) {
      return identity;
    }
    identitiesChanged = true;
    return { ...identity, playerMin: targets.playerMin };
  });

  const identityByTeamId = new Map(teamIdentities.map((identity) => [identity.teamId, identity]));
  let teamsChanged = false;
  const teams = gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const targets = deriveRosterTargets(team, identity);
    const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.round(identity!.playerOpt) : null;
    const rosterLimit = targets.playerMax;
    const rosterMinTarget = targets.playerMin;
    const rosterOptTarget = playerOpt;
    if (
      rosterLimit === team.rosterLimit &&
      team.rosterMinTarget === rosterMinTarget &&
      team.rosterOptTarget === rosterOptTarget
    ) {
      return team;
    }
    teamsChanged = true;
    return {
      ...team,
      rosterLimit,
      rosterMinTarget,
      rosterOptTarget,
    };
  });

  if (!identitiesChanged && !teamsChanged) {
    return gameState;
  }
  return {
    ...gameState,
    ...(teamsChanged ? { teams } : {}),
    ...(identitiesChanged ? { teamIdentities } : {}),
  };
}

/**
 * Legacy-save field: pre-rarity save blobs still carry a raw numeric `starTier` (1..5) on their sponsor
 * offers/contracts. The current `SponsorOffer`/`TeamSponsorContract` types no longer declare that field (the
 * star-tier system itself is gone), so this reads it defensively off the raw persisted record without
 * requiring it on the type.
 */
function readLegacyStarTier(record: unknown): number | undefined {
  const raw = (record as { starTier?: unknown } | null | undefined)?.starTier;
  return typeof raw === "number" ? raw : undefined;
}

/**
 * Rarity-Backfill für Alt-Angebote/-Verträge OHNE `rarity`. Existiert ein legacy `starTier`, wird er
 * ★→Rarity gefaltet; fehlt jeder Sternrang (uralte Prä-Rarity-Blobs), fällt es KONSERVATIV auf
 * `"gewöhnlich"` zurück — deckungsgleich mit dem Settlement-Fallback (`sponsor-settlement-service.ts`),
 * statt wie früher implizit auf „magisch" (das ließ jeden Alt-Save auf jeder Karte „Magisch" zeigen und
 * war zudem gegenüber der Abrechnung inkonsistent).
 */
function legacyRarityBackfill(record: unknown): SponsorRarity {
  const starTier = readLegacyStarTier(record);
  return starTier != null ? mapStarTierToRarity(starTier) : "gewöhnlich";
}

/**
 * Back-compat: old saves carry sponsor offers/contracts with a legacy `starTier`/`archetype` but no
 * `rarity`/`curveShape`. Backfill the new fields deterministically (star→rarity, archetype→curve shape) on
 * load so every consumer sees them. Signed contracts keep their frozen `lockedRankPayoutLadder`, so payouts
 * are unaffected; this only labels them for the new UI/roller. Idempotent (skips already-migrated entries).
 */
function normalizeLegacySponsors(gameState: GameState): GameState {
  const seasonState = gameState.seasonState;
  if (!seasonState) return gameState;
  let changed = false;
  const migrateOffer = (offer: SponsorOffer): SponsorOffer => {
    if (offer.rarity != null && offer.curveShape != null) return offer;
    changed = true;
    return {
      ...offer,
      rarity: offer.rarity ?? legacyRarityBackfill(offer),
      curveShape: offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype),
    };
  };
  const nextOffers = seasonState.sponsorOffersByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorOffersByTeamId).map(([teamId, list]) => [teamId, list.map(migrateOffer)]),
      )
    : seasonState.sponsorOffersByTeamId;
  const nextContracts = seasonState.sponsorContractsByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorContractsByTeamId).map(([teamId, contract]) => {
          if (contract.rarity != null && contract.curveShape != null) return [teamId, contract];
          changed = true;
          return [
            teamId,
            {
              ...contract,
              rarity: contract.rarity ?? legacyRarityBackfill(contract),
              curveShape: contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype),
            },
          ];
        }),
      )
    : seasonState.sponsorContractsByTeamId;
  if (!changed) return gameState;
  return {
    ...gameState,
    seasonState: { ...seasonState, sponsorOffersByTeamId: nextOffers, sponsorContractsByTeamId: nextContracts },
  };
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLegacyMoneyValue(input: {
  value: number | null | undefined;
  threshold: number;
  budget?: number | null | undefined;
}) {
  const numericValue = toFiniteNumber(input.value);
  if (numericValue == null) {
    return input.value ?? null;
  }

  const absoluteValue = Math.abs(numericValue);
  const budget = Math.abs(toFiniteNumber(input.budget) ?? 0);
  const lowScaleBudget = budget > 0 && budget <= 1000;
  const suspiciousByThreshold = absoluteValue > input.threshold;
  const suspiciousByBudget = lowScaleBudget && absoluteValue > budget * 8;

  if ((suspiciousByThreshold && (lowScaleBudget || input.budget == null)) || suspiciousByBudget) {
    return roundMoney(numericValue / 100);
  }

  return roundMoney(numericValue);
}

export function normalizeLegacyFinanceScale(gameState: GameState): GameState {
  const budgetByTeamId = new Map(gameState.teams.map((team) => [team.teamId, team.budget] as const));
  let changed = false;

  const teams = gameState.teams.map((team) => {
    const normalizedCash = normalizeLegacyMoneyValue({
      value: team.cash,
      threshold: 5000,
      budget: team.budget,
    });
    if (normalizedCash === team.cash) {
      return team;
    }
    changed = true;
    return {
      ...team,
      cash: normalizedCash ?? team.cash,
    };
  });

  const standingsEntries = Object.entries(gameState.seasonState.standings ?? {});
  const normalizedStandings = Object.fromEntries(
    standingsEntries.map(([teamId, standing]) => {
      const budget = budgetByTeamId.get(teamId);
      const nextStanding = {
        ...standing,
        cashFc: normalizeLegacyMoneyValue({ value: standing.cashFc, threshold: 5000, budget }),
        cashTotal: normalizeLegacyMoneyValue({ value: standing.cashTotal, threshold: 5000, budget }),
      };
      if (
        nextStanding.cashFc !== standing.cashFc ||
        nextStanding.cashTotal !== standing.cashTotal
      ) {
        changed = true;
      }
      return [teamId, nextStanding];
    }),
  );

  const transferHistory = (gameState.transferHistory ?? []).map((entry) => {
    const relatedBudget = budgetByTeamId.get(entry.fromTeamId ?? entry.toTeamId ?? "");
    const normalizedFee = normalizeLegacyMoneyValue({
      value: entry.fee,
      threshold: 5000,
      budget: relatedBudget,
    });
    const normalizedMarketValue = normalizeLegacyMoneyValue({
      value: entry.marketValue,
      threshold: 5000,
      budget: relatedBudget,
    });
    const normalizedSalary = normalizeLegacyMoneyValue({
      value: entry.salary,
      threshold: 1000,
      budget: relatedBudget,
    });
    if (
      normalizedFee === entry.fee &&
      normalizedMarketValue === entry.marketValue &&
      normalizedSalary === entry.salary
    ) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      fee: normalizedFee ?? entry.fee,
      marketValue: normalizedMarketValue ?? entry.marketValue,
      salary: normalizedSalary ?? entry.salary,
    };
  });

  const contractEvents = (gameState.seasonState.contractEvents ?? []).map((event) => {
    const budget = budgetByTeamId.get(event.teamId);
    const normalizedExitValue = normalizeLegacyMoneyValue({
      value: event.exitValue,
      threshold: 5000,
      budget,
    });
    const normalizedMarketValueAtExit = normalizeLegacyMoneyValue({
      value: event.marketValueAtExit,
      threshold: 5000,
      budget,
    });
    const normalizedPurchasePrice = normalizeLegacyMoneyValue({
      value: event.purchasePrice,
      threshold: 5000,
      budget,
    });
    const normalizedProfitLoss = normalizeLegacyMoneyValue({
      value: event.profitLoss,
      threshold: 5000,
      budget,
    });
    const normalizedOldSalary = normalizeLegacyMoneyValue({
      value: event.oldSalary,
      threshold: 1000,
      budget,
    });
    const normalizedNewSalary = normalizeLegacyMoneyValue({
      value: event.newSalary,
      threshold: 1000,
      budget,
    });
    if (
      normalizedExitValue === event.exitValue &&
      normalizedMarketValueAtExit === event.marketValueAtExit &&
      normalizedPurchasePrice === event.purchasePrice &&
      normalizedProfitLoss === event.profitLoss &&
      normalizedOldSalary === event.oldSalary &&
      normalizedNewSalary === event.newSalary
    ) {
      return event;
    }
    changed = true;
    return {
      ...event,
      exitValue: normalizedExitValue,
      marketValueAtExit: normalizedMarketValueAtExit,
      purchasePrice: normalizedPurchasePrice,
      profitLoss: normalizedProfitLoss,
      oldSalary: normalizedOldSalary,
      newSalary: normalizedNewSalary,
    };
  });

  if (!changed) {
    return gameState;
  }

  return {
    ...gameState,
    teams,
    transferHistory,
    seasonState: {
      ...gameState.seasonState,
      standings: normalizedStandings,
      contractEvents,
    },
  };
}

function loadCollection<T>(tableName: string, keyColumn: string, saveId: string) {
  const database = getDatabase();
  const statement = database.prepare(
    `SELECT payload_json FROM ${tableName} WHERE save_id = ? ORDER BY ${keyColumn} ASC`,
  );

  return (statement.all(saveId) as Array<{ payload_json: string }>).map((row) => parseJsonColumn<T>(row.payload_json));
}

/**
 * Perf: this used to unconditionally DELETE every row for the save and re-INSERT the entire
 * collection on every single incremental save. For collections like rosters/teams that barely
 * change between two consecutive saves (typically 1-2 entries touched by a single transfer), that
 * turned a cheap operation into O(collection size) disk writes every time, compounding badly over
 * a long multi-season run. Diff against what's already persisted and only touch changed/removed rows.
 */
function replaceCollection<T>(
  tableName: string,
  keyColumn: string,
  saveId: string,
  items: T[],
  keySelector: (item: T) => string,
) {
  const database = getDatabase();
  const existingRows = database
    .prepare(`SELECT ${keyColumn} AS key_value, payload_json FROM ${tableName} WHERE save_id = ?`)
    .all(saveId) as Array<{ key_value: string; payload_json: string }>;
  const existingPayloadByKey = new Map(existingRows.map((row) => [row.key_value, row.payload_json]));

  const upsertStatement = database.prepare(
    `INSERT INTO ${tableName} (save_id, ${keyColumn}, payload_json) VALUES (?, ?, ?)
     ON CONFLICT(save_id, ${keyColumn}) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  const deleteStatement = database.prepare(`DELETE FROM ${tableName} WHERE save_id = ? AND ${keyColumn} = ?`);

  const seenKeys = new Set<string>();
  for (const item of items) {
    const key = keySelector(item);
    seenKeys.add(key);
    const serialized = JSON.stringify(item);
    if (existingPayloadByKey.get(key) !== serialized) {
      upsertStatement.run(saveId, key, serialized);
    }
  }

  for (const existingKey of existingPayloadByKey.keys()) {
    if (!seenKeys.has(existingKey)) {
      deleteStatement.run(saveId, existingKey);
    }
  }
}

/**
 * Perf: for strictly append-only history collections (transfer_history, game_logs), entries are
 * never mutated or removed once written — every write path only prepends new entries. Doing a full
 * DELETE + re-INSERT of the whole table (like replaceCollection) on every single incremental save
 * turns per-save cost into O(total history so far), which compounds into multi-second saves once a
 * run has accumulated hundreds/thousands of entries. Instead, only insert keys not already persisted.
 * Falls back to a full replace if the incoming list is shorter than what's stored (explicit reset).
 */
function appendOnlyCollection<T>(
  tableName: string,
  keyColumn: string,
  saveId: string,
  items: T[],
  keySelector: (item: T) => string,
) {
  const database = getDatabase();
  const existingKeys = new Set(
    (
      database.prepare(`SELECT ${keyColumn} AS key_value FROM ${tableName} WHERE save_id = ?`).all(saveId) as Array<{
        key_value: string;
      }>
    ).map((row) => row.key_value),
  );

  if (items.length < existingKeys.size) {
    replaceCollection(tableName, keyColumn, saveId, items, keySelector);
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO ${tableName} (save_id, ${keyColumn}, payload_json) VALUES (?, ?, ?)`,
  );
  for (const item of items) {
    const key = keySelector(item);
    if (existingKeys.has(key)) {
      continue;
    }
    insertStatement.run(saveId, key, JSON.stringify(item));
  }
}

function replaceSingleton(tableName: string, saveId: string, payload: unknown) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO ${tableName} (save_id, payload_json) VALUES (?, ?)
     ON CONFLICT(save_id) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  statement.run(saveId, JSON.stringify(payload));
}

function loadSingleton<T>(tableName: string, saveId: string) {
  const database = getDatabase();
  const row = database.prepare(`SELECT payload_json FROM ${tableName} WHERE save_id = ?`).get(saveId) as
    | { payload_json: string }
    | undefined;
  return row ? parseJsonColumn<T>(row.payload_json) : null;
}

function inferCompletedGamePhase(input: {
  metadata: GameMetadata | null;
  season: Season;
  seasonState: SeasonState;
  matchdayState: MatchdayState;
}): GamePhase | undefined {
  if (input.metadata?.gamePhase) {
    // Altstand-Umschrift beim Laden: die Saisonende-Station hiess bis 0.4.11 `preseason_management`
    // — derselbe Name wie der frische Spielaufbau. Hier faellt die Entscheidung EINMAL, damit alle
    // Lesestellen danach eine eindeutige Phase sehen. Beide Ladewege (`loadSave`, Projektion) gehen
    // durch diese Funktion, deshalb steht sie hier und nicht an den zwei Aufrufstellen.
    return migrateLegacyPreseasonManagementPhase({
      gamePhase: input.metadata.gamePhase,
      seasonId: input.season.id,
      matchdayResults: input.seasonState.matchdayResults,
    });
  }

  const matchdayIds = input.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1];
  if (!lastMatchdayId) {
    return undefined;
  }

  const hasLastMatchdayResult = (input.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === input.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (input.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === input.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeLastMatchdayResolved =
    input.matchdayState.matchdayId === lastMatchdayId && input.matchdayState.status === "resolved";

  return hasLastMatchdayResult && hasLastStandingsApply && activeLastMatchdayResolved ? "season_completed" : undefined;
}

function loadScenarioMetaForSummary(saveId: string, createdAt: string) {
  const metadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  if (metadata?.scenarioMeta) {
    return metadata.scenarioMeta;
  }

  const season = loadSingleton<Season>("seasons", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  if (!season || !matchdayState) {
    return undefined;
  }

  const activeMatchday =
    Number.isFinite(season.currentMatchday)
      ? season.currentMatchday
      : Number.parseInt(matchdayState.matchdayId.replace(/\D+/g, ""), 10) || undefined;

  return {
    scenarioType: "fresh_start" as const,
    label: "Unmarkierter Save",
    createdAt,
    isStableTestPoint: false,
    containsFinalStandings: false,
    containsSeasonHistory: false,
    activeSeasonId: season.id,
    activeMatchday,
    gamePhase: metadata?.gamePhase ?? "season_active",
  };
}

function loadSaveRow(saveId: string) {
  const database = getDatabase();
  return database
    .prepare(
      "SELECT save_id, name, status, created_at, updated_at, content_signature, save_version, season_id, matchday_id, lineup_draft_count, transfer_history_count FROM saves WHERE save_id = ?",
    )
    .get(saveId) as SaveRow | undefined;
}

function buildVersionMetadataFromGameState(input: {
  saveId: string;
  updatedAt: string;
  gameState: GameState;
  transferHistoryCount: number;
}) {
  const seasonState = input.gameState.seasonState;
  const saveVersion = input.gameState.saveVersion ?? 0;
  const lineupDraftCount = seasonState.lineupDrafts?.length ?? 0;
  const contentSignature = buildSaveContentSignature({
    seasonId: input.gameState.season.id,
    matchdayId: input.gameState.matchdayState.matchdayId,
    saveVersion,
    lineupDraftCount,
    transferHistoryCount: input.transferHistoryCount,
    matchdayResults: seasonState.matchdayResults ?? [],
    standingsApplyLogs: seasonState.standingsApplyLogs ?? [],
    seasonSnapshots: seasonState.seasonSnapshots ?? [],
    disciplineResults: seasonState.disciplineResults ?? [],
  });

  return {
    saveId: input.saveId,
    updatedAt: input.updatedAt,
    seasonId: input.gameState.season.id,
    matchdayId: input.gameState.matchdayState.matchdayId,
    contentSignature,
    saveVersion,
    lineupDraftCount,
    transferHistoryCount: input.transferHistoryCount,
    matchdayResults: seasonState.matchdayResults ?? [],
    standingsApplyLogs: seasonState.standingsApplyLogs ?? [],
    seasonSnapshots: seasonState.seasonSnapshots ?? [],
    disciplineResults: seasonState.disciplineResults ?? [],
  } satisfies SaveVersionMetadata;
}

function loadSaveVersionMetadata(saveId: string): SaveVersionMetadata | null {
  const row = loadSaveRow(saveId);
  if (!row) {
    return null;
  }

  if (row.content_signature) {
    return {
      saveId: row.save_id,
      updatedAt: row.updated_at,
      seasonId: row.season_id ?? "",
      matchdayId: row.matchday_id ?? "",
      contentSignature: row.content_signature,
      saveVersion: row.save_version ?? 0,
      lineupDraftCount: row.lineup_draft_count ?? 0,
      transferHistoryCount: row.transfer_history_count ?? 0,
      matchdayResults: [],
      standingsApplyLogs: [],
      seasonSnapshots: [],
      disciplineResults: [],
    };
  }

  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  if (!season || !seasonState || !matchdayState) {
    return null;
  }

  const database = getDatabase();
  const transferHistoryRow = database
    .prepare("SELECT COUNT(*) AS count FROM transfer_history WHERE save_id = ?")
    .get(saveId) as { count: number };

  const metadata = buildVersionMetadataFromGameState({
    saveId: row.save_id,
    updatedAt: row.updated_at,
    gameState: {
      season,
      seasonState,
      matchdayState,
      saveVersion: Number.isFinite(gameMetadata?.saveVersion) ? gameMetadata!.saveVersion : 0,
    } as GameState,
    transferHistoryCount: transferHistoryRow.count,
  });

  database
    .prepare(
      `UPDATE saves
       SET content_signature = @contentSignature,
           save_version = @saveVersion,
           season_id = @seasonId,
           matchday_id = @matchdayId,
           lineup_draft_count = @lineupDraftCount,
           transfer_history_count = @transferHistoryCount
       WHERE save_id = @saveId`,
    )
    .run({
      saveId: metadata.saveId,
      contentSignature: metadata.contentSignature,
      saveVersion: metadata.saveVersion ?? 0,
      seasonId: metadata.seasonId,
      matchdayId: metadata.matchdayId,
      lineupDraftCount: metadata.lineupDraftCount,
      transferHistoryCount: metadata.transferHistoryCount,
    });

  return metadata;
}

type BaselineSourcePlayersCacheEntry = {
  signature: string;
  players: Player[];
};

let baselineSourcePlayersCache: BaselineSourcePlayersCacheEntry | null = null;

/**
 * S13: this module is loaded as a SEPARATE instance in the socket server (tsx)
 * and in the Next.js API route handlers (webpack bundle) — a plain module-scope
 * cache invalidated only by an in-process call (like the old `??= null` version
 * of this cache) can go stale forever in the *other* instance after a catalog
 * write, and never recovers even if a completely different process (e.g. a
 * one-off script) writes the catalog. So instead of relying purely on explicit
 * invalidation, every read is validated against a cheap DB-derived signature
 * (row count + max `updated_at`) — a changed catalog is detected regardless of
 * which process wrote it, matching the pattern used by the other
 * signature-validated caches (e.g. save-session-cache.ts).
 */
function computePlayerCatalogSignature(database: ReturnType<typeof getDatabase>) {
  const row = database
    .prepare("SELECT COUNT(*) AS count, MAX(updated_at) AS maxUpdatedAt FROM player_catalog")
    .get() as { count: number; maxUpdatedAt: string | null };
  return `${row.count}:${row.maxUpdatedAt ?? ""}`;
}

export function invalidateBaselineSourcePlayersCache() {
  baselineSourcePlayersCache = null;
}

function loadBaselineSourcePlayers(database = getDatabase()) {
  const signature = computePlayerCatalogSignature(database);
  if (baselineSourcePlayersCache && baselineSourcePlayersCache.signature === signature) {
    return baselineSourcePlayersCache.players;
  }

  const players = [...loadPlayerCatalog(database).values()];
  baselineSourcePlayersCache = { signature, players };
  return players;
}

function invalidateCatalogDerivedRuntimeCaches() {
  invalidateBaselineSourcePlayersCache();
  invalidateSaveSessionCache();
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compactBaselineWriteGuardEvents(
  events: PlayerBaselineWriteGuardEvent[],
  limit = 1000,
) {
  const byEventId = new Map<string, PlayerBaselineWriteGuardEvent>();
  for (const event of events) {
    byEventId.set(event.eventId, event);
  }
  return Array.from(byEventId.values())
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"))
    .slice(0, limit)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp, "de"));
}

function buildPlayerDelta(basePlayer: Player, player: Player) {
  const patch: Partial<Player> = {};
  for (const [key, value] of Object.entries(player) as Array<[keyof Player, Player[keyof Player]]>) {
    if (key === "id") {
      continue;
    }
    if (!valuesEqual(basePlayer[key], value)) {
      patch[key] = value as never;
    }
  }
  return patch;
}

function isPlayerSavePayload(value: unknown): value is PlayerSavePayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      ((value as { storage?: unknown }).storage === "delta" || (value as { storage?: unknown }).storage === "full"),
  );
}

function loadPlayerCatalog(database = getDatabase()) {
  const rows = database
    .prepare("SELECT player_id, payload_json FROM player_catalog ORDER BY player_id ASC")
    .all() as Array<{ player_id: string; payload_json: string }>;
  return new Map(rows.map((row) => [row.player_id, parseJsonColumn<Player>(row.payload_json)]));
}

function ensurePlayerCatalog(database: ReturnType<typeof getDatabase>, players: Player[], updatedAt: string) {
  const existingCount = (database.prepare("SELECT COUNT(*) AS count FROM player_catalog").get() as { count: number })
    .count;
  if (existingCount >= players.length) {
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO player_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)`,
  );
  for (const player of players) {
    insertStatement.run(player.id, JSON.stringify(player), updatedAt);
  }
}

export function upsertPlayerCatalogEntries(players: Player[], updatedAt = new Date().toISOString()) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO player_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  );

  for (const player of players) {
    statement.run(player.id, JSON.stringify(player), updatedAt);
  }

  invalidateCatalogDerivedRuntimeCaches();
}

export function patchPlayerCatalogFlavorEntries(
  flavorPatches: Map<string, { flavorDe: string; flavorEn: string }>,
  updatedAt = new Date().toISOString(),
) {
  if (flavorPatches.size === 0) return;

  const database = getDatabase();
  const selectStatement = database.prepare(
    "SELECT payload_json FROM player_catalog WHERE player_id = ?",
  );
  const updateStatement = database.prepare(
    `UPDATE player_catalog SET payload_json = ?, updated_at = ? WHERE player_id = ?`,
  );

  for (const [playerId, patch] of flavorPatches) {
    const row = selectStatement.get(playerId) as { payload_json: string } | undefined;
    if (!row) continue;

    const payload = parseJsonColumn<Player>(row.payload_json);
    if (!payload || typeof payload !== "object") continue;

    updateStatement.run(
      JSON.stringify({
        ...payload,
        flavorDe: patch.flavorDe,
        flavorEn: patch.flavorEn,
      }),
      updatedAt,
      playerId,
    );
  }

  invalidateCatalogDerivedRuntimeCaches();
}

export function upsertPlayerBaselineCatalogEntries(
  baselines: PlayerBaselineRecord[],
  updatedAt = new Date().toISOString(),
) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO player_baseline_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  );

  for (const baseline of baselines) {
    statement.run(baseline.playerId, JSON.stringify(baseline), updatedAt);
  }

  invalidateCatalogDerivedRuntimeCaches();
}

/**
 * Löscht den Save-spezifischen Patch-/Delta-Datensatz eines Spielers für GENAU
 * einen Save. Ein Re-Import des Katalog-Charakters darf nicht die
 * Save-individuellen Anpassungen anderer Saves zerstören (Bug S3).
 *
 * Bumpt außerdem `saves.updated_at` für den betroffenen Save, damit
 * Caches/den Version-Endpoint die Änderung bemerken.
 */
export function clearPlayerSavePatches(playerId: string, saveId: string, updatedAt = new Date().toISOString()) {
  const database = getDatabase();
  const result = database
    .prepare("DELETE FROM players WHERE save_id = ? AND player_id = ?")
    .run(saveId, playerId);

  if (result.changes > 0) {
    database.prepare("UPDATE saves SET updated_at = ? WHERE save_id = ?").run(updatedAt, saveId);
  }
}

/**
 * Explizites Opt-in für den seltenen Fall, dass ein Katalog-Re-Import
 * tatsächlich ALLE Saves betreffen soll (z.B. Dev-Tooling, das den globalen
 * Spieler-Katalog neu synchronisiert). Nicht der Default, damit ein
 * Re-Import nicht versehentlich Save-individuelle Anpassungen in fremden
 * Saves löscht.
 */
export function clearPlayerSavePatchesForAllSaves(playerId: string, updatedAt = new Date().toISOString()) {
  const database = getDatabase();
  const affectedSaveIds = database
    .prepare("SELECT DISTINCT save_id FROM players WHERE player_id = ?")
    .all(playerId) as Array<{ save_id: string }>;

  database.prepare("DELETE FROM players WHERE player_id = ?").run(playerId);

  if (affectedSaveIds.length > 0) {
    const touchStatement = database.prepare("UPDATE saves SET updated_at = ? WHERE save_id = ?");
    for (const row of affectedSaveIds) {
      touchStatement.run(updatedAt, row.save_id);
    }
  }
}

function loadPlayersForSave(saveId: string) {
  const database = getDatabase();
  const catalog = loadPlayerCatalog(database);
  const playersById = new Map(catalog);
  const rows = database
    .prepare("SELECT player_id, payload_json FROM players WHERE save_id = ? ORDER BY player_id ASC")
    .all(saveId) as Array<{ player_id: string; payload_json: string }>;

  for (const row of rows) {
    const payload = parseJsonColumn<unknown>(row.payload_json);
    if (isPlayerSavePayload(payload)) {
      if (payload.storage === "full") {
        playersById.set(row.player_id, payload.player);
        continue;
      }

      const basePlayer = catalog.get(row.player_id);
      if (basePlayer) {
        playersById.set(row.player_id, { ...basePlayer, ...payload.patch });
      }
      continue;
    }

    playersById.set(row.player_id, payload as Player);
  }

  return [...playersById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function replacePlayersForSave(
  saveId: string,
  players: Player[],
  catalogSourcePlayers: Player[],
  updatedAt: string,
  options?: { touchPlayerIds?: Set<string> },
) {
  const database = getDatabase();
  ensurePlayerCatalog(database, catalogSourcePlayers, updatedAt);
  const catalog = loadPlayerCatalog(database);

  const existingRows = database.prepare("SELECT player_id, payload_json FROM players WHERE save_id = ?").all(saveId) as Array<{
    player_id: string;
    payload_json: string;
  }>;
  const existingPayloadByPlayerId = new Map(existingRows.map((row) => [row.player_id, row.payload_json]));

  const upsertStatement = database.prepare(
    `INSERT INTO players (save_id, player_id, payload_json) VALUES (?, ?, ?)
     ON CONFLICT(save_id, player_id) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  const deleteStatement = database.prepare("DELETE FROM players WHERE save_id = ? AND player_id = ?");

  const touchPlayerIds = options?.touchPlayerIds;
  const playersToWrite = touchPlayerIds ? players.filter((player) => touchPlayerIds.has(player.id)) : players;
  const seenPlayerIds = new Set<string>();
  for (const player of playersToWrite) {
    seenPlayerIds.add(player.id);
    const basePlayer = catalog.get(player.id);
    const payload: PlayerSavePayload | null = basePlayer
      ? (() => {
          const patch = buildPlayerDelta(basePlayer, player);
          return Object.keys(patch).length ? { storage: "delta", patch } : null;
        })()
      : { storage: "full", player };

    if (!payload) {
      if (existingPayloadByPlayerId.has(player.id)) {
        deleteStatement.run(saveId, player.id);
      }
      continue;
    }

    const serialized = JSON.stringify(payload);
    if (existingPayloadByPlayerId.get(player.id) !== serialized) {
      upsertStatement.run(saveId, player.id, serialized);
    }
  }

  if (!touchPlayerIds) {
    for (const existingPlayerId of existingPayloadByPlayerId.keys()) {
      if (!seenPlayerIds.has(existingPlayerId)) {
        deleteStatement.run(saveId, existingPlayerId);
      }
    }
  }
}

function loadPlayerBaselinesForSave(saveId: string, fallbackBaselines?: PlayerBaselineRecord[]) {
  const database = getDatabase();
  const baselineCatalogRows = database
    .prepare("SELECT player_id, payload_json FROM player_baseline_catalog ORDER BY player_id ASC")
    .all() as Array<{ player_id: string; payload_json: string }>;
  const baselinesByPlayerId = new Map(
    baselineCatalogRows.map((row) => [row.player_id, parseJsonColumn<PlayerBaselineRecord>(row.payload_json)]),
  );
  const rows = database
    .prepare("SELECT payload_json FROM player_baselines WHERE save_id = ? ORDER BY player_id ASC")
    .all(saveId) as Array<{ payload_json: string }>;
  for (const row of rows) {
    const baseline = parseJsonColumn<PlayerBaselineRecord>(row.payload_json);
    baselinesByPlayerId.set(baseline.playerId, baseline);
  }

  if (baselinesByPlayerId.size) {
    return [...baselinesByPlayerId.values()].sort((left, right) => left.playerId.localeCompare(right.playerId));
  }
  return fallbackBaselines;
}

function ensurePlayerBaselineCatalog(
  database: ReturnType<typeof getDatabase>,
  baselines: PlayerBaselineRecord[] | undefined,
  updatedAt: string,
) {
  const baselineList = baselines ?? [];
  if (!baselineList.length) {
    return;
  }

  const existingCount = (database.prepare("SELECT COUNT(*) AS count FROM player_baseline_catalog").get() as {
    count: number;
  }).count;
  if (existingCount >= baselineList.length) {
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO player_baseline_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)`,
  );
  for (const baseline of baselineList) {
    insertStatement.run(baseline.playerId, JSON.stringify(baseline), updatedAt);
  }
}

function replacePlayerBaselinesForSave(
  saveId: string,
  baselines: PlayerBaselineRecord[] | undefined,
  updatedAt: string,
) {
  const database = getDatabase();
  ensurePlayerBaselineCatalog(database, baselines, updatedAt);
  const baselineCatalogRows = database
    .prepare("SELECT player_id, payload_json FROM player_baseline_catalog")
    .all() as Array<{ player_id: string; payload_json: string }>;
  const baselineCatalog = new Map(
    baselineCatalogRows.map((row) => [row.player_id, parseJsonColumn<PlayerBaselineRecord>(row.payload_json)]),
  );
  const deleteStatement = database.prepare("DELETE FROM player_baselines WHERE save_id = ?");
  const insertStatement = database.prepare(
    "INSERT INTO player_baselines (save_id, player_id, payload_json) VALUES (?, ?, ?)",
  );

  deleteStatement.run(saveId);
  for (const baseline of baselines ?? []) {
    const catalogBaseline = baselineCatalog.get(baseline.playerId);
    if (catalogBaseline && valuesEqual(catalogBaseline, baseline)) {
      continue;
    }
    insertStatement.run(saveId, baseline.playerId, JSON.stringify(baseline));
  }
}

function ensurePlayerPotentialForGameState(saveId: string, gameState: GameState): GameState {
  const hasRecords = (gameState.playerPotential?.length ?? 0) > 0;
  let withRecords: GameState;
  if (!hasRecords) {
    withRecords = {
      ...gameState,
      playerPotential: buildPlayerPotentialRecordsForSave({
        saveId,
        players: gameState.players,
        gameState,
      }),
    };
  } else if (!isPlayerPotentialModelCurrent(gameState.playerPotential)) {
    // Einmalige Migration bestehender Saves auf das aktuelle Potenzial-Modell
    // (Star-Uniform). Deterministisch aus dem Seed; kein neues Spiel nötig. Der
    // gestempelte modelVersion persistiert beim nächsten Speichern → läuft danach
    // nicht erneut.
    withRecords = {
      ...gameState,
      playerPotential: migratePlayerPotentialRecordsToCurrentModel({ saveId, gameState }),
    };
  } else {
    withRecords = gameState;
  }
  return {
    ...withRecords,
    playerPotential: reconcilePlayerPotentialRecordsForGameState({ gameState: withRecords }),
  };
}

function materializePersistedSave(row: SaveRow): PersistedSaveGame | null {
  const PERF_DEBUG = process.env.OLY_DEBUG_MATERIALIZE_TIMING === "1";
  const mark = (label: string) => {
    if (PERF_DEBUG) console.timeLog("materializePersistedSave", label);
  };
  if (PERF_DEBUG) console.time("materializePersistedSave");
  const saveId = row.save_id;
  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  const mappingReport = loadSingleton<MappingReport>("mapping_reports", saveId);
  mark("singletons loaded");

  if (!season || !seasonState || !matchdayState || !mappingReport) {
    return null;
  }

  const playerBaselines = loadPlayerBaselinesForSave(
    saveId,
    (gameMetadata as GameMetadata & { playerBaselines?: PlayerBaselineRecord[] } | null)?.playerBaselines,
  );
  mark("playerBaselines loaded");
  const gamePhase = inferCompletedGamePhase({ metadata: gameMetadata, season, seasonState, matchdayState });
  const loadedPlayers = loadPlayersForSave(saveId);
  mark("players loaded");
  const loadedTeams = loadCollection<Team>("teams", "team_id", saveId);
  const loadedRosters = loadCollection<RosterEntry>("rosters", "roster_id", saveId);
  const loadedContracts = loadCollection<Contract>("contracts", "contract_id", saveId);
  const loadedTransferListings = loadCollection<TransferListing>("transfer_listings", "listing_id", saveId);
  const loadedTransferHistory = loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId);
  const loadedLogs = loadCollection<GameLogEntry>("game_logs", "log_id", saveId);
  mark("collections loaded");
  const hydrated = hydrateGameStateMedia({
    ...(gamePhase ? { gamePhase } : {}),
    ...(gameMetadata?.seasonTransition ? { seasonTransition: gameMetadata.seasonTransition } : {}),
    ...(gameMetadata?.scenarioMeta ? { scenarioMeta: gameMetadata.scenarioMeta } : {}),
    ...(Number.isFinite(gameMetadata?.saveVersion) ? { saveVersion: gameMetadata?.saveVersion } : {}),
    ...(gameMetadata?.lastAppliedEventId !== undefined
      ? { lastAppliedEventId: gameMetadata.lastAppliedEventId }
      : {}),
    ...(gameMetadata?.appliedEventIds ? { appliedEventIds: gameMetadata.appliedEventIds } : {}),
    ...(gameMetadata?.seasonReviewState !== undefined ? { seasonReviewState: gameMetadata.seasonReviewState } : {}),
    ...(gameMetadata?.preSeasonWorkflowState !== undefined
      ? { preSeasonWorkflowState: gameMetadata.preSeasonWorkflowState }
      : {}),
    ...(playerBaselines ? { playerBaselines } : {}),
    ...(gameMetadata?.baselineWriteGuardEvents
      ? { baselineWriteGuardEvents: gameMetadata.baselineWriteGuardEvents }
      : {}),
    ...(gameMetadata?.playerProgressionEvents
      ? { playerProgressionEvents: gameMetadata.playerProgressionEvents }
      : {}),
    ...(gameMetadata?.playerPotential ? { playerPotential: gameMetadata.playerPotential } : {}),
    ...(gameMetadata?.playerMoraleState
      ? { playerMoraleState: gameMetadata.playerMoraleState }
      : {}),
    ...(gameMetadata?.playerRelationshipEvents
      ? { playerRelationshipEvents: gameMetadata.playerRelationshipEvents }
      : {}),
    // #1: Zugewiesenen Saison-Kapitän aus dem Kalt-Load wiederherstellen (Back-Compat:
    // fehlt das Feld in älteren Saves, bleibt das bisherige Auto-Select-Verhalten).
    ...(gameMetadata?.teamCaptains ? { teamCaptains: gameMetadata.teamCaptains } : {}),
    // #8: Persistierte Inbox-Status-Overrides (erledigt/verworfen) wiederherstellen.
    ...(gameMetadata?.gameInboxItems ? { gameInboxItems: gameMetadata.gameInboxItems } : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadedTeams,
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadedPlayers,
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadedRosters,
    contracts: loadedContracts,
    transferListings: loadedTransferListings,
    transferHistory: loadedTransferHistory,
    logs: loadedLogs,
    mappingReport,
  });
  mark("hydrateGameStateMedia done");
  // MIGRATION M1 (docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 5): einmalige, versionierte
  // Neuberechnung der noch NICHT abgerechneten Sponsorleitern auf die V3-Basisleiter. Sie laeuft
  // beim Laden, damit die anstehende Saisonabrechnung nicht noch einmal die Ausreisser der alten
  // Leiter auszahlt (gemessen am Live-Save: +34,2 C / −26,7 C gegen den Benchmark). Der Stempel im
  // Save (`seasonState.sponsorLadderMigrationVersion`) sorgt dafuer, dass sie GENAU EINMAL laeuft.
  // MIGRATION M2 (docs/APRON_UND_VERTRAGSFORMEN.md, Schritt 3): das Verhandlungs-Benchmark am
  // Vertrag nachtragen, damit Bestandsvertraege nicht anders besteuert werden als neue. Ganz
  // aussen, damit es die fertigen Roster sieht; idempotent (setzt nur fehlende Felder).
  // GEHALTSFAKTOR-BACKFILL (Chris: „salary factor muss bei allen sponsoren standardmäßig
  // berücksichtigt werden"): jeder noch nicht abgerechnete Vertrag traegt danach den Faktor der
  // LAUFENDEN Saison. Steht AUSSERHALB von M1, damit er auch die von M1 frisch gebauten Leitern
  // sieht, und innerhalb des Faktor-Seeds, damit er den echten Saisonfaktor liest statt der 1,0.
  const gameStateWithoutBaseline = withNegotiatedSalaryBenchmark(withNormalizedSeasonDisciplineSchedule(
    withSponsorSalaryFactorOfCurrentSeason(
    withMigratedSponsorLadders(
    normalizeLegacySponsors(
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        // Der Salary-Factor-Seed steht ganz innen: die Sponsor-Migration und die Leiter-Normalisierung
        // weiter aussen lesen den Faktor bereits — sie muessen den echten sehen, nicht die 1.0.
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(withSeededSeasonEconomyFactors(hydrated, saveId))), {
          saveId,
        }),
      ),
    ),
    ),
    ),
    ),
    saveId,
  ));
  mark("legacy normalization done");
  const baselineResult = ensurePlayerBaselines(gameStateWithoutBaseline, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt: row.created_at,
  });
  mark("ensurePlayerBaselines done");
  const withInjuryHistory = ensurePlayerInjuryHistoryForGameState(baselineResult.gameState);
  mark("ensurePlayerInjuryHistoryForGameState done");
  const gameStateWithPotential = ensurePlayerPotentialForGameState(saveId, withInjuryHistory);
  mark("ensurePlayerPotentialForGameState done");
  // Sonderregel: Nula gehört immer zu Project Suicide (idempotenter Backfill für bestehende Saves).
  const gameState = ensureNulaOnProjectSuicide(gameStateWithPotential);
  mark("ensureNulaOnProjectSuicide done");
  const gameStateWithScenarioMeta = gameState.scenarioMeta
    ? gameState
    : {
        ...gameState,
        scenarioMeta: buildScenarioMeta({ gameState }),
      };
  mark("scenarioMeta done");
  if (PERF_DEBUG) console.timeEnd("materializePersistedSave");

  return {
    saveId,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gameState: gameStateWithScenarioMeta,
  };
}

/** Load teams/players/rosters + season head without baselines, potential, or session cache. */
export function readSliceGameStateForSave(saveId: string): GameState | null {
  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const mappingReport = loadSingleton<MappingReport>("mapping_reports", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);

  if (!season || !seasonState || !matchdayState || !mappingReport) {
    return null;
  }

  const gamePhase = inferCompletedGamePhase({ metadata: gameMetadata, season, seasonState, matchdayState });
  const hydrated = hydrateGameStateMedia({
    ...(gamePhase ? { gamePhase } : {}),
    ...(gameMetadata?.scenarioMeta ? { scenarioMeta: gameMetadata.scenarioMeta } : {}),
    ...(Number.isFinite(gameMetadata?.saveVersion) ? { saveVersion: gameMetadata?.saveVersion } : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadCollection<Team>("teams", "team_id", saveId),
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadPlayersForSave(saveId),
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadCollection<RosterEntry>("rosters", "roster_id", saveId),
    contracts: [],
    transferListings: [],
    transferHistory: loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId),
    logs: [],
    mappingReport,
  });

  return normalizeLegacyRosterTargets(
    normalizeLegacyFinanceScale(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(hydrated), { saveId }),
    ),
  );
}

function persistSeasonDerivationsSidecarFromGameState(saveId: string, gameState: GameState) {
  const record = gameState.seasonState.persistedSeasonDerivations as
    | PersistedSeasonDerivationsRecord
    | null
    | undefined;
  if (record && record.seasonId === gameState.season.id) {
    writeSeasonDerivationsSidecar(saveId, record);
    return;
  }
  deleteSeasonDerivationsSidecar(saveId);
}

function materializePersistedSaveCached(row: SaveRow): PersistedSaveGame | null {
  const contentSignature = buildSaveSessionCacheSignature(row);
  const cached = readSaveSessionCache(row.save_id, row.updated_at, contentSignature);
  const perfStats = getPersistPerfStats();
  if (cached) {
    if (perfStats) perfStats.readHit += 1;
    return cached;
  }

  const perfStartedAt = perfStats ? Date.now() : 0;
  const save = materializePersistedSave(row);
  if (save) {
    writeSaveSessionCache(save, contentSignature);
  }
  if (perfStats) {
    perfStats.readMiss += 1;
    perfStats.readMissMs += Date.now() - perfStartedAt;
  }

  return save;
}

type PersistPerfStats = {
  writes: number;
  writeMs: number;
  readMiss: number;
  readMissMs: number;
  readHit: number;
};

function getPersistPerfStats(): PersistPerfStats | null {
  if (process.env.OLY_DEBUG_SAVE_TIMING !== "1") return null;
  const globalScope = globalThis as typeof globalThis & { __olyPersistPerf?: PersistPerfStats };
  globalScope.__olyPersistPerf ??= { writes: 0, writeMs: 0, readMiss: 0, readMissMs: 0, readHit: 0 };
  return globalScope.__olyPersistPerf;
}

export function readPersistPerfStats(): PersistPerfStats | null {
  const globalScope = globalThis as typeof globalThis & { __olyPersistPerf?: PersistPerfStats };
  return globalScope.__olyPersistPerf ?? null;
}

/**
 * Owner-ID, die als Urheber eines NEU angelegten Spielstands festgeschrieben wird.
 *
 * `ownerId` ist nur bei aktiviertem Login gesetzt (resolveSessionOwnerId gibt sonst null
 * zurueck). Ohne Login gibt es aber trotzdem genau einen Menschen an der Tastatur, und den
 * kennt das Team-Control-System laengst als `DEFAULT_ACTIVE_OWNER_ID` ("Chris") — dieselbe
 * Annahme, auf der dort die gesamte Zuordnung "meine Teams" beruht. Der Fallback erfindet
 * also niemanden, er benennt den bereits vorhandenen lokalen Benutzer.
 *
 * Leer bleibt das Feld nur fuer Spielstaende, die vor dieser Spalte entstanden sind — dort
 * ist der Urheber wirklich nicht mehr feststellbar, und die UI sagt das auch so.
 */
function resolveCreatingOwnerId(ownerId: string | null | undefined): string {
  return ownerId ?? DEFAULT_ACTIVE_OWNER_ID;
}

/**
 * IST AN DEN SPIELERWERTEN UEBERHAUPT ETWAS ANDERS? — der Kurzschluss vor der Baseline-Wache.
 *
 * GEMESSEN (`hwz8fk`, 2984 Spieler, 336 Kadereintraege, fuenf Speichervorgaenge in Folge): ein
 * Speichern kostet rund 1140 ms. Davon gehen ~200 ms in `ensurePlayerBaselines`, ~62 ms in das
 * Laden von `game_metadata` und der Baselines — und **~420 ms in `guardPlayerBaselineWrite`**, also
 * gut ein Drittel des gesamten Speicherns. Die Wache normalisiert dafuer JEDEN vorherigen und jeden
 * neuen Datensatz und rechnet Pruefsummen nach; bei knapp 3000 Spielern summiert sich das.
 *
 * WAS SIE IN DER REGEL FINDET: nichts. Spieler-Baselines sind der Stand bei Import („so kam der
 * Spieler ins Spiel"), sie aendern sich praktisch nie. Die Wache existiert fuer den Fall, dass
 * etwas sie doch ueberschreiben will — nicht fuer den Normalfall.
 *
 * DIESER VERGLEICH IST DER NORMALFALL, IN MIKROSEKUNDEN: tragen beide Seiten dieselben Spieler mit
 * derselben Pruefsumme und derselben Version, dann liefert die Wache nachweislich exakt
 * `previous` zurueck und KEIN Ereignis — jeder Datensatz laeuft dort in den Zweig
 * `previousChecksum === attemptedChecksum`. Das ist keine Vermutung: `tests/baseline-kurzschluss-
 * ist-deckungsgleich.test.ts` faehrt beide Wege am echten Datenbestand und vergleicht die
 * Ergebnisse Byte fuer Byte.
 *
 * VORSICHTIG IN JEDE RICHTUNG: fehlt irgendwo eine Pruefsumme, unterscheidet sich eine Version,
 * fehlt ein Spieler oder ist eine Seite leer, faellt der Vergleich auf `false` und die volle Wache
 * laeuft. Der Kurzschluss kann nur ueberspringen, nie entscheiden.
 */
export function baselinesSindDeckungsgleich(
  previous: PlayerBaselineRecord[] | undefined,
  next: PlayerBaselineRecord[] | undefined,
): previous is PlayerBaselineRecord[] {
  if (!previous || !next || previous.length === 0 || previous.length !== next.length) {
    return false;
  }
  const vorher = new Map<string, string>();
  for (const baseline of previous) {
    if (!baseline.checksum) return false;
    vorher.set(baseline.playerId, `${baseline.checksum}|${baseline.baselineVersion ?? ""}`);
  }
  for (const baseline of next) {
    if (!baseline.checksum) return false;
    if (vorher.get(baseline.playerId) !== `${baseline.checksum}|${baseline.baselineVersion ?? ""}`) {
      return false;
    }
  }
  return true;
}

function createPersistedSaveRecord(input: {
  saveId: string;
  name: string;
  status: SaveStatus;
  createdAt?: string;
  updatedAt?: string;
  /** Owner-ID des Anlegenden — greift nur beim INSERT (siehe Upsert unten). */
  createdBy?: string | null;
  gameState: GameState;
}) {
  const perfStats = getPersistPerfStats();
  const perfStartedAt = perfStats ? Date.now() : 0;
  const database = getDatabase();
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;
  const normalizedWithoutBaselines = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(input.gameState)), {
          saveId: input.saveId,
        }),
      ),
    ),
    input.saveId,
  );
  const phase = (label: string) => {
    if (process.env.OLY_DEBUG_SAVE_TIMING === "1") console.timeLog("createPersistedSaveRecord", label);
  };
  if (process.env.OLY_DEBUG_SAVE_TIMING === "1") console.time("createPersistedSaveRecord");
  phase("normalisierung fertig");

  const baselinePlayerIds = new Set([
    ...normalizedWithoutBaselines.rosters.map((entry) => entry.playerId),
    ...(normalizedWithoutBaselines.playerBaselines ?? []).map((entry) => entry.playerId),
  ]);
  const normalizedGameState = ensurePlayerBaselines(normalizedWithoutBaselines, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt,
    playerIds: baselinePlayerIds,
  }).gameState;
  phase("ensurePlayerBaselines fertig");
  const existingMetadata = loadSingleton<GameMetadata>("game_metadata", input.saveId);
  const existingBaselines = loadPlayerBaselinesForSave(
    input.saveId,
    (existingMetadata as GameMetadata & { playerBaselines?: PlayerBaselineRecord[] } | null)?.playerBaselines,
  );
  phase("metadata + baselines geladen");
  const guardedBaselineWrite = baselinesSindDeckungsgleich(existingBaselines, normalizedGameState.playerBaselines)
    ? { baselines: existingBaselines, events: [] as PlayerBaselineWriteGuardEvent[] }
    : guardPlayerBaselineWrite({
        previous: existingBaselines,
        next: normalizedGameState.playerBaselines,
        attemptedSource: "save_repository",
        timestamp: updatedAt,
      });
  phase("baseline-wache fertig");
  const baselineWriteGuardEvents = compactBaselineWriteGuardEvents([
    ...(existingMetadata?.baselineWriteGuardEvents ?? []),
    ...(normalizedGameState.baselineWriteGuardEvents ?? []),
    ...guardedBaselineWrite.events,
  ]);
  // Zuletzt vor dem Schreiben: Felder ohne Auskunft fallen weg (leere Verletzungs-Nachwehen auf
  // gesunden Wuerfen, der byte-identische Zwilling der Saison-Spielerwerte). Beim SCHREIBEN und
  // nicht beim Lesen — so kostet es einmal ein paar Millisekunden statt bei jedem Laden, und
  // bestehende Spielstaende schrumpfen beim naechsten Speichern von selbst.
  const guardedGameState: GameState = slimGameStateForWrite({
    ...normalizedGameState,
    playerBaselines: guardedBaselineWrite.baselines,
    baselineWriteGuardEvents,
  });

  const upsertSave = database.prepare(`
    INSERT INTO saves (
      save_id,
      name,
      status,
      created_at,
      updated_at,
      content_signature,
      save_version,
      season_id,
      matchday_id,
      lineup_draft_count,
      transfer_history_count,
      created_by
    )
    VALUES (
      @saveId,
      @name,
      @status,
      @createdAt,
      @updatedAt,
      @contentSignature,
      @saveVersion,
      @seasonId,
      @matchdayId,
      @lineupDraftCount,
      @transferHistoryCount,
      @createdBy
    )
    -- created_by steht bewusst NICHT im UPDATE-Zweig: es ist die Urheberschaft, nicht
    -- "wer zuletzt gespeichert hat". Jeder weitere Schreibvorgang laeuft durch genau
    -- diesen Upsert, ein Mitschreiben wuerde den Wert bei jedem Spielzug ueberschreiben.
    ON CONFLICT(save_id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = excluded.updated_at,
      content_signature = excluded.content_signature,
      save_version = excluded.save_version,
      season_id = excluded.season_id,
      matchday_id = excluded.matchday_id,
      lineup_draft_count = excluded.lineup_draft_count,
      transfer_history_count = excluded.transfer_history_count
  `);

  const transferHistoryCount = guardedGameState.transferHistory.length;
  const versionMetadata = buildVersionMetadataFromGameState({
    saveId: input.saveId,
    updatedAt,
    gameState: guardedGameState,
    transferHistoryCount,
  });

  const transaction = database.transaction(() => {
    upsertSave.run({
      saveId: input.saveId,
      name: input.name,
      status: input.status,
      createdAt,
      updatedAt,
      contentSignature: versionMetadata.contentSignature,
      saveVersion: versionMetadata.saveVersion ?? 0,
      seasonId: versionMetadata.seasonId,
      matchdayId: versionMetadata.matchdayId,
      createdBy: input.createdBy ?? "",
      lineupDraftCount: versionMetadata.lineupDraftCount,
      transferHistoryCount: versionMetadata.transferHistoryCount,
    });

    replaceSingleton("seasons", input.saveId, guardedGameState.season);
    replaceSingleton("season_states", input.saveId, guardedGameState.seasonState);
    replaceSingleton("matchday_states", input.saveId, guardedGameState.matchdayState);
    const transition = guardedGameState.seasonTransition;
    replaceSingleton("game_metadata", input.saveId, {
      gamePhase: guardedGameState.gamePhase,
      seasonTransition: transition,
      scenarioMeta: buildScenarioMeta({ gameState: guardedGameState }),
      saveVersion: guardedGameState.saveVersion,
      lastAppliedEventId: guardedGameState.lastAppliedEventId,
      appliedEventIds: guardedGameState.appliedEventIds,
      transitionStatus: transition?.status,
      currentStep: transition?.currentStep,
      completedSteps: transition?.completedSteps,
      seasonReviewState: guardedGameState.seasonReviewState,
      preSeasonWorkflowState: guardedGameState.preSeasonWorkflowState,
      baselineWriteGuardEvents: guardedGameState.baselineWriteGuardEvents,
      playerProgressionEvents: guardedGameState.playerProgressionEvents,
      playerPotential: guardedGameState.playerPotential,
      playerMoraleState: guardedGameState.playerMoraleState,
      playerRelationshipEvents: guardedGameState.playerRelationshipEvents,
      // #1: Zugewiesenen Saison-Kapitän dauerhaft schreiben (nicht nur im Session-Cache).
      teamCaptains: guardedGameState.teamCaptains,
      // #8: Inbox-Status-Overrides (erledigt/verworfen) dauerhaft schreiben.
      gameInboxItems: guardedGameState.gameInboxItems,
    } satisfies GameMetadata);
    replaceSingleton("mapping_reports", input.saveId, guardedGameState.mappingReport);
    replacePlayerBaselinesForSave(input.saveId, guardedGameState.playerBaselines, updatedAt);

    replaceCollection("teams", "team_id", input.saveId, guardedGameState.teams, (team) => team.teamId);
    replaceCollection("team_identities", "team_id", input.saveId, guardedGameState.teamIdentities, (identity) => identity.teamId);
    replacePlayersForSave(input.saveId, guardedGameState.players, loadBaselineSourcePlayers(), updatedAt);
    replaceCollection("disciplines", "discipline_id", input.saveId, guardedGameState.disciplines, (discipline) => discipline.id);
    replaceCollection("rosters", "roster_id", input.saveId, guardedGameState.rosters, (roster) => roster.id);
    replaceCollection("contracts", "contract_id", input.saveId, guardedGameState.contracts, (contract) => contract.id);
    replaceCollection("transfer_listings", "listing_id", input.saveId, guardedGameState.transferListings, (listing) => listing.id);
    appendOnlyCollection("transfer_history", "history_id", input.saveId, guardedGameState.transferHistory, (entry) => entry.id);
    appendOnlyCollection("game_logs", "log_id", input.saveId, guardedGameState.logs, (log) => log.id);
    enforceRollingSaveRetention(database, [input.saveId]);
  });

  transaction();
  invalidateStandingsOverviewCache(input.saveId);
  invalidateSeasonDerivationsCache(input.saveId);
  invalidateLegacyLineupLabContextCache(input.saveId);
  invalidateStandingsPreviewCache(input.saveId);
  invalidateArenaPreviewCache(input.saveId);

  const gameStateWithScenarioMeta = guardedGameState.scenarioMeta
    ? guardedGameState
    : {
        ...guardedGameState,
        scenarioMeta: buildScenarioMeta({ gameState: guardedGameState }),
      };

  const persistedSave = {
    saveId: input.saveId,
    name: input.name,
    status: input.status,
    createdAt,
    updatedAt,
    gameState: gameStateWithScenarioMeta,
  };

  writeSaveSessionCache(persistedSave, versionMetadata.contentSignature);
  persistSeasonDerivationsSidecarFromGameState(input.saveId, guardedGameState);

  if (perfStats) {
    perfStats.writes += 1;
    perfStats.writeMs += Date.now() - perfStartedAt;
    if (perfStats.writes % 20 === 0) {
      console.error(
        `[persist-perf] writes=${perfStats.writes} writeMs=${perfStats.writeMs} (avg ${Math.round(perfStats.writeMs / perfStats.writes)}ms) | readMiss=${perfStats.readMiss} readMissMs=${perfStats.readMissMs} (avg ${perfStats.readMiss ? Math.round(perfStats.readMissMs / perfStats.readMiss) : 0}ms) | readHit=${perfStats.readHit}`,
      );
    }
  }

  return persistedSave;
}

export function createSaveRepository(): SaveRepository {
  return {
    getActiveSave(ownerId?: string | null) {
      const database = getDatabase();

      // Per-owner pointer: when an ownerId is supplied AND that owner has an active_saves
      // pointer AND the pointed-to save still exists, return THAT save. Otherwise fall through
      // to the global (status='active', most recent) behavior. So: no ownerId (auth off) is
      // byte-for-byte the original behavior, and an owner without a pointer yet degrades
      // gracefully to the global active save.
      if (ownerId) {
        const pointer = database
          .prepare("SELECT save_id FROM active_saves WHERE owner_id = ?")
          .get(ownerId) as { save_id: string } | undefined;
        if (pointer) {
          // Only honor the pointer if the pointed-to save is STILL active. A global
          // activate (auth-off new game) archives the previous save via saves.status but
          // does not rewrite this pointer table — so a stale pointer can still reference a
          // now-archived save. Trusting it blindly resurrects the old save ("new game, old
          // save stays active"). If the pointer is stale, fall through to the global row.
          const pointerStatus = database
            .prepare("SELECT status FROM saves WHERE save_id = ?")
            .get(pointer.save_id) as { status?: string } | undefined;
          if (pointerStatus && pointerStatus.status !== "archived") {
            const pointedRow = loadSaveRow(pointer.save_id);
            if (pointedRow) {
              return materializePersistedSaveCached(pointedRow);
            }
          }
        }
      }

      const row = database
        .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
        .get() as SaveRow | undefined;
      if (!row) {
        return null;
      }

      const fullRow = loadSaveRow(row.save_id);
      return fullRow ? materializePersistedSaveCached(fullRow) : null;
    },
    getSaveById(saveId: string) {
      const row = loadSaveRow(saveId);
      return row ? materializePersistedSaveCached(row) : null;
    },
    getSaveVersionMetadata(saveId: string) {
      if (saveId === "active" || saveId === "current") {
        const database = getDatabase();
        const row = database
          .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
          .get() as SaveRow | undefined;
        return row ? loadSaveVersionMetadata(row.save_id) : null;
      }
      return loadSaveVersionMetadata(saveId);
    },
    listSaves() {
      const database = getDatabase();
      const rows = database
        .prepare("SELECT save_id, name, status, created_at, updated_at, created_by FROM saves ORDER BY updated_at DESC")
        .all() as SaveRow[];

      return rows.map<SaveSummary>((row) => ({
          saveId: row.save_id,
          name: row.name,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.created_by ? row.created_by : null,
          scenarioMeta: loadScenarioMetaForSummary(row.save_id, row.created_at),
      })).map((summary) => ({
        ...summary,
        saveMode: resolveFoundationSaveMode(summary),
      }));
    },
    setActiveSave(saveId: string, ownerId?: string | null) {
      const database = getDatabase();
      // NUR EXISTENZ PRÜFEN, NICHT LADEN.
      //
      // Hier stand `this.getSaveById(saveId)`. Das materialisiert den KOMPLETTEN Spielstand —
      // gemessen an Chris' Live-Datenbank rund 2,1 s je Durchgang (15 MB JSON aus sechs Tabellen,
      // geparst und normalisiert). Gebraucht wurde davon nichts ausser der Antwort „gibt es den
      // Save?".
      //
      // Schlimmer: der Rückgabewert am Ende lädt ein ZWEITES Mal kalt. Die Transaktion schreibt
      // `saves.updated_at`, und genau darauf schlägt der Sitzungs-Cache an
      // (`readSaveSessionCache` vergleicht `updated_at` UND `content_signature`) — der eben
      // gefüllte Cache-Eintrag ist damit sofort ungültig. Ein Spielstand-Wechsel kostete also
      // zweimal den vollen Ladeweg, hier gemessen ~4,5 s, auf dem Hetzner-Server entsprechend
      // mehr. Gemeldet von Chris: „kann gerade auch mein altes save nicht wieder aktiv setzen".
      //
      // Der Cache-Vergleich bleibt bewusst wie er ist: `content_signature` ist ein GROBER
      // Fingerabdruck (Saison, Spieltag, ein paar Zählerstände und letzte IDs) und taugt nicht als
      // alleiniger Schlüssel — eine Änderung, die keinen dieser Werte bewegt, würde sonst still
      // einen veralteten Stand ausliefern. Lieber einmal ehrlich laden als zweimal raten.
      const exists = database.prepare("SELECT 1 FROM saves WHERE save_id = ?").get(saveId);
      if (!exists) {
        return null;
      }

      const transaction = database.transaction(() => {
        const now = new Date().toISOString();
        if (ownerId) {
          // Per-owner activate: move ONLY this owner's pointer to the save and mark it active for
          // compatibility. Crucially we do NOT run the blanket archive — archiving every other
          // active save is exactly what would steal the other player's active save.
          database
            .prepare(
              "INSERT INTO active_saves (owner_id, save_id, updated_at) VALUES (?, ?, ?) " +
                "ON CONFLICT(owner_id) DO UPDATE SET save_id = excluded.save_id, updated_at = excluded.updated_at",
            )
            .run(ownerId, saveId, now);
          database.prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?").run(now, saveId);
        } else {
          // Global (auth-off / solo) behavior: blanket-archive every other active save, then
          // mark this one active.
          database.prepare("UPDATE saves SET status = 'archived' WHERE status = 'active' AND save_id != ?").run(saveId);
          database.prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?").run(now, saveId);
          // Keep the per-owner pointer table consistent: a global activate is THE active save
          // for the solo/auth-off world (only DEFAULT_ACTIVE_OWNER_ID has a pointer here), so
          // repoint any pointer that still references another (now-archived) save. Without this
          // the DEFAULT pointer keeps pointing at the archived previous save and getActiveSave
          // resurrects it — the "new game created but old save stays active" bug.
          database
            .prepare("UPDATE active_saves SET save_id = ?, updated_at = ? WHERE save_id != ?")
            .run(saveId, now, saveId);
        }
        enforceRollingSaveRetention(database, [saveId]);
      });
      transaction();

      return this.getSaveById(saveId);
    },
    createSaveFromSeed({ saveId, name, status, seedData, ownerId }) {
      // scheduleSeedId ties the initial season discipline schedule to this save's unique
      // saveId so every new save/season gets its own pairing + player-count rolls instead of
      // reusing the default "local-game-state" seed for every save (see season-discipline-schedule.ts).
      const gameState = createGameStateFromSeed(seedData, { scheduleSeedId: saveId });
      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        createdBy: resolveCreatingOwnerId(ownerId),
        // DIE EINE STELLE, AN DER EIN SPIELSTAND AUS DEM SEED GEBOREN WIRD. Hier bekommt er den
        // Sponsorsystem-Vermerk, damit alle Wege, die einen frischen Save anlegen (Cockpit
        // "Neues Spiel / Season 1", createSave, der Dev-Bootstrap), dasselbe Regelwerk haben —
        // und zwar ohne einen zweiten Schreibvorgang ueber den kompletten Spielstand.
        // Klone und Snapshots laufen ueber cloneSave und erben die Version ihrer Quelle.
        gameState: stampSponsorSystemVersion(gameState),
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be created from seed.`);
      }

      return persisted;
    },
    cloneSave({ sourceSaveId, saveId, name, status, ownerId }) {
      const source = this.getSaveById(sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${sourceSaveId} could not be found.`);
      }

      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        // Ein Klon ist ein NEUER Spielstand — Urheber ist, wer geklont hat, nicht der
        // Urheber der Quelle.
        createdBy: resolveCreatingOwnerId(ownerId),
        gameState: source.gameState,
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be cloned.`);
      }

      if (status === "active") {
        return this.setActiveSave(saveId, ownerId) ?? persisted;
      }

      return persisted;
    },
    createScenarioSnapshot({ sourceSaveId, saveId, name, status, scenarioMeta, ownerId }) {
      const source = this.getSaveById(sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${sourceSaveId} could not be found.`);
      }

      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        createdBy: resolveCreatingOwnerId(ownerId),
        gameState: withScenarioMeta(source.gameState, scenarioMeta),
      });

      if (!persisted) {
        throw new Error(`Scenario save ${saveId} could not be created.`);
      }

      if (status === "active") {
        return this.setActiveSave(saveId, ownerId) ?? persisted;
      }

      return persisted;
    },
    saveGameState({ saveId, name, status, gameState }) {
      const existing = loadSaveRow(saveId);
      const persisted = createPersistedSaveRecord({
        saveId,
        name: name ?? existing?.name ?? "Oly Save",
        status: status ?? existing?.status ?? "active",
        createdAt: existing?.created_at,
        gameState,
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be updated.`);
      }

      return persisted;
    },
    deleteSaves(saveIds: string[]) {
      const requestedIds = [...new Set(saveIds.filter((saveId) => Boolean(saveId)))];
      if (requestedIds.length === 0) {
        return [];
      }

      const database = getDatabase();
      /**
       * GESCHUETZT IST GENAU DAS, WAS `getActiveSave` LIEFERT — und sonst nichts.
       *
       * GEMELDET VON CHRIS: „Kannst du das game für mich löschen? ich bekomme es nicht weg".
       *
       * Hier stand:
       *
       *     SELECT save_id FROM saves WHERE status = 'active'      ← ohne ORDER BY, mit .get()
       *
       * `getActiveSave` liest DIESELBE Tabelle, aber mit `ORDER BY updated_at DESC LIMIT 1` — also
       * den ZULETZT BENUTZTEN. Ohne die Sortierung nimmt SQLite eine beliebige Zeile, faktisch die
       * mit der kleinsten rowid, also den AELTESTEN. Riegel und Resolver waren sich damit uneinig,
       * welcher Spielstand „der aktive" ist. Dass `saves.status` ein LEBENSZYKLUS ist und kein
       * Ladezustand, macht es scharf: am Live-Spielstand nachgemessen tragen ALLE SIEBEN
       * Spielstaende „active".
       *
       * Gemessen an Chris' Spielstand: der Riegel schuetzte `new-game-1784747079649-n90y4m`
       * (rowid 18, vom 22.07.) — genau den, den er loswerden wollte. Geladen war
       * `new-game-1786465783606-0kalpx` (zuletzt benutzt), und der war ungeschuetzt. Doppelt
       * falsch also. Und weil die Schleife stillschweigend `continue` macht, passierte auf dem
       * Schirm gar nichts: kein Fehler, keine Erklaerung, der Eintrag blieb einfach stehen.
       *
       * Geschuetzt sind ab jetzt beide Wege, die `getActiveSave` gehen kann: jeder gueltige
       * Besitzer-Zeiger aus `active_saves` (im Mehrspieler-Save haengt an jedem ein Mitspieler)
       * UND die globale Rueckfallebene, die ohne Zeiger greift. Nur Sortierung UND Tabelle
       * zusammen ergeben dieselbe Antwort wie der Resolver.
       */
      const activeSaveIds = new Set<string>();
      for (const row of database.prepare("SELECT save_id FROM active_saves").all() as Array<{
        save_id: string;
      }>) {
        // Ein Zeiger auf einen archivierten Stand ist abgestanden — `getActiveSave` ignoriert ihn
        // ebenfalls und faellt auf die globale Zeile zurueck.
        const status = database.prepare("SELECT status FROM saves WHERE save_id = ?").get(row.save_id) as
          | { status?: string }
          | undefined;
        if (status && status.status !== "archived") {
          activeSaveIds.add(row.save_id);
        }
      }
      const globalActiveRow = database
        .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
        .get() as { save_id: string } | undefined;
      if (globalActiveRow) {
        activeSaveIds.add(globalActiveRow.save_id);
      }

      const existsStatement = database.prepare("SELECT 1 FROM saves WHERE save_id = ?");
      const deleteSaveStatement = database.prepare("DELETE FROM saves WHERE save_id = ?");
      const childStatements = SAVE_CHILD_TABLES.map((table) => database.prepare(`DELETE FROM ${table} WHERE save_id = ?`));

      const deletedSaveIds: string[] = [];
      const transaction = database.transaction(() => {
        for (const saveId of requestedIds) {
          // Never delete a currently loaded save — the UI is expected to prevent this
          // selection up front, but this is the last line of defense against a broken app state.
          if (activeSaveIds.has(saveId)) {
            continue;
          }
          if (!existsStatement.get(saveId)) {
            continue;
          }
          for (const statement of childStatements) {
            statement.run(saveId);
          }
          deleteSaveStatement.run(saveId);
          deletedSaveIds.push(saveId);
        }
      });
      transaction();

      for (const saveId of deletedSaveIds) {
        invalidateSaveSessionCache(saveId);
        invalidateStandingsOverviewCache(saveId);
        invalidateSeasonDerivationsCache(saveId);
        invalidateLegacyLineupLabContextCache(saveId);
        invalidateStandingsPreviewCache(saveId);
        invalidateArenaPreviewCache(saveId);
        deleteSeasonDerivationsSidecar(saveId);
      }

      return deletedSaveIds;
    },
    deleteSave(saveId: string) {
      return this.deleteSaves([saveId]).includes(saveId);
    },
  };
}

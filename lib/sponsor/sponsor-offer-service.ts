import { randomUUID } from "@/lib/utils/random-id";

import type {
  GameState,
  SponsorArchetype,
  SponsorCurveShape,
  SponsorDemandProfile,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorRarity,
  SponsorTermSeasons,
  Team,
  TeamIdentity,
  TeamSponsorContract,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { pickSponsorBrandForOffer, buildGlobalParentUsageFromOffers } from "@/lib/sponsor/sponsor-brand-catalog";
import { appendSponsorBrandHistory, getRecentSponsorParentIds } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";
import {
  buildLeagueTeamQualityRanks,
} from "@/lib/sponsor/sponsor-team-quality-rank";
import {
  buildLockedRankPayoutLadder,
  buildMilestoneRankLabel,
  buildOfferCashAmounts,
  estimateExpectedPayout,
  getLeagueMinimumSalaryTotal,
  getSponsorCurveShapePayout,
  getSponsorRank32BaseAnchorSalary,
  getNextMilestoneRank,
  getPrizeMoneyReference,
  getSponsorPayoutForFinalRank,
  getSponsorOverperfConfig,
  getSponsorImprovementConfig,
  resolveSponsorEconomyAnchors,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { SPONSOR_RARITIES, getSponsorCurveFamily, mapArchetypeToCurveShape } from "@/lib/sponsor/sponsor-curve-shapes";
import {
  getDemandMultiplierForRarity,
  mapCurveShapeToArchetype,
  rollSponsorOfferSlate,
} from "@/lib/sponsor/sponsor-tier-pool";
import {
  buildBonusObjectiveComponent,
  buildFanInfrastructureSpecialComponent,
  buildGoldenObjectiveComponent,
  buildOverperformanceComponent,
  pickBonusObjective,
  pickGoldenObjective,
  resolveChallengeSlotIndex,
} from "@/lib/sponsor/sponsor-special-objectives";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";

// Liga-weite Anzeige-Normalisierung der Sponsor-Angebote ist deaktiviert: der Anker basiert noch auf der
// alten getSponsorPayoutForFinalRank-Kurve (+ Floor bei Rang 32), während das Settlement bereits die neue
// getSponsorPayoutForFinalRankAndTier-Kurve nutzt. Die Normalisierung bricht dadurch die Invariante
// Anzeige==Settlement. Erst wieder aktivieren, wenn der Anker auf die neue Kurve + effectiveBaseFloor läuft.
const SPONSOR_LEAGUE_NORMALIZATION_ENABLED = false;

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

function clampCash(value: number, min: number, max: number) {
  return roundCash(Math.max(min, Math.min(max, value)));
}

function getCurrentSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function getSportTargetRank(startRank: number | null): number {
  return getNextMilestoneRank(startRank);
}

/** Demand profile derived from rarity: legendär→elite, selten→ambitious, magisch→balanced, gewöhnlich→safe. */
function getDemandProfileForRarity(rarity: SponsorRarity): SponsorDemandProfile {
  switch (rarity) {
    case "legendär":
      return "elite";
    case "selten":
      return "ambitious";
    case "magisch":
      return "balanced";
    default:
      return "safe";
  }
}

function buildOffer(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  curveShape: SponsorCurveShape;
  rarity: SponsorRarity;
  rankTarget: number;
  startRank: number | null;
  commercialRating: number;
  slotIndex: number;
  salaryFactor: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  leagueMinSalary: number;
  forcePremiumElite?: boolean;
  teamQualityRank?: number | null;
  specialMode?: "standard" | "challenge";
}): SponsorOffer {
  const { team, identity, profile, curveShape, rarity, rankTarget, startRank, gameState, commercialRating, slotIndex, salaryFactor, leagueMinSalary, teamQualityRank, specialMode } = input;
  // Transition: der legacy archetype bleibt abgeleitet (family→archetype), damit die bestehende Marken-/
  // Sonderziel-/Cash-Infrastruktur unverändert weiterläuft, während curveShape/rarity die Payout-Kurve steuern.
  const archetype: SponsorArchetype = mapCurveShapeToArchetype(curveShape);
  const demandMult = getDemandMultiplierForRarity(rarity);
  const family = getSponsorCurveFamily(curveShape);
  const rarityOrder = SPONSOR_RARITIES[rarity].order;
  // P3: Verbesserungs-Modul jetzt PER PLATZ (familien-differenziert) statt binär; Überperformance-Modul
  // (familien-differenziert, rarity-skaliert) ersetzt das binäre beat_expected_rank-Special.
  const improvementCfg = getSponsorImprovementConfig(family, salaryFactor);
  const overperfCfg = getSponsorOverperfConfig(family, rarityOrder, salaryFactor);
  const { brand, parent, special } = pickSponsorBrandForOffer({
    seasonId: gameState.season.id,
    teamId: team.teamId,
    team,
    identity,
    profile,
    curveShape,
    rarity,
    slotIndex,
    usedParentBrandIds: input.usedParentBrandIds,
    recentParentBrandIds: input.recentParentBrandIds,
    globalParentUsage: input.globalParentUsage,
    forcePremiumElite: input.forcePremiumElite,
    specialMode: specialMode ?? "standard",
    gameState,
  });
  const isGolden = input.forcePremiumElite === true;
  const cashAmounts = buildOfferCashAmounts({ archetype, salaryFactor, rarity, leagueMinSalary, teamQualityRank, isGolden });
  // NEUE Kurven-Payout-Kurve steuert die Rang-Komponente: erreichbarer Upside = Kurven-Payout am Ziel-Rang
  // MINUS Sockel (Platz 32). rarity skaliert das Etat, curveShape verteilt es über die Tabelle. base/special
  // bleiben (Transition) über buildOfferCashAmounts (legacy stern/archetyp) berechnet.
  const rankCash = roundCash(
    Math.max(
      0,
      getSponsorCurveShapePayout(rankTarget, salaryFactor, rarity, curveShape, leagueMinSalary, teamQualityRank ?? null, isGolden) -
        getSponsorCurveShapePayout(32, salaryFactor, rarity, curveShape, leagueMinSalary, teamQualityRank ?? null, isGolden),
    ),
  );
  // P2 Sonderziel-Buff: den (jetzt rarity-gestaffelten, in buildOfferCashAmounts gedeckelten) specialCash
  // DIREKT als Sonderziel-Reward verwenden — die frühere 0.65/0.35-Verdünnung ist entfallen, damit ein
  // volles Sonderziel spürbar zahlt (~5/8/10/13 C je Rarity statt ~2–4 C). Challenge-Slot: Boden von 5 % auf
  // 8 % des Titel-Etats angehoben (sein Achsen-Rang-Ziel soll ebenfalls lohnender sein).
  const baseSpecialCash =
    specialMode === "challenge"
      ? roundCash(Math.max(cashAmounts.specialCash, cashAmounts.totalAtMaxRank * 0.08))
      : cashAmounts.specialCash;
  // Enhancement 1 (Kern): das (bereits erreichbare) Saison-Sonderziel soll den Unterhaltskosten-Teil
  // plus etwas extra abdecken — aber über ein Ziel, nicht über den Basisbetrag. Der Reward bekommt einen
  // an den tatsächlichen Gebäude-Unterhalt des Teams gekoppelten Floor (halber Unterhalt, gedeckelt,
  // salaryFactor-skaliert), sodass Teams mit mehr Gebäuden auch einen größeren erreichbaren Bonus haben.
  const teamUpkeep = calculateFacilityUpkeep(getTeamFacilityState(gameState, team.teamId));
  const upkeepSpecialFloor = roundCash(Math.min(teamUpkeep * 0.5, 6) * salaryFactor);
  const specialCash = roundCash(Math.max(baseSpecialCash, upkeepSpecialFloor));

  // Enhancement 2 (optional) + 3 (Feinschliff): Fan-Infrastruktur-Klausel (skaliert mit Income-Gebäude-
  // Stufe) und Überperformance-Bonus (Saison deutlich über der erwarteten Qualitäts-Platzierung). Beide
  // konservativ, salaryFactor-skaliert, binär bzw. gedeckelt — nur ausgezahlt, wenn das jeweilige Ziel
  // erreicht wird (siehe Settlement/Evaluator).
  const fanInfraReward = roundCash(2.5 * salaryFactor);
  // P3: Überperformance als eigenes, sichtbares, familien-differenziertes Modul (min(cap, rate × Plätze über
  // Erwartung), beim Signieren eingefroren) statt des binären 3-C-beat_expected_rank. Sicherheits-Familie hat
  // keins (overperfCfg == null → dafür XL-Basis); Teams ohne Luft nach oben ebenfalls (Builder gibt null).
  const overperfComponent = overperfCfg
    ? buildOverperformanceComponent({
        expectedRank: teamQualityRank,
        ratePerUnitC: overperfCfg.ratePerUnitC,
        cap: overperfCfg.cap,
      })
    : null;

  // TEIL B: das Saison-Sonderziel ist jetzt ein echtes Bonusziel aus dem 14+6-Pool (staged, anteilige
  // Auszahlung + Spotlight-Impuls in die Beliebtheit) statt des Legacy-Templates. Golden-Angebote bekommen
  // ein Golden-Ziel, Challenge-Angebote behalten ihr Achsen-Rang-Sonderziel (eigenes UI-Panel), Standard-
  // Angebote ziehen deterministisch ein archetyp-passendes Bonusziel. Fällt der Pool aus (kein Ziel für den
  // Archetyp), bleibt das Legacy-Sonderziel. `specialCash` (an den Gebäude-Unterhalt gekoppelt) bleibt der
  // Reward-Betrag. Teil-B-Ziele sind staged (kein Malus); die Legacy-/Challenge-Variante behält ihren Malus.
  const legacySpecialComponent: SponsorOfferComponent = {
    ...special,
    rewardCash: specialCash,
    penaltyCash:
      special.penaltyCash != null
        ? clampCash((specialCash * 0.4) / demandMult, 0.5, specialCash * 0.5)
        : undefined,
  };
  const bonusObjectiveInput = {
    gameState,
    team,
    identity,
    profile,
    rewardCash: specialCash,
    rarity,
    seasonId: gameState.season.id,
    teamQualityRank,
  };
  let specialComponent: SponsorOfferComponent = legacySpecialComponent;
  if (isGolden) {
    // Golden-Ziel zahlt 25 % über dem Standard-Sonderziel (das Golden-Los ist die seltene, dickste Karte).
    specialComponent = buildGoldenObjectiveComponent(
      pickGoldenObjective(gameState.season.id, team.teamId, curveShape, teamQualityRank),
      { ...bonusObjectiveInput, rewardCash: roundCash(specialCash * 1.25) },
    );
  } else if (specialMode !== "challenge") {
    const bonusKey = pickBonusObjective(gameState.season.id, team.teamId, curveShape, slotIndex, teamQualityRank);
    if (bonusKey) {
      specialComponent = buildBonusObjectiveComponent(bonusKey, bonusObjectiveInput);
    }
  }

  const components: SponsorOfferComponent[] = [
    {
      componentId: "base-cash",
      kind: "base",
      label: "Basis-Saisonzahlung",
      targetValue: cashAmounts.baseCash,
      rewardCash: cashAmounts.baseCash,
    },
    {
      componentId: "rank-target",
      kind: "rank",
      label: `Gewinnstufen: ${buildMilestoneRankLabel()}`,
      targetValue: rankTarget,
      rewardCash: rankCash,
      // WAVE 1 (Punkt 3): Rang-Malus 0.05→0.15, aber relativ zur Upside gedeckelt (max halber Rang-Reward),
      // damit der Malus nie die mögliche Belohnung übersteigt. Der ambitious-penaltyMult ×2 kommt on top
      // (applySponsorNegotiationToComponents).
      penaltyCash: clampCash(rankCash * 0.15 * demandMult, 0.5, rankCash * 0.5),
    },
    {
      componentId: "improvement-target",
      kind: "improvement",
      // P3: per-Platz statt binär — zahlt ratePerUnitC je verbessertem Platz ggü. Startrang, gedeckelt bei
      // maxUnits Plätzen. rewardCash = Cap (max) für Anzeige/Total; targetValue 1 = min. 1 Platz zum Zahlen.
      label: `+${improvementCfg.ratePerUnitC} C je verbessertem Platz · max ${improvementCfg.maxUnits}`,
      targetValue: 1,
      rewardCash: improvementCfg.cap,
      ratePerUnitC: improvementCfg.ratePerUnitC,
      maxUnits: improvementCfg.maxUnits,
    },
    specialComponent,
    // Immer-an Fan-Infrastruktur-Klausel — ABER nur, wenn das gezogene Sonderziel (specialComponent)
    // nicht ohnehin schon `fan_infrastructure` ist. Sonst landete die Klausel doppelt im Offer
    // (doppelter React-Key `special-fan-infrastructure` in der Reward-Liste + doppelt gezählter
    // rewardCash in totalUpsideEstimate).
    ...(specialComponent.specialKey === "fan_infrastructure"
      ? []
      : [buildFanInfrastructureSpecialComponent({ rewardCash: fanInfraReward })]),
    ...(overperfComponent ? [overperfComponent] : []),
  ];

  return {
    offerId: `${gameState.season.id}:${team.teamId}:${archetype}:${rarity}:${slotIndex}`,
    seasonId: gameState.season.id,
    teamId: team.teamId,
    archetype,
    curveShape,
    rarity,
    name: parent.name,
    flavor: input.forcePremiumElite ? `★ Golden Card · ${brand.flavor}` : brand.flavor,
    components,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
    commercialRating,
    sponsorBrandId: brand.id,
    sponsorParentBrandId: brand.parentBrandId,
    variantKey: brand.variantKey,
    demandProfile: getDemandProfileForRarity(rarity),
    teamQualityRank: teamQualityRank ?? undefined,
    isChallengeOffer: specialMode === "challenge",
    isGolden,
  };
}

export function buildSponsorOffersForTeam(input: {
  gameState: GameState;
  teamId: string;
}): SponsorOffer[] {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  if (!team) {
    return [];
  }
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
  const startRank = row?.startplatz ?? row?.rank ?? null;
  const commercialRating = buildSponsorCommercialRating({ gameState: input.gameState, teamId: input.teamId });
  // Feed 1 (TEIL A): fortgeschriebene Beliebtheit hebt/senkt den Stern-Deckel der Angebots-Generierung.
  const qualityRanks = buildLeagueTeamQualityRanks(rows, input.gameState.seasonState.beliebtheitByTeamId);
  const qualityRank = qualityRanks.get(input.teamId);
  if (!qualityRank) {
    return [];
  }
  // Golden-Los (Abschnitt 2.2): Beliebtheit hebt die Wahrscheinlichkeit, der Cooldown senkt sie.
  const beliebtheit = input.gameState.seasonState.beliebtheitByTeamId?.[input.teamId]?.value ?? null;
  const hadGoldenLastSeason =
    input.gameState.seasonState.goldenSponsorHistoryByTeamId?.[input.teamId] === true;
  // 5 Angebote: pro Slot eine (rarity, curveShape)-Paarung aus dem Slate-Wurf — DISTINCT Kurvenformen
  // (≤2/Familie), rarity-gedeckelt + beliebtheits-gehoben. Jeder Slot bekommt eigenen Golden-Los, und über
  // usedParentBrandIds (unten) unterschiedliche Marken.
  const SLOT_COUNT = 5;
  const slate = rollSponsorOfferSlate({
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    qualityRank,
    beliebtheit,
    hadGoldenLastSeason,
    teamCount: rows.length,
    slotCount: SLOT_COUNT,
  });
  const usedParentBrandIds: string[] = [];
  const recentParentBrandIds = getRecentSponsorParentIds(input.gameState, input.teamId);
  const globalParentUsage = buildGlobalParentUsageFromOffers(input.gameState.seasonState.sponsorOffersByTeamId);
  const salaryFactor = getCurrentSalaryFactor(input.gameState);
  const baseAnchorSalary = getSponsorRank32BaseAnchorSalary(input.gameState);
  const challengeSlotIndex = resolveChallengeSlotIndex(input.gameState.season.id, input.teamId, SLOT_COUNT);

  return slate.entries.map((entry, slotIndex) => {
    const rankTarget = getSportTargetRank(startRank);
    const offer = buildOffer({
      gameState: input.gameState,
      team,
      identity,
      profile,
      curveShape: entry.curveShape,
      rarity: entry.rarity,
      rankTarget,
      startRank,
      commercialRating: commercialRating.score,
      slotIndex,
      salaryFactor,
      leagueMinSalary: baseAnchorSalary,
      forcePremiumElite: slate.goldenCardSlots.includes(slotIndex),
      usedParentBrandIds,
      recentParentBrandIds,
      globalParentUsage,
      teamQualityRank: qualityRank.qualityRank,
      specialMode: slotIndex === challengeSlotIndex ? "challenge" : "standard",
    });
    if (offer.sponsorParentBrandId) {
      usedParentBrandIds.push(offer.sponsorParentBrandId);
    }
    return offer;
  });
}

function scaleOfferComponents(
  offer: SponsorOffer,
  scale: number,
  input?: { salaryFactor: number; leagueMinSalary: number },
): SponsorOffer {
  if (scale === 1) {
    return offer;
  }
  const components = offer.components.map((component) => {
    let rewardCash = roundCash(component.rewardCash * scale);
    if (component.kind === "base" && offer.archetype === "security" && input) {
      const floor = roundCash(resolveSponsorEconomyAnchors(input.salaryFactor, input.leagueMinSalary).effectiveBaseFloor);
      rewardCash = Math.max(rewardCash, floor);
    }
    return {
      ...component,
      targetValue:
        component.kind === "rank" || typeof component.targetValue !== "number"
          ? component.targetValue
          : roundCash(component.targetValue * scale),
      rewardCash,
      penaltyCash: component.penaltyCash != null ? roundCash(component.penaltyCash * scale) : undefined,
    };
  });
  return {
    ...offer,
    components,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
  };
}

function normalizeTeamSponsorOffers(input: {
  offers: SponsorOffer[];
  referenceRank: number;
  salaryFactor: number;
  leagueMinSalary: number;
}): SponsorOffer[] {
  const { offers, referenceRank, salaryFactor, leagueMinSalary } = input;
  if (offers.length === 0) {
    return offers;
  }
  // DEAKTIVIERT (Anzeige==Settlement): Diese Liga-Normalisierung skalierte die ANGEZEIGTEN Komponenten an
  // einen Anker aus der ALTEN Payout-Kurve (getSponsorPayoutForFinalRank, statischer Floor 32), während das
  // Settlement die NEUE Kalibrierung (getSponsorPayoutForFinalRankAndTier) unskaliert auszahlt — Ergebnis:
  // die Karte zeigte +12–30 % andere Beträge als real gezahlt wurden (26/32 Teams). Die per-Angebot-
  // Kalibrierung (buildOfferCashAmounts) trifft die Ziel-Bänder bereits und ist mit dem Settlement identisch;
  // eine zusätzliche Anzeige-Skalierung bricht die Invariante nur. Reaktivieren erst, wenn der Anker auf die
  // neue Kurve + effectiveBaseFloor umgestellt ist.
  if (!SPONSOR_LEAGUE_NORMALIZATION_ENABLED) {
    return offers;
  }
  const prizeRef = getPrizeMoneyReference(referenceRank, salaryFactor);
  const targetTotal = getSponsorPayoutForFinalRank(referenceRank, salaryFactor);
  const anchor = prizeRef > 0 ? (targetTotal + prizeRef) / 2 : targetTotal;
  if (anchor <= 0) {
    return offers;
  }

  const bestExpected = offers.reduce(
    (max, offer) => Math.max(max, estimateExpectedPayout(offer, referenceRank, leagueMinSalary)),
    0,
  );
  if (bestExpected <= 0) {
    return offers;
  }

  const ratio = bestExpected / anchor;
  if (ratio >= 0.9 && ratio <= 1.1) {
    return offers;
  }

  const scale = anchor / bestExpected;
  return offers.map((offer) => scaleOfferComponents(offer, scale, { salaryFactor, leagueMinSalary }));
}

function normalizeLeagueSponsorOffers(gameState: GameState, offersByTeamId: Record<string, SponsorOffer[]>) {
  const salaryFactor = getCurrentSalaryFactor(gameState);
  const baseAnchorSalary = getSponsorRank32BaseAnchorSalary(gameState);
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const nextOffers: Record<string, SponsorOffer[]> = {};

  for (const team of gameState.teams) {
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const referenceRank = row?.rank ?? row?.startplatz ?? 16;
    nextOffers[team.teamId] = normalizeTeamSponsorOffers({
      offers: offersByTeamId[team.teamId] ?? [],
      referenceRank,
      salaryFactor,
      leagueMinSalary: baseAnchorSalary,
    });
  }
  return nextOffers;
}

export function regenerateSponsorOffersForSeason(gameState: GameState, teamIds?: string[]): GameState {
  const seasonId = gameState.season.id;
  const targetTeamIds = teamIds ?? gameState.teams.map((team) => team.teamId);
  const nextOffers = { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}) };

  for (const teamId of targetTeamIds) {
    if (getTeamSponsorContract(gameState, teamId)) {
      continue;
    }
    nextOffers[teamId] = buildSponsorOffersForTeam({ gameState, teamId });
  }

  const normalizedOffers = normalizeLeagueSponsorOffers(gameState, nextOffers);

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: normalizedOffers,
    },
  };
}

export function ensureSeasonSponsorOffers(gameState: GameState): GameState {
  const seasonId = gameState.season.id;
  const existingOffers = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const nextOffers: Record<string, SponsorOffer[]> = {};
  let changed = false;

  for (const team of gameState.teams) {
    if (getTeamSponsorContract(gameState, team.teamId)) {
      nextOffers[team.teamId] = existingOffers[team.teamId] ?? [];
      continue;
    }
    const currentOffers = existingOffers[team.teamId] ?? [];
    const hasCurrentSeasonOffers =
      currentOffers.length === 5 && currentOffers.every((offer) => offer.seasonId === seasonId);
    if (!hasCurrentSeasonOffers) {
      nextOffers[team.teamId] = buildSponsorOffersForTeam({ gameState, teamId: team.teamId });
      changed = true;
    } else {
      nextOffers[team.teamId] = currentOffers;
    }
  }

  const normalizedOffers = normalizeLeagueSponsorOffers(gameState, nextOffers);

  if (!changed && normalizedOffers === nextOffers) {
    return gameState;
  }

  const offersChanged =
    changed ||
    Object.keys(normalizedOffers).some(
      (teamId) => normalizedOffers[teamId] !== (gameState.seasonState.sponsorOffersByTeamId ?? {})[teamId],
    );

  if (!offersChanged) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: normalizedOffers,
    },
  };
}

export { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";

function payBaseFirstInstallment(gameState: GameState, contract: TeamSponsorContract, saveId?: string): GameState {
  if (contract.payouts.baseFirstPaid) {
    return gameState;
  }
  const baseComponent = contract.components.find((component) => component.kind === "base");
  if (!baseComponent) {
    return gameState;
  }
  const payout = roundCash(baseComponent.rewardCash / 2);
  const teams = gameState.teams.map((team) =>
    team.teamId === contract.teamId ? { ...team, cash: roundCash(team.cash + payout) } : team,
  );
  const log: NonNullable<GameState["seasonState"]["sponsorPayoutLogs"]>[number] = {
    id: `sponsor-payout:${contract.seasonId}:${contract.teamId}:base_first:${Date.now()}`,
    saveId: saveId ?? gameState.seasonState.seasonId,
    seasonId: contract.seasonId,
    teamId: contract.teamId,
    phase: "base_first",
    componentId: baseComponent.componentId,
    cashDelta: payout,
    action: "apply",
    createdAt: new Date().toISOString(),
  };

  return {
    ...gameState,
    teams,
    seasonState: {
      ...gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [contract.teamId]: {
          ...contract,
          payouts: { ...contract.payouts, baseFirstPaid: true },
        },
      },
      sponsorPayoutLogs: [log, ...(gameState.seasonState.sponsorPayoutLogs ?? [])],
    },
  };
}

export function chooseSponsorOffer(input: {
  gameState: GameState;
  teamId: string;
  offerId: string;
  saveId?: string;
  termSeasons?: SponsorTermSeasons;
  /** When true, skip immediate base_first payout (used for AI auto-sign / balancing sims). */
  deferBaseFirstPayout?: boolean;
}): { gameState: GameState; contract: TeamSponsorContract | null; error?: string } {
  const offers = getTeamSponsorOffers(input.gameState, input.teamId);
  const offer = offers.find((entry) => entry.offerId === input.offerId) ?? null;
  if (!offer) {
    return { gameState: input.gameState, contract: null, error: "sponsor_offer_not_found" };
  }

  const termSeasons: SponsorTermSeasons = 1;

  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.teamId) ?? null;
  // Payouts werden bei der UNTERSCHRIFT eingefroren: die volle Rang-Payout-Leiter (pro Endrang) mit dem
  // Anker + salaryFactor zum Sign-Zeitpunkt berechnen und im Vertrag speichern. Das Settlement zahlt am Ende
  // aus dieser gelockten Leiter — keine Neuableitung aus gedrifteten Season-End-Ankern mehr. Identische
  // Parameter wie der Angebots-/Settlement-Pfad (buildOfferCashAmounts / getSponsorPayoutForFinalRankAndTier),
  // damit Anzeige == gelockte Leiter == Settlement.
  const salaryFactorAtSign = getCurrentSalaryFactor(input.gameState);
  const baseAnchorSalaryAtSign = getSponsorRank32BaseAnchorSalary(input.gameState);
  const lockedRankPayoutLadder = buildLockedRankPayoutLadder({
    salaryFactor: salaryFactorAtSign,
    // Rarity + curveShape bauen die Leiter über die Kurven-Payout-Kurve. Defensive Fallbacks nur für den
    // (praktisch nie erreichten) Fall eines Angebots ohne diese Felder — jedes buildSponsorOffersForTeam-
    // Angebot setzt beide bereits.
    rarity: offer.rarity ?? "magisch",
    curveShape: offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype),
    leagueMinSalary: baseAnchorSalaryAtSign,
    teamQualityRank: offer.teamQualityRank,
    isGolden: offer.isGolden,
  });
  let contract: TeamSponsorContract = {
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    offerId: offer.offerId,
    archetype: offer.archetype,
    curveShape: offer.curveShape,
    rarity: offer.rarity,
    name: offer.name,
    chosenAt: new Date().toISOString(),
    startRank: row?.startplatz ?? row?.rank ?? null,
    components: offer.components,
    payouts: {},
    commercialRating: offer.commercialRating,
    sponsorBrandId: offer.sponsorBrandId,
    sponsorParentBrandId: offer.sponsorParentBrandId,
    variantKey: offer.variantKey,
    termSeasons,
    seasonsRemaining: termSeasons,
    // Verhandlungs-Achse entfernt: neue Verträge tragen KEIN negotiationProfile mehr (Settlement behandelt
    // ein fehlendes Profil als „balanced" = Identität). demandProfile bleibt rein rarity-abgeleitet.
    demandProfile: offer.demandProfile,
    teamQualityRankAtSign: offer.teamQualityRank,
    isGolden: offer.isGolden,
    lockedRankPayoutLadder,
    salaryFactorAtSign,
  };

  let nextGameState: GameState = {
    ...input.gameState,
    seasonState: {
      ...input.gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(input.gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [input.teamId]: contract,
      },
    },
  };
  nextGameState = appendSponsorBrandHistory(nextGameState, input.teamId, offer.sponsorParentBrandId);
  if (!input.deferBaseFirstPayout) {
    nextGameState = payBaseFirstInstallment(nextGameState, contract, input.saveId);
  }
  const updatedContract = getTeamSponsorContract(nextGameState, input.teamId);
  return { gameState: nextGameState, contract: updatedContract };
}

function resolveAiSponsorArchetypePreference(input: {
  teamId: string;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
  powerRank: number | null;
}): SponsorArchetype | "balanced" {
  const cashPriority = input.profile?.bias.cashPriority ?? input.identity?.finances ?? 5;
  const starPriority = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  const valuePriority = input.profile?.bias.valuePriority ?? 5;
  const rank = input.powerRank;

  if (input.cashPressure >= 7 || cashPriority >= 8 || input.teamId === "R-R" || input.teamId === "C-C") {
    return "security";
  }
  if (starPriority >= 9 && rank != null && rank <= 6) {
    return "performance";
  }
  if (starPriority >= 8 && rank != null && rank <= 10) {
    return "performance";
  }
  if (valuePriority >= 8 && (rank ?? 20) >= 14) {
    return "security";
  }
  if ((input.profile?.preferredArchetypes.length ?? 0) >= 4 || input.profile?.fantasyTheme) {
    return "identity";
  }
  if ((input.identity?.ambition ?? 5) <= 4 && (rank ?? 20) >= 18) {
    return "security";
  }
  return "balanced";
}

function scoreOfferForAi(input: {
  offer: SponsorOffer;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
  powerRank?: number | null;
  teamId: string;
}): number {
  const { offer, profile, identity, cashPressure, powerRank, teamId } = input;
  const rank = powerRank ?? null;
  const preferredArchetype = resolveAiSponsorArchetypePreference({
    teamId,
    profile,
    identity,
    cashPressure,
    powerRank: rank,
  });

  let score = estimateExpectedPayout(offer, rank) * 3;
  // Rarity-Etat-Gewicht (order 0..3) statt Sterne — höhere Rarity ist mehr Etat wert.
  score += SPONSOR_RARITIES[offer.rarity ?? "magisch"].order * 4;

  // Familien-Präferenz (neuer Pfad): die Kurvenform-Familie zur bevorzugten Ausrichtung matchen.
  const family = offer.curveShape ? getSponsorCurveFamily(offer.curveShape) : null;
  if (preferredArchetype === "performance" && family === "titel") {
    score += 6;
  } else if (preferredArchetype === "security" && family === "sicherheit") {
    score += 6;
  }

  if (preferredArchetype === offer.archetype) {
    score += 22;
  } else if (preferredArchetype === "balanced") {
    if (offer.archetype === "identity") score += 12;
    if (offer.archetype === "security") score += 10;
    if (offer.archetype === "performance" && rank != null && rank <= 14) score += 8;
  } else if (preferredArchetype === "security" && offer.archetype === "performance") {
    score -= 18;
  } else if (preferredArchetype === "performance" && offer.archetype === "security") {
    score -= 8;
  }

  if (rank != null && rank >= 22 && offer.archetype === "performance") {
    score -= 25;
  }
  if (rank != null && rank <= 5 && offer.archetype === "security" && (profile?.bias.starPriority ?? 0) >= 8) {
    score -= 6;
  }

  return score;
}

export function chooseSponsorOfferForAiTeams(gameState: GameState, settingsMap?: Record<string, TeamControlSettings>): GameState {
  const controlSettings = settingsMap ?? buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let nextGameState = ensureSeasonSponsorOffers(gameState);

  // Build overview rows once — reused for all teams instead of O(n²) per-team calls.
  const overviewRows = buildTeamSeasonOverviewRows({ gameState: nextGameState });
  const rowByTeamId = new Map(overviewRows.map((row) => [row.teamId, row]));

  for (const team of nextGameState.teams) {
    if (getTeamSponsorContract(nextGameState, team.teamId)) {
      continue;
    }
    const control = controlSettings[team.teamId];
    if (control?.controlMode === "manual" || control?.controlMode === "passive") {
      continue;
    }
    const offers = getTeamSponsorOffers(nextGameState, team.teamId);
    if (offers.length === 0) {
      continue;
    }
    const identity = nextGameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(nextGameState, team.teamId);
    const row = rowByTeamId.get(team.teamId) ?? null;
    const cashPressure = row?.cash != null && row.cash < 0 ? 10 : row?.cash != null && row.cash < 20 ? 7 : 3;
    const powerRank = row?.rank ?? null;
    const bestOffer = [...offers].sort(
      (left, right) =>
        scoreOfferForAi({ offer: right, profile, identity, cashPressure, powerRank, teamId: team.teamId }) -
        scoreOfferForAi({ offer: left, profile, identity, cashPressure, powerRank, teamId: team.teamId }),
    )[0];
    if (!bestOffer) {
      continue;
    }
    const result = chooseSponsorOffer({
      gameState: nextGameState,
      teamId: team.teamId,
      offerId: bestOffer.offerId,
      deferBaseFirstPayout: true,
    });
    nextGameState = result.gameState;
  }

  return nextGameState;
}

export function buildSponsorChoiceSummary(gameState: GameState) {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const controlSettings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  return gameState.teams.map((team) => {
    const contract = getTeamSponsorContract(gameState, team.teamId);
    const offers = getTeamSponsorOffers(gameState, team.teamId);
    const control = controlSettings[team.teamId];
    const row = rows.find((entry) => entry.teamId === team.teamId) ?? null;
    const commercialRating = buildSponsorCommercialRating({ gameState, teamId: team.teamId });
    return {
      teamId: team.teamId,
      teamName: team.name,
      shortCode: team.shortCode,
      controlMode: control?.controlMode ?? "ai",
      hasContract: contract != null,
      contract,
      offers,
      commercialRating,
      requiresManualChoice: control?.controlMode === "manual" && !contract,
      cash: row?.cash ?? team.cash,
    };
  });
}

export function createSponsorChoiceConfirmToken(teamId: string, offerId: string) {
  return `SPONSOR_CHOICE:${teamId}:${offerId}:${randomUUID()}`;
}

export { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";

import { randomUUID } from "@/lib/utils/random-id";

import type {
  GameState,
  SponsorArchetype,
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
  buildOfferRankPayoutLadderPreview,
  getCurrentSponsorSalaryFactor,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import { applySpotlightPerkToComponents, buildSponsorOfferModuleIds } from "@/lib/sponsor/sponsor-modules";
import {
  mapSponsorCardToArchetype,
  rollSponsorOfferSlate,
} from "@/lib/sponsor/sponsor-tier-pool";
import {
  sponsorV3CardByKey,
  sponsorV3IsGoalOfferable,
  type SponsorV3CardKey,
} from "@/lib/sponsor/sponsor-v3-model";
import {
  buildBonusObjectiveComponent,
  buildGoldenObjectiveComponent,
  pickBonusObjective,
  pickGoldenObjective,
  resolveChallengeSlotIndex,
  sponsorObjectiveFamilyForKey,
} from "@/lib/sponsor/sponsor-special-objectives";
import { applySponsorV3ToOffers, getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";
import {
  buildSponsorV4AxisTerms,
  sponsorV4AxisLabel,
  sponsorV4AxisSpecialKey,
  sponsorV4OfferableAxes,
  type SponsorV4AxisKey,
} from "@/lib/sponsor/sponsor-v4-axes";

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

/**
 * DAS GERUEST EINES ANGEBOTS — MARKE, KURVE, RARITY, SONDERZIEL. KEINE BETRAEGE.
 *
 * Bis zum Cutover rechnete diese Funktion die Auszahlung nach ALTEM Recht aus (Kurven-Payout-Tabellen,
 * Meilenstein-Leiter, Überperformance-Modul, Tabellenziel-Modul) und das neue Modell überschrieb die
 * Beträge anschließend wieder. Diese zweite Rechenstelle ist ersatzlos entfallen: hier entsteht nur noch
 * die IDENTITÄT des Angebots — welche Marke, welche Kurve, welche Rarity, welches Sonderziel. Alle Zahlen
 * kommen aus `applySponsorV2ToOffers` (→ sponsor-v2-model), und zwar aus genau einer Rechenstelle.
 *
 * Die Komponenten werden deshalb mit `rewardCash: 0` angelegt. Diese Funktion ist bewusst NICHT exportiert:
 * ein Angebot verlässt das Modul ausschließlich durch `buildSponsorOffersForTeam`, und die Funktion setzt
 * die Beträge immer. `tests/sponsor-v1-erzeugung-tot.test.ts` sichert genau das ab.
 */
function buildOfferSkeleton(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  cardKey: SponsorV3CardKey;
  /** Achse dieser Karte (V4). Gesetzt = die Karte zahlt fuer die Achse statt fuer ein Sonderziel. */
  axisKey?: SponsorV4AxisKey | null;
  rarity: SponsorRarity;
  commercialRating: number;
  slotIndex: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
  teamQualityRank?: number | null;
  specialMode?: "standard" | "challenge";
  usedSpecialFamilies?: Set<string>;
}): SponsorOffer {
  const { team, identity, profile, cardKey, rarity, gameState, commercialRating, slotIndex, teamQualityRank, specialMode } = input;
  const card = sponsorV3CardByKey(cardKey);
  // Der Marken- und der Sonderziel-Katalog sind noch nach den drei alten Archetypen verschlagwortet; die
  // Karte wird dafür auf einen Eimer abgebildet (SPONSOR_CARD_ARCHETYPE). Der Archetyp ist ab hier
  // reines Katalog-Schlagwort — an der Auszahlung hängt er nicht mehr.
  const archetype: SponsorArchetype = mapSponsorCardToArchetype(cardKey, input.axisKey);
  const { brand, parent, special } = pickSponsorBrandForOffer({
    seasonId: gameState.season.id,
    teamId: team.teamId,
    team,
    identity,
    profile,
    archetype,
    rarity,
    slotIndex,
    usedParentBrandIds: input.usedParentBrandIds,
    recentParentBrandIds: input.recentParentBrandIds,
    globalParentUsage: input.globalParentUsage,
    forcePremiumElite: input.forcePremiumElite,
    specialMode: specialMode ?? "standard",
    gameState,
    usedSpecialFamilies: input.usedSpecialFamilies,
  });
  const isGolden = input.forcePremiumElite === true;

  // Das Saison-Sonderziel kommt aus dem 14+6-Pool (staged, anteilige Auszahlung + Spotlight-Impuls in die
  // Beliebtheit). Golden-Angebote bekommen ein Golden-Ziel, Challenge-Angebote behalten ihr Achsen-Rang-
  // Sonderziel (eigenes UI-Panel), Standard-Angebote ziehen deterministisch ein passendes Bonusziel. Fällt
  // der Pool aus, bleibt das Sonderziel der Markenvorlage stehen.
  //
  // NUR DIE ZWEI ZIELKARTEN TRAGEN UEBERHAUPT EIN SONDERZIEL. Sicherheit, Basis und Ambition sind reine
  // Kurven-Entscheidungen; eine Sonderziel-Zeile mit 0,0 C waere dort ein totes Modul und genau die
  // Anzeige, die das Settlement nie einloest.
  const bonusObjectiveInput = {
    gameState,
    team,
    identity,
    profile,
    rewardCash: 0,
    rarity,
    seasonId: gameState.season.id,
    teamQualityRank,
  };
  const goalStrengthRank = teamQualityRank ?? 16;
  let specialComponent: SponsorOfferComponent | null = card.goal
    ? { ...special, rewardCash: 0, penaltyCash: undefined }
    : null;

  // V4-ACHSENKARTE: die Zielkomponente ist die Achse selbst. Kein Katalogwurf, kein
  // Wahrscheinlichkeitsband — eine Achse misst den eigenen Zuwachs gegen die eigene Ausgangslage und
  // ist damit fuer jedes Team erfuellbar. Die Konditionen wandern in den `targetValue`, damit Karte,
  // Anzeige und Settlement dieselbe Zahl lesen und ein spaeterer Zustandswechsel den Vertrag nicht
  // nachtraeglich verschiebt.
  if (input.axisKey) {
    const axisTerms = buildSponsorV4AxisTerms(gameState, team.teamId, input.axisKey);
    specialComponent = {
      ...special,
      componentId: "axis-target",
      kind: "special",
      specialKey: sponsorV4AxisSpecialKey(input.axisKey),
      label: `Zielachse · ${sponsorV4AxisLabel(input.axisKey)}`,
      targetValue: `axisbase:${axisTerms.baseline};axisscale:${axisTerms.scale};axisoffset:${axisTerms.offset}`,
      stages: undefined,
      rewardCash: 0,
      penaltyCash: undefined,
    };
  } else if (card.goal) {
    if (isGolden) {
      const goldenKey = pickGoldenObjective(gameState.season.id, team.teamId, archetype, teamQualityRank);
      // Auch Golden-Ziele muessen im bepreisbaren Band liegen — sonst steht auf der Karte eine
      // Praemie, die dieses Team praktisch nicht holen kann.
      if (sponsorV3IsGoalOfferable(goldenKey, goalStrengthRank)) {
        specialComponent = buildGoldenObjectiveComponent(goldenKey, bonusObjectiveInput);
      }
    }
    if (specialComponent != null && specialComponent.specialKey == null) {
      specialComponent = { ...special, rewardCash: 0, penaltyCash: undefined };
    }
    if (!isGolden && specialMode !== "challenge") {
      const bonusKey = pickBonusObjective(
        gameState.season.id,
        team.teamId,
        archetype,
        slotIndex,
        teamQualityRank,
        input.usedSpecialFamilies,
        gameState,
        // KATALOG-FILTER (Entwurf 3B): angeboten wird nur, was fuer die Staerkeklasse DIESES Teams
        // im Wahrscheinlichkeitsband [0,15, 0,72] liegt. "Top 8" fuer den Tabellenletzten faellt
        // damit aus dem Katalog, statt wertlos herumzuliegen.
        (key) => sponsorV3IsGoalOfferable(key, goalStrengthRank),
      );
      if (bonusKey) {
        specialComponent = buildBonusObjectiveComponent(bonusKey, bonusObjectiveInput);
      }
    }
    // Faellt das Ziel durch den Filter (Golden-Ziel ausserhalb des Bandes, Markenvorlage ohne Key),
    // traegt die Karte keine Zielpraemie — sie ist dann eine reine Kurven-Karte und wird auch so
    // bepreist. Lieber eine Karte weniger im Slate als eine unerfuellbare Praemie.
    if (specialComponent != null && !sponsorV3IsGoalOfferable(specialComponent.specialKey, goalStrengthRank)) {
      specialComponent = null;
    }
  }

  const components: SponsorOfferComponent[] = [
    {
      componentId: "base-cash",
      kind: "base",
      label: "Basis-Saisonzahlung",
      targetValue: 0,
      rewardCash: 0,
    },
    {
      componentId: "rank-target",
      kind: "rank",
      label: "Gewinnstufen nach Endrang",
      targetValue: 1,
      rewardCash: 0,
    },
    ...(specialComponent ? [specialComponent] : []),
  ];

  // P4 Baukasten: Spotlight-Perk (nur legendär/golden) verstärkt den Beliebtheits-Impuls des Sonderziels —
  // rein Popularity-wirksam, cash-neutral.
  const perkedComponents = applySpotlightPerkToComponents(components, rarity, isGolden);

  const offer: SponsorOffer = {
    offerId: `${gameState.season.id}:${team.teamId}:${archetype}:${rarity}:${slotIndex}`,
    seasonId: gameState.season.id,
    teamId: team.teamId,
    archetype,
    rarity,
    name: parent.name,
    flavor: input.forcePremiumElite ? `★ Golden Card · ${brand.flavor}` : brand.flavor,
    components: perkedComponents,
    totalUpsideEstimate: 0,
    commercialRating,
    sponsorBrandId: brand.id,
    sponsorParentBrandId: brand.parentBrandId,
    variantKey: brand.variantKey,
    demandProfile: getDemandProfileForRarity(rarity),
    teamQualityRank: teamQualityRank ?? undefined,
    isChallengeOffer: specialMode === "challenge",
    isGolden,
  };
  offer.moduleIds = buildSponsorOfferModuleIds(offer);
  return offer;
}

export function buildSponsorOffersForTeam(input: {
  gameState: GameState;
  teamId: string;
  /**
   * Marken-Nutzung der GESAMTEN Liga, inklusive der Teams, die im selben Durchgang bereits erzeugt
   * wurden. Ohne diesen Durchreicher leitet die Funktion sie aus
   * `gameState.seasonState.sponsorOffersByTeamId` ab — also aus dem Stand VOR dem Lauf. Beim
   * ligaweiten Erzeugen (`ensureSeasonSponsorOffers` / `regenerateSponsorOffersForSeason`) bekommen
   * alle Teams denselben unveraenderten `gameState`, sodass sie einander nicht sehen und die
   * Eindeutigkeitsregel aus `sponsor-brand-catalog.ts` faktisch wirkungslos blieb: mehrere Teams
   * bekamen dieselbe Marke angeboten und am Ende unter Vertrag.
   */
  globalParentUsage?: Record<string, number>;
}): SponsorOffer[] {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  if (!team) {
    return [];
  }
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
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
  // 5 Angebote: pro Slot eine (rarity, Modellkurve)-Paarung aus dem Slate-Wurf — DISTINCT Kurven,
  // rarity-gedeckelt + beliebtheits-gehoben. Jeder Slot bekommt eigenen Golden-Los, und über
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
    // GEFILTERT STATT GEKLAMMERT: eine Achse, die dieses Team gar nicht bewegen kann (kein
    // Ausbauspielraum, kein Kaderwert), wird nicht angeboten, statt als wertlose Karte dazuliegen.
    offerableAxes: sponsorV4OfferableAxes(input.gameState, input.teamId),
  });
  const usedParentBrandIds: string[] = [];
  const recentParentBrandIds = getRecentSponsorParentIds(input.gameState, input.teamId);
  const globalParentUsage =
    input.globalParentUsage ?? buildGlobalParentUsageFromOffers(input.gameState.seasonState.sponsorOffersByTeamId);
  // Der Challenge-Slot muss auf einer der beiden ZIELKARTEN sitzen — nur sie tragen ueberhaupt ein
  // Sonderziel. Gewuerfelt wird deshalb unter den Zielkarten-Slots, nicht mehr unter allen fuenf.
  const goalSlotIndexes = slate.entries
    .map((entry, index) => (sponsorV3CardByKey(entry.cardKey).goal ? index : -1))
    .filter((index) => index >= 0);
  const challengeSlotIndex =
    goalSlotIndexes.length > 0
      ? goalSlotIndexes[
          resolveChallengeSlotIndex(input.gameState.season.id, input.teamId, goalSlotIndexes.length)
        ] ?? goalSlotIndexes[0]!
      : -1;

  // Slate-Anti-Wiederholung (Fable C3): über die Slots hinweg möglichst nur EIN Sonderziel je Familie.
  const usedSpecialFamilies = new Set<string>();

  const built = slate.entries.map((entry, slotIndex) => {
    const offer = buildOfferSkeleton({
      gameState: input.gameState,
      team,
      identity,
      profile,
      cardKey: entry.cardKey,
      axisKey: entry.axisKey ?? null,
      rarity: entry.rarity,
      commercialRating: commercialRating.score,
      slotIndex,
      forcePremiumElite: slate.goldenCardSlots.includes(slotIndex),
      usedParentBrandIds,
      recentParentBrandIds,
      globalParentUsage,
      teamQualityRank: qualityRank.qualityRank,
      specialMode: slotIndex === challengeSlotIndex ? "challenge" : "standard",
      usedSpecialFamilies,
    });
    if (offer.sponsorParentBrandId) {
      usedParentBrandIds.push(offer.sponsorParentBrandId);
    }
    const specialKey = offer.components.find((component) => component.kind === "special")?.specialKey ?? null;
    const family = sponsorObjectiveFamilyForKey(specialKey);
    if (family) {
      usedSpecialFamilies.add(family);
    }
    return offer;
  });

  // DIE EINZIGE STELLE, AN DER EIN ANGEBOT BETRAEGE BEKOMMT.
  //
  // Der Startrang der Saison ist die Basis des Platzierungsbonus in der Leiter — dieselbe Groesse,
  // gegen die der Preisgeld-Benchmark am Saisonende misst. Fehlt sie (Saison 1 vor dem ersten
  // Spieltag), tritt die Liga-Position der Staerkerangliste an ihre Stelle.
  const startRank =
    rows.find((entry) => entry.teamId === input.teamId)?.startplatz ?? qualityRank.leaguePosition;
  return applySponsorV3ToOffers({
    gameState: input.gameState,
    offers: built,
    cardKeys: slate.entries.map((entry) => entry.cardKey),
    axisKeys: slate.entries.map((entry) => entry.axisKey ?? null),
    goldenSlots: slate.goldenCardSlots,
    advanceSlots: slate.entries.map((entry) => entry.advance === true),
    teamId: input.teamId,
    startRank,
  });
}

export function regenerateSponsorOffersForSeason(gameState: GameState, teamIds?: string[]): GameState {
  const targetTeamIds = teamIds ?? gameState.teams.map((team) => team.teamId);
  const nextOffers = { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}) };

  // Wie in `ensureSeasonSponsorOffers`: die Marken-Nutzung muss waehrend des Laufs mitwachsen,
  // sonst erzeugen alle Ziel-Teams gegen denselben Ausgangsstand und koennen dieselbe Marke ziehen.
  // Gestartet wird mit den Angeboten, die NICHT neu erzeugt werden (andere Teams, bestehende Vertraege).
  const regenTargets = new Set(targetTeamIds);
  const globalParentUsage: Record<string, number> = {};
  const trackParentUsage = (offers: SponsorOffer[]) => {
    for (const offer of offers) {
      if (offer.sponsorParentBrandId) {
        globalParentUsage[offer.sponsorParentBrandId] = (globalParentUsage[offer.sponsorParentBrandId] ?? 0) + 1;
      }
    }
  };
  for (const [teamId, offers] of Object.entries(nextOffers)) {
    if (!regenTargets.has(teamId) || getTeamSponsorContract(gameState, teamId)) {
      trackParentUsage(offers ?? []);
    }
  }

  for (const teamId of targetTeamIds) {
    if (getTeamSponsorContract(gameState, teamId)) {
      continue;
    }
    const built = buildSponsorOffersForTeam({ gameState, teamId, globalParentUsage });
    nextOffers[teamId] = built;
    trackParentUsage(built);
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: nextOffers,
    },
  };
}

export function ensureSeasonSponsorOffers(gameState: GameState): GameState {
  const seasonId = gameState.season.id;
  const existingOffers = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const nextOffers: Record<string, SponsorOffer[]> = {};
  let changed = false;

  // Laufende Marken-Nutzung ueber die ganze Liga: startet leer und waechst mit jedem Team, dessen
  // Angebote hier feststehen — egal ob uebernommen oder neu erzeugt. Nur so sieht Team 20, welche
  // Marken die Teams 1..19 in DIESEM Durchgang schon belegt haben.
  const globalParentUsage: Record<string, number> = {};
  const trackParentUsage = (offers: SponsorOffer[]) => {
    for (const offer of offers) {
      if (offer.sponsorParentBrandId) {
        globalParentUsage[offer.sponsorParentBrandId] = (globalParentUsage[offer.sponsorParentBrandId] ?? 0) + 1;
      }
    }
  };

  for (const team of gameState.teams) {
    if (getTeamSponsorContract(gameState, team.teamId)) {
      const keptOffers = existingOffers[team.teamId] ?? [];
      nextOffers[team.teamId] = keptOffers;
      trackParentUsage(keptOffers);
      continue;
    }
    const currentOffers = existingOffers[team.teamId] ?? [];
    // Angebote aus einem Spielstand von VOR dem V3-Umbau tragen keine V3-Konditionen. Sie werden
    // ersetzt statt gerechnet — ein noch nicht unterschriebenes Angebot ist keine Zusage, und ein
    // Angebot ohne V3-Block koennte die Auszahlung gar nicht mehr beziffern.
    const hasCurrentSeasonOffers =
      currentOffers.length === 5 &&
      currentOffers.every((offer) => offer.seasonId === seasonId && getSponsorV3Terms(offer) != null);
    if (!hasCurrentSeasonOffers) {
      const built = buildSponsorOffersForTeam({ gameState, teamId: team.teamId, globalParentUsage });
      nextOffers[team.teamId] = built;
      trackParentUsage(built);
      changed = true;
    } else {
      nextOffers[team.teamId] = currentOffers;
      trackParentUsage(currentOffers);
    }
  }

  if (!changed) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: nextOffers,
    },
  };
}

export { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";


export function chooseSponsorOffer(input: {
  gameState: GameState;
  teamId: string;
  offerId: string;
  saveId?: string;
  termSeasons?: SponsorTermSeasons;
}): { gameState: GameState; contract: TeamSponsorContract | null; error?: string } {
  // Audit R2/A2: Server-Guard gegen Re-Sign. Ohne diesen Guard konnte ein zweiter POST /api/sponsor/choose
  // einen bestehenden Vertrag überschreiben (payouts:{} zurückgesetzt) und base_first ERNEUT auszahlen →
  // Basis-Überzahlung (0.5·A aus dem ersten Vertrag bleibt + volle Basis des neuen). Ein Team, das für die
  // laufende Saison bereits einen Vertrag hat, darf nicht erneut unterschreiben.
  if (getTeamSponsorContract(input.gameState, input.teamId)) {
    return { gameState: input.gameState, contract: null, error: "sponsor_contract_already_signed" };
  }
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
  // damit Anzeige == gelockte Leiter == Settlement.
  const salaryFactorAtSign = getCurrentSponsorSalaryFactor(input.gameState);
  // Gelockte Leiter über den GETEILTEN Preview-Builder bauen — exakt dieselbe Funktion, die die Karte
  // für die Anzeige nutzt (buildOfferRankPayoutLadderPreview). Damit sind Anzeige == gelockte Leiter ==
  // Settlement per Konstruktion, ohne parallele Sign-Logik, die auseinanderdriften könnte.
  const lockedRankPayoutLadder = buildOfferRankPayoutLadderPreview(input.gameState, offer);
  let contract: TeamSponsorContract = {
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    offerId: offer.offerId,
    archetype: offer.archetype,
    // Nur noch fuer Altangebote gesetzt: neue Angebote tragen keine Legacy-Kurvenform mehr. Das Feld
    // bleibt am Vertrag, damit ein aus einem Alt-Spielstand unterschriebenes Angebot seine Form behaelt.
    ...(offer.curveShape ? { curveShape: offer.curveShape } : {}),
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
    // Die eingefrorenen Konditionen wandern 1:1 vom Angebot in den Vertrag. Fehlt das Feld — nur bei
    // einem Angebot moeglich, das VOR dem V3-Umbau erzeugt und erst jetzt unterschrieben wurde —,
    // holt die Leiter-Migration (`sponsor-v3-migration.ts`) es beim naechsten Laden nach.
    ...(offer.sponsorV3 ? { sponsorV3: offer.sponsorV3 } : {}),
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
  // Sponsorengeld flieszt grundsaetzlich am Saisonende (sponsor-settlement-service). Frueher wurde
  // beim Unterschreiben IMMER die halbe Basisrate ausgezahlt; das Settlement zahlte danach nur noch
  // die zweite Haelfte. Das hatte zwei Nachteile: die angezeigte Saison-Summe sackte im Moment des
  // Abschlusses ab (ohne dass der Vertrag weniger wert war), und am Saisonende kam entsprechend
  // wenig nach — obwohl genau dann Gehaelter und Transfers zu bezahlen sind.
  //
  // VORSCHUSS-KARTEN sind die bewusste Ausnahme und genau deshalb eine Entscheidung: wer sie waehlt,
  // holt sich Liquiditaet fuers Transferfenster und zahlt dafuer eine Gebuehr. Der Vorschuss wird am
  // Saisonende samt Gebuehr wieder verrechnet — er ist vorgezogenes eigenes Geld, kein Zuschuss.
  const advance = offer.sponsorV3?.advance ?? null;
  if (advance && advance.amount > 0) {
    nextGameState = {
      ...nextGameState,
      teams: nextGameState.teams.map((team) =>
        team.teamId === input.teamId
          ? { ...team, cash: Math.round((team.cash + advance.amount) * 10) / 10 }
          : team,
      ),
      seasonState: {
        ...nextGameState.seasonState,
        sponsorPayoutLogs: [
          {
            id: `sponsor-payout:${nextGameState.season.id}:${input.teamId}:advance:${randomUUID()}`,
            saveId: input.saveId ?? "",
            seasonId: nextGameState.season.id,
            teamId: input.teamId,
            phase: "base_first" as const,
            componentId: "v4_advance",
            cashDelta: advance.amount,
            action: "apply" as const,
            createdAt: new Date().toISOString(),
          },
          ...(nextGameState.seasonState.sponsorPayoutLogs ?? []),
        ],
      },
    };
  }
  nextGameState = appendSponsorBrandHistory(nextGameState, input.teamId, offer.sponsorParentBrandId);
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

/**
 * DIE KI-WAHL IST TRIVIAL GEWORDEN — und das ist die Pointe des Entwurfs.
 *
 * Alle Karten eines Slates haben denselben Erwartungswert; oekonomisch kann die KI nichts falsch
 * machen. Bewertet wird deshalb ausschliesslich die RISIKOPRAEFERENZ: ein klammes oder
 * sicherheitsorientiertes Team nimmt die Sicherheitskarte, ein ehrgeiziges die Ambitionskarte,
 * ein steuerfreudiges die Zielkarte. Der frueher hier stehende Erwartungswert-Term (`payout * 3`)
 * plus Rarity-Etat-Gewicht ist ersatzlos entfallen: er belohnte genau die Vertrags-Lotterie, die
 * V3 abgeschafft hat.
 */
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

  let score = 0;
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

  // Flavour-Feinschliff bei Gleichstand: hoehere Rarity heisst groesserer Hebel (nicht mehr Geld) —
  // wer ohnehin Risiko sucht, nimmt bei gleicher Ausrichtung die groessere Karte, ein klammes Team
  // die kleinere. Deterministischer Tiebreak ueber die offerId, damit die Wahl reproduzierbar bleibt.
  const rarityOrder = SPONSOR_RARITIES[offer.rarity ?? "magisch"].order;
  score += (preferredArchetype === "security" ? -1 : 1) * rarityOrder * 0.5;
  score += (offer.offerId.length % 7) * 0.01;

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
    // Sponsor ist Pflicht → nur das MANUELL gesteuerte (menschliche) Team wählt selbst.
    // Passive Teams werden nicht aktiv gemanagt und bekommen daher — wie echte KI-Teams —
    // automatisch das beste Angebot signiert, damit kein Team ohne Vertrag in die
    // Gehaltsabrechnung läuft (sonst Preview≠Apply beim Gehalt).
    if (control?.controlMode === "manual") {
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

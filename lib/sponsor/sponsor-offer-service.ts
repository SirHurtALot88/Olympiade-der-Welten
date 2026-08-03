import { randomUUID } from "@/lib/utils/random-id";

import type {
  AiSeasonStrategy,
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
  sponsorV3AnchorWeights,
  sponsorV3CardByKey,
  sponsorV3DownsideShortfall,
  SPONSOR_V4_AXIS_PBAR,
  type SponsorV3CardKey,
} from "@/lib/sponsor/sponsor-v3-model";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { resolveChallengeSlotIndex } from "@/lib/sponsor/sponsor-special-objectives";
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
  /** WO auf der Sponsor-Ligaleiter dieses Angebot sein Geld hat (sponsor-liga-leiter.ts). */
  curveShape: SponsorCurveShape;
  rarity: SponsorRarity;
  commercialRating: number;
  slotIndex: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
  teamQualityRank?: number | null;
  specialMode?: "standard" | "challenge";
}): SponsorOffer {
  const { team, identity, profile, cardKey, rarity, gameState, commercialRating, slotIndex, teamQualityRank, specialMode } = input;
  // Der Marken- und der Sonderziel-Katalog sind noch nach den drei alten Archetypen verschlagwortet; die
  // Karte wird dafür auf einen Eimer abgebildet (SPONSOR_CARD_ARCHETYPE). Der Archetyp ist ab hier
  // reines Katalog-Schlagwort — an der Auszahlung hängt er nicht mehr.
  const archetype: SponsorArchetype = mapSponsorCardToArchetype(cardKey, input.axisKey);
  const { brand, parent } = pickSponsorBrandForOffer({
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
  });
  const isGolden = input.forcePremiumElite === true;

  // DAS SONDERZIEL EINER KARTE IST DIE ACHSE — SONST NICHTS. Bis 2026-08 zog dieser Zweig zusaetzlich
  // aus einem 27+6-Bonus-/Golden-Katalog (sponsor-special-objectives.ts, Katalog inzwischen entfernt).
  // Das Audit (scripts/sponsor-ziele-audit.ts; 1024 gemessene Angebots-Komponenten ueber 8 Saison-Seeds
  // x 32 Teams) zeigte: JEDE einzige Komponente war eine der fuenf Achsen, KEINE einzige ein Katalog-
  // Ziel. Grund: `SPONSOR_V3_CARDS` fuehrt seit dem V4-Umbau nur noch `basis` (kein Ziel) und `achse`
  // (Ziel = die Achse), und jede Achsenkarte traegt ihr `axisKey` — der Katalog-Zweig unten lief bei
  // JEDER Angebotserzeugung durch und wurde sofort wieder verworfen. NUR DIE ACHSENKARTEN TRAGEN
  // UEBERHAUPT EIN SONDERZIEL: die Basis-Karte (slotIndex 0) ist eine reine Kurven-Entscheidung; eine
  // Sonderziel-Zeile mit 0,0 C waere dort ein totes Modul und genau die Anzeige, die das Settlement nie
  // einloest.
  let specialComponent: SponsorOfferComponent | null = null;

  // V4-ACHSENKARTE: die Zielkomponente ist die Achse selbst. Kein Katalogwurf, kein
  // Wahrscheinlichkeitsband — eine Achse misst den eigenen Zuwachs gegen die eigene Ausgangslage und
  // ist damit fuer jedes Team erfuellbar. Die Konditionen wandern in den `targetValue`, damit Karte,
  // Anzeige und Settlement dieselbe Zahl lesen und ein spaeterer Zustandswechsel den Vertrag nicht
  // nachtraeglich verschiebt.
  if (input.axisKey) {
    const axisTerms = buildSponsorV4AxisTerms(gameState, team.teamId, input.axisKey);
    specialComponent = {
      componentId: "axis-target",
      kind: "special",
      specialKey: sponsorV4AxisSpecialKey(input.axisKey),
      label: `Zielachse · ${sponsorV4AxisLabel(input.axisKey)}`,
      targetValue: `axisbase:${axisTerms.baseline};axisscale:${axisTerms.scale};axisoffset:${axisTerms.offset}`,
      stages: undefined,
      rewardCash: 0,
      penaltyCash: undefined,
    };
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
    // Die Kurvenform ist wieder ein ERZEUGUNGS-Feld statt nur Altvertrags-Erinnerung: sie entscheidet
    // via `sponsorKurvenLeiter` (sponsor-liga-leiter.ts), WO auf der Ligaleiter dieses Angebot sein
    // Geld hat. Der Doku-Kommentar am Typ selbst ("NUR NOCH LESEN") gilt damit nur noch fuer die
    // Spielstaende von VOR diesem Umbau.
    curveShape: input.curveShape,
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

  const built = slate.entries.map((entry, slotIndex) => {
    const offer = buildOfferSkeleton({
      gameState: input.gameState,
      team,
      identity,
      profile,
      cardKey: entry.cardKey,
      axisKey: entry.axisKey ?? null,
      curveShape: entry.curveShape,
      rarity: entry.rarity,
      commercialRating: commercialRating.score,
      slotIndex,
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

  // DIE EINZIGE STELLE, AN DER EIN ANGEBOT BETRAEGE BEKOMMT.
  //
  // Der Startrang der Saison bestimmt den Sockel der Ligaleiter UND den Erwartungsanker, gegen den
  // jede Kurvenform normiert wird (sponsor-liga-leiter.ts). Fehlt er (Saison 1 vor dem ersten
  // Spieltag), tritt die Liga-Position der Staerkerangliste an seine Stelle.
  const startRank =
    rows.find((entry) => entry.teamId === input.teamId)?.startplatz ?? qualityRank.leaguePosition;
  return applySponsorV3ToOffers({
    gameState: input.gameState,
    offers: built,
    cardKeys: slate.entries.map((entry) => entry.cardKey),
    axisKeys: slate.entries.map((entry) => entry.axisKey ?? null),
    curveShapes: slate.entries.map((entry) => entry.curveShape),
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
    // Unbedingt statt optional: seit dem Ligaleiter-Umbau erzeugt jedes Angebot seine Kurvenform
    // selbst (sponsor-tier-pool.ts), und ein Alt-Angebot ohne sie bekommt sie beim Laden ueber
    // `normalizeLegacySponsors` (save-repository.ts) nachgetragen — `offer.curveShape` ist an
    // dieser Stelle also nie mehr undefined.
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
/**
 * WIE GUT PASST DIESE ACHSE ZU DIESEM TEAM? Schaetzung des Erfuellungsgrads, den das Team mit
 * seiner Spielweise realistisch erreicht — 0 bis 1.
 *
 * Das ist bewusst eine HEURISTIK und keine Simulation: die KI kennt ihren eigenen Saisonplan so
 * wenig wie ein Mensch am Saisonstart. Sie muss aber ueberhaupt schaetzen, sonst waehlt sie
 * blind — und seit die Karten sich ueber die Achse unterscheiden, ist Blindwahl ein echter
 * Nachteil gegenueber einem Menschen, der seine Achse kennt.
 */
function estimateAxisFitForAi(input: {
  axisKey: SponsorV4AxisKey;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cash: number;
  rosterSize: number;
  rosterOpt: number;
}): number {
  const bias = input.profile?.bias;
  const cashPriority = bias?.cashPriority ?? input.identity?.finances ?? 5;
  const starPriority = bias?.starPriority ?? input.identity?.ambition ?? 5;
  const valuePriority = bias?.valuePriority ?? 5;
  const depthPreference = bias?.rosterDepthPreference ?? 5;
  const scale10 = (value: number) => Math.max(0, Math.min(1, value / 10));

  switch (input.axisKey) {
    case "ausbau":
      // Gebaeudestufen kosten Cash und sonst nichts — wer welchen hat, schafft die Achse sicher.
      return input.cash >= 40 ? 0.9 : input.cash >= 20 ? 0.6 : 0.2;
    case "wachstum":
      // Kaderwert waechst ueber Zukaeufe und Entwicklung; beides braucht Budget und Ehrgeiz.
      return 0.35 + 0.4 * scale10((starPriority + valuePriority) / 2) * (input.cash >= 25 ? 1 : 0.4);
    case "soliditaet":
      // Wer ohnehin auf die Kasse achtet, verbessert seine Nettoposition fast nebenbei.
      return 0.3 + 0.5 * scale10(cashPriority);
    case "entwicklung":
      // Marktwert-Spruenge kommen von jungen Spielern mit Spielzeit — ein Wert-Team spielt so.
      return 0.3 + 0.45 * scale10(valuePriority);
    case "kaderpflege":
      // Frische braucht Rotation, Rotation braucht Kadertiefe.
      return (
        0.25
        + 0.35 * scale10(depthPreference)
        + (input.rosterSize > input.rosterOpt ? 0.25 : 0)
      );
    default:
      return 0.5;
  }
}

/** Wieviele Raenge Ambition den Zielrang je Prioritaetspunkt (0..10, Mitte 5) verschiebt. */
const AMBITION_RANK_SHIFT_PER_POINT = 1.2;
/**
 * Deckel auf die Ambitions-Verschiebung. Ohne ihn zoege ein Team mit Extremwert (0 oder 10) seinen
 * Zielrang bis an die Tabellenenden — dann waehlten am Ende doch wieder fast alle Teams dieselben
 * zwei, drei Extremformen (Titel- bzw. Sicherheitsfamilie), nur nach Ambition statt nach Startrang
 * sortiert. Das widerspraeche Punkt 4 des Auftrags ("nicht ueberdrehen"): ein Rest Streuung um den
 * eigenen Startrang ist gewollt, eine zweite Kollaps-Achse nicht.
 */
const AMBITION_RANK_SHIFT_MAX = 7;

/**
 * Sigma des Passungs-Fensters — bewusst ENGER als `SPONSOR_V3_ANCHOR_SIGMA` (4), mit dem jede Form
 * auf denselben Erwartungswert normiert ist. Mit demselben Sigma waere der Passungsterm fuer jedes
 * Team mit `Zielrang == Startrang` exakt 0 — per Konstruktion, denn genau das ist die Definition von
 * `terms.anchor` (sponsor-liga-leiter.ts). Das traefe ausgerechnet die Randfaelle: ein Team auf
 * Startrang 1 kann seinen Zielrang nicht ueber 1 hinaus verschieben (geklammert), bliebe mit dem
 * gleichen Sigma also ohne jedes Passungssignal — genau der Titelfavorit-auf-Mittelfeldkurve-Fall
 * aus dem Befund. Ein engeres Fenster gewichtet die Raenge nahe am Zielrang staerker als die weite
 * Anker-Verteilung es tut und macht den Term auch ohne Ambitions-Shift ungleich 0: er misst dann,
 * wie sehr sich eine Kurve auf den eigenen (Start-)Rang konzentriert statt sich brav auf das ganze
 * Ankerfenster zu verteilen — und das ist die Passungsfrage.
 */
const SPONSOR_AI_CURVE_FIT_SIGMA = 2.5;

/**
 * Skalierung des Passungsterms. Der rohe Wert (`fitValue - terms.anchor`) liegt typischerweise bei
 * 0,5 bis 2 C, mit Ausreissern bis ~11 C bei starker Ambition nahe den Ligaenden — deutlich kleiner
 * als der Achsenterm (bis zu G/2, bei legendaer/golden bis 15 C). Ohne Skalierung waere die
 * Kurvenform trotz eigenem Kriterium meist die schwaechste der vier Wahldimensionen. Der Faktor
 * hebt sie auf dieselbe Groessenordnung, ohne die anderen drei zu entwerten.
 */
const SPONSOR_AI_CURVE_FIT_WEIGHT = 3;

/**
 * GEWICHT DES ECO-DOWNSIDE-TERMS. Kalibriert an `eco-messung.ts` (6 Seeds x 32 Teams), nicht am
 * Gefuehl — Sweep 2/3/4/5/6/8/20 auf dem Live-Save, Ergebnis fuer die klammen Teams (Druck >= 7), plus
 * `mitVorschuss` aus dem bestehenden `tests/sponsor-v4-ki-wahl.test.ts`-Szenario (alle 32 Teams auf
 * Kasse −30, Schwelle: > 8 von 32 muessen die Vorschuss-Karte nehmen):
 *
 *   Gewicht | Ø Bodenrang | bestbodig | Formen | mitVorschuss/32 | Test "greift bei Geldnot"
 *   2       | 3,10        | 13 %      | 11     | 15              | gruen
 *   3       | 3,01        | 18 %      | 11     | 15              | gruen
 *   4       | 2,94        | 18 %      | 11     | 13              | gruen — GEWAEHLT
 *   5       | ~2,9        | ~19 %     | 11     | 12              | gruen
 *   6       | 2,87        | 20 %      | 11     | 8               | ROT (Schwelle > 8 knapp verfehlt)
 *   8..20   | 2,86-2,89   | 20-23 %   | 11     | < 8 (vermutet)  | ROT
 *
 * GEWICHT 4 IST NICHT DAS STAERKSTE MOEGLICHE, SONDERN DAS GROESSTE, DAS EINEN BESTEHENDEN TEST NICHT
 * BRICHT. `tests/sponsor-v4-ki-wahl.test.ts` ("greift bei Geldnot zum Vorschuss") verlangt bei extremer
 * Geldnot einen "klaren Teil" der Teams auf der Vorschuss-Karte — der bestehende Vorschuss-Term
 * (`+0,25 * advance.amount`) und der neue Eco-Downside-Term konkurrieren um dieselben Angebote, denn
 * eine Vorschuss-Karte ist nicht zwangslaeufig die bodenstaerkste. Zwischen Gewicht 5 und 6 kippt die
 * Konkurrenz (12 → 8 von 32) und verletzt die bestehende Schwelle. Diese Grenze ist damit die
 * tatsaechliche Kalibrierungsgrenze, nicht eine gefuehlte — sie wurde gemessen, indem genau dieser Test
 * bei wachsendem Gewicht beobachtet wurde.
 *
 * ZWEI WEITERE BEFUNDE AUS DEM SWEEP, die in jede Weiterarbeit an dieser Zahl gehoeren:
 *
 * ERSTENS erreicht die Wirkung bei KEINEM Gewicht die im Auftrag genannte Zielmarke 2,2 — auch nicht
 * bei den (durch obige Testgrenze ohnehin ausgeschlossenen) hohen Werten 8-20, wo die Kurve bereits
 * plateaut (2,87 → 2,86 zwischen Gewicht 6 und 20). Grund, per Direktmessung bestaetigt (argmin(downside)
 * ganz ohne die uebrigen Scoreterme liefert Bodenrang ~3,0 — kaum besser als eine Zufallswahl unter 5
 * Karten): die Anker-Gewichte in `sponsorV3DownsideShortfall` (Sigma 4, zentriert auf den Startrang)
 * lassen fuer ein starkes, aber klammes Team den extremen Rangbereich, in dem der Boden ueberhaupt
 * entsteht, kaum Gewicht — dieses Team landet dort realistisch nie. Der Boden-Rang aus
 * `eco-messung.ts` ist damit ein UNVOLLKOMMENER Proxy fuer das, was diese Groesse tatsaechlich
 * optimiert (Abwaertsrisiko im REALISTISCHEN Rangfenster, nicht am Tabellenende) — exakt die
 * Eigenschaft, die laut Auftrag den bloßen Boden als Kriterium disqualifiziert.
 *
 * ZWEITENS bleibt "entspannt" NICHT exakt unveraendert: `buildSeasonStrategyState` klassifiziert in
 * diesem Save 13 von 14 stichprobenartig geprueften Druck-3-Teams als `cash_recovery` — nicht ueber
 * die Kasse (die ist bei ihnen ja bereits >= 20), sondern ueber `salaryPressure = Gehalt/Kasse > 1,25`.
 * `ecoIntent01` ist bei diesen Teams also trotz "entspannter" Kassenlage strukturell ungleich 0
 * (~0,6 statt 0). Das ist keine Fehlmessung, sondern folgt exakt aus der vorgegebenen Formel und
 * greift wortgetreu das im Auftrag vorgesehene zweite Signal (`strategy01`) auf. Bit-identisch bleibt
 * nur der in Test 2 explizit konstruierte Fall (hohe Kasse UND neutrale Doktrin) — die reale
 * "entspannt (Druck 3)"-Gruppe aus `eco-messung.ts` bewegt sich mit, weil sie eben nicht nur ueber die
 * Kasse "entspannt" ist. Siehe PR-Beschreibung fuer die volle Vorher/Nachher-Tabelle und die Analyse.
 */
const SPONSOR_AI_ECO_DOWNSIDE_WEIGHT = 4;

/**
 * DER ZIELRANG, GEGEN DEN DIE KURVENFORM PASSEN MUSS.
 *
 * Der Startrang allein waere die Wahl eines Teams ohne Plan — ein Team, das aufsteigen will, darf
 * eine Kurve waehlen, die weiter oben zahlt, als es aktuell steht (Auftrag Punkt 3). Die Ambition
 * kommt aus derselben Quelle wie der bereits bestehende Archetyp-Praeferenz-Term
 * (`resolveAiSponsorArchetypePreference`): `profile.bias.starPriority`, mit `identity.ambition` als
 * Fallback fuer Teams ohne eigenes Strategieprofil. 5 ist die neutrale Mitte (kein Shift).
 */
function resolveAmbitionTargetRank(input: {
  startRank: number;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
}): number {
  const starPriority = input.profile?.bias.starPriority ?? input.identity?.ambition ?? 5;
  const shift = Math.max(
    -AMBITION_RANK_SHIFT_MAX,
    Math.min(AMBITION_RANK_SHIFT_MAX, (starPriority - 5) * AMBITION_RANK_SHIFT_PER_POINT),
  );
  // Hoehere Ambition zieht den Zielrang NACH OBEN (kleinere Zahl = besserer Platz), deshalb minus.
  return Math.max(1, Math.min(32, Math.round(input.startRank - shift)));
}

/**
 * DIE KI-WAHL BEWERTET JETZT PASSUNG STATT RISIKO.
 *
 * Bis V3 war die Wahl fuer die KI trivial und das war beabsichtigt: alle Karten hatten denselben
 * Erwartungswert und unterschieden sich nur im Risikoprofil, also bewertete die KI ausschliesslich
 * ihre Risikopraeferenz. Mit Achsenkarten ist das gegenstandslos — der Erwartungswert ist zwar
 * weiterhin bei allen gleich, aber er gilt fuer ein DURCHSCHNITTLICHES Team. Wer seine Achse
 * trifft, holt bis zu +G/2; wer sie verfehlt, verliert ebenso viel. Eine KI, die das ignoriert,
 * verliert systematisch gegen jeden Menschen, der seine eigene Spielweise kennt.
 *
 * Bewertet wird deshalb: der geschaetzte eigene Erfuellungsgrad mal Hebelgroesse (das ist der
 * erwartete Cash-Beitrag der Karte), plus der Wert des Vorschusses fuer die eigene Kassenlage.
 *
 * SEIT PR #360 traegt jedes Angebot zusaetzlich eine KURVENFORM (`offer.curveShape` /
 * `terms.baseLadder`) — WO auf der Ligaleiter das Geld liegt, siehe `sponsor-liga-leiter.ts`. Alle
 * 11 Formen sind auf denselben Erwartungswert beim STARTRANG normiert (`terms.anchor`), eine reine
 * EV-Bewertung kann sie also nicht unterscheiden — die KI wuerfelte hier faktisch (siehe PR-Text:
 * Messung ueber alle 32 Teams zeigte Titelfavoriten auf Mittelfeldkurven und Schlusslichter auf
 * Titelkurven). Der dritte Term unten behebt das: er gewichtet dieselbe Leiter mit
 * `sponsorV3AnchorWeights` um einen AMBITIONS-VERSCHOBENEN Zielrang statt um den Startrang (Details
 * und warum das Fenster dabei enger als das der Anker-Normierung sein muss: siehe
 * `resolveAmbitionTargetRank` / `SPONSOR_AI_CURVE_FIT_SIGMA` unten) — er schlaegt zugunsten der
 * Form aus, die dort am meisten zahlt, wo das Team seiner eigenen Ambition nach landen will.
 */
function scoreOfferForAi(input: {
  offer: SponsorOffer;
  profile: TeamStrategyProfile | null;
  identity: TeamIdentity | null;
  cashPressure: number;
  powerRank?: number | null;
  teamId: string;
  cash?: number;
  rosterSize?: number;
  /**
   * Sparabsicht dieses Teams, 0..1 (siehe `resolveEcoIntent01` fuer die Berechnung). Optional: fehlt
   * es (z. B. in bestehenden Aufrufen/Tests ausserhalb von `chooseSponsorOfferForAiTeams`), bleibt der
   * Downside-Term unwirksam — exakt dasselbe Verhalten wie vor dieser Aenderung.
   */
  ecoIntent01?: number;
}): number {
  const { offer, profile, identity, cashPressure } = input;
  const terms = getSponsorV3Terms(offer);
  const axisKey = terms?.axis?.key as SponsorV4AxisKey | undefined;

  let score = 0;

  if (axisKey && terms) {
    const fit = estimateAxisFitForAi({
      axisKey,
      profile,
      identity,
      cash: input.cash ?? 0,
      rosterSize: input.rosterSize ?? 0,
      rosterOpt: identity?.playerOpt ?? 14,
    });
    // Der erwartete Cash-Beitrag der Achse: `G * (Erfuellung − 0,5)`. Genau die Groesse, um die es
    // geht — negativ, wenn das Team die Achse voraussichtlich verfehlt.
    score += terms.goalSize * (fit - SPONSOR_V4_AXIS_PBAR);
  }

  // DAS PASSUNGSKRITERIUM DER KURVENFORM: wo auf der Leiter zahlt DIESE Form, gewichtet um den
  // ambitions-verschobenen Zielrang statt den blossen Startrang? `terms.anchor` ist der
  // Startrang-Mittelwert (breites Sigma), auf den ALLE 11 Formen normiert sind
  // (sponsorKurvenLeiter) — der Vergleichspunkt, ab dem eine Form "besser als neutral" faellt.
  // `fitValue` liest exakt dieselbe Leiter (`terms.baseLadder`), aber mit dem engeren
  // Passungs-Fenster um den Zielrang. Bei einem Team ohne Ambitionsausschlag UND fernab der
  // Ligaenden liegt `fitValue` nahe an `terms.anchor` (schmaleres Fenster um denselben Rang misst
  // fast dasselbe wie das breite) — der Term bleibt dann klein und ueberlaesst die Wahl den uebrigen
  // Termen (Achse, Vorschuss, Markenpassung). Ambition oder ein Randrang machen ihn spuerbar: dann
  // gewinnt, wessen Geld dort liegt, wo das Team hinwill. `SPONSOR_AI_CURVE_FIT_WEIGHT` skaliert den
  // Term auf dieselbe Groessenordnung wie der Achsenterm oben — ohne die Skalierung waere die
  // Kurvenform trotz allem meist die schwaechste der vier Wahldimensionen, genau das Gegenteil vom
  // Auftrag.
  if (terms) {
    const targetRank = resolveAmbitionTargetRank({ startRank: terms.startRank, profile, identity });
    const fitWeights = sponsorV3AnchorWeights(targetRank, SPONSOR_AI_CURVE_FIT_SIGMA);
    const fitValue = terms.baseLadder.reduce((sum, value, index) => sum + value * (fitWeights[index] ?? 0), 0);
    score += (fitValue - terms.anchor) * SPONSOR_AI_CURVE_FIT_WEIGHT;
  }

  // Der Vorschuss ist fuer ein klammes Team echtes Geld zur richtigen Zeit und fuer ein reiches nur
  // eine Gebuehr. Genau dieser Unterschied ist der Sinn der zweiten Dimension.
  if (terms?.advance) {
    score += cashPressure >= 7 ? terms.advance.amount * 0.25 : -terms.advance.fee;
  }

  // SPARABSICHT: der Vorschuss-Term oben waehlt nur, welche Karte UEBERHAUPT einen Vorschuss traegt —
  // nicht welche den hoechsten Boden hat. Ein Team mit echter Sparabsicht (klamm und/oder in der
  // Doktrin auf Eco-Kurs) soll stattdessen die Karte mit der GERINGSTEN erwarteten Abwaertsseite
  // bevorzugen, siehe `sponsorV3DownsideShortfall` fuer die Begruendung dieser Groesse. Bei
  // `ecoIntent01 == 0` (die grosse Mehrheit entspannter Teams) ist dieser Term exakt 0 — unveraendertes
  // Verhalten.
  if (terms && (input.ecoIntent01 ?? 0) > 0) {
    score -= (input.ecoIntent01 ?? 0) * SPONSOR_AI_ECO_DOWNSIDE_WEIGHT * sponsorV3DownsideShortfall(terms);
  }

  // Markenpassung bleibt als milder Flavour-Term: sie bewegt kein Geld, soll aber bei aehnlicher
  // Rechnung das Team waehlen lassen, das zu ihm passt.
  const preferredArchetype = resolveAiSponsorArchetypePreference({
    teamId: input.teamId,
    profile,
    identity,
    cashPressure,
    powerRank: input.powerRank ?? null,
  });
  if (preferredArchetype === offer.archetype) score += 1.5;

  // Deterministischer Tiebreak, damit die Wahl reproduzierbar bleibt.
  score += (offer.offerId.length % 7) * 0.01;

  return score;
}

/**
 * SPARABSICHT EINES TEAMS — bewusst schlank: nur zwei Signale, kein Konjunktur-Anteil und kein
 * Ambitions-Daempfer. Beim Konjunktur-Anteil ist schon das Vorzeichen eine Designvermutung ("im
 * mageren Jahr ist Ambition billig zu opfern" ist genauso plausibel wie "vor mageren Jahren Runway
 * aufbauen") — ein Koeffizient, dessen Richtung geraten ist, waere schlechter als ihn wegzulassen.
 *
 * `strategy01` liest die bereits vorhandene Saison-Doktrin (`buildSeasonStrategyState`,
 * lib/ai/ai-manager-doctrine-service.ts): `cash_recovery` ist die staerkste Sparabsicht (1,0),
 * `eco_round` eine mildere (0,5), jede andere Doktrin 0. `pressure01` ist dieselbe Kassenlage, die
 * auch `resolveAiSponsorArchetypePreference` bereits nutzt, linear auf `[0,1]` gestreckt zwischen den
 * bestehenden Druckstufen 3 (entspannt) und 10 (klamm).
 */
function resolveEcoIntent01(input: { seasonStrategy: AiSeasonStrategy | undefined; cashPressure: number }): number {
  const strategy01 = input.seasonStrategy === "cash_recovery" ? 1 : input.seasonStrategy === "eco_round" ? 0.5 : 0;
  const pressure01 = Math.max(0, Math.min(1, (input.cashPressure - 3) / 7));
  return Math.max(0, Math.min(1, 0.6 * strategy01 + 0.4 * pressure01));
}

export function chooseSponsorOfferForAiTeams(gameState: GameState, settingsMap?: Record<string, TeamControlSettings>): GameState {
  const controlSettings = settingsMap ?? buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let nextGameState = ensureSeasonSponsorOffers(gameState);

  // Build overview rows once — reused for all teams instead of O(n²) per-team calls.
  const overviewRows = buildTeamSeasonOverviewRows({ gameState: nextGameState });
  const rowByTeamId = new Map(overviewRows.map((row) => [row.teamId, row]));
  // Fuer die Liga EINMAL berechnen, nicht je Team — `buildSeasonStrategyState` ist eine reine
  // Funktion ueber den gesamten `gameState` und liefert die Doktrin aller Teams in einem Rutsch.
  const seasonStrategyByTeamId = buildSeasonStrategyState(nextGameState);

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
    const rosterSize = nextGameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const ecoIntent01 = resolveEcoIntent01({
      seasonStrategy: seasonStrategyByTeamId[team.teamId]?.seasonStrategy,
      cashPressure,
    });
    const scoreArgs = {
      profile, identity, cashPressure, powerRank, teamId: team.teamId, cash: row?.cash ?? 0, rosterSize, ecoIntent01,
    };
    const bestOffer = [...offers].sort(
      (left, right) =>
        scoreOfferForAi({ offer: right, ...scoreArgs }) - scoreOfferForAi({ offer: left, ...scoreArgs }),
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

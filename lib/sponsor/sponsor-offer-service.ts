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
import { getFacilityEfficiencyPct } from "@/lib/facilities/facility-condition";
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
import { sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import { getSponsorTermMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import { applySpotlightPerkToComponents, buildSponsorOfferModuleIds } from "@/lib/sponsor/sponsor-modules";
import {
  mapSponsorCardToArchetype,
  rollSponsorOfferSlate,
} from "@/lib/sponsor/sponsor-tier-pool";
import {
  leihRaritaet,
  VERZICHT_ANTEIL_DER_LEITER,
  verteileLeihgabenAufSlate,
} from "@/lib/sponsor/sponsor-leih-slate";
import { baueRangmarke } from "@/lib/sponsor/sponsor-rangmarke";
import {
  ACADEMY_RATING_GRENZE,
  sponsorLeihPassungFuerTeam,
} from "@/lib/sponsor/sponsor-leih-passung";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import {
  baueLeihZielKomponente,
  LEIH_ZIEL_ACHSENRANG,
  LEIH_ZIEL_FRISCHE,
  type LeihAchse,
  type LeihZielKey,
} from "@/lib/sponsor/sponsor-leih-ziele";
import {
  sponsorV3AnchorWeights,
  sponsorV3CardByKey,
  sponsorV3DownsideShortfall,
  SPONSOR_V4_AXIS_PBAR,
  type SponsorV3CardKey,
} from "@/lib/sponsor/sponsor-v3-model";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import { resolveChallengeSlotIndex } from "@/lib/sponsor/sponsor-special-objectives";
import {
  applySponsorV3ToOffers,
  getSponsorV3Terms,
  sponsorV3EingefrorenerSockel,
} from "@/lib/sponsor/sponsor-v3-offer-service";
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
  /** Vertragslaufzeit dieses Angebots (Umsetzungsplan D) — aus dem Slate-Wurf, siehe sponsor-tier-pool.ts. */
  termSeasons: SponsorTermSeasons;
  rarity: SponsorRarity;
  commercialRating: number;
  slotIndex: number;
  usedParentBrandIds?: string[];
  recentParentBrandIds?: string[];
  globalParentUsage?: Record<string, number>;
  forcePremiumElite?: boolean;
  teamQualityRank?: number | null;
  specialMode?: "standard" | "challenge";
  /** Eines der zwei Leih-Ziele — nur auf Gebaeude-Karten gesetzt. */
  leihZiel?: { key: LeihZielKey; achse?: LeihAchse } | null;
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

  // DIE ZWEI LEIH-ZIELE LOESEN DIE ACHSE AB, aber nur auf Gebaeude-Karten. Chris wollte „ein paar
  // wesentliche" Ziele statt fuenf Achsen; die reine Cash-Karte traegt bewusst gar keins — sie ist
  // die Karte fuer planbares Geld, und ein Bonus mit Bedingung waere dort das Gegenteil.
  //
  // WELCHES der beiden, entscheidet der Slot und nicht der Zufall: eine feste Zuordnung kann ein
  // Spieler lernen, einen Wuerfel darauf nicht. Gerade Plaetze tragen die Frische (von jedem Team ab
  // Spieltag 1 ueber Rotation steuerbar), ungerade den Achsen-Rang.
  if (input.leihZiel) {
    specialComponent = baueLeihZielKomponente({
      gameState,
      teamId: team.teamId,
      key: input.leihZiel.key,
      achse: input.leihZiel.achse,
    });
  }

  // V4-ACHSENKARTE: die Zielkomponente ist die Achse selbst. Kein Katalogwurf, kein
  // Wahrscheinlichkeitsband — eine Achse misst den eigenen Zuwachs gegen die eigene Ausgangslage und
  // ist damit fuer jedes Team erfuellbar. Die Konditionen wandern in den `targetValue`, damit Karte,
  // Anzeige und Settlement dieselbe Zahl lesen und ein spaeterer Zustandswechsel den Vertrag nicht
  // nachtraeglich verschiebt.
  if (input.axisKey && !input.leihZiel) {
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
    termSeasons: input.termSeasons,
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

/**
 * WIE VIELE SPONSORENANGEBOTE EIN TEAM JE SAISON BEKOMMT.
 *
 * Chris: „1 unterschied: nur 3 Sponsoren statt 5". Die Zahl stand als lokale `const` in
 * `buildSponsorOffersForTeam` und war damit fuer niemanden lesbar — mehrere Tests trugen deshalb
 * eine feste Stichproben-Wache `toBeGreaterThan(100)`, die aus der Fuenferzeit stammt. Mit drei
 * Karten sind es 32 Teams mal 3 = 96, und vier Tests standen rot, ohne dass an der geprueften
 * Aussage irgendetwas falsch war.
 *
 * Exportiert, damit Erwartung und Erzeugung DIESELBE Zahl lesen. Stellt jemand wieder auf fuenf
 * um, ziehen die Tests von allein mit, statt erneut rot zu werden.
 */
export const SPONSOR_ANGEBOTE_JE_TEAM = 3;

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
  // WIE VIELE ANGEBOTE EIN TEAM SIEHT. Pro Slot eine (Rarity, Kurvenform)-Paarung aus dem
  // Slate-Wurf — DISTINCT Kurven, beliebtheits-gehoben; ueber `usedParentBrandIds` (unten)
  // unterschiedliche Marken.
  //
  // DREI STATT FUENF (Chris: „1 unterschied: nur 3 Sponsoren statt 5"). Die Zahl fuenf stammt aus
  // der Gebaeude-Bauvorlage — „wenn wir dann wieder genug verschiedene möglichkeiten haben lohnen
  // auch wieder die 5 statt 3 sponsoren". Mit dem Gebaeude-Schalter auf AUS
  // (`SPONSOR_GEBAEUDE_LEIHE_AKTIV`) faellt genau diese Vielfalt weg: es blieben fuenf Karten, die
  // sich nur noch in Achse, Rarity, Kurvenform und Laufzeit unterscheiden. Drei davon sind eine
  // Auswahl, fuenf waeren Fuellmaterial.
  //
  // Alles Nachgelagerte rechnet bereits relativ zur Slot-Zahl und braucht KEINE Anpassung
  // (nachgemessen, nicht angenommen): der Golden-Slot wird ueber `slotCount` gezogen und mit
  // `slotCount − 1` geklammert, der Challenge-Slot ueber die Zahl der ZIELKARTEN
  // (`goalSlotIndexes.length`, hier 2), die Kurvenformen kommen aus einer Ziehung ohne
  // Zuruecklegen ueber 11 Formen, und die Achsen aus einer ueber bis zu 5.
  const SLOT_COUNT = SPONSOR_ANGEBOTE_JE_TEAM;
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
  // DIE GEBÄUDE-LEIHE AUF DIE FUENF KARTEN (Bauvorlage E1/E8). Platz 1 bleibt reines Geld, Platz 2
  // ist der guenstige Einstieg, die uebrigen folgen ihrer Rarität — die Regel und ihre gemessene
  // Begruendung stehen in `sponsor-leih-slate.ts`.
  //
  // Als eigener Bestand zaehlt bewusst der GESPEICHERTE Stand, nicht der ueber `getTeamFacilityState`
  // gelesene: der traegt bereits laufende Leihgaben mit. Ein Team, dem gerade ein Trainingszentrum
  // Stufe 4 geliehen ist, bekaeme sonst naechste Saison gar kein Trainingszentrum mehr angeboten —
  // ausgerechnet dann nicht, wenn die Leihe auslaeuft.
  const eigeneStufen = Object.fromEntries(
    Object.entries(input.gameState.seasonState.teamFacilities?.[input.teamId]?.facilities ?? {}).map(
      ([facilityId, eintrag]) => [facilityId, eintrag?.level ?? 0],
    ),
  );
  //
  // DER DECKEL KOMMT AUS DER EIGENEN LEITER, nicht aus einer festen Zahl: was ein Team verzichten
  // kann, haengt daran, was es ueberhaupt bekommt. Gerechnet wird gegen die niedrigste Sprosse —
  // also gegen das, was auf JEDEM Endrang sicher kommt —, damit auch ein Absturz die Karte nicht
  // unbezahlbar macht.
  const startRangFuerMarke =
    rows.find((entry) => entry.teamId === input.teamId)?.startplatz ?? qualityRank.leaguePosition;
  const leiterFuerDeckel = sponsorKurvenLeiter({
    shape: slate.entries[0]?.curveShape ?? "stetig",
    startRank: startRangFuerMarke,
    salaryFactor: getCurrentSponsorSalaryFactor(input.gameState),
  });
  const leihKarten = verteileLeihgabenAufSlate({
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    raritaeten: slate.entries.map((entry) => leihRaritaet(entry.rarity)),
    laufzeiten: slate.entries.map((entry) => entry.termSeasons),
    eigeneStufen,
    verzichtDeckel: Math.min(...leiterFuerDeckel) * VERZICHT_ANTEIL_DER_LEITER,
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

  // WELCHES ZIEL AUF WELCHER KARTE — fest je Slot, nicht gewuerfelt. Eine stabile Zuordnung kann ein
  // Spieler lernen, einen Wuerfel darauf nicht. Die Achse des Rang-Ziels folgt dem Slot aus
  // demselben Grund.
  //
  // Platz 2 (Index 1) ist der guenstige Einstieg und traegt die FRISCHE — das Ziel, das jedes Team
  // ab Spieltag 1 ueber Rotation steuern kann, ganz ohne Etat. Die teureren Plaetze wechseln sich
  // ab. (Der Kommentar hier stand einmal genau andersherum als der Code darunter; der Code hatte
  // recht, der Kommentar nicht.)
  const LEIH_ACHSEN: LeihAchse[] = ["pow", "spe", "men", "soc"];
  const leihZielFuer = (slotIndex: number): { key: LeihZielKey; achse?: LeihAchse } | null => {
    if (!leihKarten[slotIndex]?.leihe) return null;
    return slotIndex % 2 === 0
      ? { key: LEIH_ZIEL_ACHSENRANG, achse: LEIH_ACHSEN[Math.floor(slotIndex / 2) % LEIH_ACHSEN.length]! }
      : { key: LEIH_ZIEL_FRISCHE };
  };

  const built = slate.entries.map((entry, slotIndex) => {
    const offer = buildOfferSkeleton({
      leihZiel: leihZielFuer(slotIndex),
      gameState: input.gameState,
      team,
      identity,
      profile,
      cardKey: entry.cardKey,
      axisKey: entry.axisKey ?? null,
      curveShape: entry.curveShape,
      termSeasons: entry.termSeasons,
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
    const karte = leihKarten[slotIndex] ?? null;
    const leihe = karte?.leihe ?? null;
    if (!leihe) {
      return offer;
    }
    // DIE MARKE HAENGT AN DER GROESSE, nicht am Zufall: „die Karte mit dem groessten Versprechen
    // traegt das groesste Risiko" (Bauvorlage, Kopplung Karte<->Risiko). Eine grosse Leihe setzt den
    // eigenen Startblock, alles darunter einen Block tiefer — so ist der Einstieg auch mit einem
    // mittelmaessigen Jahr zu halten, das fertige Stufe-5-Gebaeude nicht.
    const haerte: "hart" | "mild" = karte!.groesse === "gross" ? "hart" : "mild";
    return {
      ...offer,
      sponsorLeihe: {
        facilityId: leihe.facilityId,
        raritaet: leihe.raritaet,
        kurs: leihe.kurs,
        stufenreihe: leihe.stufenreihe,
        verzichtJeSaison: leihe.verzichtJeSaison,
        leihwertJeSaison: leihe.leihwertJeSaison,
        startZustandPct: leihe.startZustandPct,
        katalogkostenEndstufe: leihe.katalogkostenEndstufe,
        rangmarke: baueRangmarke({ startRang: startRangFuerMarke, haerte }),
        rangmarkenHaerte: haerte,
      },
    };
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
    // E1: KEINE Abzugszeile — der Verzicht senkt hier die Leiter, und zwar bevor Anker und Tilt
    // gerechnet werden. Die Gebäude-Karte ist danach durchgaengig eine Karte, die weniger zahlt.
    leihVerzichte: leihKarten.map((karte) => karte.verzichtErsteSaison),
    leihZielKeys: leihKarten.map((_, slotIndex) => leihZielFuer(slotIndex)?.key ?? null),
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
    //
    // GEMELDET VON CHRIS: „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das habe
    // ich bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht
    // und auch finanziell in die GuV schon mit einberechnet und ausgewiesen wird."
    //
    // HIER STAND EINE EINGETIPPTE 5. Seit `SPONSOR_ANGEBOTE_JE_TEAM = 3` konnte die Bedingung nie
    // mehr wahr werden: erzeugt werden drei Angebote, verlangt wurden fuenf. Die Funktion hat
    // deshalb bei JEDEM Aufruf neu erzeugt — und sie laeuft bei jedem Laden des Spielstands
    // (`app/api/singleplayer-state/route.ts`). Der Wurf selbst ist saatgebunden und lieferte
    // dieselben Sponsoren; unsichtbar mitgewandert ist aber die AUSGANGSLAGE der V4-Achse, denn
    // `buildSponsorOffersForTeam` friert sie aus dem LEBENDEN Zustand ein
    // (`axisbase:` im targetValue).
    //
    // Fuer die Achse „Ausbau" heisst das: die Vorsaison-Reihenfolge baut erst die Gebaeude
    // (`training_facilities`) und waehlt danach den Sponsor (`choose_sponsor`). Jede gebaute Stufe
    // wanderte in die Ausgangslage, statt auf das Ziel zu zaehlen — bei Unterschrift stand die Achse
    // damit garantiert auf 0. An Chris' Spielstand gemessen: `axisbase:2` bei genau zwei gebauten
    // Stufen, Achse 0 von 2, Sonderziel −6,0 C statt +6,0 C, GuV 22,7 statt 34,7 C.
    //
    // Der Vergleich laeuft jetzt gegen die Konstante, damit eine spaetere Aenderung der Angebotszahl
    // dieselbe Falle nicht erneut aufstellt.
    const hasCurrentSeasonOffers =
      currentOffers.length === SPONSOR_ANGEBOTE_JE_TEAM &&
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
  /**
   * @deprecated wird IGNORIERT. Umsetzungsplan D: die Laufzeit ist keine Wahl beim Unterschreiben mehr,
   * sondern steht bereits am gewaehlten ANGEBOT (`offer.termSeasons`, gewuerfelt im Slate — siehe
   * `rollSponsorOfferSlate` in sponsor-tier-pool.ts). Ein Aufrufer waehlt die Laufzeit also implizit
   * durch die Wahl DES Angebots, nicht durch dieses Feld. Bleibt nur fuer Rueckwaertskompatibilitaet
   * bestehender Aufrufer (z. B. `app/api/sponsor/choose/route.ts`) im Typ stehen.
   */
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

  // Laufzeit steht am Angebot, nicht mehr an einer Konstante — siehe Deprecation-Kommentar oben.
  // Fallback 1 nur fuer Alt-Angebote aus Spielstaenden von vor diesem Umbau (`offer.termSeasons`
  // fehlt dort).
  const termSeasons: SponsorTermSeasons = offer.termSeasons ?? 1;

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
    // Der Leih-Block wandert 1:1 mit. Er ist ab hier die Quelle fuer den Stufen-Aufstieg beim
    // Saisonwechsel und fuer den Uebernahmepreis am Vertragsende.
    ...(offer.sponsorLeihe ? { sponsorLeihe: offer.sponsorLeihe } : {}),
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

  // DIE LEIHGABE WIRD MIT DER UNTERSCHRIFT WIRKSAM. Sie landet in `sponsorLeihgabenByTeamId` und
  // NICHT in `teamFacilities` — `getTeamFacilityState` legt sie beim Lesen darueber (Schritt 3).
  // Stuende sie im eigenen Bestand, waere der Rueckfall am Vertragsende ein Loeschvorgang, und ein
  // vergessener Loeschvorgang verschenkt ein Gebäude auf Dauer.
  if (offer.sponsorLeihe) {
    const leihe = offer.sponsorLeihe;
    const bisher = nextGameState.seasonState.sponsorLeihgabenByTeamId?.[input.teamId] ?? [];
    nextGameState = {
      ...nextGameState,
      seasonState: {
        ...nextGameState.seasonState,
        sponsorLeihgabenByTeamId: {
          ...(nextGameState.seasonState.sponsorLeihgabenByTeamId ?? {}),
          [input.teamId]: [
            // Ein Team hat hoechstens einen Sponsor, also hoechstens eine laufende Leihe aus einem
            // Sponsorvertrag. Eine aeltere aus DERSELBEN Saison waere ein Doppelabschluss (den der
            // Re-Sign-Guard oben ausschliesst) — sie wird trotzdem ersetzt statt gestapelt.
            ...bisher.filter((eintrag) => eintrag.seasonId !== nextGameState.season.id),
            {
              facilityId: leihe.facilityId,
              stufe: leihe.stufenreihe[0] ?? 1,
              zustandPct: leihe.startZustandPct,
              seasonId: nextGameState.season.id,
              offerId: offer.offerId,
            },
          ],
        },
      },
    };
  }
  // DAS UNTERSCHREIBEN BEWEGT KEIN GELD. Sponsorengeld flieszt ausnahmslos am Saisonende
  // (sponsor-settlement-service). Frueher wurde beim Unterschreiben IMMER die halbe Basisrate
  // ausgezahlt; das Settlement zahlte danach nur noch die zweite Haelfte. Das hatte zwei Nachteile:
  // die angezeigte Saison-Summe sackte im Moment des Abschlusses ab (ohne dass der Vertrag weniger
  // wert war), und am Saisonende kam entsprechend wenig nach — obwohl genau dann Gehaelter und
  // Transfers zu bezahlen sind.
  //
  // Danach blieben VORSCHUSS-KARTEN als bewusste Ausnahme stehen; auch die sind jetzt weg. Damit
  // gibt es wieder genau EINEN Zahlungszeitpunkt, und die Anzeige kann gegen keine zweite Buchung
  // driften — die Begruendung steht in sponsor-v3-model.ts.
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
 * LAUFZEIT-TERM (Umsetzungsplan D, Messpunkt 5): `scoreOfferForAi` kannte `termSeasons` bisher gar
 * nicht — bei einer Erosion, die Mehrjahresvertraege systematisch schlechter macht als eine passende
 * Folge von Einjahresvertraegen (siehe TERM_MULTIPLIERS-Kommentar in sponsor-negotiation.ts), waehlte
 * die KI einen erodierten Mehrjahresvertrag also GENAUSO oft wie einen gleichwertigen Einjaehrigen —
 * ein systematischer Selbstschaden.
 *
 * Der Term rechnet in echten Cash-Einheiten (Gewicht 1, keine Skalierung noetig): erwarteter
 * Erosionsverlust ueber die Restlaufzeit (Jahre 2..termSeasons, Multiplikator jeweils < 1 auf den
 * Wertungsanteil `terms.anchor − Sockel`) MINUS ein kleiner Versicherungswert fuer den eingefrorenen
 * Sockel (er schuetzt vor einem schwachen Slate/Formtief in den Folgesaisons — genau das, was
 * `SPONSOR_AI_TERM_INSURANCE_SHARE` bepreist). Ein Einjahresvertrag (`termSeasons == 1`) bleibt
 * unveraendert bei 0 — dieselbe Logik wie bei den anderen bedingten Termen oben.
 *
 * GEMESSEN (tests/sponsor-laufzeit-ki-wahl.test.ts, 8 unabhaengige Ligen x 32 Teams): ein zunaechst
 * versuchter Anteil von 0.15 drehte das Vorzeichen — die Versicherung ueberwog die Erosion vor allem
 * bei Teams mit hohem Sockel (Tabellenende), die KI wählte Mehrjahresvertraege dadurch HAEUFIGER
 * (61,8 % statt der angebotenen 42,9 %) statt seltener. Bei 0.02 waehlt sie sie in 31,6 % der Faelle —
 * spuerbar UNTER den angebotenen 42,9 %.
 */
const SPONSOR_AI_TERM_INSURANCE_SHARE = 0.02;

/**
 * GEWICHT DES ECO-DOWNSIDE-TERMS.
 *
 * ACHTUNG, DIESE KALIBRIERUNG IST HISTORISCH: sie wurde gegen den SPONSOR-VORSCHUSS gefahren, den es
 * nicht mehr gibt (Begruendung in sponsor-v3-model.ts). Alles unten, was von einer "Vorschuss-Karte",
 * der Spalte `mitVorschuss/32` oder dem Vorschuss-Term `+0,25 * Betrag` spricht, beschreibt einen
 * Zustand vor dem Ausbau und ist NICHT mehr nachmessbar.
 *
 * WAS DAVON HEUTE NOCH GILT: der Wert bleibt bei 3 — bewusst unveraendert, damit der Vorschuss-Ausbau
 * die KI-Wahl nicht zusaetzlich verschiebt. Was WEGGEFALLEN ist, ist die OBERGRENZE: sie kam allein
 * daraus, dass der Vorschuss-Term um dieselben Angebote konkurrierte und der Test ab Gewicht 3,5
 * umkippte. Diese Konkurrenz gibt es nicht mehr, das Gewicht ist nach oben also nicht mehr gebunden.
 * Wer es neu setzen will, muss neu messen — die Tabelle unten taugt dafuer nicht mehr.
 *
 * URSPRUENGLICHE KALIBRIERUNG (Stand vor dem Ausbau): `eco-messung.ts` (6 Seeds x 32 Teams) UND
 * `tests/sponsor-v4-ki-wahl.test.ts` ("greift bei Geldnot zum Vorschuss": alle 32 Teams auf Kasse −30,
 * Schwelle: > 8 von 32 muessen trotzdem die Vorschuss-Karte nehmen) — nicht am Gefuehl.
 *
 * NACHBESSERUNG (dieser Kommentar ersetzt eine fruehere, fehlerhafte Kalibrierung): die erste Fassung
 * von `resolveEcoIntent01` mischte `cash_recovery` aus `buildSeasonStrategyState` als Hauptsignal ein.
 * Direktmessung ueber ALLE 32 Teams des Live-Saves (`new-game-1785174792968-8d7mdx`) zeigte danach:
 * `cash_recovery` triggert dort bei 31 von 32 Teams — nicht ueber die Kasse, sondern ueber
 * `salaryPressure = Gehalt/Kasse > 1,25` (Gehaelter 50-84 gegen typische Kassenstaende reissen diese
 * Schwelle praktisch immer). `cash_recovery` ist der NORMALZUSTAND dieser Liga, kein Ausnahmesignal.
 * `ecoIntent01` lag dadurch fuer ALLE 32 Teams zwischen 0,3 und 1,0 (Mittel 0,75, KEIN Team bei 0) —
 * der Term war de facto eine globale Risikoaversion von rund 0,75 * Gewicht fuer jedes Team, keine
 * Eco-Entscheidung, und die "entspannte" Gruppe bewegte sich in der Messung sichtbar mit (3,46 → 3,38).
 * Siehe `resolveEcoIntent01` fuer die korrigierte Formel: `cash_recovery` traegt jetzt KEIN Gewicht
 * mehr, das Hauptsignal ist die bestehende `cashPressure`-Kaskade (binaer bei `cashPressure >= 7`,
 * dieselbe Schwelle wie ueberall sonst in dieser Datei).
 *
 * Sweep 2/3/3.2/3.5/4 mit der KORRIGIERTEN Formel, klamme Teams (Druck >= 7):
 *
 *   Gewicht | Ø Bodenrang | bestbodig | Ø Bodenrang entspannt | mitVorschuss/32 | Test "greift bei Geldnot"
 *   2       | ~3,1        | ~13 %     | 3,45 (unveraendert)   | ~14             | gruen
 *   3       | 2,99        | 17 %      | 3,45 (unveraendert)   | 10              | gruen — GEWAEHLT
 *   3,2     | 2,97        | 16 %      | 3,45 (unveraendert)   | 9               | gruen, Marge nur 1
 *   3,5     | 2,96        | 17 %      | 3,45 (unveraendert)   | 6               | ROT
 *   4       | ~2,95       | ~17 %     | 3,45 (unveraendert)   | < 6 (vermutet)  | ROT
 *
 * Vorher (kein Term): klamm 3,15 / 11 % (Druck 7 allein: 3,26 / 4 % — schwaecher als der Durchschnitt,
 * weil 72 der 102 klammen Vertraege bei Druck 7 liegen, nicht 10), entspannt 3,46 / 10 %.
 *
 * WARUM DIE FRUEHERE FASSUNG TROTZ STAERKEREM GEWICHT (4) EINEN SCHWAECHEREN ECHTEN EFFEKT ZEIGTE, ALS
 * ES AUSSAH: mit `pressure01` linear zwischen Druck 3 und 10 gemischt (`(cashPressure-3)/7`) bekam ein
 * Druck-7-Team nur `ecoIntent01 = 0,571 * Gewicht` statt `1,0 * Gewicht` — und Druck 7 stellt 70 % der
 * klammen Vertraege. Die Testgrenze wird aber ausschliesslich von Druck-10-Teams gesetzt (das
 * Vorschuss-Testszenario setzt fuer ALLE 32 Teams Kasse < 0, also `cashPressure === 10` fuer jedes
 * einzelne — kein Team dort hat je Druck 7). Die lineare Mischung liess sich also nicht hoeher drehen,
 * ohne die ohnehin schon voll ausgereizten Druck-10-Teams ueber die Testschwelle zu drueberdruecken —
 * und blieb fuer die MEHRHEIT der klammen Teams (Druck 7) strukturell zu schwach. Die jetzige binaere
 * Fassung (`cashPressure >= 7` behandelt Druck 7 und 10 gleich, wie es `resolveAiSponsorArchetypePreference`
 * und der Vorschuss-Term selbst bereits tun) hebt Druck 7 auf denselben `ecoIntent01 = 1,0` wie Druck 10
 * an, OHNE die Testgrenze zu beruehren (das Testszenario hat nie ein Druck-7-Team) — und genau das
 * erklaert den staerkeren Effekt bei GLEICHEM Gewicht 3.
 *
 * `tests/sponsor-v4-ki-wahl.test.ts` war die tatsaechliche Kalibrierungsgrenze: der damalige
 * Vorschuss-Term (`+0,25 * Betrag`) und der Eco-Downside-Term konkurrierten um dieselben
 * Angebote, eine Vorschuss-Karte ist nicht zwangslaeufig die bodenstaerkste. Zwischen Gewicht 3 und 3,5
 * kippt die Konkurrenz (10 → 6 von 32). Gewicht 3 ist damit das groesste mit komfortabler Marge (2 ueber
 * der Schwelle), nicht das theoretisch staerkste.
 *
 * Auch mit der korrigierten Formel erreicht die Wirkung nicht die im Auftrag genannte Zielmarke 2,2 —
 * Grund ist strukturell, nicht die Kalibrierung: `sponsorV3DownsideShortfall` gewichtet ueber die
 * Anker-Verteilung (Sigma 4, zentriert auf den Startrang) und laesst fuer ein starkes, aber klammes
 * Team den extremen Rangbereich, in dem der Boden ueberhaupt entsteht, bewusst kaum Gewicht — dieses
 * Team landet dort realistisch nie (Direktmessung: `argmin(downside)` ganz ohne die uebrigen Scoreterme
 * liefert Bodenrang ~3,0, kaum besser als Zufall unter 5 Karten). Der Boden-Rang aus `eco-messung.ts`
 * ist ein UNVOLLKOMMENER Proxy fuer das, was diese Groesse tatsaechlich optimiert — exakt die
 * Eigenschaft, die laut Auftrag den bloßen Boden als Kriterium disqualifiziert.
 */
const SPONSOR_AI_ECO_DOWNSIDE_WEIGHT = 3;

/**
 * WIE OFT EINE LEIHE VORAUSSICHTLICH WIRKT — die Uptime der Rangmarke, und sie ist GESCHAETZT.
 *
 * #490 nennt fuer die milde Marke ~90 % und fuer die harte ~70-80 %; gemessen ist das nicht (die
 * Bauvorlage fuehrt es als offenen Punkt 2). Die Zahlen stehen hier als das, was sie sind: eine
 * Annahme, die die KI-Wahl vorsichtig macht statt sie zu praezisieren. Schwanken die Raenge in
 * dieser Liga staerker, ist die harte Marke schlechter als hier unterstellt — dann bevorzugt die KI
 * grosse Karten zu oft, und der Messlauf (Schritt 9) findet es.
 */
const SPONSOR_AI_UPTIME_MILD = 0.9;
const SPONSOR_AI_UPTIME_HART = 0.75;

/**
 * WIE VIEL EIN GEBÄUDE FUER EIN KLAMMES TEAM NOCH WERT IST. Nicht null — ein starkes Reha-Zentrum
 * hilft auch einem armen Team, und Chris hat ausdruecklich gesagt, dass ein klammes Team eine gute
 * Gebäude-Karte trotzdem nehmen darf („sie muessen sich ueberlegen ob es das wert ist"). Aber
 * deutlich weniger als die Haelfte, denn der Cash fehlt sofort und das Gebäude wirkt erst ueber die
 * Saison.
 */
const SPONSOR_AI_LEIHWERT_BEI_GELDNOT = 0.4;

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
  /**
   * Eigene Gebäudestufen dieses Teams. Ohne sie bleibt der Leih-Term unwirksam — dasselbe
   * Verhalten wie vor seiner Einfuehrung, damit bestehende Aufrufer nichts merken.
   */
  eigeneFacilityStufen?: Readonly<Record<string, number>>;
  /**
   * Was dieses Team von einem GEBÄUDETYP hat (sponsor-leih-passung.ts). Optional: fehlt es, wird der
   * Leihwert wie zuvor ungewichtet gezaehlt — bestehende Aufrufer und Tests merken nichts.
   */
  leihPassung?: {
    beliebtheit: number;
    entwicklerGrad: number;
    /** Anteil Kader mit Rating < 45; `null`, solange es keinen Kader gibt (Saison 1 vor dem Draft). */
    academyBerechtigtAnteil: number | null;
    kaderLuecke: number;
  };
}): number {
  const { offer, profile, identity, cashPressure } = input;
  const terms = getSponsorV3Terms(offer);
  const axisKey = terms?.axis?.key as SponsorV4AxisKey | undefined;

  let score = 0;

  // WAS DIE KARTE ÜBERHAUPT ZAHLT — und bis hierher stand das NICHT in der Rechnung.
  //
  // Der Befund kam aus einer Messung, nicht aus der Codeinspektion: nach Einfuehrung des
  // Gebaeude-Terms unten waehlten 26 von 32 Teams die groesste Gebaeude-Karte, auch bei Kasse −30.
  // Grund war nicht der neue Term, sondern eine Luecke, die er sichtbar gemacht hat: KEINER der
  // Terme hier mass die absolute Hoehe der Karte. Der Kurven-Term rechnet `fitValue − anchor`, also
  // eine FORM; der Achsen-Term einen Zusatz; der Rest Risiko. Solange alle Karten eines Slates auf
  // denselben Erwartungswert normiert waren (bis E1/E10), war das genau richtig — die Hoehe war
  // konstant und haette in jedem Vergleich denselben Summanden addiert.
  //
  // Seit eine Gebaeude-Karte weniger zahlt (E1) und eine legendaere mehr (E10), ist die Hoehe eine
  // ECHTE Unterscheidung. Ohne sie sah die KI nur noch den Nutzen des Gebaeudes und nie seinen
  // Preis. `terms.anchor` ist per Konstruktion der Erwartungswert der Karte — genau die Groesse, die
  // hier fehlte, und in derselben Einheit wie der Gebaeude-Term weiter unten.
  if (terms) {
    score += terms.anchor;
  }

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

  // LAUFZEIT-TERM (siehe SPONSOR_AI_TERM_INSURANCE_SHARE oben): erwarteter Erosionsverlust ueber die
  // Restlaufzeit gegen einen kleinen Versicherungswert fuer den eingefrorenen Sockel aufgewogen.
  //
  // DER SOCKEL MUSS DER SOCKEL DIESER KARTE SEIN, nicht der nackte Liga-Sockel des Startrangs.
  // Bis hierher stand hier `sponsorSockelFuerStartrang(terms.startRank)` — ohne Raritaets-Wertfaktor
  // und ohne Gebaeude-Verzicht, waehrend `terms.anchor` einen Zeile darunter beides enthaelt. Die
  // Differenz `anchor − sockel` verglich damit zwei verschiedene Waehrungen. GEMESSEN ueber die 160
  // Angebote des Live-Abbilds (11.08.2026): Ø 9,76 C zu hoher Sockel, groesste Abweichung 30,2 C
  // (gewoehnliche Gebaeude-Karte, Verzicht 25,4 bei Startrang 23: gerechnet 43,2, echt 13,1). Beides
  // in derselben Richtung falsch — der Wertungsanteil (und damit der Erosionsverlust) zu KLEIN, der
  // Versicherungswert zu GROSS: die KI hielt Mehrjahresvertraege systematisch fuer besser, als sie
  // sind, und zwar am staerksten bei genau den Karten mit dem groessten Verzicht.
  //
  // `sponsorV3EingefrorenerSockel` ist dieselbe Formel, aus der die Leiter und ihr Netz gebaut werden.
  if (terms && offer.termSeasons != null && offer.termSeasons > 1) {
    const sockel = sponsorV3EingefrorenerSockel(terms);
    const wertungsanteil = Math.max(0, terms.anchor - sockel);
    let erosionLoss = 0;
    for (let year = 2; year <= offer.termSeasons; year += 1) {
      const contractYear = Math.max(1, Math.min(3, year)) as 1 | 2 | 3;
      erosionLoss += (1 - getSponsorTermMultiplier(contractYear)) * wertungsanteil;
    }
    // Der Versicherungswert liest den Sockel als GELD — und Geld ist nicht negativ. Bei einer grossen
    // Leihe auf einem vorderen Startrang uebersteigt der Verzicht den skalierten Sockel (gemessen: 5
    // von 160 Angeboten, bis −3,5 C); dort haelt `terms.floor` die Leiter, nicht der Sockel. Ohne den
    // Clamp bekaeme so eine Karte einen NEGATIVEN Versicherungswert, also einen Abschlag fuer eine
    // Absicherung, die sie sehr wohl hat. Der Wertungsanteil oben bleibt ungeklammert — er ist der
    // Drehpunkt der Erosion, kein Geldbetrag.
    const insuranceValue = SPONSOR_AI_TERM_INSURANCE_SHARE * Math.max(0, sockel) * (offer.termSeasons - 1);
    score += insuranceValue - erosionLoss;
  }

  // KEIN VORSCHUSS-TERM MEHR. Hier stand die Bewertung der zweiten Dimension (`+0,25 * Betrag` bei
  // Kassendruck >= 7, sonst `−Gebuehr`). Da keine Karte mehr frueher zahlt, gibt es nichts zu
  // bewerten — die Kassenlage wirkt jetzt ausschliesslich ueber die SPARABSICHT unten, die ohnehin
  // die inhaltlich richtige Frage stellt: welche Karte traegt bei knapper Kasse am wenigsten
  // Abwaertsrisiko?
  //
  // SPARABSICHT: ein Team mit echter Sparabsicht (klamm und/oder in der
  // seltenen Eco-Round-Doktrin) soll die Karte mit der GERINGSTEN erwarteten Abwaertsseite
  // bevorzugen, siehe `sponsorV3DownsideShortfall` fuer die Begruendung dieser Groesse. `ecoIntent01`
  // ist fuer jedes Team mit `cashPressure == 3` (entspannte Kasse, keine Eco-Round-Doktrin) exakt 0 —
  // fuer diese Teams ist dieser Term dann exakt 0, unveraendertes Verhalten (siehe `resolveEcoIntent01`
  // fuer die Messung, die diese Formel ersetzt hat).
  if (terms && (input.ecoIntent01 ?? 0) > 0) {
    score -= (input.ecoIntent01 ?? 0) * SPONSOR_AI_ECO_DOWNSIDE_WEIGHT * sponsorV3DownsideShortfall(terms);
  }

  // DAS GEBÄUDE — bis hierher bewertete die KI es GAR NICHT.
  //
  // Der Befund, und er ist unangenehm: die Punkte oben rechnen ausschliesslich in Cash. Eine
  // Gebäude-Karte hat eine niedrigere Leiter (E1), also war sie fuer die KI schlicht eine
  // schlechtere Karte — was sie trotzdem oft gewaehlt hat, lag am Achsen-Term, nicht am Gebäude.
  // Sie hat also fuer den richtigen Preis das Falsche gekauft.
  //
  // WAS DAS GEBÄUDE WERT IST, ist bereits gerechnet: `leihwertJeSaison` ist genau die Groesse, in
  // der die Karte bepreist wurde (`Verzicht = Leihwert / Kurs`). Sie hier zu addieren macht die
  // Rechnung geschlossen — die KI zahlt Cash und bekommt Gegenwert, und der Vergleich zwischen
  // reiner Cash-Karte und Gebäude-Karte wird zu dem, was er sein soll: eine Abwaegung.
  //
  // DREI ABSCHLAEGE, damit daraus kein blinder Gebäude-Hunger wird:
  //
  //   RANGMARKE — das Gebäude wirkt nur, solange das Team ueber der Marke steht. Eine harte Marke
  //   ist ein echtes Risiko; #490 schaetzt die Uptime auf 70-80 % (mild ~90 %), gemessen ist sie
  //   nicht (Abschnitt 7, Punkt 2). Die Schaetzung steht hier als das, was sie ist.
  //
  //   ZUSTAND — eine gewoehnliche Leihe startet bei 70 % und wirkt entsprechend schwaecher. Der
  //   Wirkungsgrad ist dieselbe Kurve, die auch das Spiel rechnet.
  //
  //   EIGENER BESTAND — wer das Gebäude selbst schon hoeher hat, bekommt vom Overlay (`max`) gar
  //   nichts. So eine Karte ist fuer dieses Team wertlos, egal wie gut sie aussieht.
  if (offer.sponsorLeihe) {
    const leihe = offer.sponsorLeihe;
    const eigeneStufe = input.eigeneFacilityStufen?.[leihe.facilityId] ?? 0;
    const geliehene = leihe.stufenreihe[0] ?? 0;
    if (geliehene > eigeneStufe) {
      const uptime = leihe.rangmarkenHaerte === "hart" ? SPONSOR_AI_UPTIME_HART : SPONSOR_AI_UPTIME_MILD;
      const wirkungsgrad = getFacilityEfficiencyPct(leihe.startZustandPct) / 100;
      // EIN GEBÄUDE ZAHLT KEINE GEHÄLTER, und das ist der vierte und wichtigste Abschlag.
      //
      // Ohne ihn ist eine Gebäude-Karte IMMER das bessere Geschaeft, und zwar konstruktionsbedingt:
      // der Verzicht ist `Leihwert / Kurs`, das Gebäude also je nach Rarität das 1,4- bis 3,0-fache
      // des aufgegebenen Cash wert. Fuer ein Team mit voller Kasse stimmt diese Rechnung auch. Fuer
      // eines, das am Saisonende seine Gehaelter nicht zahlen kann, stimmt sie nicht: ein
      // Trainingszentrum laesst sich nicht ausschuetten. Gemessen zeigte sich genau das — ohne
      // diesen Abschlag griff KEIN einziges der 32 Teams zur reinen Cash-Karte, auch bei Kasse −30.
      //
      // Die Schwelle ist dieselbe wie ueberall sonst in dieser Datei (`cashPressure >= 7`), damit es
      // nicht einen zweiten Klammheits-Begriff gibt.
      const cashNutzbar = cashPressure >= 7 ? SPONSOR_AI_LEIHWERT_BEI_GELDNOT : 1;
      // DER FUENFTE ABSCHLAG: PASST DER GEBÄUDETYP UEBERHAUPT ZU DIESEM TEAM?
      //
      // `leihwertJeSaison` ist fuer jedes Nicht-Einnahmegebaeude `Katalogkosten / 5 + Unterhalt` —
      // eine Zahl ueber den SELBSTBAU, die nicht weiss, welches Gebaeude sie bepreist. Ohne die
      // Passung waren eine Academy und ein Analytics Room bei gleichem Leihwert dasselbe Angebot,
      // auch fuer ein Team, das seine Spieler durchreicht bzw. als KI gar keine Anzeige liest.
      // Chris: „was machen die mit ner academy? ob das dann was bringt ist ja auch fraglich."
      // Jeder Faktor ist aus dem nachgelesenen Effekt abgeleitet, siehe sponsor-leih-passung.ts.
      const passung = input.leihPassung
        ? sponsorLeihPassungFuerTeam({
            facilityId: leihe.facilityId,
            stufe: geliehene,
            beliebtheit: input.leihPassung.beliebtheit,
            entwicklerGrad: input.leihPassung.entwicklerGrad,
            langeVertraege: profile?.bias.longContractPreference ?? 5,
            kurzeVertraege: profile?.bias.shortContractPreference ?? 5,
            verkaufsneigung: profile?.bias.sellForProfitAggression ?? 5,
            kaderTiefeNeigung: profile?.bias.rosterDepthPreference ?? 5,
            academyBerechtigtAnteil: input.leihPassung.academyBerechtigtAnteil,
            kaderLuecke: input.leihPassung.kaderLuecke,
          })
        : 1;
      score += (leihe.leihwertJeSaison[0] ?? 0) * uptime * wirkungsgrad * cashNutzbar * passung;
    }

    // DAS BONUS-ZIEL DER KARTE. Es ist mit `p = 0` bepreist, also reines Aufwaerts — wer es
    // verfehlt, verliert nichts. Genau deshalb darf es hier NICHT gegen 0,5 gerechnet werden wie
    // frueher die Achse, sondern mit dem geschaetzten Erfuellungsgrad mal der Praemie.
    if (terms?.goalKey === LEIH_ZIEL_FRISCHE || terms?.goalKey === LEIH_ZIEL_ACHSENRANG) {
      const tiefe = profile?.bias.rosterDepthPreference ?? 5;
      // Frische haengt an Rotation und damit an Kadertiefe; der Achsen-Rang an nichts, was die KI
      // vor der Saison kennt — dort bleibt es bei der neutralen Haelfte.
      const chance =
        terms.goalKey === LEIH_ZIEL_FRISCHE
          ? Math.max(0.2, Math.min(0.8, 0.2 + 0.06 * tiefe + (input.rosterSize ?? 0 > (identity?.playerOpt ?? 14) ? 0.1 : 0)))
          : 0.5;
      score += chance * terms.goalSize;
    }
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
 * SPARABSICHT EINES TEAMS — bewusst schlank: kein Konjunktur-Anteil und kein Ambitions-Daempfer. Beim
 * Konjunktur-Anteil ist schon das Vorzeichen eine Designvermutung ("im mageren Jahr ist Ambition
 * billig zu opfern" ist genauso plausibel wie "vor mageren Jahren Runway aufbauen") — ein
 * Koeffizient, dessen Richtung geraten ist, waere schlechter als ihn wegzulassen.
 *
 * FRUEHERE FASSUNG (bis zur Nachbesserung hier) mischte `cash_recovery` aus `buildSeasonStrategyState`
 * als HAUPTSIGNAL ein (Gewicht 0,6). Direktmessung am Live-Save (`new-game-1785174792968-8d7mdx`, 32
 * Teams) zeigt, warum das falsch war: `cash_recovery` triggert dort bei 31 von 32 Teams — nicht ueber
 * die Kasse, sondern ueber `salaryPressure = Gehalt/Kasse > 1,25` (Gehaelter 50-84 gegen typische
 * Kassenstaende reissen diese Schwelle praktisch immer). `cash_recovery` IST DER NORMALZUSTAND DIESER
 * LIGA, nicht das Ausnahmesignal, als das es hier gebraucht wurde — ein Team davon zu unterscheiden
 * traegt keine Information. Mit `strategy01` als Hauptgewicht lag `ecoIntent01` fuer ALLE 32 Teams
 * zwischen 0,3 und 1,0 (Mittel 0,75, KEIN Team bei 0) — der Term war de facto eine globale
 * Risikoaversion von rund 0,75 * Gewicht fuer jedes Team, keine Eco-Entscheidung. Das erklaerte auch,
 * warum sich "entspannte" Teams in der Messung mitverbesserten: sie bekamen denselben Term wie klamme.
 *
 * DESHALB TRAEGT `cash_recovery` HIER JETZT KEIN GEWICHT MEHR. Das Hauptsignal ist `pressure01` — die
 * bestehende, tatsaechlich trennscharfe `cashPressure`-Kaskade aus `chooseSponsorOfferForAiTeams`
 * (ueber 6 Saison-Seeds: 102 von 186 Vertraegen bei Druck >= 7, 84 bei Druck 3 — eine echte, keine
 * gesaettigte Verteilung). `eco_round` bleibt als kleiner Zuschlag: mit 1 von 32 Teams ist es SELTEN
 * und damit informativ, im Unterschied zu `cash_recovery`.
 *
 * `pressure01` ist BINAER bei `cashPressure >= 7`, nicht linear zwischen 3 und 10 hochgezogen — eine
 * erste Fassung hatte hier linear gemischt (`(cashPressure-3)/7`, also 0,571 bei Druck 7 gegen 1,0 bei
 * Druck 10) und blieb dadurch fuer den GROSSTEIL der klammen Teams zu schwach: 72 von 102 klammen
 * Vertraegen liegen bei Druck 7, nicht 10, aber die Gewichtsobergrenze wird vom Vorschuss-Test
 * (`tests/sponsor-v4-ki-wahl.test.ts`, siehe `SPONSOR_AI_ECO_DOWNSIDE_WEIGHT`) allein ueber Druck-10-
 * Teams gesetzt — mit linearer Mischung blieb fuer Druck 7 dadurch nur ein effektiver Multiplikator von
 * `0,571 * Gewicht`, spuerbar zu wenig. Die binaere Fassung deckt sich zudem mit der bereits
 * bestehenden Konvention dieser Datei: `resolveAiSponsorArchetypePreference` und der Vorschuss-Term
 * selbst (`cashPressure >= 7 ? ... : ...`, weiter oben) behandeln Druck 7 und Druck 10 schon jetzt als
 * EINEN Zustand, nicht als Kontinuum — `pressure01` folgt hier nur derselben Linie. Die Vorschuss-
 * Testschranke (siehe unten) pruefte immer schon ausschliesslich Druck-10-Teams (Kasse < 0 fuer alle
 * 32 Teams des Szenarios); Druck 7 auf denselben Wert zu heben aendert an dieser Schranke NICHTS.
 */
function resolveEcoIntent01(input: { seasonStrategy: AiSeasonStrategy | undefined; cashPressure: number }): number {
  const pressure01 = input.cashPressure >= 7 ? 1 : 0;
  const ecoRoundBonus = input.seasonStrategy === "eco_round" ? 0.25 : 0;
  return Math.max(0, Math.min(1, pressure01 + ecoRoundBonus));
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
  // Einmal je Liga statt je Kadereintrag: die Academy-Berechtigung unten braucht nur das Rating.
  const ratingByPlayerId = new Map(nextGameState.players.map((player) => [player.id, player.rating]));

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
    // Der EIGENE Bestand, nicht der ueber `getTeamFacilityState` gelesene: Letzterer traegt eine
    // laufende Leihe mit, und dann bewertete die KI ein Angebot gegen ein Gebaeude, das sie in der
    // naechsten Saison gar nicht mehr hat.
    const eigeneFacilityStufen = Object.fromEntries(
      Object.entries(nextGameState.seasonState.teamFacilities?.[team.teamId]?.facilities ?? {}).map(
        ([facilityId, eintrag]) => [facilityId, eintrag?.level ?? 0],
      ),
    );
    // WAS DIESES TEAM VON EINEM GEBÄUDETYP HAT. Alle vier Groessen stehen bereits, BEVOR der Draft
    // laeuft — bis auf die kaderabhaengigen, und genau die sind hier als „unbekannt" gefuehrt statt
    // als 0: in einem neuen Spiel unterschreiben die KI-Teams ihren Sponsor mit noch leeren Kadern
    // (gemessen: 1 Spieler in der ganzen Liga), und ein Anteil „0 von 0 berechtigten Spielern" waere
    // kein Befund, sondern eine Falschaussage ueber jedes Team der Liga.
    const kader = nextGameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const berechtigt = kader.filter(
      (entry) => (ratingByPlayerId.get(entry.playerId) ?? Number.POSITIVE_INFINITY) < ACADEMY_RATING_GRENZE,
    ).length;
    const leihPassung = {
      beliebtheit: computeTeamBeliebtheitFromGameState(nextGameState, team.teamId).value,
      entwicklerGrad: getTeamDevelopmentTendency({
        team,
        identity,
        profile,
        gmArchetype: getTeamGeneralManager(nextGameState, team.teamId)?.profile?.archetype ?? null,
      }).score,
      academyBerechtigtAnteil: kader.length > 0 ? berechtigt / kader.length : null,
      // OHNE KADER GIBT ES KEINE KADERLUECKE, sondern gar keine Aussage. Rechnete man hier
      // `playerOpt − 0`, bekaeme in Saison 1 JEDES Team dieselbe maximale Luecke (gemessen: 8 bis 14)
      // — ein konstanter Zuschlag fuer alle statt einer Unterscheidung, und der Reha-/Scouting-Term
      // haenge an einer Zahl, die nur sagt, dass der Draft noch nicht gelaufen ist.
      kaderLuecke: rosterSize > 0 ? Math.max(0, (identity?.playerOpt ?? 0) - rosterSize) : 0,
    };
    const scoreArgs = {
      profile, identity, cashPressure, powerRank, teamId: team.teamId, cash: row?.cash ?? 0, rosterSize, ecoIntent01,
      eigeneFacilityStufen, leihPassung,
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

/**
 * KARTENRAUM-AUDIT V2 — MESSKERN.
 *
 * Misst JEDE einzelne Karte eines echt erzeugten Angebotssatzes (32 Teams x 5 Angebote) auf ihre
 * tatsaechlichen BETRAEGE — nicht auf Strukturmerkmale. Der Anlass steht in den Screenshots des
 * Auftraggebers: eine magische Karte, die auf allen 32 Raengen flach 37,0 zahlte (Rangleiter,
 * Klausel und Sonderziel alle tot), und eine legendaere Karte, deren Sonderziel 77 % der
 * Auszahlung trug. Alle bisherigen Tests hatten entweder das abstrakte Modell mit eigenen
 * Parametern geprueft oder die Verdrahtung ("hat V2-Konditionen") — nie die real erzeugten
 * Betraege. Dieser Messkern schliesst genau diese Luecke und wird von zwei Seiten benutzt:
 *
 *   - scripts/sponsor-v2-card-audit.ts   — CLI-Werkzeug, mehrere Saetze, voller Zahlenbericht
 *   - tests/sponsor-v2-card-space-audit.test.ts — CI-Wache mit denselben Kriterien
 *
 * DIE SECHS KRITERIEN (je Karte bzw. je Satz), alle in C und NACH K — also genau die Zahlen,
 * die der Spieler sieht und die das Settlement bucht:
 *
 *   A  Rangleiter nicht flach: garantierte Auszahlung Meister minus Platz 32 >= MIN_SPREAD.
 *   B  Sonderziel <= 15 % des Kartenwerts, gemessen an der Auszahlung auf dem ERWARTUNGSRANG mit
 *      erfuellter Klausel und erreichtem Ziel — die Zeile, an der der 77-%-Verstoss auffiel.
 *   C  Kein Modul tot: Klausel-Wirkung und Sonderziel-Wirkung auf dem Erwartungsrang >= MIN_EFFECT.
 *   D  Auszahlung ueber die Raenge monoton nicht-fallend (garantierte Leiter).
 *   E  Innerhalb einer Rarity kein Kartenwert ein Vielfaches eines anderen: je (Team-Liste, Rarity)
 *      und je (Erwartungsstufe, Rarity) liga-weit max/min <= MULTIPLE_RATIO.
 *   F  Vereinbarte Baender: Meister-Auszahlung der Spitzenteams im Band, Platz-32-Auszahlung der
 *      Kellerteams im Band, Untergrenze je Rarity exakt 35/37/39/42, Rarity-Leiter monoton.
 */
import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import { ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import {
  getSponsorV2Terms, resetSponsorV2KCache, sponsorV2GuaranteedLadder, sponsorV2Settle,
  type SponsorV2ContractTerms,
} from "@/lib/sponsor/sponsor-v2-offer-service";
import {
  SPONSOR_V2_FLOOR_RARITY, SPONSOR_V2_RARITIES, SPONSOR_V2_RARITY_MULT, sponsorV2TierOf,
} from "@/lib/sponsor/sponsor-v2-model";

// ── Schwellen der sechs Kriterien ──────────────────────────────────────────────────────────────
/** A: Mindestspreizung Meister vs. Platz 32 der GARANTIERTEN Leiter. Darunter ist der Endrang egal. */
export const AUDIT_MIN_LADDER_SPREAD_C = 12;
/** B: Vorgabe des Auftraggebers, woertlich: "sonderziel max 15%" des Kartenwerts. */
export const AUDIT_GOAL_MAX_SHARE = 0.15;
/** C: Mindestwirkung von Klausel und Sonderziel auf dem Erwartungsrang. 0,0 ist ein totes Modul. */
export const AUDIT_MIN_MODULE_EFFECT_C = 1.0;
/**
 * E: max/min-Verhaeltnis der Kartenwerte innerhalb einer Vergleichsgruppe gleicher Rarity.
 * "Kein Vielfaches" heisst wortwoertlich Faktor 2; die Schwelle liegt bewusst DARUNTER. Sie liegt
 * aber ueber ~1.7, weil der Kartenwert am ERWARTUNGSRANG gemessen wird und die Kurvenidentitaeten
 * dort absichtlich auseinanderliegen (Halten zahlt +12 fuer exaktes Halten, Gipfel −6 unterhalb
 * von zwei Stufen Sprung — beide EV-paritaetisch ueber die ganze Verteilung). Der gemeldete
 * Defekt lag bei 5,8x (37,0 gegen 214,4 C) und wird von dieser Schwelle klar gefangen.
 */
export const AUDIT_MAX_MULTIPLE_RATIO = 1.75;
/**
 * F: Meister-Band. Das vereinbarte "Meister rund 90-100 bei sf 1.0" ist eine Aussage ueber die
 * TYPISCHE Karte, gemessen auf magischen Referenztypen (Rarity-Multiplikator 1.0) und im
 * Schattentest bereits auf 90-120 geweitet, weil die Kurvenidentitaeten den Titel absichtlich
 * verschieden bepreisen (Sockel wenig oben/viel unten, Steil umgekehrt — EV-paritaetisch).
 * Deshalb ZWEI Pruefungen, beide nominal (K herausgerechnet) und auf den Rarity-Multiplikator
 * normiert: der MEDIAN je Satz muss im Kernband liegen, JEDE Karte im Extremband (dessen Decke =
 * 120er-Bandgrenze + Formamplitude der Profile; dessen Boden faengt tote Spitzen wie die
 * gemeldete legendaere Karte mit Meister 42,0).
 */
/**
 * Kernband des Medians: je Satz stammen nur n=20 Karten von Spitzenteams (4 Teams x 5 Angebote);
 * der Kurven/Profil-Mix streut den Median dadurch um mehrere C (gemessen 103-116 ueber 5 Saetze).
 * 118 = Obergrenze des im Schattentest geweiteten 90-120-Bands minus Rundungsreserve.
 */
export const AUDIT_CHAMPION_MEDIAN_BAND: readonly [number, number] = [90, 118];
/**
 * Extremband je Karte: 82 unten (eine "Flach"/"Sockel"-Identitaet zahlt den Titel bewusst
 * schwach — tote Spitzen wie die gemeldete 42,0 liegen weit darunter), 132 oben (120er-Band
 * plus Formamplitude).
 */
export const AUDIT_CHAMPION_BAND: readonly [number, number] = [82, 132];
/**
 * F: Platz-32-Band — eine SCHUTZ-Aussage: was die Karte eines Kellerteams bei Endrang 32
 * GARANTIERT (Klausel verletzt, Ziel verfehlt). "Letzter je nach Karte im Bereich 37-64" —
 * gewoehnliche Karten duerfen bis auf ihre Untergrenze 35 fallen.
 */
export const AUDIT_LAST_PLACE_BAND: readonly [number, number] = [35, 64];

export type CardMeasurement = {
  seed: string;
  teamId: string;
  offerId: string;
  name: string;
  rarity: string;
  curveName: string;
  profileName: string;
  goalKey: string | null;
  expectedRank: number;
  /** Garantierte Leiter (Klausel verletzt, Ziel verfehlt), Index 0 = Meister. */
  guaranteedTop: number;
  guaranteedBottom: number;
  spread: number;
  /** Erwartete Auszahlung bei Endrang 1 bzw. 32 ueber die Modulzustaende (Klausel mit ihrem P, Ziel mit seinem P). */
  championEv: number;
  lastPlaceEv: number;
  /**
   * Dieselben Groessen ZURUECKGERECHNET auf K = 1 (`fl + (v - fl) / k` — die Untergrenze skaliert
   * nicht mit K). Die vereinbarten Baender ("Meister rund 90-100 bei sf 1.0") sind NOMINALE
   * Aussagen; K hebt oder senkt die ganze Liga proportional, damit Sigma Sponsoren die reale
   * Gehaltssumme trifft (im frischen Spiel gemessen: K = 1.131). Ob K die Liga-Deckung trifft,
   * prueft der Live-Check — die Baender pruefen die FORM der Verteilung, deshalb ohne K.
   */
  championEvNominal: number;
  lastPlaceEvNominal: number;
  guaranteedBottomNominal: number;
  k: number;
  /** Auszahlung auf dem Erwartungsrang: Klausel erfuellt, Ziel erreicht — der "Kartenwert". */
  cardValue: number;
  goalDelta: number;
  goalShare: number;
  clauseDelta: number;
  monotoneViolations: number;
  worstBackstep: number;
};

export type CriterionFail = { criterion: "A" | "B" | "C" | "D" | "E" | "F"; detail: string; card?: CardMeasurement };

export type SeedAuditResult = {
  seed: string;
  cards: CardMeasurement[];
  missingV2Terms: number;
  fails: CriterionFail[];
  /** Kennzahlen fuer den Bericht. */
  stats: {
    championPayouts: number[];
    lastPlacePayouts: number[];
    rarityMeans: Record<string, number>;
    rarityFloorMin: Record<string, number>;
    goalShareMax: number;
    spreadMin: number;
    /** Liga-K des Satzes: Skalierung, mit der Sigma Sponsoren die reale Gehaltssumme trifft. */
    k: number;
  };
};

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function measureOffer(seed: string, offer: SponsorOffer): CardMeasurement | null {
  const terms: SponsorV2ContractTerms | null = getSponsorV2Terms(offer);
  if (!terms) return null;
  const ladder = sponsorV2GuaranteedLadder(terms);
  const er = Math.max(1, Math.min(32, Math.round(terms.expectedRank)));
  const withGoal = sponsorV2Settle(terms, er, true, 1);
  const withoutGoal = sponsorV2Settle(terms, er, true, 0);
  const clauseMissed = sponsorV2Settle(terms, er, false, 0);
  let monotoneViolations = 0;
  let worstBackstep = 0;
  for (let i = 1; i < 32; i += 1) {
    // Index 0 = Rang 1 (bester Endrang). Monoton heisst: besserer Rang zahlt nie weniger.
    const step = ladder[i]! - ladder[i - 1]!;
    if (step > 1e-6) {
      monotoneViolations += 1;
      worstBackstep = Math.max(worstBackstep, step);
    }
  }
  const goalDelta = withGoal - withoutGoal;
  // P der Klausel steckt in den abgeleiteten Armen: bonus = s*(1-P), malus = s*P.
  const clauseSpan = terms.clauseBonus + terms.clauseMalus;
  const pClause = clauseSpan > 0 ? terms.clauseMalus / clauseSpan : 0.5;
  const pGoal = terms.goalProbability;
  const evAtRank = (rank: number): number =>
    pClause * (pGoal * sponsorV2Settle(terms, rank, true, 1) + (1 - pGoal) * sponsorV2Settle(terms, rank, true, 0))
    + (1 - pClause) * (pGoal * sponsorV2Settle(terms, rank, false, 1) + (1 - pGoal) * sponsorV2Settle(terms, rank, false, 0));
  const flAtSf = SPONSOR_V2_FLOOR_RARITY[terms.rarity as keyof typeof SPONSOR_V2_FLOOR_RARITY] ?? 37;
  const kSafe = Number.isFinite(terms.k) && terms.k > 0.05 ? terms.k : 1;
  const deK = (v: number): number => flAtSf + (v - flAtSf) / kSafe;
  return {
    seed,
    teamId: offer.teamId,
    offerId: offer.offerId,
    name: offer.name,
    rarity: terms.rarity,
    curveName: terms.curveName,
    profileName: terms.profileName,
    goalKey: terms.goalKey,
    expectedRank: er,
    guaranteedTop: round1(ladder[0]!),
    guaranteedBottom: round1(ladder[31]!),
    spread: round1(ladder[0]! - ladder[31]!),
    championEv: round1(evAtRank(1)),
    lastPlaceEv: round1(evAtRank(32)),
    championEvNominal: round1(deK(evAtRank(1))),
    lastPlaceEvNominal: round1(deK(evAtRank(32))),
    guaranteedBottomNominal: round1(deK(ladder[31]!)),
    k: terms.k,
    cardValue: round1(withGoal),
    goalDelta: round1(goalDelta),
    goalShare: withGoal > 0 ? goalDelta / withGoal : 0,
    clauseDelta: round1(withoutGoal - clauseMissed),
    monotoneViolations,
    worstBackstep: round1(worstBackstep),
  };
}

/** Prueft die Kriterien A-D je Karte und E+F ueber den ganzen Satz. */
export function auditCards(seed: string, cards: CardMeasurement[], missingV2Terms: number): SeedAuditResult {
  const fails: CriterionFail[] = [];
  const label = (c: CardMeasurement) =>
    `${c.teamId} ${c.name} [${c.rarity}/${c.curveName}/${c.profileName}, ER ${c.expectedRank}]`;

  for (const c of cards) {
    if (c.spread < AUDIT_MIN_LADDER_SPREAD_C) {
      fails.push({ criterion: "A", card: c, detail: `${label(c)}: Spreizung ${c.spread} C < ${AUDIT_MIN_LADDER_SPREAD_C} C (Leiter ${c.guaranteedBottom}..${c.guaranteedTop})` });
    }
    if (c.goalShare > AUDIT_GOAL_MAX_SHARE + 1e-3) {
      fails.push({ criterion: "B", card: c, detail: `${label(c)}: Sonderziel ${round1(c.goalShare * 100)} % des Kartenwerts (${c.goalDelta} von ${c.cardValue} C)` });
    }
    if (c.clauseDelta < AUDIT_MIN_MODULE_EFFECT_C) {
      fails.push({ criterion: "C", card: c, detail: `${label(c)}: Klausel-Wirkung ${c.clauseDelta} C — Modul tot` });
    }
    if (c.goalDelta < AUDIT_MIN_MODULE_EFFECT_C) {
      fails.push({ criterion: "C", card: c, detail: `${label(c)}: Sonderziel-Wirkung ${c.goalDelta} C — Modul tot` });
    }
    if (c.monotoneViolations > 0) {
      fails.push({ criterion: "D", card: c, detail: `${label(c)}: ${c.monotoneViolations} nicht-monotone Stufen, groesster Rueckschritt ${c.worstBackstep} C` });
    }
  }

  // E: kein Kartenwert ein Vielfaches eines anderen derselben Rarity — in der Angebotsliste EINES
  // Teams (dieselbe Wahl-Situation) und liga-weit je Erwartungsstufe (dieselbe Ausgangslage).
  const groups = new Map<string, CardMeasurement[]>();
  for (const c of cards) {
    const byTeam = `Team ${c.teamId}, ${c.rarity}`;
    const byTier = `Stufe ${sponsorV2TierOf(c.expectedRank)}, ${c.rarity}`;
    for (const key of [byTeam, byTier]) {
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
  }
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.cardValue - b.cardValue);
    const min = sorted[0]!;
    const max = sorted.at(-1)!;
    if (min.cardValue > 0 && max.cardValue / min.cardValue > AUDIT_MAX_MULTIPLE_RATIO) {
      fails.push({
        criterion: "E", card: min,
        detail: `${key}: ${round1(max.cardValue / min.cardValue)}x zwischen ${label(max)} (${max.cardValue} C) und ${label(min)} (${min.cardValue} C)`,
      });
    }
  }

  // F: vereinbarte Baender. Meister an den Karten der Spitzenteams (Erwartungsstufe 0-1), Platz 32
  // an den Karten der Kellerteams (Stufe 8), Untergrenze je Rarity, Rarity-Leiter monoton.
  const normMult = (c: CardMeasurement): number =>
    SPONSOR_V2_RARITY_MULT[c.rarity as keyof typeof SPONSOR_V2_RARITY_MULT] ?? 1;
  const championPayouts = cards.filter((c) => sponsorV2TierOf(c.expectedRank) <= 1).map((c) => c.championEvNominal / normMult(c));
  const lastPlacePayouts = cards.filter((c) => sponsorV2TierOf(c.expectedRank) >= 8).map((c) => c.guaranteedBottomNominal);
  for (const c of cards) {
    const tier = sponsorV2TierOf(c.expectedRank);
    const champNorm = c.championEvNominal / normMult(c);
    if (tier <= 1 && (champNorm < AUDIT_CHAMPION_BAND[0] || champNorm > AUDIT_CHAMPION_BAND[1])) {
      fails.push({ criterion: "F", card: c, detail: `${label(c)}: Meister-Erwartung ${c.championEv} C gezahlt = ${round1(champNorm)} C nominal/rarity-normiert, ausserhalb [${AUDIT_CHAMPION_BAND.join(", ")}]` });
    }
    if (tier >= 8 && (c.guaranteedBottomNominal < AUDIT_LAST_PLACE_BAND[0] || c.guaranteedBottomNominal > AUDIT_LAST_PLACE_BAND[1])) {
      fails.push({ criterion: "F", card: c, detail: `${label(c)}: Platz-32-Garantie ${c.guaranteedBottom} C gezahlt = ${c.guaranteedBottomNominal} C nominal, ausserhalb [${AUDIT_LAST_PLACE_BAND.join(", ")}]` });
    }
  }
  if (championPayouts.length > 0) {
    const sorted = [...championPayouts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (median < AUDIT_CHAMPION_MEDIAN_BAND[0] || median > AUDIT_CHAMPION_MEDIAN_BAND[1]) {
      fails.push({ criterion: "F", detail: `Meister-Median ${round1(median)} C (nominal/rarity-normiert, n=${sorted.length}) ausserhalb [${AUDIT_CHAMPION_MEDIAN_BAND.join(", ")}]` });
    }
  }
  const rarityMeans: Record<string, number> = {};
  const rarityFloorMin: Record<string, number> = {};
  for (const rarity of SPONSOR_V2_RARITIES) {
    const list = cards.filter((c) => c.rarity === rarity);
    if (list.length === 0) continue;
    rarityMeans[rarity] = round1(list.reduce((a, c) => a + c.cardValue, 0) / list.length);
    rarityFloorMin[rarity] = round1(Math.min(...list.map((c) => c.guaranteedBottom)));
    const floor = SPONSOR_V2_FLOOR_RARITY[rarity];
    if (rarityFloorMin[rarity]! < floor - 0.05) {
      fails.push({ criterion: "F", detail: `Untergrenze ${rarity}: kleinste garantierte Auszahlung ${rarityFloorMin[rarity]} C unterschreitet die vereinbarte ${floor} C` });
    }
  }
  // Rarity-Leiter monoton: der mittlere Kartenwert muss mit der Rarity steigen. Gemessen wird je
  // Erwartungsstufe (sonst mischt die Teamstaerke hinein), gefordert ueber das Stufen-Mittel.
  for (let i = 1; i < SPONSOR_V2_RARITIES.length; i += 1) {
    const lower = rarityMeans[SPONSOR_V2_RARITIES[i - 1]!];
    const higher = rarityMeans[SPONSOR_V2_RARITIES[i]!];
    if (lower !== undefined && higher !== undefined && higher < lower - 0.5) {
      fails.push({ criterion: "F", detail: `Rarity-Leiter nicht monoton: Ø ${SPONSOR_V2_RARITIES[i]} ${higher} C < Ø ${SPONSOR_V2_RARITIES[i - 1]} ${lower} C` });
    }
  }
  if (missingV2Terms > 0) {
    fails.push({ criterion: "F", detail: `${missingV2Terms} Angebote ohne V2-Konditionen — der Erzeugungspfad ist nicht durchgaengig V2` });
  }

  return {
    seed,
    cards,
    missingV2Terms,
    fails,
    stats: {
      championPayouts,
      lastPlacePayouts,
      rarityMeans,
      rarityFloorMin,
      goalShareMax: cards.reduce((a, c) => Math.max(a, c.goalShare), 0),
      spreadMin: cards.reduce((a, c) => Math.min(a, c.spread), Number.POSITIVE_INFINITY),
      k: cards[0]?.k ?? 1,
    },
  };
}

/**
 * Erzeugt einen kompletten Angebotssatz ueber den ECHTEN Pfad und misst ihn.
 *
 * Seed 0 ist exakt der Weg des "Neues Spiel"-Knopfes: `buildNewGameStateFromBaseline` erzeugt die
 * Angebote beim Anlegen. Jeder weitere Seed nimmt denselben Spielstand, traegt eine andere
 * Saison-ID ein (genau die Groesse, ueber die der Slate-Wurf im echten Spiel von Saison zu Saison
 * variiert) und laesst `ensureSeasonSponsorOffers` — dieselbe Funktion, die auch der
 * Preseason-Workflow ruft — den Satz neu erzeugen. Es gibt keinen Seiteneingang und keine
 * nachgestellte Modellrechnung: gemessen wird, was der Spieler bekommt.
 */
export function generateAndMeasureSeed(seedIndex: number): SeedAuditResult {
  resetSponsorV2KCache();
  const built = buildNewGameStateFromBaseline({
    presetId: "solo_1",
    chrisTeamIds: ["M-M"],
    saveId: `sponsor-card-audit-${seedIndex}`,
  });
  let gameState: GameState = built.gameState;
  const seed = seedIndex === 0 ? gameState.season.id : `${gameState.season.id}-audit-${seedIndex}`;
  if (seedIndex > 0) {
    gameState = {
      ...gameState,
      season: { ...gameState.season, id: seed },
      seasonState: { ...gameState.seasonState, sponsorOffersByTeamId: {} },
    };
    gameState = ensureSeasonSponsorOffers(gameState);
  }
  const offers = Object.values(gameState.seasonState.sponsorOffersByTeamId ?? {}).flat();
  const cards: CardMeasurement[] = [];
  let missing = 0;
  for (const offer of offers) {
    const m = measureOffer(seed, offer);
    if (m) cards.push(m);
    else missing += 1;
  }
  return auditCards(seed, cards, missing);
}

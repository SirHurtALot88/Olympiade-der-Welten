import type {
  ContractNegotiationDraft,
  ContractShape,
  ContractYearSalary,
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { CONTRACT_SHAPE_LABELS } from "@/lib/foundation/contract-shape-label";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { resolveElapsedContractSeasonsForBuyout } from "@/lib/market/contract-buyout-season-window";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { calculateTransfermarktFit, getTransfermarktBracket, normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { getTransfermarktScoutingRecruitmentBonus } from "@/lib/market/transfermarkt-scouting";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { getCanonicalSeasonLabelAtOffset } from "@/lib/season/season-label";

type ContractPreviewInput = {
  annualSalary: number | null;
  contractLength: number;
  shape: ContractShape;
  seasonIdBase?: string | null;
  seasonLabelBase: string;
};

type NegotiationPreviewInput = {
  saveId: string;
  seasonId: string;
  teamId?: string | null;
  team: Team | null;
  teamIdentity: TeamIdentity | null;
  teamStrategyProfile: TeamStrategyProfile | null;
  player: Player | null;
  rosterEntry?: RosterEntry | null;
  rosterPlayers: Player[];
  contractLength: number;
  contractShape: ContractShape;
  offeredSalary: number | null;
  scoutingLevel?: number | null;
  priorBadExperience?: boolean;
  /**
   * Affront-Regel (verhandlung-rework.md Abschnitt 4.3): der Draft dieser Season/Team/Spieler-
   * Kombi steht auf "countered" und das JETZT eingehende Angebot ist niedriger als das zuletzt
   * gespeicherte — ein Rueckzieher, nachdem der Spieler schon entgegengekommen ist. Das ist ein
   * Ablauf-Fakt (Vergleich gegen den persistierten Draft), keine der Formel-Groessen, deshalb
   * kommt er von aussen rein statt aus einer der acht W-Zutaten berechnet zu werden. Wenn gesetzt,
   * uebersteuert er das Verdikt zu "reject_affront", unabhaengig von den Schwellen-Baendern.
   */
  affrontRetreat?: boolean;
  /**
   * Trotz-Aufschlag aus dem gespeicherten Draft (verhandlung-rework.md Abschnitt 9.1), Anteil.
   * Wirkt SOFORT auf die Forderung dieser Runde — er ist das Ergebnis eines früheren Klicks
   * auf „Verhandeln", nicht des gerade getippten Angebots.
   */
  priorDefianceSurchargePct?: number;
  /**
   * Sein Geld-Gegenangebot aus der Vorrunde (Abschnitt 9.3), oder `null`, wenn es keins gibt
   * bzw. die Konditionen seither gewechselt haben. Der Aufrufer entscheidet das — er hält den
   * Draft mit `contractLength`/`contractShape`, die Vorschau kennt nur die aktuelle Runde.
   */
  lastCounterSalary?: number | null;
  /** Das Angebot, auf das dieses Gegenangebot folgte — Bezugspunkt für „du bist entgegengekommen". */
  lastNegotiatedSalary?: number | null;
  seasonIdBase?: string | null;
  seasonLabelBase: string;
};

/**
 * Die Reaktion der Gegenseite auf das aktuelle Angebot, deterministisch aus den Schwellen-
 * Baendern in Abschnitt 2.2 von docs/design/verhandlung-rework.md (Reihenfolge ist die
 * Entscheidung, nicht ein Vergleich von drei Prozentwerten):
 * - "accept": r >= R_full (oder Bagatelle-Regel: Restluecke unter 0,02 * D)
 * - "counter_conditions": Geld reicht (r >= R_money), aber Laufzeit/Form nicht (K > 0)
 * - "reject_not_about_money": Angebot ueber der Stolz-Kappe P, aber unter R_money — mehr Geld
 *   waere unglaubwuerdig, er sagt ehrlich ab
 * - "reject_lowball": r < R_rej, zu weit von der Forderung entfernt
 * - "counter_money": alles dazwischen — Geld-Gegenangebot nach der Haerte-Formel
 * - "reject_affront": Sonderfall ausserhalb der Baender, siehe `affrontRetreat` oben
 */
/**
 * Schwellen, ab denen „guter Fit" und „starkes Projekt" als Wechselgrund zählen
 * (verhandlung-rework.md Abschnitt 11).
 *
 * Beide standen vorher oberhalb dessen, was im Spiel real vorkommt, und feuerten deshalb an
 * einem echten Spielstand für **0 %** der Marktspieler:
 *
 * - `LOYAL_FIT_THRESHOLD` stand auf 20. Gemessener Teamfit über drei Teams × 500 Marktspieler:
 *   −49 … +28, P90 = 11,4. Ein Fit über 10 ist bereits ein starker Wert — 20 traf so gut wie
 *   nie mit dem Loyal-Trait zusammen.
 * - `AMBITION_PROJECT_THRESHOLD` stand auf 8. Team-Ambition liegt an echten Ständen bei 2,8
 *   bis 8,8, `starPriority` bei 4. Die 8 war praktisch der Maximalwert, nicht eine hohe Hürde.
 *
 * Das ist derselbe Fehler wie beim verworfenen Eile-Rabatt (Abschnitt 10.1): Gates aus
 * angenommenen statt gemessenen Verteilungen. Wer diese Werte anfasst, misst vorher.
 */
export const LOYAL_FIT_THRESHOLD = 10;
export const AMBITION_PROJECT_THRESHOLD = 7;

/**
 * Trotz-Aufschlag (verhandlung-rework.md Abschnitt 9.1) — die vier Konstanten und warum sie so
 * stehen.
 *
 * - `DEFIANCE_INSULT_RATIO = 0,90`: zehn Prozent unter Forderung. Deutlich unterhalb von allem,
 *   was der Spieler je selbst als Gegenangebot nennt (gemessene Zusage-Schwellen der Sturen
 *   Ø 1,007) — also eindeutig Provokations-, nicht Verhandlungszone. Und oberhalb ihrer
 *   gemessenen Absage-Schwellen (Ø 0,855): genau die bis dahin straffreie Zone dazwischen
 *   bekommt einen Preis.
 * - `DEFIANCE_FACTOR = 1,5`: jeder Prozentpunkt tiefer kostet anderthalb Punkte Aufschlag.
 *   Überproportional, und das ist notwendig: es ist der einzige Grund, warum sich ein Lowball
 *   nicht durch anschließendes Entgegenkommen zurückverdienen lässt. Der größte
 *   Erwiderungs-Faktor ist 0,7 (siehe unten) — 1,5 > 0,7, also ist der Saldo jedes
 *   Lowball-Pfads negativ.
 * - `DEFIANCE_MAX_SURCHARGE = 0,06`: bleibt unter der Vertrauensbruch-Strafe (×1,12). Trotz ist
 *   Ärger, kein Bruch.
 * - `DEFIANCE_MIN_STEP_RATIO = 0,01`: unter einem Prozent der Forderung ist ein „Schritt" kein
 *   Entgegenkommen, sondern Theater — und würde die Erwiderung in Fünf-Cent-Häppchen auslösen.
 */
export const DEFIANCE_INSULT_RATIO = 0.9;
export const DEFIANCE_FACTOR = 1.5;
export const DEFIANCE_MAX_SURCHARGE = 0.06;
export const DEFIANCE_MIN_STEP_RATIO = 0.01;

/**
 * Ab diesem Wechselwillen gilt jemand als „willig" und erwidert großzügiger (Abschnitt 9.3).
 * 60 ist knapp über dem gemessenen P90 (59) — der obere Rand, nicht die obere Hälfte.
 */
export const WILLING_WILLINGNESS = 60;

/**
 * Mittelwert des Grundinteresses. 44 statt der frueheren festen 45, weil die beiden neuen
 * Zuschlaege (Stammplatz-Aussicht, Kaderplatz) im Ligaschnitt leicht positiv ausfallen — der
 * Marktpool ist im Mittel staerker als die Kader. Der Anker haelt den Median dort, wo er vorher
 * lag; die Zuschlaege spreizen nur um ihn herum.
 */
export const BASE_INTEREST_ANCHOR = 44;

/** Auf ganze Schritte runden — hält den Aufschlag in halben Prozentpunkten statt krummen Zahlen. */
function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Fit → Wechselwille (verhandlung-rework.md Abschnitt 10.2).
 *
 * STETIG, und das ist der ganze Punkt. Vorher gab es drei Zweige mit einer Klippe bei Fit 25:
 * darunter `teamFit / 5` (bei Fit 25 also +5), darüber `max(fit25Bonus, clamp(fit·0,65, 8, 28))`
 * — ein Sprung von +5 auf +16 innerhalb eines Zehntels Fit.
 *
 * Gemessen an einem echten Spielstand (drei Teams × 500 Marktspieler) liegt der Teamfit
 * zwischen −49 und +28; der obere Zweig feuerte bei **4 von 1500**. Der gesamte Ast, der bis zu
 * +28 Willenspunkte vergeben konnte, war praktisch tot — während der mittlere bei +5 deckelte.
 * Deshalb war der Wechselwille auf ein Band von ~20 Punkten gestaucht, und deshalb gab es
 * keinen willigen Pol: nicht weil ein Boden ihn abschnitt, sondern weil die Achse nie dorthin
 * kam.
 *
 * Jetzt gilt derselbe Anstieg 0,65 durchgehend ab 0 — die Steigung des alten oberen Zweigs,
 * nur ohne Sprungstelle. `fit25Bonus` (die Fit-Politik der Teamidentität) bleibt ab Fit 25 ein
 * BODEN: dort war er schon vorher ein Mindestwert und ist eine bewusste Team-Entscheidung,
 * keine Kennlinie.
 */
export function deriveTeamFitWillingnessPoints(teamFit: number, fit25Bonus: number): number {
  if (teamFit < 0) {
    return Math.max(-10, teamFit / 2.5);
  }
  const curve = clamp(teamFit * 0.65, 0, 28);
  return teamFit >= 25 ? Math.max(fit25Bonus, curve) : curve;
}

/**
 * Wechselwille → Geld-Schwelle `R_money` (verhandlung-rework.md Abschnitt 10.3).
 *
 * Vorher `clamp(1,14 − 0,003·W, 0,92, 1,14)`. Der Entwurf hatte den Boden 0,92 als Ursache
 * dafür benannt, dass niemand unter Forderung unterschreibt. Die Messung sagt etwas anderes:
 * der Boden greift erst ab W = 73 und hat an einem echten Spielstand **0 von 1500** Spielern
 * gekappt (Median-W = 46). Ursache war die flache Steigung — 0,003 pro Willenspunkt macht aus
 * der realistischen W-Spanne nur wenige Prozentpunkte Schwellenunterschied, und der größte
 * Teil davon liegt oberhalb der Forderung.
 *
 * `1,20 − 0,0045·W` dreht dieselbe Gerade um ihren Angelpunkt bei W = 42, knapp unter dem
 * gemessenen Median: die MITTLERE Schwelle bleibt praktisch stehen (1,004 → 0,990), die ENDEN
 * spreizen sich. Genau die waren die Beschwerde — Unwillige werden teurer, Willige wirklich
 * billig. Der Boden fällt auf 0,88, damit die neue Steigung oben nicht sofort wieder
 * abgeschnitten wird.
 *
 * Gemessen, Anteil mit Zusage unter 0,95× Forderung, drei Teams:
 * vorher 0,6 % / 0,0 % / 3,2 %  →  danach 16,2 % / 7,4 % / 17,2 % (Zielband des Entwurfs 10–20 %).
 */
export function deriveMoneyThresholdRatio(willingness: number): number {
  return clamp(1.2 - 0.0045 * willingness, 0.88, 1.2);
}

export type NegotiationVerdict =
  | "accept"
  | "counter_conditions"
  | "counter_money"
  | "reject_not_about_money"
  | "reject_lowball"
  | "reject_affront";

export type ContractSchedulePreview = {
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
  roundingAdjustment: number | null;
};

export type NegotiationScoreBreakdownEntry = {
  key: string;
  label: string;
  category: "base" | "offer" | "fit" | "culture" | "contract" | "history" | "personality" | "mood";
  points: number;
  tone: "positive" | "negative" | "neutral";
  reason: string;
};

export type NegotiationDemandBreakdownEntry = {
  key: string;
  label: string;
  category: "base" | "fit" | "culture" | "contract" | "history" | "personality" | "mood" | "team";
  percent: number;
  multiplier: number;
  tone: "positive" | "negative" | "neutral";
  reason: string;
};

export type PlayerContractLengthPreference = "short" | "medium" | "long";

export type PlayerContractPreference = {
  lengthPreference: PlayerContractLengthPreference;
  shapePreference: ContractShape;
  preferredMinLength: number;
  preferredMaxLength: number;
  idealLength: number;
  salaryAdjustmentPct: number;
  scoreAdjustment: number;
  matchQuality: "preferred" | "acceptable" | "mismatch";
  reasons: string[];
  warnings: string[];
};

export type ContractNegotiationPreview = {
  expectedSalary: number | null;
  baseExpectedSalary: number | null;
  demandMultiplier: number | null;
  offeredSalary: number | null;
  offerRatio: number | null;
  contractLength: number;
  contractShape: ContractShape;
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
  roundingAdjustment: number | null;
  buyoutCost: number | null;
  bracket: number | null;
  teamFit: number | null;
  /**
   * Wechselwille W (verhandlung-rework.md Abschnitt 1, Achse A): Summe der acht angebots-
   * UNABHAENGIGEN scoreBreakdown-Eintraege (base_interest, team_fit, scouting_network,
   * trait_culture, loyal_fit, ambition_match/mismatch, bad_experience, negotiation_mood),
   * geklemmt auf 0..99. Der Feldname blieb aus Kompat-Gruenden "acceptanceScore" (viele
   * Aufrufer lesen ihn schon), die BEDEUTUNG ist neu: er haengt nicht mehr am Angebot, darum
   * kann der Tooltip jetzt einen festen Satz sagen ("Zusage ab X") statt eines Werts, der sich
   * beim Tippen mitbewegt.
   */
  acceptanceScore: number | null;
  acceptChance: number | null;
  counterChance: number | null;
  rejectChance: number | null;
  /**
   * Konditionen-Aufschlag K in Gehaltsprozent (Achse C, Abschnitt 1): negativ = Wunschvertrag
   * senkt die noetige Summe (bis -4%), positiv = Laufzeit/Form verlangen Aufschlag (bis +8%).
   * Fliesst in acceptThresholdSalary ein (R_full = R_money + K).
   */
  // Ab hier optional: gebraucht nur, wenn die Preview live durch buildContractNegotiationPreview
  // lief. Stellen, die einen ContractNegotiationPreview-Rumpf synthetisch fuer
  // buildContractNegotiationDraft zusammenbauen (der persistierte Draft kennt diese Felder
  // ohnehin nicht, siehe verhandlung-rework.md Abschnitt 7 — "counterSalary im Draft nicht
  // noetig"), muessen sie nicht mit angeben.
  conditionsAdjustmentPct?: number | null;
  /** D * R_rej — darunter bricht die Verhandlung ohne Gegenangebot ab. */
  rejectThresholdSalary?: number | null;
  /** D * R_money — reine Geld-Schwelle; ab hier reicht das Gehalt, auch wenn K > 0 offen bleibt. */
  moneyThresholdSalary?: number | null;
  /** D * R_full — "Zusage ab X". Die eine Zahl, die der Tooltip fest nennen kann. */
  acceptThresholdSalary?: number | null;
  /** D * P (Stolz-Kappe) — mehr fordert der Spieler nie selbst als Gegenangebot. */
  prideCapSalary?: number | null;
  /** Deterministisches Verdikt aus den Baendern in Abschnitt 2.2 — Anzeige-Prozente sind
   *  daraus ABGELEITET, nicht die Entscheidung selbst. */
  verdict?: NegotiationVerdict | null;
  /** Geld-Gegenangebot (Regel 6, Abschnitt 3.1). Nur gesetzt bei verdict === "counter_money". */
  counterSalary?: number | null;
  /** Konditionen-Gegenangebot (Regel 3, Abschnitt 3.2). Nur gesetzt bei verdict === "counter_conditions". */
  counterConditions?: { contractLength: number; contractShape: ContractShape } | null;
  /**
   * Trotz (Abschnitt 9.1), drei Zahlen, damit der Dialog Ursache, Wirkung und Folge trennen kann:
   * - `baseDemandSalary` = D0, die Forderung OHNE jeden Aufschlag — Bezugspunkt der Anzeige
   *   „Forderung: 10,00 → 10,30" und Messlatte des Trotz-Auslösers (misst er gegen die bereits
   *   erhöhte Forderung, verschiebt der Aufschlag seinen eigenen Auslöser).
   * - `defianceSurchargePct` = der Aufschlag, der JETZT SCHON gilt (aus dem Draft).
   * - `pendingDefianceSurchargePct` = was nach einem Klick auf „Verhandeln" gälte. Beim Tippen
   *   ist das die Warnung; sie ist exakt das Klick-Ergebnis, kein Ungefähr.
   */
  baseDemandSalary?: number | null;
  defianceSurchargePct?: number;
  pendingDefianceSurchargePct?: number;
  /** Erwiderung (Abschnitt 9.3): hat sein Gegenangebot diese Runde nachgegeben, weil ihr erhöht habt? */
  concededFromLastCounter?: boolean;
  contractPreference?: PlayerContractPreference | null;
  demandBreakdown: NegotiationDemandBreakdownEntry[];
  scoreBreakdown: NegotiationScoreBreakdownEntry[];
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
  status: ContractNegotiationDraft["status"];
};

export type TeamContractSeasonRow = {
  rowId: string;
  playerId: string;
  playerName: string;
  status: "active" | "preview";
  roleTag: string | null;
  contractShape: ContractShape;
  contractLength: number;
  totalSalary: number | null;
  buyoutCost: number | null;
  exitValue: number | null;
  saleFactor: number | null;
  marketValueAtExit: number | null;
  purchasePrice: number | null;
  profitLoss: number | null;
  morale: number | null;
  moraleMood: string | null;
  moraleSmiley: string | null;
  moraleContractIntent: string | null;
  moraleSalaryModifier: number | null;
  moraleRenewalRisk: number | null;
  yearlySalarySchedule: ContractYearSalary[];
};

export type TeamContractSeasonTable = {
  seasonLabels: string[];
  rows: TeamContractSeasonRow[];
  totalsCommitted: Array<{ label: string; salary: number }>;
  totalsWithPreview: Array<{ label: string; salary: number }>;
};

function roundMoney(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeContractLength(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function buildSeasonLabel(base: string, offset: number, seasonIdBase?: string | null) {
  return getCanonicalSeasonLabelAtOffset(
    {
      seasonId: seasonIdBase,
      seasonName: base,
    },
    offset,
  );
}

function buildShapeWeights(contractLength: number, shape: ContractShape) {
  if (contractLength <= 1) {
    return [1];
  }

  if (shape === "balanced") {
    return Array.from({ length: contractLength }, () => 1);
  }

  const step = Math.min(0.2, 0.8 / Math.max(1, contractLength - 1));
  const midpoint = (contractLength - 1) / 2;

  return Array.from({ length: contractLength }, (_, index) => {
    const signedDistance = midpoint - index;
    const delta = signedDistance * step;
    const weight = shape === "front_loaded" ? 1 + delta : 1 - delta;
    return Math.max(0.2, Number(weight.toFixed(4)));
  });
}

export function buildContractSalarySchedule(input: ContractPreviewInput): ContractSchedulePreview {
  const contractLength = normalizeContractLength(input.contractLength);
  const annualSalary =
    typeof input.annualSalary === "number" && Number.isFinite(input.annualSalary) && input.annualSalary > 0
      ? input.annualSalary
      : null;

  if (annualSalary == null) {
    return {
      yearlySalarySchedule: [],
      totalSalary: null,
      roundingAdjustment: null,
    };
  }

  const totalSalary = roundMoney(annualSalary * contractLength, 2);
  const weights = buildShapeWeights(contractLength, input.shape);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);

  const rawSchedule = weights.map((weight) => totalSalary * (weight / weightSum));
  const roundedSchedule: ContractYearSalary[] = [];
  let roundedSpent = 0;

  rawSchedule.forEach((value, index) => {
    const isLast = index === rawSchedule.length - 1;
    const roundedValue = isLast ? roundMoney(totalSalary - roundedSpent, 2) : roundMoney(value, 2);
    roundedSpent = roundMoney(roundedSpent + roundedValue, 2);
    roundedSchedule.push({
      yearIndex: index + 1,
      seasonOffset: index,
      label: buildSeasonLabel(input.seasonLabelBase, index, input.seasonIdBase),
      salary: roundedValue,
    });
  });

  const roundingAdjustment = roundMoney(totalSalary - roundedSchedule.reduce((sum, row) => sum + row.salary, 0), 2);

  if (roundingAdjustment !== 0 && roundedSchedule.length > 0) {
    const lastRow = roundedSchedule[roundedSchedule.length - 1];
    lastRow.salary = roundMoney(lastRow.salary + roundingAdjustment, 2);
  }

  return {
    yearlySalarySchedule: roundedSchedule,
    totalSalary,
    roundingAdjustment,
  };
}

export type WishlistSalaryProjection = {
  playerId: string;
  contractLength: number;
  contractShape: ContractShape;
  annualSalary: number | null;
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
};

/**
 * Projects the yearly salary schedule a scouted-but-unsigned wishlist target
 * would command if signed today. `TransferWishlistEntry` only carries a flat
 * `salary` snapshot — there is no real contract for a not-yet-signed player —
 * so this composes the SAME machinery a live negotiation draft uses instead
 * of inventing new economy math: `buildPlayerContractPreference` supplies the
 * player's own `shapePreference` and ideal contract length (the same default
 * term `recommendContractOfferForPlayer` starts from before team-specific
 * nudges), `resolvePlayerEconomyContract` supplies the salary demand, and
 * `buildContractSalarySchedule` splits it into the per-season schedule. Pure
 * and deterministic: same player + season in, same schedule out.
 */
export function projectWishlistSalarySchedule(
  gameState: GameState,
  playerId: string,
  options?: { contractLength?: number | null; shape?: ContractShape | null },
): WishlistSalaryProjection | null {
  const player = gameState.players.find((candidate) => candidate.id === playerId) ?? null;
  if (!player) {
    return null;
  }

  const preference = buildPlayerContractPreference(player);
  const contractLength = normalizeContractLength(options?.contractLength ?? preference?.idealLength ?? 1);
  const contractShape = options?.shape ?? preference?.shapePreference ?? "balanced";
  const economy = resolvePlayerEconomyContract({ playerId, player });
  const schedule = buildContractSalarySchedule({
    annualSalary: economy.salary,
    contractLength,
    shape: contractShape,
    seasonIdBase: gameState.season.id,
    seasonLabelBase: gameState.season.name,
  });

  return {
    playerId,
    contractLength,
    contractShape,
    annualSalary: economy.salary,
    yearlySalarySchedule: schedule.yearlySalarySchedule,
    totalSalary: schedule.totalSalary,
  };
}

export function calculateOpenBuyoutCost(yearlySalarySchedule: ContractYearSalary[], seasonsElapsed = 0) {
  if (!yearlySalarySchedule.length) {
    return null;
  }

  return roundMoney(
    yearlySalarySchedule
      .slice(Math.max(0, seasonsElapsed))
      .reduce((sum, row) => sum + row.salary, 0),
    2,
  );
}

function hasTrait(player: Player, traitName: string) {
  const normalizedNeedle = normalizeTransfermarktToken(traitName);
  return [...player.traitsPositive, ...player.traitsNegative].some(
    (trait) => normalizeTransfermarktToken(trait) === normalizedNeedle,
  );
}

function hasAnyTrait(player: Player, traitNames: string[]) {
  return traitNames.some((traitName) => hasTrait(player, traitName));
}

function deriveFitPolicyBonus(identity: TeamIdentity | null | undefined) {
  const harmony = identity?.harmony ?? 0;
  if (harmony >= 10) return 10;
  if (harmony >= 9) return 8;
  if (harmony >= 8) return 6;
  if (harmony >= 7) return 3;
  return 0;
}

function deriveContractStyleAdjustment(contractLength: number, contractShape: ContractShape, profile: TeamStrategyProfile | null) {
  if (!profile) {
    return 0;
  }

  let score = 0;
  if (profile.bias.shortContractPreference >= 8 && contractLength <= 2) {
    score += 4;
  }
  if (profile.bias.longContractPreference >= 8 && contractLength >= 4) {
    score += 5;
  }
  if (profile.bias.wageSensitivity >= 8 && contractShape === "front_loaded") {
    score -= 3;
  }
  if (profile.bias.cashPriority >= 8 && contractShape === "back_loaded") {
    score += 2;
  }
  if (profile.bias.loyaltyBias >= 8 && contractLength >= 3 && contractShape === "balanced") {
    score += 3;
  }

  return score;
}

function getPlayerTraitTokens(player: Player) {
  return [...player.traitsPositive, ...player.traitsNegative].map((trait) => normalizeTransfermarktToken(trait));
}

function hasToken(tokens: string[], candidates: string[]) {
  return candidates.some((candidate) => tokens.includes(normalizeTransfermarktToken(candidate)));
}

export function buildPlayerContractPreference(
  player: Player | null,
  profile: TeamStrategyProfile | null = null,
  input?: {
    contractLength?: number | null;
    contractShape?: ContractShape | null;
  },
): PlayerContractPreference | null {
  if (!player) {
    return null;
  }

  const tokens = getPlayerTraitTokens(player);
  const seed = hashToUnitInterval(`${player.id}:${player.name}:contract-preference`);
  const shapeSeed = hashToUnitInterval(`${player.id}:${player.name}:contract-shape-preference`);
  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (hasToken(tokens, ["loyal", "disciplined", "diligent", "humble", "teamplayer", "honorable", "stable"])) {
    longScore += 3;
    reasons.push("Traits sprechen fuer Sicherheit und langfristige Bindung.");
  }
  if (hasToken(tokens, ["ambitious", "motivated", "leader", "royalty", "lord"])) {
    longScore += 1;
    reasons.push("Ambition/Status mag ein klares Commitment.");
  }
  if (hasToken(tokens, ["mercenary", "opportunist", "manipulative", "devious", "independent"])) {
    shortScore += 3;
    reasons.push("Flexibilitaets- oder Geldmotiv bevorzugt kuerzere Bindung.");
  }
  if (hasToken(tokens, ["diva", "egomaniac", "scandalous", "relaxed", "coldblooded"])) {
    shortScore += 2;
    warnings.push("Volatile Persoenlichkeit verlangt bei langer Bindung eher Premium.");
  }

  if ((profile?.bias.longContractPreference ?? 0) >= 8) {
    longScore += 1;
  }
  if ((profile?.bias.shortContractPreference ?? 0) >= 8 || (profile?.bias.sellForProfitAggression ?? 0) >= 8) {
    shortScore += 1;
  }

  if (seed > 0.74) {
    longScore += 1;
  } else if (seed < 0.26) {
    shortScore += 1;
  }

  const lengthPreference: PlayerContractLengthPreference =
    longScore - shortScore >= 2 ? "long" : shortScore - longScore >= 2 ? "short" : "medium";
  const idealLength =
    lengthPreference === "long"
      ? seed > 0.58 ? 5 : 4
      : lengthPreference === "short"
        ? seed > 0.5 ? 2 : 1
        : seed > 0.66
          ? 3
          : 2;
  const preferredMinLength = lengthPreference === "long" ? 3 : lengthPreference === "short" ? 1 : 2;
  const preferredMaxLength = lengthPreference === "long" ? 5 : lengthPreference === "short" ? 2 : 4;

  let shapePreference: ContractShape = "balanced";
  const likesEarlyMoney = hasToken(tokens, ["mercenary", "opportunist", "manipulative", "devious", "egomaniac"]);
  const likesStability = hasToken(tokens, ["loyal", "disciplined", "diligent", "humble", "teamplayer", "stable"]);
  const likesDelayedUpside = hasToken(tokens, ["ambitious", "motivated", "leader", "royalty", "lord"]);
  if (likesEarlyMoney) {
    shapePreference = shapeSeed < 0.72 ? "front_loaded" : "balanced";
    reasons.push("Spielertyp nimmt lieber frueh Geld mit als spaeter auf bessere Struktur zu warten.");
  } else if (likesStability) {
    shapePreference = shapeSeed < 0.84 ? "balanced" : "back_loaded";
    reasons.push("Spielertyp mag stabile Verteilung und nicht jede Form von Cash-Spielchen.");
  } else if (likesDelayedUpside) {
    shapePreference = shapeSeed < 0.25 ? "front_loaded" : shapeSeed > 0.7 ? "back_loaded" : "balanced";
    reasons.push("Spielertyp ist offen fuer unterschiedliche Vertragsformen, solange die Rolle stimmt.");
  } else if (shapeSeed < 0.22) {
    shapePreference = "front_loaded";
    reasons.push("Persoenliche Vertragsform tendiert eher zu fruehem Geld.");
  } else if (shapeSeed > 0.78) {
    shapePreference = "back_loaded";
    reasons.push("Persoenliche Vertragsform tendiert eher zu spaeterem Geld.");
  } else {
    shapePreference = "balanced";
    reasons.push("Persoenliche Vertragsform bleibt eher ausgeglichen.");
  }

  const contractLength = normalizeContractLength(input?.contractLength ?? idealLength);
  const contractShape = input?.contractShape ?? shapePreference;
  const lengthMismatch =
    contractLength < preferredMinLength ? preferredMinLength - contractLength : contractLength > preferredMaxLength ? contractLength - preferredMaxLength : 0;
  const shapeMatches = contractShape === shapePreference;
  const matchQuality: PlayerContractPreference["matchQuality"] =
    lengthMismatch === 0 && shapeMatches ? "preferred" : lengthMismatch <= 1 ? "acceptable" : "mismatch";

  let salaryAdjustmentPct = 0;
  let scoreAdjustment = 0;
  if (matchQuality === "preferred") {
    salaryAdjustmentPct -= lengthPreference === "long" ? 0.04 : 0.025;
    scoreAdjustment += lengthPreference === "long" ? 5 : 3;
  } else if (matchQuality === "acceptable") {
    salaryAdjustmentPct += shapeMatches ? 0 : 0.015;
    scoreAdjustment += shapeMatches ? 1 : -1;
  } else {
    salaryAdjustmentPct += lengthPreference === "long" ? 0.075 : 0.06;
    scoreAdjustment -= lengthPreference === "long" ? 8 : 6;
    warnings.push(
      lengthPreference === "long"
        ? "Spieler bevorzugt lange Sicherheit; kurzer Deal kostet Vertrauen und Gehalt."
        : "Spieler bevorzugt Flexibilitaet; langer Deal braucht Premium.",
    );
  }
  if (!shapeMatches) {
    salaryAdjustmentPct += 0.02;
    scoreAdjustment -= 2;
  }

  const label = lengthPreference === "long" ? "lange Verträge" : lengthPreference === "short" ? "kurze Verträge" : "mittlere Verträge";
  // Bug gefunden bei der Vertragsform-Vereinheitlichung: hier stand `Form ${shapePreference}`,
  // also der rohe Enum-Wert ("front_loaded") direkt im angezeigten Satz statt des Labels.
  reasons.unshift(`Wunschprofil: ${label}, am liebsten ${idealLength} Saisons, Form ${CONTRACT_SHAPE_LABELS[shapePreference]}.`);

  return {
    lengthPreference,
    shapePreference,
    preferredMinLength,
    preferredMaxLength,
    idealLength,
    salaryAdjustmentPct: roundMoney(clamp(salaryAdjustmentPct, -0.08, 0.12), 4),
    scoreAdjustment: Math.round(clamp(scoreAdjustment, -12, 8)),
    matchQuality,
    reasons: Array.from(new Set(reasons)),
    warnings: Array.from(new Set(warnings)),
  };
}

export function recommendContractOfferForPlayer(input: {
  player: Player | null;
  teamStrategyProfile?: TeamStrategyProfile | null;
  teamIdentity?: TeamIdentity | null;
  teamCash?: number | null;
  marketValue?: number | null;
  teamFit?: number | null;
  currentTeamSalary?: number | null;
  dealRole?: string | null;
  rosterCountBefore?: number | null;
  teamRosterMin?: number | null;
  teamRosterOpt?: number | null;
  isFirstSeason?: boolean | null;
  boardPressure?: number | null;
  /** GM archetype for direct identity hooks (culture_keeper binds good players longer). */
  gmArchetype?: string | null;
  /** Good/core player signal (e.g. rank <= 40 or high market value) — drives the culture_keeper floor. */
  highValue?: boolean | null;
}): { contractLength: number; contractShape: ContractShape; preference: PlayerContractPreference | null; reasons: string[] } {
  const basePreference = buildPlayerContractPreference(input.player, input.teamStrategyProfile);
  const reasons = [...(basePreference?.reasons ?? [])];
  if (!basePreference) {
    return { contractLength: 1, contractShape: "balanced", preference: null, reasons: ["fallback_no_player_preference"] };
  }

  let contractLength = basePreference.idealLength;
  let contractShape = basePreference.shapePreference;
  const cash = input.teamCash ?? null;
  const marketValue = input.marketValue ?? null;
  const teamFit = input.teamFit ?? null;
  const currentTeamSalary = input.currentTeamSalary ?? null;
  const cashTight = cash != null && marketValue != null && cash < marketValue * 1.35;
  const cashComfortable =
    cash != null &&
    marketValue != null &&
    cash >= Math.max(marketValue * 2.4, (currentTeamSalary ?? 0) * 1.8, 80);
  const longOrCoreDeal = contractLength >= 3 || (marketValue ?? 0) >= 30;
  const aggressiveProfile =
    (input.teamStrategyProfile?.bias.starPriority ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.riskTolerance ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 7;
  const valueExitProfile =
    (input.teamStrategyProfile?.bias.valuePriority ?? 0) >= 7 ||
    (input.teamStrategyProfile?.bias.sellForProfitAggression ?? 0) >= 7;
  const roleSignal = (input.dealRole ?? "").toLowerCase();
  const isPremiumRole = /\b(superstar|star|impact|leader|premium)\b/.test(roleSignal);
  const isCoreRole = /\b(core|starter|specialist|theme|value|axis|need|minimum|skeleton)\b/.test(roleSignal);
  const isReserveRole = /\b(cheap|fill|backup|reserve|depth|bench)\b/.test(roleSignal);
  const salaryReference = input.player
    ? resolvePlayerEconomyContract({ player: input.player }).expectedSalary
    : null;
  const firstSeason = input.isFirstSeason === true;
  const identity = input.teamIdentity ?? null;
  const boardConfidence = identity?.boardConfidence ?? 5;
  const harmony = identity?.harmony ?? 5;
  const cooperation = identity?.cooperation ?? 5;
  const ambition = identity?.ambition ?? 5;
  const finances = identity?.finances ?? 5;
  const boardPressure = input.boardPressure ?? Math.max(1, Math.min(10, 11 - boardConfidence));
  const commitmentScore =
    boardConfidence * 0.2 +
    harmony * 0.16 +
    cooperation * 0.12 +
    (input.teamStrategyProfile?.bias.loyaltyBias ?? 5) * 0.14 +
    (input.teamStrategyProfile?.bias.longContractPreference ?? 5) * 0.14 +
    (input.teamStrategyProfile?.bias.riskTolerance ?? 5) * 0.1 +
    ambition * 0.08 +
    finances * 0.06 -
    Math.max(0, boardPressure - 6) * 0.22;
  const longContractPreference = input.teamStrategyProfile?.bias.longContractPreference ?? 5;
  const valuePriority = input.teamStrategyProfile?.bias.valuePriority ?? 5;
  const cashPriority = input.teamStrategyProfile?.bias.cashPriority ?? 5;
  const wageSensitivity = input.teamStrategyProfile?.bias.wageSensitivity ?? 5;
  const stableValueContract =
    !isReserveRole &&
    !cashTight &&
    (marketValue ?? 0) >= 12 &&
    (marketValue ?? 0) <= 38 &&
    (salaryReference == null || (salaryReference >= 3 && salaryReference <= 9)) &&
    (longContractPreference >= 7 || valuePriority >= 7 || commitmentScore >= 7);
  const highCostRisk =
    (marketValue ?? 0) >= 55 &&
    (cashTight || cashPriority >= 8 || wageSensitivity >= 8 || commitmentScore < 5.6 || (input.teamStrategyProfile?.bias.riskTolerance ?? 5) <= 4);

  if (cashTight && contractLength >= 4) {
    contractShape = "back_loaded";
    reasons.push("Cash ist eng: back-loaded Empfehlung schont diese Season.");
  }
  if ((input.teamStrategyProfile?.bias.shortContractPreference ?? 0) >= 8 && basePreference.lengthPreference !== "long") {
    contractLength = Math.min(contractLength, 2);
    reasons.push("Teamstrategie bevorzugt kurze Verträge.");
  }
  if ((input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 8 && basePreference.lengthPreference !== "short") {
    contractLength = Math.max(contractLength, 3);
    reasons.push("Teamstrategie bevorzugt Bindung und Gehaltsstabilitaet.");
  }
  if (!cashTight && cashComfortable && longOrCoreDeal && (aggressiveProfile || valueExitProfile)) {
    contractShape = "front_loaded";
    reasons.push("Cashpuffer ist stark: front-loaded Empfehlung zahlt frueh mehr und senkt spaetere Last/Buyout.");
  } else if (!cashTight && cashComfortable && contractLength >= 4 && basePreference.lengthPreference !== "short") {
    contractShape = "front_loaded";
    reasons.push("Langer Vertrag mit Cashpuffer: front-loaded entlastet kommende Seasons.");
  }
  if (roleSignal) {
    const rosterBefore = input.rosterCountBefore ?? null;
    const rosterMin = input.teamRosterMin ?? null;
    const market = marketValue ?? 0;
    if (isPremiumRole) {
      contractLength = Math.max(contractLength, market >= 60 ? 4 : 3);
      if (!cashTight && aggressiveProfile && market >= 45) {
        contractLength = Math.max(contractLength, 4);
      }
      reasons.push("AI-Rolle Premium/Core: echter Impact-Pick wird nicht nur fuer eine Season gebunden.");
    } else if (isCoreRole) {
      contractLength = Math.max(contractLength, market >= 35 ? 3 : 2);
      if (!cashTight && (input.teamStrategyProfile?.bias.longContractPreference ?? 0) >= 7) {
        contractLength = Math.max(contractLength, 3);
      }
      reasons.push("AI-Rolle Core/Starter: mittlere Bindung schuetzt den Kaderkern.");
    } else if (isReserveRole) {
      contractLength = market <= 15 ? Math.min(contractLength, 1) : Math.min(Math.max(contractLength, 2), 2);
      reasons.push("AI-Rolle Depth/Fill: kurze Laufzeit haelt Reserve-Picks flexibel.");
    }
    if (!isReserveRole && rosterBefore != null && rosterMin != null && rosterBefore < rosterMin) {
      contractLength = Math.max(contractLength, 2);
      reasons.push("Roster-Aufbau vor Minimum: Basis-Picks bekommen mindestens mittlere Sicherheit.");
    }
    if (cashTight && !isPremiumRole) {
      contractLength = Math.min(contractLength, 2);
      contractShape = "back_loaded";
      reasons.push("Cash eng: kein langer Nicht-Star-Vertrag.");
    } else if (cashTight && isPremiumRole) {
      contractLength = Math.min(contractLength, 3);
      contractShape = "back_loaded";
      reasons.push("Cash eng: Premium-Pick bleibt gebunden, aber nicht maximal lang.");
    }
    if ((input.teamStrategyProfile?.bias.shortContractPreference ?? 0) >= 8 && !isPremiumRole) {
      contractLength = Math.min(contractLength, 2);
      reasons.push("Vorsichtiger GM kappt Nicht-Star-Deals auf maximal zwei Seasons.");
    }
  }
  if (marketValue != null && marketValue >= 25 && !isReserveRole) {
    contractLength = Math.max(contractLength, marketValue >= 55 ? 3 : 2);
    reasons.push("Teurerer AI-Pick bekommt Mindestbindung statt Einjahres-Default.");
  }
  if (stableValueContract) {
    contractLength = Math.max(contractLength, commitmentScore >= 7.8 || longContractPreference >= 8 ? 4 : 3);
    reasons.push("Value-Vertrag: mittleres Gehalt kann ueber mehrere Spieler echte Savings bringen.");
  }
  if (commitmentScore >= 7.2 && !cashTight && !isReserveRole) {
    contractLength = Math.max(contractLength, marketValue != null && marketValue >= 55 ? 4 : 3);
    reasons.push("Board/Harmony/GM-Vertrauen erlauben laengere Bindung.");
  } else if (commitmentScore <= 4.2 && !isPremiumRole) {
    contractLength = Math.min(contractLength, 2);
    reasons.push("Niedriges Board-/Teamvertrauen begrenzt Laufzeit.");
  }
  if (highCostRisk) {
    contractLength = Math.min(contractLength, firstSeason ? 3 : 4);
    if (cashTight) {
      contractShape = "back_loaded";
    }
    reasons.push("Hoher Kostenblock mit Risiko: Star-Vertrag wird nicht automatisch maximal lang.");
  }
  if (firstSeason) {
    const rosterBefore = input.rosterCountBefore ?? null;
    const rosterMin = input.teamRosterMin ?? null;
    const rosterOpt = input.teamRosterOpt ?? rosterMin;
    const market = marketValue ?? 0;
    const fit = teamFit ?? 0;
    const salary = salaryReference ?? 0;
    const valueRatio = salary > 0 ? market / salary : 0;
    const rosterStillBuilding = rosterBefore == null || rosterMin == null || rosterBefore < rosterMin;
    const rosterNotSettled = rosterBefore == null || rosterOpt == null || rosterBefore < rosterOpt;
    const roleFlexPenalty = isReserveRole ? 0.65 : isCoreRole ? 0.15 : isPremiumRole ? 0.25 : 0.3;
    const capitalLockRisk =
      market >= 85
        ? 2.4
        : market >= 70
          ? 1.75
          : market >= 55
            ? 1.05
            : market >= 38
              ? 0.55
              : market >= 22
                ? 0.25
                : 0;
    const resaleOpportunityRisk =
      market >= 55
        ? 0.45 + Math.max(0, (input.teamStrategyProfile?.bias.sellForProfitAggression ?? 5) - 5) * 0.12
        : market >= 28
          ? 0.2
          : 0;
    const rosterFlexRisk =
      rosterStillBuilding
        ? 0.95
        : rosterNotSettled
          ? 0.45
          : 0;
    const flexibilityNeed =
      capitalLockRisk +
      resaleOpportunityRisk +
      rosterFlexRisk +
      roleFlexPenalty +
      (cashTight ? 1.05 : 0) +
      Math.max(0, 5.8 - commitmentScore) * 0.28 +
      Math.max(0, (wageSensitivity - 6) * 0.18) +
      Math.max(0, (cashPriority - 6) * 0.12);
    const fitCommitment =
      fit >= 28
        ? 1.35
        : fit >= 20
          ? 1.0
          : fit >= 12
            ? 0.62
            : fit >= 4
              ? 0.28
              : fit < 0
                ? -1.1
                : 0;
    const valueCommitment =
      valueRatio >= 4.2
        ? 1.05
        : valueRatio >= 3.2
          ? 0.74
          : valueRatio >= 2.4
            ? 0.38
            : valueRatio > 0 && valueRatio < 1.8
              ? -0.35
              : 0;
    const lowCapitalUpside =
      market > 0 && market <= 22 && fit >= 10
        ? 0.48
        : market <= 38 && fit >= 18
          ? 0.34
          : 0;
    const identityCommitment =
      Math.max(0, commitmentScore - 5.5) * 0.42 +
      Math.max(0, longContractPreference - 5) * 0.18 +
      Math.max(0, valuePriority - 5) * 0.1 +
      Math.max(0, (input.teamStrategyProfile?.bias.loyaltyBias ?? 5) - 5) * 0.13;
    const contractMixRoll = input.player
      ? hashToUnitInterval(
          `${input.player.id}:${identity?.teamId ?? "team"}:${market}:${fit}:season-one-contract-mix:${rosterBefore ?? "na"}`,
        )
      : 0.5;
    const mixCommitment = (contractMixRoll - 0.5) * 0.9;
    const commitmentAppeal = fitCommitment + valueCommitment + lowCapitalUpside + identityCommitment + mixCommitment;
    const netCommitment = commitmentAppeal - flexibilityNeed;

    let seasonOneCap = 1;
    if (fit < 0 && netCommitment < 1.4) {
      seasonOneCap = 1;
      reasons.push("Season 1: negativer Fit braucht fast immer Exit-Flexibilitaet.");
    } else if (market >= 70) {
      seasonOneCap = netCommitment >= 1.1 && !rosterStillBuilding ? 3 : netCommitment >= -0.2 ? 2 : 1;
      reasons.push("Season 1 Kapitalbindung: teure Spieler bekommen nur bei starkem Gesamtpaket lange Bindung.");
    } else if (netCommitment >= 1.45 && !cashTight && !rosterStillBuilding) {
      seasonOneCap = 3;
      reasons.push("Season 1 Value-Bindung: Fit, Preis/Gehalt und Team-Identity rechtfertigen laengeren Deal.");
    } else if (netCommitment >= 0.05 || (valueRatio >= 3.4 && fit >= 14 && !cashTight)) {
      seasonOneCap = 2;
      reasons.push("Season 1 Mix-Deal: gutes Value/Fit-Paket bekommt zwei Seasons, aber keinen langen Lock.");
    } else {
      seasonOneCap = 1;
      reasons.push("Season 1 Flex-Deal: Team haelt Exit und Verkaufsoption offen.");
    }

    if (rosterStillBuilding && market < 55 && netCommitment < 1.2) {
      seasonOneCap = Math.min(seasonOneCap, 1);
      reasons.push("Season 1 Kaderaufbau: vor stabilem Kern keine breite Mehrjahresbindung.");
    }
    if ((input.teamStrategyProfile?.bias.shortContractPreference ?? 0) >= 8 && netCommitment < 1.5) {
      seasonOneCap = Math.min(seasonOneCap, 1);
      reasons.push("Vorsichtiger GM: Einjahresvertrag bleibt Default, ausser das Gesamtpaket ist klar stark.");
    }

    contractLength = Math.min(contractLength, seasonOneCap);
  }

  // Culture keeper binds good players longer: direct archetype floor of 3 seasons (4 when cash is
  // comfortable) for high-value players, independent of the diluted blended long/loyalty bias.
  if (input.gmArchetype === "culture_keeper" && input.highValue) {
    contractLength = Math.max(contractLength, cashComfortable ? 4 : 3);
    reasons.push("Culture Keeper: guter Spieler wird langfristig gebunden.");
  }

  return {
    contractLength: clamp(Math.round(contractLength), 1, 5),
    contractShape,
    preference: buildPlayerContractPreference(input.player, input.teamStrategyProfile, {
      contractLength,
      contractShape,
    }),
    reasons: Array.from(new Set(reasons)),
  };
}

function hashToUnitInterval(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function deriveNegotiationMood(input: NegotiationPreviewInput) {
  const seed = `${input.saveId}:${input.seasonId}:${input.team?.teamId ?? input.teamId ?? "team"}:${input.player?.id ?? "player"}`;
  return roundMoney((hashToUnitInterval(seed) - 0.5) * 8, 1);
}

function buildDemandEntry(input: Omit<NegotiationDemandBreakdownEntry, "percent" | "tone">): NegotiationDemandBreakdownEntry {
  const percent = Math.round((input.multiplier - 1) * 100);
  return {
    ...input,
    percent,
    tone: percent < 0 ? "positive" : percent > 0 ? "negative" : "neutral",
  };
}

function pushDemandBreakdown(
  entries: NegotiationDemandBreakdownEntry[],
  entry: Omit<NegotiationDemandBreakdownEntry, "percent" | "tone">,
) {
  if (!Number.isFinite(entry.multiplier) || Math.abs(entry.multiplier - 1) < 0.005) {
    return;
  }
  entries.push(buildDemandEntry(entry));
}

function deriveTraitCultureSignals(player: Player, identity: TeamIdentity | null) {
  const harmony = identity?.harmony ?? 0;
  const manners = identity?.manners ?? 0;
  const cooperation = identity?.cooperation ?? 0;
  const popularity = identity?.popularity ?? 0;
  const ambition = identity?.ambition ?? 0;
  const finance = identity?.finances ?? 0;
  let salaryMultiplier = 1;
  let score = 0;
  const reasons: string[] = [];
  const demandEntries: NegotiationDemandBreakdownEntry[] = [];

  if (hasAnyTrait(player, ["scandalous", "cruel"]) && (manners >= 8 || harmony >= 8)) {
    const intensity = Math.max(manners, harmony) >= 10 ? 0.18 : 0.12;
    salaryMultiplier += intensity;
    score -= intensity >= 0.18 ? 14 : 9;
    reasons.push("Charakterrisiko kollidiert mit hoher Teamkultur.");
    pushDemandBreakdown(demandEntries, {
      key: "trait_culture_risk",
      label: "Charakter/Kultur",
      category: "culture",
      multiplier: 1 + intensity,
      reason: "Riskante Traits passen schlecht zu Harmony/Manners.",
    });
  }

  if (hasAnyTrait(player, ["teamplayer", "diligent", "honorable", "humble"]) && (harmony >= 7 || cooperation >= 7)) {
    salaryMultiplier -= 0.04;
    score += 6;
    reasons.push("Teamorientierte Traits passen zur Kultur.");
    pushDemandBreakdown(demandEntries, {
      key: "team_trait_culture_fit",
      label: "Kultur-Fit",
      category: "culture",
      multiplier: 0.96,
      reason: "Teamplayer/Diligent/Honorable/Humble passen zur Teamkultur.",
    });
  }

  if (hasAnyTrait(player, ["diva", "egomaniac"]) && (popularity >= 7 || ambition >= 7)) {
    salaryMultiplier += 0.1;
    score -= 5;
    reasons.push("Star-Ego erwartet sichtbare Wertschaetzung.");
    pushDemandBreakdown(demandEntries, {
      key: "ego_status_premium",
      label: "Status-Erwartung",
      category: "personality",
      multiplier: 1.1,
      reason: "Diva/Egomaniac erwartet bei populaerem oder ambitioniertem Umfeld ein Statussignal.",
    });
  }

  if (hasTrait(player, "mercenary")) {
    const mercenaryPremium = finance >= 8 ? 0.08 : 0.05;
    salaryMultiplier += mercenaryPremium;
    score += finance >= 8 ? 2 : -3;
    reasons.push("Mercenary verhandelt stark ueber Geld.");
    pushDemandBreakdown(demandEntries, {
      key: "mercenary_money_premium",
      label: "Mercenary",
      category: "personality",
      multiplier: 1 + mercenaryPremium,
      reason: finance >= 8 ? "Finanzstarkes Team muss Geldmotivation bedienen." : "Geldmotivierter Spieler fordert Premium.",
    });
  }

  if (hasTrait(player, "loyal") && harmony >= 7) {
    salaryMultiplier -= 0.05;
    score += 7;
    reasons.push("Loyalitaet und stabile Kultur senken die Forderung.");
    pushDemandBreakdown(demandEntries, {
      key: "loyal_harmony_discount",
      label: "Loyal + Harmony",
      category: "culture",
      multiplier: 0.95,
      reason: "Loyaler Spieler akzeptiert stabile Teamharmonie guenstiger.",
    });
  }

  return {
    salaryMultiplier,
    score,
    reasons,
    demandEntries,
  };
}

// --- Spieler-Wesen (Charakter/Gesinnung/Subklasse) treibt die Nachverhandlungs-Forderung ---
// Anders als deriveTraitCultureSignals (Trait x Team-Identitaet, nur bei erfuellten Schwellen)
// ist dies der INTRINSISCHE Verhandlungscharakter des Spielers, unabhaengig vom Team:
// gierige/ego-getriebene Naturen fordern beim Nachverhandeln etwas mehr, bescheidene/faire weniger.

// Verhandlungstemperament je Trait (nur echte Traits aus trait-salary-factors.json + Kultur-Kanon).
// Positiv = hartnaeckiger/ego-/geldgetriebener Verhandler, negativ = bescheiden/fair/teamorientiert.
const NATURE_TRAIT_DEMAND: Record<string, number> = {
  egomaniac: 0.03,
  mercenary: 0.028,
  diva: 0.022,
  ambitious: 0.02,
  manipulative: 0.02,
  fan_favorite: 0.018,
  cheater: 0.016,
  cruel: 0.016,
  devious: 0.014,
  fearless: 0.012,
  feisty: 0.012,
  gambler: 0.012,
  vindictive: 0.012,
  cool: 0.01,
  eloquent: 0.01,
  paranoid: 0.01,
  renegade: 0.01,
  scandalous: 0.01,
  fired_up: 0.008,
  sexy: 0.008,
  timid: -0.03,
  faint_hearted: -0.028,
  fair: -0.026,
  loyal: -0.024,
  altruistic: -0.022,
  honorable: -0.02,
  humble: -0.02,
  relaxed: -0.02,
  teamplayer: -0.02,
  flexible: -0.018,
  caring: -0.016,
  disciplined: -0.014,
  diligent: -0.012,
  lazy: -0.012,
  motivated: -0.012,
};

// Prestige-/Status-Archetypen fordern etwas mehr, dienende/unterstuetzende weniger.
const NATURE_SUBCLASS_DEMAND: Record<string, number> = {
  god: 0.024,
  royalty: 0.022,
  prime_evil: 0.022,
  lord: 0.02,
  executioner: 0.018,
  angel: 0.016,
  behemoth: 0.016,
  vampire: 0.014,
  succubus: 0.012,
  warlock: 0.012,
  amazoness: 0.01,
  pirate: 0.01,
  viking: 0.01,
  servant: -0.022,
  monk: -0.02,
  bot: -0.018,
  pet_master: -0.016,
  healer: -0.016,
  engineer: -0.014,
  cleric: -0.014,
  druid: -0.012,
  scout: -0.012,
  shaman: -0.012,
  creature: -0.01,
  undead: -0.008,
};

function deriveAlignmentDemandDelta(alignment: string | null | undefined): number {
  const raw = (alignment ?? "").trim().toUpperCase();
  if (!raw || raw === "NEUTRAL" || raw === "N" || raw === "N-N") {
    return 0;
  }
  const parts = raw.split(/[-_/]/).filter(Boolean);
  const order = parts[0] ?? "";
  const morality = parts[1] ?? "";
  let delta = 0;
  // Ordnungsachse: Rechtschaffen (R) verhandelt fairer, Chaotisch (C) haerter.
  if (order === "R") delta -= 0.02;
  else if (order === "C") delta += 0.02;
  // Moralachse: Gut (G) senkt, Boese (B) erhoeht die Forderung.
  if (morality === "G") delta -= 0.02;
  else if (morality === "B") delta += 0.02;
  return delta;
}

function derivePlayerNatureDemandSignals(player: Player) {
  const demandEntries: NegotiationDemandBreakdownEntry[] = [];
  const reasons: string[] = [];

  // 1) Charakter (Traits)
  const traitTokens = new Set(
    [...player.traitsPositive, ...player.traitsNegative].map((trait) => normalizeTransfermarktToken(trait)),
  );
  let traitDelta = 0;
  for (const [token, weight] of Object.entries(NATURE_TRAIT_DEMAND)) {
    if (traitTokens.has(token)) {
      traitDelta += weight;
    }
  }
  traitDelta = clamp(traitDelta, -0.1, 0.12);

  // 2) Subklasse (Prestige vs. dienend)
  const subclassTokens = new Set((player.subclasses ?? []).map((sub) => normalizeTransfermarktToken(sub)));
  let subclassDelta = 0;
  for (const [token, weight] of Object.entries(NATURE_SUBCLASS_DEMAND)) {
    if (subclassTokens.has(token)) {
      subclassDelta += weight;
    }
  }
  subclassDelta = clamp(subclassDelta, -0.05, 0.05);

  // 3) Gesinnung (Wesen)
  const alignmentDelta = deriveAlignmentDemandDelta(player.alignment);

  const traitMultiplier = 1 + traitDelta;
  const subclassMultiplier = 1 + subclassDelta;
  const alignmentMultiplier = 1 + alignmentDelta;

  pushDemandBreakdown(demandEntries, {
    key: "nature_trait_demand",
    label: "Charakter",
    category: "personality",
    multiplier: traitMultiplier,
    reason:
      traitDelta > 0
        ? "Ego-/geldgetriebene Traits treiben die Nachverhandlungs-Forderung hoch."
        : "Bescheidene/teamorientierte Traits daempfen die Forderung.",
  });
  pushDemandBreakdown(demandEntries, {
    key: "nature_subclass_demand",
    label: "Subklasse",
    category: "personality",
    multiplier: subclassMultiplier,
    reason:
      subclassDelta > 0
        ? "Prestige-Archetyp erwartet ein Status-Gehalt."
        : "Dienender Archetyp verhandelt zurueckhaltender.",
  });
  pushDemandBreakdown(demandEntries, {
    key: "nature_alignment_demand",
    label: "Wesen",
    category: "personality",
    multiplier: alignmentMultiplier,
    reason:
      alignmentDelta > 0
        ? "Chaotisches oder böses Wesen verhandelt härter."
        : "Rechtschaffenes/gutes Wesen verhandelt fairer.",
  });

  // Gesamt-Wesen-Multiplikator, gebaendigt damit er nicht dominiert.
  const salaryMultiplier = clamp(traitMultiplier * subclassMultiplier * alignmentMultiplier, 0.85, 1.18);
  if (salaryMultiplier > 1.04) {
    reasons.push("Das Wesen des Spielers treibt die Forderung nach oben.");
  } else if (salaryMultiplier < 0.96) {
    reasons.push("Das Wesen des Spielers senkt die Forderung.");
  }

  return {
    salaryMultiplier,
    demandEntries,
    reasons,
  };
}

function deriveFitDemandMultiplier(teamFit: number) {
  if (teamFit >= 0) return 1;
  return 1 + clamp(Math.abs(teamFit) / 80, 0.04, 0.2);
}

type RetoolContractSalaryRange = { min: number; max: number };

const RETOOL_STANDARD_CONTRACT_SALARY_RANGES: Record<number, RetoolContractSalaryRange> = {
  1: { min: 0.92, max: 1.08 },
  2: { min: 0.86, max: 1.02 },
  3: { min: 0.78, max: 0.94 },
  4: { min: 0.7, max: 0.86 },
  5: { min: 0.62, max: 0.78 },
};

const RETOOL_MERCENARY_CONTRACT_SALARY_RANGES: Record<number, RetoolContractSalaryRange> = {
  1: { min: 0.92, max: 1.08 },
  2: { min: 0.9, max: 1.06 },
  3: { min: 0.86, max: 1.02 },
  4: { min: 0.82, max: 0.98 },
  5: { min: 0.78, max: 0.94 },
};

function formatContractRangePercent(range: RetoolContractSalaryRange) {
  return `${Math.round(range.min * 100)}-${Math.round(range.max * 100)}%`;
}

function sampleRetoolContractSalaryFactor(player: Player, years: number, isMercenary: boolean) {
  const ranges = isMercenary ? RETOOL_MERCENARY_CONTRACT_SALARY_RANGES : RETOOL_STANDARD_CONTRACT_SALARY_RANGES;
  const range = ranges[years] ?? ranges[1];
  const sample = hashToUnitInterval(`${player.id}:${player.name}:retool-contract-salary:${years}:${isMercenary ? "merc" : "std"}`);
  return {
    range,
    sample,
    factor: roundMoney(range.min + (range.max - range.min) * sample, 4),
  };
}

function deriveRetoolContractSalarySignal(
  contractLength: number,
  player: Player | null,
  teamFit: number,
  salaryPreferenceAdjustmentPct = 0,
) {
  if (!player) {
    return {
      salaryMultiplier: 1,
      contractFactor: 1,
      shortTermMultiplier: 1,
      fit25Multiplier: 1,
      longFitMultiplier: 1,
      grossDiscount: 0,
      playerDiscount: 0,
      rangeFactor: 1,
      preferenceAdjustment: 0,
      netDiscount: 0,
      score: 0,
      reason: "",
      demandEntries: [] as NegotiationDemandBreakdownEntry[],
    };
  }

  const years = clamp(normalizeContractLength(contractLength), 1, 5);
  const isMercenary = hasTrait(player, "mercenary");
  const retoolSalary = sampleRetoolContractSalaryFactor(player, years, isMercenary);
  const rangeFactor = retoolSalary.factor;
  const grossDiscount = roundMoney(Math.max(0, 1 - rangeFactor), 4);
  const playerDiscount = grossDiscount;
  const preferenceAdjustment =
    typeof salaryPreferenceAdjustmentPct === "number" && Number.isFinite(salaryPreferenceAdjustmentPct)
      ? salaryPreferenceAdjustmentPct
      : 0;
  const effectivePreferenceAdjustment = clamp(preferenceAdjustment, -0.06, isMercenary ? 0.04 : 0.08);
  const pureLengthFactor = clamp(rangeFactor, 0.55, 1.2);
  const contractFactor = clamp(pureLengthFactor + effectivePreferenceAdjustment, 0.55, 1.2);
  const netDiscount = roundMoney(1 - contractFactor, 4);
  const preferenceFactor = pureLengthFactor > 0 ? contractFactor / pureLengthFactor : 1;
  const fit25Multiplier = teamFit >= 25 ? 0.9 : 1;
  const longFitPressure =
    years >= 4 && teamFit < 18
      ? clamp(((18 - teamFit) / 18) * (years === 5 ? 0.06 : 0.04), 0, years === 5 ? 0.06 : 0.04)
      : 0;
  const longFitMultiplier = 1;
  const salaryMultiplier = contractFactor * longFitMultiplier * fit25Multiplier;
  const demandEntries: NegotiationDemandBreakdownEntry[] = [];
  pushDemandBreakdown(demandEntries, {
    key: years === 1 ? "contract_retool_range" : "contract_length_discount",
    label: `${years} Jahr${years === 1 ? "" : "e"}`,
    category: "contract",
    multiplier: pureLengthFactor,
    reason:
      years === 1
        ? `Retool-Spanne ${formatContractRangePercent(retoolSalary.range)} setzt den Startwert der Verhandlung.`
        : isMercenary
          ? `Retool-Mercenary-Spanne ${formatContractRangePercent(retoolSalary.range)} setzt den Startwert statt einem festen Rabatt.`
          : `Retool-Spanne ${formatContractRangePercent(retoolSalary.range)} setzt den Startwert statt einem festen Rabatt.`,
  });
  pushDemandBreakdown(demandEntries, {
    key: "player_contract_wish_salary",
    label: "Spielerwunsch",
    category: "contract",
    multiplier: preferenceFactor,
    reason:
      effectivePreferenceAdjustment > 0
        ? "Laufzeit/Form liegen nicht ideal und reduzieren den Vertragsrabatt."
        : "Laufzeit/Form treffen den Wunsch und verbessern die Forderung.",
  });
  pushDemandBreakdown(demandEntries, {
    key: "fit25_salary_discount",
    label: "Fit 25+",
    category: "fit",
    multiplier: fit25Multiplier,
    reason: "Sehr guter Teamfit senkt die Forderung am Ende.",
  });
  pushDemandBreakdown(demandEntries, {
    key: "long_fit_pressure",
    label: "Langer Vertrag + Fit-Risiko",
    category: "contract",
    multiplier: longFitMultiplier,
    reason: `Bei ${years} Jahren verlangt niedriger Fit Sicherheitsaufschlag.`,
  });
  const rangeLabel = formatContractRangePercent(retoolSalary.range);
  const rangeFactorPercent = Math.round(rangeFactor * 100);
  const playerDiscountPercent = Math.round(playerDiscount * 100);
  const preferencePercent = Math.round(effectivePreferenceAdjustment * 100);
  const netDiscountPercent = Math.round(netDiscount * 100);
  const fitReason = fit25Multiplier < 1 ? " Teamfit 25+: 10% Fit-Rabatt wird ganz am Ende abgezogen." : "";
  const pressureReason =
    longFitPressure > 0
      ? ` Niedriger Fit bei ${years} Jahren drueckt die Zusage, aber nicht den Langvertragsrabatt.`
      : "";
  const preferenceReason =
    preferenceAdjustment > 0
      ? ` Spielerwunsch zieht ${preferencePercent}% davon ab.`
      : preferenceAdjustment < 0
        ? ` Spielerwunsch verbessert den Rabatt um ${Math.abs(preferencePercent)}%.`
        : "";
  const reason =
    years === 1
      ? `Retool-Vertragslogik: 1 Jahr startet aus Spanne ${rangeLabel}, hier ${rangeFactorPercent}% vom Basisgehalt.${preferenceReason}${fitReason}`
      : isMercenary
        ? `Retool-Vertragslogik: ${years} Jahre nutzen Mercenary-Spanne ${rangeLabel}, hier ${rangeFactorPercent}% vom Basisgehalt (${playerDiscountPercent}% Start-Rabatt).${preferenceReason} Netto ${netDiscountPercent}% Jahresrabatt.${fitReason}${pressureReason}`
        : `Retool-Vertragslogik: ${years} Jahre nutzen Spanne ${rangeLabel}, hier ${rangeFactorPercent}% vom Basisgehalt (${playerDiscountPercent}% Start-Rabatt).${preferenceReason} Netto ${netDiscountPercent}% Jahresrabatt.${fitReason}${pressureReason}`;

  return {
    salaryMultiplier,
    contractFactor,
    shortTermMultiplier: 1,
    fit25Multiplier,
    longFitMultiplier,
    grossDiscount,
    playerDiscount,
    rangeFactor,
    preferenceAdjustment: effectivePreferenceAdjustment,
    netDiscount,
    score: clamp((1 - contractFactor * longFitMultiplier) * 34 + (fit25Multiplier < 1 ? 4 : 0) - longFitPressure * 75, -14, 12),
    reason,
    demandEntries,
  };
}

/**
 * Länge-getriebener Gehaltsfaktor: der Vertragslängen-Anteil des vollen Verhandlungs-
 * DemandMultipliers (contractFactor * shortTerm * longFit * fit25 — exakt die Terme, die
 * buildContractNegotiationPreview bei 1356-1373 aus dem Vertragslängen-Signal zieht).
 * Damit kann der AI-Fast-Buy-Pfad denselben "länger für weniger Gehalt"-Rabatt auf das
 * Basisgehalt anwenden wie die volle (menschliche) Verhandlung, statt ein pauschales
 * Flat-Gehalt unabhängig von der Laufzeit zu schreiben. Deterministisch (Hash über Spieler+Jahre).
 */
export function resolveContractLengthSalaryFactor(input: {
  player: Player | null;
  contractLength: number;
  teamFit?: number | null;
  salaryPreferenceAdjustmentPct?: number;
}): number {
  const signal = deriveRetoolContractSalarySignal(
    input.contractLength,
    input.player ?? null,
    typeof input.teamFit === "number" && Number.isFinite(input.teamFit) ? input.teamFit : 0,
    input.salaryPreferenceAdjustmentPct ?? 0,
  );
  return clamp(
    signal.contractFactor * signal.shortTermMultiplier * signal.longFitMultiplier * signal.fit25Multiplier,
    0.5,
    1.45,
  );
}

function deriveContractShapeDemandSignal(contractShape: ContractShape) {
  const entries: NegotiationDemandBreakdownEntry[] = [];

  if (contractShape === "front_loaded") {
    pushDemandBreakdown(entries, {
      key: "shape_front_loaded_cash_now",
      label: CONTRACT_SHAPE_LABELS.front_loaded,
      category: "contract",
      multiplier: 0.98,
      reason: "Fruehes Geld reduziert die Jahresforderung leicht.",
    });
  } else if (contractShape === "back_loaded") {
    pushDemandBreakdown(entries, {
      key: "shape_back_loaded_late_money",
      label: CONTRACT_SHAPE_LABELS.back_loaded,
      category: "contract",
      multiplier: 1.02,
      reason: "Spaeteres Geld verlangt leichte Kompensation.",
    });
  }

  return {
    salaryMultiplier: entries.reduce((product, entry) => product * entry.multiplier, 1),
    entries,
  };
}

function deriveTeamDemandSignals(input: NegotiationPreviewInput, player: Player, teamFit: number) {
  const entries: NegotiationDemandBreakdownEntry[] = [];
  const identity = input.teamIdentity;
  const profile = input.teamStrategyProfile;
  const harmony = identity?.harmony ?? 5;
  const cooperation = identity?.cooperation ?? 5;
  const ambition = identity?.ambition ?? 5;
  const boardConfidence = identity?.boardConfidence ?? 5;
  const finances = identity?.finances ?? 5;

  if (harmony >= 8 && cooperation >= 7) {
    pushDemandBreakdown(entries, {
      key: "team_harmony_discount",
      label: "Harmony",
      category: "team",
      multiplier: 0.97,
      reason: "Gute Harmony/Cooperation senkt Wechselrisiko.",
    });
  } else if (harmony <= 3 || cooperation <= 3) {
    pushDemandBreakdown(entries, {
      key: "team_harmony_risk",
      label: "Teamruhe",
      category: "team",
      multiplier: 1.04,
      reason: "Unruhiges Team muss mehr Sicherheit bieten.",
    });
  }

  if (boardConfidence <= 3) {
    pushDemandBreakdown(entries, {
      key: "board_confidence_risk",
      label: "Board-Druck",
      category: "team",
      multiplier: 1.04,
      reason: "Niedrige Board Confidence macht das Projekt unsicherer.",
    });
  } else if (boardConfidence >= 8) {
    pushDemandBreakdown(entries, {
      key: "board_confidence_stability",
      label: "Board stabil",
      category: "team",
      multiplier: 0.98,
      reason: "Stabiles Board macht den Wechsel planbarer.",
    });
  }

  if (hasTrait(player, "ambitious")) {
    // Gate 7 statt 8 (verhandlung-rework.md Abschnitt 11): dieselbe Nachmessung wie beim
    // Wechselwillen — die 8 lag oberhalb dessen, was Teamidentitaeten real erreichen.
    if (ambition >= 7 || (profile?.bias.starPriority ?? 0) >= 7) {
      pushDemandBreakdown(entries, {
        key: "ambition_project_match",
        label: "Ambition passt",
        category: "personality",
        multiplier: 0.97,
        reason: "Ambitious sieht sportische Perspektive im Projekt.",
      });
    } else if (ambition <= 3 || teamFit < 8) {
      pushDemandBreakdown(entries, {
        key: "ambition_project_doubt",
        label: "Ambition zweifelt",
        category: "personality",
        multiplier: 1.06,
        reason: "Ambitious verlangt mehr, wenn Perspektive oder Fit schwach wirken.",
      });
    }
  }

  if ((profile?.bias.wageSensitivity ?? 5) >= 8 || finances >= 8) {
    pushDemandBreakdown(entries, {
      key: "wage_disciplined_team",
      label: "Gehaltsdisziplin",
      category: "team",
      multiplier: 0.98,
      reason: "Finanzstarkes oder gehaltsdiszipliniertes Umfeld verhandelt sauberer.",
    });
  }

  if ((profile?.bias.starPriority ?? 5) >= 8 && (profile?.bias.riskTolerance ?? 5) >= 7 && (input.team?.cash ?? 0) > 60) {
    pushDemandBreakdown(entries, {
      key: "aggressive_cash_signal",
      label: "Premium-Test",
      category: "team",
      multiplier: 1.03,
      reason: "Cashreiches, risikofreudiges Team signalisiert Spielraum. Spieler und Berater testen daher einen kleinen Premium-Aufschlag.",
    });
  }

  return {
    salaryMultiplier: entries.reduce((product, entry) => product * entry.multiplier, 1),
    entries,
  };
}

function pushScoreBreakdown(
  entries: NegotiationScoreBreakdownEntry[],
  entry: Omit<NegotiationScoreBreakdownEntry, "tone">,
) {
  const points = Math.round(entry.points);
  entries.push({
    ...entry,
    points,
    tone: points > 0 ? "positive" : points < 0 ? "negative" : "neutral",
  });
}

function normalizeChances(accept: number, counter: number, reject: number) {
  const safe = [accept, counter, reject].map((value) => Math.max(0, Math.round(value)));
  const total = safe.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return {
      acceptChance: 0,
      counterChance: 0,
      rejectChance: 100,
    };
  }

  const normalized = safe.map((value) => Math.round((value / total) * 100));
  const diff = 100 - normalized.reduce((sum, value) => sum + value, 0);
  normalized[1] += diff;

  return {
    acceptChance: clamp(normalized[0], 0, 99),
    counterChance: clamp(normalized[1], 0, 99),
    rejectChance: clamp(normalized[2], 0, 99),
  };
}

// Anzeige-Prozente (verhandlung-rework.md Abschnitt 2.5) — ABGELEITET aus dem bereits
// feststehenden Verdikt, nicht die Entscheidung selbst (das war Defekt 3 im alten Modell:
// argmax ueber drei Prozentwerte statt ein Band-Verdikt). mA/mR sind die Gehaltsabstaende zur
// Zusage- bzw. Absage-Schwelle; 300 macht 1 Prozentpunkt Abstand zu 3 Rohpunkten, damit sich die
// Balken bei jedem Regler-Schritt sichtbar bewegen (±10% Abstand saettigt Richtung Extrem,
// 50 + 30 = 80). 150/Floor 6 lassen das Gegenangebot im Korridor dominieren (beide Abstaende
// negativ -> 50) und schnell nach aussen schrumpfen.
function calculateNegotiationChances(input: {
  offerRatio: number;
  rReject: number;
  rFull: number;
  teamFit: number;
}) {
  const fitSignal = clamp(input.teamFit / 60, -0.8, 0.8);
  const mA = input.offerRatio - input.rFull;
  const mR = input.rReject - input.offerRatio;

  const rawAccept = clamp(50 + 300 * mA + 6 * fitSignal, 2, 96);
  const rawReject = clamp(50 + 300 * mR - 6 * fitSignal, 2, 96);
  const rawCounter = clamp(50 - 150 * Math.max(mA, mR), 6, 50);

  return normalizeChances(rawAccept, rawCounter, rawReject);
}

export function buildContractNegotiationPreview(input: NegotiationPreviewInput): ContractNegotiationPreview {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const scoreBreakdown: NegotiationScoreBreakdownEntry[] = [];
  const demandBreakdown: NegotiationDemandBreakdownEntry[] = [];

  const economy =
    input.player || input.rosterEntry
      ? resolvePlayerEconomyContract({ player: input.player, rosterEntry: input.rosterEntry })
      : null;
  const baseExpectedSalary = economy?.expectedSalary ?? null;
  let expectedSalary = baseExpectedSalary;
  let offeredSalary =
    typeof input.offeredSalary === "number" && Number.isFinite(input.offeredSalary) && input.offeredSalary > 0
      ? roundMoney(input.offeredSalary, 2)
      : null;
  const contractLength = normalizeContractLength(input.contractLength);
  const contractShape = input.contractShape;

  if (!input.player) {
    blockingReasons.push("player_not_found");
  }
  if (!input.team) {
    blockingReasons.push("team_not_found");
  }
  if (expectedSalary == null || expectedSalary <= 0) {
    blockingReasons.push("salary_source_missing");
  }

  const formulaSources = loadPlayerFormulaSources();
  if (formulaSources.traitSalaryFactorsStatus !== "ready") {
    warnings.push("trait_salary_factor_source_missing");
  }

  const bracket = input.player ? getTransfermarktBracket(resolvePlayerEconomyContract({ player: input.player }).marketValue) : null;
  if (bracket != null) {
    warnings.push("market_bracket_factor_preview_pending");
  }

  const fitBreakdown =
    input.player && input.rosterPlayers.length > 0
      ? calculateTransfermarktFit(input.player, input.rosterPlayers, { teamId: input.teamId })
      : { teamFit: 0, fitRace: 0, fitSubclasses: 0, fitTraits: 0, fitAlignment: 0 };
  const teamFit = fitBreakdown.teamFit ?? 0;
  const scoutingRecruitmentBonus = getTransfermarktScoutingRecruitmentBonus(input.scoutingLevel);
  const fit25Bonus = deriveFitPolicyBonus(input.teamIdentity);
  let demandMultiplier: number | null = null;
  const contractPreference = buildPlayerContractPreference(input.player, input.teamStrategyProfile, {
    contractLength,
    contractShape,
  });

  if (input.player && baseExpectedSalary != null && baseExpectedSalary > 0) {
    const cultureSignals = deriveTraitCultureSignals(input.player, input.teamIdentity);
    const natureSignals = derivePlayerNatureDemandSignals(input.player);
    const moodDemand = deriveNegotiationMood(input) / 100;
    const contractLengthSignal = deriveRetoolContractSalarySignal(
      contractLength,
      input.player,
      teamFit,
      contractPreference?.salaryAdjustmentPct ?? 0,
    );
    const fitDemandMultiplier = deriveFitDemandMultiplier(teamFit);
    const trustMultiplier = input.priorBadExperience ? 1.12 : 1;
    const moodMultiplier = 1 + moodDemand;
    const contractShapeSignal = deriveContractShapeDemandSignal(contractShape);
    const teamDemandSignals = deriveTeamDemandSignals(input, input.player, teamFit);

    demandBreakdown.push(buildDemandEntry({
      key: "base_salary",
      label: "Basis",
      category: "base",
      multiplier: 1,
      reason: "Basisgehalt aus MW, Klasse, Traits und Salary-Logik.",
    }));
    pushDemandBreakdown(demandBreakdown, {
      key: "negative_fit_pressure",
      label: "Teamfit",
      category: "fit",
      multiplier: fitDemandMultiplier,
      reason: `Fit ${roundMoney(teamFit, 1)} macht den Wechsel schwieriger.`,
    });
    demandBreakdown.push(...contractLengthSignal.demandEntries);
    demandBreakdown.push(...contractShapeSignal.entries);
    demandBreakdown.push(...cultureSignals.demandEntries);
    demandBreakdown.push(...natureSignals.demandEntries);
    demandBreakdown.push(...teamDemandSignals.entries);
    pushDemandBreakdown(demandBreakdown, {
      key: "prior_bad_experience",
      label: "Vertrauensbruch",
      category: "history",
      multiplier: trustMultiplier,
      reason: "Spieler ist nach der letzten geplatzten Runde noch angefressen und zieht die Forderung hoch.",
    });
    pushDemandBreakdown(demandBreakdown, {
      key: "negotiation_mood_demand",
      label: "Verhandlungslaune",
      category: "mood",
      multiplier: moodMultiplier,
      reason: "Kleine, deterministische Varianz fuer lebendigere Verhandlungen.",
    });

    const rawDemandMultiplier = clamp(
      fitDemandMultiplier *
        cultureSignals.salaryMultiplier *
        natureSignals.salaryMultiplier *
        trustMultiplier *
        contractLengthSignal.contractFactor *
        contractLengthSignal.shortTermMultiplier *
        contractLengthSignal.longFitMultiplier *
        contractShapeSignal.salaryMultiplier *
        teamDemandSignals.salaryMultiplier *
        moodMultiplier,
      0.5,
      1.45,
    );
    demandMultiplier = clamp(
      rawDemandMultiplier * contractLengthSignal.fit25Multiplier,
      0.5,
      1.45,
    );
    expectedSalary = roundMoney(baseExpectedSalary * demandMultiplier, 2);

    if (demandMultiplier > 1.06) {
      reasons.push(`Forderung steigt auf ${roundMoney(demandMultiplier * 100, 0)}% des Basisgehalts.`);
    } else if (demandMultiplier < 0.97) {
      reasons.push(`Guter Kontext senkt die Forderung auf ${roundMoney(demandMultiplier * 100, 0)}% des Basisgehalts.`);
    }
    if (contractLengthSignal.reason) {
      reasons.push(contractLengthSignal.reason);
    }
    if (contractPreference) {
      reasons.push(...contractPreference.reasons);
      warnings.push(...contractPreference.warnings);
    }
    reasons.push(...cultureSignals.reasons);
    reasons.push(...natureSignals.reasons);
  }

  /**
   * Trotz-Aufschlag (Abschnitt 9.1) — hier, VOR `offerRatio` und vor allem anderen, weil er die
   * Forderung selbst verändert und nicht bloß eine Schwelle. Stünde er weiter unten, zeigte der
   * Dialog „Forderung 10,00", während intern gegen 10,30 gerechnet würde.
   *
   * Nur der bereits VERHANDELTE Aufschlag aus dem Draft wirkt hier. Der aus dem gerade
   * getippten Angebot wird weiter unten als Hypothese ausgewiesen und erst beim Klick wirksam —
   * sonst wäre das Verdikt die Antwort auf eine Forderung, die es im Moment des Tippens noch
   * gar nicht gibt.
   */
  const baseDemandBeforeDefiance = expectedSalary;
  const appliedDefianceSurchargePct = clamp(input.priorDefianceSurchargePct ?? 0, 0, DEFIANCE_MAX_SURCHARGE);
  if (expectedSalary != null && appliedDefianceSurchargePct > 0) {
    expectedSalary = roundMoney(expectedSalary * (1 + appliedDefianceSurchargePct), 2);
  }

  offeredSalary = offeredSalary ?? expectedSalary ?? baseExpectedSalary;
  if (offeredSalary == null || offeredSalary <= 0) {
    blockingReasons.push("offer_salary_missing");
  }

  const contractPreview = buildContractSalarySchedule({
    annualSalary: offeredSalary,
    contractLength,
    shape: contractShape,
    seasonIdBase: input.seasonIdBase,
    seasonLabelBase: input.seasonLabelBase,
  });
  const buyoutCost = calculateOpenBuyoutCost(contractPreview.yearlySalarySchedule, 0);

  const offerRatio =
    expectedSalary != null && expectedSalary > 0 && offeredSalary != null
      ? roundMoney(offeredSalary / expectedSalary, 4)
      : null;

  let acceptanceScore: number | null = null;
  let acceptChance: number | null = null;
  let counterChance: number | null = null;
  let rejectChance: number | null = null;
  let conditionsAdjustmentPct: number | null = null;
  let rejectThresholdSalary: number | null = null;
  let moneyThresholdSalary: number | null = null;
  let acceptThresholdSalary: number | null = null;
  let prideCapSalary: number | null = null;
  let verdict: NegotiationVerdict | null = null;
  let counterSalary: number | null = null;
  let counterConditions: { contractLength: number; contractShape: ContractShape } | null = null;
  let baseDemandSalary: number | null = null;
  let effectiveDefianceSurchargePct = 0;
  let pendingDefianceSurchargePct = 0;
  let concededFromLastCounter = false;

  if (blockingReasons.length === 0 && input.player && expectedSalary != null && offeredSalary != null && offerRatio != null) {
    // Zwei Traitgruppen werden mehrfach gebraucht (Schwellen-Verschiebung, Stolz-Kappe,
    // Tooltip-Hinweise) — einmal vorne bestimmen statt hasTrait ueberall neu aufzurufen.
    const isMercenary = hasTrait(input.player, "mercenary");
    const isDivaOrEgo = hasAnyTrait(input.player, ["diva", "egomaniac"]);

    /**
     * GRUNDINTERESSE — variabel statt konstant.
     *
     * GEFRAGT: „kannst du das nicht sauber machen dass es nicht immer konstant ist? vllt hast du
     * ja ne idee wie man da ein bisschen varianz rein bringen kann."
     *
     * Vorher stand hier eine feste 45 fuer jeden Spieler bei jedem Team. Das war der groesste
     * Einzelposten des Wechselwillens — und der einzige, der ueberhaupt nichts unterschied.
     * Deshalb war die W-Spanne so schmal.
     *
     * VARIANZ, NICHT ZUFALL. Ein Wuerfel waere billig zu haben und wertlos: das ganze Modell ist
     * darauf gebaut, dass man im Tooltip nachlesen kann, WARUM jemand so reagiert. Zwei Groessen,
     * die das Spiel ohnehin hergibt und die bisher nirgends zaehlten:
     *
     * 1. STAMMPLATZ-AUSSICHT (-3 … +3): wie viele eurer Kaderspieler wuerde er ueberholen? Wer
     *    sofort in die Startaufstellung geht, will eher kommen; wer hinter dem halben Kader
     *    einsortiert, sieht die Bank. Das ist NICHT der Teamfit: der misst, wie gut er zum Kader
     *    PASST (Rasse, Subklasse, Traits), nicht wo er darin STEHT.
     * 2. KADERPLATZ (-1 … +1): ein Team mit freien Plaetzen bietet Spielzeit, ein volles nicht.
     *
     * Beide sind angebotsunabhaengig — sie gehoeren also korrekt auf die Willens-Achse und nicht
     * zur Forderung. Und beide sind um ihre Mitte gelegt, damit der SCHWIERIGKEITSGRAD nicht
     * verrutscht: Spanne 41 … 49 statt konstant 45.
     *
     * ZUR DOSIERUNG, weil sie nicht geraten ist. Die erste Fassung nahm -5…+5 und -2…+2 und
     * verschob den Anteil zusagebereiter Spieler deutlich zu weit nach unten. Halbiert und im
     * SELBEN Messaufbau gegen den Stand davor verglichen (12 Teams, je 250 Marktspieler):
     *
     *   vorher (Konstante 45)   Anteil unter 0,95x 30,2 %   Streuung zwischen Teams 14,8 Punkte
     *   mit Varianz             Anteil unter 0,95x 33,3 %   Streuung zwischen Teams 18,4 Punkte
     *
     * Die STREUUNG war das Ziel und waechst um 3,6 Punkte. Die Erleichterung um 3,1 Punkte war
     * es nicht — sie kommt daher, dass der Marktpool im Schnitt staerker ist als die Kader, die
     * Stammplatz-Aussicht also systematisch leicht positiv ausfaellt. Der Anker faengt genau das
     * ab: 44 statt 45, damit der Median wieder dort liegt, wo er vorher lag.
     */
    const kaderOvrs = input.rosterPlayers.map((mate) => mate.ovr ?? 0);
    const ueberholt = kaderOvrs.length
      ? kaderOvrs.filter((wert) => (input.player?.ovr ?? 0) > wert).length / kaderOvrs.length
      : 0.5;
    const stammplatzPunkte = clamp(Math.round(ueberholt * 6), 0, 6) - 3;
    const rosterLimit = Math.max(1, input.team?.rosterLimit ?? 14);
    const freiePlaetze = Math.max(0, rosterLimit - kaderOvrs.length);
    const kaderplatzPunkte = clamp(Math.round((freiePlaetze / rosterLimit) * 6), 0, 2) - 1;

    pushScoreBreakdown(scoreBreakdown, {
      key: "base_interest",
      label: "Grundinteresse",
      category: "base",
      points: BASE_INTEREST_ANCHOR + stammplatzPunkte + kaderplatzPunkte,
      reason:
        stammplatzPunkte >= 2
          ? "Er waere bei euch sofort gesetzt — das macht den Wechsel attraktiv."
          : stammplatzPunkte <= -2
            ? "Er saehe sich bei euch hinter dem halben Kader — wenig Aussicht auf Spielzeit."
            : freiePlaetze === 0
              ? "Euer Kader ist voll; Spielzeit waere fuer ihn unsicher."
              : "Spieler ist grundsaetzlich offen fuer ein Angebot.",
    });

    // Kein "salary_offer"-Score-Eintrag mehr (Defekt aus verhandlung-rework.md Abschnitt 0):
    // Geld zaehlte im alten Modell doppelt — einmal hier als Score-Punkte, dann nochmal als
    // offerRatio gegen die Schwelle. Jetzt wirkt das Angebot NUR noch ueber r gegen R_rej/
    // R_money/R_full (Abschnitt 2.1); W bleibt angebotsunabhaengig.

    const fitPoints = deriveTeamFitWillingnessPoints(teamFit, fit25Bonus);
    pushScoreBreakdown(scoreBreakdown, {
      key: "team_fit",
      label: "Teamfit",
      category: "fit",
      points: fitPoints,
      reason:
        teamFit < 0
          ? `Negativer Fit (${roundMoney(teamFit, 1)}) macht den Wechsel riskanter.`
          : teamFit >= 25
            ? `Hoher Fit (${roundMoney(teamFit, 1)}) macht den Wechsel attraktiver.`
            : `Fit (${roundMoney(teamFit, 1)}) hilft, ist aber kein alleiniger Wechselgrund.`,
    });
    if (teamFit < 0) {
      warnings.push("low_team_fit_reduces_acceptance");
    } else {
      reasons.push(
        teamFit >= 25
          ? `Hoher Team-Fit (${roundMoney(teamFit, 1)}) gibt Bonus.`
          : `Team-Fit (${roundMoney(teamFit, 1)}) stuetzt das Angebot.`,
      );
    }

    if (scoutingRecruitmentBonus > 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "scouting_network",
        label: "Scouting",
        category: "culture",
        points: scoutingRecruitmentBonus,
        reason: "Gutes Scouting verbessert Kontakt, Vorwissen und Grundbereitschaft des Spielers.",
      });
      reasons.push(`Scouting-Level ${input.scoutingLevel ?? 0} gibt ${scoutingRecruitmentBonus > 0 ? "+" : ""}${scoutingRecruitmentBonus} Grundbereitschaft.`);
    }

    const contractStyleScore = deriveContractStyleAdjustment(contractLength, contractShape, input.teamStrategyProfile);
    if (contractStyleScore !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "contract_style",
        label: "Vertragsstruktur",
        category: "contract",
        points: contractStyleScore,
        reason: "Laenge/Form passen zur Team- oder Spielerlogik.",
      });
    }

    if (contractPreference && contractPreference.scoreAdjustment !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "player_contract_preference",
        label: "Spieler-Vertragspraeferenz",
        category: "contract",
        points: contractPreference.scoreAdjustment,
        reason: contractPreference.reasons[0] ?? "Laufzeit/Form beeinflussen die Verhandlung.",
      });
    }

    const contractLengthSignal = deriveRetoolContractSalarySignal(
      contractLength,
      input.player,
      teamFit,
      contractPreference?.salaryAdjustmentPct ?? 0,
    );
    if (contractLengthSignal.reason) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "contract_length_security",
        label: "Laufzeitsicherheit",
        category: "contract",
        points: contractLengthSignal.score,
        reason: contractLengthSignal.reason,
      });
    }

    if (input.priorBadExperience) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "bad_experience",
        label: "Spieler angefressen",
        category: "history",
        points: -14,
        reason: "Letzte Verhandlung mit diesem Team lief schlecht. Vertrauen ist unten und die Zusage sinkt merklich.",
      });
      warnings.push("previous_rejected_offer_reduces_trust");
      reasons.push("Spieler ist nach der letzten Verhandlung mit diesem Team noch angefressen.");
    }

    const cultureSignals = deriveTraitCultureSignals(input.player, input.teamIdentity);
    if (cultureSignals.score !== 0) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "trait_culture",
        label: "Traits & Teamkultur",
        category: "culture",
        points: cultureSignals.score,
        reason: cultureSignals.reasons.join(" ") || "Traits veraendern die Teamwirkung.",
      });
    }

    // mercenary_lowball/_paid sind keine Score-Punkte mehr, sondern Schwellen-Verschiebungen
    // (persReq/persRej weiter unten) — sie beschreiben, wie empfindlich jemand auf die Hoehe
    // des Angebots reagiert, nicht ob er grundsaetzlich wechseln will. Der Hinweistext bleibt
    // fuer den Tooltip (Buendel 3, "Reicht das Paket?").
    if (isMercenary) {
      reasons.push("Mercenary reagiert empfindlich auf Lowball-Angebote.");
    }

    if (input.player && hasTrait(input.player, "loyal") && teamFit >= LOYAL_FIT_THRESHOLD) {
      pushScoreBreakdown(scoreBreakdown, {
        key: "loyal_fit",
        label: "Loyalitaet",
        category: "personality",
        points: 6,
        reason: "Loyaler Spieler akzeptiert guten Fit eher.",
      });
      reasons.push("Loyalität und guter Fit erhöhen die Toleranz.");
    }

    if (input.player && hasTrait(input.player, "ambitious")) {
      const ambition = input.teamIdentity?.ambition ?? 0;
      if (ambition >= AMBITION_PROJECT_THRESHOLD || (input.teamStrategyProfile?.bias.starPriority ?? 0) >= AMBITION_PROJECT_THRESHOLD) {
        pushScoreBreakdown(scoreBreakdown, {
          key: "ambition_match",
          label: "Ambition",
          category: "personality",
          points: 4,
          reason: "Ambitionierter Spieler sieht sportische Perspektive.",
        });
        reasons.push("Ambitious mag ambitionierte Teamumfelder.");
      } else if (ambition <= 3 && (input.teamStrategyProfile?.bias.starPriority ?? 0) < AMBITION_PROJECT_THRESHOLD) {
        // Aenderung ggue. dem alten Modell (verhandlung-rework.md Abschnitt 1, Tabellenzeile
        // ambition_match/mismatch): der Mismatch-Zweig feuerte frueher bei offerRatio < 1 —
        // das war Geld, das hier nicht hingehoert (W ist angebotsunabhaengig). Ambition ist eine
        // Eigenschaft des Umfelds: ein schwaches Projekt (niedrige Team-Ambition UND kein
        // Star-Fokus) enttaeuscht einen ambitionierten Spieler unabhaengig vom Angebot.
        pushScoreBreakdown(scoreBreakdown, {
          key: "ambition_mismatch",
          label: "Ambition",
          category: "personality",
          points: -3,
          reason: "Ambitionierter Spieler sieht wenig sportliche Perspektive im Projekt.",
        });
        warnings.push("Ambitious reagiert bei schwachem Projekt kritischer.");
      }
    }

    // ego_lowball/_signal sind wie mercenary_lowball/_paid keine Score-Punkte mehr, sondern
    // Schwellen-Verschiebung (persReq/persRej) — sie zaehlten sonst effektiv zweimal, denn ein
    // Teil des Diva-/Ego-Malus steckt bereits in trait_culture (Status-Erwartung) oben.
    if (isDivaOrEgo) {
      reasons.push("Diva/Egomaniac erwarten ein sichtbares Signal im Angebot.");
    }

    // Gestrichen: "team_wage_sensitivity" (verhandlung-rework.md Abschnitt 1). Der Eintrag zog
    // dem SPIELER Punkte ab, weil das TEAM gehaltsdiszipliniert ist — das ist Team-Politik,
    // keine Spielerpsychologie, und fuer den Spieler unsichtbar. Die Team-Gehaltsdisziplin
    // wirkt bereits korrekt auf der Forderungsseite (wage_disciplined_team-Eintrag in
    // deriveTeamDemandSignals, x0.98). Ersatzlos gestrichen, kein Ersatz noetig.

    const mood = deriveNegotiationMood(input);
    pushScoreBreakdown(scoreBreakdown, {
      key: "negotiation_mood",
      label: "Tagesform",
      category: "mood",
      points: mood,
      reason: "Kleiner deterministischer Verhandlungsfaktor fuer Varianz.",
    });

    if (offerRatio >= 1.1) {
      reasons.push("Angebot liegt deutlich ueber dem Erwartungsgehalt.");
    } else if (offerRatio >= 1) {
      reasons.push("Angebot deckt das Erwartungsgehalt.");
    } else {
      warnings.push("offer_below_expected_salary");
    }

    // --- Achse A: Wechselwille W (verhandlung-rework.md Abschnitt 1) ---
    // NUR diese neun Keys (acht Faktoren, ambition_match/mismatch teilen sich einen Faktor)
    // zaehlen — nicht "alles in scoreBreakdown". contract_style/player_contract_preference/
    // contract_length_security bleiben oben im Array fuer die Anzeige ("Warum der Deal so
    // ausfaellt"), speisen aber K (Achse C) statt W. Das ist der Kern des Rework: Geld zaehlte
    // vorher doppelt (score + offerRatio) und Vertragskonditionen zaehlten in denselben Topf wie
    // Wechselwille. Jetzt getrennt.
    const W_AXIS_KEYS = new Set([
      "base_interest",
      "team_fit",
      "scouting_network",
      "trait_culture",
      "loyal_fit",
      "ambition_match",
      "ambition_mismatch",
      "bad_experience",
      "negotiation_mood",
    ]);
    const willingnessRaw = scoreBreakdown
      .filter((entry) => W_AXIS_KEYS.has(entry.key))
      .reduce((sum, entry) => sum + entry.points, 0);
    const W = clamp(Math.round(willingnessRaw), 0, 99);
    acceptanceScore = W;

    // --- Achse C: Konditionen K (Abschnitt 1) ---
    // 1 Score-Punkt ≈ 0,5% Gehalt. Die drei Rohwerte (nicht die gerundeten Anzeige-Punkte aus
    // scoreBreakdown) fuer volle Praezision; die Rundung fuer die Anzeige oben aendert das
    // Verdikt nicht messbar, aber unnoetiges Rundungsrauschen ist unnoetig.
    const styleScoreRaw = contractStyleScore;
    const prefScoreRaw = contractPreference?.scoreAdjustment ?? 0;
    const lengthScoreRaw = contractLengthSignal.score;
    conditionsAdjustmentPct = clamp(-(styleScoreRaw + prefScoreRaw + lengthScoreRaw) * 0.005, -0.04, 0.08);

    // --- Persoenlichkeits-Schwellen (Abschnitt 1, "angebotsreaktive Traits") ---
    // Ersetzen die alten mercenary_lowball/_paid + ego_lowball/_signal Score-Eintraege: wie
    // empfindlich jemand auf die HOEHE des Angebots reagiert, ist keine Frage des Wechselwillens
    // (W), sondern verschiebt die Geld-Schwellen direkt.
    const persReq = (isMercenary ? 0.02 : 0) + (isDivaOrEgo ? 0.015 : 0);
    const persRej = (isMercenary ? 0.05 : 0) + (isDivaOrEgo ? 0.03 : 0);

    // --- Schwellen (Abschnitt 2.1) — alles Verhaeltnisse zur Forderung D = expectedSalary ---
    const rReject = clamp(0.98 - 0.004 * W, 0.7, 0.95) + persRej;
    const rMoney = deriveMoneyThresholdRatio(W) + persReq;
    const rFull = rMoney + conditionsAdjustmentPct;
    const pride = 1.04 + (isMercenary || isDivaOrEgo ? 0.02 : 0);

    // --- Trotz-Aufschlag (Abschnitt 9.1) -----------------------------------------------
    // GEMELDET: „sollte bei so sturen spielern wenn verhandelt wird die forderung nicht teils
    // hoch gehen? vor allem wenn ich lowballen will?"
    //
    // Vorher gab es unter der Forderung nur zwei Zustaende: feilschen oder Abbruch. Zwischen
    // der Absage-Schwelle der Sturen (gemessen Ø 0,855) und dem Beginn echten Feilschens lag
    // eine Zone, in der ein Lowball folgenlos gekontert wurde. Die bekommt jetzt einen Preis —
    // aber einen, den man vorher sieht und der die Verhandlung nicht abbricht.
    const isStubborn = isMercenary || isDivaOrEgo;
    // D' — die Forderung, gegen die diese Runde gerechnet wird; sie traegt den bereits
    // verhandelten Aufschlag schon (oben, vor `offerRatio`, angebracht).
    const D = expectedSalary;
    const O = offeredSalary;
    const r = offerRatio;
    const priorSurcharge = appliedDefianceSurchargePct;
    // D0 — die Forderung OHNE jeden Aufschlag. Der Ausloeser misst gegen sie; gegen die bereits
    // erhoehte Forderung gemessen wuerde der Aufschlag seinen eigenen Ausloeser verschieben und
    // sich Runde um Runde selbst nachladen.
    const D0 = baseDemandBeforeDefiance ?? D;

    // Die Beleidigungsgrenze wandert mit dem realen Zusagepunkt: beleidigend ist, was weit
    // unter dem liegt, wozu er wirklich unterschreiben wuerde — nicht eine absolute Zahl.
    const insultRatio = Math.min(DEFIANCE_INSULT_RATIO, rFull - 0.04);
    const baseRatio = D0 > 0 ? O / D0 : 1;
    const surchargeFromOffer =
      isStubborn && baseRatio < insultRatio && baseRatio >= rReject
        ? Math.min(DEFIANCE_MAX_SURCHARGE, roundToStep(DEFIANCE_FACTOR * (insultRatio - baseRatio), 0.005))
        : 0;
    // Monoton: es zaehlt der tiefste je verhandelte Griff. Tippen ist frei, Verhandeln klebt.
    const pendingSurcharge = Math.max(priorSurcharge, surchargeFromOffer);
    baseDemandSalary = roundMoney(D0, 2);
    effectiveDefianceSurchargePct = priorSurcharge;
    pendingDefianceSurchargePct = pendingSurcharge;

    if (priorSurcharge > 0) {
      pushDemandBreakdown(demandBreakdown, {
        key: "defiance_surcharge",
        label: "Trotz",
        category: "personality",
        multiplier: roundMoney(1 + priorSurcharge, 4),
        reason: `Euer Lowball in dieser Verhandlung hat er persoenlich genommen: +${Math.round(priorSurcharge * 1000) / 10} % auf die Forderung, fuer den Rest dieser Verhandlung.`,
      });
      reasons.push(
        `Seine Forderung steht wegen eures frueheren Lowballs bei ${roundMoney(D, 2)} statt ${roundMoney(D0, 2)}.`,
      );
    }
    if (surchargeFromOffer > priorSurcharge) {
      warnings.push("defiance_surcharge_pending");
      reasons.push(
        `Wenn ihr DAS verhandelt, steigt seine Forderung auf ${roundMoney(D0 * (1 + pendingSurcharge), 2)} — mehr als ${Math.round((1 - insultRatio) * 100)} % unter der Forderung nimmt er persoenlich.`,
      );
    }

    rejectThresholdSalary = roundMoney(D * rReject, 2);
    moneyThresholdSalary = roundMoney(D * rMoney, 2);
    acceptThresholdSalary = roundMoney(D * rFull, 2);
    prideCapSalary = roundMoney(D * pride, 2);

    // --- Verdikt (Abschnitt 2.2) — Reihenfolge IST die Entscheidung, kein Vergleich von drei
    // Prozentwerten (das war Defekt 3: argmax ohne echten Mittelbereich). ---
    if (input.affrontRetreat) {
      // Ausserhalb der Baender (Abschnitt 4.3): ein Rueckzieher unter das zuletzt gezeigte
      // Entgegenkommen ist kein Verhandlungspunkt, sondern ein Vertrauensbruch. Uebersteuert
      // jedes Band — die bestehenden Strafen (W -14, D x1.12) greifen erst bei der NAECHSTEN
      // Vorschau, sobald "rejected_bad_experience" persistiert und priorBadExperience gesetzt ist.
      verdict = "reject_affront";
      warnings.push("retreat_after_counter_affront");
      reasons.push("Ihr seid nach seinem Entgegenkommen mit einem niedrigeren Angebot zurueckgerudert — er bricht ab.");
    } else if (baseRatio < rReject) {
      // Der Abbruch misst gegen D0, nicht gegen die trotzig erhoehte Forderung: „Trotz ist
      // Aerger, kein Bruch" (Abschnitt 9.1). Sonst koennte ein Aufschlag, den der Spieler
      // selbst ausgeloest hat, dasselbe Angebot in der naechsten Runde zum Vertrauensbruch
      // machen — zweimal bestraft fuer denselben Griff.
      verdict = "reject_lowball";
      reasons.push("Angebot ist zu weit von der Forderung entfernt — er bricht die Verhandlung ab.");
    } else if (r >= rFull) {
      verdict = "accept";
    } else if (r >= rMoney) {
      verdict = "counter_conditions";
      if (contractPreference) {
        counterConditions = {
          contractLength: clamp(
            contractPreference.idealLength,
            contractPreference.preferredMinLength,
            contractPreference.preferredMaxLength,
          ),
          contractShape: contractPreference.shapePreference,
        };
      }
      reasons.push("Beim Gehalt ist man sich einig — er verhandelt jetzt ueber Laufzeit/Form statt ueber Geld.");
    } else if (r >= pride) {
      // Ueber Anspruch + Stolz-Kappe, aber unter der Geld-Schwelle: mehr Geld zu fordern waere
      // fuer ihn selbst unglaubwuerdig (er nennt nie mehr als D*P). Er sagt ehrlich ab, statt
      // eine Zahl zu nennen, die er selbst nicht vertreten kann.
      verdict = "reject_not_about_money";
      reasons.push("Am Geld liegt es nicht — er will einfach nicht zu euch, unabhaengig vom Angebot.");
    } else {
      const target = D * Math.min(rFull, pride);
      if (target - O < 0.02) {
        // Bagatelle (Regel 5): die Restluecke ist kleiner als ein sinnvoller Gehaltsschritt —
        // ein Mini-Gegenangebot waere Theater, also sagt er direkt zu.
        verdict = "accept";
      } else {
        // Geld-Gegenangebot (Regel 6, Abschnitt 3.1). Haerte h: 0,80 Basis (er gibt standardmaessig
        // ~20% der Restluecke nach), -0,006 je Willenspunkt (willige Spieler kommen entgegen),
        // +0,9 x Lowball-Tiefe (je tiefer unter der Geld-Schwelle, desto haerter — sonst waere
        // "erst lowballen, dann Gegenangebot einschlagen" die dominante Strategie). Deckel 1,00:
        // er geht nie ueber seinen Zielpunkt hinaus, das waere die alte Ratsche.
        const hardness = clamp(0.8 - (W - 50) * 0.006 + (rMoney - r) * 0.9, 0.55, 1.0);
        const formulaCounter = O + (target - O) * hardness;

        // --- Erwiderung (Abschnitt 9.3) ------------------------------------------------
        // GEMELDET: „wenn ich dann entgegen komme und bei umbros zb 13,5 biete muesste er ggf.
        // auch noch mal entgegen kommen."
        //
        // Gemessen war genau das nicht so: Angebote 13,25 / 13,50 / 14,00 ergaben Gegenangebote
        // 14,44 / 14,43 / 14,44 — ein festes Ziel, kein Zugestaendnis. Das lag nicht an der
        // Kalibrierung, sondern daran, dass die Haerte-Formel GEDAECHTNISLOS ist: der
        // Anti-Exploit-Term (+0,9 x Lowball-Tiefe) hebt fast exakt auf, was der Nutzer drauflegt.
        // Eine Formel ohne Vorrunde kann Entgegenkommen prinzipiell nicht belohnen. Deshalb
        // bekommt das Gegenangebot hier ein Gedaechtnis — sein letztes Wort aus dem Draft.
        const lastCounter = input.lastCounterSalary ?? null;
        const lastOffer = input.lastNegotiatedSalary ?? null;
        const step = lastOffer != null ? O - lastOffer : 0;
        const hasRealStep = lastCounter != null && lastOffer != null && step >= DEFIANCE_MIN_STEP_RATIO * D0;

        if (hasRealStep) {
          // g: wie weit er mitgeht, je Einheit, die ihr drauflegt. Sture bewegen sich zaeh,
          // Willige springen fast mit. Alle drei Werte liegen unter dem Trotz-Faktor 1,5 —
          // sonst liesse sich ein Lowball durch spaeteres Entgegenkommen zurueckverdienen.
          const g = isStubborn ? 0.3 : W >= WILLING_WILLINGNESS ? 0.7 : 0.5;
          // rho: was Erwiderung INSGESAMT gegenueber dem Direktangebot sparen darf. Ohne diesen
          // Boden waere Salami-Taktik dominant — viele kleine Schritte, jeder halb erwidert,
          // konvergieren deutlich unter die Zusage-Schwelle.
          const rho = isStubborn ? 0.01 : W >= WILLING_WILLINGNESS ? 0.03 : 0.02;
          const memoryCounter = lastCounter - g * step;
          const floor = D * (Math.min(rFull, pride) - rho);
          // Er steht zu seinem letzten Wort: sein Gegenangebot steigt innerhalb einer
          // Verhandlung nie. (Die FORDERUNG kann per Trotz steigen — aber nur als Antwort auf
          // einen Lowball, und nach einem Konter loest ein niedrigeres Angebot ohnehin die
          // Affront-Regel aus. Beide Gedaechtnisse koennen sich nie widersprechen.)
          //
          // Reihenfolge: erst der Budget-Boden, DANN die Deckelung auf sein letztes Wort. Anders
          // herum konnte der Boden das Gegenangebot ueber sein letztes Wort heben — bei hoher
          // Zusage-Schwelle liegt `floor` naemlich darueber. Das waere die Ratsche zurueck
          // durch die Hintertuer: er kaeme entgegen und forderte trotzdem mehr als vorher.
          counterSalary = roundMoney(Math.min(lastCounter, Math.max(Math.min(formulaCounter, memoryCounter), floor)), 2);
          concededFromLastCounter = counterSalary < lastCounter - 0.005;
        } else if (lastCounter != null) {
          // Kein QUALIFIZIERTER Schritt (zu klein, oder gar keiner) — dann gibt er nichts nach.
          // Aber sein letztes Wort deckelt trotzdem: die Mindestschritt-Regel entscheidet, ob er
          // ENTGEGENKOMMT, nicht ob er wieder hochgehen darf. Ohne diese Deckelung kam die
          // Ratsche am Rand zurueck: ein Schritt einen Cent unter der Schwelle fiel aus dem
          // Gedaechtnis, und die gedaechtnislose Formel nannte prompt wieder eine hoehere Zahl
          // als in der Vorrunde.
          counterSalary = roundMoney(Math.min(formulaCounter, lastCounter), 2);
        } else {
          counterSalary = roundMoney(formulaCounter, 2);
        }

        if (counterSalary - O < 0.02) {
          // Bagatelle, erweitert (Abschnitt 9.3): die Erwiderung hat die Restluecke unter einen
          // sinnvollen Gehaltsschritt gedrueckt — dann sagt er zu, statt um Cents zu feilschen.
          counterSalary = null;
          verdict = "accept";
          reasons.push("Ihr seid ihm entgegengekommen — der Rest ist ihm zu klein, um noch zu verhandeln.");
        } else {
          verdict = "counter_money";
          reasons.push(
            concededFromLastCounter
              ? `Ihr seid ihm entgegengekommen — er geht mit und senkt seine Forderung auf ${counterSalary}.`
              : "Er verhandelt nach: ein hoeheres Gehalt als euer aktuelles Angebot.",
          );
        }
      }
    }

    const normalized = calculateNegotiationChances({
      offerRatio,
      rReject,
      rFull,
      teamFit,
    });
    acceptChance = normalized.acceptChance;
    counterChance = normalized.counterChance;
    rejectChance = normalized.rejectChance;
  }

  if (contractShape === "front_loaded") {
    reasons.push(`${CONTRACT_SHAPE_LABELS.front_loaded} legt frueh mehr Gehalt in den Vertrag.`);
  } else if (contractShape === "back_loaded") {
    reasons.push(`${CONTRACT_SHAPE_LABELS.back_loaded} schiebt Gehalt in spaetere Seasons.`);
  } else {
    reasons.push(`${CONTRACT_SHAPE_LABELS.balanced} verteilt das Gehalt gleichmaessig.`);
  }

  warnings.push("preview_only_contract_negotiation");

  return {
    expectedSalary,
    baseExpectedSalary,
    demandMultiplier: demandMultiplier != null ? roundMoney(demandMultiplier, 4) : null,
    offeredSalary,
    offerRatio,
    contractLength,
    contractShape,
    yearlySalarySchedule: contractPreview.yearlySalarySchedule,
    totalSalary: contractPreview.totalSalary,
    roundingAdjustment: contractPreview.roundingAdjustment,
    buyoutCost,
    bracket,
    teamFit,
    acceptanceScore,
    acceptChance,
    counterChance,
    rejectChance,
    conditionsAdjustmentPct: conditionsAdjustmentPct != null ? roundMoney(conditionsAdjustmentPct, 4) : null,
    rejectThresholdSalary,
    moneyThresholdSalary,
    acceptThresholdSalary,
    prideCapSalary,
    verdict,
    counterSalary,
    counterConditions,
    baseDemandSalary,
    defianceSurchargePct: effectiveDefianceSurchargePct,
    pendingDefianceSurchargePct,
    concededFromLastCounter,
    contractPreference,
    demandBreakdown,
    scoreBreakdown,
    reasons,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
    status:
      blockingReasons.length > 0
        ? "blocked_missing_salary_source"
        : "ready_for_review",
  };
}

export function buildContractNegotiationDraft(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  preview: ContractNegotiationPreview;
  /** Trotz-Aufschlag des VORHERIGEN Drafts — der neue Wert waechst nur monoton daraus. */
  priorDefianceSurchargePct?: number;
}): ContractNegotiationDraft {
  return {
    draftId: `contract-draft:${input.seasonId}:${input.teamId}:${input.playerId}`,
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    playerId: input.playerId,
    playerName: input.playerName,
    contractLength: input.preview.contractLength,
    contractShape: input.preview.contractShape,
    expectedSalary: input.preview.expectedSalary,
    offeredSalary: input.preview.offeredSalary,
    yearlySalarySchedule: input.preview.yearlySalarySchedule,
    totalSalary: input.preview.totalSalary,
    roundingAdjustment: input.preview.roundingAdjustment,
    buyoutCost: input.preview.buyoutCost,
    bracket: input.preview.bracket,
    teamFit: input.preview.teamFit,
    acceptanceScore: input.preview.acceptanceScore,
    acceptChance: input.preview.acceptChance,
    counterChance: input.preview.counterChance,
    rejectChance: input.preview.rejectChance,
    reasons: input.preview.reasons,
    warnings: input.preview.warnings,
    blockingReasons: input.preview.blockingReasons,
    status: input.preview.status,
    /**
     * Verhandlungsgedaechtnis (Abschnitt 9.3/9.1). Beide Felder haengen am STATUS, nicht am
     * Zufall des Zeitpunkts:
     *
     * - Sein letztes Geld-Wort gilt nur, solange die Verhandlung auf "countered" steht. Jeder
     *   andere Status beendet die Runde — dann gibt es nichts mehr zu erwidern.
     * - Der Trotz-Aufschlag waechst monoton (`max` gegen den Vorwert, den der Aufrufer
     *   uebergibt) und wird bei `rejected_bad_experience` genullt: dort greift die
     *   Vertrauensbruch-Strafe, und beides zu stapeln waere zweimal kassiert.
     */
    lastCounterSalary:
      input.preview.status === "countered" && input.preview.verdict === "counter_money"
        ? input.preview.counterSalary ?? null
        : null,
    defianceSurchargePct:
      input.preview.status === "rejected_bad_experience"
        ? 0
        : Math.max(input.priorDefianceSurchargePct ?? 0, input.preview.pendingDefianceSurchargePct ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTeamContractSeasonTable(input: {
  gameState: GameState;
  teamId: string;
  seasonLabelBase: string;
}): TeamContractSeasonTable {
  const rosterRows = input.gameState.rosters
    .filter((entry) => entry.teamId === input.teamId)
    .map<TeamContractSeasonRow>((entry) => {
      const player = input.gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(input.gameState, player, entry);
      const marketValueAtExit = saleFactorBreakdown.baseMarketValue ?? economy.marketValue ?? null;
      const exitValue = saleFactorBreakdown.salePrice ?? economy.marketValue ?? null;
      const purchasePrice = normalizeVisibleRosterMoney(entry.purchasePrice, economy.purchasePrice);
      const profitLoss =
        exitValue != null && purchasePrice != null
          ? roundMoney(Math.abs(exitValue - purchasePrice) < 0.005 ? 0 : exitValue - purchasePrice, 2)
          : null;
      const preview = buildContractSalarySchedule({
        annualSalary: economy.salary,
        contractLength: entry.contractLength,
        shape: entry.contractShape ?? "balanced",
        seasonIdBase: input.gameState.season.id,
        seasonLabelBase: input.seasonLabelBase,
      });
      const yearlySalarySchedule =
        entry.yearlySalarySchedule && entry.yearlySalarySchedule.length > 0
          ? entry.yearlySalarySchedule
          : preview.yearlySalarySchedule;
      const morale = player
        ? assessPlayerMorale({
            gameState: input.gameState,
            playerId: player.id,
            teamId: input.teamId,
            renewalSalaryPreview: economy.salary,
          })
        : null;

      return {
        rowId: entry.id,
        playerId: entry.playerId,
        playerName: player?.name ?? entry.playerId,
        status: "active",
        roleTag: entry.roleTag,
        contractShape: entry.contractShape ?? "balanced",
        contractLength: entry.contractLength,
        totalSalary: roundMoney(yearlySalarySchedule.reduce((sum, row) => sum + row.salary, 0), 2),
        /**
         * GEMELDET: „ich bin gerade MD10 im Saisonende, aber hier stehen immer noch Werte bei
         * Buyout trotz auslaufender Vertraege — der Buyout muesste zu dem Zeitpunkt bei allen
         * schon um 1 Vertragsjahr geringer sein."
         *
         * Die Beobachtung stimmt, die erste Antwort darauf war aber nur die halbe: hier stand
         * ein festes `1`, waehrend Verkaufsdialog und Ausfuehrung weiter mit der vollen
         * Restlaufzeit rechneten — und der Kommentar schrieb ausdruecklich hin, dass der echte
         * Flow „unberuehrt" bleibt. Damit widersprachen sich Tabelle und Dialog fuer denselben
         * Spieler; gemeldet als „da schau, das passt nicht" (Tabelle 0,0 Mio, Dialog 8,8 Mio).
         *
         * Ob das laufende Vertragsjahr noch in der Abloese steckt, haengt nicht daran, WER
         * fragt, sondern ob das Gehalt dieser Saison schon gebucht ist. Genau das entscheidet
         * jetzt `resolveElapsedContractSeasonsForBuyout` — fuer diese Tabelle, fuer die VK-Spalte
         * der Spielerliste und fuer den Verkauf selbst.
         */
        buyoutCost: calculateOpenBuyoutCost(
          yearlySalarySchedule,
          resolveElapsedContractSeasonsForBuyout({ gameState: input.gameState, teamId: input.teamId }),
        ),
        exitValue,
        saleFactor: saleFactorBreakdown.saleFactor,
        marketValueAtExit,
        purchasePrice,
        profitLoss,
        morale: morale?.morale ?? null,
        moraleMood: morale?.moodLabel ?? null,
        moraleSmiley: morale?.smiley ?? null,
        moraleContractIntent: morale?.contractIntent ?? null,
        moraleSalaryModifier: morale?.moraleSalaryModifier ?? null,
        moraleRenewalRisk: morale?.moraleRenewalRisk ?? null,
        yearlySalarySchedule,
      };
    });

  const previewRows = (input.gameState.seasonState.contractNegotiationDrafts ?? [])
    .filter((draft) => draft.teamId === input.teamId)
    .map<TeamContractSeasonRow>((draft) => ({
      rowId: draft.draftId,
      playerId: draft.playerId,
      playerName: draft.playerName,
      status: "preview",
      roleTag: "preview",
      contractShape: draft.contractShape,
      contractLength: draft.contractLength,
      totalSalary: draft.totalSalary,
      buyoutCost: draft.buyoutCost,
      exitValue: null,
      saleFactor: null,
      marketValueAtExit: null,
      purchasePrice: null,
      profitLoss: null,
      morale: null,
      moraleMood: null,
      moraleSmiley: null,
      moraleContractIntent: null,
      moraleSalaryModifier: null,
      moraleRenewalRisk: null,
      yearlySalarySchedule: draft.yearlySalarySchedule,
    }));

  const rows = [...rosterRows, ...previewRows];
  const seasonCount = Math.max(5, ...rows.map((row) => row.yearlySalarySchedule.length));
  const seasonLabels = Array.from({ length: seasonCount }, (_, index) =>
    buildSeasonLabel(input.seasonLabelBase, index, input.gameState.season.id),
  );

  const totalsCommitted = seasonLabels.map((label, index) => ({
    label,
    salary: roundMoney(
      rosterRows.reduce((sum, row) => sum + (row.yearlySalarySchedule[index]?.salary ?? 0), 0),
      2,
    ),
  }));

  const totalsWithPreview = seasonLabels.map((label, index) => ({
    label,
    salary: roundMoney(
      rows.reduce((sum, row) => sum + (row.yearlySalarySchedule[index]?.salary ?? 0), 0),
      2,
    ),
  }));

  return {
    seasonLabels,
    rows,
    totalsCommitted,
    totalsWithPreview,
  };
}

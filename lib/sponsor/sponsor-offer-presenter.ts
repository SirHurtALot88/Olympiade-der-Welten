import type { GameState, SponsorOffer, SponsorOfferComponent, SponsorRarity } from "@/lib/data/olyDataTypes";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  readLockedRankPayout,
  SPONSOR_RANK_MILESTONES,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import {
  getTeamAxisRank,
  parseAxisTargetValue,
  type SponsorAxisKey,
} from "@/lib/sponsor/sponsor-special-objectives";
import { sponsorV2CurveByName, sponsorV2ProfileByName } from "@/lib/sponsor/sponsor-v2-model";
import { getSponsorV2Terms, sponsorV2GuaranteedLadder, sponsorV2Settle } from "@/lib/sponsor/sponsor-v2-offer-service";

export type SponsorChallengeDifficulty = "leicht" | "mittel" | "hart";

export type SponsorSpecialPresentation = {
  specialKey: string;
  headline: string;
  detail: string;
  axisKey: SponsorAxisKey | null;
  axisLabel: string | null;
  difficulty: SponsorChallengeDifficulty;
  difficultyLabel: string;
};

export type SponsorOfferPresentation = {
  isChallenge: boolean;
  isGolden: boolean;
  offerBadge: string | null;
  special: SponsorSpecialPresentation | null;
  /**
   * OLY_SPONSOR_V2: die Struktur des neuen Modells, fertig fuer die Karte. `null` = altes Angebot.
   *
   * WARUM EIGENE FELDER statt der alten mit neuen Zahlen zu fuellen: die V2-Karte hat Achsen, die
   * es vorher nicht gab — eine Klausel mit BONUS UND MALUS, eine garantierte Untergrenze und ein
   * Sonderziel, dessen Betrag von seiner Schwierigkeit abhaengt. Wer das in `rewardCash`-Kacheln
   * presst, zeigt Zahlen ohne die Bedingung, unter der sie gelten. Genau daran erkennt der Spieler
   * sonst nicht, dass er auch VERLIEREN kann.
   */
  v2: SponsorV2Presentation | null;
};

/** Anzeigefertige V2-Struktur. Alle Betraege sind die, aus denen das Settlement zahlt. */
export type SponsorV2Presentation = {
  curveName: string;
  curveNote: string;
  profileName: string;
  profileNote: string;
  expectedRank: number;
  /** Garantiert auf JEDEM Endrang — die Untergrenze der Karte. */
  guaranteedFloor: number;
  /** Auszahlung bei Titelgewinn, ohne Klausel und Sonderziel. */
  guaranteedTop: number;
  clause: {
    label: string;
    /** "Fatigue-Schnitt ≥ 23.4" — Praedikat mit der wirklich geprueften Schwelle. */
    thresholdText: string;
    bonus: number;
    malus: number;
    /** Erfuellungswahrscheinlichkeit, aus der Bonus und Malus abgeleitet sind. */
    probability: number;
  };
  goal: {
    label: string;
    payout: number;
    probability: number;
    /** "Leicht" | "Mittel" | "Hart" — abgeleitet aus der Erfolgswahrscheinlichkeit. */
    difficultyLabel: string;
  };
  /** Bestwert der Karte: Titel + Klausel erfuellt + Sonderziel erreicht. */
  maxPayout: number;
  /** Schlechtestwert: letzter Platz, Klausel verletzt, Ziel verfehlt. */
  minPayout: number;
};

const AXIS_LABELS: Record<SponsorAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

const DIFFICULTY_LABELS: Record<SponsorChallengeDifficulty, string> = {
  leicht: "Leicht",
  mittel: "Mittel",
  hart: "Hart",
};

function resolveAxisDifficulty(currentRank: number | null, targetTopRank: number): SponsorChallengeDifficulty {
  if (currentRank == null) {
    return "mittel";
  }
  const gap = currentRank - targetTopRank;
  if (gap <= 2) {
    return "leicht";
  }
  if (gap <= 4) {
    return "mittel";
  }
  return "hart";
}

function resolveSalaryDifficulty(currentSalary: number, targetSalary: number): SponsorChallengeDifficulty {
  if (currentSalary <= 0 || targetSalary <= 0) {
    return "mittel";
  }
  const reductionRatio = (currentSalary - targetSalary) / currentSalary;
  if (reductionRatio <= 0.05) {
    return "leicht";
  }
  if (reductionRatio <= 0.12) {
    return "mittel";
  }
  return "hart";
}

function resolveTransferDifficulty(target: number): SponsorChallengeDifficulty {
  if (target <= 4) {
    return "leicht";
  }
  if (target <= 6) {
    return "mittel";
  }
  return "hart";
}

/**
 * Presentation-Metadaten für die Teil-B-Bonusziele (14 Standard + 6 Golden aus sponsor-special-objectives.ts:
 * buildBonusObjectiveComponent / buildGoldenObjectiveComponent). Ohne diese Tabelle fielen alle Keys außer den
 * vier Legacy-Keys (axis_rank_top / salary_pressure_max / transfer_profit_min / discipline_top3_count) in den
 * irreführenden Fallback „Kader-Breite über Form-Farben" (FIX F5a). Jeder Eintrag beschreibt, was das Team tun
 * muss (aus label/stages abgeleitet), plus eine plausible Schwierigkeit. `salary_pressure_max` (auch von
 * salary_discipline genutzt) wird weiterhin von der bestehenden Salary-Branch abgedeckt.
 */
const BONUS_OBJECTIVE_META: Record<string, { detail: string; difficulty: SponsorChallengeDifficulty }> = {
  // Standard-Bonusziele
  underdog_story: { detail: "Die Saison deutlich über der Qualitäts-Erwartung beenden", difficulty: "mittel" },
  momentum_series: { detail: "Mehrere starke Spieltage im oberen Ligadrittel liefern (Gesamtzahl, nicht am Stück)", difficulty: "mittel" },
  discipline_dominance: { detail: "Großen Kaderanteil in den Disziplin-Spitzenrängen stellen", difficulty: "mittel" },
  // axis_ascension wird gesondert behandelt (axisKey/axisLabel aus targetValue).
  fan_cult_player: { detail: "Einen Spieler an die Spitze seiner Marktwert-Klasse bringen (MVS trainieren, FanFavorite-Trait hilft)", difficulty: "hart" },
  homegrown_elevation: { detail: "Ein Eigengewächs in die Bracket-Elite entwickeln", difficulty: "hart" },
  rival_humiliation: { detail: "Den Rivalen in der Abschlusstabelle hinter sich lassen", difficulty: "mittel" },
  fan_infrastructure: { detail: "Einkommens-Gebäude ausbauen (Fan-Shop / Arena)", difficulty: "leicht" },
  form_color_cover: { detail: "Kader-Vielfalt über mehrere verschiedene Spielerklassen abdecken", difficulty: "leicht" },
  solvency_series: { detail: "Zum Saisonende mit positiver Kasse dastehen", difficulty: "leicht" },
  transfer_trader: { detail: "Positive Netto-Bilanz in der Wechselperiode erzielen", difficulty: "mittel" },
  sustainability_architect: { detail: "Gebäude-Einnahmen decken deren Unterhalt (selbsttragend, Einkommensgebäude nötig)", difficulty: "mittel" },
  fatigue_management: { detail: "Den Kader bis zum Saisonende frisch halten (niedrige Match-Fatigue)", difficulty: "mittel" },
  // Neue Ziele (Fable B)
  market_value_growth: { detail: "Den Gesamt-Marktwert des Kaders über die Saison steigern", difficulty: "mittel" },
  discipline_specialist: { detail: "In EINER benannten Disziplin einen Team-Spitzenplatz erreichen", difficulty: "mittel" },
  beliebtheit_climb: { detail: "Die Beliebtheit des Teams steigern (Siege, Helden, Infrastruktur)", difficulty: "mittel" },
  captain_era: { detail: "Einen Captain ernennen und ihn in der Disziplin-Spitze abliefern lassen", difficulty: "mittel" },
  injury_prevention: { detail: "Wenige Verletzungen über die Saison (Rotation/Belastung steuern)", difficulty: "mittel" },
  debt_payoff: { detail: "Bestehende Kredite über die Saison abbauen/tilgen", difficulty: "mittel" },
  facility_condition: { detail: "Die gebauten Gebäude gut instand halten (Ø Zustand hoch)", difficulty: "leicht" },
  contract_stability: { detail: "Auslaufende Verträge bis Saisonende verlängern", difficulty: "leicht" },
  // Golden-Bonusziele
  golden_fairytale: { detail: "Die Saison weit über der Erwartung beenden (Märchensaison)", difficulty: "hart" },
  golden_crowd_favorites: { detail: "Mehrere Publikumslieblinge (Bracket-Helden) formen", difficulty: "hart" },
  golden_talent_forge: { detail: "Mehrere Spieler stark im Marktwert entwickeln", difficulty: "hart" },
  golden_discipline_monopoly: { detail: "Mehrere Spieler in die Disziplin-Spitze bringen", difficulty: "hart" },
  golden_title_shock: { detail: "Als schwaches Team ganz nach oben klettern", difficulty: "hart" },
  golden_rival_deluxe: { detail: "Den Rivalen klar distanzieren (großer Rang-Vorsprung)", difficulty: "hart" },
};

/** Leitet aus den (optionalen) Stufen einer Bonusziel-Komponente eine kompakte Leiter-Beschreibung ab. */
function describeStageLadder(component: SponsorOfferComponent): string | null {
  const stages = component.stages;
  if (!stages || stages.length === 0) {
    return null;
  }
  return stages.map((entry) => entry.label).join(" / ");
}

function buildSpecialPresentation(input: {
  component: SponsorOfferComponent;
  gameState?: GameState;
  teamId?: string;
}): SponsorSpecialPresentation {
  const specialKey = input.component.specialKey ?? "unknown";
  const base = {
    specialKey,
    headline: input.component.label,
    detail: "",
    axisKey: null as SponsorAxisKey | null,
    axisLabel: null as string | null,
    difficulty: "mittel" as SponsorChallengeDifficulty,
    difficultyLabel: DIFFICULTY_LABELS.mittel,
  };

  if (specialKey === "axis_rank_top") {
    const parsed = parseAxisTargetValue(input.component.targetValue);
    const axisKey = parsed?.axis ?? null;
    const targetTopRank = parsed?.topRank ?? 16;
    let currentRank: number | null = null;
    if (input.gameState && input.teamId && axisKey) {
      const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
      currentRank = getTeamAxisRank(rows, input.teamId, axisKey, input.gameState).rank;
    }
    const difficulty = resolveAxisDifficulty(currentRank, targetTopRank);
    return {
      ...base,
      axisKey,
      axisLabel: axisKey ? AXIS_LABELS[axisKey] : null,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail:
        currentRank != null
          ? `Aktuell #${currentRank} · Ziel Top ${targetTopRank}`
          : `Saisonziel: Top ${targetTopRank} in ${axisKey ? AXIS_LABELS[axisKey] : "Achse"}`,
    };
  }

  if (specialKey === "salary_pressure_max") {
    const target =
      typeof input.component.targetValue === "number"
        ? input.component.targetValue
        : Number(input.component.targetValue);
    let currentSalary = 0;
    if (input.gameState && input.teamId) {
      const row = buildTeamSeasonOverviewRows({ gameState: input.gameState }).find((entry) => entry.teamId === input.teamId);
      currentSalary = row?.salaryTotal ?? getTeamDisplaySalaryTotal(input.gameState, input.teamId);
    }
    const difficulty = resolveSalaryDifficulty(currentSalary, target);
    return {
      ...base,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail:
        currentSalary > 0
          ? `Aktuell ${formatNlNumber(currentSalary, 1)} C · Deckel ${Number.isFinite(target) ? formatNlNumber(target, 1) : "—"} C`
          : "Gehaltsdeckel einhalten",
    };
  }

  if (specialKey === "transfer_profit_min") {
    const target = typeof input.component.targetValue === "number" ? input.component.targetValue : 5;
    const difficulty = resolveTransferDifficulty(target);
    return {
      ...base,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail: `Netto-Transfergewinn mindestens ${target} C`,
    };
  }

  if (specialKey === "discipline_top3_count") {
    return {
      ...base,
      difficulty: "mittel",
      difficultyLabel: DIFFICULTY_LABELS.mittel,
      detail: "Disziplin-Ranglisten in der Saison",
    };
  }

  // Teil-B-Achsen-Aufstieg: eigene Branch, damit axisKey/axisLabel (aus targetValue) gesetzt sind.
  if (specialKey === "axis_ascension") {
    const parsed = parseAxisTargetValue(input.component.targetValue);
    const axisKey = parsed?.axis ?? null;
    const ladder = describeStageLadder(input.component);
    const difficulty: SponsorChallengeDifficulty = "mittel";
    const axisLabel = axisKey ? AXIS_LABELS[axisKey] : "Achse";
    return {
      ...base,
      axisKey,
      axisLabel: axisKey ? AXIS_LABELS[axisKey] : null,
      difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty],
      detail: ladder
        ? `${axisLabel} in der Saison verbessern · Stufen: ${ladder}`
        : `${axisLabel} in der Saison verbessern`,
    };
  }

  // Übrige Teil-B-Bonusziele (Standard + Golden) über die Metadaten-Tabelle; Detail um die Stufen-Leiter ergänzt.
  const meta = BONUS_OBJECTIVE_META[specialKey];
  if (meta) {
    const ladder = describeStageLadder(input.component);
    return {
      ...base,
      difficulty: meta.difficulty,
      difficultyLabel: DIFFICULTY_LABELS[meta.difficulty],
      detail: ladder ? `${meta.detail} · Stufen: ${ladder}` : meta.detail,
    };
  }

  // Generisch-korrekter Fallback (statt der irreführenden Kader-Breite-Meldung): wenn Stufen vorhanden sind,
  // aus ihnen ableiten, sonst neutral auf die Stufen verweisen.
  const ladder = describeStageLadder(input.component);
  return {
    ...base,
    difficulty: "mittel",
    difficultyLabel: DIFFICULTY_LABELS.mittel,
    detail: ladder ? `Saison-Bonusziel · Stufen: ${ladder}` : "Saison-Bonusziel — siehe Stufen",
  };
}

export function isChallengeSponsorOffer(offer: SponsorOffer): boolean {
  return offer.isChallengeOffer === true || offer.flavor.includes("Challenge-Sponsor");
}

export function isGoldenSponsorOffer(offer: SponsorOffer): boolean {
  return offer.isGolden === true;
}

export function buildSponsorOfferPresentation(input: {
  offer: SponsorOffer;
  gameState?: GameState;
  teamId?: string;
}): SponsorOfferPresentation {
  const isChallenge = isChallengeSponsorOffer(input.offer);
  const isGolden = isGoldenSponsorOffer(input.offer);
  const specialComponent = input.offer.components.find((component) => component.kind === "special") ?? null;
  // Golden koexistiert mit Challenge (kein CSS/Karten-Umbau hier — nur das Badge-Feld für die spätere UI).
  const badgeParts = [isGolden ? "Golden" : null, isChallenge ? "Challenge" : null].filter(
    (part): part is string => part != null,
  );
  return {
    isChallenge,
    isGolden,
    offerBadge: badgeParts.length > 0 ? badgeParts.join(" · ") : null,
    special: specialComponent
      ? buildSpecialPresentation({
          component: specialComponent,
          gameState: input.gameState,
          teamId: input.teamId ?? input.offer.teamId,
        })
      : null,
    v2: buildSponsorV2Presentation(input.offer),
  };
}

/**
 * Baut die V2-Anzeige aus den EINGEFRORENEN Konditionen des Angebots — nicht aus einer zweiten
 * Rechnung. `sponsorV2GuaranteedLadder` und `sponsorV2Settle` sind exakt die Funktionen, aus denen
 * auch das Settlement zahlt; die Karte kann deshalb keine anderen Zahlen zeigen als die gebuchten.
 */
export function buildSponsorV2Presentation(offer: SponsorOffer): SponsorV2Presentation | null {
  const terms = getSponsorV2Terms(offer);
  if (!terms) return null;
  const ladder = sponsorV2GuaranteedLadder(terms);
  const clauseP = terms.clauseBonus + terms.clauseMalus > 0
    ? terms.clauseMalus / (terms.clauseBonus + terms.clauseMalus)
    : 0.5;
  const dir = terms.clauseDirection === "up" ? "≥" : "≤";
  const curve = sponsorV2CurveByName(terms.curveName);
  const profile = sponsorV2ProfileByName(terms.profileName);
  return {
    curveName: terms.curveName,
    curveNote: curve.note,
    profileName: terms.profileName,
    profileNote: profile.note,
    expectedRank: terms.expectedRank,
    guaranteedFloor: roundOfferCash(ladder[31] ?? 0),
    guaranteedTop: roundOfferCash(ladder[0] ?? 0),
    clause: {
      label: terms.clauseLabel,
      thresholdText: terms.clauseThreshold != null
        ? `${dir} ${Math.round(terms.clauseThreshold * 10) / 10}`
        : "Schwelle wird am Saisonende gesetzt",
      bonus: roundOfferCash(terms.clauseBonus),
      malus: roundOfferCash(terms.clauseMalus),
      probability: Math.round(clauseP * 100) / 100,
    },
    goal: {
      label: terms.goalKey ?? "Sonderziel",
      payout: roundOfferCash(terms.goalPayout),
      probability: terms.goalProbability,
      difficultyLabel: terms.goalProbability >= 0.55 ? "Leicht" : terms.goalProbability >= 0.35 ? "Mittel" : "Hart",
    },
    maxPayout: roundOfferCash(sponsorV2Settle(terms, 1, true, 1)),
    minPayout: roundOfferCash(sponsorV2Settle(terms, 32, false, 0)),
  };
}

export function getSponsorComponentKindLabel(kind: SponsorOfferComponent["kind"]) {
  if (kind === "base") return "Basis";
  if (kind === "rank") return "Gewinnstufen";
  if (kind === "improvement") return "Tabellenziel";
  if (kind === "overperformance") return "Überperformance";
  return "Sonderziel";
}

/**
 * Seltenheitsgrad-Label je Sponsor-Stufe (1–5). Ersetzt die frühere
 * Stern-Anzeige (`★n`) durch eine benannte, farbcodierbare Rarität
 * (Farben je Stufe: `.nl-sponsor-rarity.is-r{1..5}` in globals.css).
 */
export const SPONSOR_RARITY_LABELS: Record<number, string> = {
  1: "Gewöhnlich",
  2: "Solide",
  3: "Selten",
  4: "Episch",
  5: "Legendär",
};

export function getSponsorRarityLabel(tier: number): string {
  return SPONSOR_RARITY_LABELS[tier] ?? `Stufe ${tier}`;
}

export type SponsorRankTierRow = {
  label: string;
  rankAt: number;
  absolutePayout: number;
};

function roundOfferCash(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Letzter Liga-Rang = garantierter Boden: hier ist keine Gewinnstufe freigeschaltet,
 * der Sponsor zahlt nur die Basis. Sichtbar gemacht, damit Teams auch den Worst-Case
 * (Tabellen-Letzter, Platz 32) auf der Leiter sehen — nicht nur ab „Top 28".
 */
export const SPONSOR_RANK_FLOOR_AT = 32;
export const SPONSOR_RANK_FLOOR_LABEL = `Platz ${SPONSOR_RANK_FLOOR_AT}`;

/** Absolute sponsor cash (basis + unlocked rank share) at each Gewinnstufe threshold. */
export function buildSponsorRankTierRows(input: {
  baseCash: number;
  /**
   * Audit #4: Die gelockte curveShape-Rang-Payout-Leiter (1..32) des Angebots — dieselbe, aus der das
   * Settlement zahlt (buildOfferRankPayoutLadderPreview). Ersetzt den früheren generischen
   * `rankCash`-Split nach Meilenstein-Gewichtung, der curveShape ignorierte und von der echten
   * Auszahlung abwich.
   */
  rankLadder: number[];
  /**
   * Zeigt die garantierte Boden-Stufe (letzter Rang, nur Basis) als unterste Sprosse an.
   * Opt-in, damit der bestehende Milestone-Contract (8 Stufen ab „Top 28") stabil bleibt.
   */
  includeFloorRung?: boolean;
}): SponsorRankTierRow[] {
  // Sockel = Payout am schlechtesten Rang (32); jede Gewinnstufe zeigt den Rang-Aufschlag darüber —
  // exakt `readLockedRankPayout(ladder, maxRank) − readLockedRankPayout(ladder, 32)`, wie das Settlement
  // (sponsor-settlement-service) den rankResidual berechnet.
  const floorPayout = readLockedRankPayout(input.rankLadder, 32);
  const milestoneRows = SPONSOR_RANK_MILESTONES.map((milestone) => {
    const rankPortion = Math.max(0, readLockedRankPayout(input.rankLadder, milestone.maxRank) - floorPayout);
    return {
      label: milestone.label,
      rankAt: milestone.maxRank,
      absolutePayout: roundOfferCash(input.baseCash + rankPortion),
    };
  });
  if (!input.includeFloorRung) {
    return milestoneRows;
  }
  // Boden-Stufe (garantierte Basis, keine Gewinnstufe) an den Anfang — die Leiter
  // ist aufsteigend nach Schwierigkeit (schlechtester Rang zuerst).
  return [
    { label: SPONSOR_RANK_FLOOR_LABEL, rankAt: SPONSOR_RANK_FLOOR_AT, absolutePayout: roundOfferCash(input.baseCash) },
    ...milestoneRows,
  ];
}

/** Sortiermodi der Liga-Sponsorenübersicht (#78). */
export type LeagueSponsorSort = "cash" | "sponsor" | "team" | "tier";

/**
 * Zeilenform der Liga-Sponsorenübersicht, soweit die Sortierung sie braucht.
 * Strukturell gehalten, damit die Komponente ihre reichere Zeile direkt
 * uebergeben kann, ohne sie hier zu duplizieren.
 */
export type LeagueSponsorSortRow = {
  teamName: string;
  sponsorName: string | null;
  rarity: SponsorRarity | null;
  projectedCash: number | null;
  isGolden: boolean;
};

/**
 * Sortiert die Liga-Sponsorenübersicht nach dem gewaehlten Modus.
 *
 * Der Modus bestimmt die Reihenfolge allein. Golden-Card-Sponsoren wurden
 * frueher unabhaengig vom Modus nach ganz oben gezogen; im Cash-Modus stand
 * dadurch ein Golden-Team mit kleinem Betrag zwischen den groessten Betraegen
 * und die Spalte war sichtbar nicht mehr absteigend. Golden bleibt an der Karte
 * (goldener Rahmen + Badge) erkennbar und dient nur noch als Gleichstand-
 * Kriterium; der Teamname haelt die Reihenfolge danach stabil.
 */
export function sortLeagueSponsorRows<T extends LeagueSponsorSortRow>(rows: readonly T[], sort: LeagueSponsorSort): T[] {
  const compareByMode = (left: T, right: T): number => {
    if (sort === "team") {
      return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
    }
    if (sort === "sponsor") {
      if (left.sponsorName == null && right.sponsorName == null) return 0;
      if (left.sponsorName == null) return 1;
      if (right.sponsorName == null) return -1;
      return left.sponsorName.localeCompare(right.sponsorName, "de", { sensitivity: "base" });
    }
    if (sort === "tier") {
      const leftOrder = left.rarity ? SPONSOR_RARITIES[left.rarity].order : -1;
      const rightOrder = right.rarity ? SPONSOR_RARITIES[right.rarity].order : -1;
      return rightOrder - leftOrder;
    }
    // "cash": voraussichtliche Auszahlung beim aktuellen Rang, absteigend.
    // Teams ohne Vertrag (null) sortieren ans Ende.
    return (right.projectedCash ?? -1) - (left.projectedCash ?? -1);
  };
  return [...rows].sort((left, right) => {
    const byMode = compareByMode(left, right);
    if (byMode !== 0) {
      return byMode;
    }
    if (left.isGolden !== right.isGolden) {
      return left.isGolden ? -1 : 1;
    }
    return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
  });
}

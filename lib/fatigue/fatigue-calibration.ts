export const FATIGUE_PERFORMANCE_CAP = 80;
export const FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT = 25;
export const INJURY_PERFORMANCE_MULTIPLIER = 0.5;
export const INJURY_PERFORMANCE_PENALTY_PERCENT = (1 - INJURY_PERFORMANCE_MULTIPLIER) * 100;
/**
 * fatigueMult at max fatigue (1 - FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT / 100) ×
 * injuryMult (INJURY_PERFORMANCE_MULTIPLIER) at max fatigue + same-day injury.
 */
export const MAX_COMBINED_FATIGUE_INJURY_MULTIPLIER = Number(
  ((1 - FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT / 100) * INJURY_PERFORMANCE_MULTIPLIER).toFixed(4),
);

/**
 * GEMELDET VON CHRIS: „momentan haben wir noch zu viele Verletzungen, die unpredictable sind. Ich
 * finde, bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 % sein."
 *
 * SCHUTZZONE BIS 25. Die Kurve begann bei 0 und stieg von der ersten Fatigue an — bei Fatigue 10 lag
 * das Risiko schon bei 1,67 %, bei 25 bei 4,17 %. Ein frischer Spieler konnte sich also verletzen,
 * ohne dass irgendetwas darauf hingedeutet hätte. Bis 25 ist das Risiko jetzt exakt 0.
 *
 * WARUM DER ANKER BEI 30 WEGGEFALLEN IST. Hätte man nur `{25, 0}` eingefügt und die 5 % bei 30
 * stehen lassen, müssten fünf Fatigue-Punkte den kompletten Anstieg von 0 auf 5 % tragen — 1 % pro
 * Punkt, sechsmal so steil wie vorher. Aus „unberechenbar von Anfang an" wäre „unberechenbar ab 25"
 * geworden. Die Strecke läuft deshalb glatt von 25 auf die unveränderten 10 % bei 50 (0,4 % pro
 * Punkt).
 *
 * WAS SICH DAMIT ÄNDERT: unter 25 gar kein Risiko mehr, dazwischen weniger als vorher (30: 2 statt
 * 5 %, 40: 6 statt 7,5 %). Ab 50 ist die Kurve unverändert — wer seine Spieler wirklich verheizt,
 * trägt dasselbe Risiko wie bisher. Genau das war der Zweck der Fatigue.
 */
/**
 * GEMELDET VON CHRIS (Nachschaerfung): „erst ab 50 fatigue soll es staerker steigen, bis dahin
 * soll es eher so bei 2-3% liegen bis 50".
 *
 * DER ANKER BEI 50 FAELLT VON 10 % AUF 3 %. Die Strecke 25→50 war mit 0,4 % pro Punkt viel zu
 * steil fuer eine Zone, die sich „noch harmlos" anfuehlen soll: bei 40 lagen schon 6 % an, bei
 * 50 volle 10 % — ein Viertel des Maximums, bevor die Erschoepfung ueberhaupt sichtbar wird.
 * Jetzt sind es 0,12 % pro Punkt: 30 → 0,6 %, 40 → 1,8 %, 50 → 3 %.
 *
 * DIE HOHEN ANKER BLEIBEN (80 → 25 %, 100 → 40 %). Das ist der Punkt der Aenderung: die Strecke
 * ab 50 traegt jetzt den ganzen Anstieg und wird dadurch von selbst steiler — 0,73 % pro Punkt
 * statt vorher 0,5 %. Wer seine Spieler verheizt, zahlt also MEHR als vorher, nicht weniger.
 * Genau das war gewuenscht: unten flach, oben teuer.
 *
 * WORAUF ZU ACHTEN IST: die Baender (`injuryRiskBands`) sind an FATIGUE-Grenzen gebunden, nicht
 * an Prozente. „mittleres Verletzungsrisiko" beginnt weiterhin bei Fatigue 50 — dort stehen jetzt
 * 3 % statt 10 %. Das Band beschreibt die Belastung, nicht die Wahrscheinlichkeit; wer die
 * Beschriftung an Prozente koppeln will, muss beides gemeinsam neu schneiden.
 */
export const FATIGUE_INJURY_RISK_ANCHORS = [
  { fatigue: 0, riskPercent: 0 },
  { fatigue: 25, riskPercent: 0 },
  { fatigue: 50, riskPercent: 3 },
  { fatigue: 80, riskPercent: 25 },
  { fatigue: 100, riskPercent: 40 },
] as const;

/**
 * Die Grenze bei 25 gilt auch für die Bänder — sonst sagt die Anzeige etwas anderes als die Rechnung.
 *
 * Vorher hieß 0–29 „kein Risiko", während bei 29 real 4,83 % anlagen. Das Spiel hat dem Spieler also
 * Sicherheit angezeigt und ihn dann verletzt; das ist der zweite Teil von Chris' „unpredictable",
 * und er lag nicht an der Kurve, sondern an der Beschriftung. „kein Risiko" heißt jetzt wörtlich
 * 0 %.
 */
export const injuryRiskBands = [
  { min: 0, max: 24, label: "none", uiLabel: "kein Risiko" },
  { min: 25, max: 49, label: "minimal", uiLabel: "minimales Verletzungsrisiko" },
  { min: 50, max: 69, label: "mittel", uiLabel: "mittleres Verletzungsrisiko" },
  { min: 70, max: 79, label: "stark", uiLabel: "starkes Verletzungsrisiko" },
  { min: 80, max: 100, label: "sehr_stark", uiLabel: "sehr starkes Verletzungsrisiko" },
] as const;

export type InjuryRiskBand = (typeof injuryRiskBands)[number] & {
  riskPercent: number;
};

function clampFatigue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getFatiguePerformancePenaltyPercent(fatigue: number | null | undefined) {
  const normalized = clampFatigue(fatigue);
  const uncapped = (normalized / FATIGUE_PERFORMANCE_CAP) * FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT;
  return roundValue(Math.min(FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT, uncapped), 2);
}

export function getFatiguePerformanceMultiplier(fatigue: number | null | undefined) {
  return roundValue(1 - getFatiguePerformancePenaltyPercent(fatigue) / 100, 4);
}

export function getInjuryPerformanceMultiplier(injuredThisMatchday: boolean) {
  return injuredThisMatchday ? INJURY_PERFORMANCE_MULTIPLIER : 1;
}

export function getCombinedFatigueInjuryPerformanceMultiplier(
  fatigue: number | null | undefined,
  injuredThisMatchday: boolean,
) {
  return roundValue(
    getFatiguePerformanceMultiplier(fatigue) * getInjuryPerformanceMultiplier(injuredThisMatchday),
    4,
  );
}

export function getInjuryRiskPercent(fatigue: number | null | undefined) {
  const normalized = clampFatigue(fatigue);
  for (let index = 0; index < FATIGUE_INJURY_RISK_ANCHORS.length - 1; index += 1) {
    const left = FATIGUE_INJURY_RISK_ANCHORS[index];
    const right = FATIGUE_INJURY_RISK_ANCHORS[index + 1];
    if (normalized < left.fatigue || normalized > right.fatigue) {
      continue;
    }
    if (right.fatigue === left.fatigue) {
      return right.riskPercent;
    }
    const progress = (normalized - left.fatigue) / (right.fatigue - left.fatigue);
    return roundValue(left.riskPercent + (right.riskPercent - left.riskPercent) * progress, 2);
  }
  return FATIGUE_INJURY_RISK_ANCHORS[FATIGUE_INJURY_RISK_ANCHORS.length - 1]?.riskPercent ?? 0;
}

export function getInjuryRiskBand(fatigue: number | null | undefined): InjuryRiskBand {
  const normalized = clampFatigue(fatigue);
  const band =
    injuryRiskBands.find((entry) => normalized >= entry.min && normalized <= entry.max) ?? injuryRiskBands[0];
  return {
    ...band,
    riskPercent: getInjuryRiskPercent(normalized),
  };
}

export function getFatigueRiskLevel(fatigue: number | null | undefined): "niedrig" | "mittel" | "hoch" {
  const normalized = clampFatigue(fatigue);
  if (normalized >= 65) {
    return "hoch";
  }
  if (normalized >= 40) {
    return "mittel";
  }
  return "niedrig";
}

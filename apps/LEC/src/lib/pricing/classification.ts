/**
 * Regelbasiertes Scoring (KONZEPT.md §8, Stufe 1) -- deterministisch, ohne LLM.
 * Klassifiziert einen Artikel anhand Velocity (30/90/365d), Momentum
 * (90d-Run-Rate vs. Lebenszeit) und DB II % in eine von sechs Klassen.
 */
export type ArticleClass =
  | "champion"
  | "solide"
  | "beobachten"
  | "faellt_ab"
  | "low_runner"
  | "ladenhueter";

export interface ClassificationInput {
  qty30d: number;
  qty90d: number;
  qty365d: number;
  qtyAllTime: number;
  dbIIPercent: number; // z. B. 0.3 = 30%
}

export interface ClassificationResult {
  articleClass: ArticleClass;
  label: string;
  reason: string;
}

const LABELS: Record<ArticleClass, string> = {
  champion: "Champion",
  solide: "Solide",
  beobachten: "Beobachten",
  faellt_ab: "Fällt ab",
  low_runner: "Low-Runner",
  ladenhueter: "Ladenhüter",
};

/**
 * @param input Kennzahlen des Artikels.
 */
export function classifyArticle(input: ClassificationInput): ClassificationResult {
  const { qty30d, qty90d, qty365d, qtyAllTime, dbIIPercent } = input;

  // Ladenhueter: Bestandshistorie vorhanden (schon mal verkauft), aber seit
  // 365 Tagen keine Bewegung mehr -- totes Kapital.
  if (qtyAllTime > 0 && qty365d === 0) {
    return {
      articleClass: "ladenhueter",
      label: LABELS.ladenhueter,
      reason: "0 Verkäufe in 365 Tagen trotz vorhandener Verkaufshistorie.",
    };
  }

  // Low-Runner: verkauft sich, aber mit klarem Verlust.
  if (dbIIPercent < 0) {
    return {
      articleClass: "low_runner",
      label: LABELS.low_runner,
      reason: `DB II ${(dbIIPercent * 100).toFixed(1)} % — Verlust je Verkauf.`,
    };
  }

  // Momentum: 90d-Run-Rate (auf 365 Tage hochgerechnet) vs. tatsaechliche 365d-Menge.
  // Deutlich unter der Run-Rate -> "frueher gut, jetzt schwach" (wie die Bundles, §2).
  const runRate365 = qty90d * (365 / 90);
  const momentumRatio = qty365d > 0 ? runRate365 / qty365d : qty90d > 0 ? 2 : 0;

  if (qty365d >= 4 && momentumRatio < 0.5 && qty30d === 0) {
    return {
      articleClass: "faellt_ab",
      label: LABELS.faellt_ab,
      reason: "Verkaufsgeschwindigkeit eingebrochen (90d-Run-Rate deutlich unter 365d-Schnitt).",
    };
  }

  if (dbIIPercent >= 0.25 && qty30d >= 2) {
    return {
      articleClass: "champion",
      label: LABELS.champion,
      reason: `Hohe Velocity (30T: ${qty30d}) bei guter Marge (DB II ${(dbIIPercent * 100).toFixed(0)}%).`,
    };
  }

  if (qty30d >= 1 || qty90d >= 2) {
    return {
      articleClass: "solide",
      label: LABELS.solide,
      reason: "Regelmäßige Verkäufe, positive Marge.",
    };
  }

  return {
    articleClass: "beobachten",
    label: LABELS.beobachten,
    reason: "Wenig Verkaufsdaten — weiter beobachten.",
  };
}

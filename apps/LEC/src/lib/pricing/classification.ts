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
  /** Aktueller Lagerbestand (Stk). Nur bei aktiven, per Artikelstamm-Import bekannten
   * Artikeln > 0 (siehe ArticleAggregate.stock/active) -- FIX 3 (KONZEPT §8): Chris'
   * eigene Definition "Bestand > 0, 0 Verkäufe in 365 T" ist NICHT an eine
   * Verkaufshistorie gebunden. Lagerware, die sich noch nie verkauft hat, ist genauso
   * Ladenhüter wie ein eingeschlafener Ex-Renner.
   */
  stock: number;
  /** true = weder ein realisierter EK noch ein aktueller Listen-EK bekannt (FIX 1,
   * KONZEPT §7.3/§8). Ohne jeden EK-Anhaltspunkt rechnet dbI = Umsatz − 0 eine
   * Phantom-Marge von ~100 % -- das darf NIE als "Champion" (Nachkauf-Signal)
   * durchgehen, sonst empfiehlt die App, Karten nachzukaufen, deren EK sie gar nicht
   * kennt (Chris: "wenn EK falsch, ist VK falsch").
   */
  ekMissing: boolean;
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
  const { qty30d, qty90d, qty365d, qtyAllTime, dbIIPercent, stock, ekMissing } = input;

  // Ladenhueter (FIX 3, KONZEPT §8 "Bestand > 0, 0 Verkäufe in 365 T"): entweder
  // Verkaufshistorie vorhanden, aber seit 365 Tagen tot -- ODER Lagerware, die sich
  // noch NIE verkauft hat (qtyAllTime === 0, aber stock > 0). Beides ist totes
  // Kapital und gehoert in dieselbe Klasse, nicht nach "beobachten".
  // Keine Kollision mit "faellt_ab"/"low_runner" weiter unten: qty365d === 0
  // impliziert (verschachtelte Fenster) qty30d === 0 und qty90d === 0, beide
  // Regeln unten verlangen aber qty365d > 0 bzw. positive juengere Verkaeufe.
  if (qty365d === 0 && (qtyAllTime > 0 || stock > 0)) {
    return {
      articleClass: "ladenhueter",
      label: LABELS.ladenhueter,
      reason:
        qtyAllTime > 0
          ? "0 Verkäufe in 365 Tagen trotz vorhandener Verkaufshistorie."
          : `0 Verkäufe in 365 Tagen bei ${stock} Stk Bestand -- noch nie verkauft.`,
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

  // FIX 1 (KONZEPT §7.3/§8): ohne jeden EK-Anhaltspunkt ist dbIIPercent eine
  // Phantom-Marge (dbI = Umsatz − 0 EK) -- so ein Artikel darf NIE "Champion"
  // werden (das wuerde eine "nachkaufen"-Empfehlung fuer einen Artikel erzeugen,
  // dessen Einkaufspreis komplett unbekannt ist). Faellt statt dessen i. d. R.
  // auf "solide" zurueck (siehe unten) und landet stattdessen in der
  // "EK pflegen"-Empfehlung (viewModel.ts).
  if (dbIIPercent >= 0.25 && qty30d >= 2 && !ekMissing) {
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

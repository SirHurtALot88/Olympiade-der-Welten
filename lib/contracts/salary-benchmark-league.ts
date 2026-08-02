/**
 * DIE GRUNDGESAMTHEIT FUER "GEHALT GEGEN UEBLICH" — die ganze Liga, nicht der eigene Kader.
 *
 * Warum ligaweit: die Schaetzung soll beantworten, was ein Spieler dieser Leistung AUF DIESEM
 * MARKT kostet. Nur den eigenen Kader zu befragen hiesse, sich am eigenen Gehaltsgefuege zu
 * messen — ein durchweg ueberzahlter Kader saehe dann normal aus, und ein sparsamer wuerde sich
 * selbst fuer teuer halten. Aus acht Vertraegen laesst sich ausserdem keine belastbare Gerade
 * ziehen (siehe SALARY_BENCHMARK_MIN_STICHPROBE).
 *
 * Die Trennung von `salary-benchmark.ts` ist Absicht: dort steht die reine Rechnung ohne
 * Spielmodell, hier das Einsammeln aus dem Spielstand. So bleibt die Rechnung ohne GameState
 * testbar.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import {
  buildBracketSalaryBenchmarks,
  buildSalaryBenchmark,
  type SalaryBenchmarkGroupResult,
  type SalaryBenchmarkGroupedSample,
  type SalaryBenchmarkModel,
} from "@/lib/contracts/salary-benchmark";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";

/**
 * Welches Leistungsmass in die Schaetzung geht. MVS ist die Vorgabe: er ist im Spiel
 * ausdruecklich der Wert fuer "ist der Spieler sein Gehalt wert" und faengt Rolle und
 * Einsatzkontext bereits mit ein. PPs bleibt als Alternative erreichbar, weil es die
 * nachrechenbare Groesse ist — wer die Kennzahl pruefen will, kommt mit MVS nicht weit.
 */
export type SalaryBenchmarkLeistungsmass = "mvs" | "pps";

export function leseLeistung(
  rating: PlayerRatingContractRow | null | undefined,
  mass: SalaryBenchmarkLeistungsmass,
): number | null {
  if (!rating) return null;
  const wert = mass === "pps" ? rating.ppsSeason : rating.mvs;
  return wert != null && Number.isFinite(wert) ? wert : null;
}

/**
 * Sammelt (Gehalt, Leistung) ueber ALLE Kader ein und schaetzt daraus die uebliche Gehaltskurve.
 * Spieler ohne Leistungswert fallen heraus statt als Null mitgezaehlt zu werden: eine fehlende
 * Saisonleistung ist keine schwache Saisonleistung, und als Null wuerde sie die Gerade nach
 * unten ziehen und alle uebrigen Spieler faelschlich teuer aussehen lassen.
 */
export function buildLeagueSalaryBenchmark(input: {
  gameState: Pick<GameState, "rosters">;
  ratingsById: Map<string, PlayerRatingContractRow>;
  mass?: SalaryBenchmarkLeistungsmass;
}): SalaryBenchmarkModel | null {
  return buildLeagueSalaryBenchmarks(input).gesamt;
}

/** Die Reihenfolge der Brackets, staerkstes zuerst — der Index ist die Naehe-Skala. */
const BRACKET_REIHENFOLGE: readonly MarketBracketTierLabel[] = [
  "Superstar",
  "Star",
  "Core",
  "Depth",
  "Backup",
  "Reserve",
];

export function bracketIndexFuer(label: MarketBracketTierLabel): number {
  const index = BRACKET_REIHENFOLGE.indexOf(label);
  return index >= 0 ? index : BRACKET_REIHENFOLGE.length - 1;
}

export type LeagueSalaryBenchmarks = {
  /** Eine Kurve ueber die ganze Liga — Rueckfall, wenn ein Bracket gar nichts hergibt. */
  gesamt: SalaryBenchmarkModel | null;
  /** Je Bracket eine eigene Kurve, bei duenner Besetzung um Nachbar-Brackets erweitert. */
  jeBracket: Map<number, SalaryBenchmarkGroupResult>;
  /** Bracket-Zuordnung je Spieler, damit die Aufrufer sie nicht neu bestimmen muessen. */
  bracketByPlayerId: Map<string, number>;
};

/**
 * Sammelt (Gehalt, Leistung, Laufzeit, Bracket) ueber ALLE Kader ein.
 *
 * Verglichen wird innerhalb des Marktwert-Brackets statt gegen die ganze Liga: der Zusammenhang
 * von Leistung und Gehalt ist nach oben steiler, eine einzige Gerade liesse deshalb die Besten
 * ueberbezahlt aussehen. Reicht ein Bracket nicht, werden die Nachbarn dazugenommen (siehe
 * `buildBracketSalaryBenchmark`).
 *
 * Spieler ohne Leistungswert fallen heraus statt als Null mitgezaehlt zu werden: eine fehlende
 * Saisonleistung ist keine schwache Saisonleistung, und als Null wuerde sie die Kurve nach unten
 * ziehen und alle uebrigen Spieler faelschlich teuer aussehen lassen.
 */
export function buildLeagueSalaryBenchmarks(input: {
  gameState: Pick<GameState, "rosters">;
  ratingsById: Map<string, PlayerRatingContractRow>;
  mass?: SalaryBenchmarkLeistungsmass;
}): LeagueSalaryBenchmarks {
  const mass = input.mass ?? "mvs";
  const rosters = input.gameState.rosters ?? [];
  // Die Bracket-Grenzen kommen aus den Marktwerten der Liga selbst — dieselbe Einteilung, die
  // auch der Transfermarkt benutzt, damit "Star" hier und dort dasselbe heisst.
  const brackets = buildLeagueMarketBrackets(
    rosters.map((eintrag) => input.ratingsById.get(eintrag.playerId)?.marketValue ?? null),
  );

  const stichprobe: SalaryBenchmarkGroupedSample[] = [];
  const bracketByPlayerId = new Map<string, number>();
  for (const eintrag of rosters) {
    const rating = input.ratingsById.get(eintrag.playerId);
    const bracketIndex = bracketIndexFuer(classifyMarketBracket(rating?.marketValue ?? null, brackets));
    bracketByPlayerId.set(eintrag.playerId, bracketIndex);

    const salary = eintrag.salary;
    if (!Number.isFinite(salary) || salary <= 0) continue;
    const leistung = leseLeistung(rating, mass);
    if (leistung == null) continue;
    // Die Restlaufzeit kommt mit: lange Vertraege sind oft besser dotiert, und ohne diese Spalte
    // hielte das Modell die langfristig gebundenen Spieler faelschlich fuer ueberbezahlt.
    const laufzeit = Number.isFinite(eintrag.contractLength) ? eintrag.contractLength : null;
    stichprobe.push({ salary, leistung, laufzeit, bracketIndex });
  }

  return {
    gesamt: buildSalaryBenchmark(stichprobe),
    jeBracket: buildBracketSalaryBenchmarks(stichprobe),
    bracketByPlayerId,
  };
}

/**
 * Die passende Kurve fuer einen Spieler: erst sein Bracket (ggf. um Nachbarn erweitert), sonst
 * die Gesamtliga. Lieber ein breiterer Vergleich als gar keine Aussage.
 */
export function modellFuerSpieler(
  benchmarks: LeagueSalaryBenchmarks,
  playerId: string,
): SalaryBenchmarkModel | null {
  const bracketIndex = benchmarks.bracketByPlayerId.get(playerId);
  if (bracketIndex != null) {
    const gruppe = benchmarks.jeBracket.get(bracketIndex);
    if (gruppe) return gruppe.modell;
  }
  return benchmarks.gesamt;
}

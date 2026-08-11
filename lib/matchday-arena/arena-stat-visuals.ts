/**
 * ARENA-STAT-VISUALS — Einfaerbung und Noten fuer Kernwerte. Keine Buchung, keine Rechnung,
 * die in den Spielstand geht.
 *
 * Hier stand bis zum Audit vom 11.08.2026 eine zweite Haelfte: `ArenaRankTier`,
 * `getArenaRankPercentile`, `getArenaRankTierFromPercentile`, `getArenaRankTier`,
 * `resolveArenaRankPoolSize`, `buildArenaRankPoolSizes`, `resolveArenaEntryRankPools`,
 * `getArenaFocusEntryCardTier` samt `ARENA_RANK_TIER_TOP_SHARE`. Ueber alle
 * .ts/.tsx/.js/.mjs/.json des Repos nachgezaehlt: 0 Aufrufer ausserhalb der eigenen
 * Testdatei. Geloescht statt konserviert — toter Code mit eigener Rangrechnung ist eine
 * Einladung, die Raenge ein zweites Mal (und anders) zu rechnen als die Engine.
 *
 * Lebendig sind nur noch die beiden Funktionen unten; ihre Aufrufer sind
 * `components/foundation/velo-ui/VeloStatOrbitChip.tsx` und `VeloAxisRail.tsx`.
 */

export type ArenaAxisValueTier = "high" | "good" | "mid" | "low" | "muted";

/**
 * MEASURED per-axis core-stat distribution (POW/SPE/MEN/SOC pooled) from the real
 * catalog data/generated/oly-player-stats.json (n=2984 players, 11936 axis values):
 *   p5≈19  p10≈24  p25≈32  p50≈42.5  p75≈52  p90≈62  p95≈68  p99≈80  max≈98  mean≈42.6
 * Both the color tier and the letter grade below are anchored to THIS distribution
 * so a median value reads neutral, a clearly-above-average one reads strong, and
 * only genuinely low (bottom decile) reads poor/red — matching the CA/PO star curve
 * in player-potential-service.ts. The old thresholds assumed a 35–99 spread, which
 * made median (~42) read "below average / F" and only the top few percent read well.
 */

/**
 * Color tier for a core-axis value (drives is-tier-* classes). Anchored to the
 * measured per-axis distribution above:
 *   high ≥58 (~p87, clearly strong / green) · good ≥46 (~p60, above average) ·
 *   mid ≥30 (~p23, neutral/amber — contains the median ~42.5) · low <30 (red).
 * So a 70 reads strong green, ~50 reads good (never red), the median reads neutral.
 */
export function getArenaAxisValueTier(value: number | null | undefined): ArenaAxisValueTier {
  if (value == null || !Number.isFinite(value)) {
    return "muted";
  }
  if (value >= 58) return "high";
  if (value >= 46) return "good";
  if (value >= 30) return "mid";
  return "low";
}

/** Absolute letter grade for core stats (POW/SPE/MEN/SOC), anchored to the MEASURED
 * per-axis distribution above (median ~42.5 → C, not F):
 * S  = 64+ (~p92, star-level / "richtig stark")
 * A  = 55+ (~p83, strong)
 * B  = 45+ (~p57, clearly above average)
 * C  = 30+ (~p23, around/below the median)
 * D  = 20+ (~p6, poor)
 * F  = below 20 (bottom ~5%, genuinely low)
 */
export type CoreStatGrade = "S" | "A" | "B" | "C" | "D" | "F";

export function getCoreStatGrade(value: number | null | undefined): CoreStatGrade {
  if (value == null || !Number.isFinite(value)) return "F";
  if (value >= 64) return "S";
  if (value >= 55) return "A";
  if (value >= 45) return "B";
  if (value >= 30) return "C";
  if (value >= 20) return "D";
  return "F";
}

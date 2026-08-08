/**
 * Velo UI catalog — when to use which component on Foundation surfaces:
 *
 * - VeloStatOrbitRow: POW/SPE/MEN/SOC on player/team cards (Teams, Season cards, Lineup deck)
 * - VeloAxisRail: POW/SPE/MEN/SOC when the four values need to be COMPARED — meter per axis,
 *   optional reference mark (e.g. squad average). Scouting/Transfermarkt rather than card overlays.
 * - VeloImpactStrip: phased metrics (Base / Form / Mutator / Final, XP / Fatigue, Rank window)
 * - VeloSplitMeter: EINE Groesse in zwei Teile zerlegt (erlassen vs. zahlbar) — das Verhaeltnis
 *   soll lesbar sein, nicht nur die zwei Zahlen. Ab drei Teilen stattdessen VeloImpactStrip.
 * - VeloDivergingBar: ZWEI gegenlaeufige Groessen um eine Mittelachse (Ausgaben vs. Einnahmen) —
 *   mit `max` als gemeinsamer Skala werden mehrere Zeilen (Team-Boards) direkt vergleichbar.
 * - VeloIntensityRail: Push / Normal / Conserve selection rails (Training, filters)
 * - VeloAttributeFocusTags: training weight gain/loss tags
 * - VeloStarRating / VeloPotentialStars: class/potential display
 *
 * Prefer `.velo-*` classes; feature aliases (e.g. `training-v2-rider-orbit`) stay for legacy CSS.
 * Avoid parallel chip styles (`arena-v2-axis-chip`, custom breakdown spans) — use components here.
 */
export { VeloAxisRail, type VeloAxisRailEntry, type VeloAxisRailProps } from "@/components/foundation/velo-ui/VeloAxisRail";
export { VeloDivergingBar, type VeloDivergingBarProps } from "@/components/foundation/velo-ui/VeloDivergingBar";
export { VeloScoutMetric } from "@/components/foundation/velo-ui/VeloScoutMetric";
export { VeloAttributeFocusTags, type VeloAttributeFocusEntry } from "@/components/foundation/velo-ui/VeloAttributeFocusTags";
export { buildTrainingImpactItems, VeloImpactStrip, type VeloImpactItem } from "@/components/foundation/velo-ui/VeloImpactStrip";
export { buildTrainingModeSegments, VeloIntensityRail, type VeloIntensitySegment } from "@/components/foundation/velo-ui/VeloIntensityRail";
export { NlAbilityStars, type NlAbilityStarsProps } from "@/components/foundation/velo-ui/NlAbilityStars";
export { VeloPotentialStars } from "@/components/foundation/velo-ui/VeloPotentialStars";
export { VeloRangeBar, type VeloRangeBarProps } from "@/components/foundation/velo-ui/VeloRangeBar";
export { VeloSplitMeter, type VeloSplitMeterProps } from "@/components/foundation/velo-ui/VeloSplitMeter";
export { VeloStarRating } from "@/components/foundation/velo-ui/VeloStarRating";
export { VeloStatOrbitChip, VeloStatOrbitRow, type VeloAxisKey } from "@/components/foundation/velo-ui/VeloStatOrbitChip";

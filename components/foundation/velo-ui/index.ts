/**
 * Velo UI catalog — when to use which component on Foundation surfaces:
 *
 * - VeloStatOrbitRow: POW/SPE/MEN/SOC on player/team cards (Teams, Season cards, Lineup deck)
 * - VeloImpactStrip: phased metrics (Base / Form / Mutator / Final, XP / Fatigue, Rank window)
 * - VeloIntensityRail: Push / Normal / Conserve selection rails (Training, filters)
 * - VeloAttributeFocusTags: training weight gain/loss tags
 * - VeloStarRating / VeloPotentialStars: class/potential display
 *
 * Prefer `.velo-*` classes; feature aliases (e.g. `training-v2-rider-orbit`) stay for legacy CSS.
 * Avoid parallel chip styles (`arena-v2-axis-chip`, custom breakdown spans) — use components here.
 */
export { VeloScoutMetric } from "@/components/foundation/velo-ui/VeloScoutMetric";
export { formatTrainingAttributeWeight, formatVeloNumber, formatVeloSignedNumber, formatVeloSignedPercent } from "@/components/foundation/velo-ui/formatters";
export { VeloAttributeFocusTags, type VeloAttributeFocusEntry } from "@/components/foundation/velo-ui/VeloAttributeFocusTags";
export { buildTrainingImpactItems, VeloImpactStrip, type VeloImpactItem } from "@/components/foundation/velo-ui/VeloImpactStrip";
export { buildTrainingModeSegments, VeloIntensityRail, type VeloIntensitySegment } from "@/components/foundation/velo-ui/VeloIntensityRail";
export { VeloPotentialStars } from "@/components/foundation/velo-ui/VeloPotentialStars";
export { VeloStarRating } from "@/components/foundation/velo-ui/VeloStarRating";
export { VeloStatOrbitChip, VeloStatOrbitRow, type VeloAxisKey } from "@/components/foundation/velo-ui/VeloStatOrbitChip";

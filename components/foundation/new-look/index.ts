/**
 * "Neuer Look" Komponenten-Kit — flag-gated Design-System-Grundlage.
 *
 * Alle Styles leben in `app/globals.css` unterhalb von `.is-new-look`
 * (Tokens `--nl-*`, Komponenten `.nl-*`). Die Klasse `is-new-look` wird
 * in `app/foundation/FoundationShellRouterBody.tsx` nur gesetzt, wenn
 * der Runtime-Flag (`useNewLook`) aktiv ist — ohne Flag ändert sich nichts.
 *
 * Katalog:
 * - StatChip / StatChipRow: Stat-Vokabular (OVR/PPs/MVS/MW), klickbar = Portal
 * - NlCard: Standard-Panel-Oberfläche mit eyebrow/title/actions
 * - NlSubTabs: horizontale Sub-Tab-Leiste oben (linke Nav + Top-Sub-Tabs)
 * - NlDeltaChip: vorzeichenbehaftetes Delta mit ▲/▼
 * - NlProgressBar: beschriftete Fortschritts-/Wear-Bar mit Schwellen-Ton
 * - NlGauge: kleines Bogen-Gauge (CA→PO, Kommerz-Rating, …)
 * - NlSparkline / NlBarChart / NlRadar: handgerollte SVG-Chart-Primitives
 * - NlMedalBadge: Gold/Silber/Bronze-Abzeichen
 * - NlRankingDrawer: leichtes Rangliste-Panel (#37) — öffnet sich beim Klick
 *   auf einen KPI-Chip (OVR/PPs/MVS/Punkte/MW/…) statt einer vollen
 *   Seiten-Navigation; Zeilen kommen aus der bereits vorhandenen Rangliste
 *   der jeweiligen Oberfläche.
 * - useCountUp / NlCountUpValue: Zähler-Animation für Hero-/KPI-Zahlen
 *   (respektiert prefers-reduced-motion); dazu die CSS-only Reveal-Klasse
 *   `.nl-reveal` (+ `--nl-reveal-i` Stagger-Index) für gestaffelten Karten-Einstieg.
 */
export { StatChip, StatChipRow, type StatChipProps, type StatChipRowProps } from "@/components/foundation/new-look/StatChip";
export { NlCard, type NlCardProps } from "@/components/foundation/new-look/NlCard";
export { NlSubTabs, type NlSubTabsProps, type NlSubTabItem } from "@/components/foundation/new-look/NlSubTabs";
export { NlDeltaChip, type NlDeltaChipProps } from "@/components/foundation/new-look/NlDeltaChip";
export { NlProgressBar, type NlProgressBarProps } from "@/components/foundation/new-look/NlProgressBar";
export { NlGauge, type NlGaugeProps } from "@/components/foundation/new-look/NlGauge";
export { NlSparkline, type NlSparklineProps } from "@/components/foundation/new-look/NlSparkline";
export { NlBarChart, type NlBarChartProps, type NlBarChartBar } from "@/components/foundation/new-look/NlBarChart";
export { NlRadar, type NlRadarProps, type NlRadarAxis } from "@/components/foundation/new-look/NlRadar";
export { NlMedalBadge, type NlMedalBadgeProps, type NlMedalKind } from "@/components/foundation/new-look/NlMedalBadge";
export {
  NlRankingDrawer,
  type NlRankingDrawerProps,
  type NlRankingDrawerRow,
} from "@/components/foundation/new-look/NlRankingDrawer";
export {
  useCountUp,
  NlCountUpValue,
  type UseCountUpOptions,
  type NlCountUpValueProps,
} from "@/components/foundation/new-look/useCountUp";
export {
  formatNlNumber,
  NL_AXIS_LABELS,
  NL_TONE_VAR,
  nlToneClass,
  type NlAxisKey,
  type NlTone,
} from "@/components/foundation/new-look/nl-tones";
export { formatNlMoney } from "@/components/foundation/new-look/nl-format";

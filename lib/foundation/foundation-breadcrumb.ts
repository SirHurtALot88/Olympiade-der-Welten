import { FOUNDATION_NAV_GROUPS, isFoundationNavViewActive } from "@/lib/foundation/foundation-nav-config";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type FoundationBreadcrumb = {
  /** Übergeordnete Nav-Gruppe, z.B. "Spieltag". */
  group: string;
  /** Aktive Ansicht innerhalb der Gruppe, z.B. "Arena". */
  view: string;
};

/**
 * Leitet Gruppen- und Ansichts-Titel für die aktive View aus der bestehenden
 * Nav-Konfiguration ab (keine erfundenen Labels). Nur der "Neuer Look" rendert
 * daraus eine Breadcrumb-/Titel-Zeile.
 */
/** Ansichten, die nicht in der Nav stehen, aber einen Ort im Band brauchen (sonst bleibt die Bandmitte links leer). */
const ZUSATZ_ANSICHTEN: Partial<Record<FoundationViewId, FoundationBreadcrumb>> = {
  nachDemSpieltag: { group: "Spieltag", view: "Nach dem Spieltag" },
};

export function getFoundationBreadcrumb(activeView: FoundationViewId): FoundationBreadcrumb | null {
  for (const group of FOUNDATION_NAV_GROUPS) {
    for (const item of group.items) {
      if (isFoundationNavViewActive(activeView, item.id)) {
        return { group: group.label, view: item.label };
      }
    }
  }
  return ZUSATZ_ANSICHTEN[activeView] ?? null;
}

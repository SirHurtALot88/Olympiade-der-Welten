export type InboxV2Item = {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  status?: "open" | "done" | "dismissed";
  choices?: Array<{ id: string; label: string; detail: string }>;
};

export type InboxV2Mode = "decisions" | "chronicle";

export type InboxV2ClientProps = {
  items: InboxV2Item[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  /**
   * Optionaler Deep-Link: oeffnet den Ziel-Screen des Items (targetView).
   * Ist er gesetzt, springt ein Klick auf die Karte direkt zum Vorgang statt
   * ihn nur auszuwaehlen. Ohne Handler bleibt es beim reinen Auswaehlen.
   */
  onOpenItem?: (itemId: string) => void;
  teamLabel?: string | null;
  openCount?: number;
  criticalCount?: number;
  mode?: InboxV2Mode;
  /**
   * Optionaler Mode-Umschalter (additiv, aktuell von keinem Mount gesetzt).
   * Nur die "Neuer Look"-Ansicht rendert dafür eine echte Umschalt-Leiste;
   * ohne Handler bleibt der Modus rein extern gesteuert.
   */
  onModeChange?: (mode: InboxV2Mode) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (value: string) => void;
  includeDone?: boolean;
  onIncludeDoneChange?: (value: boolean) => void;
  includeDismissed?: boolean;
  onIncludeDismissedChange?: (value: boolean) => void;
  onRunChoice?: (itemId: string, choiceId: string) => void;
  onMarkDone?: (itemId: string) => void;
  onDismiss?: (itemId: string) => void;
  hideCategoryFilters?: boolean;
};

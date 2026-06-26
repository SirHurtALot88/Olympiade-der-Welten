export type InboxV2Item = {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  status?: "open" | "done" | "dismissed";
  choices?: Array<{ id: string; label: string; detail: string }>;
};

export type InboxV2ClientProps = {
  items: InboxV2Item[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  teamLabel?: string | null;
  openCount?: number;
  criticalCount?: number;
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

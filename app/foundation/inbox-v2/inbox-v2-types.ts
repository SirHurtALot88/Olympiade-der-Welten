export type InboxV2Item = {
  id: string;
  category: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  choices?: Array<{ id: string; label: string; detail: string }>;
};

export type InboxV2ClientProps = {
  items: InboxV2Item[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onOpenClassicInbox: () => void;
  onOpenHomeV2: () => void;
  onRunChoice?: (itemId: string, choiceId: string) => void;
};

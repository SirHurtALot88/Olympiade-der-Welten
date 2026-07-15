"use client";

import FoundationDiszisNewLook from "@/app/foundation/ranks-v2/FoundationDiszisNewLook";
import FoundationDiszisPanel, { type FoundationDiszisPanelProps } from "@/app/foundation/ranks-v2/FoundationDiszisPanel";
import { useNewLook } from "@/lib/ui/new-look-preference";

export type FoundationDiszisHostProps = FoundationDiszisPanelProps;

export default function FoundationDiszisHost(props: FoundationDiszisHostProps) {
  // "Neuer Look" Flag-Gate (additiv): Flag an => neue Ansicht mit denselben
  // Props; Flag aus => bestehende Tabelle unverändert. Idiom identisch zu
  // FoundationRanksPanel.
  const [newLook] = useNewLook();
  if (newLook) return <FoundationDiszisNewLook {...props} />;

  return <FoundationDiszisPanel {...props} />;
}

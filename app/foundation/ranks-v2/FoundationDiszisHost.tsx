"use client";

import FoundationDiszisPanel, { type FoundationDiszisPanelProps } from "@/app/foundation/ranks-v2/FoundationDiszisPanel";

export type FoundationDiszisHostProps = FoundationDiszisPanelProps;

export default function FoundationDiszisHost(props: FoundationDiszisHostProps) {
  return <FoundationDiszisPanel {...props} />;
}

"use client";

import FoundationDiszisNewLook from "@/app/foundation/ranks-v2/FoundationDiszisNewLook";
import type { FoundationDiszisPanelProps } from "@/app/foundation/ranks-v2/FoundationDiszisPanel";

export type FoundationDiszisHostProps = FoundationDiszisPanelProps;

export default function FoundationDiszisHost(props: FoundationDiszisHostProps) {
  return <FoundationDiszisNewLook {...props} />;
}

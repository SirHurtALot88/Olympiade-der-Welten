"use client";

import FoundationRanksPanel, { type FoundationRanksPanelProps } from "@/app/foundation/ranks-v2/FoundationRanksPanel";

export type FoundationRanksHostProps = FoundationRanksPanelProps;

export default function FoundationRanksHost(props: FoundationRanksHostProps) {
  return <FoundationRanksPanel {...props} />;
}

"use client";

import HistorieArchiv from "@/components/foundation/historie/HistorieArchiv";
import type { HistorieHostBasis } from "@/components/foundation/historie/HistorieArchiv";

export type FoundationSeasonArchiveHostProps = HistorieHostBasis;

/** Reiter „Saison-Archiv" der Historie (Mockup 18.11.). */
export default function FoundationSeasonArchiveHost(props: FoundationSeasonArchiveHostProps) {
  return <HistorieArchiv {...props} />;
}

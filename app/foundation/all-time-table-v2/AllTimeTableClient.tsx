"use client";

import AllTimeTableNewLook from "@/app/foundation/all-time-table-v2/AllTimeTableNewLook";
import type { AllTimeTableModel } from "@/lib/foundation/all-time-table";

export interface AllTimeTableClientProps {
  model: AllTimeTableModel | null;
  selectedTeamId: string | null;
  seasonLabel: string;
  onOpenTeam: (teamId: string) => void;
}

export default function AllTimeTableClient(props: AllTimeTableClientProps) {
  return <AllTimeTableNewLook {...props} />;
}

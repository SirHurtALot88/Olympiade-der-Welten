"use client";

import type { ScoutingHubV2ClientProps } from "@/app/foundation/scouting-center-v2/scouting-center-v2-types";
import ScoutingCenterV2NewLook from "@/app/foundation/scouting-center-v2/ScoutingCenterV2NewLook";

export default function ScoutingCenterV2Client(props: ScoutingHubV2ClientProps) {
  return <ScoutingCenterV2NewLook {...props} />;
}

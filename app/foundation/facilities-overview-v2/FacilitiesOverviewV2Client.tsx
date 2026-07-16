"use client";

import FacilitiesOverviewV2NewLook from "@/app/foundation/facilities-overview-v2/FacilitiesOverviewV2NewLook";
import type { FacilitiesOverviewV2ClientProps } from "@/app/foundation/facilities-overview-v2/facilities-overview-v2-types";

export default function FacilitiesOverviewV2Client(props: FacilitiesOverviewV2ClientProps) {
  return <FacilitiesOverviewV2NewLook {...props} />;
}

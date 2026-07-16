"use client";

import FacilitiesV2NewLook from "@/app/foundation/facilities-v2/FacilitiesV2NewLook";
import type { FacilitiesV2ClientProps } from "@/app/foundation/facilities-v2/facilities-v2-types";

export default function FacilitiesV2Client(props: FacilitiesV2ClientProps) {
  return <FacilitiesV2NewLook {...props} />;
}

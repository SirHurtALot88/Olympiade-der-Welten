"use client";

import HomeV2NewLook from "@/app/foundation/home-v2/HomeV2NewLook";
import type { HomeV2ClientProps } from "@/app/foundation/home-v2/home-v2-types";

export default function HomeV2Client(props: HomeV2ClientProps) {
  return <HomeV2NewLook {...props} />;
}

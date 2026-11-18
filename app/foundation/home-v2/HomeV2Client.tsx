"use client";

import HomeModern from "@/app/foundation/home-v2/HomeModern";
import type { HomeV2ClientProps } from "@/app/foundation/home-v2/home-v2-types";

export default function HomeV2Client(props: HomeV2ClientProps) {
  return <HomeModern {...props} />;
}

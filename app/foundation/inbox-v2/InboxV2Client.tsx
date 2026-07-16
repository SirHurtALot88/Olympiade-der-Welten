"use client";

import InboxV2NewLook from "@/app/foundation/inbox-v2/InboxV2NewLook";
import type { InboxV2ClientProps } from "@/app/foundation/inbox-v2/inbox-v2-types";

export default function InboxV2Client(props: InboxV2ClientProps) {
  return <InboxV2NewLook {...props} />;
}

"use client";

import AllTimeTableClient, { type AllTimeTableClientProps } from "@/app/foundation/all-time-table-v2/AllTimeTableClient";

export type FoundationAllTimeTableHostProps = AllTimeTableClientProps;

export default function FoundationAllTimeTableHost(props: FoundationAllTimeTableHostProps) {
  return <AllTimeTableClient {...props} />;
}

"use client";

import RanksModern, { type RanksModernProps } from "@/app/foundation/ranks-v2/RanksModern";

export type FoundationRanksHostProps = RanksModernProps;

export default function FoundationRanksHost(props: FoundationRanksHostProps) {
  return <RanksModern {...props} />;
}

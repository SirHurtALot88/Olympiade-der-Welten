"use client";

import LeadersModern, { type LeadersModernProps } from "@/app/foundation/league-leaders-v2/LeadersModern";

export type FoundationLeagueLeadersHostProps = LeadersModernProps;

export default function FoundationLeagueLeadersHost(props: FoundationLeagueLeadersHostProps) {
  return <LeadersModern {...props} />;
}

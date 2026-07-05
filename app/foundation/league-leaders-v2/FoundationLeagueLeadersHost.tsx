"use client";

import LeagueLeadersClient, { type LeagueLeadersClientProps } from "@/app/foundation/league-leaders-v2/LeagueLeadersClient";

export type FoundationLeagueLeadersHostProps = LeagueLeadersClientProps;

export default function FoundationLeagueLeadersHost(props: FoundationLeagueLeadersHostProps) {
  return <LeagueLeadersClient {...props} />;
}

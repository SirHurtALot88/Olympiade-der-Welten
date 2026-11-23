"use client";

/** Reiter „Rekorde & Legenden“ der Historie: Rekorde, Legenden, All-Time und Erfolge über mehrere Saisons (Chris, 23.11.). */
import LeagueLeadersNewLook from "@/app/foundation/league-leaders-v2/LeagueLeadersNewLook";
import type { LeadersModernProps } from "@/app/foundation/league-leaders-v2/LeadersModern";

export default function FoundationRecordsLegendsHost(props: LeadersModernProps) {
  return (
    <div data-testid="leaders-historie">
      <LeagueLeadersNewLook {...props} nurMehrsaison />
    </div>
  );
}

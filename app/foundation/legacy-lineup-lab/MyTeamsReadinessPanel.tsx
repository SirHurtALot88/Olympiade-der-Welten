"use client";

import type { MyTeamsMatchdayReadiness } from "@/lib/foundation/matchday-human-readiness";

/**
 * SAMMEL-ANSICHT „MEINE TEAMS · SPIELTAG X · FERTIG/OFFEN" (Befund B5/4, Stufe 2.2).
 *
 * Reine Anzeige — die Bereitschaft selbst kommt fertig aus `buildMyTeamsMatchdayReadiness`
 * (die wiederum `evaluateMatchdayHumanReadiness` aufruft, keine zweite Berechnung). Diese
 * Komponente rechnet nichts nach, sie zeigt nur und bietet den Direktsprung zum offenen Team.
 */
type MyTeamsReadinessPanelProps = {
  readiness: MyTeamsMatchdayReadiness;
  activeTeamId: string;
  onJumpToTeam: (teamId: string) => void;
};

export default function MyTeamsReadinessPanel({ readiness, activeTeamId, onJumpToTeam }: MyTeamsReadinessPanelProps) {
  // Bei hoechstens einem eigenen Team ist der normale Team-Umschalter bereits die vollstaendige
  // Antwort — die Sammel-Ansicht traegt erst ab dem zweiten eigenen Team etwas bei (das ist genau
  // der Fall, den Befund B5/4 beschreibt: "mehrere eigene Teams").
  if (readiness.humanTeamCount <= 1) {
    return null;
  }

  const orderedTeams = [...readiness.pendingTeams, ...readiness.readyTeams];

  return (
    <div className="legacy-lineup-my-teams-readiness" role="status" aria-live="polite">
      <span className="legacy-lineup-my-teams-readiness__title">
        Meine Teams · {readiness.matchdayLabel} · {readiness.readyTeams.length}/{readiness.humanTeamCount} fertig
      </span>
      <div className="legacy-lineup-my-teams-readiness__chips">
        {orderedTeams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={[
              "legacy-lineup-my-teams-readiness__chip",
              team.currentMatchdayReady ? "is-ready" : "is-pending",
              team.id === activeTeamId ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onJumpToTeam(team.id)}
            aria-current={team.id === activeTeamId ? "true" : undefined}
            title={team.currentMatchdayReady ? `${team.name} · Aufstellung steht` : `${team.name} · noch offen`}
          >
            {team.currentMatchdayReady ? "✓ " : "· "}
            {team.name}
          </button>
        ))}
      </div>
    </div>
  );
}

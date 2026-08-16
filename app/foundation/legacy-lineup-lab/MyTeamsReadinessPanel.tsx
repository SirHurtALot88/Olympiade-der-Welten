"use client";

import type { MyTeamsMatchdayReadiness } from "@/lib/foundation/matchday-human-readiness";

/**
 * SAMMEL-ANSICHT „MEINE TEAMS · SPIELTAG X · FERTIG/OFFEN" (Befund B5/4, Stufe 2.2).
 *
 * Rechnet nichts nach — die Bereitschaft kommt fertig aus `buildMyTeamsMatchdayReadiness`
 * (die wiederum `evaluateMatchdayHumanReadiness` aufruft, keine zweite Berechnung). Diese
 * Komponente zeigt und bietet den Direktsprung zum offenen Team.
 *
 * DAZU SEIT AUFGABE #43 (Befund F14) der Knopf fuer die Sammel-Abgabe. Er steht hier und nicht
 * irgendwo sonst, weil diese Ansicht die einzige Stelle ist, die "meine offenen Teams" ueberhaupt
 * kennt und benennt — dieselbe Liste, die der Knopf abschickt. Ausgefuehrt wird nichts davon hier:
 * `onSammelAbgabe` gehoert dem Aufrufer, damit die Komponente eine reine Anzeige bleibt.
 */
type MyTeamsReadinessPanelProps = {
  readiness: MyTeamsMatchdayReadiness;
  activeTeamId: string;
  onJumpToTeam: (teamId: string) => void;
  /** Fehlt der Prop, gibt es den Knopf nicht — die Ansicht bleibt dann exakt wie zuvor. */
  onSammelAbgabe?: () => void;
  sammelAbgabeBusy?: boolean;
  /** Warum die Sammel-Abgabe gerade nicht geht (Nur-Lesen, fremdes Team). `null` = sie geht. */
  sammelAbgabeGesperrtGrund?: string | null;
};

export default function MyTeamsReadinessPanel({
  readiness,
  activeTeamId,
  onJumpToTeam,
  onSammelAbgabe,
  sammelAbgabeBusy,
  sammelAbgabeGesperrtGrund,
}: MyTeamsReadinessPanelProps) {
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
      {onSammelAbgabe ? (
        <button
          type="button"
          className="legacy-lineup-my-teams-readiness__sammel"
          onClick={onSammelAbgabe}
          disabled={Boolean(sammelAbgabeBusy) || readiness.pendingTeams.length === 0 || Boolean(sammelAbgabeGesperrtGrund)}
          title={
            sammelAbgabeGesperrtGrund ??
            (readiness.pendingTeams.length === 0
              ? "Alle deine Teams stehen bereits."
              : `Holt für ${readiness.pendingTeams.length} offene Teams den KI-Vorschlag und gibt sie in EINEM Zug ab.`)
          }
        >
          {sammelAbgabeBusy
            ? "Gibt ab …"
            : /* Was passiert, steht im Knopf: nicht "alle speichern", sondern welcher Vorschlag
                 fuer wie viele Teams. Ein Knopf, der eine Aufstellung festnagelt, darf darueber
                 nicht schweigen. */
              `${readiness.pendingTeams.length} offene mit KI-Vorschlag abgeben`}
        </button>
      ) : null}
    </div>
  );
}

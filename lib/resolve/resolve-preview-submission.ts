import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * „Was du siehst, wird gebucht."
 *
 * Die Arena rechnet nichts selbst — sie zeigt eine Resolve-Preview des Servers, additiv zerlegt
 * (siehe `discipline-stage-from-preview.ts`, dort gilt Σ(Netto) == teamResult.score). Gebucht wurde
 * bisher trotzdem eine ZWEITE Auflösung, die der Commit frisch gefahren hat. Die Engine ist
 * deterministisch (Form-Jitter seeded aus `playerId|disciplineId|matchdayId`), zwei Läufe über
 * denselben Zustand liefern also dasselbe — aber eben nur über DENSELBEN Zustand. Bewegte sich
 * zwischen Ansehen und Buchen etwas an den Aufstellungen, wich das gebuchte Ergebnis von dem ab,
 * das der Spieler gerade gesehen hatte. Genau so ist es gemeldet worden.
 *
 * Deshalb schickt die Arena ihre Preview jetzt mit, und der Server bucht sie, statt neu zu rechnen.
 *
 * Diese Datei ist die Annahmestelle. Sie prüft NICHT die Zahlen — die kommen aus der Engine und
 * werden bewusst übernommen. Sie prüft, ob die eingereichte Preview überhaupt VON DIESEM Spieltag
 * handelt und dieselben Aufstellungen beschreibt, die jetzt in der Ablage stehen. Denn eine
 * veraltete Preview zu buchen wäre schlimmer als neu zu rechnen: sie schriebe Ergebnisse für
 * Spieler fest, die gar nicht mehr aufgestellt sind.
 */

export type ResolvePreviewSubmissionDecision = {
  /** Die Preview, mit der gebucht wird. */
  preview: LegacyMatchdayResolvePreview;
  /** `arena`: die eingereichte wurde übernommen. `server`: es wird die frisch gerechnete gebucht. */
  source: "arena" | "server";
  /**
   * Warum die eingereichte Preview NICHT übernommen wurde — als Warnung für die Rückmeldung.
   * `null`, wenn sie übernommen wurde oder gar keine eingereicht war.
   */
  rejectedReason: string | null;
};

type Scope = { saveId: string; seasonId: string; matchdayId: string };

/**
 * Fingerabdruck dessen, WORÜBER eine Preview spricht — nicht, was sie ausrechnet.
 *
 * Bewusst nur Aufstellung und Zuordnung: Disziplin, Team, Slot, Spieler. Keine Scores, keine
 * Modifikatoren. Sonst würde jede Abweichung, die wir eigentlich übernehmen wollen, die Preview
 * disqualifizieren — und wir wären zurück beim Neurechnen.
 */
export function buildResolvePreviewLineupFingerprint(preview: LegacyMatchdayResolvePreview): string {
  const disciplines = [...preview.disciplinePreviews]
    .sort((a, b) => a.disciplineId.localeCompare(b.disciplineId))
    .map((discipline) => {
      const teams = [...discipline.teamResults]
        .sort((a, b) => a.teamId.localeCompare(b.teamId))
        .map((team) => {
          // Slot-Reihenfolge ist Teil der Aufstellung (sie bestimmt die Etappen) — daher NICHT
          // sortieren, sondern so übernehmen, wie sie eingereicht wurde.
          const entries = team.entries.map((entry) => entry.playerId).join(">");
          return `${team.teamId}=${entries}`;
        })
        .join(",");
      return `${discipline.disciplineId}[${teams}]`;
    })
    .join("|");

  return `${preview.saveId}/${preview.seasonId}/${preview.matchdayId}#${disciplines}`;
}

/**
 * Entscheidet, welche Preview gebucht wird.
 *
 * Ohne Einreichung bleibt es bei der frisch gerechneten — das ist der Weg des Cockpits, das keine
 * Bühne vor sich hat und deren Ergebnis niemand gesehen hat.
 */
export function decideResolvePreviewToBook(input: {
  submitted: LegacyMatchdayResolvePreview | null | undefined;
  serverPreview: LegacyMatchdayResolvePreview;
  scope: Scope;
}): ResolvePreviewSubmissionDecision {
  const { submitted, serverPreview, scope } = input;

  if (!submitted) {
    return { preview: serverPreview, source: "server", rejectedReason: null };
  }

  if (
    submitted.saveId !== scope.saveId ||
    submitted.seasonId !== scope.seasonId ||
    submitted.matchdayId !== scope.matchdayId
  ) {
    return {
      preview: serverPreview,
      source: "server",
      rejectedReason: "submitted_preview_scope_mismatch",
    };
  }

  const submittedFingerprint = buildResolvePreviewLineupFingerprint(submitted);
  const serverFingerprint = buildResolvePreviewLineupFingerprint(serverPreview);
  if (submittedFingerprint !== serverFingerprint) {
    // Die Aufstellungen haben sich bewegt, seit die Bühne gelaufen ist (typisch: KI-Aufstellungen
    // wurden nachgezogen, während eine ältere Preview aus dem Session-Cache auf dem Schirm stand).
    // Was der Spieler gesehen hat, gilt für einen Spieltag, den es so nicht mehr gibt.
    return {
      preview: serverPreview,
      source: "server",
      rejectedReason: "submitted_preview_lineups_changed",
    };
  }

  return { preview: submitted, source: "arena", rejectedReason: null };
}

import { describe, expect, it } from "vitest";

import {
  buildResolvePreviewLineupFingerprint,
  decideResolvePreviewToBook,
} from "@/lib/resolve/resolve-preview-submission";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

const SCOPE = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-3" };

function makePreview(input: {
  lineup?: Record<string, string[]>;
  score?: number;
  scope?: Partial<typeof SCOPE>;
}): LegacyMatchdayResolvePreview {
  const lineup = input.lineup ?? { "A-A": ["p1", "p2"], "B-B": ["p3", "p4"] };
  const scope = { ...SCOPE, ...input.scope };
  return {
    ...scope,
    status: "ready",
    disciplinePreviews: [
      {
        disciplineId: "staffel",
        disciplineName: "Staffel",
        disciplineSide: "d1",
        teamResults: Object.entries(lineup).map(([teamId, playerIds]) => ({
          teamId,
          teamName: teamId,
          disciplineId: "staffel",
          disciplineSide: "d1",
          status: "ready",
          score: input.score ?? 100,
          entries: playerIds.map((playerId, slotIndex) => ({ playerId, slotIndex })),
        })),
        topPlayers: [],
        highlightCandidates: [],
      },
    ],
    teamResults: [],
    warnings: [],
    missingLineups: [],
    incompleteLineups: [],
    missingScores: [],
  } as unknown as LegacyMatchdayResolvePreview;
}

/**
 * Die Arena rechnet nichts selbst — sie spielt eine Resolve-Preview des Servers ab. Gebucht wurde
 * trotzdem eine ZWEITE Aufloesung, die der Commit frisch gefahren hat. Die Engine ist
 * deterministisch, zwei Laeufe ueber denselben Zustand liefern also dasselbe — aber eben nur ueber
 * denselben Zustand. Bewegte sich zwischen Ansehen und Buchen etwas an den Aufstellungen (typisch:
 * KI-Aufstellungen zogen nach), stand im Saisonstand etwas anderes als auf dem Schirm.
 */
describe("Welche Preview gebucht wird", () => {
  it("bucht die Preview, die die Arena gezeigt hat", () => {
    // Absichtlich ANDERE Zahlen im Serverlauf: genau der Fall, um den es geht. Gebucht wird das,
    // was der Spieler gesehen hat — nicht, was ein zweiter Lauf ergeben haette.
    const shown = makePreview({ score: 92.2 });
    const decision = decideResolvePreviewToBook({
      submitted: shown,
      serverPreview: makePreview({ score: 71.8 }),
      scope: SCOPE,
    });

    expect(decision.source).toBe("arena");
    expect(decision.preview).toBe(shown);
    expect(decision.rejectedReason).toBeNull();
  });

  it("rechnet ohne Einreichung weiter selbst", () => {
    // Das Cockpit hat keine Buehne vor sich — dort hat niemand ein Ergebnis gesehen, das man
    // festhalten muesste.
    const serverPreview = makePreview({});
    const decision = decideResolvePreviewToBook({ submitted: null, serverPreview, scope: SCOPE });

    expect(decision.source).toBe("server");
    expect(decision.preview).toBe(serverPreview);
    expect(decision.rejectedReason).toBeNull();
  });

  it("lehnt eine Preview ab, deren Aufstellungen es nicht mehr gibt", () => {
    // Eine veraltete Preview zu buchen waere schlimmer als neu zu rechnen: sie schriebe Ergebnisse
    // fuer Spieler fest, die gar nicht mehr aufgestellt sind.
    const decision = decideResolvePreviewToBook({
      submitted: makePreview({ lineup: { "A-A": ["p1", "p2"] } }),
      serverPreview: makePreview({ lineup: { "A-A": ["p1", "p2"], "B-B": ["p3", "p4"] } }),
      scope: SCOPE,
    });

    expect(decision.source).toBe("server");
    expect(decision.rejectedReason).toBe("submitted_preview_lineups_changed");
  });

  it("lehnt eine Preview aus einem anderen Spieltag ab", () => {
    const decision = decideResolvePreviewToBook({
      submitted: makePreview({ scope: { matchdayId: "matchday-2" } }),
      serverPreview: makePreview({}),
      scope: SCOPE,
    });

    expect(decision.source).toBe("server");
    expect(decision.rejectedReason).toBe("submitted_preview_scope_mismatch");
  });
});

describe("Aufstellungs-Fingerabdruck", () => {
  it("ignoriert die Zahlen — sonst waere jede Einreichung disqualifiziert", () => {
    // Genau der Punkt: die Zahlen DUERFEN abweichen, das ist der Zweck der Uebung.
    expect(buildResolvePreviewLineupFingerprint(makePreview({ score: 10 }))).toBe(
      buildResolvePreviewLineupFingerprint(makePreview({ score: 999 })),
    );
  });

  it("bemerkt eine geaenderte Slot-Reihenfolge", () => {
    // Die Reihenfolge bestimmt die Etappen — sie ist Teil der Aufstellung, nicht Kosmetik.
    expect(buildResolvePreviewLineupFingerprint(makePreview({ lineup: { "A-A": ["p1", "p2"] } }))).not.toBe(
      buildResolvePreviewLineupFingerprint(makePreview({ lineup: { "A-A": ["p2", "p1"] } })),
    );
  });

  it("ist unabhaengig von der Team-Reihenfolge in der Antwort", () => {
    expect(
      buildResolvePreviewLineupFingerprint(makePreview({ lineup: { "A-A": ["p1"], "B-B": ["p2"] } })),
    ).toBe(buildResolvePreviewLineupFingerprint(makePreview({ lineup: { "B-B": ["p2"], "A-A": ["p1"] } })));
  });
});

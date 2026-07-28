import { describe, expect, it } from "vitest";

import {
  buildMatchdayTeamModifiers,
  describeMatchdaySideModifiers,
} from "@/lib/foundation/matchday-team-modifiers";

function teamResult(
  teamId: string,
  disciplineId: string,
  overrides: Record<string, unknown> = {},
) {
  return { teamId, disciplineId, ...overrides };
}

describe("buildMatchdayTeamModifiers", () => {
  it("liest Captain und Formkarten aus der Preview je Disziplin-Seite", () => {
    const byTeam = buildMatchdayTeamModifiers({
      d1DisciplineId: "eiskunst",
      d2DisciplineId: "gewicht",
      disciplinePreviews: [
        {
          disciplineId: "eiskunst",
          teamResults: [
            teamResult("D-P", "eiskunst", {
              formCardLabel: "R+3 · B-2",
              formModifier: 4.5,
              entries: [
                { playerName: "Nova", isCaptain: false },
                { playerName: "Dreamscape Inspirer", isCaptain: true, captainBonus: 8.2 },
              ],
            }),
          ],
        },
        {
          disciplineId: "gewicht",
          teamResults: [
            teamResult("D-P", "gewicht", {
              formCardLabel: "G-4",
              formModifier: -4,
              entries: [{ playerName: "Brontar", isCaptain: false }],
            }),
          ],
        },
      ],
    });

    const dp = byTeam.get("D-P");
    expect(dp?.d1?.captainUsed).toBe(true);
    expect(dp?.d1?.captainName).toBe("Dreamscape Inspirer");
    expect(dp?.d1?.captainBonus).toBe(8.2);
    expect(dp?.d1?.formCardLabel).toBe("R+3 · B-2");
    expect(dp?.d1?.formTone).toBe("positive");

    // Zweite Diszi ohne Captain, mit negativer Form — genau der Fall, den man sehen will.
    expect(dp?.d2?.captainUsed).toBe(false);
    expect(dp?.d2?.captainName).toBeNull();
    expect(dp?.d2?.formTone).toBe("negative");
  });

  it("zaehlt den Captain als genutzt, auch wenn sein Bonus 0 ergibt", () => {
    // Wichtig fuer die Aussage "Captain in einer 4er-Diszi verbrannt, ohne Wirkung".
    const byTeam = buildMatchdayTeamModifiers({
      d1DisciplineId: "sprint",
      disciplinePreviews: [
        {
          disciplineId: "sprint",
          teamResults: [
            teamResult("S-S", "sprint", {
              entries: [{ playerName: "Kaida", isCaptain: true, captainBonus: 0 }],
            }),
          ],
        },
      ],
    });

    expect(byTeam.get("S-S")?.d1?.captainUsed).toBe(true);
    expect(byTeam.get("S-S")?.d1?.captainName).toBe("Kaida");
  });

  it("erkennt einen Team-Level-Captain auch ohne markierten Eintrag", () => {
    const byTeam = buildMatchdayTeamModifiers({
      d1DisciplineId: "sprint",
      disciplinePreviews: [
        {
          disciplineId: "sprint",
          teamResults: [teamResult("C-C", "sprint", { captainBonus: 5.5, entries: [{ playerName: "Ilo" }] })],
        },
      ],
    });

    expect(byTeam.get("C-C")?.d1?.captainUsed).toBe(true);
    expect(byTeam.get("C-C")?.d1?.captainName).toBeNull();
    expect(byTeam.get("C-C")?.d1?.captainBonus).toBe(5.5);
  });

  it("ignoriert Disziplinen, die nicht zum angezeigten Spieltag gehoeren", () => {
    const byTeam = buildMatchdayTeamModifiers({
      d1DisciplineId: "sprint",
      d2DisciplineId: null,
      disciplinePreviews: [
        { disciplineId: "sprint", teamResults: [teamResult("C-C", "sprint", { formCardLabel: "R+2" })] },
        { disciplineId: "fremd", teamResults: [teamResult("C-C", "fremd", { formCardLabel: "B-9" })] },
      ],
    });

    expect(byTeam.get("C-C")?.d1?.formCardLabel).toBe("R+2");
    expect(byTeam.get("C-C")?.d2).toBeNull();
  });

  it("meldet keine Form, wenn keine Karte gesetzt war", () => {
    const byTeam = buildMatchdayTeamModifiers({
      d1DisciplineId: "sprint",
      disciplinePreviews: [
        { disciplineId: "sprint", teamResults: [teamResult("C-C", "sprint", { formModifier: 0 })] },
      ],
    });

    const side = byTeam.get("C-C")?.d1;
    expect(side?.formCardLabel).toBeNull();
    expect(side?.formTone).toBe("none");
    expect(side?.captainUsed).toBe(false);
  });

  it("kommt mit fehlender Preview klar", () => {
    expect(buildMatchdayTeamModifiers({ disciplinePreviews: null }).size).toBe(0);
    expect(buildMatchdayTeamModifiers({}).size).toBe(0);
  });
});

describe("describeMatchdaySideModifiers", () => {
  it("fasst Captain und Form fuer den Tooltip zusammen", () => {
    expect(
      describeMatchdaySideModifiers({
        formCardLabel: "R+3",
        formModifier: 3,
        formTone: "positive",
        captainUsed: true,
        captainName: "Nova",
        captainBonus: 8.2,
      }),
    ).toBe("Captain: Nova (+8.2) · Form: R+3 (+3.0)");
  });

  it("benennt auch das Fehlen klar", () => {
    expect(describeMatchdaySideModifiers(null)).toBe("Kein Captain · Keine Formkarte");
  });
});

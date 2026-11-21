import { describe, expect, it } from "vitest";
import { getTeamRaceFit, getTeamSubclassFit } from "@/lib/market/team-fit-matrix";

describe("Team-Fit-Matrix: Pool-Namen werden auf Matrix-Namen übersetzt (Fund 21.11.)", () => {
  it("Rasse Aqua liest die Fish-Spalte", () => {
    expect(getTeamRaceFit({ teamId: "D-P", race: "Aqua" })).toBe(getTeamRaceFit({ teamId: "D-P", race: "Fish" }));
    expect(getTeamRaceFit({ teamId: "D-P", race: "Aqua" })).toBe(-10);
    expect(getTeamRaceFit({ teamId: "R-R", race: "Aqua" })).toBe(5);
  });

  it("Subklasse Behemoth liest die Giant-Spalte", () => {
    expect(getTeamSubclassFit({ teamId: "T-G", subclass: "Behemoth" })).toBe(5);
    expect(getTeamSubclassFit({ teamId: "T-G", subclass: "Behemoth" })).toBe(getTeamSubclassFit({ teamId: "T-G", subclass: "Giant" }));
  });

  it("andere Tokens bleiben unverändert", () => {
    expect(getTeamRaceFit({ teamId: "D-P", race: "Demon" })).toBe(5);
    expect(getTeamRaceFit({ teamId: "D-P", race: "Gibtsnicht" })).toBeNull();
  });
});

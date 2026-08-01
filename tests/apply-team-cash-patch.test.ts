import { describe, expect, it } from "vitest";

import { applyTeamCashPatch } from "@/lib/foundation/apply-team-cash-patch";

/**
 * Hintergrund: Nach einem Kauf oder Verkauf im Transfermarkt lief `loadSave()` — der GESAMTE
 * Spielstand wurde neu ueber das Netz geholt, damit eine Zahl stimmt. Der neue Kontostand steht
 * aber schon in der Antwort (`cashAfter`, im Erfolgstext sogar sichtbar).
 *
 * Die Tests halten vor allem zwei Dinge fest, die leicht kaputtgehen: Es darf NUR das eine Team
 * getroffen werden (ein Kauf aendert nicht die Kasse der Liga), und bei unbrauchbaren Eingaben muss
 * die Liste REFERENZGLEICH bleiben — ein neues Array bei jedem Aufruf wuerde in React Renders
 * ausloesen, obwohl sich nichts geaendert hat.
 */
const TEAMS = [
  { teamId: "C-C", cash: 120, name: "Crimson" },
  { teamId: "H-R", cash: 80, name: "Hollow" },
] as const;

function teams() {
  return TEAMS.map((team) => ({ ...team }));
}

describe("applyTeamCashPatch", () => {
  it("setzt den Kontostand des gekauften Teams", () => {
    const next = applyTeamCashPatch(teams(), { teamId: "C-C", cash: 95 });

    expect(next.find((team) => team.teamId === "C-C")?.cash).toBe(95);
  });

  it("laesst alle anderen Teams unberuehrt — ein Kauf aendert nicht die Kasse der Liga", () => {
    const next = applyTeamCashPatch(teams(), { teamId: "C-C", cash: 95 });

    expect(next.find((team) => team.teamId === "H-R")?.cash).toBe(80);
    expect(next).toHaveLength(2);
  });

  it("behaelt die uebrigen Felder des getroffenen Teams", () => {
    // Ein Patch, der das Team-Objekt ersetzt statt es zu ergaenzen, wuerde den Namen verlieren.
    const next = applyTeamCashPatch(teams(), { teamId: "C-C", cash: 95 });

    expect(next.find((team) => team.teamId === "C-C")?.name).toBe("Crimson");
  });

  it("gibt bei unbekanntem Team dieselbe Liste zurueck (referenzgleich)", () => {
    const input = teams();

    expect(applyTeamCashPatch(input, { teamId: "X-X", cash: 10 })).toBe(input);
  });

  it("gibt bei fehlender Team-Id dieselbe Liste zurueck", () => {
    const input = teams();

    expect(applyTeamCashPatch(input, { teamId: null, cash: 10 })).toBe(input);
    expect(applyTeamCashPatch(input, { teamId: "", cash: 10 })).toBe(input);
  });

  it("gibt bei unbrauchbarem Betrag dieselbe Liste zurueck — lieber nachladen als Unsinn anzeigen", () => {
    const input = teams();

    expect(applyTeamCashPatch(input, { teamId: "C-C", cash: null })).toBe(input);
    expect(applyTeamCashPatch(input, { teamId: "C-C", cash: undefined })).toBe(input);
    expect(applyTeamCashPatch(input, { teamId: "C-C", cash: Number.NaN })).toBe(input);
    expect(applyTeamCashPatch(input, { teamId: "C-C", cash: Number.POSITIVE_INFINITY })).toBe(input);
  });

  it("gibt bei unveraendertem Betrag dieselbe Liste zurueck", () => {
    const input = teams();

    expect(applyTeamCashPatch(input, { teamId: "C-C", cash: 120 })).toBe(input);
  });

  it("akzeptiert 0 und negative Betraege — ein Team kann pleite sein", () => {
    // `!cash` als Pruefung waere hier falsch: 0 ist ein gueltiger Kontostand.
    expect(applyTeamCashPatch(teams(), { teamId: "C-C", cash: 0 })[0].cash).toBe(0);
    expect(applyTeamCashPatch(teams(), { teamId: "C-C", cash: -12.5 })[0].cash).toBe(-12.5);
  });

  it("veraendert die Eingabeliste nicht", () => {
    const input = teams();
    applyTeamCashPatch(input, { teamId: "C-C", cash: 95 });

    expect(input[0].cash).toBe(120);
  });
});

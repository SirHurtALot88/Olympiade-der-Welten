import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TEAM_POWERS_ENABLED } from "@/lib/lineups/team-powers";

const REPO_ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * Team-Powers sind abgeschaltet (`TEAM_POWERS_ENABLED = false`). Die Mechanik lieferte danach
 * zwar keine Optionen mehr, das Dropdown blieb aber trotzdem stehen: die Einsatzliste blendet
 * den Kasten nur aus, wenn WEDER Optionen DA sind NOCH etwas ausgewaehlt ist — und in
 * gewachsenen Spielstaenden steht in `modifiers.dX.teamPowerId` noch eine alte Power.
 * Ergebnis war ein Auswahlfeld mit genau einem Eintrag, den man nicht mehr wechseln konnte.
 *
 * Dieser Vertrag haelt fest, dass bei abgeschalteter Mechanik gar keine Controls mehr
 * durchgereicht werden. Der Renderpfad selbst bleibt vollstaendig erhalten, damit das
 * Wiedereinschalten eine Zeile ist — die letzten beiden Faelle bewachen genau das.
 */
describe("Einsatzliste: Team-Power-Auswahl", () => {
  const lineupText = readSource("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
  const clientText = readSource("app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");

  it("reicht bei abgeschalteter Mechanik keine Controls durch", () => {
    expect(TEAM_POWERS_ENABLED).toBe(false);
    // Die Controls haengen am Schalter statt an der Options-Laenge — eine gespeicherte
    // `teamPowerId` kann den Block damit nicht mehr am Leben halten.
    expect(clientText).toMatch(/teamPowerControlsBySide=\{\s*areTeamPowersEnabled\(\)/);
    expect(clientText).toContain('import { areTeamPowersEnabled, describeTeamPowerDebuffEffect');
  });

  it("blendet den Block ohne Controls komplett aus", () => {
    expect(lineupText).toContain("const control = teamPowerControlsBySide?.[disciplineSide] ?? null;");
    expect(lineupText).toContain("if (!control) return null;");
  });

  it("meldet beim Speichern keine Power mehr", () => {
    // Sonst quittierte das Speichern "1 Power" fuer eine Auswahl, die es nicht mehr gibt.
    expect(clientText).toMatch(/selectedPowerCount = areTeamPowersEnabled\(\)/);
    expect(clientText).toContain("selectedPowerCount == null ? null : `${selectedPowerCount} Power`");
  });

  it("haelt den Renderpfad fuer das Wiedereinschalten vollstaendig vor", () => {
    expect(lineupText).toContain('data-testid={`nl-lineup-teampower-${disciplineSide}`}');
    expect(lineupText).toContain("onAssignTeamPower?.(disciplineSide, event.target.value || null)");
    expect(clientText).toContain("function buildLineupTeamPowerControlForSide");
    expect(clientText).toContain("getTeamPowerOptionsForSide(disciplineSide)");
    expect(clientText).toContain('updateModifier(disciplineSide, "teamPowerId", powerId ?? "")');
  });

  it("haelt den Ressourcen-Block je Disziplin zusammen (Formkarten · Team-Power · Captain)", () => {
    const formCardsIndex = lineupText.indexOf('data-testid={`nl-lineup-formcards-${disciplineSide}`}');
    const teamPowerIndex = lineupText.indexOf('data-testid={`nl-lineup-teampower-${disciplineSide}`}');
    const captainIndex = lineupText.indexOf('data-testid={`nl-lineup-captain-${disciplineSide}`}');

    expect(formCardsIndex).toBeGreaterThan(-1);
    expect(teamPowerIndex).toBeGreaterThan(formCardsIndex);
    expect(captainIndex).toBeGreaterThan(teamPowerIndex);
  });
});

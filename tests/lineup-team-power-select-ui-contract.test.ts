import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/**
 * Die Team-Power ist neben Formkarten und Captain die dritte Spieltag-Ressource
 * einer Disziplin. Die Auswahl-Ableitungen (`getTeamPowerOptionsForSide`,
 * `getTeamPowerEmptyOptionLabel`, `getTeamPowerSelectTitle`) existierten im
 * Client weiter, wurden aber von KEINER gerenderten Ansicht mehr konsumiert —
 * in der Einsatzliste konnte man deshalb gar keine Power mehr setzen.
 * Dieser Vertrag hält den Renderpfad fest.
 */
describe("Einsatzliste: Team-Power-Auswahl je Disziplin", () => {
  const lineupText = readSource("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
  const clientText = readSource("app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");

  it("rendert je Disziplin-Seite ein Team-Power-Select", () => {
    expect(lineupText).toContain("teamPowerControlsBySide");
    expect(lineupText).toContain("onAssignTeamPower");
    expect(lineupText).toContain('data-testid={`nl-lineup-teampower-${disciplineSide}`}');
    // Der Select meldet die Wahl (leerer Wert = keine Power) an den Client zurück.
    expect(lineupText).toContain("onAssignTeamPower?.(disciplineSide, event.target.value || null)");
  });

  it("versorgt die Einsatzliste aus den vorhandenen Client-Ableitungen", () => {
    expect(clientText).toContain("function buildLineupTeamPowerControlForSide");
    // Keine neue Auswahl-/Sortierlogik: es werden exakt die bestehenden Helfer genutzt.
    expect(clientText).toContain("getTeamPowerOptionsForSide(disciplineSide)");
    expect(clientText).toContain("getTeamPowerEmptyOptionLabel(disciplineSide)");
    expect(clientText).toContain("getTeamPowerSelectTitle(disciplineSide)");
    // Persistenz läuft über denselben Modifier-Pfad wie zuvor.
    expect(clientText).toContain('updateModifier(disciplineSide, "teamPowerId", powerId ?? "")');
    expect(clientText).toContain('d1: buildLineupTeamPowerControlForSide("d1")');
    expect(clientText).toContain('d2: buildLineupTeamPowerControlForSide("d2")');
  });

  it("hält den Ressourcen-Block je Disziplin zusammen (Formkarten · Team-Power · Captain)", () => {
    const formCardsIndex = lineupText.indexOf('data-testid={`nl-lineup-formcards-${disciplineSide}`}');
    const teamPowerIndex = lineupText.indexOf('data-testid={`nl-lineup-teampower-${disciplineSide}`}');
    const captainIndex = lineupText.indexOf('data-testid={`nl-lineup-captain-${disciplineSide}`}');

    expect(formCardsIndex).toBeGreaterThan(-1);
    expect(teamPowerIndex).toBeGreaterThan(formCardsIndex);
    expect(captainIndex).toBeGreaterThan(teamPowerIndex);
  });
});

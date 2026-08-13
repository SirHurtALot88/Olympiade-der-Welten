import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * GEMELDET VON CHRIS an der MW-Kachel: „die grafik soll auch von anderen teams verfügbar sein!
 * sowohl für MW als auch gehalt und Rang!"
 *
 * BEFUND: Die Zusammensetzung („MARKTWERT · KADER" mit den Einzelwerten und der Kadersumme) war an
 * einen Fog-of-War-Riegel gebunden — beim eigenen Team die volle Liste, bei jedem anderen nur die
 * Summe und der Satz „Einzel-Marktwerte verdeckt (fremdes Team)". Dasselbe beim Gehalt, in BEIDEN
 * Ansichten (Teams-Reiter und Team-Profil).
 *
 * Es war eine reine Anzeige-Sperre: die Zahlen liegen ohnehin in denselben Kaderzeilen, aus denen
 * die Kadertabelle und der Transfermarkt lesen. Der RANG-Hover kannte den Riegel noch nie — er
 * zeigt in beiden Ansichten die Ligatabelle rund um das gewählte Team, für jedes Team.
 */

const root = process.cwd();

async function lies(relativerPfad: string) {
  return fs.readFile(path.join(root, relativerPfad), "utf8");
}

const TEAMS_VIEW = "app/foundation/teams-v2/FoundationTeamsNewLook.tsx";
const TEAM_PROFILE = "app/foundation/team-profile/TeamProfileNewLook.tsx";

describe("Kader-Breakdown · für jedes Team, nicht nur das eigene", () => {
  it("baut die MW- und Gehalt-Zeilen im Teams-Reiter ohne Eigentuemer-Riegel", async () => {
    const view = await lies(TEAMS_VIEW);
    // Der Riegel sass als erste Zeile in beiden useMemo-Bloecken.
    expect(view).not.toMatch(/const heroMarketValueRows = useMemo\(\(\) => \{\s*if \(!heroIsOwnTeam\)/);
    expect(view).not.toMatch(/const heroSalaryRows = useMemo\(\(\) => \{\s*if \(!heroIsOwnTeam\)/);
  });

  it("rendert nirgends mehr den Hinweis „verdeckt (fremdes Team)“", async () => {
    // Auf die GERENDERTE Stelle prüfen, nicht auf die Zeichenkette: der Satz steht weiterhin in
    // den Begründungs-Kommentaren, und das soll er auch — dort erklärt er, was früher hier stand.
    for (const datei of [TEAMS_VIEW, TEAM_PROFILE]) {
      const quelle = await lies(datei);
      expect(quelle).not.toMatch(/className="nl-kpipop-note">Einzel-/);
      expect(quelle).not.toMatch(/className="nl-teams-rank-preview-title">Einzel-/);
    }
  });

  it("laesst im Team-Profil beide Popover auf die Zeilen laufen statt auf das Gate", async () => {
    const profil = await lies(TEAM_PROFILE);
    expect(profil).toMatch(/\{mwBreakdown\.rows\.length === 0 \? \(/);
    expect(profil).toMatch(/\{salaryBreakdown\.rows\.length === 0 \? \(/);
    // Das Gate selbst ist damit unbenutzt und ausgebaut — keine tote Variable stehen lassen.
    expect(profil).not.toContain("isOwnedTeam");
  });

  it("haelt die Kadersumme als Abschluss der Liste", async () => {
    // Sie war beim fremden Team bisher die EINZIGE Zeile; sie darf durch das Aufheben des
    // Riegels nicht verlorengehen.
    const view = await lies(TEAMS_VIEW);
    expect(view).toContain("Kadersumme");
  });

  it("laesst den Rang-Hover unangetastet — er kannte den Riegel nie", async () => {
    const view = await lies(TEAMS_VIEW);
    const profil = await lies(TEAM_PROFILE);
    // Teams-Reiter: Fenster um das gewaehlte Team aus der sortierten Liga, ohne Eigentuemer-Frage.
    expect(view).toMatch(/const rankPreviewRows = useMemo\(\(\) => \{[\s\S]{0,400}sortedTeamsViewRows/);
    expect(view).not.toMatch(/rankPreviewRows[\s\S]{0,200}heroIsOwnTeam/);
    // Team-Profil: Ligatabelle aus dem GameState, ebenfalls ohne Gate.
    expect(profil).toMatch(/const standingsHoverRows = useMemo\(\(\) => \{\s*if \(!foundationGameState\)/);
  });
});

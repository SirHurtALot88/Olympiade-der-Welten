import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const CHART = readFileSync(
  join(REPO_ROOT, "app/foundation/player-profile/PlayerAttributeProgressChart.tsx"),
  "utf8",
);
const CSS = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");

/**
 * Die PP-Tabelle im Spielerprofil zeigte die vier Achsen nur als farbigen Text. Die
 * Team-Historie stellt dieselben Achsen als gefuellte Bereichszellen dar und laesst sie
 * aufklappen, um die Disziplinen dahinter zu zeigen. Diese Suite haelt fest, dass die
 * Spieler-Tabelle jetzt dasselbe tut — und dass beide Tabellen sich EINE Farbdefinition
 * teilen, statt zwei Quellen zu haben, die auseinanderdriften koennen.
 */
describe("Spielerprofil: PP-Historie mit Bereichsspalten", () => {
  it("rendert die Achsen als gefüllte Bereichszellen", () => {
    expect(CHART).toContain('className={`player-drawer-history-area ${metric.className}`}');
    // Die alte, rein textfarbige Variante ist raus.
    expect(CHART).not.toContain('className={`player-drawer-history-axis ${option.className}`}');
  });

  it("klappt je Bereich die Disziplin-Spalten auf", () => {
    expect(CHART).toContain("const [expandedPpAreas, setExpandedPpAreas] = useState<Record<SeasonDisciplineAreaId, boolean>>");
    expect(CHART).toContain("SEASON_DISCIPLINE_AREA_GROUPS.map((group)");
    expect(CHART).toContain("SEASON_DISCIPLINE_LABELS[key]");
    // Werte aus der Zeile, nichts erfunden.
    expect(CHART).toContain("const value = row.disciplineValues?.[key];");
    expect(CHART).toContain("is-discipline-child");
  });

  it("erfindet keinen Rang für die einzelnen Disziplinen", () => {
    // `disciplineValues` traegt nur den Wert — der Rang-Parameter bleibt bewusst null.
    expect(CHART).toContain("formatPpTableMetric(value, null)");
  });

  it("teilt sich die Bereichsfarben mit der Team-Historie", () => {
    for (const tone of ["is-power", "is-speed", "is-mental", "is-social"]) {
      // Beide Selektoren stehen an derselben Regel — eine Farbe, zwei Tabellen.
      const pattern = new RegExp(
        `\\.team-drawer-history-table td\\.team-drawer-history-area\\.${tone},\\s*\\n\\s*\\.player-attribute-progress-table td\\.player-drawer-history-area\\.${tone} \\{`,
      );
      expect(CSS).toMatch(pattern);
    }
  });

  it("gibt dem Aufklapp-Knopf das Aussehen der Kopfzeile", () => {
    expect(CSS).toContain(".player-attribute-progress-table .player-drawer-history-expand");
    expect(CHART).toContain('className="player-drawer-history-expand"');
    expect(CHART).toContain("aria-expanded={isExpanded}");
  });
});

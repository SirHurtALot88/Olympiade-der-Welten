import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Discipline } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";

const REPO_ROOT = process.cwd();
const TABLE = readFileSync(join(REPO_ROOT, "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"), "utf8");
const CSS = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");

/** Die Sortierung, die `disciplinesByAxis` je Achse anwendet. */
function orderAxis(disciplines: Discipline[], category: string): Discipline[] {
  return [...disciplines]
    .sort((left, right) => (left.displayOrder ?? left.originalOrder ?? 0) - (right.displayOrder ?? right.originalOrder ?? 0))
    .filter((discipline) => discipline.category === category)
    .sort((left, right) => (right.playerCount ?? 0) - (left.playerCount ?? 0));
}

describe("Spieler-Tabelle: Achsen- und Disziplin-Spalten", () => {
  it("ordnet die Disziplinen einer Achse absteigend nach Kadergröße", () => {
    expect(TABLE).toContain(".sort((left, right) => (right.playerCount ?? 0) - (left.playerCount ?? 0))");
  });

  it("liefert für POW im echten Katalog die größte Disziplin zuerst", () => {
    const powOrder = orderAxis(foundationSeedDisciplines as unknown as Discipline[], "power");
    expect(powOrder.length).toBeGreaterThan(1);

    const counts = powOrder.map((discipline) => discipline.playerCount ?? 0);
    // Monoton fallend — kein kleinerer Kader steht links von einem größeren.
    expect([...counts].sort((left, right) => right - left)).toEqual(counts);
    expect(counts[0]).toBe(Math.max(...counts));
  });

  it("hält die Regel auf allen vier Achsen ein", () => {
    for (const category of ["power", "speed", "mental", "social"]) {
      const counts = orderAxis(foundationSeedDisciplines as unknown as Discipline[], category).map(
        (discipline) => discipline.playerCount ?? 0,
      );
      expect([...counts].sort((left, right) => right - left)).toEqual(counts);
    }
  });

  it("zeichnet die Achsen-Zelle als einen Balken mit der Zahl darin", () => {
    // Der Wert liegt INNERHALB der Spur — vorher stand er in einer eigenen
    // Rasterspalte daneben, was die Spalte breit machte.
    const trackStart = TABLE.indexOf('<span className="nl-players-axis-track">');
    const valueIndex = TABLE.indexOf('className="nl-players-axis-value nl-tnum"');
    const trackEnd = TABLE.indexOf("</span>", valueIndex);
    expect(trackStart).toBeGreaterThan(-1);
    expect(valueIndex).toBeGreaterThan(trackStart);
    expect(trackEnd).toBeGreaterThan(valueIndex);

    // Nur die Füllung skaliert mit dem Wert, und nur sie ist dekorativ.
    expect(TABLE).toContain('<span className="nl-players-axis-fill" style={{ width: `${percent}%` }} aria-hidden="true" />');
    // Die Spur selbst darf nicht mehr aria-hidden sein — sie trägt jetzt die Zahl.
    expect(TABLE).not.toContain('<span className="nl-players-axis-track" aria-hidden="true">');
  });

  it("behält in den Aufklapp-Listen die Katalog-Reihenfolge und nennt die Kadergröße", () => {
    const roster = readFileSync(join(REPO_ROOT, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts"), "utf8");
    const panel = readFileSync(join(REPO_ROOT, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");

    // `originalOrder` zuerst — NICHT `displayOrder`. Letzteres ist die Spielplan-Reihenfolge
    // und schob TDM (displayOrder 13) ans Ende der POW-Liste.
    expect(roster).toContain("(left.originalOrder ?? left.displayOrder ?? 0) - (right.originalOrder ?? right.displayOrder ?? 0)");
    expect(roster).not.toContain("(left.displayOrder ?? left.originalOrder ?? 0) - (right.displayOrder ?? right.originalOrder ?? 0)");

    // Katalog-Reihenfolge fuer POW ist TDM · Mini DM · Gewichtheben · Hockey · Breaking.
    const powByCatalog = [...(foundationSeedDisciplines as unknown as Discipline[])]
      .filter((discipline) => discipline.category === "power")
      .sort((left, right) => (left.originalOrder ?? left.displayOrder ?? 0) - (right.originalOrder ?? right.displayOrder ?? 0))
      .map((discipline) => discipline.name);
    expect(powByCatalog[0]).toBe("TDM");

    // Kadergröße wird durchgereicht und in Klammern hinter dem Namen gezeigt.
    expect(roster).toContain("playerCount:");
    expect(panel).toContain('<span className="selected-roster-pps-diszi-item-count"> ({discipline.playerCount})</span>');
    // Ohne Katalogwert bleibt die Klammer weg statt eine Zahl zu erfinden.
    expect(panel).toContain("discipline.playerCount != null ? (");
  });

  it("macht die Achsen-Spalte schmaler und die Spur hoch genug für die Zahl", () => {
    expect(CSS).toContain(".is-new-look .nl-players-axis .nl-players-axis-value");
    // Zahl mittig über der ganzen Spur, damit sie bei kleinen Werten nicht ausbricht.
    expect(CSS).toMatch(/\.is-new-look \.nl-players-axis \.nl-players-axis-value \{[^}]*position: absolute;[^}]*\}/);
    expect(CSS).toMatch(/\.is-new-look \.nl-players-axis \.nl-players-axis-track \{[^}]*height: 15px;[^}]*\}/);
    expect(CSS).toMatch(/\.is-new-look \.nl-players-th-axis \{[^}]*width: 62px;[^}]*\}/);
  });
});

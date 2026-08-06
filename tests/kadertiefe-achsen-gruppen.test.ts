/**
 * GEMELDET VON CHRIS: „kannst du den depth chart nach POW SPE MEN SOC machen? Und dann
 * ausklappbar und die jeweils 5 diszis dann direkt darunter? das würde helfen"
 *
 * Der Squad Depth Chart listete alle 20 Disziplinen als eine durchgehende Tabelle in
 * `displayOrder`. Die Achse jeder Zeile war nur als farbiger Punkt zu erkennen — wer die
 * POW-Tiefe beurteilen wollte, musste sie aus der Liste zusammensuchen.
 *
 * Diese Datei hält zwei Dinge fest, die beim Gruppieren leicht kaputtgehen:
 *
 *  1. Es geht keine Disziplin verloren und keine wird doppelt einsortiert. Eine Gruppierung,
 *     die Zeilen verschluckt, sieht auf den ersten Blick genauso aus wie eine, die es nicht
 *     tut — nur dass die fehlende Disziplin nirgends mehr auftaucht.
 *  2. Die Reihenfolge INNERHALB einer Achse bleibt die `displayOrder` des Katalogs. Die
 *     Gruppierung fasst zusammen, sie sortiert nicht um.
 *
 * Dazu der Kontrakt der Bedienung (Startzustand offen, ARIA verdrahtet), weil die Zeilen
 * sonst hinter einem zugeklappten Kopf verschwinden könnten, ohne dass ein Test es merkt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { groupDepthRowsByAxis } from "@/app/foundation/team-profile/TeamProfileNewLook";

type DepthRowLike = Parameters<typeof groupDepthRowsByAxis>[0][number];

function createRow(partial: Pick<DepthRowLike, "disciplineId" | "axis"> & Partial<DepthRowLike>): DepthRowLike {
  return {
    disciplineLabel: partial.disciplineId,
    slotsNeeded: 2,
    capableCount: 4,
    isThin: false,
    cells: [null, null, null, null, null, null],
    ...partial,
  };
}

/** Katalog-Ausschnitt in `displayOrder` — bewusst mit durchmischten Achsen. */
const MIXED_ROWS: DepthRowLike[] = [
  createRow({ disciplineId: "mini-dm", axis: "pow" }),
  createRow({ disciplineId: "fechten", axis: "spe" }),
  createRow({ disciplineId: "schach", axis: "men" }),
  createRow({ disciplineId: "basketball", axis: "soc" }),
  createRow({ disciplineId: "gewichtheben", axis: "pow", isThin: true }),
  createRow({ disciplineId: "time-trial", axis: "spe" }),
  createRow({ disciplineId: "i-spy", axis: "men", isThin: true }),
  createRow({ disciplineId: "hockey", axis: "pow", isThin: true }),
];

describe("Depth-Chart · Gruppierung nach Achse", () => {
  it("ordnet die Gruppen POW → SPE → MEN → SOC", () => {
    expect(groupDepthRowsByAxis(MIXED_ROWS).map((group) => group.label)).toEqual([
      "POW",
      "SPE",
      "MEN",
      "SOC",
    ]);
  });

  it("verliert keine Disziplin und dupliziert keine", () => {
    const grouped = groupDepthRowsByAxis(MIXED_ROWS).flatMap((group) => group.rows.map((row) => row.disciplineId));

    expect(grouped.slice().sort()).toEqual(MIXED_ROWS.map((row) => row.disciplineId).slice().sort());
    expect(new Set(grouped).size).toBe(MIXED_ROWS.length);
  });

  it("sortiert innerhalb einer Achse nicht um (displayOrder bleibt)", () => {
    const pow = groupDepthRowsByAxis(MIXED_ROWS).find((group) => group.axis === "pow");

    // Reihenfolge wie im Eingabe-Katalog, NICHT alphabetisch oder nach isThin.
    expect(pow?.rows.map((row) => row.disciplineId)).toEqual(["mini-dm", "gewichtheben", "hockey"]);
  });

  it("steckt jede Zeile in die Gruppe ihrer eigenen Achse", () => {
    for (const group of groupDepthRowsByAxis(MIXED_ROWS)) {
      expect(group.rows.every((row) => row.axis === group.axis)).toBe(true);
    }
  });

  it("zählt die dünnen Disziplinen je Achse für den Gruppenkopf", () => {
    const byAxis = new Map(groupDepthRowsByAxis(MIXED_ROWS).map((group) => [group.axis, group.thinCount]));

    expect(byAxis.get("pow")).toBe(2);
    expect(byAxis.get("men")).toBe(1);
    expect(byAxis.get("spe")).toBe(0);
    expect(byAxis.get("soc")).toBe(0);
  });

  it("lässt eine Achse ohne Disziplin weg, statt eine leere Gruppe zu zeigen", () => {
    const onlyPow = groupDepthRowsByAxis([createRow({ disciplineId: "mini-dm", axis: "pow" })]);

    expect(onlyPow).toHaveLength(1);
    expect(onlyPow[0]?.axis).toBe("pow");
  });

  it("kommt mit einer leeren Chart klar", () => {
    expect(groupDepthRowsByAxis([])).toEqual([]);
  });
});

describe("Depth-Chart · Kontrakt der Bedienung", () => {
  const source = readFileSync(
    join(process.cwd(), "app/foundation/team-profile/TeamProfileNewLook.tsx"),
    "utf8",
  );

  it("startet mit allen Achsen aufgeklappt", () => {
    // Gespeichert wird das ZUgeklappte: leerer Startwert = alles offen. Damit bleibt der
    // Anblick derselbe wie vor der Gruppierung, und eine neue Achse ist sichtbar statt
    // versteckt.
    // `[\s\S]*` statt des dotAll-Flags: das `s`-Flag setzt ES2018 voraus, worauf dieses
    // Projekt nicht zielt — `tsc` bricht daran, vitest schluckt es stillschweigend.
    expect(source).toMatch(/collapsedDepthAxes[\s\S]*useState<readonly NlAxisKey\[\]>\(\[\]\)/);
  });

  it("verdrahtet den Gruppenkopf als Schalter mit ARIA", () => {
    expect(source).toContain('aria-expanded={!isCollapsed}');
    expect(source).toContain("aria-controls={groupBodyId}");
  });

  it("hält den zugeklappten Block im DOM, damit aria-controls ein Ziel hat", () => {
    // `hidden` statt bedingtem Rendern: ein aria-controls, das auf ein nicht existierendes
    // Element zeigt, ist kaputte Assistenz-Semantik.
    expect(source).toContain("<tbody id={groupBodyId} hidden={isCollapsed}>");
  });
});

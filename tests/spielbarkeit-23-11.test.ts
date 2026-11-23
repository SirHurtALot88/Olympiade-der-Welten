/**
 * SPIELBARKEIT 23.11. (docs/design/spielbarkeit-23-11.md): Wächter für die Funde des Durchlaufs gegen die echte App.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("Arena-Motor: Reiter-Umschalter", () => {
  it("setzt `hidden` nur an Panels, die es gibt (`.tab` ist eine allgemeine Klasse; null.hidden brach die Schleife ab)", () => {
    const motor = lies("public/mockups/battle-mode.engine.js");
    const start = motor.indexOf('const tabs=[...document.querySelectorAll(".tab")]');
    expect(start).toBeGreaterThan(0);
    const block = motor.slice(start, start + 900);
    expect(block).not.toMatch(/getElementById\(o\.getAttribute\("aria-controls"\)\)\.hidden/);
    expect(block).toContain("if(panel)panel.hidden=!on");
  });
});

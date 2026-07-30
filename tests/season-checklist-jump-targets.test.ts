import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveFoundationPanelScrollTarget } from "@/lib/foundation/tabs/foundation-page-module-helpers";

const CHECKLIST = readFileSync(join(process.cwd(), "lib/foundation/season-readiness-checklist.ts"), "utf8");

/** Alle `id="…"` aus den Foundation-Ansichten — die möglichen Sprungziele. */
function collectElementIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      for (const match of readFileSync(full, "utf8").matchAll(/\sid="([a-z0-9-]+)"/g)) {
        ids.add(match[1]!);
      }
    }
  };
  walk(join(process.cwd(), "app/foundation"));
  return ids;
}

/**
 * „Der Button Saison vorbereiten bringt gar nichts und bringt mich auch nicht weiter."
 *
 * Die Saison-Checkliste schickt den Spieler über `targetPanel` an einen Anker. Landet der
 * Name bei keinem Element, holt `scrollToFoundationTarget` per `getElementById` ein `null`
 * und bricht **still** ab — die Ansicht wechselt, sonst passiert nichts. Von aussen nicht
 * von einem kaputten Knopf zu unterscheiden.
 *
 * Drei der vier Saisonende-Einträge zeigten auf Anker, die es nirgends gab:
 * "preseason-workflow" (Neue Saison vorbereiten) und "season-review" (Spielerentwicklung,
 * Saisonrückblick).
 */
describe("Saison-Checkliste: jeder Sprung landet irgendwo", () => {
  const elementIds = collectElementIds();

  it("löst die Ziele der Saisonende-Einträge auf ein existierendes Element auf", () => {
    const panels = [...CHECKLIST.matchAll(/targetPanel:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]!);
    // Absicherung gegen einen leeren Treffersatz — ein Test, der nichts prüft, ist schlimmer
    // als keiner.
    expect(panels.length).toBeGreaterThanOrEqual(3);

    const dead = panels.filter((panel) => !elementIds.has(resolveFoundationPanelScrollTarget({ panel, targetView: "cockpit" })));
    expect(dead).toEqual([]);
  });

  it("kennt die beiden Namen, die vorher ins Leere liefen", () => {
    expect(resolveFoundationPanelScrollTarget({ panel: "preseason-workflow", targetView: "cockpit" })).toBe(
      "preseason-workflow",
    );
    expect(elementIds.has("preseason-workflow")).toBe(true);

    expect(resolveFoundationPanelScrollTarget({ panel: "season-review", targetView: "cockpit" })).toBe(
      "season-review-preview",
    );
    expect(elementIds.has("season-review-preview")).toBe(true);
  });
});

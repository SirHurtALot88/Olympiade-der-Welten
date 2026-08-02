/**
 * GEMELDET AUS DEM SPIEL (Screenshot der Inbox): "Springe zu teams." und "Springe zu trainingV2."
 *
 * Der Spieler bekam interne Routen-Bezeichner als Satz vorgesetzt. Die Ursache war eine einzige
 * Textzeile, die `item.targetView` einsetzte — an zwei Stellen dupliziert
 * (`inbox-quick-action-service.ts` und der Inline-Block im Router-Body).
 *
 * Geprueft wird hier die REGEL, nicht die zwei Zeilen:
 *
 *  1. Kein Bezeichner darf in einen Nutzertext geraten — das Muster "Springe zu ${...}" ist weg und
 *     darf nicht zurueckkehren.
 *  2. Jedes Ziel, das der Inbox-Service ueberhaupt vergibt, muss einen Klartextnamen haben.
 *     Ein neues Ziel ohne Namen faellt hier auf, bevor es jemand im Spiel liest.
 *  3. Der Name kommt aus den Nav-Gruppen — die Inbox kann also nicht anders heissen als der Reiter,
 *     auf dem man landet.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import {
  describeInboxTargetDestination,
  resolveInboxTargetLabel,
  resolveInboxTargetViewLabel,
} from "@/lib/foundation/inbox-target-labels";

const INBOX_SERVICE = fs.readFileSync(path.join(process.cwd(), "lib/foundation/game-inbox-service.ts"), "utf8");

/** Alle `targetView`-Werte, die der Service vergibt. */
function collectServiceTargetViews(): string[] {
  return [...new Set([...INBOX_SERVICE.matchAll(/targetView:\s*"([^"]+)"/g)].map((match) => match[1]!))];
}

describe("Inbox-Ziele tragen einen Namen, den ein Mensch lesen kann", () => {
  it("der Bezeichner steht nirgends mehr in einem Nutzertext", () => {
    const offenders = ["lib/foundation/inbox-quick-action-service.ts", "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"]
      .filter((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8").includes("Springe zu ${"));
    expect(offenders, "der Routen-Bezeichner darf nicht als Satz ausgegeben werden").toEqual([]);
  });

  it("jedes Ziel des Inbox-Service hat einen Klartextnamen", () => {
    const views = collectServiceTargetViews();
    expect(views.length).toBeGreaterThan(5);
    const unnamed = views.filter((view) => resolveInboxTargetViewLabel(view) == null);
    expect(unnamed, `${unnamed.length} Inbox-Ziele wuerden ohne Namen angezeigt`).toEqual([]);
  });

  it("die Namen kommen aus den Nav-Gruppen, nicht aus einer zweiten Liste", () => {
    // Die drei Faelle, an denen sich die Verwechslung im Spiel gezeigt hat.
    expect(resolveInboxTargetViewLabel("trainingV2")).toBe("Gebäude");
    expect(resolveInboxTargetViewLabel("trainingCompact")).toBe("Training");
    expect(resolveInboxTargetViewLabel("teams")).toBe("Teams");

    const navLabels = new Set(FOUNDATION_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label)));
    expect(navLabels.has(resolveInboxTargetViewLabel("trainingV2")!)).toBe(true);
  });

  it("Aliase finden ihren Reiter (market → Transfermarkt, history → Historie, season → Saisonstand)", () => {
    expect(resolveInboxTargetViewLabel("market")).toBe("Transfermarkt");
    expect(resolveInboxTargetViewLabel("history")).toBe("Historie");
    expect(resolveInboxTargetViewLabel("season")).toBe("Saisonstand");
  });

  it("das Panel sagt, wo genau auf der Seite", () => {
    expect(resolveInboxTargetLabel({ targetView: "teams", targetParams: { panel: "contracts" } })).toBe("Teams · Verträge");
    expect(resolveInboxTargetLabel({ targetView: "matchdayArena", targetParams: { panel: "arena-result-summary" } })).toBe(
      "Arena · Ergebnis",
    );
  });

  it("ein Panel, das den Reiter nur wiederholt, wird weggelassen", () => {
    // "Gebäude · Gebäude" waere albern.
    expect(resolveInboxTargetLabel({ targetView: "trainingV2", targetParams: { panel: "facilities" } })).toBe("Gebäude");
  });

  it("ein unbekanntes Ziel wird lieber gar nicht benannt als falsch", () => {
    expect(resolveInboxTargetLabel({ targetView: "gibt-es-nicht" })).toBeNull();
    // Der Aufrufer bekommt dann einen neutralen Satz — aber nie den Bezeichner.
    const fallback = describeInboxTargetDestination({ targetView: "gibt-es-nicht" });
    expect(fallback).not.toContain("gibt-es-nicht");
  });

  it("der Quick-Action-Text nennt das Ziel beim Namen", () => {
    expect(describeInboxTargetDestination({ targetView: "trainingV2", targetParams: { panel: "facilities" } })).toBe(
      "Öffnet: Gebäude",
    );
  });
});

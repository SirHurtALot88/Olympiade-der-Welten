import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildLineupMiniAudit } from "@/lib/lineups/lineup-audit";

/**
 * NACHGEZOGEN (P1 / „String nirgends" — je Fall entschieden, nicht pauschal umgebogen):
 *
 * Diese Datei prüfte zwei Zeichenketten in `LegacyLineupLabClient.tsx`:
 * `data-testid="legacy-lineup-flow-checklist"` und `legacy-lineup-role-lanes`. Beide sind
 * mit dem physischen Ausbau des toten „Legacy Looks" verschwunden (Commit `32683df8`,
 * „Neuer Look is permanently on, so every legacy fallback branch is unreachable" — die dortige
 * Zusage „testids unchanged" stimmt für genau diese beiden nicht). Nachgemessen, was das für
 * die FUNKTION bedeutet — die beiden Fälle liegen unterschiedlich:
 *
 *  1) FLOW-CHECKLISTE: lebt weiter, nur an anderer Stelle und unter anderem Namen. Die alten
 *     vier Punkte („Slots voll", „Form geplant", „Captain ok", „Save bereit") sind heute
 *     `buildLineupMiniAudit` (`lib/lineups/lineup-audit.ts`); die gerenderte Ansicht
 *     `LineupNewLook.tsx` zeigt sie als `lineupFinishItems` im Speichern-Dialog. Also
 *     UMGEZOGEN, nicht entfernt — und weil der Rechenkern jetzt in `lib/` liegt, wird hier
 *     nicht mehr die Zeichenkette geprüft, sondern der WERT.
 *
 *  2) ROLE LANES: waren zwei feste Beschriftungen ohne jede Datenbindung
 *     (`<span class="legacy-lineup-role-lane is-early">Early Phase</span>` /
 *     `is-late">Late Phase`). Reine Dekoration, kein Nachfolger, kein Verlust an Auskunft —
 *     die Rollen je Slot trägt heute `slotRoleByKey`/`resolveSlotRolesForDiscipline`.
 *     Die CSS-Regeln in `app/globals.css` sind seither tot; das steht unten als Befund.
 */
describe("legacy lineup velo ui contract", () => {
  it("meldet die Startaufstellung als fertig, sobald Slots, Captain und Formquelle stehen", () => {
    const fertig = buildLineupMiniAudit({
      openSlots: 0,
      allAvailablePlayersDeployed: false,
      selectedCount: 6,
      totalRequired: 6,
      duplicateSelectionsCount: 0,
      captainBudgetExceeded: false,
      captainUsedBeforeCurrentDraft: 0,
      captainDraftUsedCount: 1,
      captainSeasonLimit: 3,
      captains: { d1: "active-1", d2: "active-2" },
      d1Label: "D1",
      d2Label: "D2",
      captainSeasonUsedWithDraft: 1,
      missingSeasonFormCards: false,
      moraleAtRiskCount: 0,
      moraleNetDelta: 0,
      previewWarningsCount: 0,
    });

    expect(fertig.status).toBe("ready");
    expect(fertig.blockingItems).toHaveLength(0);
    expect(fertig.warningItems).toHaveLength(0);
    // „Slots voll" und „Captain ok" der alten Checkliste — jetzt als Werte.
    expect(fertig.items.find((item) => item.key === "open-slots")).toMatchObject({
      tone: "ready",
      detail: "6/6 voll",
    });
    expect(fertig.items.find((item) => item.key === "captain")?.tone).toBe("ready");
    // „Form geplant": ohne fehlende Quelle taucht der Punkt gar nicht erst auf.
    expect(fertig.items.some((item) => item.key === "form-source")).toBe(false);
  });

  it("meldet offene Slots, Doppelwahl, Captain-Limit und fehlende Formquelle einzeln", () => {
    const offen = buildLineupMiniAudit({
      openSlots: 2,
      allAvailablePlayersDeployed: false,
      selectedCount: 4,
      totalRequired: 6,
      duplicateSelectionsCount: 1,
      captainBudgetExceeded: true,
      captainUsedBeforeCurrentDraft: 3,
      captainDraftUsedCount: 1,
      captainSeasonLimit: 3,
      captains: { d1: "active-1", d2: "" },
      d1Label: "D1",
      d2Label: "D2",
      captainSeasonUsedWithDraft: 4,
      missingSeasonFormCards: true,
      moraleAtRiskCount: 2,
      moraleNetDelta: -1.5,
      previewWarningsCount: 1,
    });

    expect(offen.status).toBe("blocked");
    expect(offen.items.map((item) => item.key)).toEqual([
      "open-slots",
      "duplicates",
      "captain",
      "form-source",
      "morale",
      "preview",
    ]);
    expect(offen.blockingItems.map((item) => item.key)).toEqual(["open-slots", "duplicates", "captain"]);
    expect(offen.items.find((item) => item.key === "open-slots")?.detail).toBe("2 offen");
    expect(offen.items.find((item) => item.key === "captain")?.detail).toBe("4/3 Limit");
    expect(offen.items.find((item) => item.key === "form-source")?.detail).toBe("Quelle fehlt");
  });

  it("reicht die Checkliste bis in die gerenderte Ansicht durch", async () => {
    const [clientText, newLookText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"), "utf8"),
    ]);
    // Die einzige Naht, die kein Wert-Test erreichen kann: derselbe Rechenkern muss auch
    // wirklich an der Ansicht ankommen (sonst rechnet der Test etwas, das niemand sieht).
    expect(clientText).toContain("buildLineupMiniAudit({");
    expect(clientText).toContain("lineupMiniAudit.items.slice(0, 6)");
    expect(clientText).toContain("lineupFinishItems={lineupFinishItems}");
    expect(newLookText).toContain("lineupFinishItems.map((item)");
  });

  it("BEFUND: die CSS-Regeln der abgebauten Legacy-Ansicht stehen noch in globals.css", async () => {
    const cssText = await fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8");
    // Bewusst als das markiert, was es ist: eine WACHE über totem CSS, keine Funktionsprüfung.
    // Keine .tsx-Datei rendert diese Klassen noch (Commit 32683df8). Wird der Ausbau
    // nachgeholt, fällt dieser Test und die Zeile hier verschwindet mit ihm.
    expect(cssText).toContain(".legacy-lineup-flow-checklist");
    expect(cssText).toContain(".legacy-lineup-role-lane");
  });
});

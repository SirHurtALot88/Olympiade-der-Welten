import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { baueTaktPlan, entscheideLeertaste } from "@/lib/foundation/foundation-takt-plan";
import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";
import { abonniereTaktAblauf, getTaktAblaufOffen, setTaktAblaufOffen } from "@/lib/foundation/takt-ablauf-store";

const schritt = (stepId: string, status: GameFlowStep["status"], extra: Partial<GameFlowStep> = {}): GameFlowStep => ({
  stepId,
  label: stepId,
  cta: stepId,
  status,
  targetView: "lineup",
  blockers: [],
  warnings: [],
  ...extra,
});

const basis = { textZiel: false, dialogOffen: false, eigeneLeertaste: false, deaktiviert: false, anzahlKritisch: 0, ablaufOffen: false };

describe("Leertaste = weiter (Taktgeber, 18.11.)", () => {
  it("ohne kritische Punkte geht die Leertaste weiter (ruft die Taktgeber-Aktion)", () => {
    expect(entscheideLeertaste(basis)).toBe("weiter");
  });

  it("bei kritischen Punkten geht sie NICHT weiter: erst Ablauf zeigen, beim zweiten Druck springen", () => {
    expect(entscheideLeertaste({ ...basis, anzahlKritisch: 1 })).toBe("ablauf-zeigen");
    expect(entscheideLeertaste({ ...basis, anzahlKritisch: 2, ablaufOffen: true })).toBe("springen");
  });

  it("löst nicht aus: Textfeld, Dialog, Ansicht mit eigener Leertaste (Arena), laufende Aktion", () => {
    for (const aus of [{ textZiel: true }, { dialogOffen: true }, { eigeneLeertaste: true }, { deaktiviert: true }]) {
      expect(entscheideLeertaste({ ...basis, ...aus })).toBe("ignorieren");
      expect(entscheideLeertaste({ ...basis, ...aus, anzahlKritisch: 3 })).toBe("ignorieren");
    }
  });

  it("der Scope-Hook ruft die Entscheidung auf und löst dieselbe Aktion aus wie der Knopf", () => {
    const hook = readFileSync(path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");
    expect(hook).toContain("entscheideLeertaste({");
    expect(hook).toContain("void triggerGlobalNext();");
    // Die Arena behält ihre eigene Leertaste (Pause).
    expect(hook).toContain('activeView === "matchdayArena"');
    const router = readFileSync(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
    expect(router).toContain("onClick: triggerGlobalNext");
    expect(router).toContain("plan: taktPlan");
  });
});

describe("Taktplan: Pflichtschritte und kritische Punkte", () => {
  const baue = (steps: GameFlowStep[], currentStepId: string, inbox: Parameters<typeof baueTaktPlan>[0]["inbox"] = []) =>
    baueTaktPlan({ steps, currentStepId, formatGrund: (g) => `Grund ${g}`, sprungZuSchritt: (s) => () => void s, inbox });

  it("Haken für Erledigtes, Rot für Blocker, Gelb für Optionales; spätere rote Schritte sind nicht kritisch", () => {
    const plan = baue(
      [
        schritt("training", "completed"),
        schritt("set_lineup", "blocked", { blockers: ["lineup_incomplete"] }),
        schritt("open_arena", "blocked", { blockers: ["lineup_missing"] }),
        schritt("facilities", "warning", { optional: true, warnings: ["facility_condition_low"] }),
      ],
      "set_lineup",
    );
    expect(plan.schritte.map((s) => s.status)).toEqual(["erledigt", "rot", "offen", "gelb"]);
    expect(plan.kritisch.map((s) => s.id)).toEqual(["schritt:set_lineup"]);
    expect(plan.schritte[1].detail).toBe("Grund lineup_incomplete");
    expect(plan.schritte[0].sprung).toBeUndefined();
  });

  it("kritische Inbox-Einträge (Minuskarte, Verletzter, Kasse < 0) halten auf, Warnungen nicht", () => {
    const sprung = vi.fn();
    const plan = baue([schritt("set_lineup", "ready")], "set_lineup", [
      { id: "minus", title: "Pflicht-Minuskarte", detail: "legen", severity: "critical", sprung },
      { id: "kasse", title: "Kasse unter null", detail: "Kassensturz", severity: "critical", sprung },
      { id: "vertrag", title: "Vertrag läuft aus", detail: "", severity: "warning", sprung },
      { id: "info", title: "Scout-Bericht", detail: "", severity: "info", sprung },
    ]);
    expect(plan.kritisch.map((k) => k.label)).toEqual(["Pflicht-Minuskarte", "Kasse unter null"]);
    expect(plan.schritte.some((s) => s.label === "Scout-Bericht")).toBe(false);
    plan.kritisch[0].sprung?.();
    expect(sprung).toHaveBeenCalledTimes(1);
  });

  it("vor Spieltag 1 entfällt „Letzten Spieltag prüfen“, danach steht er wieder da", () => {
    const schritte = [schritt("review_last_matchday", "ready"), schritt("set_lineup", "ready")];
    const vor = baueTaktPlan({ steps: schritte, currentStepId: "set_lineup", formatGrund: (g) => g, sprungZuSchritt: () => () => undefined, inbox: [], hatGespielt: false });
    expect(vor.schritte.some((s) => s.id === "schritt:review_last_matchday")).toBe(false);
    const nach = baueTaktPlan({ steps: schritte, currentStepId: "set_lineup", formatGrund: (g) => g, sprungZuSchritt: () => () => undefined, inbox: [], hatGespielt: true });
    expect(nach.schritte.some((s) => s.id === "schritt:review_last_matchday")).toBe(true);
  });

  it("„Lineup fehlt“ (Inbox) und der Schritt „Einsatzliste setzen“ sind EIN Eintrag, rot, wenn kritisch", () => {
    const plan = baue([schritt("set_lineup", "ready", { label: "Einsatzliste setzen", warnings: ["lineup_pending"] })], "set_lineup", [
      { id: "l", title: "Lineup fehlt", detail: "Einsatzliste unvollständig", severity: "critical", sprung: () => undefined },
    ]);
    expect(plan.schritte).toHaveLength(1);
    expect(plan.schritte[0]).toMatchObject({ id: "schritt:set_lineup", label: "Einsatzliste setzen", status: "rot" });
    expect(plan.kritisch.map((k) => k.id)).toEqual(["schritt:set_lineup"]);
  });

  it("alles in Ordnung: keine kritischen Punkte", () => {
    expect(baue([schritt("set_lineup", "ready")], "set_lineup").kritisch).toEqual([]);
  });
});

describe("Ablauf-Speicher", () => {
  it("meldet Änderungen an Abonnenten und ignoriert gleiche Werte", () => {
    const hoerer = vi.fn();
    const ab = abonniereTaktAblauf(hoerer);
    setTaktAblaufOffen(true);
    setTaktAblaufOffen(true);
    expect(getTaktAblaufOffen()).toBe(true);
    setTaktAblaufOffen(false);
    ab();
    expect(hoerer).toHaveBeenCalledTimes(2);
  });
});

describe("Sponsorwahl offen vor Spieltag 1 (23.11.)", () => {
  it("zeigt den optionalen Sponsor-Schritt gelb, ohne den Spieltag zu sperren", () => {
    const plan = baueTaktPlan({
      steps: [
        schritt("choose_sponsor", "optional", { optional: true, warnings: ["sponsor_choice_open_before_matchday_1"] }),
        schritt("set_lineup", "ready"),
      ],
      currentStepId: "set_lineup",
      formatGrund: (g) => g,
      sprungZuSchritt: () => () => undefined,
      inbox: [],
    });
    const eintrag = plan.schritte.find((s) => s.id === "schritt:choose_sponsor");
    expect(eintrag?.status).toBe("gelb");
    expect(plan.kritisch).toHaveLength(0);
  });
});

import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

// FoundationPageClient.tsx is now a 25-line wrapper; the Pre-Season Workflow
// UI lives in FoundationCockpitPanel.tsx, with request wiring in cockpit-handlers.ts.
const cockpitPanelPath = path.join(process.cwd(), "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");
const cockpitHandlersPath = path.join(process.cwd(), "lib/foundation/tabs/cockpit-handlers.ts");

describe("pre-season workflow ui contract", () => {
  it("renders the pre-season wizard with explicit human ai split and confirm-only next season apply", async () => {
    const [panelText, handlersText] = await Promise.all([
      fs.readFile(cockpitPanelPath, "utf8"),
      fs.readFile(cockpitHandlersPath, "utf8"),
    ]);
    const fileText = `${panelText}\n${handlersText}`;

    expect(fileText).toContain("Pre-Season Workflow");
    expect(fileText).toContain("/api/season/preseason-workflow");
    expect(fileText).toContain("Pre-Season Preview laden");
    expect(fileText).toContain("Saisonwechsel-Assistent prüfen");
    expect(fileText).toContain("Geführte Teams: warten auf deine Entscheidung");
    expect(fileText).toContain("Auto-Teams: Verkauf/Kauf bereit");
    expect(fileText).toContain("Beobachtete Teams: übersprungen");
    // "Preisgeld & Finanzen" -> "Sponsor & Finanzen": prize money is now only a
    // background benchmark (see "Preisgeld ist nur noch Hintergrund-Benchmark"
    // / "Preisgeld ist nur Benchmark" comments nearby), sponsor payouts are the
    // real cash flow now, so the section was relabeled to match.
    expect(fileText).toContain("Sponsor & Finanzen");
    expect(fileText).toContain("Sponsor");
    expect(fileText).toContain("Facilities");
    expect(fileText).toContain("Verlängern");
    /**
     * HIER STANDEN ZWEI PRUEFUNGEN, DIE NICHTS BELEGT HABEN:
     *
     * 1. `toContain("Season-End Review")` — die Ueberschrift heisst seit dem Umbau
     *    „Season Review" (Schritt `season_review` im Dienst). Reine Umbenennung; die
     *    Zusicherung, DASS der Saisonrueckblick der erste Schritt ist, wird jetzt unten
     *    ueber WERTE geprueft statt ueber eine Ueberschrift.
     * 2. `toContain("RankChange: Season 1 nutzt Startbudget als StartRank")` — das war
     *    ein KOMMENTAR im Quelltext. Eine Zusicherung auf einen Kommentar ist keine:
     *    sie faellt, wenn jemand den Kommentar umformuliert, und sie haelt, wenn jemand
     *    die Rechnung darunter zerstoert. Ersatzlos gestrichen; die Rechnung selbst
     *    (`rankChangePrize`) haengt an den Preisgeld-Tests.
     */
    expect(fileText).toContain("Season Review");
    expect(fileText).toContain("already_applied");
    expect(fileText).not.toContain("confirmToken: setupStep.confirmToken");
  });

  /**
   * DIE REIHENFOLGE DES ASSISTENTEN — ueber Werte statt ueber Ueberschriften.
   *
   * Der Assistent hat eine Reihenfolge, und die traegt eine Aussage: erst ansehen, was
   * die Saison ergeben hat, dann Geld, dann Kader. Wer den Rueckblick nach hinten
   * schiebt oder einen produktiven Schritt vor die Bestaetigung zieht, aendert das
   * Spiel — und genau das faellt hier auf, unabhaengig davon, wie die Schritte heissen.
   */
  it("der Saisonwechsel beginnt mit dem Rueckblick, und der schreibt noch nichts", async () => {
    const { PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN } = await import(
      "@/lib/season/preseason-workflow-service"
    );
    // Der Sammel-Schritt am Ende ist der EINZIGE, der ohne Bestaetigung nicht laeuft —
    // das Token ist die Bestaetigung, und es ist eine Konstante, kein Zufallswert.
    expect(PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN).toBe("APPLY_PRESEASON_NEXT_SEASON_SETUP");

    const service = await fs.readFile(
      path.join(process.cwd(), "lib/season/preseason-workflow-service.ts"),
      "utf8",
    );
    // Reihenfolge der Schritte im gebauten Ablauf: Rueckblick zuerst, Praemien danach.
    const reihenfolge = [...service.matchAll(/stepId: "([a-z_]+)"/g)].map((treffer) => treffer[1]);
    expect(reihenfolge).toContain("season_review");
    expect(reihenfolge.indexOf("season_review")).toBeLessThan(reihenfolge.indexOf("season_rewards"));
    // Der Rueckblick ist „preview_only" — er darf nichts buchen.
    const rueckblickBlock = service.slice(
      service.indexOf('stepId: "season_review"'),
      service.indexOf('stepId: "season_rewards"'),
    );
    expect(rueckblickBlock).toContain('status: "preview_only"');
    expect(rueckblickBlock).toContain("productive: false");
    expect(rueckblickBlock).toContain("confirmToken: null");
  });
});

/**
 * Paket F4: „Eine Quelle pro Größe" — die vier Zahlen-Widersprüche.
 *
 *  1. Home „5 offen" vs. Inbox „11 offen": Home zeigte die Länge der auf 5
 *     gekappten Anzeige-Liste als Gesamtzahl. Quelle ist jetzt beidseitig
 *     `activeTeamDecisionInboxItems` — die Liste hinter dem Inbox-Zähler.
 *  2. Achsen 55/40/42/44 (Home-Radar) vs. 54/39/39/41 (Office): zwei
 *     verschiedene Schnitte. Quelle ist jetzt `computeTeamTopSixAxisStats`
 *     (Ø Top-6 je Achse) — dieselbe Basis wie die Markt-Impact-Vorschau,
 *     beide Anzeigen sind mit „Ø Top-6" beschriftet.
 *  3. Gehälter 52,1 (Finanzen) vs. 64,1 (Kredite): der Kredit-Chart zeigte
 *     die Apron-/Sponsor-GLÄTTUNG (`expectedSalary`) als Cashflow. Quelle
 *     für Cashflow-Anzeigen ist jetzt `getTeamActualSalaryTotal`
 *     (`contract.salary` — das Feld, das die Season-End-Resolution abbucht).
 *     Am echten Spielstand (S-C, Season 2): Chart-Summe 64,7 → 52,7 gegen
 *     64,1 Einnahmen — das Badge kippt korrekt von „Deckungslücke" auf
 *     „Gedeckt". Apron/Sponsor/KI rechnen intern unverändert mit der Glättung.
 *  4. Lineup „0/9 · 9 offen" (Ring, zählt SLOTS) vs. „Noch 1 offen" (CTA,
 *     zählte BLOCKER-KATEGORIEN): der CTA benennt Blocker jetzt wörtlich
 *     („9 Slots offen") statt eine eigene „Dinge"-Einheit zu zählen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { computeTeamTopSixAxisStats } from "@/lib/market/transfermarkt-roster-impact";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { buildLineupSaveCta } from "@/lib/lineups/lineup-audit";
import type { GameState } from "@/lib/data/olyDataTypes";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

/* ------------------------------------------------------------------ */
/* Fall 1: Home-Zähler === Inbox-Zähler                                */
/* ------------------------------------------------------------------ */

describe("Fall 1: Home und Inbox zählen dieselbe Entscheidungsliste", () => {
  it("der Live-Pfad (Router-Body-Scope) zählt die volle Liste, nicht die Top-5", () => {
    const scope = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    expect(scope).toContain("const homeOpenTaskCount = shouldBuildHomeV2Overview ? activeTeamDecisionInboxItems.length : 0;");
    // Die Anzeige-Liste kommt aus DERSELBEN Quelle (nur sortiert + gekappt) …
    expect(scope).toContain("return [...activeTeamDecisionInboxItems]");
    // … und der alte Home-eigene Filter über alle Team-Items ist raus.
    expect(scope).not.toContain('item.category === "task" || item.category === "warning" || item.severity === "critical"');
  });

  it("die Inbox zählt dieselbe Liste", () => {
    expect(quelle("app/foundation/inbox-v2/FoundationInboxV2Host.tsx")).toContain(
      "openCount={activeTeamDecisionInboxItems.length}",
    );
  });

  it("das Home-Markup rendert den vollen Zähler und benennt den gekappten Rest", () => {
    const markup = quelle("app/foundation/home-v2/HomeV2NewLook.tsx");
    expect(markup).toContain("{inboxOpenCount} offen");
    expect(markup).not.toContain("{inboxItems.length} offen");
    expect(markup).toContain("weitere in der Inbox");
  });

  it("auch der Host-Pfad exportiert den Zähler aus der vollen Liste", () => {
    const hook = quelle("lib/foundation/tabs/use-home-v2-overview-derivations.ts");
    expect(hook).toContain("const homeOpenTaskCount = activeTeamDecisionInboxItems.length;");
  });

  it("die Und-weitere-Zeile hat eine existierende CSS-Klasse (beidseitig)", () => {
    expect(quelle("app/globals.css")).toMatch(/\.nl-home-inbox-more[\s.,:{[>)]/);
    expect(quelle("app/foundation/home-v2/HomeV2NewLook.tsx")).toContain("nl-home-inbox-more");
  });
});

/* ------------------------------------------------------------------ */
/* Fall 2: EINE Achsen-Zusammenfassung (Ø Top-6)                       */
/* ------------------------------------------------------------------ */

describe("Fall 2: Radar, Office und Markt teilen sich Ø Top-6 je Achse", () => {
  it("computeTeamTopSixAxisStats mittelt die sechs besten Werte je Achse", () => {
    const roster = Array.from({ length: 8 }, (_, i) => ({
      // pow absteigend 80..73 → Top-6 = 80..75, Ø = 77.5
      coreStats: { pow: 80 - i, spe: 50, men: 60, soc: 40 },
    }));
    const stats = computeTeamTopSixAxisStats(roster);
    expect(stats).not.toBeNull();
    expect(stats!.pow).toBeCloseTo(77.5, 5);
    expect(stats!.spe).toBeCloseTo(50, 5);
  });

  it("leerer Kader: null statt erfundener Nullen", () => {
    expect(computeTeamTopSixAxisStats([])).toBeNull();
  });

  it("beide Anzeigen hängen an derselben Ableitung und beschriften die Basis", () => {
    const body = quelle("app/foundation/FoundationShellRouterBody.tsx");
    // Office-Props und Home-Radar bekommen DENSELBEN Wert.
    expect(body).toContain("teamAxisAverages: selectedTeamTopSixAxisStats");
    expect(body).toContain("selectedTeamTopSixAxisStats,");
    const scope = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    expect(scope).toContain("computeTeamTopSixAxisStats(rosterPlayers.map(({ player }) => player))");
    // Das Radar rechnet nicht mehr selbst aus den Portrait-Karten.
    const markup = quelle("app/foundation/home-v2/HomeV2NewLook.tsx");
    expect(markup).toContain("teamAxisAverages[key]");
    expect(markup).toContain("Ø Top-6");
    const office = quelle("app/foundation/home-v2/ManagerOfficeClient.tsx");
    expect(office).toContain("Ø Top-6");
  });
});

/* ------------------------------------------------------------------ */
/* Fall 3: Gehälter — echte Summe für Cashflow, Glättung für Apron     */
/* ------------------------------------------------------------------ */

/** Minimaler GameState wie in finances-league-table-actual-salary.test.ts. */
function gameStateWithSalaries(entries: Array<{ salary: number; expectedSalary: number }>): GameState {
  return {
    season: { id: "season-1" },
    gamePhase: "season_completed",
    matchdayState: { matchdayId: "matchday-10" },
    teams: [{ teamId: "T1", shortCode: "T-1", name: "Testteam", cash: 10 }],
    players: entries.map((_, index) => ({ id: `p${index}`, name: `Spieler ${index}` })),
    rosters: entries.map((entry, index) => ({
      id: `r${index}`,
      teamId: "T1",
      playerId: `p${index}`,
      salary: entry.salary,
      calculatedSalary: entry.expectedSalary,
      contractLength: 1,
    })),
    disciplines: [],
    seasonState: {
      seasonId: "season-1",
      standings: {},
      schedule: [],
      matchdayResults: [],
      disciplineResults: [],
      sponsorContractsByTeamId: {},
      sponsorPayoutLogs: [],
      lineupDrafts: [],
    },
    transferHistory: [],
  } as never;
}

describe("Fall 3: getTeamActualSalaryTotal ist die Cashflow-Summe", () => {
  it("summiert contract.salary — die Rate, die JETZT fällig wird", () => {
    // Front-loaded Vertrag: jetzt 13,34 fällig, Formel-Mittel 9,74.
    const state = gameStateWithSalaries([
      { salary: 13.34, expectedSalary: 9.74 },
      { salary: 5.48, expectedSalary: 4.99 },
    ]);
    expect(getTeamActualSalaryTotal(state, "T1")).toBeCloseTo(18.82, 1);
    // Die Glättung bevorzugt expectedSalary — im Quelltext festgehalten
    // (synthetische Kadereinträge tragen kein Formel-expectedSalary, deshalb
    // hier Quelltext- statt Wert-Assertion; am echten Spielstand gemessen:
    // 64,1 geglättet vs. 52,1 echt für S-C).
    const display = quelle("lib/sponsor/sponsor-team-salary-display.ts");
    expect(display).toContain("const salary = contract.expectedSalary ?? normalizeEconomyMoney(contract.salary) ?? 0;");
  });

  it("der Kredite-Chart nutzt die echte Summe", () => {
    const credits = quelle("lib/foundation/credits/use-credits-view-model.ts");
    expect(credits).toContain("getTeamActualSalaryTotal(gameState, teamId)");
    expect(credits).not.toContain("getTeamDisplaySalaryTotal(");
  });

  it("die Finanzen-Seite summiert über denselben Helper", () => {
    expect(quelle("lib/foundation/finances/use-finances-view-model.ts")).toContain(
      "const salaryTotal = getTeamActualSalaryTotal(gameState, teamId);",
    );
  });

  it("Apron und Sponsor bleiben auf der Glättung (Bemessungsgrundlage)", () => {
    expect(quelle("lib/season/apron-service.ts")).toContain("getTeamDisplaySalaryTotal");
    expect(quelle("lib/finance/apron-projection.ts")).toContain("getTeamDisplaySalaryTotal");
    expect(quelle("lib/sponsor/sponsor-team-salary-display.ts")).toContain(
      "contract.expectedSalary ?? normalizeEconomyMoney(contract.salary)",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Fall 4: Lineup-CTA benennt Blocker statt „Dinge" zu zählen          */
/* ------------------------------------------------------------------ */

describe("Fall 4: ein Restzähler, eine Wahrheit", () => {
  const basis = {
    allAvailablePlayersDeployed: false,
    captainBudgetExceeded: false,
    captainUsedBeforeCurrentDraft: 0,
    captainDraftUsedCount: 0,
    captainSeasonLimit: 3,
    duplicateSelectionsCount: 0,
    hasDraft: false,
    lineupReadyToSave: false,
    captains: { d1: "", d2: "" },
  };

  it("9 offene Slots: CTA sagt dasselbe wie der Ring — 9 Slots offen", () => {
    const cta = buildLineupSaveCta({ ...basis, openSlots: 9 });
    expect(cta.label).toBe("9 Slots offen");
    expect(cta.buttonLabel).toBe("9 Slots offen");
    // Die alte Kategorie-Zählung („Noch 1 offen" für 9 offene Slots) ist raus.
    expect(cta.label).not.toContain("Noch 1");
    expect(cta.label).not.toContain("Ding");
  });

  it("mehrere Blocker werden ausdrücklich als Blocker gezählt", () => {
    const cta = buildLineupSaveCta({ ...basis, openSlots: 2, duplicateSelectionsCount: 1 });
    expect(cta.label).toBe("2 Blocker offen");
    expect(cta.buttonLabel).toBe("2 Blocker");
    expect(cta.detail).toContain("2 Slots offen");
    expect(cta.detail).toContain("1 Konflikt");
  });

  it("keine Blocker, aber nicht bereit: ehrliches Noch-nicht-bereit", () => {
    const cta = buildLineupSaveCta({ ...basis, openSlots: 0 });
    expect(cta.label).toBe("Noch nicht bereit");
  });
});

/**
 * HISTORIE · TRANSFERS (Mockup 18.11.): der Kaderaufbau vor Saison 1 ist KEIN Transfer (Buchungsregel #1634, „Fenster
 * vor Saison N gehoert zu Saison N, Draft = Kaderaufbau, Transferbilanz S1 = —").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  bilanzJeTeam,
  dealArt,
  dealsAlsCsv,
  fensterNummer,
  trenneKaderaufbau,
  zeitText,
  type HistorieDealZeile,
} from "@/lib/foundation/historie-transfers";

function deal(teil: Partial<HistorieDealZeile> & { transferId: string }): HistorieDealZeile {
  return {
    playerId: `p-${teil.transferId}`,
    playerName: `Spieler ${teil.transferId}`,
    seasonId: "season-1",
    seasonLabel: "Season 1",
    type: "buy",
    fromTeamId: null,
    fromTeamName: null,
    toTeamId: "t1",
    toTeamName: "Alpha",
    fee: 10,
    salary: 2,
    marketValue: 9,
    guv: null,
    happenedAt: "2026-01-01T00:00:00Z",
    matchdayId: "season-1-matchday-1",
    buchungsArt: "kaderaufbau",
    ...teil,
  };
}

describe("Kaderaufbau getrennt von Transfers", () => {
  const zeilen = [
    deal({ transferId: "k1" }),
    deal({ transferId: "k2", toTeamId: "t2", toTeamName: "Beta", fee: 20 }),
    deal({ transferId: "t3", seasonId: "season-2", seasonLabel: "Season 2", matchdayId: "season-2-matchday-1", buchungsArt: "transfer", fromTeamId: null, toTeamId: "t2", toTeamName: "Beta" }),
    deal({ transferId: "t5", seasonId: "season-2", seasonLabel: "Season 2", type: "sell", matchdayId: "season-2-matchday-1", buchungsArt: "transfer", fromTeamId: "t1", fromTeamName: "Alpha", toTeamId: null, toTeamName: null }),
    deal({ transferId: "a4", seasonId: "season-2", seasonLabel: "Season 2", type: "contract_exit", buchungsArt: "vertragsende", fromTeamId: "t2", fromTeamName: "Beta", toTeamId: null, toTeamName: null, fee: 0 }),
  ];

  it("trennt Kaderaufbau, Transfers und Abgaenge", () => {
    const { kaderaufbau, transfers, abgaenge } = trenneKaderaufbau(zeilen);
    expect(kaderaufbau.map((z) => z.transferId)).toEqual(["k1", "k2"]);
    expect(transfers.map((z) => z.transferId)).toEqual(["t3", "t5"]);
    expect(abgaenge.map((z) => z.transferId)).toEqual(["a4"]);
  });

  it("die Bilanz je Team aus Transfers enthaelt den Kaderaufbau nicht", () => {
    const { transfers } = trenneKaderaufbau(zeilen);
    const bilanz = bilanzJeTeam(transfers);
    const alpha = bilanz.find((b) => b.teamId === "t1")!;
    const beta = bilanz.find((b) => b.teamId === "t2")!;
    expect(alpha.ein).toBe(10);
    expect(alpha.aus).toBe(0);
    expect(beta.aus).toBe(10);
    // Die zwei Draft-Picks (10 + 20) stehen in keiner Zahl.
    expect(bilanz.reduce((s, b) => s + b.aus, 0)).toBe(10);
  });

  it("der Kaderaufbau hat seine eigene Bilanz: Picks und Summe je Team", () => {
    const { kaderaufbau } = trenneKaderaufbau(zeilen);
    const bilanz = bilanzJeTeam(kaderaufbau);
    expect(bilanz.find((b) => b.teamId === "t2")).toMatchObject({ kaeufe: 1, aus: 20 });
    expect(bilanz.find((b) => b.teamId === "t1")).toMatchObject({ kaeufe: 1, aus: 10 });
  });

  it("Zeit: Saisonende-Verkaeufe, vor Spieltag 1, Spieltag n", () => {
    expect(zeitText({ seasonId: "season-1", seasonLabel: "Season 2", matchdayId: "season-1-matchday-20" })).toBe("Ende S1");
    expect(zeitText({ seasonId: "season-2", seasonLabel: "Season 2", matchdayId: "season-2-matchday-1" })).toBe("vor ST 1");
    expect(zeitText({ seasonId: "season-2", seasonLabel: "Season 2", matchdayId: "season-2-matchday-7" })).toBe("ST 7");
    expect(fensterNummer({ seasonId: "season-1", seasonLabel: "Season 2" })).toBe(2);
  });

  it("Art und CSV", () => {
    expect(zeilen.map(dealArt)).toEqual(["kauf", "kauf", "kauf", "verkauf", "abgang"]);
    const csv = dealsAlsCsv(zeilen);
    expect(csv.split("\n")).toHaveLength(zeilen.length + 1);
    expect(csv.split("\n")[0]).toContain("Abloese");
  });
});

describe("Verdrahtung: ein Schienenpunkt Historie mit drei Reitern", () => {
  const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

  it("die Schiene hat einen Punkt „Historie\" und keine zwei mehr unter Markt und Team", () => {
    const nav = quelle("lib/foundation/foundation-nav-config.ts");
    expect(nav).toContain('id: "seasonArchive"');
    expect(nav).not.toMatch(/id: "allTimeTable",\s*label/);
    expect(nav).not.toMatch(/id: "historyV2", label/);
  });

  it("die drei Reiter stehen im Regieband (FoundationSubNav) und die Seite hat kein eigenes h1", () => {
    const body = quelle("app/foundation/FoundationShellRouterBody.tsx");
    expect(body).toContain('{ id: "archiv", label: "Saison-Archiv" }');
    expect(body).toContain('{ id: "transfers", label: "Transfers" }');
    expect(body).toContain('{ id: "ewig", label: "Ewige Tabelle" }');
    for (const datei of [
      "components/foundation/historie/HistorieArchiv.tsx",
      "components/foundation/historie/HistorieTransfers.tsx",
      "components/foundation/historie/HistorieEwigeTabelle.tsx",
      "components/foundation/historie/HistorieBlatt.tsx",
    ]) {
      expect(quelle(datei)).not.toMatch(/<h1[\s>]/);
    }
  });

  it("alle Ansichten der Historie zaehlen fuer den Schienenpunkt als aktiv", async () => {
    const { isFoundationNavViewActive } = await import("@/lib/foundation/foundation-nav-config");
    for (const ansicht of ["seasonArchive", "historyV2", "history", "allTimeTable"] as const) {
      expect(isFoundationNavViewActive(ansicht, "seasonArchive")).toBe(true);
    }
    expect(isFoundationNavViewActive("teams", "seasonArchive")).toBe(false);
  });

  it("Alle Fenster zusammen zaehlt den Kaderaufbau nicht", () => {
    const quelleTransfers = quelle("components/foundation/historie/HistorieTransfers.tsx");
    expect(quelleTransfers).toContain("Der <b>Kaderaufbau vor Saison 1</b> ist kein Transfer und zählt hier nicht mit.");
    expect(quelleTransfers).toContain("trenneKaderaufbau(filteredRows)");
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { fensterKennzahlenAusHistorie } from "@/lib/foundation/historie-transfers";

/**
 * ABNAHME 19.11., Fehler F9 (docs/design/abnahme-saison-19-11.md): die Historie zaehlte Picks/Deals/Umsatz/Fenster-Kacheln aus
 * der geladenen Seite (100 neueste Eintraege) — nach dem ersten S2-Fenster stand „Saison 1: 0 Picks aus dem Startbudget“, obwohl
 * 381 gepickt waren. Die Kennzahlen kommen jetzt aus der vollstaendigen Historie, nach Transferfenster zugeordnet.
 */
function eintrag(i: number, o: Record<string, unknown>) {
  return {
    id: `t${i}`,
    playerId: `p${i}`,
    fee: 10,
    salary: 2,
    marketValue: 10,
    happenedAt: `2026-11-19T00:${String(i % 60).padStart(2, "0")}:00Z`,
    fromTeamId: null,
    toTeamId: null,
    phase: "manual_transfer_window",
    ...o,
  };
}

describe("Historie: Fenster-Kennzahlen aus der vollstaendigen Historie", () => {
  const draft = Array.from({ length: 381 }, (_, i) => eintrag(i, { transferType: "buy", seasonId: "season-1", matchdayId: "matchday-1", toTeamId: i % 2 ? "M-M" : "A-A", fee: 1 }));
  const exits = Array.from({ length: 5 }, (_, i) => eintrag(400 + i, { transferType: "contract_exit", seasonId: "season-1", matchdayId: "matchday-20", fromTeamId: "A-A", phase: "season_end" }));
  const fensterS2 = [
    ...Array.from({ length: 116 }, (_, i) => eintrag(500 + i, { transferType: "buy", seasonId: "season-2", matchdayId: "season-2-matchday-1", toTeamId: "A-A", fee: 2 })),
    ...Array.from({ length: 86 }, (_, i) => eintrag(700 + i, { transferType: "sell", seasonId: "season-2", matchdayId: "season-2-matchday-1", fromTeamId: "M-M", fee: 3 })),
  ];
  const gameState = {
    season: { id: "season-2", matchdayIds: Array.from({ length: 20 }, (_, i) => `season-2-matchday-${i + 1}`) },
    transferHistory: [...draft, ...exits, ...fensterS2],
  } as unknown as GameState;

  it("Saison 1: alle 381 Picks Kaderaufbau, Abgaenge zaehlen als Deal, nicht als Pick", () => {
    const k = fensterKennzahlenAusHistorie(gameState).get(1)!;
    expect(k.kaderaufbauPicks).toBe(381);
    expect(k.kaderaufbauSumme).toBe(381);
    expect(k.deals).toBe(386);
    expect(k.transferDeals).toBe(5);
  });

  it("Fenster vor Saison 2: 202 Deals, Umsatz = Abloesen der Kaeufe, je Team Ausgaben/Einnahmen", () => {
    const k = fensterKennzahlenAusHistorie(gameState).get(2)!;
    expect(k.deals).toBe(202);
    expect(k.transferDeals).toBe(202);
    expect(k.umsatz).toBe(232);
    expect(k.jeTeam.get("A-A")).toEqual({ aus: 232, ein: 0 });
    expect(k.jeTeam.get("M-M")).toEqual({ aus: 0, ein: 258 });
    expect(k.zeilen).toHaveLength(202);
  });

  it("die Transfers-Ansicht nimmt Kacheln, Picks, Band und Bilanz aus diesen Kennzahlen (ohne Filter)", () => {
    const quelle = readFileSync("components/foundation/historie/HistorieTransfers.tsx", "utf8");
    expect(quelle).toMatch(/fensterKennzahlenAusHistorie\(gameState\)/);
    expect(quelle).toMatch(/kaderaufbauPicks=\{kaderaufbauPicks\}/);
    expect(quelle).toMatch(/ohneFilter && kennzahlenSicht \? kennzahlenSicht\.zeilen : sichtZeilen/);
  });
});

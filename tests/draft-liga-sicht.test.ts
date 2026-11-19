/**
 * LIGA-SICHT DES DRAFTS (19.11.): Kaderstaerke je Disziplin mit Liga-Rang live nach jedem Pick (F), Spieler-Raenge, Opt-Kader (K)
 * und die Wunschliste direkt aus dem Spielstand (Bug J). Reine Funktionen, keine Datenbank.
 */
import { describe, expect, it } from "vitest";

import { baueDraftKaderSicht, baueSpielerRaenge, kaderMitPicks } from "@/app/foundation/draft-modern/draft-liga";
import { kaderOptFuer } from "@/lib/draft/liga-draft-ansicht";
import { getTeamTransferWishlistEntries } from "@/lib/scouting/scouting-wishlist-slots";

const spieler = (id: string, wert: number) => ({ id, disciplineRatings: { hockey: wert, basketball: wert - 10 } });

describe("Kaderstaerke mit Liga-Rang", () => {
  const players = ["a", "b", "c", "d"].map((id, i) => spieler(id, 90 - i * 10));
  const teams = [{ teamId: "T1" }, { teamId: "T2" }] as never;
  const gameState = { players, teams, rosters: [{ teamId: "T2", playerId: "b" }] } as never;

  it("fremde Picks aus dem Verlauf zaehlen sofort mit (gespeicherte Kader kennen sie erst nach dem Neuladen)", () => {
    expect(kaderMitPicks([{ teamId: "T2", playerId: "b" }], [{ art: "pick", teamId: "T1", playerId: "a" }, { art: "aus", teamId: "T1" }])).toEqual([
      { teamId: "T2", playerId: "b" },
      { teamId: "T1", playerId: "a" },
    ]);
    const vorher = baueDraftKaderSicht({ gameState, ansicht: { verlauf: [] }, teamId: "T1", disziplinIds: ["hockey"] });
    const nachher = baueDraftKaderSicht({ gameState, ansicht: { verlauf: [{ art: "pick", teamId: "T1", playerId: "a", nr: 1 } as never] }, teamId: "T1", disziplinIds: ["hockey"] });
    expect(vorher.zeilen[0]!.rang).toBe(2);
    expect(nachher.zeilen[0]!.rang).toBe(1);
    expect(nachher.zeilen[0]!.staerke).toBeGreaterThan(vorher.zeilen[0]!.staerke);
    expect(nachher.zeilen[0]!.ligaGroesse).toBe(2);
  });

  it("Spieler-Rang: ligaweit je Disziplin, die besten zuerst", () => {
    const raenge = baueSpielerRaenge({ players, playerIds: ["a", "c"], disziplinIds: ["hockey", "basketball"], anzahl: 2 });
    expect(raenge.get("a")!.beste[0]).toMatchObject({ rang: 1 });
    expect(raenge.get("c")!.beste[0]).toMatchObject({ rang: 3 });
  });
});

describe("Opt-Kader (K)", () => {
  const regeln = { minKader: 8, maxPicksJeTeam: 14 };
  it("nimmt das Optimum der GM-Identitaet, begrenzt auf Mindestkader und Hoechstzahl", () => {
    const teams = [{ teamId: "T1", rosterOptTarget: 12 }] as never;
    expect(kaderOptFuer({ teams, teamIdentities: [{ teamId: "T1", playerOpt: 11 }] as never }, "T1", regeln)).toBe(11);
    expect(kaderOptFuer({ teams, teamIdentities: [{ teamId: "T1", playerOpt: 30 }] as never }, "T1", regeln)).toBe(14);
    expect(kaderOptFuer({ teams, teamIdentities: [] as never }, "T1", regeln)).toBe(12);
    expect(kaderOptFuer({ teams: [{ teamId: "T1" }] as never, teamIdentities: [] as never }, "T1", regeln)).toBeNull();
  });
});

describe("Wunschliste im Draft (Bug J)", () => {
  it("kommt aus dem Spielstand des eigenen Teams, nicht aus der Markt-Ansicht", () => {
    const gameState = {
      seasonState: {
        transferWishlist: [
          { playerId: "p1", teamId: "T1" },
          { playerId: "p2", teamId: "T2" },
        ],
      },
    } as never;
    expect(getTeamTransferWishlistEntries(gameState, "T1").map((e) => e.playerId)).toEqual(["p1"]);
  });
});

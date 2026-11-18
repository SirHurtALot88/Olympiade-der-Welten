import { describe, expect, it } from "vitest";

import {
  ampelFuerRang,
  duelleText,
  duellPunkteEigen,
  papierform,
  papierformVierer,
  sunText,
} from "@/lib/foundation/startseite-modern";

describe("Startseite modern: Anzeigeregeln", () => {
  it("Papierform-Wort erst ab 55 % bzw. unter 45 %, dazwischen offen", () => {
    expect(papierform(56)?.wort).toBe("Vorteil");
    expect(papierform(55)?.wort).toBe("Vorteil");
    expect(papierform(54.9)?.wort).toBe("offen");
    expect(papierform(50)?.wort).toBe("offen");
    expect(papierform(45.1)?.wort).toBe("offen");
    expect(papierform(45)?.wort).toBe("Nachteil");
    expect(papierform(30)?.ton).toBe("minus");
    expect(papierform(null)).toBeNull();
  });

  it("Vierergruppe: Rang 1 Vorteil, Rang 4 Nachteil, sonst offen", () => {
    expect(papierformVierer(1)?.wort).toBe("Vorteil");
    expect(papierformVierer(2)?.wort).toBe("offen");
    expect(papierformVierer(3)?.wort).toBe("offen");
    expect(papierformVierer(4)?.wort).toBe("Nachteil");
  });

  it("Ampel: 1-3 grün, 4-6 gelb, 7-10 rot, ab 11 neutral", () => {
    expect([1, 3].map(ampelFuerRang)).toEqual(["a", "a"]);
    expect([4, 6].map(ampelFuerRang)).toEqual(["b", "b"]);
    expect([7, 10].map(ampelFuerRang)).toEqual(["c", "c"]);
    expect([11, 16].map(ampelFuerRang)).toEqual(["", ""]);
    expect(ampelFuerRang(null)).toBe("");
    expect(ampelFuerRang(0)).toBe("");
  });

  it("S-U-N zählt Duelle, nicht Spiele", () => {
    const b = { siege: 14, unentschieden: 0, niederlagen: 10 };
    expect(sunText(b)).toBe("14-0-10");
    expect(duelleText(b)).toBe("24 Duelle");
    expect(duelleText({ siege: 1, unentschieden: 0, niederlagen: 0 })).toBe("1 Duell");
    expect(`${sunText(b)} · ${duelleText(b)}`).not.toMatch(/Spiel/);
  });
});

describe("Startseite modern: Duellpunkte des eigenen Teams", () => {
  it("summiert 2/1/0 je gebuchtem Einsatz, 2 mögliche Punkte je Einsatz, ignoriert Fremdes und Ungewertetes", () => {
    const gameState = {
      season: { id: "s1" },
      seasonState: {
        matchdayResults: [
          { id: "r1", seasonId: "s1", matchdayId: "m1", status: "preview_applied" },
          { id: "r2", seasonId: "s1", matchdayId: "m2", status: "preview_applied" },
          { id: "r3", seasonId: "s1", matchdayId: "m3", status: "draft" },
          { id: "rx", seasonId: "alt", matchdayId: "m1", status: "preview_applied" },
        ],
        disciplineResults: [
          { teamId: "A", disciplineId: "hockey", matchdayResultId: "r1", teamPoints: 2, resolutionSource: "arena" },
          { teamId: "A", disciplineId: "hockey", matchdayResultId: "r2", teamPoints: 1, resolutionSource: "pps_duell" },
          { teamId: "A", disciplineId: "mini-dm", matchdayResultId: "r2", teamPoints: 0, resolutionSource: "mini_dm_pod" },
          { teamId: "A", disciplineId: "tennis", matchdayResultId: "r3", teamPoints: 2, resolutionSource: "arena" },
          { teamId: "A", disciplineId: "tennis", matchdayResultId: "rx", teamPoints: 2, resolutionSource: "arena" },
          { teamId: "A", disciplineId: "fechten", matchdayResultId: "r1", teamPoints: 2, resolutionSource: "pps" },
          { teamId: "B", disciplineId: "hockey", matchdayResultId: "r1", teamPoints: 0, resolutionSource: "arena" },
        ],
      },
    } as unknown as Parameters<typeof duellPunkteEigen>[0];
    const karte = duellPunkteEigen(gameState, "A");
    expect(karte.get("hockey")).toEqual({ punkte: 3, moeglich: 4 });
    expect(karte.get("mini-dm")).toEqual({ punkte: 0, moeglich: 2 });
    expect(karte.has("tennis")).toBe(false);
    expect(karte.has("fechten")).toBe(false);
  });
});

/**
 * GEMELDET (`ls9jfg`, „Spieltag · Saisonstand", Spielstand `swnjlk`, Saison 2, Spieltag 4):
 *
 *   „Transfer im Saisonstand und in der historie sind immernoch falsch berechnet, die Käufe aus S2
 *    müssen gegen die Verkäufe aus S1 gerechnet werden! so wären dann ein paar Teams positiv und
 *    ein paar negativ. Hier sind alle 0 oder schlechter weil nur die Käufe drin sind!"
 *
 * DIE RECHENREGEL WAR SCHON RICHTIG — `buildStandingsTransferBalanceForTeam` stellt in Saison 2+
 * die Verkaeufe der VORSAISON gegen die Kaeufe der laufenden. Falsch waren die Quellen-Listen: sie
 * kannten nur KI-Transfers. Was Chris selbst tut, fiel in BEIDEN Richtungen heraus.
 *
 * Nachgemessen an `swnjlk`: `ai_preseason_market_sell` hatte NULL Eintraege — die einzige
 * gezaehlte Verkaufsquelle. Chris' 5 eigene Verkaeufe (101,5) zaehlten nicht, waehrend 33 von 40
 * Kaeufen zaehlten. Daher standen alle 32 Teams bei „0 oder schlechter".
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildStandingsTransferBalanceForTeam,
  isPreseasonMarketBuy,
  isSeasonEndMarketSell,
} from "@/lib/season/transfer-standings-balance";

function transfer(input: {
  seasonId: string;
  type: "buy" | "sell";
  source: string;
  fee: number;
  teamId: string;
}) {
  return {
    seasonId: input.seasonId,
    matchdayId: `${input.seasonId}-matchday-1`,
    transferType: input.type,
    source: input.source,
    fee: input.fee,
    fromTeamId: input.type === "sell" ? input.teamId : null,
    toTeamId: input.type === "buy" ? input.teamId : null,
  };
}

/** Chris' Lage, eingedampft: 5 eigene Verkaeufe in S1, 7 eigene Kaeufe in S2. */
function spielstand(): GameState {
  return {
    transferHistory: [
      transfer({ seasonId: "season-1", type: "sell", source: "manual_transfermarkt_sell", fee: 101.5, teamId: "V-W" }),
      transfer({ seasonId: "season-2", type: "buy", source: "manual_transfermarkt_buy", fee: 145.3, teamId: "V-W" }),
    ],
  } as unknown as GameState;
}

describe("Die Transferbilanz zaehlt die eigenen Transfers mit", () => {
  it("stellt den eigenen Verkauf aus S1 gegen den eigenen Kauf aus S2", () => {
    // Der gemeldete Fall, Zahl fuer Zahl: 101,5 − 145,3 = −43,8. Vorher waren es glatte −145,3,
    // weil der Verkauf gar nicht auftauchte.
    const bilanz = buildStandingsTransferBalanceForTeam(spielstand(), "season-2", "V-W");
    expect(bilanz.transferSellTotal).toBeCloseTo(101.5, 1);
    expect(bilanz.transferBuyTotal).toBeCloseTo(145.3, 1);
    expect(bilanz.transferNet).toBeCloseTo(-43.8, 1);
  });

  it("erkennt den eigenen Verkauf ueberhaupt als Marktverkauf", () => {
    expect(
      isSeasonEndMarketSell(
        transfer({ seasonId: "season-1", type: "sell", source: "manual_transfermarkt_sell", fee: 10, teamId: "V-W" }) as never,
      ),
    ).toBe(true);
  });

  it("erkennt den eigenen Kauf als Vorsaison-Marktkauf", () => {
    // Symmetrie: nur eine Seite zu oeffnen haette die Schieflage bloss umgedreht.
    expect(
      isPreseasonMarketBuy(
        transfer({ seasonId: "season-2", type: "buy", source: "manual_transfermarkt_buy", fee: 10, teamId: "V-W" }) as never,
      ),
    ).toBe(true);
  });

  it("laesst die KI-Quellen unveraendert gelten", () => {
    // Gegenprobe: der Fix darf die bisher gezaehlten Quellen nicht verdraengen.
    expect(
      isSeasonEndMarketSell(
        transfer({ seasonId: "season-1", type: "sell", source: "ai_preseason_market_sell", fee: 10, teamId: "T" }) as never,
      ),
    ).toBe(true);
    expect(
      isPreseasonMarketBuy(
        transfer({ seasonId: "season-2", type: "buy", source: "ai_preseason_market_buy", fee: 10, teamId: "T" }) as never,
      ),
    ).toBe(true);
  });

  it("zaehlt die laufende Kaderpflege weiterhin NICHT mit", () => {
    // Die Grenze, und sie ist bewusst gezogen: `ai_roster_fill` ist Kaderpflege bzw. der
    // organische Erst-Draft, keine Marktbewegung der Vorsaison-Phase — und war nicht gemeldet.
    expect(
      isPreseasonMarketBuy(
        transfer({ seasonId: "season-2", type: "buy", source: "ai_roster_fill", fee: 10, teamId: "T" }) as never,
      ),
    ).toBe(false);
  });

  it("laesst einen Verkauf aus DERSELBEN Saison in S2 aussen vor", () => {
    // Die Regel lautet „Verkaeufe der VORSAISON". Ein Verkauf in S2 gehoert in die S3-Bilanz.
    const gs = {
      transferHistory: [
        transfer({ seasonId: "season-2", type: "sell", source: "manual_transfermarkt_sell", fee: 50, teamId: "V-W" }),
      ],
    } as unknown as GameState;
    expect(buildStandingsTransferBalanceForTeam(gs, "season-2", "V-W").transferSellTotal).toBe(0);
  });
});

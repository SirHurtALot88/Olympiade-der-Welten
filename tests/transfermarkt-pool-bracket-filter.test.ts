import { describe, expect, it } from "vitest";

import { filterTransfermarktFreeAgentsByBracket } from "@/lib/market/transfermarkt-pool-audit";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function createItem(partial: Pick<TransfermarktFreeAgentItem, "playerId" | "name" | "marketValue">): TransfermarktFreeAgentItem {
  return {
    playerId: partial.playerId,
    name: partial.name,
    marketValue: partial.marketValue,
    className: "Hero",
    race: "Human",
    alignment: "Good",
    gender: "male",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    preferredDisciplineIds: [],
    scoutingLevel: 0,
    salary: 10,
    fit: 0,
    fitDisplay: "0",
    bracket: null,
    salaryStatus: "known",
    pow: 80,
    spe: 80,
    men: 80,
    soc: 80,
  } as TransfermarktFreeAgentItem;
}

describe("filterTransfermarktFreeAgentsByBracket", () => {
  it("returns only players in the requested bracket", () => {
    const items = [
      createItem({ playerId: "p1", name: "Cheap", marketValue: 10 }),
      createItem({ playerId: "p2", name: "Mid", marketValue: 25 }),
      createItem({ playerId: "p3", name: "Upper Mid", marketValue: 35 }),
    ];

    const bracket1 = filterTransfermarktFreeAgentsByBracket(items, 1);
    const bracket4 = filterTransfermarktFreeAgentsByBracket(items, 4);

    expect(bracket1.map((item) => item.playerId)).toEqual(["p1"]);
    expect(bracket4.map((item) => item.playerId)).toEqual(["p2"]);
  });
});

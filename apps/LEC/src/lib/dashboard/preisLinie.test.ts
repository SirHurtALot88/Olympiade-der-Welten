import { describe, expect, it } from "vitest";
import { buildPreisLinie } from "./preisLinie";

const now = Date.parse("2026-11-15T00:00:00Z");
const iso = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("buildPreisLinie", () => {
  it("ohne Verlauf nichts zeichnen", () => {
    const l = buildPreisLinie({ now, currentVk: 5, priceLog: [], market: [{ at: iso(1), priceAvg7: 4 }], sales: [{ soldAt: iso(3), qty: 1, unitPrice: 5 }] });
    expect(l.hasData).toBe(false);
    expect(l.vk).toHaveLength(0);
  });

  it("VK-Treppe aus Preisaenderung", () => {
    const l = buildPreisLinie({ now, currentVk: 6, priceLog: [{ at: iso(30), before: 5, after: 6 }], market: [], sales: [] });
    expect(l.hasData).toBe(true);
    expect(l.vk[0].v).toBe(5);
    expect(l.vk[l.vk.length - 1].v).toBe(6);
    expect(l.min).toBe(5);
    expect(l.max).toBe(6);
  });

  it("Marktlinie braucht zwei Punkte, alte Punkte fallen heraus", () => {
    const l = buildPreisLinie({ now, currentVk: 5, priceLog: [], market: [{ at: iso(300), priceAvg7: 9 }, { at: iso(10), priceAvg7: 4 }, { at: iso(2), priceAvg7: 5 }], sales: [] });
    expect(l.markt).toHaveLength(2);
    expect(l.hasData).toBe(true);
  });
});

// =====================================================================================
// Mini-DM (duelhp) — Punkte-proportionale Token-Größe + kosmetischer Kampf-Rhythmus.
//
// Zwei Sorgen sichert diese Datei ab:
//   1. Die Logo-Größe folgt WIRKLICH den Punkten (4× Punkte → ~4× Durchmesser),
//      mit Klick-Untergrenze und Bühnen-Obergrenze, ohne NaN-Fallen.
//   2. "Mehr Action" (dichterer Treffer-Rhythmus) ändert NUR die Optik: der
//      Endstand bleibt unverändert, weil das Feld per Contract rein visuell ist
//      und nie in den Score schreibt — das prüft ein Quell-Contract-Scan.
// =====================================================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MINI_DM_ATTACK_INTERVAL_MS,
  MINI_DM_DIA_MAX_FACTOR,
  MINI_DM_DIA_MIN_FACTOR,
  miniDmTokenDiameter,
} from "@/lib/minidm-token-size";

const BASE = 30; // beispielhafter Basis-Durchmesser (H·0.062 bei üblicher Feldhöhe)

describe("Mini-DM · Token-Durchmesser folgt den Punkten", () => {
  it("4× Punkte → ~4× Durchmesser (wörtlicher Nutzer-Wunsch)", () => {
    const big = miniDmTokenDiameter({ score: 400, maxScore: 400, baseD: BASE });
    const small = miniDmTokenDiameter({ score: 100, maxScore: 400, baseD: BASE });
    expect(big / small).toBeCloseTo(4, 1);
  });

  it("halbe Punkte → halber Durchmesser (Verhältnis zum Führenden, nicht Min/Max-Spreizung)", () => {
    const lead = miniDmTokenDiameter({ score: 200, maxScore: 200, baseD: BASE });
    const half = miniDmTokenDiameter({ score: 100, maxScore: 200, baseD: BASE });
    expect(half).toBeCloseTo(lead / 2, 5);
  });

  it("abgeschlagene Teams sind deutlich kleiner, aber nie unter der Klick-Untergrenze", () => {
    const lead = miniDmTokenDiameter({ score: 1000, maxScore: 1000, baseD: BASE });
    const straggler = miniDmTokenDiameter({ score: 30, maxScore: 1000, baseD: BASE });
    expect(straggler).toBe(BASE * MINI_DM_DIA_MIN_FACTOR); // Untergrenze greift
    expect(lead / straggler).toBeGreaterThanOrEqual(4); // wirkt "wirklich sehr klein"
  });

  it("Führender deckelt bei der Obergrenze (läuft nicht aus der Bühne)", () => {
    const lead = miniDmTokenDiameter({ score: 999999, maxScore: 999999, baseD: BASE });
    expect(lead).toBe(BASE * MINI_DM_DIA_MAX_FACTOR);
  });

  it("Score 0, negativ, NaN oder maxScore 0 liefern nie NaN und nie 0", () => {
    for (const input of [
      { score: 0, maxScore: 100, baseD: BASE },
      { score: -5, maxScore: 100, baseD: BASE },
      { score: Number.NaN, maxScore: 100, baseD: BASE },
      { score: 50, maxScore: Number.NaN, baseD: BASE },
      { score: 0, maxScore: 0, baseD: BASE }, // vor dem ersten Reveal
      { score: 10, maxScore: -3, baseD: BASE },
    ]) {
      const d = miniDmTokenDiameter(input);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  });

  it("eigenes Team bleibt per konstantem Bonus erkennbar", () => {
    const own = miniDmTokenDiameter({ score: 100, maxScore: 200, baseD: BASE, isOwn: true });
    const other = miniDmTokenDiameter({ score: 100, maxScore: 200, baseD: BASE });
    expect(own).toBe(other + 2);
  });

  it("wächst während des Reveals monoton mit (Größe bewegt sich mit den Punkten)", () => {
    let prev = 0;
    for (let s = 0; s <= 400; s += 25) {
      const d = miniDmTokenDiameter({ score: s, maxScore: 400, baseD: BASE });
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(prev).toBe(BASE * MINI_DM_DIA_MAX_FACTOR);
  });
});

describe("Mini-DM · mehr Treffer, gleicher Endstand", () => {
  it("Rhythmus liefert ~20–30 % mehr Treffer als die alte 400-ms-Taktung — bei GLEICHER Rundendauer", () => {
    const ROUND_MS = 10_000; // die Rundendauer taktet der Host und bleibt unberührt
    const oldHits = Math.floor(ROUND_MS / 400);
    const newHits = Math.floor(ROUND_MS / MINI_DM_ATTACK_INTERVAL_MS);
    const gain = newHits / oldHits;
    expect(gain).toBeGreaterThanOrEqual(1.2);
    expect(gain).toBeLessThanOrEqual(1.3);
  });

  it("duelhp.tsx schreibt nie in den Score — Treffer sind reine Optik (Endstand unverändert)", () => {
    const src = readFileSync(
      path.join(process.cwd(), "app/foundation/discipline-stage/arena/disciplines/duelhp.tsx"),
      "utf8",
    );
    // Kein Zuweisungs-Muster auf ein score-Feld (Lesen ist erlaubt, Schreiben nicht).
    expect(src).not.toMatch(/\.score\s*[+\-*/]?=[^=]/);
    expect(src).not.toMatch(/displayScore\s*[+\-*/]?=[^=]/);
    // Die Frequenz kommt aus der getesteten Konstante — nicht aus einer stillen Zahl.
    expect(src).toContain("MINI_DM_ATTACK_INTERVAL_MS");
    expect(src).not.toMatch(/atkAcc\s*>\s*\d/);
  });
});

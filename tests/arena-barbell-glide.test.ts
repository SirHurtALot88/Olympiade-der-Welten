import { describe, expect, it } from "vitest";

import { resolveBarbellGlideStart } from "@/app/foundation/discipline-stage/arena/disciplines/barbell";

// Achse: baseY ist UNTEN (0 kg), kleinere y-Werte sind HÖHERE Lasten.
const BASE_Y = 400;

describe("Gewichtheben · Glide-Startpunkt", () => {
  it("startet einen neuen Glide am erreichten Ziel, wenn der vorige Glide durch ist", () => {
    // Runde 1 ist fertig: der Heber steht auf 300 (er ist von baseY dorthin geglitten).
    const afterRound1 = { fromY: BASE_Y, toY: 300, glideT: 1 };
    // Regression: Vorher wurde hier `fromY` (= baseY) beibehalten — der Heber sprang zu
    // Rundenbeginn zurück auf 0 kg und stieg erneut von unten auf.
    expect(resolveBarbellGlideStart(afterRound1)).toBe(300);
    expect(resolveBarbellGlideStart(afterRound1)).not.toBe(BASE_Y);
  });

  it("startet einen unterbrochenen Glide an der interpolierten Zwischenposition", () => {
    // Halb zwischen 400 und 300 → 350. Kein Sprung, wenn das Ziel mitten im Glide wechselt.
    expect(resolveBarbellGlideStart({ fromY: BASE_Y, toY: 300, glideT: 0.5 })).toBe(350);
    expect(resolveBarbellGlideStart({ fromY: BASE_Y, toY: 300, glideT: 0 })).toBe(BASE_Y);
  });

  it("steigt über mehrere Runden monoton weiter, statt jede Runde neu von unten anzufangen", () => {
    // Die geforderte Last steigt Runde für Runde; der Heber folgt ihr.
    const targets = [340, 300, 260, 220];
    const state = { fromY: BASE_Y, toY: BASE_Y, glideT: 1 };
    const starts: number[] = [];

    for (const target of targets) {
      starts.push(resolveBarbellGlideStart(state));
      state.fromY = resolveBarbellGlideStart(state);
      state.toY = target;
      state.glideT = 1; // Glide der Runde läuft vollständig durch
    }

    // Jeder Glide beginnt dort, wo der vorige endete — lückenlose Kette.
    expect(starts).toEqual([BASE_Y, 340, 300, 260]);
    // Und nie wieder am Boden, nachdem der Heber einmal oben ist.
    expect(starts.slice(1).every((value) => value < BASE_Y)).toBe(true);
  });
});

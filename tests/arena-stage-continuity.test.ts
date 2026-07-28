import { describe, expect, it } from "vitest";

import { resolveStageGlideStart } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

/**
 * Eine Etappe hat zwei unabhaengige Uhren: die Reveal-Cascade (echte Timer, gibt `busy`
 * frei) und die virtuelle Etappen-Uhr, an der die Token-Bewegung haengt. Letztere laeuft
 * bei Hover mit Speed 0 und in der Highlight-Zeitlupe mit 0,2× — sie kann also noch mitten
 * im Gleiten sein, wenn die naechste Etappe startet.
 *
 * `t.score` steht dann bereits auf dem vollen Etappen-Endstand, das Token aber noch davor.
 * Startete die neue Rampe bei `t.score`, sprang das Token beim Etappenwechsel vorwaerts.
 */
describe("Arena · Etappenwechsel setzt an der sichtbaren Position an", () => {
  it("startet am Endstand, wenn die vorige Etappe ausgeglitten ist", () => {
    // Ausgeglitten: animScore hat den Endstand erreicht — beide Wege sind identisch.
    expect(resolveStageGlideStart({ animScore: 42, score: 42, glideWasRunning: true })).toBe(42);
    expect(resolveStageGlideStart({ animScore: 42, score: 42, glideWasRunning: false })).toBe(42);
  });

  it("startet an der sichtbaren Position, wenn mitten im Gleiten weitergeschaltet wurde", () => {
    // Regression: vorher wurde hier 42 genommen — das Token sprang von 30 auf 42.
    expect(resolveStageGlideStart({ animScore: 30, score: 42, glideWasRunning: true })).toBe(30);
  });

  it("laesst eine Etappe nie rueckwaerts starten", () => {
    // animScore minimal ueber dem Endstand (Rundung) → trotzdem nicht ueber den Endstand hinaus.
    expect(resolveStageGlideStart({ animScore: 42.1, score: 42, glideWasRunning: true })).toBe(42);
  });

  it("bleibt beim Endstand, wenn gar keine Rampe lief (erste Etappe, Quick-Sim, Gewichtheben)", () => {
    // Ohne laufende Rampe traegt animScore keine Aussage — dann zaehlt der Endstand.
    expect(resolveStageGlideStart({ animScore: 0, score: 17, glideWasRunning: false })).toBe(17);
  });

  it("haelt die Kette ueber mehrere Etappen lueckenlos", () => {
    // Etappe 1 laeuft nur bis 60 % durch, dann wird weitergeschaltet.
    const stage1 = { animScore: 6, score: 10, glideWasRunning: true };
    const start2 = resolveStageGlideStart(stage1);
    expect(start2).toBe(6);

    // Etappe 2 glitt vollstaendig aus (animScore == score) und endet bei 25.
    const stage2 = { animScore: 25, score: 25, glideWasRunning: true };
    const start3 = resolveStageGlideStart(stage2);
    expect(start3).toBe(25);

    // Kein Startwert liegt hinter dem vorigen — die Bewegung laeuft nur vorwaerts.
    expect(start3).toBeGreaterThanOrEqual(start2);
  });
});

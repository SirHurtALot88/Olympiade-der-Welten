/**
 * Paket F3: die vier gemessenen Kontrast-Ausreißer, die keine Token-Fälle sind.
 * Zahlen aus dem UI-Audit (Playwright, gerenderte Knoten, Schwelle 4,5:1):
 *
 *  1. Leaders-Podium: `.nl-legends-podium-name`/`-value` hatten KEIN `color`
 *     und erbten Schwarz aus dem Legacy-Body — 1,15:1 auf den Medaillen-Karten.
 *  2. Spieler-Detail: `player-drawer-potential-trend-chip` wurde von der
 *     generischen Regel `.foundation-shell .metric-card span` (Weiß 68 %)
 *     übermalt — 1,3:1 auf hellem Gold; `player-drawer-history-area.is-social`
 *     stand dunkel auf abgemischtem 58 %-Gold — 3,76:1.
 *  3. `nl-ability-star-track` (leere Sternbahn, 1,65:1) und die leeren
 *     Formsterne der `VeloPotentialStars` (12 % Weiß): die Bahn wird sichtbar,
 *     die Sterne bleiben Sterne (Chris' Vorgabe).
 *  4. OVR-Rang-Chips der Spielerliste im aktiv sortierten Zustand: heller
 *     Ink-Text auf 55 %-Gold — 3,71:1 bei 9px. Gold-Anteil auf 42 % (5,4:1).
 *
 * Die Regel dahinter: eine Farb-Paarung (Text + Grund) kommt immer aus EINER
 * Regel — sobald eine generische Regel nur eine Hälfte übermalt, entsteht
 * genau diese Klasse von Fehlern.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Regelrumpf zu einem Selektor — sonst prüft man die Nachbarregeln mit. */
function regel(selektor: string): string {
  const start = CSS.indexOf(`${selektor} {`);
  expect(start, `Regel fehlt: ${selektor}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("1. Leaders-Podium: Name und Wert haben eine explizite Farbe", () => {
  it.each([".is-new-look .nl-legends-podium-name", ".is-new-look .nl-legends-podium-value"])(
    "%s setzt color: var(--nl-ink)",
    (selektor) => {
      expect(regel(selektor)).toContain("color: var(--nl-ink)");
    },
  );
});

describe("2. Spieler-Detail: Trend-Chip und Social-Zelle", () => {
  it("die Chip-Paarung gewinnt gegen die generische metric-card-span-Regel", () => {
    // Gleiche Spezifität wie `.foundation-shell .metric-card span`, spätere
    // Position — die Paarung Text+Grund kommt wieder aus einer Hand.
    expect(regel(".foundation-shell .metric-card span.player-drawer-potential-trend-chip")).toContain(
      "color: var(--heat-neutral-text)",
    );
    expect(regel(".foundation-shell .metric-card span.player-drawer-potential-trend-chip.is-negative")).toContain(
      "color: var(--heat-danger-text)",
    );
  });

  it("Social-Bereichszelle: Gold deckend genug für die dunkle Schrift", () => {
    const rumpf = regel(
      ".team-drawer-history-table td.team-drawer-history-area.is-social,\n.player-attribute-progress-table td.player-drawer-history-area.is-social",
    );
    expect(rumpf).toContain("rgba(203, 169, 93, 0.85)");
    expect(rumpf).toContain("color: #14120f");
  });
});

describe("3. Sternbahnen sind sichtbar", () => {
  it("nl-ability-star-track: voll deckendes Gold-Grau statt 58 % Braun", () => {
    const rumpf = regel(".nl-ability-star-track");
    expect(rumpf).toContain("color: #a08f66");
    expect(rumpf).not.toContain("rgba(103, 89, 61");
  });

  it("VeloPotentialStars: leere Formsterne über der Grafik-Schwelle", () => {
    const rumpf = regel(".training-v2-rider-stars span");
    expect(rumpf).toContain("rgba(255, 255, 255, 0.38)");
    expect(rumpf).not.toContain("rgba(255, 255, 255, 0.12)");
  });
});

describe("4. OVR-Rang-Chip im Sortierzustand", () => {
  it("mischt Gold nur zu 42 % — der helle Ink-Text braucht den dunklen Grund", () => {
    const rumpf = regel(".is-new-look td.is-active-sort .nl-ptable-percentile.nl-ptable-metric-rank.is-ovr");
    expect(rumpf).toContain("var(--nl-gold) 42%");
    expect(rumpf).not.toContain("var(--nl-gold) 55%");
  });
});

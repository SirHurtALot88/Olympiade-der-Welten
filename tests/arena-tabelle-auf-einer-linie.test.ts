/**
 * GEMELDET VON CHRIS: „climbing bitte gleiche höhe wie die tabelle rechts daneben - das gilt
 * für alle disziplinen das soll auf einer linie sein"
 *
 * BEFUND (unveraendert gueltig): Die Absicht stand schon im Code — die Ladder wird an der
 * Arena-Hauptspalte gemessen und darauf gekappt. Die Messung war aber ZIRKULAER:
 *
 *   Ladder-Hoehe   ←  gemessene Hoehe der Hauptspalte   (ResizeObserver auf mainColRef)
 *   Hauptspalte    ←  Hoehe der Flex-Zeile              (weil alignItems: stretch)
 *   Flex-Zeile     ←  die HOEHERE der beiden Spalten
 *
 * Die zweite Haelfte des Fixes war das Kastenmodell: mit `content-box` meint
 * `height: ladderMaxH` nur den Inhalt, Polster (2x10px) und Rahmen (2x1px) kommen obendrauf —
 * die Tabelle war 22px hoeher als die Arena.
 *
 * DIESE SUITE PRUEFTE FRUEHER AUSSCHLIESSLICH QUELLTEXT. Die Rechnung dahinter liegt jetzt in
 * `lib/matchday-arena/arena-ladder-metrics.ts` und wird hier ueber WERTE geprueft: dass die
 * Zeilenhoehe Polster UND Rahmen abzieht, und dass die Liste den zugeteilten Platz exakt
 * ausfuellt statt ihn zu ueberlaufen.
 *
 * WAS SICH SO NICHT PRUEFEN LAESST (ehrlich benannt): `alignItems: flex-start` und
 * `boxSizing: border-box` sind CSS-Verhalten. Das Projekt faehrt vitest ohne jsdom, es gibt
 * hier kein Flex-Layout und keinen ResizeObserver. Diese beiden Zusicherungen bleiben deshalb
 * Quelltext-Pruefungen — sie sind als solche markiert und stehen bewusst am Ende.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARENA_LADDER_BORDER_Y,
  ARENA_LADDER_PAD_Y,
  ARENA_LADDER_ROW_FALLBACK_H,
  ARENA_LADDER_ROW_MAX_H,
  ARENA_LADDER_ROW_MIN_H,
  getArenaLadderOuterHeight,
  resolveArenaLadderRowHeight,
} from "@/lib/matchday-arena/arena-ladder-metrics";

const source = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
  "utf8",
);

describe("Arena · Ladder-Zeilenhoehe (Werte)", () => {
  it("zieht Polster UND Rahmen ab — der 22px-Fehler von damals in Zahlen", () => {
    // 420px Aussenhoehe, 40px Kopf, 10 Zeilen.
    // Innenraum = 420 − 40 − 2*10 − 2*1 = 358 → 35,8 je Zeile, gekappt auf das Maximum 34.
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 420, ladderHeadH: 40, rowCount: 10 })).toBe(
      ARENA_LADDER_ROW_MAX_H,
    );

    // 32 Zeilen: 358 / 32 = 11,1875 → unter dem Minimum, also 17 und Innen-Scroll.
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 420, ladderHeadH: 40, rowCount: 32 })).toBe(
      ARENA_LADDER_ROW_MIN_H,
    );

    // Innerhalb der Grenzen exakt aufgeteilt: 700 − 40 − 22 = 638; 638 / 32 = 19,9375.
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 700, ladderHeadH: 40, rowCount: 32 })).toBeCloseTo(
      19.9375,
      6,
    );
  });

  it("die 22px sind genau Polster plus Rahmen — ohne sie faellt die Zeile zu hoch aus", () => {
    const mitAbzug = resolveArenaLadderRowHeight({ ladderMaxH: 700, ladderHeadH: 40, rowCount: 32 });
    const ohneAbzug = (700 - 40) / 32;
    expect(ohneAbzug - mitAbzug).toBeCloseTo((ARENA_LADDER_PAD_Y * 2 + ARENA_LADDER_BORDER_Y * 2) / 32, 6);
    expect(ARENA_LADDER_PAD_Y * 2 + ARENA_LADDER_BORDER_Y * 2).toBe(22);
  });

  it("fuellt den zugeteilten Platz exakt aus, statt ihn zu ueberlaufen", () => {
    // Die Invariante hinter „auf einer Linie": Kopf + Zeilen + Polster + Rahmen == Aussenhoehe.
    for (const [ladderMaxH, ladderHeadH, rowCount] of [
      [700, 40, 32],
      [640, 28, 30],
      [900, 52, 32],
    ] as const) {
      const rowHeight = resolveArenaLadderRowHeight({ ladderMaxH, ladderHeadH, rowCount });
      expect(rowHeight).toBeGreaterThan(ARENA_LADDER_ROW_MIN_H);
      expect(rowHeight).toBeLessThan(ARENA_LADDER_ROW_MAX_H);
      expect(getArenaLadderOuterHeight({ rowHeight, ladderHeadH, rowCount })).toBeCloseTo(ladderMaxH, 6);
    }
  });

  it("laeuft nie ueber die zugeteilte Hoehe hinaus, auch wenn gekappt wird", () => {
    // Bei Kappung nach oben (wenig Zeilen) bleibt Luft, bei Kappung nach unten (viele Zeilen)
    // scrollt die Liste innen — aber der Kasten selbst wird nie hoeher als die Arena.
    const wenig = { ladderMaxH: 900, ladderHeadH: 40, rowCount: 6 } as const;
    const rowWenig = resolveArenaLadderRowHeight(wenig);
    expect(getArenaLadderOuterHeight({ rowHeight: rowWenig, ...wenig })).toBeLessThanOrEqual(wenig.ladderMaxH);
  });

  it("nimmt vor der ersten Messung den Rueckfallwert, nicht die Minimalhoehe", () => {
    expect(resolveArenaLadderRowHeight({ ladderMaxH: null, ladderHeadH: 0, rowCount: 32 })).toBe(
      ARENA_LADDER_ROW_FALLBACK_H,
    );
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 700, ladderHeadH: 0, rowCount: 32 })).toBe(
      ARENA_LADDER_ROW_FALLBACK_H,
    );
    expect(ARENA_LADDER_ROW_FALLBACK_H).not.toBe(ARENA_LADDER_ROW_MIN_H);
  });

  it("bleibt lesbar, wenn gar kein Platz mehr da ist", () => {
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 50, ladderHeadH: 40, rowCount: 32 })).toBe(
      ARENA_LADDER_ROW_MIN_H,
    );
    expect(resolveArenaLadderRowHeight({ ladderMaxH: 700, ladderHeadH: 40, rowCount: 0 })).toBe(
      ARENA_LADDER_ROW_MIN_H,
    );
  });
});

describe("Arena · Layout-Zusicherungen (nur als Quelltext pruefbar, kein jsdom im Projekt)", () => {
  it("streckt die gemessene Hauptspalte nicht auf die Zeilenhoehe", () => {
    // Der Kern: die Zeile, die mainCol und Ladder haelt, darf ihre Kinder nicht dehnen.
    // Sonst misst der ResizeObserver das eigene Ergebnis von vorhin.
    const zeile = source.slice(
      source.indexOf('<div style={{ display: "flex", gap: 14'),
      source.indexOf('<div style={{ display: "flex", gap: 14') + 120,
    );
    expect(zeile).toContain('alignItems: "flex-start"');
    expect(zeile).not.toContain('alignItems: "stretch"');
  });

  it("misst weiterhin die Hauptspalte und gibt der Ladder ihre Hoehe als AUSSENmass", () => {
    expect(source).toMatch(/const el = mainColRef\.current;[\s\S]{0,400}setLadderMaxH/);
    expect(source).toMatch(/data-testid="arena-ladder"[\s\S]{0,200}height: ladderMaxH \?\? undefined/);
    expect(source).toMatch(/data-testid="arena-ladder"[\s\S]{0,200}boxSizing: "border-box"/);
  });

  it("benutzt die geprueften Masse, statt sie noch einmal hinzuschreiben", () => {
    expect(source).toContain("resolveArenaLadderRowHeight({ ladderMaxH, ladderHeadH, rowCount: N })");
    expect(source).toContain("const LADDER_PAD_Y = ARENA_LADDER_PAD_Y;");
  });
});

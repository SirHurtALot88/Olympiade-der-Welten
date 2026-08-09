/**
 * GEMELDET VON CHRIS: „climbing bitte gleiche höhe wie die tabelle rechts daneben - das gilt
 * für alle disziplinen das soll auf einer linie sein"
 *
 * BEFUND: Die Absicht stand schon im Code — die Ladder wird an der Arena-Hauptspalte gemessen
 * und darauf gekappt. Die Messung war aber ZIRKULAER, und zwar durch die Zeile, die sie
 * eigentlich stuetzen sollte:
 *
 *   Ladder-Hoehe   ←  gemessene Hoehe der Hauptspalte   (ResizeObserver auf mainColRef)
 *   Hauptspalte    ←  Hoehe der Flex-Zeile              (weil alignItems: stretch)
 *   Flex-Zeile     ←  die HOEHERE der beiden Spalten
 *
 * Beim ersten Bild ist `ladderMaxH` null, die Ladder also so hoch wie ihr Inhalt (Kopf + N
 * Zeilen a 25px Rueckfallwert). Ist sie dabei hoeher als die Arena, zieht `stretch` die
 * HAUPTSPALTE auf dieses Mass hoch — und gemessen wird danach nicht mehr die Arena, sondern
 * die aufgeblasene Spalte. Beide Kaesten sind dann zwar gleich hoch, aber die Arena hat unten
 * tote Flaeche: ihr Inhalt endet frueher als ihr Kasten. Genau das sieht man als „das Feld
 * steht nicht auf einer Linie mit der Tabelle".
 *
 * Warum Quelltext-Prüfung: Das Projekt fährt vitest ohne jsdom; Flex-Layout und
 * ResizeObserver gibt es hier nicht. Geprüft wird deshalb die Bedingung, unter der die
 * Messung ueberhaupt aussagekraeftig sein KANN — dass die gemessene Spalte nicht selbst vom
 * Messergebnis abhaengt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
  "utf8",
);

describe("Arena · Feld und Tabelle enden auf einer Linie", () => {
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

  it("misst weiterhin die Hauptspalte und kappt die Ladder darauf", () => {
    // Die Richtung muss die gleiche bleiben: Arena ist das Mass, Ladder folgt.
    // Anders herum (Arena an Ladder gekappt) ragte die Ladder frueher ueber die Arena.
    expect(source).toMatch(/const el = mainColRef\.current;[\s\S]{0,400}setLadderMaxH/);
    expect(source).toMatch(/data-testid="arena-ladder"[\s\S]{0,200}height: ladderMaxH \?\? undefined/);
  });

  it("gibt der Ladder ihre Hoehe explizit, nicht ueber das Dehnen", () => {
    // `height: ladderMaxH` erledigt genau das, wofuer `stretch` gedacht war — deshalb
    // kostet das Entfernen von `stretch` nichts und repariert die Messung.
    expect(source).toContain("height: ladderMaxH ?? undefined");
  });

  it("leitet die Zeilenhoehe der Ladder aus der gemessenen Hoehe ab", () => {
    // Damit die Tabelle den zugeteilten Platz fuellt statt frueher zu enden.
    expect(source).toMatch(/if \(ladderMaxH == null \|\| ladderHeadH <= 0\) return 25;/);
    expect(source).toMatch(/const available = ladderMaxH - ladderHeadH - LADDER_PAD_Y \* 2;/);
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tokenRadius, tokenRankScale } from "@/app/foundation/discipline-stage/arena/disciplines/benchmark";
import type { FieldGeo, RT } from "@/app/foundation/discipline-stage/arena/disciplines/types";

const DISCIPLINES_DIR = join(process.cwd(), "app/foundation/discipline-stage/arena/disciplines");

const token = (over: Partial<RT>): RT => ({ rank: 16, isOwn: false, ...over }) as RT;

/**
 * „Können wir in jeder Diszi einführen, dass Teams die weiter vorne sind größere Logos in
 * der Arena erhalten? Dann werden die starken Teams weiter hervorgehoben."
 *
 * Der Maßstab ist der ANZEIGE-Rang (`t.rank`) — derselbe animierte Zeitstrahl, an dem die
 * Rangliste hängt, damit Logo und Tabelle im selben Frame springen.
 */
describe("Arena: Token-Größe nach Rang", () => {
  it("gibt der Spitze das 1,5-Fache und flacht nach hinten ab", () => {
    expect(tokenRankScale(1)).toBeCloseTo(1.5, 5);
    expect(tokenRankScale(2)).toBeGreaterThan(tokenRankScale(3));
    expect(tokenRankScale(3)).toBeGreaterThan(tokenRankScale(6));
    // Ab Rang 13 einheitlich — sonst hätte jedes der 32 Teams eine eigene Größe und der
    // Unterschied wäre nirgends mehr ablesbar.
    expect(tokenRankScale(13)).toBe(1);
    expect(tokenRankScale(32)).toBe(1);
  });

  it("wächst monoton nach vorne", () => {
    for (let rank = 1; rank < 20; rank += 1) {
      expect(tokenRankScale(rank), `Rang ${rank}`).toBeGreaterThanOrEqual(tokenRankScale(rank + 1));
    }
  });

  it("verkraftet fehlende oder unsinnige Ränge", () => {
    // Vor der ersten Wertung gibt es keinen Rang — dann eben Normalgröße statt NaN.
    expect(tokenRankScale(null)).toBe(1);
    expect(tokenRankScale(undefined)).toBe(1);
    expect(tokenRankScale(0)).toBe(1);
    expect(tokenRankScale(Number.NaN)).toBe(1);
  });

  /**
   * DIE SICHERHEITSGRENZE. Das eigene Team hat seit jeher `geo.rOwn` — je Feld das 1,4- bis
   * 1,5-Fache von `geo.r`. Liegt der Spitzenreiter darüber, entstünde eine Token-Größe, die
   * es im Feld noch nie gab, und die Layout-Abstände (lanes: laneH = 604/N) sind darauf
   * nicht ausgelegt.
   */
  it("bleibt an der Spitze im Rahmen der heutigen Eigen-Team-Größe", () => {
    const geos: Array<[string, FieldGeo]> = [
      ["track", { w: 1180, h: 620, r: 15.5, rOwn: 23 }],
      ["towers", { w: 1180, h: 600, r: 12, rOwn: 16.5 }],
      ["stage", { w: 1180, h: 640, r: 12, rOwn: 18 }],
      ["lanes", { w: 1180, h: 640, r: 9.5, rOwn: 13 }],
    ];
    for (const [name, geo] of geos) {
      const leader = tokenRadius(token({ rank: 1 }), geo);
      // Höchstens 12 % über der Größe, die ein Token im Feld heute schon hat.
      expect(leader / geo.rOwn, name).toBeLessThanOrEqual(1.12);
      expect(leader, name).toBeGreaterThan(geo.r);
    }
  });

  it("lässt das eigene Team nie kleiner werden als bisher", () => {
    const geo: FieldGeo = { w: 1180, h: 640, r: 9.5, rOwn: 13 };
    // Letzter Platz: der Anker darf nicht schrumpfen, sonst findet man sich schlechter.
    expect(tokenRadius(token({ rank: 32, isOwn: true }), geo)).toBe(13);
    // Führend: wächst mit, aber gedeckelt durch dieselbe Kurve.
    expect(tokenRadius(token({ rank: 1, isOwn: true }), geo)).toBeCloseTo(14.25, 5);
  });

  it("skaliert auch einen Feld-eigenen Radius-Override", () => {
    // duelhp-Pit und barbell-Heber geben TokenChrome eine eigene Größe mit — die soll
    // demselben Gefälle folgen, sonst hätten ausgerechnet diese Felder keins.
    const geo: FieldGeo = { w: 1180, h: 640, r: 9.5, rOwn: 13 };
    expect(tokenRadius(token({ rank: 1 }), geo, 20)).toBeCloseTo(30, 5);
    expect(tokenRadius(token({ rank: 32 }), geo, 20)).toBeCloseTo(20, 5);
  });

  /**
   * Der Clip-Pfad jeder Feld-Datei MUSS denselben Radius benutzen wie das Bild. Rechnet er
   * weiter mit `geo.r`, wird das größere Logo am alten Kreis abgeschnitten — sichtbar als
   * angeknabbertes Wappen genau bei den Teams, die hervorgehoben werden sollen.
   */
  it("berechnet keine Feld-Datei den Radius mehr selbst", () => {
    const offenders: string[] = [];
    for (const name of readdirSync(DISCIPLINES_DIR).filter((entry) => entry.endsWith(".tsx"))) {
      const source = readFileSync(join(DISCIPLINES_DIR, name), "utf8");
      // Kommentare zählen nicht — die Erklärung in benchmark.tsx nennt die alte Formel.
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      if (code.includes("isOwn ? geo.rOwn : geo.r")) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * GEWICHTHEBEN: DIE KILOGRAMM MÜSSEN DEM SCORE FOLGEN.
 *
 * GEMELDET VON CHRIS (Endstand Gewichtheben): „Anzeige und score passen jetzt nicht mehr
 * zusammen bitte fixen!" — im Screenshot stand P-S mit 400 kg auf Platz 1 bei einem Score von
 * 297,6, während V-V mit 150 kg ganz unten stand und mit 532,1 den BESTEN Score hatte. Die
 * Zeilen selbst waren korrekt zugeordnet (Kürzel und Heber-Name passten zum Team) — nur die
 * Kilogramm gehörten jemand anderem.
 *
 * BEFUND: `endKg` war ein Array über die Array-Position von `teams`, ausgelesen als
 * `endKg[t.idx]`. `t.idx` stammt aus `buildRT()`, und der Reset-Effekt läuft NUR BEIM MOUNT
 * (mit gutem Grund: sonst wirft jeder Eltern-Render die laufende Simulation auf Runde 0 zurück).
 * Die Ableitung dagegen hängt an `[prim, teams]` und rechnet bei jeder neuen `teams`-Identität
 * neu — und `payload.teams` wird durch `orderStageTeamsBySeasonRank` UMSORTIERT, sobald
 * Disziplin 1 gewertet ist. Ab diesem Moment zeigten beide Seiten auf verschiedene
 * Reihenfolgen. Genau deshalb stimmte es während der Disziplin und erst danach nicht mehr
 * („jetzt nicht mehr").
 *
 * Diese Suite pinnt die EIGENSCHAFT und nicht die Formel: die kg-Reihenfolge ist die
 * Score-Reihenfolge, und eine Umsortierung der Team-Liste darf daran nichts ändern.
 */
import { describe, expect, it } from "vitest";

import {
  accumulateRevealedTeamScore,
  buildBarbellInfo,
} from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

type Team = { code: string; players: Array<{ val: number; mods: never[] } | null> };

/** Sechs Etappen je Team — bewusst mit einem Team, das nur vier Heber stellt (wie P-S). */
function feld(): Team[] {
  const mach = (code: string, werte: number[]): Team => ({
    code,
    players: werte.map((val) => ({ val, mods: [] as never[] })),
  });
  return [
    mach("V-V", [132.4, 92.3, 66.4, 90.9, 83.9, 66.2]), // 532,1 — bester Score
    mach("W-L", [92.4, 80.1, 83.1, 92.6, 93.8, 47.1]), // 489,1
    mach("S-S", [104.3, 78.2, 75.2, 76.6, 76.7, 62]), // 473
    mach("L-R", [100.2, 46.2, 51.9, 43.1, 39.4, 45.7]), // 326,5
    mach("P-S", [125.3, 58, 60.2, 54.1]), // 297,6 — nur vier Heber
  ];
}

const summe = (t: Team) => accumulateRevealedTeamScore(t.players);

describe("Gewichtheben · kg folgt dem Score", () => {
  it("gibt dem besten Score das höchste Gewicht", () => {
    const info = buildBarbellInfo(feld());
    expect(info.endKgByCode.get("V-V")).toBe(info.kgMax);
    expect(info.endKgByCode.get("P-S")).toBe(info.kgMin);
  });

  it("ordnet nach kg exakt wie nach Score — über das ganze Feld", () => {
    const teams = feld();
    const info = buildBarbellInfo(teams);
    const nachScore = [...teams].sort((a, b) => summe(b) - summe(a)).map((t) => t.code);
    const nachKg = [...teams]
      .sort((a, b) => info.endKgByCode.get(b.code)! - info.endKgByCode.get(a.code)!)
      .map((t) => t.code);
    expect(nachKg).toEqual(nachScore);
  });

  /**
   * DER GEMELDETE FEHLER. Nach dem Werten von Disziplin 1 wird die Team-Liste nach dem
   * aktualisierten Saisonstand umsortiert. Das darf an keinem einzigen Kilogramm etwas ändern.
   */
  it("liefert dasselbe Gewicht, egal in welcher Reihenfolge die Teams ankommen", () => {
    const vorher = buildBarbellInfo(feld());
    const umsortiert = buildBarbellInfo([...feld()].reverse());
    for (const code of ["V-V", "W-L", "S-S", "L-R", "P-S"]) {
      expect(umsortiert.endKgByCode.get(code), `kg von ${code} haengt an der Position`).toBe(
        vorher.endKgByCode.get(code),
      );
    }
  });

  it("hält auch bei einer beliebigen anderen Reihenfolge", () => {
    const gemischt = ["P-S", "V-V", "L-R", "S-S", "W-L"].map(
      (code) => feld().find((t) => t.code === code)!,
    );
    const info = buildBarbellInfo(gemischt);
    const referenz = buildBarbellInfo(feld());
    for (const [code, kg] of referenz.endKgByCode) {
      expect(info.endKgByCode.get(code)).toBe(kg);
    }
  });

  it("rechnet die Team-Summe mit derselben Faltung wie der Reveal", () => {
    // Zwei Faltungen derselben Größe wären wieder zwei Quellen — und genau daran hing
    // zuletzt, dass der Führende neben der Ziellinie landete.
    const info = buildBarbellInfo(feld());
    for (const team of feld()) {
      expect(info.totalByCode.get(team.code)).toBe(accumulateRevealedTeamScore(team.players));
    }
  });

  it("bleibt heil, wenn alle Teams gleichauf sind", () => {
    // Spanne 0 — ohne Schutz eine Division durch null und damit NaN-Kilogramm.
    const gleich = ["A-A", "B-B", "C-C"].map((code) => ({
      code,
      players: [{ val: 50, mods: [] as never[] }],
    }));
    const info = buildBarbellInfo(gleich);
    for (const kg of info.endKgByCode.values()) {
      expect(Number.isFinite(kg)).toBe(true);
      expect(kg).toBe(150);
    }
  });

  it("kennt jedes Team, auch das ohne einen einzigen Heber", () => {
    const mitLeerem = [...feld(), { code: "X-X", players: [] as Team["players"] }];
    const info = buildBarbellInfo(mitLeerem);
    expect(info.endKgByCode.has("X-X")).toBe(true);
    // Ohne Punkte das kleinste Gewicht — nicht `undefined`, das die Achse verrutschen liesse.
    expect(info.endKgByCode.get("X-X")).toBe(info.kgMin);
  });
});

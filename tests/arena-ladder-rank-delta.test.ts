import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveLadderPrevRank } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";

/**
 * "Rang Δ" stand im Endstand der Arena-Ladder ausnahmslos auf "—". Zwei
 * unabhängige Ursachen, beide hier festgenagelt.
 */
describe("Arena-Ladder: Rang-Δ gegen den Stand VOR der gezeigten Etappe", () => {
  it("nimmt während einer laufenden Etappe den letzten Historien-Eintrag", () => {
    // Etappen 1–3 gewertet (Ränge 5, 4, 2), Etappe 4 läuft gerade.
    // Verglichen wird gegen den Stand nach Etappe 3.
    expect(resolveLadderPrevRank([5, 4, 2], false)).toBe(2);
  });

  it("nimmt im Endstand den VORLETZTEN Eintrag statt sich selbst", () => {
    // Alle 5 Etappen gewertet, Endrang 1. Der letzte Eintrag IST der Endrang —
    // ein Vergleich damit ergäbe immer 0 und damit "—".
    expect(resolveLadderPrevRank([5, 4, 2, 2, 1], true)).toBe(2);
  });

  it("liefert null, solange es keine abgeschlossene Vor-Etappe gibt", () => {
    // Erste Etappe läuft, noch nichts gewertet.
    expect(resolveLadderPrevRank([], false)).toBeNull();
    // Endstand nach genau EINER Etappe: es gibt kein Davor.
    expect(resolveLadderPrevRank([3], true)).toBeNull();
    // Kein erfundener Nullwert — die Zelle zeigt dann nichts.
    expect(resolveLadderPrevRank([], true)).toBeNull();
  });

  it("erzeugt aus einem echten Verlauf ein von null verschiedenes Delta", () => {
    const history = [8, 6, 6, 3];
    const finalRank = 3;
    const prevRank = resolveLadderPrevRank(history, true);
    expect(prevRank).toBe(6);
    expect(prevRank! - finalRank).toBe(3); // drei Ränge in der Schlussetappe gutgemacht
  });
});

describe("Arena-Quick-Sim: echter Rang-Verlauf statt Kopien des Endrangs", () => {
  const source = readFileSync(
    join(process.cwd(), "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
    "utf8",
  );

  it("hält den Rang nach JEDER Etappe fest, wie der sequenzielle Pfad", () => {
    // Der sequenzielle Pfad schreibt am Rundenende genau so fort.
    expect(source).toContain("rt.forEach((t) => t.rankHistory.push(t.trueRank)); // Rang-Verlauf je Etappe");
    // Der Quick-Sim tut das jetzt ebenfalls — innerhalb der Etappen-Schleife.
    expect(source).toContain("rt.forEach((t) => t.rankHistory.push(t.trueRank));");
  });

  it("füllt die Historie NICHT mehr mit slotCount Kopien des Endrangs", () => {
    // Genau das war die zweite Ursache: nach einem Quick-Sim gab es gar keinen
    // Verlauf mehr — Rang-Δ blieb "—" und die Bump-/Slalom-Linien liefen gerade.
    expect(source).not.toContain("t.rankHistory = Array.from({ length: slotCount }, () => t.trueRank);");
  });
});

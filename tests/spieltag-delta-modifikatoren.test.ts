/**
 * Δ MODIFIKATOREN — was Aufstellung, Form, Captain und Mutatoren an PLÄTZEN gebracht haben.
 *
 * GEWÜNSCHT VON CHRIS: Das alte „Daten-Ansicht"-Scoreboard zeigte diese Zahl. Beim Umbau auf den
 * neuen Look ging sie verloren — `lib/season/matchday-arena-presenter.ts` rechnet `baseRank` und
 * `rankDelta` bis heute, aber die Funktion dort ruft keine Ansicht mehr auf. Die Zahl entstand und
 * verschwand ungesehen.
 *
 * Sie beantwortet eine Frage, die aus den Punkten allein nicht ablesbar ist: hat meine Aufstellung
 * überhaupt etwas gebracht? Ein Team kann Rang 12 werden, weil es mit Rang 12 hineinging — oder
 * weil es von Rang 20 dorthin geklettert ist.
 *
 * Die Regel als reine Funktion nachgebaut: zwei Ranglisten über dieselbe Liga, einmal nach der
 * Basis-Leistung (`entry.baseValue`, vor allen Modifikatoren) und einmal nach dem Endstand
 * (`teamResult.score`). Δ = Basis-Rang − End-Rang; positiv heißt „nach vorn gekommen".
 */
import { describe, expect, it } from "vitest";

type Werte = { d1Base: number; d1Score: number; d2Base: number; d2Score: number };

/**
 * Dieselbe Rechnung wie in `DisciplineStageMatchdayPanel.tsx`. Bewusst hier gespiegelt statt aus
 * der grossen Client-Komponente exportiert — worauf es ankommt, sind die Aufdeck-Regel und die
 * identische Sortierung beider Ranglisten.
 */
function berechneDelta(
  proTeam: Map<string, Werte>,
  d1Revealed: boolean,
  d2Revealed: boolean,
): Map<string, { baseRank: number; rankDelta: number }> | null {
  if (proTeam.size === 0) return null;
  if (!d1Revealed && !d2Revealed) return null;
  const basis = new Map<string, number>();
  const endstand = new Map<string, number>();
  for (const [teamId, w] of proTeam) {
    basis.set(teamId, (d1Revealed ? w.d1Base : 0) + (d2Revealed ? w.d2Base : 0));
    endstand.set(teamId, (d1Revealed ? w.d1Score : 0) + (d2Revealed ? w.d2Score : 0));
  }
  const rangliste = (werte: Map<string, number>) =>
    new Map(
      [...werte.entries()]
        .sort((l, r) => r[1] - l[1] || l[0].localeCompare(r[0], "de"))
        .map(([teamId], index) => [teamId, index + 1] as const),
    );
  const basisRang = rangliste(basis);
  const endRang = rangliste(endstand);
  const ergebnis = new Map<string, { baseRank: number; rankDelta: number }>();
  for (const [teamId, rang] of endRang) {
    const vorher = basisRang.get(teamId) ?? rang;
    ergebnis.set(teamId, { baseRank: vorher, rankDelta: vorher - rang });
  }
  return ergebnis;
}

/**
 * Drei Teams, deren Basis-Reihenfolge A > B > C ist. Die Modifikatoren drehen sie zu C > A > B:
 * C klettert zwei Plätze, A verliert einen, B verliert einen.
 */
const LIGA = new Map<string, Werte>([
  ["A", { d1Base: 100, d1Score: 100, d2Base: 0, d2Score: 0 }],
  ["B", { d1Base: 90, d1Score: 80, d2Base: 0, d2Score: 0 }],
  ["C", { d1Base: 80, d1Score: 120, d2Base: 0, d2Score: 0 }],
]);

describe("Δ Modifikatoren", () => {
  it("zeigt, wer durch die Modifikatoren geklettert und wer gefallen ist", () => {
    const delta = berechneDelta(LIGA, true, false)!;
    // C war Basis-Dritter und ist Erster geworden: zwei Plätze gut.
    expect(delta.get("C")).toEqual({ baseRank: 3, rankDelta: 2 });
    // A war Basis-Erster und ist Zweiter: einen verloren.
    expect(delta.get("A")).toEqual({ baseRank: 1, rankDelta: -1 });
    expect(delta.get("B")).toEqual({ baseRank: 2, rankDelta: -1 });
  });

  it("summiert sich über die Liga auf null — es werden nur Plätze getauscht", () => {
    const delta = berechneDelta(LIGA, true, false)!;
    const summe = [...delta.values()].reduce((s, e) => s + e.rankDelta, 0);
    expect(summe).toBe(0);
  });

  it("ohne Wirkung der Modifikatoren ist das Δ überall 0", () => {
    const ohne = new Map<string, Werte>([
      ["A", { d1Base: 100, d1Score: 110, d2Base: 0, d2Score: 0 }],
      ["B", { d1Base: 90, d1Score: 99, d2Base: 0, d2Score: 0 }],
    ]);
    const delta = berechneDelta(ohne, true, false)!;
    expect([...delta.values()].every((e) => e.rankDelta === 0)).toBe(true);
  });

  it("rechnet nur aufgedeckte Disziplinen mit — eine verdeckte darf nichts verraten", () => {
    const beide = new Map<string, Werte>([
      // In d1 gleichauf; erst d2 dreht die Reihenfolge. Solange d2 verdeckt ist, darf davon
      // nichts durchschlagen.
      ["A", { d1Base: 100, d1Score: 100, d2Base: 10, d2Score: 200 }],
      ["B", { d1Base: 100, d1Score: 100, d2Base: 200, d2Score: 10 }],
    ]);
    const nurD1 = berechneDelta(beide, true, false)!;
    expect([...nurD1.values()].every((e) => e.rankDelta === 0)).toBe(true);

    const mitD2 = berechneDelta(beide, true, true)!;
    // Jetzt schlaegt d2 durch: A war in der Basis Zweiter und wird Erster.
    expect(mitD2.get("A")!.rankDelta).toBe(1);
    expect(mitD2.get("B")!.rankDelta).toBe(-1);
  });

  it("liefert null, solange nichts aufgedeckt ist", () => {
    expect(berechneDelta(LIGA, false, false)).toBeNull();
  });
});

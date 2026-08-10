/**
 * DIE TOP-SPIELER UNTER DER SPIELTAGS-WERTUNG GEHÖREN DEM GANZEN SPIELTAG.
 *
 * GEMELDET VON CHRIS (Arena, Spieltag 7): „die top player unten unter der spieltagstabelle sollen
 * die für den gesamten spieltag sein! also beides zusammen."
 *
 * URSACHE: `topPlayers` in `DisciplineStageArena.tsx` liest `engineDiscipline.topPlayers`, und
 * `engineDiscipline` ist die EINE gerade laufende Disziplin
 * (`preview.disciplinePreviews.find((d) => d.disciplineId === disciplineId)`). Unter einer Wertung,
 * die beide Disziplinen zusammenfasst, stand damit eine Spielerliste aus nur einer Hälfte — wer in
 * D1 überragend war und in D2 nicht antrat, verschwand nach dem Wechsel spurlos.
 *
 * Zwei Dinge hält diese Datei fest: die Rechenregel (summieren, nicht aneinanderhängen) und die
 * Aufdeck-Regel (D2 darf nicht durchschlagen, solange sie verdeckt ist).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ARENA = readFileSync(join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");

/** Der Rumpf der neuen Zusammenfassung — bis zum nächsten Top-Level-Kommentarblock. */
const MEMO = (() => {
  const start = ARENA.indexOf("const matchdayTopPlayers = useMemo(() => {");
  const ende = ARENA.indexOf("S3 · Expliziter Pre-Matchday-Zustand", start);
  return ARENA.slice(start, ende > start ? ende : start + 4000);
})();

describe("Die Liste zieht beide Disziplinen heran", () => {
  it("sie liest die Disziplin-Vorschauen der Vorschau, nicht die eine laufende", () => {
    // Das war der Fehler: `engineDiscipline` ist genau eine Disziplin.
    expect(MEMO).toContain("for (const dp of preview.disciplinePreviews ?? [])");
    expect(MEMO).not.toContain("engineDiscipline.topPlayers");
  });

  it("ein Spieler steht einmal da, mit der Summe seiner Werte", () => {
    expect(MEMO).toContain("const proSpieler = new Map<string, Sammel>();");
    expect(MEMO).toContain("vorhanden.row.score = round1(vorhanden.row.score + pp.finalPlayerScore)");
    // Punkte und Mutator-Aufschlag summieren mit, statt beim ersten Treffer stehenzubleiben.
    expect(MEMO).toContain("(vorhanden.row.points ?? 0) + (punkte ?? 0)");
    expect(MEMO).toContain("(vorhanden.row.mutatorPoints ?? 0) + (pp.mutatorPpsBonus ?? 0)");
  });

  it("sortiert wie vorher: Player-Points zuerst, Score als Tiebreak", () => {
    expect(MEMO).toContain("(b.row.points ?? -1) - (a.row.points ?? -1) || b.row.score - a.row.score");
  });
});

describe("Die Aufdeck-Regel bleibt", () => {
  it("nur aufgedeckte Disziplinen zählen mit", () => {
    expect(MEMO).toContain("if (panelD1Revealed && matchdayPanel?.d1?.disciplineId)");
    expect(MEMO).toContain("if (panelD2Revealed && matchdayPanel?.d2?.disciplineId)");
    expect(MEMO).toContain("if (!revealedIds.has(dp.disciplineId)) continue;");
  });

  it("ohne eine einzige aufgedeckte Seite gibt es keine Liste", () => {
    // Sonst stünde vor dem ersten Reveal eine Rangfolge da, die niemand kennen darf.
    expect(MEMO).toContain("if (revealedIds.size === 0) return null;");
  });

  it("die Aufdeck-Flags sind dieselben, gegen die die Spieltags-Wertung rechnet", () => {
    // Zwei Quellen für dieselbe Frage würden auseinanderlaufen; die Wertung darüber benutzt genau
    // diese beiden Flags.
    expect(ARENA).toContain("const panelD1Revealed = Boolean(");
    expect(ARENA).toContain("const panelD2Revealed = Boolean(");
    expect(ARENA).toContain("d1Revealed={panelD1Revealed}");
    expect(ARENA).toContain("d2Revealed={panelD2Revealed}");
  });
});

describe("Die Tabelle unter der Wertung benutzt sie wirklich", () => {
  it("die Spieltagsliste hat Vorrang, die Disziplin-Liste bleibt Rückfall", () => {
    expect(ARENA).toContain("players={(matchdayTopPlayers ?? topPlayers).rows}");
    expect(ARENA).toContain("playerIdByRow={(matchdayTopPlayers ?? topPlayers).ids}");
  });

  /**
   * Die LIVE-Zeile in der Bühne (`DisciplineStageTopPlayersRow` in der nativen Arena) bleibt
   * bewusst bei der laufenden Disziplin: sie zeigt nur bereits GEWORFENE Spieler und wächst mit dem
   * Ablauf mit. Ihr eine spieltagsweite Liste zu geben, hätte keinen Effekt (der Reveal-Filter
   * dort kennt nur die Slots der laufenden Disziplin) und wäre mitten im Lauf verwirrend.
   */
  it("die Live-Zeile der Bühne bleibt bei der laufenden Disziplin", () => {
    expect(ARENA).toContain("topPlayers={topPlayers}");
  });
});

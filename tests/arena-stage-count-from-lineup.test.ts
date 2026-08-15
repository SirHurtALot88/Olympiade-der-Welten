import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveDisciplineStageSlotCount } from "@/lib/foundation/discipline-stage/discipline-stage-slot-count";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * "Ziel nach 3 von 5 Etappen erreicht, danach passiert nichts mehr."
 *
 * Ursache: die Etappenzahl kam aus `model.slotCount`, und das ist
 * `discipline.playerCount` — die ANFORDERUNG der Disziplin. Stellt ein Spieltag
 * weniger Spieler als gefordert (bei Staffel und Takeshi vorgekommen), lief die
 * Arena trotzdem ueber die geforderte Zahl: in den ueberzaehligen Etappen ist
 * `players[r]` `undefined`, es wird nichts addiert, im Feld bewegt sich nichts.
 * Die Ziellinie ist dagegen der Endstand des besten Teams ueber DESSEN Spieler
 * und war nach der letzten echten Etappe erreicht.
 */
/**
 * VON TEXTSUCHE AUF VERHALTEN UMGESTELLT (16.08.2026). Diese drei Faelle pinnten bis dahin den
 * WORTLAUT des Ausdrucks im Bauteil (`toContain("teams.reduce((max, team) => …")`). Beim Herausziehen
 * der Rechnung nach `lib/foundation/discipline-stage/discipline-stage-slot-count.ts` fielen sie um,
 * obwohl die Eigenschaft unveraendert galt — der Test mass die Schreibweise, nicht die Zusage.
 *
 * Herausgezogen wurde sie, weil der Arena-Gleichlauf seit Befund B3 einen ZWEITEN Aufrufer stellt:
 * der Mitspieler bekommt diese Zahl als Ziel gemeldet. Anzeige und Gleichlauf muessen dieselbe
 * nehmen — sonst haelt der Gast zu frueh an oder wartet auf eine Etappe, die nie kommt.
 */
describe("Arena: Etappenzahl folgt der tatsaechlichen Aufstellung", () => {
  it("leitet die Etappenzahl aus den Spielern der Teams ab, nicht aus der Anforderung", () => {
    // Die Disziplin FORDERT 5, aufgestellt sind aber nur 3 — genau der gemeldete Fall
    // („Ziel nach 3 von 5 Etappen erreicht, danach passiert nichts mehr").
    expect(resolveDisciplineStageSlotCount({ playerCountsByTeam: [3, 3, 2], fallbackSlotCount: 5 })).toBe(3);
  });

  it("nimmt das Maximum ueber die Teams, nicht das Minimum", () => {
    // Teams duerfen unterschiedlich viele Spieler haben — wer mehr hat, muss sie auch alle zeigen
    // duerfen. Ein Minimum wuerde Etappen unterschlagen.
    expect(resolveDisciplineStageSlotCount({ playerCountsByTeam: [2, 6, 4], fallbackSlotCount: 5 })).toBe(6);
  });

  it("faellt nur zurueck, wenn gar keine Spieler vorliegen, und nie unter 1", () => {
    // Keine Aufstellung bekannt (weder Vorschau noch gebuchtes Ergebnis) ⇒ Anforderung als Rueckfall.
    expect(resolveDisciplineStageSlotCount({ playerCountsByTeam: [], fallbackSlotCount: 5 })).toBe(5);
    // Auch lauter Nullen sind „nichts aufgestellt" — sonst stuende die Arena bei 0 Etappen.
    expect(resolveDisciplineStageSlotCount({ playerCountsByTeam: [0, 0], fallbackSlotCount: 4 })).toBe(4);
    // Und selbst ohne jede Angabe niemals 0: eine Arena ohne Etappe liefe sofort ins Ziel, und der
    // Gleichlauf haette wieder die B3-Sackgasse (0 < 0 ist nie wahr).
    expect(resolveDisciplineStageSlotCount({ playerCountsByTeam: [], fallbackSlotCount: 0 })).toBe(1);
  });

  it("liefert dieselbe Zahl an Anzeige UND Gleichlauf — eine Quelle", () => {
    // Das ist die Zusage, die das Herausziehen ueberhaupt noetig machte: `DisciplineStageArena.tsx`
    // ruft dieselbe Funktion fuer die angezeigten Etappen und fuer die an den Mitspieler gemeldete
    // Zaehlgrenze. Zwei Ableitungen waeren wieder zwei Wahrheiten.
    const host = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
    expect(host).toContain("resolveDisciplineStageSlotCount");
    expect(host).not.toContain("maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 }");
  });
});

/**
 * Der Team-Hover der Arena beantwortet jetzt auch "wer sind hier die Stars?" —
 * die Eingesetzt-Liste zeigt nur, wer HEUTE laeuft.
 */
describe("Arena-Team-Hover: Top 3 nach OVR", () => {
  const preview = read("app/foundation/discipline-stage/DisciplineStageHoverPreview.tsx");

  it("zeigt die drei staerksten Spieler des Teams mit Portrait", () => {
    expect(preview).toContain("Top 3 · OVR");
    expect(preview).toContain("const topByOvr");
    expect(preview).toContain(".slice(0, 3)");
    expect(preview).toContain("getPlayerPortraitBrowserUrl");
  });

  it("sortiert nach OVR und bricht Gleichstand ueber den Namen", () => {
    expect(preview).toContain(
      'right.ovr - left.ovr || left.player.name.localeCompare(right.player.name, "de")',
    );
  });

  it("traegt am Portrait den Star-Rahmen aus dem OVR-Ligarang", () => {
    expect(preview).toContain("getPlayerStarTier(entry.ovrRank)");
    expect(preview).toContain("<PlayerStarFrame tier={tier} shape=\"circle\">");
  });

  it("bindet die Zeile NICHT an den Reveal — OVR ist kein Spoiler", () => {
    // Die Eingesetzt-Liste haengt an `liveResultsByTeam` (Disziplin-Ergebnisse
    // sind geschuetzt). OVR steht dagegen ohnehin in Kader, Tabelle und Drawer.
    const topBlock = preview.slice(preview.indexOf("const topByOvr"), preview.indexOf("const fielded") + 1);
    expect(topBlock).not.toContain("liveResultsByTeam");
  });
});

/**
 * Im Team-Hover stand neben den PP der Arena-Zwischenstand (`live.net`), waehrend
 * die PP aus dem FINALEN Score der Engine (`finalPlayerScore`) kommen. Zwei
 * verschiedene Groessen nebeneinander — dadurch sah die Reihenfolge
 * widerspruechlich aus: ein Spieler mit sichtbar hoeherem Wert konnte weniger PP
 * haben.
 */
describe("Arena-Team-Hover: PP stehen neben dem Score, aus dem sie stammen", () => {
  const preview = read("app/foundation/discipline-stage/DisciplineStageHoverPreview.tsx");

  it("zeigt den finalen Score der Engine, nicht den Arena-Zwischenstand", () => {
    expect(preview).toContain("{fmt1(pp.score)}");
    expect(preview).toContain("Finaler Score ${fmt1(pp.score)}");
  });

  it("nennt den Arena-Zwischenstand nur, wenn er wirklich abweicht", () => {
    expect(preview).toContain("Math.abs(pp.score - live.net) >= 0.05");
  });
});

/**
 * Begruendung fuer die Anzeige: die PP werden ANTEILIG am finalen Score innerhalb
 * des Teams verteilt. Sie sind darin also monoton — waere das nicht so, waere die
 * vom Playtest gemeldete Reihenfolge tatsaechlich ein Verteilungsfehler gewesen.
 */
describe("PP-Verteilung: anteilig am finalen Score innerhalb des Teams", () => {
  const rankToPoints = read("lib/resolve/rank-to-points.ts");

  it("verteilt primaer nach finalPlayerScore", () => {
    expect(rankToPoints).toContain(
      "const finalScoreDistribution = distributeByValues(input.entries, teamPoints, (entry) => entry.finalPlayerScore);",
    );
    expect(rankToPoints).toContain('pointSource: "rank_to_points_final_score_share"');
  });

  it("faellt erst danach auf baseValue bzw. scoreContribution zurueck, mit Warnung", () => {
    expect(rankToPoints).toContain('warnings.push("rank_to_points_used_base_share_fallback")');
    expect(rankToPoints).toContain('warnings.push("rank_to_points_used_score_share_fallback")');
  });
});

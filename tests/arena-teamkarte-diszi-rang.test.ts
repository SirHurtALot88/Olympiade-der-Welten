/**
 * ARENA · TEAM-KARTE: PLATZ UND SCORE IN DER AKTIVEN DISZIPLIN, UND DER RAHMEN DAZU.
 *
 * GEMELDET VON CHRIS (Team-Karte in der Arena, Screenshot Hell Raisers):
 *   „holo effekte und rahmen fehlen hier noch"
 *   „es waere gut auf den portriats zu sehen welchen rank und wie viel score sie in der aktiven
 *    diszi hatten"
 *
 * ZUM RAHMEN: die Stufe war da (der OVR-Rang steht sichtbar auf den Karten — #21, #46, #50), aber
 * das Arena-Raster macht die Karte selbst unsichtbar (`border: 0; background: transparent;
 * box-shadow: none`) und die sichtbare Kachel darin schneidet mit `overflow: hidden` alles ab, was
 * die Karte drumherum zeichnen wollte. Rahmen und Holo haengen deshalb jetzt zusaetzlich an der
 * Kachel. Diese Suite prueft das am CSS, in beide Richtungen: die Regeln existieren, und sie
 * greifen im Arena-Raster.
 *
 * ZUM RANG: `buildDisciplineRankByPlayerId` leitet ihn aus den bereits aufgedeckten Ergebnissen ab
 * — dieselbe Quelle, aus der die Buehne ihre Reihenfolge nimmt.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CSS = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const DRAWER = fs.readFileSync(
  path.join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageDrawer.tsx"),
  "utf8",
);

describe("Arena-Team-Karte: Rahmen und Holo auf den Kacheln", () => {
  it("gibt jeder Stufe einen Ring auf der sichtbaren Kachel", () => {
    for (const stufe of ["bronze", "silver", "gold", "diamond"]) {
      expect(
        CSS,
        `keine Ring-Regel fuer ${stufe} im Arena-Raster`,
      ).toContain(
        `.dstage-portrait-rail-grid .foundation-player-portrait-card.is-star-tier-${stufe} .foundation-player-portrait-hero.is-rail-tile`,
      );
    }
  });

  it("legt den Holo-Streifen auf die Kachel, nicht auf die unsichtbare Karte", () => {
    expect(CSS).toContain(
      ".dstage-portrait-rail-grid .foundation-player-portrait-card.is-star-holo .foundation-player-portrait-hero.is-rail-tile::after",
    );
  });

  /**
   * Der Streifen ist Zierde, keine Information — bei reduzierter Bewegung steht er still.
   * Dieselbe Zusage gilt auf der grossen Karte schon; sie darf hier nicht fehlen.
   */
  it("haelt den Holo-Streifen bei reduzierter Bewegung an", () => {
    const block = CSS.slice(CSS.indexOf(".dstage-portrait-rail-grid .foundation-player-portrait-card.is-star-holo"));
    const reduced = block.indexOf("prefers-reduced-motion");
    expect(reduced).toBeGreaterThan(-1);
    expect(block.slice(reduced, reduced + 400)).toContain("animation: none");
  });

  /**
   * Die Stufe selbst wird NICHT im Arena-Raster neu erfunden — sie kommt weiter aus
   * `is-star-tier-*`/`is-star-holo`, die der Kartenknoten aus dem OVR-Rang traegt. Sonst gaebe es
   * zwei Quellen dafuer, wann eine Karte leuchtet.
   */
  it("erfindet im Arena-Raster keine eigene Stufe", () => {
    const arenaRegeln = CSS.split("\n").filter((zeile) => zeile.includes(".dstage-portrait-rail-grid"));
    for (const zeile of arenaRegeln) {
      if (!zeile.includes("is-star-")) continue;
      // Jede Arena-Regel zur Stufe MUSS sich auf die Karten-Klasse stuetzen.
      expect(zeile, `Arena-Regel ohne Bezug auf den Kartenknoten: ${zeile.trim()}`).toContain(
        "foundation-player-portrait-card.is-star-",
      );
    }
  });
});

describe("Arena-Team-Karte: Platz in der aktiven Disziplin", () => {
  it("rankt ueber ALLE Teams, nicht nur innerhalb des eigenen", () => {
    // Die Ableitung liest `Object.values(liveResultsByTeam)` — also alle Teams.
    expect(DRAWER).toContain("function buildDisciplineRankByPlayerId");
    expect(DRAWER).toContain("Object.values(liveResultsByTeam ?? {})");
    // Und sie wird ohne Team-Filter aufgerufen.
    expect(DRAWER).toContain("buildDisciplineRankByPlayerId(liveResultsByTeam)");
  });

  it("reicht Platz und Feldgroesse an beide Aufrufstellen der Portraitkarte durch", () => {
    const treffer = DRAWER.match(/disciplineRank=\{disciplineRanking\.rankByPlayerId\.get\(pid\) \?\? null\}/g) ?? [];
    expect(treffer).toHaveLength(2);
    const nenner = DRAWER.match(/disciplineFieldSize=\{disciplineRanking\.fieldSize \|\| null\}/g) ?? [];
    expect(nenner).toHaveLength(2);
  });

  it("zeigt den Platz im selben Block wie den Score", () => {
    expect(DRAWER).toContain("data-discipline-rank={disciplineRank}");
    // Der Score („Geholt") bleibt daneben stehen — beides in einer Zeile.
    expect(DRAWER).toContain("fmt1(liveResult.net)");
  });

  /** Ohne aufgedecktes Ergebnis gibt es keinen Platz — dann steht dort wie bisher „Geholt". */
  it("faellt ohne Platz auf die alte Beschriftung zurueck", () => {
    expect(DRAWER).toContain('disciplineRank != null ? (');
    expect(DRAWER).toContain('"Geholt"');
  });
});

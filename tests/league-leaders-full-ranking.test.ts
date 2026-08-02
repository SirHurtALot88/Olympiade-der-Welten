/**
 * GEWUENSCHT: „leaders hätte ich mir so vorgestellt, dass man in jede top 5 rein klicken kann auf
 * nen button und dann die tabelle aufgeht wo man z.B. dann ne top 50 oder so sehen kann oder
 * sogar alle."
 *
 * Die volle Rangliste existierte laengst — `buildLeagueLeaderBoards` schnitt sie nur auf
 * `LEAGUE_LEADER_DEFAULT_LIMIT = 5` zu. Die Kappung war ein Parameter, keine Struktur.
 *
 * Warum ein zweites FELD (`fullEntries`) statt eines zweiten Aufrufs mit hoeherem Limit:
 * sortiert wird genau einmal, `entries` ist woertlich `fullEntries.slice(0, limit)`. Zwei
 * Aufrufe koennten bei Gleichstand auseinanderlaufen — dieselbe Kachel zeigte dann einen
 * anderen Ersten als die aufgeklappte Liste.
 *
 * Und warum `entries` NICHT einfach ungekappt: daran haengen Zaehlungen, die „Top 5" woertlich
 * meinen (Leaderboard-Footprint „2× Top-5", Achievement „Top-5 der Liga"). Waere `entries` die
 * volle Liste, zaehlten beide jeden Spieler der Liga mit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LEAGUE_LEADER_DEFAULT_LIMIT,
  buildLeagueLeaderBoards,
  type LeagueLeaderSourceRow,
} from "@/lib/foundation/league-leaders-service";

/** 40 Spieler mit absteigenden PPs — genug, um Kappung von Vollstaendigkeit zu unterscheiden. */
function quelle(anzahl = 40): LeagueLeaderSourceRow[] {
  return Array.from({ length: anzahl }, (_, index) => ({
    playerId: `p${index}`,
    name: `Spieler ${String(index).padStart(2, "0")}`,
    teamId: index === 12 ? "MEIN" : `T${index % 8}`,
    teamCode: index === 12 ? "M-N" : `T-${index % 8}`,
    teamName: index === 12 ? "Mein Team" : `Team ${index % 8}`,
    pps: anzahl - index,
    ppPow: anzahl - index,
    ppSpe: anzahl - index,
    ppMen: anzahl - index,
    ppSoc: anzahl - index,
    ovr: 90 - index,
    ovrRank: index + 1,
    mvs: anzahl - index,
  }));
}

const kategorien = () => buildLeagueLeaderBoards({ seasonRows: quelle() });
const pps = () => kategorien().find((category) => category.id === "pps")!;

describe("Ranglisten: die Kachel zeigt 5, aufklappen zeigt alle", () => {
  it("kappt entries weiterhin bei 5", () => {
    expect(pps().entries).toHaveLength(LEAGUE_LEADER_DEFAULT_LIMIT);
  });

  it("liefert daneben die ungekappte Liste", () => {
    expect(pps().fullEntries).toHaveLength(40);
  });

  it("entries IST der Anfang von fullEntries — nicht eine zweite Sortierung", () => {
    // Der Kern der Entscheidung: eine Rechnung, zwei Sichten. Liefen sie auseinander, zeigte
    // die Kachel einen anderen Ersten als die aufgeklappte Liste.
    const kategorie = pps();
    expect(kategorie.entries).toEqual(kategorie.fullEntries.slice(0, LEAGUE_LEADER_DEFAULT_LIMIT));
  });

  it("zaehlt die Raenge durch bis ans Ende", () => {
    const voll = pps().fullEntries;
    expect(voll[0]?.rank).toBe(1);
    expect(voll[voll.length - 1]?.rank).toBe(40);
  });

  it("gilt fuer JEDE Kategorie, nicht nur fuer PPs", () => {
    for (const kategorie of kategorien()) {
      expect(kategorie.fullEntries.length, `${kategorie.id} ohne volle Liste`).toBeGreaterThanOrEqual(
        kategorie.entries.length,
      );
      expect(kategorie.entries, `${kategorie.id} nicht deckungsgleich`).toEqual(
        kategorie.fullEntries.slice(0, kategorie.entries.length),
      );
    }
  });

  /**
   * Der eigentliche Gewinn fuer den Spieler: „Dein Bester" kannte vorher nur die Top 5 und sagte
   * sonst „außerhalb Top 5" — das unterschied Platz 6 nicht von Platz 300.
   */
  it("findet den eigenen Besten auch weit hinten — mit echtem Rang", () => {
    const eigener = pps().fullEntries.find((entry) => entry.teamId === "MEIN");
    expect(eigener).toBeTruthy();
    expect(eigener!.rank).toBe(13); // absichtlich ausserhalb der Top 5
    expect(pps().entries.some((entry) => entry.teamId === "MEIN")).toBe(false);
  });
});

describe("Die Oberflaeche nutzt die volle Liste auch wirklich", () => {
  const ansicht = () => readFileSync(join(process.cwd(), "app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx"), "utf8");

  it("hat einen sichtbaren Knopf in die ganze Rangliste", () => {
    // Vorher war der Drawer nur als Nebenwirkung der Kennzahl-Chips erreichbar.
    expect(ansicht()).toContain('data-testid="leaders-open-full-ranking"');
  });

  it("staffelt im Drawer: erst 50, dann alle", () => {
    const text = ansicht();
    expect(text).toContain("NL_RANKING_DRAWER_STEP = 50");
    expect(text).toContain('data-testid="ranking-drawer-show-all"');
    expect(text).toContain("Alle {rankingDrawerTotal} anzeigen");
  });

  it("springt zum eigenen Besten — und klappt vorher weit genug auf", () => {
    // Ohne das Aufklappen zeigte der Sprung auf eine Zeile, die im DOM noch gar nicht steht.
    const text = ansicht();
    expect(text).toContain('data-testid="ranking-drawer-own-best"');
    expect(text).toContain("Math.max(sichtbar, rankingDrawerOwnBest.rank)");
  });

  /**
   * GEMELDET: „der drawer ist recht klein und nutzt den platz nicht sonderlich gut, und die
   * spieler haben gar keine bilder … da kann auch ne tabelle in der mitte kommen die man dann
   * wieder weg klicken kann."
   *
   * Beides hing zusammen: in einer 420px-Randleiste ist fuer ein Portrait kein Platz. Als breite
   * Tafel in der Mitte passen Bild, Rang, Name, Team und Wert nebeneinander — und 330 Zeilen in
   * drei Spalten statt in eine Endlos-Rolle.
   */
  it("oeffnet die Rangliste als breite Tafel, nicht als schmale Randleiste", () => {
    expect(ansicht()).toContain('layout="modal"');
  });

  it("zeigt Spielerportraits in der Liste", () => {
    const text = ansicht();
    expect(text).toContain("renderLeading={(row) => (");
    expect(text).toContain('className="nl-rankdrawer-avatar"');
    // Der Star-Rahmen haengt am ligaweiten OVR-Rang, nicht am Rang IN dieser Kategorie.
    expect(text).toContain("rankingDrawerOvrRankById");
  });

  it("laesst die anderen Aufrufstellen unveraendert bei der Randleiste", () => {
    // `layout` ist optional mit Standard "drawer" — der Saisonstand und die Spieler-Tabelle
    // nutzen den Drawer neben ihrem Inhalt, dort waere eine Tafel in der Mitte falsch.
    const komponente = readFileSync(
      join(process.cwd(), "components/foundation/new-look/NlRankingDrawer.tsx"),
      "utf8",
    );
    expect(komponente).toContain('layout = "drawer"');
    for (const datei of [
      "app/foundation/season-v2/SeasonStandingsNewLook.tsx",
      "app/foundation/players-table/FoundationPlayersTableNewLook.tsx",
    ]) {
      expect(readFileSync(join(process.cwd(), datei), "utf8"), `${datei} unerwartet umgestellt`).not.toContain(
        'layout="modal"',
      );
    }
  });

  it("sucht den eigenen Besten in der vollen Liste, nicht in den Top 5", () => {
    const text = ansicht();
    expect(text).toContain("category.fullEntries ?? category.entries");
    // Die alte Beschriftung stand fuer die Kappung: sie unterschied Platz 6 nicht von Platz 300.
    // Geprueft wird die JSX-Zeile, nicht das Wort — in den Kommentaren steht die Vorgeschichte.
    expect(text).not.toContain("sub={`außerhalb Top ");
  });
});

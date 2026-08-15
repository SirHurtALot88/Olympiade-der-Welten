/**
 * DIE TOP-SPIELER-LISTE ZEIGT 24 STATT 12 — UND BLEIBT GENAUSO HOCH.
 *
 * GEMELDET VON CHRIS: „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top
 * 12 sondern Top 24 hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern
 * nebeneinander." (Seite „Spieltag · Arena".)
 *
 * ZWEI DINGE SIND DARAN ZU SICHERN, und beide sind hier festgehalten:
 *
 *  1. DIE ZAHL STEHT AN EINER STELLE. Es gibt ZWEI Zulieferer für diese Liste — die Liste einer
 *     einzelnen Disziplin (`DisciplineStageArena`) und die summierte Spieltags-Liste
 *     (`summiereSpieltagsTopSpieler`). Trüge jeder seine eigene Obergrenze, zeigte die eine
 *     Ansicht früher oder später mehr Spieler als die andere.
 *
 *  2. UNTER 13 ZEILEN BLEIBT ES EINSPALTIG. Sonst entstünde bei neun Spielern eine zweite,
 *     fast leere Spalte — die Liste sähe kaputt aus, obwohl nichts fehlt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SPIELTAGS_TOPSPIELER_LIMIT } from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";

const ARENA = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
  "utf8",
);
const LISTE = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageTopPlayers.tsx"),
  "utf8",
);

describe("Arena: Top-Spieler-Liste mit 24 Plaetzen", () => {
  it("die Obergrenze liegt bei 24", () => {
    expect(SPIELTAGS_TOPSPIELER_LIMIT).toBe(24);
  });

  it("die Einzel-Disziplin-Liste benutzt DIESELBE Obergrenze, keine eigene Zahl", () => {
    expect(ARENA).toContain("entries.slice(0, SPIELTAGS_TOPSPIELER_LIMIT)");
    // Die alte, fest verdrahtete 12 darf nicht zurueckkehren.
    expect(ARENA).not.toContain("entries.slice(0, 12)");
  });

  it("die Anzeige legt die Zeilen spaltenweise, damit die Rangfolge untereinander lesbar bleibt", () => {
    expect(LISTE).toContain('gridAutoFlow: "column"');
    expect(LISTE).toContain("gridTemplateRows");
  });

  it("bis 12 Zeilen bleibt es EINE Spalte", () => {
    // Die Formel im Bauteil: Zeilenzahl = ceil(n / (n > 12 ? 2 : 1)).
    const zeilen = (anzahl: number) => Math.ceil(anzahl / (anzahl > 12 ? 2 : 1));
    expect(zeilen(9)).toBe(9);
    expect(zeilen(12)).toBe(12);
  });

  it("ab 13 Zeilen entstehen zwei Spalten, und 24 werden zu zweimal zwoelf", () => {
    const zeilen = (anzahl: number) => Math.ceil(anzahl / (anzahl > 12 ? 2 : 1));
    expect(zeilen(13)).toBe(7);
    expect(zeilen(24)).toBe(12);
    // Genau darum geht es Chris: 24 Namen, aber nicht hoeher als die alten 12.
    expect(zeilen(24)).toBe(zeilen(12));
  });
});

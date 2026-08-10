/**
 * NACH EINEM RELOAD MITTEN IM SPIELTAG MUSS DER WEG WEITER SICHTBAR BLEIBEN.
 *
 * GEMELDET VON CHRIS: „der spieltag abschließen button in der arena ist weg, jetzt kann man wieder
 * den 2. diszi nicht abschließen, bitte wieder hinzufügen."
 *
 * Sein Spielstand: Spieltag 4, Staffel gewertet, Takeshi offen (`completion: "partial"`).
 *
 * URSACHE: `disciplineEnded` in `DisciplineStageArena.tsx` kannte nur SITZUNGSZUSTAND —
 * `arenaEnded` und `endedDisciplineIds` starten nach jedem Neuladen leer. Der Block, der von einer
 * abgeschlossenen Disziplin weiterführt, hängt daran; und in genau diesem Block stecken BEIDE
 * Auswege: „Weiter zu Disziplin 2 →" und „Spieltag abschließen". Wer den Spieltag verließ und
 * zurückkam, sah die Bühne auf der gewerteten Staffel stehen — ohne jeden Hinweis, wie es
 * weitergeht. Der Spieltag hing.
 *
 * NICHT die Ursache, obwohl es zuerst danach aussah: dass „Spieltag abschließen" bei halbem
 * Spieltag fehlt, ist ABSICHT (`advanceBlockedByMissingD2` in `game-flow-controller.ts`, eingeführt
 * mit „Ein halber Spieltag ist ein eigener Zustand"). Sonst ließe sich Disziplin 2 überspringen,
 * und jeder dort aufgestellte Spieler fehlte dauerhaft in der Wertung. Dieser Schutz bleibt — was
 * fehlte, war der Weg ZUR zweiten Disziplin.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const ARENA = await fs.readFile(
  path.join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
  "utf8",
);

describe("Arena nach Reload mitten im Spieltag", () => {
  it("leitet `disciplineEnded` auch aus dem SPIELSTAND ab, nicht nur aus der Sitzung", () => {
    // Die Zeile, die ohne den Fix fehlte. `activeSideScoredInSave` kommt aus `scoringProgress`
    // und überlebt damit den Reload — anders als `arenaEnded`/`endedDisciplineIds`.
    expect(ARENA).toContain("activeSideScoredInSave && replayingDisciplineId !== disciplineId");
  });

  it("hält die beiden Sitzungsquellen als erste Wahl — der Spielstand kommt nur dazu", () => {
    // Kein Ersatz, sondern eine dritte Quelle: wer gerade spielt, soll den Endscreen sofort sehen,
    // ohne auf die Buchung zu warten.
    expect(ARENA).toMatch(/const disciplineEnded =\s*\n\s*arenaEnded \|\|/);
    expect(ARENA).toContain("endedDisciplineIds.has(disciplineId) && replayingDisciplineId !== disciplineId");
  });

  it("berechnet die Save-Quelle VOR `disciplineEnded` — sonst läse sie eine tote Bindung", () => {
    const posQuelle = ARENA.indexOf("const activeSideScoredInSave =");
    const posEnded = ARENA.indexOf("const disciplineEnded =");
    expect(posQuelle).toBeGreaterThan(-1);
    expect(posEnded).toBeGreaterThan(-1);
    expect(posQuelle).toBeLessThan(posEnded);
  });

  it("ein Replay derselben Disziplin zaehlt weiterhin NICHT als abgeschlossen", () => {
    // Sonst käme der Endscreen sofort zurück, während der Spieler den Durchlauf noch einmal ansieht.
    const zeile = ARENA.slice(ARENA.indexOf("const disciplineEnded ="), ARENA.indexOf("const disciplineEnded =") + 320);
    expect(zeile).toContain("replayingDisciplineId !== disciplineId");
  });

  it("der Schutz gegen uebersprungene Disziplin 2 bleibt unangetastet", async () => {
    // Der Spieltagswechsel MUSS bei halbem Spieltag gesperrt bleiben — das ist kein Fehler,
    // sondern verhindert, dass Disziplin 2 verlorengeht.
    const controller = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/game-flow-controller.ts"),
      "utf8",
    );
    expect(controller).toContain("const advanceBlockedByMissingD2 = hasResults && !hasFullMatchdayResult;");
  });
});

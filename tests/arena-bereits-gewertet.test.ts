import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * DIE ARENA LUD EIN, ETWAS ZU STARTEN, DAS SCHON GELAUFEN IST — Befund B2 aus
 * `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „mach mit b2 weiter."
 *
 * GEMESSEN am echten Spielstand (Season 1, Spieltag 10, beide Disziplinen gewertet):
 * die Arena meldete `data-active-side-scored="true"` — sie WUSSTE es also — und der Hauptknopf
 * stand trotzdem auf „▶ Start · Etappe 1 / 4", aktiv.
 *
 * WAS DIESER BEFUND NICHT IST: ein Datenrisiko. Im Audit stand das zunaechst so, und das war
 * falsch. `commitFinishedDiscipline` bucht eine bereits gewertete Seite nicht erneut
 * (`DisciplineStageArena.tsx`), und nachgemessen ist die Spielstand-Datei nach einem vollen
 * Quick-Sim **md5-identisch**. Der Schaden ist trotzdem echt: der Spieler laesst etwas laufen,
 * das folgenlos bleibt, und muss selbst darauf kommen, warum sich nichts geaendert hat.
 *
 * WARUM DIE BUEHNE NICHT EINFACH AUF „FERTIG" GESETZT WIRD: dann stuende „gewertet" ueber einem
 * Rundenstand aus lauter Nullen — es ist ja nichts gelaufen. Eine falsche Zahl ist schlimmer als
 * eine fehlende. Der Knopf sagt stattdessen, was er wirklich tut.
 */

const root = process.cwd();
const arena = readFileSync(
  join(root, "app/foundation/discipline-stage/arena/DisciplineStageNativeArena.tsx"),
  "utf8",
);
const host = readFileSync(join(root, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");

/** Kommentare raus: die Begruendungen nennen die alten Texte naturgemaess. */
const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

describe("Arena: eine gewertete Disziplin lädt nicht zum Start ein", () => {
  it("der Host reicht seinen Wissensstand an die Bühne durch", () => {
    /*
     * Der Kern des Befundes: die Information lag vor (`activeSideScoredInSave`) und wurde
     * nicht weitergegeben. Genau die Fehlerklasse aus A1, A2 und A3.
     */
    expect(ohneKommentare(host)).toContain("alreadyScored={activeSideScoredInSave}");
  });

  it("der Knopf heißt „Nachspielen“, wenn schon gewertet ist", () => {
    const quelle = ohneKommentare(arena);
    expect(quelle).toContain("▶ Nachspielen · Etappe 1 /");
    // Und „Start" bleibt fuer den Fall, in dem wirklich noch nichts gelaufen ist.
    expect(quelle).toContain("▶ Start · Etappe 1 /");
  });

  it("ein Hinweis nennt den Grund, statt ihn den Spieler raten zu lassen", () => {
    expect(arena).toContain("Bereits gewertet — ein Durchlauf ändert die Wertung nicht.");
    expect(arena).toContain('data-testid="arena-already-scored-hint"');
  });

  it("der Hinweis verschwindet, sobald der Durchlauf fertig ist", () => {
    // `alreadyScored && !done` — sonst stuende er neben „✔ Disziplin gewertet" und waere
    // doppelt gemoppelt.
    expect(arena).toContain("{alreadyScored && !done ? (");
  });

  it("Nachspielen bleibt möglich — der Riegel liegt beim Buchen, nicht beim Abspielen", () => {
    /*
     * Das ist die Zeile, die aus dem Datenrisiko eine reine Anzeigefrage macht. Faellt sie weg,
     * wird aus B2 ein echter Fehler — deshalb steht sie hier fest.
     */
    expect(host).toContain("if (scoringProgress && scoringProgress[side].scored) return;");
    // Die Buehne selbst sperrt nichts: Quick-Sim und „↻ Neu" bleiben bedienbar.
    expect(arena).not.toContain("disabled={alreadyScored");
  });
});

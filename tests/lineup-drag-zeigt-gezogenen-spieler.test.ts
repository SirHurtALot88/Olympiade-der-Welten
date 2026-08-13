import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * GEMELDET VON CHRIS: „wenn ich einen spieler in der einsatzliste per drag and drop irgendwo rein
 * ziehen will, müsste während des drags seine stats pro slot kommen, aktuell wird immernoch nur der
 * beste spieler angezeigt."
 *
 * BEFUND: die Slot-Karten zeigten unverändert ihren „Best Fit" — den Vorschlag der Liste, nicht den
 * Spieler in der Hand. Wer jemanden über das Feld zog, las überall die Zahlen eines ANDEREN.
 *
 * Die Zahlen lagen bereits vor: `buildPlayerBestSlotSummaryByActivePlayerId` rechnet jeden Spieler
 * gegen JEDEN Slot und trägt die volle Rangliste, nicht nur die Spitze. Diese Datei hält fest, dass
 * die Ansicht sie während des Drags auch benutzt — und dass am Modell die Voraussetzung dafür
 * bestehen bleibt (volle Liste, mit Delta).
 */

const root = process.cwd();

async function lies(relativerPfad: string) {
  return fs.readFile(path.join(root, relativerPfad), "utf8");
}

describe("Einsatzliste · während des Drags zählt der gezogene Spieler", () => {
  it("leitet den gezogenen Spieler aus BEIDEN Griffen ab", async () => {
    // Aus dem Kader (`dragCandidateId`) und aus einem belegten Slot heraus — der Umzug innerhalb
    // des Feldes ist genau die Frage „wo steht er besser" und darf nicht ausgenommen sein.
    const view = await lies("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
    expect(view).toMatch(/const dragPlayerId = dragCandidateId \?\?\s*\(dragSourceSlotKey \? selections\[dragSourceSlotKey\]/);
  });

  it("schlägt die Slot-Werte des gezogenen Spielers nach, statt neu zu rechnen", async () => {
    const view = await lies("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
    expect(view).toContain("playerBestSlotSummaryByActivePlayerId.get(dragPlayerId)");
    expect(view).toContain("dragSlotFitByKey.get(slot.key)");
  });

  it("verdrängt den Best-Fit-Vorschlag, solange gezogen wird", async () => {
    // Die Reihenfolge im Ternär ist die Aussage: `dragPlayerId` zuerst, der Vorschlag nur, wenn
    // NICHT gezogen wird. Stünde der Vorschlag vorn, bliebe genau der gemeldete Fehler stehen.
    const view = await lies("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
    const dragIndex = view.indexOf("{dragPlayerId ? (");
    const bestFitIndex = view.indexOf("<small>Best Fit</small>");
    expect(dragIndex).toBeGreaterThan(-1);
    expect(bestFitIndex).toBeGreaterThan(dragIndex);
    expect(view).toMatch(/\) : !player && topCandidate \? \(/);
  });

  it("zeigt die Zeile auch auf belegten Slots, dort mit Delta", async () => {
    // Auf einem besetzten Slot ist die Frage „lohnt der Tausch?" — ohne Delta waere sie
    // unbeantwortet, und die Zeile stuende dort ohne Grund.
    const view = await lies("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
    expect(view).toMatch(/const dragDelta = player \? dragFit\?\.projectedDelta \?\? null : null/);
  });

  it("sagt es ausdruecklich, wenn der Spieler fuer die Disziplin keinen Wert hat", async () => {
    const view = await lies("app/foundation/legacy-lineup-lab/LineupNewLook.tsx");
    expect(view).toContain("hat für diese Disziplin keinen Wert.");
  });

  it("laesst den Slot unter der Zeile weiter annehmen", async () => {
    // `pointer-events: none`: die Zeile ist kein Knopf. Ohne sie schluckte sie das dragover des
    // Slots darunter — die Ablage haette ausgerechnet an ihrem eigenen Hinweis nicht mehr
    // funktioniert.
    const css = await lies("app/globals.css");
    expect(css).toMatch(/\.nl-lineup-dragfit \{[\s\S]{0,120}pointer-events: none;/);
  });

  it("haelt am Modell die volle Slot-Liste mit Delta", async () => {
    // Die Voraussetzung fuer die Nachschlage-Loesung: kein `.slice(...)` auf die Spitze, und ein
    // `projectedDelta` je Slot. Faellt eines davon weg, zeigt die Drag-Zeile Luecken.
    const model = await lies("lib/lineups/lineup-candidate-model.ts");
    const start = model.indexOf("export function buildPlayerBestSlotSummaryByActivePlayerId");
    const ende = model.indexOf("export function buildActiveSlotCandidateByActivePlayerId");
    expect(start).toBeGreaterThan(-1);
    const abschnitt = model.slice(start, ende);
    expect(abschnitt).toContain("projectedDelta");
    expect(abschnitt).not.toMatch(/\.slice\(0,\s*\d+\)/);
  });
});

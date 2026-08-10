/**
 * GEMELDET VON CHRIS (mit Bild, Saison 2, Spieltag 5): die Einsatzliste laedt „einfach
 * minutenlang". Zu sehen waren vier graue Balken und sonst nichts.
 *
 * Es war KEIN langsames Laden. Gemessen am gemeldeten Spielstand: den Save zu laden kostet 2,4 s,
 * den Spieltags-Kontext zu bauen 113 ms — zusammen unter drei Sekunden, nicht Minuten.
 *
 * Die Route `/api/lineups/legacy/lab-context` antwortet mit HTTP 200 und `context: null`, wenn der
 * Kontext nicht gebaut werden kann; die Gruende stehen in `contextErrors`. Die Ansicht fragte aber
 * nur `!context` ab und zeigte dann ihr Ladeskelett — dessen Hinweis „Spieltags-Kontext wird
 * geladen…" ist `sr-only`, also unsichtbar. Ergebnis: eine fertige Antwort sah aus wie ein
 * endloser Ladevorgang, und der Grund stand nirgends.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const view = readFileSync(join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"), "utf8");
const client = readFileSync(
  join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
  "utf8",
);
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Der Block, der greift, wenn kein Kontext da ist. */
function kontextloserBlock() {
  const start = view.indexOf("  if (!context) {");
  expect(start, "Block `if (!context)` nicht gefunden").toBeGreaterThanOrEqual(0);
  return view.slice(start, view.indexOf("\n  const disciplineBySide", start));
}

describe("Einsatzliste: kein ewiges Ladeskelett", () => {
  it("zeigt das Skelett nur, solange wirklich geladen wird", () => {
    // Ohne diese Unterscheidung ist eine fertige Antwort ohne Kontext von „laedt noch" nicht
    // zu trennen — genau das sah Chris.
    expect(kontextloserBlock()).toContain("if (isBusy) {");
  });

  it("nennt den Grund, wenn das Laden durch ist und trotzdem kein Kontext da ist", () => {
    const block = kontextloserBlock();
    expect(block).toContain("lineup-context-unavailable");
    expect(block).toContain("errors.map(");
    // Und sagt auch dann etwas, wenn die Route gar keinen Grund mitgeliefert hat.
    expect(block).toContain("kein Spieltags-Kontext");
  });

  it("meldet den Zustand als Fehler, nicht als stille Notiz", () => {
    expect(kontextloserBlock()).toContain('role="alert"');
  });

  it("sortiert die Kontext-Fehler der Route in die Fehler, nicht in die Warnungen", () => {
    // Vorher landeten sie zwischen Nebensaechlichkeiten wie „Spieler ist angeschlagen".
    expect(client).toContain("setWarnings(payload.contextWarnings);");
    expect(client).toContain("if (payload.contextErrors.length > 0) {");
    expect(client).not.toContain("setWarnings([...payload.contextWarnings, ...payload.contextErrors]);");
  });

  it("hat eine Regel, die den Hinweis sichtbar macht", () => {
    expect(css).toContain(".is-new-look .nl-lineup-empty");
    expect(css).toContain(".is-new-look .nl-lineup-empty__reasons");
  });
});

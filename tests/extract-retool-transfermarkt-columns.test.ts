/**
 * DIESER TEST BRAUCHT EINE DATEI, DIE NICHT IM REPO LIEGT.
 *
 * `SOURCE_PATH` zeigt auf einen Download-Ordner eines bestimmten Rechners. Auf jedem anderen
 * — CI, ein frischer Checkout, ein zweiter Arbeitsplatz — schlaegt schon `fs.readFile` mit
 * ENOENT fehl. Der Test war damit dauerhaft rot, ohne je etwas ueber den Code auszusagen.
 *
 * Dauerhaft rot ist die schlechteste aller Zustaende: Er kostet bei jedem Volllauf Aufmerksamkeit
 * und stumpft gegen echte Fehlschlaege ab. Deshalb laeuft er jetzt nur noch, WENN die Quelldatei
 * wirklich da ist, und meldet sonst sichtbar „uebersprungen" statt „kaputt".
 *
 * Geloescht wird er bewusst NICHT: Auf dem Rechner, auf dem die Retool-Ausleitung liegt, ist er
 * weiterhin die einzige Absicherung des Extraktionsskripts. Wer ihn dauerhaft laufen lassen will,
 * muesste die Quelldatei (oder einen zugeschnittenen Auszug daraus) ins Repo legen und
 * `SOURCE_PATH` darauf zeigen lassen.
 */
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTransfermarktFormattingExtraction,
  extractTransfermarktTablesFromSerialized,
  writeTransfermarktColumnExtraction,
} from "@/scripts/extract-retool-transfermarkt-columns";

const SOURCE_PATH = "/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (7).json";
const QUELLE_VORHANDEN = existsSync(SOURCE_PATH);

describe.skipIf(!QUELLE_VORHANDEN)("extract retool transfermarkt columns", () => {
  it("finds transfermarkt table components in the Retool JSON", async () => {
    const rawJson = await fs.readFile(SOURCE_PATH, "utf8");
    const parsed = JSON.parse(rawJson) as {
      page?: {
        data?: {
          appState?: string;
        };
      };
    };
    const appState = parsed.page?.data?.appState;

    expect(typeof appState).toBe("string");

    const tables = extractTransfermarktTablesFromSerialized(appState!);

    expect(tables.length).toBeGreaterThan(0);
    expect(tables.map((table) => table.componentName)).toContain("playersTable");
  });

  it("can write manifest and raw column output", async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "retool-transfermarkt-columns-"));
    const result = writeTransfermarktColumnExtraction({
      sourcePath: SOURCE_PATH,
      outputDir,
    });

    expect(result.tables.length).toBeGreaterThan(0);
    expect(await fs.readFile(path.join(outputDir, "manifest.json"), "utf8")).toContain('"tablesFound"');
    expect(await fs.readFile(path.join(outputDir, "transfermarkt-columns.raw.json"), "utf8")).toContain('"columns"');
    expect(await fs.readFile(path.join(outputDir, "transfermarkt-formatting.raw.json"), "utf8")).toContain('"foundColorCodes"');
  });

  it("extracts color codes and formatting expressions from transfermarkt tables", async () => {
    const rawJson = await fs.readFile(SOURCE_PATH, "utf8");
    const parsed = JSON.parse(rawJson) as {
      page?: {
        data?: {
          appState?: string;
        };
      };
    };

    const tables = extractTransfermarktTablesFromSerialized(parsed.page?.data?.appState ?? "");
    const formatting = buildTransfermarktFormattingExtraction(tables);
    const playersTable = formatting.tables.find((table) => table.componentName === "playersTable");
    const powColumn = playersTable?.columns.find((column) => column.dataKey === "pow");

    expect(formatting.foundColorCodes).toContain("#1565C0");
    expect(formatting.foundColorCodes).toContain("#EF5350");
    expect(formatting.foundConditionalFormattingRules).toBeGreaterThan(0);
    expect(powColumn?.expressionRefs).toContain("item");
    expect(powColumn?.conditionalFormatting.length).toBeGreaterThan(0);
  });
});

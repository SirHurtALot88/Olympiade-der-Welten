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

/**
 * DIESER TEST BRAUCHT EINE DATEI, DIE ES NUR AUF EINEM RECHNER GIBT.
 *
 * `SOURCE_PATH` zeigt in den Downloads-Ordner eines bestimmten Macs, auf einen Retool-Export mit
 * „(7)" im Namen — ein Zwischenstand aus einer einmaligen Datenuebernahme. Ueberall sonst schlug er
 * mit `ENOENT` fehl: in der CI, in jedem frischen Checkout, auf jedem anderen Geraet. Drei
 * Fehlschlaege, die nie etwas ueber das Spiel ausgesagt haben.
 *
 * Geloescht wird er trotzdem nicht — liegt die Datei da, prueft er echtes Verhalten des
 * Extraktions-Skripts. Er sagt jetzt nur ehrlich, dass er ohne sie nichts pruefen kann, statt rot zu
 * leuchten. Wer die Uebernahme erneut fahren will, legt die Datei hin und der Test lebt wieder.
 */
const sourceAvailable = existsSync(SOURCE_PATH);

describe.skipIf(!sourceAvailable)("extract retool transfermarkt columns", () => {
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

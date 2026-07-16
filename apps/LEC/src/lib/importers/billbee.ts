import ExcelJS from "exceljs";
import { parseGermanNumber } from "../parsing/number";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";
import { isCardArticleName } from "../parsing/cardFilter";
import { classifyWindow, parseBillbeeZeitraum, type SaleWindowKey } from "../parsing/date";

/**
 * Billbee "Verkaeufe nach Artikel" (.xlsx) — Aufbau nach KONZEPT.md Abschnitt 12.1:
 * Vorspann Zeilen 0-6 (0-indexiert), Header in Zeile 7, Daten ab Zeile 8.
 * In exceljs (1-indexiert) entspricht das: Header = Zeile 8, Daten ab Zeile 9.
 */
const HEADER_ROW_NUMBER = 8;
const FIRST_DATA_ROW_NUMBER = 9;

const COL = {
  sku: 1,
  artikel: 2,
  ustIndex: 5,
  anzahl: 7,
  summe: 8,
  ek: 9,
  marge: 11,
} as const;

export interface BillbeeRow {
  sku: string | null;
  nameRaw: string;
  nameNormalized: string;
  packQty: number;
  setCode: string | null;
  isCard: boolean;
  qty: number;
  revenue: number;
  ek: number;
  marge: number;
}

export interface BillbeeImportResult {
  window: SaleWindowKey;
  windowFrom: Date;
  windowTo: Date;
  rows: BillbeeRow[];
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in (value as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).richText.map((t: { text: string }) => t.text).join("");
  }
  return String(value);
}

export async function parseBillbeeWorkbook(buffer: Buffer): Promise<BillbeeImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Billbee-Datei enthaelt kein Arbeitsblatt");
  }

  const zeitraumRaw = cellText(sheet.getRow(5).getCell(3));
  const { from, to } = parseBillbeeZeitraum(zeitraumRaw);
  const window = classifyWindow(from, to);

  const headerLabel = cellText(sheet.getRow(HEADER_ROW_NUMBER).getCell(COL.artikel));
  if (!headerLabel.toLowerCase().includes("artikel")) {
    throw new Error(
      `Unerwartetes Billbee-Format: Header-Zeile ${HEADER_ROW_NUMBER} hat kein "Artikel"-Feld (gefunden: "${headerLabel}")`
    );
  }

  const rows: BillbeeRow[] = [];
  const lastRow = sheet.rowCount;
  for (let r = FIRST_DATA_ROW_NUMBER; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const nameRaw = cellText(row.getCell(COL.artikel)).trim();
    if (!nameRaw) continue;

    const skuRaw = cellText(row.getCell(COL.sku)).trim();
    const { normalized, packQty } = normalizeArticleName(nameRaw);
    const setCode = extractSetCode(nameRaw);

    rows.push({
      sku: skuRaw.length > 0 ? skuRaw : null,
      nameRaw,
      nameNormalized: normalized,
      packQty,
      setCode,
      isCard: isCardArticleName(nameRaw),
      qty: parseGermanNumber(row.getCell(COL.anzahl).value as string | number | null),
      revenue: parseGermanNumber(cellText(row.getCell(COL.summe))),
      ek: parseGermanNumber(cellText(row.getCell(COL.ek))),
      marge: parseGermanNumber(cellText(row.getCell(COL.marge))),
    });
  }

  return { window, windowFrom: from, windowTo: to, rows };
}

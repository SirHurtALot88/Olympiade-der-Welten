import ExcelJS from "exceljs";
import { parseGermanNumber } from "../parsing/number";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";
import { isCardArticleName } from "../parsing/cardFilter";

/**
 * Billbee-Artikelstamm-Export (.xlsx) — anders als die "Verkaeufe nach Artikel"-
 * Fenster-Exporte (billbee.ts) liefert dieser Export den KOMPLETTEN aktiven
 * Artikelkatalog inkl. Lagerbestand (Chris' Ergaenzung: die reine
 * Verkaufshistorie enthaelt auch laengst ausgelaufene Artikel; erst dieser
 * Export sagt, was aktuell wirklich im Sortiment ist + wieviel auf Lager liegt).
 *
 * Format ist NICHT so starr wie bei den Fenster-Exporten (kein fester
 * Vorspann/Header-Zeilenindex) -- daher wird die Header-Zeile flexibel
 * gesucht: die erste Zeile, die sowohl "Titel" als auch
 * "Stock current Standard" als Zellenwert enthaelt.
 */

const REQUIRED_HEADERS = ["titel", "stock current standard"];
const MAX_HEADER_SCAN_ROWS = 15;

export interface BillbeeArtikelRow {
  nameRaw: string;
  nameNormalized: string;
  packQty: number;
  setCode: string | null;
  isCard: boolean;
  stock: number;
  currentVk: number | null;
  currentEk: number | null;
  statusRaw: string | null;
}

export interface BillbeeArtikelImportResult {
  rows: BillbeeArtikelRow[];
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

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let r = 1; r <= Math.min(MAX_HEADER_SCAN_ROWS, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const cellTexts: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      cellTexts.push(cellText(row.getCell(c)).trim().toLowerCase());
    }
    const hasAll = REQUIRED_HEADERS.every((h) => cellTexts.includes(h));
    if (hasAll) return r;
  }
  throw new Error(
    `Billbee-Artikelstamm: Header-Zeile mit "Titel" + "Stock current Standard" nicht in den ersten ${MAX_HEADER_SCAN_ROWS} Zeilen gefunden.`
  );
}

function findColumn(headerRow: ExcelJS.Row, columnCount: number, headerName: string): number | null {
  const target = headerName.trim().toLowerCase();
  for (let c = 1; c <= columnCount; c++) {
    if (cellText(headerRow.getCell(c)).trim().toLowerCase() === target) return c;
  }
  return null;
}

export async function parseBillbeeArtikelWorkbook(buffer: Buffer): Promise<BillbeeArtikelImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Billbee-Artikelstamm-Datei enthaelt kein Arbeitsblatt");
  }

  const headerRowNumber = findHeaderRow(sheet);
  const headerRow = sheet.getRow(headerRowNumber);

  const col = {
    titel: findColumn(headerRow, sheet.columnCount, "Titel"),
    stock: findColumn(headerRow, sheet.columnCount, "Stock current Standard"),
    priceGross: findColumn(headerRow, sheet.columnCount, "Price gross"),
    costPriceGross: findColumn(headerRow, sheet.columnCount, "CostPrice gross"),
    status: findColumn(headerRow, sheet.columnCount, "Status"),
  };
  if (!col.titel || !col.stock) {
    throw new Error("Billbee-Artikelstamm: Pflichtspalten Titel/Stock current Standard nicht gefunden.");
  }

  const rows: BillbeeArtikelRow[] = [];
  const lastRow = sheet.rowCount;
  for (let r = headerRowNumber + 1; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const nameRaw = cellText(row.getCell(col.titel)).trim();
    if (!nameRaw) continue;

    const { normalized, packQty } = normalizeArticleName(nameRaw);
    const setCode = extractSetCode(nameRaw);

    const priceCell = col.priceGross ? row.getCell(col.priceGross).value : null;
    const costCell = col.costPriceGross ? row.getCell(col.costPriceGross).value : null;
    const statusCell = col.status ? cellText(row.getCell(col.status)).trim() : "";

    rows.push({
      nameRaw,
      nameNormalized: normalized,
      packQty,
      setCode,
      isCard: isCardArticleName(nameRaw),
      stock: Math.round(parseGermanNumber(row.getCell(col.stock).value as string | number | null)),
      currentVk: priceCell === null || priceCell === undefined ? null : parseGermanNumber(priceCell as string | number),
      currentEk: costCell === null || costCell === undefined ? null : parseGermanNumber(costCell as string | number),
      statusRaw: statusCell.length > 0 ? statusCell : null,
    });
  }

  return { rows };
}

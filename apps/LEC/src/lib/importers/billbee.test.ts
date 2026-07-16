import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseBillbeeWorkbook } from "./billbee";

/**
 * Baut eine winzige synthetische Billbee-"Verkaeufe nach Artikel"-Datei mit
 * derselben Blattstruktur wie die echten Exporte (Vorspann Zeile 1-7, Header
 * Zeile 8, Daten ab Zeile 9 — 1-indexiert in exceljs). Nutzt frei erfundene
 * Zahlen, keine echten Geschaeftsdaten.
 */
async function buildSyntheticBillbeeBuffer(zeitraum: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet");

  sheet.getRow(2).getCell(2).value = "Verkaeufe nach Artikel";
  sheet.getRow(4).getCell(1).value = "Gedruckt am:";
  sheet.getRow(4).getCell(3).value = 15072026;
  sheet.getRow(5).getCell(1).value = "Zeitraum:";
  sheet.getRow(5).getCell(3).value = zeitraum;
  sheet.getRow(6).getCell(1).value = "Preise:";
  sheet.getRow(6).getCell(3).value = "Brutto";

  const header = sheet.getRow(8);
  header.getCell(1).value = "SKU";
  header.getCell(2).value = "Artikel";
  header.getCell(5).value = "USt. Index";
  header.getCell(7).value = "Anzahl";
  header.getCell(8).value = "Summe";
  header.getCell(9).value = "EK";
  header.getCell(11).value = "Marge";

  const dataRows: Array<[string, number, string, string, string]> = [
    ["Yu-Gi-Oh! TEST-DE001 Test Testkarte Ultra Rare NM 1st", 3, "9,99 €", "2,50 €", "7,49 €"],
    ["3x Yu-Gi-Oh! TEST-DE002 Zweite Testkarte Ultra Rare NM 1st", 2, "5,00 €", "1,00 €", "4,00 €"],
    ["Schmuck Konvolut Testring 925 Silber", 1, "12,00 €", "0,00 €", "12,00 €"],
    ["50 Testkarten Sammlung YuGiOh! Holos", 1, "20,00 €", "5,00 €", "15,00 €"],
  ];

  dataRows.forEach((data, i) => {
    const row = sheet.getRow(9 + i);
    row.getCell(2).value = data[0];
    row.getCell(7).value = data[1];
    row.getCell(8).value = data[2];
    row.getCell(9).value = data[3];
    row.getCell(11).value = data[4];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("parseBillbeeWorkbook", () => {
  it("liest Zeitraum, Fenster und Datenzeilen aus einer 30-Tage-Datei", async () => {
    const buffer = await buildSyntheticBillbeeBuffer("15.06.2026 - 15.07.2026");
    const result = await parseBillbeeWorkbook(buffer);

    expect(result.window).toBe("30");
    expect(result.windowFrom.getUTCDate()).toBe(15);
    expect(result.windowFrom.getUTCMonth()).toBe(5);
    expect(result.windowTo.getUTCMonth()).toBe(6);
    expect(result.rows).toHaveLength(4);
  });

  it("klassifiziert das Fenster unabhaengig vom Dateinamen, nur aus dem Zeitraum-Feld", async () => {
    const buffer = await buildSyntheticBillbeeBuffer("16.01.2021 - 15.07.2026");
    const result = await parseBillbeeWorkbook(buffer);
    expect(result.window).toBe("all");
  });

  it("parst Name, Pack-Menge, Set-Code und Zahlenwerte korrekt", async () => {
    const buffer = await buildSyntheticBillbeeBuffer("15.06.2026 - 15.07.2026");
    const { rows } = await parseBillbeeWorkbook(buffer);

    const single = rows[0];
    expect(single.setCode).toBe("TEST-DE001");
    expect(single.packQty).toBe(1);
    expect(single.qty).toBe(3);
    expect(single.revenue).toBeCloseTo(9.99);
    expect(single.ek).toBeCloseTo(2.5);
    expect(single.marge).toBeCloseTo(7.49);
    expect(single.isCard).toBe(true);

    const pack = rows[1];
    expect(pack.packQty).toBe(3);
    expect(pack.setCode).toBe("TEST-DE002");
    expect(pack.nameNormalized).not.toMatch(/^3x/);
  });

  it("markiert Privatverkaeufe ohne Set-Code/Yu-Gi-Oh-Marker als Nicht-Karte", async () => {
    const buffer = await buildSyntheticBillbeeBuffer("15.06.2026 - 15.07.2026");
    const { rows } = await parseBillbeeWorkbook(buffer);
    const jewelry = rows.find((r) => r.nameRaw.startsWith("Schmuck"));
    expect(jewelry?.isCard).toBe(false);
  });

  it("erkennt Bundles ohne Set-Code ueber den Yu-Gi-Oh-Marker als Karte", async () => {
    const buffer = await buildSyntheticBillbeeBuffer("15.06.2026 - 15.07.2026");
    const { rows } = await parseBillbeeWorkbook(buffer);
    const bundle = rows.find((r) => r.nameRaw.includes("Testkarten Sammlung"));
    expect(bundle?.isCard).toBe(true);
    expect(bundle?.setCode).toBeNull();
  });
});

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseBillbeeArtikelWorkbook } from "./billbeeArtikel";

/**
 * Baut eine winzige synthetische Billbee-Artikelstamm-Datei. Anders als die
 * Verkaufs-Fenster-Exporte hat dieser Export KEINEN festen Vorspann -- die
 * Header-Zeile wird flexibel gesucht (hier bewusst in Zeile 3 platziert, um
 * genau das zu testen). Frei erfundene Zahlen, keine echten Geschaeftsdaten.
 */
async function buildSyntheticArtikelBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Artikel");

  sheet.getRow(1).getCell(1).value = "Exportiert am 15.07.2026";
  sheet.getRow(2).getCell(1).value = "";

  const header = sheet.getRow(3);
  header.getCell(1).value = "Art. Nr. 1";
  header.getCell(4).value = "Titel";
  header.getCell(10).value = "Price gross";
  header.getCell(11).value = "CostPrice gross";
  header.getCell(39).value = "Stock current Standard";
  header.getCell(79).value = "Status";

  const rows: Array<{ titel: string; price: number | null; cost: number | null; stock: number; status: string | null }> = [
    { titel: "Yu-Gi-Oh! TEST-DE001 Test Testkarte Ultra Rare NM 1st", price: 4.99, cost: 1.5, stock: 8, status: "Aktiviert" },
    { titel: "3x Yu-Gi-Oh! TEST-DE002 Zweite Testkarte Ultra Rare NM 1st", price: 9.99, cost: 3, stock: 3, status: "Aktiviert" },
    { titel: "Schmuck Konvolut Testring 925 Silber", price: 12, cost: null, stock: 1, status: null },
  ];

  rows.forEach((data, i) => {
    const row = sheet.getRow(4 + i);
    row.getCell(4).value = data.titel;
    row.getCell(10).value = data.price;
    row.getCell(11).value = data.cost;
    row.getCell(39).value = data.stock;
    row.getCell(79).value = data.status;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("parseBillbeeArtikelWorkbook", () => {
  it("findet die Header-Zeile flexibel (nicht in Zeile 1)", async () => {
    const buffer = await buildSyntheticArtikelBuffer();
    const { rows } = await parseBillbeeArtikelWorkbook(buffer);
    expect(rows).toHaveLength(3);
  });

  it("parst Titel, Pack-Menge, Set-Code, Bestand und aktuellen VK/EK", async () => {
    const buffer = await buildSyntheticArtikelBuffer();
    const { rows } = await parseBillbeeArtikelWorkbook(buffer);

    const single = rows[0];
    expect(single.setCode).toBe("TEST-DE001");
    expect(single.packQty).toBe(1);
    expect(single.stock).toBe(8);
    expect(single.currentVk).toBeCloseTo(4.99);
    expect(single.currentEk).toBeCloseTo(1.5);
    expect(single.isCard).toBe(true);

    const pack = rows[1];
    expect(pack.packQty).toBe(3);
    expect(pack.setCode).toBe("TEST-DE002");
    expect(pack.nameNormalized).not.toMatch(/^3x/);
  });

  it("laesst currentEk null, wenn die Zelle leer ist (statt 0 zu erfinden)", async () => {
    const buffer = await buildSyntheticArtikelBuffer();
    const { rows } = await parseBillbeeArtikelWorkbook(buffer);
    const jewelry = rows.find((r) => r.nameRaw.startsWith("Schmuck"));
    expect(jewelry?.currentEk).toBeNull();
    expect(jewelry?.isCard).toBe(false);
  });

  it("wirft eine verstaendliche Fehlermeldung, wenn keine passende Header-Zeile gefunden wird", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leer");
    sheet.getRow(1).getCell(1).value = "Irgendwas";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseBillbeeArtikelWorkbook(buffer)).rejects.toThrow(/Header-Zeile/);
  });
});

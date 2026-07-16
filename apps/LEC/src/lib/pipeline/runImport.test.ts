import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./testDb";
import { runImport, type UploadedFile } from "./runImport";

/** Baut eine synthetische Billbee-.xlsx (Struktur wie die echten Exporte). */
async function buildBillbee(
  zeitraum: string,
  rows: Array<{ name: string; qty: number; summe: string; ek: string; marge: string }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet");
  sheet.getRow(2).getCell(2).value = "Verkaeufe nach Artikel";
  sheet.getRow(5).getCell(1).value = "Zeitraum:";
  sheet.getRow(5).getCell(3).value = zeitraum;
  sheet.getRow(6).getCell(1).value = "Preise:";
  sheet.getRow(6).getCell(3).value = "Brutto";
  const header = sheet.getRow(8);
  header.getCell(1).value = "SKU";
  header.getCell(2).value = "Artikel";
  header.getCell(7).value = "Anzahl";
  header.getCell(8).value = "Summe";
  header.getCell(9).value = "EK";
  header.getCell(11).value = "Marge";
  rows.forEach((r, i) => {
    const row = sheet.getRow(9 + i);
    row.getCell(2).value = r.name;
    row.getCell(7).value = r.qty;
    row.getCell(8).value = r.summe;
    row.getCell(9).value = r.ek;
    row.getCell(11).value = r.marge;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Baut einen synthetischen eBay-Report (Struktur wie die echten Exporte). */
function buildEbayCsv(
  rows: Array<{ title: string; qty: number; revenue: string; sellingCosts: string }>
): string {
  const preamble = [
    "",
    "Ausschlussklauseln",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    '"Abonnementgebühren = 100,00 EUR"',
    "h6",
    "",
    "Bericht vom 1. Jan 2026 bis 15. Jul 2026",
  ];
  const header =
    "Angebotstitel,eBay-Artikelnummer,Shop-Kategorie L1,Shop-Kategorie L2,Verkaufte Stueckzahl," +
    "Gesamtumsatz,Umsatz ohne Versand,Versand,Verkaufskosten gesamt,Angebotsgebuehren," +
    "Optionale Gebuehren,Verkaufsprovisionen,Basis-Anzeigen,Premium-Anzeigen,Express-Anzeigen," +
    "externe Anzeigen,Internationale Gebuehren,Sonstige,Anzahlung,Gutschriften,Versandetiketten," +
    "Umsatz nach Kosten,Durchschnittspreis,x,y,z,";
  const dataRows = rows.map((r) =>
    [
      r.title,
      "100",
      "Sonstiges",
      "-",
      String(r.qty),
      r.revenue,
      r.revenue,
      "0.00 EUR",
      r.sellingCosts,
      "0.00 EUR",
      "0.00 EUR",
      "2.00 EUR",
      "1.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.00 EUR",
      "0.10 EUR",
      r.revenue,
      r.revenue,
      "0",
      "0",
      "0",
    ].join(",")
  );
  return [...preamble, header, ...dataRows].join("\n");
}

const CARD_A = "Yu-Gi-Oh! TEST-DE001 Erste Testkarte Ultra Rare NM 1st";
const CARD_B = "Yu-Gi-Oh! TEST-DE002 Zweite Testkarte Ultra Rare NM 1st";
const PRIVATE = "Schmuck Konvolut Testring 925 Silber";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.cleanup();
});

describe("runImport", () => {
  it("importiert Billbee + eBay, persistiert Artikel und Fenster-Snapshots", async () => {
    const billbee30: UploadedFile = {
      name: "billbee-30d.xlsx",
      buffer: await buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty: 3, summe: "30,00 €", ek: "9,00 €", marge: "21,00 €" },
        { name: CARD_B, qty: 2, summe: "20,00 €", ek: "6,00 €", marge: "14,00 €" },
        { name: PRIVATE, qty: 1, summe: "40,00 €", ek: "0,00 €", marge: "40,00 €" },
      ]),
    };
    const ebay: UploadedFile = {
      name: "ebay-report.csv",
      buffer: Buffer.from(
        buildEbayCsv([
          { title: CARD_A, qty: 3, revenue: "30.00 EUR", sellingCosts: "6.00 EUR" },
          { title: CARD_B, qty: 2, revenue: "20.00 EUR", sellingCosts: "4.00 EUR" },
        ]),
        "utf-8"
      ),
    };

    const summary = await runImport(db.prisma, { billbeeFiles: [billbee30], ebayFile: ebay });

    expect(summary.windows).toHaveLength(1);
    expect(summary.windows[0].window).toBe("30");
    expect(summary.cardArticleCount).toBe(2); // Privatverkauf ausgefiltert
    expect(summary.matchRate).toBeCloseTo(1);
    expect(summary.windowsReplaced).toContain("30");

    const articleCount = await db.prisma.article.count({ where: { isCard: true } });
    expect(articleCount).toBe(2);
    const swCount = await db.prisma.saleWindow.count({ where: { window: "30" } });
    expect(swCount).toBe(2);
  });

  it("leitet das Fenster IMMER aus dem Zeitraum-Feld ab, nicht aus dem Dateinamen", async () => {
    // Dateiname sagt "30d", Inhalt ist aber ein 365-Tage-Zeitraum.
    const misnamed: UploadedFile = {
      name: "billbee-30d.xlsx",
      buffer: await buildBillbee("16.07.2025 - 15.07.2026", [
        { name: CARD_A, qty: 10, summe: "100,00 €", ek: "30,00 €", marge: "70,00 €" },
      ]),
    };
    const summary = await runImport(db.prisma, { billbeeFiles: [misnamed], ebayFile: null });
    expect(summary.windows[0].window).toBe("365");
  });

  it("ist idempotent: Re-Import desselben Fensters ersetzt den Snapshot (keine Dopplung)", async () => {
    const build = (qty: number, summe: string): Promise<Buffer> =>
      buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty, summe, ek: "9,00 €", marge: "1,00 €" },
      ]);

    await runImport(db.prisma, {
      billbeeFiles: [{ name: "b.xlsx", buffer: await build(3, "30,00 €") }],
      ebayFile: null,
    });
    await runImport(db.prisma, {
      billbeeFiles: [{ name: "b.xlsx", buffer: await build(5, "50,00 €") }],
      ebayFile: null,
    });

    const rows = await db.prisma.saleWindow.findMany({ where: { window: "30" } });
    expect(rows).toHaveLength(1); // genau ein Snapshot, nicht zwei
    expect(rows[0].qty).toBe(5); // der neuere Wert hat gewonnen
    expect(rows[0].revenue).toBeCloseTo(50);
  });

  it("legt ungematchte Kartenzeilen als offene Review-Items an", async () => {
    const billbee: UploadedFile = {
      name: "b.xlsx",
      buffer: await buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty: 1, summe: "10,00 €", ek: "3,00 €", marge: "7,00 €" },
      ]),
    };
    // eBay-Listing mit voellig anderem Namen/Set-Code -> kein Match.
    const ebay: UploadedFile = {
      name: "e.csv",
      buffer: Buffer.from(
        buildEbayCsv([
          { title: "Yu-Gi-Oh! ANDR-DE999 Ganz andere Karte", qty: 1, revenue: "10.00 EUR", sellingCosts: "2.00 EUR" },
        ]),
        "utf-8"
      ),
    };
    const summary = await runImport(db.prisma, { billbeeFiles: [billbee], ebayFile: ebay });
    expect(summary.reviewItemsOpen).toBeGreaterThan(0);

    const reviews = await db.prisma.reviewItem.findMany({ where: { status: "open" } });
    expect(reviews.some((r) => r.source === "ebay")).toBe(true);
  });

  it("kollabiert zwei Dateien mit demselben Fenster auf einen Snapshot (alltime-Duplikat-Fall)", async () => {
    // billbee-alltime.xlsx ist versehentlich ein 30d-Duplikat (KONZEPT §12.1):
    // beide Dateien haben denselben Zeitraum -> derselbe Fenster-Key "30".
    const file30: UploadedFile = {
      name: "billbee-30d.xlsx",
      buffer: await buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty: 3, summe: "30,00 €", ek: "9,00 €", marge: "21,00 €" },
      ]),
    };
    const fileAlltimeDup: UploadedFile = {
      name: "billbee-alltime.xlsx",
      buffer: await buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty: 3, summe: "30,00 €", ek: "9,00 €", marge: "21,00 €" },
      ]),
    };

    // Darf NICHT an der Unique-Constraint scheitern.
    const summary = await runImport(db.prisma, {
      billbeeFiles: [file30, fileAlltimeDup],
      ebayFile: null,
    });
    expect(summary.windowsReplaced).toEqual(["30"]);

    const rows = await db.prisma.saleWindow.findMany({ where: { window: "30" } });
    expect(rows).toHaveLength(1);
  });

  it("bewahrt bestehende Reviews bei einem reinen Billbee-Re-Import (ohne eBay)", async () => {
    // 1. Import MIT eBay erzeugt einen offenen Review-Eintrag (ungematchtes eBay-Listing).
    const billbee: UploadedFile = {
      name: "b.xlsx",
      buffer: await buildBillbee("15.06.2026 - 15.07.2026", [
        { name: CARD_A, qty: 1, summe: "10,00 €", ek: "3,00 €", marge: "7,00 €" },
      ]),
    };
    const ebay: UploadedFile = {
      name: "e.csv",
      buffer: Buffer.from(
        buildEbayCsv([
          { title: "Yu-Gi-Oh! ANDR-DE999 Ganz andere Karte", qty: 1, revenue: "10.00 EUR", sellingCosts: "2.00 EUR" },
        ]),
        "utf-8"
      ),
    };
    const first = await runImport(db.prisma, { billbeeFiles: [billbee], ebayFile: ebay });
    expect(first.reviewItemsOpen).toBeGreaterThan(0);

    // 2. Reiner Billbee-Re-Import (ohne eBay) darf die Reviews NICHT loeschen.
    const second = await runImport(db.prisma, { billbeeFiles: [billbee], ebayFile: null });
    expect(second.reviewItemsOpen).toBe(first.reviewItemsOpen);
  });

  it("wirft bei falschem Dateityp", async () => {
    await expect(
      runImport(db.prisma, {
        billbeeFiles: [{ name: "falsch.csv", buffer: Buffer.from("x") }],
        ebayFile: null,
      })
    ).rejects.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { parseEbayReport } from "./ebay";

/**
 * Synthetischer eBay-"Listings Sales Report" mit derselben Struktur wie die
 * echten Exporte (Vorspann Zeile 0-10, Header Zeile 11, Daten ab Zeile 12).
 * Frei erfundene Zahlen, keine echten Geschaeftsdaten.
 */
function buildSyntheticEbayCsv(): string {
  const preamble = [
    "",
    "Ausschlussklauseln",
    "Hinweistext 1",
    "Hinweistext 2",
    "Hinweistext 3",
    "Hinweistext 4",
    '"Sie hatten während dieses Zeitraums 123,45 EUR an Gebühren auf Kontobasis."',
    '"Abonnementgebühren = 123,45 EUR"',
    "Hinweistext 5",
    "",
    "Bericht vom 1. Jan 2026 bis 15. Jul 2026",
  ];
  const header =
    "Angebotstitel,eBay-Artikelnummer,Shop-Kategorie L1,Shop-Kategorie L2,Verkaufte Stueckzahl," +
    "Gesamtumsatz (inkl. Steuern),Umsatz ohne Kosten fuer Verpackung und Versand," +
    "Vom Kaeufer an Sie gezahlte Kosten fuer Versand und Verpackung,Verkaufskosten gesamt," +
    "Angebotsgebuehren,Optionale Gebuehren fuer Zusatzoptionen,Verkaufsprovisionen," +
    "Gebuehren fuer Basis-Anzeigen,Gebuehren fuer Premium-Anzeigen,Gebuehren fuer Anzeigen Express," +
    "Gebuehren fuer externe Anzeigen,Internationale Gebuehren,Sonstige eBay-Gebuehren," +
    "Bearbeitungsgebuehren fuer Anzahlungen,Gebuehrengutschriften," +
    "Kosten fuer Versandetiketten,Umsatz nach Kosten,Durchschnittlicher Verkaufspreis," +
    "Ueber Anzeige verkaufte Stueckzahl,Ueber Preisvorschlag verkaufte Stueckzahl," +
    "Ueber Preisvorschlag des Verkaeufers verkaufte Stueckzahl,";

  const rows = [
    // Karte mit Set-Code
    "Yu-Gi-Oh! TEST-DE001 Test Testkarte Ultra Rare NM 1st,111,Sonstiges,-,5,49.95 EUR,45.00 EUR,4.95 EUR," +
      "15.00 EUR,0.00 EUR,0.00 EUR,8.50 EUR,4.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR," +
      "0.10 EUR,34.95 EUR,9.99 EUR,5,0,0",
    // Bundle ohne Set-Code, aber mit Marker
    "50 Testkarten Sammlung YuGiOh! Holos,222,Sonstiges,-,2,40.00 EUR,38.00 EUR,2.00 EUR," +
      "10.00 EUR,0.00 EUR,0.00 EUR,4.40 EUR,2.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR," +
      "0.00 EUR,30.00 EUR,20.00 EUR,2,0,0",
    // Privatverkauf (keine Karte)
    "Schmuck Testring 925 Silber,333,Sonstiges,-,1,12.00 EUR,12.00 EUR,0.00 EUR," +
      "3.00 EUR,0.00 EUR,0.00 EUR,1.30 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR,0.00 EUR," +
      "0.00 EUR,9.00 EUR,12.00 EUR,0,0,1",
  ];

  return [...preamble, header, ...rows].join("\n");
}

describe("parseEbayReport", () => {
  it("liest den Berichtszeitraum und die Abonnementgebuehr aus dem Vorspann", () => {
    const result = parseEbayReport(buildSyntheticEbayCsv());
    expect(result.reportFrom?.getUTCMonth()).toBe(0);
    expect(result.reportTo?.getUTCMonth()).toBe(6);
    expect(result.subscriptionFee).toBeCloseTo(123.45);
  });

  it("parst alle Datenzeilen mit Gebuehren-Feldern", () => {
    const result = parseEbayReport(buildSyntheticEbayCsv());
    expect(result.rows).toHaveLength(3);

    const card = result.rows[0];
    expect(card.setCode).toBe("TEST-DE001");
    expect(card.isCard).toBe(true);
    expect(card.qtySold).toBe(5);
    expect(card.totalRevenueGross).toBeCloseTo(49.95);
    expect(card.salesCommission).toBeCloseTo(8.5);
    expect(card.adFeesBasic).toBeCloseTo(4.0);
  });

  it("erkennt Bundles ohne Set-Code als Karte ueber den Marker", () => {
    const result = parseEbayReport(buildSyntheticEbayCsv());
    const bundle = result.rows.find((r) => r.titleRaw.includes("Testkarten Sammlung"));
    expect(bundle?.isCard).toBe(true);
    expect(bundle?.setCode).toBeNull();
  });

  it("filtert Privatverkaeufe (Schmuck) als Nicht-Karte", () => {
    const result = parseEbayReport(buildSyntheticEbayCsv());
    const jewelry = result.rows.find((r) => r.titleRaw.startsWith("Schmuck"));
    expect(jewelry?.isCard).toBe(false);
  });

  it("wirft bei fehlendem Header", () => {
    expect(() => parseEbayReport("a,b,c\nd,e,f")).toThrow();
  });
});

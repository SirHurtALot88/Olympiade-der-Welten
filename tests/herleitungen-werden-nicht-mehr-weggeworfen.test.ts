/**
 * ZWEI ZERLEGUNGEN WURDEN GERECHNET UND DANN WEGGEWORFEN.
 *
 * Chris am 23.08.2026, nach den Saisonstand-Hovers: „hast du noch vorschläge wo wir noch hovers
 * gebrauchen könnten … ich finde die sind eine sehr charmante lösung" — und auf die Liste hin:
 * „5-8 finde ich auch stark die kannst du dann im anschluss machen."
 *
 * Punkte 5 und 8 hatten dieselbe Ursache: die Herleitung existierte, wurde beim Bau der
 * Anzeigezeile aber nicht mitgereicht. Im Spiel stand deshalb eine Zahl ohne Geschichte.
 *
 *  - VERKAUFSPREIS (`transfermarkt-expected-sell-value.ts`): `buildTransfermarktSaleFactorBreakdown`
 *    lieferte Bracket, Rang darin, Grundfaktor und Rangbonus; übrig blieb der Preis.
 *  - MOST IMPROVED (`league-leaders-service.ts`): `buildMostImprovedRows` lieferte die mittlere
 *    Feldposition beider Saisonhälften samt Auftritten; übrig blieb das Delta. Genau das hatte
 *    Chris als `pxoa72` gemeldet: „Wir brauchen noch eine erklärung wie Most Improved Player sich
 *    zusammensetzt!"
 *
 * Dieser Wächter hält fest, dass beide Zerlegungen den Weg bis zur Anzeige überstehen. Er prüft die
 * KONTRAKTE, nicht das Markup — ein Feld, das unterwegs herausfällt, ist genau der Fehler, der hier
 * zweimal steckte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sellValue = readFileSync(join(process.cwd(), "lib/market/transfermarkt-expected-sell-value.ts"), "utf8");
const leaders = readFileSync(join(process.cwd(), "lib/foundation/league-leaders-service.ts"), "utf8");
const scope = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);
const playersTable = readFileSync(
  join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
  "utf8",
);
const leadersView = readFileSync(
  join(process.cwd(), "app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx"),
  "utf8",
);

describe("Verkaufspreis — die Zerlegung ueberlebt bis zur Spalte", () => {
  it("haengt am Eintrag, den die Spielerliste liest", () => {
    expect(sellValue).toContain("saleFactorBreakdown: TransfermarktSaleFactorBreakdown | null;");
    expect(sellValue).toContain("saleFactorBreakdown: breakdown,");
  });

  it("nimmt die BEREINIGTE Fassung, nicht die rohe", () => {
    /*
     * `rohBreakdown` ist der Stand VOR `applySellPricingPolicyToBreakdown`. Die Ausfuehrung nimmt
     * die bereinigte Fassung — ein Hover auf der rohen verspraeche Geld, das nie ankommt. Am
     * gemeldeten Fall (#44) lagen die beiden 31,78 gegen 37,39 auseinander.
     */
    expect(sellValue).not.toContain("saleFactorBreakdown: rohBreakdown");
  });

  it("wird in der Spalte auch gezeigt", () => {
    expect(playersTable).toContain("renderSellFactorPanel");
    expect(playersTable).toContain("saleFactorBreakdown");
  });
});

describe("Most Improved — die Herleitung ueberlebt bis zur Bestenliste", () => {
  it("haengt an der Quellzeile", () => {
    expect(leaders).toContain("earlyFieldPosition?: number | null;");
    expect(leaders).toContain("lateFieldPosition?: number | null;");
  });

  it("wird beim Bauen der Kategorie mitgegeben", () => {
    expect(leaders).toContain("mostImproved: {");
    expect(leaders).toContain("earlyFieldPosition: row.earlyFieldPosition ?? null,");
  });

  it("faellt in der Kategorie-Zwischenstufe nicht heraus", () => {
    // `buildPreSortedCategory` baut die Anzeigezeilen neu — ohne diese Zeile waere die Erklaerung
    // genau hier wieder weg gewesen.
    expect(leaders).toContain("...(row.mostImproved ? { mostImproved: row.mostImproved } : {}),");
  });

  it("wird vom Zeilenbauer der Shell durchgereicht", () => {
    expect(scope).toContain("earlyFieldPosition: row.earlyFieldPosition,");
    expect(scope).toContain("lateAppearances: row.lateAppearances,");
  });

  it("wird in der Ansicht auch gezeigt — und nur bei dieser Kategorie", () => {
    expect(leadersView).toContain("renderMostImprovedPanel");
    // Der Hover haengt an `category.id === "mostImproved"`: die anderen Bestenlisten haben keine
    // solche Herleitung, dort waere ein leeres Panel schlimmer als keins.
    expect(leadersView).toContain('category.id === "mostImproved"');
  });
});

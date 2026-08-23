/**
 * EIN VERTRAGSENDE IST EIN VERKAUF — und wird deshalb genauso bepreist.
 *
 * CHRIS' ENTSCHEIDUNG: „ja gleicher abschlag wie beim verkauf -> du musst es so sehen dass
 * contract exits im grunde nichts anderes als ein verkauf sind bei uns im spiel."
 *
 * WAS VORHER WAR: `buildContractExitValue` nahm den ROHEN Sale-Factor-Breakdown. Der Verkaufsweg
 * schickt ihn dagegen durch `applySellPricingPolicyToBreakdown` — Saisonstart-Abschlag × Timing ×
 * Kaderdruck × Team-Fit. Ein auslaufender oder aufgelöster Vertrag buchte dem Team damit einen
 * Erlös, den derselbe Spieler über den Transfermarkt nie gebracht hätte.
 *
 * DAS WAR NICHT NUR EINE ANZEIGE. `buildContractExitValue` speist die tatsächliche Gutschrift und
 * den Eintrag in der Transferhistorie. Die Auslauf-TABELLE war zuvor schon auf die Policy gezogen
 * worden (`contract-negotiation-preview.ts`); wäre die Buchung roh geblieben, zeigte die
 * Oberfläche ab da die richtige Zahl und schriebe die falsche gut — der schlimmere Zustand.
 *
 * DER BELEG KOMMT AUS DER GEGENRICHTUNG: Lava Golem wurde am Live-Spielstand zwölf Minuten nach
 * Chris' Meldung über den Markt verkauft, die Transferhistorie zeigt `fee 28.09`, während der rohe
 * Breakdown 29,48 sagt — Verhältnis 0,9528, exakt die Policy.
 *
 * WIE GROSS DER EINGRIFF IST, über alle fünf Live-Spielstände gemessen (je rund 340 Verträge):
 * die Buchung ändert sich bei praktisch jedem, im Mittel um 1,1 bis 1,9, größte Einzelkorrektur
 * 22,25. UND SIE GEHT IN BEIDE RICHTUNGEN: im gemeldeten Save waren 136 von 336 vorher zu HOCH,
 * die übrigen zu NIEDRIG. Das ist kein Strafabschlag, sondern derselbe Marktpreis — der Kaderdruck
 * kann auch aufschlagen. Genau deshalb ist „gleich wie beim Verkauf" die richtige Regel und nicht
 * „etwas abziehen".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BUCHUNG = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");
const ANZEIGE = readFileSync(join(process.cwd(), "lib/market/contract-negotiation-preview.ts"), "utf8");
const VERKAUF = readFileSync(join(process.cwd(), "lib/market/transfermarkt-local-service.ts"), "utf8");

/** Der Rumpf von `buildContractExitValue` — nur dort darf gemessen werden. */
const EXIT_FN = (() => {
  const start = BUCHUNG.indexOf("function buildContractExitValue");
  return BUCHUNG.slice(start, BUCHUNG.indexOf("\nfunction ", start + 1));
})();

describe("Vertragsende wird wie ein Verkauf bepreist", () => {
  it("die Buchung schickt den Breakdown durch die Verkaufs-Preisstufe", () => {
    expect(EXIT_FN).toContain("applySellPricingPolicyToBreakdown({");
  });

  it("der rohe Breakdown wird NICHT mehr als Erlös gebucht", () => {
    // Die alte Zeile. Kehrte sie zurück, wäre die Gutschrift wieder eine andere als der Marktpreis.
    expect(EXIT_FN).not.toContain(
      "const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, entry);",
    );
  });

  it("ALLE DREI Wege benutzen dieselbe Stufe — Buchung, Anzeige, Verkauf", () => {
    // Der eigentliche Punkt: nicht „auch hier ein Abschlag", sondern EINE Preisregel.
    for (const quelle of [BUCHUNG, ANZEIGE, VERKAUF]) {
      expect(quelle).toContain("applySellPricingPolicyToBreakdown");
    }
  });

  it("der Kaderdruck liest die Größe NACH dem Abgang — wie im Verkaufsweg", () => {
    // Sonst bewertete er einen Kader, den es nach dem Abgang nicht mehr gibt. Dieselbe Regel wie
    // in der Anzeige; eine andere hier ergäbe wieder zwei Zahlen.
    expect(EXIT_FN).toContain("rosterAfter: Math.max(0, rosterCount - 1)");
    expect(ANZEIGE).toContain("rosterAfter: Math.max(0, rosterCount - 1)");
  });

  it("OHNE Kadereintrag bleibt es beim rohen Wert — die Policy braucht ein Team", () => {
    // `applySellPricingPolicyToBreakdown` verlangt `teamId` und Kadergröße. Für einen Aufruf ohne
    // Eintrag gibt es beides nicht; dort ist der rohe Wert die einzige ehrliche Antwort.
    expect(EXIT_FN).toContain("    : rohBreakdown;");
  });

  it("der Vergleichsmaßstab `marketValueAtExit` bleibt ROH", () => {
    // Verschöbe er sich mit, wäre die ausgewiesene Differenz wieder eine andere Zahl als die,
    // die der Spieler in der Auslauf-Tabelle sieht.
    expect(EXIT_FN).toContain("rohBreakdown.baseMarketValue ?? economy.marketValue");
  });
});

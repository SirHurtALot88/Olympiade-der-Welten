/**
 * GEMELDET VON CHRIS: „und wieso gibts beim verlängern kein angebot senden knopf? der spieler muss
 * wie beim kauf ja auch verhandeln können."
 *
 * Der Befund war unangenehmer als die Frage klang. Die Verlaengerung laeuft laengst durch DIESELBE
 * Engine wie der Kauf — `buildNegotiationPreviewForRoster` ruft `buildContractNegotiationPreview`.
 * Verdikt und Gegenangebots-Betrag wurden also die ganze Zeit berechnet. Zwei Stellen liessen sie
 * fallen: der Client-Typ fuehrte die Felder nicht, und das Fenster zeigte nur die drei
 * Prozentbalken und bestaetigte danach unabhaengig davon. Die Chancen waren Deko.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MODAL = readFileSync(
  join(process.cwd(), "app/foundation/teams-v2/ContractRenewalNegotiationModal.tsx"),
  "utf8",
);
const TYPEN = readFileSync(join(process.cwd(), "lib/foundation/tabs/foundation-page-types.ts"), "utf8");
const RENEWAL = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");

describe("Verlängern verhandelt wie der Kauf", () => {
  it("hat einen Knopf zum Senden des Angebots", () => {
    expect(MODAL).toContain('data-testid="negotiation-send-offer-button"');
    expect(MODAL).toContain("Schritt 1: Angebot senden");
  });

  it("unterschreibt erst nach einer Zusage", () => {
    // Ohne diese Sperre bliebe das Verdikt folgenlos und jedes Angebot ginge durch.
    expect(MODAL).toContain('const zusageLiegtVor = aktivesErgebnis?.status === "accepted";');
    expect(MODAL).toContain("confirmBlocked || !zusageLiegtVor");
  });

  it("entscheidet am Verdikt und nicht an den Prozentbalken", () => {
    // Die Prozente sind aus dem Verdikt ABGELEITET. Wer sie zur Entscheidung macht, baut eine
    // zweite Wahrheit neben die serverseitige.
    expect(MODAL).toContain("const verdict = negotiation.verdict;");
    expect(MODAL).not.toContain("acceptChance > counterChance");
  });

  it("kennt alle sechs Verdikte", () => {
    for (const verdict of [
      "reject_lowball",
      "reject_not_about_money",
      "reject_affront",
      "counter_money",
      "counter_conditions",
    ]) {
      expect(MODAL, `Verdikt ${verdict} nicht behandelt`).toContain(verdict);
    }
  });

  it("lässt ein Gegenangebot einschlagen, statt es nur anzuzeigen", () => {
    expect(MODAL).toContain('data-testid="negotiation-accept-counter-button"');
    expect(MODAL).toContain("function gegenangebotEinschlagen()");
  });

  /**
   * Ein angenommenes Gegenangebot ist bindend (`verhandlung-rework.md`, Abschnitt 3.4): die vom
   * Spieler selbst genannte Zahl erneut durch die Bänder zu schicken wäre Wortbruch durch Formel —
   * sie kann unter der vollen Forderung liegen und käme als Gegenangebot zurück.
   */
  it("behandelt das eingeschlagene Gegenangebot als Zusage", () => {
    const rumpf = MODAL.slice(
      MODAL.indexOf("function gegenangebotEinschlagen()"),
      MODAL.indexOf("const negotiation ="),
    );
    const block = rumpf.length > 0 ? rumpf : MODAL.slice(MODAL.indexOf("function gegenangebotEinschlagen()"));
    expect(block).toContain('status: "accepted"');
  });

  it("verwirft das Ergebnis, sobald das Angebot sich ändert", () => {
    // Sonst unterschriebe man einen anderen Vertrag als den, dem der Spieler zugestimmt hat.
    expect(MODAL).toContain("ergebnis.fuerAngebot.salary === draftSalary");
    expect(MODAL).toContain("ergebnis.fuerAngebot.length === draftLength");
    expect(MODAL).toContain("ergebnis.fuerAngebot.shape === draftShape");
  });

  it("zeigt die Antwort des Spielers an", () => {
    expect(MODAL).toContain('data-testid="negotiation-outcome"');
  });
});

describe("Das Verdikt kommt vom Server und wird nicht unterwegs verloren", () => {
  it("die Verlängerung liest dieselbe Engine wie der Kauf", () => {
    expect(RENEWAL).toContain("buildContractNegotiationPreview({");
  });

  it("der Client-Typ führt Verdikt und Gegenangebot", () => {
    // Genau hier fielen die Felder vorher heraus — berechnet, aber für den Dialog nicht vorhanden.
    expect(TYPEN).toContain("verdict?:");
    expect(TYPEN).toContain("counterSalary?: number | null;");
    expect(TYPEN).toContain("counterConditions?: { contractLength: number; contractShape: ContractShape } | null;");
  });
});

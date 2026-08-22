/**
 * GEFRAGT VON CHRIS (`ua6cx9`, „Markt · Kredite", Spielstand `swnjlk`):
 *
 *   „Ich sehe gerade dass M-M einen KRedit genommen hat für 76,2 Mio über 13% von der Bank und für
 *    R-C und S-C je 22,4 Mio abgibtg bei 11,6% und 10,2% -> eigentlich ne schlechte Art der
 *    Finanzierung oder ist das bewusst so?"
 *
 * BEWUSST WAR ES NICHT. `resolveLoanOffers` prueft beim Team-Verleih die Beziehung
 * (`lender_hostile_relationship`) und die Liquiditaet (`lender_insufficient_cash`) — nie die
 * eigenen Schuldzinsen des Gebers. Eine Margen-Regel gab es nicht.
 *
 * AM LIVE-ABBILD GEMESSEN: 4 von 30 laufenden Team-Krediten sind Verlustgeschaefte.
 *
 *   T-G -> B-P   verleiht 10,1 %   zahlt selbst 14,2 %
 *   M-M -> R-C   verleiht 11,6 %   zahlt selbst 13,5 %
 *   M-M -> S-C   verleiht 10,2 %   zahlt selbst 13,5 %
 *   N-N -> T-G   verleiht 14,2 %   zahlt selbst 14,5 %
 *
 * DER EINGRIFF IST EIN BODEN, KEIN VERBOT. Kredit zwischen Teams ist im Spiel auch ein
 * Beziehungswerkzeug; ein Verbot naehme dem Nehmer die Quelle. Der Boden laesst das Geschaeft
 * zustandekommen, nur nicht mehr mit Verlust.
 */
import { describe, expect, it } from "vitest";

import { computeTeamLoanRate, TEAM_LOAN_FLOOR } from "@/lib/finance/loan-service";

/** Die gemeinsame Ausgangslage; nur der eigene Schuldzins unterscheidet die Faelle. */
const LAGE = { bankRate: 0.15, relationshipValue: 3, lenderFinances: 5 } as const;

describe("Ein Team verleiht nicht unter seinen eigenen Kosten", () => {
  it("hebt den Zins auf den eigenen Schuldzins an", () => {
    // M-Ms Fall, Zahl fuer Zahl: ohne Boden 12,2 %, mit eigenem 13,5 % sind es 13,5 %.
    const ohne = computeTeamLoanRate({ ...LAGE });
    const mit = computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: 0.135 });
    expect(ohne).toBeCloseTo(0.122, 3);
    expect(mit).toBeCloseTo(0.135, 3);
  });

  it("laesst einen schuldenfreien Verleiher unveraendert", () => {
    // Die Grenze: 6 der 10 Team-Kredite im Spielstand haben schuldenfreie Geber. Bei ihnen darf
    // sich nichts bewegen, sonst waere der Eingriff eine allgemeine Zinserhoehung.
    const ohne = computeTeamLoanRate({ ...LAGE });
    expect(computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: 0 })).toBe(ohne);
    expect(computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: undefined })).toBe(ohne);
  });

  it("greift nicht, wenn der Verleiher ohnehin teurer verleiht als er zahlt", () => {
    // Wer zu 5 % verschuldet ist und zu 12,2 % verleiht, verdient — da ist nichts zu heben.
    expect(computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: 0.05 })).toBeCloseTo(
      computeTeamLoanRate({ ...LAGE }),
      6,
    );
  });

  it("darf den Bankzins UEBERSTEIGEN, statt eine Guenstigkeit vorzutaeuschen", () => {
    /**
     * Der unbequeme Fall, und er ist Absicht: N-N zahlt 14,5 % bei einem Bankzins von 15 %. Nach
     * Abzug des Team-Rabatts laege das Angebot bei 14 % — unter den eigenen Kosten. Mit dem Boden
     * sind es 14,5 %, also mehr als die Bank nach Rabatt verlangt.
     *
     * Der Nehmer waehlt dann die Bank. Das ist die richtige Antwort: ein hoch verschuldetes Team
     * ist kein guenstiger Geldgeber, und ein Angebot, das so taete, waere eine Luege.
     */
    const bankNachRabatt = 0.15 - 0.01;
    const mit = computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: 0.145 });
    expect(mit).toBeGreaterThan(bankNachRabatt);
    expect(mit).toBeCloseTo(0.145, 3);
  });

  it("faellt nie unter den allgemeinen Boden", () => {
    // Gegenprobe zur Gegenprobe: der neue Boden darf den alten nicht aushebeln.
    expect(computeTeamLoanRate({ bankRate: 0.05, relationshipValue: 5, lenderFinances: 10 })).toBeGreaterThanOrEqual(
      TEAM_LOAN_FLOOR,
    );
  });

  it("ignoriert einen unsinnigen Wert, statt daran zu zerbrechen", () => {
    const ohne = computeTeamLoanRate({ ...LAGE });
    expect(computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: Number.NaN })).toBe(ohne);
    expect(computeTeamLoanRate({ ...LAGE, lenderHighestDebtRate: -0.5 })).toBe(ohne);
  });
});

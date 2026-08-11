/**
 * `??` ALS WACHE GEGEN EINE LEERE LISTE — Fehlerklasse 5 des Audit-Plans.
 *
 * BEFUND: `app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx` schrieb
 * `contract?.lockedRankPayoutLadder ?? null`. `buildOfferRankPayoutLadderPreview` liefert aber `[]`,
 * wenn ein Angebot keine V3-Konditionen traegt, und `sponsor-offer-service.ts` friert genau dieses
 * `[]` beim Unterschreiben im Vertrag ein. `[]` ist nicht nullish — der `null`-Zweig war toter Code.
 *
 * WAS DER SPIELER GEMERKT HAETTE: das Liga-Detailfenster oeffnete den Zusammensetzungs-Block und
 * zeigte darin nichts, statt den ehrlichen Satz „Für diesen Vertrag liegt keine
 * Auszahlungs-Aufschlüsselung vor". Und die Gewinnstufen-Leiter selbst rechnete aus der leeren Liste
 * neun Stufen, die ALLE denselben Betrag zeigten (`readLockedRankPayout([], rang)` == 0, also
 * ueberall nur `baseCash`) — eine erfundene flache Leiter statt eines Eingestaendnisses.
 *
 * Geprueft werden WERTE und das tatsaechlich gerenderte Markup, nicht Quelltext-Strings.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorRankLadder } from "@/components/foundation/sponsor/SponsorRankLadder";
import type { TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { readContractRankPayoutLadder, readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";
import { rerollSponsorV3TermsForNewSeason } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Eine echte, fallende Leiter — Rang 1 zahlt am meisten. */
const LEITER = Array.from({ length: 32 }, (_, index) => 90 - index * 1.5);

function vertrag(ladder: number[] | undefined): TeamSponsorContract {
  return { lockedRankPayoutLadder: ladder } as unknown as TeamSponsorContract;
}

describe("Eine leere Leiter ist keine Leiter", () => {
  it("readLockedRankPayout erfindet aus `[]` eine 0 — das ist die Falle, gegen die gewacht wird", () => {
    // Kein Fehler der Funktion selbst, aber der Grund, warum `[]` nie bis hierher kommen darf.
    for (const rang of [1, 16, 32]) {
      expect(readLockedRankPayout([], rang)).toBe(0);
    }
    expect(readLockedRankPayout(LEITER, 1)).toBe(90);
    expect(readLockedRankPayout(LEITER, 32)).toBeCloseTo(90 - 31 * 1.5, 9);
  });

  it("readContractRankPayoutLadder beantwortet `[]` und `undefined` gleich: null", () => {
    expect(readContractRankPayoutLadder(vertrag([]))).toBeNull();
    expect(readContractRankPayoutLadder(vertrag(undefined))).toBeNull();
    expect(readContractRankPayoutLadder(null)).toBeNull();
    // Und eine echte Leiter kommt unveraendert durch.
    expect(readContractRankPayoutLadder(vertrag(LEITER))).toEqual(LEITER);
  });

  it("`?? null` haette die leere Liste durchgelassen — der Unterschied als Wert", () => {
    const leer = vertrag([]);
    // Die alte Wache: `[]` ist nicht nullish, also kommt `[]` heraus, und `[]` ist WAHR.
    const alteWache = leer.lockedRankPayoutLadder ?? null;
    expect(alteWache).not.toBeNull();
    expect(Boolean(alteWache)).toBe(true);
    // Die neue Wache sagt stattdessen "weiss ich nicht".
    expect(readContractRankPayoutLadder(leer)).toBeNull();
  });

  it("buildSponsorRankTierRows erfindet aus `[]` keine Stufen mehr", () => {
    expect(buildSponsorRankTierRows({ baseCash: 61.4, rankLadder: [], includeFloorRung: true })).toEqual([]);
    expect(buildSponsorRankTierRows({ baseCash: 61.4, rankLadder: [] })).toEqual([]);

    // Mit echter Leiter stehen die Stufen weiterhin — und tragen VERSCHIEDENE Betraege.
    const stufen = buildSponsorRankTierRows({ baseCash: 61.4, rankLadder: LEITER, includeFloorRung: true });
    expect(stufen.length).toBeGreaterThan(5);
    expect(new Set(stufen.map((stufe) => stufe.absolutePayout)).size).toBe(stufen.length);
  });

  it("die gerenderte Leiter zeigt bei `[]` nichts statt neunmal denselben erfundenen Betrag", () => {
    const html = renderToStaticMarkup(
      <SponsorRankLadder rankLadder={[]} baseCash={61.4} currentTeamRank={12} formatCash={(v) => v.toFixed(1)} />,
    );
    // Kein einziger Sprossen-Eintrag …
    expect(html).not.toContain("nl-sponsor-rank-rung");
    // … und vor allem nirgends die erfundene Zahl.
    expect(html).not.toContain("61.4");

    // Gegenstueck: mit echter Leiter stehen alle Stufen und ihre echten Betraege da.
    const echt = renderToStaticMarkup(
      <SponsorRankLadder rankLadder={LEITER} baseCash={61.4} currentTeamRank={12} formatCash={(v) => v.toFixed(1)} />,
    );
    const stufen = buildSponsorRankTierRows({ baseCash: 61.4, rankLadder: LEITER, includeFloorRung: true });
    for (const stufe of stufen) {
      expect(echt).toContain(`>${stufe.absolutePayout.toFixed(1)}<`);
    }
  });
});

/**
 * DIESELBE BAUART, EINE ETAGE TIEFER — und in einem Pfad, der NUR beim Saisonwechsel laeuft.
 *
 * `rerollSponsorV3TermsForNewSeason` hat einen Sonderzweig fuer ALTVERTRAEGE ohne Kurvenform: er
 * kann die Leiter nicht neu bauen und rechnet sie deshalb nur auf den neuen Gehaltsfaktor um. Dort
 * stand `skaliere(terms.baseLadder ?? [])` — eine Wache, die nicht wacht: aus einer kaputten Leiter
 * wurde eine LEERE, und `sponsorV3Anchor([], …)` ist 0. Der Vertrag haette danach eine Leiter ohne
 * Sprossen und einen Anker von 0 getragen; `getSponsorV3Terms` erkennt so etwas nicht mehr als
 * V3-Konditionen an, und das Settlement faellt still auf die nachgebaute Benchmark zurueck — das
 * Team bekaeme eine voellig andere Zahl, als auf seiner Karte steht.
 *
 * Dieser Zweig laeuft weder beim Anlegen noch waehrend der Saison, sondern ausschliesslich beim
 * Saisonwechsel und nur fuer Altvertraege. Er kann also nur hier auffallen.
 */
describe("Der Altvertrags-Zweig des Saisonwechsels gibt lieber die alte Leiter zurueck", () => {
  const vollstaendig = {
    version: 3 as const,
    baseLadder: [...LEITER],
    rankLadder: [...LEITER],
    anchor: 60,
    tilt: 0,
    cardKey: "basis",
    cardName: "Basis",
    rarity: "gewöhnlich",
    startRank: 20,
    goalKey: null,
    goalP: 0,
    goalSize: 0,
    salaryFactor: 1,
    floor: 40,
  };

  it("rechnet eine VOLLSTAENDIGE Altleiter weiterhin auf den neuen Faktor um", () => {
    const gerollt = rerollSponsorV3TermsForNewSeason(vollstaendig as never, {
      newSalaryFactor: 1.2,
      contractYear: 2,
    });
    expect(gerollt.salaryFactor).toBe(1.2);
    expect(gerollt.baseLadder).toHaveLength(32);
    // Der Sockel bleibt stehen, nur der Wertungsanteil skaliert — also muss Rang 1 STEIGEN.
    expect(gerollt.baseLadder[0]!).toBeGreaterThan(LEITER[0]!);
  });

  it("laesst eine kaputte Leiter unveraendert, statt sie durch eine leere zu ersetzen", () => {
    for (const kaputt of [[], LEITER.slice(0, 10)]) {
      const terms = { ...vollstaendig, baseLadder: [...kaputt], rankLadder: [...kaputt] };
      const gerollt = rerollSponsorV3TermsForNewSeason(terms as never, {
        newSalaryFactor: 1.2,
        contractYear: 2,
      });
      // Unveraendert zurueck — insbesondere KEIN Anker 0 und keine leere Leiter, die vorher keine war.
      expect(gerollt).toBe(terms);
      expect(gerollt.anchor).toBe(60);
      expect(gerollt.salaryFactor).toBe(1);
    }
  });
});

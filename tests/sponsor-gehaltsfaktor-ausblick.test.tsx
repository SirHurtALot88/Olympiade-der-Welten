/**
 * GEMELDET VON CHRIS: „und auf der sponsor seite sollte definiiv auch der salary factor von diesem
 * und den nächsten jahren zu finden sein!!!"
 *
 * Sponsor-Angebote binden bis zu drei Saisons (`offer.termSeasons`), und die Gehaltsfaktoren der
 * Folgejahre stehen im Spielstand bereits fest. Wer sie nicht sieht, unterschreibt blind.
 *
 * Der Test prueft WERTE und gerendertes Markup — insbesondere die AUSSAGE der Anzeige, nicht nur die
 * Zahl. Die Richtung („hoeherer Faktor = mehr Sponsorgeld") wird nicht geglaubt, sondern an der
 * Leiter selbst nachgerechnet: waere sie andersherum, wuerde die Karte den Spieler in die falsche
 * Richtung schicken, und genau das faengt der erste Block ab.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SponsorSalaryFactorPanel } from "@/app/foundation/sponsors-v2/FoundationSponsorsNewLook";
import type { SeasonEconomyFactorRecord, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import { buildSponsorSalaryFactorOutlook } from "@/lib/sponsor/sponsor-salary-factor-outlook";
import { rerollSponsorV3TermsForNewSeason } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Ein Fenster mit bekannten Faktoren — so kann der Test die Zahlen benennen, statt sie zu wuerfeln. */
function fenster(faktoren: number[], seasonId = "season-3"): SeasonEconomyFactorRecord[] {
  return faktoren.map((factor, horizonIndex) => ({
    seasonId,
    seasonLabel: horizonIndex === 0 ? "Aktuell" : `Season +${horizonIndex}`,
    horizonIndex,
    factor,
    source: "rolled",
    rollSeed: null,
    carriedFromSeasonId: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
  }));
}

/** Vertrag mit V3-Konditionen, so knapp wie `getSponsorV3Terms` es akzeptiert. */
function vertrag(input: {
  ladderFactor: number;
  termSeasons?: number;
  seasonsRemaining?: number;
  salaryFactorAtSign?: number;
}): TeamSponsorContract {
  const leiter = Array.from({ length: 32 }, (_, index) => 90 - index * 1.5);
  return {
    termSeasons: input.termSeasons,
    seasonsRemaining: input.seasonsRemaining,
    salaryFactorAtSign: input.salaryFactorAtSign,
    sponsorV3: {
      version: 3,
      salaryFactor: input.ladderFactor,
      startRank: 16,
      baseLadder: leiter,
      rankLadder: leiter,
    },
  } as unknown as TeamSponsorContract;
}

describe("Die Richtung, die die Karte behauptet, stimmt mit der Leiter ueberein", () => {
  /**
   * DER BEFUND, DER DIESEN TEST NOETIG MACHT: die Beobachtung „Faktor 1,00 → Leiter@Platz1 Ø 98,1 /
   * Faktor 1,19 → Ø 81,0" aus einem echten Spielstand legt eine INVERSE Kopplung nahe. Nachgerechnet
   * an DEMSELBEN Vertrag (nur der Faktor getauscht) ist sie es nicht: sie vergleicht zwei
   * Leiter-Generationen (Vertraege ohne `curveShape` tragen noch die alte, groessere
   * Benchmark-Leiter). Der Faktor selbst hebt die Leiter.
   */
  it("hebt eine hoehere Zahl die Leiter — auf jedem Rang", () => {
    const niedrig = sponsorKurvenLeiter({ shape: "titeljaeger", startRank: 16, salaryFactor: 0.82 });
    const hoch = sponsorKurvenLeiter({ shape: "titeljaeger", startRank: 16, salaryFactor: 1.24 });
    for (const [index, wert] of niedrig.entries()) {
      expect(hoch[index]!).toBeGreaterThan(wert);
    }
  });

  it("hebt sie auch die neu gebaute Leiter eines laufenden Vertrags", () => {
    const terms = vertrag({ ladderFactor: 1 }).sponsorV3!;
    const bei100 = rerollSponsorV3TermsForNewSeason(terms, { newSalaryFactor: 1.0, contractYear: 1 });
    const bei119 = rerollSponsorV3TermsForNewSeason(terms, { newSalaryFactor: 1.19, contractYear: 1 });
    expect(bei119.rankLadder[0]!).toBeGreaterThan(bei100.rankLadder[0]!);
  });

  /**
   * UND DIE DAEMPFUNG, wegen der die Karte KEINE Prozentzahl aufs Geld schreibt: der Sockel haengt
   * nicht am Faktor, +19 % Faktor sind darum deutlich weniger als +19 % Auszahlung.
   */
  it("hebt sie die Auszahlung schwaecher als sich selbst — der Sockel bleibt", () => {
    const bei100 = sponsorKurvenLeiter({ shape: "titeljaeger", startRank: 16, salaryFactor: 1.0 });
    const bei119 = sponsorKurvenLeiter({ shape: "titeljaeger", startRank: 16, salaryFactor: 1.19 });
    const zuwachs = bei119[0]! / bei100[0]! - 1;
    expect(zuwachs).toBeGreaterThan(0);
    expect(zuwachs).toBeLessThan(0.19);
  });
});

describe("Der Ausblick nennt Saison und Faktor", () => {
  const seasonState = { seasonEconomyFactors: fenster([1.04, 0.88, 0.97, 1.2, 0.84]) };

  it("liest exakt die Zahlen des kanonischen Fensters, ohne sie neu abzuleiten", () => {
    const window = getSeasonEconomyFactorWindow({ saveId: "save-x", seasonId: "season-3", seasonState });
    const outlook = buildSponsorSalaryFactorOutlook({ saveId: "save-x", seasonId: "season-3", seasonState })!;
    expect(outlook.seasons.map((entry) => entry.factor)).toEqual(window.map((entry) => entry.factor));
  });

  it("beschriftet mit echten Saisonnummern statt mit „+2“", () => {
    const outlook = buildSponsorSalaryFactorOutlook({ saveId: "save-x", seasonId: "season-3", seasonState })!;
    expect(outlook.currentSeasonNumber).toBe(3);
    expect(outlook.seasons.map((entry) => entry.seasonNumber)).toEqual([3, 4, 5, 6, 7]);
    expect(outlook.seasons[0]!.label).toBe("Saison 3");
    expect(outlook.seasons[2]!.label).toBe("Saison 5");
  });

  it("gibt die Richtung jeder Folgesaison gegen die LAUFENDE an, nicht gegen die Vorsaison", () => {
    const outlook = buildSponsorSalaryFactorOutlook({ saveId: "save-x", seasonId: "season-3", seasonState })!;
    // 0,97 ist hoeher als 0,88, aber niedriger als die laufende 1,04 — Bezug ist immer "jetzt".
    expect(outlook.seasons.map((entry) => entry.direction)).toEqual(["flat", "down", "down", "up", "down"]);
    expect(outlook.seasons[1]!.deltaToCurrent).toBeCloseTo(-0.16, 9);
    expect(outlook.seasons[3]!.deltaToCurrent).toBeCloseTo(0.16, 9);
  });

  it("markiert genau die Saisons, die eine Unterschrift JETZT mitbindet", () => {
    const ohneVertrag = buildSponsorSalaryFactorOutlook({
      saveId: "save-x",
      seasonId: "season-3",
      seasonState,
      offerTermSeasons: [1, 3, 2],
    })!;
    expect(ohneVertrag.coveredSeasons).toBe(3);
    expect(ohneVertrag.offerTermMin).toBe(1);
    expect(ohneVertrag.seasons.map((entry) => entry.covered)).toEqual([true, true, true, false, false]);

    const mitVertrag = buildSponsorSalaryFactorOutlook({
      saveId: "save-x",
      seasonId: "season-3",
      seasonState,
      contract: vertrag({ ladderFactor: 1.04, termSeasons: 3, seasonsRemaining: 2 }),
      offerTermSeasons: [],
    })!;
    // Restlaufzeit 2, nicht die volle Laufzeit 3 — das abgelaufene Jahr ist kein Ausblick.
    expect(mitVertrag.coveredSeasons).toBe(2);
    // Und die Angebotslaufzeiten zaehlen daneben NICHT mit: wer unterschrieben hat, waehlt nicht mehr.
    expect(mitVertrag.offerTermMin).toBeNull();
    expect(mitVertrag.seasons.map((entry) => entry.covered)).toEqual([true, true, false, false, false]);
  });

  /**
   * Ohne saveId UND ohne persistiertes Fenster wuerde `getSeasonEconomyFactorWindow` mit leerem Seed
   * wuerfeln — andere Zahlen als auf dem Finanzen-Reiter. Zwei Wahrheiten sind schlimmer als eine
   * fehlende Karte, deshalb gibt es dann gar keine.
   */
  it("verweigert die Auskunft, statt mit leerem Seed zu wuerfeln", () => {
    expect(buildSponsorSalaryFactorOutlook({ saveId: null, seasonId: "season-3" })).toBeNull();
    expect(
      buildSponsorSalaryFactorOutlook({ saveId: null, seasonId: "season-3", seasonState }),
    ).not.toBeNull();
  });
});

describe("Der laufende Vertrag sagt, ob er mitwandert", () => {
  const seasonState = { seasonEconomyFactors: fenster([1.19, 0.87, 0.83, 0.91, 1.24]) };
  const bauen = (contract: TeamSponsorContract) =>
    buildSponsorSalaryFactorOutlook({ saveId: "save-y", seasonId: "season-3", seasonState, contract })!.contract!;

  it("meldet „traegt mit“, wenn die Leiter mit dem Saisonfaktor gebaut ist", () => {
    const zustand = bauen(vertrag({ ladderFactor: 1.19, termSeasons: 3, seasonsRemaining: 2 }));
    expect(zustand.traegtDenSaisonfaktor).toBe(true);
    expect(zustand.ladderFactor).toBe(1.19);
    expect(zustand.seasonFactor).toBe(1.19);
  });

  /**
   * DER ECHTE BEFUND AUS `pc.sqlite`: in einem Saison-2-Spielstand steckten 10 von 32 Vertraegen auf
   * Faktor 1,0 fest, waehrend die Saison mit 1,19 abgerechnet wurde (Altvertraege ohne `curveShape`,
   * deren Leiter beim Saisonwechsel nicht neu gebaut wurde). Genau diesen Fall muss die Anzeige
   * benennen, sonst verspricht sie einen Faktor, nach dem der Vertrag gar nicht bezahlt wird.
   */
  it("meldet „eingefroren“, wenn die Leiter auf einem alten Faktor steckt", () => {
    const zustand = bauen(vertrag({ ladderFactor: 1.0, termSeasons: 3, seasonsRemaining: 2 }));
    expect(zustand.traegtDenSaisonfaktor).toBe(false);
    expect(zustand.ladderFactor).toBe(1.0);
    expect(zustand.seasonFactor).toBe(1.19);
  });

  /**
   * `salaryFactorAtSign` ist in Bestandsspielstaenden NICHT belastbar: gemessen trugen alle 32
   * Vertraege eines Saison-1-Spielstands eine 1, obwohl die Leiter mit 1,05 gebaut war (Nachwirkung
   * des alten `?? 1`-Ersatzwerts). Im ersten Vertragsjahr ist der Unterschriftsfaktor per
   * Konstruktion der Saisonfaktor — eine Abweichung dort ist Altdatenrest, kein Ereignis.
   */
  it("verschweigt einen unmoeglichen Unterschriftsfaktor im ersten Vertragsjahr", () => {
    const zustand = bauen(
      vertrag({ ladderFactor: 1.19, termSeasons: 3, seasonsRemaining: 3, salaryFactorAtSign: 1.0 }),
    );
    expect(zustand.factorAtSign).toBeNull();
  });

  it("nennt ihn ab dem zweiten Vertragsjahr, wo er ein echtes Ereignis ist", () => {
    const zustand = bauen(
      vertrag({ ladderFactor: 1.19, termSeasons: 3, seasonsRemaining: 2, salaryFactorAtSign: 1.06 }),
    );
    expect(zustand.factorAtSign).toBe(1.06);
  });
});

describe("Die Karte sagt dem Spieler, was die Zahl bedeutet", () => {
  const seasonState = { seasonEconomyFactors: fenster([1.04, 0.88, 0.97, 1.2, 0.84]) };

  function markup(contract?: TeamSponsorContract) {
    const outlook = buildSponsorSalaryFactorOutlook({
      saveId: "save-z",
      seasonId: "season-3",
      seasonState,
      contract,
      offerTermSeasons: [3],
    })!;
    return renderToStaticMarkup(<SponsorSalaryFactorPanel outlook={outlook} />);
  }

  it("zeigt jede Saison des Fensters mit ihrem Faktor", () => {
    const html = markup();
    for (const [saison, faktor] of [
      [3, 1.04],
      [4, 0.88],
      [5, 0.97],
      [6, 1.2],
      [7, 0.84],
    ] as const) {
      expect(html).toContain(`data-season-number="${saison}"`);
      expect(html).toContain(`data-factor="${faktor}"`);
    }
    // Und in Spielerschreibweise, nicht als roher Float.
    expect(html).toContain("1,04×");
    expect(html).toContain("0,88×");
  });

  it("nennt die Richtung im Klartext, statt eine nackte Zahl hinzustellen", () => {
    const html = markup();
    expect(html).toContain("Höherer Faktor = mehr Sponsorgeld");
    // Eine fallende Folgesaison steht als Verlust da, eine steigende als Gewinn — Pfeil UND Wort,
    // damit die Aussage auch ohne Farbe ankommt (Saison 4: 0,88 gegen 1,04; Saison 6: 1,20).
    expect(html).toContain("▼ 0,16 weniger Geld");
    expect(html).toContain("▲ 0,16 mehr Geld");
    // Der Ton faerbt in dieselbe Richtung wie der Text, nicht mechanisch nach Vorzeichen.
    expect(html).toMatch(/data-season-number="4"[^>]*/);
    expect(html).toContain("nl-tone-risk");
    expect(html).toContain("nl-tone-good");
    // Keine erfundene Prozentzahl auf das GELD — der Sockel skaliert nicht mit (Daempfungs-Test oben).
    expect(html).not.toContain("%");
  });

  it("markiert im Markup, welche Saisons die Unterschrift bindet", () => {
    const html = markup();
    const gebunden = [...html.matchAll(/data-covered="(ja|nein)"/g)].map((treffer) => treffer[1]);
    expect(gebunden).toEqual(["ja", "ja", "ja", "nein", "nein"]);
  });

  it("sagt beim mitwandernden Vertrag, dass er mitwandert", () => {
    const html = markup(vertrag({ ladderFactor: 1.04, termSeasons: 3, seasonsRemaining: 2, salaryFactorAtSign: 1.19 }));
    expect(html).toContain('data-traegt-mit="ja"');
    expect(html).toContain("wandert mit");
    // 1,19 → 1,04 ist eine Verschlechterung, und so muss es dastehen.
    expect(html).toContain("1,19×");
    expect(html).toContain("schlechter");
  });

  it("warnt beim eingefrorenen Vertrag, statt den Saisonfaktor zu versprechen", () => {
    const html = markup(vertrag({ ladderFactor: 0.9, termSeasons: 3, seasonsRemaining: 2 }));
    expect(html).toContain('data-traegt-mit="nein"');
    expect(html).toContain("wandert NICHT mit");
    expect(html).toContain("0,9×");
    expect(html).toContain("weniger, als seine Karte heute wert wäre");
    expect(html).toContain("is-eingefroren");
  });

  /**
   * Eingefroren OBERHALB des Saisonfaktors ist derselbe Mechanismus zum Vorteil des Teams. Stuende
   * dort dieselbe Warnung, wuerde die Karte einen Vorteil als Problem verkaufen.
   */
  it("verkauft einen Vertrag, der ueber dem Saisonfaktor steckt, nicht als Problem", () => {
    const html = markup(vertrag({ ladderFactor: 1.24, termSeasons: 3, seasonsRemaining: 2 }));
    expect(html).toContain('data-traegt-mit="nein"');
    expect(html).toContain("mehr, als seine Karte heute wert wäre");
    expect(html).toContain("is-eingefroren-oben");
    expect(html).not.toContain('class="nl-sponsor-faktor-vertrag is-eingefroren"');
  });

  it("kommt ohne Vertrag ganz ohne Vertragszeile aus", () => {
    expect(markup()).not.toContain("nl-sponsor-salary-factor-contract");
  });

  /**
   * Liegen im Raster verschieden lange Angebote, waere „bindet sich an alle 3" fuer das
   * Einjahresangebot schlicht falsch — die Karte nennt dann die SPANNE.
   */
  it("nennt bei gemischten Laufzeiten die Spanne statt der laengsten", () => {
    const outlook = buildSponsorSalaryFactorOutlook({
      saveId: "save-z",
      seasonId: "season-3",
      seasonState,
      offerTermSeasons: [1, 3, 2],
    })!;
    const html = renderToStaticMarkup(<SponsorSalaryFactorPanel outlook={outlook} />);
    expect(html).toContain("je nach Angebot bindet eine Unterschrift 1 bis 3 Saisons");
    expect(html).not.toContain("bindet sich an alle 3");
  });
});

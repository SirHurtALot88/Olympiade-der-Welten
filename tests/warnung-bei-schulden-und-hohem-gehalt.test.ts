/**
 * FRÜHWARNUNG FÜR TEAMS MIT KREDITSCHULDEN UND HOHER GEHALTSLAST — Chris: „die teams mit krediten
 * wie M-M müssen ja aufpassen wenn sie so hohes gehalt haben dass es nicht immer so weiter geht.
 * da muss dann quasi ne warnung irgendwie kommen die der AI sagt ok es kann sein dass wir eher
 * spieler verkaufen müssen am ende der season weil wir schulden haben und sehr hohes gehalt."
 *
 * ALLE ZAHLEN HIER SIND AM LIVE-ABBILD GEMESSEN (Saison 2, Phase season_completed, 32 Teams):
 * 14 Teams trugen Restschuld, 10 davon hätten die nächste Saisonend-Abbuchung (Gehalt + Kreditrate)
 * nicht aus Cash + Umsatz decken können. Der bestehende `cashPressureScore` stand bei acht dieser
 * Teams gleichzeitig auf 1,00 (Kasse leer) — er konnte Mayhem Mavericks (es fehlen 51,8) nicht von
 * Vigorous Vikings (es fehlen 1,4) unterscheiden. Genau diese Unterscheidung liefert das neue
 * Signal, und dieser Test hält sie fest.
 */
import { describe, expect, it } from "vitest";

import {
  buildSchuldenlastFruehwarnung,
  resolveSchuldenlastDruck,
} from "@/lib/ai/schuldenlast-fruehwarnung";
import { assessTeamSellRunwayPressure } from "@/lib/ai/team-sell-runway-pressure";
import {
  resolveEffectiveSellThreshold,
  selectCompositeSellCandidates,
} from "@/lib/ai/ai-composite-sell-score";
import type { GameState } from "@/lib/data/olyDataTypes";

describe("Das Signal braucht BEIDE Seiten — Schulden UND ungedeckte Gehaltslast", () => {
  it("Schulden mit schlankem Gehalt lösen nichts aus (Riptide Rivers, gemessen)", () => {
    // Restschuld 8,3 und Rate 9,1 — aber Umsatz 52,5 deckt Gehalt 41,3 + Rate locker (+25,1 übrig).
    const { score } = resolveSchuldenlastDruck({ cash: 23, salaryTotal: 41.3, schuld: 8.3, kreditrate: 9.1, umsatz: 52.5 });
    expect(score).toBe(0);
  });

  it("hohes Gehalt ohne Schulden löst nichts aus — die Kredit-Tür steht solchen Teams noch offen", () => {
    // Fiktiv zugespitzt: riesiges Defizit, aber keine Restschuld → voller Kreditrahmen, kein
    // Distress-Gate. Das Team kann sich per Kredit befreien und braucht keine Verkaufs-Frühwarnung.
    const { score } = resolveSchuldenlastDruck({ cash: 0, salaryTotal: 100, schuld: 0, kreditrate: 0, umsatz: 40 });
    expect(score).toBe(0);
  });

  it("erst beides zusammen warnt (Mayhem Mavericks, gemessen)", () => {
    const { score, fehlbetrag } = resolveSchuldenlastDruck({
      cash: 0,
      salaryTotal: 107.7,
      schuld: 90.2,
      kreditrate: 32.7,
      umsatz: 88.6,
    });
    expect(fehlbetrag).toBe(51.8);
    expect(score).toBe(0.369);
  });

  it("auch ein Team, dessen Kredite schon geplatzt sind (Rate 0), wird gewarnt", () => {
    // Geplatzte Kredite buchen keine Rate mehr ab — aber die Restschuld sperrt Neuaufnahme
    // (Distress-Gate) und mindert die Kapazität. Wer so dasteht, sitzt am tiefsten in der Falle.
    const { score } = resolveSchuldenlastDruck({ cash: 2, salaryTotal: 80, schuld: 50, kreditrate: 0, umsatz: 60 });
    expect(score).toBeGreaterThan(0);
  });
});

describe("Die Kernzusicherung: das Signal UNTERSCHEIDET, statt alle gleich laut anzuschreien", () => {
  /**
   * Die komplette Liga vom Live-Abbild: [cash, gehalt, schuld, rate, umsatz] je Team. Die alte
   * Cash-Druck-Formel scheiterte genau hier (31 von 32 bei ≥0,92) — deshalb wird die Verteilung
   * des NEUEN Signals über den ECHTEN Stand festgenagelt, nicht über handgebaute Extremfälle.
   */
  const liga: Array<[string, number, number, number, number, number]> = [
    ["M-M", 0, 107.7, 90.2, 32.7, 88.6],
    ["H-R", 0, 97.7, 65.5, 24.7, 95],
    ["D-P", 0, 63.6, 56.2, 18.1, 56.1],
    ["L-K", 0, 68, 31.2, 10.3, 61.1],
    ["W-L", 0, 75.9, 40.6, 14, 75.6],
    ["P-C", 0, 66, 44.4, 15, 67.5],
    ["B-B", 5, 58.3, 12.3, 11.9, 52.6],
    ["T-T", 0, 72, 20.5, 6.7, 72.4],
    ["Z-H", 8, 84.8, 43, 23.2, 96.4],
    ["V-V", 0, 56.8, 4.7, 1.7, 57.1],
    ["V-D", 5, 59.6, 14.8, 17, 73.8],
    ["R-C", 0, 55, 16.7, 5.6, 64.3],
    ["A-A", 16.7, 57.6, 27.9, 17.7, 65.8],
    ["R-R", 23, 41.3, 8.3, 9.1, 52.5],
    ["R-L", 13.6, 78.8, 0, 0, 71.7],
    ["N-W", 23.1, 63, 0, 0, 48.3],
    ["P-S", 8.5, 86.1, 0, 0, 91.5],
    ["V-W", 17.1, 51.9, 0, 0, 53],
    ["B-P", 5.7, 80.8, 0, 0, 98.4],
    ["T-C", 16.4, 48, 0, 0, 56.1],
    ["D-L", 22.2, 41.1, 0, 0, 45.8],
    ["N-N", 21.5, 79.3, 0, 0, 86.4],
    ["U-A", 18.2, 38, 0, 0, 52.2],
    ["S-C", 23.7, 53.9, 0, 0, 66.6],
    ["G-G", 35.6, 62.7, 0, 0, 66.3],
    ["S-S", 15.9, 64.4, 0, 0, 88.5],
    ["L-R", 20.6, 74.7, 0, 0, 95.6],
    ["M-S", 24.7, 56.5, 0, 0, 73.4],
    ["T-G", 32.4, 61.6, 0, 0, 72.1],
    ["C-S", 21.7, 63.6, 0, 0, 90.4],
    ["W-W", 41.1, 57.1, 0, 0, 64.6],
    ["C-C", 39.2, 42.5, 0, 0, 53.5],
  ];
  const scores = new Map(
    liga.map(([id, cash, salaryTotal, schuld, kreditrate, umsatz]) => [
      id,
      resolveSchuldenlastDruck({ cash, salaryTotal, schuld, kreditrate, umsatz }).score,
    ]),
  );

  it("nur eine Minderheit der Liga schlägt an — 8 von 32, nicht fast alle", () => {
    const aktiv = [...scores.values()].filter((score) => score > 0);
    expect(aktiv).toHaveLength(8);
  });

  it("die aktiven Teams sind untereinander unterscheidbar, M-M ist am lautesten", () => {
    const aktiv = [...scores.entries()].filter(([, score]) => score > 0);
    // Kein einziger Doppelwert: jedes gewarnte Team hat seine eigene Dringlichkeit.
    expect(new Set(aktiv.map(([, score]) => score)).size).toBe(aktiv.length);
    const lautestes = aktiv.sort((a, b) => b[1] - a[1])[0]!;
    expect(lautestes[0]).toBe("M-M");
    expect(lautestes[1]).toBe(0.369);
    // Und die Spanne ist echt (0,08 bis 0,369), kein Zusammenkleben an einem Ende.
    expect(Math.max(...aktiv.map(([, s]) => s)) / Math.min(...aktiv.map(([, s]) => s))).toBeGreaterThan(3);
  });

  it("verschuldete Teams mit gedeckter Abbuchung bleiben still (A-A, R-C, R-R, V-D, gemessen)", () => {
    for (const id of ["A-A", "R-C", "R-R", "V-D"]) {
      expect(scores.get(id)).toBe(0);
    }
  });

  it("die Bagatellgrenze (Notverkaufs-Reserve, 5 % der Gehaltslast) filtert Schätzrauschen (Z-H, V-V)", () => {
    // Zero Heroes fehlen 3,6 bei Grenze 4,24, Vigorous Vikings 1,4 bei 2,84 — beides liegt im
    // Schätzfehler des Umsatz-Proxys und darf keine Verkaufswelle anstoßen.
    expect(scores.get("Z-H")).toBe(0);
    expect(scores.get("V-V")).toBe(0);
  });

  it("ein Team, das schon im Minus steht, wird dringlicher, nicht leiser", () => {
    const beiNull = resolveSchuldenlastDruck({ cash: 0, salaryTotal: 80, schuld: 40, kreditrate: 15, umsatz: 70 });
    const imMinus = resolveSchuldenlastDruck({ cash: -20, salaryTotal: 80, schuld: 40, kreditrate: 15, umsatz: 70 });
    expect(imMinus.fehlbetrag).toBeGreaterThan(beiNull.fehlbetrag);
    expect(imMinus.score).toBeGreaterThan(beiNull.score);
  });
});

describe("Der Builder liest die Schuldenlage aus dem Spielstand", () => {
  const mitKrediten = {
    season: { id: "season-2" },
    transferHistory: [],
    teams: [{ teamId: "M-M", name: "Mayhem Mavericks", cash: 0 }],
    teamIdentities: [],
    seasonState: {
      loans: [
        { loanId: "a", borrowerTeamId: "M-M", status: "active", principalOutstanding: 60, installmentPerSeason: 22, interestRatePerSeason: 0.1 },
        { loanId: "b", borrowerTeamId: "M-M", status: "defaulted", principalOutstanding: 30.2, installmentPerSeason: 10.7, interestRatePerSeason: 0.12 },
        // Fremder und getilgter Kredit dürfen NICHT mitzählen.
        { loanId: "c", borrowerTeamId: "X-X", status: "active", principalOutstanding: 99, installmentPerSeason: 9, interestRatePerSeason: 0.1 },
        { loanId: "d", borrowerTeamId: "M-M", status: "paid", principalOutstanding: 0, installmentPerSeason: 5, interestRatePerSeason: 0.1 },
      ],
      sponsorPayoutLogs: [
        { teamId: "M-M", seasonId: "season-1", componentId: "base", cashDelta: 88.6 },
      ],
    },
  } as unknown as GameState;

  it("Restschuld inkl. geplatzter Kredite, Rate nur aus aktiven — dieselbe Sicht wie die Kreditkapazität", () => {
    const warnung = buildSchuldenlastFruehwarnung(mitKrediten, "M-M", { cash: 0, salaryTotal: 107.7 });
    expect(warnung.schuld).toBe(90.2);
    expect(warnung.kreditrate).toBe(22);
    expect(warnung.umsatz).toBe(88.6);
    expect(warnung.score).toBeGreaterThan(0);
  });

  it("ohne seasonState (Tests, reparierte Spielstände) fällt er still auf 0, statt abzustürzen", () => {
    const kahl = { season: { id: "season-2" }, teams: [], teamIdentities: [] } as unknown as GameState;
    expect(buildSchuldenlastFruehwarnung(kahl, "M-M", { cash: 0, salaryTotal: 100 }).score).toBe(0);
  });

  it("assessTeamSellRunwayPressure trägt die Frühwarnung nach draußen — getrennt vom Cash-Druck", () => {
    const result = assessTeamSellRunwayPressure({
      gameState: mitKrediten,
      team: mitKrediten.teams[0]!,
      salaryTotal: 107.7,
    });
    // Beide Signale koexistieren: der Cash-Druck sieht die leere Kasse von heute, die Frühwarnung
    // die ungedeckte Abbuchung von morgen. Wären sie verrechnet, ginge die Unterscheidung der
    // Kasse-leer-Teams sofort wieder verloren.
    expect(result.cashPressureScore).toBe(1);
    expect(result.schuldenlast.score).toBeGreaterThan(0);
    expect(result.schuldenlast.fehlbetrag).toBeGreaterThan(0);
  });
});

describe("Die Frühwarnung erhöht Verkaufsbereitschaft, erzwingt aber nie einen Verkauf", () => {
  it("sie senkt die Verkaufsschwelle graduell mit demselben Hebel wie der Cash-Druck", () => {
    const ohne = resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 0 });
    const mit = resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 0, schuldenlastScore: 0.369 });
    expect(ohne).toBe(30);
    expect(mit).toBe(27);
  });

  /**
   * HIER STAND EINE ZUSICHERUNG, DIE DAS SIGNAL WIRKUNGSLOS MACHTE: „der Floor bleibt der Floor —
   * auch beide Signale zusammen reißen ihn nicht", geprüft mit `toBe(22)`.
   *
   * Am Spielstand nachgemessen war das keine Sicherheitsleine, sondern der Grund, warum gar nichts
   * passierte. Der Cash-Druck zieht bereits −8 ab, und 30 − 8 = 22 IST der Floor. Jedes Team mit
   * leerer Kasse steht damit schon dort — und das sind exakt die Teams, um die es geht: ALLE ACHT
   * gewarnten Teams lagen bei Cash-Druck ≥ 0,95. Mayhem Mavericks verkaufte mit Warnung genau
   * dasselbe wie ohne (ein Spieler, Deckungslücke −0,4).
   */
  it("bei leerer Kasse senkt sie den Floor mit — sonst wäre sie dort wirkungslos", () => {
    // Der Fall, um den es geht: Cash-Druck steht schon auf 1, die Schwelle liegt schon am Floor.
    const nurCashDruck = resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 1 });
    expect(nurCashDruck).toBe(22);

    // M-M am gemessenen Stand (0,369) — die Schwelle geht unter den bisherigen Floor.
    expect(
      resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 1, schuldenlastScore: 0.369 }),
    ).toBe(19);
  });

  it("tiefer als das aggressivste Verkaufsprofil geht auch die lauteste Warnung nicht", () => {
    // 18 ist keine neue Zahl: es ist der Floor, den `flip_shop` ohnehin schon hat.
    expect(
      resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 1, schuldenlastScore: 1 }),
    ).toBe(18);
    expect(resolveEffectiveSellThreshold({ teamProfile: "flip_shop", cashPressureScore: 1 })).toBe(18);
  });

  it("ohne Warnung bleibt jeder Floor exakt da, wo er war", () => {
    expect(resolveEffectiveSellThreshold({ teamProfile: "default", cashPressureScore: 1 })).toBe(22);
    expect(resolveEffectiveSellThreshold({ teamProfile: "harmony", cashPressureScore: 1 })).toBe(22);
    expect(resolveEffectiveSellThreshold({ teamProfile: "flip_shop", cashPressureScore: 1 })).toBe(18);
  });

  it("die Auswahl läuft weiter, bis die kommende Abbuchung gedeckt ist (M-M-Zahlen)", () => {
    // Sechs gleichwertige Kandidaten über der Schwelle: Erlös 12, Gehalt 8.
    const kandidaten = Array.from({ length: 6 }, (_, index) => ({
      candidate: { id: `p${index}`, expectedSellValue: 12, salary: 8, expectedSalary: 8 },
      score: 60 - index,
    }));
    const basis = {
      candidates: kandidaten,
      teamCash: 0,
      teamSalaryTotal: 107.7,
      cashPressureScore: 1,
      teamProfile: "default" as const,
    };
    // Ohne Frühwarnung stoppt die Schleife bei „Kasse positiv plus Reserve": zwei Verkäufe.
    const ohne = selectCompositeSellCandidates(basis);
    expect(ohne).toHaveLength(2);
    // Mit Frühwarnung läuft sie weiter, bis Cash + Umsatz die Abbuchung (Gehalt + Rate) deckt —
    // ein Verkauf hilft doppelt (Erlös rein, Gehalt raus), deshalb reicht genau einer mehr.
    const mit = selectCompositeSellCandidates({
      ...basis,
      schuldenlast: { score: 0.369, kreditrate: 32.7, umsatz: 88.6 },
    });
    expect(mit).toHaveLength(3);
  });

  it("der hardMin-Schutz bleibt unangetastet — ohne Cash-Notfall kein Verkauf unters Minimum", () => {
    const kandidaten = [{ candidate: { id: "p0", expectedSellValue: 12, salary: 8, expectedSalary: 8 }, score: 60 }];
    const selektiert = selectCompositeSellCandidates({
      candidates: kandidaten,
      teamCash: 20,
      teamSalaryTotal: 60,
      cashPressureScore: 0.2,
      teamProfile: "default",
      hardMin: 12,
      rosterCount: 12,
      schuldenlast: { score: 0.3, kreditrate: 10, umsatz: 40 },
    });
    expect(selektiert).toHaveLength(0);
  });
});

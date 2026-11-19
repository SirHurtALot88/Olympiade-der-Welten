/**
 * FENSTER AUF OPT (Chris 18.11.: „Nein, man darf alle Spieler verkaufen, auch unter Minimum. Die KI soll danach ja einfach auf
 * Optimum füllen! Die Kader können nicht einfach mit 8–9 Leuten fertig sein, dann sind die Roster zu star-lastig.“),
 * `docs/design/fenster-auf-opt-18-11.md`.
 *
 * Regeln, je eine Pruefung:
 *  1. Schalter: Standard AN (nur mit gemeinsamem Fenster), `OLY_FENSTER_AUF_OPT=0` stellt den Stand von #1634 her.
 *  2. Review S3: der Kaderplan reserviert die GEHALTS-Seite der Plaetze bis Opt (gegen die Kaderpflicht-Grenze bzw. den
 *     Gehaltstopf) — ein Star, dessen Gehalt die uebrigen Plaetze unbezahlbar machte, wird nicht gekauft; der Kader erreicht Opt.
 *  3. Ohne Gehaltsgrenze (Saison 1) aendert die Gehaltsreserve nichts an der Planung.
 *  4. Verkaufsrunde: frei verkaufen (Grenze max(8, playerMin) nur im alten Stand).
 *  5. Kaufrunde und Nachrunde im Fenster laufen ueber den organischen Planer (Kauffenster-Sitzung), nicht ueber den Marktplan.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildOrganicSquadPlan,
  createOrganicPlanStepState,
  KADERPLAN_PLATZ_MIN_MW,
  kaderplanRahmen,
  type OrganicSquadPlanInput,
} from "@/lib/ai/organic-squad/draft-builder";
import { buildOrganicDraftFrame } from "@/lib/ai/organic-squad/draft-adapter";
import type { CoreAxis, OrganicDiscipline, OrganicPlayerView } from "@/lib/ai/organic-squad/types";
import { createGameStateFromSeed, loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";
import { istFensterAufOpt } from "@/lib/market/transferfenster-gemeinsam";

const SCHALTER = ["OLY_FENSTER_AUF_OPT", "OLY_TRANSFERFENSTER_GEMEINSAM", "NEXT_PUBLIC_OLY_TRANSFERFENSTER_GEMEINSAM"] as const;
const vorher = Object.fromEntries(SCHALTER.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of SCHALTER) {
    if (vorher[name] === undefined) delete process.env[name];
    else process.env[name] = vorher[name];
  }
});

const DISCIPLINES: OrganicDiscipline[] = [
  { id: "tdm", category: "power" },
  { id: "tennis", category: "mental" },
  { id: "spurt", category: "speed" },
];
const AXIS: Record<CoreAxis, number> = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 };

/** Spieler mit Qualitaet, die mit dem Preis steigt (ein Star ist klar besser als ein 12er). */
function spieler(id: string, wert: number, gehalt: number): OrganicPlayerView {
  const q = 35 + wert * 0.6;
  return {
    playerId: id,
    pow: q, spe: q, men: q, soc: q,
    disciplineRatings: { tdm: q, tennis: q, spurt: q },
    marketValue: wert,
    salary: gehalt,
  };
}

/** Kader 8, Opt 12, Kasse reichlich; der Gehaltsrahmen traegt genau vier Plaetze zu je 3 (12er) — oder einen Star. */
function fall(gehaltsGrenze: { art: "topf" | "kaufGrenze"; frei: number }): OrganicSquadPlanInput {
  const startingSquad = Array.from({ length: 8 }, (_, i) => spieler(`s${i}`, 20, 4));
  const candidates: OrganicPlayerView[] = [
    spieler("star", 70, 9),
    ...Array.from({ length: 12 }, (_, i) => spieler(`platz${i}`, 12 + i * 0.5, 3)),
    ...Array.from({ length: 6 }, (_, i) => spieler(`fueller${i}`, 4 + i, 1)),
  ];
  const weights = deriveUtilityWeights({ ambition: 80, finances: 50, boardConfidence: 50, harmony: 50, playerOpt: 12 }, {});
  return {
    startingSquad,
    candidates,
    identityAxisWeights: AXIS,
    disciplines: DISCIPLINES,
    economy: {
      cash: 500,
      cashBuffer: 12,
      salaryTotal: 32,
      boardRisk: 0.3,
      expectedPrize: 0,
      sponsorIncome: 0,
      facilityNet: 0,
      netTransfer: 0,
      solvencyFloor: 12,
      weights,
      ...(gehaltsGrenze.art === "topf"
        ? { feeCap: 400, salaryCap: gehaltsGrenze.frei }
        : {
            feeCap: 400,
            salaryCap: gehaltsGrenze.frei,
            kaufGrenze: (_roster: number, spentFee: number, spentSalary: number) => ({
              fee: 400 - spentFee,
              salary: gehaltsGrenze.frei - spentSalary,
            }),
          }),
    },
    draftSeed: "fenster-auf-opt",
    kaderplan: { gmOptGesenkt: false },
  };
}

describe("Schalter Fenster auf Opt", () => {
  it("Standard an, `OLY_FENSTER_AUF_OPT=0` aus, ohne gemeinsames Fenster aus", () => {
    for (const name of SCHALTER) delete process.env[name];
    expect(istFensterAufOpt()).toBe(true);
    process.env.OLY_FENSTER_AUF_OPT = "0";
    expect(istFensterAufOpt()).toBe(false);
    delete process.env.OLY_FENSTER_AUF_OPT;
    process.env.OLY_TRANSFERFENSTER_GEMEINSAM = "0";
    expect(istFensterAufOpt()).toBe(false);
  });
});

describe("Review S3: der Kaderplan reserviert die Gehaltsseite der Plaetze bis Opt", () => {
  for (const art of ["topf", "kaufGrenze"] as const) {
    it(`Gehaltsrahmen fuer vier Plaetze (${art}): kein Star, der die Plaetze auffrisst; Kader 12, keine Fueller, Rahmen gehalten`, () => {
      const input = fall({ art, frei: 12 });
      expect(input.economy.weights.optTarget).toBe(12);
      const plan = buildOrganicSquadPlan(input);
      const neu = plan.finalSquad.slice(8);
      expect(plan.finalSquad.length).toBeGreaterThanOrEqual(12);
      expect(neu.map((s) => s.playerId)).not.toContain("star");
      for (const s of neu.slice(0, 4)) expect(s.marketValue).toBeGreaterThanOrEqual(KADERPLAN_PLATZ_MIN_MW);
      const gehaltNeu = neu.slice(0, 4).reduce((sum, s) => sum + s.salary, 0);
      expect(gehaltNeu).toBeLessThanOrEqual(12 + 1e-9);
      expect(plan.kaderplan?.notwege ?? []).toEqual([]);
    });
  }

  it("der Rahmen meldet das reservierte Gehalt und zaehlt nur die Plaetze, die der Gehaltsrahmen traegt", () => {
    // Rahmen fuer vier Plaetze zu je 3: nach dem ersten Kauf bleiben drei reserviert (9).
    const weit = kaderplanRahmen(fall({ art: "kaufGrenze", frei: 12 }), createOrganicPlanStepState(fall({ art: "kaufGrenze", frei: 12 })));
    expect(weit.plaetze).toBe(12);
    expect(weit.reserveGehalt).toBeCloseTo(9, 6);
    // Rahmen fuer nur zwei 12er-Plaetze: dieser Kauf zum Platzpreis (3), die drei uebrigen Plaetze bis Opt plant der Rahmen mit den
    // billigsten Spielern (je 1) — Tiefe vor Qualitaet, kein Notweg. Zum Platzpreis traegt er also nur diesen Kauf (Kader 9).
    const eng = kaderplanRahmen(fall({ art: "kaufGrenze", frei: 6 }), createOrganicPlanStepState(fall({ art: "kaufGrenze", frei: 6 })));
    expect(eng.plaetze).toBe(9);
    expect(eng.reserveGehalt).toBeCloseTo(3, 6);
    expect(eng.fuellerSperre).toBe(false);
  });

  it("ohne Gehaltsgrenze (Saison 1) aendert die Gehaltsreserve nichts an Plaetzen und Ablose-Reserve", () => {
    const ohneGrenze = (faktor: number): OrganicSquadPlanInput => {
      const input = fall({ art: "topf", frei: 0 });
      return {
        ...input,
        candidates: input.candidates.map((s) => ({ ...s, salary: s.salary * faktor })),
        economy: { ...input.economy, feeCap: undefined, salaryCap: undefined, kaufGrenze: undefined },
      };
    };
    const a = kaderplanRahmen(ohneGrenze(1), createOrganicPlanStepState(ohneGrenze(1)));
    const b = kaderplanRahmen(ohneGrenze(25), createOrganicPlanStepState(ohneGrenze(25)));
    expect(b.plaetze).toBe(a.plaetze);
    expect(b.reserve).toBe(a.reserve);
    expect(b.fuellerSperre).toBe(a.fuellerSperre);
  });
});

describe("Fenster-Ablauf (Quellpruefung)", () => {
  const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

  it("Verkaufsrunde: frei verkaufen, die Minimum-Grenze nur im alten Stand", () => {
    const sitzung = quelle("lib/ai/ai-transfer-window-session-service.ts");
    expect(sitzung).toContain('sellNotBelowMin: input.phase === "fenster_verkauf" && !istFensterAufOpt(),');
  });

  it("Kauf- und Nachrunde laufen ueber die Kauffenster-Sitzung (organischer Planer), der Marktplan nur im alten Stand", () => {
    const dienst = quelle("lib/ai/ai-preseason-background-service.ts");
    const neu = dienst.slice(dienst.indexOf("if (gemeinsamesFenster && istFensterAufOpt()) {"), dienst.indexOf("} else {\n      kreditPass();"));
    expect(neu).toContain('phase: "preseason"');
    expect(neu).toContain("runTransferWindowSession({");
    expect(neu).toContain("const nachrunde = await fensterKauf();");
    expect(neu).not.toContain("applyAiMarketPlanLocally");
    // Kein Notkauf, kein Auffuellen mit Billigst-Spielern: der Fuell-Dienst bleibt draussen.
    expect(neu).not.toContain("roster-fill");
    expect(neu).not.toContain("autoRosterFill");
  });

  it("der Kassensturz bleibt: Notverkauf nie unter 8, nur KI-Teams", () => {
    const kassensturz = quelle("lib/ai/ki-kassensturz.ts");
    expect(kassensturz).toContain("export const KASSENSTURZ_NOTVERKAUF_KADER_MIN = 8;");
    expect(kassensturz).toContain("if (!kiTeams.has(team.teamId) || team.cash >= -0.01) continue;");
    const dienst = quelle("lib/ai/ai-preseason-background-service.ts");
    expect(dienst).toContain("fuehreKiKassensturzAus({ saveId, seasonId, aiTeamIds, persistence })");
  });
});

describe("Hebel (b): traegt der Rahmen Opt nur mit Fuellern, senkt der GM das Ziel (hoechstens −2, nie unter Minimum + 1)", () => {
  // Echter Saison-1-Pool, Team mit 8 Spielern (aus dem oberen Mittelfeld), Kasse unterschiedlich gross.
  function frame(saison: string, cash: number) {
    const gs0 = createGameStateFromSeed(loadFreshSeasonOneSeedData());
    const team = { ...gs0.teams[0]!, cash };
    const sortiert = [...gs0.players].sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0));
    const gs = {
      ...gs0,
      season: { ...gs0.season, id: saison },
      teams: gs0.teams.map((t) => (t.teamId === team.teamId ? team : t)),
    };
    return buildOrganicDraftFrame({
      gameState: gs,
      team,
      identity: (gs.teamIdentities ?? []).find((i) => i.teamId === team.teamId) ?? null,
      startingSquad: sortiert.slice(sortiert.length - 200, sortiert.length - 192),
      candidates: sortiert.slice(0, sortiert.length - 200),
      draftSeed: "hebel-b",
    });
  }

  it("Fenster ab Saison 2: knappe Kasse senkt das Ziel, mit Protokollgrund; reiche Kasse nicht", () => {
    for (const name of SCHALTER) delete process.env[name];
    const knapp = frame("season-2", 40);
    const mittel = frame("season-2", 75);
    const reich = frame("season-2", 500);
    const ident = reich.optEntscheidung!.identitaetsOpt;
    expect(reich.optTarget).toBe(ident);
    expect(mittel.optTarget).toBeLessThan(ident);
    expect(knapp.optTarget).toBeLessThanOrEqual(mittel.optTarget);
    for (const f of [knapp, mittel]) {
      expect(f.optTarget).toBeGreaterThanOrEqual(Math.max(ident - 2, Math.min(ident, 9)));
      expect(f.optEntscheidung!.grund).toContain("nur mit Fuellern");
      // Der Builder haelt am gesenkten Ziel an (wie bei der GM-Senkung nach Neigung).
      expect(f.planInput.kaderplan?.gmOptGesenkt).toBe(true);
    }
  });

  it("Saison 1 und der alte Stand (`OLY_FENSTER_AUF_OPT=0`) senken nicht", () => {
    for (const name of SCHALTER) delete process.env[name];
    const s1 = frame("season-1", 40);
    expect(s1.optTarget).toBe(s1.optEntscheidung!.identitaetsOpt);
    process.env.OLY_FENSTER_AUF_OPT = "0";
    const alt = frame("season-2", 40);
    expect(alt.optEntscheidung).toBeUndefined();
  });
});

describe("Feinschliff 19.11.: Plaetze ueber dem Minimum nur aus Kasse ueber der Notruecklage", () => {
  // Kader 4 (Minimum 8), Opt 9, Kasse 80, Notruecklage 10. Ein Star (30) plus vier 12er passte in die Kasse (78) — aber nur, wenn
  // der 9. Platz aus der Notruecklage bezahlt wird. Mit Notruecklage plant der Rahmen den 9. Platz aus Kasse ueber der Ruecklage.
  function fallNr(notruecklage: number | undefined): OrganicSquadPlanInput {
    const startingSquad = Array.from({ length: 4 }, (_, i) => spieler(`s${i}`, 20, 3));
    const candidates: OrganicPlayerView[] = [
      { ...spieler("star", 30, 3), pow: 99, spe: 99, men: 99, soc: 99, disciplineRatings: { tdm: 99, tennis: 99, spurt: 99 } },
      ...Array.from({ length: 10 }, (_, i) => spieler(`platz${i}`, 12 + i * 0.1, 3)),
    ];
    const weights = deriveUtilityWeights({ ambition: 80, finances: 50, boardConfidence: 50, harmony: 50, playerOpt: 9 }, {});
    return {
      startingSquad,
      candidates,
      identityAxisWeights: AXIS,
      disciplines: DISCIPLINES,
      economy: {
        cash: 80, cashBuffer: 2, salaryTotal: 12, boardRisk: 0.3, expectedPrize: 0, sponsorIncome: 0, facilityNet: 0, netTransfer: 0,
        solvencyFloor: 2, weights, notruecklage,
      },
      draftSeed: "nr",
      kaderplan: { gmOptGesenkt: true },
    };
  }

  it("mit Notruecklage: Ziel 9 erreicht, Kasse nicht unter der Ruecklage; ohne: Star frisst den 9. Platz (Muster V-V)", () => {
    const mit = buildOrganicSquadPlan(fallNr(10));
    expect(mit.finalSquad.length).toBeGreaterThanOrEqual(9);
    expect(mit.finalCash).toBeGreaterThanOrEqual(10 - 1e-9);
    const ohne = buildOrganicSquadPlan(fallNr(undefined));
    expect(ohne.finalSquad.map((s) => s.playerId)).toContain("star");
    expect(ohne.finalSquad.length).toBe(8);
  });

  it("bis zum Minimum darf die Notruecklage angegriffen werden", () => {
    const input = fallNr(10);
    const knapp: OrganicSquadPlanInput = { ...input, economy: { ...input.economy, cash: 52 } };
    const plan = buildOrganicSquadPlan(knapp);
    // 4 x 12 = 48 bringt den Kader auf 8 (Minimum), Kasse 4 < Ruecklage 10 — erlaubt; der 9. Platz kommt nicht mehr.
    expect(plan.finalSquad.length).toBe(8);
  });
});

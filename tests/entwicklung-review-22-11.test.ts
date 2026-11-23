import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { GameState, Player, TrainingsSpieltagEintrag } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildPlayerSeasonTrainingForecast } from "@/lib/foundation/player-matchday-training-history";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import { entwicklungsRegelSchalter, entwicklungsRegelFuer } from "@/lib/resolve/entwicklung-regel";
import { trainingJeSpieltagFuer } from "@/lib/training/training-je-spieltag-schalter";
import { ENTWICKLUNGS_PARAMETER_STANDARD, entwicklungsParameter, setzeEntwicklungsParameterFuerMessung } from "@/lib/training/entwicklung-neu";
import { getTrainingModeBiasScores } from "@/lib/training/training-mode-demand-service";

// Der PP-Index kommt im Test aus einer Vorgabe (kein echtes Punktebuch noetig); ohne Vorgabe der echte.
const halter: { index: import("@/lib/training/entwicklung-tag").PpTagesIndex | null } = { index: null };
vi.mock("@/lib/training/entwicklung-tag", async (importOriginal) => {
  const echt = await importOriginal<typeof import("@/lib/training/entwicklung-tag")>();
  return { ...echt, ppTagesIndex: (gs: GameState) => halter.index ?? echt.ppTagesIndex(gs) };
});

import {
  baueLeistungsErwartung,
  leistungFuerTag,
  leistungsErwartungJeTag,
  mittleresZJeEinsatz,
  ppAbstandFuerEinsatz,
  ppHashFuerTag,
  type PpTagesIndex,
} from "@/lib/training/entwicklung-tag";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";
import { buildOrganicSeasonProgression, buildProjectedSeasonTrainingAccumulatorOverrides } from "@/lib/training/organic-season-progression";
import { setzeTrainingsZiel } from "@/lib/training/spieltag-training";

/**
 * REVIEW-FIXES ZU PR #1696 (22.11., docs/design/entwicklung-balance-22-11.md Abschnitt 8.8): L je Einsatz, negative Grenzen,
 * Rueckweg nur ueber den Stempel, forceReplace mit neuem PP, Erwartung aus der Vorsaison, offene Spieltage, Messhebel.
 */

const IDS = Array.from({ length: 20 }, (_, i) => `md-${i + 1}`);
let BASIS: GameState;
let SPIELER_ID: string;

beforeAll(() => {
  const voll = createSingleplayerGameState();
  const teams = [...new Set(voll.rosters.map((r) => r.teamId))].slice(0, 2);
  const rosters = voll.rosters.filter((r) => teams.includes(r.teamId));
  const imKader = new Set(rosters.map((r) => r.playerId));
  const seasonId = voll.season.id;
  BASIS = {
    ...voll,
    scenarioMeta: { ...(voll.scenarioMeta ?? {}), gameMode: "battle" },
    teams: voll.teams.filter((t) => teams.includes(t.teamId)),
    rosters,
    players: voll.players.filter((p) => imKader.has(p.id)).map((p) => ({ ...p, trainingMode: "mittel" as const, fatigue: 0 })),
    season: { ...voll.season, matchdayIds: IDS, totalMatchdays: 20 },
    seasonState: { ...voll.seasonState, seasonId, entwicklungsRegel: { seasonId, regel: "neu" } },
  } as unknown as GameState;
  SPIELER_ID = rosters[0]!.playerId;
}, 60_000);

const ENV = { ent: process.env.OLY_ENTWICKLUNG, je: process.env.OLY_TRAINING_JE_SPIELTAG, par: process.env.OLY_ENT_PARAMS };
afterEach(() => {
  for (const [k, v] of [["OLY_ENTWICKLUNG", ENV.ent], ["OLY_TRAINING_JE_SPIELTAG", ENV.je], ["OLY_ENT_PARAMS", ENV.par]] as const) {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  }
  halter.index = null;
  setzeEntwicklungsParameterFuerMessung(null);
});

const spieler = (gs: GameState, id = SPIELER_ID): Player => gs.players.find((p) => p.id === id)!;
const attr = (p: Player, a: (typeof PROGRESSION_ATTRIBUTE_ORDER)[number]) => Number(p.attributeSheetStats?.[a]);
const buche = (gs: GameState, matchdayId: string) =>
  accumulateMatchdayTrainingProgress({ gameState: gs, seasonId: gs.season.id, matchdayId, ausfallSpielerIds: new Set() });
const summe = (w: Record<string, number | undefined> | undefined) => Object.values(w ?? {}).reduce((a, b) => a + (b ?? 0), 0);
const mk = (id: string, extra: Partial<Player> = {}) => ({ id, traitsPositive: [], ...extra }) as unknown as Player;

function index(tage: Record<string, { liga?: string; median: Record<string, number>; spieler: Record<string, Record<string, number>> }>): PpTagesIndex {
  return {
    seasonId: "season-1",
    tage: new Map(
      Object.entries(tage).map(([m, t]) => [
        m,
        {
          median: new Map(Object.entries(t.median).map(([d, w]) => [`${t.liga ?? "l1"}|${d}`, w])),
          spieler: new Map(Object.entries(t.spieler).map(([id, d]) => [id, { liga: t.liga ?? "l1", jeDisziplin: new Map(Object.entries(d)) }])),
        },
      ]),
    ),
  };
}

describe("Fix 1: L je Einsatz gegen den Median der eigenen Disziplin", () => {
  const idx = index({
    "md-1": {
      median: { gewichtheben: 2, tennis: 20 },
      spieler: {
        einer: { gewichtheben: 5 },
        beide: { gewichtheben: 5, tennis: 20 },
        schwachInTennis: { gewichtheben: 5, tennis: 14 },
      },
    },
  });
  const l = (id: string) => leistungFuerTag({ index: idx, matchdayId: "md-1", player: mk(id), verlauf: undefined });

  it("wer nur eine Disziplin spielt, wird nicht bestraft: ein zusaetzlicher Einsatz auf dem Median aendert L nicht", () => {
    expect(summe(l("einer"))).toBeGreaterThan(0);
    expect(summe(l("beide"))).toBeCloseTo(summe(l("einer")), 8);
  });

  it("jeder Einsatz zaehlt gegen den Median SEINER Disziplin (Tennis mit anderer PP-Streuung mischt sich nicht in Gewichtheben)", () => {
    expect(ppAbstandFuerEinsatz(idx, "md-1", "beide", "tennis")).toBe(0);
    expect(ppAbstandFuerEinsatz(idx, "md-1", "schwachInTennis", "tennis")).toBe(-6);
    expect(ppAbstandFuerEinsatz(idx, "md-1", "einer", "tennis")).toBeNull();
    // Der schwache Tennis-Einsatz zieht von dem guten Gewichtheben-Einsatz ab (Summe der Einsatz-Einheiten), statt in einer Tagessumme zu verschwinden.
    expect(summe(l("schwachInTennis"))).toBeLessThan(summe(l("einer")));
  });
});

describe("Fix 2: der negative Schwung und die negative Saisonleistung sind gedeckelt", () => {
  it("auch bei dauerhaft schlechtester Leistung bucht die Saison nicht mehr als die Grenze an negativer Leistung", () => {
    const idx = index(Object.fromEntries(IDS.map((m) => [m, { median: { gewichtheben: 10 }, spieler: { s: { gewichtheben: 0 } } }])));
    const verlauf: Array<Pick<TrainingsSpieltagEintrag, "m" | "s" | "z" | "p" | "a">> = [];
    for (const m of IDS) {
      const l = leistungFuerTag({ index: idx, matchdayId: m, player: mk("s"), verlauf });
      // Training und Abbau bis dahin ziehen das Netto ins Minus, damit der Schwung voll greift.
      verlauf.push({ m, s: "t", p: l, a: { power: 0.6 } });
    }
    const negativ = verlauf.reduce((acc, e) => acc - Object.values(e.p ?? {}).reduce((a, b) => a + Math.min(0, b ?? 0), 0), 0);
    expect(negativ).toBeLessThanOrEqual(ENTWICKLUNGS_PARAMETER_STANDARD.negativSaisonGrenze + 1e-9);
    expect(negativ).toBeGreaterThan(ENTWICKLUNGS_PARAMETER_STANDARD.negativSaisonGrenze - 0.5);
  });

  it("die Grenze gilt nur fuer den negativen Anteil: gute Spieltage werden nicht abgeschnitten", () => {
    const idx = index({ "md-1": { median: { gewichtheben: 2 }, spieler: { g: { gewichtheben: 8 } } } });
    const voll = [{ m: "md-0", s: "t" as const, p: { power: -ENTWICKLUNGS_PARAMETER_STANDARD.negativSaisonGrenze } }];
    expect(summe(leistungFuerTag({ index: idx, matchdayId: "md-1", player: mk("g"), verlauf: voll }))).toBeGreaterThan(0);
  });
});

describe("Fix 3: Rueckweg und Stempel", () => {
  it("OLY_TRAINING_JE_SPIELTAG=aus setzt fuer neue Saisons den Stempel alt; OLY_ENTWICKLUNG hat Vorrang", () => {
    delete process.env.OLY_ENTWICKLUNG;
    delete process.env.OLY_TRAINING_JE_SPIELTAG;
    expect(entwicklungsRegelSchalter()).toBe("neu2");
    process.env.OLY_TRAINING_JE_SPIELTAG = "aus";
    expect(entwicklungsRegelSchalter()).toBe("alt");
    process.env.OLY_ENTWICKLUNG = "neu";
    expect(entwicklungsRegelSchalter()).toBe("neu");
    process.env.OLY_ENTWICKLUNG = "alt";
    process.env.OLY_TRAINING_JE_SPIELTAG = "an";
    expect(entwicklungsRegelSchalter()).toBe("alt");
  });

  it("in einer neu-Saison entscheidet nur der Stempel: die Variable schaltet nicht um, eine alt-Saison folgt ihr wie am 18.11.", () => {
    process.env.OLY_TRAINING_JE_SPIELTAG = "aus";
    expect(entwicklungsRegelFuer(BASIS)).toBe("neu");
    expect(trainingJeSpieltagFuer(BASIS)).toBe(true);
    const alt = { ...BASIS, seasonState: { ...BASIS.seasonState, entwicklungsRegel: { seasonId: BASIS.season.id, regel: "alt" as const } } } as GameState;
    expect(trainingJeSpieltagFuer(alt)).toBe(false);
    delete process.env.OLY_TRAINING_JE_SPIELTAG;
    expect(trainingJeSpieltagFuer(alt)).toBe(true);
  });

  it("Umschalten der Variablen mitten in der Saison bucht Training nicht doppelt: Buchung und Prognose bleiben gleich", () => {
    let gs = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    for (const m of IDS.slice(0, 3)) gs = buche(gs, m);
    const p = spieler(gs);
    const vorher = buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: p, draftMode: "mittel" });
    const netto = buildOrganicSeasonProgression({ gameState: gs, player: p, ...vorher }).netSetpoints;
    process.env.OLY_TRAINING_JE_SPIELTAG = "aus";
    const gs4 = buche(gs, IDS[3]!);
    expect(spieler(gs4).seasonTrainingAccumulator?.verlauf).toHaveLength(4);
    const nachher = buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: p, draftMode: "mittel" });
    expect(nachher).toEqual(vorher);
    expect(buildOrganicSeasonProgression({ gameState: gs, player: p, ...nachher }).netSetpoints).toBe(netto);
  });
});

describe("Fix 4: forceReplace mit gleichem Modus rechnet L neu, wenn sich die PP geaendert haben", () => {
  const mitPp = (pp: number) => index({ "md-1": { median: { gewichtheben: 2 }, spieler: { [SPIELER_ID]: { gewichtheben: pp } } } });

  it("gleiche PP: der Eintrag bleibt unveraendert; geaenderte PP: L und die Attribute folgen, h und y stehen im Eintrag", () => {
    halter.index = mitPp(6);
    const gs0 = setzeTrainingsZiel(BASIS, SPIELER_ID, { disziplinId: "gewichtheben", weg: 0 });
    const gs1 = buche(gs0, "md-1");
    const e1 = spieler(gs1).seasonTrainingAccumulator!.verlauf![0]!;
    expect(summe(e1.p)).toBeGreaterThan(0);
    expect(e1.h).toBe(ppHashFuerTag(mitPp(6), "md-1", SPIELER_ID));
    expect(Object.keys(e1.y ?? {})).toEqual(["gewichtheben"]);
    const gleich = buche(gs1, "md-1");
    expect(spieler(gleich).seasonTrainingAccumulator!.verlauf![0]).toEqual(e1);

    // Ergebnis korrigiert (forceReplace, derselbe Modus): L muss neu gerechnet werden, nicht das alte stehen bleiben.
    halter.index = mitPp(0);
    const gs2 = buche(gs1, "md-1");
    const verlauf = spieler(gs2).seasonTrainingAccumulator!.verlauf!;
    expect(verlauf).toHaveLength(1);
    expect(summe(verlauf[0]!.p)).toBeLessThan(0);
    expect(verlauf[0]!.h).toBe(ppHashFuerTag(mitPp(0), "md-1", SPIELER_ID));
    for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
      const erwartet = (verlauf[0]!.z?.[a] ?? 0) + (verlauf[0]!.p?.[a] ?? 0) - (verlauf[0]!.a?.[a] ?? 0);
      expect(attr(spieler(gs2), a) - attr(spieler(gs0), a)).toBeCloseTo(erwartet, 6);
    }
  });
});

describe("Fix 5: Leistungs-Erwartung aus der Vorsaison statt L = 0", () => {
  const verlaufMit = (z: number): TrainingsSpieltagEintrag[] => IDS.map((m) => ({ m, s: "t" as const, y: { gewichtheben: z } }));

  it("baueLeistungsErwartung: Trainingstage, Einsaetze und Einheiten je Disziplin; ohne Leistungsdaten null; mittleres z je Einsatz", () => {
    const e = baueLeistungsErwartung({ seasonId: "s", modeByMatchday: {}, matchdaysCounted: 20, accumulatedTrainingFatigue: 0, updatedAt: "", verlauf: verlaufMit(1.5) });
    expect(e?.tage).toBe(20);
    expect(e?.jeDisziplin.gewichtheben).toEqual({ n: 20, summe: 30 });
    expect(mittleresZJeEinsatz(e)).toBeCloseTo(1.5, 8);
    expect(baueLeistungsErwartung(null)).toBeNull();
    expect(baueLeistungsErwartung({ seasonId: "s", modeByMatchday: {}, matchdaysCounted: 0, accumulatedTrainingFatigue: 0, updatedAt: "", verlauf: [{ m: "a", s: "t" }] })).toBeNull();
  });

  it("zu Saisonbeginn hebt (senkt) eine gute (schlechte) Vorsaison die Prognose; ohne Vorsaison bleibt L = 0, T und A bleiben unberuehrt", () => {
    const erw = (z: number) => baueLeistungsErwartung({ seasonId: "s", modeByMatchday: {}, matchdaysCounted: 20, accumulatedTrainingFatigue: 0, updatedAt: "", verlauf: verlaufMit(z) });
    const prognose = (gs: GameState) => {
      const p = spieler(gs);
      return buildOrganicSeasonProgression({ gameState: gs, player: p, ...buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: p, draftMode: "mittel" }) });
    };
    const mitErwartung = (z: number | null) => ({ ...BASIS, players: BASIS.players.map((p) => (p.id === SPIELER_ID ? { ...p, leistungsErwartung: z == null ? null : erw(z) } : p)) }) as GameState;
    const ohne = prognose(mitErwartung(null));
    const gut = prognose(mitErwartung(1.5));
    const schlecht = prognose(mitErwartung(-1));
    const l = (r: ReturnType<typeof prognose>) => r.attributeBreakdown.reduce((a, e) => a + e.performance, 0);
    expect(l(ohne)).toBe(0);
    expect(l(gut)).toBeGreaterThan(0);
    expect(l(schlecht)).toBeLessThan(0);
    // T und A getrennt und unabhaengig von der Erwartung.
    const t = (r: ReturnType<typeof prognose>) => r.attributeBreakdown.reduce((a, e) => a + e.training, 0);
    const a = (r: ReturnType<typeof prognose>) => r.attributeBreakdown.reduce((x, e) => x + e.regression, 0);
    expect(t(gut)).toBeCloseTo(t(ohne), 6);
    expect(a(gut)).toBeCloseTo(a(ohne), 6);
    expect(leistungsErwartungJeTag(spieler(mitErwartung(null)))).toBeNull();
    expect(leistungsErwartungJeTag(spieler(mitErwartung(1.5)))).not.toBeNull();
  });
});

describe("Fix 7: offene Spieltage (o) einheitlich", () => {
  it("die Historie zaehlt sie nur unter offen (netto z - a), nicht unter Training/Abbau; die Summe stimmt", () => {
    const offen: TrainingsSpieltagEintrag = { m: "md-2", s: "t", o: true, z: { power: 0.5 }, a: { power: 0.2 } };
    const gebucht: TrainingsSpieltagEintrag = { m: "md-1", s: "t", z: { power: 0.4 }, p: { power: 0.3 }, a: { power: 0.1 } };
    const gs = {
      ...BASIS,
      players: BASIS.players.map((p) =>
        p.id === SPIELER_ID
          ? { ...p, seasonTrainingAccumulator: { seasonId: BASIS.season.id, matchdaysCounted: 2, modeByMatchday: { "md-1": "mittel" as const, "md-2": "mittel" as const }, accumulatedTrainingFatigue: 0, updatedAt: "", verlauf: [gebucht, offen] } }
          : p,
      ),
    } as GameState;
    const h = buildPlayerSeasonTrainingForecast({ gameState: gs, player: spieler(gs) })!;
    const power = h.attributes.find((c) => c.attribute === "power")!;
    expect(power.training).toBeCloseTo(0.4, 1);
    expect(power.regression).toBeCloseTo(-0.1, 1);
    expect(power.offen).toBeCloseTo(0.3, 1);
    expect(power.cumulative).toBeCloseTo(0.4 + 0.3 - 0.1 + 0.3, 1);
    expect(h.offenTotal).toBeCloseTo(0.3, 1);
    expect(h.trainingTotal).toBeCloseTo(0.4, 1);
  });

  it("die Prognose zaehlt z - a eines offenen Spieltags zum Rest", () => {
    const mitEintrag = (verlauf: TrainingsSpieltagEintrag[]) =>
      ({
        ...BASIS,
        players: BASIS.players.map((p) =>
          p.id === SPIELER_ID
            ? { ...p, seasonTrainingAccumulator: { seasonId: BASIS.season.id, matchdaysCounted: 1, modeByMatchday: { "md-1": "mittel" as const }, accumulatedTrainingFatigue: 0, updatedAt: "", verlauf } }
            : p,
        ),
      }) as GameState;
    const netto = (gs: GameState) => buildOrganicSeasonProgression({ gameState: gs, player: spieler(gs), ...buildProjectedSeasonTrainingAccumulatorOverrides({ gameState: gs, player: spieler(gs), draftMode: "mittel" }) });
    const ohneOffen = netto(mitEintrag([{ m: "md-1", s: "t" }]));
    const mitOffen = netto(mitEintrag([{ m: "md-1", s: "t", o: true, z: { power: 0.5 }, a: { power: 0.2 } }]));
    const power = (r: ReturnType<typeof netto>) => r.attributeBreakdown.find((e) => e.attribute === "power")!;
    expect(power(mitOffen).training - power(ohneOffen).training).toBeCloseTo(0.5, 2);
    expect(power(mitOffen).regression - power(ohneOffen).regression).toBeCloseTo(-0.2, 2);
  });
});

describe("Fix 9 und PM-Entscheidung: Messhebel nur im Messlauf, Diligent ohne KI-Neigung", () => {
  it("OLY_ENT_PARAMS wirkt im Spiel nicht; nur der ausdrueckliche Messhebel ueberschreibt", () => {
    process.env.OLY_ENT_PARAMS = JSON.stringify({ gamma: 9 });
    setzeEntwicklungsParameterFuerMessung(null);
    expect(entwicklungsParameter().gamma).toBe(ENTWICKLUNGS_PARAMETER_STANDARD.gamma);
    setzeEntwicklungsParameterFuerMessung({ gamma: 2 });
    expect(entwicklungsParameter().gamma).toBe(2);
    setzeEntwicklungsParameterFuerMessung(null);
    expect(entwicklungsParameter().gamma).toBe(ENTWICKLUNGS_PARAMETER_STANDARD.gamma);
  });

  it("Diligent bekommt keine Neigung zum Modus hart; andere Hart-Traits behalten sie", () => {
    const basis = { fatigue: 50, age: 25 };
    const dil = getTrainingModeBiasScores({ player: { ...basis, traitsPositive: ["Diligent"], traitsNegative: [] } as never });
    const ohne = getTrainingModeBiasScores({ player: { ...basis, traitsPositive: [], traitsNegative: [] } as never });
    const ehrgeizig = getTrainingModeBiasScores({ player: { ...basis, traitsPositive: ["Ambitious"], traitsNegative: [] } as never });
    expect(dil.hart).toBe(ohne.hart);
    expect(ehrgeizig.hart).toBeGreaterThan(ohne.hart);
  });
});

import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ARENA_BAHN_DISCIPLINE_IDS,
  ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS,
  ARENA_BUEHNE_DUELL_DISCIPLINE_IDS,
  ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS,
  ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS,
  runArenaFixtures,
  runMiniDmFfaPodFixtures,
  type ArenaFixtureInput,
  type ArenaFixtureResult,
  type MiniDmFfaPodFixtureInput,
  type MiniDmFfaPodFixtureResult,
} from "@/lib/battle/arena-headless-runner";
import {
  pruefeRohesDuellErgebnis,
  pruefeRohesMiniDmErgebnis,
  runArenaFixturesNode,
  runMiniDmFfaPodFixturesNode,
} from "@/lib/battle/arena-node-runner";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { buildArenaMatchSeed } from "@/lib/battle/arena-seed";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { rollMatchdayMutatorTraitsForSide } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  computeArenaTeamPointsFromFixtureResults,
  computeIndividualBoxscorePpsFromFixtureResults,
  findLeagueFixturesForMatchday,
} from "@/lib/resolve/battle-mode-arena-team-points";
import { invalidateLocalTransfermarktCachesForSave } from "@/lib/market/transfermarkt-local-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildBattleModeLeagueSplitSave } from "@/tests/helpers/build-battle-mode-league-split-save";
import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";

/**
 * PARITAET NODE-RUNNER <-> CHROMIUM-RUNNER (Quick-Sim, 27.10.).
 *
 * Der Quick-Sim-Knopf bucht Arena-Ergebnisse aus `runArenaFixturesNode()` statt aus
 * `runArenaFixtures()` (Chromium). Diese Datei stellt sicher, dass beide fuer die WERTUNG
 * dasselbe liefern — an echten Kaderpaaren eines 32-Team-Battle-Saves, mit echten Saaten
 * (`buildArenaMatchSeed`, wie der Vorlauf) und echten Spieltags-Mutatoren
 * (`rollMatchdayMutatorTraitsForSide`), fuer jede Disziplin mit Arena-Einstieg.
 *
 * ABDECKUNG (17 von 20 Disziplinen): alle 14 gewerteten (`ARENA_RESOLVED_DISCIPLINE_IDS`), dazu
 * Football und Hockey (Feldspiel-Chassis, heute ueber die PPS-Bruecke gewertet, aber derselbe
 * Motor-Einstieg wie Basketball) und Mini-DM ueber den Pod-Runner. NICHT abgedeckt, weil sie gar
 * keinen Arena-Einstieg im Runner haben und deshalb auch nie ueber Quick-Sim laufen: TDM und
 * Battlefield (kein Produktions-Einstieg, nur Sonden) sowie I-Spy (bewusst nicht in
 * `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`).
 *
 * WAS EXAKT GLEICH SEIN MUSS: Teams, `seiten` (der Duell-Ausgang -> Teampunkte), `gesamtKg`
 * (Gewichtheben-Tiebreak), `momente`, Reihenfolge/Namen/Spieler-IDs/Seiten/Torwart-Kennung der
 * Boxscore, und die daraus abgeleiteten TEAMPUNKTE (`computeArenaTeamPointsFromFixtureResults`).
 *
 * WAS TOLERIERT WIRD, UND WARUM: der einzelne Boxscore-`wert` (Fliesskomma-Leistungswert eines
 * Spielers) und die daraus abgeleiteten individuellen PPs — relative Abweichung bis
 * `WERT_TOLERANZ_RELATIV` (1e-9). Erwartet ist inzwischen BITGLEICHHEIT: die einzige gemessene
 * Ursache fuer Abweichungen waren `Math.sin`/`Math.cos`/`Math.pow`, die Node 22 (fdlibm) und
 * Chromium 141 (glibc) im letzten Bit verschieden runden — im Basketball wuchs so ein Bit ueber
 * die Positionsrechnung bis in die 3. Nachkommastelle eines Boxscore-Werts. Seit
 * `arena-node-chromium-mathe.mjs` die Chromium-Algorithmen im Motor-Kontext nachbildet, sind
 * sin/cos bitgleich; bei pow bleibt ein Rest auf FMA-Rechnern (glibc waehlt dort eine
 * FMA-Variante, die in ~0,06 % zufaelliger Argumente im letzten Bit anders rundet, s. dortiger
 * Kopf). Der Motor nutzt pow mit nicht-ganzzahligem Exponenten nur fuer Wahrscheinlichkeiten,
 * nicht fuer Positionen; die Toleranz ist das Netz fuer genau diesen Rest. Duell-Ausgang und
 * Teampunkte werden in jedem Fall EXAKT verglichen.
 */

const WERT_TOLERANZ_RELATIV = 1e-9;
/** Duelle je Disziplin und Liga-Stufe (zwei Stufen) — per ENV fuer eine breitere Stichprobe. */
const FIXTURES_JE_STUFE = Math.max(1, Number(process.env.OLY_PARITAET_FIXTURES_JE_STUFE) || 2);

const DUELL_DISZIPLINEN = [
  ...new Set([
    ...ARENA_RESOLVED_DISCIPLINE_IDS,
    "football",
    "hockey",
  ]),
].sort();

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

type Kontext = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

let kontext: Kontext | null = null;

function fixturesFuer(disziplin: string): ArenaFixtureInput[] {
  const { gameState, saveId, seasonId, matchdayId } = kontext!;
  return (["liga1", "liga2"] as const).flatMap((tier) =>
    findLeagueFixturesForMatchday(gameState, tier, matchdayId)
      .slice(0, FIXTURES_JE_STUFE)
      .map((f) => ({
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        seed: buildArenaMatchSeed({ saveId, seasonId, matchdayId, disciplineId: disziplin, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId }),
      })),
  );
}

function mutatorenFuer(disziplin: string): string[] {
  const { saveId, seasonId, matchdayId } = kontext!;
  return rollMatchdayMutatorTraitsForSide({ saveId, seasonId, matchdayId, disciplineSide: "d1", disciplineId: disziplin }).filter(Boolean);
}

function wertGleich(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= WERT_TOLERANZ_RELATIV * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Vergleicht zwei Ergebnislisten fuer die Wertung; liefert die Anzahl nur-toleriert-gleicher Werte. */
function vergleicheDuelle(disziplin: string, chromium: ArenaFixtureResult[], node: ArenaFixtureResult[]): number {
  expect(node.length, `${disziplin}: Anzahl Ergebnisse`).toBe(chromium.length);
  let toleriert = 0;
  chromium.forEach((c, i) => {
    const n = node[i]!;
    const wo = `${disziplin} #${i} (${c.homeTeamId} vs. ${c.awayTeamId})`;
    expect([n.homeTeamId, n.awayTeamId], `${wo}: Teams`).toEqual([c.homeTeamId, c.awayTeamId]);
    expect(n.seiten, `${wo}: seiten`).toEqual(c.seiten);
    expect(n.gesamtKg, `${wo}: gesamtKg`).toEqual(c.gesamtKg);
    expect(n.momente, `${wo}: momente`).toEqual(c.momente);
    expect(
      n.boxscore.map(({ name, playerId, side, torwart }) => ({ name, playerId, side, torwart })),
      `${wo}: Boxscore-Zuordnung`,
    ).toEqual(c.boxscore.map(({ name, playerId, side, torwart }) => ({ name, playerId, side, torwart })));
    c.boxscore.forEach((eintrag, j) => {
      const wert = n.boxscore[j]!.wert;
      expect(wertGleich(eintrag.wert, wert), `${wo}: Boxscore-Wert ${eintrag.name} ${eintrag.wert} vs. ${wert}`).toBe(true);
      if (eintrag.wert !== wert) toleriert += 1;
    });
  });

  // Abgeleitete Wertung: Teampunkte exakt, individuelle PPs mit derselben Toleranz.
  const saaten = new Map(fixturesFuer(disziplin).map((f) => [`${f.homeTeamId}::${f.awayTeamId}`, String(f.seed)]));
  expect([...computeArenaTeamPointsFromFixtureResults(node, saaten)], `${disziplin}: Teampunkte`).toEqual([
    ...computeArenaTeamPointsFromFixtureResults(chromium, saaten),
  ]);
  const ppsC = computeIndividualBoxscorePpsFromFixtureResults(chromium, null, disziplin);
  const ppsN = computeIndividualBoxscorePpsFromFixtureResults(node, null, disziplin);
  expect([...ppsN.keys()].sort(), `${disziplin}: PP-Spieler`).toEqual([...ppsC.keys()].sort());
  for (const [spieler, pp] of ppsC) {
    expect(wertGleich(pp, ppsN.get(spieler)!), `${disziplin}: individuelle PPs ${spieler}`).toBe(true);
  }
  return toleriert;
}

function vergleicheMiniDm(chromium: Array<MiniDmFfaPodFixtureResult | null>, node: Array<MiniDmFfaPodFixtureResult | null>) {
  expect(node.length).toBe(chromium.length);
  chromium.forEach((c, i) => {
    const n = node[i];
    if (c === null) {
      expect(n).toBeNull();
      return;
    }
    expect(n).not.toBeNull();
    expect(
      n!.teams.map(({ teamId, eventPlatz, ligaPunkte, rundenPunkteSumme }) => ({ teamId, eventPlatz, ligaPunkte, rundenPunkteSumme })),
      `Pod ${c.podId}: Teams`,
    ).toEqual(c.teams.map(({ teamId, eventPlatz, ligaPunkte, rundenPunkteSumme }) => ({ teamId, eventPlatz, ligaPunkte, rundenPunkteSumme })));
    c.teams.forEach((t, j) => expect(wertGleich(t.beitragSumme, n!.teams[j]!.beitragSumme)).toBe(true));
    expect(
      n!.boxscore.map(({ slotId, name, playerId, teamId, rundenPlatz, rundenPunkte }) => ({ slotId, name, playerId, teamId, rundenPlatz, rundenPunkte })),
      `Pod ${c.podId}: Boxscore`,
    ).toEqual(c.boxscore.map(({ slotId, name, playerId, teamId, rundenPlatz, rundenPunkte }) => ({ slotId, name, playerId, teamId, rundenPlatz, rundenPunkte })));
    c.boxscore.forEach((b, j) => expect(wertGleich(b.beitrag, n!.boxscore[j]!.beitrag)).toBe(true));
  });
}

function miniDmPods(): MiniDmFfaPodFixtureInput[] {
  const { gameState, saveId, matchdayId } = kontext!;
  const teamIds = [...new Set(findLeagueFixturesForMatchday(gameState, "liga1", matchdayId).flatMap((f) => [f.homeTeamId, f.awayTeamId]))];
  return [0, 4].map((start) => ({
    podId: `pod-${start / 4}`,
    teamIds: teamIds.slice(start, start + 4) as [string, string, string, string],
    seed: `${saveId}:${matchdayId}:mini-dm:${start}`,
  }));
}

beforeAll(async () => {
  const built = await buildBattleModeLeagueSplitSave({
    sqlitePath: path.join(os.tmpdir(), `oly-arena-node-paritaet-${randomUUID()}.sqlite`),
    logPrefix: "[arena-node-paritaet]",
  });
  const matchdayId = built.persistence.getSaveById(built.saveId)!.gameState.matchdayState.matchdayId;
  applyAiLegacyLineupBatchLocally(
    { saveId: built.saveId, seasonId: built.seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    built.persistence,
  );
  kontext = {
    gameState: built.persistence.getSaveById(built.saveId)!.gameState,
    saveId: built.saveId,
    seasonId: built.seasonId,
    matchdayId,
  };
}, 600_000);

afterAll(() => {
  if (kontext) invalidateLocalTransfermarktCachesForSave(kontext.saveId);
});

describe("arena-node-runner · ohne Chromium", () => {
  it("liefert fuer jedes Chassis ein vollstaendiges, deterministisches ArenaFixtureResult", async () => {
    const jeChassis = [
      [...ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS][0]!,
      [...ARENA_BUEHNE_DUELL_DISCIPLINE_IDS][0]!,
      [...ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS][0]!,
      [...ARENA_BUEHNE_GAUNTLET_DISCIPLINE_IDS][0]!,
      [...ARENA_BAHN_DISCIPLINE_IDS][0]!,
      "basketball",
    ];
    for (const disziplin of jeChassis) {
      const fixtures = fixturesFuer(disziplin).slice(0, 1);
      const a = await runArenaFixturesNode(kontext!.gameState, fixtures, disziplin, { mutatoren: mutatorenFuer(disziplin) });
      const b = await runArenaFixturesNode(kontext!.gameState, fixtures, disziplin, { mutatoren: mutatorenFuer(disziplin) });
      expect(a, `${disziplin}: zwei Laeufe identisch`).toEqual(b);
      expect(a).toHaveLength(1);
      expect(a[0]!.homeTeamId).toBe(fixtures[0]!.homeTeamId);
      expect(a[0]!.boxscore.length, `${disziplin}: Boxscore`).toBeGreaterThan(0);
      expect(a[0]!.boxscore.every((e) => e.playerId !== null), `${disziplin}: jede Boxscore-Zeile einem Spieler zugeordnet`).toBe(true);
    }
  }, 600_000);

  it("ein zu knappes Zeitbudget beendet den Worker hart und wirft", async () => {
    const fixtures = fixturesFuer("basketball").slice(0, 1);
    await expect(runArenaFixturesNode(kontext!.gameState, fixtures, "basketball", { nodeTimeoutMs: 1 })).rejects.toThrow(/Timeout/);
  }, 120_000);

  it("die Formpruefung lehnt jedes Ergebnis ab, das die Wertung nicht lesen koennte", () => {
    const gut = { disziplin: "tennis", seiten: [2, 1], boxscore: [{ name: "A", wert: 1.5 }] };
    expect(pruefeRohesDuellErgebnis(gut, "t")).toBe(gut);
    expect(pruefeRohesDuellErgebnis(null, "t")).toBeNull();
    for (const kaputt of [
      "text",
      { ...gut, seiten: [1] },
      { ...gut, seiten: [1, Number.NaN] },
      { ...gut, boxscore: "x" },
      { ...gut, boxscore: [{ name: "A" }] },
      { ...gut, boxscore: [{ name: "A", wert: Number.NaN }] },
      { ...gut, gesamtKg: [1] },
      { ...gut, momente: [{ typ: "erfunden", seite: 0, spieler: null }] },
    ]) {
      expect(() => pruefeRohesDuellErgebnis(kaputt, "t"), JSON.stringify(kaputt)).toThrow(/unerwartetes Ergebnisformat/);
    }
    expect(() => pruefeRohesMiniDmErgebnis({ runden: [], teams: [{ side: 0 }] }, "m")).toThrow(/Mini-DM-Ergebnisformat/);
  });
});

describe.skipIf(!CHROMIUM_VERFUEGBAR)("arena-node-runner · Paritaet zu Chromium (Wertung)", () => {
  it.each(DUELL_DISZIPLINEN)(
    "%s: Node und Chromium werten identisch",
    async (disziplin) => {
      const fixtures = fixturesFuer(disziplin);
      const mutatoren = mutatorenFuer(disziplin);
      const chromium = await runArenaFixtures(kontext!.gameState, fixtures, disziplin, { mutatoren });
      // Grosszuegiges Zeitbudget: diese Datei prueft GLEICHHEIT, nicht Tempo -- eine ausgelastete
      // CI-Maschine soll den Paritaetsbeleg nicht an der Produktions-Zeitgrenze scheitern lassen.
      const node = await runArenaFixturesNode(kontext!.gameState, fixtures, disziplin, { mutatoren, nodeTimeoutMs: 540_000 });
      const toleriert = vergleicheDuelle(disziplin, chromium, node);
      if (toleriert > 0) {
        console.info(`[arena-node-paritaet] ${disziplin}: ${toleriert} Boxscore-Wert(e) nur innerhalb der Toleranz gleich.`);
      }
    },
    600_000,
  );

  it("mini-dm: Node und Chromium werten die Pods identisch", async () => {
    const pods = miniDmPods();
    const mutatoren = mutatorenFuer("mini-dm");
    const chromium = await runMiniDmFfaPodFixtures(kontext!.gameState, pods, { mutatoren, k: 4 });
    const node = await runMiniDmFfaPodFixturesNode(kontext!.gameState, pods, { mutatoren, k: 4, nodeTimeoutMs: 540_000 });
    expect(chromium.some((pod) => pod !== null)).toBe(true);
    vergleicheMiniDm(chromium, node);
  }, 600_000);
});

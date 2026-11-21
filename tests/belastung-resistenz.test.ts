/**
 * BELASTUNG/RESISTENZ (Regel v2, Chris 21.11., Variante „mild") — Lastformel, Saison-Stempel, Buchung =
 * Vorschau, Pause nach Spieltag 10 (idempotent, keine Sperr-/Trainingszählung), aktive Erholung 4,0,
 * KI-Platzwahl und der Verletzungskorridor. Doku: docs/design/belastung-resistenz-bau-21-11/README.md.
 */
import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import { ordneSpielerAufPlaetze, kiPlatzwert } from "@/lib/ai/ai-belastung-platzwahl";
import {
  BELASTUNG_V2,
  berechneEinsatzLast,
  berechneSlotBelastungsTeile,
  belastungsTon,
  belastungsZusatzText,
} from "@/lib/fatigue/belastung-regel";
import {
  belastungsRegelFuer,
  belastungsRegelFuerNeueSaison,
  stempleBelastungsRegelBeimAnlegen,
} from "@/lib/fatigue/belastung-regel-stempel";
import {
  buildKorridorLeague,
  realSchedule,
  runKorridorSeason,
} from "@/lib/fatigue/erholungskorridor-simulation";
import {
  applyFatigueAndInjuryAfterMatchday,
  buildBelastungsPauseRef,
  buildMatchdaySlotRoleResolver,
  calculatePlayerRecovery,
  getMatchdayActiveRecoveryValue,
  getPlayerActiveRecoveryCredit,
  getPlayerAvailabilityView,
  getPlayerFatigueLoadTraitMultiplier,
  INTENSITY_FATIGUE_MULT,
  MATCHDAY_ACTIVE_RECOVERY,
  MATCHDAY_FATIGUE_LOAD,
  projectMatchdayInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import { slotEinsatzProjektion } from "@/lib/lineups/einsatzliste-belastung";
import { buildAiLegacyLineupSuggestion } from "@/lib/ai/ai-legacy-lineup-engine";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

const SAAT = "belastung-test";

function v2Liga(opts: { stempel?: boolean } = {}): GameState {
  const spielplan = realSchedule(SAAT, 2);
  const gs = buildKorridorLeague(spielplan.length, {
    gameMode: "battle",
    spielplan,
    mitAttributen: true,
    ...(opts.stempel === false ? {} : { belastungsRegel: "v2" as const }),
  });
  return gs;
}

function waehle(gs: GameState, teamId: string, matchdayId: string, n: number) {
  return gs.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => ({ id: r.playerId, v: getPlayerAvailabilityView(gs, r.playerId, teamId, matchdayId) }))
    .filter((x) => !x.v.isUnavailable)
    .sort((a, b) => a.v.fatigue - b.v.fatigue || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((x) => x.id);
}

function setzeEntwuerfe(gs: GameState, mdIndex: number): GameState {
  const md = gs.seasonState.disciplineSchedule![mdIndex]!;
  const n1 = md.discipline1?.playerCount ?? 0;
  const n2 = md.discipline2?.playerCount ?? 0;
  const drafts: LineupDraft[] = gs.teams.map((team) => {
    const ids = waehle(gs, team.teamId, md.matchdayId, n1 + n2);
    return {
      lineupId: `l-${team.teamId}-${md.matchdayId}`,
      saveId: SAAT,
      seasonId: "season-1",
      matchdayId: md.matchdayId,
      teamId: team.teamId,
      status: "submitted",
      entries: [
        ...ids.slice(0, n1).map((playerId, slotIndex) => ({ disciplineId: md.discipline1!.disciplineId, disciplineSide: "d1" as const, slotIndex, playerId, activePlayerId: playerId })),
        ...ids.slice(n1).map((playerId, slotIndex) => ({ disciplineId: md.discipline2!.disciplineId, disciplineSide: "d2" as const, slotIndex, playerId, activePlayerId: playerId })),
      ],
      modifiers: { d1: { intensity: "normal" }, d2: { intensity: "push" } },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as LineupDraft;
  });
  return { ...gs, seasonState: { ...gs.seasonState, lineupDrafts: drafts } };
}

function bucheSpieltag(gs: GameState, mdIndex: number, extra: Partial<Parameters<typeof applyFatigueAndInjuryAfterMatchday>[0]> = {}) {
  const matchdayId = gs.season.matchdayIds[mdIndex]!;
  return applyFatigueAndInjuryAfterMatchday({
    gameState: gs,
    saveId: SAAT,
    seasonId: "season-1",
    matchdayId,
    matchdayResultId: `res-${matchdayId}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    ...extra,
  });
}

describe("Lastformel (mild: 45/60/75, Grundlast 12,5/15/17,5, +0,15 bis +4, −0,05 bis −2)", () => {
  it("rechnet Grundlast und Resistenz-Zusatz je Stufe", () => {
    expect(berechneSlotBelastungsTeile({ stufe: "high", resistenz: 75 })).toMatchObject({ grundlast: 17.5, zusatz: 0, schwelle: 75 });
    // 11 Punkte unter 75: +1,65
    expect(berechneSlotBelastungsTeile({ stufe: "high", resistenz: 64 }).zusatz).toBeCloseTo(1.65, 6);
    // Deckel +4 ab 27 fehlenden Punkten
    expect(berechneSlotBelastungsTeile({ stufe: "high", resistenz: 7 })).toMatchObject({ zusatz: 4, amDeckel: true });
    // 20 über 60: −1
    expect(berechneSlotBelastungsTeile({ stufe: "medium", resistenz: 80 }).zusatz).toBeCloseTo(-1, 6);
    // Deckel −2 ab 40 Punkten über der Schwelle
    expect(berechneSlotBelastungsTeile({ stufe: "low", resistenz: 99 })).toMatchObject({ zusatz: -2, amDeckel: true });
    expect(berechneSlotBelastungsTeile({ stufe: "low", resistenz: null })).toMatchObject({ grundlast: 12.5, zusatz: 0, resistenz: null });
  });

  it("multipliziert Trait und Einsatz auf die ganze Last; die alte Regel bleibt 16 × Trait × Einsatz", () => {
    expect(berechneEinsatzLast({ regel: "v2", altGrundlast: 16, traitMultiplikator: 1, einsatzMultiplikator: 1, slot: { stufe: "high", resistenz: 64 } })).toBe(19.15);
    expect(berechneEinsatzLast({ regel: "v2", altGrundlast: 16, traitMultiplikator: 0.94, einsatzMultiplikator: 1.4, slot: { stufe: "low", resistenz: 99 } })).toBe(Number(((12.5 - 2) * 0.94 * 1.4).toFixed(2)));
    expect(berechneEinsatzLast({ regel: "alt", altGrundlast: 16, traitMultiplikator: 1.06, einsatzMultiplikator: 0.75, slot: { stufe: "high", resistenz: 1 } })).toBe(Number((16 * 1.06 * 0.75).toFixed(2)));
    // Spannweite je Einsatz „Normal": 10,5 bis 21,5 (Mockup)
    expect(berechneEinsatzLast({ regel: "v2", altGrundlast: 16, traitMultiplikator: 1, einsatzMultiplikator: 1, slot: { stufe: "low", resistenz: 99 } })).toBe(10.5);
    expect(berechneEinsatzLast({ regel: "v2", altGrundlast: 16, traitMultiplikator: 1, einsatzMultiplikator: 1, slot: { stufe: "high", resistenz: 1 } })).toBe(21.5);
  });

  it("Ton und Kurztext wie im Mockup", () => {
    const stark = berechneSlotBelastungsTeile({ stufe: "medium", resistenz: 70 });
    const knapp = berechneSlotBelastungsTeile({ stufe: "medium", resistenz: 55 });
    const schwach = berechneSlotBelastungsTeile({ stufe: "high", resistenz: 40 });
    expect(belastungsTon(stark)).toBe("gut");
    expect(belastungsTon(knapp)).toBe("mittel");
    expect(belastungsTon(schwach)).toBe("schwach");
    expect(belastungsZusatzText(stark)).toBe("über Schwelle −0,5");
    expect(belastungsZusatzText(knapp)).toBe("zu schwach +0,8");
    expect(belastungsZusatzText(schwach)).toBe("zu schwach +4,0 (Deckel)");
    expect(BELASTUNG_V2.deckelDrunter).toBe(4);
  });
});

describe("Saison-Stempel", () => {
  it("v2 nur mit gültigem Stempel in einer Battle-Doppelsaison", () => {
    const mit = v2Liga();
    expect(belastungsRegelFuer(mit)).toBe("v2");
    expect(belastungsRegelFuer(v2Liga({ stempel: false }))).toBe("alt");
    // Stempel einer anderen Saison zählt nicht
    expect(belastungsRegelFuer({ ...mit, seasonState: { ...mit.seasonState, belastungsRegel: { seasonId: "season-0", version: "v2" } } })).toBe("alt");
    // Manager-Spielstand: kein v2, auch mit Stempel
    expect(belastungsRegelFuer({ ...mit, scenarioMeta: { gameMode: "manager" } } as GameState)).toBe("alt");
    // Battle-Saison mit 10 Spieltagen (Alt-Save): kein v2
    expect(belastungsRegelFuer({ ...mit, season: { ...mit.season, matchdayIds: mit.season.matchdayIds.slice(0, 10) } })).toBe("alt");
  });

  it("neue Saison: Battle mit 20 Spieltagen bekommt den Stempel, Manager und 10 Spieltage nicht", () => {
    const battle = v2Liga({ stempel: false });
    expect(belastungsRegelFuerNeueSaison(battle, "season-2", 20)).toEqual({ seasonId: "season-2", version: "v2" });
    expect(belastungsRegelFuerNeueSaison(battle, "season-2", 10)).toBeUndefined();
    expect(belastungsRegelFuerNeueSaison({ ...battle, scenarioMeta: { gameMode: "manager" } } as GameState, "season-2", 20)).toBeUndefined();
    const angelegt = stempleBelastungsRegelBeimAnlegen(battle);
    expect(angelegt.seasonState.belastungsRegel).toEqual({ seasonId: "season-1", version: "v2" });
    expect(stempleBelastungsRegelBeimAnlegen(angelegt)).toBe(angelegt);
  });

  it("aktive Erholung 4,0 nur unter v2; die Bank-Erholung bleibt 28", () => {
    expect(getMatchdayActiveRecoveryValue(v2Liga())).toBe(4);
    expect(getMatchdayActiveRecoveryValue(v2Liga({ stempel: false }))).toBe(MATCHDAY_ACTIVE_RECOVERY);
    expect(MATCHDAY_ACTIVE_RECOVERY).toBe(4.5);
    const r = calculatePlayerRecovery(v2Liga(), "T-0", "mittel");
    expect(r.activeRecovery).toBe(4);
    expect(r.activeRecovery + r.benchBonusRecovery).toBe(28);
  });
});

describe("Buchung = Vorschau (eine Formel)", () => {
  it("die gebuchte Last je Einsatz ist die projizierte Last des Platzes", () => {
    const gs = setzeEntwuerfe(v2Liga(), 0);
    const ergebnis = bucheSpieltag(gs, 0);
    const rolle = buildMatchdaySlotRoleResolver(gs, gs.season.matchdayIds[0]!);
    let geprueft = 0;
    for (const draft of gs.seasonState.lineupDrafts) {
      for (const entry of draft.entries) {
        const player = gs.players.find((p) => p.id === entry.playerId)!;
        const role = rolle(draft, entry)!;
        const projektion = projectMatchdayInjuryRisk({
          player,
          currentFatigue: 0,
          intensity: draft.modifiers?.[entry.disciplineSide]?.intensity ?? "normal",
          activeRecovery: getPlayerActiveRecoveryCredit(gs, draft.teamId, player.trainingMode),
          regel: "v2",
          slot: { stufe: role.fatigueProfile, resistenz: player.attributeSheetStats?.[role.strainAttribute] ?? null },
        });
        const event = ergebnis.injuryEvents.find((e) => e.playerId === entry.playerId)!;
        expect(event.fatigueBefore).toBe(projektion.fatigueBeforeRoll);
        geprueft += 1;
      }
    }
    expect(geprueft).toBeGreaterThan(100);
  });

  it("die Einsatzlisten-Vorschau im Browser zeigt dieselbe Zahl, die gebucht wird", () => {
    const gs = setzeEntwuerfe(v2Liga(), 0);
    const ergebnis = bucheSpieltag(gs, 0);
    const rolle = buildMatchdaySlotRoleResolver(gs, gs.season.matchdayIds[0]!);
    // Kontext so, wie `legacy-lineup-local-service.ts` ihn baut (activePlayerId = "a-" + playerId).
    const kontext = {
      belastungsRegel: "v2" as const,
      activePlayers: gs.players.map((p) => ({ id: `a-${p.id}`, playerId: p.id })),
      rosterPlayers: gs.players.map((p) => ({
        id: p.id,
        name: p.id,
        fatigue: 0,
        attributeStats: p.attributeSheetStats ?? null,
        belastungsBasis: {
          traitMultiplikator: getPlayerFatigueLoadTraitMultiplier(p),
          einsatzMultiplikator: { ...INTENSITY_FATIGUE_MULT },
          aktiveErholung: getPlayerActiveRecoveryCredit(gs, "T-0", p.trainingMode),
          altGrundlast: MATCHDAY_FATIGUE_LOAD,
        },
        coreStats: { pow: 0, spe: 0, men: 0, soc: 0 },
      })),
    };
    let geprueft = 0;
    for (const draft of gs.seasonState.lineupDrafts) {
      for (const entry of draft.entries) {
        const anzeige = slotEinsatzProjektion({
          context: kontext,
          activePlayerId: `a-${entry.playerId}`,
          role: rolle(draft, entry),
          intensitaet: draft.modifiers?.[entry.disciplineSide]?.intensity ?? "normal",
        })!;
        const event = ergebnis.injuryEvents.find((e) => e.playerId === entry.playerId)!;
        expect(anzeige.fatigueBeforeRoll).toBe(event.fatigueBefore);
        expect(anzeige.riskPercent).toBe(event.riskPercent);
        geprueft += 1;
      }
    }
    expect(geprueft).toBeGreaterThan(100);
    // Alte Regel: keine Platz-Projektion, die Anzeige nimmt die platzunabhängige des Servers.
    expect(slotEinsatzProjektion({ context: { ...kontext, belastungsRegel: "alt" }, activePlayerId: "a-p-0-0", role: null, intensitaet: "normal" })).toBeNull();
  });

  it("ein resistenter Spieler trägt einen harten Platz leichter als ein schwacher", () => {
    const roles = resolveSlotRolesForDiscipline("mini-dm", "mini-dm", 5);
    const hart = roles.find((r) => r.fatigueProfile === "high")!;
    const last = (resistenz: number) =>
      berechneEinsatzLast({ regel: "v2", altGrundlast: 16, traitMultiplikator: 1, einsatzMultiplikator: 1, slot: { stufe: hart.fatigueProfile, resistenz } });
    expect(last(90)).toBeLessThan(17.5);
    expect(last(30)).toBeGreaterThan(17.5);
  });
});

describe("Pause nach Spieltag 10", () => {
  function spieleBis(gs: GameState, bisIndex: number) {
    let stand = gs;
    for (let i = 0; i <= bisIndex; i += 1) {
      stand = bucheSpieltag(setzeEntwuerfe(stand, i), i).gameState;
    }
    return stand;
  }

  it("jeder Spieler regeneriert einen spielfreien Spieltag, gebucht nach dem Abschluss von Spieltag 10", () => {
    const vor = spieleBis(v2Liga(), 8);
    const mit10 = setzeEntwuerfe(vor, 9);
    const nurD1 = bucheSpieltag(mit10, 9, { commitThroughSide: "d1" }).gameState;
    expect(nurD1.seasonState.belastungsPause ?? null).toBeNull();
    const voll = bucheSpieltag(nurD1, 9, { commitThroughSide: "d2", isMatchdayReplay: true }).gameState;
    const pause = voll.seasonState.belastungsPause!;
    expect(pause.nachMatchdayId).toBe("md-10");
    expect(pause.eintraege.length).toBe(voll.rosters.length);
    for (const eintrag of pause.eintraege) {
      // keine Gebäude, Modus mittel: 28 (Verletzte ebenso, Faktor 1,0)
      expect(eintrag.erholung).toBe(28);
      expect(eintrag.fatigueNachher).toBe(Math.max(0, Number((eintrag.fatigueVorher - 28).toFixed(2))));
      const konto = voll.seasonState.playerAvailabilityState!.find((e) => e.playerId === eintrag.playerId)!;
      expect(konto.fatigue).toBe(eintrag.fatigueNachher);
      expect(voll.players.find((p) => p.id === eintrag.playerId)!.fatigue).toBe(eintrag.fatigueNachher);
    }
    expect(pause.eintraege.some((e) => e.fatigueVorher > 28)).toBe(true);
    const ref = buildBelastungsPauseRef(voll, "T-0")!;
    expect(ref).toMatchObject({ nachSpieltag: 10, nachMatchdayId: "md-10", gebucht: true });
    expect(ref.eintraege!.every((e) => voll.rosters.some((r) => r.teamId === "T-0" && r.playerId === e.playerId))).toBe(true);
  }, 120_000);

  it("ein zweiter Abschluss von Spieltag 10 (forceReplace) ist idempotent", () => {
    const mit10 = setzeEntwuerfe(spieleBis(v2Liga(), 8), 9);
    const erst = bucheSpieltag(mit10, 9).gameState;
    const zweit = bucheSpieltag(erst, 9, { isMatchdayReplay: true }).gameState;
    expect(zweit.seasonState.playerAvailabilityState).toEqual(erst.seasonState.playerAvailabilityState);
    expect(zweit.seasonState.injuryEvents).toEqual(erst.seasonState.injuryEvents);
    expect(zweit.seasonState.belastungsPause).toEqual(erst.seasonState.belastungsPause);
    expect(zweit.players.map((p) => p.fatigue)).toEqual(erst.players.map((p) => p.fatigue));
  }, 120_000);

  it("zählt nicht als Spieltag für Sperren: verletzt an Spieltag 10 fehlt an Spieltag 11", () => {
    const mit10 = setzeEntwuerfe(spieleBis(v2Liga(), 8), 9);
    const ergebnis = bucheSpieltag(mit10, 9, { injuryRehearsal: { enabled: true, riskPercentOverride: 100, maxInjuries: 1 } });
    const verletzt = ergebnis.injuryEvents.find((e) => e.result === "injured")!;
    expect(verletzt).toBeTruthy();
    const nach = ergebnis.gameState;
    expect(nach.seasonState.belastungsPause!.eintraege.find((e) => e.playerId === verletzt.playerId)!.verletzt).toBe(true);
    expect(getPlayerAvailabilityView(nach, verletzt.playerId, verletzt.teamId, "md-11").isUnavailable).toBe(true);
    expect(getPlayerAvailabilityView(nach, verletzt.playerId, verletzt.teamId, "md-12").isUnavailable).toBe(false);
  }, 120_000);

  it("keine Pause unter der alten Regel und nicht nach anderen Spieltagen", () => {
    const alt = spieleBis(v2Liga({ stempel: false }), 9);
    expect(alt.seasonState.belastungsPause ?? null).toBeNull();
    const neu = spieleBis(v2Liga(), 8);
    expect(neu.seasonState.belastungsPause ?? null).toBeNull();
    expect(buildBelastungsPauseRef(neu, "T-0")).toMatchObject({ gebucht: false, nachSpieltag: 10 });
    expect(buildBelastungsPauseRef(alt, "T-0")).toBeNull();
  }, 120_000);
});

describe("KI-Platzwahl", () => {
  it("liegt zwischen „nur Platzwert“ und „nur Last“: spart Last, kostet wenig Platzwert", () => {
    const liga = v2Liga();
    let lastPw = 0;
    let lastKi = 0;
    let lastL = 0;
    let pwPw = 0;
    let pwKi = 0;
    let pwL = 0;
    for (const [disziplin, n] of [["mini-dm", 5], ["basketball", 3], ["hockey", 6], ["tdm", 4]] as const) {
      const roles = resolveSlotRolesForDiscipline(disziplin, disziplin, n);
      for (let t = 0; t < 32; t += 1) {
        const spieler = liga.rosters
          .filter((r) => r.teamId === `T-${t}`)
          .slice(0, n)
          .map((r) => ({ playerId: r.playerId, attributeStats: liga.players.find((p) => p.id === r.playerId)!.attributeSheetStats, lastFaktor: 1 }));
        const summe = (ordnung: string[]) =>
          ordnung.reduce(
            (acc, id, slot) => {
              const w = kiPlatzwert({ role: roles[slot]!, spieler: spieler.find((s) => s.playerId === id)!, altGrundlast: 16 });
              return { pw: acc.pw + w.rollenAufschlag, last: acc.last + w.last };
            },
            { pw: 0, last: 0 },
          );
        const pw = summe(ordneSpielerAufPlaetze({ disciplineId: disziplin, slotCount: n, spieler, altGrundlast: 16, lastGewicht: 0 }));
        const ki = summe(ordneSpielerAufPlaetze({ disciplineId: disziplin, slotCount: n, spieler, altGrundlast: 16 }));
        const nurLast = summe(ordneSpielerAufPlaetze({ disciplineId: disziplin, slotCount: n, spieler, altGrundlast: 16, lastGewicht: 1000 }));
        lastPw += pw.last;
        lastKi += ki.last;
        lastL += nurLast.last;
        pwPw += pw.pw;
        pwKi += ki.pw;
        pwL += nurLast.pw;
      }
    }
    expect(lastKi).toBeLessThan(lastPw);
    expect(lastKi).toBeGreaterThan(lastL);
    expect(pwKi).toBeLessThanOrEqual(pwPw + 1e-9);
    expect(pwKi).toBeGreaterThan(pwL);
    // „nicht dominant": die KI holt weniger als die Hälfte der möglichen Lastersparnis
    expect(lastPw - lastKi).toBeLessThan((lastPw - lastL) / 2);
  });

  it("die echte KI-Aufstellung verteilt nur unter v2 nach Platzwert + Last, wer spielt bleibt gleich", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const r = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const zufall = r(7);
    const attr = () => Object.fromEntries(["power", "health", "stamina", "intelligence", "awareness", "determination", "speed", "dexterity", "charisma", "will", "spirit", "torment"].map((k) => [k, Math.round(5 + zufall() * 90)]));
    const kontext = (regel: "alt" | "v2") =>
      ({
        saveId: "s", seasonId: "season-1", matchdayId: "md-1", teamId: "T", entries: [],
        belastungsRegel: regel,
        disciplinePlayerCounts: { basketball: 3, "mini-dm": 3 },
        disciplineSidePlayerCounts: { "basketball::d1": 3, "mini-dm::d2": 3 },
        activePlayers: ids.map((id) => ({ id: `a-${id}`, saveId: "s", seasonId: "season-1", teamId: "T", playerId: id, upkeep: 10 })),
        disciplineScores: ids.flatMap((id, i) => [
          { playerId: id, disciplineId: "basketball", score: 80 - i * 3 },
          { playerId: id, disciplineId: "mini-dm", score: 78 - i * 2 },
        ]),
        save: { id: "s", name: "S", status: "active" },
        season: { id: "season-1", saveId: "s", name: "S1", year: 1, currentMatchday: 1, status: "active" },
        matchday: { id: "md-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
        team: { id: "T", shortCode: "T", name: "T" },
        teamSeasonState: { id: "t", saveId: "s", seasonId: "season-1", teamId: "T", cash: 500, budget: 1000, rosterLimit: 10, playerOpt: 7 },
        teamIdentity: { pow: 60, spe: 60, men: 60, soc: 60 },
        rosterPlayers: ids.map((id) => ({ id, name: id, coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, attributeStats: attr() })),
        disciplines: [
          { id: "basketball", name: "Basketball", category: "speed" },
          { id: "mini-dm", name: "Mini DM", category: "power" },
        ],
        disciplineWeights: [],
        seasonDisciplineConfigs: [
          { disciplineId: "basketball", originalOrder: 1, displayOrder: 1, playerCount: 3, mutator1: null, mutator2: null },
          { disciplineId: "mini-dm", originalOrder: 2, displayOrder: 2, playerCount: 3, mutator1: null, mutator2: null },
        ],
        teamDisciplineRanks: {},
        existingDraft: null,
        contextMeta: { saveId: "s", seasonId: "season-1", matchdayId: "md-1", teamId: "T", d1DisciplineId: "basketball", d2DisciplineId: "mini-dm" },
      }) as unknown as LegacyLineupLoadedContext;
    const k1 = kontext("alt");
    const alt = buildAiLegacyLineupSuggestion(k1);
    const k2 = kontext("v2");
    k2.rosterPlayers = k1.rosterPlayers; // dieselben Attribute
    const neu = buildAiLegacyLineupSuggestion(k2);
    for (const [seite, disziplin] of [["d1", "basketball"], ["d2", "mini-dm"]] as const) {
      const a = alt.entries.filter((e) => e.disciplineSide === seite).sort((x, y) => x.slotIndex - y.slotIndex).map((e) => e.playerId);
      const n = neu.entries.filter((e) => e.disciplineSide === seite).sort((x, y) => x.slotIndex - y.slotIndex).map((e) => e.playerId);
      expect([...n].sort()).toEqual([...a].sort());
      const erwartet = ordneSpielerAufPlaetze({
        disciplineId: disziplin,
        disciplineName: disziplin === "basketball" ? "Basketball" : "Mini DM",
        slotCount: 3,
        altGrundlast: 16,
        spieler: a.map((id) => ({ playerId: id, attributeStats: k1.rosterPlayers.find((p) => p.id === id)!.attributeStats, lastFaktor: 1 })),
      });
      expect(n).toEqual(erwartet);
    }
  });

  it("der Platzwert bleibt bestimmend: die Last wiegt 0,25 Punkte Platzwert je Lastpunkt", () => {
    const role = resolveSlotRolesForDiscipline("basketball", "basketball", 3)[0]!;
    const a = kiPlatzwert({ role, spieler: { playerId: "a", attributeStats: null, lastFaktor: 1 }, altGrundlast: 16 });
    expect(a.wert).toBeCloseTo(a.rollenAufschlag - 0.25 * a.last, 9);
  });
});

describe("Verletzungskorridor unter v2 (Basisfall-Liga mit Attributen, 20 Spieltage, KI-Platzwahl)", () => {
  it("liegt im Korridor, unter heute, und der Resistenz-Hebel wirkt", () => {
    const saaten = ["belastung-A-1", "belastung-A-2", "belastung-A-3", "belastung-A-4", "belastung-A-5", "belastung-A-6"];
    const lauf = (optionen: Parameters<typeof runKorridorSeason>[2]) =>
      saaten.map((saat) => {
        const spielplan = realSchedule(saat, 2);
        const slots = spielplan.map((e) => ({ d1: e.discipline1?.playerCount ?? 0, d2: e.discipline2?.playerCount ?? 0 }));
        return runKorridorSeason(saat, slots, { ...optionen, spielplan });
      });
    const mittel = (xs: Array<{ injuries: number }>) => xs.reduce((s, x) => s + x.injuries, 0) / xs.length;
    const heute = lauf({ gameMode: "battle", mitAttributen: true });
    const ki = lauf({ gameMode: "battle", belastungsRegel: "v2", platzwahl: "ki" });
    const nachLast = lauf({ gameMode: "battle", belastungsRegel: "v2", platzwahl: "last" });
    // gemessen (6 Saaten, Stamm A): heute 208,8 · v2 KI 173,3 · alle nach Last 93,8
    expect(mittel(ki)).toBeGreaterThanOrEqual(140);
    expect(mittel(ki)).toBeLessThanOrEqual(200);
    expect(mittel(ki)).toBeLessThan(mittel(heute));
    expect(mittel(nachLast)).toBeLessThan(mittel(ki) * 0.75);
    // Die Pause senkt die Erschöpfung zur Saisonmitte deutlich
    const mitte = (xs: Array<{ avgFatigueMid: number }>) => xs.reduce((s, x) => s + x.avgFatigueMid, 0) / xs.length;
    expect(mitte(ki)).toBeLessThan(mitte(heute) - 10);
  }, 180_000);
});

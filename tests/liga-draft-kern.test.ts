/**
 * LIGA-DRAFT IM EINZELSCHRITT — Integration gegen einen echten Wegwerf-Spielstand (frische Saison 1, eigene SQLite).
 *
 * Gepinnt wird:
 *  1. Der Einzelschritt entscheidet wie der Blocklauf: der erste Pick eines leeren Teams aus dem vollen Pool ist genau
 *     die erste Entscheidung von `planOrganicDraftForTeam` (dieselbe KI, derselbe Rahmen, dieselbe Saat).
 *  2. Die Kandidaten des Einzelschritts sind der Feed des Blocklaufs (`listLocalTransfermarktFreeAgents`, voller Pool).
 *  3. KI-Picks laufen ueber den Kauf-Produktionsweg (`ai_roster_fill`), Mensch-Picks ueber `manual_transfermarkt_buy`.
 *  4. Der Draft wartet auf den Menschen; Auslassen, Variante A (Nachzug) und „fertig“ ab dem Mindestkader.
 *  5. Saison 1: Draft-Ruecklage UND Gehaltspuffer halb (Faktor auf max(q × Budget, 0,35 × Zielgehalt)).
 *  6. Waehrend der geordneten Phase sperrt der Draft den freien Markt.
 *  7. Review #1619: Menschen picken selbst (S1), Auslassen mit Auto-Pick abgelehnt (A5), ein fertiger Draft wird nie
 *     neu angelegt (S1).
 *
 * Kleine Regeln (2 Runden, 2 Picks je Team), damit der Lauf in Sekunden bleibt; die volle Liga misst
 * `scripts/miss-teamfinanzen-saison.ts --draft einzelschritt` (docs/design/draft-neubau-kern-18-11.md).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

const DB = path.join(os.tmpdir(), `oly-liga-draft-kern-${process.pid}-${Date.now()}.sqlite`);

let persistence: PersistenceService;
let saveId = "";
let menschTeamId = "";
let dienst: typeof import("@/lib/draft/liga-draft-dienst");
let ki: typeof import("@/lib/draft/liga-draft-ki");
let ansicht: typeof import("@/lib/draft/liga-draft-ansicht");
let modell: typeof import("@/lib/draft/liga-draft-modell");
let startStand: GameState;

const lade = () => persistence.getSaveById(saveId)!.gameState;

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  // Der Schalter des neuen Drafts: ohne ihn sperrt ein Draft nichts (Review #1619, A2).
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  dienst = await import("@/lib/draft/liga-draft-dienst");
  ki = await import("@/lib/draft/liga-draft-ki");
  ansicht = await import("@/lib/draft/liga-draft-ansicht");
  modell = await import("@/lib/draft/liga-draft-modell");
  persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "liga-draft-kern" });
  saveId = frisch.saveId;
  // Ein menschliches Team (pickt selbst). Das reichste Team, damit es in Runde 1 als LETZTES dran ist (Gleichstand
  // bei leeren Kadern: weniger Kasse zuerst) und die KI davor pickt.
  const reichstes = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!;
  menschTeamId = reichstes.teamId;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[menschTeamId] = { ...settings[menschTeamId]!, controlMode: "manual", ownerId: "user_local" };
  persistence.saveSingleplayerState(saveId, {
    ...frisch.gameState,
    seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings },
  });
  startStand = lade();
}, 120_000);

afterAll(() => {
  delete process.env.OLY_LIGA_DRAFT_MODUS;
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("Liga-Draft im Einzelschritt gegen einen echten Spielstand", () => {
  it("die Kandidaten sind der Feed des Blocklaufs (voller Pool, gleiche Reihenfolge)", async () => {
    const { listLocalTransfermarktFreeAgents, createLocalTransfermarktRunContext } = await import("@/lib/market/transfermarkt-local-service");
    const save = persistence.getSaveById(saveId)!;
    const feed = listLocalTransfermarktFreeAgents({
      saveId,
      seasonId: save.gameState.season.id,
      teamId: save.gameState.teams[0]!.teamId,
      mode: "ai_preview",
      fullPool: true,
      localRunContext: createLocalTransfermarktRunContext({ save, persistence }),
    }).items.map((item) => item.playerId);
    expect(ki.freieSpieler(save.gameState).map((spieler) => spieler.id)).toEqual(feed);
  }, 60_000);

  it("S1: angelegt wird nur im frischen Saison-1-Aufbau", () => {
    expect(dienst.ligaDraftAnlegenVerboten(startStand)).toBeNull();
    expect(dienst.ligaDraftAnlegenVerboten({ ...startStand, season: { ...startStand.season, id: "season-2" } })).toBe("nur_saison_1");
    expect(
      dienst.ligaDraftAnlegenVerboten({
        ...startStand,
        seasonState: { ...startStand.seasonState, matchdayResults: [{ seasonId: "season-1" } as never] },
      }),
    ).toBe("saison_laeuft_schon");
    expect(dienst.ligaDraftAnlegenVerboten({ ...startStand, gamePhase: "transfer_sell_phase" })).toBe("nur_im_saisonaufbau");
    expect(dienst.ligaDraftAnlegenVerboten({ ...startStand, gamePhase: "preseason_management" })).toBeNull();
  });

  it("legt den Draft an: Sitze, Runde 1 nach Schwaeche (leer -> weniger Kasse zuerst), Liga gesperrt", () => {
    const draft = dienst.starteLigaDraft({
      persistence,
      saveId,
      selbstPickendeTeamIds: [menschTeamId],
      regeln: { maxRunden: 2, maxPicksJeTeam: 2 },
    });
    expect(draft.teams[menschTeamId]).toMatchObject({ art: "mensch", autoPick: false, status: "aktiv" });
    expect(Object.values(draft.teams).filter((team) => team.art === "ki")).toHaveLength(startStand.teams.length - 1);
    // Unter den leeren Kadern (gleiche Staerke) entscheidet die Kasse: weniger zuerst. (Der frische Stand hat ein Team mit
    // einem Spieler; seine Staerke liegt woanders, deshalb nur die leeren.)
    const leer = new Set(startStand.teams.filter((t) => !startStand.rosters.some((r) => r.teamId === t.teamId)).map((t) => t.teamId));
    const kasse = new Map(startStand.teams.map((team) => [team.teamId, team.cash ?? 0]));
    const kassen = draft.reihenfolge.filter((teamId) => leer.has(teamId)).map((teamId) => kasse.get(teamId)!);
    expect(kassen.length).toBeGreaterThan(20);
    expect(kassen).toEqual([...kassen].sort((a, b) => a - b));
    expect(draft.reihenfolge.at(-1)).toBe(menschTeamId);
    const gs = lade();
    expect(gs.seasonState.leagueSetupStatus).toBe("in_progress");
    expect(dienst.ligaDraftSperrtMarktkauf(gs)).toBe(true);
  });

  it("der erste KI-Pick ist die erste Entscheidung des Blocklaufs fuer dasselbe Team", async () => {
    const { planOrganicDraftForTeam } = await import("@/lib/ai/organic-squad/draft-adapter");
    const gs = lade();
    const draft = gs.seasonState.ligaDraft!;
    const erstesTeamId = modell.werIstDran(draft)!.teamId;
    const team = gs.teams.find((eintrag) => eintrag.teamId === erstesTeamId)!;
    const spielerById = new Map(gs.players.map((spieler) => [spieler.id, spieler]));
    const plan = planOrganicDraftForTeam({
      gameState: gs,
      team,
      identity: gs.teamIdentities.find((eintrag) => eintrag.teamId === erstesTeamId),
      startingSquad: gs.rosters.filter((r) => r.teamId === erstesTeamId).map((r) => spielerById.get(r.playerId)!),
      candidates: ki.freieSpieler(gs),
      draftSeed: ki.draftSaatFuerTeam(saveId, erstesTeamId),
      superstarLizenz: draft.teams[erstesTeamId]!.superstarLizenz ?? undefined,
    });
    const bewertung = ki.bewerteKiPick({ gameState: gs, saveId, draft, teamId: erstesTeamId, topN: 3 });
    expect(bewertung.kind).toBe("buy");
    expect(bewertung.top).toHaveLength(3);
    expect(bewertung.bestPlayerId).toBe(plan.decisions[0]!.playerId);
    expect(bewertung.top[0]!.nutzen).toBeCloseTo(plan.decisions[0]!.utility, 1);
    expect(bewertung.optTarget).toBe(plan.optTarget);
  }, 60_000);

  it("Saison 1: die Ruecklage der KI ist die halbe Finanzwert-Ruecklage (Quote wie Gehaltspuffer)", async () => {
    const { resolveKiRuecklageFuerTeam } = await import("@/lib/finance/ki-ruecklage");
    const { SAISON_EINS_RUECKLAGE_FAKTOR } = await import("@/lib/ai/organic-squad/draft-adapter");
    expect(SAISON_EINS_RUECKLAGE_FAKTOR).toBe(0.5);
    const gs = lade();
    // Ein KI-Team mit leerem Kader (Budget = Kasse).
    const teamId = gs.seasonState.ligaDraft!.reihenfolge.find((id) => id !== menschTeamId && !gs.rosters.some((r) => r.teamId === id))!;
    const team = gs.teams.find((eintrag) => eintrag.teamId === teamId)!;
    const voll = resolveKiRuecklageFuerTeam(gs, teamId, {
      cash: team.cash ?? 0,
      rosterSalaryTotal: 0,
      rosterMarketValue: 0,
      finances: gs.teamIdentities.find((eintrag) => eintrag.teamId === teamId)?.finances,
    });
    const bewertung = ki.bewerteKiPick({ gameState: gs, saveId, draft: gs.seasonState.ligaDraft!, teamId, topN: 1 });
    expect(bewertung.ruecklage).toBeCloseTo(voll.ruecklage * 0.5, 6);
  }, 60_000);

  it("faehrt die KI bis zum Menschen; jeder KI-Pick ist Platz 1 der Top 3 und laeuft ueber den Kaufweg", () => {
    const ergebnis = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 200 });
    expect(ergebnis.halt).toBe("mensch_am_zug");
    expect(modell.werIstDran(ergebnis.draft)).toMatchObject({ teamId: menschTeamId, automatisch: false });
    const gs = lade();
    const picks = ergebnis.eintraege.filter((eintrag) => eintrag.art === "pick");
    expect(picks.length).toBe(startStand.teams.length - 1);
    for (const eintrag of picks) {
      expect(eintrag.quelle).toBe("ki");
      if (eintrag.grund == null) expect(eintrag.playerId).toBe(eintrag.top3![0]!.playerId);
      const transfer = gs.transferHistory.find((t) => t.id === eintrag.transferId)!;
      expect(transfer).toMatchObject({ source: "ai_roster_fill", toTeamId: eintrag.teamId, playerId: eintrag.playerId });
      const vorher = startStand.teams.find((team) => team.teamId === eintrag.teamId)!.cash ?? 0;
      const nachher = gs.teams.find((team) => team.teamId === eintrag.teamId)!.cash ?? 0;
      expect(nachher).toBeCloseTo(vorher - (eintrag.abloese ?? 0), 2);
    }
  }, 180_000);

  it("die Sicht zeigt: Mensch am Zug, Draft wartet, Vorschlag des GM, Top 3 der naechsten KI-Teams", () => {
    const sicht = ansicht.baueLigaDraftAnsicht({ gameState: lade(), saveId, betrachterTeamId: menschTeamId, vorschau: 3 })!;
    expect(sicht.wartetAufMensch).toBe(true);
    expect(sicht.amZug).toMatchObject({ teamId: menschTeamId, art: "mensch", top3: null, top3Gruende: null });
    // Auslassen: NEIN — in diesem Kleinformat (2 Runden) reicht die eine Restrunde nicht mehr fuer 8 Pflichtplaetze
    // (Review #1619, A5); „fertig“ erst ab 8.
    expect(sicht.mein).toMatchObject({ amZug: true, darfPicken: true, darfAuslassen: false, darfFertig: false });
    expect(() =>
      dienst.bucheMenschAuslassen({ persistence, saveId, teamId: menschTeamId, erwarteteNr: sicht.stand }),
    ).toThrow("auslassen_unter_mindestkader");
    expect(sicht.mein!.vorschlag).toHaveLength(3);
    // Danach: Runde 2, KI-Teams mit ihren Top 3 und Karten ohne verdeckte Werte.
    const kiZug = sicht.naechste.find((zug) => zug.art === "ki")!;
    expect(kiZug.runde).toBe(2);
    expect(kiZug.top3).toHaveLength(3);
    expect(kiZug.top3Gruende!.map((g) => g.art).every((art) => ["star", "bedarf", "preis_leistung", "kadertiefe"].includes(art))).toBe(true);
    const karte = sicht.spieler[kiZug.top3![0]!]!;
    expect(Object.keys(karte).sort()).toEqual(["className", "gehalt", "marktwert", "name", "playerId", "race"]);
  }, 120_000);

  it("Fehler: KI-Team kann nicht von Hand picken, Fertig erst ab dem Mindestkader", () => {
    const kiTeam = Object.values(lade().seasonState.ligaDraft!.teams).find((team) => team.art === "ki")!.teamId;
    expect(() => dienst.bucheMenschPick({ persistence, saveId, teamId: kiTeam, playerId: "x" })).toThrow("team_ist_ki");
    expect(() => dienst.bucheMenschFertig({ persistence, saveId, teamId: menschTeamId })).toThrow("kader_unter_minimum");
    expect(() =>
      dienst.bucheMenschPick({ persistence, saveId, teamId: menschTeamId, playerId: "x", erwarteteNr: 0 }),
    ).toThrow("draft_stand_veraltet");
    // A5: mit Auto-Pick an pickt der GM — Auslassen ist dann abgelehnt (und aendert nichts).
    const stand = lade().seasonState.ligaDraft!.verlauf.length;
    dienst.setzeMenschAutoPick({ persistence, saveId, teamId: menschTeamId, an: true, erwarteteNr: stand });
    expect(() => dienst.bucheMenschAuslassen({ persistence, saveId, teamId: menschTeamId, erwarteteNr: stand })).toThrow(
      "auto_pick_ist_an",
    );
    dienst.setzeMenschAutoPick({ persistence, saveId, teamId: menschTeamId, an: false, erwarteteNr: stand });
    expect(lade().seasonState.ligaDraft!.verlauf.length).toBe(stand);
    expect(modell.werIstDran(lade().seasonState.ligaDraft!)).toMatchObject({ teamId: menschTeamId, automatisch: false });
  });

  it("Mensch-Pick ueber den Kaufweg der Kauf-Route; danach ist wieder die KI dran", () => {
    const gs = lade();
    const sicht = ansicht.baueLigaDraftAnsicht({ gameState: gs, saveId, betrachterTeamId: menschTeamId, vorschau: 0 })!;
    const playerId = sicht.mein!.vorschlag[0]!;
    const ergebnis = dienst.bucheMenschPick({ persistence, saveId, teamId: menschTeamId, playerId, erwarteteNr: sicht.stand });
    const nachher = lade();
    expect(nachher.transferHistory.find((t) => t.id === ergebnis.transferId)).toMatchObject({
      source: "manual_transfermarkt_buy",
      toTeamId: menschTeamId,
      playerId,
    });
    expect(nachher.rosters.some((r) => r.teamId === menschTeamId && r.playerId === playerId)).toBe(true);
    expect(ergebnis.draft.verlauf.at(-1)).toMatchObject({ art: "pick", quelle: "mensch", runde: 1 });
    expect(modell.werIstDran(ergebnis.draft)?.runde).toBe(2);
  });

  it("Variante A: Mensch geht in den Nachzug, KI pickt fertig, Liga ist bereit; Nachzug bis zum Mindestkader", () => {
    dienst.bucheMenschUeberspringen({ persistence, saveId, teamId: menschTeamId, variante: "A" });
    const lauf = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 200 });
    expect(lauf.halt).toBe("draft_vorbei");
    let gs = lade();
    expect(gs.seasonState.ligaDraft!.status).toBe("nachzug");
    expect(gs.seasonState.leagueSetupStatus).toBe("ready");
    expect(dienst.ligaDraftSperrtMarktkauf(gs)).toBe(false);
    // Jedes KI-Team hat hoechstens 2 Picks (Regel), keines mehr als erlaubt.
    for (const team of Object.values(gs.seasonState.ligaDraft!.teams)) {
      if (team.art === "ki") expect(team.picks).toBeLessThanOrEqual(2);
    }
    // Nachzug: ohne Reihenfolge die billigsten freien Spieler bis zum Mindestkader.
    while (gs.rosters.filter((r) => r.teamId === menschTeamId).length < 8) {
      const billigster = ki
        .freieSpieler(gs)
        .filter((spieler) => (spieler.marketValue ?? 0) > 0)
        .sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0))[0]!;
      dienst.bucheMenschPick({ persistence, saveId, teamId: menschTeamId, playerId: billigster.id });
      gs = lade();
    }
    expect(gs.seasonState.ligaDraft!.verlauf.at(-1)).toMatchObject({ quelle: "nachzug", platz: null });
    const fertig = dienst.bucheMenschFertig({ persistence, saveId, teamId: menschTeamId });
    expect(fertig.status).toBe("fertig");
    expect(lade().seasonState.ligaDraft!.beendetAm).not.toBeNull();
    expect(modell.ligaDraftLaeuft(lade())).toBe(false);
  }, 180_000);

  it("S1: ein fertiger Draft wird nie neu angelegt", () => {
    expect(() => dienst.starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [menschTeamId] })).toThrow("draft_schon_fertig");
    expect(lade().seasonState.ligaDraft!.status).toBe("fertig");
  });
});

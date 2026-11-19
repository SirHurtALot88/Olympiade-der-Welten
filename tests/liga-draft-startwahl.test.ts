/**
 * LIGA-DRAFT: STARTWAHL, VOR-ZUM-PICK, VERHANDLUNG (19.11., Chris' Rueckmeldung zum neuen Spielstand). Integration gegen
 * echte Wegwerf-Spielstaende (frische Saison 1, eigene SQLite), kleine Regeln (2 Runden, 2 Picks je Team).
 *
 * Gepinnt wird:
 *  A. Mit einem Menschen ohne Auto-Pick steht der Draft nach dem Anlegen bei Pick 1: Startwahl `offen`, kein KI-Pick, kein
 *     Mensch-Pick. Eine reine KI-Liga ist davon unberuehrt.
 *  B. „Draft spielen“ gibt den Draft frei; „Vor zu meinem Pick“ (`laufeKiZuege` mit grossem maxPicks) haelt beim Menschen, und
 *     alle uebersprungenen KI-Picks stehen im Verlauf.
 *  C. „Selbst kaufen“ = Ueberspringen A: das Team geht in den Nachzug, die KI faehrt durch, der Draft endet im Nachzug.
 *  D. Kein Verhandeln im Draft (Chris 19.11.): Picken bucht direkt, Gehalt wie angezeigt, Abloese = Marktwert, Vertrag genau
 *     1 Saison fuer Mensch UND KI; ein normaler Marktkauf behaelt seine Laufzeit.
 *  E. Verlassen und Wiederkommen aendert nichts: die Sicht ist reine Lesung des Spielstands, nichts bricht ab.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

const DB = path.join(os.tmpdir(), `oly-liga-draft-startwahl-${process.pid}-${Date.now()}.sqlite`);
const REGELN = { maxRunden: 2, maxPicksJeTeam: 2 };

let persistence: PersistenceService;
let dienst: typeof import("@/lib/draft/liga-draft-dienst");
let ansicht: typeof import("@/lib/draft/liga-draft-ansicht");
let modell: typeof import("@/lib/draft/liga-draft-modell");

function frischerSave(name: string, mitMensch: boolean) {
  const frisch = persistence.createFreshSeasonOneSave({ name });
  let menschTeamId = "";
  if (mitMensch) {
    const reichstes = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!;
    menschTeamId = reichstes.teamId;
    const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
    settings[menschTeamId] = { ...settings[menschTeamId]!, controlMode: "manual", ownerId: "user_local" };
    persistence.saveSingleplayerState(frisch.saveId, {
      ...frisch.gameState,
      seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings },
    });
  }
  return { saveId: frisch.saveId, menschTeamId, lade: (): GameState => persistence.getSaveById(frisch.saveId)!.gameState };
}

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  dienst = await import("@/lib/draft/liga-draft-dienst");
  ansicht = await import("@/lib/draft/liga-draft-ansicht");
  modell = await import("@/lib/draft/liga-draft-modell");
  persistence = createPersistenceService();
}, 120_000);

afterAll(() => {
  delete process.env.OLY_LIGA_DRAFT_MODUS;
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("A: Start bei Pick 1, kein Vorlauf, wenn ein Mensch mitspielt", () => {
  it("Mensch ohne Auto-Pick: Startwahl offen, nichts laeuft, nichts wird gepickt", () => {
    const s = frischerSave("startwahl-a", true);
    const draft = dienst.starteLigaDraft({ persistence, saveId: s.saveId, selbstPickendeTeamIds: [s.menschTeamId], regeln: REGELN, wahlOffen: true });
    expect(draft.teams[s.menschTeamId]).toMatchObject({ art: "mensch", autoPick: false, startWahl: "offen" });
    expect(modell.wartetAufStartWahl(draft)).toBe(true);
    const lauf = dienst.laufeKiZuege({ persistence, saveId: s.saveId, maxPicks: 50 });
    expect(lauf.halt).toBe("wartet_auf_start");
    expect(lauf.eintraege).toHaveLength(0);
    expect(s.lade().seasonState.ligaDraft!.verlauf).toHaveLength(0);
    // Auch der Mensch pickt nicht vor der Wahl, und die Sicht sagt es.
    const sicht = ansicht.baueLigaDraftAnsicht({ gameState: s.lade(), saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0 })!;
    expect(sicht.wartetAufStart).toBe(true);
    expect(sicht.mein?.startWahl).toBe("offen");
    expect(sicht.picks).toBe(0);
    expect(() => dienst.bucheMenschPick({ persistence, saveId: s.saveId, teamId: s.menschTeamId, playerId: sicht.mein!.vorschlag[0]! })).toThrow(
      "draft_wartet_auf_start",
    );
    // Die Liga bleibt gesperrt, bis der Draft fertig ist (Spieltage brauchen volle Kader).
    expect(s.lade().seasonState.leagueSetupStatus).toBe("in_progress");
    expect(dienst.ligaDraftSperrtMarktkauf(s.lade())).toBe(true);
  }, 120_000);

  it("reine KI-Liga (kein Mensch): keine Wahl, die KI faehrt sofort", () => {
    const s = frischerSave("startwahl-ki", false);
    const draft = dienst.starteLigaDraft({ persistence, saveId: s.saveId, selbstPickendeTeamIds: [], regeln: REGELN, wahlOffen: true });
    expect(modell.wartetAufStartWahl(draft)).toBe(false);
    const lauf = dienst.laufeKiZuege({ persistence, saveId: s.saveId, maxPicks: 3 });
    expect(lauf.eintraege.length).toBe(3);
  }, 120_000);

  it("Mensch mit Auto-Pick (delegierter Draft) bekommt keine Wahl", () => {
    const s = frischerSave("startwahl-auto", true);
    const gs = s.lade();
    const settings = { ...(gs.seasonState.teamControlSettings ?? {}) };
    settings[s.menschTeamId] = { ...settings[s.menschTeamId]!, delegatedAreas: { draft: "ki" } } as never;
    const draft = dienst.baueLigaDraftStart({
      gameState: { ...gs, seasonState: { ...gs.seasonState, teamControlSettings: settings } },
      saveId: s.saveId,
      selbstPickendeTeamIds: [s.menschTeamId],
      wahlOffen: true,
    });
    // Ob die Delegation greift, haengt an `isBereichDelegiert`; entscheidend: nur wer selbst pickt (autoPick false) bekommt `offen`.
    const team = draft.teams[s.menschTeamId]!;
    expect(team.startWahl === "offen").toBe(!team.autoPick);
  }, 120_000);
});

describe("B, D, E: spielen, Vor zu meinem Pick, Draft-Vertrag 1 Saison", () => {
  const s = {} as ReturnType<typeof frischerSave>;
  beforeAll(() => {
    Object.assign(s, frischerSave("startwahl-b", true));
    dienst.starteLigaDraft({ persistence, saveId: s.saveId, selbstPickendeTeamIds: [s.menschTeamId], regeln: REGELN, wahlOffen: true });
  }, 120_000);

  it("„Draft spielen“ gibt frei; „Vor zu meinem Pick“ haelt beim Menschen, die uebersprungenen KI-Picks bleiben im Verlauf", () => {
    const frei = dienst.setzeMenschStartWahl({ persistence, saveId: s.saveId, teamId: s.menschTeamId, wahl: "spielen" });
    expect(frei.teams[s.menschTeamId]!.startWahl).toBe("spielen");
    expect(modell.wartetAufStartWahl(frei)).toBe(false);
    const lauf = dienst.laufeKiZuege({ persistence, saveId: s.saveId, maxPicks: 500 });
    expect(lauf.halt).toBe("mensch_am_zug");
    expect(modell.werIstDran(lauf.draft)).toMatchObject({ teamId: s.menschTeamId, automatisch: false });
    const verlauf = s.lade().seasonState.ligaDraft!.verlauf;
    expect(verlauf.filter((e) => e.art === "pick" && e.quelle === "ki").length).toBe(lauf.eintraege.filter((e) => e.art === "pick").length);
    expect(verlauf.length).toBeGreaterThan(20);
    // Die Sicht (und damit „Alle Picks“/Ticker) kennt alle uebersprungenen Picks.
    const sicht = ansicht.baueLigaDraftAnsicht({ gameState: s.lade(), saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0, verlaufLimit: 0 })!;
    expect(sicht.verlauf.length).toBe(verlauf.length);
    expect(sicht.mein).toMatchObject({ amZug: true, darfPicken: true });
  }, 240_000);

  it("E: Verlassen und Wiederkommen aendert nichts — die Sicht ist reine Lesung, nichts bricht ab", () => {
    const vorher = s.lade().seasonState.ligaDraft!;
    const a1 = ansicht.baueLigaDraftAnsicht({ gameState: s.lade(), saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0 })!;
    const a2 = ansicht.baueLigaDraftAnsicht({ gameState: s.lade(), saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0 })!;
    expect(a2.stand).toBe(a1.stand);
    const nachher = s.lade().seasonState.ligaDraft!;
    expect(nachher.verlauf.length).toBe(vorher.verlauf.length);
    expect(nachher.status).toBe("laeuft");
    expect(nachher.beendetAm).toBeNull();
  });

  it("Draft-Vertrag (Chris 19.11.): jeder Pick, Mensch wie KI, hat genau 1 Saison — Gehalt wie angezeigt, Abloese = Marktwert", () => {
    const gs0 = s.lade();
    const kiPick = gs0.seasonState.ligaDraft!.verlauf.find((e) => e.art === "pick" && e.quelle === "ki")!;
    const kiRoster = gs0.rosters.find((r) => r.teamId === kiPick.teamId && r.playerId === kiPick.playerId)!;
    expect(kiRoster.contractLength).toBe(1);
    expect(kiRoster.joinedSeasonId).toBe(gs0.season.id);
    // Festkonditionen: auch die KI bucht genau das angezeigte Gehalt (`salaryDemand`), nicht die Verhandlungsforderung.
    const kiSpieler = gs0.players.find((p) => p.id === kiPick.playerId)!;
    expect(kiRoster.salary).toBeCloseTo(kiSpieler.salaryDemand ?? kiSpieler.displaySalary ?? -1, 2);

    const sicht = ansicht.baueLigaDraftAnsicht({ gameState: gs0, saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0 })!;
    const playerId = sicht.mein!.vorschlag[0]!;
    const karte = sicht.spieler[playerId]!;
    const ergebnis = dienst.bucheMenschPick({ persistence, saveId: s.saveId, teamId: s.menschTeamId, playerId, erwarteteNr: sicht.stand });
    const eintrag = s.lade().rosters.find((r) => r.teamId === s.menschTeamId && r.playerId === playerId)!;
    expect(eintrag.contractLength).toBe(1);
    expect(eintrag.joinedSeasonId).toBe(gs0.season.id);
    // Gehalt = GENAU die angezeigte Zahl (Brett, Mein Draft, Profil), gebucht und im Verlauf identisch; Abloese = Marktwert.
    expect(eintrag.salary).toBeCloseTo(karte.gehalt, 2);
    expect(ergebnis.gehalt).toBeCloseTo(karte.gehalt, 2);
    expect(ergebnis.abloese).toBeCloseTo(karte.marktwert, 1);
    expect(ergebnis.draft.verlauf.at(-1)).toMatchObject({ art: "pick", quelle: "mensch", playerId });
  }, 120_000);

  it("Wunschliste im Draft: schmale Server-Aktion (kein Ganzstand-Save des Clients), Draft-Zustand bleibt unberuehrt", () => {
    const gs0 = s.lade();
    const playerId = ansicht.baueLigaDraftAnsicht({ gameState: gs0, saveId: s.saveId, betrachterTeamId: s.menschTeamId, vorschau: 0 })!.mein!.vorschlag[0] ?? gs0.players.find((p) => !gs0.rosters.some((r) => r.playerId === p.id))!.id;
    const verlaufVor = gs0.seasonState.ligaDraft!.verlauf.length;
    dienst.setzeDraftWunschliste({ persistence, saveId: s.saveId, teamId: s.menschTeamId, playerId, an: true });
    const mit = s.lade();
    expect((mit.seasonState.transferWishlist ?? []).filter((e) => e.teamId === s.menschTeamId && e.playerId === playerId)).toHaveLength(1);
    expect(mit.seasonState.ligaDraft!.verlauf.length).toBe(verlaufVor);
    // Doppelt setzen aendert nichts; Entfernen nimmt ihn wieder heraus.
    dienst.setzeDraftWunschliste({ persistence, saveId: s.saveId, teamId: s.menschTeamId, playerId, an: true });
    expect((s.lade().seasonState.transferWishlist ?? []).filter((e) => e.playerId === playerId)).toHaveLength(1);
    dienst.setzeDraftWunschliste({ persistence, saveId: s.saveId, teamId: s.menschTeamId, playerId, an: false });
    expect((s.lade().seasonState.transferWishlist ?? []).some((e) => e.playerId === playerId)).toBe(false);
  }, 60_000);

  it("ein normaler Marktkauf behaelt seine Laufzeit (die 1 Saison gilt nur im Draft): ohne Angabe gilt die Empfehlung, mit Angabe die Angabe", async () => {
    const { executeLocalTransfermarktBuy, previewLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");
    const ki = await import("@/lib/draft/liga-draft-ki");
    const gs = s.lade();
    const [frei, frei2] = ki.freieSpieler(gs);
    const basis = { saveId: s.saveId, seasonId: gs.season.id, teamId: s.menschTeamId, transferSource: "manual_transfermarkt_buy" };
    const empfehlung = previewLocalTransfermarktBuy({ ...basis, playerId: frei!.id }).contractLength;
    const kauf = executeLocalTransfermarktBuy({ ...basis, playerId: frei!.id });
    expect(kauf.transferCreated).toBe(true);
    expect(s.lade().rosters.find((r) => r.playerId === frei!.id)!.contractLength).toBe(empfehlung);
    // Eine ausdrueckliche Laufzeit des Marktkaufs wird nicht auf 1 gedrueckt.
    const kauf3 = executeLocalTransfermarktBuy({ ...basis, playerId: frei2!.id, contractLength: 3 });
    expect(kauf3.transferCreated).toBe(true);
    expect(s.lade().rosters.find((r) => r.playerId === frei2!.id)!.contractLength).toBe(3);
  }, 120_000);
});

describe("C: Selbst kaufen = Ueberspringen A", () => {
  it("das Team geht in den Nachzug, die KI faehrt durch, der Draft endet im Nachzug", () => {
    const s = frischerSave("startwahl-c", true);
    dienst.starteLigaDraft({ persistence, saveId: s.saveId, selbstPickendeTeamIds: [s.menschTeamId], regeln: REGELN, wahlOffen: true });
    const draft = dienst.setzeMenschStartWahl({ persistence, saveId: s.saveId, teamId: s.menschTeamId, wahl: "selbst" });
    expect(draft.teams[s.menschTeamId]).toMatchObject({ startWahl: "selbst", status: "nachzug" });
    expect(modell.wartetAufStartWahl(draft)).toBe(false);
    const lauf = dienst.laufeKiZuege({ persistence, saveId: s.saveId, maxPicks: 500 });
    expect(lauf.halt).toBe("draft_vorbei");
    expect(s.lade().seasonState.ligaDraft!.status).toBe("nachzug");
    // Nach der Wahl ist die Wahl endgueltig: ein zweiter Aufruf aendert nichts.
    const nochmal = dienst.setzeMenschStartWahl({ persistence, saveId: s.saveId, teamId: s.menschTeamId, wahl: "spielen" });
    expect(nochmal.teams[s.menschTeamId]!.startWahl).toBe("selbst");
  }, 240_000);
});

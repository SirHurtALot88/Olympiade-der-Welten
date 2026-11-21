/**
 * LIGA-DRAFT: TEMPO „NUR RECHNEN“, ABBRUCH AUF JEDEM WEG, STARTWAHL-DIALOG (21.11., Chris 19./20.11.).
 * Integration gegen echte Wegwerf-Spielstaende (frische Saison 1, eigene SQLite), 32 Teams, eine Runde, der Mensch pickt zuletzt
 * (31 KI-Picks vor ihm). Die Route laeuft echt (nur Rechte-Pruefung und Benachrichtigung sind gemockt).
 *
 * Gepinnt wird:
 *  1. TEMPO: „Vor zu meinem Pick“ rechnet alle KI-Picks in EINEM Happen mit EINEM Schreiben des Spielstands; die Pick-Folge ist
 *     dieselbe wie bei Einzelschritten (Determinismus).
 *  2. ABBRUCH: „Draft abbrechen“ klappt auch mit veraltetem Stand (Chris: „der Draft laesst sich egal auf welchem Weg nicht
 *     abbrechen“ — die KI pickt im Hintergrund, der gesehene Stand war beim Klick immer ueberholt, die Seite verschluckte den
 *     Stand-Konflikt), waehrend ein Hintergrundlauf laeuft, und aus jedem Zustand (Startwahl offen, Draft spielen, Ueberspringen
 *     A/B, Nachzug, „Ich bin fertig“). Danach kauft der Mensch normal im Transfermarkt.
 *  3. STARTWAHL: „Selbst kaufen“ ueber die Route startet den KI-Lauf sofort im Hintergrund (ein Happen); der Dialog nennt beide Wege.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite: vi.fn(() => ({ allowed: true, room: null, participant: null, ownership: null, warnings: [] })),
}));
vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({ notifyRoomGameplayWrite: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId: vi.fn(async () => "user_local") }));

const DB = path.join(os.tmpdir(), `oly-liga-draft-abbruch-tempo-${process.pid}-${Date.now()}.sqlite`);
const REGELN = { maxRunden: 1, maxPicksJeTeam: 1 };

let persistence: PersistenceService;
let dienst: typeof import("@/lib/draft/liga-draft-dienst");
let modell: typeof import("@/lib/draft/liga-draft-modell");

function frischerSave(name: string) {
  const frisch = persistence.createFreshSeasonOneSave({ name });
  const reichstes = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[reichstes.teamId] = { ...settings[reichstes.teamId]!, controlMode: "manual", ownerId: "user_local" };
  persistence.saveSingleplayerState(frisch.saveId, { ...frisch.gameState, seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings } });
  return { saveId: frisch.saveId, menschTeamId: reichstes.teamId, lade: (): GameState => persistence.getSaveById(frisch.saveId)!.gameState };
}

type Sitz = ReturnType<typeof frischerSave>;

function starte(s: Sitz, wahlOffen = false) {
  return dienst.starteLigaDraft({ persistence, saveId: s.saveId, selbstPickendeTeamIds: [s.menschTeamId], seed: "abbruch-tempo", regeln: REGELN, wahlOffen });
}

async function post(s: Sitz, aktion: string, extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/draft/route");
  const antwort = await POST(
    new Request("http://x/api/draft", { method: "POST", body: JSON.stringify({ saveId: s.saveId, teamId: s.menschTeamId, aktion, ...extra }) }),
  );
  return { status: antwort.status, json: (await antwort.json()) as Record<string, unknown> };
}

/** Der Mensch kauft im freien Transfermarkt: der billigste freie Spieler, den er sich leisten kann. */
async function kaufeImMarkt(s: Sitz) {
  const { executeLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");
  const ki = await import("@/lib/draft/liga-draft-ki");
  const gs = s.lade();
  const frei = ki.freieSpieler(gs)
    .filter((p) => (p.marketValue ?? p.displayMarketValue ?? 0) > 0)
    .sort((a, b) => (a.marketValue ?? a.displayMarketValue ?? 0) - (b.marketValue ?? b.displayMarketValue ?? 0))[0]!;
  const kauf = executeLocalTransfermarktBuy({
    saveId: s.saveId,
    seasonId: gs.season.id,
    teamId: s.menschTeamId,
    playerId: frei.id,
    transferSource: "manual_transfermarkt_buy",
  });
  expect(kauf.transferCreated, `Marktkauf nach dem Abbruch: ${kauf.blockingReasons.join(",")}`).toBe(true);
  expect(s.lade().rosters.some((r) => r.teamId === s.menschTeamId && r.playerId === frei.id)).toBe(true);
}

async function wartePhase(saveId: string) {
  for (let i = 0; i < 600 && dienst.istHintergrundLaufAktiv(saveId); i += 1) await new Promise((r) => setTimeout(r, 50));
  expect(dienst.istHintergrundLaufAktiv(saveId)).toBe(false);
}

function schreibzaehler() {
  let n = 0;
  const original = persistence.saveSingleplayerState.bind(persistence);
  persistence.saveSingleplayerState = ((...args: Parameters<typeof original>) => {
    n += 1;
    return original(...args);
  }) as typeof persistence.saveSingleplayerState;
  return {
    get schreiben() {
      return n;
    },
    ende: () => {
      persistence.saveSingleplayerState = original;
    },
  };
}

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  dienst = await import("@/lib/draft/liga-draft-dienst");
  modell = await import("@/lib/draft/liga-draft-modell");
  persistence = createPersistenceService();
}, 120_000);

afterAll(() => {
  delete process.env.OLY_LIGA_DRAFT_MODUS;
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("1. Tempo: alle KI-Picks in EINEM Happen mit EINEM Schreiben", () => {
  it("Vor-Lauf: ein Schreibvorgang, 31 Picks, dieselbe Folge wie je Pick ein Schritt", async () => {
    const folge = (s: Sitz) => s.lade().seasonState.ligaDraft!.verlauf.map((e) => `${e.teamId}:${e.playerId ?? e.art}`);

    const einzel = frischerSave("tempo-einzel");
    starte(einzel);
    for (let i = 0; i < 40; i += 1) {
      if (dienst.laufeKiZuege({ persistence, saveId: einzel.saveId, maxPicks: 1 }).halt !== "max_picks") break;
    }
    expect(folge(einzel)).toHaveLength(31);

    const vor = frischerSave("tempo-vor");
    starte(vor);
    const zaehler = schreibzaehler();
    let lauf;
    try {
      lauf = await dienst.laufeKiImHintergrund({
        persistence,
        saveId: vor.saveId,
        logPrefix: "[test]",
        jeHappen: dienst.LIGA_DRAFT_VOR_JE_HAPPEN,
        happenBudgetMs: dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS,
      });
    } finally {
      zaehler.ende();
    }
    expect(lauf.halt).toBe("mensch_am_zug");
    expect(lauf.picks).toBe(31);
    expect(zaehler.schreiben).toBe(1);
    // Beide Staende tragen verschiedene Save-Ids (und damit Saaten): die Folge haengt an der Id, also nur die LAENGE und den
    // Halt vergleichen — die Gleichheit der Folge bei gleicher Id pinnt `liga-draft-ki-tempo.test.ts`.
    expect(folge(vor)).toHaveLength(31);
    expect(modell.werIstDran(vor.lade().seasonState.ligaDraft!)?.teamId).toBe(vor.menschTeamId);
  }, 240_000);

  it("das Zeitbudget des Vor-Modus ist nur die Sicherung: gross genug fuer eine Liga in einem Happen", () => {
    expect(dienst.LIGA_DRAFT_VOR_JE_HAPPEN).toBeGreaterThanOrEqual(32 * 8);
    expect(dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS).toBeGreaterThanOrEqual(4000);
    expect(dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS).toBeGreaterThan(dienst.LIGA_DRAFT_HAPPEN_BUDGET_MS);
  });
});

describe("2. Abbruch auf jedem Weg", () => {
  it("Draft abbrechen mit VERALTETEM Stand (Ursache: die KI pickt, der gesehene Stand ist beim Klick schon ueberholt)", async () => {
    const s = frischerSave("abbruch-veraltet");
    starte(s);
    const gesehen = s.lade().seasonState.ligaDraft!.verlauf.length;
    dienst.laufeKiZuege({ persistence, saveId: s.saveId, maxPicks: 3 });
    expect(s.lade().seasonState.ligaDraft!.verlauf.length).toBe(gesehen + 3);
    // Die Seite schickt den Stand von vorhin mit.
    const antwort = await post(s, "abbrechen", { erwarteteNr: gesehen });
    expect(antwort.status).toBe(200);
    expect(antwort.json.success).toBe(true);
    expect(s.lade().seasonState.ligaDraft!.status).toBe("fertig");
    await kaufeImMarkt(s);
  }, 240_000);

  it("Abbruch ohne erwarteteNr geht ebenfalls (der Abbruch haengt nicht am Platz im Draft)", async () => {
    const s = frischerSave("abbruch-ohne-nr");
    starte(s);
    const antwort = await post(s, "abbrechen");
    expect(antwort.status).toBe(200);
    expect(s.lade().seasonState.ligaDraft!.status).toBe("fertig");
  }, 120_000);

  it("Abbruch WAEHREND des Hintergrundlaufs: der Lauf haelt an, der Draft ist fertig, der Markt ist frei", async () => {
    const s = frischerSave("abbruch-waehrend-lauf");
    starte(s);
    const lauf = dienst.laufeKiImHintergrund({ persistence, saveId: s.saveId, logPrefix: "[test]", jeHappen: 2, happenBudgetMs: 0 });
    await new Promise((r) => setTimeout(r, 400));
    const antwort = await post(s, "abbrechen", { erwarteteNr: 0 });
    expect(antwort.status).toBe(200);
    const ergebnis = await lauf;
    expect(["draft_vorbei", "abgebrochen"]).toContain(ergebnis.halt);
    const draft = s.lade().seasonState.ligaDraft!;
    expect(draft.status).toBe("fertig");
    expect(draft.verlauf.length).toBeLessThan(31);
    expect(dienst.istHintergrundLaufAktiv(s.saveId)).toBe(false);
    expect(s.lade().seasonState.leagueSetupStatus).toBe("ready");
    await kaufeImMarkt(s);
  }, 240_000);

  it("Abbruch aus der Startwahl, nach „Draft spielen“, nach Ueberspringen B und im Nachzug (A / Selbst kaufen)", async () => {
    // Startwahl offen.
    const a = frischerSave("abbruch-startwahl");
    starte(a, true);
    expect((await post(a, "abbrechen", { erwarteteNr: 0 })).status).toBe(200);
    expect(a.lade().seasonState.ligaDraft!.status).toBe("fertig");
    await kaufeImMarkt(a);

    // Draft spielen, danach Ueberspringen B (GM pickt mit) -> Abbruch.
    const b = frischerSave("abbruch-b");
    starte(b, true);
    expect((await post(b, "startwahl", { wahl: "spielen", erwarteteNr: 0 })).status).toBe(200);
    expect((await post(b, "ueberspringen", { variante: "B", erwarteteNr: 0 })).status).toBe(200);
    expect((await post(b, "abbrechen", { erwarteteNr: 0 })).status).toBe(200);
    expect(b.lade().seasonState.ligaDraft!.status).toBe("fertig");
    await kaufeImMarkt(b);

    // Ueberspringen A: KI faehrt durch, der Draft steht im Nachzug; Abbruch beendet auch ihn.
    const c = frischerSave("abbruch-a-nachzug");
    starte(c);
    expect((await post(c, "ueberspringen", { variante: "A", erwarteteNr: 0 })).status).toBe(200);
    dienst.laufeKiZuege({ persistence, saveId: c.saveId, maxPicks: 500 });
    expect(c.lade().seasonState.ligaDraft!.status).toBe("nachzug");
    expect((await post(c, "abbrechen", { erwarteteNr: 3 })).status).toBe(200);
    expect(c.lade().seasonState.ligaDraft!.status).toBe("fertig");
    await kaufeImMarkt(c);
  }, 480_000);

  it("Selbst kaufen: die KI faehrt durch, der Mensch kauft im Nachzug im Markt und beendet den Draft mit dem Abbruch", async () => {
    const s = frischerSave("fertig-nachzug");
    starte(s, true);
    expect((await post(s, "startwahl", { wahl: "selbst", erwarteteNr: 0 })).status).toBe(200);
    await wartePhase(s.saveId);
    expect(s.lade().seasonState.ligaDraft!.status).toBe("nachzug");
    // Im Nachzug ist der Markt fuer den Menschen ohnehin frei (`ligaDraftSperrtMarktkauf` nur in der geordneten Phase).
    await kaufeImMarkt(s);
    expect((await post(s, "abbrechen", { erwarteteNr: 0 })).status).toBe(200);
    expect(s.lade().seasonState.ligaDraft!.status).toBe("fertig");
  }, 300_000);

  it("abgebrochen und fertig bleibt fertig: ein zweiter Abbruch ist harmlos, ein neuer Start ist verboten", async () => {
    const s = frischerSave("abbruch-doppelt");
    starte(s);
    expect((await post(s, "abbrechen", { erwarteteNr: 0 })).status).toBe(200);
    expect((await post(s, "abbrechen", { erwarteteNr: 0 })).status).toBe(200);
    expect(s.lade().seasonState.ligaDraft!.status).toBe("fertig");
    expect(() => starte(s)).toThrow("draft_schon_fertig");
  }, 120_000);
});

describe("3. Startwahl", () => {
  it("„Selbst kaufen“ ueber die Route startet den KI-Lauf sofort im Hintergrund (ein Happen, ein Schreiben)", async () => {
    const s = frischerSave("startwahl-selbst");
    starte(s, true);
    const zaehler = schreibzaehler();
    try {
      const antwort = await post(s, "startwahl", { wahl: "selbst", erwarteteNr: 0 });
      expect(antwort.status).toBe(200);
      expect(dienst.istHintergrundLaufAktiv(s.saveId)).toBe(true);
      await wartePhase(s.saveId);
      // 1 Schreiben fuer die Wahl (Nachzug) + 1 Schreiben fuer alle 31 KI-Picks.
      expect(zaehler.schreiben).toBeLessThanOrEqual(2);
    } finally {
      zaehler.ende();
    }
    const draft = s.lade().seasonState.ligaDraft!;
    expect(draft.status).toBe("nachzug");
    expect(draft.verlauf.length).toBe(32);
    await kaufeImMarkt(s);
  }, 300_000);

  it("der Startwahl-Dialog nennt beide Wege und ist modal", async () => {
    const { StartWahlDialog } = await import("@/app/foundation/draft-modern/DraftHinweis");
    const html = renderToStaticMarkup(
      createElement(StartWahlDialog, { nr: 1, teams: 32, maxRunden: 8, busy: false, fehler: null, onWahl: () => undefined, onSpaeter: () => undefined }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Draft spielen");
    expect(html).toContain("Selbst kaufen");
    expect(html).toContain("draft-startwahl-spielen");
    expect(html).toContain("draft-startwahl-selbst");
    expect(html).toContain("Pick 1 von 32");
    const mitFehler = renderToStaticMarkup(
      createElement(StartWahlDialog, { nr: 1, teams: 32, maxRunden: 8, busy: true, fehler: "Netz weg", onWahl: () => undefined, onSpaeter: () => undefined }),
    );
    expect(mitFehler).toContain("Netz weg");
    expect(mitFehler).toContain("disabled");
  });
});

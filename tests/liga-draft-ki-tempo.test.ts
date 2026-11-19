/**
 * TEMPO DER DRAFT-KI (19.11., docs/design/draft-ki-tempo-19-11.md) — schneller, aber dieselben Picks.
 *
 * Chris: „Wenn ich direkt zu meinem Pick springen will, soll die KI wirklich im Schnelldurchlauf sein.“ Gemessen kostete ein
 * KI-Pick ~860 ms (davon ~400 ms Schreiben des ganzen Spielstands, ~70 ms Markt-Schluessel, ~170 ms Theme-Tags). Gepinnt wird:
 *  1. Die Pick-Folge ist gleich, egal ob Einzelschritte, ein grosser Schritt oder der Vor-Hintergrundlauf (Determinismus:
 *     dieselbe Saat, derselbe Stand, dieselben Picks; keine Aenderung daran, WELCHEN Spieler die KI waehlt).
 *  2. Das Happen-Budget bestimmt die Zahl der Schreibvorgaenge: Standard (0 ms) schreibt je Pick, der Vor-Modus buendelt.
 *  3. Die inhaltsgeschluesselte Theme-Tag-Ablage liefert exakt dieselben Tags wie die Berechnung.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

const DB = path.join(os.tmpdir(), `oly-liga-draft-ki-tempo-${process.pid}-${Date.now()}.sqlite`);

let persistence: PersistenceService;
let saveId = "";
let dienst: typeof import("@/lib/draft/liga-draft-dienst");
let startStand: GameState;

const lade = () => persistence.getSaveById(saveId)!.gameState;
const zuruecksetzen = () => {
  persistence.saveSingleplayerState(saveId, startStand);
};
const folge = () => lade().seasonState.ligaDraft!.verlauf.map((e) => `${e.teamId}:${e.playerId ?? e.art}`);

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  dienst = await import("@/lib/draft/liga-draft-dienst");
  persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "liga-draft-ki-tempo" });
  saveId = frisch.saveId;
  const reichstes = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[reichstes.teamId] = { ...settings[reichstes.teamId]!, controlMode: "manual", ownerId: "user_local" };
  persistence.saveSingleplayerState(saveId, {
    ...frisch.gameState,
    seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings },
  });
  // Eine Runde, ein Pick je Team: 31 KI-Picks vor dem Menschen (der als reichstes Team zuletzt dran ist).
  dienst.starteLigaDraft({
    persistence,
    saveId,
    selbstPickendeTeamIds: [reichstes.teamId],
    seed: "tempo-test",
    regeln: { maxRunden: 1, maxPicksJeTeam: 1 },
  });
  startStand = lade();
}, 180_000);

afterAll(() => {
  delete process.env.OLY_LIGA_DRAFT_MODUS;
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("Draft-KI-Tempo: gleiche Picks, weniger Schreibvorgaenge", () => {
  it("Pick-Folge ist identisch: Einzelschritte, ein grosser Schritt und der Vor-Hintergrundlauf", async () => {
    // A: je Pick ein Schritt (so taktet die Seite bei 1x).
    zuruecksetzen();
    for (let i = 0; i < 40; i += 1) {
      const lauf = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 1 });
      if (lauf.halt !== "max_picks") break;
    }
    const einzel = folge();
    expect(einzel.length).toBeGreaterThanOrEqual(30);

    // B: ein grosser Schritt (so holt die Seite bei 3x mehrere Picks auf einmal).
    zuruecksetzen();
    const gross = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 8 });
    expect(gross.eintraege.length).toBe(8);
    while (dienst.laufeKiZuege({ persistence, saveId, maxPicks: 8 }).halt === "max_picks") {
      /* weiter */
    }
    expect(folge()).toEqual(einzel);

    // C: Vor-Hintergrundlauf mit dem grossen Zeitbudget.
    zuruecksetzen();
    const vor = await dienst.laufeKiImHintergrund({
      persistence,
      saveId,
      logPrefix: "[test]",
      jeHappen: dienst.LIGA_DRAFT_VOR_JE_HAPPEN,
      happenBudgetMs: dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS,
    });
    expect(vor.halt).toBe("mensch_am_zug");
    expect(folge()).toEqual(einzel);

    // D: der Standard-Hintergrundlauf (120 ms) ebenso.
    zuruecksetzen();
    await dienst.laufeKiImHintergrund({ persistence, saveId, logPrefix: "[test]" });
    expect(folge()).toEqual(einzel);
  }, 240_000);

  it("das Happen-Budget bestimmt die Zahl der Schreibvorgaenge (Vor-Modus buendelt, 0 ms schreibt je Pick)", async () => {
    let schreibvorgaenge = 0;
    const original = persistence.saveSingleplayerState.bind(persistence);
    persistence.saveSingleplayerState = ((...args: Parameters<typeof original>) => {
      schreibvorgaenge += 1;
      return original(...args);
    }) as typeof persistence.saveSingleplayerState;
    try {
      // Budget 0: mindestens ein Pick je Happen, also ein Schreiben je Pick.
      zuruecksetzen();
      schreibvorgaenge = 0;
      const eng = await dienst.laufeKiImHintergrund({ persistence, saveId, logPrefix: "[test]", jeHappen: 40, happenBudgetMs: 0 });
      const picksEng = eng.picks;
      const schreibenEng = schreibvorgaenge;
      expect(picksEng).toBeGreaterThanOrEqual(30);
      expect(schreibenEng).toBeGreaterThanOrEqual(picksEng);

      // Vor-Modus: grosses Budget, 40 Picks je Happen — wenige Happen, wenige Schreibvorgaenge.
      zuruecksetzen();
      schreibvorgaenge = 0;
      const vor = await dienst.laufeKiImHintergrund({
        persistence,
        saveId,
        logPrefix: "[test]",
        jeHappen: dienst.LIGA_DRAFT_VOR_JE_HAPPEN,
        happenBudgetMs: 600_000,
      });
      expect(vor.picks).toBe(picksEng);
      expect(schreibvorgaenge).toBeLessThanOrEqual(2);
      expect(dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS).toBeGreaterThan(dienst.LIGA_DRAFT_HAPPEN_BUDGET_MS);
      expect(dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS).toBeLessThanOrEqual(1500);
    } finally {
      persistence.saveSingleplayerState = original;
    }
  }, 240_000);

  it("derivePlayerThemeTagsCached liefert exakt die Tags von derivePlayerThemeTags (auch fuer neue Objekte gleichen Inhalts)", async () => {
    const { derivePlayerThemeTags, derivePlayerThemeTagsCached } = await import("@/lib/ai/team-theme-composition-service");
    const spieler = lade().players.slice(0, 300);
    for (const p of spieler) {
      const kopie = JSON.parse(JSON.stringify(p));
      expect(derivePlayerThemeTagsCached(p)).toEqual(derivePlayerThemeTags(p));
      expect(derivePlayerThemeTagsCached(kopie)).toEqual(derivePlayerThemeTags(p));
    }
  });
});

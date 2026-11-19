/**
 * Hintergrundarbeit ist abwartbar und abbrechbar (#1642).
 *
 * Befund: nach jedem neuen Spiel pickt die KI den Liga-Draft im Hintergrund weiter, und niemand wartete darauf. In
 * tests/mehrspieler-1v1-2v2-modi.test.ts liefen so sechs Drafts nach Testende weiter und hielten die Event-Loop fest — ein
 * 6-ms-Test der Folge lief in den 20-s-Timeout (Datei 83 s statt 26 s). Geprueft wird hier:
 *  - das Register (lib/hintergrund/hintergrund-arbeit.ts) bricht ab und wartet, `ausser` laesst Aelteres laufen;
 *  - das Test-Setup beendet nach jedem Test, was der Test angestossen hat;
 *  - der Draft-Hintergrundlauf haelt beim naechsten Happen an, und ein Happen haelt sich an sein Zeitbudget.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PersistenceService } from "@/lib/persistence/types";
import {
  beendeHintergrundArbeit,
  hintergrundArbeitAbzug,
  laufendeHintergrundArbeit,
  meldeHintergrundArbeit,
} from "@/lib/hintergrund/hintergrund-arbeit";

/** Eine Arbeit, die ohne Abbruch nie endet (wie ein Draft, den keiner abwartet). */
function endloseArbeit() {
  const zustand = { abgebrochen: false, runden: 0 };
  const promise = (async () => {
    while (!zustand.abgebrochen) {
      zustand.runden += 1;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return "abgebrochen";
  })();
  meldeHintergrundArbeit(promise, () => {
    zustand.abgebrochen = true;
  });
  return { zustand, promise };
}

describe("Register der Hintergrundarbeit", () => {
  it("bricht angemeldete Arbeit ab, wartet auf sie und meldet sie ab", async () => {
    const arbeit = endloseArbeit();
    expect(laufendeHintergrundArbeit()).toBe(1);
    await beendeHintergrundArbeit();
    expect(arbeit.zustand.abgebrochen).toBe(true);
    await expect(arbeit.promise).resolves.toBe("abgebrochen");
    expect(laufendeHintergrundArbeit()).toBe(0);
  });

  it("`ausser` laesst Arbeit aus einem frueheren Abzug weiterlaufen", async () => {
    const alt = endloseArbeit();
    const abzug = hintergrundArbeitAbzug();
    const neu = endloseArbeit();
    await beendeHintergrundArbeit({ ausser: abzug });
    expect(neu.zustand.abgebrochen).toBe(true);
    expect(alt.zustand.abgebrochen).toBe(false);
    expect(laufendeHintergrundArbeit()).toBe(1);
    await beendeHintergrundArbeit();
    expect(alt.zustand.abgebrochen).toBe(true);
  });

  it("Fehler einer Arbeit melden sie ebenfalls ab", async () => {
    const promise = Promise.reject(new Error("kaputt"));
    meldeHintergrundArbeit(promise, () => undefined);
    await beendeHintergrundArbeit();
    await expect(promise).rejects.toThrow("kaputt");
    expect(laufendeHintergrundArbeit()).toBe(0);
  });
});

describe("Test-Setup: was ein Test anstoesst, endet mit dem Test", () => {
  let liegengelassen: ReturnType<typeof endloseArbeit> | null = null;

  it("Test A stoesst Arbeit an und wartet nicht auf sie", () => {
    liegengelassen = endloseArbeit();
    expect(laufendeHintergrundArbeit()).toBe(1);
  });

  it("Test B findet sie beendet vor (afterEach in tests/setup/sqlite-pro-testdatei.ts)", () => {
    expect(liegengelassen?.zustand.abgebrochen).toBe(true);
    expect(laufendeHintergrundArbeit()).toBe(0);
  });
});

describe("Liga-Draft im Hintergrund gegen einen echten Spielstand", () => {
  const DB = path.join(os.tmpdir(), `oly-hintergrund-arbeit-${process.pid}-${Date.now()}.sqlite`);
  let persistence: PersistenceService;
  let saveId = "";
  let dienst: typeof import("@/lib/draft/liga-draft-dienst");

  beforeAll(async () => {
    process.env.OLY_APP_SQLITE_PATH = DB;
    process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
    const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
    dienst = await import("@/lib/draft/liga-draft-dienst");
    persistence = createPersistenceService();
    saveId = persistence.createFreshSeasonOneSave({ name: "hintergrund-arbeit" }).saveId;
    // Reine KI-Liga: ohne Abbruch liefe der Hintergrundlauf bis zum Ende des Drafts.
    dienst.starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [] });
  }, 120_000);

  afterAll(() => {
    delete process.env.OLY_LIGA_DRAFT_MODUS;
    for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
  });

  const verlaufLaenge = () => persistence.getSaveById(saveId)!.gameState.seasonState.ligaDraft!.verlauf.length;

  it("ein Happen haelt sein Zeitbudget: abgelaufen heisst genau ein Pick, nicht `maxPicks`", () => {
    const ergebnis = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 8, zeitBudgetMs: 0 });
    expect(ergebnis.eintraege).toHaveLength(1);
    expect(ergebnis.halt).toBe("max_picks");
  }, 60_000);

  it("der Hintergrundlauf haelt beim naechsten Happen an und gibt den Spielstand frei", async () => {
    const vorher = verlaufLaenge();
    const lauf = dienst.laufeKiImHintergrund({ persistence, saveId, logPrefix: "[test]" });
    expect(dienst.istHintergrundLaufAktiv(saveId)).toBe(true);
    expect(laufendeHintergrundArbeit()).toBe(1);
    await beendeHintergrundArbeit();
    await expect(lauf).resolves.toMatchObject({ halt: "abgebrochen" });
    expect(dienst.istHintergrundLaufAktiv(saveId)).toBe(false);
    expect(laufendeHintergrundArbeit()).toBe(0);
    // Abgebrochen vor dem ersten Happen: kein Pick, der Draft laeuft weiter und ist fortsetzbar.
    expect(verlaufLaenge()).toBe(vorher);
    expect(persistence.getSaveById(saveId)!.gameState.seasonState.ligaDraft!.status).toBe("laeuft");
  }, 60_000);

  it("nach einem Abbruch startet ein neuer Lauf normal (kein haengender Abbruch-Merker)", async () => {
    const vorher = verlaufLaenge();
    let happen = 0;
    const lauf = dienst.laufeKiImHintergrund({
      persistence,
      saveId,
      logPrefix: "[test]",
      jeHappen: 1,
      // Der Aufrufer bricht nach zwei Happen selbst ab (so haelt der Anstoss aus league-setup-draft-service ihn an).
      sollAbbrechen: () => ++happen > 2,
    });
    await expect(lauf).resolves.toMatchObject({ halt: "abgebrochen", picks: 2 });
    expect(verlaufLaenge()).toBe(vorher + 2);
  }, 60_000);
});

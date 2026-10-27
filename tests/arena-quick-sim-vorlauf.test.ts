import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot, readArenaVorlaufRecord } from "@/lib/foundation/matchday-resolve-snapshot";
import {
  beschleunigeArenaVorlaufPerQuickSim,
  kickoffArenaVorlauf,
  stelleArenaVorlaufSicher,
} from "@/lib/battle/arena-vorlauf-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { invalidateLocalTransfermarktCachesForSave } from "@/lib/market/transfermarkt-local-service";
import type { ArenaFixtureInput, ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";
import { buildHarmlosenMiniDmFfaFakeRunner } from "@/tests/helpers/mini-dm-ffa-battle-save";

/**
 * QUICK-SIM-VORLAUF (`beschleunigeArenaVorlaufPerQuickSim()`, 27.10.) — die Ablauflogik mit
 * injizierten Runnern (kein Chromium, kein echter Motor; deren Paritaet prueft
 * `arena-node-runner-paritaet.test.ts`). Geprueft werden die drei Lagen aus dem Kopfkommentar der
 * Funktion und der Rueckfall auf den Chromium-Pfad.
 */

type Runner = (gameState: GameState, fixtures: ArenaFixtureInput[], disziplin: string) => Promise<ArenaFixtureResult[]>;

function fakeRunner(seiten: [number, number], vorher?: () => Promise<void>): Runner & { aufrufe: number } {
  const runner = (async (_gameState: GameState, fixtures: ArenaFixtureInput[]) => {
    runner.aufrufe += 1;
    if (vorher) await vorher();
    return fixtures.map((fixture) => ({ homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, seiten, boxscore: [] }));
  }) as unknown as Runner & { aufrufe: number };
  runner.aufrufe = 0;
  return runner;
}

function sperre() {
  let freigeben!: () => void;
  const promise = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  return { promise, freigeben };
}

async function bisWahr(bedingung: () => boolean, frist = 30_000) {
  const start = Date.now();
  while (!bedingung()) {
    if (Date.now() - start > frist) throw new Error("bisWahr: Bedingung nicht rechtzeitig erfuellt");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function snapshotJson(persistence: PersistenceService, saveId: string) {
  return JSON.stringify(persistence.getSaveById(saveId)!.gameState.seasonState.matchdayResolveSnapshots ?? []);
}

/** Wie in `arena-vorlauf-service.test.ts`: frischer Battle-Save, dessen Spieltag 1 eine Arena-Disziplin hat. */
async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-quick-sim-${Math.random().toString(36).slice(2)}.sqlite`;
    const persistence = createPersistenceService();
    persistence.bootstrapSingleplayerSave();
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    const saveId = angelegt.save.saveId;
    await fuehreLigaSetupDraftAus({
      persistence,
      saveId,
      seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
      callerWritableTeamIds: null,
      excludeTeamIds: [],
      logPrefix: "[arena-quick-sim-test]",
    });
    const nachDraft = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(
      saveId,
      applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const spieltag = (aktuell.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
    const arenaDisziplinen = [spieltag?.discipline1?.disciplineId, spieltag?.discipline2?.disciplineId].filter(
      (id): id is string => id != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(id),
    );
    if (arenaDisziplinen.length === 0) {
      invalidateLocalTransfermarktCachesForSave(saveId);
      continue;
    }
    const batch = applyAiLegacyLineupBatchLocally(
      { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);
    const scope = { saveId, seasonId, matchdayId };
    expect(ensureMatchdayResolveSnapshot(scope, persistence)).not.toBeNull();
    return { persistence, scope };
  }
  throw new Error("bauFrischenBattleSaveMitVollemFeld: drei Saves ohne arena-aufgeloeste Disziplin an Spieltag 1.");
}

const harmlosMiniDm = () => buildHarmlosenMiniDmFfaFakeRunner();

/**
 * CI-FIX (27.10., zweimaliger Job-Timeout bei genau diesem Dateinamen in den Logs, s. Kommentar
 * ueber `persistenz-suiten` in `.github/workflows/ci.yml`): `bauFrischenBattleSaveMitVollemFeld()`
 * durchlaeuft den vollen Produktionspfad (`applyNewGameSetup` -> `fuehreLigaSetupDraftAus` fuer
 * 32 Teams -> `applyAiLegacyLineupBatchLocally` fuer den ganzen Spieltag) und brauchte GEMESSEN
 * ca. 160-165s PRO AUFRUF -- bei vier Tests, die ihn bisher je EINZELN aufriefen, ca. 11 Minuten
 * allein fuer diese Datei. Die vier Tests pruefen sich gegenseitig AUSSCHLIESSENDE Zustaende
 * desselben Vorlauf-Datensatzes und duerfen sich deshalb keinen Save TEILEN -- aber sie koennen
 * sich den teuren, zustandslosen AUFBAU teilen: der laeuft jetzt nur noch EINMAL hier in
 * `beforeAll`, und `holeUnabhaengigeKopie()` gibt jedem Test seine eigene, unabhaengige Kopie
 * davon (ein einzelner `saveSingleplayerState()`-Schreibvorgang statt des kompletten Pfads).
 *
 * WARUM NICHT EINFACH DIESELBE saveId MEHRFACH VERWENDEN: die In-Prozess-Entdopplung des
 * Vorlaufs (`laufendeQuickSims`/`quickSimNodeFehlgeschlagen`/`laufendeVorlaeufe` in
 * `arena-vorlauf-service.ts`) ist ein MODUL-WEITER Cache, dessen Schluessel
 * `${saveId}|${seasonId}|${matchdayId}|${signature}` rein in-memory lebt -- unabhaengig davon,
 * in welcher SQLite-Datei der Save liegt. Mit identischer saveId UND identischen (weil geklonten)
 * Aufstellungen waere die Signatur in allen vier Tests ebenfalls identisch, der Schluessel also
 * auch -- Test 3 wuerde seinen "Node bereits gescheitert"-Eintrag in diesem Cache hinterlassen,
 * und Test 4 liefe dann NICHT mehr ueber seinen eigenen (unvollstaendigen) Node-Runner, sondern
 * traefe nur noch zufaellig denselben Cache-Treffer -- genau die Testverschmutzung, die vermieden
 * werden soll. Jede Kopie bekommt deshalb eine EIGENE, frische saveId.
 *
 * WARUM DANACH EINE EINZELNE KORREKTUR NOETIG IST: der Resolve-Snapshot
 * (`matchdayResolveSnapshots[0]`) traegt seine saveId FEST EINGEBETTET (gestempelt beim Bau, s.
 * `writeMatchdayResolveSnapshot()` in `matchday-resolve-snapshot.ts`) -- eine reine Kopie des
 * GameStates unter neuer saveId wuerde dort immer noch die ALTE saveId tragen.
 * `readMatchdayResolveSnapshot()`/`readArenaVorlaufRecord()` filtern aber nach
 * `entry.saveId === scope.saveId` und faenden den Snapshot sonst nicht -- `ensureMatchdayResolveSnapshot()`
 * wuerde ihn dann (unnoetig) neu berechnen, statt den bereits validierten Stand zu uebernehmen.
 */
type Basis = { persistence: PersistenceService; saveId: string; seasonId: string; matchdayId: string };

let basis: Basis | null = null;
let kopieZaehler = 0;

beforeAll(async () => {
  const { persistence, scope } = await bauFrischenBattleSaveMitVollemFeld();
  basis = { persistence, saveId: scope.saveId, seasonId: scope.seasonId, matchdayId: scope.matchdayId };
}, 300_000);

afterAll(() => {
  if (basis) invalidateLocalTransfermarktCachesForSave(basis.saveId);
});

function holeUnabhaengigeKopie() {
  if (!basis) throw new Error("holeUnabhaengigeKopie: beforeAll hat die Basis nicht aufgebaut.");
  kopieZaehler += 1;
  const neueSaveId = `${basis.saveId}-kopie-${kopieZaehler}`;
  const geklonterZustand: GameState = structuredClone(basis.persistence.getSaveById(basis.saveId)!.gameState);
  geklonterZustand.seasonState.matchdayResolveSnapshots = (geklonterZustand.seasonState.matchdayResolveSnapshots ?? []).map(
    (eintrag) => (eintrag.saveId === basis!.saveId ? { ...eintrag, saveId: neueSaveId } : eintrag),
  );
  basis.persistence.saveSingleplayerState(neueSaveId, geklonterZustand);
  return {
    persistence: basis.persistence,
    scope: { saveId: neueSaveId, seasonId: basis.seasonId, matchdayId: basis.matchdayId },
  };
}

describe("Quick-Sim-Vorlauf", () => {
  it(
    "ohne laufenden Vorlauf: rechnet per Node, startet kein Chromium, danach 'bereits_fertig'",
    async () => {
      const { persistence, scope } = holeUnabhaengigeKopie();
      const node = fakeRunner([1, 0]);
      const chromium = fakeRunner([0, 1]);
      const optionen = {
        runArenaFixturesNodeImpl: node,
        runMiniDmFfaPodFixturesNodeImpl: harmlosMiniDm(),
        runArenaFixturesImpl: chromium,
        runMiniDmFfaPodFixturesImpl: harmlosMiniDm(),
      };

      const ergebnis = await beschleunigeArenaVorlaufPerQuickSim(scope, optionen, persistence);
      expect(ergebnis.weg).toBe("node");
      expect(ergebnis.status).toBe("ready");
      expect(node.aufrufe).toBeGreaterThan(0);
      expect(chromium.aufrufe).toBe(0);
      expect(readArenaVorlaufRecord(persistence.getSaveById(scope.saveId)!.gameState, scope)?.status).toBe("ready");

      // Buchung/Buehnen-Poll (Hintergrund-Pfad) sehen den fertigen Vorlauf, statt Chromium zu starten.
      expect(kickoffArenaVorlauf(scope, { runArenaFixturesImpl: chromium }, persistence).status).toBe("ready");
      expect(chromium.aufrufe).toBe(0);

      const nochmal = await beschleunigeArenaVorlaufPerQuickSim(scope, optionen, persistence);
      expect(nochmal.weg).toBe("bereits_fertig");
      expect(nochmal.status).toBe("ready");
      invalidateLocalTransfermarktCachesForSave(scope.saveId);
    },
    60_000,
  );

  it(
    "ueberholt einen laufenden Chromium-Vorlauf, und dessen spaeteres Ergebnis ueberschreibt nichts",
    async () => {
      const { persistence, scope } = holeUnabhaengigeKopie();
      const chromiumSperre = sperre();
      const chromium = fakeRunner([0, 1], () => chromiumSperre.promise);
      const node = fakeRunner([1, 0]);

      // Der Normalfall: der Chromium-Vorlauf laeuft schon, als der Knopf gedrueckt wird.
      const chromiumLauf = stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: chromium, runMiniDmFfaPodFixturesImpl: harmlosMiniDm() },
        persistence,
      );
      await bisWahr(() => chromium.aufrufe > 0);
      const versuchVorher = readArenaVorlaufRecord(persistence.getSaveById(scope.saveId)!.gameState, scope)!;
      expect(versuchVorher.status).toBe("in_progress");

      const quickSim = await beschleunigeArenaVorlaufPerQuickSim(
        scope,
        { runArenaFixturesNodeImpl: node, runMiniDmFfaPodFixturesNodeImpl: harmlosMiniDm(), runArenaFixturesImpl: chromium },
        persistence,
      );
      expect(quickSim.weg).toBe("node");
      expect(quickSim.status).toBe("ready");
      // Dieselbe Versuchsnummer wie der ueberholte Lauf -- kein neuer Versuch.
      expect(quickSim.record?.versuch).toBe(versuchVorher.versuch);
      // Die Buchung wartet nicht mehr auf Chromium:
      expect(kickoffArenaVorlauf(scope, { runArenaFixturesImpl: chromium }, persistence).status).toBe("ready");

      const nachQuickSim = snapshotJson(persistence, scope.saveId);
      chromiumSperre.freigeben();
      const chromiumErgebnis = await chromiumLauf;
      // Der spaet fertige Chromium-Lauf meldet das bereits stehende Ergebnis und schreibt nichts.
      expect(chromiumErgebnis.status).toBe("ready");
      expect(chromiumErgebnis.record?.finishedAt).toBe(quickSim.record?.finishedAt);
      expect(snapshotJson(persistence, scope.saveId)).toBe(nachQuickSim);
      invalidateLocalTransfermarktCachesForSave(scope.saveId);
    },
    60_000,
  );

  it(
    "scheitert Node, uebernimmt der Chromium-Vorlauf im Hintergrund -- ohne zweiten Node-Lauf",
    async () => {
      const { persistence, scope } = holeUnabhaengigeKopie();
      const chromiumSperre = sperre();
      const chromium = fakeRunner([0, 1], () => chromiumSperre.promise);
      let nodeAufrufe = 0;
      const kaputterNode: Runner = async () => {
        nodeAufrufe += 1;
        throw new Error("Simulierter Worker-Absturz (Testinjektion)");
      };
      const optionen = {
        runArenaFixturesNodeImpl: kaputterNode,
        runMiniDmFfaPodFixturesNodeImpl: harmlosMiniDm(),
        runArenaFixturesImpl: chromium,
        runMiniDmFfaPodFixturesImpl: harmlosMiniDm(),
      };

      const ergebnis = await beschleunigeArenaVorlaufPerQuickSim(scope, optionen, persistence);
      expect(ergebnis.weg).toBe("chromium_rueckfall");
      expect(ergebnis.status).toBe("in_progress");
      // Kein "failed" persistiert -- der Vorlauf laeuft weiter (jetzt ueber Chromium).
      expect(readArenaVorlaufRecord(persistence.getSaveById(scope.saveId)!.gameState, scope)?.status).toBe("in_progress");
      await bisWahr(() => chromium.aufrufe > 0);
      const nodeAufrufeNachErstemVersuch = nodeAufrufe;

      // Ein Folge-Poll mit Quick-Sim rechnet NICHT erneut per Node.
      const zweiter = await beschleunigeArenaVorlaufPerQuickSim(scope, optionen, persistence);
      expect(zweiter.weg).toBe("chromium_rueckfall");
      expect(zweiter.status).toBe("in_progress");
      expect(nodeAufrufe).toBe(nodeAufrufeNachErstemVersuch);

      chromiumSperre.freigeben();
      const fertig = await stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: chromium }, persistence);
      expect(fertig.status).toBe("ready");
      invalidateLocalTransfermarktCachesForSave(scope.saveId);
    },
    60_000,
  );

  it(
    "ein unvollstaendiges Node-Ergebnis wird nicht gebucht, sondern faellt auf Chromium zurueck",
    async () => {
      const { persistence, scope } = holeUnabhaengigeKopie();
      const chromium = fakeRunner([0, 1]);
      // Falsche Team-IDs: jedes echte Team bliebe ohne Arena-Ergebnis.
      const fremderNode: Runner = async (_gameState, fixtures) =>
        fixtures.map(() => ({ homeTeamId: "unbekannt-a", awayTeamId: "unbekannt-b", seiten: [1, 0] as [number, number], boxscore: [] }));

      const ergebnis = await beschleunigeArenaVorlaufPerQuickSim(
        scope,
        {
          runArenaFixturesNodeImpl: fremderNode,
          runMiniDmFfaPodFixturesNodeImpl: harmlosMiniDm(),
          runArenaFixturesImpl: chromium,
          runMiniDmFfaPodFixturesImpl: harmlosMiniDm(),
        },
        persistence,
      );
      expect(ergebnis.weg).toBe("chromium_rueckfall");
      const fertig = await stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: chromium }, persistence);
      expect(fertig.status).toBe("ready");
      expect(chromium.aufrufe).toBeGreaterThan(0);
      invalidateLocalTransfermarktCachesForSave(scope.saveId);
    },
    60_000,
  );
});

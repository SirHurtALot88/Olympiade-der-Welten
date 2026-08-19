/**
 * GLEICHZEITIGES SCHREIBEN IM KOOP (Befund F3, Aufgabe #46).
 *
 * DAS FENSTER IST REAL, nicht theoretisch. Jeder Koop-Schreibpfad liest den Spielstand, aendert
 * eine Kleinigkeit daran und schreibt ihn KOMPLETT zurueck. Zwischen Lesen und Schreiben steht ein
 * `await` (`resolveAuthoritativeWriteOwnerId`), das die Event-Loop freigibt — genau dort kann die
 * Anfrage des anderen Coaches dazwischenrutschen. Chris und Franky spielen denselben Spielstand,
 * beide klicken gleichzeitig: das ist der Normalfall, nicht der Ausnahmefall.
 *
 * UND ES FAELLT NIEMANDEM AUF: `saveSingleplayerState` erhoeht die Version von der GESPEICHERTEN
 * (`withNextSaveVersion(gameState, existing?.gameState.saveVersion)`, persistence-service.ts). Der
 * zweite Schreiber kollidiert also nie — er zaehlt brav weiter und schreibt seinen kompletten,
 * veralteten Stand darueber. Die Aenderung des ersten ist weg, ohne Fehler, ohne Warnung.
 *
 * Diese Suite belegt den Verlust an echten Persistenz-Aufrufen und pinnt danach den Riegel.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runWithSaveRecovery } from "@/lib/persistence/atomic-save-write";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { registerLiveRoomSaveId, resetLiveRoomSaveIdsForTests } from "@/lib/room/live-room-save-registry";

const AUFBAU_ZEITGRENZE_MS = 120_000;

/**
 * Ein EINMAL GESCHRIEBENER Spielstand — und das ist keine Bequemlichkeit, sondern noetig, damit
 * dieser Aufbau ueberhaupt den echten Fall trifft: ein frisch angelegter Stand traegt noch GAR
 * KEINE Version (`saveVersion` ist `undefined`, nachgemessen). Beide Leser bekaemen dann "keine
 * Angabe", und "keine Angabe" ist zu Recht kein Konflikt — der Riegel greift absichtlich nicht.
 * Im Koop ist der Stand laengst mehrfach geschrieben, wenn zwei gleichzeitig klicken.
 */
function baueSpielstand() {
  const persistence = createPersistenceService();
  const save = persistence.createFreshSeasonOneSave({ name: "Koop-Gleichzeitig" });
  persistence.saveSingleplayerState(save.saveId, save.gameState);
  const mitVersion = persistence.getSaveById(save.saveId)!.gameState;
  if (!Number.isFinite(mitVersion.saveVersion)) {
    throw new Error("Aufbau kaputt: der Spielstand traegt keine Version");
  }
  return { persistence, saveId: save.saveId };
}

describe("Gleichzeitiges Schreiben im Koop (F3)", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resetLiveRoomSaveIdsForTests();
  });

  it(
    "BELEG DES VERLUSTS: ohne Raum-Bindung ueberschreibt der zweite Schreiber die Aenderung des ersten stillschweigend",
    () => {
      const { persistence, saveId } = baueSpielstand();

      // Beide lesen DENSELBEN Stand — das ist der Kern des Falls.
      const standChris = persistence.getSaveById(saveId)!.gameState;
      const standFranky = persistence.getSaveById(saveId)!.gameState;
      const chrisTeam = standChris.teams[0]!.teamId;
      const frankyTeam = standChris.teams[1]!.teamId;

      persistence.saveSingleplayerState(saveId, {
        ...standChris,
        teams: standChris.teams.map((team) => (team.teamId === chrisTeam ? { ...team, cash: 111 } : team)),
      });
      persistence.saveSingleplayerState(saveId, {
        ...standFranky,
        teams: standFranky.teams.map((team) => (team.teamId === frankyTeam ? { ...team, cash: 222 } : team)),
      });

      const danach = persistence.getSaveById(saveId)!.gameState;
      expect(danach.teams.find((team) => team.teamId === frankyTeam)?.cash, "Frankys Aenderung steht").toBe(222);
      // DAS ist der Datenverlust: Chris hat gespeichert, bekam kein einziges Signal, und seine
      // Aenderung ist trotzdem fort. Ausserhalb eines Raums bleibt das so — dort schreibt nur EINE
      // Person, und ein Riegel waere hier reine Behinderung.
      expect(danach.teams.find((team) => team.teamId === chrisTeam)?.cash).not.toBe(111);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "DER RIEGEL: ist der Spielstand an einen laufenden Raum gebunden, wird der veraltete Schreibvorgang abgelehnt",
    () => {
      const { persistence, saveId } = baueSpielstand();
      registerLiveRoomSaveId("RAUM-0001", saveId);

      const standChris = persistence.getSaveById(saveId)!.gameState;
      const standFranky = persistence.getSaveById(saveId)!.gameState;
      const chrisTeam = standChris.teams[0]!.teamId;
      const frankyTeam = standChris.teams[1]!.teamId;

      persistence.saveSingleplayerState(saveId, {
        ...standChris,
        teams: standChris.teams.map((team) => (team.teamId === chrisTeam ? { ...team, cash: 111 } : team)),
      });

      // Franky schreibt auf einem Stand, der inzwischen ueberholt ist.
      expect(() =>
        persistence.saveSingleplayerState(saveId, {
          ...standFranky,
          teams: standFranky.teams.map((team) => (team.teamId === frankyTeam ? { ...team, cash: 222 } : team)),
        }),
      ).toThrowError(/stale_save_version/);

      const danach = persistence.getSaveById(saveId)!.gameState;
      expect(danach.teams.find((team) => team.teamId === chrisTeam)?.cash, "Chris' Aenderung bleibt").toBe(111);
      expect(danach.teams.find((team) => team.teamId === frankyTeam)?.cash, "Frankys Stand wurde NICHT geschrieben").not.toBe(
        222,
      );
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "GEGENPROBE: nacheinander auf frisch gelesenem Stand geht im Raum ganz normal weiter",
    () => {
      const { persistence, saveId } = baueSpielstand();
      registerLiveRoomSaveId("RAUM-0002", saveId);

      const erst = persistence.getSaveById(saveId)!.gameState;
      const teamA = erst.teams[0]!.teamId;
      persistence.saveSingleplayerState(saveId, {
        ...erst,
        teams: erst.teams.map((team) => (team.teamId === teamA ? { ...team, cash: 111 } : team)),
      });

      // Neu lesen — genau das, was ein Client nach einer Aktualisierung tut.
      const frisch = persistence.getSaveById(saveId)!.gameState;
      const teamB = frisch.teams[1]!.teamId;
      expect(() =>
        persistence.saveSingleplayerState(saveId, {
          ...frisch,
          teams: frisch.teams.map((team) => (team.teamId === teamB ? { ...team, cash: 222 } : team)),
        }),
      ).not.toThrow();

      const danach = persistence.getSaveById(saveId)!.gameState;
      expect(danach.teams.find((team) => team.teamId === teamA)?.cash).toBe(111);
      expect(danach.teams.find((team) => team.teamId === teamB)?.cash).toBe(222);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "GEGENPROBE: die Wiederherstellung nach einem Fehlschlag darf ABSICHTLICH zurueckschreiben",
    async () => {
      const { persistence, saveId } = baueSpielstand();
      registerLiveRoomSaveId("RAUM-0004", saveId);

      const vorher = persistence.getSaveById(saveId)!.gameState;
      const teamA = vorher.teams[0]!.teamId;

      // `runWithSaveRecovery` schreibt den Stand von VOR dem Ablauf zurueck, wenn der Ablauf
      // scheitert — ein bewusst AELTERER Stand. Ohne die benannte Ausnahme haette der Riegel
      // ausgerechnet die Wiederherstellung abgewiesen und aus einer behebbaren Stoerung eine
      // unbehebbare gemacht (`AtomicSaveRecoveryError` statt des echten Fehlers).
      await expect(
        runWithSaveRecovery({
          label: "Probe",
          saveId,
          beforeGameState: vorher,
          persistence,
          run: () => {
            persistence.saveSingleplayerState(saveId, {
              ...persistence.getSaveById(saveId)!.gameState,
              teams: vorher.teams.map((team) => (team.teamId === teamA ? { ...team, cash: 999 } : team)),
            });
            throw new Error("Ablauf gescheitert");
          },
        }),
      ).rejects.toThrowError(/Ablauf gescheitert|failed and the previous save state was restored/);

      const danach = persistence.getSaveById(saveId)!.gameState;
      expect(danach.teams.find((team) => team.teamId === teamA)?.cash, "der alte Stand ist zurueck").not.toBe(999);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "GEGENPROBE: ein Stand OHNE Versionsangabe wird nicht abgelehnt — sonst braeche jeder Alt-Pfad",
    () => {
      const { persistence, saveId } = baueSpielstand();
      registerLiveRoomSaveId("RAUM-0003", saveId);

      const stand = persistence.getSaveById(saveId)!.gameState;
      const ohneVersion = { ...stand };
      delete (ohneVersion as { saveVersion?: number }).saveVersion;

      // Wiederherstellung aus einer Sicherung, Migrationen und aeltere Aufrufer fuehren keine
      // Version mit. "Keine Angabe" ist KEIN Konflikt — es ist schlicht keine Angabe.
      expect(() => persistence.saveSingleplayerState(saveId, ohneVersion)).not.toThrow();
    },
    AUFBAU_ZEITGRENZE_MS,
  );
});

/**
 * COOP: SCHREIBENDE ROUTEN MIT ZWEI SITZUNGEN UND ECHTEM GUARD.
 *
 * Ebene 2 des Coop-Absicherungsplans (`docs/design/coop-absicherung.md`, Risiko R2).
 *
 * DER UNTERSCHIED ZUM ABDECKUNGS-SCAN: `api-write-route-guard-coverage` prueft per Textsuche, ob
 * `authorizeServerRoomWrite` in einer Route STEHT. Diese Suite prueft, ob er WIRKT — mit einem
 * echten Raum, zwei echten Sitzungen und ohne den Guard zu mocken.
 *
 * Warum das kein theoretischer Unterschied ist: bei `contracts/dissolution` war der Guard
 * eingebaut und der Scan gruen, aber die Oberflaeche schickte keinen Raum-Kontext mit — der Guard
 * hielt jeden Aufruf fuer Solo und liess ihn durch. Diese Sorte Fehler faengt nur ein Test, der
 * den Weg wirklich geht.
 *
 * Die bestehenden gemockten Routentests bleiben unangetastet: die pruefen Fachlogik, nicht
 * Autorisierung.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { erstelleCoopRaum, schreibKontext, type CoopRaum } from "@/tests/_helpers/coop-room-harness";

/** Ein frischer Season-1-Save kostet Zeit — dieselbe Groessenordnung wie in den Lineup-Suiten. */
const AUFBAU_ZEITGRENZE_MS = 120_000;

type RoutenFall = {
  /** Pfad unter app/api — zugleich die Beschriftung im Testnamen. */
  pfad: string;
  /** Importpfad des Moduls mit der POST-Funktion. */
  lade: () => Promise<{ POST: (request: Request) => Promise<Response> }>;
  /**
   * Der fachliche Teil des Bodys — ohne Raum-Kontext und ohne `teamId`, die setzt die Suite.
   *
   * WICHTIG: der Body muss weit genug tragen, um den Guard ueberhaupt zu ERREICHEN. Manche Routen
   * pruefen den Gegenstand des Schreibvorgangs davor (`training` weist einen Spieler, der nicht
   * zum Team gehoert, schon mit 404 ab — bewusst, damit niemand ueber ein falsch beschriftetes
   * `teamId` schreibt). Mit einem Phantasie-Spieler kaeme der Test nie am Guard an und waere
   * gruen, ohne etwas zu zeigen. Deshalb bekommt der Fall echte Kennungen aus dem Save.
   */
  koerper: (raum: CoopRaum, teamId: string) => Record<string, unknown>;
};

/** Erster Spieler im Kader dieses Teams — fuer Routen, die den Gegenstand vor dem Guard pruefen. */
function ersterSpielerVon(saveId: string, teamId: string): string {
  const save = createPersistenceService().getSaveById(saveId);
  const eintrag = save?.gameState.rosters.find((roster) => roster.teamId === teamId);
  if (!eintrag) throw new Error(`Kein Spieler im Kader von ${teamId} — Aufbau unbrauchbar.`);
  return eintrag.playerId;
}

const FAELLE: RoutenFall[] = [
  {
    pfad: "contracts/dissolution",
    lade: () => import("@/app/api/contracts/dissolution/route"),
    koerper: (raum, teamId) => ({
      saveId: raum.saveId,
      seasonId: "season-1",
      teamId,
      playerId: "spieler-existiert-nicht",
      decision: "declined",
    }),
  },
  {
    pfad: "training",
    lade: () => import("@/app/api/training/route"),
    koerper: (raum, teamId) => ({
      saveId: raum.saveId,
      teamId,
      // Echter Spieler des Teams — sonst weist die Route mit 404 ab, bevor der Guard laeuft.
      playerId: ersterSpielerVon(raum.saveId, teamId),
      trainingMode: "leicht",
    }),
  },
  {
    pfad: "team-settings/control",
    lade: () => import("@/app/api/team-settings/control/route"),
    koerper: (raum, teamId) => ({
      saveId: raum.saveId,
      teamId,
      control: { controlMode: "manual" },
    }),
  },
];

function anfrage(pfad: string, koerper: Record<string, unknown>) {
  return new Request(`http://localhost/api/${pfad}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

describe("Coop: schreibende Routen mit zwei Sitzungen", () => {
  let saveId: string;
  let raum: CoopRaum;

  /**
   * Save UND Raum werden EINMAL gebaut.
   *
   * Der Save kostet rund sechs Sekunden; pro Test angelegt waere diese Suite allein eine Minute
   * CI-Zeit — und sie soll wachsen. Geprueft wird hier AUTORISIERUNG, nicht Fachlogik: kein Test
   * haengt davon ab, dass der Save unberuehrt ist.
   *
   * Der Raum muss aus einem anderen Grund einmalig sein: `runtimeRooms` in `room-store.ts` ist
   * prozessweit, und der Guard sucht den Raum ueber die `saveId`. Ein zweiter Raum auf denselben
   * Save laesst den Guard den falschen finden — die Sitzungen des neuen Raums sind dort unbekannt,
   * und JEDER Schreibversuch wird abgewiesen. Die Tests waeren dann gruen, ohne etwas zu zeigen
   * (der erwartete 403 kaeme aus dem falschen Grund).
   */
  beforeAll(() => {
    resetDatabaseForTests();
    saveId = createPersistenceService().createFreshSeasonOneSave({ name: "Coop-Guard-Probe" }).saveId;
    raum = erstelleCoopRaum(saveId);
  }, AUFBAU_ZEITGRENZE_MS);

  it("der Aufbau gibt beiden Sitzungen wirklich eigene Teams", () => {
    // Ohne diese Zusicherung koennte die ganze Suite gruen sein, weil NIEMAND etwas besitzt und
    // jeder Schreibversuch abgewiesen wird — die Tests 1 wuerden bestehen, ohne etwas zu zeigen.
    expect(raum.chris.eigeneTeams.length).toBeGreaterThan(0);
    expect(raum.franky.eigeneTeams.length).toBeGreaterThan(0);
    expect(raum.chris.eigeneTeams).not.toContain(raum.frankysTeam);
    expect(raum.franky.eigeneTeams).not.toContain(raum.chrisTeam);
  });

  describe.each(FAELLE)("$pfad", (fall) => {
    it("weist Franky ab, wenn er auf CHRIS' Team schreibt", async () => {
      // DER KERN. Ein falsch uebergebenes `teamId` (etwa das eigene statt des betroffenen) liesse
      // diesen Fall durch — genau die Fehlverdrahtung, die der Abdeckungs-Scan nicht sieht.
      const { POST } = await fall.lade();
      const antwort = await POST(
        anfrage(fall.pfad, {
          ...fall.koerper(raum, raum.chrisTeam),
          ...schreibKontext(raum, raum.franky),
        }),
      );

      expect(antwort.status, `${fall.pfad}: Franky durfte auf ein fremdes Team schreiben`).toBe(403);
    }, AUFBAU_ZEITGRENZE_MS);

    it("laesst Chris auf sein EIGENES Team schreiben — der Guard blockt nicht pauschal", async () => {
      // Gegenprobe. Ohne sie waere eine Route, die grundsaetzlich 403 liefert, faelschlich gruen.
      // Geprueft wird nur, dass es NICHT am Guard scheitert: ein fachlicher Fehlschlag (der
      // Spieler existiert absichtlich nicht) ist hier in Ordnung, ein 403 nicht.
      const { POST } = await fall.lade();
      const antwort = await POST(
        anfrage(fall.pfad, {
          ...fall.koerper(raum, raum.chrisTeam),
          ...schreibKontext(raum, raum.chris),
        }),
      );

      expect(antwort.status, `${fall.pfad}: der Guard wies den rechtmaessigen Besitzer ab`).not.toBe(403);
      expect(antwort.status).not.toBe(401);
    }, AUFBAU_ZEITGRENZE_MS);

    it("weist einen Schreibversuch OHNE Raum-Kontext ab", async () => {
      // Der Fall, der bei `contracts/dissolution` beinahe unbemerkt geblieben waere: schickt die
      // Oberflaeche keinen Raum-Kontext, haelt der Guard den Aufruf fuer Solo. Auf einem Save, der
      // an einen Raum gebunden ist, darf das NICHT durchgehen — sonst umgeht man die Besitzpruefung
      // schlicht dadurch, dass man die Felder weglaesst.
      const { POST } = await fall.lade();
      const antwort = await POST(anfrage(fall.pfad, fall.koerper(raum, raum.chrisTeam)));

      expect(
        [401, 403].includes(antwort.status),
        `${fall.pfad}: ohne Raum-Kontext durchgelassen (Status ${antwort.status}) — die Besitzpruefung laesst sich damit umgehen`,
      ).toBe(true);
    }, AUFBAU_ZEITGRENZE_MS);
  });
});

/**
 * DER LIGA-DRAFT UEBERLEBT EINEN SCHREIBKONFLIKT.
 *
 * GEMESSEN am 18.08. ueber fuenf Raumstarts: der Hintergrund-Draft liest den Spielstand EINMAL,
 * rechnet gut zwei Minuten und schreibt erst am Ende. Der Koop-Riegel aus Aufgabe #46 weist genau
 * diesen Schreibvorgang ab, sobald in der Zwischenzeit jemand anders geschrieben hat — im Raum
 * also staendig (Shell beim Oeffnen, Sponsorwahl, Kauf). Einer von fuenf Starts endete deshalb mit
 * `leagueSetupStatus: "failed"` und 31 von 32 Teams OHNE einen einzigen Spieler; der Raum war
 * unspielbar.
 *
 * DER RIEGEL BLEIBT — er verhindert, dass ein zwei Minuten alter Stand die Arbeit des Mitspielers
 * ueberschreibt. Falsch war die Reaktion darauf: abbrechen statt neu lesen und weitermachen.
 *
 * Drei Eigenschaften werden hier gehalten, und jede haengt an einer Lage, in der das Falsche
 * naheliegt: einfach nochmal alles draften (dann bekaemen menschliche Teams einen Kader), jeden
 * Fehler wiederholen (dann dreimal dasselbe kaputte Ergebnis), oder ewig wiederholen.
 */
import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { KoopSchreibkonfliktError } from "@/lib/persistence/koop-schreibkonflikt";
import {
  LIGA_DRAFT_KONFLIKT_VERSUCHE,
  fuehreLigaSetupDraftAus,
  type LigaDraftLauf,
} from "@/lib/game/league-setup-draft-service";

const SAVE_ID = "save-koop-test";
const MENSCHLICHE_TEAMS = ["P-S", "D-P"];
const KI_TEAMS = ["A-A", "B-B", "C-C"];

/**
 * Eine Ablage, die genau so viel kann, wie dieser Ablauf braucht: Teams, Kader, Saison-Zustand.
 * Bewusst KEIN Nachbau der echten Ablage — geprueft wird die Entscheidung „wiederholen oder
 * aufgeben", nicht das Speichern.
 */
function baueAblage(kaderNachTeam: Record<string, number> = {}) {
  const teams = [...MENSCHLICHE_TEAMS, ...KI_TEAMS].map((teamId) => ({ teamId, name: teamId }));
  const rosters: Array<{ teamId: string; playerId: string }> = [];
  for (const [teamId, anzahl] of Object.entries(kaderNachTeam)) {
    for (let i = 0; i < anzahl; i += 1) rosters.push({ teamId, playerId: `${teamId}-p${i}` });
  }
  const gameState = {
    teams,
    rosters,
    season: { id: "season-1" },
    seasonState: {},
  } as unknown as GameState;

  const geschrieben: GameState[] = [];
  const ablage = {
    getSaveById: (saveId: string) =>
      saveId === SAVE_ID ? ({ saveId, gameState } as unknown as PersistedSaveGame) : null,
    saveSingleplayerState: (_saveId: string, naechster: GameState) => {
      geschrieben.push(naechster);
      Object.assign(gameState, naechster);
      return { saveId: SAVE_ID, gameState } as unknown as PersistedSaveGame;
    },
  } as unknown as PersistenceService;

  return { ablage, gameState, geschrieben };
}

const gelungenerLauf: LigaDraftLauf = async () => ({ teams: [] }) as never;
const konflikt = () =>
  new KoopSchreibkonfliktError({ saveId: SAVE_ID, geleseneVersion: 2, gespeicherteVersion: 3 });

async function laufeDurch(input: {
  ablage: PersistenceService;
  draftLauf: LigaDraftLauf;
  maxKonfliktVersuche?: number;
}) {
  return fuehreLigaSetupDraftAus({
    persistence: input.ablage,
    saveId: SAVE_ID,
    seasonId: "season-1",
    callerWritableTeamIds: KI_TEAMS,
    excludeTeamIds: MENSCHLICHE_TEAMS,
    logPrefix: "[test]",
    draftLauf: input.draftLauf,
    maxKonfliktVersuche: input.maxKonfliktVersuche,
    wartenVorWiederholung: () => Promise.resolve(),
  });
}

describe("Der Liga-Draft setzt nach einem Schreibkonflikt nach", () => {
  it("wiederholt und wird fertig, statt den Raum mit leeren Teams stehenzulassen", async () => {
    const { ablage, gameState } = baueAblage();
    const draftLauf = vi.fn<LigaDraftLauf>().mockRejectedValueOnce(konflikt()).mockImplementation(gelungenerLauf);

    const ergebnis = await laufeDurch({ ablage, draftLauf });

    expect(ergebnis.status, "genau das war der Befund: ein Konflikt beendete den ganzen Lauf").toBe("ready");
    expect(ergebnis.versuche).toBe(2);
    expect(gameState.seasonState.leagueSetupStatus).toBe("ready");
  });

  it("bedient beim zweiten Anlauf NUR noch leere Teams — und niemals ein menschliches", async () => {
    // Chris: „niemals soll mit gepickt werden für menschliche teams!" Menschliche Teams sind leer,
    // WEIL sie leer bleiben sollen. Eine Wiederholung ueber „alle leeren Teams" wuerde ihnen beim
    // zweiten Anlauf einen Kader hinstellen — der Ausschluss muss durch jeden Anlauf mitgehen.
    const { ablage } = baueAblage({ "A-A": 9 });
    const draftLauf = vi.fn<LigaDraftLauf>().mockRejectedValueOnce(konflikt()).mockImplementation(gelungenerLauf);

    const ergebnis = await laufeDurch({ ablage, draftLauf });

    expect(ergebnis.zuletztBedienteTeamIds).toEqual(["B-B", "C-C"]);
    for (const teamId of MENSCHLICHE_TEAMS) {
      expect(ergebnis.zuletztBedienteTeamIds, `${teamId} ist menschlich gefuehrt`).not.toContain(teamId);
    }
    // Und das schon befuellte KI-Team bleibt ebenfalls unangetastet.
    expect(ergebnis.zuletztBedienteTeamIds).not.toContain("A-A");
  });

  it("GEGENPROBE: der ERSTE Anlauf geht weiterhin ueber die ganze Liga", async () => {
    // Sonst waere aus der Reparatur eine Verhaltensaenderung fuer den Normalfall geworden.
    const { ablage } = baueAblage();
    const draftLauf = vi.fn<LigaDraftLauf>().mockImplementation(gelungenerLauf);

    const ergebnis = await laufeDurch({ ablage, draftLauf });

    expect(ergebnis.versuche).toBe(1);
    expect(ergebnis.zuletztBedienteTeamIds, "null heisst: keine Team-Einschraenkung").toBeNull();
    expect(draftLauf.mock.calls[0]![0]).not.toHaveProperty("teamIds");
  });

  it("traegt nur den Status nach, wenn beim Konflikt gar kein Team mehr leer war", async () => {
    // Der abgewiesene Schreibvorgang kann fachlich folgenlos gewesen sein — dann waere ein zweiter
    // zweiminuetiger Draft-Lauf reine Verschwendung.
    const { ablage, gameState } = baueAblage({ "A-A": 9, "B-B": 9, "C-C": 9 });
    const draftLauf = vi.fn<LigaDraftLauf>().mockRejectedValueOnce(konflikt()).mockImplementation(gelungenerLauf);

    const ergebnis = await laufeDurch({ ablage, draftLauf });

    expect(ergebnis.status).toBe("ready");
    expect(gameState.seasonState.leagueSetupStatus).toBe("ready");
    expect(draftLauf, "kein zweiter Draft-Lauf").toHaveBeenCalledTimes(1);
  });
});

describe("Was NICHT wiederholt wird", () => {
  it("ein anderer Fehler bleibt ein Fehlschlag — dreimal dasselbe kaputte Ergebnis hilft niemandem", async () => {
    const { ablage, gameState } = baueAblage();
    const draftLauf = vi.fn<LigaDraftLauf>().mockRejectedValue(new Error("kaputte Engine"));

    const ergebnis = await laufeDurch({ ablage, draftLauf });

    expect(ergebnis.status).toBe("failed");
    expect(ergebnis.versuche).toBe(1);
    expect(draftLauf).toHaveBeenCalledTimes(1);
    expect(gameState.seasonState.leagueSetupStatus, "der Cockpit-Knopf haengt an 'failed'").toBe("failed");
  });

  it("nach dem letzten Anlauf ist Schluss — und der Zustand sagt es ehrlich", async () => {
    const { ablage, gameState } = baueAblage();
    const draftLauf = vi.fn<LigaDraftLauf>().mockRejectedValue(konflikt());

    const ergebnis = await laufeDurch({ ablage, draftLauf, maxKonfliktVersuche: 2 });

    expect(ergebnis.status).toBe("failed");
    expect(ergebnis.versuche).toBe(2);
    expect(draftLauf).toHaveBeenCalledTimes(2);
    expect(gameState.seasonState.leagueSetupStatus).toBe("failed");
  });

  it("die Obergrenze ist eine benannte Zahl, keine im Ablauf versteckte", () => {
    expect(LIGA_DRAFT_KONFLIKT_VERSUCHE).toBeGreaterThanOrEqual(2);
    expect(LIGA_DRAFT_KONFLIKT_VERSUCHE).toBeLessThanOrEqual(5);
  });
});

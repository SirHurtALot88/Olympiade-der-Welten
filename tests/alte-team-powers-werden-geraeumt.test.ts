/**
 * DIE ALTEN TEAM-POWER-DATEN VERLASSEN DEN SPIELSTAND.
 *
 * CHRIS AM 23.08.2026: „die alten teamPowers können raus."
 *
 * AUSGANGSLAGE, am Live-Abbild gemessen: der Schalter `TEAM_POWERS_ENABLED` stand aus und die
 * Mechanik wirkte nachweislich nicht mehr — die DATEN lagen aber weiter da. 2131 `teamPowers` ueber
 * sieben Spielstaende, dazu 13 Aufstellungs-Entwuerfe mit einer `teamPowerId` in `n90y4m`.
 *
 * DIE FALLE DABEI WAR NICHT DAS LOESCHEN, SONDERN DER GENERATOR. `ensureLocalTeamPowersForSeason`
 * lief bis heute UNABHAENGIG vom Schalter und stand auf drei heissen Pfaden: Aufstellung laden,
 * KI-Stapellauf, Spieltagsabschluss. Ein Ladeweg-Nachzug allein waere eine Tretmuehle gewesen —
 * geraeumt, sofort neu erzeugt, und weil die Aufrufer aus einer neuen Referenz auf „geaendert"
 * schliessen, jedes Mal mit einem vollen Schreibvorgang (am Live-Save rund 1,2 s).
 *
 * Deshalb pruefen die Faelle hier BEIDE Haelften: dass geraeumt wird, und dass nichts nachwaechst.
 *
 * GEMESSEN NACH DEM UMBAU, an denselben sieben Spielstaenden
 * (`scripts/messe-team-power-raeumung.ts`): 2131 -> 0 gespeicherte `teamPowers`, 13 -> 0 Entwuerfe
 * mit `teamPowerId`, bei unveraenderten 1342 Entwuerfen insgesamt. Der zweite Lauf gibt in 7 von 7
 * Faellen DIESELBE Referenz zurueck.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  __setTeamPowersEnabledForTests,
  areTeamPowersEnabled,
  ensureLocalTeamPowersForSeason,
  raeumeAbgeschalteteTeamPowers,
} from "@/lib/lineups/team-powers";

const AUSGANGSZUSTAND = areTeamPowersEnabled();

beforeEach(() => {
  __setTeamPowersEnabledForTests(AUSGANGSZUSTAND);
});

afterEach(() => {
  __setTeamPowersEnabledForTests(AUSGANGSZUSTAND);
});

/** Ein Spielstand mit genau der gemessenen Lage: Records da, ein Entwurf nennt eine Power. */
function spielstandMitAltlast(): GameState {
  return {
    season: { id: "season-2" },
    // `shortCode` und `teamIdentities` stehen hier, weil der GENERATOR sie braucht — ohne sie
    // faellt die Gegenprobe unten mit einem TypeError statt mit einer Aussage, und ein Generator,
    // der wirft, belegt nicht, dass der Schalter ihn haelt.
    teams: [
      { teamId: "T-G", shortCode: "TG" },
      { teamId: "V-W", shortCode: "VW" },
    ],
    teamIdentities: [
      { teamId: "T-G", pow: 60, spe: 50, men: 40, soc: 30 },
      { teamId: "V-W", pow: 30, spe: 40, men: 50, soc: 60 },
    ],
    players: [],
    rosters: [],
    seasonState: {
      teamPowers: [
        { id: "power-1", saveId: "s", seasonId: "season-1", teamId: "T-G", chargesTotal: 4, selectedForSeason: true },
        { id: "power-2", saveId: "s", seasonId: "season-2", teamId: "T-G", chargesTotal: 4, selectedForSeason: true },
      ],
      lineupDrafts: [
        {
          lineupId: "lu-1",
          seasonId: "season-2",
          teamId: "T-G",
          modifiers: {
            d1: { teamPowerId: "power-2", intensity: "push", primaryFormCardId: "fc-1" },
            d2: { teamPowerId: null, intensity: "normal" },
          },
        },
        {
          lineupId: "lu-2",
          seasonId: "season-2",
          teamId: "V-W",
          modifiers: { d1: { intensity: "normal" }, d2: { intensity: "conserve" } },
        },
      ],
    },
  } as unknown as GameState;
}

function zaehleDraftsMitPower(gameState: GameState): number {
  return (gameState.seasonState.lineupDrafts ?? []).filter((draft) =>
    Object.values((draft.modifiers ?? {}) as Record<string, { teamPowerId?: string | null }>).some(
      (seite) => seite?.teamPowerId != null,
    ),
  ).length;
}

describe("Alte Team-Power-Daten werden geraeumt", () => {
  it("entfernt die gespeicherten Records ueber ALLE Saisons, nicht nur die laufende", () => {
    // Der Bestand war ueber mehrere Saisons gewachsen (2131 Records). Nur die laufende zu raeumen
    // haette den Grossteil liegen gelassen.
    const geraeumt = raeumeAbgeschalteteTeamPowers(spielstandMitAltlast());
    expect(geraeumt.seasonState.teamPowers).toBeUndefined();
  });

  it("nimmt den Entwuerfen die teamPowerId — und sonst nichts", () => {
    const geraeumt = raeumeAbgeschalteteTeamPowers(spielstandMitAltlast());
    expect(zaehleDraftsMitPower(geraeumt)).toBe(0);

    const d1 = (geraeumt.seasonState.lineupDrafts ?? [])[0]!.modifiers!.d1 as Record<string, unknown>;
    // Formkarten, Intensitaet und Kapitaen stehen in derselben Struktur und sind weiter in
    // Gebrauch. Hier wird geraeumt, nicht aufgeraeumt.
    expect(d1.intensity).toBe("push");
    expect(d1.primaryFormCardId).toBe("fc-1");
    expect(d1.teamPowerId).toBeNull();
  });

  it("laesst die Zahl der Entwuerfe unveraendert", () => {
    const vorher = spielstandMitAltlast();
    const geraeumt = raeumeAbgeschalteteTeamPowers(vorher);
    expect((geraeumt.seasonState.lineupDrafts ?? []).length).toBe(
      (vorher.seasonState.lineupDrafts ?? []).length,
    );
  });

  it("gibt DIESELBE Referenz zurueck, wenn nichts mehr zu raeumen ist", () => {
    // Das ist die teure Haelfte: die Aufrufer schliessen aus einer neuen Referenz auf „geaendert"
    // und schreiben den kompletten Spielstand — am Live-Save rund 1,2 s. Ein Lauf, der jedes Mal
    // ein neues Objekt herausgibt, kostet also auf jedem Aufstellungs-Aufruf und in jedem
    // Spieltagsabschluss eine Sekunde, ohne dass sich etwas aendert.
    const einmal = raeumeAbgeschalteteTeamPowers(spielstandMitAltlast());
    expect(raeumeAbgeschalteteTeamPowers(einmal)).toBe(einmal);
  });

  it("faesst einen Spielstand ohne Altlast gar nicht erst an", () => {
    const sauber = {
      season: { id: "season-1" },
      teams: [],
      players: [],
      rosters: [],
      seasonState: { lineupDrafts: [{ lineupId: "lu-1", modifiers: { d1: { intensity: "normal" } } }] },
    } as unknown as GameState;
    expect(raeumeAbgeschalteteTeamPowers(sauber)).toBe(sauber);
  });
});

describe("Der Generator waechst nicht nach", () => {
  it("erzeugt bei abgeschaltetem Schalter nichts mehr — er raeumt", () => {
    // OHNE DIESE HAELFTE WAERE DIE RAEUMUNG WIRKUNGSLOS. `ensureLocalTeamPowersForSeason` steht auf
    // drei heissen Pfaden und hat die Records bis heute unabhaengig vom Schalter neu geschrieben.
    __setTeamPowersEnabledForTests(false);
    const ergebnis = ensureLocalTeamPowersForSeason(spielstandMitAltlast(), "s", "season-2");
    expect(ergebnis.seasonState.teamPowers).toBeUndefined();
    expect(zaehleDraftsMitPower(ergebnis)).toBe(0);
  });

  it("bleibt auf dem heissen Pfad still, sobald geraeumt ist", () => {
    __setTeamPowersEnabledForTests(false);
    const einmal = ensureLocalTeamPowersForSeason(spielstandMitAltlast(), "s", "season-2");
    // Zweiter Aufruf: gleiche Referenz, also kein Schreibvorgang beim Aufrufer.
    expect(ensureLocalTeamPowersForSeason(einmal, "s", "season-2")).toBe(einmal);
  });

  it("GEGENPROBE: mit eingeschaltetem Schalter erzeugt er sehr wohl wieder", () => {
    // Ohne diesen Fall koennte der Generator schlicht kaputt sein, und alle Nullen oben waeren
    // bedeutungslos. Er belegt, dass nur der Schalter ihn haelt.
    __setTeamPowersEnabledForTests(true);
    const ergebnis = ensureLocalTeamPowersForSeason(spielstandMitAltlast(), "s", "season-2");
    expect((ergebnis.seasonState.teamPowers ?? []).length).toBeGreaterThan(0);
  });
});

describe("Die Persistenz raeumt bestehende Spielstaende", () => {
  /*
   * WAS DIESER FALL BELEGT UND WAS NICHT — nachgemessen, nicht vermutet.
   *
   * Die Raeumung sitzt an ZWEI Stellen in `save-repository.ts`: auf dem Ladeweg
   * (`materializePersistedSave`) und auf dem Schreibweg. Gegenprobe gefahren, beide einzeln
   * neutralisiert: FAELLT NUR AM SCHREIBWEG. Der Grund ist derselbe wie beim Trainingsmodus —
   * `saveGameState` legt seinen Rueckgabewert in den Sitzungs-Cache, und ein Lauf, der schreibt
   * und gleich wieder liest, bekommt genau den. Der Ladeweg wird hier gar nicht erreicht.
   *
   * DER LADEWEG IST DESHALB WOANDERS BELEGT: am Live-Abbild, mit
   * `scripts/messe-team-power-raeumung.ts` auf einer frischen Kopie, die dieser Prozess nie
   * geschrieben hat. Dort kommen aus allen sieben Staenden 0 `teamPowers` und 0 Entwuerfe mit
   * `teamPowerId` zurueck; gegen die Basis mit `git stash` gemessen waren es davor 2131 und 13.
   *
   * Beide Wege braucht es: der Schreibweg raeumt, was gespielt wird, der Ladeweg erreicht auch
   * die Staende, die gerade niemand anfasst.
   */
  const vorherigerPfad = process.env.OLY_APP_SQLITE_PATH;
  let ordner = "";

  beforeEach(() => {
    ordner = mkdtempSync(join(tmpdir(), "oly-teampower-raeumung-"));
    process.env.OLY_APP_SQLITE_PATH = join(ordner, "data", "oly-app.sqlite");
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
    process.env.OLY_APP_SQLITE_PATH = vorherigerPfad;
    if (ordner && existsSync(ordner)) rmSync(ordner, { recursive: true, force: true });
  });

  it("liest einen Spielstand mit Altlast ohne teamPowers zurueck", () => {
    // Ein VOLLER Spielstand, kein Handfixture: die Persistenz braucht Disziplinen, Spieler und
    // Kader. Die Altlast wird hineingesetzt, damit der Fall wirklich etwas zu raeumen hat.
    const basis = createSingleplayerGameState() as unknown as GameState;
    const altlast = spielstandMitAltlast();
    const mitAltlast: GameState = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        teamPowers: altlast.seasonState.teamPowers,
        lineupDrafts: altlast.seasonState.lineupDrafts,
      },
    };
    expect((mitAltlast.seasonState.teamPowers ?? []).length).toBeGreaterThan(0);
    expect(zaehleDraftsMitPower(mitAltlast)).toBeGreaterThan(0);

    const repository = createSaveRepository();
    const saveId = "save-teampower-altlast";
    repository.saveGameState({ saveId, name: saveId, gameState: mitAltlast });

    const geladen = repository.getSaveById(saveId)?.gameState as GameState | undefined;
    expect(geladen, "Spielstand nicht ladbar").toBeDefined();
    expect(geladen!.seasonState.teamPowers ?? []).toEqual([]);
    expect(zaehleDraftsMitPower(geladen!)).toBe(0);
  });
});

/**
 * BATTLE-MODUS, TEIL 4: BEKOMMT JEDER DIE TEAMS, DIE IHM VERSPROCHEN WURDEN?
 *
 * Diese Datei ist der Beweis fuer eine einzige Zusage: EIN PRESET LIEFERT SEINE ANZAHL, EGAL AUS
 * WELCHEM POOL. Sie entstand aus vier nachgemessenen Fehlern, die alle dieselbe Ursache hatten —
 * die Presets trugen ABSOLUTE Team-IDs (`P-S`, `V-W`), die es im 16-Team-Battle-Spielstand nicht
 * gibt, und wer sie einloeste, filterte sie stumm weg:
 *
 *   battle/solo_4      Chris bekam 2 Teams statt 4 — ohne jede Warnung.
 *   battle/online_4v4  2 gegen 4, ein schiefes Spiel, nur mit einer folgenlosen Warnung.
 *   battle/*           32 Besitz-Zeilen in einem 16-Team-Save; 16 zeigten auf Geister-Teams.
 *   battle/1v1 (Raum)  der Host bekam `P-S` — also nichts — und konnte den Raum nicht starten.
 *
 * ZWEI DINGE MUSS DIESE DATEI GLEICHZEITIG HALTEN, und das zweite ist das wichtigere:
 *   1. Battle liefert jetzt, was das Preset verspricht.
 *   2. MANAGEMENT IST ZEICHENGLEICH ZU VORHER. Der Live-Spielstand laeuft in diesem Modus; die
 *      erwarteten Listen unten sind deshalb woertlich die alten, fest verdrahteten Preset-Listen,
 *      nicht etwa das, was die neue Aufloesung "auch ergibt".
 */
import { describe, expect, it } from "vitest";

import type { PlayMode } from "@/lib/data/olyDataTypes";
import {
  NEW_GAME_PRESETS,
  buildNewGameStateFromBaseline,
  type NewGamePresetId,
} from "@/lib/game/new-game-setup-service";
import { loesePresetTeamsAusPool, loesePresetTeamsFuerBeideSeiten } from "@/lib/game/preset-team-pool";
import {
  BATTLE_MODE_SPIELTAG_ANZAHL,
  BATTLE_MODE_TEAM_ANZAHL,
  waehleBattleModeTeamIds,
} from "@/lib/season/battle-mode-spielplan";
import { ONLINE_ROOM_TEAM_IDS, buildOwnershipForPreset, buildParticipant, resolveRoomTeamPool } from "@/lib/room/online-room-model";

const JETZT = "2026-01-01T00:00:00.000Z";
const PRESET_IDS: NewGamePresetId[] = ["solo_1", "solo_2", "solo_4", "online_4v4", "custom"];
const SPIELARTEN: PlayMode[] = ["management", "battle"];

/** Der Team-Satz, den ein Spielstand dieser Spielart wirklich hat — nicht der, den wir vermuten. */
function baue(presetId: NewGamePresetId, playMode: PlayMode) {
  const { gameState, preview } = buildNewGameStateFromBaseline({
    presetId,
    playMode,
    saveId: `test-${playMode}-${presetId}`,
    now: JETZT,
  });
  return { gameState, preview, teamIds: new Set(gameState.teams.map((team) => team.teamId)) };
}

describe("Preset x Spielart — die Matrix (jedes Preset, beide Spielarten)", () => {
  for (const playMode of SPIELARTEN) {
    for (const presetId of PRESET_IDS) {
      const preset = NEW_GAME_PRESETS.find((entry) => entry.presetId === presetId)!;

      describe(`${playMode} / ${presetId}`, () => {
        const { gameState, preview, teamIds } = baue(presetId, playMode);

        it("liefert genau die vom Preset versprochene Anzahl Teams — fuer beide Spieler", () => {
          expect(preview.chrisTeamIds).toHaveLength(preset.chrisCount);
          expect(preview.frankyTeamIds).toHaveLength(preset.frankyCount);
        });

        it("vergibt ausschliesslich Teams, die es in DIESEM Spielstand gibt", () => {
          for (const teamId of [...preview.chrisTeamIds, ...preview.frankyTeamIds]) {
            expect(teamIds.has(teamId), `${teamId} existiert nicht im Save`).toBe(true);
          }
        });

        it("teilt kein Team doppelt zu", () => {
          const alle = [...preview.chrisTeamIds, ...preview.frankyTeamIds];
          expect(new Set(alle).size).toBe(alle.length);
        });

        it("legt KEINE Besitz-Zeile fuer ein Team an, das es im Save nicht gibt", () => {
          const geister = (gameState.scenarioMeta?.teamOwnership ?? []).filter((eintrag) => !teamIds.has(eintrag.teamId));
          expect(geister.map((eintrag) => eintrag.teamId)).toEqual([]);
        });

        it("blockiert nicht — die Anzahl-Zusage ist erfuellbar", () => {
          expect(preview.blockers).toEqual([]);
        });
      });
    }
  }
});

/**
 * DIE ERWARTUNGEN HIER SIND DIE ALTEN, FEST VERDRAHTETEN LISTEN, ZEICHEN FUER ZEICHEN.
 * Sie stehen absichtlich als Literale da und nicht als `preset.chrisTeamIds`: der Sinn ist ja
 * gerade, dass die neue Aufloesung im vollen 32er-Pool NICHTS veraendert. Ein Vergleich gegen die
 * Quelle wuerde jede kuenftige Verschiebung mitwandern und genau das verschweigen.
 */
describe("Management bleibt zeichengleich — die Zuteilung von vor dem Umbau", () => {
  const erwartet: Record<NewGamePresetId, { chris: string[]; franky: string[] }> = {
    solo_1: { chris: ["M-M"], franky: [] },
    solo_2: { chris: ["M-M", "D-P"], franky: [] },
    solo_4: { chris: ["P-S", "D-P", "M-M", "V-W"], franky: [] },
    online_4v4: { chris: ["P-S", "D-P", "M-M", "V-W"], franky: ["M-S", "P-C", "C-S", "G-G"] },
    custom: { chris: ["M-M"], franky: [] },
  };

  for (const presetId of PRESET_IDS) {
    it(`${presetId}: dieselben Team-IDs in derselben Reihenfolge`, () => {
      const { preview } = baue(presetId, "management");
      expect(preview.chrisTeamIds).toEqual(erwartet[presetId].chris);
      expect(preview.frankyTeamIds).toEqual(erwartet[presetId].franky);
    });
  }

  it("32 Teams, 10 Spieltage, 10 Disziplin-Eintraege — der Management-Rahmen steht", () => {
    const { gameState } = baue("solo_1", "management");
    expect(gameState.teams).toHaveLength(32);
    expect(gameState.season.matchdayIds).toHaveLength(10);
    expect(gameState.seasonState.disciplineSchedule ?? []).toHaveLength(10);
    expect(gameState.playMode).toBeUndefined();
  });
});

describe("Battle liefert den versprochenen Rahmen — 16 Teams, 20 Spieltage, 160 Begegnungen", () => {
  for (const presetId of PRESET_IDS) {
    it(`${presetId}: 16/20/160 und 20 Disziplin-Eintraege`, () => {
      const { gameState } = baue(presetId, "battle");
      expect(gameState.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
      expect(gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
      expect(gameState.seasonState.disciplineSchedule ?? []).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
      expect(gameState.seasonState.schedule ?? []).toHaveLength(160);
      expect(gameState.playMode).toBe("battle");
    });
  }

  /**
   * DIE ZWEI FEHLER AUS DEM BEFUND, NAMENTLICH. Sie sind aus dem Matrix-Block oben ableitbar,
   * stehen aber trotzdem hier: eine Regression an genau dieser Stelle soll einen Testnamen haben,
   * der sagt WAS kaputt ist, nicht nur "Matrix battle/solo_4 Eigenschaft 1".
   */
  it("solo_4 gibt Chris VIER Teams — vorher waren es stumm zwei (P-S und V-W fielen weg)", () => {
    const { preview } = baue("solo_4", "battle");
    expect(preview.chrisTeamIds).toHaveLength(4);
    expect(preview.chrisTeamIds).not.toContain("P-S");
    expect(preview.chrisTeamIds).not.toContain("V-W");
  });

  it("online_4v4 ist 4 gegen 4 — vorher 2 gegen 4, mit einer folgenlosen Warnung", () => {
    const { preview } = baue("online_4v4", "battle");
    expect(preview.chrisTeamIds).toHaveLength(4);
    expect(preview.frankyTeamIds).toHaveLength(4);
    expect(preview.warnings).toEqual([]);
  });

  it("die Zuteilung ist deterministisch — zweimal gebaut, zweimal dasselbe", () => {
    const ersteres = baue("online_4v4", "battle").preview;
    const zweiteres = baue("online_4v4", "battle").preview;
    expect(zweiteres.chrisTeamIds).toEqual(ersteres.chrisTeamIds);
    expect(zweiteres.frankyTeamIds).toEqual(ersteres.frankyTeamIds);
  });
});

/**
 * DIE ANZAHL-PRUEFUNG IST EIN BLOCKER GEWORDEN — aber nur fuer die PRESET-VORGABE.
 *
 * Der Assistent schickt seit dem Umbau auf freie Team-Auswahl immer `custom` PLUS eine Liste. Wuerde
 * die Pruefung auch dort greifen, blockierte jede Auswahl ausser genau einem Team. Wer seine Teams
 * selbst benennt, bestimmt auch ihre Anzahl.
 */
describe("Anzahl-Blocker: greift bei der Preset-Vorgabe, nicht bei ausdruecklicher Auswahl", () => {
  it("ausdrueckliche Auswahl beliebiger Groesse laeuft durch", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      playMode: "battle",
      chrisTeamIds: ["A-A", "B-B", "M-M"],
      now: JETZT,
    });
    expect(preview.chrisTeamIds).toEqual(["A-A", "B-B", "M-M"]);
    expect(preview.blockers).toEqual([]);
  });

  it("benennt der Anrufer ein Team, das es im Save nicht gibt, wird das GESAGT statt geschluckt", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      playMode: "battle",
      // "P-S" und "V-W" sind Management-Teams und in der 16er-Auswahl nicht dabei.
      chrisTeamIds: ["M-M", "P-S", "V-W"],
      now: JETZT,
    });
    expect(preview.chrisTeamIds).toEqual(["M-M"]);
    expect(preview.warnings).toContain("new_game_unknown_team_ids:P-S,V-W");
    expect(preview.blockers).toEqual([]);
  });

  it("ohne ein einziges gueltiges Team blockt weiterhin der alte Riegel", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "custom",
      playMode: "battle",
      chrisTeamIds: ["P-S"],
      now: JETZT,
    });
    expect(preview.blockers).toContain("new_game_requires_at_least_one_chris_team");
  });
});

/**
 * F2: EINE SEITE AUS DER VORGABE, DIE ANDERE AUSDRUECKLICH — der Fall, der dazwischen durchfiel.
 *
 * NACHGESTELLTER FEHLER (Review-Befund F2, woertlich der Aufruf des Pruefers): Chris ohne Liste
 * (also Preset-Vorgabe), Franky mit genau einem Wunschteam. Herausgekommen ist
 *
 *   Chris  ["D-P","M-M","A-A","B-B"]     Franky  []      warnings []   blockers []
 *
 * Franky stand mit NULL Teams da, und niemand sagte es. Ursache: `gastAnzahl` war fuer eine
 * ausdrueckliche Franky-Liste hart `0` — es wurde also nichts fuer ihn zurueckgelegt, Chris'
 * Auffuellung nahm sich `A-A`, und der `.filter(...)` darunter strich es Franky anschliessend weg.
 * Eine ausdrueckliche Liste unterliegt bewusst keiner Anzahl-Pruefung, also blieb es stumm.
 *
 * `A-A` ist im Battle-Pool vorhanden und von niemandem beansprucht — es gibt hier also gar nichts
 * abzuwaegen: Franky MUSS es behalten.
 */
describe("F2 — gemischter Aufruf: Preset fuer Chris, ausdrueckliche Liste fuer Franky", () => {
  it("Frankys ausdrueckliches Team bleibt ihm — und Chris bekommt trotzdem seine vier", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      playMode: "battle",
      frankyTeamIds: ["A-A"],
      now: JETZT,
    });

    expect(preview.frankyTeamIds).toEqual(["A-A"]);
    expect(preview.chrisTeamIds).not.toContain("A-A");
    // Chris kommt weiterhin aus der Vorgabe, seine Anzahl-Zusage gilt also unveraendert.
    expect(preview.chrisTeamIds).toHaveLength(4);
    expect(preview.blockers).toEqual([]);
    expect(preview.warnings).toEqual([]);
  });

  it("auch im Management-Pool: die ausdrueckliche Seite wird vor der Auffuellung reserviert", () => {
    // `M-M` ist das erste Wunschteam VON CHRIS (`CHRIS_ONLINE_4V4_TEAM_IDS`). Nennt Franky es
    // ausdruecklich, gewinnt weiter der Host — dieselbe Regel wie vor dem Umbau. `A-A` dagegen
    // gehoert keiner Wunschliste und muss bei Franky bleiben.
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      frankyTeamIds: ["A-A", "M-M"],
      now: JETZT,
    });

    expect(preview.frankyTeamIds).toEqual(["A-A"]);
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
  });

  it("die umgekehrte Mischung war nie kaputt und bleibt es nicht: Chris ausdruecklich, Franky aus der Vorgabe", () => {
    const { preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      playMode: "battle",
      chrisTeamIds: ["A-A"],
      now: JETZT,
    });

    expect(preview.chrisTeamIds).toEqual(["A-A"]);
    expect(preview.frankyTeamIds).toHaveLength(4);
    expect(preview.frankyTeamIds).not.toContain("A-A");
    expect(preview.blockers).toEqual([]);
  });
});

describe("Die Aufloesung selbst (lib/game/preset-team-pool.ts)", () => {
  it("voller Pool: die Wunschliste kommt unveraendert und in ihrer Reihenfolge zurueck", () => {
    const ergebnis = loesePresetTeamsAusPool({
      bevorzugt: ["P-S", "D-P", "M-M", "V-W"],
      anzahl: 4,
      pool: ONLINE_ROOM_TEAM_IDS,
    });
    expect(ergebnis.teamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(ergebnis.nachgefuellt).toEqual([]);
    expect(ergebnis.fehlendeBevorzugte).toEqual([]);
  });

  it("knapper Pool: fehlende Wunschteams werden benannt UND alphabetisch ersetzt", () => {
    const ergebnis = loesePresetTeamsAusPool({
      bevorzugt: ["P-S", "D-P", "M-M", "V-W"],
      anzahl: 4,
      pool: resolveRoomTeamPool("battle"),
    });
    expect(ergebnis.teamIds).toHaveLength(4);
    expect(ergebnis.fehlendeBevorzugte).toEqual(["P-S", "V-W"]);
    expect(ergebnis.nachgefuellt).toEqual(["A-A", "B-B"]);
  });

  it("die Auffuellung ist unabhaengig davon, in welcher Reihenfolge der Pool hereinkommt", () => {
    const pool = ["D-L", "A-A", "M-M", "B-B"];
    const vorwaerts = loesePresetTeamsAusPool({ anzahl: 3, pool });
    const rueckwaerts = loesePresetTeamsAusPool({ anzahl: 3, pool: [...pool].reverse() });
    expect(vorwaerts.teamIds).toEqual(["A-A", "B-B", "D-L"]);
    expect(rueckwaerts.teamIds).toEqual(vorwaerts.teamIds);
  });

  /**
   * DER FEHLER AUS DEM ERSTEN ANLAUF, festgenagelt: zweimal einseitig aufloesen (erst Host, dann
   * Gast) liess den Host beim Auffuellen das WUNSCHTEAM DES GASTES schlucken, und der Gast ging
   * leer aus. Wer zuerst aufgeloest wird, darf nicht darueber entscheiden, ob der andere
   * ueberhaupt mitspielt.
   */
  it("knapper Pool fuer zwei Spieler: keiner verhungert, beide behalten ihr Wunschteam", () => {
    const ergebnis = loesePresetTeamsFuerBeideSeiten({
      pool: ["A-A", "P-S", "M-S"],
      hostBevorzugt: ["P-S", "D-P", "M-M", "V-W"],
      hostAnzahl: 4,
      gastBevorzugt: ["M-S", "P-C", "C-S", "G-G"],
      gastAnzahl: 4,
    });
    expect(ergebnis.host.teamIds).toEqual(["P-S", "A-A"]);
    expect(ergebnis.gast.teamIds).toEqual(["M-S"]);
  });

  it("die zwei Seiten ueberschneiden sich nie", () => {
    const ergebnis = loesePresetTeamsFuerBeideSeiten({
      pool: resolveRoomTeamPool("battle"),
      hostBevorzugt: ["M-M", "D-P"],
      hostAnzahl: 4,
      gastBevorzugt: ["M-M", "M-S"],
      gastAnzahl: 4,
    });
    const ueberschneidung = ergebnis.host.teamIds.filter((teamId) => ergebnis.gast.teamIds.includes(teamId));
    expect(ueberschneidung).toEqual([]);
    // Bei Ueberschneidung der Wunschlisten gewinnt der Host — dieselbe Regel wie vorher.
    expect(ergebnis.host.teamIds).toContain("M-M");
    expect(ergebnis.gast.teamIds).not.toContain("M-M");
  });
});

describe("Raum-Presets (A4): auch die Lobby verteilt aus dem richtigen Pool", () => {
  const host = buildParticipant({ participantId: "p-host", userId: "u-host", displayName: "Chris", role: "host" });
  const franky = buildParticipant({ participantId: "p-franky", userId: "u-franky", displayName: "Franky", role: "player" });

  it("der Battle-Pool eines Raums ist derselbe wie der des Spielstands", () => {
    expect(resolveRoomTeamPool("battle")).toEqual(waehleBattleModeTeamIds(ONLINE_ROOM_TEAM_IDS.map((teamId) => ({ teamId }))));
    expect(resolveRoomTeamPool("battle")).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(resolveRoomTeamPool("management")).toBe(ONLINE_ROOM_TEAM_IDS);
    expect(resolveRoomTeamPool(null)).toBe(ONLINE_ROOM_TEAM_IDS);
  });

  /**
   * DER 1V1-FEHLER, namentlich: im 1v1-Preset bekommt der Host genau
   * `FOUR_PLUS_FOUR_HOST_TEAM_IDS.slice(0, 1)` = `P-S`. Im Battle-Pool gibt es `P-S` nicht — vorher
   * hatte er danach NULL Teams und lief in "weise dir zuerst ein Team zu".
   */
  it("1v1 im Battle-Raum: Host UND Gast bekommen je ein echtes Team", () => {
    const pool = resolveRoomTeamPool("battle");
    const ownership = buildOwnershipForPreset([host, franky], "chris_1_franky_1_rest_ai", pool);
    const chris = ownership.filter((eintrag) => eintrag.participantId === "p-host").map((eintrag) => eintrag.teamId);
    const gast = ownership.filter((eintrag) => eintrag.participantId === "p-franky").map((eintrag) => eintrag.teamId);
    expect(chris).toHaveLength(1);
    expect(gast).toHaveLength(1);
    expect(pool).toContain(chris[0]!);
    expect(pool).toContain(gast[0]!);
    expect(chris[0]).not.toBe(gast[0]);
  });

  it("4+4 im Battle-Raum: 4 gegen 4, alle 8 aus dem 16er-Pool, und nur 16 Zeilen insgesamt", () => {
    const pool = resolveRoomTeamPool("battle");
    const ownership = buildOwnershipForPreset([host, franky], "chris_4_franky_4_rest_ai", pool);
    expect(ownership).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    const chris = ownership.filter((eintrag) => eintrag.participantId === "p-host");
    const gast = ownership.filter((eintrag) => eintrag.participantId === "p-franky");
    expect(chris).toHaveLength(4);
    expect(gast).toHaveLength(4);
    for (const eintrag of ownership) {
      expect(pool).toContain(eintrag.teamId);
    }
  });

  it("jedes Raum-Preset liefert im Battle-Pool seine volle Anzahl", () => {
    const pool = resolveRoomTeamPool("battle");
    const erwartet = {
      chris_1_rest_ai: [1, 0],
      chris_1_franky_1_rest_ai: [1, 1],
      chris_2_rest_ai: [2, 0],
      chris_2_franky_2_rest_ai: [2, 2],
      chris_4_rest_ai: [4, 0],
      chris_4_franky_4_rest_ai: [4, 4],
    } as const;
    for (const [preset, [chrisAnzahl, gastAnzahl]] of Object.entries(erwartet)) {
      const ownership = buildOwnershipForPreset([host, franky], preset as keyof typeof erwartet, pool);
      expect(ownership.filter((e) => e.participantId === "p-host"), preset).toHaveLength(chrisAnzahl);
      expect(ownership.filter((e) => e.participantId === "p-franky"), preset).toHaveLength(gastAnzahl);
    }
  });
});

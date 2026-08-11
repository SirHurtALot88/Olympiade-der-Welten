/**
 * DER BROWSER DARF DEN VORSTAND NICHT NEU ERFINDEN, WENN IHM DIE DATEN FEHLEN.
 *
 * DER BEFUND (am Live-Abbild vom 11.08.2026 gemessen, Saves `new-game-1786465783606-0kalpx`
 * und `new-game-1785823388048-1hf25q`):
 *
 * `normalizeLoadedFoundationGameState` laesst jeden frisch geladenen Spielstand durch
 * `refreshTeamObjectiveState` laufen — auch den KOMPAKTEN Payload. Dieser Payload streicht
 * `attributeSheetStats` aller Spieler ausser denen des eigenen Teams
 * (`compactFoundationInitialGameState`). `selectTeamCaptain` rechnet seinen `leadershipScore`
 * aber genau aus diesen Werten und faellt ohne sie still auf `player.coreStats` zurueck
 * (`?? player.coreStats.soc` usw. — Fehlerklasse 5: die Funktion liefert IMMER eine Zahl,
 * niemals ein „weiss ich nicht"). Gemessen am Abbild: 31 von 32 Teams bekamen im Browser einen
 * ANDEREN Kapitaen oder einen anderen Wert (M-M 73,2 -> 58,3; P-S 84,5 -> 68,9), einzig das
 * MENSCHLICHE Team blieb richtig — weil dessen Bloecke mitfahren.
 *
 * Der Kapitaen daempft ueber `captainDamp = leadership / 40` die `perceivedPressure`. Also stand
 * im Browser fuer 31 von 32 Teams eine zu HOHE gefuehlte Vorstands-Pressure (+0,2 bis +0,6), und
 * die faehrt beim naechsten Speichern in den Spielstand. Dort lesen sie
 * `getBoardReplacementProbability` (GM-Entlassung), `gm-pressure-behavior` (KI-Panik) und die
 * Slate-Groesse der naechsten Zielrunde. Der Beweis, dass der gespeicherte Stand bisher SAUBER
 * ist: `Σ|gespeichert − Rechnung auf VOLLEN Daten| = 0,00` ueber alle vergleichbaren Teams,
 * gegen `6,10` bzw. `1,30` fuer die Rechnung auf dem gekuerzten Payload.
 *
 * DIE REPARATUR: bei einem kompakten Payload behaelt der Browser die vom Server gelieferte
 * `boardConfidence`. Die ZIELE darf er weiter frisch rechnen — die stimmen auch auf dem
 * gekuerzten Payload (am Abbild gemessen: 216 == 216 bzw. 441 == 441 Eintraege, null
 * Inhaltsabweichung, null Statusabweichung).
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { normalizeLoadedFoundationGameState } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";

function durchsNetz<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Ein Spielstand, in dem die Kapitaensrechnung ueberhaupt etwas zu verlieren hat: die
 * Attributbloecke tragen andere Werte als der `coreStats`-Rueckfall.
 */
function mitAttributbloecken(gameState: GameState): GameState {
  return {
    ...gameState,
    players: gameState.players.map((player, index) => ({
      ...player,
      attributeSheetStats: {
        ...(player.attributeSheetStats ?? {}),
        charisma: 40 + ((index * 7) % 55),
        will: 35 + ((index * 11) % 60),
        determination: 30 + ((index * 13) % 65),
        awareness: 45 + ((index * 5) % 50),
      },
    })) as GameState["players"],
  };
}

describe("Kompakter Payload verfaelscht den Vorstand nicht", () => {
  // Der Stand, wie ihn der SERVER haelt: der Vorstand ist dort auf VOLLEN Daten gerechnet.
  // (Der Seed traegt `boardConfidence: {}` — ohne diesen Schritt waere unten nichts zu vergleichen.)
  const voll = normalizeLoadedFoundationGameState(mitAttributbloecken(createSingleplayerGameState()), {
    compactInitial: false,
  });
  const kompakt = durchsNetz(compactFoundationInitialGameState(voll));

  it("VORBEDINGUNG: die Kuerzung veraendert die Kapitaensrechnung wirklich", () => {
    // Ohne diesen Fall prueft der Test darunter nichts — dann waere er auch ueber der
    // kaputten Fassung gruen.
    const abweichend = voll.teams.filter((team) => {
      const a = selectTeamCaptain(voll, team.teamId);
      const b = selectTeamCaptain(kompakt, team.teamId);
      return a?.playerId !== b?.playerId || a?.leadershipScore !== b?.leadershipScore;
    });
    expect(abweichend.length).toBeGreaterThan(0);
  });

  it("die gefuehlte Vorstands-Pressure aus dem kompakten Payload ist die vom Server gelieferte", () => {
    const ausKompakt = normalizeLoadedFoundationGameState(durchsNetz(kompakt), { compactInitial: true });

    // Kein Team darf einen anderen Vorstandswert bekommen, als der Server mitgeschickt hat.
    const gelieferte = kompakt.seasonState.boardConfidence ?? {};
    expect(Object.keys(gelieferte).length, "Vorbedingung: der Payload traegt ueberhaupt Vorstandswerte").toBeGreaterThan(0);
    const abweichende: string[] = [];
    for (const teamId of Object.keys(gelieferte)) {
      const vorher = JSON.stringify((gelieferte as Record<string, unknown>)[teamId]);
      const nachher = JSON.stringify(
        (ausKompakt.seasonState.boardConfidence as Record<string, unknown> | undefined)?.[teamId],
      );
      if (vorher !== nachher) abweichande(abweichende, teamId, vorher, nachher);
    }
    expect(abweichende, abweichende.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("KONTROLLFALL: die Ziele werden auf dem kompakten Payload weiterhin frisch gerechnet", () => {
    // Sonst waere die Reparatur auch dadurch „gruen", dass die Aufbereitung gar nichts mehr tut.
    const ausKompakt = normalizeLoadedFoundationGameState(durchsNetz(kompakt), { compactInitial: true });
    expect((ausKompakt.seasonState.teamSeasonObjectives ?? []).length).toBeGreaterThan(0);
  });

  it("KONTROLLFALL: bei VOLLEM Payload rechnet der Browser den Vorstand weiterhin neu", () => {
    const ohneVorstand: GameState = {
      ...voll,
      seasonState: { ...voll.seasonState, boardConfidence: {} },
    };
    const ausVoll = normalizeLoadedFoundationGameState(durchsNetz(ohneVorstand), { compactInitial: false });
    expect(Object.keys(ausVoll.seasonState.boardConfidence ?? {}).length).toBeGreaterThan(0);
  });
});

function abweichande(sammler: string[], teamId: string, vorher: string, nachher: string) {
  sammler.push(`${teamId}: geliefert ${vorher} -> im Browser ${nachher}`);
}

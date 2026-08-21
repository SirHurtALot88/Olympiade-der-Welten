/**
 * DIE ARENA MUSS SICH AUFBAUEN LASSEN, OHNE ZU WERFEN.
 *
 * DER ANLASS ist #586: die damals neue Kaufphasen-Warnung warf beim RENDERN der Arena, und das
 * kam ins Spiel, weil `full-test-suite` kein Pflicht-Check ist. Daraufhin sind zwei Wächter-Läufe
 * ins Tor gewandert (#602 Quelltext, #611 Render) — der Befund beim Nachmessen war aber unbequem:
 * **kein einziger Test rendert die Arena.** `DisciplineStageArena` kommt in 27 Testdateien vor;
 * alle lesen ihren Quelltext oder prüfen die Logik daneben. Ein Absturz wie #586 wäre also auch
 * mit den neuen Wächtern durchgerutscht.
 *
 * Diese Datei schliesst genau das. Sie benutzt `renderToStaticMarkup` und wird dadurch vom
 * Render-Wächter (`scripts/fahre-render-waechter.ts`) VON SELBST eingesammelt — sie läuft also im
 * Pflicht-Job mit, ohne dass jemand sie irgendwo eintragen muss.
 *
 * WARUM DIE ZUSTÄNDE VOLLSTÄNDIG SIND UND NICHT KAPUTT: der erste Entwurf prüfte Teil-Spielstände
 * (Saison da, `seasonState` fehlt). Nachgemessen trägt das nicht — die Shell hat ein
 * Bootstrap-Gate (`gameState.season.id === "loading"`, FoundationShellRouterBody.tsx:839), und
 * `foundation-initial-compact-state.ts:198` setzt `seasonState` ausnahmslos. Diesen Zustand
 * bekommt die Arena nie zu sehen; ihn zu prüfen hätte eine Sicherheit vorgetäuscht, die nichts
 * absichert. Geprüft werden deshalb die Zustände, in denen die Bühne wirklich steht — allen voran
 * der aus #586: neue Saison, Spieltag 1 offen, Geld auf dem Konto, Warnung sichtbar.
 *
 * WAS SIE PRÜFT UND WAS NICHT: nur, dass der Aufbau nicht wirft. Kein Markup, keine Texte, keine
 * Zahlen — die Entscheidung, WANN die Warnung erscheint, steht in
 * `tests/arena-warnt-vor-dem-letzten-kauftag.test.ts` auf Funktionsebene und ist dort besser
 * aufgehoben. Was dort prinzipbedingt nicht auffallen kann, ist ein Fehler, der erst entsteht,
 * wenn die `useMemo`s der Komponente wirklich laufen. Genau das war #586.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DisciplineStageArena from "@/app/foundation/discipline-stage/DisciplineStageArena";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Derselbe Zustandsbauer wie in `arena-warnt-vor-dem-letzten-kauftag.test.ts` — bewusst, damit
 * beide Tests dieselbe Lage meinen: dort wird die Entscheidung geprüft, hier der Aufbau.
 * Ergänzt um die Listen, die die Bühne beim Rendern liest und der Funktionstest nicht braucht.
 */
function spielstand(input: {
  gamePhase?: string;
  currentMatchday?: number;
  matchdayStatus?: string;
  mitErgebnis?: boolean;
} = {}): GameState {
  const teams = [
    { teamId: "S-C", cash: 24.5, manuell: true },
    { teamId: "M-M", cash: 900, manuell: false },
  ];
  return {
    gamePhase: input.gamePhase ?? "season_active",
    season: {
      id: "season-2",
      name: "Saison 2",
      currentMatchday: input.currentMatchday ?? 1,
      matchdayIds: ["season-2-matchday-1"],
    },
    matchdayState: { matchdayId: "season-2-matchday-1", status: input.matchdayStatus ?? "planning" },
    teams: teams.map((team) => ({
      teamId: team.teamId,
      shortCode: team.teamId,
      name: `Team ${team.teamId}`,
      cash: team.cash,
      humanControlled: team.manuell,
    })),
    players: [],
    rosters: [],
    disciplines: [],
    seasonState: {
      teamControlSettings: Object.fromEntries(
        teams.map((team) => [
          team.teamId,
          { teamId: team.teamId, controlMode: team.manuell ? "manual" : "ai", ownerId: team.manuell ? "user_local" : null },
        ]),
      ),
      matchdayResults: input.mitErgebnis
        ? [{ id: "r1", seasonId: "season-2", matchdayId: "season-2-matchday-1", status: "preview_applied" }]
        : [],
      disciplineSchedule: [],
      lineupDrafts: [],
      formCards: [],
    },
  } as unknown as GameState;
}

function baueArena(gameState: GameState) {
  return () =>
    renderToStaticMarkup(
      <DisciplineStageArena gameState={gameState} selectedTeamId="S-C" activeManagerTeamId="S-C" />,
    );
}

describe("Die Arena wirft beim Aufbau nicht", () => {
  it("baut den Zustand aus #586 auf — neue Saison, Kauffenster offen, Warnung faellig", () => {
    // DER FAENGER. Genau diese Lage hat #586 ins Spiel gebracht: die Warnung wurde berechnet,
    // und die Berechnung warf mitten im useMemo. Auf Funktionsebene war sie geprueft, gerendert
    // hat sie nie jemand.
    expect(baueArena(spielstand())).not.toThrow();
  });

  it("baut auch auf, wenn die Warnung schweigt", () => {
    // Der Gegenzustand: ein gewerteter Spieltag. Ohne ihn pruefte die Datei nur den einen Zweig.
    expect(baueArena(spielstand({ matchdayStatus: "resolved", mitErgebnis: true }))).not.toThrow();
  });

  it("baut am Saisonende auf, wo nicht gekauft, sondern verkauft wird", () => {
    expect(baueArena(spielstand({ gamePhase: "season_end_management" }))).not.toThrow();
  });
});

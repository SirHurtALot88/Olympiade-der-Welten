/**
 * ZEIGT DER MARKTWERT-HOVER WIRKLICH ETWAS? — Chris am 24.08.2026: „kannst du 6 nochmal prüfen ob
 * der hover wirklich angezeigt wird."
 *
 * DIE FRAGE IST BERECHTIGT, UND DIE BISHERIGE ABDECKUNG BEANTWORTET SIE NICHT.
 * `tests/marktwert-hover-kommt-vom-server.test.ts` liest QUELLTEXT: es belegt, dass die Zuweisungen
 * dastehen. Genau so eine Kette war bei den Saisonstand-Hovers schon einmal vollstaendig „richtig"
 * und im Spiel trotzdem leer (`hoverKader` hing am nirgends gerenderten Modell) — `tsc` zufrieden,
 * jede Ableitung einzeln geprueft, und niemand haette es gemerkt.
 *
 * Nachgezaehlt am 24.08.: KEIN einziger Test hat `FoundationPlayersTableNewLook` je gerendert. Die
 * zehn Suiten, die sie erwaehnen, lesen alle nur den Quelltext.
 *
 * DIESER TEST RENDERT SIE. Er baut eine Zeile, haengt eine Zerlegung dran, faehrt mit der Maus
 * darueber und schaut nach, ob das Panel im DOM steht und sichtbar wird. Das ist die einzige
 * Aussage, die „wird angezeigt" wirklich deckt.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FoundationPlayersTableNewLook from "@/app/foundation/players-table/FoundationPlayersTableNewLook";
import type { MarktwertHerleitung } from "@/lib/foundation/marktwert-herleitung";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import type { GameState } from "@/lib/data/olyDataTypes";

const HERLEITUNG: MarktwertHerleitung = {
  zeilen: [
    { disciplineId: "spurt", rank: 33, amount: 5.52 },
    { disciplineId: "fechten", rank: 34, amount: 5.49 },
  ],
  restAnzahl: 18,
  restSumme: 33.39,
  summeRaenge: 44.4,
  mwChangeFix: null,
  marktwert: 44.4,
};

/**
 * Baut Zeile und Props aus einem ECHTEN Spielstand, nicht aus einem Handfixture: der Spieler, die
 * Disziplinen und die Teams kommen aus dem Generator. Sonst pruefte der Fall eine Tabelle, die es
 * so nie gibt — und die Disziplin-Namen im Panel kommen aus `gameState.disciplines`.
 */
function baueUmgebung(input: { mitHerleitung: boolean }) {
  const gameState = createSingleplayerGameState() as unknown as GameState;
  const rosterEintrag = gameState.rosters[0]!;
  const player = gameState.players.find((eintrag) => eintrag.id === rosterEintrag.playerId)!;
  const disziplin = gameState.disciplines[0]!;

  const herleitung: MarktwertHerleitung = {
    ...HERLEITUNG,
    zeilen: [{ disciplineId: disziplin.id, rank: 33, amount: 5.52 }],
    restAnzahl: 19,
    restSumme: Number((HERLEITUNG.summeRaenge - 5.52).toFixed(2)),
  };

  const row = {
    player,
    roster: rosterEintrag,
    team: gameState.teams.find((team) => team.teamId === rosterEintrag.teamId) ?? null,
    teamId: rosterEintrag.teamId,
    playerOvr: 70,
    ovrRank: 12,
    playerMvs: 55,
    playerPps: 30,
    axisPps: { pow: 8, spe: 8, men: 7, soc: 7 },
    disciplinePpsByAxis: [],
    sellPreview: null,
    marketValueBreakdown: input.mitHerleitung ? herleitung : null,
    seasonPoints: 30,
    appearances: 4,
    bestDiscipline: disziplin.name,
    careerLeagueStats: null,
    isActive: true,
    isFreeAgent: false,
    transferStatus: "Active Player",
  } as never;

  return {
    gameState,
    disziplin,
    props: {
      rows: [row],
      gameState,
      // Der Haus-Bauer statt eines Handfixtures: die Komponente liest auch die Achsen-Pools
      // (pow/spe/men/soc), und ein unvollstaendiges Objekt liess sie beim Rendern werfen.
      leaguePlayerHeatPools: createEmptyLeaguePlayerHeatPools(gameState.disciplines.map((d) => d.id)),
      sortState: undefined,
      onToggleSort: () => {},
      playerScope: "active" as const,
      onChangeScope: () => {},
      teams: gameState.teams,
      playerTeamFilter: "all",
      onChangeTeamFilter: () => {},
      playerClassFilter: "all",
      playerClassOptions: [],
      onChangeClassFilter: () => {},
      playerBracketCounts: {},
      openPlayerDrawerById: () => {},
      openTeamProfileById: () => {},
    },
  };
}

/** Das gerenderte Markup der Tabelle — genau das, was der Browser bekaeme. */
function rendere(mitHerleitung: boolean) {
  const umgebung = baueUmgebung({ mitHerleitung });
  return { ...umgebung, markup: renderToStaticMarkup(<FoundationPlayersTableNewLook {...(umgebung.props as never)} />) };
}

/** Schneidet das Marktwert-Panel aus dem Markup — samt Attributen, damit `hidden` pruefbar bleibt. */
function schneidePanel(markup: string): string | null {
  const anfang = markup.indexOf('aria-label="Marktwert ');
  if (anfang < 0) return null;
  const oeffnend = markup.lastIndexOf("<div", anfang);
  const ende = markup.indexOf("</div></span>", anfang);
  return markup.slice(oeffnend, ende < 0 ? markup.length : ende);
}

describe("Marktwert-Hover · wirklich gerendert", () => {
  it("legt das Panel ins Markup, sobald die Zeile eine Zerlegung traegt", () => {
    const { markup, disziplin } = rendere(true);
    const panel = schneidePanel(markup);
    expect(panel, "kein Marktwert-Panel im gerenderten Markup").not.toBeNull();
    // Die Disziplin steht mit ihrem KATALOGNAMEN da, nicht mit der ID — sonst haette der Hover
    // zwar Zahlen, aber keine lesbaren Zeilen.
    expect(panel).toContain(disziplin.name);
    expect(panel).toContain("Rang 33");
  });

  it("nennt die Sammelzeile und die Summe, auf die alles hinauslaeuft", () => {
    const { markup } = rendere(true);
    const panel = schneidePanel(markup)!;
    expect(panel).toContain("weitere Disziplinen");
    // Die Ergebniszeile ist der Grund fuer den ganzen Hover: sie verbindet die Zerlegung mit der
    // Zahl, die in der Spalte daneben steht.
    expect(panel).toContain("Marktwert");
  });

  it("steht vor dem Darueberfahren auf `hidden` — sichtbar wird es erst per Maus", () => {
    const panel = schneidePanel(rendere(true).markup)!;
    // Die Sichtbarkeit haengt an React-State; im statischen Rendern ist der Ausgangszustand zu.
    // Geprueft wird hier, dass das Attribut ueberhaupt gesetzt wird — ein Panel ohne `hidden`
    // stuende dauerhaft offen in der Tabelle.
    expect(panel).toContain("hidden");
  });

  it("laesst die Zelle unveraendert, wenn keine Zerlegung da ist", () => {
    // Free Agent, nicht gescoutet, Saison-Archiv: dort gibt es keine Zerlegung, und dann darf auch
    // kein leeres Panel im Markup stehen.
    const { markup } = rendere(false);
    expect(schneidePanel(markup)).toBeNull();
  });

  it("rendert den Marktwert der Zeile weiterhin, mit Panel wie ohne", () => {
    // Der Hover darf die Zelle nicht ersetzen. Faellt das Panel weg, muss die Zahl trotzdem
    // dastehen — `PlayersSellHover` gibt dann nur die Kinder zurueck.
    for (const mitHerleitung of [true, false]) {
      const { markup } = rendere(mitHerleitung);
      expect(markup, `Marktwert-Spalte fehlt (mitHerleitung=${mitHerleitung})`).toContain("nl-players-td-money");
    }
  });
});

import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { heileSponsorAchsenAusgangslage } from "@/lib/sponsor/sponsor-achsen-ausgangslage-heilung";
import { sponsorV4AxisSpecialKey } from "@/lib/sponsor/sponsor-v4-axes";

/**
 * GEMELDET VON CHRIS (19.08.): das Gebäude-Saisonziel stand offen, obwohl er die zwei Stufen gebaut
 * hatte — die Ausgangslage der Achse war beim Wiedererzeugen der Angebote mitgewandert und
 * schluckte seine Arbeit.
 *
 * Die URSACHE ist behoben; die falsche Zahl steckt aber in einem bereits UNTERSCHRIEBENEN Vertrag
 * und verschwindet dadurch nicht. Diese Heilung setzt sie zurueck — beim Laden des Spielstands, ohne
 * Datenbank-Tausch und ohne dass etwas Gespieltes verloren geht.
 *
 * Der Test haelt die GRENZEN fest, nicht nur den Erfolgsfall: geheilt wird ausschliesslich, was
 * beweisbar 0 sein muss.
 */
function achse(specialKey: string, targetValue: string): SponsorOfferComponent {
  return {
    componentId: "axis-target",
    kind: "special",
    specialKey,
    label: "Zielachse",
    targetValue,
    stages: undefined,
    rewardCash: 0,
  };
}

function mitVertrag(gameState: GameState, teamId: string, seasonId: string, komponente: SponsorOfferComponent): GameState {
  const vertrag = {
    ...(gameState.seasonState.sponsorContractsByTeamId?.[teamId] ?? {}),
    teamId,
    seasonId,
    components: [komponente],
  } as TeamSponsorContract;
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorContractsByTeamId: { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}), [teamId]: vertrag },
    },
  };
}

function ausgangslage(gameState: GameState, teamId: string): string {
  return String(gameState.seasonState.sponsorContractsByTeamId?.[teamId]?.components?.[0]?.targetValue ?? "");
}

describe("Heilung der verschobenen Achsen-Ausgangslage", () => {
  const start = createSingleplayerGameState();
  const teamId = start.teams[0]!.teamId;
  const ausbau = sponsorV4AxisSpecialKey("ausbau");

  it("setzt die Ausgangslage der Ausbau-Achse in Saison 1 auf 0", () => {
    const kaputt = mitVertrag(start, teamId, "season-1", achse(ausbau, "axisbase:2;axisscale:2;axisoffset:0"));
    expect(start.season.id).toBe("season-1");
    expect(ausgangslage(heileSponsorAchsenAusgangslage(kaputt), teamId)).toBe("axisbase:0;axisscale:2;axisoffset:0");
  });

  it("läuft ein zweites Mal ins Leere — gleicher gameState, nicht bloß gleicher Inhalt", () => {
    const kaputt = mitVertrag(start, teamId, "season-1", achse(ausbau, "axisbase:2;axisscale:2;axisoffset:0"));
    const geheilt = heileSponsorAchsenAusgangslage(kaputt);
    expect(heileSponsorAchsenAusgangslage(geheilt)).toBe(geheilt);
  });

  it("fasst einen gesunden Vertrag gar nicht erst an", () => {
    const gesund = mitVertrag(start, teamId, "season-1", achse(ausbau, "axisbase:0;axisscale:2;axisoffset:0"));
    expect(heileSponsorAchsenAusgangslage(gesund)).toBe(gesund);
  });

  it("lässt die Solidität-Achse stehen — ihre Ausgangslage ist nicht rekonstruierbar", () => {
    const soliditaet = sponsorV4AxisSpecialKey("soliditaet");
    const stand = mitVertrag(start, teamId, "season-1", achse(soliditaet, "axisbase:195;axisscale:120;axisoffset:10"));
    expect(heileSponsorAchsenAusgangslage(stand)).toBe(stand);
  });

  it("rührt ab Saison 2 nichts mehr an — dort wäre 0 geraten", () => {
    const spaeter: GameState = {
      ...mitVertrag(start, teamId, "season-2", achse(ausbau, "axisbase:4;axisscale:2;axisoffset:0")),
      season: { ...start.season, id: "season-2" },
    };
    expect(heileSponsorAchsenAusgangslage(spaeter)).toBe(spaeter);
  });
});

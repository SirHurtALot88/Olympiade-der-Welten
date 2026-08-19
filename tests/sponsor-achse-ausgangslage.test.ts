import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { sponsorV4AxisTermsFromComponent } from "@/lib/sponsor/sponsor-objective-evaluator";

/**
 * GEMELDET VON CHRIS: „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das habe ich
 * bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht und auch
 * finanziell in die GuV schon mit einberechnet und ausgewiesen wird."
 *
 * DIE AUSGANGSLAGE EINER ACHSE IST EINE ZUSAGE, KEIN MESSWERT VON JETZT. Sie wird bei
 * Angebotserzeugung eingefroren (`axisbase:` im targetValue) und entscheidet, ab welchem Stand
 * gezaehlt wird. `ensureSeasonSponsorOffers` verglich die Zahl der vorhandenen Angebote gegen eine
 * eingetippte 5, waehrend `SPONSOR_ANGEBOTE_JE_TEAM` laengst 3 war — die Bedingung konnte nie mehr
 * wahr werden, und die Funktion erzeugte bei JEDEM Aufruf neu. Sie laeuft bei jedem Laden des
 * Spielstands.
 *
 * Der Sponsorenwurf selbst ist saatgebunden und lieferte dieselben Karten; unsichtbar mitgewandert
 * ist nur die Ausgangslage. Fuer die Achse „Ausbau" heisst das: die Vorsaison baut erst die Gebaeude
 * und waehlt danach den Sponsor — jede gebaute Stufe wanderte in die Ausgangslage, statt auf das
 * Ziel zu zaehlen. Bei Unterschrift stand die Achse damit garantiert auf 0.
 */
function achsenAusgangslagen(gameState: GameState, teamId: string): number[] {
  return (gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [])
    .flatMap((offer) => offer.components ?? [])
    .map((component) => sponsorV4AxisTermsFromComponent(component))
    .filter((terms): terms is NonNullable<typeof terms> => terms != null)
    .map((terms) => terms.baseline);
}

function mitGebaeudestufe(gameState: GameState, teamId: string, facilityId: string, level: number): GameState {
  const bestand = gameState.seasonState.teamFacilities ?? {};
  const eigene = bestand[teamId] ?? { facilities: {} };
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamFacilities: {
        ...bestand,
        [teamId]: {
          ...eigene,
          facilities: {
            ...(eigene.facilities ?? {}),
            [facilityId]: { level, enabled: true, conditionPct: 100 },
          },
        },
      },
    },
  };
}

describe("Sponsor-Achse: die eingefrorene Ausgangslage", () => {
  it("bleibt stehen, wenn zwischen zwei Aufrufen gebaut wird", () => {
    const start = ensureSeasonSponsorOffers(createSingleplayerGameState());
    const teamId = start.teams[0]!.teamId;
    const vorher = achsenAusgangslagen(start, teamId);

    const gebaut = mitGebaeudestufe(mitGebaeudestufe(start, teamId, "fan_shop", 1), teamId, "recovery_center", 1);
    const nachher = achsenAusgangslagen(ensureSeasonSponsorOffers(gebaut), teamId);

    expect(nachher).toEqual(vorher);
  });

  it("erzeugt die Angebote nicht bei jedem Aufruf neu", () => {
    const einmal = ensureSeasonSponsorOffers(createSingleplayerGameState());
    // Identitaet statt Gleichheit: `ensureSeasonSponsorOffers` gibt denselben gameState zurueck,
    // solange es nichts zu tun gibt (`if (!changed) return gameState`). Genau das war kaputt.
    expect(ensureSeasonSponsorOffers(einmal)).toBe(einmal);
  });
});

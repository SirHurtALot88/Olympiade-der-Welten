import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import {
  SPONSOR_V4_AXIS_PBAR,
  SPONSOR_V4_AXIS_SIZE_BY_RARITY,
  sponsorV3Settle,
  sponsorV4AxisSizeFor,
} from "@/lib/sponsor/sponsor-v3-model";
import { getSponsorV3Terms, sponsorV3SettlementParts } from "@/lib/sponsor/sponsor-v3-offer-service";
import {
  SPONSOR_V4_AXIS_KEYS,
  buildSponsorV4AxisTerms,
  evaluateSponsorV4Axis,
  sponsorV4AxisSpecialKey,
  sponsorV4OfferableAxes,
} from "@/lib/sponsor/sponsor-v4-axes";

const baseState = () => createSingleplayerGameState();

function withCash(gameState: GameState, teamId: string, cash: number): GameState {
  return {
    ...gameState,
    teams: gameState.teams.map((team) => (team.teamId === teamId ? { ...team, cash } : team)),
  };
}

/**
 * DIE ACHSEN sind das, was V4 von V3 unterscheidet. In V3 unterschieden sich die fuenf Karten eines
 * Slates ausschliesslich im Risikoprofil um dieselbe Rangleiter; der Ausschlag lag bei 1 bis 3 C
 * gegen eine Faktorschwankung von 30 C, die Wahl war damit praktisch belanglos.
 *
 * Eine Achse misst den eigenen Zuwachs gegen die eigene, bei Angebotserzeugung eingefrorene
 * Ausgangslage. Genau daraus folgen die beiden Zusagen, die hier gepruefte werden: der Hebel ist fuer
 * den Tabellenletzten so gross wie fuer den Meister, und er ist gross genug, um spuerbar zu sein.
 */
describe("Sponsor-Achsen: der Hebel gehoert allen gleich", () => {
  it("zahlt fuer denselben Erfuellungsgrad denselben Betrag — egal ob Rang 1 oder Rang 32", () => {
    const gameState = baseState();
    const [strong, weak] = [gameState.teams[0]!, gameState.teams[gameState.teams.length - 1]!];
    const offersStrong = buildSponsorOffersForTeam({ gameState, teamId: strong.teamId });
    const offersWeak = buildSponsorOffersForTeam({ gameState, teamId: weak.teamId });

    const axisTermsOf = (offers: ReturnType<typeof buildSponsorOffersForTeam>) =>
      offers.map((offer) => getSponsorV3Terms(offer)).filter((terms) => terms?.axis != null);

    const strongAxes = axisTermsOf(offersStrong);
    const weakAxes = axisTermsOf(offersWeak);
    expect(strongAxes.length).toBeGreaterThan(0);
    expect(weakAxes.length).toBeGreaterThan(0);

    // Der Achsenbetrag haengt NUR an der Rarity, nie am Rang. Bei gleicher Rarity ist er identisch —
    // das ist der ganze Mechanismus hinter "jedes Team hat Chancen".
    let verglichen = 0;
    for (const rarity of Object.keys(SPONSOR_V4_AXIS_SIZE_BY_RARITY)) {
      const s = strongAxes.find((terms) => terms!.rarity === rarity);
      const w = weakAxes.find((terms) => terms!.rarity === rarity);
      if (!s || !w) continue;
      verglichen += 1;
      expect(s.goalSize, `Rarity ${rarity}: Spitze und Keller muessen denselben Hebel tragen`).toBe(w.goalSize);
    }
    // Ohne diese Zusicherung waere der Test gruen, wenn die beiden Slates zufaellig keine Rarity
    // teilen — er haette dann nichts geprueft.
    expect(verglichen, "keine gemeinsame Rarity gefunden — der Test hat nichts verglichen").toBeGreaterThan(0);
  });

  it("ist EV-neutral bepreist — voll erfuellt und voll verfehlt liegen symmetrisch um die Leiter", () => {
    const gameState = baseState();
    const teamId = gameState.teams[3]!.teamId;
    const terms = buildSponsorOffersForTeam({ gameState, teamId })
      .map((offer) => getSponsorV3Terms(offer))
      .find((entry) => entry?.axis != null)!;

    expect(terms.goalP).toBe(SPONSOR_V4_AXIS_PBAR);
    const ladderOnly = sponsorV3Settle({ ...terms, goalSize: 0 }, 10, 0);
    const missed = sponsorV3Settle(terms, 10, 0);
    const achieved = sponsorV3Settle(terms, 10, 1);
    // Der Erwartungswert liegt exakt auf der Leiter: die Achse verschiebt nur, nicht den Etat.
    expect((missed + achieved) / 2).toBeCloseTo(ladderOnly, 6);
    expect(achieved - missed).toBeCloseTo(terms.goalSize, 6);
  });

  it("bewegt die Wahl spuerbar — nicht mehr die alten +-2 C", () => {
    // Der Grund fuer den ganzen Umbau: der alte Zielhebel war 6 bis 10 C bei p um 0,45, der
    // wirksame Ausschlag also rund +-3 C. Gegen eine Faktorschwankung von +-30 C war das nichts.
    for (const rarity of ["gewöhnlich", "magisch", "selten", "legendär"] as const) {
      const size = sponsorV4AxisSizeFor(rarity);
      // Zwischen voll erfuellt und voll verfehlt liegt der volle Hebel.
      expect(size).toBeGreaterThanOrEqual(12);
    }
    // Rarity skaliert den Hebel streng monoton — und NUR ihn.
    const sizes = (["gewöhnlich", "magisch", "selten", "legendär"] as const).map((r) => sponsorV4AxisSizeFor(r));
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]!).toBeGreaterThan(sizes[index - 1]!);
    }
    // Golden vergroessert den Hebel, aendert aber nichts an der Bepreisung.
    expect(sponsorV4AxisSizeFor("magisch", true)).toBeGreaterThan(sponsorV4AxisSizeFor("magisch"));
  });
});

describe("Sponsor-Achsen: gemessen gegen die eingefrorene eigene Ausgangslage", () => {
  it("friert die Ausgangslage ein — spaetere Zustandsaenderungen verschieben den Vertrag nicht", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const terms = buildSponsorV4AxisTerms(gameState, teamId, "soliditaet");

    // Dasselbe Team, 500 C reicher: der Erfuellungsgrad steigt, die eingefrorene Basis nicht.
    const richer = withCash(gameState, teamId, (gameState.teams[0]!.cash ?? 0) + 500);
    const after = evaluateSponsorV4Axis(richer, teamId, terms);
    expect(after.fraction).toBe(1);
    // Und die Konditionen selbst sind unveraendert — sonst waere der Zuwachs wegdefiniert.
    expect(buildSponsorV4AxisTerms(gameState, teamId, "soliditaet")).toEqual(terms);
  });

  it("haelt den Erfuellungsgrad in [0, 1] — auch bei absurden Zustaenden", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    for (const key of SPONSOR_V4_AXIS_KEYS) {
      const terms = buildSponsorV4AxisTerms(gameState, teamId, key);
      for (const state of [gameState, withCash(gameState, teamId, -9999), withCash(gameState, teamId, 99999)]) {
        const progress = evaluateSponsorV4Axis(state, teamId, terms);
        expect(progress.fraction, `${key}`).toBeGreaterThanOrEqual(0);
        expect(progress.fraction, `${key}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("liest im Settlement dieselbe Zahl wie die Karte — eine Rechenstelle, kein zweiter Weg", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })
      .find((entry) => getSponsorV3Terms(entry)?.axis != null)!;
    const terms = getSponsorV3Terms(offer)!;
    const component = offer.components.find((entry) => entry.kind === "special")!;

    // Der Evaluator (Settlement-Pfad) und die Achsen-Messung (Anzeige-Pfad) muessen uebereinstimmen.
    const viaEvaluator = evaluateSpecialComponentStage(gameState, teamId, component);
    const viaAxis = evaluateSponsorV4Axis(gameState, teamId, terms.axis!);
    expect(viaEvaluator.fraction).toBeCloseTo(viaAxis.fraction, 9);

    // Und die Settlement-Zeilen addieren sich per Teleskopsumme exakt auf die Auszahlung.
    const parts = sponsorV3SettlementParts({ terms, finalRank: 12, goalFraction: 0.5 });
    const sum = parts.reduce((acc, part) => acc + part.cashDelta, 0);
    expect(sum).toBeCloseTo(sponsorV3Settle(terms, 12, 0.5), 1);
  });

  it("traegt die Konditionen im Vertrag, nicht in einer Tabelle nebenan", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })
      .find((entry) => getSponsorV3Terms(entry)?.axis != null)!;
    const terms = getSponsorV3Terms(offer)!;
    const component = offer.components.find((entry) => entry.kind === "special")!;

    expect(component.specialKey).toBe(sponsorV4AxisSpecialKey(terms.axis!.key));
    // Basis, Skala und Nullpunkt stehen im targetValue — deshalb kann eine spaetere Kalibrierung
    // laufende Vertraege nicht nachtraeglich umwerten.
    expect(String(component.targetValue)).toContain(`axisbase:${terms.axis!.baseline}`);
    expect(String(component.targetValue)).toContain(`axisscale:${terms.axis!.scale}`);
  });
});

describe("Sponsor-Achsen: unerfuellbare Achsen werden gefiltert, nicht geklammert", () => {
  it("bietet einem Team ohne Kader weder Kaderwert noch Frische an", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const leer: GameState = { ...gameState, players: [], rosters: [] };
    const offerable = sponsorV4OfferableAxes(leer, teamId);
    expect(offerable).not.toContain("wachstum");
    expect(offerable).not.toContain("kaderpflege");
    // Was ohne Kader trotzdem geht, bleibt im Angebot.
    expect(offerable).toContain("soliditaet");
  });

  it("bietet einem voll ausgebauten Team keine Ausbau-Achse an", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const maxed: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        teamFacilities: {
          ...(gameState.seasonState.teamFacilities ?? {}),
          [teamId]: {
            facilities: Object.fromEntries(
              ["training_center", "recovery_center", "scouting_office", "analytics_room",
               "fan_shop", "arena_upgrade", "academy", "specialist_wing"].map((id) => [
                id, { level: 5, enabled: true, conditionPct: 100 },
              ]),
            ),
          },
        },
      } as GameState["seasonState"],
    };
    expect(sponsorV4OfferableAxes(maxed, teamId)).not.toContain("ausbau");
  });
});

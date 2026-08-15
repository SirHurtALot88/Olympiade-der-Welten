import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import {
  SPONSOR_V4_AXIS_PBAR,
  SPONSOR_V4_AXIS_SIZE_BY_RARITY,
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3Settle,
  sponsorV4AxisSizeFor,
  type SponsorV3Rarity,
  type SponsorV4AxisKey,
  type SponsorV4AxisTerms,
} from "@/lib/sponsor/sponsor-v3-model";
import {
  getSponsorV3SalaryFactor, getSponsorV3Terms, sponsorV3SettlementParts,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { SPONSOR_GEBAEUDE_LEIHE_AKTIV } from "@/lib/sponsor/sponsor-leih-slate";
import { SPONSOR_BODEN, sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import {
  LEIH_ZIEL_ACHSENRANG,
  LEIH_ZIEL_FRISCHE,
} from "@/lib/sponsor/sponsor-leih-ziele";
import {
  SPONSOR_V4_AXIS_KEYS,
  buildSponsorV4AxisTerms,
  evaluateSponsorV4Axis,
  sponsorV4AxisDefinition,
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
 * Baut eine Achsen-Karte DIREKT — ohne den Umweg ueber `buildSponsorOffersForTeam`.
 *
 * WARUM DIESER UMWEG NOETIG WURDE: seit dem Leih-Ziel-Umbau (siehe Kopfkommentar unten) erzeugt
 * `buildSponsorOffersForTeam` fuer KEIN Team mehr ein Angebot mit einer Achsen-Komponente — jede
 * Gebaeude-Karte traegt jetzt eines der zwei Leih-Ziele statt einer Achse. Die vier Tests in diesem
 * Block pruefen aber Eigenschaften der ACHSEN-RECHENSCHICHT selbst (`buildSponsorV3TermsCore` mit
 * `axis`/`axisSize`, `buildSponsorV4AxisTerms`), und die traegt weiterhin Altvertraege. Diese
 * Hilfsfunktion baut deshalb dieselben zwei Bausteine, die auch der (inzwischen tote) Live-Pfad
 * benutzte, direkt zusammen: `buildSponsorV4AxisTerms` fuer die Konditionen, `buildSponsorV3TermsCore`
 * mit gesetztem `axis`/`axisSize` fuer die Karte, und dieselbe `targetValue`-Kodierung, die
 * `sponsorV4AxisTermsFromComponent` (sponsor-objective-evaluator.ts) auch aus einem echten Angebot
 * gelesen haette.
 */
function bauteAchsenKarte(input: {
  gameState: GameState;
  teamId: string;
  startRank: number;
  rarity: SponsorV3Rarity;
  achse?: SponsorV4AxisKey;
}): {
  terms: ReturnType<typeof buildSponsorV3TermsCore>;
  component: SponsorOfferComponent;
  axis: SponsorV4AxisTerms;
} {
  const achse = input.achse ?? "soliditaet";
  const axis = buildSponsorV4AxisTerms(input.gameState, input.teamId, achse);
  const salaryFactor = getSponsorV3SalaryFactor(input.gameState);
  const baseLadder = sponsorKurvenLeiter({ shape: "stetig", startRank: input.startRank, salaryFactor });
  const terms = buildSponsorV3TermsCore({
    baseLadder,
    startRank: input.startRank,
    rarity: input.rarity,
    card: sponsorV3CardByKey("achse"),
    goalKey: sponsorV4AxisSpecialKey(achse),
    salaryFactor,
    floor: SPONSOR_BODEN,
    axis,
    axisSize: sponsorV4AxisSizeFor(input.rarity),
  });
  const component: SponsorOfferComponent = {
    componentId: "axis-target",
    kind: "special",
    specialKey: sponsorV4AxisSpecialKey(achse),
    label: `Zielachse · ${achse}`,
    targetValue: `axisbase:${axis.baseline};axisscale:${axis.scale};axisoffset:${axis.offset}`,
    stages: undefined,
    rewardCash: 0,
    penaltyCash: undefined,
  };
  return { terms, component, axis };
}

/**
 * DIE ACHSEN sind das, was V4 von V3 unterscheidet. In V3 unterschieden sich die fuenf Karten eines
 * Slates ausschliesslich im Risikoprofil um dieselbe Rangleiter; der Ausschlag lag bei 1 bis 3 C
 * gegen eine Faktorschwankung von 30 C, die Wahl war damit praktisch belanglos.
 *
 * Eine Achse misst den eigenen Zuwachs gegen die eigene, bei Angebotserzeugung eingefrorene
 * Ausgangslage. Genau daraus folgen die beiden Zusagen, die hier gepruefte werden: der Hebel ist fuer
 * den Tabellenletzten so gross wie fuer den Meister, und er ist gross genug, um spuerbar zu sein.
 *
 * EHRLICHER STAND (2026-08-11): die fuenf Achsen werden bei NEUEN Angeboten nicht mehr vergeben —
 * Gebaeude-Karten tragen seither eines der zwei Leih-Ziele aus `sponsor-leih-ziele.ts`
 * (`leih_frische`, `leih_achsenrang`), fest bepreist und OHNE Sockelabzug. Die Rechenschicht hier
 * (`sponsor-v4-axes.ts`, `SPONSOR_V4_AXIS_*` in `sponsor-v3-model.ts`) bleibt trotzdem vollstaendig
 * erhalten und richtig: Altvertraege, die noch eine Achse eingefroren haben, rechnen unveraendert
 * danach weiter (Invariante 3, `docs/SPONSOREN_BAUVORLAGE.md`), und diese Tests sichern genau das
 * ab — deshalb bauen sie ihre Achsen-Konditionen ab jetzt DIREKT ueber `buildSponsorV3TermsCore` und
 * `buildSponsorV4AxisTerms`, statt sie (nicht mehr vorhandenen) neuen Angeboten zu entnehmen. Was
 * jeder Test behauptet, ist unveraendert dasselbe — nur die Herkunft der Konditionen hat sich
 * geaendert.
 */
describe("Sponsor-Achsen: der Hebel gehoert allen gleich", () => {
  it("zahlt fuer denselben Erfuellungsgrad denselben Betrag — egal ob Rang 1 oder Rang 32", () => {
    // Direkt gebaut statt ueber `buildSponsorOffersForTeam` bezogen (siehe Erklaerung oben) — sonst
    // dasselbe Vorgehen: fuer jede Rarity Spitze (Startrang 1) gegen Keller (Startrang 32) vergleichen.
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;

    let verglichen = 0;
    for (const rarity of Object.keys(SPONSOR_V4_AXIS_SIZE_BY_RARITY) as SponsorV3Rarity[]) {
      const spitze = bauteAchsenKarte({ gameState, teamId, startRank: 1, rarity });
      const keller = bauteAchsenKarte({ gameState, teamId, startRank: 32, rarity });
      verglichen += 1;
      // Der Achsenbetrag haengt NUR an der Rarity, nie am Rang. Bei gleicher Rarity ist er identisch —
      // das ist der ganze Mechanismus hinter "jedes Team hat Chancen".
      expect(spitze.terms.goalSize, `Rarity ${rarity}: Spitze und Keller muessen denselben Hebel tragen`)
        .toBe(keller.terms.goalSize);
    }
    expect(verglichen, "keine Rarity geprueft").toBeGreaterThan(0);
  });

  it("ist EV-neutral bepreist — voll erfuellt und voll verfehlt liegen symmetrisch um die Leiter", () => {
    const gameState = baseState();
    const teamId = gameState.teams[3]!.teamId;
    const { terms } = bauteAchsenKarte({ gameState, teamId, startRank: 10, rarity: "magisch" });

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

/**
 * NEU (2026-08-11): NEU ERZEUGTE Angebote tragen keine Achse mehr — das ist der eigentliche
 * Umbau, den dieser Testlauf festnagelt. Anders als die Bloecke oben (die die Rechenschicht direkt
 * pruefen) geht dieser Test bewusst ueber `buildSponsorOffersForTeam`: er behauptet nicht, dass die
 * Achsen-Rechnung nicht mehr FUNKTIONIEREN KANN, sondern dass sie am Live-Pfad nicht mehr LAEUFT.
 */
/**
 * AM SCHALTER, NICHT AM IST-ZUSTAND — und der Zusammenhang ist hier nicht offensichtlich, deshalb
 * ausgeschrieben: die Achse verschwindet nicht von sich aus, sondern weil das LEIH-ZIEL ihren Platz
 * einnimmt. `buildSponsorOffer` setzt sie nur, wenn die Karte kein Leih-Ziel traegt
 * (`if (input.axisKey && !input.leihZiel)`). Steht `SPONSOR_GEBAEUDE_LEIHE_AKTIV` auf AUS, hat
 * keine Karte mehr ein Leih-Ziel — und damit ist die Achse zurueck, genau die, deren Abwesenheit
 * dieser Block misst. Nicht der Umbau ist zurueckgenommen, es fehlt sein Ausloeser.
 *
 * Die Zusage bleibt unveraendert stehen und greift wieder, sobald die Leihe an ist.
 */
describe.skipIf(!SPONSOR_GEBAEUDE_LEIHE_AKTIV)("Sponsor-Achsen: neu erzeugte Angebote tragen keine Achse mehr", () => {
  it("keine Karte eines neuen Slates traegt `axis` — Gebaeude-Karten tragen stattdessen ein Leih-Ziel", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    expect(offers.length).toBeGreaterThan(0);

    let gebaeudeKarten = 0;
    for (const offer of offers) {
      const terms = getSponsorV3Terms(offer)!;
      expect(terms.axis, `Angebot ${offer.offerId} traegt noch eine Achse`).toBeUndefined();

      const leihe = offer.sponsorLeihe;
      if (!leihe) continue; // die reine Cash-Karte (Platz 0) traegt bewusst kein Gebaeude.
      gebaeudeKarten += 1;
      expect([LEIH_ZIEL_FRISCHE, LEIH_ZIEL_ACHSENRANG], `Angebot ${offer.offerId}`).toContain(terms.goalKey);
      expect(terms.goalP, `Angebot ${offer.offerId}: kein Sockelabzug auf dem Leih-Ziel`).toBe(0);
    }
    // Ohne diese Zusicherung waere der Test gruen, auch wenn zufaellig keine Gebaeude-Karte im Slate
    // laege — er haette dann die zweite Haelfte seiner Aussage nie geprueft.
    expect(gebaeudeKarten, "keine Gebaeude-Karte im Slate gefunden").toBeGreaterThan(0);
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
    const { terms, component } = bauteAchsenKarte({ gameState, teamId, startRank: 5, rarity: "selten" });

    // Der Evaluator (Settlement-Pfad) und die Achsen-Messung (Anzeige-Pfad) muessen uebereinstimmen —
    // beide lesen dieselben, im `targetValue` eingefrorenen Konditionen.
    const viaEvaluator = evaluateSpecialComponentStage(gameState, teamId, component);
    const viaAxis = evaluateSponsorV4Axis(gameState, teamId, terms.axis!);
    expect(viaEvaluator.fraction).toBeCloseTo(viaAxis.fraction, 9);

    // Und die Settlement-Zeilen addieren sich per Teleskopsumme exakt auf die Auszahlung.
    // Die Zerlegung ist VOR der Rundung exakt (Teleskopsumme echter Modellwerte). Jede der bis zu
    // vier Zeilen wird auf 0,1 C gerundet, also bleiben bis zu 0,2 C Rundungsrest — alles darueber
    // waere ein echter Bruch zwischen Anzeige und Settlement.
    const parts = sponsorV3SettlementParts({ terms, finalRank: 12, goalFraction: 0.5 });
    const sum = parts.reduce((acc, part) => acc + part.cashDelta, 0);
    expect(Math.abs(sum - sponsorV3Settle(terms, 12, 0.5))).toBeLessThanOrEqual(0.2);
  });

  it("traegt die Konditionen im Vertrag, nicht in einer Tabelle nebenan", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const { terms, component } = bauteAchsenKarte({ gameState, teamId, startRank: 5, rarity: "gewöhnlich" });

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

describe("Sponsor-Achsen: das Unterschreiben erfuellt die Soliditaets-Achse nicht selbst", () => {
  it("bleibt beim Unterschreiben unveraendert — es flieszt kein Geld mehr", () => {
    // DER EXPLOIT, DEN DAS ABDECKT: die Soliditaets-Achse misst `Kasse − Schulden` gegen die vor
    // der Unterschrift eingefrorene Ausgangslage. Solange es Vorschuesse gab, hob das blosse
    // UNTERSCHREIBEN die Kasse und damit die Achse — gemessen 5,2 C fuer 0,7 C Gebuehr, risikofrei.
    // Der Vorschuss ist entfernt, also ist die Unterschrift jetzt strukturell neutral: kein Geld,
    // keine Schuld, keine Bewegung auf der Achse. Geprueft ueber den ECHTEN Unterschriftspfad,
    // nicht ueber einen nachgebauten Zustand — nur so faellt auf, wenn dort je wieder Geld flieszt.
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const terms = buildSponsorV4AxisTerms(gameState, teamId, "soliditaet");
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const stateWithOffers: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
      } as GameState["seasonState"],
    };

    const vorher = evaluateSponsorV4Axis(gameState, teamId, terms).fraction;
    for (const offer of offers) {
      const signed = chooseSponsorOffer({ gameState: stateWithOffers, teamId, offerId: offer.offerId }).gameState;
      const nachher = evaluateSponsorV4Axis(signed, teamId, terms).fraction;
      expect(nachher, `${offer.offerId}: Unterschrift hat die Achse bewegt`).toBeCloseTo(vorher, 9);
    }
  });

  it("ein ALTVERTRAG mit advance-Feld gilt nicht mehr als Verbindlichkeit", () => {
    // Frueher zog `netFinancialPosition` Betrag + Gebuehr eines Vorschussvertrags ab. Da der Betrag
    // nicht mehr zurueckgefordert wird, waere dieser Abzug eine Schuld ohne Glaeubiger — der
    // Altvertrag darf die Achse also nicht mehr druecken.
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const terms = buildSponsorV4AxisTerms(gameState, teamId, "soliditaet");
    const mitAltfeld: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorContractsByTeamId: {
          ...(gameState.seasonState.sponsorContractsByTeamId ?? {}),
          [teamId]: { sponsorV3: { advance: { amount: 16, fee: 0.8 } } },
        },
      } as GameState["seasonState"],
    };
    expect(evaluateSponsorV4Axis(mitAltfeld, teamId, terms).fraction).toBeCloseTo(
      evaluateSponsorV4Axis(gameState, teamId, terms).fraction, 9,
    );
  });
});

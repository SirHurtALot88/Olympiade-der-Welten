import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { FACILITY_CATALOG_BY_ID } from "@/lib/facilities/facility-catalog";
import {
  buildAnalyticsBoardGoalsLive,
  buildAnalyticsSponsorAxisLive,
  getAnalyticsLiveUnlock,
  sponsorSettlementGoalFraction,
} from "@/lib/facilities/analytics-live-progress";
import { getTeamObjectives } from "@/lib/board/team-season-objectives-service";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getSponsorV3Terms, sponsorV3SettlementParts } from "@/lib/sponsor/sponsor-v3-offer-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  buildSponsorV4AxisTerms, sponsorV4AxisSpecialKey, type SponsorV4AxisKey,
} from "@/lib/sponsor/sponsor-v4-axes";

/**
 * DER ANALYTICS ROOM HATTE KEINEN ZAHLENEFFEKT. Er gab ein Label zurueck, das an zwei Stellen als
 * Text gelesen wurde; real war an ihm nur die Team-Power auf Stufe 2 und die auf Stufe 4. Stufe 1, 3
 * und 5 waren reine Kosten. Gemeldet als: „analytic muss was anderes machen sonst bringt das gebäude
 * nix und kann raus."
 *
 * Was er jetzt tut, ist der LIVE-FORTSCHRITT: die Sponsor-Achse und die Board-Ziele werden bereits
 * waehrend der Saison lesbar, statt erst in der Abrechnung. Diese Datei prueft die vier Zusagen, an
 * denen das Feature haengt — nicht einzelne Zeilen:
 *
 *   1. Ohne das Gebaeude gibt es keinen Live-Fortschritt.
 *   2. Jede der fuenf Stufen schaltet etwas frei, das die vorige nicht hatte.
 *   3. Der angezeigte Zwischenstand ist DIESELBE Zahl, mit der das Settlement spaeter bezahlt.
 *   4. Eine Achse ohne belastbare Messgrundlage wird als solche ausgewiesen — nicht als 0 % Erfuellung.
 *
 * Nummer 3 ist die wichtigste: eine Anzeige, die etwas anderes sagt als die Abrechnung, ist schlimmer
 * als gar keine Anzeige.
 */

/**
 * EINMAL AUFBAUEN, VIELFACH LESEN. Ein frischer Spielstand kostet rund 1,5 s, das Signieren noch
 * einmal so viel — bei 14 Tests waeren das ueber 40 s, und unter paralleler Last laufen die Tests
 * dann in den 5-s-Timeout. Alle Funktionen hier sind rein: sie lesen den Zustand und geben neue
 * Objekte zurueck, keine mutiert den geteilten Stand (der Test „aendert am Spielstand nichts"
 * belegt genau das). Deshalb ist Teilen unbedenklich.
 */
let basisCache: GameState | null = null;
const baseState = () => (basisCache ??= createSingleplayerGameState());

const vertragCache = new Map<string, GameState>();

/**
 * Derselbe Spielstand, nur als Saison 2 etikettiert. Die Saisonnummer wird aus `season.id`/`season.name`
 * gelesen, und einige Board-Ziele haengen daran (der Transferausgaben-Deckel z. B. gilt erst ab S2, weil
 * in der Draft-Saison der komplette Kader eingekauft wird). Der Sponsorvertrag wird danach unterschrieben,
 * traegt also dieselbe Saison-ID.
 */
let saisonZweiCache: GameState | null = null;
const seasonTwoState = () =>
  (saisonZweiCache ??= {
    ...baseState(),
    season: { ...baseState().season, id: "season-2", name: "Season 2" },
    seasonState: { ...baseState().seasonState, seasonId: "season-2" },
  });

function withAnalyticsLevel(gameState: GameState, teamId: string, level: number): GameState {
  const existing = gameState.seasonState.teamFacilities?.[teamId]?.facilities ?? {};
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamFacilities: {
        ...(gameState.seasonState.teamFacilities ?? {}),
        [teamId]: {
          facilities: {
            ...existing,
            analytics_room: { level, enabled: level > 0, conditionPct: 100 },
          },
        },
      },
    },
  } as GameState;
}

function withCash(gameState: GameState, teamId: string, delta: number): GameState {
  return {
    ...gameState,
    teams: gameState.teams.map((team) =>
      team.teamId === teamId ? { ...team, cash: (team.cash ?? 0) + delta } : team,
    ),
  };
}

/** Unterschreibt ueber den echten Signierpfad ein Angebot, das eine V4-Achse traegt. */
function signAxisContract(gameState: GameState, teamId: string): GameState {
  // Saison-ID im Schluessel: derselbe Team-Slot wird auch fuer den Saison-2-Stand signiert, und ein
  // Vertrag der falschen Saison wuerde von `isActiveSponsorContract` verworfen.
  const cacheKey = `sign:${gameState.season.id}:${teamId}`;
  const gecacht = vertragCache.get(cacheKey);
  if (gecacht) return gecacht;
  const offers = buildSponsorOffersForTeam({ gameState, teamId });
  const withOffers: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: {
        ...(gameState.seasonState.sponsorOffersByTeamId ?? {}),
        [teamId]: offers,
      },
    },
  };
  const offer = offers.find((entry) => getSponsorV3Terms(entry)?.axis != null);
  expect(offer, "Slate enthaelt keine Achsenkarte — der Test haette nichts geprueft").toBeDefined();
  const result = chooseSponsorOffer({ gameState: withOffers, teamId, offerId: offer!.offerId });
  expect(result.contract, result.error ?? "kein Vertrag").not.toBeNull();
  vertragCache.set(cacheKey, result.gameState);
  return result.gameState;
}

/**
 * Setzt die Achse eines bereits unterschriebenen Vertrags auf eine bestimmte um — inklusive der im
 * `targetValue` eingefrorenen Konditionen, also genau der Felder, die Anzeige UND Settlement lesen.
 * Noetig, weil das Slate zufaellig zieht und die interessanten Faelle (`entwicklung`, `wachstum`)
 * sonst nicht zuverlaessig im Angebot liegen.
 */
function retargetAxis(gameState: GameState, teamId: string, key: SponsorV4AxisKey): GameState {
  const gecacht = vertragCache.get(`axis:${teamId}:${key}`);
  if (gecacht) return gecacht;
  const contract = gameState.seasonState.sponsorContractsByTeamId?.[teamId];
  expect(contract, "kein Vertrag zum Umschreiben").toBeDefined();
  const terms = buildSponsorV4AxisTerms(gameState, teamId, key);
  const next = {
    ...contract!,
    components: contract!.components.map((component) =>
      component.kind === "special"
        ? {
            ...component,
            specialKey: sponsorV4AxisSpecialKey(key),
            targetValue: `axisbase:${terms.baseline};axisscale:${terms.scale};axisoffset:${terms.offset}`,
          }
        : component,
    ),
    sponsorV3: contract!.sponsorV3 ? { ...contract!.sponsorV3, axis: { ...terms } } : contract!.sponsorV3,
  };
  const umgeschrieben = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorContractsByTeamId: {
        ...(gameState.seasonState.sponsorContractsByTeamId ?? {}),
        [teamId]: next,
      },
    },
  } as GameState;
  vertragCache.set(`axis:${teamId}:${key}`, umgeschrieben);
  return umgeschrieben;
}

/**
 * Ein Entwicklungs-Ereignis, wie es die Saisonend-Progression schreibt.
 *
 * Die Zaehlung laeuft ueber ATTRIBUTPUNKTE (`lib/progression/spieler-entwicklung-zaehler.ts`),
 * nicht ueber den Marktwert: `progressionSnapshotBefore.marketValue` ist in allen 1017 Ereignissen
 * der Live-Spielstaende 0, die alte Marktwert-Differenz war deshalb der absolute Marktwert und kein
 * Zuwachs. Hier steht darum ein echter Attributzuwachs von +3 (ueber der Schwelle von 2).
 */
function jumpEvent(gameState: GameState, teamId: string, index: number) {
  return {
    eventId: `analytics-live-jump-${index}`,
    seasonId: gameState.season.id,
    teamId,
    playerId: `analytics-live-player-${index}`,
    upgrades: [],
    xpSpent: 0,
    progressionSnapshotBefore: {
      attributes: { strength: 40, speed: 30 }, disciplineRatings: {}, ovr: null, mvs: null, marketValue: 10, salary: null, bracket: null,
    },
    progressionSnapshotAfter: {
      attributes: { strength: 42, speed: 31 }, disciplineRatings: {}, ovr: null, mvs: null, marketValue: 20, salary: null, bracket: null,
      marketValuePreview: null, salaryPreview: null, bracketPreview: null,
    },
    timestamp: new Date().toISOString(),
    source: "organic_season_progression" as const,
  };
}

describe("Analytics Room: ohne das Gebaeude gibt es keinen Live-Fortschritt", () => {
  it("liefert bei Stufe 0 weder Achsen-Zwischenstand noch Board-Zahlen", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = signAxisContract(gameState, teamId);

    // Kein Gebaeude gebaut: die Achse waere rechenbar, wird aber nicht gezeigt.
    expect(getAnalyticsLiveUnlock(signiert, teamId)).toEqual({ level: 0, sponsor: "none", board: "none" });
    expect(buildAnalyticsSponsorAxisLive(signiert, teamId)).toBeNull();
    expect(buildAnalyticsBoardGoalsLive(signiert, teamId)).toEqual([]);

    // Gegenprobe: die Rechnung dahinter existiert sehr wohl — es fehlt nur die Freischaltung.
    expect(sponsorSettlementGoalFraction(signiert, teamId)).not.toBeNull();
  });

  it("zeigt auch bei gebautem, aber abgeschaltetem Raum nichts", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = signAxisContract(gameState, teamId);
    const abgeschaltet: GameState = {
      ...signiert,
      seasonState: {
        ...signiert.seasonState,
        teamFacilities: {
          ...(signiert.seasonState.teamFacilities ?? {}),
          [teamId]: { facilities: { analytics_room: { level: 5, enabled: false, conditionPct: 100 } } },
        },
      },
    } as GameState;

    expect(buildAnalyticsSponsorAxisLive(abgeschaltet, teamId)).toBeNull();
    expect(buildAnalyticsBoardGoalsLive(abgeschaltet, teamId)).toEqual([]);
  });

  it("aendert am Spielstand nichts — reine Anzeige, keine gespeicherten Werte", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = withAnalyticsLevel(signAxisContract(gameState, teamId), teamId, 5);
    const vorher = JSON.stringify(signiert);

    buildAnalyticsSponsorAxisLive(signiert, teamId);
    buildAnalyticsBoardGoalsLive(signiert, teamId);
    getAnalyticsLiveUnlock(signiert, teamId);

    expect(JSON.stringify(signiert)).toBe(vorher);
  });
});

describe("Analytics Room: jede Stufe schaltet etwas frei, das die vorige nicht hatte", () => {
  it("liefert fuer jede der sechs Stufen ein anderes Ergebnis — keine tote Stufe", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    // Soliditaet ist zu jedem Zeitpunkt messbar und haengt NICHT an Gebaeudestufen — damit misst
    // dieser Test die Freischaltung und nicht einen Nebeneffekt der Analytics-Stufe auf die Achse.
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "soliditaet");
    const mitZuwachs = withCash(signiert, teamId, 44.7);

    const fingerabdruecke = [0, 1, 2, 3, 4, 5].map((level) => {
      const state = withAnalyticsLevel(mitZuwachs, teamId, level);
      return JSON.stringify({
        sponsor: buildAnalyticsSponsorAxisLive(state, teamId),
        board: buildAnalyticsBoardGoalsLive(state, teamId),
      });
    });

    // DAS WAR DIE BESCHWERDE: Stufe 1, 3 und 5 waren wirkungslos. Keine zwei Stufen duerfen dasselbe
    // liefern — sonst ist mindestens eine wieder reine Kosten.
    expect(new Set(fingerabdruecke).size, "mindestens zwei Stufen liefern dasselbe").toBe(6);
  });

  it("gibt auf jeder Stufe genau die Detailtiefe frei, die der Katalog verspricht", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "soliditaet");
    const mitZuwachs = withCash(signiert, teamId, 44.7);
    const achse = (level: number) => buildAnalyticsSponsorAxisLive(withAnalyticsLevel(mitZuwachs, teamId, level), teamId);
    const board = (level: number) => buildAnalyticsBoardGoalsLive(withAnalyticsLevel(mitZuwachs, teamId, level), teamId);

    // Stufe 1: grobe Einordnung, aber noch keine Zahl.
    const s1 = achse(1)!;
    expect(s1.band).not.toBeNull();
    expect(s1.erfuellungPct).toBeNull();
    expect(s1.stand).toBeNull();

    // Stufe 2: der exakte Erfuellungsgrad kommt dazu.
    const s2 = achse(2)!;
    expect(s2.erfuellungPct).not.toBeNull();
    expect(s2.stand).toBeNull();

    // Stufe 3: Ist-/Zielwert samt Restbedarf in der Einheit der Achse.
    const s3 = achse(3)!;
    expect(s3.stand).not.toBeNull();
    expect(s3.ziel).not.toBeNull();
    expect(s3.rest).not.toBeNull();
    expect(s3.einheit).toBe("C");

    // Board-Ziele bleiben bis einschliesslich Stufe 3 zu.
    for (const level of [0, 1, 2, 3]) {
      expect(board(level), `Stufe ${level} darf keine Board-Zahlen zeigen`).toEqual([]);
    }

    // Stufe 4: Board-Zwischenstand, aber noch kein Abstand.
    const b4 = board(4);
    expect(b4.length).toBeGreaterThan(0);
    expect(b4.every((entry) => entry.abstand === null)).toBe(true);
    expect(b4.some((entry) => entry.stand !== null)).toBe(true);

    // Stufe 5: der Abstand zum Ziel kommt dazu.
    const b5 = board(5);
    expect(b5.some((entry) => entry.abstand !== null), "Stufe 5 muss mindestens einen Abstand liefern").toBe(true);
  });
});

describe("Analytics Room: die Anzeige ist dieselbe Rechnung wie die Abrechnung", () => {
  /**
   * DIE WICHTIGSTE ZUSICHERUNG. Der angezeigte Zwischenstand muss ueber JEDEN Zustand hinweg mit
   * dem uebereinstimmen, was das Settlement daraus bezahlen wuerde. Deshalb wird nicht ein Zustand
   * geprueft, sondern eine Reihe — vom vollen Rueckstand bis ueber die volle Erfuellung hinaus.
   */
  it("meldet ueber die ganze Bandbreite denselben Erfuellungsgrad wie der Settlement-Pfad", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "soliditaet");

    let teilerfuellungGesehen = false;
    for (const delta of [-40, 0, 20, 44.7, 80, 109, 200]) {
      const state = withAnalyticsLevel(withCash(signiert, teamId, delta), teamId, 5);
      const live = buildAnalyticsSponsorAxisLive(state, teamId)!;
      const settlement = sponsorSettlementGoalFraction(state, teamId)!;

      expect(live.belastbar, `delta ${delta}`).toBe(true);
      expect(live.erfuellungPct, `delta ${delta}`).toBe(Math.round(settlement * 100));
      if (live.erfuellungPct! > 0 && live.erfuellungPct! < 100) teilerfuellungGesehen = true;
    }
    // Ohne echte Teilerfuellung waere der Vergleich trivial (0 gegen 0 oder 100 gegen 100).
    expect(teilerfuellungGesehen, "keine Teilerfuellung getroffen — der Test hat nichts verglichen").toBe(true);
  });

  it("fuehrt zum selben Sonderziel-Betrag wie die echte Saisonend-Abrechnung", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "soliditaet");
    const state = withAnalyticsLevel(withCash(signiert, teamId, 44.7), teamId, 5);

    const live = buildAnalyticsSponsorAxisLive(state, teamId)!;
    const contract = state.seasonState.sponsorContractsByTeamId![teamId]!;
    const terms = getSponsorV3Terms(contract)!;
    const finalRank = buildTeamSeasonOverviewRows({ gameState: state }).find((row) => row.teamId === teamId)?.rank ?? null;

    // Was das Settlement wirklich auszahlt …
    const echteZeile = previewSponsorSettlement(state).rows.find(
      (row) => row.teamId === teamId && row.kind === "special",
    );
    expect(echteZeile, "Settlement hat keine Sonderziel-Zeile gebaut").toBeDefined();

    // … gegen das, was der Spieler aus der Anzeige ableiten wuerde.
    const ausAnzeige = sponsorV3SettlementParts({
      terms, finalRank, goalFraction: live.erfuellungPct! / 100,
    }).find((part) => part.key === "special")!;

    // Der Erfuellungsgrad wird auf volle Prozent gerundet angezeigt; mehr als ein halbes Prozent des
    // Zielhebels (plus 0,1 C Zeilenrundung) darf zwischen Anzeige und Auszahlung nicht liegen.
    const toleranz = terms.goalSize * 0.005 + 0.1;
    expect(Math.abs(ausAnzeige.cashDelta - echteZeile!.cashDelta)).toBeLessThanOrEqual(toleranz);
  });

  it("zeigt als Ist-Wert genau die Rohmetrik, die der Settlement-Evaluator meldet", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "soliditaet");
    const state = withAnalyticsLevel(withCash(signiert, teamId, 44.7), teamId, 5);

    const live = buildAnalyticsSponsorAxisLive(state, teamId)!;
    // Restbedarf ist definitionsgemaess die Luecke zwischen Ist und Ziel — nie negativ, nie erfunden.
    expect(live.rest).toBeCloseTo(Math.max(0, live.ziel! - live.stand!), 6);
    expect(live.rest).toBeGreaterThanOrEqual(0);
  });
});

describe("Analytics Room: eine Achse ohne belastbare Zahl wird als solche ausgewiesen", () => {
  it("meldet bei `entwicklung` waehrend der Saison 'keine belastbare Zahl' statt 0 % Erfuellung", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "entwicklung");
    const state = withAnalyticsLevel(signiert, teamId, 5);

    // GENAU DER FALL, DEN DIE ANZEIGE NICHT ALS SPIELERFEHLER DARSTELLEN DARF: die
    // Entwicklungs-Ereignisse werden erst in der Saisonabrechnung gebucht, die Rohmetrik steht bis
    // dahin zwingend auf 0.
    expect(sponsorSettlementGoalFraction(state, teamId)).toBe(0);

    const live = buildAnalyticsSponsorAxisLive(state, teamId)!;
    expect(live.belastbar).toBe(false);
    expect(live.grund).toBe("entwicklung_erst_zur_abrechnung");
    expect(live.erfuellungPct).toBeNull();
    expect(live.band).toBeNull();
    expect(live.stand).toBeNull();
    expect(live.text).toContain("keine belastbare Zahl");
    expect(live.text).not.toContain("0 %");
  });

  it("zeigt dieselbe Achse mit gebuchten Spruengen wieder als Zahl", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "entwicklung");
    const mitSpruengen: GameState = {
      ...signiert,
      playerProgressionEvents: Array.from({ length: 10 }, (_, index) => jumpEvent(signiert, teamId, index)),
    };
    const live = buildAnalyticsSponsorAxisLive(withAnalyticsLevel(mitSpruengen, teamId, 5), teamId)!;

    expect(live.belastbar).toBe(true);
    expect(live.erfuellungPct).toBe(Math.round(sponsorSettlementGoalFraction(withAnalyticsLevel(mitSpruengen, teamId, 5), teamId)! * 100));
    expect(live.stand).toBe(10);
  });

  it("meldet bei `wachstum` in Saison 1 den Methodenwechsel statt eines Minus-Zwischenstands", () => {
    const gameState = baseState();
    expect(gameState.season.id).toBe("season-1");
    const teamId = gameState.teams[0]!.teamId;
    const signiert = retargetAxis(signAxisContract(gameState, teamId), teamId, "wachstum");
    const live = buildAnalyticsSponsorAxisLive(withAnalyticsLevel(signiert, teamId, 5), teamId)!;

    expect(live.belastbar).toBe(false);
    expect(live.grund).toBe("wachstum_methodenwechsel_s1");
    expect(live.erfuellungPct).toBeNull();
    expect(live.text).toContain("keine belastbare Zahl");
  });

  it("meldet ein Board-Ziel ohne Zahlenskala als solches, statt einen Abstand zu erfinden", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const state = withAnalyticsLevel(signAxisContract(gameState, teamId), teamId, 5);
    const board = buildAnalyticsBoardGoalsLive(state, teamId);

    expect(board.length).toBeGreaterThan(0);
    // Der Vorstand stellt gemischte Ziele: „Top 27" und „3+ Farben" haben keine Zahlenskala,
    // „Transferbilanz 26,3" hat eine. Ohne beide Sorten haette dieser Test nichts geprueft.
    expect(board.some((entry) => entry.abstandBelastbar), "kein Ziel mit Zahlenskala im Slate").toBe(true);
    expect(board.some((entry) => !entry.abstandBelastbar), "kein Ziel ohne Zahlenskala im Slate").toBe(true);

    // Wo kein Zahlenpaar vorliegt, steht auch kein Abstand — und die Zeile sagt das.
    for (const entry of board) {
      if (!entry.abstandBelastbar) {
        expect(entry.abstand).toBeNull();
        expect(entry.text).toContain("nur Status");
      }
    }
  });

  /**
   * WARUM BEI DEN BOARD-ZIELEN KEINE ERFUELLUNGSQUOTE STEHT: die Records tragen die Richtung des
   * Ziels nicht mit. Im Slate liegen gleichzeitig Ziele, bei denen ein hoeherer Wert besser ist, und
   * solche, bei denen ein niedrigerer besser ist — eine aus dem Zahlenpaar geratene Quote waere bei
   * einem Teil davon verkehrt herum. Der Abstand ist richtungsfrei und stimmt immer.
   */
  it("behauptet nie eine Richtung: ein Ziel kann den Zielwert ueberschreiten und trotzdem verfehlt sein", () => {
    // SAISON 2, nicht 1: Das gegenlaeufige Ziel im Slate ist der Transferausgaben-Deckel („Ist ueber
    // Ziel und trotzdem verfehlt"). In der Draft-Saison steht er nicht mehr — dort kauft jedes Team
    // seinen kompletten Kader ein, ein Ausgabendeckel waere per Konstruktion unerfuellbar, und an
    // seiner Stelle steht die gleichlaeufige Cash-Reserve. Ab S2 ist der Deckel wieder da.
    const gameState = seasonTwoState();
    const teamId = gameState.teams[0]!.teamId;
    const state = withAnalyticsLevel(signAxisContract(gameState, teamId), teamId, 5);
    const board = buildAnalyticsBoardGoalsLive(state, teamId);
    const byId = new Map(board.map((entry) => [entry.objectiveId, entry] as const));

    // Rohwerte aus den Records lesen, nicht aus der formatierten Zeile — gesucht sind Ziele, bei
    // denen der Ist-Wert UEBER dem Zielwert liegt und die trotzdem nicht erfuellt sind. Bei ihnen
    // waere jede aus dem Zahlenpaar geratene Quote "ueber 100 % erfuellt" — und damit falsch herum.
    const gegenlaeufig = getTeamObjectives(state, teamId).filter(
      (objective) =>
        typeof objective.targetValue === "number" &&
        typeof objective.currentValue === "number" &&
        objective.status !== "completed" &&
        objective.currentValue > objective.targetValue,
    );
    expect(gegenlaeufig.length, "kein gegenlaeufiges Ziel im Slate — der Test hat nichts geprueft").toBeGreaterThan(0);

    for (const objective of gegenlaeufig) {
      const entry = byId.get(objective.objectiveId)!;
      // Kein "erfuellt", kein Prozentwert, nur der nackte Abstand — genau so, wie es stimmt.
      expect(entry.abstand).toBeGreaterThan(0);
      expect(entry.text).toContain("Abstand");
      expect(entry.text).not.toContain("%");
    }
  });
});

describe("Analytics Room: der Katalog bewirbt genau das, was die Stufe freischaltet", () => {
  /**
   * DER AUSLOESER DES GANZEN BERICHTS war ein Gebaeude, das etwas anderes versprach als es tat: der
   * Katalog bewarb eine „Forecast Quality", die nirgends gemessen wurde. Diese Regel haelt Werbung
   * und Wirkung aneinander — wer die Leiter verschiebt, muss den Text mitziehen.
   */
  it("nennt in jedem Stufentext das Subjekt, dessen Detailtiefe diese Stufe erhoeht", () => {
    const gameState = baseState();
    const teamId = gameState.teams[0]!.teamId;
    const levels = FACILITY_CATALOG_BY_ID.analytics_room.levels;
    expect(levels).toHaveLength(5);

    for (const definition of levels) {
      const jetzt = getAnalyticsLiveUnlock(withAnalyticsLevel(gameState, teamId, definition.level), teamId);
      const vorher = getAnalyticsLiveUnlock(withAnalyticsLevel(gameState, teamId, definition.level - 1), teamId);
      const text = definition.effectDescription;

      const sponsorNeu = jetzt.sponsor !== vorher.sponsor;
      const boardNeu = jetzt.board !== vorher.board;
      expect(sponsorNeu || boardNeu, `Stufe ${definition.level} schaltet nichts frei`).toBe(true);
      if (sponsorNeu) expect(text, `Stufe ${definition.level}`).toContain("Sponsor");
      if (boardNeu) expect(text, `Stufe ${definition.level}`).toContain("Board");
    }

    // Und der Gebaeude-Effektname darf nicht laenger eine Groesse behaupten, die es nicht gibt.
    expect(FACILITY_CATALOG_BY_ID.analytics_room.effectDescription).not.toContain("Forecast");
  });
});

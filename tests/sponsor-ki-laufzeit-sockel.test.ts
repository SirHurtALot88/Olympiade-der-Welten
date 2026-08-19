/**
 * DIE KI MUSS MIT DEM SOCKEL RECHNEN, DEN DIE KARTE WIRKLICH HAT.
 *
 * BEFUND (Live-Abbild vom 11.08.2026, 160 Angebote des aktiven Saves): der Laufzeit-Term in
 * `scoreOfferForAi` nahm `sponsorSockelFuerStartrang(terms.startRank)` — den NACKTEN Liga-Sockel,
 * ohne Raritaets-Wertfaktor und ohne Gebaeude-Verzicht — und zog ihn von `terms.anchor` ab, der
 * beides enthaelt. Ø 9,76 C zu hoch, groesste Abweichung 30,2 C (gewoehnliche Gebaeude-Karte,
 * Verzicht 25,4 bei Startrang 23: gerechnet 43,2, echt 13,1).
 *
 * WAS DER SPIELER DAVON MERKT: der Wertungsanteil `anchor − sockel` ist die Groesse, die ueber die
 * Restlaufzeit erodiert. Zu klein gerechnet heisst: die KI unterschaetzt den Erosionsverlust eines
 * Mehrjahresvertrags und ueberschaetzt zugleich seinen Versicherungswert — sie unterschreibt zu oft
 * lange Vertraege, und zwar am staerksten bei den Gebaeude-Karten mit dem groessten Verzicht.
 * Gemessen ueber 8 unabhaengige Ligen (256 Teams): der Anteil mehrjaehriger Vertraege faellt mit dem
 * richtigen Sockel von 34,4 % auf 30,5 %, 17 der 256 Teams (6,6 %) waehlen eine andere Karte.
 *
 * DIESER TEST PRUEFT WERTE, NICHT QUELLTEXT: er haelt die Groesse, die die KI-Bewertung rechnet,
 * gegen die Erosion, die `rerollSponsorV3TermsForNewSeason` beim Saisonwechsel TATSAECHLICH
 * anwendet. Beide muessen dieselbe Zahl sein — die KI darf einen Vertrag nicht anders bepreisen,
 * als das Spiel ihn spaeter behandelt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { sponsorSockelFuerStartrang } from "@/lib/sponsor/sponsor-liga-leiter";
import { getSponsorTermMultiplier } from "@/lib/sponsor/sponsor-negotiation";
import {
  SPONSOR_ANGEBOTE_JE_TEAM,
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import {
  buildSponsorV3Terms,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
  sponsorV3EingefrorenerSockel,
  sponsorV3WertFaktorFuerKarte,
} from "@/lib/sponsor/sponsor-v3-offer-service";

/**
 * Alle Angebote eines frisch erzeugten Spielstands — 32 Teams x der Slate-Groesse.
 *
 * DIE ERWARTETE MENGE WIRD GERECHNET, NICHT FESTGENAGELT. Vorher stand hier dreimal
 * `toBeGreaterThan(100)`, weil 32 x 5 = 160 Karten anfielen. Seit #512 sind es drei Karten je
 * Team („1 unterschied: nur 3 Sponsoren statt 5"), also 96 — und drei Faelle fielen an der
 * Stichprobengroesse, nicht an ihrer Aussage. Was sie sichern wollen, ist „die GANZE Liga, nicht
 * eine Handvoll": also jedes Team mit mindestens einer Karte.
 */
function alleAngebote(): { gameState: GameState; angebote: SponsorOffer[] } {
  const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
  const angebote = Object.values(gameState.seasonState.sponsorOffersByTeamId ?? {}).flat();
  return { gameState, angebote };
}

/** Untergrenze fuer „die ganze Liga": jedes Team hat Angebote, und es sind wirklich alle Teams. */
function erwarteVolleLiga(gameState: GameState, gezaehlt: number): void {
  const teams = gameState.teams.length;
  const mitAngeboten = Object.entries(gameState.seasonState.sponsorOffersByTeamId ?? {}).filter(
    ([, liste]) => (liste?.length ?? 0) > 0,
  ).length;
  expect(mitAngeboten, "nicht jedes Team hat Angebote").toBe(teams);
  expect(gezaehlt, "weniger geprueft als ein Angebot je Team").toBeGreaterThanOrEqual(teams);
}

describe("KI-Laufzeitbewertung rechnet mit dem Sockel DIESER Karte", () => {
  it("`anchor − Sockel` ist exakt der Anteil, den der Saisonwechsel erodieren laesst", () => {
    const { gameState, angebote } = alleAngebote();
    erwarteVolleLiga(gameState, angebote.length);

    const multiplikatorJahr2 = getSponsorTermMultiplier(2);
    expect(multiplikatorJahr2).toBeLessThan(1);

    let geprueft = 0;
    let groessterFehler = 0;
    for (const angebot of angebote) {
      const terms = getSponsorV3Terms(angebot);
      if (!terms) continue;
      // Was das SPIEL beim Saisonwechsel wirklich tut (Vertragsjahr 2, gleicher Gehaltsfaktor —
      // damit ausschliesslich die Erosion wirkt und nicht die Konjunktur).
      const gerollt = rerollSponsorV3TermsForNewSeason(terms, {
        newSalaryFactor: terms.salaryFactor,
        contractYear: 2,
      });
      const echterVerlust = terms.anchor - gerollt.anchor;
      // Was die KI-Bewertung dafuer ansetzt.
      const gerechneterVerlust =
        (1 - multiplikatorJahr2) * (terms.anchor - sponsorV3EingefrorenerSockel(terms));

      expect(gerechneterVerlust).toBeCloseTo(echterVerlust, 9);
      groessterFehler = Math.max(groessterFehler, Math.abs(gerechneterVerlust - echterVerlust));
      geprueft += 1;
    }
    expect(geprueft).toBe(angebote.length);
    expect(groessterFehler).toBeLessThan(1e-9);
  }, 120_000);

  it("der NACKTE Liga-Sockel verfehlt dieselbe Erosion messbar — deshalb reicht er nicht", () => {
    const { gameState, angebote } = alleAngebote();
    const multiplikatorJahr2 = getSponsorTermMultiplier(2);

    let summeAbweichung = 0;
    let groessteAbweichung = 0;
    let gezaehlt = 0;
    let mitEchterAbweichung = 0;
    for (const angebot of angebote) {
      const terms = getSponsorV3Terms(angebot);
      if (!terms) continue;
      const gerollt = rerollSponsorV3TermsForNewSeason(terms, {
        newSalaryFactor: terms.salaryFactor,
        contractYear: 2,
      });
      const echterVerlust = terms.anchor - gerollt.anchor;
      const mitNacktemSockel =
        (1 - multiplikatorJahr2) * Math.max(0, terms.anchor - sponsorSockelFuerStartrang(terms.startRank));
      const abweichungDesSockels =
        sponsorSockelFuerStartrang(terms.startRank) - sponsorV3EingefrorenerSockel(terms);
      summeAbweichung += Math.abs(abweichungDesSockels);
      groessteAbweichung = Math.max(groessteAbweichung, Math.abs(abweichungDesSockels));
      const trifftDaneben = Math.abs(mitNacktemSockel - echterVerlust) > 1e-6;
      if (trifftDaneben) mitEchterAbweichung += 1;
      /**
       * EXAKT STATT ANTEILIG: der nackte Sockel weicht genau dann ab, wenn die Karte einen
       * EIGENEN Sockel hat — also bei einem Wertfaktor ungleich 1 oder bei einem Cash-Verzicht.
       * Eine magische Karte ohne Verzicht (Wertfaktor 1,0) IST der Liga-Sockel; dort waere eine
       * Abweichung der Fehler.
       */
      const eigenerSockel = Math.abs(abweichungDesSockels) > 1e-6;
      expect(trifftDaneben, `${angebot.offerId}: Abweichung ${abweichungDesSockels}`).toBe(eigenerSockel);
      gezaehlt += 1;
    }

    /**
     * Der nackte Sockel verfehlt die Erosion — das ist die Zusage, und sie haelt.
     *
     * DIE RICHTUNG STIMMT NICHT MEHR: hier stand „liegt IMMER zu hoch (Wertfaktor <= 1)". Der
     * Wertfaktor geht heute ueber 1 hinaus (`SPONSOR_V3_WERT_BY_RARITY`: gewöhnlich 0,89,
     * magisch 1,0, selten 1,05, legendär 1,11) — bei einer seltenen Karte liegt der nackte
     * Sockel also zu NIEDRIG (gemessen −2,48 C bei B-B). Gerechnet wird deshalb mit Betraegen:
     * die Aussage ist „daneben", nicht „darueber".
     *
     * DIE HOEHE DER ABWEICHUNG IST KEINE: sie hat zwei Quellen — den Wertfaktor der Rarität und
     * den Cash-Verzicht der Gebaeude-Karte. Mit abgeschaltetem Gebaeude-Schalter (#512) faellt
     * die zweite weg: die groesste Abweichung sinkt von 30,2 C auf 5,7 C, und der Anteil der
     * betroffenen Karten von 98 % auf 73 % — Karten mit Wertfaktor 1 SIND der Liga-Sockel.
     * Feste Schwellen („> 10", „> 0,9") messen damit den Schalter, nicht den Sockel. Die scharfe
     * Pruefung steht deshalb in der Schleife (Abweichung genau dann, wenn die Karte einen eigenen
     * Sockel hat); hier bleibt, dass es die Abweichung ueberhaupt gibt und dass sie streut.
     */
    erwarteVolleLiga(gameState, gezaehlt);
    const durchschnitt = summeAbweichung / gezaehlt;
    expect(durchschnitt).toBeGreaterThan(1);
    expect(groessteAbweichung).toBeGreaterThan(durchschnitt);
    expect(mitEchterAbweichung).toBeGreaterThan(0);
  }, 120_000);

  it("der Wertfaktor der Karte kommt aus EINER Formel — Unterschrift wie Saisonwechsel", () => {
    const { gameState, angebote } = alleAngebote();
    let geprueft = 0;
    for (const angebot of angebote) {
      const terms = getSponsorV3Terms(angebot);
      if (!terms) continue;
      const wertFaktor = sponsorV3WertFaktorFuerKarte(terms);
      // Der Sockel der Karte ist der skalierte Liga-Sockel abzueglich des Verzichts — dieselbe
      // Rechnung, mit der `buildSponsorV3Terms` das Netz `floor` setzt.
      expect(sponsorV3EingefrorenerSockel(terms)).toBeCloseTo(
        sponsorSockelFuerStartrang(terms.startRank) * wertFaktor - Math.max(0, terms.leihVerzicht ?? 0),
        9,
      );
      // Eine Gebaeude-Karte traegt ihre Raritaet im Kurs, nie zusaetzlich in der Hoehe.
      if ((terms.leihVerzicht ?? 0) > 0) {
        expect(wertFaktor).toBeCloseTo(sponsorV3WertFaktorFuerKarte({ rarity: "gewöhnlich" }), 9);
      }
      geprueft += 1;
    }
    erwarteVolleLiga(gameState, geprueft);
  }, 120_000);

  /**
   * DER VERHALTENSBEWEIS — dass die KI diesen Sockel wirklich benutzt.
   *
   * Die drei Tests oben zeigen, dass die Formel stimmt; sie wuerden aber gruen bleiben, wenn
   * `scoreOfferForAi` weiterhin den nackten Sockel naehme. Deshalb hier ein Slate aus GENAU ZWEI
   * Karten, die sich in NICHTS unterscheiden ausser der Laufzeit (1 gegen 3 Saisons) — damit ist der
   * Laufzeit-Term der einzige Term, der die Wahl entscheiden kann.
   *
   * Die Karte ist so gewaehlt, dass die beiden Sockel das Vorzeichen dieses Terms UMDREHEN
   * (gewoehnliche Gebaeude-Karte, Verzicht 25 C, Startrang 15 — dieselbe Groessenordnung wie die
   * teuerste Karte des echten Saves, Verzicht 25,4):
   *   nackter Sockel 34,7  ⇒  Term +0,6  ⇒  die KI unterschreibt den DREIJAHRESVERTRAG
   *   echter Sockel   5,9  ⇒  Term −6,1  ⇒  die KI unterschreibt den EINJAHRESVERTRAG
   * Der Dreijahresvertrag erodiert diese Karte um rund 7 C — die KI darf ihn nicht fuer den besseren
   * halten.
   */
  it("waehlt bei sonst gleichen Karten den kurzen Vertrag — der Erosionsverlust ist echt", () => {
    const basis = createSingleplayerGameState();
    const teamId = basis.teams.find((team) => team.teamId !== "P-S")?.teamId ?? basis.teams[0]!.teamId;

    const rohling: SponsorOffer = {
      offerId: "laufzeit-probe",
      seasonId: basis.season.id,
      teamId,
      archetype: "performance",
      name: "Laufzeit-Probe",
      flavor: "",
      rarity: "gewöhnlich",
      curveShape: "stetig",
      totalUpsideEstimate: 0,
      components: [
        { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 0, rewardCash: 0 },
        { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 1, rewardCash: 0 },
      ],
    } as unknown as SponsorOffer;

    const terms = buildSponsorV3Terms({
      gameState: basis,
      offer: rohling,
      startRank: 15,
      cardKey: "basis",
      curveShape: "stetig",
      teamId,
      leihVerzicht: 25,
    });
    // Die Voraussetzung des Tests, als Wert gemessen statt behauptet: die beiden Sockel liegen weit
    // genug auseinander, um das Vorzeichen des Laufzeit-Terms zu drehen.
    expect(sponsorSockelFuerStartrang(15) - sponsorV3EingefrorenerSockel(terms)).toBeGreaterThan(25);

    // `ensureSeasonSponsorOffers` ersetzt jedes Slate, das nicht GENAU `SPONSOR_ANGEBOTE_JE_TEAM`
    // Karten mit V3-Konditionen hat — die Groesse kommt deshalb aus der Konstante statt aus einer
    // eingetippten Zahl (hier stand eine 5, waehrend die Konstante laengst 3 war; das fiel nur nicht
    // auf, weil der Vergleich im Produktionscode dieselbe veraltete 5 benutzte). Die
    // Dreijahresvertraege stehen VORNE: waere der Laufzeit-Term falsch (oder gar nicht wirksam),
    // gewaenne einer von ihnen schon durch die Sortier-Reihenfolge. Ein gruener Test heisst also:
    // die Einjahreskarte hat STRIKT besser gepunktet.
    const slate: SponsorOffer[] = [
      ...Array.from({ length: SPONSOR_ANGEBOTE_JE_TEAM - 1 }, (_, index) =>
        ({ ...rohling, offerId: `probe-3-jahre-${index + 1}`, termSeasons: 3, sponsorV3: terms }) as SponsorOffer,
      ),
      { ...rohling, offerId: "probe-1-jahr", termSeasons: 1, sponsorV3: terms } as SponsorOffer,
    ];

    const gameState: GameState = {
      ...basis,
      seasonState: {
        ...basis.seasonState,
        sponsorContractsByTeamId: {},
        sponsorOffersByTeamId: { [teamId]: slate },
      },
    };

    const nachher = chooseSponsorOfferForAiTeams(gameState);
    const vertrag = nachher.seasonState.sponsorContractsByTeamId?.[teamId] ?? null;
    expect(vertrag, "die KI muss unterschreiben — sonst misst dieser Test gar nichts").not.toBeNull();
    expect(vertrag!.offerId).toBe("probe-1-jahr");
    expect(vertrag!.termSeasons ?? 1).toBe(1);
  }, 120_000);
});

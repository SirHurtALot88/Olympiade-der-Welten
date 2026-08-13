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
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildSponsorV3Terms,
  getSponsorV3Terms,
  rerollSponsorV3TermsForNewSeason,
  sponsorV3EingefrorenerSockel,
  sponsorV3WertFaktorFuerKarte,
} from "@/lib/sponsor/sponsor-v3-offer-service";

/** Alle Angebote eines frisch erzeugten Spielstands — 32 Teams x 5 Karten. */
function alleAngebote(): { gameState: GameState; angebote: SponsorOffer[] } {
  const gameState = ensureSeasonSponsorOffers(createSingleplayerGameState());
  const angebote = Object.values(gameState.seasonState.sponsorOffersByTeamId ?? {}).flat();
  return { gameState, angebote };
}

describe("KI-Laufzeitbewertung rechnet mit dem Sockel DIESER Karte", () => {
  it("`anchor − Sockel` ist exakt der Anteil, den der Saisonwechsel erodieren laesst", () => {
    const { angebote } = alleAngebote();
    expect(angebote.length).toBeGreaterThan(100);

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
    const { angebote } = alleAngebote();
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
      summeAbweichung += abweichungDesSockels;
      groessteAbweichung = Math.max(groessteAbweichung, abweichungDesSockels);
      if (Math.abs(mitNacktemSockel - echterVerlust) > 1e-6) mitEchterAbweichung += 1;
      gezaehlt += 1;
    }

    // Der nackte Sockel liegt IMMER zu hoch (Wertfaktor <= 1, Verzicht >= 0) und verfehlt die
    // Erosion bei praktisch jeder Karte. Die Live-Messung ergab Ø 9,76 C / max 30,2 C.
    expect(gezaehlt).toBeGreaterThan(100);
    expect(summeAbweichung / gezaehlt).toBeGreaterThan(1);
    expect(groessteAbweichung).toBeGreaterThan(10);
    expect(mitEchterAbweichung / gezaehlt).toBeGreaterThan(0.9);
  }, 120_000);

  it("der Wertfaktor der Karte kommt aus EINER Formel — Unterschrift wie Saisonwechsel", () => {
    const { angebote } = alleAngebote();
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
    expect(geprueft).toBeGreaterThan(100);
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

    // `ensureSeasonSponsorOffers` ersetzt jedes Slate, das nicht GENAU FUENF Karten mit V3-Konditionen
    // hat — deshalb fuenf. Die vier Dreijahresvertraege stehen VORNE: waere der Laufzeit-Term falsch
    // (oder gar nicht wirksam), gewaenne einer von ihnen schon durch die Sortier-Reihenfolge. Ein
    // gruener Test heisst also: die Einjahreskarte hat STRIKT besser gepunktet.
    const slate: SponsorOffer[] = [
      ...[1, 2, 3, 4].map(
        (nummer) =>
          ({ ...rohling, offerId: `probe-3-jahre-${nummer}`, termSeasons: 3, sponsorV3: terms }) as SponsorOffer,
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

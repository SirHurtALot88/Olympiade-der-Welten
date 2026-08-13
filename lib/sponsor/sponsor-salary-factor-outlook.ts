/**
 * DER GEHALTSFAKTOR AUF DER SPONSORSEITE — laufende Saison plus die kommenden Jahre.
 *
 * GEMELDET VON CHRIS: „und auf der sponsor seite sollte definiiv auch der salary factor von diesem
 * und den nächsten jahren zu finden sein!!!" Sein Punkt trifft genau die Stelle, an der es weh tut:
 * die Angebote tragen Laufzeiten von bis zu drei Saisons (`offer.termSeasons`, gewuerfelt im Slate),
 * und der Gehaltsfaktor der Folgejahre STEHT BEREITS FEST — er liegt als 5er-Fenster im Spielstand
 * (`seasonState.seasonEconomyFactors`). Wer ohne diese Zahlen einen Dreijahresvertrag unterschreibt,
 * unterschreibt blind, obwohl das Spiel die Antwort schon kennt.
 *
 * ── DIE RICHTUNG, NACHGEMESSEN (und andersherum als zuerst vermutet) ─────────────────────────────
 *
 * Ein HOEHERER Gehaltsfaktor bedeutet MEHR Sponsorgeld, nicht weniger. Der Faktor skaliert den
 * Wertungstopf der Liga (`SPONSOR_WERTUNGSTOPF * salaryFactor` in sponsor-liga-leiter.ts) und
 * ebenso den Preisgeldtopf (`meanSalary * n * salaryFactor` in prize-money.ts). Gemessen an
 * DEMSELBEN Vertrag, nur mit getauschtem Faktor (scratchpad-Skript, Spielstand `pc.sqlite`):
 *
 *     Vertrag A-A, Startrang 31:  Faktor 1,00 → Platz1 99,5   Faktor 1,19 → Platz1 108,6
 *     Vertrag H-R, Startrang  9:  Faktor 1,00 → Platz1 99,5   Faktor 1,19 → Platz1 113,0
 *     nackte Ligaleiter, Rang 16: 0,82 → 84,5 · 1,00 → 95,2 · 1,19 → 106,4 · 1,24 → 109,4
 *
 * Die Gegenmessung, die zunaechst das Gegenteil nahelegte (Faktor 1,00 → 10 Vertraege mit Ø 98,1
 * auf Platz 1; Faktor 1,19 → 22 Vertraege mit Ø 81,0), vergleicht nicht Faktoren, sondern zwei
 * LEITER-GENERATIONEN: alle 10 Vertraege der 1,00-Gruppe haben keine `curveShape` und tragen darum
 * noch die alte, groessere Benchmark-Leiter; alle 22 der 1,19-Gruppe haben eine und rechnen nach der
 * neuen, kleineren Ligaleiter. Die Trennung ist 10/0 gegen 0/22 — der Faktor ist dort Mitlaeufer,
 * nicht Ursache. Die Anzeige sagt deshalb „hoeher = mehr Geld".
 *
 * ── WAS DER FAKTOR NICHT TUT ────────────────────────────────────────────────────────────────────
 *
 * Er hebt NICHT die ganze Auszahlung proportional. Der SOCKEL (Absicherung nach Startrang) haengt
 * bewusst nicht am Faktor — nur der Wertungsanteil darueber. Deshalb steht in der Anzeige der
 * Faktor selbst und keine erfundene „+19 % Sponsorgeld"-Zahl: +19 % Faktor waren in der Messung
 * oben +11,8 % auf Platz 1 und +8,2 % auf Platz 32.
 *
 * ── EINE RECHENSTELLE ───────────────────────────────────────────────────────────────────────────
 *
 * Die Zahlen kommen ausschliesslich aus `getSeasonEconomyFactorWindow` — derselben Quelle, aus der
 * Finanzseite (`lib/foundation/finances/salary-factor-outlook.ts`), Season-Briefing und KI lesen.
 * Die Richtungsregel (steigt/faellt/stabil samt Epsilon) wird ebenfalls nicht nachgebaut, sondern
 * aus `deriveSalaryFactorOutlook` uebernommen. Hier entsteht nur die Zuordnung „welche Saison, wie
 * heisst sie, deckt der Vertrag sie noch ab".
 */
import type { SeasonState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import {
  deriveSalaryFactorOutlook,
  type SalaryFactorDirection,
} from "@/lib/foundation/finances/salary-factor-outlook";
import {
  SEASON_ECONOMY_FACTOR_WINDOW_SIZE,
  getSeasonEconomyFactorWindow,
  parseSeasonNumber,
} from "@/lib/season/season-economy-factors";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Ab dieser Differenz gilt ein Faktor als verschieden — dieselbe Schwelle wie im Finanzen-Ausblick. */
const FAKTOR_EPSILON = 0.005;

export type SponsorSalaryFactorSeason = {
  /** 0 = die laufende Saison, 1 = die naechste, … */
  horizonIndex: number;
  /** Echte Saisonnummer (nicht „+2"), damit die Zeile ohne Kopfrechnen lesbar ist. */
  seasonNumber: number;
  label: string;
  factor: number;
  /** Faktor-Differenz zur laufenden Saison, auf 2 Stellen. 0 beim Horizont 0. */
  deltaToCurrent: number;
  /** Richtung gegenueber der LAUFENDEN Saison — „mehr Geld" (up) / „weniger Geld" (down). */
  direction: SalaryFactorDirection;
  /**
   * Faellt diese Saison noch in die Laufzeit? Beim laufenden Vertrag aus `seasonsRemaining`, sonst
   * aus der laengsten Laufzeit, die unter den offenen Angeboten ueberhaupt vorkommt.
   */
  covered: boolean;
};

export type SponsorContractSalaryFactorState = {
  /** Der Faktor, mit dem die AKTUELL geltende Leiter des Vertrags gebaut ist (`terms.salaryFactor`). */
  ladderFactor: number;
  /** Der Faktor der laufenden Saison. */
  seasonFactor: number;
  /**
   * Rechnet der Vertrag mit dem Faktor DIESER Saison? Der Saisonwechsel baut die Leiter eines
   * Mehrjahresvertrags neu (`rerollSponsorV3TermsForNewSeason`) — er wandert also mit. Ein
   * Altvertrag ohne Kurvenform kann dabei haengenbleiben; genau das faengt dieses Feld ab, damit die
   * Anzeige nicht einen Faktor verspricht, nach dem dieser Vertrag gar nicht bezahlt wird.
   */
  traegtDenSaisonfaktor: boolean;
  /**
   * Faktor bei Unterschrift — NUR gesetzt, wenn er belastbar ist und sich von der heutigen Leiter
   * unterscheidet. Im ERSTEN Vertragsjahr ist er per Konstruktion der Saisonfaktor, eine Abweichung
   * dort waere kein Ereignis, sondern Altdatenrest: gemessen trugen in `pc.sqlite` alle 32 Vertraege
   * eines Spielstands `salaryFactorAtSign = 1`, obwohl die Leiter mit 1,05 gebaut war (Nachwirkung
   * des alten `?? 1`-Ersatzwerts, siehe tests/salary-factor-season-eins.test.ts). Deshalb wird das
   * Feld erst ab Vertragsjahr 2 ueberhaupt betrachtet.
   */
  factorAtSign: number | null;
};

export type SponsorSalaryFactorOutlook = {
  currentFactor: number;
  currentSeasonNumber: number;
  /** Laufende Saison plus die bereits feststehenden Folgejahre. */
  seasons: SponsorSalaryFactorSeason[];
  /** Richtung laufende → naechste Saison; null, wenn es keine naechste im Fenster gibt. */
  nextDirection: SalaryFactorDirection | null;
  nextFactor: number | null;
  /** Laengste Laufzeit, die eine Unterschrift JETZT binden wuerde (Vertrag bzw. offene Angebote). */
  coveredSeasons: number;
  /**
   * KUERZESTE Laufzeit im offenen Angebotsraster. Ohne sie stuende auf der Karte „wer ueber 3
   * Saisons unterschreibt", obwohl daneben auch ein Einjahresangebot liegt — die Bindung haengt am
   * gewaehlten Angebot, nicht am laengsten. Null, sobald ein Vertrag laeuft (dann gibt es nichts zu
   * waehlen) oder keine Angebote offen sind.
   */
  offerTermMin: number | null;
  /** Nur gesetzt, wenn ein Vertrag laeuft und seine Konditionen lesbar sind. */
  contract: SponsorContractSalaryFactorState | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function istFaktor(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function richtung(factor: number, referenz: number): SalaryFactorDirection {
  if (Math.abs(factor - referenz) < FAKTOR_EPSILON) return "flat";
  return factor > referenz ? "up" : "down";
}

export function buildSponsorSalaryFactorOutlook(input: {
  /**
   * Seed-Anteil des Fensters. Fehlt er (der Sponsor-Panel-Vertrag reicht ihn erst seit diesem
   * Umbau durch), wird NICHT ersatzweise gewuerfelt: ein Wurf mit leerer saveId ergaebe andere
   * Zahlen als auf der Finanzseite — zwei Wahrheiten auf demselben Bildschirm sind schlimmer als
   * eine fehlende Karte. Dann traegt nur ein bereits persistiertes Fenster die Anzeige.
   */
  saveId: string | null | undefined;
  seasonId: string;
  seasonState?: Pick<SeasonState, "seasonEconomyFactors">;
  contract?: TeamSponsorContract | null;
  /** Laufzeiten der offenen Angebote — bestimmt ohne Vertrag, wie weit der Ausblick „bindet". */
  offerTermSeasons?: ReadonlyArray<number | null | undefined>;
}): SponsorSalaryFactorOutlook | null {
  const persistiert = (input.seasonState?.seasonEconomyFactors ?? []).filter(
    (record) => record.seasonId === input.seasonId,
  );
  if (!input.saveId && persistiert.length < SEASON_ECONOMY_FACTOR_WINDOW_SIZE) {
    return null;
  }

  const window = getSeasonEconomyFactorWindow({
    saveId: input.saveId ?? "",
    seasonId: input.seasonId,
    seasonState: input.seasonState,
  });
  const factors = window.map((record) => record.factor);
  const currentFactor = factors[0];
  if (!istFaktor(currentFactor)) {
    return null;
  }

  // Richtung laufende → naechste Saison aus der geteilten Ableitung, nicht aus einer zweiten Regel.
  const outlook = deriveSalaryFactorOutlook(factors);
  const currentSeasonNumber = parseSeasonNumber(input.seasonId);

  // Wie viele Saisons sind gebunden? Laeuft ein Vertrag, ist es SEINE Restlaufzeit — und NICHT
  // zusaetzlich die Laufzeit irgendwelcher Angebote: wer schon unterschrieben hat, kann in diesem
  // Fenster gar nicht mehr waehlen, ein Maximum ueber beides wuerde eine Bindung behaupten, die es
  // nicht gibt. Ohne Vertrag zaehlt die laengste Laufzeit im offenen Angebotsraster. Mindestens 1 —
  // die laufende Saison ist immer gebunden.
  const restlaufzeit = input.contract?.seasonsRemaining;
  const angebotslaufzeiten = (input.offerTermSeasons ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  const angebotslaufzeit = angebotslaufzeiten.reduce((max, value) => Math.max(max, value), 0);
  const coveredSeasons = input.contract
    ? Math.max(1, typeof restlaufzeit === "number" && Number.isFinite(restlaufzeit) ? restlaufzeit : 0)
    : Math.max(1, angebotslaufzeit);
  const offerTermMin =
    input.contract || angebotslaufzeiten.length === 0
      ? null
      : angebotslaufzeiten.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);

  const seasons: SponsorSalaryFactorSeason[] = [];
  for (const [horizonIndex, factor] of factors.entries()) {
    if (!istFaktor(factor)) continue;
    seasons.push({
      horizonIndex,
      seasonNumber: currentSeasonNumber + horizonIndex,
      label: horizonIndex === 0 ? `Saison ${currentSeasonNumber}` : `Saison ${currentSeasonNumber + horizonIndex}`,
      factor,
      deltaToCurrent: horizonIndex === 0 ? 0 : round2(factor - currentFactor),
      direction: horizonIndex === 0 ? "flat" : richtung(factor, currentFactor),
      covered: horizonIndex < coveredSeasons,
    });
  }

  return {
    currentFactor,
    currentSeasonNumber,
    seasons,
    nextDirection: outlook.direction,
    nextFactor: outlook.nextFactor,
    coveredSeasons,
    offerTermMin,
    contract: buildContractState(input.contract ?? null, currentFactor),
  };
}

function buildContractState(
  contract: TeamSponsorContract | null,
  seasonFactor: number,
): SponsorContractSalaryFactorState | null {
  if (!contract) return null;
  const terms = getSponsorV3Terms(contract);
  const ladderFactor = terms?.salaryFactor;
  if (!istFaktor(ladderFactor)) return null;

  // Vertragsjahr: erst ab dem zweiten kann sich seit der Unterschrift ueberhaupt etwas bewegt haben.
  const termSeasons = contract.termSeasons ?? null;
  const remaining = contract.seasonsRemaining ?? null;
  const abJahrZwei =
    typeof termSeasons === "number" && typeof remaining === "number" && remaining < termSeasons;
  const atSign = contract.salaryFactorAtSign;
  const factorAtSign =
    abJahrZwei && istFaktor(atSign) && Math.abs(atSign - ladderFactor) >= FAKTOR_EPSILON ? atSign : null;

  return {
    ladderFactor,
    seasonFactor,
    traegtDenSaisonfaktor: Math.abs(ladderFactor - seasonFactor) < FAKTOR_EPSILON,
    factorAtSign,
  };
}

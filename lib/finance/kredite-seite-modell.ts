/**
 * KREDITE-SEITE (22.11., Reiter der Finanzseite; Vorlage public/mockups/kredite-modern-22-11.html, Konzept docs/design/kredite-modern-22-11.md).
 *
 * Reine Rechnung, kein React. Die Seite rechnet nichts ein zweites Mal: Rahmen, Konditionen, Plan, Ablöse und Sperren kommen aus
 * `loan-service`, `kredit-raten` und `kredit-pruefung`; die Vorschau eines neuen Kredits SIMULIERT die echte Aufnahme (`originateLoan` mit
 * `execute`) und liest Transfertopf und Zins aus dem Ergebnis (gezeigt = gebucht).
 *
 * Fog of War: die Seite gehoert dem aktiven Manager (`teamId`). Das Kreditregister der Liga ist oeffentlich und exakt (PM-Entscheidung
 * 22.11.), die Kasse fremder Teams bleibt verborgen: sie steht in keiner Zeile dieses Modells.
 */
import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { alsJahresrateKredit, alsRatenKredit, istRatenKredit, kreditPlan, kreditRatenAktiv, type KreditPlan } from "@/lib/finance/kredit-raten";
import { KREDIT_SPERRE_TEXT, pruefeKreditAufnahme, SCHULDENDIENST_KI_GRENZE, SCHULDENDIENST_OBERGRENZE, type KreditSperreGrund } from "@/lib/finance/kredit-pruefung";
import {
  berechneKreditRahmen,
  buildLoanOffers,
  computeEarlyPayoff,
  computeLoanTerms,
  getTeamAnnualLoanInstallment,
  getTeamAnnualLoanInterest,
  getTeamOutstandingDebt,
  INSOLVENCY_BACKSTOP_TERM_SEASONS,
  originateLoan,
  type LoanOffer,
} from "@/lib/finance/loan-service";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { berechneVorstandBudgetStand, resolveVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getLeagueOf } from "@/lib/season/league-split";

export const KREDIT_MIN_LAUFZEIT = 1;
export const KREDIT_MAX_LAUFZEIT = 10;
/** Laufzeiten, die die Seite als Knoepfe anbietet (der Kern erlaubt 1 bis 10). */
export const KREDIT_LAUFZEITEN = [1, 2, 3, 4, 5, 6, 8, 10] as const;

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function saisonNummer(id: string | null | undefined): number {
  return Number(/(\d+)\s*$/.exec(id ?? "")?.[1] ?? 1);
}

// --- Laufende Kredite ---------------------------------------------------------------------------------------------------------------

export type KreditZeile = {
  loanId: string;
  geberId: string | null;
  geberName: string;
  aufgenommenSaison: number;
  laufzeitSaisons: number;
  aufgenommen: number;
  restschuld: number;
  getilgtAnteil: number;
  zins: number;
  /** Offene Raten bis zum Ende (je Spieltag; ohne Raten-Saison: Saisons x Spieltage als Vorschau). */
  ratenOffen: number;
  ratenGesamt: number;
  ratenGezahlt: number;
  rateJeSpieltag: number;
  rateJeSaison: number;
  /** Ablöse heute: Restschuld + Gebühr (20 % der entgangenen Zinsen). */
  abloese: number;
  abloeseGebuehr: number;
  abloeseSpart: number;
  status: LoanRecord["status"];
  missedPayments: number;
};

export type PlanZeile = { spieltag: number; zustand: "vorher" | "bezahlt" | "naechste" | "offen" };

export type KreditPlanModell = {
  /** Die Raten ab heute (Rest des Plans). */
  plan: KreditPlan;
  /**
   * Der ganze Plan von der ersten Rate an, solange er sich aus dem Kredit sauber nachrechnen laesst (Spieltagsraten, keine verpasste Rate,
   * Restschuld stimmt mit der Rechnung ueberein); sonst `null` und die Seite zeigt nur den Rest.
   */
  gesamt: KreditPlan | null;
  /** Raten, die schon gebucht sind (alle Saisons zusammen). */
  gezahlt: number;
  /** Die Spieltage der laufenden Saison: bezahlt, naechste Rate, offen. */
  spieltage: PlanZeile[];
  rate: number;
  /** Nummer der laufenden Saison (der Plan hebt diese Zeile hervor). */
  saisonJetzt: number;
};

export type LigaZeile = {
  teamId: string;
  name: string;
  liga: string | null;
  schulden: number;
  rateJeSaison: number;
  quote: number;
  bankZins: number;
};

export type RegisterZeile = {
  loanId: string;
  nehmerId: string;
  nehmerName: string;
  geberId: string | null;
  geberName: string;
  saison: number;
  aufgenommen: number;
  restschuld: number;
  zins: number;
  ratenOffen: number;
  rateJeSaison: number;
  status: LoanRecord["status"];
  eigene: boolean;
};

export type KreditSeitenModell = {
  teamId: string;
  teamName: string;
  saisonNummer: number;
  /** Gebuchte Spieltage der Saison und Zahl der Spieltage (der Nenner der Raten). */
  spieltag: number;
  n: number;
  /** Zahlen die Kredite in dieser Saison je Spieltag? Sonst eine Jahresrate am Saisonende bis zum naechsten Saisonwechsel. */
  jeSpieltag: boolean;
  kasse: number;
  finanzwert: number;
  kaderwert: number;
  rahmenGesamt: number;
  rahmenFrei: number;
  schulden: number;
  auslastung: number;
  rateJeSaison: number;
  rateJeSpieltag: number;
  zinsSchnitt: number;
  planEinnahmen: number;
  schuldendienst: number;
  vorstand: { vertrauen: number | null; anteil: number; stufe: string };
  /** Darf der Manager in dieser Phase aufnehmen? Sonst der Grund als Satz. */
  phaseSperre: string | null;
  kredite: KreditZeile[];
  liga: LigaZeile[];
  register: RegisterZeile[];
  /** Kasse im Minus: der Notkredit der Bank am Ende des Kauffensters (Fehlbetrag, Laufzeit, Zins, Rate). */
  notkredit: { fehlbetrag: number; saisons: number; zins: number; rateJeSpieltag: number } | null;
};

export function geberName(gameState: GameState, loan: Pick<LoanRecord, "lenderType" | "lenderTeamId">): string {
  if (loan.lenderType !== "team") return "Bank";
  return gameState.teams.find((t) => t.teamId === loan.lenderTeamId)?.name ?? "Team";
}

export function spieltageDerSaison(gameState: GameState): number {
  return gameState.season?.matchdayIds?.length ?? 0;
}

/** Gebuchte Spieltage der laufenden Saison (Zeilen im Ledger des Teams, sonst ueber die Spielergebnisse). */
export function gebuchteSpieltage(gameState: GameState, teamId: string): number {
  const id = gameState.seasonState?.seasonId ?? gameState.season?.id;
  const ledger = (gameState.seasonState?.spieltagFinanzen ?? []).filter((z) => z.seasonId === id && z.teamId === teamId).length;
  if (ledger > 0) return ledger;
  return (gameState.seasonState?.matchdayResults ?? []).filter((r) => r.seasonId === id).length;
}

function kreditZeile(gameState: GameState, loan: LoanRecord, n: number): KreditZeile {
  // Restlaufzeit und Plan immer in Spieltagsraten (ohne Raten-Saison als Vorschau "ab dem naechsten Saisonwechsel").
  const raten = alsRatenKredit(loan, n);
  const jeSpieltag = kreditRatenAktiv(gameState);
  // Gezeigt = gebucht (M1): ohne Raten-Saison bucht das Saisonende die zur Jahresrate zurueckgerechnete Rate.
  const jahresrate = alsJahresrateKredit(loan).installmentPerSeason ?? 0;
  const laufend = loan.status === "active";
  const quote = laufend ? computeEarlyPayoff(loan, gameState) : { payoff: 0, feePortion: 0, foregoneInterest: 0, principalPortion: 0 };
  const gesamt = loan.termSeasons * n;
  const offen = laufend ? (raten.ratenOffen ?? 0) : 0;
  return {
    loanId: loan.loanId,
    geberId: loan.lenderType === "team" ? (loan.lenderTeamId ?? null) : null,
    geberName: geberName(gameState, loan),
    aufgenommenSaison: saisonNummer(loan.originatedSeasonId),
    laufzeitSaisons: loan.termSeasons,
    aufgenommen: r1(loan.principalOriginal),
    restschuld: r1(loan.principalOutstanding),
    getilgtAnteil: loan.principalOriginal > 0 ? Math.max(0, Math.min(1, 1 - loan.principalOutstanding / loan.principalOriginal)) : 0,
    zins: loan.interestRatePerSeason,
    ratenOffen: offen,
    ratenGesamt: gesamt,
    ratenGezahlt: Math.max(0, gesamt - offen),
    // Gezeigt = gebucht: in einer Raten-Saison die Spieltagsrate, sonst bis zum naechsten Saisonwechsel die Jahresrate am Saisonende.
    rateJeSpieltag: jeSpieltag ? (raten.rateJeSpieltag ?? 0) : r2(jahresrate / n),
    rateJeSaison: jeSpieltag ? r1((raten.rateJeSpieltag ?? 0) * n) : r1(jahresrate),
    abloese: r1(quote.payoff),
    abloeseGebuehr: r1(quote.feePortion),
    abloeseSpart: r1(Math.max(0, quote.foregoneInterest - quote.feePortion)),
    status: loan.status,
    missedPayments: loan.missedPayments ?? 0,
  };
}

/** Der Tilgungsplan eines laufenden Kredits: dieselbe Schrittrechnung wie die Buchung (`kreditPlan`). */
export function baueKreditPlan(gameState: GameState, loan: LoanRecord, teamId: string): KreditPlanModell | null {
  const n = spieltageDerSaison(gameState);
  if (n <= 0 || loan.status !== "active") return null;
  const raten = alsRatenKredit(loan, n);
  const gebucht = gebuchteSpieltage(gameState, teamId);
  const start = Math.min(n + 1, gebucht + 1);
  const saisonJetzt = saisonNummer(gameState.season?.id);
  const rate = raten.rateJeSpieltag ?? 0;
  const plan = kreditPlan({ restschuld: loan.principalOutstanding, zinsJeSaison: loan.interestRatePerSeason, n, raten: raten.ratenOffen ?? 0, rate, start, startSaison: saisonJetzt });
  const gesamtRaten = loan.termSeasons * n;
  const gezahlt = Math.max(0, gesamtRaten - (raten.ratenOffen ?? 0));

  // Der ganze Plan: nur, wenn er mit dem Kredit uebereinstimmt (Spieltagsraten, nichts verpasst, Restschuld nach `gezahlt` Raten gleich).
  let gesamt: KreditPlan | null = null;
  if (istRatenKredit(loan) && loan.missedPayments === 0 && loan.ratenJeSaison === n && (loan.ratenOffen ?? 0) <= gesamtRaten) {
    const p0 = start - gezahlt;
    const saisonenZurueck = p0 >= 1 ? 0 : Math.ceil((1 - p0) / n);
    const ersterSpieltag = p0 + saisonenZurueck * n;
    const voll = kreditPlan({
      restschuld: loan.principalOriginal,
      zinsJeSaison: loan.interestRatePerSeason,
      n,
      raten: gesamtRaten,
      rate,
      start: ersterSpieltag,
      startSaison: saisonJetzt - saisonenZurueck,
    });
    const restNach = gezahlt > 0 ? (voll.jeRate[gezahlt - 1]?.rest ?? loan.principalOriginal) : loan.principalOriginal;
    if (Math.abs(restNach - loan.principalOutstanding) < 0.2 && voll.raten === gesamtRaten) gesamt = voll;
  }

  const gebuchteIds = new Set<number>();
  const saisonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  for (const z of gameState.seasonState?.spieltagFinanzen ?? []) {
    if (z.teamId === teamId && z.seasonId === saisonId && (z.kredit ?? []).some((p) => p.loanId === loan.loanId)) gebuchteIds.add(z.matchdayIndex);
  }
  const spieltage: PlanZeile[] = [];
  for (let q = 1; q <= n; q += 1) {
    spieltage.push({ spieltag: q, zustand: gebuchteIds.has(q) ? "bezahlt" : q < start ? "vorher" : q === start ? "naechste" : "offen" });
  }
  return { plan, gesamt, gezahlt, spieltage, rate, saisonJetzt };
}

// --- Ganzes Modell ------------------------------------------------------------------------------------------------------------------

export function baueKreditSeitenModell(gameState: GameState, teamId: string): KreditSeitenModell | null {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team) return null;
  const n = spieltageDerSaison(gameState);
  const nEff = n > 0 ? n : 20;
  const identity = gameState.teamIdentities.find((i) => i.teamId === teamId) ?? null;
  const finanzwert = identity?.finances ?? 5;
  const rahmen = berechneKreditRahmen(gameState, teamId);
  const loans = gameState.seasonState.loans ?? [];
  const meine = loans.filter((l) => l.borrowerTeamId === teamId && (l.status === "active" || l.status === "defaulted"));
  const kredite = meine.map((l) => kreditZeile(gameState, l, nEff)).sort((a, b) => b.restschuld - a.restschuld);
  const aktive = kredite.filter((k) => k.status === "active");
  const schulden = r1(aktive.reduce((s, k) => s + k.restschuld, 0));
  const rateJeSaison = getTeamAnnualLoanInstallment(gameState, teamId);
  const zinsSchnitt = schulden > 0 ? aktive.reduce((s, k) => s + k.restschuld * k.zins, 0) / schulden : 0;
  const planEinnahmen = erwarteterSponsorFuerPlanung(gameState, teamId);
  const freigabe = resolveVorstandFreigabe(gameState, teamId);
  const phase = evaluateGamePhaseAction(gameState, "credit_borrow");

  const bankZinsFuer = (id: string) =>
    computeLoanTerms({ principal: 1, termSeasons: 1, finances: gameState.teamIdentities.find((i) => i.teamId === id)?.finances ?? 5 }).interestRatePerSeason;
  const liga: LigaZeile[] = gameState.teams.map((t) => {
    const rate = getTeamAnnualLoanInstallment(gameState, t.teamId);
    const plan = erwarteterSponsorFuerPlanung(gameState, t.teamId);
    return {
      teamId: t.teamId,
      name: t.name,
      liga: getLeagueOf(gameState, t.teamId),
      schulden: getTeamOutstandingDebt(gameState, t.teamId),
      rateJeSaison: rate,
      quote: plan > 0 ? rate / plan : 0,
      bankZins: bankZinsFuer(t.teamId),
    };
  });
  const register: RegisterZeile[] = loans.map((l) => {
    const raten = alsRatenKredit(l, nEff);
    const laufend = l.status === "active";
    return {
      loanId: l.loanId,
      nehmerId: l.borrowerTeamId,
      nehmerName: gameState.teams.find((t) => t.teamId === l.borrowerTeamId)?.name ?? l.borrowerTeamId,
      geberId: l.lenderType === "team" ? (l.lenderTeamId ?? null) : null,
      geberName: geberName(gameState, l),
      saison: saisonNummer(l.originatedSeasonId),
      aufgenommen: r1(l.principalOriginal),
      restschuld: r1(l.principalOutstanding),
      zins: l.interestRatePerSeason,
      ratenOffen: laufend ? (raten.ratenOffen ?? 0) : 0,
      rateJeSaison: kreditRatenAktiv(gameState) ? r1((raten.rateJeSpieltag ?? 0) * nEff) : r1(alsJahresrateKredit(l).installmentPerSeason ?? 0),
      status: l.status,
      eigene: l.borrowerTeamId === teamId || l.lenderTeamId === teamId,
    };
  });

  let notkredit: KreditSeitenModell["notkredit"] = null;
  if (team.cash < -0.01) {
    const fehlbetrag = r1(-team.cash);
    const terms = computeLoanTerms({ principal: fehlbetrag, termSeasons: INSOLVENCY_BACKSTOP_TERM_SEASONS, finances: finanzwert });
    notkredit = {
      fehlbetrag,
      saisons: INSOLVENCY_BACKSTOP_TERM_SEASONS,
      zins: terms.interestRatePerSeason,
      rateJeSpieltag: r2(terms.installmentPerSeason / nEff),
    };
  }

  return {
    teamId,
    teamName: team.name,
    saisonNummer: saisonNummer(gameState.season?.id),
    spieltag: gebuchteSpieltage(gameState, teamId),
    n: nEff,
    jeSpieltag: kreditRatenAktiv(gameState),
    kasse: r1(team.cash),
    finanzwert,
    kaderwert: rahmen.kaderwert,
    rahmenGesamt: rahmen.gesamt,
    rahmenFrei: rahmen.frei,
    schulden,
    auslastung: rahmen.gesamt > 0 ? Math.min(1, schulden / rahmen.gesamt) : 0,
    rateJeSaison,
    rateJeSpieltag: r2(rateJeSaison / nEff),
    zinsSchnitt,
    planEinnahmen,
    schuldendienst: planEinnahmen > 0 ? rateJeSaison / planEinnahmen : 0,
    vorstand: { vertrauen: freigabe.vertrauen ?? gameState.seasonState.boardConfidence?.[teamId]?.value ?? null, anteil: freigabe.anteil, stufe: freigabe.stufe },
    phaseSperre: phase.allowed ? null : "Kredite gibt es nur in der Vorsaison und vor dem ersten Spieltag.",
    kredite,
    liga,
    register,
    notkredit,
  };
}

// --- Vorschau eines neuen Kredits ----------------------------------------------------------------------------------------------------

export type AngebotZeile = {
  geberId: string | null;
  geberName: string;
  zins: number;
  rateJeSpieltag: number;
  rateJeSaison: number;
  gesamtZinsen: number;
  /** Bis zu diesem Betrag leiht der Geber. */
  maxBetrag: number;
  ok: boolean;
  guenstigstes: boolean;
};

export type WirkungsZeile = {
  schluessel: "kasse" | "transfertopf" | "rate" | "guv" | "bisSaisonende" | "gesamtkosten";
  alt: number | null;
  neu: number | null;
  aenderung: number | null;
  /** true = gut fuer das Team (gruen), false = schlecht (rot), null = neutral. */
  gut: boolean | null;
};

export type KreditVorschau = {
  betrag: number;
  laufzeit: number;
  angebote: AngebotZeile[];
  gewaehlt: AngebotZeile | null;
  wirkung: WirkungsZeile[];
  quoteAlt: number;
  quoteNeu: number;
  /** Raten, die in der laufenden Saison noch anfallen (Spieltage). */
  offeneSpieltage: number;
  ersteRateSpieltag: number;
  /** Warum der Knopf gesperrt ist; `null` = aufnehmbar. */
  sperre: string | null;
  sperreGrund: KreditSperreGrund | "phase" | "rahmen" | "geber" | "ungueltig" | null;
};

export function baueKreditVorschau(
  gameState: GameState,
  teamId: string,
  eingabe: { betrag: number; laufzeit: number; geberId: string | null; guvAktuell: number | null },
): KreditVorschau {
  const n = spieltageDerSaison(gameState) || 20;
  const laufzeit = Math.max(KREDIT_MIN_LAUFZEIT, Math.min(KREDIT_MAX_LAUFZEIT, Math.round(eingabe.laufzeit)));
  const betrag = Math.max(1, Math.round(eingabe.betrag));
  const angebotsliste: LoanOffer[] = buildLoanOffers(gameState, teamId, betrag, laufzeit);
  const gueltige = angebotsliste.filter((o) => o.maxAmount >= betrag);
  const guenstigster = gueltige.length > 0 ? gueltige.reduce((a, b) => (b.interestRatePerSeason < a.interestRatePerSeason ? b : a)) : null;
  const zeilen: AngebotZeile[] = angebotsliste.map((o) => ({
    geberId: o.lenderType === "team" ? (o.lenderTeamId ?? null) : null,
    geberName: o.lenderName,
    zins: o.interestRatePerSeason,
    rateJeSpieltag: o.rateJeSpieltag ?? r2(o.installmentPerSeason / n),
    rateJeSaison: o.installmentPerSeason,
    gesamtZinsen: o.gesamtZinsen,
    maxBetrag: o.maxAmount,
    ok: o.maxAmount >= betrag,
    guenstigstes: o === guenstigster,
  }));
  const gewaehlt = zeilen.find((z) => z.geberId === eingabe.geberId && z.ok) ?? zeilen.find((z) => z.geberId == null && z.ok) ?? zeilen.find((z) => z.ok) ?? null;

  const offen = Math.max(0, n - gebuchteSpieltage(gameState, teamId));
  const leer: KreditVorschau = {
    betrag,
    laufzeit,
    angebote: zeilen,
    gewaehlt,
    wirkung: [],
    quoteAlt: 0,
    quoteNeu: 0,
    offeneSpieltage: offen,
    ersteRateSpieltag: Math.min(n, gebuchteSpieltage(gameState, teamId) + 1),
    sperre: null,
    sperreGrund: null,
  };
  if (!gewaehlt) return { ...leer, sperre: "Kein Geber leiht diesen Betrag.", sperreGrund: "geber" };

  const sim = originateLoan(
    gameState,
    {
      borrowerTeamId: teamId,
      principal: betrag,
      termSeasons: laufzeit,
      ...(gewaehlt.geberId ? { lenderType: "team" as const, lenderTeamId: gewaehlt.geberId } : {}),
    },
    { execute: true },
  );
  if (!sim.ok || !sim.loan) {
    const grund = sim.reason === "over_capacity" ? "rahmen" : "ungueltig";
    return { ...leer, sperre: sim.reason === "over_capacity" ? "Über dem Kreditrahmen." : "Dieser Kredit ist so nicht möglich.", sperreGrund: grund };
  }

  const nach = sim.gameState;
  const neuRaten = alsRatenKredit(sim.loan, n);
  // M2: dieselbe Zahl wie die Route `POST /api/finance/loan/originate` (sie prueft `loan.installmentPerSeason`): in einer Raten-Saison Rate x Spieltage,
  // sonst die Jahresrate des Saisonende-Wegs. Der Rechner und der Knopf urteilen so genau wie der Server.
  const jahresrateNeu = r1(sim.loan.installmentPerSeason);
  const pruefung = pruefeKreditAufnahme(gameState, teamId, jahresrateNeu);
  const standAlt = berechneVorstandBudgetStand(gameState, teamId);
  const standNeu = berechneVorstandBudgetStand(nach, teamId);
  const topfAlt = standAlt.gedeckelt ? standAlt.investition.frei : standAlt.nochFrei;
  const topfNeu = standNeu.gedeckelt ? standNeu.investition.frei : standNeu.nochFrei;
  const team = gameState.teams.find((t) => t.teamId === teamId)!;
  const zinsAlt = getTeamAnnualLoanInterest(gameState, teamId);
  const zinsNeu = getTeamAnnualLoanInterest(nach, teamId);
  const rateAlt = getTeamAnnualLoanInstallment(gameState, teamId);
  const rateNeu = getTeamAnnualLoanInstallment(nach, teamId);
  const plan = kreditPlan({
    restschuld: betrag,
    zinsJeSaison: sim.loan.interestRatePerSeason,
    n,
    raten: neuRaten.ratenOffen ?? 0,
    rate: neuRaten.rateJeSpieltag ?? 0,
    start: leer.ersteRateSpieltag,
  });
  // "Bis Saisonende": in einer Raten-Saison die Raten der noch offenen Spieltage, ohne Raten-Saison die EINE Jahresrate am Saisonende.
  const ratenSaison = kreditRatenAktiv(gameState) ? (plan.saisons[0] ? r1(plan.saisons[0].zins + plan.saisons[0].tilgung) : 0) : jahresrateNeu;
  const gesamtZinsen = r1(plan.zinsenGesamt);
  const wirkung: WirkungsZeile[] = [
    { schluessel: "kasse", alt: r1(team.cash), neu: r1(team.cash + betrag), aenderung: r1(betrag), gut: true },
    { schluessel: "transfertopf", alt: r1(topfAlt), neu: r1(topfNeu), aenderung: r1(topfNeu - topfAlt), gut: topfNeu - topfAlt >= 0 },
    { schluessel: "rate", alt: -r1(rateAlt), neu: -r1(rateNeu), aenderung: -r1(rateNeu - rateAlt), gut: false },
    {
      schluessel: "guv",
      alt: eingabe.guvAktuell == null ? null : r1(eingabe.guvAktuell),
      neu: eingabe.guvAktuell == null ? null : r1(eingabe.guvAktuell - (zinsNeu - zinsAlt)),
      aenderung: -r1(zinsNeu - zinsAlt),
      gut: false,
    },
    { schluessel: "bisSaisonende", alt: null, neu: -ratenSaison, aenderung: -ratenSaison, gut: false },
    { schluessel: "gesamtkosten", alt: null, neu: r1(betrag + gesamtZinsen), aenderung: -gesamtZinsen, gut: false },
  ];

  let sperre: string | null = null;
  let sperreGrund: KreditVorschau["sperreGrund"] = null;
  if (!pruefung.ok && pruefung.reason) {
    sperre = KREDIT_SPERRE_TEXT[pruefung.reason];
    sperreGrund = pruefung.reason;
  } else {
    const phase = evaluateGamePhaseAction(gameState, "credit_borrow");
    if (!phase.allowed) {
      sperre = "Kredite gibt es nur in der Vorsaison und vor dem ersten Spieltag.";
      sperreGrund = "phase";
    }
  }
  return { ...leer, wirkung, gewaehlt, quoteAlt: pruefung.quoteAlt, quoteNeu: pruefung.quoteNeu, sperre, sperreGrund };
}

export { SCHULDENDIENST_KI_GRENZE, SCHULDENDIENST_OBERGRENZE };
export type { KreditPlan };

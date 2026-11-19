/**
 * Finanzkonzept V2, Stufe 3: Der Vorstand gibt Budget frei — er nimmt nichts weg und straft kein Geld.
 *
 * Chris am 18.11. (verbindlich, zuletzt: Zwei-Budget-Modell, Konzept #1591):
 *  - Das Geld bleibt auf dem Konto. Freigegeben sind nur X % zum AUSGEBEN. Die Sperre ist HART, Mensch und KI gleich.
 *  - ZWEI TOEPFE: `investition` (Abloesen; Gebaeude sollen aus demselben Topf kommen, noch nicht verdrahtet) mit der
 *    Vertrauensquote 100/85/70/50 %, und `gehalt` (Jahresgehaelter) mit derselben Quote, aber **nie unter 75 %**.
 *  - Verkaufserloese (Abloese) unterliegen der Transfer-Quote: bei 70 % werden von 20 C nur 14 C frei. Das beim Verkauf
 *    frei werdende Gehalt dagegen fliesst zu 100 % ins Gehaltsbudget zurueck (die Gehaltssumme sinkt).
 *  - Saison 1: Quote 100 % fuer alle (Vertrauensquote erst ab Saison 2).
 *  - Die Ruecklage nach Finanzwert (Stufe 1) bleibt weich; nur die Freigabe ist hart.
 *
 * Vertrauen = `seasonState.boardConfidence[teamId].value` (1 bis 10, Neutral 5; vorhandenes Board-System).
 *
 *   ab 6 -> 100 %   hoch      4 bis unter 6 -> 85 %   mittel
 *   2,5 bis unter 4 -> 70 %   niedrig      darunter -> 50 %   Sparauflage   (Gehalt: mindestens 75 %)
 *
 * Rechnung ohne neuen Speicher, aus dem Transferverlauf der laufenden Saison:
 *   Investition:  Anfangskasse = Kasse + Kaeufe - Verkaufserloese;  gesamt = Quote x (Anfangskasse + Verkaufserloese);
 *                 ausgegeben = Abloesen der Kaeufe;  frei = max(0, gesamt - ausgegeben), hoechstens die Kasse;
 *                 gesperrt = Kasse - frei (auf dem Konto, nicht ausgebbar).
 *   Gehalt:       Basis = max(erwarteter Sponsor 0,92 x Anker, Zielgehalt bei Soll-Kader) [Startwert];
 *                 gesamt = Gehaltsquote x Basis;  ausgegeben = aktuelle Gehaltssumme des Kaders;
 *                 frei = max(0, gesamt - ausgegeben);  gesperrt = Basis - gesamt.
 *
 * Ausnahme: unter dem Kader-Minimum (8) gilt die Sperre nicht — ein spielfaehiger Kader geht vor.
 *
 * AUSBAU (Finanzseite, 18.11.), aus Chris' Zwei-Budget-Entscheid und `docs/design/finanzkonzept-v2-budgets-18-11.md`:
 *  - GEBAEUDE zahlen aus dem Investitionstopf (Bau und Ausbau), Gehaltserhoehungen bei Verlaengerungen aus dem Gehaltstopf.
 *    Beides hart, Mensch und KI gleich (`pruefeGebaeudeGegenVorstandFreigabe`, `pruefeVerlaengerungGegenVorstandFreigabe`).
 *  - Ab Saison 2 gehen die Ruecklage nach Finanzwert und der Gehaltspuffer (7 Spieltage Gehalt, soweit die Ruecklage
 *    sie nicht deckt) in den Transfertopf ein: q x (Kasse - Ruecklage - Puffer) + q x Verkaufserloese. Saison 1 bleibt
 *    voll frei (Chris: Quote 100 % fuer alle; die KI haelt ihre halbe Draft-Ruecklage weich selbst). Der Gehaltstopf
 *    gilt ab Saison 2 auch bei Quote 100 % (Basis = max(erwarteter Sponsor, Zielgehalt)).
 *  - UMSCHICHTEN, LOCKERUNG nach Verkaeufen, RUECKLAGE ANZAPFEN und ALLES AUF EINE KARTE: Zustand in
 *    `seasonState.vorstandBudget`, geschrieben ueber `lib/finance/vorstand-budget-aktionen.ts`.
 */

import type { GameState, VorstandBudgetZustand } from "@/lib/data/olyDataTypes";
import { projectSalaryAtPlannerTarget } from "@/lib/ai/salary-projection";
import { berechneKiRuecklage, KI_RUECKLAGE_GEHALTS_FAKTOR } from "@/lib/finance/ki-ruecklage";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { verkaufserloeseFreiAnteil } from "@/lib/market/transferfenster-gemeinsam";

/** Untergrenze der Gehalts-Quote (Chris 18.11.: der Vorstand kuerzt das Gehaltsbudget hoechstens auf 75 %). */
export const GEHALTS_QUOTE_UNTERGRENZE = 0.75;
/** Pflichtkader: Kaeufe bis zu diesem Kader sind NIE gesperrt (Chris 18.11.: keine Finanzregel darf ein Team unter 8 halten). */
export const VORSTAND_PFLICHT_KADER = 8;

export type VorstandStufe = "hoch" | "standard" | "niedrig" | "knapp" | "sparauflage";

export const VORSTAND_STUFEN: ReadonlyArray<{ stufe: VorstandStufe; abVertrauen: number; anteil: number }> = [
  // Chris, 18.11. abends: Standard 90 %, 100 % ab 7,5; 80 % unter 5, 70 % unter 3, 50 % unter 1,5 (ersetzt 100/85/70/50).
  { stufe: "hoch", abVertrauen: 7.5, anteil: 1.0 },
  { stufe: "standard", abVertrauen: 5, anteil: 0.9 },
  { stufe: "niedrig", abVertrauen: 3, anteil: 0.8 },
  { stufe: "knapp", abVertrauen: 1.5, anteil: 0.7 },
  { stufe: "sparauflage", abVertrauen: -Infinity, anteil: 0.5 },
];

/** A/B-Schalter: `OLY_VORSTAND_BUDGET=0` schaltet die Freigabe aus (Anteil immer 100 %). */
export function istVorstandBudgetfreigabeAktiv(): boolean {
  return process.env.OLY_VORSTAND_BUDGET !== "0";
}

export type VorstandFreigabe = {
  teamId: string;
  stufe: VorstandStufe;
  /** Freigegebener Anteil des verfuegbaren Budgets, 0,6 bis 1. */
  anteil: number;
  /** Das gelesene Vertrauen (1 bis 10) oder null, wenn es keines gibt (dann 100 %). */
  vertrauen: number | null;
  /** Warum 100 %, obwohl das Vertrauen niedrig sein koennte. */
  grund: "vertrauen" | "saison_1" | "ohne_vertrauenswert" | "abgeschaltet";
};

function saisonNummer(gameState: GameState): number | null {
  const m = /(\d+)\s*$/.exec(gameState.season?.id ?? "");
  return m ? Number(m[1]) : null;
}

/** Stufe und Anteil zu einem Vertrauenswert (reine Funktion). */
export function stufeFuerVertrauen(vertrauen: number): { stufe: VorstandStufe; anteil: number } {
  for (const s of VORSTAND_STUFEN) {
    if (vertrauen >= s.abVertrauen) return { stufe: s.stufe, anteil: s.anteil };
  }
  return { stufe: "sparauflage", anteil: VORSTAND_STUFEN[VORSTAND_STUFEN.length - 1]!.anteil };
}

/** Wie viel Budget der Vorstand diesem Team fuer Transfers freigibt. Fuer KI und Mensch dieselbe Funktion. */
export function resolveVorstandFreigabe(gameState: GameState, teamId: string): VorstandFreigabe {
  if (!istVorstandBudgetfreigabeAktiv()) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "abgeschaltet" };
  }
  if ((saisonNummer(gameState) ?? 1) <= 1) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "saison_1" };
  }
  const gespeichert = gameState.seasonState.boardConfidence?.[teamId]?.value;
  if (typeof gespeichert !== "number" || !Number.isFinite(gespeichert)) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "ohne_vertrauenswert" };
  }
  // Vertrauenskosten des Anzapfens wirken erst bei der naechsten Festlegung (naechste Saison): bis dahin zaehlt der Wert ohne sie.
  // Steht das Anzapf-Ziel schon im Bestand, ist sein Abzug im gespeicherten Wert enthalten: dann wird er hier zurueckgerechnet.
  const zustand = gameState.seasonState.vorstandBudget?.[teamId];
  const kostenImWert =
    zustand &&
    zustand.seasonId === gameState.season?.id &&
    (gameState.seasonState.teamSeasonObjectives ?? []).some(
      (o) => o.teamId === teamId && o.seasonId === gameState.season?.id && o.objectiveId === "vorstand-ruecklage-angezapft",
    );
  const wert = gespeichert + (kostenImWert ? zustand!.vertrauensKosten ?? 0 : 0);
  const { stufe, anteil } = stufeFuerVertrauen(wert);
  return { teamId, stufe, anteil, vertrauen: wert, grund: "vertrauen" };
}

/** Anteil des Ruecklage-Ziels im ersten Fenster (Saison 2). */
export const RUECKLAGE_ERSTES_FENSTER = 0.5;
/** Anteils-Stufen der Transfer-Quote, von streng nach locker. */
export const QUOTEN_STUFEN = [0.5, 0.7, 0.8, 0.9, 1] as const;
/** Lockerungs-Puffer X als Anteil des tragbaren Gehalts je Ausgangsquote (50 / 70 / 80 / 90 %). */
export const LOCKERUNG_PUFFER_ANTEIL: Record<number, number> = { 0.5: 0.3, 0.7: 0.2, 0.8: 0.15, 0.9: 0.1 };
/** Umschicht-Grenze: Anteil des Gehaltstopfs je Ausgangsquote. */
export const UMSCHICHT_GRENZE_ANTEIL: Record<number, number> = { 1: 0.25, 0.9: 0.2, 0.8: 0.175, 0.7: 0.15, 0.5: 0.1 };
/** „Alles auf eine Karte“: nur dieser Anteil des Budgets bleibt als Puffer auf dem Konto. */
export const ALLES_PUFFER_ANTEIL = 0.05;
/** „Ruecklage anzapfen“: hoechstens dieser Anteil des Ruecklage-Ziels. */
export const ANZAPFEN_MAX_ANTEIL = 0.5;
/** Vertrauenskosten je angefangenem Viertel des Ruecklage-Ziels. */
export const ANZAPFEN_VERTRAUEN_JE_VIERTEL = 0.25;

/** Der gespeicherte Zustand dieses Teams in DIESER Saison (sonst leer: der Vorstand rechnet jede Saison neu). */
export function lesVorstandZustand(gameState: GameState, teamId: string): VorstandBudgetZustand {
  const z = gameState.seasonState?.vorstandBudget?.[teamId];
  if (z && z.seasonId === gameState.season?.id) return z;
  return {
    seasonId: gameState.season?.id ?? "",
    umschichtung: 0,
    ruecklageAngezapft: 0,
    vertrauensKosten: 0,
    alleAufEineKarte: null,
    protokoll: [],
  };
}

/** Ein Topf der Freigabe. */
export type VorstandTopf = {
  gesamt: number;
  ausgegeben: number;
  frei: number;
  gesperrt: number;
  quote: number;
  grund: string;
};

export type VorstandHerleitung = {
  /** Kasse zu Fensterbeginn (Kasse jetzt + Kaeufe + Gebaeude - Verkaufserloese). */
  anfangskasse: number;
  ruecklageZiel: number;
  finanzwert: number;
  ruecklageQuote: number;
  /** Gehaltspuffer: 7 Spieltage Gehalt, soweit die Ruecklage sie nicht deckt. */
  gehaltspuffer: number;
  /** Kasse - Ruecklage - Puffer (bei „Alles auf eine Karte“ die ganze Kasse). */
  verfuegbar: number;
  verkaufserloese: number;
  angezapft: number;
  /** Erwarteter Sponsor (0,92 x Anker). */
  sponsorErwartung: number;
  /** Gehalt bei Soll-Kader. */
  zielgehalt: number;
  /** Basis des Gehaltstopfs = max(Sponsor, Zielgehalt) = „tragbares Gehalt“. */
  tragbaresGehalt: number;
  /** Gehaltsbudget vor Umschichten. */
  gehaltsbudgetVorUmschichten: number;
};

export type VorstandUmschichten = {
  /** + = Transfer -> Gehalt (C Jahresgehalt). */
  aktuell: number;
  /** Grenze |Umschichtung| (Anteil x Gehaltstopf). */
  grenze: number;
  /** Anteil der Grenze am Gehaltstopf (0,25 / 0,2 / 0,15 / 0,1). */
  grenzeAnteil: number;
  /** Erlaubter Bereich der Umschichtung: von (negativ) bis (positiv). */
  moeglichVon: number;
  moeglichBis: number;
};

export type VorstandLockerung = {
  /** Ausgangsquote (vor Lockerung) und die Quote danach. */
  vonAnteil: number;
  nachAnteil: number;
  aktiv: boolean;
  /** Der Puffer X, den der Vorstand sehen will. */
  puffer: number;
  /** Verkaufserloes im Fenster, ab dem der einbehaltene Anteil X erreicht. */
  schwelle: number;
  verkaufserloese: number;
  einbehalten: number;
  /** Noch zu verkaufen bis zur Schwelle. */
  fehlt: number;
  /** Mehrfreigabe (tatsaechlich, wenn aktiv; sonst die, die bei Erreichen der Schwelle kaeme). */
  mehrFrei: number;
  /** Boden: die Kasse muss ueber Ruecklage-Ziel + Gehaltspuffer + X bleiben. */
  boden: number;
  /** Warum keine Lockerung moeglich ist (null = moeglich). */
  gesperrtGrund: string | null;
};

export type VorstandBudgetStand = {
  /** Zwei getrennte Toepfe (Zwei-Budget-Modell). */
  getrennt: boolean;
  /** Greift die harte Sperre? Nein in Saison 1 und bei abgeschalteter Freigabe. */
  gedeckelt: boolean;
  /** Transfer-/Investitionstopf (Abloesen und Gebaeude). */
  investition: VorstandTopf;
  /** Gehaltstopf (Jahresgehaelter). */
  gehalt: VorstandTopf;
  teamId: string;
  stufe: VorstandStufe;
  /** Transfer-Quote (Vertrauensquote, ohne Lockerung). */
  anteil: number;
  /** Wirksame Transfer-Quote (nach Lockerung bzw. „Alles auf eine Karte“). */
  wirksamerAnteil: number;
  /** Vertrauen, mit dem gerechnet wird (gespeichert + noch nicht wirksame Anzapf-Kosten), oder null. */
  vertrauen: number | null;
  /** Kurzformen des Investitionstopfs (Transfermarkt und Spielerprofil). */
  freigegebenGesamt: number;
  ausgegeben: number;
  nochFrei: number;
  gesperrt: number;
  /** Davon Gebaeude (in `ausgegeben` enthalten). */
  gebaeudeAusgegeben: number;
  /** Ein Satz: warum diese Zahlen. */
  grund: string;
  herleitung: VorstandHerleitung;
  umschichten: VorstandUmschichten;
  lockerung: VorstandLockerung;
  ruecklageAnzapfen: { moeglich: number; bereitsAngezapft: number; vertrauenskosten: number };
  /** Kaderpflicht-Freigabe (Chris 18.11.): der Rahmen ist nie kleiner als die Kosten bis zum Minimum und, soweit Geld ueber der Notruecklage da ist, bis zum Opt. */
  kaderpflicht: KaderpflichtStand;
  alleAufEineKarte: { aktiv: boolean; puffer: number; zustand: VorstandBudgetZustand["alleAufEineKarte"] };
  zustand: VorstandBudgetZustand;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const zahlText = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");

function naechsteQuote(q: number): number {
  for (const stufe of QUOTEN_STUFEN) if (stufe > q + 1e-9) return stufe;
  return 1;
}

export type KaderpflichtStand = {
  aktiv: boolean;
  kaderIst: number;
  kaderMin: number;
  kaderOpt: number;
  /** Platzpreis (Ablose / Jahresgehalt) eines sinnvollen Spielers aus dem Markt. */
  platzAbloese: number;
  platzGehalt: number;
  /** Was der Vorstand ZUSAETZLICH zum Rahmen nach Quote freigibt (C Ablose, C Jahresgehalt). */
  zuschlagAbloese: number;
  zuschlagGehalt: number;
  /** Rahmen ohne Kaderpflicht (nach Quote und Toepfen). */
  basisFreiAbloese: number;
  basisFreiGehalt: number;
  /** Notruecklage: das Ruecklage-Ziel; darueber wirkt die Annaeherung an Opt. */
  notruecklage: number;
  text: string | null;
};

/** Platzpreis eines sinnvollen Spielers: Median des freien Marktes (Marktwert und Gehaltsforderung). Wird je Spielerliste einmal gerechnet. */
const PLATZPREIS_CACHE = new WeakMap<object, { fee: number; salary: number; rosterSize: number }>();
export function platzPreisAusMarkt(gameState: GameState): { fee: number; salary: number } {
  const players = gameState.players ?? [];
  const cached = PLATZPREIS_CACHE.get(players);
  if (cached && cached.rosterSize === gameState.rosters.length) return { fee: cached.fee, salary: cached.salary };
  const vergeben = new Set(gameState.rosters.map((r) => r.playerId));
  const fees: number[] = [];
  const salaries: number[] = [];
  for (const pl of players) {
    if (vergeben.has(pl.id)) continue;
    const mv = pl.marketValue ?? pl.displayMarketValue ?? 0;
    if (!(mv > 0)) continue;
    fees.push(mv);
    salaries.push(pl.salaryDemand ?? pl.displaySalary ?? 0);
  }
  const median = (a: number[]) => (a.length === 0 ? 0 : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!);
  const ergebnis = { fee: median(fees), salary: median(salaries), rosterSize: gameState.rosters.length };
  PLATZPREIS_CACHE.set(players, ergebnis);
  return { fee: ergebnis.fee, salary: ergebnis.salary };
}

/**
 * Reine Funktion der Kaderpflicht-Freigabe, damit Planer und Sperre dieselbe Zahl rechnen (kaufRahmen.grenzeFuer).
 * Unter dem Minimum: Kosten der fehlenden Plaetze, gedeckt aus der GANZEN Kasse (inkl. Notruecklage, ohne Vertrauensverlust).
 * Zwischen Minimum und Opt: Plaetze bis Opt zum Platzpreis, soweit Kasse ueber der Notruecklage da ist.
 */
export function kaderpflichtZuschlag(input: {
  kaderIst: number;
  kaderMin: number;
  kaderOpt: number;
  platzAbloese: number;
  platzGehalt: number;
  cash: number;
  notruecklage: number;
}): { abloese: number; gehalt: number } {
  const fehltMin = Math.max(0, input.kaderMin - input.kaderIst);
  const fehltOpt = Math.max(0, input.kaderOpt - input.kaderIst);
  if (fehltMin > 0) {
    return {
      abloese: Math.max(0, Math.min(Math.max(0, input.cash), fehltMin * input.platzAbloese)),
      gehalt: fehltMin * input.platzGehalt,
    };
  }
  if (fehltOpt > 0) {
    return {
      abloese: Math.max(0, Math.min(fehltOpt * input.platzAbloese, input.cash - input.notruecklage)),
      gehalt: fehltOpt * input.platzGehalt,
    };
  }
  return { abloese: 0, gehalt: 0 };
}

/** Die Zahlen fuer Finanzseite, Transfermarkt und Spielerprofil. Fuer KI und Mensch dieselbe Funktion. */
export function berechneVorstandBudgetStand(gameState: GameState, teamId: string): VorstandBudgetStand {
  const zustand = lesVorstandZustand(gameState, teamId);
  const freigabe = resolveVorstandFreigabe(gameState, teamId);
  const team = gameState.teams.find((t) => t.teamId === teamId);
  const cash = team?.cash ?? 0;
  const seasonId = gameState.season.id;
  const saisonNr = saisonNummer(gameState) ?? 1;
  const alle = zustand.alleAufEineKarte != null;

  // Kontobewegungen dieser Saison (Ledger, nichts neu gespeichert).
  let kaeufe = 0;
  let verkaeufe = 0;
  for (const e of gameState.transferHistory ?? []) {
    if (e.seasonId !== seasonId) continue;
    if (e.transferType === "buy" && e.toTeamId === teamId) kaeufe += e.netCashImpact ?? e.fee;
    else if (e.transferType === "sell" && e.fromTeamId === teamId) verkaeufe += e.netCashImpact ?? e.fee;
  }
  let gebaeude = 0;
  for (const ev of gameState.seasonState?.facilityEvents ?? []) {
    if (ev.seasonId === seasonId && ev.teamId === teamId && Number.isFinite(ev.cost)) gebaeude += ev.cost;
  }
  const anfangskasse = cash + kaeufe + gebaeude - verkaeufe;
  const ausgegebenTransfer = kaeufe + gebaeude;

  // Gehaltstopf: Basis = max(erwarteter Sponsor, Zielgehalt bei Soll-Kader) = „tragbares Gehalt“.
  const gehaltsSumme = gameState.rosters.filter((r) => r.teamId === teamId).reduce((x, r) => x + (r.salary ?? 0), 0);
  const zielgehalt = projectSalaryAtPlannerTarget({ gameState, teamId, currentSalary: gehaltsSumme });
  const sponsor = erwarteterSponsorFuerPlanung(gameState, teamId);
  const basis = Math.max(sponsor, zielgehalt);
  const gehaltsQuote = alle || freigabe.anteil >= 1 ? 1 : Math.max(GEHALTS_QUOTE_UNTERGRENZE, freigabe.anteil);
  const gehaltBudget0 = gehaltsQuote * basis;

  // Ruecklage-Ziel nach Finanzwert (ab Saison 2 voll, Konzept 1) und Gehaltspuffer.
  const identity = gameState.teamIdentities?.find((i) => i.teamId === teamId);
  let kaderWert = 0;
  if (saisonNr >= 2) {
    const byId = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
    for (const r of gameState.rosters) {
      if (r.teamId !== teamId) continue;
      const pl = byId.get(r.playerId);
      kaderWert += Math.max(0, pl?.marketValue ?? pl?.displayMarketValue ?? 0);
    }
  }
  const ruecklageErg = berechneKiRuecklage({
    finances: identity?.finances,
    budget: Math.max(0, anfangskasse) + kaderWert,
    zielgehalt,
    saison: saisonNr,
  });
  const gedeckelt = istVorstandBudgetfreigabeAktiv() && saisonNr >= 2;
  // Erstes Fenster (Saison 2): nur die halbe Ruecklage. In Saison 1 hat niemand eine gehalten (halbe Draft-Ruecklage, Chris 18.11.),
  // die volle Ruecklage im Topf wuerde den Kauf im ersten Fenster hart abwuergen (Messung 18.11.: Kaderstaerke -6 %).
  const uebergang = saisonNr === 2 ? RUECKLAGE_ERSTES_FENSTER : 1;
  const ruecklageZiel = gedeckelt ? ruecklageErg.ruecklage * uebergang : 0;
  const gehaltspuffer = gedeckelt ? Math.max(0, KI_RUECKLAGE_GEHALTS_FAKTOR * gehaltBudget0 - ruecklageZiel) : 0;

  // Transfertopf.
  const q0 = freigabe.anteil;
  const anzapfenMax = ruecklageZiel * ANZAPFEN_MAX_ANTEIL;
  const angezapft = alle ? 0 : Math.min(Math.max(0, zustand.ruecklageAngezapft), anzapfenMax);
  const verfuegbar = alle ? Math.max(0, anfangskasse) : Math.max(0, anfangskasse - ruecklageZiel - gehaltspuffer);
  // Gemeinsames Transferfenster (Chris 18.11.): Verkaufserloese aus dem Fenster sind zu 100 % frei, die Quote gilt nur fuer die Kasse zu Fensterbeginn.
  const gesamtBei = (q: number, verk: number) => q * (verfuegbar + angezapft) + verkaufserloeseFreiAnteil(q) * verk;

  // Lockerung nach Verkaeufen (Konzept 4): einbehaltener Anteil (1 - q) x Verkaufserloes >= X -> eine Stufe mehr.
  const puffer = q0 < 1 ? (LOCKERUNG_PUFFER_ANTEIL[q0] ?? 0) * basis : 0;
  const einbehalten = (1 - verkaufserloeseFreiAnteil(q0)) * verkaeufe;
  const schwelle = q0 < 1 && puffer > 0 && verkaufserloeseFreiAnteil(q0) < 1 ? puffer / (1 - q0) : 0;
  const rosterCount = gameState.rosters.filter((r) => r.teamId === teamId).length;
  const pflichtkredit = (gameState.seasonState?.loans ?? []).some(
    (l) => l.borrowerTeamId === teamId && l.status === "active" && l.originatedSeasonId === seasonId,
  );
  let lockerungSperre: string | null = null;
  if (!gedeckelt) lockerungSperre = "Saison 1: alles ist freigegeben.";
  else if (alle) lockerungSperre = "„Alles auf eine Karte“ ist aktiv.";
  else if (q0 >= 1) lockerungSperre = "Schon voll freigegeben.";
  else if (verkaufserloeseFreiAnteil(q0) >= 1) lockerungSperre = "Im gemeinsamen Fenster sind Verkaufserlöse zu 100 % frei.";
  else if (cash < 0) lockerungSperre = "Keine Lockerung bei Kasse im Minus.";
  else if (pflichtkredit) lockerungSperre = "Keine Lockerung mit laufendem Kredit dieses Fensters.";
  else if (rosterCount < 8) lockerungSperre = "Der Kader muss über dem Minimum bleiben.";
  const q1 = naechsteQuote(q0);
  const lockerungAktiv = lockerungSperre == null && schwelle > 0 && einbehalten + 1e-9 >= puffer;
  const verkaeufeFuerMehr = lockerungAktiv ? verkaeufe : Math.max(verkaeufe, schwelle);
  const mehrRoh = gesamtBei(q1, verkaeufeFuerMehr) - gesamtBei(q0, verkaeufeFuerMehr);
  const mehrFrei = lockerungSperre == null ? Math.max(0, Math.min(mehrRoh, verkaeufeFuerMehr)) : 0;
  const boden = ruecklageZiel + gehaltspuffer + puffer;
  const wirksamerAnteil = alle ? 1 : lockerungAktiv ? q1 : q0;

  let transferGesamt: number;
  if (!gedeckelt) transferGesamt = Math.max(0, anfangskasse + verkaeufe);
  else if (alle) transferGesamt = Math.max(0, (Math.max(0, anfangskasse) + verkaeufe) * (1 - ALLES_PUFFER_ANTEIL));
  else transferGesamt = gesamtBei(q0, verkaeufe) + (lockerungAktiv ? mehrFrei : 0);

  // Umschichten (Konzept 3): 1 C Transfer <-> 1 C Jahresgehalt, begrenzt am Gehaltstopf.
  const grenzeAnteil = alle ? UMSCHICHT_GRENZE_ANTEIL[1]! : (UMSCHICHT_GRENZE_ANTEIL[q0] ?? 0.25);
  const grenze = gedeckelt ? grenzeAnteil * gehaltBudget0 : 0;
  const haelfteSicherheit = 0.5 * (ruecklageZiel + gehaltspuffer);
  const maxHinZuGehalt = grenze;
  const maxHinZuTransfer = Math.min(grenze, haelfteSicherheit);
  const umschicht = gedeckelt ? Math.max(-maxHinZuTransfer, Math.min(maxHinZuGehalt, zustand.umschichtung)) : 0;
  transferGesamt -= umschicht;

  let transferFrei = Math.max(0, Math.min(cash, transferGesamt - ausgegebenTransfer));
  if (gedeckelt && lockerungAktiv && !alle) transferFrei = Math.min(transferFrei, Math.max(0, cash - boden));
  if (gedeckelt && alle) {
    transferFrei = Math.min(transferFrei, Math.max(0, cash - ALLES_PUFFER_ANTEIL * (Math.max(0, anfangskasse) + verkaeufe)));
  }
  const gesperrt = Math.max(0, cash - transferFrei);
  const prozent = Math.round(wirksamerAnteil * 100);
  const grund = !gedeckelt
    ? freigabe.grund === "abgeschaltet"
      ? "Budgetfreigabe ist abgeschaltet: das gesamte Budget ist frei."
      : "Saison 1: der Vorstand gibt das gesamte Budget frei."
    : alle
      ? `Alles auf eine Karte: bis auf ${Math.round(ALLES_PUFFER_ANTEIL * 100)} % Puffer darf alles ausgegeben werden.`
      : freigabe.grund === "vertrauen"
        ? `Vorstandsvertrauen ${freigabe.vertrauen!.toFixed(1)} (${freigabe.stufe}): ${prozent} % des Budgets sind zum Ausgeben freigegeben, der Rest bleibt als Puffer auf dem Konto.`
        : "Kein Vertrauenswert vorhanden: der Vorstand gibt das gesamte Budget frei.";

  // Gehaltstopf.
  const gehaltGesamt = gedeckelt ? gehaltBudget0 + umschicht : Math.max(basis, gehaltsSumme);
  let gehaltFrei = Math.max(0, gehaltGesamt - gehaltsSumme);
  const gehaltGrund = !gedeckelt
    ? "Saison 1: Gehaltsbudget voll freigegeben."
    : gehaltsQuote >= 1
      ? "Gehaltsbudget voll freigegeben."
      : `Gehaltsbudget auf ${Math.round(gehaltsQuote * 100)} % gekürzt (nie unter 75 %); frei werdendes Gehalt aus Verkäufen kommt zu 100 % zurueck.`;

  // Kaderpflicht-Freigabe (Chris 18.11.): Geld da, aber nicht freigegeben, waehrend das Team das Minimum nicht erreicht oder sich dem Opt
  // nicht naehern kann, ist ein Notfall: der Rahmen ist dann nie kleiner als die Kosten dieser Plaetze (Platzpreis, Ablose UND Gehalt).
  const kaderIst = gameState.rosters.filter((r) => r.teamId === teamId).length;
  const kaderMin = Math.max(VORSTAND_PFLICHT_KADER, identity?.playerMin ?? 0);
  const kaderOpt = Math.max(kaderMin, identity?.playerOpt ?? kaderMin);
  const platz = gedeckelt ? platzPreisAusMarkt(gameState) : { fee: 0, salary: 0 };
  const zuschlag = gedeckelt
    ? kaderpflichtZuschlag({ kaderIst, kaderMin, kaderOpt, platzAbloese: platz.fee, platzGehalt: platz.salary, cash, notruecklage: ruecklageErg.ruecklage })
    : { abloese: 0, gehalt: 0 };
  const basisFreiAbloese = transferFrei;
  const basisFreiGehalt = gehaltFrei;
  const kpAbloese = Math.max(0, zuschlag.abloese - basisFreiAbloese);
  const kpGehalt = Math.max(0, zuschlag.gehalt - basisFreiGehalt);
  if (kpAbloese > 0.004) {
    transferFrei = Math.min(cash, transferFrei + kpAbloese);
    transferGesamt += kpAbloese;
  }
  if (kpGehalt > 0.004) gehaltFrei += kpGehalt;
  const kaderpflichtAktiv = kpAbloese > 0.004 || kpGehalt > 0.004;
  const kaderpflichtText = kaderpflichtAktiv
    ? `Kaderpflicht: Vorstand gibt ${zahlText(kpAbloese)} C frei (Kader ${kaderIst}/${kaderIst < kaderMin ? kaderMin : kaderOpt})`
    : null;

  return {
    getrennt: true,
    gedeckelt,
    kaderpflicht: {
      aktiv: kaderpflichtAktiv,
      kaderIst,
      kaderMin,
      kaderOpt,
      platzAbloese: r2(platz.fee),
      platzGehalt: r2(platz.salary),
      zuschlagAbloese: r2(kpAbloese),
      zuschlagGehalt: r2(kpGehalt),
      basisFreiAbloese: r2(basisFreiAbloese),
      basisFreiGehalt: r2(basisFreiGehalt),
      notruecklage: r2(ruecklageErg.ruecklage),
      text: kaderpflichtText,
    },
    investition: {
      gesamt: r2(transferGesamt),
      ausgegeben: r2(ausgegebenTransfer),
      frei: r2(transferFrei),
      gesperrt: r2(gesperrt),
      quote: wirksamerAnteil,
      grund,
    },
    gehalt: {
      gesamt: r2(gehaltGesamt + kpGehalt),
      ausgegeben: r2(gehaltsSumme),
      frei: r2(gehaltFrei),
      gesperrt: r2(Math.max(0, basis - gehaltBudget0)),
      quote: gehaltsQuote,
      grund: gehaltGrund,
    },
    teamId,
    stufe: freigabe.stufe,
    anteil: freigabe.anteil,
    wirksamerAnteil,
    vertrauen: freigabe.vertrauen,
    freigegebenGesamt: r2(transferGesamt),
    ausgegeben: r2(ausgegebenTransfer),
    nochFrei: r2(transferFrei),
    gesperrt: r2(gesperrt),
    gebaeudeAusgegeben: r2(gebaeude),
    grund,
    herleitung: {
      anfangskasse: r2(anfangskasse),
      ruecklageZiel: r2(ruecklageZiel),
      finanzwert: ruecklageErg.finanzwert,
      ruecklageQuote: ruecklageErg.quote,
      gehaltspuffer: r2(gehaltspuffer),
      verfuegbar: r2(verfuegbar),
      verkaufserloese: r2(verkaeufe),
      angezapft: r2(angezapft),
      sponsorErwartung: r2(sponsor),
      zielgehalt: r2(zielgehalt),
      tragbaresGehalt: r2(basis),
      gehaltsbudgetVorUmschichten: r2(gehaltBudget0),
    },
    umschichten: {
      aktuell: r2(umschicht),
      grenze: r2(grenze),
      grenzeAnteil,
      moeglichVon: r2(-maxHinZuTransfer),
      moeglichBis: r2(maxHinZuGehalt),
    },
    lockerung: {
      vonAnteil: q0,
      nachAnteil: q1,
      aktiv: lockerungAktiv,
      puffer: r2(puffer),
      schwelle: r2(schwelle),
      verkaufserloese: r2(verkaeufe),
      einbehalten: r2(einbehalten),
      fehlt: r2(Math.max(0, schwelle - verkaeufe)),
      mehrFrei: r2(mehrFrei),
      boden: r2(boden),
      gesperrtGrund: lockerungSperre,
    },
    ruecklageAnzapfen: {
      moeglich: r2(Math.max(0, anzapfenMax - angezapft)),
      bereitsAngezapft: r2(angezapft),
      vertrauenskosten: r2(zustand.vertrauensKosten),
    },
    alleAufEineKarte: { aktiv: alle, puffer: ALLES_PUFFER_ANTEIL, zustand: zustand.alleAufEineKarte },
    zustand,
  };
}

/**
 * Messung (nur mit `OLY_SPERRE_ZAEHLEN=1`, sonst kein Aufwand): wie oft greift die harte Sperre, je Art und Team.
 * Gezaehlt werden ABGELEHNTE PRUEFUNGEN, nicht Kaufversuche: die KI prueft dieselbe Abloese in mehreren Vorschauen.
 */
export const SPERRE_ZAEHLER: Record<"kauf" | "kauf_gehalt" | "gebaeude" | "verlaengerung", Record<string, number>> = {
  kauf: {},
  kauf_gehalt: {},
  gebaeude: {},
  verlaengerung: {},
};

function zaehleSperre(art: keyof typeof SPERRE_ZAEHLER, teamId: string): void {
  if (process.env.OLY_SPERRE_ZAEHLEN !== "1") return;
  SPERRE_ZAEHLER[art][teamId] = (SPERRE_ZAEHLER[art][teamId] ?? 0) + 1;
}


export type KaufRahmen = {
  gedeckelt: boolean;
  /** Was der Investitionstopf noch fuer Abloesen frei hat, inkl. Kaderpflicht-Freigabe (Infinity, wenn nicht gedeckelt). */
  abloeseFrei: number;
  /** Was der Gehaltstopf noch fuer Jahresgehaelter frei hat, inkl. Kaderpflicht-Freigabe (Infinity, wenn nicht gedeckelt). */
  gehaltFrei: number;
  /**
   * Die Grenze fuer den NAECHSTEN Kauf, wenn schon `spentFee` / `spentSalary` ausgegeben wurden und der Kader `rosterBefore` hat:
   * der Rahmen nach Quote (abzueglich Ausgaben) oder die Kaderpflicht-Freigabe fuer die dann fehlenden Plaetze, was groesser ist.
   * Planer rechnen damit laufend; die Sperre im Kaufweg rechnet mit demselben Ergebnis auf dem echten Stand.
   */
  grenzeFuer: (rosterBefore: number, spentFee: number, spentSalary: number) => { fee: number; salary: number };
  stand: VorstandBudgetStand;
};

/**
 * DIE EINE ZAHL fuer Planung UND Sperre (Chris 18.11.: Planer und Pruefung rechneten frueher mit verschiedenen Zahlen).
 * Jeder KI-Planer holt seinen Kaufrahmen hier, und die harte Sperre im Kaufweg prueft gegen dieselbe Funktion.
 */
export function kaufRahmen(gameState: GameState, teamId: string): KaufRahmen {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (!stand.gedeckelt) {
    return { gedeckelt: false, abloeseFrei: Infinity, gehaltFrei: Infinity, grenzeFuer: () => ({ fee: Infinity, salary: Infinity }), stand };
  }
  const kp = stand.kaderpflicht;
  const cash = gameState.teams.find((t) => t.teamId === teamId)?.cash ?? 0;
  return {
    gedeckelt: true,
    abloeseFrei: stand.investition.frei,
    gehaltFrei: stand.gehalt.frei,
    grenzeFuer: (rosterBefore, spentFee, spentSalary) => {
      const z = kaderpflichtZuschlag({
        kaderIst: rosterBefore,
        kaderMin: kp.kaderMin,
        kaderOpt: kp.kaderOpt,
        platzAbloese: kp.platzAbloese,
        platzGehalt: kp.platzGehalt,
        cash: cash - spentFee,
        notruecklage: kp.notruecklage,
      });
      return {
        fee: Math.max(kp.basisFreiAbloese - spentFee, z.abloese),
        salary: Math.max(kp.basisFreiGehalt - spentSalary, z.gehalt),
      };
    },
    stand,
  };
}

/**
 * Harte Pruefung eines Kaufs: Abloese in den Investitionstopf, Jahresgehalt in den Gehaltstopf.
 * Kaeufe, die ein Team auf den Pflichtkader (8) bringen, sind nie gesperrt; sie zaehlen gegen den Topf und duerfen ihn ueberziehen.
 */
export function pruefeKaufGegenVorstandFreigabe(
  gameState: GameState,
  teamId: string,
  input: { fee: number; salary: number; rosterBefore: number; playerMin: number | null },
): { ok: boolean; reason: string | null; stand: VorstandBudgetStand } {
  const rahmen = kaufRahmen(gameState, teamId);
  const stand = rahmen.stand;
  if (!rahmen.gedeckelt) return { ok: true, reason: null, stand };
  if (input.rosterBefore < VORSTAND_PFLICHT_KADER) return { ok: true, reason: null, stand };
  const grenze = rahmen.grenzeFuer(input.rosterBefore, 0, 0);
  if (input.fee > Math.max(rahmen.abloeseFrei, grenze.fee) + 1e-9) {
    zaehleSperre("kauf", teamId);
    return { ok: false, reason: "vorstand_transferbudget_nicht_freigegeben", stand };
  }
  if (Math.max(0, input.salary) > Math.max(rahmen.gehaltFrei, grenze.salary) + 1e-9) {
    zaehleSperre("kauf_gehalt", teamId);
    return { ok: false, reason: "vorstand_gehaltsbudget_nicht_freigegeben", stand };
  }
  return { ok: true, reason: null, stand };
}

/**
 * Harte Pruefung eines Gebaeudes (Bau oder Ausbau): die Kosten kommen aus dem Investitionstopf, kein dritter Topf.
 * In der Sparauflage (Stufe 50 %) gibt der Vorstand keine Gebaeude frei, ausser mit „Alles auf eine Karte“.
 */
export function pruefeGebaeudeGegenVorstandFreigabe(
  gameState: GameState,
  teamId: string,
  kosten: number,
): { ok: boolean; reason: string | null; stand: VorstandBudgetStand } {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (!stand.gedeckelt || !(kosten > 0)) return { ok: true, reason: null, stand };
  if (stand.stufe === "sparauflage" && !stand.alleAufEineKarte.aktiv) {
    zaehleSperre("gebaeude", teamId);
    return { ok: false, reason: "vorstand_gebaeude_sparauflage", stand };
  }
  if (kosten > stand.investition.frei + 1e-9) {
    zaehleSperre("gebaeude", teamId);
    return { ok: false, reason: "vorstand_transferbudget_nicht_freigegeben", stand };
  }
  return { ok: true, reason: null, stand };
}

/**
 * Harte Pruefung einer Gehaltserhoehung bei der Vertragsverlaengerung: nur die Erhoehung zaehlt gegen den freien
 * Gehaltstopf (das alte Gehalt steht schon in `ausgegeben`). Gleiches oder niedrigeres Gehalt geht immer.
 */
export function pruefeVerlaengerungGegenVorstandFreigabe(
  gameState: GameState,
  teamId: string,
  input: { altesGehalt: number; neuesGehalt: number },
): { ok: boolean; reason: string | null; stand: VorstandBudgetStand } {
  const erhoehung = input.neuesGehalt - input.altesGehalt;
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (!stand.gedeckelt || !(erhoehung > 1e-9)) return { ok: true, reason: null, stand };
  if (erhoehung > stand.gehalt.frei + 1e-9) {
    zaehleSperre("verlaengerung", teamId);
    return { ok: false, reason: "vorstand_gehaltsbudget_nicht_freigegeben", stand };
  }
  return { ok: true, reason: null, stand };
}

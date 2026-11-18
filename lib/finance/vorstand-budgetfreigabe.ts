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
 * Nicht erfasst: Gehaltserhoehungen bei Verlaengerungen, Gebaeudekaeufe (Zwei-Budget-Bau danach) und die UI.
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { projectSalaryAtPlannerTarget } from "@/lib/ai/salary-projection";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";

/** Untergrenze der Gehalts-Quote (Chris 18.11.: der Vorstand kuerzt das Gehaltsbudget hoechstens auf 75 %). */
export const GEHALTS_QUOTE_UNTERGRENZE = 0.75;

export type VorstandStufe = "hoch" | "mittel" | "niedrig" | "sparauflage";

export const VORSTAND_STUFEN: ReadonlyArray<{ stufe: VorstandStufe; abVertrauen: number; anteil: number }> = [
  { stufe: "hoch", abVertrauen: 6, anteil: 1.0 },
  { stufe: "mittel", abVertrauen: 4, anteil: 0.85 },
  { stufe: "niedrig", abVertrauen: 2.5, anteil: 0.7 },
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
  const wert = gameState.seasonState.boardConfidence?.[teamId]?.value;
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    return { teamId, stufe: "hoch", anteil: 1, vertrauen: null, grund: "ohne_vertrauenswert" };
  }
  const { stufe, anteil } = stufeFuerVertrauen(wert);
  return { teamId, stufe, anteil, vertrauen: wert, grund: "vertrauen" };
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

export type VorstandBudgetStand = {
  /** Zwei getrennte Toepfe (Zwei-Budget-Modell). */
  getrennt: boolean;
  /** Transfer-/Investitionstopf (Abloesen). */
  investition: VorstandTopf;
  /** Gehaltstopf (Jahresgehaelter). */
  gehalt: VorstandTopf;
  teamId: string;
  stufe: VorstandStufe;
  /** Transfer-Quote (Vertrauensquote). */
  anteil: number;
  /** Kurzformen des Investitionstopfs (Transfermarkt und Spielerprofil). */
  freigegebenGesamt: number;
  ausgegeben: number;
  nochFrei: number;
  gesperrt: number;
  /** Ein Satz: warum diese Zahlen. */
  grund: string;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Die Zahlen fuer Transfermarkt und Spielerprofil. Fuer KI und Mensch dieselbe Funktion. */
export function berechneVorstandBudgetStand(gameState: GameState, teamId: string): VorstandBudgetStand {
  const freigabe = resolveVorstandFreigabe(gameState, teamId);
  const cash = gameState.teams.find((t) => t.teamId === teamId)?.cash ?? 0;
  const seasonId = gameState.season.id;
  let kaeufe = 0;
  let verkaeufe = 0;
  for (const e of gameState.transferHistory ?? []) {
    if (e.seasonId !== seasonId) continue;
    if (e.transferType === "buy" && e.toTeamId === teamId) kaeufe += e.netCashImpact ?? e.fee;
    else if (e.transferType === "sell" && e.fromTeamId === teamId) verkaeufe += e.netCashImpact ?? e.fee;
  }
  const anfangskasse = cash + kaeufe - verkaeufe;
  const transferGesamt = freigabe.anteil * (anfangskasse + verkaeufe);
  const nochFrei = Math.max(0, Math.min(cash, transferGesamt - kaeufe));
  const gesperrt = Math.max(0, cash - nochFrei);
  const prozent = Math.round(freigabe.anteil * 100);
  const grund =
    freigabe.grund === "vertrauen"
      ? `Vorstandsvertrauen ${freigabe.vertrauen!.toFixed(1)} (${freigabe.stufe}): ${prozent} % des Budgets sind zum Ausgeben freigegeben, der Rest bleibt als Puffer auf dem Konto.`
      : freigabe.grund === "saison_1"
        ? "Saison 1: der Vorstand gibt das gesamte Budget frei."
        : freigabe.grund === "abgeschaltet"
          ? "Budgetfreigabe ist abgeschaltet: das gesamte Budget ist frei."
          : "Kein Vertrauenswert vorhanden: der Vorstand gibt das gesamte Budget frei.";

  // Gehaltstopf: Quote nie unter 75 %. Bei Quote 100 % bleibt alles frei.
  const gehaltsQuote = freigabe.anteil >= 1 ? 1 : Math.max(GEHALTS_QUOTE_UNTERGRENZE, freigabe.anteil);
  const gehaltsSumme = gameState.rosters.filter((r) => r.teamId === teamId).reduce((x, r) => x + (r.salary ?? 0), 0);
  let gehaltsBasis = gehaltsSumme;
  if (gehaltsQuote < 1) {
    const zielgehalt = projectSalaryAtPlannerTarget({ gameState, teamId, currentSalary: gehaltsSumme });
    gehaltsBasis = Math.max(erwarteterSponsorFuerPlanung(gameState, teamId), zielgehalt);
  }
  const gehaltGesamt = gehaltsQuote >= 1 ? Math.max(gehaltsBasis, gehaltsSumme) : gehaltsQuote * gehaltsBasis;
  const gehaltFrei = Math.max(0, gehaltGesamt - gehaltsSumme);
  const gehaltGrund =
    gehaltsQuote >= 1
      ? "Gehaltsbudget voll freigegeben."
      : `Gehaltsbudget auf ${Math.round(gehaltsQuote * 100)} % gekuerzt (nie unter 75 %); frei werdendes Gehalt aus Verkaeufen kommt zu 100 % zurueck.`;

  return {
    getrennt: true,
    investition: { gesamt: r2(transferGesamt), ausgegeben: r2(kaeufe), frei: r2(nochFrei), gesperrt: r2(gesperrt), quote: freigabe.anteil, grund },
    gehalt: {
      gesamt: r2(gehaltGesamt),
      ausgegeben: r2(gehaltsSumme),
      frei: r2(gehaltFrei),
      gesperrt: r2(Math.max(0, gehaltsBasis - gehaltGesamt)),
      quote: gehaltsQuote,
      grund: gehaltGrund,
    },
    teamId,
    stufe: freigabe.stufe,
    anteil: freigabe.anteil,
    freigegebenGesamt: r2(transferGesamt),
    ausgegeben: r2(kaeufe),
    nochFrei: r2(nochFrei),
    gesperrt: r2(gesperrt),
    grund,
  };
}

/** Harte Pruefung eines Kaufs: Abloese in den Investitionstopf, Jahresgehalt in den Gehaltstopf. */
export function pruefeKaufGegenVorstandFreigabe(
  gameState: GameState,
  teamId: string,
  input: { fee: number; salary: number; rosterBefore: number; playerMin: number | null },
): { ok: boolean; reason: string | null; stand: VorstandBudgetStand } {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (stand.anteil >= 1) return { ok: true, reason: null, stand };
  if (input.rosterBefore < (input.playerMin ?? 8)) return { ok: true, reason: null, stand };
  if (input.fee > stand.investition.frei + 1e-9) return { ok: false, reason: "vorstand_transferbudget_nicht_freigegeben", stand };
  if (stand.gehalt.quote < 1 && Math.max(0, input.salary) > stand.gehalt.frei + 1e-9) {
    return { ok: false, reason: "vorstand_gehaltsbudget_nicht_freigegeben", stand };
  }
  return { ok: true, reason: null, stand };
}

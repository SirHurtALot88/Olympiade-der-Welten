/**
 * Finanzkonzept V2, Stufe 3: Der Vorstand gibt Budget frei — er nimmt nichts weg und straft kein Geld.
 *
 * Chris am 18.11. (verbindlich):
 *  - Das Geld bleibt auf dem Konto. Freigegeben sind nur X % zum AUSGEBEN, fuer Abloesen UND Gehaelter
 *    (neue Vertraege); Vorbild Transfer- und Gehaltsbudget im Football Manager.
 *  - Die Sperre ist HART: ein Kauf ueber der Freigabe ist nicht moeglich (Mensch und KI gleich).
 *  - Verkaufserloese unterliegen derselben Quote: bei 70 % werden von 20 C nur 14 C frei, 6 C bleiben als Puffer.
 *  - Die Ruecklage nach Finanzwert (Stufe 1) bleibt weich; nur die Freigabe ist hart.
 *
 * Vertrauen = `seasonState.boardConfidence[teamId].value` (1 bis 10, Neutral 5; vorhandenes Board-System).
 *
 *   ab 6 -> 100 %   hoch      4 bis unter 6 -> 85 %   mittel
 *   2,5 bis unter 4 -> 70 %   niedrig      darunter -> 50 %   Sparauflage
 *
 * Saison 1 gibt immer 100 % frei (kein Vorjahr, Board neutral, kein Misserfolg, auf den der Vorstand reagieren koennte).
 *
 * Rechnung ohne neuen Speicher, aus dem Transferverlauf der laufenden Saison:
 *   Anfangskasse   = Kasse + Kaeufe(Ablose) - Verkaufserloese (Netto)            (Stand vor dem ersten Kauf/Verkauf)
 *   freigegeben    = Anteil x (Anfangskasse + Verkaufserloese)                   (Verkaeufe zaehlen mit derselben Quote)
 *   ausgegeben     = Ablosen der Kaeufe + Jahresgehalt der in dieser Saison neu verpflichteten Spieler
 *   noch frei      = max(0, freigegeben - ausgegeben), nie mehr als die Kasse
 *   gesperrt       = Kasse - noch frei  (auf dem Konto, aber nicht ausgebbar)
 *
 * Ausnahme: unter dem Kader-Minimum (8) gilt die Sperre nicht — ein spielfaehiger Kader geht vor.
 * Nicht erfasst: Gehaltserhoehungen bei Verlaengerungen (Vertragsverlaengerung bucht ueber einen anderen Pfad).
 */

import type { GameState } from "@/lib/data/olyDataTypes";

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

/** Ein Topf der Freigabe. Heute traegt `investition` die gemeinsame Freigabe, `gehalt` ist ein leerer Platzhalter. */
export type VorstandTopf = {
  gesamt: number;
  ausgegeben: number;
  frei: number;
  gesperrt: number;
  grund: string;
};

export type VorstandBudgetStand = {
  /**
   * Vorbereitung auf zwei getrennte Toepfe (Chris: Football-Manager-Modell, noch nicht entschieden).
   * Heute: gemeinsame Freigabe. `investition` = Gesamtzahlen (Abloesen UND Gehaelter zaehlen dagegen),
   * `gehalt` = leer und nur Platzhalter; `getrennt: false` sagt das ausdruecklich.
   */
  getrennt: boolean;
  investition: VorstandTopf;
  gehalt: VorstandTopf;
  teamId: string;
  stufe: VorstandStufe;
  anteil: number;
  /** Freigegeben gesamt (C): Anteil x (Anfangskasse + Verkaufserloese). */
  freigegebenGesamt: number;
  /** Davon schon ausgegeben (Ablosen + Jahresgehaelter neuer Vertraege). */
  ausgegeben: number;
  /** Noch frei zum Ausgeben (hoechstens die Kasse). */
  nochFrei: number;
  /** Auf dem Konto, aber nicht ausgebbar (Kasse minus noch frei). */
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
  let gehaelter = 0;
  for (const e of gameState.transferHistory ?? []) {
    if (e.seasonId !== seasonId) continue;
    if (e.transferType === "buy" && e.toTeamId === teamId) {
      kaeufe += e.netCashImpact ?? e.fee;
      gehaelter += e.salary ?? 0;
    } else if (e.transferType === "sell" && e.fromTeamId === teamId) {
      verkaeufe += e.netCashImpact ?? e.fee;
    }
  }
  const anfangskasse = cash + kaeufe - verkaeufe;
  const freigegebenGesamt = freigabe.anteil * (anfangskasse + verkaeufe);
  const ausgegeben = kaeufe + gehaelter;
  const nochFrei = Math.max(0, Math.min(cash, freigegebenGesamt - ausgegeben));
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
  return {
    getrennt: false,
    investition: { gesamt: r2(freigegebenGesamt), ausgegeben: r2(ausgegeben), frei: r2(nochFrei), gesperrt: r2(gesperrt), grund },
    gehalt: {
      gesamt: 0, ausgegeben: 0, frei: 0, gesperrt: 0,
      grund: "Noch kein eigener Gehaltstopf: Jahresgehaelter neuer Vertraege zaehlen gegen die gemeinsame Freigabe oben.",
    },
    teamId,
    stufe: freigabe.stufe,
    anteil: freigabe.anteil,
    freigegebenGesamt: r2(freigegebenGesamt),
    ausgegeben: r2(ausgegeben),
    nochFrei: r2(nochFrei),
    gesperrt: r2(gesperrt),
    grund,
  };
}

/** Harte Pruefung eines Kaufs: Ablose + Jahresgehalt muessen in das noch freie Budget passen. */
export function pruefeKaufGegenVorstandFreigabe(
  gameState: GameState,
  teamId: string,
  input: { fee: number; salary: number; rosterBefore: number; playerMin: number | null },
): { ok: boolean; reason: string | null; stand: VorstandBudgetStand } {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (stand.anteil >= 1) return { ok: true, reason: null, stand };
  if (input.rosterBefore < (input.playerMin ?? 8)) return { ok: true, reason: null, stand };
  const kosten = input.fee + Math.max(0, input.salary);
  if (kosten <= stand.nochFrei + 1e-9) return { ok: true, reason: null, stand };
  return { ok: false, reason: "vorstand_budget_nicht_freigegeben", stand };
}

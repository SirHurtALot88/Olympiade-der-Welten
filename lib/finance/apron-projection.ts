/**
 * APRON-HOCHRECHNUNG — der Apron, wie er beim AKTUELLEN Rang ausfiele.
 *
 * GEMELDET VON CHRIS: „Der Apron gehört als Hochrechnung in den GuV-Hover."
 *
 * Der Einwand dagegen trug nur zur Hälfte: die Gehälter stehen zwar fest, aber Deckel und
 * Ausschüttung hängen am ENDRANG, den es mitten in der Saison noch nicht gibt. Genau dieselbe
 * Einschränkung hat aber die Sponsor-Zeile im selben Hover, und die steht dort seit jeher mit dem
 * Zusatz „beim aktuellen Rang". Also wird der Apron genauso ausgewiesen: auf den heutigen Rang
 * hochgerechnet und als Hochrechnung benannt, nicht als Tatsache.
 *
 * WAS HIER NICHT NEU GERECHNET WIRD: die gesamte Arithmetik kommt unverändert aus
 * `lib/season/apron-service.ts` — dieselbe Funktion, die am Saisonende die echten Cash-Buchungen
 * bestimmt (`previewApronSettlement`). Diese Datei ist nur die Verdrahtung für die Anzeige und
 * unterscheidet sich vom Saisonende-Aufrufer in genau einem Punkt: der Rang kommt von aussen
 * (die Standings-Tabelle hat ihn bereits) statt aus einem zweiten `buildTeamSeasonOverviewRows`-
 * Durchlauf. Käme die Zahl aus einer eigenen Rechnung, zeigte der Hover mitten in der Saison eine
 * Vorhersage, die die Abrechnung am Saisonende nicht einlöst.
 *
 * BEMESSUNGSGRUNDLAGE ist bewusst NICHT die Gehaltsspalte der Standings-Tabelle: die zeigt die
 * echte, front-/back-loaded Vertragssumme (`resolvePlayerEconomyContract().salary`), der Apron
 * rechnet dagegen auf der geglätteten (`getTeamDisplaySalaryTotal`, siehe Kopfkommentar in
 * apron-service.ts). Die beiden dürfen weit auseinanderliegen — im dort dokumentierten Save 97,7
 * gegen 83,3. Würde die Hochrechnung die Tabellenspalte lesen, stünde im Hover eine Abgabe, die
 * die echte Abrechnung nicht bestätigt. Deshalb nennt `salary` unten ausdrücklich die geglättete
 * Zahl, und der Hover schreibt sie mit dazu.
 *
 * React-frei und ohne IO (bis auf das lesende GameState-Argument): die Herleitung ist ohne
 * Rendering prüfbar.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  apronWertungsanteil,
  computeApronLines,
  computeApronSettlement,
  type ApronLines,
} from "@/lib/season/apron-service";

/** Anzahl der Ligaplätze, mit denen `apronWertungsanteil` bei unbekanntem Rang rechnet — letzter Platz. */
const APRON_FALLBACK_RANK = 32;

export type ApronProjectionTeamRow = {
  teamId: string;
  /** Rang, auf den hochgerechnet wurde (`null` = unbekannt, dann letzter Platz angenommen). */
  rank: number | null;
  /** GEGLÄTTETE Gehaltssumme — die Bemessungsgrundlage des Apron, nicht die Tabellenspalte. */
  salary: number;
  /** Abgabe (positiver Betrag; 0 = zahlt nicht). */
  abgabe: number;
  /** Anteil am ausgeschütteten Topf (0 = kein Empfänger). */
  ausgleich: number;
  /** `ausgleich − abgabe` — das, was am Saisonende aufs Cash ginge. */
  nettoDelta: number;
  /** `true`, wenn der Deckel (halber Wertungsanteil) die Abgabe begrenzt hat. */
  gedeckelt: boolean;
};

export type ApronProjection = {
  lines: ApronLines;
  /**
   * `true` = die zu Saisonbeginn EINGEFRORENEN Linien (der Normalfall, und die, gegen die am
   * Saisonende wirklich abgerechnet wird). `false` = kein Snapshot für diese Saison vorhanden,
   * die Linien wurden aus dem aktuellen Gehaltsstand abgeleitet — dann kann sich die Grenze bis
   * zum Saisonende noch verschieben, und der Hover sagt das.
   */
  frozenLines: boolean;
  salaryFactor: number;
  topf: number;
  zahlerCount: number;
  empfaengerCount: number;
  byTeamId: Map<string, ApronProjectionTeamRow>;
};

function getCurrentSalaryFactor(gameState: GameState): number {
  const factor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/**
 * Baut die Hochrechnung für ALLE Teams auf einmal. Das ist keine Bequemlichkeit, sondern
 * notwendig: Topf und Ausschüttung eines Teams hängen daran, was die anderen 31 zahlen und wie
 * viele unter der 1. Linie liegen — eine Hochrechnung „nur für dieses eine Team" gibt es nicht.
 *
 * Fehlt der Rang eines Teams, wird wie am Saisonende der letzte Platz angenommen (dort:
 * `finalRank ?? 32`). Das ist die konservative Richtung — kleinster Wertungsanteil, also
 * niedrigster Deckel, also eher zu wenig Abgabe als zu viel.
 */
export function buildApronProjection(input: {
  gameState: GameState;
  /** Aktueller Ligarang je Team — aus der bereits gebauten Standings-Tabelle. */
  rankByTeamId: Map<string, number | null>;
}): ApronProjection {
  const { gameState } = input;
  const snapshot = gameState.seasonState.apronLinesSnapshot;
  const frozenLines = snapshot?.seasonId === gameState.season.id;
  // Dieselbe Reihenfolge wie in `ai-cash-salary-target-service.ts`: eingefrorene Linien, sonst
  // die aus dem aktuellen Stand abgeleiteten. Ohne Snapshot gar nichts zu zeigen wäre die
  // Alternative — dann bliebe der Hover in Season 1 vor dem ersten Einfrieren leer, obwohl die
  // Grenze rechnerisch längst bestimmbar ist.
  const lines: ApronLines = frozenLines && snapshot ? snapshot : computeApronLines(gameState);
  const salaryFactor = getCurrentSalaryFactor(gameState);

  const teams = gameState.teams.map((team) => ({
    teamId: team.teamId,
    salary: getTeamDisplaySalaryTotal(gameState, team.teamId),
    rankShare: apronWertungsanteil(input.rankByTeamId.get(team.teamId) ?? APRON_FALLBACK_RANK, salaryFactor),
  }));

  const settlement = computeApronSettlement({ lines, salaryFactor, teams });

  return {
    lines,
    frozenLines,
    salaryFactor,
    topf: settlement.topf,
    zahlerCount: settlement.zahlerCount,
    empfaengerCount: settlement.empfaengerCount,
    byTeamId: new Map(
      settlement.rows.map((row) => [
        row.teamId,
        {
          teamId: row.teamId,
          rank: input.rankByTeamId.get(row.teamId) ?? null,
          salary: row.salary,
          abgabe: row.abgabe,
          ausgleich: row.ausgleich,
          nettoDelta: row.nettoDelta,
          // Der Deckel hat gegriffen, sobald er die (positive) Rohabgabe wirklich beschnitten
          // hat. Gleichstand zählt nicht als gedeckelt — sonst meldete jede Abgabe von exakt 0
          // einen greifenden Deckel.
          gedeckelt: row.rohAbgabe > row.deckel + 0.005 && row.rohAbgabe > 0,
        },
      ]),
    ),
  };
}

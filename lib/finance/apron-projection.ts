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
 * rechnet dagegen auf dem VERHANDELTEN Jahresgehalt (`getTeamApronSalaryBase`, siehe Kopfkommentar
 * in apron-service.ts). Die beiden dürfen weit auseinanderliegen — ein geformter Vertrag zahlt in
 * Jahr 1 bis zu 30 % über seinem Jahresgehalt. Würde die Hochrechnung die Tabellenspalte lesen,
 * stünde im Hover eine Abgabe, die die echte Abrechnung nicht bestätigt. Deshalb nennt `salary`
 * unten ausdrücklich die Bemessungsgrundlage, und der Hover schreibt sie mit dazu.
 *
 * React-frei und ohne IO (bis auf das lesende GameState-Argument): die Herleitung ist ohne
 * Rendering prüfbar.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

import {
  apronKonjunkturhebel,
  apronWertungsanteil,
  areSeasonApronLinesFrozen,
  computeApronSettlement,
  resolveSeasonApronLines,
  resolveApronSalaryFactor,
  type ApronLines,
  getTeamApronSalaryBase,
} from "@/lib/season/apron-service";

/** Anzahl der Ligaplätze, mit denen `apronWertungsanteil` bei unbekanntem Rang rechnet — letzter Platz. */
const APRON_FALLBACK_RANK = 32;

export type ApronProjectionTeamRow = {
  teamId: string;
  /** Rang, auf den hochgerechnet wurde (`null` = unbekannt, dann letzter Platz angenommen). */
  rank: number | null;
  /** VERHANDELTE Gehaltssumme — die Bemessungsgrundlage des Apron, nicht die Tabellenspalte. */
  salary: number;
  /** Abgabe (positiver Betrag; 0 = zahlt nicht). */
  abgabe: number;
  /** Anteil am ausgeschütteten Topf (0 = kein Empfänger). */
  ausgleich: number;
  /** `ausgleich − abgabe` — das, was am Saisonende aufs Cash ginge. */
  nettoDelta: number;
  /** `true`, wenn der Deckel (halber Wertungsanteil) die Abgabe begrenzt hat. */
  gedeckelt: boolean;
  /** Empfangsberechtigt (unter der 1. Linie) — durchgereicht aus `computeApronSettlement`. */
  empfaenger: boolean;
};

export type ApronProjection = {
  lines: ApronLines;
  /**
   * `true` = das Kauffenster ist zu (Transfers finalisiert oder erster Spieltag abgerechnet), die
   * Linien stehen fest, und genau gegen sie wird am Saisonende gebucht. `false` = die Saison läuft
   * noch im Kaderbau (KI-Vorsaisonkäufe, Spieler-Picks, organische Nachkäufe); die Linien wandern
   * so lange mit dem Median mit, und der Hover sagt das.
   */
  frozenLines: boolean;
  salaryFactor: number;
  /**
   * k(f) aus `apronKonjunkturhebel` — 0 bis 1. Steht hier, weil er die häufigste Erklärung für eine
   * Abgabe von exakt 0 ist: unter einem Salary Factor von 0,95 ist die Abgabe der ganzen Saison
   * abgeschaltet, ganz gleich wie weit ein Team über den Linien liegt. Ohne diese Zahl in der
   * Anzeige liest sich die 0 wie ein Fehler (gemessen an Chris' Spielstand vom 13.08.: f = 0,84,
   * k = 0, also 0 Abgabe für alle 32 Teams — bei Gehältern bis 99,3 gegen eine 2. Linie von 81,0).
   */
  konjunkturhebel: number;
  topf: number;
  zahlerCount: number;
  empfaengerCount: number;
  byTeamId: Map<string, ApronProjectionTeamRow>;
};

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
  // Eine Quelle für „welche Linie gilt gerade": eingefroren ab dem ersten abgerechneten Spieltag,
  // davor am aktuellen Median. Vorher stand hier (und in `ai-cash-salary-target-service.ts`)
  // dieselbe Auswahl doppelt und ohne die Aufbauphase-Regel — die Anzeige zeigte während des
  // Kaderbaus eine Grenze, die der Gehaltsstand daneben längst überholt hatte.
  const lines: ApronLines = resolveSeasonApronLines(gameState);
  // „Eingefroren" heisst: das Kauffenster ist zu UND ein zur Saison passender Snapshot liegt vor.
  // Dieselbe Frage, die auch `resolveSeasonApronLines` eine Zeile darueber beantwortet — nicht
  // zweitgerechnet, sonst koennte die Anzeige „eingefroren" melden, waehrend die Zahl daneben noch
  // live aus dem Median faellt.
  const frozenLines = areSeasonApronLinesFrozen(gameState);
  const salaryFactor = resolveApronSalaryFactor(gameState);

  const teams = gameState.teams.map((team) => ({
    teamId: team.teamId,
    // Dieselbe Bemessungsgrundlage wie Abrechnung und Linien — siehe apron-service.ts.
    salary: getTeamApronSalaryBase(gameState, team.teamId),
    rankShare: apronWertungsanteil(input.rankByTeamId.get(team.teamId) ?? APRON_FALLBACK_RANK, salaryFactor),
  }));

  const settlement = computeApronSettlement({ lines, salaryFactor, teams });

  return {
    lines,
    frozenLines,
    salaryFactor,
    konjunkturhebel: apronKonjunkturhebel(salaryFactor),
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
          empfaenger: row.istEmpfaenger,
        },
      ]),
    ),
  };
}

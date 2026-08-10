/**
 * LIGA-KALIBRIERUNG FÜR VORSTANDSZIELE — eine Marke, die die Liga selbst setzt.
 *
 * GEMELDET VON CHRIS, nachgemessen am Live-Save (Saison 2, Spieltag 4): das Finanzziel war
 * ligaweit unerfüllbar. 21 Teams „verfehlt", 9 „gefährdet", **0 erfüllt**. „Gehaltsdruck auf 78%
 * senken" stand bei 22 Teams — die Ist-Werte reichten von 78,7% bis 99,9%, kein einziges Team lag
 * unter der Marke. Ein Ziel, das kein Team der Liga erreicht, ist keine Vorgabe, sondern eine
 * Strafe mit Extraschritt.
 *
 * DIE URSACHE ist dieselbe Krankheit wie beim Ranks-Snapshot und den Apron-Linien: ZUM FALSCHEN
 * ZEITPUNKT GEMESSEN. Die Gehaltsquote ist `Gehalt / (Cash + Gehalt)`. Cash ist ein Bestand, der
 * während der Saison nur FÄLLT — Sponsorgeld, Apron und Gebäude werden erst am Saisonende gebucht.
 * Der Nenner ist also genau dann am kleinsten, wenn die Anzeige ihn zeigt. Eine feste Marke von
 * 78% trifft damit nie den Zustand, den sie beschreiben will.
 *
 * DIE ANTWORT: nicht mehr gegen eine erfundene absolute Zahl werten, sondern gegen die LIGA. Alle
 * 32 Teams werden im selben Augenblick gemessen, also trifft die Verzerrung des Buchungskalenders
 * alle gleich und kürzt sich weg. Und weil die Marke ein Rang ist, ist sie per Konstruktion
 * erfüllbar: bei Zielrang 16 von 32 schaffen es genau 16 Teams. Aus 0 von 32 werden dadurch nicht
 * „mehr geschenkte Ziele", sondern erstmals eine echte Rangliste.
 *
 * WAS HIER NICHT DRINSTEHT: die Metriken selbst. Dieses Modul weiss nicht, was ein Gehalt ist —
 * es bekommt Werte je Team und eine Richtung und liefert Rang, Median und Marke zurück. Damit ist
 * es ohne GameState prüfbar, und die vier Ziele, die es benutzen (Gehaltsquote, Cashpuffer,
 * Transferausgaben, Formkarten), teilen sich EINE Herleitung statt vier eigener.
 */

/** Ob ein kleiner Wert gut ist (Gehaltsquote, Transferausgaben) oder ein grosser (Cash, Formkarten). */
export type LeagueMetricDirection = "lower_is_better" | "higher_is_better";

export type LeagueMetricStanding = {
  /** 1 = bestes Team der Liga in dieser Größe. `null`, wenn das Team keinen Wert hat. */
  rank: number | null;
  /** Anzahl Teams MIT Wert — die Bezugsgröße des Rangs, nicht die Ligagröße. */
  teamCount: number;
  value: number | null;
  /** Median über alle Teams mit Wert. `null`, wenn niemand einen hat. */
  median: number | null;
};

/**
 * Rang eines Teams innerhalb der Liga für eine Größe.
 *
 * Teams ohne Wert (`null`) zählen NICHT mit. Sonst verschöbe ein Team, das seine Formkarten noch
 * nicht gespielt hat, den Rang aller anderen — und der Zielrang bezöge sich auf ein Feld, das es
 * so nicht gibt. Deshalb ist `teamCount` die Zahl der bewerteten Teams, nicht `gameState.teams.length`.
 *
 * Gleichstand bekommt denselben Rang (Standard-Konkurrenzrang, 1-2-2-4). Zwei Teams mit exakt
 * gleicher Gehaltsquote dürfen nicht dadurch getrennt werden, in welcher Reihenfolge sie im Array
 * standen.
 */
export function buildLeagueMetricStanding(input: {
  teamId: string;
  values: Array<{ teamId: string; value: number | null }>;
  direction: LeagueMetricDirection;
}): LeagueMetricStanding {
  const scored = input.values.filter(
    (entry): entry is { teamId: string; value: number } =>
      typeof entry.value === "number" && Number.isFinite(entry.value),
  );
  const teamCount = scored.length;
  const own = scored.find((entry) => entry.teamId === input.teamId) ?? null;
  if (teamCount === 0 || !own) {
    return { rank: null, teamCount, value: own?.value ?? null, median: medianOf(scored.map((entry) => entry.value)) };
  }

  const better = scored.filter((entry) =>
    input.direction === "lower_is_better" ? entry.value < own.value : entry.value > own.value,
  ).length;

  return {
    rank: better + 1,
    teamCount,
    value: own.value,
    median: medianOf(scored.map((entry) => entry.value)),
  };
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type LeagueRankTarget = {
  /** Zielrang: dieser Platz oder besser gilt als erfüllt. Mindestens 1, höchstens `teamCount`. */
  targetRank: number;
  /** Anteil der Liga, den der Zielrang abdeckt (0,25 = oberes Viertel). Für Tests und Texte. */
  fraction: number;
  /** Der Bereich im Nominativ: „oberes Viertel", „obere Hälfte", „vor dem unteren Viertel". */
  bandLabel: string;
  /**
   * Derselbe Bereich als fertige Ortsangabe: „im oberen Viertel", „in der oberen Hälfte", „vor dem
   * unteren Viertel".
   *
   * Zwei Felder statt einem, weil Deutsch dekliniert. Aus `bandLabel` allein wurde in den Labels
   * „Gehaltsquote im obere Hälfte der Liga" — im Live-Save nachgelesen. Wer eine Ortsangabe braucht,
   * nimmt `bandPhrase`; wer den Bereich benennt, `bandLabel`.
   */
  bandPhrase: string;
};

/**
 * Übersetzt den Anspruch des Vorstands (0–10, aus `cashPriority` bzw. `ambition`) in einen Zielrang.
 *
 * Die Spanne ist bewusst nach BEIDEN Seiten begrenzt: ein Vorstand ohne jeden Anspruch verlangt
 * immer noch, nicht ins untere Viertel zu rutschen, und der strengste verlangt höchstens das obere
 * Viertel — nicht Platz 1. Ein Ziel, das nur ein einziges Team erreichen kann, wäre wieder genau
 * der Fehler, der hier behoben wird, nur mit anderem Vorzeichen.
 */
export function resolveLeagueRankTarget(input: { teamCount: number; demand: number }): LeagueRankTarget {
  const demand = Math.max(0, Math.min(10, Number.isFinite(input.demand) ? input.demand : 5));
  // demand 0 -> 0,75 (nicht ins untere Viertel), demand 10 -> 0,25 (oberes Viertel).
  const fraction = 0.75 - (demand / 10) * 0.5;
  const targetRank = Math.max(1, Math.min(input.teamCount, Math.round(input.teamCount * fraction)));
  const bandLabel =
    fraction <= 0.3 ? "oberes Viertel" : fraction <= 0.55 ? "obere Hälfte" : "vor dem unteren Viertel";
  const bandPhrase =
    fraction <= 0.3 ? "im oberen Viertel" : fraction <= 0.55 ? "in der oberen Hälfte" : "vor dem unteren Viertel";
  return { targetRank, fraction: Number(fraction.toFixed(3)), bandLabel, bandPhrase };
}

/**
 * Status aus Liga-Rang gegen Zielrang.
 *
 * Der „gefährdet"-Streifen ist ANTEILIG (10% der Liga, mindestens 2 Plätze) statt der festen vier
 * Plätze aus `statusForRank`. In einer 32er-Liga sind vier Plätze ein Achtel des Feldes; in einer
 * kleineren Liga wären sie die halbe Tabelle, und praktisch niemand könnte ein Ziel noch verfehlen.
 */
export function statusForLeagueRank(input: {
  rank: number | null;
  targetRank: number;
  teamCount: number;
}): "completed" | "at_risk" | "failed" | "open" {
  if (input.rank == null) return "open";
  if (input.rank <= input.targetRank) return "completed";
  const band = Math.max(2, Math.round(input.teamCount * 0.1));
  return input.rank <= input.targetRank + band ? "at_risk" : "failed";
}

/**
 * Solange die Saison nicht abgerechnet ist, darf ein cash-abhängiges Finanzziel NICHT „verfehlt"
 * melden — der Wert, gegen den es am Ende wirklich gewertet wird, existiert noch nicht. Der Malus
 * fliesst ohnehin erst in `applyTeamSeasonObjectiveRewards`, aber das Board-Vertrauen und die
 * KI-Neigung lesen den Status LIVE: ein „verfehlt" an Spieltag 4 drückt das Vertrauen für eine
 * Saison, die noch zehn Spieltage und eine komplette Einnahmenbuchung vor sich hat.
 *
 * „Gefährdet" bleibt erlaubt und ist auch gemeint — es ist die ehrliche Aussage über eine
 * Hochrechnung.
 */
export function capProvisionalObjectiveStatus<T extends string>(status: T): T | "at_risk" {
  return status === "failed" ? "at_risk" : status;
}

/**
 * NEGATIVES CASH IST KEINE HOCHRECHNUNG.
 *
 * Der Liga-Vergleich oben ist eine Note: „du stehst schlechter da als 20 andere". Ein Konto im
 * Minus ist dagegen eine Tatsache, die kein Vergleich relativiert — auch dann nicht, wenn die
 * halbe Liga noch tiefer im Minus steht. Genau diese Meldung war der Auslöser der ganzen
 * Apron-Arbeit („so viele Teams hatten ne positive GuV und jetzt haben so viele Teams negatives
 * Cash????"), und der Insolvenz-Backstop existiert, weil dieser Zustand nicht stehenbleiben darf.
 *
 * Deshalb: wer im Minus steht, hat sein Finanzziel verfehlt, sofort und unabhängig vom Rang — und
 * das Ziel trägt dann auch keinen „Hochrechnung"-Hinweis mehr, denn an der Tatsache ändert die
 * ausstehende Einnahmenbuchung nichts mehr über die Frage „ist das Konto gedeckt".
 */
export function isCashDistress(cash: number | null | undefined): boolean {
  return typeof cash === "number" && Number.isFinite(cash) && cash < 0;
}

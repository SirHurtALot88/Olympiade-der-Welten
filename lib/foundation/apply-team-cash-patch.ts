/**
 * KONTOSTAND AUS EINER SERVER-ANTWORT UEBERNEHMEN, OHNE DEN GANZEN SPIELSTAND NEU ZU LADEN.
 *
 * Nach einem Kauf im Transfermarkt lief bisher `loadSave()` — das holt den GESAMTEN Spielstand neu
 * ueber das Netz und baut ihn wieder auf (Normalisierung, Zielzustaende, Sponsor-Vergleich), fuer
 * eine einzige geaenderte Zahl. Sichtbar war das als "die Seite laedt nach jedem Kauf nochmal".
 *
 * Dabei liegt der neue Kontostand schon vor: Die Kauf-Antwort traegt `cashAfter`, und der
 * Erfolgstext zeigt ihn sogar an ("Cash 120 → 95"). Er wurde nur nicht in den Spielstand
 * geschrieben, sondern uebers Netz noch einmal geholt.
 *
 * Der Wert ist deshalb NICHT optimistisch geraten, sondern das Ergebnis des bereits ausgefuehrten
 * Kaufs — dieselbe Zahl, die ein Neuladen zurueckgeben wuerde. Faellt der Nachlauf aus (Netz weg),
 * steht trotzdem der richtige Betrag da statt des alten.
 *
 * Bewusst eng gehalten: NUR Cash, NUR das eine Team. Ein Kauf aendert mehr (Kader, Gehalt,
 * Marktliste, Historie), und diese Funktion tut so, als taete sie das nicht. Wer hier weitere Felder
 * anflickt, baut eine zweite, halbe Wahrheit neben den Spielstand — das Nachladen bleibt fuer den
 * Rest zustaendig.
 */

type TeamLike = { teamId: string; cash: number };

/**
 * Gibt einen neuen Team-Array zurueck, in dem genau ein Team den neuen Kontostand traegt.
 *
 * Unbrauchbare Eingaben (kein Team, keine endliche Zahl, Team nicht gefunden) lassen die Liste
 * **unveraendert und referenzgleich** — dann uebernimmt der Nachlauf wie bisher. Referenzgleichheit
 * ist hier kein Detail: Ein neues Array bei jedem Aufruf wuerde in React unnoetige Renders
 * ausloesen, obwohl sich nichts geaendert hat.
 */
export function applyTeamCashPatch<T extends TeamLike>(
  teams: T[],
  input: { teamId: string | null | undefined; cash: number | null | undefined },
): T[] {
  const { teamId, cash } = input;
  if (teamId == null || teamId === "") return teams;
  if (typeof cash !== "number" || !Number.isFinite(cash)) return teams;

  const index = teams.findIndex((team) => team.teamId === teamId);
  if (index < 0) return teams;
  if (teams[index].cash === cash) return teams;

  const next = teams.slice();
  next[index] = { ...teams[index], cash };
  return next;
}

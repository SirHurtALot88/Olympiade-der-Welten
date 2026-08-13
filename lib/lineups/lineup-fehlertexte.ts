/**
 * ROHE FEHLERCODES GEHOEREN NICHT AUF DEN BILDSCHIRM — Uebersetzung an der Anzeigegrenze.
 *
 * GEMELDET VON CHRIS mit Bildschirmfoto: ueber der Einsatzliste stand rot und kursiv
 * `lineup_draft_is_locked` — sonst nichts. Kein Grund, kein Ausweg, kein deutscher Satz.
 *
 * WAS DAHINTERSTECKT, ist kein Fehler, sondern eine gewollte Sperre: `matchday-lineup-lock.ts`
 * nagelt die Abgabe fest, sobald der Spieltag in der Arena gezeigt wurde — sonst koennte man das
 * Ergebnis ansehen, wieder hinausgehen, den Kapitaen umsetzen und so lange nachbessern, bis es
 * passt (der Spieltag rechnet reproduzierbar). Die Sperre ist also richtig; nur erfuhr der Spieler
 * ihren Grund nie.
 *
 * WARUM DIE UEBERSETZUNG HIER STEHT UND NICHT AM ENTSTEHUNGSORT: die Codes sind die
 * Schnittstelle zwischen Dienst, API und Oberflaeche — Tests und Server-Antworten haengen an
 * ihnen. Uebersetzt wird deshalb erst dort, wo ein Mensch liest.
 *
 * UNBEKANNTES WIRD DURCHGEREICHT, nicht verschluckt. Ein Text, den diese Tabelle nicht kennt, ist
 * entweder schon ein Satz (die Validierung liefert englische Saetze) oder ein neuer Code — in
 * beiden Faellen ist ihn zu zeigen besser, als ihn gegen ein nichtssagendes „Unbekannter Fehler"
 * zu tauschen.
 */

const TEXTE: Record<string, string> = {
  lineup_draft_is_locked:
    "Diese Aufstellung ist festgenagelt: der Spieltag wurde bereits in der Arena gezeigt und laesst sich danach nicht mehr aendern.",
  lineup_matchday_is_not_active:
    "Dieser Spieltag laeuft gerade nicht — gespeichert wird immer nur fuer den aktuellen Spieltag.",
  lineup_not_operationally_ready:
    "Die Aufstellung ist so noch nicht abgabebereit — es fehlt noch etwas, das der Spieltag zwingend braucht.",
  form_cards_season_is_not_active:
    "Diese Saison laeuft gerade nicht — Formkarten lassen sich nur in der laufenden Saison einsetzen.",
  form_card_plan_matchday_missing: "Zu diesem Formkarten-Plan gibt es den Spieltag nicht im Spielplan.",
  form_card_plan_discipline_side_missing:
    "Zu diesem Formkarten-Plan gibt es die Disziplin-Seite an diesem Spieltag nicht.",
};

/** Ein einzelner Code oder Text, lesbar gemacht. Unbekanntes bleibt unveraendert. */
export function uebersetzeLineupFehler(codeOderText: string): string {
  return TEXTE[codeOderText] ?? codeOderText;
}

/** Bequemlichkeit fuer die Anzeige: mehrere Meldungen auf einmal. */
export function uebersetzeLineupFehlerListe(meldungen: readonly string[]): string[] {
  return meldungen.map(uebersetzeLineupFehler);
}

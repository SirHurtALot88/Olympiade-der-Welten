/** Eingabe und Antwort des Schreibwegs `POST /api/marketing` (Marketing-Seite, Reiter Aushaengeschild). Nur Typen, client-sicher. */
export type MarketingAktionEingabe = { aktion: "aushaengeschild"; playerId: string };

export type MarketingAktionAntwort = { ok: boolean; reason: string | null; meldung: string };

export type MarketingAktionFn = (input: MarketingAktionEingabe) => Promise<MarketingAktionAntwort>;

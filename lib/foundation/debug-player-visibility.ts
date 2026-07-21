/**
 * Zeigt alle Spieler-Attribute exakt an — kein Scouting-"Fog of War".
 *
 * Das Spiel wird jetzt gespielt, deshalb ist der Fog of War standardmäßig
 * AKTIV: fremde/ungescoutete Spieler bleiben verschleiert (Attribut-Maxima
 * als Range, PO-Sterne als Band), und die Sicht schärft sich über Scouting
 * und den Auto-Reveal-Tick.
 *
 * Der Debug-Bypass ist NICHT entfernt, nur ausgeschaltet: Wer zum Prüfen
 * wieder ALLE Werte exakt sehen will, setzt die Env-Variable
 * `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES=1` (oder hier auf `true`) — dann wird
 * der Fog wie in der Bauphase zentral auf allen Lese-Pfaden überbrückt.
 */
export const DEBUG_FORCE_PLAYER_VISIBILITY =
  process.env.NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES === "1";

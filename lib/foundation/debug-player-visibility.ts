/**
 * Zeigt alle Spieler-Attribute exakt an — kein Scouting-"Fog of War".
 *
 * TEMPORÄR wieder AUS: Der Fog of War für fremde Teams ist vorübergehend
 * ausgeschaltet, damit in Ruhe Stats und Spieler geprüft werden können —
 * alle Werte werden exakt angezeigt. Um den Fog gezielt (wieder) zu
 * aktivieren, setzt man die Env-Variable `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES=0`
 * (oder hier den Default auf `=== "1"`). Die vollständige Fog-Logik
 * (Attribut-Ranges, PO-Stern-Bänder, Scouting-/Auto-Reveal-Tick) bleibt
 * unverändert erhalten und wird später wieder scharf geschaltet.
 */
export const DEBUG_FORCE_PLAYER_VISIBILITY =
  process.env.NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES !== "0";

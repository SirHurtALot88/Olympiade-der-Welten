/**
 * Zeigt alle Spieler-Attribute exakt an — kein Scouting-"Fog of War".
 *
 * TEMPORARY build-phase switch: Solange das Spiel noch gebaut und gefixt
 * wird (und noch nicht wirklich gespielt wird), ist das bewusst
 * standardmäßig AN, damit beim Prüfen alle Attribut-/Achsenwerte sichtbar
 * sind — unabhängig davon, ob ein Spieler zum eigenen Team gehört oder nur
 * gescoutet ist.
 *
 * Das Fog-of-War-Verhalten ist NICHT entfernt, nur überbrückt. Sobald
 * echtes Gameplay startet, hier auf `false` setzen (oder die Env-Variable
 * `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES=0` setzen) — dann greift wieder die
 * normale scouting-basierte Sichtbarkeit.
 */
export const DEBUG_FORCE_PLAYER_VISIBILITY =
  process.env.NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES !== "0";

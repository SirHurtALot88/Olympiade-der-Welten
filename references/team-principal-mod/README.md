# Team Principal (2026er-Mod) — Referenzdaten

Von Chris hochgeladene Mod-Exporte der **2026er**-Version von "Team Principal" (Racing
Manager). Nicht die 1999er-Mod — die Olympiade nutzt die 2026er (Korrektur 05.09., s.
`scripts/export-team-principal-mod.mjs`).

- `2026-teams-reference.json` — alle 77 Team-Templates der Mod (11 aktuell aktive reale
  Konstrukteure, 66 inaktive Kandidaten mit `first_active_season`). Quelle der Chassis-
  Physik-Kurve, auf die `export-team-principal-mod.mjs` die Oly-Teams perzentilbasiert
  mappt (nur die 11 aktiven — die inaktiven mischen erkennbare Spass-/Easter-Egg-Einträge
  unter echte Marken, z. B. "Brawn GP" mit `team_pace: 100`).
- `2026-drivers-reference.json` — 322 Fahrer-Einträge, genutzt um das tatsächliche
  Fahrer-Schema zu verifizieren (z. B. `team: null` statt `"Free Agent"` für Free Agents,
  kein `number`/`career_stage`-Feld, `personality` + `personalities`).
- `2026-headquarters-reference.json`, `2026-engines-reference.json` — Kosten-/Vertrags-
  Tabellen der Mod, bislang nur zur Orientierung, nicht direkt vom Export-Skript gelesen.

Diese Dateien sind roher Mod-Content, kein Oly-eigener Code — bei einer neuen Mod-Version
hier ersetzen.

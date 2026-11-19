import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * ABNAHME 19.11. (docs/design/abnahme-saison-19-11.md): `OLY_LIGA_DRAFT_MODUS` stand nicht in der Compose-Datei. Ein Wert in
 * deploy/hetzner/.env erreichte den Container damit nie (Compose nimmt .env nur zur Interpolation), und ein neues Spiel auf dem
 * Server lief immer ueber den alten Hintergrund-Draft — die Draft-Seite (#1623) war dort nicht einschaltbar.
 */
describe("Liga-Draft-Schalter auf dem Server", () => {
  const compose = readFileSync("deploy/hetzner/docker-compose.yml", "utf8");
  const envBeispiel = readFileSync("deploy/hetzner/.env.example", "utf8");

  it("compose reicht OLY_LIGA_DRAFT_MODUS an den Container durch, leer = Standard", () => {
    expect(compose).toMatch(/^\s+OLY_LIGA_DRAFT_MODUS: \$\{OLY_LIGA_DRAFT_MODUS:-\}$/m);
  });

  it(".env.example nennt den Schalter", () => {
    expect(envBeispiel).toMatch(/^OLY_LIGA_DRAFT_MODUS=$/m);
  });
});

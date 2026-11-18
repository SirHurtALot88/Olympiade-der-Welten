import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { arenaVerweiseAusHuelle } from "@/lib/foundation/battle-arena/arena-vorladen";
import { leseArenaVorlaufFortschritt } from "@/lib/battle/arena-vorlauf-service";

/**
 * WARTEZEIT NACH "EINSATZLISTE ABGEBEN" (18.11.): waehrend der Vorlauf rechnet, laedt die Buehne die
 * Arena-Dateien schon vor (arena-vorladen.ts) und zeigt den Fortschritt (leseArenaVorlaufFortschritt).
 */
describe("Arena-Dateien vorladen", () => {
  it("findet in der echten Huelle dieselben Stylesheets und Skripte, die der Host einhaengt", () => {
    const html = readFileSync(path.join(process.cwd(), "public/mockups/battle-mode.html"), "utf8");
    const verweise = arenaVerweiseAusHuelle(html, "https://olympiade.example/mockups/battle-mode.html");
    expect(verweise).toContain("https://olympiade.example/mockups/battle-mode.engine.js");
    expect(verweise).toContain("https://olympiade.example/mockups/battle-mode.css");
    expect(verweise.every((v) => v.startsWith("https://olympiade.example/"))).toBe(true);
    expect(new Set(verweise).size).toBe(verweise.length);
  });
});

describe("Vorlauf-Fortschritt", () => {
  it("ohne laufenden Vorlauf gibt es keinen Fortschritt", () => {
    expect(leseArenaVorlaufFortschritt({ saveId: "s", seasonId: "x", matchdayId: "m" })).toBeNull();
  });
});

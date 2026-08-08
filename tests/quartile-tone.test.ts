/**
 * Paket F2: Bedeutungsfarben von der Teamfarbe trennen.
 *
 * Die Rang-Skala „Bestwert → Schlusslicht" (lib/foundation/quartile-tone.ts)
 * ist theme-FEST: Gold → good → warn → risk. Vorher stand das Spitzenviertel
 * auf `accent` — unter einem roten Team-Theme (z. B. Stronghold Crusaders)
 * sahen Rang 1 (accent = Teamrot) und Rang 31 (risk = Rot) gleich aus.
 *
 * Der Test hält drei Dinge fest:
 *  1. Die Skala selbst: Quartilsgrenzen, keine Erfindungen bei fehlenden
 *     Rängen, und `accent` kommt in keiner Stufe vor.
 *  2. Beide Aufrufer (teams-v2 Disziplin-Profil, players-table Perzentil-
 *     Chips) laufen über DIESELBE Skala — eine Quelle, nicht zwei ähnliche.
 *  3. Die Gold-Stufe existiert beidseitig: Ton-Vokabular + CSS-Klasse.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPoolQuartileTone, getQuartileRankTone } from "@/lib/foundation/quartile-tone";
import { getPoolHeatTone } from "@/lib/foundation/player-league-heat";
import { NL_TONE_VAR } from "@/components/foundation/new-look/nl-tones";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("getQuartileRankTone: Gold → good → warn → risk je Liga-Viertel", () => {
  it("Rang 1 ist Gold, Rang 31/32 von 32 ist risk — nie derselbe Ton", () => {
    expect(getQuartileRankTone(1, 32)).toBe("gold");
    expect(getQuartileRankTone(31, 32)).toBe("risk");
    expect(getQuartileRankTone(32, 32)).toBe("risk");
    expect(getQuartileRankTone(1, 32)).not.toBe(getQuartileRankTone(31, 32));
  });

  it("Quartilsgrenzen bei 32 Teams: 8 gold, 8 good, 8 warn, 8 risk", () => {
    const toene = Array.from({ length: 32 }, (_, i) => getQuartileRankTone(i + 1, 32));
    expect(toene.filter((t) => t === "gold")).toHaveLength(8);
    expect(toene.filter((t) => t === "good")).toHaveLength(8);
    expect(toene.filter((t) => t === "warn")).toHaveLength(8);
    expect(toene.filter((t) => t === "risk")).toHaveLength(8);
  });

  it("keine Stufe ist jemals `accent` — Teamfarbe trägt keine Bewertung", () => {
    for (let rank = 1; rank <= 32; rank += 1) {
      expect(getQuartileRankTone(rank, 32)).not.toBe("accent");
    }
  });

  it("ohne Rang oder ohne Feld wird nichts erfunden: neutral", () => {
    expect(getQuartileRankTone(null, 32)).toBe("neutral");
    expect(getQuartileRankTone(undefined, 32)).toBe("neutral");
    expect(getQuartileRankTone(0, 32)).toBe("neutral");
    expect(getQuartileRankTone(1, 1)).toBe("neutral");
  });
});

describe("getPoolQuartileTone: derselbe Maßstab für Wert-in-Pool", () => {
  const pool = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100

  it("Bestwert Gold, Schlusslicht risk, Mitte good/warn", () => {
    expect(getPoolQuartileTone(100, pool)).toBe("gold");
    expect(getPoolQuartileTone(60, pool)).toBe("good");
    expect(getPoolQuartileTone(40, pool)).toBe("warn");
    expect(getPoolQuartileTone(1, pool)).toBe("risk");
  });

  it("Pool ohne Spreizung oder zu klein: neutral", () => {
    expect(getPoolQuartileTone(5, [5, 5, 5])).toBe("neutral");
    expect(getPoolQuartileTone(5, [5])).toBe("neutral");
    expect(getPoolQuartileTone(5, [])).toBe("neutral");
    expect(getPoolQuartileTone(null, pool)).toBe("neutral");
  });

  it("players-table (`getPoolHeatTone`) IST diese Skala — kein Zwilling mehr", () => {
    for (const wert of [1, 25, 50, 75, 100]) {
      expect(getPoolHeatTone(wert, pool)).toBe(getPoolQuartileTone(wert, pool));
    }
  });
});

describe("beide Aufrufer nutzen die geteilte Skala (statisch)", () => {
  it("teams-v2 Disziplin-Profil delegiert an getQuartileRankTone", () => {
    const teams = quelle("app/foundation/teams-v2/FoundationTeamsNewLook.tsx");
    expect(teams).toContain('from "@/lib/foundation/quartile-tone"');
    expect(teams).toContain("return getQuartileRankTone(rank, teamCount);");
    // Die alte Vier-Stufen-Logik mit accent an der Spitze ist raus.
    expect(teams).not.toContain('return "accent"; // Spitzen-Viertel');
  });

  it("player-league-heat delegiert an getPoolQuartileTone", () => {
    const heat = quelle("lib/foundation/player-league-heat.ts");
    expect(heat).toContain('from "@/lib/foundation/quartile-tone"');
    expect(heat).toContain("return getPoolQuartileTone(value, pool);");
  });

  it("Disziplin-Profil sortiert gleiche Ränge strikt nach Score (Befund T3)", () => {
    const teams = quelle("app/foundation/teams-v2/FoundationTeamsNewLook.tsx");
    expect(teams).toContain("if (leftScore !== rightScore) {");
    expect(teams).toContain("return rightScore - leftScore;");
  });
});

describe("die Gold-Stufe existiert beidseitig", () => {
  it("Ton-Vokabular: gold zeigt auf --nl-gold, nicht auf den Akzent", () => {
    expect(NL_TONE_VAR.gold).toContain("--nl-gold");
    expect(NL_TONE_VAR.gold).not.toContain("--nl-accent");
  });

  it("globals.css definiert .nl-tone-gold mit dem Medaillen-Token", () => {
    const css = quelle("app/globals.css");
    expect(css).toMatch(/\.is-new-look \.nl-tone-gold \{[^}]*--nl-tone: var\(--nl-gold\);/);
    // Und die Text-Stufe erbt den Ton (Gruppenregel), damit Gold als Schrift
    // nicht auf einen fremden Eltern-Ton zurückfällt.
    expect(css).toMatch(/\.is-new-look \.nl-tone-gold,[\s\S]{0,400}--nl-tone-text: var\(--nl-tone\);/);
  });
});

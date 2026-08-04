import { describe, expect, it } from "vitest";

import {
  accentInkFor,
  accentSoftFor,
  buildTeamShellThemeVars,
  buildTeamVoidVars,
  resolveTeamAccentPair,
  teamColorChroma,
} from "@/lib/foundation/team-shell-theme";
import { floorTeamAccent, getTeamColor } from "@/lib/foundation/team-colors";

/**
 * Team-Shell-Theme: die Shell-Wurzel färbt die --nl-* Akzent-Tokens nach dem
 * aktiven Team ein. Die Tests decken bewusst die schwierigen Marken ab, an
 * denen ein "sieht bei Neongrün gut aus"-Schema scheitern würde:
 *  - L-R/D-L: fast schwarze Primärfarbe → Akzent muss über den Floor
 *    (L min. 44) angehoben werden, Ink darauf muss WEISS sein.
 *  - S-S: helles Silber → Ink auf dem Akzent muss DUNKEL sein.
 *  - R-L (und weitere): keine kuratierte Sekundärfarbe → --nl-accent-2 fällt
 *    sauber auf die Primärfarbe zurück, kein Absturz, kein zweiter Farbton.
 */
describe("buildTeamShellThemeVars", () => {
  it("ohne Team (Alle-32-Teams-Modus) bleibt der Standard-Look: null", () => {
    expect(buildTeamShellThemeVars(null)).toBeNull();
    expect(buildTeamShellThemeVars(undefined)).toBeNull();
    expect(buildTeamShellThemeVars("")).toBeNull();
  });

  it("R-L (einfarbig, Neongrün): Akzent = geflochene Primärfarbe, Sekundär fällt auf Primär zurück", () => {
    const vars = buildTeamShellThemeVars("R-L");
    expect(vars).not.toBeNull();
    // hsl(96 60% 55%) liegt im Floor-Bereich [44, 72] → unverändert.
    expect(vars!["--nl-accent"]).toBe("hsl(96 60% 55%)");
    expect(vars!["--nl-accent-2"]).toBe(vars!["--nl-accent"]);
  });

  /**
   * GEMELDET: „bei Last-Ride sieht man fast nix von dem schwarz rot".
   *
   * Vorher führte hier die Primärfarbe: `hsl(220 12% 20%)`, auf den Floor
   * angehoben zu `hsl(220 12% 44%)` — neutrales Stahlgrau, an dem man kein Team
   * erkennt. Das Rot, DIE Erkennungsfarbe von Last Ride, lag im Zweitton-Slot,
   * den fast keine Regel liest.
   *
   * Gemessen über alle 32 Teams trägt die Primärfarbe hier ein Chroma von 0,04
   * gegen 0,65 der Sekundärfarbe — Faktor 16. Jetzt führt das Rot, und das
   * Schwarz bleibt als `deep` der Ton für Flächen und Schleier. Genau so sieht
   * „schwarz + rot" aus.
   */
  it("L-R (fast schwarz + rot): das ROT führt, das Schwarz bleibt die Fläche", () => {
    const vars = buildTeamShellThemeVars("L-R");
    expect(vars!["--nl-accent"]).toBe(floorTeamAccent(getTeamColor("L-R").secondary!));
    // Das Stahlgrau ist nicht weg — es ist jetzt der Zweitton.
    expect(vars!["--nl-accent-2"]).toBe(floorTeamAccent(getTeamColor("L-R").primary));
    // Und die dunkle Primärfarbe steht ungefiltert als Flächen-Ton bereit.
    expect(vars!["--nl-accent-deep"]).toBe(getTeamColor("L-R").primary);
    // Auf dem kräftigen Rot ist Weiß die kontraststärkere Schrift.
    expect(vars!["--nl-accent-ink"]).toBe("#fff");
  });

  it("dreht NUR, wo die Primärfarbe wirklich als Grau liest", () => {
    // Die Regel darf keine „nimm immer die buntere Farbe"-Regel sein: Vicious &
    // Delicious ist die grüne Kriegerin (Chroma 0,42) mit orangem Zweitton
    // (0,76) — würde hier gedreht, stünde die kuratierte Identität auf dem Kopf.
    expect(resolveTeamAccentPair("V-D").swapped).toBe(false);
    expect(resolveTeamAccentPair("T-C").swapped).toBe(false);
    expect(resolveTeamAccentPair("R-L").swapped).toBe(false);
    // Gedreht wird bei den dreien, deren Primärfarbe unter dem Chroma-Tot liegt.
    expect(resolveTeamAccentPair("L-R").swapped).toBe(true);
    expect(resolveTeamAccentPair("M-M").swapped).toBe(true);
    expect(resolveTeamAccentPair("W-L").swapped).toBe(true);
    // D-L ist grau UND sein Zweitton ist grau — hier wird keine Farbe erfunden.
    expect(resolveTeamAccentPair("D-L").swapped).toBe(false);
  });

  it("misst Buntheit als Sättigung mal Nähe zur mittleren Helligkeit", () => {
    // Derselbe Farbton, einmal fast schwarz, einmal auf mittlerer Helligkeit.
    expect(teamColorChroma("hsl(354 72% 50%)")).toBeGreaterThan(0.6);
    expect(teamColorChroma("hsl(354 72% 8%)")).toBeLessThan(0.15);
    // Neutralgrau trägt gar keine Farbe.
    expect(teamColorChroma("hsl(220 0% 50%)")).toBe(0);
  });

  it("S-S (helles Silber): Ink auf dem Akzent ist dunkel, nicht weiß", () => {
    const vars = buildTeamShellThemeVars("S-S");
    expect(vars!["--nl-accent"]).toBe("hsl(210 8% 72%)");
    // Weiß auf L-72-Silber wäre ~1.6:1 — die Ink-Entscheidung muss dunkel wählen.
    expect(vars!["--nl-accent-ink"]).toBe("#0b0f17");
  });

  it("alle 32 kuratierten Teams plus unbekannte Codes liefern ein vollständiges, absturzfreies Set", () => {
    const codes = ["A-A", "B-B", "D-L", "G-G", "H-R", "P-S", "R-L", "S-S", "T-G", "V-V", "XX-UNBEKANNT"];
    for (const code of codes) {
      const vars = buildTeamShellThemeVars(code);
      expect(vars, code).not.toBeNull();
      for (const key of [
        "--nl-accent",
        "--nl-accent-2",
        "--nl-accent-soft",
        "--nl-accent-ink",
        "--nl-bg",
        "--nl-panel",
        "--nl-line",
        "--nl-line-2",
      ]) {
        expect(vars![key], `${code} ${key}`).toBeTruthy();
      }
      // Ink ist immer eine der beiden geprüften Extremfarben — nie die Teamfarbe
      // selbst (Teamfarbe auf Teamfarbe wäre unlesbar).
      expect(["#fff", "#0b0f17"]).toContain(vars!["--nl-accent-ink"]);
    }
  });

  it("übersteuert NIE Semantik-, Achsen- oder Heat-Tokens (bedingte Formatierung bleibt)", () => {
    // Contract: das gebaute Set darf ausschließlich Akzent- und Flächen-Tokens
    // enthalten. Würde hier je ein --nl-good/--nl-pow/--heat-* auftauchen,
    // würde ein grüner "stark"-Balken bei einem roten Team plötzlich rot.
    const vars = buildTeamShellThemeVars("R-L")!;
    const forbidden = ["good", "warn", "risk", "pow", "spe", "men", "soc", "heat", "gold", "silver", "bronze", "diamond", "mine", "ally", "rival"];
    for (const key of Object.keys(vars)) {
      for (const word of forbidden) {
        expect(key.includes(word), `${key} enthält ${word}`).toBe(false);
      }
    }
  });
});

describe("accentInkFor / accentSoftFor", () => {
  it("wählt die Ink-Seite mit dem höheren WCAG-Kontrast", () => {
    expect(accentInkFor("hsl(0 0% 90%)")).toBe("#0b0f17");
    expect(accentInkFor("hsl(0 0% 20%)")).toBe("#fff");
    // Gelb ist trotz mittlerem L sehr leuchtstark → dunkle Ink (V-W, M-S).
    expect(accentInkFor("hsl(50 95% 55%)")).toBe("#0b0f17");
  });

  it("nicht parsebare Eingaben stürzen nicht ab (weiß bzw. Basis-Soft)", () => {
    expect(accentInkFor("papayawhip")).toBe("#fff");
    expect(accentSoftFor("papayawhip")).toBe("#15294b");
  });

  it("die weiche Fläche bleibt dunkel (L fest bei 18%) und deckelt grelle Sättigung", () => {
    expect(accentSoftFor("hsl(96 60% 55%)")).toBe("hsl(96 55% 18%)");
    expect(accentSoftFor("hsl(210 8% 72%)")).toBe("hsl(210 8% 18%)");
  });
});

describe("buildTeamVoidVars", () => {
  it("liefert Primär- und Sekundär-Schleier; ohne Team null", () => {
    expect(buildTeamVoidVars(null)).toBeNull();
    const voidVars = buildTeamVoidVars("L-R")!;
    // Der Schleier folgt derselben Führung wie der Akzent — bei Last Ride also
    // Rot oben links, Stahl oben rechts.
    expect(voidVars.primary).toContain(floorTeamAccent(getTeamColor("L-R").secondary!));
    expect(voidVars.secondary).toContain(floorTeamAccent(getTeamColor("L-R").primary));
  });
});

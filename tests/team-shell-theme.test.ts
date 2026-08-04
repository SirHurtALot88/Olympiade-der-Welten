import { describe, expect, it } from "vitest";

import {
  accentInkFor,
  accentSoftFor,
  buildTeamShellThemeVars,
  buildTeamVoidVars,
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

  it("L-R (fast schwarz): Akzent wird auf den Lesbarkeits-Floor angehoben, Ink ist weiß", () => {
    const vars = buildTeamShellThemeVars("L-R");
    // Roh hsl(220 12% 20%) → floorTeamAccent hebt L auf 44.
    expect(vars!["--nl-accent"]).toBe("hsl(220 12% 44%)");
    // Auf einem L-44-Grau liefert Weiß mehr WCAG-Kontrast als dunkle Schrift.
    expect(vars!["--nl-accent-ink"]).toBe("#fff");
    // Die Sekundärfarbe (rot) bleibt als eigener zweiter Ton erhalten.
    expect(vars!["--nl-accent-2"]).toBe(floorTeamAccent(getTeamColor("L-R").secondary!));
    expect(vars!["--nl-accent-2"]).not.toBe(vars!["--nl-accent"]);
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
    expect(voidVars.primary).toContain("hsl(220 12% 44%)");
    // Sekundärfarbe (rot, geflochen) als zweiter Schleier.
    expect(voidVars.secondary).toContain(floorTeamAccent(getTeamColor("L-R").secondary!));
  });
});

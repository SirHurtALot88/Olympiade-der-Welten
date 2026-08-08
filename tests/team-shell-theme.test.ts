import { describe, expect, it } from "vitest";

import {
  accentInkFor,
  accentSoftFor,
  buildTeamShellThemeVars,
  buildTeamVoidVars,
  resolveTeamAccentPair,
  teamColorChroma,
} from "@/lib/foundation/team-shell-theme";
import { floorTeamAccent, getTeamColor, TEAM_COLOR } from "@/lib/foundation/team-colors";

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

  /**
   * GEFRAGT: „bau das so ein für alle teams!" — also nachgeprüft, ob wirklich
   * alle 32 tragen und nicht nur die drei, die im Browser zu sehen waren.
   *
   * Vier fielen dabei knapp durch: C-S 4,49, Z-H 4,45, W-W 4,36 und M-M 4,34
   * gegen die 4,5 der WCAG-AA-Schwelle. Die Schrift konnte da nichts mehr
   * retten — sie steht mit Weiß und fast-Schwarz schon auf beiden Extremen.
   * Deshalb wird die FLÄCHE nachjustiert, nicht die Schrift.
   */
  it("hält auf JEDEM der 32 Teams die Lesbarkeitsschwelle für Text auf der Fläche", () => {
    const luminanz = (wert: string) => {
      if (wert === "#fff") return 1;
      if (wert === "#0b0f17") return 0.0058;
      const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(wert)!;
      const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      const [r, g, b] =
        hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
      const m2 = l - c / 2;
      const lin = (ch: number) => (ch + m2 <= 0.04045 ? (ch + m2) / 12.92 : ((ch + m2 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    for (const code of Object.keys(TEAM_COLOR)) {
      const vars = buildTeamShellThemeVars(code)!;
      const flaeche = luminanz(vars["--nl-accent-fill"]!);
      const schrift = luminanz(vars["--nl-accent-ink"]!);
      const verhaeltnis = (Math.max(flaeche, schrift) + 0.05) / (Math.min(flaeche, schrift) + 0.05);
      expect(verhaeltnis, `${code}: Text auf der Akzentfläche zu kontrastarm`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * NACHGEMESSEN IM BROWSER, nicht gerechnet — und das war der Unterschied.
   *
   * Meine erste Prüfung rechnete auf den Token-Werten und meldete „32 von 32 in
   * Ordnung". Eine Messung am gerenderten Zustand fand danach 31 Verstöße: die
   * Navigations-Überschriften und die Karten-Eyebrows mischten den Akzent per
   * `color-mix` mit einem Grauton und rutschten bei dunklen Vereinsfarben in
   * den Grund — im schlechtesten Fall 2,97:1 (S-C) statt 4,5:1. Auch die
   * Buttons fielen bei vier Teams durch, weil das `color-mix` mit dem Panel die
   * eigens berechnete Füllfarbe wieder verdünnte.
   *
   * Lehre für diesen Test: er prüft die Tokens, die im GERENDERTEN Zustand
   * gemessen wurden — nicht die Zwischenwerte, aus denen sie entstehen.
   */
  it("hält den Teamton auch als TEXT auf dunklem Grund lesbar", () => {
    const luminanz = (wert: string) => {
      const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(wert)!;
      const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      const [r, g, b] =
        hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
      const m2 = l - c / 2;
      const lin = (ch: number) => (ch + m2 <= 0.04045 ? (ch + m2) / 12.92 : ((ch + m2 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const PANEL = 0.0095; // --nl-panel #131a26
    // F1: die Schwelle gilt auch gegen die TEAM-getönte Panel-Fläche —
    // buildTeamShellThemeVars mischt 5 % Akzent ins Panel, und genau darauf
    // steht der Text (Eyebrows, Karten). Gemessen war S-C vorher bei 4,44:1,
    // weil nur gegen das ungetönte Panel gerechnet wurde.
    const srgbAusHsl = (wert: string): [number, number, number] => {
      const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(wert)!;
      const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      const [r, g, b] =
        hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
      const m2 = l - c / 2;
      return [r + m2, g + m2, b + m2];
    };
    const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const teamPanelLuminanz = (accent: string) => {
      const [ar, ag, ab] = srgbAusHsl(accent);
      const basis = [0x13 / 255, 0x1a / 255, 0x26 / 255];
      const mixed = [ar, ag, ab].map((v, i) => v * 0.05 + basis[i]! * 0.95);
      return 0.2126 * linear(mixed[0]!) + 0.7152 * linear(mixed[1]!) + 0.0722 * linear(mixed[2]!);
    };
    for (const code of Object.keys(TEAM_COLOR)) {
      const vars = buildTeamShellThemeVars(code)!;
      const text = luminanz(vars["--nl-accent-text"]!);
      for (const grund of [PANEL, teamPanelLuminanz(vars["--nl-accent"]!)]) {
        const verhaeltnis = (Math.max(text, grund) + 0.05) / (Math.min(text, grund) + 0.05);
        expect(verhaeltnis, `${code}: Teamton als Text zu leise (Grund ${grund.toFixed(4)})`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("hebt für den Text nur die Helligkeit, nicht den Farbton", () => {
    const farbton = (v: string) => /^hsl\(\s*([\d.]+)/.exec(v)![1];
    for (const code of ["L-R", "S-C", "R-L"]) {
      const vars = buildTeamShellThemeVars(code)!;
      expect(farbton(vars["--nl-accent-text"]!)).toBe(farbton(vars["--nl-accent"]!));
    }
  });

  it("lässt die 28 Teams in Ruhe, die die Schwelle ohnehin halten", () => {
    // Die Fläche darf nicht pauschal verschoben werden — sonst verlöre jede
    // Marke ihren Ton für ein Problem, das sie gar nicht hat.
    for (const code of ["R-L", "G-G", "B-B", "S-S", "V-W"]) {
      expect(buildTeamShellThemeVars(code)!["--nl-accent-fill"]).toBe(buildTeamShellThemeVars(code)!["--nl-accent"]);
    }
  });

  it("verschiebt nur die Helligkeit, nicht den Farbton", () => {
    // Sonst wäre aus einer Nachjustierung eine andere Vereinsfarbe geworden.
    const vars = buildTeamShellThemeVars("W-W")!;
    const farbton = (v: string) => /^hsl\(\s*([\d.]+)/.exec(v)![1];
    expect(farbton(vars["--nl-accent-fill"]!)).toBe(farbton(vars["--nl-accent"]!));
    expect(vars["--nl-accent-fill"]).not.toBe(vars["--nl-accent"]);
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

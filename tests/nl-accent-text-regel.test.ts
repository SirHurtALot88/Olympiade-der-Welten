/**
 * DIE REGEL (Muster 1 des UI-Umbaus, Paket F1):
 *
 *   Teamfarbe als TEXT läuft über `--nl-accent-text`, nie über `--nl-accent`.
 *   `--nl-accent` bleibt die Farbe für Linien, Rahmen und Flächen — als
 *   Schriftfarbe ist er unzuverlässig, weil das Team-Theme ihn auf die echte
 *   Vereinsfarbe setzt und dunkle Marken (Stronghold Crusaders: gemessen
 *   2,97:1) dann im dunklen Grund verschwinden. `--nl-accent-text` ist
 *   dieselbe Marke, aber per `accentTextFor` (lib/foundation/team-shell-theme)
 *   in der Helligkeit angehoben, bis sie auf dem Panelgrund >= 4,5:1 hält —
 *   für alle 32 Teams, und seit F1 auch im Standard-Look ohne Team-Theme.
 *
 *   Zweite Hälfte der Regel: `--nl-mut-2` ist eine DEKO-Stufe (Linien, Icons,
 *   Ornament). Informationstragender Sekundärtext nimmt `--nl-mut` (6,8:1) —
 *   `--nl-mut-2` misst auf Panel nur 3,7:1 und war als Default von
 *   `--nl-accent-text` der Ton hinter dem 2,68:1-Audit-Befund.
 *
 * DER RATCHET: Die Altlast (Stand F1: 221× Akzent als Text, 78× mut-2 als
 * Text in globals.css) wird hier als Obergrenze eingefroren. Jedes
 * Seitenpaket senkt seine Zahl — dann die Konstante mit absenken. Neue
 * Verstöße schlagen fehl. Die Zahl kann nur noch sinken, nie steigen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/* ------------------------------------------------------------------ */
/* Ratchet                                                             */
/* ------------------------------------------------------------------ */

// Stand nach Paket F1. NIE erhöhen — wer hier ankommt, weil sein neuer Code
// die Zahl hebt: nimm `color: var(--nl-accent-text)` (Teamfarbe als Text,
// garantiert lesbar) statt `color: var(--nl-accent)` (Teamfarbe als Fläche,
// als Text bei dunklen Vereinsfarben unlesbar). Senkt ein Paket die Zahl,
// wird die Konstante mit abgesenkt.
// Nach S2/T1 (Inbox-Gruppen, Teams „Liste & Verträge": tote Vertragslisten-Styles raus): 220.
// Nach M3 (Finanzen: „Dein Team"-Chip auf --nl-accent-text, gemessen war er 3,28:1): 219.
const ACCENT_ALS_TEXT_OBERGRENZE = 219;

// Stand nach Paket F1. NIE erhöhen — `--nl-mut-2` ist Deko (Linien, Icons).
// Informationstragender Sekundärtext nimmt `color: var(--nl-mut)` (6,8:1);
// `--nl-mut-2` liegt mit 3,7:1 auf Panel unter der Schwelle.
// Nach T1 (tote Vertragslisten-Styles raus): 77.
// Nach T3 (Spielerliste: Podium-Kennzahllabel, PPs-Erklärzeile, Free-Agent-
// Status, Saison-Gehaltszeile, Alltime-Saisonanzahl — alle fünf trugen echte
// Information, nicht Deko): 72.
const MUT2_ALS_TEXT_OBERGRENZE = 72;

const zaehle = (re: RegExp) => (CSS.match(re) ?? []).length;

describe("Ratchet: Akzent/mut-2 als Schriftfarbe nur noch abwärts", () => {
  it(`color: var(--nl-accent) — Altlast maximal ${ACCENT_ALS_TEXT_OBERGRENZE}`, () => {
    const anzahl = zaehle(/color:\s*var\(--nl-accent\s*[,)]/g);
    expect(
      anzahl,
      `globals.css hat ${anzahl}× \`color: var(--nl-accent)\` (erlaubt: ${ACCENT_ALS_TEXT_OBERGRENZE}). ` +
        "Neuer Text in Teamfarbe nimmt `color: var(--nl-accent-text)` — dasselbe Token, aber per " +
        "accentTextFor auf >= 4,5:1 Lesbarkeit angehoben; `--nl-accent` ist bei dunklen Vereinsfarben " +
        "als Schrift unlesbar. Wenn du Altlasten entfernt hast: Obergrenze im Test mit absenken.",
    ).toBeLessThanOrEqual(ACCENT_ALS_TEXT_OBERGRENZE);
  });

  it(`color: var(--nl-mut-2) — Altlast maximal ${MUT2_ALS_TEXT_OBERGRENZE}`, () => {
    const anzahl = zaehle(/color:\s*var\(--nl-mut-2\s*[,)]/g);
    expect(
      anzahl,
      `globals.css hat ${anzahl}× \`color: var(--nl-mut-2)\` (erlaubt: ${MUT2_ALS_TEXT_OBERGRENZE}). ` +
        "`--nl-mut-2` ist die Deko-Stufe (3,7:1) — informationstragender Sekundärtext nimmt " +
        "`color: var(--nl-mut)` (6,8:1). Wenn du Altlasten entfernt hast: Obergrenze mit absenken.",
    ).toBeLessThanOrEqual(MUT2_ALS_TEXT_OBERGRENZE);
  });
});

/* ------------------------------------------------------------------ */
/* Der Token-Default wird NACHGERECHNET, nicht geglaubt                */
/* ------------------------------------------------------------------ */

/** WCAG-Relativluminanz aus einem #rrggbb-Hex (wie team-shell-theme.test.ts). */
function hexLuminanz(hex: string): number {
  const h = hex.replace("#", "");
  const kanal = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(0) + 0.7152 * kanal(2) + 0.0722 * kanal(4);
}

function kontrast(l1: number, l2: number): number {
  const [hell, dunkel] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Liest ein `--token: wert;` aus dem .is-new-look-Grundblock. */
function tokenWert(name: string): string {
  const m = CSS.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`Token ${name} nicht in globals.css gefunden`);
  return m[1].trim();
}

/** Löst var(--x)-Ketten innerhalb der Token-Defaults bis zum Hex-Literal auf. */
function aufgeloest(wert: string, tiefe = 0): string {
  if (tiefe > 6) throw new Error(`Var-Kette zu tief: ${wert}`);
  const v = wert.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (v) return aufgeloest(tokenWert(v[1]), tiefe + 1);
  if (!/^#[0-9a-f]{6}$/i.test(wert)) {
    throw new Error(`Token-Default ist kein Hex und keine var-Kette: ${wert}`);
  }
  return wert;
}

describe("--nl-accent-text: der Default ist gemessen lesbar", () => {
  const textHex = aufgeloest(tokenWert("--nl-accent-text"));
  const textLum = hexLuminanz(textHex);

  it("gegen --nl-panel mindestens 4,5:1", () => {
    const panel = hexLuminanz(aufgeloest(tokenWert("--nl-panel")));
    expect(kontrast(textLum, panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("gegen den dunkleren Navigationsgrund rgba(8,14,28,0.92) über --nl-bg mindestens 4,5:1", () => {
    // Der Sidebar-Grund ist halbtransparent — erst über --nl-bg gelegt ist er
    // die Fläche, auf der die Gruppen-Überschriften wirklich stehen.
    const bgHex = aufgeloest(tokenWert("--nl-bg"));
    const b = (i: number) => parseInt(bgHex.slice(1 + i, 3 + i), 16);
    const alpha = 0.92;
    const misch = [8, 14, 28].map((v, i) => Math.round(v * alpha + b(i * 2) * (1 - alpha)));
    const kanal = (v: number) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    const navLum = 0.2126 * kanal(misch[0]) + 0.7152 * kanal(misch[1]) + 0.0722 * kanal(misch[2]);
    expect(kontrast(textLum, navLum)).toBeGreaterThanOrEqual(4.5);
  });

  it("der Default fällt nie wieder auf die Deko-Stufe --nl-mut-2 zurück", () => {
    expect(tokenWert("--nl-accent-text")).not.toContain("--nl-mut-2");
  });
});

/* ------------------------------------------------------------------ */
/* Die in F1 umgestellten Kernklassen bleiben auf den richtigen Tokens */
/* ------------------------------------------------------------------ */

/** Erster Regelblock, dessen Selektor auf das Muster passt. */
const CSS_OHNE_KOMMENTARE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
function regelBlock(selektor: RegExp): string {
  const alle = CSS_OHNE_KOMMENTARE.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const m of alle) {
    if (selektor.test(m[1].trim())) return m[2];
  }
  throw new Error(`Kein Regelblock für ${selektor} gefunden`);
}

describe("Kernklassen aus F1 nutzen --nl-accent-text / --nl-accent-ink / --nl-mut", () => {
  it("Karten-Eyebrow (nl-card-eyebrow) → --nl-accent-text", () => {
    expect(regelBlock(/^\.is-new-look \.nl-card-eyebrow$/)).toContain("var(--nl-accent-text");
  });

  it("Sidebar-Gruppen-Label → --nl-accent-text", () => {
    expect(regelBlock(/^\.is-new-look \.foundation-sidebar-group-label$/)).toContain("var(--nl-accent-text");
  });

  it("Sidebar-Versionsbadge → --nl-mut (nicht mut-2)", () => {
    const block = regelBlock(/^\.is-new-look \.foundation-sidebar-version-badge$/);
    expect(block).toContain("color: var(--nl-mut)");
    expect(block).not.toContain("--nl-mut-2");
  });

  it("Team-Kürzel in der Saisonstand-Tabelle → --nl-mut (nicht mut-2)", () => {
    const block = regelBlock(/\.nl-standings-table \.nl-standings-teamcode$/);
    expect(block).toContain("color: var(--nl-mut)");
    expect(block).not.toContain("--nl-mut-2");
  });

  it("Viewwidth-Umschalter: aktiver Zustand → Tinte auf Akzent-Soft-Fläche", () => {
    // Gemessen: Akzent-Text auf Akzent-Soft trug nur 3,9:1 (accentTextFor
    // zielt auf das Panel, nicht auf die Soft-Fläche) — deshalb volle Tinte,
    // der Teamton sitzt im Grund.
    const block = regelBlock(/^\.foundation-sidebar-viewwidth-option\.is-active$/);
    expect(block).toContain("color: var(--nl-ink");
    expect(block).toContain("var(--nl-accent-soft");
  });

  it("primary-/secondary-button im neuen Look: Akzentfläche + --nl-accent-ink, auch OHNE Team-Theme", () => {
    // Vor F1 galt die Akzent-Regel nur unter [data-team-theme]; der Standard-
    // Look behielt Weiß auf Legacy-Blau (3,5:1 bzw. 3,2:1).
    const primary = regelBlock(/^\.foundation-shell\.is-new-look \.primary-button$/);
    expect(primary).toContain("var(--nl-accent-fill");
    expect(primary).toContain("var(--nl-accent-ink)");
    const secondary = regelBlock(/^\.foundation-shell\.is-new-look \.secondary-button$/);
    expect(secondary).toContain("var(--nl-accent-ink)");
  });

  it("Leertaste-Badge im Weiter-Button → volle Deckung in --nl-accent-ink", () => {
    const block = regelBlock(/^\.foundation-shell\.is-new-look \.foundation-global-next-button small$/);
    expect(block).toContain("color: var(--nl-accent-ink");
    expect(block).not.toContain("rgba(255, 255, 255, 0.82)");
  });

  it("StatChip-Label: Akzent-Ton läuft über --nl-tone-text", () => {
    expect(regelBlock(/^\.is-new-look \.nl-stat-chip-label$/)).toContain("var(--nl-tone-text");
    expect(regelBlock(/^\.is-new-look \.nl-tone-accent$/)).toContain("--nl-tone-text: var(--nl-accent-text");
  });
});

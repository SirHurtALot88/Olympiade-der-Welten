// Team-Shell-Theme: übersetzt die kanonische Team-Farbe (team-colors.ts) in die
// zentralen Akzent-Tokens der Neuer-Look-Shell. Die Shell-Wurzel (<main> in
// FoundationShellRouterBody) setzt diese Variablen inline, sobald ein aktives
// Manager-Team gewählt ist — dadurch färben sich ALLE Seiten mit, ohne dass
// eine einzelne Seite angefasst wird: alles, was `--nl-accent`,
// `--nl-accent-soft`, Fokus-Ringe oder color-mix-Ableitungen davon nutzt,
// zieht automatisch nach.
//
// Was hier BEWUSST NICHT übersteuert wird (bedingte Formatierung bleibt):
//   --nl-good/--nl-warn/--nl-risk   (Semantik: gut/Warnung/Risiko)
//   --nl-pow/--nl-spe/--nl-men/--nl-soc (Achs-Identität POW/SPE/MEN/SOC)
//   --nl-gold/--nl-silver/--nl-bronze/--nl-diamond (Podest/Metall)
//   --heat-* / is-tier-* (Heat- und Tier-Skala)
//   --nl-mine/--nl-ally/--nl-rival  (Freund/Feind-Kodierung der Arena)
//
// Kontrast-Contract:
//   --nl-accent      = floorTeamAccent(Primär)  → L in [44, 72], auf dunklen
//                      Panels als Linie/Text lesbar (Vorbild: DisciplineStageDrawer).
//   --nl-accent-2    = floorTeamAccent(Sekundär); Teams ohne kuratierte
//                      Sekundärfarbe (z.B. R-L, S-S) bleiben sauber einfarbig —
//                      der Rückfall ist die Primärfarbe selbst, kein Absturz.
//   --nl-accent-ink  = Textfarbe AUF Akzent-Flächen. Wird per WCAG-Luminanz
//                      entschieden (dunkel vs. weiß, je nachdem was mehr
//                      Kontrast liefert): helles Silber (S-S) bekommt dunkle
//                      Schrift, ein dunkler Stahl-Akzent (L-R) weiße.
//   --nl-accent-soft = dunkle Fläche im Team-Farbton (aktive Zustände,
//                      Selection) — Helligkeit fest bei 18%, damit --nl-ink
//                      darauf immer lesbar bleibt, egal wie hell die Marke ist.
//
// Flächen (--nl-bg/--nl-panel/--nl-line) werden nur GANZ leicht (3–24%) in den
// Team-Farbton gemischt — genug für "die Seite trägt Teamfarbe", zu wenig, um
// die Lesbarkeit von Ink/Mut-Text oder den Semantik-Chips darauf zu bewegen.
// Die Hex-Basiswerte spiegeln die `.is-new-look`-Tokens aus globals.css (die
// liegen auf derselben Wurzel und sind daher hier nicht per var() erreichbar —
// gleiche Begründung wie beim body:has()-Void in globals.css).

import { getTeamColor, floorTeamAccent } from "./team-colors";

// Basiswerte der Neuer-Look-Tokens (Spiegel von .is-new-look in globals.css).
const BASE_BG = "#0b0f17";
const BASE_BG_2 = "#0e131d";
const BASE_PANEL = "#131a26";
const BASE_PANEL_2 = "#0f1621";
const BASE_LINE = "#1f2937";
const BASE_LINE_2 = "#2a3a52";

// Helligkeit der weichen Akzent-Fläche: fest, damit --nl-ink darauf lesbar
// bleibt (die Basis --nl-accent-soft #15294b liegt bei ~L 19%).
const SOFT_L = 18;
// Sättigungsdeckel für die weiche Fläche: sehr grelle Marken (S 95%) würden
// als vollgesättigte Fläche neonartig leuchten statt "getönt" zu wirken.
const SOFT_S_MAX = 55;

export type TeamShellThemeVars = Record<string, string>;

function parseHsl(value: string): { h: number; s: number; l: number } | null {
  const match = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(value.trim());
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

// HSL → relative WCAG-Luminanz (0..1). Bewusst hier implementiert statt einer
// Farb-Library: wir brauchen genau diesen einen Wert für die Ink-Entscheidung.
function hslLuminance(h: number, s: number, l: number): number {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  const lin = (ch: number) => {
    const v = ch + m;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Luminanz des dunklen Ink-Kandidaten (--nl-bg #0b0f17), vorberechnet.
const DARK_INK_LUMINANCE = 0.0058;

/**
 * Textfarbe AUF einer Akzent-Fläche: dunkel oder weiß — je nachdem, welcher
 * WCAG-Kontrast zur gegebenen Akzentfarbe höher ist. Nicht parsebare Eingaben
 * fallen auf Weiß zurück (sicher, weil floorTeamAccent nie über L 72 hinausgeht).
 */
export function accentInkFor(accentHsl: string): string {
  const parsed = parseHsl(accentHsl);
  if (!parsed) return "#fff";
  const lum = hslLuminance(parsed.h, parsed.s, parsed.l);
  const contrastDark = (lum + 0.05) / (DARK_INK_LUMINANCE + 0.05);
  const contrastWhite = (1 + 0.05) / (lum + 0.05);
  return contrastDark >= contrastWhite ? BASE_BG : "#fff";
}

/** WCAG-Kontrast zweier Luminanzen. */
function kontrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Die FÜLLFARBE für Akzentflächen mit Text darauf (Buttons, Pills) — nicht zu
 * verwechseln mit `--nl-accent`, das Linien, Ränder und Text auf dunklem Grund
 * färbt und deshalb die Markenfarbe unangetastet lassen soll.
 *
 * Warum überhaupt getrennt: über alle 32 Teams gemessen erreichten vier den
 * WCAG-AA-Wert für normalen Text nicht ganz — C-S 4,49, Z-H 4,45, W-W 4,36 und
 * M-M 4,34 gegen die geforderten 4,5. Die Schrift kann dort nichts mehr
 * retten, sie steht mit Weiß und fast-Schwarz schon auf beiden Extremen. Also
 * wird die FLÄCHE so weit in der Helligkeit verschoben, bis die Schrift die
 * Schwelle hält — in Richtung der gewählten Schriftfarbe weg, also dunkler bei
 * weißer Schrift und heller bei dunkler.
 *
 * Für die 28 Teams, die ohnehin über 4,5 liegen, ändert sich nichts.
 */
export function accentFillFor(accentHsl: string, ink: string): string {
  const parsed = parseHsl(accentHsl);
  if (!parsed) return accentHsl;
  const inkLum = ink === "#fff" ? 1 : DARK_INK_LUMINANCE;
  const richtung = ink === "#fff" ? -1 : 1;
  let l = parsed.l;
  for (let schritt = 0; schritt < 40; schritt += 1) {
    if (kontrast(hslLuminance(parsed.h, parsed.s, l), inkLum) >= 4.5) break;
    const next = l + richtung * 1.5;
    // Nicht ins Unkenntliche laufen: die Marke soll erkennbar bleiben.
    if (next < 22 || next > 88) break;
    l = next;
  }
  return `hsl(${parsed.h} ${parsed.s}% ${Math.round(l * 10) / 10}%)`;
}

/** Dunkle Fläche im Team-Farbton (aktive Zustände, Selection, weiche Panels). */
export function accentSoftFor(accentHsl: string): string {
  const parsed = parseHsl(accentHsl);
  // Rückfall: Basis-Soft-Ton der Shell (kommt praktisch nicht vor, weil
  // getTeamColor immer hsl(...) liefert — auch für unbekannte Codes).
  if (!parsed) return "#15294b";
  const s = Math.min(parsed.s, SOFT_S_MAX);
  return `hsl(${parsed.h} ${s}% ${SOFT_L}%)`;
}

/**
 * Wie viel MARKENFARBE ein Ton überhaupt auf den Schirm bringt — 0 (wirkt grau)
 * bis 1 (voll). Sättigung allein reicht als Maß nicht: derselbe Farbton bei
 * L 20 % oder L 92 % erscheint fast unbunt, deshalb die Gewichtung mit der
 * Nähe zur mittleren Helligkeit.
 */
export function teamColorChroma(value: string): number {
  const parsed = parseHsl(value);
  if (!parsed) return 0;
  const mitte = 1 - Math.abs(parsed.l - 55) / 55;
  return (parsed.s / 100) * Math.max(0, mitte);
}

/**
 * Ab hier gilt ein Ton als „trägt keine erkennbare Farbe mehr". Gemessen an den
 * 32 kuratierten Teams liegt genau die Gruppe darunter, deren Primärfarbe fast
 * schwarz oder neutrales Grau ist: L-R 0.04, D-L 0.04, M-M 0.10, W-L 0.11 —
 * der nächste Wert darüber ist P-C mit 0.20.
 */
const CHROMA_TOT = 0.15;

/**
 * GEMELDET: „bei Last-Ride sieht man fast nix von dem schwarz rot".
 *
 * Stimmt, und der Grund ist messbar. Last Ride ist „schwarz + rot": Primärfarbe
 * `hsl(220 12% 20%)`, Sekundärfarbe `hsl(354 72% 50%)`. Der Akzent kam blind aus
 * der Primärfarbe — die auf den Lesbarkeits-Floor angehoben zu neutralem
 * Stahlgrau wird (`hsl(220 12% 44%)`). Die Farbe, an der man das Team ERKENNT,
 * lag damit im Slot, den fast keine Regel liest.
 *
 * Also: trägt die Primärfarbe keine erkennbare Farbe (Chroma unter CHROMA_TOT)
 * und die Sekundärfarbe deutlich mehr, dann führt die Sekundärfarbe. Das ist
 * bewusst KEINE „nimm immer die buntere"-Regel — die würde Vicious & Delicious
 * (grüne Kriegerin, 0.42) auf Orange und Thunder Cats (blaue Flügel, 0.80) auf
 * Gelb drehen und der kuratierten Absicht widersprechen. Betroffen sind exakt
 * die drei Teams, deren Primärfarbe wirklich als Grau liest: L-R, M-M, W-L.
 *
 * Die dunkle Primärfarbe verschwindet dabei nicht — sie bleibt als `deep` der
 * Ton für Flächen und Schleier. Genau so sieht „schwarz + rot" aus: schwarze
 * Flächen, rote Akzente.
 */
export function resolveTeamAccentPair(code: string | null | undefined): {
  accent: string;
  accent2: string;
  /** Der dunkle/unbunte Partner — Flächen und Schleier, nie Text. */
  deep: string;
  /** Ob die Sekundärfarbe die Führung übernommen hat (für Tests und Doku). */
  swapped: boolean;
} {
  const color = getTeamColor(code);
  const primaryChroma = teamColorChroma(color.primary);
  const secondaryChroma = color.secondary ? teamColorChroma(color.secondary) : 0;
  const swapped =
    color.secondary != null && primaryChroma < CHROMA_TOT && secondaryChroma > primaryChroma + 0.05;

  const fuehrend = swapped ? color.secondary! : color.primary;
  const zweiter = swapped ? color.primary : color.secondary ?? color.primary;
  return {
    accent: floorTeamAccent(fuehrend),
    accent2: floorTeamAccent(zweiter),
    // Bewusst OHNE Floor: hier ist das Dunkle der Punkt.
    deep: swapped ? color.primary : color.secondary ?? color.primary,
    swapped,
  };
}

/**
 * Die CSS-Variablen für die Shell-Wurzel — oder null, wenn kein Team gewählt
 * ist ("Alle 32 Teams anzeigen"): dann behält die Shell ihren Standard-Look.
 */
export function buildTeamShellThemeVars(code: string | null | undefined): TeamShellThemeVars | null {
  if (!code) return null;
  const { accent, accent2, deep } = resolveTeamAccentPair(code);
  return {
    // Der dunkle Partner als eigenes Token: Flächen und Rahmen dürfen ihn nutzen,
    // ohne ihn auf Textlesbarkeit anheben zu müssen.
    "--nl-accent-deep": deep,
    // Fläche für Text-auf-Akzent — bei Bedarf in der Helligkeit nachjustiert,
    // damit die Schrift überall die AA-Schwelle hält (siehe accentFillFor).
    "--nl-accent-fill": accentFillFor(accent, accentInkFor(accent)),
    "--nl-accent": accent,
    "--nl-accent-2": accent2,
    "--nl-accent-soft": accentSoftFor(accent),
    "--nl-accent-ink": accentInkFor(accent),
    // Flächen: nur eine Ahnung von Teamfarbe — Prozentwerte bewusst klein.
    "--nl-bg": `color-mix(in srgb, ${accent} 3%, ${BASE_BG})`,
    "--nl-bg-2": `color-mix(in srgb, ${accent} 4%, ${BASE_BG_2})`,
    "--nl-panel": `color-mix(in srgb, ${accent} 5%, ${BASE_PANEL})`,
    "--nl-panel-2": `color-mix(in srgb, ${accent} 4%, ${BASE_PANEL_2})`,
    "--nl-line": `color-mix(in srgb, ${accent} 12%, ${BASE_LINE})`,
    "--nl-line-2": `color-mix(in srgb, ${accent} 24%, ${BASE_LINE_2})`,
  };
}

/**
 * Der Body-Void (die Fläche NEBEN dem Shell auf breiten Monitoren) wird über
 * zwei Variablen auf dem <body> mitgefärbt — die body:has()-Regel in
 * globals.css liest sie mit neutralem Rückfall. Primär oben links, Sekundär
 * oben rechts, beide als hauchdünner Schleier.
 */
export function buildTeamVoidVars(code: string | null | undefined): { primary: string; secondary: string } | null {
  if (!code) return null;
  const { accent, accent2 } = resolveTeamAccentPair(code);
  return {
    primary: `color-mix(in srgb, ${accent} 7%, transparent)`,
    secondary: `color-mix(in srgb, ${accent2} 5%, transparent)`,
  };
}

export const TEAM_VOID_VAR_PRIMARY = "--oly-team-void-a";
export const TEAM_VOID_VAR_SECONDARY = "--oly-team-void-b";

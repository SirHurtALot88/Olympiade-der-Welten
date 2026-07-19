// Kanonische Team-Farb-Identität, abgeleitet aus den Team-Logos nach dem Prinzip
// "Erkennbarkeit vor Anteil" (die nameable Markenfarbe, nicht die häufigste
// Pixelfarbe — die ist oft nur der Hintergrund). Eine einzige Quelle für
// Token-Füllung, Icon-Rahmen, Balken, Ladder-Akzente usw.
//
// Sekundärfarbe nur, wenn das Logo klar zweifarbig ist (z.B. Last Ride
// schwarz+rot). Im runden Token wird die Füllung diagonal geteilt
// (↙ Primär / ↗ Sekundär); der Außenring bleibt reserviert für das eigene Team
// (Accent) und Relations-Marker (ally/rival) — Sekundärfarbe also nie als Rand.
//
// Alle Werte als hsl(H S% L%) (design-token-konform, kein Hex). Sehr dunkle
// Marken sind leicht in der Helligkeit angehoben, damit sie als Token auf dem
// dunklen Arena-Grund sichtbar bleiben.

export type TeamColor = { primary: string; secondary?: string };

export const TEAM_COLOR: Record<string, TeamColor> = {
  "A-A": { primary: "hsl(215 7% 62%)", secondary: "hsl(220 10% 22%)" }, // schwarz-silber, taktisch
  "B-B": { primary: "hsl(104 72% 55%)", secondary: "hsl(220 8% 14%)" }, // neongrüne Bestie
  "B-P": { primary: "hsl(214 12% 42%)", secondary: "hsl(210 8% 74%)" }, // schwarz-silber Panther
  "C-C": { primary: "hsl(128 58% 50%)", secondary: "hsl(220 10% 16%)" }, // grünes Geld, Dollar
  "C-S": { primary: "hsl(2 78% 52%)", secondary: "hsl(210 12% 78%)" }, // rote Klingen, Stahl
  "D-L": { primary: "hsl(210 6% 60%)", secondary: "hsl(220 8% 22%)" }, // düster, schwarz-silber
  "D-P": { primary: "hsl(265 45% 74%)", secondary: "hsl(240 10% 10%)" }, // Lavendel auf Schwarz
  "G-G": { primary: "hsl(48 85% 58%)" }, // goldener Gladiator
  "H-R": { primary: "hsl(6 84% 56%)" }, // roter Teufel, Feuer
  "L-K": { primary: "hsl(352 78% 50%)", secondary: "hsl(210 8% 78%)" }, // rotes Emblem, Silber
  "L-R": { primary: "hsl(220 12% 20%)", secondary: "hsl(354 72% 50%)" }, // schwarz + rot, Sensenmann
  "M-M": { primary: "hsl(215 12% 44%)", secondary: "hsl(354 80% 54%)" }, // schwarz-weißer Adler, rot
  "M-S": { primary: "hsl(45 95% 55%)", secondary: "hsl(2 82% 52%)" }, // gelb/rot
  "N-N": { primary: "hsl(212 88% 56%)", secondary: "hsl(220 12% 16%)" }, // schwarzer Ninja, blau
  "N-W": { primary: "hsl(96 40% 45%)", secondary: "hsl(190 62% 50%)" }, // Natur: grün + Wasser-türkis
  "P-C": { primary: "hsl(214 24% 46%)", secondary: "hsl(210 10% 80%)" }, // marineblau-silber, Schiff
  "P-S": { primary: "hsl(270 45% 63%)" }, // lila Vogel
  "R-C": { primary: "hsl(44 70% 55%)", secondary: "hsl(210 8% 74%)" }, // gold + silber, Königshof
  "R-L": { primary: "hsl(96 60% 55%)" }, // grüner Wolf, Neonring
  "R-R": { primary: "hsl(190 55% 55%)", secondary: "hsl(8 75% 68%)" }, // türkiser Drache, Koralle
  "S-C": { primary: "hsl(350 80% 50%)", secondary: "hsl(210 8% 80%)" }, // roter Kreuzritter, weiß
  "S-S": { primary: "hsl(210 8% 72%)" }, // silberner Krieger
  "T-C": { primary: "hsl(205 80% 55%)", secondary: "hsl(46 95% 55%)" }, // blaue Flügel, Sonnengelb
  "T-G": { primary: "hsl(24 55% 48%)" }, // brauner Gigant, Bronze
  "T-T": { primary: "hsl(205 55% 65%)", secondary: "hsl(215 45% 26%)" }, // hellblauer Cop, Marine
  "U-A": { primary: "hsl(210 5% 66%)", secondary: "hsl(220 8% 20%)" }, // schwarz-silber Agent
  "V-D": { primary: "hsl(140 55% 42%)", secondary: "hsl(22 80% 52%)" }, // grüne Kriegerin, orange
  "V-V": { primary: "hsl(192 60% 62%)" }, // eisblaue Wikinger
  "V-W": { primary: "hsl(50 95% 55%)", secondary: "hsl(220 12% 16%)" }, // gelber Revolverheld
  "W-L": { primary: "hsl(210 12% 58%)", secondary: "hsl(84 26% 48%)" }, // stahlgrau + olivgrün
  "W-W": { primary: "hsl(218 70% 55%)", secondary: "hsl(120 65% 55%)" }, // blaue Magier, grünes Auge
  "Z-H": { primary: "hsl(276 60% 58%)", secondary: "hsl(260 10% 14%)" }, // lila + schwarz
};

// Deterministischer Fallback für Codes ohne kuratierte Farbe (neue/unbekannte
// Teams): Farbton aus dem Kürzel-Hash, damit die Farbe stabil und über Renders
// hinweg gleich bleibt.
function fallbackColor(code: string): TeamColor {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) & 0xffff;
  const hue = Math.round((h * 137.508) % 360);
  return { primary: `hsl(${hue} 58% 55%)` };
}

/** Kanonische Farbe eines Teams (Primär + optional Sekundär) inkl. Fallback. */
export function getTeamColor(code: string | null | undefined): TeamColor {
  if (code && TEAM_COLOR[code]) return TEAM_COLOR[code];
  return fallbackColor(code ?? "");
}

/** Nur die Primärfarbe — bequem für Balken, Ladder-Akzente, einfache Ränder. */
export function teamPrimaryColor(code: string | null | undefined): string {
  return getTeamColor(code).primary;
}

/** Ob ein Team eine kuratierte (zweifarbige) Sekundärfarbe hat. */
export function teamHasSecondary(code: string | null | undefined): boolean {
  return Boolean(code && TEAM_COLOR[code]?.secondary);
}

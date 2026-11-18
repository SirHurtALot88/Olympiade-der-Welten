/**
 * Format-Helfer der neuen Markt-Seite. Einheit überall „C" (Chris, 18.11.), deutsche Kommas.
 */
export function de(wert: number, nachkomma = 1): string {
  return wert.toFixed(nachkomma).replace(".", ",");
}

export function betragC(wert: number | null | undefined, nachkomma = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  const normiert = Math.abs(wert) < 0.5 * 10 ** -nachkomma ? 0 : wert;
  return `${normiert < 0 ? "−" : ""}${de(Math.abs(normiert), nachkomma)} C`;
}

export function zahlC(wert: number | null | undefined, nachkomma = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  return de(wert, nachkomma);
}

/** Jahresgehalt → je Spieltag (Finanzkonzept V2, Abschnitt 2.1: Jahresgehalt ÷ 20). */
export const SPIELTAGE_JE_SAISON = 20;
export function jeSpieltag(jahresgehalt: number | null | undefined): number | null {
  if (jahresgehalt == null || !Number.isFinite(jahresgehalt)) return null;
  return jahresgehalt / SPIELTAGE_JE_SAISON;
}

export function begrenze(wert: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, wert));
}

/** „11." → „9.–10." bei Spanne, „9." bei exakt. */
export function rangText(best: number, schlecht: number): string {
  return best === schlecht ? `${best}.` : `${best}.–${schlecht}.`;
}

export const DISZIPLIN_KURZ: Record<string, string> = {
  tdm: "TDM",
  "mini-dm": "MDM",
  battlefield: "BF",
  gewichtheben: "GEW",
  climbing: "CLI",
  staffel: "STA",
  "time-trial": "TT",
  spurt: "SPU",
  tennis: "TEN",
  hockey: "HOC",
  showcase: "SHO",
  "speed-schach": "SCH",
  "takeshis-castle": "TAK",
  breaking: "BRE",
  wettessen: "WET",
  basketball: "BAS",
  football: "FOO",
  eiskunstlauf: "EIS",
  fechten: "FEC",
  "i-spy": "ISP",
};

export const ATTRIBUT_LABEL_DE: Record<string, string> = {
  power: "Power",
  health: "Health",
  determination: "Determination",
  stamina: "Stamina",
  speed: "Speed",
  dexterity: "Dexterity",
  awareness: "Awareness",
  intelligence: "Intelligence",
  will: "Will",
  charisma: "Charisma",
  spirit: "Spirit",
  torment: "Torment",
};

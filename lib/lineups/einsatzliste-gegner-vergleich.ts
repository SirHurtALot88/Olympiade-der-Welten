/**
 * GEGNER-VERGLEICH DER EINSATZLISTE (Optik-Runde 18.11.) — reine Rechenhilfen für den Reiter „Gegner“.
 *
 * Es wird nichts erfunden: Eingang sind die Schätzspannen aus `gegner-schaetzung.ts` (rohe
 * Disziplin-Eignung, gestreut nach Scouting-Stufe) und die eigenen Eignungswerte der Besetzung. Hier
 * wird nur verglichen und sortiert. NUR ANZEIGE, nichts davon fließt in Wertung oder KI.
 */
export type Spanne = { min: number; max: number };

export type DuellStand = "vorn" | "hinten" | "gleich" | "offen";

export function spannenMitte(spanne: Spanne | null | undefined): number | null {
  return spanne ? (spanne.min + spanne.max) / 2 : null;
}

/**
 * Eigener Platz gegen den geschätzten Gegner-Platz. `abstand` = eigener Wert minus Spannenmitte
 * (mit Vorzeichen, für die ±-Zahl); `stand` ist nur dann „vorn“/„hinten“, wenn der eigene Wert
 * ÜBER dem Maximum bzw. UNTER dem Minimum der Spanne liegt, sonst „gleich“ (innerhalb der Unsicherheit).
 */
export function duellStand(eigen: number | null | undefined, gegner: Spanne | null | undefined): { stand: DuellStand; abstand: number | null } {
  if (eigen == null || !Number.isFinite(eigen) || !gegner) return { stand: "offen", abstand: null };
  const mitte = (gegner.min + gegner.max) / 2;
  const abstand = eigen - mitte;
  if (eigen > gegner.max) return { stand: "vorn", abstand };
  if (eigen < gegner.min) return { stand: "hinten", abstand };
  return { stand: "gleich", abstand };
}

export type GruppenEingang = {
  teamId: string;
  name: string;
  wir: boolean;
  /** Eigene Seite: Ø Eignung der Besetzung (exakt). Gegner: Spanne der Schätzung. */
  wert: number | null;
  spanne: Spanne | null;
  /** true = Prognose (beste Aufstellung geschätzt), false = erkanntes Muster oder eigener Wert. */
  prognose: boolean;
};

export type GruppenZeile = GruppenEingang & { platz: number; mitte: number | null; unschaerfe: number | null };

/** Sortiert die Vierergruppe nach erwartetem Ø Eignung; Teams ohne Wert stehen am Ende ohne Platz-Sprung. */
export function baueGruppenStand(eingang: GruppenEingang[]): GruppenZeile[] {
  const mitteVon = (e: GruppenEingang) => (e.wir ? e.wert : spannenMitte(e.spanne));
  const sortiert = eingang
    .map((e, index) => ({ e, index, mitte: mitteVon(e) }))
    .sort((a, b) => {
      if (a.mitte == null && b.mitte == null) return a.index - b.index;
      if (a.mitte == null) return 1;
      if (b.mitte == null) return -1;
      return b.mitte - a.mitte || a.index - b.index;
    });
  return sortiert.map(({ e, mitte }, platz) => ({
    ...e,
    platz: platz + 1,
    mitte,
    unschaerfe: !e.wir && e.spanne ? (e.spanne.max - e.spanne.min) / 2 : null,
  }));
}

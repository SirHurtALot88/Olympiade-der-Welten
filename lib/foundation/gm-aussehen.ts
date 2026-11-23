import gmAussehenDaten from "@/data/gm-aussehen.json";

/**
 * Festes Aussehen der 100 General Manager (22.11.). Die Profile in `team-general-managers.ts` tragen weder
 * Rasse noch Aussehen; die Zuordnung steht in `data/gm-aussehen.json` (erzeugt von
 * `scripts/gm-aussehen-erzeugen.py`, unabhängig vom Team, gestreut über alle 18 Rassen).
 *
 * Ein Porträt gibt es nur für GMs, deren Bild bei PixelLab bestellt wurde (Feld `bestellt`,
 * Herkunft `public/portraits/gm/quellen.json`). `gmPortraetPfad` liefert sonst `null`; die Anzeige fällt dann auf
 * ihr bisheriges Bild zurück und lädt nichts, was nicht lokal liegt.
 */
export type GmAussehen = {
  name: string;
  archetyp: string;
  profil: string;
  /** Rassenname wie im Spiel (Human, Voidborn, Gnom ...), nicht übersetzt. */
  rasse: string;
  tier?: string;
  geschlecht: "w" | "m";
  anmutung: string;
  kleidungsstil: string;
  prompt: string;
  portraet: string;
  /** Liegt das Bild unter `public/portraits/gm/`? Vom Erzeuger-Skript aus den Dateien gelesen. */
  bestellt: boolean;
};

const aussehenById = gmAussehenDaten.gms as Record<string, GmAussehen>;

export function getGmAussehen(gmId: string | null | undefined): GmAussehen | null {
  return gmId ? (aussehenById[gmId] ?? null) : null;
}

/** Pfad des Porträts unter `public/`, oder `null`, solange das Bild noch nicht bestellt ist. */
export function gmPortraetPfad(gmId: string | null | undefined): string | null {
  const aussehen = getGmAussehen(gmId);
  return aussehen?.bestellt ? aussehen.portraet : null;
}

export function listGmIdsMitPortraet(): string[] {
  return Object.keys(aussehenById).filter((gmId) => aussehenById[gmId].bestellt);
}

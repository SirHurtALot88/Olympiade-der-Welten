/**
 * Format- und Sitz-Helfer der Draft-Seite (18.11.). Reine Anzeige: nichts hier rechnet Picks, Preise oder Budgets
 * (gezeigt = gebucht, alles kommt aus `/api/draft`).
 */
import { FRANKY_OWNER_ID, RAMONA_OWNER_ID, resolveOwnerDisplayLabel } from "@/lib/foundation/team-control-settings";

export function de(wert: number, nachkomma = 1): string {
  return wert.toFixed(nachkomma).replace(".", ",");
}

export function betragC(wert: number | null | undefined, nachkomma = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  return `${wert < 0 ? "−" : ""}${de(Math.abs(wert), nachkomma)} C`;
}

/** Sitzfarbe wie im Mockup: Chris/eigener Benutzer = Heim-Orange, Franky = Gast-Blau, Ramona = Violett. */
export type SitzKlasse = "ich" | "fr" | "ra";

export function sitzKlasse(ownerId: string | null | undefined): SitzKlasse {
  if (ownerId === FRANKY_OWNER_ID) return "fr";
  if (ownerId === RAMONA_OWNER_ID) return "ra";
  return "ich";
}

export function sitzName(ownerId: string | null | undefined): string {
  return resolveOwnerDisplayLabel(ownerId) ?? "Mensch";
}

/** Kurzzeichen im Warte-Kreis („F“ für Franky). */
export function sitzBuchstabe(ownerId: string | null | undefined): string {
  return sitzName(ownerId).slice(0, 1).toUpperCase();
}

export const FEHLER_TEXTE: Record<string, string> = {
  nicht_am_zug: "Du bist gerade nicht am Zug.",
  auto_pick_ist_an: "Auto-Pick ist an — dein GM pickt für dich.",
  team_ist_ki: "Dieses Team wird von der KI geführt.",
  team_nicht_im_draft: "Dieses Team ist nicht im Draft.",
  kader_voll: "Dein Kader ist voll (14 Spieler).",
  kader_unter_minimum: "Du brauchst mindestens 8 Spieler.",
  spieler_vergeben: "Der Spieler ist schon weg.",
  spieler_unbekannt: "Den Spieler gibt es nicht mehr.",
  reserve_fuer_pflichtplaetze: "Das lässt zu wenig Geld für die Pflichtplätze.",
  nachzug_erst_nach_dem_draft: "Der Nachzug beginnt, sobald die KI fertig gepickt hat.",
  draft_laeuft_nicht: "Der Draft läuft gerade nicht.",
  team_nicht_aktiv: "Dein Team pickt nicht mehr.",
  draft_stand_veraltet: "Der Stand hat sich geändert — ich lade neu.",
  liga_draft_fehlt: "Für diese Saison gibt es keinen Draft.",
};

export function fehlerText(code: string | null | undefined): string {
  if (!code) return "Das hat nicht geklappt.";
  return FEHLER_TEXTE[code] ?? `Das hat nicht geklappt (${code}).`;
}

export const GRUND_TEXT: Record<string, string> = {
  star: "Star",
  bedarf: "Bedarf",
  preis_leistung: "Preis-Leistung",
  kadertiefe: "Kadertiefe",
};

export const GRUND_TAG: Record<string, string> = { star: "go", bedarf: "g", preis_leistung: "a", kadertiefe: "" };

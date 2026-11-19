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
  liga_draft_modus_aus: "Der Liga-Draft ist auf diesem Server nicht eingeschaltet.",
  erwarteteNr_fehlt: "Der Stand ist noch nicht geladen — ich lade neu.",
  auslassen_unter_mindestkader: "Auslassen geht nicht mehr: die restlichen Runden reichen sonst nicht bis zu 8 Spielern.",
  draft_schon_fertig: "Der Draft dieser Saison ist schon abgeschlossen.",
  nur_saison_1: "Der Draft gibt es nur im Aufbau von Saison 1.",
  saison_laeuft_schon: "Die Saison läuft schon — ein Draft ist jetzt nicht mehr möglich.",
  nur_im_saisonaufbau: "Der Draft ist nur im Saisonaufbau möglich.",
  liga_draft_laeuft: "Der Liga-Draft läuft — die KI pickt dort weiter.",
  nur_host: "Das darf nur der Gastgeber.",
};

/** Stand-Konflikte lädt die Seite still neu und zeigt die Sicht erneut — keine Fehlermeldung an den Spieler. */
export const STILL_NEU_LADEN = new Set(["draft_stand_veraltet", "erwarteteNr_fehlt"]);

export function istStandKonflikt(code: string | null | undefined): boolean {
  return Boolean(code && STILL_NEU_LADEN.has(code));
}

/**
 * Wann muss die Shell den Spielstand nachladen, damit ihr Kopf (Kasse, Status) zum Draft passt? Wenn sich der EIGENE Kader oder
 * die eigene Kasse aendert oder der Draft endet — nicht bei jedem fremden Pick (Abnahme 19.11., Fehler F4).
 */
export function draftKopfSchluessel(ansicht: { status: string; mein: { kader: number; kasse: number } | null }): string {
  return `${ansicht.status === "fertig" ? "fertig" : "offen"}|${ansicht.mein?.kader ?? "-"}|${ansicht.mein?.kasse ?? "-"}`;
}

/** Wie oft eine standunabhaengige Aktion nach einem Stand-Konflikt erneut gesendet wird. */
export const STANDFEST_VERSUCHE = 4;

/**
 * Sendet eine Aktion, die nicht an einen bestimmten Spieler gebunden ist (Ueberspringen, Auto-Pick, Fertig), nach einem
 * Stand-Konflikt erneut — `senden` liest den frischen Stand selbst (die Seite laedt nach einem Konflikt still neu).
 * Abnahme 19.11., Fehler F2 (docs/design/abnahme-saison-19-11.md): vorher scheiterte „Ueberspringen“ still, sobald die KI
 * zwischen Anzeige und Klick weiterpickte.
 */
export async function wiederholeBeiStandKonflikt<T extends { success?: boolean; error?: string | null }>(
  senden: () => Promise<T>,
  versuche = STANDFEST_VERSUCHE,
): Promise<T> {
  let antwort = await senden();
  for (let versuch = 1; versuch < versuche && !antwort.success && istStandKonflikt(antwort.error); versuch += 1) {
    antwort = await senden();
  }
  return antwort;
}

/** Warum ein Knopf gesperrt ist — Tooltip. Die Sperre selbst kommt NUR aus `darfAuslassen`/`darfFertig` der Sicht. */
export function auslassenSperrGrund(mein: { darfAuslassen: boolean; autoPick: boolean; amZug: boolean; status: string }): string | null {
  if (mein.darfAuslassen) return null;
  if (mein.autoPick) return "Auto-Pick ist an — dein GM pickt für dich.";
  if (mein.status === "nachzug") return "Im Nachzug gibt es keine Reihenfolge, die man auslassen könnte.";
  if (!mein.amZug) return "Du kannst nur am eigenen Zug auslassen.";
  return "Die restlichen Runden würden nicht mehr bis zu 8 Spielern reichen.";
}

export function fertigSperrGrund(mein: { darfFertig: boolean; kader: number }, minKader: number): string | null {
  if (mein.darfFertig) return null;
  return `Fertig melden geht ab ${minKader} Spielern (du hast ${mein.kader}) — oder wenn nichts mehr leistbar ist.`;
}

/** Fertig-Grund eines Teams für die Anzeige. */
export const FERTIG_GRUND_TEXT: Record<string, string> = {
  abgebrochen: "Draft abgebrochen",
  mensch_fertig: "fertig gemeldet",
  max_picks: "Kader voll",
  draft_ende: "Draft zu Ende",
  nichts_leistbar: "nichts mehr leistbar",
  kader_voll: "Kader voll",
};

export function fertigGrundText(grund: string | null | undefined): string | null {
  if (!grund) return null;
  return FERTIG_GRUND_TEXT[grund] ?? grund;
}

/** Herkunftszeile eines Picks (Pick-Tafel/Ticker). */
export function pickHerkunft(e: { quelle: string; grund?: string | null }): string {
  // Der Grund `notkauf_mindestkader` bleibt im Kern, die Seite zeigt ihn neutral als normalen Pick (Chris: keine Notkaeufe).
  return e.quelle === "mensch" || e.quelle === "nachzug" ? "Mensch" : e.quelle === "auto" ? "Auto-Pick" : "KI";
}

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

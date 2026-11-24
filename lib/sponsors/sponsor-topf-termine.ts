/**
 * SPONSORENTERMIN: eine ENTSCHEIDUNG statt Wuerfel-Geld (24.11., Konzept 4.6). Hoechstens zwei je Saison und Team. Der Manager sagt zu
 * (+1,5 C, ein benannter Spieler hat Form -1 Stufe) oder ab. Der Betrag ist als Planwert (1,5 C je Team) schon im Topf eingerechnet.
 *
 * Wann ein Termin entsteht: deterministisch aus Saison und Team (zwei feste Spieltage, einer je Saisonhaelfte). `erzeugeTermine` laeuft beim
 * Spieltagsabschluss; die Entscheidung kommt vom Menschen (`entscheideTermin`, Route `/api/sponsor/topf`), von der delegierten KI (Bereich
 * "sponsor") oder von der KI. Ein Mensch, der nicht antwortet, haelt nichts auf: nach zwei Spieltagen verfaellt der Termin als "abgesagt".
 *
 * Gebucht wird als `SponsorEventRecord` (Typ "sponsor_termin", status "resolved"): damit steht er in derselben GuV-Zeile wie die frueheren
 * Sponsor-Ereignisse (`sponsor-event-cash-source.ts`). Die Kasse bewegt sich nur bei Zusage.
 */
import type { GameState, PlayerFormState, SponsorEventRecord } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { FORM_MORAL_NEUTRAL, FORM_PUNKTE_JE_STUFE } from "@/lib/morale/form-moral-modifikator";
import { gueltigerSponsorStempel, sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { SPONSOR_TOPF } from "@/lib/sponsors/sponsor-topf-modell";
import type { SponsorTermin } from "@/lib/sponsors/sponsor-topf-typen";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Die zwei Spieltage (1-basiert), nach denen ein Termin ansteht: einer je Saisonhaelfte, nicht an den Raendern. */
export function terminSpieltage(seasonId: string, teamId: string, spieltage: number): number[] {
  const n = Math.max(4, spieltage);
  const halb = Math.floor(n / 2);
  const a = 2 + Math.floor(hash(`${seasonId}:${teamId}:termin:a`) * Math.max(1, halb - 3));
  const b = halb + 2 + Math.floor(hash(`${seasonId}:${teamId}:termin:b`) * Math.max(1, n - halb - 4));
  return [a, Math.min(n - 2, Math.max(a + 1, b))];
}

/** Alle Termine der laufenden Saison (optional eines Teams). */
export function sponsorTermine(gameState: GameState, teamId?: string): SponsorTermin[] {
  const s = gueltigerSponsorStempel(gameState);
  const id = gameState.seasonState.seasonId ?? gameState.season.id;
  return (s?.termine ?? []).filter((t) => t.seasonId === id && (teamId == null || t.teamId === teamId));
}

export function offeneSponsorTermine(gameState: GameState, teamId?: string): SponsorTermin[] {
  return sponsorTermine(gameState, teamId).filter((t) => t.status === "offen");
}

function schreibeTermine(gameState: GameState, termine: SponsorTermin[]): GameState {
  const s = gueltigerSponsorStempel(gameState);
  if (!s) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorRegel: { ...s, termine } } };
}

/** Der benannte Spieler: das Aushaengeschild des Teams, sonst ein Spieler aus den besten acht nach Bewertung (deterministisch). */
export function terminSpieler(gameState: GameState, teamId: string, seed: string): string | null {
  const aus = gameState.seasonState.marketingAushaengeschild?.[teamId];
  const kader = gameState.rosters.filter((r) => r.teamId === teamId).map((r) => gameState.players.find((p) => p.id === r.playerId)).filter((p): p is NonNullable<typeof p> => p != null);
  if (aus && kader.some((p) => p.id === aus.playerId)) return aus.playerId;
  const beste = [...kader].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id)).slice(0, 8);
  if (beste.length === 0) return null;
  return beste[Math.floor(hash(seed) * beste.length)]!.id;
}

/**
 * Beim Abschluss von Spieltag `index` (1-basiert): neue Termine anlegen und alte, nicht beantwortete nach zwei Spieltagen verfallen lassen.
 * Idempotent (ein Termin ist durch Saison, Team und Spieltag eindeutig). Ohne Topf-Regel oder Notbremse: dieselbe Referenz zurueck.
 */
export function erzeugeTermine(gameState: GameState, index: number): GameState {
  const s = gueltigerSponsorStempel(gameState);
  if (!s || s.version !== "topf" || s.notbremse) return gameState;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season.id;
  const n = gameState.season.matchdayIds?.length ?? 0;
  const bisher = s.termine ?? [];
  const neue: SponsorTermin[] = [];
  for (const team of gameState.teams) {
    if (!getTeamSponsorContract(gameState, team.teamId)) continue;
    for (const nach of terminSpieltage(seasonId, team.teamId, n).slice(0, SPONSOR_TOPF.terminMax)) {
      if (nach !== index) continue;
      const id = `termin:${seasonId}:${team.teamId}:${nach}`;
      if (bisher.some((t) => t.id === id)) continue;
      neue.push({ id, seasonId, teamId: team.teamId, nachSpieltag: nach, status: "offen", spielerId: terminSpieler(gameState, team.teamId, id), betrag: SPONSOR_TOPF.terminBetrag });
    }
  }
  let geaendert = neue.length > 0;
  const verfallen = bisher.map((t) => {
    if (t.seasonId === seasonId && t.status === "offen" && index - t.nachSpieltag >= 2) {
      geaendert = true;
      return { ...t, status: "abgesagt" as const, entschiedenVon: "ki" as const };
    }
    return t;
  });
  return geaendert ? schreibeTermine(gameState, [...verfallen, ...neue]) : gameState;
}

/**
 * KI-Entscheidung (Konzept 7): zusagen, wenn der benannte Spieler nicht zu den besten vier des Kaders gehoert (er faellt am naechsten
 * Spieltag nicht ins Gewicht) oder die Kasse knapp ist; sonst absagen.
 */
export function kiTerminEntscheidung(gameState: GameState, termin: SponsorTermin): "zusagen" | "absagen" {
  const team = gameState.teams.find((t) => t.teamId === termin.teamId);
  if ((team?.cash ?? 0) < 20) return "zusagen";
  if (!termin.spielerId) return "zusagen";
  const kader = gameState.rosters
    .filter((r) => r.teamId === termin.teamId)
    .map((r) => gameState.players.find((p) => p.id === r.playerId))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id));
  const platz = kader.findIndex((p) => p.id === termin.spielerId);
  return platz < 0 || platz >= 4 ? "zusagen" : "absagen";
}

function formAbzug(gameState: GameState, teamId: string, playerId: string, matchdayId: string): GameState {
  const liste: PlayerFormState[] = gameState.playerFormState ?? [];
  const alt = liste.find((f) => f.playerId === playerId);
  const form = Math.max(0, (alt?.form ?? FORM_MORAL_NEUTRAL) - FORM_PUNKTE_JE_STUFE);
  const neu: PlayerFormState = alt
    ? { ...alt, form }
    : { playerId, teamId, form, lastSeasonId: gameState.season.id, lastMatchdayId: matchdayId, appearances: 0 };
  return {
    ...gameState,
    playerFormState: [...liste.filter((f) => f.playerId !== playerId), neu],
  };
}

/**
 * Beantwortet einen Termin. `antwort`: "zusagen" | "absagen" | "ki" (an die KI geben). Zusage bucht +1,5 C (Ereignis-Datensatz) und senkt die
 * Form des benannten Spielers um eine Stufe. Ein bereits entschiedener Termin bleibt unveraendert (Fehler `sponsor_termin_entschieden`).
 */
export function entscheideTermin(
  gameState: GameState,
  terminId: string,
  antwort: "zusagen" | "absagen" | "ki",
  von: "mensch" | "ki",
  opts: { saveId?: string; jetzt?: string } = {},
): { gameState: GameState; error?: string } {
  if (!sponsorTopfAktiv(gameState)) return { gameState, error: "sponsor_regel_nicht_topf" };
  const alle = gueltigerSponsorStempel(gameState)?.termine ?? [];
  const termin = alle.find((t) => t.id === terminId);
  if (!termin) return { gameState, error: "sponsor_termin_nicht_gefunden" };
  if (termin.status !== "offen") return { gameState, error: "sponsor_termin_entschieden" };
  const wahl = antwort === "ki" ? kiTerminEntscheidung(gameState, termin) : antwort;
  const jetzt = opts.jetzt ?? new Date().toISOString();
  const entschieden: SponsorTermin = { ...termin, status: wahl === "zusagen" ? "zugesagt" : "abgesagt", entschiedenVon: antwort === "ki" ? "ki" : von, entschiedenAm: jetzt };
  let g = schreibeTermine(gameState, alle.map((t) => (t.id === terminId ? entschieden : t)));
  if (wahl === "zusagen") {
    const vertrag = getTeamSponsorContract(g, termin.teamId);
    const ereignis: SponsorEventRecord = {
      eventId: `sponsor-event:${termin.id}`,
      saveId: opts.saveId ?? "",
      seasonId: termin.seasonId,
      teamId: termin.teamId,
      matchday: termin.nachSpieltag,
      eventType: "sponsor_termin",
      sponsorName: vertrag?.name ?? "Sponsor",
      cashDelta: termin.betrag,
      status: "resolved",
      createdAt: jetzt,
      message: `${vertrag?.name ?? "Der Sponsor"}: Sponsorentermin wahrgenommen, +${termin.betrag.toFixed(1)} C.`,
    };
    g = {
      ...g,
      teams: g.teams.map((t) => (t.teamId === termin.teamId ? { ...t, cash: Math.round((t.cash + termin.betrag) * 10) / 10 } : t)),
      seasonState: { ...g.seasonState, sponsorEvents: [...(g.seasonState.sponsorEvents ?? []), ereignis] },
    };
    if (termin.spielerId) g = formAbzug(g, termin.teamId, termin.spielerId, g.matchdayState?.matchdayId ?? "");
  }
  return { gameState: g };
}

/**
 * Die KI beantwortet alle offenen Termine der Teams, die nicht von einem Menschen selbst gefuehrt werden: KI-Teams, passive Teams und
 * Menschen, die den Bereich "sponsor" delegiert haben. Menschliche Teams ohne Delegation bleiben offen (sie verfallen nach zwei Spieltagen).
 */
export function beantworteTermineDerKi(gameState: GameState, opts: { saveId?: string } = {}): GameState {
  const offen = offeneSponsorTermine(gameState);
  if (offen.length === 0) return gameState;
  const settings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let g = gameState;
  for (const termin of offen) {
    const c = settings[termin.teamId];
    if (c?.controlMode === "manual" && !isBereichDelegiert(c, "sponsor")) continue;
    const r = entscheideTermin(g, termin.id, "ki", "ki", opts);
    if (!r.error) g = r.gameState;
  }
  return g;
}

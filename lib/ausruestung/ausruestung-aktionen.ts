/**
 * AUSRUESTUNG: AKTIONEN DES MENSCHEN (Phase 1a, 22.11.). Eine Funktion fuer den Schreibweg (`app/api/ausruestung/route.ts`):
 * Truhe oeffnen, Fund waehlen, Kiste verwerfen, Teil zerlegen. Rein; die Route prueft Besitz und Raum-Schutz vorher.
 *
 * Dieselben Funktionen wie die KI (`ausruestung-truhen.ts`, `ausruestung-lager.ts`): es gibt keine zweite Regel fuer Menschen.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { TRUHEN_ARTEN } from "@/lib/ausruestung/ausruestung-katalog";
import { leseTeam, mitVerlauf, schreibeTeam, zerlegeTeil } from "@/lib/ausruestung/ausruestung-lager";
import { ausruestungRegelFuer } from "@/lib/ausruestung/ausruestung-regel";
import { fehlerText, oeffneKiste, verwerfeKiste, waehleFund } from "@/lib/ausruestung/ausruestung-truhen";
import type { TruhenArt } from "@/lib/ausruestung/ausruestung-typen";

export type AusruestungAktion =
  | { aktion: "kiste_oeffnen"; truhe: TruhenArt }
  | { aktion: "fund_waehlen"; index: number }
  | { aktion: "kiste_verwerfen" }
  | { aktion: "zerlegen"; teilId: string };

export type AusruestungAktionErgebnis = { ok: boolean; reason: string | null; meldung: string; gameState: GameState };

export function istAusruestungAktion(x: unknown): x is AusruestungAktion {
  if (!x || typeof x !== "object") return false;
  const a = x as Record<string, unknown>;
  if (a.aktion === "kiste_oeffnen") return typeof a.truhe === "string" && (TRUHEN_ARTEN as readonly string[]).includes(a.truhe);
  if (a.aktion === "fund_waehlen") return typeof a.index === "number" && Number.isInteger(a.index);
  if (a.aktion === "kiste_verwerfen") return true;
  if (a.aktion === "zerlegen") return typeof a.teilId === "string" && a.teilId.length > 0;
  return false;
}

export function wendeAusruestungAktionAn(
  gameState: GameState,
  teamId: string,
  eingabe: AusruestungAktion,
  env: Record<string, string | undefined> = process.env,
): AusruestungAktionErgebnis {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team) return { ok: false, reason: "team_unbekannt", meldung: "Team nicht gefunden.", gameState };
  const ids = gameState.season.matchdayIds ?? [];
  const gebucht = new Set((gameState.seasonState.matchdayResults ?? []).map((r) => r.matchdayId));
  const regel = ausruestungRegelFuer(gameState, ids.find((id) => !gebucht.has(id)) ?? null, env);
  if (!regel.besitz) return { ok: false, reason: "nicht_aktiv", meldung: fehlerText("nicht_aktiv"), gameState };
  const verlauf = team.humanControlled;

  if (eingabe.aktion === "kiste_oeffnen") {
    const r = oeffneKiste(gameState, teamId, eingabe.truhe, regel, verlauf);
    return r.ok ? { ok: true, reason: null, meldung: r.meldung, gameState: r.gameState } : { ok: false, reason: r.grund, meldung: r.meldung, gameState };
  }
  if (eingabe.aktion === "fund_waehlen") {
    const r = waehleFund(gameState, teamId, eingabe.index, verlauf);
    return r.ok ? { ok: true, reason: null, meldung: r.meldung, gameState: r.gameState } : { ok: false, reason: r.grund, meldung: r.meldung, gameState };
  }
  if (eingabe.aktion === "kiste_verwerfen") {
    const r = verwerfeKiste(gameState, teamId, verlauf);
    return r.ok ? { ok: true, reason: null, meldung: r.meldung, gameState: r.gameState } : { ok: false, reason: r.grund, meldung: r.meldung, gameState };
  }
  const z = zerlegeTeil(leseTeam(gameState, teamId), eingabe.teilId);
  if (!z.ok) return { ok: false, reason: z.grund, meldung: "Dieses Teil liegt nicht in deinem Lager.", gameState };
  const sp = gameState.ausruestung?.spieltage ?? 0;
  const neu = mitVerlauf(z.team, sp, `Zerlegt: ${z.teil.name} (+${z.teile} Teile)`, verlauf);
  return { ok: true, reason: null, meldung: `${z.teil.name} zerlegt: ${z.teile} Teile.`, gameState: schreibeTeam(gameState, teamId, neu) };
}

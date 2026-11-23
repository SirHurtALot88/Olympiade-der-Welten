/**
 * AUSHAENGESCHILD WAEHLEN (23.11., docs/design/werbeklausel-aushaengeschild-23-11.md; Entscheidungen des Projektleiters zu Mockup Runde 4).
 *
 * Eine Rechenstelle fuer Seite und Server: `pruefeAushaengeschildWahl` sagt, ob der Manager jetzt waehlen darf und warum nicht;
 * `waehleAushaengeschild` schreibt die Wahl in `seasonState.marketingAushaengeschild`. Regeln:
 *  - nur mit der Regel `klausel-v2` (Stempel), nur unter den sechs besten des Kaders;
 *  - mit „Bestaetigen“ gesperrt bis Saisonende (`gesperrt: true`);
 *  - nur VOR dem ersten gebuchten Spieltag: ohne Wahl gilt die KI-Wahl (Zusatzertrag), und ein delegierter Bereich (Sponsor) bleibt bis dahin
 *    vom Menschen ueberschreibbar („Mensch ueberschreibt, KI respektiert das“);
 *  - die Berechtigung (nur der Manager des Teams) prueft der Schreibweg ueber `authorizeServerRoomWrite`, nie diese Funktion.
 */
import { gespielteSpieltage } from "@/lib/contracts/verlaengerung-in-saison";
import type { GameState } from "@/lib/data/olyDataTypes";
import { besteSechs, gewaehltesAushaengeschild } from "@/lib/marketing/marketing-kontext";
import { werbeklauselAktiv } from "@/lib/marketing/marketing-regel";

export type AushaengeschildPruefung = { ok: true } | { ok: false; reason: string; meldung: string };

export function pruefeAushaengeschildWahl(gameState: GameState, teamId: string, playerId: string | null): AushaengeschildPruefung {
  if (!werbeklauselAktiv(gameState)) {
    return { ok: false, reason: "regel_aus", meldung: "Das Aushängeschild gilt erst mit der neuen Marketing-Regel (nächster Saisonwechsel)." };
  }
  if (gewaehltesAushaengeschild(gameState, teamId)?.gesperrt) {
    return { ok: false, reason: "gesperrt", meldung: "Das Aushängeschild ist bis Saisonende gesperrt." };
  }
  if (gespielteSpieltage(gameState) > 0) {
    return { ok: false, reason: "zu_spaet", meldung: "Seit dem ersten Spieltag gilt die Wahl der KI; ein Wechsel ist erst nach dem Saisonwechsel wieder möglich." };
  }
  if (playerId != null && !besteSechs(gameState, teamId).some((k) => k.player.id === playerId)) {
    return { ok: false, reason: "nicht_unter_den_besten_sechs", meldung: "Das Aushängeschild muss unter deinen sechs besten Spielern stehen." };
  }
  return { ok: true };
}

export function waehleAushaengeschild(
  gameState: GameState,
  teamId: string,
  playerId: string,
): { ok: true; gameState: GameState } | { ok: false; reason: string; meldung: string } {
  const pruefung = pruefeAushaengeschildWahl(gameState, teamId, playerId);
  if (!pruefung.ok) return pruefung;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season.id;
  return {
    ok: true,
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        marketingAushaengeschild: {
          ...(gameState.seasonState.marketingAushaengeschild ?? {}),
          [teamId]: { seasonId, playerId, gesperrt: true, von: "mensch" },
        },
      },
    },
  };
}

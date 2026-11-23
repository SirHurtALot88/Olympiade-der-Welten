/**
 * ARENA-REGEL JE SAISON (22.11., docs/design/arena-tickets-medaillen-22-11.md; Muster `lib/marketing/marketing-regel.ts`).
 *
 * Tickets (Platzarten Steh/Sitz/Loge, Tageskasse je Heimspiel), Dauerkarten und der Ausbau von Hand haengen an der SAISON, nicht am
 * Serverstart: sie buchen je Spieltag in die Kasse. Schaltete ein Neustart mitten in der Saison um, passten Ledger und Anzeige nicht
 * mehr zusammen. Deshalb steht die Regel IM SPIELSTAND (`seasonState.arenaRegel`) und wird genau zweimal gesetzt: beim Anlegen eines
 * Spiels und beim Saisonwechsel.
 *
 *   "an"    Platzarten, Tickets, Dauerkarten, Ausbau von Hand. Das Gebaeude "Arena Upgrade" zahlt nichts mehr und kostet nichts mehr.
 *   "aus"   Rueckweg / bestehender Spielstand: das alte Gebaeude "Arena Upgrade" bleibt wie es war.
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "aus"; die Lade-Migration (`stempleArenaNachLaden`)
 * schreibt fuer die laufende Saison "aus" fest, ab dem naechsten Saisonwechsel gilt der Schalter. Der erste Stempel "an" eines alten
 * Spielstands traegt `umstieg: true`: die erste Arena jedes Teams wird dann aus seiner Stufe des Gebaeudes "Arena Upgrade" abgebildet
 * (`arenaAusAltemGebaeude`, Tabelle in der Doku).
 *
 * SCHALTER `OLY_ARENA` (nur Server, deploy/hetzner/docker-compose.yml + .env; kein NEXT_PUBLIC):
 *   nicht gesetzt | "an"   neue Saisons bekommen "an" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "aus"; gestempelte Saisons rechnen weiter wie gestempelt
 *   "aus-sofort"           Notbremse: schaltet die WIRKUNG ab (keine Buchung, kein Ausbau), auch mitten in der Saison
 *
 * Jeder Rechenweg fragt `arenaAktiv(gameState)`, nie die Variable.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { istJeSpieltagSaison } from "@/lib/finance/finanzen-je-spieltag";
import type { ArenaPlaetze, ArenaRegelStempel } from "@/lib/arena/arena-typen";
import { GRUND_PLAETZE } from "@/lib/arena/arena-modell";

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "aus";
  return "an";
}

/** Nur Server-Variable: der Stempel wird auf dem Server gesetzt, der Browser liest ihn aus dem Spielstand. */
export function arenaSchalter(): Schalter {
  return leseSchalter(process.env.OLY_ARENA) ?? "an";
}

export type ArenaQuelle =
  | {
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      seasonState?: (Pick<SeasonState, "seasonId"> & Partial<Pick<SeasonState, "arenaRegel" | "finanzenJeSpieltag">>) | null;
    }
  | null
  | undefined;

/** Ein kurzer, im Spielstand gespeicherter Wuerfelstrom fuer die ligaweiten Ereignisse. */
function neueSaat(seasonId: string): string {
  return `${seasonId}:${Math.floor(Math.random() * 0xffffff).toString(16)}`;
}

/** Der Stempel fuer eine NEU beginnende Saison. `vorher` ist der Stempel der abgelaufenen Saison. */
export function arenaRegelFuerNeueSaison(seasonId: string, vorher?: ArenaRegelStempel | null, neuesSpiel = false): ArenaRegelStempel {
  const regel = arenaSchalter() === "an" ? "an" : "aus";
  const wardAn = neuesSpiel || vorher?.regel === "an";
  return {
    seasonId,
    regel,
    ...(regel === "an" && !wardAn ? { umstieg: true } : {}),
    saat: neueSaat(seasonId),
  };
}

/** Setzt den Stempel beim ANLEGEN eines Spiels (neues Spiel: keine Abbildung, die Grundarena gilt). Idempotent. */
export function stempleArenaBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.arenaRegel?.seasonId === seasonId) return gameState;
  const stempel = arenaRegelFuerNeueSaison(seasonId, null, true);
  return { ...gameState, seasonState: { ...gameState.seasonState, arenaRegel: stempel } };
}

/**
 * LADE-MIGRATION: ein Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "aus" -- die Saison laeuft mit dem alten Gebaeude zu
 * Ende, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleArenaNachLaden<T extends { seasonState?: SeasonState | null }>(gameState: T): T {
  if (!gameState?.seasonState) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.arenaRegel?.seasonId === seasonId) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, arenaRegel: { seasonId, regel: "aus" as const, saat: seasonId } },
  };
}

/** Der gueltige Stempel der laufenden Saison, sonst `null`. */
export function gueltigerArenaStempel(gameState: ArenaQuelle): ArenaRegelStempel | null {
  const stempel = gameState?.seasonState?.arenaRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/** Gilt die neue Arena in dieser Saison? Gueltiger Stempel "an", keine Notbremse UND Finanzen je Spieltag (dort wird gebucht). */
export function arenaAktiv(gameState: ArenaQuelle): boolean {
  if (arenaSchalter() === "aus-sofort") return false;
  const stempel = gueltigerArenaStempel(gameState);
  if (!stempel || stempel.regel !== "an" || stempel.notbremse) return false;
  return istJeSpieltagSaison(gameState as Parameters<typeof istJeSpieltagSaison>[0]);
}

/**
 * ABBILDUNG DES ALTEN GEBAEUDES (Umstieg): Stufe 0 = Grundarena; die Stufen 1 bis 5 des Gebaeudes "Arena Upgrade" (Einnahme 2,4 / 6,0 /
 * 10,8 / 17,7 / 28,5 C bei Beliebtheit 1) werden auf Plaetze gelegt, deren volles Haus in Liga 2 die Einnahme von damals ersetzt
 * (volles Haus der Grundarena 3,0 C + Einnahme). Die Stufe 5 ist die volle Obergrenze. Der Bau ist bezahlt, nichts wird erstattet.
 */
export const ABBILDUNG_ARENA_STUFE: ReadonlyArray<ArenaPlaetze> = [
  { ...GRUND_PLAETZE },
  { steh: 6000, sitz: 2000, loge: 0 },
  { steh: 8000, sitz: 3000, loge: 0 },
  { steh: 10000, sitz: 5000, loge: 100 },
  { steh: 13000, sitz: 7000, loge: 400 },
  { steh: 15000, sitz: 10000, loge: 1200 },
];

export function arenaAusAltemGebaeude(stufe: number): ArenaPlaetze {
  const i = Math.max(0, Math.min(ABBILDUNG_ARENA_STUFE.length - 1, Math.round(stufe)));
  return { ...ABBILDUNG_ARENA_STUFE[i]! };
}

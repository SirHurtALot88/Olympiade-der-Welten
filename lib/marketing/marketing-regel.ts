/**
 * MARKETING-REGEL JE SAISON (22.11., docs/design/marketing-22-11.md; Muster `lib/resolve/formkarten-regel.ts`).
 *
 * Marketing (Werbegeld je Spieler, Team-Anteil in der Kasse, Teammarke, Moral-Zuschlag) haengt an der SAISON, nicht am Serverstart:
 * es bucht je Spieltag in die Kasse und hebt die Moral. Schaltete ein Neustart mitten in der Saison um, passten Ledger und Anzeige
 * nicht mehr zusammen. Deshalb steht die Regel IM SPIELSTAND (`seasonState.marketingRegel`) und wird genau zweimal gesetzt: beim
 * Anlegen eines Spiels und beim Saisonwechsel.
 *
 *   "an"    Marketing gilt (nur zusammen mit Finanzen je Spieltag: dort wird gebucht)
 *   "aus"   Rueckweg / bestehender Spielstand: nichts davon
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "aus"; die Lade-Migration
 * (`stempleMarketingNachLaden`) schreibt fuer die laufende Saison "aus" fest, ab dem naechsten Saisonwechsel gilt der Schalter.
 *
 * SCHALTER `OLY_MARKETING` (nur Server, deploy/hetzner/docker-compose.yml + .env; kein NEXT_PUBLIC):
 *   nicht gesetzt | "an"   neue Saisons bekommen "an" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "aus"; gestempelte Saisons rechnen weiter wie gestempelt
 *   "aus-sofort"           Notbremse: schaltet die WIRKUNG ab (keine Buchung, kein Moral-Zuschlag), auch mitten in der Saison
 *
 * Jeder Rechenweg fragt `marketingAktiv(gameState)`, nie die Variable.
 */
import { istJeSpieltagSaison } from "@/lib/finance/finanzen-je-spieltag";
import { FANPROFILE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type MarketingStempel = NonNullable<SeasonState["marketingRegel"]>;

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "aus";
  return "an";
}

/** Nur Server-Variable: der Stempel wird auf dem Server gesetzt, der Browser liest ihn aus dem Spielstand. */
export function marketingSchalter(): Schalter {
  return leseSchalter(process.env.OLY_MARKETING) ?? "an";
}

export type MarketingQuelle =
  | {
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      seasonState?: (Pick<SeasonState, "seasonId"> & Partial<Pick<SeasonState, "marketingRegel" | "finanzenJeSpieltag">>) | null;
    }
  | null
  | undefined;

/** Start-Fanfarben je Team aus den Stammdaten. */
export function startFanfarben(teamIds: readonly string[]): Record<string, Fanfarbe> {
  const aus: Record<string, Fanfarbe> = {};
  for (const id of teamIds) {
    const p = FANPROFILE[id];
    aus[id] = p ? [...p.farbeStart] : [5, 5, 5, 5];
  }
  return aus;
}

/**
 * Der Stempel fuer eine NEU beginnende Saison. `vorher` ist der Stempel der abgelaufenen Saison (traegt Fanfarbe und Verlauf fort);
 * `fanfarbe` die frisch gedriftete Farbe. Ohne beides startet jedes Team bei seiner Start-Farbe.
 */
export function marketingRegelFuerNeueSaison(
  seasonId: string,
  teamIds: readonly string[],
  optionen?: { fanfarbe?: Record<string, Fanfarbe>; verlauf?: MarketingStempel["verlauf"]; teamErfolg?: MarketingStempel["teamErfolg"] },
): MarketingStempel {
  const s = marketingSchalter();
  return {
    seasonId,
    regel: s === "an" ? "an" : "aus",
    fanfarbe: optionen?.fanfarbe ?? startFanfarben(teamIds),
    ...(optionen?.verlauf ? { verlauf: optionen.verlauf } : {}),
    ...(optionen?.teamErfolg ? { teamErfolg: optionen.teamErfolg } : {}),
  };
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleMarketingBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.marketingRegel?.seasonId === seasonId) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, marketingRegel: marketingRegelFuerNeueSaison(seasonId, gameState.teams.map((t) => t.teamId)) },
  };
}

/**
 * LADE-MIGRATION: ein Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "aus" -- die Saison laeuft ohne Marketing zu Ende,
 * ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleMarketingNachLaden<T extends { seasonState?: SeasonState | null }>(gameState: T): T {
  if (!gameState?.seasonState) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.marketingRegel?.seasonId === seasonId) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, marketingRegel: { seasonId, regel: "aus" as const } },
  };
}

/** Der gueltige Stempel der laufenden Saison, sonst `null`. */
export function gueltigerMarketingStempel(gameState: MarketingQuelle): MarketingStempel | null {
  const stempel = gameState?.seasonState?.marketingRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/**
 * Gilt Marketing in dieser Saison? Gueltiger Stempel "an", keine Notbremse UND Finanzen je Spieltag (dort wird gebucht). Ohne
 * Spielstand: nein.
 */
export function marketingAktiv(gameState: MarketingQuelle): boolean {
  if (marketingSchalter() === "aus-sofort") return false;
  const stempel = gueltigerMarketingStempel(gameState);
  // Die Notbremse steht auch im Stempel (der Server spiegelt sie beim naechsten Buchen), damit der Browser sie sieht.
  if (!stempel || stempel.regel !== "an" || stempel.notbremse) return false;
  return istJeSpieltagSaison(gameState as Parameters<typeof istJeSpieltagSaison>[0]);
}

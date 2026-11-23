/**
 * MEDAILLEN-REGEL JE SAISON (22.11., docs/design/arena-tickets-medaillen-22-11.md; Muster `lib/marketing/marketing-regel.ts`).
 *
 * Disziplin-Medaillen (Gold/Silber/Bronze je Liga und Disziplin) und Farb-Meister (bestes Team je Disziplinfarbe) buchen am Saisonende
 * Geld und heben bei bestimmten Traits die Moral. Das Geld kommt aus dem Rangpraemien-Topf des Sponsors (PM 22.11.): jede Rangpraemie
 * sinkt um `rangAbzug`, damit die Auszahlung an die Liga gleich bleibt. Weil der Abzug die ganze Saison gilt (Rang-Abschlaege je
 * Spieltag), steht die Regel IM SPIELSTAND (`seasonState.medaillenRegel`), gesetzt beim Anlegen eines Spiels und beim Saisonwechsel.
 *
 * BESTEHENDE SAVES: ohne Stempel gilt "aus" (Lade-Migration `stempleMedaillenNachLaden`); ab dem naechsten Saisonwechsel gilt der Schalter.
 *
 * SCHALTER `OLY_MEDAILLEN` (nur Server): leer | "an" = neue Saisons "an"; "aus" = Rueckweg fuer neue Saisons; "aus-sofort" = Notbremse
 * (keine Vergabe, kein Abzug, kein Moral-Effekt). Jeder Rechenweg fragt `medaillenAktiv(gameState)`, nie die Variable.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { istJeSpieltagSaison } from "@/lib/finance/finanzen-je-spieltag";
import type { MedaillenRegelStempel } from "@/lib/medaillen/medaillen-typen";

/**
 * Der Topf-Abzug: 52 C (Medaillen 32 + Farb-Meister 20) von rund 620 C Rangpraemien der Liga (Konzept g.1, Variante B) = 8,4 %.
 * Die tatsaechliche Summe misst `scripts/auswerte-arena-tickets-medaillen.ts` und steht in der Doku.
 */
export const RANG_ABZUG_VORGABE = 0.084;

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "aus";
  return "an";
}

export function medaillenSchalter(): Schalter {
  return leseSchalter(process.env.OLY_MEDAILLEN) ?? "an";
}

export type MedaillenQuelle =
  | {
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      seasonState?: (Pick<SeasonState, "seasonId"> & Partial<Pick<SeasonState, "medaillenRegel" | "finanzenJeSpieltag">>) | null;
    }
  | null
  | undefined;

export function medaillenRegelFuerNeueSaison(seasonId: string, moralVorsaison?: MedaillenRegelStempel["moralVorsaison"]): MedaillenRegelStempel {
  return {
    seasonId,
    regel: medaillenSchalter() === "an" ? "an" : "aus",
    rangAbzug: RANG_ABZUG_VORGABE,
    ...(moralVorsaison && Object.keys(moralVorsaison).length > 0 ? { moralVorsaison } : {}),
  };
}

export function stempleMedaillenBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.medaillenRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, medaillenRegel: medaillenRegelFuerNeueSaison(seasonId) } };
}

export function stempleMedaillenNachLaden<T extends { seasonState?: SeasonState | null }>(gameState: T): T {
  if (!gameState?.seasonState) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.medaillenRegel?.seasonId === seasonId) return gameState;
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, medaillenRegel: { seasonId, regel: "aus" as const, rangAbzug: 0 } },
  };
}

export function gueltigerMedaillenStempel(gameState: MedaillenQuelle): MedaillenRegelStempel | null {
  const stempel = gameState?.seasonState?.medaillenRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/** Gelten Medaillen und Farb-Meister in dieser Saison? Gueltiger Stempel "an", keine Notbremse, Finanzen je Spieltag. */
export function medaillenAktiv(gameState: MedaillenQuelle): boolean {
  if (medaillenSchalter() === "aus-sofort") return false;
  const stempel = gueltigerMedaillenStempel(gameState);
  if (!stempel || stempel.regel !== "an" || stempel.notbremse) return false;
  return istJeSpieltagSaison(gameState as Parameters<typeof istJeSpieltagSaison>[0]);
}

/** Der Faktor auf jede Sponsor-Rangpraemie: 1 ohne Medaillen-Regel, sonst 1 - Topf-Abzug. */
export function rangPraemieFaktor(gameState: MedaillenQuelle): number {
  if (!medaillenAktiv(gameState)) return 1;
  const a = gueltigerMedaillenStempel(gameState)?.rangAbzug ?? 0;
  return Math.min(1, Math.max(0, 1 - a));
}

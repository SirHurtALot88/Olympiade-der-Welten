/**
 * ENTWICKLUNGSREGEL JE SAISON (22.11., docs/design/entwicklung-balance-22-11.md).
 *
 * Chris, 22.11.: nur wenige Spieler verbessern oder verschlechtern sich stark, die Masse kaum; das Liga-Mittel der
 * Netto-Summe aller zwoelf Attribute bleibt zwischen -1 und +1; zwischen Trainingspunkten (SP) und Leistung (PP) besteht
 * ein gesundes Verhaeltnis (SP bestimmen, WOHIN ein Spieler waechst, PP, WIE VIEL davon ankommt).
 *
 * Die Regel haengt an der SAISON, nicht am Serverstart: das Training wird je Spieltag gebucht, die PP-Wirkung rechnet am
 * Saisonende. Schaltete ein Neustart mitten in der Saison um, rechnete das Saisonende anders, als die Saison gespielt wurde.
 * Deshalb steht die Regel IM SPIELSTAND (`seasonState.entwicklungsRegel`) und wird genau zweimal gesetzt: beim Anlegen eines
 * Spiels und beim Saisonwechsel (`preseason-workflow-service.ts`). Muster: `formkarten-regel.ts`, `wertungs-skalen.ts`.
 *
 *   "neu"   Entwicklung nach Chris' Vorgaben vom 22.11. (PP-Faktor auf das Training, Ertragskurve, Verfall, mittelwert-
 *           neutrale Potentialdrift)
 *   "alt"   Stand vor dem 22.11.
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "alt"; die Lade-Migration
 * (`stempleEntwicklungsRegelNachLaden`, save-repository.ts) schreibt fuer die laufende Saison "alt" fest, ab dem naechsten
 * Saisonwechsel gilt der Schalter. Kein Prozesszustand: jeder Rechenweg liest den Stempel des Spielstands, den er rechnet.
 *
 * SCHALTER `OLY_ENTWICKLUNG` (nur Server, deploy/hetzner/docker-compose.yml):
 *   nicht gesetzt | "neu" | "an"   neue Saisons bekommen "neu" (Standard)
 *   "alt" | "aus" | "0"            Rueckweg: neue Saisons bekommen "alt"; gestempelte Saisons rechnen weiter wie gestempelt
 * Nur Battle-Spielstaende bekommen einen Stempel; der Manager-Modus bleibt "alt".
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type EntwicklungsRegelVersion = "alt" | "neu";

export type EntwicklungsRegelStempel = { seasonId: string; regel: EntwicklungsRegelVersion };

function leseSchalter(wert: string | undefined): EntwicklungsRegelVersion | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "alt" || w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off") return "alt";
  return "neu";
}

/** Nur Server-Variable: der Stempel wird auf dem Server gesetzt, der Browser liest ihn aus dem Spielstand. */
export function entwicklungsRegelSchalter(): EntwicklungsRegelVersion {
  return leseSchalter(process.env.OLY_ENTWICKLUNG) ?? "neu";
}

export type EntwicklungsRegelQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId"> & { entwicklungsRegel?: EntwicklungsRegelStempel | null }) | null;
      season?: { id?: string } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function istBattle(gameState: EntwicklungsRegelQuelle): boolean {
  return gameState?.scenarioMeta?.gameMode === "battle";
}

/** Der Stempel fuer eine NEU beginnende Saison, aus dem Schalter. */
export function entwicklungsRegelFuerNeueSaison(seasonId: string): EntwicklungsRegelStempel {
  return { seasonId, regel: entwicklungsRegelSchalter() };
}

/** Der Stempel eines neuen Saisonstands je Spielmodus: Battle bekommt ihn, Manager keinen. */
export function entwicklungsRegelFuerSpielmodus(gameState: EntwicklungsRegelQuelle, seasonId: string): EntwicklungsRegelStempel | undefined {
  return istBattle(gameState) ? entwicklungsRegelFuerNeueSaison(seasonId) : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleEntwicklungsRegelBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !istBattle(gameState)) return gameState;
  if (gameState.seasonState?.entwicklungsRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, entwicklungsRegel: entwicklungsRegelFuerNeueSaison(seasonId) } };
}

/**
 * LADE-MIGRATION: ein Battle-Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "alt" -- die Saison rechnet
 * zu Ende wie gespielt, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleEntwicklungsRegelNachLaden<T extends NonNullable<EntwicklungsRegelQuelle> & Pick<GameState, "seasonState">>(gameState: T): T {
  if (!gameState?.seasonState || !istBattle(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.entwicklungsRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, entwicklungsRegel: { seasonId, regel: "alt" as const } } };
}

/** Die Entwicklungsregel DIESER Saison. Fehlender oder fremder Stempel: "alt". */
export function entwicklungsRegelFuer(gameState: EntwicklungsRegelQuelle): EntwicklungsRegelVersion {
  const stempel = gameState?.seasonState?.entwicklungsRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return "alt";
  return stempel.regel;
}

/** Kurzform fuer die Rechenwege: gilt in dieser Saison die neue Entwicklungsregel? Ohne Spielstand: nein. */
export function entwicklungNeuFuer(gameState: EntwicklungsRegelQuelle): boolean {
  return entwicklungsRegelFuer(gameState) === "neu";
}

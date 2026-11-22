/**
 * FORMKARTEN-REGEL JE SAISON (22.11., docs/design/formkarten-plusminus-22-11.md).
 *
 * Die Plus/Minus-Karten (Gegenfarbe POW/MEN, SPE/SOC mit Faktor 0,25, Kartenwerte 2/4/6/8 ohne 0, KI-Duellgewicht)
 * haengen an der SAISON, nicht am Serverstart: die Kartenwerte werden beim Anlegen der Saisonkarten gezogen
 * (`ensureLocalFormCardsForSeason`) und ungespielte Karten werden dort sogar auf den Sollwert zurueckkorrigiert. Schaltete
 * ein Neustart mitten in der Saison um, aenderten sich Kartenwerte und Wirkung schon gebuchter Aufstellungen.
 * Deshalb steht die Regel IM SPIELSTAND (`seasonState.formkartenRegel`) und wird genau zweimal gesetzt: beim Anlegen
 * eines Spiels und beim Saisonwechsel (`preseason-workflow-service.ts`). Muster: `wertungs-skalen.ts`.
 *
 *   "plusminus"  Gegenfarbe + Kartenwerte [2,4,6,8] + KI-Duellgewicht
 *   "alt"        Regel von 18.11.: Kartenwerte [0,2,4,8], keine Gegenfarbe
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "alt"; die Lade-Migration
 * (`stempleFormkartenRegelNachLaden`, save-repository.ts) schreibt fuer die laufende Saison "alt" fest, ab dem
 * naechsten Saisonwechsel gilt "plusminus". Kein Prozesszustand: jeder Aufruf liest den Stempel des Spielstands, den er rechnet.
 *
 * SCHALTER `OLY_FORMKARTEN_PLUSMINUS` (nur Server, deploy/hetzner/docker-compose.yml; der Browser loest die Regel nie selbst auf):
 *   nicht gesetzt | "an"   neue Saisons bekommen "plusminus" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "alt"; gestempelte Saisons rechnen weiter wie gestempelt
 *   "aus-sofort"           Notbremse: schaltet die WIRKUNG ab (Gegenfarbe, Duellgewicht), auch mitten in der Saison. Die
 *                          Kartenwerte bleiben (`formkartenKartenwerteNeu` liest nur den Stempel): sonst wuerden ungespielte
 *                          Karten eines Menschen still umgeschrieben; die alte Regel rechnet mit 2/4/6/8 genauso (nur Werte).
 * Nur Battle-Spielstaende bekommen einen Stempel; der Manager-Modus bleibt "alt".
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type FormkartenRegelVersion = "alt" | "plusminus";

export type FormkartenRegelStempel = { seasonId: string; regel: FormkartenRegelVersion };

/** Kartenwerte der Plus/Minus-Regel: keine 0, Mittel 5 (Chris, 22.11.: 2/4/6/8). */
export const FORMKARTEN_WERTE_PLUSMINUS = [2, 4, 6, 8] as const;

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "aus";
  return "an";
}

/**
 * Nur Server-Variable: der Stempel wird auf dem Server gesetzt, der Browser liest ihn aus dem Spielstand. Die Notbremse `aus-sofort`
 * wirkt im Browser deshalb nur ueber den Stempel, den der Server mitliefert (`formkartenRegelFuer` im Browser sieht die Variable nicht).
 */
export function formkartenRegelSchalter(): Schalter {
  return leseSchalter(process.env.OLY_FORMKARTEN_PLUSMINUS) ?? "an";
}

export type FormkartenRegelQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId"> & { formkartenRegel?: FormkartenRegelStempel | null }) | null;
      season?: { id?: string } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function istBattle(gameState: FormkartenRegelQuelle): boolean {
  return gameState?.scenarioMeta?.gameMode === "battle";
}

/** Der Stempel fuer eine NEU beginnende Saison, aus dem Schalter. */
export function formkartenRegelFuerNeueSaison(seasonId: string): FormkartenRegelStempel {
  const s = formkartenRegelSchalter();
  return { seasonId, regel: s === "an" ? "plusminus" : "alt" };
}

/** Der Stempel eines neuen Saisonstands je Spielmodus: Battle bekommt ihn, Manager keinen. */
export function formkartenRegelFuerSpielmodus(gameState: FormkartenRegelQuelle, seasonId: string): FormkartenRegelStempel | undefined {
  return istBattle(gameState) ? formkartenRegelFuerNeueSaison(seasonId) : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleFormkartenRegelBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !istBattle(gameState)) return gameState;
  if (gameState.seasonState?.formkartenRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, formkartenRegel: formkartenRegelFuerNeueSaison(seasonId) } };
}

/**
 * LADE-MIGRATION: ein Battle-Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "alt" -- die Saison rechnet
 * ihre schon gezogenen Karten zu Ende, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleFormkartenRegelNachLaden<T extends NonNullable<FormkartenRegelQuelle> & Pick<GameState, "seasonState">>(gameState: T): T {
  if (!gameState?.seasonState || !istBattle(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.formkartenRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, formkartenRegel: { seasonId, regel: "alt" as const } } };
}

/** Nur der Stempel der laufenden Saison, ohne Notbremse: bestimmt die KARTENWERTE (2/4/6/8 statt 0/2/4/8). */
export function formkartenKartenwerteNeu(gameState: FormkartenRegelQuelle): boolean {
  const stempel = gameState?.seasonState?.formkartenRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  return Boolean(stempel && seasonId && stempel.seasonId === seasonId && stempel.regel === "plusminus");
}

/** Die WIRKUNGS-Regel DIESER Saison. Notbremse und fehlender/fremder Stempel: "alt". */
export function formkartenRegelFuer(gameState: FormkartenRegelQuelle): FormkartenRegelVersion {
  if (formkartenRegelSchalter() === "aus-sofort") return "alt";
  const stempel = gameState?.seasonState?.formkartenRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return "alt";
  return stempel.regel;
}

/** Kurzform fuer die Rechenwege: gilt in dieser Saison Plus/Minus? Ohne Spielstand: nein. */
export function formkartenPlusMinusFuer(gameState: FormkartenRegelQuelle): boolean {
  return formkartenRegelFuer(gameState) === "plusminus";
}

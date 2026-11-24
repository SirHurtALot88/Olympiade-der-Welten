/**
 * SPONSOR-REGEL JE SAISON (24.11., docs/design/sponsoren-rework-bau-24-11.md; Konzept docs/design/sponsoren-rework-22-11.md).
 *
 * "topf": ein Liga-Topf aus den Kosten der Liga, Grundbetrag nach Erwartungsrang, Leistungsteil mit Liga-Ausgleich, drei Vertragsarten,
 * Farb-Partner, Sponsorentermin als Entscheidung. "alt": Sockel + Wertungstopf, wie bis 23.11. Die Regel haengt an der SAISON, nicht am
 * Serverstart: Raten je Spieltag, Frozen-Anker und Vertragsart gelten die ganze Saison. Deshalb steht sie IM SPIELSTAND
 * (`seasonState.sponsorRegel`) und wird genau zweimal gesetzt: beim Anlegen eines Spiels und beim Saisonwechsel
 * (`preseason-workflow-service.ts`). Muster: `wertungs-skalen.ts`, `formkarten-regel.ts`.
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem einer anderen Saison) gilt "alt"; die Lade-Migration (`stempleSponsorRegelNachLaden`,
 * save-repository.ts) schreibt fuer die laufende Saison "alt" fest -- die Saison rechnet bit-identisch zu Ende --, ab dem naechsten
 * Saisonwechsel gilt der Schalter. Nur Battle-Spielstaende bekommen einen Stempel; der Manager-Modus bleibt "alt".
 *
 * SCHALTER `OLY_SPONSOR_REGEL` (nur Server, compose + `.env`; er wird NUR dort gelesen, wo der Stempel gesetzt wird -- nie in einem
 * Rechenweg):
 *   nicht gesetzt | "an"   neue Saisons bekommen "topf" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "alt"
 *   "aus-sofort"           Notbremse: `spiegleSponsorNotbremse` (laeuft beim Spieltagsabschluss auf dem Server) setzt `notbremse` im
 *                          Stempel. Danach zahlt der Grundbetrag weiter, Leistungsteil und Farb-Partner sind aus.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import type { SponsorRegelStempel, SponsorRegelVersion } from "@/lib/sponsors/sponsor-topf-typen";

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off" || w === "alt") return "aus";
  return "an";
}

/** Nur dort lesen, wo der Stempel gesetzt wird (Anlegen, Saisonwechsel, Notbremse-Spiegel). */
export function sponsorRegelSchalter(): Schalter {
  return leseSchalter(process.env.OLY_SPONSOR_REGEL) ?? "an";
}

export type SponsorRegelQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId"> & { sponsorRegel?: SponsorRegelStempel | null }) | null;
      season?: { id?: string } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function istBattle(gameState: SponsorRegelQuelle): boolean {
  return gameState?.scenarioMeta?.gameMode === "battle";
}

/** Der Grundstempel einer neuen Saison. `vorlaeufig`/`eingefroren` setzen Saisonwechsel bzw. Stichtag. */
export function sponsorRegelFuerNeueSaison(
  seasonId: string,
  vorher?: SponsorRegelStempel | null,
  uebertrag = 0,
): SponsorRegelStempel {
  const version: SponsorRegelVersion = sponsorRegelSchalter() === "an" ? "topf" : "alt";
  return {
    seasonId,
    version,
    saisonfaktor: vorher?.saisonfaktor ?? 1,
    kaderErsatz: 1,
    betriebsteilVorjahr: vorher?.eingefroren?.betriebsteil ?? vorher?.betriebsteilVorjahr ?? null,
    uebertrag,
    ...(vorher != null && vorher.version !== "topf" ? { ohneBremse: true } : {}),
    ligaWertVorjahr: vorher?.eingefroren?.ligaWert ?? vorher?.ligaWertVorjahr ?? null,
    ligaWertKorrektur: vorher?.eingefroren?.wertKorrektur ?? vorher?.ligaWertKorrektur ?? 0,
    vorlaeufig: null,
    eingefroren: null,
  };
}

/** Der Stempel eines neuen Saisonstands je Spielmodus: Battle bekommt ihn, Manager keinen. */
export function sponsorRegelFuerSpielmodus(
  gameState: SponsorRegelQuelle,
  seasonId: string,
  vorher?: SponsorRegelStempel | null,
  uebertrag = 0,
): SponsorRegelStempel | undefined {
  return istBattle(gameState) ? sponsorRegelFuerNeueSaison(seasonId, vorher, uebertrag) : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleSponsorRegelBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !istBattle(gameState)) return gameState;
  if (gameState.seasonState?.sponsorRegel?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorRegel: sponsorRegelFuerNeueSaison(seasonId) } };
}

/**
 * LADE-MIGRATION: ein Battle-Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "alt" -- die Saison rechnet
 * bit-identisch alt zu Ende, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleSponsorRegelNachLaden<T extends NonNullable<SponsorRegelQuelle> & Pick<GameState, "seasonState">>(gameState: T): T {
  if (!gameState?.seasonState || !istBattle(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.sponsorRegel?.seasonId === seasonId) return gameState;
  const alt: SponsorRegelStempel = {
    seasonId, version: "alt", saisonfaktor: 1, kaderErsatz: 1, betriebsteilVorjahr: null, uebertrag: 0, vorlaeufig: null, eingefroren: null,
  };
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorRegel: alt } };
}

/** Der gueltige Stempel DIESER Saison oder `null`. */
export function gueltigerSponsorStempel(gameState: SponsorRegelQuelle): SponsorRegelStempel | null {
  const stempel = gameState?.seasonState?.sponsorRegel;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return null;
  return stempel;
}

/** Die Regel DIESER Saison. Fehlender oder fremder Stempel: "alt". */
export function sponsorRegelFuer(gameState: SponsorRegelQuelle): SponsorRegelVersion {
  return gueltigerSponsorStempel(gameState)?.version ?? "alt";
}

/** Kurzform: gilt in dieser Saison der Topf? */
export function sponsorTopfAktiv(gameState: SponsorRegelQuelle): boolean {
  return sponsorRegelFuer(gameState) === "topf";
}

/** Leistungsteil und Farb-Partner zahlen? Nein bei "alt" und nach der Notbremse (der Grundbetrag zahlt weiter). */
export function sponsorLeistungAktiv(gameState: SponsorRegelQuelle): boolean {
  const s = gueltigerSponsorStempel(gameState);
  return s?.version === "topf" && !s.notbremse;
}

/**
 * Server-Pfad (Spieltagsabschluss): spiegelt die Notbremse `OLY_SPONSOR_REGEL=aus-sofort` in den Stempel der laufenden Saison.
 * Die Rechenwege lesen danach nur noch `stempel.notbremse`. Ohne Notbremse oder ohne Topf-Stempel: dieselbe Referenz zurueck.
 */
export function spiegleSponsorNotbremse(gameState: GameState): GameState {
  const stempel = gueltigerSponsorStempel(gameState);
  if (!stempel || stempel.version !== "topf" || stempel.notbremse) return gameState;
  if (sponsorRegelSchalter() !== "aus-sofort") return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorRegel: { ...stempel, notbremse: true } } };
}

/**
 * Der am Stichtag eingefrorene Erwartungsrang des Teams (ungerundet), sonst `null`. DERSELBE Anker, den der Vorstand
 * (`computeTeamExpectation`) und der Sponsor lesen: nach dem Stichtag aendert ein Kader-Umbau die Erwartung nicht mehr.
 */
export function sponsorAnkerFuer(gameState: SponsorRegelQuelle, teamId: string): number | null {
  const s = gueltigerSponsorStempel(gameState);
  if (!s || s.version !== "topf") return null;
  const e = s.eingefroren?.teams?.[teamId]?.erwartungsrang;
  return typeof e === "number" && Number.isFinite(e) ? e : null;
}

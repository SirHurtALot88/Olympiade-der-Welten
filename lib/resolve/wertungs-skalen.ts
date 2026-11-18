/**
 * WERTUNGSSKALEN JE SAISON (18.11., docs/design/pp-skala-18-11.md Abschnitt 8,
 * docs/design/ergebnisskala-18-11.md).
 *
 * Zwei Skalen haengen an der Saison, nicht am Serverstart:
 *
 *   pp:       "c2"  = Spieler-PP nach Variante C2 (Zwei-Anker je Disziplin und Feldgroesse, Deckel 5,
 *                     lib/resolve/pp-skala.ts), "alt" = die Impact-Kurve bis 5,5 wie vor dem 18.11.
 *   ergebnis: "e1"  = einheitliche 0-10-Ergebnisskala je Begegnung (lib/resolve/ergebnis-skala.ts),
 *             "alt" = Niveau+Marge vom 19.10. gegen die alten Referenzen.
 *
 * WARUM AN DER SAISON: eine laufende Saison darf ihre Historie nicht verschieben. Die Ergebnis- und
 * Arena-Zeilen eines Spieltags werden mit ihren Werten persistiert, PPS-Duell-Spieler-PP rechnet der
 * Ledger beim Lesen neu. Schaltete ein Serverneustart mitten in der Saison um, stuenden alte und neue
 * Zahlen in derselben Tabelle, und der Ledger wuerde die alten PPS-Duell-Zeilen rueckwirkend umrechnen.
 * Deshalb steht die Skala IM SPIELSTAND (`seasonState.wertungsSkalen`) und wird genau zweimal gesetzt:
 * beim Anlegen eines Spiels und beim Saisonwechsel (`preseason-workflow-service.ts`). Muster:
 * `sponsorSystemVersion`.
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "alt". Ein
 * laufender Spielstand rechnet seine Saison also unveraendert zu Ende; ab dem naechsten Saisonwechsel
 * gelten die neuen Skalen. Mehrspieler-tauglich: kein Prozesszustand, jeder Aufruf liest den Stempel
 * des Spielstands, den er gerade rechnet.
 *
 * SCHALTER (Server, `OLY_PP_SKALA` / `OLY_ERGEBNIS_SKALA`):
 *   nicht gesetzt | "an"  neue Saisons bekommen die neue Skala (Standard seit 18.11.)
 *   "aus"                 Rueckweg: neue Saisons bekommen "alt"; gestempelte Saisons rechnen weiter wie gestempelt
 *   "aus-sofort"          Notbremse: ignoriert jeden Stempel, alles "alt" (auch mitten in der Saison).
 *                         Fuer den Browser zusaetzlich `NEXT_PUBLIC_OLY_PP_SKALA=aus-sofort` beim Build,
 *                         sonst rechnet der Saisonstand PPS-Duell-Zeilen im Browser anders nach.
 *   "roh"  (nur PP)       Messmodus (scripts/miss-pp-skala.ts): alte Kurve ohne Deckel. Nie im Spiel.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type PpSkalaVersion = "alt" | "c2";
export type ErgebnisSkalaVersion = "alt" | "e1";

export type WertungsSkalenStempel = {
  /** Die Saison, fuer die der Stempel gilt. Ein Stempel einer anderen Saison zaehlt nicht. */
  seasonId: string;
  pp: PpSkalaVersion;
  ergebnis: ErgebnisSkalaVersion;
};

type Schalter = "an" | "aus" | "aus-sofort" | "roh";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "roh") return "roh";
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "0" || w === "false" || w === "nein" || w === "off") return "aus";
  return "an";
}

/** PP-Schalter: Browser-Variante zuerst (Next.js ersetzt nur den woertlichen Zugriff), dann Server. */
export function ppSkalaSchalter(): Schalter {
  return leseSchalter(process.env.NEXT_PUBLIC_OLY_PP_SKALA) ?? leseSchalter(process.env.OLY_PP_SKALA) ?? "an";
}

export function ergebnisSkalaSchalter(): Exclude<Schalter, "roh"> {
  const s = leseSchalter(process.env.NEXT_PUBLIC_OLY_ERGEBNIS_SKALA) ?? leseSchalter(process.env.OLY_ERGEBNIS_SKALA) ?? "an";
  return s === "roh" ? "an" : s;
}

/** Der Stempel fuer eine NEU beginnende Saison, aus den Schaltern. */
export function wertungsSkalenFuerNeueSaison(seasonId: string): WertungsSkalenStempel {
  const pp = ppSkalaSchalter();
  const ergebnis = ergebnisSkalaSchalter();
  return {
    seasonId,
    pp: pp === "aus" || pp === "aus-sofort" ? "alt" : "c2",
    ergebnis: ergebnis === "aus" || ergebnis === "aus-sofort" ? "alt" : "e1",
  };
}

/** Setzt den Stempel auf den Saisonstand einer neu beginnenden Saison (ueberschreibt einen alten). */
export function stempleWertungsSkalen<T extends Pick<SeasonState, "seasonId" | "wertungsSkalen">>(seasonState: T, seasonId?: string): T {
  const id = seasonId ?? seasonState.seasonId;
  return { ...seasonState, wertungsSkalen: wertungsSkalenFuerNeueSaison(id) };
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleWertungsSkalenBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId) return gameState;
  if (gameState.seasonState?.wertungsSkalen?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: stempleWertungsSkalen(gameState.seasonState, seasonId) };
}

type SkalenQuelle = { seasonState?: Pick<SeasonState, "seasonId" | "wertungsSkalen"> | null } | null | undefined;

function gueltigerStempel(gameState: SkalenQuelle): WertungsSkalenStempel | null {
  const stempel = gameState?.seasonState?.wertungsSkalen;
  if (!stempel || stempel.seasonId !== gameState?.seasonState?.seasonId) return null;
  return stempel;
}

/** Welche PP-Skala rechnet DIESE Saison? "roh" nur im Messmodus. */
export function ppSkalaVersionFuer(gameState: SkalenQuelle): PpSkalaVersion | "roh" {
  const schalter = ppSkalaSchalter();
  if (schalter === "roh") return "roh";
  if (schalter === "aus-sofort") return "alt";
  return gueltigerStempel(gameState)?.pp ?? "alt";
}

/** Welche Ergebnisskala rechnet DIESE Saison? */
export function ergebnisSkalaVersionFuer(gameState: SkalenQuelle): ErgebnisSkalaVersion {
  if (ergebnisSkalaSchalter() === "aus-sofort") return "alt";
  return gueltigerStempel(gameState)?.ergebnis ?? "alt";
}

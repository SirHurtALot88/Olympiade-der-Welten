/**
 * AUSRUESTUNGS-REGEL JE SPIELTAG (Phase 1a, 22.11., docs/design/ausruestung-pilot-bauplan-22-11.md Abschnitt B).
 *
 * Dasselbe Muster wie `lib/resolve/breaking-format.ts`: die Regel steht IM SPIELSTAND als Wechselliste der laufenden Saison
 * (`seasonState.ausruestungRegel`), `wechsel[0]` gilt ab Saisonbeginn, jeder weitere ab seinem Spieltag `ab`. Gebuchte Spieltage
 * behalten ihre Stufe fuer immer; eine Umstellung (Schalter) wirkt erst ab dem naechsten gewerteten Spieltag.
 *
 *   { seasonId, wechsel: [{ ab: matchdayId|null, besitz, wirkung: "keine"|"attribute", schmiede: 0..5, effekte: "aus"|"pilot1" }] }
 *
 * SCHALTER `OLY_AUSRUESTUNG` (nur Server, kein `NEXT_PUBLIC`; compose + `.env`):
 *   nicht gesetzt | "besitz"   Phase 1a: Lager, Truhen, Ruhm (Standard seit 22.11.)
 *   "aus"                      keine Ausruestung (ab dem naechsten gewerteten Spieltag; Besitz bleibt im Spielstand liegen)
 *   "attribute"                + Wirkung auf die Attribute (Phase 2, noch nicht gebaut: wirkt wie "besitz")
 *   "schmiede" | "effekte"     Phase 3/4, noch nicht gebaut: wirken wie "besitz"
 *   "aus-sofort"               Notbremse: ab sofort aus, auch fuer den laufenden Spieltag (kein Wechsel, kein Stempel noetig)
 *
 * PHASE 1a BERUEHRT DIE WERTUNG NICHT: `wirkung` ist immer "keine". Der Wertungs-Fingerabdruck bleibt unveraendert.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import type { AusruestungRegelStempel, AusruestungRegelWechsel } from "@/lib/ausruestung/ausruestung-typen";

export type AusruestungSchalter = "aus" | "besitz" | "attribute" | "schmiede" | "effekte";

export const AUSRUESTUNG_SCHALTER_VORGABE: AusruestungSchalter = "besitz";

/** Notbremse: `aus-sofort` zaehlt nicht als Regel, sondern schaltet jede Abfrage ab. */
export function ausruestungNotbremse(env: Record<string, string | undefined> = process.env): boolean {
  return (env.OLY_AUSRUESTUNG ?? "").trim().toLowerCase() === "aus-sofort";
}

export function ausruestungSchalter(env: Record<string, string | undefined> = process.env): AusruestungSchalter {
  const w = (env.OLY_AUSRUESTUNG ?? "").trim().toLowerCase();
  if (w === "") return AUSRUESTUNG_SCHALTER_VORGABE;
  if (w === "aus" || w === "aus-sofort" || w === "0" || w === "false" || w === "nein" || w === "off") return "aus";
  if (w === "attribute" || w === "schmiede" || w === "effekte") return w;
  return "besitz";
}

/** Die Regel, die ein Schalterwert fuer kuenftige Spieltage verlangt (ohne `ab`). Phase 1a: Wirkung immer "keine". */
export function regelAusSchalter(schalter: AusruestungSchalter): Omit<AusruestungRegelWechsel, "ab"> {
  return { besitz: schalter !== "aus", wirkung: "keine", schmiede: 0, effekte: "aus" };
}

type RegelQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId" | "matchdayResults"> & { ausruestungRegel?: AusruestungRegelStempel | null }) | null;
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function saisonIdVon(gameState: RegelQuelle): string | null {
  return gameState?.seasonState?.seasonId ?? gameState?.season?.id ?? null;
}

function gueltigerStempel(gameState: RegelQuelle): AusruestungRegelStempel | null {
  const stempel = gameState?.seasonState?.ausruestungRegel;
  const seasonId = saisonIdVon(gameState);
  if (!stempel || !seasonId || stempel.seasonId !== seasonId || !Array.isArray(stempel.wechsel) || stempel.wechsel.length === 0) return null;
  return stempel;
}

function gleicheRegel(a: Omit<AusruestungRegelWechsel, "ab">, b: Omit<AusruestungRegelWechsel, "ab">): boolean {
  return a.besitz === b.besitz && a.wirkung === b.wirkung && a.schmiede === b.schmiede && a.effekte === b.effekte;
}

/**
 * Der Stempel, den der Spielstand nach dem Laden traegt: vorhandener Stempel plus (falls der Schalter etwas anderes
 * verlangt) ein Wechsel ab dem ersten noch nicht gewerteten Spieltag. Rein; `null`, wenn keine Saison bekannt ist.
 * Spielstaende von vor Phase 1a (kein Stempel) bekommen `wechsel[0]` = aus fuer schon gebuchte Spieltage, dann den Schalter.
 */
export function ausruestungRegelStempelNachLaden(
  gameState: RegelQuelle,
  schalter: AusruestungSchalter = ausruestungSchalter(),
): AusruestungRegelStempel | null {
  const seasonId = saisonIdVon(gameState);
  if (!seasonId) return null;
  const verlangt = regelAusSchalter(schalter);
  const aus = regelAusSchalter("aus");
  const gebucht = new Set((gameState?.seasonState?.matchdayResults ?? []).filter((r) => r.seasonId === seasonId).map((r) => r.matchdayId));
  const ids = gameState?.season?.matchdayIds ?? [];
  const naechster = ids.find((id) => !gebucht.has(id)) ?? null;
  const vorhanden = gueltigerStempel(gameState);
  if (!vorhanden) {
    if (gebucht.size === 0 || gleicheRegel(verlangt, aus)) return { seasonId, wechsel: [{ ab: null, ...(gebucht.size === 0 ? verlangt : aus) }] };
    if (!naechster) return { seasonId, wechsel: [{ ab: null, ...aus }] };
    return { seasonId, wechsel: [{ ab: null, ...aus }, { ab: naechster, ...verlangt }] };
  }
  const letzter = vorhanden.wechsel[vorhanden.wechsel.length - 1];
  if (gleicheRegel(letzter, verlangt) || !naechster) return vorhanden;
  // Kein gewerteter Spieltag seit dem letzten Wechsel: der letzte Wechsel wird ersetzt statt gestapelt.
  if (letzter.ab === naechster || (letzter.ab === null && gebucht.size === 0)) {
    return { seasonId, wechsel: [...vorhanden.wechsel.slice(0, -1), { ab: letzter.ab, ...verlangt }] };
  }
  return { seasonId, wechsel: [...vorhanden.wechsel, { ab: naechster, ...verlangt }] };
}

/**
 * LADE-MIGRATION (save-repository.ts) und Festschreiben vor dem Buchen (legacy-matchday-result-apply-service.ts): setzt bzw.
 * ergaenzt `seasonState.ausruestungRegel`. Rein und idempotent; gibt dasselbe Objekt zurueck, wenn sich nichts aendert.
 * Nur Battle-Spielstaende (Bauplan C11: der Manager-Modus bekommt keine Ausruestung).
 */
export function stempleAusruestungRegel<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  if (!gameState?.seasonState) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  const neu = ausruestungRegelStempelNachLaden(gameState as RegelQuelle);
  if (!neu) return gameState;
  const alt = gameState.seasonState.ausruestungRegel;
  if (alt && JSON.stringify(alt) === JSON.stringify(neu)) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, ausruestungRegel: neu } };
}

/** Der Stempel einer neuen Saison (Saisonwechsel): ab Saisonbeginn nach dem Schalter; Manager-Spielstaende bekommen keinen. */
export function ausruestungRegelFuerNeueSaison(
  gameState: { scenarioMeta?: { gameMode?: string | null } | null },
  seasonId: string,
  schalter: AusruestungSchalter = ausruestungSchalter(),
): AusruestungRegelStempel | null {
  if (gameState.scenarioMeta?.gameMode !== "battle") return null;
  return { seasonId, wechsel: [{ ab: null, ...regelAusSchalter(schalter) }] };
}

/**
 * DIE REGEL EINES SPIELTAGS. Mit gueltigem Stempel: der letzte Wechsel, dessen Spieltag nicht nach `matchdayId` liegt
 * (unbekannter Spieltag: der zuletzt gueltige). Ohne Stempel: dieselbe Regel auf dem Stempel, den die Migration setzen wuerde.
 * Manager-Spielstaende und die Notbremse liefern immer "aus".
 */
export function ausruestungRegelFuer(
  gameState: RegelQuelle,
  matchdayId?: string | null,
  env: Record<string, string | undefined> = process.env,
): Omit<AusruestungRegelWechsel, "ab"> {
  const aus = regelAusSchalter("aus");
  if (ausruestungNotbremse(env)) return aus;
  if (gameState?.scenarioMeta?.gameMode !== "battle") return aus;
  const stempel = gueltigerStempel(gameState) ?? ausruestungRegelStempelNachLaden(gameState, ausruestungSchalter(env));
  if (!stempel) return aus;
  const ids = gameState?.season?.matchdayIds ?? [];
  const hier = matchdayId ? ids.indexOf(matchdayId) : -1;
  let regel = stempel.wechsel[0];
  for (const w of stempel.wechsel.slice(1)) {
    const ab = w.ab ? ids.indexOf(w.ab) : -1;
    if (hier < 0 || (ab >= 0 && hier >= ab)) regel = w;
  }
  return { besitz: regel.besitz, wirkung: regel.wirkung, schmiede: regel.schmiede, effekte: regel.effekte };
}

/** Ist der Besitz fuer diesen Spielstand (jetzt, am naechsten offenen Spieltag) aktiv? Die Frage aller Schreibwege und der Seite. */
export function ausruestungBesitzAktiv(gameState: RegelQuelle, env: Record<string, string | undefined> = process.env): boolean {
  const ids = gameState?.season?.matchdayIds ?? [];
  const gebucht = new Set((gameState?.seasonState?.matchdayResults ?? []).map((r) => r.matchdayId));
  const naechster = ids.find((id) => !gebucht.has(id)) ?? null;
  return ausruestungRegelFuer(gameState, naechster, env).besitz;
}

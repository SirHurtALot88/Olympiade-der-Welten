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
  /**
   * Nur bei einer Umstellung MITTEN in der Saison (`stelleLaufendeSaisonAufC2Um()`): der erste Spieltag,
   * der mit C2 gerechnet wird. Spieler-PP aller frueher gebuchten Zeilen bleiben alt (s.
   * `ppSkalaModusFuerZeile()`); Zeilen ab diesem Spieltag tragen `ppSkala: "c2"`.
   */
  ppAb?: string;
  /**
   * PP-TAGESANKER (22.11., lib/resolve/pp-tagesanker.ts, docs/design/pp-tagesanker-live-22-11.md): `true` =
   * die Spieler-PP dieser Saison werden je Disziplin und Spieltag ueber alle Spieler beider Ligen
   * neu verteilt (Tagesanker + weiche Kappe). Fehlt das Feld (Saves vor dem 22.11., Umstellung mitten in
   * der Saison), gilt `false`: die laufende Saison rechnet zu Ende wie bisher. Nur mit `pp: "c2"` wirksam.
   */
  ppTagesanker?: boolean;
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

/**
 * PP-Tagesanker-Schalter (`OLY_PP_TAGESANKER`, Browser: `NEXT_PUBLIC_OLY_PP_TAGESANKER`): leer | "an" = neue
 * Saisons bekommen den Tagesanker im Stempel (Standard seit 22.11.), "aus" = Rueckweg (neue Saisons ohne,
 * gestempelte Saisons rechnen wie gestempelt), "aus-sofort" = Notbremse (ignoriert jeden Stempel).
 */
export function ppTagesankerSchalter(): Exclude<Schalter, "roh"> {
  const s = leseSchalter(process.env.NEXT_PUBLIC_OLY_PP_TAGESANKER) ?? leseSchalter(process.env.OLY_PP_TAGESANKER) ?? "an";
  return s === "roh" ? "an" : s;
}

export function ergebnisSkalaSchalter(): Exclude<Schalter, "roh"> {
  const s = leseSchalter(process.env.NEXT_PUBLIC_OLY_ERGEBNIS_SKALA) ?? leseSchalter(process.env.OLY_ERGEBNIS_SKALA) ?? "an";
  return s === "roh" ? "an" : s;
}

/** Nur Battle-Saves bekommen einen Stempel und die neuen Skalen; der Manager-Modus bleibt unberuehrt. */
export function istBattleSpielstand(gameState: { scenarioMeta?: { gameMode?: string | null } | null } | null | undefined): boolean {
  return gameState?.scenarioMeta?.gameMode === "battle";
}

/** Der Stempel fuer eine NEU beginnende Saison, aus den Schaltern. */
export function wertungsSkalenFuerNeueSaison(seasonId: string): WertungsSkalenStempel {
  const pp = ppSkalaSchalter();
  const ergebnis = ergebnisSkalaSchalter();
  const c2 = !(pp === "aus" || pp === "aus-sofort");
  const tagesanker = ppTagesankerSchalter();
  return {
    seasonId,
    pp: c2 ? "c2" : "alt",
    ergebnis: ergebnis === "aus" || ergebnis === "aus-sofort" ? "alt" : "e1",
    // Nur zusammen mit C2 und nur, wenn der Schalter nicht "aus"/"aus-sofort" steht.
    ppTagesanker: c2 && tagesanker === "an",
  };
}

/** Setzt den Stempel auf den Saisonstand einer neu beginnenden Saison (ueberschreibt einen alten). */
export function stempleWertungsSkalen<T extends Pick<SeasonState, "seasonId" | "wertungsSkalen">>(seasonState: T, seasonId?: string): T {
  const id = seasonId ?? seasonState.seasonId;
  return { ...seasonState, wertungsSkalen: wertungsSkalenFuerNeueSaison(id) };
}

/** Der Stempel eines neuen Saisonstands je Spielmodus: Battle bekommt ihn, Manager keinen (`undefined`). */
export function wertungsSkalenFuerSpielmodus(gameState: Parameters<typeof istBattleSpielstand>[0], seasonId: string): WertungsSkalenStempel | undefined {
  return istBattleSpielstand(gameState) ? wertungsSkalenFuerNeueSaison(seasonId) : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleWertungsSkalenBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId) return gameState;
  if (!istBattleSpielstand(gameState)) return gameState;
  if (gameState.seasonState?.wertungsSkalen?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: stempleWertungsSkalen(gameState.seasonState, seasonId) };
}

type SkalenQuelle =
  | {
      seasonState?: Pick<SeasonState, "seasonId" | "wertungsSkalen"> | null;
      season?: { matchdayIds?: readonly string[] } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

export function gueltigerStempel(gameState: SkalenQuelle): WertungsSkalenStempel | null {
  const stempel = gameState?.seasonState?.wertungsSkalen;
  if (!stempel || stempel.seasonId !== gameState?.seasonState?.seasonId) return null;
  return stempel;
}

/**
 * Welche PP-Skala rechnet DIESE Saison (bzw. dieser Spieltag)? "roh" nur im Messmodus. Mit `matchdayId`:
 * ein Spieltag VOR dem Umstellungs-Spieltag (`ppAb`) rechnet alt -- auch wenn er nach der Umstellung noch
 * einmal neu gewertet wird. Ohne `matchdayId` gilt der Stempel der Saison.
 */
export function ppSkalaVersionFuer(gameState: SkalenQuelle, matchdayId?: string | null): PpSkalaVersion | "roh" {
  const schalter = ppSkalaSchalter();
  if (schalter === "roh") return "roh";
  if (schalter === "aus-sofort") return "alt";
  const stempel = gueltigerStempel(gameState);
  if (!stempel) return "alt";
  if (stempel.pp === "c2" && stempel.ppAb && matchdayId) {
    const ids = gameState?.season?.matchdayIds ?? [];
    const ab = ids.indexOf(stempel.ppAb);
    const hier = ids.indexOf(matchdayId);
    // Nicht aufloesbar (Spieltagsliste fehlt / ID unbekannt): im Zweifel "alt" -- ein schon gebuchter
    // Spieltag darf durch eine Umstellung nie umgerechnet werden.
    if (ab < 0 || hier < 0 || hier < ab) return "alt";
  }
  return stempel.pp;
}

/**
 * DIE PP-SKALA EINER GEBUCHTEN ZEILE (fuer den Ledger, der PPS-Duell-Zeilen beim Lesen nachrechnet):
 * die Zeile selbst sagt, womit sie gebucht wurde (`ppSkala: "c2"`, gesetzt von der Engine). Fehlt der
 * Vermerk, ist sie alt, sobald die Saison erst mitten drin umgestellt wurde (`ppAb`); bei einer ab
 * Saisonbeginn gestempelten Saison gilt der Saison-Stempel. Notbremse und Messmodus stehen darueber.
 * So rechnet eine Umstellung mitten in der Saison keinen schon gebuchten Spieltag um (gezeigt = gebucht).
 */
export function ppSkalaVersionFuerZeile(gameState: SkalenQuelle, zeile: { ppSkala?: string | null } | null | undefined): PpSkalaVersion | "roh" {
  const saison = ppSkalaVersionFuer(gameState);
  const schalter = ppSkalaSchalter();
  if (schalter === "roh" || schalter === "aus-sofort") return saison;
  if (zeile?.ppSkala === "c2") return "c2";
  if (gueltigerStempel(gameState)?.ppAb) return "alt";
  return saison;
}

/** Hoechstens so viele gebuchte Spieltage darf eine laufende Saison haben, um noch umgestellt zu werden. */
export const PP_UMSTELLUNG_MAX_GEBUCHTE_SPIELTAGE = 3;

/**
 * UMSTELLUNG EINER LAUFENDEN SAISON AUF C2 AB DEM NAECHSTEN SPIELTAG (Chris 18.11.: "nicht JEDER soll
 * 5,5 bekommen bitte anpassen", gemessen am Live-Save nach Spieltag 1). Laeuft beim Laden eines
 * Spielstands (save-repository.ts, neben den anderen Lade-Migrationen), rein und idempotent:
 *
 *   - nur Battle-Saves, nur wenn die laufende Saison noch KEINEN gueltigen Stempel hat,
 *   - nur bis einschliesslich `PP_UMSTELLUNG_MAX_GEBUCHTE_SPIELTAGE` gebuchten Spieltagen,
 *   - nicht bei `OLY_PP_SKALA=aus` / `aus-sofort` (Rueckweg) oder im Messmodus `roh`.
 *
 * Gesetzt wird `{ pp: "c2", ergebnis: "alt", ppAb: <erster ungebuchter Spieltag> }`: die Ergebnisskala
 * bleibt fuer die laufende Saison alt (sonst stuenden im Tiebreaker "Verh." zwei Skalen nebeneinander),
 * E1 kommt mit dem Saisonwechsel. Gebuchte Spieltage werden NICHT neu gewertet: Arena-/Pod-PP sind mit
 * ihrem Wert persistiert, PPS-Duell-Zeilen ohne Vermerk rechnet der Ledger alt (`ppSkalaVersionFuerZeile`).
 * Ein schon gelaufener Arena-Vorlauf des naechsten Spieltags ist nach der Umstellung veraltet (die
 * PP-Skala steht im Eingabe-Hash, lib/battle/arena-eingabe-hash.ts) und wird neu gerechnet.
 */
export function stelleLaufendeSaisonAufC2Um<T extends Pick<GameState, "seasonState" | "season"> & { scenarioMeta?: { gameMode?: string | null } | null }>(
  gameState: T,
): T {
  const seasonState = gameState.seasonState;
  const seasonId = seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonState || !seasonId) return gameState;
  if (gameState.scenarioMeta?.gameMode !== "battle") return gameState;
  if (seasonState.wertungsSkalen?.seasonId === seasonId) return gameState;
  const schalter = ppSkalaSchalter();
  if (schalter !== "an") return gameState;
  const gebucht = new Set(
    (seasonState.matchdayResults ?? []).filter((r) => r.seasonId === seasonId).map((r) => r.matchdayId),
  );
  if (gebucht.size > PP_UMSTELLUNG_MAX_GEBUCHTE_SPIELTAGE) return gameState;
  const naechster = (gameState.season?.matchdayIds ?? []).find((id) => !gebucht.has(id));
  if (!naechster) return gameState;
  return {
    ...gameState,
    seasonState: { ...seasonState, wertungsSkalen: { seasonId, pp: "c2", ergebnis: "alt", ppAb: naechster } },
  };
}

/** Welche Ergebnisskala rechnet DIESE Saison? */
export function ergebnisSkalaVersionFuer(gameState: SkalenQuelle): ErgebnisSkalaVersion {
  if (ergebnisSkalaSchalter() === "aus-sofort") return "alt";
  return gueltigerStempel(gameState)?.ergebnis ?? "alt";
}

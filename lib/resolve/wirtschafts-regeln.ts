/**
 * WIRTSCHAFTS-REGELN JE SAISON (22.11., Review-Fixes Runde 2, docs/design/review-fixes-wirtschaft-ki-22-11.md).
 *
 * Vier Regeln aus den Review-Fixes aendern, wie Vorstand und KI rechnen. Sie duerfen nie mitten in der Saison wechseln
 * (unterschriebene Sponsorziele wie `underdog_story` / `golden_fairytale` haengen am Erwartungsrang), und Browser und Server muessen
 * dieselbe Zahl sehen. Deshalb stehen sie IM SPIELSTAND (`seasonState.wirtschaftsRegeln`) — Muster `wertungs-skalen.ts`:
 * gesetzt beim Anlegen eines Spiels (ab Saison 1) und beim Saisonwechsel; ein bestehender Spielstand ohne Stempel rechnet
 * seine laufende Saison "alt" zu Ende.
 *
 *   quote      "neu" = nur der Pflichtkader 8 ist quotenfrei; "alt" = Kaderpflicht-Zuschlag bis Opt (vor dem 22.11.)
 *   anker      "neu" = Erwartungsrang am Vorjahresrang verankert (Stempel `vorjahr`, ligagerecht); "alt" = nur aktuelle Staerke
 *   kernschutz "neu" = die besten 3 verkauft ein Team nur in Finanznot oder bei einem guten Angebot; "alt" = ohne Schutz
 *   rueckkauf  "neu" = Abgang durch Vertragsende zaehlt wie ein Verkauf (Rueckkauf im Fenster gesperrt); "alt" = frei
 *
 * `vorjahr` (Anker): je Team die Platzierung der abgelaufenen Saison als Anteil 0..1 (0 = Erster, 1 = Letzter) IN DER LIGA, in der
 * das Team jetzt spielt. Aufsteiger zaehlen als 1 (Letzter der neuen Liga: sie haben dort noch nichts bewiesen, kein Druck), Absteiger
 * als 0 (Erster der neuen Liga: wer absteigt, soll oben erwartet werden und nicht belohnt werden). Liga-Rang 1 aus Liga 2 ist
 * KEIN Rang 1 in Liga 1.
 *
 * SCHALTER (Server, im Browser `NEXT_PUBLIC_…`): `OLY_QUOTE_UEBER_PFLICHTKADER`, `OLY_BOARD_ERWARTUNG_ANKER`, `OLY_KI_KERNSCHUTZ`,
 * `OLY_RUECKKAUF_SPERRE`. Leer = neu. "0" / "aus" / "alt" = neue Saisons bekommen "alt"; gestempelte Saisons rechnen wie gestempelt.
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { findLeagueMovementLog } from "@/lib/season/league-movement-service";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

export type WirtschaftsRegel = "alt" | "neu";

export type WirtschaftsRegelnStempel = {
  seasonId: string;
  quote: WirtschaftsRegel;
  anker: WirtschaftsRegel;
  kernschutz: WirtschaftsRegel;
  rueckkauf: WirtschaftsRegel;
  vorjahr?: Record<string, number>;
};

export type WirtschaftsRegelName = "quote" | "anker" | "kernschutz" | "rueckkauf";

function leseSchalter(wert: string | undefined): WirtschaftsRegel | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  return w === "0" || w === "aus" || w === "alt" || w === "false" || w === "nein" || w === "off" ? "alt" : "neu";
}

/** Schalter fuer NEUE Saisons. Die Zugriffe stehen woertlich da, damit Next.js die Browser-Variante ersetzt. */
function schalter(name: WirtschaftsRegelName): WirtschaftsRegel {
  switch (name) {
    case "quote":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_QUOTE_UEBER_PFLICHTKADER) ?? leseSchalter(process.env.OLY_QUOTE_UEBER_PFLICHTKADER) ?? "neu";
    case "anker":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_BOARD_ERWARTUNG_ANKER) ?? leseSchalter(process.env.OLY_BOARD_ERWARTUNG_ANKER) ?? "neu";
    case "kernschutz":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_KI_KERNSCHUTZ) ?? leseSchalter(process.env.OLY_KI_KERNSCHUTZ) ?? "neu";
    case "rueckkauf":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_RUECKKAUF_SPERRE) ?? leseSchalter(process.env.OLY_RUECKKAUF_SPERRE) ?? "neu";
  }
}

export function wirtschaftsRegelnFuerNeueSaison(seasonId: string, vorjahr?: Record<string, number>): WirtschaftsRegelnStempel {
  return {
    seasonId,
    quote: schalter("quote"),
    anker: schalter("anker"),
    kernschutz: schalter("kernschutz"),
    rueckkauf: schalter("rueckkauf"),
    ...(vorjahr && Object.keys(vorjahr).length > 0 ? { vorjahr } : {}),
  };
}

type Quelle =
  | { season?: { id?: string } | null; seasonState?: (Pick<SeasonState, "seasonId"> & { wirtschaftsRegeln?: WirtschaftsRegelnStempel | null }) | null }
  | null
  | undefined;

export function gueltigeWirtschaftsRegeln(gameState: Quelle): WirtschaftsRegelnStempel | null {
  const stempel = gameState?.seasonState?.wirtschaftsRegeln;
  const saison = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !saison || stempel.seasonId !== saison) return null;
  return stempel;
}

/** Gilt die Regel in der laufenden Saison dieses Spielstands? Ohne gueltigen Stempel: "alt". */
export function wirtschaftsRegel(gameState: Quelle, name: WirtschaftsRegelName): WirtschaftsRegel {
  return gueltigeWirtschaftsRegeln(gameState)?.[name] ?? "alt";
}

/** Setzt den Stempel beim ANLEGEN eines Spiels (idempotent). */
export function stempleWirtschaftsRegelnBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId) return gameState;
  if (gameState.seasonState?.wirtschaftsRegeln?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, wirtschaftsRegeln: wirtschaftsRegelnFuerNeueSaison(seasonId) } };
}

/**
 * Der Vorjahres-Anteil je Team fuer den Stempel der NEUEN Saison, berechnet beim Saisonwechsel aus dem Archiv der abgelaufenen
 * Saison. `gameState` ist der Stand NACH der Liga-Bewegung (Auf- und Abstieg stehen im Log).
 */
export function vorjahrAnteileFuerSaisonwechsel(gameState: GameState, abgelaufeneSaisonId: string): Record<string, number> {
  const snap = (gameState.seasonState.seasonSnapshots ?? []).find((s) => s.seasonId === abgelaufeneSaisonId);
  const standings = snap?.finalStandings ?? [];
  if (standings.length === 0) return {};
  const log = isLeagueSplitActive(gameState) ? findLeagueMovementLog(gameState, abgelaufeneSaisonId) : null;
  const aufgestiegen = new Set(log?.promotedTeamIds ?? []);
  const abgestiegen = new Set(log?.relegatedTeamIds ?? []);
  const groesse = new Map<string, number>();
  if (isLeagueSplitActive(gameState)) {
    for (const t of gameState.teams) {
      const liga = getLeagueOf(gameState, t.teamId);
      if (liga) groesse.set(liga, (groesse.get(liga) ?? 0) + 1);
    }
  }
  const aus: Record<string, number> = {};
  for (const zeile of standings) {
    if (!zeile.teamId) continue;
    if (aufgestiegen.has(zeile.teamId)) {
      aus[zeile.teamId] = 1;
      continue;
    }
    if (abgestiegen.has(zeile.teamId)) {
      aus[zeile.teamId] = 0;
      continue;
    }
    const rang = zeile.rank;
    if (rang == null || !Number.isFinite(rang) || rang < 1) continue;
    const liga = getLeagueOf(gameState, zeile.teamId);
    const n = (liga ? groesse.get(liga) : null) ?? standings.length;
    aus[zeile.teamId] = n > 1 ? Math.min(1, Math.max(0, (rang - 1) / (n - 1))) : 0;
  }
  return aus;
}

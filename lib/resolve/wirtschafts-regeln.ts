/**
 * WIRTSCHAFTS-REGELN JE SAISON (22.11., Review-Fixes Runde 2, docs/design/review-fixes-wirtschaft-ki-22-11.md).
 *
 * Drei Regeln aus den Review-Fixes aendern, wie Vorstand und KI rechnen. Sie duerfen nie mitten in der Saison wechseln
 * (unterschriebene Sponsorziele wie `underdog_story` / `golden_fairytale` haengen am Erwartungsrang), und Browser und Server muessen
 * dieselbe Zahl sehen. Deshalb stehen sie IM SPIELSTAND (`seasonState.wirtschaftsRegeln`) — Muster `wertungs-skalen.ts`:
 * gesetzt beim Anlegen eines Spiels (ab Saison 1) und beim Saisonwechsel; ein bestehender Spielstand ohne Stempel rechnet
 * seine laufende Saison "alt" zu Ende.
 *
 *   quote      "neu" = nur der Pflichtkader 8 ist quotenfrei; "alt" = Kaderpflicht-Zuschlag bis Opt (vor dem 22.11.)
 *   anker      "neu" = Erwartungsrang am Vorjahresrang verankert (Stempel `vorjahr`, ligagerecht); "alt" = nur aktuelle Staerke
 *   kernschutz "neu" = die besten 3 verkauft ein Team nur in Finanznot oder bei einem guten Angebot; "alt" = ohne Schutz
 *   restgehalt "neu" (24.11., docs/design/verkauf-restgehalt-24-11.md) = die KI verlaengert keinen auslaufenden Vertrag, den sie im
 *              naechsten Fenster ohnehin verkaufen wuerde (er geht als abloesefreier Verkauf am Vertragsende), nimmt fuer einen solchen
 *              Spieler eine Vertragsaufloesung an, und ihre Verkaufspruefung rechnet mit dem Erloes NACH Rest-Buyout; "alt" = vorher.
 *              Fehlt im Altstempel = "alt".
 *   verkaufSchwellen "neu" (24.11., docs/design/verkauf-restgehalt-24-11.md Abschnitt 7) = am Vertragsende geht ein Spieler nur, wenn
 *              sich der Abgang nach den Schwellen der Verkaufslogik lohnt (Ueberschuss ueber Opt, klar schwach, Gewinnmitnahme, Upgrade-
 *              Tausch); sonst wird verlaengert. Ein Verkauf mit offenem Restgehalt braucht netto (nach Buyout) mindestens 90 % des
 *              Marktwerts (auch in Finanznot), und ein gerade verlaengerter Vertrag wird nicht freiwillig verkauft.
 *              Dazu (Chris 24.11., „fuer immer“, Abschnitt 8): KEINE Kadergroessen-Bremse auf Abgaenge — weder im Verkaufsplaner (keine
 *              Untergrenze, keine Hoechstzahl, Gewinnmitnahme ab 1,1 x MW auch unter Opt/Minimum) noch im Vertrags-Tick (keine Halte-
 *              Signale nach Opt/Minimum, keine Freigabe-Hoechstzahl) noch bei Vertragsaufloesungen; wer unter das Minimum geht, kauft
 *              im Fenster nach. "alt" = wie mit `restgehalt` allein. Fehlt im Altstempel = "alt".
 *   (Die Verkaufs-Sperre fuer alle Teams ist KEIN Stempel: bestehende Spielregel, gilt sofort — lib/market/transfer-sold-cooldown.ts.)
 *
 * `vorjahr` (Anker): je Team die Platzierung der abgelaufenen Saison als Anteil 0..1 (0 = Erster, 1 = Letzter) IN DER LIGA, in der
 * das Team jetzt spielt. Aufsteiger zaehlen als 1 (Letzter der neuen Liga: sie haben dort noch nichts bewiesen, kein Druck), Absteiger
 * als 0 (Erster der neuen Liga: wer absteigt, soll oben erwartet werden und nicht belohnt werden). Liga-Rang 1 aus Liga 2 ist
 * KEIN Rang 1 in Liga 1.
 *
 * SCHALTER (Server, im Browser `NEXT_PUBLIC_…`): `OLY_QUOTE_UEBER_PFLICHTKADER`, `OLY_BOARD_ERWARTUNG_ANKER`, `OLY_KI_KERNSCHUTZ`, `OLY_KI_RESTGEHALT`, `OLY_KI_VERKAUF_SCHWELLEN`. Leer = neu. "0" / "aus" / "alt" = neue Saisons bekommen "alt"; gestempelte Saisons rechnen wie gestempelt.
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
  /** 23.11.: Toepfe + Quote nach Identitaets-Vertrauen schon in Saison 1 (Budget-Gespraech). Fehlt im Altstempel = "alt". */
  toepfeS1?: WirtschaftsRegel;
  /** 24.11.: KI verlaengert nicht, was sie verkaufen wuerde, und prueft Verkaeufe netto nach Rest-Buyout. Fehlt im Altstempel = "alt". */
  restgehalt?: WirtschaftsRegel;
  /** 24.11.: Abgang am Vertragsende nur nach den Schwellen der Verkaufslogik, Restgehalt-Verkauf praktisch gesperrt. Fehlt = "alt". */
  verkaufSchwellen?: WirtschaftsRegel;
  vorjahr?: Record<string, number>;
};

export type WirtschaftsRegelName = "quote" | "anker" | "kernschutz" | "toepfeS1" | "restgehalt" | "verkaufSchwellen";

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
    case "toepfeS1":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_TOEPFE_AB_SAISON_1) ?? leseSchalter(process.env.OLY_TOEPFE_AB_SAISON_1) ?? "neu";
    case "restgehalt":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_KI_RESTGEHALT) ?? leseSchalter(process.env.OLY_KI_RESTGEHALT) ?? "neu";
    case "verkaufSchwellen":
      return leseSchalter(process.env.NEXT_PUBLIC_OLY_KI_VERKAUF_SCHWELLEN) ?? leseSchalter(process.env.OLY_KI_VERKAUF_SCHWELLEN) ?? "neu";
  }
}

export function wirtschaftsRegelnFuerNeueSaison(seasonId: string, vorjahr?: Record<string, number>): WirtschaftsRegelnStempel {
  return {
    seasonId,
    quote: schalter("quote"),
    anker: schalter("anker"),
    kernschutz: schalter("kernschutz"),
    toepfeS1: schalter("toepfeS1"),
    restgehalt: schalter("restgehalt"),
    verkaufSchwellen: schalter("verkaufSchwellen"),
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

/** Gelten die zwei Toepfe samt Vorstands-Quote schon in Saison 1 (Budget-Gespraech 23.11.)? Ab Saison 2 immer; ohne Stempel in Saison 1 nein. */
export function toepfeAbSaison1(gameState: Quelle & { season?: { id?: string } | null }): boolean {
  const nr = /(\d+)\s*$/.exec(gameState?.season?.id ?? gameState?.seasonState?.seasonId ?? "")?.[1];
  if (nr != null && Number(nr) >= 2) return true;
  return wirtschaftsRegel(gameState, "toepfeS1") === "neu";
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

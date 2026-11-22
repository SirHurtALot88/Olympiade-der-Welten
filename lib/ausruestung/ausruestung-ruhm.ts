/**
 * AUSRUESTUNG: RUHM AUS PUNKTEN (Phase 1a, 22.11., Bauplan C6, Konzept §11/§52).
 *
 * Ruhm ist eine NEUE Waehrung und hat im Code keinen Vorgaenger. Phase 1 kennt nur drei Quellen:
 *   1. Duellpunkte: je Punkt, den ein Team in einer Disziplin des Spieltags holt (`teamPoints`), ein Ruhm.
 *   2. Der erste Disziplinsieg des Spieltags: ein Holztruhen-Gutschein, hoechstens einer je Team und Spieltag.
 *   3. Platzierung: Platz 1 bis 3 zur Halbzeit und am Saisonende bringen je einen Goldtruhen-Gutschein.
 * Derby, Wimpel und Wochenziel kommen spaeter.
 *
 * Gutschrift je Wertungsseite (`d1`/`d2`) genau einmal (`gebucht["<seasonId>|<matchdayId>:<seite>"]`): Die Buchung eines Spieltags laeuft
 * gestaffelt und kann mit `forceReplace` wiederholt werden; ohne diese Sperre zaehlte derselbe Spieltag doppelt.
 *
 * Alle Teams bekommen Ruhm (KI-Teams nutzen dieselben Regeln); nur die Verlaufszeilen werden fuer Menschen gefuehrt.
 */
import type { DisciplineResultRecord, GameState } from "@/lib/data/olyDataTypes";
import { PLATZIERUNG_GOLD_BIS_PLATZ, RUHM_JE_PUNKT } from "@/lib/ausruestung/ausruestung-katalog";
import { leseTeam, mitVerlauf, schreibeTeam, sichereAusruestung } from "@/lib/ausruestung/ausruestung-lager";

/** Ruhm eines Ergebnis-Datensatzes (Duellpunkte, nie negativ, auf ganze Punkte gerundet). */
export function ruhmFuerErgebnis(r: Pick<DisciplineResultRecord, "teamPoints">): number {
  const p = typeof r.teamPoints === "number" && Number.isFinite(r.teamPoints) ? r.teamPoints : 0;
  return Math.max(0, Math.round(p * RUHM_JE_PUNKT));
}

function istMensch(gameState: GameState, teamId: string): boolean {
  return gameState.teams.find((t) => t.teamId === teamId)?.humanControlled === true;
}

/**
 * Schreibt die Ruhm-Gutschriften eines gebuchten Spieltags (Seiten d1 und/oder d2) gut. Rein und idempotent je Seite.
 * `matchdayResultId` bestimmt die Zeilen; unbekannt oder leer = nichts zu tun.
 */
export function bucheRuhmFuerSpieltag(gameState: GameState, matchdayResultId: string): GameState {
  const mr = (gameState.seasonState.matchdayResults ?? []).find((r) => r.id === matchdayResultId);
  if (!mr) return gameState;
  const zeilen = (gameState.seasonState.disciplineResults ?? []).filter((r) => r.matchdayResultId === matchdayResultId);
  if (zeilen.length === 0) return gameState;

  let aktuell = sichereAusruestung(gameState);
  // Sperren der Vorsaisons fallen weg (Schluessel tragen die Saison-ID); haelt `gebucht` klein.
  const alleSchluessel = Object.keys(aktuell.ausruestung!.gebucht);
  if (alleSchluessel.some((k) => !k.startsWith(`${mr.seasonId}|`))) {
    const behalten = Object.fromEntries(alleSchluessel.filter((k) => k.startsWith(`${mr.seasonId}|`)).map((k) => [k, true as const]));
    aktuell = { ...aktuell, ausruestung: { ...aktuell.ausruestung!, gebucht: behalten } };
  }
  const seiten: Array<"d1" | "d2"> = (["d1", "d2"] as const).filter((s) => zeilen.some((z) => z.disciplineSide === s));
  for (const seite of seiten) {
    const schluessel = `${mr.seasonId}|${mr.matchdayId}:${seite}`;
    if (aktuell.ausruestung!.gebucht[schluessel]) continue;
    const dieseSeite = zeilen.filter((z) => z.disciplineSide === seite);
    const teamIds = [...new Set(dieseSeite.map((z) => z.teamId))];
    // Der Spieltag zaehlt einmal (beim ersten gebuchten Seitenschluessel dieses Spieltags).
    const spieltagSchluessel = `${mr.seasonId}|${mr.matchdayId}`;
    const neuerSpieltag = !aktuell.ausruestung!.gebucht[spieltagSchluessel];
    const spieltage = aktuell.ausruestung!.spieltage + (neuerSpieltag ? 1 : 0);
    aktuell = {
      ...aktuell,
      ausruestung: {
        ...aktuell.ausruestung!,
        spieltage,
        gebucht: { ...aktuell.ausruestung!.gebucht, [schluessel]: true, ...(neuerSpieltag ? { [spieltagSchluessel]: true as const } : {}) },
      },
    };
    for (const teamId of teamIds) {
      const meine = dieseSeite.filter((z) => z.teamId === teamId);
      const ruhm = meine.reduce((a, z) => a + ruhmFuerErgebnis(z), 0);
      // Erster Disziplinsieg des Spieltags: Rang 1 in dieser Seite, und in keiner frueheren Seite desselben Spieltags war schon ein Sieg.
      const siegHier = meine.some((z) => z.rank === 1);
      const siegFrueher = seite === "d2" && zeilen.some((z) => z.teamId === teamId && z.disciplineSide === "d1" && z.rank === 1);
      const holz = siegHier && !siegFrueher ? 1 : 0;
      if (ruhm === 0 && holz === 0) continue;
      let team = leseTeam(aktuell, teamId);
      team = { ...team, ruhm: team.ruhm + ruhm, gutscheine: { ...team.gutscheine, holz: team.gutscheine.holz + holz } };
      team = mitVerlauf(team, spieltage, `Spieltag ${mr.matchdayId}: +${ruhm} Ruhm${holz ? ", Holztruhe für den ersten Sieg" : ""}`, istMensch(aktuell, teamId));
      aktuell = schreibeTeam(aktuell, teamId, team);
    }
  }
  return aktuell;
}

/** Punktsumme je Team aus den gebuchten Disziplin-Ergebnissen der Saison (Grundlage der Platzierung). */
export function punkteJeTeam(gameState: GameState): Map<string, number> {
  const out = new Map<string, number>();
  const gueltig = new Set((gameState.seasonState.matchdayResults ?? []).filter((r) => r.seasonId === gameState.season.id).map((r) => r.id));
  for (const z of gameState.seasonState.disciplineResults ?? []) {
    if (!gueltig.has(z.matchdayResultId)) continue;
    out.set(z.teamId, (out.get(z.teamId) ?? 0) + (typeof z.teamPoints === "number" && Number.isFinite(z.teamPoints) ? z.teamPoints : 0));
  }
  return out;
}

/** Rang je Team (1 = bester) nach Punktsumme, Gleichstand nach Team-ID (stabil, ohne Zufall). */
export function raengeNachPunkten(punkte: Map<string, number>): Map<string, number> {
  const sortiert = [...punkte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return new Map(sortiert.map(([teamId], i) => [teamId, i + 1]));
}

/**
 * Platzierungs-Gold: je Saison zur Halbzeit (die Haelfte der Spieltage gebucht) und am Ende (alle gebucht) bekommen die Teams
 * auf Platz 1 bis 3 einen Goldtruhen-Gutschein. Genau einmal je Saison und Anlass (`platzierungGebucht`).
 */
export function buchePlatzierungsGold(gameState: GameState): GameState {
  const ids = gameState.season.matchdayIds ?? [];
  if (ids.length < 2) return gameState;
  const gebucht = new Set((gameState.seasonState.matchdayResults ?? []).filter((r) => r.seasonId === gameState.season.id).map((r) => r.matchdayId));
  const anzahl = ids.filter((id) => gebucht.has(id)).length;
  const anlaesse: Array<"halbzeit" | "ende"> = [];
  if (anzahl >= Math.floor(ids.length / 2)) anlaesse.push("halbzeit");
  if (anzahl >= ids.length) anlaesse.push("ende");
  let aktuell = gameState;
  for (const anlass of anlaesse) {
    const schluessel = `${gameState.season.id}:${anlass}`;
    if (aktuell.ausruestung?.platzierungGebucht?.[schluessel]) continue;
    aktuell = sichereAusruestung(aktuell);
    const raenge = raengeNachPunkten(punkteJeTeam(aktuell));
    aktuell = { ...aktuell, ausruestung: { ...aktuell.ausruestung!, platzierungGebucht: { ...aktuell.ausruestung!.platzierungGebucht, [schluessel]: true } } };
    for (const [teamId, rang] of raenge) {
      if (rang > PLATZIERUNG_GOLD_BIS_PLATZ) continue;
      let team = leseTeam(aktuell, teamId);
      team = { ...team, gutscheine: { ...team.gutscheine, gold: team.gutscheine.gold + 1 } };
      team = mitVerlauf(team, aktuell.ausruestung!.spieltage, `Platz ${rang} ${anlass === "halbzeit" ? "zur Halbzeit" : "am Saisonende"}: Goldtruhe`, istMensch(aktuell, teamId));
      aktuell = schreibeTeam(aktuell, teamId, team);
    }
  }
  return aktuell;
}

/**
 * AUSRUESTUNG: ZUSTAND UND LAGER (Phase 1a, 22.11.). Reine Funktionen auf `gameState.ausruestung`.
 *
 * Lager (Konzept §58, Bauplan C7): 16 Plaetze fuer Ausruestung UND Materialien. Ein Teil belegt einen Platz, jedes Material genau
 * einen (Stapel bis 10; der elfte Fund derselben Sorte wird zu einem Teil). Teile sind ein Zaehler, kein Platz. Zerlegen gibt
 * Teile (1 / 2 / 4 / 8). Nichts hier kennt eine Wertung: Phase 1a ist reiner Besitz.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  LAGER_PLAETZE,
  MATERIAL_STAPEL_MAX,
  STUFEN,
  VERLAUF_MAX,
} from "@/lib/ausruestung/ausruestung-katalog";
import type {
  AusruestungSpielstand,
  LagerPlatz,
  MaterialId,
  Teil,
  TeamAusruestung,
} from "@/lib/ausruestung/ausruestung-typen";

type MitAusruestung = Pick<GameState, "ausruestung">;

export function leeresTeam(): TeamAusruestung {
  return { ruhm: 0, teile: 0, lager: [], gutscheine: { holz: 0, eisen: 0, gold: 0 }, offeneKiste: null, kisten: 0, letztesRuhmGold: null, verlauf: [] };
}

/**
 * Die Saat eines neuen Ausruestungs-Spielstands. EINMAL beim Anlegen gewuerfelt und im Spielstand abgelegt; spaeter nie mehr
 * neu gezogen. Tests reichen eine feste Saat durch `sichereAusruestung(gameState, saat)`.
 */
function neueSaat(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

/** Der Spielstand mit angelegtem `ausruestung` (idempotent; dieselbe Referenz, wenn es schon da ist). */
export function sichereAusruestung<T extends MitAusruestung>(gameState: T, saat?: string): T {
  if (gameState.ausruestung && gameState.ausruestung.version === 1) return gameState;
  const neu: AusruestungSpielstand = { version: 1, saat: saat ?? neueSaat(), spieltage: 0, teams: {}, gebucht: {}, platzierungGebucht: {} };
  return { ...gameState, ausruestung: neu };
}

/** Das Team lesen, ohne zu schreiben: fehlt es, kommt ein leeres. */
export function leseTeam(gameState: MitAusruestung, teamId: string): TeamAusruestung {
  return gameState.ausruestung?.teams?.[teamId] ?? leeresTeam();
}

/** Schreibt ein Team zurueck (legt den Spielstand bei Bedarf an). */
export function schreibeTeam<T extends MitAusruestung>(gameState: T, teamId: string, team: TeamAusruestung): T {
  const basis = sichereAusruestung(gameState);
  return { ...basis, ausruestung: { ...basis.ausruestung!, teams: { ...basis.ausruestung!.teams, [teamId]: team } } };
}

export function mitVerlauf(team: TeamAusruestung, spieltag: number, text: string, behalten = true): TeamAusruestung {
  if (!behalten) return team;
  return { ...team, verlauf: [...team.verlauf, { spieltag, text }].slice(-VERLAUF_MAX) };
}

export function belegtePlaetze(team: Pick<TeamAusruestung, "lager">): number {
  return team.lager.length;
}

export function freiePlaetze(team: Pick<TeamAusruestung, "lager">): number {
  return Math.max(0, LAGER_PLAETZE - team.lager.length);
}

export function teileImLager(team: Pick<TeamAusruestung, "lager">): Teil[] {
  return team.lager.flatMap((p) => (p.art === "teil" ? [p.teil] : []));
}

export function materialAnzahl(team: Pick<TeamAusruestung, "lager">, material: MaterialId): number {
  const p = team.lager.find((x) => x.art === "material" && x.stapel.material === material);
  return p && p.art === "material" ? p.stapel.anzahl : 0;
}

export type LagerFehler = "lager_voll" | "teil_unbekannt";

/** Legt ein Teil ins Lager; `lager_voll`, wenn kein Platz frei ist (der Fund muss getauscht, verkauft oder zerlegt werden). */
export function legeTeilAb(team: TeamAusruestung, teil: Teil): { ok: true; team: TeamAusruestung } | { ok: false; grund: LagerFehler } {
  if (team.lager.length >= LAGER_PLAETZE) return { ok: false, grund: "lager_voll" };
  return { ok: true, team: { ...team, lager: [...team.lager, { art: "teil", teil }] } };
}

/**
 * Legt Material ab: ein Stapel je Sorte bis 10; Ueberzaehliges wird je Stueck zu einem Teil. Gibt es noch keinen Stapel und kein freies
 * Platz, ist das `lager_voll` (der Fund bleibt dann in der Kiste und die Wahl schlaegt fehl).
 */
export function legeMaterialAb(team: TeamAusruestung, material: MaterialId, anzahl: number): { ok: true; team: TeamAusruestung; zuTeilen: number } | { ok: false; grund: LagerFehler } {
  const idx = team.lager.findIndex((p) => p.art === "material" && p.stapel.material === material);
  if (idx < 0) {
    if (team.lager.length >= LAGER_PLAETZE) return { ok: false, grund: "lager_voll" };
    const rein = Math.min(anzahl, MATERIAL_STAPEL_MAX);
    const zuTeilen = anzahl - rein;
    return { ok: true, zuTeilen, team: { ...team, teile: team.teile + zuTeilen, lager: [...team.lager, { art: "material", stapel: { material, anzahl: rein } }] } };
  }
  const platz = team.lager[idx] as Extract<LagerPlatz, { art: "material" }>;
  const rein = Math.min(anzahl, MATERIAL_STAPEL_MAX - platz.stapel.anzahl);
  const zuTeilen = anzahl - rein;
  const lager = team.lager.map((p, i) => (i === idx ? { art: "material" as const, stapel: { material, anzahl: platz.stapel.anzahl + rein } } : p));
  return { ok: true, zuTeilen, team: { ...team, teile: team.teile + zuTeilen, lager } };
}

/** Zerlegt ein Teil im Lager zu Teilen (Standard 1, Selten 2, Episch 4, Legendaer 8). */
export function zerlegeTeil(team: TeamAusruestung, teilId: string): { ok: true; team: TeamAusruestung; teile: number; teil: Teil } | { ok: false; grund: LagerFehler } {
  const idx = team.lager.findIndex((p) => p.art === "teil" && p.teil.id === teilId);
  if (idx < 0) return { ok: false, grund: "teil_unbekannt" };
  const teil = (team.lager[idx] as Extract<LagerPlatz, { art: "teil" }>).teil;
  const teile = STUFEN[teil.seltenheit].zerlegenTeile;
  return { ok: true, teile, teil, team: { ...team, teile: team.teile + teile, lager: team.lager.filter((_, i) => i !== idx) } };
}

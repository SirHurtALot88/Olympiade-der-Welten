/**
 * STARTBUDGET-STAFFEL (22.11., Chris: „budget soll eingeführt werden wie ich es gesagt habe! du sagst selbst ab season 2 entspannt es
 * sich sowieso, das ist ok“; Konzept docs/design/budget-gespraech-s1-22-11.md, Abschnitt Startbudget-Staffel; Messung
 * docs/design/guv-saisonfaktor-messung-22-11.md, Variante plus20plus2).
 *
 * Regel: Aufschlag auf die STARTKASSE nach Budget-Platz (Platz 1 = groesstes Startbudget): `20 + 2 x (32 - Platz)`, also Platz 32
 * +20 C, Platz 1 +82 C, Summe +1.632 C bei 32 Teams. Gilt nur fuer NEU angelegte Spiele; ein bestehender Spielstand hat seine Kasse
 * laengst gebucht und bleibt unberuehrt.
 *
 * WARUM NUR DIE KASSE WAECHST (nicht `team.budget`): `team.budget` ist die Basis der Budget-Rang-Anzeigen, des Sponsor-Qualitaetsrangs,
 * des Liga-Splits, der Draft-Stufen (>=200/260/300) und der Vorstands-Rueckstellung. Wuerde es mitwachsen, rutschten fast alle Teams
 * ueber die festen Stufen-Schwellen (190-407 statt 170-325). Die Reihenfolge bleibt ohnehin gleich (der Aufschlag steigt streng mit dem
 * Platz), aber die Schwellen wanderten. Also: `budget` = Basis (unveraendert), `cash` = Startkasse = budget + Aufschlag.
 *
 * STEMPEL: `seasonState.startbudgetStaffel = { regel, aufschlag }` -- beim Anlegen gesetzt, nie mehr geaendert. `aufschlag` steht je Team
 * im Spielstand, damit Anzeigen und Messungen "Startbudget mit Staffel" = budget + aufschlag rechnen koennen (`startbudgetMitStaffel`).
 *
 * SCHALTER (nur Server, compose + .env; der Browser loest die Regel nie selbst auf, sie steht im Spielstand):
 * `OLY_STARTBUDGET_STAFFEL` leer = neu, "0" / "aus" / "alt" = neue Spiele ohne Aufschlag.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export type StartbudgetStaffelRegel = "alt" | "neu";

export type StartbudgetStaffelStempel = {
  regel: StartbudgetStaffelRegel;
  /** Aufschlag je Team in C (bei "alt" leer). */
  aufschlag: Record<string, number>;
};

export const STAFFEL_SOCKEL_C = 20;
export const STAFFEL_SCHRITT_C = 2;

export function startbudgetStaffelSchalter(): StartbudgetStaffelRegel {
  const w = (process.env.OLY_STARTBUDGET_STAFFEL ?? "").trim().toLowerCase();
  return w === "0" || w === "aus" || w === "alt" || w === "false" || w === "nein" || w === "off" ? "alt" : "neu";
}

/** Aufschlag fuer einen Budget-Platz (1 = groesstes Startbudget) bei `anzahl` Teams. */
export function staffelAufschlag(platz: number, anzahl: number): number {
  return STAFFEL_SOCKEL_C + STAFFEL_SCHRITT_C * (anzahl - platz);
}

/**
 * Der Stempel fuer ein neues Spiel. Platz nach Startbudget absteigend, Gleichstand nach teamId (wie `buildStartRankByTeamId`).
 * Der Aufschlag haengt nur am Platz, nie am Betrag.
 */
export function startbudgetStaffelFuerNeuesSpiel(teams: ReadonlyArray<{ teamId: string; budget?: number | null }>): StartbudgetStaffelStempel {
  const regel = startbudgetStaffelSchalter();
  if (regel === "alt") return { regel, aufschlag: {} };
  const sortiert = [...teams].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.teamId.localeCompare(b.teamId));
  const aufschlag: Record<string, number> = {};
  sortiert.forEach((team, index) => {
    aufschlag[team.teamId] = staffelAufschlag(index + 1, sortiert.length);
  });
  return { regel, aufschlag };
}

/** Aufschlag eines Teams laut Stempel des Spielstands (ohne Stempel = bestehender Spielstand = 0). */
export function startbudgetStaffelAufschlag(
  gameState: { seasonState?: { startbudgetStaffel?: StartbudgetStaffelStempel | null } | null } | null | undefined,
  teamId: string,
): number {
  return gameState?.seasonState?.startbudgetStaffel?.aufschlag?.[teamId] ?? 0;
}

/** Die Startkasse eines Teams: Basis-Budget plus Aufschlag. Fuer Anzeigen und Messungen, die "Startbudget" meinen. */
export function startbudgetMitStaffel(gameState: Pick<GameState, "teams" | "seasonState"> | null | undefined, teamId: string): number | null {
  const team = gameState?.teams?.find((t) => t.teamId === teamId);
  if (!team || !Number.isFinite(team.budget)) return null;
  return Math.round((team.budget + startbudgetStaffelAufschlag(gameState, teamId)) * 100) / 100;
}

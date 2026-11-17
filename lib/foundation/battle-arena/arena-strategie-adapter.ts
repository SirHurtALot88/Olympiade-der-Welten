import type { GameState, LineupDisciplineSide } from "@/lib/data/olyDataTypes";
import { istStrategieVorlagenAktiv, normalisiereStrategie } from "@/lib/lineups/strategie-vorlagen";

/**
 * DAS ROHR DER STRATEGIE-VORLAGE VOM ENTWURF ZUR ARENA (Pilot Wettessen, 17.11.,
 * docs/design/strategie-templates-16-11.md Abschnitt 3.3).
 *
 * `place` ist nach Spielernamen geschlüsselt und taugt nicht für ein Team-Feld. Die Vorlage reist
 * deshalb wie die Kulisse im Umschlag `echterKader`:
 *
 *   echterKader.strategieByDisciplineId = { "wettessen": ["reinhauen", null] }   // [Heim, Gast]
 *
 * EINE Funktion für alle Stellen, die den Motor füttern — Vorlauf/Buchung
 * (`bereiteFixturesVor()` in lib/battle/arena-headless-runner.ts, Chromium und Node), den
 * Eingabe-Hash der Buchung (`berechneArenaEingabeHash()`) und die Anzeige
 * (`FoundationBattleArenaHost.tsx`). Sonst liefe gezeigt ≠ gebucht.
 *
 * NEUTRAL = KEIN FELD. Liefert `null` (und der Aufrufer lässt das Feld im Umschlag ganz weg), wenn
 *  - die Flagge `OLY_STRATEGIE_VORLAGEN` aus ist (Standard),
 *  - die Disziplin keinen Katalogeintrag hat (`lib/lineups/strategie-vorlagen.ts`),
 *  - beide Seiten neutral sind (kein Entwurf, kein Feld, unbekannte Kennung).
 * Damit sieht der Motor in all diesen Fällen genau den Umschlag von vorher.
 *
 * Pod-Formate (Battlefield, Mini-DM, Bahn-Pods) sind im Pilot NICHT verdrahtet: Wettessen ist ein
 * Zweier-Duell, und keine Pod-Disziplin hat bisher eine Vorlage im Katalog.
 */
export type ArenaStrategieByDisciplineId = Record<string, [string | null, string | null]>;

/** Die Vorlage EINES Teams für eine Disziplin an diesem Spieltag, oder `null` (= neutral). */
export function leseTeamStrategie(
  gameState: GameState,
  teamId: string,
  matchdayId: string | null | undefined,
  disciplineId: string,
): string | null {
  if (!matchdayId) return null;
  const entwurf = (gameState.seasonState?.lineupDrafts ?? []).find(
    (draft) => draft.teamId === teamId && draft.matchdayId === matchdayId,
  );
  if (!entwurf?.modifiers) return null;
  // Welche Seite (d1/d2) diese Disziplin trägt: zuerst aus den Einträgen des Entwurfs, sonst aus
  // dem Spielplan des Spieltags. Ohne beides gibt es keine Zuordnung — neutral.
  let seite: LineupDisciplineSide | null =
    entwurf.entries.find((eintrag) => eintrag.disciplineId === disciplineId)?.disciplineSide ?? null;
  if (!seite) {
    const spieltag = gameState.seasonState?.disciplineSchedule?.find((eintrag) => eintrag.matchdayId === matchdayId);
    if (spieltag?.discipline1?.disciplineId === disciplineId) seite = "d1";
    else if (spieltag?.discipline2?.disciplineId === disciplineId) seite = "d2";
  }
  if (!seite) return null;
  return normalisiereStrategie(disciplineId, entwurf.modifiers[seite]?.strategie);
}

export function buildArenaStrategieBeide(
  gameState: GameState,
  homeTeamId: string,
  awayTeamId: string,
  matchdayId: string | null | undefined,
  disciplineIds: readonly string[],
): ArenaStrategieByDisciplineId | null {
  if (!istStrategieVorlagenAktiv()) return null;
  let ergebnis: ArenaStrategieByDisciplineId | null = null;
  for (const disciplineId of disciplineIds) {
    const heim = leseTeamStrategie(gameState, homeTeamId, matchdayId, disciplineId);
    const gast = leseTeamStrategie(gameState, awayTeamId, matchdayId, disciplineId);
    if (heim == null && gast == null) continue;
    ergebnis = { ...(ergebnis ?? {}), [disciplineId]: [heim, gast] };
  }
  return ergebnis;
}

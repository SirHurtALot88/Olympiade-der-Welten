/**
 * ZIEHT DIE GESPEICHERTEN SAISONSTAND-PUNKTE AUF DEN GEBUCHTEN LEDGER-STAND.
 *
 * GEMELDET VON CHRIS (`w4eloo`, `re954b`): „Nach MD1 hat Z-H Platz 1 im Spieltag geholt, soll in
 * der Saison aber nur 2. sein. das kann ja gar nicht sein! ich tippe mal darauf es liegt an den
 * Mutatorpunkten" — und kurz darauf: „mein Verdacht ist bestätigt, im Saisonstand sind die
 * Mutatorpunkte mit 0,3 gar nicht drin!! bitte in die Punkte mit einrechnen!"
 *
 * BEFUND, am Live-Abbild `hwz8fk` nach zehn Spieltagen für ALLE Teams nachgerechnet:
 * `standings[team].points === Ledger-Gesamt − Ledger-Mutator`, Zeile für Zeile, ohne Ausnahme.
 * Die Tagespunkte kamen aus der Rang-zu-Punkte-Tabelle (Platz in der Disziplin → Punkte); der
 * Mutator-Aufschlag hängt dagegen an den einzelnen Leistungen (`mutatorPpsBonus`) und wurde nie
 * mitgebucht.
 *
 * ES IST KEIN RUNDUNGSRESTCHEN: der Aufschlag lag je Team bei 3,6 bis 6,9 Punkten, und ER DREHT
 * PLÄTZE — mit ihm führt H-R mit 147,4 vor N-W mit 146,0, ohne ihn N-W mit 142,1 vor H-R mit
 * 142,0. Die Tabellenspitze hing an dieser Zeile.
 *
 * DIE BUCHUNG IST GEHEILT (`standings-preview-engine.ts` addiert den Aufschlag jetzt in
 * `pointsDelta`), aber SCHON GEBUCHTE Spieltage tragen den alten Wert weiter. Ohne diese
 * Nachbuchung mischte eine laufende Saison zwei Rechenweisen — die Spieltage vor dem Fix ohne,
 * die danach mit Aufschlag. Das ist schlechter als beide Zustände einzeln.
 *
 * ES IST KEINE ZWEITE RECHNUNG: geschrieben wird `teamSummary.totalPoints` aus
 * `buildSeasonPointsLedger` — dieselbe Zahl, aus der Spielerprofil, Bühne und Feld-Rennen ihre
 * Punkte ziehen. Die Ränge werden mit `resolveProjectedRankWithTiePolicy` neu vergeben, also mit
 * derselben Tie-Policy, die auch die Buchung benutzt.
 *
 * DIE SICHERUNG, OHNE DIE DAS SKRIPT GEFÄHRLICH WÄRE: der Ledger bucht einen Spieltag ohne
 * Disziplin-Ergebnisse bewusst gar nicht (`skipped_matchdays_without_discipline_results`). Auf
 * einem beschnittenen Spielstand — die Anfangsladung im Browser liefert nur den aktiven Spieltag —
 * wäre die Ledger-Summe damit KLEINER als der echte Stand, und ein blindes Überschreiben würde
 * Punkte vernichten. Deshalb prüft `pruefeAbdeckung` zuerst, dass jeder gewertete Spieltag der
 * Saison im Ledger vorkommt; fehlt auch nur einer, wird NICHTS geschrieben.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { spieltageMitDisziplinErgebnissen } from "@/lib/foundation/season-matchday-points";
import {
  DEFAULT_STANDINGS_TIEBREAKER_MODE,
  resolveProjectedRankWithTiePolicy,
} from "@/lib/standings/standings-tiebreaker-policy";

/** Kleiner als das, und es ist Rundung statt Befund — die Punkte stehen auf einer Nachkommastelle. */
const TOLERANZ = 0.05;

export type SaisonstandPunkteAenderung = {
  teamId: string;
  punkteVorher: number | null;
  punkteNachher: number;
  rangVorher: number | null;
  rangNachher: number | null;
};

export type SaisonstandPunkteNachbuchung = {
  gameState: GameState;
  geaenderteTeams: SaisonstandPunkteAenderung[];
  /** Gesetzt, wenn NICHT nachgebucht wurde — mit dem Grund, damit der Aufrufer ihn zeigen kann. */
  uebersprungen: string | null;
};

/**
 * Deckt der Ledger jeden gewerteten Spieltag der Saison ab? Nur dann ist seine Summe der volle
 * Saisonstand und darf die gespeicherte Zahl ersetzen.
 */
function pruefeAbdeckung(gameState: GameState, seasonId: string): string | null {
  const gewertet = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === seasonId && entry.status === "preview_applied")
      .map((entry) => entry.matchdayId),
  );
  if (gewertet.size === 0) {
    return "keine gewerteten Spieltage in dieser Saison";
  }
  const gedeckt = spieltageMitDisziplinErgebnissen(gameState, seasonId);
  const fehlend = [...gewertet].filter((id) => !gedeckt.has(id));
  if (fehlend.length > 0) {
    return `${fehlend.length} gewertete(r) Spieltag(e) ohne Disziplin-Ergebnisse im Spielstand (${fehlend.join(", ")}) — ` +
      "die Ledger-Summe waere unvollstaendig";
  }
  return null;
}

export function zieheSaisonstandPunkteNach(
  gameState: GameState,
  seasonId: string = gameState.season.id,
): SaisonstandPunkteNachbuchung {
  const uebersprungen = pruefeAbdeckung(gameState, seasonId);
  if (uebersprungen != null) {
    return { gameState, geaenderteTeams: [], uebersprungen };
  }

  const ledger = buildSeasonPointsLedger(gameState, seasonId);
  const standings = gameState.seasonState.standings ?? {};

  const punkteJeTeam = new Map<string, number>(
    gameState.teams.map((team) => [
      team.teamId,
      Math.round((ledger.teamSummariesByTeamId.get(team.teamId)?.totalPoints ?? 0) * 10) / 10,
    ]),
  );

  const rangJeTeam = resolveProjectedRankWithTiePolicy(
    gameState.teams.map((team) => ({
      teamId: team.teamId,
      teamName: team.name,
      totalScore: null,
      projectedPoints: punkteJeTeam.get(team.teamId) ?? 0,
      currentRank: standings[team.teamId]?.rank ?? null,
      currentPoints: standings[team.teamId]?.points ?? null,
      matchdayRank: null,
      cash: team.cash ?? null,
    })),
    DEFAULT_STANDINGS_TIEBREAKER_MODE,
  );

  const geaenderteTeams: SaisonstandPunkteAenderung[] = [];
  const naechsteStandings = { ...standings };

  for (const team of gameState.teams) {
    const vorher = standings[team.teamId] ?? null;
    const punkteNachher = punkteJeTeam.get(team.teamId) ?? 0;
    const punkteVorher = typeof vorher?.points === "number" ? vorher.points : null;
    const rangNachher = rangJeTeam.get(team.teamId) ?? null;
    const rangVorher = typeof vorher?.rank === "number" ? vorher.rank : null;

    if (punkteVorher != null && Math.abs(punkteVorher - punkteNachher) < TOLERANZ && rangVorher === rangNachher) {
      continue;
    }

    naechsteStandings[team.teamId] = {
      ...(vorher ?? { points: 0, rank: null }),
      points: punkteNachher,
      rank: rangNachher,
      // `matchdayBaselinePoints` gehoert zum zuletzt gebuchten Spieltag und wird um genau die
      // Korrektur mitverschoben — sonst rechnete ein `forceReplace` desselben Spieltags die
      // Nachbuchung wieder heraus.
      ...(typeof vorher?.matchdayBaselinePoints === "number" && punkteVorher != null
        ? {
            matchdayBaselinePoints:
              Math.round((vorher.matchdayBaselinePoints + (punkteNachher - punkteVorher)) * 10) / 10,
          }
        : {}),
    };
    geaenderteTeams.push({ teamId: team.teamId, punkteVorher, punkteNachher, rangVorher, rangNachher });
  }

  if (geaenderteTeams.length === 0) {
    return { gameState, geaenderteTeams: [], uebersprungen: null };
  }

  return {
    gameState: {
      ...gameState,
      seasonState: { ...gameState.seasonState, standings: naechsteStandings },
    },
    geaenderteTeams,
    uebersprungen: null,
  };
}

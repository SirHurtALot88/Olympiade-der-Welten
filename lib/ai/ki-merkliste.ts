/**
 * KI-MERKLISTE (Chris, 21.11.: „ja, KI soll eine Merkliste fremder Spieler bekommen").
 *
 * Jedes KI-Team fuehrt eine kurze Liste fremder Spieler (Spieler, die einem ANDEREN Team gehoeren), die seine Kaderplanung
 * ankaufen wuerde. Es gibt dafuer KEINE eigene Heuristik: bewertet wird mit genau der Funktion, nach der die KI beim Kauf
 * waehlt (`buyUtility`, `lib/ai/organic-squad/utility.ts`), im Zustand des Teams (Kader, Bedarf je Disziplin, Kasse, Forecast,
 * Identitaet und GM-Gewichte aus `buildOrganicDraftFrame`). Ein Spieler kommt nur auf die Liste, wenn
 *   - er einem anderen Team gehoert,
 *   - der Kaufnutzen den Stop-Nutzen des Teams uebertrifft (`stopUtility`: „lieber nichts tun" verliert), und
 *   - das Team ihn zahlen koennte (Ablöse <= Kasse und <= freier Investitionstopf des Vorstands).
 * Ohne Zufall: gleiche Eingabe, gleiche Liste (kein Jitter-Saatgut, Gleichstand nach `playerId`).
 *
 * WIRKUNG AUF KAEUFE: keine. Die KI kauft heute ausschliesslich aus dem Freien-Spieler-Pool (`fromTeamId: null`), es gibt
 * keinen Kaufweg von Team zu Team; ein Merkliste-Spieler laesst sich deshalb ueber die bestehenden Wege nicht ansprechen.
 * Die Liste aendert kein Kaufverhalten (siehe `docs/design/ki-merkliste-21-11.md`).
 *
 * Gespeichert in `seasonState.kiMerkliste[teamId]`, neu berechnet beim Spieltagsabschluss (`aktualisiereKiMerkliste`).
 */
import { buildOrganicDraftFrame } from "@/lib/ai/organic-squad/draft-adapter";
import { buildStepTeamState, createOrganicPlanStepState } from "@/lib/ai/organic-squad/draft-builder";
import { SOLIDE_THRESHOLD } from "@/lib/ai/organic-squad/types";
import { buyUtility, stopUtility } from "@/lib/ai/organic-squad/utility";
import type { GameState, KiMerklisteEintrag, KiMerklisteStufe, Player } from "@/lib/data/olyDataTypes";
import { KI_MERKLISTE_MAX, KI_MERKLISTE_STUFEN_AB } from "@/lib/ai/ki-merkliste-lesen";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";

export function istKiTeam(gameState: GameState, teamId: string): boolean {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return false;
  const modus = getTeamControlSettings(gameState, teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
  return modus === "ai";
}

function stufeFuer(vorsprung: number, bester: number): KiMerklisteStufe {
  const anteil = bester > 0 ? vorsprung / bester : 0;
  return (KI_MERKLISTE_STUFEN_AB.find((zeile) => anteil >= zeile.anteil) ?? KI_MERKLISTE_STUFEN_AB[KI_MERKLISTE_STUFEN_AB.length - 1]!).stufe;
}

/**
 * Die Merkliste EINES Teams, frisch gerechnet (rein, schreibt nichts). `vorher` traegt `seit` fort, wenn der Spieler schon
 * auf der alten Liste stand.
 */
export function berechneKiMerklisteFuerTeam(
  gameState: GameState,
  teamId: string,
  vorher: readonly KiMerklisteEintrag[] = [],
): KiMerklisteEintrag[] {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return [];
  const besitzerJeSpieler = new Map<string, string>();
  for (const eintrag of gameState.rosters) {
    if (eintrag.teamId !== teamId) besitzerJeSpieler.set(eintrag.playerId, eintrag.teamId);
  }
  const eigene = new Set(gameState.rosters.filter((eintrag) => eintrag.teamId === teamId).map((eintrag) => eintrag.playerId));
  const spielerJeId = new Map<string, Player>(gameState.players.map((spieler) => [spieler.id, spieler]));
  const startkader: Player[] = [];
  for (const id of eigene) {
    const spieler = spielerJeId.get(id);
    if (spieler) startkader.push(spieler);
  }
  const kandidaten: Player[] = [];
  for (const id of besitzerJeSpieler.keys()) {
    const spieler = spielerJeId.get(id);
    if (spieler) kandidaten.push(spieler);
  }
  if (kandidaten.length === 0) return [];

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  // Ohne draftSeed: kein Jitter, die Liste ist reine Funktion des Spielstands.
  const frame = buildOrganicDraftFrame({ gameState, team, identity, startingSquad: startkader, candidates: kandidaten, draftSeed: null });
  const planInput = frame.planInput;
  const zustand = buildStepTeamState(planInput, createOrganicPlanStepState(planInput));
  const stopp = stopUtility(zustand);
  const kasse = planInput.economy.cash;
  const topf = planInput.economy.feeCap;

  const bewertet = planInput.candidates
    .filter((kandidat) => kandidat.marketValue <= kasse && (topf == null || kandidat.marketValue <= topf))
    .map((kandidat) => ({ kandidat, vorsprung: buyUtility(kandidat, zustand) - stopp }))
    .filter((zeile) => zeile.vorsprung > 0)
    .sort((a, b) => b.vorsprung - a.vorsprung || (a.kandidat.playerId < b.kandidat.playerId ? -1 : 1))
    .slice(0, KI_MERKLISTE_MAX);
  if (bewertet.length === 0) return [];

  const bester = bewertet[0]!.vorsprung;
  const vorherJeSpieler = new Map(vorher.map((eintrag) => [eintrag.playerId, eintrag] as const));
  const matchdayId = gameState.matchdayState?.matchdayId ?? null;
  return bewertet.map(({ kandidat, vorsprung }) => {
    // Grund: die Disziplin, in der der Spieler dem Team am meisten bringt (Bedarf x Wert ueber der Solide-Schwelle).
    let besteDisziplin: string | null = null;
    let besterWert = 0;
    let abgedeckt = 0;
    for (const need of zustand.disciplineNeeds) {
      const wert = kandidat.disciplineRatings[need.disciplineId] ?? 0;
      if (wert <= SOLIDE_THRESHOLD) continue;
      const punkte = need.needWeight * wert;
      if (punkte > besterWert) {
        besterWert = punkte;
        besteDisziplin = need.disciplineId;
        abgedeckt = need.coveredCount;
      }
    }
    return {
      playerId: kandidat.playerId,
      besitzerTeamId: besitzerJeSpieler.get(kandidat.playerId) ?? "",
      stufe: stufeFuer(vorsprung, bester),
      vorsprung: Math.round(vorsprung * 1000) / 1000,
      disziplinId: besteDisziplin,
      abgedeckt,
      seit: vorherJeSpieler.get(kandidat.playerId)?.seit ?? matchdayId,
      stand: matchdayId,
    };
  });
}

/**
 * Rechnet die Merkliste aller KI-Teams neu und schreibt sie in `seasonState.kiMerkliste`. Aufgerufen beim Spieltagsabschluss;
 * `OLY_KI_MERKLISTE=0` schaltet ab (dann bleibt der Spielstand unveraendert). Menschlich gefuehrte Teams bekommen keine Liste.
 */
export function aktualisiereKiMerkliste(gameState: GameState): GameState {
  if (process.env.OLY_KI_MERKLISTE === "0") return gameState;
  const alt = gameState.seasonState.kiMerkliste ?? {};
  const neu: Record<string, KiMerklisteEintrag[]> = {};
  for (const team of gameState.teams) {
    if (!istKiTeam(gameState, team.teamId)) continue;
    const liste = berechneKiMerklisteFuerTeam(gameState, team.teamId, alt[team.teamId] ?? []);
    if (liste.length > 0) neu[team.teamId] = liste;
  }
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      kiMerkliste: neu,
      kiMerklisteStand: { seasonId: gameState.season.id, matchdayId: gameState.matchdayState?.matchdayId ?? null },
    },
  };
}

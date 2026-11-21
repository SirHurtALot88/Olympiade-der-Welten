/**
 * NEUE MELDUNGSARTEN DES POSTFACHS (Chris, 21.11., Entscheidung 4): Wieder einsetzbar, Moral gekippt, Vorstand-Freigabe.
 *
 * Alle drei sind aus Daten abgeleitet, die der Spielstand ohnehin führt, und brauchen keinen neuen Zustand:
 *  - Wieder einsetzbar: `getPlayerAvailabilityView` meldet „recovering", sobald die Ausfallzeit vorbei ist (der erste Spieltag
 *    zurück; das Erholungsfenster ist genau einen Spieltag lang).
 *  - Moral gekippt: `PlayerMoraleState.vorher` ist der Wert vor der Fortschreibung dieses Spieltags; fällt er dabei unter eine
 *    Stufe (80/60/40/20, `moralStufe`), entsteht die Meldung.
 *  - Vorstand-Freigabe: `resolveVorstandFreigabe`; die Prozentzahl steckt in der Kennung, ändert sich die Stufe, ist es eine
 *    neue (ungelesene) Meldung.
 *
 * „Interesse an einem Spieler" (KI-Team merkt einen fremden Spieler vor) gibt es bewusst NICHT: die KI führt heute keine
 * Vormerkliste, aus der sich das ehrlich ableiten ließe; eine erfundene Heuristik wäre gezeigt ≠ gebucht.
 *
 * Reine Funktionen, kein React. Aufgerufen von `buildTeamTasks` in `game-inbox-service.ts`.
 */
import type { GameInboxItem, GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { VORSTAND_STUFEN, resolveVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";
import { klemmeMoral, moralStufe } from "@/lib/morale/moral-anzeige";

type NeueMeldungenInput = {
  saveId: string;
  gameState: GameState;
  team: Team;
  roster: RosterEntry[];
  playerById: Map<string, Player>;
  controlMode: string;
  createdAt: string;
};

function spieltagLabel(gameState: GameState, matchdayId: string | null | undefined) {
  if (!matchdayId) return null;
  const index = gameState.season.matchdayIds?.findIndex((entry) => entry === matchdayId) ?? -1;
  return index >= 0 ? `Spieltag ${index + 1}` : null;
}

function basis(input: NeueMeldungenInput) {
  return {
    saveId: input.saveId,
    seasonId: input.gameState.season.id,
    matchday: input.gameState.matchdayState.matchdayId,
    teamId: input.team.teamId,
    createdAt: input.createdAt,
    status: "open" as const,
  };
}

/** Spieler, die nach der Verletzung wieder aufstellbar sind. Nach der Regel vom 18.11.: erst jetzt wieder einsetzbar. */
export function buildWiederEinsetzbarMeldungen(input: NeueMeldungenInput): GameInboxItem[] {
  const matchdayId = input.gameState.matchdayState.matchdayId;
  const items: GameInboxItem[] = [];
  for (const entry of input.roster) {
    const spieler = input.playerById.get(entry.playerId);
    if (!spieler) continue;
    const sicht = getPlayerAvailabilityView(input.gameState, entry.playerId, input.team.teamId, matchdayId);
    if (sicht.injuryStatus !== "recovering" || sicht.isUnavailable) continue;
    const bis = spieltagLabel(input.gameState, sicht.injuryUntilMatchday);
    items.push({
      ...basis(input),
      itemId: `player_return:${input.saveId}:${input.gameState.season.id}:${input.team.teamId}:${entry.playerId}:${sicht.injuredAtMatchdayId ?? "x"}`,
      playerId: entry.playerId,
      category: "news",
      severity: "info",
      title: `Wieder einsetzbar: ${spieler.name}`,
      description: `${spieler.name} ist zurück${bis ? ` (fehlte bis ${bis})` : ""} und steht wieder für die Einsatzliste bereit. Die Müdigkeit ist noch nicht ganz weg.`,
      ctaLabel: "Zur Einsatzliste",
      targetView: "lineup",
      targetParams: { team: input.team.teamId, player: entry.playerId },
      source: "player_return",
    });
  }
  return items;
}

/** Moral ist unter eine Stufe gefallen (80/60/40/20). Anstiege und Bewegungen innerhalb einer Stufe bleiben still. */
export function buildMoralGekippt(input: NeueMeldungenInput): GameInboxItem[] {
  const items: GameInboxItem[] = [];
  const rosterIds = new Set(input.roster.map((entry) => entry.playerId));
  for (const moral of input.gameState.playerMoraleState ?? []) {
    if (moral.teamId !== input.team.teamId || !rosterIds.has(moral.playerId) || !moral.vorher) continue;
    const jetzt = moralStufe(moral.morale);
    const frueher = moralStufe(moral.vorher.morale);
    if (jetzt.index <= frueher.index) continue;
    const spieler = input.playerById.get(moral.playerId);
    if (!spieler) continue;
    const schlimmsterGrund = [...(moral.reasons ?? [])].sort((a, b) => a.valueDelta - b.valueDelta)[0];
    const grund = schlimmsterGrund && schlimmsterGrund.valueDelta < 0 ? ` Größter Abzug: ${schlimmsterGrund.label}.` : "";
    items.push({
      ...basis(input),
      itemId: `moral_gekippt:${input.saveId}:${input.gameState.season.id}:${input.team.teamId}:${moral.playerId}:${moral.vorher.matchdayId}:${jetzt.id}`,
      playerId: moral.playerId,
      category: "warning",
      severity: jetzt.index >= 3 ? "warning" : "info",
      title: `Moral gekippt: ${spieler.name} ist ${jetzt.wort}`,
      description: `Moral ${Math.round(klemmeMoral(moral.morale))} nach ${Math.round(klemmeMoral(moral.vorher.morale))} zuvor (${frueher.wort} → ${jetzt.wort}).${grund}`,
      ctaLabel: "Spieler ansehen",
      targetView: "trainingCompact",
      targetParams: { team: input.team.teamId, player: moral.playerId },
      source: "moral_gekippt",
    });
  }
  return items;
}

/** Der Vorstand gibt nicht mehr alles frei: sagt, wie viel und was bis zur nächsten Stufe fehlt. */
export function buildVorstandFreigabeMeldung(input: NeueMeldungenInput): GameInboxItem[] {
  const freigabe = resolveVorstandFreigabe(input.gameState, input.team.teamId);
  if (freigabe.grund !== "vertrauen" || freigabe.vertrauen == null || freigabe.anteil >= 1) return [];
  const prozent = Math.round(freigabe.anteil * 100);
  const naechste = [...VORSTAND_STUFEN].reverse().find((stufe) => stufe.abVertrauen > (freigabe.vertrauen ?? 0));
  const vertrauen = (Math.round(freigabe.vertrauen * 10) / 10).toString().replace(".", ",");
  const hinweis = naechste
    ? ` Ab ${String(naechste.abVertrauen).replace(".", ",")} wären es ${Math.round(naechste.anteil * 100)} %.`
    : "";
  return [
    {
      ...basis(input),
      itemId: `vorstand_freigabe:${input.saveId}:${input.gameState.season.id}:${input.team.teamId}:${prozent}`,
      category: "finance",
      severity: "info",
      title: `Vorstand: Freigabe ${prozent} %`,
      description: `Mit Vertrauen ${vertrauen} gibt der Vorstand ${prozent} % deines verfügbaren Budgets frei; das Geld bleibt auf dem Konto.${hinweis}`,
      ctaLabel: "Zu den Finanzen",
      targetView: "finances",
      targetParams: { team: input.team.teamId },
      source: "vorstand_freigabe",
    },
  ];
}

export function buildNeueMeldungenFuerTeam(input: NeueMeldungenInput): GameInboxItem[] {
  if (input.controlMode !== "manual") return [];
  return [...buildWiederEinsetzbarMeldungen(input), ...buildMoralGekippt(input), ...buildVorstandFreigabeMeldung(input)];
}

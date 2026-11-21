import type { GameState } from "@/lib/data/olyDataTypes";
import { getPrevSeasonInjuryCount } from "@/lib/ai/ai-team-management-preview-service";
import {
  entscheideKiReha,
  KI_REHA_RUECKLAGE_S1_FAKTOR,
  resolveSpitzenbedarf,
  type KiRehaEntscheidung,
} from "@/lib/ai/ki-schonung-reha-regeln";
import { getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { normalisiereFinanzwert, resolveKiRuecklageFuerTeam } from "@/lib/finance/ki-ruecklage";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { createCaptureBatchPersistence } from "@/lib/persistence/capture-batch-persistence";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * KI-REHA IM LAUFENDEN SPIEL (Chris 21.11.; docs/design/ki-schonung-reha-analyse-21-11.md, Regel R4).
 *
 * Bis hierher baute die KI Gebaeude nur in der Preseason, und der Recovery-Center-Score hing an Vorsaison-
 * Verletzungen, die es in Saison 1 nicht gibt: am Live-Abbild stand bei keinem der 32 Teams ein Gebaeude, obwohl
 * Reha die erwarteten Verletzungen am staerksten senkt (Stufe 1 -33 %, Stufe 2 -55 %).
 *
 * Dieser Lauf kommt beim Spieltagsabschluss und entscheidet je Team HOECHSTENS EINMAL (eine Stufe je Team und
 * Spieltag) ueber den Ausbau des Recovery Centers. Die Entscheidung selbst ist eine reine Funktion
 * (`entscheideKiReha`); hier steht nur, was sie an Daten braucht und wie gebaut wird:
 *   - bezahlt ueber `previewFacilityUpgrade`/`applyFacilityUpgrade`, damit der Investitionstopf des Vorstands
 *     (`pruefeGebaeudeGegenVorstandFreigabe`) und die Kasse hart gelten - dieselbe Sperre wie fuer den Menschen;
 *   - gebaut wird nur, was nach der Ruecklage nach Finanzwert (`resolveKiRuecklageFuerTeam`) noch frei ist;
 *   - KI-Teams und menschliche Teams mit delegiertem Bereich „Gebaeude“; Menschen ohne Delegation bleiben unberuehrt.
 */

export type KiRehaBauErgebnis = {
  teamsGeprueft: number;
  gebaut: Array<{ teamId: string; vonStufe: number; aufStufe: number; kosten: number; grund: string[] }>;
  amGeldGescheitert: string[];
  vomVorstandGesperrt: string[];
  uebersprungenMensch: number;
};

function saisonNummer(gameState: GameState): number {
  return Number(/(\d+)\s*$/.exec(gameState.season?.id ?? "")?.[1] ?? 1);
}

/** Bedarf, Geld und Entscheidung fuer EIN Team; ohne Schreiben. Fuer Tests und Messskripte exportiert. */
export function bewerteKiRehaFuerTeam(
  gameState: GameState,
  teamId: string,
): (KiRehaEntscheidung & { aktuelleStufe: number; freiesGeld: number }) | null {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return null;
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  if (rosterEntries.length === 0) return null;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const players = rosterEntries.map((entry) => playerById.get(entry.playerId)).filter((player) => Boolean(player));
  const fatigueAvg =
    players.length > 0 ? players.reduce((sum, player) => sum + (player?.fatigue ?? 0), 0) / players.length : 0;
  const verletzungenDieseSaison = (gameState.seasonState.injuryEvents ?? []).filter(
    (event) => event.teamId === teamId && event.seasonId === gameState.season.id && event.result === "injured",
  ).length;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const ruecklage = resolveKiRuecklageFuerTeam(gameState, teamId, {
    cash: team.cash ?? 0,
    rosterSalaryTotal: rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? 0), 0),
    rosterMarketValue: players.reduce((sum, player) => sum + Math.max(0, player?.marketValue ?? player?.displayMarketValue ?? 0), 0),
    finances: identity?.finances,
  }).ruecklage;
  const ruecklageEffektiv = saisonNummer(gameState) <= 1 ? ruecklage * KI_REHA_RUECKLAGE_S1_FAKTOR : ruecklage;
  const freiesGeld = (team.cash ?? 0) - ruecklageEffektiv;
  const aktuelleStufe = getTeamFacilityState(gameState, teamId).facilities.recovery_center?.level ?? 0;
  const naechsteStufeKosten = getFacilityLevelDefinition("recovery_center", aktuelleStufe + 1)?.upgradeCost ?? null;
  const entscheidung = entscheideKiReha({
    kaderGroesse: rosterEntries.length,
    spitzenbedarf: resolveSpitzenbedarf(gameState),
    fatigueAvg,
    verletzungenDieseSaison,
    verletzungenVorsaison: getPrevSeasonInjuryCount(gameState, teamId),
    aktuelleStufe,
    finanzwert: normalisiereFinanzwert(identity?.finances),
    freiesGeldNachRuecklage: freiesGeld,
    naechsteStufeKosten,
  });
  return { ...entscheidung, aktuelleStufe, freiesGeld };
}

/**
 * Beim Spieltagsabschluss: jedes KI-Team (und jedes Menschen-Team mit delegierten Gebaeuden) prueft den Reha-Bedarf
 * und baut hoechstens EINE Stufe. Alle Writes laufen in einem Batch und werden einmal geschrieben.
 */
export function bauKiRehaBeiSpieltagsabschluss(input: {
  saveId: string;
  persistence?: PersistenceService;
}): KiRehaBauErgebnis {
  const basePersistence = input.persistence ?? createPersistenceService();
  const ergebnis: KiRehaBauErgebnis = {
    teamsGeprueft: 0,
    gebaut: [],
    amGeldGescheitert: [],
    vomVorstandGesperrt: [],
    uebersprungenMensch: 0,
  };
  const seed = basePersistence.getSaveById(input.saveId);
  if (!seed) return ergebnis;
  const deferred = createCaptureBatchPersistence({ delegate: basePersistence, saveId: input.saveId, seed });
  const persistence = deferred.persistence;
  let save: PersistedSaveGame = seed;
  const kontrolle = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);

  for (const team of save.gameState.teams) {
    const einstellung = kontrolle[team.teamId];
    const modus = einstellung?.controlMode ?? "manual";
    const delegiert = modus === "manual" && isBereichDelegiert(einstellung, "gebaeude");
    if (modus !== "ai" && !delegiert) {
      ergebnis.uebersprungenMensch += 1;
      continue;
    }
    ergebnis.teamsGeprueft += 1;
    const bewertung = bewerteKiRehaFuerTeam(save.gameState, team.teamId);
    if (!bewertung) continue;
    if (bewertung.amGeldGescheitert) ergebnis.amGeldGescheitert.push(team.teamId);
    if (!bewertung.bauen) continue;

    const vorschau = previewFacilityUpgrade(save, team.teamId, "recovery_center");
    if (!vorschau.ok || !vorschau.confirmToken) {
      if (vorschau.blockingReasons.some((grund) => grund.startsWith("vorstand_"))) {
        ergebnis.vomVorstandGesperrt.push(team.teamId);
      }
      continue;
    }
    const angewendet = applyFacilityUpgrade(save, team.teamId, "recovery_center", vorschau.confirmToken, undefined, persistence);
    if (!angewendet.applied) continue;
    save = angewendet.save ?? persistence.getSaveById(save.saveId) ?? save;
    ergebnis.gebaut.push({
      teamId: team.teamId,
      vonStufe: bewertung.aktuelleStufe,
      aufStufe: bewertung.aktuelleStufe + 1,
      kosten: vorschau.upgradeCost ?? 0,
      grund: bewertung.grund,
    });
  }

  deferred.flush();
  return ergebnis;
}

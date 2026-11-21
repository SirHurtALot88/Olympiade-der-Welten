/**
 * Office 21.11, Reiter „Praemien": Siegpraemie und Treuepraemie bei Verlaengerung (Chris 21.11., Entscheidung 5).
 *
 *  - Praemien zahlen aus dem GEHALTSTOPF (kein dritter Topf). Die Sperre ist hart: ein Plan, dessen fest geplante Kosten
 *    ueber dem freien Gehaltstopf liegen, laesst sich nicht speichern; gebucht wird nur, was der Topf noch hergibt.
 *  - Nur der MENSCH nutzt Praemien. Die KI noch nicht (erst nach einer Messung mit 32 KI-Teams).
 *  - Praemien bewegen die MORAL, nie direkt die Leistung: die Moral wirkt wie bisher ueber Form und Moral auf die Eignung.
 *    Die Eignungsmatrix und die Rangtreue der Disziplinen bleiben unberuehrt.
 *  - Der Vorstand verhaengt keine Geldstrafen; Praemien bewegen sein Vertrauen nicht.
 *
 * Definition „Sieg" (Chris hat sie nicht festgelegt, Annahme): ein Disziplin-Ergebnis des Spieltags in der oberen Haelfte
 * der Liga des Teams. Eingesetzt ist, wer in diesem Spieltag eine gewertete Zeile hat.
 */

import type { GameState, PlayerMoraleState, VorstandPraemienPlan } from "@/lib/data/olyDataTypes";
import { restlaufzeit } from "@/lib/contracts/vertragslaufzeit";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

/** Siegpraemie je Sieg und eingesetztem Spieler, in C (Stufe 0 = aus). */
export const SIEG_STUFEN: ReadonlyArray<{ satz: number; moral: number; titel: string }> = [
  { satz: 0, moral: 0, titel: "Aus" },
  { satz: 0.01, moral: 1, titel: "0,01 C" },
  { satz: 0.02, moral: 2, titel: "0,02 C" },
];
/** Treuepraemie als Anteil des neuen Jahresgehalts bei einer Verlaengerung. */
export const TREUE_STUFEN: ReadonlyArray<{ anteil: number; moral: number; titel: string }> = [
  { anteil: 0, moral: 0, titel: "Aus" },
  { anteil: 0.05, moral: 5, titel: "5 %" },
  { anteil: 0.1, moral: 10, titel: "10 %" },
];
/** Wie viele Spieler einer Mannschaft im Schnitt je Spieltag eingesetzt sind (nur fuer die Kostenvorschau). */
export const EINSATZ_SCHNITT = 6;

const r2 = (v: number) => Math.round(v * 100) / 100;

export function leerePraemien(seasonId: string): VorstandPraemienPlan {
  return { seasonId, siegStufe: 0, treueStufe: 0, siegGebucht: 0, treueGebucht: 0, praemierteSpieltage: [], praemierteVerlaengerungen: [], protokoll: [] };
}

/** Der Plan dieser Saison; eine neue Saison beginnt ohne Praemien (der Mensch legt sie neu fest). */
export function lesPraemienPlan(gameState: GameState, teamId: string): VorstandPraemienPlan {
  const p = gameState.seasonState?.vorstandPraemien?.[teamId];
  if (p && p.seasonId === gameState.season?.id) return p;
  return leerePraemien(gameState.season?.id ?? "");
}

function schreibe(gameState: GameState, teamId: string, plan: VorstandPraemienPlan): GameState {
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, vorstandPraemien: { ...(gameState.seasonState.vorstandPraemien ?? {}), [teamId]: plan } },
  };
}

function verbleibendeSpieltage(gameState: GameState): number {
  const gespielt = new Set(
    (gameState.seasonState.matchdayResults ?? []).filter((e) => e.seasonId === gameState.season.id).map((e) => e.matchdayId).filter(Boolean),
  );
  return Math.max(0, (gameState.season.matchdayIds?.length ?? 0) - gespielt.size);
}

export type PraemienVorschau = {
  siegErwartet: number;
  /** Treuepraemie, falls alle Spieler mit auslaufendem Vertrag verlaengert werden (Obergrenze). */
  treueMoeglich: number;
  fest: number;
  gehaltFrei: number;
  ueberTopf: boolean;
  verbleibendeSpieltage: number;
  auslaufend: number;
};

export function vorschauPraemien(gameState: GameState, teamId: string, plan: VorstandPraemienPlan): PraemienVorschau {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  const tage = verbleibendeSpieltage(gameState);
  // Erwartung: ein Sieg je Spieltag (zwei Disziplinen, obere Haelfte), EINSATZ_SCHNITT Spieler.
  const siegErwartet = r2(SIEG_STUFEN[plan.siegStufe]!.satz * tage * EINSATZ_SCHNITT);
  let treueMoeglich = 0;
  let auslaufend = 0;
  for (const r of gameState.rosters) {
    if (r.teamId !== teamId) continue;
    if (restlaufzeit(r, gameState) > 1) continue;
    auslaufend += 1;
    treueMoeglich += TREUE_STUFEN[plan.treueStufe]!.anteil * (r.salary ?? 0);
  }
  treueMoeglich = r2(treueMoeglich);
  const fest = r2(siegErwartet + treueMoeglich);
  return {
    siegErwartet,
    treueMoeglich,
    fest,
    gehaltFrei: stand.gehalt.frei,
    ueberTopf: stand.gedeckelt && fest > stand.gehalt.frei + 1e-9,
    verbleibendeSpieltage: tage,
    auslaufend,
  };
}

export type PraemienErgebnis = { ok: boolean; reason: string | null; meldung: string; gameState: GameState };

/** Plan festlegen. Hart gesperrt, wenn die fest geplanten Kosten ueber dem freien Gehaltstopf liegen. */
export function setzePraemienPlan(gameState: GameState, teamId: string, input: { siegStufe: number; treueStufe: number }): PraemienErgebnis {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team?.humanControlled) return { ok: false, reason: "nur_mensch", meldung: "Prämien gibt es nur für Teams von Menschen.", gameState };
  const sieg = Math.round(input.siegStufe);
  const treue = Math.round(input.treueStufe);
  if (!(sieg >= 0 && sieg < SIEG_STUFEN.length) || !(treue >= 0 && treue < TREUE_STUFEN.length)) {
    return { ok: false, reason: "ungueltige_stufe", meldung: "Diese Stufe gibt es nicht.", gameState };
  }
  const alt = lesPraemienPlan(gameState, teamId);
  const neu: VorstandPraemienPlan = { ...alt, siegStufe: sieg, treueStufe: treue };
  const v = vorschauPraemien(gameState, teamId, neu);
  if (v.ueberTopf) {
    return {
      ok: false,
      reason: "gehaltstopf_zu_klein",
      meldung: `Die Sperre ist hart: ${v.fest.toFixed(2).replace(".", ",")} C Prämien liegen über dem freien Gehaltstopf (${v.gehaltFrei.toFixed(2).replace(".", ",")} C). Weniger wählen oder den Vorstand um Sonderbudget bitten.`,
      gameState,
    };
  }
  const text =
    sieg === 0 && treue === 0
      ? "Prämien ausgeschaltet"
      : `Prämien festgelegt: Sieg ${SIEG_STUFEN[sieg]!.titel}, Treue ${TREUE_STUFEN[treue]!.titel}`;
  const next = schreibe(gameState, teamId, {
    ...neu,
    protokoll: [...neu.protokoll, { zeit: new Date().toISOString(), art: "plan" as const, text }].slice(-12),
  });
  return { ok: true, reason: null, meldung: `${text}. Fest geplant ${v.fest.toFixed(2).replace(".", ",")} C aus dem Gehaltstopf.`, gameState: next };
}

function hebeMoral(gameState: GameState, spielerIds: Set<string>, teamId: string, punkte: number, label: string): GameState {
  if (punkte <= 0 || spielerIds.size === 0) return gameState;
  const states = gameState.playerMoraleState;
  if (!states) return gameState;
  const next: PlayerMoraleState[] = states.map((m) =>
    m.teamId === teamId && spielerIds.has(m.playerId)
      ? {
          ...m,
          morale: Math.min(100, Math.round((m.morale + punkte) * 10) / 10),
          reasons: [...m.reasons, { reasonId: `praemie:${gameState.season.id}:${m.reasons.length}`, label, valueDelta: punkte, source: "vorstand_praemie" }].slice(-12),
        }
      : m,
  );
  return { ...gameState, playerMoraleState: next };
}

/**
 * Siegpraemien eines gebuchten Spieltags (aufgerufen vom Spieltags-Buchungsweg, nur eine billige Pruefung ohne Plan).
 * Idempotent je Spieltag-Ergebnis. Zahlt nur, was der freie Gehaltstopf noch hergibt.
 */
export function bucheSiegpraemien(gameState: GameState, matchdayResultId: string): GameState {
  const plaene = gameState.seasonState?.vorstandPraemien;
  if (!plaene) return gameState;
  let gs = gameState;
  for (const [teamId, plan] of Object.entries(plaene)) {
    if (plan.seasonId !== gameState.season.id || plan.siegStufe <= 0) continue;
    if (plan.praemierteSpieltage.includes(matchdayResultId)) continue;
    const team = gs.teams.find((t) => t.teamId === teamId);
    if (!team?.humanControlled) continue;
    const ergebnisse = (gs.seasonState.disciplineResults ?? []).filter((r) => r.matchdayResultId === matchdayResultId && r.teamId === teamId);
    if (ergebnisse.length === 0) continue;
    const split = isLeagueSplitActive(gs);
    const tier = split ? getLeagueOf(gs, teamId) : null;
    const ligaGroesse = gs.teams.filter((t) => !tier || getLeagueOf(gs, t.teamId) === tier).length;
    const siege = ergebnisse.filter((r) => r.rank <= Math.floor(ligaGroesse / 2)).length;
    const eingesetzt = new Set(
      (gs.seasonState.playerDisciplinePerformances ?? []).filter((p) => p.matchdayResultId === matchdayResultId && p.teamId === teamId).map((p) => p.playerId),
    );
    const stufe = SIEG_STUFEN[plan.siegStufe]!;
    const kosten = r2(siege * eingesetzt.size * stufe.satz);
    const aktuell = lesPraemienPlan(gs, teamId);
    let neuerPlan: VorstandPraemienPlan = { ...aktuell, praemierteSpieltage: [...aktuell.praemierteSpieltage, matchdayResultId] };
    if (kosten > 0) {
      const frei = berechneVorstandBudgetStand(gs, teamId).gehalt.frei;
      if (kosten > frei + 1e-9) {
        neuerPlan = { ...neuerPlan, protokoll: [...neuerPlan.protokoll, { zeit: new Date().toISOString(), art: "sieg" as const, text: `Siegprämie ${kosten.toFixed(2).replace(".", ",")} C nicht gezahlt: der Gehaltstopf gibt nur ${frei.toFixed(2).replace(".", ",")} C frei.` }].slice(-12) };
        gs = schreibe(gs, teamId, neuerPlan);
        continue;
      }
      gs = {
        ...gs,
        teams: gs.teams.map((t) => (t.teamId === teamId ? { ...t, cash: r2((t.cash ?? 0) - kosten) } : t)),
      };
      neuerPlan = {
        ...neuerPlan,
        siegGebucht: r2(neuerPlan.siegGebucht + kosten),
        protokoll: [...neuerPlan.protokoll, { zeit: new Date().toISOString(), art: "sieg" as const, text: `Siegprämie: ${siege} Sieg(e) × ${eingesetzt.size} Spieler`, betrag: kosten }].slice(-12),
      };
      gs = hebeMoral(gs, eingesetzt, teamId, stufe.moral * siege, "Siegprämie");
    }
    gs = schreibe(gs, teamId, neuerPlan);
  }
  return gs;
}

/** Treuepraemie bei einer Verlaengerung durch den Menschen: Anteil des neuen Jahresgehalts, aus dem Gehaltstopf. */
export function bucheTreuepraemie(gameState: GameState, teamId: string, playerId: string, neuesGehalt: number | null | undefined, kennung: string): GameState {
  const plan = lesPraemienPlan(gameState, teamId);
  if (plan.treueStufe <= 0 || !(neuesGehalt && neuesGehalt > 0)) return gameState;
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team?.humanControlled) return gameState;
  if (plan.praemierteVerlaengerungen.includes(kennung)) return gameState;
  const stufe = TREUE_STUFEN[plan.treueStufe]!;
  const kosten = r2(neuesGehalt * stufe.anteil);
  const frei = berechneVorstandBudgetStand(gameState, teamId).gehalt.frei;
  if (kosten > frei + 1e-9) {
    return schreibe(gameState, teamId, {
      ...plan,
      praemierteVerlaengerungen: [...plan.praemierteVerlaengerungen, kennung],
      protokoll: [...plan.protokoll, { zeit: new Date().toISOString(), art: "treue" as const, text: `Treueprämie ${kosten.toFixed(2).replace(".", ",")} C nicht gezahlt: der Gehaltstopf gibt nur ${frei.toFixed(2).replace(".", ",")} C frei.` }].slice(-12),
    });
  }
  let gs: GameState = {
    ...gameState,
    teams: gameState.teams.map((t) => (t.teamId === teamId ? { ...t, cash: r2((t.cash ?? 0) - kosten) } : t)),
  };
  gs = schreibe(gs, teamId, {
    ...plan,
    treueGebucht: r2(plan.treueGebucht + kosten),
    praemierteVerlaengerungen: [...plan.praemierteVerlaengerungen, kennung],
    protokoll: [...plan.protokoll, { zeit: new Date().toISOString(), art: "treue" as const, text: "Treueprämie bei Verlängerung", betrag: kosten }].slice(-12),
  });
  return hebeMoral(gs, new Set([playerId]), teamId, stufe.moral, "Treueprämie");
}

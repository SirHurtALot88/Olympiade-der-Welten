/**
 * SCHATTENTEST — AUFGABE 1: sigma und P aus echten Engine-Daten messen (read-only).
 *
 * Aufruf:
 *   npx tsx scripts/sponsor-shadow-measure.ts --db <pfad.sqlite> [--save-id <id>] [--json <out.json>]
 *
 * WAS HIER GEMESSEN WIRD UND WAS NICHT — bitte vor dem Lesen der Zahlen zur Kenntnis nehmen:
 *
 *  sigma  ist eine Eigenschaft der Engine und wird direkt gemessen:
 *         sd(Endrang − Erwartungsrang) ueber alle Team-Saisons, gepoolt und je Staerkedrittel.
 *         Der Erwartungsrang ist die Liga-Position aus `buildLeagueTeamQualityRanks`, gefuettert
 *         mit AUSSCHLIESSLICH Vor-Saison-Information (siehe scripts/sponsor-shadow-data.ts).
 *
 *  P      ist fuer 5 der 20 Klauseln eine Eigenschaft der Engine (die Klausel hat keine freie
 *         Schwelle: "kein neuer Kredit", "alle Versprechen eingehalten", "Stufe erhoeht" usw.).
 *         Fuer die uebrigen 15 ist P KEINE Messgroesse, sondern eine FOLGE der Schwelle X — und
 *         der Katalog in scripts/sponsor-model-proposal.ts laesst X ueberall offen ("Schnitt >= X").
 *         Was sich messen laesst und hier gemessen wird, ist die VERTEILUNG der zugrundeliegenden
 *         Metrik je Staerkeklasse und daraus die Frage, die wirklich zaehlt:
 *           Gibt es ueberhaupt eine Schwelle, die das Design-P (+-0.15) trifft?
 *         Wenn die Metrik zu grob oder entartet ist (alle Teams gleich, nur Werte 0/1), ist die
 *         Antwort nein — und DAS ist ein Befund gegen das Modell, kein Messproblem.
 *
 *  NICHT MESSBAR sind zwei Klauseln; sie werden als solche ausgewiesen statt geraten:
 *   - "Charakterarbeit" (X negative Traits entfernen): `traitsNegative` wird im laufenden Spiel nie
 *     mutiert, der Hebel ist ausschliesslich der Transfermarkt — und ein Kader-Stand zum
 *     SAISONANFANG existiert im Save nicht. Ohne Startliste kein Delta.
 *   - "Kapitaenstreue" (derselbe Kapitaen ueber die Saison): `setTeamCaptain` ERSETZT den Eintrag
 *     (lib/morale/team-captain-service.ts), es bleibt genau ein Record je (Team, Saison). Ein
 *     Wechsel hinterlaesst keine Spur.
 *
 *  BEGRENZTE HISTORIE: Spielerzustand (Trainingsmodus, Moral, Subklassen, Trainingsklasse,
 *  Disziplin-Deltas) wird jede Preseason zurueckgesetzt. Diese Klauseln sind nur fuer die im Save
 *  LAUFENDE Saison auswertbar (N = 32 statt N = 32 x Saisons). Die Spaltenangabe "N" im Bericht
 *  sagt fuer jede Klausel, auf wie vielen Beobachtungen sie steht.
 */
import fs from "node:fs";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerAverageMatchdayFatigueBySeason } from "@/lib/foundation/player-season-fatigue-stats";
import { openSave, buildSeasonObservations, validateReconstruction, completedSnapshots, type SeasonTeamObservation } from "./sponsor-shadow-data";
import { SHADOW_CLAUSES, sd, mean, median, quantile, DESIGN_SIGMA } from "./sponsor-shadow-core";

const args = process.argv.slice(2);
const argOf = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
  ?? (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);

const DB_PATH = argOf("db");
const SAVE_ID = argOf("save-id");
const JSON_OUT = argOf("json");

// ── Klausel-Metriken ───────────────────────────────────────────────────────────────────────────
/**
 * `scope` sagt, ueber wie viele Saisons die Metrik rekonstruierbar ist:
 *   "ledger"  — saison-getaggter Ledger oder Snapshot, alle abgeschlossenen Saisons
 *   "current" — nur der im Save laufende Zustand, also eine Saison
 *   "none"    — nicht rekonstruierbar (Begruendung im Feld `note`)
 * `direction` sagt, ob "erfuellt" heisst: Metrik >= Schwelle (`up`) oder <= Schwelle (`down`).
 * `freeThreshold` = false heisst: die Klausel hat gar keine freie Schwelle, P ist direkt messbar.
 */
export type ClauseMetric = {
  clause: string;
  scope: "ledger" | "current" | "none";
  direction: "up" | "down";
  freeThreshold: boolean;
  /** Bei freeThreshold=false: das feste Praedikat. */
  fixedThreshold?: number;
  unit: string;
  note?: string;
  /** null = fuer diese Team-Saison nicht auswertbar. */
  metric?: (ctx: MetricContext) => number | null;
};

export type MetricContext = {
  gameState: GameState;
  teamId: string;
  seasonId: string;
  /** true, wenn `seasonId` die im Save laufende Saison ist. */
  isCurrent: boolean;
  obs: SeasonTeamObservation | null;
  prevObs: SeasonTeamObservation | null;
  rosterPlayerIds: Set<string>;
  fatigueBySeason: Map<string, number[]>;
};

export const teamRosterIds = (gs: GameState, teamId: string) =>
  new Set(gs.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId));

export const CLAUSE_METRICS: ClauseMetric[] = [
  {
    clause: "Einsatzlast", scope: "ledger", direction: "up", freeThreshold: true, unit: "Fatigue-Schnitt",
    note: "Saison-Fatigue-Schnitt des Kaders, rekonstruiert aus injuryEvents (fatigueBefore) je Saison.",
    metric: (c) => {
      const vals = c.fatigueBySeason.get(`${c.teamId}:${c.seasonId}`);
      return vals && vals.length > 0 ? mean(vals) : null;
    },
  },
  {
    clause: "Schonung", scope: "ledger", direction: "down", freeThreshold: true, unit: "Fatigue-Schnitt",
    note: "Gegenrichtung derselben Metrik wie Einsatzlast.",
    metric: (c) => {
      const vals = c.fatigueBySeason.get(`${c.teamId}:${c.seasonId}`);
      return vals && vals.length > 0 ? mean(vals) : null;
    },
  },
  {
    clause: "Hartes Training", scope: "current", direction: "up", freeThreshold: true, unit: "% Spieltage 'hart'",
    note: "seasonTrainingAccumulator.modeByMatchday — wird jede Preseason auf null gesetzt.",
    metric: (c) => {
      if (!c.isCurrent) return null;
      let hard = 0, total = 0;
      for (const p of c.gameState.players) {
        if (!c.rosterPlayerIds.has(p.id)) continue;
        const acc = p.seasonTrainingAccumulator;
        if (!acc || acc.seasonId !== c.seasonId) continue;
        for (const mode of Object.values(acc.modeByMatchday ?? {})) {
          total += 1;
          if (mode === "hart") hard += 1;
        }
      }
      return total === 0 ? null : (100 * hard) / total;
    },
  },
  {
    clause: "Talentschmiede", scope: "ledger", direction: "up", freeThreshold: true, unit: "Aufstiege",
    note: "classHistory-Eintraege mit dieser seasonId; nur `organic_progression`/`manual` zaehlen.",
    metric: (c) => {
      let n = 0;
      for (const p of c.gameState.players) {
        if (!c.rosterPlayerIds.has(p.id)) continue;
        n += (p.classHistory ?? []).filter((e) => e.seasonId === c.seasonId && e.reason !== "seed").length;
      }
      return n;
    },
  },
  {
    clause: "Wertaufbau", scope: "ledger", direction: "up", freeThreshold: true, unit: "% Kaderwert",
    note: "Marktwertsumme Saisonende gegen Vorsaisonende; Saison 1 hat keinen Vorwert.",
    metric: (c) => {
      const now = c.obs?.marketValueEnd ?? null;
      const before = c.prevObs?.marketValueEnd ?? null;
      if (now == null || before == null || before <= 0) return null;
      return (100 * (now - before)) / before;
    },
  },
  {
    clause: "Achsenprofil", scope: "ledger", direction: "down", freeThreshold: true, unit: "bester Achsenrang",
    note: "Bester der vier Achsenraenge (POW/SPE/MEN/SOC) aus disciplinePointsByArea des Snapshots.",
  },
  {
    clause: "Disziplinen", scope: "current", direction: "up", freeThreshold: true, unit: "Disziplinen mit Delta>0",
    note: "currentDisciplineValues gegen previousDisciplineRatings — an der Saisongrenze ueberschrieben.",
    metric: (c) => {
      if (!c.isCurrent) return null;
      const delta = new Map<string, number>();
      let any = false;
      for (const p of c.gameState.players) {
        if (!c.rosterPlayerIds.has(p.id)) continue;
        const now = p.currentDisciplineValues ?? p.disciplineRatings ?? {};
        const before = p.previousDisciplineRatings ?? {};
        for (const [id, v] of Object.entries(now)) {
          const b = before[id];
          if (typeof b !== "number") continue;
          any = true;
          delta.set(id, (delta.get(id) ?? 0) + (v - b));
        }
      }
      if (!any) return null;
      return [...delta.values()].filter((v) => v > 0).length;
    },
  },
  {
    clause: "Schuldenfrei", scope: "ledger", direction: "down", freeThreshold: false, fixedThreshold: 0,
    unit: "neue Kredite",
    note: "Neue Kredite dieser Saison. Quelle: loanOriginationLogs UND loans[].originatedSeasonId — "
      + "der Origination-Ledger ist in aelteren Saves leer, die Kredite selbst stehen aber im State; "
      + "wer nur den Ledger liest, misst faelschlich P = 1.00.",
    metric: (c) => {
      const fromLedger = (c.gameState.seasonState.loanOriginationLogs ?? [])
        .filter((l) => l.seasonId === c.seasonId && l.borrowerTeamId === c.teamId).length;
      const fromLoans = (c.gameState.seasonState.loans ?? [])
        .filter((l) => l.originatedSeasonId === c.seasonId && l.borrowerTeamId === c.teamId).length;
      return Math.max(fromLedger, fromLoans);
    },
  },
  {
    clause: "Gehaltseffizienz", scope: "ledger", direction: "down", freeThreshold: true, unit: "Gehaltssumme C",
    note: "salaryTotalEnd/salaryEnd aus dem Snapshot; Schwelle laut Katalog klassenrelativ.",
    metric: (c) => c.obs?.salaryEnd ?? null,
  },
  {
    clause: "Kaderruhe", scope: "ledger", direction: "down", freeThreshold: true, unit: "Transfers",
    note: "transferCount aus dem Snapshot (Zu- und Abgaenge).",
    metric: (c) => c.obs?.transferCount ?? null,
  },
  {
    clause: "Ausbau", scope: "ledger", direction: "up", freeThreshold: true,
    unit: "Gebaeude-Stufenaufstiege (alle Gebaeude)",
    note: "facilityEvents dieser Saison mit nextLevel > previousLevel, ueber ALLE Gebaeude. "
      + "ENTSCHEIDUNG nach dem Engine-Test: die alte Fassung zaehlte nur fan_shop/arena_upgrade und "
      + "mass P = 0.11 gegen Design 0.45 — von 148 echten Upgrades im Lauf lagen nur 17 auf diesen "
      + "beiden Gebaeuden. Die Klausel war nicht zu schwer, sie zeigte auf die falschen Gebaeude. "
      + "Jetzt zaehlt jeder Ausbau und die Schwelle X ist frei — damit ist der Hebel derselbe "
      + "(Bauinvestition statt Spieler), das Praedikat aber an dem verankert, was im Spiel passiert.",
    metric: (c) => {
      const events = (c.gameState.seasonState as unknown as { facilityEvents?: Array<Record<string, unknown>> }).facilityEvents ?? [];
      return events.filter((e) => e["seasonId"] === c.seasonId && e["teamId"] === c.teamId
        && Number(e["nextLevel"] ?? 0) > Number(e["previousLevel"] ?? 0)).length;
    },
  },
  {
    clause: "Prophylaxe", scope: "ledger", direction: "down", freeThreshold: true, unit: "Verletzungen",
    note: "injuryEvents mit result='injured' dieser Saison (healthy-Rolls stehen ebenfalls im Ledger).",
    metric: (c) => {
      const events = (c.gameState.seasonState as unknown as { injuryEvents?: Array<Record<string, unknown>> }).injuryEvents ?? [];
      return events.filter((e) => e["seasonId"] === c.seasonId && e["teamId"] === c.teamId && e["result"] === "injured").length;
    },
  },
  {
    clause: "Moral", scope: "current", direction: "up", freeThreshold: true, unit: "OE-Moral",
    note: "playerMoraleState — nur der Momentanwert, keine Saison-Historie.",
    metric: (c) => {
      if (!c.isCurrent) return null;
      const states = (c.gameState as unknown as { playerMoraleState?: Array<{ teamId: string; morale: number }> }).playerMoraleState ?? [];
      const vals = states.filter((s) => s.teamId === c.teamId).map((s) => s.morale).filter((v) => Number.isFinite(v));
      return vals.length ? mean(vals) : null;
    },
  },
  {
    clause: "Beliebtheit", scope: "ledger", direction: "up", freeThreshold: true, unit: "Beliebtheits-Delta",
    note: "beliebtheitHistoryByTeamId — Differenz benachbarter Punkte; braucht mindestens zwei Punkte.",
  },
  {
    clause: "XP-Disziplin", scope: "ledger", direction: "up", freeThreshold: true, unit: "% investierte XP",
    note: "playerProgressionEvents dieser Saison: Summe xpSpent / Summe xpEarned.",
    metric: (c) => {
      const events = (c.gameState as unknown as { playerProgressionEvents?: Array<Record<string, unknown>> }).playerProgressionEvents ?? [];
      let earned = 0, spent = 0;
      for (const e of events) {
        if (e["seasonId"] !== c.seasonId || e["teamId"] !== c.teamId) continue;
        earned += Number(e["xpEarned"] ?? 0);
        spent += Number(e["xpSpent"] ?? 0);
      }
      return earned > 0 ? (100 * spent) / earned : null;
    },
  },
  {
    clause: "Charakterarbeit", scope: "none", direction: "up", freeThreshold: true, unit: "entfernte negative Traits",
    note: "NICHT MESSBAR: traitsNegative wird im Spiel nie mutiert und es gibt keinen Kaderstand zum Saisonanfang.",
  },
  {
    clause: "Vielseitigkeit", scope: "current", direction: "up", freeThreshold: true, unit: "verschiedene Subklassen",
    metric: (c) => {
      if (!c.isCurrent) return null;
      const s = new Set<string>();
      for (const p of c.gameState.players) if (c.rosterPlayerIds.has(p.id)) for (const sub of p.subclasses ?? []) s.add(sub);
      return s.size;
    },
  },
  {
    clause: "Fokusschule", scope: "current", direction: "up", freeThreshold: true, unit: "groesste Trainingsklassen-Gruppe",
    metric: (c) => {
      if (!c.isCurrent) return null;
      const counts = new Map<string, number>();
      let n = 0;
      for (const p of c.gameState.players) {
        if (!c.rosterPlayerIds.has(p.id)) continue;
        const cls = p.trainingClass ?? p.className;
        if (!cls) continue;
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
        n += 1;
      }
      return n === 0 ? null : Math.max(...counts.values());
    },
  },
  {
    clause: "Kapitaenstreue", scope: "none", direction: "up", freeThreshold: false, fixedThreshold: 1, unit: "—",
    note: "NICHT MESSBAR: setTeamCaptain ersetzt den (Team, Saison)-Record; ein Wechsel hinterlaesst keine Spur.",
  },
  {
    clause: "Wortlaut", scope: "ledger", direction: "down", freeThreshold: true,
    unit: "gebrochene Versprechen",
    note: "playerRelationshipEvents mit reason 'promised_role_broken' dieser Saison. "
      + "ENTSCHEIDUNG nach dem Engine-Test: die feste Schwelle 0 ('alle Versprechen eingehalten') "
      + "wurde in 160 Team-Saisons NIE erreicht (min 3, Median 8, max 11) — sie waere ein "
      + "garantierter Malus von s*P = 22*0.45 = 9.9 C gewesen, den kein Spieler abwenden kann. "
      + "Jetzt 'hoechstens X gebrochene Versprechen' mit freier Schwelle.",
    metric: (c) => {
      const events = (c.gameState as unknown as { playerRelationshipEvents?: Array<Record<string, unknown>> }).playerRelationshipEvents ?? [];
      return events.filter((e) => e["seasonId"] === c.seasonId && e["teamId"] === c.teamId
        && String(e["reason"] ?? "").startsWith("promised_role_broken")).length;
    },
  },
];

// ── Achsen- und Beliebtheits-Metriken brauchen Liga-Kontext, daher separat ─────────────────────
export function axisRankByTeamSeason(gameState: GameState): Map<string, number> {
  const out = new Map<string, number>();
  for (const snap of completedSnapshots(gameState)) {
    const axes = ["pow", "spe", "men", "soc"] as const;
    const rankByAxis = new Map<string, Map<string, number>>();
    for (const axis of axes) {
      const vals = snap.finalStandings
        .map((r) => ({ teamId: r.teamId, v: r.disciplinePointsByArea?.[axis] ?? null }))
        .filter((e): e is { teamId: string; v: number } => typeof e.v === "number");
      vals.sort((a, b) => b.v - a.v);
      const m = new Map<string, number>();
      vals.forEach((e, i) => m.set(e.teamId, i + 1));
      rankByAxis.set(axis, m);
    }
    for (const row of snap.finalStandings) {
      const ranks = axes.map((a) => rankByAxis.get(a)?.get(row.teamId)).filter((v): v is number => v != null);
      if (ranks.length > 0) out.set(`${row.teamId}:${snap.seasonId}`, Math.min(...ranks));
    }
  }
  return out;
}

export function beliebtheitDeltaByTeamSeason(gameState: GameState, seasonIds: string[]): Map<string, number> {
  const hist = gameState.seasonState.beliebtheitHistoryByTeamId ?? {};
  const out = new Map<string, number>();
  for (const [teamId, series] of Object.entries(hist)) {
    if (!Array.isArray(series)) continue;
    // Die Reihe ist aelteste-zuerst und wird bei der Saisontransition fortgeschrieben. Sie wird
    // rechtsbuendig an die Saisonliste gelegt: der letzte Punkt gehoert zur letzten abgeschlossenen
    // Saisontransition.
    const offset = seasonIds.length - series.length;
    for (let i = 1; i < series.length; i += 1) {
      const seasonIdx = offset + i;
      if (seasonIdx < 0 || seasonIdx >= seasonIds.length) continue;
      out.set(`${teamId}:${seasonIds[seasonIdx]}`, series[i]! - series[i - 1]!);
    }
  }
  return out;
}

// ── Auswertung ─────────────────────────────────────────────────────────────────────────────────
const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const line = (c = "=") => console.log(c.repeat(104));

export function strengthClassOf(expectedRank: number): 0 | 1 | 2 {
  if (expectedRank <= 11) return 0;
  if (expectedRank <= 21) return 1;
  return 2;
}
const CLASS_LABEL = ["stark (E 1-11)", "mittel (E 12-21)", "schwach (E 22-32)"];

function main() {
  const { gameState, saveId } = openSave({ sqlitePath: DB_PATH, saveId: SAVE_ID });
  const obs = buildSeasonObservations(gameState);
  const snaps = completedSnapshots(gameState);
  const seasonIds = snaps.map((s) => s.seasonId);
  const currentSeasonId = gameState.season.id;

  line();
  console.log("SCHATTENTEST · AUFGABE 1 — sigma und P aus der echten Engine");
  line();
  console.log(`Save ${saveId} · ${gameState.teams.length} Teams · abgeschlossene Saisons: ${seasonIds.join(", ") || "(keine)"}`);
  console.log(`Laufende Saison im Save: ${currentSeasonId}`);
  console.log(`Team-Saison-Beobachtungen: ${obs.length}`);

  if (obs.length === 0) {
    console.log("\nABBRUCH: keine abgeschlossene Saison im Save — sigma nicht messbar.");
    return;
  }

  // ── sigma ────────────────────────────────────────────────────────────────────────────────────
  line("-");
  console.log("SIGMA — sd(Endrang minus Erwartungsrang)");
  line("-");
  const devAll = obs.map((o) => o.finalRank - o.expectedRank);
  const sigmaAll = sd(devAll);
  console.log(`  gepoolt          N=${devAll.length}  sigma=${fmt(sigmaAll)}  Bias(Mittel)=${fmt(mean(devAll))}` +
    `  Median=${fmt(median(devAll))}  IQR=[${fmt(quantile(devAll, 0.25))}, ${fmt(quantile(devAll, 0.75))}]` +
    `  Spanne=[${fmt(Math.min(...devAll), 0)}, ${fmt(Math.max(...devAll), 0)}]`);

  console.log("\n  je Staerkedrittel (nach Erwartungsrang):");
  const sigmaByClass: number[] = [];
  for (let k = 0; k < 3; k += 1) {
    const sub = obs.filter((o) => strengthClassOf(o.expectedRank) === k).map((o) => o.finalRank - o.expectedRank);
    sigmaByClass.push(sd(sub));
    console.log(`    ${CLASS_LABEL[k]!.padEnd(20)} N=${String(sub.length).padStart(4)}  sigma=${fmt(sd(sub))}  Bias=${fmt(mean(sub))}` +
      `  Spanne=[${fmt(Math.min(...sub), 0)}, ${fmt(Math.max(...sub), 0)}]`);
  }

  console.log("\n  je Saison:");
  for (const sid of seasonIds) {
    const sub = obs.filter((o) => o.seasonId === sid).map((o) => o.finalRank - o.expectedRank);
    if (sub.length === 0) continue;
    console.log(`    ${sid.padEnd(14)} N=${String(sub.length).padStart(3)}  sigma=${fmt(sd(sub))}  Bias=${fmt(mean(sub))}`);
  }

  // ── RUECKSCHRITT ZUR MITTE ────────────────────────────────────────────────────────────────────
  /**
   * Gemessen und im Modell bisher NICHT abgebildet: die Verteilung der Endraenge ist nicht um den
   * Erwartungsrang zentriert. `dist()` setzt eine um `expected` zentrierte Normalverteilung an —
   * fuer ein Spitzenteam systematisch zu optimistisch, fuer ein Kellerteam zu pessimistisch.
   *
   * Modellform (eine Zahl statt drei Klassen-Bias, damit sie stetig ueber die Raenge wirkt):
   *     E[Endrang | Erwartung e] = m + (1 - shrink) * (e - m),   m = (1 + 32) / 2 = 16.5
   * Der Bias ist dann `-shrink * (e - m)`: bei e < m positiv (schlechter als erwartet), bei e > m
   * negativ (besser). Genau die gemessene Richtung.
   *
   * shrink per Kleinstquadraten aus (e - m) -> (Endrang - e). Ein Achsenabschnitt ist nicht noetig:
   * Erwartungs- und Endraenge sind beide Permutationen von 1..32, ihr Mittel ist identisch 16.5,
   * also ist mean(Endrang - e) exakt 0 und die Regression laeuft per Konstruktion durch den
   * Ursprung der zentrierten Achse.
   */
  const RANK_MEAN_MEASURED = 16.5;
  const sxx = obs.reduce((a, o) => a + (o.expectedRank - RANK_MEAN_MEASURED) ** 2, 0);
  const sxy = obs.reduce((a, o) => a + (o.expectedRank - RANK_MEAN_MEASURED) * (o.finalRank - o.expectedRank), 0);
  const shrink = sxx > 0 ? -sxy / sxx : 0;
  /** Anteil der Rangvarianz, den die Schrumpfung erklaert — sagt, ob die eine Zahl reicht. */
  const ssTot = obs.reduce((a, o) => a + (o.finalRank - o.expectedRank) ** 2, 0);
  const ssRes = obs.reduce((a, o) => a + ((o.finalRank - o.expectedRank) + shrink * (o.expectedRank - RANK_MEAN_MEASURED)) ** 2, 0);
  console.log("\n  RUECKSCHRITT ZUR MITTE (im Modell bisher nicht abgebildet):");
  console.log(`    Schrumpfung shrink = ${fmt(shrink, 3)}  →  Mittelpunkt der Verteilung = 16.5 + ${fmt(1 - shrink, 3)} x (Erwartung − 16.5)`);
  console.log(`    Restsigma nach Abzug des Bias: ${fmt(Math.sqrt(ssRes / Math.max(1, obs.length - 1)))} (roh ${fmt(sigmaAll)}), erklaerter Varianzanteil ${fmt(100 * (1 - ssRes / ssTot), 1)} %`);
  for (let k = 0; k < 3; k += 1) {
    const sub = obs.filter((o) => strengthClassOf(o.expectedRank) === k);
    if (sub.length === 0) continue;
    const predicted = mean(sub.map((o) => -shrink * (o.expectedRank - RANK_MEAN_MEASURED)));
    const actual = mean(sub.map((o) => o.finalRank - o.expectedRank));
    console.log(`      ${CLASS_LABEL[k]!.padEnd(20)} Bias gemessen ${fmt(actual)}  ·  Modell mit shrink ${fmt(predicted)}`);
  }

  const recon = validateReconstruction(gameState, obs);
  if (recon.length > 0) {
    const gaps = recon.map((r) => Math.abs(r.engineQualityRank - r.reconstructedPosition));
    console.log(`\n  Kontrolle der Rekonstruktion (${recon.length} Vertraege der Saison ${recon[0]!.seasonId}):` +
      ` Median |Engine-qualityRank − rekonstruierte Position| = ${fmt(median(gaps))}, max ${fmt(Math.max(...gaps))}`);
    console.log("  (Der Engine-Wert ist ein gewichteter GEBROCHENER Rang, die Rekonstruktion eine Liga-POSITION —");
    console.log("   eine kleine systematische Differenz ist erwartet, eine grosse waere ein Rekonstruktionsfehler.)");
  } else {
    console.log("\n  Kontrolle der Rekonstruktion: kein Vertrag mit teamQualityRankAtSign im Save — nicht pruefbar.");
  }
  console.log(`\n  DESIGN-sigma des Modells: ${DESIGN_SIGMA}. Abbruchkorridor laut Auftrag: [3.5, 7].`);

  // ── P ────────────────────────────────────────────────────────────────────────────────────────
  line("-");
  console.log("P JE KLAUSEL — Verteilung der zugrundeliegenden Metrik und erreichbares P");
  line("-");

  const fatigueBySeason = new Map<string, number[]>();
  for (const team of gameState.teams) {
    const ids = teamRosterIds(gameState, team.teamId);
    for (const pid of ids) {
      const perSeason = buildPlayerAverageMatchdayFatigueBySeason(gameState, pid);
      for (const [sid, value] of perSeason.entries()) {
        const key = `${team.teamId}:${sid}`;
        const list = fatigueBySeason.get(key) ?? [];
        list.push(value);
        fatigueBySeason.set(key, list);
      }
    }
  }
  const axisRanks = axisRankByTeamSeason(gameState);
  const beliebtheitDeltas = beliebtheitDeltaByTeamSeason(gameState, seasonIds);

  // Auswertungsraum: alle abgeschlossenen Team-Saisons PLUS die laufende Saison (fuer "current").
  type Cell = { teamId: string; seasonId: string; isCurrent: boolean; expectedRank: number; obs: SeasonTeamObservation | null; prevObs: SeasonTeamObservation | null };
  const cells: Cell[] = [];
  for (const o of obs) {
    cells.push({
      teamId: o.teamId, seasonId: o.seasonId, isCurrent: o.seasonId === currentSeasonId,
      expectedRank: o.expectedRank, obs: o,
      prevObs: obs.find((x) => x.teamId === o.teamId && x.seasonIndex === o.seasonIndex - 1) ?? null,
    });
  }
  if (!seasonIds.includes(currentSeasonId)) {
    // Die laufende Saison ist noch nicht abgeschlossen — fuer "current"-Klauseln trotzdem auswertbar.
    const lastExpected = new Map(obs.filter((o) => o.seasonIndex === snaps.length).map((o) => [o.teamId, o.finalRank] as const));
    for (const team of gameState.teams) {
      cells.push({
        teamId: team.teamId, seasonId: currentSeasonId, isCurrent: true,
        expectedRank: lastExpected.get(team.teamId) ?? 16, obs: null, prevObs: null,
      });
    }
  }

  const results: Array<Record<string, unknown>> = [];

  for (const design of SHADOW_CLAUSES) {
    const spec = CLAUSE_METRICS.find((m) => m.clause === design.name)
      ?? CLAUSE_METRICS.find((m) => m.clause.replace("ae", "ä") === design.name)
      ?? CLAUSE_METRICS.find((m) => design.name.startsWith(m.clause.slice(0, 6)));
    console.log(`\n  ${design.name}  (Design-P ${design.p.toFixed(2)}, Spannweite ${design.s})`);
    if (!spec || spec.scope === "none") {
      console.log(`    NICHT MESSBAR — ${spec?.note ?? "keine Metrik hinterlegt"}`);
      results.push({ clause: design.name, designP: design.p, measurable: false, note: spec?.note ?? null });
      continue;
    }
    const values: Array<{ v: number; cls: 0 | 1 | 2 }> = [];
    for (const cell of cells) {
      let v: number | null = null;
      if (design.name === "Achsenprofil") {
        v = axisRanks.get(`${cell.teamId}:${cell.seasonId}`) ?? null;
      } else if (design.name === "Beliebtheit") {
        v = beliebtheitDeltas.get(`${cell.teamId}:${cell.seasonId}`) ?? null;
      } else if (spec.metric) {
        v = spec.metric({
          gameState, teamId: cell.teamId, seasonId: cell.seasonId, isCurrent: cell.isCurrent,
          obs: cell.obs, prevObs: cell.prevObs,
          rosterPlayerIds: teamRosterIds(gameState, cell.teamId), fatigueBySeason,
        });
      }
      if (v == null || !Number.isFinite(v)) continue;
      values.push({ v, cls: strengthClassOf(cell.expectedRank) });
    }
    if (values.length === 0) {
      console.log(`    KEINE DATEN — ${spec.note ?? ""}`);
      results.push({ clause: design.name, designP: design.p, measurable: false, note: `keine Daten: ${spec.note ?? ""}` });
      continue;
    }

    const all = values.map((x) => x.v);
    const uniq = new Set(all).size;
    console.log(`    Metrik: ${spec.unit}  ·  Reichweite: ${spec.scope === "current" ? "nur laufende Saison" : "alle Saisons"}  ·  N=${all.length}  ·  verschiedene Werte: ${uniq}`);
    console.log(`    Verteilung je Staerkeklasse (min / P10 / Median / P90 / max):`);
    for (let k = 0; k < 3; k += 1) {
      const sub = values.filter((x) => x.cls === k).map((x) => x.v);
      if (sub.length === 0) { console.log(`      ${CLASS_LABEL[k]!.padEnd(20)} —`); continue; }
      console.log(`      ${CLASS_LABEL[k]!.padEnd(20)} N=${String(sub.length).padStart(4)}  ` +
        `${fmt(Math.min(...sub))} / ${fmt(quantile(sub, 0.1))} / ${fmt(median(sub))} / ${fmt(quantile(sub, 0.9))} / ${fmt(Math.max(...sub))}`);
    }

    const share = (t: number) => spec.direction === "up"
      ? all.filter((v) => v >= t).length / all.length
      : all.filter((v) => v <= t).length / all.length;

    if (!spec.freeThreshold) {
      const p = share(spec.fixedThreshold!);
      const gap = Math.abs(p - design.p);
      console.log(`    P DIREKT GEMESSEN (feste Schwelle ${spec.direction === "up" ? ">=" : "<="} ${spec.fixedThreshold}): P=${fmt(p)}` +
        `  · Design-P ${design.p.toFixed(2)}  · Abstand ${fmt(gap)}  ${gap > 0.15 ? "→ REISST (>0.15)" : "→ im Rahmen"}`);
      results.push({ clause: design.name, designP: design.p, measurable: true, kind: "direkt", n: all.length, p, gap });
      continue;
    }

    // Freie Schwelle: welches P ist ueberhaupt erreichbar?
    const candidates = [...new Set(all)].sort((a, b) => a - b);
    let best = { t: Number.NaN, p: Number.NaN, gap: Number.POSITIVE_INFINITY };
    for (const t of candidates) {
      const p = share(t);
      const gap = Math.abs(p - design.p);
      if (gap < best.gap) best = { t, p, gap };
    }
    const reachable = best.gap <= 0.15;
    console.log(`    P IST KEINE MESSGROESSE (Schwelle X im Katalog offen). Bestes erreichbares P: ${fmt(best.p)} bei Schwelle ` +
      `${spec.direction === "up" ? ">=" : "<="} ${fmt(best.t)}  · Design-P ${design.p.toFixed(2)}  · Abstand ${fmt(best.gap)}  ` +
      `${reachable ? "→ Schwelle existiert" : "→ KEINE Schwelle trifft das Design-P (Metrik zu grob/entartet)"}`);
    results.push({
      clause: design.name, designP: design.p, measurable: true, kind: "schwellenabhaengig",
      n: all.length, distinctValues: uniq, bestP: best.p, bestThreshold: best.t, gap: best.gap, reachable,
    });
  }

  // ── Zusammenfassung ──────────────────────────────────────────────────────────────────────────
  line();
  console.log("ZUSAMMENFASSUNG AUFGABE 1");
  line();
  console.log(`  sigma gepoolt: ${fmt(sigmaAll)}  (Design ${DESIGN_SIGMA}, Korridor [3.5, 7])` +
    `  → ${sigmaAll >= 3.5 && sigmaAll <= 7 ? "im Korridor" : "AUSSERHALB"}`);
  console.log(`  sigma je Drittel: ${sigmaByClass.map((v, i) => `${CLASS_LABEL[i]!.split(" ")[0]} ${fmt(v)}`).join("  ·  ")}`);
  const direct = results.filter((r) => r["kind"] === "direkt");
  const thresholded = results.filter((r) => r["kind"] === "schwellenabhaengig");
  const notMeasurable = results.filter((r) => r["measurable"] === false);
  const directBreach = direct.filter((r) => Number(r["gap"]) > 0.15);
  const unreachable = thresholded.filter((r) => r["reachable"] === false);
  console.log(`  Klauseln mit direkt messbarem P: ${direct.length} — davon mehr als 0.15 neben dem Design-P: ${directBreach.length}` +
    (directBreach.length ? ` (${directBreach.map((r) => r["clause"]).join(", ")})` : ""));
  console.log(`  Klauseln mit freier Schwelle: ${thresholded.length} — davon OHNE erreichbares Design-P: ${unreachable.length}` +
    (unreachable.length ? ` (${unreachable.map((r) => r["clause"]).join(", ")})` : ""));
  console.log(`  Nicht messbar: ${notMeasurable.length} (${notMeasurable.map((r) => r["clause"]).join(", ")})`);

  // ── Diagnose: warum eine Klausel "keine Daten" hat ───────────────────────────────────────────
  line("-");
  console.log("DIAGNOSE DER LEEREN LEDGER — damit 'keine Daten' nicht mit 'nie erfuellt' verwechselt wird");
  line("-");
  const ss = gameState.seasonState as unknown as Record<string, unknown>;
  const gsAny = gameState as unknown as Record<string, unknown>;
  const facilityEvents = (ss["facilityEvents"] as Array<Record<string, unknown>> | undefined) ?? [];
  const upgrades = facilityEvents.filter((e) => Number(e["nextLevel"] ?? 0) > Number(e["previousLevel"] ?? 0));
  const fanArena = upgrades.filter((e) => e["facilityId"] === "fan_shop" || e["facilityId"] === "arena_upgrade");
  console.log(`  facilityEvents: ${facilityEvents.length} · davon echte Upgrades: ${upgrades.length} · davon fan_shop/arena_upgrade: ${fanArena.length}`);
  console.log(`    → die Klausel 'Ausbau' ist auf genau diese beiden Gebaeude beschraenkt; die KI baut ueberwiegend andere.`);
  const progression = (gsAny["playerProgressionEvents"] as Array<Record<string, unknown>> | undefined) ?? [];
  const earnedTotal = progression.reduce((a, e) => a + Number(e["xpEarned"] ?? 0), 0);
  const spentTotal = progression.reduce((a, e) => a + Number(e["xpSpent"] ?? 0), 0);
  console.log(`  playerProgressionEvents: ${progression.length} · Summe xpEarned = ${fmt(earnedTotal, 1)} · Summe xpSpent = ${fmt(spentTotal, 1)}`);
  if (earnedTotal === 0) console.log("    → XP-Oekonomie in diesem Lauf ungenutzt (nur organische Progression, 0 verdiente XP). 'XP-Disziplin' hat keinen Nenner.");
  console.log(`  beliebtheitByTeamId: ${Object.keys((ss["beliebtheitByTeamId"] as object) ?? {}).length} Eintraege · `
    + `beliebtheitHistoryByTeamId: ${Object.keys((ss["beliebtheitHistoryByTeamId"] as object) ?? {}).length} Eintraege`);
  console.log(`  teamCaptains: ${((gsAny["teamCaptains"] as unknown[]) ?? []).length} Eintraege`);
  const accPlayers = gameState.players.filter((p) => p.seasonTrainingAccumulator != null).length;
  console.log(`  Spieler mit seasonTrainingAccumulator: ${accPlayers}`);
  const loans = (ss["loans"] as Array<Record<string, unknown>> | undefined) ?? [];
  console.log(`  loans: ${loans.length} · loanOriginationLogs: ${((ss["loanOriginationLogs"] as unknown[]) ?? []).length}`);
  const offers = (ss["sponsorOffersByTeamId"] as Record<string, unknown[]> | undefined) ?? {};
  const offerCounts = Object.values(offers).map((o) => o.length);
  console.log(`  Angebote je Team im Save: ${offerCounts.length ? `${Math.min(...offerCounts)}-${Math.max(...offerCounts)}` : "—"} (aktueller Code erzeugt 5)`);

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, `${JSON.stringify({
      saveId, seasonIds, currentSeasonId, nObservations: obs.length,
      sigma: {
        pooled: sigmaAll, byClass: sigmaByClass, bias: mean(devAll), design: DESIGN_SIGMA,
        /** Schrumpfung zur Tabellenmitte — der bisher nicht abgebildete systematische Anteil. */
        shrink, rankMean: RANK_MEAN_MEASURED,
        biasByClass: [0, 1, 2].map((k) => mean(obs.filter((o) => strengthClassOf(o.expectedRank) === k).map((o) => o.finalRank - o.expectedRank))),
      },
      clauses: results,
      observations: obs,
    }, null, 2)}\n`);
    console.log(`\n  JSON geschrieben: ${JSON_OUT}`);
  }
}

if (require.main === module) main();

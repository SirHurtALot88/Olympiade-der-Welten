/**
 * SCHATTENTEST — AUFGABE 2 und 3: Schattenbuchhaltung und die sechs Abbruchkriterien.
 *
 * Aufruf:
 *   npx tsx scripts/sponsor-shadow-ledger.ts --db <pfad.sqlite> [--save-id <id>]
 *                                            --measured <measure.json> [--json <out.json>]
 *
 * Das Skript aendert nichts. Es liest die realisierten Endstaende und Zustaende eines echten
 * Engine-Laufs und rechnet nach, was das neue Modell bei GENAU DIESEN Ausgaengen gezahlt haette.
 *
 * DIE ZWEI MESSFEHLER, DIE HIER BEHOBEN SIND:
 *
 *  1. K WAR NACHTRAEGLICH GELOEST. scripts/sponsor-5season-model.ts zieht erst die Endraenge und
 *     loest K dann so, dass die Summe stimmt — "Deckung 100 %" ist damit die Definition von K,
 *     keine Messung. Hier steht K VOR der Saison fest: geloest gegen den Erwartungswert unter der
 *     GEMESSENEN sigma-Verteilung und den GEMESSENEN P. Die realisierte Deckung darf danach
 *     abweichen, und genau diese Abweichung ist das Ergebnis.
 *
 *  2. FALLEN-TEST AUF IDENTISCHEN KARTEN. Der bisherige Test verglich einen kuratierten Katalog
 *     gegen sich selbst. Hier laufen die Karten gegeneinander, die aus einer TATSAECHLICH von
 *     `ensureSeasonSponsorOffers` erzeugten Angebotsliste abgeleitet sind — mit der Rarity- und
 *     Kurvenmischung, die die Engine dem jeweiligen Team wirklich vorlegt.
 *
 * OFFENGELEGTE MODELLANNAHME BEIM MAPPING ENGINE -> MODELL:
 *   Ein Engine-Angebot traegt Rarity, Kurvenform und Komponenten. Rarity wird 1:1 uebernommen,
 *   die Kurvenform ueber eine feste Tabelle auf die 6 Modellkurven abgebildet, und der
 *   Sonderziel-Anteil des Angebots (Summe der `special`-Komponenten / Summe aller Komponenten)
 *   waehlt das Verteilungsprofil mit dem naechstgelegenen `specialShare`.
 *   Die KLAUSEL-Achse des Modells hat in der Engine KEINE Entsprechung — die Engine kennt keine
 *   rangunabhaengige Zustandsklausel. Sie wird deshalb deterministisch aus der offerId gezogen.
 *   Das ist eine Annahme, keine Messung, und faerbt jedes Ergebnis, das an der Klausel haengt.
 */
import fs from "node:fs";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { getPrizeMoneyReference, getRankMilestoneBonus } from "@/lib/sponsor/sponsor-economy-calibration";
import { getPercentileTargetRarity } from "@/lib/sponsor/sponsor-team-quality-rank";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import { openSave, buildSeasonObservations, completedSnapshots, type SeasonTeamObservation } from "./sponsor-shadow-data";
import {
  SHADOW_CURVES, SHADOW_CLAUSES, curveByName, PROFILES,
  type ShadowCard, type CardParams, type ExAnteTeam,
  calibrateCard, rawPayout, scaleWithK, hitFloor,
  lotteriesOfCard, fosdAtLeast, fosdStrictly, isCollapsed,
  median, quantile, mean, DESIGN_SIGMA, DESIGN_P_GOAL,
} from "./sponsor-shadow-core";

const args = process.argv.slice(2);
const argOf = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
  ?? (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const DB_PATH = argOf("db");
const SAVE_ID = argOf("save-id");
const MEASURED = argOf("measured");
const JSON_OUT = argOf("json");
/**
 * Wiederholungen der MODELL-EIGENEN Lotterien (Klausel x Sonderziel) bei UNVERAENDERTEN,
 * realisierten Endraengen. Das ersetzt keine Seed-Streuung der Engine — die Endstaende bleiben
 * dieselben — aber es beziffert genau die Streuungsquelle, die Kriterium 2 und 6 treibt: die
 * Auszahlungslotterie des Entwurfs. Ohne das stuenden beide Kriterien auf einem einzigen Wurf.
 */
const DRAWS = Number(argOf("draws") ?? 1);

const DRAW_SALT = { value: 0 };
const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const line = (c = "=") => console.log(c.repeat(104));

/** Deterministischer Hash-RNG — reproduzierbar, ohne Math.random. */
function hashRnd(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

/**
 * Kurvenform der Engine -> Modellkurve. Feste, offengelegte Zuordnung; jede der 6 Modellkurven
 * wird von mindestens einer Engine-Form getroffen, damit der Fallen-Test nicht kuenstlich
 * homogene Angebotslisten sieht.
 */
const CURVE_MAP: Record<string, string> = {
  titeljaeger: "Gipfel", meisterschale: "Gipfel",
  koenigsklasse: "Steil", europapokal: "Steil",
  conference: "Linear", stetig: "Linear",
  mittelfeld: "Halten", aufsteiger: "Halten",
  konsolidierung: "Flach",
  sicherheit: "Sockel", klassenerhalt: "Sockel",
};

/** Sonderziel-Anteil eines echten Angebots -> naechstliegendes Verteilungsprofil. */
function profileForOffer(offer: SponsorOffer) {
  const total = offer.components.reduce((a, c) => a + Math.max(0, c.rewardCash ?? 0), 0);
  const special = offer.components.filter((c) => c.kind === "special").reduce((a, c) => a + Math.max(0, c.rewardCash ?? 0), 0);
  const share = total > 0 ? special / total : 0.25;
  return [...PROFILES].sort((a, b) => Math.abs(a.specialShare - share) - Math.abs(b.specialShare - share))[0]!;
}

const RARITY_KEY_TO_LABEL: Record<string, string> = {
  gewoehnlich: "gewöhnlich", magisch: "magisch", selten: "selten", legendaer: "legendär",
};
const rarityLabelOf = (key: string | undefined): string => {
  if (!key) return "magisch";
  const de = SPONSOR_RARITIES[key as keyof typeof SPONSOR_RARITIES]?.labelDe;
  if (de) return de.toLowerCase();
  return RARITY_KEY_TO_LABEL[key] ?? "magisch";
};

/** Ein echtes Engine-Angebot -> Modellkarte. */
function cardFromOffer(offer: SponsorOffer): ShadowCard {
  const rnd = hashRnd(offer.offerId);
  return {
    sourceOfferId: offer.offerId,
    rarity: rarityLabelOf(offer.rarity),
    profile: profileForOffer(offer),
    curve: curveByName(CURVE_MAP[offer.curveShape ?? ""] ?? "Linear"),
    clause: SHADOW_CLAUSES[Math.floor(rnd() * SHADOW_CLAUSES.length)]!,
  };
}

/**
 * Karte fuer eine vergangene Saison, fuer die keine Angebote mehr im Save stehen.
 * Die RARITY kommt NICHT aus einem freien Zug, sondern aus der Engine-Regel
 * `getPercentileTargetRarity(leaguePosition, teamCount)` — die Rarity-Mischung ist damit die,
 * die die Engine dem Team fuer seine Ausgangslage wirklich zugesteht. Kurve, Profil und Klausel
 * werden deterministisch gezogen (Annahme, siehe Kopf).
 */
function cardForPastSeason(teamId: string, seasonId: string, leaguePosition: number, teamCount: number, slot: number): ShadowCard {
  const rnd = hashRnd(`${teamId}:${seasonId}:${slot}`);
  return {
    rarity: rarityLabelOf(getPercentileTargetRarity(leaguePosition, teamCount)),
    profile: PROFILES[Math.floor(rnd() * PROFILES.length)]!,
    curve: SHADOW_CURVES[Math.floor(rnd() * SHADOW_CURVES.length)]!,
    clause: SHADOW_CLAUSES[Math.floor(rnd() * SHADOW_CLAUSES.length)]!,
  };
}

type MeasuredInput = {
  sigma: { pooled: number; byClass: number[]; design: number };
  clauses: Array<{ clause: string; designP: number; measurable: boolean; kind?: string; p?: number; bestP?: number; gap?: number; reachable?: boolean }>;
};

function main() {
  if (!MEASURED) throw new Error("--measured <measure.json> fehlt (Ausgabe von scripts/sponsor-shadow-measure.ts).");
  const measured = JSON.parse(fs.readFileSync(MEASURED, "utf8")) as MeasuredInput;
  const { gameState, saveId } = openSave({ sqlitePath: DB_PATH, saveId: SAVE_ID });
  const obs = buildSeasonObservations(gameState);
  const snaps = completedSnapshots(gameState);
  const teamCount = gameState.teams.length;

  const SIGMA = measured.sigma.pooled;
  /** Effektives P je Klausel: gemessen, wo messbar; sonst das Design-P (dann markiert). */
  const pOf = new Map<string, { p: number; source: string }>();
  for (const c of SHADOW_CLAUSES) {
    const m = measured.clauses.find((x) => x.clause === c.name);
    if (m?.kind === "direkt" && typeof m.p === "number") pOf.set(c.name, { p: m.p, source: "gemessen" });
    else if (m?.kind === "schwellenabhaengig" && m.reachable) pOf.set(c.name, { p: c.p, source: "Schwelle auf Design-P setzbar" });
    else pOf.set(c.name, { p: c.p, source: "ANGENOMMEN (nicht messbar)" });
  }

  line();
  console.log("SCHATTENTEST · AUFGABE 2 — Schattenbuchhaltung gegen einen echten Engine-Lauf");
  line();
  console.log(`Save ${saveId} · ${teamCount} Teams · ${snaps.length} abgeschlossene Saisons · ${obs.length} Team-Saisons`);
  console.log(`Gemessenes sigma (gepoolt): ${fmt(SIGMA, 2)}   ·   Design-sigma: ${DESIGN_SIGMA}   ·   P_GOAL (ungemessen): ${DESIGN_P_GOAL}`);
  const assumedP = [...pOf.entries()].filter(([, v]) => v.source.startsWith("ANGENOMMEN")).map(([k]) => k);
  console.log(`Klauseln mit ANGENOMMENEM statt gemessenem P: ${assumedP.length} (${assumedP.join(", ") || "—"})`);

  // ── Saisonweise Schattenbuchhaltung ──────────────────────────────────────────────────────────
  const factors = new Map<string, number>();
  for (const e of gameState.seasonState.seasonEconomyFactors ?? []) if (e?.seasonId) factors.set(e.seasonId, e.factor ?? 1);
  const factorSource = new Map<string, string>();

  type SeasonResult = {
    seasonId: string; sf: number; sfSource: string; k: number;
    sponsorSum: number; salarySum: number; coveragePct: number; targetPct: number;
    floorRate: number; prizeSum: number;
    rows: Array<{ teamId: string; expectedRank: number; finalRank: number; paid: number; salary: number;
                  prize: number; floor: boolean; monotone: boolean; curve: string; profile: string;
                  rarity: string; worstDrop: number; dropAt: number }>;
    /** Karten und Offsets, wie sie VOR der Saison feststanden — fuer die Wiederholungswuerfe. */
    exAnte: ExAnteTeam[];
  };
  const seasonResults: SeasonResult[] = [];
  const decomposition = new Map<string, { clauseRate: number; clauseAssumed: number; goalRate: number; sumAtExpected: number }>();
  const sdBySeason = new Map<string, number>();

  for (const snap of snaps) {
    const seasonObs = obs.filter((o) => o.seasonId === snap.seasonId);
    if (seasonObs.length === 0) continue;
    const sf = factors.get(snap.seasonId) ?? 1;
    factorSource.set(snap.seasonId, factors.has(snap.seasonId) ? "aus seasonEconomyFactors" : "FEHLT im Save → 1.0 angenommen");

    // Ex-ante: Karte ziehen, kalibrieren, K loesen. Kein realisierter Endrang geht ein.
    const exAnte: ExAnteTeam[] = seasonObs.map((o) => {
      const card = cardForPastSeason(o.teamId, o.seasonId, o.expectedRank, teamCount, 0);
      const params: CardParams = { sigma: SIGMA, pClause: pOf.get(card.clause.name)!.p, pGoal: DESIGN_P_GOAL };
      return { teamId: o.teamId, expectedRank: o.expectedRank, card, cal: calibrateCard(card, o.expectedRank, params) };
    });
    const salarySum = seasonObs.reduce((a, o) => a + (o.salaryEnd ?? 0), 0);
    const targetSum = salarySum * sf;
    // Die Klausel-P unterscheiden sich je Karte; solveExAnteK bekommt deshalb je Team eigene
    // Parameter. Das erledigt expectedPaidAtK ueber team.card.clause.
    const k = solveExAnteKPerTeam(exAnte, pOf, SIGMA, sf, targetSum);

    const outcomes: Array<{ clauseMet: boolean; goalMet: boolean; p: number; paidAtExpected: number }> = [];
    const rows = seasonObs.map((o, idx) => {
      const t = exAnte[idx]!;
      const p = pOf.get(t.card.clause.name)!.p;
      const params: CardParams = { sigma: SIGMA, pClause: p, pGoal: DESIGN_P_GOAL };
      const rnd = hashRnd(`${o.teamId}:${o.seasonId}:outcome:${DRAW_SALT.value}`);
      const clauseMet = rnd() < p;
      const goalMet = rnd() < DESIGN_P_GOAL;
      const raw = rawPayout(t.card, o.expectedRank, o.finalRank, t.cal, params, clauseMet, goalMet);
      const paid = scaleWithK(raw, t.card.rarity, sf, k);
      outcomes.push({
        clauseMet, goalMet, p,
        paidAtExpected: scaleWithK(
          rawPayout(t.card, o.expectedRank, Math.round(o.expectedRank), t.cal, params, clauseMet, goalMet),
          t.card.rarity, sf, k),
      });
      // Kriterium 5: zahlt ein BESSERER Endrang weniger? Ueber alle 32 Raenge mit demselben
      // Klausel-/Zielzustand geprueft — die Engine kennt keinen Korridor.
      const ladder = Array.from({ length: 32 }, (_, i) =>
        scaleWithK(rawPayout(t.card, o.expectedRank, i + 1, t.cal, params, clauseMet, goalMet), t.card.rarity, sf, k));
      let monotone = true;
      for (let r = 1; r < 32; r += 1) if (ladder[r - 1]! < ladder[r]! - 1e-6) { monotone = false; break; }
      // Groesster Rueckschritt: um wieviel zahlt der beste Verstoss weniger, obwohl der Rang besser ist?
      let worstDrop = 0, dropAt = 0;
      for (let r = 1; r < 32; r += 1) {
        const drop = ladder[r]! - ladder[r - 1]!;
        if (drop > worstDrop) { worstDrop = drop; dropAt = r; }
      }
      return {
        teamId: o.teamId, expectedRank: o.expectedRank, finalRank: o.finalRank,
        paid, salary: o.salaryEnd ?? 0,
        prize: getPrizeMoneyReference(o.finalRank, sf) + getRankMilestoneBonus(o.finalRank, sf),
        floor: hitFloor(raw, t.card.rarity, sf, k), monotone,
        curve: t.card.curve.name, profile: t.card.profile.name, rarity: t.card.rarity,
        worstDrop, dropAt,
      };
    });

    const sponsorSum = rows.reduce((a, r) => a + r.paid, 0);
    const sumSd = Math.sqrt(exAnte.reduce((a, t) => a + varianceOfPaid(
      t, { sigma: SIGMA, pClause: pOf.get(t.card.clause.name)!.p, pGoal: DESIGN_P_GOAL }, sf, k), 0));
    sdBySeason.set(snap.seasonId, sumSd);
    decomposition.set(snap.seasonId, {
      clauseRate: outcomes.filter((o) => o.clauseMet).length / outcomes.length,
      clauseAssumed: mean(outcomes.map((o) => o.p)),
      goalRate: outcomes.filter((o) => o.goalMet).length / outcomes.length,
      sumAtExpected: outcomes.reduce((a, o) => a + o.paidAtExpected, 0),
    });
    seasonResults.push({
      seasonId: snap.seasonId, sf, sfSource: factorSource.get(snap.seasonId)!, k,
      sponsorSum, salarySum, coveragePct: (100 * sponsorSum) / Math.max(1e-9, salarySum), targetPct: sf * 100,
      floorRate: rows.filter((r) => r.floor).length / rows.length,
      prizeSum: rows.reduce((a, r) => a + r.prize, 0), rows, exAnte,
    });
  }

  line("-");
  console.log("LIGA-DECKUNG JE SAISON MIT EX-ANTE-K");
  line("-");
  console.log("  Saison        sf     Quelle sf                        K      Sigma-Sponsor  Sigma-Gehalt   Deckung   Ziel    Abw.  Untergr.   EigenSD   z");
  for (const s of seasonResults) {
    const dev = s.coveragePct - s.targetPct;
    const sdPp = (100 * (sdBySeason.get(s.seasonId) ?? 0)) / Math.max(1e-9, s.salarySum);
    console.log(`  ${s.seasonId.padEnd(12)} ${s.sf.toFixed(2)}  ${s.sfSource.padEnd(32)} ${s.k.toFixed(3).padStart(6)}` +
      `  ${fmt(s.sponsorSum).padStart(12)}  ${fmt(s.salarySum).padStart(12)}  ${fmt(s.coveragePct).padStart(7)} %` +
      `  ${fmt(s.targetPct, 0).padStart(4)} %  ${((dev >= 0 ? "+" : "") + fmt(dev)).padStart(6)}  ${fmt(100 * s.floorRate, 0).padStart(4)} %` +
      `  ${("+-" + fmt(sdPp)).padStart(8)}  ${fmt(dev / Math.max(1e-9, sdPp), 2).padStart(6)}`);
  }
  // ── Woher kommt eine Abweichung? Zerlegung in Ziehungsrauschen und Rangeffekt ────────────────
  //   (a) realisierte Klausel-/Zielquote gegen die angenommene — Ziehungsrauschen der Lotterien
  //   (b) Summe, wenn jedes Team GENAU auf seinem Erwartungsrang landet, bei denselben Ziehungen
  //       — was ueber bleibt, ist der Effekt der tatsaechlichen Rangverteilung
  line("-");
  console.log("ZERLEGUNG DER ABWEICHUNG");
  line("-");
  console.log("  Saison        Klauselquote  (angenommen)   Zielquote  (angenommen)   Summe bei Erwartungsrang   realisiert");
  for (const s of seasonResults) {
    const d = decomposition.get(s.seasonId)!;
    console.log(`  ${s.seasonId.padEnd(12)} ${fmt(d.clauseRate, 2).padStart(8)}   ${fmt(d.clauseAssumed, 2).padStart(12)}` +
      `  ${fmt(d.goalRate, 2).padStart(9)}  ${fmt(DESIGN_P_GOAL, 2).padStart(13)}` +
      `  ${fmt(d.sumAtExpected).padStart(22)}  ${fmt(s.sponsorSum).padStart(11)}`);
  }

  const devs = seasonResults.map((s) => s.coveragePct - s.targetPct);
  console.log(`\n  Abweichung ueber die Saisons: Median ${fmt(median(devs))} Pp · IQR [${fmt(quantile(devs, 0.25))}, ${fmt(quantile(devs, 0.75))}] Pp`);
  console.log("  Spalte EigenSD: Standardabweichung der Liga-Summe, die das Modell VOR der Saison selbst erzeugt");
  console.log("  (Karten unabhaengig, Klausel- und Ziellotterie je Team), in Prozentpunkten der Gehaltssumme.");
  console.log("  Spalte z: Abweichung in Einheiten dieser Eigenstreuung. |z| unter 2 heisst: die Abweichung ist die");
  console.log("  normale Streuung des Entwurfs, kein Ausreisser — dann ist das Ziel 'sf +- 5 Pp' strukturell unerreichbar.");
  console.log("  ACHTUNG ZUR DATENBASIS: das ist EIN Engine-Lauf. 'Median' und 'IQR' laufen hier ueber die");
  console.log("  fuenf SAISONS dieses einen Laufs, nicht ueber Seeds. Die Streuung zwischen Laeufen ist ungemessen.");

  // ── Salden ueber alle Saisons ────────────────────────────────────────────────────────────────
  const balanceByTeam = new Map<string, number>();
  for (const s of seasonResults) for (const r of s.rows) {
    balanceByTeam.set(r.teamId, (balanceByTeam.get(r.teamId) ?? 0) + r.paid + r.prize - r.salary);
  }
  const balances = [...balanceByTeam.values()];
  const minSalary = Math.min(...seasonResults.flatMap((s) => s.rows.map((r) => r.salary)).filter((v) => v > 0));
  line("-");
  console.log("KUMULIERTER SALDO (Sponsor + Preisgeld − Gehalt) NACH ALLEN SAISONS");
  line("-");
  console.log(`  Median ${fmt(median(balances))} C · IQR [${fmt(quantile(balances, 0.25))}, ${fmt(quantile(balances, 0.75))}] C` +
    ` · Spanne [${fmt(Math.min(...balances))}, ${fmt(Math.max(...balances))}] C`);
  console.log(`  Teams im Plus: ${balances.filter((b) => b > 0).length}/${balances.length}`);
  console.log(`  Kleinstes Team-Gehalt im Lauf (= ein Mindestgehalt): ${fmt(minSalary)} C`);
  const belowOneSalary = balances.filter((b) => b < -minSalary).length;
  console.log(`  Teams unter minus einem Mindestgehalt: ${belowOneSalary}`);

  // ── Kriterium 2: sicherste Karte und Zahlungsfaehigkeit ──────────────────────────────────────
  line("-");
  console.log("KRITERIUM 2 — Team waehlt die SICHERSTE angebotene Karte: wird es zahlungsunfaehig?");
  line("-");
  const startCash = new Map(gameState.teams.map((t) => [t.teamId, t.cash] as const));
  const safeCash = new Map<string, number>(startCash);
  let insolvencies = 0;
  const insolventTeams: string[] = [];
  for (const s of seasonResults) {
    const seasonObs = obs.filter((o) => o.seasonId === s.seasonId);
    for (const o of seasonObs) {
      // Fuenf Angebote wie in der Engine; die sicherste = hoechste garantierte Untergrenze ueber
      // alle Endraenge und beide Klausel-Zustaende.
      let best: { paid: number; floorValue: number } | null = null;
      for (let slot = 0; slot < 5; slot += 1) {
        const card = cardForPastSeason(o.teamId, o.seasonId, o.expectedRank, teamCount, slot);
        const p = pOf.get(card.clause.name)!.p;
        const params: CardParams = { sigma: SIGMA, pClause: p, pGoal: DESIGN_P_GOAL };
        const cal = calibrateCard(card, o.expectedRank, params);
        let worst = Number.POSITIVE_INFINITY;
        for (let r = 1; r <= 32; r += 1) {
          worst = Math.min(worst, scaleWithK(rawPayout(card, o.expectedRank, r, cal, params, false, false), card.rarity, s.sf, s.k));
        }
        const rnd = hashRnd(`${o.teamId}:${o.seasonId}:safe:${slot}:${DRAW_SALT.value}`);
        const clauseMet = rnd() < p, goalMet = rnd() < DESIGN_P_GOAL;
        const paid = scaleWithK(rawPayout(card, o.expectedRank, o.finalRank, cal, params, clauseMet, goalMet), card.rarity, s.sf, s.k);
        if (!best || worst > best.floorValue) best = { paid, floorValue: worst };
      }
      const prize = getPrizeMoneyReference(o.finalRank, s.sf) + getRankMilestoneBonus(o.finalRank, s.sf);
      const next = (safeCash.get(o.teamId) ?? 0) + best!.paid + prize - (o.salaryEnd ?? 0);
      safeCash.set(o.teamId, next);
      if (next < 0 && !insolventTeams.includes(o.teamId)) { insolvencies += 1; insolventTeams.push(o.teamId); }
    }
  }
  const safeBalances = [...safeCash.values()];
  console.log(`  Startkasse: Median ${fmt(median([...startCash.values()]))} C`);
  console.log(`  Kasse nach allen Saisons bei sicherster Wahl: Median ${fmt(median(safeBalances))} C` +
    ` · IQR [${fmt(quantile(safeBalances, 0.25))}, ${fmt(quantile(safeBalances, 0.75))}] C · Minimum ${fmt(Math.min(...safeBalances))} C`);
  console.log(`  Zahlungsunfaehige Teams (Kasse < 0 zu irgendeinem Saisonende): ${insolvencies}` +
    (insolvencies ? ` (${insolventTeams.join(", ")})` : ""));
  console.log("  HINWEIS: Kredite sind hier NICHT als Rettungsleine mitgerechnet — das macht das Kriterium haerter,");
  console.log("  nicht weicher. Transfers, Gebaeudekosten und Ablosen fehlen ebenfalls; die Kasse ist damit optimistisch.");

  // ── Kriterium 4: FOSD auf einer TATSAECHLICH erzeugten Angebotsliste ──────────────────────────
  line("-");
  console.log("KRITERIUM 4 — FOSD-Fallen in einer tatsaechlich erzeugten Angebotsliste (mit gemessenem sigma/P)");
  line("-");
  const offersByTeam = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const liveExpected = new Map(obs.filter((o) => o.seasonIndex === snaps.length).map((o) => [o.teamId, o.finalRank] as const));
  let slates = 0, traps = 0, collapsed = 0, cards = 0;
  // VAKUUM-WAECHTER: "0 Fallen" ist wertlos, wenn die Karten einer Liste identisch sind — identische
  // Karten koennen sich definitionsgemaess nicht dominieren. Deshalb wird mitgezaehlt, wie viele
  // Listen ueberhaupt mehr als eine VERSCHIEDENE Karte enthalten und wie viele Paare geprueft wurden.
  let comparablePairs = 0, identicalPairs = 0, slatesWithVariety = 0;
  const distinctPerSlate: number[] = [];
  const rarityMix = new Map<string, number>();
  const curveMix = new Map<string, number>();
  const trapDetails: string[] = [];
  for (const [teamId, offers] of Object.entries(offersByTeam)) {
    if (!offers || offers.length < 2) continue;
    const expected = liveExpected.get(teamId) ?? 16;
    const built = offers.map((offer) => {
      const card = cardFromOffer(offer);
      const p = pOf.get(card.clause.name)!.p;
      const params: CardParams = { sigma: SIGMA, pClause: p, pGoal: DESIGN_P_GOAL };
      const cal = calibrateCard(card, expected, params);
      return { name: `${offer.offerId}|${card.rarity}/${card.curve.name}/${card.clause.name}`, card, params, cal };
    });
    const ranks = Array.from({ length: 32 }, (_, i) => i + 1);
    const lots = built.map((b) => ({ name: b.name, lot: lotteriesOfCard(b.card, expected, b.cal, b.params, ranks) }));
    slates += 1;
    cards += lots.length;
    const keys = built.map((b) => `${b.card.rarity}/${b.card.curve.name}/${b.card.profile.name}/${b.card.clause.name}`);
    const distinct = new Set(keys).size;
    distinctPerSlate.push(distinct);
    if (distinct > 1) slatesWithVariety += 1;
    for (const b of built) {
      rarityMix.set(b.card.rarity, (rarityMix.get(b.card.rarity) ?? 0) + 1);
      curveMix.set(b.card.curve.name, (curveMix.get(b.card.curve.name) ?? 0) + 1);
    }
    for (let i = 0; i < keys.length; i += 1) for (let j = i + 1; j < keys.length; j += 1) {
      if (keys[i] === keys[j]) identicalPairs += 1; else comparablePairs += 1;
    }
    for (const a of lots) {
      if (isCollapsed(a.lot)) { collapsed += 1; continue; }
      const dominator = lots.find((b) => b.name !== a.name
        && a.lot.every((la, i) => fosdAtLeast(b.lot[i]!, la))
        && a.lot.some((la, i) => fosdStrictly(b.lot[i]!, la)));
      if (dominator) {
        traps += 1;
        if (trapDetails.length < 8) trapDetails.push(`${teamId} (E ${expected}): ${a.name}  dominiert von  ${dominator.name}`);
      }
    }
  }
  console.log(`  Angebotslisten aus dem Save: ${slates} · Karten insgesamt: ${cards} · Karten je Liste: ${slates ? (cards / slates).toFixed(1) : "—"}`);
  console.log(`  FALLEN (rang-konditional FOSD-dominiert): ${traps}`);
  console.log(`  Kollabierte Karten (keine Streuung — koennen per Definition nicht dominieren): ${collapsed}`);
  console.log(`  VAKUUM-WAECHTER: Listen mit mehr als einer VERSCHIEDENEN Karte: ${slatesWithVariety}/${slates}` +
    ` · verschiedene Karten je Liste im Schnitt: ${distinctPerSlate.length ? (distinctPerSlate.reduce((a, b) => a + b, 0) / distinctPerSlate.length).toFixed(2) : "—"}`);
  console.log(`  gepruefte Paare: ${comparablePairs} verschieden, ${identicalPairs} identisch (identische koennen nicht dominieren)`);
  console.log(`  Rarity-Mischung der Angebote: ${[...rarityMix.entries()].map(([kk, v]) => `${kk} ${v}`).join(", ")}`);
  console.log(`  Kurven-Mischung (nach Abbildung): ${[...curveMix.entries()].map(([kk, v]) => `${kk} ${v}`).join(", ")}`);
  for (const d of trapDetails) console.log(`    ${d}`);
  if (slates === 0) console.log("  KEINE Angebotsliste im Save — Kriterium 4 NICHT pruefbar.");

  // ── Wiederholte Lotteriewuerfe ───────────────────────────────────────────────────────────────
  //  K bleibt fest — es ist ex ante und haengt per Konstruktion NICHT an den Wuerfen. Die
  //  realisierten Endraenge bleiben ebenfalls fest. Variiert wird ausschliesslich die
  //  Klausel-/Ziellotterie des Modells.
  const drawStats = { coverageDev: [] as number[], insolvencies: [] as number[], belowSalary: [] as number[], minCash: [] as number[] };
  if (DRAWS > 1) {
    for (let draw = 0; draw < DRAWS; draw += 1) {
      DRAW_SALT.value = draw;
      const cash = new Map<string, number>(startCash);
      const bal = new Map<string, number>();
      let ins = 0;
      const seen = new Set<string>();
      for (const s of seasonResults) {
        const seasonObs = obs.filter((o) => o.seasonId === s.seasonId);
        let sponsorSum = 0;
        seasonObs.forEach((o, idx) => {
          const t = s.exAnte[idx]!;
          const p = pOf.get(t.card.clause.name)!.p;
          const params: CardParams = { sigma: SIGMA, pClause: p, pGoal: DESIGN_P_GOAL };
          const rnd = hashRnd(`${o.teamId}:${o.seasonId}:outcome:${draw}`);
          const clauseMet = rnd() < p, goalMet = rnd() < DESIGN_P_GOAL;
          const paid = scaleWithK(rawPayout(t.card, o.expectedRank, o.finalRank, t.cal, params, clauseMet, goalMet), t.card.rarity, s.sf, s.k);
          sponsorSum += paid;
          const prize = getPrizeMoneyReference(o.finalRank, s.sf) + getRankMilestoneBonus(o.finalRank, s.sf);
          bal.set(o.teamId, (bal.get(o.teamId) ?? 0) + paid + prize - (o.salaryEnd ?? 0));
          // sicherste Karte separat
          let bestWorst = Number.NEGATIVE_INFINITY, bestPaid = 0;
          for (let slot = 0; slot < 5; slot += 1) {
            const card = cardForPastSeason(o.teamId, o.seasonId, o.expectedRank, teamCount, slot);
            const pc = pOf.get(card.clause.name)!.p;
            const pr: CardParams = { sigma: SIGMA, pClause: pc, pGoal: DESIGN_P_GOAL };
            const cal = calibrateCard(card, o.expectedRank, pr);
            let worst = Number.POSITIVE_INFINITY;
            for (let r = 1; r <= 32; r += 1) worst = Math.min(worst, scaleWithK(rawPayout(card, o.expectedRank, r, cal, pr, false, false), card.rarity, s.sf, s.k));
            const rr = hashRnd(`${o.teamId}:${o.seasonId}:safe:${slot}:${draw}`);
            const cm = rr() < pc, gm = rr() < DESIGN_P_GOAL;
            if (worst > bestWorst) {
              bestWorst = worst;
              bestPaid = scaleWithK(rawPayout(card, o.expectedRank, o.finalRank, cal, pr, cm, gm), card.rarity, s.sf, s.k);
            }
          }
          const next = (cash.get(o.teamId) ?? 0) + bestPaid + prize - (o.salaryEnd ?? 0);
          cash.set(o.teamId, next);
          if (next < 0 && !seen.has(o.teamId)) { ins += 1; seen.add(o.teamId); }
        });
        drawStats.coverageDev.push((100 * sponsorSum) / Math.max(1e-9, s.salarySum) - s.targetPct);
      }
      drawStats.insolvencies.push(ins);
      drawStats.belowSalary.push([...bal.values()].filter((b) => b < -minSalary).length);
      drawStats.minCash.push(Math.min(...cash.values()));
    }
    DRAW_SALT.value = 0;
    line("-");
    console.log(`WIEDERHOLTE LOTTERIEWUERFE — ${DRAWS} Wuerfe bei UNVERAENDERTEN Endraengen und festem ex-ante-K`);
    line("-");
    console.log("  Das ist NICHT Seed-Streuung der Engine (die Endstaende sind dieselben), sondern die");
    console.log("  Streuung, die das Modell selbst durch Klausel- und Ziellotterie erzeugt.");
    const cd = drawStats.coverageDev;
    console.log(`  Deckungsabweichung (${cd.length} Saison-Wuerfe): Median ${fmt(median(cd))} Pp · IQR [${fmt(quantile(cd, 0.25))}, ${fmt(quantile(cd, 0.75))}] Pp` +
      ` · Spanne [${fmt(Math.min(...cd))}, ${fmt(Math.max(...cd))}] Pp`);
    console.log(`  Saison-Wuerfe ausserhalb sf +- 5 Pp: ${cd.filter((v) => Math.abs(v) > 5).length}/${cd.length} = ${fmt(100 * cd.filter((v) => Math.abs(v) > 5).length / cd.length, 0)} %`);
    console.log(`  Zahlungsunfaehige bei sicherster Wahl: Median ${fmt(median(drawStats.insolvencies), 0)} · IQR [${fmt(quantile(drawStats.insolvencies, 0.25), 0)}, ${fmt(quantile(drawStats.insolvencies, 0.75), 0)}] · max ${Math.max(...drawStats.insolvencies)}`);
    console.log(`  Teams unter minus einem Mindestgehalt: Median ${fmt(median(drawStats.belowSalary), 0)} · IQR [${fmt(quantile(drawStats.belowSalary, 0.25), 0)}, ${fmt(quantile(drawStats.belowSalary, 0.75), 0)}] · max ${Math.max(...drawStats.belowSalary)}`);
    console.log(`  Niedrigste Kasse ueber alle Wuerfe: ${fmt(Math.min(...drawStats.minCash))} C`);
  }

  // ── Kriterien-Auswertung ─────────────────────────────────────────────────────────────────────
  line();
  console.log("AUFGABE 3 — DIE SECHS ABBRUCHKRITERIEN");
  line();
  const outsideBand = seasonResults.filter((s) => Math.abs(s.coveragePct - s.targetPct) > 5);
  const k1fail = outsideBand.length > 1;
  console.log(`  1. Deckung je Saison innerhalb sf +- 5 Pp`);
  console.log(`     Saisons ausserhalb: ${outsideBand.length}/${seasonResults.length}` +
    (outsideBand.length ? ` (${outsideBand.map((s) => `${s.seasonId} ${fmt(s.coveragePct)} % gegen ${fmt(s.targetPct, 0)} %`).join("; ")})` : ""));
  console.log(`     VERDIKT: ${k1fail ? "GERISSEN" : "bestanden"}  (Schwelle: mehr als eine von fuenf Saisons)`);

  const k2fail = insolvencies > 0;
  console.log(`\n  2. Kein Team, das die sicherste Karte waehlte, wird zahlungsunfaehig`);
  console.log(`     Faelle: ${insolvencies} (verlangt: 0)`);
  console.log(`     VERDIKT: ${k2fail ? "GERISSEN" : "bestanden"}  — aus EINEM Lauf, Streuung ueber Seeds ungemessen`);

  const sigmaOk = SIGMA >= 3.5 && SIGMA <= 7;
  const directBreaches = measured.clauses.filter((c) => c.kind === "direkt" && Number(c.gap) > 0.15);
  const unreachable = measured.clauses.filter((c) => c.kind === "schwellenabhaengig" && c.reachable === false);
  const notMeasurable = measured.clauses.filter((c) => c.measurable === false);
  const k3fail = !sigmaOk || directBreaches.length > 0 || unreachable.length > 0;
  console.log(`\n  3. sigma in [3.5, 7] und jedes gemessene P hoechstens 0.15 neben dem Design-P`);
  console.log(`     sigma gepoolt ${fmt(SIGMA, 2)} → ${sigmaOk ? "im Korridor" : "AUSSERHALB"} (Design ${DESIGN_SIGMA})`);
  console.log(`     Klauseln mit direkt gemessenem P mehr als 0.15 daneben: ${directBreaches.length}` +
    (directBreaches.length ? ` (${directBreaches.map((c) => `${c.clause}: P=${fmt(Number(c.p), 2)} gegen ${c.designP}`).join("; ")})` : ""));
  console.log(`     Klauseln mit freier Schwelle, deren Design-P KEINE Schwelle erreicht: ${unreachable.length}`);
  console.log(`     Klauseln ohne jede Messmoeglichkeit: ${notMeasurable.length} (${notMeasurable.map((c) => c.clause).join(", ")})`);
  console.log(`     VERDIKT: ${k3fail ? "GERISSEN" : "bestanden"}`);

  const k4fail = slates > 0 && traps > 0;
  console.log(`\n  4. FOSD-Test mit gemessenem sigma/P findet keine Falle in einer echten Angebotsliste`);
  console.log(`     Fallen: ${traps} in ${slates} Listen (${cards} Karten), kollabiert: ${collapsed}`);
  console.log(`     VERDIKT: ${slates === 0 ? "NICHT PRUEFBAR" : k4fail ? "GERISSEN" : "bestanden"}`);

  const nonMonotone = seasonResults.flatMap((s) => s.rows.filter((r) => !r.monotone));
  const k5fail = nonMonotone.length > 0;
  console.log(`\n  5. Kein realisierter Fall "besserer Endrang zahlt weniger"`);
  console.log(`     Nicht-monotone Auszahlungsleitern unter den realisierten Karten: ${nonMonotone.length} von ${seasonResults.reduce((a, s) => a + s.rows.length, 0)}`);
  if (nonMonotone.length > 0) {
    const byCurve = new Map<string, number>();
    for (const r of nonMonotone) byCurve.set(`${r.curve}/${r.profile}`, (byCurve.get(`${r.curve}/${r.profile}`) ?? 0) + 1);
    console.log(`     nach Kurve/Profil: ${[...byCurve.entries()].map(([kk, v]) => `${kk} x${v}`).join(", ")}`);
    const worst = [...nonMonotone].sort((a, b) => b.worstDrop - a.worstDrop)[0]!;
    console.log(`     groesster Rueckschritt: ${fmt(worst.worstDrop)} C zwischen Rang ${worst.dropAt} und ${worst.dropAt + 1}` +
      ` (Team ${worst.teamId}, Erwartung ${worst.expectedRank}, Karte ${worst.rarity}/${worst.curve}/${worst.profile})`);
    const byProfile = new Map<string, number>();
    for (const r of nonMonotone) byProfile.set(r.profile, (byProfile.get(r.profile) ?? 0) + 1);
    console.log(`     nach Profil allein: ${[...byProfile.entries()].map(([kk, v]) => `${kk} x${v}`).join(", ")}`);
    console.log(`     URSACHE: nicht die Untergrenze und nicht die relative Kurve, sondern die FORMKOMPONENTE.`);
    console.log(`     formShape addiert FORM_AMPLITUDE x (tierWeights[Endstufe] − Mittel). Die tierWeights sind`);
    console.log(`     ueber die Tabellenstufen NICHT monoton — beim Profil "mittelfeld" liegt das Maximum bei`);
    console.log(`     Stufe 4 (Raenge 13-16, Gewicht .25) ueber Stufe 3 (Raenge 9-12, Gewicht .18). Bei Amplitude 60`);
    console.log(`     sind das 4.2 C Aufschlag fuers SCHLECHTERE Band, waehrend die LIGA-Leiter dort nur 4 C`);
    console.log(`     Unterschied hat (59 gegen 55). Der Rest kippt. Die EV-Zentrierung der Formkomponente haelt`);
    console.log(`     den ERWARTUNGSWERT neutral, sie sagt nichts ueber Monotonie im Rang.`);
  }
  console.log(`     VERDIKT: ${k5fail ? "GERISSEN" : "bestanden"}`);

  const k6fail = belowOneSalary > 8;
  console.log(`\n  6. Hoechstens 8 Teams mit kumuliertem Saldo unter minus einem Mindestgehalt`);
  console.log(`     Teams unter ${fmt(-minSalary)} C: ${belowOneSalary} (Schwelle: mehr als 8)`);
  console.log(`     VERDIKT: ${k6fail ? "GERISSEN" : "bestanden"}  — aus EINEM Lauf, Streuung ueber Seeds ungemessen`);

  const failed = [k1fail && "1", k2fail && "2", k3fail && "3", k4fail && "4", k5fail && "5", k6fail && "6"].filter(Boolean);
  line();
  console.log(`GESAMTURTEIL: ${failed.length === 0 ? "kein Abbruchkriterium gerissen" : `GERISSEN — Kriterien ${failed.join(", ")}`}`);
  line();

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, `${JSON.stringify({
      saveId, sigma: SIGMA,
      seasons: seasonResults.map((s) => ({ ...s, rows: undefined })),
      coverageDeviation: { median: median(devs), iqr: [quantile(devs, 0.25), quantile(devs, 0.75)], perSeason: devs },
      balances: { median: median(balances), iqr: [quantile(balances, 0.25), quantile(balances, 0.75)], belowOneSalary, minSalary },
      safeChoice: { insolvencies, insolventTeams, minCash: Math.min(...safeBalances), medianCash: median(safeBalances) },
      fosd: { slates, cards, traps, collapsed },
      criteria: { k1fail, k2fail, k3fail, k4fail, k5fail, k6fail },
    }, null, 2)}\n`);
    console.log(`JSON geschrieben: ${JSON_OUT}`);
  }
}

/**
 * K loesen, wenn jede Karte ihr eigenes Klausel-P hat. Gleiche Bisektion wie `solveExAnteK` im
 * Kernmodul, nur mit karteneigenen Parametern je Team — deshalb hier statt dort.
 * Es geht ausschliesslich Vor-Saison-Information ein: Erwartungsrang, Karte, sigma, P.
 */
function solveExAnteKPerTeam(
  teams: ExAnteTeam[], pOf: Map<string, { p: number }>, sigma: number, sf: number, targetSum: number,
): number {
  const sumAt = (k: number) => teams.reduce((acc, t) => acc + expectedPaidAt(
    t, { sigma, pClause: pOf.get(t.card.clause.name)!.p, pGoal: DESIGN_P_GOAL }, sf, k), 0);
  let lo = 0, hi = 12;
  if (sumAt(hi) < targetSum) return hi;
  for (let i = 0; i < 120; i += 1) { const mid = (lo + hi) / 2; if (sumAt(mid) < targetSum) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/**
 * Ex-ante-Varianz der Auszahlung EINER Karte. Ueber die 32 Teams aufsummiert (Karten unabhaengig
 * gezogen) ergibt das die Streuung der LIGA-SUMME, die das Modell selbst erzeugt.
 *
 * WOZU: eine realisierte Deckung von 110 % ist nur dann ein Modellfehler, wenn sie AUSSERHALB
 * dieser Eigenstreuung liegt. Liegt sie darin, ist die Liga-Summe schlicht eine Zufallsgroesse,
 * und die Vorgabe "sf +- 5 Prozentpunkte" ist mit dem Entwurf grundsaetzlich unvereinbar — was
 * ebenfalls ein Befund ist, nur ein anderer.
 */
function varianceOfPaid(team: ExAnteTeam, params: CardParams, sf: number, k: number): number {
  const w = distOf(team.expectedRank, params.sigma);
  const m = expectedPaidAt(team, params, sf, k);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    for (const c of cornersFor(team, r, params)) {
      const v = scaleWithK(c.v, team.card.rarity, sf, k);
      acc += w[r - 1]! * c.p * (v - m) ** 2;
    }
  }
  return acc;
}

/** Erwartete Auszahlung einer Karte vor der Saison — Erwartung ueber Endrang, Klausel und Ziel. */
function expectedPaidAt(team: ExAnteTeam, params: CardParams, sf: number, k: number): number {
  const w = distOf(team.expectedRank, params.sigma);
  let acc = 0;
  for (let r = 1; r <= 32; r += 1) {
    for (const c of cornersFor(team, r, params)) acc += w[r - 1]! * c.p * scaleWithK(c.v, team.card.rarity, sf, k);
  }
  return acc;
}
function distOf(expected: number, sigma: number): number[] {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - expected) ** 2) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}
function cornersFor(team: ExAnteTeam, finalRank: number, params: CardParams) {
  const out: Array<{ v: number; p: number }> = [];
  for (const clauseMet of [true, false]) for (const goalMet of [true, false]) {
    out.push({
      v: rawPayout(team.card, team.expectedRank, finalRank, team.cal, params, clauseMet, goalMet),
      p: (clauseMet ? params.pClause : 1 - params.pClause) * (goalMet ? params.pGoal : 1 - params.pGoal),
    });
  }
  return out;
}


if (require.main === module) main();

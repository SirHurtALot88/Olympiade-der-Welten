/**
 * MESSLAUF: GEMEINSAMES TRANSFERFENSTER S1 → S2 (Chris 18.11., `docs/design/transferfenster-gemeinsam-18-11.md`).
 *
 * Reine Messung auf einer WEGWERF-SQLite (Kopie!). Ausgangspunkt ist ein Spielstand nach den Spieltagen von
 * Saison 1 (32 KI-Teams von Anfang an), angelegt mit
 *
 *   OLY_APP_SQLITE_PATH=/tmp/basis.sqlite npx tsx scripts/miss-teamfinanzen-saison.ts --seasons 2 \
 *     --stop-after spieltage --keep --out /tmp/basis.json
 *
 * Von dort laeuft derselbe Weg wie im Spiel: Saisonabschluss → Saisonende-Kette (`advanceSeasonTransitionStep`) →
 * Saisonwechsel (`applyPreSeasonNextSeasonSetupLightweight`) → KI-Lauf im Fenster (`fuehreKiPreseasonLaufAus`).
 * Paarweise: dieselbe Basis zweimal kopieren und einmal mit `OLY_TRANSFERFENSTER_GEMEINSAM=0` (alter Ablauf),
 * einmal ohne (gemeinsames Fenster) laufen lassen.
 *
 *   cp basis.sqlite a.sqlite; OLY_TRANSFERFENSTER_GEMEINSAM=0 OLY_APP_SQLITE_PATH=a.sqlite \
 *     npx tsx scripts/miss-transferfenster-gemeinsam.ts --save <saveId> --label vorher --out a.json
 *   cp basis.sqlite b.sqlite; OLY_APP_SQLITE_PATH=b.sqlite \
 *     npx tsx scripts/miss-transferfenster-gemeinsam.ts --save <saveId> --label nachher --out b.json
 *
 * Gemessen je Team: Verkaeufe/Kaeufe am Saisonende und im Fenster (Anzahl, Summe), Transferbilanz S1 und S2 nach
 * der Buchungsregel, Kader nach dem Fenster, Kasse vor/nach, Kredite und Notkredite des Fensters.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { fuehreKiPreseasonLaufAus } from "@/lib/ai/ai-preseason-background-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { istTransferfensterGemeinsam } from "@/lib/market/transferfenster-gemeinsam";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep } from "@/lib/season/season-transition-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";
import { buildStandingsTransferBalanceByTeamId } from "@/lib/season/transfer-standings-balance";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const SAVE = arg("save", "");
const OUT = arg("out", "");
const LABEL = arg("label", istTransferfensterGemeinsam() ? "gemeinsam" : "alt");
const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${msg}`);
const r2 = (v: number) => Math.round(v * 100) / 100;

function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return NaN;
  const s = [...werte].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const u = Math.floor(pos);
  const o = Math.ceil(pos);
  return r2(s[u]! + (s[o]! - s[u]!) * (pos - u));
}

function kader(gs: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of gs.teams) out[t.teamId] = 0;
  for (const r of gs.rosters) out[r.teamId] = (out[r.teamId] ?? 0) + 1;
  return out;
}

/** Bewegungen, die NACH `vorher` dazukamen (Menge der IDs — die Historie ist nicht nach Zeit geordnet). */
function bewegungen(gs: GameState, vorher: Set<string>) {
  const je: Record<string, { kaeufe: number; kaufSumme: number; verkaeufe: number; verkaufSumme: number }> = {};
  const z = (teamId: string) => (je[teamId] ??= { kaeufe: 0, kaufSumme: 0, verkaeufe: 0, verkaufSumme: 0 });
  for (const e of gs.transferHistory) {
    if (vorher.has(e.id)) continue;
    if (e.transferType === "buy" && e.toTeamId) {
      z(e.toTeamId).kaeufe += 1;
      z(e.toTeamId).kaufSumme = r2(z(e.toTeamId).kaufSumme + e.fee);
    } else if (e.transferType === "sell" && e.fromTeamId) {
      z(e.fromTeamId).verkaeufe += 1;
      z(e.fromTeamId).verkaufSumme = r2(z(e.fromTeamId).verkaufSumme + (e.netCashImpact ?? e.fee));
    }
  }
  return je;
}

async function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Kopie!) setzen.");
  if (!SAVE) throw new Error("--save <saveId> fehlt");
  const persistence = createPersistenceService();
  const get = () => persistence.getSaveById(SAVE)!;
  const start = get().gameState;
  const sid1 = start.season.id;
  log(`${LABEL}: Start ${SAVE} ${sid1} Phase ${start.gamePhase}, gemeinsam=${istTransferfensterGemeinsam()}`);

  const comp = await runLocalSeasonCompletion(
    { saveId: SAVE, seasonId: sid1, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
    persistence,
  );
  log(`Saisonabschluss ok=${comp.ok} applied=${comp.applied}`);
  const nachAbschluss = get().gameState;
  const kasseSaisonende = Object.fromEntries(nachAbschluss.teams.map((t) => [t.teamId, r2(t.cash)]));
  const histVorKette = new Set(nachAbschluss.transferHistory.map((e) => e.id));

  for (let hop = 1; hop <= 12; hop += 1) {
    const aktuell = get();
    if (!isSeasonEndPhase(aktuell.gameState.gamePhase)) break;
    const erg = await advanceSeasonTransitionStep(aktuell, persistence);
    if (!erg.applied) {
      log(`Kette haelt: ${erg.blockingReasons.join(",")}`);
      break;
    }
  }
  const nachKette = get().gameState;
  const saisonendeBewegungen = bewegungen(nachKette, histVorKette);
  const histVorWechsel = new Set(nachKette.transferHistory.map((e) => e.id));

  const { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } = await import(
    "@/lib/season/preseason-workflow-service"
  );
  const tok = buildPreSeasonNextSeasonSetupToken(get()).confirmToken;
  const wechsel = applyPreSeasonNextSeasonSetupLightweight(get(), tok, persistence);
  log(`Saisonwechsel applied=${wechsel.applied} ${wechsel.blockingReasons?.join("|") ?? ""}`);
  const nachWechsel = get().gameState;
  const sid2 = nachWechsel.season.id;
  const kasseFensterStart = Object.fromEntries(nachWechsel.teams.map((t) => [t.teamId, r2(t.cash)]));
  const kaderFensterStart = kader(nachWechsel);
  const histVorFenster = new Set(nachWechsel.transferHistory.map((e) => e.id));
  const kredite0 = new Set((nachWechsel.seasonState.loans ?? []).map((k) => k.loanId));

  const tLauf = Date.now();
  const lauf = await fuehreKiPreseasonLaufAus({
    saveId: SAVE,
    seasonId: sid2,
    scope: { room: null, participant: null, activeOwnerId: null },
    persistence,
  });
  log(`KI-Lauf ${lauf.body.run?.status} Kaeufe=${lauf.body.run?.transferBuysApplied} Verkaeufe=${lauf.body.run?.transferSellsApplied} (${((Date.now() - tLauf) / 1000).toFixed(0)}s)`);
  const ende = get().gameState;
  const fensterBewegungen = bewegungen(ende, histVorFenster);
  const ausserhalbFenster = [...histVorFenster].filter((id) => !histVorWechsel.has(id)).length;
  const kaderEnde = kader(ende);
  const neueKredite = (ende.seasonState.loans ?? []).filter((k) => !kredite0.has(k.loanId));
  const bilanzS1 = buildStandingsTransferBalanceByTeamId(ende, sid1);
  const bilanzS2 = buildStandingsTransferBalanceByTeamId(ende, sid2);

  const teams = ende.teams.map((t) => {
    const se = saisonendeBewegungen[t.teamId];
    const fe = fensterBewegungen[t.teamId];
    return {
      teamId: t.teamId,
      kasseSaisonende: kasseSaisonende[t.teamId],
      kasseFensterStart: kasseFensterStart[t.teamId],
      kasseEnde: r2(t.cash),
      kaderFensterStart: kaderFensterStart[t.teamId],
      kaderEnde: kaderEnde[t.teamId],
      saisonendeVerkaeufe: se?.verkaeufe ?? 0,
      saisonendeVerkaufSumme: se?.verkaufSumme ?? 0,
      fensterVerkaeufe: fe?.verkaeufe ?? 0,
      fensterVerkaufSumme: fe?.verkaufSumme ?? 0,
      fensterKaeufe: fe?.kaeufe ?? 0,
      fensterKaufSumme: fe?.kaufSumme ?? 0,
      transferbilanzS1: bilanzS1[t.teamId]?.transferNet ?? null,
      kaderaufbauS1: bilanzS1[t.teamId]?.kaderaufbauNet ?? null,
      transferbilanzS2: bilanzS2[t.teamId]?.transferNet ?? null,
      schuld: r2(getTeamOutstandingDebt(ende, t.teamId)),
      notkredit: (lauf.body.run?.warnings ?? []).filter((w) => w.startsWith(`ai_notkredit:${t.teamId}:`)).length,
      kredite: neueKredite.filter((k) => k.borrowerTeamId === t.teamId).length,
    };
  });

  const summe = (f: (x: (typeof teams)[number]) => number) => r2(teams.reduce((s, x) => s + f(x), 0));
  const bilanzS2Werte = teams.map((x) => x.transferbilanzS2).filter((v): v is number => typeof v === "number");
  const zusammenfassung = {
    label: LABEL,
    gemeinsam: istTransferfensterGemeinsam(),
    saveId: SAVE,
    saisonendeVerkaeufe: summe((x) => x.saisonendeVerkaeufe),
    saisonendeVerkaufSumme: summe((x) => x.saisonendeVerkaufSumme),
    fensterVerkaeufe: summe((x) => x.fensterVerkaeufe),
    fensterVerkaufSumme: summe((x) => x.fensterVerkaufSumme),
    fensterKaeufe: summe((x) => x.fensterKaeufe),
    fensterKaufSumme: summe((x) => x.fensterKaufSumme),
    transfersZwischenKetteUndFenster: ausserhalbFenster,
    teamsS1BilanzNichtLeer: teams.filter((x) => x.transferbilanzS1 != null).length,
    bilanzS2: {
      min: quantil(bilanzS2Werte, 0),
      q25: quantil(bilanzS2Werte, 0.25),
      median: quantil(bilanzS2Werte, 0.5),
      q75: quantil(bilanzS2Werte, 0.75),
      max: quantil(bilanzS2Werte, 1),
      positiv: bilanzS2Werte.filter((v) => v > 0).length,
      negativ: bilanzS2Werte.filter((v) => v < 0).length,
    },
    kaderUnter8: teams
      .filter((x) => (x.kaderEnde ?? 0) < 8)
      .map((x) => {
        const id = ende.teamIdentities.find((i) => i.teamId === x.teamId);
        return `${x.teamId}:${x.kaderEnde} (Start ${x.kaderFensterStart}, V ${x.fensterVerkaeufe}, K ${x.fensterKaeufe}, Kasse ${x.kasseEnde}, min ${id?.playerMin ?? "?"}/opt ${id?.playerOpt ?? "?"})`;
      }),
    kaderMin: Math.min(...teams.map((x) => x.kaderEnde ?? 0)),
    kaderMedian: quantil(teams.map((x) => x.kaderEnde ?? 0), 0.5),
    kasseEndeMin: Math.min(...teams.map((x) => x.kasseEnde)),
    kasseEndeMedian: quantil(teams.map((x) => x.kasseEnde), 0.5),
    kasseEndeSumme: summe((x) => x.kasseEnde),
    negativeKassen: teams.filter((x) => x.kasseEnde < -0.01).length,
    neueKredite: neueKredite.length,
    notkredite: summe((x) => x.notkredit),
    laufWarnungen: (lauf.body.run?.warnings ?? []).filter((w) => /fenster|kassensturz|notkredit|notverkauf/.test(w)).slice(0, 20),
    laufzeitSekunden: Math.round((Date.now() - t0) / 1000),
  };
  console.log(JSON.stringify(zusammenfassung, null, 2));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ zusammenfassung, teams }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

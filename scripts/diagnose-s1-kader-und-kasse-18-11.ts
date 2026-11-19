/* eslint-disable no-console */
/**
 * DIAGNOSE "S1 OHNE DRAFT" (18.11.): liest den Stand NACH dem S1-Kaderbau aus einer Wegwerf-SQLite
 * (z. B. mit `miss-teamfinanzen-saison.ts --stop-after draft --keep` erzeugt) und schreibt
 *
 *   1) Kader-/Verteilungsmetriken je Team: Kaderstaerke (Top-6-Eignung je Disziplin, Mittel ueber alle 20),
 *      Disziplinen mit >= 1 bzw. >= 3 soliden Spielern (Eignung > 60), Superstar-Konzentration (Top-20-Spieler
 *      nach Marktwert), Gehalt, Kader, Kasse.
 *   2) WARUM BLEIBT KASSE LIEGEN: je Team wird der Planer (`planOrganicDraftForTeam`, derselbe wie im Draft) auf
 *      dem End-Zustand noch einmal befragt -- mit den Schaltern wie live (Basis) und einzeln abgeschaltet
 *      (Ruecklage V2 aus / Vorstandsbudget aus / beides aus). Kauft er in einer Abschaltung noch etwas, ist der
 *      abgeschaltete Riegel der Grund. Kauft er auch dann nichts, wird unterschieden: kein Kandidat bezahlbar
 *      (Preis + Gehalts-Puffer 0,35 x Gehalt) oder Stop-Nutzen (Halten ist dem Planer mehr wert als der beste Kauf).
 *
 * Reine Messung, keine Spiellogik geaendert. Aufruf (Wegwerf-Datei!):
 *   OLY_APP_SQLITE_PATH=/pfad/nach.sqlite npx tsx scripts/diagnose-s1-kader-und-kasse-18-11.ts <saveId> <out.json>
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { planOrganicDraftForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { ROSTER_MAX } from "@/lib/ai/organic-squad/types";
import type { Player } from "@/lib/data/olyDataTypes";
import { resolveKiRuecklageFuerTeam } from "@/lib/finance/ki-ruecklage";
import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getLeagueOf } from "@/lib/season/league-split";

const [saveId, outPfad, basisRunPfad] = process.argv.slice(2);
if (!saveId || !outPfad || !process.env.OLY_APP_SQLITE_PATH) throw new Error("Aufruf: OLY_APP_SQLITE_PATH=... tsx diagnose-... <saveId> <out.json>");

const r2 = (v: number) => Math.round(v * 100) / 100;
const SOLIDE = 60;

function mitEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const alt: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { alt[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return fn(); } finally { for (const k of Object.keys(alt)) { if (alt[k] === undefined) delete process.env[k]; else process.env[k] = alt[k]; } }
}

async function main() {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} fehlt`);
  const gs = save.gameState;
  const seasonId = gs.season.id;
  const playersById = new Map(gs.players.map((p) => [p.id, p] as const));
  const disz = (gs.disciplines ?? []).map((d) => d.id);
  const rosterJeTeam = new Map<string, Player[]>();
  for (const r of gs.rosters) {
    const p = playersById.get(r.playerId);
    if (p) (rosterJeTeam.get(r.teamId) ?? rosterJeTeam.set(r.teamId, []).get(r.teamId)!).push(p);
  }
  // Top-20 Spieler der Liga nach Marktwert (Superstar-Konzentration).
  const top20 = [...gs.players].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)).slice(0, 20).map((p) => p.id);
  const top20Set = new Set(top20);
  // Zweites Mass fuer "Superstar": Top-20 nach Spitzen-Eignung (Mittel der drei besten Disziplinwerte) -- unabhaengig vom Preis.
  const spitze = (p: Player) => Object.values(p.disciplineRatings ?? {}).sort((a, b) => b - a).slice(0, 3).reduce((x, y) => x + y, 0) / 3;
  const top20Eig = [...gs.players].sort((a, b) => spitze(b) - spitze(a)).slice(0, 20).map((p) => p.id);
  const top20EigSet = new Set(top20Eig);
  const gerostert = new Set(gs.rosters.map((r) => r.playerId));
  const top20Info = top20.map((id) => ({ mv: playersById.get(id)?.marketValue ?? null, gerostert: gerostert.has(id) }));
  const top20EigInfo = top20Eig.map((id) => ({ spitze: r2(spitze(playersById.get(id)!)), mv: playersById.get(id)?.marketValue ?? null, gerostert: gerostert.has(id) }));

  // Draft-Zeit-Ruecklage in S1: der Kader war LEER und die Kasse = Startbudget. Am End-Zustand waere Budget = Kasse + Kaderwert
  // und das Gehalts-Polster 0,35 x Gehalt des vollen Kaders -- beides zu hoch. Deshalb optional das Startbudget aus dem Lauf-JSON.
  const saison1 = /(\d+)\s*$/.exec(seasonId)?.[1] === "1";
  const start = basisRunPfad
    ? (JSON.parse(fs.readFileSync(basisRunPfad, "utf8")).phasen.s1_00_nach_anlage.snap as Record<string, { cash: number }>)
    : null;
  const leerGs = { ...gs, rosters: [] };
  const teams: Record<string, unknown>[] = [];
  const reihenfolge = gs.teams.map((t) => t.teamId);
  for (const t of gs.teams) {
    const kader = rosterJeTeam.get(t.teamId) ?? [];
    const ident = gs.teamIdentities.find((i) => i.teamId === t.teamId);
    // --- Metriken
    let staerkeSumme = 0, mind1 = 0, mind3 = 0;
    for (const d of disz) {
      const werte = kader.map((p) => p.disciplineRatings?.[d] ?? 0).sort((a, b) => b - a);
      const top = werte.slice(0, 6); while (top.length < 6) top.push(0);
      staerkeSumme += top.reduce((x, y) => x + y, 0) / 6;
      const solide = werte.filter((w) => w > SOLIDE).length;
      if (solide >= 1) mind1 += 1;
      if (solide >= 3) mind3 += 1;
    }
    const sal = kader.reduce((s, p) => s + (gs.rosters.find((r) => r.playerId === p.id && r.teamId === t.teamId)?.salary ?? 0), 0);
    const nTop20 = kader.filter((p) => top20Set.has(p.id)).length;

    // --- Planer-Sonde auf dem End-Zustand
    const fa = listLocalTransfermarktFreeAgents({ saveId, seasonId, teamId: t.teamId, mode: "ai_preview", fullPool: true }).items;
    const rosterIds = new Set(kader.map((p) => p.id));
    const kandidaten: Player[] = [];
    const preisVon = new Map<string, number>();
    for (const it of fa) {
      if (rosterIds.has(it.playerId)) continue;
      const p = playersById.get(it.playerId);
      if (p) { kandidaten.push(p); preisVon.set(p.id, (p.marketValue ?? 0) as number); }
    }
    if (teams.length === 0) {
      // Sind die Top-20 ueberhaupt im Kandidatenpool eines Teams (kaufbar), und was waere ihr Preis gegen die Kasse?
      const imPool = new Set(kandidaten.map((p) => p.id));
      top20Info.forEach((x, i) => { (x as Record<string, unknown>).imPool = imPool.has(top20[i]!); });
      top20EigInfo.forEach((x, i) => { (x as Record<string, unknown>).imPool = imPool.has(top20Eig[i]!); });
    }
    const plane = (env: Record<string, string | undefined>) =>
      mitEnv(env, () => planOrganicDraftForTeam({ gameState: gs, team: t, identity: ident, startingSquad: kader, candidates: kandidaten, draftSeed: `${saveId}:${t.teamId}` }));
    const basis = plane({});
    const ohneRueck = plane({ OLY_KI_RUECKLAGE_V2: "0" });
    const ohneVorst = plane({ OLY_VORSTAND_BUDGET: "0" });
    const ohneBeides = plane({ OLY_KI_RUECKLAGE_V2: "0", OLY_VORSTAND_BUDGET: "0" });
    const rostMax = Math.min(ROSTER_MAX, t.rosterLimit ?? ROSTER_MAX);
    // Floor zur Draft-/Kaufzeit: S1 = max(5, halbe Ruecklage aus Startbudget bei leerem Kader); S2+ = max(0,35 x Gehalt, volle Ruecklage am Ist-Stand).
    const cash0 = start?.[t.teamId]?.cash ?? null;
    const rueStart = saison1 && cash0 != null
      ? (resolveKiRuecklageFuerTeam(leerGs, t.teamId, { cash: cash0, rosterSalaryTotal: 0, rosterMarketValue: 0, finances: ident?.finances }).ruecklage * 0.5)
      : (basis.ruecklageDebug?.ruecklage ?? 0) * (saison1 ? 0.5 : 1);
    const puffer = saison1 && cash0 != null ? 5 : Math.max(5, 0.35 * sal);
    const rue = rueStart;
    const floor = Math.max(puffer, rue);
    const bezahlbarBasis = kandidaten.filter((p) => (p.marketValue ?? 0) > 0 && (t.cash ?? 0) - (p.marketValue ?? 0) >= floor).length;
    const bezahlbarOhne = kandidaten.filter((p) => (p.marketValue ?? 0) > 0 && (t.cash ?? 0) - (p.marketValue ?? 0) >= puffer).length;
    const billigster = Math.min(...kandidaten.map((p) => p.marketValue ?? 0).filter((v) => v > 0));
    let grund: string;
    if (kader.length >= rostMax) grund = "kader_voll";
    else if (bezahlbarBasis === 0 && billigster < Infinity) grund = bezahlbarOhne > 0 ? "ruecklage_bindet" : "kasse_zu_klein_auch_ohne_ruecklage";
    else if (basis.decisions.length > 0) grund = "kauft_noch";
    else if (ohneVorst.decisions.length > 0) grund = "vorstandsbudget_bindet";
    else grund = "stop_nutzen";

    teams.push({
      teamId: t.teamId, liga: getLeagueOf(gs, t.teamId), index: reihenfolge.indexOf(t.teamId),
      kader: kader.length, rosterMax: rostMax, optTarget: basis.optTarget, cash: r2(t.cash), gehalt: r2(sal),
      finanzwert: ident?.finances ?? null,
      staerke: r2(staerkeSumme / disz.length), diszMind1: mind1, diszMind3: mind3, nTop20, nTop20Eig: kader.filter((p) => top20EigSet.has(p.id)).length, maxMvImKader: Math.max(0, ...kader.map((p) => p.marketValue ?? 0)),
      cash0, ruecklage: r2(basis.ruecklageDebug?.ruecklage ?? 0), ruecklageS1: r2(rue), gehaltsPuffer: r2(puffer), floor: r2(floor), spielraumUeberFloor: r2((t.cash ?? 0) - floor),
      feeFrei: basis.vorstandDebug?.investition?.frei ?? null, gehaltFrei: basis.vorstandDebug?.gehalt?.frei ?? null,
      vorstandAnteil: basis.vorstandDebug?.anteil ?? null,
      kandidaten: kandidaten.length, billigster: r2(billigster), bezahlbarBasis, bezahlbarOhne,
      planKaeufe: { basis: basis.decisions.length, ohneRuecklage: ohneRueck.decisions.length, ohneVorstand: ohneVorst.decisions.length, ohneBeides: ohneBeides.decisions.length },
      planRestkasse: { basis: r2(basis.finalCash), ohneBeides: r2(ohneBeides.finalCash) },
      grund,
    });
  }
  fs.writeFileSync(outPfad, JSON.stringify({ saveId, seasonId, top20, top20Info, top20EigInfo, teams }));
  const z: Record<string, number> = {};
  for (const t of teams) z[t.grund as string] = (z[t.grund as string] ?? 0) + 1;
  console.log("Gruende:", z);
}

main().catch((e) => { console.error(e); process.exit(1); });

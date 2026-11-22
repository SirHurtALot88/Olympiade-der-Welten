/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GAMEPLAY-REVIEW-SONDE (22.11., docs/design/gameplay-review-22-11.md). Liest einen gespielten Stand und schreibt Kennzahlen
 * je System als JSON: PP je Disziplin-Tag (Skala C2), Ergebnisskala E1, Tabelle je Liga, Verletzung/Belastung, Form/Moral,
 * Formkarten, Training je Spieltag, Vertraege, Format-Stempel. Schreibt NICHTS in den Spielstand.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/KOPIE.sqlite OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 \
 *     npx tsx scripts/sonde-gameplay-review.ts <saveId> <ausgabe.json>
 *
 * Immer auf eine Kopie zeigen (Live-Abbild aus `live-save` oder ein Langlauf aus scripts/miss-teamfinanzen-saison.ts).
 */
import fs from "node:fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

const saveId = process.argv[2]!;
const out = process.argv[3]!;
const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) throw new Error("save fehlt");
const gs = save.gameState;
const ss = gs.seasonState as unknown as Record<string, any>;
const sid = gs.season.id;
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const q = (a: number[], p: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]!; };
const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
const lg: Record<string, string> = ss.leagueByTeamId ?? {};

// 1) PP
const ledger = buildSeasonPointsLedger(gs, sid);
const zellen = new Map<string, number[]>();
const spielerSumme = new Map<string, number>();
for (const e of ledger.pointEntries as any[]) {
  const k = `${e.matchdayId}|${e.disciplineId}`;
  (zellen.get(k) ?? zellen.set(k, []).get(k)!).push(Number(e.basePoints ?? 0));
  spielerSumme.set(e.playerId, (spielerSumme.get(e.playerId) ?? 0) + Number(e.basePoints ?? 0));
}
const ppJeDiszi: Record<string, any> = {};
const tmp: Record<string, { tops: number[]; fuenfer: number[]; alle: number[]; zweiter: number[] }> = {};
for (const [k, v] of zellen) {
  const d = k.split("|")[1]!;
  const t = (tmp[d] ??= { tops: [], fuenfer: [], alle: [], zweiter: [] });
  const s = [...v].sort((a, b) => b - a);
  t.tops.push(s[0] ?? 0);
  t.zweiter.push(s[1] ?? 0);
  t.fuenfer.push(v.filter((x) => x >= 4.95).length);
  t.alle.push(...v);
}
for (const [d, t] of Object.entries(tmp)) {
  ppJeDiszi[d] = {
    tage: t.tops.length,
    topMedian: r2(med(t.tops)), topMin: r2(Math.min(...t.tops)), topMax: r2(Math.max(...t.tops)),
    zweiterMedian: r2(med(t.zweiter)),
    tageMitTopUnter4: t.tops.filter((x) => x < 4).length,
    fuenferJeTagMittel: r2(t.fuenfer.reduce((a, b) => a + b, 0) / t.fuenfer.length),
    tageMit3PlusFuenfern: t.fuenfer.filter((x) => x >= 3).length,
    einsatzMedian: r2(med(t.alle)), einsaetze: t.alle.length,
  };
}
const saisonSummen = [...spielerSumme.values()].sort((a, b) => b - a);

// 2) E1 / Ergebnisse
const dr = (ss.disciplineResults ?? []) as any[];
const e1: Record<string, any> = {};
const e1tmp: Record<string, { w: number[]; l: number[]; d: number[]; zehnNull: number; remis: number; n: number; quelle: string }> = {};
for (const r of dr) {
  const en = r.ergebnisNormiert as [number, number] | undefined;
  if (!en) continue;
  const t = (e1tmp[r.disciplineId] ??= { w: [], l: [], d: [], zehnNull: 0, remis: 0, n: 0, quelle: String(r.pointSource) });
  t.n += 1;
  if (en[0] === en[1]) t.remis += 1;
  if (en[0] > en[1]) { t.w.push(en[0]); t.l.push(en[1]); t.d.push(en[0] - en[1]); if (en[0] === 10 && en[1] === 0) t.zehnNull += 1; }
}
for (const [d, t] of Object.entries(e1tmp)) {
  e1[d] = { zeilen: t.n, quelle: t.quelle, siegMedian: `${med(t.w)}:${med(t.l)}`, abstandMedian: med(t.d), abstandP90: q(t.d, 0.9), anteil10zu0: r2(t.zehnNull / Math.max(1, t.w.length)), remisZeilen: t.remis };
}
const pods = dr.filter((r) => !r.ergebnisNormiert).reduce((m: Record<string, number>, r) => { m[`${r.disciplineId}:${r.pointSource}`] = (m[`${r.disciplineId}:${r.pointSource}`] ?? 0) + 1; return m; }, {});

// 3) Tabelle
const st = ss.standings ?? {};
const tabelle: Record<string, any[]> = {};
for (const [t, v] of Object.entries<any>(st)) (tabelle[lg[t] ?? "?"] ??= []).push({ t, p: v.points, v: v.verhaeltnis, rank: v.rank });
for (const L of Object.keys(tabelle)) tabelle[L]!.sort((a, b) => b.p - a.p || b.v - a.v);

// 4) Verletzung / Belastung
const inj = (ss.injuryEvents ?? []) as any[];
const jeSpieltag: Record<string, number> = {};
for (const e of inj) if (e.result === "injured") jeSpieltag[e.matchdayId] = (jeSpieltag[e.matchdayId] ?? 0) + 1;
const fb = inj.map((e) => Number(e.fatigueBefore ?? 0));
const verletzung = {
  wuerfe: inj.length, verletzt: inj.filter((e) => e.result === "injured").length, jeSpieltag,
  fatigueMedian: r2(med(fb)), fatigueP90: r2(q(fb, 0.9)), anteilUeber65: r2(fb.filter((x) => x >= 65).length / Math.max(1, fb.length)),
  belastungsPause: ss.belastungsPause ? { nach: ss.belastungsPause.nachMatchdayId, eintraege: (ss.belastungsPause.eintraege ?? []).length } : null,
};

// 5) Form / Moral
const form = ((gs as any).playerFormState ?? []).map((f: any) => Number(f.form));
const moral = ((gs as any).playerMoraleState ?? []).map((m: any) => Number(m.morale));
const formMoral = {
  formN: form.length, formMin: r2(Math.min(...form)), formP10: r2(q(form, 0.1)), formMedian: r2(med(form)), formP90: r2(q(form, 0.9)), formMax: r2(Math.max(...form)),
  moralN: moral.length, moralP10: r2(q(moral, 0.1)), moralMedian: r2(med(moral)), moralP90: r2(q(moral, 0.9)),
  moralStufen: moral.reduce((m: Record<string, number>, x: number) => { const k = x >= 80 ? "sehr" : x >= 60 ? "zufr" : x >= 40 ? "neutral" : x >= 20 ? "unzufr" : "veraergert"; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
};

// 6) Formkarten
const karten = (ss.formCards ?? []) as any[];
const plaene = (ss.formCardPlans ?? []) as any[];
const formkarten = {
  karten: karten.length,
  werte: karten.reduce((m: Record<string, number>, k) => { m[String(k.cardValue)] = (m[String(k.cardValue)] ?? 0) + 1; return m; }, {}),
  plaene: plaene.length,
  plaeneMitKarte: plaene.filter((p) => p.primaryFormCardId).length,
  teamsMitPlan: new Set(plaene.map((p) => p.teamId)).size,
};

// 7) Training
let mitVerlauf = 0, eintraege = 0, verletztEintraege = 0, zuwachsSumme = 0, quelleK = 0, quelleM = 0;
const zuwachsJeTeam: Record<string, number> = {};
const teamOf = new Map(gs.rosters.map((r) => [r.playerId, r.teamId]));
const ATTR = ["power","health","stamina","intelligence","awareness","determination","speed","dexterity","charisma","will","spirit","torment"];
for (const p of gs.players as any[]) {
  const v = p.seasonTrainingAccumulator?.verlauf as any[] | undefined;
  if (!v?.length) continue;
  mitVerlauf += 1;
  for (const e of v) {
    eintraege += 1;
    if (e.s === "v") verletztEintraege += 1;
    if (e.q === "k") quelleK += 1; if (e.q === "m") quelleM += 1;
    const z = Object.values(e.z ?? {}).reduce((a: number, b: any) => a + Number(b), 0) as number;
    zuwachsSumme += z;
    const t = teamOf.get(p.id) ?? "frei";
    zuwachsJeTeam[t] = (zuwachsJeTeam[t] ?? 0) + z;
  }
}
const kaderSpieler = gs.players.filter((p) => teamOf.has(p.id)) as any[];
const attrSumme = (p: any) => ATTR.reduce((a, k) => a + Number(p.attributeSheetStats?.[k] ?? 0), 0);
const training = {
  spielerMitVerlauf: mitVerlauf, eintraege, verletztEintraege, zuwachsSumme: r2(zuwachsSumme), zuwachsJeEintrag: r2(zuwachsSumme / Math.max(1, eintraege)),
  quelleKI: quelleK, quelleManager: quelleM,
  zuwachsJeTeamMin: r2(Math.min(...Object.values(zuwachsJeTeam))), zuwachsJeTeamMax: r2(Math.max(...Object.values(zuwachsJeTeam))),
  attributSummeKaderMittel: r2(kaderSpieler.reduce((a, p) => a + attrSumme(p), 0) / Math.max(1, kaderSpieler.length)),
  attributSummeAlleMittel: r2((gs.players as any[]).reduce((a, p) => a + attrSumme(p), 0) / gs.players.length),
  ratingKaderMittel: r2(kaderSpieler.reduce((a, p) => a + Number(p.rating ?? 0), 0) / Math.max(1, kaderSpieler.length)),
  marktwertKaderMittel: r2(kaderSpieler.reduce((a, p) => a + Number(p.marketValue ?? 0), 0) / Math.max(1, kaderSpieler.length)),
  kaderSpieler: kaderSpieler.length, spielerGesamt: gs.players.length,
};

// 8) Stempel
const stempel = {
  wertungsSkalen: ss.wertungsSkalen, battlefieldFormat: ss.battlefieldFormat, hockeyTorwart: ss.hockeyTorwart, basketballPuste: ss.basketballPuste,
  climbingFormat: ss.climbingFormat, finanzenJeSpieltag: ss.finanzenJeSpieltag, belastungsRegel: ss.belastungsRegel ?? ss.belastungsRegelVersion ?? null,
};

// 8b) Vertraege: In-Saison-Verlaengerungen, Laufzeiten
const inSaison = (gs.rosters as any[]).filter((r) => r.inSaisonVerlaengerung?.seasonId === sid);
const vertraege = {
  inSaisonVerlaengerungen: inSaison.length, teamsMitInSaison: new Set(inSaison.map((r) => r.teamId)).size,
  laufzeiten: (gs.rosters as any[]).reduce((m: Record<string, number>, r) => { m[String(r.contractLength)] = (m[String(r.contractLength)] ?? 0) + 1; return m; }, {}),
  kaderMin: Math.min(...gs.teams.map((t) => gs.rosters.filter((r) => r.teamId === t.teamId).length)),
  kaderMax: Math.max(...gs.teams.map((t) => gs.rosters.filter((r) => r.teamId === t.teamId).length)),
};

// 9) Verfuegbarkeit jetzt
const avail = (ss.playerAvailabilityState ?? []) as any[];

fs.writeFileSync(out, JSON.stringify({
  saveId, sid, matchday: gs.matchdayState.matchdayId, phase: gs.gamePhase,
  ppJeDiszi, ppSaisonSummeTop5: saisonSummen.slice(0, 5).map(r2), ppSaisonSummeMedian: r2(med(saisonSummen)),
  e1, pods, tabelle, verletzung, formMoral, formkarten, training, stempel, vertraege,
  verfuegbarkeit: avail.reduce((m: Record<string, number>, a) => { m[a.injuryStatus] = (m[a.injuryStatus] ?? 0) + 1; return m; }, {}),
  ledgerWarnungen: (ledger as any).warnings?.slice(0, 5),
}, null, 1));
console.log("ok", out);

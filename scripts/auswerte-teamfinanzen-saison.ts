/* eslint-disable no-console */
/**
 * Auswertung der Rohlaeufe von `scripts/miss-teamfinanzen-saison.ts`.
 *
 *   npx tsx scripts/auswerte-teamfinanzen-saison.ts <lauf-A.json> [<lauf-B.json> ...] --out data/generated/finanzen-ist-messung-18-11.json
 *
 * Schreibt die verdichteten Zahlen (je Lauf, Saison, Liga: Min/Median/Max/Summe) als JSON und druckt
 * die Markdown-Tabellen fuer docs/design/finanzen-ist-messung-18-11.md auf stdout.
 */
import fs from "node:fs";

import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";

type Snap = {
  teamId: string; liga: string | null; rank: number | null; cash: number; budget: number; kader: number;
  gehaltIst: number; gehaltVerhandelt: number; marktwert: number; gebaeude: { id: string; stufe: number }[];
  gebaeudeUnterhalt: number; schuld: number; kreditZins: number; kreditRate: number;
};
type Phase = Record<string, any>;
type Lauf = { label: string; mode: string; saveId: string; phasen: Record<string, Phase>; laufzeitSekunden?: number; ligaAssignment: Record<string, string> };

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && i !== outIdx + 1);

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
function stat(a: number[]) {
  if (a.length === 0) return { n: 0, min: 0, median: 0, max: 0, summe: 0, mittel: 0 };
  const s = [...a].sort((x, y) => x - y);
  const m = s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  return { n: s.length, min: r1(s[0]!), median: r1(m), max: r1(s[s.length - 1]!), summe: r1(sum(s)), mittel: r1(sum(s) / s.length) };
}
const fmt = (s: ReturnType<typeof stat>) => `${s.min} / ${s.median} / ${s.max}`;
function corr(x: number[], y: number[]) {
  const n = x.length; if (n < 3) return 0;
  const mx = sum(x) / n, my = sum(y) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; }
  return sxx && syy ? r2(sxy / Math.sqrt(sxx * syy)) : 0;
}

const LIGEN = ["liga1", "liga2", "gesamt"] as const;
const inLiga = (t: Snap, l: string) => l === "gesamt" || t.liga === l;
const snaps = (p: Phase | undefined): Snap[] => (p?.snap ? (Object.values(p.snap) as Snap[]) : []);

function posten(guvTeam: any, key: string): number {
  const p = (guvTeam?.guv?.posten as { key: string; amount: number }[] | undefined)?.find((x) => x.key === key);
  return p ? p.amount : 0;
}

const ergebnis: Record<string, unknown> = { erzeugt: new Date().toISOString(), laeufe: {}, gebaeudeKatalog: FACILITY_CATALOG.map((c) => ({ id: c.facilityId, label: c.label, stufen: c.levels.map((l) => ({ stufe: l.level, kosten: l.upgradeCost, unterhalt: l.seasonUpkeep, einnahme: l.seasonIncome ?? 0 })) })) };
const katalog = new Map(FACILITY_CATALOG.map((c) => [c.facilityId as string, c]));
function investSumme(g: { id: string; stufe: number }[]) { return g.reduce((sm, x) => sm + (katalog.get(x.id)?.levels.filter((l) => l.level <= x.stufe).reduce((q, l) => q + l.upgradeCost, 0) ?? 0), 0); }
const md: string[] = [];

for (const f of files) {
  const lauf = JSON.parse(fs.readFileSync(f, "utf8")) as Lauf;
  const L = lauf.label;
  const out: Record<string, unknown> = { label: L, mode: lauf.mode, saveId: lauf.saveId, laufzeitSekunden: lauf.laufzeitSekunden ?? null, saisons: {} };
  (ergebnis.laeufe as Record<string, unknown>)[L] = out;
  const keys = Object.keys(lauf.phasen);
  const saisons = [...new Set(keys.map((k) => /^s(\d+)_/.exec(k)?.[1]).filter(Boolean))] as string[];

  // Liga-Zuordnung bleibt die der Saison 1 (Auf-/Abstieg erst nach der Saison)
  const ligaVon = (id: string, fallback: string | null) => lauf.ligaAssignment[id] ?? fallback;
  void ligaVon;

  // ---- Start (nach Draft)
  const draft = snaps(lauf.phasen["s1_01_nach_draft"]);
  const anlage = snaps(lauf.phasen["s1_00_nach_anlage"]);
  const start: Record<string, unknown> = {};
  for (const l of LIGEN) {
    const d = draft.filter((t) => inLiga(t, l)); const a = anlage.filter((t) => inLiga(t, l));
    start[l] = {
      startBudget: stat(a.map((t) => t.cash)), kasseNachDraft: stat(d.map((t) => t.cash)), kader: stat(d.map((t) => t.kader)),
      gehaltIst: stat(d.map((t) => t.gehaltIst)), marktwert: stat(d.map((t) => t.marktwert)),
      ausgegeben: stat(d.map((t) => { const x = anlage.find((q) => q.teamId === t.teamId); return (x?.cash ?? 0) - t.cash; })),
      teamsImMinus: d.filter((t) => t.cash < 0).length,
    };
  }
  out.start = start;

  for (const sn of saisons) {
    const P = (suffix: string) => keys.find((k) => k.startsWith(`s${sn}_${suffix}`));
    const get = (suffix: string) => { const k = P(suffix); return k ? lauf.phasen[k] : undefined; };
    const startP = get("02_saisonstart");
    const endeSpiele = get("03_nach_spieltagen");
    const nachAbschluss = get("04_nach_abschluss");
    const endeKette = get("06_ende_kette");
    const vorKauf = get("00_vor_kaufphase");
    const nachKauf = get("01_nach_kaufphase");
    const s: Record<string, unknown> = {};
    (out.saisons as Record<string, unknown>)[sn] = s;
    s.phasenVorhanden = keys.filter((k) => k.startsWith(`s${sn}_`));

    const S0 = snaps(startP);
    if (S0.length) {
      const je: Record<string, unknown> = {};
      for (const l of LIGEN) {
        const a = S0.filter((t) => inLiga(t, l));
        je[l] = {
          kasseSaisonstart: stat(a.map((t) => t.cash)), kader: stat(a.map((t) => t.kader)),
          gehaltIst: stat(a.map((t) => t.gehaltIst)), gehaltVerhandelt: stat(a.map((t) => t.gehaltVerhandelt)),
          gehaltJeSpieltag: stat(a.map((t) => t.gehaltIst / 20)),
          marktwert: stat(a.map((t) => t.marktwert)), gebaeudeTeams: a.filter((t) => t.gebaeude.length > 0).length,
          gebaeudeUnterhalt: stat(a.map((t) => t.gebaeudeUnterhalt)), schuld: stat(a.map((t) => t.schuld)),
          kreditZins: stat(a.map((t) => t.kreditZins)), teamsImMinus: a.filter((t) => t.cash < 0).length,
        };
      }
      s.saisonstart = je;
    }

    if (vorKauf && nachKauf) {
      const V = snaps(vorKauf), N = snaps(nachKauf);
      const je: Record<string, unknown> = {};
      for (const l of LIGEN) {
        const v = V.filter((t) => inLiga(t, l)); const n = N.filter((t) => inLiga(t, l));
        const tb = nachKauf.transfers?.byTeam ?? {};
        je[l] = {
          kasseVorKauf: stat(v.map((t) => t.cash)), kasseNachKauf: stat(n.map((t) => t.cash)),
          kaufAusgaben: stat(n.map((t) => tb[t.teamId]?.kaufSumme ?? 0)), kaeufe: stat(n.map((t) => tb[t.teamId]?.kaeufe ?? 0)),
          ablaufErloes: stat(n.map((t) => tb[t.teamId]?.ablaufErloes ?? 0)), verkaufNetto: stat(n.map((t) => tb[t.teamId]?.verkaufNetto ?? 0)),
          kaderVor: stat(v.map((t) => t.kader)), kaderNach: stat(n.map((t) => t.kader)),
          gehaltVor: stat(v.map((t) => t.gehaltIst)), gehaltNach: stat(n.map((t) => t.gehaltIst)),
          teamsImMinusVor: v.filter((t) => t.cash < 0).length, teamsImMinusNach: n.filter((t) => t.cash < 0).length,
          minusTeamsNach: n.filter((t) => t.cash < 0).map((t) => ({ team: t.teamId, liga: t.liga, cash: t.cash, gehalt: t.gehaltIst })),
          geldmengeVor: r1(sum(v.map((t) => t.cash))), geldmengeNach: r1(sum(n.map((t) => t.cash))),
          gebaeudeInvestGeschaetzt: stat(n.map((t) => investSumme(t.gebaeude) - investSumme(v.find((q) => q.teamId === t.teamId)?.gebaeude ?? []))),
          gebaeudeTeamsNach: n.filter((t) => t.gebaeude.length > 0).length,
          kasseAbnahme: stat(n.map((t) => (v.find((q) => q.teamId === t.teamId)?.cash ?? 0) - t.cash)),
          schuldNach: stat(n.map((t) => t.schuld)), teamsMitKredit: n.filter((t) => t.schuld > 0).length,
        };
      }
      s.kaufphase = je;
      s.kaufphaseLauf = { status: nachKauf.lauf?.status, kaeufe: nachKauf.lauf?.transferBuysApplied, verkaeufe: nachKauf.lauf?.transferSellsApplied, warnungen: nachKauf.lauf?.warnings };
    }

    // Kassenverlauf waehrend der Saison
    const kj: Record<string, number[]> | undefined = endeSpiele?.kasseJeSpieltag;
    if (kj && S0.length) {
      const bewegung = S0.map((t) => {
        const reihe = kj[t.teamId] ?? [];
        const deltas = reihe.map((c, i) => c - (i === 0 ? t.cash : reihe[i - 1]!));
        return { team: t.teamId, liga: t.liga, start: t.cash, ende: reihe[reihe.length - 1] ?? t.cash, nonzero: deltas.filter((d) => Math.abs(d) > 0.005).length, spanne: reihe.length ? Math.max(...reihe) - Math.min(...reihe) : 0 };
      });
      s.waehrendDerSaison = {
        spieltage: Object.values(kj)[0]?.length ?? 0,
        teamsMitKassenbewegung: bewegung.filter((b) => b.nonzero > 0).length,
        deltaStartEnde: stat(bewegung.map((b) => b.ende - b.start)),
        geldmengeStart: r1(sum(bewegung.map((b) => b.start))), geldmengeNachSpieltagen: r1(sum(bewegung.map((b) => b.ende))),
        jeSpieltagSumme: (() => { const n = Object.values(kj)[0]?.length ?? 0; return Array.from({ length: n }, (_, i) => r1(sum(Object.values(kj).map((r) => r[i] ?? 0)))); })(),
      };
    }

    // GuV + Kasse nach Abschluss
    const startCashOf = (id: string) => S0.find((t) => t.teamId === id)?.cash ?? 0;
    const G: Record<string, any> | undefined = nachAbschluss?.guv;
    const A = snaps(nachAbschluss);
    if (G && A.length) {
      const je: Record<string, unknown> = {};
      for (const l of LIGEN) {
        const a = A.filter((t) => inLiga(t, l));
        const g = (t: Snap) => G[t.teamId];
        const einn = (t: Snap) => g(t)?.guv?.einnahmen ?? 0;
        const sponsor = a.map((t) => posten(g(t), "sponsor"));
        const gehalt = a.map((t) => -posten(g(t), "gehaelter"));
        const startCash = new Map(S0.map((t) => [t.teamId, t.cash]));
        je[l] = {
          sponsor: stat(sponsor), gehalt: stat(gehalt), guv: stat(a.map((t) => g(t)?.guv?.guv ?? 0)),
          einnahmenGesamt: stat(a.map(einn)),
          gehaltAnteilAnEinnahmen: stat(a.filter((t) => einn(t) > 10).map((t) => (einn(t) > 0 ? (-posten(g(t), "gehaelter")) / einn(t) * 100 : 0))),
          kasseSaisonende: stat(a.map((t) => t.cash)),
          kasseSaisonstart: stat(a.map((t) => startCash.get(t.teamId) ?? 0)),
          geldmengeStart: r1(sum(a.map((t) => startCash.get(t.teamId) ?? 0))), geldmengeEnde: r1(sum(a.map((t) => t.cash))),
          teamsImMinus: a.filter((t) => t.cash < 0).length,
          teamsGehaltUeberSponsor: a.filter((t, i) => gehalt[i]! > sponsor[i]!).length,
        };
      }
      s.abschluss = je;

      // Sponsor/Gehalt je Team und Gehalt vs. Cash-Entwicklung
      const verh = A.map((t) => ({ t, sp: posten(G[t.teamId], "sponsor"), geh: -posten(G[t.teamId], "gehaelter"), guv: G[t.teamId]?.guv?.guv ?? 0, d0: startCashOf(t.teamId) }));
      const mitSponsor = verh.filter((v) => v.sp > 0);
      s.sponsorGehaltVerhaeltnis = Object.fromEntries(LIGEN.map((l) => {
        const a = mitSponsor.filter((v) => inLiga(v.t, l));
        return [l, { verhaeltnis: stat(a.map((v) => r2(v.sp / v.geh))), teamsUnter1: a.filter((v) => v.sp < v.geh).length, teamsOhneSponsor: verh.filter((v) => inLiga(v.t, l) && v.sp <= 0).map((v) => v.t.teamId) }];
      }));
      const nachGehalt = [...verh].sort((x, y) => y.geh - x.geh);
      const viertel = Math.ceil(nachGehalt.length / 4);
      s.gehaltsViertel = [0, 1, 2, 3].map((q) => {
        const grp = nachGehalt.slice(q * viertel, (q + 1) * viertel);
        return { viertel: q + 1, gehaltMittel: r1(sum(grp.map((v) => v.geh)) / grp.length), sponsorMittel: r1(sum(grp.map((v) => v.sp)) / grp.length), guvMittel: r1(sum(grp.map((v) => v.guv)) / grp.length), kasseEndeMittel: r1(sum(grp.map((v) => v.t.cash)) / grp.length), teamsImMinus: grp.filter((v) => v.t.cash < 0).length, n: grp.length };
      });
      s.korrelationGehalt = { gehaltGuv: corr(verh.map((v) => v.geh), verh.map((v) => v.guv)), gehaltKasseEnde: corr(verh.map((v) => v.geh), verh.map((v) => v.t.cash)), ohneSponsorloses: corr(mitSponsor.map((v) => v.geh), mitSponsor.map((v) => v.guv)) };
      // Posten-Summen
      const keysP = ((Object.values(G)[0] as any)?.guv?.posten as { key: string; label: string }[] | undefined)?.map((p) => ({ key: p.key, label: p.label })) ?? [];
      s.guvPosten = keysP.map((pk) => {
        const row: Record<string, unknown> = { key: pk.key, label: pk.label };
        for (const l of LIGEN) { const a = A.filter((t) => inLiga(t, l)); row[l] = stat(a.map((t) => posten(G[t.teamId], pk.key))); }
        return row;
      });
      // nach Rang (Gruppen je 4 in Liga, je 8 gesamt)
      const rangRows = A.filter((t) => t.rank != null).sort((x, y) => x.rank! - y.rank!);
      const gruppen: Record<string, unknown>[] = [];
      for (let i = 0; i < rangRows.length; i += 8) {
        const grp = rangRows.slice(i, i + 8);
        gruppen.push({
          raenge: `${grp[0]!.rank}-${grp[grp.length - 1]!.rank}`, kasseEnde: r1(sum(grp.map((t) => t.cash)) / grp.length),
          sponsor: r1(sum(grp.map((t) => posten(G[t.teamId], "sponsor"))) / grp.length),
          gehalt: r1(sum(grp.map((t) => posten(G[t.teamId], "gehaelter"))) / grp.length),
          guv: r1(sum(grp.map((t) => G[t.teamId]?.guv?.guv ?? 0)) / grp.length),
        });
      }
      s.nachRangGruppen = gruppen;
      s.korrelation = {
        rangKasse: corr(rangRows.map((t) => t.rank!), rangRows.map((t) => t.cash)),
        rangGuv: corr(rangRows.map((t) => t.rank!), rangRows.map((t) => G[t.teamId]?.guv?.guv ?? 0)),
        budgetGehalt: corr(S0.map((t) => t.budget), S0.map((t) => t.gehaltIst)),
      };
      s.nachRangProTeam = rangRows.map((t) => ({
        rang: t.rank, team: t.teamId, liga: t.liga, kasseEnde: t.cash, sponsor: posten(G[t.teamId], "sponsor"),
        gehalt: posten(G[t.teamId], "gehaelter"), guv: G[t.teamId]?.guv?.guv ?? 0,
      }));
    }

    // Geldmengen-Zeitleiste dieser Saison (Summe/Median/Min je Liga)
    const zeitleiste = keys.filter((k) => k.startsWith(`s${sn}_`) && lauf.phasen[k]?.snap).map((k) => {
      const a = snaps(lauf.phasen[k]);
      const row: Record<string, unknown> = { phase: k };
      for (const l of LIGEN) { const x = a.filter((t) => inLiga(t, l)); row[l] = { summe: r1(sum(x.map((t) => t.cash))), median: stat(x.map((t) => t.cash)).median, min: stat(x.map((t) => t.cash)).min, max: stat(x.map((t) => t.cash)).max, imMinus: x.filter((t) => t.cash < 0).length, kader: sum(x.map((t) => t.kader)), gehalt: r1(sum(x.map((t) => t.gehaltIst))) }; }
      return row;
    });
    s.zeitleiste = zeitleiste;
    if (endeKette) {
      const E = snaps(endeKette);
      s.endeKette = {
        phase: endeKette.phase, hops: endeKette.hops, geldmenge: r1(sum(E.map((t) => t.cash))),
        kasse: { liga1: stat(E.filter((t) => t.liga === "liga1").map((t) => t.cash)), liga2: stat(E.filter((t) => t.liga === "liga2").map((t) => t.cash)), gesamt: stat(E.map((t) => t.cash)) },
        teamsImMinus: E.filter((t) => t.cash < 0).length,
      };
    }
  }
}

if (OUT) fs.writeFileSync(OUT, JSON.stringify(ergebnis, null, 1));
console.log(JSON.stringify(ergebnis, null, 1).slice(0, 200000));
void md;

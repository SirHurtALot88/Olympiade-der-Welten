/* eslint-disable no-console */
/**
 * Auswertung der Laeufe von `scripts/miss-teamfinanzen-saison.ts` fuer die GuV-/Saison-Faktor-Messung (22.11.).
 *
 *   npx tsx scripts/auswerte-guv-saisonfaktor.ts <basis.json> [<variante.json>] [--out data/generated/guv-saisonfaktor-22-11.json]
 *
 * Je Lauf, Saison, Liga und Budget-Quartil: Teams mit operativer GuV >= 0, Min/Median/Max, Posten-Mittel, Kasse. Mit zwei
 * Laeufen zusaetzlich der Vergleich Variante gegen Basis. Druckt Markdown-Tabellen auf stdout.
 */
import fs from "node:fs";

type Snap = { teamId: string; liga: string | null; rank: number | null; cash: number; budget: number; kader: number; gehaltIst: number; staerke: number; schuld: number };
type Lauf = { label: string; phasen: Record<string, any>; ligaAssignment: Record<string, string> };

const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const OUT = oi >= 0 ? args[oi + 1]! : null;
const files = args.filter((a, i) => !a.startsWith("--") && i !== oi + 1);

const r1 = (v: number) => Math.round(v * 10) / 10;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
function med(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
}
const mmm = (a: number[]) => (a.length ? `${r1(Math.min(...a))} / ${r1(med(a))} / ${r1(Math.max(...a))}` : "-");
const snaps = (p: any): Snap[] => (p?.snap ? (Object.values(p.snap) as Snap[]) : []);
const posten = (g: any, key: string): number => g?.guv?.posten?.find((x: any) => x.key === key)?.amount ?? 0;

const POSTEN = [
  ["sponsor", "Sponsor (Sockel + Rangpraemie)"],
  ["sponsorereignisse", "Sponsor-Ereignisse"],
  ["gebaeude_einnahme", "Gebaeude-Einnahmen"],
  ["apron", "Apron (netto)"],
  ["boardziele", "Vorstandsziele"],
  ["gehaelter", "Gehaelter"],
  ["gebaeude_unterhalt", "Gebaeude-Unterhalt"],
  ["kreditzins", "Kreditzins"],
  ["kredittilgung", "Kredit-Tilgung (keine GuV)"],
  ["transfers", "Transfers netto (keine GuV)"],
] as const;

type Zeile = {
  teamId: string; liga: string; budgetRang: number; quartil: number; rang: number | null;
  einnahmen: number; ausgaben: number; guv: number; guvMitTransfers: number; posten: Record<string, number>;
  /** Kassenbewegung der Kaufphase VOR der Saison (S1: Draft; ab S2: KI-Kaufphase), negativ = ausgegeben. */
  kaufphase: number;
  /** Rest der Kasse zwischen Saisonstart und Abschluss, der nicht in der GuV steht (Tilgung, Abweichungen). */
  restNichtGuv: number;
  /** Saisonende-Kette (Verkaeufe, Vertragsende, Abgaenge, Nachkaeufe) bis zum Start der Folgesaison bzw. Ende der Kette. */
  kette: number;
  kasseVorKaufphase: number; kasseStart: number; kasseSaisonende: number; kasseEnde: number;
  kaderStart: number; staerkeStart: number; staerkeEnde: number; gehalt: number; schuld: number;
};

function zeilen(lauf: Lauf, sn: string): Zeile[] {
  const P = lauf.phasen;
  const keys = Object.keys(P);
  const k = (n: string, suffix: string) => keys.find((x) => x.startsWith(`s${n}_${suffix}`));
  const ab = P[k(sn, "04_nach_abschluss") ?? ""];
  const ende = P[k(sn, "06_ende_kette") ?? ""];
  const st = P[k(sn, "02_saisonstart") ?? ""];
  if (!ab?.guv || !ende) return [];
  const naechsteVor = P[k(String(Number(sn) + 1), "00_vor_kaufphase") ?? ""];
  const vor = sn === "1" ? P["s1_00_nach_anlage"] : P[k(sn, "00_vor_kaufphase") ?? ""];
  const anlage = snaps(P["s1_00_nach_anlage"]);
  const budgetRang = new Map([...anlage].sort((a, b) => b.budget - a.budget || a.teamId.localeCompare(b.teamId)).map((t, i) => [t.teamId, i + 1] as const));
  const V = new Map(snaps(vor).map((t) => [t.teamId, t]));
  const S0 = new Map(snaps(st).map((t) => [t.teamId, t]));
  const E = new Map(snaps(ende).map((t) => [t.teamId, t]));
  const A = new Map(snaps(ab).map((t) => [t.teamId, t]));
  const N = new Map(snaps(naechsteVor).map((t) => [t.teamId, t]));
  return Object.keys(ab.guv).map((id) => {
    const g = ab.guv[id];
    const br = budgetRang.get(id) ?? 99;
    const p: Record<string, number> = {};
    for (const [key] of POSTEN) p[key] = posten(g, key);
    const kasseStart = S0.get(id)?.cash ?? 0;
    const kasseVor = V.get(id)?.cash ?? kasseStart;
    const kasseAb = A.get(id)?.cash ?? 0;
    const kasseEnde = (N.get(id) ?? E.get(id))?.cash ?? kasseAb;
    const kaufphase = kasseStart - kasseVor;
    return {
      teamId: id, liga: lauf.ligaAssignment[id] ?? "?", budgetRang: br, quartil: Math.min(4, Math.ceil(br / 8)), rang: A.get(id)?.rank ?? null,
      einnahmen: g.guv.einnahmen, ausgaben: g.guv.ausgaben, guv: g.guv.guv, guvMitTransfers: g.guv.guv + kaufphase, posten: p,
      kaufphase, restNichtGuv: kasseAb - kasseStart - g.guv.guv, kette: kasseEnde - kasseAb,
      kasseVorKaufphase: kasseVor, kasseStart, kasseSaisonende: kasseAb, kasseEnde,
      kaderStart: S0.get(id)?.kader ?? 0, staerkeStart: S0.get(id)?.staerke ?? 0, staerkeEnde: E.get(id)?.staerke ?? 0,
      gehalt: S0.get(id)?.gehaltIst ?? 0, schuld: E.get(id)?.schuld ?? 0,
    };
  });
}

const md: string[] = [];
const ergebnis: Record<string, any> = { erzeugt: new Date().toISOString(), laeufe: {} };
const gruppen: [string, (z: Zeile) => boolean][] = [
  ["Liga 1", (z) => z.liga === "liga1"], ["Liga 2", (z) => z.liga === "liga2"], ["gesamt", () => true],
  ["Q1 (Budget-Rang 1-8)", (z) => z.quartil === 1], ["Q2 (9-16)", (z) => z.quartil === 2], ["Q3 (17-24)", (z) => z.quartil === 3], ["Q4 (25-32)", (z) => z.quartil === 4],
];

for (const f of files) {
  const lauf = JSON.parse(fs.readFileSync(f, "utf8")) as Lauf;
  const L = lauf.label;
  const out: Record<string, any> = {};
  ergebnis.laeufe[L] = out;
  const saisons = [...new Set(Object.keys(lauf.phasen).map((k) => /^s(\d+)_/.exec(k)?.[1]).filter(Boolean))] as string[];
  const anlage = snaps(lauf.phasen["s1_00_nach_anlage"]);
  const draft = snaps(lauf.phasen["s1_01_nach_draft"]);
  out.start = { budgetSumme: r1(sum(anlage.map((t) => t.budget))), kasseNachDraftSumme: r1(sum(draft.map((t) => t.cash))), kaderMittel: r1(mean(draft.map((t) => t.kader))), staerkeMittel: r1(mean(draft.map((t) => t.staerke))), imMinusNachDraft: draft.filter((t) => t.cash < 0).length };
  md.push(`\n## Lauf ${L}\n`, `Startbudget Summe ${out.start.budgetSumme} C; nach Draft: Kasse Summe ${out.start.kasseNachDraftSumme}, Kader Ø ${out.start.kaderMittel}, Staerke (Top-6) Ø ${out.start.staerkeMittel}, ${out.start.imMinusNachDraft} Teams im Minus.\n`);
  for (const sn of saisons) {
    const Z = zeilen(lauf, sn);
    if (!Z.length) continue;
    const o: Record<string, any> = (out[`saison${sn}`] = {});
    md.push(`\n### ${L}, Saison ${sn}: operative GuV (ohne Transfers) und mit Transfers\n`);
    md.push("| Gruppe | n | GuV >= 0 | GuV < 0 | operative GuV min/med/max | GuV + Kaufphase >= 0 | GuV + Kaufphase min/med/max | Kasse Saisonende min/med/max | im Minus (Saisonende / nach Kette) |", "|---|---:|---:|---:|---|---:|---|---|---:|");
    for (const [name, fn] of gruppen) {
      const g = Z.filter(fn);
      const row = {
        n: g.length, guvPlus: g.filter((z) => z.guv >= 0).length, guvMinus: g.filter((z) => z.guv < 0).length, guvMmm: mmm(g.map((z) => z.guv)),
        mitTransfersPlus: g.filter((z) => z.guvMitTransfers >= 0).length, mitTransfersMmm: mmm(g.map((z) => z.guvMitTransfers)),
        kasseEndeMmm: mmm(g.map((z) => z.kasseSaisonende)), imMinus: g.filter((z) => z.kasseSaisonende < 0).length, imMinusNachKette: g.filter((z) => z.kasseEnde < 0).length,
      };
      o[name] = row;
      md.push(`| ${name} | ${row.n} | ${row.guvPlus} | ${row.guvMinus} | ${row.guvMmm} | ${row.mitTransfersPlus} | ${row.mitTransfersMmm} | ${row.kasseEndeMmm} | ${row.imMinus} / ${row.imMinusNachKette} |`);
    }
    md.push(`\nPosten-Mittel je Team (C), Saison ${sn}:\n`, "| Posten | Liga 1 | Liga 2 | gesamt |", "|---|---:|---:|---:|");
    const l1 = Z.filter((z) => z.liga === "liga1"), l2 = Z.filter((z) => z.liga === "liga2");
    o.postenMittel = {};
    for (const [key, label] of POSTEN) {
      const v = [mean(l1.map((z) => z.posten[key]!)), mean(l2.map((z) => z.posten[key]!)), mean(Z.map((z) => z.posten[key]!))].map(r1);
      o.postenMittel[key] = v;
      md.push(`| ${label} | ${v[0]} | ${v[1]} | ${v[2]} |`);
    }
    const sums = [[l1, 0], [l2, 1], [Z, 2]] as const;
    const line = (label: string, fn: (z: Zeile) => number) => `| ${label} | ${sums.map(([g]) => r1(mean(g.map(fn)))).join(" | ")} |`;
    md.push(line("Einnahmen gesamt (GuV)", (z) => z.einnahmen), line("Ausgaben gesamt (GuV)", (z) => -z.ausgaben), line("operative GuV", (z) => z.guv), line("GuV mit Transfers", (z) => z.guvMitTransfers));
    md.push(line("Kasse vor Kaufphase", (z) => z.kasseVorKaufphase), line("Kaufphase netto (Cash, vor der Saison)", (z) => z.kaufphase), line("Kasse Saisonstart", (z) => z.kasseStart), line("Rest nicht in der GuV (Tilgung, Abweichung)", (z) => z.restNichtGuv));
    md.push(line("Kasse Saisonende (nach Abschluss)", (z) => z.kasseSaisonende), line("Saisonende-Kette netto (Verkaeufe, Abgaenge, Nachkaeufe)", (z) => z.kette), line("Kasse nach Kette", (z) => z.kasseEnde));
    md.push(line("Kader Saisonstart", (z) => z.kaderStart), line("Staerke Top-6 Ø (Saisonstart)", (z) => z.staerkeStart), line("Gehalt Saisonstart", (z) => z.gehalt));
    md.push(`\nGuV-Mittel nach Budget-Rang-Quartil (operativ / mit Transfers / Kasse Ende):\n`, "| Quartil | operative GuV Ø | GuV + Kaufphase Ø | Kasse Start Ø | Kasse Saisonende Ø | Gehalt Ø |", "|---|---:|---:|---:|---:|---:|");
    for (const q of [1, 2, 3, 4]) {
      const g = Z.filter((z) => z.quartil === q);
      md.push(`| Q${q} | ${r1(mean(g.map((z) => z.guv)))} | ${r1(mean(g.map((z) => z.guvMitTransfers)))} | ${r1(mean(g.map((z) => z.kasseStart)))} | ${r1(mean(g.map((z) => z.kasseSaisonende)))} | ${r1(mean(g.map((z) => z.gehalt)))} |`);
    }
    o.teams = Z;
  }
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(ergebnis));
console.log(md.join("\n"));

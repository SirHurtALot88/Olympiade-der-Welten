/**
 * SCHEREN-AUSWERTUNG DES MARKETINGS (22.11., Nachbesserung, docs/design/marketing-bau-22-11.md).
 *
 * Eingabe: je Saat ein Lauf von `scripts/miss-teamfinanzen-saison.ts` MIT `OLY_MARKETING=aus` (Marketing wirkt dann nicht auf Kasse und
 * Moral, die Phase 03 fuehrt aber die berechneten Marketing-Zahlen). Weil Marketing den Spielverlauf nicht beeinflusst, ist "mit" =
 * GuV ohne + Marketing (Teammarke + Team-Anteile). Die Kasse am Saisonende wird nicht umgerechnet; verglichen wird die GuV.
 *
 * AUFRUF: npx tsx scripts/auswerte-marketing-schere.ts <saison s1|s2> <lauf1.json> [lauf2.json ...]
 */
import fs from "node:fs";

import { teammarkeAusRang } from "@/lib/marketing/marketing-modell";

const [saison, ...pfade] = process.argv.slice(2);
if (!saison || pfade.length === 0) throw new Error("Aufruf: auswerte-marketing-schere.ts <s1|s2> <lauf.json> ...");

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

type Zeile = {
  saat: string; summeMk: number; l1Mk: number; l2Mk: number; plusOhne: number; plusMit: number;
  verhOhne: number; verhMit: number; abstandOhne: number; abstandMit: number; deckel: number; zuschlag: number;
  reichMk: number; armMk: number;
};
const zeilen: Zeile[] = [];

for (const pfad of pfade) {
  const lauf = JSON.parse(fs.readFileSync(pfad, "utf8")) as { phasen: Record<string, any> };
  const ph = (n: string) => Object.entries(lauf.phasen).find(([k]) => k.startsWith(`${saison}_${n}`))?.[1];
  const spiel = ph("03_nach_spieltagen");
  const abschluss = ph("04_nach_abschluss");
  if (!spiel?.marketing || !abschluss?.guv) {
    console.log(`${pfad}: Phasen ${saison}_03/04 fehlen, uebersprungen`);
    continue;
  }
  const mk = spiel.marketing as Record<string, any>;
  const guv = abschluss.guv as Record<string, any>;
  const ids = Object.keys(guv);
  const liga = (t: string) => mk[t]?.liga as string;
  // Teammarke immer nach der AKTUELLEN Formel (Budget-Rang im Ligakreis); Team-Anteile (nach Deckel) wie gemessen.
  const rangVon = (t: string) => {
    const kreis = ids.filter((x) => liga(x) === liga(t)).sort((a, b) => (spiel.snap?.[b]?.budget ?? 0) - (spiel.snap?.[a]?.budget ?? 0) || a.localeCompare(b));
    return { rang: kreis.indexOf(t) + 1, anzahl: kreis.length };
  };
  const potenzial = (t: string) => {
    const r = rangVon(t);
    return teammarkeAusRang(liga(t) === "liga2" ? 2 : 1, r.rang, r.anzahl) + ((mk[t]?.teamAnteile as number) ?? 0);
  };
  const ohne = (t: string) => guv[t].guv.guv as number;
  const mit = (t: string) => ohne(t) + potenzial(t);
  const einn = (t: string, m: boolean) => (guv[t].guv.einnahmen as number) + (m ? potenzial(t) : 0);
  const verh = (m: boolean) => mittel(ids.filter((t) => liga(t) === "liga1").map((t) => einn(t, m))) / mittel(ids.filter((t) => liga(t) === "liga2").map((t) => einn(t, m)));
  const budget = (t: string) => spiel.snap?.[t]?.budget ?? 0;
  const sortiert = [...ids].sort((a, b) => budget(b) - budget(a));
  const abstand = (f: (t: string) => number) => mittel(sortiert.slice(0, 8).map(f)) - mittel(sortiert.slice(-8).map(f));
  zeilen.push({
    saat: pfad.split("/").pop()!.replace(".json", ""),
    summeMk: ids.reduce((s, t) => s + potenzial(t), 0),
    l1Mk: mittel(ids.filter((t) => liga(t) === "liga1").map(potenzial)),
    l2Mk: mittel(ids.filter((t) => liga(t) === "liga2").map(potenzial)),
    plusOhne: ids.filter((t) => ohne(t) >= 0).length,
    plusMit: ids.filter((t) => mit(t) >= 0).length,
    verhOhne: verh(false),
    verhMit: verh(true),
    abstandOhne: abstand(ohne),
    abstandMit: abstand(mit),
    deckel: ids.filter((t) => mk[t]?.deckelGreift).length,
    zuschlag: mittel(ids.map((t) => mk[t]?.zuschlagMittel ?? 0)),
    reichMk: mittel(sortiert.slice(0, 8).map(potenzial)),
    armMk: mittel(sortiert.slice(-8).map(potenzial)),
  });
}

console.log(`\n=== SCHERE ${saison.toUpperCase()}: Marketing neu (Teammarke nach Budget-Rang, Deckel 12 C), ${zeilen.length} Saaten ===\n`);
console.log("Saat      | Marketing Summe (L1 / L2 je Team) | Teams GuV>=0 ohne->mit | Einnahmen L1:L2 ohne->mit | GuV-Abstand reiche8-arme8 ohne->mit (Delta) | Marketing reiche8 / arme8 | Deckel | Moral+");
for (const z of zeilen) {
  console.log(
    `${z.saat.padEnd(9)} | ${r1(z.summeMk)} (${r1(z.l1Mk)} / ${r1(z.l2Mk)}) | ${z.plusOhne} -> ${z.plusMit} | ${r2(z.verhOhne)} -> ${r2(z.verhMit)} | ${r1(z.abstandOhne)} -> ${r1(z.abstandMit)} (${r1(z.abstandMit - z.abstandOhne)}) | ${r1(z.reichMk)} / ${r1(z.armMk)} | ${z.deckel} | ${r2(z.zuschlag)}`,
  );
}
if (zeilen.length > 1) {
  console.log(
    `Mittel    | ${r1(mittel(zeilen.map((z) => z.summeMk)))} | ${r1(mittel(zeilen.map((z) => z.plusOhne)))} -> ${r1(mittel(zeilen.map((z) => z.plusMit)))} | ${r2(mittel(zeilen.map((z) => z.verhOhne)))} -> ${r2(mittel(zeilen.map((z) => z.verhMit)))} | ${r1(mittel(zeilen.map((z) => z.abstandOhne)))} -> ${r1(mittel(zeilen.map((z) => z.abstandMit)))} (${r1(mittel(zeilen.map((z) => z.abstandMit - z.abstandOhne)))})`,
  );
}
console.log("");

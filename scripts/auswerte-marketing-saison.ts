/**
 * AUSWERTUNG DER MARKETING-MESSUNG (22.11., docs/design/marketing-bau-22-11.md).
 *
 * Liest zwei Laeufe von `scripts/miss-teamfinanzen-saison.ts` auf derselben Anlage (--marketing-stempel an / aus, bei "aus" zusaetzlich
 * OLY_MARKETING=aus) und druckt: Liga-Summe Marketing in den Kassen, Teams mit operativer GuV >= 0, Schere reich/arm, Moral-Wirkung.
 *
 * AUFRUF: npx tsx scripts/auswerte-marketing-saison.ts <mit.json> <ohne.json> [saison=s1]
 */
import fs from "node:fs";

const [mitPfad, ohnePfad, saison = "s1"] = process.argv.slice(2);
if (!mitPfad || !ohnePfad) throw new Error("Aufruf: auswerte-marketing-saison.ts <mit.json> <ohne.json> [s1]");

type Lauf = { phasen: Record<string, any> };
const mit = JSON.parse(fs.readFileSync(mitPfad, "utf8")) as Lauf;
const ohne = JSON.parse(fs.readFileSync(ohnePfad, "utf8")) as Lauf;

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const summe = (l: number[]) => l.reduce((a, b) => a + b, 0);
const mittel = (l: number[]) => (l.length ? summe(l) / l.length : 0);
const median = (l: number[]) => {
  const s = [...l].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

function phase(l: Lauf, name: string) {
  const eintrag = Object.entries(l.phasen).find(([k]) => k.startsWith(`${saison}_${name}`));
  return eintrag?.[1];
}

const spiel = (l: Lauf) => phase(l, "03_nach_spieltagen");
const abschluss = (l: Lauf) => phase(l, "04_nach_abschluss");
const ligaVon = (l: Lauf, teamId: string): string => spiel(l)?.snap?.[teamId]?.liga ?? "?";

console.log(`\n=== MARKETING-MESSUNG ${saison.toUpperCase()}: mit gegen ohne (gleiche Anlage, 32 KI-Teams) ===\n`);

// 1) Liga-Summe Marketing in den Kassen
const mk = spiel(mit)?.marketing as Record<string, any> | undefined;
if (!mk) throw new Error("Lauf 'mit' hat keine Marketing-Messung (Phase 03).");
const teams = Object.keys(mk);
const jeLiga = (liga: string) => teams.filter((t) => mk[t].liga === liga);
console.log("1) MARKETING IN DEN KASSEN (gebucht je Spieltag, Teammarke + Team-Anteile), C je Saison");
for (const liga of ["liga1", "liga2"]) {
  const ids = jeLiga(liga);
  const w = ids.map((t) => mk[t].gebucht as number);
  console.log(
    `   ${liga}: ${ids.length} Teams, Summe ${r1(summe(w))}, Mittel ${r1(mittel(w))}, Median ${r1(median(w))}, klein ${r1(Math.min(...w))}, gross ${r1(Math.max(...w))}`,
  );
}
const alle = teams.map((t) => mk[t].gebucht as number);
console.log(`   Liga gesamt: Summe ${r1(summe(alle))}, Mittel ${r1(mittel(alle))} je Team`);
console.log(
  `   davon Teammarke ${r1(summe(teams.map((t) => mk[t].teammarke as number)))}, Team-Anteile ${r1(summe(teams.map((t) => mk[t].teamAnteile as number)))}; Werbegeld im Kader ${r1(summe(teams.map((t) => mk[t].werbegeld as number)))}, an die Spieler ${r1(summe(teams.map((t) => mk[t].spielerAnteile as number)))}`,
);
console.log(`   Sicherheitsnetz greift bei ${summe(teams.map((t) => mk[t].netzGreift as number))} von ${summe(teams.map((t) => mk[t].kader as number))} Spielern`);

// 2) operative GuV >= 0
console.log("\n2) OPERATIVE GuV (alle gezaehlten Posten der EINEN GuV; Transfers und Tilgung zaehlen nicht)");
const guvVon = (l: Lauf) => {
  const g = abschluss(l)?.guv as Record<string, any> | undefined;
  const aus: Record<string, number> = {};
  if (g) for (const [t, e] of Object.entries(g)) aus[t] = e.guv.guv as number;
  return aus;
};
const gMit = guvVon(mit);
const gOhne = guvVon(ohne);
const zaehle = (g: Record<string, number>, liga?: string) => {
  const ids = Object.keys(g).filter((t) => !liga || ligaVon(mit, t) === liga);
  return { n: ids.length, plus: ids.filter((t) => g[t]! >= 0).length, mittel: mittel(ids.map((t) => g[t]!)) };
};
for (const [name, g] of [["ohne Marketing", gOhne], ["mit Marketing", gMit]] as const) {
  const a = zaehle(g);
  const l1 = zaehle(g, "liga1");
  const l2 = zaehle(g, "liga2");
  console.log(`   ${name}: ${a.plus} von ${a.n} Teams >= 0 (Liga 1: ${l1.plus}/${l1.n}, Liga 2: ${l2.plus}/${l2.n}); Mittel ${r1(a.mittel)} (L1 ${r1(l1.mittel)}, L2 ${r1(l2.mittel)})`);
}
const marketingPosten = (l: Lauf) => {
  const g = abschluss(l)?.guv as Record<string, any> | undefined;
  return Object.fromEntries(Object.entries(g ?? {}).map(([t, e]) => [t, (e.guv.posten as any[]).find((p) => p.key === "marketing")?.amount ?? 0] as const));
};
const pm = marketingPosten(mit);
console.log(`   GuV-Posten "Marketing" (mit): Summe ${r1(summe(Object.values(pm)))}, Mittel ${r1(mittel(Object.values(pm)))}`);
const wechsel = Object.keys(gMit).filter((t) => (gOhne[t] ?? 0) < 0 && gMit[t]! >= 0);
console.log(`   Teams, die erst mit Marketing ueber die Null kommen: ${wechsel.length} (${wechsel.join(", ")})`);

// 3) Schere
console.log("\n3) SCHERE REICH/ARM");
const einn = (l: Lauf, liga: string) => {
  const g = abschluss(l)?.guv as Record<string, any> | undefined;
  const ids = Object.keys(g ?? {}).filter((t) => ligaVon(mit, t) === liga);
  return mittel(ids.map((t) => g![t].guv.einnahmen as number));
};
for (const [name, l] of [["ohne", ohne], ["mit", mit]] as const) {
  console.log(`   Einnahmen ${name}: Liga 1 ${r1(einn(l, "liga1"))} : Liga 2 ${r1(einn(l, "liga2"))} = ${r2(einn(l, "liga1") / einn(l, "liga2"))}`);
}
const kasse = (l: Lauf) => {
  const s = abschluss(l)?.snap as Record<string, any> | undefined;
  return Object.fromEntries(Object.entries(s ?? {}).map(([t, e]) => [t, e.cash as number] as const));
};
for (const [name, l] of [["ohne", ohne], ["mit", mit]] as const) {
  const k = Object.values(kasse(l)).sort((a, b) => b - a);
  const top = mittel(k.slice(0, 8));
  const unten = mittel(k.slice(-8));
  const sd = Math.sqrt(mittel(k.map((x) => (x - mittel(k)) ** 2)));
  console.log(`   Kasse am Saisonende ${name}: reichstes ${r1(k[0]!)}, aermstes ${r1(k[k.length - 1]!)}, Mittel oberes Viertel ${r1(top)} / unteres Viertel ${r1(unten)} (Abstand ${r1(top - unten)}), Streuung ${r1(sd)}`);
}
const diffGuv = (l: Lauf) => {
  const g = guvVon(l);
  const ids = Object.keys(g);
  const budget = (t: string) => spiel(mit)?.snap?.[t]?.budget ?? 0;
  const sortiert = [...ids].sort((a, b) => budget(b) - budget(a));
  const reich = mittel(sortiert.slice(0, 8).map((t) => g[t]!));
  const arm = mittel(sortiert.slice(-8).map((t) => g[t]!));
  return { reich, arm };
};
for (const [name, l] of [["ohne", ohne], ["mit", mit]] as const) {
  const d = diffGuv(l);
  console.log(`   operative GuV nach Budget ${name}: reiche 8 ${r1(d.reich)}, arme 8 ${r1(d.arm)}, Abstand ${r1(d.reich - d.arm)}`);
}
const marketingNachBudget = (() => {
  const budget = (t: string) => spiel(mit)?.snap?.[t]?.budget ?? 0;
  const sortiert = [...teams].sort((a, b) => budget(b) - budget(a));
  return { reich: mittel(sortiert.slice(0, 8).map((t) => mk[t].gebucht as number)), arm: mittel(sortiert.slice(-8).map((t) => mk[t].gebucht as number)) };
})();
console.log(`   Marketing nach Budget: reiche 8 ${r1(marketingNachBudget.reich)}, arme 8 ${r1(marketingNachBudget.arm)} (Marketing oeffnet die Schere quer zum Budget: Kader mit Kante)`);

// 4) Moral
console.log("\n4) MORAL-WIRKUNG (Mittel der Kader-Moral je Team, Ende der Spieltage)");
const mo = spiel(ohne)?.marketing as Record<string, any> | undefined;
if (mo) {
  const dif = teams.map((t) => (mk[t].moralMittel as number) - (mo[t]?.moralMittel as number));
  console.log(`   ohne ${r1(mittel(teams.map((t) => mo[t].moralMittel)))} -> mit ${r1(mittel(teams.map((t) => mk[t].moralMittel)))}; Differenz je Team Mittel ${r1(mittel(dif))}, klein ${r1(Math.min(...dif))}, gross ${r1(Math.max(...dif))}`);
}
console.log(`   Zuschlag je Spieler im Mittel: ${r2(mittel(teams.map((t) => mk[t].zuschlagMittel as number)))} Moralpunkte (Konzept: +2 bis +8 ab 0,5 C Spieler-Anteil)`);
const sai = phase(mit, "02_saisonstart")?.marketing as Record<string, any> | undefined;
if (sai) console.log(`   Moral zum Saisonstart (mit): ${r1(mittel(teams.map((t) => sai[t].moralMittel)))}`);
console.log("");

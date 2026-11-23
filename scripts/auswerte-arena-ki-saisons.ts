/**
 * AUSWERTUNG KI-ARENA-AUSBAU UEBER MEHRERE SAISONS (23.11., docs/design/arena-tickets-medaillen-22-11.md Abschnitt "KI baut schneller").
 *
 * Eingabe: Laeufe von `scripts/miss-teamfinanzen-saison.ts --seasons 3` (32 KI-Teams). Ausgabe je Saison (Saisonende) und Lauf:
 * Plaetze im Mittel und bei den Top-4 je Liga (Top-4 = die vier Teams mit der hoechsten Fanbasis der Liga), Ticket-Anteil an den
 * Einnahmen (Top-4 und alle), Teams mit GuV >= 0, GuV-Abstand reichste 8 minus aermste 8 (nach Budget), Teams mit Kasse < 0.
 *
 * AUFRUF: npx tsx scripts/auswerte-arena-ki-saisons.ts <lauf1.json> [lauf2.json ...]
 */
import fs from "node:fs";

const pfade = process.argv.slice(2);
if (pfade.length === 0) throw new Error("Aufruf: auswerte-arena-ki-saisons.ts <lauf.json> ...");
const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
type Posten = { key: string; amount: number };

console.log("Saison | Lauf | Plaetze Ø L1 | L2 | Top-4 L1 | Top-4 L2 | Ticket-Anteil Top-4 | alle | GuV>=0 | GuV-Abstand r8-a8 | Kasse<0");
const summe: Record<string, number[][]> = {};
for (const pfad of pfade) {
  const lauf = JSON.parse(fs.readFileSync(pfad, "utf8")) as { phasen: Record<string, any> };
  for (const saison of ["s1", "s2", "s3"]) {
    const ende = Object.entries(lauf.phasen).find(([k]) => k.startsWith(`${saison}_04`))?.[1];
    if (!ende?.guv) continue;
    const guv = ende.guv as Record<string, any>;
    const snap = ende.snap as Record<string, any>;
    const ids = Object.keys(guv);
    const liga = (t: string) => snap[t]?.liga as string;
    const plaetze = (t: string) => {
      const p = snap[t]?.arena?.plaetze as { steh: number; sitz: number; loge: number } | undefined;
      return p ? p.steh + p.sitz + p.loge : 0;
    };
    const fans = (t: string) => (snap[t]?.arena?.fanbasis as number) ?? 0;
    const top4 = (l: string) => ids.filter((t) => liga(t) === l).sort((a, b) => fans(b) - fans(a)).slice(0, 4);
    const t1 = top4("liga1");
    const t2 = top4("liga2");
    const posten = (t: string, k: string) => ((guv[t].guv.posten as Posten[]).find((p) => p.key === k)?.amount ?? 0) as number;
    const einn = (t: string) => guv[t].guv.einnahmen as number;
    const gv = (t: string) => guv[t].guv.guv as number;
    const anteil = (l: string[]) => mittel(l.map((t) => (einn(t) > 0 ? posten(t, "tickets") / einn(t) : 0)));
    const budget = (t: string) => snap[t]?.budget ?? 0;
    const sortiert = [...ids].sort((a, b) => budget(b) - budget(a));
    const abstand = mittel(sortiert.slice(0, 8).map(gv)) - mittel(sortiert.slice(-8).map(gv));
    const zeile = [
      r0(mittel(ids.filter((t) => liga(t) === "liga1").map(plaetze))),
      r0(mittel(ids.filter((t) => liga(t) === "liga2").map(plaetze))),
      r0(mittel(t1.map(plaetze))), r0(mittel(t2.map(plaetze))),
      r2(anteil(t1)), r2(anteil(ids)),
      ids.filter((t) => gv(t) >= 0).length, r1(abstand),
      ids.filter((t) => (snap[t]?.cash ?? 0) < 0).length,
    ];
    (summe[saison] ??= []).push(zeile);
    console.log(`${saison} | ${pfad.split("/").pop()!.replace(".json", "")} | ${zeile.join(" | ")}`);
  }
}
for (const [s, z] of Object.entries(summe)) if (z.length > 1) console.log(`${s} | Mittel | ${z[0]!.map((_, i) => r2(mittel(z.map((x) => x[i]!)))).join(" | ")}`);

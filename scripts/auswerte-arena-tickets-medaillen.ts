/**
 * AUSWERTUNG ARENA, TICKETS UND MEDAILLEN (22.11., docs/design/arena-tickets-medaillen-22-11.md).
 *
 * Eingabe: je Saat ein Lauf von `scripts/miss-teamfinanzen-saison.ts --seasons 2` (32 KI-Teams von Anfang an). Ausgabe: je Saison
 * eine Tabelle mit Ticket-Einnahmen je Team (Mittel, Liga 1 / Liga 2), Ausbau-Ausgaben, Teams mit GuV >= 0, Verhaeltnis der Einnahmen
 * Liga 1 : Liga 2, GuV-Abstand der reichsten 8 minus der aermsten 8 (nach Budget) und Medaillen-Geld je Team.
 *
 * AUFRUF: npx tsx scripts/auswerte-arena-tickets-medaillen.ts <lauf1.json> [lauf2.json ...]
 */
import fs from "node:fs";

const pfade = process.argv.slice(2);
if (pfade.length === 0) throw new Error("Aufruf: auswerte-arena-tickets-medaillen.ts <lauf.json> ...");

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

type Posten = { key: string; amount: number };
for (const saison of ["s1", "s2"]) {
  console.log(`\n=== Saison ${saison.slice(1)} ===`);
  console.log("Saat | Tickets L1 | Tickets L2 | Ausbau je Team | GuV>=0 | Einnahmen L1:L2 | GuV-Abstand reich8-arm8 | Medaillen je Team | Ticket-Anteil Spitze | Auslastung Mittel");
  const zeilen: number[][] = [];
  for (const pfad of pfade) {
    const lauf = JSON.parse(fs.readFileSync(pfad, "utf8")) as { phasen: Record<string, any> };
    const ph = (n: string) => Object.entries(lauf.phasen).find(([k]) => k.startsWith(`${saison}_${n}`))?.[1];
    const ende = ph("04_nach_abschluss");
    const spiel = ph("03_nach_spieltagen") ?? ende;
    if (!ende?.guv) {
      console.log(`${pfad}: Phase ${saison}_04 fehlt`);
      continue;
    }
    const guv = ende.guv as Record<string, any>;
    const snap = (spiel?.snap ?? ende.snap) as Record<string, any>;
    const snapEnde = ende.snap as Record<string, any>;
    const ids = Object.keys(guv);
    const liga = (t: string) => snap[t]?.liga as string;
    const posten = (t: string, k: string) => ((guv[t].guv.posten as Posten[]).find((p) => p.key === k)?.amount ?? 0) as number;
    const tickets = (t: string) => posten(t, "tickets");
    const l1 = ids.filter((t) => liga(t) === "liga1");
    const l2 = ids.filter((t) => liga(t) === "liga2");
    const ausbau = (t: string) => (snapEnde[t]?.arena?.ausbau as number) ?? 0;
    const einn = (t: string) => guv[t].guv.einnahmen as number;
    const gv = (t: string) => guv[t].guv.guv as number;
    const budget = (t: string) => snap[t]?.budget ?? 0;
    const sortiert = [...ids].sort((a, b) => budget(b) - budget(a));
    const abstand = mittel(sortiert.slice(0, 8).map(gv)) - mittel(sortiert.slice(-8).map(gv));
    const spitze = [...l1].sort((a, b) => einn(b) - einn(a))[0]!;
    const ausl = mittel(ids.map((t) => snapEnde[t]?.arena?.auslastung).filter((x): x is number => typeof x === "number"));
    const zeile = [
      r1(mittel(l1.map(tickets))), r1(mittel(l2.map(tickets))), r2(mittel(ids.map(ausbau))),
      ids.filter((t) => gv(t) >= 0).length, r2(mittel(l1.map(einn)) / mittel(l2.map(einn))), r1(abstand),
      r2(mittel(ids.map((t) => posten(t, "medaillen")))), r2(einn(spitze) > 0 ? tickets(spitze) / einn(spitze) : 0), r2(ausl),
    ];
    zeilen.push(zeile);
    console.log(`${pfad.split("/").pop()!.replace(".json", "")} | ${zeile.join(" | ")}`);
  }
  if (zeilen.length > 1) console.log(`Mittel | ${zeilen[0]!.map((_, i) => r2(mittel(zeilen.map((z) => z[i]!)))).join(" | ")}`);
}

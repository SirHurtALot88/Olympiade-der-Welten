/**
 * MESSUNG SAISONPAUSE (21.11., docs/design/saisonpause-21-11.md): dieselbe Liga wie
 * `scripts/messe-belastung-resistenz.ts` (32 Kader, v2-Stempel, 20 Spieltage, echte Buchung), je Saat
 * einmal MIT und einmal OHNE Pause (`OLY_SAISONPAUSE=0`). Gemessen: Ø Erschöpfung und Anteil >= 65 zu
 * Beginn von Spieltag 11 und nach Spieltag 11, Verletzungen Spieltag 11-15 und je Saison.
 *
 *   npx tsx scripts/messe-saisonpause.ts [--saaten=8] [--json=pfad]
 */
import fs from "node:fs";

import { realSchedule, runKorridorSeason } from "@/lib/fatigue/erholungskorridor-simulation";

const args = process.argv.slice(2);
const argValue = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const SAATEN = Math.max(1, Number(argValue("saaten") ?? 8));
const JSON_PFAD = argValue("json");
const fmt = (wert: number, stellen = 1) => wert.toFixed(stellen).replace(".", ",");
const mean = (werte: number[]) => werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length);
const summe = (werte: number[], von: number, bis: number) => werte.slice(von, bis).reduce((a, b) => a + b, 0);

type Ergebnis = ReturnType<typeof runKorridorSeason>;

function lauf(mitPause: boolean): Ergebnis[] {
  if (mitPause) delete process.env.OLY_SAISONPAUSE;
  else process.env.OLY_SAISONPAUSE = "0";
  return Array.from({ length: SAATEN }, (_, i) => {
    const saat = `saisonpause-${i + 1}`;
    const spielplan = realSchedule(saat, 2);
    const slots = spielplan.map((e) => ({ d1: e.discipline1?.playerCount ?? 0, d2: e.discipline2?.playerCount ?? 0 }));
    return runKorridorSeason(saat, slots, { gameMode: "battle", belastungsRegel: "v2", platzwahl: "reihenfolge", mitAttributen: true, spielplan });
  });
}

const mit = lauf(true);
const ohne = lauf(false);
const zeile = (label: string, f: (r: Ergebnis) => number) =>
  console.log(`${label.padEnd(44)} ${fmt(mean(ohne.map(f))).padStart(8)} ${fmt(mean(mit.map(f))).padStart(8)}`);

console.log(`Saaten ${SAATEN}, 32 Teams, v2-Stempel, 20 Spieltage\n${"".padEnd(44)} ${"ohne".padStart(8)} ${"mit".padStart(8)}`);
zeile("Ø Erschöpfung nach SD10 (Beginn SD11)", (r) => r.avgFatigueByMatchday[9]!);
zeile("Anteil >= 65 nach SD10 (%)", (r) => r.anteilRotByMatchday[9]! * 100);
zeile("Ø Erschöpfung nach SD11", (r) => r.avgFatigueByMatchday[10]!);
zeile("Anteil >= 65 nach SD11 (%)", (r) => r.anteilRotByMatchday[10]! * 100);
zeile("Ø Erschöpfung nach SD15", (r) => r.avgFatigueByMatchday[14]!);
zeile("Verletzungen SD11-15", (r) => summe(r.injuriesByMatchday, 10, 15));
zeile("Verletzungen SD1-10", (r) => summe(r.injuriesByMatchday, 0, 10));
zeile("Verletzungen je Saison", (r) => r.injuries);
if (JSON_PFAD) {
  const kurz = (liste: Ergebnis[]) => liste.map(({ endState: _e, ...rest }) => rest);
  fs.writeFileSync(JSON_PFAD, JSON.stringify({ saaten: SAATEN, mit: kurz(mit), ohne: kurz(ohne) }, null, 2));
}

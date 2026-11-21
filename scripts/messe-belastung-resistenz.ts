/**
 * KORRIDOR-MESSUNG BELASTUNG/RESISTENZ (21.11., docs/design/belastung-resistenz-bau-21-11/README.md).
 *
 * Dieselbe Basisfall-Liga wie `scripts/messe-erholungskorridor.ts` (32 Kader 8–14, keine Gebäude, keine
 * Traits, Einsatz „Normal", Rotation „niedrigste Erschöpfung zuerst", 20 Spieltage aus dem echten
 * Spielplan-Generator), jetzt MIT Attributen (Verteilung wie im Bestand) und den echten Disziplinen des
 * Spielplans, damit Slot-Rollen, Stufen und Resistenz greifen. Jeder Spieltag läuft über die echte
 * Buchung `applyFatigueAndInjuryAfterMatchday` — unter v2 inklusive Pause nach Spieltag 10 und aktiver
 * Erholung 4,0, gesteuert allein über den Saison-Stempel.
 *
 *   npx tsx scripts/messe-belastung-resistenz.ts [--saaten=8] [--stamm=A] [--training] [--json=pfad]
 */
import fs from "node:fs";

import { realSchedule, runKorridorSeason, type KorridorOptionen } from "@/lib/fatigue/erholungskorridor-simulation";

const args = process.argv.slice(2);
const argValue = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const SAATEN = Math.max(1, Number(argValue("saaten") ?? 8));
const STAMM = argValue("stamm") ?? "A";
const MIT_TRAINING = args.includes("--training");
const JSON_PFAD = argValue("json");

const fmt = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const varianten: Array<{ label: string; optionen: Omit<KorridorOptionen, "spielplan"> }> = [
  { label: "heute (alte Regel)", optionen: { gameMode: "battle", mitAttributen: true, platzwahl: "reihenfolge" } },
  { label: "v2, Plätze wie gewählt", optionen: { gameMode: "battle", belastungsRegel: "v2", platzwahl: "reihenfolge" } },
  { label: "v2, nach Platzwert", optionen: { gameMode: "battle", belastungsRegel: "v2", platzwahl: "platzwert" } },
  { label: "v2, KI (Platzwert−0,25·Last)", optionen: { gameMode: "battle", belastungsRegel: "v2", platzwahl: "ki" } },
  { label: "v2, alle rein nach Last", optionen: { gameMode: "battle", belastungsRegel: "v2", platzwahl: "last" } },
];

console.log(`Saaten ${SAATEN}, Stamm ${STAMM}, Trainingsschicht ${MIT_TRAINING ? "mittel" : "aus"}, 20 Spieltage\n`);
console.log("Variante                          Verletzungen/Saison (min–max)   ST1–10  ST11–20   Ø Ersch. Mitte / Ende");
const roh: unknown[] = [];
for (const variante of varianten) {
  const ergebnisse = Array.from({ length: SAATEN }, (_, i) => {
    const saat = `belastung-${STAMM}-${i + 1}`;
    const spielplan = realSchedule(saat, 2);
    const slots = spielplan.map((entry) => ({
      d1: entry.discipline1?.playerCount ?? 0,
      d2: entry.discipline2?.playerCount ?? 0,
    }));
    return runKorridorSeason(saat, slots, { ...variante.optionen, spielplan, mitTraining: MIT_TRAINING });
  });
  const totals = ergebnisse.map((r) => r.injuries);
  const h1 = mean(ergebnisse.map((r) => r.injuriesByMatchday.slice(0, 10).reduce((a, b) => a + b, 0)));
  const h2 = mean(ergebnisse.map((r) => r.injuriesByMatchday.slice(10).reduce((a, b) => a + b, 0)));
  console.log(
    `${variante.label.padEnd(32)}  ${`${fmt(mean(totals))} (${Math.min(...totals)}–${Math.max(...totals)})`.padStart(28)}  ${fmt(h1).padStart(6)}  ${fmt(h2).padStart(7)}   ${fmt(mean(ergebnisse.map((r) => r.avgFatigueMid)))} / ${fmt(mean(ergebnisse.map((r) => r.avgFatigueEnd)))}`,
  );
  roh.push({ label: variante.label, totals, mean: mean(totals), h1, h2 });
}
if (JSON_PFAD) fs.writeFileSync(JSON_PFAD, JSON.stringify({ saaten: SAATEN, stamm: STAMM, training: MIT_TRAINING, varianten: roh }, null, 2));

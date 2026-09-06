// Einmal-Sonde (nicht Teil der Test-Suite): belegt, ob unter dem PRODUKTIONS-Schedule
// (buildSeasonSeededDisciplineSchedule, scheduleVersion "season-setup-v3-balanced-slot-buckets")
// jemals eine Disziplin 2x in derselben Saison vorkommt -- Grundannahme des Auftrags
// "keine Kurs-Wiederholung in einer Saison" (06.09.).
//
//   npx tsx scripts/pruefe-disziplin-wiederholung-je-saison.ts
import { buildSeasonSeededDisciplineSchedule, getRequiredSeasonDisciplineMatchdayCount } from "../lib/season/season-discipline-schedule";
import type { Discipline } from "../lib/data/olyDataTypes";

const DISCIPLINES: Discipline[] = [
  { id: "tennis", name: "Tennis", category: "mental", weight: 1.02, originalOrder: 13, displayOrder: 16, playerCount: 3 },
  { id: "mini-dm", name: "Mini DM", category: "power", weight: 1.08, originalOrder: 2, displayOrder: 1, playerCount: 2 },
  { id: "showcase", name: "Showcase", category: "social", weight: 0.95, originalOrder: 20, displayOrder: 9, playerCount: 5 },
  { id: "time-trial", name: "Time Trial", category: "speed", weight: 1.06, originalOrder: 7, displayOrder: 6, playerCount: 4 },
  { id: "spurt", name: "Spurt", category: "speed", weight: 1.08, originalOrder: 8, displayOrder: 20, playerCount: 2 },
  { id: "basketball", name: "Basketball", category: "social", weight: 1.01, originalOrder: 16, displayOrder: 5, playerCount: 6 },
  { id: "tdm", name: "TDM", category: "power", weight: 1.04, originalOrder: 1, displayOrder: 17, playerCount: 3 },
  { id: "battlefield", name: "Battlefield", category: "social", weight: 1.03, originalOrder: 18, displayOrder: 15, playerCount: 2 },
  { id: "staffel", name: "Staffel", category: "speed", weight: 1.12, originalOrder: 6, displayOrder: 14, playerCount: 3 },
  { id: "football", name: "Football", category: "social", weight: 1.08, originalOrder: 17, displayOrder: 19, playerCount: 4 },
  { id: "wettessen", name: "Wettessen", category: "mental", weight: 0.96, originalOrder: 15, displayOrder: 13, playerCount: 5 },
  { id: "gewichtheben", name: "Gewichtheben", category: "power", weight: 1.14, originalOrder: 3, displayOrder: 7, playerCount: 6 },
  { id: "speed-schach", name: "Schach", category: "mental", weight: 1.1, originalOrder: 11, displayOrder: 3, playerCount: 2 },
  { id: "takeshis-castle", name: "Takeshi", category: "mental", weight: 1.07, originalOrder: 12, displayOrder: 11, playerCount: 4 },
  { id: "hockey", name: "Hockey", category: "power", weight: 1.05, originalOrder: 4, displayOrder: 10, playerCount: 5 },
  { id: "eiskunstlauf", name: "Eiskunst", category: "social", weight: 1.04, originalOrder: 19, displayOrder: 8, playerCount: 3 },
  { id: "climbing", name: "Climbing", category: "speed", weight: 1.09, originalOrder: 9, displayOrder: 18, playerCount: 6 },
  { id: "fechten", name: "Fechten", category: "speed", weight: 1.08, originalOrder: 10, displayOrder: 2, playerCount: 5 },
  { id: "i-spy", name: "I Spy", category: "mental", weight: 1.01, originalOrder: 14, displayOrder: 4, playerCount: 6 },
  { id: "breaking", name: "Breaking", category: "power", weight: 1.0, originalOrder: 5, displayOrder: 12, playerCount: 4 },
];

console.log(`Disziplinen: ${DISCIPLINES.length}, benoetigte Spieltage: ${getRequiredSeasonDisciplineMatchdayCount(DISCIPLINES)}`);

let maxVorkommen = 0;
let saisonenMitWiederholung = 0;
const SAISONEN = 200;

for (let i = 1; i <= SAISONEN; i++) {
  const { entries } = buildSeasonSeededDisciplineSchedule({
    saveId: "sonde-save-1",
    seasonId: `season-${i}`,
    disciplines: DISCIPLINES,
  });
  const zaehler = new Map<string, number>();
  for (const entry of entries) {
    for (const slot of [entry.discipline1, entry.discipline2]) {
      if (!slot?.disciplineId) continue;
      zaehler.set(slot.disciplineId, (zaehler.get(slot.disciplineId) ?? 0) + 1);
    }
  }
  const lokalesMax = Math.max(...zaehler.values());
  maxVorkommen = Math.max(maxVorkommen, lokalesMax);
  if (lokalesMax > 1) saisonenMitWiederholung++;
  if (i <= 3) {
    console.log(`  season-${i}: Takeshi-Vorkommen = ${zaehler.get("takeshis-castle") ?? 0}, Disziplinen gesamt gebucht = ${[...zaehler.values()].reduce((a, b) => a + b, 0)}`);
  }
}

console.log(`\nUeber ${SAISONEN} simulierte Saisons (20 Disziplinen, ${getRequiredSeasonDisciplineMatchdayCount(DISCIPLINES)} Spieltage):`);
console.log(`  maximale Vorkommen EINER Disziplin in EINER Saison: ${maxVorkommen}`);
console.log(`  Saisons mit mindestens einer Wiederholung: ${saisonenMitWiederholung} von ${SAISONEN}`);
console.log(maxVorkommen === 1
  ? "\n=> BEFUND: Mit 20 Disziplinen und 2 Slots je Spieltag erschoepft buildSeededDisciplinePairs den Pool GENAU EINMAL -- jede Disziplin (auch Takeshi's Castle) kommt in JEDER Saison genau 1x vor, nie 2x."
  : "\n=> Unerwartet: Wiederholung gefunden, Praemisse des Auftrags trifft doch zu.");

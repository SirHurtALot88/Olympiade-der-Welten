/* eslint-disable no-console */
/**
 * MESSUNG ZUR ERMUEDUNG — Grundlage fuer die Tickets #37, #39 und die Vorfrage vom 10.08.
 *
 * Chris' drei Meldungen ziehen in ZWEI Richtungen, deshalb wird hier zuerst gemessen:
 *   #37: „AI Teams müssen ihre Müdigkeit besser managen, wenn sie zu wenige Spieler haben, und
 *        dann zusätzlich pushen werden sich spieler oft verletzen"
 *   #39: „Beim Training müssen AI Teams auch die Ermüdung berücksichtigen!"
 *   10.08.: „ich habe das gefühl es ist zu einfach auch mit 9 spielern verletzungen zu vermeiden!"
 *
 * Wird die KI vorsichtiger (#37/#39), sinkt die Verletzungszahl WEITER — und die Vorfrage
 * verschaerft sich. Ohne Zahlen dreht man an einer Schraube, ohne zu wissen, wo man steht.
 *
 * BLEIBT IM REPO, weil die Balance-Entscheidung dahinter offen ist: wird an der Ermuedung
 * gedreht, muss dieselbe Messung danach wiederholbar sein. Eine Zahl ohne Vergleichslauf ist
 * keine Grundlage.
 *
 *   MESS_SAVE=<id> OLY_APP_SQLITE_PATH=<save.sqlite> npx tsx scripts/messung-ermuedung.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  getFatiguePerformancePenaltyPercent,
  getInjuryRiskPercent,
  injuryRiskBands,
} from "@/lib/fatigue/fatigue-calibration";

function verteilung(werte: number[], stellen = 1) {
  if (werte.length === 0) return "keine";
  const s = [...werte].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
  return `min ${s[0]!.toFixed(stellen)} / p25 ${q(0.25).toFixed(stellen)} / median ${q(0.5).toFixed(stellen)} / p75 ${q(0.75).toFixed(stellen)} / max ${s.at(-1)!.toFixed(stellen)}`;
}

const persistence = createPersistenceService();
const ziel = process.env.MESS_SAVE;
const alle = persistence.listSaves();
const save = ziel ? alle.find((s) => s.saveId === ziel)! : alle.at(-1)!;
const gs = persistence.getSaveById(save.saveId)!.gameState as any;

/**
 * WELCHE SAISON WIRD GEMESSEN?
 *
 * Nicht die laufende — die ist nach einem Saisonwechsel leer, und eine Nullmessung sieht aus wie
 * ein Erfolg. Die Verletzungsereignisse bleiben nach dem Wechsel im `seasonState` liegen und
 * tragen ihre eigene `seasonId`; gemessen wird deshalb die Saison, zu der die MEISTEN Ereignisse
 * gehoeren. Mit MESS_SAISON=<id> laesst sich das ueberstimmen.
 */
const ss = gs.seasonState ?? {};
const alleEvents: any[] = ss.injuryEvents ?? [];
const proSaison = new Map<string, number>();
for (const e of alleEvents) proSaison.set(e.seasonId, (proSaison.get(e.seasonId) ?? 0) + 1);
const gemesseneSaison =
  process.env.MESS_SAISON ??
  [...proSaison.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
  gs.season.id;
gs.season = { ...gs.season, id: gemesseneSaison };

console.log(
  `=== ${save.saveId} | gemessene Saison ${gemesseneSaison} | Saisons im Spielstand: ${[...proSaison.entries()].map(([id, n]) => `${id}=${n}`).join(", ") || "keine"} ===\n`,
);

// ------------------------------------------------------------------ 1) Verletzungen
const events: any[] = ss.injuryEvents ?? [];
const dieseSaison = events.filter((e) => e.seasonId === gs.season.id);
const verletzt = dieseSaison.filter((e) => e.result === "injured");
const wuerfe = dieseSaison.length;
console.log("--- 1) VERLETZUNGEN ---");
console.log(`  Risikowuerfe insgesamt: ${wuerfe}`);
console.log(`  davon Verletzung: ${verletzt.length}  (${wuerfe ? ((verletzt.length / wuerfe) * 100).toFixed(2) : "0"} % Trefferquote)`);
const proTeam = new Map<string, number>();
for (const e of verletzt) proTeam.set(e.teamId, (proTeam.get(e.teamId) ?? 0) + 1);
for (const t of gs.teams) if (!proTeam.has(t.teamId)) proTeam.set(t.teamId, 0);
const jeTeam = [...proTeam.values()];
console.log(`  je Team: ${verteilung(jeTeam, 0)}  | Teams ganz ohne Verletzung: ${jeTeam.filter((n) => n === 0).length} von ${jeTeam.length}`);
const proSpieltag = new Map<string, number>();
for (const e of verletzt) proSpieltag.set(e.matchdayId, (proSpieltag.get(e.matchdayId) ?? 0) + 1);
console.log(`  je Spieltag: ${[...proSpieltag.entries()].sort().map(([md, n]) => `${md.replace("matchday-", "")}=${n}`).join(" ")}`);

// ------------------------------------------------------------------ 2) Wo lag die Ermuedung beim Wurf?
console.log("\n--- 2) ERMUEDUNG IM MOMENT DES WURFS ---");
const fatigues = dieseSaison.map((e) => Number(e.fatigueBefore ?? 0)).filter((n) => Number.isFinite(n));
console.log(`  fatigueBefore ueber alle Wuerfe: ${verteilung(fatigues)}`);
const proBand = new Map<string, { wuerfe: number; treffer: number }>();
for (const e of dieseSaison) {
  const f = Number(e.fatigueBefore ?? 0);
  const band = injuryRiskBands.find((b) => f >= b.min && f <= b.max)?.uiLabel ?? "?";
  const eintrag = proBand.get(band) ?? { wuerfe: 0, treffer: 0 };
  eintrag.wuerfe += 1;
  if (e.result === "injured") eintrag.treffer += 1;
  proBand.set(band, eintrag);
}
for (const band of injuryRiskBands) {
  const e = proBand.get(band.uiLabel);
  if (!e) continue;
  console.log(
    `  ${band.uiLabel.padEnd(32)} ${String(e.wuerfe).padStart(5)} Wuerfe  ${String(e.treffer).padStart(4)} Verletzungen  (${((e.treffer / e.wuerfe) * 100).toFixed(1)} %)`,
  );
}
console.log(`  Kurve zum Vergleich: 25 -> ${getInjuryRiskPercent(25).toFixed(1)} % | 50 -> ${getInjuryRiskPercent(50).toFixed(1)} % | 65 -> ${getInjuryRiskPercent(65).toFixed(1)} % | 80 -> ${getInjuryRiskPercent(80).toFixed(1)} %`);

// ------------------------------------------------------------------ 3) Wie hoch faehrt die KI ueberhaupt?
console.log("\n--- 3) WIE HOCH FAEHRT DIE KI DIE ERMUEDUNG? ---");
const kontrolle = ss.teamControlSettings ?? {};
const kiTeams = new Set<string>(
  gs.teams
    .map((t: any) => t.teamId)
    .filter((id: string) => (kontrolle[id]?.controlMode ?? "ai") !== "manual"),
);
console.log(`  KI-Teams: ${kiTeams.size} von ${gs.teams.length}`);
const kiFatigue: number[] = [];
const menschFatigue: number[] = [];
for (const e of dieseSaison) {
  const f = Number(e.fatigueBefore ?? 0);
  if (!Number.isFinite(f)) continue;
  (kiTeams.has(e.teamId) ? kiFatigue : menschFatigue).push(f);
}
console.log(`  KI  : ${verteilung(kiFatigue)}`);
console.log(`  Mensch: ${verteilung(menschFatigue)}`);
const ueber65 = (werte: number[]) => (werte.length ? ((werte.filter((f) => f >= 65).length / werte.length) * 100).toFixed(1) : "0");
console.log(`  Anteil Einsaetze ab Ermuedung 65 (die Push-Bremse der KI):  KI ${ueber65(kiFatigue)} %  Mensch ${ueber65(menschFatigue)} %`);

// ------------------------------------------------------------------ 4) Kadergroesse gegen Ermuedung
console.log("\n--- 4) DUENNER KADER GEGEN ERMUEDUNG (Kern von #37) ---");
const kaderGroesse = new Map<string, number>();
for (const t of gs.teams) kaderGroesse.set(t.teamId, 0);
for (const r of gs.rosters ?? []) if (kaderGroesse.has(r.teamId)) kaderGroesse.set(r.teamId, (kaderGroesse.get(r.teamId) ?? 0) + 1);
const gruppen = new Map<string, { fatigue: number[]; verletzungen: number; teams: Set<string> }>();
for (const e of dieseSaison) {
  const groesse = kaderGroesse.get(e.teamId) ?? 0;
  const gruppe = groesse <= 9 ? "duenn (<=9)" : groesse <= 11 ? "mittel (10-11)" : "breit (>=12)";
  const eintrag = gruppen.get(gruppe) ?? { fatigue: [], verletzungen: 0, teams: new Set<string>() };
  eintrag.fatigue.push(Number(e.fatigueBefore ?? 0));
  if (e.result === "injured") eintrag.verletzungen += 1;
  eintrag.teams.add(e.teamId);
  gruppen.set(gruppe, eintrag);
}
for (const name of ["duenn (<=9)", "mittel (10-11)", "breit (>=12)"]) {
  const g = gruppen.get(name);
  if (!g) continue;
  const schnitt = g.fatigue.reduce((a, b) => a + b, 0) / g.fatigue.length;
  console.log(
    `  ${name.padEnd(16)} ${String(g.teams.size).padStart(2)} Teams | Ermuedung Ø ${schnitt.toFixed(1)} | ${g.verletzungen} Verletzungen | ${(g.verletzungen / g.teams.size).toFixed(1)} je Team`,
  );
}

// ------------------------------------------------------------------ 4b) Der Verlauf ueber die Saison
console.log("\n--- 4b) ERMUEDUNG JE SPIELTAG (steigt sie monoton?) ---");
const jeMd = new Map<number, number[]>();
for (const e of dieseSaison) {
  const md = Number(String(e.matchdayId).replace("matchday-", "")) || 0;
  if (!jeMd.has(md)) jeMd.set(md, []);
  jeMd.get(md)!.push(Number(e.fatigueBefore ?? 0));
}
for (const md of [...jeMd.keys()].sort((a, b) => a - b)) {
  const werte = jeMd.get(md)!;
  const schnitt = werte.reduce((a, b) => a + b, 0) / werte.length;
  const heiss = werte.filter((f) => f >= 65).length;
  console.log(`  Spieltag ${String(md).padStart(2)}  Ø ${schnitt.toFixed(1)}  |  ab 65: ${String(heiss).padStart(3)} von ${String(werte.length).padStart(3)} (${((heiss / werte.length) * 100).toFixed(0)} %)`);
}

// ------------------------------------------------------------------ 4c) Beruecksichtigt das KI-Training die Ermuedung? (#39)
console.log("\n--- 4c) KI-TRAINING GEGEN ERMUEDUNG (#39) ---");
const bestaetigungen: any[] = ss.trainingIntensityConfirmations ?? [];
console.log(`  Trainings-Bestaetigungen im Spielstand: ${bestaetigungen.length}`);
if (bestaetigungen.length > 0) {
  const proModus = new Map<string, number>();
  for (const b of bestaetigungen) {
    const modus = b.intensity ?? b.mode ?? "?";
    proModus.set(modus, (proModus.get(modus) ?? 0) + 1);
  }
  console.log(`  nach Modus: ${[...proModus.entries()].map(([m, n]) => `${m}=${n}`).join(", ")}`);
  console.log(`  Beispielfelder: ${Object.keys(bestaetigungen[0]).join(", ")}`);
}

// ------------------------------------------------------------------ 5) Was kostet Ermuedung an Leistung?
console.log("\n--- 5) WAS ERMUEDUNG AN LEISTUNG KOSTET ---");
for (const f of [25, 40, 55, 65, 80, 100]) {
  console.log(`  Ermuedung ${String(f).padStart(3)}  ->  ${getFatiguePerformancePenaltyPercent(f).toFixed(1)} % Leistungsverlust  |  ${getInjuryRiskPercent(f).toFixed(1)} % Verletzungsrisiko`);
}

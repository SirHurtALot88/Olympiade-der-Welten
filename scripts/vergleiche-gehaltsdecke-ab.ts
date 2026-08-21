/* eslint-disable no-console */
/**
 * A/B: was macht die TRAGFAEHIGKEITS-Decke ueber eine ganze Saison?
 *
 * CHRIS zu `cankgm` / zur KI-Apron-Logik: „würde vermutlich erstmal messen und dann sehen wir wo
 * der schuh drückt".
 *
 * Die Decke (`computeTeamSalaryCeiling`, organic-squad/salary-ceiling.ts) begrenzt weich, was ein
 * Team an NEUEM Gehalt aufnimmt — verankert an den eigenen Einnahmen minus Fixkosten. Sie haengt an
 * `OLY_SALARY_CEILING_V2 === "1"` und ist in Produktion aus (die Env-Liste in
 * `deploy/hetzner/docker-compose.yml` reicht die Variable nicht in den Container).
 *
 * Dieses Skript vergleicht ZWEI durchgespielte Saisons, die sich nur in diesem Schalter
 * unterscheiden. Es rechnet nichts nach, es liest die Endstaende.
 *
 * ZWEI DATENBANKEN, ZWEI PROZESSE — und das ist keine Umstaendlichkeit, sondern die Reparatur eines
 * Fehlers, den dieses Skript zuerst hatte. Es setzte `process.env.OLY_APP_SQLITE_PATH` zwischen
 * zwei `createPersistenceService()`-Aufrufen um. Der Pfad wird aber beim ersten Zugriff auf die
 * Datenbank gebunden; der zweite Aufruf las deshalb WIEDER die erste Datei. Ergebnis: jede Zeile
 * zeigte „Delta 0", und das sah aus wie der Befund „die Decke tut nichts" — dabei waren es
 * zweimal dieselben Zahlen. Aufgefallen ist es nur, weil beide Spalten dieselbe saveId trugen.
 *
 * Jede Datenbank wird jetzt in einem EIGENEN Prozess gelesen (`--lies <pfad>` gibt JSON aus), der
 * Vergleich passiert danach. Ein Prozess, eine Datenbank — dann kann sich nichts mehr binden.
 *
 * DER ZEITPUNKT ENTSCHEIDET, UND ZWAR ALLES. Am `season_completed`-Stand sind die Vertraege gerade
 * ausgelaufen und der Wiederaufbau der naechsten Vorsaison hat noch nicht stattgefunden — die Liga
 * steht dort in ihrem Tal. Ich habe fuenfmal hintereinander genau dort gemessen und daraus
 * nacheinander geschlossen, es wuerde zu wenig gepickt (247 statt 341), die Simulation erzeuge keine
 * Ausreisser, und die Decke wirke oeffnend statt bremsend. Alle drei Schluesse waren falsch.
 *
 * Der belastbare Punkt ist die VORSAISON: dort stehen die Kader. Die Zahlen dazu liefert der Lauf
 * selbst in `long-run-audit-preseason-*.md` — dieses Skript liest den Endstand und ist damit nur
 * fuer Groessen zu gebrauchen, die das Saisonende ueberdauern (Cash, gebuchte Abgabe). Fuer Kader
 * und Gehaelter das Vorsaison-Audit nehmen.
 *
 * Aufruf:
 *   npx tsx scripts/vergleiche-gehaltsdecke-ab.ts --aus <pfad-a.sqlite> --an <pfad-b.sqlite>
 */
import { spawnSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamApronSalaryBase, resolveSeasonApronLines, apronLevyForSalary, resolveApronSalaryFactor } from "@/lib/season/apron-service";
import { getTeamPlayerMax, FIXED_ROSTER_MIN } from "@/lib/foundation/roster-limits";

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function r(x: number, d = 1): string {
  return Number.isFinite(x) ? (Math.round(x * 10 ** d) / 10 ** d).toFixed(d) : "—";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2 : (s[m] ?? 0);
}

type Lage = {
  saveId: string;
  saison: string;
  teams: number;
  gehalt: number[];
  cash: number[];
  kader: number[];
  unterMin: number;
  negativCash: number;
  abgabe: number;
  zahler: number;
};

/** Liest EINE Datenbank — laeuft ausschliesslich im Kindprozess, siehe Kopfkommentar. */
function leseDieseDatenbank(): Lage | null {
  const persistence = createPersistenceService();
  // Der juengste Stand in dieser Datei ist der durchgespielte.
  const kopf = persistence.listSaves()[0];
  if (!kopf) return null;
  const gs = persistence.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gs) return null;
  const lines = resolveSeasonApronLines(gs);
  const f = resolveApronSalaryFactor(gs);
  const lage: Lage = {
    saveId: kopf.saveId, saison: gs.season.id, teams: gs.teams.length,
    gehalt: [], cash: [], kader: [], unterMin: 0, negativCash: 0, abgabe: 0, zahler: 0,
  };
  for (const team of gs.teams) {
    const gehalt = getTeamApronSalaryBase(gs, team.teamId);
    const cash = Number((team as { cash?: number }).cash ?? 0);
    const kader = gs.rosters.filter((e) => e.teamId === team.teamId).length;
    lage.gehalt.push(gehalt);
    lage.cash.push(cash);
    lage.kader.push(kader);
    if (kader < FIXED_ROSTER_MIN) lage.unterMin += 1;
    if (cash < 0) lage.negativCash += 1;
    const levy = apronLevyForSalary({ salary: gehalt, line1: lines.line1, line2: lines.line2, salaryFactor: f });
    if (levy > 0.005) { lage.abgabe += levy; lage.zahler += 1; }
  }
  return lage;
}

function zeile(name: string, a: number, b: number, d = 1): void {
  const delta = b - a;
  const pfeil = Math.abs(delta) < 0.05 ? "  =" : delta > 0 ? "  ↑" : "  ↓";
  console.log(`  ${name.padEnd(32)} ${r(a, d).padStart(9)} ${r(b, d).padStart(9)}${pfeil} ${(delta >= 0 ? "+" : "") + r(delta, d)}`);
}

function leseUeberKindprozess(pfad: string): Lage | null {
  const ergebnis = spawnSync(
    process.execPath,
    ["--import", "tsx", process.argv[1] ?? "", "--lies", pfad],
    { encoding: "utf8", env: { ...process.env, OLY_APP_SQLITE_PATH: pfad } },
  );
  const zeile = (ergebnis.stdout ?? "").split("\n").find((z) => z.startsWith("{"));
  if (!zeile) {
    console.error(`Konnte ${pfad} nicht lesen:`, (ergebnis.stderr ?? "").slice(-400));
    return null;
  }
  return JSON.parse(zeile) as Lage;
}

function main(): void {
  const nurLesen = argValue("--lies");
  if (nurLesen) {
    const lage = leseDieseDatenbank();
    if (!lage) process.exit(1);
    console.log(JSON.stringify(lage));
    return;
  }
  const pfadAus = argValue("--aus");
  const pfadAn = argValue("--an");
  if (!pfadAus || !pfadAn) {
    console.error("Aufruf: --aus <a.sqlite> --an <b.sqlite>");
    process.exit(2);
  }
  const a = leseUeberKindprozess(pfadAus);
  const b = leseUeberKindprozess(pfadAn);
  if (!a || !b) {
    console.error("Mindestens ein Spielstand ist nicht lesbar.");
    process.exit(1);
  }
  /**
   * DER WAECHTER PRUEFT DEN INHALT, NICHT DEN NAMEN — und das ist eine Korrektur an ihm selbst.
   *
   * Er verglich zuerst die `saveId`. Das fing zwar den urspruenglichen Fehler (zweimal dieselbe
   * Datei gelesen), schlug aber beim RICHTIGEN Aufbau falsch an: ein sauberes A/B startet beide Arme
   * vom SELBEN Ausgangsstand, damit sich nur der Schalter unterscheidet und nicht die Liga. Beide
   * Seiten tragen dann zwangslaeufig dieselbe saveId — und der Waechter brach genau den Versuch ab,
   * fuer den er gebaut war.
   *
   * Verglichen wird deshalb, was ein Doppel-Lesen wirklich verraet: dass ALLE Messgroessen exakt
   * gleich sind. Zwei getrennt durchgespielte Saisons treffen sich nicht auf die Nachkommastelle.
   */
  const gleich =
    JSON.stringify([a.gehalt, a.cash, a.kader, a.abgabe]) === JSON.stringify([b.gehalt, b.cash, b.kader, b.abgabe]);
  if (gleich) {
    console.error(
      `ABBRUCH: beide Spalten sind in JEDER Messgroesse identisch — sehr wahrscheinlich wurde ` +
        `zweimal dieselbe Datenbank gelesen (${pfadAus} / ${pfadAn}). Genau dieser Fehler hat hier ` +
        `schon einmal ein falsches „Delta 0" erzeugt.`,
    );
    process.exit(1);
  }
  console.log(`A (Decke AUS): ${a.saveId} · ${a.saison} · ${a.teams} Teams`);
  console.log(`B (Decke AN):  ${b.saveId} · ${b.saison} · ${b.teams} Teams\n`);
  console.log(`  ${"Groesse".padEnd(32)} ${"AUS".padStart(9)} ${"AN".padStart(9)}   Delta`);
  const summe = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  zeile("Gehaltssumme der Liga", summe(a.gehalt), summe(b.gehalt));
  zeile("Median-Gehalt je Team", median(a.gehalt), median(b.gehalt));
  zeile("hoechstes Gehalt", Math.max(...a.gehalt), Math.max(...b.gehalt));
  zeile("Cash der Liga", summe(a.cash), summe(b.cash));
  zeile("Median-Cash je Team", median(a.cash), median(b.cash));
  zeile("Teams mit negativem Cash", a.negativCash, b.negativCash, 0);
  zeile("Kaderplaetze gesamt", summe(a.kader), summe(b.kader), 0);
  zeile("Median-Kadergroesse", median(a.kader), median(b.kader), 0);
  zeile(`Teams unter Minimum (${FIXED_ROSTER_MIN})`, a.unterMin, b.unterMin, 0);
  zeile("Apron-Abgabe gesamt", a.abgabe, b.abgabe);
  zeile("Apron-Zahler", a.zahler, b.zahler, 0);
  console.log(`\n  (Kaderobergrenze im Spiel: ${getTeamPlayerMax()})`);
}

main();

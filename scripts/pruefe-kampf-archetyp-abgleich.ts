// ===================================================================================
// ABGLEICH: liefert der MOTOR (battle-mode.engine.js, plain JS) denselben Kampf-Archetyp
// wie die kanonische TypeScript-Fassung (lib/battle/combat-archetype-resolver.ts)?
//
// Backlog #156, Schritt 1. Der Motor kann die TS-Datei nicht importieren (plain <script
// src>, s. Kopfkommentar an FoundationBattleArenaHost.tsx) — scripts/generiere-
// kampf-archetyp-daten.ts uebersetzt deshalb nur die STATISCHEN Daten in einen generierten
// Block, waehrend die Aufloesungsfunktion selbst von Hand als mechanische Kopie derselben
// Formeln direkt in engine.js steht (s. Kommentar dort an "AUFLOESUNG SELBST"). Dieses
// Skript ist der Beleg, dass beide Fassungen fuer ECHTE Spieler (aus dem live-save-Abbild,
// ueber denselben Adapter wie der echte Arena-Host) dasselbe Ergebnis liefern — "gemessen,
// nicht behauptet" (CLAUDE.md).
//
// Aufruf:
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/pruefe-kampf-archetyp-abgleich.ts
// ===================================================================================
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { buildArenaTeam, listeArenaTeams, type ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { bestimmeKampfArchetyp } from "@/lib/battle/combat-archetype-resolver";
import type { GameState } from "@/lib/data/olyDataTypes";

if (!process.env.OLY_APP_SQLITE_PATH) {
  console.error("OLY_APP_SQLITE_PATH ist nicht gesetzt (s. CLAUDE.md, \"An die Spielstände kommen\").");
  process.exit(1);
}

const repo = createSaveRepository();
const kopf = repo.listSaves()[0];
if (!kopf) {
  console.error("Kein Spielstand im Store unter OLY_APP_SQLITE_PATH gefunden.");
  process.exit(1);
}
const gameState = repo.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
if (!gameState) {
  console.error(`Save ${kopf.saveId} hat keinen gameState.`);
  process.exit(1);
}

// Moeglichst breite Streuung: die ersten zehn Teams alphabetisch (nicht nur eines), damit
// viele verschiedene Klassen/Unterklassen/Trait-Kombinationen im Abgleich landen, nicht nur
// der eine Kader, den auch die Kader-Familie schon zeigt.
const teams = listeArenaTeams(gameState).slice(0, 10);
const alleSpieler: ArenaSpieler[] = [];
const gesehen = new Set<string>();
for (const t of teams) {
  for (const p of buildArenaTeam(gameState, t.teamId)) {
    if (gesehen.has(p.n)) continue; // Namenskollisionen ueber Teams hinweg ueberspringen (Abgleich, nicht Produktionspfad)
    gesehen.add(p.n);
    alleSpieler.push(p);
  }
}
if (alleSpieler.length < 12) {
  console.error(`Zu wenige Spieler mit vollstaendigen Attributen gefunden (${alleSpieler.length}) — Abgleich braucht mindestens 12.`);
  process.exit(1);
}

const tsErgebnis = new Map<string, string>();
for (const p of alleSpieler) {
  const r = bestimmeKampfArchetyp({ className: p.c, subclasses: p.sub, traitsPositive: p.tp, traitsNegative: p.tn, name: p.n });
  tsErgebnis.set(p.n, r.archetype.name);
}

const seitenPfad = path.resolve(process.cwd(), "public", "mockups", "battle-mode.html");
if (!existsSync(seitenPfad)) {
  console.error(`battle-mode.html nicht gefunden unter ${seitenPfad}.`);
  process.exit(1);
}
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Top-level await scheitert an tsx' CJS-Transform (esbuild) — deshalb ab hier in einer
// async main(), nicht weil es inhaltlich noetig waere.
async function main() {
const browser = await chromium.launch(
  existsSync(fest)
    ? { headless: true, executablePath: fest, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { headless: true, channel: "chromium", args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] },
);
try {
  const page = await browser.newPage();
  // TDM-Kadergroesse ist 6 je Seite (DISCS.tdm.size) — build() nimmt nur die besten 6 nach
  // TDM-Eignung je Seite, der Rest eines groesseren Kaders bliebe unsichtbar. Deshalb in
  // 6-gegen-6-Haeppchen aufteilen und ALLE als eigene Kader-Familien-Variante durchreichen,
  // ein einziger page.evaluate()-Aufruf statt vieler Motor-Neuladungen.
  const haeppchen: { label: string; heim: ArenaSpieler[]; gast: ArenaSpieler[] }[] = [];
  for (let i = 0; i + 12 <= alleSpieler.length; i += 12) {
    haeppchen.push({ label: `block-${i}`, heim: alleSpieler.slice(i, i + 6), gast: alleSpieler.slice(i + 6, i + 12) });
  }
  await page.addInitScript((kader) => {
    (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
  }, { heim: haeppchen[0].heim, gast: haeppchen[0].gast });
  await page.goto(pathToFileURL(seitenPfad).href);
  await page.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", { timeout: 20_000 });

  const probe = await page.evaluate(
    (haeppchen) => (window as unknown as {
      __arena: { disziplinProbe: (d: string, o: unknown) => unknown };
    }).__arena.disziplinProbe("tdm", { n: 1, kaderFamilie: haeppchen }),
    haeppchen,
  );

  const varianten = (probe as { varianten: Array<{ spiele: Array<{ teilnehmer: Array<{ n: string; arch: string | null }> }> }> }).varianten;
  const engineErgebnis = new Map<string, string | null>();
  for (const v of varianten) for (const t of v.spiele[0].teilnehmer) engineErgebnis.set(t.n, t.arch);

  let geprueft = 0, abweichungen = 0;
  for (const [name, tsArch] of tsErgebnis) {
    const engineArch = engineErgebnis.get(name);
    if (engineArch === undefined) continue; // Spieler landete in keinem 6-gegen-6-Haeppchen (Rest bei nicht durch 12 teilbarer Zahl)
    geprueft++;
    if (engineArch !== tsArch) {
      abweichungen++;
      console.log(`ABWEICHUNG ${name}: TS=${tsArch} Motor=${engineArch}`);
    }
  }
  console.log(`\n${geprueft} Spieler abgeglichen, ${abweichungen} Abweichungen.`);
  process.exit(abweichungen === 0 ? 0 : 1);
} finally {
  await browser.close();
}
}
void main();

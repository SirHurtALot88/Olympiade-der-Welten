// ===================================================================================
// KADER-FAMILIE AUS DEM LIVE-SAVE-ABBILD ZIEHEN
//
// Befund (docs/design/projekt-ueberwachung-opus.md, Abschnitt 1.3): `disziplinProbe`
// (public/mockups/battle-mode.engine.js) mass bislang IMMER denselben 17-Spieler-Testkader
// in derselben Paarung. Speist man andere Aufteilungen ein, schwankt rho je nach Disziplin
// um bis zu 0,73 — eine Bewegung, die bisher niemand von echtem Mechanik-Fortschritt
// unterscheiden konnte.
//
// Dieses Skript zieht eine Familie aus FUENF echten Team-Paarungen aus dem aktuellen
// Spielstand (nicht aus einer synthetischen Mischung — Opus' Empfehlung, s. Anhang dort)
// und schreibt sie nach data/generated/kaderfamilie-live-save.json. Das ist dieselbe Bruecke
// (`buildArenaTeam`), die auch der echte Arena-Host und der Headless-Runner benutzen — keine
// zweite Umrechnung.
//
// Aufruf (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende
// kommen"):
//
//   git fetch origin live-save
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
//   gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-kader-familie.ts
//
// Die erste Paarung (Vigilante Wranglers/Armageddon Aftermath) ist bewusst dieselbe wie der
// bisherige hartkodierte Testkader in engine.js (SQUAD/OPP) — derselbe Verein, damit ein
// Ergebnis mit der Vorgeschichte vergleichbar bleibt. Die anderen vier streuen bewusst ueber
// Kadergroesse (8 bis 14 Spieler) und Tabellenbereich, damit die Familie nicht zufaellig
// wieder nur eine Sorte Team misst.
// ===================================================================================
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { buildArenaTeam, listeArenaTeams } from "@/lib/foundation/battle-arena/arena-kader-adapter";

import type { GameState } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");

const PAARUNGEN: Array<{ label: string; heim: string; gast: string }> = [
  { label: "vigilante-armageddon", heim: "Vigilante Wranglers", gast: "Armageddon Aftermath" },
  { label: "coldsteel-direlegion", heim: "Cold Steel", gast: "Dire Legion" },
  { label: "goldengladiators-silversoldiers", heim: "Golden Gladiators", gast: "Silver Soldiers" },
  { label: "mortalsin-natureswrath", heim: "Mortal Sin", gast: "Natures Wrath" },
  { label: "piratecrew-raginglunatics", heim: "Pirate Crew", gast: "Raging Lunatics" },
];

const repo = createSaveRepository();
const koepfe = repo.listSaves();
if (!koepfe.length) {
  console.error("Kein Spielstand im Store unter OLY_APP_SQLITE_PATH gefunden.");
  process.exit(1);
}
// listSaves() sortiert nach updated_at DESC (s. lib/persistence/save-repository.ts) — der
// erste Eintrag ist der zuletzt beruehrte, also der aktive Spielstand.
const kopf = koepfe[0];
const gameState = repo.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
if (!gameState) {
  console.error(`Save ${kopf.saveId} hat keinen gameState.`);
  process.exit(1);
}

const teams = listeArenaTeams(gameState);
const idVonName = new Map(teams.map((t) => [t.name, t.teamId]));

const varianten = PAARUNGEN.map((p) => {
  const heimId = idVonName.get(p.heim);
  const gastId = idVonName.get(p.gast);
  if (!heimId || !gastId) {
    throw new Error(`Team nicht gefunden im aktuellen Spielstand: "${p.heim}" oder "${p.gast}".`);
  }
  const heim = buildArenaTeam(gameState, heimId);
  const gast = buildArenaTeam(gameState, gastId);
  if (!heim.length || !gast.length) {
    throw new Error(`Team ohne einsatzfaehigen Kader: "${p.heim}" (${heim.length}) / "${p.gast}" (${gast.length}).`);
  }
  return { label: p.label, heimName: p.heim, gastName: p.gast, heim, gast };
});

const ausgabe = {
  hinweis:
    "Fuenf echte Team-Paarungen aus dem live-save-Abbild, gezogen ueber buildArenaTeam() " +
    "(dieselbe Bruecke wie der echte Arena-Host). Format je Spieler identisch zu SQUAD/OPP " +
    "in battle-mode.engine.js: {n,c,r,sub,tp,tn,d,groesse,a}. Neu ziehen mit " +
    "scripts/ziehe-kader-familie.ts, wenn sich der Spielstand deutlich veraendert hat " +
    "(neue Saison, große Transferfenster) — die Zahlen in " +
    "docs/design/messgrundlage-kaderfest.md beziehen sich auf DIESEN Stand.",
  quelle: {
    saveId: kopf.saveId,
    saveName: kopf.name,
    gezogenAm: new Date().toISOString(),
  },
  varianten,
};

writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 1));
console.log(`Geschrieben: ${ZIEL}`);
for (const v of varianten) {
  console.log(`  ${v.label.padEnd(34)} ${v.heimName} (${v.heim.length}) vs. ${v.gastName} (${v.gast.length})`);
}

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
//
// M0 (20.09.2026, docs/design-PM-Plan Wave 1): fuenf Paarungen sind zu wenig, um zu wissen, ob
// eine gemessene Arena-rho-Zahl praezise ist oder nur Rauschen der ZUFAELLIG gezogenen fuenf
// Paarungen. Der Schalter `--arena-erweitert` zieht ZUSAETZLICH eine groessere, disjunkte
// Familie (jedes Team hoechstens einmal, damit die Ziehungen statistisch unabhaengig bleiben)
// NUR fuer die drei Arena-Disziplinen (tdm/mini-dm/battlefield) und schreibt sie in eine EIGENE
// Datei (data/generated/kaderfamilie-arena-erweitert.json) — die Standard-PAARUNGEN und die
// Standard-Ausgabedatei (von den uebrigen 17 Disziplinen und der eingecheckten Basislinie
// gelesen) bleiben ohne den Schalter komplett unveraendert.
//
// Der aktuelle Spielstand (live-save, 20.09.2026) hat GENAU 32 Arena-Teams. Disjunkte Paarungen
// (jedes Team hoechstens einmal, sonst waeren zwei "Paarungen" statistisch nicht unabhaengig,
// weil sie denselben Kader teilen) sind deshalb bei hoechstens 32/2 = 16 Stueck gedeckelt — die
// im Auftrag genannten "~25" sind mit diesem Spielstand nicht erreichbar, ohne entweder Teams
// zu wiederholen oder Paarungen zu erfinden; beides verboten. PAARUNGEN_ARENA_ERWEITERT nutzt
// deshalb den REALEN Maximalwert: alle 32 Teams, einmal, in 16 Paarungen. Deterministisch
// gezogen per Tabellenplatz-Versatz (Rang i gegen Rang i+16, aus den `standings` desselben
// Abbilds) — das spannt Tabellenspitze gegen Tabellenende UND deckt die volle Kadergroessen-
// Bandbreite (8 bis 14 Spieler) ab, statt benachbarte, aehnlich starke Teams zu paaren. Die
// erste Paarung ist exakt Rang 7 gegen Rang 23 in diesem Schema — deshalb passt sie unveraendert
// als Paarung #1 hinein (s. scripts/miss-alle-disziplinen.mjs fuer den Verbrauch ueber
// OLY_KADER_FAMILIE, nur fuer tdm/mini-dm/battlefield gedacht).
// ===================================================================================
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { buildArenaTeam, listeArenaTeams } from "@/lib/foundation/battle-arena/arena-kader-adapter";

import type { GameState } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --arena-erweitert: ziehe PAARUNGEN_ARENA_ERWEITERT in eine eigene Datei statt der Standard-
// fuenf-Paarungen-Familie in die Standarddatei. Ohne den Schalter (Default, auch fuer jeden
// bestehenden Aufruf ohne Argumente) ist das Verhalten dieses Skripts byte-identisch zu vorher.
const ARENA_ERWEITERT = process.argv.includes("--arena-erweitert");
const ZIEL = ARENA_ERWEITERT
  ? path.join(WURZEL, "data/generated/kaderfamilie-arena-erweitert.json")
  : path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");

const PAARUNGEN: Array<{ label: string; heim: string; gast: string }> = [
  { label: "vigilante-armageddon", heim: "Vigilante Wranglers", gast: "Armageddon Aftermath" },
  { label: "coldsteel-direlegion", heim: "Cold Steel", gast: "Dire Legion" },
  { label: "goldengladiators-silversoldiers", heim: "Golden Gladiators", gast: "Silver Soldiers" },
  { label: "mortalsin-natureswrath", heim: "Mortal Sin", gast: "Natures Wrath" },
  { label: "piratecrew-raginglunatics", heim: "Pirate Crew", gast: "Raging Lunatics" },
];

// 16 disjunkte Paarungen (alle 32 Teams des live-save-Abbilds vom 20.09.2026, je einmal),
// deterministisch aus den `standings` desselben Abbilds per Rang-i-gegen-Rang-(i+16) gezogen
// (s. Kommentar oben). Paarung #1 ist bewusst identisch mit PAARUNGEN[0] oben.
const PAARUNGEN_ARENA_ERWEITERT: Array<{ label: string; heim: string; gast: string }> = [
  { label: "vigilante-armageddon", heim: "Vigilante Wranglers", gast: "Armageddon Aftermath" }, // Rang 7 (Kader 11) vs Rang 23 (Kader 10)
  { label: "goldengladiators-zeroheroes", heim: "Golden Gladiators", gast: "Zero Heroes" }, // Rang 1 (12) vs Rang 17 (9)
  { label: "silversoldiers-royalcourt", heim: "Silver Soldiers", gast: "Royal Court" }, // Rang 2 (12) vs Rang 18 (10)
  { label: "coldsteel-direlegion-erweitert", heim: "Cold Steel", gast: "Dire Legion" }, // Rang 3 (11) vs Rang 19 (11)
  { label: "deathpeaches-cashcreators", heim: "Death Peaches", gast: "Cash Creators" }, // Rang 4 (11) vs Rang 20 (11)
  { label: "wickedwizards-raginglunatics-erweitert", heim: "Wicked Wizards", gast: "Raging Lunatics" }, // Rang 5 (11) vs Rang 21 (8)
  { label: "lastride-viciousdelicious", heim: "Last Ride", gast: "Vicious & Delicious" }, // Rang 6 (10) vs Rang 22 (9)
  { label: "thegiants-hellraisers", heim: "The Giants", gast: "Hell Raisers" }, // Rang 8 (11) vs Rang 24 (8)
  { label: "terribleteachers-thechantry", heim: "Terrible Teachers", gast: "The Chantry" }, // Rang 9 (14) vs Rang 25 (9)
  { label: "natureswrath-blackpanthers", heim: "Natures Wrath", gast: "Black Panthers" }, // Rang 10 (14) vs Rang 26 (8)
  { label: "mortalsin-projectsuicide", heim: "Mortal Sin", gast: "Project Suicide" }, // Rang 11 (13) vs Rang 27 (9)
  { label: "nunchuckninjas-blazingbeasts", heim: "Nunchuck Ninjas", gast: "Blazing Beasts" }, // Rang 12 (13) vs Rang 28 (9)
  { label: "wreckinglegionnaires-vigorousvikings", heim: "Wrecking Legionnaires", gast: "Vigorous Vikings" }, // Rang 13 (10) vs Rang 29 (8)
  { label: "mayhemmavericks-piratecrew-erweitert", heim: "Mayhem Mavericks", gast: "Pirate Crew" }, // Rang 14 (10) vs Rang 30 (8)
  { label: "undercoveragents-strongholdcrusaders", heim: "Undercover Agents", gast: "Stronghold Crusaders" }, // Rang 15 (12) vs Rang 31 (8)
  { label: "lostkingdom-riptiderivers", heim: "Lost Kingdom", gast: "Riptide Rivers" }, // Rang 16 (10) vs Rang 32 (8)
];

const AKTIVE_PAARUNGEN = ARENA_ERWEITERT ? PAARUNGEN_ARENA_ERWEITERT : PAARUNGEN;

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

const varianten = AKTIVE_PAARUNGEN.map((p) => {
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
  hinweis: ARENA_ERWEITERT
    ? `${AKTIVE_PAARUNGEN.length} echte, disjunkte Team-Paarungen (alle 32 Teams des Abbilds, ` +
      "je einmal) aus dem live-save-Abbild, gezogen ueber buildArenaTeam() (dieselbe Bruecke wie " +
      "der echte Arena-Host). NUR fuer die Arena-Disziplinen (tdm/mini-dm/battlefield) gedacht — " +
      "s. scripts/ziehe-kader-familie.ts Kopfkommentar (M0, 20.09.2026) fuer die Herleitung. " +
      "Format je Spieler identisch zu SQUAD/OPP in battle-mode.engine.js: " +
      "{n,c,r,sub,tp,tn,d,groesse,a}. Neu ziehen mit " +
      "`npx tsx scripts/ziehe-kader-familie.ts --arena-erweitert`."
    : "Fuenf echte Team-Paarungen aus dem live-save-Abbild, gezogen ueber buildArenaTeam() " +
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

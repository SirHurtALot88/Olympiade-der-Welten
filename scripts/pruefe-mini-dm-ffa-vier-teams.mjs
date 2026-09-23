// BUGFIX-ABNAHME (22.09.): Chris' Screenshot zeigte fuer Mini-DM einen klassischen
// Zwei-Seiten-Kampf ("Vigilante Wranglers" 4 gegen "Armageddon Aftermath" 4, Sudden
// Death, K/T/B/CC/H/S/SCH/ERL/FF/IMP-Boxscore) statt des eigens beschlossenen
// Vier-Team-FFA (docs/design/mini-dm-4-team-ffa-recherche-06-09.md). Dieses Skript
// prueft am selben Weg wie pruefe-arena-host-saat-durchreichen.mjs (echte Datei per
// Playwright, kein Bundler): fuer MEHRERE Saaten UND mit vier echten Team-Kadern
// (window.__olyArenaKader.miniDmFfaTeams, wie FoundationBattleArenaHost.tsx es jetzt
// befuellt) zeigt die Mini-DM-Ansicht wirklich vier Teams gleichzeitig, nicht zwei
// Seiten mit je vier Kaempfern.
//
// Aufruf:
//   node --import tsx scripts/pruefe-mini-dm-ffa-vier-teams.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = resolve(hier, "..", "public", "mockups", "battle-mode.html");
const SEITE = pathToFileURL(seitePfad).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Vier klar unterscheidbare Fantasie-Teams mit je einem Spieler (baueMiniDmFfaRunde
// wiederholt einen zu kleinen Kader zyklisch, s. dessen Kommentar -- fuer den
// Sichtbarkeits-Nachweis reicht das).
const spieler = (name, mdWert) => ({
  n: name, c: "Templar", r: "Human", sub: [], tp: [], tn: [],
  d: { "mini-dm": mdWert },
  a: { power: 50, health: 50, stamina: 50, intelligence: 20, awareness: 20,
       determination: 30, speed: 30, dexterity: 40, charisma: 20, will: 40,
       spirit: 20, torment: 60 },
});
const TEAMS = [
  { name: "Vigilante Wranglers", kader: [spieler("Draco", 70)] },
  { name: "Armageddon Aftermath", kader: [spieler("Krolach", 65)] },
  { name: "Sturmklinge", kader: [spieler("Johanna", 60)] },
  { name: "Nachtfalken", kader: [spieler("Gram", 55)] },
];

const SAATEN = [1337, 42, 20260922, 777];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let alleOk = true;

for (const [i, saat] of SAATEN.entries()) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  // seedByDisciplineId wie im echten Host (FoundationBattleArenaHost.tsx) gesetzt --
  // ohne das faellt gebuchteSaatFuerAktuelleDisziplin() auf `undefined` zurueck und JEDER
  // Lauf normalisiert auf dieselbe Ersatzsaat 1337, egal welche `saat` hier uebergeben wird.
  await page.addInitScript(({ teams, saat }) => {
    window.__olyArenaKader = { miniDmFfaTeams: teams, seedByDisciplineId: { "mini-dm": saat } };
  }, { teams: TEAMS, saat });
  await page.goto(SEITE);
  await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });
  await page.click("#t2"); // Tab "Arena"
  await page.evaluate(() => window.__arena.setDisc("mini-dm"));

  const zustand = await page.evaluate(() => ({
    mdffaHidden: document.getElementById("minidmffa")?.hidden,
    scorelineDisplay: getComputedStyle(document.querySelector(".scoreline")).display,
    hpbarsDisplay: getComputedStyle(document.querySelector(".hpbars")).display,
    arenaraumDisplay: getComputedStyle(document.querySelector(".arenaraum")).display,
    teamKarten: [...document.querySelectorAll("#mdffaTeams .mdffa-name")].map((el) => el.textContent),
    rundenTafeln: document.querySelectorAll("#mdffaRunden .mdffa-runde").length,
    endstandZeilen: document.querySelectorAll("#mdffaEndstand tbody tr").length,
    endstandReihenfolge: [...document.querySelectorAll("#mdffaEndstand tbody tr td:first-child")].map((td) => td.textContent),
  }));

  console.log(`\nSaat ${saat} (Lauf ${i + 1}/${SAATEN.length}):`);
  console.log(`  #minidmffa hidden=${zustand.mdffaHidden} (erwartet false)`);
  console.log(`  .scoreline display=${zustand.scorelineDisplay} / .hpbars=${zustand.hpbarsDisplay} / .arenaraum=${zustand.arenaraumDisplay} (erwartet "none")`);
  console.log(`  Team-Karten: ${JSON.stringify(zustand.teamKarten)}`);
  console.log(`  Rundentafeln: ${zustand.rundenTafeln} (erwartet 4) · Endstand-Zeilen: ${zustand.endstandZeilen} (erwartet 4)`);
  console.log(`  Endstand-Reihenfolge: ${JSON.stringify(zustand.endstandReihenfolge)}`);
  if (fehler.length) console.error("  Seitenfehler:", fehler.slice(0, 5));

  const vierEchteTeams =
    zustand.teamKarten.length === 4 &&
    new Set(zustand.teamKarten).size === 4 &&
    TEAMS.every((t) => zustand.teamKarten.includes(t.name));
  const zweiSeitenAus =
    zustand.mdffaHidden === false &&
    zustand.scorelineDisplay === "none" &&
    zustand.hpbarsDisplay === "none" &&
    zustand.arenaraumDisplay === "none";
  const ok =
    vierEchteTeams &&
    zweiSeitenAus &&
    zustand.rundenTafeln === 4 &&
    zustand.endstandZeilen === 4 &&
    fehler.length === 0;
  console.log(`  ${ok ? "OK — vier Teams sichtbar, Zwei-Seiten-Rahmen aus." : "!! FEHLGESCHLAGEN !!"}`);
  if (!ok) alleOk = false;

  if (i === 0) {
    await page.screenshot({ path: resolve(hier, "..", "docs", "design", "mini-dm-ffa-vier-teams-nachweis-22-09.png"), fullPage: true });
  }
  await page.close();
}

await browser.close();
console.log("\n" + (alleOk
  ? "ALLE Saaten: Mini-DM zeigt vier echte Teams, kein Zwei-Seiten-Kampf mehr."
  : "MINDESTENS EIN Lauf weicht ab -- s. Log oben."));
process.exit(alleOk ? 0 : 1);

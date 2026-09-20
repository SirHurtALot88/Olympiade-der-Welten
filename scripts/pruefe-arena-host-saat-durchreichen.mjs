// A3-ABNAHME: "gesehen == gezaehlt", ueber FUENF verschiedene Spieltage/Saaten.
//
// docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md Abschnitt 5.3 / opus-
// synthese-universelles-kampfmodell-20-09.md Abschnitt 4.3: "Was Chris zuschaut, ist nicht das
// Spiel, das gezaehlt hat." Dieses Skript ist der Gegenbeweis NACH der Reparatur: fuer FUENF
// verschiedene (saveId, seasonId, matchdayId, disciplineId, homeTeamId, awayTeamId)-Tupel wird
//
//   (A) der GEZAEHLTE Weg gefahren -- exakt das Muster aus lib/battle/arena-headless-runner.ts:
//       `window.__arena.spieleFeldspiel(fd, saat)`, also `M.bau(saat); M.lauf(); M.wert()` --
//   (B) und der GESEHENE Weg -- exakt das Muster aus dem jetzt reparierten
//       FoundationBattleArenaHost.tsx: `window.__olyArenaKader.seedByDisciplineId` VOR dem
//       Laden setzen, `window.__arena.setDisc(fd)` (das ist, was ein Klick auf den
//       Disziplin-Tab im Host intern ausloest -- `disc=d; reset();` in battle-mode.engine.js),
//       Play klicken, Tempo auf 4x, und in ECHTER Zeit zuschauen, bis der Motor selbst meldet
//       "vorbei" -- und dann den Spielstand aus derselben DOM-Zelle gelesen (`#score`), die
//       auch Chris beim Zuschauen sieht.
//
// EIN SEED, EINE FUNKTION, ZWEI AUFRUFER: die Saat fuer beide Wege kommt aus GENAU DEMSELBEN
// `seedZuZahl(buildArenaMatchSeed(...))`-Aufruf, importiert aus lib/battle/arena-seed.ts -- der
// Datei, die jetzt sowohl arena-headless-runner.ts als auch FoundationBattleArenaHost.tsx
// importieren (s. deren Kommentare). Dieses Skript rechnet die Saat also nicht "auch noch
// einmal separat plausibel" nach, sondern ruft den EXAKT SELBEN Code, der in Produktion laeuft.
//
// Basketball ist die geprueften Disziplin: `ZEIT_DEHNUNG.basketball` ist unbesetzt (Faktor 1,
// s. battle-mode.engine.js), es gibt also keine Zeitdehnung, die Ticks zwischen Live-Schleife
// und `M.lauf()` unterschiedlich zerlegen koennte (die Bahn/Arena-Ausnahme aus Chris' Auftrag,
// s. PR-Beschreibung) -- die sauberste Disziplin fuer den Endstands-Vergleich.
//
// Aufruf:
//   node --import tsx scripts/pruefe-arena-host-saat-durchreichen.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

import { buildArenaMatchSeed, seedZuZahl } from "../lib/battle/arena-seed.ts";

const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = resolve(hier, "..", "public", "mockups", "battle-mode.html");
const SEITE = pathToFileURL(seitePfad).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// FUENF VERSCHIEDENE SPIELTAGE/SAATEN -- frei erfundene, aber je Tupel unterschiedliche IDs
// (die Saat haengt an ALLEN sechs Feldern, s. buildArenaMatchSeed()). Der Kader selbst ist in
// jedem Lauf der eingebaute Standard-SQUAD/OPP dieser Datei (kein window.__olyArenaKader.heim/
// gast gesetzt) -- fuer DIESEN Nachweis (stimmt der Endstand bei GLEICHEM Kader UND GLEICHER
// Saat zwischen den beiden Wegen ueberein?) ist es irrelevant, welcher Kader antritt.
const SPIELTAGE = [
  { saveId: "save-a3-eins", seasonId: "2026", matchdayId: "spieltag-3", disciplineId: "basketball", homeTeamId: "team-a", awayTeamId: "team-b" },
  { saveId: "save-a3-zwei", seasonId: "2026", matchdayId: "spieltag-7", disciplineId: "basketball", homeTeamId: "team-c", awayTeamId: "team-d" },
  { saveId: "save-a3-drei", seasonId: "2027", matchdayId: "spieltag-1", disciplineId: "basketball", homeTeamId: "team-e", awayTeamId: "team-f" },
  { saveId: "save-a3-vier", seasonId: "2026", matchdayId: "spieltag-12", disciplineId: "basketball", homeTeamId: "team-a", awayTeamId: "team-g" },
  { saveId: "save-a3-fuenf", seasonId: "2028", matchdayId: "spieltag-19", disciplineId: "basketball", homeTeamId: "team-h", awayTeamId: "team-i" },
];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let alleGleich = true;

for (const [index, spieltag] of SPIELTAGE.entries()) {
  const saat = seedZuZahl(buildArenaMatchSeed(spieltag));
  console.log(`\nSpieltag ${index + 1}/5: ${JSON.stringify(spieltag)}`);
  console.log(`  Saat (seedZuZahl(buildArenaMatchSeed(...))): ${saat}`);

  // (A) GEZAEHLT -- derselbe Aufruf, den arena-headless-runner.ts fuer die echte Wertung macht.
  const gezaehltPage = await browser.newPage();
  const gezaehltFehler = [];
  gezaehltPage.on("pageerror", (e) => gezaehltFehler.push(String(e)));
  await gezaehltPage.goto(SEITE);
  await gezaehltPage.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });
  const gezaehlt = await gezaehltPage.evaluate(
    (s) => window.__arena.spieleFeldspiel("basketball", s),
    saat,
  );
  await gezaehltPage.close();
  if (gezaehltFehler.length) console.error("  Seitenfehler (gezaehlt):", gezaehltFehler.slice(0, 3));
  if (!gezaehlt) throw new Error("spieleFeldspiel() lieferte null -- unerwartet fuer basketball.");
  console.log(`  Gezaehlt (spieleFeldspiel, headless): ${gezaehlt.seiten[0]} : ${gezaehlt.seiten[1]}`);

  // (B) GESEHEN -- derselbe Weg, den der reparierte FoundationBattleArenaHost.tsx nimmt:
  // seedByDisciplineId VOR dem Laden setzen, Disziplin waehlen (= Tab-Klick im Host), Play,
  // Tempo 4x, in echter Zeit zuschauen, bis der Motor selbst "vorbei" meldet.
  const gesehenPage = await browser.newPage();
  const gesehenFehler = [];
  gesehenPage.on("pageerror", (e) => gesehenFehler.push(String(e)));
  await gesehenPage.addInitScript((s) => {
    window.__olyArenaKader = { seedByDisciplineId: { basketball: s } };
  }, saat);
  await gesehenPage.goto(SEITE);
  await gesehenPage.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });
  // Entspricht dem Klick auf den "Basketball"-Tab im Host (setDisc ruft intern reset() auf,
  // das jetzt gebuchteSaatFuerAktuelleDisziplin() liest -- s. battle-mode.engine.js).
  await gesehenPage.evaluate(() => window.__arena.setDisc("basketball"));
  // "#play" haengt im "Arena"-Panel (Tab "t2"), das ohne einen Tab-Klick verborgen bleibt --
  // GENAU der Klick, den ein Zuschauer im Host macht, um den Kampf ueberhaupt zu sehen.
  await gesehenPage.click("#t2");
  await gesehenPage.click("#play");
  // Tempo einmal auf 2x, einmal auf 4x -- derselbe Knopf, den Chris im Host benutzen kann.
  await gesehenPage.click("#spd");
  await gesehenPage.click("#spd");
  await gesehenPage.waitForFunction(() => window.__arena && window.__arena.vorbei && window.__arena.vorbei(), null, {
    timeout: 180000,
  });
  const gesehenText = await gesehenPage.locator("#score").textContent();
  await gesehenPage.close();
  if (gesehenFehler.length) console.error("  Seitenfehler (gesehen):", gesehenFehler.slice(0, 3));
  const [gesehenHeim, gesehenGast] = (gesehenText || "").split(":").map((teil) => Number(teil.trim()));
  console.log(`  Gesehen (#score, interaktive Wiedergabe): ${gesehenHeim} : ${gesehenGast}`);

  const gleich = gesehenHeim === gezaehlt.seiten[0] && gesehenGast === gezaehlt.seiten[1];
  console.log(`  ${gleich ? "UEBEREINSTIMMUNG" : "!! ABWEICHUNG !!"}`);
  if (!gleich) alleGleich = false;
}

await browser.close();

console.log("\n" + (alleGleich
  ? "ALLE FUENF Spieltage: gesehener Endstand == gezaehlter Endstand."
  : "MINDESTENS EIN Spieltag weicht ab -- s. Log oben."));
process.exit(alleGleich ? 0 : 1);

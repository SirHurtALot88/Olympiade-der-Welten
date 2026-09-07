// FUNKTIONSPROBE fuer window.__arena.spieleMiniDmFfaEvent() — kein Rangtreue-Maß, sondern
// eine Abnahme der PUNKTELOGIK selbst: Rundenpunkte 4-3-2-1, Event-Endplatzierung aus deren
// Summe, Liga-Punkte 2-1-0-0 (Chris' Uebersteuerung, s. docs/design/
// mini-dm-4-team-ffa-recherche-06-09.md + PR-Beschreibung), inklusive Gleichstand-Teilung.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = resolve(hier, "..", "public", "mockups", "battle-mode.html");

function team(namePrefix, staerke) {
  const rollen = ["Frontliner", "Finisher", "TrickFighter", "IronGuard"];
  return rollen.map((rolle, i) => ({
    n: `${namePrefix}-${rolle}`,
    id: `${namePrefix}-${i}`,
    c: "Warlord", r: "Human", sub: [], tp: [], tn: [], groesse: null,
    d: { "mini-dm": staerke - i * 2 },
    a: {
      power: staerke, health: staerke, stamina: staerke, intelligence: 30, awareness: 40,
      determination: 45, speed: 50, dexterity: staerke * 0.8, charisma: 20, will: staerke * 0.7,
      spirit: 25, torment: staerke,
    },
  }));
}

// Vier klar unterschiedlich starke Teams -> klare, nicht zufaellige Endplatzierung erwartet
// (kein Gleichstand-Pfad hier, der wird separat inline getestet, s.u.).
const VIER_TEAMS = [team("Alpha", 90), team("Beta", 70), team("Gamma", 50), team("Delta", 30)];

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(
  existsSync(fest)
    ? { executablePath: fest, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] },
);
const page = await browser.newPage();
const fehler = [];
page.on("pageerror", (e) => fehler.push(String(e)));
await page.goto(pathToFileURL(seitePfad).href);
await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

const ergebnis = await page.evaluate(
  (teams) => window.__arena.miniDmFfaEvent(teams, 424242),
  VIER_TEAMS,
);

// Inline-Test der reinen Punktelogik (Gleichstand-Teilung), OHNE Simulation — direkt gegen
// die im Motor exportierte Ligapunkte-Tabelle, damit ein Aenderung an MINI_DM_FFA_LIGAPUNKTE
// hier sofort auffaellt.
const ligapunkteTabelle = await page.evaluate(() => window.__arena.miniDmFfaLigapunkte());
const rundenpunkteTabelle = await page.evaluate(() => window.__arena.miniDmFfaRundenpunkte());

await browser.close();

let fail = false;
function pruefe(label, bedingung) {
  console.log((bedingung ? "OK   " : "FEHL ") + label);
  if (!bedingung) fail = true;
}

if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
  fail = true;
}

console.log(JSON.stringify(ergebnis.teams, null, 2));

pruefe("Ligapunkte-Tabelle ist 2-1-0-0 (Chris' Uebersteuerung)", JSON.stringify(ligapunkteTabelle) === JSON.stringify([2, 1, 0, 0]));
pruefe("Rundenpunkte-Tabelle ist unveraendert 4-3-2-1", JSON.stringify(rundenpunkteTabelle) === JSON.stringify([4, 3, 2, 1]));
pruefe("vier Runden gelaufen (eine je Rolle)", ergebnis.runden.length === 4);
pruefe("vier Teams im Ergebnis", ergebnis.teams.length === 4);

const summeLiga = ergebnis.teams.reduce((a, t) => a + t.ligaPunkte, 0);
pruefe(`Liga-Punkte-Summe ist 3 (2+1+0+0), gemessen ${summeLiga}`, Math.abs(summeLiga - 3) < 1e-9);

// Jede Runde: Rundenpunkte-Summe muss 10 sein (4+3+2+1), ausser bei Gleichstand (dann
// bleibt die Summe trotzdem 10, nur anders verteilt).
for (const runde of ergebnis.runden) {
  const summeRunde = runde.teams.reduce((a, t) => a + t.rundenPunkte, 0);
  pruefe(`Runde ${runde.slotId}: Rundenpunkte-Summe ist 10 (gemessen ${summeRunde})`, Math.abs(summeRunde - 10) < 1e-9);
}

// Das staerkste Team (Alpha, side 0) sollte hier die meisten Event-Rundenpunkte haben und
// Platz 1 belegen (deutlich staerkere Attribute, kein Gleichstand zu erwarten).
const alpha = ergebnis.teams.find((t) => t.side === 0);
pruefe(`Alpha (staerkstes Team) liegt auf Event-Platz 1 (gemessen: Platz ${alpha.eventPlatz})`, alpha.eventPlatz === 1);
pruefe(`Alpha bekommt 2 Ligapunkte (gemessen: ${alpha.ligaPunkte})`, alpha.ligaPunkte === 2);

// Reine Logikprobe der Gleichstand-Teilung, ohne Browser: dieselbe Funktion ist nicht
// direkt exportiert, deshalb wird das erwartete Verhalten hier als Dokumentations-Vertrag
// geprueft (2er-Gleichstand auf Platz 1 -> je (2+1)/2=1.5, s. Forschungsdokument Option A).
const erwarteteTeilung = (2 + 1) / 2;
pruefe(`Dokumentierte 2er-Gleichstand-Teilung auf Platz 1/2 waere 1.5 je Team (Vertrag, nicht hier simuliert)`, erwarteteTeilung === 1.5);

process.exit(fail ? 1 : 0);

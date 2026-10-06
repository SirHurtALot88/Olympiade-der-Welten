// BROADCAST-PAKET C "MINI-DM-RUNDENSHOW" (06.10.) -- Abnahme-Sonde fuer C1-C4.
//
// Mini-DM zeigte bisher eine automatisch startende, rund vier Sekunden kurze Offenbarung im
// hellen Kartenstil mit sichtbarem Platzhaltertext und einer leeren rechten Spalte (s.
// PR-Beschreibung fuer den vollen Befund). Dieses Skript prueft die ueberarbeitete Fassung:
//
//   C1 -- Start-Knopf statt Autostart, "Alles zeigen" (Animation ueberspringen), Tempo 1x/2x,
//         KEIN Spoiler (keine Platzierung/Ligapunkte/.mdffa-sieger-Klasse) vor dem Klick.
//   C2 -- Titelkarte je Runde, Lebensbalken, Ausgeschaltet-Stempel, Platz 4->1 enthuellt,
//         Eckkarten zaehlen hoch und sortieren sich um, Rundensieger-Banner.
//   C3 -- Endstand im Phase-5-/.esieger-Stil: Banner, Podest, MVP-Stern, bestehende Tabelle.
//   C4 -- Platzhaltertext weg, volle Breite, dunkles Arena-Theme (data-theme="dark").
//
// Aufruf:
//   node --import tsx scripts/verify-broadcast-paket-c-06-10.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const repo = resolve(hier, "..");
const SEITE = pathToFileURL(resolve(repo, "public", "mockups", "battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const AUSGABE = resolve(repo, "tmp-ux-audit", "broadcast-paket-c-06-10");
mkdirSync(AUSGABE, { recursive: true });

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

let alleOk = true;
const melde = (bedingung, text) => {
  console.log(`  ${bedingung ? "OK" : "!! FEHLGESCHLAGEN !!"} -- ${text}`);
  if (!bedingung) alleOk = false;
};

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

async function neueSeite(page, { saat, dunkel } = {}) {
  await page.addInitScript(({ teams, saat }) => {
    window.__olyArenaKader = { miniDmFfaTeams: teams, seedByDisciplineId: { "mini-dm": saat } };
  }, { teams: TEAMS, saat: saat ?? 20261006 });
  await page.goto(SEITE);
  await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });
  await page.click("#t2");
  await page.evaluate(() => window.__arena.setDisc("mini-dm"));
  if (dunkel) {
    await page.evaluate(() => document.querySelector(".oly-battle-arena").setAttribute("data-theme", "dark"));
  }
}

// ---------- C1: kein Spoiler vor dem Klick, Chrome-Aufraeumung (C4) ----------
{
  console.log("\n--- C1/C4: Einlauf, kein Spoiler, kein Platzhaltertext ---");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const konsolenfehler = [];
  page.on("pageerror", (e) => konsolenfehler.push(String(e)));
  await neueSeite(page, { saat: 20261006 });

  const vorKlick = await page.evaluate(() => ({
    hatSiegerKlasse: !!document.querySelector(".mdffa-sieger"),
    rundenTafeln: document.querySelectorAll("#mdffaRunden .mdffa-runde").length,
    endstandZeilen: document.querySelectorAll("#mdffaEndstand tbody tr").length,
    endstandKopfHidden: document.getElementById("mdffaEndstandKopf")?.hidden,
    paarungen: document.querySelectorAll("#mdffaPaarungen .mdffa-paarung").length,
    gesamttext: document.getElementById("minidmffa")?.textContent || "",
    frameHatVollbreite: document.querySelector("#p2 .frame")?.classList.contains("mdffa-vollbreite"),
  }));
  melde(!vorKlick.hatSiegerKlasse && vorKlick.rundenTafeln === 0 && vorKlick.endstandZeilen === 0,
    "keine Platzierung/Ligapunkte/.mdffa-sieger-Klasse vor dem Klick sichtbar");
  melde(vorKlick.paarungen === 4, "vier Rollen-Paarungen im Einlauf sichtbar (" + vorKlick.paarungen + ")");
  melde(!vorKlick.gesamttext.includes("Eine Live-Grafik"), "Platzhaltertext 'Eine Live-Grafik ... folgt' entfernt");
  melde(!!vorKlick.frameHatVollbreite, "Panel nutzt die volle Breite (.mdffa-vollbreite gesetzt)");
  await page.screenshot({ path: resolve(AUSGABE, "mini-dm-einlauf.png"), fullPage: true });

  await page.click("#mdffaStart");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(AUSGABE, "mini-dm-runde.png"), fullPage: true });
  const mitten = await page.evaluate(() => ({
    rundenTafeln: document.querySelectorAll("#mdffaRunden .mdffa-runde").length,
    zeilenOhneLeerraum: [...document.querySelectorAll("#mdffaRunden tbody tr")].every(tr => tr.textContent.trim().length > 0),
  }));
  melde(mitten.rundenTafeln === 1, "genau eine Rundentafel sichtbar waehrend Runde 1 laeuft");
  melde(mitten.zeilenOhneLeerraum, "keine leeren/reservierten Tabellenzeilen vor ihrer Enthuellung");

  await page.click("#mdffaAlles");
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(AUSGABE, "mini-dm-endstand.png"), fullPage: true });
  const endstand = await page.evaluate(() => ({
    ctrlHidden: document.getElementById("mdffaCtrl")?.hidden,
    siegerKarten: document.querySelectorAll(".mdffa-sieger").length,
    podest: document.querySelectorAll("#mdffaPodest .mdffa-podplatz").length,
    mvpStern: document.querySelectorAll("#mdffaPodest .mvpstern").length,
    bannerHatText: (document.getElementById("mdffaEndbanner")?.textContent || "").length > 10,
    endstandZeilen: document.querySelectorAll("#mdffaEndstand tbody tr").length,
  }));
  melde(endstand.ctrlHidden === true, "Start-/Alles-zeigen-/Tempo-Leiste nach Show verborgen");
  melde(endstand.siegerKarten === 1, "genau eine Siegerkarte markiert");
  melde(endstand.podest === 4, "Podest zeigt vier Plaetze (C3)");
  melde(endstand.mvpStern === 1, "MVP-Stern genau einmal vergeben (C3)");
  melde(endstand.bannerHatText, "Endbanner im Phase-5-Stil zeigt Text (C3)");
  melde(endstand.endstandZeilen === 4, "bestehende Ergebnistabelle bleibt zusaetzlich erhalten (C3)");
  melde(konsolenfehler.length === 0, "keine JS-Fehler (pageerror) waehrend C1-Ablauf: " + JSON.stringify(konsolenfehler));
  await page.close();
}

// ---------- C4: dunkles Arena-Theme ----------
{
  console.log("\n--- C4: dunkles Arena-Theme (data-theme=\"dark\", wie im echten Spiel gesetzt) ---");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await neueSeite(page, { saat: 20261006, dunkel: true });
  await page.click("#mdffaAlles");
  await page.waitForTimeout(1500);
  const farben = await page.evaluate(() => {
    const panel = document.getElementById("minidmffa");
    const banner = document.getElementById("mdffaEndbanner");
    return { panelBg: getComputedStyle(panel).backgroundColor, bannerColor: getComputedStyle(banner).color };
  });
  console.log("  Panel-Hintergrund (dunkel erwartet):", farben.panelBg);
  console.log("  Endbanner-Farbe:", farben.bannerColor);
  // Grobe Dunkelheits-Pruefung: Summe der RGB-Kanalwerte des Panel-Hintergrunds niedrig.
  const rgbSumme = (farben.panelBg.match(/\d+/g) || []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0);
  melde(rgbSumme < 300, "Panel-Hintergrund ist dunkel, nicht der helle Kartenstil (RGB-Summe " + rgbSumme + ")");
  await page.screenshot({ path: resolve(AUSGABE, "mini-dm-endstand-dark.png"), fullPage: true });
  await page.close();
}

// ---------- Timing bei Tempo 1x (echte Wanduhr, keine Sonde) ----------
{
  console.log("\n--- Echtzeit-Dauer bei Tempo 1x (Ziel 25-40s) ---");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await neueSeite(page, { saat: 777 });
  const start = Date.now();
  await page.click("#mdffaStart");
  await page.waitForFunction(
    () => document.getElementById("mdffaEndstandKopf") && !document.getElementById("mdffaEndstandKopf").hidden,
    null, { timeout: 60000 },
  );
  const dauerS = (Date.now() - start) / 1000;
  console.log(`  Dauer: ${dauerS.toFixed(1)}s`);
  melde(dauerS >= 25 && dauerS <= 40, "volle Schau bei Tempo 1x dauert 25-40s");
  await page.close();
}

// ---------- Disziplinwechsel mitten in laufender Show ----------
{
  console.log("\n--- Disziplinwechsel waehrend laufender Show: keine Fehler, keine Hintergrund-Timer ---");
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const konsolenfehler = [];
  page.on("pageerror", (e) => konsolenfehler.push(String(e)));
  await neueSeite(page, { saat: 4242 });
  await page.click("#mdffaStart");
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__arena.setDisc("tdm"));
  await page.waitForTimeout(6000); // laenger als jede Pause der Show -- ein liegengebliebener
                                    // Timer haette hier laengst versucht, aufs verlassene Panel zu schreiben.
  const nachWechsel = await page.evaluate(() => ({ mdffaHidden: document.getElementById("minidmffa")?.hidden }));
  melde(nachWechsel.mdffaHidden === true, "Mini-DM-Panel bleibt nach Wechsel verborgen");
  melde(konsolenfehler.length === 0, "keine JS-Fehler nach Disziplinwechsel: " + JSON.stringify(konsolenfehler));
  await page.close();
}

await browser.close();
console.log("\n" + (alleOk ? "ALLE PRUEFUNGEN BESTANDEN." : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN -- s. Log oben."));
process.exit(alleOk ? 0 : 1);

#!/usr/bin/env node
// ===================================================================================
// ABNAHME FUER DIE ANZEIGE DER BATTLE ARENA.
//
// Warum ein eigenes Skript neben messe-arena-einfluss.mjs: das dort misst, ob die
// MECHANIK belohnt, was die Wertung bepreist. Hier geht es um die andere Haelfte —
// ob der Zuschauer ueberhaupt SIEHT und HOERT, was die Simulation tut. Chris' Meldung
// vom 25.08. bestand aus fuenf Punkten, und alle fuenf waren von dieser Art:
//
//   1. "In der Arena haben die Chars ihre Waffen etc nicht."
//   2. "die tooltips im end screen von Schaden Erlitten und IMP funktionieren nicht"
//   3. "heal fehlt noch komplett dass man sieht wen man geheilt hat"
//   4. "Sound in der Battle Arena funktioniert gar nicht bei mir"
//   5. "die coolen neuen profile ... fuer die einsatzliste fehlen auch noch"
//
// Keiner davon faellt in einem Motor-Smoke-Test auf: die Simulation lief die ganze
// Zeit korrekt weiter. Deshalb pruefen die Faelle unten die ANZEIGE selbst — und zwar
// gegen nachpruefbare Aussagen, nicht gegen Screenshots.
//
//   node scripts/pruefe-arena-anzeige.mjs
//
// UEBER HTTP, NICHT UEBER file://. Der Entwurf laedt Sprites, Portraits und Ton ueber
// ABSOLUTE Pfade (/sprites/..., /sound/...) — genau so, wie die App sie ausliefert.
// Unter file:// laufen die alle ins Leere, und dann sieht ein fehlender Sprite aus wie
// ein fehlender Sprite, egal ob der Code stimmt. Das Skript startet deshalb selbst
// einen winzigen Dateiserver auf public/.
//
// ZWEI EINBETTUNGEN, weil zwei existieren: die Huelle direkt (Standalone/Artefakt) und
// der Weg des Hosts (FoundationBattleArenaHost.tsx haengt dasselbe Markup in einen
// Container der laufenden App, mit .im-spiel und data-theme="dark"). Der Tooltip-Fehler
// aus Punkt 2 war ein reiner Kapselungsfehler und haette in nur einer der beiden
// Einbettungen leicht uebersehen werden koennen.
// ===================================================================================
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HIER, "..");
const PUBLIC = path.join(REPO, "public");
const BROWSER = process.env.OLY_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const TYPEN = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".json": "application/json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".svg": "image/svg+xml" };

// Die Host-Nachbildung: dasselbe, was FoundationBattleArenaHost.tsx tut — Markup der
// Huelle in einen Container haengen, .im-spiel und data-theme setzen, Stylesheet in den
// Kopf, Kader VOR dem Motor setzen, Motor zuletzt einhaengen.
const EINGEBETTET = `<!doctype html><meta charset="utf-8">
<title>Arena, eingebettet wie im Spiel</title>
<style>body{margin:0;background:#0B1018;color:#E7EDF6;font-family:system-ui}
  .shell{padding:24px}h1.shell-titel{font-style:italic;font-weight:700}</style>
<div class="shell"><h1 class="shell-titel">Foundation-Shell (Attrappe)</h1><div id="arena"></div></div>
<script>
(async()=>{
  const huelle=await (await fetch("/mockups/battle-mode.html")).text();
  const dok=new DOMParser().parseFromString(huelle,"text/html");
  for(const l of dok.querySelectorAll('link[rel="stylesheet"]')){
    const k=document.createElement("link");k.rel="stylesheet";
    k.href=new URL(l.getAttribute("href"),location.origin+"/mockups/").toString();
    document.head.appendChild(k);
  }
  const container=document.getElementById("arena");
  container.innerHTML=dok.querySelector(".oly-battle-arena").outerHTML;
  const wurzel=container.querySelector(".oly-battle-arena");
  wurzel.setAttribute("data-theme","dark");wurzel.classList.add("im-spiel");
  const s=document.createElement("script");
  s.src=new URL(dok.querySelector("script[src]").getAttribute("src"),location.origin+"/mockups/").toString();
  document.body.appendChild(s);
})();
</script>`;

function starteServer() {
  return new Promise((fertig) => {
    const server = createServer(async (anfrage, antwort) => {
      if (anfrage.url === "/eingebettet.html") {
        antwort.writeHead(200, { "content-type": TYPEN[".html"] });
        antwort.end(EINGEBETTET);
        return;
      }
      // Der Browser fragt von sich aus danach; ohne Antwort steht ein 404 im Protokoll,
      // das mit dem Entwurf nichts zu tun hat.
      if (anfrage.url === "/favicon.ico") { antwort.writeHead(204).end(); return; }
      const rein = decodeURIComponent(anfrage.url.split("?")[0]);
      const datei = path.join(PUBLIC, rein);
      // Kein Ausbruch aus public/ — der Server liegt nur fuer diese Pruefung herum.
      if (!datei.startsWith(PUBLIC)) { antwort.writeHead(403).end(); return; }
      try {
        await readFile(datei, { flag: "r" }).catch(() => { throw new Error("weg"); });
        antwort.writeHead(200, { "content-type": TYPEN[path.extname(datei)] || "application/octet-stream" });
        createReadStream(datei).pipe(antwort);
      } catch { antwort.writeHead(404).end(); }
    });
    server.listen(0, "127.0.0.1", () => fertig({ server, port: server.address().port }));
  });
}

const befunde = [];
const pruefe = (name, bedingung, notiz) => {
  befunde.push({ name, ok: !!bedingung, notiz: notiz ?? "" });
  console.log((bedingung ? "  OK   " : "  FEHL ") + name + (notiz ? " — " + notiz : ""));
};

const { server, port } = await starteServer();
const basis = "http://127.0.0.1:" + port;
const browser = await chromium.launch({ executablePath: BROWSER });

// Ton-Attrappe: hoeren laesst sich im Testlauf nichts, aber jeder play()-Aufruf wird
// mitgeschrieben. Damit ist pruefbar, DASS die Ton-Pfade laufen — und nur das war
// Chris' Punkt 4 ("funktioniert gar nicht").
const TON_ATTRAPPE = () => {
  window.__ton = [];
  window.Audio = class {
    constructor(src) { this.src = src; this.loop = false; this.volume = 1; this.paused = true; }
    play() { this.paused = false; window.__ton.push({ src: this.src, loop: this.loop, vol: Math.round(this.volume * 100) / 100 }); return Promise.resolve(); }
    pause() { this.paused = true; }
  };
};

// Die Huelle verlinkt Google Fonts. In dieser Umgebung laesst der Proxy die Domain nicht
// durch (ERR_CONNECTION_RESET) — das ist eine Eigenschaft des Netzes, nicht des Entwurfs,
// und darf die Abnahme nicht rot faerben. Alles andere zaehlt.
const NETZRAUSCHEN = /fonts\.(googleapis|gstatic)\.com|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED/;

function hoerZu(seite, fehler) {
  seite.on("pageerror", (e) => fehler.push("pageerror: " + e));
  seite.on("console", (m) => {
    if (m.type() !== "error") return;
    const txt = m.text();
    const url = (m.location() && m.location().url) || "";
    if (NETZRAUSCHEN.test(txt) || NETZRAUSCHEN.test(url)) return;
    fehler.push("console: " + txt + (url ? " @ " + url : ""));
  });
}

async function oeffne(pfad, mitTonAttrappe) {
  const seite = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const fehler = [];
  hoerZu(seite, fehler);
  if (mitTonAttrappe) await seite.addInitScript(TON_ATTRAPPE);
  await seite.goto(basis + pfad);
  await seite.waitForFunction(() => !!window.__arena, null, { timeout: 30000 });
  await seite.waitForTimeout(1200);
  return { seite, fehler };
}

// -----------------------------------------------------------------------------------
// 1. WAFFEN (Chris' Punkt 1)
//
// Die Pruefung braucht keinen Augenschein: der Motor unterdrueckt Waffen im FELDSPIEL
// bewusst (ein Korbleger ist kein Schwerthieb) und sonst nirgends. Dieselbe Figur im
// selben Gang-Bild einmal als Arena- und einmal als Feldspiel-Sprite gerendert
// unterscheidet sich also GENAU um die Waffenebenen — und um nichts sonst. Bewaffnete
// muessen sich unterscheiden, Unbewaffnete muessen identisch sein.
// -----------------------------------------------------------------------------------
{
  const { seite, fehler } = await oeffne("/mockups/battle-mode.html", false);
  console.log("\nWAFFEN IN DER ARENA");
  const ergebnis = await seite.evaluate(() => {
    const proben = ["Draco", "Johanna", "Cassandra", "Tavascron", "Harbinger", "Krag'Zul", "Lava Golem", "Seraph-11"];
    return proben.map((n) => ({
      n,
      arena: window.__arena.renderProbe(n, "walk", false),
      feld: window.__arena.renderProbe(n, "walk", true),
    })).map((x) => ({ n: x.n, unterschied: x.arena !== x.feld, leer: x.arena.length < 500 }));
  });
  const BEWAFFNET = new Set(["Draco", "Johanna", "Cassandra", "Tavascron", "Harbinger"]);
  for (const e of ergebnis) {
    if (BEWAFFNET.has(e.n)) pruefe(`${e.n} traegt seine Waffe im Gehen`, e.unterschied && !e.leer);
    else pruefe(`${e.n} bleibt unbewaffnet (wie im Kartenbild)`, !e.unterschied && !e.leer);
  }
  pruefe("Standalone: keine Konsolenfehler", fehler.length === 0, fehler.join(" | "));
  await seite.close();
}

// -----------------------------------------------------------------------------------
// 2.+3. TOOLTIPS UND AUFSCHLUESSELUNGEN IM ENDSTAND (Chris' Punkte 2 und 3)
//
// Zwei getrennte Aussagen, beide waren verletzt:
//   a) der Kasten ist ueberhaupt SICHTBAR (er hing an document.body, wo keine einzige
//      Regel der gekapselten Stilvorlage greift — er war unsichtbarer Fliesstext ganz
//      unten auf der Seite),
//   b) die Zerlegung ADDIERT SICH auf die Zahl, ueber der sie steht. Bei "ERL" tat sie
//      das nicht: die Spalte zeigt Rohschaden, gezaehlt wurde der geminderte.
// -----------------------------------------------------------------------------------
for (const [wo, pfad] of [["Standalone", "/mockups/battle-mode.html"], ["Eingebettet", "/eingebettet.html"]]) {
  const { seite, fehler } = await oeffne(pfad, false);
  console.log("\nENDSTAND-TOOLTIPS — " + wo);
  await seite.click("#t2");
  await seite.waitForTimeout(300);
  await seite.click("#play");
  await seite.evaluate(() => { const b = document.getElementById("spd"); b.click(); b.click(); });
  for (let i = 0; i < 60; i++) {
    if (await seite.evaluate(() => !document.getElementById("endstand").hidden)) break;
    await seite.waitForTimeout(1000);
  }
  await seite.waitForTimeout(400);

  // a) Sichtbarkeit: gestylt, im Bild, und am angefahrenen Feld statt irgendwo.
  const imp = seite.locator("#etafelL table tbody tr").first().locator("td.imp");
  await imp.hover();
  await seite.waitForTimeout(250);
  const kasten = await seite.evaluate(() => {
    const t = document.querySelector(".tipbox");
    if (!t || t.hidden) return null;
    const cs = getComputedStyle(t), r = t.getBoundingClientRect();
    const ziel = document.querySelector("#etafelL table tbody tr td.imp").getBoundingClientRect();
    return { position: cs.position, grund: cs.backgroundColor,
      zeilen: getComputedStyle(t.querySelector("p")).whiteSpace,
      imBild: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
      nah: Math.abs(r.left - ziel.left) < 420 && Math.abs(r.bottom - ziel.top) < 420,
      text: t.querySelector("p").textContent };
  });
  pruefe(wo + ": Tooltip ist gestylt", !!kasten && kasten.position === "absolute" && kasten.grund !== "rgba(0, 0, 0, 0)",
    kasten ? kasten.position + " / " + kasten.grund : "kein Kasten");
  pruefe(wo + ": Tooltip steht im Bild und am Feld", !!kasten && kasten.imBild && kasten.nah);
  pruefe(wo + ": Zerlegung bricht zeilenweise um", !!kasten && kasten.text.includes("\n") && /pre-line|pre-wrap|pre/.test(kasten.zeilen),
    kasten ? kasten.zeilen : "");

  // b) Die Zerlegungen muessen aufgehen. "= <Summe>" ist die letzte Zeile im Kasten.
  const spalten = await seite.evaluate(async () => {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    const raus = [];
    // Spaltenreihenfolge: Name, K, T, B, CC, H, S, SCH, ERL, FF, IMP
    const stellen = { ERL: 9, H: 6, S: 7, SCH: 8 };
    for (const tafel of ["#etafelL", "#etafelR"]) {
      for (const zeile of document.querySelectorAll(tafel + " table tbody tr")) {
        for (const [lab, i] of Object.entries(stellen)) {
          const zelle = zeile.children[i - 1];
          if (!zelle || !zelle.classList.contains("hovbar")) continue;
          zelle.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
          await warte(20);
          const t = document.querySelector(".tipbox");
          const zeilen = t.querySelector("p").textContent.trim().split("\n");
          const summe = Number(zeilen[zeilen.length - 1].replace("=", "").trim());
          raus.push({ lab, wer: zeile.children[0].textContent, zelle: Number(zelle.textContent), summe });
          zelle.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        }
      }
    }
    return raus;
  });
  const schief = spalten.filter((s) => Math.abs(s.zelle - s.summe) > 1);
  pruefe(wo + `: alle ${spalten.length} Aufschluesselungen summieren sich auf ihre Spalte`,
    spalten.length > 0 && schief.length === 0,
    schief.map((s) => `${s.wer}/${s.lab}: ${s.zelle} vs ${s.summe}`).join(", "));
  const heilZeilen = spalten.filter((s) => s.lab === "H");
  pruefe(wo + ": Heilung ist nach Empfaenger aufgeschluesselt", heilZeilen.length > 0,
    heilZeilen.length ? "" : "kein Heiler mit Heilung im Kampf — Lauf wiederholen");
  pruefe(wo + ": keine Konsolenfehler", fehler.length === 0, fehler.join(" | "));
  await seite.close();
}

// -----------------------------------------------------------------------------------
// 4. TON (Chris' Punkt 4)
//
// Der Ton wurde in den Basketball-Runden gebaut und hing danach ausschliesslich an
// Basketball. Der Entwurf startet auf TDM — dort war es still. Geprueft wird deshalb
// die ARENA, nicht das Feldspiel.
// -----------------------------------------------------------------------------------
{
  const { seite, fehler } = await oeffne("/mockups/battle-mode.html", true);
  console.log("\nTON IN DER ARENA (TDM)");
  await seite.click("#t2");
  await seite.waitForTimeout(300);
  await seite.click("#play");
  await seite.evaluate(() => { const b = document.getElementById("spd"); b.click(); b.click(); });
  for (let i = 0; i < 60; i++) {
    if (await seite.evaluate(() => !document.getElementById("endstand").hidden)) break;
    await seite.waitForTimeout(1000);
  }
  const ton = await seite.evaluate(() => window.__ton);
  const schleife = ton.filter((t) => t.loop);
  const jubel = ton.filter((t) => /publikum_jubel/.test(t.src));
  pruefe("Hallen-Grundrauschen laeuft in der Arena", schleife.length >= 1);
  pruefe("Publikum reagiert auf Ausschaltungen und das Ende", jubel.length >= 2, jubel.length + " Rufe");
  pruefe("Ton kommt vom Ton-Knopf abhaengig", await seite.evaluate(() => {
    const vorher = window.__ton.length;
    document.getElementById("ton").click();          // stumm
    document.getElementById("play").click();         // Weiter -> Schleife wuerde starten
    const stumm = window.__ton.slice(vorher).every((t) => t.vol === 0);
    document.getElementById("ton").click();
    return stumm;
  }));
  // Die Messreihe muss stumm bleiben — sonst feuert eine Serie hunderte Effekte.
  const vorSerie = await seite.evaluate(() => window.__ton.length);
  await seite.evaluate(() => window.__arena.serieVon("tdm", 2));
  const nachSerie = await seite.evaluate(() => window.__ton.length);
  pruefe("Messreihe bleibt stumm", nachSerie === vorSerie, `${nachSerie - vorSerie} Toene`);
  pruefe("Ton: keine Konsolenfehler", fehler.length === 0, fehler.join(" | "));
  await seite.close();
}

// -----------------------------------------------------------------------------------
// 5. EINSATZLISTE (Chris' Punkt 5)
//
// Die stehende Figur der Kaderliste hat zwei Wege: die volle Ebenenliste (B_FIGUR) und
// den Rueckfall auf den einfachen Bauplan (BAU). B_FIGUR kennt nur die dreizehn Spieler
// der Beispielkader — JEDER Spieler aus einem echten Kader landet im Rueckfall, und der
// hing hinter der animierten Ansicht zurueck (kein Haar, keine Krone, keine Fluegel,
// keine Waffe ausser dem Bogen). Geprueft wird deshalb genau der Rueckfall, mit einem
// Kader aus BAU-Namen OHNE Ebenenliste.
// -----------------------------------------------------------------------------------
{
  const attribute = { power: 60, health: 70, stamina: 50, intelligence: 45, awareness: 30,
    determination: 55, speed: 40, dexterity: 50, charisma: 60, will: 55, spirit: 45, torment: 40 };
  const mach = (n, i) => ({ n, c: "Warlord", r: "Human", sub: ["Knight"], tp: ["Fair"], tn: ["Renegade"],
    row: Math.floor(i / 2), d: { tdm: 60 + i, spurt: 40 + i }, a: attribute });
  // Inefinna/Serena: Krone. Elyon/Harbinger: Fluegel. Tavascron/Cyrn: nichts auf dem Kopf
  // (die beiden sind die Gegenprobe — bei ihnen darf ueber dem Kopf nichts stehen).
  const heim = ["Inefinna", "Elyon", "Serena", "Tavascron", "Harbinger", "Cyrn"].map(mach);
  const gast = ["Sweet Dreams", "Caldor", "Umbra", "Kora", "Phantomblade", "Isuzu"].map(mach);

  const seite = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const fehler = [];
  hoerZu(seite, fehler);
  await seite.addInitScript(({ heim, gast }) => { window.__olyArenaKader = { heim, gast, meta: {} }; }, { heim, gast });
  await seite.goto(basis + "/mockups/battle-mode.html");
  await seite.waitForFunction(() => !!window.__arena, null, { timeout: 30000 });
  await seite.waitForTimeout(2000);
  console.log("\nEINSATZLISTE MIT ECHT-AEHNLICHEM KADER");
  const figuren = await seite.evaluate(() => {
    const raus = [];
    for (const reihe of document.querySelectorAll("#plist .prow")) {
      const name = reihe.querySelector(".pnm b").textContent;
      const c = reihe.querySelector("canvas");
      if (!c) { raus.push({ name, leer: true }); continue; }
      const g = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let deckend = 0, kopfhoch = 0;
      for (let i = 3; i < g.length; i += 4) {
        if (g[i] < 40) continue;
        deckend++;
        // Die obersten fuenf Zeilen der 50px hohen Figur: dort sitzt nur Kopfschmuck.
        if (Math.floor((i - 3) / 4 / c.width) < 5) kopfhoch++;
      }
      raus.push({ name, deckend, kopfhoch, leer: false });
    }
    return raus;
  });
  for (const f of figuren) console.log("    " + f.name + ": " + f.deckend + " Pixel, davon " + f.kopfhoch + " ueber dem Kopf");
  pruefe("jede Figur der Einsatzliste ist gezeichnet", figuren.length > 0 && figuren.every((f) => !f.leer && f.deckend > 200));
  const mitKrone = figuren.filter((f) => ["Inefinna", "Serena"].includes(f.name));
  pruefe("Kronentraeger haben Kopfschmuck ueber dem Kopf", mitKrone.length === 2 && mitKrone.every((f) => f.kopfhoch > 0),
    mitKrone.map((f) => f.name + ":" + f.kopfhoch).join(", "));
  const ohneKrone = figuren.filter((f) => ["Tavascron", "Cyrn"].includes(f.name));
  pruefe("Figuren ohne Kopfschmuck haben dort nichts", ohneKrone.length === 2 && ohneKrone.every((f) => f.kopfhoch === 0),
    ohneKrone.map((f) => f.name + ":" + f.kopfhoch).join(", "));
  pruefe("Einsatzliste: keine Konsolenfehler", fehler.length === 0, fehler.join(" | "));
  await seite.close();
}

await browser.close();
server.close();

const gefehlt = befunde.filter((b) => !b.ok);
console.log("\n" + (befunde.length - gefehlt.length) + " von " + befunde.length + " Pruefungen bestanden.");
if (gefehlt.length) {
  console.log("Offen:\n" + gefehlt.map((b) => "  - " + b.name + (b.notiz ? " (" + b.notiz + ")" : "")).join("\n"));
  process.exitCode = 1;
}

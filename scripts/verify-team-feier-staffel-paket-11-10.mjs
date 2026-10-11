// VERIFIKATION TEAM-FEIER STAFFEL (Phase 2, 11.10., Klasse A -- reine Anzeige).
// docs/design/team-publikum-feiermomente-konzept-30-09.md Abschnitt 3.3, Vorbilder Phase 1
// (hebenFeierAmUrteil/Gewichtheben, Bruch-Haken/Breaking, s. verify-team-feier-30-09.mjs).
//
// Faehrt Staffel-Rennen im deterministischen Sonden-Modus (window.__arena.sondenLauf, jetztMs()
// = Sonden-Uhr) TICK FUER TICK und prueft jeden Ausloeser gegen ein EIGENES Orakel aus dem
// Laeuferzustand -- nicht gegen die Feier-Liste selbst:
//
//   (U1) saubere Uebergabe: im Tick, in dem ein Geber den Stab abgibt (aktiv -> nicht aktiv,
//        nicht im Ziel) und u.gestolpert==0 ist, entsteht eine neue Feier "klein" fuer SEINE
//        Seite -- ausser eine gleich starke/staerkere Feier derselben Seite laeuft schon
//        (Dosis-Regel des Baukastens, dann darf nichts Neues kommen).
//   (U2) Fehlwechsel (u.gestolpert>0): KEINE neue Feier fuer die Seite des Gebers, dafuer
//        "klein" mit raunen fuer die Gegenseite; drei Ticks spaeter sackt das Publikum der
//        patzenden Seite ein (dy>0).
//   (F)  Fuehrungswechsel: jede neue Protokollzeile "uebernimmt die Fuehrung" bringt im selben
//        Tick "mittel" fuer genau die Seite, die uebernimmt.
//   (Z)  Team im Ziel: im Tick, in dem ein Schlusslaeufer `fertig` wird, "gross", wenn der
//        Schlusslaeufer der Gegenseite VOR diesem Tick noch nicht fertig war, sonst "klein".
//   (E)  Rennen entschieden: im ersten `done`-Tick "finale" fuer den Sieger laut #score.
//   (H)  Bild: waehrend einer eigenen Feier ist die Dimmung aufgehoben (feiert==true) fuer alle
//        Publikumsfiguren der Seite; ausserhalb nie. Huepfer nur fuer Publikum (nie fuer den
//        gerade Laufenden).
//   (W)  Anfeuern-Welle: wippt (anfeuern<0) nur, wer an einer Zone steht, der sich der eigene
//        aktive Laeufer bis auf < 0,12 Runde naehert; Amplitude <= 3 px; kommt fuer beide
//        Seiten wirklich vor.
//   (S)  Sichtprobe: Leinwand + Panel bei einer Uebergabe, beim Fuehrungswechsel, beim
//        Zieleinlauf (gross) und im Finale -> Ausgabeordner (Standard tmp/, gitignored).
//   (I)  Isolation gegen die Engine VOR diesem Paket (git merge-base mit origin/main bzw. der
//        Elternstand des Paket-Commits): disziplinProbe() fuer alle zwanzig Disziplinen und
//        einflussVon() fuer Staffel bit-identisch; sondenLauf() Staffel bis done (done-Tick,
//        Endstand, Protokollzeilen) identisch; Spurt/Time-Trial-Leinwand nach 900 Sonden-Ticks
//        PIXELGLEICH (jede andere Bahn zeichnet ohne Feier-Publikum).
//   (P)  keine pageerror.
//
// Rennen: die fuenf Paarungen aus data/generated/kaderfamilie-live-save.json (falls vorhanden)
// je in beiden Richtungen plus der eingebaute Kader -- so lange, bis jeder Ausloeser mindestens
// einmal organisch beobachtet wurde (Fehlwechsel und Fuehrungswechsel sind selten).
//
// Aufruf: node scripts/verify-team-feier-staffel-paket-11-10.mjs [ausgabeOrdner] [--ohne-isolation | --nur-isolation]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };
const args = process.argv.slice(2);
const OHNE_ISOLATION = args.includes("--ohne-isolation");
const NUR_ISOLATION = args.includes("--nur-isolation");
const ausgabeOrdner = args.find((a) => !a.startsWith("--")) || path.join(WURZEL, "tmp", "team-feier-staffel-11-10");
mkdirSync(ausgabeOrdner, { recursive: true });

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

let alleOk = true;
const pruefe = (ok, text) => { console.log(`${ok ? "OK    " : "FEHLER"} ${text}`); if (!ok) alleOk = false; };

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
const fehler = [];

async function neueSeite(engineQuelle) {
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  if (engineQuelle) {
    await seite.route("**/mockups/battle-mode.engine.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: engineQuelle }));
  }
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 60000 });
  return seite;
}

const kaderPfad = path.join(WURZEL, "data", "generated", "kaderfamilie-live-save.json");
const familie = existsSync(kaderPfad)
  ? JSON.parse(readFileSync(kaderPfad, "utf8")).varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast }))
  : [];

// EIN RENNEN, komplett im Browser (eine evaluate()-Rundreise): Tick fuer Tick sondenLauf(1),
// Orakel aus staffelFeierProbe()/#protokoll, neue Feiern aus teamFeierStand() (nr waechst).
// `schnapp` (optional): Tick-Nummern, an denen das Skript danach Bilder ziehen will, kommen
// als Ereignisliste zurueck; die Bilder selbst entstehen in einem zweiten, identischen Lauf.
function rennenImBrowser(kader) {
  const A = window.__arena;
  A.endstandNachlauf(true);
  if (kader) A.kaderSetzen(kader);
  A.setDisc("staffel");
  document.getElementById("einlauf").hidden = true;
  const RANG = ["klein", "mittel", "gross", "finale"];
  const DAUER = { klein: 600, mittel: 1200, gross: 2400, finale: 3500 };
  const prot = document.getElementById("protokoll");
  let protN = prot ? prot.children.length : 0;
  let maxNr = Math.max(0, ...A.teamFeierStand().map((f) => f.nr));
  let vor = A.staffelFeierProbe();
  const jeSeite = Math.max(...vor.map((x) => x.bein)) + 1;
  const ereignisse = [], befunde = [];
  let laufend = []; // Feier-Liste VOR diesem Tick (fuer die Dosis-Regel)
  let n = 0, warDone = false, publikumHuepftMax = 0, aktivHuepft = 0;
  const welle = { an: [0, 0], falsch: 0, verpasst: 0, kandidaten: 0, minDy: 0 };
  const dimm = { ok: 0, falsch: 0 };
  const sackPruef = []; // {bis, seite}
  const zuletzt = (s, jetzt) => laufend.filter((f) => f.seite === s && jetzt - f.seitMs >= 0 && jetzt - f.seitMs < DAUER[f.stufe]);
  while (n < 60 * 60 * 8) {
    const davor = A.teamFeierStand();
    const jetztVor = A.endstandNachlaufStatus().jetztMs;
    A.sondenLauf(1); n++;
    const jetzt = A.endstandNachlaufStatus().jetztMs;
    const p = A.staffelFeierProbe();
    const stand = A.teamFeierStand();
    const neu = stand.filter((f) => f.nr > maxNr);
    if (neu.length) maxNr = Math.max(...neu.map((f) => f.nr));
    laufend = davor;
    const dosisBlockt = (s, stufe) => zuletzt(s, jetzt).some((f) => RANG.indexOf(f.stufe) >= RANG.indexOf(stufe));
    const erwartet = [];
    // --- Uebergaben (U1/U2)
    for (const u of p) {
      const v = vor.find((x) => x.id === u.id);
      if (v && v.aktiv && !u.aktiv && !u.fertig) {
        if (u.gestolpert > 0) erwartet.push({ typ: "fehlwechsel", seite: 1 - u.seite, stufe: "klein", geberSeite: u.seite, raunen: true });
        else erwartet.push({ typ: "uebergabe", seite: u.seite, stufe: "klein" });
      }
      // --- Ziel (Z)
      if (v && !v.fertig && u.fertig && u.bein === jeSeite - 1) {
        const gegnerVor = vor.find((x) => x.seite !== u.seite && x.bein === jeSeite - 1);
        const gegnerJetzt = p.find((x) => x.seite !== u.seite && x.bein === jeSeite - 1);
        // Beide Schlusslaeufer im SELBEN Tick: die Reihenfolge in rennFertig entscheidet (von
        // aussen nicht lesbar) -- dann reicht gross ODER klein, der Abgleich unten nimmt jede.
        const gleichzeitig = gegnerVor && !gegnerVor.fertig && gegnerJetzt && gegnerJetzt.fertig;
        erwartet.push({ typ: "ziel", seite: u.seite, stufe: gegnerVor && !gegnerVor.fertig ? "gross" : "klein", gleichzeitig });
      }
    }
    // --- Fuehrungswechsel (F)
    if (prot) {
      for (let i = protN; i < prot.children.length; i++) {
        const t = prot.children[i].textContent;
        if (/übernimmt die Führung/.test(t)) {
          const seite = prot.children[i].querySelector(".h") ? 0 : 1;
          erwartet.push({ typ: "fuehrung", seite, stufe: "mittel" });
        }
      }
      protN = prot.children.length;
    }
    // --- Rennen entschieden (E)
    if (A.vorbei() && !warDone) {
      warDone = true;
      const z = (document.getElementById("score").textContent.match(/\d+/g) || []).map(Number);
      const sieger = z.length >= 2 ? (z[0] > z[1] ? 0 : z[1] > z[0] ? 1 : null) : null;
      if (sieger != null) erwartet.push({ typ: "finale", seite: sieger, stufe: "finale" });
    }
    // Abgleich: jede Erwartung braucht eine passende NEUE Feier -- oder die Dosis-Regel blockt.
    // Mehrere Erwartungen derselben Seite im selben Tick (z.B. Ziel + Finale): die staerkste zaehlt.
    const genutzt = new Set();
    for (const e of erwartet.sort((a, b) => RANG.indexOf(b.stufe) - RANG.indexOf(a.stufe))) {
      const treffer = neu.find((f) => !genutzt.has(f.nr) && f.seite === e.seite
        && (f.stufe === e.stufe || (e.gleichzeitig && (f.stufe === "gross" || f.stufe === "klein"))) && (!e.raunen || f.raunen));
      const ueberdeckt = !treffer && (dosisBlockt(e.seite, e.stufe)
        || neu.some((f) => f.seite === e.seite && RANG.indexOf(f.stufe) >= RANG.indexOf(e.stufe)));
      if (treffer) genutzt.add(treffer.nr);
      const ok = !!treffer || ueberdeckt;
      if (e.typ === "fehlwechsel") {
        const eigene = neu.filter((f) => f.seite === e.geberSeite && f.stufe === "klein" && !f.raunen);
        if (eigene.length) befunde.push(`Tick ${n}: Fehlwechsel, aber Feier fuer die patzende Seite ${e.geberSeite}`);
        // Einsacken nur pruefen, wenn die raunende Feier wirklich entstand (blockt die
        // Dosis-Regel sie, weil die Gegenseite gerade schon feiert, gibt es auch kein Raunen).
        if (treffer) sackPruef.push({ tick: n + 3, seite: e.geberSeite });
      }
      ereignisse.push({ tick: n, ...e, ok, dosis: !treffer && ueberdeckt, anker: treffer ? treffer.anker : null });
      if (!ok) befunde.push(`Tick ${n}: ${e.typ} erwartet ${e.stufe} fuer Seite ${e.seite}, neu: ${JSON.stringify(neu)}`);
    }
    // Keine Feier ohne Erwartung (sonst feuert irgendwo ein Haken zu viel).
    for (const f of neu) if (!genutzt.has(f.nr) && !erwartet.some((e) => e.seite === f.seite)) befunde.push(`Tick ${n}: unerwartete Feier ${JSON.stringify(f)}`);
    // --- Einsacken nach Fehlwechsel
    for (const s of sackPruef.filter((x) => x.tick === n)) {
      const pub = p.filter((x) => x.seite === s.seite && x.publikum);
      const sackt = pub.filter((x) => x.dy > 0).length;
      ereignisse.push({ tick: n, typ: "sackt", seite: s.seite, ok: pub.length > 0 && sackt === pub.length, sackt, von: pub.length });
      if (!(pub.length > 0 && sackt === pub.length)) befunde.push(`Tick ${n}: nach Fehlwechsel sacken nur ${sackt}/${pub.length} der Seite ${s.seite}`);
    }
    // --- Bild (H): Dimm-Aufhebung genau waehrend eigener Feier; Huepfer nie am Laufenden
    for (const u of p) {
      if (!u.publikum) { if (u.dy !== 0) aktivHuepft++; continue; }
      const eigeneLaeuft = stand.some((f) => f.seite === u.seite && jetzt - f.seitMs >= 0 && jetzt - f.seitMs <= DAUER[f.stufe]);
      if (u.feiert === eigeneLaeuft) dimm.ok++; else dimm.falsch++;
      publikumHuepftMax = Math.min(publikumHuepftMax, u.dy);
    }
    // --- Welle (W)
    if (!A.vorbei()) {
      for (const u of p) {
        if (!u.publikum || u.aktiv || u.fertig) continue;
        const l = p.find((x) => x.seite === u.seite && x.aktiv && !x.fertig);
        if (!l) continue;
        const vorAus = (((u.anteil - l.anteil) % 1) + 1) % 1;
        welle.minDy = Math.min(welle.minDy, u.anfeuern);
        if (Math.abs(vorAus - 0.12) < 0.012) continue; // Grenzsaum (Stolper-Festhaltepunkt)
        if (vorAus < 0.12) { welle.kandidaten++; if (u.anfeuern < 0) welle.an[u.seite]++; else welle.verpasst++; }
        else if (u.anfeuern < 0) welle.falsch++;
      }
    }
    vor = p;
    if (warDone && !A.endstandNachlaufStatus().aktiv) break;
  }
  return { n, ereignisse, befunde, welle, dimm, publikumHuepftMax, aktivHuepft };
}

try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  if (!NUR_ISOLATION) {
    const seite = await neueSeite(null);
    await seite.click("#t2");
    const laeufe = [{ label: "eingebauter Kader", kader: null }];
    for (const v of familie) {
      laeufe.push({ label: v.label, kader: { heim: v.heim, gast: v.gast } });
      laeufe.push({ label: v.label + " (getauscht)", kader: { heim: v.gast, gast: v.heim } });
    }
    const gesehen = { uebergabe: 0, fehlwechsel: 0, fuehrung: 0, ziel: 0, finale: 0, sackt: 0, zielGross: 0, zielKlein: 0 };
    const alleBefunde = [];
    let welleSumme = { an: [0, 0], falsch: 0, verpasst: 0, kandidaten: 0, minDy: 0 }, dimmSumme = { ok: 0, falsch: 0 }, huepfMax = 0, aktivHuepft = 0;
    let bildLauf = null, ersterLauf = null;
    for (const l of laeufe) {
      // Nach einem Kadertausch fuer den eingebauten Kader die Seite neu laden (kaderSetzen kennt
      // kein "zurueck") -- der eingebaute Kader laeuft deshalb als ERSTER.
      const r = await seite.evaluate(rennenImBrowser, l.kader);
      for (const e of r.ereignisse) {
        if (e.ok) gesehen[e.typ] = (gesehen[e.typ] || 0) + 1;
        if (e.typ === "ziel" && e.ok) gesehen[e.stufe === "gross" ? "zielGross" : "zielKlein"]++;
      }
      alleBefunde.push(...r.befunde.map((b) => `[${l.label}] ${b}`));
      for (const s of [0, 1]) welleSumme.an[s] += r.welle.an[s];
      welleSumme.falsch += r.welle.falsch; welleSumme.verpasst += r.welle.verpasst; welleSumme.kandidaten += r.welle.kandidaten;
      welleSumme.minDy = Math.min(welleSumme.minDy, r.welle.minDy);
      dimmSumme.ok += r.dimm.ok; dimmSumme.falsch += r.dimm.falsch;
      huepfMax = Math.min(huepfMax, r.publikumHuepftMax); aktivHuepft += r.aktivHuepft;
      const typen = r.ereignisse.filter((e) => e.typ !== "sackt").map((e) => `${e.typ}:${e.seite}:${e.stufe}${e.dosis ? "(dosis)" : ""}`);
      console.log(`      ${l.label.padEnd(42)} ${r.n} Ticks · ${typen.length} Ausloeser · ${typen.filter((t) => /fehl|fuehr|ziel|finale/.test(t)).join(" ")}`);
      if (!ersterLauf) ersterLauf = { ...l, ereignisse: r.ereignisse };
      if (!bildLauf && r.ereignisse.some((e) => e.typ === "fuehrung" && e.ok && !e.dosis)) bildLauf = { ...l, ereignisse: r.ereignisse };
      if (gesehen.fehlwechsel && gesehen.fuehrung && gesehen.zielGross && gesehen.zielKlein && gesehen.finale && laeufe.indexOf(l) >= 2) break;
    }
    console.log(`      beobachtet: ${JSON.stringify(gesehen)}`);
    pruefe(alleBefunde.length === 0, `(U/F/Z/E) jeder Ausloeser passt zum Orakel${alleBefunde.length ? ": " + alleBefunde.slice(0, 6).join(" | ") : ""}`);
    pruefe(gesehen.uebergabe > 0, `(U1) saubere Uebergabe -> klein fuer die eigene Seite (${gesehen.uebergabe}x organisch)`);
    pruefe(gesehen.fehlwechsel > 0 && gesehen.sackt > 0, `(U2) Fehlwechsel -> keine Feier der patzenden Seite, klein+raunen fuer die Gegenseite, Publikum sackt ein (${gesehen.fehlwechsel}x, eingesackt ${gesehen.sackt}x)`);
    pruefe(gesehen.fuehrung > 0, `(F) Fuehrungswechsel -> mittel fuer die uebernehmende Seite (${gesehen.fuehrung}x organisch)`);
    pruefe(gesehen.zielGross > 0 && gesehen.zielKlein > 0, `(Z) Team im Ziel -> gross fuer den Ersten (${gesehen.zielGross}x), klein fuer den Zweiten (${gesehen.zielKlein}x)`);
    pruefe(gesehen.finale > 0, `(E) Rennen entschieden -> finale fuer den Sieger laut #score (${gesehen.finale}x)`);
    pruefe(dimmSumme.falsch === 0 && dimmSumme.ok > 0 && aktivHuepft === 0 && huepfMax < -5,
      `(H) Dimmung aufgehoben genau waehrend eigener Feier (${dimmSumme.ok} Figur-Ticks richtig, ${dimmSumme.falsch} falsch); Laeufer huepft nie (${aktivHuepft}); hoechster Publikums-Huepfer ${(-huepfMax).toFixed(1)} px`);
    const quote = welleSumme.kandidaten ? 1 - welleSumme.verpasst / welleSumme.kandidaten : 0;
    pruefe(welleSumme.falsch === 0 && welleSumme.an[0] > 0 && welleSumme.an[1] > 0 && welleSumme.minDy >= -3.0001 && quote > 0.85,
      `(W) Anfeuern-Welle nur an der Zone vor dem eigenen Laeufer: Heim ${welleSumme.an[0]}, Gast ${welleSumme.an[1]} Figur-Ticks, ausserhalb ${welleSumme.falsch}, Nulldurchgaenge ${(100 * (1 - quote)).toFixed(1)} %, tiefster Ausschlag ${(-welleSumme.minDy).toFixed(2)} px`);

    // ---- (S) Sichtprobe: derselbe Lauf noch einmal (deterministisch), Bilder an den Ausloesern.
    if (!bildLauf) bildLauf = ersterLauf; // ohne Fuehrungswechsel-Lauf: Uebergabe/Ziel/Finale
    const seite2 = await neueSeite(null);
    // PRODUKTIONSMODUS wie im Host (FoundationBattleArenaHost.tsx): dark + .im-spiel.
    await seite2.addStyleTag({ content: "body{background:#0B1018}" });
    await seite2.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      const wurzel = document.querySelector(".oly-battle-arena");
      wurzel?.setAttribute("data-theme", "dark");
      wurzel?.classList.add("im-spiel");
    });
    await seite2.click("#t2");
    await seite2.evaluate((k) => { const A = window.__arena; A.endstandNachlauf(true); if (k) A.kaderSetzen(k); A.setDisc("staffel"); document.getElementById("einlauf").hidden = true; }, bildLauf.kader);
    await seite2.waitForTimeout(1500); // Sprites laden
    await seite2.evaluate((k) => { const A = window.__arena; if (k) A.kaderSetzen(k); A.setDisc("staffel"); document.getElementById("einlauf").hidden = true; }, bildLauf.kader);
    const ev = bildLauf.ereignisse;
    const marken = [];
    const ueb = ev.find((e) => e.typ === "uebergabe" && !e.dosis); if (ueb) marken.push({ tick: ueb.tick + 4, name: "1-uebergabe-plus4" });
    const fue = ev.find((e) => e.typ === "fuehrung" && !e.dosis); if (fue) { marken.push({ tick: fue.tick + 8, name: "2-fuehrungswechsel-plus8" }); marken.push({ tick: fue.tick + 30, name: "3-fuehrungswechsel-plus30" }); }
    const zg = ev.find((e) => e.typ === "ziel" && e.stufe === "gross"); if (zg) { marken.push({ tick: zg.tick + 6, name: "4-ziel-gross-plus6" }); marken.push({ tick: zg.tick + 20, name: "5-ziel-gross-plus20" }); }
    const fi = ev.find((e) => e.typ === "finale"); if (fi) { marken.push({ tick: fi.tick + 20, name: "6-finale-plus20" }); marken.push({ tick: fi.tick + 50, name: "7-finale-plus50" }); }
    marken.sort((a, b) => a.tick - b.tick);
    let stand = 0;
    for (const m of marken) {
      await seite2.evaluate((k) => window.__arena.sondenLauf(k), m.tick - stand); stand = m.tick;
      const out = path.join(ausgabeOrdner, `staffel-${m.name}.png`);
      await (await seite2.$("#p2 .frame")).screenshot({ path: out });
      await (await seite2.$("#cv")).screenshot({ path: out.replace(/\.png$/, "-leinwand.png") });
      // Die Leinwand ROH (volle Aufloesung, ohne DOM-Overlays) -- zeigt, was die Feier zeichnet.
      const roh = await seite2.evaluate(() => document.getElementById("cv").toDataURL("image/png"));
      writeFileSync(out.replace(/\.png$/, "-roh.png"), Buffer.from(roh.split(",")[1], "base64"));
      // Verdeckt nichts Wichtiges: Score-Bug/Anzeigetafel sind DOM ueber der Leinwand und
      // bleiben sichtbar (die Feier zeichnet nur in die Leinwand).
      const bug = await seite2.evaluate(() => { const b = document.getElementById("bbug"); const s = document.getElementById("score"); return { bug: b ? !b.hidden : null, score: s ? s.textContent : null }; });
      console.log(`      [Bild] ${m.name} (Tick ${m.tick}) Score-Bug sichtbar ${bug.bug}, #score "${bug.score}" -> ${out}`);
    }
    pruefe(marken.length >= 3, `(S) Sichtprobe: ${marken.length} Bilder (${bildLauf.label}) -> ${ausgabeOrdner}`);
    await seite2.close();
    await seite.close();
  }

  // ===================================================================== I
  console.log("\n== I: Isolation ==");
  if (OHNE_ISOLATION) {
    console.log("      uebersprungen (--ohne-isolation)");
  } else {
    try {
      const engineJetzt = readFileSync(path.join(PUBLIC, "mockups", "battle-mode.engine.js"), "utf8");
      let basis = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: WURZEL, encoding: "utf8" }).trim();
      let quelle = execFileSync("git", ["show", `${basis}:public/mockups/battle-mode.engine.js`], { cwd: WURZEL, encoding: "utf8", maxBuffer: 64 << 20 });
      // Liegt das Paket schon auf main (nach dem Merge), ist die Basis der Elternstand des Paket-Commits.
      if (quelle === engineJetzt || quelle.includes("function staffelFeierUebergabe(")) {
        const vorPaket = execFileSync("git", ["log", "--format=%H", "--reverse", "-S", "function staffelFeierUebergabe(", "--", "public/mockups/battle-mode.engine.js"], { cwd: WURZEL, encoding: "utf8" }).trim().split("\n")[0];
        basis = vorPaket + "~1";
        quelle = execFileSync("git", ["show", `${basis}:public/mockups/battle-mode.engine.js`], { cwd: WURZEL, encoding: "utf8", maxBuffer: 64 << 20 });
      }
      const fam = familie.slice(0, 2);
      const messe = async (q) => {
        const s = await neueSeite(q);
        // Kontrolle der Umleitung: die Basis-Engine kennt staffelFeierProbe() nicht, die neue schon.
        const kennt = await s.evaluate(() => typeof window.__arena.staffelFeierProbe === "function");
        if (kennt !== !q) throw new Error(`falsche Engine ausgeliefert (staffelFeierProbe ${kennt ? "vorhanden" : "fehlt"}, erwartet ${q ? "Basis" : "neu"})`);
        const ds = await s.evaluate(() => window.__arena.motoren());
        const out = {};
        for (const d of ds) {
          out[d] = await s.evaluate(([dd, f]) => ({
            probe: window.__arena.disziplinProbe(dd, { n: 2, ...(f.length ? { kaderFamilie: f } : {}) }),
            einfluss: dd === "staffel" ? window.__arena.einflussVon(dd, 1) : null,
          }), [d, fam]);
        }
        // sondenLauf() Staffel bis done (ruft updateHudBahn und stepStaffel mit stumm=false --
        // genau der Pfad, in dem die neuen Haken sitzen): done-Tick, Endstand, Protokollzeilen.
        out.__sonde = await s.evaluate(() => {
          const A = window.__arena; if (A.sendungsrahmen) A.sendungsrahmen(false);
          A.setDisc("staffel");
          let n = 0; while (!A.vorbei() && n < 60 * 60 * 15) { A.sondenLauf(20); n += 20; }
          const p = document.getElementById("protokoll");
          return { n, score: document.getElementById("score").textContent, feed: document.getElementById("feed").children.length,
            protokoll: p ? [...p.children].map((c) => c.textContent) : null };
        });
        // Andere Bahnen zeichnen pixelgleich (kein Feier-Publikum ausser Staffel).
        out.__pixel = {};
        for (const d of ["spurt", "time-trial"]) {
          out.__pixel[d] = await s.evaluate((dd) => {
            const A = window.__arena; A.setDisc(dd); document.getElementById("einlauf").hidden = true;
            A.sondenLauf(900); return document.getElementById("cv").toDataURL("image/png");
          }, d);
          out.__pixel[d] = createHash("sha256").update(out.__pixel[d]).digest("hex").slice(0, 16);
        }
        await s.close();
        return out;
      };
      const vorher = await messe(quelle);
      const nachher = await messe(null);
      pruefe(isDeepStrictEqual(vorher.__sonde, nachher.__sonde),
        `(I2) sondenLauf() Staffel bis done: done-Tick ${nachher.__sonde.n}, Endstand "${nachher.__sonde.score}", ${nachher.__sonde.protokoll ? nachher.__sonde.protokoll.length : "?"} Protokollzeilen ${isDeepStrictEqual(vorher.__sonde, nachher.__sonde) ? "identisch" : "ABWEICHEND: " + JSON.stringify(vorher.__sonde).slice(0, 200)}`);
      pruefe(isDeepStrictEqual(vorher.__pixel, nachher.__pixel),
        `(I3) Spurt/Time-Trial-Leinwand nach 900 Sonden-Ticks pixelgleich: ${JSON.stringify(nachher.__pixel)}${isDeepStrictEqual(vorher.__pixel, nachher.__pixel) ? "" : " vs Basis " + JSON.stringify(vorher.__pixel)}`);
      delete vorher.__sonde; delete nachher.__sonde; delete vorher.__pixel; delete nachher.__pixel;
      const ds = Object.keys(nachher);
      const abweichend = ds.filter((d) => !isDeepStrictEqual(vorher[d], nachher[d]));
      pruefe(ds.length === 20 && abweichend.length === 0 && Object.keys(vorher).length === 20,
        `(I) disziplinProbe(n=2${fam.length ? ", Kaderfamilie " + fam.length + " Varianten" : ""}) fuer ${ds.length} Disziplinen + einflussVon(staffel, n=1) gegen ${basis.slice(0, 10)}: ${abweichend.length ? "ABWEICHUNG in " + abweichend.join(",") : "bit-identisch"}`);
    } catch (e) {
      pruefe(false, "(I) Isolationsvergleich nicht ausfuehrbar: " + String(e).slice(0, 300));
    }
  }

  pruefe(fehler.length === 0, `(P) Seitenfehler: ${fehler.length ? fehler.slice(0, 5).join(" | ") : "keine"}`);
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);

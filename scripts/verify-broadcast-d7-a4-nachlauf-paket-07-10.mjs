// VERIFIKATION SENDUNGSRAHMEN-PAKET (07.10., Klasse T, von Chris freigegeben):
// D7 "Finale in Echtzeit", A4 "Anpfiff-Countdown" (+ A3 Stinger) und Endstand-Nachlauf.
// docs/design/broadcast-d7-a4-fable-empfehlung-02-10.md Abschnitt 4 (Chris' Entscheidungen),
// docs/design/team-publikum-feiermomente-konzept-30-09.md Abschnitt 2.6 (Nachlauf).
//
//   A  Anpfiff-Countdown
//     (A1) jede der 20 Disziplinen hat ein Startritual, 1,5-3 s bei 1×
//     (A2) je Ritual-Gruppe einmal live: Stufentexte in der Reihenfolge der Tabelle 3.3,
//          `running` erst nach Ablauf (Dauer ±150 ms), Stinger um das Ende herum sichtbar
//     (A3) Tempo >=2× vor dem Klick: kein Countdown, sofort laufend
//     (A4) zweiter Klick waehrend des Countdowns = sofortiger Anpfiff
//     (A5) kein Countdown beim Fortsetzen nach Pause
//     (A6) nach reset() wieder Countdown
//     (A7) Sonden-Schalter anpfiffCountdown(false): kein Countdown
//     (A8) Tempo waehrend des Countdowns auf 2×: Countdown bricht ab, Spiel laeuft
//   D  Finale in Echtzeit
//     (D1) Bedingung (reine Funktion) fuer alle drei Feldspiele: Schwellen 3/1/8, 30
//          Zuschau-Sekunden (Hockey: ZEIT_DEHNUNG 2 -> 15 Sim-s), NACHSPIELZEIT (restRoh<0)
//          ZAEHLT MIT, letzte Periode, keine Pause
//     (D2) Hysterese: der Riegel faellt nie zurueck (finaleRiegelProbe, dieselbe Funktion wie loop())
//     (D3) live bei 4×: das Finale greift (wirksam 1×, Tick-Rate faellt auf ~60/s, Anzeige
//          "Tempo 1× · Finale (Klick: zurück auf 4×)"), `speed` bleibt 4; Klick auf #spd stellt
//          4× SOFORT wieder her (nicht verschluckt, Rate wieder ~240/s, kein Rueckfall bis
//          Spielende); Endergebnis bit-identisch zum reinen sondenLauf() desselben Spiels
//     (D4) dauerhafter Schalter: finaleEchtzeit(false) -> kein Drosseln trotz Bedingung
//   N  Endstand-Nachlauf
//     (N1) Sonden-Zeit: #endstand erscheint genau 210 Ticks (3,5 s) nach `done`, Siegerzeile
//          sofort; mit endstandNachlauf(false) im selben Tick (altes Verhalten)
//     (N2) Echtzeit (Feldspiel/Bahn/Buehne je einmal): Abstand done -> #endstand 3,5 s ±150 ms,
//          Score-Bug bleibt waehrend des Nachlaufs stehen
//     (N3) Gewichtheben: im Nachlauf laeuft die letzte Hebung bis zur Lampe ab (Befund B4)
//   T  jedes Skript, das warteAufAnpfiff()/sendungsrahmenAus() aufruft, importiert den Helfer
//   I  Isolation: disziplinProbe() UND einflussVon() fuer ALLE ZWANZIG Disziplinen bit-
//      identisch zwischen der Engine vor diesem Paket (git merge-base mit origin/main) und
//      jetzt -- die headless Mess-Pfade (miss-alle-disziplinen.mjs, messe-arena-einfluss.mjs)
//      sehen D7/A4/Nachlauf nicht. (I2) dazu der sondenLauf()-Pfad bis `done` (done-Tick,
//      Endstand, Tickerzeilen) fuer je eine Disziplin je Chassis plus Gewichtheben.
//   F  keine pageerror
//
// Aufruf: node scripts/verify-broadcast-d7-a4-nachlauf-paket-07-10.mjs [--ohne-isolation]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const OHNE_ISOLATION = process.argv.includes("--ohne-isolation");

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
  const seite = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  if (engineQuelle) {
    await seite.route("**/mockups/battle-mode.engine.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: engineQuelle }));
  }
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 60000 });
  return seite;
}

// Tempo per #spd-Klick auf den Zielwert drehen (dieselbe Taste wie ein Zuschauer).
async function setzeTempo(seite, ziel) {
  for (let i = 0; i < 4; i++) {
    const s = await seite.evaluate(() => window.__arena.tempoStatus().speed);
    if (s === ziel) return;
    await seite.evaluate(() => document.getElementById("spd").click());
  }
  throw new Error("Tempo " + ziel + " nicht erreichbar");
}

try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await neueSeite(null);
  await seite.click("#t2");

  // ===================================================================== A
  console.log("\n== A: Anpfiff-Countdown ==");
  const motoren = await seite.evaluate(() => window.__arena.motoren());
  const rituale = await seite.evaluate((ds) => ds.map((d) => ({ d, r: window.__arena.anpfiffRitual(d) })), motoren);
  const ohne = rituale.filter((x) => !x.r || x.r.dauer < 1500 || x.r.dauer > 3000);
  pruefe(motoren.length === 20 && ohne.length === 0,
    `(A1) ${motoren.length} Disziplinen, alle mit Startritual 1,5-3 s${ohne.length ? " -- fehlt/ausserhalb: " + ohne.map((x) => x.d).join(",") : ""}`);

  // (A2) je Gruppe einmal live. Messung komplett IM Browser (rAF-genau), eine evaluate()-Rundreise.
  const GRUPPEN = ["spurt", "time-trial", "fechten", "tdm", "basketball", "speed-schach", "gewichtheben", "wettessen"];
  for (const d of GRUPPEN) {
    await seite.evaluate((dd) => window.__arena.setDisc(dd), d);
    await setzeTempo(seite, 1);
    const m = await seite.evaluate(() => new Promise((resolve) => {
      const A = window.__arena, r = A.anpfiffRitual();
      const t0 = performance.now();
      document.getElementById("play").click();
      const direkt = A.anpfiffStatus();
      const stingerVor = direkt.stingerZahl;
      const texte = []; let stingerAn = null, stingerAus = null, laeuftAb = null, tickAb = null, einlaufWegAb = null, frameMax = 0, tVor = 0;
      const schritt = () => {
        const t = performance.now() - t0, s = A.anpfiffStatus();
        frameMax = Math.max(frameMax, t - tVor); tVor = t;
        if (s.countdown && s.text && texte[texte.length - 1] !== s.text) texte.push(s.text);
        const st = document.getElementById("stinger");
        if (st && !st.hidden && stingerAn == null) stingerAn = t;
        if (st && st.hidden && stingerAn != null && stingerAus == null) stingerAus = t;
        if (s.laeuft && laeuftAb == null) laeuftAb = t;
        if (s.laeuft && s.ticks > 0 && tickAb == null) tickAb = t;
        if (document.getElementById("einlauf").hidden && einlaufWegAb == null) einlaufWegAb = t;
        if ((tickAb != null && (stingerAus != null || t > tickAb + 1500)) || t > 8000) resolve({ r, direkt, texte, stingerAn, stingerAus, laeuftAb, tickAb, einlaufWegAb, frameMax, stingerGestartet: A.anpfiffStatus().stingerZahl - stingerVor });
        else requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }));
    const soll = m.r.stufen.map((s) => s.txt);
    // Untergrenze hart (nie vor Ablauf des Rituals), Obergrenze um die laengste gemessene
    // Frame-Luecke erweitert: der Motor prueft den Countdown je requestAnimationFrame, auf einer
    // belasteten Maschine kommt der naechste Frame spaeter -- das ist Frame-Jitter, keine Logik.
    const spiel = 300 + 2 * m.frameMax; // bis zu zwei Frame-Luecken: Motor-Frame und Mess-Frame
    const dauerOk = m.laeuftAb != null && m.laeuftAb >= m.r.dauer - 20 && m.laeuftAb <= m.r.dauer + spiel;
    // Stinger: genau einmal gestartet (Zaehler des Motors). Die Sichtbarkeit selbst kann auf
    // einer belasteten Maschine zwischen zwei Frames fallen (450 ms < Frame-Luecke) -- dann nur
    // der Zaehler, sonst zusaetzlich das Zeitfenster.
    const stingerOk = m.stingerGestartet === 1 && (m.stingerAn == null
      ? m.frameMax > 450
      : m.stingerAn >= m.r.dauer - 225 - 20 && m.stingerAn <= m.r.dauer + spiel);
    pruefe(m.direkt.countdown && !m.direkt.laeuft && isDeepStrictEqual(m.texte, soll) && dauerOk && stingerOk
      && m.einlaufWegAb != null && m.einlaufWegAb >= m.r.dauer - 20,
      `(A2) ${d.padEnd(13)} ${JSON.stringify(m.texte)} · laeuft ab ${m.laeuftAb?.toFixed(0)} ms (soll ${m.r.dauer}, erster Tick ${m.tickAb?.toFixed(0)}) · Stinger ${m.stingerAn?.toFixed(0)}-${m.stingerAus?.toFixed(0)} ms · laengste Frame-Luecke ${m.frameMax.toFixed(0)} ms`);
  }

  // (A3) Tempo >= 2× vor dem Klick
  await seite.evaluate(() => window.__arena.setDisc("spurt"));
  for (const tempo of [2, 4]) {
    await setzeTempo(seite, tempo);
    await seite.evaluate(() => window.__arena.setDisc("spurt"));
    const s = await seite.evaluate(() => { document.getElementById("play").click(); return window.__arena.anpfiffStatus(); });
    pruefe(!s.countdown && s.laeuft, `(A3) Tempo ${tempo}×: kein Countdown, sofort laufend`);
  }

  // (A4) zweiter Klick = sofort; (A5) Pause/Fortsetzen ohne Countdown; (A6) reset -> wieder Countdown
  await setzeTempo(seite, 1);
  await seite.evaluate(() => window.__arena.setDisc("fechten"));
  const a4 = await seite.evaluate(() => new Promise((resolve) => {
    const A = window.__arena, p = document.getElementById("play");
    p.click();
    const vor = A.anpfiffStatus();
    setTimeout(() => {
      const t0 = performance.now(); p.click();
      const nach = A.anpfiffStatus();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ vor, nach, ticks: A.anpfiffStatus().ticks, ms: performance.now() - t0, einlauf: document.getElementById("einlauf").hidden, overlay: document.getElementById("anpfiff").hidden })));
    }, 400);
  }));
  pruefe(a4.vor.countdown && !a4.nach.countdown && a4.nach.laeuft && a4.ticks > 0 && a4.einlauf && a4.overlay,
    `(A4) zweiter Klick nach 400 ms: sofort laufend (Ticks ${a4.ticks} zwei Frames spaeter, Einlauf/Overlay weg)`);
  const a5 = await seite.evaluate(() => {
    const A = window.__arena, p = document.getElementById("play");
    p.click(); const pause = A.anpfiffStatus();
    p.click(); const weiter = A.anpfiffStatus();
    return { pause, weiter };
  });
  pruefe(!a5.pause.laeuft && !a5.pause.countdown && a5.weiter.laeuft && !a5.weiter.countdown,
    "(A5) Pause -> Weiter: kein Countdown beim Fortsetzen");
  const a6 = await seite.evaluate(() => {
    document.getElementById("reset").click();
    document.getElementById("play").click();
    const s = window.__arena.anpfiffStatus();
    document.getElementById("play").click(); // sofort, damit der Lauf nicht weiterwartet
    return s;
  });
  pruefe(a6.countdown && !a6.laeuft, "(A6) nach reset(): wieder Countdown");
  // (A7) Sonden-Schalter
  const a7 = await seite.evaluate(() => {
    const A = window.__arena; A.anpfiffCountdown(false); A.setDisc("wettessen");
    document.getElementById("play").click(); const s = A.anpfiffStatus(); A.anpfiffCountdown(true); return s;
  });
  pruefe(!a7.countdown && a7.laeuft, "(A7) anpfiffCountdown(false): kein Countdown");
  // (A8) Tempo waehrend des Countdowns auf 2×
  await seite.evaluate(() => window.__arena.setDisc("tdm"));
  await setzeTempo(seite, 1);
  const a8 = await seite.evaluate(() => new Promise((resolve) => {
    const A = window.__arena; document.getElementById("play").click(); const vor = A.anpfiffStatus();
    setTimeout(() => {
      document.getElementById("spd").click();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ vor, nach: A.anpfiffStatus(), tempo: A.tempoStatus().speed })));
    }, 300);
  }));
  pruefe(a8.vor.countdown && !a8.nach.countdown && a8.nach.laeuft && a8.tempo === 2,
    "(A8) #spd waehrend des Countdowns (-> 2×): Countdown bricht ab, Spiel laeuft");
  await setzeTempo(seite, 1);

  // ===================================================================== D
  console.log("\n== D: Finale in Echtzeit ==");
  const SCHWELLE = { basketball: 3, hockey: 1, football: 8 };
  for (const d of Object.keys(SCHWELLE)) {
    await seite.evaluate((dd) => window.__arena.setDisc(dd), d);
    const z = await seite.evaluate(() => window.__arena.finaleProbe().zustand);
    const zf = z.zeitFaktor, s = z.schwelle, P = z.perioden;
    const fall = (ueber) => seite.evaluate((zz) => window.__arena.finaleProbe(zz).bedingung,
      { perioden: P, viertel: P, viertelpause: false, restRoh: 10 / zf, zeitFaktor: zf, abstand: s, schwelle: s, ...ueber });
    const r = {
      grundfall: await fall({}),
      abstandPlus1: await fall({ abstand: s + 1 }),
      genau30: await fall({ restRoh: 30 / zf }),
      ueber30: await fall({ restRoh: 30.5 / zf }),
      nachspielzeit: await fall({ restRoh: -3 }),
      nachspielzeitWeit: await fall({ restRoh: -40, abstand: 0 }),
      vorletztePeriode: await fall({ viertel: P - 1 }),
      pause: await fall({ viertelpause: true }),
    };
    pruefe(s === SCHWELLE[d] && (d !== "hockey" || zf === 2) && r.grundfall && !r.abstandPlus1 && r.genau30 && !r.ueber30
      && r.nachspielzeit && r.nachspielzeitWeit && !r.vorletztePeriode && !r.pause,
      `(D1) ${d.padEnd(10)} Schwelle ${s}, zeitFaktor ${zf}: ${JSON.stringify(r)}`);
  }
  const riegel = await seite.evaluate(() => window.__arena.finaleRiegelProbe([false, true, false, false, true, false]));
  pruefe(isDeepStrictEqual(riegel, [false, true, true, true, true, true]),
    `(D2) Hysterese: Bedingung f,t,f,f,t,f -> Riegel ${JSON.stringify(riegel)} (faellt nie zurueck)`);

  // (D3) live. Erst per sondenLauf() die Tick-Nummer suchen, ab der die Bedingung erstmals gilt.
  let liveGeprueft = false;
  const endeTick = {}; // done-Tick je Feldspiel aus der Suche, fuer N2 weiterverwendet
  for (const d of ["football", "basketball", "hockey"]) {
    const such = await seite.evaluate((dd) => {
      const A = window.__arena; A.setDisc(dd);
      let n = 0, ab = null; const stueck = 10;
      while (n < 60 * 60 * 20 && !A.vorbei()) {
        A.sondenLauf(stueck); n += stueck;
        if (ab == null && A.finaleProbe().bedingung) ab = n;
      }
      return { ab, ende: n, endstand: document.getElementById("score").textContent };
    }, d);
    endeTick[d] = such.ende;
    console.log(`      ${d}: Bedingung ab Tick ${such.ab ?? "nie"} (Ende nach ${such.ende} Ticks, Endstand ${such.endstand})`);
    if (such.ab == null) continue;
    // Frisch dasselbe Spiel (feste Saat), bis 12 Zuschau-Sekunden vor dem Finale vorspulen, dann echt bei 4×.
    await seite.evaluate(([dd, vor]) => {
      const A = window.__arena; A.setDisc(dd); A.anpfiffCountdown(false); A.endstandNachlauf(false);
      A.sondenLauf(vor); A.sondenAus();
    }, [d, Math.max(0, such.ab - 12 * 60)]);
    await setzeTempo(seite, 4);
    const live = await seite.evaluate(() => new Promise((resolve) => {
      const A = window.__arena, p = document.getElementById("play");
      p.click();
      const proben = []; let finaleAb = null, anzeigeImFinale = null, geklicktAb = null, rueckfall = false,
        abstandUeberSchwelleImFinale = false, nachspielzeitImFinale = false;
      const t0 = performance.now();
      const schritt = () => {
        const t = performance.now() - t0, ts = A.tempoStatus(), as = A.anpfiffStatus(), fp = A.finaleProbe();
        proben.push({ t, ticks: as.ticks, drosselt: ts.drosselt, wirksam: ts.wirksam });
        if (ts.drosselt && finaleAb == null) { finaleAb = t; }
        if (ts.drosselt && finaleAb != null && t - finaleAb > 300 && anzeigeImFinale == null) anzeigeImFinale = ts.anzeige;
        if (ts.finaleAktiv && fp.zustand && fp.zustand.abstand > fp.zustand.schwelle) abstandUeberSchwelleImFinale = true;
        if (ts.finaleAktiv && fp.zustand && fp.zustand.restRoh < 0 && !as.done) nachspielzeitImFinale = true;
        // Rueckfall erst ab dem Frame NACH dem Klick pruefen (`ts` dieses Frames ist von davor).
        if (geklicktAb != null && t > geklicktAb && ts.drosselt) rueckfall = true;
        if (finaleAb != null && geklicktAb == null && t - finaleAb > 1500) { document.getElementById("spd").click(); geklicktAb = t; }
        if (as.done || t > 90000) {
          const rate = (von, bis) => {
            const a = proben.find((x) => x.t >= von), b = [...proben].reverse().find((x) => x.t <= bis);
            return a && b && b.t > a.t ? (b.ticks - a.ticks) / ((b.t - a.t) / 1000) : null;
          };
          const wirksamVor = finaleAb != null ? [...new Set(proben.filter((x) => x.t < finaleAb).map((x) => x.wirksam))] : null;
          const wirksamFinale = finaleAb != null ? [...new Set(proben.filter((x) => x.t >= finaleAb && (geklicktAb == null || x.t <= geklicktAb)).map((x) => x.wirksam))] : null;
          const wirksamNach = geklicktAb != null ? [...new Set(proben.filter((x) => x.t > geklicktAb && !x.done).map((x) => x.wirksam))] : null;
          resolve({ wirksamVor, wirksamFinale, wirksamNach, finaleAb, geklicktAb, anzeigeImFinale, rueckfall, abstandUeberSchwelleImFinale, nachspielzeitImFinale,
            rateVor: finaleAb != null ? rate(Math.max(0, finaleAb - 1500), finaleAb - 100) : null,
            rateFinale: finaleAb != null ? rate(finaleAb + 200, finaleAb + 1400) : null,
            rateNachKlick: geklicktAb != null ? rate(geklicktAb + 200, geklicktAb + 1000) : null,
            nachKlick: A.tempoStatus(), endstand: document.getElementById("score").textContent, done: as.done });
        } else requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }));
    // Massgeblich ist der vom Motor wirklich benutzte Multiplikator (tempoStatus().wirksam, genau
    // der Wert in `acc+=dt*wirksamesTempo()`): vorher 4, im Finale 1, nach dem Klick wieder 4.
    // Die Tick-Raten sind nur Beleg der Richtung -- auf einer belasteten Maschine schwanken die
    // Frame-Zeiten zu stark fuer feste Verhaeltnisse.
    const ratenOk = isDeepStrictEqual(live.wirksamVor, [4]) && isDeepStrictEqual(live.wirksamFinale, [1])
      && (live.wirksamNach == null || isDeepStrictEqual(live.wirksamNach, [4]))
      && live.rateFinale < live.rateVor && (live.rateNachKlick == null || live.rateNachKlick > live.rateFinale);
    pruefe(live.finaleAb != null && live.anzeigeImFinale === "Tempo 1× · Finale (Klick: zurück auf 4×)" && ratenOk,
      `(D3) ${d}: Finale greift nach ${live.finaleAb?.toFixed(0)} ms, Anzeige "${live.anzeigeImFinale}", wirksam ${JSON.stringify(live.wirksamVor)} -> ${JSON.stringify(live.wirksamFinale)} -> ${JSON.stringify(live.wirksamNach)}, Ticks/s vorher ${live.rateVor?.toFixed(0)} -> Finale ${live.rateFinale?.toFixed(0)} -> nach Klick ${live.rateNachKlick?.toFixed(0) ?? "(Spiel vorher zu Ende)"}`);
    if (live.geklicktAb != null) {
      pruefe(live.nachKlick.speed === 4 && live.nachKlick.finaleAbgewaehlt && !live.nachKlick.drosselt && live.nachKlick.finaleAktiv
        && !live.rueckfall && live.nachKlick.anzeige === "Tempo 4×",
        `(D3) ${d}: Klick auf #spd -> Wunschtempo 4× sofort zurueck (speed ${live.nachKlick.speed}, Anzeige "${live.nachKlick.anzeige}"), Riegel bleibt, kein Rueckfall`);
    }
    pruefe(live.done && live.endstand === such.endstand,
      `(D3) ${d}: Endstand live (mit Finale) ${live.endstand} === reiner sondenLauf() ${such.endstand} (Tick-Folge unberuehrt)`);
    console.log(`      Hysterese live beobachtet: Abstand im Finale ueber Schwelle ${live.abstandUeberSchwelleImFinale ? "ja (Riegel hielt)" : "kam nicht vor"}, Nachspielzeit im Finale ${live.nachspielzeitImFinale ? "ja" : "kam nicht vor"}`);
    // (D4) dauerhafter Schalter aus: dasselbe Spiel, Bedingung erfuellt, aber keine Drosselung.
    const d4 = await seite.evaluate(([dd, ab]) => new Promise((resolve) => {
      const A = window.__arena; A.setDisc(dd); A.finaleEchtzeit(false); A.sondenLauf(ab + 30); A.sondenAus();
      document.getElementById("play").click();
      let n = 0; const s = () => { n++; if (n < 30) requestAnimationFrame(s); else { const r = { ...A.tempoStatus(), bed: A.finaleProbe().bedingung }; A.finaleEchtzeit(true); resolve(r); } };
      requestAnimationFrame(s);
    }), [d, such.ab]);
    pruefe(d4.bed && d4.finaleAktiv && !d4.drosselt && d4.wirksam === 4,
      `(D4) ${d}: finaleEchtzeit(false) -> Riegel ${d4.finaleAktiv}, aber wirksam ${d4.wirksam}× (keine Drosselung)`);
    await seite.evaluate(() => { window.__arena.anpfiffCountdown(true); window.__arena.endstandNachlauf(true); });
    liveGeprueft = true;
    break;
  }
  if (!liveGeprueft) pruefe(false, "(D3) kein Feldspiel mit knapper Schlussphase gefunden -- Live-Pruefung nicht moeglich");
  else console.log("      (D3/D4 live an EINEM Feldspiel gefahren -- dem ersten mit knapper Schlussphase; die Bedingung selbst ist in D1 fuer alle drei geprueft)");
  await setzeTempo(seite, 1);

  // ===================================================================== N
  console.log("\n== N: Endstand-Nachlauf ==");
  // (N1) Sonden-Zeit (jetztMs() = sondenSimMs): kurze Disziplinen aus Bahn und Buehne. Bis
  // `done` in 30er-Schritten, dann tickweise bis #endstand -- gemessen wird die Sonden-Zeit
  // zwischen dem vom Motor gemerkten Schlusspfiff-Zeitpunkt und dem ersten sichtbaren Overlay.
  const doneTick = { ...endeTick };
  for (const d of ["spurt", "speed-schach"]) {
    const n1 = await seite.evaluate((dd) => {
      const A = window.__arena; A.anpfiffCountdown(false);
      const lauf = (nachlauf) => {
        A.endstandNachlauf(nachlauf); A.setDisc(dd);
        document.getElementById("einlauf").hidden = true; // sondenLauf() geht nie ueber #play
        let n = 0; while (!A.vorbei() && n < 60 * 60 * 20) { A.sondenLauf(30); n += 30; }
        const sichtbarBeiDone = !document.getElementById("endstand").hidden;
        const st = A.endstandNachlaufStatus();
        const siegerSofort = /gewinnt|Unentschieden|beendet/.test(document.getElementById("feed").textContent);
        const bugImNachlauf = !document.getElementById("bbug").hidden;
        let ms = null, extra = 0;
        while (document.getElementById("endstand").hidden && extra < 600) { A.sondenLauf(1); extra++; }
        if (st.aktiv) ms = A.endstandNachlaufStatus().jetztMs - st.seitMs;
        return { n, sichtbarBeiDone, aktiv: st.aktiv, ms, siegerSofort, bugImNachlauf };
      };
      const mit = lauf(true), ohne = lauf(false);
      A.endstandNachlauf(true); A.sondenAus();
      return { mit, ohne };
    }, d);
    doneTick[d] = n1.mit.n;
    pruefe(n1.mit.aktiv && n1.mit.ms >= 3500 && n1.mit.ms < 3500 + 1000 / 60 + 0.01 && n1.mit.siegerSofort && n1.mit.bugImNachlauf
      && !n1.ohne.aktiv && n1.ohne.sichtbarBeiDone && n1.mit.n === n1.ohne.n,
      `(N1) ${d.padEnd(12)} Sonden-Zeit: #endstand ${n1.mit.ms?.toFixed(1)} ms nach dem Schlusspfiff (soll 3500, ein Tick Raster); ohne Nachlauf sofort ${n1.ohne.sichtbarBeiDone}; Siegerzeile sofort ${n1.mit.siegerSofort}; Score-Bug im Nachlauf ${n1.mit.bugImNachlauf}; done im selben Schritt (${n1.mit.n})`);
  }
  // (N1k) Kontrolle Kampf: finish() bleibt ohne Nachlauf -- #endstand im selben Schritt wie done.
  const n1k = await seite.evaluate(() => {
    const A = window.__arena; A.endstandNachlauf(true); A.setDisc("tdm");
    let n = 0; while (!A.vorbei() && n < 60 * 60 * 10) { A.sondenLauf(10); n += 10; }
    const r = { n, vorbei: A.vorbei(), sichtbar: !document.getElementById("endstand").hidden, aktiv: A.endstandNachlaufStatus().aktiv };
    A.sondenAus(); return r;
  });
  pruefe(n1k.vorbei && n1k.sichtbar && !n1k.aktiv,
    `(N1) tdm (Kontrolle Kampf) : #endstand sofort bei done (${n1k.n} Ticks), kein Nachlauf -- unveraendert`);
  // (N3) Gewichtheben (Befund B4 / Opus-Review-Fund 2): im Nachlauf muss die letzte Hebung
  // wirklich ablaufen (antritt -> zug -> Lampe, also "hoch" oder "ablage"), bevor #endstand kommt,
  // und der Score-Bug darf das letzte Duell erst nach der Lampe zaehlen.
  const n3 = await seite.evaluate(() => {
    const A = window.__arena; A.endstandNachlauf(true); A.setDisc("gewichtheben");
    document.getElementById("einlauf").hidden = true;
    let n = 0; while (!A.vorbei() && n < 60 * 60 * 20) { A.sondenLauf(20); n += 20; }
    const phasenFolge = []; let lampeVorEndstand = false, scoreBeiDone = document.getElementById("score").textContent;
    const aktiv = () => A.cypherVizProbe().filter((x) => x.phase && x.phase !== "boden").map((x) => x.phase).join(",");
    let k = 0;
    while (document.getElementById("endstand").hidden && k < 400) {
      A.sondenLauf(1); k++;
      const ph = aktiv();
      if (phasenFolge[phasenFolge.length - 1] !== ph) phasenFolge.push(ph);
      if (/hoch|ablage/.test(ph)) lampeVorEndstand = true;
    }
    const r = { k, phasenFolge, lampeVorEndstand, scoreBeiDone, scoreEnde: document.getElementById("score").textContent,
      stand: (document.getElementById("esieger") || {}).textContent || "" };
    A.sondenAus(); return r;
  });
  pruefe(n3.lampeVorEndstand && Math.abs(n3.k - 210) <= 1,
    `(N3) gewichtheben: letzte Hebung laeuft im Nachlauf ab (${n3.phasenFolge.join(" -> ")}), Lampe vor #endstand ${n3.lampeVorEndstand}, #endstand nach ${n3.k} Ticks; Bug bei done "${n3.scoreBeiDone}" -> "${n3.scoreEnde}"`);

  // (T) Werkzeug: jedes Skript, das den Helfer aufruft, importiert ihn auch (node --check faengt
  // einen fehlenden Import nicht -- erst die Laufzeit, Opus-Review-Fund 1).
  {
    const { readdirSync } = await import("node:fs");
    const ohneImport = readdirSync(path.join(WURZEL, "scripts")).filter((f) => f.endsWith(".mjs")).filter((f) => {
      const q = readFileSync(path.join(WURZEL, "scripts", f), "utf8");
      return /(warteAufAnpfiff|sendungsrahmenAus)\(/.test(q) && !/^import .*from "\.\/lib\/arena-anpfiff\.mjs";/m.test(q);
    });
    pruefe(ohneImport.length === 0, `(T) Skripte mit warteAufAnpfiff/sendungsrahmenAus ohne Import: ${ohneImport.length ? ohneImport.join(", ") : "keine"}`);
  }

  // (N2) Echtzeit, je Chassis einmal (Feldspiel-Ende aus der D3-Suche).
  for (const d of ["football", "spurt", "speed-schach"]) {
    if (doneTick[d] == null) { pruefe(false, `(N2) ${d}: kein done-Tick bekannt`); continue; }
    const n2 = await seite.evaluate(([dd, dt]) => new Promise((resolve) => {
      const A = window.__arena; A.anpfiffCountdown(false); A.endstandNachlauf(true); A.setDisc(dd);
      A.sondenLauf(Math.max(0, dt - 150)); A.sondenAus();
      document.getElementById("play").click();
      let doneAb = null, endAb = null, bugImNachlauf = true, frameMax = 0, tVor = 0; const t0 = performance.now();
      const s = () => {
        const t = performance.now() - t0;
        if (doneAb != null) frameMax = Math.max(frameMax, t - tVor);
        tVor = t;
        if (A.vorbei() && doneAb == null) doneAb = t;
        if (doneAb != null && endAb == null && document.getElementById("endstand").hidden && document.getElementById("bbug").hidden) bugImNachlauf = false;
        if (!document.getElementById("endstand").hidden && endAb == null) endAb = t;
        if (endAb != null || t > 30000) { A.anpfiffCountdown(true); resolve({ doneAb, endAb, bugImNachlauf, frameMax }); }
        else requestAnimationFrame(s);
      };
      requestAnimationFrame(s);
    }), [d, doneTick[d]]);
    const delta = n2.endAb != null && n2.doneAb != null ? n2.endAb - n2.doneAb : null;
    // Untergrenze hart, Obergrenze um die laengste Frame-Luecke erweitert (Frame-Jitter, s. A2).
    pruefe(delta != null && delta >= 3500 - 20 && delta <= 3500 + 300 + 2 * n2.frameMax && n2.bugImNachlauf,
      `(N2) ${d.padEnd(12)} Echtzeit: done -> #endstand ${delta?.toFixed(0)} ms (soll 3500, laengste Frame-Luecke ${n2.frameMax?.toFixed(0)} ms), Score-Bug im Nachlauf sichtbar ${n2.bugImNachlauf}`);
  }
  await seite.close();

  // ===================================================================== I
  console.log("\n== I: Isolation (headless Mess-Pfade bit-identisch) ==");
  if (OHNE_ISOLATION) {
    console.log("      uebersprungen (--ohne-isolation)");
  } else {
    let basis;
    try {
      basis = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: WURZEL, encoding: "utf8" }).trim();
      // Liegt das Paket schon auf main (nach dem Merge), ist die Basis der Elternstand des Paket-Commits.
      const engineJetzt = readFileSync(path.join(PUBLIC, "mockups", "battle-mode.engine.js"), "utf8");
      let quelle = execFileSync("git", ["show", `${basis}:public/mockups/battle-mode.engine.js`], { cwd: WURZEL, encoding: "utf8", maxBuffer: 64 << 20 });
      if (quelle === engineJetzt || quelle.includes("function anpfiffRitualVon(")) {
        // `-1` wuerde VOR `--reverse` greifen (juengster Treffer) -- deshalb alle Treffer
        // aufsteigend holen und den aeltesten nehmen: der Commit, der das Paket einfuehrte.
        const vorPaket = execFileSync("git", ["log", "--format=%H", "--reverse", "-S", "function anpfiffRitualVon(", "--", "public/mockups/battle-mode.engine.js"], { cwd: WURZEL, encoding: "utf8" }).trim().split("\n")[0];
        basis = vorPaket + "~1";
        quelle = execFileSync("git", ["show", `${basis}:public/mockups/battle-mode.engine.js`], { cwd: WURZEL, encoding: "utf8", maxBuffer: 64 << 20 });
      }
      const kaderPfad = path.join(WURZEL, "data", "generated", "kaderfamilie-live-save.json");
      const familie = existsSync(kaderPfad)
        ? JSON.parse(readFileSync(kaderPfad, "utf8")).varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast })).slice(0, 2)
        : null;
      const messe = async (q) => {
        const s = await neueSeite(q);
        // Kontrolle der Umleitung: die Basis-Engine kennt anpfiffStatus() nicht, die neue schon.
        // Schluege die route()-Umleitung still fehl, verglichen wir sonst die neue Engine mit sich.
        const kennt = await s.evaluate(() => typeof window.__arena.anpfiffStatus === "function");
        if (kennt !== !q) throw new Error(`falsche Engine ausgeliefert (anpfiffStatus ${kennt ? "vorhanden" : "fehlt"}, erwartet ${q ? "Basis" : "neu"})`);
        const ds = await s.evaluate(() => window.__arena.motoren());
        const out = {};
        for (const d of ds) {
          out[d] = await s.evaluate(([dd, fam]) => ({
            probe: window.__arena.disziplinProbe(dd, { n: 2, ...(fam ? { kaderFamilie: fam } : {}) }),
            einfluss: window.__arena.einflussVon(dd, 2),
          }), [d, familie]);
        }
        // (I2) DER ANZEIGE-PFAD, DEN DIE NEUEN BAUSTEINE WIRKLICH BERUEHREN: sondenLauf() (ruft
        // updateHud*() und damit den Nachlauf) bis `done` -- done-Tick, Endstand und Ticker-
        // Zeilen bis `done` muessen gleich bleiben. Nachlauf aus, damit #endstand wie frueher im
        // done-Tick erscheint (der Nachlauf selbst ist in N1 geprueft). Auswahl: je Chassis eine
        // Disziplin, dazu Gewichtheben (stepBuehne()-done-Zweig angefasst).
        out.__sonde = {};
        for (const d of ["gewichtheben", "speed-schach", "spurt", "basketball", "tdm"]) {
          out.__sonde[d] = await s.evaluate((dd) => {
            const A = window.__arena;
            if (A.sendungsrahmen) A.sendungsrahmen(false);
            A.setDisc(dd);
            let n = 0; while (!A.vorbei() && n < 60 * 60 * 15) { A.sondenLauf(20); n += 20; }
            return { n, score: document.getElementById("score").textContent,
              feed: document.getElementById("feed").children.length,
              endstand: !document.getElementById("endstand").hidden };
          }, d);
        }
        await s.close();
        return out;
      };
      const vorher = await messe(quelle);
      const nachher = await messe(null);
      const sondeAbw = Object.keys(nachher.__sonde).filter((d) => !isDeepStrictEqual(vorher.__sonde[d], nachher.__sonde[d]));
      pruefe(sondeAbw.length === 0,
        `(I2) sondenLauf() bis done (gewichtheben, speed-schach, spurt, basketball, tdm): done-Tick, Endstand, Tickerzeilen ${sondeAbw.length ? "ABWEICHUNG in " + sondeAbw.map((d) => d + " " + JSON.stringify(vorher.__sonde[d]) + " vs " + JSON.stringify(nachher.__sonde[d])).join("; ") : "identisch " + JSON.stringify(nachher.__sonde)}`);
      delete vorher.__sonde; delete nachher.__sonde;
      const ds = Object.keys(nachher);
      const abweichend = ds.filter((d) => !isDeepStrictEqual(vorher[d], nachher[d]));
      pruefe(ds.length === 20 && abweichend.length === 0 && Object.keys(vorher).length === 20,
        `(I) disziplinProbe(n=2${familie ? ", Kaderfamilie 2 Varianten" : ""}) + einflussVon(n=2) fuer ${ds.length} Disziplinen gegen ${basis.slice(0, 10)}: ${abweichend.length ? "ABWEICHUNG in " + abweichend.join(",") : "bit-identisch"}`);
    } catch (e) {
      pruefe(false, "(I) Isolationsvergleich nicht ausfuehrbar: " + String(e).slice(0, 200));
    }
  }

  // ===================================================================== F
  pruefe(fehler.length === 0, `(F) Seitenfehler: ${fehler.length ? fehler.slice(0, 5).join(" | ") : "keine"}`);
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);

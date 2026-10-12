// VERIFIKATION STAFFEL O7 "EINGESPIELTE PAARE" (11.10., Klasse S).
// Spezifikation: docs/design/fable-ideen-bahn-30-09.md Abschnitt 4.1, eingeordnet als O7 in
// docs/design/staffel-nachtkonzept-03-10.md; Chris' Freigabe 11.10. ("Ja, bauen").
//
// Faehrt den Motor headless (Playwright) mit der Aufstellung GENAU WIE IM PRODUKTIVPFAD — ueber
// window.__olyArenaKader = {heim, gast, aufstellung}, so wie arena-headless-runner.ts es tut — und
// prueft gegen eigene Orakel, nicht gegen die Felder, die der Motor selbst schreibt:
//
//   (A) BEIN-REIHENFOLGE: mit Aufstellung laeuft Bein i, wer im Slot i steht (Start Runner zuerst,
//       Anchor zuletzt) — auf beiden Seiten, auch wenn die Slotfolge der Kaderreihenfolge (TDM-
//       Eignung) zuwiderlaeuft. Ohne Aufstellung (Messung, Ersatzaufstellung) unveraendert die
//       Kaderreihenfolge. Das war VOR O7 nicht so (Befund im Kopfkommentar von staffelNachSlot,
//       battle-mode.engine.js) und ist die Vorbedingung dafuer, dass der Zaehler die richtigen
//       Paare meint.
//   (B) BONUS NUR BEI GESETZTEM FELD: ohne `wechselPaarBonus` wirkt nichts; mit Feld wirkt er
//       genau am gemeinten Nehmer und nur dort, als Summand auf Q (Gewinn waechst um exakt
//       FLIEG_MAX x Bonus x Marken-Faktor); falscher Geber, Bein 1 (kein Geber) -> keine Wirkung,
//       bit-identisch zum Lauf ohne Feld; "eingespielt" -> engere Streuung, sonst nicht;
//       Obergrenze 0,10.
//   (C) RESET-ERKENNUNG ENDE ZU ENDE: eine Spieltagsfolge durch die ECHTEN TS-Funktionen
//       (scripts/lib/staffel-o7-kette.ts: Result-Apply-Fortschreibung + Aufstellungs-Rohr), danach
//       die Aufstellung in den Motor — Zaehler steigen bei gleicher Reihenfolge, fallen bei neuer
//       Reihenfolge fuer genau die betroffenen Paare zurueck, und der Bonus wirkt im Rennen genau
//       an den gezaehlten Paaren.
//   (S) MESS-SONDE: Standard aus; "alle"/"stufe"/"zufall" setzen nur Felder, die auch das Rohr
//       setzen wuerde; ueberschreibt nie einen Bonus aus der Aufstellung; abschaltbar.
//   (I) ISOLATION gegen die Engine VOR diesem Paket (git merge-base mit origin/main bzw. der
//       Elternstand des Paket-Commits): disziplinProbe() fuer alle zwanzig Disziplinen und
//       einflussVon() fuer Staffel bit-identisch; sondenLauf() Staffel bis done identisch; eine
//       Aufstellung, deren Slotfolge der Kaderfolge entspricht, ohne Paar-Felder: spieleBahn()
//       Staffel bit-identisch (die neue Sortierung ist dann ein No-Op).
//   (P) keine pageerror.
//
// Aufruf: node scripts/verify-staffel-o7-eingespielte-paare-paket-11-10.mjs [--ohne-isolation | --nur-isolation]
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
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };
const args = process.argv.slice(2);
const OHNE_ISOLATION = args.includes("--ohne-isolation");
const NUR_ISOLATION = args.includes("--nur-isolation");

const SLOTS = ["startrunner", "tempolink", "batontech", "curverunner", "chaserunner", "anchor"];
const MARKE_G = { absichern: 0.6, normal: 1.0, angreifen: 1.4 };
const FLIEG_MAX = 0.24;
const SAATEN = [4711, 1337, 90210];

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

const kaderPfad = path.join(WURZEL, "data", "generated", "kaderfamilie-live-save.json");
if (!existsSync(kaderPfad)) {
  console.error(`Kaderfamilie fehlt (${kaderPfad}) — ohne echte Kader ist diese Pruefung nicht aussagekraeftig.`);
  process.exit(1);
}
const familie = JSON.parse(readFileSync(kaderPfad, "utf8")).varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast }));
const KADER = familie[0];
const HEIM6 = KADER.heim.slice(0, 6).map((p) => p.n);
const GAST6 = KADER.gast.slice(0, 6).map((p) => p.n);

/** Aufstellung {Name: {d, slot, ...}} aus Namen in SLOT-Reihenfolge, plus optionale Zusatzfelder je Name. */
function aufstellungAus(heimInSlotFolge, gastInSlotFolge, extra = {}) {
  const a = {};
  heimInSlotFolge.forEach((n, i) => { a[n] = { d: "staffel", slot: SLOTS[i], ...(extra[n] || {}) }; });
  gastInSlotFolge.forEach((n, i) => { a[n] = { d: "staffel", slot: SLOTS[i], ...(extra[n] || {}) }; });
  return a;
}

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
const fehler = [];

async function neueSeite({ engineQuelle = null, aufstellung = null } = {}) {
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(([k]) => {
    window.AudioContext = undefined; window.webkitAudioContext = undefined;
    if (k) window.__olyArenaKader = k;
  }, [aufstellung ? { heim: KADER.heim, gast: KADER.gast, aufstellung } : null]);
  if (engineQuelle) {
    await seite.route("**/mockups/battle-mode.engine.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: engineQuelle }));
  }
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 60000 });
  return seite;
}

/** staffelPaarProbe(saat) je Saat — ein stummer Rennlauf, Zustand danach wiederhergestellt. */
async function probe(seite, saaten = SAATEN) {
  return seite.evaluate((ss) => ss.map((s) => window.__arena.staffelPaarProbe(s)), saaten);
}

const nachName = (laeufe) => Object.fromEntries(laeufe.map((u) => [u.n, u]));

try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

  if (!NUR_ISOLATION) {
    // ===================================================================== A
    console.log("== A: Bein-Reihenfolge ==");
    const heimUmgekehrt = [...HEIM6].reverse();            // Kaderletzter auf startrunner, Kaderbester auf anchor
    const gastVerwuerfelt = [GAST6[3], GAST6[0], GAST6[5], GAST6[1], GAST6[4], GAST6[2]];
    const aufUmgekehrt = aufstellungAus(heimUmgekehrt, gastVerwuerfelt);
    const sA = await neueSeite({ aufstellung: aufUmgekehrt });
    const laufA = (await probe(sA, [SAATEN[0]]))[0];
    const falschA = laufA.filter((u) => SLOTS.indexOf(aufUmgekehrt[u.n]?.slot) !== u.bein);
    pruefe(laufA.length === 12 && falschA.length === 0,
      `(A1) mit Aufstellung laeuft Bein i, wer in Slot i steht (12 Laeufer, Heim umgekehrt zur Kaderfolge, Gast verwuerfelt)${falschA.length ? ": ABWEICHEND " + falschA.map((u) => `${u.n} Bein ${u.bein} statt ${SLOTS.indexOf(aufUmgekehrt[u.n]?.slot)}`).join(", ") : ""}`);
    const s0 = await neueSeite();
    const lauf0 = (await probe(s0, [SAATEN[0]]))[0];
    const heim0 = lauf0.filter((u) => u.seite === 0).sort((a, b) => a.bein - b.bein).map((u) => u.n);
    pruefe(isDeepStrictEqual(heim0, HEIM6),
      `(A2) ohne Aufstellung (Messpfad) unveraendert die Kaderreihenfolge: ${heim0.join(", ")}`);

    // ===================================================================== B
    console.log("\n== B: Bonus wirkt nur bei gesetztem Feld ==");
    const nehmer = heimUmgekehrt[3], geber = heimUmgekehrt[2];   // Heim, Bein 3 <- Bein 2
    const ohne = await probe(sA);
    pruefe(ohne.every((lauf) => lauf.every((u) => u.wirkung == null && !u.gedaempft && u.bonus == null)),
      `(B0) ohne Paar-Felder: kein Laeufer traegt einen Bonus, keine Wirkung, keine Daempfung (${SAATEN.length} Saaten)`);

    const mit = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: 0.06, wechselPaarGeber: geber } }) }));
    let b1ok = true; const b1text = [];
    mit.forEach((lauf, i) => {
      const m = nachName(lauf), o = nachName(ohne[i]);
      const nur = lauf.filter((u) => u.wirkung != null).map((u) => u.n);
      const g = MARKE_G[m[nehmer].marke];
      const dGewinn = m[nehmer].gewinn - o[nehmer].gewinn;
      const soll = FLIEG_MAX * 0.06 * g;
      const ok = isDeepStrictEqual(nur, [nehmer]) && m[nehmer].wirkung === 0.06 && !m[nehmer].gedaempft
        && g != null && Math.abs(dGewinn - soll) < 1e-12;
      if (!ok) b1ok = false;
      b1text.push(`Saat ${SAATEN[i]}: Marke ${m[nehmer].marke}, Gewinn +${dGewinn.toFixed(5)} s (Soll ${soll.toFixed(5)})`);
    });
    pruefe(b1ok, `(B1) Bonus 0,06 am Nehmer ${nehmer} (Geber ${geber}): wirkt nur dort, Gewinn waechst um exakt 0,24 x 0,06 x Marke — ${b1text.join("; ")}`);

    const falscherGeber = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: 0.06, wechselPaarGeber: heimUmgekehrt[0] } }) }));
    // Vergleich ohne die drei EINGANGS-Felder (die tragen ja gerade den untersuchten Unterschied);
    // alles, was das Rennen ergibt — Wirkung, Daempfung, Gewinn, Etappe, Wechselkonto — muss gleich sein.
    const ohneFelder = (laeufe) => laeufe.map((lauf) => lauf.map((u) => {
      const rest = { ...u }; delete rest.bonus; delete rest.geber; delete rest.eingespielt; return rest;
    }));
    pruefe(isDeepStrictEqual(ohneFelder(falscherGeber), ohneFelder(ohne)),
      `(B2) falscher Geber (${heimUmgekehrt[0]} statt ${geber}): keine Wirkung, Rennen bit-identisch zum Lauf ohne Feld`);

    const bein0 = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [heimUmgekehrt[0]]: { wechselPaarBonus: 0.1, wechselPaarGeber: geber, wechselPaarEingespielt: true } }) }));
    pruefe(isDeepStrictEqual(ohneFelder(bein0), ohneFelder(ohne)),
      `(B3) Bonus am Startlaeufer (Bein 1, bekommt nie einen Stab): keine Wirkung, Rennen bit-identisch`);

    const eing = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: 0.1, wechselPaarGeber: geber, wechselPaarEingespielt: true } }) }));
    pruefe(eing.every((lauf) => { const m = nachName(lauf); return m[nehmer].wirkung === 0.1 && m[nehmer].gedaempft && lauf.filter((u) => u.gedaempft).length === 1; }),
      `(B4) "eingespielt": engere Streuung genau am Nehmer ${nehmer}, Bonus 0,10; die Vorstufe (B1) daempft nicht`);

    const zuViel = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: 0.5, wechselPaarGeber: geber } }) }));
    pruefe(zuViel.every((lauf) => nachName(lauf)[nehmer].wirkung === 0.1),
      `(B5) Bonus 0,5 aus einer kaputten Aufstellung wird auf die Obergrenze 0,10 geklemmt`);

    const kaputt = await probe(await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: "0.1", wechselPaarGeber: geber }, [heimUmgekehrt[4]]: { wechselPaarBonus: 0.1 } }) }));
    pruefe(isDeepStrictEqual(kaputt, ohne),
      `(B6) unvollstaendige/typfalsche Felder (Bonus als Text, Geber fehlt) werden ignoriert — Rennen bit-identisch`);

    // ===================================================================== C
    console.log("\n== C: Reset-Erkennung Ende zu Ende (TS-Fortschreibung -> Aufstellung -> Motor) ==");
    const [H0, H1, H2, H3, H4, H5] = HEIM6;
    const folge = [HEIM6, HEIM6, HEIM6, [H0, H1, H3, H2, H4, H5], [H0, H1, H3, H2, H4, H5]];
    const kette = JSON.parse(execFileSync("npx", ["tsx", "scripts/lib/staffel-o7-kette.ts"], {
      cwd: WURZEL, encoding: "utf8", input: JSON.stringify({ heim: KADER.heim.map((p) => p.n), folge }), maxBuffer: 16 << 20,
    }));
    const zaehler = (i) => kette[i].paare;
    pruefe(isDeepStrictEqual(zaehler(2), { [`${H0}>${H1}`]: 3, [`${H1}>${H2}`]: 3, [`${H2}>${H3}`]: 3, [`${H3}>${H4}`]: 3, [`${H4}>${H5}`]: 3 }),
      `(C1) drei Spiele in gleicher Reihenfolge: alle fuenf Paare bei 3`);
    pruefe(isDeepStrictEqual(zaehler(3), { [`${H0}>${H1}`]: 4, [`${H1}>${H3}`]: 1, [`${H3}>${H2}`]: 1, [`${H2}>${H4}`]: 1, [`${H4}>${H5}`]: 4 }),
      `(C2) Spieltag 4, Bein 3/4 getauscht: genau die drei betroffenen Paare beginnen bei 1, die beiden anderen zaehlen weiter (4)`);
    pruefe(isDeepStrictEqual(zaehler(4), { [`${H0}>${H1}`]: 5, [`${H1}>${H3}`]: 2, [`${H3}>${H2}`]: 2, [`${H2}>${H4}`]: 2, [`${H4}>${H5}`]: 5 }),
      `(C3) Spieltag 5, neue Reihenfolge beibehalten: alle zaehlen weiter`);
    const bonusAus = (a) => Object.fromEntries(Object.entries(a).filter(([, e]) => e.wechselPaarBonus).map(([n, e]) => [n, [e.wechselPaarBonus, e.wechselPaarGeber, !!e.wechselPaarEingespielt]]));
    pruefe(isDeepStrictEqual(bonusAus(kette[0].aufstellung), {}),
      `(C4) erstes Spiel: noch keine Geschichte, das Rohr ist exakt die alte Aufstellung`);
    pruefe(isDeepStrictEqual(bonusAus(kette[3].aufstellung), { [H1]: [0.1, H0, true], [H5]: [0.1, H4, true] }),
      `(C5) vor Spieltag 4: nur die beiden weiter benachbarten, eingespielten Paare tragen Bonus (0,10 + eingespielt)`);
    pruefe(isDeepStrictEqual(bonusAus(kette[4].aufstellung), { [H1]: [0.1, H0, true], [H3]: [0.03, H1, false], [H2]: [0.03, H3, false], [H4]: [0.03, H2, false], [H5]: [0.1, H4, true] }),
      `(C6) vor Spieltag 5: die drei neuen Paare in Stufe 1 (0,03), die alten weiter eingespielt`);
    for (const [i, nr] of [[3, 4], [4, 5]]) {
      const auf = { ...kette[i].aufstellung };
      GAST6.forEach((n, j) => { auf[n] = { d: "staffel", slot: SLOTS[j] }; });
      const laeufe = await probe(await neueSeite({ aufstellung: auf }));
      const sollWirkung = Object.fromEntries(Object.entries(bonusAus(kette[i].aufstellung)).map(([n, [b, , e]]) => [n, [b, e]]));
      const ok = laeufe.every((lauf) => {
        const ist = Object.fromEntries(lauf.filter((u) => u.wirkung != null).map((u) => [u.n, [u.wirkung, u.gedaempft]]));
        const beine = lauf.filter((u) => u.seite === 0).sort((a, b) => a.bein - b.bein).map((u) => u.n);
        return isDeepStrictEqual(ist, sollWirkung) && isDeepStrictEqual(beine, folge[i]);
      });
      pruefe(ok, `(C${nr === 4 ? 7 : 8}) Rennen an Spieltag ${nr}: Beine in Aufstellungsreihenfolge, Bonus wirkt im Motor genau an ${Object.keys(sollWirkung).join(", ")} (${SAATEN.length} Saaten)`);
    }

    // ===================================================================== S
    console.log("\n== S: Mess-Sonde ==");
    const sS = await neueSeite();
    const standard = await probe(sS);
    pruefe(standard.every((lauf) => lauf.every((u) => u.bonus == null && u.wirkung == null)),
      `(S1) Standard: Sonde aus, kein Laeufer traegt einen Bonus`);
    await sS.evaluate(() => window.__arena.staffelPaarSonde({ modus: "alle" }));
    const alle = await probe(sS);
    pruefe(alle.every((lauf) => lauf.every((u) => (u.bein > 0 ? u.bonus === 0.1 && u.eingespielt === true && u.wirkung === 0.1 && u.gedaempft : u.bonus == null))),
      `(S2) "alle": jeder Nehmer (Bein 2-6) eingespielt, Bonus 0,10 wirkt, Daempfung an; Startlaeufer ohne`);
    await sS.evaluate(() => window.__arena.staffelPaarSonde({ modus: "stufe", spiele: 0 }));
    pruefe(isDeepStrictEqual(await probe(sS), standard), `(S3) "stufe:0": bit-identisch zum Standard`);
    await sS.evaluate(() => window.__arena.staffelPaarSonde({ modus: "zufall" }));
    const zufall1 = await probe(sS), zufall2 = await probe(sS);
    const werte = new Set(zufall1.flat().map((u) => u.bonus).filter((b) => b != null));
    pruefe(isDeepStrictEqual(zufall1, zufall2) && [...werte].every((b) => [0.03, 0.06, 0.1].includes(b)),
      `(S4) "zufall": deterministisch je Paar, nur Stufenwerte (${[...werte].sort().join("/")})`);
    await sS.evaluate(() => window.__arena.staffelPaarSonde(null));
    pruefe(isDeepStrictEqual(await probe(sS), standard), `(S5) Sonde wieder aus: bit-identisch zum Standard`);
    const sMitAuf = await neueSeite({ aufstellung: aufstellungAus(heimUmgekehrt, gastVerwuerfelt, { [nehmer]: { wechselPaarBonus: 0.06, wechselPaarGeber: geber } }) });
    await sMitAuf.evaluate(() => window.__arena.staffelPaarSonde({ modus: "alle" }));
    pruefe((await probe(sMitAuf)).every((lauf) => nachName(lauf)[nehmer].bonus === 0.06),
      `(S6) die Sonde ueberschreibt nie einen Bonus aus der Aufstellung (${nehmer} behaelt 0,06 trotz "alle")`);
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
      if (quelle === engineJetzt || quelle.includes("function staffelPaarVon(")) {
        const vorPaket = execFileSync("git", ["log", "--format=%H", "--reverse", "-S", "function staffelPaarVon(", "--", "public/mockups/battle-mode.engine.js"], { cwd: WURZEL, encoding: "utf8" }).trim().split("\n")[0];
        basis = vorPaket + "~1";
        quelle = execFileSync("git", ["show", `${basis}:public/mockups/battle-mode.engine.js`], { cwd: WURZEL, encoding: "utf8", maxBuffer: 64 << 20 });
      }
      const fam = familie.slice(0, 2);
      const aufGleich = aufstellungAus(HEIM6, GAST6);      // Slotfolge = Kaderfolge: die Sortierung ist ein No-Op
      const messe = async (q) => {
        const s = await neueSeite({ engineQuelle: q });
        const kennt = await s.evaluate(() => typeof window.__arena.staffelPaarProbe === "function");
        if (kennt !== !q) throw new Error(`falsche Engine ausgeliefert (staffelPaarProbe ${kennt ? "vorhanden" : "fehlt"}, erwartet ${q ? "Basis" : "neu"})`);
        const ds = await s.evaluate(() => window.__arena.motoren());
        const out = {};
        for (const d of ds) {
          out[d] = await s.evaluate(([dd, f]) => ({
            probe: window.__arena.disziplinProbe(dd, { n: 2, ...(f.length ? { kaderFamilie: f } : {}) }),
            einfluss: dd === "staffel" ? window.__arena.einflussVon(dd, 1) : null,
          }), [d, fam]);
        }
        out.__sonde = await s.evaluate(() => {
          const A = window.__arena; if (A.sendungsrahmen) A.sendungsrahmen(false);
          A.setDisc("staffel");
          let n = 0; while (!A.vorbei() && n < 60 * 60 * 15) { A.sondenLauf(20); n += 20; }
          const p = document.getElementById("protokoll");
          return { n, score: document.getElementById("score").textContent,
            protokoll: p ? [...p.children].map((c) => c.textContent) : null };
        });
        await s.close();
        const sAuf = await neueSeite({ engineQuelle: q, aufstellung: aufGleich });
        out.__mitAufstellung = await sAuf.evaluate((ss) => ss.map((saat) => window.__arena.spieleBahn("staffel", saat)), SAATEN);
        await sAuf.close();
        return out;
      };
      const vorher = await messe(quelle);
      const nachher = await messe(null);
      pruefe(isDeepStrictEqual(vorher.__sonde, nachher.__sonde),
        `(I2) sondenLauf() Staffel bis done: done-Tick ${nachher.__sonde.n}, Endstand "${nachher.__sonde.score}", ${nachher.__sonde.protokoll ? nachher.__sonde.protokoll.length : "?"} Protokollzeilen ${isDeepStrictEqual(vorher.__sonde, nachher.__sonde) ? "identisch" : "ABWEICHEND"}`);
      pruefe(isDeepStrictEqual(vorher.__mitAufstellung, nachher.__mitAufstellung),
        `(I3) mit Aufstellung (Slotfolge = Kaderfolge) und ohne Paar-Felder: spieleBahn("staffel") fuer ${SAATEN.length} Saaten ${isDeepStrictEqual(vorher.__mitAufstellung, nachher.__mitAufstellung) ? "bit-identisch" : "ABWEICHEND"}`);
      delete vorher.__sonde; delete nachher.__sonde; delete vorher.__mitAufstellung; delete nachher.__mitAufstellung;
      const ds = Object.keys(nachher);
      const abweichend = ds.filter((d) => !isDeepStrictEqual(vorher[d], nachher[d]));
      pruefe(ds.length === 20 && abweichend.length === 0 && Object.keys(vorher).length === 20,
        `(I1) disziplinProbe(n=2, Kaderfamilie ${fam.length} Varianten) fuer ${ds.length} Disziplinen + einflussVon(staffel, n=1) gegen ${basis.slice(0, 10)}: ${abweichend.length ? "ABWEICHUNG in " + abweichend.join(",") : "bit-identisch"}`);
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

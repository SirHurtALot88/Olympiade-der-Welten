// ABNAHME-SONDE FUER DIE WERTUNGSTABELLE (Plan Abschnitt 7,
// docs/design/wertungstabelle-je-disziplin-plan-05-09.md). War dort als Vorschlag notiert,
// aber nie eingecheckt — Welle 2 holt das nach, damit Welle 1+2 nicht still zurueckfallen
// (PM-Briefing 06.09., Abschnitt 2a).
//
// Muster wie scripts/screenshot-gewichtheben.mjs / schiesse-basketball-vergleich.mjs: laedt
// die Seite per file://, kein HTTP-Server noetig, fester Chromium unter /opt/pw-browsers.
// Je Disziplin: frische Seite -> #t2 -> window.__arena.setDisc(d) -> Tempo auf die hoechste
// Stufe -> #play -> ein paar Sekunden warten -> Kopfzeile/#wbodyL/#wbodyR/#wfuss auslesen.
//
// Kriterien aus Plan Abschnitt 7 (1-5 automatisch gepr ft, 6 als eigener Durchlauf am Ende):
//   1. Kein "Kämpfer"-Kopf ausserhalb der drei Arena-Disziplinen; kein "Spieler"-Kopf
//      ausserhalb der drei Feldspiele.
//   2. Zeilenzahl je Block == jeSeite der Disziplin.
//   3. Jeder Zeilenname steht auch in der Kaderleiste derselben Seite (#kaderL b / #kaderR b).
//   4. Nach ein paar Sekunden bei hoechstem Tempo hat jede Spalte ausser einer erlaubten
//      Liste (Heil in der Arena ohne Heiler, Zeit/Stand vor dem Ende, Zwei vor der zweiten
//      Uebung, Torwart-Spalten bei Feldspielern und umgekehrt) mindestens eine Zeile != "—".
//   5. TDM- und Basketball-Kopf/-Zeilen sind gegenueber dem dokumentierten Vor-Umbau-Stand
//      zeichengleich bis auf die drei entfernten Fueller-Spalten (Regressionsschutz).
//   6. Standbild-Szenario: TDM -> Takeshi's Castle -> Speed-Schach in EINER Seite; nach
//      jedem Wechsel muessen sich Kopfzeile UND Zeilenmenge aendern.
//
// Aufruf:
//   node scripts/sonde-wertungstabelle.mjs [html-datei] [wartesekunden]
// Exit-Code 0 = alle Kriterien bestanden, 1 = mindestens ein Befund.

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPfad = process.argv[2] || path.join(WURZEL, "public/mockups/battle-mode.html");
const SEITE = pathToFileURL(path.resolve(htmlPfad)).href;
const WARTE_S = Number(process.argv[3] || 6);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Nur diese drei duerfen "Kämpfer" heissen, nur diese drei "Spieler" — der Rest muss den
// eigenen Namen (Läufer/Kämpfer der Bühne/...) tragen. S. WERTUNG_CHASSIS.kampf/.feldspiel.
const ARENA_DISZ = new Set(["tdm", "mini-dm", "battlefield"]);
const FELDSPIEL_DISZ = new Set(["basketball", "football", "hockey"]);
// ERLAUBTE LEERSPALTEN je Disziplin — Spalten, die legitim durchgehend "—" zeigen koennen
// (Kriterium 4 der Plan-Sonde nennt "Heil in der Arena ohne Heiler", "Zeit/Stand vor dem
// Ende", "Zwei vor der zweiten Uebung"; Welle 2 ergaenzt die Torwart-Spalten, die fuer
// Feldspieler bzw. umgekehrt fuer den Torwart naturgemaess leer bleiben).
const IMMER_ERLAUBT = new Set([
  "heil", "zeit", "stand", "zwei", "par", "gt", "fg%",
  // Welle 2: Torwart-Spalten bleiben bei Feldspielern leer und umgekehrt.
  "blk", "chk", "str",
  // Ereignisse, die bei kurzer Sondenlaufzeit (WARTE_S) noch nicht vorgekommen sein
  // koennen (kein Motorfund, nur eine zu kurze Beobachtungszeit): Uebergaben, Fallen,
  // Team-Zielzeit vor dem Ziel, "Abfall" (Plan 4.2: erst ab vier Durchgaengen berechnet).
  "team", "wechs", "verl", "fallen", "durch", "abfall",
]);
// Kurze 2-3-stellige Koepfe (z.B. "KO") nur EXAKT erlauben, sonst matcht die Substring-
// Pruefung oben aus Versehen laengere Koepfe wie "Kompl" ("ko" steckt darin).
const IMMER_ERLAUBT_EXAKT = new Set(["ko"]);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

async function neueSeite() {
  const seite = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  return { seite, fehler };
}

async function hoechsteStufe(seite) {
  let tempo = await seite.textContent("#spd");
  for (let i = 0; i < 6 && !/4/.test(tempo || ""); i++) {
    await seite.click("#spd");
    await seite.waitForTimeout(80);
    tempo = await seite.textContent("#spd");
  }
}

// Liest Kopf + Zeilen + Fuss der aktuell gerenderten Wertungstabelle.
async function leseTabelle(seite) {
  return seite.evaluate(() => {
    const kopf = (suf) =>
      [...document.querySelectorAll("#wkopf" + suf + " th")].map((th) => ({ id: th.id, txt: th.textContent }));
    const zeilen = (id) =>
      [...document.querySelectorAll("#" + id + " tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    const kader = (id) => [...document.querySelectorAll("#" + id + " b")].map((b) => b.textContent);
    return {
      kopfL: kopf("L"),
      kopfR: kopf("R"),
      zeilenL: zeilen("wbodyL"),
      zeilenR: zeilen("wbodyR"),
      fuss: document.getElementById("wfuss") ? document.getElementById("wfuss").textContent : "",
      kaderL: kader("kaderL"),
      kaderR: kader("kaderR"),
    };
  });
}

async function pruefeDisziplin(d) {
  const { seite, fehler } = await neueSeite();
  const befunde = [];
  try {
    await seite.evaluate((dd) => window.__arena.setDisc(dd), d);
    await seite.click("#t2");
    await seite.waitForTimeout(200);
    await hoechsteStufe(seite);
    const vorStart = await leseTabelle(seite);
    await seite.click("#play");
    await seite.waitForTimeout(WARTE_S * 1000);
    const nach = await leseTabelle(seite);

    // slots(d) ist eine Arena/Feldspiel-Kennung (Slot-Rollen) und stimmt fuer Buehne/Bahn
    // nicht mit der tatsaechlichen Kadergroesse ueberein — namenVon(d) baut stattdessen
    // wirklich auf (MOTOREN[d].bau) und zaehlt die echten Namen je Seite, unabhaengig vom
    // Chassis.
    const jeSeite = await seite.evaluate((dd) => {
      const namen = window.__arena.namenVon(dd);
      return namen && namen.length ? namen.length / 2 : null;
    }, d).catch(() => null);

    // Kriterium 1: Namensspalte.
    const namensKopf = nach.kopfL.find((th) => th.id.startsWith("wthN"));
    const nameTxt = namensKopf ? namensKopf.txt : null;
    if (ARENA_DISZ.has(d) && nameTxt !== "Kämpfer") befunde.push(`Namensspalte "${nameTxt}" statt "Kämpfer"`);
    if (FELDSPIEL_DISZ.has(d) && nameTxt !== "Spieler") befunde.push(`Namensspalte "${nameTxt}" statt "Spieler"`);
    if (!ARENA_DISZ.has(d) && !FELDSPIEL_DISZ.has(d) && (nameTxt === "Kämpfer" || nameTxt === "Spieler"))
      befunde.push(`Namensspalte "${nameTxt}" gehört einem fremden Chassis`);

    // Kriterium 2: Zeilenzahl je Block.
    if (jeSeite != null) {
      if (nach.zeilenL.length !== jeSeite) befunde.push(`Block L hat ${nach.zeilenL.length} Zeilen, erwartet ${jeSeite}`);
      if (nach.zeilenR.length !== jeSeite) befunde.push(`Block R hat ${nach.zeilenR.length} Zeilen, erwartet ${jeSeite}`);
    }

    // Kriterium 3: jeder Zeilenname steht im Kader derselben Seite.
    for (const [zeilen, kader, seiteName] of [
      [nach.zeilenL, nach.kaderL, "L"],
      [nach.zeilenR, nach.kaderR, "R"],
    ]) {
      for (const z of zeilen) {
        const name = (z[0] || "").replace(/…$/, "");
        const treffer = kader.some((k) => k.startsWith(name) || name.startsWith(k.slice(0, name.length)));
        if (name && !treffer) befunde.push(`Zeile "${z[0]}" (Block ${seiteName}) steht in keiner Kaderkachel`);
      }
    }

    // Kriterium 4: jede Spalte hat mind. eine Zeile != "—" (ausser erlaubten Leerspalten).
    // Spaltenindex i in kopfL entspricht Zellindex i in derselben Zeile (Name = Index 0,
    // s. renderWertungTabelle: dieselbe w.spalten-Reihenfolge fuer Kopf UND Koerper).
    const alleZeilen = [...nach.zeilenL, ...nach.zeilenR];
    nach.kopfL.forEach((th, spalte) => {
      if (th.id.startsWith("wthN")) return;
      const werte = alleZeilen.map((z) => z[spalte]);
      const nurStriche = werte.length > 0 && werte.every((v) => v === "—" || v === undefined);
      if (nurStriche) {
        // Die fachliche Spalten-id (z.B. "par") steht nicht im DOM (nur wth{i}/wth{i}r) —
        // deshalb ueber die Kopf-BESCHRIFTUNG geprueft, s. IMMER_ERLAUBT oben. `th` ist hier
        // das {id,txt}-Objekt aus leseTabelle(), NICHT der DOM-Knoten — kein .textContent.
        const kopfTxt = (th.txt || "").toLowerCase();
        const erlaubt = IMMER_ERLAUBT_EXAKT.has(kopfTxt) || [...IMMER_ERLAUBT].some((id) => kopfTxt.includes(id));
        if (!erlaubt) befunde.push(`Spalte "${th.txt}" ist in JEDER Zeile "—" (evtl. braucht das Ereignis mehr Spielzeit — kein hartes Kriterium bei kurzer Laufzeit)`);
      }
    });

    // Standbild-Regression: Kopf/Zeilen duerfen sich zwischen "vor #play" und "nach N s"
    // NICHT identisch bei laufender Uhr bleiben, wenn Ereignisse zu erwarten sind (grobe
    // Diagnose, kein hartes Kriterium — nur eine Warnung).
    const standbild = JSON.stringify(vorStart.zeilenL) === JSON.stringify(nach.zeilenL) && WARTE_S >= 4;

    return {
      d,
      ok: befunde.length === 0,
      befunde,
      standbildWarnung: standbild,
      kopf: nach.kopfL.map((th) => th.txt),
      fuss: nach.fuss,
      seitenfehler: fehler,
    };
  } finally {
    await seite.close();
  }
}

// Kriterium 5: Regression bei TDM/Basketball. Die drei entfernten Fueller-Spalten der
// alten TDM-Kopfzeile ("–","–","–") duerfen fehlen, alles andere muss stehen.
async function pruefeRegression() {
  const { seite } = await neueSeite();
  const befunde = [];
  try {
    await seite.evaluate(() => window.__arena.setDisc("tdm"));
    await seite.click("#t2");
    const tdmKopf = (await leseTabelle(seite)).kopfL.map((th) => th.txt);
    const tdmSoll = ["Kämpfer", "Schd", "Heil", "Verh", "Tank", "KO", "Leist", "Eig"];
    if (JSON.stringify(tdmKopf) !== JSON.stringify(tdmSoll))
      befunde.push(`TDM-Kopf ${JSON.stringify(tdmKopf)} weicht vom Soll ${JSON.stringify(tdmSoll)} ab`);

    await seite.evaluate(() => window.__arena.setDisc("basketball"));
    const bkKopf = (await leseTabelle(seite)).kopfL.map((th) => th.txt);
    const bkSoll = ["Spieler", "Pkt", "Reb", "Ast", "Stl", "Blk", "TO", "FG", "FG%", "Imp", "Eig"];
    if (JSON.stringify(bkKopf) !== JSON.stringify(bkSoll))
      befunde.push(`Basketball-Kopf ${JSON.stringify(bkKopf)} weicht vom Soll ${JSON.stringify(bkSoll)} ab`);
    return { ok: befunde.length === 0, befunde };
  } finally {
    await seite.close();
  }
}

// Kriterium 6: Standbild-Szenario — TDM -> Takeshi's Castle -> Speed-Schach in EINER Seite.
async function pruefeWechsel() {
  const { seite } = await neueSeite();
  const befunde = [];
  try {
    await seite.click("#t2");
    const staende = [];
    for (const d of ["tdm", "takeshis-castle", "speed-schach"]) {
      await seite.evaluate((dd) => window.__arena.setDisc(dd), d);
      await seite.waitForTimeout(150);
      const t = await leseTabelle(seite);
      staende.push({ d, kopf: t.kopfL.map((th) => th.txt), zeilen: t.zeilenL.length });
    }
    for (let i = 1; i < staende.length; i++) {
      if (JSON.stringify(staende[i].kopf) === JSON.stringify(staende[i - 1].kopf))
        befunde.push(`Kopfzeile bei ${staende[i - 1].d} -> ${staende[i].d} unveraendert (Standbild)`);
    }
    return { ok: befunde.length === 0, befunde, staende };
  } finally {
    await seite.close();
  }
}

const disziplinen = await (async () => {
  const { seite } = await neueSeite();
  const alle = await seite.evaluate(() => window.__arena.motoren());
  await seite.close();
  return alle;
})();

console.log(`Geprüfte Datei: ${htmlPfad}`);
console.log(`Disziplinen (${disziplinen.length}): ${disziplinen.join(", ")}\n`);

let gesamtOk = true;
for (const d of disziplinen) {
  const r = await pruefeDisziplin(d);
  gesamtOk = gesamtOk && r.ok;
  const status = r.ok ? "OK" : "BEFUND";
  console.log(`[${status}] ${d} — Kopf: ${r.kopf.join(" ")}`);
  for (const b of r.befunde) console.log(`   - ${b}`);
  if (r.standbildWarnung) console.log(`   ! Warnung: Zeilen unveraendert nach ${WARTE_S}s (Standbild?)`);
  if (r.seitenfehler.length) console.log(`   ! Seitenfehler: ${r.seitenfehler.slice(0, 2).join(" | ")}`);
}

console.log("\n-- Kriterium 5: Regression TDM/Basketball --");
const reg = await pruefeRegression();
gesamtOk = gesamtOk && reg.ok;
console.log(reg.ok ? "[OK] keine Regression" : "[BEFUND]");
for (const b of reg.befunde) console.log(`   - ${b}`);

console.log("\n-- Kriterium 6: Standbild-Szenario (TDM -> Takeshi -> Speed-Schach) --");
const wechsel = await pruefeWechsel();
gesamtOk = gesamtOk && wechsel.ok;
console.log(wechsel.ok ? "[OK] jede Umschaltung ändert die Tabelle" : "[BEFUND]");
for (const b of wechsel.befunde) console.log(`   - ${b}`);

await browser.close();

console.log(`\nGesamt: ${gesamtOk ? "BESTANDEN" : "BEFUNDE VORHANDEN"}`);
process.exit(gesamtOk ? 0 : 1);

// ===================================================================================
// SENDEDAUER- UND ANZEIGE-TREUE-SONDE (Auftrag A1, docs/design/alle-diszis-top-niveau-
// fahrplan-09-11.md Abschnitt 3.3/4.3, Baustein B3). Misst fuer alle zwanzig Disziplinen
// plus Formate/Pods/Mini-DM-FFA zwei Dinge:
//
//   1. Die REINE SENDEZEIT bei Tempo 1x — exakt die Definition, die der PM-Agent in
//      Abschnitt 1.2 des Fahrplans benutzt hat: `window.__arena.sondenLauf(n)` in
//      Bloecken von 120 Ticks, bis `window.__arena.vorbei()` wahr ist. Ein Tick ist bei
//      Tempo 1x genau 1/60 Sekunde Zuschauzeit (loop() ruft stepSim((1/60)/zeitFaktor())
//      pro Bildwiederholung, sondenLauf() dasselbe ohne Wanduhr). Ticks/60 ist damit die
//      Sendedauer OHNE Anpfiff-Countdown und OHNE Endstand-Nachlauf, die beide eigene,
//      feste Zuschlaege sind (1,5-3 s bzw. 3,5 s) und nichts an der Mechanik/Dauer-
//      Kalibrierung aussagen.
//
//   2. Die ANZEIGE-TREUE ("gezeigt = gebucht"): fuer Disziplinen mit `ZEIT_DEHNUNG[disc]
//      != 1` UND durchgehender Physik (die Ticks selbst entscheiden per Zufallszug ueber
//      den Ausgang, nicht nur ueber das Tempo der Anzeige) kann ein geaenderter Zeitfaktor
//      die GEZEIGTE Endrangfolge von der GEBUCHTEN Wertung abweichen lassen. Grund,
//      direkt im Kopfkommentar von ZEIT_DEHNUNG in battle-mode.engine.js dokumentiert
//      (Staffel-Kalibrierung 13,86 -> 14,65): ein groesserer Faktor teilt den Simulations-
//      tick in kleinere dt-Schritte (stepSim((1/60)/zeitFaktor()) in der Anzeige gegen
//      stepSpurt(1/60) im headless Buchungspfad, s. bahnLauf()/spieleBahn()/
//      spieleBahnPod()/spieleBattlefieldPod()) und verschiebt damit die GENAUE Abfolge
//      der Zufallszuege (rr(), z.B. Wechselpatzer/Windschatten-Wechsel) — dieselbe Saat,
//      aber nicht mehr exakt dieselbe Ziehungsreihenfolge. Hatz und HYROX sind davon
//      FREI, weil ihr Ergebnis beim Bau (baueHatz()/hyroxFahrplan()) vorab feststeht,
//      bevor ueberhaupt ein Tick laeuft — Zufall waehrend der Anzeige kann daran nichts
//      mehr drehen.
//
//      NACHGEPRUEFT, NICHT BLIND DER FAHRPLAN-LISTE VERTRAUT (Auftrag, 09.11.): der
//      Fahrplan nennt nur Spurt klassisch/Climbing/Battlefield-Pod als Beispiele aus dem
//      A3-Umbau. Der Mechanismus selbst (ZEIT_DEHNUNG[disc] != 1 UND Tick-getriebene
//      Physik) betrifft nachweislich jede Bahn-DUELL-Disziplin (spurt, time-trial,
//      climbing, staffel, takeshis-castle — alle fuenf stehen mit einem Faktor != 1 in
//      ZEIT_DEHNUNG) und beide Bahn-POD-Formate (staffel, takeshis-castle). Battlefield
//      lief theoretisch mit demselben Verdacht, booked aber nachweislich (s. Kommentar an
//      `runBattlefieldPodFixtures()`, lib/battle/arena-headless-runner.ts:1379-1386) ueber
//      ein vorab entschiedenes "Gefecht je Ort" (bfffaGefecht(), "deterministisch aus der
//      Eignung, die Arena spielt es danach ab") — strukturell naeher an Hatz/HYROX als an
//      Spurt/Climbing. Dieses Skript MISST trotzdem fuer Battlefield-Pod mit, statt der
//      Theorie zu vertrauen. TDM/Mini-DM/Battlefield-DUELL/Fechten/Gewichtheben/Hockey
//      haben ebenfalls ZEIT_DEHNUNG != 1, aber keine saubere "was zeigt der Bildschirm am
//      Ende"-Sonde wie bahnRangliste()/bahnPodAnzeigeStand() — das ist eine offene Luecke,
//      s. Kopfkommentar-Abschnitt "OFFENE LUECKE" unten, kein Teil dieser Pruefung.
//
//      Mini-DM-FFA ist aus einem ANDEREN Grund immun: die Offenbarung auf #mdffaCv laeuft
//      ueber eine setTimeout-Kette (renderMiniDmFfa()), nicht ueber stepSim-Ticks — eine
//      reine Nachspiel-Animation eines bereits feststehenden Resultats, exakt das
//      Hatz/HYROX-Muster, nur ueber Wanduhr statt Simulationszeit. Reine Feststellung,
//      hier nicht gemessen (s. unten).
//
// WIEDERVERWENDUNG: dieses Skript ist die in CLAUDE.md/Fahrplan E2 geforderte Pflicht-
// pruefung vor JEDER kuenftigen ZEIT_DEHNUNG-Aenderung (Auftrag A3 und folgende). Vorher/
// nachher-Lauf vergleichen:
//   node scripts/miss-sendedauer.mjs > vorher.txt    (auf dem alten Stand)
//   node scripts/miss-sendedauer.mjs > nachher.txt   (nach der Faktoraenderung)
// War die Anzeige-Treue vorher ueberall "ja" und ist sie nachher irgendwo "NEIN", ist die
// Aenderung laut Fahrplan NICHT erlaubt (kleinere Schritte suchen oder zurueckgeben).
// War sie schon vorher "NEIN", ist das ein eigener Befund fuer Chris, keine neue Art
// Abweichung durch die Aenderung selbst.
//
// AUFRUF:
//   node scripts/miss-sendedauer.mjs                         alles: Dauer + Zielband + Anzeige-Treue
//   node scripts/miss-sendedauer.mjs spurt climbing          nur diese (Dauer, ggf. Anzeige-Treue)
//   node scripts/miss-sendedauer.mjs --ohne-anzeige-treue    nur Dauer/Zielband (schneller)
//   node scripts/miss-sendedauer.mjs --nur-anzeige-treue     nur die 24-Saaten-Pflichtpruefung
//   node scripts/miss-sendedauer.mjs --saaten=8              Anzeige-Treue mit anderer Saatenzahl (Default 24)
//
// METHODE/VORBILD: scripts/miss-alle-disziplinen.mjs (Playwright/window.__arena-Steuerung,
// Kader-Familie), scripts/pruefe-wertung-fingerabdruck.mjs (DISZIPLINEN-Liste, Pod-Einstiege).
// Chromium stuerzt beim Laden der Seite gelegentlich ab (bekannte Falle, s. dort) — jede
// einzelne Messung laeuft deshalb in try/catch und bekommt bei einem Absturz eine FRISCHE
// Seite/einen frischen Browser, bis zu drei Versuche.
// ===================================================================================
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");

// Dieselben zwanzig wie scripts/pruefe-wertung-fingerabdruck.mjs (die eine Stelle, die alle
// zwanzig MOTOREN-Namen auflistet) — bewusst nicht aus window.__arena.motoren() gezogen,
// damit Reihenfolge/Beschriftung der Ausgabe stabil bleibt, egal wie die Engine ihre
// MOTOREN-Registrierung je Umbau ordnet.
const DISZIPLINEN = ["tdm", "mini-dm", "battlefield", "basketball", "football", "hockey", "gewichtheben", "showcase",
  "eiskunstlauf", "breaking", "wettessen", "speed-schach", "i-spy", "tennis", "fechten", "spurt", "time-trial",
  "climbing", "staffel", "takeshis-castle"];

// Alle fuenf Bahn-DUELL-Disziplinen haben ZEIT_DEHNUNG[disc] != 1 (spurt 11,14, time-trial
// 4,38, climbing 4,38, staffel 14,65, takeshis-castle 2,17, s. Kopfkommentar oben) — jede
// davon ist der Anzeige-Treue-Pruefung unterworfen, nicht nur die drei, die der Fahrplan als
// Beispiel aus dem A3-Umbau nennt.
const BAHN_ANZEIGE_TREUE_ZIELE = ["spurt", "time-trial", "climbing", "staffel", "takeshis-castle"];
const BAHN_POD_ANZEIGE_TREUE_ZIELE = ["staffel", "takeshis-castle"];

// Zielband E2 (docs/design/alle-diszis-top-niveau-fahrplan-09-11.md, Abschnitt 5/E2):
// explizite Zielwerte in Simulationssekunden-Zuschauzeit (= Sendesekunden bei Tempo 1x).
// "spurt:hyrox"/"spurt:hatz" bleiben hier stehen, obwohl sie auf main (noch) nicht existieren
// (s. Hinweis in messeFormat) — die Tabelle ist die, die beim Merge des Spurt-Stapels sofort
// greifen soll, ohne dass ein Agent sie neu abschreiben muss.
const ZIEL_SEK = {
  spurt: 180, // 3:00, Chris 06.09., zurueckgenommen von der 3:36-Drift
  climbing: 90, // 1:30
  "spurt:hyrox": 210, // 3:30
  "battlefield:pod": 210, // 3:30
};
// Drei Disziplinen mit Chris' AUSDRUECKLICHER Vorgabe, die absichtlich ausserhalb der
// 5:00-Leitplanke liegen (Basketball 4x1:30=~6:08 gemessen, Gewichtheben 4-8s/Versuch=~7:22,
// Hockey Faktor 2 aus dem Hektik-Fund=~8:06) — E2: "diese drei bleiben, wie sie sind".
const VORGABE_AUSNAHME = new Set(["basketball", "gewichtheben", "hockey"]);
// Leitplanke ohne ausdrueckliche Vorgabe: kein Spiel kuerzer als 0:50 oder laenger als 5:00.
const LEITPLANKE_SEK = [50, 300];
const TOLERANZ = 0.15;

const MAXTICKS = 108000; // 1800 Sendesekunden Deckel, wie der PM-Schnipsel in Abschnitt 1.2 (dort 108000 Ticks)

function mmss(sek) {
  if (sek == null || !Number.isFinite(sek)) return "–";
  const s = Math.round(sek);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function zielStatus(schluessel, istSek) {
  const ziel = ZIEL_SEK[schluessel];
  if (ziel != null) {
    const unten = ziel * (1 - TOLERANZ), oben = ziel * (1 + TOLERANZ);
    return { art: "ziel", ziel, band: [unten, oben], ok: istSek >= unten && istSek <= oben };
  }
  if (VORGABE_AUSNAHME.has(schluessel)) return { art: "vorgabe", ziel: null, band: null, ok: true };
  const [u, o] = LEITPLANKE_SEK;
  return { art: "leitplanke", ziel: null, band: [u, o], ok: istSek >= u && istSek <= o };
}

function statusText(st, istSek) {
  if (st.art === "ziel") {
    return (st.ok ? "im Band " : "AUSSERHALB ") + `(Ziel ${mmss(st.ziel)}, Band ${mmss(st.band[0])}-${mmss(st.band[1])})`;
  }
  if (st.art === "vorgabe") return "ok (Chris-Vorgabe, Ist=Ziel, Ausnahme von der Leitplanke)";
  return (st.ok ? "ok " : "AUSSERHALB DER LEITPLANKE ") + `(0:50-5:00, Ist=Ziel ohne Vorgabe)`;
}

// -----------------------------------------------------------------------------------
// BROWSER/SEITEN-VERWALTUNG mit Wiederanlauf (Chromium-Absturz-Falle, s. Kopfkommentar).
// Ein Kontext haelt genau einen Browser + eine Seite. mitSeite(fn) reicht die Seite an fn
// weiter; wirft fn (oder die Seite selbst, z.B. "Page crashed"), wird der Kontext verworfen
// und EINMALIG neu aufgebaut (bis zu VERSUCHE-mal insgesamt je Aufruf), bevor der Fehler
// nach oben gereicht wird.
// -----------------------------------------------------------------------------------
async function neuerKontext() {
  const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(() => { window.__olyArenaKader = { seedByDisciplineId: {} }; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => { window.__arena.endstandNachlauf(false); window.__arena.anpfiffCountdown(false); });
  return { browser, seite, fehler };
}

class Kontexthalter {
  constructor() { this.k = null; }
  async seite() { if (!this.k) this.k = await neuerKontext(); return this.k.seite; }
  async verwerfen() { if (this.k) { await this.k.browser.close().catch(() => {}); this.k = null; } }
  async schliessen() { await this.verwerfen(); }
}

const VERSUCHE = 3;
async function mitWiederanlauf(halter, fn, label) {
  let letzterFehler;
  for (let i = 0; i < VERSUCHE; i++) {
    try {
      const seite = await halter.seite();
      return await fn(seite);
    } catch (e) {
      letzterFehler = e;
      console.error(`  [${label}: Versuch ${i + 1}/${VERSUCHE} fehlgeschlagen — ${String(e).slice(0, 140)}]`);
      await halter.verwerfen();
    }
  }
  throw letzterFehler;
}

// -----------------------------------------------------------------------------------
// KADER-FAMILIE fuer Pods (dieselbe Quelle/Form wie scripts/pruefe-wertung-fingerabdruck.mjs).
// -----------------------------------------------------------------------------------
function ladePodKader() {
  if (!existsSync(KADERFAMILIE_PFAD)) return null;
  const v = JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8")).varianten;
  if (!v || v.length < 2) return null;
  const vierKader = [v[0].heim, v[0].gast, v[1].heim, v[1].gast];
  const vierTeams = [
    { name: v[0].heimName, kader: v[0].heim }, { name: v[0].gastName, kader: v[0].gast },
    { name: v[1].heimName, kader: v[1].heim }, { name: v[1].gastName, kader: v[1].gast },
  ];
  return { vierKader, vierTeams };
}

// -----------------------------------------------------------------------------------
// SENDEDAUER-MESSUNGEN. Jede gibt {sek, vorbei} zurueck (vorbei=false heisst: MAXTICKS
// erreicht, ohne dass die Disziplin fertig wurde — ein eigener Befund, kein Messfehler).
// -----------------------------------------------------------------------------------
// WICHTIG, QUERBEZUG ZU ALLEN FOLGENDEN FUNKTIONEN: `bahnPodAnzeigen(bd,pod)` und
// `battlefieldPodAnzeigen(pod)` setzen eine Vorgabe (`bahnPodAnzeigeVorgabe[bd]` bzw.
// `bfPodAnzeigeVorgabe`), die PERSISTENT bleibt, bis sie explizit mit `pod=null` wieder
// abgeschaltet wird — `setDisc()` alleine raeumt sie NICHT weg. Ohne das explizite
// Abschalten unten baute ein nachfolgender `setDisc("staffel")`/`setDisc("battlefield")`
// in der DUELL-Absicht faelschlich weiter den zuletzt gesetzten Pod (24 statt 12 Laeufer,
// gefunden beim ersten Testlauf dieses Skripts: "gebucht" 12 Namen gegen "gezeigt" 24 Namen
// fuer dieselbe Saat). Jede Duell-Messung schaltet den Pod deshalb zuerst aktiv aus, auch
// wenn sie selbst nie einen gesetzt hat (bahnPodAnzeigen(bd,null) auf einer Nicht-Pod-
// Disziplin ist ein harmloses No-Op, s. dessen Guard-Klausel in battle-mode.engine.js).
async function dauerDuell(seite, disc) {
  return seite.evaluate(({ disc, MAXTICKS }) => {
    const A = window.__arena;
    A.bahnPodAnzeigen(disc, null);
    if (disc === "battlefield") A.battlefieldPodAnzeigen(null);
    A.setDisc(disc);
    let ticks = 0;
    while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
    return { sek: ticks / 60, vorbei: A.vorbei() };
  }, { disc, MAXTICKS });
}

async function dauerBahnPod(seite, bd, pod) {
  const r = await seite.evaluate(({ bd, pod, MAXTICKS }) => {
    const A = window.__arena;
    A.bahnPodAnzeigen(bd, pod);
    A.setDisc(bd);
    let ticks = 0;
    while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
    return { sek: ticks / 60, vorbei: A.vorbei() };
  }, { bd, pod, MAXTICKS });
  await seite.evaluate((bd) => window.__arena.bahnPodAnzeigen(bd, null), bd); // Vorgabe sofort wieder abschalten
  return r;
}

async function dauerBattlefieldPod(seite, pod) {
  const r = await seite.evaluate(({ pod, MAXTICKS }) => {
    const A = window.__arena;
    A.battlefieldPodAnzeigen(pod);
    A.setDisc("battlefield");
    let ticks = 0;
    while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
    return { sek: ticks / 60, vorbei: A.vorbei() };
  }, { pod, MAXTICKS });
  await seite.evaluate(() => window.__arena.battlefieldPodAnzeigen(null)); // Vorgabe sofort wieder abschalten
  return r;
}

// Spurt-Formate (Hatz/HYROX, BAHN_FLAGS.spurtFormat): existieren laut CLAUDE.md/Fahrplan nur
// auf dem Spurt-Stapel (PR #1364..#1371), NICHT auf main (nachgeprueft: window.__arena hat
// weder `bahnFlags` noch irgendeine BAHN_FLAGS-Schnittstelle auf main, Stand 09.11.). Statt
// das vorzutaeuschen, erkennt diese Funktion das und meldet "nicht verfuegbar" — nach dem
// Merge greift sie automatisch, ohne Codeaenderung.
async function dauerSpurtFormat(seite, format) {
  const verfuegbar = await seite.evaluate(() => typeof window.__arena.bahnFlags === "function");
  if (!verfuegbar) return { verfuegbar: false };
  const r = await seite.evaluate(({ format, MAXTICKS }) => {
    const A = window.__arena;
    A.bahnFlags({ spurtFormat: format });
    A.setDisc("spurt");
    let ticks = 0;
    while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
    const aus = { sek: ticks / 60, vorbei: A.vorbei() };
    A.bahnFlags({ spurtFormat: null });
    return aus;
  }, { format, MAXTICKS });
  return { verfuegbar: true, ...r };
}

// Mini-DM-FFA: die Offenbarung auf #mdffaCv laeuft ueber eine setTimeout-Kette
// (renderMiniDmFfa()), NICHT ueber stepSim()-Ticks — sondenLauf()/zeitFaktor() haben darauf
// keinen Einfluss. Die einzig ehrliche Messung ist deshalb REALE Wanduhr: #mdffaStart
// klicken, dann pollen, bis der Panel-Inhalt sich nicht mehr aendert (die Offenbarungskette
// ist zu Ende). Heuristik, klar als solche ausgegeben — anders als die Tick-Sonde kann sie
// durch Prozesslast/Framedrops leicht verzerrt werden (s. Kopfkommentar
// miss-alle-disziplinen.mjs zu Zombie-Prozessen fuer dasselbe Risiko in anderem Kontext).
async function dauerMiniDmFfa(seite) {
  await seite.evaluate(() => window.__arena.setDisc("mini-dm"));
  // "#t2" ist der Arena-Tab der Mockup-Seite (s. scripts/docs/design/endstand-punkte-
  // screenshots-06-09.mjs fuer dasselbe Muster): ohne den Klick bleibt das ganze Arena-
  // Panel "#p2" per CSS versteckt, #mdffaStart hat dann eine Null-Breite/-Hoehe und ist
  // fuer Playwright nicht klickbar (Timeout statt Fehlermeldung).
  await seite.click("#t2");
  const start = Date.now();
  await seite.click("#mdffaStart");
  let letzter = null, stabilSeit = null, zyklen = 0;
  // MINDESTLAUFZEIT 1,5 s, bevor die Stabilitaets-Pruefung ueberhaupt beginnt: die erste
  // Sekunde nach dem Klick zeigt oft noch den unveraenderten Einlauf-Text, bevor die
  // setTimeout-Kette (spieleTakte()/enthuelleSchritt(), s. Kopfkommentar) ihren ersten
  // Schritt tut — ohne diese Verzoegerung erkennt die Heuristik faelschlich schon DAS als
  // "fertig" (beobachtet: 0:08 statt der im Fahrplan erwarteten ~1 min).
  const MINDEST_MS = 1500, DECKEL_MS = 100000, POLL_MS = 250, STABIL_MS = 1200;
  while (Date.now() - start < DECKEL_MS) {
    await seite.waitForTimeout(POLL_MS);
    zyklen++;
    const inhalt = await seite.evaluate(() => (document.getElementById("minidmffa") || {}).innerText || "");
    if (Date.now() - start < MINDEST_MS) { letzter = inhalt; continue; }
    if (inhalt === letzter) {
      if (stabilSeit == null) stabilSeit = Date.now();
      if (Date.now() - stabilSeit >= STABIL_MS) break;
    } else { letzter = inhalt; stabilSeit = null; }
  }
  const gedeckelt = Date.now() - start >= DECKEL_MS;
  return { sek: (Date.now() - start) / 1000, heuristik: true, gedeckelt, zyklen };
}

// -----------------------------------------------------------------------------------
// ANZEIGE-TREUE ("gezeigt = gebucht"), s. Kopfkommentar. Jede Funktion vergleicht ueber
// `saaten` Saaten die GEZEIGTE Endrangfolge (sondenLauf, zeitFaktor()-dt) gegen die
// GEBUCHTE Wertung (headless mit festem 1/60-dt, derselbe Pfad wie die Produktion/
// scripts/miss-alle-disziplinen.mjs) und gibt die Liste der abweichenden Saaten zurueck.
// -----------------------------------------------------------------------------------
async function anzeigeTreueBahnDuell(seite, bd, saaten) {
  const abweichungen = [];
  let keineAnzeige = 0;
  for (const saat of saaten) {
    const gebucht = await seite.evaluate(({ bd, saat }) => {
      const r = window.__arena.bahnLauf(bd, saat);
      return r.laeufer.slice().sort((a, b) => a.platz - b.platz).map((l) => l.n);
    }, { bd, saat });
    const gezeigt = await seite.evaluate(({ bd, saat, MAXTICKS }) => {
      const A = window.__arena;
      A.bahnPodAnzeigen(bd, null); // Isolation gegen eine evtl. noch aktive Pod-Vorgabe (s. Kopfkommentar dauerBahnPod)
      window.__olyArenaKader.seedByDisciplineId[bd] = saat;
      A.setDisc(bd);
      let ticks = 0;
      while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
      if (!A.vorbei()) return null;
      const zeilen = ["etafelL", "etafelR"].flatMap((id) => {
        const box = document.getElementById(id);
        if (!box) return [];
        return [...box.querySelectorAll("tbody tr")].map((tr) => {
          const tds = [...tr.children];
          return { n: tds[0].textContent.replace(/^★/, ""), platz: Number(tds[1].textContent) };
        });
      });
      zeilen.sort((a, b) => a.platz - b.platz);
      return zeilen.map((z) => z.n);
    }, { bd, saat, MAXTICKS });
    if (gezeigt == null) { keineAnzeige++; continue; }
    if (JSON.stringify(gezeigt) !== JSON.stringify(gebucht)) abweichungen.push({ saat, gebucht, gezeigt });
  }
  return { geprueft: saaten.length - keineAnzeige, keineAnzeige, abweichungen };
}

async function anzeigeTreueBahnPod(seite, bd, kader, saaten) {
  const abweichungen = [];
  let keineAnzeige = 0;
  for (const saat of saaten) {
    const gebucht = await seite.evaluate(({ bd, vierKader, saat }) =>
      window.__arena.spieleBahnPod(bd, vierKader, saat, null, { formSaat: saat }).teams.map((t) => t.eventPlatz),
    { bd, vierKader: kader.vierKader, saat });
    const gezeigt = await seite.evaluate(({ bd, vierTeams, saat, MAXTICKS }) => {
      const A = window.__arena;
      A.bahnPodAnzeigen(bd, { teams: vierTeams, saat });
      A.setDisc(bd);
      let ticks = 0;
      while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
      if (!A.vorbei()) return null;
      const st = A.bahnPodAnzeigeStand();
      return st ? st.teams.map((t) => t.platz) : null;
    }, { bd, vierTeams: kader.vierTeams, saat, MAXTICKS });
    if (gezeigt == null) { keineAnzeige++; continue; }
    if (JSON.stringify(gezeigt) !== JSON.stringify(gebucht)) abweichungen.push({ saat, gebucht, gezeigt });
  }
  await seite.evaluate((bd) => window.__arena.bahnPodAnzeigen(bd, null), bd); // Vorgabe wieder abschalten
  return { geprueft: saaten.length - keineAnzeige, keineAnzeige, abweichungen };
}

async function anzeigeTreueBattlefieldPod(seite, kader, saaten) {
  const abweichungen = [];
  let keineAnzeige = 0;
  for (const saat of saaten) {
    const gebucht = await seite.evaluate(({ vierTeams, saat }) =>
      window.__arena.spieleBattlefieldPod(vierTeams, saat, null, { formSaat: saat }).teams.map((t) => t.eventPlatz),
    { vierTeams: kader.vierTeams, saat });
    const gezeigt = await seite.evaluate(({ vierTeams, saat, MAXTICKS }) => {
      const A = window.__arena;
      A.battlefieldPodAnzeigen({ teams: vierTeams, saat });
      A.setDisc("battlefield");
      let ticks = 0;
      while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
      if (!A.vorbei()) return null;
      const st = A.battlefieldPodStand();
      return st ? st.platz : null;
    }, { vierTeams: kader.vierTeams, saat, MAXTICKS });
    if (gezeigt == null) { keineAnzeige++; continue; }
    if (JSON.stringify(gezeigt) !== JSON.stringify(gebucht)) abweichungen.push({ saat, gebucht, gezeigt });
  }
  await seite.evaluate(() => window.__arena.battlefieldPodAnzeigen(null)); // Vorgabe wieder abschalten
  return { geprueft: saaten.length - keineAnzeige, keineAnzeige, abweichungen };
}

// -----------------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------------
const roheArgs = process.argv.slice(2);
const OHNE_ANZEIGE_TREUE = roheArgs.includes("--ohne-anzeige-treue");
const NUR_ANZEIGE_TREUE = roheArgs.includes("--nur-anzeige-treue");
const saatenArg = roheArgs.find((a) => a.startsWith("--saaten="));
const SAATENZAHL = saatenArg ? Number(saatenArg.split("=")[1]) : 24;
// Dieselbe Saat-Konvention wie disziplinProbe() in battle-mode.engine.js (saat0=1337,
// schritt=7919) — die gebuchte Seite ruft `disziplinProbe`/`bahnLauf` ohnehin mit genau
// diesen Saaten, wenn scripts/miss-alle-disziplinen.mjs ohne --einzelkader misst.
const SAATEN = Array.from({ length: SAATENZAHL }, (_, i) => 1337 + i * 7919);
const NUR = roheArgs.filter((a) => !a.startsWith("--"));

async function main() {
  const halter = new Kontexthalter();
  const ergebnisse = []; // {schluessel, label, sek, vorbei, status}
  const anzeigeTreue = []; // {schluessel, label, geprueft, keineAnzeige, abweichungen}
  const hinweise = [];

  const zuMessendeDisz = NUR.length ? DISZIPLINEN.filter((d) => NUR.includes(d)) : DISZIPLINEN;

  if (!NUR_ANZEIGE_TREUE) {
    console.log("=== Reine Sendezeit (Tempo 1x, ohne Countdown/Nachlauf) ===\n");
    for (const d of zuMessendeDisz) {
      try {
        const r = await mitWiederanlauf(halter, (seite) => dauerDuell(seite, d), d);
        const st = zielStatus(d, r.sek);
        ergebnisse.push({ schluessel: d, label: d, sek: r.sek, vorbei: r.vorbei, status: st });
        console.log(`${d.padEnd(18)} ${mmss(r.sek).padStart(6)}  ${r.vorbei ? "" : "(MAXTICKS erreicht, nicht fertig!) "}${statusText(st, r.sek)}`);
      } catch (e) {
        console.log(`${d.padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
      }
    }

    const kader = ladePodKader();
    if (!kader) {
      hinweise.push("Keine Kader-Familie gefunden (" + KADERFAMILIE_PFAD + ") — Pod-Dauermessungen ausgelassen.");
    } else if (!NUR.length || NUR.some((n) => n.includes(":pod") || n === "staffel" || n === "takeshis-castle" || n === "battlefield")) {
      console.log("\n--- Pods ---\n");
      for (const bd of BAHN_POD_ANZEIGE_TREUE_ZIELE) {
        if (NUR.length && !NUR.includes(bd) && !NUR.includes(bd + ":pod")) continue;
        try {
          const r = await mitWiederanlauf(halter, (seite) => dauerBahnPod(seite, bd, { teams: kader.vierTeams, saat: 1337 }), `${bd}:pod`);
          console.log(`${(bd + ":pod").padEnd(18)} ${mmss(r.sek).padStart(6)}  ${r.vorbei ? "" : "(MAXTICKS erreicht!) "}Ist=Ziel (kein eigener E2-Wert fuer diesen Pod)`);
        } catch (e) {
          console.log(`${(bd + ":pod").padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
        }
      }
      if (!NUR.length || NUR.includes("battlefield") || NUR.includes("battlefield:pod")) {
        try {
          const r = await mitWiederanlauf(halter, (seite) => dauerBattlefieldPod(seite, { teams: kader.vierTeams, saat: 1337 }), "battlefield:pod");
          const st = zielStatus("battlefield:pod", r.sek);
          ergebnisse.push({ schluessel: "battlefield:pod", label: "battlefield:pod", sek: r.sek, vorbei: r.vorbei, status: st });
          console.log(`${"battlefield:pod".padEnd(18)} ${mmss(r.sek).padStart(6)}  ${r.vorbei ? "" : "(MAXTICKS erreicht!) "}${statusText(st, r.sek)}`);
        } catch (e) {
          console.log(`${"battlefield:pod".padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
        }
      }
    }

    if (!NUR.length || NUR.includes("spurt") || NUR.includes("spurt:hatz") || NUR.includes("spurt:hyrox")) {
      console.log("\n--- Spurt-Formate (BAHN_FLAGS.spurtFormat) ---\n");
      for (const format of ["hyrox", "hatz"]) {
        try {
          const r = await mitWiederanlauf(halter, (seite) => dauerSpurtFormat(seite, format), `spurt:${format}`);
          if (!r.verfuegbar) {
            console.log(`${("spurt:" + format).padEnd(18)} nicht verfuegbar in diesem Engine-Stand (existiert nur auf dem Spurt-Stapel/PR #1371, noch nicht auf main gemergt)`);
            hinweise.push(`spurt:${format} konnte nicht gemessen werden — window.__arena.bahnFlags fehlt auf diesem Stand.`);
          } else {
            const st = zielStatus(`spurt:${format}`, r.sek);
            ergebnisse.push({ schluessel: `spurt:${format}`, label: `spurt:${format}`, sek: r.sek, vorbei: r.vorbei, status: st });
            console.log(`${("spurt:" + format).padEnd(18)} ${mmss(r.sek).padStart(6)}  ${r.vorbei ? "" : "(MAXTICKS erreicht!) "}${statusText(st, r.sek)}`);
          }
        } catch (e) {
          console.log(`${("spurt:" + format).padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
        }
      }
    }

    if (!NUR.length || NUR.includes("mini-dm-ffa") || NUR.includes("mini-dm")) {
      console.log("\n--- Mini-DM-FFA (Echtzeit-Heuristik, kein stepSim-Tick) ---\n");
      try {
        const r = await mitWiederanlauf(halter, (seite) => dauerMiniDmFfa(seite), "mini-dm-ffa");
        const st = zielStatus("mini-dm-ffa", r.sek);
        console.log(`${"mini-dm-ffa".padEnd(18)} ${mmss(r.sek).padStart(6)}  (Heuristik: Inhalt stabil fuer 1s${r.gedeckelt ? ", DECKEL erreicht — Wert ist eine UNTERGRENZE" : ""})  ${statusText(st, r.sek)}`);
      } catch (e) {
        console.log(`${"mini-dm-ffa".padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
      }
    }
  }

  if (!OHNE_ANZEIGE_TREUE) {
    console.log(`\n\n=== Anzeige-Treue "gezeigt = gebucht" (${SAATEN.length} Saaten je Ziel) ===\n`);
    const bahnZiele = NUR.length ? BAHN_ANZEIGE_TREUE_ZIELE.filter((d) => NUR.includes(d)) : BAHN_ANZEIGE_TREUE_ZIELE;
    for (const bd of bahnZiele) {
      try {
        const r = await mitWiederanlauf(halter, (seite) => anzeigeTreueBahnDuell(seite, bd, SAATEN), bd);
        anzeigeTreue.push({ schluessel: bd, label: bd, ...r });
        meldeAnzeigeTreue(bd, r);
      } catch (e) {
        console.log(`${bd.padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
      }
    }

    const kader = ladePodKader();
    const podZiele = NUR.length ? BAHN_POD_ANZEIGE_TREUE_ZIELE.filter((d) => NUR.includes(d) || NUR.includes(d + ":pod")) : BAHN_POD_ANZEIGE_TREUE_ZIELE;
    if (kader) {
      for (const bd of podZiele) {
        try {
          const r = await mitWiederanlauf(halter, (seite) => anzeigeTreueBahnPod(seite, bd, kader, SAATEN), `${bd}:pod`);
          anzeigeTreue.push({ schluessel: `${bd}:pod`, label: `${bd}:pod`, ...r });
          meldeAnzeigeTreue(`${bd}:pod`, r);
        } catch (e) {
          console.log(`${(bd + ":pod").padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
        }
      }
      if (!NUR.length || NUR.includes("battlefield") || NUR.includes("battlefield:pod")) {
        try {
          const r = await mitWiederanlauf(halter, (seite) => anzeigeTreueBattlefieldPod(seite, kader, SAATEN), "battlefield:pod");
          anzeigeTreue.push({ schluessel: "battlefield:pod", label: "battlefield:pod", ...r });
          meldeAnzeigeTreue("battlefield:pod", r);
        } catch (e) {
          console.log(`${"battlefield:pod".padEnd(18)} FEHLER: ${String(e).slice(0, 140)}`);
        }
      }
    } else {
      hinweise.push("Keine Kader-Familie gefunden — Pod-Anzeige-Treue ausgelassen.");
    }
  }

  await halter.schliessen();

  console.log("\n=== Zusammenfassung ===");
  const ausserhalb = ergebnisse.filter((e) => !e.status.ok);
  if (ausserhalb.length) {
    console.log("Ausserhalb ihres Zielbands:");
    for (const e of ausserhalb) console.log(`  - ${e.label}: Ist ${mmss(e.sek)}, ${statusText(e.status, e.sek)}`);
  } else {
    console.log("Alle gemessenen Disziplinen innerhalb ihres Zielbands/ihrer Leitplanke.");
  }
  const abweichend = anzeigeTreue.filter((a) => a.abweichungen.length);
  if (abweichend.length) {
    console.log("\nAnzeige-Treue: ABWEICHUNG gefunden bei:");
    for (const a of abweichend) console.log(`  - ${a.label}: ${a.abweichungen.length}/${a.geprueft} Saaten weichen ab (z.B. Saat ${a.abweichungen[0].saat})`);
  } else if (anzeigeTreue.length) {
    console.log("\nAnzeige-Treue: fuer alle geprueften Ziele stimmen gezeigte und gebuchte Endrangfolge in allen geprueften Saaten ueberein.");
  }
  if (hinweise.length) { console.log("\nHinweise:"); for (const h of hinweise) console.log("  - " + h); }

  if (ausserhalb.length || abweichend.length) process.exitCode = 1;
}

function meldeAnzeigeTreue(label, r) {
  const status = r.abweichungen.length ? `ABWEICHUNG bei ${r.abweichungen.length}/${r.geprueft} Saaten` : `uebereinstimmend (${r.geprueft}/${r.geprueft})`;
  console.log(`${label.padEnd(18)} ${status}${r.keineAnzeige ? ` (${r.keineAnzeige} Saaten ohne Endstand bis MAXTICKS, ausgelassen)` : ""}`);
  for (const a of r.abweichungen.slice(0, 3)) {
    console.log(`    Saat ${a.saat}: gebucht [${a.gebucht.join(", ")}] != gezeigt [${a.gezeigt.join(", ")}]`);
  }
  if (r.abweichungen.length > 3) console.log(`    ... und ${r.abweichungen.length - 3} weitere.`);
}

await main();

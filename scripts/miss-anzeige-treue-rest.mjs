// ===================================================================================
// ANZEIGE-TREUE-SONDE B1 ("gezeigt = gebucht" fuer TDM/Mini-DM/Battlefield-Duell/Fechten/
// Gewichtheben/Hockey, 10.11., Fortsetzung von PR #1372/scripts/miss-sendedauer.mjs).
//
// AUSGANGSLAGE (s. scripts/miss-sendedauer.mjs Kopfkommentar "OFFENE LUECKE"): PR #1372
// hat den Anzeige-Treue-Fix fuer die fuenf Bahn-DUELL-Disziplinen gebaut (`ZEIT_DEHNUNG[disc]
// != 1` liess die ANGEZEIGTE Endreihenfolge von der GEBUCHTEN Wertung abweichen, weil
// loop()/sondenLauf() mit einem zeitFaktor()-gestreckten dt tickten, waehrend der
// Buchungspfad (bahnLauf()/MOTOREN[bd].lauf()) IMMER mit festem 1/60 rechnet). Sechs weitere
// Disziplinen haben ebenfalls `ZEIT_DEHNUNG[disc] != 1` (tdm 1,88, "mini-dm" 2,86, fechten
// 1,62, battlefield 5,00 -- Hockey faehrt KEINE eigene Dehnung, s. unten), aber nie eine
// eigene "gezeigt vs. gebucht"-Sonde bekommen. Dieses Skript schliesst die Luecke.
//
// ARCHITEKTUR-BEFUND, GEPRUEFT IM CODE (nicht angenommen): fuer diese sechs ist der Fix aus
// PR #1372 NICHT uebertragbar, weil er NUR fuer `istBahn(disc)` greift (anzeigeSechzigstel(),
// battle-mode.engine.js) -- fuer Feldspiel/Buehne/Kampf (istFeldspiel/istBuehne/istKampf)
// laeuft die Anzeige weiterhin mit `stepSim((1/60)/zeitFaktor())`, waehrend JEDE
// MOTOREN[d].lauf() (fuer Feldspiel/Buehne: stepFeldspiel(1/60)/stepBuehne(1/60); fuer Kampf/
// ARENA_ART: stepSimStumm(1/60)) weiterhin FEST mit 1/60 rechnet -- GENAU DAS BUG-MUSTER, DAS
// PR #1372 FUER DIE BAHN BEHOBEN HAT, STRUKTURELL AUCH HIER. Ob es sich tatsaechlich
// AUSWIRKT, haengt daran, ob irgendein rr()-Wurf in stepFeldspiel()/stepBuehne()/der
// Kampf-Logik (dem Teil von stepSim() hinter `istBahn`) PRO TICK (statt pro diskretem
// Ereignis) mit einer dt-skalierten Wahrscheinlichkeit zieht -- eine Durchsicht aller
// `rr()<...`-Stellen in battle-mode.engine.js fand NUR zwei solche Stellen, beide in
// stepSpurt() (Bahnwechsel/Tackle, die PR #1372 schon behoben hat). Das ist aber eine
// Durchsicht, keine Garantie -- deshalb MISST dieses Skript trotzdem, statt der Theorie zu
// vertrauen (dieselbe Vorsicht wie PR #1372 selbst sie fuer Battlefield-Pod einfordert).
//
// SONDE B1 (additiv, battle-mode.engine.js, 10.11.): `window.__arena.anzeigeTreueSonde(dId,saat)`
// faehrt denselben MOTOREN[dId]-Vertrag (sichern/vorher/bau/lauf/zurueck), den auch
// spieleFeldspiel()/spieleBuehneHeben()/spieleBuehneDuell()/spieleDisziplin() je Chassis
// einzeln kapseln, und liefert `wert`/`namen` plus ein `sieger`-Feld (kampfSieger()/
// fsSieger()/buehneSieger() -- dieselben Funktionen, die auch finish() beim echten Spielende
// synchron liest). EIGENE Funktion statt einer Erweiterung von spieleDisziplin()/`A.spiele()`,
// weil deren Rueckgabeform Teil des Wertungs-Fingerabdrucks ist (s. Kommentar an der
// Deklaration in battle-mode.engine.js) -- eine Erweiterung dort haette jeden Fingerabdruck-
// Eintrag veraendert, ohne dass sich an einer Wertung etwas aendert. `window.__arena.
// anzeigeTreueAktuell()` liest denselben Sieger-/wert()-Begriff am AKTUELLEN (z.B. per
// sondenLauf() durchlaufenen) Zustand, ohne selbst zu bauen -- das Gegenstueck fuer die
// GEZEIGTE Seite.
//
// WICHTIG: fuer TDM/Mini-DM/Battlefield (Kampf-Chassis) gibt es in der Produktion GAR KEINEN
// "gebucht"-Begriff aus der Tick-Simulation -- diese drei sind NICHT in
// ARENA_RESOLVED_DISCIPLINE_IDS (lib/battle/arena-resolved-disciplines.ts), ihr Saison-
// Ergebnis kommt fuer TDM/Battlefield-Duell aus der PPS-Duell-Bruecke (reine Score-Formel,
// null Simulationsticks), fuer Mini-DM/Battlefield-POD aus dem je-Ort-vorab-entschiedenen
// Gefecht (bereits gestern bestaetigt immun). Diese Sonde baut DESHALB fuer Kampf-
// Disziplinen ihr eigenes "gebucht" ad hoc (ueber diszSonde(), denselben Mechanismus, den
// disziplinProbe()/einflussVon() fuer die Pp/rho-Pflichtpruefung laengst nutzen) -- sie
// beantwortet "wenn man diese Simulation als Buchung nehmen wuerde, wuerde die Anzeige
// dasselbe zeigen", nicht "weicht die ECHTE Saison-Buchung ab" (die existiert fuer diese drei
// schlicht nicht). Fuer Fechten/Gewichtheben (arena-resolved) UND Hockey (arena-
// angeschlossen, Pp/rho-gemessen, aber wegen der 25-Pp-Schranke ebenfalls noch ueber die PPS-
// Bruecke gewertet, s. dieselbe Datei, Abschnitt "HOCKEY") gilt dieselbe Einschraenkung in
// abgeschwaechter Form: der Befund dieser Sonde ist unabhaengig vom aktuellen Wertungspfad
// gueltig (er prueft die MECHANIK), aendert aber nichts daran, dass auch Hockeys Saison-
// Ergebnis heute noch nicht ueber diese Simulation laeuft.
//
// METHODE, identisch zu miss-sendedauer.mjs/anzeigeTreueBahnDuell(): 24 Saaten
// (1337+i*7919, Projekt-Konvention), je Saat ein "gebucht"-Lauf (diszSonde(), fester 1/60-Takt
// via MOTOREN[d].lauf()) gegen einen "gezeigt"-Lauf (setDisc()+sondenLauf() bis vorbei(),
// zeitFaktor()-Takt via anzeigeSechzigstel()), verglichen nach SIEGER (0/1/Unentschieden) UND
// nach der nach wert() absteigend sortierten Namensliste (derselbe Rangbegriff wie
// disziplinProbe()/rho).
//
// AUFRUF:
//   node scripts/miss-anzeige-treue-rest.mjs                 alle sechs, 24 Saaten
//   node scripts/miss-anzeige-treue-rest.mjs tdm hockey       nur diese
//   node scripts/miss-anzeige-treue-rest.mjs --saaten=8       andere Saatenzahl
// ===================================================================================
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Die sechs Disziplinen aus dem Auftrag, mit ihrem Chassis nur zur Beschriftung (die Sonde
// selbst braucht die Unterscheidung nicht -- diszSonde()/sondenLauf()/aktuellerWert() sind
// chassis-generisch).
const ZIELE = [
  { id: "tdm", chassis: "kampf" },
  { id: "mini-dm", chassis: "kampf" },
  { id: "battlefield", chassis: "kampf" },
  { id: "fechten", chassis: "buehne" },
  { id: "gewichtheben", chassis: "buehne" },
  { id: "hockey", chassis: "feldspiel" },
];

const MAXTICKS = 108000; // dieselbe Deckelung wie miss-sendedauer.mjs (1800 Sendesekunden)

async function neuerKontext() {
  const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage();
  seite.on("pageerror", () => {});
  await seite.addInitScript(() => { window.__olyArenaKader = { seedByDisciplineId: {} }; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.anzeigeTreueSonde && window.__arena.sondenLauf, null, { timeout: 30000 });
  await seite.evaluate(() => { window.__arena.endstandNachlauf(false); window.__arena.anpfiffCountdown(false); });
  return { browser, seite };
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
      console.error(`  [${label}: Versuch ${i + 1}/${VERSUCHE} fehlgeschlagen — ${String(e).slice(0, 160)}]`);
      await halter.verwerfen();
    }
  }
  throw letzterFehler;
}

async function anzeigeTreueGenerisch(seite, dId, saaten) {
  const abweichungen = [];
  let keineAnzeige = 0;
  for (const saat of saaten) {
    const gebucht = await seite.evaluate(({ dId, saat }) => {
      const A = window.__arena;
      // Battlefield-Isolation (dasselbe Muster wie miss-sendedauer.mjs/dauerDuell): diszSonde()
      // geht zwar ueber M.bau()=build() direkt und nicht ueber reset(), umgeht die Pod-Weiche
      // damit ohnehin -- die Abschaltung hier ist trotzdem billig und macht die Annahme
      // explizit statt stillschweigend.
      if (dId === "battlefield" && A.battlefieldPodAnzeigen) A.battlefieldPodAnzeigen(null);
      const r = A.anzeigeTreueSonde(dId, saat);
      if (!r) return null;
      return { sieger: r.sieger, rang: Object.entries(r.wert || {}).sort((a, b) => b[1] - a[1]).map(([n]) => n) };
    }, { dId, saat });
    if (gebucht == null) return { geprueft: 0, keineAnzeige: saaten.length, abweichungen, fehler: "anzeigeTreueSonde lieferte null (kein Motor fuer \"" + dId + "\" angemeldet)" };
    const gezeigt = await seite.evaluate(({ dId, saat, MAXTICKS }) => {
      const A = window.__arena;
      if (dId === "battlefield" && A.battlefieldPodAnzeigen) A.battlefieldPodAnzeigen(null);
      window.__olyArenaKader.seedByDisciplineId[dId] = saat;
      A.setDisc(dId);
      let ticks = 0;
      while (ticks < MAXTICKS) { A.sondenLauf(120); ticks += 120; if (A.vorbei()) break; }
      if (!A.vorbei()) return null;
      const stand = A.anzeigeTreueAktuell();
      return { sieger: stand ? stand.sieger : null, rang: Object.entries((stand && stand.wert) || {}).sort((a, b) => b[1] - a[1]).map(([n]) => n) };
    }, { dId, saat, MAXTICKS });
    if (gezeigt == null) { keineAnzeige++; continue; }
    const siegerAbweicht = gebucht.sieger !== gezeigt.sieger;
    const rangAbweicht = JSON.stringify(gebucht.rang) !== JSON.stringify(gezeigt.rang);
    if (siegerAbweicht || rangAbweicht) {
      abweichungen.push({ saat, gebucht, gezeigt, siegerAbweicht, rangAbweicht });
    }
  }
  return { geprueft: saaten.length - keineAnzeige, keineAnzeige, abweichungen };
}

function meldeAnzeigeTreue(label, r) {
  if (r.fehler) { console.log(`${label.padEnd(16)} FEHLER: ${r.fehler}`); return; }
  const status = r.abweichungen.length ? `ABWEICHUNG bei ${r.abweichungen.length}/${r.geprueft} Saaten` : `uebereinstimmend (${r.geprueft}/${r.geprueft})`;
  console.log(`${label.padEnd(16)} ${status}${r.keineAnzeige ? ` (${r.keineAnzeige} Saaten ohne Endstand bis MAXTICKS, ausgelassen)` : ""}`);
  for (const a of r.abweichungen.slice(0, 3)) {
    const teile = [];
    if (a.siegerAbweicht) teile.push(`Sieger gebucht=${a.gebucht.sieger} != gezeigt=${a.gezeigt.sieger}`);
    if (a.rangAbweicht) teile.push(`Rang gebucht=[${a.gebucht.rang.join(",")}] != gezeigt=[${a.gezeigt.rang.join(",")}]`);
    console.log(`    Saat ${a.saat}: ${teile.join("; ")}`);
  }
  if (r.abweichungen.length > 3) console.log(`    ... und ${r.abweichungen.length - 3} weitere.`);
}

const roheArgs = process.argv.slice(2);
const saatenArg = roheArgs.find((a) => a.startsWith("--saaten="));
const SAATENZAHL = saatenArg ? Number(saatenArg.split("=")[1]) : 24;
const SAATEN = Array.from({ length: SAATENZAHL }, (_, i) => 1337 + i * 7919);
const NUR = roheArgs.filter((a) => !a.startsWith("--"));

async function main() {
  const halter = new Kontexthalter();
  const ergebnisse = [];
  const zuMessende = NUR.length ? ZIELE.filter((z) => NUR.includes(z.id)) : ZIELE;

  console.log(`=== Anzeige-Treue "gezeigt = gebucht" — TDM/Mini-DM/Battlefield(Duell)/Fechten/Gewichtheben/Hockey (${SAATEN.length} Saaten je Disziplin) ===\n`);
  for (const z of zuMessende) {
    try {
      const r = await mitWiederanlauf(halter, (seite) => anzeigeTreueGenerisch(seite, z.id, SAATEN), z.id);
      ergebnisse.push({ id: z.id, chassis: z.chassis, ...r });
      meldeAnzeigeTreue(`${z.id} (${z.chassis})`, r);
    } catch (e) {
      console.log(`${z.id.padEnd(16)} FEHLER: ${String(e).slice(0, 160)}`);
    }
  }

  await halter.schliessen();

  console.log("\n=== Zusammenfassung ===");
  const abweichend = ergebnisse.filter((e) => e.abweichungen && e.abweichungen.length);
  if (abweichend.length) {
    console.log("ABWEICHUNG gefunden bei:");
    for (const e of abweichend) console.log(`  - ${e.id}: ${e.abweichungen.length}/${e.geprueft} Saaten weichen ab`);
    process.exitCode = 1;
  } else {
    console.log("Fuer alle geprueften Disziplinen stimmen gezeigte und gebuchte Endreihenfolge/Sieger in allen geprueften Saaten ueberein.");
  }
}

await main();

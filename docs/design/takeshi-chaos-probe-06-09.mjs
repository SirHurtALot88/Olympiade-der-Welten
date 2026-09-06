// Chaos-/Outsmart-Sonde fuer Takeshi's Castle (Fable, 06.09.2026) — laeuft gegen den
// Prototyp-Worktree und misst je Variante kaderfest (fuenf Paarungen aus
// kaderfamilie-live-save.json, 24 Spiele je Paarung), dieselbe Rechnung wie
// scripts/miss-alle-disziplinen.mjs (rho je Spiel Median/Spannweite, Saison), plus die
// Chaos-Diagnose: Rempler, Getroffene, Ausweicher, Gedraenge je Rennen, Ausgeschiedene.
//
//   node chaos-probe.mjs <worktree> [spiele] [variante ...]
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { auswerten, median, spannweite, ladeKaderFamilieAusDatei } from "../../scripts/lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(process.argv[2]);
const SPIELE = Number(process.argv[3] || 24);
const NUR = process.argv.slice(4);
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fam = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
if (!fam) throw new Error("keine Kaderfamilie");

// Jede Variante: Felder, die auf BAHN_ART["takeshis-castle"] gesetzt werden (undefined = loeschen).
const T = { tackle: true, tackleKosten: 0 };
const KURSE_CHAOS = (c) => ([
  { name: "Nordhof", chaos: c[0], typen: ["TECHNIK","WENDIGKEIT","WUCHT","STEHEN","TECHNIK","ROBUST","WUCHT","TECHNIK","WENDIGKEIT","WUCHT","STEHEN","TECHNIK","ROBUST","WUCHT"] },
  { name: "Sumpfpfad", chaos: c[1], typen: ["WENDIGKEIT","TECHNIK","STEHEN","WUCHT","ROBUST","TECHNIK","WUCHT","WENDIGKEIT","STEHEN","TECHNIK","WUCHT","ROBUST","TECHNIK","WUCHT"] },
  { name: "Die Mauern", chaos: c[2], typen: ["WUCHT","TECHNIK","WENDIGKEIT","ROBUST","TECHNIK","STEHEN","WUCHT","WUCHT","TECHNIK","WENDIGKEIT","STEHEN","ROBUST","TECHNIK","WUCHT"] },
]);
const VARIANTEN = {
  V0_basis:        {},
  // --- Saeule 1: Rempler ---
  A_spurt50_1:     { ...T, tackleAb: 50, tackleRate: 1.0 },
  B_spurt36_24:    { ...T, tackleAb: 36, tackleRate: 2.4 },
  C_fenster30_2:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05 },
  C2_fenster30_4:  { ...T, tackleAb: 30, tackleRate: 4.0, tackleFenster: 0.05 },
  C3_fenster20_4:  { ...T, tackleAb: 20, tackleRate: 4.0, tackleFenster: 0.05, tackleCd: 1.2 },
  D_fenster_alle:  { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAlleSeiten: true },
  D2_alle_spur26:  { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAlleSeiten: true, tackleSpur: 2.6 },
  D3_gegner_spur26:{ ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleSpur: 2.6 },
  C4_fenster30_2_cd12:{ ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleCd: 1.2 },
  C5_fenster30_3:  { ...T, tackleAb: 30, tackleRate: 3.0, tackleFenster: 0.05 },
  E_gedraenge:     { gedraenge: { radius: 0.025, frei: 1, preis: 0.12 } },
  E2_gedraenge_st: { gedraenge: { radius: 0.03, frei: 0, preis: 0.15 } },
  F_C_plus_E:      { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12 } },
  G_F_nerven:      { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleNerven: 0.5, gedraenge: { radius: 0.025, frei: 1, preis: 0.12 } },
  H_F_kurschaos:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12 }, kurse: KURSE_CHAOS([0.7, 1.0, 1.5]) },
  // --- Saeule 2: Outsmart ---
  O1_ausweichen:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { basis: 0.05, spanne: 0.006 } },
  O2_lesen_gedr:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  O3_lesenBonus:   { lesenBonus: 0.25 },
  O3b_lesenBonus4: { lesenBonus: 0.40 },
  // --- Verfeinerungen um O2 (Runde 2) ---
  P1_O2_ausw_schwach: { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { basis: 0.0, spanne: 0.004 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P2_O2_ausw:         { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { basis: 0.05, spanne: 0.006 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P3_O2_gedr_stark:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.03, frei: 1, preis: 0.18, lesen: true } },
  P4_O2_rate3:        { ...T, tackleAb: 30, tackleRate: 3.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P5_O2_kurs:         { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true }, kurse: KURSE_CHAOS([0.7, 1.0, 1.5]) },
  P6_O2_alle_spur26:  { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAlleSeiten: true, tackleSpur: 2.6, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P7_O2_gedr_frei0:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 0, preis: 0.10, lesen: true } },
  P8_O2_ab40:         { ...T, tackleAb: 40, tackleRate: 2.5, tackleFenster: 0.05, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P9_O2_fenster08:    { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.08, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P10_O2_duell35:     { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { duell: 0.35 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P11_O2_duell25:     { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { duell: 0.25 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  P12_O2_duell50:     { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { duell: 0.50 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true } },
  // --- Beides zusammen (Kandidaten fuers Rezept) ---
  R1_alles:        { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { basis: 0.05, spanne: 0.006 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true }, lesenBonus: 0.25 },
  R2_alles_nerven: { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleNerven: 0.5, tackleAusweichen: { basis: 0.05, spanne: 0.006 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true }, lesenBonus: 0.25 },
  R3_alles_stark:  { ...T, tackleAb: 25, tackleRate: 3.0, tackleFenster: 0.06, tackleCd: 1.4, tackleAusweichen: { basis: 0.05, spanne: 0.006 }, gedraenge: { radius: 0.03, frei: 1, preis: 0.15, lesen: true }, lesenBonus: 0.25 },
  R4_alles_kurs:   { ...T, tackleAb: 30, tackleRate: 2.0, tackleFenster: 0.05, tackleAusweichen: { basis: 0.05, spanne: 0.006 }, gedraenge: { radius: 0.025, frei: 1, preis: 0.12, lesen: true }, lesenBonus: 0.25, kurse: KURSE_CHAOS([0.7, 1.0, 1.5]) },
};
const FELDER = ["tackleSpur","tackle","tackleAb","tackleRate","tackleKosten","tackleFenster","tackleAlleSeiten","tackleNerven","tackleCd","tackleAusweichen","gedraenge","lesenBonus","kurse"];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
  if (process.env.SAAT0) { await seite.evaluate((s0) => { window.__SAAT0 = s0; }, Number(process.env.SAAT0)); console.log("Saat0 = " + process.env.SAAT0 + " (Replikat, andere Renn-Saaten)"); }
  const basis = await seite.evaluate(() => window.__arena.bahnArtLesen("takeshis-castle"));
  const basisFelder = Object.fromEntries(FELDER.map((k) => [k, basis[k]]));

  const namen = NUR.length ? NUR : Object.keys(VARIANTEN);
  console.log(`Takeshi's Castle, ${SPIELE} Spiele x ${fam.familie.length} Paarungen (${fam.quelle})`);
  console.log("Variante           rho/Spiel  Spannw.  Saison  Spannw. | Rempler/Rennen  getroffen  ausgew.  Gedraenge/Rennen  Gedr.-s/Laeufer  raus%  Star#1%  Abnahme");
  for (const name of namen) {
    const v = VARIANTEN[name]; if (!v) { console.log(name + " — unbekannt"); continue; }
    const felder = { ...basisFelder, ...v };
    await seite.evaluate(([f]) => window.__arena.bahnArtSetzen("takeshis-castle", f), [felder]);
    const x = await seite.evaluate(([n, familie]) => window.__arena.disziplinProbe("takeshis-castle", { n, kaderFamilie: familie, ...(window.__SAAT0 ? { saat0: window.__SAAT0 } : {}) }), [SPIELE, fam.familie]);
    const ausw = x.varianten.map((va) => auswerten(va.spiele));
    let rennen = 0, tackles = 0, getackelt = 0, ausgewichen = 0, gedraengt = 0, gedrZeit = 0, laeufer = 0, raus = 0, star = 0;
    for (const va of x.varianten) for (const s of va.spiele) {
      rennen++;
      let best = null;
      for (const t of s.teilnehmer) {
        laeufer++; const d = t.diag || {};
        tackles += d.tackles || 0; getackelt += d.getackelt || 0; ausgewichen += d.ausgewichen || 0;
        gedraengt += d.gedraengt || 0; gedrZeit += d.gedraengeZeit || 0; raus += d.raus ? 1 : 0;
        if (!best || t.eig > best.eig) best = t;
      }
      const top = [...s.teilnehmer].sort((a, b) => b.wert - a.wert)[0];
      if (top && best && top.n === best.n) star++;
    }
    const sm = median(ausw.map((a) => a.spiel)), ss = spannweite(ausw.map((a) => a.spiel));
    const sa = median(ausw.map((a) => a.saison)), sas = spannweite(ausw.map((a) => a.saison));
    const ok = sm >= 0.80 ? "bestanden" : sm >= 0.70 ? "knapp" : "durchgefallen";
    console.log(name.padEnd(18) + sm.toFixed(3).padStart(9) + ss.toFixed(3).padStart(9) + sa.toFixed(3).padStart(8) + sas.toFixed(3).padStart(9)
      + " |" + (tackles / rennen).toFixed(2).padStart(14) + (getackelt / rennen).toFixed(2).padStart(11) + (ausgewichen / rennen).toFixed(2).padStart(9)
      + (gedraengt / rennen).toFixed(2).padStart(17) + (gedrZeit / laeufer).toFixed(2).padStart(16) + (100 * raus / laeufer).toFixed(1).padStart(7)
      + (100 * star / rennen).toFixed(0).padStart(8) + "   " + ok);
  }
  // Kadergroessen-Probe fuer die Kandidaten (2/3/5 je Seite), nur wenn verlangt
  if (process.env.JE_SEITE) {
    for (const name of namen) {
      const felder = { ...basisFelder, ...VARIANTEN[name] };
      await seite.evaluate(([f]) => window.__arena.bahnArtSetzen("takeshis-castle", f), [felder]);
      for (const js of process.env.JE_SEITE.split(",").map(Number)) {
        const x = await seite.evaluate(([n, familie, js]) => window.__arena.disziplinProbe("takeshis-castle", { n, kaderFamilie: familie, jeSeite: js }), [SPIELE, fam.familie, js]);
        const ausw = x.varianten.map((va) => auswerten(va.spiele));
        console.log(`  ${name} jeSeite=${js}: rho/Spiel ${median(ausw.map((a) => a.spiel)).toFixed(3)} (Spannw. ${spannweite(ausw.map((a) => a.spiel)).toFixed(3)}), Saison ${median(ausw.map((a) => a.saison)).toFixed(3)}`);
      }
    }
  }
  await seite.evaluate(([f]) => window.__arena.bahnArtSetzen("takeshis-castle", f), [basisFelder]);
  console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
} finally { await browser.close(); }

// ===================================================================================
// GEWICHTHEBEN-ARCHETYPEN-PROBE (Plan Schritt S4). Bildet der Motor die vier
// Chris-Archetypen tatsaechlich als das ab, was sie sein sollen?
//
//   Kraftpaket  (power/health)   fuehrt bei LAST        -> hoechste Zweikampf-Last
//   Techniker   (dexterity/speed) fuehrt bei der Gelingensquote -> mehr gueltige Versuche
//   Nervenbuendel (will/charisma) fuehrt bei dritten Versuchen  -> hoehere 3.-Versuch-Quote
//   Zocker      (charisma/speed)  fuehrt bei den groessten Spruengen -> groesste kg-Sprünge
//
// Methodik uebernommen aus miss-hockey-archetypen.mjs (das selbst aus
// battle-mode-nba2k-modell-plan.md, "Rollenprobe V/S" stammt): Terzil-Vergleich auf dem
// ECHTEN Kader (SQUAD/OPP aus bauBuehne), nicht auf einer synthetischen Population — das
// ist die Probe, die "gegen sonst neutrale Heber" tatsaechlich beantwortet: das mittlere
// Terzil IST die neutrale Masse, das obere Terzil der Archetyp.
//
//   node scripts/miss-gewichtheben-archetypen.mjs [spiele]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 320);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

function raenge(werte) {
  const idx = werte.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
  const r = new Array(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].w === idx[i].w) j++;
    const mittelRang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k].i] = mittelRang;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length;
  if (n < 2) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let za = 0, zb = 0, zab = 0;
  for (let i = 0; i < n; i++) { za += (a[i] - ma) ** 2; zb += (b[i] - mb) ** 2; zab += (a[i] - ma) * (b[i] - mb); }
  if (za === 0 || zb === 0) return null;
  return zab / Math.sqrt(za * zb);
}
const spearman = (a, b) => pearson(raenge(a), raenge(b));
const mittel = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const anz = (x, k = 3) => (x == null ? "—" : x.toFixed(k));

function terzil(liste, key) {
  const sortiert = [...liste].sort((a, b) => a[key] - b[key]);
  const k = Math.max(1, Math.floor(sortiert.length / 3));
  return { unten: sortiert.slice(0, k), mitte: sortiert.slice(k, sortiert.length - k), oben: sortiert.slice(sortiert.length - k) };
}

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });

const start = Date.now();
const protokolle = await seite.evaluate((n) => {
  const A = window.__arena, out = [];
  for (let i = 0; i < n; i++) out.push(A.spiele("gewichtheben", 1337 + i * 7919).protokoll);
  return out;
}, SPIELE);
await browser.close();
const sekunden = Math.round((Date.now() - start) / 1000);

// -----------------------------------------------------------------------------------
// AGGREGAT JE HEBER ueber alle Spiele (derselbe Kader in jedem Lauf, wie bei Hockey).
// -----------------------------------------------------------------------------------
const je = new Map();
for (const prot of protokolle) {
  for (const u of prot) {
    if (!je.has(u.n)) je.set(u.n, {
      n: u.n, k: 0, eig: 0, power: u.power, health: u.health, dexterity: u.dexterity,
      speed: u.speed, will: u.will, charisma: u.charisma,
      LAST: 0, TECHNIK: 0, NERVEN: 0, ANSAGE: 0,
      zweikampf: 0, gueltig: 0, versuche: 0, dritteV: 0, dritteT: 0, spruenge: [],
    });
    const z = je.get(u.n);
    z.k++; z.eig += u.eig; z.LAST += u.LAST; z.TECHNIK += u.TECHNIK; z.NERVEN += u.NERVEN; z.ANSAGE += u.ANSAGE;
    if (!u.nullwertung) z.zweikampf += u.zweikampf;
    let letzte = null;
    for (const r of u.runden) {
      z.versuche++;
      if (r.gueltig) z.gueltig++;
      if (r.versuch === 3) { z.dritteV++; if (r.gueltig) z.dritteT++; }
      if (letzte != null && r.kg > letzte) z.spruenge.push(r.kg - letzte);
      if (r.gueltig) letzte = r.kg;
    }
  }
}
// Rohattribute kommen jetzt direkt im Protokoll mit (s. bauBuehne: `attr` auf L, und
// spieleDisziplin's Gewichtheben-Zweig) — derselbe Kader in jedem Spiel, die Werte sind
// ueber alle Spiele hinweg identisch, daher genuegt der erste gesehene Wert je Heber.
const heber = [...je.values()].map((z) => ({
  n: z.n, spiele: z.k, eig: z.eig / z.k,
  LAST: z.LAST / z.k, TECHNIK: z.TECHNIK / z.k, NERVEN: z.NERVEN / z.k, ANSAGE: z.ANSAGE / z.k,
  power: z.power, health: z.health, dexterity: z.dexterity, speed: z.speed, will: z.will, charisma: z.charisma,
  zweikampfJeSpiel: z.zweikampf / z.k,
  gelingensquote: z.versuche ? z.gueltig / z.versuche : null,
  dritteQuote: z.dritteV ? z.dritteT / z.dritteV : null,
  sprungMittel: z.spruenge.length ? mittel(z.spruenge) : null,
})).filter((h) => h.power != null);

console.log(`Gewichtheben-Archetypen-Probe — ${protokolle.length} Spiele, ${sekunden}s\n`);
console.log(`Kader in der Probe: ${heber.length} Heber (derselbe Kader in jedem Spiel).\n`);

const kombiniert = (h, a, b) => (h[a] + h[b]) / 2;

function berichte(titel, inputKey, outputKey, outputLabel, zielText) {
  console.log("=".repeat(88));
  console.log(titel);
  console.log("=".repeat(88));
  const kandidaten = heber.filter((h) => h[outputKey] != null);
  const rho = spearman(kandidaten.map((h) => h[inputKey]), kandidaten.map((h) => h[outputKey]));
  const t = terzil(kandidaten, inputKey);
  const mUnten = mittel(t.unten.map((h) => h[outputKey]));
  const mOben = mittel(t.oben.map((h) => h[outputKey]));
  console.log(`  n=${kandidaten.length}   Spearman(Input, ${outputLabel})  rho = ${anz(rho)}`);
  console.log(`  Terzil unten (${t.unten.map((h) => h.n).join(", ")})`);
  console.log(`    ${outputLabel} Mittel = ${anz(mUnten)}`);
  console.log(`  Terzil oben  (${t.oben.map((h) => h.n).join(", ")})`);
  console.log(`    ${outputLabel} Mittel = ${anz(mOben)}`);
  console.log(`  Differenz oben minus unten = ${anz(mOben != null && mUnten != null ? mOben - mUnten : null)}`);
  console.log(`  Ziel: ${zielText}\n`);
  return { rho, mUnten, mOben };
}

for (const h of heber) h._kraftpaket = kombiniert(h, "power", "health");
for (const h of heber) h._techniker = kombiniert(h, "dexterity", "speed");
for (const h of heber) h._nervenbuendel = kombiniert(h, "will", "charisma");
for (const h of heber) h._zocker = kombiniert(h, "charisma", "speed");

const r1 = berichte("1) KRAFTPAKET (power/health) fuehrt bei LAST (Zweikampf-kg)",
  "_kraftpaket", "zweikampfJeSpiel", "Zweikampf/Spiel (Sinclair-kg)", "oben deutlich > unten, rho > 0");
const r2 = berichte("2) TECHNIKER (dexterity/speed) fuehrt bei der Gelingensquote",
  "_techniker", "gelingensquote", "Gelingensquote (gueltig/Versuche)", "oben > unten, rho > 0");
const r3 = berichte("3) NERVENBUENDEL (will/charisma) fuehrt bei dritten Versuchen",
  "_nervenbuendel", "dritteQuote", "3.-Versuch-Quote", "oben > unten, rho > 0");
const r4 = berichte("4) ZOCKER (charisma/speed) fuehrt bei den groessten Spruengen",
  "_zocker", "sprungMittel", "Sprung-Mittel (kg je Steigerung)", "oben > unten, rho > 0");

console.log("=".repeat(88));
console.log("KADERTABELLE (zum Nachvollziehen der Terzile)");
console.log("=".repeat(88));
console.log("Name                    Eig  Power Health  Dex Speed Will Char | Zweik. Geling% 3.V% Sprung");
for (const h of [...heber].sort((a, b) => b.eig - a.eig)) {
  console.log(h.n.padEnd(22) + h.eig.toFixed(0).padStart(5)
    + h.power.toFixed(0).padStart(7) + h.health.toFixed(0).padStart(7)
    + h.dexterity.toFixed(0).padStart(5) + h.speed.toFixed(0).padStart(6)
    + h.will.toFixed(0).padStart(5) + h.charisma.toFixed(0).padStart(5) + " |"
    + h.zweikampfJeSpiel.toFixed(0).padStart(7)
    + (h.gelingensquote != null ? (h.gelingensquote * 100).toFixed(0) : "—").padStart(8)
    + (h.dritteQuote != null ? (h.dritteQuote * 100).toFixed(0) : "—").padStart(6)
    + (h.sprungMittel != null ? h.sprungMittel.toFixed(1) : "—").padStart(7));
}

const bestanden = (r) => r.rho != null && r.rho > 0 && r.mOben != null && r.mUnten != null && r.mOben > r.mUnten;
console.log("\nZUSAMMENFASSUNG");
console.log(`  Kraftpaket    : ${bestanden(r1) ? "fuehrt" : "fuehrt NICHT"} (rho=${anz(r1.rho)})`);
console.log(`  Techniker     : ${bestanden(r2) ? "fuehrt" : "fuehrt NICHT"} (rho=${anz(r2.rho)})`);
console.log(`  Nervenbuendel : ${bestanden(r3) ? "fuehrt" : "fuehrt NICHT"} (rho=${anz(r3.rho)})`);
console.log(`  Zocker        : ${bestanden(r4) ? "fuehrt" : "fuehrt NICHT"} (rho=${anz(r4.rho)})`);
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 5).join(" | ") : "keine"));

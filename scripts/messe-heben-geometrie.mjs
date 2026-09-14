// ===================================================================================
// MISST DIE GEWICHTHEBEN-GEOMETRIE (Chris' Befund 13.09.: "die [Hantel] ist viel zu weit
// unten und beim heben wird sie quasi weit ueber den kopf geworfen. Das muss sich viel
// mehr am modell orientieren. Und wenn wir verschiedene modellgroessen haben von 1-10
// height dann musst du das ans modell anpassen.").
//
// Anders als scripts/messe-heben-handpunkt.mjs (das EINEN Griffpunkt je Blickrichtung
// suchte) misst diese Sonde die KOERPER-LANDMARKEN und die TATSAECHLICHE STANGENLAGE
// ueber mehrere Modellgroessen und alle HEBEN_PHASEN — also genau die zwei Fragen, die
// Chris stellt: sitzt die Stange relativ zum Modell richtig, und haelt das ueber
// groesse 1..10?
//
// METHODE
//   1. window.__arena.kaderSetzen({heim:[...]}) setzt DIESELBE Figur mit verschiedenen
//      `groesse`-Werten in den Kader — der Produktionspfad, den auch die echte App nimmt
//      (s. Kommentar an kaderSetzen). renderProbe liest die Groesse daraus, nicht als
//      Aufrufwert; die Sonde misst also, was das Spiel zeichnet.
//   2. window.__arena.setDisc("gewichtheben") schaltet die Disziplin scharf, sonst ist
//      istHeben() falsch und der Hantel-Zeichenblock wird gar nicht erreicht.
//   3. Zwei Renderings je Fall, BEIDE mit feldspiel=true und BEIDE in der "shoot"-Pose —
//      einmal mit disc="gewichtheben" (Koerper + Hantel), einmal mit disc="basketball"
//      (derselbe Koerper, keine Requisite: istHeben()/istHockey()/istSchach()/istFootball()
//      sind dort alle falsch). Die Alpha-Differenz beider Bilder ist EXAKT die Hantel.
//      NICHT feldspiel=false als Gegenbild nehmen: dieser Parameter schaltet zusaetzlich
//      Bogen-/Feuerwaffen-Overlays und die ani-Wahl um (s. :2827/:2853 der Engine) — ein
//      erster Messdurchlauf hielt so den BOGEN fuer die Hantel und meldete fuer "hoch" eine
//      Stangenmitte, die ueber alle Groessen konstant bei y=44,5 lag (in Wahrheit stand die
//      Stange dort laengst ausserhalb der Leinwand).
//   4. Koerper-Landmarken aus dem reinen Koerperbild: Scheitel, Schulterlinie, Brustbein,
//      Huefte, Sohle. Schulter/Huefte ueber den Breitenverlauf der Silhouette (die
//      Silhouette springt an der Schulter sprunghaft breit und verjuengt sich zur Huefte).
//
// renderProbe zeichnet IMMER bei x=32,y=46 der Leinwand, unabhaengig von `leinwand` —
// Leinwand-Pixel und Zellkoordinaten sind also deckungsgleich (s. docs/design/
// sprite-handpunkte.md). Eine grosse Leinwand gibt nur einer grossen Figur Platz. Die
// Ueberkopf-Phase "hoch" liegt bei den heutigen Offsets teils OBERHALB von y=0 und wuerde
// weggeschnitten — deshalb wird zusaetzlich ein RECHNERISCHER Sollwert aus derselben
// Formel ausgegeben, die die Engine benutzt (y_hand + dy*Z), und die Messung nur dort
// verwendet, wo die Stange im Bild liegt.
//
// Aufruf: node scripts/messe-heben-geometrie.mjs [zielordner]
// ===================================================================================
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "..");
const MOCKUP = join(REPO, "public/mockups/battle-mode.html");
const ZIEL = process.argv[2] || join(REPO, "docs/design");

const LEINWAND = 256;
const ANKER_X = 32, ANKER_Y = 46; // Fusspunkt, den renderProbe fest setzt
const GROESSEN = [1, 3, 5, 7, 10];
const PHASEN = ["boden", "antritt", "zug", "hoch", "ablage"];
const NAME = "Johanna";          // Standard-Humanoid (kein b.vollbild)
const NAME_VOLL = "Krag'Zul";    // Vollbild-Kreatur (Golem-Blatt) — Gegenprobe zu Befund 2
const DIR = 3;                   // rechts, Profil: die Stange zeigt dort ihre volle Laenge

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const discSetzen = (d) => seite.evaluate((x) => window.__arena.setDisc(x), d);

// Originalkader merken — groesseSetzen() unten ersetzt SQUAD durch eine Ein-Mann-Liste
// (das ist der Punkt: dieselbe Figur mehrfach mit anderer Groesse), die Kader-Erhebung
// am Ende braucht aber wieder alle zwoelf mit ihren ECHTEN Groessen.
const KADER_ORIG = await seite.evaluate(() => ({
  heim: JSON.parse(JSON.stringify(window.__arena.kader().map(({ skills, ...r }) => r))),
  gast: JSON.parse(JSON.stringify(window.__arena.opp().map(({ skills, ...r }) => r))),
}));
const kaderZurueck = () => seite.evaluate((k) => window.__arena.kaderSetzen(k), KADER_ORIG);

// Eine Figur mit vorgegebener Groesse in den Kader setzen (Produktionspfad).
async function groesseSetzen(name, groesse) {
  const alt = [...KADER_ORIG.heim, ...KADER_ORIG.gast].find((x) => x.n === name);
  if (!alt) throw new Error("nicht im Kader: " + name);
  await seite.evaluate((e) => window.__arena.kaderSetzen({ heim: [e] }), { ...alt, groesse });
}

const pixel = (durl) =>
  seite.evaluate(async ([d, gr]) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = d; });
    const c = document.createElement("canvas"); c.width = gr; c.height = gr;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, gr, gr).data);
  }, [durl, LEINWAND]);

const probe = (name, feldspiel, phase) =>
  seite.evaluate(
    ([n, f, d, gr, ph]) => window.__arena.renderProbe(n, "shoot", f, d, 0.1, gr, ph),
    [name, feldspiel, DIR, LEINWAND, phase],
  );

// Alpha-Maske als Zeilenprofil: je y die Menge der x mit Alpha > 40.
function zeilen(px) {
  const z = [];
  for (let y = 0; y < LEINWAND; y++) {
    let min = null, max = null, n = 0;
    for (let x = 0; x < LEINWAND; x++) {
      if (px[(y * LEINWAND + x) * 4 + 3] > 40) { if (min === null) min = x; max = x; n++; }
    }
    z.push({ y, min, max, n, breite: min === null ? 0 : max - min + 1 });
  }
  return z;
}

// Koerper-Landmarken aus dem Zeilenprofil des REINEN Koerperbilds.
function landmarken(z) {
  const belegt = z.filter((r) => r.n > 0);
  if (!belegt.length) return null;
  const scheitel = belegt[0].y, sohle = belegt[belegt.length - 1].y;
  const hoehe = sohle - scheitel + 1;
  // Schulter: erste Zeile im oberen Drittel, ab der die Breite sprunghaft auf >= 70% der
  // Maximalbreite geht (der Kopf darueber ist deutlich schmaler als die Schulterpartie).
  const maxB = Math.max(...belegt.map((r) => r.breite));
  const obere = belegt.filter((r) => r.y <= scheitel + hoehe * 0.55);
  const schulter = (obere.find((r) => r.breite >= maxB * 0.7) || obere[0]).y;
  // Huefte: unterhalb der Schulter die schmalste Zeile vor dem Beinansatz (untere Haelfte
  // wird durch die Beine wieder breiter) — Suchfenster Schulter..Mitte.
  const mitte = scheitel + hoehe * 0.62;
  const rumpf = belegt.filter((r) => r.y > schulter + 3 && r.y <= mitte);
  const huefte = rumpf.length ? rumpf.reduce((a, r) => (r.breite < a.breite ? r : a)).y : Math.round(mitte);
  return { scheitel, sohle, hoehe, schulter, huefte, maxB,
    // Brustbein/Racklage: anatomisch etwa auf Höhe des oberen Brustkorbdrittels, hier
    // gemessen als 25 % der Strecke Schulter->Huefte unterhalb der Schulterlinie.
    brustbein: Math.round(schulter + (huefte - schulter) * 0.25) };
}

// Hantel = Alpha-Differenz zwischen (Koerper+Hantel) und (nur Koerper).
function hantelKasten(pxMit, pxOhne) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < LEINWAND; y++) for (let x = 0; x < LEINWAND; x++) {
    const i = (y * LEINWAND + x) * 4;
    const a = pxMit[i + 3] > 40, b = pxOhne[i + 3] > 40;
    if (a && !b) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (n === 0) return null;
  return { x0, y0, x1, y1, n, mitteY: (y0 + y1) / 2, mitteX: (x0 + x1) / 2 };
}

const Z_VON = (g) => 0.8 + (g - 1) / 9 * 0.5; // groesseFaktor(), zur Kontrolle
// Die heutigen Offsets, 1:1 aus HEBEN_PHASEN der Engine — nur fuer den rechnerischen
// Sollwert, damit sich Messung und Formel gegenseitig pruefen.
const DY_HEUTE = { boden: 34, antritt: 34, zug: 2, hoch: -49, ablage: 40 };
const HAND_Y = 32; // HEBEN_HAND[3].y (dir=3 "rechts")

const ausgabe = { koerper: {}, vollbild: {} };

// Referenzbilder OHNE Requisite (gleiche Pose, andere Disziplin) zuerst einsammeln.
const ohneCache = {};
await discSetzen("basketball");
for (const name of [NAME, NAME_VOLL]) {
  ohneCache[name] = {};
  for (const g of GROESSEN) {
    await groesseSetzen(name, g);
    ohneCache[name][g] = await pixel(await probe(name, true, null));
  }
}

await discSetzen("gewichtheben");
for (const name of [NAME, NAME_VOLL]) {
  const topf = name === NAME ? ausgabe.koerper : ausgabe.vollbild;
  for (const g of GROESSEN) {
    await groesseSetzen(name, g);
    const ohne = ohneCache[name][g];
    const lm = landmarken(zeilen(ohne));
    // Z gesamt aus dem Bild selbst zurueckgerechnet: das Blatt ist 64*Z hoch und beginnt
    // bei y=46-46*Z. Ueber zwei bekannte Groessen waere das ueberbestimmt — hier reicht
    // der Inhalt: hoehenKorrektur() normiert die Inhaltshoehe auf HOEHEN_BEZUG=52, also
    // ist die gemessene Hoehe ~= 52*Z. Zur Kontrolle mitgeschrieben, nicht als Eingabe.
    const zGeschaetzt = lm ? +(lm.hoehe / 52).toFixed(4) : null;
    const je = {};
    for (const ph of PHASEN) {
      const mit = await pixel(await probe(name, true, ph));
      const gemessen = hantelKasten(mit, ohne);
      // Rechnerischer Sollwert derselben Formel: y_hand = 46-46*Z+HAND_Y*Z, by = y_hand+dy*Z.
      const soll = zGeschaetzt == null ? null
        : +(46 - 46 * zGeschaetzt + HAND_Y * zGeschaetzt + DY_HEUTE[ph] * zGeschaetzt).toFixed(1);
      je[ph] = { gemessen, formelY: soll };
    }
    topf[g] = { groesseFaktor: +Z_VON(g).toFixed(4), zGesamtGeschaetzt: zGeschaetzt, landmarken: lm, hantel: je };
  }
}

// ---------------------------------------------------------------------------------
// VOLLERHEBUNG UEBER DEN GANZEN KADER: wer bekommt ueberhaupt eine Hantel, und wie weit
// ueber den Kopf steigt sie bei der jeweiligen Figur? Das ist die Zahl, an der die
// Textkarte in zeichneHeben() vorbeikommen muss — sie steht an FESTER Hoehe, die Stange
// haengt dagegen am Z der jeweiligen Figur.
// ---------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------
// KOERPER-MITTELACHSE je Blickrichtung. Eine Hantel wird ZWEIHAENDIG und symmetrisch
// gegriffen, ihre Mitte haengt deshalb an der Koerpermitte, nicht an einer einzelnen
// Faust — gemessen am BECKEN-/BEINBAND (unteres Drittel zwischen Huefte und Sohle), weil
// der ausgestreckte Stossarm der "shoot"-Pose die Silhouette weiter oben einseitig
// verzerrt und die Mitte dorthin verschoebe.
// ---------------------------------------------------------------------------------
await discSetzen("basketball");
await groesseSetzen(NAME, 5);
const mittelachse = {};
for (const dir of [0, 1, 2, 3]) {
  const px = await seite.evaluate(
    ([n, d, gr]) => window.__arena.renderProbe(n, "shoot", true, d, 0.1, gr),
    [NAME, dir, LEINWAND],
  ).then(pixel);
  const z = zeilen(px);
  const lm = landmarken(z);
  const band = z.filter((r) => r.n > 0 && r.y >= lm.huefte && r.y <= lm.sohle - 2);
  const links = Math.min(...band.map((r) => r.min)), rechts = Math.max(...band.map((r) => r.max));
  mittelachse[dir] = { links, rechts, mitte: (links + rechts) / 2, lm };
}
ausgabe.mittelachse = mittelachse;
console.log("\n=== KOERPER-MITTELACHSE (Becken/Beine, Johanna Groesse 5, Zeichenanker x=32) ===");
for (const dir of [0, 1, 2, 3]) {
  const m = mittelachse[dir];
  console.log(`  dir ${dir} (${["hinten", "links", "vorn", "rechts"][dir]}): Band y=${m.lm.huefte}..${m.lm.sohle - 2}, x ${m.links}..${m.rechts}, Mitte x=${m.mitte.toFixed(1)}`);
}

await kaderZurueck();
const KADER = [...KADER_ORIG.heim, ...KADER_ORIG.gast].map((x) => x.n);
// Zwei Disziplin-Wechsel INSGESAMT statt zwei je Figur: setDisc() ruft reset() und baut
// dahinter ein komplettes Spiel neu auf — 24 Wechsel dauerten laenger als der ganze Rest.
const census = [];
await discSetzen("basketball");
const ohneJeName = {};
for (const name of KADER) ohneJeName[name] = await pixel(await probe(name, true, null));
await discSetzen("gewichtheben");
for (const name of KADER) {
  const ohne = ohneJeName[name];
  const je = {};
  for (const ph of ["boden", "hoch"]) je[ph] = hantelKasten(await pixel(await probe(name, true, ph)), ohne);
  census.push({ name, lm: landmarken(zeilen(ohne)), je });
}
ausgabe.census = census;
console.log("\n=== KADER-ERHEBUNG (echte Groessen, Probe-Koordinaten, Fusspunkt y=46) ===");
for (const c of census) {
  const hatHantel = !!(c.je.boden || c.je.hoch);
  const scheitel = c.lm ? c.lm.scheitel : "?";
  const hochOben = c.je.hoch ? c.je.hoch.y0 : null;
  console.log(`  ${c.name.padEnd(22)} Scheitel y=${String(scheitel).padStart(3)} · ` +
    (hatHantel
      ? `Hantel JA · boden-Mitte ${c.je.boden ? c.je.boden.mitteY.toFixed(1) : "ausserhalb"} · hoch-Oberkante ${hochOben === null ? "ausserhalb der Leinwand (y<0)" : hochOben}`
      : "**KEINE HANTEL IN KEINER PHASE**"));
}

// Beweis-Rohbilder (nur Standardgroesse 5 und die zwei interessanten Phasen).
mkdirSync(ZIEL, { recursive: true });
await groesseSetzen(NAME, 5);
for (const ph of ["boden", "hoch"]) {
  const durl = await probe(NAME, true, ph);
  writeFileSync(join(ZIEL, `_heben_geometrie_${ph}.png`), Buffer.from(durl.replace(/^data:image\/png;base64,/, ""), "base64"));
}

await browser.close();
if (seitenfehler.length) console.log("Seitenfehler:", seitenfehler.slice(0, 10));

function bericht(titel, topf) {
  console.log("\n=== " + titel + " ===");
  for (const g of GROESSEN) {
    const e = topf[g]; if (!e) continue;
    const l = e.landmarken;
    if (!l) { console.log(`  groesse ${g}: KEINE Koerperpixel`); continue; }
    console.log(`  groesse ${String(g).padStart(2)} (Z_groesse=${e.groesseFaktor}, Z_gesamt~${e.zGesamtGeschaetzt}) — Koerper: Scheitel y=${l.scheitel}, Schulter y=${l.schulter}, Brustbein y=${l.brustbein}, Huefte y=${l.huefte}, Sohle y=${l.sohle}, Hoehe ${l.hoehe}px`);
    for (const ph of PHASEN) {
      const { gemessen: h, formelY } = e.hantel[ph];
      if (!h) { console.log(`      ${ph.padEnd(8)}: KEINE HANTEL IM BILD (Formel sagt y=${formelY})`); continue; }
      // Anteil der Koerperhoehe: 0 = Scheitel, 1 = Sohle. Das ist die Zahl, die ueber
      // verschiedene Modellgroessen konstant sein MUSS, wenn die Skalierung stimmt.
      const anteil = ((h.mitteY - l.scheitel) / l.hoehe).toFixed(3);
      console.log(`      ${ph.padEnd(8)}: Stangenmitte y=${h.mitteY.toFixed(1)} (Formel ${formelY}) · x ${h.x0}..${h.x1}, ${h.n}px · ${(h.mitteY - l.schulter).toFixed(1)}px unter Schulter, ${(l.sohle - h.mitteY).toFixed(1)}px ueber Sohle · Koerperanteil ${anteil}`);
    }
  }
}
bericht("Humanoid " + NAME, ausgabe.koerper);
bericht("Vollbild " + NAME_VOLL, ausgabe.vollbild);
writeFileSync(join(ZIEL, "_heben_geometrie.json"), JSON.stringify(ausgabe, null, 1));
console.log("\nRohdaten:", join(ZIEL, "_heben_geometrie.json"));

// ===================================================================================
// BEKOMMT JEDE FIGUR EINE HANTEL? (13.09.) — die Regressionsprobe zu Chris' Befund
// "dann hat nur einer eine hantel". Vor dem 13.09. bekamen 5 von 17 Figuren des
// Beispielkaders in KEINER Phase eine Hantel, weil der b.vollbild- und der
// b.reiherMech-Zweig in zeichneSprite() vor dem Hantel-Block zurueckkehren
// (docs/design/gewichtheben-hantel-recherche-13-09.md, Abschnitt 3).
//
// Wer kuenftig einen weiteren Zeichenpfad mit eigenem `return` einzieht (oder ein neues
// b.vollbild-Blatt registriert, das VOLLBILD_SCHLAEGER nicht kennt), soll das hier sehen,
// statt es im Screenshot zu entdecken.
//
// METHODE wie scripts/messe-heben-geometrie.mjs: Alpha-Differenz zweier renderProbe-
// Renderings, BEIDE mit feldspiel=true und in derselben "shoot"-Pose — einmal unter
// disc="gewichtheben" (Koerper + Hantel), einmal unter disc="basketball" (derselbe Koerper,
// keine Requisite). NICHT feldspiel=false als Gegenbild nehmen: dieser Parameter schaltet
// zusaetzlich die Bogen-/Feuerwaffen-Overlays um, die Differenz enthaelt dann den BOGEN.
//
// Aufruf: node scripts/pruefe-heben-hantel-vollzaehlig.mjs [zielordner-fuer-rohdaten]
// ===================================================================================
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = process.argv[2];
const L = 256, DIR = 3;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("ERR", String(e)));
await p.goto("file://" + join(REPO, "public/mockups/battle-mode.html"), { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const px = (durl) => p.evaluate(async ([d, gr]) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = d; });
  const c = document.createElement("canvas"); c.width = gr; c.height = gr;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  return Array.from(x.getImageData(0, 0, gr, gr).data);
}, [durl, L]);
// ANKER MITTIG STATT AUF (32,46): renderProbe zeichnete bis zum 13.09. immer auf (32,46),
// unabhaengig von der Leinwandgroesse — eine grosse Figur (Krag'Zul, Z~1,71, Sprite ab
// y-46*Z = -32) wurde dadurch OBEN abgeschnitten, und genau die Ueberkopfphase war damit
// nicht messbar: die Sonde meldete Scheitel 0 und Stangenmitte 0, beides nur die Bildkante.
const ANKER = { x: L / 2, y: (L * 46) / 64 };
const probe = (n, ph) => p.evaluate(([nn, d, gr, pp, ak]) => window.__arena.renderProbe(nn, "shoot", true, d, 0.1, gr, pp, ak), [n, DIR, L, ph, ANKER]);

// ZWEI LANDMARKEN-SAETZE, WEIL KEINER ALLEIN TRAEGT (13.09., zweite Runde).
//
// `roh*` ist die aeusserste Alpha-Zeile der ganzen Silhouette — das, was die erste Fassung
// nahm. Sie ist der ehrliche Bezug fuer "liegt die Stange im Boden": alles, was unter den
// Fuessen gezeichnet wird (Schatten, Partikel), liegt darunter, die Schranke ist also eher
// zu NACHSICHTIG als zu streng, und genau sie hat Tidesprinter/Seraph-11 ueberfuehrt.
//
// `scheitel`/`sohle` (Mindestbreite 6) versuchen zusaetzlich, Kopf und Fuss von Anbauten zu
// trennen: `krone:true` (King Arlen, Inefinna) zeichnet eine Krone ueber den Kopf,
// Krag'Zul streut Void-Partikel bis 34px unter die Fuesse.
//
// ES IST BEWUSST KEINE VON BEIDEN ALLEIN MASSGEBLICH. Nachgemessen schneidet die
// Mindestbreite bei Gram 8px HORN-UND-KOPF weg und bei Seraph-11 die duennen Reiher-Beine
// (Strichstaerke 1,6*s) — sie ist als Gegenprobe nuetzlich, als alleiniger Massstab aber
// genauso schief wie die rohe Silhouette. Die Zusagen unten sind deshalb an Chris' zwei
// woertliche Befunde geknuepft ("viel zu weit unten", "weit ueber den kopf geworfen") und
// nicht an eine Genauigkeit, die diese Messung gar nicht hergibt.
const MINDESTBREITE = 6;
const koerperSpanne = (bild) => {
  let scheitel = null, sohle = null, rohOben = null, rohUnten = null;
  for (let y = 0; y < L; y++) {
    let lauf = 0, breit = false, etwas = false;
    for (let x = 0; x <= L; x++) {
      const an = x < L && bild[(y * L + x) * 4 + 3] > 40;
      if (an) { lauf++; etwas = true; continue; }
      if (lauf >= MINDESTBREITE) breit = true;
      lauf = 0;
    }
    if (etwas) { if (rohOben === null) rohOben = y; rohUnten = y; }
    if (breit) { if (scheitel === null) scheitel = y; sohle = y; }
  }
  return { scheitel, sohle, rohOben, rohUnten };
};

const namen = await p.evaluate(() => [...window.__arena.kader(), ...window.__arena.opp()].map((x) => x.n));
await p.evaluate(() => window.__arena.setDisc("basketball"));
const ohne = {}, koerper = {};
for (const n of namen) {
  ohne[n] = await px(await probe(n, null));
  koerper[n] = koerperSpanne(ohne[n]);
}
await p.evaluate(() => window.__arena.setDisc("gewichtheben"));
// NUR WAAGERECHTE LAEUFE AB MINDESTLAENGE (13.09., zweite Runde). Die erste Fassung nahm
// JEDEN Pixel, der sich zwischen den zwei Renderings unterscheidet — und traf damit nicht
// nur die Hantel. Partikeleffekte (b.effekt, zeichnePartikelEffekt) haengen an der
// Simulationszeit `t`, laufen zwischen den zwei Aufnahmen also weiter und stehen vollstaendig
// in der Differenz. Gemessen verschob das Inefinnas Ruhestange scheinbar auf halbe
// Rumpfhoehe (ihr "heilig"-Kopfeffekt, streuung 9, sitzt UEBER dem Kopf und zog den
// Messkasten nach oben) und erzeugte bei Krag'Zul die zwei Void-Partikel, die schon im
// Beweisbild der ersten Runde auffielen.
//
// Die Hantel ist das einzige Ding in der Differenz, das eine LANGE WAAGERECHTE ist: im Profil
// 68 Zellen Stange, in Front/Ruecken noch 36. Ein Partikel ist ein paar Pixel gross. Ein
// Mindestlauf von 12 zusammenhaengenden Pixeln je Zeile trennt beides sauber und ohne
// Figurenwissen.
const MINDESTLAUF = 12;
const kasten = (mit, o) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < L; y++) {
    let lauf = 0, laufStart = 0;
    for (let x = 0; x <= L; x++) {
      const i = (y * L + x) * 4;
      const an = x < L && mit[i + 3] > 40 && !(o[i + 3] > 40);
      if (an) { if (lauf === 0) laufStart = x; lauf++; continue; }
      if (lauf >= MINDESTLAUF) {
        n += lauf;
        if (laufStart < x0) x0 = laufStart;
        if (x - 1 > x1) x1 = x - 1;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      lauf = 0;
    }
  }
  return n ? { x0, y0, x1, y1, n, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 } : null;
};
const out = [];
for (const n of namen) {
  const kb = kasten(await px(await probe(n, "boden")), ohne[n]);
  const kh = kasten(await px(await probe(n, "hoch")), ohne[n]);
  const k = koerper[n];
  out.push({ n, ...k, boden: kb, hoch: kh });
  const sichtbar = kb || kh ? "JA " : "NEIN";
  // Positive Zahlen heissen hier "hoeher als die Landmarke" (Leinwand-y waechst nach unten).
  const ueberSohle = kb ? (k.rohUnten - kb.my).toFixed(1) : "—";
  const ueberScheitel = kh ? (k.rohOben - kh.my).toFixed(1) : "—";
  const mittig = kb ? (kb.mx - ANKER.x).toFixed(1) : "—";
  // Kopf/Fuss (Mindestbreite) zuerst, die rohe Silhouette in Klammern — wo beide
  // auseinanderlaufen, traegt die Figur eine Krone/Hoerner oder streut Partikel.
  const kern = (k.rohOben !== k.scheitel || k.rohUnten !== k.sohle) ? ` [Rumpf ${k.scheitel}..${k.sohle}]` : "";
  console.log(`${n.padEnd(22)} Hantel ${sichtbar} · Koerper y ${k.rohOben}..${k.rohUnten}${kern} · boden-Mitte ${kb ? kb.my.toFixed(1) : "—"} (${ueberSohle} ueber Sohle, x-Versatz ${mittig}) · hoch-Mitte ${kh ? kh.my.toFixed(1) : "ausserhalb"} (${ueberScheitel} ueber Scheitel)`);
}
if (ZIEL) writeFileSync(join(ZIEL, "_hantel-gegenprobe.json"), JSON.stringify(out, null, 1));
await b.close();

// ===================================================================================
// DREI ZUSAGEN, NICHT EINE (13.09., zweite Runde — Review-Fund zu dieser PR).
//
// Die erste Fassung prueft nur "wird ueberhaupt eine Hantel gezeichnet?" — und meldete
// deshalb "Alle 17 Figuren zeichnen eine Hantel", waehrend ihre EIGENE Zeilenausgabe
// direkt darueber zeigte, dass die Stange bei Tidesprinter und Seraph-11 im BODEN lag
// (1,5 bzw. 2,0 Zellen unter der Sohle) und bei Tidesprinter in der Ueberkopfphase
// 0,41 KOERPERHOEHEN ueber dem Scheitel schwebte. Ein gruener Haken ueber einer Ausgabe,
// die den Fehler im Klartext enthaelt, ist schlimmer als gar keine Pruefung — er laedt
// dazu ein, "behoben" zu schreiben, und laesst denselben Befund spaeter neu melden.
//
// DIE ZUSAGEN SIND AN CHRIS' ZWEI WOERTLICHE BEFUNDE GEKNUEPFT, nicht an eine Genauigkeit,
// die diese Messung nicht hergibt (s. den Landmarken-Kommentar oben):
//   1. eine Hantel ueberhaupt,
//   2. "die ist viel zu weit unten"  -> Ruhestange nicht UNTER der Silhouette (im Boden),
//   3. "weit ueber den kopf geworfen" -> Ueberkopfstange hoechstens ein Viertel Koerperhoehe
//      ueber dem Scheitel. Der alte Zustand lag bei Tidesprinter bei 0,41 und bei Seraph-11
//      bei 0,26, der neue bei 0,15 — die Schranke trennt beides sauber.
//
// NUR HINWEIS, KEIN FEHLER: eine Ueberkopfstange leicht UNTER dem obersten Pixel. Wer eine
// Krone, Hoerner oder einen Heiligenschein traegt, hat oberhalb des Kopfes noch Silhouette;
// King Arlen steht auf exakt derselben Stangenhoehe wie Johanna (gleicher Koerper, gleiche
// groesse, beide 141,5) und faellt hier trotzdem auf, WEIL seine Krone 13px hoeher reicht.
// Daraus einen harten Fehler zu machen hiesse, eine Messung zu behaupten, die es nicht gibt.
// ===================================================================================
const SPIEL = 0.5;
const UEBERKOPF_MAX = 0.25;
const fehler = [], hinweise = [];
for (const r of out) {
  if (!r.boden && !r.hoch) { fehler.push(`${r.n}: gar keine Hantel`); continue; }
  // Geklippte Messungen (Figur an der Bildkante) sind keine Aussage — lieber melden als
  // stillschweigend bestehen lassen.
  if (r.rohOben <= 0 || r.rohUnten >= L - 1) { fehler.push(`${r.n}: Figur an der Leinwandkante abgeschnitten, Messung ungueltig`); continue; }
  const hoehe = r.rohUnten - r.rohOben;
  if (r.boden && r.boden.my > r.rohUnten + SPIEL)
    fehler.push(`${r.n}: Ruhestange ${(r.boden.my - r.rohUnten).toFixed(1)} Zellen UNTER der Sohle (im Boden)`);
  if (r.hoch) {
    const anteil = (r.rohOben - r.hoch.my) / hoehe;
    if (anteil > UEBERKOPF_MAX)
      fehler.push(`${r.n}: Ueberkopfstange ${anteil.toFixed(2)} Koerperhoehen ueber dem Scheitel (ueber den Kopf geworfen, erlaubt bis ${UEBERKOPF_MAX})`);
    else if (anteil < 0)
      hinweise.push(`${r.n}: Ueberkopfstange ${(-anteil * hoehe).toFixed(1)}px unter dem obersten Pixel — Krone/Hoerner/Aura reichen ueber den Kopf, Stangenhoehe selbst unauffaellig`);
  }
}
if (hinweise.length) {
  console.log(`\nHINWEISE (kein Fehler, ${hinweise.length}):`);
  for (const h of hinweise) console.log("  - " + h);
}
if (fehler.length) {
  console.log(`\nFEHLER (${fehler.length}):`);
  for (const f of fehler) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log(`\nAlle ${out.length} Figuren: Hantel vorhanden, Ruhestange auf/ueber der Sohle, Ueberkopfstange hoechstens ${UEBERKOPF_MAX} Koerperhoehen ueber dem Scheitel.`);
}

// BASKETBALL: BETEILIGUNG JE SPIELER (Maru-Fall, Arbeitsliste 21.11. Welle 4, docs/design/basketball-puste-22-11.md).
//
// Misst, wie die Ballaktionen eines Spiels auf die Spieler verteilt sind und wie oft ein Feldspieler "fast null"
// Beteiligung hat. Dieselbe Sonde (`disziplinProbe`) und dieselbe Kader-Familie wie die Rangtreue-Abnahme, ueber den
// Node-Motor (kein Chromium).
//
//   OLY_FORM_MODUS=echt node scripts/miss-basketball-beteiligung.mjs [spiele=24] [jeSeite=4,6] [--puste=alt|neu]
//
// Aktionen = Wuerfe + Assists + Rebounds + Steals + Bloecke + Ballverluste (alles, was der Boxscore je Spieler fuehrt).
// "Geist" = hoechstens 3 Aktionen in einem Spiel (Mittel je Spieler liegt bei rund 20); "Schweiger" = hoechstens 1 Wurf.
// Mit --puste=alt|neu wird der Messhebel `basketballPuste` des Motors gesetzt (Rueckweg-Vergleich).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeKaderFamilieAusDatei, median } from "./lib/rangtreue-messung.mjs";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const rest = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(rest[0] || 24);
const JE_SEITE = String(rest[1] || "4,6").split(",").map(Number);
const PUSTE_ROH = flag("puste");
const PUSTE = PUSTE_ROH && PUSTE_ROH.startsWith("{") ? JSON.parse(PUSTE_ROH) : PUSTE_ROH;

const kader = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
const seite = await oeffneNodeSeite(path.join(WURZEL, "public/mockups"));
if (process.env.OLY_FORM_MODUS) await seite.evaluate((m) => window.__arena.formModusMessung(m), process.env.OLY_FORM_MODUS);
if (PUSTE) await seite.evaluate((p) => window.__arena.basketballPuste(p), PUSTE);

const rho = (a, b) => {
  const r = (v) => { const i = v.map((w, k) => [w, k]).sort((x, y) => x[0] - y[0]); const o = new Array(v.length); let k = 0; while (k < i.length) { let j = k; while (j + 1 < i.length && i[j + 1][0] === i[k][0]) j++; for (let m = k; m <= j; m++) o[i[m][1]] = (k + j) / 2; k = j + 1; } return o; };
  const x = r(a), y = r(b), n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sx = 0, sy = 0, sxy = 0; for (let i = 0; i < n; i++) { sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  return sx && sy ? sxy / Math.sqrt(sx * sy) : null;
};

for (const js of JE_SEITE) {
  const x = await seite.evaluate(([n, fam, j]) => window.__arena.disziplinProbe("basketball", { n, kaderFamilie: fam, jeSeite: j, beteiligungDiag: true }), [SPIELE, kader.familie, js]);
  const zeilen = [];
  for (const v of x.varianten) for (const s of v.spiele) {
    const eigRang = [...s.teilnehmer].sort((a, b) => b.eig - a.eig).map((p) => p.n);
    for (const q of s.teilnehmer) {
      const p = q.bet;
      const akt = p.fga + p.assists + p.rebounds + p.steals + p.bloecke + p.verluste;
      zeilen.push({ akt, fga: p.fga, pkt: p.punkte, eigRang: eigRang.indexOf(q.n) + 1, eig: q.eig, spieler: s.teilnehmer.length, pusteMin: p.pusteMin, pusteMax: p.pusteMax, weg: p.weg, wert: q.wert });
    }
  }
  const n = zeilen.length;
  const anteil = (f) => (zeilen.filter(f).length / n * 100).toFixed(1) + " %";
  const letzter = zeilen.filter((z) => z.eigRang === z.spieler / 2);
  const schwach = zeilen.filter((z) => z.eigRang > z.spieler / 2);
  const mAkt = zeilen.reduce((s, z) => s + z.akt, 0) / n;
  console.log(`\njeSeite ${js}: ${n} Spielerzeilen aus ${x.varianten.length} Varianten x ${SPIELE} Spiele${PUSTE_ROH ? "  puste=" + PUSTE_ROH : ""}`);
  console.log(`  Aktionen je Spieler: Mittel ${mAkt.toFixed(1)}, Median ${median(zeilen.map((z) => z.akt))}`);
  console.log(`  Geist (<=3 Aktionen): ${anteil((z) => z.akt <= 3)}   (<=5: ${anteil((z) => z.akt <= 5)})   Schweiger (<=1 Wurf): ${anteil((z) => z.fga <= 1)}   (0 Wuerfe: ${anteil((z) => z.fga === 0)})`);
  console.log(`  untere Eignungshaelfte: Geist ${(schwach.filter((z) => z.akt <= 3).length / schwach.length * 100).toFixed(1)} %, Mittel ${(schwach.reduce((s, z) => s + z.akt, 0) / schwach.length).toFixed(1)} Aktionen`);
  const letzte = zeilen.filter((z) => z.eigRang === z.spieler);
  console.log(`  schwaechster Spieler je Seite-Spiel unter allen: Geist ${(letzte.filter((z) => z.akt <= 3).length / Math.max(1, letzte.length) * 100).toFixed(1)} %, Mittel ${(letzte.reduce((s, z) => s + z.akt, 0) / Math.max(1, letzte.length)).toFixed(1)}`);
  console.log(`  Korrelation Eignung zu Aktionen (Spearman): ${rho(zeilen.map((z) => z.eig), zeilen.map((z) => z.akt)).toFixed(3)}   Eignung zu Wuerfen: ${rho(zeilen.map((z) => z.eig), zeilen.map((z) => z.fga)).toFixed(3)}`);
  const spitze = zeilen.filter((z) => z.eigRang === 1);
  console.log(`  Stern (Eignungsrang 1 im Spiel): Mittel ${(spitze.reduce((s, z) => s + z.akt, 0) / spitze.length).toFixed(1)} Aktionen, ${(spitze.reduce((s, z) => s + z.fga, 0) / spitze.length).toFixed(1)} Wuerfe`);
  const pm = zeilen.filter((z) => z.pusteMax > 0);
  if (pm.length) {
    const nach = (f) => pm.filter(f);
    const m = (l) => (l.reduce((s, z) => s + z.pusteMin / z.pusteMax, 0) / Math.max(1, l.length) * 100).toFixed(0) + " %";
    console.log(`  tiefster Puste-Stand: Stern ${m(nach((z) => z.eigRang === 1))}, Rang 2-3 ${m(nach((z) => z.eigRang > 1 && z.eigRang <= 3))}, untere Haelfte ${m(nach((z) => z.eigRang > z.spieler / 2))}, schwaechster ${m(nach((z) => z.eigRang === z.spieler))}`);
    console.log(`  Korrelation Puste-Tief zu Aktionen: ${rho(pm.map((z) => z.pusteMin / z.pusteMax), pm.map((z) => z.akt)).toFixed(3)}, zu Vorrat: ${rho(pm.map((z) => z.pusteMin / z.pusteMax), pm.map((z) => z.pusteMax)).toFixed(3)}`);
  }
  if (pm.length) console.log(`  Weg je Spieler und Spiel: Mittel ${Math.round(pm.reduce((s, z) => s + z.weg, 0) / pm.length)} px (Stern ${Math.round(pm.filter((z) => z.eigRang === 1).reduce((s, z) => s + z.weg, 0) / Math.max(1, pm.filter((z) => z.eigRang === 1).length))}); Vorrat Mittel ${Math.round(pm.reduce((s, z) => s + z.pusteMax, 0) / pm.length)}`);
  if (pm.length) console.log(`  Puste: tiefster Stand im Mittel ${(pm.reduce((s, z) => s + z.pusteMin / z.pusteMax, 0) / pm.length * 100).toFixed(0)} % des Vorrats; Spieler unter 30 %: ${(pm.filter((z) => z.pusteMin / z.pusteMax < 0.3).length / pm.length * 100).toFixed(1)} %`);
}
seite.schliessen();

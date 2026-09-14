// ===================================================================================
// SONDE: Hindernis-Koennen gegen Streckentempo in Takeshi's Castle (13.09.2026)
//
// Zu docs/design/takeshi-hindernis-vs-strecke-recherche-13-09.md. Beantwortet drei
// Fragen, die `miss-alle-disziplinen.mjs` nicht beantworten kann, weil es nur rho
// zurueckgibt:
//
//   1. FALLEN-AUSGANG NACH KOENNEN. Wie verschieden sind sauber/durchbruch/sturz
//      zwischen einem Laeufer mit starkem und einem mit schwachem Fallen-Koennen —
//      heute, in echten Rennen, nicht in der Formel gerechnet?
//   2. FUEHRUNGSDOMINANZ. Wie oft gewinnt der eignungsbeste Laeufer? Wie oft gewinnt,
//      wer nach dem ersten Drittel fuehrt? Wie viele Fuehrungswechsel hat ein Rennen?
//   3. ZWEI ACHSEN. Laesst sich ein Laeufer ueberhaupt als "stark an der Falle,
//      mittel auf der Strecke" (oder umgekehrt) beschreiben — und wenn ja, sieht man
//      das im Rennverlauf (Positionsgewinn AN den Fallen gegen Positionsgewinn
//      ZWISCHEN ihnen)?
//
// Sie braucht einen MESS-HAKEN, der NICHT im Produktionscode steht: `takeshiSonde`
// und `bahnArtSetzen` auf `window.__arena`. Die Sonde legt sich dafuer selbst eine
// gepatchte Kopie von public/mockups an (--kopie), misst dagegen und laesst den
// Arbeitsbaum unberuehrt. Die rho-Abnahme selbst laeuft unveraendert ueber
// scripts/miss-alle-disziplinen.mjs gegen den echten Code.
//
//   node docs/design/takeshi-hindernis-strecke-sonde-13-09.mjs [rennen]
//   SAAT0=4242 node docs/design/takeshi-hindernis-strecke-sonde-13-09.mjs 24
//   FELDER='{"streckeSpanne":0.9}' node docs/design/takeshi-hindernis-strecke-sonde-13-09.mjs 24
// ===================================================================================
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const N = Number(process.argv[2] || 24);
const SAAT0 = Number(process.env.SAAT0 || 1337);
const FELDER = process.env.FELDER ? JSON.parse(process.env.FELDER) : null;

// --- die Mess-Haken, in eine KOPIE der Engine gespritzt -----------------------------
const HAKEN = `
    bahnArtSetzen:(bd,felder)=>{ const A=BAHN_ART[bd]; if(!A)return null;
      for(const k in felder){ if(felder[k]===null)delete A[k]; else A[k]=felder[k]; }
      return Object.keys(felder); },
    takeshiSonde:(opt)=>{
      const o=opt||{}, bd=o.disziplin||"takeshis-castle";
      const M=MOTOREN[bd]; if(!M)return {fehler:"kein Motor"};
      const n=o.n||24, saat0=o.saat0!=null?o.saat0:1337, schritt=o.schritt||7919;
      const familie=Array.isArray(o.kaderFamilie)&&o.kaderFamilie.length?o.kaderFamilie:null;
      const gesichert=M.sichern(); if(M.vorher)M.vorher();
      const art=BAHN_ART[bd]; const altJeSeite=art.jeSeite; if(o.jeSeite)art.jeSeite=o.jeSeite;
      const kaderVorher={SQUAD,OPP};
      const SUB=["ANTRITT","ENDTEMPO","TECHNIK","WENDIGKEIT","STEHEN","WUCHT","ROBUST"];
      const einDurchlauf=()=>{
        const rennen=[];
        for(let i=0;i<n;i++){
          zieheFormkarten(20260823+i*104729);
          M.bau(saat0+i*schritt);
          // Positionsspur. Wer im Ziel ist, bekommt 1 + (90 - Zielzeit)/1e4 — damit steht
          // der frueher Angekommene VOR dem spaeter Angekommenen, statt mit ihm auf 1 zu
          // kleben (sonst gewinnt beim Gleichstand stumpf der kleinere Index).
          const spur=[]; let g=0, naechste=0;
          while(!done&&g<90){
            stepSpurt(1/60); g+=1/60;
            if(g>=naechste){ naechste+=0.5;
              spur.push(LAEUFER.map(u=>u.fertig!=null?1+(90-u.fertig)/1e4:u.pos)); }
          }
          const w=M.wert();
          rennen.push({saat:saat0+i*schritt, spur, huerden:HUERDEN_N().slice(),
            laeufer:LAEUFER.map((u,idx)=>({
              idx, n:u.n, seite:u.seite, eig:Math.round(u.eig*100)/100,
              wert:Math.round((w[u.n]||0)*100)/100,
              fertig:u.fertig, raus:!!u.raus, pos:u.pos,
              sub:Object.fromEntries(SUB.map(k=>[k,u[k]])),
              sauber:(u.fallen||[]).filter(f=>f.aus==="sauber").length,
              durchbruch:(u.fallen||[]).filter(f=>f.aus==="durchbruch").length,
              sturz:(u.fallen||[]).filter(f=>f.aus==="sturz").length,
              fallenN:(u.fallen||[]).length,
              stoppSumme:Math.round((u.fallen||[]).reduce((s,f)=>s+f.stoppAnteil,0)*1000)/1000,
              fallen:(u.fallen||[]).map(f=>({t:f.typ,s:f.skill,a:f.aus})),
              gedraengeZeit:Math.round((u.gedraengeZeit||0)*1000)/1000,
              tackles:u.tackles, getackelt:u.getackelt, ausgewichen:u.ausgewichen,
              gestolpert:u.gestolpert
            }))});
        }
        return rennen;
      };
      let erg;
      try{
        if(familie){ erg=familie.map(v=>{
          if(v&&Array.isArray(v.heim)&&v.heim.length)SQUAD=mitKit(v.heim);
          if(v&&Array.isArray(v.gast)&&v.gast.length)OPP=mitKit(v.gast);
          return {label:(v&&v.label)||null, rennen:einDurchlauf()}; }); }
        else erg=[{label:null, rennen:einDurchlauf()}];
      } finally { M.zurueck(gesichert); zieheFormkarten(20260823);
        if(o.jeSeite)art.jeSeite=altJeSeite;
        if(familie){SQUAD=kaderVorher.SQUAD;OPP=kaderVorher.OPP;} }
      return {disziplin:bd, varianten:erg};
    },
`;

const kopie = mkdtempSync(path.join(tmpdir(), "takeshi-sonde-"));
cpSync(path.join(WURZEL, "public/mockups"), path.join(kopie, "mockups"), { recursive: true });
const enginePfad = path.join(kopie, "mockups/battle-mode.engine.js");
{
  const marker = "    motoren:()=>Object.keys(MOTOREN),";
  const src = readFileSync(enginePfad, "utf8");
  if (src.split(marker).length !== 2) throw new Error("Marker fuer den Mess-Haken nicht eindeutig");
  writeFileSync(enginePfad, src.replace(marker, HAKEN + marker));
}

const famPfad = path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
if (!existsSync(famPfad)) throw new Error("kaderfamilie-live-save.json fehlt — erst scripts/ziehe-kader-familie.ts");
const roh = JSON.parse(readFileSync(famPfad, "utf8"));
const familie = roh.varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast }));

const browser = await chromium.launch({ executablePath: fest });
const seite = await browser.newPage();
seite.on("pageerror", (e) => console.error("SEITENFEHLER", e.message));
// Die Seite zieht Google-Fonts per <link>, und in der Agenten-Umgebung haengt der Abruf
// am Proxy — das liess `goto` reihenweise ins Timeout laufen, obwohl die Engine laengst
// da war. Beide Hosts hart abbrechen, dazu `domcontentloaded` statt `load`;
// `waitForFunction` unten ist die echte Schranke.
await seite.route("https://fonts.googleapis.com/**", (r) => r.abort());
await seite.route("https://fonts.gstatic.com/**", (r) => r.abort());
// Grosszuegige Fristen: auf einer Maschine, auf der mehrere Messreihen gleichzeitig
// laufen (Lastmittel > 30 gemessen), braucht allein das Auswerten der 24k-Zeilen-Engine
// laenger als Playwrights 30-Sekunden-Standard — und ein Timeout hier sieht aus wie ein
// Messfehler, ist aber nur Warten.
await seite.goto(pathToFileURL(path.join(kopie, "mockups/battle-mode.html")).href,
  { waitUntil: "domcontentloaded", timeout: 180000 });
await seite.waitForFunction(() => !!window.__arena && !!window.__arena.takeshiSonde, null, { timeout: 180000 });
if (FELDER) {
  const k = await seite.evaluate((f) => window.__arena.bahnArtSetzen("takeshis-castle", f), FELDER);
  console.error("Felder gesetzt:", k.join(", "));
}
const erg = await seite.evaluate(
  ([n, saat0, fam]) => window.__arena.takeshiSonde({ n, saat0, kaderFamilie: fam }),
  [N, SAAT0, familie],
);
await browser.close();
// Die Kopie ist 5,5 MB; eine Variantenfahrt legt ein Dutzend davon an. Wegraeumen, sonst
// laeuft /tmp bei einer laengeren Messreihe voll (nachgemessen am 13.09.: 24 Kopien).
rmSync(kopie, { recursive: true, force: true });

// ===================== Auswertung =====================
const alleLaeufer = [];
for (const v of erg.varianten) for (const r of v.rennen) for (const u of r.laeufer) alleLaeufer.push(u);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const mit = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
const korr = (xs, ys) => {
  const mx = mit(xs), my = mit(ys);
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < xs.length; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sx += a * a; sy += b * b; }
  return sxy / Math.sqrt(sx * sy || 1);
};

console.log(`\n=== TAKESHI-SONDE, ${N} Rennen x ${erg.varianten.length} Paarungen, Saat0 ${SAAT0}${FELDER ? ", Felder " + JSON.stringify(FELDER) : ""} ===`);
console.log(`Laeufereintraege gesamt: ${alleLaeufer.length}`);

// --- 0. RHO, mit derselben Rechnung wie scripts/lib/rangtreue-messung.mjs ------------
// (Bindungen mitteln die Raenge, dann Pearson auf den Raengen = Spearman.) Die ZAHL DER
// ABNAHME kommt weiter aus scripts/miss-alle-disziplinen.mjs gegen den echten Code —
// hier steht sie nur, damit eine Variante nicht erst nach einem zweiten Lauf beurteilt
// werden kann. Beide Rechnungen wurden gegeneinander geprueft (s. Recherche Abschnitt 5).
const rho = (tn) => {
  const n = tn.length; if (n < 3) return NaN;
  const rang = (feld) => {
    const idx = tn.map((t, i) => i).sort((a, b) => tn[a][feld] - tn[b][feld]);
    const r = new Array(n);
    for (let i = 0; i < n;) {
      let j = i; while (j + 1 < n && tn[idx[j + 1]][feld] === tn[idx[i]][feld]) j++;
      const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = m; i = j + 1;
    }
    return r;
  };
  const a = rang("eig"), b = rang("wert");
  const ma = mit(a), mb = mit(b);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sab / Math.sqrt(sa * sb || 1);
};
{
  const jeVariante = erg.varianten.map((v) => {
    const spiel = mit(v.rennen.map((r) => rho(r.laeufer)).filter((x) => !Number.isNaN(x)));
    const agg = new Map();
    for (const r of v.rennen) for (const u of r.laeufer) {
      const a = agg.get(u.n) || { n: u.n, eig: 0, wert: 0, k: 0 };
      a.eig += u.eig; a.wert += u.wert; a.k++; agg.set(u.n, a);
    }
    const saison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
    return { label: v.label, spiel, saison };
  });
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const sp = jeVariante.map((v) => v.spiel), sa = jeVariante.map((v) => v.saison);
  console.log("\n--- 0. RANGTREUE (kaderfest, Median ueber die Paarungen) ---");
  console.log(`rho je Spiel  ${med(sp).toFixed(3)}  (Spannweite ${(Math.max(...sp) - Math.min(...sp)).toFixed(3)})`);
  console.log(`rho Saison    ${med(sa).toFixed(3)}  (Spannweite ${(Math.max(...sa) - Math.min(...sa)).toFixed(3)})`);
  console.log("  je Paarung: " + jeVariante.map((v) => `${v.label}=${v.spiel.toFixed(3)}`).join("  "));
}

// --- 1. Fallen-Ausgang nach Koennen -------------------------------------------------
console.log("\n--- 1. FALLEN-AUSGANG NACH FALLEN-KOENNEN (TECHNIK) ---");
const tSort = [...alleLaeufer].sort((a, b) => a.sub.TECHNIK - b.sub.TECHNIK);
const fuenftel = Math.floor(tSort.length / 5);
const gruppen = [["unterstes Fuenftel", tSort.slice(0, fuenftel)], ["2.", tSort.slice(fuenftel, 2 * fuenftel)],
  ["3.", tSort.slice(2 * fuenftel, 3 * fuenftel)], ["4.", tSort.slice(3 * fuenftel, 4 * fuenftel)],
  ["oberstes Fuenftel", tSort.slice(4 * fuenftel)]];
console.log("Gruppe                 TECHNIK  WUCHT   sauber%  durchbr%  sturz%   Stopp(s)  Stuerze");
for (const [name, g] of gruppen) {
  const n = mit(g.map((u) => u.fallenN));
  console.log(`${name.padEnd(20)} ${mit(g.map((u) => u.sub.TECHNIK)).toFixed(1).padStart(7)} ${mit(g.map((u) => u.sub.WUCHT)).toFixed(1).padStart(6)} ` +
    `${(100 * mit(g.map((u) => u.sauber)) / n).toFixed(1).padStart(8)} ${(100 * mit(g.map((u) => u.durchbruch)) / n).toFixed(1).padStart(9)} ` +
    `${(100 * mit(g.map((u) => u.sturz)) / n).toFixed(1).padStart(7)} ${mit(g.map((u) => u.stoppSumme)).toFixed(2).padStart(9)} ${mit(g.map((u) => u.gestolpert)).toFixed(2).padStart(8)}`);
}
console.log(`Spannweite TECHNIK im Kader: min ${q(alleLaeufer.map((u) => u.sub.TECHNIK), 0)} q25 ${q(alleLaeufer.map((u) => u.sub.TECHNIK), .25)} med ${q(alleLaeufer.map((u) => u.sub.TECHNIK), .5)} q75 ${q(alleLaeufer.map((u) => u.sub.TECHNIK), .75)} max ${q(alleLaeufer.map((u) => u.sub.TECHNIK), 1)}`);

// --- 1b. DIE ENTSCHEIDENDE FRAGE: unterscheidet sich der Ausgang JE FALLENTYP? -------
// Chris will sehen, dass EINER EINE Falle meistert, wo ein anderer hinfaellt — nicht,
// dass der Techniker ueberall etwas oefter durchkommt. Der Test dafuer ist der Vergleich
// DESSELBEN Laeufers an SEINER starken und SEINER schwachen Falle.
console.log("\n--- 1b. DERSELBE LAEUFER AN SEINER STARKEN UND SEINER SCHWACHEN FALLE ---");
{
  const proAnlauf = [];
  for (const u of alleLaeufer) for (const f of (u.fallen || [])) proAnlauf.push({ u, ...f });
  // (a) gebucketet nach dem Koennen, das ZU DIESER FALLE gehoert
  const sSort = [...proAnlauf].sort((a, b) => a.s - b.s);
  const d = Math.floor(sSort.length / 5);
  console.log("Anlaeufe gebucketet nach dem Sub-Skill DIESER Falle:");
  console.log("Fuenftel   Skill   sauber%  durchbr%  sturz%");
  for (let i = 0; i < 5; i++) {
    const g = sSort.slice(i * d, i === 4 ? sSort.length : (i + 1) * d);
    const c = (a) => 100 * g.filter((x) => x.a === a).length / g.length;
    console.log(`  ${i + 1}.     ${mit(g.map((x) => x.s)).toFixed(1).padStart(6)} ${c("sauber").toFixed(1).padStart(9)} ${c("durchbruch").toFixed(1).padStart(9)} ${c("sturz").toFixed(1).padStart(8)}`);
  }
  // (b) INNERHALB eines Laeufers: sein bester gegen seinen schwaechsten Fallentyp
  const TYPEN = ["TECHNIK", "WENDIGKEIT", "WUCHT", "STEHEN", "ROBUST"];
  let sbStark = 0, nStark = 0, sbSchwach = 0, nSchwach = 0, spannen = [];
  for (const u of alleLaeufer) {
    // NUR Laeufer, die alle vierzehn Stationen gesehen haben. Wer ausscheidet, bricht
    // MITTEN in der festen Kursfolge ab — seine Typ-Mischung ist dann nicht mehr die des
    // Kurses, und der Vergleich "stark gegen schwach" misst die Kursreihenfolge mit.
    if (!u.fallen || u.fallen.length < 14) continue;
    const vorh = TYPEN.filter((t) => u.fallen.some((f) => f.t === t));
    if (vorh.length < 2) continue;
    const stark = vorh.reduce((a, b) => (u.sub[a] >= u.sub[b] ? a : b));
    const schwach = vorh.reduce((a, b) => (u.sub[a] <= u.sub[b] ? a : b));
    const fs = u.fallen.filter((f) => f.t === stark), fw = u.fallen.filter((f) => f.t === schwach);
    sbStark += fs.filter((f) => f.a === "sauber").length; nStark += fs.length;
    sbSchwach += fw.filter((f) => f.a === "sauber").length; nSchwach += fw.length;
    spannen.push(u.sub[stark] - u.sub[schwach]);
  }
  console.log(`Sauber-Quote an SEINEM staerksten Fallentyp:  ${(100 * sbStark / nStark).toFixed(1)} %`);
  console.log(`Sauber-Quote an SEINEM schwaechsten Fallentyp: ${(100 * sbSchwach / nSchwach).toFixed(1)} %`);
  console.log(`UNTERSCHIED (das ist die Zahl, die Chris sehen will): ${(100 * sbStark / nStark - 100 * sbSchwach / nSchwach).toFixed(1)} Prozentpunkte`);
  console.log(`(Skill-Abstand stark-zu-schwach im Mittel ${mit(spannen).toFixed(1)} Punkte)`);
}

// --- 2. Die zwei Achsen im Kader ----------------------------------------------------
console.log("\n--- 2. ZWEI ACHSEN: wie weit driften Fallen-Koennen und Streckentempo auseinander? ---");
// Streckenachse: die Groesse, die tempoVon() liest (ANTRITT/ENDTEMPO-Mix);
// Fallenachse: was ueber sauber/durchbruch und Stoppzeit entscheidet.
const strecke = (u) => 0.5 * u.sub.ANTRITT + 0.5 * u.sub.ENDTEMPO;
const falle = (u) => 0.5 * u.sub.TECHNIK + 0.5 * u.sub.WUCHT;
const diff = alleLaeufer.map((u) => falle(u) - strecke(u));
console.log(`Falle-minus-Strecke: min ${Math.min(...diff).toFixed(1)}  q25 ${q(diff, .25).toFixed(1)}  med ${q(diff, .5).toFixed(1)}  q75 ${q(diff, .75).toFixed(1)}  max ${Math.max(...diff).toFixed(1)}`);
console.log(`Standardabweichung der Differenz: ${Math.sqrt(mit(diff.map((d) => (d - mit(diff)) ** 2))).toFixed(2)} Punkte`);
console.log(`r(Strecke, Falle) = ${korr(alleLaeufer.map(strecke), alleLaeufer.map(falle)).toFixed(3)}   (1,0 = eine Achse, 0 = zwei unabhaengige)`);
for (const k of ["ANTRITT", "ENDTEMPO", "TECHNIK", "WENDIGKEIT", "STEHEN", "WUCHT", "ROBUST"]) {
  console.log(`  r(eig, ${k.padEnd(10)}) = ${korr(alleLaeufer.map((u) => u.eig), alleLaeufer.map((u) => u.sub[k])).toFixed(3)}` +
    `   Spannweite ${q(alleLaeufer.map((u) => u.sub[k]), 0)}..${q(alleLaeufer.map((u) => u.sub[k]), 1)}`);
}

// --- 3. Fuehrungsdominanz -----------------------------------------------------------
console.log("\n--- 3. FUEHRUNGSDOMINANZ ---");
let rennenGes = 0, starGewinnt = 0, fruehFuehrerGewinnt = 0, wechselSumme = 0, haelfteFuehrerGewinnt = 0;
let fuehrerAbDrittelKonstant = 0, aufholerAusMittelfeld = 0, aufholerN = 0;
let starZuerstImZiel = 0, fuehrerDrittelZuerstImZiel = 0, starInErstenZwei = 0;
let starFuehrtSchonNachDrittel = 0;
const platzVerschiebung = [], zeitVerschiebung = [];
for (const v of erg.varianten) for (const r of v.rennen) {
  rennenGes++;
  const L = r.laeufer;
  const rangNach = [...L].sort((a, b) => b.wert - a.wert).map((u) => u.n);
  const sieger = rangNach[0];
  const star = [...L].sort((a, b) => b.eig - a.eig)[0].n;
  if (star === sieger) starGewinnt++;
  if (rangNach.indexOf(star) <= 1) starInErstenZwei++;
  // Zieleinlauf (Zeit) neben der Burgpunkte-Wertung: Chris sieht auf der Bahn, wer
  // vorne LAEUFT, gewertet wird aber nach Burgpunkten. Beide Fragen getrennt zaehlen.
  const zeitRang = [...L].sort((a, b) => (a.fertig ?? 99) - (b.fertig ?? 99)).map((u) => u.n);
  if (zeitRang[0] === star) starZuerstImZiel++;
  // Fuehrer je Zeitpunkt aus der Positionsspur
  const fuehrerFolge = r.spur.map((snapshot) => {
    let besterIdx = 0;
    for (let i = 1; i < snapshot.length; i++) if (snapshot[i] > snapshot[besterIdx]) besterIdx = i;
    return L[besterIdx] ? L[besterIdx].n : null;
  });
  let wechsel = 0;
  for (let i = 1; i < fuehrerFolge.length; i++) if (fuehrerFolge[i] !== fuehrerFolge[i - 1]) wechsel++;
  wechselSumme += wechsel;
  const drittel = Math.floor(fuehrerFolge.length / 3);
  if (fuehrerFolge[drittel] === sieger) fruehFuehrerGewinnt++;
  if (fuehrerFolge[drittel] === zeitRang[0]) fuehrerDrittelZuerstImZiel++;
  if (fuehrerFolge[drittel] === star) starFuehrtSchonNachDrittel++;
  if (fuehrerFolge[Math.floor(fuehrerFolge.length / 2)] === sieger) haelfteFuehrerGewinnt++;
  if (fuehrerFolge.slice(drittel).every((f) => f === fuehrerFolge[drittel])) fuehrerAbDrittelKonstant++;
  // Aufholer: wer nach dem ersten Drittel im Mittelfeld/hinten lag und am Ende in die
  // ersten zwei kam
  const snapDrittel = r.spur[drittel] || r.spur[0];
  const ordnungDrittel = L.map((u, i) => ({ n: u.n, p: snapDrittel[i] })).sort((a, b) => b.p - a.p).map((x) => x.n);
  L.forEach((u) => {
    const vorher = ordnungDrittel.indexOf(u.n), nachher = rangNach.indexOf(u.n);
    platzVerschiebung.push(vorher - nachher);
    zeitVerschiebung.push(vorher - zeitRang.indexOf(u.n));
    aufholerN++;
    if (vorher >= Math.ceil(L.length / 2) && nachher <= 1) aufholerAusMittelfeld++;
  });
}
console.log(`Rennen: ${rennenGes}, Laeufer je Rennen: ${erg.varianten[0].rennen[0].laeufer.length}`);
console.log(`Eignungsbester gewinnt (Burgpunkte):    ${(100 * starGewinnt / rennenGes).toFixed(1)} %`);
console.log(`Eignungsbester in den ersten zwei:      ${(100 * starInErstenZwei / rennenGes).toFixed(1)} %`);
console.log(`Eignungsbester zuerst im Ziel (Zeit):   ${(100 * starZuerstImZiel / rennenGes).toFixed(1)} %`);
console.log(`Eignungsbester fuehrt schon nach 1/3:   ${(100 * starFuehrtSchonNachDrittel / rennenGes).toFixed(1)} %`);
console.log(`Fuehrer nach 1/3 gewinnt (Burgpunkte):  ${(100 * fruehFuehrerGewinnt / rennenGes).toFixed(1)} %`);
console.log(`Fuehrer nach 1/3 zuerst im Ziel:        ${(100 * fuehrerDrittelZuerstImZiel / rennenGes).toFixed(1)} %`);
console.log(`Fuehrer zur Halbzeit gewinnt:           ${(100 * haelfteFuehrerGewinnt / rennenGes).toFixed(1)} %`);
console.log(`Fuehrung ab 1/3 NIE gewechselt:         ${(100 * fuehrerAbDrittelKonstant / rennenGes).toFixed(1)} % der Rennen`);
console.log(`Fuehrungswechsel je Rennen (Mittel):    ${(wechselSumme / rennenGes).toFixed(2)}`);
console.log(`Aufholer (hintere Haelfte nach 1/3 -> Rang 1-2 am Ende): ${(100 * aufholerAusMittelfeld / aufholerN).toFixed(2)} % aller Laeufereintraege`);
const pv = platzVerschiebung, zv = zeitVerschiebung;
console.log(`Platzverschiebung 1/3 -> Ende (Burgpunkte): min ${Math.min(...pv)} q25 ${q(pv, .25)} med ${q(pv, .5)} q75 ${q(pv, .75)} max ${Math.max(...pv)}, |Mittel| ${mit(pv.map(Math.abs)).toFixed(2)}`);
console.log(`Platzverschiebung 1/3 -> Zieleinlauf:      min ${Math.min(...zv)} q25 ${q(zv, .25)} med ${q(zv, .5)} q75 ${q(zv, .75)} max ${Math.max(...zv)}, |Mittel| ${mit(zv.map(Math.abs)).toFixed(2)}`);

// --- 4. Zeitbudget: wo wird das Rennen entschieden? ---------------------------------
console.log("\n--- 4. ZEITBUDGET: Falle gegen Strecke ---");
const fertige = alleLaeufer.filter((u) => u.fertig != null && !u.raus);
console.log(`Zielzeit: min ${Math.min(...fertige.map((u) => u.fertig)).toFixed(2)} s  med ${q(fertige.map((u) => u.fertig), .5).toFixed(2)} s  max ${Math.max(...fertige.map((u) => u.fertig)).toFixed(2)} s`);
console.log(`Fallen-Stoppzeit je Laeufer: med ${q(fertige.map((u) => u.stoppSumme), .5).toFixed(2)} s (Spanne ${Math.min(...fertige.map((u) => u.stoppSumme)).toFixed(2)}..${Math.max(...fertige.map((u) => u.stoppSumme)).toFixed(2)})`);
console.log(`Gedraenge-Zeit je Laeufer:   med ${q(fertige.map((u) => u.gedraengeZeit), .5).toFixed(2)} s`);
console.log(`Ausscheidequote: ${(100 * alleLaeufer.filter((u) => u.raus).length / alleLaeufer.length).toFixed(1)} %`);
console.log(`r(Zielzeit, Fallen-Stoppzeit) = ${korr(fertige.map((u) => u.fertig), fertige.map((u) => u.stoppSumme)).toFixed(3)}`);
console.log(`r(Zielzeit, Streckenachse)    = ${korr(fertige.map((u) => u.fertig), fertige.map(strecke)).toFixed(3)}`);
console.log(`r(Zielzeit, Stuerze)          = ${korr(fertige.map((u) => u.fertig), fertige.map((u) => u.gestolpert)).toFixed(3)}`);
// Wie viel Zeit steht auf welchem Konto? `steh` ist alles, was der Laeufer STEHEND
// verbringt (Fallen-Stopp + Gedraenge), `lauf` der Rest — die Zeit, in der ihn sein
// Streckentempo traegt.
const steh = fertige.map((u) => u.stoppSumme + u.gedraengeZeit);
const lauf = fertige.map((u, i) => u.fertig - steh[i]);
console.log(`Stehzeit (Falle+Gedraenge): med ${q(steh, .5).toFixed(2)} s, Spanne ${(Math.max(...steh) - Math.min(...steh)).toFixed(2)} s, sd ${Math.sqrt(mit(steh.map((x) => (x - mit(steh)) ** 2))).toFixed(2)}`);
console.log(`Laufzeit (Rest):            med ${q(lauf, .5).toFixed(2)} s, Spanne ${(Math.max(...lauf) - Math.min(...lauf)).toFixed(2)} s, sd ${Math.sqrt(mit(lauf.map((x) => (x - mit(lauf)) ** 2))).toFixed(2)}`);
console.log(`ANTEIL AN DER STREUUNG: Stehzeit ${(100 * mit(steh.map((x) => (x - mit(steh)) ** 2)) / mit(fertige.map((u) => (u.fertig - mit(fertige.map((y) => y.fertig))) ** 2))).toFixed(0)} %, Laufzeit ${(100 * mit(lauf.map((x) => (x - mit(lauf)) ** 2)) / mit(fertige.map((u) => (u.fertig - mit(fertige.map((y) => y.fertig))) ** 2))).toFixed(0)} % der Zielzeit-Varianz`);

// --- 5. TAUGT DAS PROFIL ALS GESCHICHTE? -------------------------------------------
// Der Laeufer, den Chris beschreibt: unterdurchschnittliche Eignung, aber weit
// ueberdurchschnittliches Fallen-Koennen. Gibt es ihn im echten Kader, und kommt er
// heute in die ersten Raenge?
console.log("\n--- 5. DER FALLEN-SPEZIALIST IM KADER ---");
const jeRennen = [];
for (const v of erg.varianten) for (const r of v.rennen) jeRennen.push(r);
let spezN = 0, spezVorn = 0, laeuferN = 0, sprinterN = 0, sprinterVorn = 0;
for (const r of jeRennen) {
  const L = r.laeufer;
  const eigMit = mit(L.map((u) => u.eig));
  const rang = [...L].sort((a, b) => b.wert - a.wert).map((u) => u.n);
  for (const u of L) {
    laeuferN++;
    const p = falle(u) - strecke(u);
    if (u.eig < eigMit && p > 6) { spezN++; if (rang.indexOf(u.n) <= 2) spezVorn++; }
    if (u.eig < eigMit && p < -6) { sprinterN++; if (rang.indexOf(u.n) <= 2) sprinterVorn++; }
  }
}
console.log(`"Fallen-Spezialist" (eig unter Schnitt, Falle-minus-Strecke > +6): ${spezN} von ${laeuferN} Eintraegen (${(100 * spezN / laeuferN).toFixed(1)} %), davon in den ersten drei: ${spezN ? (100 * spezVorn / spezN).toFixed(1) : "—"} %`);
console.log(`"Strecken-Spezialist" (eig unter Schnitt, Falle-minus-Strecke < -6): ${sprinterN} von ${laeuferN} (${(100 * sprinterN / laeuferN).toFixed(1)} %), davon in den ersten drei: ${sprinterN ? (100 * sprinterVorn / sprinterN).toFixed(1) : "—"} %`);
console.log("");

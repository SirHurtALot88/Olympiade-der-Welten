// Sonde fuer den Endstand-Plan (06.09.): Staffel und Takeshi's Castle, kaderfest ueber die
// fuenf Paarungen der Kader-Familie, 24 Saaten je Paarung, ueber window.__arena.bahnLauf.
//   node sonde-endstand.mjs <worktree>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const WT = process.argv[2];
const SEITE = pathToFileURL(path.join(WT, "public/mockups/battle-mode.html")).href;
const fam = JSON.parse(readFileSync(path.join(WT, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const familie = fam.varianten;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const N = 24, SAAT0 = 1337, SCHRITT = 7919;
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.bahnLauf, null, { timeout: 30000 });

  const st = { rennen: 0, widerspruch: 0, gleich: 0, nichtImZiel: 0, maxZeit: 0, minZeit: 99,
    summeVsZiel: 0, bestLaeuferImSieger: 0, etappenSpann: [], konto: [], absDiff: [] };
  const tk = { rennen: 0, negW4: 0, negStern: 0, laeufer: 0, minW4: 99, maxW4: -99, raus: 0,
    bonusAnteilSieger: [], widerspruchPlatz: 0, widerspruchStern: 0, gleich: 0, teamDiff: [],
    sternNegLaeuferMitRaus: 0, sternNegLaeuferOhneRaus: 0, w4NegNurRaus: 0 };
  for (const v of familie) {
    await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
    for (let i = 0; i < N; i++) {
      const saat = SAAT0 + i * SCHRITT;
      // ---- Staffel
      const s = await seite.evaluate((sa) => window.__arena.bahnLauf("staffel", sa), saat);
      st.rennen++;
      const ziel = [null, null];
      for (const u of s.laeufer) if (u.zeit != null) ziel[u.seite] = u.zeit;
      if (ziel[0] == null || ziel[1] == null) st.nichtImZiel++;
      st.maxZeit = Math.max(st.maxZeit, s.zeit); st.minZeit = Math.min(st.minZeit, s.zeit);
      const zielSieger = ziel[0] == null ? 1 : ziel[1] == null ? 0 : ziel[0] < ziel[1] ? 0 : ziel[1] < ziel[0] ? 1 : null;
      const rp = [0, 0], sumL = [0, 0];
      const leist = s.laeufer.map((u) => ({ ...u, l: u.etappe == null ? -99 : -u.etappe + u.wechselKonto }))
        .sort((a, b) => b.l - a.l);
      leist.forEach((u, k) => { rp[u.seite] += leist.length - k; sumL[u.seite] += u.l; });
      const rpSieger = rp[0] > rp[1] ? 0 : rp[1] > rp[0] ? 1 : null;
      if (zielSieger !== null && rpSieger !== null && rpSieger !== zielSieger) st.widerspruch++;
      if (rpSieger === null) st.gleich++;
      const sumSieger = sumL[0] > sumL[1] ? 0 : 1;
      if (zielSieger !== null && sumSieger !== zielSieger) st.summeVsZiel++;
      if (zielSieger !== null && leist[0].seite === zielSieger) st.bestLaeuferImSieger++;
      const et = s.laeufer.filter((u) => u.etappe != null).map((u) => u.etappe);
      st.etappenSpann.push(Math.max(...et) - Math.min(...et));
      for (const u of s.laeufer) st.konto.push(u.wechselKonto);
      if (ziel[0] != null && ziel[1] != null) st.absDiff.push(Math.abs(ziel[0] - ziel[1]));
      // ---- Takeshi
      const t = await seite.evaluate((sa) => window.__arena.bahnLauf("takeshis-castle", sa), saat);
      tk.rennen++;
      const w4 = [0, 0], stern = [0, 0], platz = [0, 0];
      let sieger = null;
      for (const u of t.laeufer) {
        tk.laeufer++;
        const p = u.punkte, s2 = u.burg.stern;
        if (p < 0) { tk.negW4++; if (u.raus) tk.w4NegNurRaus++; }
        if (s2 < 0) { tk.negStern++; if (u.raus) tk.sternNegLaeuferMitRaus++; else tk.sternNegLaeuferOhneRaus++; }
        tk.minW4 = Math.min(tk.minW4, p); tk.maxW4 = Math.max(tk.maxW4, p);
        if (u.raus) tk.raus++;
        w4[u.seite] += p; stern[u.seite] += s2; platz[u.seite] += u.rangpunkte;
      }
      sieger = w4[0] > w4[1] ? 0 : w4[1] > w4[0] ? 1 : null;
      if (sieger === null) tk.gleich++;
      const platzSieger = platz[0] > platz[1] ? 0 : platz[1] > platz[0] ? 1 : null;
      const sternSieger = stern[0] > stern[1] ? 0 : stern[1] > stern[0] ? 1 : null;
      if (sieger !== null && platzSieger !== null && sieger !== platzSieger) tk.widerspruchPlatz++;
      if (sieger !== null && sternSieger !== null && sieger !== sternSieger) tk.widerspruchStern++;
      if (sieger !== null) {
        const bonus = t.laeufer.filter((u) => u.seite === sieger).reduce((a, u) => a + u.burg.bonus, 0);
        tk.bonusAnteilSieger.push(bonus / w4[sieger]);
      }
      tk.teamDiff.push(Math.abs(w4[0] - w4[1]));
      if (i === 0 && familie.indexOf(v) === 0) {
        console.log("Beispiel Staffel (Paarung 1, Saat 1337):", JSON.stringify({ zeit: s.zeit, seiten: s.seiten, gewertet: s.gewertet, wertung: s.wertung }));
        for (const u of leist) console.log("  ", String(u.n).padEnd(14), "S" + u.seite, "Bein", u.bein + 1, "Etappe", u.etappe?.toFixed(2), "Konto", u.wechselKonto.toFixed(2), "Leistung", u.l.toFixed(2), "Punkte", u.punkte, "Platz", u.platz);
        console.log("Beispiel Takeshi (Paarung 1, Saat 1337):", JSON.stringify({ zeit: t.zeit, seiten: t.seiten, wertung: t.wertung }));
        for (const u of [...t.laeufer].sort((a, b) => b.punkte - a.punkte)) console.log("  ", String(u.n).padEnd(14), "S" + u.seite, "Platz", u.platz, "raus", u.raus, "Stern", u.burg.stern.toFixed(1), "Bonus", u.burg.bonus, "W4", u.punkte.toFixed(1), "Rangpkt", u.rangpunkte);
      }
    }
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const mw = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log("\nSTAFFEL:", st.rennen, "Rennen",
    "| Widerspruch Rangpunktsumme vs Zieleinlauf:", st.widerspruch, `(${(100 * st.widerspruch / st.rennen).toFixed(1)} %)`,
    "| Rangpunkte gleich:", st.gleich,
    "| Widerspruch Leistungssumme vs Ziel:", st.summeVsZiel,
    "| bester Einzellaeufer im Siegerteam:", st.bestLaeuferImSieger,
    "| nicht beide im Ziel:", st.nichtImZiel,
    "| Rennzeit min/max:", st.minZeit.toFixed(1), st.maxZeit.toFixed(1),
    "| Etappenspannweite median:", med(st.etappenSpann).toFixed(2), "s",
    "| Wechselkonto median/min:", med(st.konto).toFixed(2), Math.min(...st.konto).toFixed(2),
    "| Zielabstand median:", med(st.absDiff).toFixed(2), "s");
  console.log("TAKESHI:", tk.rennen, "Rennen,", tk.laeufer, "Laeufer",
    "| W4 negativ:", tk.negW4, `(${(100 * tk.negW4 / tk.laeufer).toFixed(1)} %; davon ausgeschieden ${tk.w4NegNurRaus})`,
    "| Sterne negativ:", tk.negStern, `(${(100 * tk.negStern / tk.laeufer).toFixed(1)} %; raus ${tk.sternNegLaeuferMitRaus}, im Ziel ${tk.sternNegLaeuferOhneRaus})`,
    "| W4 min/max:", tk.minW4.toFixed(1), tk.maxW4.toFixed(1),
    "| ausgeschieden:", tk.raus, `(${(100 * tk.raus / tk.laeufer).toFixed(1)} %)`,
    "| Teamsieger W4 vs Platzierung widerspricht:", tk.widerspruchPlatz, `(${(100 * tk.widerspruchPlatz / tk.rennen).toFixed(1)} %)`,
    "| W4 vs Sterne ohne Bonus widerspricht:", tk.widerspruchStern,
    "| Gleichstand:", tk.gleich,
    "| Bonusanteil am Siegerteam median:", (100 * med(tk.bonusAnteilSieger)).toFixed(1), "%",
    "| Teamabstand W4 median:", med(tk.teamDiff).toFixed(1));
  console.log("Seitenfehler:", fehler.length ? fehler.slice(0, 3).join(" | ") : "keine");
} finally { await browser.close(); }

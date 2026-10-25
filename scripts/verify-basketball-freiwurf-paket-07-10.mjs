// VERIFIKATION B2a — DER SPIRIT-FREIWURF (07.10., docs/design/fable-ideen-feldspiel-30-09.md §3 B2,
// nur der Freiwurf-Teil; Foulsystem P1 und Hack-a-X bleiben draussen).
//
// Die Freiwurf-Trefferchance las bis hierher ABSCHLUSS (einen Auswahl-Wert mit power/charisma/
// stamina im Rezept). Jetzt liest sie `ftWert`, einen spirit-gefuehrten Kanal aus spirit/
// intelligence/dexterity (FREIWURF_KANAL in battle-mode.engine.js), matrixtreu gewichtet
// (Basketball-Matrix 22/16/8 auf die drei normiert = 48/35/17), in einem engen Band 55-92 %,
// ohne Kontest-, Distanz- oder Fastbreak-Term. Diese Sonde prueft:
//
//   (a) Mischung: genau spirit/intelligence/dexterity, Gewichte = Matrix 22/16/8 normiert (±1).
//   (b) Formel/Band: chance(0)=55 %, chance(50)=72 %, chance(100)=92 %, monoton steigend; ohne
//       Kanal (ftWert null, jede andere Disziplin) zeichengleich die alte ABSCHLUSS-Kurve.
//   (c) Kanal wirkt am ECHTEN Spieler: derselbe Kader mehrfach gebaut, bei einem Spieler je EIN
//       Attribut um +30 gehoben — ftWert steigt je Punkt fuer spirit > intelligence > dexterity
//       > 0 (spirit ~0,48), und Attribute ausserhalb des Kanals (power/charisma/awareness/speed)
//       bewegen ihn weniger als das schwaechste Kanal-Attribut (nur ueber den Normierungsrest
//       des Slot-/Form-Aufschlags, s. dort).
//   (d) Im Spiel: jeder Freiwurf-Versuch hat einen Schuetzen mit endlichem ftWert, und die
//       beobachtete Quote liegt innerhalb von 3 Sigma um die Summe der Formel-Chancen.
//   (d2) TRENNSCHARF gegen die alte Formel (Review 07.10.): zwei Kunstkader mit fast gleichem
//       ABSCHLUSS (~53-56, alte Kurve: beide ~72 %), aber spiegelverkehrtem Kanal (spirit/
//       intelligence/dexterity 95 gegen 5). Neue Formel: ~92 % gegen ~55 %. Geprueft wird, dass
//       der Abstand gross ist und jede Seite in 3 Sigma ihrer NEUEN Erwartung liegt — eine
//       Rueckkehr zur ABSCHLUSS-Formel faellt hier sicher durch.
//   (e) Isolation: Hockey- und Football-Spieler tragen ftWert === null.
//   (f) keine `pageerror`.
//
//   node scripts/verify-basketball-freiwurf-paket-07-10.mjs [spiele=40]
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 40);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const variante = familie.varianten[0];

let alleOk = true;
const pruefe = (name, ok, detail) => {
  console.log(`${ok ? "OK  " : "FEHL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) alleOk = false;
};

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.freiwurfKanal && window.__arena.spiele, null, { timeout: 30000 });

  // (a) + (b)
  const formel = await seite.evaluate(() => {
    const f = window.__arena.freiwurfKanal();
    const pkt = [0, 20, 50, 72, 86, 100, 150].map((w) => [w, f.chance(w)]);
    let monoton = true; let vorher = -1;
    for (let w = 0; w <= 100; w++) { const c = f.chance(w); if (c < vorher - 1e-12) monoton = false; vorher = c; }
    // alte Kurve (main 2470c502, verbucheFreiwurf), zeichengleich nachgerechnet
    const alt = (A) => Math.min(0.90, Math.max(0.60, 0.72 + (A - 50) * 0.0006 + Math.max(0, A - 60) * 0.0056));
    let rueckfallGleich = true;
    for (let A = 1; A <= 99; A++) if (f.chanceOhneKanal(A) !== alt(A)) rueckfallGleich = false;
    return { kanal: f.kanal, band: f.band, pkt, monoton, rueckfallGleich };
  });
  const k = formel.kanal, summe = Object.values(k).reduce((s, x) => s + x, 0);
  pruefe("(a) Kanal = spirit/intelligence/dexterity",
    Object.keys(k).sort().join(",") === "dexterity,intelligence,spirit", JSON.stringify(k));
  const matrix = { spirit: 22, intelligence: 16, dexterity: 8 }, mSumme = 46;
  pruefe("(a) Gewichte matrixtreu (Basketball 22/16/8 normiert, ±1)",
    Object.entries(matrix).every(([a, m]) => Math.abs(100 * k[a] / summe - 100 * m / mSumme) <= 1),
    Object.keys(matrix).map((a) => `${a} ${(100 * k[a] / summe).toFixed(0)} (Matrix ${(100 * matrix[a] / mSumme).toFixed(1)})`).join(", "));
  const c = Object.fromEntries(formel.pkt);
  pruefe("(b) Band 55-92 %", formel.band[0] === 0.55 && formel.band[1] === 0.92 && c[0] === 0.55 && c[150] === 0.92,
    formel.pkt.map(([w, x]) => `${w}:${(100 * x).toFixed(1)}%`).join(" "));
  pruefe("(b) Ankerpunkt 50 -> 72 %", Math.abs(c[50] - 0.72) < 1e-9);
  pruefe("(b) monoton steigend 0..100", formel.monoton);
  pruefe("(b) ohne Kanal (ftWert null) zeichengleich die alte ABSCHLUSS-Kurve", formel.rueckfallGleich);

  // (c) am echten Spieler: ftWert-Differenz je gehobenem Attributpunkt
  const ftVon = async (heim, gast, name) => seite.evaluate(([heim, gast, name]) => {
    window.__arena.kaderSetzen({ heim, gast });
    const prot = window.__arena.spiele("basketball", 4242).protokoll;
    for (const e of prot) for (const key of ["spieler", "verteidiger", "passgeber", "rebounder"]) {
      const u = e[key]; if (u && u.n === name && u.ftWert !== undefined) return { ft: u.ftWert, abschluss: u.ABSCHLUSS };
    }
    return null;
  }, [heim, gast, name]);
  // Der Motor stellt ohne gesetzte Aufstellung die sechs Eignungsbesten auf (bauFeldspiel,
  // `ersatz`). Genommen wird der SECHSTBESTE: er steht sicher auf dem Feld, und seine Werte
  // liegen weit genug unter 99, dass ein Hub von +30 nirgends am Deckel klemmt.
  const ziel = [...variante.heim].sort((x, y) => (y.d.basketball || 0) - (x.d.basketball || 0))[5];
  const basis = await ftVon(variante.heim, variante.gast, ziel.n);
  // Warum Reihenfolge statt exakter Soll-Differenz: Slot-/Form-Aufschlag (mitAufschlag) ist
  // ein FAKTOR auf alle Attribute der Disziplin, normiert auf deren Matrix-Summe — wer ein
  // Attribut hebt, verschiebt diesen Faktor fuer alle anderen ein wenig mit. Die Differenz
  // ist deshalb anteil*hub*f plus ein kleiner Normierungsrest, nicht exakt anteil*hub. Was
  // der Kanal garantiert und was hier geprueft wird: spirit > intelligence > dexterity > 0
  // je Punkt, und jedes Attribut AUSSERHALB des Kanals bewegt ftWert weniger als das
  // schwaechste im Kanal (nur ueber den Normierungsrest).
  const HUB = 30;
  const dJePunkt = {};
  for (const attr of ["spirit", "dexterity", "intelligence", "power", "charisma", "awareness", "speed"]) {
    const heim = variante.heim.map((p) => p.n === ziel.n ? { ...p, a: { ...p.a, [attr]: p.a[attr] + HUB } } : p);
    const neu = await ftVon(heim, variante.gast, ziel.n);
    dJePunkt[attr] = neu && basis ? (neu.ft - basis.ft) / HUB : NaN;
  }
  const zeige = Object.entries(dJePunkt).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  console.log(`      ${ziel.n}: ftWert ${basis?.ft}, ABSCHLUSS ${basis?.abschluss}; dftWert je Attributpunkt: ${zeige}`);
  pruefe("(c) spirit > intelligence > dexterity > 0 (je Punkt)",
    dJePunkt.spirit > dJePunkt.intelligence && dJePunkt.intelligence > dJePunkt.dexterity && dJePunkt.dexterity > 0);
  pruefe("(c) spirit je Punkt ~0,48 (Kanalanteil 48 %)", dJePunkt.spirit >= 0.35 && dJePunkt.spirit <= 0.65, dJePunkt.spirit.toFixed(2));
  const aussen = ["power", "charisma", "awareness", "speed"];
  pruefe("(c) Attribute ausserhalb des Kanals bewegen ftWert kaum (|d| < dexterity)",
    aussen.every((k) => Math.abs(dJePunkt[k]) < dJePunkt.dexterity),
    aussen.map((k) => `${k} ${dJePunkt[k].toFixed(2)}`).join(", "));

  // (d) im Spiel, ueber den Kader-Familie-Kader
  const spiel = await seite.evaluate(([heim, gast, n]) => {
    window.__arena.kaderSetzen({ heim, gast });
    const f = window.__arena.freiwurfKanal();
    let versuche = 0, treffer = 0, erw = 0, varianz = 0, ohneFt = 0, ungleichAbschluss = 0;
    for (let i = 0; i < n; i++) {
      for (const e of window.__arena.spiele("basketball", 1337 + i * 7919).protokoll) {
        if (e.art !== "freiwurf_versuch") continue;
        versuche++; if (e.treffer) treffer++;
        const w = e.spieler.ftWert;
        if (!Number.isFinite(w)) { ohneFt++; continue; }
        if (w !== e.spieler.ABSCHLUSS) ungleichAbschluss++;
        const p = f.chance(w); erw += p; varianz += p * (1 - p);
      }
    }
    return { versuche, treffer, erw, sigma: Math.sqrt(varianz), ohneFt, ungleichAbschluss };
  }, [variante.heim, variante.gast, SPIELE]);
  pruefe("(d) Freiwuerfe finden statt", spiel.versuche > 0, `${spiel.versuche} Versuche in ${SPIELE} Spielen (${(spiel.versuche / SPIELE).toFixed(1)}/Spiel)`);
  pruefe("(d) jeder Schuetze hat einen ftWert", spiel.ohneFt === 0, `${spiel.ohneFt} ohne`);
  pruefe("(d) ftWert ist nicht ABSCHLUSS", spiel.ungleichAbschluss > 0, `${spiel.ungleichAbschluss}/${spiel.versuche} Versuche mit ftWert != ABSCHLUSS`);
  pruefe("(d) Quote innerhalb 3 Sigma der Formel",
    Math.abs(spiel.treffer - spiel.erw) <= 3 * spiel.sigma,
    `beobachtet ${spiel.treffer}/${spiel.versuche} = ${(100 * spiel.treffer / spiel.versuche).toFixed(1)} %, ` +
    `Formel ${(100 * spiel.erw / spiel.versuche).toFixed(1)} % (±${(100 * 3 * spiel.sigma / spiel.versuche).toFixed(1)} Pp)`);

  // (d2) trennscharf gegen die alte Formel: zwei Kunstkader, gleicher ABSCHLUSS, Kanal gespiegelt.
  const vorlage = [...variante.heim].sort((x, y) => (y.d.basketball || 0) - (x.d.basketball || 0)).slice(0, 6);
  const KANAL = ["spirit", "intelligence", "dexterity"];
  const kunst = (praefix, kanalWert, restWert) => vorlage.map((p, i) => ({
    ...p, n: `${praefix}${i}`,
    a: Object.fromEntries(Object.keys(p.a).map((x) => [x, KANAL.includes(x) ? kanalWert : restWert])),
  }));
  const trenn = await seite.evaluate(([heim, gast, n]) => {
    window.__arena.kaderSetzen({ heim, gast });
    const f = window.__arena.freiwurfKanal();
    const s = [0, 1].map(() => ({ v: 0, t: 0, erw: 0, varianz: 0, ft: [], abschluss: [] }));
    for (let i = 0; i < n; i++) {
      for (const e of window.__arena.spiele("basketball", 9001 + i * 7919).protokoll) {
        if (e.art !== "freiwurf_versuch") continue;
        const z = s[e.spieler.side];
        z.v++; if (e.treffer) z.t++;
        const p = f.chance(e.spieler.ftWert); z.erw += p; z.varianz += p * (1 - p);
        z.ft.push(e.spieler.ftWert); z.abschluss.push(e.spieler.ABSCHLUSS);
      }
    }
    const mittel = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    return s.map((z) => ({ v: z.v, t: z.t, erw: z.erw, sigma: Math.sqrt(z.varianz), ft: mittel(z.ft), abschluss: mittel(z.abschluss) }));
  }, [kunst("Kanal-hoch-", 95, 5), kunst("Kanal-tief-", 5, 95), Math.max(SPIELE, 60)]);
  const [hoch, tief] = trenn;
  const quote = (z) => z.v ? z.t / z.v : NaN;
  console.log(`      Kanal hoch: ftWert ${hoch.ft.toFixed(0)}, ABSCHLUSS ${hoch.abschluss.toFixed(0)}, ${hoch.t}/${hoch.v} = ${(100 * quote(hoch)).toFixed(1)} % (Formel ${(100 * hoch.erw / hoch.v).toFixed(1)} %)`);
  console.log(`      Kanal tief: ftWert ${tief.ft.toFixed(0)}, ABSCHLUSS ${tief.abschluss.toFixed(0)}, ${tief.t}/${tief.v} = ${(100 * quote(tief)).toFixed(1)} % (Formel ${(100 * tief.erw / tief.v).toFixed(1)} %)`);
  pruefe("(d2) beide Kunstkader werfen Freiwuerfe", hoch.v >= 15 && tief.v >= 15, `${hoch.v} / ${tief.v} Versuche`);
  const altKurve = (A) => Math.min(0.90, Math.max(0.60, 0.72 + (A - 50) * 0.0006 + Math.max(0, A - 60) * 0.0056));
  const altAbstand = altKurve(hoch.abschluss) - altKurve(tief.abschluss);
  pruefe("(d2) alte ABSCHLUSS-Formel saehe zwischen beiden < 3 Pp Unterschied", Math.abs(altAbstand) < 0.03,
    `alt ${(100 * altKurve(hoch.abschluss)).toFixed(1)} % gegen ${(100 * altKurve(tief.abschluss)).toFixed(1)} %`);
  pruefe("(d2) Kanal hoch trifft mindestens 20 Pp besser als Kanal tief", quote(hoch) - quote(tief) >= 0.20,
    `${(100 * (quote(hoch) - quote(tief))).toFixed(1)} Pp`);
  pruefe("(d2) beide Seiten in 3 Sigma ihrer neuen Erwartung",
    Math.abs(hoch.t - hoch.erw) <= 3 * hoch.sigma && Math.abs(tief.t - tief.erw) <= 3 * tief.sigma);

  // (e) Isolation
  const iso = await seite.evaluate(() => {
    const r = {};
    for (const d of ["hockey", "football"]) {
      let gesehen = 0, nichtNull = 0;
      for (const e of window.__arena.spiele(d, 1337).protokoll) for (const key of ["spieler", "verteidiger", "passgeber"]) {
        const u = e[key]; if (!u || typeof u !== "object") continue;
        gesehen++; if (u.ftWert !== null) nichtNull++;
      }
      r[d] = { gesehen, nichtNull };
    }
    return r;
  });
  for (const [d, x] of Object.entries(iso))
    pruefe(`(e) ${d}: ftWert === null`, x.gesehen > 0 && x.nichtNull === 0, `${x.gesehen} Spielerbezuege, ${x.nichtNull} mit Wert`);

  pruefe("(f) keine pageerror", fehler.length === 0, fehler.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
console.log(alleOk ? "\nALLE PRUEFUNGEN BESTANDEN" : "\nMINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN");
process.exit(alleOk ? 0 : 1);

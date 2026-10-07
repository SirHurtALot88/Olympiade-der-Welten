// VERIFIKATION B2a — DER SPIRIT-FREIWURF (07.10., docs/design/fable-ideen-feldspiel-30-09.md §3 B2,
// nur der Freiwurf-Teil; Foulsystem P1 und Hack-a-X bleiben draussen).
//
// Die Freiwurf-Trefferchance las bis hierher ABSCHLUSS (einen Auswahl-Wert mit power/charisma/
// stamina im Rezept). Jetzt liest sie `ftWert`, einen spirit-gefuehrten Kanal aus spirit/
// dexterity/intelligence (FREIWURF_KANAL in battle-mode.engine.js), in einem engen Band 55-92 %,
// ohne Kontest-, Distanz- oder Fastbreak-Term. Diese Sonde prueft:
//
//   (a) Mischung: genau spirit/dexterity/intelligence, spirit fuehrt mit >= 50 % der Summe.
//   (b) Formel/Band: chance(0)=55 %, chance(50)=72 %, chance(100)=92 %, monoton steigend.
//   (c) Kanal wirkt am ECHTEN Spieler: derselbe Kader mehrfach gebaut, bei einem Spieler je EIN
//       Attribut um +30 gehoben — ftWert steigt je Punkt fuer spirit > dexterity > intelligence
//       > 0 (spirit ~0,5), und Attribute ausserhalb des Kanals (power/charisma/awareness/speed)
//       bewegen ihn weniger als das schwaechste Kanal-Attribut (nur ueber den Normierungsrest
//       des Slot-/Form-Aufschlags, s. dort).
//   (d) Im Spiel: jeder Freiwurf-Versuch hat einen Schuetzen mit endlichem ftWert, und die
//       beobachtete Quote liegt innerhalb von 3 Sigma um die Summe der Formel-Chancen.
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
    return { kanal: f.kanal, band: f.band, pkt, monoton };
  });
  const k = formel.kanal, summe = Object.values(k).reduce((s, x) => s + x, 0);
  pruefe("(a) Kanal = spirit/dexterity/intelligence",
    Object.keys(k).sort().join(",") === "dexterity,intelligence,spirit", JSON.stringify(k));
  pruefe("(a) spirit fuehrt (>= 50 % der Summe, groesstes Gewicht)",
    k.spirit / summe >= 0.5 && k.spirit > k.dexterity && k.spirit > k.intelligence,
    `spirit ${(100 * k.spirit / summe).toFixed(0)} %`);
  const c = Object.fromEntries(formel.pkt);
  pruefe("(b) Band 55-92 %", formel.band[0] === 0.55 && formel.band[1] === 0.92 && c[0] === 0.55 && c[150] === 0.92,
    formel.pkt.map(([w, x]) => `${w}:${(100 * x).toFixed(1)}%`).join(" "));
  pruefe("(b) Ankerpunkt 50 -> 72 %", Math.abs(c[50] - 0.72) < 1e-9);
  pruefe("(b) monoton steigend 0..100", formel.monoton);

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
  // der Kanal garantiert und was hier geprueft wird: spirit > dexterity > intelligence > 0
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
  pruefe("(c) spirit > dexterity > intelligence > 0 (je Punkt)",
    dJePunkt.spirit > dJePunkt.dexterity && dJePunkt.dexterity > dJePunkt.intelligence && dJePunkt.intelligence > 0);
  pruefe("(c) spirit je Punkt ~0,5 (Kanalanteil 50 %)", dJePunkt.spirit >= 0.35 && dJePunkt.spirit <= 0.7, dJePunkt.spirit.toFixed(2));
  const aussen = ["power", "charisma", "awareness", "speed"];
  pruefe("(c) Attribute ausserhalb des Kanals bewegen ftWert kaum (|d| < intelligence)",
    aussen.every((k) => Math.abs(dJePunkt[k]) < dJePunkt.intelligence),
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

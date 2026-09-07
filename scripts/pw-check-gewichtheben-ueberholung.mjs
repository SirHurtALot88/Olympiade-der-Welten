// VERIFIKATION der Gewichtheben-Ueberholung (06.09., PRODUKTIONSCODE). Prueft alle vier
// Punkte in einem Lauf: 1) Hantel-Visual mit sichtbarem Aufstieg/Ablage, 2) Tempo (Sekunden
// je Versuch), 3) ein Beispiel Fehlversuch -> niedrigere naechste Ansage (aus dem echten
// Protokoll), 4) Reihenfolge alterniert (leichtere Ansage zuerst) statt immer Heim zuerst.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const AUSGABE = path.join(WURZEL, "tmp-ux-audit");
mkdirSync(AUSGABE, { recursive: true });

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

// ---- Teil A: Datencheck (headless, schnell) -- Fehlversuch->niedriger, Reihenfolge alterniert.
{
  const seite = await browser.newPage();
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });
  const { faelle, reihenfolgeA, reihenfolgeB } = await seite.evaluate(() => {
    const A = window.__arena;
    const faelle = [];
    let reihenfolgeA = 0, reihenfolgeB = 0;
    for (let i = 0; i < 400 && faelle.length < 3; i++) {
      const prot = A.spiele("gewichtheben", 9000 + i * 7919).protokoll;
      for (const u of prot) {
        for (const uebung of ["reissen", "stossen"]) {
          const r = u.runden.filter(x => x.uebung === uebung).sort((a, b) => a.versuch - b.versuch);
          if (r.length < 2) continue;
          for (let v = 0; v < r.length - 1; v++) {
            if (!r[v].gueltig && r[v + 1].kg < r[v].kg && faelle.length < 3) {
              faelle.push({ heber: u.n, uebung, versuch: v + 1, von: r[v].kg, nach: r[v + 1].kg });
            }
          }
        }
      }
    }
    // Reihenfolge: wer wird im buehneQueue-Sinn zuerst gehoben? Wir lesen das indirekt aus
    // dem oeffentlichen Duell-Sieg-Muster nicht direkt sichtbar -- stattdessen zaehlen wir,
    // fuer den DRITTEN Versuch jeder Uebung, ob Heim (side 0) oder Gast (side 1) je Duell die
    // NIEDRIGERE dritte Ansage hatte (das ist, wer zuerst hebt, s. Motor-Kommentar).
    for (let i = 0; i < 60; i++) {
      const prot = A.spiele("gewichtheben", 20000 + i * 7919).protokoll;
      const bySlot = new Map();
      for (const u of prot) {
        const k = u.duellNr;
        if (!bySlot.has(k)) bySlot.set(k, {});
        bySlot.get(k)[u.seite] = u;
      }
      for (const paar of bySlot.values()) {
        if (!paar[0] || !paar[1]) continue;
        for (const uebung of ["reissen", "stossen"]) {
          const dritteA = paar[0].runden.find(x => x.uebung === uebung && x.versuch === 3);
          const dritteB = paar[1].runden.find(x => x.uebung === uebung && x.versuch === 3);
          if (!dritteA || !dritteB || dritteA.kg === dritteB.kg) continue;
          if (dritteA.kg < dritteB.kg) reihenfolgeA++; else reihenfolgeB++;
        }
      }
    }
    return { faelle, reihenfolgeA, reihenfolgeB };
  });
  console.log("=== Teil A: Datencheck ===");
  console.log("\nFehlversuch -> niedrigere naechste Ansage, Beispiele:");
  console.log(JSON.stringify(faelle, null, 2));
  console.log(`\nDritter Versuch, wer hat die leichtere (= zuerst hebende) Ansage: Heim ${reihenfolgeA}x, Gast ${reihenfolgeB}x`
    + ` (${reihenfolgeA} vs ${reihenfolgeB} von ${reihenfolgeA + reihenfolgeB} Duell-Uebungen mit unterschiedlicher Ansage)`);
  // WICHTIG: `A.spiele()` teilt einen ECHTEN 12-koepfigen Kader in zwei UNGLEICHE Haelften
  // (Heim/Gast sind hier keine identischen Rosters) — eine Schieflage hier kann genauso gut
  // eine echte Staerke-/ANSAGE-Differenz zwischen den beiden Haelften sein wie ein Rest der
  // alten Reihenfolge-Bevorzugung. Der scharfe Fairness-Beweis ist der SPIEGELTEST mit
  // IDENTISCHEM Kader auf beiden Seiten (docs/design/gewichtheben-duell-reihenfolge-plan-06-09.md):
  //   node docs/design/gewichtheben-duell-reihenfolge-spiegel-06-09.mjs public/mockups/battle-mode.html 1000
  // Erwartung dort: Duelle nahe 50:50 (gemessen fuer dieses PR: 3025:2975 bei N=1000). Diese
  // Zeile hier ist nur ein grober Hinweis, kein Beleg.
  console.log("(Hinweis: das ist ein UNGLEICHER Kader, kein Beweis -- s. Kommentar im Skript fuer den Spiegeltest-Befehl.)");
  await seite.close();
}

// ---- Teil B: visuelle Sequenz (echtzeit, langsam wegen ZEIT_DEHNUNG.gewichtheben=4).
{
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
  await seite.click("#t2");

  const start = Date.now();
  await seite.click("#play");
  // TEMPO-PROBE: der Feed bekommt einen neuen Eintrag pro enthuelltem Versuch. Bleibt der
  // Text ueber ~5s nach dem ersten Versuch UNVERAENDERT, ist ZEIT_DEHNUNG.gewichtheben=4
  // wirksam (~6,2s je Versuch); ein zu frueher zweiter Eintrag waere ein Regressionssignal.
  await seite.waitForTimeout(800);
  const feedNachErstemVersuch = await seite.$eval("#feed", (el) => el.textContent || "").catch(() => "");
  await seite.waitForTimeout(4800);
  const feedNach5_6s = await seite.$eval("#feed", (el) => el.textContent || "").catch(() => "");
  console.log("\n=== Teil B: Tempo-Probe ===");
  console.log("Feed nach ~0,8s bleibt bis ~5,6s " +
    (feedNachErstemVersuch === feedNach5_6s ? "UNVERAENDERT (Tempo OK, ~6,2s je Versuch)" : "hat sich geaendert (schneller als erwartet?)"));
  const schnappschuss = async (label, wartenMs) => {
    await seite.waitForTimeout(wartenMs);
    const cv = await seite.$("#cv");
    const out = path.join(AUSGABE, `gewichtheben-${label}.png`);
    await cv.screenshot({ path: out });
    console.log(`Screenshot ${label} bei ${((Date.now() - start) / 1000).toFixed(1)}s -> ${out}`);
  };
  await schnappschuss("a-anfang", 300);      // vor dem ersten Versuch: Hantel am Boden, Text "Erste Ansage folgt"
  await schnappschuss("b-aufstieg", 2500);   // mitten im Aufstieg (steigPhase < 1)
  await schnappschuss("c-ergebnis", 3500);   // Ergebnis erreicht: entweder oben gehalten oder schon gefallen
  await schnappschuss("d-naechster-aufstieg", 3200); // naechster Versuch, wieder im Aufstieg
  await schnappschuss("e-spaeter", 15000);   // deutlich spaeter, zweites/drittes Duell
  console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  await seite.close();
}

await browser.close();

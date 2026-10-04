// ISOLATIONSNACHWEIS DES ALTERNATIV-RECHNERS (Klasse A*, Task #27, docs/design/
// fable-ideen-bahn-30-09.md Abschnitt 1.3).
//
// Die Behauptung, die dieses Skript PRUEFT statt nur zu BEHAUPTEN: ein Zweitlauf des
// Alternativ-Rechners (bahnLauf() mit einer Ansage oder einer fremden Saat, genau das
// Muster aus bahnAlternativZeilen() in battle-mode.engine.js) veraendert den geteilten
// Zufallsstrom (`seed`/`rr()`, EIN LCG fuer alle vier Chassis, s. dessen Kommentar in der
// Engine), aber NIE das Ergebnis einer spaeteren, echten Simulation — weder des Rennens,
// das gerade zu Ende ist (dessen Zustand bahnLauf() ohnehin per M.sichern()/M.zurueck()
// vollstaendig zuruecksetzt), noch des NAECHSTEN Rennens, das erst nach ihm kommt.
//
// METHODE: window.__arena.rngZustand() ist ein neuer, rein lesender Diagnose-Zugriff auf
// `seed` (s. dessen Kommentar in der Engine). Drei Proben je Bahn-Disziplin:
//
//   A) Zwei Rennen direkt hintereinander (S1, S2), KEIN Alternativ-Rechner dazwischen.
//      -> Ergebnis von S2 = REFERENZ.
//   B) Dieselben zwei Rennen (S1, S2), aber zwischen S1 und S2 laeuft ein kompletter
//      Alternativ-Rechner-Durchgang auf S1s Ergebnis (bei Time-Trial: ein exakter
//      Zweitlauf je Alternativplan und Laeufer; bei Spurt/Staffel/Takeshi: die volle
//      Drei-Saaten-Tendenz je Laeufer und Alternativplan — also genau das, was
//      bahnAlternativZeilen() im echten Spiel tut).
//      -> S1 selbst UND S2 muessen bit-identisch zu Probe A sein.
//   C) Der `seed`-Rohzustand (rngZustand()) direkt nach S1 vs. direkt nach dem
//      Alternativ-Rechner-Durchgang: MUSS sich unterscheiden (der Alternativ-Rechner
//      zieht echte rr()-Aufrufe) — das ist der Beleg, dass Probe B ueberhaupt etwas zu
//      beweisen hatte, und kein Nachweis, der nichts veraendert und deshalb nichts zeigt.
//
// Besteht A===B (S1 UND S2 bit-identisch) UND C zeigt einen echten Unterschied, ist die
// Isolation gezeigt: der Alternativ-Rechner greift in den Zufallsstrom ein, aber
// JEDES `bau(saat)` (das naechste Rennen eingeschlossen) ueberschreibt ihn unbedingt aus
// der eigenen Saat, bevor irgendein rr()-Aufruf etwas vom Rest liest.
//
//   node scripts/pruefe-bahn-alternativ-isolation.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const PL = {
  spurt: ["vorn", "schatten", "kick"],
  "time-trial": ["gleich", "negativ", "attacke"],
  staffel: ["halten", "angehen", "schluss"],
  "takeshis-castle": ["vorsicht", "stetig", "wild"],
};
const DISZIS = Object.keys(PL);
const S1 = 20261001, S2 = 20261002;

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let fehler = [];
let zeilen = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.bahnLauf && window.__arena.rngZustand, null, { timeout: 30000 });

  for (const d of DISZIS) {
    const r = await seite.evaluate(
      ({ d, S1, S2, plaene }) => {
        const A = window.__arena;

        // PROBE A: Referenz, kein Alternativ-Rechner dazwischen.
        const a1 = A.bahnLauf(d, S1);
        const a2 = A.bahnLauf(d, S2);

        // PROBE B: dieselben zwei Rennen, Alternativ-Rechner auf a1 dazwischen.
        const b1 = A.bahnLauf(d, S1);
        const seedNachB1 = A.rngZustand();

        // Genau das Muster aus bahnAlternativZeilen(): fuer jeden echten Heim-Finisher
        // und jeden Alternativplan ausser seinem eigenen.
        const heim = b1.laeufer.filter((u) => u.seite === 0 && u.raus !== true && u.zeit != null);
        let zweitlaeufe = 0;
        if (d === "time-trial") {
          for (const h of heim) {
            for (const p of plaene) {
              if (p === h.plan) continue;
              A.bahnLauf(d, S1, [{ n: h.n, plan: p, bei: 0 }]);
              zweitlaeufe++;
            }
          }
        } else {
          const basis = (S1 >>> 0);
          const SAATEN = [0, 1, 2].map((i) => (basis + i * 7919) >>> 0);
          for (const h of heim) {
            for (const p of plaene) {
              if (p === h.plan) continue;
              for (const s of SAATEN) {
                A.bahnLauf(d, s);
                A.bahnLauf(d, s, [{ n: h.n, plan: p, bei: 0 }]);
                zweitlaeufe += 2;
              }
            }
          }
        }
        const seedNachAlternativ = A.rngZustand();
        const b2 = A.bahnLauf(d, S2);

        return {
          a1, a2, b1, b2, zweitlaeufe,
          seedNachB1, seedNachAlternativ,
          heimZahl: heim.length,
        };
      },
      { d, S1, S2, plaene: PL[d] },
    );

    const s1Gleich = JSON.stringify(r.a1) === JSON.stringify(r.b1);
    const s2Gleich = JSON.stringify(r.a2) === JSON.stringify(r.b2);
    const seedBewegt = r.seedNachB1 !== r.seedNachAlternativ;
    zeilen.push({ d, s1Gleich, s2Gleich, seedBewegt, zweitlaeufe: r.zweitlaeufe, heimZahl: r.heimZahl,
      seedNachB1: r.seedNachB1, seedNachAlternativ: r.seedNachAlternativ });
  }
} finally {
  await browser.close();
}

console.log("ISOLATIONSNACHWEIS ALTERNATIV-RECHNER — rr()-Zustand vor/nach, S2 vorher/nachher\n");
console.log(
  "Disziplin".padEnd(18) + "Heim".padStart(5) + "Zweitl.".padStart(9)
  + "S1 bit-ident.".padStart(17) + "S2 bit-ident.".padStart(17)
  + "seed-Erwartung".padStart(29) + "seed(S1)".padStart(14) + "seed(nach Alt.)".padStart(17),
);
let alleOk = true;
for (const z of zeilen) {
  // TIME-TRIAL IST DIE AUSNAHME, NICHT DER FEHLER: im Zeitfahren faellt waehrend des
  // Rennens kein rr() (Dokument 1.3) -- `seed` bewegt sich dort schon fuer die REFERENZ
  // (Probe A) nicht, ein unveraenderter `seed` ist also die ERWARTETE Bestaetigung genau
  // dieser Eigenschaft, kein Hinweis auf einen wirkungslosen Test. Fuer die anderen drei
  // MUSS sich `seed` bewegen, sonst haette Probe B gar nichts bewiesen.
  const seedErwartung = z.d === "time-trial" ? !z.seedBewegt : z.seedBewegt;
  const ok = z.s1Gleich && z.s2Gleich && seedErwartung;
  if (!ok) alleOk = false;
  console.log(
    z.d.padEnd(18) + String(z.heimZahl).padStart(5) + String(z.zweitlaeufe).padStart(9)
    + (z.s1Gleich ? "ja" : "NEIN — FEHLER").padStart(17)
    + (z.s2Gleich ? "ja" : "NEIN — FEHLER").padStart(17)
    + (z.seedBewegt ? "ja, bewegt sich" : (z.d === "time-trial" ? "nein (erwartet, kein rr())" : "NEIN (unerwartet)")).padStart(29)
    + String(z.seedNachB1).padStart(14) + String(z.seedNachAlternativ).padStart(17),
  );
}
console.log(
  "\nS1 bit-identisch: das soeben beendete Rennen aendert sich durch den Alternativ-Rechner nicht.",
);
console.log(
  "S2 bit-identisch: das NAECHSTE Rennen aendert sich nicht, obwohl `seed` zwischenzeitlich",
);
console.log(
  "einen anderen Wert hatte (s. die beiden letzten Spalten) — jedes bau(saat) ueberschreibt ihn",
);
console.log("unbedingt aus der eigenen Saat, bevor ein rr()-Aufruf etwas vom Rest liest.");
console.log(`\nGesamturteil: ${alleOk ? "ISOLATION NACHGEWIESEN" : "ISOLATION VERLETZT — NICHT MERGEN"}`);
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
if (!alleOk) process.exitCode = 1;

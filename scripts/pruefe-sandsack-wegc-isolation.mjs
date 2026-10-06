// ===================================================================================
// ISOLATIONSNACHWEIS GEWICHTHEBEN SANDSACK WEG C (06.10., Stufe 3 des parallelen Formats,
// docs/design/gewichtheben-sandsack-wegc-parallel-stufe3-sichtbarkeit-06-10.md).
//
// SHA-256 je Flag ueber die drei Mess-Einstiege, die die Vorgaenger-Runden fuer den
// Isolationsnachweis benutzt haben: spieleBuehneHeben (der Liga-Pfad), spieleSandsackFinale
// (Paket 1) und spieleSandsackWegC (alle Weg-C-Varianten, Flag >= 1). Kaderfamilie live-save
// (5 Paarungen) x 4 Saaten, Formkarten/Mutatoren wie disziplinProbe() je Spiel.
//
//   node scripts/pruefe-sandsack-wegc-isolation.mjs [--flags=0,1,...,10] [--seite=pfad/battle-mode.html]
//
// --seite zeigt auf eine ANDERE Kopie der Seite (z. B. den Basisstand aus `git archive`), damit
// sich beide Stände mit demselben Befehl vergleichen lassen. Ausgabe: je Flag ein Hash (die
// ersten 16 Hex-Zeichen) und am Ende ein Gesamthash.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seitenArg = process.argv.find((a) => a.startsWith("--seite="));
const SEITE = pathToFileURL(seitenArg ? path.resolve(seitenArg.slice(8)) : path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const FLAGS = ((process.argv.find((a) => a.startsWith("--flags=")) || "--flags=0,1,2,3,4,5,6,7,8,9,10")
  .slice(8).split(",").filter(Boolean).map(Number));
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const SAATEN = [1337, 1337 + 7919, 1337 + 2 * 7919, 1337 + 3 * 7919];
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackWegC, null, { timeout: 30000 });
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (!geladen) throw new Error("Kaderfamilie fehlt: " + KADERFAMILIE_PFAD);
  const familie = geladen.familie;
  console.log(`Isolation — ${SEITE}\n${familie.length} Paarungen x ${SAATEN.length} Saaten, Flags ${FLAGS.join(",")}`);
  const gesamt = createHash("sha256");
  for (const flag of FLAGS) {
    const h = createHash("sha256");
    for (const v of familie) {
      await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
      for (let i = 0; i < SAATEN.length; i++) {
        const erg = await seite.evaluate(([fl, saat, fs, ms]) => {
          const vorher = window.__arena.buehneFlags().gewichthebenSandsack;
          window.__arena.buehneFlags({ gewichthebenSandsack: fl });
          try {
            return {
              heben: window.__arena.spieleBuehneHeben("gewichtheben", saat),
              finale: window.__arena.spieleSandsackFinale("gewichtheben", saat),
              wegc: fl >= 1 ? window.__arena.spieleSandsackWegC("gewichtheben", saat, { formSaat: fs, mutatorSaat: ms, flag: fl }) : null,
            };
          } finally { window.__arena.buehneFlags({ gewichthebenSandsack: vorher }); }
        }, [flag, SAATEN[i], 20260823 + i * 104729, 20260823 + i * 15485863]);
        h.update(JSON.stringify(erg));
      }
    }
    const hex = h.digest("hex");
    gesamt.update(hex);
    console.log(`Flag ${String(flag).padStart(2)}: ${hex.slice(0, 16)}`);
  }
  console.log(`gesamt : ${gesamt.digest("hex").slice(0, 16)}`);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  await browser.close();
}

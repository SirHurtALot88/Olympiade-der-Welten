// BESTANDSAUFNAHME HOCKEY — was der heutige Hockey-Motor tatsaechlich liefert.
//
// Geschrieben fuer docs/design/hockey-rollout-plan.md (Teil A). Es misst NICHTS neu und
// aendert NICHTS: alle drei Groessen kommen aus bereits vorhandenen, exportierten
// window.__arena-Funktionen. Der Sinn ist, dass die Zahlen im Plan reproduzierbar sind,
// statt aus einer Chatnachricht zitiert zu werden.
//
//   1. TORE JE SPIEL     — boxscoreSerie(d,n) gibt fuer jeden Lauf fsPunkte je Seite.
//                          Bei Hockey ist punkteNah=punkteFern=1, ein "Punkt" ist also
//                          genau ein Tor (FELDSPIEL_ART.hockey, battle-mode.engine.js).
//   2. SUB-SKILL-SPREIZUNG — feldspielSubskills(d) gibt die sieben Rezeptwerte je Spieler
//                          einer frisch gebauten Aufstellung. Ein Sub-Skill, dessen
//                          Spannweite ueber den zwoelf Spielern klein ist, kann keinen
//                          Archetyp tragen, egal wie sein Rezept aussieht.
//   3. EREIGNIS-BILANZ   — window.__arena.spiele(dId,saat) (neu seit PR #726) gibt das
//                          Ereignisprotokoll `fsZuege` mit heraus. Im Vorab-Durchlauf
//                          (bauFeldspiel, battle-mode.engine.js:4072 ff.) hat jeder Zug
//                          genau eine von vier Arten: "steal" (kein Abschluss zustande
//                          gekommen), "treffer", "rebound" (Abschluss daneben, eigenes
//                          Team sammelt auf) oder "block" (Abschluss abgewehrt). Daraus
//                          folgen unmittelbar Schuesse je Spiel, Schussquote und die
//                          Gegen-Quote — die drei Zahlen, an denen sich Hockey gegen
//                          echte NHL-Referenzwerte messen laesst.
//   4. Pp-ABWEICHUNG     — dieselbe Zahl wie scripts/messe-arena-einfluss.mjs, hier nur
//                          mitgefahren, damit ein Lauf alles auf einmal liefert.
//
// WAS ES BEWUSST NICHT MISST: Rangtreue (Spearman-rho), Rebound-Achsen, offen/bedraengt.
//
// STAND DIESES KOMMENTARS BEI DER BESTANDSAUFNAHME: dafuer gab es fuer Hockey keinen
// Zugang — window.__arena.basketballProbe war hart auf MOTOREN.basketball/
// FELDSPIEL_ART.basketball verdrahtet. Das war ein Befund, kein Versaeumnis dieses
// Skripts, und es wurde im Plan zu PR 0 gemacht (Teil D bzw. H.8).
//
// INZWISCHEN ERLEDIGT: die Sonde heisst window.__arena.feldspielProbe(dId, opt) und
// laeuft fuer jede Feldspiel-Disziplin; die Rangtreue fuer Hockey holt man mit
//     node scripts/miss-feldspiel-rangtreue.mjs hockey 24 6
// Was der Vorab-Durchlauf nach wie vor NICHT erzeugt (fsLive.amBall, u.deckt, e.tier,
// e.deckerAbstandBeiWurf), meldet die Sonde jetzt als `fehlend`-Liste, statt Nullen
// auszugeben, die wie Messwerte aussehen. Die beiden Rollenproben V und S bleiben
// deshalb bis zur Live-Migration (PR 3b) leer — die Rangtreue selbst nicht.
//
// Aufruf (aus dem Repo-Wurzelverzeichnis):
//   node scripts/miss-hockey-bestand.mjs [disziplin] [laeufe] [pfad-zur-html]
//   node scripts/miss-hockey-bestand.mjs hockey 48
//   node scripts/miss-hockey-bestand.mjs football 48        (zum Vergleich)
//   node scripts/miss-hockey-bestand.mjs basketball 8 --ohne-einfluss
//
// `--ohne-einfluss` laesst Teil 3 aus. Fuer Basketball ist das noetig, nicht bequem: die
// Live-Engine rechnet 360 Simulationssekunden je Spiel, und einflussVon() spielt
// (12 Attribute + 1) x 12 Spieler x n Spiele durch — bei n=8 sind das ueber 1200 volle
// Basketballspiele. Die Endstaende allein sind n Spiele.
//
// ACHTUNG, WORKTREE-FALLE: scripts/messe-arena-einfluss.mjs hat den Pfad zur Mockup-Datei
// als ABSOLUTES Literal auf den Haupt-Checkout stehen. Wer in einem Worktree arbeitet und
// den dritten Aufrufwert weglaesst, misst dort die Datei des Haupt-Checkouts, nicht die
// eigene. Dieses Skript loest den Pfad deshalb relativ zu sich selbst auf.

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const argumente = process.argv.slice(2).filter((a) => a !== "--ohne-einfluss");
const ohneEinfluss = process.argv.includes("--ohne-einfluss");
const disziplin = argumente[0] || "hockey";
const laeufe = Number(argumente[1] || 48);
const seitenPfad = argumente[2]
  ? resolve(argumente[2])
  : resolve(hier, "..", "public", "mockups", "battle-mode.html");

if (!existsSync(seitenPfad)) {
  console.error("Mockup nicht gefunden: " + seitenPfad);
  process.exit(1);
}

const rund = (x, k = 2) => (x == null ? null : Math.round(x * 10 ** k) / 10 ** k);
const mittel = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(pathToFileURL(seitenPfad).href, { waitUntil: "domcontentloaded" });
await seite.waitForFunction(() => Boolean(window.__arena && window.__arena.boxscoreSerie), null, { timeout: 30000 });

const motoren = await seite.evaluate(() => window.__arena.motoren());
if (!motoren.includes(disziplin)) {
  console.error(`Fuer "${disziplin}" ist kein Motor angemeldet. Vorhanden: ${motoren.join(", ")}`);
  await browser.close();
  process.exit(1);
}

console.log(`Bestandsaufnahme ${disziplin} — ${laeufe} Laeufe, Quelle: ${seitenPfad}\n`);

// --- 1. Endstaende --------------------------------------------------------------
const serie = await seite.evaluate(
  ([d, n]) => window.__arena.boxscoreSerie(d, n),
  [disziplin, laeufe],
);
const alle = [...serie.punkteTeamL, ...serie.punkteTeamR];
const gesamt = serie.punkteTeamL.map((x, i) => x + serie.punkteTeamR[i]);
const verteilung = new Map();
for (const x of alle) verteilung.set(x, (verteilung.get(x) || 0) + 1);

console.log("ENDSTAENDE");
console.log(`  Tore je Team und Spiel   Mittel ${rund(mittel(alle), 2)}   Spanne ${Math.min(...alle)}-${Math.max(...alle)}`);
console.log(`  Tore je Spiel (beide)    Mittel ${rund(mittel(gesamt), 2)}   Spanne ${Math.min(...gesamt)}-${Math.max(...gesamt)}`);
console.log(`  Siege L/R/Unentschieden  ${serie.siegeL}/${serie.siegeR}/${serie.unentschieden}` +
  `  (Unentschieden-Anteil ${rund((serie.unentschieden / serie.n) * 100, 1)} %)`);
console.log(
  "  Verteilung Tore je Team  " +
    [...verteilung.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  "),
);

// --- 2. Sub-Skill-Spreizung -----------------------------------------------------
const subs = await seite.evaluate((d) => window.__arena.feldspielSubskills(d), disziplin);
console.log("\nSUB-SKILLS einer frisch gebauten Aufstellung (Saat 1337, beide Seiten)");
const schluessel = Object.keys(subs[0]).filter((k) => k !== "n" && k !== "side");
console.log("Sub-Skill        min   max  Spanne  Mittel");
for (const k of schluessel) {
  const werte = subs.map((s) => s[k]);
  console.log(
    k.padEnd(15) +
      String(Math.min(...werte)).padStart(5) +
      String(Math.max(...werte)).padStart(6) +
      String(Math.max(...werte) - Math.min(...werte)).padStart(8) +
      String(rund(mittel(werte), 1)).padStart(8),
  );
}

// --- 3. Ereignis-Bilanz aus dem Protokoll ---------------------------------------
const hatSpiele = await seite.evaluate(() => typeof window.__arena.spiele === "function");
if (!hatSpiele) {
  console.log("\nEREIGNIS-BILANZ uebersprungen: window.__arena.spiele() fehlt (Stand vor PR #726).");
} else {
  const bilanz = await seite.evaluate(
    ([d, n]) => {
      const arten = {};
      const jeSeite = [{}, {}];
      for (let i = 0; i < n; i++) {
        // Dieselbe SAATFOLGE wie einflussVon()/boxscoreSerie() (1337 + i*7919), aber
        // NICHT dieselbe Stichprobe: boxscoreSerie zieht vor jedem Lauf zusaetzlich neue
        // Formkarten (zieheFormkarten(20260823 + i*104729)), spiele() tut das nicht. Die
        // Tore aus Teil 1 und die Treffer aus diesem Teil weichen deshalb um wenige
        // Prozent voneinander ab — beides sind gueltige Stichproben derselben Mechanik,
        // aber es sind nicht dieselben Partien. Bewusst so gelassen, statt hier eine
        // zweite Formkarten-Steuerung nachzubauen, die es von aussen nicht gibt.
        const g = window.__arena.spiele(d, 1337 + i * 7919);
        for (const e of g.protokoll || []) {
          arten[e.art] = (arten[e.art] || 0) + 1;
          const s = jeSeite[e.seite] || (jeSeite[e.seite] = {});
          s[e.art] = (s[e.art] || 0) + 1;
        }
      }
      return { arten, jeSeite };
    },
    [disziplin, laeufe],
  );
  const a = bilanz.arten;
  const je = (k) => (a[k] || 0) / laeufe / 2; // je Spiel UND Seite
  const schuesse = je("treffer") + je("rebound") + je("block");
  const zuege = schuesse + je("steal");
  console.log("\nEREIGNIS-BILANZ je Spiel und Seite (aus dem Protokoll von spiele())");
  console.log(`  Zuege gesamt        ${rund(zuege, 2)}   (Kontingent laut Rezepttabelle: zuegeJeSeite)`);
  console.log(`  davon Ballverlust   ${rund(je("steal"), 2)}   (${rund((je("steal") / zuege) * 100, 1)} % aller Zuege)`);
  console.log(`  Abschluesse         ${rund(schuesse, 2)}`);
  console.log(`    Treffer           ${rund(je("treffer"), 2)}   Trefferquote ${rund((je("treffer") / schuesse) * 100, 1)} %`);
  console.log(`    abgewehrt/Block   ${rund(je("block"), 2)}   ${rund((je("block") / schuesse) * 100, 1)} %`);
  console.log(`    Abpraller         ${rund(je("rebound"), 2)}   ${rund((je("rebound") / schuesse) * 100, 1)} %`);
  console.log(`  Gegen-Quote (1-Trefferquote) ${rund((1 - je("treffer") / schuesse) * 100, 1)} %`);
}

// --- 4. Pp-Abweichung -----------------------------------------------------------
if (ohneEinfluss) {
  console.log("\nEINFLUSS uebersprungen (--ohne-einfluss).");
} else {
  const e = await seite.evaluate(([d, n]) => window.__arena.einflussVon(d, n), [disziplin, laeufe]);
  const matrix = await seite.evaluate((d) => window.__arena.matrix(d), disziplin);
  console.log(`\nEINFLUSS — Abweichung zur Matrix: ${e.abweichungPp} Pp (${e.laeufe} Laeufe, Anhebung +${e.anhebung})`);
  console.log("Attribut          Anteil   Matrix   Differenz");
  for (const r of e.reihen) {
    const soll = matrix[r.attribut] || 0;
    const diff = r.anteil - soll;
    console.log(
      `${r.attribut.padEnd(15)} ${String(r.anteil).padStart(6)} % ${String(soll).padStart(6)}   ` +
        `${(diff > 0 ? "+" : "") + diff.toFixed(1)}`,
    );
  }
}

console.log("\nSeitenfehler:", seitenfehler.length ? seitenfehler.slice(0, 3) : "keine");
await browser.close();

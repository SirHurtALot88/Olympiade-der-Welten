// ===================================================================================
// HOCKEY-ARCHETYPEN-PROBE — bildet der Motor Sniper, Playmaker, Verteidiger und
// Torwart tatsaechlich als das ab, was sie sein sollen?
//
// Vier Chris-Archetypen, vier eigene Proben, alle gegen den ECHTEN Kader gemessen
// (feldspielProbe("hockey", ...), derselbe Weg wie scripts/miss-losen-puck-quelle.mjs
// und scripts/miss-rangtreue-nach-rolle.mjs). Keine synthetische Population — die vier
// Rollen sollen sich im bestehenden Kader wiederfinden, ueber ihre mitgelieferten
// Sub-Skill-Werte (u.AUFBAU/SCHUSS_NAH/SCHUSS_FERN/ABWEHR/...).
//
// Methodik uebernommen aus docs/design/battle-mode-nba2k-modell-plan.md, Abschnitte
// "Rollenprobe V" und "Rollenprobe S":
//   * Spearman ueber DURCHSCHNITTSRAENGE (Pearson auf den Raengen), nicht die
//     6*Sum(d^2)-Kurzformel — Bindungen (mehrere Spieler mit Wert 0) sind haeufig.
//   * Rollenprobe V (Verteidiger macht seinen Mann fertig): paarweise je Angreifer,
//     GEGEN welchen Decker er spielte (Terzile stark/schwach), nur wenn er in BEIDEN
//     Eimern mindestens 3 Spiele hat.
//   * Rollenprobe S (unbewachter Schuetze trifft): Tier-Isolierung ist ZWINGEND — eine
//     rohe Differenz ueber alle Distanzen mischt die Wurfdistanz mit der Bedraengnis und
//     liest oft das falsche Vorzeichen (in Basketball nachgewiesen). Hier statt "offen
//     gegen bedraengt" die analoge Frage "hoher Schuss-Skill gegen niedriger", aber
//     GENAUSO tier-isoliert: SCHUSS_NAH zaehlt nur auf dunk+nah (die Naeh-Tiers), SCHUSS_FERN
//     nur auf mit+fern — exakt die Aufteilung, die schussSkillFuer() im Motor selbst
//     schon trifft. Die vier Tier-Labels (dunk/nah/mit/fern) sind Basketball-Namen, tragen
//     bei Hockey aber HOCKEYS EIGENE Radien: klassifiziereWurfdistanz() verzweigt bei
//     istHockey() auf HK_RADIUS_ABSTAUBER/SLOT/HOCHSLOT/MAX (battle-mode.engine.js,
//     ~Zeile 4232) statt auf Basketballs DUNK_RADIUS/KORB_NAH_RADIUS/DREIER_RADIUS/
//     FERN_RADIUS_MAX — die Tier-Zuordnung im Wurfprotokoll ist also schon die richtige.
//
// Aufruf:
//   node scripts/miss-hockey-archetypen.mjs [spiele]
//   node scripts/miss-hockey-archetypen.mjs 40
//
// Reine Messung, kein Eingriff an Rezept oder Mechanik.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITENPFAD = path.join(WURZEL, "public/mockups/battle-mode.html");
const SEITE = pathToFileURL(SEITENPFAD).href;
const SPIELE = Number(process.argv[2] || 40);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

if (!existsSync(SEITENPFAD)) {
  console.error("Mockup nicht gefunden: " + SEITENPFAD);
  process.exit(1);
}

// -----------------------------------------------------------------------------------
// Spearman ueber Durchschnittsraenge, Zeichen fuer Zeichen wie in
// miss-feldspiel-rangtreue.mjs — dieselbe Begruendung: Bindungen sind hier die Regel
// (0 Assists, 0 Tore, gleicher SCHUSS_NAH-Wert innerhalb einer Formkarten-Saat), nicht
// die Ausnahme.
// -----------------------------------------------------------------------------------
function raenge(werte) {
  const idx = werte.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
  const r = new Array(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].w === idx[i].w) j++;
    const mittelRang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k].i] = mittelRang;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length;
  if (n < 2) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let za = 0, zb = 0, zab = 0;
  for (let i = 0; i < n; i++) {
    za += (a[i] - ma) ** 2;
    zb += (b[i] - mb) ** 2;
    zab += (a[i] - ma) * (b[i] - mb);
  }
  if (za === 0 || zb === 0) return null;
  return zab / Math.sqrt(za * zb);
}
const spearman = (a, b) => pearson(raenge(a), raenge(b));
const mittel = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const rund = (x, k = 3) => (x == null ? null : Math.round(x * 10 ** k) / 10 ** k);
const anz = (x, k = 1) => (x == null ? "—" : x.toFixed(k));

// HK_TW_REF: dieselbe Konstante wie feldspielWert() in battle-mode.engine.js (~Zeile
// 5149) — die gemessene Fangquote unserer Liga, gegen die GSAA gerechnet wird. Bewusst
// hier dupliziert statt importiert (das Skript hat keinen Zugriff auf Modul-internes),
// aber Zeichen fuer Zeichen derselbe Wert.
const HK_TW_REF = 0.844;

// -----------------------------------------------------------------------------------
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const start = Date.now();
const daten = await seite.evaluate((n) => window.__arena.feldspielProbe("hockey", { n }), SPIELE);
await browser.close();
const sekunden = Math.round((Date.now() - start) / 1000);

console.log(`Hockey-Archetypen-Probe — ${daten.spiele.length} Spiele, ${sekunden}s, Quelle: ${SEITENPFAD}\n`);
if (!daten.live) {
  console.log("ACHTUNG: \"hockey\" faehrt hier den VORAB-Pfad, nicht den Live-Motor.");
  console.log("Die Manndeckung, der Deckerabstand beim Wurf und die Wurfdistanzstufen fehlen dann —");
  console.log("die Proben Sniper und Verteidiger koennen so nicht laufen. Fehlend:");
  for (const f of daten.fehlend) console.log("  - " + f);
  process.exit(1);
}

const alleSpiele = daten.spiele;

// -----------------------------------------------------------------------------------
// SPIELER-AGGREGAT ueber alle Spiele — derselbe Kader in jedem Lauf (SQUAD/OPP sind
// fest, s. bauFeldspiel: ohne gesetzte Aufstellung sind es immer die besten n nach
// Disziplinwert), deshalb ist eine Aggregation ueber Spiele hier sinnvoll und nicht nur
// Rauschen ueber wechselnde Spieler.
// -----------------------------------------------------------------------------------
const jePlayer = new Map();
for (const g of alleSpiele) {
  for (const p of g.spieler) {
    if (!jePlayer.has(p.n)) {
      jePlayer.set(p.n, {
        n: p.n, side: p.side, spiele: 0, torwartSpiele: 0, eig: 0,
        punkte: 0, assists: 0, saves: 0, gegentore: 0,
        AUFBAU: 0, TEAMGEIST: 0, SCHUSS_NAH: 0, SCHUSS_FERN: 0,
        nahV: 0, nahT: 0, fernV: 0, fernT: 0,
      });
    }
    const z = jePlayer.get(p.n);
    z.spiele++; z.eig += p.eig; z.torwartSpiele += p.torwart ? 1 : 0;
    z.punkte += p.punkte; z.assists += p.assists;
    z.saves += p.saves || 0; z.gegentore += p.gegentore || 0;
    z.AUFBAU += p.AUFBAU || 0; z.TEAMGEIST += p.TEAMGEIST || 0;
    z.SCHUSS_NAH += p.SCHUSS_NAH || 0; z.SCHUSS_FERN += p.SCHUSS_FERN || 0;
    const t = p.fgTier || {};
    for (const k of ["dunk", "nah"]) if (t[k]) { z.nahV += t[k].offenV + t[k].engV; z.nahT += t[k].offenT + t[k].engT; }
    for (const k of ["mit", "fern"]) if (t[k]) { z.fernV += t[k].offenV + t[k].engV; z.fernT += t[k].offenT + t[k].engT; }
  }
}
const spieler = [...jePlayer.values()].map((z) => ({
  ...z,
  eig: z.eig / z.spiele,
  torwart: z.torwartSpiele > z.spiele / 2,
  punkteJeSpiel: z.punkte / z.spiele,
  assistsJeSpiel: z.assists / z.spiele,
  AUFBAU: z.AUFBAU / z.spiele,
  TEAMGEIST: z.TEAMGEIST / z.spiele,
  SCHUSS_NAH: z.SCHUSS_NAH / z.spiele,
  SCHUSS_FERN: z.SCHUSS_FERN / z.spiele,
  nahFG: z.nahV >= 1 ? z.nahT / z.nahV : null,
  fernFG: z.fernV >= 1 ? z.fernT / z.fernV : null,
}));
const feld = spieler.filter((s) => !s.torwart);
const tw = spieler.filter((s) => s.torwart);

console.log(`Kader in der Probe: ${spieler.length} Spieler (${feld.length} Feldspieler, ${tw.length} Torwaerter), ` +
  `derselbe Kader in jedem Spiel.\n`);

// ===================================================================================
// 1) SNIPER — hoher SCHUSS_NAH/SCHUSS_FERN soll UEBERDURCHSCHNITTLICH TREFFEN, nicht
//    nur werfen. Tier-isoliert: SCHUSS_NAH nur gegen die Naeh-Tiers (dunk+nah), SCHUSS_FERN
//    nur gegen die Fern-Tiers (mit+fern) — genau die Aufteilung aus schussSkillFuer().
// ===================================================================================
const MIN_ATTEMPTS = 8;
function tercileVergleich(liste, skillKey, vKey, tKey) {
  if (liste.length < 3) return null;
  const sortiert = [...liste].sort((a, b) => a[skillKey] - b[skillKey]);
  const k = Math.max(1, Math.floor(sortiert.length / 3));
  const unten = sortiert.slice(0, k), oben = sortiert.slice(sortiert.length - k);
  const quote = (arr) => {
    const v = arr.reduce((s, x) => s + x[vKey], 0), t = arr.reduce((s, x) => s + x[tKey], 0);
    return v >= 3 ? (t / v) * 100 : null;
  };
  const qUnten = quote(unten), qOben = quote(oben);
  return {
    n: liste.length, k,
    unten: unten.map((x) => `${x.n} (${rund(x[skillKey], 1)})`),
    oben: oben.map((x) => `${x.n} (${rund(x[skillKey], 1)})`),
    quoteUnten: rund(qUnten, 1), quoteOben: rund(qOben, 1),
    dPp: qUnten != null && qOben != null ? rund(qOben - qUnten, 1) : null,
  };
}
const nahKandidaten = feld.filter((s) => s.nahV >= MIN_ATTEMPTS);
const fernKandidaten = feld.filter((s) => s.fernV >= MIN_ATTEMPTS);
const rhoSniperNah = spearman(nahKandidaten.map((s) => s.SCHUSS_NAH), nahKandidaten.map((s) => s.nahFG));
const rhoSniperFern = spearman(fernKandidaten.map((s) => s.SCHUSS_FERN), fernKandidaten.map((s) => s.fernFG));
const tercNah = tercileVergleich(nahKandidaten, "SCHUSS_NAH", "nahV", "nahT");
const tercFern = tercileVergleich(fernKandidaten, "SCHUSS_FERN", "fernV", "fernT");

console.log("=".repeat(88));
console.log("1) SNIPER — hoher SCHUSS_NAH/SCHUSS_FERN soll ueberdurchschnittlich TREFFEN");
console.log("=".repeat(88));
console.log(`Naeh-Tiers (dunk+nah, Radius < HK_RADIUS_SLOT): n=${nahKandidaten.length} Spieler mit >= ${MIN_ATTEMPTS} Versuchen`);
console.log(`  Spearman(SCHUSS_NAH, Trefferquote)   rho = ${anz(rhoSniperNah, 3)}`);
if (tercNah) {
  console.log(`  Terzil unten (${tercNah.unten.join(", ")}): ${anz(tercNah.quoteUnten)}%   ` +
    `Terzil oben (${tercNah.oben.join(", ")}): ${anz(tercNah.quoteOben)}%   dPp = ${tercNah.dPp == null ? "—" : (tercNah.dPp >= 0 ? "+" : "") + tercNah.dPp}`);
} else console.log("  zu wenige Spieler fuer ein Terzil");
console.log(`Fern-Tiers (mit+fern, Radius < HK_RADIUS_MAX): n=${fernKandidaten.length} Spieler mit >= ${MIN_ATTEMPTS} Versuchen`);
console.log(`  Spearman(SCHUSS_FERN, Trefferquote)  rho = ${anz(rhoSniperFern, 3)}`);
if (tercFern) {
  console.log(`  Terzil unten (${tercFern.unten.join(", ")}): ${anz(tercFern.quoteUnten)}%   ` +
    `Terzil oben (${tercFern.oben.join(", ")}): ${anz(tercFern.quoteOben)}%   dPp = ${tercFern.dPp == null ? "—" : (tercFern.dPp >= 0 ? "+" : "") + tercFern.dPp}`);
} else console.log("  zu wenige Spieler fuer ein Terzil");
console.log("Ziel: beide rho deutlich > 0, dPp positiv (oben trifft haeufiger als unten).");

// ===================================================================================
// 2) PLAYMAKER — hoher AUFBAU/TEAMGEIST soll UEBERDURCHSCHNITTLICH VORLAGEN liefern,
//    nicht nur Tore. Die eigentliche Probe: korreliert AUFBAU (bzw. TEAMGEIST) mit
//    Assists staerker als mit eigenen Toren?
// ===================================================================================
const rhoAufbauAssists = spearman(feld.map((s) => s.AUFBAU), feld.map((s) => s.assistsJeSpiel));
const rhoAufbauPunkte = spearman(feld.map((s) => s.AUFBAU), feld.map((s) => s.punkteJeSpiel));
const rhoTeamgeistAssists = spearman(feld.map((s) => s.TEAMGEIST), feld.map((s) => s.assistsJeSpiel));
const rhoTeamgeistPunkte = spearman(feld.map((s) => s.TEAMGEIST), feld.map((s) => s.punkteJeSpiel));

console.log("\n" + "=".repeat(88));
console.log("2) PLAYMAKER — hoher AUFBAU/TEAMGEIST soll ueberdurchschnittlich VORLAGEN liefern");
console.log("=".repeat(88));
console.log(`Feldspieler n=${feld.length}\n`);
console.log(`  Spearman(AUFBAU,    Assists/Spiel)  rho = ${anz(rhoAufbauAssists, 3)}`);
console.log(`  Spearman(AUFBAU,    Tore/Spiel)     rho = ${anz(rhoAufbauPunkte, 3)}`);
console.log(`  Delta (Assists minus Tore)                 ${anz(rhoAufbauAssists != null && rhoAufbauPunkte != null ? rhoAufbauAssists - rhoAufbauPunkte : null, 3)}`);
console.log(`  Spearman(TEAMGEIST, Assists/Spiel)  rho = ${anz(rhoTeamgeistAssists, 3)}`);
console.log(`  Spearman(TEAMGEIST, Tore/Spiel)     rho = ${anz(rhoTeamgeistPunkte, 3)}`);
console.log(`  Delta (Assists minus Tore)                 ${anz(rhoTeamgeistAssists != null && rhoTeamgeistPunkte != null ? rhoTeamgeistAssists - rhoTeamgeistPunkte : null, 3)}`);
console.log("Ziel: AUFBAU/TEAMGEIST haengen STAERKER an Assists als an eigenen Toren (Delta > 0) —");
console.log("sonst ist die Rolle nicht sauber von einem generischen Offensiv-Skill getrennt.");

// ===================================================================================
// 3) VERTEIDIGER — Rollenprobe V: der bewachte Gegner soll schwaecher werden (weniger
//    Torquote, weniger Tore, weniger Schuesse), gepaart je Angreifer, nur mit >= 3
//    Spielen in BEIDEM Terzil (stark/schwach Decker).
// ===================================================================================
const abwehrWerte = [];
for (const g of alleSpiele) for (const p of g.spieler) if (p.deckerAbwehr != null) abwehrWerte.push(p.deckerAbwehr);
abwehrWerte.sort((a, b) => a - b);
const qAbwehr = (t) => abwehrWerte[Math.min(abwehrWerte.length - 1, Math.floor(abwehrWerte.length * t))];
const grenzeSchwach = qAbwehr(1 / 3), grenzeStark = qAbwehr(2 / 3);

const jeAngreifer = new Map();
for (const g of alleSpiele) {
  for (const p of g.spieler) {
    if (p.deckerAbwehr == null) continue;
    const eimer = p.deckerAbwehr >= grenzeStark ? "stark" : p.deckerAbwehr <= grenzeSchwach ? "schwach" : null;
    if (!eimer) continue;
    if (!jeAngreifer.has(p.n)) jeAngreifer.set(p.n, { stark: [], schwach: [] });
    jeAngreifer.get(p.n)[eimer].push(p);
  }
}
const dFg = [], dTore = [], dSchuesse = [];
const angreiferDetails = [];
for (const [name, e] of jeAngreifer) {
  if (e.stark.length < 3 || e.schwach.length < 3) continue;
  const fgQ = (liste) => {
    const v = liste.reduce((s, p) => s + p.fga, 0), t = liste.reduce((s, p) => s + p.fgm, 0);
    return v >= 3 ? t / v : null;
  };
  const proSpiel = (liste, k) => liste.reduce((s, p) => s + p[k], 0) / liste.length;
  const fs = fgQ(e.stark), fw = fgQ(e.schwach);
  if (fs != null && fw != null) dFg.push((fs - fw) * 100);
  const ts = proSpiel(e.stark, "punkte"), tsw = proSpiel(e.schwach, "punkte");
  const dToreProzent = tsw > 0 ? (ts / tsw - 1) * 100 : null;
  if (dToreProzent != null) dTore.push(dToreProzent);
  const ss = proSpiel(e.stark, "fga"), sw = proSpiel(e.schwach, "fga");
  const dSchuesseProzent = sw > 0 ? (ss / sw - 1) * 100 : null;
  if (dSchuesseProzent != null) dSchuesse.push(dSchuesseProzent);
  angreiferDetails.push({ name, nStark: e.stark.length, nSchwach: e.schwach.length, fs, fw, ts, tsw, ss, sw });
}

console.log("\n" + "=".repeat(88));
console.log("3) VERTEIDIGER — Rollenprobe V: bewachter Gegner wird schwaecher (gepaart je Angreifer)");
console.log("=".repeat(88));
console.log(`ABWEHR-Terzilgrenzen: schwach <= ${rund(grenzeSchwach, 1)}, stark >= ${rund(grenzeStark, 1)} ` +
  `(n=${abwehrWerte.length} Decker-Zuteilungen)`);
console.log(`Angreifer mit >= 3 Spielen in BEIDEN Eimern: ${angreiferDetails.length}\n`);
for (const a of angreiferDetails) {
  console.log(`  ${a.name.padEnd(24)} stark n=${a.nStark}  schwach n=${a.nSchwach}   ` +
    `FG% ${a.fw != null ? (a.fw * 100).toFixed(1) : "—"}->${a.fs != null ? (a.fs * 100).toFixed(1) : "—"}   ` +
    `Tore/Sp ${a.tsw.toFixed(2)}->${a.ts.toFixed(2)}   Schuesse/Sp ${a.sw.toFixed(2)}->${a.ss.toFixed(2)}`);
}
console.log(`\n  dFG%       (Mittel stark minus schwach)      = ${anz(mittel(dFg), 1)} Pp   Ziel: <= -8`);
console.log(`  dTore%     (Mittel stark/schwach - 1, in %)   = ${anz(mittel(dTore), 1)} %    Ziel: <= -25`);
console.log(`  dSchuesse% (Mittel stark/schwach - 1, in %)   = ${anz(mittel(dSchuesse), 1)} %    Ziel: deutlich negativ`);

// ===================================================================================
// 4) TORWART — GSAA soll mit der Eignung korrelieren, getrennt von den Feldspielern
//    gemessen. Da Team-Aufstellung ohne gesetzte Kaderposition IMMER dieselben Spieler
//    liefert (bauFeldspiel: beste n nach Disziplinwert), gibt es je Seite genau EINEN
//    festen Torwart ueber alle Spiele hinweg — die Probe hat also nur zwei Identitaeten,
//    dafuer aber SPIELE Beobachtungen je Identitaet. Deshalb zusaetzlich zur gepoolten
//    Korrelation der gepaarte Pro-Spiel-Vergleich: hat der Torwart mit der hoeheren
//    Eignung in DEMSELBEN Spiel auch die bessere GSAA?
// ===================================================================================
const alleGoalieZeilen = [];
const paarDiff = [];
for (const g of alleSpiele) {
  const tws = g.spieler.filter((p) => p.torwart);
  for (const p of tws) {
    const schuesse = p.saves + p.gegentore;
    const gsaa = schuesse * (1 - HK_TW_REF) - p.gegentore;
    alleGoalieZeilen.push({ n: p.n, side: p.side, eig: p.eig, gsaa, saves: p.saves, gegentore: p.gegentore });
  }
  if (tws.length === 2) {
    const [a, b] = tws;
    const gsaaA = (a.saves + a.gegentore) * (1 - HK_TW_REF) - a.gegentore;
    const gsaaB = (b.saves + b.gegentore) * (1 - HK_TW_REF) - b.gegentore;
    if (a.eig !== b.eig) {
      const hoeherIstA = a.eig > b.eig;
      paarDiff.push(hoeherIstA ? gsaaA - gsaaB : gsaaB - gsaaA);
    }
  }
}
const rhoTorwart = spearman(alleGoalieZeilen.map((z) => z.eig), alleGoalieZeilen.map((z) => z.gsaa));
const gewinnrate = paarDiff.length ? paarDiff.filter((d) => d > 0).length / paarDiff.length : null;

const jeGoalie = new Map();
for (const z of alleGoalieZeilen) {
  if (!jeGoalie.has(z.n)) jeGoalie.set(z.n, { n: z.n, side: z.side, eig: 0, gsaa: 0, saves: 0, gegentore: 0, k: 0 });
  const o = jeGoalie.get(z.n);
  o.eig += z.eig; o.gsaa += z.gsaa; o.saves += z.saves; o.gegentore += z.gegentore; o.k++;
}

console.log("\n" + "=".repeat(88));
console.log("4) TORWART — GSAA soll mit der Eignung korrelieren (getrennt von den Feldspielern)");
console.log("=".repeat(88));
console.log(`Torwart-Spiel-Zeilen n=${alleGoalieZeilen.length} (${alleSpiele.length} Spiele x bis zu 2 Torwaerter je Spiel)\n`);
console.log("Identitaet             Seite   Spiele  Eig(mittel)  GSAA(mittel)  Saves/Sp  Gegentore/Sp");
for (const o of jeGoalie.values()) {
  console.log(`  ${o.n.padEnd(22)}${String(o.side).padStart(5)}${String(o.k).padStart(9)}` +
    `${(o.eig / o.k).toFixed(1).padStart(13)}${(o.gsaa / o.k).toFixed(2).padStart(14)}` +
    `${(o.saves / o.k).toFixed(2).padStart(10)}${(o.gegentore / o.k).toFixed(2).padStart(14)}`);
}
console.log(`\n  Spearman(Eig, GSAA) gepoolt ueber alle Torwart-Spiel-Zeilen   rho = ${anz(rhoTorwart, 3)}`);
console.log(`  (Hinweis: nur ${jeGoalie.size} Torwart-Identitaeten insgesamt — der Kader liefert je Seite`);
console.log(`   immer denselben besten-PARADE-Spieler, s. bestimmeTorwaerter(). Die gepoolte Korrelation`);
console.log(`   testet deshalb effektiv "schneidet der eignungsstaerkere der zwei Torwaerter besser ab",`);
console.log(`   nicht eine Korrelation ueber viele verschiedene Torwaerter.)`);
console.log(`  Gepaarter Pro-Spiel-Vergleich: der Torwart mit der hoeheren Eignung hat in ${anz(gewinnrate != null ? gewinnrate * 100 : null, 1)}%`);
console.log(`  von ${paarDiff.length} Spielen auch die bessere GSAA (Ziel: deutlich > 50%).`);

console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 5).join(" | ") : "keine"));

if (process.argv.includes("--json")) {
  console.log("\nJSON " + JSON.stringify({
    spiele: alleSpiele.length,
    sniper: { rhoSniperNah, rhoSniperFern, tercNah, tercFern },
    playmaker: { rhoAufbauAssists, rhoAufbauPunkte, rhoTeamgeistAssists, rhoTeamgeistPunkte },
    verteidiger: { paare: angreiferDetails.length, dFg: mittel(dFg), dTore: mittel(dTore), dSchuesse: mittel(dSchuesse) },
    torwart: { rhoTorwart, gewinnrate, nSpiele: paarDiff.length, identitaeten: jeGoalie.size },
  }));
}

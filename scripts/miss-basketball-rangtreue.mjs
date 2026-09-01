// RANGTREUE — die neue Abnahmezahl fuer den Basketball-Live-Motor (NBA2K-Modell-Runde,
// 01.09., s. docs/design/battle-mode-nba2k-modell-plan.md).
//
// WARUM NOCH EINE ZAHL. Die bestehende Abnahme (messe-arena-einfluss.mjs, Pp-Abweichung)
// misst den DURCHSCHNITT ueber viele Spiele: "belohnt die Mechanik die Attribute, die die
// Disziplinmatrix bepreist?". Chris' Anforderung ist eine andere und eine strengere: JEDE
// Disziplin laeuft nur EINMAL pro Saison, also muss schon das EINZELNE simulierte Spiel den
// besseren Spieler vorne zeigen — wie in NBA 2K, wo ein Top-Spieler in einer Spielsimulation
// verlaesslich mit passenden Stats oben steht. Eine perfekte Pp-Zahl kann mit reinem
// Muenzwurf im Einzelspiel einhergehen; die Rangtreue schliesst genau diese Luecke.
//
// RANGTREUE = Spearman-rho( Impact-Rang im EINEN Spiel , Eignungs-Rang der Spieler ),
// gemittelt ueber n Spiele. Impact ist dieselbe Formel, die MOTOREN.basketball.wert()
// benutzt (Punkte + Assists + 1,2*Rebounds + 1,5*(Steals+Bloecke) - 0,8*Verluste), Eignung
// ist u.eig (Disziplinwert + Slot-Aufschlag + Form) — beides liegt schon vor, nichts neu
// erfunden. Gerechnet wird je Seite getrennt UND ueber alle 2n Spieler; die Seiten-Variante
// ist die ehrlichere (zwei Teams unterschiedlicher Staerke erzeugen sonst allein durch das
// Teamgefaelle ein hohes rho).
//
// ZWEI ROLLENPROBEN dazu, beide direkt aus Chris' Formulierung:
//   V  "ein 90er-Defender macht schwaechere Gegenspieler defensiv fertig"
//      -> Angreifer, die ein STARKER Verteidiger deckt, gegen dieselben Angreifer, die ein
//         SCHWACHER deckt (gepaart je Spieler, damit nicht die Spielerauswahl misst).
//   S  "ein unbewachter Top-Scorer erzielt entsprechend viele Punkte"
//      -> Feldwurfquote auf OFFENEN Wuerfen (Deckerabstand >= BEDRAENGT_RADIUS im
//         Abwurfmoment) gegen die auf BEDRAENGTEN.
//
// Aufruf (aus dem Repo-Wurzelverzeichnis):
//   node scripts/miss-basketball-rangtreue.mjs [spiele] [jeSeite,jeSeite,...] [pfad-zur-html]
//   node scripts/miss-basketball-rangtreue.mjs 24 6
//   node scripts/miss-basketball-rangtreue.mjs 24 2,4,6 /tmp/vorher.html
// Mit --json wird zusaetzlich der rohe Datensatz nach stdout geschrieben (fuer Vergleiche).

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const argumente = process.argv.slice(2).filter((a) => a !== "--json");
const alsJson = process.argv.includes("--json");
const spiele = Number(argumente[0] || 24);
const feldGroessen = String(argumente[1] || "6")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isFinite(x) && x > 0);
const seitenPfad = argumente[2]
  ? resolve(argumente[2])
  : resolve(hier, "..", "public", "mockups", "battle-mode.html");

if (!existsSync(seitenPfad)) {
  console.error("Mockup nicht gefunden: " + seitenPfad);
  process.exit(1);
}

// ---------------------------------------------------------------------------------
// Spearman-rho ueber Durchschnittsraenge (Bindungen kommen vor: zwei Spieler mit exakt
// 0 Impact sind in einem Spiel keine Seltenheit). Auf den Raengen ist Spearman genau
// Pearson — deshalb hier eine Rangfunktion plus eine Pearson-Korrelation statt der
// 6*d^2-Kurzformel, die Bindungen falsch behandelt.
// ---------------------------------------------------------------------------------
function raenge(werte) {
  const idx = werte.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
  const r = new Array(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].w === idx[i].w) j++;
    const mittel = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k].i] = mittel;
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

// ---------------------------------------------------------------------------------
function werteAus(daten) {
  const alleSpiele = daten.spiele;

  // --- Rangtreue -------------------------------------------------------------
  const rhoGesamt = [];
  const rhoSeite = [];
  for (const s of alleSpiele) {
    const eig = s.spieler.map((p) => p.eig);
    const imp = s.spieler.map((p) => p.wert);
    const r = spearman(imp, eig);
    if (r != null) rhoGesamt.push(r);
    for (const seite of [0, 1]) {
      const t = s.spieler.filter((p) => p.side === seite);
      const rs = spearman(t.map((p) => p.wert), t.map((p) => p.eig));
      if (rs != null) rhoSeite.push(rs);
    }
  }

  // --- Rollenprobe V: starker vs. schwacher Decker, gepaart je Angreifer -------
  const abwehrWerte = [];
  for (const s of alleSpiele) for (const p of s.spieler) if (p.deckerAbwehr != null) abwehrWerte.push(p.deckerAbwehr);
  abwehrWerte.sort((a, b) => a - b);
  const q = (t) => abwehrWerte[Math.min(abwehrWerte.length - 1, Math.floor(abwehrWerte.length * t))];
  const grenzeSchwach = q(1 / 3);
  const grenzeStark = q(2 / 3);

  const jeSpieler = new Map();
  for (const s of alleSpiele) {
    for (const p of s.spieler) {
      if (p.deckerAbwehr == null) continue;
      const eimer = p.deckerAbwehr >= grenzeStark ? "stark" : p.deckerAbwehr <= grenzeSchwach ? "schwach" : null;
      if (!eimer) continue;
      if (!jeSpieler.has(p.n)) jeSpieler.set(p.n, { stark: [], schwach: [] });
      jeSpieler.get(p.n)[eimer].push(p);
    }
  }
  const dFg = [], dPunkte = [];
  let paare = 0;
  for (const [, e] of jeSpieler) {
    if (e.stark.length < 3 || e.schwach.length < 3) continue;
    const fgQ = (liste) => {
      const v = liste.reduce((s, p) => s + p.fga, 0), t = liste.reduce((s, p) => s + p.fgm, 0);
      return v >= 3 ? t / v : null;
    };
    const pkt = (liste) => liste.reduce((s, p) => s + p.punkte, 0) / liste.length;
    const fs = fgQ(e.stark), fw = fgQ(e.schwach);
    if (fs != null && fw != null) dFg.push((fs - fw) * 100);
    const ps = pkt(e.stark), pw = pkt(e.schwach);
    if (pw > 0) dPunkte.push((ps / pw - 1) * 100);
    paare++;
  }

  // --- Rollenprobe S: offen vs. bedraengt, TIER-ISOLIERT ------------------------
  // Roh (ueber alle Distanzen gemischt) misst diese Differenz die Wurfdistanz, nicht die
  // Deckung: offene Wuerfe sind ueberwiegend Distanzwuerfe (GEO_BONUS.fern 0,075),
  // bedraengte ueberwiegend Wuerfe am Ring (GEO_BONUS.dunk 0,70). Deshalb wird je
  // Distanzstufe verglichen und anschliessend ueber die Stufen gemittelt, gewichtet mit
  // der kleineren der beiden Fallzahlen (eine Stufe mit 2 offenen Wuerfen soll das
  // Ergebnis nicht tragen). Die Rohzahl bleibt zur Kontrolle mit ausgewiesen.
  const stufen = ["dunk", "nah", "mit", "fern"];
  let oV = 0, oT = 0, eV = 0, eT = 0;
  const tierSumme = Object.fromEntries(stufen.map((t) => [t, { oV: 0, oT: 0, eV: 0, eT: 0 }]));
  const topEig = [...new Set(alleSpiele[0].spieler.map((p) => p.n))];
  const eigVon = new Map();
  for (const p of alleSpiele[0].spieler) eigVon.set(p.n, p.eig);
  topEig.sort((a, b) => eigVon.get(b) - eigVon.get(a));
  const spitze = new Set(topEig.slice(0, Math.max(1, Math.round(topEig.length / 4))));
  const tierSpitze = Object.fromEntries(stufen.map((t) => [t, { oV: 0, oT: 0, eV: 0, eT: 0 }]));
  for (const s of alleSpiele) {
    for (const p of s.spieler) {
      oV += p.fgOffenV; oT += p.fgOffenT; eV += p.fgEngV; eT += p.fgEngT;
      for (const t of stufen) {
        const z = (p.fgTier || {})[t];
        if (!z) continue;
        const ziel = tierSumme[t];
        ziel.oV += z.offenV; ziel.oT += z.offenT; ziel.eV += z.engV; ziel.eT += z.engT;
        if (spitze.has(p.n)) {
          const zs = tierSpitze[t];
          zs.oV += z.offenV; zs.oT += z.offenT; zs.eV += z.engV; zs.eT += z.engT;
        }
      }
    }
  }
  const tierDelta = (tabelle) => {
    let gewicht = 0, summe = 0;
    const je = {};
    for (const t of stufen) {
      const z = tabelle[t];
      if (z.oV < 5 || z.eV < 5) { je[t] = null; continue; }
      const d = (z.oT / z.oV - z.eT / z.eV) * 100;
      je[t] = { offen: rund((z.oT / z.oV) * 100, 1), eng: rund((z.eT / z.eV) * 100, 1), dPp: rund(d, 1), n: Math.min(z.oV, z.eV) };
      const w = Math.min(z.oV, z.eV);
      summe += d * w; gewicht += w;
    }
    return { gewichtet: gewicht ? rund(summe / gewicht, 1) : null, je };
  };

  // --- Rebounds: ZWEI voneinander unabhaengige Achsen ---------------------------
  // Achse 1  GRUNDVERTEILUNG defensiv/offensiv. Ein reales Basketball-Faktum (NBA-Liga-
  //          mittel ~74:26, im NBA2K-Reverse-Engineering ebenso) und KEIN Teamstaerke-
  //          Effekt: das verteidigende Team steht beim Fehlwurf naeher am Ring. Trifft
  //          unser Modell diese Quote nicht, haeufen sich Offensiv-Rebounds unrealistisch.
  // Achse 2  WER sie innerhalb dieser Poole bekommt — und zwar sowohl zwischen den Teams
  //          (das ist genau der Punkt, an dem 2K pauschal bleibt und wir es NICHT sein
  //          wollen) als auch zwischen den Spielern eines Teams.
  const rebOffSumme = alleSpiele.reduce((s, g) => s + (g.rebOff || 0), 0);
  const rebDefSumme = alleSpiele.reduce((s, g) => s + (g.rebDef || 0), 0);
  const rebGesamt = rebOffSumme + rebDefSumme;

  // Team-Ebene ueber die QUOTE, nicht ueber die Rohzahl. Ein starkes Angriffsteam wirft
  // oefter und produziert damit mehr gegnerische Defensiv-Rebounds — auf der Rohzahl sieht
  // es dadurch schwaecher aus, als es ist. Gemessen wird deshalb
  //   OREB% = eigene Offensiv-Rebounds / eigene Fehlwuerfe
  //   DREB% = eigene Defensiv-Rebounds / gegnerische Fehlwuerfe
  // und korreliert wird die ZWEITCHANCE-Differenz gegen die Differenz aus OREB%+DREB%.
  // TEAM-EBENE: kein Korrelationsmass. Beide Kader sind ueber alle Laeufe FIX (SQUAD/OPP);
  // die ZWEITCHANCE-Summe je Seite schwankt nur ueber die Formkarten, also kaum — eine
  // Korrelation darauf misst Rauschen und sprang in der Messung wild zwischen -0,48 und
  // +0,72. Statt dessen der direkte Vergleich: welche Seite bringt mehr ZWEITCHANCE aufs
  // Feld, und holt genau die auch die hoehere Rebound-QUOTE? Die Quote statt der Rohzahl,
  // weil ein starkes Angriffsteam oefter wirft und damit mehr gegnerische Defensiv-
  // Rebounds erzeugt — die Rohzahl laesst es dadurch schwaecher aussehen, als es ist.
  //   OREB% = eigene Offensiv-Rebounds / eigene Fehlwuerfe
  //   DREB% = eigene Defensiv-Rebounds / gegnerische Fehlwuerfe
  const zwSeite = [0, 0], quoteSeite = [0, 0], quoteN = [0, 0];
  const rhoRebSpieler = [];
  for (const s of alleSpiele) {
    const sum = (seite, k) => s.spieler.filter((p) => p.side === seite).reduce((x, p) => x + p[k], 0);
    const fehl = s.fehlSeite, ro = s.rebOffSeite, rd = s.rebDefSeite;
    for (const seite of [0, 1]) zwSeite[seite] += sum(seite, "ZWEITCHANCE") / alleSpiele.length;
    if (fehl && ro && rd && fehl[0] > 0 && fehl[1] > 0) {
      for (const seite of [0, 1]) {
        quoteSeite[seite] += ro[seite] / fehl[seite] + rd[seite] / fehl[1 - seite];
        quoteN[seite]++;
      }
    }
    const r = spearman(s.spieler.map((p) => p.rebounds), s.spieler.map((p) => p.ZWEITCHANCE));
    if (r != null) rhoRebSpieler.push(r);
  }

  // --- Kontext ----------------------------------------------------------------
  const punkteSpiel = mittel(alleSpiele.map((s) => s.seiten[0] + s.seiten[1]));
  const ballwechsel = mittel(alleSpiele.map((s) => s.ballwechsel));
  const fgaSpiel = mittel(alleSpiele.map((s) => s.spieler.reduce((x, p) => x + p.fga, 0)));
  // Usage-Konzentration: Anteil der Feldwuerfe, den der eignungsstaerkste Spieler
  // SEINER SEITE nimmt. In einem 6er-Team waeren 1/6 = 16,7 % voellige Gleichverteilung.
  const usage = [];
  for (const s of alleSpiele) {
    for (const seite of [0, 1]) {
      const t = s.spieler.filter((p) => p.side === seite);
      const summe = t.reduce((x, p) => x + p.fga, 0);
      if (!summe) continue;
      const best = t.reduce((a, b) => (b.eig > a.eig ? b : a));
      usage.push(best.fga / summe);
    }
  }

  return {
    jeSeite: daten.jeSeite,
    spiele: alleSpiele.length,
    rhoGesamt: rund(mittel(rhoGesamt)),
    rhoJeSeite: rund(mittel(rhoSeite)),
    probeV: {
      grenzeSchwach, grenzeStark, paare,
      dFgPp: rund(mittel(dFg), 1),
      dPunkteProzent: rund(mittel(dPunkte), 1),
    },
    probeS: {
      rohOffen: oV ? rund((oT / oV) * 100, 1) : null,
      rohBedraengt: eV ? rund((eT / eV) * 100, 1) : null,
      rohDPp: oV && eV ? rund(((oT / oV) - (eT / eV)) * 100, 1) : null,
      tierDPp: tierDelta(tierSumme).gewichtet,
      tierJeStufe: tierDelta(tierSumme).je,
      spitzeTierDPp: tierDelta(tierSpitze).gewichtet,
    },
    rebound: {
      offAnteil: rebGesamt ? rund((rebOffSumme / rebGesamt) * 100, 1) : null, // Ziel ~26 %
      jeSpiel: rund(rebGesamt / alleSpiele.length, 1),
      zwTeam0: rund(zwSeite[0], 1), zwTeam1: rund(zwSeite[1], 1),
      quoteTeam0: quoteN[0] ? rund(quoteSeite[0] / quoteN[0], 3) : null,
      quoteTeam1: quoteN[1] ? rund(quoteSeite[1] / quoteN[1], 3) : null,
      spielerRho: rund(mittel(rhoRebSpieler)),         // Achse 2, Spielerebene
    },
    kontext: {
      punkteJeSpiel: rund(punkteSpiel, 1),
      ballwechselJeSpiel: rund(ballwechsel, 1),
      feldwuerfeJeSpiel: rund(fgaSpiel, 1),
      usageBesterAnteil: rund(mittel(usage) * 100, 1),
      gleichverteilung: rund((1 / daten.jeSeite) * 100, 1),
    },
  };
}

// ---------------------------------------------------------------------------------
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(pathToFileURL(seitenPfad).href, { waitUntil: "domcontentloaded" });
await seite.waitForFunction(() => Boolean(window.__arena && window.__arena.basketballProbe), null, { timeout: 30000 });

const ergebnisse = [];
const rohdaten = [];
for (const jeSeite of feldGroessen) {
  const start = Date.now();
  const daten = await seite.evaluate(
    ([n, js]) => window.__arena.basketballProbe({ n, jeSeite: js }),
    [spiele, jeSeite],
  );
  rohdaten.push(daten);
  const a = werteAus(daten);
  a.sekunden = Math.round((Date.now() - start) / 1000);
  ergebnisse.push(a);
}
await browser.close();

console.log(`Basketball-Rangtreue — ${spiele} Spiele je Feldgroesse, Quelle: ${seitenPfad}\n`);
console.log("jeSeite  rho(ges)  rho(Seite)  V:dFG%  V:dPunkte%  S:dPp(tier)  S:dPp(roh)  S:Spitze  Pkt/Spiel  Ballw.  FGA  Usage%");
for (const e of ergebnisse) {
  console.log(
    String(e.jeSeite).padStart(7) +
      String(e.rhoGesamt).padStart(10) +
      String(e.rhoJeSeite).padStart(12) +
      String(e.probeV.dFgPp).padStart(8) +
      String(e.probeV.dPunkteProzent).padStart(12) +
      String(e.probeS.tierDPp).padStart(13) +
      String(e.probeS.rohDPp).padStart(12) +
      String(e.probeS.spitzeTierDPp).padStart(10) +
      String(e.kontext.punkteJeSpiel).padStart(11) +
      String(e.kontext.ballwechselJeSpiel).padStart(8) +
      String(e.kontext.feldwuerfeJeSpiel).padStart(6) +
      String(e.kontext.usageBesterAnteil).padStart(8),
  );
}
console.log(
  "\nV = Rollenprobe Verteidiger (Angreifer gegen STARKEN Decker minus gegen SCHWACHEN, gepaart je Spieler;\n" +
    "    negativ ist das Ziel: -8 Pp FG, -25 % Punkte).\n" +
    "S = offen minus bedraengt, tier-isoliert (die Rohspalte daneben mischt die Wurfdistanzen und\n" +
    "    misst deshalb ueberwiegend GEO_BONUS, nicht die Deckung). Positiv ist das Ziel.",
);
console.log("Usage% = Feldwurfanteil des eignungsstaerksten Spielers seiner Seite (Gleichverteilung: " +
  ergebnisse.map((e) => e.jeSeite + "->" + e.kontext.gleichverteilung + "%").join(", ") + ")");
console.log("\nRebounds — zwei getrennte Achsen:");
console.log("jeSeite  OFF-Anteil (Ziel ~26%)  Reb/Spiel  ZWEITCH T0/T1  Reb-Quote T0/T1  Spieler-rho");
for (const e of ergebnisse) {
  const r = e.rebound;
  console.log(
    String(e.jeSeite).padStart(7) + String(r.offAnteil).padStart(23) +
      String(r.jeSpiel).padStart(11) +
      `   ${r.zwTeam0}/${r.zwTeam1}`.padEnd(17) +
      `${r.quoteTeam0}/${r.quoteTeam1}`.padEnd(17) +
      String(r.spielerRho).padStart(11),
  );
}
console.log("  Achse 1 (OFF-Anteil) ist ein reales Spiel-Faktum, unabhaengig von Teamstaerke.\n" +
  "  Achse 2: die Seite mit der hoeheren ZWEITCHANCE-Summe muss auch die hoehere Rebound-Quote\n" +
  "  haben (OREB%+DREB%). Bei 2K waeren beide Quoten per Konstruktion gleich.");

for (const e of ergebnisse) {
  console.log(`\njeSeite ${e.jeSeite} — S je Distanzstufe: ` +
    Object.entries(e.probeS.tierJeStufe)
      .map(([t, z]) => (z ? `${t} ${z.offen}/${z.eng} (${z.dPp >= 0 ? "+" : ""}${z.dPp}, n=${z.n})` : `${t} —`))
      .join("  "));
}

// SPIELER-AGGREGAT ueber ALLE Spiele der groessten Feldgroesse. Das ist die Ansicht, in
// der Chris' eigener Live-Befund nachpruefbar wird: Lava Golem (Eignung ~22, weil die
// Basketball-Matrix intelligence/awareness/spirit/dexterity/speed bepreist und er dort
// 1-2 hat — nur Charisma 94 haelt ihn ueberhaupt ueber null) bekam beim Zuschauen 2-3
// eigene Wuerfe, traf 2/3 und landete mit Impact 8,0 auf Platz 2 SEINES TEAMS. Genau das
// darf nach dem Umbau nicht mehr regelmaessig passieren: bei konzentrierter Usage soll er
// kaum noch Baelle bekommen, wenn deutlich bessere Optionen im Team stehen.
//
// Ausgewiesen wird deshalb je Spieler: mittlere Wurfversuche, mittlerer Impact, mittlerer
// Rang IM EIGENEN TEAM und der Anteil der Spiele, in denen er in seinem Team unter den
// besten zwei landet.
{
  const satz = rohdaten[rohdaten.length - 1];
  const je = new Map();
  for (const g of satz.spiele) {
    for (const seite of [0, 1]) {
      const t = g.spieler.filter((p) => p.side === seite).sort((a, b) => b.wert - a.wert);
      t.forEach((p, i) => {
        if (!je.has(p.n)) je.set(p.n, { eig: 0, fga: 0, fgm: 0, wert: 0, pkt: 0, rang: 0, top2: 0, k: 0, side: p.side });
        const z = je.get(p.n);
        z.eig += p.eig; z.fga += p.fga; z.fgm += p.fgm; z.wert += p.wert; z.pkt += p.punkte;
        z.rang += i + 1; z.top2 += i < 2 ? 1 : 0; z.k++;
      });
    }
  }
  console.log(`\nSpieler-Aggregat ueber ${satz.spiele.length} Spiele, jeSeite ${satz.jeSeite} (Rang = Impact-Rang im EIGENEN Team):`);
  console.log("Spieler                 Seite    Eig   FGA/Sp  FG%    Pkt/Sp  Impact  Rang  Top2-Anteil");
  const reihen = [...je].map(([name, z]) => ({ ...z, name })).sort((a, b) => b.eig / b.k - a.eig / a.k);
  for (const r of reihen) {
    console.log(
      r.name.padEnd(24) + String(r.side).padStart(3) +
        (r.eig / r.k).toFixed(1).padStart(8) +
        (r.fga / r.k).toFixed(2).padStart(8) +
        (r.fga ? ((r.fgm / r.fga) * 100).toFixed(1) : "—").padStart(7) +
        (r.pkt / r.k).toFixed(1).padStart(9) +
        (r.wert / r.k).toFixed(1).padStart(8) +
        (r.rang / r.k).toFixed(2).padStart(7) +
        ((r.top2 / r.k) * 100).toFixed(0).padStart(9) + " %",
    );
  }
}

// BEISPIELSPIEL: das erste Spiel der groessten gemessenen Feldgroesse, nach Eignung
// sortiert — genau die Gegenueberstellung "echter Star gegen echten Schwachen", die sich
// zwischen zwei Staenden nebeneinanderlegen laesst.
const letzte = rohdaten[rohdaten.length - 1];
const bsp = letzte.spiele[0];
console.log(`\nBeispielspiel (Saat ${bsp.saat}, jeSeite ${letzte.jeSeite}, Endstand ${bsp.seiten[0]}:${bsp.seiten[1]}):`);
console.log("Spieler                 Seite   Eig  Impact   Pkt  Reb  Ast  Stl  Blk  TO   FG      Decker");
for (const p of [...bsp.spieler].sort((a, b) => b.eig - a.eig)) {
  console.log(
    p.n.padEnd(24) + String(p.side).padStart(3) + String(p.eig).padStart(7) +
      String(p.wert).padStart(8) + String(p.punkte).padStart(6) + String(p.rebounds).padStart(5) +
      String(p.assists).padStart(5) + String(p.steals).padStart(5) + String(p.bloecke).padStart(5) +
      String(p.verluste).padStart(4) + `  ${p.fgm}/${p.fga}`.padEnd(8) +
      "  " + (p.decker ? `${p.decker} (ABW ${p.deckerAbwehr})` : "—"),
  );
}
console.log("\nSeitenfehler:", seitenfehler.length ? seitenfehler.slice(0, 3) : "keine");

if (alsJson) console.log("\nJSON " + JSON.stringify({ ergebnisse, rohdaten }));

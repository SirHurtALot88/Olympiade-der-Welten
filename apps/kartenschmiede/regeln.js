/* Kartenschmiede – Regeln: Seltenheiten, Schmiede-Formel und Duell-Simulator.
   Reines JavaScript ohne DOM, damit dieselbe Datei im Browser läuft und in den Tests geprüft wird. */
(function (root) {
  "use strict";

  // ---------- Seltenheiten ----------
  const STUFEN = ["", "Gewöhnlich", "Selten", "Magisch", "Elite", "Legendär", "Boss"];
  // Untergrenze in Punkten je Stufe. Bei Chris' Tabelle begann Elite bei 105, Legendär bei 165, Boss bei 225;
  // die unteren drei Stufen teilen den alten Bereich 0–100 auf.
  const GRENZEN = [0, 0, 45, 75, 105, 165, 225];
  const GRENZEN_TEXT = ["", "0–40", "45–70", "75–100", "105–160", "165–220", "ab 225"];
  const stufeFuerPunkte = p => { let t = 1; for (let i = 1; i < GRENZEN.length; i++) if (p >= GRENZEN[i]) t = i; return t; };

  // ---------- Begriffe: deutsch auf der Karte, OPR-Namen werden beim Einlesen mit verstanden ----------
  const W = {
    ds: /\b(?:DS|AP)\s*\((\d)\)/i,
    reissend: /reißend|reissend|rending/i,
    gift: /gift|poison|bane/i,
    explosion: /(?:explosion|blast)\s*\((\d+)\)/i,
    toedlich: /(?:tödlich|toedlich|deadly)\s*\((\d+)\)/i,
    zuverlaessig: /zuverlässig|zuverlaessig|reliable/i,
    zerfleischen: /zerfleisch|lacerate|shred|tear/i,
    zersetzen: /zersetz|disintegrate/i,
    stoss: /\bstoß|\bstoss|thrust/i,
    rasend: /rasend|furious/i,
    indirekt: /indirekt|indirect/i,
    zielsuchend: /zielsuchend|lock-?on/i,
    praezise: /präzise|praezise|precise/i,
    ueberhitzen: /überhitz|ueberhitz|overheat/i,
  };
  // ---------- Elemente ----------
  // Acht Elemente in vier Gegensatzpaaren. Die Prägung einer Einheit sagt, was sie ist, das Element einer Waffe,
  // womit sie trifft. Gleiches Element: das Ziel ist resistent (+1 auf Verteidigung). Gegen-Element: verwundbar (−1).
  // Farben für die Symbole auf Karte und Seite. Neue Paare hier eintragen, der Rest liest sie von hier.
  const ELEMENTE = [
    { id: "feuer", name: "Feuer", wort: "Feuer", farbe: "#ff6a2b", gegen: "frost" },
    { id: "frost", name: "Frost", wort: "Frost", farbe: "#7fd3ff", gegen: "feuer" },
    { id: "natur", name: "Natur", wort: "Natur", farbe: "#5cc16a", gegen: "gift" },
    { id: "gift", name: "Gift", wort: "Gift", farbe: "#c3e83a", gegen: "natur" },
    { id: "licht", name: "Licht", wort: "Licht", farbe: "#ffd95a", gegen: "schatten" },
    { id: "schatten", name: "Schatten", wort: "Schatten", farbe: "#a27cf0", gegen: "licht" },
    { id: "magie", name: "Magie", wort: "Magie", farbe: "#e46ad8", gegen: "technik" },
    { id: "technik", name: "Sci-Fi", wort: "Energie", farbe: "#2fe0cf", gegen: "magie" },
  ];
  const ELEMENT = Object.fromEntries(ELEMENTE.map(e => [e.id, e]));
  // Element einer Waffenzeile aus den Regeln lesen (ein Wort wie „Feuer“ oder „Energie“), sonst null
  function elementAus(regeln) {
    const worte = String(regeln || "").split(",").map(x => x.trim().toLowerCase());
    const e = ELEMENTE.find(x => worte.includes(x.wort.toLowerCase()) || worte.includes(x.name.toLowerCase()) || (x.id === "magie" && worte.includes("magisch")));
    return e ? e.id : null;
  }
  // +1 resistent, −1 verwundbar, 0 neutral – aus Sicht des Ziels
  function elementWirkung(element, praegung) {
    if (!element || !Array.isArray(praegung)) return 0;
    let w = 0;
    if (praegung.includes(element)) w += 1;
    if (praegung.includes(ELEMENT[element].gegen)) w -= 1;
    return w;
  }

  // Waffenregeln mit Erklärung für die Tooltips auf der Karte und in der Datenbank. [Muster, Name, Symbol, Text]
  const WAFFENREGELN = [
    [/\b(?:DS|AP)\s*\((\d)\)/i, "Durchschlag", "down", "DS(X): Das Ziel bekommt −X auf seine Verteidigungswürfe."],
    [W.reissend, "Reißend", "fang", "Jede gewürfelte 6 auf Treffer zählt wie DS(4) und hebt Regeneration auf."],
    [W.gift, "Gift", "drop", "Das Ziel muss gewürfelte 6en bei der Verteidigung wiederholen."],
    [W.explosion, "Explosion", "burst", "Explosion(X): Jeder Treffer wird zu X Treffern, verteilt auf alle Modelle in 3\" um das Ziel."],
    [W.toedlich, "Tödlich", "skull", "Tödlich(X): Jede Wunde zählt X-fach, bleibt aber bei einem Modell."],
    [W.zuverlaessig, "Zuverlässig", "target", "Trifft immer auf 2+, egal wie gut die Einheit ist."],
    [W.zerfleischen, "Zerfleischen", "fang", "Das Ziel muss gelungene Verteidigungswürfe von 6 wiederholen."],
    [W.zersetzen, "Zersetzen", "burst", "Zersetzt Rüstung und Fleisch: −1 auf Verteidigung, und Regeneration wirkt nicht."],
    [W.stoss, "Stoß", "up", "Beim Angreifen +1 auf Treffer und DS(+1)."],
    [W.indirekt, "Indirekt", "portal", "Darf Ziele ohne Sichtlinie beschießen. −1 auf Treffer, wenn sich der Schütze bewegt hat."],
    [W.zielsuchend, "Zielsuchend", "eye", "Ignoriert alle Abzüge auf Treffer, etwa durch Deckung oder Ausweichen."],
    [W.praezise, "Präzise", "target", "+1 auf Treffer."],
    [W.ueberhitzen, "Überhitzen", "flame", "Für jede gewürfelte 1 auf Treffer erleidet der Schütze selbst 1 Treffer."],
  ];
  const ELEMENT_TEXT = e => `Element ${e.name}: Ein Ziel mit Prägung ${e.name} ist resistent (+1 auf Verteidigung), ein Ziel mit Prägung ${ELEMENT[e.gegen].name} verwundbar (−1 auf Verteidigung). Das Element kostet keine Punkte.`;
  const regelnVon = regeln => {
    const liste = WAFFENREGELN.filter(([re]) => re.test(regeln || "")).map(([re, name, icon, text]) => {
      const m = String(regeln).match(re);
      return { name: m && m[1] ? `${name}(${m[1]})` : name, icon, text };
    });
    const el = elementAus(regeln);
    if (el) {
      const e = ELEMENT[el], gift = liste.find(r => r.name === "Gift");
      if (gift) gift.text += " " + ELEMENT_TEXT(e);
      else liste.push({ name: e.wort, icon: null, element: el, text: ELEMENT_TEXT(e) });
    }
    if (liste.find(r => r.name === "Gift")) liste.find(r => r.name === "Gift").element = "gift";
    return liste;
  };
  const istNahkampf = r => !r || /nahkampf|melee/i.test(r);

  function leseWaffe(zeile) {
    const [name = "", reichweite = "", attacken = "", regeln = ""] = zeile.split("|").map(x => x.trim());
    const ds = regeln.match(W.ds), ex = regeln.match(W.explosion), td = regeln.match(W.toedlich);
    return {
      name, regeln,
      reichweite: istNahkampf(reichweite) ? 0 : parseInt(reichweite, 10) || 0,
      a: parseInt(String(attacken).replace(/\D/g, ""), 10) || 0,
      ds: ds ? +ds[1] : 0,
      reissend: W.reissend.test(regeln), gift: W.gift.test(regeln),
      explosion: ex ? +ex[1] : 0, toedlich: td ? +td[1] : 0,
      zuverlaessig: W.zuverlaessig.test(regeln), zerfleischen: W.zerfleischen.test(regeln),
      zersetzen: W.zersetzen.test(regeln), stoss: W.stoss.test(regeln),
      indirekt: W.indirekt.test(regeln), zielsuchend: W.zielsuchend.test(regeln),
      praezise: W.praezise.test(regeln), ueberhitzen: W.ueberhitzen.test(regeln),
      element: elementAus(regeln),
    };
  }
  const leseWaffen = text => String(text || "").split("\n").map(l => l.trim()).filter(Boolean).map(leseWaffe);
  const leseListe = text => String(text || "").split(",").map(x => x.trim()).filter(Boolean);

  // ---------- Schmiede-Formel ----------
  const TREFFER = { 2: 5 / 6, 3: 4 / 6, 4: 3 / 6, 5: 2 / 6, 6: 1 / 6 };
  function waffenFaktor(w) {
    let m = [1, 1.33, 1.67, 2, 2, 2][Math.min(5, w.ds)];
    if (w.reissend) m *= 1.15;
    if (w.gift) m *= 1.05;
    if (w.zerfleischen) m *= 1.15;
    if (w.zersetzen) m *= 1.35;
    if (w.stoss) m *= 1.1;
    if (w.toedlich) m *= 2;
    if (w.explosion) m *= 1 + w.explosion / 6;
    if (w.indirekt) m *= 1.15;
    if (w.zielsuchend) m *= 1.05;
    if (w.praezise) m *= 1.25;
    if (w.ueberhitzen) m *= 0.85;
    return m;
  }
  // Per Duell-Simulator abgestimmt: Bei gleichen Punkten und mittlerem Gelände gewinnen Schützen etwa jeden
  // zweiten Kampf gegen Nahkämpfer. Die ursprüngliche OPR-nahe Kurve (0,85 + Zoll/40) machte Schützen zu teuer,
  // sie gewannen nur ein Drittel.
  const reichweitenFaktor = r => (!r ? 1 : r <= 12 ? 0.55 + r / 48 : 0.8 + (r - 12) / 60);

  // [Muster, Name auf der Karte, Bonus]
  const FAEHIGKEITEN = [
    [/geländel|gelaendel|strider/i, "Geländeläufer", 0.05], [/späher|spaeher|scout/i, "Späher", 0.05],
    [/tarnung|stealth/i, "Tarnung", 0.05], [/^(fliegen|flying)$/i, "Fliegen", 0.05], [/^(gleiten|glide)$/i, "Gleiten", 0.05],
    [/furchtlos|fearless/i, "Furchtlos", 0.05], [/rasend|furious/i, "Rasend", 0.05], [/^(held|hero)$/i, "Held", 0.05],
    [/^(schnell|fast)$/i, "Schnell", 0.10], [/hinterhalt|ambush/i, "Hinterhalt", 0.10], [/^(wucht|impact)\s*\(\d+\)$/i, "Wucht", 0.10],
    [/^(furcht|fear)\s*\(\d+\)$/i, "Furcht", 0.15], [/ausweich|evasive/i, "Ausweichen", 0.20], [/regenerat/i, "Regeneration", 0.25],
    [/^(langsam|slow)$/i, "Langsam", -0.10], [/beschwörer|beschwoerer|bound to caster/i, "An Beschwörer gebunden", -0.15],
  ];
  const hat = (liste, re) => liste.some(p => re.test(p));
  const zahlIn = (liste, re) => { for (const p of liste) { const m = p.match(re); if (m) return +m[m.length - 1]; } return 0; };

  function punkte(s) {
    const Q = parseInt(s.quality, 10) || 4;
    const D = Math.min(6, Math.max(2, parseInt(s.defense, 10) || 5));
    const n = parseInt(s.size, 10) || 1, T = parseFloat(s.tough) || 1;
    let K = 0;
    for (const w of leseWaffen(s.weapons)) {
      const h = w.zuverlaessig ? TREFFER[2] : (TREFFER[Q] || 0.5);
      K += w.a * n * h * waffenFaktor(w) * reichweitenFaktor(w.reichweite);
    }
    const passiv = leseListe(s.passives);
    let b = 0, fest = 0;
    for (const p of passiv) {
      const f = FAEHIGKEITEN.find(([re]) => re.test(p)); if (f) b += f[2];
      const wu = p.match(/^(?:wucht|impact)\s*\((\d+)\)$/i); if (wu) K += +wu[1] * 0.5 * n;
      const z = p.match(/^(?:zauberer|caster)\s*\((\d)\)$/i); if (z) fest += 20 + 15 * (+z[1] - 1);
    }
    // Fähigkeiten aus der Datenbank: feste Punkte (Skills, Auren) oder Aufschlag in Prozent (Sonderregeln)
    for (const k of Array.isArray(s.skills) ? s.skills : []) {
      const wert = +(k && k.kosten && k.kosten.wert) || 0;
      if (k && k.kosten && k.kosten.typ === "fest") fest += wert; else b += wert / 100;
    }
    b += (+s.special || 0) / 100;
    const A = T * n * 6 / (D - 1);
    const roh = 13 * Math.sqrt(K * A) * (1 + b) + fest;
    return { pts: Math.max(5, 5 * Math.round(roh / 5)), roh, K, A, b, fest };
  }

  // ---------- Duell-Simulator ----------
  function einheitAus(s) {
    const passiv = leseListe(s.passives);
    const n = parseInt(s.size, 10) || 1;
    const T = Math.max(1, parseInt(s.tough, 10) || 1);
    return {
      name: s.name || "Einheit",
      q: parseInt(s.quality, 10) || 4, d: Math.min(6, Math.max(2, parseInt(s.defense, 10) || 5)),
      n, T, waffen: leseWaffen(s.weapons).filter(w => w.a > 0),
      schnell: hat(passiv, /^(schnell|fast|fliegen|flying)$/i), langsam: hat(passiv, /^(langsam|slow)$/i),
      rasend: hat(passiv, /rasend|furious/i), ausweichen: hat(passiv, /ausweich|evasive/i),
      tarnung: hat(passiv, /tarnung|stealth/i), regeneration: hat(passiv, /regenerat/i),
      praegung: Array.isArray(s.praegung) ? s.praegung : [],
      hinterhalt: hat(passiv, /hinterhalt|ambush/i), wucht: zahlIn(passiv, /^(?:wucht|impact)\s*\((\d+)\)$/i),
    };
  }
  const w6 = rnd => 1 + Math.floor(rnd() * 6);
  function erwartung(e, fern) {
    return e.waffen.filter(w => (fern ? w.reichweite > 0 : w.reichweite === 0))
      .reduce((s, w) => s + w.a * (TREFFER[e.q] || 0.5) * waffenFaktor(w), 0);
  }

  function simuliere(sA, sB, opt = {}) {
    const N = opt.kaempfe || 1000, start = opt.abstand || 24, runden = opt.runden || 8;
    // Deckung: Anteil der Schüsse, bei denen das Ziel in Deckung steht (0 = offener Tisch, 1 = überall Gelände)
    const deckung = typeof opt.deckung === "number" ? opt.deckung : opt.deckung === false ? 0 : 0.5;
    const TISCH = 48;
    let seed = opt.seed || 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const A0 = einheitAus(sA), B0 = einheitAus(sB);
    const erg = { a: 0, b: 0, u: 0, runden: 0, restA: 0, restB: 0 };

    for (let k = 0; k < N; k++) {
      const mk = (e, pos, richtung) => ({ ...e, pos, richtung, lp: Array(e.n).fill(e.T), aktiv: !e.hinterhalt,
        nah: erwartung(e, false) >= erwartung(e, true) });
      const A = mk(A0, TISCH / 2 - start / 2, 1), B = mk(B0, TISCH / 2 + start / 2, -1);
      const lebend = u => u.lp.filter(x => x > 0).length;
      const abst = () => Math.max(0, Math.abs(B.pos - A.pos));
      let r = 0;

      const angriff = (att, ziel, w, { angreifen = false, schuss = false, inDeckung = false } = {}) => {
        const modelle = lebend(att); if (!modelle || !lebend(ziel)) return;
        let treffer = [];
        const ziel_ = w.zuverlaessig ? 2 : att.q;
        let mod = 0;
        if (ziel.ausweichen) mod -= 1;
        if (schuss && ziel.tarnung && abst() > 9) mod -= 1;
        for (let i = 0; i < w.a * modelle; i++) {
          const x = w6(rnd);
          if (x === 6 || (x !== 1 && x + mod >= ziel_)) {
            treffer.push(x === 6);
            if (angreifen && att.rasend && x === 6 && !schuss) treffer.push(false);
          }
        }
        if (w.explosion) treffer = treffer.flatMap(t => Array(Math.min(w.explosion, lebend(ziel))).fill(t));
        for (const sechs of treffer) {
          if (!lebend(ziel)) break;
          const ds = sechs && w.reissend ? Math.max(w.ds, 4) : w.ds;
          const bedarf = ziel.d + ds + (schuss && inDeckung ? -1 : 0) - elementWirkung(w.element, ziel.praegung);
          let x = w6(rnd);
          if (w.gift && x === 6) x = w6(rnd);
          if (x !== 1 && x >= bedarf) continue;
          let wunden = w.toedlich || 1;
          if (ziel.regeneration && !w.gift) { let rest = 0; for (let i = 0; i < wunden; i++) if (w6(rnd) < 5) rest++; wunden = rest; }
          const i = ziel.lp.findIndex(v => v > 0);
          ziel.lp[i] = Math.max(0, ziel.lp[i] - wunden);
        }
      };
      const nahWaffen = u => u.waffen.filter(w => w.reichweite === 0);
      const fernWaffen = (u, dist) => u.waffen.filter(w => w.reichweite > 0 && w.reichweite >= dist);
      const schiessen = (u, g) => { const inDeckung = rnd() < deckung; for (const w of fernWaffen(u, abst())) angriff(u, g, w, { schuss: true, inDeckung }); };
      const nahkampfRunde = (u, g) => {
        // Wucht(X): X Treffer je Modell auf 2+, bevor die Waffen zuschlagen
        if (u.wucht) angriff({ ...u, rasend: false }, g, { a: u.wucht, ds: 0, zuverlaessig: true });
        for (const w of nahWaffen(u)) angriff(u, g, w, { angreifen: true });
        if (lebend(g)) for (const w of nahWaffen(g)) angriff(g, u, w, {});
        // OPR: Überlebt das Ziel, weicht der Angreifer 1" zurück. Niemand bleibt im Nahkampf gefangen.
        u.pos = g.pos - u.richtung * 1;
      };
      const zieh = (u, zoll) => { u.pos = Math.max(0, Math.min(TISCH, u.pos + u.richtung * zoll)); };
      const bew = u => 6 + (u.schnell ? 2 : 0) - (u.langsam ? 2 : 0);
      const lauf = u => 12 + (u.schnell ? 4 : 0) - (u.langsam ? 4 : 0);

      const aktiviere = (u, g) => {
        if (!lebend(u) || !lebend(g)) return;
        if (!u.aktiv) { u.aktiv = true; u.pos = g.pos - u.richtung * Math.min(abst(), 9); return; }
        const d = abst();
        if (u.nah) {
          if (d <= lauf(u)) { u.pos = g.pos; return nahkampfRunde(u, g); }
          if (fernWaffen(u, d - bew(u)).length) { zieh(u, bew(u)); return schiessen(u, g); }
          return zieh(u, lauf(u));
        }
        const R = Math.max(0, ...u.waffen.map(w => w.reichweite));
        if (d <= R) {
          const kannWeichen = (u.richtung > 0 ? u.pos : TISCH - u.pos) >= 1;
          if (g.nah && kannWeichen && d + bew(u) <= R) zieh(u, -bew(u));
          return schiessen(u, g);
        }
        if (d - bew(u) <= R) { zieh(u, bew(u)); return schiessen(u, g); }
        zieh(u, lauf(u));
      };

      for (r = 1; r <= runden && lebend(A) && lebend(B); r++) {
        const erst = rnd() < 0.5 ? [A, B] : [B, A];
        aktiviere(erst[0], erst[1]);
        aktiviere(erst[1], erst[0]);
      }
      const la = lebend(A), lb = lebend(B);
      if (la && !lb) erg.a++; else if (lb && !la) erg.b++; else erg.u++;
      erg.runden += Math.min(r - 1, runden);
      erg.restA += A.lp.reduce((s, x) => s + x, 0) / (A.n * A.T);
      erg.restB += B.lp.reduce((s, x) => s + x, 0) / (B.n * B.T);
    }
    return { a: erg.a / N, b: erg.b / N, u: erg.u / N, runden: erg.runden / N, restA: erg.restA / N, restB: erg.restB / N };
  }

  // Balance-Test: viele zufällige Paare aus Schütze und Nahkämpfer mit (fast) gleichen Punkten gegeneinander.
  // Ergebnis ist der Anteil der entschiedenen Kämpfe, den die Schützen gewinnen. 0,5 heißt: im Gleichgewicht.
  function balanceTest(opt = {}) {
    let s = opt.seed || 7;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const wahl = a => a[Math.floor(rnd() * a.length)];
    const baue = fern => {
      const q = wahl([3, 4, 5]), d = wahl([3, 4, 5]), t = wahl([3, 5, 7, 9]), a = wahl([1, 2, 3, 4, 6]), ds = wahl([0, 0, 1]);
      const rw = fern ? wahl([12, 18, 24]) : 0;
      return { quality: q + "+", defense: d + "+", tough: String(t), size: "1", passives: "",
        weapons: `Waffe | ${rw ? rw + '"' : "Nahkampf"} | A${a} | ${ds ? "DS(1)" : ""}` + (fern ? "\nMesser | Nahkampf | A1 |" : "") };
    };
    const F = [], N = [];
    for (let i = 0; i < (opt.kandidaten || 300); i++) { F.push(baue(true)); N.push(baue(false)); }
    const pn = N.map(n => punkte(n).roh);
    const jeReichweite = {}; let summe = 0, paare = 0;
    for (const f of F) {
      const pf = punkte(f).roh, j = pn.findIndex(p => Math.abs(p - pf) / pf < 0.04);
      if (j < 0) continue;
      const r = simuliere(f, N[j], { kaempfe: opt.kaempfe || 200, abstand: opt.abstand || 24, deckung: opt.deckung, seed: paare + 1 });
      if (r.a + r.b < 0.2) continue;
      const anteil = r.a / (r.a + r.b), rw = leseWaffen(f.weapons)[0].reichweite;
      summe += anteil; paare++; (jeReichweite[rw] = jeReichweite[rw] || []).push(anteil);
    }
    const mittel = a => a.reduce((x, y) => x + y, 0) / a.length;
    return { paare, fern: paare ? summe / paare : 0,
      jeReichweite: Object.fromEntries(Object.entries(jeReichweite).map(([k, v]) => [k, mittel(v)])) };
  }

  const Regeln = { STUFEN, GRENZEN, GRENZEN_TEXT, stufeFuerPunkte, leseWaffe, leseWaffen, WAFFENREGELN, regelnVon, ELEMENTE, ELEMENT, elementAus, elementWirkung, leseListe, waffenFaktor,
    reichweitenFaktor, FAEHIGKEITEN, punkte, simuliere, einheitAus, balanceTest };
  if (typeof module !== "undefined" && module.exports) module.exports = Regeln;
  else root.Regeln = Regeln;
})(typeof globalThis !== "undefined" ? globalThis : this);

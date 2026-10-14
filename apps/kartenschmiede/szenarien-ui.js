/* Kartenschmiede – Reiter „Szenarien“: Kampagne Moosgrab, Zusatzmissionen, Tischkarten und Druckbögen.
   Inhalte und Regeln stehen in szenarien.js. Die Gegnerpunkte kommen aus einer Gruppe (gruppe.js), die Gegner
   selbst aus Vorlagen und gespeicherten Karten. Zwei Ansichten: Spieler (ohne Geheimnisse) und Spielleiter.
   Braucht window.KS aus app.js. */
(function () {
  "use strict";
  const KS = window.KS, S = window.Szenarien;
  const { esc } = KS;
  const $ = id => document.getElementById(id);
  const API = "/api/kartenschmiede/szenarien";
  const LOKAL = "kartenschmiede-szenarien";
  const MERKER = "kartenschmiede-szenarien-ansicht";

  // Auswahl: { art: "map", nr } oder { art: "zusatz", sz }
  let auswahl = { art: "uebersicht" };
  let ansicht = "sl";             // "sl" Spielleiter, "spieler"
  let tisch = "";                 // leer = empfohlener Tisch der Map
  let gruppen = [], gruppe = null, gespeicherte = [];
  let geladen = false;
  try { const v = JSON.parse(localStorage.getItem(MERKER) || "{}"); if (v.ansicht) ansicht = v.ansicht; } catch { /* egal */ }
  const merke = () => { try { localStorage.setItem(MERKER, JSON.stringify({ ansicht })); } catch { /* egal */ } };
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, "");
  const melde = t => { const m = $("szMsg"); if (m) m.textContent = t; };

  // ---------- Ablage für Zusatzmissionen: Server oder dieser Browser ----------
  const lokal = () => { try { return JSON.parse(localStorage.getItem(LOKAL) || "[]"); } catch { return []; } };
  const lokalSchreiben = liste => { try { localStorage.setItem(LOKAL, JSON.stringify(liste)); } catch { melde("Der Browser-Speicher ist voll."); } };
  async function liste() {
    if (!KS.SERVER) { gespeicherte = lokal().map(x => ({ id: x.id, name: x.titel, ziel: x.ziel })); return; }
    const r = await fetch(API, { credentials: "same-origin" });
    gespeicherte = r.ok ? (await r.json()).szenarien : [];
  }
  async function lade(id) {
    if (!KS.SERVER) return lokal().find(x => x.id === id) || null;
    const r = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: "same-origin" });
    return r.ok ? (await r.json()).inhalt : null;
  }
  async function speichere(sz) {
    if (!sz.id) sz.id = neueId();
    if (!KS.SERVER) { lokalSchreiben(lokal().filter(x => x.id !== sz.id).concat(sz)); melde("Gespeichert in diesem Browser."); }
    else {
      const r = await fetch(`${API}/${encodeURIComponent(sz.id)}`, { method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inhalt: sz }) });
      melde(r.ok ? "Gespeichert." : "Speichern fehlgeschlagen. Bist du noch eingeloggt?");
    }
    await liste(); zeigeListe();
  }
  async function loesche(sz) {
    if (!sz || !sz.id) return;
    if (KS.SERVER) await fetch(`${API}/${encodeURIComponent(sz.id)}`, { method: "DELETE", credentials: "same-origin" });
    else lokalSchreiben(lokal().filter(x => x.id !== sz.id));
    auswahl = { art: "uebersicht" }; await liste(); zeigeListe(); zeige();
  }

  // ---------- Gruppe und Gegner ----------
  const G = () => window.KartenschmiedeGruppe;
  const heldenPunkte = sz => (gruppe && G() ? G().punkteVon(gruppe) : +(sz && sz.ersatzPunkte) || 345);
  const pool = () => (G() && G().alleGegner ? G().alleGegner() : []);

  // ---------- Tischkarte als SVG ----------
  // [Zeichen, Farbe, Legende]
  const MARKER = {
    suche: ["?", "#f2cf4a", "Suchmarker"], gefangener: ["G", "#ffd95a", "Gefangener"], spur: ["S", "#c2a878", "Spurmarker"],
    nest: ["N", "#a3b83a", "Nest"], zone: ["Z", "#7fd06a", "Zone"], ausgang: ["→", "#7fd06a", "Fluchtkante"], truhe: ["T", "#cfa75e", "Truhe"],
    feind: ["", "#ff6a4a", "Feindzone"], quelle: ["Q", "#7fd06a", "Quelle"], grab: ["G", "#a99c84", "Zuckendes Grab"], tuer: ["T", "#cfa75e", "Tür"],
    fenster: ["F", "#9fb4ff", "Fenster"], sakristei: ["S", "#cfa75e", "Sakristei"], falltuer: ["F", "#ff8a1f", "Falltür"],
    ueberlebender: ["Ü", "#ffd95a", "Überlebender (verdeckt)"], eiskeller: ["E", "#7fd3ff", "Eiskeller (Krypta-Gang)"], schmied: ["S", "#ff4a36", "Der Schmied"],
    licht: ["L", "#ff4a36", "Blinkendes Licht"], schacht: ["↑", "#7fd06a", "Schacht nach oben"], nische: ["N", "#8b909b", "Wandnische"],
    herz: ["♥", "#ff4a36", "Das Herz"], ader: ["A", "#c27a5a", "Ader"], marines: ["M", "#6fb0ff", "Verbündete"],
  };
  const SCHRIFT = `font-family="Barlow Condensed, sans-serif" font-weight="700"`;
  // Geländesymbole (game-icons.net, CC BY 3.0, siehe vendor/gelaende-symbole.js): erst nach Beschriftung, dann nach Art
  const SYMBOL_ART = { ruine: "ancient-ruins", haus: "house", mauer: "broken-wall", zaun: "wooden-fence", baum: "log", wald: "pine-tree",
    sporen: "spotted-mushroom", sporenwolke: "poison-cloud", pilze: "mushroom", sumpf: "swamp", wasser: "waves", fels: "rock", grab: "tombstone",
    gruft: "coffin", statue: "stone-bust", brunnen: "well", wurzeln: "tree-roots", metall: "metal-plate", labortisch: "round-bottom-flask",
    tank: "vial", lava: "lava", altar: "star-altar" };
  const SYMBOL_NAME = [[/kapelle|kirche/i, "church"], [/glocke/i, "ringing-bell"], [/linde|eiche|baum(?!.*umgest)/i, "oak"], [/schmiede/i, "anvil"],
    [/bäcker/i, "bread"], [/wirtshaus|schenke|taverne/i, "beer-stein"], [/gemeindehaus|rathaus/i, "village"], [/keller|treppe/i, "stairs"],
    [/schacht|bohrloch/i, "hole"], [/herz/i, "heart-beats"], [/falltür/i, "floor-hatch"], [/turm/i, "stone-tower"], [/höhle|gang/i, "cave-entrance"],
    [/scheune|stall/i, "barn"], [/tank/i, "vial"], [/kerze/i, "candles"]];
  function symbolFuer(g, name) {
    const SYM = window.GELAENDE_SYMBOLE || {};
    const n = (SYMBOL_NAME.find(([re]) => re.test(name || "")) || [])[1] || SYMBOL_ART[g.art];
    return n && SYM[n] ? SYM[n] : "";
  }
  // Symbol ins Geländestück: rund und eckig einmal mittig, lang (Zaun, Mauer, Wurzeln) entlang der Länge wiederholt
  function symbolTeile(g, form, farbe) {
    const name = g.label || (S.GELAENDE[g.art] || {}).name || "", pfad = symbolFuer(g, name);
    if (!pfad) return "";
    const kurz = Math.min(g.w, g.h), lang = Math.max(g.w, g.h), groesse = form === "lang" ? kurz * 1.05 : kurz * 0.72;
    const zahl = form === "lang" ? Math.max(1, Math.min(4, Math.floor(lang / (groesse * 1.4)))) : 1, quer = g.w >= g.h;
    const teile = [];
    for (let i = 0; i < zahl; i++) {
      const t = (i + 0.5) / zahl;
      const cx = quer ? g.x + g.w * t : g.x + g.w / 2, cy = quer ? g.y + g.h / 2 : g.y + g.h * t;
      teile.push(`<g transform="translate(${cx - groesse / 2} ${cy - groesse / 2}) scale(${groesse / 512})" fill="${farbe}" opacity=".55" pointer-events="none">${pfad}</g>`);
    }
    return teile.join("");
  }
  function karteSvg(karte, opt = {}) {
    const { druck = false, geheim = true, boden = "#1f2a1c" } = opt;
    const B = karte.b, T = karte.t;
    const papier = druck ? "#f4efe4" : boden, linie = druck ? "#00000022" : "#ffffff14", tinte = druck ? "#1b1509" : "#ece4d3";
    const teile = [`<rect x="0" y="0" width="${B}" height="${T}" fill="${papier}"/>`];
    for (let i = 6; i < B; i += 6) teile.push(`<line x1="${i}" y1="0" x2="${i}" y2="${T}" stroke="${linie}" stroke-width=".08"/>`);
    for (let i = 6; i < T; i += 6) teile.push(`<line x1="0" y1="${i}" x2="${B}" y2="${i}" stroke="${linie}" stroke-width=".08"/>`);
    const a = karte.aufstellung;
    teile.push(`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#6fb0ff22" stroke="#6fb0ff" stroke-width=".15" stroke-dasharray=".6 .4"/>`,
      `<text x="${a.x + a.w / 2}" y="${a.y + a.h / 2 + .4}" font-size="1.1" text-anchor="middle" fill="#6fb0ff" ${SCHRIFT} letter-spacing=".08">HELDENSTART</text>`);
    // Gelände nummerieren: gleiche Art (und gleiche Beschriftung) = gleiche Nummer in der Legende
    const legende = new Map();
    for (const g of karte.gelaende) {
      if (g.geheim && !geheim) continue;
      const art = S.GELAENDE[g.art], schluessel = g.label || art.name;
      if (!legende.has(schluessel)) legende.set(schluessel, { n: legende.size + 1, art: g.art, name: schluessel });
      const n = legende.get(schluessel).n, f = art.farbe;
      teile.push(art.form === "rund"
        ? `<ellipse cx="${g.x + g.w / 2}" cy="${g.y + g.h / 2}" rx="${g.w / 2}" ry="${g.h / 2}" fill="${f}88" stroke="${f}" stroke-width=".18"/>`
        : `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="${art.form === "lang" ? .5 : .3}" fill="${f}88" stroke="${f}" stroke-width=".18"/>`);
      if (opt.symbole !== false) teile.push(symbolTeile(g, art.form, druck ? "#1b1509" : "#0f1210"));
      // namen: Gelände beschriften statt nummerieren (Reiter „Spielen“, dort verwechselt man Nummern mit Suchmarkern)
      if (opt.namen) {
        const wort = schluessel, quer = g.w >= g.h, platz = (quer ? g.w : g.h) * 1.7;
        const gr = Math.max(.55, Math.min(1, platz / Math.max(1, wort.length)));
        teile.push(`<text x="${g.x + g.w / 2}" y="${g.y + g.h / 2 + gr * .35}" font-size="${gr}" text-anchor="middle" fill="${tinte}" ${SCHRIFT}${quer ? "" : ` transform="rotate(-90 ${g.x + g.w / 2} ${g.y + g.h / 2})"`}>${esc(wort)}</text>`);
      } else teile.push(`<text x="${g.x + g.w / 2}" y="${g.y + g.h / 2 + .4}" font-size="1.1" text-anchor="middle" fill="${tinte}" ${SCHRIFT}>${n}</text>`);
    }
    const typen = new Set();
    // aufgedeckt: geheime Marker, die im Spiel schon gefunden sind (Reiter „Spielen“)
    const aufgedeckt = opt.aufgedeckt || [];
    for (const m of karte.marker) {
      if (m.geheim && !geheim && !aufgedeckt.includes(m.label) && !aufgedeckt.includes(`${m.typ}:${m.label}`)) continue;
      const [z, f] = MARKER[m.typ] || ["•", "#fff"];
      typen.add(m.typ);
      if (m.typ === "zone") { teile.push(`<circle cx="${m.x}" cy="${m.y}" r="${m.radius || 4}" fill="${f}18" stroke="${f}" stroke-width=".2" stroke-dasharray="1 .5"/>`); continue; }
      if (m.typ === "ausgang") { teile.push(`<rect x="0" y="0" width="${B}" height="1.2" fill="${f}55"/><text x="${B / 2}" y="1" font-size="1" text-anchor="middle" fill="${tinte}" ${SCHRIFT} letter-spacing=".1">FLUCHTKANTE</text>`); continue; }
      const x = Math.min(B - 1.1, Math.max(1.1, m.x)), y = Math.min(T - 1.1, Math.max(1.1, m.y));
      if (m.typ === "feind") {
        teile.push(`<polygon points="${x},${y - 1.1} ${x + 1.1},${y + .9} ${x - 1.1},${y + .9}" fill="${f}" stroke="#1b1509" stroke-width=".1"/><text x="${x}" y="${y + .65}" font-size="1" text-anchor="middle" fill="#1b1509" ${SCHRIFT}>${esc(m.label || "")}</text>`);
        continue;
      }
      teile.push(`<circle cx="${x}" cy="${y}" r=".95" fill="${f}" stroke="#1b1509" stroke-width=".12"${m.geheim ? ` stroke-dasharray=".3 .2"` : ""}/><text x="${x}" y="${y + .42}" font-size="1.15" text-anchor="middle" fill="#1b1509" ${SCHRIFT}>${esc(m.label && m.label.length <= 2 ? m.label : z)}</text>`);
    }
    const tischName = (S.TISCHE.find(t => t.id === karte.tisch) || {}).name || `${B}" × ${T}"`;
    teile.push(`<text x="${B - .4}" y="${T - .4}" font-size=".85" text-anchor="end" fill="${tinte}" opacity=".7" font-family="Barlow Condensed, sans-serif">${esc(opt.fuss || `${tischName} · Raster 6" (15 cm) · Norden oben · Symbole: game-icons.net (CC BY 3.0)`)}</text>`);
    return {
      svg: `<svg class="sz-karte" viewBox="0 0 ${B} ${T}" role="img" aria-label="Tischskizze ${esc(tischName)}">${teile.join("")}</svg>`,
      legende: [...legende.values()], typen: [...typen],
    };
  }
  const legendeHtml = ({ legende, typen }) => `<ol class="sz-legende">${legende.map(l => `<li><b>${l.n} · ${esc(l.name)}</b> ${esc(S.gelaendeText(l.art))} <small>${esc(S.GELAENDE[l.art].tisch || "")}</small></li>`).join("")}</ol>
    <p class="sz-marker">${typen.map(t => `<span><i style="background:${MARKER[t][1]}">${esc(MARKER[t][0] || "▲")}</i>${esc(MARKER[t][2])}</span>`).join("")}</p>`;

  // ---------- Kampagnen-Map: Spieler- und Spielleiter-Ansicht ----------
  const tabelle = (kopf, zeilen) => zeilen && zeilen.length ? `<table class="sz-tab"><thead><tr>${kopf.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${zeilen.map(z => `<tr>${z.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
  const liste_ = punkte => punkte && punkte.length ? `<ul>${punkte.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
  function mapBogen(map, opt = {}) {
    const sl = opt.ansicht !== "spieler";
    const karte = S.skaliereKarte(map.karte, opt.tisch || map.empfohlen || map.karte.tisch);
    const k = karteSvg(karte, { druck: opt.druck, geheim: sl, boden: "#1d2620" });
    const kopf = `<header class="sz-kopf">
        <p class="eyebrow">Moosgrab · Map ${map.nr}${sl ? ` · ${esc(map.ton)}` : ""}</p>
        <h3 class="sz-titel">${esc(map.titel)}</h3>
        ${sl ? `<p class="sz-meta">${esc(map.stand)}</p>` : ""}
      </header>`;
    const karteBlock = `<div class="sz-kartenspalte">${k.svg}${legendeHtml(k)}</div>`;
    // Spieler sehen die Missionskarte mit eigenen, spoilerfreien Texten, wo die Map welche hat
    const v = sl ? map : { ...map, ...(map.spieler || {}) };
    const missionskarte = `<section><h4>Hauptziel</h4><p>${esc(v.hauptziel)}</p></section>
      <section><h4>Nebenziel</h4><p>${esc(v.nebenziel)}</p></section>
      <section><h4>Spezialregel</h4>${liste_(v.spezial)}</section>
      <section><h4>Belohnung</h4><p>${esc(v.belohnung)}</p></section>`;
    if (!sl) {
      return `<article class="sz-blatt${opt.druck ? " druck" : ""}">${kopf}<p class="sz-vorlesen">${esc(map.einleitung)}</p>
        <div class="sz-raster">${karteBlock}<div class="sz-text">${missionskarte}</div></div></article>`;
    }
    const teile = map.teile.map((t, i) => `<section class="sz-teil"><h4>Teil ${i + 1}: ${esc(t.name)}</h4>
        <p class="sz-ausl"><b>Auslöser:</b> ${esc(t.ausloeser)}${t.cue ? ` · <b>Cue:</b> ${esc(t.cue)}` : ""}</p>
        ${t.sehen ? `<p><b>Die Spieler sehen:</b> ${esc(t.sehen)}</p>` : ""}
        ${t.tisch ? `<p><b>Am Tisch:</b> ${esc(t.tisch)}</p>` : ""}
        ${tabelle(["Aktion", "Ergebnis"], t.aktionen)}
        ${t.weiter ? `<p><b>Weiter, wenn</b> ${esc(t.weiter)}</p>` : ""}</section>`).join("");
    const figuren = (map.figuren || []).map(f => `<section class="sz-teil"><h4>${esc(f.name)} (live gespielt)</h4><p><b>Wer:</b> ${esc(f.wer)}</p>
        <p><b>Kernaussagen, kommen immer:</b></p><ol>${f.kern.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        ${tabelle(["Wenn die Helden …", "… sagt sie/er zusätzlich"], f.zusaetze)}
        <p><b>Was sie/er nicht weiß:</b> ${esc(f.nichtWissen)}</p></section>`).join("");
    return `<article class="sz-blatt${opt.druck ? " druck" : ""}">${kopf}<p class="sz-vorlesen">${esc(map.einleitung)}</p>
      <div class="sz-raster">${karteBlock}<div class="sz-text">${missionskarte}
        <section><h4>Konsequenzen</h4>${liste_(map.konsequenzen)}</section>
        <section><h4>Spielleiter-Hinweis</h4><p>${esc(map.hinweis)}</p></section>
        <section><h4>Gegner</h4><p>${esc(map.gegner)}</p>${gegnerHinweis()}</section>
      </div></div>
      ${map.start ? `<section class="sz-teil"><h4>Start je nach Map ${map.nr - 1}</h4>${tabelle(["Weg", "Folge"], map.start)}</section>` : ""}
      ${map.aktionen && map.aktionen.length ? `<section class="sz-teil"><h4>Suchmarker</h4>${tabelle(["Marker", "Hinweis"], map.aktionen)}</section>` : ""}
      ${teile}
      ${map.laerm ? `<section class="sz-teil"><h4>Lärm und Extra-Cues</h4>${tabelle(["Stand", "Was du tust"], map.laerm)}</section>` : ""}
      ${figuren}
      <section class="sz-teil"><h4>Weiter</h4><p>${esc(map.weiter)}</p></section>
    </article>`;
  }
  const gegnerHinweis = () => {
    const p = heldenPunkte();
    return `<p class="hint">${gruppe ? `Gruppe „${esc(gruppe.name)}“` : "Ohne Gruppe"}: ${p} Heldenpunkte. Eine volle Welle hat nach OPR 25 / 50 / 75 / 100 % davon (${S.SCHWIERIGKEIT.map(s => Math.round(p * s.anteil)).join(" / ")} Punkte).</p>`;
  };

  // ---------- Zusatzmission ----------
  function zusatzBogen(sz, opt = {}) {
    const sl = opt.ansicht !== "spieler";
    const d = S.details(sz);
    const k = karteSvg(sz.karte, { druck: opt.druck, geheim: sl, boden: d.schauplatz.boden });
    const punkte = S.wellenPunkte(sz, heldenPunkte(sz));
    const beute = S.BEUTE.map(([w, id, text]) => {
      const e = id === "nichts" ? null : (KS.alleEintraege ? KS.alleEintraege() : []).find(x => x.id === id) || KS.KAT.GRUNDBESTAND.find(x => x.id === id);
      return [String(w), e ? `${e.name}: ${KS.klarText ? KS.klarText(e.text) : e.text}` : text];
    });
    const gegner = i => {
      const w = sz.gegner && sz.gegner[i];
      if (!w) return "";
      return w.einheiten.length ? `<ul class="g-welle-liste">${w.einheiten.map(e => `<li><span class="tier-dot" style="background:var(--t${e.stufe})"></span><b>${esc(e.name)}</b>${e.anzahl > 1 ? ` × ${e.anzahl}` : ""} <small>${e.pts} P.</small></li>`).join("")}</ul>`
        : `<p class="hint">Keine passenden Gegner. Andere Fraktion wählen oder mehr Gegner anlegen.</p>`;
    };
    return `<article class="sz-blatt${opt.druck ? " druck" : ""}">
      <header class="sz-kopf"><p class="eyebrow">Zusatzmission · ${esc(d.schauplatz.name)} · ${esc(d.schwierigkeit.name)}</p>
        <h3 class="sz-titel">${esc(sz.titel)}</h3>
        <p class="sz-meta">${esc(d.ziel.name)} · höchstens ${sz.runden} Runden · ${esc(sz.fraktion || "alle Fraktionen")} · Seed ${sz.seed}</p></header>
      <p class="sz-vorlesen">${esc(sz.einleitung)}</p>
      <div class="sz-raster"><div class="sz-kartenspalte">${k.svg}${legendeHtml(k)}</div>
        <div class="sz-text">
          <section><h4>Hauptziel · ${esc(d.ziel.name)}</h4><p>${esc(d.ziel.haupt)}</p>${liste_(d.ziel.regeln)}</section>
          <section><h4>Nebenziel · ${esc(d.nebenziel.name)}</h4><p>${esc(d.nebenziel.text)}</p><p class="hint">Erscheint erst, wenn das Hauptziel erfüllt ist. Ab dann steigt der Alarm um 3 pro Runde.</p></section>
          <section><h4>Spezialregel · ${esc(d.schauplatz.name)}</h4><p>${esc(d.schauplatz.regel)}</p>${d.komplikation.id !== "keine" ? `<p><b>${esc(d.komplikation.name)}:</b> ${esc(d.komplikation.text)}</p>` : ""}</section>
          <section><h4>Alarm und Ende</h4><p>Alarm startet auf ${sz.alarmStart}, +1 zu jedem Rundenende (+2 ohne Gegner am Tisch, +3 nach dem Hauptziel). Bei ${S.ALARM_MAX}: Verstärkung an einer Feindzone (W6), ein Ereignis würfeln, Verhaltenswürfel ab jetzt wütend, Alarm auf 0.</p>
            <p>Die Mission endet, wenn alle Helden am Ende einer Runde in der Startzone stehen, oder nach Runde ${sz.runden}. Ohne erfülltes Hauptziel ist sie verloren.</p>
            <ol class="sz-leiste">${Array.from({ length: S.ALARM_MAX + 1 }, (_, i) => `<li class="${i === sz.alarmStart ? "start" : ""}${i === S.ALARM_MAX ? " ende" : ""}"><span>${i}</span>${i === S.ALARM_MAX ? "!" : ""}</li>`).join("")}</ol></section>
          <section><h4>Belohnung</h4><p>${sz.ep.haupt} EP je Held für das Hauptziel, ${sz.ep.neben} EP für das Nebenziel. Atemzug-Leiste +1 nach der Mission.</p></section>
        </div></div>
      ${sl ? `<div class="sz-raster sz-unten">
        <section><h4>Gegner</h4><p class="hint">${gruppe ? `Gruppe „${esc(gruppe.name)}“` : "Ohne Gruppe"}: ${heldenPunkte(sz)} Heldenpunkte, ${esc(d.schwierigkeit.name)} (${Math.round(d.schwierigkeit.anteil * 100)} % je volle Welle).${d.ziel.boss ? " Die stärkste Einheit der Startwelle ist die Beute." : ""}</p>
          <ol class="sz-wellen">${punkte.map((w, i) => `<li><b>${esc(w.wann)}</b> <small>${w.punkte} Punkte</small>${gegner(i)}</li>`).join("")}</ol></section>
        <section><h4>Ereignisse (W6)</h4><p class="hint">Zu Spielbeginn und bei jeder Verstärkung.</p><ol class="sz-w6">${d.schauplatz.ereignisse.map(e => `<li>${esc(e)}</li>`).join("")}</ol></section>
        <section><h4>Truhe und Beute</h4><p class="hint">Öffnen: 1 Aktion mit 3+. Dann W6${sz.beute > 1 ? ` + ${sz.beute - 1}` : ""}, höchstens 7.</p>${tabelle(["W6", "Fund"], beute)}</section>
      </div>` : ""}
    </article>`;
  }

  // ---------- Anzeige ----------
  const opt = (liste, wert, leer) => (leer !== undefined ? `<option value="">${esc(leer)}</option>` : "") + liste.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(wert) ? "selected" : ""}>${esc(n)}</option>`).join("");
  function zeigeListe() {
    const k = S.MOOSGRAB;
    $("szKampagne").innerHTML = `<button type="button" class="g-item" data-uebersicht="1" aria-current="${auswahl.art === "uebersicht"}"><b>${esc(k.name)}</b><small>Übersicht und Kampagnenregeln</small></button>
      ${k.maps.map(mp => `<button type="button" class="g-item" data-map="${mp.nr}" aria-current="${auswahl.art === "map" && auswahl.nr === mp.nr}"><b>Map ${mp.nr} · ${esc(mp.titel)}</b><small>${esc(mp.ton)}</small></button>`).join("")}`;
    $("szGespeichert").innerHTML = gespeicherte.length ? gespeicherte.map(x => `<button type="button" class="g-item" data-sz="${esc(x.id)}" aria-current="${auswahl.art === "zusatz" && auswahl.sz && auswahl.sz.id === x.id}"><b>${esc(x.name)}</b><small>${esc((S.ZIELE.find(z => z.id === x.ziel) || {}).name || "")}</small></button>`).join("") : `<p class="hint">Noch keine gespeichert.</p>`;
  }
  function kopfleiste() {
    const istMap = auswahl.art === "map", istZusatz = auswahl.art === "zusatz";
    const map = istMap ? S.MOOSGRAB.maps.find(x => x.nr === auswahl.nr) : null;
    return `<div class="sz-leiste-oben">
      <div class="chipset" role="group" aria-label="Ansicht">
        <button type="button" class="chip-f" data-ansicht="sl" aria-pressed="${ansicht === "sl"}">Spielleiter</button>
        <button type="button" class="chip-f" data-ansicht="spieler" aria-pressed="${ansicht === "spieler"}">Spieler (ohne Geheimnisse)</button>
      </div>
      <label class="f">Gruppe <select id="szGruppe">${opt(gruppen.map(x => [x.id, x.name]), gruppe ? gruppe.id : "", "Keine")}</select></label>
      ${istMap ? `<label class="f">Tisch <select id="szTischMap">${opt(S.TISCHE.map(t => [t.id, t.name + (t.id === map.empfohlen ? " (empfohlen)" : "")]), tisch || map.empfohlen)}</select></label>` : ""}
      ${istMap || istZusatz ? `<button type="button" class="btn sm" id="szDruck">Drucken (A4)</button>` : ""}
      ${istZusatz ? `<button type="button" class="btn ghost sm" id="szGegner">Gegner würfeln</button><button type="button" class="btn ghost sm" id="szSpeichern">Speichern</button>${auswahl.sz.id ? `<button type="button" class="btn ghost sm" id="szWeg">Löschen</button>` : ""}` : ""}
      <p class="hint" id="szMsg" role="status"></p>
    </div>`;
  }
  function generator() {
    const f = auswahl.art === "zusatz" ? auswahl.sz : {};
    const fraktionen = [...new Set(KS.KAT.FRAKTIONEN.filter(x => x.id !== "helden").map(x => x.name))];
    return `<details class="gen sz-gen" ${auswahl.art === "zusatz" ? "" : "open"}><summary><h3>Zusatzmission würfeln</h3></summary>
      <p class="hint">Für Abende zwischen den Maps oder wenn eine Map schneller vorbei war. Alles leer lassen heißt Zufall.</p>
      <div class="row4">
        <label class="f">Schauplatz <select id="szOrt">${opt(S.SCHAUPLAETZE.map(x => [x.id, x.name]), f.schauplatz, "Zufall")}</select></label>
        <label class="f">Hauptziel <select id="szZiel">${opt(S.ZIELE.map(x => [x.id, x.name]), f.ziel, "Zufall")}</select></label>
        <label class="f">Nebenziel <select id="szNeben">${opt(S.NEBENZIELE.map(x => [x.id, x.name]), f.nebenziel, "Zufall")}</select></label>
        <label class="f">Komplikation <select id="szKompl">${opt(S.KOMPLIKATIONEN.map(x => [x.id, x.name]), f.komplikation, "Zufall")}</select></label>
      </div>
      <div class="row4">
        <label class="f">Gegner-Fraktion <select id="szFraktion">${opt(fraktionen.map(x => [x, x]), f.fraktion, "Passend zum Ort")}</select></label>
        <label class="f">Schwierigkeit <select id="szSchw">${opt(S.SCHWIERIGKEIT.map(x => [x.stufe, `${x.stufe} · ${x.name}`]), f.schwierigkeit || 2)}</select></label>
        <label class="f">Tisch <select id="szTisch">${opt(S.TISCHE.map(t => [t.id, t.name]), f.tisch || S.TISCHE[0].id)}</select></label>
        <label class="f">Heldenpunkte ohne Gruppe <input type="number" id="szPunkte" min="20" step="5" value="${+f.ersatzPunkte || 345}" ${gruppe ? "disabled" : ""}></label>
      </div>
      <div class="copyrow"><button type="button" class="btn sm" id="szWuerfeln">Würfeln</button>${auswahl.art === "zusatz" ? `<button type="button" class="btn ghost sm" id="szKarteNeu">Nur Karte neu</button>` : ""}</div>
    </details>`;
  }
  function uebersicht() {
    const k = S.MOOSGRAB, sl = ansicht === "sl";
    return `<article class="sz-blatt"><header class="sz-kopf"><p class="eyebrow">Kampagne</p><h3 class="sz-titel">${esc(k.name)}</h3></header>
      <p>${esc(k.text)}</p>
      ${sl ? `<section class="sz-teil"><h4>Die Wahrheit hinter Moosgrab (nur Spielleiter)</h4><p>${esc(k.wahrheit)}</p></section>` : ""}
      <section class="sz-teil"><h4>Die fünf Maps</h4>${tabelle(["Map", "Ort", "Ton", "Tisch", "Stand"], k.maps.map(mp => [String(mp.nr), mp.titel, mp.ton, S.tischVon(mp.empfohlen).name, sl ? mp.stand : ""]))}</section>
      <section class="sz-teil"><h4>Kampagnenregeln</h4>${tabelle(["Regel", "Gilt in", "So funktioniert sie"], k.leisten.map(l => [l.name, l.gilt, l.text]))}</section>
      <p class="hint">Quelle: Chris' Kampagnenbibel (Claude-Dokument) und docs/KAMPAGNEN_UEBERGABE.md. Map 3 bis 5 sind hier neu ausgeschrieben und warten auf Abnahme.</p>
    </article>`;
  }
  function inhalt() {
    if (auswahl.art === "map") { const map = S.MOOSGRAB.maps.find(x => x.nr === auswahl.nr); return mapBogen(map, { ansicht, tisch }); }
    if (auswahl.art === "zusatz") return zusatzBogen(auswahl.sz, { ansicht }) + `<label class="f">Notizen des Spielleiters <textarea id="szNotiz" rows="3">${esc(auswahl.sz.notiz || "")}</textarea></label>`;
    return uebersicht();
  }
  // Der Generator steht auf der Übersicht und bei Zusatzmissionen, nicht über einer Kampagnen-Map
  function zeige() { $("szMain").innerHTML = kopfleiste() + (auswahl.art === "map" ? "" : generator()) + inhalt(); }

  const wert = id => { const e = $(id); return e ? e.value : ""; };
  function wuerfle(nurKarte) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    if (nurKarte && auswahl.art === "zusatz") {
      const sz = auswahl.sz, d = S.details(sz);
      sz.karte = S.baueKarte(S.rng(seed), d.schauplatz, d.ziel, { tisch: wert("szTisch") || sz.tisch, komplikation: sz.komplikation });
      sz.tisch = sz.karte.tisch; return;
    }
    const o = { schauplatz: wert("szOrt"), ziel: wert("szZiel"), nebenziel: wert("szNeben"), komplikation: wert("szKompl"), schwierigkeit: +wert("szSchw") || 2, tisch: wert("szTisch"), seed };
    if (wert("szFraktion")) o.fraktion = wert("szFraktion");
    const sz = S.erzeuge(o);
    sz.ersatzPunkte = +wert("szPunkte") || 345;
    auswahl = { art: "zusatz", sz };
  }
  function wuerfleGegner() {
    const sz = auswahl.sz;
    sz.gegner = S.wellenPunkte(sz, heldenPunkte(sz)).map((w, i) => KS.KAT.welleWuerfeln(pool(), w.punkte, { schwierigkeit: sz.schwierigkeit, fraktion: sz.fraktion || "", seed: (sz.seed + 7919 * (i + 1) + Date.now()) >>> 0 }));
  }
  function drucken() {
    const bereich = $("printArea");
    const html = auswahl.art === "map" ? mapBogen(S.MOOSGRAB.maps.find(x => x.nr === auswahl.nr), { ansicht, tisch, druck: true }) : zusatzBogen(auswahl.sz, { ansicht, druck: true });
    bereich.innerHTML = `<div class="sz-seite">${html}</div>`;
    bereich.classList.add("bereit");
    requestAnimationFrame(() => window.print());
  }

  function verdrahten() {
    const tab = $("tabSzenarien");
    tab.addEventListener("change", async e => {
      const id = e.target.id;
      if (id === "szGruppe") { gruppe = e.target.value && G() ? await G().gruppe(e.target.value) : null; zeige(); }
      else if (id === "szTischMap") { tisch = e.target.value; zeige(); }
      else if (id === "szPunkte" && auswahl.art === "zusatz") { auswahl.sz.ersatzPunkte = Math.max(20, +e.target.value || 345); zeige(); }
      else if (id === "szNotiz" && auswahl.art === "zusatz") auswahl.sz.notiz = e.target.value.slice(0, 4000);
    });
    tab.addEventListener("click", async e => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.ansicht) { ansicht = t.dataset.ansicht; merke(); zeige(); return; }
      if (t.dataset.uebersicht) { auswahl = { art: "uebersicht" }; zeigeListe(); zeige(); return; }
      if (t.dataset.map) { auswahl = { art: "map", nr: +t.dataset.map }; tisch = ""; zeigeListe(); zeige(); return; }
      if (t.dataset.sz) { const sz = await lade(t.dataset.sz); if (sz) auswahl = { art: "zusatz", sz }; zeigeListe(); zeige(); return; }
      if (t.id === "szWuerfeln") { wuerfle(false); zeigeListe(); zeige(); }
      else if (t.id === "szKarteNeu") { wuerfle(true); zeige(); }
      else if (t.id === "szGegner") { wuerfleGegner(); zeige(); }
      else if (t.id === "szSpeichern") await speichere(auswahl.sz);
      else if (t.id === "szDruck") drucken();
      else if (t.id === "szWeg") {
        if (t.dataset.sicher !== "1") { t.dataset.sicher = "1"; t.textContent = "Wirklich löschen?"; return; }
        await loesche(auswahl.sz);
      }
    });
  }

  window.KartenschmiedeSzenarien = {
    async zeigen() {
      if (!geladen) {
        geladen = true; verdrahten();
        try { await liste(); } catch { gespeicherte = []; }
        try { gruppen = G() ? await G().gruppen() : []; } catch { gruppen = []; }
      }
      zeigeListe(); zeige();
    },
    mapBogen, zusatzBogen, karteSvg, MARKER,
  };
  if (!$("tabSzenarien").hidden) window.KartenschmiedeSzenarien.zeigen();
})();

/* Kartenschmiede – Reiter „Spielen“: der Laptop als Spielleiter-Bildschirm.
   Spielt eine Map Schritt für Schritt ab (Motor: spiel-motor.js, Daten: kampagnen/<kampagne>/mapN.json):
   Schrittkarte in der Mitte, Leisten oben, Gegnerspalte rechts mit verdeckten Zuständen, NPC-Fenster, Antwortwahl,
   Audio-Cues zum Abspielen. Der Spielstand liegt auf dem Server (/api/kartenschmiede/spielstaende), Audio unter
   /api/kartenschmiede/audio. Braucht window.KS (app.js), Szenarien (szenarien.js) und SpielMotor. */
(function () {
  "use strict";
  const KS = window.KS, S = window.Szenarien, SM = window.SpielMotor;
  const { esc, R } = KS;
  const $ = id => document.getElementById(id);
  const MAPS = window.SPIELMODUS_MAPS || [];
  const API_STAND = "/api/kartenschmiede/spielstaende", API_AUDIO = "/api/kartenschmiede/audio";
  const LOKAL = "kartenschmiede-spielstaende";

  // Farbe und Etikett je Schritttyp (dieselben Zeichen wie im Playbook)
  const TYP = {
    vorbereitung: ["🟦", "DU · Vorbereitung", "blau"], aufbau: ["🟦", "DU · Aufbau", "blau"], cue: ["🟪", "CUE", "lila"],
    vorlesen: ["🗣️", "VORLESEN", "messing"], regel: ["🟨", "REGEL ansagen", "gelb"], spieler: ["🟥", "SPIELER sind dran", "rot"],
    wahl: ["🟥", "SPIELER entscheiden", "rot"], kampf: ["🟧", "KAMPF", "orange"], npc: ["🗣️", "NPC · du spielst", "messing"], ende: ["🟩", "ENDE der Map", "gruen"],
  };

  let map = null, motor = null, stand = null, standId = null;
  let staende = [], audio = {}, helden = [];
  const lokaleAudios = {}, wuerfe = {};
  let markiert = null, fenster = null, eingabeFuer = null;
  let geladen = false, speicherTakt = null;
  const spieler = { haupt: new Audio(), schleife: new Audio() };
  spieler.schleife.loop = true;

  // ---------- Ablage ----------
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, "");
  const lokal = () => { try { return JSON.parse(localStorage.getItem(LOKAL) || "[]"); } catch { return []; } };
  // Die letzte Meldung überlebt das Neuzeichnen; ein neuer Schritt räumt sie weg
  let meldung = "";
  const melde = t => { meldung = t; const m = $("spMsg"); if (m) m.textContent = t; };
  async function ladeListe() {
    if (!KS.SERVER) { staende = lokal().map(x => ({ id: x.id, name: x.name, kampagne: x.kampagne })); return; }
    const r = await fetch(API_STAND, { credentials: "same-origin" });
    staende = r.ok ? (await r.json()).spielstaende : [];
  }
  async function ladeStand(id) {
    if (!KS.SERVER) return lokal().find(x => x.id === id) || null;
    const r = await fetch(`${API_STAND}/${encodeURIComponent(id)}`, { credentials: "same-origin" });
    return r.ok ? (await r.json()).inhalt : null;
  }
  async function speichere() {
    if (!stand) return;
    // Den Undo-Stapel nicht mitspeichern: Er ist groß und gilt nur für diesen Abend am Laptop
    const inhalt = { ...stand, undo: [], id: standId };
    if (!KS.SERVER) {
      try { localStorage.setItem(LOKAL, JSON.stringify(lokal().filter(x => x.id !== standId).concat(inhalt))); } catch { melde("Browser-Speicher voll."); }
      return;
    }
    const r = await fetch(`${API_STAND}/${encodeURIComponent(standId)}`, { method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inhalt }) });
    // Erfolg bleibt still, sonst überschreibt jedes Speichern die eigentliche Meldung
    if (!r.ok) melde("Speichern fehlgeschlagen. Bist du noch eingeloggt?");
  }
  const spaeter = () => { clearTimeout(speicherTakt); speicherTakt = setTimeout(speichere, 700); };

  // ---------- Audio ----------
  const audioId = cue => `${map.kampagne}-${String(cue).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  async function ladeAudio() {
    if (!KS.SERVER) return;
    const r = await fetch(API_AUDIO, { credentials: "same-origin" });
    audio = r.ok ? Object.fromEntries((await r.json()).audio.map(a => [a.id, a])) : {};
  }
  const hatAudio = cue => !!(audio[audioId(cue)] || lokaleAudios[audioId(cue)]);
  const audioUrl = cue => lokaleAudios[audioId(cue)] || `${API_AUDIO}/${encodeURIComponent(audioId(cue))}?v=${encodeURIComponent((audio[audioId(cue)] || {}).updatedAt || "")}`;
  function spiele(cue) {
    if (!hatAudio(cue)) { melde(`Für ${cue} ist noch keine Datei hochgeladen.`); return; }
    const def = map.audio[cue] || {};
    const el = def.schleife ? spieler.schleife : spieler.haupt;
    if (el.dataset.cue === cue && !el.paused) { el.pause(); zeige(); return; }
    if (el.dataset.cue !== cue) { el.src = audioUrl(cue); el.dataset.cue = cue; }
    el.play().catch(() => melde("Der Browser hat das Abspielen blockiert. Einmal auf die Seite klicken, dann nochmal."));
    zeige();
  }
  function stoppe(cues) {
    for (const el of [spieler.haupt, spieler.schleife]) if (!cues || cues.includes(el.dataset.cue)) { el.pause(); el.currentTime = 0; }
  }
  async function ladeHoch(cue, datei) {
    if (!KS.SERVER) { lokaleAudios[audioId(cue)] = URL.createObjectURL(datei); zeige(); melde(`${cue}: nur für diese Sitzung geladen (eigenständige Seite).`); return; }
    melde(`${cue} wird hochgeladen …`);
    const r = await fetch(`${API_AUDIO}/${encodeURIComponent(audioId(cue))}`, { method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": datei.type || "audio/mpeg", "x-dateiname": encodeURIComponent(datei.name) }, body: datei });
    melde(r.ok ? `${cue} hochgeladen.` : `Hochladen fehlgeschlagen (${r.status}).`);
    await ladeAudio(); zeige();
  }
  for (const el of [spieler.haupt, spieler.schleife]) for (const ev of ["play", "pause", "ended"]) el.addEventListener(ev, () => { if (geladen && !$("tabSpielen").hidden) zeigeLeiste(); });

  // ---------- Gegner und Helden ----------
  function werteFuer(def) {
    if (!def) return {};
    if (def.werte) return def.werte;
    const [art, key] = String(def.karte || "").split(":");
    if (art === "v") { const v = KS.VORLAGEN.find(x => x.key === key); return v ? v.d : {}; }
    if (art === "k") { const k = (KS.serverKarten() || []).find(x => x.id === key); return k ? { ...(k.werte || {}), name: k.name } : {}; }
    return {};
  }
  const stufeFuer = werte => (werte && werte.quality ? R.stufeFuerPunkte(R.punkte(werte).pts) : 1);
  async function ladeHelden() {
    helden = [];
    const G = window.KartenschmiedeGruppe;
    if (G && stand && stand.gruppeId) {
      const g = await G.gruppe(stand.gruppeId);
      if (g) helden = g.mitglieder.filter(k => k.role === "hero").map(k => k.name);
    }
    if (!helden.length) helden = KS.VORLAGEN.filter(v => v.d.role === "hero").map(v => v.d.name);
  }

  // ---------- Start ----------
  function waehleMap(nr) {
    for (const k of Object.keys(wuerfe)) delete wuerfe[k];
    map = MAPS.find(m => String(m.map) === String(nr)) || MAPS[0];
    motor = map ? SM.erstelle(map, { werte: werteFuer, stufe: stufeFuer }) : null;
  }
  async function neuerAbend() {
    const nr = $("spMapWahl") ? $("spMapWahl").value : (MAPS[0] || {}).map;
    waehleMap(nr);
    // Kampagnen-Leisten und Flags aus dem zuletzt gespeicherten Stand derselben Kampagne übernehmen
    let uebernahme = null;
    const vorher = staende.find(x => x.kampagne === map.kampagne);
    if (vorher) { const alt = await ladeStand(vorher.id); if (alt && alt.map < map.map) uebernahme = alt.uebernahme || null; }
    const gruppeId = $("spGruppe") ? $("spGruppe").value || null : null;
    standId = neueId();
    stand = motor.neu({ name: `${map.titel} · ${new Date().toLocaleDateString("de-DE")}`, gruppeId, uebernahme });
    await ladeHelden();
    await speichere(); await ladeListe();
    zeige();
  }
  async function oeffne(id) {
    const s = await ladeStand(id);
    if (!s) { melde("Spielstand nicht gefunden."); return; }
    waehleMap(s.map);
    stand = Object.assign(s, { undo: [] });
    standId = id;
    await ladeHelden();
    zeige();
  }

  // ---------- Aktionen (jede speichert danach) ----------
  function tue(fn) {
    if (!stand) return;
    const vorher = stand.schritt, vorherLetzte = stand.letzte;
    fn();
    // Beutewürfe gehören zu den gerade angezeigten Ereignissen; neue Ereignisse, neue Würfe
    if (stand.letzte !== vorherLetzte || stand.schritt !== vorher) for (const k of Object.keys(wuerfe)) if (k !== "ende") delete wuerfe[k];
    const s = motor.schritt(stand);
    if (s && s.typ === "ende") stand.uebernahme = motor.uebernahme(stand);
    if (s && stand.schritt !== vorher) { markiert = null; meldung = ""; if (s.stoppt) stoppe(s.stoppt); if (s.typ === "npc") fenster = "npc"; }
    spaeter();
    zeige();
  }
  // Ein Kampf ohne erreichtes Ziel endet nur mit Klick, nicht mit der Leertaste (sonst ist die Frau aus Versehen verloren)
  const kampfOffen = s => s && s.typ === "kampf" && !stand.kampfZiel;
  const weiter = () => tue(() => motor.weiter(stand));
  const zurueck = () => tue(() => motor.zurueck(stand));
  const runde = () => tue(() => { const r = motor.runde(stand); if (r.texte.length) melde(`Runde ${stand.runde} beendet: ${r.texte.join(" ")}`); });
  function waehle(taste) {
    const s = motor.schritt(stand);
    const o = s && s.optionen && s.optionen.find(x => String(x.taste) === String(taste));
    if (!o) return;
    if (o.eingabe) { eingabeFuer = o; fenster = "eingabe"; zeige(); return; }
    tue(() => motor.waehle(stand, taste));
  }
  function eingabeFertig(wert) {
    const o = eingabeFuer;
    fenster = null; eingabeFuer = null;
    if (o && wert) tue(() => motor.waehle(stand, o.taste, wert)); else zeige();
  }

  // ---------- Anzeige ----------
  const symText = t => (KS.symText ? KS.symText(t) : esc(t));
  const liste = (punkte, cls = "") => punkte && punkte.length ? `<ul class="${cls}">${punkte.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
  const vorlesen = (text, wer) => text ? `<blockquote class="sp-lies">${wer ? `<small>${esc(wer)}</small>` : ""}${esc(text)}</blockquote>` : "";
  const gm = text => text ? `<p class="sp-gm">${esc(text)}</p>` : "";

  function zeigeLeiste() {
    const el = $("spLeiste");
    if (!el || !stand) { if (el) el.innerHTML = ""; return; }
    const leisten = Object.entries(map.leisten).filter(([k]) => stand.leisten[k] && stand.leisten[k].aktiv).map(([k, def]) => {
      const l = stand.leisten[k];
      return `<span class="sp-pill" title="${esc(def.text || "")}"><b>${esc(def.name)}</b> ${Array.from({ length: def.max - def.min }, (_, i) => `<i class="${i < l.wert - def.min ? "an" : ""}"></i>`).join("")} <em>${l.wert}</em></span>`;
    }).join("");
    const laeuft = [spieler.haupt, spieler.schleife].filter(a => !a.paused).map(a => a.dataset.cue);
    const s = motor.schritt(stand), runden = stand.rundenAktiv && s && s.typ !== "ende";
    const vor = s && s.typ !== "wahl" && motor.naechsterId(stand);
    el.innerHTML = `${runden ? `<span class="sp-pill"><b>Runde</b> <em>${stand.runde + 1}</em></span>` : ""}${leisten}
      <span class="sp-pill sp-verhalten ${motor.wuetend(stand) ? "wuetend" : ""}"><b>Gegner</b> ${motor.wuetend(stand) ? "WÜTEND" : "ruhig"}</span>
      ${laeuft.length ? `<span class="sp-pill sp-ton">♪ ${esc(laeuft.join(", "))} <button type="button" class="btn ghost sm" data-sp="stopp">■ Stopp (S)</button></span>` : ""}
      <span class="sp-knoepfe">${runden ? `<button type="button" class="btn sm" data-sp="runde" title="Taste R">Runde beenden (R)</button>` : ""}
      <button type="button" class="btn ghost sm" data-sp="zurueck" title="Taste Backspace" ${stand.undo.length ? "" : "disabled"}>← Zurück</button>
      ${vor ? `<button type="button" class="btn sm ${kampfOffen(s) ? "ghost" : ""}" data-sp="weiter" title="Leertaste">Weiter →</button>` : ""}</span>`;
  }

  function cueKnopf(cue, gross) {
    const def = map.audio[cue] || {};
    const da = hatAudio(cue);
    const laeuft = [spieler.haupt, spieler.schleife].some(a => a.dataset.cue === cue && !a.paused);
    return `<div class="sp-cue ${gross ? "gross" : ""}">
      <button type="button" class="btn ${da ? "" : "ghost"}" data-cue="${esc(cue)}" ${da ? "" : "disabled"}>${laeuft ? "❚❚ Pause" : "▶ Abspielen"}${gross ? " (A)" : ""}</button>
      <span><b>${esc(cue)}</b> ${esc(def.titel || "")}${def.schleife ? " · Schleife" : ""}${def.dauer ? ` · ${esc(def.dauer)}` : ""}</span>
      ${`<label class="btn ghost sm sp-upload">${da ? "Ersetzen" : "MP3 hochladen"}<input type="file" accept="audio/*" data-hoch="${esc(cue)}" hidden></label>`}
    </div>`;
  }

  function skizze(art) {
    const mp = (S.MOOSGRAB.maps || []).find(x => x.nr === map.map);
    const sz = window.KartenschmiedeSzenarien;
    if (!mp || !sz || !sz.karteSvg) return "";
    const { svg } = sz.karteSvg(mp.karte, { geheim: true, boden: "#1d2620" });
    const t = mp.karte.t, b = mp.karte.b;
    // Die Hälfte, die noch nicht steht, wird abgedunkelt
    const decke = art === "unten" ? `<rect x="0" y="0" width="${b}" height="${t / 2}" fill="#000" opacity=".62"/>` : "";
    return `<div class="sp-skizze">${decke ? svg.replace("</svg>", `${decke}</svg>`) : svg}<small>${art === "unten" ? "Nur die untere Hälfte aufbauen (oben abgedunkelt)." : art === "oben" ? "Jetzt die obere Hälfte dazu." : ""}</small></div>`;
  }

  function ereignisKnoepfe(ids) {
    const da = (ids || []).filter(id => map.ereignisse[id] && !map.ereignisse[id].intern);
    if (!da.length) return "";
    return `<div class="sp-ereignisse"><h4>Jederzeit</h4>${da.map(id => {
      const e = map.ereignisse[id], ok = motor.ereignisErlaubt(stand, id), schon = stand.ereignisse[id];
      return `<button type="button" class="btn ${ok ? "ghost" : "ghost aus"} sm" data-ev="${esc(id)}" ${ok ? "" : "disabled"} title="${esc(e.kosten || "")}">${e.taste ? `<kbd>${esc(e.taste)}</kbd> ` : ""}${esc(e.name)}${schon ? " ✓" : ""}</button>`;
    }).join("")}</div>`;
  }

  function letzteEreignisse() {
    if (!stand.letzte || !stand.letzte.length) return "";
    return `<div class="sp-letzte"><h4>Gerade passiert</h4>${stand.letzte.map((e, i) => `<div class="sp-ev"><h4>${esc(e.name)}</h4>${vorlesen(e.vorlesen)}${gm(e.gmNotiz)}
      ${e.beutewurf ? `<p>${wuerfe[i] ? `<b>Beutewurf: ${wuerfe[i].wurf}</b> · ${esc(wuerfe[i].text)}` : `<button type="button" class="btn ghost sm" data-wurf="${i}">Beutewurf W6</button>`}</p>` : ""}</div>`).join("")}</div>`;
  }

  function schrittInhalt(s) {
    switch (s.typ) {
      case "vorbereitung": return `<ul class="sp-check">${(s.checkliste || []).map((c, i) => {
        const k = `${stand.schritt}:${i}`;
        return `<li><label><input type="checkbox" data-check="${esc(k)}" ${stand.checks[k] ? "checked" : ""}> ${esc(c)}</label></li>`;
      }).join("")}</ul>${gm(s.hinweis)}${stand.schritt === "vorb-stand" ? audioListe() : ""}`;
      case "aufbau": return `${liste(s.tisch, "sp-tisch")}${s.regel ? `<h4>Sag an</h4>${vorlesen(s.regel)}` : ""}${gm(s.hinweis)}${skizze(s.skizze)}`;
      case "cue": return `${cueKnopf(s.cue, true)}${gm(s.notiz)}${s.optional && !hatAudio(s.cue) ? `<p class="sp-gm">Kein Track da: einfach weiter, du spielst die Szene live.</p>` : ""}`;
      case "vorlesen": return `${vorlesen(s.text, s.als && map.figuren[s.als] ? map.figuren[s.als].name : "")}${gm(s.gmNotiz)}`;
      case "regel": return vorlesen(s.text);
      case "spieler": return `<p class="sp-text">${esc(s.text || "")}</p>${liste(s.hinweise, "sp-hinweise")}`;
      case "npc": {
        const f = map.figuren[s.figur] || {};
        return `${vorlesen(s.einstieg, f.name)}${gm(s.gmNotiz)}<button type="button" class="btn ghost sm" data-sp="npc">NPC-Karte öffnen (N)</button>`;
      }
      case "wahl": return `${s.ansage ? vorlesen(s.ansage) : ""}<p class="sp-text">${esc(s.frage || "")}</p>
        <div class="sp-optionen">${s.optionen.map(o => `<button type="button" class="sp-option" data-wahl="${esc(o.taste)}">
          <kbd>${esc(o.taste)}</kbd><span><b>${esc(o.kurz)}</b><small>${esc(o.text || "")}</small><em>Folge: ${esc(o.folge || "–")}</em></span></button>`).join("")}</div>`;
      case "kampf": {
        const ziel = stand.kampfZiel ? `<p class="sp-ziel">Ziel erreicht. Weiter führt zu: <b>${esc((map.schritte[stand.kampfZiel] || {}).titel || stand.kampfZiel)}</b></p>` : "";
        return `<p class="sp-text">${symText(s.text || "")}</p>${liste(s.hinweise, "sp-hinweise")}${ziel}${verhaltenTabelle()}`;
      }
      case "ende": {
        const ep = motor.epListe(stand);
        return `<h4>Erfahrung</h4><ul>${ep.map(e => `<li class="${e.erreicht ? "ja" : "nein"}">${e.erreicht ? "✓" : "✗"} ${esc(e.text)}: ${e.ep} EP</li>`).join("")}</ul>
          <h4>Beute</h4>${liste(s.beute)}<p><button type="button" class="btn ghost sm" data-wurf="ende">Beutewurf W6</button> ${wuerfe.ende ? `<b>${wuerfe.ende.wurf}</b> · ${esc(wuerfe.ende.text)}` : ""}</p>
          <h4>Folgen für die nächste Map</h4>${liste(motor.folgen(stand), "sp-folgen")}
          <h4>Notieren</h4>${liste(s.notieren)}<p class="sp-gm">${esc((s.zuruecksetzen || []).join(", "))} zurücksetzen. Der Spielstand ist gespeichert; die nächste Map übernimmt Atemzug und Flags.</p>`;
      }
      default: return "";
    }
  }
  function verhaltenTabelle() {
    const art = motor.wuetend(stand) ? "wuetend" : "ruhig";
    const zeilen = (map.verhalten || {})[art] || [];
    return `<table class="sz-tab sp-verh"><thead><tr><th>W6</th><th>Gegner ${art === "wuetend" ? "wütend" : "ruhig"}</th></tr></thead><tbody>${zeilen.map(([w, t]) => `<tr><td>${esc(w)}</td><td>${esc(t)}</td></tr>`).join("")}</tbody></table>${gm(map.verhalten && map.verhalten.notiz)}`;
  }
  function audioListe() {
    return `<h4>Audio-Cues dieser Map</h4><div class="sp-audioliste">${Object.keys(map.audio).map(c => cueKnopf(c, false)).join("")}</div>`;
  }

  function gegnerSpalte() {
    const aktiv = stand.gegner.filter(g => !g.weg);
    if (!aktiv.length) return `<p class="hint">Noch keine Gegner am Tisch.</p>`;
    return aktiv.map(g => {
      const def = map.gegner[g.id] || {}, z = motor.zustand(g), b = motor.bedrohung(def);
      return `<div class="sp-gegner ${markiert === g.uid ? "markiert" : ""} ${z.id === "gefallen" ? "gefallen" : ""}" data-gegner="${esc(g.uid)}">
        <div class="sp-g-kopf"><b>${esc(def.name || g.id)}</b>${g.zone ? `<small>Zone ${esc(g.zone)}</small>` : ""}<span class="sp-schaedel" title="Bedrohung">${"☠".repeat(b.schaedel)}</span></div>
        <div class="sp-g-balken">${Array.from({ length: g.zaeh }, (_, i) => `<i class="${i < g.wunden ? "wunde" : ""}"></i>`).join("")}<em>${g.wunden}/${g.zaeh}</em></div>
        <p class="sp-g-zustand"><b>${esc(z.id)}</b> „${esc(z.satz)}“</p>
        <div class="sp-g-knoepfe"><button type="button" class="btn sm" data-dmg="1">+1</button><button type="button" class="btn sm" data-dmg="2">+2</button><button type="button" class="btn ghost sm" data-dmg="-1">−1</button>
          <button type="button" class="btn ghost sm" data-karte="1">Karte</button>${z.id === "gefallen" ? `<button type="button" class="btn ghost sm" data-weg="1">vom Tisch</button>` : ""}</div>
        ${b.satz && g.wunden === 0 ? `<p class="sp-gm">Bedrohung ansagen: „${esc(b.satz)}“</p>` : ""}
      </div>`;
    }).join("");
  }

  function fensterHtml() {
    if (fenster === "npc") {
      const s = [...stand.verlauf].reverse().map(id => map.schritte[id]).find(x => x && x.typ === "npc");
      const f = s && map.figuren[s.figur];
      if (!f) return "";
      return `<div class="sp-fenster" role="dialog" aria-label="${esc(f.name)}"><div class="sp-fenster-innen">
        <header><h3>${esc(f.name)}</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen (Esc)</button></header>
        <p>${esc(f.wer || "")}</p><p><b>Stimme:</b> ${esc(f.stimme || "")}</p><p><b>Will:</b> ${esc(f.motiv || "")}</p>
        <h4>Sätze, die immer kommen</h4>${(f.kern || []).map(k => vorlesen(k)).join("")}
        ${f.wennSieFragen ? `<h4>Wenn sie fragen …</h4><table class="sz-tab"><tbody>${f.wennSieFragen.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>` : ""}
        <h4>Was sie nicht weiß</h4>${liste(f.nichtWissen)}
      </div></div>`;
    }
    if (fenster === "eingabe" && eingabeFuer) {
      const e = eingabeFuer.eingabe;
      const auswahl = e.aus === "offene-marker" ? motor.offeneMarker(stand).map(id => [id, map.ereignisse[id].name]) : helden.map(h => [h, h]);
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen klein">
        <header><h3>${esc(e.frage)}</h3><button type="button" class="btn ghost sm" data-sp="zu">Abbrechen</button></header>
        <div class="sp-optionen">${auswahl.map(([w, n], i) => `<button type="button" class="sp-option" data-eingabe="${esc(w)}"><kbd>${i + 1}</kbd><span><b>${esc(n)}</b></span></button>`).join("")}</div>
        ${e.aus === "gruppe" ? `<label class="f">Oder Name eintippen <input type="text" id="spEingabeFrei" placeholder="Name des Helden"></label><button type="button" class="btn sm" data-sp="eingabe-frei">Übernehmen</button>` : ""}
      </div></div>`;
    }
    if (fenster && fenster.startsWith("karte:")) {
      const g = stand.gegner.find(x => x.uid === fenster.slice(6));
      const werte = g && werteFuer(map.gegner[g.id]);
      if (!werte || !werte.quality) return "";
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen karte">
        <header><h3>${esc(werte.name || "")}</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen (Esc)</button></header>
        <div class="sp-kartenbox">${KS.renderCard(werte, stufeFuer(werte), {})}</div>${gm((map.gegner[g.id] || {}).notiz)}
      </div></div>`;
    }
    return "";
  }

  function zeige() {
    const main = $("spMain");
    if (!main) return;
    if (!stand) {
      document.body.classList.remove("sp-laeuft");
      main.innerHTML = `<div class="sp-start"><p class="lede">Wähle einen Spielstand oder starte einen neuen Abend.</p>
        <div class="row4"><label class="f">Map <select id="spMapWahl">${MAPS.map(m => `<option value="${m.map}">${esc(m.kampagne)} · Map ${m.map}: ${esc(m.titel)}</option>`).join("")}</select></label>
        <label class="f">Gruppe <select id="spGruppe"><option value="">Ohne Gruppe (Vorlagen-Helden)</option>${(window.__spGruppen || []).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select></label></div>
        <div class="copyrow"><button type="button" class="btn" data-sp="neu">Neuen Abend starten</button></div>
        ${staende.length ? `<h4>Gespeicherte Abende</h4><div class="sp-staende">${staende.map(x => `<button type="button" class="g-item" data-stand="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.kampagne)}</small></button>`).join("")}</div>` : ""}
        <p class="hint" id="spMsg" role="status">${esc(meldung)}</p></div>`;
      return;
    }
    document.body.classList.add("sp-laeuft");
    const s = motor.schritt(stand);
    const [zeichen, etikett, farbe] = TYP[s.typ] || ["", s.typ, ""];
    const naechster = motor.naechsterId(stand);
    const nachTitel = naechster && map.schritte[naechster] ? map.schritte[naechster].titel : "";
    const ids = Object.keys(map.schritte), pos = ids.indexOf(stand.schritt) + 1;
    main.innerHTML = `<div class="sp-kopf"><div><p class="eyebrow">${esc(map.kampagne)} · Map ${map.map} · ${esc(map.titel)}</p><p class="hint">${esc(stand.name)} · Schritt ${pos} von ${ids.length}</p></div>
        <button type="button" class="btn ghost sm" data-sp="schliessen">Abend wechseln</button></div>
      <div class="sp-leiste" id="spLeiste"></div>
      <div class="sp-raster">
        <section class="sp-karte typ-${farbe}">
          <header><span class="sp-typ">${zeichen} ${esc(etikett)}</span><h3>${esc(s.titel || "")}</h3></header>
          ${schrittInhalt(s)}
          ${letzteEreignisse()}
          ${ereignisKnoepfe(s.ereignisse)}
          <footer>${s.typ === "wahl" ? `<span class="hint">Wähle eine Antwort (1–${s.optionen.length}).</span>` : !naechster ? `<span class="hint">Ende der Map.</span>`
            : kampfOffen(s) ? `<button type="button" class="btn ghost" data-sp="weiter">Ohne Ziel weiter → ${esc(nachTitel)}</button><span class="hint">Nur klicken, wenn der Kampf so endet. Die Leertaste springt hier nicht.</span>`
            : `<button type="button" class="btn" data-sp="weiter">Weiter (Leertaste) → ${esc(nachTitel)}</button>`}
            <p class="hint" id="spMsg" role="status">${esc(meldung)}</p></footer>
        </section>
        <aside class="sp-seite"><h4>Gegner</h4>${gegnerSpalte()}<p class="hint">Markieren mit Klick oder Tab, dann + / − auf der Tastatur. Spieler sehen die Zahlen nicht: Sag den Zustandssatz an.</p></aside>
      </div>${fensterHtml()}`;
    zeigeLeiste();
    const kartenbox = main.querySelector(".sp-kartenbox");
    if (kartenbox) requestAnimationFrame(() => KS.passeAn(kartenbox));
  }

  // ---------- Bedienung ----------
  function verdrahten() {
    const tab = $("tabSpielen");
    tab.addEventListener("click", async e => {
      const t = e.target.closest("button, [data-gegner]");
      if (!t) return;
      const g = t.closest("[data-gegner]");
      if (t.dataset.dmg && g) { markiert = g.dataset.gegner; tue(() => motor.schaden(stand, g.dataset.gegner, +t.dataset.dmg)); return; }
      if (t.dataset.karte && g) { fenster = `karte:${g.dataset.gegner}`; zeige(); return; }
      if (t.dataset.weg && g) { tue(() => motor.entferne(stand, g.dataset.gegner)); return; }
      if (t.matches("[data-gegner]")) { markiert = t.dataset.gegner; zeige(); return; }
      if (t.dataset.wahl) { waehle(t.dataset.wahl); return; }
      if (t.dataset.eingabe) { eingabeFertig(t.dataset.eingabe); return; }
      if (t.dataset.ev) { tue(() => motor.ereignis(stand, t.dataset.ev)); return; }
      if (t.dataset.cue) { spiele(t.dataset.cue); return; }
      if (t.dataset.wurf !== undefined) { wuerfe[t.dataset.wurf] = motor.wuerfle(); zeige(); return; }
      if (t.dataset.stand) { await oeffne(t.dataset.stand); return; }
      switch (t.dataset.sp) {
        case "neu": await neuerAbend(); break;
        case "weiter": weiter(); break;
        case "zurueck": zurueck(); break;
        case "runde": runde(); break;
        case "stopp": stoppe(); zeige(); break;
        case "npc": fenster = "npc"; zeige(); break;
        case "zu": fenster = null; eingabeFuer = null; zeige(); break;
        case "eingabe-frei": { const v = ($("spEingabeFrei") || {}).value; if (v && v.trim()) eingabeFertig(v.trim()); break; }
        case "schliessen": await speichere(); stand = null; standId = null; stoppe(); await ladeListe(); zeige(); break;
      }
    });
    tab.addEventListener("change", e => {
      if (e.target.dataset.check && stand) { stand.checks[e.target.dataset.check] = e.target.checked; spaeter(); }
      if (e.target.dataset.hoch && e.target.files && e.target.files[0]) ladeHoch(e.target.dataset.hoch, e.target.files[0]);
    });
    document.addEventListener("keydown", e => {
      if ($("tabSpielen").hidden || !stand) return;
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      const s = motor.schritt(stand);
      const k = e.key;
      if (k === "Escape") { fenster = null; eingabeFuer = null; zeige(); return; }
      if (fenster === "eingabe" && /^[1-9]$/.test(k)) {
        const knopf = document.querySelectorAll("[data-eingabe]")[+k - 1];
        if (knopf) eingabeFertig(knopf.dataset.eingabe);
        e.preventDefault(); return;
      }
      if (fenster) return;
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (kampfOffen(s)) melde("Der Kampf läuft noch. Ziel per Ereignis oder Schaden erreichen, oder unten „Ohne Ziel weiter“ klicken.");
        else weiter();
        return;
      }
      if (k === "Backspace") { e.preventDefault(); zurueck(); return; }
      if (s && s.typ === "wahl" && /^[1-9]$/.test(k)) { waehle(k); return; }
      const ev = (s && s.ereignisse || []).find(id => map.ereignisse[id] && String(map.ereignisse[id].taste).toLowerCase() === k.toLowerCase());
      if (ev) { tue(() => motor.ereignis(stand, ev)); return; }
      if (k === "r" || k === "R") { if (stand.rundenAktiv) runde(); return; }
      if (k === "a" || k === "A") { if (s && s.cue) spiele(s.cue); return; }
      if (k === "s" || k === "S") { stoppe(); zeige(); return; }
      if (k === "n" || k === "N") { if ([...stand.verlauf].some(id => (map.schritte[id] || {}).typ === "npc")) { fenster = "npc"; zeige(); } return; }
      if (k === "Tab") {
        const aktiv = stand.gegner.filter(g => !g.weg);
        if (!aktiv.length) return;
        e.preventDefault();
        const i = aktiv.findIndex(g => g.uid === markiert);
        markiert = aktiv[(i + (e.shiftKey ? aktiv.length - 1 : 1)) % aktiv.length].uid;
        zeige(); return;
      }
      if (markiert && (k === "+" || k === "-" || k === "*")) tue(() => motor.schaden(stand, markiert, k === "+" ? 1 : k === "*" ? 2 : -1));
    });
  }

  window.KartenschmiedeSpiel = {
    async zeigen() {
      if (!geladen) {
        geladen = true; verdrahten();
        try { await ladeListe(); } catch { staende = []; }
        try { await ladeAudio(); } catch { audio = {}; }
        try { window.__spGruppen = window.KartenschmiedeGruppe ? await window.KartenschmiedeGruppe.gruppen() : []; } catch { window.__spGruppen = []; }
      }
      zeige();
    },
  };
  if (!$("tabSpielen").hidden) window.KartenschmiedeSpiel.zeigen();
})();

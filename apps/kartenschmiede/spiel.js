/* Kartenschmiede – Reiter „Spielen“: der Laptop als Spielleiter-Schirm.
   Spielt eine Map Schritt für Schritt ab (Motor: spiel-motor.js, Daten: kampagnen/<kampagne>/mapN.json).
   Aufbau für einen 15-Zoll-Laptop: Kopfleiste mit Leisten oben, Schrittkarte links, rechts die Tischkarte mit
   anklickbaren (und verschiebbaren) Figuren und darunter die Gegner mit verdeckten Zuständen, unten die Aktionsleiste.
   Dazu NPC-Fenster, Lage-Fenster (Ziele, Flucht, Sonderregeln, Messen ohne Zollstock), Proben an Suchmarkern und
   der Rundenwurf. Spielstand: /api/kartenschmiede/spielstaende, Audio: /api/kartenschmiede/audio.
   Braucht window.KS (app.js), Szenarien (szenarien.js), KartenschmiedeSzenarien (szenarien-ui.js) und SpielMotor. */
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
  // Messen ohne Zollstock: Die Gegnerkarten (Postkarte quer) liegen ohnehin am Tisch
  const MESSEN = [
    ["in Kontakt", "Die Bases berühren sich."],
    ["direkt daneben", "Ein Fingerbreit Luft, mehr nicht."],
    ["eine Kartenbreite", "Kurze Seite einer Gegnerkarte, 10 cm (etwa 4 Zoll)."],
    ["eine Kartenlänge", "Lange Seite einer Gegnerkarte, 15 cm (etwa 6 Zoll). So weit geht eine normale Bewegung."],
    ["zwei Kartenlängen", "30 cm (etwa 12 Zoll): Sprint, kurze Fernkampf-Reichweite."],
  ];
  const FARBE = { held: "#6fb0ff", gegner: "#ff6a4a", figur: "#f2cf4a", tot: "#77736b" };

  let map = null, motor = null, stand = null, standId = null, karte = null;
  let staende = [], audio = {}, helden = [];
  const lokaleAudios = {}, wuerfe = {};
  let markiert = null, fenster = null, eingabeFuer = null, popup = null;
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
  for (const el of [spieler.haupt, spieler.schleife]) for (const ev of ["play", "pause", "ended"]) el.addEventListener(ev, () => { if (geladen && stand && !$("tabSpielen").hidden) zeigeKopf(); });

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
  const heldInfo = k => [k.faction, k.quality && `Qualität ${k.quality}`, k.defense && `Verteidigung ${k.defense}`, k.tough && `Zäh ${k.tough}`].filter(Boolean).join(" · ");
  async function ladeHelden() {
    helden = [];
    const G = window.KartenschmiedeGruppe;
    if (G && stand && stand.gruppeId) {
      const g = await G.gruppe(stand.gruppeId);
      if (g) helden = g.mitglieder.filter(k => k.role === "hero").map(k => ({ name: k.name, info: heldInfo(k), karte: k }));
    }
    if (!helden.length) helden = KS.VORLAGEN.filter(v => v.d.role === "hero").map(v => ({ name: v.d.name, info: heldInfo(v.d), karte: v.d }));
  }
  // Kürzel auf der Tischkarte: Anfangsbuchstaben des Namens plus laufende Nummer je Gegnertyp (S1, SZ2 …)
  const kuerzelVon = def => def.kurz || String(def.name || "?").replace(/[()]/g, " ").split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");
  function gegnerKuerzel(g) {
    const def = map.gegner[g.id] || {};
    const gleiche = stand.gegner.filter(x => x.id === g.id);
    return gleiche.length > 1 ? `${kuerzelVon(def)}${gleiche.indexOf(g) + 1}` : kuerzelVon(def);
  }

  // ---------- Start ----------
  function waehleMap(nr) {
    for (const k of Object.keys(wuerfe)) delete wuerfe[k];
    map = MAPS.find(m => String(m.map) === String(nr)) || MAPS[0];
    motor = map ? SM.erstelle(map, { werte: werteFuer, stufe: stufeFuer }) : null;
    const mp = map && (S.MOOSGRAB.maps || []).find(x => x.nr === map.map);
    karte = mp ? mp.karte : null;
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
    meldung = uebernahme ? "Leisten und Entscheidungen aus der letzten Map übernommen." : "";
    await ladeHelden();
    await speichere(); await ladeListe();
    zeige();
  }
  async function oeffne(id) {
    const s = await ladeStand(id);
    if (!s) { melde("Spielstand nicht gefunden."); return; }
    waehleMap(s.map);
    stand = motor.migriere(Object.assign(s, { undo: [] }));
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
    if (s && stand.schritt !== vorher) { markiert = null; popup = null; meldung = ""; if (s.stoppt) stoppe(s.stoppt); if (s.typ === "npc") fenster = "npc"; }
    spaeter();
    zeige();
  }
  // Die Seitenspalte (Tischkarte, Gegner) fehlt nur beim Aufbau, solange noch keine Gegner am Tisch stehen
  const mitSeite = s => s.typ !== "aufbau" || stand.gegner.some(g => !g.weg);
  // Ein Kampf ohne erreichtes Ziel endet nur mit Klick, nicht mit der Leertaste (sonst ist die Frau aus Versehen verloren)
  const kampfOffen = s => s && s.typ === "kampf" && !stand.kampfZiel;
  const weiter = () => tue(() => motor.weiter(stand));
  const zurueck = () => tue(() => motor.zurueck(stand));
  const runde = () => tue(() => { const r = motor.runde(stand); melde(`Runde ${stand.runde} beendet.${r.texte.length ? ` ${r.texte.join(" ")}` : ""}${map.rundenwurf ? " Jetzt würfeln: Taste W." : ""}`); });
  const rundenwurf = wurf => tue(() => motor.rundenwurf(stand, wurf));
  const probe = (index, wurf) => tue(() => motor.probe(stand, index, wurf));
  const offeneProbe = () => (stand.letzte || []).findIndex(e => e.probe && !e.probe.wurf);
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
  function vollbild() {
    const d = document;
    if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
    else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => melde("Vollbild ging nicht. Am Mac: Ctrl + Cmd + F."));
  }

  // ---------- Bausteine ----------
  const symText = t => (KS.symText ? KS.symText(t) : esc(t));
  const liste = (punkte, cls = "") => punkte && punkte.length ? `<ul class="${cls}">${punkte.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
  const vorlesen = (text, wer) => text ? `<blockquote class="sp-lies">${wer ? `<small>${esc(wer)}</small>` : ""}${esc(text)}</blockquote>` : "";
  // Zum Ansagen am Tisch (Zustand, Bedrohung): kleiner als ein Vorlesetext, aber klar als Satz für die Spieler markiert
  const sag = text => text ? `<p class="sp-sag">„${esc(String(text).replace(/^[„"]|[“"]$/g, ""))}“</p>` : "";
  const gm = text => text ? `<p class="sp-gm">${esc(text)}</p>` : "";
  const taste = t => t ? `<kbd>${esc(t)}</kbd>` : "";

  // ---------- Kopfleiste ----------
  function zeigeKopf() {
    const el = $("spKopf");
    if (!el || !stand) return;
    const s = motor.schritt(stand), runden = stand.rundenAktiv && s && s.typ !== "ende";
    const ids = Object.keys(map.schritte), pos = ids.indexOf(stand.schritt) + 1;
    const leisten = Object.entries(map.leisten).filter(([k]) => stand.leisten[k] && stand.leisten[k].aktiv).map(([k, def]) => {
      const l = stand.leisten[k];
      return `<span class="sp-pill" title="${esc(def.text || "")}"><b>${esc(def.name)}</b> ${Array.from({ length: def.max - def.min }, (_, i) => `<i class="${i < l.wert - def.min ? "an" : ""}"></i>`).join("")} <em>${l.wert}</em></span>`;
    }).join("");
    const laeuft = [spieler.haupt, spieler.schleife].filter(a => !a.paused).map(a => a.dataset.cue);
    el.innerHTML = `<div class="sp-titel"><b>${esc(map.kampagne)} · Map ${map.map}</b><small>${esc(map.titel)} · Schritt ${pos}/${ids.length}</small></div>
      <div class="sp-pills">${runden ? `<span class="sp-pill sp-runde"><b>Runde</b> <em>${stand.runde + 1}</em></span>` : ""}${leisten}
        <span class="sp-pill sp-verhalten ${motor.wuetend(stand) ? "wuetend" : ""}" title="Verhaltenstabelle der Gegner"><b>Gegner</b> ${motor.wuetend(stand) ? "WÜTEND" : "ruhig"}</span>
        ${laeuft.length ? `<span class="sp-pill sp-ton">♪ ${esc(laeuft.join(", "))} <button type="button" class="btn ghost sm" data-sp="stopp">■ Stopp ${taste("S")}</button></span>` : ""}</div>
      <div class="sp-kopfknoepfe"><button type="button" class="btn ghost sm" data-sp="lage">Lage ${(s && s.ereignisse || []).some(id => String((map.ereignisse[id] || {}).taste || "").toLowerCase() === "l") ? "" : taste("L")}</button>
        <button type="button" class="btn ghost sm" data-sp="vollbild" title="Am Mac auch Ctrl + Cmd + F">Vollbild</button>
        <button type="button" class="btn ghost sm" data-sp="schliessen">Menü</button></div>`;
  }

  // ---------- Aktionsleiste unten ----------
  // In der Leiste nur der Kern des Namens: Ortsangaben in Klammern stehen im Tooltip und auf der Tischkarte, „(+1)“ bleibt
  const kurzName = e => e.kurz || String(e.name || "").replace(/\s*\((?![+−-]\d)[^)]*\)/g, "").trim();
  function aktionsLeiste(s) {
    // Was noch nicht möglich ist (z. B. die Quelle vor Marker 3), bleibt ausgeblendet; Erledigtes bleibt mit ✓ stehen
    const ids = (s.ereignisse || []).filter(id => map.ereignisse[id] && !map.ereignisse[id].intern && (stand.ereignisse[id] || motor.ereignisErlaubt(stand, id)));
    const evs = ids.map(id => {
      const e = map.ereignisse[id], ok = motor.ereignisErlaubt(stand, id), schon = stand.ereignisse[id];
      return `<button type="button" class="btn ghost sm ${ok ? "" : "aus"} ${schon ? "erledigt" : ""}" data-ev="${esc(id)}" ${ok ? "" : "disabled"} title="${esc([e.name, e.kosten].filter(Boolean).join(" · "))}">${taste(e.taste)} ${esc(kurzName(e))}${schon ? " ✓" : ""}</button>`;
    }).join("");
    const rw = map.rundenwurf && motor.gilt(stand, map.rundenwurf.wenn) && stand.rundenAktiv && s.typ !== "ende";
    const rwFaellig = rw && stand.runde > 0 && stand.rundenwurfRunde !== stand.runde;
    const runden = stand.rundenAktiv && s.typ !== "ende";
    const vor = s.typ !== "wahl" && motor.naechsterId(stand);
    return `<div class="sp-evs">${evs || `<span class="hint">In diesem Schritt gibt es keine Sonderaktionen.</span>`}</div>
      <div class="sp-runden">${rw ? `<button type="button" class="btn sm ${rwFaellig ? "faellig" : "ghost"}" data-sp="rundenwurf" title="${esc(map.rundenwurf.text || "")}">🎲 ${esc(map.rundenwurf.name)} ${taste("W")}</button>` : ""}
        ${runden ? `<button type="button" class="btn sm" data-sp="runde">Runde beenden ${taste("R")}</button>` : ""}
        <button type="button" class="btn ghost sm" data-sp="zurueck" ${stand.undo.length ? "" : "disabled"}>← Zurück ${taste("⌫")}</button>
        ${vor ? `<button type="button" class="btn sm ${kampfOffen(s) ? "ghost" : "weiter"}" data-sp="weiter">Weiter → ${kampfOffen(s) ? "" : taste("Leertaste")}</button>` : ""}</div>`;
  }

  // ---------- Schrittkarte ----------
  function cueKnopf(cue, gross) {
    const def = map.audio[cue] || {};
    const da = hatAudio(cue);
    const laeuft = [spieler.haupt, spieler.schleife].some(a => a.dataset.cue === cue && !a.paused);
    return `<div class="sp-cue ${gross ? "gross" : ""}">
      <button type="button" class="btn ${da ? "" : "ghost"}" data-cue="${esc(cue)}" ${da ? "" : "disabled"}>${laeuft ? "❚❚ Pause" : "▶ Abspielen"}${gross ? ` ${taste("A")}` : ""}</button>
      <span><b>${esc(cue)}</b> ${esc(def.titel || "")}${def.schleife ? " · Schleife" : ""}${def.dauer ? ` · ${esc(def.dauer)}` : ""}</span>
      <label class="btn ghost sm sp-upload">${da ? "Ersetzen" : "MP3 hochladen"}<input type="file" accept="audio/*" data-hoch="${esc(cue)}" hidden></label>
    </div>`;
  }
  // Was auf den Tisch muss: Gelände durchnummeriert wie auf der Karte, dazu die Marker
  function aufbauLegende() {
    if (!karte) return "";
    const MARKER = window.KartenschmiedeSzenarien.MARKER || {}, nummern = new Map();
    for (const g of karte.gelaende) { const n = g.label || (S.GELAENDE[g.art] || {}).name || g.art; if (!nummern.has(n)) nummern.set(n, nummern.size + 1); }
    const auf = motor.aufgedeckt(stand);
    const marker = karte.marker.filter(m => !m.geheim || auf.includes(m.label) || auf.includes(`${m.typ}:${m.label}`));
    return `<div class="sp-legende"><div><h4>Gelände (frei hinstellen)</h4><ul class="sp-gel">${[...nummern.keys()].map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
      <div><h4>Marker (genau dort)</h4><ul>${marker.map(m => { const [z, f, name] = MARKER[m.typ] || ["•", "#fff", m.typ]; return `<li><i style="background:${f}">${esc(m.label && m.label.length <= 2 ? m.label : z || "▲")}</i>${esc(name)}</li>`; }).join("")}</ul></div></div>`;
  }
  function schrittInhalt(s) {
    switch (s.typ) {
      case "vorbereitung": return `<ul class="sp-check">${(s.checkliste || []).map((c, i) => {
        const k = `${stand.schritt}:${i}`;
        return `<li><label><input type="checkbox" data-check="${esc(k)}" ${stand.checks[k] ? "checked" : ""}> ${esc(c)}</label></li>`;
      }).join("")}</ul>${gm(s.hinweis)}${stand.schritt === "vorb-stand" ? audioListe() : ""}`;
      case "aufbau": {
        const text = `${liste(s.tisch, "sp-tisch")}${s.regel ? `<h4>Sag an</h4>${vorlesen(s.regel)}` : ""}${gm(s.hinweis)}`;
        if (mitSeite(s)) return text;
        return `<div class="sp-aufbau"><div>${text}</div><div class="sp-aufbaukarte">${tischKarte({ gross: true, skizze: s.skizze })}${aufbauLegende()}</div></div>`;
      }
      case "cue": return `${cueKnopf(s.cue, true)}${gm(s.notiz || s.gmNotiz)}${s.optional && !hatAudio(s.cue) ? `<p class="sp-gm">Kein Track da: einfach weiter, du spielst die Szene live.</p>` : ""}${s.text ? vorlesen(s.text) : ""}`;
      case "vorlesen": return `${vorlesen(s.text, s.als && map.figuren[s.als] ? map.figuren[s.als].name : "")}${gm(s.gmNotiz)}`;
      case "regel": return `${vorlesen(s.text)}${gm(s.gmNotiz)}`;
      case "spieler": return `<p class="sp-text">${esc(s.text || "")}</p>${liste(s.hinweise, "sp-hinweise")}`;
      case "npc": {
        const f = map.figuren[s.figur] || {};
        return `${vorlesen(s.einstieg, f.name)}${gm(s.gmNotiz)}<button type="button" class="btn ghost sm" data-sp="npc">NPC-Karte öffnen ${taste("N")}</button>`;
      }
      case "wahl": return `${s.ansage ? vorlesen(s.ansage) : ""}<p class="sp-text">${esc(s.frage || "")}</p>
        <div class="sp-optionen">${s.optionen.map(o => `<button type="button" class="sp-option" data-wahl="${esc(o.taste)}">
          <kbd>${esc(o.taste)}</kbd><span><b>${esc(o.kurz)}</b>${o.text ? `<small>${esc(o.text)}</small>` : ""}<em>Folge: ${esc(o.folge || "–")}</em></span></button>`).join("")}</div>`;
      case "kampf": {
        const ziel = stand.kampfZiel ? `<p class="sp-ziel">Ziel erreicht. Weiter führt zu: <b>${esc((map.schritte[stand.kampfZiel] || {}).titel || stand.kampfZiel)}</b></p>` : "";
        return `<p class="sp-text">${symText(s.text || "")}</p>${liste(s.hinweise, "sp-hinweise")}${ziel}${verhaltenTabelle()}`;
      }
      case "ende": {
        const ep = motor.epListe(stand);
        return `<h4>Erfahrung</h4><ul>${ep.map(e => `<li class="${e.erreicht ? "ja" : "nein"}">${e.erreicht ? "✓" : "✗"} ${esc(e.text)}: ${e.ep} EP</li>`).join("")}</ul>
          <h4>Beute</h4>${liste(s.beute)}<p><button type="button" class="btn ghost sm" data-wurf="ende">Beutewurf W6</button> ${wuerfe.ende ? `<b>${wuerfe.ende.wurf}</b> · ${esc(wuerfe.ende.text)}` : ""}</p>
          <h4>Folgen für die nächste Map</h4>${liste(motor.folgen(stand), "sp-folgen")}
          <h4>Notieren</h4>${liste(s.notieren)}<p class="sp-gm">${esc((s.zuruecksetzen || []).join(", "))} zurücksetzen. Der Spielstand ist gespeichert; die nächste Map übernimmt Leisten und Entscheidungen.</p>`;
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
  // Was gerade passiert ist: Ereignisse, Proben, Schwellen, gefallene Gegner, Rundenwurf
  function letzteEreignisse() {
    if (!stand.letzte || !stand.letzte.length) return "";
    return `<div class="sp-letzte"><h4>Gerade passiert</h4>${stand.letzte.map((e, i) => {
      const p = e.probe, def = map.ereignisse[e.id] || {};
      const probeHtml = !p ? "" : p.wurf
        ? `<p class="sp-wurf">🎲 Wurf <b>${p.wurf}</b>${p.stufen.length ? "" : " · nichts weiter"}</p>${p.stufen.map(st => `${vorlesen(st.vorlesen, `ab ${st.ab}`)}${gm(st.gmNotiz)}`).join("")}`
        : `<div class="sp-probe"><p>🎲 ${esc(p.frage)}</p><div>${[1, 2, 3, 4, 5, 6].map(w => `<button type="button" class="btn sm" data-probe="${i}" data-w="${w}">${w}</button>`).join("")}
            <button type="button" class="btn ghost sm" data-probe="${i}" data-w="0">App würfelt</button></div>
            <small>${esc(((def.probe || {}).stufen || []).map(st => `ab ${st.ab}`).join(" · "))} · Tasten 1–6</small></div>`;
      return `<div class="sp-ev ${e.art ? `art-${e.art}` : ""}"><h4>${esc(e.name)}</h4>${vorlesen(e.vorlesen)}${gm(e.gmNotiz)}${probeHtml}
        ${e.beutewurf ? `<p>${wuerfe[i] ? `<b>Beutewurf: ${wuerfe[i].wurf}</b> · ${esc(wuerfe[i].text)}` : `<button type="button" class="btn ghost sm" data-wurf="${i}">Beutewurf W6</button>`}</p>` : ""}</div>`;
    }).join("")}</div>`;
  }

  // ---------- Tischkarte mit Figuren ----------
  function standardPos() {
    const pos = {}, plan = map.tischplan || {}, a = karte.aufstellung;
    const start = plan.helden || { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    helden.forEach((h, i) => { pos[`held:${h.name}`] = { x: Math.max(1, Math.min(karte.b - 1, start.x + (i - (helden.length - 1) / 2) * 2.4)), y: start.y }; });
    const zoneXY = z => (plan.zonen || {})[z] || (karte.marker.find(m => m.label === z) || null);
    const jeZone = {};
    for (const g of stand.gegner) {
      const z = zoneXY(g.zone) || { x: karte.b / 2, y: karte.t / 4 };
      const n = (jeZone[g.zone] = (jeZone[g.zone] || 0) + 1) - 1;
      const w = n * 2.1, r = n ? 2.2 : 0;
      pos[`g:${g.uid}`] = { x: Math.max(1, Math.min(karte.b - 1, z.x + r * Math.cos(w))), y: Math.max(1, Math.min(karte.t - 1, z.y + 1.8 + r * Math.sin(w))) };
    }
    for (const f of motor.figurenAmTisch(stand)) pos[`f:${f.id}`] = { x: f.tisch.x, y: f.tisch.y };
    return pos;
  }
  const markerEreignis = m => Object.entries(map.ereignisse || {}).find(([, e]) => e.marker && (e.marker === m.label || e.marker === `${m.typ}:${m.label}`));
  function tischKarte(opt = {}) {
    if (!karte || !window.KartenschmiedeSzenarien) return "";
    const aufgedeckt = motor.aufgedeckt(stand);
    const { svg } = window.KartenschmiedeSzenarien.karteSvg(karte, { geheim: false, aufgedeckt, namen: true, boden: "#1d2620", fuss: " " });
    const pos = { ...standardPos(), ...(stand.pos || {}) };
    const teile = [];
    // Abgedunkelt, was noch nicht aufgebaut wird
    if (opt.gross && opt.skizze) {
      const decke = opt.skizze === "unten" ? [[0, 0, karte.b, karte.t / 2]] : (opt.skizze.decke || []);
      for (const [x, y, w, h] of decke) teile.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" opacity=".62" pointer-events="none"/>`);
    }
    // Suchmarker und andere Marker mit Ereignis: Ring zeigt „schon untersucht“, Klick öffnet die Infos
    for (const m of karte.marker) {
      const ev = markerEreignis(m);
      if (!ev || (m.geheim && !aufgedeckt.includes(m.label) && !aufgedeckt.includes(`${m.typ}:${m.label}`))) continue;
      const fertig = stand.ereignisse[ev[0]];
      teile.push(`<g class="sp-tok marker" data-tok="m:${esc(ev[0])}"><circle cx="${m.x}" cy="${m.y}" r="1.55" fill="transparent" stroke="${fertig ? "#7fd06a" : "#f2cf4a"}" stroke-width=".22" ${fertig ? "" : `stroke-dasharray=".5 .3"`}/>${fertig ? `<text x="${m.x + 1.3}" y="${m.y - .9}" font-size="1.3" fill="#7fd06a" font-weight="800">✓</text>` : ""}</g>`);
    }
    const token = (schluessel, x, y, farbe, text, titel, extra = "") => {
      const aktiv = markiert === schluessel || (popup && popup.tok === schluessel);
      return `<g class="sp-tok ${extra}" data-tok="${esc(schluessel)}" transform="translate(${x} ${y})"><title>${esc(titel)}</title>
        <circle r="1.25" fill="${farbe}" stroke="${aktiv ? "#fff" : "#0b0c0f"}" stroke-width="${aktiv ? .32 : .16}"/>
        <text y=".42" font-size="${text.length > 2 ? .85 : 1.1}" text-anchor="middle" fill="#0b0c0f" font-family="Barlow Condensed, sans-serif" font-weight="800">${esc(text)}</text></g>`;
    };
    if (!opt.gross) {
      helden.forEach(h => { const p = pos[`held:${h.name}`]; if (p) teile.push(token(`held:${h.name}`, p.x, p.y, FARBE.held, h.name.slice(0, 2), `${h.name} (Held)`)); });
      for (const f of motor.figurenAmTisch(stand)) { const p = pos[`f:${f.id}`]; if (p) teile.push(token(`f:${f.id}`, p.x, p.y, FARBE.figur, f.tisch.zeichen || f.name[0], f.name)); }
      for (const g of stand.gegner.filter(x => !x.weg)) {
        const p = pos[`g:${g.uid}`], z = motor.zustand(g);
        if (p) teile.push(token(`g:${g.uid}`, p.x, p.y, z.id === "gefallen" ? FARBE.tot : FARBE.gegner, gegnerKuerzel(g), `${motor.anzeigeName(g)} · ${z.id}`, z.id === "gefallen" ? "tot" : ""));
      }
    }
    const inhalt = svg.replace(/^<svg class="sz-karte"/, `<svg class="sp-svg" data-b="${karte.b}" data-t="${karte.t}"`).replace("</svg>", `${teile.join("")}</svg>`);
    const unter = opt.gross ? "Raster: eine Kartenlänge (15 cm). Gelände frei hinstellen, Marker und Zonen genau dort." : "Raster: eine Kartenlänge · Figuren anklicken für Infos, ziehen zum Verschieben";
    return `<div class="sp-tischkarte ${opt.gross ? "gross" : ""}">${inhalt}<small>${unter}</small>${!opt.gross ? popupHtml() : ""}</div>`;
  }
  // Infokarte zu einer angeklickten Figur oder einem Marker
  function popupHtml() {
    if (!popup) return "";
    const [art, ...rest] = popup.tok.split(":"), id = rest.join(":");
    let kopf = "", inhalt = "";
    if (art === "held") {
      const h = helden.find(x => x.name === id);
      kopf = `<b>${esc(id)}</b><small>Held</small>`; inhalt = `<p>${esc((h && h.info) || "")}</p>`;
    } else if (art === "f") {
      const f = map.figuren[id] || {};
      kopf = `<b>${esc(f.name || id)}</b><small>NPC</small>`;
      inhalt = `<p>${esc(f.wer || "")}</p>${f.ziel ? `<p><b>Will gerade:</b> ${esc(f.ziel)}</p>` : ""}<button type="button" class="btn ghost sm" data-sp="npc-von" data-figur="${esc(id)}">NPC-Karte ${taste("N")}</button>`;
    } else if (art === "g") {
      const g = stand.gegner.find(x => x.uid === id);
      if (!g) return "";
      const def = map.gegner[g.id] || {}, z = motor.zustand(g);
      kopf = `<b>${esc(gegnerKuerzel(g))} · ${esc(def.name || g.id)}</b><small>${esc(z.id)}${g.zone ? ` · Zone ${esc(g.zone)}` : ""}</small>`;
      inhalt = `${def.info ? `<p>${esc(def.info)}</p>` : ""}${sag(z.satz)}${motor.zusaetze(stand, def).map(x => gm(x.text)).join("")}
        <div class="sp-g-knoepfe" data-gegner="${esc(g.uid)}"><button type="button" class="btn sm" data-dmg="1">+1</button><button type="button" class="btn sm" data-dmg="2">+2</button><button type="button" class="btn ghost sm" data-dmg="-1">−1</button><button type="button" class="btn ghost sm" data-karte="1">Karte</button></div>`;
    } else if (art === "m") {
      const e = map.ereignisse[id] || {}, ok = motor.ereignisErlaubt(stand, id), schon = stand.ereignisse[id];
      kopf = `<b>${esc(e.name || id)}</b><small>${schon ? "untersucht" : "noch nicht untersucht"}</small>`;
      inhalt = `${e.probe && !schon ? `<p class="hint">Mit Probe: ${esc((e.probe.stufen || []).map(st => `ab ${st.ab}`).join(" · "))}</p>` : ""}${ok ? `<button type="button" class="btn sm" data-ev="${esc(id)}">${schon ? "Nochmal" : "Untersuchen"} ${taste(e.taste)}</button>` : ""}`;
    }
    return `<div class="sp-pop" style="left:${popup.x}%;top:${popup.y}%"><header>${kopf}<button type="button" class="btn ghost sm" data-sp="popzu" aria-label="Schließen">✕</button></header>${inhalt}</div>`;
  }

  // ---------- Gegnerliste ----------
  function gegnerListe() {
    const aktiv = stand.gegner.filter(g => !g.weg);
    if (!aktiv.length) return `<p class="hint">Noch keine Gegner am Tisch.</p>`;
    return aktiv.map(g => {
      const def = map.gegner[g.id] || {}, z = motor.zustand(g), b = motor.bedrohung(def), offen = markiert === `g:${g.uid}`;
      const zusatz = motor.zusaetze(stand, def);
      return `<div class="sp-gegner ${offen ? "markiert" : ""} ${z.id === "gefallen" ? "gefallen" : ""}" data-gegner="${esc(g.uid)}">
        <div class="sp-g-zeile"><span class="sp-g-tok">${esc(gegnerKuerzel(g))}</span><b>${esc(def.name || g.id)}</b><span class="sp-schaedel" title="Bedrohung">${"☠".repeat(b.schaedel)}</span>
          <span class="sp-g-balken">${Array.from({ length: g.zaeh }, (_, i) => `<i class="${i < g.wunden ? "wunde" : ""}"></i>`).join("")}</span>
          <span class="sp-g-knoepfe">${z.id === "gefallen" ? `<button type="button" class="btn ghost sm" data-weg="1">vom Tisch</button>` : `<button type="button" class="btn sm" data-dmg="1">+1</button><button type="button" class="btn sm" data-dmg="2">+2</button>`}<button type="button" class="btn ghost sm" data-dmg="-1">−1</button></span></div>
        <div class="sp-g-zustand"><em>${esc(z.id)}</em> ${sag(z.satz)}</div>
        ${offen ? `<div class="sp-g-mehr">${g.wunden === 0 && b.satz ? `<h5>Bedrohung ansagen</h5>${sag(b.satz)}` : ""}${zusatz.length ? `<h5>Gilt gerade</h5>${zusatz.map(x => `${gm(x.text)}${x.ansage ? sag(x.ansage) : ""}`).join("")}` : ""}
          <p class="hint">${g.wunden}/${g.zaeh} Wunden${g.zone ? ` · Zone ${esc(g.zone)}` : ""}</p><button type="button" class="btn ghost sm" data-karte="1">Karte zeigen</button></div>` : ""}
      </div>`;
    }).join("");
  }
  // Sonderregeln, die eine frühere Entscheidung freigeschaltet hat, gehören immer in den Blick
  function aktiveRegeln() {
    const bedingt = ((map.lage || {}).sonderregeln || []).filter(r => r.wenn && motor.gilt(stand, r.wenn));
    if (!bedingt.length) return "";
    return `<div class="sp-aktiv"><h4>Gilt jetzt</h4>${bedingt.map(r => `<p><b>${esc(r.titel || "")}</b> ${esc(r.text || "")}</p>`).join("")}</div>`;
  }

  // ---------- Fenster ----------
  function fensterHtml() {
    if (fenster === "npc" || (fenster && fenster.startsWith("npc:"))) {
      const id = fenster.startsWith("npc:") ? fenster.slice(4) : ([...stand.verlauf].reverse().map(x => map.schritte[x]).find(x => x && x.typ === "npc") || {}).figur;
      const f = id && map.figuren[id];
      if (!f) return "";
      return `<div class="sp-fenster" role="dialog" aria-label="${esc(f.name)}"><div class="sp-fenster-innen breit">
        <header><h3>${esc(f.name)}</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <div class="sp-npc-raster"><div><p>${esc(f.wer || "")}</p>${f.stimme ? `<p><b>So spricht sie:</b> ${esc(f.stimme)}</p>` : ""}${f.motiv ? `<p><b>Motiv:</b> ${esc(f.motiv)}</p>` : ""}${f.ziel ? `<p><b>Will in dieser Szene:</b> ${esc(f.ziel)}</p>` : ""}
          <h4>Was sie nicht weiß</h4>${liste(f.nichtWissen)}</div>
        <div><h4>Sätze, die immer kommen</h4>${(f.kern || []).map(k => vorlesen(k)).join("")}</div></div>
        ${f.wennSieFragen ? `<h4>Wenn sie fragen …</h4><table class="sz-tab sp-fragen"><tbody>${f.wennSieFragen.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>` : ""}
      </div></div>`;
    }
    if (fenster === "eingabe" && eingabeFuer) {
      const e = eingabeFuer.eingabe;
      const auswahl = e.aus === "offene-marker" ? motor.offeneMarker(stand).map(id => [id, map.ereignisse[id].name]) : helden.map(h => [h.name, h.name]);
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen klein">
        <header><h3>${esc(e.frage)}</h3><button type="button" class="btn ghost sm" data-sp="zu">Abbrechen</button></header>
        <div class="sp-optionen">${auswahl.map(([w, n], i) => `<button type="button" class="sp-option" data-eingabe="${esc(w)}"><kbd>${i + 1}</kbd><span><b>${esc(n)}</b></span></button>`).join("")}</div>
        ${e.aus === "gruppe" ? `<label class="f">Oder Name eintippen <input type="text" id="spEingabeFrei" placeholder="Name des Helden"></label><button type="button" class="btn sm" data-sp="eingabe-frei">Übernehmen</button>` : ""}
      </div></div>`;
    }
    if (fenster === "lage") {
      const l = motor.lage(stand), rw = map.rundenwurf;
      return `<div class="sp-fenster" role="dialog" aria-label="Lage"><div class="sp-fenster-innen breit">
        <header><h3>Lage</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <div class="sp-lage">
          <section><h4>Ziele</h4>${l.ziele.length ? `<ul class="sp-ziele">${l.ziele.map(z => `<li class="${z.ist ? "ja" : ""}">${z.ist ? "✓" : "○"} <b>${esc(z.art || "")}</b> ${esc(z.text)}</li>`).join("")}</ul>` : `<p class="hint">Keine Ziele hinterlegt.</p>`}
            <h4>Flucht</h4>${l.flucht ? `<p>${esc(l.flucht.wie || "")}</p>${gm(l.flucht.folge ? `Folge: ${l.flucht.folge}` : "")}` : `<p class="hint">Kein Fluchtweg hinterlegt.</p>`}
            <h4>Messen ohne Zollstock</h4><table class="sz-tab"><tbody>${MESSEN.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></section>
          <section><h4>Sonderregeln</h4>${l.sonderregeln.map(r => `<div class="sp-regel"><b>${esc(r.titel || "")}</b> ${esc(r.text || "")}${r.ansage ? sag(r.ansage) : ""}</div>`).join("") || `<p class="hint">Keine.</p>`}
            ${rw ? `<h4>${esc(rw.name)}</h4>${gm(rw.text)}<table class="sz-tab"><tbody>${(rw.tabelle || []).map(z => `<tr><td>${esc((z.w || []).join(", "))}</td><td><b>${esc(z.titel || "")}</b> ${esc(z.gmNotiz || "")}</td></tr>`).join("")}</tbody></table>` : ""}
            <h4>Protokoll</h4><ol class="sp-protokoll">${stand.protokoll.slice(-14).reverse().map(p => `<li><small>R${p.runde}</small> ${esc(p.text)}</li>`).join("")}</ol></section>
        </div></div></div>`;
    }
    if (fenster && fenster.startsWith("karte:")) {
      const g = stand.gegner.find(x => x.uid === fenster.slice(6));
      const werte = g && werteFuer(map.gegner[g.id]);
      if (!werte || !werte.quality) return "";
      const def = map.gegner[g.id] || {};
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen karte">
        <header><h3>${esc(werte.name || "")}</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <div class="sp-kartenbox">${KS.renderCard(werte, stufeFuer(werte), {})}</div>${gm(def.notiz)}${motor.zusaetze(stand, def).map(z => gm(z.text)).join("")}
      </div></div>`;
    }
    return "";
  }

  // ---------- Hauptanzeige ----------
  function zeige() {
    const main = $("spMain");
    if (!main) return;
    if (!stand) {
      document.body.classList.remove("sp-laeuft");
      main.innerHTML = `<div class="sp-start"><p class="lede">Wähle einen Spielstand oder starte einen neuen Abend.</p>
        <div class="row4"><label class="f">Map <select id="spMapWahl">${MAPS.map(m => `<option value="${m.map}">${esc(m.kampagne)} · Map ${m.map}: ${esc(m.titel)}</option>`).join("")}</select></label>
        <label class="f">Gruppe <select id="spGruppe"><option value="">Ohne Gruppe (Vorlagen-Helden)</option>${(window.__spGruppen || []).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select></label></div>
        <div class="copyrow"><button type="button" class="btn" data-sp="neu">Neuen Abend starten</button></div>
        <p class="hint">Tipp: Im Spiel auf „Vollbild“ (am Mac Ctrl + Cmd + F). Die Seite ist für einen 15-Zoll-Laptop gebaut.</p>
        ${staende.length ? `<h4>Gespeicherte Abende</h4><div class="sp-staende">${staende.map(x => `<button type="button" class="g-item" data-stand="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.kampagne)}</small></button>`).join("")}</div>` : ""}
        <p class="hint" id="spMsg" role="status">${esc(meldung)}</p></div>`;
      return;
    }
    document.body.classList.add("sp-laeuft");
    const s = motor.schritt(stand);
    const [zeichen, etikett, farbe] = TYP[s.typ] || ["", s.typ, ""];
    const naechster = motor.naechsterId(stand);
    const nachTitel = naechster && map.schritte[naechster] ? map.schritte[naechster].titel : "";
    const scrollAlt = (main.querySelector(".sp-karte") || {}).scrollTop || 0, gleich = main.dataset.schritt === stand.schritt;
    main.dataset.schritt = stand.schritt;
    main.innerHTML = `<div class="sp-app">
      <header class="sp-oben" id="spKopf"></header>
      <div class="sp-mitte ${mitSeite(s) ? "" : "ohne-seite"}">
        <section class="sp-karte typ-${farbe}">
          <header><span class="sp-typ">${zeichen} ${esc(etikett)}</span><h3>${esc(s.titel || "")}</h3></header>
          ${schrittInhalt(s)}
          ${letzteEreignisse()}
          <footer>${s.typ === "wahl" ? `<span class="hint">Wähle die Antwort, die am nächsten an dem ist, was die Spieler sagen (1–${s.optionen.length}).</span>` : !naechster ? `<span class="hint">Ende der Map.</span>`
            : kampfOffen(s) ? `<span class="hint">Der Kampf läuft. Er endet von selbst, wenn das Ziel erreicht ist. Weiter ohne Ziel führt zu: ${esc(nachTitel)}.</span>`
            : `<span class="hint">Als Nächstes: ${esc(nachTitel)}</span>`}
            <p class="hint sp-msg" id="spMsg" role="status">${esc(meldung)}</p></footer>
        </section>
        ${!mitSeite(s) ? "" : `<aside class="sp-seite">${tischKarte()}${aktiveRegeln()}<div class="sp-gegnerliste"><h4>Gegner</h4>${gegnerListe()}</div></aside>`}
      </div>
      <footer class="sp-unten">${aktionsLeiste(s)}</footer>
    </div>${fensterHtml()}`;
    zeigeKopf();
    if (gleich) { const k = main.querySelector(".sp-karte"); if (k) k.scrollTop = scrollAlt; }
    const kartenbox = main.querySelector(".sp-kartenbox");
    if (kartenbox) requestAnimationFrame(() => KS.passeAn(kartenbox));
  }

  // ---------- Figuren ziehen und anklicken ----------
  let zug = null;
  function svgPunkt(svg, e) {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function ziehStart(e) {
    const tok = e.target.closest && e.target.closest(".sp-tok");
    const svg = tok && tok.closest("svg.sp-svg");
    if (!tok || !svg || tok.classList.contains("marker") || svg.closest(".gross")) return;
    zug = { tok, svg, schluessel: tok.dataset.tok, start: svgPunkt(svg, e), bewegt: false };
    if (tok.setPointerCapture) tok.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function ziehe(e) {
    if (!zug) return;
    const p = svgPunkt(zug.svg, e);
    if (!zug.bewegt && Math.hypot(p.x - zug.start.x, p.y - zug.start.y) < .5) return;
    zug.bewegt = true;
    const b = +zug.svg.dataset.b, t = +zug.svg.dataset.t;
    zug.x = Math.max(.8, Math.min(b - .8, p.x)); zug.y = Math.max(.8, Math.min(t - .8, p.y));
    zug.tok.setAttribute("transform", `translate(${zug.x} ${zug.y})`);
  }
  function ziehEnde(e) {
    if (!zug) return;
    const z = zug; zug = null;
    if (z.bewegt) { motor.setzePos(stand, z.schluessel, z.x, z.y); spaeter(); zeige(); return; }
    oeffnePopup(z.schluessel, z.svg, e);
  }
  function oeffnePopup(schluessel, svg, e) {
    const r = svg.getBoundingClientRect();
    const x = Math.max(2, Math.min(52, ((e.clientX - r.left) / r.width) * 100 + 3)), y = Math.max(2, Math.min(62, ((e.clientY - r.top) / r.height) * 100 + 3));
    popup = { tok: schluessel, x, y };
    if (schluessel.startsWith("g:")) markiert = schluessel;
    zeige();
  }

  // ---------- Bedienung ----------
  function verdrahten() {
    const tab = $("tabSpielen");
    tab.addEventListener("pointerdown", ziehStart);
    tab.addEventListener("pointermove", ziehe);
    tab.addEventListener("pointerup", ziehEnde);
    tab.addEventListener("click", async e => {
      const marker = e.target.closest(".sp-tok.marker");
      if (marker && !marker.closest(".gross")) { oeffnePopup(marker.dataset.tok, marker.closest("svg"), e); return; }
      const t = e.target.closest("button, [data-gegner]");
      if (!t) return;
      const g = t.closest("[data-gegner]");
      if (t.dataset.dmg && g) { markiert = `g:${g.dataset.gegner}`; tue(() => motor.schaden(stand, g.dataset.gegner, +t.dataset.dmg)); return; }
      if (t.dataset.karte && g) { fenster = `karte:${g.dataset.gegner}`; zeige(); return; }
      if (t.dataset.weg && g) { tue(() => motor.entferne(stand, g.dataset.gegner)); return; }
      if (t.matches("[data-gegner]")) { markiert = markiert === `g:${t.dataset.gegner}` ? null : `g:${t.dataset.gegner}`; zeige(); return; }
      if (t.dataset.wahl) { waehle(t.dataset.wahl); return; }
      if (t.dataset.eingabe) { eingabeFertig(t.dataset.eingabe); return; }
      if (t.dataset.probe !== undefined) { probe(+t.dataset.probe, +t.dataset.w || 0); return; }
      if (t.dataset.ev) { popup = null; tue(() => motor.ereignis(stand, t.dataset.ev)); return; }
      if (t.dataset.cue) { spiele(t.dataset.cue); return; }
      if (t.dataset.wurf !== undefined) { wuerfe[t.dataset.wurf] = motor.wuerfle(); zeige(); return; }
      if (t.dataset.stand) { await oeffne(t.dataset.stand); return; }
      switch (t.dataset.sp) {
        case "neu": await neuerAbend(); break;
        case "weiter": weiter(); break;
        case "zurueck": zurueck(); break;
        case "runde": runde(); break;
        case "rundenwurf": rundenwurf(0); break;
        case "stopp": stoppe(); zeige(); break;
        case "npc": fenster = "npc"; zeige(); break;
        case "npc-von": fenster = `npc:${t.dataset.figur}`; zeige(); break;
        case "lage": fenster = "lage"; zeige(); break;
        case "vollbild": vollbild(); break;
        case "popzu": popup = null; zeige(); break;
        case "zu": fenster = null; eingabeFuer = null; zeige(); break;
        case "eingabe-frei": { const v = ($("spEingabeFrei") || {}).value; if (v && v.trim()) eingabeFertig(v.trim()); break; }
        case "schliessen": await speichere(); stand = null; standId = null; popup = null; fenster = null; stoppe(); if (document.fullscreenElement) document.exitFullscreen(); await ladeListe(); zeige(); break;
      }
    });
    tab.addEventListener("change", e => {
      if (e.target.dataset.check && stand) { stand.checks[e.target.dataset.check] = e.target.checked; spaeter(); }
      if (e.target.dataset.hoch && e.target.files && e.target.files[0]) ladeHoch(e.target.dataset.hoch, e.target.files[0]);
    });
    document.addEventListener("keydown", e => {
      if ($("tabSpielen").hidden || !stand) return;
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = motor.schritt(stand);
      const k = e.key;
      if (k === "Escape") { fenster = null; eingabeFuer = null; popup = null; zeige(); return; }
      if (fenster === "eingabe" && /^[1-9]$/.test(k)) {
        const knopf = document.querySelectorAll("[data-eingabe]")[+k - 1];
        if (knopf) eingabeFertig(knopf.dataset.eingabe);
        e.preventDefault(); return;
      }
      if (fenster) { if (k === "l" || k === "L") { fenster = null; zeige(); } return; }
      // Eine offene Probe nimmt die Ziffern zuerst: Der Spieler hat gerade gewürfelt
      const offen = offeneProbe();
      if (offen >= 0 && /^[1-6]$/.test(k)) { probe(offen, +k); return; }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (kampfOffen(s)) melde("Der Kampf läuft noch. Ziel per Aktion oder Schaden erreichen, oder unten „Weiter“ klicken.");
        else weiter();
        return;
      }
      if (k === "Backspace") { e.preventDefault(); zurueck(); return; }
      if (s && s.typ === "wahl" && /^[1-9]$/.test(k)) { waehle(k); return; }
      // Zwei Ereignisse dürfen dieselbe Taste haben, wenn nur eines gerade erlaubt ist (Hedda: Frage 9 lang oder knapp)
      const mitTaste = (s && s.ereignisse || []).filter(id => map.ereignisse[id] && String(map.ereignisse[id].taste || "").toLowerCase() === k.toLowerCase());
      const ev = mitTaste.find(id => motor.ereignisErlaubt(stand, id)) || mitTaste[0];
      if (ev) { tue(() => motor.ereignis(stand, ev)); return; }
      if (k === "r" || k === "R") { if (stand.rundenAktiv) runde(); return; }
      if (k === "w" || k === "W") { if (map.rundenwurf && stand.rundenAktiv) rundenwurf(0); return; }
      if (k === "l" || k === "L") { fenster = "lage"; zeige(); return; }
      if (k === "a" || k === "A") { if (s && s.cue) spiele(s.cue); return; }
      if (k === "s" || k === "S") { stoppe(); zeige(); return; }
      if (k === "n" || k === "N") { if ([...stand.verlauf].some(id => (map.schritte[id] || {}).typ === "npc")) { fenster = "npc"; zeige(); } return; }
      if (k === "Tab") {
        const aktiv = stand.gegner.filter(g => !g.weg);
        if (!aktiv.length) return;
        e.preventDefault();
        const i = aktiv.findIndex(g => `g:${g.uid}` === markiert);
        markiert = `g:${aktiv[(i + (e.shiftKey ? aktiv.length - 1 : 1)) % aktiv.length].uid}`;
        zeige(); return;
      }
      if (markiert && markiert.startsWith("g:") && (k === "+" || k === "-" || k === "*")) tue(() => motor.schaden(stand, markiert.slice(2), k === "+" ? 1 : k === "*" ? 2 : -1));
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

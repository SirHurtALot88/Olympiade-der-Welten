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
  // Welcher Abend gerade offen ist (übersteht das Neuladen) und eine Sicherung des letzten Stands samt Zurück-Stapel
  const OFFEN = "kartenschmiede-spiel-offen", SICHERUNG = "kartenschmiede-spiel-sicherung";

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
  const FARBE = { held: "#6fb0ff", gegner: "#ff6a4a", freund: "#4fd1a5", figur: "#f2cf4a", tot: "#77736b" };

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
  // Meldungen erscheinen als Toast links unten und verschwinden nach 6 s; Fehler bleiben bis zur nächsten Aktion
  let meldungTakt = null;
  const melde = (t, bleibt) => {
    meldung = t; const m = $("spMsg"); if (m) m.textContent = t;
    clearTimeout(meldungTakt);
    if (!bleibt && t) meldungTakt = setTimeout(() => { meldung = ""; const x = $("spMsg"); if (x) x.textContent = ""; }, 6000);
  };
  const merkeOffen = id => { try { if (id) localStorage.setItem(OFFEN, id); else localStorage.removeItem(OFFEN); } catch { /* egal */ } };
  const offenGemerkt = () => { try { return localStorage.getItem(OFFEN); } catch { return null; } };
  const sicherung = () => { try { return JSON.parse(localStorage.getItem(SICHERUNG) || "null"); } catch { return null; } };
  function sichereLokal(inhalt) {
    // Mit den letzten Zurück-Schritten; passt das nicht in den Browser-Speicher, dann ohne
    for (const undo of [stand.undo.slice(-10), []]) {
      try { localStorage.setItem(SICHERUNG, JSON.stringify({ id: standId, inhalt, undo })); return; } catch { /* zu groß */ }
    }
  }
  // Zuletzt gespeichert: Zeit oder Fehler, für die Anzeige in der Kopfleiste
  let gespeichert = null;
  async function ladeListe() {
    if (!KS.SERVER) { staende = lokal().map(x => ({ id: x.id, name: x.name, kampagne: x.kampagne, map: x.map, fertig: !!x.fertig, updatedAt: x.gespeichertUm })); return; }
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
    clearTimeout(speicherTakt); speicherTakt = null;
    // Den Undo-Stapel nicht mitspeichern: Er ist groß und gilt nur für diesen Abend am Laptop (er steht in der Sicherung)
    const inhalt = { ...stand, undo: [], id: standId, gespeichertUm: new Date().toISOString() };
    sichereLokal(inhalt);
    if (!KS.SERVER) {
      try { localStorage.setItem(LOKAL, JSON.stringify(lokal().filter(x => x.id !== standId).concat(inhalt))); gespeichert = { ok: true, zeit: new Date() }; }
      catch { gespeichert = { ok: false }; melde("Browser-Speicher voll."); }
      zeigeKopf();
      return;
    }
    let ok = false;
    try {
      const r = await fetch(`${API_STAND}/${encodeURIComponent(standId)}`, { method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inhalt }) });
      ok = r.ok;
    } catch { ok = false; }
    // Erfolg zeigt nur die Kopfleiste; ein Fehler meldet sich, die lokale Sicherung hält den Stand bis zum nächsten Versuch
    gespeichert = ok ? { ok: true, zeit: new Date() } : { ok: false };
    if (!ok) melde("Speichern auf dem Server fehlgeschlagen. Der Stand ist im Browser gesichert; die nächste Aktion versucht es erneut.", true);
    zeigeKopf();
  }
  const spaeter = () => { clearTimeout(speicherTakt); speicherTakt = setTimeout(speichere, 700); };

  // Der Laptop soll mitten im Abend nicht in den Ruhezustand gehen
  let wachSperre = null;
  async function wachHalten(an) {
    try {
      if (an && !wachSperre && navigator.wakeLock && document.visibilityState === "visible") {
        wachSperre = await navigator.wakeLock.request("screen");
        wachSperre.addEventListener("release", () => { wachSperre = null; });
      }
      if (!an && wachSperre) { await wachSperre.release(); wachSperre = null; }
    } catch { wachSperre = null; }
  }
  document.addEventListener("visibilitychange", () => { if (stand && document.visibilityState === "visible") wachHalten(true); });
  // Seite wird geschlossen oder neu geladen: was noch nicht gespeichert ist, landet sofort in der lokalen Sicherung
  window.addEventListener("pagehide", () => { if (stand && speicherTakt) { clearTimeout(speicherTakt); sichereLokal({ ...stand, undo: [], id: standId, gespeichertUm: new Date().toISOString() }); } });

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
  const punkteFuer = werte => (werte && werte.quality ? R.punkte(werte).pts : 0);
  // Heldenpunkte für die Gegnerwellen (OPR: Gefährten zählen mit). Ohne Gruppe die vier Vorlagen-Helden
  async function heldenpunkteVon(gruppeId) {
    const G = window.KartenschmiedeGruppe;
    const g = G && gruppeId ? await G.gruppe(gruppeId) : null;
    if (g) return G.punkteVon(g);
    return KS.VORLAGEN.filter(v => v.d.role === "hero").reduce((n, v) => n + punkteFuer(v.d), 0);
  }
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
    for (const k of Object.keys(letzteWerte)) delete letzteWerte[k];
    for (const k of Object.keys(blitz)) delete blitz[k];
    motor = map ? SM.erstelle(map, { werte: werteFuer, stufe: stufeFuer, punkte: punkteFuer }) : null;
    const mp = map && (S.MOOSGRAB.maps || []).find(x => x.nr === map.map);
    karte = mp ? mp.karte : null;
  }
  const letzteStufe = () => { try { return SM.stufeId(localStorage.getItem("kartenschmiede-stufe")) || SM.STANDARD_STUFE; } catch { return SM.STANDARD_STUFE; } };
  // Woher die Kampagnen-Werte kommen: der passende Stand derselben Kampagne mit einer früheren Map, abgeschlossene
  // und spätere Maps zuerst. Ist er nicht abgeschlossen, rechnet die App die Übernahme mit dessen Map nach.
  async function findeUebernahme(ziel) {
    const kandidaten = staende.filter(x => x.kampagne === ziel.kampagne && (x.map == null || x.map < ziel.map))
      .sort((a, b) => (b.fertig === true) - (a.fertig === true) || (b.map || 0) - (a.map || 0) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    for (const k of kandidaten.slice(0, 8)) {
      const alt = await ladeStand(k.id).catch(() => null);
      if (!alt || !(alt.map < ziel.map)) continue;
      if (alt.uebernahme) return { ...alt.uebernahme, von: { ...(alt.uebernahme.von || {}), name: alt.name, map: alt.map } };
      const altMap = MAPS.find(m => m.kampagne === alt.kampagne && m.map === alt.map);
      if (altMap) { const m = SM.erstelle(altMap, {}); return m.uebernahme(m.migriere(alt)); }
    }
    return null;
  }
  // opt (für „nächste Map starten“): map, uebernahme, gruppeId, schwierigkeit; sonst gilt, was auf dem Startbildschirm steht
  async function neuerAbend(opt = {}) {
    const nr = opt.map || ($("spMapWahl") ? $("spMapWahl").value : (MAPS[0] || {}).map);
    waehleMap(nr);
    // Kampagnen-Leisten, Entscheidungen, Beute und Sporenpunkte aus der letzten Map übernehmen
    const uebernahme = opt.uebernahme !== undefined ? opt.uebernahme : await findeUebernahme(map);
    const gruppeId = opt.gruppeId !== undefined ? opt.gruppeId : ($("spGruppe") ? $("spGruppe").value || null : null);
    standId = neueId();
    const schwierigkeit = opt.schwierigkeit || ($("spStufe") || {}).value || SM.STANDARD_STUFE;
    try { localStorage.setItem("kartenschmiede-stufe", schwierigkeit); } catch { /* egal */ }
    const heldenpunkte = await heldenpunkteVon(gruppeId);
    stand = motor.neu({ name: `${map.titel} · ${new Date().toLocaleDateString("de-DE")}`, gruppeId, uebernahme, schwierigkeit, heldenpunkte });
    meldung = uebernahme ? `Aus „${(uebernahme.von || {}).name || "der letzten Map"}“ übernommen: Leisten, Entscheidungen, Beute und Sporenpunkte.` : "";
    merkeOffen(standId); wachHalten(true);
    await ladeHelden();
    await speichere(); await ladeListe();
    zeige();
  }
  async function oeffne(id) {
    let s = await ladeStand(id).catch(() => null);
    // Ist die Sicherung im Browser neuer (Server war nicht erreichbar oder die Seite ging zu schnell zu), gilt sie
    const b = sicherung(), ausSicherung = b && b.id === id && b.inhalt && (!s || String(b.inhalt.gespeichertUm || "") > String(s.gespeichertUm || ""));
    if (ausSicherung) s = b.inhalt;
    if (!s) { merkeOffen(null); melde("Spielstand nicht gefunden."); return; }
    waehleMap(s.map);
    stand = motor.migriere(Object.assign(s, { undo: b && b.id === id && Array.isArray(b.undo) ? b.undo : [] }));
    standId = id;
    merkeOffen(id); wachHalten(true);
    gespeichert = s.gespeichertUm ? { ok: true, zeit: new Date(s.gespeichertUm) } : null;
    if (ausSicherung) { melde("Der Stand aus dem Browser war neuer als der auf dem Server und ist übernommen."); speichere(); }
    // Die Gruppe kann seitdem Punkte dazubekommen haben: kommende Kämpfe richten sich nach dem neuen Stand
    motor.setzeHeldenpunkte(stand, await heldenpunkteVon(stand.gruppeId));
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
    if (s && stand.schritt !== vorher) { markiert = null; popup = null; meldung = ""; erinnern = false; antreiberNr = 0; antreiberZu = null; if (s.stoppt) stoppe(s.stoppt); if (s.typ === "npc") fenster = "npc"; else if (fenster && fenster.startsWith("npc")) fenster = null; }
    spaeter();
    zeige();
  }
  // Die Seitenspalte (Tischkarte, Gegner) fehlt nur beim Aufbau, solange noch keine Gegner am Tisch stehen
  const mitSeite = s => s.typ !== "aufbau" || stand.gegner.some(g => !g.weg);
  // Ein Kampf ohne erreichtes Ziel endet nur mit Klick, nicht mit der Leertaste (sonst ist die Frau aus Versehen verloren)
  const kampfOffen = s => s && s.typ === "kampf" && !stand.kampfZiel;
  const weiter = () => tue(() => motor.weiter(stand));
  const zurueck = () => tue(() => motor.zurueck(stand));
  const runde = () => tue(() => {
    for (const k of Object.keys(verhWurf)) delete verhWurf[k]; const r = motor.runde(stand); melde(`Runde ${stand.runde} beendet.${r.texte.length ? ` ${r.texte.join(" ")}` : ""}${map.rundenwurf ? " Jetzt würfeln: Taste W." : ""}`); });
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

  // ---------- Beute ----------
  // Ein Beutewurf wie „Heiltrank“ wird über den Katalog zum Gegenstand mit Regeltext und lässt sich einem Helden geben
  const gegenstand = text => ((window.Katalog || {}).GRUNDBESTAND || []).filter(x => x.typ === "gegenstand").find(x => String(text || "").includes(x.name)) || null;
  function beuteHtml(wurf) {
    if (!wurf) return "";
    const g = gegenstand(wurf.text);
    return `<b>${wurf.wurf}</b> · ${esc(wurf.text)}${g ? `<span class="sp-beute"><small>${symText(g.text)}</small><span>Geben an: ${helden.map(h => `<button type="button" class="btn ghost sm" data-sp="geben" data-held="${esc(h.name)}" data-sache="${esc(g.name)}">${esc(h.name)}</button>`).join("")}</span></span>` : ""}`;
  }
  const inventarHtml = name => {
    const liste = (stand.inventar || {})[name] || [];
    if (!liste.length) return `<p class="hint">Keine Beute.</p>`;
    const andere = helden.filter(h => h.name !== name);
    return `<ul class="sp-inventar">${liste.map((x, i) => { const g = gegenstand(x); return `<li><b>${esc(x)}</b>${g ? ` <small>${symText(g.text)}</small>` : ""} <button type="button" class="btn ghost sm" data-sp="benutzen" data-held="${esc(name)}" data-i="${i}">benutzt</button>
      ${andere.length ? `<select class="sp-reichen" data-reichen="${esc(name)}" data-i="${i}" title="An einen anderen Helden geben"><option value="">geben an …</option>${andere.map(h => `<option value="${esc(h.name)}">${esc(h.name)}</option>`).join("")}</select>` : ""}</li>`; }).join("")}</ul>`;
  };

  // ---------- Bausteine ----------
  const symText = t => (KS.symText ? KS.symText(t) : esc(t));
  const liste = (punkte, cls = "") => punkte && punkte.length ? `<ul class="${cls}">${punkte.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "";
  const vorlesen = (text, wer) => text ? `<blockquote class="sp-lies">${wer ? `<small>${esc(wer)}</small>` : ""}${esc(text)}</blockquote>` : "";
  // Zum Ansagen am Tisch (Zustand, Bedrohung): kleiner als ein Vorlesetext, aber klar als Satz für die Spieler markiert
  const sag = text => text ? `<p class="sp-sag">„${esc(String(text).replace(/^[„"]|[“"]$/g, ""))}“</p>` : "";
  const gm = text => text ? `<p class="sp-gm">${esc(text)}</p>` : "";
  const taste = t => t ? `<kbd>${esc(t)}</kbd>` : "";
  // Probe-Stufe: „ab 5“ oder, für schlechte Würfe, „bei 1“ / „bei 1–2“
  const stufeName = st => (st.bis ? `bei ${st.bis === 1 ? "1" : `1–${st.bis}`}` : `ab ${st.ab}`);

  // ---------- Uhr und Antreiber ----------
  const ueberzogen = () => { const g = motor.zeitlimit(stand); return g > 0 && motor.minuten(stand) >= g; };
  const abendHtml = () => { const m = motor.minutenSeit(stand.abendSeit); return `<span class="sp-uhr" title="So lange läuft der Abend schon">🌙 ${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}</span>`; };
  // Abwechselnde Initiative: wer diese Runde schon dran war und wer als Nächstes aktiviert
  function zugHtml() {
    if (!stand.rundenAktiv) return "";
    const akt = stand.aktiviert || {}, gegner = stand.gegner.filter(g => !g.weg && g.wunden < g.zaeh && !motor.istFreund(g.id));
    const h = helden.filter(x => akt[`held:${x.name}`]).length, g = gegner.filter(x => akt[`g:${x.uid}`]).length;
    if (!gegner.length) return "";
    const heldenFertig = h >= helden.length, gegnerFertig = g >= gegner.length;
    const dran = heldenFertig && gegnerFertig ? "Runde beenden (R)" : heldenFertig ? "Gegner" : gegnerFertig ? "Helden" : h <= g ? "Helden" : "Gegner";
    return `<span class="sp-pill sp-zug" title="Abwechselnd aktivieren: Helden ${h} von ${helden.length}, Gegner ${g} von ${gegner.length}. Haken am Heldenchip oder am Gegner setzen."><b>Zug</b> H ${h}/${helden.length} · G ${g}/${gegner.length} <em>→ ${dran}</em></span>`;
  };
  const uhrHtml = () => `<span class="sp-uhr ${ueberzogen() ? "spaet" : ""}" title="So lange läuft dieser Schritt schon${motor.zeitlimit(stand) ? `; nach ${motor.zeitlimit(stand)} Minuten schlägt die App Antreiber vor` : ""}">⏱ ${motor.minuten(stand)} min</span>${abendHtml()}`;
  let antreiberNr = 0, antreiberZu = null;
  function antreiberHtml(immer) {
    const liste = motor.antreiber(stand);
    if (!liste.length || (!immer && (!ueberzogen() || antreiberZu === stand.schritt))) return "";
    const a = liste[antreiberNr % liste.length];
    return `<div class="sp-antreiber"><header><b>⏳ ${immer ? "Antreiben" : "Die Szene zieht sich"}: ${esc(a.titel || "")}</b>
      <span>${liste.length > 1 ? `<button type="button" class="btn ghost sm" data-sp="antreiber-naechster">Anderer (${(antreiberNr % liste.length) + 1}/${liste.length})</button>` : ""}<button type="button" class="btn ghost sm" data-sp="antreiber-zu">✕</button></span></header>
      ${vorlesen(a.vorlesen)}${gm(a.gmNotiz)}</div>`;
  }

  // ---------- Aufträge ----------
  // Der aktive Hauptauftrag steht dauerhaft über der Schrittkarte: so weiß Chris immer, was die Spieler gerade wissen und tun sollen
  let erinnern = false;
  function auftragHtml() {
    const alle = motor.auftraege(stand), offen = alle.filter(a => !a.erledigtJetzt);
    if (!alle.length) return "";
    const haupt = offen.find(a => a.art === "Haupt") || offen[0];
    if (!haupt) return `<div class="sp-auftrag fertig">🎯 Alle Aufträge dieser Map erledigt.</div>`;
    const neben = offen.filter(a => a !== haupt).length;
    return `<div class="sp-auftrag"><span>🎯 ${esc(haupt.art || "Auftrag")}</span><b>${esc(haupt.titel || "")}</b><em>„${esc(haupt.spieler || "")}“</em>
      ${neben ? `<small>+${neben} weitere (Lage)</small>` : ""}${haupt.vorlesen ? `<button type="button" class="btn ghost sm" data-sp="erinnern">Erinnern</button>` : ""}</div>${erinnern ? vorlesen(haupt.vorlesen, "Erinnerung") : ""}`;
  }

  // ---------- Kopfleiste ----------
  // Wo im Verlauf der Kampagne: ein Abschnitt je Map, der aktuelle füllt sich mit den Schritten
  function fortschrittHtml(pos, gesamt) {
    const k = (S.KAMPAGNEN || []).find(x => x.id === map.kampagne) || S.MOOSGRAB || {}, zahl = Math.max(+map.map, (k.maps || []).length || 0);
    if (zahl < 2) return "";
    const teile = Array.from({ length: zahl }, (_, i) => { const n = i + 1, w = n < map.map ? 100 : n > map.map ? 0 : Math.round(pos / gesamt * 100);
      return `<i title="Map ${n}${(k.maps || [])[i] && k.maps[i].titel ? `: ${esc(k.maps[i].titel)}` : ""}"><u style="width:${w}%"></u></i>`; }).join("");
    const prozent = Math.round(((map.map - 1) + pos / gesamt) / zahl * 100);
    return `<span class="sp-fortschritt" title="Kampagne: Map ${map.map} von ${zahl}, etwa ${prozent} % geschafft">${teile}<em>${prozent} %</em></span>`;
  }
  const speicherHtml = () => {
    const g = gespeichert;
    const zeit = g && g.zeit ? `${g.zeit.getHours()}:${String(g.zeit.getMinutes()).padStart(2, "0")}` : "";
    return `<button type="button" class="btn ghost sm sp-gespeichert ${g && !g.ok ? "fehler" : ""}" data-sp="speichern" title="${g && g.ok ? `Gespeichert um ${zeit}. ` : ""}Die App speichert nach jeder Aktion von selbst; beim Neuladen geht es hier weiter. Klick oder Cmd + S speichert sofort.">${g && !g.ok ? "⚠ Speichern" : g ? "💾 ✓" : "💾"}</button>`;
  };
  // Zuletzt gezeigte Leistenwerte: Ändert sich eine Leiste, blitzt ihre Pille auf und zeigt 3 s lang „↑1“
  const letzteWerte = {}, blitz = {};
  function zeigeKopf() {
    const el = $("spKopf");
    if (!el || !stand) return;
    const s = motor.schritt(stand), runden = stand.rundenAktiv && s && s.typ !== "ende";
    const ids = Object.keys(map.schritte), pos = ids.indexOf(stand.schritt) + 1;
    const leisten = Object.entries(map.leisten).filter(([k]) => stand.leisten[k] && stand.leisten[k].aktiv).map(([k, def]) => {
      const l = stand.leisten[k], alt = letzteWerte[k], d = alt === undefined ? 0 : l.wert - alt;
      letzteWerte[k] = l.wert;
      if (d) blitz[k] = { d, bis: Date.now() + 3000 };
      const b = blitz[k] && blitz[k].bis > Date.now() ? blitz[k] : null;
      return `<span class="sp-pill ${b ? (b.d > 0 ? "blitz-hoch" : "blitz-runter") : ""}" title="${esc(`${def.name}: ${def.text || ""}`)}">${b ? `<sup>${b.d > 0 ? "↑" : "↓"}${Math.abs(b.d)}</sup>` : ""}<b>${esc(String(def.name).replace(/-Leiste$/, "").replace(/^Heddas /, ""))}</b> ${Array.from({ length: def.max - def.min }, (_, i) => `<i class="${i < l.wert - def.min ? "an" : ""}"></i>`).join("")} <em>${l.wert}</em></span>`;
    }).join("");
    const laeuft = [spieler.haupt, spieler.schleife].filter(a => !a.paused).map(a => a.dataset.cue);
    el.innerHTML = `<div class="sp-titel"><b>${esc(map.kampagne)} · Map ${map.map}</b><span class="sp-zeile-uhr">${fortschrittHtml(pos, ids.length)}${uhrHtml()}</span><small>${esc(map.titel)} · Schritt ${pos}/${ids.length} · <span class="sp-stufe st-${esc(motor.schwierigkeit(stand).id)}" title="${esc(motor.schwierigkeit(stand).text)}">${esc(motor.schwierigkeit(stand).name)}</span></small></div>
      <div class="sp-pills">${runden ? `<span class="sp-pill sp-runde"><b>Runde</b> <em>${stand.runde + 1}</em></span>` : ""}${leisten}
        ${zugHtml()}<span class="sp-pill sp-verhalten ${motor.wuetend(stand) ? "wuetend" : ""}" title="Verhaltenstabelle der Gegner"><b>Gegner</b> ${motor.wuetend(stand) ? "WÜTEND" : "ruhig"}</span>
        ${laeuft.length ? `<span class="sp-pill sp-ton">♪ ${esc(laeuft.join(", "))} <button type="button" class="btn ghost sm" data-sp="stopp">■ Stopp ${taste("S")}</button></span>` : ""}</div>
      <div class="sp-kopfknoepfe">${speicherHtml()}<button type="button" class="btn ghost sm" data-sp="antreiben" title="Antreiben: Vorschläge, um die Spieler weiterzubringen">⏳</button>
        <button type="button" class="btn ghost sm" data-sp="log">Log ${taste("P")}</button>
        <button type="button" class="btn ghost sm" data-sp="lage">Lage ${(s && s.ereignisse || []).some(id => String((map.ereignisse[id] || {}).taste || "").toLowerCase() === "l") ? "" : taste("L")}</button>
        <button type="button" class="btn ghost sm" data-sp="vollbild" title="Vollbild (am Mac auch Ctrl + Cmd + F)">⛶</button>
        <button type="button" class="btn ghost sm" data-sp="schliessen">Menü</button></div>`;
  }

  // ---------- Aktionsleiste unten ----------
  const GRUPPEN = ["Untersuchen", "Bewegen", "Wege", "Story", "Fragen", "Lärm", "Kampf", "Aktionen"];
  // Ohne Angabe in den Daten: aus dem Ereignis erraten (Probe/Marker = Untersuchen, Lärm-Leiste = Lärm …)
  function gruppeVon(e) {
    if (e.gruppe) return e.gruppe;
    if (e.leisten && Object.keys(e.leisten).some(k => /laerm/.test(k))) return "Lärm";
    if (e.marker || e.probe || e.beutewurf) return "Untersuchen";
    if (/^Frage|fragen/i.test(e.name || "")) return "Fragen";
    return "Aktionen";
  }
  // In der Leiste nur der Kern des Namens: Ortsangaben in Klammern stehen im Tooltip und auf der Tischkarte, „(+1)“ bleibt
  const kurzName = e => e.kurz || String(e.name || "").replace(/\s*\((?![+−-]\d)[^)]*\)/g, "").trim();
  function aktionsLeiste(s) {
    // Was noch nicht möglich ist (z. B. die Quelle vor Marker 3), bleibt ausgeblendet; Erledigtes bleibt mit ✓ stehen
    const npcOffen = fenster && fenster.startsWith("npc");
    const ids = (s.ereignisse || []).filter(id => map.ereignisse[id] && !map.ereignisse[id].intern && (stand.ereignisse[id] || motor.ereignisErlaubt(stand, id)))
      // Ist die NPC-Schublade offen, stehen die Fragen dort und nicht unten
      .filter(id => !(npcOffen && gruppeVon(map.ereignisse[id]) === "Fragen"));
    const knopf = id => {
      const e = map.ereignisse[id], ok = motor.ereignisErlaubt(stand, id), schon = stand.ereignisse[id];
      return `<button type="button" class="btn ghost sm ${ok ? "" : "aus"} ${schon ? "erledigt" : ""}" data-ev="${esc(id)}" ${ok ? "" : "disabled"} title="${esc([e.name, e.kosten].filter(Boolean).join(" · "))}">${taste(e.taste)} ${esc(kurzName(e))}${schon ? " ✓" : ""}</button>`;
    };
    // Nach Gruppen gegliedert (Untersuchen, Wege, Lärm …); Erledigtes rutscht ans Ende seiner Gruppe
    const gruppen = new Map();
    for (const id of ids) { const g = gruppeVon(map.ereignisse[id]); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(id); }
    const laerm = stand.leisten.laerm && stand.leisten.laerm.aktiv ? stand.leisten.laerm.wert : null;
    const evs = [...gruppen.entries()].sort((a, b) => GRUPPEN.indexOf(a[0]) - GRUPPEN.indexOf(b[0]))
      .map(([g, liste]) => {
        const sortiert = [...liste.filter(id => !stand.ereignisse[id]), ...liste.filter(id => stand.ereignisse[id])];
        return `<div class="sp-gruppe g-${esc(g.toLowerCase().replace(/[^a-zäöü]/g, ""))}" data-gruppe="${esc(g)}"><span>${esc(g)}${g === "Lärm" && laerm !== null ? ` ${laerm}` : ""}</span>${sortiert.map(knopf).join("")}</div>`;
      }).join("");
    const rw = map.rundenwurf && motor.gilt(stand, map.rundenwurf.wenn) && stand.rundenAktiv && s.typ !== "ende";
    const rwFaellig = rw && stand.runde > 0 && stand.rundenwurfRunde !== stand.runde;
    const runden = stand.rundenAktiv && s.typ !== "ende";
    const naechster = s.typ !== "wahl" && motor.naechsterId(stand);
    // „Weiter“ steht immer ganz rechts unten, auch wenn es gerade nicht geht (dann sagt es, warum)
    const weiterKnopf = s.typ === "wahl" ? `<button type="button" class="btn sm weiter ghost" disabled>Antwort 1–${s.optionen.length} wählen</button>`
      : !naechster && s.typ === "ende" ? endeKnopf()
      : !naechster ? `<button type="button" class="btn sm weiter ghost" disabled>Ende der Map</button>`
      : kampfOffen(s) ? `<button type="button" class="btn sm weiter ghost" data-sp="weiter" title="Der Kampf läuft noch. Nur klicken, wenn er ohne Ziel endet.">Weiter ohne Ziel →</button>`
      : `<button type="button" class="btn sm weiter" data-sp="weiter">Weiter → ${taste("Leertaste")}</button>`;
    return `<div class="sp-zeile1"><div class="sp-evs">${evs || `<span class="hint">In diesem Schritt gibt es keine Sonderaktionen.</span>`}</div></div>
      <div class="sp-zeile2"><p class="sp-toast" id="spMsg" role="status">${esc(meldung)}</p>
        <div class="sp-runden">${rw ? `<button type="button" class="btn sm ${rwFaellig ? "faellig" : "ghost"}" data-sp="rundenwurf" title="${esc(map.rundenwurf.text || "")}">🎲 ${esc(map.rundenwurf.name)} ${taste("W")}</button>` : ""}
        ${runden ? `<button type="button" class="btn sm" data-sp="runde">Runde beenden ${taste("R")}</button>` : ""}
        <button type="button" class="btn ghost sm" data-sp="zurueck" ${stand.undo.length ? "" : "disabled"}>← Zurück ${taste("⌫")}</button>
        ${weiterKnopf}</div></div>`;
  }
  // Am Ende der Map: erst abschließen (hält fest, was mitkommt), dann die nächste Map mit allem Übernommenen starten
  const naechsteMap = () => MAPS.find(m => m.kampagne === map.kampagne && +m.map === +map.map + 1) || null;
  function endeKnopf() {
    if (!stand.fertig) return `<button type="button" class="btn sm weiter" data-sp="abschliessen">Map abschließen ✓ ${taste("Leertaste")}</button>`;
    const nm = naechsteMap();
    return nm ? `<button type="button" class="btn sm weiter" data-sp="naechste-map">Map ${nm.map} starten →</button>`
      : `<button type="button" class="btn sm weiter ghost" disabled>Abgeschlossen ✓</button>`;
  }
  // Passt Zeile 1 nicht in die Breite, klappen Gruppen ihre letzten Knöpfe in ein „▴ n weitere“ (Story zuerst, Lärm zuletzt)
  function kuerzeLeiste() {
    const evs = document.querySelector(".sp-evs");
    if (!evs) return;
    const zuViel = () => evs.scrollWidth > evs.clientWidth + 2;
    const reihenfolge = ["Story", "Aktionen", "Fragen", "Untersuchen", "Wege", "Bewegen", "Kampf", "Lärm"];
    const kuerze = gruppe => {
      const knoepfe = [...gruppe.querySelectorAll(":scope > button")];
      let mehr = gruppe.querySelector(":scope > .sp-mehrknoepfe");
      if (!mehr) {
        mehr = document.createElement("details");
        mehr.className = "sp-mehrknoepfe";
        mehr.innerHTML = `<summary></summary><div class="sp-dropup"></div>`;
        gruppe.appendChild(mehr);
      }
      const k = knoepfe.find(b => b.classList.contains("erledigt")) || knoepfe[knoepfe.length - 1];
      mehr.querySelector(".sp-dropup").prepend(k);
      mehr.querySelector("summary").textContent = `▴ ${mehr.querySelectorAll("button").length} weitere`;
    };
    for (const behalte of [3, 2, 1]) {
      for (const name of reihenfolge) {
        const gruppe = evs.querySelector(`.sp-gruppe[data-gruppe="${name}"]`);
        while (gruppe && zuViel() && gruppe.querySelectorAll(":scope > button").length > behalte) kuerze(gruppe);
        if (!zuViel()) return;
      }
    }
  }

  // ---------- Schrittkarte ----------
  // Was eine Antwort bewirkt, als Pillen: Leisten rauf/runter, Entscheidungen, die in einer späteren Map nachwirken
  function folgePillen(o) {
    // Die Werte nach Schwierigkeit: auf „Schwer“ wiegt eine schlechte Antwort schwerer als im Text der Map steht
    const pillen = Object.entries(motor.wahlLeisten(stand, o)).filter(([, d]) => d).map(([k, d]) => {
      const def = map.leisten[k] || {}, gut = def.schlecht ? (def.schlecht === "hoch" ? d < 0 : d > 0) : d > 0, anders = (o.leisten || {})[k] !== d;
      return `<i class="${gut ? "plus" : "minus"}" ${anders ? `title="Nach Schwierigkeit angepasst (im Text: ${(o.leisten || {})[k] > 0 ? "+" : ""}${(o.leisten || {})[k]})"` : ""}>${esc(def.name || k)} ${d > 0 ? "+" : "−"}${Math.abs(d)}${anders ? " *" : ""}</i>`;
    });
    const spaeter = new Set();
    for (const k of Object.keys(o.setzt || {})) { const m = ((map.flags[k] || {}).wirktIn || "").match(/map(\d)/); if (m && +m[1] > map.map) spaeter.add(+m[1]); }
    for (const n of spaeter) pillen.push(`<i class="spaeter">wirkt in Map ${n}</i>`);
    if (o.eingabe) pillen.push(`<i>fragt: ${esc(o.eingabe.frage || "")}</i>`);
    return pillen.length ? `<span class="sp-pillen">${pillen.join("")}</span>` : "";
  }
  // Regie-Hinweise: beim ersten Besuch offen, danach eingeklappt
  const regie = (s, punkte) => !punkte || !punkte.length ? "" : `<details class="sp-regie" ${stand.verlauf.filter(x => x === stand.schritt).length <= 1 ? "open" : ""}><summary>Regie · ${punkte.length}</summary>${liste(punkte, "sp-hinweise")}</details>`;
  // gross: im eigenen Schritt (mit Taste A und dem Text des Tracks); sonst kleine Zeile in der Datei-Liste (nur Probe hören)
  function cueKnopf(cue, gross) {
    const def = map.audio[cue] || {};
    const da = hatAudio(cue);
    const laeuft = [spieler.haupt, spieler.schleife].some(a => a.dataset.cue === cue && !a.paused);
    return `<div class="sp-cue ${gross ? "gross" : ""}">
      <button type="button" class="btn ${da ? "" : "ghost"}" data-cue="${esc(cue)}" ${da ? "" : "disabled"}>${laeuft ? "❚❚ Pause" : gross ? "▶ Abspielen" : "▶ Probe"}${gross ? ` ${taste("A")}` : ""}</button>
      <span><b>${esc(cue)}</b> ${esc(def.titel || "")}${def.schleife ? " · Schleife" : ""}${def.dauer ? ` · ${esc(def.dauer)}` : ""}${da ? "" : ` · <em class="fehlt">Datei fehlt</em>`}</span>
      <label class="btn ghost sm sp-upload">${da ? "Ersetzen" : "MP3 hochladen"}<input type="file" accept="audio/*" data-hoch="${esc(cue)}" hidden></label>
    </div>${gross && def.text ? `<details class="sp-tracktext"><summary>Was im Track gesagt wird</summary><p>${esc(def.text)}</p></details>` : ""}`;
  }
  // Während ein Cue läuft schon bereitlegen: was der nächste Aufbau braucht und welche Gegner der nächste Kampf bringt
  function bereitlegenHtml() {
    const teile = [];
    let id = motor.naechsterId(stand);
    for (let i = 0; i < 3 && id && map.schritte[id]; i++) {
      const n = map.schritte[id];
      if (n.typ === "aufbau" && (n.tisch || []).length) teile.push(`<h5>${esc(n.titel)}</h5>${liste(n.tisch)}`);
      if (n.typ === "kampf") {
        const g = motor.vorschauGegner(stand, id);
        if (g.length) teile.push(`<h5>Gleich im Kampf: ${esc(n.titel)}</h5><ul>${g.map(x => `<li><b>${x.anzahl} ×</b> ${esc(x.name)}${x.zone ? ` <small>Zone ${esc(x.zone)}</small>` : ""}</li>`).join("")}</ul>`);
        break;
      }
      if (n.typ === "cue" || n.typ === "aufbau" || n.typ === "vorlesen") { id = Array.isArray(n.weiter) ? null : n.weiter; continue; }
      break;
    }
    return teile.length ? `<div class="sp-bereit"><h4>Schon jetzt bereitlegen, während der Track läuft</h4>${teile.join("")}</div>` : "";
  }
  // Was auf den Tisch muss: Gelände durchnummeriert wie auf der Karte, dazu die Marker
  function aufbauLegende(erzaehlen) {
    if (!karte) return "";
    const MARKER = window.KartenschmiedeSzenarien.MARKER || {}, nummern = new Map();
    for (const g of karte.gelaende) { const n = g.label || (S.GELAENDE[g.art] || {}).name || g.art; if (!nummern.has(n)) nummern.set(n, nummern.size + 1); }
    const auf = motor.aufgedeckt(stand);
    // Alle Marker, auch die verdeckten: Chris muss wissen, was offen hinkommt und was er sich nur merkt
    const marker = karte.marker.filter(m => m.typ !== "ausgang");
    return `<div class="sp-legende"><div><h4>${erzaehlen ? "Gelände (nur beschreiben)" : "Gelände (frei hinstellen)"}</h4><ul class="sp-gel">${[...nummern.keys()].map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
      <div><h4>${erzaehlen ? "Marker (was die Spieler sehen)" : "Marker (genau dort)"}</h4><ul class="sp-markerliste">${marker.map(m => {
        const [z, f, name] = MARKER[m.typ] || ["•", "#fff", m.typ], ev = markerEreignis(m), zu = markerVerdeckt(m, auf);
        const wof = (ev && ev[1].wofuer) || markerInfo(m);
        return `<li class="${zu ? "zu" : ""}"><i style="background:${f}">${esc(m.label && m.label.length <= 2 ? m.label : z || "▲")}</i><span><b>${esc(name)}</b> <em>${zu ? (erzaehlen ? "🔒 verdeckt: nicht erwähnen" : "🔒 verdeckt: nicht hinlegen") : (erzaehlen ? "👁 sichtbar" : "👁 offen hinlegen")}</em>${wof ? `<small>${esc(wof)}</small>` : ""}</span></li>`;
      }).join("")}</ul></div></div>`;
  }
  function schrittInhalt(s) {
    switch (s.typ) {
      case "vorbereitung": return `<ul class="sp-check">${(s.checkliste || []).map((c, i) => {
        const k = `${stand.schritt}:${i}`;
        return `<li><label><input type="checkbox" data-check="${esc(k)}" ${stand.checks[k] ? "checked" : ""}> ${esc(c)}</label></li>`;
      }).join("")}</ul>${s.uebernahme ? uebernahmeHtml() : ""}${folgenHtml(s)}${gm(s.hinweis)}${s.audio || stand.schritt === "vorb-stand" ? audioListe() : ""}`;
      case "aufbau": {
        // nurErzaehlen: Story-Ort ohne Kampf. Nichts aufbauen, die Skizze ist nur für dich, du beschreibst den Ort
        const text = s.nurErzaehlen
          ? `<p class="sp-erzaehlen">Nichts aufbauen. Aufgebaut wird erst, wenn gekämpft wird. Beschreib den Ort, die Skizze ist nur für dich.</p>${s.text ? vorlesen(s.text) : ""}<h4>Was es dort gibt</h4>${liste(s.tisch, "sp-tisch")}${gm(s.hinweis)}`
          : `${liste(s.tisch, "sp-tisch")}${s.regel ? `<h4>Sag an</h4>${vorlesen(s.regel)}` : ""}${gm(s.hinweis)}`;
        if (mitSeite(s)) return text;
        return `<div class="sp-aufbau"><div>${text}</div><div class="sp-aufbaukarte">${tischKarte({ gross: true, skizze: s.skizze })}${aufbauLegende(s.nurErzaehlen)}</div></div>`;
      }
      case "cue": return `${cueKnopf(s.cue, true)}${gm(s.notiz || s.gmNotiz)}${s.optional && !hatAudio(s.cue) ? `<p class="sp-gm">Kein Track da: einfach weiter, du spielst die Szene live.</p>` : ""}${s.text ? vorlesen(s.text) : ""}${bereitlegenHtml()}`;
      case "vorlesen": return `${vorlesen(s.text, s.als && map.figuren[s.als] ? map.figuren[s.als].name : "")}${gm(s.gmNotiz)}`;
      case "regel": return `${vorlesen(s.text)}${gm(s.gmNotiz)}`;
      case "spieler": return `<p class="sp-text">${esc(s.text || "")}</p><!--passiert-->${regie(s, s.hinweise)}`;
      case "npc": {
        const f = map.figuren[s.figur] || {};
        return `${vorlesen(s.einstieg, f.name)}<!--passiert-->${gm(s.gmNotiz)}<button type="button" class="btn ghost sm" data-sp="npc">NPC-Schublade öffnen ${taste("N")}</button>`;
      }
      case "wahl": return `${s.ansage ? vorlesen(s.ansage) : ""}<p class="sp-anleitung">${esc(s.frage || "Wähle, was dem am nächsten kommt, was die Spieler sagen.")}</p>
        <div class="sp-optionen n${Math.min(4, s.optionen.length)}">${s.optionen.map(o => `<button type="button" class="sp-option" data-wahl="${esc(o.taste)}" title="${esc(o.folge || "")}">
          <kbd>${esc(o.taste)}</kbd><span><b>${esc(o.kurz)}</b>${o.text ? `<small>${esc(o.text)}</small>` : ""}${folgePillen(o)}${o.folge ? `<em>${esc(o.folge)}</em>` : ""}</span></button>`).join("")}</div>`;
      case "kampf": {
        const ziel = stand.kampfZiel ? `<p class="sp-ziel">Ziel erreicht. Weiter führt zu: <b>${esc((map.schritte[stand.kampfZiel] || {}).titel || stand.kampfZiel)}</b></p>` : "";
        return `${s.musik ? `<div class="sp-musik"><span>Kampfmusik</span>${cueKnopf(s.musik, false)}</div>` : ""}<p class="sp-text">${symText(s.text || "")}</p>${ziel}${budgetZeile()}<!--passiert-->${regie(s, s.hinweise)}${verhaltenTabelle()}`;
      }
      case "ende": {
        const ep = motor.epListe(stand);
        const nm = naechsteMap();
        const fertig = stand.fertig
          ? `<div class="sp-uebernahme"><b>✓ Map abgeschlossen</b><span>${nm ? `Unten „Map ${nm.map} starten“: die neue Map übernimmt automatisch ${esc(uebernahmeText(stand.uebernahme || motor.uebernahme(stand)))}.` : `Die Kampagne geht mit Map ${map.map + 1} weiter; die ist im Reiter Spielen noch nicht angelegt. Der Stand ist gespeichert, die Übernahme steht bereit.`}</span></div>`
          : `<div class="sp-uebernahme offen"><b>Noch nicht abgeschlossen</b><span>Beute verteilen, dann unten „Map abschließen“ (oder Leertaste).</span></div>`;
        return `${fertig}<h4>Erfahrung</h4><ul>${ep.map(e => `<li class="${e.erreicht ? "ja" : "nein"}">${e.erreicht ? "✓" : "✗"} ${esc(e.text)}: ${e.ep} EP</li>`).join("")}</ul>
          <h4>Beute</h4>${liste(s.beute)}<p class="sp-beutezeile"><button type="button" class="btn ghost sm" data-wurf="ende">Beutewurf W6</button> ${beuteHtml(wuerfe.ende)}</p>
          <h4>Inventar der Helden</h4><div class="sp-inventare">${helden.map(h => `<div><b>${esc(h.name)}</b>${inventarHtml(h.name)}</div>`).join("")}</div>
          <h4>Folgen für die nächste Map</h4>${liste(motor.folgen(stand), "sp-folgen")}
          <h4>Notieren</h4>${liste(s.notieren)}${s.erholung ? `<h4>Erholung</h4><p class="sp-text">${esc(s.erholung)}</p>` : (s.zuruecksetzen || []).length ? `<p class="sp-gm">${esc(s.zuruecksetzen.join(", "))} zurücksetzen.</p>` : ""}`;
      }
      default: return "";
    }
  }
  // Was aus den Entscheidungen der letzten Map folgt: nur, was wirklich passiert ist; die App hat es schon verbucht
  function folgenHtml(s) {
    if (!(s.folgen || []).length) return "";
    const f = motor.folgen(stand);
    return `<h4>Das folgt aus Map ${map.map - 1}</h4>${f.length ? `<ul class="sp-folgen-start">${f.map(t => `<li>✓ ${esc(t)}</li>`).join("")}</ul>` : `<p class="hint">Nichts Besonderes: in Map ${map.map - 1} ist nichts passiert, was hier etwas ändert.</p>`}`;
  }
  // Was aus der letzten Map gekommen ist (die App übernimmt es selbst; hier steht es nur zum Nachsehen)
  function uebernahmeText(u) {
    if (!u) return "";
    const leisten = Object.entries(u.leisten || {}).map(([k, v]) => `${String((map.leisten[k] || {}).name || k).replace(/-Leiste$/, "")} ${v}`);
    const inv = Object.entries(u.inventar || {}).filter(([, l]) => (l || []).length).map(([h, l]) => `${h}: ${l.join(", ")}`);
    const sp = Object.entries(u.sporen || {}).filter(([, n]) => n).map(([h, n]) => `${h} ${n}`);
    const flags = typeof u.flags === "number" ? u.flags : Object.keys(u.flags || {}).length;
    return [...leisten, flags ? `${flags} Entscheidungen` : "", inv.length ? `Beute (${inv.join(" · ")})` : "", sp.length ? `Sporenpunkte (${sp.join(", ")})` : ""].filter(Boolean).join(", ");
  }
  function uebernahmeHtml() {
    const u = stand.uebernommen;
    if (!u && +map.map <= 1) return `<div class="sp-uebernahme"><b>Erste Map der Kampagne</b><span>Alle Leisten stehen auf ihrem Startwert. Spätere Maps übernehmen Leisten, Entscheidungen, Beute und Sporenpunkte von selbst.</span></div>`;
    if (!u) return `<div class="sp-uebernahme offen"><b>Nichts übernommen</b><span>Kein Spielstand aus Map ${map.map - 1} gefunden: Leisten auf Startwerten, Entscheidungen der letzten Map fehlen.</span></div>`;
    return `<div class="sp-uebernahme"><b>✓ Automatisch übernommen aus „${esc(u.name || `Map ${u.map}`)}“${u.fertig ? "" : " (nicht abgeschlossen)"}</b><span>${esc(uebernahmeText(u) || "Keine Kampagnen-Werte.")}</span></div>`;
  }
  function verhaltenTabelle() {
    const art = motor.wuetend(stand) ? "wuetend" : "ruhig";
    const zeilen = (map.verhalten || {})[art] || [];
    return `<table class="sz-tab sp-verh"><thead><tr><th>W6</th><th>Gegner ${art === "wuetend" ? "wütend" : "ruhig"}</th></tr></thead><tbody>${zeilen.map(([w, t]) => `<tr><td>${esc(w)}</td><td>${esc(t)}</td></tr>`).join("")}</tbody></table>${gm(map.verhalten && map.verhalten.notiz)}`;
  }
  function audioListe() {
    return `<h4>Audio-Dateien prüfen <small>(hier nur nachsehen, ob alles da ist; abgespielt wird jeder Cue an seiner Stelle)</small></h4><div class="sp-audioliste">${Object.keys(map.audio).map(c => cueKnopf(c, false)).join("")}</div>`;
  }
  // Was gerade passiert ist: Ereignisse, Proben, Schwellen, gefallene Gegner, Rundenwurf
  function letzteEreignisse() {
    if (!stand.letzte || !stand.letzte.length) return "";
    const eintrag = (e, i) => {
      const p = e.probe, def = map.ereignisse[e.id] || {};
      const probeHtml = !p ? "" : p.wurf
        ? `<p class="sp-wurf">🎲 Wurf <b>${p.wurf}</b>${p.stufen.length ? "" : " · nichts weiter"}</p>${p.stufen.map(st => `${vorlesen(st.vorlesen, stufeName(st))}${gm(st.gmNotiz)}`).join("")}`
        : `<div class="sp-probe"><p>🎲 ${esc(p.frage)}</p><div>${[1, 2, 3, 4, 5, 6].map(w => `<button type="button" class="btn sm" data-probe="${i}" data-w="${w}">${w}</button>`).join("")}
            <button type="button" class="btn ghost sm" data-probe="${i}" data-w="0">App würfelt</button></div>
            <small>${esc(((def.probe || {}).stufen || []).map(st => stufeName(st)).join(" · "))} · Tasten 1–6</small></div>`;
      return `<div class="sp-ev ${e.art ? `art-${e.art}` : ""}"><h4>${esc(e.name)}</h4>${vorlesen(e.vorlesen)}${gm(e.gmNotiz)}${probeHtml}
        ${e.beutewurf ? `<p class="sp-beutezeile">${wuerfe[i] ? `Beutewurf: ${beuteHtml(wuerfe[i])}` : `<button type="button" class="btn ghost sm" data-wurf="${i}">Beutewurf W6</button>`}</p>` : ""}
        ${(e.beute || []).map(b => { const wer = Object.entries(stand.inventar || {}).find(([, l]) => (l || []).includes(b)); return wer ? `<p class="sp-beutezeile"><b>${esc(b)}</b> ✓ bei ${esc(wer[0])}</p>` : `<p class="sp-beutezeile"><b>${esc(b)}</b> <span class="sp-beute"><span>Geben an: ${helden.map(h => `<button type="button" class="btn ghost sm" data-sp="geben" data-held="${esc(h.name)}" data-sache="${esc(b)}">${esc(h.name)}</button>`).join("")}</span></span></p>`; }).join("")}</div>`;
    };
    // Neueste zuerst; eine offene Probe bleibt immer oben offen, ältere klappen zu einer Zeile zusammen
    const alle = stand.letzte.map((e, i) => [e, i]).reverse();
    const offen = alle.filter(([e], n) => n < 2 || (e.probe && !e.probe.wurf)), alt = alle.filter(x => !offen.includes(x));
    return `<div class="sp-letzte"><h4>Gerade passiert</h4>${offen.map(([e, i]) => eintrag(e, i)).join("")}
      ${alt.length ? `<details class="sp-frueher"><summary>+${alt.length} frühere</summary>${alt.map(([e, i]) => eintrag(e, i)).join("")}</details>` : ""}</div>`;
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
  const markerVerdeckt = (m, aufgedeckt) => !!m.geheim && !aufgedeckt.includes(m.label) && !aufgedeckt.includes(`${m.typ}:${m.label}`);
  // Was Chris zu einem Marker wissen muss: liegt er offen, wofür steht er
  const markerInfo = m => { const info = (map.tischplan || {}).info || {}; return info[`${m.typ}:${m.label}`] || info[m.label] || ""; };
  function sichtbarHtml(m) {
    if (!m) return "";
    if (!m.geheim) return `<p class="sp-sicht offen">👁 Liegt offen: die Spieler sehen ihn von Anfang an.</p>`;
    return markerVerdeckt(m, motor.aufgedeckt(stand)) ? `<p class="sp-sicht zu">🔒 Verdeckt: nicht hinlegen, nur du weißt davon. Die App deckt ihn auf, sobald er gefunden ist.</p>`
      : `<p class="sp-sicht offen">👁 Aufgedeckt: jetzt auf den Tisch legen.</p>`;
  }
  const amMarker = (e, m) => e.marker && (e.marker === m.label || e.marker === `${m.typ}:${m.label}`);
  const markerEreignis = m => Object.entries(map.ereignisse || {}).find(([, e]) => amMarker(e, m));
  // Alles, was an diesem Marker geht, genau wie in der Leiste unten: nur was der Schritt anbietet, gesperrt, was noch nicht geht
  function markerKnoepfe(m) {
    const s = motor.schritt(stand), imSchritt = new Set(s && s.ereignisse || []);
    const ids = Object.entries(map.ereignisse || {}).filter(([id, e]) => amMarker(e, m) && !e.intern && imSchritt.has(id)).map(([id]) => id)
      .filter(id => stand.ereignisse[id] || motor.ereignisErlaubt(stand, id));
    if (!ids.length) return `<p class="hint">In diesem Schritt gibt es hier nichts zu tun.</p>`;
    return `<div class="sp-markeraktionen">${ids.map(id => { const e = map.ereignisse[id], ok = motor.ereignisErlaubt(stand, id), schon = stand.ereignisse[id];
      return `<div><button type="button" class="btn sm ${ok ? "" : "ghost"}" data-ev="${esc(id)}" ${ok ? "" : "disabled"}>${taste(e.taste)} ${esc(kurzName(e))}${schon ? " ✓" : ""}</button>
        ${e.kosten ? `<small>${esc(e.kosten)}</small>` : ""}${e.probe && !schon ? `<small>Mit Probe: ${esc((e.probe.stufen || []).map(st => stufeName(st)).join(" · "))}</small>` : ""}</div>`; }).join("")}</div>`;
  }
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
    // Jeder Marker ist anklickbar. Mit Ereignis (Suchmarker, Türen …): Ring zeigt „schon untersucht“.
    // Verdeckte Marker sieht nur Chris: gestrichelt mit Schloss, bis sie im Spiel aufgedeckt sind
    for (const m of karte.marker) {
      if (m.typ === "ausgang") continue;
      const ev = markerEreignis(m), verdeckt = markerVerdeckt(m, aufgedeckt), tok = ev ? `m:${ev[0]}` : `z:${m.typ}:${m.label || ""}`;
      if (verdeckt) {
        teile.push(`<g class="sp-tok marker verdeckt" data-tok="${esc(tok)}"><title>verdeckt: nur du siehst ihn</title><circle cx="${m.x}" cy="${m.y}" r="1.1" fill="#ffffff12" stroke="#9aa0a8" stroke-width=".15" stroke-dasharray=".35 .25"/><text x="${m.x}" y="${m.y + .45}" font-size="1.1" text-anchor="middle">🔒</text></g>`);
        continue;
      }
      if (!ev) { teile.push(`<g class="sp-tok marker" data-tok="${esc(tok)}"><circle cx="${m.x}" cy="${m.y}" r="${m.typ === "zone" ? (m.radius || 4) : 1.4}" fill="transparent"/></g>`); continue; }
      const fertig = stand.ereignisse[ev[0]];
      teile.push(`<g class="sp-tok marker" data-tok="${esc(tok)}"><circle cx="${m.x}" cy="${m.y}" r="1.55" fill="transparent" stroke="${fertig ? "#7fd06a" : "#f2cf4a"}" stroke-width=".22" ${fertig ? "" : `stroke-dasharray=".5 .3"`}/>${fertig ? `<text x="${m.x + 1.3}" y="${m.y - .9}" font-size="1.3" fill="#7fd06a" font-weight="800">✓</text>` : ""}</g>`);
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
        if (p) teile.push(token(`g:${g.uid}`, p.x, p.y, z.id === "gefallen" ? FARBE.tot : motor.istFreund(g.id) ? FARBE.freund : FARBE.gegner, gegnerKuerzel(g), `${motor.anzeigeName(g)}${motor.istFreund(g.id) ? " (verbündet)" : ""} · ${z.id}`, z.id === "gefallen" ? "tot" : ""));
      }
    }
    const inhalt = svg.replace(/^<svg class="sz-karte"/, `<svg class="sp-svg" data-b="${karte.b}" data-t="${karte.t}"`).replace("</svg>", `${teile.join("")}</svg>`);
    // Heldenchips: Name und Beute auf einen Blick, Klick öffnet Infos und Inventar
    const chips = opt.gross ? "" : `<div class="sp-helden">${helden.map(h => {
      const n = ((stand.inventar || {})[h.name] || []).length, sp = (stand.sporen || {})[h.name] || 0, b = motor.befall(sp), dran = (stand.aktiviert || {})[`held:${h.name}`];
      return `<span class="sp-heldchip ${popup && popup.tok === `held:${h.name}` ? "an" : ""} ${dran ? "dran" : ""} ${b.stufe ? "befallen" : ""}">
        <button type="button" data-chip="held:${esc(h.name)}" title="${esc(h.name)}${b.stufe ? `: ${b.stufe}, ${b.wuerfel} Aktionswürfel` : ""}">${esc(h.name)}${sp ? ` <i>🍄${sp}</i>` : ""}${n ? ` <i>🎒${n}</i>` : ""}${motor.heldenInfo(stand, h.name).length ? ` <i title="${esc(motor.heldenInfo(stand, h.name).map(x => x.name).join(", "))}">📿</i>` : ""}</button>
        ${stand.rundenAktiv ? `<button type="button" class="sp-hak" data-akt="held:${esc(h.name)}" title="War diese Runde dran">${dran ? "✓" : "○"}</button>` : ""}</span>`; }).join("")}</div>`;
    const unter = opt.gross ? "Raster: eine Kartenlänge (15 cm). Gelände frei hinstellen, Marker und Zonen genau dort. Marker anklicken: wofür sie stehen." : "Raster: eine Kartenlänge · Figuren und Marker anklicken für Infos, Figuren ziehen zum Verschieben";
    return `<div class="sp-tischkarte ${opt.gross ? "gross" : ""}">${inhalt}<small>${unter}${opt.gross ? " · Symbole: game-icons.net (CC BY 3.0)" : ""}</small>${chips}${!opt.gross ? werIstWer() : ""}${popupHtml()}</div>`;
  }
  // Wer ist wer am Tisch: je Gegnerart die Kürzel und ein kleines Kartenbild (Klick: große Karte), dazu NPC-Figuren
  const miniKarten = {};
  function miniKarte(id) {
    if (miniKarten[id] === undefined) {
      const w = werteFuer(map.gegner[id]);
      miniKarten[id] = w && w.quality ? KS.renderCard(w, stufeFuer(w), {}) : "";
    }
    return miniKarten[id];
  }
  function werIstWer() {
    const arten = new Map();
    for (const g of stand.gegner.filter(x => !x.weg)) { if (!arten.has(g.id)) arten.set(g.id, []); arten.get(g.id).push(g); }
    const figuren = motor.figurenAmTisch(stand);
    if (!arten.size && !figuren.length) return "";
    const eintraege = [...arten.entries()].map(([id, liste]) => {
      const def = map.gegner[id] || {}, offen = liste.filter(g => motor.zustand(g).id !== "gefallen");
      return `<button type="button" class="sp-wer ${motor.istFreund(id) ? "freund" : ""}" data-karte-art="${esc(id)}" title="Klick: Karte groß zeigen"><span class="cw sp-mini">${miniKarte(id)}</span>
        <span><b>${esc(def.name || id)}</b><small>${liste.map(g => `<i class="${motor.zustand(g).id === "gefallen" ? "tot" : ""}">${esc(gegnerKuerzel(g))}</i>`).join("")}</small><em>${offen.length} von ${liste.length} stehen</em></span></button>`;
    });
    for (const f of figuren) eintraege.push(`<button type="button" class="sp-wer figur" data-chip="f:${esc(f.id)}"><span class="sp-mini leer">${esc(f.tisch.zeichen || f.name[0])}</span><span><b>${esc(f.name)}</b><em>NPC</em></span></button>`);
    return `<div class="sp-werliste">${eintraege.join("")}</div>`;
  }
  // Infokarte zu einer angeklickten Figur oder einem Marker
  function popupHtml() {
    if (!popup) return "";
    const [art, ...rest] = popup.tok.split(":"), id = rest.join(":");
    let kopf = "", inhalt = "";
    if (art === "held") {
      const h = helden.find(x => x.name === id);
      const sp = (stand.sporen || {})[id] || 0, b = motor.befall(sp);
      kopf = `<b>${esc(id)}</b><small>Held${b.stufe ? ` · ${b.stufe}` : ""}</small>`;
      inhalt = `<p>${esc((h && h.info) || "")}</p>
        <h5>Sporenpunkte</h5><p class="sp-sporen"><button type="button" class="btn ghost sm" data-sporen="${esc(id)}" data-d="-1">−</button><b>${sp}</b><button type="button" class="btn ghost sm" data-sporen="${esc(id)}" data-d="1">+</button>
          <small>${b.stufe ? esc(b.stufe) : "ab 1 gezeichnet, ab 3 befallen, ab 5 schwer befallen"}</small></p>
        ${sp ? `<div class="sp-befall"><h5>Wenn jemand hinsieht</h5>${sag(b.aussehen)}<p><b>Wie es sich anfühlt:</b> ${esc(b.koerper)}</p><p><b>Regel:</b> ${esc(b.regel)}</p></div>` : ""}
        ${motor.heldenInfo(stand, id).map(x => `<h5>${esc(x.name)}</h5><p>${esc(x.text)}</p>${gm(x.gm)}${x.weitergeben
          ? `<p class="sp-weiter">Weitergeben an: ${helden.filter(h => h.name !== id).map(h => `<button type="button" class="btn ghost sm" data-merkmal="${esc(x.flag)}" data-an="${esc(h.name)}">${esc(h.name)}</button>`).join("")}</p>${x.weitergebenInfo ? gm(x.weitergebenInfo) : ""}`
          : gm(x.nichtWeiter || "Kann nicht weitergegeben werden.")}`).join("")}
        <h5>Beute</h5>${inventarHtml(id)}`;
    } else if (art === "f") {
      const f = map.figuren[id] || {};
      kopf = `<b>${esc(f.name || id)}</b><small>NPC</small>`;
      inhalt = `<p>${esc(f.wer || "")}</p>${f.ziel ? `<p><b>Will gerade:</b> ${esc(f.ziel)}</p>` : ""}<span class="sp-g-knoepfe"><button type="button" class="btn ghost sm" data-sp="npc-von" data-figur="${esc(id)}">NPC-Karte ${taste("N")}</button><button type="button" class="btn sm" data-npc-kampf="${esc(id)}" title="Wird angegriffen oder greift an: wird zum Gegner">⚔ kämpft</button></span>`;
    } else if (art === "g") {
      const g = stand.gegner.find(x => x.uid === id);
      if (!g) return "";
      const def = map.gegner[g.id] || {}, z = motor.zustand(g);
      kopf = `<b>${esc(gegnerKuerzel(g))} · ${esc(def.name || g.id)}</b><small>${esc(z.id)}${g.zone ? ` · Zone ${esc(g.zone)}` : ""}</small>`;
      inhalt = `${def.info ? `<p>${esc(def.info)}</p>` : ""}${sag(z.satz)}${def.anblick ? `<h5>Wenn sie genauer hinsehen</h5>${sag(def.anblick)}` : ""}${motor.zusaetze(stand, def).map(x => gm(x.text)).join("")}
        <div class="sp-g-knoepfe" data-gegner="${esc(g.uid)}"><button type="button" class="btn sm" data-dmg="1">+1</button><button type="button" class="btn sm" data-dmg="2">+2</button><button type="button" class="btn ghost sm" data-dmg="-1">−1</button><button type="button" class="btn ghost sm" data-karte="1">Karte</button></div>`;
    } else if (art === "m") {
      const e = map.ereignisse[id] || {}, schon = stand.ereignisse[id];
      const mk = karte.marker.find(x => amMarker(e, x));
      const [, , typName] = (window.KartenschmiedeSzenarien.MARKER || {})[mk ? mk.typ : ""] || ["", "", ""];
      kopf = `<b>${esc(typName || e.name || id)}${mk && mk.label && mk.label.length <= 2 ? ` ${esc(mk.label)}` : ""}</b><small>${schon ? "✓ schon untersucht" : "noch nicht untersucht"}</small>`;
      inhalt = `${e.wofuer ? `<p class="sp-wofuer">${esc(e.wofuer)}</p>` : ""}${mk ? gm(markerInfo(mk)) : ""}${sichtbarHtml(mk)}${mk ? markerKnoepfe(mk) : ""}`;
    } else if (art === "z") {
      const [typ, ...l] = id.split(":"), label = l.join(":");
      const mk = karte.marker.find(x => x.typ === typ && (x.label || "") === label);
      const [, , name] = (window.KartenschmiedeSzenarien.MARKER || {})[typ] || ["", "", typ];
      kopf = `<b>${esc(name)}${label && label.length <= 2 ? ` ${esc(label)}` : ""}</b><small>Marker</small>`;
      inhalt = `${mk ? gm(markerInfo(mk)) : ""}${sichtbarHtml(mk)}`;
    }
    return `<div class="sp-pop" style="left:${popup.x}%;top:${popup.y}%"><header>${kopf}<button type="button" class="btn ghost sm" data-sp="popzu" aria-label="Schließen">✕</button></header>${inhalt}</div>`;
  }

  // ---------- Gegnerliste ----------
  // Verhaltenswürfe dieser Runde (nur Anzeige) und zuletzt gezeigte Zustände: Ein neuer Zustand leuchtet einmal auf
  const verhWurf = {}, letzterZustand = {};
  function neuerZustand(g, id) { const alt = letzterZustand[g.uid]; letzterZustand[g.uid] = id; return alt !== undefined && alt !== id; }
  function gegnerListe() {
    const alle = stand.gegner.filter(g => !g.weg), feinde = alle.filter(g => !motor.istFreund(g.id)), freunde = alle.filter(g => motor.istFreund(g.id));
    if (!alle.length) return `<p class="hint">Noch keine Gegner am Tisch.</p>`;
    return `${feinde.length ? feinde.map(gegnerZeile).join("") : `<p class="hint">Keine Gegner am Tisch.</p>`}
      ${freunde.length ? `<h4 class="sp-freunde-titel">Verbündete <small>(führen die Spieler oder du)</small></h4>${freunde.map(gegnerZeile).join("")}` : ""}`;
  }
  function gegnerZeile(g) {
    {
      const def = map.gegner[g.id] || {}, z = motor.zustand(g), b = motor.bedrohung(def, motor.effektiveWerte(stand, g)), offen = markiert === `g:${g.uid}`;
      const mods = motor.modText(stand, g);
      const zusatz = motor.zusaetze(stand, def);
      return `<div class="sp-gegner ${offen ? "markiert" : ""} ${z.id === "gefallen" ? "gefallen" : ""} ${motor.istFreund(g.id) ? "freund" : ""}" data-gegner="${esc(g.uid)}">
        <div class="sp-g-zeile">${stand.rundenAktiv && z.id !== "gefallen" ? `<button type="button" class="sp-hak" data-akt="g:${esc(g.uid)}" title="War diese Runde dran">${(stand.aktiviert || {})[`g:${g.uid}`] ? "✓" : "○"}</button>` : ""}<span class="sp-g-tok">${esc(gegnerKuerzel(g))}</span><b>${esc(def.name || g.id)}</b><span class="sp-schaedel" title="Bedrohung">${"☠".repeat(b.schaedel)}</span>
          <span class="sp-g-balken">${Array.from({ length: g.zaeh }, (_, i) => `<i class="${i < g.wunden ? "wunde" : ""}"></i>`).join("")}</span>
          <span class="sp-g-knoepfe">${z.id === "gefallen" ? `<button type="button" class="btn ghost sm" data-weg="1">vom Tisch</button>` : `<button type="button" class="btn sm" data-dmg="1">+1</button><button type="button" class="btn sm" data-dmg="2">+2</button>`}<button type="button" class="btn ghost sm" data-dmg="-1">−1</button></span></div>
        <div class="sp-g-zustand ${neuerZustand(g, z.id) ? "neu" : ""}"><em class="z-${esc(z.id.replace(/\s+/g, "-"))}">${esc(z.id)}</em> ${sag(z.satz)}</div>
        ${stand.rundenAktiv && z.id !== "gefallen" ? `<p class="sp-verhwurf">${verhWurf[g.uid] ? `🎲 <b>${verhWurf[g.uid].wurf}</b> ${esc(verhWurf[g.uid].text)} <small>(${verhWurf[g.uid].art === "wuetend" ? "wütend" : "ruhig"})</small>` : `<button type="button" class="btn ghost sm" data-verh="${esc(g.uid)}" title="Verhaltenswurf für diesen Gegner (setzt den Haken)">🎲 Verhalten</button>`}</p>` : ""}
        ${mods.length ? `<p class="sp-mods">${mods.map(m => `<i class="${m.staerker ? "plus" : "minus"}">${esc(m.text)}</i>`).join("")}</p>` : ""}
        ${offen ? `<div class="sp-g-mehr">${def.anblick ? `<h5>Wenn sie genauer hinsehen</h5>${sag(def.anblick)}` : ""}${zusatz.length ? `<h5>Gilt gerade</h5>${zusatz.map(x => `${gm(x.text)}${x.ansage ? sag(x.ansage) : ""}`).join("")}` : ""}
          <p class="hint">${g.wunden}/${g.zaeh} Wunden${g.zone ? ` · Zone ${esc(g.zone)}` : ""}</p><button type="button" class="btn ghost sm" data-karte="1">Karte zeigen</button>
          ${anpassenHtml(g)}</div>` : ""}
      </div>`;
    }
  }
  // Von Hand stärken oder schwächen: wirkt sofort auf Karte, Bedrohung und (bei Zäh) die Wundleiste
  const ANPASSEN = [["quality", "Qualität"], ["defense", "Verteidigung"], ["tough", "Zäh"], ["attacks", "Angriffe"]];
  function anpassenHtml(g) {
    const name = (map.gegner[g.id] || {}).name || g.id;
    return `<details class="sp-anpassen"><summary>Anpassen: stärker oder schwächer</summary>
      <div class="sp-anpassen-raster">${ANPASSEN.map(([k, n]) => `<span>${n}</span><button type="button" class="btn ghost sm" data-mod="${k}" data-d="1" title="${n} stärker">+</button><button type="button" class="btn ghost sm" data-mod="${k}" data-d="-1" title="${n} schwächer">−</button>`).join("")}</div>
      <div class="sp-anpassen-regel"><input type="text" id="spRegel-${esc(g.uid)}" placeholder="Regel dazu, z. B. Brennt"><button type="button" class="btn ghost sm" data-mod="passives">+ Regel</button></div>
      <label class="sp-alle"><input type="checkbox" id="spAlle-${esc(g.uid)}"> für alle „${esc(name)}“, auch später erscheinende</label></details>`;
  }

  // Sonderregeln, die eine frühere Entscheidung freigeschaltet hat, gehören immer in den Blick
  function aktiveRegeln() {
    const bedingt = ((map.lage || {}).sonderregeln || []).filter(r => r.wenn && motor.gilt(stand, r.wenn));
    if (!bedingt.length) return "";
    return `<details class="sp-aktiv" open><summary>Gilt jetzt · ${bedingt.length}</summary>${bedingt.map(r => `<p title="${esc(r.text || "")}"><b>${esc(r.titel || "")}</b> ${esc(r.text || "")}</p>`).join("")}</details>`;
  }

  // Jeder aktive Zähler mit Wert, was er bedeutet und welche Schwellen schon ausgelöst haben
  function zaehlerHtml() {
    const aktiv = Object.entries(map.leisten || {}).filter(([k]) => stand.leisten[k] && stand.leisten[k].aktiv);
    if (!aktiv.length) return `<p class="hint">Keine.</p>`;
    return aktiv.map(([k, def]) => {
      const w = stand.leisten[k].wert;
      const sw = (def.schwellen || []).map(x => `<li class="${stand.schwellen[`${k}:${x.ab}`] ? "ja" : ""}">${stand.schwellen[`${k}:${x.ab}`] ? "✓" : "○"} ab ${x.ab}: ${esc(x.titel || "")}</li>`).join("");
      return `<div class="sp-regel"><b>${esc(def.name)}: ${w}</b> <small>(${def.min}–${def.max})</small> ${esc(def.text || "")}${sw ? `<ul class="sp-schwellen">${sw}</ul>` : ""}</div>`;
    }).join("");
  }

  // ---------- NPC-Schublade ----------
  // Schiebt sich über die Schrittkarte; Tischkarte, Gegner und Aktionsleiste bleiben bedienbar.
  // Die Fragen an den NPC stehen hier als Knöpfe (mit Tasten), die letzte Antwort direkt darüber.
  function schubladeHtml() {
    if (!fenster || !fenster.startsWith("npc")) return "";
    const id = fenster.startsWith("npc:") ? fenster.slice(4) : ([...stand.verlauf].reverse().map(x => map.schritte[x]).find(x => x && x.typ === "npc") || {}).figur;
    const f = id && map.figuren[id];
    if (!f) return "";
    const s = motor.schritt(stand);
    const alleFragen = (s.ereignisse || []).filter(e => map.ereignisse[e] && !map.ereignisse[e].intern && gruppeVon(map.ereignisse[e]) === "Fragen");
    // Alle Fragen zeigen (gesperrte ausgegraut); teilen sich zwei die Taste (lang/knapp), nur die gerade passende
    const zaehlt = e => motor.ereignisErlaubt(stand, e) || stand.ereignisse[e];
    const fragen = alleFragen.filter(e => {
      const gleich = alleFragen.filter(x => map.ereignisse[x].taste && map.ereignisse[x].taste === map.ereignisse[e].taste);
      return gleich.length < 2 || zaehlt(e) || (!gleich.some(zaehlt) && gleich[0] === e);
    });
    const antwort = [...(stand.letzte || [])].reverse().find(e => fragen.includes(e.id));
    const stimme = Array.isArray(f.stimme) ? f.stimme : String(f.stimme || "").split(/;\s*|\.\s+(?=[A-ZÄÖÜ„])/).filter(Boolean);
    const geduld = stand.leisten.geduld && stand.leisten.geduld.aktiv ? stand.leisten.geduld.wert : null;
    return `<aside class="sp-schublade" role="dialog" aria-label="${esc(f.name)}">
      <header><h3>${esc(f.name)}</h3>${geduld !== null ? `<span class="sp-pill"><b>Geduld</b> <em>${geduld}</em></span>` : ""}${!stand.npcKampf[id] ? `<button type="button" class="btn ghost sm" data-npc-kampf="${esc(id)}" title="Wird angegriffen oder greift an: wird zum Gegner">⚔ kämpft</button>` : ""}<button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
      <div class="sp-npc-oben">
        <div class="sp-npc-steckbrief"><h4>So spricht ${f.anzeige === "er" ? "er" : "sie"}</h4>${liste(stimme.map(x => x.replace(/\.$/, "")))}
          ${f.ziel ? `<p class="sp-will"><b>Will jetzt:</b> ${esc(f.ziel)}</p>` : ""}${f.motiv ? `<p class="sp-will"><b>Motiv:</b> ${esc(f.motiv)}</p>` : ""}</div>
        <div class="sp-npc-kern"><h4>🗣️ Sätze, die immer kommen</h4>${(f.kern || []).map(k => vorlesen(k)).join("")}</div>
      </div>
      <div class="sp-npc-unten">
        <section><h4>Was ${f.anzeige === "er" ? "er" : "sie"} weiß · herauskitzeln</h4>
          ${antwort ? `<div class="sp-antwort"><small>Antwort auf: ${esc(antwort.name)}</small>${vorlesen(antwort.vorlesen)}${gm(antwort.gmNotiz)}</div>` : ""}
          ${fragen.length ? `<div class="sp-fragen-knoepfe">${fragen.map(e => { const ev = map.ereignisse[e], ok = motor.ereignisErlaubt(stand, e), schon = stand.ereignisse[e];
            return `<button type="button" class="btn ghost sm ${schon ? "erledigt" : ""}" data-ev="${esc(e)}" ${ok ? "" : "disabled"} title="${esc(ev.name)}">${taste(ev.taste)} ${esc(kurzName(ev))}${schon ? " ✓" : ""}</button>`; }).join("")}</div>` : ""}
          ${(f.weiss || []).length ? wissenHtml(id, f) : ""}</section>
        <section>${f.wennSieFragen ? `<h4>Wenn sie fragen …</h4><div class="sp-fragen">${f.wennSieFragen.map(([a, b]) => `<p><small>… ${esc(a)}</small>${esc(b)}</p>`).join("")}</div>` : ""}
          <h4>Was ${f.anzeige === "er" ? "er" : "sie"} nicht weiß</h4>${liste(f.nichtWissen, "sp-nicht")}
          ${f.wer ? `<details class="sp-mehr"><summary>Wer ${f.anzeige === "er" ? "er" : "sie"} ist</summary><p>${esc(f.wer)}</p></details>` : ""}</section>
      </div>
    </aside>`;
  }

  // Herausgekitzelt: abhaken, was die Helden erfahren haben. Hat ein Eintrag eine Folge, tritt sie später von selbst ein
  function wissenHtml(id, f) {
    const an = motor.wissen(stand, id);
    return `<div class="sp-wissen">${f.weiss.map((w, i) => `<label class="${an[i] ? "an" : ""}"><input type="checkbox" data-wissen="${esc(id)}" data-i="${i}" ${an[i] ? "checked" : ""}>
      <span>${w.kurz ? `<b>${esc(w.kurz)}</b>` : ""}${vorlesen(w.info)}${w.wie ? `<small>Wie: ${esc(w.wie)}</small>` : ""}${w.folge ? `<em>${an[i] ? "✓ Wirkt: " : "Folge: "}${esc(w.folge)}</em>` : ""}</span></label>`).join("")}</div>`;
  }

  // ---------- Fenster ----------
  function fensterHtml() {
    if (fenster === "eingabe" && eingabeFuer) {
      const e = eingabeFuer.eingabe;
      const auswahl = e.aus === "offene-marker" ? motor.offeneMarker(stand).map(id => [id, map.ereignisse[id].name]) : helden.map(h => [h.name, h.name]);
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen klein">
        <header><h3>${esc(e.frage)}</h3><button type="button" class="btn ghost sm" data-sp="zu">Abbrechen</button></header>
        <div class="sp-optionen">${auswahl.map(([w, n], i) => `<button type="button" class="sp-option" data-eingabe="${esc(w)}"><kbd>${i + 1}</kbd><span><b>${esc(n)}</b></span></button>`).join("")}</div>
        ${e.aus === "gruppe" ? `<label class="f">Oder Name eintippen <input type="text" id="spEingabeFrei" placeholder="Name des Helden"></label><button type="button" class="btn sm" data-sp="eingabe-frei">Übernehmen</button>` : ""}
      </div></div>`;
    }
    if (fenster === "gegner-neu") {
      const ausMap = Object.entries(map.gegner || {}).filter(([id]) => !id.startsWith("npc-"));
      const npcs = Object.entries(map.figuren || {}).filter(([id]) => !stand.npcKampf[id]);
      const vorlagen = KS.VORLAGEN.filter(v => v.d.role === "enemy");
      const zonen = Object.keys((map.tischplan || {}).zonen || {});
      return `<div class="sp-fenster" role="dialog" aria-label="Gegner dazuholen"><div class="sp-fenster-innen">
        <header><h3>Gegner dazuholen</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <p class="hint">Für alles, was nicht im Skript steht: ein NPC wird angegriffen, eine Gestalt steht doch auf, du willst nachlegen. Die Figur erscheint auf der Tischkarte und in der Gegnerliste.</p>
        <div class="row4"><label class="f">Anzahl <input type="number" id="spNeuAnzahl" min="1" max="12" value="1"></label>
          <label class="f">Zone <select id="spNeuZone"><option value="">Tischmitte</option>${zonen.map(z => `<option>${esc(z)}</option>`).join("")}</select></label></div>
        <h4>NPC kämpft</h4><div class="sp-neu-liste">${npcs.map(([id, f]) => `<button type="button" class="btn sm" data-npc-kampf="${esc(id)}" title="${f.kampf ? "Haupt-NPC mit eigenen Kampfwerten" : "Ohne eigene Werte: schwache Grundwerte"}">⚔ ${esc(f.name)}${f.kampf ? "" : " (schwach)"}</button>`).join("")}
          <button type="button" class="btn ghost sm" data-sp="npc-namenlos" title="Passant, Gehilfe, Dorfbewohner: Qualität 6+, Verteidigung 6+, Zäh 1">⚔ Namenloser NPC</button></div>
        <h4>Aus dieser Map</h4><div class="sp-neu-liste">${ausMap.map(([id, d]) => `<button type="button" class="btn ghost sm" data-neu="${esc(id)}">${esc(d.name || id)}</button>`).join("")}</div>
        <h4>Aus den Vorlagen</h4><div class="sp-neu-liste">${vorlagen.map(v => `<button type="button" class="btn ghost sm" data-vorlage="${esc(v.key)}">${esc(v.d.name)}</button>`).join("")}</div>
      </div></div>`;
    }
    if (fenster === "log") {
      const ICON = { wahl: "🟥", ereignis: "⚡", probe: "🎲", runde: "⟳", rundenwurf: "🎲", schritt: "→", tod: "☠", beute: "🎁" };
      const eintraege = (stand.log || []).slice().reverse();
      const chips = e => [...e.leisten.map(l => `<span class="sp-chip ${l.neu > l.alt ? "hoch" : "runter"}">${esc(l.name)} ${l.alt} → ${l.neu}</span>`),
        ...e.flags.map(f => `<span class="sp-chip flag ${f.spaeter ? "spaeter" : ""}" title="${esc(f.id)}">${f.spaeter ? `<i>→ Map ${f.spaeter}</i> ` : ""}${esc(f.text)}${f.wert ? `: ${esc(f.wert)}` : ""}</span>`)].join("");
      return `<div class="sp-fenster" role="dialog" aria-label="Log"><div class="sp-fenster-innen breit">
        <header><h3>Log · Entscheidungen und Leisten</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <p class="hint">Nur für dich. Neueste oben. Gezeigt wird alles, was eine Leiste oder eine Entscheidung verändert hat, dazu jede Antwortwahl. Mit „→ Map“ markiert ist, was in einer späteren Map nachwirkt.</p>
        ${eintraege.length ? `<ol class="sp-log">${eintraege.map(e => `<li class="art-${esc(e.art)}"><span class="sp-log-r">R${e.runde}</span><span class="sp-log-i">${ICON[e.art] || "•"}</span><div><b>${esc(e.text)}</b><small>${esc((map.schritte[e.schritt] || {}).titel || "")}</small>${chips(e) ? `<div class="sp-chips">${chips(e)}</div>` : ""}</div></li>`).join("")}</ol>` : `<p class="hint">Noch nichts passiert.</p>`}
      </div></div>`;
    }
    if (fenster === "lage") {
      const l = motor.lage(stand), rw = map.rundenwurf;
      return `<div class="sp-fenster" role="dialog" aria-label="Lage"><div class="sp-fenster-innen breit">
        <header><h3>Lage</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        <div class="sp-lage">
          <section>${motor.auftraege(stand).length ? `<h4>Aufträge der Spieler</h4><ul class="sp-ziele">${motor.auftraege(stand).map(a => `<li class="${a.erledigtJetzt ? "ja" : ""}">${a.erledigtJetzt ? "✓" : "○"} <b>${esc(a.titel)}</b> „${esc(a.spieler || "")}“ <small>· ${esc(a.quelle || "")}</small></li>`).join("")}</ul>` : ""}
            <h4>Ziele</h4>${l.ziele.length ? `<ul class="sp-ziele">${l.ziele.map(z => `<li class="${z.ist ? "ja" : ""}">${z.ist ? "✓" : "○"} <b>${esc(z.art || "")}</b> ${esc(z.text)}</li>`).join("")}</ul>` : `<p class="hint">Keine Ziele hinterlegt.</p>`}
            <h4>Flucht</h4>${l.flucht ? `<p>${esc(l.flucht.wie || "")}</p>${gm(l.flucht.folge ? `Folge: ${l.flucht.folge}` : "")}` : `<p class="hint">Kein Fluchtweg hinterlegt.</p>`}
            <h4>Messen ohne Zollstock</h4><table class="sz-tab"><tbody>${MESSEN.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></section>
          <section><h4>Schwierigkeit: ${esc(motor.schwierigkeit(stand).name)}</h4><p>Gegnerwelle ${Math.round(motor.schwierigkeit(stand).anteil * 100)} % von ${stand.heldenpunkte || "?"} Heldenpunkten. ${esc(motor.schwierigkeit(stand).text)}</p>
            <h4>Zähler · nur du siehst sie</h4>${zaehlerHtml()}
            <h4>Sporenpunkte: woran man es sieht, was gilt</h4><table class="sz-tab sp-sporentab"><tbody>${motor.SPOREN.filter(x => x.ab > 0).map(x => `<tr><td><b>ab ${x.ab}</b><br><small>${esc(x.stufe)}</small></td><td>${esc(x.aussehen)} <i>${esc(x.koerper)}</i><br><b>${esc(x.regel)}</b></td></tr>`).join("")}</tbody></table>
            <h4>Sonderregeln</h4>${l.sonderregeln.map(r => `<div class="sp-regel"><b>${esc(r.titel || "")}</b> ${esc(r.text || "")}${r.ansage ? sag(r.ansage) : ""}</div>`).join("") || `<p class="hint">Keine.</p>`}
            ${rw ? `<h4>${esc(rw.name)}</h4>${gm(rw.text)}<table class="sz-tab"><tbody>${(rw.tabelle || []).map(z => `<tr><td>${esc((z.w || []).join(", "))}</td><td><b>${esc(z.titel || "")}</b> ${esc(z.gmNotiz || "")}</td></tr>`).join("")}</tbody></table>` : ""}
            <h4>Protokoll</h4><ol class="sp-protokoll">${stand.protokoll.slice(-14).reverse().map(p => `<li><small>R${p.runde}</small> ${esc(p.text)}</li>`).join("")}</ol></section>
        </div></div></div>`;
    }
    if (fenster && fenster.startsWith("karte:")) {
      const g = stand.gegner.find(x => x.uid === fenster.slice(6));
      const werte = g && motor.effektiveWerte(stand, g);
      if (!werte || !werte.quality) return "";
      const def = map.gegner[g.id] || {};
      const mods = motor.modText(stand, g);
      return `<div class="sp-fenster" role="dialog"><div class="sp-fenster-innen karte">
        <header><h3>${esc(werte.name || "")}</h3><button type="button" class="btn ghost sm" data-sp="zu">Schließen ${taste("Esc")}</button></header>
        ${mods.length ? `<p class="sp-mods">Angepasst: ${mods.map(m => `<i class="${m.staerker ? "plus" : "minus"}">${esc(m.text)}</i>`).join("")}</p>` : ""}
        <div class="sp-kartenbox">${KS.renderCard(werte, stufeFuer(werte), {})}</div>${gm(def.notiz)}${motor.zusaetze(stand, def).map(z => gm(z.text)).join("")}
      </div></div>`;
    }
    return "";
  }

  // ---------- Hauptanzeige ----------
  const mitPassiert = (inhalt, passiert) => inhalt.includes("<!--passiert-->") ? inhalt.replace("<!--passiert-->", passiert) : inhalt + passiert;
  // Fuß der Schrittkarte: der letzte Log-Eintrag als Erinnerung, Klick öffnet das Log
  function zuletztHtml() {
    const e = (stand.log || [])[stand.log.length - 1];
    if (!e) return "";
    const was = [...e.leisten.map(l => `${l.name} ${l.alt}→${l.neu}`), ...e.flags.slice(0, 1).map(f => f.text)].join(" · ");
    return `<button type="button" class="sp-zuletzt" data-sp="log" title="Log öffnen (P)"><span>Zuletzt</span> R${e.runde} · ${esc(e.text)}${was ? ` · <em>${esc(was)}</em>` : ""}</button>`;
  }
  // Gegnerpunkte des Kampfs nach OPR: Heldenpunkte × Anteil der Stufe, im Verhältnis dazu, wofür die Map geschrieben ist
  function budgetZeile() {
    const b = motor.budgetVon(stand), st = motor.schwierigkeit(stand);
    if (!b || !stand.heldenpunkte) return "";
    const fest = b.summe > b.ziel * 1.15 ? " Mehr geht nicht weg: Boss und Story-Gegner bleiben immer." : "";
    return `<p class="sp-budget" title="OPR: eine Gegnerwelle hat ${Math.round(st.anteil * 100)} % der Heldenpunkte">⚖ Gegner <b>${b.summe} P.</b> auf dem Tisch · Budget ${b.ziel} P. <small>(${st.name} ${Math.round(st.anteil * 100)} % von ${stand.heldenpunkte} Heldenpunkten; die Map ist für ${b.geschrieben} P. geschrieben)${esc(fest)}</small></p>`;
  }
  function zeige() {
    const main = $("spMain");
    if (!main) return;
    if (!stand) {
      document.body.classList.remove("sp-laeuft");
      main.innerHTML = `<div class="sp-start"><p class="lede">Wähle einen Spielstand oder starte einen neuen Abend.</p>
        <div class="row4"><label class="f">Map <select id="spMapWahl">${MAPS.map(m => `<option value="${m.map}">${esc(m.kampagne)} · Map ${m.map}: ${esc(m.titel)}</option>`).join("")}</select></label>
        <label class="f">Schwierigkeit <select id="spStufe">${Object.entries(SM.SCHWIERIGKEITEN).map(([id, st]) => `<option value="${id}" ${id === letzteStufe() ? "selected" : ""}>${st.stufe} · ${esc(st.name)} (OPR ${esc(st.opr)}, ${Math.round(st.anteil * 100)} %)</option>`).join("")}</select></label>
        <label class="f">Gruppe <select id="spGruppe"><option value="">Ohne Gruppe (Vorlagen-Helden)</option>${(window.__spGruppen || []).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("")}</select></label></div>
        <div class="sp-stufen"><p>Wie in OPR: Jeder Kampf bekommt Gegnerpunkte nach den Heldenpunkten der Gruppe (Gefährten zählen mit) mal dem Anteil der Stufe. Die Gegnerwerte bleiben gleich, es kommen mehr oder weniger Gegner. Die Maps sind für ${SM.REFERENZ.heldenpunkte} Heldenpunkte auf Normal geplant (OPR Fortgeschritten): damit fangt ihr an.</p>
          ${Object.values(SM.SCHWIERIGKEITEN).map(st => `<p><b>${st.stufe} · ${esc(st.name)}</b> <small>(OPR ${esc(st.opr)})</small> Gegnerwelle ${Math.round(st.anteil * 100)} % der Heldenpunkte. ${esc(st.text)}</p>`).join("")}</div>
        <div class="copyrow"><button type="button" class="btn" data-sp="neu">Neuen Abend starten</button></div>
        <p class="hint">Tipp: Im Spiel auf „Vollbild“ (am Mac Ctrl + Cmd + F). Die Seite ist für einen 15-Zoll-Laptop gebaut.</p>
        ${staende.length ? `<h4>Gespeicherte Abende</h4><div class="sp-staende">${staende.map(x => `<button type="button" class="g-item" data-stand="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(x.kampagne)}</small></button>`).join("")}</div>` : ""}
        <p class="hint" id="spMsg" role="status">${esc(meldung)}</p></div>`;
      return;
    }
    document.body.classList.add("sp-laeuft");
    const s = motor.schritt(stand);
    const [zeichen, etikett, farbe] = s.nurErzaehlen ? ["🟪", "DU · Erzählen (nichts aufbauen)", "lila"] : TYP[s.typ] || ["", s.typ, ""];
    const naechster = motor.naechsterId(stand);
    const nachTitel = naechster && map.schritte[naechster] ? map.schritte[naechster].titel : "";
    const scrollAlt = (main.querySelector(".sp-karte") || {}).scrollTop || 0, gleich = main.dataset.schritt === stand.schritt;
    main.dataset.schritt = stand.schritt;
    main.innerHTML = `<div class="sp-app">
      <header class="sp-oben" id="spKopf"></header>
      <div class="sp-mitte ${mitSeite(s) ? "" : "ohne-seite"}">
        <section class="sp-karte typ-${farbe}">
          ${auftragHtml()}
          <header><span class="sp-typ">${zeichen} ${esc(etikett)}</span><h3>${esc(s.titel || "")}</h3></header>
          ${antreiberHtml(antreiberZu === `zeigen:${stand.schritt}`)}
          ${mitPassiert(schrittInhalt(s), letzteEreignisse())}
          <footer>${zuletztHtml()}${s.typ === "wahl" ? "" : !naechster ? `<span class="hint">Ende der Map.</span>`
            : kampfOffen(s) ? `<span class="hint">Der Kampf läuft. Er endet von selbst, wenn das Ziel erreicht ist. Weiter ohne Ziel führt zu: ${esc(nachTitel)}.</span>`
            : `<span class="hint">Als Nächstes: <b>${esc(nachTitel)}</b></span>`}</footer>
        </section>
        ${schubladeHtml()}
        ${!mitSeite(s) ? "" : `<aside class="sp-seite ${s.typ === "kampf" ? "kampf" : ""}">${tischKarte()}${aktiveRegeln()}<div class="sp-gegnerliste"><h4>Gegner <button type="button" class="btn ghost sm" data-sp="gegner-neu" title="Gegner dazuholen (auch einen NPC, der kämpft)">＋ Gegner</button></h4>${gegnerListe()}</div></aside>`}
      </div>
      <footer class="sp-unten">${aktionsLeiste(s)}</footer>
    </div>${fensterHtml()}`;
    zeigeKopf();
    kuerzeLeiste();
    if (gleich) { const k = main.querySelector(".sp-karte"); if (k) k.scrollTop = scrollAlt; }
    const kartenbox = main.querySelector(".sp-kartenbox");
    if (kartenbox) requestAnimationFrame(() => KS.passeAn(kartenbox));
  }

  // Drüberfahren über „Wer ist wer“: die Karte groß neben der Seitenspalte (die Spalte scrollt und schneidet sonst ab)
  function vorschau(e) {
    let el = $("spVorschau");
    const wer = e.target.closest && e.target.closest(".sp-wer[data-karte-art]");
    if (!wer || !stand) { if (el) el.hidden = true; return; }
    const html = miniKarte(wer.dataset.karteArt);
    if (!html) return;
    if (!el) { el = document.createElement("div"); el.id = "spVorschau"; el.className = "cw sp-vorschau"; document.body.appendChild(el); }
    if (el.dataset.art !== wer.dataset.karteArt) { el.innerHTML = html; el.dataset.art = wer.dataset.karteArt; }
    const r = wer.getBoundingClientRect(), b = 240;
    el.style.left = `${Math.max(8, r.left - b - 10)}px`;
    el.style.top = `${Math.max(8, Math.min(window.innerHeight - b * 1.5 - 8, r.top - 40))}px`;
    el.hidden = false;
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
    tab.addEventListener("mouseover", vorschau);
    tab.addEventListener("mouseleave", () => { const el = $("spVorschau"); if (el) el.hidden = true; });
    tab.addEventListener("click", async e => {
      // Eingabefelder (Regel, Häkchen) dürfen den Gegner nicht zuklappen
      if (e.target.closest("input, select, textarea, label")) return;
      const chip = e.target.closest("[data-chip]");
      if (chip) { popup = popup && popup.tok === chip.dataset.chip ? null : { tok: chip.dataset.chip, x: 3, y: 40 }; zeige(); return; }
      const marker = e.target.closest(".sp-tok.marker");
      if (marker) { oeffnePopup(marker.dataset.tok, marker.closest("svg"), e); return; }
      const t = e.target.closest("button, [data-gegner]");
      if (!t) return;
      const g = t.closest("[data-gegner]");
      if (t.dataset.akt) { motor.aktiviere(stand, t.dataset.akt); spaeter(); zeige(); return; }
      if (t.dataset.verh) { verhWurf[t.dataset.verh] = motor.verhaltenWurf(stand); motor.aktiviere(stand, `g:${t.dataset.verh}`, true); spaeter(); zeige(); return; }
      if (t.dataset.sporen) { tue(() => motor.sporen(stand, t.dataset.sporen, +t.dataset.d)); return; }
      if (t.dataset.merkmal) { const an = t.dataset.an; popup = { ...popup, tok: `held:${an}` }; tue(() => motor.reicheMerkmal(stand, t.dataset.merkmal, an)); return; }
      if (t.dataset.mod && g) {
        const uid = g.dataset.gegner, alle = ($(`spAlle-${uid}`) || {}).checked, k = t.dataset.mod;
        const gg = stand.gegner.find(x => x.uid === uid);
        let mod, text;
        if (k === "passives") { const r = (($(`spRegel-${uid}`) || {}).value || "").trim(); if (!r) return; mod = { passives: [r] }; text = `+ ${r}`; }
        else { const d = +t.dataset.d; mod = { [k]: d }; text = `${(ANPASSEN.find(x => x[0] === k) || [])[1]} ${d > 0 ? "stärker" : "schwächer"}`; }
        tue(() => motor.passeGegnerAn(stand, alle ? { typ: gg.id } : { uid }, mod, text));
        return;
      }
      if (t.dataset.dmg && g) { markiert = `g:${g.dataset.gegner}`; tue(() => motor.schaden(stand, g.dataset.gegner, +t.dataset.dmg)); return; }
      if (t.dataset.karte && g) { fenster = `karte:${g.dataset.gegner}`; zeige(); return; }
      if (t.dataset.karteArt) { const g1 = stand.gegner.find(x => x.id === t.dataset.karteArt && !x.weg); if (g1) { fenster = `karte:${g1.uid}`; zeige(); } return; }
      if (t.dataset.weg && g) { tue(() => motor.entferne(stand, g.dataset.gegner)); return; }
      if (t.matches("[data-gegner]")) { markiert = markiert === `g:${t.dataset.gegner}` ? null : `g:${t.dataset.gegner}`; zeige(); return; }
      if (t.dataset.wahl) { waehle(t.dataset.wahl); return; }
      if (t.dataset.neu || t.dataset.vorlage) {
        const anzahl = Math.max(1, Math.min(12, +(($("spNeuAnzahl") || {}).value) || 1)), zone = ($("spNeuZone") || {}).value || "";
        const v = t.dataset.vorlage && KS.VORLAGEN.find(x => x.key === t.dataset.vorlage);
        const id = v ? `v-${v.key}` : t.dataset.neu, def = v ? { name: v.d.name, karte: `v:${v.key}`, info: v.d.flavor || "" } : null;
        fenster = null;
        tue(() => motor.fuegeGegnerHinzu(stand, id, anzahl, zone, def));
        return;
      }
      if (t.dataset.npcKampf) { const id = t.dataset.npcKampf; fenster = null; popup = null; tue(() => motor.npcAlsGegner(stand, id)); return; }
      if (t.dataset.eingabe) { eingabeFertig(t.dataset.eingabe); return; }
      if (t.dataset.probe !== undefined) { probe(+t.dataset.probe, +t.dataset.w || 0); return; }
      if (t.dataset.ev) { popup = null; tue(() => motor.ereignis(stand, t.dataset.ev)); return; }
      if (t.dataset.cue) { spiele(t.dataset.cue); return; }
      if (t.dataset.wurf !== undefined) { wuerfe[t.dataset.wurf] = motor.wuerfle(); zeige(); return; }
      if (t.dataset.stand) { await oeffne(t.dataset.stand); return; }
      switch (t.dataset.sp) {
        case "neu": await neuerAbend(); break;
        case "abschliessen": tue(() => motor.abschliessen(stand)); melde("Map abgeschlossen. Die nächste Map übernimmt alles von selbst."); break;
        case "naechste-map": { const nm = naechsteMap(); if (!nm) break; await speichere(); const u = stand.uebernahme || motor.uebernahme(stand); stoppe(); await neuerAbend({ map: nm.map, uebernahme: u, gruppeId: stand.gruppeId, schwierigkeit: stand.schwierigkeit }); break; }
        case "speichern": await speichere(); if (gespeichert && gespeichert.ok) melde("Gespeichert."); break;
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
        case "antreiben": if (!motor.antreiber(stand).length) { melde("Für diesen Schritt gibt es keine Antreiber. Weiter mit der Leertaste bringt die Szene voran."); break; } antreiberZu = `zeigen:${stand.schritt}`; zeige(); break;
        case "antreiber-naechster": antreiberNr++; zeige(); break;
        case "antreiber-zu": antreiberZu = stand.schritt; zeige(); break;
        case "log": fenster = "log"; zeige(); break;
        case "gegner-neu": fenster = "gegner-neu"; zeige(); break;
        case "npc-namenlos": { const anzahl = Math.max(1, Math.min(12, +(($("spNeuAnzahl") || {}).value) || 1)), zone = ($("spNeuZone") || {}).value || ""; fenster = null; tue(() => motor.zufallsNpc(stand, "", anzahl, zone)); break; }
        case "erinnern": erinnern = !erinnern; zeige(); break;
        case "geben": tue(() => motor.gibBeute(stand, t.dataset.held, t.dataset.sache)); break;
        case "benutzen": tue(() => motor.benutze(stand, t.dataset.held, +t.dataset.i)); break;
        case "zu": fenster = null; eingabeFuer = null; zeige(); break;
        case "eingabe-frei": { const v = ($("spEingabeFrei") || {}).value; if (v && v.trim()) eingabeFertig(v.trim()); break; }
        case "schliessen": await speichere(); merkeOffen(null); wachHalten(false); stand = null; standId = null; popup = null; fenster = null; stoppe(); if (document.fullscreenElement) document.exitFullscreen(); await ladeListe(); zeige(); break;
      }
    });
    tab.addEventListener("change", e => {
      if (e.target.dataset.check && stand) { stand.checks[e.target.dataset.check] = e.target.checked; spaeter(); }
      if (e.target.dataset.reichen && stand && e.target.value) { const t = e.target; tue(() => motor.reiche(stand, t.dataset.reichen, +t.dataset.i, t.value)); return; }
      if (e.target.dataset.wissen && stand) { const t = e.target; tue(() => motor.erfahre(stand, t.dataset.wissen, +t.dataset.i, t.checked)); }
      if (e.target.dataset.hoch && e.target.files && e.target.files[0]) ladeHoch(e.target.dataset.hoch, e.target.files[0]);
    });
    document.addEventListener("keydown", e => {
      if ($("tabSpielen").hidden || !stand) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); speichere().then(() => { if (gespeichert && gespeichert.ok) melde("Gespeichert."); }); return; }
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
      if (fenster && !fenster.startsWith("npc")) { if ((k === "l" || k === "L") && fenster === "lage") { fenster = null; zeige(); } if ((k === "p" || k === "P") && fenster === "log") { fenster = null; zeige(); } return; }
      // Eine offene Probe nimmt die Ziffern zuerst: Der Spieler hat gerade gewürfelt
      const offen = offeneProbe();
      if (offen >= 0 && /^[1-6]$/.test(k)) { probe(offen, +k); return; }
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (kampfOffen(s)) melde("Der Kampf läuft noch. Ziel per Aktion oder Schaden erreichen, oder unten „Weiter“ klicken.");
        else if (s && s.typ === "ende" && !motor.naechsterId(stand)) { if (!stand.fertig) { tue(() => motor.abschliessen(stand)); melde("Map abgeschlossen. Die nächste Map übernimmt alles von selbst."); } }
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
      if (k === "p" || k === "P") { fenster = "log"; zeige(); return; }
      if (k === "x" || k === "X") { antreiberZu = stand.schritt; zeige(); return; }
      if (k === "a" || k === "A") { if (s && (s.cue || s.musik)) spiele(s.cue || s.musik); return; }
      if (k === "s" || k === "S") { stoppe(); zeige(); return; }
      if (k === "n" || k === "N") { if (fenster && fenster.startsWith("npc")) fenster = null; else if ([...stand.verlauf].some(id => (map.schritte[id] || {}).typ === "npc")) fenster = "npc"; zeige(); return; }
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

  // Die Uhr läuft weiter, auch wenn niemand klickt; überschreitet ein Schritt sein Zeitlimit, erscheint der Antreiber
  let warSpaet = false;
  setInterval(() => {
    if (!stand || $("tabSpielen").hidden) return;
    const spaet = ueberzogen();
    if (spaet && !warSpaet && !fenster) zeige(); else zeigeKopf();
    warSpaet = spaet;
  }, 30000);

  window.KartenschmiedeSpiel = {
    async zeigen() {
      if (!geladen) {
        geladen = true; verdrahten();
        try { await ladeListe(); } catch { staende = []; }
        try { await ladeAudio(); } catch { audio = {}; }
        try { window.__spGruppen = window.KartenschmiedeGruppe ? await window.KartenschmiedeGruppe.gruppen() : []; } catch { window.__spGruppen = []; }
        // Neu geladen mitten im Abend: dort weitermachen, wo zuletzt gespielt wurde
        const offen = offenGemerkt();
        if (offen && !stand) { try { await oeffne(offen); if (stand) melde("Weiter, wo du warst. Die App speichert nach jeder Aktion."); } catch { merkeOffen(null); } }
      }
      zeige();
    },
  };
  if (!$("tabSpielen").hidden) window.KartenschmiedeSpiel.zeigen();
})();

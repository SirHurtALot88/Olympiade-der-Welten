/* Kartenschmiede – Reiter „Gruppe“: Helden-Lineups mit Fähigkeiten aus der Datenbank.
   Eine Gruppe enthält vollständige Kopien ihrer Karten, damit sie für sich allein gedruckt werden kann.
   Braucht window.KS aus app.js. */
(function () {
  "use strict";
  const KS = window.KS;
  const { R, esc, renderCard, passeAn, STUFEN, ROLLEN } = KS;
  const $ = id => document.getElementById(id);
  const API = "/api/kartenschmiede/gruppen";
  const LOKAL = "kartenschmiede-gruppen";
  const SCHWIERIGKEIT = [
    { stufe: 1, name: "Anfänger", anteil: 0.25 }, { stufe: 2, name: "Fortgeschritten", anteil: 0.5 },
    { stufe: 3, name: "Experte", anteil: 0.75 }, { stufe: 4, name: "Legendär", anteil: 1 },
  ];

  let gruppen = [];      // Übersicht: { id, name, mitglieder }
  let aktiv = null;      // vollständige Gruppe
  let geladen = false, speicherTakt = null;
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, "");

  // ---------- Ablage: Server oder dieser Browser ----------
  const lokal = () => { try { return JSON.parse(localStorage.getItem(LOKAL) || "[]"); } catch { return []; } };
  const lokalSchreiben = liste => { try { localStorage.setItem(LOKAL, JSON.stringify(liste)); } catch { melde("Der Browser-Speicher ist voll. Große Artworks belegen viel Platz."); } };
  async function liste() {
    if (!KS.SERVER) { gruppen = lokal().map(g => ({ id: g.id, name: g.name, mitglieder: g.mitglieder.length })); return; }
    const r = await fetch(API, { credentials: "same-origin" });
    gruppen = r.ok ? (await r.json()).gruppen : [];
  }
  async function lade(id) {
    if (!KS.SERVER) return lokal().find(g => g.id === id) || null;
    const r = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: "same-origin" });
    return r.ok ? (await r.json()).inhalt : null;
  }
  async function speichere() {
    if (!aktiv) return;
    if (!KS.SERVER) { lokalSchreiben(lokal().filter(g => g.id !== aktiv.id).concat(aktiv)); melde("Gespeichert in diesem Browser."); await liste(); zeigeListe(); return; }
    const r = await fetch(`${API}/${encodeURIComponent(aktiv.id)}`, { method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inhalt: aktiv }) });
    melde(r.ok ? "Gespeichert." : "Speichern fehlgeschlagen. Bist du noch eingeloggt?");
    await liste(); zeigeListe();
  }
  const spaeterSpeichern = () => { clearTimeout(speicherTakt); melde("Ungespeicherte Änderungen …"); speicherTakt = setTimeout(speichere, 900); };
  async function loesche() {
    if (!aktiv) return;
    if (KS.SERVER) await fetch(`${API}/${encodeURIComponent(aktiv.id)}`, { method: "DELETE", credentials: "same-origin" });
    else lokalSchreiben(lokal().filter(g => g.id !== aktiv.id));
    aktiv = null; await liste(); zeigeListe(); zeigeGruppe();
  }
  const melde = t => { const m = $("gMsg"); if (m) m.textContent = t; };

  // ---------- Rechnen ----------
  const punkteVon = k => R.punkte(k);
  function aktualisiere(k) {
    if (k.role === "companion") { k.role = "enemy"; k.gefaehrte = true; } // ältere Gruppen kannten noch die Rolle „Gefährte“
    k.points = punkteVon(k).pts; k.tier = R.stufeFuerPunkte(k.points); return k;
  }
  const summe = rolle => aktiv.mitglieder.filter(k => !rolle || k.role === rolle).reduce((s, k) => s + (+k.points || 0), 0);

  // ---------- Anzeige ----------
  function zeigeListe() {
    $("gListe").innerHTML = gruppen.length ? gruppen.map(g => `<button type="button" class="g-item" data-g="${esc(g.id)}" aria-current="${aktiv && aktiv.id === g.id}">
      <b>${esc(g.name)}</b><small>${g.mitglieder} Mitglieder</small></button>`).join("") : `<p class="hint">Noch keine Gruppe.</p>`;
  }
  // Helden kommen aus Vorlagen und gespeicherten Karten. Gefährten sind Gegner, die der Spielleiter für diese
  // Gruppe freigeschaltet hat – jeder Gegner kann einer werden. Schlüssel: "v:<vorlage>" oder "k:<karten-id>".
  const istHeld = d => d && d.role === "hero";
  function alleGegner() {
    const eintrag = (key, name, d) => { const pts = R.punkte(d).pts; return { key, name, pts, stufe: R.stufeFuerPunkte(pts), faction: d.faction || "", praegung: d.praegung || [] }; };
    return KS.VORLAGEN.filter(v => !istHeld(v.d)).map(v => eintrag("v:" + v.key, v.d.name, v.d))
      .concat((KS.serverKarten() || []).filter(k => k.role !== "hero").map(k => eintrag("k:" + k.id, k.name, { ...(k.werte || {}), name: k.name })));
  }
  async function karteZu(key) {
    if (key.startsWith("v:")) { const v = KS.VORLAGEN.find(x => x.key === key.slice(2)); return v ? JSON.parse(JSON.stringify(v.d)) : null; }
    const r = await fetch(`/api/kartenschmiede/karten/${encodeURIComponent(key.slice(2))}`, { credentials: "same-origin" });
    return r.ok ? (await r.json()).inhalt : null;
  }

  // ---------- Gegnerwelle ----------
  function welleBereich(ziel) {
    const pool = alleGegner();
    const fraktionen = [...new Set(pool.map(g => g.faction).filter(Boolean))].sort();
    const w = aktiv.welle;
    return `<div class="g-welle"><h4>Gegnerwelle für die nächste Mission <small>Ziel ${ziel} Punkte</small></h4>
      <div class="g-welle-zeile">
        <select id="gWelleFraktion" aria-label="Fraktion der Welle"><option value="">Alle Fraktionen</option>${fraktionen.map(f => `<option ${aktiv.welleFraktion === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select>
        <button type="button" class="btn sm" id="gWelle">${w ? "Neu würfeln" : "Welle würfeln"}</button>
        ${w && w.einheiten.length ? `<button type="button" class="btn ghost sm" id="gWelleDruck">Welle als Postkarten drucken</button>` : ""}
      </div>
      ${w ? (w.einheiten.length ? `<ul class="g-welle-liste">${w.einheiten.map(e => `<li><span class="tier-dot" style="background:var(--t${e.stufe})"></span><b>${esc(e.name)}</b>${e.anzahl > 1 ? ` × ${e.anzahl}` : ""} <small>${e.pts} P.${e.anzahl > 1 ? ` · zusammen ${e.pts * e.anzahl}` : ""}</small></li>`).join("")}</ul>
        <p class="hint">Zusammen <b>${w.summe}</b> von ${w.ziel} Punkten. Die Schwierigkeit begrenzt die Seltenheit: Anfänger bis Magisch, Fortgeschritten bis Elite, Experte bis Legendär, Legendär mit Boss.</p>`
        : `<p class="hint">Keine passenden Gegner gefunden. Andere Fraktion wählen oder mehr Gegner anlegen.</p>`) : `<p class="hint">Stellt aus deinen Gegnern eine Welle zusammen, die zu den Gruppenpunkten und der Schwierigkeit passt.</p>`}
    </div>`;
  }
  async function welleDrucken() {
    const karten = [];
    for (const e of aktiv.welle.einheiten) { const k = await karteZu(e.key); if (k) for (let i = 0; i < e.anzahl; i++) karten.push(k); }
    if (karten.length) KS.drucken(karten, "postkarte");
  }

  // ---------- Heldenfortschritt ----------
  const heute = () => new Date().toLocaleDateString("de-DE");
  function fortschritt(k, i) {
    const verlauf = Array.isArray(k.verlauf) ? k.verlauf : [];
    return `<div class="g-fortschritt">
      <div class="g-ep"><span>Erfahrung</span><button type="button" class="tgl" data-ep="-1" data-i="${i}" aria-label="Erfahrung verringern">−</button><b>${k.ep || 0}</b><button type="button" class="tgl" data-ep="1" data-i="${i}" aria-label="Erfahrung erhöhen">+</button></div>
      <label class="f">Beute und Ausrüstung <textarea rows="2" data-feld="beute" data-i="${i}">${esc(k.beute || "")}</textarea></label>
      <details class="mehr"><summary>Verlauf (${verlauf.length})</summary>
        <ul class="g-verlauf">${verlauf.slice().reverse().map(v => `<li><small>${esc(v.d)}</small> ${esc(v.t)}</li>`).join("") || `<li class="hint">Noch nichts eingetragen.</li>`}</ul>
        <div class="g-welle-zeile"><input type="text" data-verlauf-neu="${i}" placeholder="z. B. Mission 3: Krypta geräumt"><button type="button" class="btn ghost sm" data-verlauf-add="${i}">Eintragen</button></div>
      </details>
    </div>`;
  }
  const notiere = (k, text) => { k.verlauf = (Array.isArray(k.verlauf) ? k.verlauf : []).concat({ d: heute(), t: text }).slice(-60); };
  const freigeschaltet = () => new Set(aktiv.freigeschaltet || []);
  const helden = () => aktiv.mitglieder.filter(k => k.role === "hero");
  const gefaehrten = () => aktiv.mitglieder.filter(k => k.gefaehrte);
  function kandidaten() {
    const vorlagen = KS.VORLAGEN.filter(v => istHeld(v.d));
    const meine = (KS.serverKarten() || []).filter(k => k.role === "hero");
    const frei = freigeschaltet();
    const offen = alleGegner().filter(g => frei.has(g.key));
    const platz = gefaehrten().length < helden().length;
    return `<option value="">Mitglied hinzufügen …</option><option value="werkstatt">Aktuelle Karte aus „Erstellen“</option>
      <optgroup label="Helden">${vorlagen.map(v => `<option value="v:${v.key}">${esc(v.d.name)}</option>`).join("")}${meine.map(k => `<option value="k:${esc(k.id)}">${esc(k.name)} · ${k.points} P.</option>`).join("")}</optgroup>
      <optgroup label="${platz ? "Gefährten (freigeschaltet)" : "Gefährten: höchstens einer je Held"}">${offen.map(g => `<option value="g:${esc(g.key)}" ${platz ? "" : "disabled"}>${esc(g.name)} · ${g.pts} P.</option>`).join("") || `<option disabled>Noch keiner freigeschaltet</option>`}</optgroup>`;
  }
  function spielleiterBereich() {
    if (!aktiv.spielleiter) return "";
    const frei = freigeschaltet();
    return `<div class="g-gm"><h4>Gefährten freischalten</h4>
      <p class="hint">Jeder Gegner kann ein Gefährte werden, zum Beispiel nachdem die Gruppe seine Elite-Version besiegt hat. Freigeschaltete erscheinen oben in der Auswahl.</p>
      <div class="tgls">${alleGegner().map(g => `<button type="button" class="tgl" data-frei="${esc(g.key)}" aria-pressed="${frei.has(g.key)}">${frei.has(g.key) ? "" : "🔒 "}${esc(g.name)} <span class="cost">${g.pts}</span></button>`).join("")}</div></div>`;
  }
  function zeigeGruppe() {
    const main = $("gMain");
    if (!aktiv) { main.innerHTML = `<p class="lede">Lege links eine Gruppe an oder wähle eine aus.</p>`; return; }
    const schw = SCHWIERIGKEIT.find(s => s.stufe === +aktiv.schwierigkeit) || SCHWIERIGKEIT[1];
    const gesamt = summe();
    main.innerHTML = `
      <div class="g-head">
        <label class="f">Name der Gruppe <input type="text" id="gName" value="${esc(aktiv.name)}"></label>
        <label class="f" style="max-width:160px">Budget je Held <input type="number" id="gBudget" min="20" step="5" value="${aktiv.budget}"></label>
        <label class="f" style="max-width:220px">Schwierigkeit
          <select id="gSchw">${SCHWIERIGKEIT.map(s => `<option value="${s.stufe}" ${s.stufe === schw.stufe ? "selected" : ""}>${s.stufe} · ${s.name} (${Math.round(s.anteil * 100)} %)</option>`).join("")}</select>
        </label>
      </div>
      <div class="g-stats">
        <div class="g-stat"><span>Gruppenpunkte</span><b>${gesamt}</b></div>
        <div class="g-stat"><span>Helden</span><b>${helden().length}</b></div>
        <div class="g-stat"><span>Gefährten</span><b>${gefaehrten().length}</b></div>
        <div class="g-stat"><span>Gegnerwelle</span><b>${Math.round(gesamt * schw.anteil)}</b></div>
      </div>
      ${welleBereich(Math.round(gesamt * schw.anteil))}
      <p class="hint">Quest-Regel: Jede Gegnerwelle hat ${Math.round(schw.anteil * 100)} % der Gruppenpunkte. Gefährten zählen mit, deshalb bleibt das Spiel im Gleichgewicht, egal wen ihr anwerbt.</p>
      <div class="g-add">
        <label class="f">Mitglied <select id="gAdd">${kandidaten()}</select></label>
        <button type="button" class="btn ghost sm" id="gDruck">Alle drucken</button>
        <select id="gDruckFormat" aria-label="Druckformat" class="druck-format">${KS.DRUCKFORMATE.map(([id, n]) => `<option value="${id}" ${id === KS.druckFormat() ? "selected" : ""}>${n}</option>`).join("")}</select>
        <label class="check klein"><input type="checkbox" id="gRueck" ${KS.mitRueckseite() ? "checked" : ""}> Rückseite</label>
        <button type="button" class="btn ghost sm" id="gPng">Alle als PNG</button>
        <label class="check gm-schalter"><input type="checkbox" id="gSpielleiter" ${aktiv.spielleiter ? "checked" : ""}> Spielleiter</label>
        <button type="button" class="btn ghost sm" id="gWeg">Gruppe löschen</button>
      </div>
      ${spielleiterBereich()}
      <p class="hint" id="gMsg" aria-live="polite"></p>
      <div class="g-members">${aktiv.mitglieder.map((k, i) => mitglied(k, i)).join("") || `<p class="hint">Noch niemand in der Gruppe.</p>`}</div>`;
    main.querySelectorAll(".cwrap").forEach(passeAn);
  }
  function mitglied(k, i) {
    const held = k.role === "hero";
    const roh = punkteVon(k).roh;
    const rest = aktiv.budget - Math.round(roh);
    const skills = Array.isArray(k.skills) ? k.skills : [];
    // Gefährten bringen ihre eigenen Regeln mit, bekommen aber keine Skills dazu
    const angebote = k.gefaehrte ? [] : KS.alleFaehigkeiten().filter(f => f.fuer.includes(k.role || "enemy"));
    const knopf = f => {
      const an = skills.some(s => s.id === f.id);
      const kf = !an && KS.konfliktVon(f, k);
      if (kf) return `<button type="button" class="tgl" disabled data-tip="${esc(`<b>${esc(f.name)}</b>${esc(KS.konfliktText(kf))}`)}">${KS.tagIcons(f.tags, false)}${esc(f.name)} 🔒</button>`;
      const probe = { ...k, skills: an ? skills.filter(s => s.id !== f.id) : skills.concat(KS.skillKopie(f)) };
      const d = Math.round(punkteVon(probe).roh - roh);
      const zuTeuer = held && !an && d > rest;
      return `<button type="button" class="tgl" data-i="${i}" data-skill="${esc(f.id)}" aria-pressed="${an}" data-tip="${esc(KS.tipText(f))}" ${zuTeuer ? "disabled" : ""}>${KS.tagIcons(f.tags, false)}${esc(f.name)}<span class="cost ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d}</span></button>`;
    };
    const anteil = Math.max(0, Math.min(100, roh / aktiv.budget * 100));
    return `<div class="g-member">
      <div class="cwrap">${renderCard(k, R.stufeFuerPunkte(R.punkte(k).pts), { land: k.orient === "land" })}</div>
      ${held ? `<div class="meter" role="img" aria-label="${Math.round(roh)} von ${aktiv.budget} Punkten"><i style="width:${anteil}%"></i></div>
        <div class="g-budget"><b>${Math.round(roh)}</b> von ${aktiv.budget} Punkten · <b>${rest}</b> übrig</div>`
        : `<div class="g-budget"><b>${k.points}</b> Punkte · ${k.gefaehrte ? "Gefährte" : ROLLEN[k.role || "enemy"]} · ${STUFEN[k.tier || 1]}</div>`}
      ${k.gefaehrte ? `<p class="hint">Gefährte: keine Power, keine Skills, keine XP.</p>` : KS.tagLeiste("gruppe" + i, angebote, zeigeGruppe)}
      <div class="tgls">${angebote.filter(f => skills.some(s => s.id === f.id) || KS.filterPasst("gruppe" + i, f)).map(knopf).join("")}</div>
      ${held ? fortschritt(k, i) : ""}
      <div class="acts"><button type="button" class="btn ghost sm" data-oeffnen="${i}">In Werkstatt öffnen</button><button type="button" class="btn ghost sm" data-raus="${i}">Entfernen</button></div>
    </div>`;
  }

  // ---------- Aktionen ----------
  async function neueGruppe() {
    aktiv = { id: neueId(), name: "Neue Gruppe", budget: 100, schwierigkeit: 2, mitglieder: [] };
    await speichere(); zeigeListe(); zeigeGruppe();
  }
  async function hinzufuegen(wert) {
    let karte = null;
    if (wert === "werkstatt") karte = KS.aktuelleKarte();
    else if (wert.startsWith("v:")) { const v = KS.VORLAGEN.find(x => x.key === wert.slice(2)); karte = v && JSON.parse(JSON.stringify(v.d)); }
    else if (wert.startsWith("g:")) {
      if (gefaehrten().length >= helden().length) { melde("Höchstens ein Gefährte je Held."); zeigeGruppe(); return; }
      const key = wert.slice(2);
      if (key.startsWith("v:")) { const v = KS.VORLAGEN.find(x => x.key === key.slice(2)); karte = v && JSON.parse(JSON.stringify(v.d)); }
      else { const r = await fetch(`/api/kartenschmiede/karten/${encodeURIComponent(key.slice(2))}`, { credentials: "same-origin" }); if (r.ok) karte = (await r.json()).inhalt; }
      if (karte) { karte.gefaehrte = true; karte.role = "enemy"; karte.skills = (karte.skills || []).filter(f => f.kosten && f.kosten.typ === "prozent"); }
    }
    else if (wert.startsWith("k:")) {
      const r = await fetch(`/api/kartenschmiede/karten/${encodeURIComponent(wert.slice(2))}`, { credentials: "same-origin" });
      if (r.ok) karte = (await r.json()).inhalt;
    }
    if (!karte) return;
    karte.gruppenId = neueId();
    aktiv.mitglieder.push(aktualisiere(karte));
    zeigeGruppe(); spaeterSpeichern();
  }

  function verdrahten() {
    $("gNeu").addEventListener("click", neueGruppe);
    $("gListe").addEventListener("click", async e => {
      const b = e.target.closest("[data-g]"); if (!b) return;
      aktiv = await lade(b.dataset.g); if (aktiv) aktiv.mitglieder.forEach(aktualisiere); zeigeListe(); zeigeGruppe();
    });
    $("gMain").addEventListener("change", e => {
      if (!aktiv) return;
      if (e.target.id === "gName") { aktiv.name = e.target.value || "Gruppe"; spaeterSpeichern(); }
      if (e.target.id === "gBudget") { aktiv.budget = Math.max(20, +e.target.value || 100); zeigeGruppe(); spaeterSpeichern(); }
      if (e.target.id === "gSchw") { aktiv.schwierigkeit = +e.target.value; zeigeGruppe(); spaeterSpeichern(); }
      if (e.target.id === "gAdd" && e.target.value) hinzufuegen(e.target.value);
      if (e.target.id === "gRueck") { try { localStorage.setItem("kartenschmiede-rueckseite", e.target.checked ? "1" : "0"); } catch { /* egal */ } }
      if (e.target.id === "gWelleFraktion") { aktiv.welleFraktion = e.target.value; spaeterSpeichern(); }
      if (e.target.dataset && e.target.dataset.feld === "beute") { aktiv.mitglieder[+e.target.dataset.i].beute = e.target.value.slice(0, 1000); spaeterSpeichern(); }
      if (e.target.id === "gSpielleiter") { aktiv.spielleiter = e.target.checked; zeigeGruppe(); spaeterSpeichern(); }
      if (e.target.id === "gDruckFormat") { try { localStorage.setItem("kartenschmiede-druck", e.target.value); } catch { /* egal */ } }
    });
    $("gMain").addEventListener("click", e => {
      if (!aktiv) return;
      const t = e.target.closest("button"); if (!t) return;
      if (t.id === "gWelle") {
        const schw = SCHWIERIGKEIT.find(x => x.stufe === +aktiv.schwierigkeit) || SCHWIERIGKEIT[1];
        aktiv.welle = KS.KAT.welleWuerfeln(alleGegner(), Math.round(summe() * schw.anteil), { schwierigkeit: schw.stufe, fraktion: aktiv.welleFraktion || "", seed: Date.now() });
        zeigeGruppe(); spaeterSpeichern(); return;
      }
      if (t.id === "gWelleDruck") { welleDrucken(); return; }
      if (t.dataset.ep !== undefined) {
        const k = aktiv.mitglieder[+t.dataset.i]; k.ep = Math.max(0, (k.ep || 0) + +t.dataset.ep);
        zeigeGruppe(); spaeterSpeichern(); return;
      }
      if (t.dataset.verlaufAdd !== undefined) {
        const i = +t.dataset.verlaufAdd, feld = $("gMain").querySelector(`[data-verlauf-neu="${i}"]`);
        if (feld && feld.value.trim()) { notiere(aktiv.mitglieder[i], feld.value.trim().slice(0, 200)); zeigeGruppe(); spaeterSpeichern(); }
        return;
      }
      if (t.dataset.frei !== undefined) {
        const frei = freigeschaltet();
        if (frei.has(t.dataset.frei)) frei.delete(t.dataset.frei); else frei.add(t.dataset.frei);
        aktiv.freigeschaltet = [...frei]; zeigeGruppe(); spaeterSpeichern();
      } else if (t.dataset.skill !== undefined) {
        const k = aktiv.mitglieder[+t.dataset.i];
        const skills = Array.isArray(k.skills) ? k.skills : [];
        const f = KS.alleFaehigkeiten().find(x => x.id === t.dataset.skill);
        const hatte = skills.some(s => s.id === t.dataset.skill);
        k.skills = hatte ? skills.filter(s => s.id !== t.dataset.skill) : f ? skills.concat(KS.skillKopie(f)) : skills;
        if (k.role === "hero" && f) notiere(k, `${hatte ? "Abgelegt" : "Gelernt"}: ${f.name}`);
        aktualisiere(k); zeigeGruppe(); spaeterSpeichern();
      } else if (t.dataset.raus !== undefined) {
        aktiv.mitglieder.splice(+t.dataset.raus, 1); zeigeGruppe(); spaeterSpeichern();
      } else if (t.dataset.oeffnen !== undefined) {
        KS.oeffneInWerkstatt(aktiv.mitglieder[+t.dataset.oeffnen]);
      } else if (t.id === "gDruck") KS.drucken(aktiv.mitglieder, $("gDruckFormat").value);
      else if (t.id === "gPng") KS.zeigePngs(aktiv.mitglieder);
      else if (t.id === "gWeg") {
        if (t.dataset.sicher !== "1") { t.dataset.sicher = "1"; t.textContent = "Wirklich löschen?"; return; }
        loesche();
      }
    });
  }

  window.KartenschmiedeGruppe = {
    async zeigen() {
      if (!geladen) { geladen = true; verdrahten(); await liste(); if (gruppen[0]) aktiv = await lade(gruppen[0].id); if (aktiv) aktiv.mitglieder.forEach(aktualisiere); }
      zeigeListe(); zeigeGruppe();
    },
  };
  if (!$("tabGruppe").hidden) window.KartenschmiedeGruppe.zeigen();
})();

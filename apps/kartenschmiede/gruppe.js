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
  function aktualisiere(k) { k.points = punkteVon(k).pts; k.tier = R.stufeFuerPunkte(k.points); return k; }
  const summe = rolle => aktiv.mitglieder.filter(k => !rolle || k.role === rolle).reduce((s, k) => s + (+k.points || 0), 0);

  // ---------- Anzeige ----------
  function zeigeListe() {
    $("gListe").innerHTML = gruppen.length ? gruppen.map(g => `<button type="button" class="g-item" data-g="${esc(g.id)}" aria-current="${aktiv && aktiv.id === g.id}">
      <b>${esc(g.name)}</b><small>${g.mitglieder} Mitglieder</small></button>`).join("") : `<p class="hint">Noch keine Gruppe.</p>`;
  }
  function kandidaten() {
    const vorlagen = KS.VORLAGEN.filter(v => v.d.role === "hero" || v.d.role === "companion" || v.eigen);
    return `<option value="">Mitglied hinzufügen …</option><option value="werkstatt">Aktuelle Karte aus der Werkstatt</option>
      <optgroup label="Vorlagen">${vorlagen.map(v => `<option value="v:${v.key}">${esc(v.d.name)} (${ROLLEN[v.d.role || "enemy"]})</option>`).join("")}</optgroup>
      ${KS.SERVER ? `<optgroup label="Meine Karten" id="gMeine"></optgroup>` : ""}`;
  }
  async function meineKartenOptionen() {
    const og = $("gMeine"); if (!og) return;
    try {
      const r = await fetch("/api/kartenschmiede/karten", { credentials: "same-origin" });
      const { karten } = await r.json();
      og.innerHTML = karten.map(k => `<option value="k:${esc(k.id)}">${esc(k.name)} · ${k.points} P.</option>`).join("");
    } catch { /* ohne Liste weiter */ }
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
        <div class="g-stat"><span>Helden</span><b>${aktiv.mitglieder.filter(k => k.role === "hero").length}</b></div>
        <div class="g-stat"><span>Gefährten</span><b>${aktiv.mitglieder.filter(k => k.role === "companion").length}</b></div>
        <div class="g-stat"><span>Gegnerwelle</span><b>${Math.round(gesamt * schw.anteil)}</b></div>
      </div>
      <p class="hint">Quest-Regel: Jede Gegnerwelle hat ${Math.round(schw.anteil * 100)} % der Gruppenpunkte. Gefährten zählen mit, deshalb bleibt das Spiel im Gleichgewicht, egal wen ihr anwerbt.</p>
      <div class="g-add">
        <label class="f">Mitglied <select id="gAdd">${kandidaten()}</select></label>
        ${KS.SERVER ? `<button type="button" class="btn ghost sm" id="gDruck">Alle drucken</button>` : ""}
        <button type="button" class="btn ghost sm" id="gPng">Alle als PNG</button>
        <button type="button" class="btn ghost sm" id="gWeg">Gruppe löschen</button>
      </div>
      <p class="hint" id="gMsg" aria-live="polite"></p>
      <div class="g-members">${aktiv.mitglieder.map((k, i) => mitglied(k, i)).join("") || `<p class="hint">Noch niemand in der Gruppe.</p>`}</div>`;
    main.querySelectorAll(".cwrap").forEach(passeAn);
    meineKartenOptionen();
  }
  function mitglied(k, i) {
    const held = k.role === "hero";
    const roh = punkteVon(k).roh;
    const rest = aktiv.budget - Math.round(roh);
    const skills = Array.isArray(k.skills) ? k.skills : [];
    const angebote = KS.alleFaehigkeiten().filter(f => f.fuer.includes(k.role || "enemy"));
    const knopf = f => {
      const an = skills.some(s => s.id === f.id);
      const probe = { ...k, skills: an ? skills.filter(s => s.id !== f.id) : skills.concat(KS.skillKopie(f)) };
      const d = Math.round(punkteVon(probe).roh - roh);
      const zuTeuer = held && !an && d > rest;
      return `<button type="button" class="tgl" data-i="${i}" data-skill="${esc(f.id)}" aria-pressed="${an}" title="${esc(f.text)}" ${zuTeuer ? "disabled" : ""}>${esc(f.name)}<span class="cost ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d}</span></button>`;
    };
    const anteil = Math.max(0, Math.min(100, roh / aktiv.budget * 100));
    return `<div class="g-member">
      <div class="cwrap">${renderCard(k, k.tier || 1, {})}</div>
      ${held ? `<div class="meter" role="img" aria-label="${Math.round(roh)} von ${aktiv.budget} Punkten"><i style="width:${anteil}%"></i></div>
        <div class="g-budget"><b>${Math.round(roh)}</b> von ${aktiv.budget} Punkten · <b>${rest}</b> übrig</div>`
        : `<div class="g-budget"><b>${k.points}</b> Punkte · ${ROLLEN[k.role || "enemy"]} · ${STUFEN[k.tier || 1]}</div>`}
      <div class="tgls">${angebote.map(knopf).join("")}</div>
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
    });
    $("gMain").addEventListener("click", e => {
      if (!aktiv) return;
      const t = e.target.closest("button"); if (!t) return;
      if (t.dataset.skill !== undefined) {
        const k = aktiv.mitglieder[+t.dataset.i];
        const skills = Array.isArray(k.skills) ? k.skills : [];
        const f = KS.alleFaehigkeiten().find(x => x.id === t.dataset.skill);
        k.skills = skills.some(s => s.id === t.dataset.skill) ? skills.filter(s => s.id !== t.dataset.skill) : f ? skills.concat(KS.skillKopie(f)) : skills;
        aktualisiere(k); zeigeGruppe(); spaeterSpeichern();
      } else if (t.dataset.raus !== undefined) {
        aktiv.mitglieder.splice(+t.dataset.raus, 1); zeigeGruppe(); spaeterSpeichern();
      } else if (t.dataset.oeffnen !== undefined) {
        KS.oeffneInWerkstatt(aktiv.mitglieder[+t.dataset.oeffnen]);
      } else if (t.id === "gDruck") KS.drucken(aktiv.mitglieder);
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

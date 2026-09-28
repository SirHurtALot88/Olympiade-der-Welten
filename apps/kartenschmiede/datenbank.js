/* Kartenschmiede – Reiter „Datenbank“: Einheiten, Fähigkeiten, Zauber, Gegenstände, Waffen und Fraktionen
   mit Suche und Filtern, dazu der Generator und das Formular für eigene Einträge. Braucht window.KS (app.js),
   Regeln (regeln.js) und Generator (generator.js). */
(function () {
  "use strict";
  const KS = window.KS, G = window.Generator;
  const { R, esc, ico, TAG, KAT, ROLLEN, STUFEN } = KS;
  const $ = id => document.getElementById(id);

  const filter = { q: "", typ: "", tags: new Set(), rolle: "" };
  let serverKarten = [];
  let vorschlag = null;
  let bereit = false;

  // ---------- Einträge sammeln ----------
  const TYP_ICON = { faehigkeit: "bolt", zauber: "rune", gegenstand: "potion", fraktion: "sun" };
  const typName = id => (KAT.TYPEN.find(t => t.id === id) || { einzahl: id }).einzahl;
  function einheitTags(d) {
    const t = new Set();
    R.leseWaffen(d.weapons).forEach(w => KAT.tagsFuerWaffe(w).forEach(x => t.add(x)));
    (d.skills || []).forEach(k => (k.tags || []).forEach(x => t.add(x)));
    R.leseListe(d.passives).forEach(p => {
      if (/regenerat/i.test(p)) t.add("heilung");
      if (/furcht|fear/i.test(p) && !/furchtlos/i.test(p)) t.add("furcht");
      if (/tarnung|hinterhalt/i.test(p)) t.add("tarnung");
      if (/schnell|fliegen/i.test(p)) t.add("bewegung");
      if (/zauberer/i.test(p)) t.add("magie");
    });
    return [...t];
  }
  function einheitEintrag(d, id, bild, quelle) {
    const pts = R.punkte(d).pts;
    const waffen = R.leseWaffen(d.weapons).map(w => w.name).join(", ");
    return { typ: "einheit", id, name: d.name, art: ROLLEN[d.role || "enemy"], fuer: [d.role || "enemy"], tags: einheitTags(d),
      kosten: { typ: "fest", wert: pts }, stufe: R.stufeFuerPunkte(pts), bild, quelle, karte: d,
      text: `${d.faction || ""} · Qualität ${d.quality} · Verteidigung ${d.defense} · Zäh ${d.tough}${waffen ? " · " + waffen : ""}` };
  }
  function eintraege() {
    const einheiten = KS.VORLAGEN.map(v => einheitEintrag(v.d, "v:" + v.key, KS.IMG[v.d.art] || null, "Vorlage"))
      .concat(serverKarten.map(k => ({ typ: "einheit", id: "k:" + k.id, name: k.name, art: ROLLEN[k.role || "enemy"], fuer: [k.role || "enemy"], tags: [],
        kosten: { typ: "fest", wert: k.points }, stufe: k.tier, bild: k.vorschau, quelle: k.gespeichertVon ? "gespeichert von " + k.gespeichertVon : "gespeichert", text: "Gespeicherte Karte" })));
    return einheiten.concat(KS.alleEintraege());
  }
  function passt(e) {
    if (filter.typ && e.typ !== filter.typ) return false;
    if (filter.rolle && !(e.fuer || []).includes(filter.rolle)) return false;
    for (const t of filter.tags) if (!(e.tags || []).includes(t)) return false;
    const q = filter.q.trim().toLowerCase();
    return !q || `${e.name} ${e.text || ""} ${e.art || ""} ${e.waffe || ""}`.toLowerCase().includes(q);
  }

  // ---------- Anzeige ----------
  const preisVon = e => e.typ === "einheit" ? `${e.kosten.wert} P.` : e.typ === "fraktion" ? "" : e.typ === "waffe" ? `${G.waffenPreis(R, e.waffe)} P.` : KS.kostenText(e.kosten);
  const PREIS_TIP = {
    waffe: "Fester Preis der Waffe, gemessen an einem Standard-Helden (Qualität 4+, Verteidigung 5+, Zäh 5). Auf der Karte zählt die Waffe mit der Qualität der Einheit: Wer besser trifft, zahlt etwas mehr.",
    fest: "Feste Punkte, die auf die Karte obendrauf kommen.",
    prozent: "Aufschlag auf die Punkte der Einheit – je stärker die Einheit, desto teurer die Regel.",
    einheit: "Punkte nach der Schmiede-Formel.",
  };
  const preisTip = e => PREIS_TIP[e.typ === "waffe" || e.typ === "einheit" ? e.typ : e.kosten && e.kosten.typ] || "";
  const symbolVon = e => e.typ === "einheit" ? KS.iconFuer(e.karte || {}) : e.typ === "fraktion" ? e.icon : e.typ === "waffe" ? (/Nahkampf/.test(e.waffe || "") ? "sword" : "target") : TYP_ICON[e.typ] || "rune";
  const kopfTip = e => [typName(e.typ), e.art && e.art !== typName(e.typ) ? e.art : ""].filter(Boolean).join(" · ");
  // Werte einer Waffe als Symbole mit Erklärung beim Hovern
  function waffenWerte(zeile) {
    const w = R.leseWaffe(zeile || "");
    const chip = (icon, text, tip) => `<span data-tip="${esc(tip)}">${ico(icon)}${esc(text)}</span>`;
    return `<div class="werte">${[
      w.reichweite ? chip("target", `${w.reichweite}"`, `<b>Fernkampf</b>Reichweite ${w.reichweite} Zoll.`) : chip("sword", "Nahkampf", "<b>Nahkampf</b>Greift nur Feinde in Kontakt an."),
      chip("dice", `A${w.a}`, `<b>Attacken</b>${w.a} Würfel pro Modell. Jeder Würfel trifft auf die Qualität der Einheit oder besser.`),
    ].concat(R.regelnVon(w.regeln).map(r => chip(r.icon, r.name, `<b>${r.name}</b>${r.text}`))).join("")}</div>`;
  }
  const karteName = () => { const k = KS.aktuelleKarte(); return k.name || "die Karte"; };
  const knopfTip = e => e.typ === "fraktion" ? `Setzt die Fraktion der Karte, die gerade in der Werkstatt offen ist (»${karteName()}«).`
    : e.typ === "waffe" ? `Fügt die Waffe der Karte hinzu, die gerade in der Werkstatt offen ist (»${karteName()}«). Die Punkte rechnen sich neu.`
    : `Fügt ${typName(e.typ) === "Zauber" ? "den Zauber" : "den Eintrag"} der Karte hinzu, die gerade in der Werkstatt offen ist (»${karteName()}«). Die Punkte rechnen sich neu.`;
  function kachel(e, opts = {}) {
    const eigen = KS.eigeneIds().has(e.id);
    const tags = (e.tags || []).filter(t => TAG[t]);
    const aktion = e.typ === "einheit" ? `<button type="button" class="btn ghost sm" data-oeffnen="${esc(e.id)}" data-tip="Lädt die Einheit in die Werkstatt (Reiter Generator).">In Werkstatt öffnen</button>`
      : `<button type="button" class="btn ghost sm" data-karte="${esc(e.id)}" data-tip="${esc(knopfTip(e))}">${e.typ === "fraktion" ? "Als Fraktion setzen" : "+ Zur Karte"}</button>`;
    const quelle = eigen ? "Eigener Eintrag" : e.quelle && e.quelle !== "Standard" ? e.quelle : "";
    const unter = [e.typ === "einheit" ? e.art : "", e.stufe ? STUFEN[e.stufe] : "", quelle].filter(Boolean).join(" · ");
    return `<article class="eintrag${opts.neu ? " neu" : ""}">
      ${e.bild ? `<div class="thumb" style="background-image:url('${e.bild}')"></div>` : ""}
      <div class="eintrag-kopf"><span class="typ-ico" data-tip="${esc(kopfTip(e))}">${ico(symbolVon(e))}</span>
        <div><b>${esc(e.name)}</b>${unter ? `<small>${esc(unter)}</small>` : ""}</div>
        <span class="preis" data-tip="${esc(preisTip(e))}">${preisVon(e)}</span></div>
      ${e.typ === "waffe" ? waffenWerte(e.waffe) : ""}
      ${tags.length ? `<div class="tagzeile">${tags.map(t => `<span data-tip="${esc(TAG[t].name)}">${ico(TAG[t].icon)}</span>`).join("")}</div>` : ""}
      ${e.text ? `<p>${esc(e.text)}</p>` : ""}
      ${e.fuer && e.typ !== "fraktion" && e.typ !== "einheit" && e.fuer.length < 3 ? `<p><small>Nur für: ${e.fuer.map(r => ROLLEN[r]).join(", ")}</small></p>` : ""}
      ${opts.neu ? `<div class="acts"><button type="button" class="btn sm" data-aufnehmen="1">In die Datenbank</button><button type="button" class="btn ghost sm" data-vorschlag-karte="1" data-tip="${esc(knopfTip(e))}">+ Zur Karte</button><button type="button" class="btn ghost sm" data-neu-wuerfeln="1">Neu würfeln</button></div>`
        : `<div class="acts">${aktion}${eigen ? `<button type="button" class="btn ghost sm" data-loeschen="${esc(e.id)}">Löschen</button>` : ""}</div>`}
    </article>`;
  }
  function zeigeFilter() {
    const alle = eintraege();
    const zahl = typ => alle.filter(e => e.typ === typ).length;
    $("dbTypen").innerHTML = [`<button type="button" class="chip-f" data-typ="" aria-pressed="${!filter.typ}">Alle</button>`]
      .concat(KAT.TYPEN.map(t => `<button type="button" class="chip-f" data-typ="${t.id}" aria-pressed="${filter.typ === t.id}">${esc(t.name)} <small>${zahl(t.id)}</small></button>`)).join("");
    $("dbTags").innerHTML = KAT.TAGS.map(t => `<button type="button" class="chip-f" data-tag="${t.id}" aria-pressed="${filter.tags.has(t.id)}" data-tip="${esc(t.name)}">${ico(t.icon)}${esc(t.name)}</button>`).join("");
    $("dbRollen").innerHTML = [["", "Alle"], ["hero", "Held"], ["companion", "Gefährte"], ["enemy", "Gegner"]]
      .map(([r, n]) => `<button type="button" class="chip-f" data-rolle="${r}" aria-pressed="${filter.rolle === r}">${n}</button>`).join("");
  }
  function zeigeListe() {
    const treffer = eintraege().filter(passt);
    $("dbAnzahl").textContent = `${treffer.length} Einträge`;
    $("dbGrid").innerHTML = treffer.map(e => kachel(e)).join("") || `<p class="hint">Nichts gefunden. Filter lockern oder im Generator etwas würfeln.</p>`;
  }
  function alles() { zeigeFilter(); zeigeListe(); }

  // ---------- Generator ----------
  function wuerfeln() {
    const typ = $("genTyp").value;
    vorschlag = G.generiere(R, typ, { stufe: +$("genStufe").value, rolle: $("genRolle").value, tag: $("genTag").value || undefined,
      art: $("genArt").value || undefined, seed: Math.floor(Math.random() * 1e9) });
    vorschlag.id = "neu-" + Date.now();
    $("genOut").innerHTML = kachel(vorschlag, { neu: true });
  }
  function genFelder() {
    $("genArtRow").hidden = $("genTyp").value !== "waffe";
    $("genRolle").disabled = $("genTyp").value !== "faehigkeit";
  }

  // ---------- Selbst anlegen ----------
  const formTags = new Set();
  function formFelder() {
    const typ = $("dbTyp").value;
    $("dbWaffeRow").hidden = typ !== "waffe";
    $("dbIconRow").hidden = typ !== "fraktion";
    $("dbStaerkeRow").hidden = typ === "waffe" || typ === "fraktion";
    $("dbArtRow").hidden = typ !== "faehigkeit" && typ !== "gegenstand";
    $("dbFuerRow").hidden = typ === "fraktion";
    $("dbFormTags").innerHTML = KAT.TAGS.map(t => `<button type="button" class="chip-f" data-ftag="${t.id}" aria-pressed="${formTags.has(t.id)}">${ico(t.icon)}${esc(t.name)}</button>`).join("");
    preis();
  }
  function kostenAusFormular() {
    const typ = $("dbTyp").value;
    const st = KAT.STAERKEN.find(s => s.id === $("dbStaerke").value) || KAT.STAERKEN[1];
    const prozent = typ === "faehigkeit" && ["Sonderregel", "Passiv"].includes($("dbArt").value);
    return prozent ? { typ: "prozent", wert: st.prozent } : { typ: "fest", wert: st.fest };
  }
  function preis() {
    const typ = $("dbTyp").value;
    if (typ === "fraktion") { $("dbPreis").textContent = "Fraktionen kosten nichts, sie legen das Symbol auf der Karte fest."; return; }
    if (typ === "waffe") {
      const zeile = $("dbWaffe").value.trim();
      $("dbPreis").textContent = zeile ? `Fester Preis: ${G.waffenPreis(R, zeile)} Punkte (gemessen an einem Standard-Helden).` : "Format: Name | Reichweite | Attacken | Regeln";
      return;
    }
    const k = kostenAusFormular();
    $("dbPreis").textContent = k.typ === "fest" ? `Kostet fest ${k.wert} Punkte (klein 5, mittel 10, groß 15, elite 20).` : `Kostet ${k.wert} % Aufschlag auf die Formel, wächst also mit der Einheit.`;
  }
  async function anlegen(e) {
    e.preventDefault();
    const typ = $("dbTyp").value;
    const name = $("dbName").value.trim();
    const fuer = [["dbHero", "hero"], ["dbComp", "companion"], ["dbEnemy", "enemy"]].filter(([id]) => $(id).checked).map(([, r]) => r);
    const eintrag = { typ, name, fuer, tags: [...formTags], text: $("dbText").value.trim(), kosten: kostenAusFormular(),
      art: typ === "zauber" ? "Zauber" : typ === "waffe" ? "" : typ === "fraktion" ? "Fraktion" : $("dbArt").value };
    if (typ === "waffe") {
      const zeile = $("dbWaffe").value.trim();
      const w = R.leseWaffe(zeile.includes("|") ? zeile : `${name} | Nahkampf | A1 |`);
      eintrag.waffe = zeile.includes("|") ? zeile : `${name} | Nahkampf | A1 |`;
      eintrag.art = w.reichweite ? "Fernkampf" : "Nahkampf";
      eintrag.tags = [...new Set([...KAT.tagsFuerWaffe(w), ...formTags])];
      eintrag.kosten = { typ: "fest", wert: 0 };
      if (!eintrag.text) eintrag.text = [w.reichweite ? w.reichweite + '"' : "Nahkampf", "A" + w.a, w.regeln].filter(Boolean).join(", ");
    }
    if (typ === "fraktion") { eintrag.icon = $("dbIcon").value; eintrag.kosten = { typ: "fest", wert: 0 }; }
    try {
      const f = await KS.nimmAuf(eintrag);
      $("dbMsg").textContent = `${f.name} ist jetzt in der Datenbank.`;
      $("dbName").value = ""; $("dbText").value = ""; $("dbWaffe").value = ""; formTags.clear(); formFelder();
      KS.nachAenderung(); alles();
    } catch (err) { $("dbMsg").textContent = `Das hat nicht geklappt: ${err.message}.`; }
  }

  // ---------- Verdrahtung ----------
  function verdrahten() {
    $("genStufe").innerHTML = STUFEN.slice(1).map((s, i) => `<option value="${i + 1}" ${i === 2 ? "selected" : ""}>${s}</option>`).join("");
    $("genTag").innerHTML = `<option value="">Egal</option>` + KAT.TAGS.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
    const symbole = [...new Set(KAT.TAGS.map(t => t.icon).concat(KAT.FRAKTIONEN.map(f => f.icon), ["crown", "sword", "target"]))];
    $("dbIcon").innerHTML = symbole.map(s => `<option value="${s}">${s}</option>`).join("");
    $("dbSuche").addEventListener("input", e => { filter.q = e.target.value; zeigeListe(); });
    $("dbTypen").addEventListener("click", e => { const b = e.target.closest("[data-typ]"); if (!b) return; filter.typ = b.dataset.typ; alles(); });
    $("dbTags").addEventListener("click", e => { const b = e.target.closest("[data-tag]"); if (!b) return; const t = b.dataset.tag; if (filter.tags.has(t)) filter.tags.delete(t); else filter.tags.add(t); alles(); });
    $("dbRollen").addEventListener("click", e => { const b = e.target.closest("[data-rolle]"); if (!b) return; filter.rolle = b.dataset.rolle; alles(); });
    $("genTyp").addEventListener("change", genFelder);
    $("genForm").addEventListener("submit", e => { e.preventDefault(); wuerfeln(); });
    $("genOut").addEventListener("click", async e => {
      if (!vorschlag) return;
      if (e.target.closest("[data-neu-wuerfeln]")) wuerfeln();
      else if (e.target.closest("[data-vorschlag-karte]")) { const kf = KS.konfliktVon(vorschlag, KS.aktuelleKarte());
        $("genOut").insertAdjacentHTML("beforeend", kf ? `<p class="hint">${esc(KS.konfliktText(kf))}</p>` : (KS.aufKarte(vorschlag), `<p class="hint">✓ Auf »${esc(karteName())}« in der Werkstatt.</p>`)); }
      else if (e.target.closest("[data-aufnehmen]")) {
        const ohneId = { ...vorschlag };
        delete ohneId.id;
        const f = await KS.nimmAuf(ohneId);
        vorschlag = null; $("genOut").innerHTML = `<p class="hint">${esc(f.name)} ist jetzt in der Datenbank.</p>`; alles(); KS.nachAenderung();
      }
    });
    $("dbTyp").addEventListener("change", formFelder);
    ["dbStaerke", "dbArt"].forEach(id => $(id).addEventListener("change", preis));
    $("dbWaffe").addEventListener("input", preis);
    $("dbFormTags").addEventListener("click", e => { const b = e.target.closest("[data-ftag]"); if (!b) return; const t = b.dataset.ftag; if (formTags.has(t)) formTags.delete(t); else formTags.add(t); formFelder(); });
    $("dbForm").addEventListener("submit", anlegen);
    $("dbGrid").addEventListener("click", async e => {
      const o = e.target.closest("[data-oeffnen]"), k = e.target.closest("[data-karte]"), l = e.target.closest("[data-loeschen]");
      if (o) {
        const id = o.dataset.oeffnen;
        if (id.startsWith("v:")) { const v = KS.VORLAGEN.find(x => x.key === id.slice(2)); if (v) KS.oeffneInWerkstatt(v.d); }
        else {
          const r = await fetch(`/api/kartenschmiede/karten/${encodeURIComponent(id.slice(2))}`, { credentials: "same-origin" });
          if (r.ok) KS.oeffneInWerkstatt((await r.json()).inhalt);
        }
      } else if (k) {
        const f = KS.findeFaehigkeit(k.dataset.karte);
        if (f) {
          const kf = KS.konfliktVon(f, KS.aktuelleKarte());
          if (!kf && KS.aufKarte(f)) { k.textContent = "✓ Auf der Karte"; k.disabled = true; }
          else if (kf) { k.textContent = "🔒 Gesperrt"; k.disabled = true; k.dataset.tip = KS.konfliktText(kf); }
        }
      } else if (l) {
        if (l.dataset.sicher !== "1") { l.dataset.sicher = "1"; l.textContent = "Wirklich löschen?"; return; }
        await KS.loescheEigenen(l.dataset.loeschen); alles();
      }
    });
    genFelder(); formFelder();
  }

  window.KartenschmiedeDatenbank = {
    async zeigen() {
      if (!bereit) { bereit = true; verdrahten(); }
      if (KS.SERVER) {
        try { const r = await fetch("/api/kartenschmiede/karten", { credentials: "same-origin" }); if (r.ok) serverKarten = (await r.json()).karten || []; } catch { /* ohne */ }
      }
      alles();
    },
    neu() { if (bereit) alles(); },
  };
  if (!$("tabDb").hidden) window.KartenschmiedeDatenbank.zeigen();
})();

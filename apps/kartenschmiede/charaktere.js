/* Kartenschmiede – Tabelle „Fertige Charaktere“ unter dem Erstellen: Vorlagen und gespeicherte Karten mit allen
   Werten, sortier- und filterbar. Braucht window.KS (app.js). */
(function () {
  "use strict";
  const KS = window.KS;
  const { R, esc, ico, STUFEN, ROLLEN, TAG } = KS;
  const $ = id => document.getElementById(id);

  const sortierung = { spalte: "punkte", ab: true };

  function zeilen() {
    const vorlagen = KS.VORLAGEN.map(v => ({ quelle: "vorlage", key: v.key, d: v.d, bild: KS.IMG[v.d.art] || null, von: "Vorlage" }));
    const server = (KS.serverKarten() || []).map(k => ({ quelle: "server", id: k.id, bild: k.vorschau,
      von: k.gespeichertVon ? "von " + k.gespeichertVon : "gespeichert", d: { name: k.name, role: k.role, ...(k.werte || {}) } }));
    return vorlagen.concat(server).map(z => {
      const pts = R.punkte(z.d).pts;
      return { ...z, pts, stufe: R.stufeFuerPunkte(pts), waffen: R.leseWaffen(z.d.weapons), passiv: R.leseListe(z.d.passives),
        skills: Array.isArray(z.d.skills) ? z.d.skills : [], praegung: Array.isArray(z.d.praegung) ? z.d.praegung : [] };
    });
  }
  const zahl = x => parseInt(x, 10) || 0;
  const SCHLUESSEL = {
    name: z => (z.d.name || "").toLowerCase(), rolle: z => z.d.role || "enemy", stufe: z => z.stufe, punkte: z => z.pts,
    q: z => zahl(z.d.quality), v: z => zahl(z.d.defense), t: z => zahl(z.d.tough) * Math.max(1, zahl(z.d.size)),
  };

  function waffenZelle(w) {
    const regeln = R.regelnVon(w.regeln);
    const el = regeln.find(r => r.element);
    const kurz = [w.reichweite ? w.reichweite + '"' : "", "A" + w.a, w.ds ? "DS" + w.ds : ""].filter(Boolean).join(" ");
    const tip = `<b>${esc(w.name)}</b>${esc([w.reichweite ? `${w.reichweite}" Fernkampf` : "Nahkampf", "A" + w.a, w.regeln].filter(x => x && x !== "–").join(" · "))}`;
    return `<span class="w" data-tip="${esc(tip)}">${ico(w.reichweite ? "target" : "sword")}${esc(w.name)} <small>${esc(kurz)}</small>${el && TAG[el.element] ? KS.tagIco(el.element) : ""}</span>`;
  }

  function zeigen() {
    const tabelle = $("charaktere"); if (!tabelle) return;
    const q = ($("lSuche").value || "").trim().toLowerCase(), rolle = $("lRolle").value, quelle = $("lQuelle").value;
    const alle = zeilen();
    const treffer = alle.filter(z => (!rolle || (z.d.role || "enemy") === rolle) && (!quelle || z.quelle === quelle)
      && (!q || `${z.d.name} ${z.d.faction} ${z.d.weapons} ${z.d.passives} ${z.skills.map(k => k.name).join(" ")}`.toLowerCase().includes(q)));
    const f = SCHLUESSEL[sortierung.spalte];
    treffer.sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * (sortierung.ab ? -1 : 1); });
    const kopf = (key, text, cls = "") => `<th class="${cls}" ${key ? `data-sort="${key}" aria-sort="${sortierung.spalte === key ? (sortierung.ab ? "descending" : "ascending") : "none"}"` : ""}>${text}${sortierung.spalte === key ? (sortierung.ab ? " ▾" : " ▴") : ""}</th>`;
    tabelle.innerHTML = `<thead><tr>${kopf("", "")}${kopf("name", "Name")}${kopf("rolle", "Rolle")}${kopf("stufe", "Stufe")}${kopf("punkte", "Punkte", "num")}
      ${kopf("q", "Qual.", "num")}${kopf("v", "Vert.", "num")}${kopf("t", "Zäh", "num")}${kopf("", "Waffen")}${kopf("", "Fähigkeiten")}${kopf("", "")}</tr></thead>
      <tbody class="static">${treffer.map(z => {
        const fr = z.d.faction || "";
        return `<tr>
        <td><div class="th-bild" style="border-color:var(--t${z.stufe});${z.bild ? `background-image:url('${z.bild}')` : ""}"></div></td>
        <td class="name-z"><b>${esc(z.d.name || "Ohne Namen")}</b><small>${ico(KS.iconFuer(z.d))}${esc(fr)}${z.praegung.filter(t => TAG[t]).map(t => `<span data-tip="Prägung: ${esc(TAG[t].name)}">${KS.tagIco(t)}</span>`).join("")} · ${esc(z.von)}</small></td>
        <td>${esc(ROLLEN[z.d.role || "enemy"])}</td>
        <td><span class="tier-dot" style="background:var(--t${z.stufe})"></span>${esc(STUFEN[z.stufe])}</td>
        <td class="num"><b>${z.pts}</b></td>
        <td class="num">${esc(z.d.quality || "")}</td><td class="num">${esc(z.d.defense || "")}</td>
        <td class="num">${esc(z.d.tough || "")}${zahl(z.d.size) > 1 ? ` <small>×${zahl(z.d.size)}</small>` : ""}</td>
        <td class="waffen-z">${z.waffen.map(waffenZelle).join("")}</td>
        <td class="faeh-z">${z.skills.map(k => `<span class="s" data-tip="${esc(KS.tipText(k))}">${KS.tagIcons(k.tags, false)}${esc(k.name)}</span>`).join("")}${z.passiv.length ? `<small>${esc(z.passiv.join(", "))}</small>` : ""}</td>
        <td class="acts-z">${z.quelle === "vorlage" ? `<button type="button" class="btn ghost sm" data-vorlage="${esc(z.key)}">Öffnen</button>`
          : `<button type="button" class="btn ghost sm" data-load="${esc(z.id)}">Öffnen</button><button type="button" class="btn ghost sm" data-del="${esc(z.id)}">Löschen</button>`}</td>
      </tr>`; }).join("") || `<tr><td colspan="11" class="hint">Nichts gefunden.</td></tr>`}</tbody>`;
    const server = KS.serverKarten();
    $("lInfo").textContent = `${treffer.length} von ${alle.length} Charakteren.` + (KS.SERVER && server === null ? " Die gespeicherten Karten ließen sich nicht laden – bist du noch eingeloggt?" : "")
      + (KS.SERVER ? "" : " Gespeicherte Karten gibt es nur auf dem Olympiade-Server.");
  }

  $("charaktere").addEventListener("click", e => {
    const th = e.target.closest("th[data-sort]");
    if (th) { const k = th.dataset.sort; sortierung.ab = sortierung.spalte === k ? !sortierung.ab : k !== "name"; sortierung.spalte = k; zeigen(); return; }
    const v = e.target.closest("[data-vorlage]"), l = e.target.closest("[data-load]"), d = e.target.closest("[data-del]");
    if (v) KS.vorlageLaden(v.dataset.vorlage);
    if (l) KS.ladeKarte(l.dataset.load);
    if (d) KS.loescheKarte(d.dataset.del, d);
  });
  ["lSuche", "lRolle", "lQuelle"].forEach(id => $(id).addEventListener("input", zeigen));

  window.KartenschmiedeCharaktere = { zeigen };
  zeigen();
})();

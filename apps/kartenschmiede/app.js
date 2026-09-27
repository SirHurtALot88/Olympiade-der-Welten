/* Kartenschmiede – Oberfläche. Braucht regeln.js (globales „Regeln“) und html-to-image (globales „htmlToImage“).
   Läuft auf dem Olympiade-Server (dann mit Speichern) und als eigenständige Seite (dann nur im Browser). */
(function () {
  "use strict";
  const R = window.Regeln;
  const IMG = window.KARTENSCHMIEDE_BILDER || {};
  const SERVER = window.KARTENSCHMIEDE_SERVER === true;
  const STUFEN = R.STUFEN;
  const ROLLEN = { enemy: "Gegner", hero: "Held", companion: "Gefährte" };

  // ---------- Vorlagen: Chris' Einheiten aus „Age_of_Fantasy_Quest.xlsx“, Punkte wie dort eingetragen ----------
  const basis = { size: "1", role: "enemy", bossName: "", bossText: "", special: "0", ax: 50, ay: 40, zoom: 100, flavor: "", look: "", art: "" };
  const VORLAGEN = [
    { key: "frostfang", label: "Frostfang · Boss (Werwolf-Mini, Beispiel)", eigen: false, d: { ...basis,
      name: "Frostfang der Kettenbrecher", faction: "Wilde Jagd", ficon: "moon", points: 280, quality: "3+", defense: "4+", tough: "12",
      weapons: "Frostklauen | Nahkampf | A6 | DS(2), Reißend\nEisnacht-Heulen | 12\" | A1 | Explosion(3), Zuverlässig",
      passives: "Schnell, Furchtlos, Regeneration", special: "10",
      bossName: "Gebrochene Ketten", bossText: "Einmal pro Spiel: Fällt Frostfang unter die Hälfte seiner Lebenspunkte, aktiviert er sofort ein weiteres Mal.",
      flavor: "Die Kette hielt drei Winter. Im vierten hielt sie nichts mehr.",
      look: "a hulking werewolf with pale ice-blue fur on its back and shoulders, dark slate-blue skin, bone-white claws and fangs, broken iron shackles and chains hanging from its wrists, howling on frozen, snow-dusted ground",
      art: "werwolf", ax: 45, ay: 20 } },
    { key: "frostklauen", label: "Frostklauen-Pirscher (Werwolf-Mini)", eigen: true, d: { ...basis,
      name: "Frostklauen-Pirscher", faction: "Urwild", ficon: "paw", points: 90, quality: "3+", defense: "5+", tough: "5",
      weapons: "Frostklauen | Nahkampf | A4 | Reißend", passives: "Rasend, Hinterhalt, Geländeläufer",
      flavor: "Man hört die Ketten, bevor man die Klauen sieht.",
      look: "a lean, hunched werewolf with pale ice-blue fur, dark slate-blue skin, bone-white claws, broken chains on its wrists, stalking through snow",
      art: "werwolf", ax: 45, ay: 20 } },
    { key: "kristallwurm", label: "Kristallwurm", eigen: true, d: { ...basis, name: "Kristallwurm", faction: "Dämonen", ficon: "flame", points: 55, quality: "5+", defense: "4+", tough: "3",
      weapons: "Kristallbiss | Nahkampf | A3 | Reißend\nSplitterspucke | 18\" | A1 | DS(1), Explosion(2)", passives: "An Beschwörer gebunden",
      flavor: "Aus der Tiefe gerufen, lebende Waffen aus Fleisch und Kristall.",
      look: "a huge segmented worm with a glowing red rune on its head, a gaping maw of teeth, spitting violet crystal shards", art: "einheit1" } },
    { key: "kristallwurm-elite", label: "Kristallwurm-Elite", eigen: true, d: { ...basis, name: "Kristallwurm-Elite", faction: "Dämonen", ficon: "flame", points: 115, quality: "4+", defense: "4+", tough: "5",
      weapons: "Kristallbiss | Nahkampf | A4 | Reißend\nSplitterspucke | 18\" | A2 | DS(1), Explosion(2)", passives: "Geländeläufer, An Beschwörer gebunden", special: "5",
      bossName: "Kristallsplitter", bossText: "Erleidet dieses Modell eine Wunde, erleidet der Angreifer bei einer 6 ebenfalls 1 Schaden.",
      look: "a huge segmented worm armoured with violet crystal spikes, glowing red rune on its head, spitting crystal shards", art: "einheit2" } },
    { key: "dornauge", label: "Dornauge", eigen: true, d: { ...basis, name: "Dornauge", faction: "Dämonen", ficon: "flame", points: 65, quality: "5+", defense: "4+", tough: "3",
      weapons: "Rasierklauen | Nahkampf | A3 | Reißend\nDornenstoß | Nahkampf | A2 | DS(1), Explosion(3)", passives: "",
      flavor: "Ein Geschwür aus Kristall und Dornen, das alles anstarrt.",
      look: "a spiky crystalline creature made of one giant staring eye, violet thorns and clawed legs, erupting from rocky ground", art: "einheit3" } },
    { key: "dornauge-alpha", label: "Dornauge-Alpha", eigen: true, d: { ...basis, name: "Dornauge-Alpha", faction: "Dämonen", ficon: "flame", points: 120, quality: "4+", defense: "4+", tough: "5",
      weapons: "Rasierklauen | Nahkampf | A4 | Reißend\nGiftnadeln | 12\" | A3 | Gift\nDornenstoß | Nahkampf | A2 | DS(1), Explosion(3)", passives: "Geländeläufer",
      look: "a larger spiky crystalline creature with one giant eye, violet and green thorns, firing poison needles", art: "einheit4" } },
    { key: "giftmade", label: "Giftmade", eigen: true, d: { ...basis, name: "Giftmade", faction: "Urwild", ficon: "paw", points: 30, quality: "5+", defense: "6+", tough: "3",
      weapons: "Ätzender Biss | Nahkampf | A2 | Gift\nGiftspeichel | 12\" | A2 | Gift", passives: "Langsam",
      flavor: "Ein Parasit, geboren aus Schlamm und Hunger.", look: "a pale yellow-green grub with two curved horns, vomiting a jet of glowing green venom", art: "einheit5" } },
    { key: "saeurelauerer", label: "Säurelauerer", eigen: true, d: { ...basis, name: "Säurelauerer", faction: "Urwild", ficon: "paw", points: 70, quality: "4+", defense: "5+", tough: "3",
      weapons: "Giftspeichel | 12\" | A3 | Gift", passives: "Langsam, Hinterhalt", special: "5",
      bossName: "Säureblut", bossText: "Erleidet dieses Modell eine Wunde, erhält der Angreifer bei 5+ einen Treffer.",
      look: "a bloated horned grub with a huge toothed maw, spraying acid", art: "einheit6" } },
    { key: "sporenhuelle", label: "Sporenhülle", eigen: true, d: { ...basis, name: "Sporenhülle", faction: "Urwild", ficon: "paw", points: 55, quality: "5+", defense: "4+", tough: "4",
      weapons: "Sporenstoß | 9\" | A2 | Gift", passives: "Langsam, Furchtlos",
      flavor: "Die Sporen fressen, das Fleisch fault, doch sie fällt nie.",
      look: "a bloated, moss-green fungal brute with mushroom caps growing from its head and shoulders, a dark brown beard, glowing toxic-green spores dripping from its mouth and belly, iron chains on its back",
      art: "einheit7", ay: 30 } },
    { key: "sporenhuelle-mini", label: "Sporenhülle (Foto der Mini)", eigen: false, d: { ...basis, name: "Sporenhülle", faction: "Urwild", ficon: "paw", points: 55, quality: "5+", defense: "4+", tough: "4",
      weapons: "Sporenstoß | 9\" | A2 | Gift", passives: "Langsam, Furchtlos",
      flavor: "Die Sporen fressen, das Fleisch fault, doch sie fällt nie.",
      look: "a bloated, moss-green fungal brute with mushroom caps growing from its head and shoulders, a dark brown beard, glowing toxic-green spores dripping from its mouth and belly, iron chains on its back",
      art: "sporenhuelle", ay: 25 } },
    { key: "seuchenbringer", label: "Myzel-Seuchenbringer", eigen: true, d: { ...basis, name: "Myzel-Seuchenbringer", faction: "Urwild", ficon: "paw", points: 130, quality: "4+", defense: "3+", tough: "6",
      weapons: "Dornenklauen | Nahkampf | A3 | DS(1), Reißend\nDornenstoß | 6\" | A2 | DS(1), Explosion(3)", passives: "Langsam, Furchtlos", special: "20",
      bossName: "Strahlende Aura 6\"", bossText: "Feinde innerhalb von 6\" erleiden am Ende jeder Runde einen automatischen Treffer mit DS(1).",
      look: "a hulking fungal brute covered in mushroom caps and spines, glowing yellow-green belly, radioactive spores", art: "einheit8", ay: 30 } },
    { key: "schurke", label: "Held: Schurke", eigen: true, d: { ...basis, role: "hero", name: "Schurke", faction: "Helden", ficon: "shield", points: 100, quality: "4+", defense: "5+", tough: "5",
      weapons: "Krummklingen | Nahkampf | A4 | Reißend\nWurfmesser | 6\" | A1 |", passives: "Tarnung",
      bossName: "Schattenschritt · Schwachstelle", bossText: "Skill, 1 Power: 4\" in Deckung bewegen. Skill, 1 Power: Nahkampfangriffe gegen einen Feind erhalten DS(1)." } },
    { key: "krieger", label: "Held: Krieger", eigen: true, d: { ...basis, role: "hero", name: "Krieger", faction: "Helden", ficon: "shield", points: 100, quality: "4+", defense: "3+", tough: "7",
      weapons: "Schwert und Schild | Nahkampf | A3 |\nSchildstoß | Nahkampf | A1 |", passives: "Furchtlos",
      bossName: "Die Reihe halten · Schildstoß", bossText: "Skill, 1 Power: Feinde in 3\" erhalten −1 auf Treffer gegen Verbündete. Skill, 1 Power: 1 Treffer und 2\" zurückstoßen." } },
    { key: "waldlaeufer", label: "Held: Waldläufer", eigen: true, d: { ...basis, role: "hero", name: "Waldläufer", faction: "Helden", ficon: "shield", points: 100, quality: "4+", defense: "5+", tough: "5",
      weapons: "Jagdbogen | 18\" | A3 |\nJagdmesser | Nahkampf | A2 |", passives: "Späher",
      bossName: "Beute markieren · Schlingenfalle", bossText: "Skill, 1 Power: Der nächste verbündete Angriff erhält +1 auf Treffer. Skill, 1 Power: Eine Falle legen." } },
    { key: "kleriker", label: "Held: Kleriker", eigen: true, d: { ...basis, role: "hero", name: "Kleriker", faction: "Helden", ficon: "shield", points: 100, quality: "4+", defense: "4+", tough: "5",
      weapons: "Geweihter Speer | Nahkampf | A2 | DS(1)\nHeiliger Blitz | 12\" | A2 |", passives: "Gleiten",
      bossName: "Wunden heilen · Strahlender Schutz", bossText: "Skill, 1 Power: Ein Verbündeter in 6\" heilt W3 Wunden. Skill, 1 Power: +1 Verteidigung für einen Verbündeten." } },
  ];

  const NOTIZEN = {
    1: "<b>Gewöhnlich, grau:</b> schlichter Eisenrahmen, keine Ornamente. Fußvolk bleibt ruhig, damit die starken Karten auffallen.",
    2: "<b>Selten, grün:</b> doppelte Innenlinie, abgeschrägtes Punkteschild.",
    3: "<b>Magisch, blau:</b> stahlblaues Metall, doppelte Linie, kleine Eckbeschläge, leuchtender Name.",
    4: "<b>Elite, gelb:</b> Messing mit Glanzverlauf, große Eckbeschläge, Wappenschild für die Punkte.",
    5: "<b>Legendär, Diablo-Orange:</b> glühende Bronze, Filigran-Ecken, Edelstein oben, Holo-Folie und ein Lichtstreif über die Karte.",
    6: "<b>Boss, rot:</b> blutroter Rahmen mit Goldbeschlägen, Hörnerkrone, Boss-Banner, Frakturschrift, glühender Kranz und Funkenflug.",
  };
  const STIMMUNG = {
    1: "unremarkable grunt of its kind, eye-level camera, quiet low light, simple dark background",
    2: "a tougher specimen, eye-level camera, faint green-tinted rim light",
    3: "a creature touched by magic, slightly low camera, cool blue rim light, a few glowing particles",
    4: "confident, threatening stance, low camera, warm golden key light and a brighter glowing accent",
    5: "powerful and dangerous, low camera angle, strong orange backlight glow behind it, sparks drifting in the air",
    6: "overwhelming boss presence, very low camera angle looking up, deep red and orange glow behind it, embers and ash in the air, the creature fills the frame and the viewer should feel small",
  };
  // Stil wie die Olympiade-Bilder: Filmstill, dunkel, warmes Licht, genau ein leuchtender Sci-Fi-Akzent
  const STIL = "photorealistic cinematic film still from a dark fantasy movie with a subtle science-fiction edge. Real creature with practical-effects texture (skin, scales, fur, cloth, metal all physically real), shot on a full-frame cinema camera with an 85mm lens, shallow depth of field, softly blurred background, dark and moody low-key lighting, warm practical light from lanterns, candles or embers, plus exactly one glowing accent (runes, energy veins, lava cracks or tech inlays) that hints at sci-fi, haze and floating dust in the air, rich detail, natural colour grade, no over-sharpening.";

  // ---------- Hilfen ----------
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const zahl = (x, d = 1) => x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  const prozent = x => Math.round(x * 100) + " %";
  const GOLD = $("g-gold").outerHTML;
  const sym = (id, cls = "", style = "") => {
    const s = document.getElementById(id);
    const inner = s.innerHTML.includes("g-gold") ? `<defs>${GOLD}</defs>${s.innerHTML}` : s.innerHTML;
    return `<svg class="${cls}" style="${style}" viewBox="${s.getAttribute("viewBox")}" aria-hidden="true">${inner}</svg>`;
  };
  const ico = (id, cls = "") => sym("i-" + id, cls);
  const SYMBOLE = [
    [/langsam|slow/i, "boot"], [/schnell|fast|flink|fliegen|gleiten/i, "wing"], [/furchtlos|fearless|furcht|fear/i, "skull"],
    [/regener/i, "heart"], [/hinterhalt|ambush|tarn|stealth|späh|scout/i, "eye"], [/gift|poison|seuche/i, "drop"],
    [/held|hero|schild|shield|rüstung/i, "shield"], [/feuer|fire|brand|rasend/i, "flame"],
  ];
  const symbolFuer = s => (SYMBOLE.find(([re]) => re.test(s)) || [0, "rune"])[1];

  let state = {};
  const SPEICHER = "kartenschmiede-v3";
  const merke = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(state)); } catch { /* voll oder gesperrt */ } };
  const lade = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch { return null; } };

  // ---------- Karte ----------
  function renderCard(s, tier, opts = {}) {
    const land = opts.land;
    const waffen = R.leseWaffen(s.weapons);
    const passiv = R.leseListe(s.passives);
    const src = s.art === "upload" ? s.upload : IMG[s.art];
    const funken = Array.from({ length: 16 }, (_, i) => {
      const r = n => (Math.sin(i * 91.7 + n * 13.1) + 1) / 2;
      return `<i style="left:${(r(1) * 96).toFixed(1)}%;--d:${(4 + r(2) * 5).toFixed(2)}s;--dl:${(-r(3) * 8).toFixed(2)}s;--dx:${((r(4) - .5) * 14).toFixed(1)}cqw;bottom:${(r(5) * 30 - 4).toFixed(1)}%"></i>`;
    }).join("");
    const rolle = s.role === "hero" ? " · Held" : s.role === "companion" ? " · Gefährte" : "";
    const sonder = s.bossName || s.bossText;
    return `
    <div class="cw${opts.snap ? " snap" : ""}">
      <article class="card t${tier}${land ? " land" : ""}" aria-label="${esc(s.name)}, ${esc(STUFEN[tier])}">
        <div class="halo"></div>
        <div class="face">
          <div class="art" style="--ax:${s.ax}%;--ay:${s.ay}%;--zoom:${(s.zoom || 100) / 100}">
            ${src ? `<img src="${src}" alt="">` : `<div class="noart">Artwork hochladen</div>`}
            <div class="vign"></div>
          </div>
          <div class="foil"></div>
          <div class="embers">${funken}</div>
          <div class="sheen"></div>
          <div class="ribbon">Boss</div>
          <div class="head">
            <div class="name">${esc(s.name)}</div>
            <div class="subline"><span class="pips">${[1, 2, 3, 4, 5, 6].map(n => `<span class="pip${n <= tier ? " on" : ""}"></span>`).join("")}</span>${esc(STUFEN[tier] + rolle)}</div>
          </div>
          <div class="gap" style="grid-area:gap"></div>
          <div class="panel">
            <div class="stats">
              <div class="stat"><span>Modelle</span><b>${esc(s.size)}</b></div>
              <div class="stat"><span>Qualität</span><b>${esc(s.quality)}</b></div>
              <div class="stat"><span>Verteid.</span><b>${esc(s.defense)}</b></div>
              <div class="stat"><span>Zäh</span><b>${esc(s.tough)}</b></div>
            </div>
            ${waffen.length ? `<div class="weps"><div class="block-t">Waffen</div>${waffen.map(w => {
              const nah = w.reichweite === 0;
              const regeln = w.regeln && w.regeln !== "–" && w.regeln !== "-" ? w.regeln : "";
              const unter = [nah ? "" : w.reichweite + '"', "A" + w.a, regeln].filter(Boolean).join(", ");
              return `<div class="wep">${ico(nah ? "sword" : "target")}<div><h4>${esc(w.name)}</h4><p>${esc(unter)}</p></div><span class="tag">${nah ? "Nahkampf" : "Fernkampf"}</span></div>`;
            }).join("")}</div>` : ""}
            ${passiv.length ? `<div class="chips">${passiv.map(p => `<span class="chip">${ico(symbolFuer(p))}${esc(p)}</span>`).join("")}</div>` : ""}
            ${sonder ? `<div class="boss"><h4>${ico(tier === 6 ? "crown" : "rune")}${tier === 6 ? "Boss-Fähigkeit" : "Sonderregel"}${s.bossName ? " · " + esc(s.bossName) : ""}</h4>${s.bossText ? `<p>${esc(s.bossText)}</p>` : ""}</div>` : ""}
            <div class="foot"><span class="fac">${ico(s.ficon || "paw")}${esc(s.faction)}</span>${s.flavor ? `<q>${esc(s.flavor)}</q>` : "<span></span>"}</div>
          </div>
        </div>
        <div class="badge">${sym("i-crown", "crown")}<b>${esc(s.points)}</b><span>Punkte</span></div>
        ${tier >= 3 ? ["tl", "tr", "bl", "br"].map(c => sym(tier === 6 ? "c-crown" : tier === 5 ? "c-filigree" : "c-bracket", "corner " + c)).join("") : ""}
        ${tier === 6 ? sym("i-horns", "crest", "width:34%;height:auto;top:calc(var(--u)*-7)")
          : tier === 5 ? sym("i-gem", "crest", "width:18%;height:auto;top:calc(var(--u)*-4.6)") : ""}
      </article>
    </div>`;
  }
  // Text schrumpfen, bis alles auf die Karte passt
  function passeAn(root) {
    root.querySelectorAll(".card").forEach(card => {
      const face = card.querySelector(".face");
      let k = 1;
      card.style.setProperty("--k", k);
      while (k > 0.62 && face.scrollHeight > face.clientHeight + 1) { k -= 0.04; card.style.setProperty("--k", k.toFixed(2)); }
    });
  }

  // ---------- Formular ----------
  const FELDER = ["name", "faction", "ficon", "points", "size", "quality", "defense", "tough", "role", "weapons", "passives", "bossName", "bossText", "special", "flavor", "look", "ax", "ay", "zoom"];
  function insFormular() {
    FELDER.forEach(f => { const el = $(f); if (el) el.value = state[f] ?? ""; });
    if (!["0", "5", "10", "20"].includes(String(state.special))) $("special").value = "0";
    if (!state.role) $("role").value = "enemy";
    $("autoTier").checked = state.autoTier !== false;
    document.querySelectorAll("#tiers button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.t === state.tier)));
    document.querySelectorAll(".toolbar .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.o === (state.orient || "port"))));
  }

  function zeigeRechnung() {
    const c = R.punkte(state), p = +state.points || 0;
    const abw = p ? (p - c.pts) / c.pts : 0;
    const cls = Math.abs(abw) <= .15 ? "ok" : abw > 0 ? "lo" : "hi";
    $("calc").innerHTML = `
      <div class="big"><b>${c.pts}</b><span>Punkte nach Formel · Stufe ${STUFEN[R.stufeFuerPunkte(c.pts)]}</span></div>
      <div class="parts">Kampfwert ${zahl(c.K, 2)} · Ausdauer ${zahl(c.A)} · Boni ${c.b >= 0 ? "+" : ""}${Math.round(c.b * 100)} %${c.fest ? ` · fest +${c.fest}` : ""}</div>
      <div class="row-b">${p && p !== c.pts ? `<span class="dev ${cls}">Eingetragen ${p}, ${abw > 0 ? "+" : ""}${Math.round(abw * 100)} %</span>` : `<span class="dev ok">Punkte passen zur Formel</span>`}
      ${p !== c.pts ? `<button type="button" class="btn ghost sm" id="applyPts">Formelwert übernehmen</button>` : ""}</div>`;
    const b = $("applyPts");
    if (b) b.addEventListener("click", () => { state.points = c.pts; bModell = null; insFormular(); alles(); });
  }

  function bestiarium() {
    $("bestiary").innerHTML = VORLAGEN.filter(v => v.eigen).map(v => {
      const c = R.punkte(v.d), abw = (v.d.points - c.pts) / c.pts, t = R.stufeFuerPunkte(c.pts);
      const cls = Math.abs(abw) <= .15 ? "ok" : abw > 0 ? "lo" : "hi";
      return `<tr data-key="${v.key}" tabindex="0"><td>${esc(v.d.name)}</td><td class="num">${v.d.points}</td><td class="num">${c.pts}</td>
        <td class="num"><span class="dev ${cls}">${abw > 0 ? "+" : ""}${Math.round(abw * 100)} %</span></td>
        <td><span class="tier-dot" style="background:var(--t${t})"></span>${STUFEN[t]}</td></tr>`;
    }).join("");
  }

  function prompt() {
    const s = state;
    return [
      `Turn the attached photo of my hand-painted tabletop miniature into a photorealistic cinematic film still of this creature as a real, living being. Keep its pose, silhouette, proportions, colour scheme and distinctive details (weapons, chains, armour, the ground of its base) clearly recognisable.`,
      ``,
      `Subject: ${s.name || "the creature"}${s.faction ? ` of the ${s.faction}` : ""}. ${s.look || ""}`.trim(),
      ``,
      `Mood: ${STIMMUNG[s.tier]}.`,
      ``,
      `Style anchor (identical for every card in the set): ${STIL}`,
      ``,
      `Composition: ${s.orient === "land" ? "landscape 7:5, creature on the right half, left half darker and calm so text can sit on top" : "portrait 5:7, creature fills the upper two thirds, lower third darker and calm so text can sit on top"}.`,
      ``,
      `Avoid: painterly or illustrated look, plastic or toy look, cluttered background, spaceships or cities in the sky, oversaturated colours. No lettering, numbers, logos, card frame, border or user interface. Only the image.`,
    ].join("\n");
  }

  function neigen() {
    const cw = $("stage").querySelector(".cw");
    const card = cw && cw.querySelector(".card");
    if (!card || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cw.addEventListener("pointermove", e => {
      const r = cw.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cw.style.transform = `rotateY(${((x - .5) * 14).toFixed(2)}deg) rotateX(${(-(y - .5) * 12).toFixed(2)}deg)`;
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    });
    cw.addEventListener("pointerleave", () => { cw.style.transform = ""; });
  }

  function alles() {
    if (state.autoTier !== false) state.tier = R.stufeFuerPunkte(+state.points || 0);
    state.tier = Math.min(6, Math.max(1, state.tier || 1));
    document.querySelectorAll("#tiers button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.t === state.tier)));
    zeigeRechnung();
    const land = state.orient === "land";
    const stage = $("stage");
    stage.classList.toggle("land", land);
    stage.innerHTML = renderCard(state, state.tier, { land });
    $("ladder").innerHTML = [1, 2, 3, 4, 5, 6].map(t => `
      <button type="button" class="rung" data-t="${t}" aria-pressed="${t === state.tier}">
        ${renderCard(state, t, {})}
        <span class="rung-label" style="color:var(--t${t})">${STUFEN[t]}<small>${R.GRENZEN_TEXT[t]} P.</small></span>
      </button>`).join("");
    requestAnimationFrame(() => { passeAn(stage); passeAn($("ladder")); });
    $("suggest").textContent = `${state.points || 0} Punkte ergeben: ${STUFEN[R.stufeFuerPunkte(+state.points || 0)]}. Staffel: ${R.GRENZEN_TEXT.slice(1).join(" · ")}.`;
    $("tierNote").innerHTML = NOTIZEN[state.tier];
    $("prompt").value = prompt();
    baukasten();
    neigen();
    merke();
  }

  function vorlage(key) {
    const v = VORLAGEN.find(x => x.key === key) || VORLAGEN[0];
    state = Object.assign({ orient: state.orient || "port", upload: null, autoTier: true }, JSON.parse(JSON.stringify(v.d)));
    $("preset").value = v.key;
    bModell = null;
    insFormular(); alles();
  }

  // ---------- Baukasten ----------
  const FAEH = [
    ["gelaendelaeufer", "Geländeläufer"], ["spaeher", "Späher"], ["tarnung", "Tarnung"], ["fliegen", "Fliegen"],
    ["furchtlos", "Furchtlos"], ["rasend", "Rasend"], ["schnell", "Schnell"], ["hinterhalt", "Hinterhalt"],
    ["wucht", "Wucht(3)"], ["furcht", "Furcht(3)"], ["ausweichen", "Ausweichen"], ["regeneration", "Regeneration"],
    ["zauberer", "Zauberer(2)"], ["langsam", "Langsam"],
  ];
  const faehSchluessel = p => {
    const t = p.toLowerCase();
    const map = [[/geländel|gelaendel|strider/, "gelaendelaeufer"], [/späher|spaeher|scout/, "spaeher"], [/tarnung|stealth/, "tarnung"],
      [/^(fliegen|flying)$/, "fliegen"], [/furchtlos|fearless/, "furchtlos"], [/rasend|furious/, "rasend"], [/^(schnell|fast)$/, "schnell"],
      [/hinterhalt|ambush/, "hinterhalt"], [/^(wucht|impact)\s*\(3\)$/, "wucht"], [/^(furcht|fear)\s*\(3\)$/, "furcht"],
      [/ausweich|evasive/, "ausweichen"], [/regenerat/, "regeneration"], [/^(zauberer|caster)\s*\(2\)$/, "zauberer"], [/^(langsam|slow)$/, "langsam"]];
    const m = map.find(([re]) => re.test(t)); return m ? m[1] : null;
  };
  const REICHWEITEN = [0, 6, 9, 12, 18, 24, 30];

  function modellAus(s) {
    const waffen = R.leseWaffen(s.weapons).map(w => ({
      name: w.name, reichweite: w.reichweite, a: w.a || 1, ds: w.ds, reissend: w.reissend, gift: w.gift,
      explosion: w.explosion, toedlich: w.toedlich, zuverlaessig: w.zuverlaessig,
      rest: R.leseListe(w.regeln).filter(x => x !== "–" && !/^(DS|AP)\s*\(\d\)$|reißend|reissend|rending|gift|poison|bane|explosion|blast|tödlich|toedlich|deadly|zuverlässig|zuverlaessig|reliable/i.test(x)),
    }));
    const faeh = new Set(), rest = [];
    R.leseListe(s.passives).forEach(p => { const k = faehSchluessel(p); if (k) faeh.add(k); else rest.push(p); });
    return { rolle: s.role || "enemy", budget: +s.budget || 100,
      q: parseInt(s.quality, 10) || 5, d: parseInt(s.defense, 10) || 5, t: parseInt(s.tough, 10) || 1, n: parseInt(s.size, 10) || 1,
      waffen: waffen.length ? waffen : [{ name: "Handwaffe", reichweite: 0, a: 1, ds: 0, rest: [] }], faeh, rest, special: s.special || "0" };
  }
  function schreibeModell(m, s) {
    s.role = m.rolle; s.budget = m.budget;
    s.quality = m.q + "+"; s.defense = m.d + "+"; s.tough = String(m.t); s.size = String(m.n);
    s.weapons = m.waffen.map(w => {
      const regeln = [w.ds && `DS(${w.ds})`, w.reissend && "Reißend", w.gift && "Gift", w.explosion && `Explosion(${w.explosion})`,
        w.toedlich && `Tödlich(${w.toedlich})`, w.zuverlaessig && "Zuverlässig", ...(w.rest || [])].filter(Boolean).join(", ");
      return `${w.name} | ${w.reichweite ? w.reichweite + '"' : "Nahkampf"} | A${w.a} | ${regeln}`;
    }).join("\n");
    s.passives = [...FAEH.filter(([k]) => m.faeh.has(k)).map(([, n]) => n), ...m.rest].join(", ");
    s.special = m.rolle === "hero" ? "0" : m.special;
    s.points = R.punkte(s).pts;
    return s;
  }
  const kopie = m => ({ ...m, faeh: new Set(m.faeh), rest: [...m.rest], waffen: m.waffen.map(w => ({ ...w, rest: [...(w.rest || [])] })) });
  const rohVon = m => R.punkte(schreibeModell(m, {})).roh;
  const kostet = (m, fn) => { const n = kopie(m); if (fn(n) === false) return null; return Math.round(rohVon(n) - rohVon(m)); };
  const preis = d => d === null ? "" : `<span class="cost ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</span>`;

  let bModell = null;
  function baukasten() {
    if (!bModell) bModell = modellAus(state);
    const m = bModell, held = m.rolle === "hero";
    const ausgegeben = Math.round(rohVon(m)), rest = m.budget - ausgegeben;
    const geht = d => !held || d === null || d <= 0 || d <= rest;
    const stufe = (id, label, wert, runter, rauf, hinweis = "") => {
      const dm = kostet(m, runter), dp = kostet(m, rauf);
      return `<div class="stp"><div class="stp-l"><b>${label}</b>${hinweis ? `<small>${hinweis}</small>` : ""}</div>
        <button type="button" data-act="${id}:-" ${dm === null ? "disabled" : ""} aria-label="${label} verringern">−${preis(dm)}</button>
        <output>${wert}</output>
        <button type="button" data-act="${id}:+" ${dp === null || !geht(dp) ? "disabled" : ""} aria-label="${label} erhöhen">+${preis(dp)}</button></div>`;
    };
    let html = `<div class="b-group"><h4>Grundwerte</h4>
      ${stufe("q", "Qualität", m.q + "+", x => x.q < 6 ? (x.q++, true) : false, x => x.q > 2 ? (x.q--, true) : false, "trifft auf diesen Wurf")}
      ${stufe("d", "Verteidigung", m.d + "+", x => x.d < 6 ? (x.d++, true) : false, x => x.d > 2 ? (x.d--, true) : false, "rettet auf diesen Wurf")}
      ${stufe("t", "Zäh", m.t, x => x.t > 1 ? (x.t--, true) : false, x => x.t < 72 ? (x.t++, true) : false, "Lebenspunkte je Modell")}
      ${held ? "" : stufe("n", "Modelle", m.n, x => x.n > 1 ? (x.n--, true) : false, x => x.n < 10 ? (x.n++, true) : false, "Größe der Einheit")}
    </div>`;
    m.waffen.forEach((w, i) => {
      const schalter = (k, label, wert) => {
        const d = kostet(m, x => { x.waffen[i][k] = x.waffen[i][k] ? 0 : wert; });
        return `<button type="button" class="tgl" data-act="w${i}${k}" aria-pressed="${!!w[k]}" ${!w[k] && !geht(d) ? "disabled" : ""}>${label}${preis(d)}</button>`;
      };
      html += `<div class="b-group"><h4><input type="text" class="wname" data-w="${i}" value="${esc(w.name)}" aria-label="Name der Waffe ${i + 1}">
        ${m.waffen.length > 1 ? `<button type="button" class="x" data-act="w${i}del">entfernen</button>` : ""}</h4>
        ${stufe(`w${i}a`, "Attacken", "A" + w.a, x => x.waffen[i].a > 1 ? (x.waffen[i].a--, true) : false, x => x.waffen[i].a < 36 ? (x.waffen[i].a++, true) : false)}
        ${stufe(`w${i}r`, "Reichweite", w.reichweite ? w.reichweite + '"' : "Nahkampf",
          x => { const k = REICHWEITEN.indexOf(x.waffen[i].reichweite); if (k <= 0) return false; x.waffen[i].reichweite = REICHWEITEN[k - 1]; },
          x => { const k = REICHWEITEN.indexOf(x.waffen[i].reichweite); if (k < 0 || k >= REICHWEITEN.length - 1) return false; x.waffen[i].reichweite = REICHWEITEN[k + 1]; })}
        ${stufe(`w${i}ds`, "Durchschlag", "DS(" + w.ds + ")", x => x.waffen[i].ds > 0 ? (x.waffen[i].ds--, true) : false, x => x.waffen[i].ds < 4 ? (x.waffen[i].ds++, true) : false)}
        <div class="tgls">${schalter("reissend", "Reißend", 1)}${schalter("gift", "Gift", 1)}${schalter("explosion", "Explosion(3)", 3)}
          ${schalter("toedlich", "Tödlich(3)", 3)}${schalter("zuverlaessig", "Zuverlässig", 1)}</div>
      </div>`;
    });
    const neu = kostet(m, x => { x.waffen.push({ name: "Neue Waffe", reichweite: 0, a: 1, ds: 0, rest: [] }); });
    html += m.waffen.length < 3 ? `<button type="button" class="btn ghost sm" data-act="wadd" ${!geht(neu) ? "disabled" : ""}>Waffe hinzufügen ${preis(neu)}</button>` : "";
    html += `<div class="b-group"><h4>Fähigkeiten</h4><div class="tgls">${FAEH.map(([k, n]) => {
      const an = m.faeh.has(k); const d = kostet(m, x => { if (an) x.faeh.delete(k); else x.faeh.add(k); });
      return `<button type="button" class="tgl" data-act="ab:${k}" aria-pressed="${an}" ${!an && !geht(d) ? "disabled" : ""}>${n}${preis(d)}</button>`;
    }).join("")}</div>${m.rest.length ? `<p class="hint">Eigene Regeln bleiben erhalten: ${esc(m.rest.join(", "))}</p>` : ""}</div>`;
    $("bControls").innerHTML = html;

    document.querySelectorAll("#bRole button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.r === m.rolle)));
    $("bBudgetRow").hidden = !held;
    $("bBudget").value = m.budget;
    $("bElite").disabled = m.rolle !== "enemy";
    const pts = R.punkte(state).pts, t = R.stufeFuerPunkte(pts);
    if (held) {
      const anteil = Math.max(0, Math.min(100, ausgegeben / m.budget * 100));
      $("bSum").innerHTML = `<div class="meter" role="img" aria-label="${ausgegeben} von ${m.budget} Punkten verteilt"><i style="width:${anteil}%"></i></div>
        <div class="sum-line"><b>${ausgegeben}</b> von ${m.budget} Punkten verteilt · <b>${rest}</b> übrig</div>
        <p class="hint">Darin enthalten: 25 Punkte für die drei Quest-Skills des Helden.</p>`;
    } else {
      $("bSum").innerHTML = `<div class="sum-line"><b>${pts}</b> Punkte · Stufe <span style="color:var(--t${t})">${STUFEN[t]}</span></div>
        <p class="hint">${m.rolle === "companion"
          ? "Gefährten zählen zu den Gruppenpunkten. Freigeschaltet, wenn die Gruppe die Elite-Version dieser Gegnerart besiegt hat. Keine Power, keine Skills, keine XP, höchstens einer je Held."
          : "Gegner haben kein Limit. Jede Verbesserung kostet umso mehr, je stärker die Einheit schon ist: Angriff wird teurer, wenn sie viel aushält, und umgekehrt."}</p>`;
    }
    $("bCard").innerHTML = renderCard(state, state.tier, {});
    requestAnimationFrame(() => passeAn($("bCard")));
  }
  function modellUebernehmen() { schreibeModell(bModell, state); insFormular(); alles(); }
  function aktion(act) {
    const m = bModell;
    const [id, dir] = act.split(":");
    const schritte = {
      q: [x => x.q < 6 && x.q++, x => x.q > 2 && x.q--], d: [x => x.d < 6 && x.d++, x => x.d > 2 && x.d--],
      t: [x => x.t > 1 && x.t--, x => x.t < 72 && x.t++], n: [x => x.n > 1 && x.n--, x => x.n < 10 && x.n++],
    };
    if (schritte[id]) schritte[id][dir === "+" ? 1 : 0](m);
    else if (id === "ab") { if (m.faeh.has(dir)) m.faeh.delete(dir); else m.faeh.add(dir); }
    else if (id === "wadd") m.waffen.push({ name: "Neue Waffe", reichweite: 0, a: 1, ds: 0, rest: [] });
    else {
      const mm = id.match(/^w(\d)(.+)$/); if (!mm) return;
      const w = m.waffen[+mm[1]], k = mm[2];
      if (k === "a") w.a = Math.max(1, Math.min(36, w.a + (dir === "+" ? 1 : -1)));
      else if (k === "ds") w.ds = Math.max(0, Math.min(4, w.ds + (dir === "+" ? 1 : -1)));
      else if (k === "r") { const i = REICHWEITEN.indexOf(w.reichweite); w.reichweite = REICHWEITEN[Math.max(0, Math.min(REICHWEITEN.length - 1, i + (dir === "+" ? 1 : -1)))]; }
      else if (k === "del") m.waffen.splice(+mm[1], 1);
      else if (k === "explosion" || k === "toedlich") w[k] = w[k] ? 0 : 3;
      else w[k] = !w[k];
    }
    modellUebernehmen();
  }
  function frisch(rolle) {
    state = Object.assign({}, state, { id: undefined, name: rolle === "hero" ? "Neuer Held" : "Neuer Gegner", faction: rolle === "hero" ? "Helden" : state.faction,
      ficon: rolle === "hero" ? "shield" : state.ficon, bossName: "", bossText: "", flavor: "", look: "", art: "", upload: null, autoTier: true });
    bModell = { rolle, budget: +state.budget || 100, q: 5, d: 6, t: rolle === "hero" ? 3 : 1, n: 1,
      waffen: [{ name: "Handwaffe", reichweite: 0, a: 1, ds: 0, rest: [] }], faeh: new Set(), rest: [], special: "0" };
    modellUebernehmen();
  }
  function eliteVersion() {
    const vorher = R.punkte(state).pts;
    bModell.q = Math.max(2, bModell.q - 1);
    bModell.t = Math.ceil(bModell.t * 1.5);
    bModell.waffen.forEach(w => { w.a += 1; });
    if (!/elite/i.test(state.name || "")) state.name = (state.name || "Gegner") + " (Elite)";
    state.id = undefined;
    modellUebernehmen();
    const nachher = R.punkte(state).pts;
    $("bEliteMsg").textContent = `Normal ${vorher} Punkte, Elite ${nachher} Punkte: das ${zahl(nachher / vorher)}-Fache. Eine zusätzliche Mechanik kannst du jetzt noch bei den Fähigkeiten dazunehmen.`;
  }

  // ---------- Duell-Simulator ----------
  function simOptionen() {
    const opts = [`<option value="aktuell">Aktuelle Karte (${esc(state.name || "")})</option>`]
      .concat(VORLAGEN.map(v => `<option value="${v.key}">${esc(v.d.name)} · ${R.punkte(v.d).pts} P.</option>`));
    ["simA", "simB"].forEach((id, i) => { const el = $(id), alt = el.value; el.innerHTML = opts.join(""); el.value = alt || (i ? "sporenhuelle" : "aktuell"); });
  }
  const simEinheit = key => key === "aktuell" ? state : (VORLAGEN.find(v => v.key === key) || VORLAGEN[0]).d;
  function simStart() {
    const a = simEinheit($("simA").value), b = simEinheit($("simB").value);
    const r = R.simuliere(a, b, { kaempfe: +$("simN").value, abstand: +$("simDist").value, deckung: +$("simCover").value, seed: Date.now() % 100000 });
    const pa = R.punkte(a).pts, pb = R.punkte(b).pts;
    const entsch = r.a + r.b, anteilA = entsch ? r.a / entsch : .5, punkteA = pa / (pa + pb);
    let urteil;
    if (entsch < 0.3) urteil = "Die meisten Kämpfe enden nach 8 Runden ohne Sieger. Beide Seiten richten zu wenig Schaden an, um sich gegenseitig auszuschalten.";
    else if (Math.abs(pa - pb) / Math.max(pa, pb) <= 0.1) urteil = Math.abs(anteilA - .5) <= .1
      ? `Gleiche Punkte, ähnliche Chancen. So soll es sein.`
      : `Gleiche Punkte, aber ${anteilA > .5 ? esc(a.name) : esc(b.name)} gewinnt ${prozent(Math.max(anteilA, 1 - anteilA))} der entschiedenen Kämpfe. Einzelne Paarungen dürfen schief sein (Stein, Schere, Papier); über viele Einheiten sollte es sich ausgleichen. Das prüft der Balance-Test.`;
    else urteil = `${esc(a.name)} hat ${prozent(punkteA)} der Punkte und gewinnt ${prozent(anteilA)} der entschiedenen Kämpfe.`;
    $("simOut").innerHTML = `
      <div class="sim-legend"><span><b>${prozent(r.a)}</b> ${esc(a.name)} (${pa} P.)</span><span><b>${prozent(r.u)}</b> Unentschieden</span><span><b>${prozent(r.b)}</b> ${esc(b.name)} (${pb} P.)</span></div>
      <div class="bar" role="img" aria-label="Siege A ${prozent(r.a)}, Unentschieden ${prozent(r.u)}, Siege B ${prozent(r.b)}">
        <span class="a" style="width:${r.a * 100}%">${r.a > .08 ? prozent(r.a) : ""}</span><span class="d" style="width:${r.u * 100}%">${r.u > .08 ? prozent(r.u) : ""}</span><span class="b" style="width:${r.b * 100}%">${r.b > .08 ? prozent(r.b) : ""}</span>
      </div>
      <p class="verdict">${urteil}</p>
      <p class="hint">Im Schnitt ${zahl(r.runden)} Runden. Übrige Lebenspunkte: ${esc(a.name)} ${prozent(r.restA)}, ${esc(b.name)} ${prozent(r.restB)}.</p>`;
  }
  function balance() {
    const btn = $("simFair"); btn.disabled = true; btn.textContent = "Rechnet …";
    setTimeout(() => {
      const r = R.balanceTest({ abstand: +$("simDist").value, deckung: +$("simCover").value });
      const fern = r.fern, nah = 1 - r.fern;
      $("simOut").innerHTML = `
        <div class="sim-legend"><span><b>${prozent(fern)}</b> Schützen</span><span><b>${prozent(nah)}</b> Nahkämpfer</span></div>
        <div class="bar" role="img" aria-label="Schützen ${prozent(fern)}, Nahkämpfer ${prozent(nah)}"><span class="a" style="width:${fern * 100}%">${prozent(fern)}</span><span class="b" style="width:${nah * 100}%">${prozent(nah)}</span></div>
        <p class="verdict">${r.paare} zufällige Paare aus Schütze und Nahkämpfer mit gleichen Punkten, je 200 Kämpfe. ${Math.abs(fern - .5) <= .06 ? "Fern- und Nahkampf sind bei diesem Gelände im Gleichgewicht." : fern > .5 ? "Bei diesem Gelände sind Schützen im Vorteil: mehr Deckung auf den Tisch." : "Bei diesem Gelände sind Nahkämpfer im Vorteil: weniger Deckung oder mehr Abstand."}</p>
        <p class="hint">Nach Reichweite: ${Object.entries(r.jeReichweite).map(([k, v]) => `${k}" ${prozent(v)}`).join(" · ")}.</p>`;
      btn.disabled = false; btn.textContent = "Balance-Test: Fern gegen Nah";
    }, 30);
  }

  // ---------- Speichern auf dem Olympiade-Server ----------
  const API = "/api/kartenschmiede/karten";
  function vorschau(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); const w = 128, h = Math.round(128 * 1.4); c.width = w; c.height = h;
        const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
        c.getContext("2d").drawImage(img, (w - dw) / 2, (h - dh) / 3, dw, dh); res(c.toDataURL("image/jpeg", .75)); };
      img.onerror = () => res(null);
      img.src = src;
    });
  }
  async function meineKarten() {
    const box = $("mine");
    try {
      const r = await fetch(API, { credentials: "same-origin" });
      if (!r.ok) throw new Error(r.status);
      const { karten } = await r.json();
      box.innerHTML = karten.length ? karten.map(k => `
        <div class="mine-item"><div class="th" style="border-color:var(--t${k.tier || 1});${k.vorschau ? `background-image:url('${k.vorschau}')` : ""}"></div>
          <div><b>${esc(k.name)}</b><small>${k.points} P. · ${STUFEN[k.tier || 1]}${k.role && k.role !== "enemy" ? " · " + ROLLEN[k.role] : ""}${k.gespeichertVon ? " · von " + esc(k.gespeichertVon) : ""}</small>
          <div class="acts"><button type="button" class="btn ghost sm" data-load="${esc(k.id)}">Laden</button><button type="button" class="btn ghost sm" data-del="${esc(k.id)}">Löschen</button></div></div></div>`).join("")
        : `<p class="mine-empty">Noch keine Karten gespeichert. Oben in der Werkstatt auf „Speichern“ drücken.</p>`;
    } catch {
      box.innerHTML = `<p class="mine-empty">Die gespeicherten Karten ließen sich nicht laden. Bist du noch eingeloggt?</p>`;
    }
  }
  async function speichern() {
    const msg = $("saveMsg");
    if (!state.id) state.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, "");
    msg.textContent = "Speichert …";
    try {
      const vs = await vorschau(state.art === "upload" ? state.upload : IMG[state.art]);
      const r = await fetch(`${API}/${encodeURIComponent(state.id)}`, { method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ karte: state, vorschau: vs }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
      msg.textContent = `Gespeichert: ${state.name}.`;
      merke(); meineKarten();
    } catch (e) {
      msg.textContent = `Speichern fehlgeschlagen (${e.message}). Ist das Artwork sehr groß, hilft ein kleineres Bild.`;
    }
  }
  async function ladeKarte(id) {
    const r = await fetch(`${API}/${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!r.ok) { $("saveMsg").textContent = "Die Karte ließ sich nicht laden."; return; }
    const { karte } = await r.json();
    state = Object.assign({ orient: "port", autoTier: true }, karte);
    bModell = null; insFormular(); alles();
    $("h-shop").scrollIntoView({ behavior: "smooth" });
  }
  async function loescheKarte(id, knopf) {
    if (knopf.dataset.sicher !== "1") { knopf.dataset.sicher = "1"; knopf.textContent = "Wirklich löschen?"; return; }
    await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    if (state.id === id) state.id = undefined;
    meineKarten();
  }

  // ---------- Verdrahtung ----------
  $("preset").innerHTML = VORLAGEN.map(v => `<option value="${v.key}">${esc(v.label)}</option>`).join("");
  $("tiers").innerHTML = [1, 2, 3, 4, 5, 6].map(t => `<button type="button" data-t="${t}" aria-pressed="false">${STUFEN[t]}</button>`).join("");
  $("preset").addEventListener("change", e => vorlage(e.target.value));
  $("autoTier").addEventListener("change", e => { state.autoTier = e.target.checked; alles(); });
  const stufeWaehlen = t => { state.tier = t; state.autoTier = false; insFormular(); alles(); };
  $("tiers").addEventListener("click", e => { const b = e.target.closest("button"); if (b) stufeWaehlen(+b.dataset.t); });
  $("ladder").addEventListener("click", e => { const b = e.target.closest(".rung"); if (b) stufeWaehlen(+b.dataset.t); });
  document.querySelectorAll(".toolbar .seg button").forEach(b => b.addEventListener("click", () => { state.orient = b.dataset.o; insFormular(); alles(); }));
  $("editor").addEventListener("submit", e => e.preventDefault());
  let takt;
  $("editor").addEventListener("input", e => {
    const id = e.target.id;
    if (!FELDER.includes(id)) return;
    state[id] = ["points", "ax", "ay", "zoom"].includes(id) ? +e.target.value : e.target.value;
    if (["quality", "defense", "tough", "size", "weapons", "passives", "special", "role"].includes(id)) bModell = null;
    clearTimeout(takt); takt = setTimeout(() => { alles(); simOptionen(); }, 60);
  });
  $("artfile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        // auf handliche Größe bringen, damit Speichern und Export flott bleiben
        const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        state.upload = c.toDataURL("image/jpeg", .88);
        state.art = "upload"; state.ax = 50; state.ay = 30; state.zoom = 100;
        insFormular(); alles();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $("exportBtn").addEventListener("click", async () => {
    const btn = $("exportBtn");
    btn.disabled = true; btn.textContent = "Wird erzeugt …";
    const halter = document.createElement("div");
    const w = state.orient === "land" ? 840 : 600;
    halter.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;padding:${w * .1}px ${w * .05}px ${w * .05}px;background:transparent`;
    halter.innerHTML = renderCard(state, state.tier, { land: state.orient === "land", snap: true });
    document.body.appendChild(halter);
    passeAn(halter);
    try {
      await document.fonts.ready;
      $("outImg").src = await htmlToImage.toPng(halter, { pixelRatio: 2, cacheBust: false, style: { position: "static", left: "0", top: "0" } });
      $("modal").hidden = false;
    } catch {
      $("tierNote").textContent = "Das PNG ließ sich nicht erzeugen. Meist hilft ein kleineres Bild oder ein zweiter Versuch.";
    } finally {
      halter.remove(); btn.disabled = false; btn.textContent = "Als PNG erzeugen";
    }
  });
  $("closeModal").addEventListener("click", () => { $("modal").hidden = true; });
  $("modal").addEventListener("click", e => { if (e.target.id === "modal") $("modal").hidden = true; });
  $("copyBtn").addEventListener("click", () => {
    const t = $("prompt");
    navigator.clipboard.writeText(t.value).then(() => { $("copyMsg").textContent = "Kopiert."; },
      () => { t.focus(); t.select(); $("copyMsg").textContent = "Text ist markiert, jetzt mit Strg+C kopieren."; });
  });
  $("bestiary").addEventListener("click", e => { const tr = e.target.closest("tr"); if (tr) { vorlage(tr.dataset.key); $("h-shop").scrollIntoView({ behavior: "smooth" }); } });
  $("bestiary").addEventListener("keydown", e => { const tr = e.target.closest("tr"); if (tr && e.key === "Enter") vorlage(tr.dataset.key); });
  $("bControls").addEventListener("click", e => { const b = e.target.closest("button[data-act]"); if (b && !b.disabled) aktion(b.dataset.act); });
  $("bControls").addEventListener("change", e => { if (e.target.classList.contains("wname")) { bModell.waffen[+e.target.dataset.w].name = e.target.value || "Waffe"; modellUebernehmen(); } });
  $("bRole").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; bModell.rolle = b.dataset.r; modellUebernehmen(); });
  $("bBudget").addEventListener("change", e => { bModell.budget = Math.max(20, +e.target.value || 100); modellUebernehmen(); });
  $("bNewHero").addEventListener("click", () => frisch("hero"));
  $("bNewEnemy").addEventListener("click", () => frisch("enemy"));
  $("bElite").addEventListener("click", eliteVersion);
  $("simRun").addEventListener("click", simStart);
  $("simFair").textContent = "Balance-Test: Fern gegen Nah";
  $("simFair").addEventListener("click", balance);
  if (SERVER) {
    $("saveBtn").hidden = false; $("mineSec").hidden = false;
    $("saveBtn").addEventListener("click", speichern);
    $("mine").addEventListener("click", e => {
      const l = e.target.closest("[data-load]"), d = e.target.closest("[data-del]");
      if (l) ladeKarte(l.dataset.load); if (d) loescheKarte(d.dataset.del, d);
    });
    meineKarten();
  }

  bestiarium();
  const gemerkt = lade();
  if (gemerkt && gemerkt.name !== undefined) { state = gemerkt; insFormular(); alles(); } else vorlage("frostfang");
  simOptionen();
})();

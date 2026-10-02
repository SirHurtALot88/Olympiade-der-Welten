/* Kartenschmiede – Oberfläche. Braucht regeln.js (globales „Regeln“) und html-to-image (globales „htmlToImage“).
   Läuft auf dem Olympiade-Server (dann mit Speichern) und als eigenständige Seite (dann nur im Browser). */
(function () {
  "use strict";
  const R = window.Regeln;
  const IMG = window.KARTENSCHMIEDE_BILDER || {};
  const SERVER = window.KARTENSCHMIEDE_SERVER === true;
  const STUFEN = R.STUFEN;
  const ROLLEN = { enemy: "Gegner", hero: "Held", companion: "Gefährte" };
  const KAT = window.Katalog;
  const GRUND = KAT.GRUNDBESTAND.concat(KAT.FRAKTIONEN);
  const TAG = Object.fromEntries(KAT.TAGS.map(t => [t.id, t]));
  // Eigene Einträge: auf dem Server gemeinsam, sonst nur in diesem Browser
  let eigene = [];
  const alleEintraege = () => { const ids = new Set(eigene.map(e => e.id)); return GRUND.filter(g => !ids.has(g.id)).concat(eigene); };
  // Was sich als Textblock auf eine Karte legen lässt
  const AUF_KARTE = ["faehigkeit", "zauber", "gegenstand"];
  const alleFaehigkeiten = () => alleEintraege().filter(e => AUF_KARTE.includes(e.typ || "faehigkeit"));
  const findeFaehigkeit = id => alleEintraege().find(f => f.id === id);
  const skillKopie = f => ({ id: f.id, typ: f.typ || "faehigkeit", name: f.name, art: f.art, tags: [...(f.tags || [])], text: f.text, kosten: { ...f.kosten } });
  const sk = (...ids) => ids.map(id => GRUND.find(g => g.id === id)).filter(Boolean).map(skillKopie);
  const kostenText = k => k.typ === "fest" ? `${k.wert} P.` : `${k.wert > 0 ? "+" : ""}${k.wert} %`;
  const fraktionen = () => alleEintraege().filter(e => e.typ === "fraktion");
  const fraktionVon = name => fraktionen().find(f => f.name.toLowerCase() === String(name || "").trim().toLowerCase());
  const iconFuer = s => (fraktionVon(s.faction) || {}).icon || s.ficon || "rune";

  // ---------- Vorlagen: Chris' Einheiten aus „Age_of_Fantasy_Quest.xlsx“, Punkte wie dort eingetragen ----------
  const basis = { size: "1", role: "enemy", skills: [], bossName: "", bossText: "", special: "0", ax: 50, ay: 40, zoom: 100, flavor: "", look: "", art: "" };
  const VORLAGEN = [
    { key: "frostfang", label: "Frostfang · Boss (Werwolf-Mini, Beispiel)", eigen: false, d: { ...basis,
      name: "Frostfang der Kettenbrecher", faction: "Wilde Jagd", praegung: ["frost"], quality: "3+", defense: "4+", tough: "12",
      weapons: "Frostklauen | Nahkampf | A6 | DS(2), Reißend, Frost\nEisnacht-Heulen | 12\" | A1 | Explosion(3), Zuverlässig, Frost",
      passives: "Schnell, Furchtlos, Regeneration", skills: sk("gebrochene-ketten"),
      flavor: "Die Kette hielt drei Winter. Im vierten hielt sie nichts mehr.",
      look: "a hulking werewolf with pale ice-blue fur on its back and shoulders, dark slate-blue skin, bone-white claws and fangs, broken iron shackles and chains hanging from its wrists, howling on frozen, snow-dusted ground",
      art: "werwolf", ax: 45, ay: 20 } },
    { key: "frostklauen", label: "Frostklauen-Pirscher (Werwolf-Mini)", eigen: true, d: { ...basis,
      name: "Frostklauen-Pirscher", faction: "Urwild", quality: "3+", defense: "5+", tough: "5",
      praegung: ["frost"], weapons: "Frostklauen | Nahkampf | A4 | Reißend, Frost", passives: "Rasend, Hinterhalt, Geländeläufer",
      flavor: "Man hört die Ketten, bevor man die Klauen sieht.",
      look: "a lean, hunched werewolf with pale ice-blue fur, dark slate-blue skin, bone-white claws, broken chains on its wrists, stalking through snow",
      art: "werwolf", ax: 45, ay: 20 } },
    { key: "kristallwurm", label: "Kristallwurm", eigen: true, d: { ...basis, name: "Kristallwurm", faction: "Dämonen", quality: "5+", defense: "4+", tough: "3",
      weapons: "Kristallbiss | Nahkampf | A3 | Reißend\nSplitterspucke | 18\" | A1 | DS(1), Explosion(2)", passives: "An Beschwörer gebunden",
      flavor: "Aus der Tiefe gerufen, lebende Waffen aus Fleisch und Kristall.",
      look: "a huge segmented worm with a glowing red rune on its head, a gaping maw of teeth, spitting violet crystal shards", art: "einheit1" } },
    { key: "kristallwurm-elite", label: "Kristallwurm-Elite", eigen: true, d: { ...basis, name: "Kristallwurm-Elite", faction: "Dämonen", quality: "4+", defense: "4+", tough: "5",
      weapons: "Kristallbiss | Nahkampf | A4 | Reißend\nSplitterspucke | 18\" | A2 | DS(1), Explosion(2)", passives: "Geländeläufer, An Beschwörer gebunden", skills: sk("kristallsplitter"),
      look: "a huge segmented worm armoured with violet crystal spikes, glowing red rune on its head, spitting crystal shards", art: "einheit2" } },
    { key: "dornauge", label: "Dornauge", eigen: true, d: { ...basis, name: "Dornauge", faction: "Dämonen", quality: "5+", defense: "4+", tough: "3",
      weapons: "Rasierklauen | Nahkampf | A3 | Reißend\nDornenstoß | Nahkampf | A2 | DS(1), Explosion(3)", passives: "",
      flavor: "Ein Geschwür aus Kristall und Dornen, das alles anstarrt.",
      look: "a spiky crystalline creature made of one giant staring eye, violet thorns and clawed legs, erupting from rocky ground", art: "einheit3" } },
    { key: "dornauge-alpha", label: "Dornauge-Alpha", eigen: true, d: { ...basis, name: "Dornauge-Alpha", faction: "Dämonen", quality: "4+", defense: "4+", tough: "5",
      weapons: "Rasierklauen | Nahkampf | A4 | Reißend\nGiftnadeln | 12\" | A3 | Gift\nDornenstoß | Nahkampf | A2 | DS(1), Explosion(3)", passives: "Geländeläufer",
      look: "a larger spiky crystalline creature with one giant eye, violet and green thorns, firing poison needles", art: "einheit4" } },
    { key: "giftmade", label: "Giftmade", eigen: true, d: { ...basis, name: "Giftmade", faction: "Urwild", quality: "5+", defense: "6+", tough: "3",
      weapons: "Ätzender Biss | Nahkampf | A2 | Gift\nGiftspeichel | 12\" | A2 | Gift", passives: "Langsam",
      flavor: "Ein Parasit, geboren aus Schlamm und Hunger.", look: "a pale yellow-green grub with two curved horns, vomiting a jet of glowing green venom", art: "einheit5" } },
    { key: "saeurelauerer", label: "Säurelauerer", eigen: true, d: { ...basis, name: "Säurelauerer", faction: "Urwild", quality: "4+", defense: "5+", tough: "3",
      weapons: "Giftspeichel | 12\" | A3 | Gift", passives: "Langsam, Hinterhalt", skills: sk("saeureblut"),
      look: "a bloated horned grub with a huge toothed maw, spraying acid", art: "einheit6" } },
    { key: "sporenhuelle", label: "Sporenhülle", eigen: true, d: { ...basis, name: "Sporenhülle", faction: "Urwild", quality: "5+", defense: "4+", tough: "4",
      weapons: "Sporenstoß | 9\" | A2 | Gift", passives: "Langsam, Furchtlos",
      flavor: "Die Sporen fressen, das Fleisch fault, doch sie fällt nie.",
      look: "a bloated, moss-green fungal brute with mushroom caps growing from its head and shoulders, a dark brown beard, glowing toxic-green spores dripping from its mouth and belly, iron chains on its back",
      art: "einheit7", ay: 30 } },
    { key: "sporenhuelle-mini", label: "Sporenhülle (Foto der Mini)", eigen: false, d: { ...basis, name: "Sporenhülle", faction: "Urwild", quality: "5+", defense: "4+", tough: "4",
      weapons: "Sporenstoß | 9\" | A2 | Gift", passives: "Langsam, Furchtlos",
      flavor: "Die Sporen fressen, das Fleisch fault, doch sie fällt nie.",
      look: "a bloated, moss-green fungal brute with mushroom caps growing from its head and shoulders, a dark brown beard, glowing toxic-green spores dripping from its mouth and belly, iron chains on its back",
      art: "sporenhuelle", ay: 25 } },
    { key: "seuchenbringer", label: "Myzel-Seuchenbringer", eigen: true, d: { ...basis, name: "Myzel-Seuchenbringer", faction: "Urwild", quality: "4+", defense: "3+", tough: "6",
      weapons: "Dornenklauen | Nahkampf | A3 | DS(1), Reißend\nDornenstoß | 6\" | A2 | DS(1), Explosion(3)", passives: "Langsam, Furchtlos", skills: sk("strahlende-aura"),
      look: "a hulking fungal brute covered in mushroom caps and spines, glowing yellow-green belly, radioactive spores", art: "einheit8", ay: 30 } },
    { key: "schurke", label: "Held: Schurke", eigen: true, d: { ...basis, role: "hero", name: "Schurke", faction: "Helden", quality: "4+", defense: "5+", tough: "5",
      weapons: "Krummklingen | Nahkampf | A4 | Reißend\nWurfmesser | 6\" | A1 |", passives: "Tarnung", skills: sk("schattenschritt", "schwachstelle") } },
    { key: "krieger", label: "Held: Krieger", eigen: true, d: { ...basis, role: "hero", name: "Krieger", faction: "Helden", quality: "4+", defense: "3+", tough: "7",
      weapons: "Schwert und Schild | Nahkampf | A3 |\nSchildstoß | Nahkampf | A1 |", passives: "Furchtlos", skills: sk("reihe-halten", "schildstoss") } },
    { key: "waldlaeufer", label: "Held: Waldläufer", eigen: true, d: { ...basis, role: "hero", name: "Waldläufer", faction: "Helden", quality: "4+", defense: "5+", tough: "5",
      weapons: "Jagdbogen | 18\" | A3 |\nJagdmesser | Nahkampf | A2 |", passives: "Späher", skills: sk("beute-markieren", "schlingenfalle") } },
    { key: "kleriker", label: "Held: Kleriker", eigen: true, d: { ...basis, role: "hero", name: "Kleriker", faction: "Helden", quality: "4+", defense: "4+", tough: "5",
      weapons: "Geweihter Speer | Nahkampf | A2 | DS(1)\nHeiliger Blitz | 12\" | A2 |", passives: "Gleiten", skills: sk("wunden-heilen", "strahlender-schutz") } },
  ];

  const NOTIZEN = {
    1: "<b>Gewöhnlich, grau:</b> schlichter Eisenrahmen, keine Ornamente. Fußvolk bleibt ruhig, damit die starken Karten auffallen.",
    2: "<b>Selten, grün:</b> doppelte Innenlinie, abgeschrägtes Punkteschild.",
    3: "<b>Magisch, blau:</b> stahlblaues Metall, doppelte Linie, kleine Eckbeschläge, leuchtender Name.",
    4: "<b>Elite, gelb:</b> Messing mit Glanzverlauf, große Eckbeschläge, Wappenschild für die Punkte.",
    5: "<b>Legendär, Diablo-Orange:</b> glühende Bronze, Filigran-Ecken, Edelstein oben, Holo-Folie und ein Lichtstreif über die Karte.",
    6: "<b>Boss, rot:</b> blutroter Rahmen mit Goldbeschlägen, Hörnerkrone, Boss-Banner, Frakturschrift, glühender Kranz und Funkenflug.",
  };
  // Stimmung je Seltenheit: nur Kamera und Licht, keine zusätzlichen Effekte im Hintergrund
  const STIMMUNG = {
    1: "an ordinary specimen of its kind, eye-level camera, quiet dim light",
    2: "a tougher specimen, eye-level camera, faint cool rim light",
    3: "a creature touched by magic, slightly low camera, soft blue rim light",
    4: "confident, threatening stance, low camera, warm golden key light from one side",
    5: "powerful and dangerous, low camera angle, strong warm backlight outlining the silhouette",
    6: "overwhelming boss presence, very low camera angle looking up, deep red backlight outlining the silhouette, the creature fills the frame and the viewer should feel small",
  };
  // Stil wie die Olympiade-Bilder: Standbild aus einem Realfilm, dunkel, warmes Licht, genau ein leuchtender Akzent
  const STIL = "a single frame from a live-action dark fantasy movie with a subtle science-fiction edge. Photorealistic: the creature is a real, physical being made with practical effects (real skin, fur, scales, cloth, metal), shot on a full-frame cinema camera with an 85mm lens at f/2, shallow depth of field, dark and moody low-key lighting with warm practical light, haze and a little floating dust, natural film colour grade, slightly desaturated.";
  // Der eine leuchtende Akzent folgt der Prägung, damit Bild und Element-Symbol zusammenpassen
  const AKZENT = {
    feuer: "glowing orange lava cracks", frost: "pale blue frost glowing in the cracks of its skin or armour", natur: "faint green bioluminescent veins",
    gift: "a sickly yellow-green toxic glow", licht: "warm golden glowing runes", schatten: "wisps of violet shadow-fire",
    magie: "softly glowing magenta arcane runes", technik: "thin cyan glowing tech inlays",
  };
  const akzentVon = s => { const p = (Array.isArray(s.praegung) ? s.praegung : []).find(t => AKZENT[t]); return p ? AKZENT[p] : "one subtle glowing detail such as runes, energy veins or tech inlays"; };

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
  // Tag-Symbole: auf der Karte und in Listen statt ausgeschriebener Schlagworte, Name per Hover
  // Symbole im Regeltext: {P1} kostet 1 Power, {A2} 2 Treffer, {V+1} +1 Verteidigung … Macht Texte kurz und lesbar.
  const minus = w => w.replace(/^-/, "−");
  const SYMBOLTEXT = {
    P: { icon: "power", name: "Power", zeige: w => w, tip: w => w.startsWith("+") ? `${w} Power` : `kostet ${w} Power` },
    Z: { icon: "rune", name: "Zauberwurf", zeige: w => w + "+", tip: w => `Zauberwurf ${w}+: gelingt bei ${w}+, sonst verpufft der Zauber` },
    S: { icon: "potion", name: "Einmal pro Spiel", zeige: () => "1×", tip: () => "einmal pro Spiel" },
    RU: { icon: "runde", name: "Einmal pro Runde", zeige: () => "1×", tip: () => "einmal pro Runde" },
    A: { icon: "sword", name: "Treffer / Attacken", zeige: w => w, tip: w => w.startsWith("+") ? `${w} Attacke je Waffe` : `${w} Treffer (bei Waffen: ${w} Attacken je Modell)` },
    DS: { icon: "down", name: "Durchschlag", zeige: w => w, tip: w => `Durchschlag ${w.replace("+", "+ ")}: Ziel −${w.replace("+", "")} auf Verteidigung` },
    V: { icon: "shield", name: "Verteidigung", zeige: minus, tip: w => `${minus(w)} Verteidigung` },
    T: { icon: "target", name: "auf Treffer", zeige: minus, tip: w => `${minus(w)} auf Treffer` },
    H: { icon: "heart", name: "Heilen", zeige: w => w, tip: w => `heilt ${w} Wunden` },
    W: { icon: "fang", name: "Wunde", zeige: w => w, tip: w => `erleidet ${w} Wunde${w === "1" ? "" : "n"}` },
    R: { icon: "reach", name: "Reichweite", zeige: w => w + '"', tip: w => w.startsWith("+") ? `${w} Zoll Reichweite` : `in ${w} Zoll Reichweite` },
    F: { icon: "burst", name: "Umkreis", zeige: w => w + '"', tip: w => `alle im Umkreis von ${w} Zoll` },
    B: { icon: "wing", name: "Bewegung", zeige: w => minus(w) + '"', tip: w => /^[+-]/.test(w) ? `${minus(w)} Zoll Bewegung` : `bis ${w} Zoll bewegen` },
    X: { icon: "spiral", name: "Betäubt", zeige: () => "", tip: () => "betäubt: darf sich bei der nächsten Aktivierung nur bewegen" },
    D: { icon: "dice", name: "Wurf", zeige: w => w + "+", tip: w => `bei einem Wurf von ${w}+` },
  };
  const SYMBOL_MUSTER = /\{(RU|DS|[PZSAVTHWRFBXD])([+\-−]?[0-9W+]*)\}/g;
  const symbol = (k, w) => { const d = SYMBOLTEXT[k], z = d.zeige(w); return `<span class="sym" data-tip="${esc(d.tip(w))}">${ico(d.icon)}${z ? `<b>${esc(z)}</b>` : ""}</span>`; };
  const symText = text => esc(text || "").replace(SYMBOL_MUSTER, (_, k, w) => symbol(k, w));
  // Für Stellen ohne Symbole (Prompt, Suche): Klartext
  const klarText = text => String(text || "").replace(SYMBOL_MUSTER, (_, k, w) => SYMBOLTEXT[k].tip(w));

  // Elemente als farbiges Abzeichen (Feuer rot, Frost eisblau …), alle anderen Tags als Messing-Symbol
  // Jeder Tag als farbiges Abzeichen: Elemente rund, alle anderen Tags eckig
  const tagIco = t => TAG[t] ? `<span class="elem${TAG[t].element ? "" : " eckig"}" style="--el:${TAG[t].farbe || "#c9a35b"}">${ico(TAG[t].icon)}</span>` : "";
  const tagIcons = (tags, mitTip = true) => (tags || []).filter(t => TAG[t]).length
    ? `<span class="tico">${(tags || []).filter(t => TAG[t]).map(t => mitTip ? `<span data-tip="${esc(TAG[t].name)}">${tagIco(t)}</span>` : tagIco(t)).join("")}</span>` : "";
  const tipText = f => `<b>${esc(f.name)}</b>${symText(f.text)}<small>${esc([f.art, kostenText(f.kosten), (f.tags || []).map(t => TAG[t] ? TAG[t].name : "").filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</small>`;

  let state = {};
  const SPEICHER = "kartenschmiede-v3";
  const merke = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(state)); } catch { /* voll oder gesperrt */ } };
  const lade = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch { return null; } };

  // ---------- Karte ----------
  function renderCard(s, tier, opts = {}) {
    const land = opts.land;
    const punkte = R.punkte(s).pts;
    const waffen = R.leseWaffen(s.weapons);
    const passiv = R.leseListe(s.passives);
    const src = s.art === "upload" ? s.upload : IMG[s.art];
    const funken = Array.from({ length: 16 }, (_, i) => {
      const r = n => (Math.sin(i * 91.7 + n * 13.1) + 1) / 2;
      return `<i style="left:${(r(1) * 96).toFixed(1)}%;--d:${(4 + r(2) * 5).toFixed(2)}s;--dl:${(-r(3) * 8).toFixed(2)}s;--dx:${((r(4) - .5) * 14).toFixed(1)}cqw;bottom:${(r(5) * 30 - 4).toFixed(1)}%"></i>`;
    }).join("");
    const rolle = s.role === "hero" ? " · Held" : s.gefaehrte || s.role === "companion" ? " · Gefährte" : "";
    const skills = Array.isArray(s.skills) ? s.skills : [];
    const eigeneRegel = s.bossName || s.bossText;
    const sonderTitel = tier === 6 && s.role !== "hero" ? "Boss-Fähigkeiten" : "Fähigkeiten";
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
              const mitTip = t => { const r = R.regelnVon(t)[0]; return r ? `<span data-tip="${esc(`<b>${r.name}</b>${r.text}`)}">${r.element && TAG[r.element] ? tagIco(r.element) : ""}${esc(t)}</span>` : esc(t); };
              const werte = symText(`${nah ? "" : `{R${w.reichweite}} `}{A${w.a}}${w.ds ? ` {DS${w.ds}}` : ""}`);
              const unter = [werte].concat(regeln.split(",").map(t => t.trim()).filter(t => t && !/^(DS|AP)\s*\(/i.test(t)).map(mitTip)).join(" ");
              return `<div class="wep">${ico(nah ? "sword" : "target")}<div><h4>${esc(w.name)}</h4><p>${unter}</p></div><span class="tag">${nah ? "Nahkampf" : "Fernkampf"}</span></div>`;
            }).join("")}</div>` : ""}
            ${passiv.length ? `<div class="chips">${passiv.map(p => `<span class="chip">${ico(symbolFuer(p))}${esc(p)}</span>`).join("")}</div>` : ""}
            ${skills.length || eigeneRegel ? `<div class="boss"><h4>${ico(tier === 6 ? "crown" : "rune")}${sonderTitel}</h4>${skills.map(k => `<p data-tip="${esc(tipText(k))}"><b>${esc(k.name)}.</b> ${symText(k.text)}</p>`).join("")}${eigeneRegel ? `<p><b>${esc(s.bossName || "Sonderregel")}.</b> ${symText(s.bossText)}</p>` : ""}</div>` : ""}
            <div class="foot"><span class="fac">${ico(iconFuer(s))}${esc(s.faction)}${praegungVon(s).filter(t => TAG[t]).map(t => `<span class="praeg" data-tip="Prägung: ${esc(TAG[t].name)}">${tagIco(t)}</span>`).join("")}</span>${s.flavor ? `<q>${esc(s.flavor)}</q>` : "<span></span>"}</div>
          </div>
        </div>
        <div class="badge">${sym("i-crown", "crown")}<b>${punkte}</b><span>Punkte</span></div>
        ${tier >= 3 ? ["tl", "tr", "bl", "br"].map(c => sym(tier === 6 ? "c-crown" : tier === 5 ? "c-filigree" : "c-bracket", "corner " + c)).join("") : ""}
        ${tier === 6 ? sym("i-horns", "crest", "width:26%;height:auto;top:calc(var(--u)*.4)")
          : tier === 5 ? sym("i-gem", "crest", "width:14%;height:auto;top:calc(var(--u)*.6)") : ""}
      </article>
    </div>`;
  }
  // Text schrumpfen, bis alles auf die Karte passt
  function passeAn(root) {
    let kleinste = 1, ueberlauf = false;
    root.querySelectorAll(".card").forEach(card => {
      const face = card.querySelector(".face");
      let k = 1;
      card.style.setProperty("--k", k);
      while (k > 0.62 && face.scrollHeight > face.clientHeight + 1) { k -= 0.04; card.style.setProperty("--k", k.toFixed(2)); }
      kleinste = Math.min(kleinste, k);
      if (face.scrollHeight > face.clientHeight + 1) ueberlauf = true;
    });
    return { kleinste, ueberlauf };
  }

  // ---------- Formular ----------
  const FELDER = ["name", "faction", "size", "quality", "defense", "tough", "role", "weapons", "passives", "bossName", "bossText", "special", "flavor", "look", "ax", "ay", "zoom"];
  function fraktionsAuswahl() {
    const namen = fraktionen().map(f => f.name);
    const extra = state.faction && !fraktionVon(state.faction) ? [state.faction] : [];
    $("faction").innerHTML = [...namen, ...extra].map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  }
  function insFormular() {
    // Es gibt nur noch Held und Gegner; Gefährten sind Gegner, die eine Gruppe freigeschaltet hat
    if (state.role !== "hero") state.role = "enemy";
    fraktionsAuswahl();
    FELDER.forEach(f => { const el = $(f); if (el) el.value = state[f] ?? ""; });
    if (!["0", "5", "10", "20"].includes(String(state.special))) $("special").value = "0";
    if (!state.role) $("role").value = "enemy";
    document.querySelectorAll("#tiers button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.t === state.tier)));
    document.querySelectorAll(".toolbar .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.o === (state.orient || "port"))));
  }

  function zeigeRechnung() {
    const c = R.punkte(state);
    $("calc").innerHTML = `
      <div class="big"><b>${c.pts}</b><span>Punkte · Stufe ${STUFEN[R.stufeFuerPunkte(c.pts)]}</span></div>
      <div class="parts">Kampfwert ${zahl(c.K, 2)} · Ausdauer ${zahl(c.A)} · Boni ${c.b >= 0 ? "+" : ""}${Math.round(c.b * 100)} %${c.fest ? ` · fest +${c.fest}` : ""}</div>`;
  }

  function prompt() {
    const s = state;
    const quer = s.orient === "land";
    return [
      `Create one image: ${STIL}`,
      ``,
      `Reference: the attached photo shows my hand-painted tabletop miniature. Use it only as the design reference. Keep its pose, silhouette, proportions, paint colours and distinctive details (weapons, chains, armour) clearly recognisable, but show it as a living creature, not a figure. Do not show the plastic base, the table or the room from the photo.`,
      ``,
      `Subject: ${s.name || "the creature"}${s.faction ? ` of the ${s.faction}` : ""}. ${s.look || ""}`.trim(),
      ``,
      `Mood and camera: ${STIMMUNG[s.tier]}.`,
      ``,
      `Glowing accent: exactly one, ${akzentVon(s)}. Nothing else in the image glows.`,
      ``,
      `Background: simple, dark and out of focus, only the ground and surroundings suggested by the miniature's base (snow, stone, ash, forest floor). No buildings, towers, moons, ships, floating objects or second creatures.`,
      ``,
      `Composition: ${quer ? "landscape 3:2 (it is printed as a 15 x 10 cm postcard), creature on the right half, head and weapons in the upper half, left half dark and calm because the stat panel covers it" : "portrait 2:3 (it is printed as a 10 x 15 cm postcard), head and weapons in the upper half of the frame, the lower 40 percent dark and calm, because the card's stat panel covers it"}.`,
      ``,
      `Not wanted: digital painting, illustration, concept art, trading-card art, visible brush strokes, over-sharpened detail, oversaturated colours, fire or light effects all over the frame. No text, lettering, numbers, logos, card frame, border or user interface.`,
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
    state.points = R.punkte(state).pts;
    // Der Rahmen hängt fest an den Punkten: jede Stufe hat ihre feste Punktespanne
    state.tier = R.stufeFuerPunkte(+state.points || 0);
    document.querySelectorAll("#tiers button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.t === state.tier)));
    zeigeRechnung();
    const land = state.orient === "land";
    const stage = $("stage");
    stage.classList.toggle("land", land);
    stage.closest(".shop").classList.toggle("quer", land);
    stage.innerHTML = renderCard(state, state.tier, { land });
    $("ladder").innerHTML = [1, 2, 3, 4, 5, 6].map(t => `
      <button type="button" class="rung" data-t="${t}" aria-pressed="${t === state.tier}">
        ${renderCard(state, t, {})}
        <span class="rung-label" style="color:var(--t${t})">${STUFEN[t]}<small>${R.GRENZEN_TEXT[t]} P.</small></span>
      </button>`).join("");
    $("facIcon").innerHTML = `${ico(iconFuer(state))}<span>${esc(state.faction || "")}</span>`;
    requestAnimationFrame(() => {
      const { kleinste, ueberlauf } = passeAn(stage); passeAn($("ladder"));
      $("fitNote").textContent = ueberlauf ? "Zu viel Text für die Karte: Der untere Teil wird abgeschnitten. Kürze Regeltexte oder nimm eine Fähigkeit weg."
        : kleinste < 0.8 ? `Viel Text: Die Schrift ist auf ${Math.round(kleinste * 100)} % verkleinert, damit alles passt. Beim Druck bleibt es lesbar bis etwa 70 %.` : "";
    });
    $("suggest").textContent = `${state.points || 0} Punkte = ${STUFEN[state.tier]}.`;
    $("tierNote").innerHTML = NOTIZEN[state.tier];
    $("prompt").value = prompt();
    zeigeSkills();
    baukasten();
    neigen();
    merke();
  }

  function vorlage(key) {
    const v = VORLAGEN.find(x => x.key === key) || VORLAGEN[0];
    state = Object.assign({ upload: null }, JSON.parse(JSON.stringify(v.d)));
    state.orient = formatFuer(state.role);
    delete state.altPunkte;
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
      explosion: w.explosion, toedlich: w.toedlich, zuverlaessig: w.zuverlaessig, element: w.element && w.element !== "gift" ? w.element : null,
      rest: R.leseListe(w.regeln).filter(x => x !== "–" && !R.elementAus(x) && !/^(DS|AP)\s*\(\d\)$|reißend|reissend|rending|gift|poison|bane|explosion|blast|tödlich|toedlich|deadly|zuverlässig|zuverlaessig|reliable/i.test(x)),
    }));
    const faeh = new Set(), rest = [];
    R.leseListe(s.passives).forEach(p => { const k = faehSchluessel(p); if (k) faeh.add(k); else rest.push(p); });
    return { rolle: s.role || "enemy", budget: +s.budget || 100,
      q: parseInt(s.quality, 10) || 5, d: parseInt(s.defense, 10) || 5, t: parseInt(s.tough, 10) || 1, n: parseInt(s.size, 10) || 1,
      waffen: waffen.length ? waffen : [{ name: "Handwaffe", reichweite: 0, a: 1, ds: 0, rest: [] }], faeh, rest, special: s.special || "0",
      skills: (Array.isArray(s.skills) ? s.skills : []).map(k => ({ ...k, kosten: { ...k.kosten } })) };
  }
  function schreibeModell(m, s) {
    s.role = m.rolle; s.budget = m.budget;
    s.quality = m.q + "+"; s.defense = m.d + "+"; s.tough = String(m.t); s.size = String(m.n);
    s.weapons = m.waffen.map(w => {
      const regeln = [w.ds && `DS(${w.ds})`, w.reissend && "Reißend", w.gift && "Gift", w.explosion && `Explosion(${w.explosion})`,
        w.toedlich && `Tödlich(${w.toedlich})`, w.zuverlaessig && "Zuverlässig", ...(w.rest || []), w.element && R.ELEMENT[w.element].wort].filter(Boolean).join(", ");
      return `${w.name} | ${w.reichweite ? w.reichweite + '"' : "Nahkampf"} | A${w.a} | ${regeln}`;
    }).join("\n");
    s.passives = [...FAEH.filter(([k]) => m.faeh.has(k)).map(([, n]) => n), ...m.rest].join(", ");
    s.special = m.rolle === "hero" ? "0" : m.special;
    s.skills = m.skills.map(k => ({ ...k, kosten: { ...k.kosten } }));
    s.points = R.punkte(s).pts;
    return s;
  }
  const kopie = m => ({ ...m, faeh: new Set(m.faeh), rest: [...m.rest], skills: m.skills.map(k => ({ ...k })), waffen: m.waffen.map(w => ({ ...w, rest: [...(w.rest || [])] })) });
  const rohVon = m => R.punkte(schreibeModell(m, {})).roh;
  const kostet = (m, fn) => { const n = kopie(m); if (fn(n) === false) return null; return Math.round(rohVon(n) - rohVon(m)); };
  const preis = d => d === null ? "" : `<span class="cost ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</span>`;
  // In den −/+-Knöpfen steht das Vorzeichen schon auf dem Knopf, dort nur den Betrag zeigen
  const betrag = d => d === null ? "" : `<span class="cost ${d > 0 ? "up" : d < 0 ? "down" : ""}">${Math.abs(d)}</span>`;

  let bModell = null;
  function baukasten() {
    if (!bModell) bModell = modellAus(state);
    const m = bModell, held = m.rolle === "hero";
    const ausgegeben = Math.round(rohVon(m)), rest = m.budget - ausgegeben;
    const geht = d => !held || d === null || d <= 0 || d <= rest;
    const stufe = (id, label, wert, runter, rauf, hinweis = "") => {
      const dm = kostet(m, runter), dp = kostet(m, rauf);
      return `<div class="stp"><div class="stp-l"><b>${label}</b>${hinweis ? `<small>${hinweis}</small>` : ""}</div>
        <div class="stp-c"><button type="button" data-act="${id}:-" ${dm === null ? "disabled" : ""} aria-label="${label} verringern">−${betrag(dm)}</button>
        <output>${wert}</output>
        <button type="button" data-act="${id}:+" ${dp === null || !geht(dp) ? "disabled" : ""} aria-label="${label} erhöhen">+${betrag(dp)}</button></div></div>`;
    };
    let html = `<div class="b-group"><h4>Grundwerte</h4><div class="stp-grid">
      ${stufe("q", "Qualität", m.q + "+", x => x.q < 6 ? (x.q++, true) : false, x => x.q > 2 ? (x.q--, true) : false, "trifft auf diesen Wurf")}
      ${stufe("d", "Verteidigung", m.d + "+", x => x.d < 6 ? (x.d++, true) : false, x => x.d > 2 ? (x.d--, true) : false, "rettet auf diesen Wurf")}
      ${stufe("t", "Zäh", m.t, x => x.t > 1 ? (x.t--, true) : false, x => x.t < 72 ? (x.t++, true) : false, "Lebenspunkte je Modell")}
      ${held ? "" : stufe("n", "Modelle", m.n, x => x.n > 1 ? (x.n--, true) : false, x => x.n < 10 ? (x.n++, true) : false, "Größe der Einheit")}
    </div></div>`;
    m.waffen.forEach((w, i) => {
      const schalter = (k, label, wert) => {
        const d = kostet(m, x => { x.waffen[i][k] = x.waffen[i][k] ? 0 : wert; });
        return `<button type="button" class="tgl" data-act="w${i}${k}" aria-pressed="${!!w[k]}" ${!w[k] && !geht(d) ? "disabled" : ""}>${label}${preis(d)}</button>`;
      };
      html += `<div class="b-group"><h4><input type="text" class="wname" data-w="${i}" value="${esc(w.name)}" aria-label="Name der Waffe ${i + 1}">
        ${m.waffen.length > 1 ? `<button type="button" class="x" data-act="w${i}del">entfernen</button>` : ""}</h4>
        <div class="stp-grid">${stufe(`w${i}a`, "Attacken", "A" + w.a, x => x.waffen[i].a > 1 ? (x.waffen[i].a--, true) : false, x => x.waffen[i].a < 36 ? (x.waffen[i].a++, true) : false)}
        ${stufe(`w${i}r`, "Reichweite", w.reichweite ? w.reichweite + '"' : "Nahkampf",
          x => { const k = REICHWEITEN.indexOf(x.waffen[i].reichweite); if (k <= 0) return false; x.waffen[i].reichweite = REICHWEITEN[k - 1]; },
          x => { const k = REICHWEITEN.indexOf(x.waffen[i].reichweite); if (k < 0 || k >= REICHWEITEN.length - 1) return false; x.waffen[i].reichweite = REICHWEITEN[k + 1]; })}
        ${stufe(`w${i}ds`, "Durchschlag", "DS(" + w.ds + ")", x => x.waffen[i].ds > 0 ? (x.waffen[i].ds--, true) : false, x => x.waffen[i].ds < 4 ? (x.waffen[i].ds++, true) : false)}</div>
        <div class="tgls">${schalter("reissend", "Reißend", 1)}${schalter("gift", "Gift", 1)}${schalter("explosion", "Explosion(3)", 3)}
          ${schalter("toedlich", "Tödlich(3)", 3)}${schalter("zuverlaessig", "Zuverlässig", 1)}</div>
        <div class="tgls el-wahl"><span class="hint">Element</span>${R.ELEMENTE.filter(e => e.id !== "gift").map(e =>
          `<button type="button" class="tgl" data-act="w${i}el:${e.id}" aria-pressed="${w.element === e.id}" data-tip="${esc(`<b>${e.wort}</b>` + R.regelnVon(e.wort)[0].text)}">${tagIco(e.id)}</button>`).join("")}</div>
      </div>`;
    });
    const neu = kostet(m, x => { x.waffen.push({ name: "Neue Waffe", reichweite: 0, a: 1, ds: 0, rest: [] }); });
    html += m.waffen.length < 3 ? `<button type="button" class="btn ghost sm" data-act="wadd" ${!geht(neu) ? "disabled" : ""}>Waffe hinzufügen ${preis(neu)}</button>` : "";
    html += `<div class="b-group"><h4>Fähigkeiten</h4><div class="tgls">${FAEH.map(([k, n]) => {
      const an = m.faeh.has(k); const d = kostet(m, x => { if (an) x.faeh.delete(k); else x.faeh.add(k); });
      return `<button type="button" class="tgl" data-act="ab:${k}" aria-pressed="${an}" ${!an && !geht(d) ? "disabled" : ""}>${n}${preis(d)}</button>`;
    }).join("")}</div>${m.rest.length ? `<p class="hint">Eigene Regeln bleiben erhalten: ${esc(m.rest.join(", "))}</p>` : ""}</div>`;
    const bAngebot = alleFaehigkeiten().filter(f => f.fuer.includes(m.rolle));
    html += `<div class="b-group"><h4>Aus der Datenbank</h4>${tagLeiste("baukasten", bAngebot, baukasten)}<div class="tgls">${bAngebot.filter(f => m.skills.some(k => k.id === f.id) || filterPasst("baukasten", f)).map(f => {
      const an = m.skills.some(k => k.id === f.id);
      const kf = !an && konfliktVon(f, state);
      if (kf) return `<button type="button" class="tgl" disabled data-tip="${esc(`<b>${esc(f.name)}</b>${esc(konfliktText(kf))}`)}">${tagIcons(f.tags, false)}${esc(f.name)} 🔒</button>`;
      const d = kostet(m, x => { x.skills = an ? x.skills.filter(k => k.id !== f.id) : x.skills.concat(skillKopie(f)); });
      return `<button type="button" class="tgl" data-act="sk:${esc(f.id)}" aria-pressed="${an}" data-tip="${esc(tipText(f))}" ${!an && !geht(d) ? "disabled" : ""}>${tagIcons(f.tags, false)}${esc(f.name)}${preis(d)}</button>`;
    }).join("")}</div></div>`;
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
        <p class="hint">Skills aus der Datenbank kosten feste Punkte und zählen zum Budget.</p>`;
    } else {
      $("bSum").innerHTML = `<div class="sum-line"><b>${pts}</b> Punkte · Stufe <span style="color:var(--t${t})">${STUFEN[t]}</span></div>
        <p class="hint">${m.rolle === "companion"
          ? "Gefährten zählen zu den Gruppenpunkten. Freigeschaltet, wenn die Gruppe die Elite-Version dieser Gegnerart besiegt hat. Keine Power, keine Skills, keine XP, höchstens einer je Held."
          : "Gegner haben kein Limit. Jede Verbesserung kostet umso mehr, je stärker die Einheit schon ist: Angriff wird teurer, wenn sie viel aushält, und umgekehrt."}</p>`;
    }
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
    else if (id === "sk") {
      const f = findeFaehigkeit(dir);
      if (m.skills.some(k => k.id === dir)) m.skills = m.skills.filter(k => k.id !== dir); else if (f) m.skills.push(skillKopie(f));
    }
    else if (id === "wadd") m.waffen.push({ name: "Neue Waffe", reichweite: 0, a: 1, ds: 0, rest: [] });
    else {
      const mm = id.match(/^w(\d)(.+)$/); if (!mm) return;
      const w = m.waffen[+mm[1]], k = mm[2];
      if (k === "a") w.a = Math.max(1, Math.min(36, w.a + (dir === "+" ? 1 : -1)));
      else if (k === "ds") w.ds = Math.max(0, Math.min(4, w.ds + (dir === "+" ? 1 : -1)));
      else if (k === "r") { const i = REICHWEITEN.indexOf(w.reichweite); w.reichweite = REICHWEITEN[Math.max(0, Math.min(REICHWEITEN.length - 1, i + (dir === "+" ? 1 : -1)))]; }
      else if (k === "del") m.waffen.splice(+mm[1], 1);
      else if (k === "explosion" || k === "toedlich") w[k] = w[k] ? 0 : 3;
      else if (k === "el") w.element = w.element === dir ? null : dir;
      else w[k] = !w[k];
    }
    modellUebernehmen();
  }
  function frisch(rolle) {
    state = Object.assign({}, state, { orient: formatFuer(rolle), id: undefined, skills: [], name: rolle === "hero" ? "Neuer Held" : "Neuer Gegner", faction: rolle === "hero" ? "Helden" : state.faction, bossName: "", bossText: "", flavor: "", look: "", art: "", upload: null });
    bModell = { rolle, budget: +state.budget || 100, q: 5, d: 6, t: rolle === "hero" ? 3 : 1, n: 1,
      waffen: [{ name: "Handwaffe", reichweite: 0, a: 1, ds: 0, rest: [] }], faeh: new Set(), rest: [], special: "0", skills: [] };
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
  // Preis-Check aller Fähigkeiten und Zauber im Duell
  function preisCheck() {
    const btn = $("simCheck"); btn.disabled = true; btn.textContent = "Rechnet …";
    setTimeout(() => {
      const zeilen = alleFaehigkeiten().filter(f => f.typ === "faehigkeit" || f.typ === "zauber")
        .map(f => ({ f, ...R.faehigkeitsCheck(f, { kaempfe: 600 }) }))
        .sort((a, b) => (b.messbar - a.messbar) || (b.sieg - a.sieg));
      const urteil = z => !z.messbar ? ["", "im Duell nicht messbar"] : z.sieg >= 0.6 ? ["hi", "eher zu billig"] : z.sieg <= 0.4 ? ["lo", "eher zu teuer"] : ["ok", "passt"];
      $("simOut").innerHTML = `<p class="verdict">Jede Fähigkeit gegen dieselbe Einheit ohne, die gleich viele Punkte an Zäh bekommt. 50 % heißt: Preis passt.</p>
        <div class="tbl-wrap"><table><thead><tr><th>Fähigkeit</th><th class="num">Kosten</th><th class="num">Siege</th><th>Einschätzung</th></tr></thead><tbody class="static">${zeilen.map(z => {
          const [cls, txt] = urteil(z);
          return `<tr data-tip="${esc(tipText(z.f))}"><td>${tagIcons(z.f.tags, false)}${esc(z.f.name)}</td><td class="num">${esc(kostenText(z.f.kosten))}</td><td class="num">${z.messbar ? prozent(z.sieg) : "–"}</td><td><span class="dev ${cls}">${txt}</span></td></tr>`;
        }).join("")}</tbody></table></div>
        <p class="hint">Vereinfacht: ein Duell 1 gegen 1. Beschwörungen, Bewegung, Auren für Verbündete und Gruppenwirkung zählen hier nicht, deshalb stehen solche Fähigkeiten unter „nicht messbar“.</p>`;
      btn.disabled = false; btn.textContent = "Preis-Check: Fähigkeiten";
    }, 30);
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
  // Gespeicherte Karten vom Server; die Tabelle „Fertige Charaktere“ (charaktere.js) zeigt sie zusammen mit den Vorlagen
  let serverKarten = null;
  async function meineKarten() {
    try {
      const r = await fetch(API, { credentials: "same-origin" });
      if (!r.ok) throw new Error(r.status);
      serverKarten = (await r.json()).karten || [];
    } catch {
      serverKarten = null;
    }
    if (window.KartenschmiedeCharaktere) window.KartenschmiedeCharaktere.zeigen();
  }
  // Speichern: Gibt es die Karte schon (gleiche ID oder gleicher Name), fragt die Seite nach: überschreiben oder neu anlegen?
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, "");
  function speichern() {
    const msg = $("saveMsg");
    const liste = serverKarten || [];
    const gleich = (state.id && liste.find(k => k.id === state.id))
      || liste.find(k => (k.name || "").trim().toLowerCase() === (state.name || "").trim().toLowerCase());
    if (!gleich) { if (!state.id) state.id = neueId(); return speichereWirklich(); }
    msg.innerHTML = `„${esc(gleich.name)}“ ist schon gespeichert${gleich.gespeichertVon ? ` (von ${esc(gleich.gespeichertVon)})` : ""}.
      <span class="save-wahl"><button type="button" class="btn sm" data-save="ueber">Überschreiben</button>
      <button type="button" class="btn ghost sm" data-save="neu">Als neue Karte</button>
      <button type="button" class="btn ghost sm" data-save="nein">Abbrechen</button></span>`;
    msg.onclick = e => {
      const b = e.target.closest("[data-save]"); if (!b) return;
      msg.onclick = null;
      if (b.dataset.save === "nein") { msg.textContent = "Nicht gespeichert."; return; }
      if (b.dataset.save === "ueber") state.id = gleich.id;
      else {
        state.id = neueId();
        if ((state.name || "").trim().toLowerCase() === (gleich.name || "").trim().toLowerCase()) state.name = `${state.name} (2)`;
        insFormular();
      }
      speichereWirklich();
    };
  }
  async function speichereWirklich() {
    const msg = $("saveMsg");
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
    state = Object.assign({ orient: formatFuer(karte.role) }, karte);
    bModell = null; insFormular(); alles();
    reiter("karten"); $("h-shop").closest("section").scrollIntoView({ behavior: "smooth" });
  }
  async function loescheKarte(id, knopf) {
    if (knopf.dataset.sicher !== "1") { knopf.dataset.sicher = "1"; knopf.textContent = "Wirklich löschen?"; return; }
    await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    if (state.id === id) state.id = undefined;
    meineKarten();
  }

  // ---------- Mehrere Karten: PNGs und Druck ----------
  async function zeigePngs(karten) {
    $("outImg").hidden = true; $("outMany").innerHTML = "<p>Wird erzeugt …</p>"; $("modal").hidden = false;
    const bilder = [];
    for (const k of karten) {
      const halter = document.createElement("div");
      const quer = k.orient === "land";
      halter.style.cssText = `position:fixed;left:-10000px;top:0;width:${quer ? 840 : 600}px;padding:60px 30px 30px;background:transparent`;
      halter.innerHTML = renderCard(k, R.stufeFuerPunkte(R.punkte(k).pts), { snap: true, land: quer });
      document.body.appendChild(halter); passeAn(halter);
      try { await document.fonts.ready; bilder.push(await htmlToImage.toPng(halter, { pixelRatio: 2, style: { position: "static", left: "0", top: "0" } })); }
      catch { /* eine Karte überspringen */ } finally { halter.remove(); }
    }
    $("outMany").innerHTML = bilder.map((src, i) => `<img src="${src}" alt="${esc(karten[i].name)}">`).join("");
  }
  // Drucken: Karten immer im Postkartenformat (Gegner quer 15 × 10 cm, Helden hoch 10 × 15 cm), mit 2 mm Rand.
  // Helden gibt es zusätzlich als Heldenbogen auf A4 – der ändert sich mit dem Helden und wird vor dem Spiel neu gedruckt.
  const DRUCKFORMATE = [["auto", "Helden als Heldenbogen A4, Gegner als Postkarte"], ["postkarte", "Alles als Postkarte 15 × 10 cm"]];
  const DRUCKBREITE = { "postkarte-quer": "144mm", "postkarte-hoch": "96mm" };
  const druckFormat = () => { try { const f = localStorage.getItem("kartenschmiede-druck"); return DRUCKFORMATE.some(([id]) => id === f) ? f : "auto"; } catch { return "auto"; } };
  const stufeVon = k => R.stufeFuerPunkte(R.punkte(k).pts);
  function heldenbogen(k) {
    const zaeh = (parseInt(k.tough, 10) || 1) * (parseInt(k.size, 10) || 1);
    const kaestchen = (n, rund, voll = 0) => `<div class="kaestchen${rund ? " rund" : ""}">${Array.from({ length: n }, (_, i) => `<i${i < voll ? ' class="voll"' : ""}></i>`).join("")}</div>`;
    const ep = Math.max(0, +k.ep || 0);
    const zeilen = (texte, n) => Array.from({ length: n }, (_, i) => `<div>${esc(texte[i] || "")}</div>`).join("");
    const beute = String(k.beute || "").split(/\n|,\s*/).map(x => x.trim()).filter(Boolean);
    const verlauf = (Array.isArray(k.verlauf) ? k.verlauf : []).slice(-6).map(v => `${v.d}: ${v.t}`);
    const skills = Array.isArray(k.skills) ? k.skills : [];
    return `<div class="heldenbogen">
      <div class="hb-karte">${renderCard(k, stufeVon(k), { snap: true, land: false })}</div>
      <div class="hb-seite">
        <h2>${esc(k.name || "Held")}</h2>
        <p class="hb-unter">${esc(k.faction || "Helden")} · ${R.punkte(k).pts} Punkte · Stand ${new Date().toLocaleDateString("de-DE")}</p>
        <h3>Erfahrung${ep > 20 ? ` (${ep})` : ""}</h3>${kaestchen(20, false, Math.min(ep, 20))}
        <h3>Power</h3>${kaestchen(6, true)}
        <h3>Wunden (Zäh ${zaeh})</h3>${kaestchen(Math.min(zaeh, 40))}
        <h3>Ausrüstung und Beute</h3><div class="linien">${zeilen(beute, Math.max(5, beute.length))}</div>
        <h3>Notizen und Verlauf</h3><div class="linien">${zeilen(verlauf, 6)}</div>
      </div>
      ${skills.length ? `<div class="hb-faeh"><h3>Fähigkeiten</h3><div class="hb-spalten">${skills.map(f => `<p>${tagIcons(f.tags, false)}<b>${esc(f.name)}</b> <small>(${esc(kostenText(f.kosten))})</small> – ${symText(f.text)}</p>`).join("")}</div></div>` : ""}
    </div>`;
  }
  // Rückseite für Postkarten: Seltenheitsrahmen, großes Fraktionssymbol, Name und Stufe – symmetrisch, damit sie beim
  // beidseitigen Druck egal wie gewendet passt
  const mitRueckseite = () => { try { return localStorage.getItem("kartenschmiede-rueckseite") === "1"; } catch { return false; } };
  function rueckseite(k, tier, land) {
    return `<div class="cw"><article class="card t${tier} rueck${land ? " land" : ""}">
      <div class="face rueck-face">
        <div class="rueck-symbol">${ico(iconFuer(k))}</div>
        <div class="rueck-name">${esc(k.name || "")}</div>
        <div class="rueck-stufe"><span class="pips">${[1, 2, 3, 4, 5, 6].map(n => `<span class="pip${n <= tier ? " on" : ""}"></span>`).join("")}</span>${esc(STUFEN[tier])}</div>
        <div class="rueck-fuss">Olympiade der Welten · Age of Fantasy Quest</div>
      </div>
      ${tier >= 3 ? ["tl", "tr", "bl", "br"].map(c => sym(tier === 6 ? "c-crown" : tier === 5 ? "c-filigree" : "c-bracket", "corner " + c)).join("") : ""}
    </article></div>`;
  }
  function drucken(karten, format = druckFormat()) {
    const bereich = $("printArea");
    bereich.innerHTML = karten.map(k => {
      if (format === "auto" && k.role === "hero") return heldenbogen(k);
      const seite = k.orient === "land" ? "postkarte-quer" : "postkarte-hoch";
      const vorne = `<div class="seite ${seite}" style="--breite:${DRUCKBREITE[seite]}">${renderCard(k, stufeVon(k), { snap: true, land: k.orient === "land" })}</div>`;
      return vorne + (mitRueckseite() ? `<div class="seite ${seite}" style="--breite:${DRUCKBREITE[seite]}">${rueckseite(k, stufeVon(k), k.orient === "land")}</div>` : "");
    }).join("");
    bereich.classList.add("bereit");
    passeAn(bereich);
    requestAnimationFrame(() => window.print());
  }



  // ---------- Tag-Filter und Prägung (gemeinsam für Werkstatt, Baukasten, Gruppe) ----------
  // Jede Liste hat ihren eigenen Filter; ein Klick auf einen Tag zeichnet die Liste über ihren Rückruf neu.
  const FILTER = {}, NEU_ZEICHNEN = {};
  const filterVon = schluessel => FILTER[schluessel] || (FILTER[schluessel] = { tags: new Set(), typ: "" });
  // Dieselben Kategorien wie im Reiter „Datenbank“
  const TYP_KURZ = KAT.KATEGORIEN.filter(k => k.id === "faehigkeiten" || k.id === "ausruestung").map(k => [k.id, k.name, k.typen]);
  function tagLeiste(schluessel, eintraege, neuZeichnen) {
    NEU_ZEICHNEN[schluessel] = neuZeichnen;
    const f = filterVon(schluessel);
    const tags = KAT.TAGS.filter(t => eintraege.some(e => (e.tags || []).includes(t.id)));
    const typen = TYP_KURZ.filter(([, , t]) => eintraege.some(e => t.includes(e.typ)));
    return `<div class="tagleiste" data-leiste="${schluessel}">${typen.length > 1 ? typen.map(([id, n]) => `<button type="button" class="chip-f" data-ftyp="${id}" aria-pressed="${f.typ === id}">${n}</button>`).join("") : ""}${tags.map(t =>
      `<button type="button" class="chip-f" data-ftag="${t.id}" aria-pressed="${f.tags.has(t.id)}" data-tip="${esc(t.name)}">${tagIco(t.id)}</button>`).join("")}${f.tags.size || f.typ ? `<button type="button" class="chip-f" data-freset="1">× Filter</button>` : ""}</div>`;
  }
  const filterPasst = (schluessel, e) => { const f = filterVon(schluessel); return (!f.typ || KAT.kategorieVon(e.typ) === f.typ) && [...f.tags].every(t => (e.tags || []).includes(t)); };
  document.addEventListener("click", e => {
    const b = e.target.closest(".tagleiste button"); if (!b) return;
    const schluessel = b.closest(".tagleiste").dataset.leiste, f = filterVon(schluessel);
    if (b.dataset.ftag) { if (f.tags.has(b.dataset.ftag)) f.tags.delete(b.dataset.ftag); else f.tags.add(b.dataset.ftag); }
    else if (b.dataset.ftyp) f.typ = f.typ === b.dataset.ftyp ? "" : b.dataset.ftyp;
    else { f.tags.clear(); f.typ = ""; }
    if (NEU_ZEICHNEN[schluessel]) NEU_ZEICHNEN[schluessel]();
  });
  const praegungVon = s => Array.isArray(s && s.praegung) ? s.praegung : [];
  const konfliktVon = (f, s) => KAT.konflikt(f, praegungVon(s));
  const konfliktText = k => `Gesperrt: Die Prägung ${TAG[k.praegung].name} verträgt keine ${TAG[k.tag].name}-Einträge.`;
  const praegTip = t => { const e = R.ELEMENT[t]; return e ? `<b>Prägung ${e.name}</b>Gesperrt: alle ${R.ELEMENT[e.gegen].name}-Einträge. Resistent gegen ${e.name}-Angriffe, verwundbar durch ${R.ELEMENT[e.gegen].name}-Angriffe.` : ""; };
  function zeigePraegung() {
    const an = praegungVon(state);
    $("praegung").innerHTML = KAT.PRAEGUNGEN.filter(t => TAG[t]).map(t => `<button type="button" class="chip-f" data-praeg="${t}" aria-pressed="${an.includes(t)}" data-tip="${esc(praegTip(t))}">${tagIco(t)}${esc(TAG[t].name)}</button>`).join("");
  }

  // ---------- Fähigkeiten: Werkstatt, Datenbank, eigene Einträge ----------
  // Auswahl in der Werkstatt: Liste mit Suche und Tag-Filter, Beschreibung per Hover
  let pickerSuche = "";
  function zeigeSkills() {
    const rolle = state.role || "enemy";
    const skills = Array.isArray(state.skills) ? state.skills : [];
    zeigePraegung();
    $("skillChips").innerHTML = skills.length ? skills.map(k => { const kf = konfliktVon(k, state); return `<span class="skill-chip${kf ? " konflikt" : ""}" data-tip="${esc(kf ? `<b>${esc(k.name)}</b>${esc(konfliktText(kf))}` : tipText(k))}">${tagIcons(k.tags, false)}${esc(k.name)} <small>${kostenText(k.kosten)}</small><button type="button" data-skill-weg="${esc(k.id)}" aria-label="${esc(k.name)} entfernen">×</button></span>`; }).join("")
      : `<span class="hint">Noch keine.</span>`;
    const q = pickerSuche.toLowerCase();
    const fuerRolle = alleFaehigkeiten().filter(f => f.fuer.includes(rolle));
    const kandidaten = fuerRolle.filter(f => !skills.some(k => k.id === f.id) && filterPasst("werkstatt", f) && (!q || (f.name + " " + f.text).toLowerCase().includes(q)));
    const frei = kandidaten.filter(f => !konfliktVon(f, state));
    const gesperrt = kandidaten.length - frei.length;
    const kopf = $("skillPicker").querySelector(".picker-head");
    if (!kopf) {
      $("skillPicker").innerHTML = `<div class="picker-head"><input type="search" id="pickerSuche" placeholder="Fähigkeit suchen" aria-label="Fähigkeit suchen"></div><div id="pickerTags"></div><div class="picker-list" id="pickerListe"></div>`;
      $("pickerSuche").addEventListener("input", e => { pickerSuche = e.target.value; zeigeSkills(); });
    }
    $("pickerTags").innerHTML = tagLeiste("werkstatt", fuerRolle, zeigeSkills);
    $("pickerListe").innerHTML = frei.map(f => `<button type="button" class="picker-item" data-add="${esc(f.id)}" data-tip="${esc(tipText(f))}">
        <span>${tagIcons(f.tags, false)}${esc(f.name)} <small>${esc(f.art)}</small></span><small>${kostenText(f.kosten)}</small></button>`).join("")
      || `<p class="hint">Nichts gefunden.</p>`;
    if (gesperrt) $("pickerListe").insertAdjacentHTML("beforeend", `<p class="gesperrt-hinweis">${gesperrt} weitere durch die Prägung gesperrt.</p>`);
    // Waffen aus der Datenbank
    $("weaponAdd").innerHTML = `<option value="">Waffe aus der Datenbank hinzufügen …</option>` + alleEintraege().filter(e => e.typ === "waffe")
      .map(e => `<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.text || e.waffe)}</option>`).join("");
  }
  // Eintrag aus der Datenbank auf die aktuelle Karte legen
  function aufKarte(f) {
    if (f.typ !== "fraktion" && konfliktVon(f, state)) return false;
    if (f.typ === "waffe") state.weapons = [state.weapons, f.waffe].filter(x => x && x.trim()).join("\n");
    else if (f.typ === "fraktion") state.faction = f.name;
    else if (!(state.skills || []).some(k => k.id === f.id)) state.skills = (state.skills || []).concat(skillKopie(f));
    bModell = null; insFormular(); alles(); simOptionen();
    return true;
  }

  const API_F = "/api/kartenschmiede/faehigkeiten";
  async function ladeEigene() {
    if (SERVER) {
      try { const r = await fetch(API_F, { credentials: "same-origin" }); if (r.ok) eigene = (await r.json()).faehigkeiten || []; } catch { /* offline */ }
    } else {
      try { eigene = JSON.parse(localStorage.getItem("kartenschmiede-faehigkeiten") || "[]"); } catch { eigene = []; }
    }
  }
  async function sichereEigene() {
    if (SERVER) {
      const r = await fetch(API_F, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faehigkeiten: eigene }) });
      if (!r.ok) throw new Error("Speichern fehlgeschlagen");
      eigene = (await r.json()).faehigkeiten;
    } else {
      try { localStorage.setItem("kartenschmiede-faehigkeiten", JSON.stringify(eigene)); } catch { /* voll */ }
    }
  }
  const slug = s => String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "faehigkeit";
  async function nimmAuf(f) {
    let id = slug(f.id || f.name);
    while (GRUND.some(g => g.id === id) || (eigene.some(e => e.id === id) && f.id !== id)) id += "-2";
    const eintrag = { id, typ: f.typ || "faehigkeit", name: f.name, art: f.art || "Sonderregel", fuer: f.fuer && f.fuer.length ? f.fuer : ["hero", "companion", "enemy"],
      tags: (f.tags || []).filter(t => TAG[t]), kosten: { typ: f.kosten && f.kosten.typ === "fest" ? "fest" : "prozent", wert: +(f.kosten && f.kosten.wert) || 0 },
      text: f.text || "", quelle: f.quelle || "eigen" };
    if (eintrag.typ === "waffe") eintrag.waffe = f.waffe || "";
    if (eintrag.typ === "fraktion") eintrag.icon = f.icon || "rune";
    eigene = eigene.filter(e => e.id !== id).concat(eintrag);
    await sichereEigene();
    return eintrag;
  }

  // ---------- Karte als Text (für Vorschläge aus dem Chat) ----------
  function karteAlsText() {
    const { upload, ...rest } = state;
    const aus = {};
    ["name", "faction", "praegung", "role", "size", "quality", "defense", "tough", "weapons", "passives", "skills", "bossName", "bossText", "special", "flavor", "look"].forEach(k => { if (rest[k] !== undefined && rest[k] !== "") aus[k] = rest[k]; });
    if (upload) aus.art = "(eigenes Artwork, nicht im Text)";
    return JSON.stringify(aus, null, 2);
  }
  async function textUebernehmen() {
    const msg = $("jsonMsg");
    let d;
    try { d = JSON.parse($("cardJson").value.replace(/^```(?:json)?|```$/gm, "").trim()); } catch { msg.textContent = "Das ist kein gültiger Kartentext. Bitte den ganzen Block einfügen, mit den geschweiften Klammern."; return; }
    const neu = [], skills = [];
    for (const k of Array.isArray(d.skills) ? d.skills : []) {
      const id = typeof k === "string" ? k : k.id;
      const bekannt = id && findeFaehigkeit(id);
      if (bekannt && (typeof k === "string" || !k.text)) { skills.push(skillKopie(bekannt)); continue; }
      if (typeof k === "object" && k.name) { const e = await nimmAuf(k); neu.push(e.name); skills.push(skillKopie(e)); }
    }
    const behalte = { upload: state.upload, art: state.art, ax: state.ax, ay: state.ay, zoom: state.zoom, orient: state.orient };
    state = Object.assign({ special: "0", bossName: "", bossText: "", flavor: "", look: "", size: "1", role: "enemy" }, d, behalte, { skills, id: undefined });
    if (d.art && IMG[d.art]) state.art = d.art;
    if (!d.orient) state.orient = formatFuer(state.role);
    state.weapons = Array.isArray(d.weapons) ? d.weapons.join("\n") : String(d.weapons || "");
    state.passives = Array.isArray(d.passives) ? d.passives.join(", ") : String(d.passives || "");
    state.praegung = Array.isArray(d.praegung) ? d.praegung.filter(t => KAT.PRAEGUNGEN.includes(t)) : [];
    bModell = null; insFormular(); alles();
    msg.textContent = `Übernommen: ${state.name}.${neu.length ? ` Neu in der Datenbank: ${neu.join(", ")}.` : ""} Das Artwork bleibt, bis du ein neues hochlädst.`;
  }

  // ---------- Verdrahtung ----------
  $("preset").innerHTML = VORLAGEN.map(v => `<option value="${v.key}">${esc(v.label)}</option>`).join("");
  $("tiers").innerHTML = [1, 2, 3, 4, 5, 6].map(t => `<button type="button" data-t="${t}" aria-pressed="false">${STUFEN[t]}<small>${R.GRENZEN_TEXT[t]}</small></button>`).join("");
  $("preset").addEventListener("change", e => vorlage(e.target.value));
  // Stufe wählen: Der Rahmen hängt fest an den Punkten, also passt ein Klick die Einheit an – Werte und Zahl der Fähigkeiten
  const stufeWaehlen = t => {
    const { karte, neu, weg } = KAT.skaliere(state, t, alleFaehigkeiten());
    state = Object.assign(state, karte);
    bModell = null; insFormular(); alles(); simOptionen();
    $("saveMsg").textContent = `Auf ${STUFEN[state.tier]} angepasst: ${state.points} Punkte, Qualität ${state.quality}, Verteidigung ${state.defense}, Zäh ${state.tough}.`
      + (neu.length ? ` Neu: ${neu.join(", ")}.` : "") + (weg.length ? ` Entfernt: ${weg.join(", ")}.` : "");
  };
  // Gegner und Gefährten im Querformat (Platz für mehrere Fähigkeiten), Helden im Hochformat
  function formatFuer(rolle) { return rolle === "hero" ? "port" : "land"; }
  $("tiers").addEventListener("click", e => { const b = e.target.closest("button"); if (b) stufeWaehlen(+b.dataset.t); });
  $("ladder").addEventListener("click", e => { const b = e.target.closest(".rung"); if (b) stufeWaehlen(+b.dataset.t); });
  document.querySelectorAll(".toolbar .seg button").forEach(b => b.addEventListener("click", () => { state.orient = b.dataset.o; insFormular(); alles(); }));
  $("editor").addEventListener("submit", e => e.preventDefault());
  let takt;
  $("editor").addEventListener("input", e => {
    const id = e.target.id;
    if (!FELDER.includes(id)) return;
    state[id] = ["ax", "ay", "zoom"].includes(id) ? +e.target.value : e.target.value;
    if (["quality", "defense", "tough", "size", "weapons", "passives", "special", "role"].includes(id)) bModell = null;
    if (id === "role") state.orient = formatFuer(state.role);
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
        state.art = "upload"; state.ax = 50; state.ay = 35; state.zoom = 100;
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
      $("outImg").hidden = false; $("outMany").innerHTML = "";
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
  $("bControls").addEventListener("click", e => { const b = e.target.closest("button[data-act]"); if (b && !b.disabled) aktion(b.dataset.act); });
  $("bControls").addEventListener("change", e => { if (e.target.classList.contains("wname")) { bModell.waffen[+e.target.dataset.w].name = e.target.value || "Waffe"; modellUebernehmen(); } });
  $("bBudget").addEventListener("change", e => { bModell.budget = Math.max(20, +e.target.value || 100); modellUebernehmen(); });
  $("bNewHero").addEventListener("click", () => frisch("hero"));
  $("bNewEnemy").addEventListener("click", () => frisch("enemy"));
  $("bElite").addEventListener("click", eliteVersion);
  $("simRun").addEventListener("click", simStart);
  $("simFair").textContent = "Balance-Test: Fern gegen Nah";
  $("simFair").addEventListener("click", balance);
  $("simCheck").addEventListener("click", preisCheck);
  if (SERVER) {
    $("saveBtn").hidden = false;
    $("saveBtn").addEventListener("click", speichern);
    meineKarten();
  }

  $("skillPicker").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) { const f = findeFaehigkeit(b.dataset.add); if (f) aufKarte(f); } });
  $("skillChips").addEventListener("click", e => {
    const b = e.target.closest("[data-skill-weg]"); if (!b) return;
    state.skills = (state.skills || []).filter(k => k.id !== b.dataset.skillWeg); bModell = null; alles();
  });
  $("weaponAdd").addEventListener("change", e => { const f = findeFaehigkeit(e.target.value); if (f) aufKarte(f); e.target.value = ""; });
  $("faction").addEventListener("change", e => {
    state.faction = e.target.value;
    const fr = fraktionVon(state.faction);
    if (fr && fr.praegung && fr.praegung.length && !praegungVon(state).length) state.praegung = fr.praegung.slice();
    alles();
  });
  $("praegung").addEventListener("click", e => {
    const b = e.target.closest("[data-praeg]"); if (!b) return;
    const an = praegungVon(state), t = b.dataset.praeg;
    state.praegung = an.includes(t) ? an.filter(x => x !== t) : an.concat(t);
    bModell = null; alles();
  });

  // Tooltip: überall, wo data-tip steht (Fähigkeiten, Tags, Einträge)
  const tip = $("tip");
  const zeigeTip = (el, x, y) => {
    tip.innerHTML = el.dataset.tip.includes("<b>") ? el.dataset.tip : esc(el.dataset.tip);
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 14) + "px";
    tip.style.top = (y + 18 + r.height > window.innerHeight ? y - r.height - 12 : y + 18) + "px";
  };
  document.addEventListener("mouseover", e => { const el = e.target.closest("[data-tip]"); if (el) zeigeTip(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener("mousemove", e => { if (!tip.hidden) { const el = e.target.closest("[data-tip]"); if (el) zeigeTip(el, e.clientX, e.clientY); } });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-tip]"); if (el) { const r = el.getBoundingClientRect(); zeigeTip(el, r.left, r.bottom); } });
  document.addEventListener("focusout", () => { tip.hidden = true; });
  document.addEventListener("scroll", () => { tip.hidden = true; }, true);
  $("jsonIn").addEventListener("click", textUebernehmen);
  $("druckFormat").innerHTML = DRUCKFORMATE.map(([id, n]) => `<option value="${id}" ${id === druckFormat() ? "selected" : ""}>${n}</option>`).join("");
  $("druckFormat").addEventListener("change", e => { try { localStorage.setItem("kartenschmiede-druck", e.target.value); } catch { /* egal */ } });
  $("rueckBox").checked = mitRueckseite();
  $("rueckBox").addEventListener("change", e => { try { localStorage.setItem("kartenschmiede-rueckseite", e.target.checked ? "1" : "0"); } catch { /* egal */ } });
  $("druckBtn").addEventListener("click", () => drucken([JSON.parse(JSON.stringify(state))], $("druckFormat").value));
  $("jsonOut").addEventListener("click", () => { $("cardJson").value = karteAlsText(); $("jsonMsg").textContent = "Das ist die aktuelle Karte als Text, ohne das Artwork."; });
  // Bearbeiten mit Formular oder Baukasten: dieselbe Karte, zwei Ansichten
  let modus = "form";
  try { modus = localStorage.getItem("kartenschmiede-modus") === "bau" ? "bau" : "form"; } catch { /* egal */ }
  function zeigeModus() {
    $("formModus").hidden = modus !== "form"; $("bauModus").hidden = modus !== "bau";
    document.querySelectorAll("#modus button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === modus)));
    if (modus === "bau") { bModell = null; baukasten(); }
  }
  $("modus").addEventListener("click", e => {
    const b = e.target.closest("button[data-m]"); if (!b) return;
    modus = b.dataset.m; try { localStorage.setItem("kartenschmiede-modus", modus); } catch { /* egal */ }
    zeigeModus();
  });
  zeigeModus();

  // Reiter „Regeln“: Tabelle der Elemente
  function zeigeElemente() {
    $("elemente").innerHTML = `<div class="tbl-wrap"><table class="el-tabelle">
      <thead><tr><th>Element</th><th>Gegenteil</th><th>Prägung sperrt</th><th>Resistent gegen</th><th>Verwundbar durch</th><th>Waffenwort</th></tr></thead>
      <tbody class="static">${R.ELEMENTE.map(e => { const g = R.ELEMENT[e.gegen]; return `<tr>
        <td><span class="el-name">${tagIco(e.id)}${esc(e.name)}</span></td><td><span class="el-name">${tagIco(g.id)}${esc(g.name)}</span></td>
        <td>alle ${esc(g.name)}-Einträge</td><td>${esc(e.name)}-Angriffe (+1 Verteidigung)</td><td>${esc(g.name)}-Angriffe (−1 Verteidigung)</td><td><code>${esc(e.wort)}</code></td></tr>`; }).join("")}</tbody>
    </table></div>
    <div class="el-regeln">
      <p><b>Prägung</b> – was eine Einheit ihrem Wesen nach ist. Sie sperrt alle Fähigkeiten, Zauber, Gegenstände und Waffen mit dem Gegen-Element: Ein Feuerelementar lernt keine Frostzauber, eine Sci-Fi-Einheit keine Magie. Die Fraktion schlägt eine Prägung vor (Dämonen Feuer, Frostvolk Frost, Untote Schatten, Elfen Natur, Urwild Gift).</p>
      <p><b>Element einer Waffe</b> – ein Wort bei den Regeln, zum Beispiel <code>Frostklauen | Nahkampf | A4 | Reißend, Frost</code>. Trifft die Waffe eine Einheit derselben Prägung, würfelt das Ziel seine Verteidigung mit +1, bei der Gegen-Prägung mit −1. Alle anderen Ziele: keine Änderung.</p>
      <p><b>Punkte</b> – Elemente kosten nichts: Mal nützen sie, mal schaden sie. Der Duell-Simulator würfelt sie mit.</p>
        </div>
    <h3 style="margin-top:28px">Symbole in Regeltexten</h3>
    <p class="hint">Statt „erleidet 2 Treffer mit Durchschlag 1“ steht auf der Karte ein Schwert mit 2 und ein Durchschlag-Pfeil mit 1. Beim Hovern erscheint die Erklärung. Eigene Texte nutzen dieselben Kürzel in geschweiften Klammern.</p>
    <div class="sym-legende">${[["P1"], ["Z4"], ["S"], ["RU"], ["A2"], ["A+1"], ["DS1"], ["V+1"], ["T-1"], ["HW3"], ["W1"], ["R12"], ["F3"], ["B6"], ["X"], ["D4"]]
      .map(([c]) => { const m = c.match(/^(RU|DS|[A-Z])(.*)$/); return `<div>${symbol(m[1], m[2])}<span>${esc(SYMBOLTEXT[m[1]].tip(m[2]))}</span> <code>{${c}}</code></div>`; }).join("")}</div>`;
  }

  // Reiter
  const reiter = name => {
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $("tabKarten").hidden = name !== "karten"; $("tabGruppe").hidden = name !== "gruppe"; $("tabDb").hidden = name !== "db"; $("tabRegeln").hidden = name !== "regeln";
    if (name === "regeln") { zeigeElemente(); passeAn($("ladder")); }
    if (name === "gruppe" && window.KartenschmiedeGruppe) window.KartenschmiedeGruppe.zeigen();
    if (name === "db" && window.KartenschmiedeDatenbank) window.KartenschmiedeDatenbank.zeigen();
    try { history.replaceState(null, "", "#" + name); } catch { /* egal */ }
  };
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => reiter(b.dataset.tab)));

  // Schnittstelle für den Reiter „Gruppe“ (gruppe.js)
  window.KS = {
    symText, klarText, SYMBOLTEXT, symbol, tagLeiste, filterPasst, konfliktVon, konfliktText, praegungVon, tagIco, ladeKarte, loescheKarte,
    serverKarten: () => serverKarten,
    vorlageLaden: key => { vorlage(key); reiter("karten"); $("h-shop").closest("section").scrollIntoView({ behavior: "smooth" }); },
    R, IMG, SERVER, STUFEN, ROLLEN, TAG, KAT, esc, ico, renderCard, passeAn, alleFaehigkeiten, alleEintraege, findeFaehigkeit, skillKopie, kostenText,
    tagIcons, tipText, iconFuer, VORLAGEN, nimmAuf, sichereEigene, aufKarte,
    eigeneIds: () => new Set(eigene.map(e => e.id)),
    async loescheEigenen(id) { eigene = eigene.filter(f => f.id !== id); await sichereEigene(); alles(); },
    nachAenderung() { insFormular(); alles(); simOptionen(); },
    zeigeReiter: name => reiter(name),
    oeffneInWerkstatt(karte) { state = Object.assign({ orient: formatFuer(karte.role) }, JSON.parse(JSON.stringify(karte))); bModell = null; insFormular(); alles(); reiter("karten"); $("h-shop").closest("section").scrollIntoView({ behavior: "smooth" }); },
    aktuelleKarte: () => JSON.parse(JSON.stringify(state)),
    zeigePngs, drucken, DRUCKFORMATE, druckFormat, rueckseite, mitRueckseite,
  };

  const gemerkt = lade();
  if (gemerkt && gemerkt.name !== undefined) { state = gemerkt; insFormular(); alles(); } else vorlage("frostfang");
  simOptionen();
  ladeEigene().then(() => { insFormular(); alles(); if (window.KartenschmiedeDatenbank) window.KartenschmiedeDatenbank.neu(); });
  if (location.hash === "#gruppe") reiter("gruppe");
  if (location.hash === "#db") reiter("db");
  if (location.hash === "#regeln") reiter("regeln");
})();

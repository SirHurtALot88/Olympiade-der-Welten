// Disziplin-Bühne: Echt-Daten-Injektions-Hook in die 20 Arena-Szenen einspielen.
//
// WANN NEU AUSFÜHREN: Immer wenn die Szenen unter public/discipline-scenes/
// neu generiert werden (z.B. Kit-Sweep) — sonst fehlt die Anbindung an die
// In-Game-Disziplin-Bühne. Idempotent (ersetzt einen bereits vorhandenen Block).
//   npm run scenes:inject-bridge
//
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "discipline-scenes");
const START = "/* ===== OLY-STAGE-BRIDGE START ===== */";
const END = "/* ===== OLY-STAGE-BRIDGE END ===== */";

const BRIDGE = `
  ${START}
  // Echt-Daten-Injektion für die In-Game-Disziplin-Bühne (Test-Modus).
  // Läuft INNERHALB der Szenen-IIFE. Nimmt die szenen-eigenen Spieler (behält
  // alle szenenspezifischen Felder) und legt echte val/name/mods darüber.
  (function olyStageBridge(){
    function apply(d){
      try {
        if (!d || !Array.isArray(d.teams)) return;
        var byCode = {};
        d.teams.forEach(function(rt){ byCode[rt.code] = rt; });
        var N = (Array.isArray(d.slots) && d.slots.length) ? d.slots.length : 5;
        try {
          var hasSlots = (typeof SLOTS !== "undefined" && SLOTS && typeof SLOTS.length === "number");
          // SLOTS nur umschreiben, wenn es ein reines String-Label-Array ist
          // (manche Szenen aliasen SLOTS auf Objekt-Rollen — die nicht anfassen).
          var slotsAreStrings = hasSlots && SLOTS.length > 0 && SLOTS.every(function(x){ return typeof x === "string"; });
          if (slotsAreStrings && Array.isArray(d.slots) && d.slots.length) {
            // Slot-ZAHL auf die echte playerCount bringen, aber die szenen-eigenen
            // Label-WERTE behalten (manche Szenen nutzen SLOTS-Werte als Lookup-Keys).
            var target = d.slots.length;
            if (target <= SLOTS.length) {
              SLOTS.length = target;
            } else {
              while (SLOTS.length < target) {
                SLOTS.push(d.slots[SLOTS.length] || ("Slot " + (SLOTS.length + 1)));
              }
            }
            N = SLOTS.length;
            if (typeof buildQueue !== "undefined") {
              buildQueue = function(){ queue = []; for (var r = 0; r < SLOTS.length; r++) { queue.push({ round: r }); } };
            }
          } else if (hasSlots) {
            // Szene behält ihre native Slot-Zahl; Spieler darauf auffüllen/kürzen.
            N = SLOTS.length;
          }
        } catch (e) {}
        try {
          if (typeof TEAM_NAMES !== "undefined") {
            d.teams.forEach(function(rt){ if (rt.name) TEAM_NAMES[rt.code] = rt.name; });
          }
        } catch (e) {}
        try {
          // Eigenes Team nur umschalten, wenn der Code wirklich existiert — sonst
          // wäre KEIN Team "mine" und reset() (teams.find(t=>t.mine)) würfe.
          if (d.mineCode && typeof teams !== "undefined" && teams.some(function(t){ return t.code === d.mineCode; })) {
            teams.forEach(function(t){ t.mine = (t.code === d.mineCode); });
            // Team-Farben neu setzen: das ECHTE eigene Team bekommt die Mine-Optik
            // (orange), Ex-Mine (M-M) fällt auf seine reguläre Hue-Farbe zurück.
            teams.forEach(function(t){
              if (t.mine) {
                t.color = "#e07a2b";
                t.accent = "#3a2415";
              } else {
                var h = (typeof hueFor === "function") ? hueFor(t.i) : ((t.i * 360 / 32) % 360);
                t.color = "hsl(" + h + " 58% 52%)";
                t.accent = "hsl(" + ((h + 150) % 360) + " 62% 78%)";
              }
              t.crest = null; // erzwingt Neuzeichnung mit der aktualisierten Farbe/Logo
            });
          }
        } catch (e) {}
        // Echte Team-Logos: auf Team legen (Ladder-<img>) + fürs Canvas vorladen.
        try {
          if (typeof teams !== "undefined") {
            d.teams.forEach(function(rt){
              var t = teams.find(function(x){ return x.code === rt.code; });
              if (!t) return;
              t.logoUrl = rt.logoUrl || null;
              if (rt.logoUrl) {
                t.crest = rt.logoUrl;
                if (!t.logoImg) {
                  var im = new Image();
                  im.onload = function(){ t.logoImg = im; try { if (typeof drawScene === "function") drawScene(); } catch (e) {} };
                  im.src = rt.logoUrl;
                }
              }
            });
          }
        } catch (e) {}
        // Original EINMALIG cachen — sonst wächst bei jedem Payload-Post eine
        // verschachtelte Wrapper-Kette (Leak + unnötige rollMods-Würfe).
        if (!window.__olyOrigGen) { window.__olyOrigGen = genPlayers; }
        var ORIG_GEN = window.__olyOrigGen;
        genPlayers = function(t){
          var rt = byCode[t.code];
          var src = (rt && Array.isArray(rt.players)) ? rt.players : [];
          // Szenen-eigene Spieler erzeugen → behalten alle szenenspezifischen Felder.
          var natives = [];
          try { natives = ORIG_GEN(t) || []; } catch (e) { natives = []; }
          var out = [];
          for (var k = 0; k < N; k++) {
            var base = (natives[k] && typeof natives[k] === "object") ? Object.assign({}, natives[k]) : {};
            var p = src[k];
            if (!p) {
              base.val = 0;
              if (base.name == null) base.name = "\\u2014";
              base.mods = [];
              out.push(base);
              continue;
            }
            base.val = (p.val || 0);
            base.name = p.name || base.name || "\\u2014";
            base.portraitUrl = p.portraitUrl || base.portraitUrl || null;
            base.traits = Array.isArray(p.traits) ? p.traits : (base.traits || []);
            if (d.mode === "random") {
              var mods = (typeof rollMods === "function") ? rollMods() : [];
              // Generischen szenen-eigenen "Mutator"-Mod rauswerfen — die echten
              // Mutatoren sind die Trait-Mods (unten); sonst doppelt/verwirrend.
              mods = mods.filter(function(m){ return m.k !== "Mutator"; });
              mods.forEach(function(m){ if (m.injury) m.amt = Math.max(1, Math.round((p.val || 0) * 0.5)); });
              // Trait-Mutatoren: +6 je passendem Trait, nur für Spieler die ihn haben.
              if (Array.isArray(p.traitMods)) {
                p.traitMods.forEach(function(tm){ mods.push({ k: tm.k, sign: tm.sign, amt: tm.amt }); });
              }
              base.mods = mods;
            } else {
              base.mods = Array.isArray(p.mods) ? p.mods.map(function(m){ return { k: m.k, sign: m.sign, amt: m.amt, injury: !!m.injury }; }) : [];
            }
            out.push(base);
          }
          return out;
        };
        // Einmalige Funktions-Patches (echte Bilder, 1-Dezimal-Punkte, Medaillen-Fix).
        if (!window.__olyPatched) {
          window.__olyPatched = true;
          function f1(x){ var v = Math.round((x || 0) * 10) / 10; return (v % 1 === 0) ? String(v) : v.toFixed(1); }
          // Szene den verfügbaren Platz nutzen lassen (das eingebettete iframe ist
          // breiter als das native 1280er-Cap; die Canvas skaliert via width:100%).
          try {
            var wst = document.createElement("style");
            wst.textContent = ".wrap{max-width:100%!important;padding:10px 14px!important;} .stage{grid-template-columns:1fr 360px!important;}";
            document.head.appendChild(wst);
          } catch (e) {}
          // Canvas-Tokens: echtes Logo statt prozeduralem Wappen.
          try {
            if (typeof paintCrest !== "undefined") {
              var _paint = paintCrest;
              paintCrest = function(c2, cx, cy, r, t, withLetter){
                if (t && t.logoImg && t.logoImg.complete && t.logoImg.naturalWidth) {
                  try {
                    c2.save();
                    c2.beginPath(); c2.arc(cx, cy, r, 0, Math.PI * 2); c2.closePath(); c2.clip();
                    c2.drawImage(t.logoImg, cx - r, cy - r, r * 2, r * 2);
                    c2.restore();
                    c2.beginPath(); c2.arc(cx, cy, r, 0, Math.PI * 2);
                    c2.lineWidth = t.mine ? Math.max(2, r * 0.16) : Math.max(1.5, r * 0.11);
                    c2.strokeStyle = t.mine ? "#fff" : "rgba(255,255,255,.55)"; c2.stroke();
                    return;
                  } catch (e) {}
                }
                return _paint(c2, cx, cy, r, t, withLetter);
              };
            }
          } catch (e) {}
          // Ladder-<img>: echte Logo-URL statt gemaltem DataURL.
          try {
            if (typeof crestURL !== "undefined") {
              var _crestURL = crestURL;
              crestURL = function(t, size){ if (t && t.logoUrl) return t.logoUrl; return _crestURL(t, size); };
            }
          } catch (e) {}
          // Spotlight: echtes Spieler-Portrait des hervorgehobenen Spielers.
          try {
            if (typeof showSpotlight !== "undefined") {
              var _spot = showSpotlight;
              showSpotlight = function(o){
                _spot(o);
                try {
                  if (o && o.player && o.player.portraitUrl) {
                    var el = document.getElementById("spCrest");
                    if (el) el.src = o.player.portraitUrl;
                  }
                } catch (e) {}
              };
            }
          } catch (e) {}
          // Skill-Punkte im Ladder mit max. 1 Nachkommastelle.
          try {
            if (typeof fmtScore !== "undefined") {
              fmtScore = function(t){
                var g = t.score - (t.roundStartScore || 0);
                return f1(t.score) + (g > 0.05 ? " (+" + f1(g) + ")" : "");
              };
            }
          } catch (e) {}
          // Netto pro Reveal auf 1 Dezimale runden — bereinigt Float-Artefakte
          // (z.B. 45.800000004) in Ticker, Spotlight und Score-Pops.
          try {
            if (typeof applyReveal !== "undefined") {
              var _applyReveal = applyReveal;
              applyReveal = function(t, slot){
                var r = _applyReveal(t, slot);
                try { if (r && typeof r.net === "number") r.net = Math.round(r.net * 10) / 10; } catch (e) {}
                return r;
              };
            }
          } catch (e) {}
          // Runden-Medaillen: echte Top-3 der Runde (gegen ALLE Teams), Medaille nur
          // auf bereits aufgedeckten Teams — kein Fehl-Gold auf zuerst-aufgedeckte.
          try {
            if (typeof updateRoundMedals !== "undefined" && typeof modSum !== "undefined") {
              updateRoundMedals = function(round){
                try {
                  var ranked = teams.map(function(t){
                    var p = t.players[round];
                    return { t: t, net: p ? Math.max(0, p.val + modSum(p)) : -1 };
                  }).sort(function(a, b){ return b.net - a.net || (a.t.seasonRank || 0) - (b.t.seasonRank || 0); });
                  teams.forEach(function(t){ t.roundMedal = 0; });
                  ranked.slice(0, 3).forEach(function(o, idx){ if (o.t.thrownSlot === round) o.t.roundMedal = idx + 1; });
                } catch (e) { /* Medaillen niemals die Runde crashen lassen */ }
              };
            }
          } catch (e) {}
          // Lauf-Log: den angezeigten Rang auf den FINALEN Runden-Rang korrigieren
          // (roundRankAfter, eindeutig 1..N) statt des flackernden Live-Rangs beim
          // Reveal — sonst tragen mehrere Teams „#1".
          try {
            if (typeof logRow !== "undefined") {
              var _logRow = logRow;
              logRow = function(t, slot, res, impact){
                _logRow(t, slot, res, impact);
                try {
                  var tk = document.getElementById("ticker");
                  var row = tk && tk.firstElementChild;
                  var dl = row && row.querySelector(".dl");
                  if (dl && t.roundRankAfter != null) {
                    var rc = (typeof ampelColor === "function") ? ampelColor(t.roundRankAfter) : "";
                    var delta = (t.roundDelta != null) ? t.roundDelta : 0;
                    var rankSpan = rc ? ("<span style='color:" + rc + "'>#" + t.roundRankAfter + "</span>") : ("<span>#" + t.roundRankAfter + "</span>");
                    dl.className = "dl " + (delta > 0 ? "up" : delta < 0 ? "down" : "same");
                    dl.innerHTML = delta !== 0 ? (rankSpan + " (" + (delta > 0 ? "▲" : "▼") + Math.abs(delta) + ")") : rankSpan;
                  }
                } catch (e) {}
              };
            }
          } catch (e) {}
        }
        if (typeof reset === "function") { reset(); }
        // „Dein Team"-Label auf das ECHTE eigene Team setzen (Szene nutzt sonst
        // die Konstante MINE und zeigt z.B. M-M, obwohl das Save-Team P-S ist).
        try {
          var meTeam = (typeof teams !== "undefined") ? teams.find(function(t){ return t.mine; }) : null;
          if (meTeam && typeof TEAM_NAMES !== "undefined") {
            var lbl = document.querySelector(".mytrack .lbl") || document.querySelector(".mytrackname") || document.getElementById("mytrackname");
            if (lbl) { lbl.textContent = "Dein Team · " + meTeam.code + " · " + (TEAM_NAMES[meTeam.code] || meTeam.code); }
          }
        } catch (e) {}
      } catch (e) { /* Szene niemals crashen lassen */ }
    }
    // Quick-Sim: die ganze Disziplin ohne Animation sofort durchrechnen und die
    // Endstände + Podium zeigen (nutzt die vorhandene Reveal-Logik pro Runde).
    function quickSim(){
      try {
        if (typeof queue === "undefined" || typeof teams === "undefined") return;
        if (typeof busy !== "undefined" && busy) return;
        for (var si = (typeof stepIdx !== "undefined" ? stepIdx : 0); si < queue.length; si++) {
          var r = queue[si].round;
          if (typeof curSlot !== "undefined") { curSlot = r; }
          if (typeof clearMedals === "function") clearMedals();
          if (typeof resetRoundBest === "function") resetRoundBest();
          teams.forEach(function(t){ t.roundStartRank = t.rank; t.roundStartScore = t.score; });
          if (typeof computeRoundStandings === "function") computeRoundStandings(r);
          teams.slice().sort(function(a, b){ return b.rank - a.rank; }).forEach(function(t){
            if (typeof applyReveal === "function") applyReveal(t, r);
          });
          if (typeof recomputeRanksLive === "function") recomputeRanksLive();
        }
        stepIdx = queue.length;
        if (typeof positionLadder === "function") positionLadder(true);
        if (typeof updateControls === "function") updateControls();
        if (typeof updateMyTracker === "function") updateMyTracker();
        if (typeof drawScene === "function") drawScene();
        setTimeout(function(){ try { if (typeof showPodium === "function") showPodium(); } catch (e) {} }, 150);
      } catch (e) {}
    }
    try {
      window.addEventListener("message", function(ev){
        var d = ev && ev.data;
        if (d && d.type === "olyStageData") { apply(d); }
        else if (d && d.type === "olyStageQuickSim") { quickSim(); }
      }, false);
    } catch (e) {}
    try { (window.parent || window).postMessage({ type: "olyStageReady" }, "*"); } catch (e) {}
  })();
  ${END}
`;

const files = readdirSync(DIR).filter((f) => f.endsWith(".html") && f !== "index.html");
let done = 0;
for (const f of files) {
  const p = join(DIR, f);
  let src = readFileSync(p, "utf8");
  // Absicherung: SLOTS[k]-Labelzugriff gegen Unterlauf (kleinere echte Slot-Zahlen).
  src = src.replace(/SLOTS\[k\]\.toUpperCase\(\)/g, '(SLOTS[k]||"").toUpperCase()');
  // Hover-Karte: Spieler-Portrait als Avatar statt Team-Farbbox (wo verfuegbar).
  // String-Konkatenation statt verschachtelter Template-Literals (die brechen).
  src = src.replace(
    '<div class="av" style="background:${t.color}">${t.code.replace(\'-\',\'\')}</div>',
    '<div class="av" style="${p.portraitUrl?(\'background-image:url(\'+p.portraitUrl+\');background-size:cover;background-position:center\'):(\'background:\'+t.color)}">${p.portraitUrl?\'\':t.code.replace(\'-\',\'\')}</div>'
  );
  // Alten Bridge-Block (falls vorhanden) entfernen — idempotent.
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s >= 0 && e > s) {
    src = src.slice(0, s).replace(/\s*$/, "\n") + src.slice(e + END.length).replace(/^\s*\n/, "");
  }
  const idx = src.lastIndexOf("})();");
  if (idx < 0) {
    console.log("!! no IIFE close found:", f);
    continue;
  }
  src = src.slice(0, idx) + BRIDGE + "\n" + src.slice(idx);
  writeFileSync(p, src);
  done += 1;
  console.log("injected:", f);
}
console.log(`\\nDone: ${done}/${files.length} scenes.`);

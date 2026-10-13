/* Kartenschmiede – Spielmotor für den Reiter „Spielen“: spielt eine Map als Schritt-Graph ab.
   Reines JavaScript ohne DOM, damit dieselbe Datei im Browser läuft und in den Tests eine ganze Map durchspielt.

   Datenmodell und Begriffe: docs/design/moosgrab-spielmodus-konzept.md, Beispiel kampagnen/moosgrab/map1.json.
   - Eine Map hat `schritte` (id → Schritt), `start`, `leisten`, `flags`, `ereignisse`, `rundenende`, `gegner`, `fog`.
   - Der Spielstand ist reines JSON (wird auf dem Server gespeichert), der Motor schreibt nur in ihn hinein.
   - `runde` zählt BEENDETE Runden; angezeigt wird „Runde runde + 1“. Bedingungen auf `runde` lesen also beendete Runden.
   - Jede Aktion legt vorher einen Schnappschuss an, „Zurück“ stellt ihn wieder her (auch Wunden und Flags).
   - Ereignisse können eine `probe` tragen: Der Spieler würfelt einen W6, alle `stufen` mit `ab` ≤ Wurf kommen dazu.
   - Leisten können `schwellen` haben (Lärm 3, 4, 6): Sie lösen einmal aus, wenn die Leiste den Wert erreicht.
   - `lage` (Flucht, Sonderregeln, Ziele) und `rundenwurf` (ein W6 am Rundenende, meistens passiert nichts).
   - Gegner lassen sich im Spiel stärken und schwächen: `zusatz[].werte`, `gegnerMod` an Ereignissen und Antworten
     oder von Hand. Eine Anpassung zählt in Stufen, plus heißt stärker: quality/defense +1 = eine Stufe besser
     ("4+" → "3+"), tough +n, attacks +n auf jede Waffe, passives: ["Dornen"] fügt Regeln hinzu. */
(function (root) {
  "use strict";

  const kopie = x => JSON.parse(JSON.stringify(x));
  const MAX_UNDO = 80;
  const VERGLEICH = { "<=": (a, b) => a <= b, ">=": (a, b) => a >= b, "<": (a, b) => a < b, ">": (a, b) => a > b, "==": (a, b) => a === b };

  // hilfen: { werte(gegnerDef) → Kartenwerte, stufe(werte) → 1–6, zufall() → 0..1 }
  function erstelle(map, hilfen = {}) {
    const zufall = hilfen.zufall || Math.random;
    const jetzt = hilfen.jetzt || Date.now;
    const werteVon = def => (hilfen.werte ? hilfen.werte(def) : def.werte) || def.werte || {};
    const zaehVon = werte => Math.max(1, (parseFloat(werte.tough) || 1) * (parseInt(werte.size, 10) || 1));

    // ---------- Spielstand ----------
    function neu(opt = {}) {
      const flags = {}, leisten = {};
      for (const [k, f] of Object.entries(map.flags || {})) flags[k] = f.start === undefined ? null : f.start;
      for (const [k, l] of Object.entries(map.leisten || {})) leisten[k] = { wert: l.start || 0, aktiv: l.aktiv !== false };
      // Was aus früheren Maps kommt (Kampagnen-Leisten und Flags), überschreibt die Startwerte
      const ueber = opt.uebernahme || {};
      for (const [k, v] of Object.entries(ueber.leisten || {})) if (leisten[k] && map.leisten[k].gilt === "kampagne") leisten[k].wert = v;
      Object.assign(flags, ueber.flags || {});
      const state = {
        version: 1, kampagne: map.kampagne, map: map.map, name: opt.name || `${map.titel}`,
        schritt: null, verlauf: [], flags, leisten, runde: 0, rundenAktiv: false,
        gegner: [], gespawnt: {}, ereignisse: {}, angewendet: {}, wahlen: {}, checks: {}, kampfZiel: null,
        letzte: [], protokoll: [], undo: [], gruppeId: opt.gruppeId || null,
        schwellen: {}, tote: {}, pos: {}, sprung: null, log: [], inventar: {}, schrittSeit: jetzt(), typMod: {},
        extraGegner: {}, npcKampf: {}, extraNr: 0,
      };
      betrete(state, map.start);
      return state;
    }
    const merke = state => {
      const schnapp = kopie({ ...state, undo: [] });
      state.undo.push(schnapp);
      if (state.undo.length > MAX_UNDO) state.undo.shift();
    };
    function zurueck(state) {
      const alt = state.undo.pop();
      if (!alt) return false;
      // Figurenpositionen sind keine Spielaktion: Rückgängig lässt sie, wo Chris sie hingezogen hat
      const undo = state.undo, pos = state.pos;
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, alt, { undo, pos });
      return true;
    }
    // Ältere Spielstände kennen die neueren Felder noch nicht
    const migriere = state => {
      for (const k of ["schwellen", "tote", "pos", "inventar", "typMod", "extraGegner", "npcKampf"]) if (!state[k]) state[k] = {};
      if (!state.extraNr) state.extraNr = 0;
      registriere(state);
      if (!state.log) state.log = [];
      if (state.sprung === undefined) state.sprung = null;
      // Ein wieder geöffneter Abend fängt die Uhr des Schritts neu an
      state.schrittSeit = jetzt();
      return state;
    };
    const notiere = (state, text) => { state.protokoll.push({ runde: state.runde + 1, schritt: state.schritt, text }); if (state.protokoll.length > 500) state.protokoll.shift(); };

    // ---------- Logbuch ----------
    // Vergleicht den Stand nach einer Aktion mit dem Schnappschuss davor und hält fest, was sich an Leisten und
    // Entscheidungen (Flags) geändert hat. Eine Antwortwahl kommt immer hinein, alles andere nur mit Änderung.
    function logge(state, art, text) {
      const vorher = state.undo[state.undo.length - 1];
      if (!vorher) return;
      const leisten = [], flags = [];
      for (const [k, l] of Object.entries(state.leisten)) {
        const alt = (vorher.leisten[k] || {}).wert;
        if (alt !== undefined && alt !== l.wert) leisten.push({ id: k, name: ((map.leisten || {})[k] || {}).name || k, alt, neu: l.wert });
      }
      for (const [k, v] of Object.entries(state.flags)) {
        const def = (map.flags || {})[k] || {};
        // spaeter: die Entscheidung wirkt in einer späteren Map nach (z. B. "map3")
        const spaeter = ((def.wirktIn || "").match(/map(\d)/) || [])[1];
        if (vorher.flags[k] !== v && v !== null && v !== false && def.text) flags.push({ id: k, text: def.text, wert: v === true ? null : v, spaeter: spaeter && +spaeter > map.map ? +spaeter : null });
      }
      if (art !== "wahl" && !leisten.length && !flags.length) return;
      state.log = state.log || [];
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art, text, leisten, flags });
      if (state.log.length > 300) state.log.shift();
    }

    // ---------- Bedingungen ----------
    function gilt(state, w) {
      if (!w) return true;
      if (Array.isArray(w)) return w.every(x => gilt(state, x));
      if (w.alle) return w.alle.every(x => gilt(state, x));
      if (w.eine) return w.eine.some(x => gilt(state, x));
      if (w.flag !== undefined) {
        const v = state.flags[w.flag] === undefined ? null : state.flags[w.flag];
        if ("ist" in w) return v === w.ist;
        if ("nicht" in w) return v !== w.nicht;
        return !!v;
      }
      if (w.nicht) return !gilt(state, w.nicht);
      if (w.leisteAktiv) return !!(state.leisten[w.leisteAktiv] && state.leisten[w.leisteAktiv].aktiv);
      if (w.leiste) {
        const l = state.leisten[w.leiste];
        const wert = l ? l.wert : 0;
        return Object.entries(VERGLEICH).every(([op, f]) => !(op in w) || f(wert, w[op]));
      }
      if (w.runde) return (VERGLEICH[w.runde] || VERGLEICH[">="])(state.runde, +w.wert || 0);
      if (w.gegnerGefallen) {
        const alle = state.gegner.filter(g => g.id === w.gegnerGefallen);
        return alle.length > 0 && alle.every(g => g.wunden >= g.zaeh);
      }
      return true;
    }
    function ziel(state, weiter) {
      if (!weiter) return null;
      if (typeof weiter === "string") return weiter;
      for (const e of weiter) if (!e.wenn || gilt(state, e.wenn)) return e.ziel;
      return null;
    }

    // ---------- Wirkungen ----------
    const ersetze = (wert, eingabe) => (wert === "@held" ? (eingabe || "ein Held") : wert);
    function setze(state, setzt, eingabe) {
      for (const [k, v] of Object.entries(setzt || {})) state.flags[k] = ersetze(v, eingabe);
    }
    function aendere(state, leisten) {
      for (const [k, d] of Object.entries(leisten || {})) {
        const l = state.leisten[k], def = (map.leisten || {})[k];
        if (!l || !def) continue;
        const vorher = l.wert;
        l.wert = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, l.wert + d));
        if (l.wert > vorher) schwelle(state, k, def, vorher, l.wert);
      }
    }
    // Eine Schwelle löst genau einmal aus, sobald die Leiste sie von unten erreicht
    function schwelle(state, k, def, vorher, jetzt) {
      for (const sw of def.schwellen || []) {
        const schluessel = `${k}:${sw.ab}`;
        if (state.schwellen[schluessel] || vorher >= sw.ab || jetzt < sw.ab) continue;
        state.schwellen[schluessel] = true;
        setze(state, sw.setzt);
        notiere(state, `${def.name} ${sw.ab}: ${sw.titel || ""}`);
        state.letzte.push({ id: schluessel, name: `${def.name} ${sw.ab}${sw.titel ? `: ${sw.titel}` : ""}`, vorlesen: sw.vorlesen || "", gmNotiz: sw.gmNotiz || "", art: "schwelle" });
        if (sw.springe && !state.angewendet[sw.springe]) state.sprung = sw.springe;
      }
    }
    // Sprünge aus Schwellen erst nach der ganzen Aktion ausführen, damit sie nichts überholt
    function nachwirken(state) {
      const z = state.sprung;
      if (!z) return;
      state.sprung = null;
      const gefunden = state.letzte;
      betrete(state, z);
      state.letzte = gefunden;
    }
    const schalte = (state, namen, an) => { for (const n of namen || []) if (state.leisten[n]) state.leisten[n].aktiv = an; };

    // ---------- Gegner ----------
    function spawne(state, schrittId) {
      const s = map.schritte[schrittId];
      if (!s || s.typ !== "kampf") return;
      (s.gegner || []).forEach((e, i) => {
        const schluessel = `${schrittId}:${i}`;
        if (state.gespawnt[schluessel]) return;
        const def = map.gegner[e.id];
        if (!def) return;
        if ((e.nurWenn && !gilt(state, e.nurWenn)) || (def.nurWenn && !gilt(state, def.nurWenn))) return;
        state.gespawnt[schluessel] = true;
        const zaeh = Math.max(1, zaehVon(werteVon(def)) + zusaetze(state, def).reduce((n, z) => n + (+z.zaeh || 0) + (+(z.werte || {}).tough || 0), 0)
          + (+((state.typMod || {})[e.id] || {}).tough || 0));
        for (let n = 0; n < (e.anzahl || 1); n++) state.gegner.push({ uid: `${schluessel}:${n}`, id: e.id, zone: e.zone || "", wunden: 0, zaeh, weg: false });
      });
    }
    // ---------- Gegner stärken und schwächen ----------
    const ZAHL_FELDER = ["quality", "defense", "tough", "attacks"];
    // Zwei Anpassungen zusammenlegen (Zahlen addieren, Regeln sammeln)
    function summe(a, b) {
      const r = { ...a };
      for (const k of ZAHL_FELDER) if (b && b[k]) r[k] = (r[k] || 0) + b[k];
      const regeln = [...(a.passives || []), ...((b && b.passives) || [])];
      if (regeln.length) r.passives = [...new Set(regeln)];
      return r;
    }
    const leer = m => !m || (!ZAHL_FELDER.some(k => m[k]) && !(m.passives || []).length);
    // Alles, was gerade auf diesen Gegner wirkt: Zusatzregeln aus Entscheidungen, Anpassungen des Typs, eigene
    function modVon(state, g) {
      const def = map.gegner[g.id] || {};
      let m = {};
      for (const z of zusaetze(state, def)) if (z.werte) m = summe(m, z.werte);
      m = summe(m, (state.typMod || {})[g.id]);
      return summe(m, g.mod);
    }
    const stufe = (wert, d) => {
      const n = parseInt(wert, 10);
      return Number.isNaN(n) || !d ? wert : `${Math.max(2, Math.min(6, n - d))}+`;
    };
    // Die Kartenwerte mit allen Anpassungen: das, was am Tisch gerade gilt
    function effektiveWerte(state, g) {
      const def = map.gegner[g.id] || {}, basis = werteVon(def), m = modVon(state, g);
      if (leer(m)) return basis;
      const w = { ...basis };
      if (m.quality) w.quality = stufe(basis.quality, m.quality);
      if (m.defense) w.defense = stufe(basis.defense, m.defense);
      if (m.tough) w.tough = String(Math.max(1, (parseFloat(basis.tough) || 1) + m.tough));
      if (m.attacks && basis.weapons) w.weapons = String(basis.weapons).replace(/\bA(\d+)\b/g, (_, n) => `A${Math.max(1, +n + m.attacks)}`);
      if ((m.passives || []).length) w.passives = [basis.passives, ...m.passives].filter(Boolean).join(", ");
      return w;
    }
    // Lesbare Liste der Änderungen, z. B. „Qualität 4+ → 3+“, „Angriffe +1“, „Dornen“
    function modText(state, g) {
      const def = map.gegner[g.id] || {}, basis = werteVon(def), m = modVon(state, g), t = [];
      if (m.quality) t.push({ text: `Qualität ${basis.quality} → ${stufe(basis.quality, m.quality)}`, staerker: m.quality > 0 });
      if (m.defense) t.push({ text: `Verteidigung ${basis.defense} → ${stufe(basis.defense, m.defense)}`, staerker: m.defense > 0 });
      if (m.tough) t.push({ text: `Zäh ${m.tough > 0 ? "+" : ""}${m.tough}`, staerker: m.tough > 0 });
      if (m.attacks) t.push({ text: `Angriffe ${m.attacks > 0 ? "+" : ""}${m.attacks}`, staerker: m.attacks > 0 });
      for (const r of m.passives || []) t.push({ text: r, staerker: true });
      return t;
    }
    // Eine Anpassung anwenden: auf einen Gegner (uid) oder auf alle eines Typs ({ typ }), auch auf später erscheinende
    function wendeAn(state, ziel, mod) {
      if (leer(mod)) return;
      const betroffen = ziel.typ ? state.gegner.filter(g => g.id === ziel.typ) : state.gegner.filter(g => g.uid === ziel.uid);
      if (ziel.typ) state.typMod[ziel.typ] = summe(state.typMod[ziel.typ] || {}, mod);
      else for (const g of betroffen) g.mod = summe(g.mod || {}, mod);
      if (mod.tough) for (const g of betroffen) g.zaeh = Math.max(1, g.zaeh + mod.tough);
    }
    function passeGegnerAn(state, ziel, mod, text) {
      merke(state);
      wendeAn(state, ziel, mod);
      const name = ziel.typ ? `${(map.gegner[ziel.typ] || {}).name || ziel.typ} (alle)` : anzeigeName(state.gegner.find(g => g.uid === ziel.uid) || {});
      notiere(state, `${name}: ${text || "angepasst"}`);
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art: "gegner", text: `${name}: ${text || "angepasst"}`, leisten: [], flags: [] });
      pruefeKampf(state);
    }
    // gegnerMod aus Ereignissen und Antworten: [{ id: "erbluehte", werte: { quality: 1 }, text: "…" }]
    const wendeGegnerModAn = (state, liste) => { for (const x of liste || []) wendeAn(state, { typ: x.id }, x.werte); };

    // ---------- Gegner dazuholen ----------
    // Spontan im Spiel dazugeholte Gegnertypen (Vorlagen, NPCs, die kämpfen) stehen im Spielstand und werden in die
    // Map eingetragen, damit Zustand, Karte und Bedrohung wie bei jedem anderen Gegner funktionieren
    const registriere = state => { for (const [id, def] of Object.entries(state.extraGegner || {})) if (!map.gegner[id]) map.gegner[id] = def; };
    function holeGegner(state, id, anzahl, zone, def) {
      if (def && !map.gegner[id]) { state.extraGegner[id] = def; registriere(state); }
      const d = map.gegner[id];
      if (!d) return [];
      const zaeh = Math.max(1, zaehVon(werteVon(d)) + (+((state.typMod || {})[id] || {}).tough || 0));
      const neu = [];
      for (let n = 0; n < (anzahl || 1); n++) {
        state.extraNr = (state.extraNr || 0) + 1;
        const g = { uid: `x:${state.extraNr}`, id, zone: zone || "", wunden: 0, zaeh, weg: false };
        state.gegner.push(g);
        neu.push(g);
      }
      state.rundenAktiv = true;
      return neu;
    }
    // Von Hand: ein Gegner der Map (id) oder eine Vorlage (def mitgeben) kommt auf den Tisch
    function fuegeGegnerHinzu(state, id, anzahl, zone, def) {
      merke(state);
      const neu = holeGegner(state, id, anzahl, zone, def);
      const name = (map.gegner[id] || {}).name || id;
      notiere(state, `${neu.length} × ${name} kommt dazu`);
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art: "gegner", text: `${neu.length} × ${name} kommt dazu`, leisten: [], flags: [] });
      return neu;
    }
    // Ein NPC kämpft (wird angegriffen oder greift an): aus der Figur wird ein Gegner an ihrer Stelle am Tisch
    // Ohne eigene Kampfwerte kämpft ein NPC als einfacher Dorfbewohner (gilt für jede Figur jeder Map, auch Händler)
    const STANDARD_NPC = name => ({ werte: { name, faction: "NPC", quality: "5+", defense: "6+", tough: "2", size: "1", role: "enemy",
      weapons: "Fäuste oder Werkzeug | Nahkampf | A1 | ", passives: "" }, notiz: "Standardwerte für einen NPC ohne eigene Kampfwerte. Mit „Anpassen“ stärker oder schwächer machen." });
    function npcAlsGegner(state, figurId) {
      const f = (map.figuren || {})[figurId];
      if (!f || state.npcKampf[figurId]) return null;
      merke(state);
      const def = { name: f.name, info: f.wer, ...(f.kampf || STANDARD_NPC(f.name)) };
      const [g] = holeGegner(state, `npc-${figurId}`, 1, "", def);
      state.npcKampf[figurId] = g.uid;
      if (f.tisch) state.pos[`g:${g.uid}`] = { x: (state.pos[`f:${figurId}`] || f.tisch).x, y: (state.pos[`f:${figurId}`] || f.tisch).y };
      setze(state, (f.kampf || {}).setzt);
      notiere(state, `${f.name} kämpft`);
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art: "gegner", text: `${f.name} kämpft`, leisten: [], flags: [] });
      return g;
    }
    // gegnerHinzu an Ereignissen und Antworten: [{ id: "gemeinde", anzahl: 1, zone: "K" }]
    const holeAlle = (state, liste) => { for (const x of liste || []) holeGegner(state, x.id, x.anzahl, x.zone); };

    // Zusatzregeln eines Gegners, die frühere Entscheidungen freigeschaltet haben
    const zusaetze = (state, def) => ((def && def.zusatz) || []).filter(z => gilt(state, z.wenn));
    // Gegner mit nurWenn erscheinen, sobald die Bedingung stimmt (die Quelle nach Marker 3)
    const pruefeSpawns = state => { for (const id of new Set(state.verlauf)) spawne(state, id); };
    function schaden(state, uid, delta) {
      const g = state.gegner.find(x => x.uid === uid);
      if (!g) return null;
      merke(state);
      g.wunden = Math.max(0, Math.min(g.zaeh, g.wunden + delta));
      notiere(state, `${anzeigeName(g)} ${delta > 0 ? "+" : ""}${delta} Wunden (${g.wunden}/${g.zaeh})`);
      // Fällt er zum ersten Mal: Todestext und Wirkung
      const def = map.gegner[g.id] || {};
      if (g.wunden >= g.zaeh && !state.tote[uid]) {
        state.tote[uid] = true;
        if (def.tod) {
          setze(state, def.tod.setzt);
          aendere(state, def.tod.leisten);
          state.letzte.push({ id: `tod:${uid}`, name: `${anzeigeName(g)} fällt`, vorlesen: def.tod.vorlesen || "", gmNotiz: def.tod.gmNotiz || "", art: "tod" });
        }
      }
      pruefeKampf(state);
      nachwirken(state);
      if (state.tote[uid]) logge(state, "tod", `${anzeigeName(g)} fällt`);
      return g;
    }
    function entferne(state, uid) {
      const g = state.gegner.find(x => x.uid === uid);
      if (!g) return;
      merke(state);
      g.weg = true;
      notiere(state, `${anzeigeName(g)} vom Tisch`);
    }
    const anzeigeName = g => (map.gegner[g.id] || {}).name || g.id;
    function zustand(g) {
      const rest = g.zaeh - g.wunden, z = g.zaeh;
      const id = g.wunden === 0 ? "unverletzt" : rest <= 0 ? "gefallen" : rest === 1 ? "am Ende" : rest <= z / 4 ? "schwer verwundet" : rest <= z / 2 ? "verwundet" : "angekratzt";
      const def = map.gegner[g.id] || {};
      const stufe = ((map.fog || {}).stufen || []).find(s => s.id === id) || {};
      const satz = id === "gefallen" && def.tod && def.tod.vorlesen ? def.tod.vorlesen : (def.zustandSaetze && def.zustandSaetze[id]) || stufe.satz || "";
      return { id, satz, rest };
    }
    function bedrohung(def, werte) {
      const schaedel = hilfen.stufe ? hilfen.stufe(werte || werteVon(def)) : 1;
      const eintrag = ((map.fog || {}).bedrohung || []).find(b => schaedel >= b.schaedel[0] && schaedel <= b.schaedel[b.schaedel.length - 1]) || {};
      return { schaedel, satz: def.bedrohungSatz || eintrag.satz || "" };
    }
    function pruefeKampf(state) {
      const s = map.schritte[state.schritt];
      if (!s || s.typ !== "kampf") return;
      for (const e of s.ende || []) {
        if (gilt(state, e.wenn)) {
          if (state.kampfZiel !== e.ziel) { setze(state, e.setzt); state.kampfZiel = e.ziel; notiere(state, `Kampfziel erreicht → ${e.ziel}`); }
          return;
        }
      }
    }
    function wuetend(state) {
      if (state.flags.gegner_wuetend) return true;
      const kampf = [...state.verlauf].reverse().map(id => map.schritte[id]).find(s => s && s.typ === "kampf");
      if (!kampf || !kampf.verhalten) return false;
      return kampf.verhalten.start === "wuetend" || !!(kampf.verhalten.wuetendWenn && gilt(state, kampf.verhalten.wuetendWenn));
    }

    // ---------- Schritte ----------
    function betrete(state, id, tiefe = 0) {
      if (!id || tiefe > 50) return null;
      const s = map.schritte[id];
      if (!s) throw new Error(`Schritt fehlt: ${id}`);
      // Schritte mit `wenn`, die nicht gelten, werden übersprungen (z. B. die Nachsuche, wenn alles gefunden ist)
      if (s.wenn && !gilt(state, s.wenn)) return betrete(state, ziel(state, s.weiter), tiefe + 1);
      state.schritt = id;
      state.verlauf.push(id);
      state.schrittSeit = jetzt();
      state.kampfZiel = null;
      if (!state.angewendet[id]) {
        state.angewendet[id] = true;
        setze(state, s.setzt);
        aendere(state, s.leisten);
        schalte(state, s.leistenAn, true);
        schalte(state, s.leistenAus, false);
      }
      if (s.runden) state.rundenAktiv = true;
      if (s.typ === "kampf") { spawne(state, id); pruefeKampf(state); }
      return s;
    }
    function weiter(state) {
      const s = map.schritte[state.schritt];
      if (!s || s.typ === "wahl") return null;
      const naechster = state.kampfZiel || ziel(state, s.weiter);
      if (!naechster) return null;
      merke(state);
      state.letzte = [];
      const r = betrete(state, naechster);
      logge(state, "schritt", (map.schritte[state.schritt] || {}).titel || state.schritt);
      return r;
    }
    function springe(state, id) {
      merke(state);
      state.letzte = [];
      return betrete(state, id);
    }

    // ---------- Ereignisse (jederzeit per Taste) ----------
    function ereignisErlaubt(state, id) {
      const e = map.ereignisse[id];
      if (!e) return false;
      if (e.einmal && state.ereignisse[id]) return false;
      return !e.nurWenn || gilt(state, e.nurWenn);
    }
    function loeseAus(state, id, still) {
      const e = map.ereignisse[id];
      if (!e || !ereignisErlaubt(state, id)) return null;
      if (e.intern && e.wenn && !gilt(state, e.wenn)) return null;
      state.ereignisse[id] = true;
      wendeGegnerModAn(state, e.gegnerMod);
      holeAlle(state, e.gegnerHinzu);
      setze(state, e.setzt);
      aendere(state, e.leisten);
      schalte(state, e.leistenAus, false);
      if (!e.intern) notiere(state, e.name);
      const ergebnis = { id, name: e.name, vorlesen: e.vorlesen || "", gmNotiz: e.gmNotiz || "", beutewurf: !!e.beutewurf,
        probe: e.probe ? { frage: e.probe.frage || "Der Spieler würfelt einen W6.", wurf: null, stufen: [] } : null };
      if (!still && !e.intern) state.letzte.push(ergebnis);
      if (e.danach) loeseAus(state, e.danach, true);
      pruefeSpawns(state);
      pruefeKampf(state);
      if (e.springe) { state.letzte = []; betrete(state, e.springe); }
      return ergebnis;
    }
    function ereignis(state, id) {
      if (!ereignisErlaubt(state, id)) return null;
      merke(state);
      const r = loeseAus(state, id, false);
      nachwirken(state);
      if (r) logge(state, "ereignis", r.name);
      return r;
    }
    // Probe zu einem gerade ausgelösten Ereignis: wurf 1–6 (vom Tisch eingegeben oder gewürfelt)
    function probe(state, index, wurf) {
      const eintrag = state.letzte[index];
      const e = eintrag && map.ereignisse[eintrag.id];
      if (!e || !e.probe || !eintrag.probe || eintrag.probe.wurf) return null;
      merke(state);
      const w = Math.max(1, Math.min(6, +wurf || 1 + Math.floor(zufall() * 6)));
      eintrag.probe.wurf = w;
      for (const st of e.probe.stufen || []) {
        if (w < st.ab) continue;
        eintrag.probe.stufen.push({ ab: st.ab, vorlesen: st.vorlesen || "", gmNotiz: st.gmNotiz || "" });
        setze(state, st.setzt);
        aendere(state, st.leisten);
      }
      notiere(state, `${e.name}: Probe ${w}`);
      pruefeSpawns(state);
      pruefeKampf(state);
      nachwirken(state);
      logge(state, "probe", `${e.name}: Wurf ${w}`);
      return eintrag.probe;
    }

    // ---------- Antwortwahl ----------
    const offeneMarker = state => Object.entries(map.ereignisse || {}).filter(([id, e]) => e.beutewurf && e.einmal && !state.ereignisse[id]).map(([id]) => id);
    function waehle(state, taste, eingabe) {
      const s = map.schritte[state.schritt];
      if (!s || s.typ !== "wahl") return null;
      const o = s.optionen.find(x => String(x.taste) === String(taste));
      if (!o) return null;
      merke(state);
      state.letzte = [];
      state.wahlen[state.schritt] = o.taste;
      setze(state, o.setzt, eingabe);
      wendeGegnerModAn(state, o.gegnerMod);
      holeAlle(state, o.gegnerHinzu);
      aendere(state, o.leisten);
      notiere(state, `${s.titel}: ${o.kurz}${eingabe ? ` (${eingabe})` : ""}`);
      // Nachsuche: offene Marker kosten je einen Strich Atemzug
      const marker = o.wirkung === "offene-marker-alle" ? offeneMarker(state) : o.wirkung === "offene-marker-einer" && eingabe ? [eingabe] : [];
      for (const m of marker) {
        const r = loeseAus(state, m, false);
        if (r) { aendere(state, { atemzug: 1 }); state.flags.nachsuche = (+state.flags.nachsuche || 0) + 1; }
      }
      const gefunden = state.letzte;
      betrete(state, o.ziel || ziel(state, s.weiter));
      state.letzte = gefunden;
      nachwirken(state);
      logge(state, "wahl", `${s.titel}: ${o.kurz}${eingabe ? ` (${eingabe})` : ""}`);
      return o;
    }

    // ---------- Rundenende ----------
    function runde(state) {
      merke(state);
      state.runde += 1;
      const texte = [];
      let sprung = null;
      for (const r of map.rundenende || []) {
        if (!gilt(state, r.wenn)) continue;
        // Eine Regel, die nur Flags setzt, die schon stehen (ab Runde 4 wütend), meldet sich nur beim ersten Mal
        const neuGesetzt = Object.entries(r.setzt || {}).some(([k, v]) => state.flags[k] !== v);
        aendere(state, r.leisten);
        setze(state, r.setzt);
        if (r.springe && !sprung && !state.angewendet[r.springe]) sprung = r.springe;
        if (r.text && (r.leisten || r.springe || neuGesetzt)) texte.push(r.text);
      }
      notiere(state, `Runde ${state.runde} beendet`);
      const schwellen = state.letzte.filter(x => x.art === "schwelle");
      state.letzte = schwellen;
      if (sprung) betrete(state, sprung);
      nachwirken(state);
      logge(state, "runde", `Runde ${state.runde} beendet`);
      return { texte, sprung };
    }
    // Der Wurf am Rundenende: Was passiert gerade auf der Map? (wurf leer = die App würfelt)
    function rundenwurf(state, wurf) {
      const rw = map.rundenwurf;
      if (!rw || !gilt(state, rw.wenn)) return null;
      merke(state);
      const w = Math.max(1, Math.min(6, +wurf || 1 + Math.floor(zufall() * 6)));
      const zeile = (rw.tabelle || []).find(z => (z.w || []).includes(w)) || {};
      setze(state, zeile.setzt);
      aendere(state, zeile.leisten);
      state.rundenwurfRunde = state.runde;
      notiere(state, `${rw.name}: ${w} ${zeile.titel || ""}`);
      state.letzte.push({ id: `rundenwurf:${state.runde}`, name: `${rw.name}: ${w}${zeile.titel ? ` · ${zeile.titel}` : ""}`, vorlesen: zeile.vorlesen || "", gmNotiz: zeile.gmNotiz || "", art: "rundenwurf" });
      pruefeSpawns(state);
      nachwirken(state);
      logge(state, "rundenwurf", `${rw.name}: ${w}${zeile.titel ? ` · ${zeile.titel}` : ""}`);
      return { wurf: w, ...zeile };
    }

    // ---------- Lage: was Chris jederzeit im Blick haben muss ----------
    function lage(state) {
      const l = map.lage || {};
      return {
        flucht: l.flucht || null,
        sonderregeln: (l.sonderregeln || []).filter(r => gilt(state, r.wenn)),
        ziele: (l.ziele || []).map(z => ({ ...z, ist: z.erreicht ? gilt(state, z.erreicht) : false })),
      };
    }
    // Beute im Inventar eines Helden (Heiltrank, Feuertopf …); verbraucht wird sie mit benutze
    function gibBeute(state, held, sache) {
      if (!held || !sache) return;
      merke(state);
      (state.inventar[held] = state.inventar[held] || []).push(sache);
      notiere(state, `${held} bekommt ${sache}`);
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art: "beute", text: `${held} bekommt ${sache}`, leisten: [], flags: [] });
    }
    function benutze(state, held, index) {
      const liste = state.inventar[held];
      if (!liste || !liste[index]) return;
      merke(state);
      const [sache] = liste.splice(index, 1);
      notiere(state, `${held} benutzt ${sache}`);
      state.log.push({ runde: state.runde + 1, schritt: state.schritt, art: "beute", text: `${held} benutzt ${sache}`, leisten: [], flags: [] });
    }
    // Antreiber gegen Leerlauf: die passenden für den aktuellen Schritt (Map-weite und eigene des Schritts)
    function antreiber(state) {
      const s = map.schritte[state.schritt] || {};
      const alle = [...(s.antreiben || []), ...(map.antreiben || [])];
      return alle.filter(a => gilt(state, a.wenn) && (!a.schritte || a.schritte.includes(state.schritt)));
    }
    // Wie lange eine Szene laufen darf, bevor die App Antreiber anbietet (Kämpfe nie von selbst)
    const zeitlimit = state => { const s = map.schritte[state.schritt] || {}; return s.zeitlimit || (["spieler", "npc", "wahl"].includes(s.typ) ? 8 : 0); };
    const minuten = state => Math.max(0, Math.floor((jetzt() - (state.schrittSeit ?? jetzt())) / 60000));

    // Aufträge der Spieler: was sie wissen und tun sollen (aktiv = bekannt und nicht erledigt)
    const auftraege = state => (map.auftraege || []).filter(a => gilt(state, a.ab)).map(a => ({ ...a, erledigtJetzt: !!(a.erledigt && gilt(state, a.erledigt)) }));

    // Wo eine Figur auf der Tischkarte steht (nur Anzeige, keine Spielregel; kein Rückgängig)
    const setzePos = (state, schluessel, x, y) => { state.pos = state.pos || {}; state.pos[schluessel] = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }; };
    const figurenAmTisch = state => Object.entries(map.figuren || {}).filter(([id, f]) => f.tisch && !(state.npcKampf || {})[id] && gilt(state, f.tisch.ab) && !(f.tisch.bis && gilt(state, f.tisch.bis))).map(([id, f]) => ({ id, ...f }));
    const aufgedeckt = state => Object.entries((map.tischplan || {}).aufdecken || {}).filter(([, w]) => gilt(state, w)).map(([label]) => label);

    // ---------- Abschluss ----------
    const epListe = state => ((map.schritte[state.schritt] || {}).ep || []).map(e => ({ ...e, erreicht: gilt(state, e.wenn) }));
    const folgen = state => ((map.schritte[state.schritt] || {}).folgen || []).filter(f => gilt(state, f.wenn)).map(f => f.text);
    function wuerfle(tabelle) {
      const w = 1 + Math.floor(zufall() * 6);
      const zeile = (tabelle || map.beutewurf || []).find(([n]) => n === w);
      return { wurf: w, text: zeile ? zeile[1] : "" };
    }
    // Was die nächste Map übernimmt
    const uebernahme = state => ({
      leisten: Object.fromEntries(Object.entries(state.leisten).filter(([k]) => (map.leisten[k] || {}).gilt === "kampagne").map(([k, l]) => [k, l.wert])),
      flags: Object.fromEntries(Object.entries(state.flags).filter(([k]) => /map[2-9]/.test((map.flags[k] || {}).wirktIn || ""))),
    });

    return {
      map, neu, zurueck, gilt, weiter, springe, betrete, ereignis, ereignisErlaubt, waehle, runde, schaden, entferne,
      zustand, bedrohung, wuetend, offeneMarker, epListe, folgen, wuerfle, uebernahme, werteVon, anzeigeName,
      probe, rundenwurf, lage, zusaetze, setzePos, figurenAmTisch, aufgedeckt, migriere, gibBeute, benutze, antreiber, zeitlimit, minuten,
      effektiveWerte, modText, passeGegnerAn, fuegeGegnerHinzu, npcAlsGegner, auftraege,
      schritt: state => map.schritte[state.schritt] || null,
      naechsterId: state => { const s = map.schritte[state.schritt]; return s ? state.kampfZiel || ziel(state, s.weiter) : null; },
    };
  }

  // Prüft eine Map auf kaputte Verweise. Liefert eine Liste von Fehlern (leer = in Ordnung).
  function pruefe(map) {
    const fehler = [];
    const schritte = map.schritte || {};
    const istSchritt = id => !id || !!schritte[id];
    const zielListe = w => (!w ? [] : typeof w === "string" ? [w] : w.map(e => e.ziel));
    if (!schritte[map.start]) fehler.push(`start ${map.start} fehlt`);
    for (const [id, s] of Object.entries(schritte)) {
      for (const z of zielListe(s.weiter)) if (!istSchritt(z)) fehler.push(`${id}: weiter → ${z} fehlt`);
      for (const o of s.optionen || []) if (o.ziel && !istSchritt(o.ziel)) fehler.push(`${id}: Option ${o.taste} → ${o.ziel} fehlt`);
      for (const e of s.ende || []) if (!istSchritt(e.ziel)) fehler.push(`${id}: ende → ${e.ziel} fehlt`);
      for (const e of s.ereignisse || []) if (!(map.ereignisse || {})[e]) fehler.push(`${id}: Ereignis ${e} fehlt`);
      for (const g of s.gegner || []) if (!(map.gegner || {})[g.id]) fehler.push(`${id}: Gegner ${g.id} fehlt`);
      if (s.cue && !(map.audio || {})[s.cue]) fehler.push(`${id}: Cue ${s.cue} fehlt`);
      if (s.figur && !(map.figuren || {})[s.figur]) fehler.push(`${id}: Figur ${s.figur} fehlt`);
      if (s.typ === "wahl" && !(s.optionen || []).length) fehler.push(`${id}: Wahl ohne Optionen`);
      // Ein Schritt mit `wenn` wird übersprungen, wenn die Bedingung nicht gilt: Dafür braucht er ein `weiter`
      if (s.wenn && !s.weiter) fehler.push(`${id}: hat wenn, aber kein weiter zum Überspringen`);
    }
    for (const [id, e] of Object.entries(map.ereignisse || {})) {
      if (e.springe && !istSchritt(e.springe)) fehler.push(`Ereignis ${id}: springe → ${e.springe} fehlt`);
      if (e.danach && !(map.ereignisse || {})[e.danach]) fehler.push(`Ereignis ${id}: danach → ${e.danach} fehlt`);
    }
    for (const r of map.rundenende || []) if (r.springe && !istSchritt(r.springe)) fehler.push(`Rundenende: springe → ${r.springe} fehlt`);
    for (const [k, l] of Object.entries(map.leisten || {})) for (const sw of l.schwellen || []) if (sw.springe && !istSchritt(sw.springe)) fehler.push(`Leiste ${k}: Schwelle ${sw.ab} → ${sw.springe} fehlt`);
    for (const [id, e] of Object.entries(map.ereignisse || {})) if (e.probe && !(e.probe.stufen || []).length) fehler.push(`Ereignis ${id}: Probe ohne Stufen`);
    for (const [id, e] of Object.entries(map.ereignisse || {})) for (const x of [...(e.gegnerHinzu || []), ...(e.gegnerMod || [])]) if (!(map.gegner || {})[x.id]) fehler.push(`Ereignis ${id}: Gegner ${x.id} fehlt`);
    for (const [id, s] of Object.entries(schritte)) for (const o of s.optionen || []) for (const x of [...(o.gegnerHinzu || []), ...(o.gegnerMod || [])]) if (!(map.gegner || {})[x.id]) fehler.push(`${id}: Option ${o.taste}: Gegner ${x.id} fehlt`);
    if (map.rundenwurf) {
      const gedeckt = new Set((map.rundenwurf.tabelle || []).flatMap(z => z.w || []));
      for (let w = 1; w <= 6; w++) if (!gedeckt.has(w)) fehler.push(`Rundenwurf: ${w} fehlt in der Tabelle`);
    }
    return fehler;
  }

  const SpielMotor = { erstelle, pruefe };
  if (typeof module !== "undefined" && module.exports) module.exports = SpielMotor;
  else root.SpielMotor = SpielMotor;
})(typeof globalThis !== "undefined" ? globalThis : this);

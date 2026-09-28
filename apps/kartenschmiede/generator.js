/* Kartenschmiede – Generator für Waffen, Gegenstände, Fähigkeiten und Zauber.
   Würfelt einen Eintrag aus Bausteinen und bepreist ihn so, dass er zur gewünschten Seltenheit passt:
   - Waffen über die Schmiede-Formel: was die Waffe an einem Standard-Helden kostet.
   - Fähigkeiten, Zauber und Gegenstände über Baukosten × Ziel × Reichweite × Nutzung.
   Reines JavaScript ohne DOM, braucht Regeln (regeln.js). */
(function (root) {
  "use strict";

  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const wahl = (r, a) => a[Math.floor(r() * a.length)];
  const auf5 = x => Math.max(5, 5 * Math.round(x / 5));
  const gross = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- Waffen ----------
  // Standard-Held zum Bepreisen: Qualität 4+, Verteidigung 5+, Zäh 5, eine Faust als Grundwaffe
  const REFERENZ = { quality: "4+", defense: "5+", tough: "5", size: "1", passives: "", role: "enemy" };
  const GRUNDWAFFE = "Faust | Nahkampf | A1 |";
  function waffenPreis(R, zeile) {
    const ohne = R.punkte({ ...REFERENZ, weapons: GRUNDWAFFE }).roh;
    return Math.round(R.punkte({ ...REFERENZ, weapons: GRUNDWAFFE + "\n" + zeile }).roh - ohne);
  }
  const WAFFEN_ZIEL = [0, 10, 16, 24, 36, 50, 72];
  const VORSILBEN = {
    gift: ["Gift", "Seuchen", "Nattern"], explosion: ["Donner", "Splitter", "Sturm"], reissend: ["Blut", "Reiß", "Zahn"],
    toedlich: ["Todes", "Seelen", "Grab"], ds: ["Runen", "Bann", "Titan"], zuverlaessig: ["Ziel", "Falken", "Wächter"],
    schlicht: ["Eisen", "Eschen", "Wolfs", "Grau", "Asche"],
  };
  const NOMEN = {
    nah: ["klinge", "axt", "hammer", "speer", "glefe", "klauen", "sichel", "keule", "säge"],
    kurz: ["wurfspeer", "speier", "wurfbeil", "schleuder", "werfer"],
    lang: ["bogen", "armbrust", "büchse", "werfer", "lanze"],
  };

  // Sci-Fi: technische Namen und eigene Regeln (Schwerpunkt „Sci-Fi“)
  const VORSILBEN_SF = {
    gift: ["Säure", "Toxin", "Nano"], explosion: ["Granat", "Raketen", "Nova"], reissend: ["Ketten", "Splitter", "Vibro"],
    toedlich: ["Schienen", "Vernichtungs", "Singularitäts"], ds: ["Plasma", "Fusions", "Graviton"], zuverlaessig: ["Smart", "Radar", "Leit"],
    ueberhitzen: ["Plasma", "Überlast", "Fusions"], zielsuchend: ["Leit", "Such", "Radar"], schlicht: ["Laser", "Puls", "Photonen", "Ionen"],
  };
  const NOMEN_SF = {
    nah: ["klinge", "schwert", "faust", "axt", "stab"],
    kurz: ["pistole", "werfer", "karabiner"],
    lang: ["gewehr", "kanone", "werfer", "büchse"],
  };
  const REGEL_TEXT = { reissend: "Reißend", gift: "Gift", explosion: "Explosion(3)", toedlich: "Tödlich(3)", zuverlaessig: "Zuverlässig",
    praezise: "Präzise", indirekt: "Indirekt", zielsuchend: "Zielsuchend", ueberhitzen: "Überhitzen" };

  const FLAIR = {
    fantasy: { nah: ["Geschmiedet in einer Nacht ohne Mond.", "Die Schneide erinnert sich an jedes Blut.", "Schwer in der Hand, leicht im Urteil."],
      fern: ["Jeder Schuss ein leises Gebet.", "Aus der Waffenkammer einer gefallenen Festung.", "Trifft, bevor der Feind ihn hört."] },
    sf: { nah: ["Summt leise, wenn Energie durch die Schneide fließt.", "Militärstandard, einmal modifiziert.", "Die Klinge glüht noch vom letzten Einsatz."],
      fern: ["Zieloptik mit Restlichtverstärker.", "Frisch aus der Waffenkammer der Flotte.", "Das Magazin summt, wenn es sich lädt."] },
  };

  function waffe(R, opt = {}) {
    const sf = opt.tag === "technik";
    const r = rng(opt.seed || Date.now());
    const stufe = Math.min(6, Math.max(1, opt.stufe || 3));
    const art = opt.art || (r() < 0.5 ? "nah" : "fern");
    const ziel = WAFFEN_ZIEL[stufe];
    const kandidaten = [];
    for (let i = 0; i < 500 && kandidaten.length < 25; i++) {
      const reichweite = art === "nah" ? 0 : wahl(r, [6, 9, 12, 12, 18, 18, 24, 24, 30]);
      const a = 1 + Math.floor(r() * (2 + stufe * 1.5));
      const ds = wahl(r, stufe >= 4 ? [0, 1, 1, 2, 2, 3] : [0, 0, 0, 1, 1, 2]);
      const regeln = [];
      const moeglich = ["reissend", "gift", art === "fern" ? "explosion" : "reissend"];
      if (stufe >= 3) moeglich.push("zuverlaessig");
      if (stufe >= 4) moeglich.push("toedlich");
      if (stufe >= 2) moeglich.push("praezise");
      if (art === "fern" && stufe >= 3) moeglich.push("indirekt");
      if (sf) moeglich.push("ueberhitzen", art === "fern" ? "zielsuchend" : "reissend");
      const anzahl = Math.min(stufe - 1, Math.floor(r() * 3));
      for (let k = 0; k < anzahl; k++) { const x = wahl(r, moeglich); if (!regeln.includes(x)) regeln.push(x); }
      const text = [ds && `DS(${ds})`].concat(Object.keys(REGEL_TEXT).filter(x => regeln.includes(x)).map(x => REGEL_TEXT[x])).filter(Boolean).join(", ");
      const probe = `X | ${reichweite ? reichweite + '"' : "Nahkampf"} | A${a} | ${text}`;
      const preis = waffenPreis(R, probe);
      if (Math.abs(preis - ziel) <= Math.max(3, ziel * 0.3)) kandidaten.push({ reichweite, a, ds, regeln, text, preis });
    }
    const k = kandidaten.length ? wahl(r, kandidaten) : { reichweite: art === "nah" ? 0 : 12, a: stufe, ds: 0, regeln: [], text: "", preis: 0 };
    const V = sf ? VORSILBEN_SF : VORSILBEN, N = sf ? NOMEN_SF : NOMEN;
    const merkmal = k.regeln.find(x => V[x]) || (k.ds >= 2 ? "ds" : "schlicht");
    const nomen = wahl(r, k.reichweite === 0 ? N.nah : k.reichweite <= 12 ? N.kurz : N.lang);
    const name = gross(wahl(r, V[merkmal]) + nomen);
    const zeile = `${name} | ${k.reichweite ? k.reichweite + '"' : "Nahkampf"} | A${k.a} | ${k.text}`;
    const tags = [k.reichweite ? "fernkampf" : "nahkampf"];
    if (k.regeln.includes("explosion")) tags.push("flaeche");
    if (k.regeln.includes("gift")) tags.push("gift");
    if (sf) tags.push("technik");
    const preis = waffenPreis(R, zeile);
    return { typ: "waffe", name, art: k.reichweite ? "Fernkampf" : "Nahkampf", fuer: ["hero", "companion", "enemy"], tags, waffe: zeile,
      kosten: { typ: "fest", wert: preis }, text: wahl(r, FLAIR[sf ? "sf" : "fantasy"][k.reichweite ? "fern" : "nah"]), quelle: "Generator" };
  }

  // ---------- Wirkungen für Fähigkeiten, Zauber und Gegenstände ----------
  // sg/pl: Satzende für ein Ziel oder mehrere
  const WIRKUNGEN = [
    { id: "schaden", tags: ["magie"], feind: true, basis: 10, sg: "erleidet W3 Treffer mit DS(1)", pl: "erleiden je W3 Treffer mit DS(1)", namen: ["Runenschlag", "Blutpfeil", "Aschehagel", "Schattenlanze"] },
    { id: "feuer", tags: ["feuer"], feind: true, basis: 12, sg: "erleidet W3 Treffer; bei einer 6 brennt es und erleidet in der nächsten Runde 1 weiteren Treffer", pl: "erleiden je W3 Treffer; bei einer 6 brennen sie und erleiden in der nächsten Runde 1 weiteren Treffer", namen: ["Glutstoß", "Feuerzunge", "Aschenbrand", "Höllenfunke"] },
    { id: "frost", tags: ["frost", "schwaechung"], feind: true, basis: 9, sg: "erleidet 1 Treffer und bewegt sich bis zu seiner nächsten Aktivierung nur halb so weit", pl: "erleiden je 1 Treffer und bewegen sich bis zu ihrer nächsten Aktivierung nur halb so weit", namen: ["Frostgriff", "Eisatem", "Raureif", "Winterbiss"] },
    { id: "betaeubung", tags: ["betaeubung"], feind: true, basis: 15, sg: "ist betäubt und darf sich bei seiner nächsten Aktivierung nur bewegen", pl: "sind betäubt und dürfen sich bei ihrer nächsten Aktivierung nur bewegen", namen: ["Donnerhall", "Lähmfluch", "Schockwelle", "Nervenstoß"] },
    { id: "gift", tags: ["gift"], feind: true, basis: 8, sg: "erhält 2 Treffer mit Gift", pl: "erhalten je 2 Treffer mit Gift", namen: ["Giftwolke", "Natternkuss", "Fäulnis", "Sporenhauch"] },
    { id: "furcht", tags: ["furcht"], feind: true, basis: 7, sg: "legt sofort eine Moralprobe ab", pl: "legen sofort eine Moralprobe ab", namen: ["Schreckensruf", "Grabesstimme", "Albtraum"] },
    { id: "stoss", tags: ["bewegung"], feind: true, basis: 5, sg: "wird W3+1\" zurückgestoßen", pl: "werden W3+1\" zurückgestoßen", namen: ["Sturmstoß", "Druckwelle", "Titanenfaust"] },
    { id: "schwaechung", tags: ["schwaechung"], feind: true, basis: 8, sg: "erhält −1 auf Treffer bis zu seiner nächsten Aktivierung", pl: "erhalten −1 auf Treffer bis zu ihrer nächsten Aktivierung", namen: ["Fluch der Schwäche", "Nebelschleier", "Störsignal"] },
    { id: "heilung", tags: ["heilung"], feind: false, basis: 10, sg: "heilt W3 Wunden", pl: "heilen je W3 Wunden", namen: ["Lebensfunke", "Heilende Hände", "Mondtau", "Regenerationsschub"] },
    { id: "schutz", tags: ["schutz"], feind: false, basis: 8, sg: "erhält +1 Verteidigung bis zu seiner nächsten Aktivierung", pl: "erhalten +1 Verteidigung bis zu ihrer nächsten Aktivierung", namen: ["Eisenhaut", "Schutzkreis", "Kraftfeld", "Wächtersegen"] },
    { id: "staerkung", tags: ["staerkung"], feind: false, basis: 8, sg: "erhält +1 auf Treffer bis zum Ende seiner nächsten Aktivierung", pl: "erhalten +1 auf Treffer bis zum Ende ihrer nächsten Aktivierung", namen: ["Kriegsruf", "Blutdurst", "Zielsucher", "Kampfrausch"] },
    { id: "sprung", tags: ["bewegung"], selbst: true, basis: 6, sg: "versetzt sich bis zu 6\" in beliebige Richtung", pl: "", namen: ["Phasensprung", "Blinzeln", "Sprungdüse", "Schattensprung"] },
    { id: "tarnung", tags: ["tarnung"], selbst: true, basis: 6, sg: "kann bis zu seiner nächsten Aktivierung nur aus 9\" oder näher beschossen werden", pl: "", namen: ["Schattenmantel", "Tarnfeld", "Nebelgestalt"] },
    { id: "beschwoerung", tags: ["beschwoerung"], selbst: true, basis: 20, sg: "ruft einen Geistwolf (Qualität 4+, Verteidigung 5+, Zäh 3, A2 Nahkampf) in 3\" herbei, der bis zum Ende des Spiels bleibt", pl: "", namen: ["Ruf der Wildnis", "Seelenbeschwörung", "Portalriss"] },
  ];
  const ZIELE_FEIND = [{ t: "Ein Feind in {rw}", m: 1 }, { t: "Alle Feinde in {rw}", m: 1.8, tag: "flaeche", pl: true, flaeche: true }];
  const ZIELE_FREUND = [{ t: "Ein Verbündeter in {rw}", m: 1 }, { t: "Alle Verbündeten in {rw}", m: 1.8, tag: "flaeche", pl: true, flaeche: true }, { t: "Dieses Modell", m: 0.7, ohneRw: true }];
  const ZIEL_SELBST = [{ t: "Dieses Modell", m: 1, ohneRw: true }];
  const REICHWEITEN = [{ z: 3, m: 0.8 }, { z: 6, m: 1 }, { z: 12, m: 1.25 }, { z: 18, m: 1.45 }];
  const NUTZUNG = {
    faehigkeit: [{ t: "Skill, 1 Power:", m: 1 }, { t: "Einmal pro Spiel:", m: 0.6, tag: "einmalig" }],
    sonderregel: [{ t: "Einmal pro Runde:", m: 1.2 }, { t: "Einmal pro Spiel:", m: 0.6, tag: "einmalig" }, { t: "Am Ende jeder Runde:", m: 1.8, tag: "aura" },
      { t: "Erleidet dieses Modell eine Wunde:", m: 1.1, tag: "reaktion", angreifer: true }],
    zauber: [{ t: "Zauber (4+):", m: 0.9 }, { t: "Zauber (5+):", m: 0.75 }, { t: "Zauber (3+):", m: 1.1 }],
    gegenstand: [{ t: "Einmal:", m: 0.5, tag: "einmalig", art: "Trank" }, { t: "Einmal pro Spiel:", m: 0.6, tag: "einmalig", art: "Artefakt" }, { t: "Einmal pro Runde:", m: 1.1, art: "Artefakt" }],
  };
  const ZIEL_BUDGET = [0, 5, 8, 12, 18, 25, 35];

  // Dauerhafte Ausrüstung ohne Auslöser
  const AUSRUESTUNG = [
    { text: "+1 Verteidigung gegen Beschuss.", basis: 10, tags: ["schutz"], vor: ["Runen", "Eisen", "Wächter"], nomen: ["schild", "umhang", "panzer"] },
    { text: "+2\" beim Bewegen und Angreifen.", basis: 5, tags: ["bewegung"], vor: ["Wind", "Sprung", "Schatten"], nomen: ["stiefel", "mantel"] },
    { text: "Nahkampfwaffen erhalten Reißend.", basis: 12, tags: ["nahkampf", "staerkung"], vor: ["Blut", "Klingen", "Reiß"], nomen: ["handschuhe", "wetzstein", "ring"] },
    { text: "Fernkampfwaffen erhalten +6\" Reichweite.", basis: 8, tags: ["fernkampf", "staerkung"], vor: ["Falken", "Ziel", "Adler"], nomen: ["linse", "visier", "auge"] },
    { text: "Immun gegen Gift und Furcht.", basis: 6, tags: ["schutz"], vor: ["Reinheits", "Mut", "Heil"], nomen: ["amulett", "talisman"] },
    { text: "Einmal pro Spiel einen eigenen Wurf wiederholen.", basis: 5, tags: ["einmalig"], vor: ["Glücks", "Schicksals"], nomen: ["münze", "knochen", "würfel"] },
    { text: "+1 Power (Quest).", basis: 10, tags: ["magie"], vor: ["Äther", "Kristall", "Stern"], nomen: ["fokus", "splitter", "kern"] },
    { text: "Ignoriert Deckung beim Schießen.", basis: 8, tags: ["fernkampf"], vor: ["Durchblick", "Geister", "Spür"], nomen: ["brille", "rune", "zielgerät"] },
  ];

  const SF_NAMEN = {
    schaden: ["Plasmastoß", "Ionenschlag", "Photonenlanze"], feuer: ["Thermitladung", "Brandsalve", "Fusionsglut"],
    frost: ["Kryoschock", "Stasisstrahl", "Kälteladung"], betaeubung: ["Neuralschock", "EMP-Puls", "Schockfeld"],
    gift: ["Toxinwolke", "Nanoschwarm", "Säurenebel"], furcht: ["Psi-Schrei", "Schreckprojektor"], stoss: ["Gravitonstoß", "Repulsorwelle"],
    schwaechung: ["Störsignal", "Zielstörung", "Virenangriff"], heilung: ["Nanoheilung", "Medidrohne", "Reparaturschwarm"],
    schutz: ["Kraftfeld", "Deflektorschild", "Panzerplatten"], staerkung: ["Kampfstimulans", "Zielsuchsystem", "Taktiknetz"],
    sprung: ["Sprungdüse", "Phasensprung", "Teleporter"], tarnung: ["Tarnfeld", "Holoschleier"], beschwoerung: ["Kampfdrohne", "Drohnenstart"],
  };

  function baueWirkung(r, typ, opt) {
    const stufe = Math.min(6, Math.max(1, opt.stufe || 3));
    const gegner = opt.rolle === "enemy";
    const nutzungen = typ === "faehigkeit" ? (gegner ? NUTZUNG.sonderregel : NUTZUNG.faehigkeit) : NUTZUNG[typ];
    const passend = WIRKUNGEN.filter(w => !opt.tag || w.tags.includes(opt.tag) || opt.tag === "flaeche" || opt.tag === "einmalig" || opt.tag === "aura" || opt.tag === "reaktion" || opt.tag === "magie" || opt.tag === "technik");
    const ziel = ZIEL_BUDGET[stufe];
    let beste = null;
    for (let i = 0; i < 400; i++) {
      const wk = wahl(r, passend.length ? passend : WIRKUNGEN);
      const nu = wahl(r, nutzungen);
      if (opt.tag && ["einmalig", "aura", "reaktion"].includes(opt.tag) && nu.tag !== opt.tag) continue;
      if (nu.angreifer && !wk.feind) continue;
      const ziele = nu.angreifer ? [{ t: "Der Angreifer", m: 1, ohneRw: true }] : wk.selbst ? ZIEL_SELBST : wk.feind ? ZIELE_FEIND : ZIELE_FREUND;
      const zi = wahl(r, ziele);
      if (opt.tag === "flaeche" && !zi.flaeche) continue;
      const rw = zi.ohneRw ? { z: 0, m: 1 } : wahl(r, zi.flaeche ? REICHWEITEN.slice(0, 2) : REICHWEITEN);
      const roh = wk.basis * zi.m * rw.m * nu.m;
      const abstand = Math.abs(roh - ziel);
      if (!beste || abstand < beste.abstand) beste = { wk, nu, zi, rw, roh, abstand };
      if (abstand <= ziel * 0.15) break;
    }
    const { wk, nu, zi, rw, roh } = beste;
    const sf = opt.tag === "technik";
    const zielText = zi.t.replace("{rw}", rw.z + "\"");
    let satz = `${nu.t} ${zielText} ${zi.pl ? wk.pl : wk.sg}.`;
    if (sf) satz = satz.replace("einen Geistwolf", "eine Kampfdrohne").replace("A2 Nahkampf) in 3\" herbei, der", "Laser 12\" A1) in 3\" herbei, die").replace(/^Zauber/, "Psi");
    const tags = [...new Set([...wk.tags, zi.tag, nu.tag, typ === "zauber" ? "magie" : null, sf ? "technik" : null].filter(Boolean))];
    const namen = sf && SF_NAMEN[wk.id] ? SF_NAMEN[wk.id] : wk.namen;
    return { wk, nu, roh, satz, tags, gegner, namen, sf };
  }

  function faehigkeit(opt = {}) {
    const r = rng(opt.seed || Date.now());
    const { roh, satz, tags, gegner, namen } = baueWirkung(r, "faehigkeit", opt);
    const fest = auf5(roh);
    // Sonderregeln der Gegner als Aufschlag in Prozent, bezogen auf eine Einheit von etwa 80 Punkten
    const kosten = gegner ? { typ: "prozent", wert: auf5(roh * 100 / 80) } : { typ: "fest", wert: fest };
    return { typ: "faehigkeit", name: wahl(r, namen), art: gegner ? "Sonderregel" : "Skill",
      fuer: gegner ? ["enemy", "companion"] : ["hero"], tags, kosten, text: satz, quelle: "Generator" };
  }
  function zauber(opt = {}) {
    const r = rng(opt.seed || Date.now());
    const { roh, satz, tags, namen, sf } = baueWirkung(r, "zauber", { ...opt, rolle: "hero" });
    return { typ: "zauber", name: wahl(r, namen), art: sf ? "Psi-Kraft" : "Zauber", fuer: ["hero", "companion", "enemy"], tags,
      kosten: { typ: "fest", wert: auf5(roh) }, text: satz, quelle: "Generator" };
  }
  function gegenstand(opt = {}) {
    const r = rng(opt.seed || Date.now());
    const stufe = Math.min(6, Math.max(1, opt.stufe || 3));
    const passend = AUSRUESTUNG.filter(a => !opt.tag || a.tags.includes(opt.tag));
    if (passend.length && (r() < 0.5 || opt.tag && !WIRKUNGEN.some(w => w.tags.includes(opt.tag)))) {
      const a = wahl(r, passend);
      // Höhere Stufen bekommen eine zweite Eigenschaft dazu
      const zweite = stufe >= 4 ? wahl(r, AUSRUESTUNG.filter(x => x !== a)) : null;
      const wert = auf5(a.basis + (zweite ? zweite.basis : 0));
      return { typ: "gegenstand", name: gross(wahl(r, a.vor) + wahl(r, a.nomen)), art: "Ausrüstung", fuer: ["hero", "companion"],
        tags: [...new Set([...a.tags, ...(zweite ? zweite.tags : [])])], kosten: { typ: "fest", wert }, text: zweite ? `${a.text} ${zweite.text}` : a.text, quelle: "Generator" };
    }
    const { nu, roh, satz, tags, namen, sf } = baueWirkung(r, "gegenstand", { ...opt, rolle: "hero" });
    const art = sf ? (nu.art === "Trank" ? "Verbrauchsgut" : "Gerät") : nu.art || "Artefakt";
    const nomen = sf ? (nu.art === "Trank" ? wahl(r, ["Injektor", "Stimpack", "Ampulle"]) : wahl(r, ["Modul", "Granate", "Chip", "Projektor"]))
      : art === "Trank" ? wahl(r, ["Trank", "Phiole", "Injektor"]) : wahl(r, ["Schriftrolle", "Rune", "Talisman", "Granate", "Zepter"]);
    return { typ: "gegenstand", name: `${nomen}: ${wahl(r, namen)}`, art, fuer: ["hero", "companion"], tags,
      kosten: { typ: "fest", wert: auf5(roh) }, text: satz, quelle: "Generator" };
  }

  function generiere(R, typ, opt = {}) {
    if (typ === "waffe") return waffe(R, opt);
    if (typ === "zauber") return zauber(opt);
    if (typ === "gegenstand") return gegenstand(opt);
    return faehigkeit(opt);
  }

  const Generator = { generiere, waffenPreis, WIRKUNGEN, AUSRUESTUNG, REFERENZ };
  if (typeof module !== "undefined" && module.exports) module.exports = Generator;
  else root.Generator = Generator;
})(typeof globalThis !== "undefined" ? globalThis : this);

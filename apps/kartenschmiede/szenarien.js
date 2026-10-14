/* Kartenschmiede – Szenarien: Kampagne Moosgrab, Zusatzmissionen, Tischkarten.
   Reines JavaScript ohne DOM, damit dieselbe Datei im Browser läuft und in den Tests geprüft wird.

   Gebaut für den Esstisch: bis 120 × 80 cm (48" × 32") nutzbar, das ist der Standard für Zusatzmissionen. Die
   Kampagnenskizzen sind auf 60 × 60 cm gezeichnet (wie die K1S1-Karte) und lassen sich auf jeden Tisch strecken. Zwei Spieler (Franky oder Ramona) plus Chris als Spielleiter; die Gruppe ist frei.

   Zwei Arten Szenario:
   - Kampagnen-Maps (Moosgrab): von Hand geschrieben, im Format der K1S1-Karte – Hauptziel, Nebenziel, Spezialregel,
     Belohnung, Konsequenzen, Spielleiter-Hinweis – plus Spielleiter-Blatt je Teil (Auslöser, was die Spieler sehen,
     Aktionen mit Ergebnis, weiter wenn) und eine feste Tischskizze. Was die Spieler erst finden sollen, trägt
     „geheim“ und erscheint nur in der Spielleiter-Ansicht.
   - Zusatzmissionen: gewürfelt aus Schauplatz × Ziel × Komplikation, mit Alarmstufe nach OPR Quest (steigt jede
     Runde, bei 6 Verstärkung). Für Abende zwischen den Maps oder wenn eine Map schneller vorbei war.

   Vorbilder: OPR Age of Fantasy: Quest (Campaign Builder v2: Alarmstufe, Haupt-/Nebenziel, Suchmarker, Extraktion),
   Warhammer Quest Blackstone Fortress und Cursed City (Aktionswürfel, Uhren), Dunkelwasser (Verhaltenswürfel),
   Gloomhaven (Folgen von Map zu Map), Frostgrave (Funde, die man vom Tisch tragen muss). */
(function (root) {
  "use strict";

  // ---------- Zufall mit Saat ----------
  // Obere Bits verwenden – die unteren eines LCG haben eine winzige Periode (siehe CLAUDE.md, zieheFormkarten).
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const wahl = (r, a) => a[Math.floor(r() * a.length)];
  const mische = (r, a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const zwischen = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

  // ---------- Tische ----------
  // Breite × Tiefe in Zoll; die Helden sitzen an der unteren Kante.
  const TISCHE = [
    { id: "120x80", name: "Esstisch 120 × 80 cm", b: 48, t: 32 },
    { id: "60x60", name: "Esstisch 60 × 60 cm", b: 24, t: 24 },
    { id: "90x60", name: "Esstisch 90 × 60 cm", b: 36, t: 24 },
    { id: "90x90", name: "Matte 90 × 90 cm", b: 36, t: 36 },
  ];
  const tischVon = id => TISCHE.find(t => t.id === id) || TISCHE[0];
  // Eine Skizze auf einen anderen Tisch strecken: Mittelpunkte wandern mit, Geländestücke behalten ihre Größe
  // (Village-Ruins-Häuser wachsen nicht mit dem Tisch). Aufstellung und Zonen bleiben an ihrer Kante.
  function skaliereKarte(karte, tischId) {
    const ziel = tischVon(tischId);
    if (!karte || (karte.b === ziel.b && karte.t === ziel.t)) return karte;
    const fx = ziel.b / karte.b, fy = ziel.t / karte.t;
    // Beim Verkleinern bleibt ein Stück an der Kante stehen, statt über den Tisch zu ragen
    const klemme = (v, groesse, max) => Math.min(Math.max(0, v), Math.max(0, max - groesse));
    const mitte = o => ({ ...o, x: +klemme((o.x + o.w / 2) * fx - o.w / 2, o.w, ziel.b).toFixed(1), y: +klemme((o.y + o.h / 2) * fy - o.h / 2, o.h, ziel.t).toFixed(1) });
    const a = karte.aufstellung;
    return {
      ...karte, tisch: ziel.id, b: ziel.b, t: ziel.t,
      aufstellung: { x: +(a.x * fx).toFixed(1), y: +(ziel.t - (karte.t - a.y)).toFixed(1), w: +(a.w * fx).toFixed(1), h: a.h },
      gelaende: karte.gelaende.map(mitte),
      marker: karte.marker.map(m => (m.kante ? m : { ...m, x: +(m.x * fx).toFixed(1), y: +(m.y * fy).toFixed(1) })),
    };
  }

  // ---------- Geländearten nach OPR ----------
  const ARTEN = {
    deckung: "Deckung: +1 Verteidigung gegen Beschuss.",
    sicht: "Blockiert Sichtlinie.",
    schwierig: "Schwierig: höchstens 6\" Bewegung, wer hindurch will.",
    gefaehrlich: "Gefährlich: Wer hineinbewegt, würfelt W6, bei 1 eine Wunde.",
    unpassierbar: "Unpassierbar.",
    verseucht: "Verseucht (Sporennebel): Wer seine Aktivierung hier beendet, macht einen Qualitätstest, misslungen −1 auf Treffen bis Ende der nächsten Runde.",
  };
  // Gelände, wie es auf Chris' Tisch steht: Village Ruins, Filz, Kronkorken. form: rund, eckig oder lang.
  const GELAENDE = {
    ruine: { name: "Ruine", farbe: "#8a7f6c", form: "eckig", groesse: [4, 6], arten: ["deckung", "sicht"], tisch: "Ruinenteil aus Village Ruins" },
    haus: { name: "Haus", farbe: "#a0805a", form: "eckig", groesse: [5, 7], arten: ["deckung", "sicht"], tisch: "Village-Ruins-Haus, Tür markieren", regel: "Betreten nur durch die Tür oder ein Fenster (schwierig)." },
    mauer: { name: "Mauerrest", farbe: "#9b8f78", form: "lang", groesse: [4, 6], arten: ["deckung"], tisch: "Ruinenwand" },
    zaun: { name: "Zaun", farbe: "#7a5a38", form: "lang", groesse: [4, 6], arten: ["deckung", "schwierig"], tisch: "Zaunstück oder Äste" },
    baum: { name: "Umgestürzter Baum", farbe: "#6b5040", form: "lang", groesse: [4, 6], arten: ["deckung", "schwierig"], tisch: "Ast oder Ruinenwand" },
    wald: { name: "Dickicht", farbe: "#3f7a4a", form: "rund", groesse: [4, 6], arten: ["deckung", "schwierig"], tisch: "Grüner Filz mit Ästen" },
    sporen: { name: "Sporenbusch", farbe: "#a27cf0", form: "rund", groesse: [3, 5], arten: ["verseucht"], tisch: "Lila Filz oder Watte" },
    sporenwolke: { name: "Sporenwolke", farbe: "#a3b83a", form: "rund", groesse: [4, 6], arten: ["verseucht"], tisch: "Grüner Filz" },
    pilze: { name: "Riesenpilze", farbe: "#c27a5a", form: "rund", groesse: [2, 3], arten: ["deckung", "verseucht"], tisch: "Kronkorken oder Pilze" },
    sumpf: { name: "Morast", farbe: "#4f6b4a", form: "rund", groesse: [4, 6], arten: ["schwierig", "gefaehrlich"], tisch: "Brauner Filz" },
    wasser: { name: "Tiefes Wasser", farbe: "#3c6e9e", form: "lang", groesse: [6, 9], arten: ["unpassierbar"], tisch: "Blauer Filzstreifen" },
    fels: { name: "Felsen", farbe: "#7b7f86", form: "rund", groesse: [2, 4], arten: ["sicht", "unpassierbar"], tisch: "Steine oder Becher" },
    grab: { name: "Gräber", farbe: "#6d6a73", form: "eckig", groesse: [2, 4], arten: ["deckung"], tisch: "Grabsteine oder Kronkorken" },
    gruft: { name: "Offenes Grab", farbe: "#3d3a40", form: "eckig", groesse: [2, 2], arten: ["gefaehrlich"], tisch: "Dunkles Filzstück" },
    statue: { name: "Statue", farbe: "#bfb6a3", form: "rund", groesse: [1, 2], arten: ["sicht"], tisch: "Figur oder Flasche" },
    brunnen: { name: "Brunnen", farbe: "#5a8fb0", form: "rund", groesse: [3, 3], arten: ["deckung"], tisch: "Glas oder Tasse" },
    wurzeln: { name: "Wurzelwand", farbe: "#5a4632", form: "lang", groesse: [5, 8], arten: ["unpassierbar", "sicht"], tisch: "Braune Wolle oder Äste" },
    metall: { name: "Glatte Wand", farbe: "#7d8a93", form: "lang", groesse: [5, 8], arten: ["unpassierbar", "sicht"], tisch: "Alufolie über Karton" },
    labortisch: { name: "Werktisch", farbe: "#9fb3bf", form: "eckig", groesse: [3, 4], arten: ["deckung"], tisch: "Buch oder Schachtel" },
    tank: { name: "Glastank", farbe: "#2fe0cf", form: "rund", groesse: [2, 3], arten: ["deckung", "sicht"], tisch: "Trinkglas" },
    lava: { name: "Glutspalte", farbe: "#ff6a2b", form: "lang", groesse: [4, 6], arten: ["gefaehrlich"], tisch: "Roter Filzstreifen" },
    altar: { name: "Altar", farbe: "#c9a24a", form: "eckig", groesse: [2, 3], arten: ["deckung"], tisch: "Schachtel" },
  };
  const gelaendeText = art => {
    const g = GELAENDE[art];
    return [...g.arten.map(a => ARTEN[a]), g.regel].filter(Boolean).join(" ");
  };

  // ---------- Alarmstufe (OPR Quest) ----------
  // Steigt am Ende jeder Runde um 1, um 2 wenn kein Gegner mehr am Tisch ist, um 3 nach erfülltem Hauptziel
  // (dann zählt das Nebenziel). Bei 6: Verstärkung an einer zufälligen Feindzone, Verhaltenswürfel ab dann wütend,
  // Alarm zurück auf 0.
  const ALARM_MAX = 6;

  // ---------- Schauplätze für Zusatzmissionen ----------
  // Ereignisse (W6) werden zu Spielbeginn und bei jeder Verstärkung gewürfelt.
  const SCHAUPLAETZE = [
    {
      id: "waldrand", name: "Waldrand", fraktionen: ["Urwild"], boden: "#1f2a1c",
      gelaende: ["wald", "wald", "baum", "baum", "sporen", "sporenwolke", "ruine", "fels"],
      text: "Zwischen den Stämmen hängt ein Geruch nach nassem Brot. Das Moos ist zu weich.",
      regel: "Dämmerung: Sichtlinie höchstens 18\". Jede Verstärkung macht es eine Stufe dunkler (12\", dann 9\").",
      ereignisse: [
        "Ein Sporenbusch platzt: Das Feld 3\" um den nächsten Sporenbusch wird bis Rundenende verseucht.",
        "Etwas schreit im Wald. Alle Helden machen einen Moraltest, misslungen: 1 Aktionswürfel weniger im nächsten Zug.",
        "Ein Wildpfad: Ein Held darf sich sofort 6\" bewegen.",
        "Verirrtes Vieh läuft quer über den Tisch: Alarm +1.",
        "Heilkraut zwischen den Wurzeln: Der nächste Held im Dickicht heilt 1 Wunde.",
        "Stille. Nichts passiert, diesmal.",
      ],
    },
    {
      id: "friedhof", name: "Friedhof", fraktionen: ["Urwild", "Untote"], boden: "#2a2730",
      gelaende: ["grab", "grab", "grab", "gruft", "zaun", "statue", "baum", "ruine"],
      text: "Die Gräber sind von innen geöffnet. Die Erde darauf ist noch warm.",
      regel: "Unruhige Erde: Wer neben einem Grab ein Suchmarker untersucht, würfelt W6. Bei 1 greift eine Hand nach ihm (1 Treffer).",
      ereignisse: [
        "Ein Grab bricht auf: Ein gewöhnlicher Gegner erscheint am nächsten Grab.",
        "Kalter Hauch: Jeder Held macht einen Qualitätstest, misslungen −1 auf Treffen bis Rundenende.",
        "Glockenschlag aus der Ferne: Alarm +1.",
        "Vergessene Opfergabe: Der nächste Held an einer Statue findet einen Heiltrank.",
        "Nebel zwischen den Steinen: Bis Rundenende Sicht höchstens 9\".",
        "Ein Name auf einem Grabstein ist frisch eingeritzt. Wer ihn laut vorliest, bekommt 1 Sporenpunkt und einen Beutewurf.",
      ],
    },
    {
      id: "dorf", name: "Verlassener Weiler", fraktionen: ["Urwild", "Menschen"], boden: "#2c2924",
      gelaende: ["haus", "haus", "haus", "zaun", "zaun", "brunnen", "mauer", "ruine"],
      text: "Teller stehen noch auf dem Tisch. Die Türen sind von außen verriegelt.",
      regel: "Häuser: Ein Suchmarker in einem Haus gibt einen Beutewurf mit +1, aber das Öffnen der Tür kostet Alarm +1.",
      ereignisse: [
        "Ein Fensterladen schlägt: Alarm +1.",
        "Jemand ruft aus einem Haus um Hilfe. Wer hineingeht, findet einen Überlebenden (zählt als Verbündeter ohne Waffen) oder einen Befallenen (W6: 1–3).",
        "Ein Dach stürzt ein: Alle Einheiten im Haus erleiden 1 Treffer.",
        "Ein Hund ohne Augen bellt: Der Held mit den meisten Sporenpunkten wird ab jetzt bevorzugt angegriffen.",
        "Eine Laterne brennt noch: Der Held, der sie nimmt, sieht bis Missionsende 6\" weiter.",
        "Stille. Nur das Ticken einer Uhr.",
      ],
    },
    {
      id: "moor", name: "Moor", fraktionen: ["Urwild", "Saurier"], boden: "#1e2a26",
      gelaende: ["sumpf", "sumpf", "wasser", "wald", "baum", "sporenwolke", "fels"],
      text: "Knietiefes Wasser, warmer Nebel, und Blasen, die nach Pilz riechen.",
      regel: "Nebel: Sicht höchstens 18\". Gegner mit Hinterhalt erscheinen auch bei Verstärkung im Morast.",
      ereignisse: [
        "Blutegel: Jeder Held im Morast erleidet 1 Treffer.",
        "Etwas zieht am Bein: Ein zufälliger Held im Morast verliert 1 Aktionswürfel im nächsten Zug.",
        "Der Nebel steigt: Bis Rundenende Sicht höchstens 9\".",
        "Ein Irrlicht: Ein Held darf sich sofort 6\" zum Missionsziel bewegen.",
        "Ein alter Steg: Tiefes Wasser ist bis Rundenende passierbar (schwierig).",
        "Gurgeln aus der Tiefe: Alarm +1.",
      ],
    },
    {
      id: "hoehle", name: "Wurzelhöhle", fraktionen: ["Urwild"], boden: "#251d18",
      gelaende: ["wurzeln", "wurzeln", "fels", "fels", "pilze", "pilze", "sporen"],
      text: "Die Wände atmen. Ganz langsam, aber sie atmen.",
      regel: "Enge: Zwischen Wurzelwänden passen höchstens zwei Figuren nebeneinander. Fernkampf über 12\" nicht möglich.",
      ereignisse: [
        "Die Wände atmen aus: Jede Einheit neben einer Wurzelwand macht einen Qualitätstest, misslungen 1 Treffer.",
        "Ein Gang schließt sich: Eine zufällige Wurzelwand wächst 2\" länger.",
        "Leuchtpilze: Bis Rundenende +1 auf Treffen für Fernkampf.",
        "Etwas kriecht durch die Decke: Ein gewöhnlicher Gegner erscheint über dem Helden mit den meisten Sporenpunkten.",
        "Ein alter Rucksack: Beutewurf.",
        "Herzschlag im Boden: Alarm +1.",
      ],
    },
    {
      id: "ruinen", name: "Alte Ruinen", fraktionen: ["Menschen", "Orks", "Untote", "Urwild"], boden: "#2a2622",
      gelaende: ["ruine", "ruine", "mauer", "mauer", "statue", "altar", "wald"],
      text: "Hier stand einmal ein Gutshof. Jetzt stehen nur noch Mauern, und darin wächst etwas.",
      regel: "Einsturzgefahr: Wer in einer Ruine eine Explosion auslöst oder abbekommt, würfelt W6, bei 1 stürzt sie ein (2 Treffer für alle darin).",
      ereignisse: [
        "Einsturz: Eine zufällige Ruine stürzt ein, alle Einheiten darin erleiden 2 Treffer.",
        "Plünderer: Ein gewöhnlicher Gegner einer anderen Fraktion erscheint an einer Tischkante und greift den Nächsten an.",
        "Glockenläuten: Alarm +1.",
        "Vergessenes Versteck: Der nächste Held an einer Statue findet eine Rauchbombe.",
        "Regen: Bis Rundenende −1 auf Treffen für Fernkampf über 12\".",
        "Ein Überlebender ruft um Hilfe: Wer ihn erreicht (Tischmitte), bekommt 1 EP.",
      ],
    },
  ];

  // ---------- Missionsziele für Zusatzmissionen ----------
  // marker: was auf den Tisch kommt. zone: wo. faktor: Startwelle, verstaerkung: Anteil je Alarm-6.
  const ZIELE = [
    { id: "bergen", name: "Bergen", haupt: "Findet unter den Suchmarkern das Gesuchte und tragt es über die eigene Kante.",
      regeln: ["Drei Suchmarker. Untersuchen: Held in Kontakt, 1 Aktion. W6: 5+ ist es, der dritte Marker ist es immer.", "Der Träger bewegt sich 2\" weniger. Fällt er, bleibt es liegen."],
      marker: [{ typ: "suche", anzahl: 3, zone: "fern" }], faktor: 0.8, verstaerkung: 0.35, runden: 7 },
    { id: "rettung", name: "Rettung", haupt: "Befreit die Gefangenen und bringt mindestens zwei über die eigene Kante.",
      regeln: ["Zwei Gefangene (Verteidigung 6+, Zäh 2, folgen einem Helden in 3\"). Fesseln lösen: 1 Aktion mit 3+.", "Gegner greifen Gefangene an, wenn sie näher stehen als jeder Held."],
      marker: [{ typ: "gefangener", anzahl: 2, zone: "fern" }], faktor: 0.8, verstaerkung: 0.35, runden: 7 },
    { id: "untersuchen", name: "Untersuchen", haupt: "Untersucht alle Suchmarker und kehrt lebend in die Aufstellungszone zurück.",
      regeln: ["Vier Suchmarker. Jeder gibt einen Hinweis oder einen Beutewurf (W6: 1 Falle, 1 Treffer; 2–3 Hinweis; 4–6 Beute)."],
      marker: [{ typ: "suche", anzahl: 4, zone: "verteilt" }], faktor: 0.6, verstaerkung: 0.35, runden: 7 },
    { id: "saeubern", name: "Nest ausräuchern", haupt: "Zerstört das Nest. Dann zieht euch zurück.",
      regeln: ["Das Nest: Verteidigung 4+, Zäh 8, greift nicht an. Solange es steht, erscheint zu Rundenende ein gewöhnlicher Gegner daneben.", "Feuer-Waffen machen gegen das Nest DS(+1)."],
      marker: [{ typ: "nest", anzahl: 1, zone: "fern" }], faktor: 0.7, verstaerkung: 0.3, runden: 7 },
    { id: "halten", name: "Halten", haupt: "Haltet den Platz in der Tischmitte, bis der Wagen durch ist (5 Runden).",
      regeln: ["Zone: 4\" um den Mittelpunkt. Gegner bewegen sich immer auf die Zone zu.", "Zu jedem Rundenende ab Runde 2 muss ein Held in der Zone stehen, sonst Alarm +2."],
      marker: [{ typ: "zone", anzahl: 1, zone: "zentrum" }], faktor: 0.6, verstaerkung: 0.4, runden: 5 },
    { id: "durchbruch", name: "Durchbruch", haupt: "Erreicht die gegenüberliegende Kante. Die Hälfte der Gruppe muss durchkommen.",
      regeln: ["Gegner erscheinen an den Seitenkanten.", "Wer die Fluchtkante erreicht, nimmt die Figur vom Tisch."],
      marker: [{ typ: "ausgang", anzahl: 1, zone: "gegenkante" }], faktor: 0.7, verstaerkung: 0.35, runden: 6 },
    { id: "jagd", name: "Jagd", haupt: "Stellt die Bestie und erlegt sie, bevor sie entkommt.",
      regeln: ["Die Bestie ist die stärkste Einheit der Startwelle und steht verdeckt an einem von zwei Spurmarkern (W6: 1–3, 4–6).", "Ab Runde 4 bewegt sie sich zur nächsten Kante. Erreicht sie die Kante, ist die Mission verloren."],
      marker: [{ typ: "spur", anzahl: 2, zone: "fern" }], faktor: 1, verstaerkung: 0.3, runden: 7, boss: true },
  ];
  // Nebenziele nach OPR: erscheinen erst, wenn das Hauptziel erfüllt ist. Ab dann Alarm +3 pro Runde statt +1.
  const NEBENZIELE = [
    { id: "pluendern", name: "Plündern", text: "Öffnet die Truhe, bevor ihr geht: Beutewurf mit +2." },
    { id: "spur", name: "Spur sichern", text: "Untersucht den Körper des stärksten erledigten Gegners (1 Aktion): ein Hinweis für die Kampagne." },
    { id: "eskorte", name: "Begleiten", text: "Ein Überlebender taucht an der fernen Kante auf. Bringt ihn mit." },
    { id: "verbrennen", name: "Verbrennen", text: "Zündet zwei Sporenbüsche an (je 1 Aktion mit 3+). Jeder verbrannte Busch: Atemzug-Leiste −1." },
    { id: "verhoeren", name: "Verhören", text: "Schlagt den Anführer der nächsten Verstärkung nieder, ohne ihn zu töten (letzte Wunde im Nahkampf), und fragt ihn aus: ein Hinweis." },
  ];
  const KOMPLIKATIONEN = [
    { id: "keine", name: "Keine", text: "Alles läuft nach Plan. Fast." },
    { id: "zeitdruck", name: "Zeitdruck", text: "Die Alarmstufe startet auf 2." },
    { id: "erschoepft", name: "Erschöpft", text: "Die Helden starten mit 1 Wunde, dafür +1 EP bei Sieg." },
    { id: "unwetter", name: "Unwetter", text: "Fernkampf über 12\" −1 auf Treffen, Fliegen nicht erlaubt." },
    { id: "reiche-beute", name: "Reiche Beute", text: "Zwei zusätzliche Truhen. Jede geöffnete Truhe: Alarm +1." },
    { id: "versprengt", name: "Versprengt", text: "Jeder Held stellt an einer eigenen Stelle der Aufstellungskante auf, mindestens 6\" vom nächsten." },
    { id: "hilfe", name: "Unerwartete Hilfe", text: "Ein Söldner (Gegnerkarte bis Stufe Selten) kämpft für die Helden, solange er lebt." },
    { id: "namen", name: "Flüstern", text: "Das Moos flüstert. Wer einen Namen sagt, bekommt 1 Sporenpunkt – auch Namen von Gegnern oder Orten." },
  ];
  const BEUTE = [
    [1, "nichts", "Leer. Nur Staub und eine tote Spinne."],
    [2, "heiltrank", null], [3, "rauchbombe", null], [4, "heldenelixier", null], [5, "feuertopf", null],
    [6, "amulett-abwehr", null], [7, "ring-regeneration", null],
  ];
  const SCHWIERIGKEIT = [
    { stufe: 1, name: "Anfänger", anteil: 0.25 }, { stufe: 2, name: "Fortgeschritten", anteil: 0.5 },
    { stufe: 3, name: "Experte", anteil: 0.75 }, { stufe: 4, name: "Legendär", anteil: 1 },
  ];

  // ---------- Kartengenerator ----------
  // Tisch in Zoll, Ursprung oben links. Helden stellen unten auf (4" tief), Feindzonen oben und an den Seiten.
  // Gelände ohne Überlappung, mit mindestens 2" Lücke – auf dem kleinen Tisch müssen Bases trotzdem durchpassen.
  function platziere(r, belegt, w, h, bereich, abstand) {
    for (let v = 0; v < 200; v++) {
      const x = bereich.x + r() * Math.max(0, bereich.w - w), y = bereich.y + r() * Math.max(0, bereich.h - h);
      const frei = belegt.every(b => x + w + abstand <= b.x || b.x + b.w + abstand <= x || y + h + abstand <= b.y || b.y + b.h + abstand <= y);
      if (frei) { const s = { x: +x.toFixed(1), y: +y.toFixed(1), w, h }; belegt.push(s); return s; }
    }
    return null;
  }
  function zoneFuer(zone, B, T) {
    switch (zone) {
      case "fern": return { x: 2, y: 2, w: B - 4, h: T * 0.4 };
      case "zentrum": return { x: B / 2 - 1, y: T / 2 - 1, w: 2, h: 2 };
      default: return { x: 2, y: 2, w: B - 4, h: T - 9 };
    }
  }
  function baueKarte(r, schauplatz, ziel, opt = {}) {
    const tisch = tischVon(opt.tisch), B = tisch.b, T = tisch.t;
    const aufstellung = { x: 0, y: T - 4, w: B, h: 4 };
    const belegt = [{ ...aufstellung }];
    const marker = [];
    let nr = 1;
    for (const m of ziel.marker) {
      for (let i = 0; i < m.anzahl; i++) {
        if (m.zone === "gegenkante") { marker.push({ typ: m.typ, kante: true }); continue; }
        if (m.zone === "zentrum") { marker.push({ typ: m.typ, x: B / 2, y: T / 2, radius: 4 }); belegt.push({ x: B / 2 - 2, y: T / 2 - 2, w: 4, h: 4 }); continue; }
        const bereich = zoneFuer(m.zone, B, T);
        const s = platziere(r, belegt, 2, 2, bereich, 5) || platziere(r, belegt, 2, 2, bereich, 2) || platziere(r, belegt, 2, 2, zoneFuer("", B, T), 1);
        if (s) marker.push({ typ: m.typ, x: s.x + 1, y: s.y + 1, nr: nr++ });
      }
    }
    const truhen = 1 + (opt.komplikation === "reiche-beute" ? 2 : 0);
    for (let i = 0; i < truhen; i++) {
      const s = platziere(r, belegt, 1.5, 1.5, zoneFuer("", B, T), 3);
      if (s) marker.push({ typ: "truhe", x: s.x + 0.75, y: s.y + 0.75 });
    }
    // Feindzonen: zwei oben, bei Durchbruch an den Seiten
    const feind = ziel.id === "durchbruch" ? [[1.5, T * 0.35], [B - 1.5, T * 0.55]] : [[B * 0.25, 1.5], [B * 0.75, 1.5]];
    if (B > 30) feind.push(ziel.id === "durchbruch" ? [B - 1.5, T * 0.25] : [B / 2, 1.5]);
    feind.forEach(([x, y], i) => marker.push({ typ: "feind", x, y, label: String.fromCharCode(65 + i) }));
    // Gelände: 5–7 Stücke auf 60 × 60, auf 120 × 80 etwa 8–11 – mit der Wurzel der Fläche, nicht linear, damit das
    // kleine Geländebudget (Village Ruins plus Filz) reicht
    const anzahl = Math.max((opt.pflicht || []).length, Math.round(Math.sqrt((B * T) / 576) * zwischen(r, 5, 7)));
    const pool = [...(opt.pflicht || []), ...mische(r, schauplatz.gelaende)];
    const gelaende = [];
    for (let i = 0; i < anzahl; i++) {
      const art = pool[i % pool.length], g = GELAENDE[art];
      const a = zwischen(r, g.groesse[0], g.groesse[1]);
      const [w, h] = g.form === "lang" ? (r() < 0.5 ? [a, 1.5] : [1.5, a]) : g.form === "eckig" ? [a, Math.max(2, Math.round(a * (0.6 + r() * 0.4)))] : [a, a];
      const s = platziere(r, belegt, w, h, { x: 1, y: 1, w: B - 2, h: T - 2 }, 2);
      if (s) gelaende.push({ art, ...s });
    }
    return { tisch: tisch.id, b: B, t: T, aufstellung, gelaende, marker };
  }

  // ---------- Zusatzmission erzeugen ----------
  const TITEL = {
    bergen: ["Was im Moos liegt", "Die verlorene Kiste", "Ein Fund für Hedda"], rettung: ["Hilferufe", "Ketten aus Wurzeln", "Die Letzten vom Hof"],
    untersuchen: ["Spuren im Nebel", "Was die Hunde wussten", "Der stille Hof"], saeubern: ["Das Nest", "Feuer und Sporen", "Brut"],
    halten: ["Der Wagen muss durch", "Die Brücke", "Bis der Morgen kommt"], durchbruch: ["Kein Weg zurück", "Durch den Nebel", "Raus hier"],
    jagd: ["Die Fährte", "Das Ding ohne Augen", "Bestie am Waldrand"],
  };
  function erzeuge(opt = {}) {
    const seed = (opt.seed >>> 0) || (Date.now() >>> 0);
    const r = rng(seed);
    const schauplatz = SCHAUPLAETZE.find(s => s.id === opt.schauplatz) || wahl(r, SCHAUPLAETZE);
    const ziel = ZIELE.find(z => z.id === opt.ziel) || wahl(r, ZIELE);
    const neben = NEBENZIELE.find(n => n.id === opt.nebenziel) || wahl(r, NEBENZIELE);
    const komplikation = KOMPLIKATIONEN.find(k => k.id === opt.komplikation) || (r() < 0.35 ? KOMPLIKATIONEN[0] : wahl(r, KOMPLIKATIONEN.slice(1)));
    const schw = SCHWIERIGKEIT.find(s => s.stufe === +opt.schwierigkeit) || SCHWIERIGKEIT[1];
    const fraktion = opt.fraktion !== undefined ? opt.fraktion : wahl(r, schauplatz.fraktionen);
    const karte = baueKarte(r, schauplatz, ziel, { tisch: opt.tisch, komplikation: komplikation.id, pflicht: opt.pflicht });
    return {
      version: 2, art: "zusatz", seed, titel: opt.titel || wahl(r, TITEL[ziel.id]), quelle: "Zusatzmission",
      schauplatz: schauplatz.id, ziel: ziel.id, nebenziel: neben.id, komplikation: komplikation.id, schwierigkeit: schw.stufe, fraktion,
      tisch: karte.tisch, runden: ziel.runden, alarmStart: komplikation.id === "zeitdruck" ? 2 : 0,
      einleitung: `${schauplatz.text}`,
      karte,
      // EP nach OPR: Hauptziel 2 × Schwierigkeit, Nebenziel 1 × Schwierigkeit
      ep: { haupt: 2 * schw.stufe, neben: schw.stufe },
      beute: Math.max(1, schw.stufe - 1),
    };
  }
  const details = sz => ({
    schauplatz: SCHAUPLAETZE.find(s => s.id === sz.schauplatz) || SCHAUPLAETZE[0],
    ziel: ZIELE.find(z => z.id === sz.ziel) || ZIELE[0],
    nebenziel: NEBENZIELE.find(n => n.id === sz.nebenziel) || NEBENZIELE[0],
    komplikation: KOMPLIKATIONEN.find(k => k.id === sz.komplikation) || KOMPLIKATIONEN[0],
    schwierigkeit: SCHWIERIGKEIT.find(s => s.stufe === sz.schwierigkeit) || SCHWIERIGKEIT[1],
  });
  // Punkte der Gegner: eine volle Welle = Heldenpunkte × Anteil der Schwierigkeit (OPR: 25/50/75/100 %)
  function wellenPunkte(sz, heldenpunkte) {
    const { ziel, schwierigkeit } = details(sz);
    const voll = heldenpunkte * schwierigkeit.anteil;
    return [{ wann: "Start", punkte: Math.round(voll * ziel.faktor) }, { wann: "Je Alarm 6", punkte: Math.round(voll * ziel.verstaerkung) }];
  }

  // =====================================================================================================
  // ---------- Kampagne Moosgrab ----------
  // Inhalt aus Chris' Kampagnenbibel (Claude-Dokument „Moosgrab – Kampagnenbibel“). Map 1 und 2 sind dort
  // ausgearbeitet und hier verdichtet; Map 3 bis 5 sind hier ausgeschrieben und warten auf Chris' Abnahme.
  // Tischskizzen in Zoll auf 24" × 24" (60 × 60 cm), Norden oben, Helden starten unten.
  // geheim: true = nur in der Spielleiter-Ansicht (keine Spoiler, siehe docs/KAMPAGNEN_UEBERGABE.md).
  // =====================================================================================================
  const g = (art, x, y, w, h, label, geheim) => ({ art, x, y, w, h, ...(label ? { label } : {}), ...(geheim ? { geheim: true } : {}) });
  const m = (typ, x, y, label, geheim) => ({ typ, x, y, ...(label ? { label } : {}), ...(geheim ? { geheim: true } : {}) });

  const MOOSGRAB = {
    id: "moosgrab", name: "Moosgrab",
    text: "Ein Dorf am alten Wald verfällt einem Pilz, der Menschen zu Pilzzombies macht. Die Geschichte wird Schritt für Schritt aufgedeckt und mischt Rollenspiel und Kampf. Fünf Maps im Rhythmus Kampf, Stille, Kampf, Wendepunkt, Finale.",
    wahrheit: "Unter dem Dorfbrunnen liegt eine versenkte Forschungsstation, die ein Pilzgeflecht als lebende Waffe züchtete. Vor etwa 40 Jahren fiel sie „als Stern“ in den Wald. Männer in „Rüstungen ohne Nähte“ suchten sie; keiner kam zurück, sie liegen heute als Myzel-Soldaten unten. Das Dorf schüttete das Loch zu und baute den Brunnen darauf. Vor drei Wochen erwachte das Geflecht: erst Hunde, dann Vieh, dann Lichter im Wald, dann Pilze aus den Gräbern. Es lernt: erst Tiere, dann Menschen, dann Namen. Das Stationssignal ist wieder aktiv, ein Space-Marine-Bergungstrupp ist unterwegs. Er hilft den Helden, will aber eine Probe des Herzens sichern.",
    leisten: [
      { name: "Atemzug-Leiste", gilt: "Ganze Kampagne", text: "Nach jeder Map oder Rast 1 Strich. Jeder Suchmarker, der erst nach dem Kampf gesucht wird: +1 Strich. Jeder Strich: eine Feindzone wächst oder ein verseuchtes Feld kommt dazu. Im Finale bestimmt die Leiste den Nachschub pro Runde." },
      { name: "Sporennebel", gilt: "Ab Map 1", text: ARTEN.verseucht },
      { name: "Namensregel", gilt: "Ab Map 2", text: "Wer im Spiel den Namen seines Helden laut sagt, bekommt 1 Sporenpunkt. Befallene Helden werden von Gegnern bevorzugt angegriffen und würfeln 3 statt 4 Aktionswürfel (ab 3 Sporenpunkten), schwer befallene 2 (ab 5). Die Schwellen sind ein Vorschlag." },
      { name: "Suchmarker", gilt: "Alle Maps", text: "Held in Kontakt, 1 Aktion. Jeder Marker gibt einen Hinweis oder einen Beutewurf." },
      { name: "Verhaltenswürfel", gilt: "Alle Maps", text: "Gegner würfeln 4 Aktionswürfel, ein weiterer W6 sagt, was sie damit tun. Ruhig bis Runde 3, wütend ab Runde 4 oder nach Alarm (Lärm 6, Glocke, Boss)." },
    ],
    maps: [
      // ---------------------------------------------------------------- Map 1
      {
        nr: 1, empfohlen: "60x60", titel: "Der kranke Waldrand", ton: "Horror, Rettung", stand: "fertig (Kampagnenbibel, Tab Map 1)",
        einleitung: "Am Waldrand vor Moosgrab ist das Moos zu weich und die Luft zu warm. Irgendwo vor euch schreit eine Frau.",
        hauptziel: "Untersucht die 3 Suchmarker und findet die Quelle der Verderbnis.",
        nebenziel: "Rettet die verirrte Dorfbewohnerin, bevor die Finsternis sie erreicht.",
        spezial: ["Sporennebel: Lila Büsche und die grüne Wolke sind verseucht.", "Sporenuhr: Startet mit Cue 01B-2. Nach 3 Runden verwandelt sich die Frau. Erreichen die Helden sie vorher, gibt sie einen Hinweis. Sie mutiert in jedem Fall."],
        belohnung: "1 Beutewurf, 1 seltenes Material, Story-Fortschritt. Der Kupferanhänger mit dem Zeichen der Kapelle.",
        konsequenzen: ["Alle Marker gesichert: Bonus-Beute in Map 2.", "Dorfbewohnerin verloren, ohne sie zu erreichen: kein Hinweis, spätere Hilfe entfällt.", "Quelle früh zerstört: weniger Verstärkung im Finale (Atemzug-Leiste −1)."],
        hinweis: "Gegner beginnen defensiv (ruhige Tabelle) und werden nach dem zweiten Suchmarker aggressiv. Den ganzen Tisch vor dem Intro aufbauen (Gelände, drei Suchmarker offen, Feindzonen); die Quelle bleibt verdeckt, Kreaturen und die Frau kommen erst an ihrer Stelle.",
        gegner: "2 Sporenlinge je Feindzone ab Ende Runde 1; Boss: die Erblühte (die verwandelte Tochter, langsam, zäh, Sporenwolke).",
        karte: { tisch: "60x60", b: 24, t: 24, aufstellung: { x: 8, y: 20, w: 8, h: 4 },
          gelaende: [g("ruine", 9, 1, 6, 4, "Ruine"), g("sporen", 2, 3, 4, 4, "Sporenbusch"), g("sporen", 10, 10, 4, 4, "Sporenbusch"),
            g("sporenwolke", 17, 16, 5, 5, "Sporenwolke"), g("baum", 17, 8, 1.5, 6, "Umgestürzter Baum"), g("zaun", 21, 3, 1.5, 6, "Zaun"), g("baum", 4, 14, 5, 1.5, "Umgestürzter Baum")],
          marker: [m("suche", 3, 2, "1"), m("suche", 12, 12, "2"), m("suche", 19, 18, "3"), m("feind", 20, 2, "A"), m("feind", 2, 11, "B"), m("quelle", 12, 3, "Q", true)] },
        teile: [
          { name: "Spielbeginn", ausloeser: "Tisch aufgebaut", cue: "E0 Intro", sehen: "Der Waldrand mit drei Stellen, an denen etwas nicht stimmt.", tisch: "Danach der Brief der Wegwacht: der Auftrag." },
          { name: "Der Schrei", ausloeser: "Auftrag gelesen, Helden am Start", cue: "01B-1", sehen: "Eine Frau ist zu hören, nicht zu sehen.", tisch: "Frau noch nicht auf den Tisch." },
          { name: "Die Flucht", ausloeser: "Erste Bewegung der Helden", cue: "01B-2", sehen: "Die Frau stolpert aus dem Wald links.", tisch: "Die Frau stürzt vor Feindzone B in den Schlamm. Sporenuhr läuft (3 Runden)." },
          { name: "Die Kreaturen", ausloeser: "Ende Runde 1", cue: "01B-3", sehen: "Etwas Kleines zuckt aus dem Moos.", tisch: "2 Sporenlinge je Feindzone, Kampf beginnt." },
          { name: "Die Frau aus den Wurzeln", ausloeser: "Ein Held erreicht die Frau", cue: "01B-4A", sehen: "Sie ist voller Wurzeln, aber sie spricht.", tisch: "Rollenspiel, sie gibt 1 Hinweis: „Sagt meiner Mutter, ich hab den Weg nicht gefunden.“" },
          { name: "Das Aufblühen", ausloeser: "Nach dem Gespräch oder bei abgelaufener Sporenuhr: erst die Wahl der Helden, dann der Track", cue: "01B-4B, im Bosskampf der Battle Cue (3:15, Schleife)", sehen: "Sie blüht auf.", tisch: "Sie wird zur Erblühten, Bossfight. Ohne 4A kein Hinweis." },
          { name: "Was von ihr blieb", ausloeser: "Boss besiegt", cue: "01B-5", sehen: "Ein Kupferanhänger im Moos.", tisch: "Anhänger als Beute, Gegner werden aggressiv. Offene Suchmarker danach: je +1 Strich Atemzug-Leiste." },
        ],
        aktionen: [["Suchmarker 1", "Verdrehtes Wild: Der Pilz befiel zuerst Tiere."], ["Suchmarker 2", "Leiche eines Dorfbewohners mit Pilzen im Mund. Danach werden die Gegner aggressiv."], ["Suchmarker 3", "Die Spur führt zur Ruine mit der leuchtenden Quelle; sie kann früh zerstört werden."]],
        spieler: { spezial: ["Sporennebel: Lila Büsche und die grüne Wolke sind verseucht.", "Die Zeit drängt: Wer Hilfe braucht, wartet nicht ewig."], belohnung: "1 Beutewurf, 1 seltenes Material, und eine Spur." },
        weiter: "Der Anhänger trägt das Zeichen der Kapelle. „Sagt meiner Mutter …“ führt die Helden zu Mutter Hedda. Weiter mit Map 2.",
      },
      // ---------------------------------------------------------------- Map 2
      {
        nr: 2, empfohlen: "60x60", titel: "Die Kapelle ohne Priester", ton: "Stille, Rollenspiel", stand: "fertig (Kampagnenbibel, Tab Map 2)",
        einleitung: "Die Kapelle liegt mit dem Friedhof vor dem Dorf. Die Tür steht einen Spalt offen. Von drinnen kommt gleichmäßiges Flüstern.",
        hauptziel: "Findet heraus, ob in der Kapelle noch jemand lebt, und was in Moosgrab geschehen ist.",
        nebenziel: "Kommt bis zur Krypta, ohne die Gemeinde zu wecken.",
        spezial: ["Lärm-Leiste 0–6: Nahkampf +1, Fernkampf oder Zauber +2, Tür aufbrechen +2, Haupttür +1, Glocke sofort 6. Bei 3 drehen sich Gestalten um, bei 4 stehen sie auf, bei 6 erwacht die ganze Gemeinde.", "Namensregel ab hier."],
        belohnung: "Hinweise von Mutter Hedda, Kellerschlüssel des Gemeindehauses (wenn sie den Anhänger bekommt), Beutewurf am Grab der Linde.",
        konsequenzen: ["Glocke geläutet: 2 Verbündete in Map 3, aber +1 Feindzone.", "Nie Lärm 3 erreicht: Helden starten Map 3 unentdeckt, Gegner schlafend.", "Hedda die Wahrheit gesagt: Brunnen und befallene Dorfbewohner bekannt.", "Hedda geschont: nur der Brunnen bekannt.", "Krypta-Gang genommen: Start mitten im Dorf, im Dunkeln."],
        hinweis: "Kein Pflichtkampf: Wer leise bleibt, kommt ohne Kampf zur Krypta. Erst die Außenseite aufbauen, das Innere erst, wenn jemand hineinschaut. Die Falltür wird erst genannt, wenn jemand den Altar untersucht.",
        gegner: "6 bis 8 kniende Gemeinde-Figuren (greifen nur nach Lärm an), 1 zuckendes Grab (schwach, nur wer daneben steht).",
        karte: { tisch: "60x60", b: 24, t: 24, aufstellung: { x: 8, y: 21, w: 8, h: 3 },
          gelaende: [g("haus", 6, 1, 12, 8, "Kapelle"), g("altar", 11, 2, 2, 1.5, "Altar"), g("ruine", 18, 1, 3, 3, "Glockenturm"),
            g("grab", 2, 12, 3, 2, "Gräber"), g("grab", 8, 13, 3, 2, "Gräber"), g("grab", 15, 12, 3, 2, "Grab Harm"), g("grab", 19, 16, 3, 2, "Gräber"),
            g("wald", 2, 17, 4, 4, "Linde"), g("zaun", 0, 10, 1.5, 6, "Zaun"), g("zaun", 22.5, 10, 1.5, 6, "Zaun")],
          marker: [m("suche", 4, 18, "1"), m("suche", 16.5, 13, "2"), m("grab", 9.5, 16, "G"), m("tuer", 12, 9, "T"), m("fenster", 6, 5, "F"), m("sakristei", 17, 3, "S", true), m("falltuer", 12, 4, "F", true)] },
        teile: [
          { name: "Ankunft", cue: "02-1", ausloeser: "Spielbeginn", sehen: "Schiefe Zäune, Gräber von innen aufgebrochen, Kapellentür einen Spalt offen, gleichmäßiges Flüstern, ein Grab zuckt noch.", tisch: "Friedhof und Außenseite. Lärm-Leiste auf 0, Atemzug-Leiste aus Map 1.",
            aktionen: [["Suchmarker 1 (Linde)", "Beutewurf"], ["Suchmarker 2 (Grabstein Harm)", "Schlüssel zur Sakristei, dazu ein frisches Grab ohne Namen"], ["Zuckendes Grab ansehen", "Arm mit Ehering, greift an, wer daneben steht. Kampf: +1 Lärm"], ["Durchs Fenster spähen (1 Aktion)", "Inneres aufbauen: 7 kniende Gestalten, Altar mit einer frischen Kerze"], ["Glockenturm", "Seil hängt herab, nur erwähnen"]],
            weiter: "ein Held hineingeht: Haupttür +1 Lärm, Fenster leise aber schwierig, Sakristei nur mit Schlüssel, leise, direkt neben dem Altar." },
          { name: "Drinnen", cue: "02-2", ausloeser: "Ein Held ist drin", sehen: "Kalter Raum, Moos auf Bänken und Taufstein, die Gemeinde kniet mit dem Rücken zu euch, Moos aus den Ohren, alle flüstern dasselbe Wort. Vorn der Altar mit einer frischen Kerze.",
            aktionen: [["Schleichen", "Kein Lärm, höchstens normale Bewegung"], ["Angreifen", "Nahkampf +1, Fernkampf und Zauber +2 Lärm"], ["Einem Knienden ins Gesicht sehen", "Es ist der Bäcker. Grusel, kein Lärm"], ["Hinhören (Qualitätstest)", "Das Wort ist der Name der Tochter"], ["Altar untersuchen (leise)", "Warmer Luftzug am Boden, Kerzenlicht in den Ritzen: die Falltür. Erst dann 02-3"]],
            weiter: "jemand den Altar untersucht hat." },
          { name: "Die Falltür", cue: "02-3", ausloeser: "Altar untersucht", sehen: "Von unten verriegelt, Kerzenlicht in den Ritzen. Eine alte Stimme: „Wer ist da? Sagt keine Namen.“",
            aktionen: [["Anhänger zeigen", "Tür geht auf, kein Lärm"], ["Aufbrechen", "+2 Lärm, Hedda misstrauisch: 1 Hinweis weniger"], ["Einen Namen sagen", "Sie wird panisch, +1 Sporenpunkt für den Sprecher"]], weiter: "die Falltür offen ist." },
          { name: "Mutter Hedda (live gespielt)", cue: "02-4, 02-5", ausloeser: "Die Helden sind in der Krypta", sehen: "Eine Frau um die 60, Kerze und Messer.",
            aktionen: [["Wahrheit über die Tochter", "Wer schon befallen ist: der Schmied und die Familie Harm"], ["Schonen oder lügen", "Nur die Kernaussagen, sie hält Abstand"], ["Anhänger zurückgeben", "Kellerschlüssel des Gemeindehauses"], ["Nach dem Stern fragen", "„Als ich ein Kind war, fiel ein Stern in den Wald …“"], ["Grob werden", "Messer, Schweigen, nur Kernaussage 1"]],
            weiter: "die Helden ins Dorf aufbrechen (Cue 02-6). Krypta-Gang: leise, Start mitten im Dorf. Hauptweg: offen, eine wache Gemeinde folgt von hinten." },
        ],
        aktionen: [],
        laerm: [["3", "Extra-Cue 02-X1. 3 Gestalten drehen sich um, bei 4 stehen sie auf und greifen an."], ["6", "Extra-Cue 02-X2. Alle erwachen, draußen pro Runde 1 Gegner aus den Gräbern. Battle Cue 2."], ["Glocke", "Extra-Cue 02-X3. Wie bei 6, dazu 2 Verbündete in Map 3. Battle Cue 2."]],
        figuren: [{ name: "Mutter Hedda", wer: "Dorfälteste, um die 60, Kerze und Messer, seit zwei Tagen in der Krypta. Müde, gefasst, hart. Leise, kurze Sätze.",
          kern: ["„Sagt keine Namen.“ Die Wurzeln lernen Namen; wer gerufen wird, den findet es.", "„Es fing mit dem Brunnen an.“ Seit drei Wochen warme Luft aus dem Brunnen, der seit vierzig Wintern kalt war.", "„Das Dorf ist nicht leer.“ Überlebende hinter verriegelten Türen, aber auch Befallene, die noch normal aussehen."],
          nichtWissen: "Was unten atmet, wer die Rüstungsmänner waren, wie man den Pilz aufhält. „Das weiß der Brunnen.“" }],
        spieler: { nebenziel: "Bleibt so leise, dass nichts in der Kapelle aufwacht.", spezial: ["Lärm-Leiste 0–6: Nahkampf +1, Fernkampf oder Zauber +2, eine Tür aufbrechen +2, die Haupttür +1. Je lauter, desto mehr hört euch.", "Sagt keine Namen. Wer den Namen seines Helden laut sagt, bekommt 1 Sporenpunkt."], belohnung: "Antworten auf das, was in Moosgrab geschehen ist, und ein Beutewurf." },
        weiter: "Weiter mit Map 3. Folgen aus der Kapelle übertragen (Glocke, Lärm, Wahrheit an Hedda, Weg ins Dorf).",
      },
      // ---------------------------------------------------------------- Map 3
      {
        nr: 3, empfohlen: "120x80", titel: "Das Dorf bei Nacht", ton: "Häuserkampf, Misstrauen", stand: "neu ausgearbeitet, wartet auf Chris' Abnahme",
        einleitung: "Moosgrab liegt dunkel. Kein Hund bellt. In manchen Fenstern brennt noch Licht, und irgendwo schlägt ein Hammer, ganz gleichmäßig.",
        hauptziel: "Erreicht den Brunnen auf dem Dorfplatz, öffnet ihn und steigt hinab.",
        nebenziel: "Bringt mindestens zwei Überlebende in den Keller des Gemeindehauses. Der Keller ist sicher, solange niemand Befallenes darin ist.",
        spezial: [
          "Nacht: Sicht höchstens 12\". Eine Laterne (Suchmarker im Wirtshaus) gibt ihrem Träger 6\" mehr.",
          "Lärm-Leiste 0–6 wie in Map 2: Tür aufbrechen +2, Nahkampf +1, Fernkampf oder Zauber +2, ein Überlebender ruft einen Namen +1. Bei 3 öffnen sich die Türen der befallenen Häuser, bei 6 kommt das ganze Dorf (Alarm, Verhaltenswürfel wütend).",
          "Wer ist noch Mensch: Jeder Überlebende hat ein verdecktes Plättchen (Mensch oder Befallen). Ein Held kann einen Überlebenden ansehen (1 Aktion, Qualitätstest): gelungen, der Spielleiter nennt ein Merkmal (warme Hände, Moos hinter dem Ohr, er flüstert Namen).",
          "Überlebende flüstern Namen, wenn sie Angst haben: Zu Rundenende würfelt jeder Überlebende, der keinen Helden in 1\" hat, W6. Bei 1–2 ruft er einen Namen (Lärm +1).",
        ],
        belohnung: "Beutewürfe aus den Häusern, die Zange aus der Schmiede, ein Hinweis je geretteten Überlebenden. 2 EP für das Hauptziel, 1 EP für das Nebenziel.",
        konsequenzen: [
          "Zwei oder mehr Menschen gerettet: Sie warten in Map 5 oben am Brunnen mit einem Seil, auf der Flucht kommen drei Figuren je Runde in den Schacht statt zwei.",
          "Ein Befallener im Keller: In Map 5 kommen aus dem Gemeindehaus 2 zusätzliche Gegner.",
          "Der Schmied wurde besiegt: Die Rüstungsmänner in Map 4 hören keinen Takt mehr. In der ersten Runde nach dem Erwachen gilt für sie die ruhige Tabelle.",
          "Brunnen mit Gewalt geöffnet: Atemzug-Leiste +1.",
          "Gemeinde aus Map 2 wach: Sie kommt ab Runde 3 über den Hauptweg (2 Figuren je Runde).",
        ],
        hinweis: "Die Spieler entscheiden, wie viel Dorf sie sehen wollen. Hauptziel geht in 4–5 Runden, wer jedes Haus öffnet, braucht 8 und riskiert Lärm. Das Hämmern ist der Takt, in dem das Geflecht atmet – das sagt niemand, aber jedes Mal, wenn der Hammer aussetzt, wird es kurz still im ganzen Dorf.",
        gegner: "Befallene Dorfbewohner (Familie Harm: 3 Figuren am Abendbrottisch), der Schmied (Elite, mit Hammer; baut Chris als Karte), Sporenlinge aus den Gärten (2 je Feindzone bei Lärm 3). Gemeinde aus Map 2, falls wach.",
        start: [["Krypta-Gang", "Die Helden steigen aus dem alten Eiskeller links vom Dorfplatz (Marker E), Gegner schlafen, Lärm 0."], ["Hauptweg", "Die Helden kommen von unten über den Weg, Lärm startet auf 1."], ["Glocke geläutet", "2 Verbündete (Knechte aus der Kapelle, je Verteidigung 5+, Zäh 3, Knüppel A1), aber Feindzone C am Gemeindehaus kommt dazu."]],
        karte: { tisch: "60x60", b: 24, t: 24, aufstellung: { x: 8, y: 21, w: 8, h: 3 },
          gelaende: [g("brunnen", 10.5, 10.5, 3, 3, "Brunnen"), g("haus", 1, 1, 7, 5, "Gemeindehaus"), g("haus", 16, 1, 7, 5, "Schmiede"), g("haus", 0, 9, 5, 6, "Wohnhaus"),
            g("haus", 19, 9, 5, 6, "Wirtshaus"), g("haus", 16, 16, 6, 5, "Bäckerei"), g("zaun", 2, 18, 5, 1.5, "Gartenzaun"), g("sporen", 9, 4, 3, 3, "Garten (verseucht)"), g("baum", 6, 15, 1.5, 4, "Holzstapel")],
          marker: [m("suche", 4, 3, "1"), m("suche", 19, 3, "2"), m("suche", 2.5, 12, "3"), m("suche", 21.5, 12, "4"), m("suche", 19, 18.5, "5"),
            m("ueberlebender", 4.5, 4.5, "F"), m("ueberlebender", 22, 13.5, "W"), m("ueberlebender", 20.5, 19.5, "J"), m("eiskeller", 7, 12, "E"),
            m("feind", 12, 1, "A"), m("feind", 1, 20, "B"), m("feind", 4.5, 7, "C", true), m("schmied", 19.5, 4.5, "S", true)] },
        teile: [
          { name: "Ankunft im Dorf", cue: "03-1 (neu)", ausloeser: "Spielbeginn, Start je nach Weg aus Map 2", sehen: "Dunkle Häuser rund um einen Platz mit einem Brunnen. Aus dem Brunnen steigt Dampf, obwohl die Nacht kalt ist. Ein Hammer schlägt, gleichmäßig, irgendwo rechts oben.", tisch: "Alle Häuser aufbauen, Türen markieren, Inneres verdeckt. Überlebenden-Plättchen verdeckt mischen: 2 Mensch, 1 Befallen.",
            aktionen: [["Zum Brunnen gehen", "Bretter, eine Kette, ein Schloss. Warme Luft. Man hört etwas atmen, ganz tief unten."], ["Dem Hämmern folgen", "Die Schmiede. Das Licht flackert im Takt."], ["An einer Tür lauschen (1 Aktion)", "Der Spielleiter sagt, ob drinnen jemand atmet, flüstert oder schweigt."]], weiter: "ein Held eine Tür öffnet oder den Brunnen berührt." },
          { name: "Die Häuser", cue: "03-2 (neu) beim ersten offenen Haus", ausloeser: "Erste Tür offen", sehen: "Je nach Haus, siehe Tabelle.",
            aktionen: [
              ["Gemeindehaus (Marker 1, verschlossen)", "Mit Heddas Kellerschlüssel leise. Drinnen eine Frau mit zwei Kindern: „Bitte keine Namen.“ Der Keller ist das Ziel des Nebenziels. Suchmarker: Dorfchronik – „Im Jahr des Sterns wurde der Brunnen geweiht.“"],
              ["Schmiede (Marker 2)", "Der Schmied hämmert auf einen leeren Amboss, Moos wächst aus den Handschuhen. Er hört erst auf, wenn ihn jemand berührt oder angreift – dann Kampf (Cue 03-3). Suchmarker: Zange und Brecheisen, öffnen den Brunnen leise."],
              ["Haus Harm (Marker 3)", "Die Familie sitzt am Abendbrottisch, drei Teller, Pilze im Brot. Sie stehen auf, wenn jemand näher als 3\" kommt. Suchmarker: Brief an den Sohn in der Stadt – ein Name, wer ihn laut liest, bekommt 1 Sporenpunkt."],
              ["Wirtshaus (Marker 4)", "Die Wirtin hinter dem Tresen, eine Armbrust auf die Tür gerichtet. Ein Überlebender. Suchmarker: Laterne (Sicht +6\") und Beutewurf."],
              ["Bäckerei (Marker 5)", "Der Ofen ist noch warm. Der Sohn des Bäckers versteckt sich im Mehl. Er fragt nach seinem Vater (der kniet in der Kapelle). Suchmarker: Beutewurf."],
            ], weiter: "die Helden zum Brunnen wollen." },
          { name: "Der Schmied", cue: "03-3 (neu), Battle Cue 1 (Trommeln)", ausloeser: "Jemand berührt oder greift den Schmied an, oder Lärm 6", sehen: "Er dreht sich um. Seine Augen sind zugewachsen, aber er findet euch trotzdem – er folgt dem Klang eurer Schritte.", tisch: "Schmied als Elite, startet in der Schmiede. Verhaltenswürfel wütend für alle.",
            aktionen: [["Still stehen bleiben (keine Bewegung im eigenen Zug)", "Der Schmied greift einen anderen Helden an, der sich bewegt hat, wenn es einen gibt."], ["Den Hammer wegschlagen (Angriff, eine 6 beim Treffen)", "Der Schmied kämpft nur noch mit A2."]], weiter: "der Schmied fällt oder die Helden am Brunnen sind." },
          { name: "Der Brunnen", cue: "03-4 (neu)", ausloeser: "Kette und Bretter sind weg", sehen: "Der Schacht ist tiefer als jeder Brunnen. Wurzeln wie Seile führen hinab. Unten ein schwaches, kaltes Licht, das nicht flackert.",
            aktionen: [["Mit Zange oder Brecheisen öffnen (1 Aktion)", "Leise."], ["Mit Gewalt öffnen (3 Aktionen mit 3+, auch von verschiedenen Helden)", "+2 Lärm, Atemzug-Leiste +1."], ["Einen Überlebenden fragen", "„Der Brunnen war kalt, vierzig Jahre lang. Hedda wollte nie, dass jemand hineinschaut.“"]],
            weiter: "ein Held hinabsteigt. Wer zurückbleibt, kommt nach – Map 4 beginnt unten." },
        ],
        aktionen: [],
        laerm: [["3", "Extra-Cue 03-X1 (neu): Türen der Häuser Harm und Schmiede gehen auf. 2 Sporenlinge je Feindzone."], ["6", "Extra-Cue 03-X2 (neu): Das ganze Dorf. Pro Runde 1 Befallener aus einem zufälligen Haus. Battle Cue 1."], ["Befallener Überlebender aufgedeckt", "Extra-Cue 03-X3 (neu): Er sagt deinen Namen. Der Held, der ihm am nächsten steht, bekommt 1 Sporenpunkt, der Überlebende wird Gegner."]],
        figuren: [{ name: "Die Wirtin", wer: "Breit, laut, hat seit drei Nächten nicht geschlafen. Hält die Armbrust, bis jemand Hedda erwähnt.",
          kern: ["„Die Harms haben am Sonntag noch gelacht. Am Montag nicht mehr.“", "„Der Schmied hört nicht auf. Drei Tage. Er hört einfach nicht auf.“", "„Wenn ihr zum Brunnen wollt: Hedda hat den Schlüssel nie hergegeben.“"],
          zusaetze: [["die Helden haben Hedda getroffen", "Sie senkt die Armbrust und kommt mit."], ["die Helden drohen", "Sie schießt einmal (A1, 12\") und verriegelt die Tür. Lärm +2."], ["die Helden fragen nach dem Stern", "„Meine Mutter sagte, er fiel ohne Geräusch. Sterne machen kein Geräusch, sagte sie, Steine schon.“"]],
          nichtWissen: "Was im Brunnen ist und wer befallen ist, solange es nicht zu sehen ist." }],
        spieler: { spezial: ["Nacht: Sicht höchstens 12\".", "Lärm-Leiste 0–6 wie in der Kapelle: Tür aufbrechen +2, Nahkampf +1, Fernkampf oder Zauber +2, ein Überlebender ruft einen Namen +1.", "Wer ist noch Mensch: Nicht jeder, der um Hilfe bittet, ist noch, wer er war. Einen Überlebenden genau ansehen kostet 1 Aktion und einen Qualitätstest.", "Überlebende flüstern Namen, wenn sie Angst haben. Bleibt bei ihnen."] },
        weiter: "Abstieg in den Brunnen. Weiter mit Map 4 – übertragen: gerettete Überlebende, Schmied besiegt oder nicht, Atemzug-Leiste.",
      },
      // ---------------------------------------------------------------- Map 4
      {
        nr: 4, empfohlen: "60x60", titel: "Unter dem Brunnen", ton: "Fantasy bekommt Risse, Sci-Fi taucht auf", stand: "spielbar im Reiter Spielen",
        einleitung: "Die Wurzeln tragen euch tiefer, als ein Brunnen sein dürfte. Dann wird der Fels glatt. Glatt wie Glas, und kalt.",
        hauptziel: "Überlebt 4 Runden, nachdem unten etwas erwacht – oder flieht durch den Schacht nach oben. Ein Sieg im Kampf ist nicht vorgesehen.",
        nebenziel: "Bringt ein Fundstück mit hinaus: die Erkennungsmarke, das Protokoll oder die Probe. Jedes wirkt in Map 5 anders.",
        spezial: [
          "Zwei Hälften: Erst nur die Wurzelgänge (untere Hälfte) aufbauen. Die Halle (obere Hälfte) erst, wenn ein Held die Metallwand erreicht.",
          "Enge: In den Wurzelgängen passen höchstens zwei Figuren nebeneinander. Fernkampf über 12\" nicht möglich.",
          "Das Erwachen: Wenn ein Held das blinkende Licht berührt, den dritten Suchmarker untersucht oder in der Halle schießt oder zaubert. Ab dann zählt der Spielleiter 4 Runden, Verhaltenswürfel wütend.",
          "Zu viele: Nach dem Erwachen kommen zu jedem Rundenende ½W6 Rüstungsmänner (W6 halbiert, aufgerundet) aus den Wandnischen (N), solange der Gelehrte steht. Fällt er, werden sie dumpf und es kommt keiner mehr.",
          "Der Verwundete: hinter dem rechten Werktisch atmet einer, lebendig, in großer Rüstung. Sein Trupp ist tot, ihr Auftrag war das brennende Herz. Nehmen die Helden ihn mit, kämpft er als Verbündeter (zählt nicht ins Budget) und kommt mit in Map 5. Er passt nicht in den Schacht.",
        ],
        belohnung: "Ein Fundstück für Map 5, 2 EP für das Überleben, 1 EP für das Fundstück. Wer durch den Schacht flieht, kommt im Dorf heraus und kann in Map 5 von oben einsteigen.",
        konsequenzen: [
          "Erkennungsmarke mitgenommen: Der Überlebende erkennt den Namen darauf, wenn er dabei ist, und erzählt mehr.",
          "Protokoll mitgenommen: Wer es liest (der Überlebende sofort, ein Held im Kampf mit W6 ab 4), kennt die Schwachstelle: DS +1 gegen die Adern und +1 beim Überladen.",
          "Probe mitgenommen: Der Überlebende will ein Stück für seine Leute. Mit der toten Probe aus dem zweiten Glastank lässt er sich täuschen.",
          "Kein Fundstück: Map 5 ohne Vorteil, Atemzug-Leiste +1.",
          "Der Schmied lebt noch (Map 3): Der Takt hallt bis hierher. Die Rüstungsmänner starten das Erwachen sofort mit der wütenden Tabelle.",
        ],
        hinweis: "Hier soll es kippen. Beschreibt das Metall erst, wenn es jemand berührt, und nennt nie Wörter wie Station oder Soldat – es sind „Rüstungsmänner“, so wie Hedda sie nannte. Die Rüstungsmänner sind absichtlich zu viele: mit dem Nachschub weit über den Heldenpunkten. Wer kämpft statt zu rennen, soll verlieren können, aber 4 Runden in guter Deckung sind schaffbar. Am Ende von Runde 4 erstarren alle und horchen nach oben. Dort endet die Map.",
        gegner: "Rüstungsmänner (Miniaturen: Rubric Marines) mit dem Gelehrten in der gehörnten Rüstung (Sorcerer). Vor dem Erwachen: Sporenlinge in den Wurzelgängen (2 je Feindzone).",
        karte: { tisch: "60x60", b: 24, t: 24, aufstellung: { x: 9, y: 21, w: 6, h: 3 },
          gelaende: [g("wurzeln", 6, 13, 1.5, 9, "Wurzelwand"), g("wurzeln", 16.5, 13, 1.5, 9, "Wurzelwand"), g("wurzeln", 0, 16, 5, 1.5, "Wurzelwand"), g("wurzeln", 19, 18, 5, 1.5, "Wurzelwand"),
            g("pilze", 10, 15, 2, 2, "Leuchtpilze"), g("metall", 0, 11, 9, 1.5, "Glatte Wand"), g("metall", 15, 11, 9, 1.5, "Glatte Wand"),
            g("labortisch", 3, 4, 4, 2, "Werktisch", true), g("labortisch", 16, 6, 4, 2, "Werktisch", true), g("tank", 10, 2, 3, 3, "Glastank", true), g("tank", 20, 1, 2.5, 2.5, "Glastank", true), g("sporenwolke", 9, 6, 5, 4, "Geflecht", true)],
          marker: [m("suche", 3, 19, "1"), m("suche", 21, 15, "2"), m("suche", 5, 5, "3", true), m("licht", 11.5, 1.2, "L", true), m("schacht", 22.5, 9.5, "↑", true), m("feind", 1, 14, "A"), m("feind", 23, 22, "B"),
            m("nische", 1, 2, "N", true), m("nische", 1, 8, "N", true), m("nische", 7, 0.8, "N", true), m("nische", 15, 0.8, "N", true), m("nische", 23, 4, "N", true), m("nische", 13, 9.5, "N", true),
            m("tank", 11.5, 3.5, "T1", true), m("tank", 21.25, 2.25, "T2", true), m("ueberlebender", 21, 8.6, "V", true)] },
        teile: [
          { name: "Die Wurzelgänge", cue: "04-1 (neu)", ausloeser: "Spielbeginn", sehen: "Wurzeln wie Taue, warme Luft von unten, Leuchtpilze in den Ritzen. Weiter vorn wird der Fels glatt.", tisch: "Nur die untere Hälfte bis zu den Metallwänden.",
            aktionen: [["Suchmarker 1", "Ein Stiefel mit fremder Sohle, ohne Naht, voller Moos."], ["Suchmarker 2", "Beutewurf, dazu Kratzspuren: jemand hat hier Striche gezählt, sehr viele."], ["Eine Metallwand berühren", "Kalt, glatt, ohne Fugen. Darunter summt etwas. Jetzt die Halle aufbauen (Cue 04-2)."]], weiter: "ein Held die Metallwand berührt oder durch die Lücke geht." },
          { name: "Die Halle", cue: "04-2 (neu)", ausloeser: "Halle aufgebaut", sehen: "Ein Raum aus glattem Metall, überwachsen mit Pilzgeflecht. Glasbehälter mit trübem Wasser. Tische mit Blättern in einer Schrift, die keiner lesen kann. Ganz hinten ein kleines Licht, das blinkt. Immer gleich. An den Wänden lehnen Gestalten in Rüstungen ohne Nähte.",
            aktionen: [["Suchmarker 3 (Labortisch)", "Das Protokoll (Fundstück). Untersuchen löst das Erwachen aus, wenn es der dritte Marker ist."], ["Glastank untersuchen", "Darin schwimmt etwas, das wie Moos aussieht und sich bewegt. Die Probe (Fundstück) mitnehmen: 1 Aktion, ein Held muss es tragen (−2\" Bewegung)."], ["Eine Gestalt an der Wand ansehen", "Unter dem Moos eine Marke an einer Kette, ein Name in fremder Schrift: die Erkennungsmarke (Fundstück). Die Gestalt atmet nicht – noch nicht."], ["Das blinkende Licht berühren", "Es hört auf zu blinken und leuchtet rot. Das Erwachen (Cue 04-3)."]], weiter: "das Erwachen ausgelöst ist." },
          { name: "Das Erwachen", cue: "04-3 (neu), dann Battle Cue (neu, metallischer Puls)", ausloeser: "Erwachen ausgelöst", sehen: "Die Gestalten an den Wänden heben die Köpfe. Moos reißt. Ihre Waffen klicken.", tisch: "Startwelle: Myzel-Soldaten im Wert von 100 % der Heldenpunkte an den Nischen. Runden zählen: 1 von 4.",
            aktionen: [["Zum Schacht rennen", "Der Schacht (↑) ist eng: pro Runde kann ein Held hinein, er braucht eine ganze Aktion mit 3+. Oben ist das Dorf."], ["Deckung suchen", "Hinter Labortisch und Glastank gilt Deckung. Ein Glastank, der getroffen wird (W6 bei 1), platzt: verseuchtes Feld 3\"."], ["Gegen die Soldaten kämpfen", "Möglich, aber es kommen mehr nach, und es gibt keine EP dafür: EP gibt es nur fürs Überleben und für das Fundstück."]], weiter: "Runde 4 zu Ende ist oder alle Helden im Schacht sind." },
          { name: "Der Cliffhanger", cue: "04-4 (neu), endet ohne „Ihr seid am Zug“ – hier ist Schluss für heute", ausloeser: "Ende Runde 4", sehen: "Alle Gestalten erstarren. Sie heben die Köpfe, alle gleichzeitig, und horchen nach oben. Von oben: ein Kreischen wie Metall auf Stein. Licht fällt durch den Schacht. Eine Stimme, verzerrt, in einer Sprache, die keiner kennt – und dann ein Wort, das jeder versteht: euer Dorf. „Moosgrab.“", tisch: "Spiel anhalten. Die Myzel-Soldaten bleiben stehen, wo sie sind: So beginnt Map 5." },
        ],
        aktionen: [],
        spieler: { hauptziel: "Findet heraus, was unter dem Brunnen ist, und kommt lebend wieder heraus.", nebenziel: "Nehmt etwas mit, das erklärt, was hier unten ist.", spezial: ["Enge: Zwischen den Wurzelwänden passen höchstens zwei Figuren nebeneinander. Fernkampf über 12\" nicht möglich.", "Was weiter hinten liegt, kommt erst auf den Tisch, wenn ihr dort seid."], belohnung: "Was ihr mitnehmt, hilft euch später. 2 EP, wenn ihr lebend herauskommt." },
        weiter: "Weiter mit Map 5. Übertragen: Fundstücke, wer im Schacht ist, Atemzug-Leiste.",
      },
      // ---------------------------------------------------------------- Map 5
      {
        nr: 5, empfohlen: "120x80", titel: "Das Herz von Moosgrab", ton: "Finale am brennenden Herz", stand: "spielbar im Reiter Spielen",
        einleitung: "Die Wand bricht auf. Dahinter, tiefer im Fels, schlägt etwas: ein Klumpen aus Wurzeln, Fleisch und Metall, und mitten darin brennt es weiß. Das Herz ist um die Glut gewachsen.",
        hauptziel: "Fällt den Rufer, durchtrennt die drei Adern, überladet die Glut und entkommt durch den Schacht, bevor sie bricht.",
        nebenziel: "Entscheidet, was in die Glut geht: alles, ein Stück für euch, ein Stück für den Überlebenden, oder ihr schiebt ihm die tote Probe unter.",
        spezial: [
          "Eine Stufe härter: Das Finale rechnet seine Gegnerpunkte eine Schwierigkeitsstufe über der gewählten (auf Normal wie Schwer). Davor gibt es im Schacht die einzige Rast der Map (alle Wunden und Power zurück, Atemzug +1).",
          "Der Boss: der Rufer (Sorcerer, 175 P.). Solange er steht, hält sein Zauber die Klappe zu, und die Glut lässt sich nicht überladen. Fällt er, gehen die leeren Rüstungen ruhig.",
          "Der Überlebende (nur wenn er Map 4 lebend verlassen hat): ein einzelner Krieger in großer Rüstung, 145 P., verwundet noch rund 100 P. wert. Verbündeter, zählt nicht ins Punktebudget. Ein Spieler führt ihn zusätzlich. Er überlädt die Glut leichter.",
          "Wer hält die Glut: Lebt der Überlebende, bleibt er an der Klappe und gibt den Helden sechs Runden (oder ein Held bleibt an seiner Stelle). Ohne ihn bleibt ein Held, oder sie zünden die kurze Lunte: alle dürfen rennen, aber nur vier Runden.",
          "Umkehren: Beim Durchbruch können die Helden kehrtmachen, ohne zu kämpfen. Das ist das Bad Ending („Es schlägt weiter“); ist der Überlebende dabei, geht er allein hinein.",
          "Die Flucht: kein Nachschub mehr, dafür kriecht der Glutleib aus der Glut (ein großes Modell, 190 P.), eine Kartenbreite je Runde auf den nächsten Helden zu: langsamer als die Helden.",
          "Die Adern (A): je Verteidigung 4+, Zäh 4. Sind alle drei durchtrennt, liegt die Glutkammer offen. Mit dem Protokoll aus Map 4 DS +1 gegen die Adern.",
          "Überladen (erst nach dem Rufer): ein Held im Kontakt mit dem Herz, eine Aktion, W6 ab 5 (der Überlebende ab 3, mit Protokoll +1). Ab der Flucht zählt die Glut einen Strich je Rundenende, bei 6 bricht sie.",
          "Ausatmen: Bis zum Überladen atmet das Herz an jedem Rundenende (W6 kleiner oder gleich der Atemzug-Leiste). Die App zeigt es nach R von selbst.",
          "Nachschub bis zum Überladen: leere Rüstungen aus der Wand, Sporenlinge nach der Atemzug-Leiste (je höchstens etwa drei Mal), Befallene aus dem Schacht, wenn in Map 3 einer im Keller war.",
        ],
        belohnung: "Ende der Kampagne. Jeder Held 3 EP, wer die Glut überlädt 1 EP mehr. Lebt der Überlebende, lässt er den Helden etwas aus seiner Welt da.",
        konsequenzen: [
          "Epilog A, entkommen: niemand musste bleiben (kurze Lunte), und alle sind draußen, bevor die Glut bricht.",
          "Epilog B, knapp: der Letzte kommt mit verbrannten Fersen hinaus.",
          "Epilog C, jemand bleibt zurück: der Überlebende oder ein Held hält die Glut, oder einer schafft es nicht.",
          "Epilog „Es schlägt weiter“ (das Bad Ending): die Helden kehren vor dem Herz um, oder alle fallen oder fliehen, bevor die Glut überladen ist.",
        ],
        hinweis: "Das Ziel ist das Herz, nicht jeder Gegner. Haltet die Runden schnell. Die Entscheidung über die Probe fällt zwischen Überladen und Flucht, in einem Atemzug, nicht in Ruhe. Spielertexte nennen die Anlage nie beim Namen: es ist „die Glut“.",
        gegner: "Der Rufer als Boss (Sorcerer), leere Rüstungen (Rubric Marines), Sporenlinge nach der Atemzug-Leiste, Befallene aus dem Gemeindehaus, auf der Flucht der Glutleib (das größte Monster, das du hast).",
        karte: { tisch: "90x60", b: 36, t: 24, aufstellung: { x: 4, y: 20, w: 12, h: 4 },
          gelaende: [g("sporenwolke", 15, 1, 8, 6, "Herzkammer mit der Glut (verseucht)"), g("wurzeln", 9, 3, 1.5, 7, "Wurzelwand"), g("wurzeln", 27, 3, 1.5, 7, "Wurzelwand"), g("metall", 0, 11, 10, 1.5, "Glatte Wand"),
            g("labortisch", 4, 6, 4, 2, "Werktisch"), g("tank", 30, 13, 3, 3, "Glastank"), g("ruine", 22, 14, 5, 4, "Trümmer"), g("pilze", 12, 13, 2, 2, "Pilze"), g("pilze", 31, 5, 2, 2, "Pilze")],
          marker: [m("herz", 19, 3.5, "♥"), m("ader", 12, 10, "A"), m("ader", 19, 10, "A"), m("ader", 26, 10, "A"), m("truemmer", 24.5, 19, "M"), m("schacht", 34.5, 21, "↑"),
            m("feind", 1, 2, "A"), m("feind", 35, 2, "B"), m("feind", 1, 16, "C")] },
        teile: [
          { name: "Der Durchbruch", cue: "05-1 (neu)", ausloeser: "Spielbeginn, direkt nach dem Cliffhanger", sehen: "Die Wand bricht auf. Hinter dem Staub schlägt etwas, langsam, wie ein Herz. Zwischen euch und ihm stehen zwei leere Rüstungen, und einer in Hörnern, der die Hände hebt.", tisch: "Helden in der Aufstellung, der Überlebende (falls dabei) bei den Trümmern (M). Rufer und zwei Rüstungen erstarrt vor dem Herz.",
            aktionen: [["Erst hinsehen", "Herz, Adern und Schacht ansehen, mit dem Überlebenden reden: er erzählt, was sein Trupp hier wollte."], ["Sofort angreifen", "Das Herz schlägt schneller: am Ende von Runde 1 atmet es sicher aus."]], weiter: "Runde 1 beginnt (Battle Cue)." },
          { name: "Das brennende Herz", cue: "Battle Cue (neu, Puls und Chor)", ausloeser: "Runde 1", sehen: "Ein Klumpen aus Wurzeln, Fleisch und Metall, so groß wie ein Wagen. Drei Stränge führen hinein. Dahinter brennt es weiß.",
            aktionen: [["Eine Ader durchtrennen", "Die App zählt mit. Bei drei liegt die Glutkammer offen."], ["Die Glut überladen", "Ein Held W6 ab 5, der Überlebende ab 3. Dann zählt die Glut."], ["Einen Feuertopf an eine Ader", "+1 Treffer, wenn er trifft."]], weiter: "die Glut überladen ist (Cue 05-2) oder kein Held mehr am Herz steht." },
          { name: "Was in die Glut geht, und die Flucht", cue: "05-2 (neu), dann Epilog-Cue A, B oder C", ausloeser: "Glut überladen", sehen: "Die Klappe glüht weiß. Der Fels wird heiß. Oben, sehr weit weg, ein Kreis aus Tageslicht.",
            aktionen: [["Alles vernichten", "Nichts verlässt Moosgrab."], ["Ein Stück mitnehmen", "Für die Helden, mit Folgen."], ["Es dem Überlebenden geben", "Er will es für seine Leute."], ["Die tote Probe unterschieben", "Qualitätstest: merkt er es?"], ["Den Schacht hinauf", "Je Runde ein Strich Glut, höchstens zwei Figuren je Runde in den Schacht."]], weiter: "alle oben sind oder die Glut bricht. Die App wählt den Epilog." },
        ],
        aktionen: [],
        figuren: [{ name: "Der Anführer der Fremden", wer: "Um die 40, Narbe über dem Auge, müde. Spricht ruhig, stellt kurze Fragen. Sein Vater war bei denen, die nicht zurückkamen.",
          kern: ["„Wir sind wegen dem da gekommen.“", "„Das hier ist nicht von euch, und nicht von uns. Es hätte nie hier sein sollen.“", "„Nur ein Stück. Wir müssen wissen, was das war.“"],
          zusaetze: [["die Helden zeigen die Erkennungsmarke", "„Das war mein Vater.“ Er erzählt vom Absturz vor vierzig Jahren – ohne Fachwörter."], ["die Helden verweigern die Probe", "„Dann hoffe ich, dass ihr recht habt.“"]],
          nichtWissen: "Wer das Geflecht gebaut hat. Er weiß nur, dass seine Leute es gesucht haben." }],
        spieler: { nebenziel: "Am Ende müsst ihr eine Entscheidung treffen. Sie gehört euch.", belohnung: "Das Ende der Kampagne." },
        weiter: "Ende der Kampagne. Epilog nach Entscheidung.",
      },
    ],
  };

  const Szenarien = {
    TISCHE, tischVon, ARTEN, GELAENDE, gelaendeText, SCHAUPLAETZE, ZIELE, NEBENZIELE, KOMPLIKATIONEN, SCHWIERIGKEIT, BEUTE, ALARM_MAX,
    MOOSGRAB, KAMPAGNEN: [MOOSGRAB], erzeuge, details, wellenPunkte, baueKarte, skaliereKarte, rng,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Szenarien;
  else root.Szenarien = Szenarien;
})(typeof globalThis !== "undefined" ? globalThis : this);

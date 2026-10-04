/* Kartenschmiede – Katalog: Tags, Fraktionen und der Standardbestand der Datenbank.
   Einträge haben einen Typ: faehigkeit, zauber, gegenstand, waffe oder fraktion.
   Kosten:
     kosten.typ "fest"    → Punkte obendrauf (Skills, Auren, Zauber, Gegenstände); Stufen nach Chris' „Punktelogiken“:
                            klein 5 · mittel 10 · groß 15 · elite 20
     kosten.typ "prozent" → Aufschlag auf die Formel (Sonderregeln der Gegner, wachsen mit der Einheit):
                            klein 5 · mittel 10 · groß 20 · elite 30
   Waffen haben keine festen Kosten: Sie landen als Waffenzeile auf der Karte und die Formel rechnet sie mit.
   Regeltexte nutzen Symbole in geschweiften Klammern ({P1} Power, {A2} Treffer, {V+1} Verteidigung …),
   die Liste steht in app.js (SYMBOLTEXT) und im Reiter „Regeln“.
   Eigene Einträge kommen über die Seite dazu und liegen auf dem Server (kartenschmiede/_faehigkeiten.json). */
(function (root) {
  "use strict";
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dieselbe Datei läuft im Browser ohne Module
  const Regeln = typeof module !== "undefined" && module.exports ? require("./regeln.js") : root.Regeln;

  // Tags: kurze Schlagworte mit Symbol, damit man auf der Karte nichts ausschreiben muss und filtern kann
  const TAGS = [
    { id: "nahkampf", name: "Nahkampf", icon: "sword", farbe: "#d9534f" },
    { id: "fernkampf", name: "Fernkampf", icon: "target", farbe: "#c2a878" },
    { id: "flaeche", name: "Fläche", icon: "burst", farbe: "#f0883e" },
    { id: "betaeubung", name: "Betäubung", icon: "spiral", farbe: "#9fb4ff" },
    { id: "aura", name: "Aura", icon: "rings", farbe: "#7fd6c2" },
    { id: "heilung", name: "Heilung", icon: "heart", farbe: "#ff8fb1" },
    { id: "schutz", name: "Schutz", icon: "shield", farbe: "#8fa9c4" },
    { id: "staerkung", name: "Stärkung", icon: "up", farbe: "#f4b860" },
    { id: "schwaechung", name: "Schwächung", icon: "down", farbe: "#9a86b8" },
    { id: "bewegung", name: "Bewegung", icon: "wing", farbe: "#9ad0f5" },
    { id: "furcht", name: "Furcht", icon: "skull", farbe: "#8b909b" },
    { id: "gift", name: "Gift", icon: "drop" },
    { id: "feuer", name: "Feuer", icon: "flame" },
    { id: "frost", name: "Frost", icon: "snow" },
    { id: "magie", name: "Magie", icon: "rune" },
    { id: "beschwoerung", name: "Beschwörung", icon: "portal", farbe: "#b98cff" },
    { id: "reaktion", name: "Reaktion", icon: "bolt", farbe: "#ffd166" },
    { id: "tarnung", name: "Tarnung", icon: "eye", farbe: "#6f9c88" },
    { id: "einmalig", name: "Einmalig", icon: "potion", farbe: "#d4a373" },
    { id: "technik", name: "Sci-Fi", icon: "cog" },
    { id: "licht", name: "Licht", icon: "sun" },
    { id: "schatten", name: "Schatten", icon: "moon" },
    { id: "natur", name: "Natur", icon: "leaf" },
  ];
  // Jeder Tag ist ein farbiges Abzeichen. Elemente (rund) holen Farbe aus regeln.js, die übrigen Tags (eckig) haben ihre eigene.
  for (const t of TAGS) { const e = Regeln.ELEMENT[t.id]; if (e) { t.farbe = e.farbe; t.element = true; } }

  // Prägung einer Einheit: was sie ihrem Wesen nach ist (ein Feuerelementar ist „Feuer“). Einträge mit dem
  // Gegenteil sind für sie gesperrt – ein Feuerelementar lernt keine Frostzauber. 
  // Die Paare selbst stehen bei den Elementen in regeln.js: Feuer ↔ Frost, Natur ↔ Gift, Licht ↔ Schatten, Magie ↔ Sci-Fi.
  const PRAEGUNGEN = Regeln.ELEMENTE.map(e => e.id);
  const GEGENSAETZE = Regeln.ELEMENTE.filter((e, i, a) => a.findIndex(x => x.id === e.gegen) > i).map(e => [e.id, e.gegen]);
  const gegenteilVon = tag => Regeln.ELEMENT[tag] ? [Regeln.ELEMENT[tag].gegen] : [];
  // Liefert den ersten Widerspruch zwischen Eintrag und Prägung, sonst null
  function konflikt(eintrag, praegung) {
    for (const p of Array.isArray(praegung) ? praegung : []) {
      const gegen = gegenteilVon(p).find(g => (eintrag.tags || []).includes(g));
      if (gegen) return { praegung: p, tag: gegen };
    }
    return null;
  }

  // Fraktionen: Name und Symbol gehören fest zusammen
  const fr = (id, name, icon, text, praegung = []) => ({ id, typ: "fraktion", name, icon, text, praegung, tags: [], fuer: ["hero", "companion", "enemy"], kosten: { typ: "fest", wert: 0 }, quelle: "Standard" });
  const FRAKTIONEN = [
    fr("helden", "Helden", "sun", "Die Gruppe der Spieler, egal welchen Volkes."),
    fr("menschen", "Menschen", "shield", "Königreiche, Söldner und Ritterorden."),
    fr("elfen", "Elfen", "leaf", "Waldvölker, Bogenschützen und alte Magie.", ["natur"]),
    fr("dunkelelfen", "Dunkelelfen", "eye", "Korsaren, Hexen und Schattenklingen."),
    fr("zwerge", "Zwerge", "hammer", "Bergfesten, Runenschmiede und Maschinen."),
    fr("orks", "Orks", "axe", "Kriegsbanden, Rohe Kraft und Blechpanzer."),
    fr("untote", "Untote", "skull", "Skelette, Geister und Nekromanten.", ["schatten"]),
    fr("daemonen", "Dämonen", "flame", "Beschworene Wesen aus Kristall und Feuer.", ["feuer"]),
    fr("urwild", "Urwild", "paw", "Parasiten, Pilzwesen und Bestien der Wildnis.", ["gift"]),
    fr("saurier", "Saurier", "fang", "Echsenkrieger und urzeitliche Riesen."),
    fr("wilde-jagd", "Wilde Jagd", "moon", "Werwölfe und Jäger, die mit dem Mond kommen."),
    fr("frostvolk", "Frostvolk", "snow", "Eisriesen und Wanderer des ewigen Winters.", ["frost"]),
  ];

  const f = (id, typ, name, art, fuer, tags, kostenTyp, wert, text, quelle = "Quest") =>
    ({ id, typ, name, art, fuer, tags, kosten: { typ: kostenTyp, wert }, text, quelle });
  const w = (id, name, zeile, tags, text, quelle = "Standard") => ({ id, typ: "waffe", name, art: /Nahkampf/.test(zeile) ? "Nahkampf" : "Fernkampf",
    fuer: ["hero", "companion", "enemy"], tags, waffe: zeile, kosten: { typ: "fest", wert: 0 }, text, quelle });
  const HELD = ["hero"], ALLE = ["hero", "companion", "enemy"], GEGNER = ["enemy", "companion"], FREUNDE = ["hero", "companion"];

  const GRUNDBESTAND = [
    // Skills der Quest-Helden (Blatt „Abilities“ in Chris' Tabelle). Probe auf den Wert des Skills, bei Fehlschlag 1 Power.
    f("schattenschritt", "faehigkeit", "Schattenschritt", "Skill", HELD, ["bewegung", "tarnung", "schatten"], "fest", 10, "{P1} {B4}. Endet die Bewegung in Deckung oder außer Sicht: {V+1} gegen Beschuss bis zur nächsten Aktivierung."),
    f("schwachstelle", "faehigkeit", "Schwachstelle", "Skill", HELD, ["nahkampf", "staerkung"], "fest", 10, "{P1} Feind {R1}: eigene Nahkampfangriffe gegen ihn {DS1} für diese Aktivierung."),
    f("wunden-heilen", "faehigkeit", "Wunden heilen", "Skill", HELD, ["heilung", "licht"], "fest", 15, "{P1} Verbündeter {R6}: {HW3}."),
    f("strahlender-schutz", "faehigkeit", "Strahlender Schutz", "Skill", HELD, ["schutz", "licht"], "fest", 10, "{P1} Verbündeter {R6}: {V+1} gegen den nächsten Angriff."),
    f("beute-markieren", "faehigkeit", "Beute markieren", "Skill", HELD, ["fernkampf", "staerkung"], "fest", 10, "{P1} Sichtbarer Feind {R18}: der nächste verbündete Angriff gegen ihn {T+1}."),
    f("schlingenfalle", "faehigkeit", "Schlingenfalle", "Skill", HELD, ["betaeubung"], "fest", 5, "{P1} Falle {R3} legen. Der erste Feind, der sich in 1\" bewegt: {A1}, bei {D4} {X}."),
    f("reihe-halten", "faehigkeit", "Die Reihe halten", "Skill", HELD, ["schutz", "aura"], "fest", 10, "{P1} Bis zur nächsten Aktivierung: Feinde {F3} {T-1} gegen andere Verbündete."),
    f("schildstoss", "faehigkeit", "Schildstoß", "Skill", HELD, ["nahkampf", "bewegung"], "fest", 5, "{P1} Feind {R1}: {A1}. Bei bestandener STR-Probe 2\" zurückstoßen."),

    // Auren (Anführer, aus den OPR-Upgrades in Chris' Tabelle)
    f("aura-reissend", "faehigkeit", "Aura der Klingen", "Aura", ALLE, ["aura", "nahkampf", "staerkung"], "fest", 15, "Verbündete {F6}: Reißend im Nahkampf."),
    f("aura-hinterhalt", "faehigkeit", "Pfadfinder", "Aura", ALLE, ["aura", "bewegung"], "fest", 10, "Verbündete dürfen {R6} von diesem Modell aus dem Hinterhalt kommen."),
    f("aura-sturm", "faehigkeit", "Sturmruf", "Aura", ALLE, ["aura", "bewegung"], "fest", 5, "Verbündete {F6}: {B+2} beim Angreifen."),

    // Sonderregeln von Chris' eigenen Gegnern (Blatt „Selfmade“)
    f("kristallsplitter", "faehigkeit", "Kristallsplitter", "Sonderregel", GEGNER, ["reaktion"], "prozent", 5, "Erleidet es eine Wunde: Angreifer bei {D6} {W1}.", "Selfmade"),
    f("saeureblut", "faehigkeit", "Säureblut", "Sonderregel", GEGNER, ["reaktion", "gift"], "prozent", 5, "Erleidet es eine Wunde: Angreifer bei {D5} {A1}.", "Selfmade"),
    f("strahlende-aura", "faehigkeit", "Strahlende Aura", "Sonderregel", GEGNER, ["aura", "flaeche", "licht"], "prozent", 20, "Rundenende: Feinde {F6} je {A1} {DS1}.", "Selfmade"),
    f("gebrochene-ketten", "faehigkeit", "Gebrochene Ketten", "Sonderregel", GEGNER, ["einmalig", "staerkung"], "prozent", 10, "{S} Fällt es unter die Hälfte seiner Lebenspunkte: sofort eine weitere Aktivierung.", "Selfmade"),
    f("sporenwolke", "faehigkeit", "Sporenwolke", "Sonderregel", GEGNER, ["gift", "flaeche", "reaktion"], "prozent", 10, "Stirbt es: alle Einheiten {F3} je {A1} mit Gift.", "Vorschlag"),
    f("blutrausch", "faehigkeit", "Blutrausch", "Sonderregel", GEGNER, ["nahkampf", "staerkung"], "prozent", 10, "Ab halben Lebenspunkten: jede Nahkampfwaffe {A+1}.", "Vorschlag"),
    f("brut", "faehigkeit", "Brut", "Sonderregel", GEGNER, ["beschwoerung"], "prozent", 20, "Rundenende, bei {D5}: eine Giftmade (oder eine andere gewöhnliche Einheit der Fraktion) {R3} aufstellen.", "Vorschlag"),
    f("schreckensschrei", "faehigkeit", "Schreckensschrei", "Sonderregel", GEGNER, ["furcht", "flaeche", "einmalig"], "prozent", 10, "{S} Alle Helden {F9}: sofort Moralprobe.", "Vorschlag"),
    f("phasenschritt", "faehigkeit", "Phasenschritt", "Sonderregel", ALLE, ["bewegung", "reaktion"], "prozent", 10, "{RU} Nach einem Angriff gegen es: bei {D4} {B3} in beliebige Richtung.", "Vorschlag"),

    // Zauber: nur für Modelle mit Zauberer(X). Wurf auf den angegebenen Wert, bei Fehlschlag verpufft der Zauber.
    { ...f("feuerball", "zauber", "Feuerball", "Zauber", ALLE, ["feuer", "flaeche", "fernkampf", "magie"], "fest", 15, "{Z4} Punkt {R18}: alle Einheiten {F3} {AW3}."), energie: 2 },
    f("frostlanze", "zauber", "Frostlanze", "Zauber", ALLE, ["frost", "fernkampf", "schwaechung", "magie"], "fest", 10, "{Z4} Feind {R12}: {A2} {DS1}, bis zur nächsten Aktivierung halbe Bewegung."),
    f("heilendes-licht", "zauber", "Heilendes Licht", "Zauber", FREUNDE, ["heilung", "magie", "licht"], "fest", 10, "{Z4} Verbündeter {R12}: {HW3}."),
    f("schutzkreis", "zauber", "Schutzkreis", "Zauber", ALLE, ["schutz", "aura", "magie", "licht"], "fest", 15, "{Z5} Verbündete {F6}: {V+1} bis zur nächsten Runde."),
    f("laehmungsfluch", "zauber", "Lähmungsfluch", "Zauber", ALLE, ["betaeubung", "magie", "schatten"], "fest", 15, "{Z5} Feind {R12}: {X}."),
    f("geistwolf", "zauber", "Geistwolf", "Zauber", ALLE, ["beschwoerung", "magie"], "fest", 20, "{Z5} Geistwolf {R3} aufstellen (Q4+ V5+ Zäh 3, A2 Nahkampf), bleibt bis Spielende."),

    // Gegenstände: Tränke und Bomben aus dem Quest-Kampagnenbuch (Wirkung hier als Vorschlag), dazu Ausrüstung
    f("heiltrank", "gegenstand", "Heiltrank", "Trank", FREUNDE, ["heilung", "einmalig"], "fest", 5, "{S} Freie Aktion: {HW3+1}.", "Quest-Kampagne"),
    f("heldenelixier", "gegenstand", "Heldenelixier", "Trank", FREUNDE, ["staerkung", "einmalig"], "fest", 5, "{S} Bis Rundenende {T+1} und +1 auf Proben.", "Quest-Kampagne"),
    f("kraftelixier", "gegenstand", "Kraftelixier", "Trank", HELD, ["magie", "einmalig"], "fest", 5, "{S} Sofort {P+3}.", "Quest-Kampagne"),
    f("teleporttrank", "gegenstand", "Teleporttrank", "Trank", FREUNDE, ["bewegung", "einmalig"], "fest", 5, "{S} {B12} versetzen, auch aus dem Nahkampf.", "Quest-Kampagne"),
    f("betaeubungsbombe", "gegenstand", "Betäubungsbombe", "Bombe", FREUNDE, ["betaeubung", "flaeche", "einmalig"], "fest", 10, "{S} Punkt {R9}: alle Einheiten {F3} bei {D4} {X}.", "Quest-Kampagne"),
    f("runenschild", "gegenstand", "Runenschild", "Ausrüstung", FREUNDE, ["schutz"], "fest", 10, "{V+1} gegen Beschuss."),
    f("sprungstiefel", "gegenstand", "Sprungstiefel", "Ausrüstung", FREUNDE, ["bewegung"], "fest", 5, "{B+2} beim Bewegen und Angreifen."),

    // Waffen: landen als Zeile auf der Karte, die Formel rechnet sie wie jede andere Waffe
    w("frostklauen", "Frostklauen", "Frostklauen | Nahkampf | A4 | Reißend, Frost", ["nahkampf", "frost"], "Klauen, die Rüstung wie Eis zerschneiden."),
    w("runenaxt", "Runenaxt", "Runenaxt | Nahkampf | A3 | DS(2), Magie", ["nahkampf", "magie"], "Schwer, langsam, und keine Rüstung hält stand."),
    w("giftspeichel", "Giftspeichel", "Giftspeichel | 12\" | A3 | Gift", ["fernkampf", "gift"], "Ätzender Strahl aus dem Rachen."),
    w("splitterwerfer", "Splitterwerfer", "Splitterwerfer | 18\" | A2 | DS(1), Explosion(3)", ["fernkampf", "flaeche"], "Schleudert Kristallsplitter, die beim Aufprall zerbersten."),
    w("jagdbogen", "Jagdbogen", "Jagdbogen | 24\" | A2 |", ["fernkampf"], "Langer Bogen der Waldläufer."),

    // ---------- Fantasy-Erweiterung (angelehnt an die Waffen und Sonderregeln aus Age of Fantasy) ----------
    w("langschwert", "Langschwert", "Langschwert | Nahkampf | A2 |", ["nahkampf"], "Die Waffe jedes Ritters und Söldners.", "Fantasy"),
    w("zweihaender", "Zweihänder", "Zweihänder | Nahkampf | A3 | DS(1)", ["nahkampf"], "Langsam gezogen, schnell bereut.", "Fantasy"),
    w("kriegshammer", "Kriegshammer", "Kriegshammer | Nahkampf | A2 | DS(2)", ["nahkampf"], "Zertrümmert Plattenpanzer samt Inhalt.", "Fantasy"),
    w("lanze", "Lanze", "Lanze | Nahkampf | A2 | Stoß", ["nahkampf", "bewegung"], "Entfaltet ihre Wucht erst im Ansturm.", "Fantasy"),
    w("zwillingsdolche", "Zwillingsdolche", "Zwillingsdolche | Nahkampf | A4 |", ["nahkampf", "tarnung"], "Schnelle Stiche aus dem Schatten.", "Fantasy"),
    w("flammenklinge", "Flammenklinge", "Flammenklinge | Nahkampf | A2 | DS(1), Reißend, Feuer", ["nahkampf", "feuer", "magie"], "Eine Runenklinge, die in der Scheide glimmt.", "Fantasy"),
    w("seelensense", "Seelensense", "Seelensense | Nahkampf | A2 | Tödlich(3), Schatten", ["nahkampf", "furcht", "schatten"], "Wen sie streift, dem folgt die Seele nach.", "Fantasy"),
    w("dornenpeitsche", "Dornenpeitsche", "Dornenpeitsche | Nahkampf | A4 | Zerfleischen", ["nahkampf", "gift"], "Reißt Wunden, die nicht heilen wollen.", "Fantasy"),
    w("armbrust", "Armbrust", "Armbrust | 24\" | A1 | DS(1)", ["fernkampf"], "Durchschlägt ein Kettenhemd auf zwanzig Schritt.", "Fantasy"),
    w("elfenbogen", "Elfenbogen", "Elfenbogen | 30\" | A1 | Präzise, Natur", ["fernkampf", "natur"], "Aus Silberholz, trifft, wohin der Blick fällt.", "Fantasy"),
    w("wurfaexte", "Wurfäxte", "Wurfäxte | 6\" | A2 |", ["fernkampf", "nahkampf"], "Erst geworfen, dann nachgesetzt.", "Fantasy"),
    w("wurfspeer", "Wurfspeer", "Wurfspeer | 12\" | A1 | DS(1)", ["fernkampf"], "Leicht, schnell und tödlich genau.", "Fantasy"),
    w("blitzstab", "Blitzstab", "Blitzstab | 18\" | A2 | DS(1), Magie", ["fernkampf", "magie"], "Ein Stab, der nach Gewitter riecht.", "Fantasy"),
    w("drachenatem", "Drachenatem", "Drachenatem | 12\" | A1 | Explosion(6), Zuverlässig, Feuer", ["fernkampf", "feuer", "flaeche"], "Ein Feuerstoß, dem niemand ausweicht.", "Fantasy"),
    w("steinschleuder", "Steinschleuder", "Steinschleuder | 36\" | A1 | DS(1), Explosion(3), Indirekt", ["fernkampf", "flaeche"], "Belagerungswaffe, feuert über Mauern hinweg.", "Fantasy"),

    // ---------- Sci-Fi-Erweiterung (angelehnt an die Waffen aus Grimdark Future) ----------
    w("laserpistole", "Laserpistole", "Laserpistole | 12\" | A1 | Energie", ["fernkampf", "technik"], "Handlich, zuverlässig, überall zu haben.", "Sci-Fi"),
    w("lasergewehr", "Lasergewehr", "Lasergewehr | 24\" | A1 | Energie", ["fernkampf", "technik"], "Standardwaffe jeder Söldnertruppe.", "Sci-Fi"),
    w("sturmgewehr", "Sturmgewehr", "Sturmgewehr | 24\" | A3 |", ["fernkampf", "technik"], "Viel Blei, wenig Feinheit.", "Sci-Fi"),
    w("pulsgewehr", "Pulsgewehr", "Pulsgewehr | 30\" | A1 | DS(1), Energie", ["fernkampf", "technik"], "Verschießt gebündelte Energiepakete.", "Sci-Fi"),
    w("plasmagewehr", "Plasmagewehr", "Plasmagewehr | 24\" | A1 | DS(3), Überhitzen, Energie", ["fernkampf", "feuer", "technik"], "Schmilzt Panzerung – und manchmal den Schützen.", "Sci-Fi"),
    w("flammenwerfer", "Flammenwerfer", "Flammenwerfer | 9\" | A1 | Explosion(3), Zuverlässig, Feuer", ["fernkampf", "feuer", "flaeche", "technik"], "Räumt Gräben und Gänge.", "Sci-Fi"),
    w("kryowerfer", "Kryowerfer", "Kryowerfer | 12\" | A2 | DS(1), Frost", ["fernkampf", "frost", "technik"], "Friert Gelenke und Servos ein.", "Sci-Fi"),
    w("granatwerfer", "Granatwerfer", "Granatwerfer | 24\" | A1 | Explosion(3), Indirekt", ["fernkampf", "flaeche", "technik"], "Hinter der Deckung ist man nicht sicher.", "Sci-Fi"),
    w("raketenwerfer", "Raketenwerfer", "Raketenwerfer | 30\" | A1 | DS(2), Explosion(3), Zielsuchend", ["fernkampf", "flaeche", "technik"], "Findet sein Ziel auch hinter Rauch.", "Sci-Fi"),
    w("scharfschuetzengewehr", "Scharfschützengewehr", "Scharfschützengewehr | 36\" | A1 | DS(1), Präzise", ["fernkampf", "tarnung", "technik"], "Ein Schuss, ein Name weniger.", "Sci-Fi"),
    w("schienenkanone", "Schienenkanone", "Schienenkanone | 36\" | A1 | DS(4), Tödlich(3)", ["fernkampf", "technik"], "Magnetisch beschleunigter Bolzen, der Panzer knackt.", "Sci-Fi"),
    w("kettenschwert", "Kettenschwert", "Kettenschwert | Nahkampf | A3 | Reißend", ["nahkampf", "technik"], "Kreischende Zähne aus Stahl.", "Sci-Fi"),
    w("energieschwert", "Energieschwert", "Energieschwert | Nahkampf | A2 | DS(2), Energie", ["nahkampf", "technik"], "Ein Feld aus Energie schneidet durch jede Rüstung.", "Sci-Fi"),
    w("energiefaust", "Energiefaust", "Energiefaust | Nahkampf | A2 | DS(4), Energie", ["nahkampf", "technik"], "Langsam, aber was sie trifft, bleibt liegen.", "Sci-Fi"),
    w("monoklinge", "Monomolekularklinge", "Monomolekularklinge | Nahkampf | A2 | Zersetzen", ["nahkampf", "technik"], "Eine Schneide, dünner als ein Atom.", "Sci-Fi"),
    w("schockstab", "Schockstab", "Schockstab | Nahkampf | A2 | Stoß", ["nahkampf", "betaeubung", "technik"], "Elektrischer Schlag, der Muskeln lähmt.", "Sci-Fi"),

    // Fähigkeiten der Helden: Fantasy
    f("wirbelwind", "faehigkeit", "Wirbelwind", "Skill", HELD, ["nahkampf", "flaeche"], "fest", 15, "{P1} Jeder Feind {F1}: {A1} {DS1}.", "Fantasy"),
    f("schlachtruf", "faehigkeit", "Schlachtruf", "Skill", HELD, ["aura", "staerkung", "nahkampf"], "fest", 10, "{P1} Verbündete {F6}: Nahkampf {T+1} bis Rundenende.", "Fantasy"),
    f("gezielter-schuss", "faehigkeit", "Gezielter Schuss", "Skill", HELD, ["fernkampf", "staerkung"], "fest", 10, "{P1} Nächster Fernkampfangriff: Präzise und {DS+1}.", "Fantasy"),
    f("ausweichrolle", "faehigkeit", "Ausweichrolle", "Skill", HELD, ["bewegung", "reaktion"], "fest", 5, "{P1} Reaktion auf einen Nahkampfangriff: {B3} weg.", "Fantasy"),
    f("tiergefaehrte", "faehigkeit", "Ruf der Wildnis", "Skill", HELD, ["beschwoerung", "natur"], "fest", 15, "{P2} Wolf {R3} aufstellen (Q4+ V5+ Zäh 2, A2 Nahkampf). Höchstens einer.", "Fantasy"),
    // Fähigkeiten der Helden: Sci-Fi
    f("tarnfeld", "faehigkeit", "Tarnfeld", "Skill", HELD, ["tarnung", "schutz", "technik"], "fest", 10, "{P1} Bis zur nächsten Aktivierung {T-1} gegen diesen Helden.", "Sci-Fi"),
    f("zielerfassung", "faehigkeit", "Zielerfassung", "Skill", HELD, ["fernkampf", "staerkung", "technik"], "fest", 10, "{P1} Feind {R24} markieren: Fernkampf gegen ihn ist bis Rundenende Zielsuchend.", "Sci-Fi"),
    f("kampfdrohne", "faehigkeit", "Kampfdrohne", "Skill", HELD, ["beschwoerung", "fernkampf", "technik"], "fest", 15, "{P2} Kampfdrohne {R3} aufstellen (Q4+ V5+ Zäh 1, Fliegen, Laser 12\" A1). Höchstens eine.", "Sci-Fi"),
    f("ueberladung", "faehigkeit", "Überladung", "Skill", HELD, ["staerkung", "technik"], "fest", 5, "{P1} Eine Fernkampfwaffe: {A+1} und Überhitzen für einen Angriff.", "Sci-Fi"),
    f("hacken", "faehigkeit", "System hacken", "Skill", HELD, ["betaeubung", "technik"], "fest", 10, "{P1} Maschine oder Drohne {R12}: bei {D4} {X}.", "Sci-Fi"),

    // Sonderregeln der Gegner: Fantasy
    f("wiederkehr", "faehigkeit", "Wiederkehr", "Sonderregel", GEGNER, ["heilung", "furcht", "schatten"], "prozent", 20, "Stirbt es: bei {D5} am Rundenende mit 1 Lebenspunkt zurück.", "Fantasy"),
    f("rudeljaeger", "faehigkeit", "Rudeljäger", "Sonderregel", GEGNER, ["nahkampf", "staerkung", "natur"], "prozent", 10, "Greift ein weiteres Modell der Fraktion dasselbe Ziel an: {A+1} je Nahkampfwaffe.", "Fantasy"),
    f("steinhaut", "faehigkeit", "Steinhaut", "Sonderregel", GEGNER, ["schutz"], "prozent", 20, "Ignoriert Reißend und {DS1}.", "Fantasy"),
    f("lebensentzug", "faehigkeit", "Lebensentzug", "Sonderregel", GEGNER, ["heilung", "nahkampf", "schatten"], "prozent", 10, "{RU} Verursacht es im Nahkampf eine Wunde: {H1}.", "Fantasy"),
    f("netzwerfer", "faehigkeit", "Netze spinnen", "Sonderregel", GEGNER, ["betaeubung", "fernkampf"], "prozent", 10, "{RU} Feind {R9}: bei {D4} halbe Bewegung bis zur nächsten Aktivierung.", "Fantasy"),
    // Sonderregeln der Gegner: Sci-Fi
    f("nanoregeneration", "faehigkeit", "Nanoregeneration", "Sonderregel", GEGNER, ["heilung", "technik"], "prozent", 20, "Zu Beginn jeder Aktivierung {H1}.", "Sci-Fi"),
    f("selbstzerstoerung", "faehigkeit", "Selbstzerstörung", "Sonderregel", GEGNER, ["flaeche", "reaktion", "technik"], "prozent", 5, "Stirbt es: alle Einheiten {F3} je {A1} {DS2}.", "Sci-Fi"),
    f("energieschild-gegner", "faehigkeit", "Schildgenerator", "Sonderregel", GEGNER, ["schutz", "aura", "technik"], "prozent", 20, "Verbündete {F6}: {V+1} gegen Beschuss.", "Sci-Fi"),
    f("zielsystem", "faehigkeit", "Zielsystem", "Sonderregel", GEGNER, ["fernkampf", "technik"], "prozent", 10, "Alle Fernkampfwaffen sind Zielsuchend.", "Sci-Fi"),
    f("schwarmintelligenz", "faehigkeit", "Schwarmintelligenz", "Sonderregel", GEGNER, ["aura", "staerkung", "technik"], "prozent", 10, "Steht ein weiteres Modell der Fraktion {F6}: Furchtlos und {T+1}.", "Sci-Fi"),

    // Zauber: Fantasy
    f("kettenblitz", "zauber", "Kettenblitz", "Zauber", ALLE, ["fernkampf", "flaeche", "magie"], "fest", 15, "{Z5} Feind {R18}: {A2}, jeder weitere Feind {F3} um ihn {A1}.", "Fantasy"),
    f("wurzelgriff", "zauber", "Wurzelgriff", "Zauber", ALLE, ["betaeubung", "schwaechung", "magie", "natur"], "fest", 10, "{Z4} Feind {R12}: keine Bewegung bei seiner nächsten Aktivierung.", "Fantasy"),
    f("unsichtbarkeit", "zauber", "Unsichtbarkeit", "Zauber", FREUNDE, ["tarnung", "schutz", "magie"], "fest", 10, "{Z4} Verbündeter {R6}: bis zur nächsten Runde nur aus 12\" oder näher beschießbar.", "Fantasy"),
    f("totenerweckung", "zauber", "Totenerweckung", "Zauber", ALLE, ["beschwoerung", "magie", "furcht", "schatten"], "fest", 15, "{Z5} Skelett {R3} aufstellen (Q5+ V5+ Zäh 1, A1 Nahkampf).", "Fantasy"),
    f("blutpakt", "zauber", "Blutpakt", "Zauber", ALLE, ["staerkung", "magie", "schatten"], "fest", 10, "{Z4} Der Zauberer {W1}, ein Verbündeter {R6}: {A+1} je Waffe bis Rundenende.", "Fantasy"),
    // Zauber: Sci-Fi (Psi-Kräfte)
    f("psiblitz", "zauber", "Psi-Blitz", "Psi-Kraft", ALLE, ["fernkampf", "technik"], "fest", 10, "{Z4} Feind {R18}: {A2} {DS2}.", "Sci-Fi"),
    f("gedankenkontrolle", "zauber", "Gedankenkontrolle", "Psi-Kraft", ALLE, ["schwaechung", "technik"], "fest", 20, "{Z5} Feind {R12}: greift bei seiner nächsten Aktivierung ein Ziel deiner Wahl an.", "Sci-Fi"),
    f("telekinese", "zauber", "Telekinetischer Stoß", "Psi-Kraft", ALLE, ["bewegung", "technik"], "fest", 10, "{Z4} Modell {R12}: {B6} in beliebige Richtung versetzen.", "Sci-Fi"),
    f("stasisfeld", "zauber", "Stasisfeld", "Psi-Kraft", ALLE, ["betaeubung", "flaeche", "technik"], "fest", 15, "{Z5} Punkt {R12}: alle Einheiten {F3} {X}.", "Sci-Fi"),

    // Gegenstände: Fantasy
    f("rauchbombe", "gegenstand", "Rauchbombe", "Bombe", FREUNDE, ["tarnung", "einmalig"], "fest", 5, "{S} Bis zur nächsten Runde nicht beschießbar.", "Fantasy"),
    f("wurfnetz", "gegenstand", "Wurfnetz", "Ausrüstung", FREUNDE, ["betaeubung", "einmalig"], "fest", 5, "{S} Feind {R6}: keine Bewegung bei seiner nächsten Aktivierung.", "Fantasy"),
    f("feuertopf", "gegenstand", "Feuertopf", "Bombe", FREUNDE, ["feuer", "flaeche", "einmalig"], "fest", 10, "{S} Punkt {R9}: alle Einheiten {F3} {AW3}.", "Fantasy"),
    f("amulett-abwehr", "gegenstand", "Amulett der Abwehr", "Ausrüstung", FREUNDE, ["schutz", "magie"], "fest", 15, "{RU} Eine Wunde bei {D5} ignorieren.", "Fantasy"),
    f("plattenruestung", "gegenstand", "Plattenrüstung", "Ausrüstung", FREUNDE, ["schutz"], "fest", 10, "{V+1}, dafür {B-1}.", "Fantasy"),
    f("ring-regeneration", "gegenstand", "Ring der Erneuerung", "Ausrüstung", FREUNDE, ["heilung", "magie"], "fest", 15, "Zu Beginn jeder Aktivierung bei {D5} {H1}.", "Fantasy"),
    // Gegenstände: Sci-Fi
    f("medi-injektor", "gegenstand", "Medi-Injektor", "Verbrauchsgut", FREUNDE, ["heilung", "einmalig", "technik"], "fest", 5, "{S} Freie Aktion, selbst oder Verbündeter {R1}: {HW3+1}.", "Sci-Fi"),
    f("stimpack", "gegenstand", "Stimpack", "Verbrauchsgut", FREUNDE, ["staerkung", "einmalig", "technik"], "fest", 5, "{S} Bis Rundenende Schnell und {A+1} je Nahkampfwaffe.", "Sci-Fi"),
    f("emp-granate", "gegenstand", "EMP-Granate", "Granate", FREUNDE, ["betaeubung", "flaeche", "einmalig", "technik"], "fest", 10, "{S} Punkt {R9}: Maschinen und Drohnen {F3} bei {D3} {X}, alle anderen bei {D5}.", "Sci-Fi"),
    f("energieschild", "gegenstand", "Energieschild", "Ausrüstung", FREUNDE, ["schutz", "technik"], "fest", 10, "{RU} Einen Treffer mit DS ignorieren.", "Sci-Fi"),
    f("sprungmodul", "gegenstand", "Sprungmodul", "Ausrüstung", FREUNDE, ["bewegung", "technik"], "fest", 10, "{RU} Statt zu gehen {B12} springen, auch über Gelände und Feinde.", "Sci-Fi"),
    f("scanner-visier", "gegenstand", "Scanner-Visier", "Ausrüstung", FREUNDE, ["fernkampf", "technik"], "fest", 5, "Feinde mit Tarnung verlieren ihren Vorteil gegen diesen Helden.", "Sci-Fi"),
  ];

  const STAERKEN = [
    { id: "klein", name: "Klein", fest: 5, prozent: 5 },
    { id: "mittel", name: "Mittel", fest: 10, prozent: 10 },
    { id: "gross", name: "Groß", fest: 15, prozent: 20 },
    { id: "elite", name: "Elite", fest: 20, prozent: 30 },
  ];
  // Kategorien der Datenbank: Fähigkeiten und Zauber zusammen, Gegenstände und Waffen zusammen
  const KATEGORIEN = [
    { id: "einheit", name: "Einheiten", icon: "skull", typen: ["einheit"] },
    { id: "faehigkeiten", name: "Fähigkeiten & Zauber", icon: "rune", typen: ["faehigkeit", "zauber"] },
    { id: "ausruestung", name: "Gegenstände & Waffen", icon: "sword", typen: ["gegenstand", "waffe"] },
    { id: "fraktion", name: "Fraktionen", icon: "shield", typen: ["fraktion"] },
  ];
  const kategorieVon = typ => (KATEGORIEN.find(k => k.typen.includes(typ)) || KATEGORIEN[1]).id;
  const TYPEN = [
    { id: "einheit", name: "Einheiten", einzahl: "Einheit" },
    { id: "faehigkeit", name: "Fähigkeiten", einzahl: "Fähigkeit" },
    { id: "zauber", name: "Zauber", einzahl: "Zauber" },
    { id: "gegenstand", name: "Gegenstände", einzahl: "Gegenstand" },
    { id: "waffe", name: "Waffen", einzahl: "Waffe" },
    { id: "fraktion", name: "Fraktionen", einzahl: "Fraktion" },
  ];

  // Tags einer Waffenzeile ergeben sich aus ihren Regeln
  function tagsFuerWaffe(w) {
    const t = [w.reichweite ? "fernkampf" : "nahkampf"];
    if (w.explosion) t.push("flaeche");
    if (w.gift) t.push("gift");
    if (w.element && !t.includes(w.element)) t.push(w.element);
    return t;
  }


  // ---------- Auf eine Seltenheit skalieren ----------
  // Ein Klick auf „Gewöhnlich“ … „Boss“ passt die Einheit an: erst die Zahl der Fähigkeiten (ein Boss kann mehr
  // als ein Grunzer), dann Qualität, Verteidigung, Zäh und Attacken reihum, bis die Punkte in der Stufe liegen.
  const FAEHIGKEITEN_JE_STUFE = [0, 0, 1, 1, 2, 3, 4];
  const ZIEL_JE_STUFE = [0, 25, 60, 85, 130, 190, 260];
  const zahl = (x, d) => parseInt(x, 10) || d;
  // Alle Waffen um eine Attacke rauf oder runter (zwischen A1 und A12); null, wenn sich keine ändern lässt
  function mitAttacken(weapons, delta) {
    let geaendert = false;
    const zeilen = String(weapons || "").split("\n").map(z => {
      const teile = z.split("|");
      if (teile.length < 3) return z;
      const a = zahl(String(teile[2]).replace(/\D/g, ""), 1), neu = a + delta;
      if (neu < 1 || neu > 12) return z;
      geaendert = true;
      teile[2] = ` A${neu} `;
      return teile.join("|");
    });
    return geaendert ? zeilen.join("\n") : null;
  }

  function passendeFaehigkeiten(s, kandidaten) {
    const rolle = s.role || "enemy";
    const praegung = Array.isArray(s.praegung) ? s.praegung : [];
    const zauberer = /zauberer|caster/i.test(s.passives || "");
    const waffenTags = new Set(Regeln.leseWaffen(s.weapons).flatMap(tagsFuerWaffe));
    const vorhanden = new Set((s.skills || []).map(k => k.id));
    const wert = f => (f.tags || []).reduce((n, t) => n + (praegung.includes(t) ? 3 : waffenTags.has(t) ? 1 : 0), 0)
      + (rolle === "enemy" && f.art === "Sonderregel" ? 1 : 0);
    return kandidaten
      .filter(f => (f.fuer || []).includes(rolle) && !vorhanden.has(f.id) && !konflikt(f, praegung)
        && (f.typ === "faehigkeit" || (f.typ === "zauber" && zauberer)))
      .sort((a, b) => wert(b) - wert(a) || (a.kosten.wert - b.kosten.wert) || a.name.localeCompare(b.name));
  }
  function skaliere(einheit, stufe, kandidaten = GRUNDBESTAND) {
    const s = JSON.parse(JSON.stringify(einheit));
    // Ziel ist die Mitte der Stufe, nicht ihr Rand: ±12 %, aber nie über die Stufengrenzen hinaus
    const mitte = ZIEL_JE_STUFE[stufe];
    const lo = Math.max(Regeln.GRENZEN[stufe], Math.round(mitte * 0.88)), hi = Math.min(stufe < 6 ? Regeln.GRENZEN[stufe + 1] - 5 : 999, Math.round(mitte * 1.12));
    // Fähigkeiten: überzählige von hinten weg, fehlende passend zu Prägung und Waffen dazu
    const soll = FAEHIGKEITEN_JE_STUFE[stufe];
    const vorher = Array.isArray(s.skills) ? s.skills : [];
    const weg = vorher.slice(soll).map(k => k.name);
    s.skills = vorher.slice(0, soll);
    const neu = [];
    for (const f of passendeFaehigkeiten(s, kandidaten)) {
      if (s.skills.length >= soll) break;
      s.skills.push({ id: f.id, typ: f.typ, name: f.name, art: f.art, tags: [...(f.tags || [])], text: f.text, kosten: { ...f.kosten }, ...(f.energie !== undefined ? { energie: f.energie } : {}) });
      neu.push(f.name);
    }
    // Werte reihum verschieben, damit keiner allein ausreißt
    const pts = x => Regeln.punkte(x).pts;
    // Qualität und Verteidigung 2+ nur für Legendär und Boss, 6+ auf Treffer nie; Zäh und Attacken tragen die großen Sprünge
    // Qualität und Verteidigung wandern höchstens eine Stufe vom Ausgangswert, damit der Charakter erkennbar bleibt
    const q0 = zahl(s.quality, 4), d0 = zahl(s.defense, 5);
    const qMin = Math.max(stufe >= 5 ? 2 : 3, q0 - 1), qMax = Math.min(5, Math.max(q0, q0 + 1));
    const dMin = Math.max(stufe >= 5 ? 2 : 3, d0 - 1), dMax = Math.min(6, d0 + 1);
    const ZUEGE = [
      [x => zahl(x.tough, 1) < 40 && { tough: String(zahl(x.tough, 1) + 1) }, x => zahl(x.tough, 1) > 1 && { tough: String(zahl(x.tough, 1) - 1) }],
      [x => { const w = mitAttacken(x.weapons, 1); return w !== null && { weapons: w }; },
        x => { const w = mitAttacken(x.weapons, -1); return w !== null && { weapons: w }; }],
      [x => zahl(x.quality, 4) > qMin && { quality: zahl(x.quality, 4) - 1 + "+" }, x => zahl(x.quality, 4) < qMax && { quality: zahl(x.quality, 4) + 1 + "+" }],
      [x => zahl(x.defense, 5) > dMin && { defense: zahl(x.defense, 5) - 1 + "+" }, x => zahl(x.defense, 5) < dMax && { defense: zahl(x.defense, 5) + 1 + "+" }],
    ];
    for (let i = 0; i < 160; i++) {
      const p = pts(s);
      // Boss hat nach oben keine Grenze: Wer schon darüber liegt, wird nicht künstlich geschwächt
      if (p >= lo && (p <= hi || stufe === 6)) break;
      const rauf = p < lo;
      const versuche = ZUEGE.map((_, k) => ZUEGE[(i + k) % ZUEGE.length][rauf ? 0 : 1](s)).filter(Boolean)
        .map(aend => ({ aend, p: pts({ ...s, ...aend }) }));
      if (!versuche.length) break;
      const treffer = versuche.find(v => v.p >= lo && v.p <= hi)
        || versuche.find(v => rauf ? v.p > p && v.p <= hi : v.p < p && v.p >= lo)
        || versuche.slice().sort((a, b) => Math.abs(a.p - mitte) - Math.abs(b.p - mitte))[0];
      Object.assign(s, treffer.aend);
    }
    s.points = pts(s);
    s.tier = Regeln.stufeFuerPunkte(s.points);
    return { karte: s, neu, weg };
  }


  // ---------- Gegnerwelle würfeln ----------
  // Stellt aus den vorhandenen Gegnern eine Welle zusammen, deren Punkte möglichst nah am Ziel liegen (±10 %).
  // Die Schwierigkeit begrenzt die Seltenheit (Anfänger bis Magisch … Legendär mit Boss), höchstens ein Boss,
  // jede Gegnerart höchstens dreimal. Ab „Experte“ führt ein Anführer der höchsten erlaubten Stufe die Welle an.
  const MAX_STUFE_JE_SCHWIERIGKEIT = [0, 3, 4, 5, 6];
  function welleWuerfeln(pool, ziel, opt = {}) {
    const schw = Math.min(4, Math.max(1, opt.schwierigkeit || 2));
    let seed = (opt.seed || 1) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const erlaubt = pool.filter(g => g.pts > 0 && g.stufe <= MAX_STUFE_JE_SCHWIERIGKEIT[schw] && (!opt.fraktion || g.faction === opt.fraktion));
    if (!erlaubt.length || ziel <= 0) return { einheiten: [], summe: 0, ziel };
    let beste = null;
    for (let versuch = 0; versuch < 300; versuch++) {
      const zahl = new Map(); let summe = 0, boss = false;
      const nimm = g => { zahl.set(g.key, (zahl.get(g.key) || 0) + 1); summe += g.pts; if (g.stufe === 6) boss = true; };
      if (schw >= 3) {
        const fuehrer = erlaubt.filter(g => g.stufe >= MAX_STUFE_JE_SCHWIERIGKEIT[schw] - 1 && g.pts <= ziel * 0.65);
        if (fuehrer.length) nimm(fuehrer[Math.floor(rnd() * fuehrer.length)]);
      }
      for (let i = 0; i < 40 && summe < ziel * 0.9; i++) {
        const frei = erlaubt.filter(g => (zahl.get(g.key) || 0) < 3 && summe + g.pts <= ziel * 1.1 && !(boss && g.stufe === 6));
        if (!frei.length) break;
        // Kleinere Gegner etwas wahrscheinlicher, damit die Welle aus mehreren Figuren besteht
        const gewicht = frei.map(g => 1 / Math.sqrt(g.pts));
        let x = rnd() * gewicht.reduce((a, b) => a + b, 0), k = 0;
        while (x > gewicht[k] && k < frei.length - 1) x -= gewicht[k++];
        nimm(frei[k]);
      }
      const abstand = Math.abs(summe - ziel) - zahl.size * 0.5;
      if (!beste || abstand < beste.abstand) beste = { zahl, summe, abstand };
      if (Math.abs(summe - ziel) <= ziel * 0.03 && zahl.size >= 2) break;
    }
    const einheiten = [...beste.zahl].map(([key, anzahl]) => ({ ...erlaubt.find(g => g.key === key), anzahl }))
      .sort((a, b) => b.stufe - a.stufe || b.pts - a.pts);
    return { einheiten, summe: beste.summe, ziel };
  }

  const Katalog = { TAGS, FRAKTIONEN, GRUNDBESTAND, STAERKEN, TYPEN, KATEGORIEN, kategorieVon, skaliere, FAEHIGKEITEN_JE_STUFE, welleWuerfeln, PRAEGUNGEN, GEGENSAETZE, konflikt, tagsFuerWaffe };
  if (typeof module !== "undefined" && module.exports) module.exports = Katalog;
  else root.Katalog = Katalog;
})(typeof globalThis !== "undefined" ? globalThis : this);

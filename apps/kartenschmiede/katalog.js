/* Kartenschmiede – Katalog: Tags, Fraktionen und der Standardbestand der Datenbank.
   Einträge haben einen Typ: faehigkeit, zauber, gegenstand, waffe oder fraktion.
   Kosten:
     kosten.typ "fest"    → Punkte obendrauf (Skills, Auren, Zauber, Gegenstände); Stufen nach Chris' „Punktelogiken“:
                            klein 5 · mittel 10 · groß 15 · elite 20
     kosten.typ "prozent" → Aufschlag auf die Formel (Sonderregeln der Gegner, wachsen mit der Einheit):
                            klein 5 · mittel 10 · groß 20 · elite 30
   Waffen haben keine festen Kosten: Sie landen als Waffenzeile auf der Karte und die Formel rechnet sie mit.
   Eigene Einträge kommen über die Seite dazu und liegen auf dem Server (kartenschmiede/_faehigkeiten.json). */
(function (root) {
  "use strict";

  // Tags: kurze Schlagworte mit Symbol, damit man auf der Karte nichts ausschreiben muss und filtern kann
  const TAGS = [
    { id: "nahkampf", name: "Nahkampf", icon: "sword" },
    { id: "fernkampf", name: "Fernkampf", icon: "target" },
    { id: "flaeche", name: "Fläche", icon: "burst" },
    { id: "betaeubung", name: "Betäubung", icon: "spiral" },
    { id: "aura", name: "Aura", icon: "rings" },
    { id: "heilung", name: "Heilung", icon: "heart" },
    { id: "schutz", name: "Schutz", icon: "shield" },
    { id: "staerkung", name: "Stärkung", icon: "up" },
    { id: "schwaechung", name: "Schwächung", icon: "down" },
    { id: "bewegung", name: "Bewegung", icon: "wing" },
    { id: "furcht", name: "Furcht", icon: "skull" },
    { id: "gift", name: "Gift", icon: "drop" },
    { id: "feuer", name: "Feuer", icon: "flame" },
    { id: "frost", name: "Frost", icon: "snow" },
    { id: "magie", name: "Magie", icon: "rune" },
    { id: "beschwoerung", name: "Beschwörung", icon: "portal" },
    { id: "reaktion", name: "Reaktion", icon: "bolt" },
    { id: "tarnung", name: "Tarnung", icon: "eye" },
    { id: "einmalig", name: "Einmalig", icon: "potion" },
    { id: "technik", name: "Sci-Fi", icon: "cog" },
    { id: "licht", name: "Licht", icon: "sun" },
    { id: "schatten", name: "Schatten", icon: "moon" },
  ];

  // Prägung einer Einheit: was sie ihrem Wesen nach ist (ein Feuerelementar ist „Feuer“). Einträge mit dem
  // Gegenteil sind für sie gesperrt – ein Feuerelementar lernt keine Frostzauber. Neue Paare einfach hier ergänzen.
  const PRAEGUNGEN = ["feuer", "frost", "licht", "schatten", "gift", "magie", "technik"];
  const GEGENSAETZE = [["feuer", "frost"], ["licht", "schatten"]];
  const gegenteilVon = tag => GEGENSAETZE.flatMap(([a, b]) => tag === a ? [b] : tag === b ? [a] : []);
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
    fr("elfen", "Elfen", "leaf", "Waldvölker, Bogenschützen und alte Magie."),
    fr("dunkelelfen", "Dunkelelfen", "eye", "Korsaren, Hexen und Schattenklingen."),
    fr("zwerge", "Zwerge", "hammer", "Bergfesten, Runenschmiede und Maschinen."),
    fr("orks", "Orks", "axe", "Kriegsbanden, Rohe Kraft und Blechpanzer."),
    fr("untote", "Untote", "skull", "Skelette, Geister und Nekromanten.", ["schatten"]),
    fr("daemonen", "Dämonen", "flame", "Beschworene Wesen aus Kristall und Feuer.", ["feuer"]),
    fr("urwild", "Urwild", "paw", "Parasiten, Pilzwesen und Bestien der Wildnis."),
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
    f("schattenschritt", "faehigkeit", "Schattenschritt", "Skill", HELD, ["bewegung", "tarnung", "schatten"], "fest", 10, "Skill, 1 Power: Bis zu 4\" bewegen. Endet die Bewegung in Deckung oder außer Sicht, +1 Verteidigung gegen Beschuss bis zur nächsten Aktivierung."),
    f("schwachstelle", "faehigkeit", "Schwachstelle", "Skill", HELD, ["nahkampf", "staerkung"], "fest", 10, "Skill, 1 Power: Einen Feind in 1\" wählen. Eigene Nahkampfangriffe gegen ihn erhalten DS(1) bis zum Ende der Aktivierung."),
    f("wunden-heilen", "faehigkeit", "Wunden heilen", "Skill", HELD, ["heilung", "licht"], "fest", 15, "Skill, 1 Power: Ein Verbündeter in 6\" heilt W3 Wunden."),
    f("strahlender-schutz", "faehigkeit", "Strahlender Schutz", "Skill", HELD, ["schutz", "licht"], "fest", 10, "Skill, 1 Power: Ein Verbündeter in 6\" erhält +1 Verteidigung gegen den nächsten Angriff vor der nächsten Aktivierung."),
    f("beute-markieren", "faehigkeit", "Beute markieren", "Skill", HELD, ["fernkampf", "staerkung"], "fest", 10, "Skill, 1 Power: Einen sichtbaren Feind in 18\" wählen. Der nächste verbündete Angriff gegen ihn erhält +1 auf Treffer."),
    f("schlingenfalle", "faehigkeit", "Schlingenfalle", "Skill", HELD, ["betaeubung"], "fest", 5, "Skill, 1 Power: Einen Fallenmarker in 3\" legen. Der erste Feind, der sich in 1\" bewegt, erhält 1 Treffer und ist bei 4+ beeinträchtigt. Dann Marker entfernen."),
    f("reihe-halten", "faehigkeit", "Die Reihe halten", "Skill", HELD, ["schutz", "aura"], "fest", 10, "Skill, 1 Power: Bis zur nächsten Aktivierung erhalten Feinde in 3\" −1 auf Treffer gegen andere Verbündete."),
    f("schildstoss", "faehigkeit", "Schildstoß", "Skill", HELD, ["nahkampf", "bewegung"], "fest", 5, "Skill, 1 Power: Ein Feind in 1\" erhält 1 Treffer. Bei bestandener STR-Probe 2\" zurückstoßen."),

    // Auren (Anführer, aus den OPR-Upgrades in Chris' Tabelle)
    f("aura-reissend", "faehigkeit", "Aura der Klingen", "Aura", ALLE, ["aura", "nahkampf", "staerkung"], "fest", 15, "Verbündete in 6\" erhalten Reißend im Nahkampf."),
    f("aura-hinterhalt", "faehigkeit", "Pfadfinder", "Aura", ALLE, ["aura", "bewegung"], "fest", 10, "Verbündete Einheiten dürfen aus dem Hinterhalt kommen, wenn sie in 6\" von diesem Modell aufgestellt werden."),
    f("aura-sturm", "faehigkeit", "Sturmruf", "Aura", ALLE, ["aura", "bewegung"], "fest", 5, "Verbündete in 6\" bewegen sich beim Angreifen 2\" weiter."),

    // Sonderregeln von Chris' eigenen Gegnern (Blatt „Selfmade“)
    f("kristallsplitter", "faehigkeit", "Kristallsplitter", "Sonderregel", GEGNER, ["reaktion"], "prozent", 5, "Erleidet dieses Modell eine Wunde, erleidet der Angreifer bei einer 6 ebenfalls 1 Schaden.", "Selfmade"),
    f("saeureblut", "faehigkeit", "Säureblut", "Sonderregel", GEGNER, ["reaktion", "gift"], "prozent", 5, "Erleidet dieses Modell eine Wunde, erhält der Angreifer bei 5+ einen Treffer.", "Selfmade"),
    f("strahlende-aura", "faehigkeit", "Strahlende Aura", "Sonderregel", GEGNER, ["aura", "flaeche", "licht"], "prozent", 20, "Feinde innerhalb von 6\" erleiden am Ende jeder Runde einen automatischen Treffer mit DS(1).", "Selfmade"),
    f("gebrochene-ketten", "faehigkeit", "Gebrochene Ketten", "Sonderregel", GEGNER, ["einmalig", "staerkung"], "prozent", 10, "Einmal pro Spiel: Fällt das Modell unter die Hälfte seiner Lebenspunkte, aktiviert es sofort ein weiteres Mal.", "Selfmade"),
    f("sporenwolke", "faehigkeit", "Sporenwolke", "Sonderregel", GEGNER, ["gift", "flaeche", "reaktion"], "prozent", 10, "Stirbt dieses Modell, erhalten alle Einheiten in 3\" je 1 Treffer mit Gift.", "Vorschlag"),
    f("blutrausch", "faehigkeit", "Blutrausch", "Sonderregel", GEGNER, ["nahkampf", "staerkung"], "prozent", 10, "Sobald das Modell höchstens die Hälfte seiner Lebenspunkte hat, erhält jede Nahkampfwaffe +1 Attacke.", "Vorschlag"),
    f("brut", "faehigkeit", "Brut", "Sonderregel", GEGNER, ["beschwoerung"], "prozent", 20, "Am Ende jeder Runde bei 5+: Eine Einheit Giftmaden (oder eine andere Gewöhnliche Einheit derselben Fraktion) in 3\" aufstellen.", "Vorschlag"),
    f("schreckensschrei", "faehigkeit", "Schreckensschrei", "Sonderregel", GEGNER, ["furcht", "flaeche", "einmalig"], "prozent", 10, "Einmal pro Spiel: Alle Helden in 9\" legen sofort eine Moralprobe ab.", "Vorschlag"),
    f("phasenschritt", "faehigkeit", "Phasenschritt", "Sonderregel", ALLE, ["bewegung", "reaktion"], "prozent", 10, "Einmal pro Runde nach einem Angriff gegen dieses Modell: bei 4+ bis zu 3\" in beliebige Richtung versetzen.", "Vorschlag"),

    // Zauber: nur für Modelle mit Zauberer(X). Wurf auf den angegebenen Wert, bei Fehlschlag verpufft der Zauber.
    f("feuerball", "zauber", "Feuerball", "Zauber", ALLE, ["feuer", "flaeche", "fernkampf", "magie"], "fest", 15, "Zauber (4+): Alle Einheiten in 3\" um einen Punkt in 18\" erleiden W3 Treffer."),
    f("frostlanze", "zauber", "Frostlanze", "Zauber", ALLE, ["frost", "fernkampf", "schwaechung", "magie"], "fest", 10, "Zauber (4+): Ein Feind in 12\" erleidet 2 Treffer mit DS(1) und bewegt sich bis zu seiner nächsten Aktivierung nur halb so weit."),
    f("heilendes-licht", "zauber", "Heilendes Licht", "Zauber", FREUNDE, ["heilung", "magie", "licht"], "fest", 10, "Zauber (4+): Ein Verbündeter in 12\" heilt W3 Wunden."),
    f("schutzkreis", "zauber", "Schutzkreis", "Zauber", ALLE, ["schutz", "aura", "magie", "licht"], "fest", 15, "Zauber (5+): Alle Verbündeten in 6\" erhalten +1 Verteidigung bis zur nächsten Runde."),
    f("laehmungsfluch", "zauber", "Lähmungsfluch", "Zauber", ALLE, ["betaeubung", "magie", "schatten"], "fest", 15, "Zauber (5+): Ein Feind in 12\" ist betäubt und darf sich bei seiner nächsten Aktivierung nur bewegen."),
    f("geistwolf", "zauber", "Geistwolf", "Zauber", ALLE, ["beschwoerung", "magie"], "fest", 20, "Zauber (5+): Einen Geistwolf (Qualität 4+, Verteidigung 5+, Zäh 3, A2 Nahkampf) in 3\" aufstellen. Er bleibt bis zum Ende des Spiels."),

    // Gegenstände: Tränke und Bomben aus dem Quest-Kampagnenbuch (Wirkung hier als Vorschlag), dazu Ausrüstung
    f("heiltrank", "gegenstand", "Heiltrank", "Trank", FREUNDE, ["heilung", "einmalig"], "fest", 5, "Einmal: Als freie Aktion W3+1 Wunden heilen.", "Quest-Kampagne"),
    f("heldenelixier", "gegenstand", "Heldenelixier", "Trank", FREUNDE, ["staerkung", "einmalig"], "fest", 5, "Einmal: Bis zum Ende der Runde +1 auf alle Treffer- und Probenwürfe.", "Quest-Kampagne"),
    f("kraftelixier", "gegenstand", "Kraftelixier", "Trank", HELD, ["magie", "einmalig"], "fest", 5, "Einmal: Sofort 3 Power zurückerhalten.", "Quest-Kampagne"),
    f("teleporttrank", "gegenstand", "Teleporttrank", "Trank", FREUNDE, ["bewegung", "einmalig"], "fest", 5, "Einmal: Bis zu 12\" versetzen, auch aus dem Nahkampf heraus.", "Quest-Kampagne"),
    f("betaeubungsbombe", "gegenstand", "Betäubungsbombe", "Bombe", FREUNDE, ["betaeubung", "flaeche", "einmalig"], "fest", 10, "Einmal: Alle Einheiten in 3\" um einen Punkt in 9\" sind bei 4+ betäubt.", "Quest-Kampagne"),
    f("runenschild", "gegenstand", "Runenschild", "Ausrüstung", FREUNDE, ["schutz"], "fest", 10, "+1 Verteidigung gegen Beschuss."),
    f("sprungstiefel", "gegenstand", "Sprungstiefel", "Ausrüstung", FREUNDE, ["bewegung"], "fest", 5, "+2\" beim Bewegen und Angreifen."),

    // Waffen: landen als Zeile auf der Karte, die Formel rechnet sie wie jede andere Waffe
    w("frostklauen", "Frostklauen", "Frostklauen | Nahkampf | A4 | Reißend", ["nahkampf", "frost"], "Klauen, die Rüstung wie Eis zerschneiden."),
    w("runenaxt", "Runenaxt", "Runenaxt | Nahkampf | A3 | DS(2)", ["nahkampf", "magie"], "Schwer, langsam, und keine Rüstung hält stand."),
    w("giftspeichel", "Giftspeichel", "Giftspeichel | 12\" | A3 | Gift", ["fernkampf", "gift"], "Ätzender Strahl aus dem Rachen."),
    w("splitterwerfer", "Splitterwerfer", "Splitterwerfer | 18\" | A2 | DS(1), Explosion(3)", ["fernkampf", "flaeche"], "Schleudert Kristallsplitter, die beim Aufprall zerbersten."),
    w("jagdbogen", "Jagdbogen", "Jagdbogen | 24\" | A2 |", ["fernkampf"], "Langer Bogen der Waldläufer."),

    // ---------- Fantasy-Erweiterung (angelehnt an die Waffen und Sonderregeln aus Age of Fantasy) ----------
    w("langschwert", "Langschwert", "Langschwert | Nahkampf | A2 |", ["nahkampf"], "Die Waffe jedes Ritters und Söldners.", "Fantasy"),
    w("zweihaender", "Zweihänder", "Zweihänder | Nahkampf | A3 | DS(1)", ["nahkampf"], "Langsam gezogen, schnell bereut.", "Fantasy"),
    w("kriegshammer", "Kriegshammer", "Kriegshammer | Nahkampf | A2 | DS(2)", ["nahkampf"], "Zertrümmert Plattenpanzer samt Inhalt.", "Fantasy"),
    w("lanze", "Lanze", "Lanze | Nahkampf | A2 | Stoß", ["nahkampf", "bewegung"], "Entfaltet ihre Wucht erst im Ansturm.", "Fantasy"),
    w("zwillingsdolche", "Zwillingsdolche", "Zwillingsdolche | Nahkampf | A4 |", ["nahkampf", "tarnung"], "Schnelle Stiche aus dem Schatten.", "Fantasy"),
    w("flammenklinge", "Flammenklinge", "Flammenklinge | Nahkampf | A2 | DS(1), Reißend", ["nahkampf", "feuer", "magie"], "Eine Runenklinge, die in der Scheide glimmt.", "Fantasy"),
    w("seelensense", "Seelensense", "Seelensense | Nahkampf | A2 | Tödlich(3)", ["nahkampf", "furcht", "schatten"], "Wen sie streift, dem folgt die Seele nach.", "Fantasy"),
    w("dornenpeitsche", "Dornenpeitsche", "Dornenpeitsche | Nahkampf | A4 | Zerfleischen", ["nahkampf", "gift"], "Reißt Wunden, die nicht heilen wollen.", "Fantasy"),
    w("armbrust", "Armbrust", "Armbrust | 24\" | A1 | DS(1)", ["fernkampf"], "Durchschlägt ein Kettenhemd auf zwanzig Schritt.", "Fantasy"),
    w("elfenbogen", "Elfenbogen", "Elfenbogen | 30\" | A1 | Präzise", ["fernkampf"], "Aus Silberholz, trifft, wohin der Blick fällt.", "Fantasy"),
    w("wurfaexte", "Wurfäxte", "Wurfäxte | 6\" | A2 |", ["fernkampf", "nahkampf"], "Erst geworfen, dann nachgesetzt.", "Fantasy"),
    w("wurfspeer", "Wurfspeer", "Wurfspeer | 12\" | A1 | DS(1)", ["fernkampf"], "Leicht, schnell und tödlich genau.", "Fantasy"),
    w("blitzstab", "Blitzstab", "Blitzstab | 18\" | A2 | DS(1)", ["fernkampf", "magie"], "Ein Stab, der nach Gewitter riecht.", "Fantasy"),
    w("drachenatem", "Drachenatem", "Drachenatem | 12\" | A1 | Explosion(6), Zuverlässig", ["fernkampf", "feuer", "flaeche"], "Ein Feuerstoß, dem niemand ausweicht.", "Fantasy"),
    w("steinschleuder", "Steinschleuder", "Steinschleuder | 36\" | A1 | DS(1), Explosion(3), Indirekt", ["fernkampf", "flaeche"], "Belagerungswaffe, feuert über Mauern hinweg.", "Fantasy"),

    // ---------- Sci-Fi-Erweiterung (angelehnt an die Waffen aus Grimdark Future) ----------
    w("laserpistole", "Laserpistole", "Laserpistole | 12\" | A1 |", ["fernkampf", "technik"], "Handlich, zuverlässig, überall zu haben.", "Sci-Fi"),
    w("lasergewehr", "Lasergewehr", "Lasergewehr | 24\" | A1 |", ["fernkampf", "technik"], "Standardwaffe jeder Söldnertruppe.", "Sci-Fi"),
    w("sturmgewehr", "Sturmgewehr", "Sturmgewehr | 24\" | A3 |", ["fernkampf", "technik"], "Viel Blei, wenig Feinheit.", "Sci-Fi"),
    w("pulsgewehr", "Pulsgewehr", "Pulsgewehr | 30\" | A1 | DS(1)", ["fernkampf", "technik"], "Verschießt gebündelte Energiepakete.", "Sci-Fi"),
    w("plasmagewehr", "Plasmagewehr", "Plasmagewehr | 24\" | A1 | DS(3), Überhitzen", ["fernkampf", "feuer", "technik"], "Schmilzt Panzerung – und manchmal den Schützen.", "Sci-Fi"),
    w("flammenwerfer", "Flammenwerfer", "Flammenwerfer | 9\" | A1 | Explosion(3), Zuverlässig", ["fernkampf", "feuer", "flaeche", "technik"], "Räumt Gräben und Gänge.", "Sci-Fi"),
    w("kryowerfer", "Kryowerfer", "Kryowerfer | 12\" | A2 | DS(1)", ["fernkampf", "frost", "technik"], "Friert Gelenke und Servos ein.", "Sci-Fi"),
    w("granatwerfer", "Granatwerfer", "Granatwerfer | 24\" | A1 | Explosion(3), Indirekt", ["fernkampf", "flaeche", "technik"], "Hinter der Deckung ist man nicht sicher.", "Sci-Fi"),
    w("raketenwerfer", "Raketenwerfer", "Raketenwerfer | 30\" | A1 | DS(2), Explosion(3), Zielsuchend", ["fernkampf", "flaeche", "technik"], "Findet sein Ziel auch hinter Rauch.", "Sci-Fi"),
    w("scharfschuetzengewehr", "Scharfschützengewehr", "Scharfschützengewehr | 36\" | A1 | DS(1), Präzise", ["fernkampf", "tarnung", "technik"], "Ein Schuss, ein Name weniger.", "Sci-Fi"),
    w("schienenkanone", "Schienenkanone", "Schienenkanone | 36\" | A1 | DS(4), Tödlich(3)", ["fernkampf", "technik"], "Magnetisch beschleunigter Bolzen, der Panzer knackt.", "Sci-Fi"),
    w("kettenschwert", "Kettenschwert", "Kettenschwert | Nahkampf | A3 | Reißend", ["nahkampf", "technik"], "Kreischende Zähne aus Stahl.", "Sci-Fi"),
    w("energieschwert", "Energieschwert", "Energieschwert | Nahkampf | A2 | DS(2)", ["nahkampf", "technik"], "Ein Feld aus Energie schneidet durch jede Rüstung.", "Sci-Fi"),
    w("energiefaust", "Energiefaust", "Energiefaust | Nahkampf | A2 | DS(4)", ["nahkampf", "technik"], "Langsam, aber was sie trifft, bleibt liegen.", "Sci-Fi"),
    w("monoklinge", "Monomolekularklinge", "Monomolekularklinge | Nahkampf | A2 | Zersetzen", ["nahkampf", "technik"], "Eine Schneide, dünner als ein Atom.", "Sci-Fi"),
    w("schockstab", "Schockstab", "Schockstab | Nahkampf | A2 | Stoß", ["nahkampf", "betaeubung", "technik"], "Elektrischer Schlag, der Muskeln lähmt.", "Sci-Fi"),

    // Fähigkeiten der Helden: Fantasy
    f("wirbelwind", "faehigkeit", "Wirbelwind", "Skill", HELD, ["nahkampf", "flaeche"], "fest", 15, "Skill, 1 Power: Jeder Feind in 1\" erleidet 1 Treffer mit DS(1).", "Fantasy"),
    f("schlachtruf", "faehigkeit", "Schlachtruf", "Skill", HELD, ["aura", "staerkung", "nahkampf"], "fest", 10, "Skill, 1 Power: Verbündete in 6\" erhalten bis zum Ende der Runde +1 auf Nahkampftreffer.", "Fantasy"),
    f("gezielter-schuss", "faehigkeit", "Gezielter Schuss", "Skill", HELD, ["fernkampf", "staerkung"], "fest", 10, "Skill, 1 Power: Der nächste Fernkampfangriff dieser Aktivierung erhält Präzise und DS(+1).", "Fantasy"),
    f("ausweichrolle", "faehigkeit", "Ausweichrolle", "Skill", HELD, ["bewegung", "reaktion"], "fest", 5, "Skill, 1 Power, als Reaktion: Nach einem Nahkampfangriff gegen diesen Helden bis zu 3\" wegbewegen.", "Fantasy"),
    f("tiergefaehrte", "faehigkeit", "Ruf der Wildnis", "Skill", HELD, ["beschwoerung"], "fest", 15, "Skill, 2 Power: Einen Wolf (Qualität 4+, Verteidigung 5+, Zäh 2, A2 Nahkampf) in 3\" aufstellen. Höchstens einer zugleich.", "Fantasy"),
    // Fähigkeiten der Helden: Sci-Fi
    f("tarnfeld", "faehigkeit", "Tarnfeld", "Skill", HELD, ["tarnung", "schutz", "technik"], "fest", 10, "Skill, 1 Power: Bis zur nächsten Aktivierung −1 auf Treffer gegen diesen Helden.", "Sci-Fi"),
    f("zielerfassung", "faehigkeit", "Zielerfassung", "Skill", HELD, ["fernkampf", "staerkung", "technik"], "fest", 10, "Skill, 1 Power: Einen Feind in 24\" markieren. Fernkampfangriffe gegen ihn erhalten bis Rundenende Zielsuchend.", "Sci-Fi"),
    f("kampfdrohne", "faehigkeit", "Kampfdrohne", "Skill", HELD, ["beschwoerung", "fernkampf", "technik"], "fest", 15, "Skill, 2 Power: Eine Kampfdrohne (Qualität 4+, Verteidigung 5+, Zäh 1, Fliegen, Laser 12\" A1) in 3\" aufstellen. Höchstens eine zugleich.", "Sci-Fi"),
    f("ueberladung", "faehigkeit", "Überladung", "Skill", HELD, ["staerkung", "technik"], "fest", 5, "Skill, 1 Power: Eine Fernkampfwaffe erhält für einen Angriff +1 Attacke und Überhitzen.", "Sci-Fi"),
    f("hacken", "faehigkeit", "System hacken", "Skill", HELD, ["betaeubung", "technik"], "fest", 10, "Skill, 1 Power: Ein mechanischer Feind oder eine Drohne in 12\" ist bei 4+ bis zur nächsten Aktivierung betäubt.", "Sci-Fi"),

    // Sonderregeln der Gegner: Fantasy
    f("wiederkehr", "faehigkeit", "Wiederkehr", "Sonderregel", GEGNER, ["heilung", "furcht", "schatten"], "prozent", 20, "Stirbt das Modell, steht es bei 5+ am Ende der Runde mit 1 Lebenspunkt wieder auf.", "Fantasy"),
    f("rudeljaeger", "faehigkeit", "Rudeljäger", "Sonderregel", GEGNER, ["nahkampf", "staerkung"], "prozent", 10, "+1 Attacke je Nahkampfwaffe, wenn ein weiteres Modell derselben Fraktion dasselbe Ziel angreift.", "Fantasy"),
    f("steinhaut", "faehigkeit", "Steinhaut", "Sonderregel", GEGNER, ["schutz"], "prozent", 20, "Ignoriert Reißend und DS(1).", "Fantasy"),
    f("lebensentzug", "faehigkeit", "Lebensentzug", "Sonderregel", GEGNER, ["heilung", "nahkampf", "schatten"], "prozent", 10, "Einmal pro Runde: Verursacht das Modell im Nahkampf eine Wunde, heilt es 1 Wunde.", "Fantasy"),
    f("netzwerfer", "faehigkeit", "Netze spinnen", "Sonderregel", GEGNER, ["betaeubung", "fernkampf"], "prozent", 10, "Einmal pro Runde: Ein Feind in 9\" bewegt sich bei 4+ bis zu seiner nächsten Aktivierung nur halb so weit.", "Fantasy"),
    // Sonderregeln der Gegner: Sci-Fi
    f("nanoregeneration", "faehigkeit", "Nanoregeneration", "Sonderregel", GEGNER, ["heilung", "technik"], "prozent", 20, "Zu Beginn jeder Aktivierung heilt das Modell 1 Wunde.", "Sci-Fi"),
    f("selbstzerstoerung", "faehigkeit", "Selbstzerstörung", "Sonderregel", GEGNER, ["flaeche", "reaktion", "technik"], "prozent", 5, "Stirbt das Modell, erleidet jede Einheit in 3\" 1 Treffer mit DS(2).", "Sci-Fi"),
    f("energieschild-gegner", "faehigkeit", "Schildgenerator", "Sonderregel", GEGNER, ["schutz", "aura", "technik"], "prozent", 20, "Verbündete in 6\" erhalten +1 Verteidigung gegen Beschuss.", "Sci-Fi"),
    f("zielsystem", "faehigkeit", "Zielsystem", "Sonderregel", GEGNER, ["fernkampf", "technik"], "prozent", 10, "Alle Fernkampfwaffen des Modells sind Zielsuchend.", "Sci-Fi"),
    f("schwarmintelligenz", "faehigkeit", "Schwarmintelligenz", "Sonderregel", GEGNER, ["aura", "staerkung", "technik"], "prozent", 10, "Solange ein weiteres Modell derselben Fraktion in 6\" steht: Furchtlos und +1 auf Treffer.", "Sci-Fi"),

    // Zauber: Fantasy
    f("kettenblitz", "zauber", "Kettenblitz", "Zauber", ALLE, ["fernkampf", "flaeche", "magie"], "fest", 15, "Zauber (5+): Ein Feind in 18\" erleidet 2 Treffer, jeder weitere Feind in 3\" um ihn 1 Treffer.", "Fantasy"),
    f("wurzelgriff", "zauber", "Wurzelgriff", "Zauber", ALLE, ["betaeubung", "schwaechung", "magie"], "fest", 10, "Zauber (4+): Ein Feind in 12\" darf sich bei seiner nächsten Aktivierung nicht bewegen.", "Fantasy"),
    f("unsichtbarkeit", "zauber", "Unsichtbarkeit", "Zauber", FREUNDE, ["tarnung", "schutz", "magie"], "fest", 10, "Zauber (4+): Ein Verbündeter in 6\" kann bis zur nächsten Runde nicht aus mehr als 12\" beschossen werden.", "Fantasy"),
    f("totenerweckung", "zauber", "Totenerweckung", "Zauber", ALLE, ["beschwoerung", "magie", "furcht", "schatten"], "fest", 15, "Zauber (5+): Ein Skelett (Qualität 5+, Verteidigung 5+, Zäh 1, A1 Nahkampf) in 3\" aufstellen.", "Fantasy"),
    f("blutpakt", "zauber", "Blutpakt", "Zauber", ALLE, ["staerkung", "magie", "schatten"], "fest", 10, "Zauber (4+): Der Zauberer erleidet 1 Wunde. Ein Verbündeter in 6\" erhält bis Rundenende +1 Attacke je Waffe.", "Fantasy"),
    // Zauber: Sci-Fi (Psi-Kräfte)
    f("psiblitz", "zauber", "Psi-Blitz", "Psi-Kraft", ALLE, ["fernkampf", "magie", "technik"], "fest", 10, "Psi (4+): Ein Feind in 18\" erleidet 2 Treffer mit DS(2).", "Sci-Fi"),
    f("gedankenkontrolle", "zauber", "Gedankenkontrolle", "Psi-Kraft", ALLE, ["schwaechung", "magie", "technik"], "fest", 20, "Psi (5+): Ein Feind in 12\" greift bei seiner nächsten Aktivierung ein Ziel deiner Wahl an, falls möglich.", "Sci-Fi"),
    f("telekinese", "zauber", "Telekinetischer Stoß", "Psi-Kraft", ALLE, ["bewegung", "magie", "technik"], "fest", 10, "Psi (4+): Ein Modell in 12\" wird bis zu 6\" in beliebige Richtung versetzt.", "Sci-Fi"),
    f("stasisfeld", "zauber", "Stasisfeld", "Psi-Kraft", ALLE, ["betaeubung", "flaeche", "magie", "technik"], "fest", 15, "Psi (5+): Alle Einheiten in 3\" um einen Punkt in 12\" sind bis zu ihrer nächsten Aktivierung betäubt.", "Sci-Fi"),

    // Gegenstände: Fantasy
    f("rauchbombe", "gegenstand", "Rauchbombe", "Bombe", FREUNDE, ["tarnung", "einmalig"], "fest", 5, "Einmal: Bis zur nächsten Runde kann der Held nicht beschossen werden.", "Fantasy"),
    f("wurfnetz", "gegenstand", "Wurfnetz", "Ausrüstung", FREUNDE, ["betaeubung", "einmalig"], "fest", 5, "Einmal: Ein Feind in 6\" darf sich bei seiner nächsten Aktivierung nicht bewegen.", "Fantasy"),
    f("feuertopf", "gegenstand", "Feuertopf", "Bombe", FREUNDE, ["feuer", "flaeche", "einmalig"], "fest", 10, "Einmal: Alle Einheiten in 3\" um einen Punkt in 9\" erleiden W3 Treffer.", "Fantasy"),
    f("amulett-abwehr", "gegenstand", "Amulett der Abwehr", "Ausrüstung", FREUNDE, ["schutz", "magie"], "fest", 15, "Einmal pro Runde: Eine Wunde bei 5+ ignorieren.", "Fantasy"),
    f("plattenruestung", "gegenstand", "Plattenrüstung", "Ausrüstung", FREUNDE, ["schutz"], "fest", 10, "+1 Verteidigung, dafür 1\" weniger Bewegung.", "Fantasy"),
    f("ring-regeneration", "gegenstand", "Ring der Erneuerung", "Ausrüstung", FREUNDE, ["heilung", "magie"], "fest", 15, "Zu Beginn jeder Aktivierung bei 5+ 1 Wunde heilen.", "Fantasy"),
    // Gegenstände: Sci-Fi
    f("medi-injektor", "gegenstand", "Medi-Injektor", "Verbrauchsgut", FREUNDE, ["heilung", "einmalig", "technik"], "fest", 5, "Einmal: Als freie Aktion W3+1 Wunden heilen, auch bei einem Verbündeten in 1\".", "Sci-Fi"),
    f("stimpack", "gegenstand", "Stimpack", "Verbrauchsgut", FREUNDE, ["staerkung", "einmalig", "technik"], "fest", 5, "Einmal: Bis Rundenende Schnell und +1 Attacke je Nahkampfwaffe.", "Sci-Fi"),
    f("emp-granate", "gegenstand", "EMP-Granate", "Granate", FREUNDE, ["betaeubung", "flaeche", "einmalig", "technik"], "fest", 10, "Einmal: Alle Maschinen und Drohnen in 3\" um einen Punkt in 9\" sind bei 3+ betäubt, alle anderen bei 5+.", "Sci-Fi"),
    f("energieschild", "gegenstand", "Energieschild", "Ausrüstung", FREUNDE, ["schutz", "technik"], "fest", 10, "Einmal pro Runde: Einen Treffer mit DS ignorieren.", "Sci-Fi"),
    f("sprungmodul", "gegenstand", "Sprungmodul", "Ausrüstung", FREUNDE, ["bewegung", "technik"], "fest", 10, "Einmal pro Runde: statt zu gehen bis 12\" springen, auch über Gelände und Feinde.", "Sci-Fi"),
    f("scanner-visier", "gegenstand", "Scanner-Visier", "Ausrüstung", FREUNDE, ["fernkampf", "technik"], "fest", 5, "Feinde mit Tarnung verlieren ihren Vorteil gegen diesen Helden.", "Sci-Fi"),
  ];

  const STAERKEN = [
    { id: "klein", name: "Klein", fest: 5, prozent: 5 },
    { id: "mittel", name: "Mittel", fest: 10, prozent: 10 },
    { id: "gross", name: "Groß", fest: 15, prozent: 20 },
    { id: "elite", name: "Elite", fest: 20, prozent: 30 },
  ];
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
    return t;
  }

  const Katalog = { TAGS, FRAKTIONEN, GRUNDBESTAND, STAERKEN, TYPEN, PRAEGUNGEN, GEGENSAETZE, konflikt, tagsFuerWaffe };
  if (typeof module !== "undefined" && module.exports) module.exports = Katalog;
  else root.Katalog = Katalog;
})(typeof globalThis !== "undefined" ? globalThis : this);

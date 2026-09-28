/* Kartenschmiede – Katalog: Tags, Fraktionen und der Grundbestand der Datenbank.
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
  ];

  // Fraktionen: Name und Symbol gehören fest zusammen
  const fr = (id, name, icon, text) => ({ id, typ: "fraktion", name, icon, text, tags: [], fuer: ["hero", "companion", "enemy"], kosten: { typ: "fest", wert: 0 }, quelle: "Grundbestand" });
  const FRAKTIONEN = [
    fr("helden", "Helden", "sun", "Die Gruppe der Spieler, egal welchen Volkes."),
    fr("menschen", "Menschen", "shield", "Königreiche, Söldner und Ritterorden."),
    fr("elfen", "Elfen", "leaf", "Waldvölker, Bogenschützen und alte Magie."),
    fr("dunkelelfen", "Dunkelelfen", "eye", "Korsaren, Hexen und Schattenklingen."),
    fr("zwerge", "Zwerge", "hammer", "Bergfesten, Runenschmiede und Maschinen."),
    fr("orks", "Orks", "axe", "Kriegsbanden, Rohe Kraft und Blechpanzer."),
    fr("untote", "Untote", "skull", "Skelette, Geister und Nekromanten."),
    fr("daemonen", "Dämonen", "flame", "Beschworene Wesen aus Kristall und Feuer."),
    fr("urwild", "Urwild", "paw", "Parasiten, Pilzwesen und Bestien der Wildnis."),
    fr("saurier", "Saurier", "fang", "Echsenkrieger und urzeitliche Riesen."),
    fr("wilde-jagd", "Wilde Jagd", "moon", "Werwölfe und Jäger, die mit dem Mond kommen."),
    fr("frostvolk", "Frostvolk", "snow", "Eisriesen und Wanderer des ewigen Winters."),
  ];

  const f = (id, typ, name, art, fuer, tags, kostenTyp, wert, text, quelle = "Quest") =>
    ({ id, typ, name, art, fuer, tags, kosten: { typ: kostenTyp, wert }, text, quelle });
  const w = (id, name, zeile, tags, text) => ({ id, typ: "waffe", name, art: /Nahkampf/.test(zeile) ? "Nahkampf" : "Fernkampf",
    fuer: ["hero", "companion", "enemy"], tags, waffe: zeile, kosten: { typ: "fest", wert: 0 }, text, quelle: "Grundbestand" });
  const HELD = ["hero"], ALLE = ["hero", "companion", "enemy"], GEGNER = ["enemy", "companion"], FREUNDE = ["hero", "companion"];

  const GRUNDBESTAND = [
    // Skills der Quest-Helden (Blatt „Abilities“ in Chris' Tabelle). Probe auf den Wert des Skills, bei Fehlschlag 1 Power.
    f("schattenschritt", "faehigkeit", "Schattenschritt", "Skill", HELD, ["bewegung", "tarnung"], "fest", 10, "Skill, 1 Power: Bis zu 4\" bewegen. Endet die Bewegung in Deckung oder außer Sicht, +1 Verteidigung gegen Beschuss bis zur nächsten Aktivierung."),
    f("schwachstelle", "faehigkeit", "Schwachstelle", "Skill", HELD, ["nahkampf", "staerkung"], "fest", 10, "Skill, 1 Power: Einen Feind in 1\" wählen. Eigene Nahkampfangriffe gegen ihn erhalten DS(1) bis zum Ende der Aktivierung."),
    f("wunden-heilen", "faehigkeit", "Wunden heilen", "Skill", HELD, ["heilung"], "fest", 15, "Skill, 1 Power: Ein Verbündeter in 6\" heilt W3 Wunden."),
    f("strahlender-schutz", "faehigkeit", "Strahlender Schutz", "Skill", HELD, ["schutz"], "fest", 10, "Skill, 1 Power: Ein Verbündeter in 6\" erhält +1 Verteidigung gegen den nächsten Angriff vor der nächsten Aktivierung."),
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
    f("strahlende-aura", "faehigkeit", "Strahlende Aura", "Sonderregel", GEGNER, ["aura", "flaeche"], "prozent", 20, "Feinde innerhalb von 6\" erleiden am Ende jeder Runde einen automatischen Treffer mit DS(1).", "Selfmade"),
    f("gebrochene-ketten", "faehigkeit", "Gebrochene Ketten", "Sonderregel", GEGNER, ["einmalig", "staerkung"], "prozent", 10, "Einmal pro Spiel: Fällt das Modell unter die Hälfte seiner Lebenspunkte, aktiviert es sofort ein weiteres Mal.", "Selfmade"),
    f("sporenwolke", "faehigkeit", "Sporenwolke", "Sonderregel", GEGNER, ["gift", "flaeche", "reaktion"], "prozent", 10, "Stirbt dieses Modell, erhalten alle Einheiten in 3\" je 1 Treffer mit Gift.", "Vorschlag"),
    f("blutrausch", "faehigkeit", "Blutrausch", "Sonderregel", GEGNER, ["nahkampf", "staerkung"], "prozent", 10, "Sobald das Modell höchstens die Hälfte seiner Lebenspunkte hat, erhält jede Nahkampfwaffe +1 Attacke.", "Vorschlag"),
    f("brut", "faehigkeit", "Brut", "Sonderregel", GEGNER, ["beschwoerung"], "prozent", 20, "Am Ende jeder Runde bei 5+: Eine Einheit Giftmaden (oder eine andere Gewöhnliche Einheit derselben Fraktion) in 3\" aufstellen.", "Vorschlag"),
    f("schreckensschrei", "faehigkeit", "Schreckensschrei", "Sonderregel", GEGNER, ["furcht", "flaeche", "einmalig"], "prozent", 10, "Einmal pro Spiel: Alle Helden in 9\" legen sofort eine Moralprobe ab.", "Vorschlag"),
    f("phasenschritt", "faehigkeit", "Phasenschritt", "Sonderregel", ALLE, ["bewegung", "reaktion"], "prozent", 10, "Einmal pro Runde nach einem Angriff gegen dieses Modell: bei 4+ bis zu 3\" in beliebige Richtung versetzen.", "Vorschlag"),

    // Zauber: nur für Modelle mit Zauberer(X). Wurf auf den angegebenen Wert, bei Fehlschlag verpufft der Zauber.
    f("feuerball", "zauber", "Feuerball", "Zauber", ALLE, ["feuer", "flaeche", "fernkampf", "magie"], "fest", 15, "Zauber (4+): Alle Einheiten in 3\" um einen Punkt in 18\" erleiden W3 Treffer."),
    f("frostlanze", "zauber", "Frostlanze", "Zauber", ALLE, ["frost", "fernkampf", "schwaechung", "magie"], "fest", 10, "Zauber (4+): Ein Feind in 12\" erleidet 2 Treffer mit DS(1) und bewegt sich bis zu seiner nächsten Aktivierung nur halb so weit."),
    f("heilendes-licht", "zauber", "Heilendes Licht", "Zauber", FREUNDE, ["heilung", "magie"], "fest", 10, "Zauber (4+): Ein Verbündeter in 12\" heilt W3 Wunden."),
    f("schutzkreis", "zauber", "Schutzkreis", "Zauber", ALLE, ["schutz", "aura", "magie"], "fest", 15, "Zauber (5+): Alle Verbündeten in 6\" erhalten +1 Verteidigung bis zur nächsten Runde."),
    f("laehmungsfluch", "zauber", "Lähmungsfluch", "Zauber", ALLE, ["betaeubung", "magie"], "fest", 15, "Zauber (5+): Ein Feind in 12\" ist betäubt und darf sich bei seiner nächsten Aktivierung nur bewegen."),
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

  const Katalog = { TAGS, FRAKTIONEN, GRUNDBESTAND, STAERKEN, TYPEN, tagsFuerWaffe };
  if (typeof module !== "undefined" && module.exports) module.exports = Katalog;
  else root.Katalog = Katalog;
})(typeof globalThis !== "undefined" ? globalThis : this);

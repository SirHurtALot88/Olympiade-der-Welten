/* Kartenschmiede – Fähigkeiten-Datenbank (Grundbestand).
   Jede Fähigkeit hat feste Kosten, damit sie auf jeder Karte gleich viel kostet:
     kosten.typ "fest"    → Punkte obendrauf (Skills der Helden, Auren); Stufen nach Chris' „Punktelogiken“:
                            klein 5 · mittel 10 · groß 15 · elite 20
     kosten.typ "prozent" → Aufschlag auf die Formel (Sonderregeln der Gegner, wachsen mit der Einheit):
                            klein 5 · mittel 10 · groß 20 · elite 30
   Eigene Fähigkeiten kommen über die Seite dazu und liegen auf dem Server (kartenschmiede/faehigkeiten.json). */
(function (root) {
  "use strict";
  const f = (id, name, art, fuer, typ, wert, text, quelle = "Quest") => ({ id, name, art, fuer, kosten: { typ, wert }, text, quelle });
  const HELD = ["hero"], ALLE = ["hero", "companion", "enemy"], GEGNER = ["enemy", "companion"];

  const GRUNDBESTAND = [
    // Skills der Quest-Helden (Blatt „Abilities“ in Chris' Tabelle). Probe auf den Wert des Skills, bei Fehlschlag 1 Power.
    f("schattenschritt", "Schattenschritt", "Skill", HELD, "fest", 10, "Skill, 1 Power: Bis zu 4\" bewegen. Endet die Bewegung in Deckung oder außer Sicht, +1 Verteidigung gegen Beschuss bis zur nächsten Aktivierung."),
    f("schwachstelle", "Schwachstelle", "Skill", HELD, "fest", 10, "Skill, 1 Power: Einen Feind in 1\" wählen. Eigene Nahkampfangriffe gegen ihn erhalten DS(1) bis zum Ende der Aktivierung."),
    f("wunden-heilen", "Wunden heilen", "Skill", HELD, "fest", 15, "Skill, 1 Power: Ein Verbündeter in 6\" heilt W3 Wunden."),
    f("strahlender-schutz", "Strahlender Schutz", "Skill", HELD, "fest", 10, "Skill, 1 Power: Ein Verbündeter in 6\" erhält +1 Verteidigung gegen den nächsten Angriff vor der nächsten Aktivierung."),
    f("beute-markieren", "Beute markieren", "Skill", HELD, "fest", 10, "Skill, 1 Power: Einen sichtbaren Feind in 18\" wählen. Der nächste verbündete Angriff gegen ihn erhält +1 auf Treffer."),
    f("schlingenfalle", "Schlingenfalle", "Skill", HELD, "fest", 5, "Skill, 1 Power: Einen Fallenmarker in 3\" legen. Der erste Feind, der sich in 1\" bewegt, erhält 1 Treffer und ist bei 4+ beeinträchtigt. Dann Marker entfernen."),
    f("reihe-halten", "Die Reihe halten", "Skill", HELD, "fest", 10, "Skill, 1 Power: Bis zur nächsten Aktivierung erhalten Feinde in 3\" −1 auf Treffer gegen andere Verbündete."),
    f("schildstoss", "Schildstoß", "Skill", HELD, "fest", 5, "Skill, 1 Power: Ein Feind in 1\" erhält 1 Treffer. Bei bestandener STR-Probe 2\" zurückstoßen."),

    // Auren (Anführer, aus den OPR-Upgrades in Chris' Tabelle)
    f("aura-reissend", "Aura der Klingen", "Aura", ALLE, "fest", 15, "Verbündete in 6\" erhalten Reißend im Nahkampf."),
    f("aura-hinterhalt", "Pfadfinder", "Aura", ALLE, "fest", 10, "Verbündete Einheiten dürfen aus dem Hinterhalt kommen, wenn sie in 6\" von diesem Modell aufgestellt werden."),
    f("aura-sturm", "Sturmruf", "Aura", ALLE, "fest", 5, "Verbündete in 6\" bewegen sich beim Angreifen 2\" weiter."),

    // Sonderregeln von Chris' eigenen Gegnern (Blatt „Selfmade“)
    f("kristallsplitter", "Kristallsplitter", "Sonderregel", GEGNER, "prozent", 5, "Erleidet dieses Modell eine Wunde, erleidet der Angreifer bei einer 6 ebenfalls 1 Schaden.", "Selfmade"),
    f("saeureblut", "Säureblut", "Sonderregel", GEGNER, "prozent", 5, "Erleidet dieses Modell eine Wunde, erhält der Angreifer bei 5+ einen Treffer.", "Selfmade"),
    f("strahlende-aura", "Strahlende Aura", "Sonderregel", GEGNER, "prozent", 20, "Feinde innerhalb von 6\" erleiden am Ende jeder Runde einen automatischen Treffer mit DS(1).", "Selfmade"),
    f("gebrochene-ketten", "Gebrochene Ketten", "Sonderregel", GEGNER, "prozent", 10, "Einmal pro Spiel: Fällt das Modell unter die Hälfte seiner Lebenspunkte, aktiviert es sofort ein weiteres Mal.", "Selfmade"),

    // Vorschläge für weitere Gegner
    f("sporenwolke", "Sporenwolke", "Sonderregel", GEGNER, "prozent", 10, "Stirbt dieses Modell, erhalten alle Einheiten in 3\" je 1 Treffer mit Gift.", "Vorschlag"),
    f("blutrausch", "Blutrausch", "Sonderregel", GEGNER, "prozent", 10, "Sobald das Modell höchstens die Hälfte seiner Lebenspunkte hat, erhält jede Nahkampfwaffe +1 Attacke.", "Vorschlag"),
    f("brut", "Brut", "Sonderregel", GEGNER, "prozent", 20, "Am Ende jeder Runde bei 5+: Eine Einheit Giftmaden (oder eine andere Gewöhnliche Einheit derselben Fraktion) in 3\" aufstellen.", "Vorschlag"),
    f("schreckensschrei", "Schreckensschrei", "Sonderregel", GEGNER, "prozent", 10, "Einmal pro Spiel: Alle Helden in 9\" legen sofort eine Moralprobe ab.", "Vorschlag"),
    f("phasenschritt", "Phasenschritt", "Sonderregel", ALLE, "prozent", 10, "Einmal pro Runde nach einem Angriff gegen dieses Modell: bei 4+ bis zu 3\" in beliebige Richtung versetzen.", "Vorschlag"),
  ];

  const STAERKEN = [
    { id: "klein", name: "Klein", fest: 5, prozent: 5 },
    { id: "mittel", name: "Mittel", fest: 10, prozent: 10 },
    { id: "gross", name: "Groß", fest: 15, prozent: 20 },
    { id: "elite", name: "Elite", fest: 20, prozent: 30 },
  ];

  const Faehigkeiten = { GRUNDBESTAND, STAERKEN };
  if (typeof module !== "undefined" && module.exports) module.exports = Faehigkeiten;
  else root.Faehigkeiten = Faehigkeiten;
})(typeof globalThis !== "undefined" ? globalThis : this);

# Formkarten zählen in allen Disziplinen + Farbbonus je Spieler (18.11.)

Zwei Befunde von Chris aus dem Live-Spiel (Einsatzliste, Saison 1, Spieltag 1).

## A) „zählt hier noch nicht“ in Arena-Disziplinen

**Befund (Climbing, D1):** Unter den Formkarten stand „zählt hier noch nicht“ und „In dieser
Arena-Disziplin zählt die gespielte Karte noch nicht — der Motor nimmt eine Ersatzkarte.“ Chris:
„das auch noch fixen, dass die Karten nicht zählen“.

**Ursache.** P4 (`docs/design/formkarten-motor-p4-11-11.md`) hat das Rohr Einsatzliste → Motor gebaut
(`buildArenaAufstellung` schreibt `form`/`intensitaet` in den `place`-Eintrag, der Motor liest es in
`breitPunkteVon()`), aber nur für die Disziplinen in `FORMKARTEN_ECHT_DISCIPLINE_IDS` freigeschaltet —
bis heute nur `time-trial` und `spurt`. Der Rollout für die übrigen stand als Fahrplan (Wellen 1–4) im
P4-Dokument und wurde nie fortgesetzt. Betroffen waren im Battle-Modus:

| Pfad | Disziplinen | Karte kam an? |
|---|---|---|
| Duell (`ARENA_RESOLVED_DISCIPLINE_IDS`) | gewichtheben, speed-schach, showcase, eiskunstlauf, breaking, wettessen, tennis, fechten, staffel, takeshis-castle, climbing, basketball, i-spy, hockey, tdm, football | nein (Ersatzkarte), Hinweis stand da |
| Bahn-Pod (Staffel/Takeshi an Pod-Spieltagen) | staffel, takeshis-castle | nein |
| Battlefield-Pod (Gefecht je Ort) | battlefield | **nein — und die Einsatzliste zeigte trotzdem „zählt“** (Battlefield steht nie in `ARENA_RESOLVED_DISCIPLINE_IDS`, `formkartenBuchung` prüfte nur diese Menge) |
| Mini-DM-FFA-Pod | mini-dm | **nein — ebenfalls als „zählt“ angezeigt**; zusätzlich fehlte hier das Rohr: `spieleMiniDmFfaEvent()` reicht `platzJeTeam` nur an die Rollenwahl, nicht an `place` |

**Behebung.**
1. `lib/battle/formkarten-echt-disziplinen.ts`: alle zwanzig Disziplinen in der Menge (jede ist im
   Battle-Modus motor-gebucht). Rollback einer Disziplin bleibt eine Zeile.
2. Motor (`battle-mode.engine.js`): `FORM_POD` — während eines Mini-DM-FFA-Events hält eine Map die
   `form`-tragenden Einträge aus `platzJeTeam`; `formEchtVon()` liest sie nach `FORM_MESS` und vor `place`.
   Ohne `form` im Eintrag ist die Map `null` — bit-identisch. Bahn-Pod und Battlefield-Pod übernehmen die
   `place`-Einträge ohnehin ganz (`place[name]=pl[name]`), dort reicht die Freischaltung.
3. `formkartenBuchung` prüft jetzt „wird aus dem Motor gebucht“ (`wirdAusMotorGebucht`: die Duelle plus
   die Pods Battlefield/Mini-DM) statt nur `ARENA_RESOLVED_DISCIPLINE_IDS`. Fehlt künftig eine
   motor-gebuchte Disziplin in der Echt-Menge, kommt der ehrliche Hinweis zurück; der Wächter-Test
   `tests/formkarten-alle-disziplinen.test.ts` schlägt dann schon vorher an.
4. Messschalter: `mdffaFormkartenFuer()` zieht im Modus `echt` (nur Messung) das Einsatzlisten-Szenario
   auch für Pod-Teams; die drei Pod-Abnahmeskripte lesen `OLY_FORM_MODUS`.

**Gezeigt = gebucht.** Vorschau (`berechneKartenWirkung`), Motor-Eingabe (`buildArenaAufstellung`),
Eingabe-Hash, Vorlauf, Pods und Arena-Anzeige rechnen dieselbe Zahl aus derselben Funktion
(`calculateFormModifierForSide`, Farbregel je Spieler). Der neue Test prüft je Spieler Vorschau = `form`
für Climbing, Battlefield, Basketball und Mini-DM.

**Vorlauf-Cache.** Der Arena-Eingabe-Hash enthält die Aufstellung (jetzt mit `form`) und den Hash der
Motor-Datei. Ein bereits gerechneter Vorlauf (mit Ersatzkarte) weicht deshalb nach dem Deploy ab; beim
Buchen greift die bestehende Divergenz-Prüfung (`resolveMatchdayPreviewToBook`), bucht den alten
Snapshot nicht und stößt einen neuen Vorlauf an. Nichts von Hand nötig.

**Wertungs-Fingerabdruck:** s. Abschnitt C.

## B) Farbbonus: wer bekommt ihn?

**Befund (Battlefield, D2, Disziplinfarbe SOC):** Mental-Karte +8 von Duskwhisper, Anzeige
„fremd: +4 alle, +4 Farbe“. Auf dem Feld Kati, Ferdinand Lionfist, Wildfire — alle +4, Summe +12,
„Farbe ±0“. Chris: „Ich würde vermuten Wildfire ist blau? Dann müsste sie doch +4 und +4 bekommen?“

**Regel (Code: `kartenZerlegungFuerSpieler`, `lib/lineups/formkarten-farbregel.ts`):**
- **alle:** jeder aufgestellte Spieler; Kartenfarbe = Disziplinfarbe → voller Wert, sonst halber.
- **Farbbonus:** zusätzlich halber Kartenwert, aber **nur für Spieler, deren Klasse die Kartenfarbe hat**
  (Klassenfarbe, `CLASS_COLOR_MAP`). Rolle auf dem Feld und Disziplinfarbe spielen dafür keine Rolle.
- MEN (blau): Mage, Overseer, Templar · SOC (gelb): Bard, Hero, Badass, Tactician · POW (rot):
  Berserker, Warlord, Tank · SPE (grün): Sprinter, Rogue, Charger.

**Nachgesehen:** Wildfire ist **Tactician = SOC (gelb)**, nicht blau. Kati ist Bard (SOC), Ferdinand
Lionfist Warlord (POW). Keiner der drei ist MEN → je +4 (8 × 0,5), Farbbonus ±0, Summe +12.
**Die Rechnung ist korrekt, kein Bug.** Die Anzeige war missverständlich: „+4 Farbe“ las sich wie
„Disziplinfarbe“ oder „für alle“.

**Anzeige jetzt:**
- Dropdown/Chip: „fremd: +4 alle, +4 extra für MEN-Spieler“ (Farbe ausdrücklich genannt).
- Team-Summe: Satz „Farbbonus MEN nur für Mage, Overseer, Templar — keiner aufgestellt“ (bzw. „1 aufgestellt“).
- Tabelle „Wer bekommt“: neue Spalte **Klasse** mit Klassenfarbe; Tooltip je Spieler, z. B.
  „kein Farbbonus: Tactician ist SOC, Karte MEN“ bzw. „Farbbonus +4: Mage ist MEN wie die Karte“.
  Derselbe Grund steht im Tooltip der Karten-Marke am Platz und in der Kader-Spalte „Karte“.

**Erklärung für Chris (kurz):** Eine Formkarte hat zwei Teile. (1) **Für alle:** jeder Aufgestellte
bekommt sie — voll, wenn die Kartenfarbe zur Disziplin passt, sonst halb. Battlefield ist SOC, die Karte
MEN, also 8 × ½ = +4 für jeden. (2) **Farbbonus:** noch einmal halber Kartenwert, aber nur für Spieler,
deren **Klasse** die Kartenfarbe hat. MEN-Klassen sind Mage, Overseer, Templar. Wildfire ist Tactician und
damit SOC (gelb), Kati Bard (SOC), Ferdinand Warlord (POW) — niemand MEN, also kein Farbbonus: 3 × +4 = +12.
Hätte Duskwhisper (Mage) selbst gespielt, bekäme er +8. Besser für diese Aufstellung wäre eine SOC-Karte
gewesen: +8 für alle, Kati und Wildfire je +4 extra = +32.

## C) Messung und Prüfungen

(wird unten ergänzt)

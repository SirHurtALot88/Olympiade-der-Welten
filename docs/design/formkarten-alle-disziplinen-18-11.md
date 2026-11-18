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

**Wertungs-Fingerabdruck:** `node scripts/pruefe-wertung-fingerabdruck.mjs` auf Basis (`claude/sammel-merge-18-11`)
und Branch im selben Lauf: **GESAMT `ce8fcef66028` (75 Einträge), alle 75 Zeilen identisch.** Der Fingerabdruck
setzt kein `form` in `place`, er beweist also den bit-identischen Rückfall (inkl. `FORM_POD = null` in Mini-DM und
des Messschalters, der im Spielmodus `ersatz` nichts anfasst). Die absichtliche Wertungsänderung — im echten
Spieltag kommt jetzt die gespielte Karte statt der Ersatzkarte an — zeigt sich nur mit einer Einsatzliste und ist
durch die Abnahme unten gedeckt. `origin/main` (bis #1622) ändert weder Motor noch Kartenwertung.

**Rangtreue mit echten Karten** (`OLY_FORM_MODUS=echt node scripts/miss-alle-disziplinen.mjs 24 <d>`, Kader-Familie
live-save, 5 Paarungen × 24 Spiele, Median; Mess-Szenario P4 2.1: bewusst breit, −16…+32 je Seite, also strenger als
die neue Farbregel mit −12…+26). „Ersatz vorher“ = Kopfwert in `data/generated/disziplin-abnahme.json`.

| Disziplin | Chassis | rho je Spiel echt | Spannweite | rho Saison | Ersatz vorher | Abnahme (≥ 0,75) |
|---|---|---:|---:|---:|---:|---|
| staffel | Bahn | 0,958 | 0,032 | 0,986 | 0,957 | besteht |
| eiskunstlauf | Bühne | 0,926 | 0,044 | 0,972 | 0,927 | besteht |
| wettessen | Bühne | 0,921 | 0,125 | 0,965 | 0,905 | besteht |
| speed-schach | Bühne | 0,918 | 0,088 | 0,979 | 0,904 | besteht |
| tdm | Arena | 0,900 | 0,068 | 0,958 | 0,839 | besteht |
| gewichtheben | Bühne | 0,887 | 0,053 | 0,930 | 0,892 | besteht |
| fechten | Bühne | 0,870 | 0,056 | 0,958 | 0,876 | besteht |
| basketball | Feldspiel | 0,864 | 0,131 | 0,888 | 0,862 | besteht |
| tennis | Bühne | 0,861 | 0,067 | 0,965 | 0,885 | besteht |
| breaking | Bühne | 0,853 | 0,171 | 0,881 | 0,860 | besteht |
| takeshis-castle | Bahn | 0,844 | 0,098 | 0,963 | 0,838 | besteht |
| i-spy | Bühne | 0,831 | 0,119 | 0,958 | 0,845 | besteht |
| football | Feldspiel | 0,818 | 0,159 | 0,888 | 0,854 | besteht |
| showcase | Bühne | 0,812 | 0,161 | 0,965 | 0,781 | besteht |
| climbing | Bahn | 0,789 | 0,201 | 0,806 | 0,801 (n=48) / 0,797 (n=24) | besteht, unter Ziel 0,80 (wie vorher) |
| hockey | Feldspiel | 0,656 (Feldspieler 0,707) | 0,184 | 0,755 | 0,700 (Feldspieler 0,784) | unter 0,75 — wie vorher durch Chris' rho-Ausnahme gedeckt |

Jede Bewegung liegt innerhalb der eigenen Kaderfest-Spannweite. **Hockey ist der einzige Fall zum Hinschauen:**
schon mit Ersatzkarte unter der Mindestschranke (Ausnahme `ARENA_ABNAHME_AUSNAHMEN`, deckt rho), mit echten Karten
0,044 tiefer (Feldspieler 0,077). Rückweg, falls Chris das nicht will: Zeile `"hockey"` aus
`FORMKARTEN_ECHT_DISCIPLINE_IDS` nehmen — dann kehrt in der Einsatzliste für Hockey ehrlich „zählt hier noch nicht“
zurück.

**Pods mit echten Karten** (Pod-Skripte, `OLY_FORM_MODUS=echt`, Szenario je Pod-Team, zwei Saatströme):

| Pod | rho je Kampf/Rennen/Event (Median, Strom 0 / 10 000 000) | Star #1 | Bemerkung |
|---|---|---:|---|
| Battlefield (k = 4, 30 Gruppen × 4) | 0,879 / 0,866 | 63–70 % | vorher 0,874–0,917, besteht |
| Staffel-Pod (210 Gruppen × 6) | 0,963 / 0,962 | 71 % | besteht |
| Takeshi-Pod (210 Gruppen × 6) | 0,883 / 0,877 | 79 % | besteht |
| Mini-DM-FFA (210 Gruppen × 6) | Event 0,709 / 0,704, Runde 0,800 / 0,800 | 79 % | vorher 0,608–0,686 je Event, Chris' Stern-/Paartreue-Freigabe (24.10.) gilt weiter; Star/Paare unverändert gut |

**Pp-Abweichung mit echten Karten:** s. Abschnitt D.

**Tests:** `tests/formkarten-alle-disziplinen.test.ts` (neu), `formkarten-echt-motor`, `form-moral-bau`,
`formkarten-farbregel`, `staffel-wechsel-paar-bonus-service` und `battlefield-rollen-je-kadergroesse` (Erwartung um
`form: 0, intensitaet: "normal"` ergänzt — ohne Karte ist das die echte Wahl „keine Karte“, nicht die Ersatzkarte),
CI (inkl. arena-chromium-tests) grün. Ein Entwurfseintrag ohne `disciplineSide` (alte Stände, Testkader) bleibt
`{d, slot}` statt zu werfen.

## E) Mutator = Form, keine Punkte (Chris 18.11., Folge-Commit)

Chris, wörtlich: „Mutator-Punkte zählen nicht mehr für Team-Punkte, also keine 2,3 für einen Sieg oder so, das gibt
es in dem Modus nicht mehr! Mutatoren sorgen nur noch für eine bessere Form der Spieler, wo es triggert.“

**Vorher im Battle-Modus:** Motor-Seiten (Duelle, Pods) hatten seit 29.09. keinen flachen Aufschlag mehr; der
Mutator wirkte dort im Motor (+3,5 auf jedes Attribut je Treffer). Die **anderen** Battle-Seiten buchten weiter:
PPS-Duell-Brücke +6 Score je Treffer, eine Seite ohne Arena-Ergebnis und ohne Fixture +6 Score **und +0,3 PP**
(daher „2 + 0,3 = 2,3“), und die Einsatzlisten-Vorschau rechnete im Battle-Modus immer mit +6.

**Jetzt** (`lib/battle/battle-mutator-organisch.ts`, Schalter `OLY_MUTATOR_ALS_FORM`, Standard an):
- Battle-Modus: auf **keiner** Seite mehr Score- oder PP-Aufschlag (`toBattleArenaOrganicMutatorResult` für alle
  Battle-Seiten im Resolve und in der Vorschau). Die Trefferzahl (`mutatorHits`) bleibt stehen.
- Motor-Seiten: unverändert, der Schub entsteht im Motor (+3,5 Attribut je Treffer = +3,5 Eignungspunkte, weil
  sich die Matrixgewichte auf 100 summieren). Darum bewegt sich der Fingerabdruck nicht, und rho/Pp der
  motor-gebuchten Disziplinen bleiben, was sie sind.
- Legacy-gewertete Battle-Seiten (PPS-Duell, Rückfall ohne Arena-Ergebnis) und die Vorschau: Formschub
  **+3,5 je Treffer** für genau den getroffenen Spieler, über denselben Kanal wie die Formkarten
  (`formByPlayerId[id].summe`, Feld `mutator`; `mitMutatorForm`). Wie jede Form bekommt er die Tagesform ±4 dazu.
  Höhe bewusst gleich dem Motor-Schub: ein Treffer bedeutet überall dasselbe, +3,5 statt bisher +6 Score
  (kleiner, damit eher rho-neutral).
- Manager-Modus: unverändert (+6 Score / +0,3 PP).
- Anzeige: Spieltagswertung — die Mutator-Spalte bleibt im Battle-Modus leer (keine Mutator-PP mehr gebucht);
  am Spieler-Chip steht „◆ Form +3,5“, im Tooltip „Mutator getroffen: Form +3,5 (keine Punkte)“.
- Gebuchte Spieltage: nicht umgebucht. Score und PP stehen gespeichert in Ergebnis- und Leistungsdatensätzen;
  die Regel greift ab dem nächsten gewerteten Spieltag. Ein Saison-Stempel ist deshalb nicht nötig.
- Tests: `tests/battle-mutator-organisch.test.ts` (nicht simulierte Battle-Seite: keine +6/+0,3, Form +3,5 am
  Getroffenen; Rückfall ohne Override ebenso; Schalter `=0` holt den alten Weg zurück; Manager unverändert).

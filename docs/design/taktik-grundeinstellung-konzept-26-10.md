# Taktische Grundeinstellung (defensiv · neutral · offensiv) — Konzept (Opus, 26.10.)

Chris (Sprachnachricht, 26.10.): „Was ich vielleicht für später noch im Hinterkopf habe, ist so
eine Grundtaktikeinstellung, dass man quasi angeben kann, ob man defensiv, neutral oder offensiv
spielt. Und dass dann gegebenenfalls für das ganze Team, was eingesetzt wird, so eine gewisse
Taktikverschiebung quasi noch gibt. Also zum Beispiel, dass dann mehr die Offensive gefordert
wird, dass dann, weiß ich nicht, wenn Mini-Deathmatch, Mini-Torment sogar noch ein bisschen
stärker ist, wenn du defensiv wählst, ist dann der Health zum Beispiel ein bisschen stärker. Dass
man da einfach so Grundeinstellungen hat, die aber sich unterschiedlich auswirken pro Disziplin,
dass man auch sieht, was sind die Faktoren, also welche Attribute fließen da am meisten rein,
damit ein Trainer das auch abschätzen kann, ob das Sinn macht, aber vielleicht ohne direkt zu
sagen, ja, das gibt plus 3, weil sonst ist das wieder nur so ein Stat-Ding. Und das soll jetzt
nicht Stat-based sein, das soll also wirklich Taktik-based sein, dass sich das auf dem Feld
auswirkt. Zum Beispiel, wenn ich jetzt offensiv bin beim Climbing, dann versuchen meine Spieler
vielleicht eher andere herunterzutreten oder sonst was. Wenn ich defensiv bin, versuche ich eher
von anderen wegzukommen und nicht zu kämpfen oder sonst was. Aber das könnte mich dann dadurch
auch wieder Zeit kosten. […] Ich sage jetzt noch nicht in die Umsetzung gehen, aber auf jeden
Fall mal sowas vorbereiten, was man da machen könnte."

**Dieses Dokument ist reines Konzept.** Kein Produktionscode, keine Motoränderung, keine neue
Mechanik. Die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) ist
gesperrt (CLAUDE.md) und wird hier weder angefasst noch umgedeutet; auch kein Vorschlag in diesem
Papier setzt sie voraus. `engine.js` meint `public/mockups/battle-mode.engine.js` auf `main`
`5d4982e3` (26.10.); Zeilennummern beziehen sich auf diesen Stand. Wo eine Zahl steht, ist sie aus
dem Repo zitiert (Datei oder `data/generated/disziplin-abnahme.json`), nicht neu gemessen.

## Kurzfassung

- **Alle zwanzig angeschaut. Ergebnis: 12 mit klarem Ansatzpunkt, 4 mit Ansatzpunkt hinter einer
  Vorbedingung, 2 nur als Tempo-Voreinstellung ohne Gegnerbezug, 2 ohne sinnvollen Ansatzpunkt.**
  Klar: Climbing, Spurt, Staffel, Takeshi's Castle, Gewichtheben, Breaking, Speed-Schach, Mini-DM,
  TDM, Battlefield, Football, Basketball. Mit Vorbedingung: Hockey (RNG-Kaskade), Tennis und
  Fechten (rho-Puffer dünn, Entscheidungspfad fehlt), I-Spy (rho 0,750, noch nicht abgenommen).
  Nur Tempo-Voreinstellung: Time-Trial, Wettessen. Kein Ansatz: Showcase, Eiskunstlauf
  (Abschnitt 5).
- **Der wichtigste Befund: die Rohre liegen schon.** In dreizehn der zwanzig Disziplinen steht
  heute bereits eine abgestufte Entscheidung je Spieler im Motor, die von „vorsichtig" bis
  „draufgehen" reicht (Tabelle 0.2) — die fünf
  Rennpläne der Bahn (`BAHN_ART.*.plaene`/`planJeSlot`), die Haltungen von Staffel
  (`STAFFEL_MARKE`, absichern/normal/angreifen), Speed-Schach (`SCHACH_ANSAGEN`) und Wettessen
  (`WETTESSEN_HALTUNGEN`), die Persönlichkeits-Haltung des Kampf-Chassis (`HALTUNG`,
  defensiv…ungestüm) und die Feldspiel-Taktik-Karte (`FELDSPIEL_ART.basketball.taktik`). Fast
  überall wird diese Entscheidung heute aus Slot oder Persönlichkeit abgeleitet; der Manager hat
  keinen Zugriff. **Die Grundtaktik ist deshalb zum größten Teil keine neue Mechanik, sondern eine
  Team-Verschiebung bestehender Entscheidungen** — und genau das macht sie zu Taktik statt Stat:
  sie ändert, *was* ein Spieler tut, nicht *wie gut*.
- **Wo die Entscheidung von Natur aus eine Team-Entscheidung ist, greift die Grundtaktik direkt:**
  Remis-Politik im Speed-Schach (S-F1 existiert, `SCHACH_REMIS_*`), vierter Versuch im Football
  (`waehleVierterVersuch()`), Abwarten oder Zuschlagen im Mini-DM-FFA, Punkt nehmen oder halten in
  Battlefield, Mannschaftslage beim Gewichtheben (`hebenTeamLage()`).
- **Chris' Wunsch „defensiv → Health stärker" geht — aber als Tendenz im Pp-Budget, nicht als
  Umgewichtung.** Wenn defensives Mini-DM länger dauert, entscheiden Halten und Ausdauer öfter;
  das verschiebt die *gemessenen* Attributanteile. Die Pflichtprüfung (Pp ≤ 25, CLAUDE.md) gilt
  dann für **jede** der drei Einstellungen. Wie stark eine Disziplin kippen darf, bestimmt ihr
  heutiger Pp-Spielraum: Mini-DM (8,7/9) hat viel Luft, Staffel (21,1/22) fast keine (Tabelle 2).
- **Drei Knöpfe, die alle nach „mehr Risiko" klingen, sind die echte Gefahr.** Es gibt schon die
  Intensität (Schonen/Normal/Pushen, wirkt auf Ermüdung) und das Haltungsfeld je Spieler
  (Grundgerüst der Konsultation 02.10., `place[n].haltung`). Vorschlag: Grundtaktik ist die
  **Team-Voreinstellung** je Disziplin-Seite; eine Einzel-Haltung übersteuert sie; Intensität
  bleibt eigene Achse mit eigenem Namen (Abschnitt 1, Frage 1 in Abschnitt 9).
- **Der Trainer sieht Faktoren als Worte, nicht als Zahlen:** je Disziplin und Stufe zwei, drei
  Attribute mit „wird wichtiger / tritt zurück", automatisch aus dem Rezept abgeleitet, plus eine
  Anweisungsbilanz nach dem Spiel („3 Herunterzieh-Versuche, 2 gesessen, 1,5 s bezahlt"). Ohne
  diese Bilanz wäre die Grundtaktik das „Formular", vor dem `fable-ideen-feldspiel-30-09.md` 2.1
  warnt (Abschnitt 6).
- **Ausgearbeitet in Abschnitt 3:** Climbing, Mini-DM, Staffel, Speed-Schach, Football. Die übrigen
  dreizehn als Kurzskizze in Abschnitt 4, die zwei ohne Ansatz in Abschnitt 5.

---

## 0. Was schon da ist — nachgelesen

### 0.1 Zwei Knöpfe gibt es schon, einer davon wirkt in der Arena nicht

| Knopf | Wo | Was er tut | Quelle |
|---|---|---|---|
| **Intensität** Schonen/Normal/Pushen | Einsatzliste je Disziplin-Seite (`d1`/`d2`), `lib/lineups/legacy-lineup-board-props.ts:243`, `legacy-lineup-preview-from-context.ts:212` | Mittelwertverschiebung im PPS-Pfad (`INTENSITY_SCORE_RANGE`) plus Ermüdung ×1,4 bei Pushen. In der Arena kommt sie laut Code-Lesung der Konsultation 02.10. nicht an (Übergabe trägt nur `{d, slot}`). | `manager-risiko-interaktivitaet-konzept-02-10.md` Befund A |
| **Haltung je Spieler** (Absichern/Normal/Angreifen bzw. disziplineigene Wörter) | Übergabefeld `place[n].haltung` (`lib/foundation/battle-arena/arena-aufstellung-adapter.ts:37-55`), gelesen von `buehneHaltungVon()` (`engine.js:19045`) | Speed-Schach und Wettessen lesen es; die Einsatzliste füllt es **noch nicht** („das Rohr steht, die Buchse in der Einsatzliste folgt"). | Konsultation 02.10., Zeile 0 „Grundgerüst" |

Die Grundtaktik wäre der **dritte** Knopf. Abschnitt 1 schlägt vor, wie die drei zueinander
stehen, ohne dass zwei davon „Push" heißen.

### 0.2 Wo die dreistufige Entscheidung heute schon im Motor steht

| Disziplin | Entscheidung im Motor | Stufen (vorsichtig → riskant) | Wer entscheidet heute | Fundstelle |
|---|---|---|---|---|
| Spurt | Rennplan | Windschatten · Von vorn · Schlusssprint (Tempo/Reserve-Profil) | Slot (`planJeSlot`) | `engine.js:43449-43458` |
| Time-Trial | Rennplan | Gleichmaß · Negativ-Split · Attacke | Slot | `engine.js:43724-43733` |
| Climbing | Rennplan + Kreuzungsgriff | Sparsam · Stetig · Durchziehen; Herunterziehen **immer**, wenn vorn und nah | Slot; Zug automatisch | `engine.js:44068-44077`, `43864`, `46795-46838` |
| Staffel | Marke (Wechsel) + Zug (Bein) | absichern · normal · angreifen | Persönlichkeit (`STAFFEL_PERS_HALTUNG`), live seit #1154 | `engine.js:46042-46110` |
| Takeshi's Castle | Rennplan + Rempler | Vorsichtig · Beherzt · Kopf voran; Rempeln ab `tackleAb` | Slot; WUCHT-Schwelle | `engine.js:44523-44532`, `44251` |
| Gewichtheben | Eröffnung/Sprünge/kühner Versuch | Rolle („Safe Lift" … „Pressure Lift"), Mannschaftslage sichern/öffnen | Slot + `hebenTeamLage()` | `engine.js:20281-20288`, `20473-20475`, `lastFuer()` `24474` |
| Breaking | Provokation | ab WAGNIS ≥ 58 fordert der Ertragende das nächste Gerät früher | Sub-Skill-Schwelle | `engine.js:25563-25564` |
| Speed-Schach | Tempo-Ansage + Remis | rechnen · normal · blitzen; Remis ab Zug 8 bei Teamlage | Zeitbudget-Regel; Teamstand | `engine.js:19094-19137` |
| Wettessen | Haltung | gleichmäßig · schlussspurt · sprint | NERVEN (`wettessenKiHaltung()`) | `engine.js:19309-19390` |
| TDM, Battlefield, Mini-DM (4er) | Persönlichkeits-Haltung + Befehl | defensiv · vorsichtig · ausgewogen · offensiv · ungestüm; Befehle decken/hinter/mitlinie/flanke/verfolgen | Persönlichkeit (`PERSDEF`), manuelle `takt` gehen vor | `engine.js:7306-7460`, Rückzug `39197-39208` |
| Basketball | Taktik-Karte | Angriff Tempo/Halbfeld/Innen; Bretter Angreifen/Zurück; Verteidigung … | KI-Vorgabe, **von keiner Mechanik gelesen** | `engine.js:8646`, `10016-10055` |

Fünf weitere tragen eine Team-Entscheidung, die heute fest oder situativ ist: Football (vierter
Versuch, Lauf/Pass-Anteil, `engine.js:11801-11832`), Hockey (Führungs-Riegel nur in der Endphase,
`engine.js:11144-11220`), Mini-DM-FFA (Zielwahl, Zweckbündnis, `mdffaSchlagwechsel()`
`engine.js:53827`), Battlefield (Kontrollpunkt, `ARENA_DOMINATION` `engine.js:8482`), I-Spy
(Raumwahl und Reaktion auf fremde Funde, `ispyWaehleRaum()`/`ispySeiteTick()` `engine.js:25134,
25155`).

### 0.3 Was frühere Runden über solche Knöpfe gelernt haben

Jede dieser Lehren ist gemessen, nicht vermutet, und jede gilt für die Grundtaktik genauso:

1. **Eine „kluge" Standardwahl kann rho kosten, ohne dass irgendetwas kaputt ist.** I-Spy-Raumwahl
   (15.10., `stand-aller-disziplinen.md` Abschnitt 11): die Argmax-KI als Standard senkte rho je
   Spiel von 0,750 auf 0,700, getragen von einer einzigen Kaderpaarung. Lösung: der Standard
   bleibt bit-identisch, die Wahl ist eine Option.
2. **Toter Knopf und Pflichtknopf sind dieselbe Falle.** Wettessen K2 (04.10., Kommentar bei
   `WETTESSEN_SPRINT_*`): der erste Parametersatz machte Sprint für 7 % der Esser zur besten Wahl,
   Schlussspurt für 69 %. Kalibrierkriterium seither: jede Stufe ist für mindestens ein Fünftel die
   beste, und die beste Stufe hängt an einem Sub-Skill, nicht an der Eignung.
3. **Die KI-Vorgabe ist Teil der Mechanik, nicht Beiwerk.** Speed-Schach (Kommentar vor
   `SCHACH_UHR_START`): die naive Regel „schnelle Hände blitzen" trieb Pp auf 21,6.
4. **In Live-Motoren verschiebt jede Positionsänderung die Zufallsfolge.** Hockeys Puste ist
   sichtbar, aber auf Faktor 1 gesetzt, weil jede Tempoänderung die `versucheSteal`-Kaskade
   verschiebt und rho um 0,04–0,05 kostet (`fable-ideen-feldspiel-30-09.md` 1.2). Football hat das
   Problem nicht — seine Ergebnisse entstehen in `resolveLauf`/`resolvePass`, die Bewegung ist
   Optik (dort F2).
5. **„Alle gleich" ist ein Extremfall, kein Normalfall.** Staffel O2 (#1154): mit der
   Persönlichkeits-Automatik stieg rho im Mittel (0,895 → 0,937), aber ein einzelner Kader
   (Sentinel vigilante-armageddon) blieb in allen Extremvarianten unter 0,80 (0,756), Star auf
   Rang 1 fiel 69 → 61 %.
6. **Eine Wahl, deren Wirkung niemand sieht, ist ein Formular.** Die Feldspiel-Taktik-Karte
   (15.10.) ist deshalb bewusst nur Fundament geblieben: kein „Spiel des Tages"-Replay, also keine
   Manager-UI (`feldspiel-taktik-karte-fundament-15-10.md` 1.1, 3).

---

## 1. Was „Grundtaktik" in diesem Konzept heißt — sieben Regeln

Die Regeln übernehmen die fünf Designregeln der Konsultation vom 02.10.
(`manager-risiko-interaktivitaet-konzept-02-10.md`, „Designregeln für alle 20 Disziplinen") und
ergänzen zwei, die erst durch die Team-Ebene nötig werden.

1. **Neutral ist bit-identisch.** Wer nichts wählt, spielt exakt den heutigen Motor —
   gleiche Entscheidungen, gleiche `rr()`-Zahl, gleicher Rohdaten-Hash der Sonde. Das ist
   zugleich die Garantie, dass die bestehende Abnahme jeder Disziplin unverändert gilt.
2. **Verhalten, nicht Wert.** Die Prüffrage für jeden Vorschlag: *Lässt sich die Wirkung als
   „+x auf Attribut y" ausdrücken? Dann ist es ein Stat-Ding und fliegt raus.* Erlaubt ist nur,
   eine **Entscheidung** zu verschieben (welche Aktion, wann, gegen wen) — und jede verschobene
   Entscheidung zahlt in einer anderen Währung (Zeit, Reserve, HP, Fehlversuchs-Risiko). Das ist
   Fables „Zwei Währungen"-Prinzip (`fable-ideen-bahn-30-09.md` 1.1) auf Team-Ebene.
3. **Verschieben, nicht ersetzen.** Wo es heute schon eine Stufe je Spieler gibt (Rennplan,
   Persönlichkeits-Haltung, Staffel-Haltung), rückt die Grundtaktik jeden Spieler **um eine Stufe**
   — sie setzt nicht alle auf dieselbe. Der Kletterer im Slot „Paceclimber" bleibt sparsamer als
   der im Slot „Dynamic Move", auch offensiv. Das ist dieselbe Schichtung, die das Kampf-Chassis
   seit jeher hat: „Der Befehl VERSCHIEBT sie, er ersetzt sie nicht" (`engine.js:7327`). Es hält
   außerdem die Lehre 5 aus 0.3 ein.
4. **Kein Knopf ist immer besser — und wann er sich lohnt, hängt an Attributen.** Jede Stufe muss
   für einen nennenswerten Teil der Kader die beste sein (Kriterium aus Wettessen K2: mindestens
   ein Fünftel), und der Break-even muss an Sub-Skills hängen, nicht an der Gesamteignung. Genau
   dieser Break-even ist die Information, die der Trainer braucht (Abschnitt 6) — er ist der
   Grund, warum die Grundtaktik Taktik ist und keine Zusatzstufe für die ohnehin Besten.
5. **Die Matrix bleibt der Maßstab, in jeder Einstellung.** Die Grundtaktik darf nur Kanäle
   benutzen, die heute schon Matrix-Attribute tragen; sie führt kein Attribut neu ein und gewichtet
   keins um. Weil sie aber verändert, *wie oft* ein Kanal entscheidet, verschiebt sie die
   gemessenen Anteile. Deshalb gilt die Pflichtprüfung Pp ≤ 25 (zwei Saatströme) **für jede der
   drei Stufen und für gemischte Paarungen**, nicht nur für Neutral. Ein Spieler, der laut Matrix
   zu den Besten gehört, muss das in allen drei Einstellungen bleiben (Chris, 21.09.: „wenn ich
   einen Spieler mit einer Stat von 80 reinschicke, erwarte ich auch, dass da einer der Top-Leute
   ist").
6. **KI-Teams wählen deterministisch aus dem Kader** (Muster `berechneFokusAuto()`
   `engine.js:9969`, `berechneTaktikAuto()` `:10016`). Für die Messung wählen beide Seiten nach
   derselben Regel; zusätzlich werden alle neun Kombinationen der drei Stufen gefahren, weil ein
   menschlicher Manager jede davon setzen kann.
7. **Sichtbar im Spiel.** Jede Grundtaktik bekommt eine Tickerzeile beim Greifen („Offensiv:
   Haldor zieht am Kreuzungsgriff") und eine Anweisungsbilanz im Endstand. Staffel hat beides schon
   (B4, „Anweisungsbilanz je Seite", `engine.js:46251`).

**Rangfolge der drei Knöpfe (Vorschlag):** Einzel-Haltung des Spielers (`place[n].haltung`, wenn
gesetzt) > Grundtaktik des Teams (verschiebt die Slot-/Persönlichkeits-Vorgabe um eine Stufe) >
Slot-/Persönlichkeits-Vorgabe (heute). Intensität bleibt daneben, unverändert, und behält ihre
Bedeutung „wie viel Kraft dieser Spieltag über die Saison kostet".

**Wo das Feld lebt:** neben der Intensität in den Disziplin-Modifikatoren der Einsatzliste
(`previewModifiers[disciplineSide]`, `legacy-lineup-preview-from-context.ts:212`), also je
Disziplin-Seite eines Spieltags. Die Übergabe an den Motor bräuchte ein Team-Feld — `place` ist
heute je Spieler; ein `grundtaktik` je Seite gehört in den Aufruf von `spiele…()`/`MOTOREN[d].bau()`,
nicht in jeden Spielereintrag.

---

## 2. Die zwanzig auf einen Blick

**Einordnung:** **A** klarer Ansatz, die Entscheidung existiert im Motor · **B** Ansatz ja, aber
hinter einer benannten Vorbedingung · **C** nur als Tempo-Voreinstellung, kein Gegnerbezug · **D**
kein sinnvoller Ansatz. **Pp-Spielraum** = 25 minus der schlechtere der beiden heutigen Saatströme
(`data/generated/disziplin-abnahme.json`) — er sagt, wie weit eine Stufe die gemessenen
Attributanteile verschieben darf, bevor die Pflichtprüfung reißt. „gewertet" = steht in
`ARENA_RESOLVED_DISCIPLINE_IDS` (14 von 20); bei den übrigen sechs zählt heute die PPS-Duell-Brücke,
eine Grundtaktik in der Arena hätte dort bis zur Abnahme keine Wirkung aufs Ergebnis.

| Disziplin | Chassis | Kl. | Offensiv heißt | Defensiv heißt | Stelle im Code | rho/Spiel · Pp-Spielraum |
|---|---|:-:|---|---|---|---|
| **Climbing** | Bahn | A | Zieht am Kreuzungsgriff auch aus etwas größerem Abstand; Plan eine Stufe Richtung „Durchziehen" | Zieht nie, nimmt am Kreuzungsgriff die Ausweichlinie (Zeit), Plan Richtung „Sparsam" | Kreuzungsgriff `46795-46838`, `plaene` `44068` | 0,833 · 13 |
| **Spurt** | Bahn | A | Rempelt früher (Schwelle runter), Plan Richtung „Von vorn" | Rempelt nicht, weicht aus, Plan Richtung „Windschatten" | `tackleAb`/`tackleRate` `43408`, `plaene` `43449` | 0,910 · 5,6 |
| **Staffel** | Bahn | A | Weite Marke, Zug auf dem Bein (eine Stufe Richtung angreifen) | Kurze Marke, gleichmäßiges Bein | `STAFFEL_MARKE` `46042`, `staffelHaltungenSetzen()` `46111` | 0,937 · 3 |
| **Takeshi's Castle** | Bahn | A | Störer-Verhalten: sucht im Gedränge den Gegner (Fable 5.5), Plan Richtung „Kopf voran" | Meidet das Gedränge, Plan Richtung „Vorsichtig" | `tackleFenster` `44251`, `plaene` `44523` | 0,898 · 6,1 |
| **Time-Trial** | Bahn | C | Plan Richtung „Attacke" | Plan Richtung „Gleichmaß" | `plaene` `43724` | 0,943 · 12,5 |
| **Gewichtheben** | Bühne (Heben) | A | Höhere Eröffnung, größere Sprünge, kühner Versuch auch in offener Lage | Tiefe Eröffnung, kleine Sprünge, dritter Versuch jagt nicht | `lastFuer()` `24474`, `hebenTeamLage()` `20475` | 0,865 · 15 |
| **Breaking** | Bühne (Gauntlet) | A | Provoziert früher (nächstes Gerät früher, Bonus) | Provoziert nie, haushaltet HP für die Kette | `GAUNTLET_PROVOKATION_*` `25563`, `baueGauntlet()` | 0,801 · 10,7 |
| **Speed-Schach** | Bühne (Duell) | A | Lehnt Remis ab, Ansage eine Stufe Richtung „blitzen" | Nimmt Remis früher, Ansage Richtung „rechnen" | `SCHACH_REMIS_*` `19137`, `SCHACH_ANSAGE` `19095` | 0,910 · 12,9 |
| **Tennis** | Bühne (Duell) | B | Risiko-Aufschlag/Netzangriff (T5) | Sicherer zweiter Aufschlag, Grundlinie | T-F1a-Punktvergleich `18547 ff.` — Entscheidung fehlt | 0,813 · 18,1 |
| **Fechten** | Bühne (Duell) | B | Drängen auf die Mensur, Angriff | Abwarten, Riposte | Mensur `FECHTEN_MENSUR_SKALA` `19434` — Entscheidung fehlt | 0,860 · 4,3 |
| **Wettessen** | Bühne (Auftritt) | C | Haltung Richtung „Sprint" | Haltung Richtung „gleichmäßig" | `WETTESSEN_HALTUNGEN` `19309` | 0,910 · 15 |
| **Showcase** | Bühne (Auftritt) | D | — | — | (Abschnitt 5) | 0,835 · 12,3 |
| **Eiskunstlauf** | Bühne (Auftritt) | D | — | — | (Abschnitt 5) | 0,866 · 5,2 |
| **I-Spy** | Bühne (Schatzsuche) | B | Jagt fremde Funde (Reaktion öfter), greift schwere Truhen an | Reagiert nicht, nimmt sichere Truhen | `ispySeiteTick()` `25155`, EV-Wahl F2 | 0,750 (nicht abgenommen) · 11,4 |
| **Mini-DM (FFA)** | Kampf (FFA) | A | Schlägt jeden Takt zu, setzt beim Angeschlagenen nach | Wartet ab, solange drei stehen, bricht aus Bündnissen nicht aus | `mdffaSchlagwechsel()` `53827` | 0,80 je Runde / 0,61–0,69 je Event · 16 |
| **TDM** | Kampf | A | Haltung aller eine Stufe Richtung ungestüm (späterer Rückzug) | Eine Stufe Richtung defensiv (früherer Rückzug, kürzere Tode) | `behav()` `7447`, Rückzug `39206` | 0,324 · — (Pp 51,4) |
| **Battlefield** | Kampf | A | Punkt nehmen: mehr Kämpfer auf den Kontrollpunkt | Punkt halten / eigene Hälfte, kontern statt stürmen | `ARENA_DOMINATION` `8482`, Befehle `7306` | 0,399 · — (Pp 30,1/37,1) |
| **Basketball** | Feldspiel | A | Tempo + Bretter angreifen (Taktik-Karte) | Halbfeld + Bretter zurück | `taktik` `8646`, `effektiverTaktik()` `10039` | 0,832 · 2,1 |
| **Football** | Feldspiel | A | Vierter Versuch ausspielen, mehr tiefe Pässe | Punten, mehr Läufe, Uhr | `waehleVierterVersuch()` `11825`, `waehlePlayCall()` `11801` | 0,807 · — (Pp 121) |
| **Hockey** | Feldspiel | B | Forecheck, mehr Bodychecks | Riegel/Klären auch vor der Endphase | `hockeyRiegelKlaert()` `11214`, Bodycheck `14477` | 0,640 · — (Pp 38,5/81,5) |

Drei Beobachtungen aus der Tabelle:

- **Der Pp-Spielraum ist ungleich verteilt und bestimmt die Reihenfolge.** Staffel (3),
  Basketball (2,1), Fechten (4,3) und Eiskunstlauf (5,2) haben praktisch keinen; jede Stufe, die
  dort Kanäle umschichtet, muss nahezu Pp-neutral gebaut werden (Staffel kann das, weil der Zug
  über einen Träger-Mix aus WUCHT und TECHNIK läuft, der schon im Budget steckt). Mini-DM (16),
  Gewichtheben (15), Wettessen (15), Climbing (13) haben echten Raum für Chris' „defensiv → Health
  ein bisschen stärker".
- **Vier Disziplinen haben keinen Pp-Spielraum, weil sie die Schranke heute schon reißen** (TDM,
  Battlefield, Football, Hockey). Dort kann eine Grundtaktik höchstens als Weg dienen, ein totes
  Matrix-Attribut zu beleben (Football: AUSDAUER/stamina-will über Tempo-Offense, Fable F2) — sie
  wird an der Pflichtprüfung aber erst gemessen, wenn die Disziplin selbst besteht.
- **Die Kampf-Disziplinen sind die natürlichste Heimat für „defensiv/offensiv"** — und die mit
  der schwächsten Rangtreue. Das spricht dafür, sie zu planen, aber nicht zuerst zu bauen.

---

## 3. Ausgearbeitete Skizzen

### 3.1 Climbing — Chris' eigenes Beispiel

**Heute.** Zwei Kreuzungsgriffe je Routenpaar (`kreuzungsPos:[0.44,0.71]`, `engine.js:43864`).
Wer an einem davon vorn liegt und höchstens `zugSchwelle` 0,02 vor seinem Duellpartner ist,
**zieht immer** (`engine.js:46808-46838`) — er zahlt 0,5 s, der Gezogene wirft einen Wehrwurf aus
WUCHT und GLEICHGEWICHT. Es gibt keine Entscheidung: Ziehen ist ein Reflex. Daneben läuft jeder
Kletterer einen Plan aus seinem Slot (Sparsam/Stetig/Durchziehen, `engine.js:44068-44077`), der
Tempo, Angehpunkt und `rastUnter` setzt.

**Offensiv — „Lass ihn nicht vorbei".**
- Der Zug wird an beiden Kreuzungsgriffen auch bei etwas größerem Abstand versucht (z. B.
  `zugSchwelle` 0,02 → 0,035 *nur für diese Seite*) — mehr Kontakte, jeder kostet den Ziehenden
  weiter 0,5 s.
- **Neu: auch der Hintere darf greifen** (heute nur der Vordere, „er verteidigt seinen
  Vorsprung"). Der aufholende Kletterer zieht am Partner, um vorbeizukommen — teurer als der
  Verteidigungszug (Vorschlag 0,8 s), weil er sich dafür vom eigenen Griff lösen muss. Das ist die
  wörtliche Lesart von „versuchen meine Spieler eher andere herunterzutreten".
- Plan jedes Kletterers eine Stufe Richtung „Durchziehen".

**Defensiv — „Bleib aus der Reichweite".**
- Kein Zugversuch, also 0,5 s gespart, wenn man vorn liegt.
- **Neu: Ausweichlinie am Kreuzungsgriff.** Liegt man hinten und nah, nimmt man die
  Ausweich-Variante — ein Griff weiter außen, Zeitkosten (Vorschlag 0,3 s), dafür kein Wehrwurf
  nötig, weil der Partner nicht herankommt. Genau Chris' „versuche ich eher von anderen wegzukommen
  … das könnte mich dann dadurch auch wieder Zeit kosten".
- Plan eine Stufe Richtung „Sparsam".

**Was es kostet und wem es nützt.** Offensiv lohnt sich, wenn die eigene WUCHT die GLEICHGEWICHT-
Werte der Gegner deutlich übersteigt — sonst wird gewehrt und die Zeit ist verschenkt. Defensiv
lohnt sich für Kletterer mit wenig WUCHT, die heute als Gezogene Balance verlieren, und für Teams,
deren Kletterer ohnehin vorn liegen (sie müssen nicht ziehen, um vorn zu bleiben). Kein Knopf ist
immer besser: Gegen ein defensives Team läuft die offensive Zusatzzeit ins Leere, weil keiner in
Reichweite bleibt.

**Welche Attribute stärker ins Spiel kommen (Tendenz).** Offensiv: power, determination, health
(über WUCHT, `power:42, determination:28, health:30`, `engine.js:44048`). Defensiv: stamina und
will (über den sparsameren Plan entscheidet die Reserve/STEHEN länger, `engine.js:44047`) und
awareness (GLEICHGEWICHT steht seltener auf dem Prüfstand — das Attribut *tritt zurück*, ehrlich
gesagt; defensiv ist es nicht nötig, weil man nicht gezogen wird). Alle drei Gruppen tragen heute
schon Matrixgewicht (stamina 26, determination 16, health 10, power 8, will 8, awareness 8).

**Trainer-Hinweis (Beispielwortlaut).** „Offensiv: deine Kletterer greifen zum Nebenmann. Lohnt
sich mit viel Kraft und Entschlossenheit — gegen ruhige Köpfe verschenkt es Zeit. Defensiv: deine
Kletterer weichen aus und sparen Kraft. Lohnt sich mit Ausdauer und Willen, kostet an jedem
Kreuzungsgriff einen Moment."

**Messrisiko.** Mittel. Der Kontakt ist gemessen eignungsnah (Climbing-Kontakt 14.10.: rho
0,833/0,816, Pp 12,0/9,5, 3,83 Ereignisse je Rennen), der neue Zug des Hinteren und die
Ausweichlinie sind es nicht. Zu prüfen: Ereigniszahl bleibt im Korridor 2–4 (sonst wird Climbing
Takeshi, genau das Veto vom 24.09.), Spiegeltest nahe 50:50, Pp in allen neun Kombinationen.
**Aufwand:** klein bis mittel — zwei neue Zweige im bestehenden Kontaktblock, ein Planversatz.

### 3.2 Mini-DM (FFA) — Chris' zweites Beispiel

**Heute.** Jeder der vier Kämpfer schlägt in **jedem** Takt (`mdffaSchlagwechsel()`,
`engine.js:53827`). Wen, entscheidet eine Kaskade: Zweckbündnis gegen den Führenden (spirit),
Schwachstelle (intelligence), Vergeltung, Zufall. Getroffene Angeschlagene gehen ins
Finisher-Duell (Setzen torment/power gegen Halten will/health), ab Takt 5 ermüden alle (stamina),
später frisst der Ring. Die Kampfrichterwertung zählt Schaden (`A.wert+=dmg`), Finishes und
Überstehen.

**Offensiv — „Erst schlagen, dann fragen".**
- Wie heute in jedem Takt zuschlagen, aber die Zielwahl bevorzugt den **Angeschlagenen** (der
  Schwachstellen-Zweig greift mit höherer Grundchance, nicht nur nach intelligence) — mehr
  Finisher-Duelle, also öfter Setzen gegen Halten.
- Zweckbündnisse werden früher aufgekündigt, sobald der Gejagte angeschlagen ist (man will den
  Finish selbst, nicht die geteilte Beute).

**Defensiv — „Lass die anderen sich zerfleischen".**
- Solange drei oder mehr stehen, **setzt der Kämpfer in jedem zweiten Takt aus** und geht in
  Positionierung: kein Schlag, dafür steigt seine Positionierungs-Chance (er stellt sich so, dass
  nur einer ankommt). Das ist der echte FFA-Trick „third partying" — und er kostet: kein Schaden
  heißt keine Kampfrichterpunkte in diesen Takten.
- Sind nur noch zwei übrig, kämpft er normal — dann zählen Halten, Stand und Ermüdung, und er geht
  frischer in diese Phase.
- Bündnisse werden eher eingegangen und nicht gebrochen.

**Was es kostet und wem es nützt.** Defensiv tauscht frühe Wertungspunkte gegen eine bessere
Ausgangslage im Endkampf. Es lohnt sich für Kämpfer mit hohem Stand (health) und gutem Halten
(will/health), die lange stehen bleiben — und es scheitert bei Kämpfern, die im Endkampf nicht
gewinnen, weil ihnen dann die früh verschenkten Punkte fehlen. Offensiv lohnt sich für Kämpfer mit
viel Wucht (torment/power), die Finisher-Duelle gewinnen, und bestraft Glaskanonen, die dabei selbst
angeschlagen werden.

**Welche Attribute stärker ins Spiel kommen (Tendenz).** Das ist fast wörtlich Chris' Satz:
offensiv rücken **torment** (Setzen, Wucht) und **power** nach vorn, defensiv **health** (Stand,
Halten-Nebenweg), **will** (Halten) und **stamina** (frischer in die Endphase) sowie
**intelligence** (Positionierung). Kein neues Attribut, keine neue Gewichtung — nur, welche der
acht vorhandenen Kanäle im Spielverlauf öfter entscheiden. Alle acht tragen Gewicht im
Mini-DM-Override (`lib/player-generator/spiel-eignung-overrides.ts`, torment 21 · health 18 ·
power 14 · stamina 14 · will 12 · dexterity 9 · intelligence 6 · spirit 6).

**Trainer-Hinweis.** „Offensiv: deine Kämpfer suchen den Angeschlagenen und setzen nach — stark mit
Härte und Kraft. Defensiv: deine Kämpfer halten sich raus, bis nur noch zwei stehen — stark mit
Gesundheit, Willen und Ausdauer, aber wer im Endkampf verliert, hat nichts gesammelt."

**Messrisiko.** Mittel bis hoch für rho, niedrig für Pp. Pp hat mit 8,7/9 den größten Spielraum
aller Disziplinen. Die Spieler-Ebene je Event (0,608–0,686, `arena-resolved-disciplines.ts`
Kommentar zu `MINI_DM_FFA_VORLAUF_AKTIV`) besteht schon heute nicht; Chris hat sie über die
Star-/Paartreue abgenommen. Die Abnahme der Grundtaktik muss deshalb Star auf Rang 1 und Paartreue
mit Abstand in allen neun Kombinationen zeigen — „Abwarten" darf den Besten nicht systematisch vom
Podium nehmen. **Wichtige Grenze (CLAUDE.md, I-Spy-Lehre):** kein Kanal darf einem Spieler durch
fremde Hand einen Zug nehmen — das Aussetzen ist die **eigene** Wahl seines Teams, nie die Folge
fremder Taktik. **Aufwand:** mittel — ein Zweig in der Zielwahl, ein Aussetz-Zweig vor den
Schlägen, alle Würfe bleiben über `mdffaZufall()` mit festem Zweck, also ohne Kaskade.

### 3.3 Staffel — die Mechanik ist fertig, nur der Knopf fehlt

**Heute.** „Marke und Zug" (O2) ist seit #1154 live (`staffelMarkeZug={aktiv:true, modus:"ki"}`,
`engine.js:40248`; der Kommentar darüber spricht noch von „Standard AUS" — das ist überholt).
Jeder Läufer hat eine Marke im Wechsel (absichern 0,6× Gewinn, 0,5× Patzerrisiko; angreifen 1,4×
Gewinn, 2,0× Patzerrisiko, `STAFFEL_MARKE` `engine.js:46042`) und eine Haltung auf dem Bein (Zug
+5 % bis 45 % des Beins, danach Fade, den der Träger `0,5·WUCHT + 0,5·TECHNIK` abfedert,
`zugFaktor()` `:46072`). Gewählt wird aus der Persönlichkeit (`STAFFEL_PERS_HALTUNG` `:46099`),
gedeckelt durch die Paar-TECHNIK. Der Motor kennt außerdem `modus:"normal"|"angreifen"|"absichern"`
für **alle gleich** — das ist heute ein QA-Schalter, und er ist ziemlich genau das, was die
Grundtaktik nicht sein soll (Regel 3).

**Offensiv.** Jeder Läufer eine Stufe Richtung angreifen (absichern → normal, normal → angreifen),
die Paar-TECHNIK-Sperre bleibt (`STAFFEL_MARKE_SICHER_UNTER`): ein unsicheres Paar läuft auch
offensiv keine weite Marke.

**Defensiv.** Jeder eine Stufe Richtung absichern.

**Was es kostet und wem es nützt.** Kalibriert ist es schon: der Zug lohnt sich ab Träger 62,9
(„ab 65 in 100 % der Beine +11 bis +41 ms, unter 55 in 0 %", Kommentar bei `ZUG_FADE`). Offensiv
ist also eine echte Kaderfrage — ein Team mit Läufern unter Träger 55 verliert offensiv Zeit.

**Welche Attribute stärker ins Spiel kommen.** Offensiv: spirit, charisma, speed (WUCHT der Staffel,
`spirit:45, charisma:33, speed:22`) und awareness/dexterity (TECHNIK, für den Wechsel). Defensiv:
stamina und will treten nach vorn, weil das gleichmäßige Bein über STEHEN/ENDTEMPO gelaufen wird.

**Trainer-Hinweis.** „Offensiv: weite Marken und Zug auf dem Bein — lohnt sich mit Läufern, die
Teamgeist, Ausstrahlung und Auge mitbringen; bei unsicheren Wechselpaaren bleibt es trotzdem
sicher. Defensiv: kurze Marken, gleichmäßige Beine — lohnt sich mit Ausdauer und Willen."

**Messrisiko.** Gering für rho (0,937, höchster Puffer der Bahn), **hoch für Pp**: der
Spielraum ist 3 Pp. O2 hat Pp beim Einschalten bewegt (37,7/41,1 → 35,6/37,9 laut #1154; der
heutige Stand 21,1/22 in `disziplin-abnahme.json` stammt aus einer späteren Messung). Deshalb ist Staffel zwar der **billigste Pilot** (keine neue Mechanik, nur
Versatz der vorhandenen Automatik), aber nicht zwingend der sicherste. **Aufwand:** klein.

### 3.4 Speed-Schach — die einzige Disziplin, in der „defensiv" ein Remis heißt

**Heute.** Zwei Entscheidungen, beide live (`BUEHNE_FLAGS.speedSchachUhr:2`, `engine.js:18847`):
die Tempo-Ansage je Brett (rechnen: Zeit ×1,30, +4 pp Erfolg; blitzen: ×0,72, −4 pp,
`SCHACH_ANSAGE` `:19095`), gewählt nach der Zeitbudget-Regel; und Remis als Mannschaftstaktik
(S-F1): ab Zug 8, bei |Vorteil| < 20, nur wenn die eigene Mannschaft unter den entschiedenen
Brettern nicht klar hinten liegt (`SCHACH_REMIS_AB_ZUG=8, _SCHWELLE=20, _TEAM_TOLERANZ=1`,
`:19137`).

**Offensiv — „Auf Sieg spielen".** Remis wird abgelehnt, auch wenn die Teamlage es erlaubte; die
Ansage jedes Bretts rückt eine Stufe Richtung blitzen (der Gegner gerät früher in Zeitnot, man
selbst auch). **Defensiv — „Das Ergebnis sichern".** Remis wird schon bei etwas größerem Abstand
angenommen (z. B. Schwelle 20 → 30) und ab Zug 7; die Ansage rückt Richtung rechnen.

**Warum das Taktik ist und kein Stat-Ding.** Die Remis-Politik ändert keinen einzigen Zug und
keine Punktzahl — sie ändert nur, **ob ein Brett zu Ende gespielt wird**. Weil `u.summe` (der
Messwert) die eigenen Punkte zählt, nicht das Brett, ist sie per Konstruktion fast rho-neutral; sie
wirkt auf das Mannschaftsergebnis. Die Ansage dagegen ist ein Tausch Zeit gegen Erfolgschance, der
an TEMPO hängt.

**Welche Attribute stärker ins Spiel kommen.** Offensiv: speed, dexterity, awareness (TEMPO
`speed:50, dexterity:30, awareness:20`, `engine.js:19093`) und will/determination (Zeitnot dämpft
NERVEN). Defensiv: intelligence (rechnen hebt die Erfolgschance, und die steckt in TECHNIK) —
also die beiden schwersten Matrixattribute, intelligence 28 und awareness 21, bekommen je eine
Stufe, in der sie stärker tragen.

**Trainer-Hinweis.** „Offensiv: kein Remis, schnelles Spiel — stark mit flinken Händen und
Übersicht, riskant mit wackligen Nerven. Defensiv: Remis annehmen, Zeit nehmen — stark mit klugen
Köpfen, verschenkt aber Bretter, die man hätte gewinnen können."

**Messrisiko.** Gering. rho 0,910, Pp-Spielraum 12,9. Zu prüfen ist vor allem die Teamwertung in
`spieleBuehneDuell()` (`lib/battle/arena-headless-runner.ts`) und der Heim/Gast-Spiegel.
**Aufwand:** klein — zwei Konstanten werden je Seite lesbar, die Ansage bekommt einen Versatz.

### 3.5 Football — Team-Entscheidungen, die schon im Motor sitzen

**Heute.** Der vierte Versuch ist fest: Field Goal in Reichweite, sonst bei `toGo ≤ 1` und nicht
zu nah an der eigenen Torlinie ausspielen, sonst Punt (`waehleVierterVersuch()`,
`engine.js:11825`; ausdrücklich „PLATZHALTER-Schwellen"). Der Spielzug-Mix verschiebt sich mit Down
und Distanz nach NFL-Quoten (`waehlePlayCall()`, `:11801`) — jeder Aufruf zieht **genau einen**
`rr()`, egal wie die Anteile stehen.

**Offensiv.** Vierter Versuch wird bis `toGo ≤ 3` ausgespielt (moderne Analytics-Tendenz), der
Passanteil auf längeren Distanzen steigt, mehr „tief". **Defensiv.** Punten ab `toGo ≥ 1`
außerhalb der FG-Reichweite, Laufanteil höher (Uhr), weniger „tief".

**Warum gerade Football billig ist.** Die Ergebnisse entstehen in `resolveLauf`/`resolvePass` aus
Sub-Skills der gelosten Akteure, die Figuren sind Optik (Fable F2). Ein anderer Anteil im
`waehlePlayCall()` verschiebt keine Position und keine Zufallsfolge — dieselbe Zahl Würfe, nur
andere Schwellen. Das ist die Bauform, die Hockey fehlt (Abschnitt 4.4).

**Welche Attribute stärker ins Spiel kommen.** Offensiv: power/determination/dexterity
(PASSGENAUIGKEIT), torment/power/speed auf der Gegenseite (ABWEHR_PASS). Defensiv: power/health/speed
(LAUFKRAFT) und torment/power/health (ABWEHR_LAUF). **Der eigentliche Gewinn läge woanders:** sechs
der zwölf Matrixattribute — spirit 25 vorneweg — tragen in Football mechanisch fast nichts (Pp
121,0/120,1, `stand-aller-disziplinen.md` Abschnitt 14). Eine dritte Stufe „Tempo-Offense" (Fable
F2) gäbe stamina/will über einen Puste-Kanal einen Ort. Für spirit fehlt auch dann ein Kanal; die
Grundtaktik löst Footballs Pp-Problem nicht, sie verschärft es aber auch nicht, wenn Neutral
bit-identisch bleibt.

**Trainer-Hinweis.** „Offensiv: vierte Versuche ausspielen, tief werfen — lohnt sich mit starkem
Passspiel und einer Verteidigung, die einen verlorenen Ball verkraftet. Defensiv: punten, laufen,
Uhr runter — lohnt sich mit Laufkraft und Ballsicherheit."

**Messrisiko.** Für rho gering bis mittel (0,807, knapp). Für Pp nicht bewertbar, solange Football
die Schranke selbst reißt. **Wirkung aufs Ergebnis erst, wenn Football arena-gewertet ist** —
heute zählt die PPS-Duell-Brücke. **Aufwand:** klein.

---

## 4. Kurzskizzen der übrigen

### 4.1 Bahn

**Spurt (A).** Offensiv: Rempel-Schwelle für die eigene Seite runter (`tackleAb` 50 → etwa 40,
`engine.js:43408`), Plan eine Stufe Richtung „Von vorn" — man sucht den Kontakt an der Hürde und
läuft im Wind. Defensiv: kein eigener Rempler, Windschatten. Gelohnt wird offensiv WUCHT
(torment/power), defensiv ENDTEMPO und STEHEN (speed, will, torment/health über die Reserve).
Risiko: Pp-Spielraum 5,6; Wucht ist heute schon ein starker Kanal. Die Konsultation 02.10. (Zeile
5) schlug „Durchbruch statt Ausweichen" vor — das ist dieselbe Achse.

**Takeshi's Castle (A).** Offensiv ist hier der **Störenfried** aus `fable-ideen-bahn-30-09.md`
5.5: Takeshi ist die einzige Bahn, auf der Gegner wirken dürfen, und die einzige, deren Pläne das
nicht nutzen. Offensiv sucht man im `tackleFenster` (5 % vor jeder Falle) die Nähe der gegnerischen
Seite, Plan Richtung „Kopf voran"; defensiv meidet man das Gedränge (`gedraenge` kostet bis 0,12 s
je weiterem Mann), Plan Richtung „Vorsichtig". Offensiv zählen WUCHT (charisma/determination/will)
und ROBUST, defensiv TECHNIK (intelligence/awareness — „der Kluge findet die Lücke"). Grenze aus
dem Chaos-Plan: über ~20 Rempler je Rennen kippt rho.

**Time-Trial (C).** Keine Gegner, keine Interaktion („ein Zeitfahren hat keine Gegner, die man
umreißen … könnte", `engine.js:43479`). Die Achse ist hier reine Renneinteilung (Gleichmaß →
Attacke). Das ist eine echte Entscheidung mit echter Währung (Reserve), aber kein „auf dem Feld
gegen jemanden". Vorschlag: die Grundtaktik verschiebt den Plan um eine Stufe, mehr nicht; eine
eigene Mechanik lohnt nicht. Vorbedingung laut Konsultation 02.10. (Zeile 3): „Ins Rote gehen"
(Fable 1.2), sonst ist Negativ-Split eine tote Option.

### 4.2 Bühne

**Gewichtheben (A).** Chris' Beispiel aus der Konsultation 02.10. und dort der empfohlene Pilot.
Offensiv: Eröffnung höher, Sprünge größer, und das Wagnis-Fenster des kühnen Versuchs
(`HEBEN_WAGNIS_MAX_KG=5`) wird schon in der Lage „offen" verbreitert, wie es heute erst in
„entschieden" geschieht (`HEBEN_TEAM_OFFEN_WAGNIS_FAKTOR`). Der 13.09.-Befund bleibt: kein kühner
Versuch für den Führenden im eigenen Duell, auch offensiv nicht.
Defensiv: Eröffnung Richtung sicher (derselbe `versatz`-Mechanismus wie `HEBEN_TEAM_SICHERN_
VERSATZ`), dritter Versuch jagt nicht. Offensiv zählen power und charisma (LAST, ANSAGE), defensiv
determination/will (TECHNIK/NERVEN — sauber durchkommen) und health (ERHOLUNG nach dem Fehlversuch).
Der 106-%-Deckel bleibt. Isolationstest 06.09. (Zuschlag bis 20 kg) war rho-flach. Aufwand klein.
Wenn Weg C „Sandsack" eingeschaltet wird (`BUEHNE_FLAGS.gewichthebenSandsack`, heute 0), heißt
dieselbe Achse dort: offensiv öfter „durchpowern", defensiv öfter „ablegen und rasten".

**Breaking (A).** Der Gauntlet ist ein Kachinuki: der Überlebende nimmt seine HP in den nächsten
Bout (`GAUNTLET_HP_MAX=400`). Offensiv: die Provokation (B5) greift schon ab einer niedrigeren
WAGNIS-Schwelle (58 → etwa 50) — härtere Stufe früher, größerer Bonus, schneller durch die Kette,
aber mit mehr HP-Verlust bei Fehlschlag. Defensiv: nie provozieren, das Verschnaufen zwischen den
Bouts (B4) wird voll mitgenommen — man haushaltet für die Kette. Offensiv zählen power/will
(SPITZENMOMENT), defensiv health/will (NERVEN) und stamina/determination (AUSDAUER). **Wichtig
nach CLAUDE.md:** Breaking ist Folter, kein Breakdance — „offensiv" heißt hier, mehr Schmerz
herauszufordern, nicht spektakulärer zu tanzen. Risiko: rho 0,801 liegt **auf** der Schranke; B2
(Peiniger-Faktor) hat schon einmal gezeigt, wie empfindlich die Kette ist (Deckel ±20 % → ±5 %).

**Tennis (B).** Die Achse ist naheliegend (Risiko-Aufschlag/Netz gegen sichere Grundlinie, Opus-
Review T5), aber im Motor gibt es keine Entscheidung, an der sie andocken kann: jeder würfelt seine
Durchgänge allein, T-F1a vergleicht danach. Vorbedingung: ein Aufschlag-Risiko als eigener
Entscheidungspunkt. rho 0,813 hat 0,013 Puffer — die Konsultation 02.10. empfiehlt dort halbes Δ.

**Fechten (B).** Die Mensur (F-F2 Variante A, `engine.js:19425-19434`) ist gebaut, verschiebt sich
aber nur aus der fertigen Rundenpunkt-Differenz — niemand entscheidet zu drängen. Offensiv wäre
„auf die Mensur drängen" (Variante B: torment gewichtet die Verschiebung), defensiv „abwarten und
kontern". Das Aktionsrad (Schere-Stein-Papier) bleibt abgelehnt (Fable F-F3: eignungsfremdes
Rauschen). Vorbedingung: Variante B mit eigener Pp-Messung; Pp-Spielraum nur 4,3.

**Wettessen (C).** Die Haltung je Esser (K2) ist live und so kalibriert, dass jede Stufe für einen
Teil der Esser die beste ist, nach NERVEN. Es gibt keine Wechselwirkung zwischen Essern („kein
Zustand zwischen Essern", Kommentar K1) — offensiv/defensiv heißt hier nur „Sprint/Pacing". Eine
Team-Voreinstellung kann die KI-Vorgabe um eine Stufe verschieben; aber jede Verschiebung weg von
der NERVEN-Regel macht für einen Teil der Esser die schlechtere Wahl. Das ist genau der Fall, in
dem der Einzel-Knopf (`place[n].haltung`) das richtige Werkzeug ist und der Team-Knopf nichts
hinzufügt. Vorschlag: Grundtaktik wirkt hier nicht, oder nur als Vorbelegung in der UI.

**I-Spy (B).** Offensiv: die Seite reagiert öfter auf sichtbare Funde des Gegners (`pReaktion`
höher, `engine.js:25160`) und der EV-Wähler nimmt Truhen höherer Stufe in Kauf; defensiv reagiert
sie nicht und bleibt bei sicheren Truhen. Offensiv zählen NERVEN und die Knack-Sub-Skills des
Läufers, defensiv LOGIK/FINGERFERTIGKEIT in der eigenen Ecke. Vorbedingung: I-Spy besteht heute
die Schranke nicht (0,750), und die Raumwahl hat gezeigt, wie leicht ein kluger Knopf rho kostet.
Erst nach der Abnahme.

### 4.3 Kampf

**TDM (A).** Die Persönlichkeit hat schon die Fünferskala Haltung (`HALTUNG`, `engine.js:7343`),
die bestimmt, bei welchem LP-Anteil jemand sich löst (`schwelle=u.selb/280`, `:39206`). Offensiv:
jede Haltung eine Stufe Richtung ungestüm (später Rückzug — mehr Schaden, mehr Tode, bei Respawn
5 s Wartezeit). Defensiv: eine Stufe Richtung defensiv (früher Rückzug, weniger Tode). Die
Persönlichkeit bleibt sichtbar (ein Schleicher bleibt vorsichtiger als ein Draufgänger). Offensiv
zählen ANG-Attribute (power), defensiv VER/LP/AUS (health, stamina, spirit). Der Kanal ist gemessen
klein: die Zerlegung vom 02.10. fand, dass Haltung nicht die Fehlordnung trägt — Zusammenhalt und
Bindung tun es (`arena-zielwahl-opus-empfehlung-02-10.md` 2). Deshalb ist die Grundtaktik in TDM
sicherer als Zusammenhalt/Bindung anzufassen. Vorbedingung: rho 0,324 — TDM besteht nicht.

**Battlefield (A).** Der Domination-Punkt existiert (`ARENA_DOMINATION.battlefield`, ein Punkt in
der Mitte, 6 Punkte je Sekunde, `engine.js:8482-8487`). Offensiv: mehr Kämpfer bekommen den Befehl
„mit der Linie" auf den Punkt, Haltung eine Stufe Richtung offensiv; defensiv: zwei halten die
eigene Hälfte (`decken`), der Rest kontert, sobald der Gegner den Punkt einnimmt. Mit dem
Drei-Punkte-Konzept (`battlefield-domination-konzept-14-10.md`) würde die Achse erst richtig
sprechen: offensiv auf zwei Punkte aufteilen, defensiv einen sicher halten — genau Chris' „sodass
man sich aufteilen muss". Vorbedingung: TMP/AUS-Pp-Reparatur am Chassis (dort Abschnitt 1) und rho
(0,399).

### 4.4 Feldspiel

**Basketball (A).** Die Taktik-Karte hat die Schalter schon (`FELDSPIEL_ART.basketball.taktik`,
`engine.js:8646`), gelesen wird keiner. Die Grundtaktik wäre eine Vorbelegung über zwei Schalter,
die keine fehlende Mechanik brauchen: offensiv „Angriff: Tempo" + „Bretter: Angreifen", defensiv
„Angriff: Halbfeld" + „Bretter: Zurück". Offensiv zählen LAUFTEMPO (speed) und ZWEITCHANCE,
defensiv ABWEHR. Vorbedingung ist die Mechanik-Bindung selbst (`feldspiel-taktik-karte-fundament-
15-10.md` Abschnitt 4, Schritt 1) — und Basketball hat mit 2,1 Pp den kleinsten Spielraum aller
gewerteten Disziplinen. Klar als Ansatz, teuer in der Abnahme.

**Hockey (B).** Die Achse ist die natürlichste aller zwanzig (Forecheck gegen Riegel, NHL), und
ein Riegel ist schon gebaut — nur für die Endphase (`hockeyRiegelKlaert()`, `engine.js:11214`).
Defensiv hieße: Klären an die Bande in der eigenen Hälfte schon bei Führung ab dem zweiten Drittel.
Offensiv: aufrückende Verteidiger, mehr Bodychecks (H-B: Strafquote als Funktion von TECHNIK).
**Vorbedingung, gemessen:** jede Änderung, die Positionen verschiebt, verschiebt in Hockey die
`versucheSteal`-Kaskade (rho −0,04 bis −0,05, Puste-Befund). Bei rho 0,640 und Pp 38,5/81,5 ist
das heute nicht verantwortbar. Nur die Endphasen-Fenster (Riegel früher/später auslösen) wären ein
schmaler, positionsarmer Einstieg.

---

## 5. Wo die Achse keinen Sinn ergibt

**Showcase (D).** Zwölf Einzelauftritte, jeder würfelt seine Durchgänge allein, niemand wirkt auf
niemanden. Die einzige denkbare Stellschraube wäre ein Team-Versatz im WAGNIS-Trade-off
(`buehneErfolgschance`/`buehneWagnisFaktor`, `engine.js:19022-19026`) — also „alle riskieren
mehr". Das ist eine Risikoverschiebung ohne Gegner, ohne Ort und ohne Verhalten, das man sehen
könnte; sie hätte für Showcase und Eiskunstlauf dieselbe Form (das Kopiermuster, das Chris
ausdrücklich nicht will). Showcase' eigene Ideen (Casting und Show, S-F1) liegen auf einer anderen
Achse — Reihenfolge, nicht Risiko.

**Eiskunstlauf (D).** Dasselbe Bild, mit einem echten Gegenargument: Programmzusammenstellung
(Quad oder sauberer Triple) ist im ISU-Sport eine echte Entscheidung. Aber sie ist eine Entscheidung
je Läufer über *seinen* Inhalt, keine Mannschaftshaltung, und sie wirkt nicht gegen jemanden. Wenn
Chris sie will, gehört sie als Einzel-Haltung (Konsultation 02.10., Zeile 2, „Quad/sauber") ins
Grundgerüst — nicht als Team-Grundtaktik. Mit 5,2 Pp Spielraum wäre auch das eng.

**Und warum Time-Trial und Wettessen nur C sind, nicht D:** beide haben eine echte, gemessene
dreistufige Einteilung mit echtem Preis (Reserve, Magen). Sie sind Taktik — nur keine Taktik
*gegen* jemanden. Die Grundtaktik darf dort die Vorbelegung verschieben; eine eigene Mechanik für
„offensiv/defensiv" braucht es nicht.

---

## 6. Wie der Trainer die Faktoren sieht, ohne „+3"

Chris will sehen, „welche Attribute da am meisten reinfließen, damit ein Trainer abschätzen kann,
ob das Sinn macht", aber ohne Zahl. Vorschlag in drei Teilen:

1. **Faktoren-Hinweis je Disziplin und Stufe, aus dem Rezept abgeleitet.** Jede Stufe verschiebt,
   welche Sub-Skills öfter entscheiden (Abschnitt 3: Kreuzungsgriff → WUCHT, Abwarten → Stand/Halten,
   Zug → Träger). Die Sub-Skill-Rezepte im Motor sagen, welche Attribute dahinter stehen. Daraus
   entstehen zwei bis drei Attribute je Stufe, mit Worten statt Zahlen: „wird wichtiger", „tritt
   zurück". **Nicht von Hand pflegen** — das Handbuch warnt vor genau dieser Falle (zwei Tabellen
   derselben Daten, `neue-disziplin-handbuch.md` 5.3). Die Ableitung liest dieselben `rezept`-
   Einträge wie der Motor; ändert eine Rezeptrunde ein Gewicht, ändert sich der Hinweis mit.
2. **Eigener Kader im Spiegel des Hinweises.** Statt „Offensiv lohnt sich mit viel Kraft" kann die
   Einsatzliste die zwei, drei eigenen Spieler hervorheben, auf die der Hinweis am meisten zutrifft
   — wieder ohne Zahl, als Markierung. Das ist der Break-even aus Regel 4, übersetzt.
3. **Anweisungsbilanz nach dem Spiel.** Was hat die Grundtaktik in *diesem* Spiel getan?
   „Offensiv: 5 Zugversuche, 3 gesessen, 2,5 s bezahlt" (Climbing) · „Defensiv: 4 Takte
   abgewartet, frisch in den Endkampf, 2. Platz" (Mini-DM) · „Defensiv: 2 Remis angenommen"
   (Speed-Schach). Staffel zeigt das schon (B4.6). Ohne diese Bilanz ist die Wahl unsichtbar —
   der Manager sieht sein Spiel nicht (kein Replay, Feldspiel-Taktik-Karte 1.1).

**Was der Hinweis nicht sagt:** wie viele Punkte die Wahl bringt, und ob sie gegen *diesen* Gegner
richtig ist. Das muss der Trainer aus Kader und Gegner selbst schließen — sonst ist es wieder ein
Rechenknopf.

---

## 7. Abnahme je Disziplin (Messplan, wenn gebaut wird)

Jede Disziplin, die eine Grundtaktik bekommt, durchläuft dieselbe Prüfung. Sie ist strenger als
die normale Abnahme, weil drei Stufen und neun Paarungen statt einer Einstellung gelten.

| Prüfung | Werkzeug | Kriterium |
|---|---|---|
| Neutral bit-identisch | `scripts/miss-alle-disziplinen.mjs 24 <d>` vor/nach, Rohdaten-Hash | identisch |
| rho je Stufe (beide Seiten gleich) | dasselbe, mit `--grundtaktik=<stufe>` (neuer Parameter nach Muster `--flags=`/`buehneHaltungTest`) | > 0,80 je Stufe |
| rho gemischt (offensiv gegen defensiv, beide Richtungen) | dasselbe | > 0,80 |
| Star/Paartreue | `scripts/miss-rangtreue-nach-rolle.mjs` bzw. Kaderfamilie | Star auf Rang 1 fällt nicht um mehr als 5 Prozentpunkte |
| Pp je Stufe, zwei Saatströme | `scripts/messe-arena-einfluss.mjs <d>` | ≤ 25 in allen drei Stufen |
| Knopf-Test | Erwartung je Team über feste Zufallsströme (Muster `scripts/miss-wettessen-mauer.mjs`) | jede Stufe für ≥ 20 % der Teams die beste; die beste Stufe korreliert stärker mit dem Hinweis-Sub-Skill als mit `eig` |
| Spiegel | `scripts/miss-arena-buehne-spiegel.mjs` bzw. Bahn-Spiegeltest | Heim:Gast nahe 50:50 je Stufe |
| Ereigniskorridor | disziplineigen (Climbing 2–4 Kontakte, Takeshi < 20 Rempler, Mini-DM Takte bis Ring) | im Korridor |

Die Abbruchregel aus den bisherigen Runden gilt: reißt eine Stufe rho oder Pp, wird sie
zurückgenommen oder schwächer gebaut — nicht die Schranke verschoben.

---

## 8. Reihenfolge und Aufwand, falls Chris „bau" sagt

| Schritt | Inhalt | Klasse | Aufwand |
|---|---|---|---|
| 0 | **Grundgerüst**: Feld `grundtaktik` je Disziplin-Seite neben der Intensität, Übergabe an den Motor (Team-Feld, nicht in `place`), Lesestelle je Chassis (No-op), KI-Vorgabe aus dem Kader, Sonden-Parameter, Tickerzeile, Bilanzrahmen. **Keine Mechanik.** Bit-identisch nachweisbar wie die Taktik-Karte vom 15.10. | A | mittel |
| 1 | **Pilot Speed-Schach** (geringstes Risiko, Remis-Politik ist rho-fast-neutral) **oder Staffel** (Mechanik fertig, aber Pp-Spielraum 3) | B | klein |
| 2 | **Climbing** (Chris' Beispiel, Kontaktblock existiert) | B | klein–mittel |
| 3 | **Gewichtheben, Spurt, Takeshi, Breaking** | B | je klein |
| 4 | **Mini-DM-FFA** (Abwarten/Nachsetzen) | B | mittel |
| 5 | **Football** — sobald arena-gewertet | B | klein |
| 6 | **TDM, Battlefield, Basketball, Hockey, Tennis, Fechten, I-Spy** — jeweils nach der eigenen Vorbedingung aus Abschnitt 2/4 | B | je klein–mittel |

Schritt 0 ist Voraussetzung für alles danach und kann gebaut werden, ohne eine einzige Disziplin
festzulegen. Die Konsultation 02.10. hatte denselben Schritt als „Zeile 0" für die Einzel-Haltung
vorgesehen — beide sollten **ein** Grundgerüst sein, nicht zwei.

---

## 9. Offene Fragen für Chris

1. **Drei Knöpfe — wie heißen sie, und gibt es alle drei?** Intensität (Kraft über die Saison),
   Haltung je Spieler (Konsultation 02.10.), Grundtaktik je Team (neu). Vorschlag: Grundtaktik als
   Team-Voreinstellung, Einzel-Haltung als Übersteuerung, Intensität unverändert. Alternative:
   die Einzel-Haltung ganz fallen lassen und nur die Grundtaktik bauen — einfacher für den Manager,
   aber weniger Feinsteuerung (der eine Stürmer, der trotzdem sichert).
2. **Je Spieltag oder je Saison?** Vorschlag: je Disziplin-Seite eines Spieltags, wie die
   Intensität — gegen einen bestimmten Gegner defensiv, gegen den nächsten offensiv.
3. **Eine Stufe verschieben (Vorschlag) oder alle gleich setzen?** „Alle gleich" ist einfacher zu
   erklären, löscht aber die Slot- und Persönlichkeitsunterschiede, und es ist der Extremfall, an
   dem die Staffel schon einen Kader verloren hat.
4. **Climbing: darf der Hintere ziehen, und gibt es eine Ausweichlinie?** Beides ist neu und
   dreht am Kontaktkonzept vom 14.10. (dort zieht nur der Vordere).
5. **Mini-DM: ist „Abwarten" erlaubt?** Ein defensiver Kämpfer setzt bewusst Takte aus. Das ist
   FFA-realistisch, sieht aber im Bild passiv aus.
6. **Sieht der Gegner die Grundtaktik vorher?** Vorschlag: nein — sie wird im Ticker sichtbar,
   sobald sie greift.
7. **Wie wählt die KI?** Vorschlag: aus dem Kader (deterministisch, messbar). Der vorhandene
   `AiTacticalMode` der Saisonplanung (`protect_lead`, `chase_top10`, `lib/data/olyDataTypes.ts:3363`)
   könnte zusätzlich nach Ligalage kippen — die Messung deckt das über die neun Kombinationen ab.
8. **Showcase und Eiskunstlauf ohne Grundtaktik — einverstanden?** Die Einstellung wäre dort
   ausgegraut mit dem Hinweis „wirkt in dieser Disziplin nicht".

---

## 10. Was dieses Konzept bewusst nicht tut

- **Keine Zeile Code**, keine Flag, kein neuer Sub-Skill, kein neuer Wurf.
- **Keine Änderung an der Matrix** und kein Vorschlag, der eine Matrix-Änderung bräuchte. Wo ein
  Attribut heute mechanisch tot ist (Football spirit), sagt das Papier, dass die Grundtaktik es nicht
  rettet.
- **Keine Live-Eingriffe** während des Spiels (Klasse T, Konsultation 02.10. Befund B). Die
  Grundtaktik ist eine Vorab-Einstellung; was „während" passiert, ist ihre Wirkung, nicht ein Klick.
- **Keine gemessenen Zahlen für die Vorschläge.** Alle Schwellen in Abschnitt 3/4 (etwa
  `zugSchwelle` 0,035, Remis-Schwelle 30, `tackleAb` 40) sind Startwerte für eine Kalibrierung,
  ausdrücklich keine Empfehlung.
- **Keine Stat-Boni**, auch nicht verkleidet: kein „+5 % Schaden offensiv", kein „+10 % LP
  defensiv". Wo Chris' Beispiel so klingt (Mini-DM, Health), ist es hier über Verhalten gebaut.

## Quellen (alle gelesen, nicht vermutet)

- `CLAUDE.md` (Abnahme, Matrix-Sperre, Mehrwege-Leitlinie, Breaking ist Folter)
- `public/mockups/battle-mode.engine.js` (`main` `5d4982e3`): `ORDERS`/`PERS`/`HALTUNG`/`PERSDEF`/
  `behav()` 7306–7460 · `ARENA_ART` 8251 ff. · `ARENA_DOMINATION` 8482 · `FELDSPIEL_ART.basketball.
  taktik` 8646 · Football-Rezept 9039 · `berechneFokusAuto()`/`berechneTaktikAuto()` 9969/10016 ·
  Hockey-Endphase 11144–11220 · `waehlePlayCall()`/`waehleVierterVersuch()` 11801/11825 · Bodycheck
  14477 · `BUEHNE_ART` 17613 ff. · `BUEHNE_FLAGS` 18847 · `BUEHNE_WAGNIS_*` 19022 ·
  `buehneHaltungVon()` 19045 · `SCHACH_*` 19093–19137 · Wettessen K1/K2 19282–19390 · Fechten-Mensur
  19425 · `HEBEN_ROLLEN` 20281 · `hebenTeamLage()` 20475 · `lastFuer()` 24474 · `ispySeiteTick()`
  25155 · `GAUNTLET_*`/`gauntletRunde()` 25505–25650 · Rückzug 39197–39208 · `staffelMarkeZug`
  40248 · `BAHN_ART` 43298 ff. (Pläne 43449/43724/44068/44180/44523, Kreuzungsgriffe 43864,
  Takeshi-Tackle 44251) · `STAFFEL_MARKE`/`zugFaktor()`/`STAFFEL_PERS_HALTUNG`/
  `staffelHaltungenSetzen()` 46042–46140 · `planWechsel()` 46473 · Kreuzungsgriff-Block 46795 ·
  `mdffaKaempfer()`/`mdffaSchlagwechsel()` 53772/53827
- `lib/battle/arena-resolved-disciplines.ts` (welche 14 gewertet sind, Mini-DM-FFA-Befund)
- `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` (Haltungsfeld)
- `lib/lineups/legacy-lineup-board-props.ts`, `lib/lineups/legacy-lineup-preview-from-context.ts`
  (Intensität je Disziplin-Seite)
- `lib/player-generator/spiel-eignung-overrides.ts` (Mini-DM-Override, nur gelesen)
- `lib/data/olyDataTypes.ts` (`AiTacticalMode`)
- `data/generated/disziplin-abnahme.json` (rho/Pp je Disziplin)
- `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (Vorgänger: Haltung je Spieler)
- `docs/design/feldspiel-taktik-karte-fundament-15-10.md`, `fable-ideen-feldspiel-30-09.md`
- `docs/design/climbing-kontakt-konzept-14-10.md`
- `docs/design/fable-ideen-bahn-30-09.md`, `fable-ideen-buehne-duell-30-09.md`,
  `fable-ideen-buehne-auftritt-30-09.md`, `fable-ideen-heben-breaking-climbing-30-09.md`,
  `fable-ideen-arena-ispy-30-09.md`
- `docs/design/battlefield-domination-konzept-14-10.md`, `mini-dm-ffa-aufstellung-mutatoren-20-10.md`
- `docs/design/stand-aller-disziplinen.md` (Abschnitte 10, 11, 14), `neue-disziplin-handbuch.md`
- `docs/design/i-spy-schatzsuche-konzept-21-09.md` (Vorbild für Ton und Aufbau)

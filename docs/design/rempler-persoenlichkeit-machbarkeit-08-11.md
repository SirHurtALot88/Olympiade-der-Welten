# Rempler/Tackling, gesteuert von der Persönlichkeit: technische Machbarkeit (08.11.)

Reine Recherche, keine Implementierung. Bezieht sich auf Teil 2 der Vision
`docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`. Die Datei liegt bisher nur auf dem
Branch `origin/claude/vision-oberflaechen-tackling-0811` und noch nicht auf `main`. Den kreativen
Teil (Persönlichkeits-Taxonomie, wie Kombinationen wirken sollen) macht Fable parallel. Dieses
Dokument beantwortet die technische Seite: Was gibt es schon, wo würde es leben, was kostet es, und
wie misst man es.

> **Stand nach Chris' Rückmeldung (zweite Runde, 08.11.)**, siehe Vision-Dokument, Abschnitt
> „Nachschärfung 08.11. (zweite Runde)“. Drei Punkte verändern dieses Dokument:
>
> 1. **Scope: nur Battle-Mode.** Eine Persönlichkeitswirkung im unsimulierten Manager-Pfad ist
>    nicht nötig. Damit entfallen diese Rückfrage und jede Architektur-Überlegung für
>    `legacy-score-engine.ts`.
> 2. **Varianz ist gewollt, nicht nur geduldet.** Chris: „Ja, soll es potenziell auch [Spieler
>    stärker oder schwächer machen] … dass er plötzlich andere Kräfte entwickelt und alles an sich
>    reißt, aber damit auch den Scheiß rockt. Oder es kann halt sein, dass er alles alleine machen
>    will und das grandios scheitert.“ Die Dosierung bleibt ein Stellrad („runterdosieren
>    später“). Der Befund vom 02.10. ist deshalb hier nicht mehr das zentrale **Risiko**. Er ist die
>    **Kalibrierungsgrundlage** für eine Zielgröße, die man misst und bewusst einstellt. Die
>    Neufassung steht in Abschnitt 3.5 (Dosis statt Verbot) und 5.4 (Rollentreue). Kurzfassung,
>    Tabelle, Abschnitt 6 und 7 sind angepasst.
> 3. **Zwei Zusatzfragen:** Academy als Erweiterungspunkt für Trait-Training (Abschnitt 9) und
>    Protokollierung persönlichkeitsgetriebener Momente im FM-Stil (Abschnitt 10).
>
> Fables Taxonomie liegt inzwischen vor (`persoenlichkeits-taxonomie-konzept-08-11.md`: 13
> Persönlichkeiten plus Rückfall „Unauffällig“, sechs Regler, Haupt/Neben 65/35, alle 36 Traits).
> Chris will die Ausgabe als Rangliste mit drei Plätzen. Attribute fließen sekundär ein, als
> Beispiele nennt er Torment und Determination. Die Ableitungsschicht in 5.2 nimmt das auf, ohne
> dass sich ihr Aufbau ändert: Eine Rangliste ist nur eine sortierte Ausgabe derselben Punktestapel.

`engine.js` meint `public/mockups/battle-mode.engine.js`. Die Zeilennummern gelten für den
Arbeitsbaum vom 08.11. (Commit `a4d7dd3ad`). Darin liegt eine fremde, nicht eingecheckte Änderung
von +2 Zeilen bei ~17308. Für `HEAD` ziehen Zeilen über 17310 also 2 ab. Funktionsnamen stehen immer
dabei, weil sich Zeilen in dieser Datei täglich verschieben.

---

## 0. Kurzfassung

1. **Die Persönlichkeitsschicht existiert schon, und zwar genau in der von Chris skizzierten Form.**
   `leitePers()` (engine.js 36783) leitet aus Klasse, Rasse, Unterklassen und positiven/negativen
   Traits einen von sechs Archetypen ab: Bollwerk, Draufgänger, Duellant, Schleicher, Beschützer,
   Opportunist. Grundlage ist eine Punkte-Tabelle (`PW`, 36764). Sie ist keine eigene Eigenschaft
   und rein abgeleitet. Was fehlt: eine **Neben**persönlichkeit (heute gilt „der höchste Stapel
   gewinnt“), eine je Disziplin unterschiedliche Wirkung (heute nur über `persHandwerk` an- oder
   abschaltbar) und vor allem **Egomaniac**. Egomaniac steht in keiner `PW`-Tabelle und ist für das
   Verhalten heute wirkungslos (Abschnitt 1.3).
2. **Persönlichkeitsgesteuerte Rempler gibt es schon, nur nicht projektweit.** Im Bahn-Chassis
   (Spurt, Takeshi's Castle) hängt die Rempel-Häufigkeit **wörtlich** an der Persönlichkeit:
   `willTackeln` (engine.js 48859) setzt Draufgänger 0,9, Opportunist 0,7, Duellant 0,55 und
   Bollwerk 0,25. Beide Disziplinen bestehen damit die Abnahme (Spurt rho 0,910 / Pp 19,4|14,9;
   Takeshi 0,898 / 18,9|17,7). **Das ist der Beweis, dass das Grundmuster mit den Schranken
   verträglich sein kann.**
3. **Der Hockey-Check ist dagegen persönlichkeitsfrei und eng verdrahtet.** Er sitzt in
   `versucheSteal()` (15012), läuft nur hinter `istHockey()` und trifft nur den Puckführer. Er
   rechnet ausschließlich ABWEHR gegen wirksame AUSDAUER. Als Vorlage für andere Disziplinen taugt
   er weniger als der Bahn-Rempler.
4. **Wie stark Persönlichkeit wirken kann, ist schon gemessen. Das ist die Eichung für das
   Stellrad, kein Stoppschild.** In der Arena war die Persönlichkeit nachgemessen der größte
   eignungsfremde Faktor der Rangfolge, mit ε² = 0,229 in TDM. Getragen haben das die
   Verhaltenskanäle „Zusammenhalt“ und „Bindung“ (`arena-zielwahl-opus-empfehlung-02-10.md` 0, 1.1,
   10.3). Chris will diese Art Wirkung ausdrücklich („rockt“ oder „scheitert grandios“). Die
   Frage ist also nicht mehr, *ob* Persönlichkeit Ergebnisse verschiebt, sondern *wie stark* und
   *in welche Richtung*.
   **Der wichtigste technische Hebel:** Den Ausgang einer eigenmächtigen Aktion entscheidet die
   Eignung. Dann rockt der starke Egoist und der schwache scheitert. Das ist genau Chris' Bild, und
   es verschiebt Ergebnisse spürbar, ohne die Rangtreue zu zerstören (Abschnitt 3.5). Die
   CLAUDE.md-Schranken (rho > 0,80, Pp ≤ 25) bleiben die Abnahme, aber als Obergrenze der Dosis:
   gesucht ist die **stärkste** Dosierung, die noch besteht, nicht die vorsichtigste.
5. **Eiskunstlauf hat heute keine Interaktion, die ein Rempler stören könnte.** Das Bühnen-Chassis
   würfelt alle Durchgänge vorab in `bauBuehne()`. Die Bewegung (`stepKuer`, 27696) darf vertraglich
   nie `rr()` rufen und nie Punkte schreiben. **Vier Aktive gleichzeitig zu zeigen ist billig
   (Anzeige, rangtreue-neutral beweisbar). Rempler zwischen ihnen sind ein neuer, vorab gewürfelter
   Mechanikkanal** mit voller Abnahme.
6. **Empfohlene Reihenfolge:** (a) Persönlichkeitsschicht als reine Funktion aus der Engine lösen,
   Egomaniac und die fehlenden 13 Traits aufnehmen, Nebenpersönlichkeit ergänzen. Bit-identisch
   machbar, klein. (b) Den Bahn-Rempler per Flag auf Staffel und Climbing ausweiten. Mittel, mit
   Abnahme. (c) **Rollentreue mit Stellrad** in den Bahn-Disziplinen, wo der Slot ein echtes
   Verhalten vorgibt. Nach Chris' Antwort ist das kein Nachzügler mehr, sondern der Kern der
   Vision. (d) Eiskunstlauf mit vier Aktiven, erst als reine Anzeige.

Neue Spalte nach der zweiten Runde: Die Wirkung auf rho/Pp ist kein „Risiko“ mehr, sondern eine
**Zielgröße mit Stellrad**. Die Spalte sagt, wie viel Spielraum die Disziplin für eine spürbare Dosis
hat, und ob die Wirkung eignungsgebunden gebaut werden kann (dann ist sie für die Rangtreue billig).

| Teilaspekt | Aufwand | Spielraum für spürbare Wirkung (Stellrad) |
|---|---|---|
| Persönlichkeits-Ableitung erweitern (alle 36 Traits, Rangliste mit 3 Plätzen, Attribute sekundär) | **klein** | keine Wirkung, solange nur abgeleitet und nirgends neu gelesen |
| Rempel-Neigung als Kanal mit Stellrad (Spurt, Takeshi) | **klein–mittel** | groß (rho 0,91 / 0,90 bieten Puffer, Muster bewiesen) |
| Rempler auf weitere Bahn-Disziplinen (Staffel, Climbing) | **mittel** | Staffel groß bei rho, knapp bei Pp; Climbing knapp bei rho |
| „Rollentreue“ mit eignungsgebundenem Ausgang (Bahn: Rennplan, Staffel-Haltung) | **mittel** (vorher: groß) | mittel–groß, sofern der Ausgang an der Eignung hängt (3.5) |
| „Rollentreue“ in Arena/Basketball | **groß** | Arena zählt im Battle-Mode noch nicht (PPS-Brücke); Basketball mittel |
| Rempler im Feldspiel (Hockey persönlichkeitsabhängig) | **mittel–groß** | reine Optik, solange Hockey wegen Pp nicht gewertet wird (38,5 / 81,5) |
| Eiskunstlauf: vier Aktive **anzeigen** | **klein–mittel** | keine Wirkung (Anzeige, Warteschlangen-Argument) |
| Eiskunstlauf: Rempler zwischen den vier **mechanisch** | **mittel–groß** | mittel, aber nur über Matrixattribute der Disziplin (4.2) |
| Anzeige im Kader/Picker | klein (Text), mittel (ehrlich je Disziplin) | keine Wirkung |
| Protokoll/Statistik persönlichkeitsgetriebener Momente (Abschnitt 10) | **mittel** | keine Wirkung (Nachlese, kein `rr()`) |
| Trait-Training über die Academy (Abschnitt 9) | **mittel–groß** | Manager-Ökonomie, kein Spieltagskanal |

---

## 1. Das bestehende Trait-/Klassen-/Persönlichkeitssystem

### 1.1 Datenmodell (TypeScript-Seite)

- `Player` in `lib/data/olyDataTypes.ts` 967ff. trägt `className: string`, `race`, `alignment`,
  `subclasses: string[]`, `traitsPositive: string[]` und `traitsNegative: string[]`. Traits sind
  freie Strings, eine Klassenhistorie liegt in `classHistory`. **Ein Persönlichkeitsfeld gibt es
  nicht**, auch nicht optional.
- Die kanonischen Listen stehen in `lib/training/class-progression-config.ts` 234–274:
  - **18 positive:** Altruistic, Ambitious, Caring, Cool, Diligent, Disciplined, Eloquent, Fair,
    FanFavorite, Fearless, FiredUp, Flexible, Healthy, Loyal, Motivated, Relaxed, Resourceful,
    Sexy.
  - **18 negative:** Timid, Cheater, ColdBlooded, Devious, Diva, **Egomaniac**, FaintHearted,
    Feisty, Gambler, Lazy, Manipulative, Mercenary, Renegade, Scandalous, Cruel, Paranoid,
    Obsessive, Vindictive.
  - `lib/traits/cosmetic-trait-soft-effects.ts` 6–16 hält fest, dass dieselben 36 Traits auch der
    Mutator-Pool sind (`lib/lineups/legacy-lineup-modifiers.ts` 30/51). `character-import-service`
    lehnt alles andere ab.
- Die Klassen stehen in `PROGRESSION_CLASS_ORDER` (`class-progression-config.ts` 33). Im Motor
  tauchen Tank, Templar, Berserker, Charger, Rogue, Sprinter, Bard, Overseer, Mage, Tactician,
  Warlord, Hero, Badass und Kosten auf (`PW.klasse`, `KLASSENFARBE` engine.js ~8604).
- **Brücke in den Motor:** `lib/foundation/battle-arena/arena-kader-adapter.ts` 20–60/105–125
  (`zuArenaSpieler`) übergibt je Spieler `c`, `r`, `sub`, `tp`, `tn`, `d` (Eignungen) und `a`
  (zwölf Attribute). **Alles, was eine Persönlichkeitsableitung braucht, kommt heute schon im Motor
  an.** Für die Ableitung selbst ist keine Änderung am Datenmodell nötig.

### 1.2 Wo Traits heute schon wirken (Auswahl, alles belegt)

| System | Datei | Was Traits tun |
|---|---|---|
| Eignung im Motor | engine.js `traitAufschlag()` 8583 | Mutator-Treffer → Aufschlag auf die Kampfwerte des Slots |
| Mutator organisch | `docs/design/mutator-trait-organische-performance-konzept-29-09.md`, Abschnitt 11 | +3,5 auf alle zwölf Attribute je Treffer, nur Battle-Modus |
| Persönlichkeit (Verhalten) | engine.js `PW`/`leitePers` 36764/36783 | Punkte → Archetyp |
| Moral/Harmonie | `lib/morale/player-morale-service.ts` 87, 940, 955, 984 | Diva/Egomaniac/Renegade reagieren auf Teamharmonie |
| Forderungen | `lib/morale/player-demands-service.ts` 58–59, 310 | Egomaniac/Diva stellen Kapitäns- und Geldforderungen |
| Verhandlung | `docs/design/verhandlung-rework.md` 114ff., `lib/market/contract-negotiation-preview.ts` 649/681 | „stur = mercenary ∨ diva ∨ egomaniac“ |
| Training | `lib/training/trait-training-signal.ts` 40, `training-mode-demand-service.ts` 21, `player-progression-forecast.ts` 215/483 | XP-Faktoren, „routeConflict“ für Mercenary/Renegade/Diva/Egomaniac |
| Ermüdung (weich) | `lib/traits/cosmetic-trait-soft-effects.ts` | Healthy ×0,94, FaintHearted ×1,06 |
| Generator | `lib/player-generator/player-generator-archetypes.ts` 111 | Archetyp „social_icon“ bevorzugt Diva/Scandalous/Egomaniac |

**Egomaniac ist also im Manager-Teil schon eine lebendige Persönlichkeit** (Moral, Forderungen,
Verhandlung, Training). Nur auf dem Spielfeld kommt er nicht an.

### 1.3 Die Persönlichkeitsschicht im Motor: Stand und Lücken

**Ableitung** (`PW`, engine.js 36764–36782; `leitePers` 36783–36795): Jede Quelle vergibt Punkte
auf einen Archetyp: Klasse 0–3, Rasse 1, Unterklasse 1–3, Trait 1–2. Der höchste Stapel gewinnt,
die Vorgabe ist „duellant“. `persWarum` speichert die Begründung für den Tooltip.
`neuPersBerechnen()` (36802) füllt `persOf` für SQUAD und OPP.

**Wirkung je Archetyp** (engine.js 7739–7860):

- `PERS`: form, opp, selb
- `PERSZIEL`: Zielneigung
- `PERSDEF`: Haltung, Zusammenhalt, Bindung
- `PERSORD`: Befehl, nur als Stern im Dropdown

`behav()` (7862) verrechnet das mit den manuellen Reglern. `persDefVon()` (7850) setzt Zusammenhalt
und Bindung je Disziplin auf „ausgewogen“, wenn `ARENA_ART[d].persHandwerk` das verlangt.

**Lücken gegen Chris' Skizze:**

| Chris' Skizze | Stand im Code | Beleg |
|---|---|---|
| Persönlichkeit aus Attributen + Traits (+ Klassen) | aus Klasse/Rasse/Unterklasse/Traits, **nicht aus Attributen** | `leitePers` liest nur `p.c/p.r/p.sub/p.tp/p.tn` |
| Haupt- **und** Nebenpersönlichkeit, Kombination zählt | nur ein Gewinner, Rest verworfen | `leitePers` 36792–36794 (`best`) |
| Egomaniac wirkt aufs Verhalten | **wirkungslos**: fehlt in `PW.minus` | `verhalten-drei-stufen-board-text-03-11.md` 2.3, nachgeprüft |
| je Disziplin unterschiedlich | nur an/aus je Kanal (`persHandwerk`), keine Gewichtung je Disziplin | engine.js 7850–7860 |
| läuft im Hintergrund | ja, abgeleitet, keine manuelle Einstellung | `neuPersBerechnen` |

**Die Trait-Abdeckung ist lückenhaft** (gezählt gegen die kanonischen Listen):

- `PW.plus` kennt 12 von 18 positiven Traits. Es fehlen Disciplined, Fair, FanFavorite, Fearless,
  Resourceful und Sexy.
- `PW.minus` kennt 11 von 18 negativen. Es fehlen Cheater, Diva, **Egomaniac**, Gambler,
  Scandalous, Cruel und Vindictive.
- **13 der 36 Traits beeinflussen die Persönlichkeit heute gar nicht.** Ausgerechnet die
  persönlichkeitsstärksten Begriffe (Egomaniac, Diva, Cruel, Vindictive, Gambler) gehören dazu.

**Es gibt schon einen Prototyp der Achse „Team gegen Ego“:** `sandsackPersoenlichkeit()`
(engine.js 21260) rechnet aus der Persönlichkeit einen Skalar `team` ∈ [0,1]. Die Formel lautet
0,40·Zusammenhalt + 0,30·Bindung + 0,20·Zielneigung-Ego + 0,10·Haltung-Ego. Daraus wählt er den
Lastenplan, und der Plan „anker“ ist ausdrücklich der Ego-Fall: „der Egoistischere beansprucht an
JEDER Station zwei der drei Säcke — ob er dort der Schnellere ist oder nicht. Das ist der
eingebaute Preis des Egos“ (21681). Das sitzt hinter `BUEHNE_FLAGS.gewichthebenSandsack:0`, ist
also **aus**. Konzeptuell ist es aber genau Chris' Beispiel: Ein Ego-Spieler befolgt den
teamdienlichen Plan nicht.

### 1.4 Wo die Persönlichkeit heute im gebuchten Spiel ankommt

Die Bestandsaufnahme vom 03.11. (`verhalten-drei-stufen-board-text-03-11.md` 2.5, simuliert
nachgemessen) gilt im Kern weiter:

- **Spurt, Takeshi, Staffel:** Die Persönlichkeit wirkt (Rempler bzw. Bein-Haltung).
- **TDM, Mini-DM, Battlefield:** Sie wirkt nur im Entwurfskampf. Gebucht werden diese drei über die
  PPS-Brücke, oder über die Pod-Chassis, die `persOf` nicht lesen.
- **Die übrigen 14:** Sie wirkt nicht.

Hinzu kommt eine Grundtatsache, die jedes Rempler-Feature begrenzt: **Im Manager-Modus wird gar
nicht simuliert.** Dort entscheidet das aggregierte Score-Modell
(`lib/lineups/legacy-score-engine.ts`). Im Battle-Modus zählen nur die Disziplinen in
`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/battle/arena-resolved-disciplines.ts` 391ff.) mit dem
Motorergebnis. Das sind heute 15: alle Bühnen, alle Bahnen, Basketball und I-Spy. Hockey, Football,
TDM, Mini-DM und Battlefield laufen weiter über die PPS-Duell-Brücke.

**Ein persönlichkeitsgesteuerter Rempler wirkt sich also nur dort auf Ergebnisse aus, wo der Motor
gewertet wird. Überall sonst ist er reine Anzeige im Live-Zuschauen.** *Zweite Runde: Chris hat
bestätigt, dass es nur um den Battle-Mode geht. Der Manager-Pfad bleibt ausdrücklich außen vor.* Für Hockey heißt das: Selbst
ein perfekter Check-Umbau zählt erst, wenn Hockey die Pp-Schranke besteht (Abschnitt 3.3).

---

## 2. Bestehende Check-/Tackling-Mechaniken: drei Bauarten, eine davon portierbar

### 2.1 Bahn-Rempler (Spurt, Takeshi): das Muster, das trägt

Fundstelle `stepSpurt`, Block „TACKLE“, engine.js 48857–48990. Der Ablauf:

```
willTackeln = {draufgaenger:.9, duellant:.55, schleicher:.5, opportunist:.7, bollwerk:.25}[u.pers] ?? .5
tackleOk    = BA().tackle && Abklingzeit frei && nicht im Hindernis && u.WUCHT > tackleAb
              (+ Takeshi: nur im 5-%-Fenster vor einer Falle, tackleFenster)
Wurf        rr() < willTackeln * dt * tackleRate * (Chaos-Faktor)
Opfer       gegnerische Seite, |bahnZ-Diff| <= tackleSpur (1,6), |pos-Diff| < 0,035
Ausweichen  (nur Takeshi) TECHNIK(Opfer) gegen WUCHT(Täter) * 0,35, Deckel 0,75
Treffer     stark = WUCHT/(WUCHT+ROBUST); bei Treffer: o.stolper, o.reserve -18, Zähler
```

Was das Muster portierbar macht:

- **Alles hängt an `BAHN_ART[d]`-Feldern:** `tackle`, `tackleAb`, `tackleRate`, `tackleKosten`,
  `tackleCd`, `tackleFenster`, `tackleAusweichen`, `tackleSpur` und `tackleAlleSeiten`. Eine neue
  Bahn-Disziplin schaltet das ohne neuen Codepfad ein. Spurt setzt `tackle:true` (44718), Takeshi
  setzt `tackle:true, tackleAb:30, tackleRate:2.0, tackleFenster:0.05, tackleAusweichen`
  (45660–45661). Staffel (45491), Climbing (45302) und Time-Trial (44923) stehen auf
  `tackle:false`.
- **Die Persönlichkeit steuert nur die Häufigkeit, nicht den Ausgang.** Ob ein Rempler sitzt,
  entscheiden WUCHT, ROBUST und TECHNIK, also Sub-Skills aus dem Rezept und damit aus den
  Matrixattributen. **Genau diese Trennung macht das Muster abnahmefest:** Die eignungsfremde
  Persönlichkeit wählt nur die Gelegenheit, das Ergebnis bleibt eignungsgebunden. Im Code steht
  ausdrücklich, dass WUCHT „auch Gelegenheiten kauft“, weil Torment vorher nur 2,2 % trug (48862ff.).
- **RNG-Disziplin:** Neue `rr()`-Würfe stehen nur hinter Flags, damit die übrigen Bahnen
  bit-identisch bleiben (Kommentar 48880–48884). Jede Ausweitung muss dieselbe Disziplin halten.

Zwei Kleinigkeiten, die beim Ausweiten auffallen:

- `willTackeln` hat einen Schlüssel `taktiker`, den es als Archetyp nicht gibt.
- `beschuetzer` fehlt in der Tabelle und fällt deshalb auf den Default 0,5. Ob das gewollt ist, ist
  nicht dokumentiert.

**Staffel und Climbing auf Rempler zu schalten ist mechanisch ein Flag, inhaltlich aber nicht
trivial:**

- **Staffel** läuft auf `bahnenFest:2` (eine Bahn je Mannschaft, 45475). Die Abstandsprüfung
  `|bahnZ-Diff|<=1,6` würde die zwei gerade laufenden Läufer zu Rempel-Partnern machen. Das ist
  möglich, widerspricht aber dem eigenen Kommentar „in einer Staffel räumt niemand den Gegner von
  der Bahn“ (45473). Zudem hat WUCHT dort inzwischen eine **andere** Bedeutung, „Zug an der Spitze“
  (48176–48186, gegen einen toten Kanal eingeführt). Ein Rempler würde WUCHT doppelt belegen, und
  die Pp-Verteilung (heute 21,1|22,0, also nah an der Schranke) verschiebt sich.
- **Climbing** klettert in **sechs Paaren auf gespiegelten Routen** (Kommentar `C4a: DUELL-BAND`,
  engine.js ~44374). Physisch nebeneinander sind also nur die zwei Kletterer eines Paares. Ob die
  Bahn-Geometrie (`bahnZ`) bei Climbing die Paare benachbart führt und ob `huerde>0` (Griff-Stopp)
  fast die ganze Zeit greift und damit `tackleOk` sperrt, habe ich **nicht nachgemessen**.
  Vermutlich braucht Climbing eine eigene Rempel-Form (Seil ziehen, Griff wegnehmen) statt der
  Lauf-Rempelei.
- **Time-Trial** hat keine gleichzeitigen Gegner (Einzelstart, `startAbstand`). Ein Rempler ist
  dort strukturell sinnlos.

### 2.2 Hockey-Bodycheck: eng verdrahtet, persönlichkeitsfrei

Fundstelle `versucheSteal(decker,traeger,art)`, engine.js 15012. Der Block „BODYCHECK“ steht ab
15051 hinter `if(istHockey())`. Konzept und Messungen dazu:
`docs/design/hockey-ausdauer-checks-konzept-13-09.md` 1, 3.1–3.4.

```
wucht = clamp(0.04, 0.45, 0.16 + (decker.ABWEHR - wirksameAUSDAUER(traeger)) * 0.004)
bei Treffer: Puste-Kosten beidseitig nach Kontrast; 38 % Strafe ("Bandencheck");
             sonst taumeltBis/down, Puck wird frei, decker.checks++
```

Struktureigenschaften, die die Übertragung erschweren:

- **Er ist an den Steal-Versuch gekoppelt.** Aufgerufen wird er nur aus der Manndeckungsschleife
  (`v.deckt===traeger`, Reichweite `STEAL_REICHWEITE`, feste Abklingzeit 2,0 s). Er trifft **nur
  den Puckführer** und **ist immer der Ballverlust** (Konzept 3.1: „architektonisch unmöglich“,
  einen Spieler ohne Puck zu checken).
- **Keine Persönlichkeit, keine Häufigkeitsneigung.** Wie oft gecheckt wird, bestimmen Aufstellung
  und Deckung, wie hart ABWEHR gegen AUSDAUER.
- **Gemessen nicht zu selten:** 16,0 sitzende Checks je Spiel, je Skater mehr als in der NHL
  (Konzept 1.4). Mehr Checks sind also nicht das Ziel. Persönlichkeit hieße hier **Umverteilung**
  (wer checkt), nicht Vermehrung.
- **Basketball** hat keinen Körperkontakt-Zweig, der Block ist hockey-exklusiv. **Football** hat
  ein eigenes, play-basiertes Tackle-System (Solo-Tackle `u.checks`, engine.js ~12526/13075). Das
  ist ein drittes Muster und läuft ohnehin über die PPS-Brücke (Pp 121,0 / 120,1).

**Urteil:** Den Hockey-Check zu „personalisieren“ ist machbar. Man würde `wucht` mit einem
Neigungsfaktor je Archetyp multiplizieren und einen zusätzlichen Check gegen Spieler ohne Puck
einführen (Konzept 7). Als **projektweite Vorlage** taugt er aber nicht, dafür ist er zu stark an
Puck-Besitz und Manndeckung gebunden. Die Vorlage ist der Bahn-Rempler.

### 2.3 Arena-Chassis: Rempler sind dort schon „Angriffe“

In TDM, Mini-DM und Battlefield ist jeder Kontakt ein Kampf. Ein zusätzlicher Rempler wäre
redundant. Die Persönlichkeit wirkt dort bereits über Zielwahl und Haltung. Dazu kommt die
gemessene Lehre: Zusammenhalt und Bindung waren die Fehlordnungsquelle (Abschnitt 3.2).

### 2.4 Bühnen-Chassis: keine Kontaktmechanik, Würfe vorab

`bauBuehne()` (engine.js 20107) berechnet für jeden Teilnehmer alle Durchgänge vorab (`runden[]`).
`stepBuehne` deckt sie nur auf, und die Bewegungs-Funktionen (`stepKuer`, `stepTennis`,
`stepFechten` und weitere) haben einen ausdrücklichen Vertrag: nur `viz*`-Felder schreiben, nie
`rr()` rufen (Kommentar 27302ff.). Eine Interaktion zwischen zwei Teilnehmern gibt es dort nur in
den Duell-Bauarten (Heben-Duell, Gauntlet, `duell:true`) und im Eiskunstlauf-Duett (80/20-Fusion,
20682). Beides ist vorab und deterministisch verrechnet. **Ein Rempler auf einer Bühne muss deshalb
ebenfalls vorab in `bauBuehne()` gewürfelt werden.** Live in der Bewegung ginge es nur, wenn man
den Vertrag bricht, und genau dieser Vertrag macht die Bühnen heute bit-identisch messbar.

---

## 3. Governance: Was ein persönlichkeitsgesteuerter Rempler mit rho und Pp macht

### 3.1 Die Mechanik in einem Satz

Die Persönlichkeit ist **eignungsfremd**: Sie hängt an Klasse, Rasse, Unterklasse und Traits, nicht
an den zwölf Matrixattributen. Jede Wirkung, die sie aufs Ergebnis hat, ist für die Rangtreue
deshalb zunächst **Rauschen gegen die Eignung**. Für die Pp-Messung bleibt sie unsichtbar,
`einflussVon()` hebt ein Attribut, die Persönlichkeit bleibt dieselbe. Sie verdünnt dort aber alle
Attributanteile oder verschiebt sie über Nebenpfade.

### 3.2 Was schon gemessen ist

| Befund | Zahl | Quelle |
|---|---|---|
| Persönlichkeit als Fehlordnungsfaktor (ε², k=6) | TDM **0,229**, Mini-DM 0,133, Battlefield 0,100 | `arena-zielwahl-opus-empfehlung-02-10.md` 1.1 |
| Welcher Kanal trägt sie | **Zusammenhalt + Bindung**, nicht Zielneigung, nicht Haltung | ebd. 0 und 2 |
| Neutralisieren hebt rho | TDM 0,32 → 0,42; Mini-DM 0,37 → 0,59; Battlefield 0,40 → 0,58–0,62 | ebd. 0.3 |
| … kann aber Pp reißen | Battlefield **+27,1 / +36,8 Pp** → Abbruch, `persHandwerk:[]` | ebd. 10.3 |
| Bahn-Rempler mit Persönlichkeitsfrequenz besteht | Spurt 0,910 / 19,4\|14,9; Takeshi 0,898 / 18,9\|17,7 | `data/generated/disziplin-abnahme.json` |
| Takeshi: 13,3 Rempler und 5,4 Treffer je Rennen, korrelieren mit der Eignung zu 0,85/0,88 | – | engine.js 45637–45646 (Kommentar `BAHN_ART["takeshis-castle"]`) |

**Die Lehre:** Persönlichkeit, die die **Gelegenheit** steuert (Spurt/Takeshi), ist verträglich.
Persönlichkeit, die die **Ausführung einer Rolle** verschlechtert (Zusammenhalt/Bindung in der
Arena: Draufgänger läuft allein los und lässt sich stellen), erzeugt Fehlordnung. **Chris'
„Egomaniac befolgt den Teamslot nicht“ ist die zweite Sorte.** Sie lässt sich bauen, braucht aber
eine Gegenbuchung (Abschnitt 5.4).

### 3.3 Stand der Schranken in den betroffenen Disziplinen

Aus `data/generated/disziplin-abnahme.json`, Stand 16.10.–27.10.

| Disziplin | rho je Spiel | Pp (zwei Ströme) | Puffer für einen neuen Rauschkanal |
|---|---:|---|---|
| Spurt | 0,910 | 19,4 / 14,9 | gut |
| Takeshi | 0,898 | 18,9 / 17,7 | gut |
| Staffel | 0,937 | 21,1 / 22,0 | rho gut, **Pp knapp** |
| Climbing | 0,833 | 12,0 / 9,5 | **rho knapp** |
| Eiskunstlauf | 0,866 | 18,8 / 19,8 | mittel |
| Breaking | **0,801** | 14,3 / 13,9 | **keiner** (Beobachtungsliste) |
| Basketball | 0,832 | 15,6 / 16,7 | mittel |
| Hockey | 0,640 | **38,5 / 81,5** | verletzt schon heute, nicht gewertet |
| Fechten | 0,860 | 20,1 / 20,7 | mittel |
| Tennis | 0,813 | 6,9 / 4,4 | rho knapp |

### 3.4 Wie man es nach einer Umsetzung misst

Die Werkzeuge gibt es alle schon. Neu wäre nur ein Schalter, der den Persönlichkeitskanal je
Disziplin auf „neutral“ stellt (siehe 5.3). Damit wird jede Messung zur Gegenprobe.

1. **Nullprobe (Bit-Identität):** Kanal aus → SHA-256 über alle Teilnehmerlisten muss dem Stand
   vor dem Umbau entsprechen. Vorlage ist
   `scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs`, Prüfschritt (N). Das Skript
   fingerprintet bereits je Disziplin und Saatstrom.
2. **rho je Spiel und Saison:** `node scripts/miss-alle-disziplinen.mjs 24 <diszi …>`, einmal mit
   Kanal aus, einmal an, gleicher Checkout. Gelesen werden beide Spalten (CLAUDE.md „Die zwei
   Spalten lesen“): Sinkt die Saisonzahl, belohnt der Rempler das Falsche. Sinkt nur die
   Einzelspielzahl, ist er nur laut.
3. **Star und Paartreue:** `scripts/miss-star-paartreue.mjs` (im P1-Skript referenziert). Die
   ehrlichere Abnahme laut CLAUDE.md sind der Star auf Rang 1, der Star in den Top 2 und Paare mit
   mindestens 15 Punkten Abstand. Das P1-Kriterium (D) „je Strom höchstens 3 Prozentpunkte unter
   Ist“ lässt sich direkt übernehmen.
4. **Pp-Abweichung, zwei Saatstämme:**
   `node scripts/messe-arena-einfluss.mjs <diszi> 48` und dasselbe mit
   `--saat-versatz=10000000`, oder `messe-arena-einfluss-zweiter-saatstamm.mjs`. Das Protokoll
   verlangt n=48 (Basketball-Korrektur 26.10. in `disziplin-abnahme.json`). Zusätzlich zur
   absoluten Schranke ≤ 25 gilt ein **Delta-Kriterium** wie P1-F: höchstens +6 Pp gegen Ist, sonst
   Abbruch.
5. **Wie viel trägt die Persönlichkeit wirklich?** `scripts/miss-arena-rangvarianz-aufschluesselung.mjs`
   rechnet eta² je Faktor. Dabei ε² statt eta² berichten (Korrektur ebd. 1.1), sonst zeigt der
   Faktor bei k=6 und n=40 allein durch Zufall 0,128.
6. **Anwendbarkeitsgrenze der Pp-Sonde:** `einflussVon()` (engine.js 58340) hebt Attribute. Wird
   die Persönlichkeit künftig **auch** aus Attributen abgeleitet (Chris' Skizze), würde
   `einflussVon` den Persönlichkeitswechsel mitmessen. Das ist korrekt, kann aber Attribute ohne
   Matrixgewicht hochspülen. Dann ist Pp genau die richtige Bremse. Siehe 5.2 zur Frage, ob
   Attribute überhaupt einfließen sollen.
7. **Verhalten statt Zahlen:** Die Sonden aus `verhalten-drei-stufen-board-text-03-11.md` (Anhang)
   messen, ob ein Archetyp tut, was der Text verspricht (Zieltreffer, Tiefe). Für die Rempler
   bietet sich dasselbe an: Rempler je Archetyp und Spiel, Anteil, den der Draufgänger trägt.
   Die Boxscore-Spalte „Rempl“ (engine.js 46152) liefert das schon.

Abbruchkriterien, aus P1 übertragen (`arena-zielwahl-opus-empfehlung-02-10.md` 7):

- (A′) rho je Spiel ≥ Ist − 0,02 **und** > 0,80 in beiden Strömen.
- (D) Star und Paartreue höchstens 3 Prozentpunkte unter Ist.
- (F) Pp ≤ 25 **und** höchstens +6 Pp gegen Ist, je Strom.
- (S) keine `pageerror`.

### 3.5 Zweite Runde: Dosis statt Verbot, wenn spürbare Verschiebung erwünscht ist

Chris will ausdrücklich, dass Persönlichkeit ein Spiel zum Besseren oder Schlechteren wenden kann.
An der Technik ändert das wenig, an der **Haltung** der Messung viel.

**1. Die Messung wird eine Dosis-Wirkungs-Kurve statt eines Ja/Nein.** Jeder Persönlichkeitskanal
bekommt je Disziplin eine Stärke `staerke ∈ [0, 1]`. 0 ist bit-identisch zum heutigen Stand, 1
ist die volle Taxonomie-Wirkung. Gemessen wird bei mehreren Stufen, etwa 0, 0,25, 0,5, 0,75 und 1,
jeweils mit:

- rho je Spiel und Saison,
- Star/Paartreue,
- Pp auf zwei Strömen,
- **und einer neuen Wirkungsgröße**: Wie weit verschiebt Persönlichkeit die Ergebnisse
  tatsächlich? Das ist ε² der Persönlichkeit (`miss-arena-rangvarianz-aufschluesselung.mjs`) bzw.
  der mittlere Rangsprung zwischen Kanal an und aus bei gleicher Saat.

Eingestellt wird die **stärkste** Stufe, die die CLAUDE.md-Schranken noch besteht. Bisher galt die
schwächste Stufe, die man nicht vermeiden kann. Das Stellrad „runterdosieren später“ ist damit
eine Zahl je Disziplin, kein Umbau.

**2. Das Abbruchkriterium wandert vom Delta zur absoluten Schranke.** Die Kriterien in 3.4 waren
konservativ gegen den Ist-Stand formuliert: (A′) „rho höchstens −0,02 gegen Ist“ und (F)
„höchstens +6 Pp gegen Ist“. Nach Chris' Antwort ist ein spürbares Minus beabsichtigt. Es gelten
die absoluten Schranken: rho je Spiel > 0,80, Pp ≤ 25 auf beiden Strömen, Star/Paartreue als
Beobachtung. Das Delta-Kriterium bleibt nur als **Diagnose**. Ein Pp-Sprung zeigt, dass die
Persönlichkeit über einen Nebenpfad Attribute belohnt, die die Matrix nicht trägt. Das ist dann
ein Konstruktionsfehler des Kanals, kein Zeichen für zu viel Persönlichkeit.

**3. Der Konstruktionsgrundsatz, der Wirkung und Rangtreue zugleich ermöglicht.** Chris' zwei Bilder
(„reißt alles an sich und rockt“ gegen „will alles allein machen und scheitert grandios“) sind
**dieselbe Aktion mit verschiedenem Ausgang**. Hängt der Ausgang an der Eignung, gilt:

```
Persoenlichkeit -> WIE OFT er eigenmaechtig handelt   (Neigung, eignungsfremd, Stellrad)
Eignung/Sub-Skill -> OB es gelingt                    (Duell wie stark = WUCHT/(WUCHT+ROBUST))
Gelingt es:  mehr eigene Punkte/Leistung (er reisst es an sich)
Misslingt:   eigener Malus + Teammalus   (er scheitert grandios)
```

Damit **spreizt** die Persönlichkeit die Ergebnisse entlang der Eignung, statt quer dazu zu
streuen. Der starke Egoist steigt, der schwache fällt. Für die Einzel-Rangtreue ist das neutral
bis günstig: Es vergrößert die Abstände in der richtigen Richtung. Kosten entstehen bei der
Verlässlichkeit, weil ein Alles-oder-nichts-Wurf das Einzelspiel lauter macht, und bei der
Team-Ergebnistreue. Beides ist genau die Dosis, die man mit `staerke` einstellt.

**Das ist der Unterschied zum Fehler vom 02.10.** Damals hat die Persönlichkeit die **Ausführung
für alle gleich verschlechtert**: Der Draufgänger lief allein los und ließ sich stellen, egal wie
gut er war. Das ist Streuung quer zur Eignung, und die kostet rho, ohne Chris' Bild zu erzeugen.
Ein rockender Egoist kommt in diesem Bau gar nicht vor.

**4. Was sich am Vorschlag konkret ändert:**

| Vorher (erste Runde) | Jetzt |
|---|---|
| Rempel-Rate je Disziplin normieren, nur die Verteilung verschieben (5.3) | Normieren bleibt **Option**. Die Rate darf mit der Dosis steigen, wo Ereignisse fehlen (Rempler kosten keine Verlässlichkeit, solange der Ausgang eignungsgebunden ist). Hockey bleibt normiert, die Checkdichte liegt schon über der NHL |
| Rollentreue zuletzt, „höchstes Risiko“ | Rollentreue als **Kernkanal**, früh, aber mit eignungsgebundenem Ausgang und Stellrad (5.4) |
| Abbruch bei −0,02 rho / +6 Pp gegen Ist | absolute Schranken, stärkste bestehende Dosis gewinnt |
| Disziplinen ohne Puffer (Breaking, Climbing, Tennis, I-Spy) „zuletzt oder gar nicht“ | dort niedrigere Startdosis, nicht ausgeschlossen. Breaking (rho 0,801) bleibt praktisch bei 0, bis sein Puffer wächst |
| Erfolg = Persönlichkeit stört die Ordnung möglichst wenig | Erfolg = Persönlichkeit ist **sichtbar wirksam** (ε² > 0, Rangsprünge messbar) **und** die Disziplin besteht |

**5. Was trotz der neuen Haltung bindend bleibt:** rho > 0,80 je Einzelspiel und Pp ≤ 25 sind
CLAUDE.md-Pflicht für jede gewertete Disziplin. Chris hat sie in der Nachschärfung ausdrücklich
als Abnahmemaß bestätigt („als Ziel für die gewählte Dosierung, nicht als Totalverbot“). Eine
Dosis, die eine Disziplin unter 0,80 drückt, nimmt sie laut `disziplin-abnahme.json` aus der
Arena-Wertung. Dann zahlt sie über die PPS-Brücke, und die Persönlichkeit wirkt im gewerteten Spiel
gar nicht mehr. **Die Schranke ist damit kein Gegner der Vision, sondern die Bedingung, unter der
die Persönlichkeit überhaupt zählt.**

---

## 4. Eiskunstlauf: vier Aktive gleichzeitig

### 4.1 Wie es heute gebaut ist

- **Kein 1-gegen-1, sondern Startreihenfolge.** `BUEHNE_ART.eiskunstlauf` (engine.js 18374) setzt
  `duett:true`, 12 Durchgänge und 6 je Seite. `bauBuehne()` paart je Seite benachbart nach `eig`
  und fusioniert die Punkte 80/20 je Durchgang (`fusioniereSeite`, 20682). Bei ungerader
  Feldgröße läuft der Star solo (E-F2).
- **Ein Paar zur Zeit.** Seit 13.09. (Chris: „ich weiß nicht ob alle gleichzeitig sinnvoll ist“)
  baut `bauBuehne()` die Warteschlange gruppenweise und seitenweise verzahnt: schwächste Gruppe
  zuerst, Heim und Gast im Wechsel (Kommentar „STARTREIHENFOLGE“, ~20703). Mit E-F1 gibt es
  Kurzprogramm und Kür, also zwei Besuche je Paar.
- **Darstellung:** `stepKuer()` (27696) vergibt Rollen `kuer`, `warte`, `kiss` und `weg` aus
  `kuerStartliste()`/`kuerAktiveGruppe()` (27514/27531) bzw. `kuerBesuchsliste()`.
  `zeichneDuett()` (34174) zeichnet. Die Grundfahrt ist eine deterministisch gehashte
  Lissajous-Figur je Paar, ohne `rr()`.
- Vor dem 13.09. fuhren **alle sechs Paare gleichzeitig**. Das ist als Bild
  `docs/design/eiskunstlauf-vorher-13-09-alle-gleichzeitig.png` im Repo. Chris' neue Vorgabe „vier
  Aktive“ liegt also **zwischen** den beiden bisherigen Ständen.

### 4.2 Aufwand: zwei getrennte Schritte

**Schritt 1, vier Aktive anzeigen (klein–mittel, rangtreue-neutral):**

- Die Warteschlange ist schon seitenweise verzahnt. Man fasst je Startgruppenindex `gi` die
  Heim-Gruppe und die Gast-Gruppe zu **einem gemeinsamen Besuch** zusammen. Die Enthüllungen der
  vier dürfen sich dabei abwechseln.
- `kuerAktiveGruppe`/`kuerAktiverBesuch` liefern dann zwei Gruppen statt einer. Die
  Lissajous-Bahnen der zwei Paare brauchen räumliche Trennung (zwei Hälften oder phasenversetzte
  Figuren), sonst laufen sie durcheinander.
- Kiss-and-Cry, Zwischenstand-HUD (`kuerZwischenstandZeilen`, `zeichneEisStand`), L-C-Zeile und
  Kamera hängen alle an „ein aktives Paar“. Das sind etwa fünf bis acht Lesestellen.
- **Rangtreue-neutral aus demselben Grund wie die Startreihenfolge:** Die Warteschlange bestimmt
  nur die Aufdeckreihenfolge vorab gewürfelter `runden[]`, und `u.summe` ist
  reihenfolgeunabhängig (Kommentar ~20716–20722). Nachweis: `miss-alle-disziplinen.mjs 24
  eiskunstlauf` bit-identisch.
- Risiko: Die HUD-Überlappung war schon einmal ein Fund
  (`eiskunstlauf-vorher-13-09-hud-ueberlappung.png`). Mit zwei Paaren wird der Platz knapper.

**Schritt 2, Rempler zwischen den vier (mittel–groß, volle Abnahme):**

- Er muss **vorab in `bauBuehne()`** gewürfelt werden (2.4). Skizze: Für jeden gemeinsamen Besuch
  und jeden Durchgangsindex wird geprüft, ob ein Läufer des einen Paares einen des anderen stört.
  Die Neigung kommt aus der Persönlichkeit, die Wirkung aus einem Duell der Sub-Skills, analog
  `stark = WUCHT/(WUCHT+ROBUST)`. Bei Treffer wird `runden[r]` des Opfers vor der Fusion auf
  `failWort` gesetzt bzw. `punkte` gemindert.
- **Problem 1:** Das Bühnen-Rezept von Eiskunstlauf hat **keinen Wucht-/Robustheits-Kanal**
  (Rollen GRUNDLAGE, SPITZENMOMENT, TECHNIK, PUBLIKUM, NERVEN, AUSDAUER, WAGNIS; 18374ff.).
  Torment, Power und Health haben in der Matrix für Eiskunstlauf **Gewicht 0** (engine.js 7926).
  Ein Rempel-Duell über Power/Torment würde also Attribute ohne Matrixgewicht belohnen, und das
  verbietet die Pp-Pflicht. **Die Wirkung müsste aus Matrixattributen kommen:** Ausweichen aus
  awareness/dexterity, Weiterlaufen nach Störung aus determination/spirit. Nur die Neigung käme aus
  der Persönlichkeit. Inhaltlich passt das („wer sauber läuft, lässt sich nicht aus dem Tritt
  bringen“), aber der Rempler wird damit ein **Fehler-Auslöser beim Opfer**, kein Kraftduell.
- **Problem 2:** Mehr Ausfälle bedeuten mehr Varianz je Spiel. Eiskunstlauf hatte schon einmal ein
  reines Verlässlichkeitsproblem (rho 0,792, behoben durch Verdoppeln der Durchgänge, Kommentar
  18378ff.). Ein Rempelkanal mit spürbarer Häufigkeit frisst diesen Puffer wieder an.
- **Problem 3:** Der Duett-Partner. Ein Rempler auf Läufer A trifft durch die 80/20-Fusion zu 20 %
  auch B. Das ist gewollt, muss aber bei der Pp-Zuordnung bedacht werden.

### 4.3 Welche anderen Disziplinen dieselbe Frage hätten

| Disziplin | Format heute | Mehrere Aktive gleichzeitig? | Rempler sinnvoll? |
|---|---|---|---|
| Eiskunstlauf | Startreihenfolge, ein Paar | → Chris: zwei Paare | ja (Vision) |
| Breaking | Gauntlet, 1-gegen-1 im Ring, abwechselnd | strukturell 1-gegen-1 (Folter: einer fügt zu, der andere hält aus) | nein, die „Rempelei“ IST die Disziplin |
| Gewichtheben | Heben-Duell Slot n gegen Slot n, ein Duell im Fokus | denkbar | kaum (Hantel) |
| Fechten, Tennis, Speed-Schach | `duell:true`, Slot gegen Slot | Mehr-Paar-Anzeige nicht geprüft | Fechten/Tennis sind schon Kontakt- bzw. Gegnerformate |
| Showcase, Wettessen, I-Spy | Auftritt, jeder für sich | Wettessen: alle an der Tafel (`mauer:true`) | Wettessen: „Teller wegschubsen“ wäre denkbar |
| Climbing | sechs Paare gleichzeitig auf gespiegelten Routen | **schon heute** | ja, aber eigene Form (2.1) |
| Staffel | ein Läufer je Team, zwei Bahnen | schon heute 2 Aktive | geht, widerspricht aber eigenem Kommentar (2.1) |
| Spurt, Takeshi | alle gleichzeitig | ja | **gebaut** |

Ob Fechten, Tennis und Schach heute alle sechs Duelle gleichzeitig oder nacheinander zeigen, habe
ich **nicht im Detail geprüft**. Die Weichen stehen in `zeichneBuehne()` (31285).

---

## 5. Architektur-Vorschlag: eine Persönlichkeits-Ableitungsschicht

### 5.1 Grundsätze

1. **Die Matrix bleibt unangetastet** (CLAUDE.md, „endgültig“). Die Schicht liest
   `official-discipline-weights.ts` nicht und schreibt nichts in `eig`/`aufEignung()`.
2. **Persönlichkeit wählt, Eignung entscheidet.** Das ist das Bahn-Rempler-Prinzip (2.1).
   Persönlichkeit darf Häufigkeit, Gelegenheit, Zielwahl und Stil steuern. Den **Ausgang** jedes
   Kontakts entscheiden Sub-Skills aus Matrixattributen.
3. **Ein Kanal je Disziplin, einzeln schaltbar und mit Nullprobe.** Das ist das Muster
   `persHandwerk`. Jede Disziplin erklärt, welche Persönlichkeitskanäle bei ihr wirken. Fehlt die
   Erklärung, verhält sie sich bit-identisch zu heute.
4. **Kein neuer `rr()`-Wurf ohne Flag** (RNG-Disziplin, 2.1).

### 5.2 Wo sie lebt

**Empfehlung: zwei Ebenen, eine Quelle.**

- **Ableitung als reine Funktion**, etwa in `lib/personality/derive-personality.ts`. Sie bekommt
  `{className, race, subclasses, traitsPositive, traitsNegative}` und liefert
  `{haupt, neben[], achsen:{ego, wucht, vorsicht, …}, warum[]}`.
  - Eingang dafür ist **die bestehende `PW`-Tabelle**, aus engine.js herausgelöst und um die 13
    fehlenden Traits erweitert. Welche Punkte Egomaniac, Diva, Cruel usw. bekommen, ist Fables Teil.
  - Die Nebenpersönlichkeit ist einfach der zweithöchste Stapel, wenn er einen Mindestabstand
    erreicht. Die Kombination wird als **gewichtete Mischung** der Archetyp-Parameter gerechnet
    (z. B. 70/30), nicht als zweiter Schalter. So bleiben alle Folgetabellen (`willTackeln`,
    `STAFFEL_PERS_HALTUNG`) mit Zwischenwerten nutzbar.
  - Zusätzlich ein paar **kontinuierliche Achsen**, deren Prototyp `sandsackPersoenlichkeit().team`
    ist (1.3). Eine Ego-Achse beantwortet Chris' Beispiel direkter als sechs Archetypen.
- **Spiegelung im Motor.** engine.js ist ein Browser-Skript ohne Build-Import aus `lib/`. Es gibt
  zwei Wege:
  - (a) Die Tabelle als JSON in `references/` ablegen und von TS und engine.js gemeinsam lesen
    lassen. Muster wäre `battle-mode.rezepte.js` als eigene Skriptdatei.
  - (b) Das Ergebnis über den Adapter mitschicken: `ArenaSpieler.pers` in `arena-kader-adapter.ts`.

  **(a) ist besser.** Mit (b) hinge der Entwurfskampf (Demo-Kader ohne Adapter) an einer anderen
  Quelle als das gebuchte Spiel, und genau so eine Doppelquelle hat `neuPersBerechnen` schon einmal
  eingefroren (Kommentar 36798ff.).
- **Attribute als Eingang?** Chris' Skizze nennt „Attribute + Traits (+ Klassen)“. Technisch ist
  das möglich, aber mit Vorbehalt. Leitet sich die Persönlichkeit aus Attributen ab, wird sie
  teilweise eignungs**nah**, und `einflussVon()` misst sie mit (3.4 Punkt 6). Das kann sogar
  helfen, wenn das Attribut in der betreffenden Disziplin Matrixgewicht hat. Es hilft nicht, wenn
  es keines hat (etwa Torment → Rempel-Neigung im Eiskunstlauf).
  **Vorschlag:** Attribute nur als **Feinanteil** in einzelnen Achsen zulassen (etwa Torment hebt
  die Wucht-Achse ein wenig) und das je Disziplin mit Pp prüfen. Den Archetyp selbst weiter aus
  Klasse, Rasse, Unterklasse und Traits bestimmen. Das muss Chris entscheiden.
  *Zweite Runde: Chris hat entschieden, dass Traits primär und Attribute sekundär einfließen. Als
  Beispiele nennt er Torment (Bereitschaft zu verletzen) und Determination (lässt sich nicht
  abbringen). Das deckt sich mit Fables gedeckeltem Form-Modifikator. Technisch heißt das: Die
  Attributanteile wirken nur als gedeckelte Zuschläge auf die Achsen und kippen nie allein den
  Rang 1 der Persönlichkeit. Die Pp-Messung je Disziplin zeigt, ob Torment dabei in Disziplinen
  ohne Torment-Matrixgewicht unerlaubt trägt.* Die Ausgabe wird außerdem eine **Rangliste mit drei
  Plätzen** (`rang:[p1,p2,p3]` mit Punktwerten) statt `{haupt, neben[]}`. Das ist dieselbe
  Sortierung, nur nicht abgeschnitten. Ob Platz 3 mechanisch mitwirkt (etwa 65/25/10) oder nur
  angezeigt wird, lässt sich je Disziplin über dieselbe Mischfunktion schalten.

### 5.3 Wie sie Simulationsentscheidungen beeinflusst

Je Chassis ein dünner Leser, alles hinter einem Disziplin-Feld:

```
// Pseudocode, kein Projektcode
PERS_KANAELE[dId] = { rempelNeigung: true, rollentreue: false, zielneigung: true }   // fehlt → heute

rempelNeigung(u, dId) =
  PERS_KANAELE[dId]?.rempelNeigung
    ? mische(TABELLE_REMPEL, u.pers.haupt, u.pers.neben)      // z.B. Egomaniac/Draufgaenger hoch
    : ALTE_KONSTANTE                                          // bit-identisch

// Bahn (bestehend):  willTackeln := rempelNeigung(u, dId)
// Feldspiel Hockey:  wucht *= 0.7 + 0.6*rempelNeigung(decker, dId)   (Umverteilung, Summe normieren)
// Buehne Eis:        in bauBuehne(), je gemeinsamem Besuch und Durchgang, vorab gewuerfelt
```

**Normieren als Option, nicht als Pflicht (zweite Runde).** Man kann die mittlere Rempel-Rate je
Disziplin festhalten (Mittel über die Kaderfamilie) und nur die **Verteilung** nach Persönlichkeit
verschieben. Für Hockey bleibt das richtig: Die Checkdichte liegt schon über der NHL (2.2).
Anderswo darf die Rate mit der Dosis steigen, denn Chris will spürbare Wirkung. Solange der Ausgang
eignungsgebunden ist (3.5 Punkt 3), kosten zusätzliche Rempler wenig Rangtreue. Jeder Leser
bekommt dafür den Faktor `staerke[dId][kanal]`:

```
neigung = basis + staerke * (mische(TABELLE, u.pers.rang) - basis)   // staerke 0 -> bit-identisch
```

### 5.4 Rollentreue („Egomaniac im Teamslot“): spürbar, aber entlang der Eignung

*Zweite Runde: Das ist nicht mehr „der riskanteste Teil“, sondern der Kern von Chris' Vision. Er
soll Spiele erkennbar kippen lassen. Die frühere Warnung bleibt nur als Bauhinweis: Der in der
Arena gemessene Fehler entstand, weil die Abweichung für alle gleich schadete (3.5 Punkt 3). Die
Leitplanken unten sorgen dafür, dass sie stattdessen entlang der Eignung spreizt.*

Drei Leitplanken:

1. **Abweichen kostet das Team, nicht zwingend den Spieler.** Der Sandsack-Plan „anker“ zeigt die
   Form: Der Egoist nimmt sich mehr Anteil, ob er der Bessere ist oder nicht (engine.js 21681).
   Für die Einzel-Rangtreue ist das sogar günstig. Ein **starker** Egoist sammelt mehr eigene
   Punkte, und das trägt die Eignung. Ein **schwacher** Egoist schadet dem Team-Ergebnis. Das ist
   die Erzählung, die Chris will, und sie verletzt die Einzelordnung nicht. Die Team-Ergebnistreue
   (P1-Kriterium E) muss dafür mitgemessen werden.
2. **Abweichung nur dort, wo der Slot ein echtes Verhalten vorgibt.** Wo der Slot nur ein
   Attributprofil ist (die meisten Bühnen, siehe die Tabelle in `verhalten-drei-stufen-…` 3), gibt
   es nichts zu verweigern. Echte Ansatzpunkte:
   - Bahn: `planJeSlot`, z. B. ein Egoist läuft „vorn“ statt „schatten“ (engine.js 44834/45597).
   - Staffel: `STAFFEL_PERS_HALTUNG` mit „angreifen“ statt „absichern“ (47581). Die Kader-Regel
     über der Persönlichkeit existiert dort schon („Butterfinger bekommt keine weite Marke“).
   - Basketball: Formationsplatz je Slot (`BASKETBALL_ROLLE_SLOT`) und die Pass-/Wurf-Entscheidung.
     Den konkreten Entscheidungsknoten im Code habe ich **nicht** gefunden.
   - Arena: Befehl gegen `PERSORD` tauschen, wie in `verhalten-drei-stufen-…` 5.7 skizziert. Wirkt
     aber nur im Entwurfskampf, solange TDM, Mini-DM und Battlefield über die PPS-Brücke laufen.
3. **Wahrscheinlichkeit, kein Schalter, mit Stellrad.** Etwa „Egomaniac in einem Teamslot hält
   sich mit 60–80 % an den Plan“, gemischt mit Rang 2/3 (ein Loyal auf Platz 2 senkt die
   Abweichung). Die Abweichquote ist `staerke × Grundneigung`. Wie die Arena-Messung zeigt, sind
   kontinuierliche Abweichungen messbar steuerbar. Das P1-Muster (Skala auf Mitte zwingen) liefert
   bei `staerke=0` die Nullprobe.
4. **Konkretes Beispiel Staffel** (so liest sich Chris' Satz im Code): Der Slot verlangt
   „absichern“, der Egomaniac läuft mit Wahrscheinlichkeit p „angreifen“ (weite Marke, mehr Zug).
   Ob die weite Marke gelingt, entscheidet wie heute TECHNIK, also Matrixattribute. Gelingt sie,
   holt er Zeit für das Team (er rockt). Misslingt sie, kostet der Wechsel die ganze Mannschaft Zeit
   (er scheitert grandios). Die vorhandene Kader-Regel „unter TECHNIK 45 immer absichern“ (47575ff.)
   wird dafür bei Egoisten **aufgeweicht statt gestrichen**. Die Dosis steckt in genau dieser Regel.

### 5.5 Anzeige

Die Persönlichkeitszeile darf nur dort stehen, wo der Kanal wirkt. Das ist dieselbe Regel wie im
Board-Text vom 03.11. (Abschnitt 4 dort: „sonst wäre die Zeile eine Lüge“). Technisch heißt das:
Die Anzeige liest `PERS_KANAELE[dId]` statt `istArena(disc)`. So bleibt sie automatisch ehrlich,
wenn Kanäle an- oder abgeschaltet werden. Die Farbsprache (+/−) aus dem Oberflächen-Konzept (Teil 1)
lässt sich für „rempelt oft/selten“ übernehmen.

### 5.6 Animation

Die bestehenden Arten in `lib/data/figurenSprites.ts` 22 sind `walk | angriff | tod | treffer`. Der
Motor hat aber schon **Zustände ohne eigene Sprite-Art**:

- Bahn: `u.stolper` (drosselt auf 35 %, `down:u.stolper>0` in `zeichneSpurt`, ~46629/47890).
- Hockey: `down` und `taumeltBis`.
- Takeshi: `lungeVis` als Stoß-Pose des Täters (48909ff.).

Für das Opfer reicht kurzfristig `treffer` plus die vorhandene Stolper-Zeichnung. Eine fünfte Art
(„stolpern“) ist eine Sprite-Frage (PixelLab) und keine Simulationsfrage. Sie lässt sich unabhängig
nachziehen, die Simulation braucht sie nicht. `tod` ist dafür ungeeignet, wie die Vision selbst
sagt.

---

## 6. Risiken und Stellräder (zweite Runde neu gefasst)

Seit Chris' Antwort sind die ersten drei Punkte keine Risiken im Sinne von „vermeiden“ mehr. Sie
sind **Stellräder mit einer Obergrenze**. Echte Risiken bleiben die technischen Punkte ab 4.

1. **Wirkung durch Rollentreue und Rempler** (gewollt, Stellrad): Die gemessene Größenordnung vom
   02.10. (ε² bis 0,229) zeigt, dass Persönlichkeit stark wirken *kann*. Wie stark, regelt
   `staerke[dId][kanal]`. Obergrenze ist die stärkste Dosis, die rho > 0,80 noch hält.
   Konstruktionspflicht: Der Ausgang ist eignungsgebunden (3.5 Punkt 3), sonst entsteht Streuung
   quer zur Eignung statt Chris' „rockt/scheitert“.
2. **Pp-Verschiebung durch neue Kontaktkanäle** (Konstruktionsfehler, kein Dosisproblem):
   Rempel-Duelle laden dazu ein, Power, Torment und Health zu nutzen. Die haben in Eiskunstlauf,
   Tennis und Fechten wenig oder kein Matrixgewicht. Die Wirkung muss je Disziplin aus deren
   eigenen Matrixattributen kommen (4.2 Problem 1). Das gilt auch für Torment und Determination als
   sekundären Persönlichkeitseingang (5.2): Sie dürfen die Neigung färben, nicht den Ausgang.
3. **Disziplinen mit wenig Puffer** (Stellrad niedriger starten): Breaking (0,801), Climbing
   (0,833), Tennis (0,813) und I-Spy (0,811 auf Strom 2). Dort klein anfangen und hochmessen, statt
   auszuschließen.
4. **Hockey zählt ohnehin nicht** (strukturell): Solange Pp 38,5 / 81,5 beträgt, ist ein
   Hockey-Rempler reine Live-Optik. Der Aufwand lohnt sich erst nach der Rezeptkalibrierung.
5. ~~Manager-Modus~~: geklärt, nur Battle-Mode (Chris, zweite Runde).
6. **RNG-Strom-Kaskade** (technisch): Jeder neue `rr()` verschiebt alle folgenden Würfe. Ohne
   Flag-Disziplin sind Vorher/Nachher-Messungen nicht mehr bit-vergleichbar. `staerke=0` muss
   *auch keinen Wurf mehr* ziehen, nicht nur wirkungslos sein.
7. **Zwei Quellen für die Persönlichkeit** (technisch): engine.js und TS dürfen nicht
   auseinanderlaufen (5.2a).
8. **Paralleler Umbau von engine.js** (organisatorisch): Kulissen-Integration und
   Oberflächen-Effekte fassen dieselbe Datei an. Persönlichkeits-PRs klein halten, Ableitung zuerst
   außerhalb von engine.js.
9. **Die Schranke als Kippschalter** (neu): Wer eine Disziplin über die Dosis unter 0,80 drückt,
   nimmt sie aus der Arena-Wertung (`tests/disziplin-abnahme-guard.test.ts`). Dann wirkt die
   Persönlichkeit im gewerteten Spiel gar nicht mehr. Die stärkste Dosis ist also die
   *letzte bestehende*, nicht die erste durchfallende.

## 7. Was ich zuerst angehen würde (zweite Runde)

1. **PR 1, Ableitung (klein):** `PW` in eine gemeinsame Datei auslagern, mit Nullprobe
   (bit-identisch). Danach Fables Matrix über alle 36 Traits, eine Rangliste mit drei Plätzen und
   Torment/Determination als gedeckelter Sekundäranteil, alles als **reine Ableitung** ohne neuen
   Leser. Achtung: Weil Spurt, Takeshi und Staffel die Persönlichkeit schon lesen, ist der zweite
   Teil dort *nicht* bit-identisch. Er wird in genau diesen drei Disziplinen gemessen.
2. **PR 2, Stellrad-Gerüst plus Rempel-Neigung (klein–mittel):** `staerke[dId][kanal]` einführen
   (0 = heute), `willTackeln` durch die gemischte Neigung ersetzen, `taktiker`/`beschuetzer`
   bereinigen. Dosis-Wirkungs-Kurve für Spurt und Takeshi messen (3.5 Punkt 1). Das erste
   Ergebnis für Chris ist eine Tabelle „bei Dosis x verschiebt sich das so, rho bleibt bei y“.
3. **PR 3, Rollentreue auf der Bahn (mittel):** Staffel-Haltung und `planJeSlot` mit
   eignungsgebundenem Ausgang (5.4 Punkt 4), wieder mit Dosiskurve. Damit wird Chris'
   Egomaniac-Beispiel zum ersten Mal im gewerteten Spiel sichtbar.
4. **Parallel und unabhängig: Protokoll der Momente** (Abschnitt 10, Schritt 1). Ohne Protokoll
   kann niemand sehen, *ob* der Egoist gerockt oder versagt hat. Es gehört deshalb früh dazu und
   kostet keine Rangtreue.
5. **Eiskunstlauf vier Aktive als Anzeige (klein–mittel, bit-identisch).** Vorher Chris fragen, ob
   „vier“ auch für das Kurzprogramm gilt und wie es zu seinem Einwand vom 13.09. gegen „alle
   gleichzeitig“ steht.
6. **Danach** Climbing-Rempler (eigene Form), Eiskunstlauf-Rempler (vorab gewürfelt),
   Basketball-Rollentreue und Hockey nach dessen Pp-Kalibrierung.

## 8. Was ich nicht geprüft habe

- Keine eigene Messung. Alle Zahlen stammen aus `disziplin-abnahme.json` und den genannten Dokumenten.
- Climbing-Geometrie (`bahnZ` der Paare) und ob `huerde>0` den Rempler dort praktisch dauerhaft sperrt.
- Ob Fechten, Tennis und Schach ihre Duelle gleichzeitig oder nacheinander zeigen.
- Der Pass-/Wurf-Entscheidungsknoten im Basketball (Ansatzpunkt für „Egoist wirft statt passt“).
- Ob der Headless-Runner im gebuchten Battle-Spiel `neuPersBerechnen` für den echten Kader aufruft.
  Die Messung vom 03.11. (Spurt ändert sich mit Traits) spricht dafür. Den Runner-Pfad
  `lib/battle/arena-headless-runner.ts` habe ich dafür nicht gelesen.
- Fables Taxonomie (`persoenlichkeits-taxonomie-konzept-08-11.md`) habe ich nur in der Gliederung
  gelesen, nicht inhaltlich gegen die Architektur hier abgeglichen.

---

## 9. Zusatzfrage: Academy als Ort für Trait-Training? (kurze Ersteinschätzung)

**Befund im Code:**

- `lib/facilities/facility-catalog.ts` 209–227: `facilityId: "academy"`, Effekttyp
  `"low_tier_upgrade_discount"` (der Name ist historisch). Der reale Effekt ist `modifierPct`
  6–30 % auf das organische Trainingsbudget berechtigter F/E/D-Spieler (Rating < 45), gelesen über
  `getAcademyDevelopmentBoostPct` in `lib/training/organic-season-progression.ts` 1041.
  `discountPct` ist laut Kommentar tot. **Mit Traits hat die Academy nichts zu tun.**
- **Traits sind heute statisch.** Ich habe keine Stelle gefunden, die einem bestehenden Spieler
  einen Trait hinzufügt oder wegnimmt. Gesucht habe ich nach Zuweisungen auf
  `traitsPositive`/`traitsNegative` in `lib/` außerhalb von Tests. Gelesen werden sie vielfach
  (Training, Moral, Verhandlung). `lib/players/player-baseline-service.ts` 160/192/426/687 führt
  sie als Teil der **Spieler-Baseline**. Eine Trait-Änderung müsste deshalb auch die Baseline bzw.
  deren Rücksetzpfade berücksichtigen, sonst setzt ein Baseline-Lauf sie zurück. Ob das so ist,
  habe ich **nicht** im Detail geprüft.
- Die Fazilitäten haben ein sauberes Erweiterungsmuster: `FacilityEffectType` als Union,
  `levels[]` mit `modifierPct`/`upgradeCost`/`seasonUpkeep`, und der Specialist Wing zeigt
  **Varianten** innerhalb eines Gebäudes (`SpecialistWingVariant`).

**Einschätzung:** Die Academy ist ein **plausibler Erweiterungspunkt, kein neues Gebäude nötig**,
aber als neue *Funktion*, nicht als Umdeutung des bestehenden Effekts:

- **Technisch** ließe sich ein zweiter Effekttyp oder eine Variante ergänzen (Muster Specialist
  Wing), etwa „Trait-Kurs: einen Spieler je Saison zuweisen“. Die Abwicklung gehört an den
  Saisonend-Pfad, an dem `organic-season-progression.ts` ohnehin je Spieler entscheidet. Er kennt
  dort schon den Trait-Faktor (`traitModifierPct`, 1302).
- **Die Kosten**, die Chris andeutet (weniger Leistung), passen technisch zum vorhandenen
  Trainingsbudget. Ein Spieler im Trait-Kurs verzichtet auf einen Teil seiner organischen
  Entwicklung, statt dass eine neue Währung entsteht.
- **Was es wirklich teuer macht, ist nicht das Gebäude**, sondern die Folgewirkung. Ein Trait
  speist Mutator-Pool, Training, Moral, Verhandlung und künftig die Persönlichkeit. Ein
  Trait-Wechsel verschiebt also mehrere Systeme gleichzeitig, und die Persönlichkeits-Rangliste
  kann kippen. Das ist gewollt, muss aber in der Kader- und Picker-Anzeige erklärt werden.
- **Grob mittel bis groß, je nach Regelwerk.** Offene Designfragen, die nicht technisch sind:
  Welche Traits sind ab- oder antrainierbar (alle 36 oder nur „Charakterschwächen“ wie
  Egomaniac/Lazy)? Wahrscheinlichkeit oder Garantie? Wie lange dauert es?

## 10. Zusatzfrage: persönlichkeitsgetriebene Momente nachvollziehbar protokollieren (Architektur-Notiz)

**Was heute durch die Leitung kommt und was nicht:**

- Der Motor zählt schon: `u.tackles`, `u.getackelt`, `u.ausgewichen` (Bahn, engine.js 47207ff.),
  `decker.checks` (Hockey). Dazu kommt ein Ereignisprotokoll `logZug(seite, art, extra)`
  (engine.js 13773) im Feldspiel.
- Bei der App kommt davon **fast nichts an.** `ArenaFixtureResult` (`lib/battle/arena-headless-runner.ts`
  ~280–340) trägt nur `seiten`, `boxscore[{name, wert, playerId, side, torwart?}]`, also **einen
  Skalar je Spieler**, sowie im Feldspiel `momente` (drei „Spiel des Tages“-Momente aus
  `berechneFeldspielMomente`, 13824). In `lib/battle` und `lib/resolve` steht kein einziger
  Rempler-/Tackle-Zähler. In der Saisonbuchhaltung landet nur `battle_mode_arena_boxscore_impact`
  (`lib/foundation/season-points-ledger.ts` 25/282).

**Skizze in drei Schichten** (keine Umsetzung):

1. **Motor: strukturierte Ereignisse statt nur Zähler.** Jeder persönlichkeitsgetriebene Moment
   bekommt beim Entstehen einen Eintrag, z. B.:
   ```
   {typ:"rempler"|"rollenbruch"|"konflikt", akteur, ziel?, persRang1, kanal,
    ausgang:"gelungen"|"misslungen", wirkung:{zeit?, punkte?}, t}
   ```
   Wichtig ist das Feld **„Kanal plus Ausgang“**: Nur so lässt sich später „er riss es an sich und
   rockte“ von „scheiterte grandios“ unterscheiden. Vertragsregel wie bei `momente`: reine
   Nachlese, **kein `rr()`**, damit es bit-identisch und rangtreue-neutral ist.
2. **Brücke: ein neues optionales Feld am Ergebnis**, nach dem Vorbild `momente`, etwa
   `ArenaFixtureResult.persoenlichkeitsEreignisse` plus ein verdichteter Zähler je Spieler.
   Die Zuordnung zur echten Spieler-ID nutzt dieselbe Namensauflösung wie `boxscore.playerId`, mit
   derselben `null`-Regel bei Kollisionen.
3. **Persistenz: je Spieler und Spieltag eine Statistikzeile**, nicht nur der Saison-Skalar. Das
   ist das, was „Durchschnittsnoten wie im FM“ technisch braucht: eine Tabelle
   `(saison, spieltag, disziplin, playerId) → {wert, slot, rempler+/-, rollenbrueche gelungen/misslungen, …}`.
   Durchschnitte, Formkurven und „bester Slot“ entstehen dann als Abfrage, nicht als
   Zusatzlogik. Rohereignisse lassen sich optional je Spiel komprimiert ablegen, für ein
   Spielbericht-Replay.

**Wo das Protokoll den Rest der Vision füttert:** Dieselben Ereignisse sind der natürliche Eingang
für Chris' Rivalitäten- und Moral-Idee (Vision, Nachschärfung „Neue Ideen“ 1). Ein „Konflikt“
zwischen eigenen Spielern würde dort von `lib/morale/player-morale-service.ts` gelesen statt neu
erfunden. Ein Rivalitäten-Konzept habe ich im Repo nicht als eigenes Dokument gefunden. Kandidat
für die Vorgeschichte ist `docs/team-abilities-redesign.md`, ungeprüft. Grober Aufwand: Motor und
Brücke **klein–mittel**, Persistenz und Anzeige **mittel** (neue Tabelle, Migration, UI).

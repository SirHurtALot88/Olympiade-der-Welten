# Rempler/Tackling, gesteuert von der Persönlichkeit: technische Machbarkeit (08.11.)

Reine Recherche, keine Implementierung. Bezieht sich auf Teil 2 der Vision
`docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`. Die Datei liegt bisher nur auf dem
Branch `origin/claude/vision-oberflaechen-tackling-0811` und noch nicht auf `main`. Den kreativen
Teil (Persönlichkeits-Taxonomie, wie Kombinationen wirken sollen) macht Fable parallel. Dieses
Dokument beantwortet die technische Seite: Was gibt es schon, wo würde es leben, was kostet es, und
wie misst man es.

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
4. **Die größte Gefahr ist belegt, nicht vermutet.** In der Arena war die Persönlichkeit
   nachgemessen die **größte eignungsfremde Störquelle** der Rangfolge, mit ε² = 0,229 in TDM.
   Getragen haben das genau die zwei Verhaltenskanäle „Zusammenhalt“ und „Bindung“. Sie mussten am
   07.10. für Mini-DM neutralisiert werden (`persHandwerk`). In Battlefield hob dieselbe
   Neutralisierung rho, riss aber die Pp-Schranke um +27 bis +37 Pp
   (`arena-zielwahl-opus-empfehlung-02-10.md` 0, 1.1, 10.3). Ein „Egomaniac bricht seine Rolle“ ist
   genau so ein Kanal.
5. **Eiskunstlauf hat heute keine Interaktion, die ein Rempler stören könnte.** Das Bühnen-Chassis
   würfelt alle Durchgänge vorab in `bauBuehne()`. Die Bewegung (`stepKuer`, 27696) darf vertraglich
   nie `rr()` rufen und nie Punkte schreiben. **Vier Aktive gleichzeitig zu zeigen ist billig
   (Anzeige, rangtreue-neutral beweisbar). Rempler zwischen ihnen sind ein neuer, vorab gewürfelter
   Mechanikkanal** mit voller Abnahme.
6. **Empfohlene Reihenfolge:** (a) Persönlichkeitsschicht als reine Funktion aus der Engine lösen,
   Egomaniac und die fehlenden 13 Traits aufnehmen, Nebenpersönlichkeit ergänzen. Bit-identisch
   machbar, klein. (b) Den Bahn-Rempler per Flag auf Staffel und Climbing ausweiten. Mittel, mit
   Abnahme. (c) Eiskunstlauf mit vier Aktiven, erst als reine Anzeige. (d) „Rollentreue“ als
   eigener Kanal zuletzt, mit dem höchsten Risiko.

| Teilaspekt | Aufwand | Risiko für rho/Pp |
|---|---|---|
| Persönlichkeits-Ableitung erweitern (Egomaniac, alle 36 Traits, Neben-Persönlichkeit) | **klein** | keins, solange nur abgeleitet und nirgends neu gelesen |
| Rempler auf weitere Bahn-Disziplinen (Staffel, Climbing) | **mittel** | mittel, bewiesenes Muster, aber Staffel steht auf separaten Bahnen |
| Rempler im Feldspiel generalisieren (Hockey-Check persönlichkeitsabhängig, Basketball) | **mittel–groß** | hoch, Hockey verfehlt Pp schon heute (38,5 / 81,5) |
| Eiskunstlauf: vier Aktive **anzeigen** | **klein–mittel** | keins (Anzeige, Warteschlangen-Argument) |
| Eiskunstlauf: Rempler zwischen den vier **mechanisch** | **mittel–groß** | mittel–hoch, neuer Kanal im vorgewürfelten Chassis |
| „Rollentreue“ (Egomaniac ignoriert den Slot) | **groß** | **hoch**, der in der Arena nachgewiesene Fehlordnungstyp |
| Anzeige im Kader/Picker | klein (Text), mittel (ehrlich je Disziplin) | keins |

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
gewertet wird. Überall sonst ist er reine Anzeige im Live-Zuschauen.** Für Hockey heißt das: Selbst
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

**Normieren statt addieren.** Damit der Kanal keine Disziplin lauter macht, wird die mittlere
Rempel-Rate je Disziplin festgehalten (Mittel über die Kaderfamilie) und nur die **Verteilung**
nach Persönlichkeit verschoben. Für Hockey ist das zwingend: Die Checkdichte liegt schon über der
NHL (2.2). Die Zahl der Ereignisse bleibt dann gleich, und CLAUDE.md sagt, dass mehr Ereignisse
ohnehin fast nie helfen.

### 5.4 Rollentreue („Egomaniac im Teamslot“) ohne Grundordnung zu zerstören

Das ist der riskanteste Teil, weil er genau der in der Arena gemessene Fehlordnungstyp ist (3.2).
Drei Leitplanken machen ihn trotzdem baubar:

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
3. **Wahrscheinlichkeit, kein Schalter.** Etwa „Egomaniac in einem Teamslot hält sich mit 60–80 %
   an den Plan“, gemischt mit der Nebenpersönlichkeit (ein Loyal-Neben senkt die Abweichung). Wie
   die Arena-Messung zeigt, sind kontinuierliche Abweichungen messbar steuerbar. Das P1-Muster
   (Skala auf Mitte zwingen) liefert die Nullprobe.

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

## 6. Risiken, ehrlich

1. **Fehlordnung durch Rollentreue** (hoch, belegt): siehe 3.2. Gegenmittel sind 5.4 Punkt 1, die
   Nullprobe und die Abbruchkriterien.
2. **Pp-Verschiebung durch neue Kontaktkanäle** (hoch in Bühnen-Disziplinen): Rempel-Duelle laden
   dazu ein, Power, Torment und Health zu nutzen. Die haben in Eiskunstlauf, Tennis und Fechten
   wenig oder kein Matrixgewicht. Die Wirkung muss je Disziplin aus deren eigenen Matrixattributen
   kommen (4.2 Problem 1).
3. **Disziplinen ohne Puffer** (mittel): Breaking (0,801), Climbing (0,833), Tennis (0,813) und
   I-Spy (0,811 auf Strom 2) vertragen kaum zusätzliches Rauschen. Dort zuletzt oder gar nicht.
4. **Hockey zählt ohnehin nicht** (strukturell): Solange Pp 38,5 / 81,5 beträgt, ist ein
   Hockey-Rempler reine Live-Optik. Der Aufwand lohnt sich erst nach der Rezeptkalibrierung.
5. **Manager-Modus sieht nichts davon** (strukturell): kein Motor, kein Rempler (1.4). Ob Chris das
   so erwartet, ist **offen** und eine Frage an ihn.
6. **RNG-Strom-Kaskade** (technisch): Jeder neue `rr()` verschiebt alle folgenden Würfe. Ohne
   Flag-Disziplin sind Vorher/Nachher-Messungen nicht mehr bit-vergleichbar.
7. **Zwei Quellen für die Persönlichkeit** (technisch): engine.js und TS dürfen nicht
   auseinanderlaufen (5.2a).
8. **Paralleler Umbau von engine.js** (organisatorisch): Kulissen-Integration und
   Oberflächen-Effekte fassen dieselbe Datei an. Persönlichkeits-PRs klein halten, Ableitung zuerst
   außerhalb von engine.js.

## 7. Was ich zuerst angehen würde

1. **PR 1, Ableitung (klein, bit-identisch):** `PW` in eine gemeinsame Datei auslagern. Die 13
   fehlenden Traits bekommen Punkte (Taxonomie von Fable), dazu Nebenpersönlichkeit und Ego-Achse
   als **reine Ableitung**, ohne neuen Leser. Das ist zunächst nicht ganz bit-identisch: Ein Spieler
   mit Egomaniac kann den Archetyp wechseln und damit in Spurt, Takeshi und Staffel anders handeln.
   **Deshalb in zwei Teilen:** zuerst Auslagerung plus Nullprobe, dann die neuen Punkte, gemessen
   in genau diesen drei Disziplinen.
2. **PR 2, Rempel-Neigung als Disziplinkanal (mittel):** `willTackeln` durch die gemischte Neigung
   ersetzen (Spurt, Takeshi), die Schlüssel `taktiker`/`beschuetzer` bereinigen und normieren.
   Abnahme wie in 3.4.
3. **PR 3, Eiskunstlauf vier Aktive als Anzeige (klein–mittel, bit-identisch).** Vorher Chris
   fragen, ob „vier“ auch für das Kurzprogramm gilt, und ob das seinem Einwand vom 13.09. gegen
   „alle gleichzeitig“ nicht widerspricht.
4. **Erst danach** Staffel- und Climbing-Rempler, ein Eiskunstlauf-Rempler (vorab gewürfelt) und
   die Rollentreue, jeweils einzeln mit Abnahme.

## 8. Was ich nicht geprüft habe

- Keine eigene Messung. Alle Zahlen stammen aus `disziplin-abnahme.json` und den genannten Dokumenten.
- Climbing-Geometrie (`bahnZ` der Paare) und ob `huerde>0` den Rempler dort praktisch dauerhaft sperrt.
- Ob Fechten, Tennis und Schach ihre Duelle gleichzeitig oder nacheinander zeigen.
- Der Pass-/Wurf-Entscheidungsknoten im Basketball (Ansatzpunkt für „Egoist wirft statt passt“).
- Ob der Headless-Runner im gebuchten Battle-Spiel `neuPersBerechnen` für den echten Kader aufruft.
  Die Messung vom 03.11. (Spurt ändert sich mit Traits) spricht dafür. Den Runner-Pfad
  `lib/battle/arena-headless-runner.ts` habe ich dafür nicht gelesen.
- Fables Taxonomie liegt noch nicht im Repo. Die Vorschläge zu Egomaniac und Co. sind deshalb nur
  strukturell, nicht inhaltlich.

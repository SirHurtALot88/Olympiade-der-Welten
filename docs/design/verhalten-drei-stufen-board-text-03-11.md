# Verhalten im Entwurf-Board: Persönlichkeit · Slot · eigener Einfluss (03.11.)

Recherche- und Verifikationsrunde, keine Implementierung. Chris (03.11.) zum Entwurf-Board
(`renderBoard()`/`renderList()` in `public/mockups/battle-mode.engine.js`):

> „kannst du an der stelle dann dazu schreiben wie der spieler in der disziplin handelt und sich
> verhält? einmal das durch eigene persönlichkeit dann durch den slot vorgegeben und ggf. das wo
> man selber drauf einfluss nehmen kann? […] es muss gewährleistet sein dass das auch so in der
> game engine ankommt und ein frontliner vorn steht jemand der nach picks sucht und einzelne
> schwache targets zb angreifen will das auch tut […] renegade oder egomaniac […] mehr "rogue" geht
> wenn die diszi das erlaubt […] bitte auch mal von fable checken lassen was wir davon haben und
> was noch gebaut werden muss und dann so für alle diszis erstellen so wie es dort möglich ist"

Alles unten ist **simuliert nachgemessen** (Headless-Chromium gegen `battle-mode.html`, Sonden
im Anhang), nicht nur aus dem Code gelesen. Die Zahlen gelten für den Stand nach den Commits vom
03.11. (Kulissen, Top-3-Vorschläge, Positions-Kürzel). Die Datei selbst wurde nicht angefasst.

## 0. Kurzfassung

| Stufe | Was es ist | Im Entwurfskampf (TDM-Tafel) | Im gebuchten Spieltag |
|---|---|---|---|
| 1 Persönlichkeit | `leitePers()` aus Klasse/Rasse/Unterklasse/Traits → 6 Archetypen → Zielneigung, Haltung, Zusammenhalt, Bindung | **wirkt** (TDM, Mini-DM 4v4, Battlefield-Duell) | wirkt nur in **Spurt, Takeshi's Castle, Staffel**. In den anderen 17 Disziplinen kommt sie **nicht** an – auch nicht im gebuchten Mini-DM-FFA und Battlefield-Pod |
| 2 Slot | Reihe + Befehl je Slot (Arena), Rennplan je Slot (Bahn), Rolle je Slot (Mini-DM-Runde, Battlefield-Ort, Heben-Duell, Breaking-Kette, Basketball-Formation, Hockey-Torwart, Football-QB/Kicker); überall Attributprofil | **wirkt** | **wirkt** – das einzige, was der Manager heute wirklich steuert |
| 3 Eigener Einfluss | Dropdowns Befehl / Zielpriorität / Haltung / Zusammenhalt / Bindung, Intensität, Live-Ansagen | **wirkt** im TDM-Entwurfskampf (gemessen); wird aber auch im Spurt-Reiter angezeigt, wo es **nichts** tut (gemessen) | **kommt nicht an**: die Übergabe `ArenaAufstellung` trägt nur `{d, slot}`; kein UI setzt je `haltung`; Live-Ansagen sind im Zuschau-Modus aus |

Renegade wirkt – aber nur indirekt (Punkte für „Draufgänger“ in `PW.minus`). **Egomaniac wirkt
nirgends** (steht in keiner Persönlichkeitstabelle, nur im Mutator-Pool). Ein „rogue“ im Sinne von
„hört nicht auf seine Rolle“ existiert heute nur als loser Zusammenhalt (Leine 380 px statt 40):
der Befehl selbst wird nie gebrochen.

## 1. Wo die drei Stufen im Motor sitzen

**Stufe 1 — Persönlichkeit** (`battle-mode.engine.js` 36530–36561, `PW`/`leitePers`): Punkte je
Klasse (0–3), Rasse (1), Unterklasse (1–3), positivem/negativem Trait (1–2); der höchste Stapel
gewinnt, Vorgabe „duellant“. Sechs Archetypen (`PERS`, 7743): Bollwerk, Draufgänger, Duellant,
Schleicher, Beschützer, Opportunist. Je Archetyp vier Kanäle:

| Archetyp | Zielneigung `PERSZIEL` (7793) | Haltung / Zusammenhalt / Bindung `PERSDEF` (7819) |
|---|---|---|
| Bollwerk | naechster | vorsichtig / dicht / zielstrebig |
| Draufgänger | speer (gegnerische Spitze) | ungestüm / eigenmächtig / opportunistisch |
| Duellant | bedrohung (höchster Schaden) | ausgewogen / ausgewogen / zielstrebig |
| Schleicher | hinten (hinterste Reihe) | vorsichtig / eigenmächtig / flexibel |
| Beschützer | schild (wer an den Eigenen hängt) | defensiv / eng / ausgewogen |
| Opportunist | schwach (wenigste LP) | ausgewogen / locker / opportunistisch |

Die einzigen Leser: `behav()` (7859) → `baueEinheit()` (38065, Arena-Chassis), `bauSpurt()`
(46935, `u.pers` → `willTackeln` in Spurt/Takeshi, `STAFFEL_PERS_HALTUNG` 47309 in der Staffel) und
`sandsackPersoenlichkeit()` (21236, Gewichtheben-Sandsack-Finale – hinter
`BUEHNE_FLAGS.gewichthebenSandsack:0`, also **aus**). Mini-DM-FFA (`mdffaKaempfer`, 55963) und
Battlefield-Pod-Gefecht (`bfffaKaempfer`, 55351) lesen weder `persOf` noch `behav()`.

Der **Befehl** (`ord`) kommt **nicht** aus der Persönlichkeit: `PERSORD` (7736) wird nur für den
★ im Dropdown benutzt; `build()` (38191) nimmt `order[p.n] || slotOrd(slId)`, also den Slot.

**Stufe 2 — Slot:**
- Arena: `SLOT_ZUSATZ` (8198): Reihe 0/1/2 und Befehl je Slot (Vanguard/Hold Line mitlinie Reihe 0,
  Breaker verfolgen Reihe 1, Skirmisher flanke Reihe 1, Shotcaller/Rally Point mitlinie Reihe 2;
  Battlefield-Duell: Siege Core/Morale Anchor vorn, Spotter flanke, Commander hinten, Disruptor
  verfolgen). Dazu `slotAufschlag()` (Attributprofil, ±8,5 Eignung) in allen vier Chassis.
- Bahn: `planJeSlot` je Disziplin (44598, 44873, 45217, 45361, 45704) → Rennplan `u.plan`
  (Tempo, Windschatten-Suche, Abbruchschwelle).
- Mini-DM-FFA: eine Runde je Rolle (Slot n der vier Teams gegeneinander, `mdffaRollenFuerK`).
- Battlefield-Pod: Startort je Rolle (`BFFFA_ROLLEN_ORT` 55338: Morale Anchor/Commander heim,
  Siege Core/Field Control Mitte, Disruptor/Spotter fern) und Erobern/Halten/Stören-Gewichte
  (`ARENA_DOMINATION.rolle` 9042).
- Gewichtheben: Duell Slot n gegen Slot n, Eröffnung/Sprünge je Slot (`HEBEN_ROLLEN` 20890).
  Breaking: Kette in Slot-Reihenfolge (18424). Basketball: Formationsplatz je Slot
  (`BASKETBALL_ROLLE_SLOT` 10852, nur wenn alle sechs gesetzt und eindeutig). Hockey: Torwart-Slot
  (12141). Football: QB-/Kicker-Slot (12485, 12675). Showcase, Eiskunstlauf, Wettessen, Speed-
  Schach, I-Spy, Tennis, Fechten: Slot = Attributprofil + Reihenfolge, kein eigenes Verhalten.

**Stufe 3 — eigener Einfluss:** die Tafel füllt `order`, `zielOf`, `takt` (37336, 37346, 37373)
und `STUFE` (37139). `build()` liest alle drei (38191). Die echte Übergabe
(`lib/foundation/battle-arena/arena-aufstellung-adapter.ts` 143) baut je Spieler nur
`{d, slot}`; `haltung` ist im Typ vorgesehen (Zeile 56), wird aber von keiner Stelle der App
gesetzt (`grep -rn haltung app lib` – nur der Adapter-Typ). Der Motor übernimmt beim Import
(36633) `place[n].haltung` und `order[n]=slotOrd(e.slot)` – nie `zielOf`/`takt`. Live-Eingriffe
(Zielansage `ansageMoeglich` 52907, Fokus-Doppeln `fokusAuswahlMoeglich` 52370, Rennplan-Ansage
`rennplanMoeglich` 52496) sind bei `nurZuschauen` aus – im gebuchten Spiel also nie.

## 2. Messungen

Sonden: `sonde-AB.mjs` (TDM, Demo-Kader = die hartkodierten SQUAD/OPP, Standard-Aufstellung,
6 Saaten über `window.__olyArenaKader.seedByDisciplineId.tdm`; dazu 3 echte Paarungen aus
`data/generated/kaderfamilie-live-save.json` × 4 Saaten, Reihum-Aufstellung nach Eignung),
`sonde-drei-stufen.mjs` Teil C (Persönlichkeits-Gegenprobe je Disziplin), `spurt-check.mjs`,
`board-check.mjs`, `bahn-check.mjs`. Abtastung alle 30 Ticks (0,5 s) über `sondenLauf()` +
`einheiten()`, ausgewertet bis 30 s Kampfzeit (danach dominiert das Endspiel mit Offensivzwang).

### 2.1 Stufe 2: steht der Frontliner vorn? — ja, als Tendenz, nicht als Garantie

„Tiefe“ = Pixel hinter dem vordersten eigenen Spieler (0 = ganz vorn), Median über alle Proben.

| Lauf | Vanguard | Hold Line | Breaker | Skirmisher | Shotcaller | Rally Point | Reihe 0 vor Reihe 2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Demo-Kader, 6 Saaten (Heim) | **0** | 23 | 37 | 108 | 98 | 263 | 85 % der Paare |
| Demo-Kader (Gast, KI-Plan) | 114 | 19 | 57 | 160 | 172 | 162 | – |
| coldsteel–direlegion, 4 Saaten | **0** | 76 | 167 | 63 | 110 | 154 | 83 % |
| goldengladiators–silversoldiers | 56 | 38 | 118 | 7 | 322 | 210 | 96 % |
| mortalsin–natureswrath | 142 | 117 | 68 | 25 | 176 | 188 | 85 % |

Befund: Reihe 0 steht in **83–96 %** aller Vergleichspaare vor Reihe 2 (Rally Point/Shotcaller).
Aber der Vanguard ist **nicht** zuverlässig der Vorderste: Breaker (Befehl „verfolgen“, keine
Leine) und Skirmisher („flanke“, keine Leine) stehen regelmäßig weiter vorn als er (Reihe 1 vor
Reihe 0 in 24–47 % der Paare). Text-Formulierung also „hält die vordere Linie“, nicht „steht
immer ganz vorn“. Auf der Bahn folgt der Rennplan dem Slot exakt (`bahn-check.mjs`: Spurt
blockstart/acceleration → „Von vorn“, lanecontrol → „Windschatten“, topspeed → „Schlusssprint“;
Staffel startrunner/curverunner → „Angehen“, chaserunner/anchor → „Schlussmann“; Takeshi gatecrash/
chaosdodge → „Kopf voran“, balancerun/trapreader → „Vorsichtig“).

### 2.2 Stufe 1: greift jemand, der „nach Picks sucht“, wirklich schwache Ziele an? — nur teilweise

Je Probe: Ziel der Einheit (`einheiten().ziel`) gegen die Vorhersage ihrer eigenen Regel und
gegen die Alternativen (nur Heimseite, ohne Flanke/Decken/Hinter-Befehl, ohne Zwang/Durchbruch).

| Persönlichkeit / Neigung | Proben | trifft eigene Regel | trifft „nächster“ | trifft „schwächster“ |
|---|---:|---:|---:|---:|
| Bollwerk / nächster (Krolach, Johanna, Lava Golem) | 1890 | 67 % | 67 % | 30 % |
| Bollwerk / nächster (Petra Brezelstein, echter Kader) | 264 | 77 % | 77 % | 33 % |
| Draufgänger / Spitze (Draco) | 672 | 45 % | 71 % | 20 % |
| Duellant / Bedrohung (King Arlen) | 582 | 64 % | 76 % | 24 % |
| Schleicher / hintere Reihe (Abyssalfin) | 364 | **76 %** | 63 % | 29 % |
| Beschützer / Kameraden freischlagen (Valara, Arabelle, Elyon) | 1188 | 50 % | 66 % | 29 % |
| **Opportunist / schwächster (Issyria)** | 448 | **30 %** | **66 %** | 30 % |

Zufallsbasis bei 5–6 Gegnern wäre ~17–20 %. Die Neigungen greifen also messbar – aber mit zwei
Einschränkungen, die in jeden Board-Text gehören:

1. **Nahkampfbindung geht vor.** Wer angegriffen wird (`lastHit`, 39474) oder in Schlagweite
   gestellt ist (`bindAn`, 40258), wendet sich dem Angreifer zu, sobald seine Bindung
   „opportunistisch genug“ ist (`opp ≥ 45` bzw. `≥ 55`). Ausgerechnet der Opportunist (Bindung
   „opportunistisch“ = 100) ist damit der, der seine eigene Neigung am seltensten durchhält: er
   schlägt zu 66 % den Nächsten und nur zu 30 % den Schwächsten. Chris' Satz „jemand der nach Picks
   sucht und einzelne schwache Targets angreifen will, tut das auch“ gilt heute **nicht** – er
   versucht es, lässt sich aber von jedem Abfänger stellen.
2. „Spitze“ und „Bedrohung“ fallen oft mit „nächster“ zusammen (Draco 45 % Spitze, 71 % nächster) –
   die Regel ist richtig implementiert, sieht im Spiel aber wie Nahkampf aus.

Wird die Zielpriorität **manuell** gesetzt (Krolach → „Angeschlagensten“), trifft sie **91 %**
(Abschnitt 2.4) – die Mechanik kann es, die Persönlichkeit allein schafft es nicht, weil sie über
Zusammenhalt/Bindung ihre eigene Zielwahl untergräbt. Das ist genau der Befund aus
`docs/design/arena-zielwahl-opus-empfehlung-02-10.md` (z/b tragen die Fehlordnung), nur jetzt am
Verhalten statt an rho gemessen.

### 2.3 Renegade / Egomaniac — „rogue“ existiert als Leine, nicht als Ungehorsam

- Draco (Warlord · Human · Knight/Destroyer/Scout · Fair/Diligent/Loyal · **Renegade/Egomaniac**):
  mit Renegade Draufgänger (4 Punkte), ohne Renegade Duellant (3:3 gegen Bollwerk). Renegade
  **kippt** also seine Persönlichkeit. Egomaniac steht in keiner `PW`-Tabelle: ohne beide Traits
  ebenfalls Duellant – Egomaniac ist wirkungslos (nur Mutator-Pool und Archetyp-Liste
  „social_icon“).
- Gegenprobe im Motor (`persHandwerk`, 6 Saaten, gleiche Saaten): Draco als Shotcaller (Reihe 2,
  Befehl mitlinie) steht mit seinem Draufgänger-Zusammenhalt „eigenmächtig“ (Leine 380 px) im
  Median **auf Höhe der Teammitte** (Vorsprung 0 px, in 16 % der Proben ganz vorn); zwingt man den
  Zusammenhalt auf „ausgewogen“ (`persHandwerk({tdm:["z"]})`), fällt er auf **−104 px**
  hinter die Mitte (0 % vorn), mit `["z","b"]` auf −99 px. Der Charakter trägt ihn also rund 100 px
  weiter nach vorn, als seine Reihe es vorsieht – das ist das heutige „rogue“.
- Was er **nicht** tut: den Befehl brechen. `ord` bleibt der Slot-Befehl; es gibt keine Stelle im
  Motor, an der eine Persönlichkeit oder ein Trait einen Befehl ignoriert, eine andere Reihe wählt
  oder die Zielansage verweigert. „Hört nicht auf seine Rolle“ ist **nicht gebaut**, nur
  beschrieben (Tooltip „Eigenmächtig … läuft dem Ziel hinterher, auch quer über das Feld“).
- Wo das überhaupt gilt: nur TDM (`persHandwerk:[]`) und Battlefield-Duell. In Mini-DM 4v4 ist der
  Zusammenhalt Handwerk (`["z"]`, 8826) – dort gibt es keinen Draufgänger-Vorsprung. In keinem
  gebuchten Spiel (2.5).

### 2.4 Stufe 3 im Entwurfskampf — die Dropdowns wirken, aber nur dort

Dropdowns per DOM gesetzt (`change`-Event, 6 Saaten, gleiche Saaten wie Standard):

| Eingriff | Standard | nach Dropdown |
|---|---|---|
| Krolach Zielpriorität „Angeschlagensten“ | 67 % nächster, 30 % schwächster | **91 % schwächster**, 14 % nächster |
| Draco Befehl „Hinter den Eigenen“ | 16 % der Proben vorderster, Vorsprung 0 | **0,9 %** vorderster, Vorsprung −58 px |
| Johanna Zusammenhalt „Eigenmächtig“ (statt dicht) | 15 % vorderste, +57 px | 39 % vorderste, +67 px |
| Lava Golem Haltung „Defensiv“ (statt vorsichtig) | 3,9 % ohne Ziel (gelöst) | 4,5 % – in dieser Messgröße nicht nachweisbar |

Die drei ersten Regler sind im Entwurfskampf also echt. Dieselben fünf Dropdowns plus
„Persönlichkeit · abgeleitet“ zeigt die Tafel aber für **jede** aufgestellte Einheit jeder
Disziplin (`board-check.mjs`: Spurt-Reiter 4 Einheiten, je Befehl/Ziel/Haltung/Zusammenhalt/
Bindung). Im Spurt: alle fünf gesetzt (Jorund verfolgen/schwach/wild, Lulu eigen/unbeirrt) →
`spiele("spurt", 1337)` und `spiele("spurt", 99)` **byte-identisch** (`spurt-check.mjs`). Das ist
heute die eine Stelle, an der das Board mehr verspricht, als der Motor hält.

### 2.5 Persönlichkeits-Gegenprobe je Disziplin (gleicher Kader, gleiche Saaten, Mutator aus)

Kader goldengladiators–silversoldiers (24 Spieler), jedem Spieler `+FiredUp +Renegade +Feisty`
(= +5 Draufgänger; 12 von 24 wechseln die Persönlichkeit), `disziplinProbe(d,{n:3, mutatoren:"aus"})`,
Vergleich aller 36 Teilnehmerwerte. Identisch = die Persönlichkeit kommt in dieser Mechanik nicht an.

| Disziplin | Ergebnis | Kanal |
|---|---|---|
| TDM (Entwurf/4v4-Motor) | 36/36 verschieden | behav → Ziel/Haltung/Zusammenhalt/Bindung (Traits hier auch im Kampf-Archetyp, s. 7480–7492 – TDM-Beleg deshalb 2.3/2.4, nicht diese Zeile) |
| Mini-DM 4v4 (Entwurf) | 24/24 verschieden | dito, Zusammenhalt Handwerk |
| Battlefield-Duell (Entwurf) | 36/36 verschieden | dito |
| **Mini-DM-FFA (gebucht, `miniDmFfaEvent`)** | **identisch** | keiner |
| **Battlefield-Pod (gebucht, `spieleBattlefieldPod`)** | **identisch** | keiner |
| Spurt | 23/36 verschieden | `willTackeln` (Rempler-Bereitschaft 0,25–0,9 je Archetyp) |
| Takeshi's Castle | 31/36 verschieden | `willTackeln` |
| Staffel | 32/36 verschieden | `STAFFEL_PERS_HALTUNG` (Bein angreifen/normal/absichern, Marke) |
| Time-Trial, Climbing | identisch | `u.pers` gesetzt, nie gelesen |
| Gewichtheben | identisch | Sandsack-Finale liest `leitePers`, Flag steht auf 0 |
| Showcase, Eiskunstlauf | identisch | lesen Klasse/Rasse/Traits **direkt** (Act, Programm-Stimmung – Eiskunstlauf nur Anzeige), nicht die Persönlichkeit |
| Breaking, Wettessen, Speed-Schach, I-Spy, Tennis, Fechten | identisch | keiner |
| Basketball, Football, Hockey | identisch | keiner |

TDM wird außerdem gar nicht über den Motor gebucht (PPS-Duell-Brücke, `ARENA_RESOLVED_DISCIPLINE_IDS`):
dort kommt heute weder Stufe 1 noch Stufe 2 an – nur die Eignung.

## 3. Stand je Disziplin (gebuchter Spieltag; „Entwurf“ = Tafel/Live-Arena)

Legende: **wirkt** = nachgemessen; (A) = nur Anzeige/Tooltip ohne Wirkung; – = nicht vorhanden.

| Disziplin | Buchungspfad | Stufe 1 Persönlichkeit | Stufe 2 Slot | Stufe 3 eigener Einfluss |
|---|---|---|---|---|
| TDM | PPS-Brücke (kein Motor) | – gebucht; **wirkt** im Entwurf | – gebucht; **wirkt** im Entwurf (Reihe, Befehl) | – gebucht; **wirkt** im Entwurf (5 Dropdowns, Zielansage live) |
| Mini-DM | FFA-Pod (`mdffa`) | – (identisch) | **wirkt**: Rollenrunde je Slot, Profil | – (Slot nur) |
| Battlefield | Pod-Gefecht (`bfffa`) | – (identisch) | **wirkt**: Startort, Erobern/Halten/Stören je Rolle, Profil | – ; Entwurf-Duell: Dropdowns + Zielansage |
| Spurt | Bahn | **wirkt** (Rempler) | **wirkt** (Rennplan je Slot) | – ; Rennplan-Ansage nur live |
| Takeshi's Castle | Bahn/Bahn-Pod | **wirkt** (Rempler vor Fallen) | **wirkt** (Kopf voran/Beherzt/Vorsichtig) | – |
| Staffel | Bahn/Bahn-Pod | **wirkt** (Bein-Haltung, Marke) | **wirkt** (Angehen/Halten/Schlussmann) | – (Paar-Bonus ist Historie, keine Wahl) |
| Time-Trial | Bahn | – | **wirkt** (Gleichmaß/Negativ-Split/Attacke) | – |
| Climbing | Bahn | – | **wirkt** (Sparsam/Stetig/Durchziehen) | – |
| Gewichtheben | Bühne Heben | – (Flag 0) | **wirkt** (Duell Slot n vs n, Eröffnung/Sprung je Slot) | – |
| Breaking | Bühne Gauntlet | – | **wirkt** (Kettenreihenfolge, Profil) | – |
| Showcase | Bühne Auftritt | Traits/Klasse → Act (direkt) | Profil | – |
| Eiskunstlauf | Bühne Auftritt | Traits/Klasse/Rasse → Programmtitel (A) | Profil, Paarung | – |
| Wettessen | Bühne Auftritt | – | Profil | Rohr `place.haltung` (sprint/gleichmäßig/schlussspurt) im Motor vorhanden, **kein UI** |
| Speed-Schach | Bühne Duell | – | Profil, Brettfolge | Rohr `place.haltung` (rechnen/normal/blitzen) vorhanden, **kein UI** |
| I-Spy | Bühne Auftritt | – | Profil | Raumwahl nur als Sonde (`ispyRaumWahl`), kein UI |
| Tennis, Fechten | Bühne Duell | – | Profil, Paarung | – |
| Basketball | Feldspiel | – | **wirkt** (Formationsplatz je Slot, wenn alle 6 gesetzt), Profil | – ; Fokus-Doppeln nur live; Taktik-Karte setzbar, **ohne lesende Mechanik** (10617) |
| Hockey | PPS-Brücke (Pp offen) | – | Torwart-Slot, Profil | – |
| Football | PPS-Brücke (Pp offen) | – | QB-/Kicker-Slot, Profil | – |

## 4. Textvorschlag für das Board — nur, was nachweislich wirkt

Vorschlag: unter jeder aufgestellten Einheit drei kurze Zeilen mit Überschrift, alle aus
bestehenden Tabellen ableitbar (`PERS`, `PERSZIEL`, `PERSDEF`, `SLOT_ZUSATZ`, `ORDTIP`,
`BAHN_ART.plaene`), kein neues Datenfeld.

**Zeile 1 „Persönlichkeit“ (nur in TDM, Mini-DM, Battlefield, Spurt, Takeshi, Staffel; sonst
weglassen – dort ist sie wirkungslos und die Zeile wäre eine Lüge):**

| Archetyp | Arena (TDM/Battlefield-Duell) | Bahn |
|---|---|---|
| Bollwerk | „Greift an, was auf ihn zukommt (meist den Nächsten). Bleibt dicht bei der Linie, löst sich bei ~27 % Leben kurz.“ | Spurt/Takeshi: „Rempelt selten (25 %).“ Staffel: „Läuft normal, sichert den Wechsel ab, wenn das Paar technisch wackelt.“ |
| Draufgänger | „Sucht die gegnerische Spitze, läuft seiner Reihe bis zu 380 px davon, zieht sich nie zurück, zielt alle 0,35 s neu – lässt sich dadurch von jedem Abfänger stellen.“ | „Rempelt fast immer (90 %).“ Staffel: „Greift auf dem Bein und beim Wechsel an.“ |
| Duellant | „Geht auf den, der am meisten anrichtet. Hält Linie und Ziel.“ | „Rempelt gelegentlich (55 %).“ Staffel: „Läuft normal.“ |
| Schleicher | „Sucht sich ein Ziel in der hintersten Reihe (trifft 3 von 4 Mal), bleibt eigenmächtig.“ | „Rempelt gelegentlich (50 %).“ |
| Beschützer | „Schlägt den weg, der an seinen Leuten hängt; bleibt eng bei ihnen, löst sich früh (ab ~36 % Leben).“ | Staffel: „Sichert Bein und Wechsel ab.“ |
| Opportunist | „Will den Angeschlagensten – schafft es aber nur in etwa einem Drittel der Zeit, weil er sich jedem stellt, der ihn angreift.“ | „Rempelt oft (70 %).“ Staffel: „Greift an, wenn seine Technik es trägt (Träger ≥ 65).“ |

Die Prozentangaben für den Opportunisten sind bewusst ehrlich; wenn das stört, ist der Hebel die
Bindung (2.2), nicht der Text. Zusatz, wo Renegade/FiredUp/Feisty im Kader greifen: „Renegade/
Feisty/FiredUp zählen zum Draufgänger – deshalb steht hier Draufgänger“; Egomaniac bekommt keine
Zeile (wirkungslos).

**Zeile 2 „Rolle“ (überall, wo Stufe 2 wirkt):**
- TDM: Vanguard/Hold Line „Reihe 1, mit der Linie“; Breaker „Reihe 2, verfolgt – verlässt die Linie“;
  Skirmisher „Reihe 2, läuft außen herum, greift den an, der am meisten anrichtet“; Shotcaller/Rally
  Point „Reihe 3, mit der Linie (Abstand hinter der Front)“. Plus der bestehende Fokus-Text.
- Battlefield (Pod): Startort und Gewichte aus `BFFFA_ROLLEN_ORT`/`ARENA_DOMINATION.rolle` –
  „Siege Core: startet in der Mitte, erobert 1,6×“, „Morale Anchor: startet am Heimort, hält 1,6×“,
  „Spotter: startet fern, nimmt neutrale Orte 1,5×“, „Disruptor: startet fern, stört“, „Commander:
  startet heim, erobert 1,25×“, „Field Control: Mitte, erobert/hält 1,3×“.
- Mini-DM: „Runde <Rolle>: tritt gegen die drei anderen <Rolle>s an.“
- Bahn: der Plan-Text aus `plaene` („Von vorn“, „Windschatten“, „Schlusssprint“ …) steht bereits
  als `text` in der Tabelle – nur anzeigen.
- Gewichtheben: „Duell <n> gegen den Gegner im selben Slot; Eröffnung <eroeffnung> %.“ Breaking:
  „<n>. in der Kette.“ Basketball: „Formationsplatz <Rolle>“ (mit Hinweis „nur wenn alle sechs
  Slots gesetzt“). Hockey: „Torwart“. Football: „Quarterback“/„Kicker“.
- Alle übrigen Bühnen: nur der Attribut-Fokus (schon da).

**Zeile 3 „Dein Einfluss“ — Vorschlag, ehrlich:**
- TDM/Mini-DM/Battlefield-Reiter: „Befehl, Zielpriorität, Haltung, Zusammenhalt, Bindung gelten
  **im Entwurfskampf hier**. Am Spieltag zählt nur der Slot.“ Oder (besser) die Dropdowns bleiben
  und werden erst dann ohne Zusatz gezeigt, wenn Stufe 3 wirklich gebucht wird (Abschnitt 5).
- Alle anderen Reiter: die fünf Dropdowns und „Persönlichkeit · abgeleitet“ **ausblenden** (nur
  `istArena(disc)`), sonst steht im Spurt ein Befehl, den niemand liest.
- Intensität (Schonen/Normal/Push): im Entwurf wirksam (`stufenWert()`), gebucht immer „normal“ –
  auch das gehört an den Knopf, solange der Spieltag es nicht überträgt.

## 5. Scope-Vorschlag und Priorisierung

**Sofort als Text (nur Anzeige, keine Mechanik, kein Risiko für rho/Pp):**
1. Dropdowns/Persönlichkeitszeile im Board auf `istArena(disc)` beschränken; Spurt & Co. zeigen
   nur Rolle (Rennplan-Text aus `plaene`) – Chris' Vorgabe „muss in der Engine ankommen“.
2. Zeile 2 „Rolle“ für alle 20 aus den vorhandenen Tabellen (Abschnitt 4).
3. Zeile 1 „Persönlichkeit“ in TDM/Mini-DM/Battlefield-Entwurf, Spurt, Takeshi, Staffel – mit den
   ehrlichen Quoten.
4. Hinweis „Entwurfskampf ≠ Spieltag“ an den fünf Dropdowns und an der Intensität.

**Erst Engine, dann Text:**
5. **Stufe 3 buchen**: `ArenaAufstellungEintrag` um `befehl`/`ziel`/`haltung`/`zusammenhalt`/
   `bindung` erweitern, UI im Aufstellungsentwurf, Import (36633) nach `order`/`zielOf`/`takt`.
   Erst dann darf Zeile 3 etwas versprechen. Für TDM bringt das erst etwas, wenn TDM nicht mehr
   über die PPS-Brücke läuft; für Mini-DM-FFA/Battlefield-Pod bräuchten `mdffa`/`bfffa` überhaupt
   erst Leser für diese Felder (heute nur Slot/Eignung).
6. **Stufe 1 in den gebuchten Pod-Chassis** (Mini-DM-FFA, Battlefield-Pod): Persönlichkeit als
   Kanal in `mdffaKaempfer`/`bfffaKaempfer` (z. B. Zielwahl im Schlagwechsel, Rotationsneigung) –
   mit voller rho/Pp-Abnahme (CLAUDE.md), weil beide Disziplinen gerade erst bestanden haben.
7. **„Rogue“ als Mechanik**: wenn Chris „hört nicht auf seine Rolle“ wirklich will, ist das ein
   neuer Kanal (Wahrscheinlichkeit, den Slot-Befehl gegen `PERSORD` zu tauschen, z. B. Draufgänger
   → „verfolgen“, Schleicher → „flanke“), gesteuert über Trait (Renegade) statt nur über
   Archetyp-Punkte; Egomaniac müsste dafür erst in `PW` aufgenommen werden. Nur in Disziplinen mit
   Befehlen (Arena); mit Abnahme.
8. **Opportunist-Bindung**: wenn „sucht schwache Ziele“ sichtbar werden soll, muss die
   `lastHit`/`bindAn`-Schwelle für Zielneigung „schwach“ angehoben werden – das ist die
   V5/V9-Diskussion aus dem Zielwahl-Dokument und braucht Pp-Messung (Battlefield verfehlte F).
9. Bühnen-Haltung (Wettessen, Speed-Schach): Rohr fertig, nur UI + Übergabe – kleine Vorarbeit,
   aber eine eigene Runde, weil beide Flags Mechanik (Mauer/Uhr) mitbringen.

## Anhang: Sonden und Rohdaten

Scratchpad `/tmp/claude-0/-home-user-Olympiade-der-Welten/e6571a3e-fed1-521c-a49f-0f3b2e7cb9a4/scratchpad/`:
`sonde-AB.mjs` → `sonde-AB.json` (Teil A/B), `sonde-drei-stufen.mjs` → `sonde-BC.json` (Teil C
und Produktionspfade), `spurt-check.mjs`, `board-check.mjs`, `bahn-check.mjs`. Alle laufen gegen
`public/mockups/battle-mode.html` mit `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`,
`pageerror` 0. Die Sonden ändern keine Projektdatei; sie liegen bewusst nicht im Repo, weil zwei
andere Agenten parallel an `battle-mode.engine.js` arbeiten. Während der Läufe (12:41) landeten
im Arbeitsbaum uncommittete Änderungen eines anderen Agenten (Stat-Audit: `kampfwerteVorschau()`
und der Kader-Tooltip in `renderList()`, reine Anzeige; dazu `battle-mode.html`) – sie berühren
weder `stepSim()` noch `chooseTarget()`/`build()`, die Messwerte bleiben davon unberührt. Die
Zeilennummern in diesem Dokument beziehen sich auf den eingecheckten Stand (`git show HEAD`).

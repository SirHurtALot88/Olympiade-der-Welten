# Battle Arena — Übergabe an die nächste Sitzung

Stand: 23.08.2026, Branch `claude/ui-ux-upgrades-dat4ys`, PR
[#651](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/651).

Diese Datei existiert aus einem Grund: **der Netzzugang öffnet sich erst in einer neuen
Sitzung.** Chris hat die Netzwerk-Policy der Umgebung auf alle Domains gestellt, aber ein
laufender Container liest sie nur beim Starten. Alles, was Assets, Dropbox-Bilder oder
Sprite-Nachschub braucht, wartet deshalb hier.

---

## Worum es überhaupt geht (Scope)

Die **Battle Arena** ist ein *zuschaubarer Auto-Battler* für die Olympiade der Welten.
Der Manager stellt auf, die Spieler kämpfen von selbst, und man sieht zu — es gibt keine
Steuerung im Kampf. Zwei Disziplinen sind entworfen:

- **TDM** — 6 gegen 6, Team gegen Team, sechs benannte Slots
- **Spurt** — ein Hürdenlauf im Freien mit vier Slots, eigenen abgeleiteten Werten und
  Tacklings, die sichtbar und mechanisch wirken

Sie liegt als **eine** HTML-Datei vor (`public/mockups/battle-mode.html`, ~800 KB, kein
Bundle, keine Abhängigkeiten) und ist im Spiel als Reiter eingebettet. **Sie liest und
schreibt keinen Spielstand** — die Kaderwerte sind feste Kopien.

### Die eiserne Regel dieses Entwurfs

> **Keine erfundenen Werte.**

Jeder Kampfwert wird aus den zwölf Attributen abgeleitet, jede Skill-Zahl steht auf einer
Klassenkarte, jede Slot-Zahl kommt aus `lib/lineups/matchday-slot-roles.ts`. Wo doch etwas
erfunden ist, steht das **als Kommentar an Ort und Stelle** — und in dieser Übergabe.

Diese Regel ist nicht Zierde. Sie ist mehrfach verletzt worden und hat jedes Mal Messungen
wertlos gemacht: neun von achtzehn Spielerklassen waren gesetzt statt nachgeschlagen;
Präzision war ein siebter Kampfwert, den keine Karte kennt; die Führung war ein
Leistungsposten neben einer sonst abgeschriebenen Formel. Alles drei ist entfernt.

**Wer hier weiterarbeitet, prüft zuerst, ob eine Zahl eine Quelle hat.** Wenn nicht, gehört
sie markiert, nicht verteidigt.

---

## Das Vorbild: Eslabong

Chris orientiert sich an **Eslabong** (Steam-App 4560660), einem Arena-Kämpfer mit
Söldnerclub-Verwaltung — dieselbe Grundidee, nur ohne Ligabetrieb. Wir schreiben davon ab,
was belegt ist, und erfinden den Rest nicht heimlich dazu.

### Was aus veröffentlichten Patch Notes belegt ist

| | |
|---|---|
| Maximallevel | **100** |
| Start | Fighter beginnen mit **einer** Fähigkeit, „so you can better customize them" |
| Fähigkeitsränge | Auf Level **10, 12, 14, 16, 18, 20** darf man statt einer neuen Fähigkeit eine bestehende hochstufen — bis zu **5 Ränge**, **+10 %** je Rang auf Stärke, Wirkdauer und Abklingzeit |
| Stat-Wahl | Der **Wurf ist über die gewählten Stats geteilt**: würfelt man hoch, bekommt jeder gewählte Stat diesen Wurf. Kleine Chance auf einen „legendären" Schub |
| Stats | Speed gibt Abklingzeit-Reduktion, DEF gibt Betäubungswiderstand |

Quellen: IndieDB/ModDB-Patch-Notes und die Steam-Seite. Nachlesbar über Websuche —
`Eslabong` plus `patch notes` oder `playtest`.

### Was aus den Klassenkarten belegt ist (Screenshots von Chris)

- **35 von 36 Archetypen** sind abgeschrieben (`lib/battle/archetype-registry.ts`) mit
  HP-, ATK-, DEF- und SPD-Spannen sowie Betäubungs- und Rückstoßwiderstand.
- **Über alle 35 Karten und alle vier Werte gilt `max = round(min × 13/7)`.** 132 von 140
  Spannen treffen das exakt; die acht Grenzfälle liegen genau eins daneben, weil die Karte
  den Startwert auf eine ganze Zahl schneidet. Die Spanne ist damit **keine
  Balance-Entscheidung je Klasse**, sondern eine gemeinsame Wachstumskurve — eine Klasse
  unterscheidet sich nur durch ihren Startwert und ihr Kit.
- **Die echten Wertebereiche** (wichtig, weil unsere Werte mehrfach danebenlagen):

  | | Startwerte | Endwerte |
  |---|---|---|
  | HP | 77–210 | 143–390 |
  | ATK | 49–84 | 91–156 |
  | DEF | 7–59 | 13–111 |
  | SPD | **91**–140 | 169–260 |

  **SPD hat einen harten Boden bei 91** — kein Archetyp im ganzen Spiel ist langsamer, und
  zehn von 35 stehen auf 105. Die Spanne auf einer Stufe ist nur **1,54**. Genau daran ist
  unser Lauftempo gescheitert (Faktor 3,1) und wurde korrigiert.

- **Ein Kit ist eine Auswahl aus einem gemeinsamen Skill-Pool**, keine eigene Liste:
  Cleric und Priest teilen sich **neun** Skills mit identischen Zahlen. Jeder Skill trägt
  zwei unabhängige Marken — **Rarität** (Common/Uncommon/Rare) und **Zugang**
  (guaranteed/learnable) —, und jede Klasse hat **genau zwei garantierte** Skills, einer
  davon bei beiden Medium Dash.

### Chris' eigene Beobachtung

Eine volle Saison Dauereinsatz ergab bei ihm **Level 21–25** — aber ein Teil davon kam aus
einem **Cup, den unsere Olympiade nicht hat**. Wer die Kurve nachbaut, darf die 21–25 also
nicht eins zu eins als Saisonertrag setzen. Steht als `SAISON_STUFEN_BEOBACHTUNG` in
`lib/battle/archetype-registry.ts`.

---

## Wie gerechnet wird

Die Kette ist **eine** Kette, und das ist der Kern des ganzen Modells:

```
12 Attribute  →  Eignung (Disziplinmatrix)  →  Menge der Kampfkraft
                 Rezepte                    →  Form  der Kampfkraft
```

Chris' Satz dazu: *„wir haben doch schon die Eignung, die ein gewichteter Wert ist — wieso
gibt es dann zusätzlich noch unterschiedliche Kampfkraft? Das macht ja keinen Sinn."* Er
hat recht, und daraus folgt alles Weitere.

### 1. Attribute → Eignung

Jede Disziplin hat eine Gewichtungsmatrix über die zwölf Attribute; der gewichtete
Schnitt ist die Eignung (0–100). TDM:

```
power 28 · health 20 · stamina 14 · spirit 12 · charisma 10
determination 6 · intelligence 6 · awareness 2 · torment 2
```

**Beachte: speed und dexterity haben Gewicht NULL.** Ein Echtzeitkampf braucht aber
Bewegung. Diese Spannung ist der Grund für mehrere Korrekturen (Tempo beschleunigt den
Angriff nicht mehr, Lauftempo auf Kartenspanne) und bleibt eine offene Grundsatzfrage an
Chris: *Ist die TDM-Matrix für einen Echtzeitkampf vollständig?*

### 2. Eignung → Aufschläge

Auf den Disziplinwert kommen vier Aufschläge, und **alle vier müssen in den Kampfwerten
ankommen** — vorher verschoben Slot, Formkarte und Stufe nur die angezeigte Zahl:

| Aufschlag | Woher | Spanne |
|---|---|---|
| Slot | `slotAufschlag()`, Faktor 2,2, Grenze ±8,5 (`SLOT_PROFILE_MODIFIER_SCALE` aus dem Spiel) | ±8,5 |
| Traits | `TRAIT_PUNKTE = 6` je Netto-Mutator | **erfunden, siehe Punkt A** |
| Formkarte | `FORMWERTE = [0, 2, 4, 8]`, je Kampf gezogen | 0–8 |
| Intensität | `INTENSITAET`: Schonen −2,5 / Normal 0 / Push +4 | −2,5…+4 |

Der Aufschlag hebt **die Attribute** (`mitAufschlag`), nicht direkt die Kampfwerte —
sonst wäre es eine zweite Währung neben der ersten.

### 3. Attribute → Kampfwerte (die Form)

Fünf Werte, jeder ein gewichtetes Rezept über dieselben zwölf Attribute (`REC.power`):

```
ANG  power 62 · charisma 18 · determination 12 · torment 8
VER  health 46 · power 38 · spirit 16
LP   health 52 · stamina 34 · power 14
TMP  speed 46 · dexterity 24 · stamina 16 · awareness 14
AUS  stamina 52 · determination 26 · power 22
MANA spirit 45 · intelligence 35 · will 20
```

Es gibt **keinen sechsten Kampfwert**. Präzision war einer und ist entfernt, weil keine
Karte sie kennt — und mit ihr die Trefferchance: **jeder Nahkampfschlag trifft.**

### 4. Kampfwerte → Menge (`aufEignung`)

Hier schließt sich die Kette. `rohKraft = LP × (1 + VER/100) × (ANG/50)` ist das
Lanchester-Produkt aus Zähigkeit und Schlagkraft. `aufEignung()` skaliert **alle drei
Werte mit demselben Faktor**, bis die rohKraft dem entspricht, was die Eignung verspricht
(`KRAFTMITTE = 50` ist der Punkt, an dem nichts skaliert wird). Der Faktor wird durch
Halbierung gesucht, weil VER im Produkt steckt.

**Die Menge folgt der Eignung, die Form bleibt die des Spielers.** Wer zäh gebaut ist,
bleibt zäh. Vorher wurden nur LP und ANG skaliert — dadurch wirkte VER als *Steuer* und
ein Spieler mit Health 99 bekam weniger Leben als einer mit Health 52.

### 5. Kampfwerte → Kampf

| | |
|---|---|
| Leben | `LP × LEBEN_JE_LP`, **LEBEN_JE_LP = 4** (aus den Karten: größter Tank endet bei 390) |
| Schaden | `Basisschaden × (ANG/50) × 100/(100+VER)` — bei ANG 50 genau der Basiswert |
| Abklingzeit | **fest aus dem Kit**, Tempo verkürzt sie nicht mehr |
| Lauftempo | `(91 + TMP × 0,49) × 110/115,5` px/s — auf die SPD-Spanne einer Stufe abgebildet |
| Heilen | `HEILUNG.basis 16 × (ANG/50)` je `HEILTAKT` = Abklingzeit 1 s **+ Ansage 1 s** |
| Mana/Ausdauer | Vorrat = abgeleiteter Wert × 2 |

### 6. Wirkung → Leistung und Impact

Zwei verschiedene Zahlen, die oft verwechselt werden:

- **Leistung** (`beitragVon`) ist unsere eigene Größe: Schaden + Heilung + Schild +
  verhinderter Schaden + 15 % des erlittenen Rohschadens + Ausschaltungsanteil × 140.
  100 % ist das Feldmittel.
- **Impact** (`impactVon`) ist die **abgeschriebene Formel des Vorbilds** —
  Sättigungskurve `Gewicht × (1 − e^(−Menge/Referenz))` je Posten, dazu Stückwerte für
  Ausschaltungen, Beihilfen, Tode, Eigenbeschuss und Wiederbelebung, ein Bonus fürs
  Überleben ohne Tod, eine weiche Kappe und eine harte. **An dieser Formel wird nichts
  erfunden** — sie ist an zwanzig Datenzeilen aus dem Spiel geprüft.

Die **Wechselkurstabelle** `KURS` ist die einzige Balancing-Fläche: Schaden 1,00,
Heilung 1,00, Schild 0,80, Betäubung 0,70, Rückstoß 0,018, Bewegung 0,12,
Unverwundbarkeit 0,90. Weil sie feststeht, lässt sich der Nutzwert eines Skills
**ausrechnen, bevor er gespielt wurde** — der Wächter gegen zu starke Kits. Getunt wird
nur diese Tabelle, nie ein einzelner Zauber.

### Wie man misst

```sh
node scripts/miss-arena-serie.mjs 24
```

Ein einzelner Kampf ist ein Wurf, keine Messung. Die Serie rechnet dieselbe Aufstellung
mit 24 Saatkörnern durch und liefert Siegquote, Ergebnisverteilung, Leistung je Spieler,
Schaden, Heilung, verhinderten Schaden — und die statische Nutzwerttabelle.

**Die Methode, die sich bewährt hat:** eine Vermutung wird nicht diskutiert, sondern
kontrolliert. Eine Kopie der Datei bauen, *einen* Faktor neutralisieren, beide Serien
laufen lassen, vergleichen. So sind alle fünf Fehler gefunden worden — und drei meiner
Vermutungen (Tempo, Befehle, Seitentausch) sind so widerlegt worden, bevor sie Schaden
anrichten konnten.

---

## Sofort prüfen, wenn die neue Sitzung startet

```sh
curl -sS -o /dev/null -w "%{http_code}\n" https://opengameart.org/
curl -sS -o /dev/null -w "%{http_code}\n" https://www.dropbox.com/
```

`200` statt `000` heißt: der Zugang steht. Dann zuerst die drei Punkte unter
„Wartet auf Netzzugang".

---

## Wartet auf Netzzugang

### 1. Die 599 Spielerbilder aus Chris' Dropbox

Der Dropbox-Connector funktioniert (Suche, Metadaten, Ordner) — **nur die Bilddaten
selbst** kamen nicht durch, weil sie von `dropboxusercontent.com` ausgeliefert werden.

Ordner: `/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/` und `Spieler/fertig/`
(höhere Auflösung). Benannt nach Spielernamen, z. B. `Krolach.jpg`.

**Wozu:** `lib/battle/subclass-archetypes.ts` ordnet jede der 56 Unterklassen MEHREREN
Archetypen zu — nach Chris' ausdrücklicher Regel „im Zweifel alle zuweisen, dann ist der
Skill-Pool größer". Ein Spielerbild verengt diese Auswahl für **diesen einen** Spieler.
Fünf sind schon eingearbeitet (`BILDBEFUNDE`), 594 fehlen.

Ebenfalls dort: `Rassen Klassen Traits.xlsx`, `Oly Player Stats 05-2026.xlsx`,
`Olympiade Player Stats.csv` — noch nie angesehen, könnten die Zuordnung stützen.

### 2. Die fehlenden Lauf-Sprites

**Alle 77 Blätter des Sprite-Baukastens liegen jetzt als PNG-Dateien** unter
`public/sprites/baukasten/` — mit `index.json` (Maße, Bildzahl, Richtungen) und einer
README, die den Aufbau erklärt. Sie sind zusätzlich in `battle-mode.html` eingebettet.
Vorher lagen sie nur als base64 in zwei HTML-Dokumenten.

Den vollen Satz aus Gang, Schlag und Schuss haben aber nur **vier** Ebenen: Körper
(`k_*`), Kopf (`g_*`), Rüstung (`r_*`) und Haar (`h_*`). Krone, Bart, Schultern, Arme,
Beine, Stiefel, Umhang, Hörnerhelm, Visier, Schild, Doppelaxt und die zwanzig Köpfe gibt
es **nur als Schlag-Blatt** (6 Bilder). Für die Animation fehlen deren Gang-Varianten
(9 Bilder), die Schuss-Varianten (13) und **alle `hurt`-Blätter**.

Quelle: Liberated Pixel Cup, dieselben Urheber wie in `CREDITS.csv`. Solange sie fehlen,
zeichnet die **stehende** Figur aus dem vollen Baukasten und der **laufende** Kämpfer aus
dem animierbaren Rest. Kommen die Blätter, fällt die Teilung weg.

Zwei konkrete Lücken darüber hinaus:
- **Krone für die Arena** — King Arlen hat sie in der Kaderliste, im Kampf nicht.
- **Vogel-Sprite für Seraph-11** — sein Bild zeigt einen mechanischen Vogel; er läuft
  derzeit als Metallgestalt mit Flügeln. Steht als Platzhalter im Code.

### 3. Hintergründe für die Disziplinen

TDM in einer tödlichen Kampfarena, Spurt als Hindernislauf im Freien. Bisher gar nicht
angefangen, weil OpenGameArt nicht erreichbar war.

---

## Offene fachliche Punkte

### A. Die Mutatoren drehen das Ergebnis (wichtigster offener Punkt)

In der **reinen Messlage** (ohne Mutatoren, ohne Formkarten, Intensität normal) gewinnen
die Vigilante Wranglers gegen Armageddon Aftermath **6:0 in 24 von 24 Kämpfen** — das ist
richtig so, V-W steht auf TDM-Rang 6, A-A auf 20.

Mit allem eingeschaltet sind es nur **25 %**. Ursache: `TRAIT_PUNKTE = 6` gibt A-A **+60**
Eignungspunkte gegen V-W **+30**. Gemessen: bei `TRAIT_PUNKTE = 3` steht V-W bei 50 %.

**Der eigentliche Zweifel:** Chris' Satz „wenn Renegade triggert, sind das auch +6 Punkte"
meinte vermutlich ein **Auslösen im Kampf**, nicht einen dauerhaften Aufschlag auf die
Disziplinwertung. Daraus wurde ein permanenter Bonus gemacht — das ist wieder eine zweite
Gewichtung neben der ersten. **Vor dem nächsten Balancing mit Chris klären.**

### B. Der Level- und Marktentwurf — Chris' Entscheidung steht

Fable hatte vorgeschlagen, den Marktwert auf Liga-Perzentile umzustellen.
**Chris hat abgelehnt: „nee, Marktwert fassen wir nicht an, die Berechnung bleibt!"**

Sein Weg stattdessen:

- Transfermarkt-Spieler **leveln mit** und bewegen sich auf dem **Median-Level der Liga**
- **Regression**: wer zurückliegt, holt schneller auf
- Grundertrag ~**10 Level je Saison**, mit Regression bis ~15
- Maximallevel 100 → **ausgereizt nach 7–8 Saisons**
- Das **Potential ist die eingebaute Bremse**: der Ligadurchschnitt steigt, bis alle an
  ihrer Grenze stehen, und flacht dann ab. Keine ewige Inflation, sondern eine Anlaufkurve
  und danach ein eingeschwungener Zustand.

**Noch zu messen:** ob Preisgelder und Sponsoreneinnahmen mitwachsen. Wenn die Gehälter
über den Marktwert steigen und die Einnahmen nicht, frieren die Kader ab Saison 4 ein —
nicht weil die Formel falsch ist, sondern weil nur eine Seite mitwächst.

### C. Die Slot-Auswahl beim Levelaufstieg war eine Erfindung

Chris fragte: „woher kommen die gewichteten Slots beim lvl up?" Die ehrliche Antwort:
**von Fable, nicht aus Eslabong.** Eslabong hat **vier** Stats und zeigt **alle vier** —
dort gibt es das Auswahlproblem gar nicht. Es entsteht erst bei unseren zwölf.

Von den Vorgaben hat genau **eine** eine Quelle: *ausgereizte Stats werden nicht
angezeigt* — die kommt von Chris. Alles andere ist zu entscheiden, nicht zu finden.

**Empfehlung (noch nicht bestätigt):** rein zufällig aus den nicht ausgereizten Stats.
Eine Gewichtung nach Klasse drückt jeden Spieler still in seinen Archetyp — das Gegenteil
von „aus verschiedenen Skill-Trees picken" und von „schwächere Spieler holen auf".

Was aus Eslabong wirklich belegt ist (veröffentlichte Patch Notes):
- Maximallevel 100; Fighter starten mit **einer** Fähigkeit
- Fähigkeiten steigen auf Level 10, 12, 14, 16, 18, 20; bis zu **5 Ränge**, **+10 %** je
  Rang auf Stärke, Wirkdauer und Abklingzeit
- Der **Wurf ist über die gewählten Stats geteilt**; kleine Chance auf einen legendären
  Schub
- Speed gibt Abklingzeit-Reduktion, DEF gibt Betäubungswiderstand

Chris' eigene Beobachtung: eine volle Saison Dauereinsatz ergab Level **21–25** — aber ein
Teil davon kam aus einem **Cup, den unsere Olympiade nicht hat**. Steht als
`SAISON_STUFEN_BEOBACHTUNG` in `lib/battle/archetype-registry.ts`.

### D. Die restlichen Klassenkarten

`lib/battle/class-kits.ts` hat **Cleric und Priest**. Es fehlen **33 von 35**. Die beiden
vorliegenden zeigen die Bauart: ein gemeinsamer **Skill-Pool**, aus dem Klassen auswählen
(sie teilen sich neun Skills mit identischen Zahlen), zwei Marken je Skill (Rarität,
Zugang) und **genau zwei garantierte Skills** je Klasse.

Die Priest-Liste ist im Screenshot abgeschnitten (`unvollstaendig: true`).

**Solange die Kits fehlen, tragen alle zwölf Spieler denselben Platzhaltersatz.** Das ist
Absicht: mit gemischten Kits misst jede Serie die Kit-Verteilung statt die Spieler.
Nachgemessen: das Bogenkit liegt bei 12,9 Nutzwert je Sekunde, Slash bei 7,3 — wer als
Einziger den Bogen trägt, entscheidet die Partie über sein Kit.

Deshalb trägt **Cassandra** trotz nachgewiesenem Bogen (Bild!) noch das Nahkampfkit. Ihr
Sprite hat den Bogen, ihr Kit folgt, sobald Bowman und Hunter vorliegen.

### E. Kleinere offene Punkte

- **Mini-DM** als Freiluft-Turnier aus einem Pool aller 16 Teams (max. 6 × 16 Spieler),
  von denen je vier gezogen werden und ein bis zwei weiterkommen — verschoben.
- **Spurt** hat Slot-Rollen im Spiel, die im Entwurf noch nicht abgeschrieben sind.
- **Portraits**: `public/portraits/` ist leer, der Index hat null Einträge. Bis Chris
  Bilder ablegt, greift sichtbar das Kürzel auf farbigem Grund.
- **Krits** sollen laut Chris nur noch an Skills hängen, nicht mehr am Grundschlag —
  Präzision ist bereits entfernt, die Skill-Krits fehlen noch.

---

## Was in dieser Sitzung fertig wurde

**Fünf Fehler zwischen Eignung und Kampf**, jeder einzeln kontrolliert. Ausgangslage: V-W
(Rang 6) verlor gegen A-A (Rang 20) 0:6 in 24 von 24.

| # | Fehler | Beleg |
|---|---|---|
| 1 | Zwei Bauwege statt einem | Spiegelkampf gegen identische Kopie: links verliert 2:6 in 24/24 |
| 2 | Heilen alle 0,3 s statt 1 s + Ansage (Karte) | A-A heilt 758/Kampf, V-W 0 |
| 3 | Tempo verkürzte jede Abklingzeit um 30 % | Karten nennen feste Abklingzeiten |
| 4 | Lauftempo mit Faktor 3,1 | Lava Golem 34 % Ausnutzung → 97 %, 95 → 584 Schaden |
| 5 | Verteidigung wirkte als Steuer auf LP und ANG | Health 99 gab 280 Leben, Health 52 gab 403 |

Dazu: Formkarten wurden **einmal beim Laden** gezogen (24 Kämpfe zeigten dasselbe
Ergebnis); die Führung ist aus der Leistungsrechnung raus (Chris: „sowas gabs im Original
nicht"); fünf Anzeigen rechneten noch mit alten Formeln (1,09 s Abklingzeit für Slash,
Leben × 12 statt × 4).

**Neue Datendateien**, 40 Tests grün:
- `lib/battle/archetype-registry.ts` — 35 Archetypen, Regel `max = round(min × 13/7)`
- `lib/battle/class-kits.ts` — Cleric und Priest, gemeinsamer Skill-Pool
- `lib/battle/subclass-archetypes.ts` — 56 Unterklassen → Archetypen, plus Bildbefunde

**Sprites**: der Sprite-Baukasten (Artefakt
`bea50d43-e66c-4008-aabf-36a293d594fd`) ist in die Arena übernommen — 51 Blätter, vier
Farbkategorien, Ebenenlisten für alle zwölf Spieler. King Arlen mit Krone und goldenem
Harnisch, Draco als Drachenritter mit Doppelaxt.

---

## Was in diesem Entwurf ERFUNDEN ist

Die wichtigste Liste der ganzen Übergabe. Alles hier hat **keine Quelle** — weder eine
Klassenkarte noch den Spielcode noch eine Aussage von Chris. Es ist gesetzt, weil ohne
eine Zahl nichts läuft. Wer daran dreht, dreht an einer Meinung, nicht an einem Befund.

| Was | Wert | Anmerkung |
|---|---|---|
| `TRAIT_PUNKTE` | 6 je Netto-Mutator | **Der problematischste Posten.** Chris sagte „wenn Renegade triggert, sind das auch +6 Punkte" — das meinte vermutlich ein Auslösen im Kampf, nicht einen Dauerbonus auf die Wertung. Dreht das Ergebnis (Punkt A) |
| Passungsstufen | perfekt ≥6, gut ≥2, okay ≥−2 | Teilt die ±8,5-Spanne in vier Stufen. Die Spanne ist echt, die Schnitte sind gesetzt |
| `FORMWERTE` | 0, 2, 4, 8 | Die drei Intensitätsstufen gibt es im Spiel, diese Zahlen sind gesetzt |
| `INTENSITAET` | −2,5 / 0 / +4 | dito |
| Heil-Reichweite | 190 px | Die Karte nennt 1800 in ihren Einheiten — nicht umrechenbar |
| Vorratsfaktor | Wert × 2 | Damit ANG 50 auf die 100 des Vorbilds kommt |
| Slot-Auswahl beim Levelaufstieg | „3 gewichtet + 1 Wildcard" | Fables Vorschlag, **nicht** aus Eslabong (Punkt C) |
| Persönlichkeiten | 6 Typen aus Klasse/Rasse/Unterklasse/Traits | Die Ableitung ist nachvollziehbar, die Punktvergabe gesetzt |
| Sättigungsreferenzen im Impact | 650, 12, 450, 500, 700 | Die *Formel* ist abgeschrieben und an 20 Datenzeilen geprüft; diese Referenzwerte sind daran angepasst |

### Erfunden gewesen und inzwischen entfernt

Zur Warnung, weil jeder dieser Posten monatelang wie ein Befund aussah:

- **Präzision** als siebter Kampfwert samt Trefferchance und kritischen Treffern — keine
  Karte kennt sie. Raus.
- **Die Führung** als Leistungsposten (Charisma-Sekunden × 0,20). Chris: „sowas gabs im
  Original nicht". Raus.
- **Front/Mitte/Backrow** als eigene Reihenlogik — das Spiel hat echte Slot-Rollen. Ersetzt.
- **`ord: "hinter"`** für Kommandoslots („hält sich aus dem Kampf") — keine Slot-Definition
  sagt das. Buttercup kam damit über 24 Kämpfe auf null Schaden.
- **Tempo verkürzt Abklingzeiten** um bis zu 30 % — die Karten nennen feste Zeiten.
- **`LEBEN_JE_LP = 12`** — gab Rustrow 1188 Leben, während der größte Tank des Vorbilds
  bei 390 endet. Jetzt 4.

---

## Verlässliche Einstiegspunkte

| Was | Wo |
|---|---|
| Der Entwurf | `public/mockups/battle-mode.html` (eine Datei, kein Bundle) |
| Reiter im Spiel | `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` |
| Artefakt | https://claude.ai/code/artifact/af3bba05-dc93-4bcc-92f0-5f742f42380e |
| Sprite-Baukasten | https://claude.ai/code/artifact/bea50d43-e66c-4008-aabf-36a293d594fd |
| Messreihe | `node scripts/miss-arena-serie.mjs 24` (aus dem Repo-Wurzelverzeichnis!) |
| Spielstand | `git fetch origin live-save` — siehe `CLAUDE.md` |

Playwright-Skripte **müssen im Repo liegen und von dort laufen**, sonst findet Node das
Modul nicht. Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

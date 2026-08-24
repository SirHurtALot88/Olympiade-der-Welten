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

## Alle 20 Disziplinen: die Grundlage steht

Die Daten für **alle zwanzig** Disziplinen liegen jetzt im Entwurf, und sie sind nicht
abgeschrieben, sondern erzeugt:

```sh
npx tsx scripts/generiere-arena-daten.ts              # nur der Bericht
npx tsx scripts/generiere-arena-daten.ts --schreiben  # direkt in den Entwurf
```

Das Skript liest `lib/player-generator/official-discipline-weights.ts` (die Matrizen) und
`lib/lineups/matchday-slot-roles.ts` (die Slot-Rollen) und ersetzt im Entwurf den Bereich
zwischen `// <<< GENERIERT: arena-daten` und `// >>> ENDE GENERIERT: arena-daten`. Alles
andere bleibt unangetastet. Ergebnis: 20 Matrizen (jede summiert exakt auf 100) und 112
Slot-Profile.

Warum überhaupt: von Hand ging es bei zwei Disziplinen noch. Bei zwanzig sind es über
1400 Zahlen. Der Beweis kam beim ersten Lauf — der handgetippte Wert für `holdline`
stand auf `stamina: 12.4`, die Quelle sagt `12.5`. Ein Zehntel, und die 24 Kämpfe endeten
messbar anders (`3:6` statt `2:6` in sechs Läufen). Genau diese Sorte Drift ist der Grund.

**Was das Skript nicht kennt**, steht bewusst daneben und überlebt jeden Lauf: `SLOT_ZUSATZ`
mit Reihe, Befehl und Aufstellungsposition je Slot. Das ist Inszenierung dieses Entwurfs,
keine Spielregel — das Spiel kennt keine Reihen. Für die 18 noch nicht gebauten
Disziplinen greift ein Platzhalter (je zwei Slots eine Reihe, Befehl `mitlinie`).

### Die Abnahmebedingung für jede neue Disziplin

Chris' Grundsatz — *„immer über die Diszi-Gewichtungen gehen, um zu schauen, was die Leute
antreibt"* — ist jetzt eine Messung, und zwar eine allgemeine:

```sh
node scripts/messe-arena-einfluss.mjs spurt 12
```

Sie hebt bei je einem Teilnehmer je ein Attribut um 15 Punkte an und misst, wie viel
besser **er** dadurch abschneidet. Die eine Zahl am Ende ist die **Abweichung in
Prozentpunkten**: Summe der Beträge aus (gemessener Anteil − Matrixgewicht). Null hieße,
die Mechanik löst die Wertung exakt ein.

Damit das für alle zwanzig gilt, kennt die Messung die Disziplinen nicht — die Motoren
melden sich an (`MOTOREN` im Entwurf). Ein Motor muss vier Dinge können: einen Durchgang
bauen, ihn zu Ende rechnen, sagen wer mitmacht, und je Teilnehmer **eine Zahl liefern, bei
der größer besser heißt**. Im Rennen ist das die negative Platzierung, im Kampf die
Leistung. Was „besser" heißt, ist die einzige Entscheidung, die je Disziplin fällt.

Angehoben wird an **genau einer Stelle** (`ATTR_HEBUNG` / `gehoben()`), die beide Baupfade
lesen. Das ist wichtig: die frühere Spurt-Messung hat die fertigen Laufwerte nachträglich
angefasst und damit Slot-Aufschlag, Form und Stufe übersprungen — sie maß eine kürzere
Kette, als das Spiel sie rechnet. Speed las sich dadurch als 24,9 % statt 19,1 %.

### Wie viele Läufe es braucht

**Zwölf sind zu wenig — und zwar systematisch zu günstig.** Bei kleiner Stichprobe greifen
ein paar Attribute den ganzen positiven Gewinn ab und der Rest liest null; weil die Anteile
nur über die positiven Gewinne normiert werden, sieht das Ergebnis geordneter aus, als es
ist. Gemessen: Spurt **40,9 Pp bei n = 12 gegen 54,7 bei n = 48**, Climbing 28,9 gegen 37,2.

Noch größer ist der Bedarf, wenn sich mehrere Teilnehmer **ein** Ergebnis teilen. In der
Staffel hängen sechs Läufer an einer Teamzeit: bei n = 12 las dort jedes Attribut entweder
0 % oder einen Ausreißer (Charisma 40 % bei Matrixgewicht 10), und erst ab etwa 120 Läufen
wird die Reihenfolge stabil. Das Skript setzt die Vorgaben deshalb selbst (48, Staffel 144).

**Stand heute** (n = 48, Staffel 144):

| Disziplin | Abweichung | Bemerkung |
|---|---|---|
| Staffel | **21,9 Pp** | Speed 27,1 vs. 24. Offen: Spirit 10,3 statt 16 |
| Time-Trial | **33,6 Pp** | Speed 21,2 vs. 22, Intelligence 22,6 vs. 18. Offen: Dexterity 14 statt 25 |
| Takeshi's Castle | **34,1 Pp** | Wille 24,8 vs. 22, Intelligence 11,3 vs. 11. Offen: Charisma 6,4 statt 14 |
| Climbing | **37,9 Pp** | Ausdauer 32,9 vs. 26. Offen: Health 4,2 statt 10 |
| Spurt | **56,7 Pp** | siehe „Zwei Befunde" unten |
| TDM | **133,9 Pp** (n = 6, 554 s) | siehe unten |

### Ein Befund, der eine Entscheidung braucht

Die TDM-Messung sagt: der Kampf belohnt **Speed mit 40,8 % und Dexterity mit 22,3 %** —
zwei Attribute, die in der TDM-Matrix mit **null** stehen. Zusammen fast zwei Drittel des
gemessenen Einflusses auf etwas, das die Wertung gar nicht bepreist. Umgekehrt liegen
Charisma, Determination und Will bei 0,0 %, obwohl die Matrix ihnen 10, 6 und 0 gibt.

Die Ursache liegt nahe: Tempo entscheidet, wer zuerst am Gegner ist, und wer zuerst da ist,
schlägt länger zu. Nur sagt die Disziplingewichtung, dass Tempo im TDM nichts wert ist.

Das ist **kein Bug, den man still wegpatcht** — es ist eine Balancing-Entscheidung:
soll die Bewegung im Teamfight überhaupt an Speed hängen, wenn die Wertung Speed dort mit
null bepreist? Bitte an Chris.

Nachgemessen mit n = 6 (554 s): **133,9 Pp**, Speed 43,6 %, Dexterity 23,4 %, Power 5,5 %
gegen ein Matrixgewicht von 28. Der Befund aus dem groben Lauf hält also.

### Zuerst: der Maßstab selbst war falsch

Bevor irgendeine Zahl zu TDM gilt, gehört diese Korrektur davor — sie betrifft alles, was
in dieser Sitzung über die Kampf-Disziplinen gemessen wurde.

`aufEignung()` normiert die drei Kampfwerte **auf die Eignung**: die Rezepte geben die
FORM, die Eignung gibt die MENGE. Das ist Absicht und stammt aus der 0:6-Untersuchung.
`einflussVon()` hob aber ein Attribut, **ohne die Eignung mitzuheben**. Damit war das
Ergebnis vorbestimmt: ein gehobenes Kampfattribut konnte nur noch die Form ändern (LP
gegen ANG gegen VER), nie die Menge. Nur `TMP` und `AUS` liegen außerhalb der Normierung —
also las die Messung ausgerechnet die Bewegung als das, was alles entscheidet.

Im Spiel ist die Eignung eine Funktion der Attribute: `calculateRawDisciplineScore` in
`lib/player-formulas/discipline-rating-engine.ts` summiert Attribut × Gewicht über dieselbe
Matrix. Ich hatte genau den Kanal zugehalten, den die Matrix beschreibt.

Behoben: die Anhebung hebt die Eignung mit, um `plus × Gewicht / 100`.

**Was das ändert** — und was es *nicht* ändert:

| Disziplin | alter Maßstab | korrigiert |
|---|---|---|
| Mini-DM | 60 Pp | **13,8 Pp** |
| Fechten | 157 Pp | 87 Pp |
| Battlefield | 68,5 Pp | 110 Pp |
| TDM | 133,9 Pp | **152,4 Pp** |

Mini-DM mit 13,8 Pp ist der Beweis, dass der Maßstab jetzt stimmt: dieselbe Messung,
dieselbe Mechanik, aber Rezepte, die aus der eigenen Matrix gebaut sind.

**Und TDM wird dadurch nicht besser, sondern schlechter.** Ich hatte zwischenzeitlich
geschrieben, der TDM-Befund sei größtenteils ein Messfehler — das war falsch. Er ist
größer als gedacht.

### Der Mechanismus, präzise

`aufEignung()` normiert LP, ANG und VER — `TMP` und `AUS` nicht. Ein Attribut, das dort
steht, bekommt einen **Gewinn erster Ordnung**, unabhängig von seinem Matrixgewicht.

Im TDM stehen Speed mit 46 und Dexterity mit 24 in `TMP`, und beide haben in der
TDM-Matrix Gewicht **null**: sie bringen vollen Gewinn ohne jede Gegenleistung an die
Eignung. Gemessen: Speed 46,1 %, Dexterity 24,7 %, während Power (Gewicht 28) auf 3,9 %
fällt und Health (20), Stamina (14) und Charisma (10) auf exakt null.

Dasselbe Muster erklärte Battlefield (Entschlossenheit und Ausdauer bei Matrixgewicht 4
auf je 24 %, weil ich sie in `AUS` gesetzt hatte) und Fechten (Intelligence und Health bei
Gewicht 4 auf 24 % bzw. 24 %).

### Ein Versuch, der mit dem kaputten Maßstab gemessen wurde — nicht verwenden

Zwischenzeitlich habe ich die Bewegung von Speed und Dexterity entkoppelt und gemessen:
133,9 → 180 Pp, also scheinbar schlechter, mit Awareness bei 49,5 % und Intelligence bei
39,3 %. Daraus hatte ich geschlossen, es liege nicht an Speed, sondern daran, dass „zuerst
ankommen" den Teamfight entscheidet.

**Dieser Versuch lief mit dem kaputten Maßstab und trägt nichts.** Er ist hier nur
aufgeschrieben, damit ihn niemand aus einer älteren Nachricht heraussucht und für gültig
hält. Der Effekt, den er zeigte, war die Signatur des Messfehlers: was in `TMP` steht,
gewinnt — und ich hatte Awareness und Intelligence hineingesetzt.

### Das Ventil ist geschlossen — und was das kostet

`TMP` und `AUS` gehen jetzt mit in die Normierung. Damit kann kein Rezept mehr durch bloße
Platzierung eines Attributs einen Gewinn erster Ordnung erzeugen.

| Disziplin | vorher | jetzt |
|---|---|---|
| Mini-DM | 13,8 Pp | **14,0 Pp** |
| Fechten | 87 Pp | **39 Pp** (zusammen mit neu gezogenen Rezepten) |
| Battlefield | 110 Pp | **101,7 Pp** |
| **TDM** | 152,4 Pp | **83,7 Pp** |

Im TDM fallen **Speed und Dexterity auf exakt 0 %** (Matrixgewicht je 0), und Power steigt
von 3,9 auf 21,4 % (Gewicht 28). Genau das war das Ziel.

**Was noch nicht stimmt:** Awareness liest im TDM 29,7 % bei Gewicht 2, Health 34,1 % bei
Gewicht 20, Stamina und Charisma weiter 0 % bei 14 und 10. Und Battlefield bewegt sich
kaum — Ausdauer und Entschlossenheit lesen dort 20,8 %, obwohl die neuen Rezepte sie nur
noch mit 8 führen und die Matrix ihnen 4 gibt. Bei n = 6 und acht Beteiligten kann das
Rauschen sein; vor einer Deutung mit größerer Stichprobe nachmessen.

**Und ehrlich gesagt: WARUM es so stark wirkt, ist nicht geklärt.** Der Faktor hängt nur an
LP, VER und ANG; `TMP` wird mitskaliert, nicht auf ein Ziel normiert. Der Effekt ist
gemessen, die Erklärung dafür nicht. Wer hier weiterarbeitet, sollte das wissen und es
nicht für verstanden halten.

### Der Preis — und er gehört Chris

Die Änderung dreht das Kräfteverhältnis **nicht** um. In der reinen Messlage (ohne
Mutatoren, ohne Formkarten) gewinnt V-W **100 % in allen vier Kampfdisziplinen — mit und
ohne Kappung, unverändert**.

Mit allem drum herum sieht es anders aus:

| | ohne Kappung | mit Kappung |
|---|---|---|
| TDM | 25 % | **0 %** |
| Mini-DM | 25 % | **0 %** |
| Fechten | 50 % | 25 % |
| Battlefield | 25 % | **0 %** |

Der Grund liegt nicht in der Kappung selbst, sondern in einer Schieflage, die es vorher
schon gab: die Mutatoren geben A-A **+60** Eignungspunkte gegen V-W **+30**. Vorher hob
dieser Vorsprung nur die Kampfwerte; jetzt hebt er auch Tempo und Ausdauer, und damit
schlägt er doppelt durch.

**Das ist eine Entscheidung, keine Reparatur.** Entweder die Mutatoren werden ausgeglichen
(sie sind eine zweite Gewichtung neben der Disziplinmatrix — genau das Muster, das in
dieser Sitzung dreimal Ärger gemacht hat), oder die Kappung bleibt draußen und die Matrix
setzt sich im Kampf weiterhin nicht durch. Beides ist vertretbar; ich habe die Kappung
drin gelassen, weil sie das strukturelle Problem löst, und schreibe den Preis hierher,
statt ihn zu verstecken.

---

## Das Bahn-Chassis: fünf Disziplinen, ein Motor

Fünf der zwanzig Disziplinen sind im Kern dieselbe Sache — von einem Start zu einem Ziel
kommen, unterwegs stehen Hindernisse im Weg, und die Kraft reicht nicht für alles. Sie
fünfmal zu programmieren hieße, denselben Fehler fünfmal einbauen zu können. Also einmal
Motor, fünfmal Konfiguration: `BAHN_ART` im Entwurf.

Die **sieben Rollen** sind überall dieselben, nur ihr Name und ihre Zutaten wechseln:

| Rolle | Spurt | Staffel | Time-Trial | Climbing | Takeshi |
|---|---|---|---|---|---|
| ANTRITT | Antritt | Antritt | Antritt | Zug | Losstürmen |
| ENDTEMPO | Endtempo | Abschnittstempo | Renntempo | Ausdauertempo | Durchhaltetempo |
| TECHNIK | Technik | **Wechsel** | **Linie** | **Griff** | **Falle lesen** |
| WENDIGKEIT | Wendigkeit | Bahnarbeit | Umsetzen | Umsetzen | **Aufstehen** |
| STEHEN | Stehvermögen | Stehvermögen | Durchhalten | Kraftausdauer | **Wille** |
| WUCHT | Wucht | **Zug an der Spitze** | **Risiko** | **Kraftzug** | **Durchbrettern** |
| ROBUST | Robustheit | Verlässlichkeit | Fahrsicherheit | Zähigkeit | Nehmerqualität |

Was je Disziplin schaltbar ist: Windschatten, Tackling, Zahl und Art der Hindernisse, wie
schwer sie zu nehmen sind, was ein Fehler kostet, der Kraftvorrat, die Steigung, Boden und
Bäume. Eine sechste Bahn braucht einen Eintrag in `BAHN_ART` — sonst nichts: die Motoren
melden sich selbst bei der Messung an, und die Aufstellung baut sich aus den erzeugten
Slots.

**Ersatzaufstellung.** Für Spurt stellt Chris von Hand auf; für eine neue Bahn gibt es noch
keine Aufstellung, und ohne Läufer lässt sich nichts messen. Wer nicht gesetzt ist, wird
nach Eignung gesetzt. Sobald jemand von Hand aufstellt, gilt seine Aufstellung.

### Was die Messung dabei gelehrt hat

Drei Fehler, jeder zuerst als Vermutung gehabt und dann von der Messung widerlegt oder
bestätigt:

1. **Ein zu weit gespreiztes Feld macht jede Feinheit unsichtbar.** Time-Trial lief 8,3 s
   gegen 22,2 s. Bei so einer Spreizung dreht keine verpasste Kurve mehr einen Platz —
   Intelligence las **0,0 %** bei einem Matrixgewicht von 18. Nach dem Verdichten
   (Grundtempo hoch, Spanne runter): 18,2 %.
2. **Ein Hindernis, das zu 80 % gelingt, bezahlt sein Attribut nicht.** Deshalb sind
   Kurve und Griff schwerer als die Hürde.
3. **Wendigkeit war totes Gewicht, wo es keine Spur zu wechseln gibt.** Ohne Windschatten
   und ohne Gegner in Reichweite wechselt im Zeitfahren und an der Wand niemand die Bahn —
   Awareness las exakt 0 %. Jetzt verkürzt Wendigkeit dort die Erholung nach einem Fehler:
   die Linie wiederfinden, den Griff neu setzen.

Und ein Fehlschlag, der nicht behoben wurde, sondern zurückgenommen: der Versuch, Spurts
Will-Anteil durch weniger Will in den Rezepten zu senken, machte es **schlechter** —
Determination rückte einfach nach.

### Staffel und Takeshi's Castle: was dort anders ist

**Staffel** ist die einzige Bahn, auf der nicht alle gleichzeitig laufen. Sechs Läufer,
sechs Abschnitte, fünf Wechsel — immer nur einer je Mannschaft ist unterwegs, die übrigen
stehen sichtbar in ihrer Wechselzone. Geprüft wird die Übergabe mit dem **Schnitt aus
abgebendem und annehmendem** Läufer; wer sie verpatzt, kostet die Mannschaft Zeit. Deshalb
zählt hier die **Teamzeit** und nicht die eigene Platzierung — alle sechs teilen sich
dasselbe Ergebnis, und Plätze kippen nur, wenn die Teams tauschen. Das ist ein Münzwurf,
kein Maß: mit Platzierung las jedes Attribut exakt 0 %.

Dabei fiel ein echter Modellfehler auf, der alle Bahnen betraf: die Beschleunigungsphase
hing an der **Rennuhr**, nicht am Läufer. Nach 3,2 Sekunden war ANTRITT für alle erledigt —
der Schlussmann, der bei Sekunde neun aus dem Stand übernimmt, hatte also gar keinen
Antritt. Spirit, das dort sitzt, las 0 % bei einem Matrixgewicht von 16.

**Takeshi's Castle** ist keine Laufbahn, sondern ein Spießrutenlauf: vierzehn Fallen, und
Speed steht in der Matrix mit 4 fast ganz unten. Wille steht mit 22 oben — also entscheidet
nicht Tempo, sondern **Durchkommen**. Erste Fassung warf nach drei Stürzen raus, egal bei
wem; gemessen trug damit Torment 33,6 % (Matrix 7) und Wille 8,9 % (Matrix 22), also genau
verkehrt herum. Der Grund war logisch: wenn jeder gleich viele Stürze verträgt, entscheidet
nur, wer sie **vermeidet** — und das ist Wucht. Wer wieder aufsteht, kam nie vor.

Jetzt hat jeder ein **Nervenkostüm** aus seinem Willen, ein Sturz kostet davon, und wer
leer ist, scheidet aus. Die Nerven wirken außerdem laufend aufs Tempo: wer zweimal im
Wasser lag, geht die nächste Falle zaghafter an. Das **Publikum** ist der Kanal für
Charisma — wer die Menge hat, sammelt zwischen zwei Fallen wieder Nerven.

### Zwei Befunde, die eine Entscheidung brauchen

**1. Die Bahn baute beide Seiten ungleich — derselbe Fehler wie im TDM.** Unsere Läufer
bekamen Slot-Aufschlag, Form und Stufe, der Gegner nur seinen Disziplinwert. Im Kampf ist
das seit der 0:6-Untersuchung behoben, auf der Bahn stand es noch. Im Bild sah man es
daran, dass alle sechs Gegner denselben Rennplan trugen — die Zuordnung hängt an einem
Slot, den sie gar nicht hatten. Behoben; alle Zahlen oben sind **nach** dieser Korrektur
gemessen (sie hat jede Disziplin verschoben, Staffel 30,5 → 21,9, Spurt 47 → 59,6).

**2. Rempeln ist uneigennützig — deshalb kann Torment in Spurt nicht bezahlen.** Die
Spurt-Matrix führt Torment mit 14; gemessen trägt es 5,5 %. Das ist kein Tuning-Problem,
sondern die Mechanik selbst:

- Rempeln passiert oft genug (8,35 Rempler je Rennen).
- **Mehr** Rempeln machte es schlechter: mit wuchtabhängiger Häufigkeit fiel Torment auf
  1,3 % und die Gesamtabweichung stieg auf 59 Pp.
- Der Grund: ein Rempler kostete den Remplenden selbst Tempo und Kraft, half aber dem
  **ganzen Feld** hinter dem Opfer. Nimmt man die Eigenkosten weg, steigt Torment sofort
  von 2,2 auf 7,4 % — das ist jetzt so eingestellt.

Mehr geht mit diesem Maßstab nicht: gemessen wird die eigene Platzierung, und ein Rempler
bringt sie nur zufällig. Entweder darf ein Rempler den Remplenden gezielt **vorbeibringen**
(dann zahlt Wucht), oder Spurts Matrixgewicht von 14 beschreibt nicht, was ein Sprint tut.
Das ist Chris' Entscheidung, nicht meine.

Der Rest von Spurts 56,7 Pp sitzt bei Wille (27,1 gegen 14) und Entschlossenheit (24,9
gegen 15). Beide stecken in ANTRITT und ENDTEMPO, also in dem, was direkt schnell macht —
in einem Rennen dominiert das, was Tempo gibt. Weder ein größerer Kraftvorrat (59,6 → 58,9)
noch eine schwächere Ermüdung (→ 56,7) hat daran viel geändert.

---

## Verlässliche Einstiegspunkte

| Was | Wo |
|---|---|
| Der Entwurf | `public/mockups/battle-mode.html` (eine Datei, kein Bundle) |
| Reiter im Spiel | `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` |
| Artefakt | https://claude.ai/code/artifact/af3bba05-dc93-4bcc-92f0-5f742f42380e |
| Sprite-Baukasten | https://claude.ai/code/artifact/bea50d43-e66c-4008-aabf-36a293d594fd |
| Messreihe | `node scripts/miss-arena-serie.mjs 24` (aus dem Repo-Wurzelverzeichnis!) |
| Abnahme-Messung | `node scripts/messe-arena-einfluss.mjs <disziplin> <läufe>` |
| Daten erzeugen | `npx tsx scripts/generiere-arena-daten.ts --schreiben` |
| Spielstand | `git fetch origin live-save` — siehe `CLAUDE.md` |

Playwright-Skripte **müssen im Repo liegen und von dort laufen**, sonst findet Node das
Modul nicht. Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

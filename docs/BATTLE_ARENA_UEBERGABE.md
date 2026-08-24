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

## Der Netzzugang ist offen — Stand 23.08., 23:30

Chris hat die Umgebung auf **Full** gestellt und eine neue Sitzung gestartet. Zum
Nachmessen, nicht zum Vertrauen:

```sh
curl -sS -o /dev/null -w "%{http_code}\n" https://opengameart.org/
curl -sS -o /dev/null -w "%{http_code}\n" https://www.dropbox.com/
```

`200` statt `000` heißt: er steht. Falls doch `000` — die Policy wird beim Start des
Containers eingefroren, eine laufende Sitzung sieht eine Änderung **nie**. Dann eine
neue Sitzung, nicht suchen.

Wo der Schalter sitzt, falls er nochmal gebraucht wird: **claude.ai/code im Browser**
(nicht die Desktop-App), Wolken-Symbol mit dem Umgebungsnamen über dem Eingabefeld →
Zahnrad → **Network access**. Vier Stufen: None, Trusted, Full, Custom. Die Voreinstellung
*Trusted* hat **kein Feld für eigene Domains** — dort einzutragen wirkt nicht. Das war
der Grund, warum „ich hab doch alles freigegeben" nichts brachte: der Schalter unter
`Einstellungen → Fähigkeiten → Code-Ausführung` gilt für die **Analyse-Sandbox in
Chats**, nicht für Claude Code.

---

## Das steht jetzt an

### 1. Die 599 Spielerbilder aus Chris' Dropbox ← der große Posten

Der Connector funktionierte schon immer (Suche, Metadaten, Ordner), nur die **Bilddaten**
kamen nicht durch — sie werden von `*.dropboxusercontent.com` ausgeliefert. Mit Full ist
das offen.

Ordner: `/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/` und `Spieler/fertig/`
(höhere Auflösung). **Der Dateiname IST der Spielername** — `Krolach.jpg`, `Grimborg.jpg`,
`Nazuna.jpg`. Chris ausdrücklich: „namen der jpg sind die spieler". Die Zuordnung ist
also trivial, es braucht keine Heuristik.

Weg: `mcp__Dropbox__download_link` liefert eine einmalig gültige URL, die dann mit `curl`
geholt wird. **Nicht** vorher per HEAD antesten — der Link wird von der ersten Anfrage
verbraucht, egal welcher Methode.

**Wozu:** `lib/battle/subclass-archetypes.ts` ordnet jede der 56 Unterklassen MEHREREN
Archetypen zu — nach Chris' Regel „im Zweifel alle zuweisen, dann ist der Skill-Pool
größer". Ein Bild verengt die Auswahl für **diesen einen** Spieler. Fünf sind
eingearbeitet (`BILDBEFUNDE`), 594 fehlen.

Ebenfalls dort: `Rassen Klassen Traits.xlsx`, `Oly Player Stats 05-2026.xlsx`,
`Olympiade Player Stats.csv` — noch nie angesehen.

### 2. Hintergründe für die Disziplinen

TDM in einer tödlichen Kampfarena, Spurt als Hindernislauf im Freien. Noch gar nicht
angefangen, weil OpenGameArt nicht erreichbar war. Jetzt ist es das.

### 3. Die Lauf-Sprites — zum größten Teil erledigt, der Rest ist keine Lücke

**Der LPC-Satz lag nie hinter der Netzsperre.** Er liegt auf GitHub, und GitHub war die
ganze Zeit offen:

```sh
git clone --depth 1 https://github.com/LiberatedPixelCup/universal-lpc-spritesheet-character-generator
```

522 MB, 88.114 PNG, 768 JSON-Definitionen. Daraus sind **209 Blätter** in den Baukasten
gewandert — `walk`, `run`, `shoot`, `hurt`, `idle` für alle 45 Ebenen, die sich zuordnen
ließen. Damit laufen jetzt auch Krone, Bart und Schulterstücke, und die `hurt`-Blätter
für gefallene Kämpfer sind da.

Zugeordnet über die **Alpha-Maske** (die überlebt das Umfärben, die Farben nicht); alle 45
sind byte-identisch mit ihrer Quelle. `public/sprites/baukasten/quellen.json` hält je
Ebene den LPC-Pfad fest.

**Was fehlt, fehlt im LPC-Standard selbst** — nachgemessen, nicht vermutet:

| | |
|---|---|
| Arme, Beine (Platte) | `run` nur für Stoff und Kleinteile, für Plattenrüstung in **keiner** Variante |
| Umhang, Fetzen | die Kategorie `cape/` hat **null** `run`-Blätter |
| Haar | unser `h_*` kommt aus `flat_top_fade/male/` (kein `run`); `adult/` daneben hat eines, ist aber anderes Bild |
| **Waffen** | **keine einzige** Waffe im ganzen Satz hat `run` |

Draco kann mit Doppelaxt stehen und gehen, nicht rennen. Das ist eine Entscheidung
(Waffe im Sprint ausblenden, oder `walk` fahren), kein Beschaffungsproblem.

Offen bleiben zwei benannte Lücken:
- **Krone für die Arena** — King Arlen hat sie in der Kaderliste, im Kampf noch nicht.
- **Vogel-Sprite für Seraph-11** — sein Bild zeigt einen mechanischen Vogel; er läuft als
  Metallgestalt mit Flügeln. Steht als Platzhalter im Code.

---

## Was die Sitzung vom 23.08. abends geändert hat (PR #654)

Setzt auf #651 auf. Vier Dinge, jedes gemessen:

**Heiler griffen zusätzlich an.** Chris: „die beiden heiler ZUSÄTZLICH noch normal
angreifen, sie müssen entweder angreifen oder heilen". Der Grundangriff teilte sich mit
dem Heal die Uhr `u.cd`, war also ausgeschlossen — die **Skills** aber laufen auf eigenen
Abklingzeiten in `u.cds[id]`, und `fuehreAus` fasste `u.cd` nie an. Ein Heiler heilte
(Uhr für 2,0 s belegt) und feuerte in genau diesen zwei Sekunden weiter Skills.

| | vorher | nachher |
|---|---:|---:|
| Schaden **durch Heiler** je Kampf | 655 | 1 |
| Greenkraut | 383 Schaden / 354 Heilung | 0 / 308 |
| Seraph-11 | 272 / 177 | 1 / 177 |
| Siegquote V-W | 25 % | 100 % |

Die beiden trugen zusammen mehr Schaden bei als Cassandra (289), die stärkste Angreiferin
von A-A. Jetzt belegt **jede** Handlung eines Heilers dieselbe Uhr.

**Die Serie zog die Mutatoren nur einmal.** Für die Formkarten war das repariert, für die
Mutatoren nicht — 24 Kämpfe maßen einen einzigen Zug 24 Mal. Jetzt je Kampf neu.

**Elf von zwanzig Köpfen ließen sich nie umfärben.** `bFaerbe` suchte immer die helle
Hautrampe; tatsächlich liegen nur drei Köpfe dort (`light`), vier in `green`, drei in
`fur_brown`, vier in eigenen Sonderpaletten. Unsichtbar, weil ein grüner Echsenkopf grün
aussieht, ob man ihn anfasst oder nicht. Jedes Körperblatt bestimmt seine Quellrampe
jetzt selbst. Dazu: `B_PAL` führte sieben Hauttöne, jetzt alle 22 des LPC-Satzes.

**Rhyx'Tal ist ein Gargoyle** (Chris: „ja bau den gargoyle"). Steingrau `fur_grey`,
`z_hoerner`, `z_fluegel_bg/_fg` — ohne ein neues Blatt. Ehrlich vermerkt, auch im Code:
Flügel stehen **nicht** in seinem Portrait, das ist Chris' Ansage.

---

## Offene fachliche Punkte

### A. Die Mutatoren — ENTSCHIEDEN, nicht mehr offen

Der Zweifel der Vorsitzung („Renegade meinte wohl ein Auslösen im Kampf, nicht einen
Dauerbonus") war **falsch**. Chris am 23.08.:

> „renegade ist n mutator wie jeder andere und bringt 6 score punkte und 0,3 PPs
> das bleibt auch weiter so"

Damit ist es ein dauerhafter Aufschlag auf die Disziplinwertung, und der Code hatte es die
ganze Zeit richtig. Nachgeprüft in `lib/lineups/legacy-lineup-modifiers.ts`:

```ts
playerMutatorBonuses[playerId]    = Number((hits * 6).toFixed(1));
playerMutatorPpsBonuses[playerId] = Number((hits * 0.3).toFixed(2));
```

Im Mockup entspricht das `TRAIT_PUNKTE = 6`. **Nicht daran drehen.** Wer künftig ein
Ungleichgewicht bei den Mutatoren vermutet, sucht die Ursache woanders — die Zahl steht.

**Was die Klärung stattdessen aufgedeckt hat:** die Serie zog die Mutatoren nur EINMAL
beim Laden und ließ sie für alle 24 Kämpfe gelten — derselbe Messfehler, der für die
Formkarten schon repariert war. Behoben in PR #654, sie werden jetzt je Kampf gezogen.

**Der Balance-Stand danach:** mit dem Heiler-Fix gewinnt V-W **100 %** bei gestreuten
Ergebnissen (6:0 9×, 6:2 5×, 6:3 5×, 6:1 4×, 6:4 1×). Das ist **kein Erfolg, sondern der
nächste Befund** — 100 % ist so wenig eine Balance wie 25 %. Der Doppelbezug der Heiler
hatte A-A getragen; ohne ihn tragen die Mutatoren das Ergebnis nicht mehr. Hier ist der
nächste Punkt zum Messen, und zwar **ohne** an `TRAIT_PUNKTE` zu drehen.

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

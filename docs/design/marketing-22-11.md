# Marketing: Marketability je Spieler, Fanprofil je Team (22.11., Runde 3)

Chris, 22.11., wörtlich: „Was ist mit marketing? können wir ne marketing score für die spieler generieren basieren auf ihrer
marketability? die sich aus traits etc zusammensetzt? wichtig ist nicht nur 'gute' stats heißen direkt gute marketability
sondern auch leute die anecken können gut dafür sein je nachdem, und ggf haben Hell Raisers ne andere Fan Zielgruppe als die
Golden Gladiators kannst du da mal was vorbereiten“

**Runde 2, Chris am 22.11. zum ersten Mockup, wörtlich:** „bei dem was Fans lieben und nicht mögen bitte nur Rassen und Klassen
die wir auch haben, oder ggf. Traits, und bei den Farben POW SPE MEN SOC ich will dass das über Seasons ja auch shiften kann
etc. und wie gesagt schlechte manners heißt nicht schlechte Marketability, sondern manchmal ist die Mitte zu ‚langweilig' und
man kann besser werben mit jemandem der edgy etc. ist. wichtig ist dass Marketing-Einnahmen auch teils an den Spieler gehen und
seine Moral heben und nur zum Teil ans Team, weil wenn ein Team z. B. 8C bekommt zahlen teure Spieler über 50% ihres Gehalts am
Ende selber, das möchte ich nicht! wenn es 8C pro Season für alle sind dann ist das vollkommen fine, evtl. sogar etwas zu
gering? wären ja nur 0,5 pro Season pro Spieler im Schnitt, glaub da geht mehr, schwache Spieler bringen vermutlich auch fast
gar nichts dann außer sie heben sich durch Aktionen hervor oder haben eine Persönlichkeit die hervorsticht.“

**Runde 3, Chris am 22.11. zum zweiten Mockup, wörtlich:** „im Marketing brauch ich nur meine eigenen Spieler und wie die sich
warum und wie aufs Marketing auswirken, da brauch ich keine Leute vom Transfermarkt. Du kannst aber die Marketability auch beim
TM einfügen als eigenen Stat, der natürlich auch etwas vernebelt ist! 1. wieso soll Team-Anteil fix 15 % vom Gehalt sein? das
ist ja lame, das soll doch ein dynamischer Wert werden“. Umgesetzt: Die Seite zeigt nur den eigenen Kader mit der Zerlegung
„warum“ (Abschnitt 7a), der Team-Anteil ist dynamisch (4.2), die Marketability wird ein eigener Stat im Transfermarkt mit
Scouting-Nebel (5.1). Die Fragen 2 und 3 derselben Rückmeldung (Einnahmen gegen Ausgaben, günstigere Plätze) stehen im
Finanzpapier, Abschnitt (i).

Konzept und Mockup, kein App-Code. Mockup: `public/mockups/marketing-22-11.html` (`?team=H-R|G-G`, `&sel=<spieler>`,
`&so=<spalte>`, `&ktab=fan|spieler|verlauf`). Alle Gewichte sind Startwerte für einen Messlauf. Die Beispielzahlen sind mit
den Formeln unten über den echten Spielerpool gerechnet (`data/generated/oly-player-stats.json`, 2.984 Spieler) und über die
Referenzkader (`data/generated/oly-rosters.json`, 261 Spieler in 32 Teams).

## Kurzfassung

- Jeder Spieler hat eine **Reichweite** (0 bis 100): wie viel Aufmerksamkeit er bekommt, egal wo er spielt. Höchstens 30
  Punkte kommen aus der Leistung, bis zu 46 aus den Traits, bis zu 14 aus Klasse und Rasse, bis zu 20 aus Aktionen.
- Jeder Spieler hat einen **Ton** von −1 (Bösewicht) bis +1 (Liebling) und eine **Kante** von 0 (brav und farblos) bis 1
  (viel Profil, egal in welche Richtung).
- Jedes Team hat ein **Fanprofil**: einen Ton (aus `manners`), Vorlieben und Abneigungen aus **echten Rassen, Klassen und
  Traits**, und eine **Farbe der Fans, die je Saison driftet**.
- **Kante schlägt Mitte** (neu): Die brave Mitte bekommt bei jedem Team einen Abschlag von 10 %, ein Spieler mit Kante bis
  zu 10 % Zuschlag. Die Richtung kommt obendrauf: Bösewicht-Fans mögen den Schurken am meisten, Liebling-Fans den
  Strahlemann, aber auch bei Liebling-Fans ist „edgy-charmant“ besser als langweilig.
- **Marketability bei einem Team = Reichweite × Passung** (0,6 bis 1,4). Mauler (Demon, `Scandalous`, `Egomaniac`) kommt bei
  Hell Raisers auf 100, bei Golden Gladiators auf 62.
- **Das Werbegeld wird geteilt, der Team-Anteil ist dynamisch** (Runde 3): Je Spieler entsteht Werbegeld von 0 bis 10 C je
  Saison. Das Team bekommt davon **15 bis 65 %**: 40 % als Ausgangswert, dazu Persönlichkeit, Werbeklausel im Vertrag,
  Vertragslaufzeit, Moral, Aushängeschild und Teamerfolg. Ein `Egomaniac` will mehr für sich, ein `Loyal` gibt mehr ab. Der
  Rest sind seine eigenen Werbeverträge und **hebt seine Moral**. Sicherheitsnetz: nie mehr als 25 % seines Gehalts, kein
  Spieler bezahlt sein Gehalt selbst.
- Größenordnung: ein Team bekommt 4 bis 17 C je Saison (Mittel 7,3 C), die Spieler zusammen rund 215 C in der Liga. Schwache
  Spieler ohne Profil bringen 0. **Sponsor und Marktwert bleiben unverändert.**
- **Die Seite Marketing zeigt nur den eigenen Kader.** Fremde Spieler bekommen die Marketability als eigene Spalte im
  Transfermarkt, mit Scouting-Nebel (Runde 3).

---

## 1. Was es im Code schon gibt

| Baustein | Stelle | Nutzen hier |
|---|---|---|
| 18 positive und 18 negative Traits | `lib/training/class-progression-config.ts:234` bis `:274` (`CANONICAL_POSITIVE_TRAITS`, `CANONICAL_NEGATIVE_TRAITS`) | Reichweite, Ton, Kante, Vorlieben der Fans |
| 13 Klassen mit Klassenfarbe | `CLASS_COLOR_MAP`, `lib/lineups/legacy-lineup-modifiers.ts:31` | Vorlieben der Fans, Farbpassung |
| 18 Rassen | Feld `race`, `lib/data/olyDataTypes.ts:683`; im Pool: Human, Demon, Construct, Elf, Animal, Divine, Alien, Orc, Aqua, Dwarf, Lizard, Dragon, Tauren, Plant, Mutant, Voidborn, Goblin, Gnom | Vorlieben der Fans |
| Felder je Spieler | `lib/data/olyDataTypes.ts:683` bis `:688`, `:1156` (`alignment`) | Typ, Ton |
| Beliebtheit je Team (0,5 bis 1,5) | `lib/economy/team-beliebtheit.ts:37` | bleibt die Größe der Fanbasis |
| Kleine Trait-Wirkung auf die Beliebtheit | `lib/traits/cosmetic-trait-soft-effects.ts:71` (`Eloquent` +0,03, `Scandalous` −0,03) | alte Sicht „Skandal ist schlecht“ (Abschnitt 6) |
| Teamwerte `manners`, `popularity`, Farbgewichte | `data/source/team-identities.json` | Ton und Startfarbe des Fanprofils |
| Themen je Team | `THEME_TARGETS` in `lib/ai/team-theme-composition-service.ts:173` | Vorlage für die Vorlieben; bleibt für die KI-Kaderplanung, wie es ist |
| Moral je Spieler | `docs/design/form-moral-17-11.md` | Ziel des Spieler-Anteils |
| Team-Identität driftet 10 bis 20 % je Saison | `docs/design/zwischen-den-spieltagen-22-11.md` Zeile 1208 | Vorbild für die Drift der Fanfarbe |

Zwei Dateneinträge im Pool sind keine echten Rassen (`Unknown`, `Fish`, je ein Spieler) und drei Traits sind Tippfehler
(`Maniupulative`, `lazy`, `timid`, je ein Spieler). Das Marketing liest sie als die korrekte Schreibweise bzw. als „keine
Vorliebe“.

## 2. Marketability je Spieler

### 2.1 Reichweite (0 bis 100), für alle Teams gleich

    Reichweite = Leistung + Ausstrahlung + Typ + Schub, höchstens 100

| Teil | Bereich | Rechnung |
|---|---:|---|
| **Leistung** | 0 bis 30 | 0,30 × Perzentil. Vor der ersten Saison das Perzentil des Ratings im Pool, danach zur Hälfte das Perzentil der PP der letzten Saison in der eigenen Liga |
| **Ausstrahlung** | 0 bis 46 | 10 + 1,2 × Summe der Reichweiten-Punkte der Traits, begrenzt auf 0 bis 46 |
| **Typ** | 0 bis 14 | Klasse + Rasse (unten), höchstens 14 |
| **Schub durch Aktionen** | 0 bis 20 | Tabelle unten; so fällt auch ein schwacher Spieler auf |

**Trait-Tabelle** (Reichweite · Ton). Ton +1 = Liebling, −1 = Bösewicht.

| Liebling | | Anecker | | Farblos | |
|---|---|---|---|---|---|
| `FanFavorite` | +12 · +1,0 | `Scandalous` | +10 · −1,0 | `Timid` | −6 · +0,1 |
| `Sexy` | +9 · +0,2 | `Diva` | +8 · −0,5 | `Lazy` | −4 · −0,2 |
| `Eloquent` | +7 · +0,6 | `Renegade` | +7 · −0,8 | `FaintHearted` | −4 · 0 |
| `Cool` | +6 · +0,3 | `Egomaniac` | +6 · −0,6 | `Mercenary` | −2 · −0,4 |
| `Fearless` | +5 · +0,2 | `Feisty` | +5 · −0,5 | `Paranoid` | −2 · −0,2 |
| `FiredUp` | +5 · 0 | `Cruel` | +5 · −1,0 | `Relaxed` | −1 · +0,2 |
| `Ambitious` | +3 · 0 | `Gambler` | +4 · −0,4 | `Flexible` | 0 · 0 |
| `Loyal` | +3 · +0,6 | `Cheater` | +4 · −1,0 | `Diligent` | 0 · +0,2 |
| `Caring` | +3 · +0,9 | `Vindictive` | +3 · −0,7 | `Disciplined` | 0 · +0,3 |
| `Altruistic` | +3 · +1,0 | `Devious` | +3 · −0,8 | `Resourceful` | +1 · 0 |
| `Fair` | +3 · +0,9 | `ColdBlooded` | +3 · −0,6 | `Healthy` | +1 · +0,2 |
| `Motivated` | +2 · +0,3 | `Manipulative` | +2 · −0,7 | `Obsessive` | +1 · −0,1 |

**Typ.** Klasse: Bard, Hero, Badass +8 · Warlord +5 · Berserker +4 · Mage, Rogue, Sprinter +3 · Templar, Charger +2 · Tank +1 ·
Tactician, Overseer 0. Rasse (Seltenheit im Pool): Dragon +6 · Voidborn +5 · Divine +4 · Demon, Alien, Mutant +3 · Tauren,
Aqua, Lizard +2 · alle anderen 0.

**Schub durch Aktionen** (neu, ersetzt „Ruhm“). Jeder Schub ist befristet und klingt danach in gleichen Schritten ab.

| Aktion | Reichweite | Dauer | Nebenwirkung |
|---|---:|---|---|
| MVP des Spieltags | +3 | 3 Spieltage | – |
| Szene des Spieltags (höchster Einzelwert, entscheidende Aktion im Derby oder Finale) | +4 | 3 Spieltage | – |
| Medaille der Disziplin (Gold · Silber · Bronze) | +4 · +2 · +1 | nächste Saison | – |
| MVP der Saison oder Top 3 der PP-Bestenliste | +6 | nächste Saison | – |
| Skandal (Sponsor-Ereignis „Reibung“, Platzverweis, Streit) | +6 | 5 Spieltage | Ton −0,3 für dieselbe Zeit |
| Treue (`Loyal`, je Saison im selben Verein) | +1 | dauerhaft, höchstens +4 | Ton +0,1 |

Die Summe ist auf 20 begrenzt. Ein Spieler mit Rating 40 und drei blassen Traits (Reichweite rund 25, Werbegeld 0) kommt mit
Gold, einer Szene und einem MVP auf 36 und damit erstmals über die Schwelle von 30.

### 2.2 Ton und Kante

    Liebling-Gewicht L = Summe über Traits mit Ton > 0:  Ton × max(Reichweite des Traits, 1)
    Anecker-Gewicht  A = Summe über Traits mit Ton < 0: |Ton| × max(Reichweite des Traits, 1)
    Ton   = (L − A) ÷ 12 + Gesinnung, begrenzt auf −1 bis +1      (Gesinnung: endet auf -G +0,4, auf -B −0,4)
    Kante = (L + A) ÷ 20, begrenzt auf 0 bis 1

Der Ton sagt, **auf welcher Seite** ein Spieler steht. Die Kante sagt, **wie viel Profil** er überhaupt hat. Das sind zwei
verschiedene Dinge: Zephiroth (`FanFavorite` und `Scandalous`) hat Ton −0,03, also genau die Mitte, aber Kante 1,0. Er ist
„edgy-charmant“. King Arthur (`Loyal`, `Ambitious`, `FaintHearted`) hat Ton +0,55 und Kante 0,09: brav und farblos.

Im Pool haben 951 von 2.984 Spielern eine Kante unter 0,2 (die Langweiler) und 575 eine ab 0,6. Von den 100 Spielern mit
der höchsten Reichweite haben 92 eine Kante ab 0,5; die Seite ist dabei gemischt (34 klar Bösewicht, 17 in der Mitte, 49
Liebling).

### 2.3 Passung zum Team (0,6 bis 1,4)

    Passung = 1 + Ton-Passung + 0,15 × Thema + 0,05 × Farbe
    Ton-Passung = −0,10 + 0,20 × Kante + 0,22 × Ton × Ton der Fans

Die ersten zwei Glieder der Ton-Passung sind der **Langweiler-Abschlag**: Kante 0 gibt −10 %, Kante 1 gibt +10 %, bei jedem
Team. Das dritte Glied ist die Richtung.

| Spielertyp | Ton · Kante | Bösewicht-Fans (Ton −1,00) | neutrale Fans (Ton 0) | Liebling-Fans (Ton +0,78) |
|---|---|---:|---:|---:|
| Bösewicht mit Kante | −1 · 1 | **+32 %** | +10 % | −7 % |
| Edgy-charmant | 0 · 1 | +10 % | +10 % | +10 % |
| Strahlender Liebling | +1 · 1 | −12 % | +10 % | **+27 %** |
| Brav und farblos | 0 · 0 | **−10 %** | **−10 %** | **−10 %** |
| Brav, etwas Profil | +0,5 · 0,3 | −15 % | −4 % | +5 % |

Lesart: In jeder Spalte steht die brave Mitte unten oder fast unten. Bei Liebling-Fans schlägt der Edgy-Charmante (+10 %)
den Farblosen (−10 %) um 20 Punkte und selbst der reine Bösewicht (−7 %) liegt noch knapp darüber; verlieren kann der
Bösewicht dort über das Thema (Abschnitt 3). Bei neutralen Fans zählt nur die Kante.

- **Thema** (−1 bis +1) aus Abschnitt 3: Rasse ±1, Klasse ±0,5, je Trait ±0,5 (Traits zusammen höchstens ±1).
- **Farbe** (−1 bis +1): (Fanfarbe der Klassenfarbe − 5) ÷ 5. Die Fanfarbe driftet (Abschnitt 3.2).

### 2.4 Beispiele aus dem Pool

Gerechnet mit der Startfarbe der Fans. Werbegeld in C je Saison, Liga 1; die Aufteilung zwischen Team und Spieler steht in 4.2.
Die Tabelle erklärt die Formel an Spielern aus dem Pool; die Seite Marketing selbst zeigt nur den eigenen Kader.

| Spieler | Rasse · Klasse | Rating | Gehalt | Reichweite | Ton · Kante | Hell Raisers | Werbegeld | Golden Gladiators | Werbegeld |
|---|---|---:|---:|---:|---|---:|---|---:|---|
| Mauler | Demon · Templar | 68 | 20,5 | 80 | −1,00 · 0,94 | ×1,40 = **100** | 10,0 C | ×0,78 = **62** | 2,1 C |
| Aurelia Rosethorn | Divine · Hero | 67 | 17,1 | 84 | +1,00 · 1,00 | ×0,68 = **57** | 1,5 C | ×1,40 = **100** | 10,0 C |
| Zephiroth | Dragon · Warlord | 63 | 17,1 | 85 | −0,03 · 1,00 | ×1,28 = 100 | 10,0 C | ×1,05 = 89 | 7,2 C |
| Com Shepard | Human · Hero | 56 | 12,1 | 80 | +1,00 · 1,00 | ×0,83 = 67 | 2,7 C | ×1,40 = 100 | 10,0 C |
| Luxariel | Demon · Bard | 36 | 6,6 | 67 | −1,00 · 1,00 | ×1,40 = **93** | 8,2 C | ×0,81 = 54 | 1,2 C |
| King Arthur | Human · Templar | 76 | 18,0 | 44 | +0,55 · 0,09 | ×0,80 = 35 | 0,1 C | ×1,17 = 52 | 1,0 C |
| Jasper Kane | Alien · Warlord | 71 | 14,0 | 43 | +0,57 · 0,10 | ×0,81 = 35 | 0,1 C | ×0,97 = 42 | 0,3 C |

King Arthur hat das höchste Rating im Pool und bringt fast nichts: Er ist die brave Mitte. Zephiroth verkauft bei beiden
Teams, weil er Kante hat, ohne auf einer Seite zu stehen. Gegenüber Runde 1 fällt Mauler bei Golden Gladiators weniger tief
(62 statt 53): Ein Schurke ist auch dort Werbung, nur keine gute.

## 3. Fanprofil je Team

| Teil | Quelle | Wirkung |
|---|---|---|
| **Ton** (−1 bis +1) | (`manners` − 5,5) ÷ 4,5 | Richtung der Ton-Passung. Stammdatum, driftet nicht |
| **Mögen, meiden** | je Team eine Liste aus echten Rassen, Klassen und Traits (3.1) | Thema, bis ±15 % |
| **Farbe** | Start aus den vier Farbgewichten (Summe 20), danach Drift je Saison (3.2) | Farbe, bis ±5 % |
| **Größe** | `popularity` und die Beliebtheit aus `team-beliebtheit.ts` | Start der Fanbasis (Finanzpapier g.2), nicht Teil der Passung |

**Schlechte `manners` heißen nicht schlechtes Marketing.** Der Ton der Fans dreht nur die Richtung. Über die Referenzkader
gerechnet stehen die sieben einträglichsten Teams alle auf der Bösewicht-Seite (Abschnitt 4.4), weil ihre Kader mehr Kante
haben.

### 3.1 Die 32 Fanprofile: nur Rassen, Klassen, Traits

In Runde 1 standen hier Themen-Tags aus `THEME_TARGETS` („Hell“, „Infernal“, „Devil“, „Succubus“, „Holy“, „Angel“,
„Paladin“, „Undead“). Die gibt es im Spiel nicht als Rasse oder Klasse. Jetzt steht in jeder Zelle **Rassen · Klassen ·
Traits**, alle aus dem Code. Themen ohne eigene Rasse sind über Klasse und Traits ausgedrückt: Untote (Last Ride, Lost
Kingdom) über Mage, `ColdBlooded` und `Cruel`; Piraten über Rogue, `Gambler` und `Cheater`; Ninjas über Sprinter, Rogue und
`Devious`. Das Geschlecht (Death Peaches, Nunchuck Ninjas, Vicious & Delicious) bleibt Sache der KI-Kaderplanung und ist
keine Fan-Vorliebe. Armageddon Aftermath hat kein Thema im Code; der Vorschlag kommt aus Referenzkader und Farbe (SPE 18).

| Team | manners | Ton | Zielgruppe | Fans mögen (Rassen · Klassen · Traits) | Fans meiden (Rassen · Klassen · Traits) |
|---|---:|---:|---|---|---|
| Cold Steel | 10 | +1,00 | Ehrenfans | Human, Elf · Hero, Templar, Sprinter · Fair, Disciplined, Loyal | Orc · Berserker · Cheater, Cruel, Devious |
| Golden Gladiators | 9 | +0,78 | Heldenfans | Divine, Human · Hero, Templar · Fair, Altruistic, Caring, FanFavorite | Demon · – · Cruel, Cheater, Scandalous |
| Black Panthers | 8,5 | +0,67 | Kennerpublikum | Human, Alien · Rogue, Hero · Ambitious, Disciplined, Cool | – · – · Lazy, FaintHearted |
| The Chantry | 8,5 | +0,67 | Gemeinde | Divine, Human · Bard, Templar · Caring, Altruistic, Fair, Loyal | Demon · Berserker · Cruel, Scandalous, Vindictive |
| Natures Wrath | 8 | +0,56 | Naturfreunde | Plant, Animal, Elf · Tank, Mage · Caring, Loyal, Healthy | Construct, Demon · – · Cruel, Mercenary |
| Wrecking Legionnaires | 8 | +0,56 | Veteranen | Construct, Orc, Human · Warlord, Berserker, Tank · Mercenary, Disciplined, Diligent | – · – · FaintHearted, Lazy |
| Mortal Sin | 7,5 | +0,44 | Familienpublikum | Divine, Human · Bard, Hero · Caring, Loyal, Relaxed, FanFavorite, Altruistic | – · Berserker · Diva, Devious, Egomaniac |
| Silver Soldiers | 7,5 | +0,44 | Technikfans | Construct · Warlord, Tactician · Disciplined, Diligent, ColdBlooded | Plant, Animal · – · Lazy, Feisty |
| Vigilante Wranglers | 7 | +0,33 | Stadtviertel | Human, Elf · Hero, Templar, Badass · Fearless, Fair, Altruistic, Cool | Demon · – · FaintHearted, Cruel, Cheater |
| Cash Creators | 6,5 | +0,22 | Geschäftsleute | Human, Goblin · Bard, Tactician · Eloquent, Mercenary, Resourceful | – · Berserker · Lazy |
| Undercover Agents | 6,5 | +0,22 | Stille Kenner | Human, Construct · Sprinter, Rogue, Overseer, Tactician · Disciplined, Cool, ColdBlooded, Resourceful | – · Berserker, Bard · Scandalous, Diva, Feisty |
| Death Peaches | 6 | +0,11 | Szene | Demon, Voidborn · Bard, Rogue · Sexy, Manipulative, Diva | Divine, Construct · Tank · Timid |
| Royal Court | 6 | +0,11 | Hofgesellschaft | Human, Elf, Dwarf · Hero, Templar, Bard · Eloquent, Loyal, Fair | Demon, Goblin · – · Renegade, Scandalous |
| Riptide Rivers | 5,5 | +0,00 | Küstenvolk | Aqua, Lizard, Alien · Sprinter, Overseer · Relaxed, Flexible, Cool | Construct · – · Obsessive |
| Terrible Teachers | 5,5 | +0,00 | Schülerschaft | Human, Elf · Mage, Tactician · Diligent, Motivated, Ambitious, Caring | – · – · Lazy, Diva |
| Vicious & Delicious | 4,5 | −0,22 | Amazonen-Anhang | Elf, Human, Animal · Sprinter, Warlord · Fearless, Feisty, Sexy | Construct · Tank · Timid, Lazy |
| Project Suicide | 4 | −0,33 | Außenseiter | Human, Mutant · Mage, Tank · Obsessive, Paranoid, Diligent, Loyal | – · Bard · Diva, FaintHearted, Lazy |
| The Giants | 4 | −0,33 | Schaulustige | Tauren, Dragon, Orc · Tank, Berserker, Charger · Fearless, Healthy | Gnom, Dwarf, Goblin · Rogue · Timid, FaintHearted |
| Blazing Beasts | 3 | −0,56 | Rudel | Animal, Tauren, Dragon · Berserker, Charger · Feisty, FiredUp | Construct · Tactician · Timid |
| Wicked Wizards | 3 | −0,56 | Zirkel | Demon, Elf, Voidborn · Mage, Tactician, Overseer · Obsessive, Manipulative, Ambitious | Animal, Tauren · Berserker · Lazy |
| Last Ride | 2,5 | −0,67 | Totenkult | Human, Demon · Mage, Tank · ColdBlooded, Fearless, Cruel | Divine · Bard · FaintHearted, Caring |
| Mayhem Mavericks | 2,5 | −0,67 | Ultras | Orc, Tauren · Berserker, Rogue, Warlord · Ambitious, Fearless, Egomaniac, Mercenary | – · Bard · Lazy, Timid, FaintHearted |
| Stronghold Crusaders | 2,5 | −0,67 | Eiferer | Human · Templar, Warlord, Tank · Fearless, Obsessive, Cruel, Disciplined | – · Bard · FaintHearted, Relaxed, Caring |
| Lost Kingdom | 1,5 | −0,89 | Gefallener Adel | Human, Voidborn · Mage, Templar, Warlord · ColdBlooded, Vindictive, Diva | Divine · – · Caring, Altruistic |
| Pirate Crew | 1,5 | −0,89 | Hafenkneipe | Human, Aqua, Dwarf · Rogue, Badass · Gambler, Cheater, Renegade, Mercenary | – · Templar · Fair, Disciplined, Timid |
| Raging Lunatics | 1,5 | −0,89 | Chaoten | Animal, Plant, Tauren · Charger, Berserker · Feisty, FiredUp, Renegade | Construct · Tactician · Disciplined, Fair, Timid |
| Vigorous Vikings | 1,5 | −0,89 | Raubzug | Human, Dwarf · Berserker, Warlord · Fearless, FiredUp, Feisty, Loyal | – · Bard, Tactician · Timid, FaintHearted |
| Armageddon Aftermath | 1 | −1,00 | Endzeit | Mutant, Voidborn · Sprinter, Rogue · Renegade, Fearless | Divine · Templar · Timid, Disciplined |
| Dire Legion | 1 | −1,00 | Hardliner | Human · Warlord, Tank, Tactician · Disciplined, Loyal, ColdBlooded | Elf, Dwarf, Orc, Goblin, Demon, Animal, Construct, Alien · – · Renegade, Lazy |
| Hell Raisers | 1 | −1,00 | Bösewicht-Fans | Demon · Berserker, Warlord · Cruel, Scandalous, Renegade, FiredUp | Divine · Hero · Fair, Altruistic, Caring, Timid |
| Nunchuck Ninjas | 1 | −1,00 | Schattenfans | Human, Elf · Sprinter, Rogue, Overseer · Devious, ColdBlooded, Disciplined | Tauren · Tank · Fair, Caring |
| Zero Heroes | 1 | −1,00 | Zocker | Lizard, Dragon · Charger, Badass · Gambler, Ambitious, Fearless | – · – · FaintHearted, Timid, Relaxed |

Geprüft per Skript: Jeder Eintrag ist eine der 18 Rassen, 13 Klassen oder 36 Traits, und kein Trait steht bei einem Team auf
beiden Seiten.

**Vorlieben können wachsen.** Ist derselbe Spieler zwei Saisons in Folge das Aushängeschild, kommt seine Klasse auf die
Liste „mögen“ (höchstens ein Zugang je Team; ein neuer verdrängt den alten). Im Mockup mögen die Hell-Raisers-Fans seit
Saison 3 auch Mage, wegen Vixen. Rassen und Traits wachsen nicht nach, die Liste „meiden“ ändert sich nie.

### 3.2 Die Farbe der Fans driftet

Die Vorliebe für POW, SPE, MEN und SOC ist nicht fest. Start ist das Farbgewicht des Teams. Bei jedem Saisonwechsel:

    Ziel = 20 × (½ × Kader-Anteil + ½ × Erfolgs-Anteil)
    Fanfarbe neu = Fanfarbe alt + Schritt × (Ziel − Fanfarbe alt)

- **Kader-Anteil** je Farbe: Anteil der Einsätze der Saison nach Klassenfarbe der eingesetzten Spieler.
- **Erfolgs-Anteil** je Farbe: Anteil der Ergebnispunkte des Teams nach Disziplinfarbe.
- **Schritt:** 10 %, wenn das Saisonziel verfehlt wurde (die Fans folgen nur dem Kader); 15 % bei erreichtem Saisonziel;
  20 % bei Titel, Aufstieg oder Farb-Meister. Das ist derselbe Rahmen wie bei der Team-Identität (10 bis 20 %).
- **Anker:** keine Farbe entfernt sich mehr als 6 Punkte vom Startwert. Die Summe bleibt 20.
- **Wirkung:** über das Farb-Glied der Passung (±5 %). Wer drei Saisons Mages einsetzt und mit ihnen gewinnt, bekommt Fans,
  bei denen ein Mage mehr wert ist als am Anfang.
- **KI, Mehrspieler:** läuft für alle 32 Teams gleich im Saisonwechsel, vier Zahlen je Team und Saison im Spielstand, keine
  Entscheidung. Jeder Manager sieht den Verlauf jedes Teams.

Beispiel des Mockups (Hell Raisers, Start 7 · 8 · 5 · 0):

| Saisonwechsel | Ziel (POW · SPE · MEN · SOC) | Schritt | Fanfarbe danach |
|---|---|---:|---|
| Start | – | – | 7,0 · 8,0 · 5,0 · 0,0 |
| nach Saison 1 | 6 · 6 · 8 · 0 | 15 % (Saisonziel erreicht) | 6,9 · 7,7 · 5,5 · 0,0 |
| nach Saison 2 | 4 · 5 · 11 · 0 | 20 % (Farb-Meister MEN) | 6,3 · 7,2 · 6,6 · 0,0 |
| nach Saison 3 | 5 · 7 · 8 · 0 | 10 % (Ziel verfehlt) | 6,2 · 7,1 · 6,7 · 0,0 |

Die Bewegung ist mit Absicht langsam: MEN steigt in drei Saisons von 5,0 auf 6,7. Ein Fanprofil kippt nicht in einer Saison.

## 4. Geld: Werbegeld, geteilt zwischen Team und Spieler

Marketing wirkt **nur auf Geld und Moral**, nie auf die Wertung, und es berührt weder den Sponsor noch den Marktwert.

### 4.1 Werbegeld je Spieler

    Werbegeld je Saison = Höchstwert × ((Marketability − 30) ÷ 70)²        Höchstwert: Liga 1 10 C, Liga 2 7,5 C

Unter Marketability 30 gibt es nichts. Die Kurve ist bewusst gekrümmt: 50 bringt 0,8 C, 70 bringt 3,3 C, 85 bringt 6,2 C,
100 bringt 10 C. Gebucht wird je Spieltag ein Zwanzigstel mit der Marketability dieses Spieltags, so wirkt ein Schub sofort.
Nur Spieler im Kader zählen, Verletzte zur Hälfte.

Über den Pool bei einem neutralen Team (Passung 1,0):

| Rating | Spieler | Gehalt (Median) | Werbegeld Median | bestes Zehntel | Anteil über 1 C |
|---|---:|---:|---:|---:|---:|
| unter 35 | 826 | 4,1 C | **0,0 C** | 0,3 C | 1 % |
| 35 bis 45 | 993 | 6,7 C | 0,15 C | 1,5 C | 16 % |
| 45 bis 55 | 723 | 9,5 C | 0,9 C | 2,6 C | 46 % |
| 55 bis 65 | 333 | 13,2 C | 1,7 C | 4,0 C | 73 % |
| ab 65 | 109 | 18,1 C | 2,2 C | 4,5 C | 88 % |

Schwache Spieler bringen also fast nichts. Die Ausnahme ist Persönlichkeit: Luxariel (Rating 36) kommt bei Hell Raisers auf
8,2 C, weil seine Traits und die Fans passen.

### 4.2 Die Teilung: dynamischer Team-Anteil (Runde 3)

Runde 2 teilte fest: die Hälfte ans Team, höchstens 15 % des Gehalts. Das war eine Zahl ohne Geschichte. Jetzt hat jeder
Spieler einen eigenen **Team-Anteil** in Prozent seines Werbegelds, und der bewegt sich.

    Team-Anteil = 40 % + Persönlichkeit + Werbeklausel + Vertragslaufzeit + Moral + Aushängeschild + Teamerfolg
                  begrenzt auf 15 bis 65 %
    ans Team    = Team-Anteil × Werbegeld, höchstens 25 % des Saisongehalts (Sicherheitsnetz)
    an ihn      = Werbegeld − ans Team

| Baustein | Punkte | Regel |
|---|---:|---|
| **Persönlichkeit** (Traits) | −20 bis +20 | gibt ab: `Loyal` +8, `Altruistic` +8, `Caring` +5, `Fair` +4, `Timid` +3 · will mehr für sich: `Egomaniac` −10, `Diva` −8, `Mercenary` −8, `Ambitious` −4, `Manipulative` −4, `Renegade` −4, `Gambler` −3. Summe begrenzt auf ±20 |
| **Werbeklausel** (Verhandlung) | −10 · 0 · +10 | Teil jedes Vertrags und jeder Verlängerung, drei Stufen. „Spieler behält mehr“: −10 Punkte, dafür verlangt er 4 % weniger Gehalt. „Standard“: 0. „Team bekommt mehr“: +10 Punkte, dafür 4 % mehr Gehalt. `Egomaniac` und `Diva` lehnen „Team bekommt mehr“ ab, `Loyal` nimmt sie ohne Aufschlag |
| **Vertragslaufzeit** | −5 · 0 · +5 | letzte Vertragssaison −5 (er hält sich alles offen), noch zwei Saisons 0, drei und mehr +5 |
| **Moral** | −5 bis +5 | (Moral − 60) ÷ 4, gerundet. Wer zufrieden ist, wirbt für den Verein |
| **Aushängeschild** | +8 | nur das Gesicht der Saison: der Verein führt seine Kampagne |
| **Teamerfolg** | −3 · +3 · +6 | Vorsaison: Saisonziel verfehlt −3, erreicht +3, Titel, Aufstieg oder Farb-Meister +6. Gilt für alle Spieler des Teams. In Saison 1: 0 |

Beispiele aus dem Mockup (Hell Raisers, Saisonziel verfehlt; Moral, Laufzeit und Klausel sind dort Beispielwerte):

| Spieler | Werbegeld | Rechnung | Team-Anteil | ans Team | an ihn |
|---|---:|---|---:|---:|---:|
| Bloodseeker (Gesicht) | 11,4 C | 40 + 8 Gesicht − 3 Erfolg | 45 % | 3,3 C (Netz: 25 % von 13,4 C Gehalt) | 8,0 C, Moral +8 |
| Mazzikin (`Loyal`, Vertrag drei Saisons, Moral 74) | 8,5 C | 40 + 8 + 5 + 4 − 3 | 54 % | 2,9 C (Netz) | 5,6 C, Moral +8 |
| Vixen (`Diva`, letzte Vertragssaison, Klausel für sie) | 6,9 C | 40 − 8 − 5 − 10 − 1 − 3 = 13, Untergrenze | 15 % | 1,0 C | 5,9 C, Moral +8 |
| Rocky (`Renegade`, letzte Saison, Moral 48) | 3,7 C | 40 − 4 − 5 − 3 − 3 | 25 % | 0,9 C | 2,8 C, Moral +4 |
| Kadis bei Golden Gladiators (`Loyal`, `Caring`, Gesicht, Farb-Meister) | 3,1 C | 40 + 13 + 5 + 5 + 8 + 6 = 77, Obergrenze | 65 % | 2,0 C | 1,1 C, Moral +2 |

**Warum es trotzdem ein Sicherheitsnetz gibt.** Chris' Regel aus Runde 2 gilt weiter: Kein Spieler soll sein Gehalt faktisch
selbst bezahlen. Ohne Netz brächte ein billiger Spieler mit großer Persönlichkeit und hohem Anteil dem Team bis zu 60 % seines
Gehalts zurück. Das Netz ist kein fester Satz mehr, sondern eine Grenze, die selten greift: in den Referenzkadern bei 7 von
261 Spielern (der alte 15-%-Deckel griff bei 42). Was darüber liegt, geht an den Spieler. Üblich sind 5 bis 15 % des Gehalts.

**Was der Manager damit tun kann:** die Klausel verhandeln (Gehalt jetzt gegen Marketing später), Verträge früh verlängern (+5
statt −5), die Moral halten und das Aushängeschild so wählen, dass die +8 Punkte auf viel Werbegeld treffen. Einen `Egomaniac`
kauft man für die Reichweite, nicht für die Kasse: Sein Werbegeld geht zu drei Vierteln an ihn, aber es hält ihn bei Laune.

**Moral aus dem Spieler-Anteil** (je Saison, wirkt als fester Zuschlag, solange er im Kader ist):

| Spieler-Anteil | ab 0,5 C | ab 1,5 C | ab 3 C | ab 5 C |
|---|---:|---:|---:|---:|
| Moral | +2 | +4 | +6 | +8 |

- `Diva`, `Egomaniac`, `Mercenary` und `Ambitious` zählen den Zuschlag anderthalbfach, `Altruistic` und `Timid` halb.
- **Kein Kreis:** Die Moral im Team-Anteil ist die Moral **ohne** den Werbe-Zuschlag, sonst zöge sich der Wert selbst hoch.
- **Vertrag:** Bei einer Verlängerung verlangt der Spieler je vollen 5 % seines Gehalts, die er hier an Werbung verdient, 1 %
  weniger, höchstens 5 %. Ein Wechsel zu einem Team mit schlechterer Passung kostet ihn Werbegeld; die KI des abgebenden
  Spielers rechnet das als Grund zu bleiben. Der Marktwert bleibt exakt und unverändert.
- **Neid:** keiner. Der Zuschlag hängt nur am eigenen Anteil.
- **KI:** wählt die Klausel nach Finanzwert des Teams (ab 7 „Team bekommt mehr“, unter 4 „Spieler behält mehr“, sonst
  Standard) und für delegierte Verträge genauso.

### 4.3 Teammarke und Aushängeschild

- **Teammarke (Sockel):** 4,0 C (Liga 1) bzw. 3,0 C (Liga 2) × Stimmung × Fan-Shop. Das ist der bisherige Merch-Posten des
  Finanzkonzepts V2 ohne Starfaktor; den Star-Teil übernimmt jetzt das Werbegeld.
- **Aushängeschild:** Einmal je Saison wählt der Manager eines unter seinen sechs besten Spielern. Sein Werbegeld steigt um
  25 % und sein Team-Anteil um 8 Punkte (4.2). Wird er in der Saison verkauft, fällt die Stimmung um 8 Punkte;
  fällt er verletzt aus, ruht der Zuschlag. Das bleibt die einzige Entscheidung des Systems.

### 4.4 Größenordnung und GuV

Neu gerechnet mit dem dynamischen Anteil über die Referenzkader (261 Spieler, 32 Teams, im Mittel 8 Spieler je Team). In
dieser Rechnung zählt nur die Persönlichkeit; Klausel, Laufzeit, Moral und Erfolg stehen auf neutral, weil es dafür noch keine
Daten gibt. Liga-1-Sätze für Budget-Rang 1 bis 16, Liga-2-Sätze für 17 bis 32.

| | Runde 2 (Hälfte, Deckel 15 %) | Runde 3 (dynamisch, Netz 25 %) |
|---|---:|---:|
| Werbegeld aller Spieler | 336 C | 336 C |
| Team-Anteile in den Kassen | 135 C | 122 C |
| mittlerer Team-Anteil | 40 % (nach Deckel) | 39 % |
| Deckel oder Netz greift bei | 42 Spielern | 7 Spielern |
| an die Spieler (Moral) | rund 200 C | rund 215 C |
| Teammarke (Sockel 4,0 · 3,0 C) | 112 C | 112 C |
| **Marketing in den Kassen** | 247 C, 7,7 C je Team | **234 C, 7,3 C je Team** |
| Liga 1 · Liga 2 je Team | – | 8,4 · 6,2 C |
| kleinstes · mittleres · größtes Team | 4,1 · 8,1 · 13,8 C | 4,1 · 6,5 · 16,9 C |

Die Summe bleibt fast gleich, die Verteilung wird breiter: Hell Raisers kommen auf 16,9 C (viele Anecker mit hohem Werbegeld
und Bösewicht-Fans), Golden Gladiators auf 7,6 C, Teams ohne Kante auf 4 C. Mit vollen Kadern (im Spiel rund 12 statt 8
Spieler) liegt alles etwas höher. Das ganze Bild aus Einnahmen und Ausgaben je Saison, mit Marketing als einer Zeile, steht
im Finanzpapier (`docs/design/finanzen-posten-22-11.md`, Abschnitt i). Dort steht auch der Vorschlag, den Sockel der Teammarke
in Liga 2 von 3,0 auf 4,0 C zu heben. Stellschraube für die Messung bleibt der Höchstwert (10 · 7,5 C).

### 4.5 Tickets und Sponsor

- **Star-Debüt:** Das erste Heimspiel eines Neuzugangs mit Marketability ab 75 ist ein Zuschauer-Ereignis ×1,3 (Finanzpapier
  g.3).
- **Fanbasis:** Solange ein Spieler mit Marketability ab 85 eingesetzt wird, wächst die Fanbasis bei vollem Haus um 2,5 statt
  2 % je Heimspiel.
- **Skandal:** Bei Teams mit Ton über +0,3 ein Fan-Boykott (Stehplatz ×0,5 für zwei Heimspiele), bei Teams mit Ton unter
  −0,5 ein volles Haus (×1,2). Der Spieler selbst bekommt in beiden Fällen den Schub (+6 Reichweite).
- **Sponsor:** Keine Zahlung ändert sich. Es bleibt beim zusätzlichen Sonderziel „Gesicht der Marke“ (ein Spieler mit
  Marketability ab 80 bleibt die ganze Saison und steht in mindestens 15 Spieltagen im Einsatz).

## 5. KI, Mehrspieler, Anzeige

**KI-Regel** (für KI-Teams und delegierte Bereiche gleich):

- Beim Kauf rechnet die KI den **Team-Anteil** über die Vertragsjahre auf ihre Zahlungsbereitschaft, **höchstens +8 %**. Cash
  Creators rechnen das Doppelte (bis +16 %). Weil der Team-Anteil bei 25 % des Gehalts endet, kann die Rechnung nie einen
  Kauf allein tragen.
- Beim Verkauf verlangt sie für ihr Aushängeschild 10 % mehr.
- Das Aushängeschild ist der Spieler mit der höchsten Marketability unter den besten sechs.
- Die Kaderstärke (beste 6) und die Einsatzliste bleiben unberührt: Die KI stellt nie nach Marketability auf.

**Mehrspieler:**

- Das Fanprofil gehört zum Team und ist für alle gleich sichtbar, samt Verlauf der Farbe. Die Marketability eines Spielers
  ist je Team verschieden; jeder Manager sieht die Zahl für **sein** aktives Team (`activeManagerTeamId`).
- Das Aushängeschild liegt je Team im Spielstand, geschrieben über `authorizeServerRoomWrite`, delegierbar im Bereich
  Sponsor. Ohne Wahl gilt die KI-Regel; kein Spieltag wartet.
- **Scouting-Nebel:** Traits und Rating ungescouteter Spieler sind verdeckt, also auch die Marketability (5.1).

**Was gezeigt wird:**

| Ort | Anzeige |
|---|---|
| Spielerprofil | Marketability für das eigene Team, Herleitung (Reichweite, Kante, Ton, Thema, Farbe), Werbegeld, Team-Anteil mit seinen Gründen, Spieler-Anteil und Moral |
| Transfermarkt | eigene Spalte **Marketability** mit Scouting-Nebel (5.1); Hinweis „passt zu deinen Fans“ erst ab „gescoutet“ |
| Kader | Seite Marketing (Mockup): **nur der eigene Kader**, je Spieler die Zerlegung warum |
| Finanzen | Posten „Marketing“: Teammarke und Team-Anteile je Spieler, je Spieltag gebucht |
| Moral | Zeile „Werbeverträge +n“ in der Herleitung der Moral des Spielers |
| Fremde Teams | Fanprofil und Verlauf immer sichtbar, Marketability ihrer Spieler nach Scouting-Stand |

### 5.1 Marketability als Stat im Transfermarkt (Runde 3)

Gebaut wird das später zusammen mit dem Transfermarkt (`docs/design/transfermarkt-modern-18-11.md`); hier steht nur die Regel.

- **Eine Spalte „Marketability“** neben den anderen Stats, sortierbar wie jede Spalte. Die Zahl gilt für **das eigene Team**
  (`activeManagerTeamId`), denn sie hängt am Fanprofil: Derselbe Spieler hat für Hell Raisers und Golden Gladiators
  verschiedene Werte.
- **Nebel in den festen Stufen des Scoutings**, wie bei jedem verdeckten Wert:

| Scouting-Stand | Anzeige | Beispiel (wahrer Wert 88) |
|---|---|---|
| unbekannt | 10er-Stufe | 80–89 |
| beobachtet | 5er-Stufe | 85–89 |
| gescoutet | exakt | 88 |

- Nie „~88“ um den wahren Wert, nie eine Farbe oder ein Balken, der genauer ist als die Stufe.
- **Sortieren und Filtern nach der Stufe, Gleichstand nach Name.** Zwei Spieler in derselben 10er-Stufe stehen alphabetisch,
  nicht nach dem wahren Wert.
- Werbegeld und Team-Anteil in C erscheinen im Transfermarkt erst ab „gescoutet“, weil sie Traits und Gehalt verraten würden.
  Davor steht nur die Stufe.
- Der **Marktwert bleibt immer exakt** und hängt nicht an der Marketability.
- Der Schalter „Fog of War aus“ zeigt überall die exakte Zahl.
- Eigene Spieler sind immer exakt; darum braucht die Seite Marketing keinen Nebel.

## 6. Was am Bestand anzupassen wäre

- `COSMETIC_TRAIT_POPULARITY_WEIGHTS` (`lib/traits/cosmetic-trait-soft-effects.ts:71`) behandelt `Scandalous` für jedes Team
  als Abzug. Mit dem Fanprofil hängt das Vorzeichen am Team.
- Der Sub-Score „Fan-Lieblinge“ der Beliebtheit (`team-beliebtheit.ts:37`) zählt nur `FanFavorite`. Er kann durch die
  mittlere Marketability der drei besten ersetzt werden; die Gewichte bleiben.
- Neu im Spielstand: je Team die Fanfarbe (vier Zahlen je Saison) und der mögliche Klassen-Zugang; je Spieler der laufende
  Schub. Eignungsmatrix, Wertung und Marktwert werden nicht angefasst.

## 7. Das Mockup (Runde 2)

`public/mockups/marketing-22-11.html`, Stil und Bausteine des Finanz-Mockups, reine CSS/SVG-Gestaltung, kein PixelLab.

- **Kopf:** Umschalter Hell Raisers und Golden Gladiators mit „C ans Team“; darunter Team- und Spieler-Summe.
- **Tabelle:** wie in Runde 1, neu sind die Spalten **ans Team** (mit Hinweis auf den Deckel oder den Anteil am Gehalt) und
  **an ihn** (mit Moral). Auf der Ton-Achse zeigt die Größe des Punkts die Kante; kleine graue Punkte sind die Langweiler.
- **Karten:** „Wohin das Werbegeld geht“ (Kader gesamt, Spieler, Team, Teammarke, Summe in der Kasse), „Aushängeschild“,
  „Ton: Kante schlägt Mitte“ (obere Linie = volle Kante, untere = so wenig Kante wie möglich, Punkte = Kader).
- **Kontext rechts, drei Reiter:** **Fanprofil** (Ton, mögen und meiden je Rasse, Klasse, Trait, Farbe der Fans mit
  Veränderung zum Start), **Spieler** (Herleitung bis zum Team-Anteil in % des Gehalts), **Verlauf** (Farbe der Fans je
  Saison, Prognose aus dem heutigen Kader, Regel, neue Vorliebe).

| Mockup-Feature aus Chris' Rückmeldung | Stand |
|---|---|
| Mögen und meiden nur aus echten Rassen, Klassen, Traits | drin (Reiter Fanprofil; alle 32 Teams in Abschnitt 3.1) |
| Farbe der Fans verschiebt sich über Saisons | drin (Reiter Verlauf, Pfeile im Fanprofil) |
| Mitte ist langweilig, edgy wirbt besser | drin (Formel, Karte „Kante schlägt Mitte“, Punktgröße) |
| Einnahmen geteilt, Spieler-Anteil hebt die Moral | drin (Spalten, Karte, Reiter Spieler) |
| Schwache bringen nichts, außer Aktionen oder Persönlichkeit | Persönlichkeit drin (Luxariel), Aktionen nur als Zeile „Schub“ und im Konzept; das Mockup rechnet keinen Schub |

Ehrlich gekennzeichnet: Spieler, Traits, Rasse, Klasse, Gesinnung, Rating, Gehaltsforderung, Kaderzuordnung, Portraits,
Wappen, `manners`, `popularity` und die Startfarben sind echt. Formeln und Gewichte sind der Vorschlag und werden im Skript
live gerechnet. **Erfunden** sind der Verlauf der Fanfarbe über vier Saisons, der Erfolgs-Anteil und der Klassen-Zugang
„Mage“. Vereinfacht: kein Schub, Liga-1-Sätze für beide Teams, Stimmung und Fan-Shop der Teammarke fest 1,0.

| Datei (`docs/design/marketing-22-11/`) | Zeigt |
|---|---|
| `runde2-hell-raisers-fanprofil-1920x1080.png` | Hell Raisers, Reiter Fanprofil: echte Rassen, Klassen, Traits; Farbe mit Drift |
| `runde2-hell-raisers-verlauf-2560x1440.png` | Reiter Verlauf: Farbe der Fans Saison 1 bis 4 und Prognose |
| `runde2-hell-raisers-mauler-1920x1080.png` | Reiter Spieler, Mauler: 100, Werbegeld 10 C, 3,1 C ans Team (15 % vom Gehalt) |
| `runde2-golden-gladiators-mauler-1710x1112.png` | derselbe Mauler bei Golden Gladiators: 62 |
| `runde2-golden-gladiators-fanprofil-2560x1440.png` | Golden Gladiators, Zephiroth gewählt |
| `runde2-phone-412x900.png` | Nebenprobe Phone |

Die Aufnahmen ohne `runde2-` zeigen den Stand von Runde 1. Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine
JS-Fehler, kein Seitenscroll und kein inneres Scrollen bei 2560×1440, 1920×1080 und 1710×1112, kein abgeschnittener Text. Bei
1080 und 1112 px Höhe entfällt der erklärende Fußtext der drei Karten.

## 7a. Das Mockup, Runde 3

Geändert gegenüber Runde 2 (Abschnitt 7 beschreibt den alten Stand):

- **Nur der eigene Kader.** Die Gruppe „Auf dem Markt“ und die sieben Pool-Spieler sind entfernt, ebenso die Spalten Stärke
  und Ton-Achse. Dafür sind die Zeilen höher und füllen die Tafel.
- **Warum, in drei Schritten je Zeile:** **Reichweite** als gestapelter Balken (Leistung, Ausstrahlung aus den Traits, Typ)
  mit den drei Zahlen darunter · **Passung** als Faktor mit den vier Beiträgen Kante, Ton, Thema, Farbe in Prozentpunkten
  (grün hebt, rot senkt) · **Team-Anteil** als Balken mit Prozent und den zwei stärksten Gründen („Klausel −10 · Diva −8“).
- Neue Spalte **Werbegeld**; „ans Team“ zeigt darunter den Anteil am Gehalt oder „Netz: 25 % vom Gehalt“. Summenzeile für
  den Kader. Alle Spalten sortierbar.
- **Reiter Spieler** rechts: dieselben drei Fragen ausführlich („Warum fällt er auf?“, „Warum passt er zu deinen Fans?“, „Wie
  viel davon bekommt das Team?“) mit jedem Trait und jedem Baustein des Team-Anteils.
- **Karte „Team-Anteil: dynamisch“** ersetzt die Ton-Karte: die sechs Bausteine mit Spanne und der Teamerfolg dieser Saison.
  Die Karten „Wohin das Werbegeld geht“ und „Aushängeschild“ zeigen den neuen Anteil.

| Mockup-Feature aus Chris' Rückmeldung (Runde 3) | Stand |
|---|---|
| Nur eigene Spieler, keine Leute vom Transfermarkt | drin |
| Wie und warum sich jeder Spieler auswirkt | drin (Zerlegung je Zeile, Reiter Spieler) |
| Marketability als eigener, vernebelter Stat im Transfermarkt | Konzept (5.1), gebaut mit dem Transfermarkt; im Mockup nur der Hinweis im Fuß |
| Team-Anteil dynamisch statt fix | drin (Formel, Spalte, Karte, Reiter Spieler) |

Ehrlich gekennzeichnet: **Moral, Restlaufzeit und Werbeklausel je Spieler sind Beispielwerte** des Mockups, ebenso der
Teamerfolg der Vorsaison. Die Karte „Ton: Kante schlägt Mitte“ aus Runde 2 ist entfallen; die Regel gilt weiter und steht je
Spieler in den Beiträgen Kante und Ton.

| Datei (`docs/design/marketing-22-11/`) | Zeigt |
|---|---|
| `runde3-hell-raisers-kader-vixen-1920x1080.png` | Hell Raisers, Vixen gewählt: Team-Anteil 15 % (`Diva`, Klausel, letzte Vertragssaison) |
| `runde3-hell-raisers-kader-bloodseeker-2560x1440.png` | Aushängeschild Bloodseeker, Sicherheitsnetz greift |
| `runde3-golden-gladiators-team-anteil-1920x1080.png` | Golden Gladiators, nach Team-Anteil sortiert, Kadis 65 % |
| `runde3-hell-raisers-fanprofil-1710x1112.png` | MacBook-Format, Reiter Fanprofil |
| `runde3-phone-412x900.png` | Nebenprobe Phone |

Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine JS-Fehler, kein Seitenscroll und kein inneres Scrollen bei
2560×1440, 1920×1080 und 1710×1112 in allen drei Reitern. Die Aufnahmen `runde2-…` zeigen den alten Stand.

## 8. Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Sicherheitsnetz bei 25 % des Gehalts (greift bei 7 von 261 Spielern), oder ganz ohne Netz? | **Mit Netz.** Ohne bringt ein billiger Spieler mit großer Persönlichkeit bis zu 60 % seines Gehalts zurück. |
| 2 | Werbeklausel als dritte Zahl in jeder Vertragsverhandlung (drei Stufen), oder erst später mit einem Verhandlungs-Baustein? | **Gleich, als drei Stufen.** Sie ist die einzige Stelle, an der der Manager den Anteil selbst bewegt. |
| 3 | Sollen neben der Farbe auch Vorlieben wachsen (Klasse des Aushängeschilds nach zwei Saisons)? | **Ja, klein halten:** ein Zugang je Team, nur Klassen. |

## Runde 4: Werbeklausel und Aushängeschild (Mockup 23.11.)

Mockup: `public/mockups/marketing-werbeklausel-aushaengeschild-23-11.html` (klickbar, gleiche Tokens und Bausteine wie `marketing-22-11.html`, Kopf-Reiter
schalten die vier Ansichten). Spielernamen, Traits und Gehaltsforderungen sind echt; **Marketability, Moral, Restlaufzeit, aktuelle Klausel, Teamerfolg,
Vorjahres-Gesicht und Ramonas Team sind Beispielwerte** und im Mockup so gekennzeichnet. Alle Zahlen rechnen live nach den Formeln aus 4.2 und 4.3.
Gehalt und Werbegeld stehen groß je Saison, klein je Spieltag (20 Spieltage).

| Ansicht | Zeigt |
|---|---|
| Verhandlung | Transfer-Angebot mit Gehalt, Laufzeit und neu der Werbeklausel. Drei Zeilen (−10 / 0 / +10 Punkte) nebeneinander mit Gehalt, Team-Anteil, Werbegeld ans Team, an ihn, **Saldo gegen Standard** und Reaktion; darunter die Summen über die Laufzeit, rechts die Zerlegung des Team-Anteils mit hervorgehobener Klausel-Zeile. Spieler zum Umschalten: Flora (neutral), Pooka (`Loyal`: ohne Aufschlag), Nira (`Diva`: Stufe grau, „lehnt ab“), Indicus (`Egomaniac`) |
| Vertrag | Verlängerungsdialog über dem Kader: Laufzeit (+1 bis +3), Klausel, Vergleich Bisher / Neu / Änderung, Werbe-Rabatt aufs Gehalt, Reaktion und Zerlegung; rechts ein Regelblatt |
| Marketing-Seite | Die sechs besten Spieler mit Marketability, Werbegeld und Team-Anteil jetzt und als Gesicht (+25 %, +8 Punkte), Änderung ans Team und Moral, Marken KI-WAHL und VORSAISON, Netz- und Grenz-Hinweise; Bestätigen sperrt die Zeile und die Wahl bis Saisonende; Kachel „Vorlieben wachsen“ (Zähler 1 von 2 / 2 von 2) |
| Mehrspieler | Dieselbe Seite aus Sicht von Chris (Sponsor selbst) und Ramona (Sponsor an die KI): die KI-Wahl gilt, bis der Mensch überschreibt („Mensch überschreibt, KI respektiert das“), fremde Teams nur lesbar, Tabelle „wer sieht, wer wählt“ |

Aufnahmen (1920×1080, 2560×1440, 1710×1112, je Ansicht) liegen unter `docs/design/marketing-werbeklausel-23-11/`; geprüft ohne Seitenscroll und ohne inneres Scrollen.

**Was die Zahlen im Mockup zeigen (und was im Konzept nachzuziehen ist):**

- „Team bekommt mehr“ lohnt sich selten. Die +10 Punkte bringen 10 % des Werbegelds, das 4 % Mehrgehalt kostet 4 % des Gehalts; erst ab Werbegeld über 40 % des Gehalts steht ein Plus da, und bei hohem Werbegeld greift schon das Sicherheitsnetz. Flora: +10 Punkte −0,28 C je Saison, „Spieler behält mehr“ +0,28 C. Für schwache Werber ist „Spieler behält mehr“ fast immer die bessere Wahl.
- Das Netz entwertet auch das Aushängeschild: Bloodseeker (die KI-Wahl) bringt dem Team trotz +2,3 C Werbegeld +0,00 C, weil das Netz schon steht; Vixen (+0,77 C) oder Rocky (+0,61 C) bringen mehr. Bei Kadis stößt der Team-Anteil an die 65 %, die +8 wirken nicht.

### Offene Fragen an Chris

| # | Frage | Empfehlung |
|---|---|---|
| 1 | Soll die Klausel ihre Rechnung ehrlicher machen: Gehaltsverschiebung kleiner und das Netz wandert mit (z. B. ±2,5 % Gehalt, Netz 22 / 25 / 28 % je Stufe)? | **Ja.** Sonst ist „Team bekommt mehr“ fast nie, „Spieler behält mehr“ fast immer richtig. Das Mockup zeigt noch die Regel aus 4.2 (4 %, Netz 25 %). |
| 2 | Aushängeschild: KI-Wahl nach Marketability (Konzept) oder nach dem höchsten Zusatzertrag fürs Team? | **Nach Zusatzertrag**, denn die höchste Marketability trifft oft das Netz. Für den Menschen zeigt die Tabelle den Ertrag schon. |
| 3 | Sperre des Aushängeschilds: sofort mit „Bestätigen“, oder erst mit dem ersten Spieltag (davor änderbar)? Delegierte Teams: KI-Wahl gilt bis zum Überschreiben. | **Sofort beim Bestätigen**, bei Delegation bis zum ersten Spieltag überschreibbar, ohne Wahl gilt die KI-Regel. |
| 4 | „Vorlieben wachsen“: ersetzt der neue Zugang einen früheren (ein Zugang je Team gleichzeitig) oder kommt er dazu? | **Ersetzt**, so bleibt das Fanprofil klein. |
| 5 | Wer darf in Ramonas Team (Sponsor an die KI) überschreiben, nur sie oder auch Chris als Mitspieler? | **Nur der Manager des Teams** (Schreibprüfung am Team), andere Menschen lesen nur. |
| 6 | Bereich Sponsor als eigener Delegationsbereich für die Klausel in Verhandlungen, oder zählt die Klausel zu „Käufe/Verträge“? | **Zu Käufe/Verträge**, das Aushängeschild bleibt im Bereich Sponsor. |

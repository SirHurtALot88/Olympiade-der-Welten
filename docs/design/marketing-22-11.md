# Marketing: Marketability je Spieler, Fanprofil je Team (22.11., Runde 2)

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
- **Das Werbegeld wird geteilt** (neu): Je Spieler entsteht Werbegeld von 0 bis 10 C je Saison. Die Hälfte geht ans Team,
  **höchstens 15 % seines Gehalts**; der Rest sind seine eigenen Werbeverträge, sie stehen nicht in der Kasse und **heben
  seine Moral**. Kein Spieler bezahlt sein Gehalt selbst.
- Größenordnung: ein Team bekommt 4 bis 14 C je Saison (Mittel rund 8 C), die Spieler zusammen noch einmal rund 200 C in
  der Liga. Schwache Spieler ohne Profil bringen 0. **Sponsor und Marktwert bleiben unverändert.**

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

Gerechnet mit der Startfarbe der Fans. Werbegeld und Anteile in C je Saison, Liga 1.

| Spieler | Rasse · Klasse | Rating | Gehalt | Reichweite | Ton · Kante | Hell Raisers | Werbegeld → Team · ihn | Golden Gladiators | Werbegeld → Team · ihn |
|---|---|---:|---:|---:|---|---:|---|---:|---|
| Mauler | Demon · Templar | 68 | 20,5 | 80 | −1,00 · 0,94 | ×1,40 = **100** | 10,0 → 3,1 · 6,9 | ×0,78 = **62** | 2,1 → 1,1 · 1,1 |
| Aurelia Rosethorn | Divine · Hero | 67 | 17,1 | 84 | +1,00 · 1,00 | ×0,68 = **57** | 1,5 → 0,7 · 0,7 | ×1,40 = **100** | 10,0 → 2,6 · 7,4 |
| Zephiroth | Dragon · Warlord | 63 | 17,1 | 85 | −0,03 · 1,00 | ×1,28 = 100 | 10,0 → 2,6 · 7,4 | ×1,05 = 89 | 7,2 → 2,6 · 4,6 |
| Com Shepard | Human · Hero | 56 | 12,1 | 80 | +1,00 · 1,00 | ×0,83 = 67 | 2,7 → 1,4 · 1,4 | ×1,40 = 100 | 10,0 → 1,8 · 8,2 |
| Luxariel | Demon · Bard | 36 | 6,6 | 67 | −1,00 · 1,00 | ×1,40 = **93** | 8,2 → 1,5 · 6,7 | ×0,81 = 54 | 1,2 → 0,6 · 0,6 |
| King Arthur | Human · Templar | 76 | 18,0 | 44 | +0,55 · 0,09 | ×0,80 = 35 | 0,1 → 0,0 · 0,0 | ×1,17 = 52 | 1,0 → 0,5 · 0,5 |
| Jasper Kane | Alien · Warlord | 71 | 14,0 | 43 | +0,57 · 0,10 | ×0,81 = 35 | 0,1 → 0,0 · 0,0 | ×0,97 = 42 | 0,3 → 0,1 · 0,1 |

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

### 4.2 Die Teilung

| | Regel | Wirkung |
|---|---|---|
| **Team-Anteil** | die Hälfte des Werbegelds, **höchstens 15 % des Saisongehalts** des Spielers (bei Gehältern unter 10 C höchstens 1,5 C, Liga 2 1,1 C) | Einnahme der Kasse, Posten „Marketing“ |
| **Spieler-Anteil** | der Rest | eigene Werbeverträge. **Nicht in der Kasse.** Hebt die Moral |

**Der Deckel ist die Antwort auf „der Spieler bezahlt sein Gehalt selbst“.** Über alle Spieler mit Gehalt ab 12 C gerechnet,
selbst bei bester Passung, liegt der höchste Team-Anteil bei genau 15 % des Gehalts. In den Referenzkadern greift der Deckel
bei 42 von 261 Spielern. Was über dem Deckel liegt, geht nicht verloren, sondern an den Spieler.

**Moral aus dem Spieler-Anteil** (je Saison, wirkt als fester Zuschlag, solange er im Kader ist):

| Spieler-Anteil | ab 0,5 C | ab 1,5 C | ab 3 C | ab 5 C |
|---|---:|---:|---:|---:|
| Moral | +2 | +4 | +6 | +8 |

- `Diva`, `Egomaniac`, `Mercenary` und `Ambitious` zählen den Zuschlag anderthalbfach, `Altruistic` und `Timid` halb.
- **Vertrag:** Bei einer Verlängerung verlangt der Spieler je vollen 5 % seines Gehalts, die er hier an Werbung verdient, 1 %
  weniger, höchstens 5 %. Ein Wechsel zu einem Team mit schlechterer Passung kostet ihn Werbegeld; die KI des abgebenden
  Spielers rechnet das als Grund zu bleiben. Der Marktwert bleibt exakt und unverändert.
- **Neid:** keiner. Der Zuschlag hängt nur am eigenen Anteil.

### 4.3 Teammarke und Aushängeschild

- **Teammarke (Sockel):** 4,0 C (Liga 1) bzw. 3,0 C (Liga 2) × Stimmung × Fan-Shop. Das ist der bisherige Merch-Posten des
  Finanzkonzepts V2 ohne Starfaktor; den Star-Teil übernimmt jetzt das Werbegeld.
- **Aushängeschild:** Einmal je Saison wählt der Manager eines unter seinen sechs besten Spielern. Sein Werbegeld steigt um
  25 % (der Deckel gilt weiter, das Mehr geht meist an ihn). Wird er in der Saison verkauft, fällt die Stimmung um 8 Punkte;
  fällt er verletzt aus, ruht der Zuschlag. Das bleibt die einzige Entscheidung des Systems.

### 4.4 Größenordnung und GuV

Gerechnet über die Referenzkader (im Mittel 8 Spieler und 63 C Gehalt je Team; die Gehaltssumme entspricht den gemessenen
57 C je Team aus dem Spiel). Je Team: Sockel + Team-Anteile, Liga-1-Sätze.

| | Marketing in der Kasse je Saison | an die Spieler |
|---|---:|---:|
| Hell Raisers, Zero Heroes (beste Werbekader) | 13,8 C | 26 C, 17 C |
| Wicked Wizards, Raging Lunatics, Lost Kingdom, Pirate Crew, Dire Legion | 11 bis 12,5 C | 12 bis 18 C |
| Median der 32 Teams | 8,1 C | rund 5 C |
| Golden Gladiators | 7,8 C | 3,8 C |
| Cash Creators, Riptide Rivers, Wrecking Legionnaires (blasse Kader) | 5 bis 6 C | 1 bis 3 C |
| Terrible Teachers (nur Talente, keine Kante) | 4,1 C | 0,1 C |

Mit vollen Kadern und Stars über Rating 60, die in den Referenzkadern fehlen, reicht die Spitze bis rund 20 C.

| Liga-Summe je Saison | Betrag | Anmerkung |
|---|---:|---|
| Teammarke (Sockel), 16 × 4,0 + 16 × 3,0 C | 112 C | nahe am Merch-Plan von V2 (118 C) |
| Team-Anteile am Werbegeld, 16 Teams Liga-1-Satz, 16 Liga-2-Satz | rund 135 C | 149 C, wenn alle Liga 1 wären; 121 C bei Liga 2 |
| **Marketing in den Kassen** | **rund 247 C** | 7,7 C je Team; mit Schub und Aushängeschild 260 bis 280 C |
| Spieler-Anteile (nicht in der GuV) | rund 205 C | Moral statt Kasse |
| Mehr gegenüber dem V2-Plan (118 C Merch) | **+130 bis +160 C** | +6 bis +7 % der heutigen Liga-Einnahmen (2.182 C) |

**Wer fängt das Mehr auf?** Dieselben Posten wie bei den Tickets (Finanzpapier g.2): Ausrüstung und Verpflegung kosten 320
bis 800 C je Saison in der Liga. Tickets (294 bis 575 C netto) und Marketing (+130 bis +160 C) zusammen liegen in dieser
Spanne. Der Sponsor bleibt unverändert; sein Anteil an den Einnahmen eines Top-Teams der Liga 1 sinkt durch 14 C Marketing von
73 % auf rund 66 %. Stellschraube für die Messung ist der Höchstwert (10 · 7,5 C): Er skaliert Team- und Spieler-Anteil
zusammen, der Deckel hält die Regel „höchstens 15 % des Gehalts“ in jedem Fall.

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
  Creators rechnen das Doppelte (bis +16 %). Weil der Team-Anteil bei 15 % des Gehalts endet, kann die Rechnung nie einen
  Kauf allein tragen.
- Beim Verkauf verlangt sie für ihr Aushängeschild 10 % mehr.
- Das Aushängeschild ist der Spieler mit der höchsten Marketability unter den besten sechs.
- Die Kaderstärke (beste 6) und die Einsatzliste bleiben unberührt: Die KI stellt nie nach Marketability auf.

**Mehrspieler:**

- Das Fanprofil gehört zum Team und ist für alle gleich sichtbar, samt Verlauf der Farbe. Die Marketability eines Spielers
  ist je Team verschieden; jeder Manager sieht die Zahl für **sein** aktives Team (`activeManagerTeamId`).
- Das Aushängeschild liegt je Team im Spielstand, geschrieben über `authorizeServerRoomWrite`, delegierbar im Bereich
  Sponsor. Ohne Wahl gilt die KI-Regel; kein Spieltag wartet.
- **Scouting-Nebel:** Traits und Rating ungescouteter Spieler sind verdeckt, also auch Marketability und Werbegeld.
  Ungescoutet zeigt die App fünf feste Stufen, beobachtet 10er-Schritte, gescoutet die Zahl. Sortieren nach Stufe,
  Gleichstand nach Name. Der Schalter „Fog of War aus“ zeigt alles.

**Was gezeigt wird:**

| Ort | Anzeige |
|---|---|
| Spielerprofil | Marketability für das eigene Team, Herleitung (Reichweite, Kante, Richtung, Thema, Farbe), Werbegeld mit Team-Anteil, Spieler-Anteil und Moral |
| Transfermarkt | Spalte Marketability, Spalte „ans Team“ in C; Hinweis „passt zu deinen Fans“ ab Passung 1,15 |
| Kader | Seite Marketing (Mockup) |
| Finanzen | Posten „Marketing“: Teammarke und Team-Anteile je Spieler, je Spieltag gebucht |
| Moral | Zeile „Werbeverträge +n“ in der Herleitung der Moral des Spielers |
| Fremde Teams | Fanprofil und Verlauf immer sichtbar, Marketability ihrer Spieler nach Scouting-Stand |

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

## 8. Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Deckel für den Team-Anteil: 15 % des Gehalts mit der Untergrenze 1,5 C für billige Spieler, oder streng 15 % für alle? | **Mit Untergrenze.** Sonst bringt eine billige Persönlichkeit wie Luxariel dem Team höchstens 1,0 C, und „Persönlichkeit zahlt sich aus“ gilt nur für den Spieler. Schon mit Untergrenze 1,0 statt 1,5 C sind es in der Liga 8 C weniger. |
| 2 | Höchstwert 10 C (Liga 1) je Spieler, also 4 bis 14 C je Team, im Mittel 8 C: genug, oder soll mehr in die Kassen? | **So messen.** Mehr geht nur über den Sockel oder einen höheren Deckel; ein höherer Höchstwert landet wegen des Deckels fast ganz bei den Spielern. |
| 3 | Sollen neben der Farbe auch Vorlieben wachsen (Klasse des Aushängeschilds nach zwei Saisons)? | **Ja, klein halten:** ein Zugang je Team, nur Klassen. |

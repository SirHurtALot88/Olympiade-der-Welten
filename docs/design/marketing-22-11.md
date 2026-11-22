# Marketing: Marketability je Spieler, Fanprofil je Team (22.11.)

Chris, 22.11., wörtlich: „Was ist mit marketing? können wir ne marketing score für die spieler generieren basieren auf ihrer
marketability? die sich aus traits etc zusammensetzt? wichtig ist nicht nur 'gute' stats heißen direkt gute marketability
sondern auch leute die anecken können gut dafür sein je nachdem, und ggf haben Hell Raisers ne andere Fan Zielgruppe als die
Golden Gladiators kannst du da mal was vorbereiten“

Konzept und Mockup, kein App-Code. Mockup: `public/mockups/marketing-22-11.html` (`?team=H-R|G-G`, `&sel=<spieler>`,
`&so=<spalte>`). Alle Gewichte sind Startwerte für einen Messlauf. Die Beispielzahlen sind mit der Formel unten über den
echten Spielerpool gerechnet (`data/generated/oly-player-stats.json`, 2.984 Spieler).

## Kurzfassung

- Jeder Spieler hat eine **Reichweite** (0 bis 100): wie viel Aufmerksamkeit er bekommt, egal wo er spielt. Sie kommt zu
  höchstens 30 Punkten aus der Leistung, zu bis zu 46 aus den Traits und zu bis zu 14 aus Klasse und Rasse.
- Jeder Spieler hat einen **Ton** von −1 (Bösewicht) bis +1 (Liebling). Anecker haben hohe Reichweite und negativen Ton.
- Jedes Team hat ein **Fanprofil**: einen Ton (aus dem Teamwert `manners`), Themen, die die Fans mögen oder meiden, und eine
  Farbe. Die **Passung** von Spieler und Fans ist ein Faktor von 0,6 bis 1,4.
- **Marketability bei einem Team = Reichweite × Passung.** Derselbe Spieler ist bei Hell Raisers etwas anderes wert als bei
  Golden Gladiators: Mauler (Dämon, `Scandalous`, `Egomaniac`) kommt bei Hell Raisers auf 100, bei Golden Gladiators auf 53.
  Aurelia Rosethorn (Divine, `FanFavorite`) genau umgekehrt: 50 und 100.
- Stärke allein reicht nicht: King Arthur hat das höchste Rating im Pool (76) und eine Reichweite von 44. Luxariel hat
  Rating 36 und Reichweite 67, bei Hell Raisers 93.
- Wirkung nur auf Geld: Merch (2 bis 9 C je Team und Saison), ein Zuschauer-Ereignis beim Debüt, ein Sponsor-Sonderziel.
  **Der Sponsor und der Marktwert bleiben unverändert.** Die Liga-Summe des Merch bleibt gleich, Marketing verteilt nur um.

---

## 1. Was es im Code schon gibt

| Baustein | Stelle | Nutzen hier |
|---|---|---|
| 18 positive und 18 negative Traits | `lib/training/class-progression-config.ts:234` bis `:274` (`CANONICAL_POSITIVE_TRAITS`, `CANONICAL_NEGATIVE_TRAITS`) | Quelle der Ausstrahlung und des Tons |
| Felder je Spieler | `lib/data/olyDataTypes.ts:683` bis `:688` (`race`, `className`, `subclasses`, `traitsPositive`, `traitsNegative`), `:1156` (`alignment`), `:1157` (`gender`) | Typ, Ton, Thema |
| Beliebtheit je Team (0,5 bis 1,5) | `lib/economy/team-beliebtheit.ts:37` (Gewichte Erfolg 0,5, Fan-Lieblinge 0,3, Starpower 0,2), `:57` (`FanFavorite`) | bleibt die Größe der Fanbasis; Marketing ersetzt sie nicht |
| Kleine Trait-Wirkung auf die Beliebtheit | `lib/traits/cosmetic-trait-soft-effects.ts:71` (`Eloquent` +0,03, `Scandalous` −0,03) | zeigt die alte Sicht „Skandal ist schlecht“; mit dem Fanprofil hängt das am Team (Abschnitt 6) |
| Teamwerte `manners`, `popularity`, `harmony`, Farbgewichte | `data/source/team-identities.json` (Typ `lib/data/olyDataTypes.ts:760`) | Ton und Farbe des Fanprofils |
| Themen je Team | `THEME_TARGETS` in `lib/ai/team-theme-composition-service.ts:173` (Hell Raisers `:202`, Golden Gladiators `:235`), Stufe je Spieler `themeTier` (`:139`) | Themenpassung |
| Klassenfarbe | `CLASS_COLOR_MAP`, `lib/lineups/legacy-lineup-modifiers.ts:31` | Farbpassung, Anzeige |
| Rivalitäten | `lib/rivalries/team-rivalries.ts:109` | Derby, Fan-Boykott (Finanzpapier g.3) |
| Sponsor-Sonderziel mit Fan-Liebling | `lib/sponsor/sponsor-objective-evaluator.ts:382` | Vorbild für das Sonderziel „Gesicht der Marke“ |

Im Pool gibt es keinen Trait „Showman“ oder „Arrogant“. Die Anecker heißen im Code `Scandalous` (354 Spieler), `Diva` (219),
`Egomaniac` (245), `Renegade` (281), `Feisty` (516), `Cruel` (153), `Gambler` (140), `Cheater` (127).

## 2. Marketability je Spieler

### 2.1 Reichweite (0 bis 100), für alle Teams gleich

    Reichweite = Leistung + Ausstrahlung + Typ + Ruhm

| Teil | Bereich | Rechnung |
|---|---:|---|
| **Leistung** | 0 bis 30 | 0,30 × Perzentil. Vor der ersten Saison das Perzentil des Ratings im Pool, danach zur Hälfte das Perzentil der PP der letzten Saison in der eigenen Liga |
| **Ausstrahlung** | 0 bis 46 | 10 + 1,2 × Summe der Reichweiten-Punkte der Traits, begrenzt auf 0 bis 46 |
| **Typ** | 0 bis 14 | Klasse + Rasse (Tabelle unten), höchstens 14 |
| **Ruhm** | 0 bis 10 | +2 je Goldmedaille der letzten Saison, +3 für MVP oder Top 3 der PP-Bestenliste, +1 je Saison im selben Verein mit `Loyal`; verfällt je Saison zur Hälfte |

Die Leistung zählt mit Absicht nur zu 30 Punkten. Über den Pool gerechnet hängt die Reichweite mit dem Rating zu 0,74
zusammen (ohne Ruhm): gute Spieler sind öfter bekannt, aber nicht automatisch. Von den 100 Spielern mit der höchsten
Reichweite tragen 94 mindestens einen Anecker-Trait; die 100 stärksten Spieler des Pools haben im Mittel nur 64.

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

Der Punkt, auf den es Chris ankommt, steht in der mittleren Spalte: **Ein Skandal bringt fast so viel Reichweite wie der
Status als Fan-Liebling.** Ob daraus Geld wird, entscheidet die Passung zum Team.

**Typ.** Klasse: Bard, Hero, Badass +8 · Warlord +5 · Berserker +4 · Mage, Rogue, Sprinter +3 · Templar, Charger +2 · Tank +1 ·
Tactician, Overseer 0. Rasse (Seltenheit im Pool): Dragon +6 · Voidborn +5 · Divine +4 · Demon, Alien, Mutant +3 · Tauren,
Aqua, Lizard +2 · alle anderen 0.

### 2.2 Ton des Spielers (−1 bis +1)

    Ton = Summe(Ton des Traits × max(Reichweite des Traits, 1)) ÷ 12 + Gesinnung, begrenzt auf −1 bis +1

Gesinnung aus `alignment`: endet auf `-G` (gut) +0,4, endet auf `-B` (böse) −0,4, sonst 0.

### 2.3 Beispiele aus dem Pool

| Spieler | Rasse · Klasse | Rating | Traits | Reichweite | Ton | bei Hell Raisers | bei Golden Gladiators |
|---|---|---:|---|---:|---:|---:|---:|
| Mauler | Demon · Templar | 68 | Eloquent, Ambitious, Fearless, Egomaniac, Scandalous, Obsessive | 80 | −1,00 | ×1,40 = **100** | ×0,66 = **53** |
| Aurelia Rosethorn | Divine · Hero | 67 | Eloquent, FanFavorite, Diva | 84 | +1,00 | ×0,60 = **50** | ×1,34 = **100** |
| Zephiroth | Dragon · Warlord | 63 | Ambitious, FanFavorite, Healthy, Feisty, Scandalous | 86 | −0,03 | ×1,01 = 86 | ×1,00 = 85 |
| Com Shepard | Human · Hero | 56 | Eloquent, FanFavorite, Loyal, Devious, Renegade | 80 | +1,00 | ×0,75 = 60 | ×1,19 = 96 |
| Luxariel | Demon · Bard | 36 | Sexy, Eloquent, Egomaniac, Scandalous, Renegade | 67 | −1,00 | ×1,40 = **93** | ×0,66 = 44 |
| King Arthur | Human · Templar | 76 | Loyal, Ambitious, FaintHearted | 44 | +0,55 | ×0,86 = 38 | ×1,11 = 49 |
| Jasper Kane | Alien · Warlord | 71 | Loyal, Relaxed, Timid | 43 | +0,57 | ×0,86 = 37 | ×1,11 = 48 |

Die Referenzkader (`data/generated/oly-rosters.json`): Hell Raisers haben mit Mazzikin (92), Bloodseeker (86) und Vixen (86)
drei starke Verkäufer, obwohl keiner über Rating 54 liegt. Golden Gladiators kommen mit Kadis (68), Auza (60) und Zhyrak (59)
deutlich niedriger heraus; ihr Kader ist brav, aber farblos.

## 3. Fanprofil je Team

Jedes Team hat ein Fanprofil aus vier Teilen. Es ist Stammdatum, nicht wählbar, und für alle Manager gleich sichtbar.

| Teil | Quelle | Wirkung |
|---|---|---|
| **Ton** (−1 bis +1) | (`manners` − 5,5) ÷ 4,5 aus `data/source/team-identities.json` | Ton-Passung |
| **Themen** (mögen, meiden) | `primaryThemeTags`, `secondaryThemeTags`, `avoidTags` aus `THEME_TARGETS` | Themenpassung über das vorhandene `themeTier` |
| **Farbe** | die vier Farbgewichte des Teams (Summe 20) | Farbpassung über die Klassenfarbe |
| **Größe** | `popularity` und die Beliebtheit aus `team-beliebtheit.ts` | Start der Fanbasis (Finanzpapier g.2), nicht Teil der Passung |

    Passung = 1 + 0,25 × Ton Spieler × Ton Team + 0,15 × Thema + 0,05 × Farbe, begrenzt auf 0,6 bis 1,4

- **Thema:** `core_theme` +1 · `secondary_theme` +0,6 · `soft_theme` +0,3 · `outsider` 0 · `avoid` −1.
- **Farbe:** (Farbgewicht der Klassenfarbe − 5) ÷ 5, begrenzt auf −1 bis +1. Im Mockup ist dieser kleine Term weggelassen.
- Ein Team mit Ton nahe 0 (Royal Court +0,11) nimmt jeden; dort zählt fast nur die Reichweite.

**Die 32 Fanprofile** (Ton gerechnet, Zielgruppe als Vorschlag aus Thema und Teamwerten):

| Team | manners | Ton | Zielgruppe | Fans mögen (Thema) |
|---|---:|---:|---|---|
| Cold Steel | 10 | +1,00 | Ehrenfans | Schwertkämpfer, Ritter, faire Duellanten |
| Golden Gladiators | 9 | +0,78 | Heldenfans | Divine, Engel, Paladine |
| Black Panthers | 8,5 | +0,67 | Kennerpublikum | Elite, Stars, Effizienz |
| The Chantry | 8,5 | +0,67 | Gemeinde | Glaube, Heiler, Kleriker |
| Natures Wrath | 8 | +0,56 | Naturfreunde | Pflanzen, Tiere, Waldhüter |
| Wrecking Legionnaires | 8 | +0,56 | Veteranen | Söldner, Soldaten |
| Mortal Sin | 7,5 | +0,44 | Familienpublikum | Harmonie, Spaß, Entertainer |
| Silver Soldiers | 7,5 | +0,44 | Technikfans | Constructs, Roboter |
| Vigilante Wranglers | 7 | +0,33 | Stadtviertel | maskierte Helden, Beschützer |
| Cash Creators | 6,5 | +0,22 | Geschäftsleute | Händler, Botschafter, Charisma |
| Undercover Agents | 6,5 | +0,22 | Stille Kenner | Agenten, Tarnung (meiden laute Typen) |
| Death Peaches | 6 | +0,11 | Szene | weibliche Dark-Fantasy-Figuren, Verführung |
| Royal Court | 6 | +0,11 | Hofgesellschaft | Adel, Ritter, Hof |
| Riptide Rivers | 5,5 | 0,00 | Küstenvolk | Fisch, Aqua, Aliens |
| Terrible Teachers | 5,5 | 0,00 | Schülerschaft | Lehrer, Mentoren, Talente |
| Vicious & Delicious | 4,5 | −0,22 | Amazonen-Anhang | Amazonen, Jägerinnen |
| Project Suicide | 4 | −0,33 | Außenseiter | Melancholie, Durchhalter |
| The Giants | 4 | −0,33 | Schaulustige | Riesen, Kolosse, Drachen |
| Blazing Beasts | 3 | −0,56 | Rudel | Bestien, Monster |
| Wicked Wizards | 3 | −0,56 | Zirkel | Magier, Okkultes |
| Last Ride | 2,5 | −0,67 | Totenkult | Untote, Sensenmänner |
| Mayhem Mavericks | 2,5 | −0,67 | Ultras | Champions, Killer, Berserker |
| Stronghold Crusaders | 2,5 | −0,67 | Eiferer | brutale Kreuzritter, Wille |
| Lost Kingdom | 1,5 | −0,89 | Gefallener Adel | Untote, dunkler Adel |
| Pirate Crew | 1,5 | −0,89 | Hafenkneipe | Piraten, Schwindler |
| Raging Lunatics | 1,5 | −0,89 | Chaoten | Werwölfe, Wilde |
| Vigorous Vikings | 1,5 | −0,89 | Raubzug | Wikinger, Berserker |
| Armageddon Aftermath | 1 | −1,00 | Endzeit | kein Thema im Code (`THEME_TARGETS` hat keinen Eintrag) |
| Dire Legion | 1 | −1,00 | Hardliner | nur Menschen, Legionäre |
| Hell Raisers | 1 | −1,00 | Bösewicht-Fans | Dämonen, Hölle |
| Nunchuck Ninjas | 1 | −1,00 | Schattenfans | Ninjas, Assassinen, Hinterlist |
| Zero Heroes | 1 | −1,00 | Zocker | Risiko, Pakte, Echsen |

Hell Raisers und Golden Gladiators liegen an den zwei Enden: Ton −1,00 gegen +0,78, Dämonen gegen Divine, und jedes der
beiden meidet genau das Thema des anderen (`avoidTags`).

## 4. Wirkung in C je Saison

Marketing wirkt **nur auf Geld**, nie auf die Wertung, und es berührt weder den Sponsor noch den Marktwert.

### 4.1 Merch (Hauptwirkung)

Das Finanzkonzept V2 plant Merch als Basis × Stimmung × Starfaktor × Fan-Shop (Stufe 5, Liga-Summe 118 C). Der
**Starfaktor wird durch die Zugkraft ersetzt:**

    Zugkraft = (M1 + 0,6 × M2 + 0,4 × M3) ÷ 100, geteilt durch das Liga-Mittel der Zugkraft

M1 bis M3 sind die drei höchsten Marketability-Werte unter den eingesetzten Spielern des Teams. Weil durch das Liga-Mittel
geteilt wird, ist die **Liga-Summe des Merch dieselbe wie ohne Marketing**. Es wird umverteilt, kein Geld gedruckt.

| | Zugkraft (Liga-Mittel rund 1,2) | Merch Liga 1 (Basis 6,0 C) | Merch Liga 2 (Basis 4,0 C) |
|---|---:|---:|---:|
| Drei Zugpferde (95 · 85 · 75) | 1,76 → 1,47 | 8,8 C | 5,9 C |
| Durchschnitt (65 · 55 · 50) | 1,18 → 0,98 | 5,9 C | 3,9 C |
| Farbloser Kader (45 · 40 · 35) | 0,83 → 0,69 | 4,1 C | 2,8 C |

Ein einzelner Spieler bewegt als bester Verkäufer bis zu **±1,8 C je Saison** in Liga 1 (Marketability 95 statt 60), als
zweiter 60 %, als dritter 40 % davon. Das ist ein Viertel eines Spielergehalts: genug für eine Kaufentscheidung zwischen
zwei gleich starken Spielern, zu wenig, um einen schwachen Spieler nur für die Trikots zu holen. Die Basis von 6,0 / 4,0 C
(V2: 4,4 / 3,0 C) ist ein Vorschlag, damit die Spanne spürbar ist; die 44 C mehr in der Liga gehören in dieselbe Rechnung
wie die Tickets (Finanzpapier g.2).

Im Mockup: Hell Raisers 8,9 C, Golden Gladiators 6,4 C, gerechnet mit Liga-1-Basis und Liga-Mittel 1,2.

### 4.2 Werbewert neben dem Marktwert

Je Spieler zeigt die App einen **Werbewert in C je Saison** für das eigene Team: Basis × Marketability ÷ 100 ÷ Liga-Mittel,
also was er als bester Verkäufer brächte. **Der Marktwert bleibt exakt und unverändert** (Regel: Marktwert ist immer exakt
sichtbar, er eicht die Ablösen). Der Werbewert steht daneben und ist je Team verschieden; damit sieht man auf dem
Transfermarkt, dass derselbe Spieler dem einen Team mehr bringt als dem anderen.

### 4.3 Tickets

- **Star-Debüt:** Das erste Heimspiel eines Neuzugangs mit Marketability ab 75 ist ein Zuschauer-Ereignis ×1,3
  (Finanzpapier g.3).
- **Fanbasis:** Solange ein Spieler mit Marketability ab 85 eingesetzt wird, wächst die Fanbasis bei vollem Haus um 2,5 statt
  2 % je Heimspiel.
- **Skandal:** Ein Sponsor-Ereignis „Reibung“ durch einen `Scandalous`-Spieler löst bei Teams mit Ton über +0,3 einen
  Fan-Boykott aus (Stehplatz ×0,5 für zwei Heimspiele), bei Teams mit Ton unter −0,5 ein volles Haus (×1,2).

### 4.4 Sponsor: bleibt, wie er ist

Keine Sponsor-Zahlung ändert sich. Marketing schaltet nur ein zusätzliches **Sonderziel** im vorhandenen Sonderziel-Platz
frei („Gesicht der Marke“: ein Spieler mit Marketability ab 80 bleibt die ganze Saison im Kader und steht in mindestens 15
Spieltagen im Einsatz). Es konkurriert mit den anderen Sonderzielen um denselben Platz und dieselbe Prämie (0 bis rund 3 C).

### 4.5 Aushängeschild

Einmal je Saison wählt der Manager ein **Aushängeschild** unter seinen sechs besten Spielern. Sein Werbewert steigt um 25 %.
Wird er in der Saison verkauft, fällt die Stimmung um 8 Punkte; fällt er verletzt aus, ruht der Zuschlag. Das ist die
einzige Entscheidung des ganzen Systems.

### 4.6 Größenordnung und Kalibrierung

| Wirkung | je Team und Saison | Liga-Summe | Gegenposten |
|---|---:|---:|---|
| Merch nach Zugkraft | 2,8 bis 8,8 C statt einheitlich 3,9 / 5,9 C | 0 (geeicht auf das Liga-Mittel) | Umverteilung zwischen den Teams |
| Aushängeschild | +0,6 bis +1,2 C | rund +28 C | in der Eichung der Zugkraft mitgerechnet, dann 0 |
| Star-Debüt | +0,1 bis +0,5 C je Debüt | rund +5 C | Teil der Ereignisse (Finanzpapier g.3) |
| Sonderziel „Gesicht“ | wie jedes Sonderziel | 0 | ersetzt ein anderes Sonderziel |

Die Kalibrierung des Finanzkonzepts kippt nicht, weil keine Summe wächst außer der bewusst höheren Merch-Basis. Der
Wertungs-Fingerabdruck bleibt unberührt.

## 5. KI, Mehrspieler, Anzeige

**KI-Regel** (für KI-Teams und delegierte Bereiche gleich):

- Beim Kauf rechnet die KI den Werbewert für ihr Team über die Vertragsjahre auf ihre Zahlungsbereitschaft, **höchstens +8 %**
  und nur, wenn der Spieler unter ihre drei besten Verkäufer käme. Cash Creators rechnen das Doppelte (bis +16 %), passend zu
  ihrem Archetyp (`lib/ai/golden-master/team-identity-overrides.ts`).
- Beim Verkauf verlangt sie für ihr Aushängeschild 10 % mehr.
- Das Aushängeschild ist der Spieler mit der höchsten Marketability unter den besten sechs.
- Die Kaderstärke (beste 6) und die Einsatzliste bleiben unberührt: Die KI stellt nie nach Marketability auf.

**Mehrspieler:**

- Das Fanprofil gehört zum Team und ist für alle gleich. Die Marketability eines Spielers ist je Team verschieden; jeder
  Manager sieht die Zahl für **sein** aktives Team (`activeManagerTeamId`), auf Wunsch die eines anderen Teams daneben.
- Das Aushängeschild liegt je Team im Spielstand, geschrieben über `authorizeServerRoomWrite`, delegierbar im Bereich
  Sponsor. Ohne Wahl gilt die KI-Regel; kein Spieltag wartet.
- **Scouting-Nebel:** Traits und Rating ungescouteter Spieler sind verdeckt, also auch die Marketability. Ungescoutet zeigt
  die App fünf feste Stufen (unbekannt, klein, mittel, groß, Zugpferd), beobachtet 10er-Schritte, gescoutet die Zahl.
  Sortieren nach Stufe, Gleichstand nach Name. Der Schalter „Fog of War aus“ zeigt alles.

**Was gezeigt wird:**

| Ort | Anzeige |
|---|---|
| Spielerprofil | Marketability für das eigene Team (groß), Reichweite und Passung darunter, Ton auf der Achse mit dem Fanprofil, die Herleitung je Trait, Werbewert in C je Saison |
| Transfermarkt | Spalte Marketability (für das eigene Team), sortierbar und filterbar; Werbewert klein unter dem Marktwert; Hinweis „passt zu deinen Fans“ ab Passung 1,15 |
| Kader | Seite Marketing (Mockup): Tabelle mit Stärke, Reichweite, Ton, Passung, Marketability, Werbewert; Fanprofil und Aushängeschild |
| Finanzen | Merch-Zeile der Aufschlüsselung nennt die drei Verkäufer und die Zugkraft |
| Fremde Teams | Fanprofil immer sichtbar (Stammdatum), Marketability ihrer Spieler nach Scouting-Stand |

Zahlen stehen ohne Notenstufe, Klassen in Klassenfarbe, Rang 1 ist die höchste Marketability, jede Spalte sortiert.

## 6. Was am Bestand anzupassen wäre

- `COSMETIC_TRAIT_POPULARITY_WEIGHTS` (`lib/traits/cosmetic-trait-soft-effects.ts:71`) behandelt `Scandalous` für jedes Team
  als Abzug. Mit dem Fanprofil wird daraus Ton × Ton: bei Hell Raisers ein Plus, bei Golden Gladiators ein Minus.
- Der Sub-Score „Fan-Lieblinge“ der Beliebtheit (`team-beliebtheit.ts:37`, Gewicht 0,3) zählt nur den Trait `FanFavorite`.
  Er kann durch die mittlere Marketability der drei besten Verkäufer ersetzt werden; die Gewichte bleiben.
- Die Eignungsmatrix, die Wertung und der Marktwert werden nicht angefasst.

## 7. Das Mockup

`public/mockups/marketing-22-11.html`, Stil und Bausteine des Finanz-Mockups (Tokens `--haus`, `--zahl`, Schiene, Hero-Kopf,
Tafel, Karten), reine CSS/SVG-Gestaltung, kein PixelLab.

- **Kopf:** Umschalter Hell Raisers und Golden Gladiators mit Fanprofil, Ton und Merch; rechts das Aushängeschild.
- **Tabelle:** Kader des Teams und sieben Spieler vom Markt. Spalten Spieler mit Traits (grün Liebling, orange Anecker, grau
  farblos), Klasse in Klassenfarbe mit Rasse und Gesinnung, Stärke, Reichweite, Ton auf der Achse (Punkt = Spieler, Dreieck =
  Fans), Passung, Marketability, Werbewert. Jede Spalte sortiert.
- **Karten:** Wohin es wirkt, Aushängeschild, Fanprofile der Liga.
- **Kontext rechts:** Fanprofil (Ton, mögen, meiden, Farbe) und die Herleitung für den gewählten Spieler bis zum Werbewert
  und zum Merch „mit ihm im Kader“.

Ehrlich gekennzeichnet: Spieler, Traits, Rasse, Klasse, Gesinnung, Rating, Kaderzuordnung, Portraits, Wappen, `manners`,
`popularity`, Farbgewichte und Themen sind echt. Formel und Gewichte sind der Vorschlag; das Skript des Mockups rechnet sie
live. Vereinfacht sind: Thema nur über die Rasse (statt `themeTier`), kein Farb-Term, kein Ruhm, Liga-Mittel fest 1,2,
Liga-1-Basis für beide Teams.

| Datei (`docs/design/marketing-22-11/`) | Zeigt |
|---|---|
| `hell-raisers-1920x1080.png` | Hell Raisers, Mauler vom Markt gewählt: 100 |
| `golden-gladiators-mauler-1920x1080.png` | Golden Gladiators, derselbe Mauler: 53 |
| `hell-raisers-aurelia-2560x1440.png` | Hell Raisers, Aurelia Rosethorn gewählt: 50 |
| `golden-gladiators-staerke-1710x1112.png` | nach Stärke sortiert: King Arthur oben, Marketability 49 |
| `phone-412x900.png` | Nebenprobe Phone |

Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine JS-Fehler, kein Seitenscroll und kein inneres Scrollen bei
2560×1440, 1920×1080 und 1710×1112, kein abgeschnittener Text. Auf dem Phone sind lange Trait-Zeilen gekürzt und der Kontext
scrollt.

## 8. Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Soll die Marketability je Team verschieden sein (Reichweite × Passung), oder reicht eine Zahl je Spieler? | **Je Team.** Nur so haben Hell Raisers andere Fans als Golden Gladiators, und der Transfermarkt bekommt einen Grund, warum ein Spieler dem einen mehr wert ist. |
| 2 | Ton der Fans aus `manners` ableiten, oder willst du die 32 Zielgruppen selbst setzen? | **Ableiten und von dir gegenlesen lassen.** Die Tabelle in Abschnitt 3 ist der Vorschlag; einzelne Teams kannst du überschreiben. |
| 3 | Merch-Basis auf 6,0 / 4,0 C heben, damit ein Zugpferd bis ±1,8 C je Saison bewegt, oder bei 4,4 / 3,0 C bleiben (±1,3 C)? | **Heben**, zusammen mit den stärkeren Tickets messen. |
| 4 | Darf die KI für Marketability mehr zahlen (bis +8 %)? | **Ja, gedeckelt.** Ohne das wäre der Wert nur Anzeige; mit mehr als 8 % kauft sie Trikotverkäufer statt Stärke. |

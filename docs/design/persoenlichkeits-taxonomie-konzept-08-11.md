# Persönlichkeits-Taxonomie: wie Charakter zu Verhalten wird — Konzept, zweite Fassung (08.11.)

Chris, 08.11., in drei Runden (festgehalten in `docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`,
Teil 2 mit den Abschnitten „Nachschärfung" und „Scope-Korrektur"). Der Auftrag der ersten Runde:
Tackling/Rempler sollen projektweit fallen, und **wie oft** jemand rempelt, soll an seiner
Persönlichkeit hängen — Beispiel „Egomaniac im teamfokussierten Slot, der die Rolle nicht
unbedingt spielt". Die zweite Runde: volle 36-Trait-Matrix, Ausgabe als Rangliste „Platz 1, 2, 3",
Attribute sekundär (Torment, Determination), Varianz ist gewollt. Die dritte Runde, wörtlich:
„Bisher sind die abgeleiteten Persönlichkeiten ja für die Kampfarena und so. Ich möchte generelle
Persönlichkeiten. Also, dass ein Spieler professionell ist, dass er unprofessionell ist, dass er so
ein Meckerer ist... und auch mehr als nur 6." Referenz: Football Manager. Zielgröße: um die
zwanzig.

**Was diese Fassung gegenüber der ersten ändert.** Die erste Fassung hatte dreizehn
Persönlichkeiten, die noch zu nah am Kampf hingen (Raufbold, Dickschädel), und leitete die
Verhaltensregler direkt aus dem Namen ab. Diese Fassung baut es so, wie Football Manager es baut:
**neun verdeckte Charakterzüge** (Professionalität, Ehrgeiz, Temperament, Nervenstärke, Fairness,
Loyalität, Teamgeist, Rampenlicht, Führung) werden aus den 36 Traits berechnet; **zwanzig
benannte Persönlichkeiten** sind Schablonen über diesen Zügen und werden als Platz 1/2/3
ausgegeben; die **Regler**, die der Motor liest — sechs im Spiel, vier außerhalb —, kommen aus den
Zügen. Der Name ist das Etikett, die Züge sind der Motor. Was bleibt: alle 36 Traits in einer
Matrix, Attribute sekundär, die sechs Kampfstile unangetastet darunter, die Rempler-Mechanik mit
Kader-Normierung, die Rollentreue als Mischung, die Spannungsfälle, die Anzeige im
`++/+/0/−/−−`-Schema.

**Dieses Dokument ist reines Konzept.** Kein Code, keine Zahl darin ist gemessen — mit einer
Ausnahme: die Verteilung der zwanzig Persönlichkeiten über die 2.984 Seed-Spieler (Abschnitt 6.3)
ist mit einem Wegwerf-Skript auf der Matrix dieses Dokuments nachgerechnet, damit die Taxonomie
nicht im luftleeren Raum steht. Die drei Schranken aus `CLAUDE.md` gelten: Eignungsmatrix
byte-identisch, rho je Einzelspiel über 0,80, Pp-Abweichung ≤ 25 — mit der Präzisierung aus
Abschnitt 10.1, dass sie das Abnahme-Maß der gewählten Dosierung sind. Scope laut Chris: nur
Battle-Mode. Das Oberflächen-Effekte-Konzept vom selben Tag (`oberflaechen-effekte-konzept-08-11.md`)
ist ein anderes Thema; geteilt wird nur die Anzeige-Konvention.

---

## Kurzfassung

- **Drei Ebenen.** Ebene 0: die sechs Kampfstile (`leitePers()`, Bollwerk bis Opportunist) bleiben,
  wie sie sind — abgenommen, gemessen, Arena-Handwerk. Ebene 1: neun **Charakterzüge**, je −100
  bis +100, aus den 36 Traits (primär), Attributen (sekundär, gedeckelt) und Klasse (tertiär,
  klein). Ebene 2: zwanzig **Persönlichkeiten** als Schablonen über den Zügen, ausgegeben als
  Platz 1/2/3 mit Passung in Prozent.
- **Zwanzig, allgemein, nicht kampfbezogen.** Musterprofi, Perfektionist, Ehrgeizling, Anführer,
  Mannschaftsspieler, Treue Seele, Söldner, Egomane, Rampensau, Nörgler, Hitzkopf, Eisblock,
  Unbeugsamer, Hasardeur, Schlitzohr, Sportsmann, Frohnatur, Schlendrian, Zauderer, Einzelgänger —
  plus „Unauffällig" als ehrlicher Rückfall. Die Familien sind die von Football Manager
  (professionell, ehrgeizig, loyal, führend, belastbar, fair, leichtlebig, negativ), die Namen
  sind unsere, die Zutaten sind unsere 36 Traits.
- **Zehn Regler, aus den Zügen berechnet.** Im Spiel: Kontakt, Härte, Rollentreue, Wagnis,
  Nerven, Teamzug. Außerhalb: Trainingseifer, Reizbarkeit (Nörgeln, Moral), Bindung (Vertrag),
  Medienlust. Formeln in 7.1 — jeder Regler ist eine kurze gewichtete Summe von zwei bis drei
  Zügen, nichts davon liest die Eignung.
- **Die Kombination wirkt zweimal.** Über die Züge, die alle drei Ränge gemeinsam stellen (ein
  Egomane mit Mannschaftsspieler auf Platz 2 hat einen anderen Teamgeist-Wert als einer mit
  Hitzkopf auf Platz 2), und über **Spannungsfälle**: benannte Paare aus Platz 1 und 2 mit je
  einer Zusatzregel (Maulheld, Rowdy-Star, Alphatier, Zerrissener, Vollstrecker, Grübler,
  Grantler mit Herz, Besserwisser …). Platz 3 wird angezeigt und färbt die Züge, trägt aber
  keine eigene Regel (6.2).
- **Gemessen am Seed-Bestand:** 8 % Unauffällig, 61 % volles Podium, häufigste Persönlichkeit
  Hitzkopf mit 12,5 % (Feisty ist das häufigste Trait), seltenste Nörgler mit 0,6 % — der
  Meckerer braucht ein Trait, das es nicht gibt, und das ist ein Befund, keine Panne (6.3).
- **Beim Rempler entscheidet die Persönlichkeit nur, WIE OFT jemand es versucht und WIE HART,
  nie, OB es sitzt.** Hockey: Hitzkopf 2,1 Bodychecks je Spiel statt 1,6 und 1,0 Strafen statt
  0,55; Zauderer 1,2; Eisblock 1,3 mit ~24 % Trefferquote durch Auswahl; Egomane 1,9, bevorzugt
  gegen den gegnerischen Star (Abschnitt 8).
- **Rollentreue heißt „spielt sein eigenes Spiel", nicht „spielt schlechter".** Ein Egomane im
  Slot Hold Line hält die Linie zu 26 %; den Rest spielt er nach seinem eigenen Profil — je nach
  Spieler besser oder schlechter. Varianz ist gewollt (Chris, zweite Runde), die Dosierung ist ein
  Stellrad `charakterStaerke`, Startwert 1,0 (10.1).
- **FM-Transparenz:** die Persönlichkeitszeile mit drei Rängen und Herleitung, Regler-Chips im
  Picker, und — neu — fünf `laufbahn`-Zähler, damit Chris nach einer Saison nachlesen kann, ob
  der Rowdy-Star „den Scheiß gerockt" hat oder „grandios gescheitert" ist (9.4).

---

## 1. Was heute da ist — vier Befunde (unverändert aus der ersten Fassung, gekürzt)

**1.1 Die Traits sind kanonisch, verbreitet und schon in der Arena.** 18 positive, 18 negative,
an drei Stellen identisch (`lib/training/class-progression-config.ts`,
`lib/lineups/legacy-lineup-modifiers.ts`, `MUTATOR_POS`/`MUTATOR_NEG` in
`public/mockups/battle-mode.engine.js` ~8348). Im Seed-Bestand (`data/generated/oly-player-stats.json`,
2.984 Spieler) trägt ein Spieler im Median zwei positive und zwei negative; 198 haben kein
positives, 279 kein negatives, rund 60 gar keines. Häufigste: Feisty 516, FiredUp 507, Loyal 504,
Ambitious 438, Eloquent 431, Mercenary 430; Egomaniac 245. Die Traits wirken heute in Mutator,
Training (`trait-training-signal.ts`, `training-mode-demand-service.ts`: `HART_BIAS_TRAITS`,
`LEICHT_BIAS_TRAITS`), Moral (`player-morale-service.ts`: `POSITIVE_TRAINING_TRAITS`,
`NEGATIVE_VOLATILE_TRAITS`), Vertrag (`contract-negotiation-preview.ts`: „Diva/Egomaniac erwarten
ein sichtbares Signal"), Kapitänswahl (`team-captain-service.ts`) und zwei weichen Effekten
(`cosmetic-trait-soft-effects.ts`). **Sechs Stellen, sechs eigene Trait-Listen, keine gemeinsame
Quelle** — ein Nebenbefund, den die Züge aus Abschnitt 4 später aufräumen könnten.

**1.2 Es gibt bereits eine abgeleitete Persönlichkeit, nur für den Kampf.** `leitePers(p)`
(~36765) vergibt Punkte aus `PW.klasse/rasse/sub/plus/minus` und nimmt den Schlüssel mit den
meisten: Bollwerk, Draufgänger, Duellant, Schleicher, Beschützer, Opportunist. Sie steuert
Zielneigung (`PERSZIEL`) und Skalen (`PERSDEF`) in der Arena, die Tackle-Bereitschaft auf der
Bahn (`willTackeln` ~48859: Draufgänger 0,9 … Bollwerk 0,25) und den Sandsack-Lastenplan
(`sandsackPersoenlichkeit()` ~21260). Chris' Einwand ist richtig: das sind Kampfrollen —
„Draufgänger ist sowas wie Renegade-Egomaniac" —, keine Charaktere. Sie bleiben als Ebene 0.

**1.3 Persönlichkeit kann Rangtreue kosten, und man weiß worüber.** Opus, 02.10.
(`arena-zielwahl-opus-empfehlung-02-10.md`): Zielneigung und Haltung sind rangtreue-neutral,
Zusammenhalt und Bindung trugen die Fehlordnung (TDM 0,324 → 0,416, Mini-DM 0,365 → 0,588),
weil sie die **Menge** des Beitrags änderten. Seit 07.10. in Mini-DM `persHandwerk:["z"]`. Kein
Regler dieses Konzepts fasst Zusammenhalt oder Bindung an.

**1.4 Attribute ja, Alignment nein.** Zwölf Attribute für jeden Spieler. `alignment` steht für
jeden generierten Spieler auf `"N"` (`commit-draft-to-free-agent.ts:42`) — tot für neue Spieler,
bleibt draußen.

---

## 2. Referenz: wie Management-Spiele Persönlichkeit bauen

Kurze Recherche, wie Chris sie verlangt hat, damit die zwanzig nicht erfunden sind.

**Football Manager** (fmscout, „A guide to player personalities"; sortitoutsi FM24/FM26-Guides;
magicgameworld FM19) baut Persönlichkeit aus **acht verdeckten Attributen** — Professionalism,
Ambition, Temperament, Pressure, Sportsmanship, Loyalty, Controversy, Adaptability — plus den
sichtbaren Determination und Leadership. Jedes verdeckte Attribut hat einen eigenen Wirkbereich:
Professionalism → Trainingsfortschritt, Fitness, Körpersprache; Ambition → Vertragsforderungen,
Vereinswahl, Training; Temperament → Disziplin, Reaktion auf Kritik, Kontrollverlust im Spiel;
Pressure → große Spiele, Reaktion auf Druck; Sportsmanship → Fairness gegenüber Gegnern, weniger
„dirty work"; Loyalty → Bleibewille, Gehaltsverzicht; Controversy → Kritik am Trainer, Medien,
Ignorieren von Anweisungen. Daraus entstehen **rund 35 benannte Persönlichkeitstypen** über
Schwellenregeln (FM19: Model Professional = Professionalism 20 und Temperament 10–20;
Spineless = Pressure 1 und Determination 1–9; Temperamental = Temperament 1–4; Perfectionist =
Ambition, Determination, Professionalism 14–20 bei niedrigem Temperament), gruppiert in Familien:
professionell (Model Professional, Professional, Perfectionist, Model Citizen), ehrgeizig
(Ambitious, Driven, Mercenary, Fickle), entschlossen/belastbar (Determined, Resilient, Resolute,
Iron Willed, Spirited), loyal (Devoted, Loyal), führend (Born Leader, Charismatic Leader),
sportlich (Honest, Sporting, Balanced), leichtlebig (Light-Hearted, Jovial) und negativ (Slack,
Casual, Temperamental, Easily Discouraged, Spineless, Low Self-Belief, Unambitious, Unsporting).
Dazu ein getrennter **Medienstil** (Media-Friendly, Outspoken, Reserved, Volatile …). Die Guides
betonen zweierlei, das für uns gilt: der Name sagt nur, was die definierenden Attribute sagen
(„Professional tells you little else"), und die Schwellen ändern sich je Version — Namen sind
Etiketten, die Attribute sind die Wahrheit.

**OOTP Baseball** (Entwicklerforum) arbeitet mit Leadership, Loyalty, Desire for Winning, Greed,
Work Ethic, Intelligence, Controversy; Work Ethic ist dort gemessen der stärkste Hebel auf die
Entwicklung, Greed und Controversy die beiden „bad when high". Ein Entwickler-Hinweis, den wir
übernehmen: „players will not always behave precisely according to their player personalities" —
Persönlichkeit ist Neigung, nicht Skript.

**Was wir daraus nehmen:** die Zweiteilung in verdeckte Züge und benannte Typen; die Familien;
Temperament als eigene Achse neben Nervenstärke (Hitzkopf ist nicht Zauderer mit anderem
Vorzeichen); Fairness als Achse, die Härte vom Kontakt trennt; Medien als eigener Regler. Was wir
**nicht** übernehmen: Adaptability (wir haben keine Nationalitäts-/Ligamechanik), und
Determination/Leadership als sichtbare Attribute — bei uns sind das `determination` und
`charisma`, die als sekundäre Signale in die Züge fließen.

Quellen: [fmscout — A guide to player personalities](https://www.fmscout.com/a-guide-to-player-personalities-football-manager.html),
[sortitoutsi — FM24 guide player personalities](https://sortitoutsi.net/content/67996/fm24-guide-player-personalities),
[sortitoutsi — FM26 hidden attributes explained](https://sortitoutsi.net/content/74854/fm26-hidden-attributes-explained),
[magicgameworld — FM2019 player personality guide](https://www.magicgameworld.com/football-manager-2019-player-personality-guide/),
[OOTP Developments Forum](https://forums.ootpdevelopments.com/showthread.php?p=4032570).

---

## 3. Drei Ebenen

| Ebene | Was | Woraus | Wer liest es | Status |
|---|---|---|---|---|
| 0 **Kampfstil** | sechs Typen (`PERS`) | `leitePers()`: Klasse, Rasse, Unterklasse, Traits | Arena-Zielwahl/Haltung, Bahn-`willTackeln` (bis es umzieht, 8.4), Sandsack-Plan | unangetastet, abgenommen |
| 1 **Charakterzüge** | neun Werte −100…+100 | 36 Traits (primär), Attribute (sekundär), Klasse (tertiär) — Abschnitt 4 | die zehn Regler (7.1); perspektivisch Training, Moral, Vertrag, Kapitän statt sechs eigener Trait-Listen | neu |
| 2 **Persönlichkeiten** | zwanzig Namen, Platz 1/2/3 | Schablonen über den Zügen — Abschnitt 5/6 | Anzeige, Spannungsfälle, Ticker, Historie | neu |

Zwei Dinge, die diese Schichtung leistet, die ein Punktestapel je Name nicht leisten kann: Ein
Spieler mit **widersprüchlichen Traits** (Altruistic und Egomaniac) wird nicht zufällig einem
der beiden Namen zugeschlagen, sondern hat einen Teamgeist nahe Null und bekommt den Marker
„zerrissen" (6.4). Und ein Spieler, dessen Persönlichkeit „Hitzkopf" heißt, kann je nach
seinen übrigen Zügen ein loyaler oder ein söldnerischer Hitzkopf sein — das steht in den Zügen,
nicht im Namen, und der Motor liest die Züge.

Ob Ebene 0 irgendwann aus Ebene 1 abgeleitet wird (ein Bollwerk ist ein Spieler mit hoher
Professionalität und niedrigem Temperament), ist eine spätere Frage mit voller Neumessung von
Mini-DM und Takeshi. Für dieses Konzept: nein, und eine Übereinstimmungs-Stichprobe auf der
Kader-Familie gehört in die erste Umsetzungsrunde.

---

## 4. Die neun Charakterzüge und die Matrix

### 4.1 Die Züge

| Zug | Kürzel | +100 heißt | −100 heißt | FM-Entsprechung |
|---|---|---|---|---|
| Professionalität | PRO | arbeitet, trainiert, hält sich an den Plan | lässig, unzuverlässig | Professionalism |
| Ehrgeiz | EHR | will nach oben, nimmt die große Option | zufrieden, wo er ist | Ambition |
| Temperament | TEM | hitzig, reizbar, schnell im Zweikampf | gelassen, kühl | Temperament (gespiegelt) |
| Nervenstärke | NER | wächst unter Druck | bricht unter Druck ein | Pressure |
| Fairness | FAI | sauber, respektvoll | foult, trickst, schadet | Sportsmanship |
| Loyalität | LOY | bleibt, verzeiht, nimmt weniger | geht, wo es mehr gibt | Loyalty |
| Teamgeist | TEA | Mannschaft vor sich selbst | sich selbst vor der Mannschaft | — (bei FM in Professionalism/Sportsmanship) |
| Rampenlicht | RAM | sucht Öffentlichkeit, redet, provoziert | scheu, verschlossen | Controversy + Medienstil |
| Führung | FUE | geht voran, zieht andere mit | lässt sich führen | Leadership |

Null ist die Mitte und der Normalfall. Ein Zug zählt als „ausgeprägt" ab ±25.

### 4.2 Die Trait-Spalte — alle 36, jedes Trait auf zwei bis fünf Züge

Werte in Zug-Punkten; ±35 ist ein Leittrait, ±20 ein starkes Signal, ±10 eine Färbung. Die
Summe je Zug wird auf ±100 gedeckelt. Chris' Forderung („alle 36 müssen in so einer riesen
Matrix drin sein") ist damit wörtlich erfüllt.

| Trait | PRO | EHR | TEM | NER | FAI | LOY | TEA | RAM | FUE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Altruistic | | | | | +20 | +10 | **+35** | | |
| Ambitious | +10 | **+35** | | | | −10 | | | |
| Caring | | | −10 | | +20 | | +25 | | |
| Cool | | | **−35** | +20 | | | | | |
| Diligent | **+35** | +10 | | | | | | | |
| Disciplined | +30 | | −20 | | +10 | | | | |
| Eloquent | | | | | | | | +20 | **+35** |
| Fair | | | −10 | | **+35** | | | | |
| FanFavorite | | | | | | | | **+35** | +10 |
| Fearless | | +10 | +10 | **+35** | | | | | |
| FiredUp | | +20 | +25 | +10 | | | | | |
| Flexible | +10 | | −10 | | | +10 | +15 | | |
| Healthy | +15 | | | +10 | | | | | |
| Loyal | | | | | | **+35** | +15 | | |
| Motivated | +20 | +20 | | | | | | | +15 |
| Relaxed | −15 | −10 | **−35** | | | | | | |
| Resourceful | +10 | | | +15 | −10 | | | | |
| Sexy | | | | | | | −5 | +25 | |
| Timid | | | | **−35** | | | | −30 | −15 |
| Cheater | −10 | | | | **−35** | | | | |
| ColdBlooded | | | −20 | +30 | −15 | | −10 | | |
| Cruel | | | +20 | | −30 | | −10 | | |
| Devious | | | | +10 | −30 | | −15 | | |
| Diva | −15 | | +10 | | | −10 | −25 | +25 | |
| Egomaniac | | +20 | | | | | **−40** | +20 | +5 |
| FaintHearted | | −10 | | **−35** | | | | | |
| Feisty | | | +30 | | −10 | | | | |
| Gambler | −20 | +10 | +15 | | −15 | | | | |
| Lazy | **−40** | −15 | | | | | | | |
| Manipulative | | | | +10 | −25 | | −15 | | +15 |
| Mercenary | | +15 | | | | **−40** | −10 | | |
| Obsessive | +25 | +20 | +20 | −10 | | | | | |
| Paranoid | | | +15 | −15 | | −15 | −10 | −30 | |
| Renegade | −15 | | +10 | | −10 | −30 | | +15 | |
| Scandalous | −20 | | | | −10 | | | +30 | |
| Vindictive | −10 | | +30 | | −15 | −15 | | | |

Drei Entscheidungen darin, die man sehen sollte: **ColdBlooded** ist positiv für Nerven und
negativ für Fairness und Teamgeist — es ist das eine Trait, das im Spiel in beiden Listen
vorkommt (Undead führt es als positiv), und die Matrix behandelt es als das, was es ist: kalt.
**Obsessive** hebt Professionalität und Ehrgeiz, aber auch Temperament und senkt Nerven — der
Perfektionist nach FM-Vorbild, der an sich selbst scheitert. **Resourceful** senkt Fairness
leicht — findig heißt auch: findet den Weg um die Regel.

### 4.3 Die Attribut-Spalte — sekundär, mit Chris' zwei Beispielen

Chris: „nicht als primäres, sondern eher als sekundäres", Beispiele **Torment** (Bereitschaft,
andere zu verletzen) und **Determination** (sich nicht abbringen lassen). Attribute zählen als
**Form**, nicht als Höhe: nur der Abstand zum eigenen Mittel μ_p der zwölf Attribute, damit
Persönlichkeit nicht zum zweiten Namen für Eignung wird (sonst wäre jede Rangtreue-Messung
zirkulär — dasselbe Argument wie `arena-zielwahl-opus-empfehlung-02-10.md` 3.1).

    beitrag(a_k) = clamp((a_k − μ_p − 5) / 2, −15, +15)       (Form, nicht Höhe; ±15 Zug-Punkte Deckel)

| Attribut | Zug | Richtung | Chris' Lesart |
|---|---|---|---|
| **torment** | TEM +, FAI − (halb) | hoch → hitziger und härter | „Bereitschaft, andere zu verletzen" |
| **determination** | PRO +, NER + (halb) | hoch → hält den Plan, hält dem Druck stand | „sich nicht abbringen lassen" |
| will | NER + | hoch → nervenstärker | — |
| charisma | FUE +, RAM + (halb) | hoch → führt, sucht das Licht | — |
| spirit | TEA + (halb) | hoch → teamorientierter | — |

Zusammen höchstens ±15 je Zug aus Attributen — weniger als ein halbes Leittrait. Das ist die
Deckelung, die „sekundär" meint: ein Spieler mit Torment 90 und ohne ein einziges hitziges Trait
kommt auf Temperament +15, nicht auf Hitzkopf. Ein Hitzkopf mit Torment 90 kommt auf Temperament
+45 statt +30 — derselbe Name, spürbar härter, und der Tooltip zeigt „Torment 90: +15
Temperament".

**Der Pp-Vorbehalt** (Opus 5.2, „Attribute als Eingang?"): ein Attribut, das über die Züge
Verhalten steuert, wird von `einflussVon()` mitgemessen. Wo die Matrix der Disziplin das
Attribut über Null führt (Torment in Hockey, Fechten, Breaking, Takeshi), ist das harmlos bis
hilfreich. Wo sie es mit Null führt (Torment in Tennis, Eiskunstlauf, Schach), wäre es ein
Attributkanal außerhalb der Matrix. Deshalb: **der Attributanteil eines Zugs wirkt in einer
Disziplin nur, wenn deren Gewichtsquelle (`resolveDisciplineWeightProfile`) das Attribut über
Null führt.** Die Züge werden einmal je Spieler ohne Attribute berechnet (das ist die
Persönlichkeit, die der Kader zeigt) und einmal je Disziplin mit den zulässigen Attributen (das
ist die, die der Motor liest). Der Picker zeigt die Differenz als Zeile „in dieser Disziplin:
Torment zählt mit".

### 4.4 Die Klassen-Spalte — tertiär, klein

±5 bis ±10, nur als Färbung, weil Klasse und Traits bei generierten Spielern ohnehin aus
demselben Archetyp kommen (`player-generator-archetypes.ts`):

Berserker TEM +10 · Tank PRO +5, LOY +5 · Bard RAM +10 · Hero FUE +10 · Templar FAI +10, PRO +5 ·
Tactician PRO +10 · Rogue FAI −10 · Overseer PRO +5 · Mage TEM −5, NER +5 · Warlord FUE +10,
EHR +5 · Badass RAM +10, TEM +5 · Sprinter EHR +5 · Charger TEM +5, NER +5.

Unterklassen und Rassen kommen nicht in die Züge. Im Kampfstil sind sie richtig (ein Construct
steht wie ein Bollwerk), beim Charakter wären sie Klischee.

---

## 5. Die zwanzig Persönlichkeiten

Jede Persönlichkeit ist eine **Schablone**: zwei bis vier Bedingungen an Züge, mit Gewicht 2
(definierend) oder 1 (färbend). Die Passung eines Spielers ist der gewichtete Erfüllungsgrad
(6.1). Die Spalte „im Spiel" nennt, was die Regler aus 7.1 bei einem typischen Vertreter tun;
„außerhalb" nennt Training, Moral, Vertrag, Medien.

| # | Persönlichkeit | Familie (FM) | Schablone | In einem Satz | Im Spiel | Außerhalb |
|---|---|---|---|---|---|---|
| 1 | **Musterprofi** | professionell | PRO+ (2), TEM− (1), FAI+ (1) | „Macht seine Arbeit, jeden Tag, ohne Theater." | Rollentreue hoch, Kontakt niedrig-mittel, sauber; Nerven gut | Trainingseifer 80, nörgelt nicht, verlängert fair |
| 2 | **Perfektionist** | professionell | PRO+ (2), EHR+ (1), TEM+ (1) | „Will es richtig — und ärgert sich, wenn es nicht so ist." | Rollentreue hoch, aber Wagnis über Mitte: geht in schwere Versuche; Nerven Mitte | Trainingseifer am höchsten (83), aber reizbar, wenn es nicht läuft |
| 3 | **Ehrgeizling** | ehrgeizig | EHR+ (2), LOY− (1) | „Will nach oben, mit oder ohne diesen Verein." | Wagnis hoch, Teamzug unter Mitte | Vertrag: fordert, droht mit Wechsel (Bindung 23); trainiert hart |
| 4 | **Anführer** | führend | FUE+ (2), TEA+ (1), NER+ (1) | „Geht voran und zieht die anderen mit." | Nerven 75, Teamzug 74, hebt Rollentreue der Mitspieler (7.4) | Kapitänskandidat, medienfest, bindet |
| 5 | **Mannschaftsspieler** | fair/loyal | TEA+ (2), FAI+ (1) | „Macht, was dem Team hilft, auch wenn es keiner sieht." | Teamzug 86, Rollentreue 75, Kontakt niedrig, sauber | ruhig, verlässlich, keine Forderungen |
| 6 | **Treue Seele** | loyal | LOY+ (2), TEA+ (1) | „Bleibt — auch wenn woanders mehr wartet." | Teamzug hoch, sonst unauffällig | Bindung 83: verlängert, verzeiht Bankplätze länger |
| 7 | **Söldner** | ehrgeizig | LOY− (2), EHR+ (1) | „Erledigt den Job, solange der Job ihn bezahlt." | alles Mitte; Rollentreue hängt an der Moral (7.3) | Bindung 14: der Erste, der geht; Moral hängt am Gehalt |
| 8 | **Egomane** | negativ | TEA− (2), EHR+ (1), RAM+ (1) | „Das Spiel ist eine Bühne, und er ist der Hauptdarsteller." | Rollentreue 26, Teamzug 16, Wagnis 72, sucht den Star | reizbar (69), medienlustig, drückt Teammoral, wenn übergangen |
| 9 | **Rampensau** | Medienstil | RAM+ (2), PRO− (1) | „Spielt für die Tribüne, nicht für den Trainer." | Rollentreue 30, Wagnis 70, Nerven im Spotlight 65, sonst 35 | Medienlust 83, Trainingseifer 45, Popularität |
| 10 | **Nörgler** | negativ | TEM+ (2), LOY− (1), PRO− (1) | „Es ist nie sein Fehler, und das sagt er auch." | Härte hoch, Rollentreue 33 | Reizbarkeit 76: der Meckerer, den Chris meint — kritisiert Aufstellung, drückt Moral |
| 11 | **Hitzkopf** | negativ | TEM+ (2), FAI− (1) | „Sucht den Kontakt, auch wenn er ihn nicht braucht." | Kontakt 78, Härte 84, die meisten Strafen | reizbar, aber nicht illoyal; reagiert schlecht auf Kritik |
| 12 | **Eisblock** | belastbar | NER+ (2), TEM− (1) | „Entscheidet, als ginge es ihn nichts an." | Nerven 93, Kontakt nur bei guter Chance, kaum Strafen | nörgelt nie (30), medienscheu |
| 13 | **Unbeugsamer** | belastbar | NER+ (1), EHR+ (1), PRO+ (1) | „Gibt nie auf, und zwar wortwörtlich." | Nerven 85, Kontakt hoch und sauber, Rollentreue gut | trainiert hart, führt mit (FUE +30) |
| 14 | **Hasardeur** | negativ | FAI− (1), PRO− (1), TEM+ (1), EHR+ (1) | „Der große Wurf oder nichts." | Wagnis hoch, Härte 70 (Fouls, die er für klug hält), Rollentreue 33 | unzuverlässig im Training, Vertrag wechselhaft |
| 15 | **Schlitzohr** | negativ | FAI− (2), NER+ (1) | „Foult, wenn der Schiedsrichter woanders hinschaut." | Härte 71, aber Entdeckungsquote −⅓; Nerven 70 | ruhig nach außen, manipuliert innen |
| 16 | **Sportsmann** | fair | FAI+ (2), TEM− (1) | „Gewinnt lieber sauber als überhaupt." | Härte 21, Kontakt 36, Rollentreue gut | respektiert, Moral-Stabilisator |
| 17 | **Frohnatur** | leichtlebig | TEM− (2), RAM+ (1), NER+ (1) | „Nimmt nichts so schwer — auch nicht das Training." | Nerven 70, Kontakt niedrig | Trainingseifer 40, medienfreundlich, hebt Teamklima |
| 18 | **Schlendrian** | negativ | PRO− (2), EHR− (1) | „Könnte, wenn er wollte. Will selten." | Rollentreue 34, Wagnis niedrig | Trainingseifer 15: die Entwicklung bleibt stehen |
| 19 | **Zauderer** | negativ | NER− (2), EHR− (1) | „Weicht aus, wo andere hineingehen." | Nerven 8, Kontakt 31, Wagnis 33; Rollentreue über Mitte | braucht Bestätigung; Moral fällt bei Kritik |
| 20 | **Einzelgänger** | Medienstil | RAM− (2), FUE− (1) | „Redet nicht, führt nicht, stört nicht." | Teamzug unter Mitte, sonst unauffällig | Medienlust 16: gibt keine Interviews, keine Skandale |
| 0 | *Unauffällig* | — | kein Zug über ±25 | „Nichts, was auffällt." | alle Regler 50 | — |

Nicht aufgenommen, bewusst: „Raufbold" und „Dickschädel" (erste Fassung: Kampfrollen — Hitzkopf
und Unbeugsamer sind ihre allgemeinen Formen), „Lehrling/Wissbegierig" (Lernbereitschaft ist ein
Regler, Trainingseifer, kein Typ — wie bei FM, wo Professionalism und Ambition das Training
tragen), „Model Citizen" (ein Spieler mit allem — bei uns ein Musterprofi mit Anführer auf
Platz 2, das Podium zeigt es), „Verräter" (gibt es als Verhalten nicht).

---

## 6. Platz 1, 2, 3 — die Rangliste

### 6.1 Die Regel

    Passung(p, P) = Σ_Bedingungen w · clamp(Richtung · Z_k / 50, 0, 1) / Σ w

Ein Zug von +50 erfüllt eine Bedingung voll, +25 zur Hälfte, Gegenrichtung gar nicht.

1. **Unauffällig**, wenn kein Zug ±25 erreicht. Kein Podium.
2. Sonst alle zwanzig Passungen rechnen; **Platz 1, 2, 3** sind die drei höchsten mit Passung
   ≥ 0,45. Fehlt die dritte (oder zweite), bleibt der Platz leer — ein Podium mit zwei Namen ist
   ehrlicher als ein erzwungener dritter.
3. **Gleichstand** in dieser Reihenfolge: höhere Erfüllung der Gewicht-2-Bedingung, dann mehr
   beteiligte Traits, dann die feste Reihenfolge der Tabelle in Abschnitt 5. Deterministisch,
   ohne Saat.
4. **Einmal je Spieler aus den Stammdaten.** Traits ändern sich nicht; Attribute langsam — ein
   Spieler, dessen Will über zwei Saisons von 40 auf 70 wächst, kann vom Zauderer zum
   Unbeugsamen werden. Das ist gewollt und im Saisonrückblick erzählbar.

### 6.2 Was Platz 3 tut — Empfehlung: anzeigen, färben, keine eigene Regel

Chris will „Platz 1 ist das, Platz 2 ist das, Platz 3 ist das". Die Frage war, ob der dritte
Rang mechanisch eigenständig wirkt. **Empfehlung: nein, und er muss es auch nicht.** In dieser
Fassung kommen die Regler aus den **Zügen**, nicht aus einer Mischung von Namen. Alles, was Platz
3 über den Spieler sagt, steckt bereits in den Zügen, die der Motor liest — ein Perfektionist
mit Hitzkopf auf Platz 3 hat ein höheres Temperament als einer mit Eisblock auf Platz 3, und
genau das stellt seine Härte. Platz 3 braucht deshalb kein eigenes Gewicht; er ist die
**Erklärung**, warum die Züge so stehen, wie sie stehen.

Was Platz 2 zusätzlich tut und Platz 3 nicht: **Spannungsfälle** (7.3) keyen auf das Paar aus
Platz 1 und 2. 78 Paare über dreizehn waren benennbar, 190 Paare über zwanzig sind es gerade
noch; 1.140 Tripel nicht. Und die Druckregel (unter Druck übernimmt die Persönlichkeit mit dem
extremeren Nerven-Wert) sieht nur Platz 1 und 2.

Ausnahme für ein **dichtes Podium**: liegen alle drei Passungen innerhalb von 0,10, zeigt der
Tooltip „vielschichtig", und Spannungsfälle dürfen auch das Paar 1/3 bilden. Das ist selten
(6.3) und die ehrliche Antwort auf einen Spieler, der wirklich drei Gesichter hat.

### 6.3 Gemessen am Seed-Bestand

Die Matrix aus 4.2 plus Klassen-Färbung aus 4.4 (ohne Attribute — die liegen nicht im Export),
Schablonen aus Abschnitt 5, über alle 2.984 Spieler in `oly-player-stats.json`:

| | |
|---|---|
| Unauffällig | 239 (8,0 %) |
| volles Podium (drei Plätze) | 1.819 (61 %) |
| zwei Plätze | 527 (18 %) |
| nur Platz 1 | 399 (13 %) |
| Passung auf Platz 1: Median / 10. Perzentil / 90. Perzentil | 0,73 / 0,53 / 0,93 |

| Platz 1 | Anteil | Platz 1 | Anteil |
|---|---:|---|---:|
| Hitzkopf | 12,5 % | Zauderer | 3,3 % |
| Rampensau | 8,8 % | Schlendrian | 2,5 % |
| Ehrgeizling | 8,8 % | Musterprofi | 2,2 % |
| Treue Seele | 7,8 % | Sportsmann | 1,9 % |
| Perfektionist | 7,6 % | Unbeugsamer | 1,5 % |
| Schlitzohr | 7,4 % | Anführer | 1,4 % |
| Söldner | 7,1 % | Einzelgänger | 1,4 % |
| Egomane | 5,8 % | Frohnatur | 1,3 % |
| Eisblock | 5,1 % | **Nörgler** | **0,6 %** |
| Mannschaftsspieler | 4,9 % | | |

Drei Lesarten: **Hitzkopf vorn** ist die Trait-Verteilung (Feisty 516, FiredUp 507), nicht die
Matrix — ein Spielerbestand, dem der Generator vorwiegend hitzige Traits gibt, hat eben viele
Hitzköpfe. **Musterprofi und Anführer selten** (2,2 / 1,4 %) ist richtig so; in FM sind es
ebenfalls die seltenen, wertvollen Typen, und Disciplined (161) und Fearless (141) gehören zu den
seltensten Traits. **Nörgler bei 0,6 %** ist der eine Befund, den man Chris sagen muss: der
Meckerer, den er explizit will, hat in den 36 Traits **kein eigenes Leittrait**. Vindictive,
Paranoid, Diva und Renegade sind die nächsten, und sie ziehen jeweils in eine andere Richtung mit.
Drei Antworten, in dieser Reihenfolge: die Schablone lockern (TEM+ 2 → 1), was den Nörgler auf
rund 3 % hebt, aber unschärfer macht; den Nörgler als häufigen **Platz 2** akzeptieren (ein
Hitzkopf mit Nörgler auf Platz 2 ist genau der Spieler, der nach dem Foul noch mit dem
Schiedsrichter diskutiert); oder ein 37. Trait „Grumbler" — das wäre das einzige neue Datenfeld,
und Chris hat „keine neuen Felder ohne Not" gesagt. Ich empfehle die zweite.

### 6.4 Sieben Spieler aus dem Bestand, durchgerechnet

Traits und Klasse, ohne Attribute (Züge in Klammern nur, wo sie das Ergebnis tragen):

| Spieler | Traits | Platz 1 / 2 / 3 (Passung) |
|---|---|---|
| **Cloud Strife** (Berserker) | Motivated, FanFavorite, Ambitious / Egomaniac, Diva | **Egomane** 1,00 · Ehrgeizling 0,73 · Rampensau 0,67 — TEA −65, RAM +80, EHR +75: der Star, der alles an sich reißt |
| **Sir Varrus** (Berserker) | FiredUp, Diligent / Egomaniac | **Perfektionist** 0,77 · Egomane 0,75 · Ehrgeizling 0,67 — dichtes Podium; mit Torment aus den Attributen kippt es Richtung Egomane |
| **Thraxis** (Berserker) | Healthy / Egomaniac, Scandalous, ColdBlooded | **Egomane** 0,85 · Rampensau 0,70 · Eisblock 0,60 — kalt, laut, allein: der Spannungsfall „Maulheld" entfällt, weil NER +40, nicht negativ |
| **Johanna** (Templar) | Loyal, Motivated, Fearless / FaintHearted, Obsessive | **Perfektionist** 0,85 · Unbeugsamer 0,60 · Treue Seele 0,57 — Fearless und FaintHearted heben sich auf (NER −10); übrig bleibt die Obsessive-Professionalität |
| **Lulu** (Bard) | Loyal, Caring / FaintHearted | **Treue Seele** 0,73 · Mannschaftsspieler 0,67 · Zauderer 0,53 |
| **Tidesprinter** (Berserker) | Ambitious, Flexible, FiredUp / Gambler, Cheater | **Hitzkopf** 0,87 · Hasardeur 0,75 · Schlitzohr 0,73 — FAI −50: der unfaire Hitzkopf, Spannungsfall „Ohne Bremse" |
| **Zed** (Berserker) | Flexible, Altruistic / Manipulative, Egomaniac | **Unauffällig** — kein Zug über ±25: Altruistic (+35 TEA) und Egomaniac (−40 TEA) heben sich auf |

Zed ist der wichtige Fall. Die erste Fassung hätte ihn per Gleichstand Egomane **oder**
Mannschaftsspieler genannt — beides falsch. Die Züge sagen: ein Spieler, dessen Traits sich
widersprechen, ist nicht durchschnittlich, sondern **zerrissen**. Deshalb der Marker:

**Widerspruchs-Marker.** Ziehen zwei Traits eines Spielers denselben Zug um jeweils ≥ 25 in
entgegengesetzte Richtungen, bekommt er den Beinamen „zerrissen (Teamgeist)" — unabhängig vom
Podium. Mechanisch ist er der Spannungsfall „Zerrissener" (7.3): die Moral entscheidet, welche
Seite gerade gilt. Im Bestand trifft das nach der Matrix rund 4 % der Spieler, am häufigsten
über Teamgeist (Loyal/Altruistic gegen Egomaniac/Diva) und Nerven (Fearless gegen FaintHearted).

---

## 7. Die Regler und die Kombinationslogik

### 7.1 Zehn Regler, aus den Zügen berechnet

    Regler = clamp(50 + 0,5 · Σ w_k · Z_k, 5, 95)        Σ |w_k| = 1

| Regler | Formel (Gewichte auf den Zügen) | Frage | Wo er greift |
|---|---|---|---|
| **Kontakt** | 0,5·TEM + 0,3·NER − 0,2·FAI | Wie oft sucht er den Körperkontakt? | Hockey Bodycheck-Suchrate, Bahn `willTackeln`, Basketball Steal-Druck, Football Tackle-Winkel, Eiskunstlauf-Rempler (sobald vier auf dem Eis) |
| **Härte** | 0,5·TEM − 0,5·FAI | Wie weit über die Grenze? | Hockey `HK_FOUL_ANTEIL` je Spieler, Fechten Angriff-in-Vorbereitung, Breaking Peiniger-Dosis |
| **Rollentreue** | 0,4·PRO + 0,4·TEA − 0,2·RAM | Folgt er dem Slot? | Slot-Profil-Mischung (10.2), Staffel-Marke, Battlefield-Punktwahl |
| **Wagnis** | 0,4·EHR + 0,3·TEM + 0,3·RAM | Nimmt er die riskante Option? | Gewichtheben Zielgewicht, Risk Segment, Gambit, Netzangriff, Takeshi-Durchbruch |
| **Nerven** | 1,0·NER | Unter Druck besser oder schlechter? | Tiebreak, dritter Versuch, Photo Finish, Schlussphase (8.5) |
| **Teamzug** | 0,7·TEA + 0,3·LOY | Eigene Aktion oder die fürs Team? | Pass vor Abschluss, Sandsack-Plan, „Schild"-Rempler |
| **Trainingseifer** | 0,6·PRO + 0,4·EHR | Lernbereitschaft | ersetzt perspektivisch `HART_BIAS_TRAITS`/`LEICHT_BIAS_TRAITS` und `TRAINING_FORM_*_TRAITS` |
| **Reizbarkeit** | 0,4·TEM + 0,4·RAM − 0,2·LOY | Nörgelt er, drückt er Moral? | Moral-Gründe (`addReason`), Rivalitäten-Ereignisse (10.3) |
| **Bindung** | 0,7·LOY − 0,3·EHR | Bleibt er? | ersetzt perspektivisch die Loyal/Mercenary-Abfragen in Moral und Vertrag |
| **Medienlust** | 0,7·RAM + 0,3·FUE | Sucht er Öffentlichkeit? | Popularität (`cosmetic-trait-soft-effects.ts`), Presse-Ereignisse, Sponsor-Ziele |

Was **nicht** darunter ist, mit Absicht: Zusammenhalt und Bindung der Arena (Handwerk seit
02.10.). Determination fließt deshalb in Rollentreue und Nerven, nicht in die Arena-Bindung,
obwohl „Tunnelblick" dort naheliegt.

### 7.2 Die Regler je Persönlichkeit (typischer Vertreter)

Berechnet aus einem Prototyp-Zugvektor je Schablone; ein echter Spieler weicht davon ab, weil
seine übrigen Züge mitreden — das ist der Sinn der Konstruktion.

| Persönlichkeit | Kontakt | Härte | Rollentreue | Wagnis | Nerven | Teamzug | Training | Reizbarkeit | Bindung | Medien |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Musterprofi | 41 | 30 | 73 | 49 | 65 | 64 | 80 | 38 | 53 | 50 |
| Perfektionist | 59 | 58 | 64 | 68 | 50 | 50 | 83 | 58 | 41 | 52 |
| Ehrgeizling | 56 | 53 | 50 | 72 | 60 | 37 | 76 | 60 | 23 | 60 |
| Anführer | 52 | 40 | 66 | 60 | 75 | 74 | 70 | 48 | 58 | 70 |
| Mannschaftsspieler | 40 | 33 | 75 | 44 | 50 | 86 | 59 | 38 | 64 | 45 |
| Treue Seele | 44 | 38 | 64 | 40 | 55 | 77 | 52 | 34 | 83 | 43 |
| Söldner | 54 | 55 | 48 | 58 | 55 | 30 | 61 | 59 | 14 | 50 |
| Egomane | 63 | 63 | 26 | 72 | 60 | 16 | 57 | 69 | 32 | 71 |
| Rampensau | 61 | 58 | 30 | 70 | 65 ¹ | 37 | 45 | 73 | 40 | 83 |
| Nörgler | 65 | 68 | 33 | 69 | 45 | 34 | 43 | 76 | 35 | 66 |
| Hitzkopf | 78 | 84 | 43 | 68 | 55 | 47 | 48 | 69 | 47 | 54 |
| Eisblock | 44 ² | 30 | 61 | 37 | 93 | 50 | 64 | 30 | 49 | 41 |
| Unbeugsamer | 65 | 53 | 62 | 63 | 85 | 60 | 72 | 52 | 50 | 55 |
| Hasardeur | 67 | 70 | 33 | 67 | 65 | 35 | 46 | 65 | 34 | 61 |
| Schlitzohr | 65 ³ | 71 | 45 | 55 | 70 | 37 | 56 | 50 | 39 | 48 |
| Sportsmann | 36 | 21 | 64 | 46 | 55 | 67 | 59 | 42 | 57 | 52 |
| Frohnatur | 38 | 28 | 48 | 43 | 70 | 62 | 40 | 45 | 57 | 66 |
| Schlendrian | 44 | 43 | 34 | 34 | 55 | 50 | 15 | 42 | 58 | 44 |
| Zauderer | 31 | 43 | 56 | 33 | 8 | 57 | 42 | 36 | 63 | 30 |
| Einzelgänger | 51 | 48 | 55 | 36 | 60 | 35 | 56 | 32 | 47 | 16 |

¹ Rampensau: Nerven 65 nur im Spotlight (Clutch-Slot, Schlussphase, Tiebreak), sonst 35.
² Eisblock: Kontakt gilt nur bei Erfolgschance ≥ 0,5 (Hockey `wucht` ≥ 0,20, Bahn `stark` ≥ 0,5);
darunter 20. Das ist keine Formel, sondern die eine Situationsregel seiner Schablone.
³ Schlitzohr: Entdeckungsquote (Strafe je hartem Kontakt) um ein Drittel niedriger.

Drei Prüfungen auf der Tabelle: **Kein Regler ist bei einer Persönlichkeit in jeder Disziplin
schlechter** — Härte 84 kostet Strafen und bringt in Hockey und Breaking den Gegner aus dem
Tritt; Trainingseifer 15 ist nur außerhalb des Spiels schlecht und kostet den Schlendrian im Spiel
nichts (10.2, Regel 3). **Nerven 8 beim Zauderer** ist der eine Wert, der nirgends gut ist —
der Preis seiner Rollentreue 56 und seines niedrigen Wagnisses, die ihn in Lese-Slots tragen;
offene Frage 6 bleibt. **Die Spreizung ist kleiner als in der ersten Fassung** (Kontakt 31–78
statt 15–90), weil Züge mitteln; das Stellrad in 10.1 kann sie wieder aufziehen.

### 7.3 Kombination: Züge mischen, Spannungsfälle erzählen

Die Kombination aus Platz 1 und 2 fließt **immer** ein — nicht als Mischung zweier Namen,
sondern weil beide Namen aus denselben Zügen entstanden sind, die die Regler stellen. Das ist
die technische Antwort auf Chris' „die Kombination muss in die Berechnung". Die erzählerische
Antwort sind die **Spannungsfälle**: Paare aus Platz 1 und 2, die eine Zusatzregel bekommen,
weil die Züge allein das Interessante daran verschlucken würden (ein Egomane mit Zauderer auf
Platz 2 hätte Kontakt 47 — langweilig; der Maulheld ist es nicht).

| Platz 1 + Platz 2 | Name | Die eine Zusatzregel |
|---|---|---|
| Egomane + Zauderer | **Maulheld** | Kontakt nur gegen Gegner mit niedrigerer Wucht/Abwehr; unter Druck gilt die Zauderer-Seite |
| Egomane + Hitzkopf | **Rowdy-Star** | Rempler bevorzugt gegen den eignungsbesten Gegenspieler; nach kassiertem Check 60 % Vergeltung in 10 s |
| Egomane + Anführer | **Alphatier** | Als Kapitän oder im Führungs-Slot (Shotcaller, Floor General, Captain Line, Commander, Stage Lead) Rollentreue 70 / Teamzug 55; sonst Egomane pur |
| Egomane + Mannschaftsspieler, oder Marker „zerrissen" | **Zerrissener** | Moral ≥ 60: Mannschaftsspieler-Werte; < 40: Egomane-Werte; dazwischen die Züge. Der einzige Charakter, der sich in einer Saison sichtbar dreht |
| Eisblock + Hitzkopf | **Vollstrecker** | Kontakt 75 unter der Eisblock-Bedingung (nur bei guter Chance), Härte 35 — wenige, sitzende, saubere Checks |
| Perfektionist + Zauderer | **Grübler** | Nerven 20 unter Druck, aber 60 in Technik-Slots (Technician, Safe Lift, Lane Control, Route Reader, Baton Tech, Calculation Core) |
| Rampensau + Söldner | **Auftragskünstler** | Spotlight gilt nur an den letzten drei Spieltagen und in Playoffs; sonst Söldner pur |
| Hasardeur + Unbeugsamer | **Ohne Bremse** | Wagnis 90 bleibt; nach gescheitertem Wagnis sofort der nächste Versuch |
| Nörgler + Treue Seele | **Grantler mit Herz** | Reizbarkeit bleibt (meckert über Aufstellung und Training), aber Bindung 75: er geht nie, und seine Moral-Kritik trifft die Mitspieler nur halb |
| Musterprofi + Nörgler | **Besserwisser** | Trainingseifer 80 bleibt; Reizbarkeit 65 richtet sich gegen den **Manager**, nicht gegen Mitspieler — kritisiert Aufstellungen öffentlich (Medien-Ereignis), ohne die Teammoral zu drücken |
| Anführer + Söldner | **Profi-Kapitän** | Ausstrahlung (7.4) nur bei Moral ≥ 55 |
| Schlitzohr + Zauderer | **Heimlicher** | Kontakt nur gegen Gegner, die ihn nicht sehen (von hinten, am Engpass); Entdeckungsquote halbiert |
| Frohnatur + Schlendrian | **Kumpeltyp** | Trainingseifer 30, aber Teamklima +: senkt die Reizbarkeit aller Mitspieler um 5 (sie meckern weniger) — der Spieler, den man wegen der Kabine behält |

Alle anderen Paare laufen über die Züge ohne Sonderbehandlung — und das reicht, weil die Züge
bereits mischen.

### 7.4 Anführer-Ausstrahlung

Ein Anführer auf Platz 1 hebt die Rollentreue aller Mitspieler auf dem Feld um 5, als Kapitän um
10, und senkt ihre Reizbarkeit um 5. Der einzige Regler, der über den eigenen Spieler hinausreicht,
und er bleibt klein. `team-captain-service.ts` zählt heute Eloquent, Motivated, Ambitious,
Disciplined, Resourceful, Loyal — die Führung-Spalte der Matrix liest dieselben Traits; Kapitänswahl
und Charakter passen von selbst zusammen. Perspektivisch liest die Kapitänswahl FUE direkt.

---

## 8. Konkrete Anwendung: Rempler und Tackling

### 8.1 Die Grenze, die alles entscheidet

Ein Rempler hat im Motor drei Teile, sauber getrennt:

| Teil | Hockey (`versucheSteal`, ~15058) | Bahn (`stepSpurt`, ~48859) |
|---|---|---|
| Gelegenheit → Versuch | jede Deckungssituation am Puckführer (121,5 je Spiel, `hockey-ausdauer-checks-konzept-13-09.md`) | `willTackeln · dt · tackleRate`, nur über `tackleAb` (WUCHT-Schwelle), nur mit Gegner in Reichweite |
| Versuch → sitzt | `wucht = clamp(0,16 + (ABWEHR − AUSDAUER_wirk) · 0,004, 0,04, 0,45)` | `stark = WUCHT / (WUCHT + ROBUST)` |
| sitzt → Strafe | `HK_FOUL_ANTEIL = 0,38` | — |

**Die Persönlichkeit darf den ersten und den dritten Teil anfassen, nie den zweiten.** Ob ein
Check sitzt, entscheiden die Attribute — das ist die Matrix. Ein Hitzkopf mit schwacher ABWEHR
versucht es öfter und scheitert öfter; das kostet ihn (`decker.lunge`, Puste; Abklingzeit,
`tackleKosten`) und ist das Bild eines Hitzkopfs, der sich verrennt. Ein Eisblock versucht es
seltener und sitzt öfter. Beides Charakter, keins ein Attributbonus.

### 8.2 Die Formel

    Suchfaktor   S(p) = 0,4 + 1,2 · Kontakt/100          → 0,4 … 1,6
    Härtefaktor  H(p) = 0,5 + 1,0 · Härte/100            → 0,5 … 1,5

Hockey: die Bodycheck-Gelegenheit wird vor dem `wucht`-Wurf mit `rr() < S(decker)/S_mittel`
gefiltert; die Strafquote wird `HK_FOUL_ANTEIL · H(decker)`. Bahn: `willTackeln := 0,55 · S(u)`
(0,55 ist der heutige Duellant-Wert, die Mitte).

**Normierung über den Kader.** `S_mittel` ist das Mittel von S über beide Spieltags-Kader. Die
**Gesamtzahl** der Checks je Spiel bleibt bei den gemessenen 16, nur die Verteilung auf die
Spieler ändert sich. Ohne Normierung stiege die Dichte, weil Hitzkopf die häufigste Persönlichkeit
ist (12,5 %) — und wir sind auf die Uhr gerechnet schon fünfmal so check-dicht wie die NHL.
Mehr Checks will niemand; andere Checker schon. Opus' Machbarkeitsdokument (5.3, „Normieren
statt addieren") kommt unabhängig zum selben Schluss.

### 8.3 Vier Persönlichkeiten im Eishockey, durchgerechnet

Basis: 121,5 Gelegenheiten, 16,0 sitzende Checks (13,2 %), 5,5 abgepfiffen, 10 Feldspieler →
**1,6 Checks je Skater**, 0,55 Strafen. Kader mit S_mittel ≈ 1,0, mittlere Attribute (wucht im
Mittel 14,4 %, gemessen). Regler aus 7.2.

| Persönlichkeit | Kontakt / Härte | S / H | genutzte Gelegenheiten | sitzende Checks je Spiel | Strafen | Trefferquote | Was man sieht |
|---|---:|---:|---:|---:|---:|---:|---|
| Unauffällig | 50 / 50 | 1,00 / 1,00 | 12,2 | **1,6** | 0,55 | 13,2 % | wie heute |
| **Hitzkopf** | 78 / 84 | 1,34 / 1,34 | 16,3 | **2,1** | **1,0** | 13,2 % | checkt an jeder Bande, fast jedes Spiel eine Strafe; läuft bei schwacher ABWEHR ins Leere |
| **Zauderer** | 31 / 43 | 0,77 / 0,93 | 9,4 | **1,2** | 0,4 | 13,2 % | weicht aus; dafür mehr Stockchecks (der andere Zweig läuft weiter) |
| **Eisblock** | 44 ² / 30 | 0,93 / 0,80 | 11,3 → nur bei wucht ≥ 0,20: ~4,9 ⁴ | **1,3** | 0,4 | **~24 %** | wenige, sitzende Checks — höchste Quote im Spiel bei derselben Formel: er wählt die Gelegenheiten, in denen ABWEHR klar über AUSDAUER liegt |
| **Egomane** | 63 / 63 | 1,16 / 1,13 | 14,2, bevorzugt am gegnerischen Star | **1,9** | 0,7 | 13,2 % | checkt den Topscorer, nicht den Nächsten; als Rowdy-Star die Vergeltung |

⁴ Annahme: rund 43 % der Gelegenheiten liegen über wucht 0,20, mit mittlerer wucht 0,26 — die
Verteilung über die Spanne 0,04–0,45 ist nicht gemessen, nur ihr Mittel. Die Eisblock-Zeile ist
die unsicherste.

Die Trefferquote bleibt bei drei von vier bei 13,2 %, weil die Persönlichkeit den `wucht`-Wurf
nicht anfasst. Der Eisblock ist der eine Fall, in dem sie steigt — nicht durch Bonus, sondern
durch **Auswahl**: derselbe Attributsatz, ein anderer Weg, ihn einzusetzen (Chris' Mehrwege-Linie).

### 8.4 Dasselbe auf der Bahn (Spurt, Staffel, Takeshi)

| Persönlichkeit | heute (Kampfstil) | neu `0,55 · S` | relativ |
|---|---:|---:|---:|
| Hitzkopf | 0,90 (Draufgänger) | 0,74 | ×1,34 |
| Egomane | 0,55 (Duellant) | 0,64, bevorzugt gegen den Führenden | ×1,16 |
| Mannschaftsspieler | 0,5 (Beschützer, fehlt in der Tabelle) | 0,48, als „Schild": nur gegen Gegner, die den eigenen Läufer bedrängen | ×0,88 |
| Eisblock | 0,55 | 0,51, nur bei `stark ≥ 0,5` | ×0,93, halb so viele Fehlversuche |
| Zauderer | 0,5 (Schleicher) | 0,42 | ×0,77 |
| Musterprofi | 0,25 (Bollwerk) | 0,49 | ×0,89 |

Die WUCHT-Schwelle `tackleAb` bleibt. Ein Zauderer mit WUCHT 70 rempelt selten, aber mit
Wirkung; ein Hitzkopf mit WUCHT 30 rempelt nie, weil er es nicht kann — und der Ticker darf das
sagen. Mit dem Umzug von `willTackeln` in die Regler erledigt sich der Takeshi-Nebenfund
(Beschützer fehlt, `taktiker` ist tot). Die Spreizung (×0,77 bis ×1,34) ist enger als die alte
Tabelle (0,25 bis 0,90) — das ist der Preis der Züge-Mittelung, und das Stellrad (10.1) ist der
Knopf dafür.

### 8.5 Nerven: die Druckformel

    unter Druck:  Erfolgschance_wirk = Erfolgschance · (1 + 0,25 · (Nerven − 50)/50)

Eisblock (93) +21,5 %, Zauderer (8) −21 %, Anführer (75) +12,5 % — nur im Druckmoment, den die
Disziplin definiert (Tiebreak, dritter Versuch, letzte zwei Minuten bei einem Tor Abstand, letzte
Falle). Die erste Fassung hatte 0,15 als „kleinsten Faktor"; nach Chris' zweiter Runde (Varianz
gewollt) startet er bei 0,25. Über ein Spiel ist das ein Bruchteil eines Eignungspunkts; im
Moment, in dem es zählt, sichtbar. **Nerven ist der einzige Regler, der direkt an eine
Erfolgschance geht** — deshalb wird er als Erstes gegen rho gemessen.

### 8.6 Disziplin-Vorzeichen

Dieselbe Persönlichkeit, andere Wirkung, ohne zweite Tabelle: jede Disziplin erklärt, welche
Regler sie liest (`charakter:["kontakt","haerte","rollentreue","nerven"]`, Muster
`ARENA_ART[d].persHandwerk`), und definiert selbst, was Druck, Spotlight und Gelegenheit heißen.
Schach liest Nerven und Wagnis, aber keinen Kontakt; Wettessen keinen Teamzug. Ein Hitzkopf ist
auch im Schach ein Hitzkopf — dort liest es nur niemand ab, und der Picker sagt das.

---

## 9. Anzeige — FM-Transparenz, Momentaufnahme und Historie

Dieselben fünf Zustände wie überall (`formatMarketDevelopmentTrend()`: `++ / + / 0 / − / −−`;
`.tchip.auf`/`.tchip.ab`; `nl-lineup-chip is-<tone>`), dieselbe Regel wie im
Oberflächen-Konzept: Glyphe, Farbe und Text immer zusammen. Ein Unterschied bleibt wesentlich:
**ein Charakter-Chip sagt nie eine Eignungszahl.** Er sagt, was der Spieler tut.

### 9.1 Die Persönlichkeitszeile — das Podium

Im Kader und im Spieler-Drawer (Stage A des `PlayerDetailDrawer`), unter Klasse und Unterklassen:

    1. Egomane (100 %)  ·  2. Ehrgeizling (73 %)  ·  3. Rampensau (67 %)
    kein Spannungsfall (Platz 2 ist Ehrgeizling)
    wegen: Egomaniac, Diva, FanFavorite, Ambitious · Berserker

Tooltip: die neun Züge als Balken (−100…+100) mit den Traits, die sie bewegt haben — das ist
unser „Coach Report". Spannungsfall-Beiname und Widerspruchs-Marker stehen in der zweiten Zeile.
Unauffällige Spieler bekommen keine Zeile.

### 9.2 Regler-Chips im Picker — nur die, die die Disziplin liest

| Regler | `++` (≥ 80) | `+` (65–79) | `0` (36–64, ausgeblendet) | `−` (21–35) | `−−` (≤ 20) | Tooltip-Beispiel (`−−`) |
|---|---|---|---|---|---|---|
| Rollentreue | „Rolle ++" | „Rolle +" | — | „Rolle −" | „Rolle −−" | „Hält Hold Line nur zu 26 %, spielt 74 % sein eigenes Spiel: sucht Abschlüsse." |
| Kontakt | „Rempelt ++" | | | | „Rempelt −−" | „Weicht Zweikämpfen aus (1,2 Checks je Spiel statt 1,6)." |
| Härte | „Hart ++" | | | | „Hart −−" | „Geht über die Grenze: rund doppelt so viele Strafen." |
| Wagnis | „Risiko ++" | | | | „Risiko −−" | „Nimmt immer die sichere Option." |
| Nerven | „Nerven ++" | | | | „Nerven −−" | „Bricht unter Druck ein (−21 % im Tiebreak)." |
| Teamzug | „Team ++" | | | | „Team −−" | „Spielt für sich: Abschluss vor Pass." |

**Farbe ist Richtung, nicht Wertung.** `Rempelt ++` ist in Hockey grün, in Eiskunstlauf rot —
die Disziplin legt je Regler fest, welche Richtung sie als Vorteil färbt. `Rolle −−` ist **nie**
rot, sondern bernstein (`--warn`): Abweichung, kein Nachteil (10.2). Die vier Regler außerhalb
des Spiels (Trainingseifer, Reizbarkeit, Bindung, Medienlust) erscheinen nicht im Picker, sondern
im Drawer bei Training, Moral und Vertrag — dort, wo sie wirken.

### 9.3 Slot-Passung: der Spannungs-Hinweis

Chris' Beispiel — Egomane im Team-Slot — bekommt im Picker eine Zeile unter dem Slot, sobald
Rollentreue ≤ 35 **und** der Slot ein Team-Slot ist (Fokusattribute in
`matchday-slot-roles.ts` enthalten Spirit oder Charisma und der Text spricht vom Team: Rally
Point, Help Defense, Morale Anchor, Tempo Link, Captain Line — eine Handvoll Namen je Disziplin):

    ⚠ Egomane im Team-Slot: hält die Rolle zu 26 %, spielt 74 % sein eigenes Profil.
      Projiziert: 61 Pkt (Rolle) → 58 Pkt (sein Spiel). Alternative: Clutch Shot 66 Pkt.

Beide Zahlen aus derselben Slot-Profil-Mischung (10.2), die der Motor liest. Information, kein
Verbot.

### 9.4 Historie: was FM hat und wir noch nicht

Chris: „Das ist ja nicht bei Fußballmanager, will ich ja auch sehen. Wie sind die Statistiken vom
Spieler? Seine Durchschnittsnoten und so." Abschnitte 9.1–9.3 sind eine **Momentaufnahme**; die
Historie fehlt, und die Lücke ist schon beschrieben: `kampfwerte-anzeige-und-diszi-alltime-statistik-03-11.md`
Teil 2 — je Spieler und Disziplin gibt es `playerDisciplinePerformances` (je Spieltag) und
`laufbahn`-Zähler (je Saison; `mergeLaufbahnCounters` summiert auch **unbekannte** Schlüssel,
das ist die Erweiterungsstelle), aber der Weg vom Boxscore in den Spielstand trägt nur
`{name, wert, torwart?}` (`arena-headless-runner.ts` 550).

Vorschlag, fünf neue `laufbahn`-Schlüssel: `rempler`, `gerempelt`, `strafen`, `rollentreueSumme`
(gemessener Anteil der Aktionen im Slot-Sinn, je Einsatz) und `charakterMomente` (wie oft eine
Spannungsfall-Regel gegriffen hat) — dazu je Einsatz der **eine prägende Moment** als kurzer
Text, wie `spielerDesSpieltags` heute. Die Durchschnittsnote haben wir: `finalPlayerScore`/PP je
Einsatz. Was FM darüber hinaus hat, ist das **Warum** je Spiel, und das ist der prägende Moment.
Anzeige in der All-Time-Diszi-Statistik (Stufe A/B jenes Dokuments) als Zeile „Charakter":
„Rempler 2,3/Spiel · Strafen 0,8 · Rollentreue 64 % · 5 Alleingänge, 3 davon erfolgreich". Die
Hockey-Spalte `Chk` (~46267) und Footballs `Tkl` existieren schon; Strafen je Spieler fehlen.
Damit kann Chris nach einer Saison nachlesen, ob der Rowdy-Star den Scheiß gerockt hat.

### 9.5 Arena, Ticker, Boxscore, und was unverändert bleibt

Die Trait-Chip-Zeile der Arena (`tchip`, ~37497) bekommt das Podium als ersten Chip
(`Egomane·Ehrgeizling`) und die gelesenen Regler dahinter; das Taktik-Panel zeigt den Kampfstil
weiter darüber. Ticker-Zeilen, wo der Charakter die Entscheidung erklärt („Thraxis lässt die
Linie stehen und geht auf Kiti.", „Zed wartet, bis der Schiedsrichter wegschaut."). Kaderwert,
Transfermarkt-Linse, Teamstärke, KI-Kauf lesen weiter die Matrix. Die KI-Aufstellung
(`LineupAiPreviewPanel`) rechnet die Slot-Profil-Mischung genauso wie der Picker — sonst hätte
der Mensch Wissen, das die KI nicht hat.

---

## 10. Governance, Rollentreue, Rivalitäten — und die ehrliche Einschätzung

### 10.1 Varianz ist gewollt; die Dosierung ist ein Stellrad

Chris, zweite Runde: „Vielleicht ist es in der Hinsicht gut, dass er plötzlich andere Kräfte
entwickelt und alles an sich reißt, aber damit auch den Scheiß rockt. Oder es kann halt sein,
dass er alles alleine machen will und das grandios scheitert." Die Persönlichkeit **soll** ein
Spiel drehen können. Die Schranken aus `CLAUDE.md` bleiben das Abnahme-Maß — für die **gewählte
Dosierung**, nicht als Verbot jeder Verschiebung.

Das Stellrad: ein Faktor `charakterStaerke` je Disziplin, 0…1,

    Regler_wirk = 50 + charakterStaerke · (Regler − 50)

1,0 ist Abschnitt 7.2, 0 ist „alle Unauffällig" und zugleich die Nullprobe. **Startwert 1,0** —
Chris will die volle Wirkung sehen und dann herunterdosieren, und eine halbe Dosierung liefert in
der ersten Messung nur halbe Befunde. Die Kriterien A–F aus `arena-zielwahl-opus-empfehlung-02-10.md`
bleiben die Messbank (zwei Saatströme, kaderfest, Star/Top 2/Paare ≥ 15, Pp ≤ Ist + 6); neu ist,
was bei Verfehlen passiert: Rad auf 0,7, messen, 0,5 — und erst wenn 0,5 reißt, der Regler aus.
**Hart bleibt die Team-Ergebnistreue** (ein klar überlegenes Team gewinnt weiter rund 95 %):
„grandios scheitern" muss ein **Spieler** können, nicht die Mannschaft als Münzwurf — sonst ist
die Varianz kein Charakter, sondern Rauschen. Und die Menge-Falle vom 02.10. gilt: jeder Regler
wird je Disziplin einzeln zugeschaltet, beginnend auf der Bahn, wo `willTackeln` schon gemessen
ist (Takeshi 0,859–0,861), dann Hockey, dann Arena. Ein konkreter Fall, den die Messung sehen
wird: Football zählt Tackles mit 0,15 in der Spielerwertung (`u.checks*0.15`, ~12001) — dort
kauft Kontakt direkt Wert; Hockey hat denselben Term am 13.09. gestrichen, Football müsste es vor
dem Kontakt-Regler ebenfalls.

### 10.2 Strafe oder Charakter — Rollentreue als Mischung

Das Risiko, das Chris' Auftrag selbst benennt: der Egomane spielt im Team-Slot systematisch
schlechter, und der Manager lernt nur, Traits zu meiden. Fünf Regeln; die erste entscheidet:

1. **Rollentreue ist eine Mischung, kein Abzug.**

       Profil_wirk = R · Profil_Slot + (1 − R) · Profil_eigen          R = Rollentreue/100

   `Profil_eigen` ist das Profil, in dem der Spieler von sich aus am stärksten ist (seine zwei
   höchsten Matrix-Attribute dieser Disziplin als Fokus, gebaut wie ein Slot-Thema). Ein Egomane
   mit Spitzenwerten in Power und Torment, in Rally Point gesetzt, spielt zu 74 % Breaker. Ist er
   dort besser, ist das für den Slot ein Gewinn — er liefert nur nicht, was bestellt war. Ist er
   es nicht, ein Verlust. Der Picker zeigt beide Zahlen (9.3). Opus (5.4) beschreibt dasselbe
   von der anderen Seite: „Abweichen kostet das Team, nicht zwingend den Spieler" — der starke
   Egoist sammelt mehr, der schwache schadet dem Team-Ergebnis. Beides ist die Erzählung, die
   Chris will.
2. **Jede Persönlichkeit hat einen Ort, an dem sie die beste Wahl ist.** Egomane: Clutch Shot,
   Final Attempt, Photo Finish. Zauderer: Trap Reader, Route Reader, Pattern Read. Hitzkopf:
   Power Forward, Aggressor, Line Power. Perfektionist: Technician, Safe Lift, Baton Tech.
   Schlendrian: der Slot, in dem Training nichts zählt und Nerven 55 reichen. Die Umsetzung
   bestätigt das je Disziplin.
3. **Kein Regler darf eine Richtung haben, die überall schlechter ist** (Designregel 3 aus PR
   #1118). Die Nerven sind die Ausnahme (7.2); Frage 6.
4. **Der Manager hat Gegenmittel.** Kapitän (Ausstrahlung), Moral (Zerrissener, Söldner),
   Slotwahl (9.3), die Haltungs-Achse aus PR #1118, sobald gebaut.
5. **Die Größen sind gedeckelt.** Rollentreue nie unter 25 (Clamp), Nerven ±22,5 % nur im
   Druckmoment, Suchfaktor 0,4–1,6 über den Kader normiert. Ein Stat-80-Spieler bleibt mit jeder
   Persönlichkeit ein Top-Spieler.

### 10.3 Rivalitäten und Moral — nur eingeordnet

Chris: Persönlichkeits-Reibung soll ein früher angedachtes Rivalitäten-System befüttern und die
Moral beeinflussen („ein Egomaniac, der ständig Teamkollegen anrempelt"). Was es gibt:
`lib/rivalries/` ist **Team**-Ebene — statische `TeamRelationshipRecord`s, ein abgeleitetes
Ereignis-Ledger, im Resolve als Rivalitäts-Abzug und Captain-„Ruhepol" gelesen;
`team-abilities-redesign.md` hat dynamisches Schreiben als „tiefer Eingriff" eingestuft.
Spieler-Rivalitäten gibt es nicht; Moral ist abgeleitet, nimmt aber benannte Gründe (`addReason`)
entgegen — die Anschlussstelle. Was die Regler liefern, ohne dass dieses Konzept das System
baut: **Reibungs-Ereignisse** aus dem Motor, wenn Regler zweier Spieler derselben Seite
kollidieren — *übergangen* (Teamzug ≤ 25 nimmt den Abschluss, obwohl ein Mitspieler frei stand),
*angerempelt* (Härte ≥ 70 trifft im Gedränge den eigenen Mann; `tackleAlleSeiten` existiert,
abgeschaltet), *Führungskonflikt* (zwei mit FUE ≥ +50 und TEA ≤ 0 in einer Aufstellung),
*gemeckert* (Reizbarkeit ≥ 70 nach einer Niederlage oder Bankplatz — der Nörgler-Kanal). Jedes
Ereignis schreibt einen Moral-Grund beim Betroffenen (Zauderer und Treue Seele verlieren mehr,
Eisblock nichts) und wird im Ledger gezählt. Wer mit wem reibt, folgt aus den Zügen: hohes
Temperament gegen niedrige Nerven, niedriger Teamgeist gegen hohe Führung; wer trägt: hohe Fairness,
hohe Loyalität, Frohnatur. Ledger, Verfall, Versöhnung, Anzeige sind das eigene Thema.

### 10.4 Wo das Konzept stark ist

- **Es ist gebaut, wie das Vorbild gebaut ist** — verdeckte Züge, benannte Typen als Etikett,
  Familien. Chris kann FM-Guides lesen und findet die Struktur wieder.
- **Alle 36 Traits, nichts Neues.** Keine neuen Felder; die Matrix ist eine Tabelle mit 36 Zeilen,
  die man in `references/` legen und von TS und engine.js gemeinsam lesen lassen kann (Opus 5.2,
  Weg a).
- **Widersprüche werden sichtbar statt weggewürfelt** (Zed). Das ist der eine Punkt, an dem die
  Züge einem Punktestapel je Name klar überlegen sind.
- **Gemessen, nicht geraten:** die Verteilung über 2.984 Spieler liegt zwischen 0,6 und 12,5 %,
  8 % Unauffällig, 61 % volles Podium — bevor eine Zeile Code existiert.
- **Sechs eigene Trait-Listen in Training, Moral, Vertrag, Kapitän, Popularität** könnten
  perspektivisch von vier Reglern abgelöst werden. Kein Auftrag, aber ein Aufräumgewinn, den die
  Züge nebenbei anbieten.

### 10.5 Wo es schwierig wird

- **Nörgler 0,6 %** — der Typ, den Chris ausdrücklich will, hat kein Leittrait (6.3). Entweder
  Platz-2-Typ oder ein 37. Trait; das muss Chris entscheiden.
- **Hitzkopf 12,5 %** ist die Trait-Verteilung des Generators, nicht der Matrix. Wenn jeder
  achte Spieler Hitzkopf ist, erklärt der Name wenig; die Antwort liegt im Generator
  (`traitHint`, Archetyp-Präferenzen), nicht in der Taxonomie.
- **Die Spreizung der Regler ist enger als mit Namens-Tabellen** (Kontakt 31–78). Züge mitteln.
  Das Stellrad kann über 1,0 gehen (1,3 = „überzeichnet"), wenn Chris nach der ersten Messung
  mehr Charakter sehen will — dann aber mit der Menge-Falle im Blick.
- **Zwei Schichten sind zwei Erklärungen.** Ein Spieler ist Bollwerk **und** Hitzkopf (Tank mit
  Feisty). Erklärbar, nicht elegant; die Übereinstimmungs-Stichprobe (Abschnitt 3) entscheidet,
  ob Ebene 0 irgendwann aus Ebene 1 abgeleitet wird.
- **Attribute je Disziplin** (4.3) heißt: ein Spieler hat eine Kader-Persönlichkeit und je
  Disziplin eine leicht andere. Das ist richtig (Torment zählt in Hockey, nicht im Schach), aber
  es muss erklärt werden — eine Zeile im Picker, und die Umsetzung muss zwei Zug-Sätze führen.
- **Spotlight und „große Spieltage"** brauchen Definitionen, die der Spielplan nicht als Daten hat.
  Erste Fassung: Clutch-Slots per Liste und letzte drei Spieltage; Derby/Playoff später.
- **Die Zahlen sind Startwerte.** 4.2 (Trait-Gewichte), 7.1 (Regler-Gewichte), 8.3 (Hockey)
  sind so gesetzt, dass die Persönlichkeiten sich unterscheiden und die Deckel halten. Ob ein
  Hitzkopf 2,1 oder 2,4 Checks bekommt, entscheidet die Kalibrierung.

---

## 11. Reihenfolge, wenn Chris freigibt

1. **Züge und Podium als reine Anzeige**, ohne Spieleffekt: Matrix in `references/`, Herleitung in
   `lib/personality/` (Opus 5.2), Persönlichkeitszeile im Kader, Drawer und in der Arena.
   Verteilungs-Sonde über Seed-Bestand und Kader-Familie, Übereinstimmung mit dem Kampfstil.
   Fingerabdruck byte-identisch. Das allein ist ein Gewinn: der Manager sieht, wen er hat.
2. **Kontakt und Härte auf der Bahn** (`willTackeln` → Regler), Takeshi/Spurt/Staffel, Abnahme
   gegen die 06.09.-Zahlen, `charakterStaerke` 1,0.
3. **Kontakt, Härte, Zielwahl in Hockey** mit Kader-Normierung, Strafen-Spalte im Boxscore,
   `laufbahn`-Zähler (9.4).
4. **Rollentreue als Slot-Profil-Mischung** in Picker, KI-Aufstellung und `slotAufschlag`, zuerst
   in einer Feldspiel-Disziplin, mit dem Spannungs-Hinweis.
5. **Nerven** in Bühnen-Disziplinen mit klarem Druckmoment, Faktor 0,25, erste rho-Messung.
6. **Die vier Regler außerhalb des Spiels** — Trainingseifer, Reizbarkeit, Bindung, Medienlust —
   zunächst parallel zu den bestehenden Trait-Listen, dann als deren Ersatz. Reibungs-Ereignisse
   als Moral-Gründe (10.3).
7. Spannungsfälle, Anführer-Ausstrahlung, Rampensau-Spotlight; Eiskunstlauf-Rempler, sobald die
   Vier-auf-dem-Eis-Frage (Opus, Abschnitt 4 seines Dokuments) geklärt ist.

---

## 12. Fragen an Chris

1. **Die zwanzig Namen.** Musterprofi, Perfektionist, Ehrgeizling, Anführer, Mannschaftsspieler,
   Treue Seele, Söldner, Egomane, Rampensau, Nörgler, Hitzkopf, Eisblock, Unbeugsamer, Hasardeur,
   Schlitzohr, Sportsmann, Frohnatur, Schlendrian, Zauderer, Einzelgänger. Welche stimmen nicht,
   welche fehlen? (Englisch wie die Traits wäre die Alternative — dann aber überall.)
2. **Nörgler** (6.3): als häufiger Platz 2 akzeptieren, die Schablone lockern, oder ein 37. Trait?
3. **Platz 3** nur Anzeige und Färbung über die Züge (6.2) — oder soll er eigene Regeln tragen?
4. **Attribute nur dort, wo die Matrix sie bezahlt** (4.3): ein Eiskunstläufer mit Torment 90
   wird dort nicht härter als sein Name sagt — einverstanden, oder Torment überall, Pp in Kauf?
5. **`charakterStaerke` startet bei 1,0** und wird nach der Messung heruntergedreht — oder bei
   0,7 anfangen und hochdrehen?
6. **Nerven nirgends gut beim Zauderer**: Preis seines Charakters, oder soll jede Persönlichkeit
   auf jedem Regler mindestens einmal die bessere sein?
7. **Rollentreue als Mischung** (10.2): Abweichung kann besser **oder** schlechter sein — ist das
   „er macht das nicht unbedingt", oder soll Abweichung immer etwas kosten?

---

## Geänderte Dateien dieser Runde

Nur dieses Dokument (vollständig neu geschrieben, zweite Fassung). Keine Änderung an
`lib/player-generator/official-discipline-weights.ts`, `public/mockups/battle-mode.engine.js`,
`leitePers()`/`PERS`/`PERSDEF`/`PERSZIEL`, `lib/rivalries/` oder irgendeiner Mechanik. Das
Wegwerf-Skript für die Verteilung in 6.3 liegt nicht im Repo; es ist aus 4.2, 4.4 und
Abschnitt 5 in zwanzig Zeilen rekonstruierbar und gehört als `scripts/miss-persoenlichkeits-verteilung.mjs`
in Stufe 1 der Reihenfolge.

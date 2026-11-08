# Persönlichkeits-Taxonomie: wie Charakter zu Verhalten wird — Konzept (08.11.)

Chris, 08.11., festgehalten in `docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`
(Teil 2): Tackling/Rempler sollen projektweit überall fallen, wo Spieler gegeneinander antreten,
und **wie oft** jemand rempelt, soll an seiner Persönlichkeit hängen — nicht am Zufall, nicht
gleichverteilt. Sein Beispiel, wörtlich: „Dieses Egomaniac fließt natürlich auch da rein, wie er
sich auf dem Schlachtfeld verhält... wenn er einen Slot hat, wo er teamfokussiert spielen soll,
aber er ist ein Egomaniac, dann macht er das zum Beispiel nicht unbedingt." Gewünscht ist eine
„Matrix", aus der sich aus Attributen, Traits und ggf. Klassen eine Haupt- und eine oder mehrere
Nebenpersönlichkeiten ergeben, und eine Regel dafür, wie die **Kombination** wirkt.

**Dieses Dokument ist reines Konzept.** Kein Code, keine Zahl darin ist gemessen; wo eine Zahl
aus dem Repo zitiert wird, steht die Quelle daneben. Es ist die kreative Hälfte des
Recherche-Auftrags (welche Persönlichkeiten, wie wirken sie); die technische Hälfte (wo im Code,
welche Datenpfade) macht ein paralleler Opus-Lauf. Die drei Schranken aus `CLAUDE.md` gelten
unverändert: die Eignungsmatrix bleibt byte-identisch, rho je Einzelspiel über 0,80, Pp-Abweichung
≤ 25. Das Oberflächen-Effekte-Konzept vom selben Tag (`oberflaechen-effekte-konzept-08-11.md`,
Teil 1 der Vision) ist ein **anderes** Thema — dort verschiebt der Ort die Gewichte, hier
verschiebt der Charakter die Entscheidungen. Nur die Anzeige-Konvention (Abschnitt 7) teilen sich
beide.

---

## Kurzfassung

- **Das Spiel hat schon eine Persönlichkeit, nur eine für den Kampf.** `leitePers()` in
  `public/mockups/battle-mode.engine.js` (~36760) leitet aus Klasse, Rasse, Unterklassen und Traits
  per Punktetabelle einen von sechs Kampfstilen ab — Bollwerk, Draufgänger, Duellant, Schleicher,
  Beschützer, Opportunist — und die steuern heute Zielwahl und Haltung in der Arena, die
  Tackle-Bereitschaft auf der Bahn (`willTackeln`, ~48859: Draufgänger 0,9 bis Bollwerk 0,25) und
  den Lastenplan im Sandsack-Finale. Das Konzept erfindet dieses Prinzip nicht neu, es baut es aus:
  **die sechs Kampfstile bleiben die taktische Schicht, darüber kommt eine Charakter-Schicht mit
  dreizehn Persönlichkeiten.**
- **Dreizehn Persönlichkeiten, jede an echte Traits gebunden.** Egomane, Rampensau, Anführer,
  Mannschaftsspieler, Raufbold, Dickschädel, Eisblock, Pedant, Hasardeur, Schlitzohr, Söldner,
  Phlegmatiker, Zauderer — plus „Unauffällig" als ehrlicher Rückfall für Spieler ohne Signal.
  Jedes der 36 kanonischen Traits (`CANONICAL_POSITIVE_TRAITS`/`CANONICAL_NEGATIVE_TRAITS`,
  `lib/training/class-progression-config.ts`) zahlt auf ein bis zwei davon ein (Abschnitt 3).
- **Persönlichkeit ist kein Wert, sondern ein Satz von sechs Reglern.** Kontakt, Härte,
  Rollentreue, Wagnis, Nerven, Teamzug — je 0 bis 100, Mitte 50. Eine Persönlichkeit ist eine
  Stellung dieser sechs Regler (Abschnitt 4). Der Motor liest die Regler, nie den Namen.
- **Haupt und Neben mischen 65/35, und zehn benannte Spannungsfälle bekommen eine eigene Regel.**
  Egomane + Zauderer ist der „Maulheld" (rempelt nur Schwächere), Egomane + Raufbold der
  „Rowdy-Star" (sucht gezielt den gegnerischen Star), Eisblock + Raufbold der „Vollstrecker"
  (wenige, aber sitzende Checks). Die Mischung allein wäre langweilig, die Spannungsfälle sind das,
  was man im Spiel wiedererkennt (Abschnitt 5).
- **Beim Rempler entscheidet die Persönlichkeit nur, WIE OFT jemand es versucht und WIE HART,
  nie, OB es sitzt.** Der Ausgang bleibt die bestehende Attributformel (Hockey: `wucht` aus ABWEHR
  gegen AUSDAUER, ~15070; Bahn: `stark = WUCHT/(WUCHT+ROBUST)`). Vier Beispiele mit Zahlen in
  Abschnitt 6: ein Raufbold checkt im Eishockey rund 2,4-mal je Spiel statt 1,6, ein Zauderer
  0,9-mal, ein Eisblock 1,3-mal mit deutlich höherer Trefferquote, ein Egomane 1,8-mal und
  bevorzugt gegen den besten Gegner.
- **Rollentreue heißt „spielt sein eigenes Spiel", nicht „spielt schlechter".** Ein Egomane im
  Slot Hold Line hält die Linie nur zu 60 %; die übrigen 40 % spielt er nach seinem eigenen Profil
  — was je nach Spieler besser oder schlechter sein kann. Das ist der Unterschied zwischen Charakter
  und Strafe (Abschnitt 8.2).
- **Die Lehre vom 02.10. ist die wichtigste Leitplanke.** Opus hat gemessen, dass die bestehenden
  Kampfstile die Rangtreue in TDM um 0,1 bis 0,2 verzerrten — nicht über die Zielwahl, sondern
  über Zusammenhalt und Bindung, zwei Regler, die die **Menge** des Beitrags veränderten statt
  nur den Stil (`arena-zielwahl-opus-empfehlung-02-10.md`). Die sechs neuen Regler sind deshalb
  so gewählt, dass sie Stil, Ziel und Häufigkeit verschieben, aber keinen Handwerks-Kanal
  anfassen. Gemessen wird das trotzdem, je Disziplin, mit den Kriterien A–F aus jenem Dokument.

---

## 1. Was heute da ist — vier Befunde

**1.1 Die Traits sind kanonisch, verbreitet und schon in der Arena.** 18 positive und 18 negative
Namen, an drei Stellen identisch gelistet (`class-progression-config.ts`,
`legacy-lineup-modifiers.ts`, `MUTATOR_POS`/`MUTATOR_NEG` in der Engine ~8348). Im
Seed-Bestand (`data/generated/oly-player-stats.json`, 2.984 Spieler) trägt ein Spieler im
Median zwei positive und zwei negative Traits; 198 haben kein positives, 279 kein negatives, rund
60 haben gar keines. Die häufigsten: Feisty 516, FiredUp 507, Loyal 504, Ambitious 438, Eloquent
431, Mercenary 430. Egomaniac tragen 245. Die Traits fließen heute in den Spieltags-Mutator (zwei
aus 36, +3,5 auf alle Attribute im Battle-Modus), in Training, Moral, Vertragsverhandlung,
Kapitänswahl und zwei weiche Effekte (`cosmetic-trait-soft-effects.ts`). Sie sind also keine
Kosmetik, aber **keiner von ihnen ändert heute, was ein Spieler im Spiel tut** — nur, wie viel er
dabei hat.

**1.2 Es gibt bereits eine abgeleitete Persönlichkeit, und sie wirkt.** `leitePers(p)` vergibt
Punkte aus vier Quellen (`PW.klasse`, `PW.rasse`, `PW.sub`, `PW.plus`, `PW.minus`, Engine ~36765)
und nimmt den Schlüssel mit den meisten Punkten:

| Kampfstil | Zielneigung (`PERSZIEL`) | Haltung / Zusammenhalt / Bindung (`PERSDEF`) | Tackle-Bereitschaft Bahn (`willTackeln`) |
|---|---|---|---:|
| Bollwerk | nächster | vorsichtig / dicht / zielstrebig | 0,25 |
| Draufgänger | Spitze aufbrechen | ungestüm / eigenmächtig / opportunistisch | 0,90 |
| Duellant | größte Bedrohung | ausgewogen / ausgewogen / zielstrebig | 0,55 |
| Schleicher | hintere Reihe | vorsichtig / eigenmächtig / flexibel | 0,50 |
| Beschützer | Kameraden freischlagen | defensiv / eng / ausgewogen | (fehlt, fällt auf 0,5) |
| Opportunist | Angeschlagensten | ausgewogen / locker / opportunistisch | 0,70 |

Dazu der Sandsack-Lastenplan (`sandsackPersoenlichkeit()`, ~21260), der aus denselben Skalen
einen Teamwert 0…1 bildet. Der Kommentar über `PW` sagt es selbst: „DIE PERSOENLICHKEIT WIRD NICHT
GEWAEHLT — SIE ENTSTEHT." Das ist genau Chris' Forderung, nur mit sechs Typen, die für den
Kampf gedacht sind und deshalb Dinge wie Egomanie, Lampenfieber oder Showlust gar nicht kennen.
Nebenbefund aus `takeshi-chaos-tackle-plan-06-09.md` 1.2, immer noch offen: die
`willTackeln`-Tabelle kennt einen Schlüssel `taktiker`, den `leitePers` nie vergibt, und keinen
`beschuetzer`, den es vergibt.

**1.3 Persönlichkeit kann die Rangtreue kosten — und man weiß inzwischen, worüber.** Die
Opus-Konsultation vom 02.10. hat das Bündel „Persönlichkeit" kontrafaktisch zerlegt: Zielneigung
und Haltung sind rangtreue-neutral (V2, V4 ≈ V0), **Zusammenhalt und Bindung** tragen die
Fehlordnung (V5/V6/V9: TDM 0,324 → 0,416, Mini-DM 0,365 → 0,588, Battlefield 0,399 → 0,583). Der
Grund: wer eigenmächtig läuft und ständig umzielt, „verbringt seine Zeit mit Laufen,
Trennschlägen und angefangenen Zielen statt mit Treffern" — die Persönlichkeit bestimmte die
**Menge** des Beitrags, nicht nur den Stil. Seit dem 07.10. gilt in Mini-DM deshalb
`persHandwerk:["z"]`: Persönlichkeit wählt Ziel und Mut, das Handwerk ist für alle gleich.
Battlefield verfehlte dabei Kriterium F (Pp +27/+37) und blieb aus. **Jeder Regler dieses
Konzepts muss sich an dieser Unterscheidung messen lassen: Stil, Ziel und Häufigkeit ja — Menge
und Handwerk nein.**

**1.4 Die Attribute sind da, das Alignment nicht.** Zwölf Attribute (`PlayerGeneratorAttributes`,
`olyDataTypes.ts:777`) für jeden Spieler. Das Feld `alignment` (R/N/C × G/N/B) hat für die 2.984
Seed-Spieler eine saubere Semantik, steht aber für jeden generierten Spieler auf `"N"`
(`DEFAULT_ALIGNMENT`, `commit-draft-to-free-agent.ts:42`) — schon am 03.09. als „für neue Spieler
tot" befunden (`battle-mode-gameplay-grundmodell.md` C.1). Es kommt deshalb nicht in die Matrix.
Klasse und Unterklassen (13 Klassen, rund 55 Unterklassen im Bestand, Warrior 371, Trickster 350,
Guardian 271 am häufigsten) sind dagegen für jeden Spieler gesetzt.

---

## 2. Die Grundentscheidung: zwei Schichten, nicht eine

Chris' Beispiel verlangt etwas, das die sechs Kampfstile strukturell nicht können: ein Egomane
soll in einem teamfokussierten Slot **anders spielen als vorgesehen**. Die Kampfstile beschreiben,
wie jemand kämpft, wenn er kämpft. Sie beschreiben nicht, ob er sich an den Plan hält, ob er
unter Druck einbricht, ob er für die Tribüne spielt. Das ist eine andere Ebene.

Zwei Wege standen zur Wahl:

| | A: die sechs Kampfstile auf dreizehn erweitern | B: Charakter-Schicht über den Kampfstilen |
|---|---|---|
| Was sich ändert | `PW`, `PERS`, `PERSDEF`, `PERSZIEL`, `willTackeln`, Sandsack — alles, was gemessen und abgenommen ist | nichts Bestehendes; die Charakter-Regler sind ein zweiter Leser derselben Stammdaten |
| Risiko | Mini-DM-Abnahme vom 07.10. und die Takeshi-Kalibrierung (0,859–0,861) müssten neu | keins für Bestehendes; die neue Schicht wird je Disziplin einzeln zugeschaltet und gemessen |
| Verständlichkeit | „Egomane" müsste zugleich sagen, wen er in der Arena angreift | Kampfstil sagt WIE er kämpft, Charakter sagt OB er tut, was man ihm sagt, und WIE OFT er anlegt |

**Empfehlung: B.** Der Kampfstil bleibt, wie er ist, und bekommt im Sprachgebrauch den Namen,
den er verdient: *Kampfstil*, nicht Persönlichkeit. Die neue Schicht heißt *Charakter*
(im Spiel: Persönlichkeit, weil Chris das Wort so benutzt). Sie liest dieselben Stammdaten
(Traits, Attribute, Klasse, Unterklassen) mit einer eigenen Tabelle und liefert sechs Regler. Wo
sich die beiden Schichten berühren — `willTackeln` auf der Bahn ist heute ein Kampfstil-Regler und
wird zu einem Charakter-Regler — ist das ein bewusster, einzelner Umzug mit Messung, kein Umbau.
Ob man später `leitePers` aus dem Charakter ableitet statt umgekehrt (Abschnitt 4.4 nennt die
Zuordnung), ist eine Frage für die Umsetzungsrunde, nicht für dieses Konzept.

---

## 3. Die Taxonomie — dreizehn Persönlichkeiten und ein Rückfall

Die Namen sind bewusst bodenständig und deutsch, wie Bollwerk und Draufgänger. Jede Persönlichkeit
hat einen Satz, den man einem Spieler im Tooltip zeigen kann, ein Leittrait (das Trait, das sie
am stärksten anzeigt) und eine Beschreibung dessen, was sie im Spiel tut — über alle drei Fragen
hinweg, die Chris gestellt hat: Rempler, Rollentreue, Druck.

| # | Persönlichkeit | Leittraits | In einem Satz | Verhalten im Spiel |
|---|---|---|---|---|
| 1 | **Egomane** | Egomaniac, Diva, Ambitious | „Das Spiel ist eine Bühne, und er ist der Hauptdarsteller." | Spielt seinen eigenen Plan, wenn der Slot ihn klein macht; sucht den Ball, den Abschluss, den gegnerischen Star. Rempelt, um sich zu zeigen, nicht um zu helfen. Unter Druck eher gut — er will den Moment. |
| 2 | **Rampensau** | FanFavorite, Sexy, Scandalous, Diva | „Spielt für die Tribüne, nicht für den Trainer." | Stark in sichtbaren Rollen (Clutch Shot, Big Moment, Finale), lustlos in unsichtbaren (Help Defense, Defensive Wall). Sucht den Kontakt nicht oft — aber wenn, dann spektakulär und über die Grenze. Höchstes Wagnis nach dem Hasardeur. Nerven hängen am Publikum: groß im Spotlight, schwach, wenn keiner hinschaut. |
| 3 | **Anführer** | Eloquent, Motivated, Loyal, Disciplined | „Geht voran und zieht die anderen mit." | Hält seine Rolle und hebt die Rollentreue der Mitspieler. Nerven gut. Rempelt maßvoll und sauber — er will das Spiel führen, nicht die Strafbank. Natürlicher Kapitän (`team-captain-service.ts` liest dieselben Traits). |
| 4 | **Mannschaftsspieler** | Loyal, Altruistic, Caring, Fair | „Macht, was dem Team hilft, auch wenn es keiner sieht." | Höchste Rollentreue nach dem Pedanten, höchster Teamzug (Pass vor Abschluss, Deckung vor Vorstoß). Rempelt, um Kameraden freizumachen — Kontakt mittel, Härte niedrig. |
| 5 | **Raufbold** | Feisty, FiredUp, Cruel, Vindictive | „Sucht den Kontakt, auch wenn er ihn nicht braucht." | Höchster Kontakt- und Härtewert: rempelt oft, rempelt hart, kassiert die meisten Strafen. Rollentreue mittel: folgt aggressiven Slots gern, defensiven ungern. Unter Druck eher hitzig. |
| 6 | **Dickschädel** | Fearless, Motivated, Healthy | „Gibt nie auf, und zwar wortwörtlich." | Hoher, aber sauberer Kontakt — geht in jeden Zweikampf, steckt jeden ein. Hohe Rollentreue in körperlichen Slots. Nerven gut: wird unter Druck eher sturer als schlechter. |
| 7 | **Eisblock** | ColdBlooded, Cool, Disciplined | „Entscheidet, als ginge es ihn nichts an." | Beste Nerven im Spiel. Wenige, aber gut gewählte Rempler (nur, wenn die Chance stimmt), fast keine Strafen. Rollentreue hoch, Teamzug neutral — er hilft, wenn es rechnerisch sinnvoll ist. |
| 8 | **Pedant** | Obsessive, Diligent, Disciplined | „Macht alles richtig und nichts Überraschendes." | Höchste Rollentreue, niedrigstes Wagnis, kaum Kontakt — er hält sich an den Plan, auch wenn der Plan verliert. Nerven leicht unter Mitte: Grübler unter Druck, aber in Technik-Slots (Technician, Safe Lift, Lane Control) der Beste. |
| 9 | **Hasardeur** | Gambler, Renegade, Cheater | „Der große Wurf oder nichts." | Höchstes Wagnis, niedrige Rollentreue — nimmt den riskanten Abschluss, den riskanten Pass, den riskanten Rempler. Härte erhöht (Cheater: Fouls, die er für klug hält). Nerven mittel. |
| 10 | **Schlitzohr** | Devious, Manipulative, Paranoid | „Rempelt, wenn der Schiedsrichter woanders hinschaut." | Kontakt mittel, Härte hoch, aber Strafquote **niedrig** — er wählt Moment und Ziel (von hinten, den Schwächeren, den Unaufmerksamen). Rollentreue mittel, Teamzug niedrig. Nerven gut. |
| 11 | **Söldner** | Mercenary, Resourceful, Flexible | „Erledigt den Job — solange der Job ihn erledigt." | Alles in der Mitte, aber die Rollentreue hängt an der Moral (`player-morale-service.ts`): zufrieden ein verlässlicher Profi, unzufrieden ein Mitläufer. Rempelt, wenn es sich lohnt. |
| 12 | **Phlegmatiker** | Lazy, Relaxed, Cool | „Kommt nicht aus dem Tritt — kommt aber auch nicht rein." | Niedriger Kontakt, niedriges Wagnis, mittlere Rollentreue. Die eine Überraschung: Nerven über Mitte. Der Relaxed-Anteil macht ihn im Druckmoment gelassen, der Lazy-Anteil davor träge. |
| 13 | **Zauderer** | Timid, FaintHearted, Paranoid | „Weicht aus, wo andere hineingehen." | Niedrigster Kontakt, niedrigstes Wagnis, schlechteste Nerven. Aber: hohe Rollentreue — er tut, was man ihm sagt, weil er nichts Eigenes riskieren will. In Lese-Slots (Trap Reader, Route Reader, Pattern Read) völlig in Ordnung. |
| 0 | *Unauffällig* | — | „Kein Charakter, der auffällt." | Alle Regler auf 50. Der Rückfall für Spieler ohne Trait und ohne ausgeprägtes Profil. Kein Chip, kein Tooltip. |

Dreizehn ist absichtlich mehr als sechs und weniger als zwanzig: jedes der 36 Traits muss
irgendwo landen (Abschnitt 3.1), und jede Persönlichkeit muss sich auf den sechs Reglern von
jeder anderen unterscheiden (Abschnitt 4.2). Nicht aufgenommen, bewusst: „Berserker" (ist eine
Klasse, und der Raufbold trägt den Inhalt), „Verräter" (gibt es als Verhalten im Spiel nicht),
„Clown" (deckt die Rampensau ab).

### 3.1 Die Trait-Spalte der Matrix

Jedes Trait zahlt auf eine Persönlichkeit mit 3 (Leittrait), 2 (starkes Signal) oder 1
(Nebensignal) ein; die meisten auf eine zweite mit 1. Kein Trait ist ohne Zuordnung, kein Trait
zahlt auf mehr als zwei.

| Trait | Persönlichkeit (Punkte) | Trait | Persönlichkeit (Punkte) |
|---|---|---|---|
| Egomaniac | Egomane 3, Rampensau 1 | Timid | Zauderer 3 |
| Diva | Egomane 2, Rampensau 2 | FaintHearted | Zauderer 3 |
| Ambitious | Egomane 1, Anführer 1, Dickschädel 1 | Paranoid | Schlitzohr 2, Zauderer 1 |
| FanFavorite | Rampensau 3 | ColdBlooded | Eisblock 3 |
| Sexy | Rampensau 2 | Cool | Eisblock 2, Phlegmatiker 1 |
| Scandalous | Rampensau 2, Hasardeur 1 | Disciplined | Pedant 2, Eisblock 1, Anführer 1 |
| Eloquent | Anführer 3, Rampensau 1 | Diligent | Pedant 2, Mannschaftsspieler 1 |
| Motivated | Dickschädel 2, Anführer 1 | Obsessive | Pedant 3 |
| Loyal | Mannschaftsspieler 3, Anführer 1 | Gambler | Hasardeur 3 |
| Altruistic | Mannschaftsspieler 3 | Renegade | Hasardeur 2, Egomane 1 |
| Caring | Mannschaftsspieler 2 | Cheater | Schlitzohr 2, Hasardeur 1 |
| Fair | Mannschaftsspieler 2, Pedant 1 | Devious | Schlitzohr 3 |
| Feisty | Raufbold 3 | Manipulative | Schlitzohr 2, Egomane 1 |
| FiredUp | Raufbold 2, Dickschädel 1 | Mercenary | Söldner 3 |
| Cruel | Raufbold 2, Schlitzohr 1 | Resourceful | Söldner 1, Eisblock 1, Schlitzohr 1 |
| Vindictive | Raufbold 2, Schlitzohr 1 | Flexible | Söldner 1, Mannschaftsspieler 1 |
| Fearless | Dickschädel 3, Raufbold 1 | Lazy | Phlegmatiker 3 |
| Healthy | Dickschädel 1 | Relaxed | Phlegmatiker 2, Eisblock 1 |

Ambitious zahlt als einziges Trait auf drei Persönlichkeiten mit je 1: Ehrgeiz ist für sich
genommen noch kein Charakter, er färbt nur. Das ist beabsichtigt.

### 3.2 Die Attribut-Spalte: Form statt Höhe

Die Attribute dürfen nicht die Stärke abbilden — sonst wäre „Persönlichkeit" nur ein zweiter Name
für Eignung, und jede Rangtreue-Messung wäre zirkulär (dasselbe Argument wie in
`arena-zielwahl-opus-empfehlung-02-10.md` 3.1). Deshalb zählt die **Form** des Profils: ein
Attribut gibt nur dann Punkte, wenn es deutlich über dem **eigenen Mittel** des Spielers liegt.

    beitrag(a_k) = clamp((a_k − μ_p − 5) / 10, 0, 1,5)      μ_p = Mittel der zwölf Attribute

Ein Spieler mit Torment 80 bei Mittel 55 gibt 1,5 Punkte, einer mit Torment 60 bei Mittel 55
nichts. Zwei Signalattribute je Persönlichkeit, zusammen höchstens 3 Punkte — also so viel wie ein
Leittrait, nie mehr. Für „niedrig"-Signale gilt dieselbe Formel mit (μ_p − a_k − 5).

| Persönlichkeit | Signal 1 | Signal 2 | Persönlichkeit | Signal 1 | Signal 2 |
|---|---|---|---|---|---|
| Egomane | charisma hoch | torment hoch | Pedant | determination hoch | intelligence hoch |
| Rampensau | charisma hoch | dexterity hoch | Hasardeur | torment hoch | dexterity hoch |
| Anführer | charisma hoch | spirit hoch | Schlitzohr | awareness hoch | intelligence hoch |
| Mannschaftsspieler | spirit hoch | will hoch | Söldner | awareness hoch | — |
| Raufbold | power hoch | torment hoch | Phlegmatiker | stamina niedrig | determination niedrig |
| Dickschädel | health hoch | will hoch | Zauderer | will niedrig | torment niedrig |
| Eisblock | will hoch | intelligence hoch | | | |

Die Attribute haben zwei Aufgaben: sie geben trait-losen Spielern (rund 60 im Seed-Bestand, bei
generierten je nach `traitHint` mehr) überhaupt einen Charakter, und sie lösen die Gleichstände,
die eine Drei-Stufen-Tabelle zwangsläufig produziert (3.4). Sie sind stetig, die Traits sind
grob — zusammen ergibt das eine Rangfolge, die fast nie auf dem letzten Tiebreaker landet.

### 3.3 Die Klassen-Spalte

Klasse 1–2 Punkte, Unterklasse 1 Punkt — dasselbe Gewicht wie in `PW.klasse`/`PW.sub` heute, damit
die beiden Schichten denselben Maßstab haben.

| Klasse | Persönlichkeit | Unterklassen (je 1) |
|---|---|---|
| Berserker | Raufbold 2 | Maniac, Destroyer, Beast → Raufbold |
| Badass | Raufbold 1, Rampensau 1 | Prime Evil → Egomane |
| Warlord | Anführer 1, Egomane 1 | Lord, Royalty → Egomane |
| Tank | Dickschädel 2 | Guardian, Knight → Mannschaftsspieler; Behemoth → Dickschädel |
| Templar | Mannschaftsspieler 1, Pedant 1 | Monk → Pedant; Angel, Cleric, Healer → Mannschaftsspieler |
| Hero | Anführer 2 | Captain, Ambassador → Anführer; Vigilante → Hasardeur |
| Bard | Rampensau 2 | Swashbuckler, Pirate → Hasardeur |
| Tactician | Pedant 1, Eisblock 1 | Strategist → Pedant |
| Overseer | Schlitzohr 1, Pedant 1 | Controller, Engineer → Pedant |
| Mage | Eisblock 1 | Warlock → Schlitzohr; Undead, Wraith → Eisblock |
| Rogue | Schlitzohr 2 | Assassin, Ninja, Agent, Spec Ops, Executioner → Eisblock; Trickster → Schlitzohr |
| Sprinter | Rampensau 1 | Scout → Schlitzohr |
| Charger | Raufbold 1, Dickschädel 1 | Viking, Warrior → Dickschädel; Rebel → Hasardeur |
| (Rasse) | — | Isolated → Phlegmatiker; Servant → Mannschaftsspieler; Mercenary-Unterklassen gibt es nicht |

Rassen kommen **nicht** in die Charakter-Matrix. Im Kampfstil sind sie sinnvoll (ein Construct
steht wie ein Bollwerk), beim Charakter wären sie ein Klischee ohne Spielnutzen — und sie sind
für generierte Spieler ohnehin aus dem Archetyp abgeleitet, also schon in Klasse und Traits
enthalten.

### 3.4 Haupt, Neben, Rückfall — die Regel

1. Punkte aller dreizehn Persönlichkeiten aus 3.1 bis 3.3 summieren.
2. **Haupt** ist die höchste Summe, wenn sie **≥ 3** ist. Darunter: *Unauffällig*, keine Neben.
3. **Neben** ist die zweithöchste, wenn sie ≥ 3 **und** mindestens halb so groß wie die Haupt ist.
   Sonst keine Neben. Eine dritte gibt es nicht — Chris' „eine oder mehrere" wird bewusst auf
   eine begrenzt, weil drei Persönlichkeiten auf sechs Reglern nicht mehr lesbar sind.
4. **Gleichstand** löst sich in dieser Reihenfolge: höherer Einzelbeitrag (ein Leittrait schlägt
   zwei Nebensignale), dann höherer Attributanteil, dann die feste Reihenfolge der Tabelle in
   Abschnitt 3 (Egomane vor Rampensau vor …). Deterministisch, ohne `rr()`, ohne Saat — dieselbe
   Stammdaten, derselbe Charakter, in jedem Spielstand und jeder Vorschau.
5. **Einmal je Spieler aus den Stammdaten**, nicht je Spiel. Was sich im Spiel ändert, ist die
   Wirkung der Regler (Moral beim Söldner, Spotlight bei der Rampensau), nicht der Charakter.
   Traits ändern sich im Spiel nicht, Attribute langsam — ein Spieler, dessen Will über zwei
   Saisons von 40 auf 70 wächst, kann vom Zauderer zum Mannschaftsspieler werden. Das ist
   gewollt und im Saisonrückblick erzählbar.

**Drei Spieler aus dem Seed-Bestand, von Hand durchgerechnet** (Attribute nicht im Export, also
nur Traits und Klasse — die Attribute würden die Gleichstände lösen):

- **Cloud Strife** (Berserker; Agent, Augmented, Swashbuckler; Motivated, FanFavorite, Ambitious /
  Egomaniac, Diva): Egomane 3+2+1 = 6, Rampensau 3+2+1 = 6, Dickschädel 2+1 = 3, Raufbold 2,
  Hasardeur 1, Eisblock 1, Anführer 2. Gleichstand 6:6, beide mit Leittrait 3 → Attribute
  entscheiden (Charisma/Torment gegen Charisma/Dexterity). Haupt Egomane oder Rampensau, Neben das
  andere. Dickschädel mit 3 ist genau halb so groß und wäre Neben, wenn es keine Rampensau gäbe.
- **Zed** (Berserker, Construct; Bot, Ninja, Assassin; Flexible, Altruistic / Manipulative,
  Egomaniac): Mannschaftsspieler 3+1 = 4, Egomane 3+1 = 4, Eisblock 1+1 = 2, Raufbold 2,
  Schlitzohr 2, Söldner 1. Gleichstand 4:4 mit je einem Leittrait → Attribute. Ein Altruist mit
  Egomanie — der Spannungsfall „Zerrissener" (5.3, Nr. 4), und der Bestand erzeugt ihn tatsächlich.
- **Sir Varrus** (Berserker; Knight, Destroyer; FiredUp, Diligent / Egomaniac): Egomane 3,
  Raufbold 2+2+1 = 5, Pedant 2, Dickschädel 1, Mannschaftsspieler 1+1 = 2. Haupt Raufbold, Neben
  Egomane (3 ≥ 2,5) — der „Rowdy-Star" (5.3, Nr. 2), ohne dass jemand ihn so entworfen hätte.

---

## 4. Die sechs Regler — was eine Persönlichkeit mechanisch IST

Der Motor liest nie den Namen „Egomane". Er liest sechs Zahlen. Das ist dieselbe Trennung wie
heute zwischen `PERS` (Name) und `PERSDEF`/`behav()` (Skalen): eine Disziplin fragt nicht „ist er
ein Draufgänger?", sondern „wie hoch ist sein Opportunismus?".

### 4.1 Die Regler

| Regler | Frage | 0 heißt | 100 heißt | Wo er greift (Beispiele) |
|---|---|---|---|---|
| **Kontakt** | Wie oft sucht er den Körperkontakt, wenn er ihn haben könnte? | nie von sich aus | bei jeder Gelegenheit | Hockey Bodycheck-Suchrate, Bahn `willTackeln`, Basketball Steal-/Foul-Druck, Football Tackle-Winkel, Climbing Griffkontakt, Eiskunstlauf Rempler (sobald vier auf dem Eis sind) |
| **Härte** | Wie weit über die Grenze geht er dabei? | immer sauber | nimmt die Strafe in Kauf | Hockey `HK_FOUL_ANTEIL` je Spieler, Fechten Anteil Angriff-in-Vorbereitung, Breaking Peiniger-Dosis |
| **Rollentreue** | Wie weit folgt er dem Slot, den der Manager gesetzt hat? | spielt sein eigenes Spiel | spielt genau die Rolle | Slot-Profil-Mischung (8.2), Staffel-Marke, Battlefield Punktwahl, Basketball Pass/Wurf nach Slot |
| **Wagnis** | Nimmt er die riskante Option? | immer die sichere | immer die große | Gewichtheben Zielgewicht, Time-Trial Risk Segment, Schach Gambit, Tennis Netzangriff, Takeshi Durchbruch |
| **Nerven** | Wird er unter Druck besser oder schlechter? | bricht ein | wächst über sich hinaus | Tiebreak, letzter Versuch, Elfer-Situation, Photo Finish, Endspiel-Schwelle in der Arena |
| **Teamzug** | Eigene Aktion oder die für das Team? | Solo | Mannschaft | Pass vor Abschluss, Deckung vor Vorstoß, Sandsack-Plan, Staffel-Absichern, Beschützer-Rempler („Schild") |

Was **nicht** darunter ist, mit Absicht: Zusammenhalt und Bindung der Arena. Das sind nach dem
02.10. Handwerks-Kanäle, deren Verstellung die Menge des Beitrags frisst. Ein Egomane „läuft
nicht allein über das Feld" — das wäre die alte Fehlordnung. Er wählt eigene Ziele (Zielneigung,
rangtreue-neutral) und hält seinen Slot weniger (Rollentreue, neu, zu messen).

### 4.2 Die Stellung je Persönlichkeit

| Persönlichkeit | Kontakt | Härte | Rollentreue | Wagnis | Nerven | Teamzug |
|---|---:|---:|---:|---:|---:|---:|
| Egomane | 60 | 55 | **30** | 70 | 60 | **15** |
| Rampensau | 40 | 65 | 35 | 90 | 70 / 30 ¹ | 25 |
| Anführer | 55 | 35 | 75 | 55 | 75 | 75 |
| Mannschaftsspieler | 50 | 40 | 85 | 45 | 50 | **85** |
| Raufbold | **90** | **80** | 45 | 70 | 45 | 40 |
| Dickschädel | 75 | 40 | 80 | 60 | 70 | 60 |
| Eisblock | 55 ² | 25 | 70 | 55 | **85** | 50 |
| Pedant | 25 | 15 | **95** | 25 | 40 | 55 |
| Hasardeur | 65 | 65 | 25 | **95** | 55 | 35 |
| Schlitzohr | 55 ³ | 70 | 50 | 60 | 60 | 40 |
| Söldner | 45 | 45 | 60 ⁴ | 45 | 55 | 45 |
| Phlegmatiker | 25 | 30 | 55 | 30 | 65 | 55 |
| Zauderer | **15** | 25 | 70 | **20** | **25** | 60 |
| Unauffällig | 50 | 50 | 50 | 50 | 50 | 50 |

¹ Rampensau: 70 im Spotlight (Clutch-Slot wie Clutch Shot, Big Moment, Final Attempt, Photo
Finish, Tiebreak Clutch, Finale; Schlussphase; Tiebreak), 30 sonst.
² Eisblock: Kontakt gilt nur, wenn die Erfolgschance ≥ 0,5 ist; darunter 20.
³ Schlitzohr: Härte 70, aber die Entdeckungsquote (Strafe je hartem Kontakt) ist um ein Drittel
niedriger — er foult klug.
⁴ Söldner: 60 bei Moral ≥ 55, 45 bei Moral 35–55, 30 darunter (`player-morale-service.ts`).

Zwei Prüfungen, die diese Tabelle bestehen muss: **Jede Zeile unterscheidet sich von jeder
anderen in mindestens einem Regler um 20 Punkte oder mehr, von den meisten in zwei oder drei**
(nachgerechnet über alle 78 Paare; die engsten sind Egomane/Rampensau — Kontakt 60/40, Wagnis
70/90, und die Rampensau-Nerven gelten nur im Spotlight — sowie Anführer/Eisblock — Härte 35/25,
Teamzug 75/50, Nerven 75/85; beide Paare sind inhaltlich Verwandte, und das dürfen sie sein). Der
erste Entwurf dieser Tabelle hatte die Rampensau als blassen Egomanen (Kontakt 60, Wagnis 75);
die Rechnung hat das aufgedeckt, deshalb steht sie jetzt auf 40/90. Und **kein Regler steht bei
einer Persönlichkeit auf einem Wert, der in jeder Disziplin schlechter ist** (Abschnitt 8.2 — der
Egomane hat Teamzug 15, und genau das macht ihn im Clutch Shot zum besten Mann).

### 4.3 Disziplin-Vorzeichen: dieselbe Persönlichkeit, andere Wirkung

Chris: „Kann sich von Disziplin zu Disziplin unterscheiden." Zwei Mechanismen, beide ohne zweite
Tabelle:

- **Nicht jeder Regler ist überall angeschlossen.** Schach kennt keinen Kontakt; Wettessen keinen
  Teamzug; Gewichtheben keine Rollentreue im Sinne eines Gegners. Eine Disziplin erklärt — nach dem
  Muster `ARENA_ART[d].persHandwerk` — welche Regler sie liest (`charakter:["kontakt","haerte",
  "rollentreue"]`). Was sie nicht liest, wirkt nicht und wird im Picker für diese Disziplin auch
  nicht angezeigt.
- **Was „Spotlight", „Druck" und „Gelegenheit" bedeuten, definiert die Disziplin.** Druck im Tennis
  ist der Tiebreak, im Gewichtheben der dritte Versuch, in Hockey die letzten zwei Minuten bei
  einem Tor Abstand, im Takeshi die letzte Falle. Die Nerven-Formel ist überall dieselbe
  (Abschnitt 6.5), der Auslöser ist disziplinär.

So bleibt es **eine** Persönlichkeit je Spieler. Ein Raufbold ist auch im Schach ein Raufbold —
dort liest es nur niemand ab, und der Picker sagt das.

### 4.4 Zuordnung zum Kampfstil (nur zur Kontrolle, kein Umbau)

Damit die beiden Schichten nicht gegeneinander laufen, muss ein Spieler, der nach Abschnitt 3
Raufbold ist, in `leitePers()` nicht ausgerechnet Bollwerk werden. Die Standard-Zuordnung, wenn
man den Kampfstil irgendwann aus dem Charakter ableiten wollte:

| Charakter | natürlicher Kampfstil | Charakter | natürlicher Kampfstil |
|---|---|---|---|
| Egomane, Eisblock | Duellant | Pedant, Dickschädel, Phlegmatiker | Bollwerk |
| Raufbold, Rampensau | Draufgänger | Hasardeur, Söldner | Opportunist |
| Mannschaftsspieler, Anführer | Beschützer | Zauderer, Schlitzohr | Schleicher |

Eine Stichprobe auf der Kader-Familie (`data/generated/kaderfamilie-live-save.json`), wie oft
Charakter und Kampfstil gegeneinander stehen, gehört in die erste Umsetzungsrunde. Liegt die
Übereinstimmung über 70 %, kann der Kampfstil bleiben, wie er ist. Darunter ist die Ableitung aus
dem Charakter der sauberere Weg — dann aber mit der vollen Mini-DM-/Takeshi-Neumessung.

---

## 5. Kombinationslogik — Haupt und Neben

### 5.1 Die Grundregel: 65/35

    Regler = 0,65 · Haupt + 0,35 · Neben          (ohne Neben: Regler = Haupt)

Die 35 % sind so gewählt, dass die Neben einen Regler um höchstens 25 Punkte bewegt (bei 70 Punkten
Abstand) — spürbar, aber die Haupt bleibt erkennbar. Zwei Folgerungen, die man ohne Sonderregel
bekommt:

- **Verstärkung:** Raufbold (Kontakt 90) + Dickschädel (75) → 85. Zwei Persönlichkeiten, die in
  dieselbe Richtung zeigen, kippen den Regler nicht weiter — die Haupt ist schon fast am Anschlag.
  Keine Addition, kein „190". Das verhindert Spieler, die aus der Skala fallen.
- **Abschwächung:** Egomane (Rollentreue 30) + Mannschaftsspieler (85) → 49. Zwei, die sich
  widersprechen, landen in der Mitte — und sind damit auf dem Papier so unauffällig wie ein
  Spieler ohne Charakter. **Das wäre falsch.** Ein Egomane mit Gewissen ist nicht
  durchschnittlich, er ist zerrissen. Genau dafür gibt es 5.3.

### 5.2 Wann die Neben mehr als 35 % wiegt

Die Neben darf **situativ** zur Haupt werden, wenn die Disziplin oder der Moment ihr Feld ist:

- In einer Disziplin, die den Haupt-Regler nicht liest (4.3), aber den Neben-Regler, wirkt die
  Neben allein. Ein Raufbold-Pedant spielt Schach wie ein Pedant.
- Unter Druck (Nerven-Auslöser aktiv) wiegt die Persönlichkeit mit dem **extremeren**
  Nerven-Wert 65/35 statt der Haupt. Beim Egomane-Zauderer (Nerven 60 / 25) übernimmt im
  Tiebreak der Zauderer — der Maulheld wird klein, wenn es zählt. Beim Pedant-Eisblock (40 / 85)
  übernimmt der Eisblock — der Grübler hat einen kalten Kern.

### 5.3 Zehn Spannungsfälle mit eigener Regel

Die Mischung macht die Breite, die Spannungsfälle machen die Geschichten. Jede Kombination unten
bekommt einen Namen (für Tooltip und Boxscore) und **genau eine** Zusatzregel, die die Mischung
nicht liefern würde. Alle anderen Paare laufen über 5.1/5.2 ohne Sonderbehandlung.

| Haupt + Neben | Name | Was die Mischung sagt | Die eine Zusatzregel |
|---|---|---|---|
| Egomane + Zauderer | **Maulheld** | Kontakt 44, Wagnis 53, Nerven 48 — langweilig | Kontakt gilt nur gegen Gegner mit niedrigerer Wucht/Abwehr (er sucht sich seine Opfer); unter Druck gilt 5.2 (Zauderer übernimmt) |
| Egomane + Raufbold | **Rowdy-Star** | Kontakt 71, Härte 64, Rollentreue 35 | Ziel der Rempler ist bevorzugt der eignungsbeste Gegenspieler (Star-Jagd); nach einem kassierten Check 60 % Vergeltung in den nächsten 10 s Spielzeit |
| Egomane + Anführer | **Alphatier** | Rollentreue 46, Teamzug 36 | Ist er Kapitän (`team-captain-service.ts`) oder im Führungs-Slot (Shotcaller, Floor General, Captain Line, Commander, Stage Lead), gilt Rollentreue 70 und Teamzug 55; sonst Egomane pur (30/15) |
| Egomane + Mannschaftsspieler | **Zerrissener** | Rollentreue 49, Teamzug 40 | Moral entscheidet: ≥ 60 spielt er als Mannschaftsspieler (85/85), < 40 als Egomane (30/15), dazwischen die Mischung. Der einzige Charakter, der sich innerhalb einer Saison sichtbar dreht |
| Eisblock + Raufbold | **Vollstrecker** | Kontakt 67, Härte 44 | Kontakt 75, aber nur bei Erfolgschance ≥ 0,5 (Eisblock-Bedingung bleibt); Härte 35. Der effizienteste Checker im Spiel — wenige Versuche, hohe Quote, kaum Strafen |
| Pedant + Zauderer | **Grübler** | Rollentreue 86, Nerven 35 | Nerven 20 unter Druck (5.2), **aber** in Technik-Slots (Technician, Safe Lift, Lane Control, Route Reader, Baton Tech, Calculation Core …) Nerven 60 — der Mann, der die unauffällige Aufgabe perfekt macht und an der großen scheitert |
| Rampensau + Söldner | **Auftragskünstler** | Rollentreue 44, Teamzug 32 | Spotlight-Bedingung der Rampensau gilt nur an „großen" Spieltagen (Derby, Playoff, letzte drei Spieltage); sonst Söldner pur. Nerven 70 nur dort |
| Hasardeur + Dickschädel | **Ohne Bremse** | Kontakt 69, Wagnis 83, Härte 56 | Wagnis 95 bleibt (keine Abschwächung durch die Neben); nach einem gescheiterten Wagnis **kein** Lerneffekt — er versucht es sofort wieder. Der unterhaltsamste und strafanfälligste Charakter |
| Anführer + Söldner | **Profi-Kapitän** | Rollentreue 70, Teamzug 65 | Der Anführer-Bonus auf die Rollentreue der Mitspieler (6.4) gilt nur bei Moral ≥ 55; darunter führt er niemanden |
| Schlitzohr + Zauderer | **Heimlicher** | Kontakt 41, Härte 54 | Kontakt nur gegen Gegner, die ihn nicht sehen (von hinten, im Rücken des Puckführers, am Engpass von der Seite); nie frontal. Entdeckungsquote halbiert |

Was absichtlich **nicht** in der Liste steht: Raufbold + Zauderer. Die Mischung (Kontakt 64,
Nerven 38) ist ein Hitzkopf, der im entscheidenden Moment kneift — das erzählt die 65/35-Regel
schon von selbst, eine Zusatzregel würde sie nur verdoppeln.

### 5.4 Wie viele Spieler das trifft

Ohne Attribute lässt sich die Verteilung nur grob aus den Traits schätzen; die erste
Umsetzungsrunde muss sie messen (`scripts/`-Sonde über die 2.984 Seed-Spieler und die
Kader-Familie). Was die Trait-Häufigkeit erwarten lässt: Raufbold (Feisty 516, FiredUp 507) und
Mannschaftsspieler (Loyal 504) werden die häufigsten Haupt-Persönlichkeiten, Hasardeur (Gambler
140) und Zauderer die seltensten — bis die Attribute Zauderer aus niedrigem Will nachliefern.
Spannungsfälle dürften rund 10–15 % der Spieler mit Neben betreffen. Wenn eine Persönlichkeit über
25 % oder unter 3 % liegt, sind die Gewichte in 3.1 nachzuziehen, bevor irgendein Regler scharf
geht — eine Taxonomie, in der jeder Dritte Raufbold ist, erklärt nichts.

---

## 6. Konkrete Anwendung: Rempler und Tackling

### 6.1 Die Grenze, die alles entscheidet

Ein Rempler hat heute an jeder Stelle im Motor **drei Teile**, und sie sind sauber getrennt:

| Teil | Hockey (`versucheSteal`, ~15058) | Bahn (`stepSpurt`, ~48859) |
|---|---|---|
| Gelegenheit → Versuch | jede Deckungssituation am Puckführer (121,5 je Spiel, `hockey-ausdauer-checks-konzept-13-09.md`) | `willTackeln · dt · tackleRate`, nur über `tackleAb` (WUCHT-Schwelle) und nur mit Gegner in Reichweite |
| Versuch → sitzt | `wucht = clamp(0,16 + (ABWEHR − AUSDAUER_wirk) · 0,004, 0,04, 0,45)` | `stark = WUCHT / (WUCHT + ROBUST)` |
| sitzt → Strafe | `HK_FOUL_ANTEIL = 0,38` | — (Takeshi: kein Pfiff) |

**Die Persönlichkeit darf den ersten und den dritten Teil anfassen, nie den zweiten.** Ob ein
Check sitzt, entscheiden die Attribute — das ist die Matrix, und sie bleibt die Wahrheit. Die
Persönlichkeit entscheidet, ob er es versucht, wen er sich aussucht und wie weit er geht. Ein
Raufbold mit schwacher ABWEHR versucht es doppelt so oft und scheitert doppelt so oft; das kostet
ihn (Hockey: `decker.lunge`, Puste; Bahn: Abklingzeit, `tackleKosten`) und ist für den Zuschauer
genau das Bild eines Raufbolds, der sich verrennt. Ein Eisblock versucht es seltener und sitzt
öfter. Beide sind Charakter, keiner ist ein Attributbonus.

### 6.2 Die Formel

    Suchfaktor   S(p) = 0,4 + 1,2 · Kontakt/100          → 0,4 … 1,6
    Härtefaktor  H(p) = 0,5 + 1,0 · Härte/100            → 0,5 … 1,5

Hockey: die Bodycheck-Gelegenheit wird vor dem `wucht`-Wurf mit `rr() < S(decker)/S_mittel`
gefiltert (heute implizit immer 1); die Strafquote wird `HK_FOUL_ANTEIL · H(decker)`. Bahn:
`willTackeln` wird `0,55 · S(u)` (0,55 ist der heutige Duellant-Wert, die Mitte der Tabelle).

**Normierung über den Kader, nicht über die Persönlichkeit.** `S_mittel` ist das Mittel von S
über alle Spieler des Spieltags-Kaders beider Seiten. Damit bleibt die **Gesamtzahl** der Checks je
Spiel bei den gemessenen 16 sitzenden Bodychecks (± Kaderrauschen), nur die Verteilung auf die
Spieler ändert sich. Ohne diese Normierung stiege die Checkdichte, weil Feisty und FiredUp die
beiden häufigsten Traits sind — und das Hockey-Konzept vom 13.09. hat gezeigt, dass wir schon
heute auf die Uhr gerechnet fünfmal so check-dicht sind wie die NHL. Mehr Checks will niemand;
andere Checker schon.

### 6.3 Vier Persönlichkeiten im Eishockey, durchgerechnet

Basis aus `hockey-ausdauer-checks-konzept-13-09.md`: 121,5 Gelegenheiten, 16,0 sitzende Checks
(13,2 %), davon 5,5 abgepfiffen, 10 Feldspieler → **1,6 Checks je Skater**, 0,55 Strafen.
Angenommen ein Kader mit S_mittel ≈ 1,0 (gemischte Persönlichkeiten) und mittlere Attribute
(wucht-Chance 14,4 % im Mittel, gemessen).

| Persönlichkeit | Kontakt / Härte | S / H | Gelegenheiten, die er nutzt | sitzende Checks je Spiel | davon Strafen | Trefferquote | Was man sieht |
|---|---:|---:|---:|---:|---:|---:|---|
| Durchschnitt (Unauffällig) | 50 / 50 | 1,0 / 1,0 | 12,2 | **1,6** | 0,55 | 13,2 % | wie heute |
| **Raufbold** | 90 / 80 | 1,48 / 1,30 | 18,0 | **2,4** | 1,1 | 13,2 % | checkt an jeder Bande, jedes zweite Spiel eine Strafe mehr; läuft bei schwacher ABWEHR ins Leere |
| **Zauderer** | 15 / 25 | 0,58 / 0,75 | 7,1 | **0,9** | 0,25 | 13,2 % | weicht aus, kaum Kontakt; dafür mehr Stockchecks (der andere Zweig läuft weiter) |
| **Eisblock** | 55 ² / 25 | 1,06 / 0,75 | 12,9 → nur bei wucht ≥ 0,20: ~5,5 ³ | **1,3** | 0,4 | **~24 %** | wenige, sitzende Checks — die höchste Quote im Spiel, obwohl die Formel dieselbe ist: er wählt die Gelegenheiten, bei denen ABWEHR klar über AUSDAUER liegt |
| **Egomane** | 60 / 55 | 1,12 / 1,05 | 13,7, davon bevorzugt am gegnerischen Star | **1,8** | 0,65 | 13,2 % | checkt den Topscorer, nicht den Nächsten; kassiert er selbst einen Check, geht die Vergeltung (Rowdy-Star-Regel bei Neben Raufbold) |

³ Annahme: rund 43 % der Gelegenheiten liegen über wucht 0,20, mit mittlerer wucht 0,26 — die
Verteilung der 121,5 Gelegenheiten über die wucht-Spanne 0,04–0,45 ist nicht gemessen, nur ihr
Mittel (14,4 %). Die Eisblock-Zeile ist deshalb die unsicherste der vier.

Die Trefferquote bleibt bei drei von vier auf 13,2 %, weil die Persönlichkeit den `wucht`-Wurf
nicht anfasst. Der Eisblock ist der eine Fall, in dem sie steigt — nicht durch einen Bonus, sondern
durch **Auswahl**. Das ist der Mehrwege-Gedanke aus `CLAUDE.md`: derselbe Attributsatz, ein
anderer Weg, ihn einzusetzen.

### 6.4 Dasselbe auf der Bahn (Spurt, Staffel, Takeshi)

Heute (`takeshi-chaos-tackle-plan-06-09.md` 1.2): Rempelversuch je Tick `willTackeln · dt ·
tackleRate`, Duellant 0,55 → etwa ein Versuch alle zwei Sekunden bei Gegner in Reichweite, in
Takeshi nur im Fenster vor einer Falle. Mit `0,55 · S(u)`:

| Persönlichkeit | heute (Kampfstil) | neu (Charakter) | Versuchsrate relativ |
|---|---:|---:|---:|
| Raufbold | 0,90 (Draufgänger) | 0,81 | ×1,5 zum Durchschnitt |
| Egomane | 0,55 (Duellant) | 0,62 | ×1,1, bevorzugt gegen den Führenden |
| Mannschaftsspieler | 0,5 (Beschützer, fehlt in der Tabelle) | 0,55, als „Schild": nur gegen Gegner, die den eigenen Staffelläufer bedrängen | ×1,0 |
| Eisblock | 0,55 | 0,58, nur bei `stark ≥ 0,5` | ×1,06, aber halb so viele Fehlversuche |
| Zauderer | 0,5 (Schleicher) | 0,32 | ×0,6 |
| Pedant | 0,25 (Bollwerk) | 0,38 | ×0,7 |

Die WUCHT-Schwelle `tackleAb` bleibt. Ein Zauderer mit WUCHT 70 rempelt selten, aber wenn, dann
mit Wirkung; ein Raufbold mit WUCHT 30 rempelt nie, weil er es nicht kann — und der Ticker darf
das sagen („will zulangen, hat aber nicht die Wucht"). Der Takeshi-Nebenfund (Beschützer fehlt,
`taktiker` ist tot) erledigt sich mit dem Umzug von `willTackeln` in die Charakter-Schicht.

### 6.5 Nerven: die Druckformel

Einmal für alle Disziplinen, damit „Nerven" überall dasselbe heißt:

    unter Druck:  Erfolgschance_wirk = Erfolgschance · (1 + 0,15 · (Nerven − 50)/50)

Ein Eisblock (85) bekommt im Tiebreak +10,5 % auf seine Punktchance, ein Zauderer (25) −7,5 %. Das
ist absichtlich kleiner als eine Formkarte +4 (die in Tennis 6 % des Feldes bewegt, in Climbing
23 % — `formkarten-eignung-ueberall-14-10.md`) und greift nur in den Druckmomenten, die die
Disziplin so definiert (4.3). Über ein ganzes Spiel ist das ein Bruchteil eines Eignungspunkts;
im Moment, in dem es zählt, ist es sichtbar. **Nerven ist der einzige Regler, der direkt an eine
Erfolgschance geht** — deshalb der kleine Faktor, und deshalb muss er als Erstes gegen rho
gemessen werden (Abschnitt 8.3).

### 6.6 Anführer-Ausstrahlung

Ein Anführer (Haupt, nicht Neben) hebt die Rollentreue aller Mitspieler auf dem Feld um 5 Punkte;
ist er zugleich Kapitän, um 10. Das ist der einzige Regler, der über den eigenen Spieler
hinausreicht, und er bleibt klein: ein Egomane mit Rollentreue 30 wird neben einem Anführer-Kapitän
zu 40, nicht zum Mannschaftsspieler. `team-captain-service.ts` zählt heute Eloquent, Motivated,
Ambitious, Disciplined, Resourceful, Loyal mit je 4 Punkten — die Anführer-Herleitung liest
dieselben Traits, also werden Kapitänswahl und Charakter von selbst zusammenpassen.

---

## 7. Anzeige — damit der Manager vorher weiß, wen er aufstellt

Dieselben fünf Zustände wie überall (`formatMarketDevelopmentTrend()`: `++ / + / 0 / − / −−`;
`.tchip.auf`/`.tchip.ab` in der Arena; `nl-lineup-chip is-<tone>` in `LineupNewLook.tsx`),
dieselbe Regel wie im Oberflächen-Konzept: Glyphe, Farbe und Text immer zusammen, nie Farbe
allein. Ein Unterschied zu Teil 1 ist wesentlich: **ein Oberflächen-Chip sagt „+2,8 Eignung", ein
Charakter-Chip sagt nie eine Eignungszahl.** Er sagt, was der Spieler tut. Sonst liest der Manager
einen Charakter als Bonus oder Malus, und genau das soll er nicht.

### 7.1 Die Persönlichkeitszeile am Spieler

Im Kader und im Spieler-Drawer (Stage A des `PlayerDetailDrawer`), unter Klasse und Unterklassen:

    Egomane · Raufbold                    ← Haupt fett, Neben normal; Spannungsfall als Beiname
    „Rowdy-Star"
    wegen: Egomaniac, Diva, Feisty · Torment 81 · Berserker

Der Tooltip zeigt die Herleitung mit Punkten — exakt die Zahlen aus Abschnitt 3, damit „aus
welchen Gründen" wörtlich stimmt (dasselbe Prinzip wie `persWarum` heute, nur sichtbar).
Unauffällige Spieler bekommen keine Zeile; ein leerer Chip wäre eine Aussage, die nichts sagt.

### 7.2 Die Regler-Chips im Picker — nur die, die die Disziplin liest

Hinter dem Namen in der Kandidatenliste und im Slot, mit den fünf Zuständen auf jedem Regler:

| Regler | `++` (≥ 80) | `+` (65–79) | `0` (36–64, ausgeblendet) | `−` (21–35) | `−−` (≤ 20) | Tooltip-Text (Beispiel `−−`) |
|---|---|---|---|---|---|---|
| Rollentreue | „Rolle ++" | „Rolle +" | — | „Rolle −" | „Rolle −−" | „Spielt im Slot Hold Line nur zu 30 % die Rolle, den Rest sein eigenes Spiel: sucht Abschlüsse, hält die Linie nicht." |
| Kontakt | „Rempelt ++" | „Rempelt +" | — | „Rempelt −" | „Rempelt −−" | „Weicht Zweikämpfen aus (0,7 Checks je Spiel statt 1,6)." |
| Härte | „Hart ++" | | | | „Hart −−" | „Geht über die Grenze: rund doppelt so viele Strafen." |
| Wagnis | „Risiko ++" | | | | „Risiko −−" | „Nimmt immer die sichere Option." |
| Nerven | „Nerven ++" | | | | „Nerven −−" | „Bricht unter Druck ein (−7,5 % im Tiebreak)." |
| Teamzug | „Team ++" | | | | „Team −−" | „Spielt für sich: Abschluss vor Pass." |

**Farbe ist hier bewusst nicht Wertung.** `Rempelt ++` ist in Hockey grün (die Disziplin will
Kontakt), in Eiskunstlauf rot (ein Rempler kostet dort Haltungsnoten, sobald vier auf dem Eis
sind) — die Disziplin legt je Regler fest, welche Richtung sie als Vorteil färbt. `Rolle −−`
ist **nie** rot, sondern bernstein (`--warn`): es ist eine Abweichung, kein Nachteil (8.2). Das
ist die eine Stelle, an der das Schema bewusst von Teil 1 abweicht, und sie ist begründet.

### 7.3 Slot-Passung: der Spannungs-Hinweis

Chris' Beispiel — Egomane im teamfokussierten Slot — bekommt im Picker eine eigene Zeile unter
dem Slot, sobald Rollentreue ≤ 35 **und** der Slot ein Team-Slot ist (ein Slot, dessen
Fokusattribute in `matchday-slot-roles.ts` Spirit oder Charisma enthalten und dessen Text vom
Team spricht, z. B. Rally Point, Help Defense, Morale Anchor, Tempo Link, Captain Line — die
Liste ist je Disziplin eine Handvoll Namen, keine Formel):

    ⚠ Egomane im Team-Slot: hält die Rolle zu 30 %, spielt 70 % sein eigenes Profil.
      Projiziert: 61 Pkt (Rolle) → 58 Pkt (sein Spiel). Alternative: Clutch Shot 66 Pkt.

Die zwei Zahlen sind beide aus derselben Slot-Profil-Mischung (8.2) gerechnet, die der Motor
liest. Der Hinweis ist eine Information, kein Verbot: der Manager darf ihn trotzdem dort
aufstellen — vielleicht, weil 58 immer noch der beste Mann für den Slot ist.

### 7.4 Arena, Ticker, Boxscore

- Die Trait-Chip-Zeile der Arena (`tchip`, ~37497) bekommt die Persönlichkeit als ersten Chip
  (`Egomane·Raufbold`), die gelesenen Regler dahinter wie oben. Das Taktik-Panel zeigt heute
  Kampfstil und `neigungen()` („Linientreu · Aufmerksam · Besonnen") — die Charakter-Zeile kommt
  darunter, der Kampfstil bleibt.
- Ticker-Zeilen, die den Charakter nennen, wo er die Entscheidung erklärt: „Thraxis lässt die
  Linie stehen und geht auf Kiti." (Rollentreue), „Zed wartet, bis der Schiedsrichter wegschaut —
  Check von hinten." (Schlitzohr), „Sir Varrus nimmt sich den Topscorer vor." (Rowdy-Star). Die
  Bahn hat dafür die Vorlage („rammt … vor der Falle um", „sieht … kommen").
- Boxscore: Spalten `Rempl`/`Ausw` gibt es auf der Bahn schon, Hockey hat `Chk` (Bodychecks,
  ~46267) und Football `Tkl`; was fehlt, sind Strafen je Spieler. Eine Fußzeile „Rollentreue" je
  Spieler (gemessener Anteil der Aktionen im Slot-Sinn) wäre die ehrlichste Anzeige überhaupt —
  sie zeigt, ob der Charakter getan hat, was der Chip versprach.

### 7.5 Was unverändert bleibt

Kaderwert, Transfermarkt-Linse, Teamstärke, KI-Kauf und Training lesen weiter die Matrix. Der
Charakter ist kein Eignungsterm. Was die KI-Aufstellung (`LineupAiPreviewPanel`) betrifft: sie
muss die Slot-Profil-Mischung aus 8.2 genauso rechnen wie der Picker — sonst stellt der Mensch
mit Wissen auf, das die KI nicht hat, und das Spiel wäre unfair in die falsche Richtung.

---

## 8. Ehrliche Einschätzung

### 8.1 Wo das Konzept stark ist

- **Es erfindet keine Begriffe ohne Anker.** Jede der dreizehn Persönlichkeiten hängt an
  Traits, die im Spiel existieren, kanonisch sind und die Spieler schon tragen. „Egomane" ist
  für den Manager, der `Egomaniac` im Kader liest, sofort nachvollziehbar — das Leittrait steht
  im Namen.
- **Es baut auf Gemessenem.** Das Punktemodell (`leitePers`), die Tackle-Bereitschaft
  (`willTackeln`), die Druckunterscheidung Handwerk/Charakter (02.10.) und die
  Trait-Zahlen-Tabellen (Moral, Training, Kapitän) gibt es alle. Das Konzept ordnet sie und setzt
  eine Schicht darüber; es ersetzt nichts, was abgenommen ist.
- **Pp-arm per Konstruktion, aber nicht Pp-frei.** `einflussVon()` hebt ein Attribut und
  vergleicht; Traits und Klasse sind in beiden Läufen gleich, das ist der größte Teil der
  Herleitung. Der Attributanteil liest die Form, nicht die Höhe — aber ein gehobenes
  **Signalattribut** gewinnt bis zu 0,9 Punkte (ein um 10 gehobenes Torment bei einem
  Raufbold-Kandidaten), und das kann bei einem Gleichstand die Haupt kippen. Der Kanal ist auf
  1,5 Punkte je Attribut gedeckelt und trifft nur Spieler nahe einer Grenze; er ist klein, aber er
  existiert, und deshalb ist Pp hier zu messen, nicht herzuleiten (8.3). Nur Nerven greift direkt
  an eine Erfolgschance, und das klein.
- **Die Spannungsfälle sind das, was man sich merkt.** Der Rowdy-Star, der Maulheld, der
  Zerrissene — das sind Figuren, über die Chris im Saisonrückblick reden kann. Und der Bestand
  erzeugt sie (Sir Varrus, Zed), man muss sie nicht pflanzen.

### 8.2 Die Strafe-oder-Charakter-Frage — und die Antwort darauf

Das Risiko, das Chris' Auftrag selbst benennt: der Manager stellt einen Egomanen in Hold Line, und
der Egomane spielt dort systematisch schlechter. Dann ist die Persönlichkeit eine Steuer auf
den Spieler, und der Manager lernt nur, bestimmte Traits zu meiden — das Gegenteil von Charakter.
Fünf Regeln, die das verhindern; die erste ist die entscheidende:

1. **Rollentreue ist eine Mischung, kein Abzug.** Heute bewertet ein Slot den Spieler nach seinem
   Slot-Profil (`matchday-slot-roles.ts`, `slotAufschlag` in der Engine). Mit Charakter:

       Profil_wirk = R · Profil_Slot + (1 − R) · Profil_eigen          R = Rollentreue/100

   `Profil_eigen` ist das Profil, in dem der Spieler von sich aus am stärksten ist (seine zwei
   höchsten Matrix-Attribute dieser Disziplin als Fokus — dieselbe Bauweise wie ein Slot-Thema).
   Ein Egomane mit Spitzenwerten in Power und Torment, in Rally Point gesetzt (Spirit/Charisma),
   spielt zu 70 % Breaker. Ist er in Power und Torment besser als in Spirit und Charisma, ist das
   für den Slot ein **Gewinn** — der Slot bekommt nur nicht, was er bestellt hat. Ist er es nicht,
   ein Verlust. Der Picker zeigt beide Zahlen (7.3). So ist Rollentreue Charakter: der Spieler
   tut etwas anderes, nicht etwas Schlechteres.
2. **Jede Persönlichkeit hat einen Ort, an dem sie die beste Wahl ist.** Egomane: Clutch Shot,
   Final Attempt, Photo Finish (Teamzug 15 heißt dort: er nimmt den Wurf, und Nerven 60 heißt: er
   trifft ihn). Zauderer: Trap Reader, Route Reader, Pattern Read (Wagnis 20 heißt: er macht keinen
   Fehler). Raufbold: Power Forward, Aggressor, Line Power. Pedant: Technician, Safe Lift, Baton
   Tech. Das ist Chris' Mehrwege-Leitlinie auf den Charakter übertragen; die Tabelle in 4.2 ist
   dagegen geprüft, und die Umsetzungsrunde muss es je Disziplin bestätigen.
3. **Kein Regler darf eine Richtung haben, die überall schlechter ist** (Designregel 3 aus PR
   #1118, „kein Knopf darf immer besser sein", hier umgekehrt). Härte 80 kostet Strafen, bringt
   aber in Hockey und Breaking den Gegner aus dem Tritt. Wagnis 95 verliert Zeitfahren und
   gewinnt Takeshi. Kontakt 15 verliert Hockey-Zweikämpfe und spart Puste. Die Nerven sind die
   Ausnahme — Nerven 25 ist nirgends gut, und das ist beim Zauderer der Preis für Rollentreue 70
   und Wagnis 20, die ihn in Lese-Slots tragen. Wenn die Messung zeigt, dass Zauderer über alle
   Disziplinen systematisch unten liegen, ist das der erste Regler, den man weicher stellt.
4. **Der Manager hat Gegenmittel.** Kapitän (Anführer-Ausstrahlung), Moral (Zerrissener,
   Söldner), Slotwahl (7.3), und — sobald die Haltungs-Achse aus PR #1118 gebaut ist — ein
   Risiko-Regler je Spieler, der Wagnis übersteuert. Charakter ist dann ein Ausgangszustand, den
   man führen kann, keine Festlegung.
5. **Die Größen sind gedeckelt.** Rollentreue kommt in der Mischung nie unter 25 (Hasardeur), die
   Nerven bewegen eine Chance um höchstens ±10,5 %, der Suchfaktor liegt zwischen 0,4 und 1,6 und
   ist über den Kader normiert. Ein Stat-80-Spieler bleibt mit jeder Persönlichkeit ein
   Top-Spieler — Chris' Maßstab aus `CLAUDE.md` gilt auch hier.

### 8.3 Wo es schwierig wird

- **Die Menge-Falle vom 02.10. lauert auch hier.** Rollentreue, Kontakt und Teamzug ändern, wie
  oft ein Spieler zu Aktionen kommt — und das kann die Menge seines Beitrags verschieben, wie
  Zusammenhalt und Bindung es taten. Deshalb: **jeder Regler wird je Disziplin einzeln
  zugeschaltet** (`charakter:[…]`) und gegen die Kriterien A–F aus der Opus-Empfehlung gemessen
  (rho je Spiel ≥ Ist + 0,05 ist hier nicht das Ziel — das Ziel ist ≥ Ist − 0,01, weil Charakter
  nichts reparieren, sondern nur nichts kosten soll; Star, Top 2, Paare ≥ 15, Team-Ergebnistreue
  ≥ Ist − 3 Punkte, Pp ≤ Ist + 6). Beginnen auf der Bahn, wo `willTackeln` schon gemessen ist
  (Takeshi 0,859–0,861 mit dem alten Regler), dann Hockey, dann Arena, dann Feldspiel. Ein
  konkreter Fall, den die Messung sehen wird: Football zählt Tackles mit 0,15 in der
  Spielerwertung (`u.checks*0.15`, ~12001) — dort kauft ein hoher Kontakt-Regler also direkt
  Wert, nicht nur Stil. Hockey hat denselben Term am 13.09. gestrichen; Football müsste es vor
  dem Kontakt-Regler ebenfalls, sonst wird der Raufbold dort zum Bonus.
- **Zwei Schichten sind zwei Erklärungen.** Ein Spieler ist Bollwerk **und** Raufbold — das
  kann vorkommen (Tank mit Feisty und Cruel), und der Zuschauer sieht einen, der in der Arena
  vorsichtig steht und auf der Bahn rempelt. Erklärbar („im Kampf ein Bollwerk, im Zweikampf ein
  Raufbold"), aber nicht elegant. Abschnitt 4.4 ist der Weg, das zu prüfen; die Antwort entscheidet
  darüber, ob irgendwann eine Schicht die andere ableitet.
- **Rund 60 Seed-Spieler und ein Teil der generierten haben weder Trait noch ausgeprägtes
  Profil** und bleiben Unauffällig. Das ist ehrlich, aber in einem Kader mit drei Unauffälligen
  wirkt das System weniger als versprochen. Der Generator (`player-generator-service.ts`) vergibt
  Traits aus Archetyp-Präferenzen; ob er sie oft genug vergibt, gehört in die erste Messung.
- **In den fünf Disziplinen, die über den PPS-Pfad laufen** (kein Arena-Ergebnis), gibt es kein
  Verhalten, von dem jemand abweichen könnte. Dort wirkt nur die Slot-Profil-Mischung (8.2) und
  der Nerven-Term — und beides sind Zahlen in einer Tageskette, kein sichtbares Verhalten. Das ist
  weniger, als Chris sich vorstellt, und das sollte man vorher sagen. Je mehr Disziplinen in die
  Arena wandern, desto mehr Charakter wird sichtbar.
- **„Spotlight" und „großer Spieltag" (Rampensau, Auftragskünstler) brauchen Definitionen, die
  es heute nicht gibt.** Derby, Playoff, Tabellennachbar — der Spielplan kennt diese Begriffe
  nicht als Daten. Die erste Fassung sollte die Rampensau nur über eine feste Liste von
  Clutch-Slots (Fußnote 1 in 4.2) und die Schlussphase definieren und den Auftragskünstler auf
  die letzten drei Spieltage beschränken; alles andere ist Stufe 2.
- **Chris' „mehrere Nebenpersönlichkeiten"** habe ich auf eine begrenzt. Mit zwei Neben wären die
  Spannungsfälle nicht mehr benennbar (78 Paare sind lesbar, 286 Tripel nicht), und drei Namen
  an einem Spieler liest niemand. Wenn er darauf besteht, ist der saubere Weg eine zweite Neben
  mit 15 % statt 35 % — aber ohne eigene Spannungsfall-Regeln.
- **Die Zahlen in 4.2 und 6.3 sind Startwerte, keine Ergebnisse.** Sie sind so gesetzt, dass sich
  die Persönlichkeiten unterscheiden und die Deckel aus 8.2 halten. Ob ein Raufbold 2,6 oder 2,2
  Checks je Spiel bekommt, entscheidet die Kalibrierung gegen die gemessene Checkdichte.

### 8.4 Reihenfolge, wenn Chris freigibt

1. **Herleitung als reine Anzeige**, ohne Spieleffekt: Punktemodell, Haupt/Neben,
   Persönlichkeitszeile im Kader und in der Arena. Dazu die Verteilungs-Sonde über Seed-Bestand
   und Kader-Familie (5.4) und die Kampfstil-Übereinstimmung (4.4). Fingerabdruck byte-identisch.
   Das allein ist ein Gewinn: der Manager sieht, wen er hat.
2. **Kontakt und Härte auf der Bahn** (`willTackeln` → Charakter), Takeshi/Spurt/Staffel. Abnahme
   gegen die 06.09.-Zahlen.
3. **Kontakt, Härte, Zielwahl in Hockey** mit Kader-Normierung und Boxscore-Spalten.
4. **Rollentreue als Slot-Profil-Mischung** im Picker, in der KI-Aufstellung und im
   `slotAufschlag` — zuerst in einer Feldspiel-Disziplin, mit dem Spannungs-Hinweis aus 7.3.
5. **Nerven** in den Bühnen-Disziplinen mit klarem Druckmoment (Tennis Tiebreak, Gewichtheben
   dritter Versuch), kleinster Faktor, erste rho-Messung je Disziplin.
6. Spannungsfälle, Anführer-Ausstrahlung, Moral-Kopplung (Söldner, Zerrissener), Rampensau.
7. Eiskunstlauf und die Vier-auf-dem-Eis-Frage aus der Vision — erst, wenn die Strukturfrage
   (Opus) geklärt ist; der Kontakt-Regler ist dann fertig und wartet.

---

## 9. Fragen an Chris

1. **Zwei Schichten** (Kampfstil bleibt, Charakter kommt darüber) oder **eine** (die sechs werden
   zu dreizehn)? Abschnitt 2 empfiehlt zwei; es ist aber eine Frage, wie du das Spiel erklären
   willst.
2. **Eine Nebenpersönlichkeit** statt „eine oder mehrere" — reicht das? (8.3, vorletzter Punkt.)
3. **Rollentreue als Mischung** (8.2, Regel 1): Ein Egomane im Team-Slot spielt zu 70 % sein
   eigenes Profil und kann damit **besser** sein als in der Rolle. Ist das die Art, wie „er macht
   das nicht unbedingt" gemeint ist — oder soll Abweichung immer etwas kosten?
4. **Die Namen.** Egomane, Rampensau, Anführer, Mannschaftsspieler, Raufbold, Dickschädel,
   Eisblock, Pedant, Hasardeur, Schlitzohr, Söldner, Phlegmatiker, Zauderer. Welche stimmen für
   dich nicht? (Englisch wie die Traits — Egomaniac, Showboat, Leader … — wäre die Alternative,
   dann aber überall.)
5. **Schlitzohr und Härte:** Ein Spieler, der absichtlich foult und seltener erwischt wird —
   passt das zum „offensiveren und brutaleren" Ton, oder ist das eine Grenze?
6. **Nerven nirgends gut beim Zauderer** (8.2, Regel 3): akzeptabel als Preis seines Charakters,
   oder soll jede Persönlichkeit auf jedem Regler mindestens einmal die bessere sein?

---

## Geänderte Dateien dieser Runde

Nur dieses Dokument. Keine Änderung an `lib/player-generator/official-discipline-weights.ts`,
`public/mockups/battle-mode.engine.js`, `leitePers()`/`PERS`/`PERSDEF`/`PERSZIEL` oder
irgendeiner Mechanik.

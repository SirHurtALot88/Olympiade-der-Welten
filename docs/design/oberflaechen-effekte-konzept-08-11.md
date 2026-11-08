# Oberflächen-Effekte: Kulissen, die mitspielen — Konzept (08.11.)

Chris, 08.11., sinngemäß: Die Kulissen-Varianten jeder Disziplin (Tennis auf Rasen, Sand oder
Hochhausdach) sollen nicht länger reine Optik sein. „Wenn ich im Tennis auf dem Sandboden spiele
oder auf einer Rasenfläche, dann fühlt sich das für die Spieler anders an." Ein agilerer Spieler
soll sich auf Sand besser zurechtfinden als ein weniger agiler; Sieg, Niederlage und Punktestand
sollen dadurch eine spürbare, aus den Spieler-Fähigkeiten erklärbare Variation bekommen. Und,
wörtlich: „Das ist ganz, ganz wichtig, dass man erkennen kann und es transparent ist, welcher
Spieler ist jetzt aus welchen Gründen warum, wo gut oder schlecht" — im bestehenden
`++ / + / − / −−`-Schema, grün und rot, wie überall sonst im Spiel.

Chris hat am selben Tag zwei Dinge nachgeschärft (festgehalten in
`docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`, PR #1349): **Der Effekt soll im
Mittelfeld wirken, nicht die Spitze stürzen** — „Wenn ein Spieler um die 50 hat und dann aber
einen Boost bekommt … würde das ja auch schon helfen"; ein Takeshi-Spitzenspieler auf
„100"-Niveau darf durch eine ungünstige Variante auf „90" fallen, nicht die Führung verlieren.
Und: **Varianten müssen sich inhaltlich unterscheiden, nicht nur farblich** — „Nicht, dass es
einfach nur verschiedene dunkle Areale sind"; bei Breaking anderes Foltermaterial je Variante,
nicht nur andere Lichtstimmung. Beides ist eingearbeitet (Abschnitt 3.3, Regel 8, die
„Bild dazu"-Zeilen in Abschnitt 5).

**Dieses Dokument ist reines Konzept.** Kein Code, keine Zahl darin ist gemessen; wo eine Zahl
aus dem Repo zitiert wird, steht die Quelle daneben. Die drei Schranken aus `CLAUDE.md` stehen
nirgends zur Debatte: die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`)
bleibt für alle zwanzig Disziplinen byte-identisch; rho je Einzelspiel über 0,80 (angestrebt
0,85); Pp-Abweichung zur Matrix ≤ 25 auf zwei Saatströmen. Der Vorschlag ist so gebaut, dass er
die Matrix nicht nur unangetastet lässt, sondern sie im Saisonmittel exakt wiederherstellt
(Abschnitt 3, Regel 2).

---

## Kurzfassung

- **Eine Kulisse ist ein Rezept-Versatz, kein neues Attribut.** Jede Variante einer Disziplin
  bekommt eine kleine, nullsummige Verschiebung der Attribut-Gewichte, mit denen die Mechanik
  dieser Disziplin ohnehin rechnet — nur Attribute, die in der Matrix (oder im bestätigten
  Override) dieser Disziplin schon über Null stehen. Sand bei Tennis: Stamina +4, Dexterity +3,
  Determination +1; Speed −3, Intelligence −2, Awareness −2, Charisma −1 Gewichtspunkte.
- **Über alle Varianten einer Disziplin hebt sich jede Verschiebung auf.** Die Kulissen-Wahl ist
  ein gleichverteilter Hash (`kulisseWaehlen()`, `public/mockups/battle-mode.engine.js` ~42466),
  also ist das Saisonmittel der Gewichte exakt die Matrix. Die Matrix bleibt die Wahrheit, die der
  Kaderbildschirm, der Transfermarkt und die KI sehen; die Kulisse ist die Tagesform des Bodens.
- **Größenordnung: eine kleine Formkarte, nicht ein Slot-Aufschlag — additiv und gedeckelt.**
  Obergrenze ±4 Gewichtspunkte je Attribut, Summe der Beträge ≤ 16 je Variante, und ein harter
  Deckel von **±5 Eignungspunkten** je Spieler und Variante. Für einen ausgeprägten Spezialisten
  ergibt das ±3 bis ±5, für einen Durchschnittsspieler ±1 — vergleichbar mit einer Formkarte +2
  bis +4, deren Wirkung gemessen ist (`docs/design/formkarten-eignung-ueberall-14-10.md`: +4 bewegt
  einen Tennisspieler um 6 % des Feldes, einen Kletterer um 23 %). Ein additiver Term dieser Größe
  kann nur Paare umdrehen, die näher als rund zehn Punkte beieinander liegen — also das
  Mittelfeld; ein 100er fällt schlimmstenfalls auf 95, Chris' Grenze liegt bei 90 (Abschnitt 3.3).
- **Das Bild trägt die Mechanik.** Eine Variante, die Ausdauer aufwertet, muss nach Ausdauer
  aussehen (längere Ballwechsel, längere Stationen, mehr Weg), nicht nur anders beleuchtet sein.
  Jede Tabelle in Abschnitt 5 trägt deshalb eine Zeile „Bild dazu" als Vorgabe für die spätere
  Kulissen-Arbeit — kein Umsetzungsauftrag, nur die Brücke, damit Zahl und Bild dasselbe sagen.
- **Anzeige = Mechanik, per Konstruktion.** Der Wert, der im Picker als `++` erscheint, ist
  `gewichtet(a, W_variante) − gewichtet(a, W_matrix)` — dieselbe Zielgewichtung, gegen die die
  Pp-Abnahme dieser Variante misst. Verspricht der Picker Sand `++`, muss der Motor Sand `++`
  liefern, sonst fällt die Abnahme durch.
- **Deterministisch und vorher bekannt.** Der bestehende Hash aus Disziplin, Spielsaat, Heim-,
  Gast-ID und Spieltag wird aus dem Motor in eine geteilte Funktion gehoben, damit Spielplan,
  Picker, Manager-Modus (PPS-Pfad) und Arena dieselbe Variante kennen, bevor der Spieltag läuft.
  Beide Seiten spielen auf demselben Platz; die Variation kommt allein daraus, wessen Kader
  besser zum Platz passt.
- **Nicht jede Disziplin eignet sich, und nicht jede sollte jetzt dran.** Tennis, Climbing,
  Gewichtheben, Takeshi, Zeitfahren, Eiskunstlauf und Fechten passen inhaltlich und messtechnisch.
  Speed-Schach, Showcase, Basketball, Battlefield, Mini-DM gehen mit kleiner Amplitude. Wettessen
  ist erzwungen, I-Spy hat mit der Raumwahl schon seine Variante, Breakings zwei „Varianten" sind
  zwei Fassungen derselben Disziplin, und TDM, Hockey, Football tragen die Matrix heute selbst
  nicht — dort wäre ein Oberflächen-Effekt Rauschen auf Rauschen (Abschnitt 6). Breaking
  bekommt stattdessen einen Vorschlag für echte Varianten mit verschiedenem Foltermaterial (5.16).

---

## 1. Was heute da ist — drei Präzedenzfälle, die genau das schon tun

Das Projekt hat das Prinzip „Ort verschiebt Gewichte" an drei Stellen schon gebaut und gemessen.
Das Konzept erfindet nichts, es verallgemeinert.

**1.1 Zeitfahren: das Streckenprofil.** `BAHN_ART["time-trial"].gelaende` (engine.js ~44940)
legt Kurven-, Steigungs- und Abfahrtszonen über die Strecke. Am Berg zählt `bergSkill:"ENDTEMPO"`
als Primärweg (60 %) und `bergNebenSkill:"WUCHT"` als Nebenweg (40 %) — Chris' Mehrwege-Linie in
Geländeform, kalibriert über vier Pp-Schritte (23.09.) bis auf 12,9/13,8 Pp. Das ist exakt der
Mechanismus, den die zehn Zeitfahren-Karten (`DISCIPLINE_SCENES["time-trial"]`, von „Bergzeitfahren
Alpen" bis „Wüste & Hitze") brauchen: nicht ein neues Rezept, sondern je Karte ein eigenes
`gelaende` (Abschnitt 5.4).

**1.2 I-Spy: die Raumwahl.** Archiv/Werkstatt/Salon (`docs/design/i-spy-raumwahl-i1-15-10.md`)
verschieben, welche Rätselart an welchem Fundort liegt — „Die Raumwahl verschiebt die Verteilung
der bestehenden Sub-Skills, nicht ihre Formeln." Logik-Anteil 48,4 / 41,9 / 35,5 % je Raum, alle
drei in der Nähe des Matrixziels 37,6 %, aber klar gegeneinander verschoben. Das ist der Beweis,
dass eine Variante die Attributanteile um rund ±6 Pp bewegen kann, ohne die Abnahme zu reißen.

**1.3 Der organische Mutator.** `MUTATOR_ORGANISCH={art:"flach", jeTreffer:3.5}` (engine.js
~8429) hebt alle zwölf Attribute eines Treffers um 3,5. Zwei Lehren daraus, beide gemessen
(`docs/design/mutator-trait-organische-performance-konzept-29-09.md` Abschnitt 11): Ein für alle
Attribute **gleicher** Zuschlag verschiebt die Anteile nicht und ist Pp-neutral — er ändert aber
auch keine Rangfolge, weil er jeden gleich hebt. Und die rho-Kosten einer Eingriffsgröße dieser
Art liegen gepaart bei −0,007 (Climbing), am Standard-Saatsatz bis −0,025 (Breaking, Climbing).
Die zweite Zahl ist die, mit der jede Variante rechnen muss.

**Die Folgerung für dieses Konzept:** Ein Oberflächen-Effekt, der etwas an der Rangfolge ändern
soll („der Agile ist auf Sand besser"), muss ein **Gefälle** erzeugen, keinen Sockel. Ein flaches
+4 auf jedermanns Dexterity ändert kein einziges Ergebnis. Was Chris meint, ist: die **Steigung**
von Dexterity im Ergebnis muss auf Sand größer sein als auf Rasen. Das ist eine
Gewichtsverschiebung — genau das, was 1.1 und 1.2 machen.

**1.4 Was die Kulisse heute ist.** `kulisseWaehlen(saat)` (engine.js ~42466) wählt beim `reset()`
aus `window.__ARENA_KULISSEN[disc]` per `kulisseHash` (FNV-1a + fmix32, wörtlich
`ispyMischeHash(normalisiereSaat(s))`) über den Schlüssel `disc|saat|heimTeamId|gastTeamId|spieltag`.
Kein `rr()`, kein Zugriff auf `seed`, die Wertung ist byte-identisch (Fingerabdruck
`22f04e06e285`, `docs/design/arena-kulissen-im-motor-03-11.md`). Im Motor gezeichnet sind heute
elf Disziplinen (battlefield, breaking, eiskunstlauf, fechten, i-spy, mini-dm, showcase,
speed-schach, tdm, tennis, wettessen; `battle-mode.kulissen.js`), Speed-Schachs Turniersaal fehlt
dort bewusst. Basketball kam am 07.11. dazu, Football und Hockey sind gerade in Arbeit (Batch 5
im selben Arbeitsbaum, nicht gemergt); die Bahn-Disziplinen zeichnen ihre Kulissen noch nicht.
Die Liste verschiebt sich täglich — vor jedem Profil gilt der Stand von `battle-mode.kulissen.js`.

---

## 2. Der Mechanismus: Kulissen-Profil als Rezept-Versatz

### 2.1 Die Zielgröße

Jede Disziplin hat eine Gewichtsquelle `W_matrix` (`resolveDisciplineWeightProfile(d)`,
`lib/player-generator/spiel-eignung-overrides.ts` — Matrix, bei Football/Mini-DM der bestätigte
Override). Jede Variante `v` einer Disziplin bekommt ein **Kulissen-Profil** `K[d][v]`: eine Liste
`Attribut → Δ Gewichtspunkte`. Die **Variantengewichtung** ist

    W_variante[k] = W_matrix[k] + K[d][v][k]

und der anzeigbare **Oberflächenwert** eines Spielers

    OW(p, v) = gewichtet(a_p, W_variante) − gewichtet(a_p, W_matrix) = Σ_k K[d][v][k] · a_p[k] / 100.

Weil Σ_k K = 0 (Regel 1 unten), hängt `OW` nur von der **Form** des Attributprofils ab, nicht von
seiner Höhe: ein Spieler, der genau die auf dieser Kulisse aufgewerteten Attribute stark hat und
die abgewerteten schwach, bekommt plus; der umgekehrte Typ minus; ein gleichmäßiger Spieler Null.
Das ist exakt Chris' Satz „welcher Spieler aus welchen Gründen wo gut oder schlecht".

### 2.2 Wo der Versatz mechanisch landet — je Chassis

Der Oberflächenwert allein wäre nur Anzeige. Damit er **Mechanik** ist, muss das Rezept der
Disziplin die Variantengewichtung tatsächlich tragen. Das ist je Chassis ein anderer, aber jeweils
bekannter Handgriff:

| Chassis | Disziplinen | Wo der Versatz greift | Vorbild im Repo |
|---|---|---|---|
| Bühne (`BUEHNE_ART`) | Tennis, Fechten, Speed-Schach, Showcase, Eiskunstlauf, Gewichtheben, Wettessen, I-Spy, Breaking | `rezept` wird je Variante abgeleitet: `rezeptFuer(d, kulisseId)` verschiebt die Rollengewichte der **mechanisch schweren** Rollen so, dass `Σ Rollengewicht × Rollenanteil` die Variantengewichtung trifft (Budget-Rechnung wie im Tennis-Kommentar, engine.js ~18952) | Tennis-Pp-Fix 27.09. |
| Feldspiel (`FELDSPIEL_ART`) | Basketball (Football, Hockey später) | dasselbe am Feldspiel-`rezept` | Football-Rezeptrunden |
| Bahn mit `mengeAusEignung` | Climbing, Takeshi | `BASIS_JE_DISC`-Variante: die Eignung `eigW`, auf die alle Sub-Skills reskaliert werden (`f=eigW/m`, engine.js ~39937), wird mit `W_variante` gebildet; zusätzlich der Rezept-Versatz | Climbing-Kalibrierung 16.09. |
| Bahn, Zeitfahren | Time-Trial | **kein** Rezept-Versatz, sondern je Karte ein eigenes `gelaende`-Profil; die Zonen tragen die Gewichte (Abschnitt 5.4) | K5, 07.09. |
| Arena (`baueEinheit`, Pod-Gefecht) | TDM, Battlefield, Mini-DM | Versatz auf `eigWert` über `W_variante` (derselbe Eingang wie `eigMutator()`, engine.js ~36735) und auf die REC-Kampfwert-Rezepte | organischer Mutator |
| PPS-Pfad (Manager-Modus, nicht simulierte Disziplinen) | alle | `OW(p, v)` als additiver Term in der Tageskette direkt nach der Formkarte (`legacy-score-engine.ts`, Reihenfolge s. Mutator-Konzept 1.2) | Formkarten-Jitter |

**Regel „kein Effekt ohne Bild":** Ein Kulissen-Profil ist nur für Varianten zulässig, die der
Motor an diesem Spieltag auch **zeichnet** (Eintrag in `battle-mode.kulissen.js`). Sonst
verspricht der Picker einen Sandplatz, und der Spieler sieht Rasen — das Gegenteil von transparent.
Für Feldspiel und Bahn heißt das: erst die Kulisse in den Motor (offener Punkt in
`arena-kulissen-im-motor-03-11.md`), dann das Profil.

### 2.3 Warum nicht einfach ein Faktor auf einen Sub-Skill

Der naheliegende Weg — „auf Sand zählt AUSDAUER ×1,4" — scheitert an einer Eigenschaft, die der
Tennis-Kommentar selbst festhält: AUSDAUER ist in Tennis „dead-channel-nah", trägt also
mechanisch fast nichts. Ein Faktor auf einen toten Kanal bewirkt nichts, egal wie groß. Der
Versatz muss deshalb auf der Ebene der **Zielgewichte** formuliert werden (Attribut-Pp), und die
Umsetzung entscheidet je Disziplin, über welche mechanisch tragenden Rollen sie ihn realisiert.
Nur so ist „Anzeige = Mechanik" prüfbar: die Pp-Sonde misst Attributanteile, nicht Sub-Skills.

### 2.4 Die Variante vorziehen

Heute entscheidet der Motor die Kulisse erst beim `reset()`. Für den Picker muss sie **vor** dem
Spieltag feststehen. Alle Eingaben des Hashes (Disziplin, Spielsaat aus `buildArenaMatchSeed`,
Heim-/Gast-ID, Spieltag) sind zur Spielplanzeit bekannt. Vorschlag:

1. `waehleKulisse(disziplin, saat, heimId, gastId, spieltag)` als TS-Funktion in `lib/battle/`
   (FNV-1a + fmix32, bit-gleich zum Motor; Gleichheitstest wie bei
   `BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER`).
2. Der Bootstrap-Umschlag der Arena bekommt ein Feld `kulisse` neben `mutatoren`; der Motor nimmt
   es, wenn es da ist, und fällt sonst auf seinen eigenen Hash zurück — byte-identisch für jeden
   bestehenden Aufrufer.
3. Pods (Mini-DM, Battlefield) hashen über die Pod-Saat; alle vier Teams sehen denselben Ort.
4. Der Spielplan zeigt die Kulisse je Begegnung; die Aufstellung liest sie von dort.

Keine neue Zufallsquelle, kein `rr()`, die Wertung ohne Profil bleibt fingerabdruck-gleich.

---

## 3. Die Regeln — was jedes Kulissen-Profil einhalten muss

1. **Nullsumme in der Variante.** `Σ_k K[d][v][k] = 0`. Die Gesamtgewichtung bleibt 100; es gibt
   keinen Platz, auf dem alle besser oder alle schlechter sind, nur Plätze, die anders verteilen.
2. **Nullsumme je Attribut über die Varianten.** `Σ_v K[d][v][k] = 0` für jedes Attribut. Weil der
   Hash gleichverteilt, ist das Saisonmittel der Gewichte die Matrix — was der Kaderbildschirm
   zeigt und wofür die KI kauft, bleibt richtig. Disziplinen mit zwei Varianten sind damit
   automatisch Spiegelbilder.
3. **Nur Matrix-Attribute.** Ein Attribut mit Gewicht 0 in `W_matrix` (bzw. im Override) bleibt 0.
   Tennis bekommt auf keinem Platz Power; Takeshi auf keiner Burg Power.
4. **Amplitude, Stufe 1:** |Δ| ≤ 4 Gewichtspunkte je Attribut, Summe der Beträge ≤ 16 je Variante.
   Das ist die Obergrenze; die Tabellen in Abschnitt 5 bleiben meist bei 8–12. Stufe 2 (±6 / 24)
   nur für Disziplinen mit gemessenem Pp-Puffer ≥ 10 und rho-Puffer ≥ 0,05, und nur nach einer
   bestandenen Stufe 1.
5. **Primärweg bleibt Primärweg.** Das schwerste Matrix-Attribut einer Disziplin sinkt auf keiner
   Variante unter 90 % seines Gewichts (Tennis: Intelligence 22 → nie unter 20). Niemand wird vom
   Erfolg ausgeschlossen, Chris' Mehrwege-Linie: die Kulisse öffnet Nebenwege, sie sperrt keine
   Hauptwege.
6. **Gleicher Platz für beide Seiten.** Die Kulisse ist symmetrisch. Der Spiegeltest
   (`miss-arena-feldspiel-spiegel.mjs`, 0,0 % bei identischen Kadern) muss je Variante halten.
7. **Kein Effekt ohne Bild** (2.2) und **kein Profil ohne Abnahme** (Abschnitt 7).
8. **Das Bild trägt die Mechanik.** Chris: „Nicht, dass es einfach nur verschiedene dunkle Areale
   sind." Eine Variante darf nur dann ein Attribut aufwerten, wenn die Kulisse zeigt, warum: mehr
   Ausdauer heißt längere Wege, längere Ballwechsel, längere Stationen; mehr Beweglichkeit heißt
   sichtbar schwieriger Boden (Rutschspuren, Pflaster, Natureis); mehr Publikum heißt eine volle
   Tribüne, die man sieht. Varianten, die sich nur in Palette und Licht unterscheiden, bekommen
   kein Profil — sie bleiben Optik, bis die Szene den Unterschied trägt (Abschnitt 5, „Bild dazu").
9. **Harter Deckel ±5 Eignungspunkte** je Spieler und Variante (Abschnitt 3.3). Additiv, nicht
   als Faktor: der Term wird auf die Eignung addiert und bei ±5 geklemmt, egal wie extrem das
   Attributprofil ist.

### 3.1 Wie groß wird das für den Spieler?

`OW = Σ K[k]·a[k]/100`. Mit Σ|K| = 16 und einem Profil, das die aufgewerteten Attribute bei 75 und
die abgewerteten bei 35 hat: `0,08·75 − 0,08·35 = 3,2` Eignungspunkte. Ein typischer Spieler
(±10 um sein Mittel) landet bei etwa ±1,2; ein Spezialist (90 gegen 25) bei ±5. Zum Vergleich:
Formkarten liegen bei 2/4/8, der Slot-Aufschlag darüber. **Die Kulisse ist damit die kleinste der
drei Tages-Einflüsse** — groß genug, dass der Spezialist auf seinem Platz sichtbar nach vorne
rückt (Formkarte +4 bewegte in Tennis 6 %, in Climbing 23 % des Feldes), klein genug, dass ein
Stat-80-Spieler auf jedem Platz ein Top-Spieler bleibt (Chris' Maßstab aus `CLAUDE.md`).

### 3.2 Was es rho und Pp voraussichtlich kostet

- **Pp, je Variante gegen die eigene Variantengewichtung:** per Konstruktion dieselbe Aufgabe wie
  heute gegen die Matrix. Wer heute 15 Pp schafft, schafft es gegen `W_variante`, wenn das Rezept
  die Verschiebung sauber trägt.
- **Pp, je Variante gegen die Matrix:** steigt im ungünstigsten Fall um Σ|K| (bis 16). Deshalb
  gilt die Matrix-Schranke für das **Mittel über die Varianten** (Regel 2 macht es zur Matrix) und
  die Varianten-Schranke je Variante (Abschnitt 7).
- **rho je Spiel gegen die Matrix-Eignung:** sinkt, weil die Mechanik absichtlich etwas anderes
  belohnt als die Matrix-Rangfolge. Grobe Schätzung aus der Korrelation von `W_variante` zu
  `W_matrix` (bei Σ|K| ≤ 16 über 0,98) und aus den Mutator-Messungen: −0,01 bis −0,02 je
  Variante, bei Disziplinen mit hoher Kaderrausch-Spannweite auch −0,03. Das ist der Grund, warum
  Climbing (0,814, Spannweite 0,214), Tennis (0,821, Spannweite 0,206) und I-Spy (0,811, Abstand
  0,011) nicht mit voller Amplitude starten dürfen (Abschnitt 6).
- **rho je Spiel gegen die Varianten-Eignung** `eig + OW`: sollte **über** dem heutigen Wert
  liegen, wenn Anzeige und Mechanik übereinstimmen. Das ist die Zahl, die Chris' Transparenz-Satz
  prüft — sie wird mitgemessen, ist aber nicht die Schranke.

### 3.3 Mittelfeld, nicht Spitze — warum der Effekt additiv und gedeckelt sein muss

Chris' Vorgabe (Vision 08.11.): ein Takeshi-Spieler auf „100"-Niveau darf auf einer ungünstigen
Burg höchstens auf „90" fallen und bleibt Erster; ein Spieler „um die 50" soll von einem passenden
Platz spürbar profitieren. Das verlangt drei Eigenschaften, die ein **Faktor** nicht hätte und ein
**additiver, gedeckelter Term** automatisch hat:

1. **Additiv statt multiplikativ.** Ein Faktor ×1,1 gibt dem 100er zehn Punkte und dem 50er
   fünf — genau verkehrt herum. `OW` hängt nach 2.1 nur von der Form des Profils ab, nicht von
   seiner Höhe: der 100er mit gleichmäßigem Profil bekommt Null, der 50er mit Sand-Profil bekommt
   plus. Das ist dieselbe Entscheidung, die der organische Mutator 29.09. an echten Kadern
   getroffen hat („flach, nicht prozentual" — prozentual bekäme der Starke das 3,8-Fache,
   engine.js ~8411), nur mit Vorzeichen.
2. **Harter Deckel ±5.** Nach 3.1 liegt ein Spezialist bei ±3 bis ±5, extreme Profile könnten
   darüber hinaus. Die Umsetzung klemmt `OW` bei ±5 — damit fällt ein 100er auf keinem Platz
   unter 95, mit Puffer unter Chris' 90. In den Chassis, die `eig` direkt als Menge lesen (Arena,
   Climbing, Takeshi, Staffel), ist das eine Zeile neben `eigMutator()`. In den Rezept-Chassis
   (Bühne, Feldspiel) ist das Amplitudenbudget (Σ|K| ≤ 16) der Deckel: der Rezept-Versatz wirkt
   dort über `mische()` ohnehin additiv und beschränkt auf `Σ K·a/100`.
3. **Nur knappe Paare kippen — per Konstruktion.** Ein Term von höchstens ±5 je Spieler kann
   zwei Spieler nur dann vertauschen, wenn sie vorher weniger als zehn Punkte auseinanderlagen
   (beide müssen in entgegengesetzte Richtung laufen, damit es überhaupt zehn sind; realistisch
   sind es fünf bis sieben). Paare ab 15 Punkten Abstand — heute zu 99 % richtig geordnet
   (`CLAUDE.md`) — bleiben es. Die Spitze (der Star hat typischerweise mehr als zehn Punkte
   Vorsprung auf Rang 3) behält ihren Rang; das Mittelfeld, wo sich fünf Spieler auf acht Punkten
   drängen, bekommt die Variation, die Chris meint.

**Was das im Picker heißt:** `++` bedeutet nicht „wird Erster", sondern „gewinnt die knappen
Duelle auf diesem Platz". Der Tooltip (4.2 b) sagt das wörtlich: „liegt diesem Platz klar — macht
bei knappem Abstand den Unterschied."

**Was das in der Abnahme heißt (Abschnitt 7):** zwei Zusatzproben je Variante. Erstens: der
eignungsbeste Spieler (Star) steht auf jeder Variante nicht seltener auf Rang 1 als heute minus
drei Prozentpunkte. Zweitens, die **Mittelfeld-Probe**: Rangbewegung gegenüber dem Platzmittel,
getrennt nach Eignungs-Dritteln — das obere Drittel bewegt sich im Mittel um weniger als einen
halben Rang, das mittlere Drittel darf (und soll) sich mehr bewegen als das obere. Bewegt sich
die Spitze stärker als die Mitte, ist das Profil falsch gebaut, auch wenn rho hält.

---

## 4. Anzeige: wie der Picker sagt, wer wo warum gut ist

### 4.1 Ein Vokabular, fünf Zustände

Das Spiel kennt die Skala schon: `formatMarketDevelopmentTrend()`
(`lib/foundation/tabs/transfermarkt-render-helpers.tsx`) liefert `++ / + / 0 / - / --`; die Arena
färbt Trait-Chips über `.tchip.auf` (`--ok`, grün) und `.tchip.ab` (`--crit`, rot)
(`battle-mode.css:512`); die Aufstellung tönt ihre Chips über `nl-lineup-chip is-<tone>` und
`StatChip tone=…` (`LineupNewLook.tsx`). Der Backlog-Punkt „Rollenkarten im FM27-Stil"
(`uebergabe-samstag-03-11.md` Abschnitt 6.4) will dieselbe Skala für Slot-Profile. Die Kulisse
benutzt exakt diese fünf Zustände, nichts Neues:

| Oberflächenwert `OW` | Zeichen | Ton | Bedeutung im Tooltip |
|---:|:---:|---|---|
| ≥ +2,5 | `++` | grün, kräftig | „liegt diesem Platz klar — macht bei knappem Abstand den Unterschied" |
| +1,0 … +2,5 | `+` | grün | „kommt mit diesem Platz gut zurecht" |
| −1,0 … +1,0 | `0` | gedämpft (im Kompakt-Chip ausgeblendet) | „neutral auf diesem Platz" |
| −2,5 … −1,0 | `-` | rot | „tut sich auf diesem Platz schwer" |
| ≤ −2,5 | `--` | rot, kräftig | „liegt diesem Platz gar nicht — verliert die knappen Duelle" |

Die Schwellen sind an der Formkarten-Skala orientiert (`+` ab einer halben kleinen Karte, `++` ab
etwas mehr als einer kleinen Karte). Sie gelten für alle Disziplinen gleich, damit `++` überall
dasselbe heißt. Glyphe, Farbe und Text stehen immer zusammen — nie Farbe allein (derselbe
Grundsatz wie beim S6/L2-Audit der Slot-Issues in `LineupNewLook.tsx`).

### 4.2 Die vier Orte

**(a) Kulissen-Zeile am Disziplin-Block der Aufstellung.** Über den Slots einer Disziplin, dort,
wo heute Formkarten-Dropdowns und Captain stehen:

    [Bild-Thumbnail]  Sandplatz Riviera · lange Ballwechsel
    Ausdauer ↑  Beweglichkeit ↑  Tempo ↓

Die zwei bis drei Tendenz-Chips sind die größten positiven und negativen Einträge von `K[d][v]`
in Spielersprache (Attribut-Label statt Schlüssel). Tooltip auf der Zeile: die vollständige
Verschiebung in Gewichtspunkten plus der Satz „Über alle Plätze einer Saison gleicht sich das aus
— die Matrix bleibt die Grundlage." Das ist die Stelle, an der der Manager lernt, was der Platz
überhaupt will, bevor er einen Spieler anschaut.

**(b) Chip am Kandidaten und am gesetzten Spieler.** In der Kandidatenliste hinter dem Namen und
im Slot neben dem `Pkt`-Wert ein kleiner Chip `Sand ++` im `nl-lineup-chip`-Stil. Der projizierte
`Pkt`-Wert enthält `OW` bereits; der Chip erklärt, warum sich die Reihenfolge gegenüber dem
Kaderwert verschoben hat. Tooltip, aus denselben Zahlen berechnet, die auch die Mechanik liest:

    Sandplatz Riviera: +2,8 Eignung
    Stamina 82        +3,3   (zählt hier +4)
    Dexterity 71      +2,1   (zählt hier +3)
    Speed 38          −1,1   (zählt hier −3)
    …

Die Beiträge sind `K[k]·(a[k] − Feldmittel[k])/100` — relativ zum Feld dieses Spieltags, damit
„aus welchen Gründen" wirklich die Erklärung ist und nicht nur eine Zahl. Die drei größten
Beträge reichen; der Rest steht hinter „…".

**(c) Spielplan und Spieltag-Vorschau.** Jede Begegnung trägt ihre Kulisse (Label + Thumbnail)
schon im Spielplan, weil der Hash sie kennt. Ein Manager kann so die Woche planen: „Spieltag 7
Tennis auf Sand, Spieltag 12 auf Rasen."

**(d) Arena und Boxscore.** Die Trait-Chip-Zeile der Arena (`tchip`, heute `+Diligent` in
`auf`/`ab`) bekommt je Spieler einen Chip `Sand ++` in derselben Farbe. Die Anpfiff-Zeile im
Protokoll nennt die Kulisse und ihre zwei Tendenzen („Sandplatz Riviera — lange Ballwechsel,
Ausdauer zählt"). Der Boxscore-Fuß wiederholt die Kulisse, damit der Rückblick erklärt, warum
Kiti heute vor Wurzelbert lag.

### 4.3 Was absichtlich NICHT geändert wird

- **Kaderbildschirm, Transfermarkt-Linse, Teamstärke, KI-Kauf, Training:** lesen weiter die Matrix
  (bzw. den Override). Die Kulisse ist ein Spieltags-Einfluss wie Formkarte und Mutator, keine
  neue Eignungsdefinition. Optional, später (mit Stage A des `PlayerDetailDrawer`): eine Zeile
  „Plätze: Rasen +, Sand ++, Dach −" je Disziplin mit Varianten — für Transfers nützlich, aber
  kein Teil des ersten Schritts.
- **Die KI-Aufstellung** (`LineupAiPreviewPanel`, KI-Pick) rechnet mit denselben projizierten
  Werten inklusive `OW`. Sonst hätte der Mensch einen Informationsvorsprung, und die KI stellte
  für den falschen Platz auf.

---

## 5. Die Disziplinen mit Varianten — konkrete Profile

Alle Tabellen: Δ in Gewichtspunkten auf `W_matrix` (bzw. Override), Zeilensumme je Variante 0,
Spaltensumme je Attribut 0, nur Matrix-Attribute. In Klammern das Matrixgewicht. Die Richtung ist
inhaltlich begründet; die exakte Höhe ist ein Startwert für die Kalibrierung, nicht ihr Ergebnis.

### 5.1 Tennis — der Pilot (Court / Riviera / Dach)

Matrix: intelligence 22, awareness 20, spirit 18, stamina 12, dexterity 12, determination 6,
speed 6, charisma 4. Rasen = schnell, flach abspringend, kurze Ballwechsel: Reaktion und Tempo.
Sand = langsam, hoch abspringend, lange Ballwechsel: Ausdauer, Rutschen, Geduld. Hochhausdach =
Hartplatz unter Flutlicht, berechenbarer Absprung, Nacht-Session: der neutrale Platz mit einem
Hauch Showbühne.

| Attribut | Centre Court (Rasen) | Sandplatz Riviera | Hochhausdach (Hart) |
|---|---:|---:|---:|
| awareness (20) | +3 | −2 | −1 |
| speed (6) | +3 | −3 | 0 |
| intelligence (22) | +1 | −2 | +1 |
| stamina (12) | −4 | +4 | 0 |
| dexterity (12) | −1 | +3 | −2 |
| determination (6) | −2 | +1 | +1 |
| charisma (4) | 0 | −1 | +1 |
| spirit (18) | 0 | 0 | 0 |
| Σ Beträge | 14 | 16 | 6 |

Spirit bleibt überall unberührt (drittschwerstes Attribut, Träger von GRUNDLAGE/NERVEN) — das
schützt rho. Intelligence sinkt auf Sand auf 20 (91 %, Regel 5). Chris' Beispiel sitzt in der
Sand-Spalte: Dexterity +3, Stamina +4. Umsetzung im Rezept: die Sand-Variante verschiebt in
GRUNDLAGE (35,8 % mechanisches Gewicht) Anteile von intelligence/awareness zu stamina, lässt
TECHNIK (dexterity 67 / speed 33) stehen und nimmt WAGNIS/SPITZENMOMENT etwas Gewicht; Rasen
umgekehrt, mit mehr TECHNIK-Gewicht und SPITZENMOMENT; Dach bleibt nah am heutigen Rezept.

**Bild dazu.** Sand: sichtbare Rutschspuren hinter der Grundlinie, aufgewirbelter Staub beim
Stopp, die Demo-Ballwechsel in der Szene länger (mehr Schläge je Punkt), Spieler weiter hinter
der Grundlinie. Rasen: abgespielte, braune Flecken an Grundlinie und T-Linie, kurze Ballwechsel,
Netzangriffe, flacher Absprung. Dach: Flutlichtmasten, Nachthimmel, berechenbarer blauer Belag,
volle Zuschauerreihe am Dachrand — die Show-Variante.

### 5.2 Fechten (Piste / Schlosshof)

Matrix: torment 25, dexterity 20, speed 16, awareness 15, power 10, determination 6, health 4,
intelligence 4. Piste = ebene Bahn, Ampel, Licht: Tempo und Lesen. Schlosshof = Kopfsteinpflaster,
Freiluft: Stand und Zähigkeit. Zwei Varianten, also Spiegelbild.

| Attribut | Piste | Schlosshof |
|---|---:|---:|
| speed (16) | +3 | −3 |
| awareness (15) | +2 | −2 |
| intelligence (4) | +1 | −1 |
| dexterity (20) | −3 | +3 |
| health (4) | −2 | +2 |
| torment (25) | −1 | +1 |

Σ Beträge 12. Torment bleibt bei 24/26 (96 %).

**Bild dazu.** Schlosshof: das Kopfsteinpflaster muss unter der Bahn sichtbar bleiben (keine
glatte Piste auf das Pflaster gelegt), Pfützen oder loses Laub auf der Bahn, Fackeln statt
Ampellicht, Wind in den Bannern. Piste: Hochglanz-Metallbahn, Ampeln, Kampfrichtertische —
alles, was Tempo und Sauberkeit sagt.

### 5.3 Eiskunstlauf (Kür in der Halle / Waldsee)

Matrix: charisma 28, dexterity 18, spirit 16, awareness 14, speed 10, intelligence 8,
determination 6. Halle = perfektes Eis, Kampfgericht, Tribüne: Show und Tempo. Waldsee = Natureis
mit Rissen, Kälte, Alpenglühen: Balance und Lesen des Eises.

| Attribut | Kür (Halle) | Waldsee |
|---|---:|---:|
| charisma (28) | +2 | −2 |
| speed (10) | +3 | −3 |
| intelligence (8) | +1 | −1 |
| dexterity (18) | −3 | +3 |
| awareness (14) | −2 | +2 |
| determination (6) | −1 | +1 |

Σ Beträge 12. Charisma bleibt bei 26 auf dem See (93 %).

**Bild dazu.** Waldsee: Risse und matte Stellen im Eis, Schneeverwehungen am Rand, kein
Kampfgericht in Sichtweite, nur eine Handvoll Zuschauer am Ufer — der Lauf ist für sich allein.
Halle: makelloses Eis mit Spiegelung, volle Tribüne, Kampfgericht-Pult, Kiss-and-Cry.

### 5.4 Zeitfahren — Karten als Geländeprofile (Standard + 10 Karten)

Hier braucht es kein Attribut-Profil: der Motor hat `gelaende`, `bergSkill`/`bergNebenSkill`,
`pusteRegen`, `tagesform`. Jede Karte bekommt ihr eigenes `gelaende`; vier Profilklassen, damit
nicht elf Varianten einzeln kalibriert werden müssen:

| Klasse | Karten | Profil (Streckenanteile) | Was dadurch zählt |
|---|---|---|---|
| Standard | Standard | heute: 3 Kurvenzonen à 13 %, 2 Berge | wie gemessen (0,943 / 12,9–13,8 Pp) |
| Berg | Bergzeitfahren Alpen, Etappe Pass, Vulkan | 3 Steigungen, längere Rampen, 1 Abfahrt, 1 Kurvenzone | ENDTEMPO/WUCHT (stamina, torment, dexterity) |
| Flach | Flachsprint Küste, Etappe Küste | keine Steigung, 1–2 kurze Kurvenzonen, lange Geraden | ANTRITT/ENDTEMPO (speed, power, stamina) |
| Technik | Strade Bianche, Hügel & Weinberge, Abfahrt Kamm, Mittelgebirge | 4 Kurvenzonen (Strade: Schotter, breiter), 1 Berg, 2 Abfahrten | TECHNIK/WENDIGKEIT/GESPÜR (dexterity, awareness) |
| Hitze | Wüste & Hitze | Standard-Zonen, aber `pusteRegen` gesenkt, `bergZehr` leicht erhöht | STEHEN/ROBUST (stamina, awareness, intelligence) |

Regel 2 gilt hier als **Flächenregel**: das Mittel der Zonenanteile über alle elf Karten entspricht
dem Standardprofil, damit das Saisonmittel bei der heutigen Kalibrierung bleibt. Pp und rho werden
je Klasse gemessen, nicht je Karte. Voraussetzung: die Zeitfahren-Karten werden überhaupt in der
Arena gezeichnet (heute nur Szenen, Regel „kein Effekt ohne Bild").

**Bild dazu.** Hier ist das Bild die Mechanik: das Höhenprofil der Karte muss mit ihrem
`gelaende` übereinstimmen (die Berg-Karten zeigen die drei Rampen, die Flach-Karten keine), Strade
Bianche zeigt Schotter unter den Kurven, Wüste & Hitze flimmernde Luft und keinen Schatten. Die
Zwischenzeit-Tafeln (`zwischenzeiten`) stehen an den Zonenübergängen der jeweiligen Karte.

### 5.5 Climbing (Kletterhalle / Sandsteinschlucht / Eisfall) — inhaltlich bester Fall, dünnster Puffer

Matrix: stamina 26, determination 16, speed 12, dexterity 12, health 10, power 8, awareness 8,
will 8. Halle = Plastikgriffe, planbar, Tempo. Fels = Reibung, Risse, Lesen der Route. Eis =
Geräte, Wucht, Kälte. Bewusst halbe Amplitude (Σ ≤ 10), weil Climbing mit 0,814 (mit Mutator
0,791–0,803) auf der Schranke steht und `mengeAusEignung` jede Verschiebung auf **alle**
Sub-Skills durchreicht.

| Attribut | Kletterhalle | Sandsteinschlucht | Eisfall |
|---|---:|---:|---:|
| speed (12) | +3 | −2 | −1 |
| stamina (26) | +1 | −1 | 0 |
| awareness (8) | −2 | +2 | 0 |
| will (8) | −1 | 0 | +1 |
| health (10) | −1 | 0 | +1 |
| dexterity (12) | 0 | +3 | −3 |
| power (8) | 0 | −2 | +2 |

**Bild dazu.** Halle: bunte Plastikgriffe in regelmäßigem Raster, Matten, Zeitanzeige. Fels:
Risse, Reibungsplatten, Sandsteinfarbe, kein Griff sieht aus wie der nächste — Lesen der Route
ist das Thema. Eis: Eisgeräte in den Händen der Figuren (Requisite wie Schläger/Hantel), Eiszapfen,
Schlagspuren im Eis, kalter Dunst.

### 5.6 Gewichtheben, Sandsack-Rennen (Lagerhalle / Hafenkai bei Nacht / Oase)

Matrix: power 28, charisma 23, health 16, determination 12, will 7, speed 6, dexterity 6,
stamina 2. Lagerhalle = die Showschicht unter Flutlicht: Kraft und Publikum. Hafenkai = nasser,
rutschiger Kai bei Nacht: Trittsicherheit. Oase = Hitze und Sand: Zähigkeit.

| Attribut | Lagerhalle | Hafenkai | Oase |
|---|---:|---:|---:|
| charisma (23) | +3 | −2 | −1 |
| power (28) | +2 | −1 | −1 |
| speed (6) | +1 | −1 | 0 |
| health (16) | −2 | +1 | +1 |
| dexterity (6) | −2 | +3 | −1 |
| will (7) | −1 | 0 | +1 |
| determination (12) | −1 | 0 | +1 |

Σ Beträge 12 / 8 / 6. Pp heute 19,1 (21,4 mit Mutator) — der Puffer ist klein, deshalb kein
Stufe-2-Kandidat.

**Bild dazu.** Hafenkai: nasse, spiegelnde Planken, Poller und Taue als Stolperstellen auf dem
Weg zwischen den Stationen, Nachtlicht von Kränen. Oase: Sand unter den Füßen (Fußspuren hinter
den Trägern), Hitzeflimmern, längere Wege zwischen Silo und Rampe. Lagerhalle: Flutlicht, Tribüne,
Werbebanden — die Schicht als Show.

### 5.7 Takeshi's Castle (Burg / Eisfestung / Dschungeltempel)

Matrix: will 22, determination 18, charisma 14, intelligence 11, awareness 8, torment 7, stamina 6,
dexterity 6, health 4, speed 4. Dieselben 14 Fallen; Burg = Original mit Kameras und Publikum,
Eisfestung = glatt und kalt, Dschungel = Hitze, Schlamm, schlechte Sicht.

| Attribut | Burg | Eisfestung | Dschungeltempel |
|---|---:|---:|---:|
| charisma (14) | +3 | −2 | −1 |
| intelligence (11) | +1 | −1 | 0 |
| torment (7) | +1 | −2 | +1 |
| determination (18) | +1 | +1 | −2 |
| dexterity (6) | −1 | +3 | −2 |
| stamina (6) | −2 | 0 | +2 |
| awareness (8) | −2 | 0 | +2 |
| health (4) | −1 | +1 | 0 |

Σ Beträge 12 / 10 / 10. Will (22) bleibt überall unberührt.

**Bild dazu — hier zählt Chris' Beispiel besonders.** Dieselben 14 Fallen an denselben Stellen
sind der Mechanik-Anker, aber die Fallen sollen je Burg anders **aussehen und anders schaden**:
Eisfestung = vereiste Wackelbrücke, glatte Rutschfläche statt Schlamm, Eiszapfen-Pendel;
Dschungel = Schlammloch statt Wassergraben, Lianen statt Seile, Nebel, der die nächste Falle
verdeckt; Burg = Kameras, Moderatoren-Turm, Publikum auf den Mauern. Wenn die Fallen nur
umgefärbt sind, gibt es kein Profil.

### 5.8 Speed-Schach (Turniersaal / Stadtpark / Speisewagen) — Rahmen statt Boden

Matrix: intelligence 28, awareness 21, determination 14, will 14, speed 10, dexterity 7,
charisma 6. Es gibt keinen Boden, aber Rahmenbedingungen: Saal = Stille, reines Denken. Park =
Lärm, Wind, Zuschauer: Konzentration gegen Ablenkung, Publikumsfaktor. Speisewagen = Rütteln,
Enge: Figuren sicher setzen, Uhr schnell schlagen. Kleine Amplitude (Σ ≤ 10), weil das Bild
weniger zwingend ist als bei Sand und Rasen.

| Attribut | Turniersaal | Stadtpark | Speisewagen |
|---|---:|---:|---:|
| intelligence (28) | +2 | −2 | 0 |
| awareness (21) | +2 | −2 | 0 |
| will (14) | −1 | +2 | −1 |
| charisma (6) | −1 | +2 | −1 |
| determination (14) | 0 | +1 | −1 |
| dexterity (7) | −1 | 0 | +1 |
| speed (10) | −1 | −1 | +2 |

Achtung: der Turniersaal ist im Motor nicht gezeichnet (eingebrannte Demo-Partien,
`arena-kulissen-im-motor-03-11.md` Batch 2). Solange das so ist, gibt es nur zwei wirksame
Varianten — und Regel 2 verlangt dann ein Spiegelpaar Park/Zug, nicht die Dreiertabelle.

**Bild dazu.** Park: Passanten, die stehen bleiben, Tauben, Wind in den Blättern, ein Hund —
Ablenkung, die man sieht. Speisewagen: die Figuren schwanken leicht mit dem Zug, die Uhr steht
auf einem wackeligen Tischchen, Landschaft zieht am Fenster vorbei. Saal: Stille, Reihen von
Brettern, Schiedsrichter.

### 5.9 Showcase (Theater / Freiluft-Festival / Zirkuszelt)

Matrix: charisma 27, spirit 16, determination 14, power 11, intelligence 10, dexterity 9, speed 8,
health 3, torment 2. Theater = konzentriertes Publikum, Kunst. Festival = Masse mitreißen. Zirkus
= Akrobatik und Kraftakt.

| Attribut | Theater | Festival | Zirkuszelt |
|---|---:|---:|---:|
| charisma (27) | 0 | +3 | −3 |
| spirit (16) | +1 | +1 | −2 |
| intelligence (10) | +2 | −3 | +1 |
| determination (14) | +1 | −2 | +1 |
| power (11) | −2 | +1 | +1 |
| speed (8) | −1 | 0 | +1 |
| dexterity (9) | −1 | 0 | +1 |

Stufe-2-Idee, erst nach bestandener Stufe 1: die Kulisse gewichtet, welche der sechs Acts
(`showcase-s2-sechs-acts-17-09.md`) die Jury stärker bewertet — Zirkus Akrobatik/Kraftakt, Theater
Gesang/Zaubershow. Das wäre ein Struktur-Knopf wie I-Spys Raumwahl.

**Bild dazu.** Zirkus: Manege mit Sägemehl, Trapez und Netz über der Bühne, Kraftakt-Requisiten
(Gewichte, Ketten) im Bild. Festival: Bühne klein, Menge riesig, Handylichter, Fahnen. Theater:
Samt, Logen, ein Publikum, das sitzt und zuhört.

### 5.10 Basketball (Parkett / Street-Court) — kleine Amplitude

Matrix: spirit 22, intelligence 16, awareness 14, charisma 11, speed 10, dexterity 8, power 7,
stamina 6, torment 6. Street-Court = Asphalt, Wind, kein Pfeifen bei jedem Kontakt: Körper und
Trash-Talk statt System. Basketball besteht Pp erst seit Teil 2 der Kalibrierung (Abschnitt 17 in
`stand-aller-disziplinen.md`) mit kleinem Puffer, deshalb ±2.

| Attribut | Parkett | Street-Court |
|---|---:|---:|
| intelligence (16) | +2 | −2 |
| awareness (14) | +1 | −1 |
| dexterity (8) | +1 | −1 |
| power (7) | −2 | +2 |
| torment (6) | −1 | +1 |
| charisma (11) | −1 | +1 |

**Bild dazu.** Street-Court: Risse im Asphalt, Maschendraht, Kettennetz am Korb, Zuschauer am
Zaun, kein Schiedsrichter in der Szene — und sichtbar härtere Kontakte in der Demo. Parkett:
Maserung, Schiedsrichter, Anzeigetafel.

### 5.11 Battlefield, Pod (Eroberung / Wüstenruine)

Matrix: charisma 20, intelligence 16, spirit 16, torment 12, power 10, awareness 10, health 8,
determination 4, stamina 4. Wüste = Hitze, Flugsand, weite Sicht: Zähigkeit und Lesen des Geländes;
Rufe verwehen. Pp liegt je nach k zwischen 4,8 und 20,2 — bei k = 6 ist der Puffer klein, daher ±2.

| Attribut | Eroberung | Wüstenruine |
|---|---:|---:|
| charisma (20) | +2 | −2 |
| intelligence (16) | +1 | −1 |
| spirit (16) | +1 | −1 |
| health (8) | −2 | +2 |
| stamina (4) | −1 | +1 |
| awareness (10) | −1 | +1 |

**Bild dazu.** Wüstenruine: Flugsand, der die Wege zwischen den drei Punkten halb verdeckt,
Hitzeflimmern, Schatten nur an den Säulenstümpfen — die Kämpfer sehen weit, aber laufen schwer.
Eroberung: Wiese, Turm, Altar, Brückenkopf, Banner, die man von überall sieht.

### 5.12 Mini-DM, FFA (Grube / Sägewerk / Strom-Käfig)

Override: torment 21, health 18, power 14, stamina 14, will 12, dexterity 9, intelligence 6,
spirit 6. Grube = Nahkampf im Loch. Sägewerk = dem Blatt ausweichen, Stellung. Strom-Käfig =
Schläge aushalten.

| Attribut | Grube | Sägewerk | Strom-Käfig |
|---|---:|---:|---:|
| power (14) | +3 | −2 | −1 |
| torment (21) | +1 | −1 | 0 |
| dexterity (9) | −1 | +3 | −2 |
| intelligence (6) | 0 | +1 | −1 |
| health (18) | −1 | −1 | +2 |
| will (12) | −2 | 0 | +2 |

Pp 7,7–10,9 lässt viel Platz; rho auf Spielerebene ist aber bei jedem k unter 0,80 (von Chris über
Star/Paartreue freigegeben). Die Abnahme je Variante muss deshalb Star- und Paartreue mitführen.

**Bild dazu.** Die Falle in der Mitte ist schon der inhaltliche Unterschied — sie muss nur im
Kampf sichtbar **tun**, was sie zeigt: das Sägeblatt läuft, die Tesla-Spulen entladen sich, die
Grube hat Rand, an dem man steht. Eine Falle, die nur Dekoration ist, trägt kein Profil.

### 5.13 Wettessen (Jahrmarkt / Nachtmarkt / Festzelt) — ehrlich: erzwungen

Matrix: will 26, health 22, stamina 22, determination 16, intelligence 8, torment 6. Ob am Tag, in
der Nacht oder im Zelt gegessen wird, ändert am Essen wenig. Wenn überhaupt: Festzelt = Hitze und
Lärm (Taktik geht unter), Nachtmarkt = spät und müde (Durchhalten), Jahrmarkt = Schaukampf vor der
Tafel (Taktik, Provokation). Σ ≤ 6, niedrigste Priorität.

| Attribut | Jahrmarkt | Nachtmarkt | Festzelt |
|---|---:|---:|---:|
| intelligence (8) | +2 | 0 | −2 |
| torment (6) | +1 | −1 | 0 |
| stamina (22) | −2 | +2 | 0 |
| health (22) | −1 | −1 | +2 |
| will (26) | 0 | −1 | +1 |
| determination (16) | 0 | +1 | −1 |

**Bild dazu.** Wenn überhaupt: im Festzelt ist die Tafel länger und das Essen schwerer (Haxen
statt Würstchen), auf dem Nachtmarkt sind die Portionen klein und viele (Durchhalten), auf dem
Jahrmarkt steht die Wertungstafel groß im Bild und ein Ansager stichelt. Solange die drei Szenen
nur die Tageszeit tauschen, gilt Regel 8: kein Profil.

### 5.14 Football (Feld / Strand), Hockey (Eisbahn / Bergsee), TDM (Sand / Lava / Frost) — Profile liegen bereit, aber warten

Football: Strand = Sand frisst Tempo, belohnt Ausdauer (stamina +3, power +1, determination +1;
speed −3, awareness −1, dexterity −1; Feld spiegelbildlich). Hockey: Bergsee = Natureis, Wind,
Kälte (dexterity +2, stamina +2, health +1, awareness +1; speed −3, power −1, spirit −1,
torment −1; Eisbahn spiegelbildlich). TDM: Lava zehrt (health +3, stamina +1, determination +1;
power −2, charisma −2, spirit −1), Frost (stamina +2, determination +1, intelligence +1; health −2,
power −1, charisma −1), Sandarena (power +3, charisma +3, spirit +1; health −1, stamina −3,
determination −2, intelligence −1).

Alle drei warten, aus demselben Grund: Football Pp 121 (Abschnitt 14 in
`stand-aller-disziplinen.md`), Hockey rho 0,64–0,69 und Pp 38,5/81,5, TDM rho 0,324 mit
Saison-rho 0,308. Wo die Mechanik die Matrix nicht trägt, ist eine Verschiebung der Matrix um
±3 Punkte nicht spürbar — und die Abnahme je Variante könnte gar nicht bestehen. Erst Rezept,
dann Oberfläche.

### 5.15 Keine Profile

- **I-Spy** (Ruinengarten / Aztekentempel / Lost Place / Horror): hat mit der Raumwahl
  Archiv/Werkstatt/Salon bereits seine spielerische Variante, als **Entscheidung** der Seite, nicht
  als Los. Ein zweiter, zufälliger Versatz obendrauf würde die Raumwahl entwerten. Dazu steht I-Spy
  mit 0,811/0,817 auf der Beobachtungsliste (Abstand 0,011). Empfehlung: Kulisse bleibt Optik, bis
  der Puffer über 0,03 liegt; eine Vierertabelle mit ±2 ließe sich dann nachreichen.
- **Staffel** („Die Runde" / „Stabwechsel"): zwei Kamera-Einstellungen derselben Bahn. **Spurt**:
  eine Variante.

### 5.16 Breaking — die heutigen „Varianten" sind keine, und wie echte aussähen

„Gauntlet" und „Erste Fassung" sind zwei Fassungen derselben Disziplin, keine zwei Orte — die
Registry nennt sie so, und beide zeigen denselben Kerker. Chris' eigenes Beispiel für Regel 8 war
genau Breaking: nicht „verschiedene dunkle Areale", sondern **anderes Foltermaterial je Variante**.
Breaking ist Folter, nicht Breakdance (`CLAUDE.md`): PEINIGT/ERTRÄGT im Wechsel, bis einer
aufgibt. Das Material bestimmt, was das Ertragen kostet — und damit das Profil. Vorschlag für
drei neue Szenen, Matrix will 28, torment 22, health 18, power 10, determination 10, stamina 8:

| Attribut | Spießrutenlauf | Streckbank | Pranger |
|---|---:|---:|---:|
| torment (22) | +3 | −1 | −2 |
| power (10) | +1 | +1 | −2 |
| health (18) | −2 | +3 | −1 |
| stamina (8) | −2 | +2 | 0 |
| will (28) | 0 | −2 | +2 |
| determination (10) | 0 | −3 | +3 |

Spießrutenlauf = viele kurze Hiebe hintereinander: der Peiniger braucht Aggression und
Schlagkraft, der Ertragende Härte — Torment und Power rauf, Health/Stamina runter (es ist schnell
vorbei). Streckbank = eine lange, stetige Belastung: Körper und Atem halten länger, der Wille
entscheidet weniger als die Substanz — Health/Stamina rauf, Will/Determination runter. Pranger =
öffentlich, Spott und Wurfgeschosse vor Publikum: Wille und Entschlossenheit, nicht zu brechen,
gegen den Peiniger, der kaum Kraft braucht — Will/Determination rauf, Torment/Power runter.
Spaltensummen Null, Zeilensummen Null, Σ Beträge 8 / 12 / 10; Will (28) fällt nie unter 26.

**Bild dazu.** Spießrutenlauf: eine Gasse aus Figuren mit Ruten, der Ertragende geht hindurch,
viele kurze Treffer-Animationen. Streckbank: eine Station, langsam, ein Rad, das sich dreht, der
Peiniger steht daneben und wartet; Zeit sichtbar (Sanduhr). Pranger: Marktplatz, Publikum wirft,
der Peiniger höhnt; das Publikum ist Teil der Folter. Erst wenn diese Szenen existieren und im
Motor gezeichnet werden, gilt das Profil — die beiden heutigen Fassungen bekommen keins.

---

## 6. Ehrliche Einordnung: wo es passt, wo es erzwungen ist

| Disziplin | Varianten | Passt inhaltlich | Messbarer Puffer heute | Urteil |
|---|---:|---|---|---|
| Tennis | 3 | sehr gut — drei echte Beläge, Chris' eigenes Beispiel | rho 0,821, Spannweite 0,206; Pp seit 27.09. unter 25, Rest unbekannt | **Pilot**, Stufe 1 voll |
| Zeitfahren | 11 | sehr gut — Gelände ist bereits Mechanik | rho 0,943, Pp 12,9/13,8 | nach Klassen, sobald Karten gezeichnet werden |
| Climbing | 3 | sehr gut — Material der Wand ist der Sport | rho 0,814 (0,791–0,803 mit Mutator), dünn | halbe Amplitude, erst nach Tennis |
| Gewichtheben | 3 | gut — Boden und Hitze bei körperlicher Arbeit | rho 0,843, Pp 19,1–21,4 | Stufe 1, Σ ≤ 12 |
| Takeshi | 3 | gut — Eis und Schlamm an denselben Fallen | rho 0,874–0,898 | Stufe 1 |
| Eiskunstlauf | 2 | gut — Natureis gegen Halleneis | rho 0,878, Pp 19,9/17,8 | Stufe 1 |
| Fechten | 2 | gut — Pflaster gegen Piste | rho 0,825–0,860 | Stufe 1 |
| Showcase | 3 | mittel — Publikum statt Boden, aber stimmig | rho 0,896 | Stufe 1 klein |
| Speed-Schach | 3 (2 gezeichnet) | mittel — Rahmen, nicht Boden; Saal fehlt im Motor | rho 0,906 | klein, als Spiegelpaar |
| Basketball | 2 | mittel — Asphalt ist ein echter Unterschied, aber Pp knapp | rho 0,810, Pp knapp unter 25 | ±2, nach den Bühnen |
| Battlefield | 2 | mittel — Hitze und Sicht; Pp je k verschieden | rho 0,861–0,923, Pp bis 20,2 | ±2 |
| Mini-DM | 3 | mittel — die Fallen sind das Bild | Pp 7,7–10,9; rho Spieler < 0,80 (freigegeben) | ±2–3 mit Star/Paartreue |
| Wettessen | 3 | schwach — Essen ist Essen | rho 0,872 | zuletzt, oder gar nicht |
| I-Spy | 4 | hat schon eine Variante (Raumwahl) | 0,811/0,817, Abstand 0,011 | warten |
| Football, Hockey, TDM | 2/2/3 | gut, aber Mechanik trägt die Matrix nicht | Pp 121 / Pp 38–81, rho 0,64 / rho 0,32 | erst Rezept |
| Breaking | 2 Fassungen | heute keine Orte; mit drei Foltermaterial-Szenen (5.16) sehr gut | rho 0,833 (0,808 mit Mutator), Spannweite 0,250 | erst neue Szenen, dann Stufe 1 klein |
| Staffel, Spurt | — | keine echten Orts-Varianten | — | kein Profil |

Die Zahlen stammen aus `docs/design/stand-aller-disziplinen.md` (Abschnitt 1 und Nachträge) und
`mutator-trait-organische-performance-konzept-29-09.md` 11.3; vor jedem Piloten sind sie frisch zu
ziehen (`node scripts/miss-alle-disziplinen.mjs 24 <d>`, `node scripts/messe-arena-einfluss.mjs
<d> 24` auf zwei Strömen).

---

## 7. Abnahme je Variante — was gemessen werden muss, bevor ein Profil scharf geht

Die Pflichtprüfung aus `CLAUDE.md` bleibt, sie bekommt nur eine Dimension mehr. Vorher braucht es
drei kleine Werkzeug-Erweiterungen, alle rein additiv:

- `einflussVon(dId, n, {kulisse})`, `disziplinProbe({kulisse})`, `formEinflussVon(…, {kulisse})`:
  dieselbe Pinning-Idee wie `kulisseQa(id)` heute, aber in den Sonden statt nur fürs Bild.
- `scripts/miss-alle-disziplinen.mjs <n> <d> --kulisse=<id>|alle` und
  `scripts/messe-arena-einfluss.mjs <d> <n> --kulisse=<id>|alle --ziel=matrix|variante`.
- `scripts/pruefe-wertung-fingerabdruck.mjs` als Beleg, dass ohne Profil alles byte-identisch
  bleibt (wie bei jeder Kulissen-Runde bisher).

Dann je Disziplin, je Variante, zwei Saatströme, n ≥ 24, kaderfest:

| Zahl | Schranke | Warum |
|---|---|---|
| rho je Spiel gegen Matrix-Eignung, **je Variante** | > 0,80 | `CLAUDE.md`, unverändert — die Matrix bleibt die Wahrheit, auch an einem Sandtag |
| rho je Spiel gegen Matrix-Eignung, **Mittel über Varianten** | ≥ heutiger Wert − 0,01 | der Saison-Spieler darf nichts verlieren |
| rho je Spiel gegen Varianten-Eignung `eig + OW`, je Variante | ≥ rho gegen Matrix derselben Variante | Transparenz-Probe: der Platz belohnt, was der Picker ankündigt |
| Pp gegen `W_variante`, je Variante | ≤ 25 | das Rezept trägt die Verschiebung, nicht nur die Anzeige |
| Pp gegen Matrix, Mittel über Varianten | ≤ 25 | Regel 2 in Zahlen |
| Star auf Rang 1 / erste zwei, je Variante | ≥ heutiger Stand − 3 Prozentpunkte | Chris' 100-bleibt-vorn-Regel (3.3) |
| Paare ab 15 Punkten Abstand, je Variante | ≥ 98 % | große Abstände bleiben unangetastet — per Konstruktion, aber gemessen |
| Mittelfeld-Probe: Rangbewegung je Eignungs-Drittel, je Variante | oberes Drittel < 0,5 Ränge im Mittel; mittleres Drittel ≥ oberes | der Effekt sitzt in der Mitte, nicht an der Spitze (3.3) |
| Deckel: größter Betrag von `OW` über alle Spieler und Varianten | ≤ 5 | Regel 9; bei Rezept-Chassis aus dem Amplitudenbudget (Summe der Beträge ≤ 16) abgeleitet und nachgerechnet |
| Spiegeltest, je Variante | 0,0 % | gleicher Platz für beide |

Fällt eine Variante durch, wird **ihr** Profil halbiert, nicht das der Disziplin gestrichen — und
Regel 2 verlangt dann, die anderen Varianten mitzuziehen.

---

## 8. Reihenfolge

1. **Fundament, ohne Spieleffekt:** `waehleKulisse()` in `lib/battle/`, Bootstrap-Feld `kulisse`,
   Spielplan zeigt die Kulisse je Begegnung, Kulissen-Zeile im Picker (noch ohne Chips).
   Fingerabdruck byte-identisch. Das ist auch ohne Profile ein sichtbarer Gewinn: der Manager
   weiß vorher, wo gespielt wird.
2. **Sonden** (Abschnitt 7).
3. **Pilot Tennis** (5.1): Profil, Rezept-Ableitung, Chips, Tooltips, Arena-Chip, Protokollzeile.
   Volle Abnahme. Erst wenn Tennis steht, ist das Muster bewiesen.
4. **Gewichtheben, Takeshi, Fechten, Eiskunstlauf** — je ein PR, je Abnahme.
5. **Climbing** mit halber Amplitude; **Showcase, Speed-Schach** klein.
6. **Zeitfahren-Klassen**, sobald die Karten im Motor gezeichnet werden.
7. **Basketball, Battlefield, Mini-DM** mit ±2.
8. Football, Hockey, TDM nach ihren Rezeptrunden; I-Spy nach Puffer; Wettessen zuletzt oder nie.

---

## 9. Offene Fragen an Chris

1. **Sand und Beweglichkeit:** Die Tabellen folgen deiner Intuition (der Agile ist auf Sand und
   Pflaster besser). Bei Tennis ließe sich auch argumentieren, Rasen sei der Platz der Beweglichkeit
   (Reaktion auf den flachen Absprung). Passt die Verteilung in 5.1 so?
2. **Schwellen:** `++` ab +2,5 Eignungspunkten, `+` ab +1,0 — oder lieber strenger, damit `++` nur
   echte Spezialisten bekommen (z. B. ab +3,5)?
3. **Heimrecht als Stufe 3:** Soll ein Team je Disziplin einen Heimplatz wählen dürfen (Saisonstart),
   den die Heimspiele dann tragen, statt überall das Los? Das wäre eine echte Kaderplanungs-Ebene
   (ein Sand-Kader baut sich seinen Sandplatz), bricht aber Regel 2 für Heimspiele — die
   Auswärtsspiele müssten das ausgleichen, und die KI bräuchte eine Platzwahl-Logik.
4. **Kaderbildschirm:** Soll die Zeile „Plätze: Rasen +, Sand ++, Dach −" je Disziplin in den
   Spieler-Drawer (Stage A), oder bleibt die Kulisse bewusst ein reiner Spieltags-Einfluss?
5. **Showcase-Acts und I-Spy-Räume als Struktur-Knöpfe** (5.9, 5.15): nach Stufe 1 eine eigene
   Runde, oder gar nicht?
6. **Breaking-Foltermaterial** (5.16): sind Spießrutenlauf, Streckbank und Pranger die drei, die
   du meinst — oder andere? Die Szenen sind neue Assets und gehören in die Kulissen-Spur, nicht in
   diese.
7. **Deckel ±5:** reicht dir das als Übersetzung von „100 fällt höchstens auf 90" (es wären
   höchstens 95), oder soll der Deckel bewusst bei ±8 liegen, damit die Mitte mehr Spielraum hat?

---

## Geänderte Dateien dieser Runde

Nur dieses Dokument. Keine Änderung an `lib/player-generator/official-discipline-weights.ts`,
`public/mockups/battle-mode.engine.js` oder irgendeiner Mechanik.

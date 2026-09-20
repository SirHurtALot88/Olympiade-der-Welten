# Krit, Wucht und Ausweichen in der Basisformel — ein bepreister Entwurf (Fable-Recherche, 20.09.)

**Reine Konzeptarbeit. Keine Zeile Engine-Code, keine Messung, die eine eingecheckte Basislinie
anfasst.** Stand `origin/main` = `c95d4867` (20.09., nach PR #976). Zeilenangaben ohne Dateinamen
meinen `public/mockups/battle-mode.engine.js` in genau diesem Stand. Die drei Vordokumente
(`opus-synthese-universelles-kampfmodell-20-09.md`, `opus-gegencheck-kampfmodell-spielsysteme-20-09.md`
auf Branch `gegencheck-kampfmodell-spielsysteme-20-09`, `opus-konvergenz-kampfmodell-debatte-20-09.md`)
sind vollständig gelesen; was dieses Dokument von ihnen übernimmt, steht mit Fundstelle, wo es
ihnen widerspricht, steht die Zahl daneben.

**Was Chris entschieden hat — und was hier deshalb nicht neu verhandelt wird.** Die Synthese
(Abschnitt 3) und der Gegencheck (Abschnitt 2) empfehlen, Krit und Ausweichen auf die Skill-Ebene
(S1) zu legen und nicht in die Basisformel. Die Konvergenz stellt das als Frage 3 an Chris. Chris
hat mit **Nein** geantwortet: Krit und Ausweichen gehören in die **Basisformel**, aus den zwölf
Attributen gerechnet — Assassinen sollen hohen Schaden entweder über hohe Krit-Chance plus hohen
Krit-Schaden **oder** über hohen Flachschaden mit wenig Krit erreichen, als Bauweise-Abwägung. Und
die Auflage dazu, wörtlich: *„Alle Anpassungen und Sub Skills usw müssen in Summe am Ende in den
Skillwert also die Eignung mit einfließen."* Zur Frage 4 der Konvergenz (ob sein Matrix-Satz vom
05.09. auch ein **neues Subskill-Feld** deckt) hat er ebenfalls ja gesagt: *„gilt auch für neue
Subskill-Felder"*.

Damit ist das **Ob** entschieden. Dieses Dokument beantwortet nur das **Wie** — und zwar so, dass
die drei Einwände der Vordokumente nicht wegdiskutiert, sondern konstruktiv gelöst werden:
das Matrixgewicht-Null-Problem (Synthese 3.3, Gegencheck 2.1), die Parade-Falle (Synthese 3.1)
und die Fire-Emblem-Doppelverwertung (Gegencheck 2.2).

---

## 0. Der Vorschlag in einem Absatz

> **Drei neue, benannte Subskill-Zeilen im Rezept — SCHWACHSTELLE (Krit-Chance), WUCHT
> (Krit-Höhe), AUSWEICHEN (Streifband) — die wie ANG/VER/LP aus Matrix-Attributen gemischt werden
> und deren Erwartungswirkung in `rohKraft()` und damit in die Normierung `aufEignung()` eingeht.**
> Das heißt: ein Kämpfer mit hoher Krit-Bauweise bekommt seinen Flachschaden und seine Zähigkeit so
> weit heruntergesetzt, dass seine *erwartete* Kampfkraft exakt proportional zur Eignung bleibt —
> genau wie heute schon „Rezepte geben die FORM, die Eignung gibt die MENGE" (`:5300-5303`). Chris'
> Abwägung entsteht damit als Formunterschied bei gleicher Menge: Burst gegen Stetigkeit. Die
> Wahrscheinlichkeit selbst wird **nicht** skaliert (die Kappung, die den letzten Anlauf ruiniert
> hat, kommt gar nicht vor), Krits verschlucken **kein** Ereignis (ein Krit ist ein Treffer mit
> mehr Höhe), Ausweichen ist ein **Streifer** mit halber Höhe und kein Fehlschlag, und beides läuft
> über ein **deterministisches Ladungsmodell** statt über einen freien Wurf — kein neuer
> `rr()`-Aufruf, was die Bit-Identität der siebzehn anderen Disziplinen und jeder Arena-Disziplin
> ohne diese Zeilen **durch Konstruktion** liefert.

Und die zwei ehrlichen Sätze dazu, bevor es losgeht:

1. **Die Arena ist heute nicht rho-messbar** — M0 (PR #979) hat es nachgewiesen, nicht vermutet:
   selbst bei 16 disjunkten Paarungen (dem realen Maximum des Spielstands) liegt die Unsicherheit
   des Medians bei 0,238 / 0,347 / 0,277, alle drei über der 0,20-Schranke. **Eine rho-Abnahme
   dieser Mechanik in der Arena ist deshalb heute nicht möglich**, und dieses Dokument tut nicht
   so. Was heute messbar ist, steht in Abschnitt 7 — es ist mehr, als man denkt, aber es ist
   nicht rho.
2. **Die Konstanten der Formeln sind gesetzt, nicht abgeschrieben.** Keine der 35 Klassenkarten
   führt Krit (`:4673-4675`); der Abschrift-Vertrag (`docs/BATTLE_ARENA_UEBERGABE.md`, „Keine
   erfundenen Werte") verlangt, dass so etwas *markiert* wird, nicht verteidigt. Die Normierung
   macht die Konstanten zu reinen Formparametern (Abschnitt 3), aber ihre Wirkung auf die
   Kampfdynamik muss **gemessen** werden. Deshalb: **erst eine Sonden-/Daten-PR, dann eine
   Rezept-PR** (Abschnitt 8) — nicht eine Formel mit Zahlen, die sich hinterher niemand
   erklären kann.

---

## 1. Was heute im Code steht — die Fakten, an denen der Entwurf hängt

Alles nachgelesen, nicht aus den Vordokumenten übernommen.

| Befund | Fundstelle | Warum es hier zählt |
|---|---|---|
| Ein Kampfwert ist ein gewichteter Attributschnitt, auf 1..99 geklemmt: `mische(p,rez)` | `:5113-5114` | Ein neuer Subskill ist **dieselbe** Bauart — eine Rezeptzeile, keine neue Wertquelle |
| `stats()` mischt genau die fünf Werte in `KEYS=["LP","ANG","VER","TMP","AUS"]` | `:4690`, `:18104-18107` | Neue Zeilen heißen: `KEYS` erweitern **oder** die Zeilen separat mischen; beides klein |
| `rohKraft(s) = LP·(1+VER/100)·(ANG/50)`; `aufEignung()` findet per Bisektion den Faktor f, mit dem LP, ANG, VER gemeinsam skaliert werden, bis `rohKraft = Referenz·eig/50` | `:5308-5343` | **Das ist der Ort, an dem eine Größe bepreist wird.** Was in `rohKraft` steht, wird auf die Eignung normiert; was nicht drinsteht (TMP, AUS), kauft unbepreist |
| TMP/AUS wurden testweise mitnormiert und das machte 23 von 24 Kämpfen zu 6:0 — Kappung nahm der KI die Bewegungsfreiheit | `:5344-5363` | Der Blowout-Präzedenzfall betrifft die **Normierung eines Bewegungs-/Gelegenheitskanals**. Ein Höhenfaktor ist etwas anderes (Abschnitt 3.2) |
| Krit ist ein leerer Haken: `const crit=false; // Krits kommen kuenftig aus dem Skill` mit Multiplikator 1,5 | `:19627-19628` (Nahkampf), `:20176-20177` (Pfeil) | Der Multiplikator-Pfad existiert; er wartet auf eine Quelle |
| Parade ist ausgebaut: „bis zu 40 % aller Schläge verschluckt … `0,20 + (Tempo des Ziels − Präzision)/300`" | `:19616-19625` | Das war ein **Fehlschlag**-Modell auf einem **unbepreisten** Attribut (Präzision, ein erfundener siebter Wert) — beides vermeidet dieser Entwurf |
| `treffer()` bucht `verh` (verhinderter Schaden) als Leistung des Verteidigers; Schild-Absorption wird dem Zauberer als Heilung gutgeschrieben | `:19578-19599` | Ein Streifer kann exakt in diese Buchhaltung — verhinderte Höhe zählt, verschluckte Ereignisse gäbe es nicht |
| `beitragVon(u) = dmg + heal + schild + verh·0,4 + koAnteil·140` ist die Größe, gegen die rho gemessen wird | `:21080` | Krit-Schaden zählt als `dmg`, Streif-Ersparnis als `verh` — beides ist schon Teil des Maßstabs |
| Mini-DM-Rezept: `TMP:{dexterity:40,stamina:32,torment:28}`; Matrix `torment 24, health 20, power 16, stamina 16, will 14, dexterity 10` — **awareness und speed Gewicht 0** | `:5449`, `:5461-5465`, `:4855` | Chris' „Awareness findet Schwachstellen" ist in Mini-DM **nicht bepreisbar**, in Battlefield (awareness 10) und TDM (2) schon |
| Battlefield: `TMP:{awareness:36,intelligence:34,charisma:30}` | `:5511` | Awareness sitzt dort bereits im Gelegenheitskanal — für die Ein-Hebel-Regel entscheidend (Abschnitt 5.2) |
| Die Bühne führt seit Monaten **benannte Chance- und Höhen-Rollen**: TECHNIK/NERVEN entscheiden das Gelingen, SPITZENMOMENT×WAGNIS die Höhe des Bonus, `failAbzug` die Höhe des Misslingens (Fechten 0,55 — ein Streifer, kein Nuller) | `:5530-5551`, `:13152-13166`, `:12986-12987` | **Der Präzedenzfall, den die Vordokumente nicht nennen:** Chance- und Höhen-Subskills mit gemessenem mechanischem Gewicht (SPITZENMOMENT 9,4–11,6 %, WAGNIS 5,6–6,5 %) laufen bei Fechten mit rho 0,826 — über der Schranke |
| Das mechanische Gewicht eines Subskills wird mit einem **orthogonalen Rezept** gemessen (je Subskill genau ein Trägerattribut) | `scripts/sondiere-feldspiel-subskills.mjs`, Kopfkommentar | Das ist das Werkzeug, mit dem ein neuer Subskill sein Gewicht **bekommt** — heute für `rezepte.js` und `FELDSPIEL_ART`, für `ARENA_ART` fehlt der Zweig (Abschnitt 7.3) |
| `einflussVon()` misst je Attribut den Gewinn bei +15 und rechnet die **Abweichung zur Matrix in Pp**; Basketball/Fechten liegen bei 14,9–44,7 Pp, TDM bei 54,2 Pp | `:29601-29643`, `:4424`, `fechten-aufwertungsplan-17-09.md` 2.2 | Die Zahl, an der sich „unbepreister Kanal" **ohne** rho ablesen lässt — und die in der Arena nicht am Kaderrauschen hängt |
| Eignung im Spiel: `calculateRawDisciplineScore` summiert Attribut×Gewicht aus `resolveDisciplineWeightProfile` (Override, sonst Matrix) | `lib/player-formulas/discipline-rating-engine.ts:36-49`, `lib/player-generator/spiel-eignung-overrides.ts:111-115` | „In die Eignung einfließen" hat genau **einen** Weg: über Attribute mit Gewicht > 0 in dieser Quelle |

**Und die Zahlen, an denen niemand vorbeikommt.** Die drei Arena-Disziplinen wurden in dieser
Woche mit drei verschiedenen Zahlen zitiert, alle „kaderfest, n=24":

| | TDM | Mini-DM | Battlefield | Quelle |
|---|---:|---:|---:|---|
| rho je Spiel, 5 Paarungen, 04./06.09. | 0,253 | 0,094 | 0,387 | `arena-tempo-schlagfrequenz.md` §3, `stand-aller-disziplinen.md:231-233` |
| rho je Spiel, 5 Paarungen, Basislinie 16.09. | 0,165 | 0,256 | 0,251 | `data/generated/rangtreue-basislinie.json` |
| rho je Spiel, **16** Paarungen, M0 20.09. | 0,104 | 0,153 | 0,325 | PR #979 |
| Median-Unsicherheit (90-%-CI-Breite), 16 Paarungen | **0,238** | **0,347** | **0,277** | PR #979 |

Dass Mini-DM zwischen 0,094 und 0,256 pendelt, ohne dass jemand die Mechanik angefasst hat, ist
der M0-Befund in einer Zeile. **Jede rho-Aussage über diese Mechanik in der Arena wäre heute eine
Aussage über Rauschen.** Abschnitt 7 zieht daraus die Konsequenz, statt sie zu übergehen.

---

## 2. Die drei Subskills — was sie messen und woraus sie kommen

Die Namen folgen der Bühnen-Konvention (eine Rolle sagt, *was* sie im Spiel bewirkt, nicht welches
Attribut sie trägt) und Chris' eigener Wortwahl.

| Subskill | Bewirkt | Entspricht bei Chris | Bühnen-Verwandter |
|---|---|---|---|
| **SCHWACHSTELLE** | wie oft ein Treffer kritisch ist (Krit-Chance) | „mit awareness findet man ja schwachstellen" | TECHNIK/NERVEN (Gelingchance) |
| **WUCHT** | wie viel ein kritischer Treffer mehr trägt (Krit-Höhe) | „torment in kombination mit dex oder speed kann zu hohem dmg führen" | SPITZENMOMENT×WAGNIS (Bonushöhe) |
| **AUSWEICHEN** | wie oft ein *eingehender* Treffer nur streift (halbe Höhe) | „tempo etc sollten auch für agilität … eine rolle spielen" | `failAbzug` (Misslingen kostet, wirft nicht auf null) |

Jede ist eine Rezeptzeile `{attribut:prozent}` und wird mit `mische()` auf 1..99 gebracht — exakt
wie ANG. Die Umrechnung in Spielgrößen (Konstanten **gesetzt**, s. Abschnitt 8 zur Kalibrierung):

    p_krit    = 0,05 + SCHWACHSTELLE / 400      → 1: 5,3 %   50: 17,5 %   99: 29,8 %
    m_krit    = 1,5  + WUCHT / 200              → 1: 1,505   50: 1,75     99: 1,995
    p_streif  = 0,05 + AUSWEICHEN / 500         → 1: 5,2 %   50: 15,0 %   99: 24,8 %
    Streifer trägt 50 % der Höhe

Warum diese Spannen: die Krit-Chance bleibt unter 30 %, das Streifen unter 25 %, und beide haben
einen Boden von 5 % — damit **jeder** Kämpfer gelegentlich einen Beat bekommt, aber niemand die
Hälfte seiner Treffer in einer Sonderform erlebt (die Parade lag bei 20 % Mitte, 5–40 % Spanne, und
40 % waren der Schaden). Der Multiplikator 1,5 ist der Wert, der heute schon am toten Haken steht
(`:19628`); 2,0 als Decke ist die Größenordnung, bei der ein Krit als „doppelt" lesbar ist.
**Das sind Formentscheidungen, keine Messwerte** — Abschnitt 3 zeigt, warum sie die Menge nicht
berühren.

**Fehlt eine Zeile im Rezept, ist der Kanal aus:** `p_krit = 0`, `m_krit = 1`, `p_streif = 0`.
Damit sind TDM, Battlefield und alle siebzehn Nicht-Arena-Disziplinen ohne Rezeptänderung
Zeichen für Zeichen unverändert — nicht „vermutlich", sondern weil kein Term ungleich eins
entsteht (Abschnitt 5.3).

### 2.1 Wie ein Treffer abläuft — das Ladungsmodell, kein Wurf

Der Gegencheck (2.4/2.5, Leitplanke L3) ist hier bindend: **„Wenn gewürfelt wird: gebunden und
früh."** Ein freier `rr()`-Wurf je Schlag wäre Output-Zufall und würde direkt von der Abnahmezahl
bestraft. Der Entwurf würfelt deshalb **gar nicht**:

- Jede Einheit trägt eine **Ladung** `ladung` (Start 0,5). Bei jedem eigenen Treffer:
  `ladung += p_krit`; ist `ladung ≥ 1`, ist dieser Treffer kritisch und `ladung −= 1`.
- Jede Einheit trägt eine **Deckung** `deckung` (Start 0,5). Bei jedem eingehenden Treffer:
  `deckung += p_streif`; ist `deckung ≥ 1`, streift dieser Treffer und `deckung −= 1`.

Das ist der deterministische Grenzfall der Pseudo Random Distribution aus Warcraft 3 / Dota 2, die
der Gegencheck als das eine Werkzeug benennt, das rho je Spiel heben kann, ohne die Validität
anzufassen. Bei `p_krit = 0,275` über zwölf Schläge: `.K...K...K..` — drei Krits, Erwartung 3,3,
Streuung null. Der Anteil über ein Spiel ist exakt `p` (±1 Treffer), zwei Krits hintereinander
sind unmöglich, und — der Nebengewinn, den der Gegencheck (3.4, Darkest Dungeon) als das sauberste
Spannungsmittel überhaupt beschreibt — **die Ladung ist ein sichtbar sich füllender Balken auf
eine Schwelle.** „Schwachstelle gefunden!" ist damit ein angekündigter Moment, kein Würfelglück.
Genau der Beat 3 aus dem B0-Drehbuch, nur dass er diesmal aus der Mechanik kommt.

Wer es „zufälliger" will, nimmt PRD mit Zählerinkrement statt der Ladung — derselbe Erwartungswert,
etwas mehr Streuung. Ein unabhängiger `rr()`-Wurf je Schlag ist in beiden Varianten
**ausgeschlossen**, und zwar nicht nur aus rho-Gründen: er würde den gemeinsamen Ziehungsstrom
aller vier Chassis verschieben (es gibt genau einen `rr()`, `:19325`, 193 Aufrufstellen —
PM-Plan Abschnitt 2), und die Isolationspflicht wäre nicht mehr trivial nachweisbar.

### 2.2 Wo die Höhe hingeht

- **Krit:** `roh = skillSchaden(u,sk,mult) · (crit ? m_krit(u) : 1)` an genau der Stelle, an der
  heute `(crit?1.5:1)` steht (`:19628`, `:20177`). Der Krit-Schaden geht durch `treffer()` wie
  jeder andere und landet in `von.st.dmg` — er **zählt** im Maßstab, so wie ein großer Versuch
  auf der Bühne zählt.
- **Streifer:** in `treffer()` wird `roh·sd` vor der Verteidigungsminderung halbiert; die
  weggenommene Hälfte wird dem Ziel als `st.verh` gutgeschrieben — dieselbe Buchhaltung wie die
  Verteidigungsminderung selbst („die Differenz zwischen dem, was ankam, und dem, was angekommen
  wäre", `:19580-19584`). Der Schlag passiert, wird gezeigt, zählt; nur seine Höhe ist halb. Kein
  Ereignis verschwindet.
- **Anzeige:** die drei Werte stehen auf der Karte (K1), so wie XCOM und Fire Emblem sie auf dem
  Bogen führen — das ist die Antwort auf den Gegencheck-Befund, dass Krit und Ausweichen in jedem
  erfolgreichen System **ausgewiesene** Werte sind und keine stillen Ableitungen (2.1). Sie sind es
  hier: benannt, im Rezept, auf der Karte, im Ticker („weicht aus!", „SCHWACHSTELLE ×1,8").

---

## 3. Das Matrixgewicht-Null-Problem — gelöst an der Wurzel, nicht am Rand

Das ist der wichtigste Abschnitt. Die Synthese (3.3) sagt: „Awareness → Krit" in Mini-DM gäbe einem
Attribut mit Matrixgewicht null einen Effekt erster Ordnung — „Zeile für Zeile derselbe Fehler, der
TDM kaputtgemacht hat (Speed 46 bei Matrixgewicht 0)". Der Gegencheck bestätigt das von außen. Der
Befund ist richtig. Er gilt aber für einen Kanal, der **außerhalb der Normierung** liegt. Der
Entwurf legt den Kanal **hinein** — und schließt die Tür zusätzlich mit einer Regel.

### 3.1 Ebene 1: der Erwartungsfaktor steht in `rohKraft()`

Ein Krit ist ein Multiplikator auf die Höhe eines Treffers. Der **Erwartungswert** eines Treffers
ist damit `ANG · K` mit

    K = 1 + p_krit · (m_krit − 1)            (Angreifer)
    D = 1 / (1 − p_streif · 0,5)             (Verteidiger: was er im Mittel weniger einsteckt)

und `rohKraft` wird zu

    rohKraft(s) = LP · (1 + VER/100) · (ANG/50) · K(s) · D(s)

`aufEignung()` bleibt Zeichen für Zeichen, wie es ist: es skaliert LP, ANG und VER mit **einem**
Faktor f, bis `rohKraft = Referenz · eig/50`. **K und D werden nicht skaliert** — sie hängen an
SCHWACHSTELLE/WUCHT/AUSWEICHEN, die wie TMP/AUS Formwerte sind. Der Unterschied zu TMP/AUS ist
genau einer, und er ist der ganze Punkt: **K und D stehen im Produkt, das normiert wird.** Wer viel
Krit hat, hat ein großes K, braucht ein kleineres f — und bekommt weniger LP, weniger ANG, weniger
VER. Die Menge bleibt die der Eignung. Die Form ist die des Spielers.

Das beantwortet den Einwand der Synthese im Wortlaut: *„eine Wahrscheinlichkeit lässt sich nicht
mit einem freien Faktor skalieren (sie stößt bei 1 an), und genau die Kappung war es, die den
letzten Versuch ruiniert hat."* — Hier wird **keine Wahrscheinlichkeit skaliert.** `p` und `m`
bleiben, was das Rezept sagt; der Ausgleich geht über ANG/LP/VER, die schon heute frei skaliert
werden und keine Decke haben. Es gibt nichts, was bei 1 anstößt.

Und es beantwortet den Blowout-Präzedenzfall (`:5352-5357`): der ist entstanden, als **TMP** — ein
Bewegungs- und Gelegenheitskanal — mitnormiert wurde und die Kappung der KI „genau die
Bewegungsfreiheit nahm, mit der sie überhaupt an V-W herankommt". K und D fassen keine Bewegung,
keine Reichweite, keine Abklingzeit an. Sie sind Höhe, sonst nichts. Ob die *Dynamik* (früherer
K.o. durch Burst → weniger Gegner-Ereignisse) trotzdem einen Zweitordnungseffekt hat, ist die
offene Frage, die die Sonde beantwortet (Abschnitt 7) — es ist aber eine Frage zweiter Ordnung,
keine erster.

**Der Nachweis, dass das den Nuller-Kanal schließt, ist Arithmetik** (Nachbildung von
`mische`/`rohKraft`/`aufEignung`, im Scratchpad gerechnet, nicht eingecheckt). Man nehme
absichtlich das Falsche: Mini-DM mit `SCHWACHSTELLE:{awareness:100}`, awareness Matrixgewicht 0,
und hebe einem Schleicher awareness um +15:

| | awareness 78 | awareness 93 |
|---|---:|---:|
| Mini-DM-Eignung | 65,4 | **65,4** (unverändert, Gewicht 0) |
| p_krit | 24,5 % | 28,3 % |
| **normiert:** rohKraft nach `aufEignung()` | 219,7 | **219,7** |
| **naiv (K außerhalb der Normierung):** ANG·K | 109,9 | **112,8** (+2,6 %) |

Normiert bewegt sich die Kampfkraft um null — genau das, was ein Attribut mit Gewicht null bewegen
darf. Naiv kauft es 2,6 % je 15 Punkte, unbepreist. Das ist der TDM-Fehler, in Zahlen, und die
Normierung ist die Stelle, an der er nicht entsteht.

### 3.2 Ebene 2: die Trägerregel — und warum Chris' Satz sie verlangt

Die Normierung schließt die **Menge**. Aber Chris' Auflage sagt mehr: die Subskills müssen *in die
Eignung einfließen*. Ein Subskill, der nur aus Attributen mit Matrixgewicht 0 gemischt ist, fließt
in die Eignung **gar nicht** ein — `calculateRawDisciplineScore` überspringt Gewicht ≤ 0
(`discipline-rating-engine.ts:44`). Er wäre reine Form ohne Weg zur Menge, und das ist genau das
Gegenteil des Satzes. Deshalb die zweite, harte Regel:

> **Jedes Attribut in einer SCHWACHSTELLE-, WUCHT- oder AUSWEICHEN-Zeile muss in der
> Gewichtsquelle der Disziplin (`resolveDisciplineWeightProfile`, also Override oder Matrix) ein
> Gewicht > 0 haben.** Ein Test prüft das je Rezept — dieselbe Bauart wie die bestehende
> Slot-Invariante, ein Einzeiler über `BASIS_JE_DISC`.

Damit „fließt" jeder Subskill über seine Träger in die Eignung ein, und die Eignung bleibt, was
Chris am 05.09. festgelegt hat: **die** Zahl, unverändert (`official-discipline-weights.ts`
byte-identisch). Eine zweite Zahl („Krit-Eignung") gibt es nicht — das wäre die zweite Ordnung
desselben Kaders, an der Football mit rho 0,427 zwischen Anzeige und Spiel gescheitert ist
(`spiel-eignung-overrides.ts:14-17`).

**Konsequenz, Disziplin für Disziplin — und sie ist unbequem:**

| Disziplin | awareness | speed | torment | dexterity | Was Chris' Formel dort darf |
|---|---:|---:|---:|---:|---|
| Mini-DM | **0** | **0** | 24 | 10 | SCHWACHSTELLE/WUCHT aus torment (und will/power); **awareness und speed dürfen nicht**, die Matrix sagt, sie zählen hier nichts |
| Battlefield | 10 | 0 | 12 | 0 | Awareness → SCHWACHSTELLE **ja** — die einzige Arena-Disziplin, in der Chris' Awareness-Satz bepreisbar ist |
| TDM | 2 | 0 | 2 | 0 | praktisch nichts — TDMs Matrix beschreibt keinen Assassinen; Phase 1 lässt TDM ohne Zeilen |
| Fechten (Bühne) | 15 | 16 | 25 | 20 | alles — aber die Bühne hat ihre Chance/Höhe-Rollen schon |

Will Chris Awareness in **Mini-DM** wirken lassen, gibt es genau einen sauberen Weg, und er gehört
ihm: ein `spiel-eignung-override` für Mini-DM, der awareness ein Gewicht gibt. Das ist der
Mechanismus, den sein Satz vom 05.09. ausdrücklich erlaubt — es ändert aber eine spielersichtbare
Zahl und das, wofür die KI Geld ausgibt (`spiel-eignung-overrides.ts:58-61`). Kein Agent sollte das
für ihn entscheiden. **Offene Frage 1** (Abschnitt 10).

### 3.3 Was „Matrixgewicht" für den Subskill selbst heißt — messbar, nicht behauptet

Ein Subskill „hat ein Gewicht", wenn zwei Zahlen stimmen:

1. **Sein mechanisches Gewicht** (Anteil am Ergebnis, orthogonal gemessen wie bei Fechten:
   SPITZENMOMENT 9,4 %, WAGNIS 6,5 %) ist **> 0** — sonst ist er ein toter Kanal wie Climbings
   ROBUST, und dann steht er zwar im Rezept, tut aber nichts.
2. Die **Abweichung zur Matrix** (`einflussVon`, Pp) wird durch ihn **nicht größer** — sonst
   belohnt er etwas, das die Matrix nicht bepreist.

Bei einem vollständig normierten Kanal erwartet man: Gewicht > 0 (die Form wirkt in der Dynamik)
und Pp unverändert oder kleiner (die Menge folgt der Eignung). Genau das ist die Abnahme in
Abschnitt 7, und sie braucht **kein** rho.

---

## 4. Der Formulierungsvorschlag je Disziplin (Phase 1)

Nur Mini-DM und Battlefield; TDM bleibt ohne Zeilen (3.2). Gewichte **gesetzt** als Startpunkt für
die Sonde, nicht als Ergebnis — die Sonde entscheidet.

**Mini-DM** (Matrix torment 24, health 20, power 16, stamina 16, will 14, dexterity 10):

    TMP:           {dexterity:55, stamina:45}        ← torment verlässt TMP (s. 5.2)
    SCHWACHSTELLE: {torment:60, will:40}
    WUCHT:         {torment:55, power:45}
    AUSWEICHEN:    {will:60, health:40}
    ANG/VER/LP/AUS unverändert

**Battlefield** (Matrix charisma 20, intelligence 16, spirit 16, torment 12, power 10,
awareness 10, health 8):

    SCHWACHSTELLE: {awareness:50, intelligence:30, torment:20}   ← nur zulässig, wenn awareness
                                                                    zugleich TMP verlässt (5.2)
    WUCHT:         {torment:55, power:45}
    AUSWEICHEN:    {spirit:50, awareness:30, health:20}
    TMP:           {intelligence:55, charisma:45}                ← awareness verlässt TMP

Das ist bewusst **eine** Vorschlagsfassung, nicht drei; die Sonde fährt sie gegen die Basislinie
und gegen die Nullvariante (Zeilen vorhanden, aber `p = 0`) — sonst weiß man hinterher nicht, ob
die TMP-Umstellung oder die neuen Zeilen gewirkt haben (dieselbe 2×2-Auflage, die der PM-Plan A1.1
macht).

---

## 5. Die drei Fallen, einzeln geschlossen

### 5.1 Parade: Ereignisse verschlucken

Die Parade (`:19616-19625`) hat zwei Dinge falsch gemacht, und beide kommen hier nicht vor:

| | Parade (ausgebaut) | Dieser Entwurf |
|---|---|---|
| Ausgang | **Fehlschlag** — der Schlag zählt nicht | **Streifer** — der Schlag zählt, halbe Höhe, Rest als `verh` gutgeschrieben |
| Häufigkeit | 20 % Mitte, bis 40 % | Boden 5 %, Decke 24,8 % (AUSWEICHEN 99) — und **deterministisch**, also nie „in diesem Kampf zufällig 40 %" |
| Träger | Präzision — ein erfundener siebter Wert, Matrixgewicht nirgends | Rezeptzeile aus bepreisten Attributen, normiert |
| Richtung | „traf umso schlechter, je schneller sein Gegner war" — Tempo des Ziels, also der unbepreiste Kanal, spiegelte auf die Empfängerseite | AUSWEICHEN darf **kein** TMP-Attribut tragen (5.2) — der Kanal spiegelt nicht |

Der Gegencheck (2.3 b) hat das Streifband ausdrücklich als „die einzige Ausweich-Form, die
überhaupt eine Chance auf die Messung hat" benannt, mit dem Vorbehalt „das Preisproblem bleibt".
Abschnitt 3 ist die Antwort auf den Vorbehalt.

### 5.2 Fire Emblem: ein Attribut, zwei Hebel

Die Doppelverwertung in Fire Emblem ist: Speed kauft **Ereignisse** (Doppelangriff) **und**
Schutz (Avoid), und beides ist unbepreist. Übersetzt in unser Modell: ein Attribut, das in einem
**unnormierten Gelegenheitskanal** (TMP, schwächer AUS) sitzt, darf nicht zusätzlich einen zweiten
Kanal tragen — auch keinen normierten, weil sich Burst und Frequenz in der Dynamik multiplizieren
(wer öfter schlägt **und** früher tötet, nimmt dem Gegner überproportional Ereignisse) und die
Sonde die beiden dann nicht mehr trennen könnte.

> **Ein-Hebel-Regel:** `Attribute(TMP) ∩ Attribute(SCHWACHSTELLE ∪ WUCHT ∪ AUSWEICHEN) = ∅`, als
> Test je Rezept. AUS ist der schwächere Gelegenheitskanal (Ermüdung greift erst spät, `abkling`
> teilt durch `max(.5,fat)`, `:19719`); Überschneidungen mit AUS sind erlaubt, werden aber im
> Rezept **benannt** und in der Sonde mit einer Variante ohne AUSWEICHEN gegengeprüft.

Was die Regel konkret kostet:

- **Mini-DM:** torment steht heute in TMP (28) **und** ist Chris' Krit-Attribut. Also verlässt
  torment TMP (`{dexterity:55, stamina:45}`). Das ist eine Rezeptänderung mit eigener
  Messung — und sie ist nicht gratis: `arena-tempo-schlagfrequenz.md` hat gezeigt, dass Mini-DMs
  TMP-Zusammensetzung rho um −0,175 bewegt hat. Mini-DM hat nur sechs Attribute, und fünf davon
  sitzen in TMP oder AUS; **die akzeptierte Überschneidung ist will/health in AUS.** Wer das nicht
  will, hat in Mini-DM nur torment und power als Träger — das ist zu eng, und deshalb steht die
  AUS-Ausnahme drin, offen.
- **Battlefield:** awareness ist dort der **größte** TMP-Träger (36). Awareness → SCHWACHSTELLE
  geht nur, wenn awareness aus TMP herausgeht (`{intelligence:55, charisma:45}`). Auch das ist
  eine Rezeptänderung mit eigener Messung.
- **Dexterity/Speed**, die Chris beim Assassinen nennt: dexterity ist in Mini-DM der größte
  TMP-Träger — es bleibt der Frequenz-Hebel, nicht der Krit-Hebel. **Ein Attribut, ein Hebel.**
  Speed hat in allen drei Arena-Matrizen Gewicht 0 und ist damit ohnehin nicht zulässig.

Gegenprobe an der bestehenden Doppelbesetzung: torment sitzt heute in Mini-DM in ANG (46) **und**
TMP (28). Das **ist** bereits die Fire-Emblem-Konstellation — ein normierter plus ein unnormierter
Kanal auf demselben Attribut — und Mini-DM misst die schlechtesten Zahlen des Projekts. Die
Konvergenz (2.1) hat das als Argument *gegen* Perspektive A gelesen („Chris' Assassine ist
mechanisch bereits gebaut … und misst 0,094"). Man kann es auch andersherum lesen: der Assassine ist
gebaut, aber mit genau der Doppelbesetzung, die die Regel oben verbietet. Ob das der Grund ist,
weiß niemand — es ist eine Hypothese, und die Sonde in Abschnitt 7 trennt sie ab (Variante
„nur TMP umgestellt, keine neuen Zeilen").

### 5.3 Output-Zufall und Isolation

- **Kein neuer `rr()`-Aufruf.** Ladungsmodell (2.1). Der Ziehungsstrom aller vier Chassis ist
  Byte für Byte derselbe.
- **Zeilen fehlen → Faktor 1.** Für jede Disziplin ohne die drei Rezeptzeilen ist `K = D = 1`,
  `ladung` und `deckung` erreichen nie 1, der Multiplikator ist `(crit?m:1)` mit `crit=false`
  wie heute. `rohKraft` ist damit **identisch** — nicht „innerhalb der Toleranz", sondern derselbe
  Gleitkommawert, weil `·1·1` an einem `double` nichts ändert. Nachweis:
  `node scripts/miss-alle-disziplinen.mjs 24` bit-identisch über die siebzehn Nicht-Arena-Zeilen
  **und** über TDM, das keine Zeilen bekommt.
- **Die Referenz in `aufEignung()`** (`rohKraft({LP:75,VER:60,ANG:70})`, `:5312`) bleibt ohne
  Zeilen, also `K = D = 1` — sie ist der Maßstab und darf nicht mitwandern.

---

## 6. Chris' Abwägung, durchgerechnet — ist der Tausch echt, und ist er ausgeglichen?

Zwei Kämpfer, Mini-DM, ähnliche Eignung, entgegengesetzte Bauweise. Attribute erfunden, Rechnung
nicht (Nachbildung von `mische`/`rohKraft`/`aufEignung`, Vorschlagsrezept aus Abschnitt 4).

| | Schleicher (Assassine) | Bollwerk (Brecher) |
|---|---|---|
| torment / power / will / health / dexterity / stamina | 90 / 44 / 62 / 52 / 84 / 58 | 48 / 90 / 56 / 88 / 40 / 72 |
| **Mini-DM-Eignung** (Matrix) | **65,4** | **66,9** |
| Rohform ANG / VER / LP | 73 / 56 / 57 | 61 / 75 / 75 |
| SCHWACHSTELLE / WUCHT / AUSWEICHEN | 79 / 69 / 58 | 51 / 67 / 69 |
| p_krit / m_krit / p_streif | **24,7 % / 1,85× / 16,6 %** | 17,7 % / 1,84× / 18,8 % |
| Erwartungsfaktor K · D | 1,209 · 1,091 | 1,148 · 1,104 |
| **heute** (ohne Zeilen): LP / ANG / VER nach Normierung | 71,1 / 91,0 / 69,8 | 86,1 / 70,1 / 86,1 |
| **Vorschlag:** LP / ANG / VER nach Normierung | **63,3 / 81,1 / 62,2** | 78,2 / 63,6 / 78,2 |
| rohKraft heute / Vorschlag | 219,7 / **219,7** | 224,7 / **224,7** |
| Grundschlag (Basis 12) gegen VER 60: normal / Krit | 12 / **22** | 10 / 18 |
| erwarteter Schaden je Treffer: heute → Vorschlag | 13,65 → 14,71 (+7,8 %) | 10,51 → 10,96 (+4,3 %) |
| Zähigkeit LP·(1+VER/100)·D: heute → Vorschlag | 120,7 → **112,0** (−7,2 %) | 160,2 → 153,8 (−4,0 %) |

Was die Tabelle sagt:

1. **Die Menge bleibt.** `rohKraft` ist vor und nach dem Umbau dieselbe Zahl, für beide — die
   Normierung tut, was sie soll. Die Eignung entscheidet weiter, wer der Stärkere ist (der Bollwerk,
   66,9 gegen 65,4).
2. **Die Form kippt, und zwar in Chris' Richtung.** Der Schleicher tauscht 7 % Zähigkeit gegen 8 %
   erwarteten Schaden je Treffer — geliefert als jeder vierte Treffer für 22 statt 12. Der Bollwerk
   bleibt nahe bei sich. Das ist „hohe Krit-Chance plus hoher Krit-Schaden **oder** hoher
   Flachschaden", als Tausch bei gleicher Menge — keine dominante Strategie, weil keine der beiden
   mehr Kampfkraft je Eignungspunkt bekommt.
3. **Ohne Normierung wäre es eine dominante Strategie.** Naiv (K außerhalb von `rohKraft`) bekäme
   der Schleicher **+20,9 %** Erwartungsschaden bei gleicher Eignung, der Bollwerk +14,8 %. Das
   wäre der unbepreiste Kanal, in Prozent — und der Grund, warum die Synthese nein gesagt hat. Die
   Normierung nimmt genau diese 20,9 % weg und lässt die Form stehen.
4. **Der Assassine ist nicht schwächer, er ist anders sichtbar.** Die Synthese (3.5) hatte
   diagnostiziert, Chris' Assassine sei mechanisch stark und nur nicht zu **sehen**. Der Entwurf
   ändert die Menge nicht — er macht den Torment-Vorteil als 22er-Krit mit Callout sichtbar, statt
   als „−17" über einem 64-px-Sprite.

**Wo die Balance-Schrauben sitzen**, falls die Sonde sagt, dass die Dynamik den Tausch verzerrt
(etwa weil Burst Gegner früher aus dem Kampf nimmt): die Spannen von `p_krit`/`m_krit` (Decke
30 % / 2,0×), der Streifanteil (0,5), und — falls Zweitordnungseffekte messbar sind — ein
Dynamikfaktor in `K` (`K = 1 + p·(m−1)·κ` mit κ ≈ 1,1), der die gemessene Überrendite von Burst
abpreist. **κ ist heute 1 und bleibt 1, bis eine Zahl etwas anderes sagt.**

---

## 7. Messbarkeit und Abnahme — was heute geht, was nicht, und die Abbruchregeln

### 7.1 Die ehrliche Grenze

M0 (PR #979) ist rot: Median-Unsicherheit 0,238 / 0,347 / 0,277 bei 16 Paarungen, dem realen
Maximum. **Eine rho-je-Spiel-Abnahme dieser Mechanik in der Arena ist heute nicht möglich, und
sie wird durch mehr Paarungen nicht möglich.** Die Konvergenz-Frage 1 (andere Arena-Metrik oder
Schranke nicht anwendbar) liegt bei Chris. Dieses Dokument hängt nicht daran — es braucht rho
erst am Ende, und bis dahin gibt es vier Messungen, die **nicht** am Kaderrauschen hängen.

**Und ein Testbett anderswo gibt es nicht** — das ist die zweite ehrliche Grenze. Die Mechanik
ist eine Treffer-Höhen-Mechanik; sie existiert nur dort, wo je Treffer Höhe verteilt wird, und das
ist die Arena. Die Bühne braucht sie nicht, weil sie das Muster seit Monaten hat: Fechtens
TECHNIK/NERVEN (Chance), SPITZENMOMENT×WAGNIS (Höhe) und `failAbzug 0,55` (Streifer) sind
dieselbe Struktur — bepreist über Rezeptzeilen, mechanisch gewogen, bei rho 0,826. **Das ist der
Beleg, dass Chance- und Höhen-Subskills mit einer Abnahme über 0,80 vereinbar sind** — als
Existenzbeweis, nicht als Ort, an dem man den Arena-Kanal ausprobiert. Wer ihn dort „testet",
misst die Bühne.

### 7.2 Was heute messbar ist — vier Gates vor jedem rho

| Gate | Werkzeug | Abnahme | Abbruch |
|---|---|---|---|
| **G1 Isolation** | `node scripts/miss-alle-disziplinen.mjs 24` | 17 Nicht-Arena-Zeilen **und** TDM bit-identisch; `npm run ci:rangtreue-schranke` grün | eine Zeile bewegt sich → Fehler im Faktor-1-Pfad, zurück |
| **G2 Matrix-Abweichung** | `node scripts/messe-arena-einfluss.mjs mini-dm 48` (Pp aus `einflussVon`) | Pp der Disziplin **nicht größer** als in der Nullvariante (Zeilen mit p=0); torment/power/will lesen keinen Anteil, den die Matrix nicht trägt | Pp steigt um mehr als den Lauf-zu-Lauf-Unterschied zweier Nullvarianten → der Kanal ist nicht dicht, zurück |
| **G3 Subskill-Gewicht** | `sondiere-feldspiel-subskills.mjs`, um einen `ARENA_ART`-Zweig ergänzt (Werkzeug-PR, s. 7.3) | SCHWACHSTELLE, WUCHT, AUSWEICHEN lesen jeweils **> 0** und in zwei Versätzen dieselbe Rangfolge | einer liest 0 → toter Kanal, die Zeile fliegt oder die Formel ist falsch |
| **G4 Ereignisstatistik** | neue Zähler im bestehenden `MESS`-Objekt (`:19488`), ausgelesen wie `boxscoreSerie` | Krit-Anteil je Spiel = p ± 1 Treffer (Ladungsmodell hält), Streif-Anteil ebenso, **Anteil verschluckter Ereignisse = 0**, Overkill-Anteil und Streuung der Schadenshöhe je Spiel ausgewiesen | Krit-Anteil weicht von p ab → Zähler falsch; Overkill steigt stark → κ-Frage, nicht Merge |

Erst wenn G1–G4 stehen, kommt rho — und zwar in dieser Form:

| Gate | Was | Warum das trotz M0 etwas sagen kann |
|---|---|---|
| **G5 Paartreue** | „Paare mit ≥ 15 Eignungspunkten Abstand richtig geordnet" und „Star auf Rang 1 / in den ersten zwei", kaderfest auf der M0-16er-Familie, mit demselben Bootstrap-CI wie in PR #979 | CLAUDE.md nennt das die ehrlichere Abnahme; für eine **Burst**-Mechanik ist sie die richtige Frage: darf ein 22er-Krit ein Paar mit 15 Punkten Abstand kippen? Ob ihr CI enger ist als der von Spearman, weiß niemand — **das ist M0b** (7.3), und es ist die Zahl, die entscheidet, ob es überhaupt ein rho-Gate für die Arena gibt |
| **G6 Spearman** | rho je Spiel / Saison, Median + Spannweite + CI, 2×2 gegen Basislinie | nur, wenn Chris Frage 1 so beantwortet, dass Spearman in der Arena weiter gilt; Bewegungsregel: zählt nur oberhalb der M0-Spannweite (Konvergenz 1.1) |

**Abbruch für bestehende Disziplinen ist trivial**, weil keine bestehende Disziplin über 0,80
angefasst wird: TDM bekommt keine Zeilen, Fechten ist Bühne, die siebzehn sind bit-identisch. Fällt
G1, gibt es keine Diskussion. **Rückbau** ist eine Rezeptänderung (Zeilen raus → Faktor 1), nicht
ein Motor-Revert.

### 7.3 Was an Werkzeug fehlt (vor der Sonde, alles ohne Motor)

1. `sondiere-feldspiel-subskills.mjs`: ein `ARENA_ART`-Zweig neben `FELDSPIEL_ART` (der
   Klammer-bewusste Blockfang ist schon da, `klammerBlock()`; es fehlt nur die Tabelle).
2. `scripts/lib/rangtreue-messung.mjs`: Paartreue-mit-Abstand und Star-Rang als dritte/vierte
   Auswertung neben rho, mit `bootstrapMedianUnsicherheit` — **M0b**. Das ist eine
   Auswertespalte, kein Motoreingriff, und sie beantwortet Konvergenz-Frage 1 mit einer Zahl
   statt mit Geschmack.
3. Zähler für Krit/Streif/Overkill im `MESS`-Objekt — das ist die einzige Zeile, die den Motor
   berührt, und sie ist Anzeige, kein Verhalten.

---

## 8. Datenlage: braucht es erst eine Daten-PR? — Ja, und zwar diese

Die Synthese (3.2) sagt, eine Krit-Recherche sei „an fehlenden Daten blockiert, solange sie an
Attributen hängt", weil keine Klassenkarte Krit führt. Das stimmt für die Frage „welche Krit-Chance
hat ein Ninja im Vorbild" — **diese Daten wird es nie geben**, und der Abschrift-Vertrag sagt, was
dann zu tun ist: markieren, an Ort und Stelle. Die Konstanten in Abschnitt 2 sind so markiert.

Aber es ist nicht die Frage, an der die Kalibrierung hängt. Durch die Normierung entscheiden die
Konstanten nicht über die **Menge** (die kommt aus der Eignung, Abschnitt 6), sondern über die
**Form** — und die einzige Größe, die eine Form in rho verwandelt, ist die **Kampfdynamik**:
verändert Burst, wer wann stirbt, und verschiebt das den Erwartungswert weg von der Eignung? Diese
Zahl fehlt. Sie steht in keinem Vorbild, und sie lässt sich nur **erzeugen**: mit der Sonde.

Deshalb zwei PRs, in dieser Reihenfolge, und die zweite nur, wenn die erste trägt:

**PR K0 — Sonde (PRODUKTIONSCODE: nein).** Werkzeuge aus 7.3, dazu die drei Zeilen und der
Faktor-1-Pfad **in einer Sondenvariante** nach dem Muster von A1.0 („nur Sondenpfad, nichts wird
gemergt" — konkret: Branch, Messung, Dokument; der Motor auf `main` bleibt). Varianten:

| Variante | Was | Trennt ab |
|---|---|---|
| 0 | Basislinie, unverändert | — |
| N | Zeilen vorhanden, `p = 0` (Nullvariante) | dass der Faktor-1-Pfad wirklich 1 ist (G1 im Sondenpfad) |
| T | nur TMP umgestellt (torment/awareness raus), keine Krit-Zeilen | den Preis der Ein-Hebel-Regel |
| K | T + SCHWACHSTELLE/WUCHT | Krit allein |
| KA | K + AUSWEICHEN | Streifband zusätzlich |
| KA′ | KA mit AUSWEICHEN ohne AUS-Überschneidung (Mini-DM: nur will) | die akzeptierte AUS-Ausnahme |

Je Variante G2, G3, G4 — und G5/G6, sobald M0b sagt, welche Zahl in der Arena etwas sagt.
Kaderfest auf der 16er-Familie, Median + Spannweite + CI, n ≥ 96 je Variante (die Synthese-Hürde;
eine 24er-Messung beweist hier nichts).

**PR K1 — Rezept und Motor (PRODUKTIONSCODE: ja, unabhängige Review).** Nur bei: G1 bit-identisch,
G2 nicht schlechter, G3 alle > 0, G4 null verschluckte Ereignisse, G5 nicht schlechter als
Variante T. Review-Hauptfrage: *ist der Faktor-1-Pfad wirklich 1, und gibt es irgendwo einen
neuen `rr()`?*

**Was K0 nicht liefern kann und K1 deshalb nicht behaupten darf:** eine rho-je-Spiel-Zahl über
0,80 für Mini-DM. Die Mechanik hebt die Arena nicht über die Schranke — dafür ist sie nicht
gebaut, und Mini-DMs Problem sitzt laut Synthese 1.3 mindestens zur Hälfte in der Aussetzung
(Zielwahl nach Geometrie, Korrelation −0,02). Was sie liefert, ist Chris' Bauweise-Abwägung
**ohne** einen neuen unbepreisten Kanal — und das ist nachweisbar, ohne rho.

---

## 9. Einordnung in den PM-Plan

- **Nach M0, als Varianten in A1.0** — nicht als eigener Auftrag davor. A1.0 hat bereits die
  Struktur (Varianten A–E + P, kaderfest, M0-Familie); K/KA/T sind drei Zeilen mehr in derselben
  Tabelle. Zusätzlich braucht A1.0 dann M0b (7.3), weil Spearman dort nichts entscheidet.
- **Takt-agnostisch.** Ladung und Deckung zählen Treffer, nicht Sekunden. Sie funktionieren im
  heutigen Echtzeitmotor je Schlag und in einem Rundenpiloten (A1.1) je Aktion — der Entwurf
  präjudiziert den Fork C1/A1.1 nicht. Im Rundenmodell wäre die Ladung sogar besser sichtbar (ein
  Zeitpunkt, an dem der Balken voll ist).
- **Vor S1, nicht statt S1.** Die drei Auflagen der Konvergenz für S1 („jeder Item-Effekt braucht
  ein bepreistes Ziel") bekommen durch diesen Entwurf erst ein Ziel: „+10 SCHWACHSTELLE" hat nach
  Abschnitt 3 einen Preis, „+15 % Krit" hätte keinen. Der Entwurf ist damit die Vorbedingung, die
  Perspektive A's bestes Argument für S1 überhaupt einlösbar macht.
- **Neben C1.** Die Aussetzung (wer beschossen wird) und die Höhe (wie hart) sind zwei Kanäle. Ein
  Burst-Kämpfer, der nach Geometrie nie angegriffen wird, ist ein Problem der Zielwahl, nicht der
  Wucht. Aber G4 sollte den Overkill-Anteil **je Reihe** ausweisen, damit man sieht, ob Burst und
  Geometrie sich addieren.

---

## 10. Was nur Chris entscheiden kann

1. **Awareness in Mini-DM.** Die Matrix gibt awareness dort 0. Chris' Formel darf awareness in
   Mini-DM deshalb nicht tragen — es sei denn, er setzt einen `spiel-eignung-override` für Mini-DM
   (sein eigener Mechanismus vom 05.09.), der die spielersichtbare Eignung und den KI-Kauf ändert.
   Ohne Antwort: Mini-DM ohne awareness, Battlefield mit.
2. **Die AUS-Ausnahme der Ein-Hebel-Regel** (5.2). Streng gelesen hat Mini-DM nur torment und power
   als zulässige Träger. Der Entwurf akzeptiert will/health in AUS und misst die Ausnahme (KA′).
   Chris kann streng wählen — dann gibt es in Mini-DM kein AUSWEICHEN.
3. **Ladung oder PRD** (2.1). Deterministisch (rho-billigst, sichtbarer Balken) oder gebunden
   zufällig (fühlt sich mehr nach Würfel an, etwas mehr Streuung). Frei gewürfelt wird in keinem
   Fall.
4. **Konvergenz-Frage 1, jetzt mit Vorschlag:** ob die Paartreue mit Abstand (G5) die Arena-Abnahme
   wird. M0b liefert dazu die Zahl, ob sie präziser ist als Spearman. Ohne diese Entscheidung
   gibt es für die Arena weiter kein rho-Gate — und dieser Entwurf bleibt bei G1–G4 stehen,
   ehrlich beschriftet.

---

## 11. Zusammengefasst

- **Drei benannte Subskill-Zeilen** (SCHWACHSTELLE, WUCHT, AUSWEICHEN), gemischt wie ANG aus
  Matrix-Attributen, mit **Erwartungsfaktoren K und D in `rohKraft()`** — also innerhalb der
  Normierung `aufEignung()`. Die Menge bleibt proportional zur Eignung (nachgerechnet: rohKraft
  219,7 vor und nach dem Umbau), die Form wird zu Chris' Tausch: der Schleicher gibt 7 % Zähigkeit
  für jeden vierten Treffer mit 22 statt 12. Naiv wäre es +20,9 % gratis gewesen.
- **Matrixgewicht null** ist doppelt geschlossen: durch die Normierung (ein Träger mit Gewicht 0
  bewegt die Kampfkraft um exakt null — Arithmetik, Abschnitt 3.1) und durch die Trägerregel
  (Gewicht > 0 in `resolveDisciplineWeightProfile`, als Test). Folge: Awareness darf in Battlefield,
  nicht in Mini-DM — es sei denn, Chris setzt dort einen Override.
- **Parade** kommt nicht wieder: Streifer statt Fehlschlag, Ersparnis als `verh` gebucht, Decke
  24,8 %, deterministisch. **Fire Emblem** kommt nicht wieder: kein Attribut in TMP und in einer
  neuen Zeile (Test) — Preis: torment verlässt Mini-DMs TMP, awareness Battlefields TMP.
  **Output-Zufall** kommt nicht: Ladungsmodell, kein `rr()`, Faktor-1-Pfad → Bit-Identität durch
  Konstruktion.
- **Messbar ab Tag eins, aber nicht mit rho:** Isolation (G1), Matrix-Abweichung in Pp (G2),
  orthogonales Subskill-Gewicht (G3), Ereignisstatistik (G4). rho in der Arena ist nach M0 nicht
  messbar — der Vorschlag dafür ist die Paartreue mit Abstand als Arena-Abnahme, und M0b misst,
  ob sie präzise genug ist.
- **Erst Daten-PR, dann Rezept-PR.** Die fehlenden Daten sind nicht Krit-Werte aus dem Vorbild
  (die gibt es nicht und wird es nie geben — markiert, wie der Vertrag es verlangt), sondern die
  Dynamik-Antwort der Arena auf Burst. Die erzeugt nur die Sonde K0.

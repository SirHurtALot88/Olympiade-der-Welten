# Arena-Zielwahl: Opus-Empfehlung (Task #53, 02.10.) — Zusammenhalt und Bindung von der Persönlichkeit lösen, die Zielneigung behalten

Konsultation, keine Umsetzung. **Kein Code im Repo geändert.** Alle Zahlen in diesem Dokument
stammen aus Messungen auf einer temporären Kopie von `battle-mode.engine.js` außerhalb des Repos
(Anhang A). Gemessen wurde über die vorhandene Schnittstelle
`window.__arena.disziplinProbe(d, {kaderFamilie, zielDiag:true})` und dieselbe Kader-Familie wie die
offizielle Abnahme (`data/generated/kaderfamilie-live-save.json`, fünf echte Paarungen). Jede
Variante lief mit n = 24 Spielen je Paarung, alle entscheidenden Varianten zusätzlich auf einem
zweiten, unabhängigen Saatstrom.

Gelesen und vorausgesetzt: `CLAUDE.md`, `arena-zielwahl-messsonde-02-10.md` (PR #1125),
`tdm-pp-rezeptrunde-diagnose-02-10.md` (PR #1124/#1126), `arena-zielwahl-umsetzung.md` (K1, zwei
gescheiterte Anläufe), `manager-risiko-interaktivitaet-konzept-02-10.md` (PR #1118),
`fable-ideen-arena-ispy-30-09.md`, der Opus-Konzeptreview der Arena vom 26.09. (nur auf dem Branch
`arena-minigames-konzeptreview-26-09`) und `stand-aller-disziplinen.md`. Im Motor: `PERSZIEL`,
`PERSDEF`, `behav()`, `leitePers()`, `baueEinheit()`, `build()`, `chooseTargetKern()`,
`schlachtplan()`, `beitragVon()` und der Rückzugs-, Zielwechsel-, Durchbruch- und Bindungsblock in
`stepSim()`.

---

## 0. Die Empfehlung in fünf Sätzen

1. **Die Persönlichkeit verzerrt die Rangfolge nicht über die Zielwahl, sondern über zwei
   Verhaltensskalen.** Zerlegt man das Bündel „Persönlichkeit“ kontrafaktisch, tragen weder die
   Zielneigung (`PERSZIEL`) noch die Haltung (Rückzug) zur Fehlordnung bei. Den eignungsfremden
   Anteil tragen **Zusammenhalt** (wie weit sich jemand von der Linie löst) und **Bindung** (wie oft
   er umzielt und ob er sich von Abfängern stellen lässt). Beide setzt heute `PERSDEF` aus der
   Persönlichkeit.
2. **Empfehlung:** In den Arena-Disziplinen bekommen Zusammenhalt und Bindung für alle sechs
   Persönlichkeiten die Skalenmitte „ausgewogen“. In Mini-DM gilt das nur für den Zusammenhalt.
   Zielneigung und Haltung bleiben persönlichkeitsabhängig, die manuellen Taktik-Regler bleiben
   unverändert. Schaltbar ist das je Disziplin über ein neues Feld `ARENA_ART[d].persHandwerk`.
3. **Gemessen, beide Saatströme:** rho je Spiel TDM 0,324/0,247 → **0,416/0,432**, Mini-DM
   0,365/0,363 → **0,588/0,576**, Battlefield 0,399/0,391 → **0,583/0,616**. Star, Top 2 und
   Paartreue steigen oder halten. Die Team-Ergebnistreue hält im Mittel beider Ströme (höchstens
   2 Prozentpunkte darunter). Die Saison-Validität von Battlefield springt von 0,31 auf 0,76–0,81.
4. **Das ist das Gegenteil von K1.** K1 hat die Zielvielfalt eingeebnet („alle auf Bedrohung“). Unter
   sonst gleichen Bedingungen nachgestellt, kostet genau das 0,07–0,13 rho. Diese Empfehlung lässt
   die Zielvielfalt unangetastet und liest an keiner Stelle die Eignung.
5. **Keine der drei Disziplinen kommt damit über 0,80, TDM auch strukturell nicht.** Nach dem
   Eingriff begrenzt die Spiel-zu-Spiel-Verlässlichkeit die Einzelspielzahl, in TDM auf rund 0,70.
   Die hohe Verlässlichkeit des Ist-Stands (0,86) war die Reproduzierbarkeit des
   Persönlichkeitsfehlers. In TDM bleibt danach kein großer kategorialer Kanal mehr übrig. Was fehlt,
   liegt im Wertmaßstab und im Format, also bei Chris.

---

## 1. Was die Messsonde vom 02.10. zeigt — drei Präzisierungen

### 1.1 eta² ist bei dieser Stichprobe stark nach oben verzerrt

`miss-arena-rangvarianz-aufschluesselung.mjs` rechnet eta² über n = 60 (TDM) bzw. n = 40
Spieler-Zeilen. Ein Faktor mit k Stufen erreicht aber auch **ohne jeden echten Effekt** im
Erwartungswert eta² ≈ (k−1)/(n−1). Bei sechs Persönlichkeiten sind das 0,085 (TDM) und 0,128
(Mini-DM, Battlefield). Die unverzerrte Größe ist ε² = 1 − (1−eta²)·(n−1)/(n−k). Nachgerechnet auf
einer eigenen Wiederholung (n = 24, Strom 1), die die rho-Werte aus PR #1125 auf die dritte
Nachkommastelle reproduziert:

| Faktor | TDM eta² → ε² | Mini-DM eta² → ε² | Battlefield eta² → ε² |
|---|---|---|---|
| Persönlichkeit (k = 6) | 0,294 → **0,229** | 0,244 → **0,133** | 0,216 → **0,100** |
| Kampf-Archetyp (k = 9–13) | 0,487 → 0,356 | 0,167 → ≈ 0 | 0,394 → 0,155 |
| Reihe (k = 3) | 0,073 → 0,040 | 0,002 → ≈ 0 | 0,001 → ≈ 0 |
| Seite (k = 2) | 0,023 → 0,006 | 0,023 → ≈ 0 | 0,042 → 0,017 |

Die Persönlichkeit ist damit in **TDM ein echter, großer Effekt**, in Mini-DM ein mittlerer und in
Battlefield ein kleiner. Der PR-#1125-Wert für Battlefield (0,154) liegt kaum über der
Zufallserwartung von 0,128. Reihe und Seite sind nach der Korrektur praktisch null.

### 1.2 „Persönlichkeit“ ist ein Bündel aus vier Kanälen

`persOf[p.n]` steuert über `baueEinheit()` vier verschiedene Dinge:

| Kanal | Quelle | Wirkung im Kampf |
|---|---|---|
| **Zielneigung** | `PERSZIEL` → `u.zielP` | *wen* er angreift: nächster, Spitze, Bedrohung, hintere Reihe, Kamerad freischlagen, Schwächster |
| **Haltung** `h` | `PERSDEF` → `u.selb` | ab welcher LP-Schwelle er sich kurz löst |
| **Zusammenhalt** `z` | `PERSDEF` → `u.form` | wie stark ihn die Formationsleine hält |
| **Bindung** `b` | `PERSDEF` → `u.opp` | Umzielen alle 0,35–2,75 s, Antwort auf Angreifer im Rücken (`opp ≥ 45`), Stellen-Lassen durch Abfänger (`opp ≥ 55`), Durchbruch erst nach 1,5–5,5 s |

Der Faktor, den PR #1125 als „Persönlichkeit (PERSZIEL-Typ)“ ausweist, misst also nicht den
Zielwahl-Kanal, sondern alle vier zusammen. Wer an der Persönlichkeit ansetzen will, muss erst
wissen, an welchem der vier Kanäle. Das klärt Abschnitt 2.

### 1.3 Persönlichkeit und Archetyp sind weitgehend dieselbe Achse

Beide werden aus Klasse, Rasse und Unterklasse abgeleitet. Cramérs V zwischen beiden liegt bei
0,53 (TDM), 0,59 (Mini-DM) und 0,67 (Battlefield). Neutralisiert man die Persönlichkeit vollständig,
fällt der Archetyp-Effekt in TDM von ε² 0,36 auf ≈ 0. Der große „Archetyp-Effekt“ in TDM war also
überwiegend Persönlichkeitsverhalten.

---

## 2. Kontrafaktische Zerlegung: welcher Kanal trägt die Fehlordnung?

Je Variante wird genau ein Teil des Bündels für alle sechs Persönlichkeiten auf denselben Wert
gesetzt. Der Rest bleibt, wie er ist.

| Variante | Was vereinheitlicht wird | TDM | Mini-DM | Battlefield |
|---|---|---:|---:|---:|
| **V0** | nichts (Ist-Stand) | 0,324 | 0,365 | 0,399 |
| V1 | alles: jeder ist Duellant (Ziel „Bedrohung“, Skalen wie Duellant) | 0,339 | 0,285 | 0,386 |
| V2 | nur Zielneigung: alle „nächster“ | 0,343 | 0,243 | 0,373 |
| V3 | alle drei Skalen wie Duellant (h ausgewogen, z ausgewogen, b zielstrebig) | 0,407 | 0,411 | 0,462 |
| V4 | nur Haltung h = ausgewogen | 0,327 | 0,369 | 0,392 |
| V5 | nur Zusammenhalt z = ausgewogen | 0,417 | **0,588** | 0,384 |
| V6 | nur Bindung b = zielstrebig | 0,424 | 0,398 | 0,512 |
| V7 | alle drei Skalen eine Stufe Richtung Mitte | 0,391 | 0,462 | 0,442 |
| V8 | z = ausgewogen, b = zielstrebig | 0,389 | 0,421 | 0,448 |
| **V9** | **z = ausgewogen, b = ausgewogen** | **0,416** | 0,495 | **0,583** |

rho je Spiel, Median über die fünf Paarungen, Strom 1.

### 2.1 Was die Tabelle sagt

- **Die Zielneigung ist nicht der Hebel.** V2 bewegt TDM nicht (0,343) und kostet Mini-DM 0,12. Das
  ist dieselbe Signatur wie bei K1 (TDM ±0, Mini-DM −0,31).
- **Die Haltung ist es auch nicht.** V4 ist in allen drei Disziplinen nicht von V0 zu unterscheiden.
  Die Vermutung aus dem 26.09.-Review („wer defensiv ist, löst sich früh und sammelt nichts“) ist
  damit widerlegt. Auch die Richtung passt nicht: In TDM steht der Beschützer (Haltung „defensiv“)
  im Rest-Rang am höchsten.
- **Zusammenhalt und Bindung sind der Hebel.** Zusammenhalt trägt Mini-DM (V5: +0,22, fünf von fünf
  Paarungen besser). Bindung trägt TDM und Battlefield (V6: +0,10 und +0,11). Beide zusammen auf der
  Skalenmitte (V9) sind in TDM und Battlefield über beide Ströme gemittelt die beste Variante
  (TDM 0,42 gegen 0,39–0,40 für V5/V6 allein, Battlefield 0,60 gegen 0,40–0,53).
- **Die Zielvielfalt hilft, sobald die Skalen neutral sind.** V1 und V3 haben dieselben Skalen und
  unterscheiden sich nur darin, ob alle sechs auf „Bedrohung“ zielen (V1) oder jeder nach seiner
  Neigung (V3). V3 liegt in allen drei Disziplinen vorn: +0,07, +0,13, +0,08. Chris' Forderung vom
  13.09. („manche versuchen laut ihrem Charakter eher die Backrow …“) und die Rangtreue ziehen an
  dieser Stelle in dieselbe Richtung.
- **Der neutrale Wert ist nicht egal.** V8 setzt die Bindung auf „zielstrebig“ (wie der Duellant),
  V9 auf „ausgewogen“. „Zielstrebig“ ignoriert Angreifer im Rücken und lässt sich nie stellen. Das
  kostet in Battlefield 0,14–0,16 rho und rund 20 Prozentpunkte Team-Ergebnistreue (V8: 81/75 %
  gegen 96/96 % bei V9). Die Skalenmitte ist
  nicht nur die neutralere Wahl, sie ist auch messbar die bessere.

Das Muster im Rest-Rang (V0, TDM) passt zur Mechanik. Der Draufgänger (Zusammenhalt „eigenmächtig“,
Bindung „opportunistisch“) liegt bei −0,24, der Schleicher („eigenmächtig“/„flexibel“) bei −0,21.
Beschützer („eng“) +0,15, Duellant („ausgewogen“/„zielstrebig“) +0,12, Bollwerk („dicht“/
„zielstrebig“) +0,06. Wer eigenmächtig läuft und ständig umzielt, verbringt seine Zeit mit Laufen,
Trennschlägen und angefangenen Zielen statt mit Treffern und K.o.-Anteilen. Die Persönlichkeit
bestimmt damit die **Menge** des Beitrags, nicht nur seinen Stil. Das ist die P1-Diagnose aus dem
26.09.-Review, jetzt auf zwei Skalen eingegrenzt.

### 2.2 Beide Saatströme: die empfohlene Einstellung gegen den Ist-Stand

Empfohlen ist **V9 für TDM und Battlefield** und **V5 für Mini-DM** (Begründung zu Mini-DM in 2.3).
Strom 1: `saat0 = 1337`. Strom 2: `saat0 = 900001`, `mutatorSaat = 10 000 000`, dieselbe Konvention
wie `messe-arena-einfluss-zweiter-saatstamm.mjs`. Werte als „Strom 1 / Strom 2“.

| | TDM: V0 → V9 | Mini-DM: V0 → V5 | Battlefield: V0 → V9 |
|---|---|---|---|
| **rho je Spiel** (Median) | 0,324/0,247 → **0,416/0,432** | 0,365/0,363 → **0,588/0,576** | 0,399/0,391 → **0,583/0,616** |
| rho Saison (Median) | 0,308/0,189 → 0,448/0,413 | 0,311/0,311 → 0,595/0,643 | 0,310/0,310 → **0,810/0,762** |
| Spannweite je Spiel | 0,861/0,869 → 0,652/0,639 | 0,532/0,434 → 0,680/0,594 | 0,834/0,742 → 0,482/0,356 |
| Paarungen besser | 3 / 3 von 5 | **5 / 5** von 5 | 3 / 4 von 5 |
| Star auf Rang 1 (Zufall: 8,3 / 12,5 / 12,5 %) | 1,7/2,5 → 14,2/14,2 % | 37,5/32,5 → 37,5/38,3 % | 19,2/20,8 → 25,0/22,5 % |
| Star in den Top 2 | 17,5/20,8 → 35,8/29,2 % | 55,0/52,5 → 55,0/53,3 % | 35,8/32,5 → 50,8/50,8 % |
| Paare ≥ 15 Punkte richtig | 68,8/67,6 → 76,1/75,0 % | 67,2/65,8 → 77,0/75,6 % | 75,6/75,3 → 84,9/85,1 % |
| Team-Ergebnistreue¹ | 58,0/58,0 → 56,0/58,0 % | 91,3/86,1 → 84,3/88,7 % | 95,9/97,9 → 95,9/95,9 % |
| ε² Persönlichkeit | 0,229/0,255 → ≈ 0 / ≈ 0 | 0,133/0,078 → 0,019/0,068 | 0,100/0,087 → ≈ 0 / ≈ 0 |
| Verlässlichkeit Spiel-zu-Spiel² | 0,858/0,866 → 0,481/0,508 | 0,629/0,466 → 0,579/0,657 | 0,744/0,736 → 0,470/0,561 |

¹ Anteil der Spiele mit mindestens 5 Punkten Eignungsabstand der Seitenmittel, in denen die
eignungsstärkere Seite mehr als die Hälfte des Gesamtbeitrags holt. Für TDM betrifft das nur zwei
der fünf Paarungen, die Zahl ist dort entsprechend grob.
² Mittleres Spearman-rho der Wert-Vektoren zwischen je zwei Spielen derselben Paarung, Median über
die Paarungen — dieselbe Definition wie im 26.09.-Review.

**Die Einzelspielzahl steigt in allen sechs Fällen deutlich** (+0,09 bis +0,23), die Saisonzahl
ebenso (+0,14 bis +0,50). Star, Top 2 und Paartreue werden besser oder halten, in keinem Fall
schlechter. Die Paarungen, die fallen, sind überwiegend die, die schon vorher oben lagen (TDM
vigilante-armageddon 0,51 → 0,42/0,43, Battlefield goldengladiators 0,83 → 0,80/0,76). Dort lief der
Persönlichkeitskanal vermutlich zufällig *mit* der Eignung — richtig aus dem falschen Grund.

### 2.3 Warum Mini-DM nur den Zusammenhalt bekommt

Jede Variante, die in Mini-DM die Bindung vereinheitlicht, kostet dort die Team-Ergebnistreue:
V6 75/76 %, V8 76/72 %, V9 72/75 %, gegen 91/86 % im Ist-Stand. Das Muster ist über drei Varianten
und zwei Ströme stabil. V5 (nur Zusammenhalt) hält sie (84/89 %) und liefert zugleich die höchste
Mini-DM-Zahl überhaupt (0,588/0,576, zehn von zehn Paarung-Strom-Fällen besser). Warum die Bindung
gerade im Vier-gegen-vier ohne Kontrollpunkt am Teamergebnis hängt, ist nicht geklärt.

Ein Vorbehalt bleibt: Mini-DM wird laut Chris als 4-Team-FFA gespielt, gemessen wird weiter das
Vier-gegen-vier (Opus P0 vom 26.09., offen). Im FFA hat jedes Team einen einzigen Kämpfer, also keine
Linie, an der der Zusammenhalt ziehen könnte. Die Änderung ist dort vermutlich wirkungslos. Gemessen
ist das nicht.

---

## 3. Warum K1 scheiterte — und warum das hier etwas anderes ist

K1 (`arena-zielwahl-umsetzung.md`) hat drei der sechs Persönlichkeiten auf „Bedrohung“ gestellt, mit
Hysterese, in Variante 2 zusätzlich mit einem ANG-Basiswert. Ergebnis: TDM ±0, Mini-DM −0,26 bis
−0,31, Battlefield −0,04 bis +0,03. Der K1-Bericht vermutete das Startpatt (`bedrohungVon` ist für
alle 0, die Array-Reihenfolge entscheidet). Die Zerlegung liefert zwei bessere Erklärungen:

1. **K1 hat am falschen Kanal gedreht.** Die Zielneigung trägt die Fehlordnung nicht (V2 ≈ V0 in
   TDM). Jede Formel, die nur ändert, *wen* jemand angreift, bleibt in TDM wirkungslos — genau das
   hat K1 zweimal gemessen.
2. **Einheitliche Zielwahl schadet der Rangtreue.** V1 gegen V3 ist der K1-Fall unter kontrollierten
   Bedingungen: dieselben Verhaltensskalen, einmal alle auf „Bedrohung“, einmal jeder nach seiner
   Neigung. Die Vereinheitlichung kostet 0,07 (TDM), 0,13 (Mini-DM) und 0,08 (Battlefield). Eine
   plausible, nicht gesondert gemessene Ursache: Wer alle auf den Bedrohlichsten schickt, schickt sie
   auf den, der am meisten beiträgt — dessen Anteil fällt dann. K1-Variante 2 hat das mit dem
   ANG-Basiswert (über `aufEignung` proportional zur Eignung) noch verstärkt und war prompt in allen
   drei Disziplinen schlechter.

| | K1 (zweimal gescheitert) | diese Empfehlung |
|---|---|---|
| Kanal | Zielneigung (`PERSZIEL`, `bedrohungVon`) | Zusammenhalt und Bindung (`PERSDEF`) |
| Zielvielfalt | eingeebnet (vier von sechs auf eine Neigung) | bleibt vollständig erhalten |
| Eignung | indirekt gelesen (ANG-Basiswert ∝ Eignung) | an keiner Stelle gelesen |
| gemessen | TDM ±0, Mini-DM −0,31, BF ±0,04 | TDM +0,09/+0,19, Mini-DM +0,22/+0,21, BF +0,18/+0,23 |

### 3.1 Warum nicht „Eignung als Tiebreaker in der Zielwahl“

Die Aufgabenstellung nennt als Möglichkeit, die Eignung als Tiebreaker oder Modifikator in die
Persönlichkeitslogik zu holen. Davon rate ich ab, aus drei Gründen:

- **V2 zeigt, dass die Zielwahl nicht der Kanal ist.** Ein Tiebreaker dort repariert eine Stelle,
  die nicht kaputt ist.
- **Beide Richtungen sind problematisch.** Eine Zielwahl, die die Eignung des *Gegners* liest, ist
  nach Punkt 2 oben rho-feindlich. Eine, die die *eigene* Eignung liest, ist zirkulär: Die Abnahme
  misst dann, ob der Motor die gemessene Größe abschreibt. Der K1-Bericht hat diesen Weg aus
  demselben Grund ausgeschlossen.
- **Die Eignung hat ihren Kanal schon.** Über `aufEignung()` bestimmt sie LP, ANG und VER. Sie
  braucht keinen zweiten Weg, sondern nur ein Verhalten, das diese Menge nicht mehr nach
  Persönlichkeit verschluckt.

Die Persönlichkeitsdominanz wird also als Hebel *genutzt*: Sie zeigt, wo die eignungsfremde Varianz
sitzt, und nur dort wird eingegriffen.

---

## 4. Die Empfehlung, umsetzungsreif

### 4.1 Mechanik

Persönlichkeit bestimmt in der Arena künftig zwei Dinge: *wen* jemand angreift (Zielneigung,
unverändert) und *wann* er sich kurz löst (Haltung, unverändert). Zusammenhalt und Bindung sind
Handwerk. Sie stehen für alle auf der Skalenmitte, solange der Manager sie nicht von Hand setzt.

```js
// ARENA_ART: neues, optionales Feld. Fehlt es, bleibt die Disziplin bit-identisch.
tdm:{ label:"TDM", jeSeite:6, rezept:REC.power, persHandwerk:["z","b"] },
"mini-dm":{ ..., persHandwerk:["z"] },
battlefield:{ ..., persHandwerk:["z","b"] },

// Skalenmitte für beide Skalen — genau das, was gemessen wurde (V9 / V5).
const HANDWERK_MITTE={z:"ausgewogen",b:"ausgewogen"};
function persDefVon(pk,dId){
  const def=PERSDEF[pk], frei=((ARENA_ART[dId]||{}).persHandwerk)||[];
  return {h:def.h,
          z:frei.includes("z")?HANDWERK_MITTE.z:def.z,
          b:frei.includes("b")?HANDWERK_MITTE.b:def.b};
}
function behav(name,dId){
  const pk=persOf[name]||"duellant",def=persDefVon(pk,dId),t=takt[name]||{};
  const h=t.h||def.h, z=t.z||def.z, b=t.b||def.b;   // manuelle Regler gehen weiter vor
  ...                                                  // Rest unverändert
}
// baueEinheit():  const bh=behav(p.n,d);
```

Drei Hinweise für den Bau:

- **Der Stern im Taktik-Panel** („★ markiert, was diese Persönlichkeit von sich aus tut“) liest heute
  `PERSDEF[...][key]` direkt. Er muss über `persDefVon(pk,disc)` laufen, sonst zeigt die Anzeige
  einen Standard, den der Kampf nicht mehr fährt. Dasselbe gilt für den `behav(p.n)`-Aufruf im
  selben Block.
- **`neigungen()`** („Linientreu · Aufmerksam · Besonnen“) leitet seine Wörter aus denselben Skalen
  ab und ändert sich mit. Das ist richtig so, es beschreibt, was die Einheit tut.
- **`PERSDEF` selbst bleibt unverändert.** Die Persönlichkeiten behalten ihre Grundstellung für
  jede künftige Disziplin, die sie lesen will. Die Arena übersteuert nur, was sie als Handwerk
  erklärt.

### 4.2 Was der Zuschauer danach sieht

Weiterhin sechs erkennbar verschiedene Kämpfer. Der Draufgänger bricht die Spitze auf, der
Schleicher geht auf die hintere Reihe, der Beschützer schlägt Kameraden frei, der Opportunist sucht
den Angeschlagenen. Der Vorsichtige löst sich früher, der Ungestüme nie. Was wegfällt, ist ein
unsichtbares Handicap: Der Draufgänger rennt nicht mehr allein über das Feld und lässt sich nicht
mehr von jedem Abfänger umlenken. Im Bild ist das eher *mehr* Charakter, denn er kommt jetzt an der
Spitze an, statt unterwegs hängenzubleiben.

### 4.3 Eine Mechanik, je Disziplin isoliert

Es ist **eine** Mechanik mit **einer** Regel („Persönlichkeit wählt Ziel und Mut, das Handwerk ist für
alle gleich“). Welche Skala als Handwerk gilt, legt jede Disziplin selbst fest. TDM und Battlefield
nehmen beide, Mini-DM nur den Zusammenhalt (Abschnitt 2.3). Damit ist jede Disziplin für sich
abschaltbar und für sich abzunehmen. Das Isolationsargument für das geteilte Chassis entfällt. Die
17 Nicht-Arena-Disziplinen sind strukturell unberührt, denn `PERSDEF` wirkt nur über
`baueEinheit()`, und das rufen nur die Arena-Disziplinen.

### 4.4 Synergie mit der „Haltung“-Achse aus PR #1118

Das Manager-Konzept vom 02.10. schlägt eine Achse „Absichern/Normal/Angreifen“ vor. In der Arena
existiert sie bereits als Skala `HALTUNG` (defensiv bis ungestüm), und diese Messung liefert das
wichtigste Argument für ihre Freigabe: **Die Haltung ist rangtreue-neutral** (V4 ≈ V0 in allen drei
Disziplinen). Sie ist die eine Verhaltensskala, die man dem Manager als echten Risiko-Knopf geben
kann, ohne die Abnahme zu gefährden.

Für Zusammenhalt und Bindung gilt das Gegenteil. „Eigenmächtig“ und „opportunistisch“ sind heute
schlicht schlechter, also Fallen statt Optionen. Das verletzt die Designregel 3 aus PR #1118 („kein
Knopf darf immer besser sein“, hier: immer schlechter). Als freie Manager-Knöpfe taugen sie erst,
wenn sie einen Gegenwert bekommen.

---

## 5. Realistische Einschätzung für TDM: eine andere Größenordnung

### 5.1 Was der Eingriff an der Zerlegung ändert

CLAUDE.md zerlegt die Einzelspiel-Rangtreue in Saison-Validität mal Wurzel der Verlässlichkeit. TDM,
Strom 2:

| | Validität (rho Saison) | Verlässlichkeit | Produkt | gemessen |
|---|---:|---:|---:|---:|
| V0 (Ist) | 0,189 | 0,866 | 0,18 | 0,247 |
| V9 | 0,413 | 0,508 | 0,29 | 0,432 |

Der Ist-Stand ist **hoch verlässlich und fast nicht valide**: Das Persönlichkeitsverhalten ordnet die
Spieler in jedem Spiel gleich, nur nicht nach Eignung. Nach dem Eingriff kippt das Bild: Die
Validität verdoppelt sich, die Verlässlichkeit fällt um gut 40 %. Die Formel unterschätzt
die gemessene Zahl hier, die Größenordnung trägt aber. In Battlefield passiert dasselbe
(0,74 → 0,47–0,56), in Mini-DM nicht (0,47–0,63 → 0,58–0,66).

### 5.2 Die Obergrenze

Selbst bei perfekter Validität läge die Einzelspielzahl ungefähr bei der Wurzel der Verlässlichkeit:

| | Verlässlichkeit nach dem Eingriff | Obergrenze ≈ √Verlässlichkeit | heute gemessen |
|---|---:|---:|---:|
| TDM | 0,48–0,51 | **≈ 0,70** | 0,42–0,43 |
| Battlefield | 0,47–0,56 | ≈ 0,69–0,75 | 0,58–0,62 |
| Mini-DM (V5) | 0,58–0,66 | ≈ 0,76–0,81 | 0,58–0,59 |

**Keine der drei Disziplinen erreicht 0,80 allein über Persönlichkeit, Zielwahl oder Validität.**
Für TDM bräuchte es zugleich eine Verlässlichkeit von mindestens 0,64 **und** eine Validität nahe 1.
Heute liegt sie bei 0,41–0,45.

Damit kehrt sich für die Arena die CLAUDE.md-Regel „mehr Ereignisse helfen fast nie“ um. Die Regel
stammt aus Hockey, wo die Verlässlichkeit nicht der Engpass war. In TDM und Battlefield **wird** sie
nach diesem Eingriff der Engpass. Für TDM halte ich drei Ursachen für plausibel, gemessen habe ich
sie nicht:

- **Zwölf Teilnehmer bei engem Eignungsband.** In drei von fünf Paarungen liegen die Seitenmittel
  keine 2,5 Punkte auseinander. Zwölf Spieler in so ein Band zu ordnen heißt viele Paare unter zwei
  Punkten Abstand — die kann laut CLAUDE.md kein Motor ordnen.
- **Respawn und Zeitende ohne Kill-Limit.** Ein K.o. ist 140 Beitragspunkte wert, verteilt nach
  Schadensanteil. Wer in welcher Respawn-Welle an wem hängt, streut stark.
- **Die Eignung wirkt nur über `aufEignung()`.** 10 % mehr Eignung sind 10 % mehr LP, ANG und VER.
  In einem Kampf mit vielen gleichzeitigen Gefechten ist das wenig gegen die Streuung.

### 5.3 Was TDM danach braucht

Nach V9 bleibt in TDM **kein großer kategorialer Kanal** mehr: Persönlichkeit ε² ≈ 0, Archetyp
0,03/0,12, Reihe und Seite ≈ 0. Die restliche Fehlordnung steckt nicht mehr in einer Gruppe von
Spielern, sondern im Wertmaßstab (`beitragVon` ist rollenblind, Anteil am Gesamtbeitrag über zwölf
Spieler) und im Format. Beides hat Chris selbst gesetzt. Für TDM heißt das, in dieser Reihenfolge:

1. **Dieser Schritt.** Validität 0,19–0,31 → 0,41–0,45, Star auf Rang 1 von 2 % auf 14 %.
2. **Der Wertmaßstab.** Rollen-Wertung statt Schadensanteil (26.09.-Review, P2) ist der einzige
   benannte Hebel, der in TDM noch Validität in der nötigen Größenordnung verspricht.
3. **Die Abnahmefrage an Chris.** Selbst danach begrenzt die Verlässlichkeit TDM auf rund 0,70.
   CLAUDE.md erlaubt ausdrücklich, nach Star und Paartreue mit Abstand zu fragen statt nach einer
   nackten Rangkorrelation über zwölf Spieler. Wenn nach Punkt 2 die Saison-Validität über 0,85
   liegt und die Einzelspielzahl unter 0,70 bleibt, ist das der Zeitpunkt für diese Frage.

**Battlefield** steht nach dem Eingriff anders da: Saison-Validität 0,76–0,81, also nahe an
Basketball und Hockey. Es ist jetzt der Fall „Saison hoch, Einzelspiel niedrig — es fehlen
Ereignisse“. Der passende nächste Schritt ist das Format, also Opus P3 vom 26.09. (Tickets und
Respawn, Chris' offene Frage 2). Daneben bleibt ein Archetyp-Effekt von ε² 0,20–0,23 als kleinerer
zweiter Hebel. **Mini-DM** ist am nächsten an 0,80, wird aber im falschen Format gemessen. Bevor
dort weiter gearbeitet wird, gehört das FFA in die Sonde.

---

## 6. Pp-Verträglichkeit

**Die Matrix bleibt unberührt, und es entsteht kein neuer Attributkanal.** Die Persönlichkeit wird
aus Klasse, Rasse, Unterklassen und Traits abgeleitet (`leitePers`), nicht aus einem der zwölf
Matrix-Attribute. `einflussVon()` hebt ein Attribut eines Spielers und vergleicht. Dessen
Persönlichkeit ist in beiden Läufen dieselbe, und die Eignung wächst in beiden Fällen über
`aufEignung()` genau wie heute. Die Änderung kann die Matrixgewichte also nicht direkt verzerren.

**Indirekt kann sie die Pp-Zahl verschieben, und zwar über die Bewegung.** In TDM lesen Speed und
Dexterity (Matrixgewicht 0) heute 7–10 % Einfluss, weil TMP außerhalb der `aufEignung()`-Normierung
liegt (`tdm-pp-rezeptrunde-diagnose-02-10.md`, Abschnitt 4.2). Eigenmächtiges Laufen und häufiges
Umzielen sind bewegungsintensiv. Fallen sie weg, sollte der Tempo-Anteil eher sinken und Pp eher
besser werden. Das ist eine Erwartung, keine Messung. Eine TDM-Pp-Messung kostet rund 785 s je Lauf
und war in dieser Konsultation nicht drin.

Alle drei Disziplinen verletzen die 25-Pp-Schranke schon heute (TDM 66–76, Mini-DM 115,
Battlefield 54 Pp laut `stand-aller-disziplinen.md` und PR #1124). Nach der CLAUDE.md-Vorrangregel
(rho vor Pp) ist der Schritt deshalb zulässig, **solange er Pp nicht messbar verschlechtert.** Das
ist Kriterium F in Abschnitt 7. Die Pp-Reparatur selbst bleibt eine eigene Runde am Chassis
(TMP/AUS-Normierung), nicht Teil dieser Empfehlung.

---

## 7. Abbruchkriterien für die Bau-Runde

Vorbild ist der I-Spy-P1-Anlauf: festgeschriebene Kriterien, gemessen mit den offiziellen
Werkzeugen. Weil dieses Dokument schon eine Vorschau auf einer Kopie liefert, muss die Bau-Runde
die Vorschau am echten Code **bestätigen**, nicht nachjustieren.

**Die 0,80 ist ausdrücklich NICHT das Kriterium dieses Schritts.** Nach Abschnitt 5.2 kann keine der
drei Disziplinen sie über diesen Weg allein erreichen. Wer den Schritt an 0,80 bindet, verwirft einen
richtigen Schritt aus dem falschen Grund.

**Annahme je Disziplin** — `miss-alle-disziplinen.mjs 24 <d>` und `miss-star-paartreue.mjs 24 <d>`,
kaderfest, beide Saatströme:

| | Kriterium | Vorschau aus dieser Konsultation |
|---|---|---|
| **A** | Median rho je Spiel ≥ Ist + 0,05, in **beiden** Strömen | TDM +0,09/+0,19 · Mini-DM +0,22/+0,21 · BF +0,18/+0,23 |
| **B** | Median rho Saison steigt in beiden Strömen | TDM +0,14/+0,22 · Mini-DM +0,28/+0,33 · BF +0,50/+0,45 |
| **C** | paarweise besser in ≥ 6 von 10 Paarung-Strom-Fällen | TDM 6 · Mini-DM 10 · BF 7 |
| **D** | Star auf Rang 1, Star in den Top 2, Paare ≥ 15 Punkte: keiner mehr als 3 Prozentpunkte unter Ist | überall gestiegen oder gehalten |
| **E** | Team-Ergebnistreue im Mittel beider Ströme nicht mehr als 5 Prozentpunkte unter Ist | TDM −1 · Mini-DM −2 · BF −1 |
| **F** | Pp (n = 12, zwei Ströme; TDM n = 6 als Richtung) nicht mehr als 6 Pp über Ist — die gemessene Stromspreizung von TDM | nicht gemessen |
| **G** | die 17 Nicht-Arena-Disziplinen bit-identisch (`miss-alle-disziplinen.mjs 24`) | strukturell zu erwarten |

**Zu C — bewusst 6 von 10 statt 4 von 5 je Strom wie bei I-Spy.** Ein Schritt, der einen
eignungsfremden Kanal *entfernt*, muss die Paarung verschlechtern, in der dieser Kanal zufällig mit
der Eignung lief. Eine 4-von-5-Regel bestrafte genau den gewollten Effekt. A und B fangen den Fall
ab, dass sich nur die Verteilung verschiebt und nichts besser wird.

**Zu E — warum Team-Ergebnistreue dazugehört.** Sie ist das Kriterium, an dem V8 und die
Bindungs-Varianten für Mini-DM in dieser Konsultation gescheitert sind (−15 bis −19 Prozentpunkte).
Chris' Grundmodell verlangt, dass ein klar überlegenes Team rund 95 % gewinnt. Ein Schritt, der die
Einzelordnung bessert und dafür das Teamergebnis zum Münzwurf macht, ist kein Fortschritt.

**Abbruch:**

- Verfehlt eine Disziplin eines der Kriterien A–F → nur dort `persHandwerk:[]`, die anderen bleiben.
- Verfehlen alle drei A oder B → **die Persönlichkeitsspur ist beendet.** Kein weiterer Anlauf an
  `PERSZIEL`, `PERSDEF` oder `bedrohungVon`. Die nächste Runde geht an den Wertmaßstab (26.09., P2).
- Bestätigt der Bau Mini-DM nur mit z+b statt mit z allein (A–E), gilt trotzdem z allein. Die
  Team-Ergebnistreue geht vor einem höheren Median.

**Wann gilt der Weg zu 0,80 als gescheitert?** Wenn nach diesem Schritt **und** dem
Wertmaßstab-Schritt die Saison-Validität einer Disziplin unter 0,80 bleibt, liegt das Problem weder
in der Zielwahl noch im Verhalten noch in der Wertung. Dann geht es um Format oder Abnahme — eine
Frage an Chris, keine weitere Konsultation. Für TDM ist absehbar, dass es auf die Abnahmefrage aus
5.3 hinausläuft.

---

## 8. Die schwächere Alternative: graduelle Kompression aller drei Skalen

Statt zwei Skalen ganz zu vereinheitlichen, rückt jede der drei Skalen jeder Persönlichkeit eine
Stufe zur Mitte (V7). Beispiel Draufgänger: „ungestüm/eigenmächtig/opportunistisch“ wird
„offensiv/locker/flexibel“. Gemessen, nur Strom 1: TDM 0,391, Mini-DM 0,462, Battlefield 0,442 —
alle drei besser als heute, alle drei schlechter als die Empfehlung.

Ich empfehle sie trotzdem nicht, aus drei Gründen:

- In TDM bleibt der Persönlichkeitseffekt bei ε² 0,26, so groß wie vorher. V7 verschiebt den Kanal
  nur, statt ihn zu entfernen.
- Die Mini-DM-Spannweite wächst auf 0,96.
- Die Regel ist schwerer zu erklären. „Etwas weniger eigenmächtig“ sieht niemand. „Persönlichkeit
  wählt Ziel und Mut, das Handwerk ist für alle gleich“ versteht jeder.

---

## 9. Zwei Fragen an Chris

1. **Persönlichkeit bestimmt in der Arena künftig Ziel und Haltung, nicht mehr Zusammenhalt und
   Bindung** — einverstanden? Der Charakter bleibt sichtbar, nur das unsichtbare Handicap fällt weg.
2. **Haltung als erster Manager-Risiko-Knopf in der Arena** (gemessen rangtreue-neutral, Abschnitt
   4.4) — soll das in das Grundgerüst aus PR #1118 aufgenommen werden?

---

## 10. Bau-Runde 07.10. — eingeschaltet nur Mini-DM; Battlefield verfehlt F, TDM: F ungemessen

**Ergebnis in einem Satz:** Die Mechanik ist gebaut, eingeschaltet ist sie nur in Mini-DM
(`persHandwerk:["z"]`, alle Kriterien A–F bestanden). Battlefield steht nach Abbruchregel 1 auf
`[]` (A–E bestanden, F klar verfehlt). TDM steht ebenfalls auf `[]`: A–E bestanden, aber die
Pflicht-Pp-Messung (F) kam auf der überlasteten Messmaschine nicht ins Ziel (10.3a). Beide sind
damit bit-identisch zum Stand vor P1.

Chris hat Frage 1 aus Abschnitt 9 freigegeben. Gebaut wurde **exakt Abschnitt 4.1**:
`HANDWERK_MITTE`, `persDefVon(pk,dId)`, `behav(name,dId)`, `baueEinheit()` ruft `behav(p.n,d)`,
das Taktik-Panel liest Anzeige und Stern über `persDefVon(pk,disc)`, `PERSDEF` bleibt
unverändert. Dazu eine Mess-Schnittstelle `window.__arena.persHandwerk({...})` nach dem Muster
`buehneFlags` (nur Messung/QA, kein Spiel ruft sie). Gemessen mit
`scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs` (Nullprobe und Eingriff auf derselben
Seite, beide Saatströme wie in 2.2, Kriterien A–E automatisch), Pp mit
`scripts/messe-arena-einfluss.mjs` (Strom 2 über `--saat-versatz=10000000`, „vorher“ auf einem
`origin/main`-Abzug 2470c502 über den Pfad-Parameter des Skripts).

**Die Vorschau aus der Konsultation bestätigt sich am echten Code auf die dritte
Nachkommastelle** — rho je Spiel, rho Saison, Spannweite, Star, Top 2, Paare ≥ 15 und
Team-Ergebnistreue sind in allen sechs Disziplin-Strom-Zellen identisch mit Abschnitt 2.2
(einzige Abweichung: TDM-Paare ≥ 15 Strom 1 76,2 statt 76,1 %, Rundung; TDM-Star Rang 1
Strom 2 15,0 statt 14,2 %).
Nachjustiert wurde nichts.

### 10.1 Nullprobe

Schalter aus (`persHandwerk:[]` für alle drei) ist **bit-identisch** zum Stand vor P1: SHA-256
über alle zurückgegebenen Teilnehmerlisten (n = 24, fünf Paarungen, `zielDiag:true`) gleich dem
`origin/main`-Abzug in allen sechs Disziplin-Strom-Zellen (`tdm` f1dee6dc…/8c535b45…, `mini-dm`
b1e1bd3f…/c3dc4234…, `battlefield` bb0f1f6d…/d23e76fc…). Die Fingerabdrücke stehen als Referenz
im Verify-Skript.

### 10.2 Kriterien A–F je Disziplin (Strom 1 / Strom 2)

| | TDM (z+b, V9) | Mini-DM (z, V5) | Battlefield (z+b, V9) |
|---|---|---|---|
| **A** rho je Spiel | 0,324/0,247 → **0,416/0,432** ✓ | 0,365/0,363 → **0,588/0,576** ✓ | 0,399/0,391 → 0,583/0,616 ✓ |
| **B** rho Saison | 0,308/0,189 → 0,448/0,413 ✓ | 0,311/0,311 → 0,595/0,643 ✓ | 0,310/0,310 → 0,810/0,762 ✓ |
| **C** Paarungen besser | 6 von 10 ✓ | 10 von 10 ✓ | 7 von 10 ✓ |
| **D** Star Rang 1 | 1,7/2,5 → 14,2/15,0 % ✓ | 37,5/32,5 → 37,5/38,3 % ✓ | 19,2/20,8 → 25,0/22,5 % ✓ |
| **D** Star Top 2 | 17,5/20,8 → 35,8/29,2 % ✓ | 55,0/52,5 → 55,0/53,3 % ✓ | 35,8/32,5 → 50,8/50,8 % ✓ |
| **D** Paare ≥ 15 | 68,8/67,6 → 76,2/75,0 % ✓ | 67,2/65,8 → 77,0/75,7 % ✓ | 75,6/75,3 → 84,9/85,1 % ✓ |
| **E** Team-Ergebnistreue (Mittel) | 58,0 → 57,0 % ✓ | 88,7 → 86,5 % ✓ | 96,9 → 95,9 % ✓ |
| **F** Pp (vorher → nachher) | **nicht gemessen** (10.3a) | 77,9/85,2 → **55,6/43,9** ✓ | 35,7/48,6 → **62,8/85,4** ✗ |
| ε² Persönlichkeit | 0,229/0,255 → ≈ 0/≈ 0 | 0,133/0,078 → 0,019/0,068 | 0,100/0,087 → ≈ 0/≈ 0 |
| Verlässlichkeit | 0,858/0,866 → 0,481/0,508 | 0,629/0,466 → 0,579/0,657 | 0,744/0,736 → 0,470/0,561 |

Pp: Mini-DM und Battlefield n = 12, zwei Ströme, „vorher“ auf dem `origin/main`-Abzug. Die
TDM- und Battlefield-Spalten von A–E sind mit V9 gemessen (Diagnose, heute nicht eingeschaltet).
Die offizielle `miss-star-paartreue.mjs`-Gegenmessung wurde aus Zeitgründen abgebrochen; Star,
Top 2 und Paare ≥ 15 stammen aus dem Verify-Skript, das dieselbe Definition auf denselben
`disziplinProbe`-Rohdaten rechnet.

### 10.3a TDM: A–E bestanden, F ungemessen — vorerst `persHandwerk:[]`

Die TDM-Pp-Messung (n = 6, zwei Ströme, vorher/nachher, vier parallele Läufe) lief 2,7 Stunden,
ohne ein Ergebnis zu liefern — die Messmaschine war mit mehreren parallelen Agenten überlastet
(Last 20–50 auf vier Kernen; ohne Last braucht ein Lauf rund 80 min). Abgebrochen auf Anweisung
der Koordination. CLAUDE.md macht Pp zur Pflichtprüfung, und Battlefield zeigt, dass V9 Pp
deutlich verschlechtern kann. Ohne F-Zahl wird TDM deshalb **nicht** eingeschaltet. Nachholen:

    node scripts/messe-arena-einfluss.mjs tdm 6 <origin/main-Abzug>/public/mockups/battle-mode.html
    node scripts/messe-arena-einfluss.mjs tdm 6 <…> --saat-versatz=10000000
    (und dieselben zwei mit tdm:{persHandwerk:["z","b"]} im Arbeitsbaum)

Hält F (nicht mehr als 6 Pp über Ist), genügt die Ein-Zeilen-Änderung `persHandwerk:["z","b"]`
in `ARENA_ART.tdm`. A–E sind dann bereits belegt (Tabelle oben).

### 10.3 Battlefield: F verfehlt — `persHandwerk:[]`

Battlefield besteht A–E klar, verfehlt aber F in **beiden** Strömen deutlich: +27,1 und +36,8
Pp, erlaubt waren +6 (die gemessene Stromspreizung der Ist-Messung selbst liegt bei 12,9 Pp).
Nach Abbruchregel 1 bekommt Battlefield deshalb `persHandwerk:[]` und läuft bit-identisch wie
vor P1. Die Erwartung aus Abschnitt 6 („Fallen eigenmächtiges Laufen und
Umzielen weg, sollte der Tempo-Anteil eher sinken“) hat sich für Battlefield also **nicht**
bestätigt. Das Muster je Strom ist bei n = 12 nicht stabil genug für eine Ursachenaussage
(Strom 1: Charisma, Matrixgewicht 20, fällt von 20,2 % auf 1,1 %, Spirit steigt von 16,8 auf
27,9 %; Strom 2: Awareness und Intelligence — beide tragen TMP, das außerhalb von
`aufEignung()` liegt — steigen zusammen von 40,0 auf 67,7 %, Torment fällt von 14,5 auf 0 %).
Stabil ist nur die Summe: Die Mechanik ordnet mit V9 das Ergebnis nach Eignung deutlich besser
(Saison-Validität 0,31 → 0,76–0,81), aber aus anderen Attributen, als die Matrix bepreist —
genau der Fall, den die Pp-Pflicht aus CLAUDE.md abfangen soll.

Für eine spätere Battlefield-Runde heißt das: Der Persönlichkeits-Schritt ist dort messbar der
richtige rho-Hebel, braucht aber vorher oder zugleich die Pp-Reparatur am Chassis (TMP/AUS-
Normierung, Abschnitt 6 letzter Absatz). Die Diagnose-Variante ist mit
`node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs --disziplinen=battlefield --variante=battlefield:z+b`
jederzeit wiederholbar.

### 10.4 Mini-DM

Mini-DM verbessert sich in **allen** Kriterien, auch in F: Pp sinkt um 22 bzw. 41 Punkte. Der
größte Einzelgewinn ist Will (Matrix 14), der vorher in beiden Strömen 0 % las und jetzt mit
Gewicht ankommt. Mini-DM bleibt mit 44–56 Pp über der absoluten 25-Pp-Schranke aus CLAUDE.md —
wie vorher (78–85), nur deutlich weniger. Eingeschaltet wird es trotzdem: Kriterium F dieses
Dokuments (nicht mehr als 6 Pp über Ist) ist genau für diesen Fall formuliert, und der Schritt
verbessert **beide** Pflichtzahlen der Disziplin, rho und Pp.

Das 4-Team-FFA baut seine Einheiten über denselben `baueEinheit(...,"mini-dm")`. Es vergibt
im echten Spiel Ligapunkte (`FoundationBattleArenaHost`) und ist mit dieser Änderung **nicht**
gemessen. Nach dem Opus-Review baut das FFA seine Einheiten deshalb ausdrücklich ohne Handwerk
(`persHandwerk` wird nur für den FFA-Aufbau geleert) und bleibt bit-identisch, bis eine
FFA-Sonde es abnimmt. Eingeschaltet ist P1 damit genau dort, wo es gemessen ist: im
Mini-DM-4-gegen-4. Nachgewiesen über `window.__arena.miniDmFfaEvent` mit vier echten,
unterschiedlichen Kadern aus der Kader-Familie und sechs Saaten: SHA-256 der Ereignisse
gleich dem `origin/main`-Abzug (`0f494fdb…`). Der Spiegeltest `scripts/miss-mini-dm-ffa-spiegel.mjs 96` (384 Runden, vier identische Kämpfer)
liefert vorher und nachher dieselbe Tabelle bis auf die letzte Stelle (größte Abweichung von
25 % auf Platz 1: 6,0 Prozentpunkte, beide Male). Das ist ein Fairness-Nachweis, keine
Wirkungsmessung: Vier identische Kämpfer sind gegen jede Verhaltensänderung symmetrisch. Ob der
Zusammenhalt im FFA die Rangtreue bewegt, bleibt — wie in 2.3 — ungemessen, solange die Sonde das
FFA nicht abnimmt.

### 10.5 Isolation (G)

Alle zwanzig Disziplinen über `disziplinProbe` (Kader-Familie, n = 2 je Paarung — gekürzt,
weil `miss-alle-disziplinen.mjs 24` für alle zwanzig auf der überlasteten Maschine nicht in
vertretbarer Zeit durchlief), SHA-256 der vollständigen Rückgabe, eingebauter Stand gegen den
`origin/main`-Abzug: **19 von 20 bit-identisch**, nur Mini-DM bewegt sich (`169b125e…` →
`69cffcb4…`). TDM und Battlefield sind mit `persHandwerk:[]` eingeschlossen; für sie belegt
zusätzlich die n = 24-Nullprobe aus 10.1 die Bit-Gleichheit in beiden Strömen. Seitenfehler
keine. Das Taktik-Panel zeigt in Spurt unverändert die `PERSDEF`-Sterne, in einer Disziplin mit
Handwerk „Ausgewogen ★“ (Playwright-Stichprobe).

### 10.6 Die zweite Frage an Chris

Frage 2 aus Abschnitt 9 (Haltung als erster Manager-Risiko-Knopf) ist **nicht** Teil dieses
Pakets — sie geht über die Bau-Freigabe hinaus und gehört in das Grundgerüst aus PR #1118. Die
Haltung bleibt hier, wie in 4.1 empfohlen, persönlichkeitsabhängig und unverändert; die Messung
dieser Runde ändert nichts an der Aussage aus 4.4 (Haltung rangtreue-neutral).

---

## Anhang A — Messmethode (zum Wiederholen)

**Seit der Bau-Runde 07.10. (Abschnitt 10) gibt es dafür ein Skript:**
`scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs` (Varianten über `--variante=`, z. B.
`tdm:z+b`). Der folgende Text beschreibt den ursprünglichen Weg der Konsultation.

Kein Skript im Repo, mit Absicht: Die Konsultation sollte keinen Code bringen. Wiederholbar in drei
Schritten:

1. `public/mockups/` in ein temporäres Verzeichnis kopieren und dort in `battle-mode.engine.js` genau
   einen Block ersetzen:
   - V1: in `leitePers()` die Schleife `for(const[k,v]of Object.entries(sc))if(v>bv){...}` entfernen
     (jeder wird Duellant);
   - V2: `PERSZIEL` für alle sechs auf `"naechster"`;
   - V3–V9: in `PERSDEF` die genannten Skalen für alle sechs Persönlichkeiten auf den genannten Wert
     (V7: jede Skala eine Stufe Richtung `h:"ausgewogen"`, `z:"ausgewogen"`, `b:"treu"`).
2. Die kopierte `battle-mode.html` mit Playwright laden und
   `window.__arena.disziplinProbe(d, {n:24, kaderFamilie, zielDiag:true})` für `tdm`, `mini-dm` und
   `battlefield` rufen. Die Kader-Familie kommt über `ladeKaderFamilieAusDatei()` aus
   `scripts/lib/rangtreue-messung.mjs`. Strom 2 zusätzlich mit `saat0:900001, mutatorSaat:10000000`.
3. Auswertung wie in `miss-alle-disziplinen.mjs` (rho je Spiel gemittelt je Paarung, dann Median)
   und `miss-arena-rangvarianz-aufschluesselung.mjs` (Perzentil-Rang-Residuum je Paarung, eta²).
   Ergänzt um ε² = 1 − (1−eta²)(n−1)/(n−k), Cramérs V für Persönlichkeit × Archetyp, die
   Verlässlichkeit (Definition in 2.2) sowie Star, Paare ≥ 15 und Team-Ergebnistreue nach der
   Definition in 2.2, je Spiel aus den zurückgegebenen Teilnehmerlisten.

V0 reproduziert die PR-#1125-Zahlen exakt (TDM 0,324, Mini-DM 0,365, Battlefield 0,399). Die Saaten
sind deterministisch: Eine Wiederholung von V0 und V8 auf beiden Strömen sowie von V5 und V6 auf
Strom 1 lieferte bit-gleiche Mediane. Laufzeit je Variante und Strom: rund 11 min für TDM, je 3 min für Mini-DM und
Battlefield.

**Was diese Konsultation nicht gemessen hat:** Pp in irgendeiner Variante, das Mini-DM-FFA,
`miss-star-paartreue.mjs` als offizielles Werkzeug (die Star- und Paarzahlen sind eine eigene
Nachrechnung auf denselben Spielen), n > 24, die Ursache der niedrigeren Verlässlichkeit nach dem
Eingriff (Abschnitt 5.2 nennt nur Kandidaten) und warum die Bindung in Mini-DM am Teamergebnis
hängt (Abschnitt 2.3).

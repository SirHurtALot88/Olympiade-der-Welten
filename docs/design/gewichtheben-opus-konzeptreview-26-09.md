# Gewichtheben — Konzeptreview: Gameplay und Taktik (Opus, 26.09.)

Unabhängiger Gegencheck im Rahmen von Chris' „vollem Programm": Es geht **nicht** um die
Rangtreue (0,843 / 0,854, beide über der Schranke), sondern um die Frage, ob die Mechanik
taktisch echtes Wettkampf-Gewichtheben abbildet. Die Leitfrage lautet: Gibt es eine echte
Gewichtswahl mit Risiko und Ertrag, oder ist es ein Attributsvergleich im Gewand eines
Wettkampfs?

Reines Konzept. Am Motor wurde nichts geändert. `engine.js` meint
`public/mockups/battle-mode.engine.js`, Stand `main` `254a56c5`. Die Messungen in A.3 stammen
aus einem Wegwerf-Skript, das über Playwright `window.__arena.spiele("gewichtheben", saat)` für
300 Saaten aufruft und das Protokoll auswertet (Verfahren am Ende). **Einschränkung:** Das ist
der Standardkader des Mockups, 12 Heber, 3.600 Heber-Auftritte. Die Zahlen beschreiben also die
Mechanik und keine Kaderfamilie. Für Aussagen über die Mechanik reicht das, für eine
rho-Aussage nicht, und eine solche wird hier auch nicht gemacht.

Vorgänger, gelesen: `gewichtheben-plan.md` (Fable, Grundplan und Recherche),
`gewichtheben-gameplay-fertig.md`, `gewichtheben-zufriedenstellend.md`,
`gewichtheben-risiko-versuch-recherche-06-09.md` (kühner Versuch),
`gewichtheben-spannung-recherche-13-09.md` (Zweikampf-Stand, duellbewusste Eröffnung) und
`football-gewichtheben-opus-review.md` Teil A. Was dort schon geprüft und verworfen wurde,
schlage ich hier nicht noch einmal vor. Wo ich widerspreche, sage ich es.

---

## Kurzfassung

1. **Das Gerüst ist echt, und es ist gut.** Es gibt zwei Übungen mit je drei Versuchen und den
   Zweikampf, eine harte Nullwertung und IWF-Gelingensquoten je Versuch. Im dritten Versuch
   hebt die leichtere Ansage zuerst, und die schwerere hat das letzte Wort. Das Stoßen reagiert
   auf den Zweikampf-Stand, und die Eröffnung im Duell kennt den Gegner. Das Duell-Format
   (Slot gegen Slot) ist ein echter Aufstellungshebel. Die Vorgängerrunden haben viel richtig
   gemacht.
2. **Der Kernbefund: Die Last kostet kein Risiko.** Die Gelingenschance hängt an der
   **Versuchsnummer** (`HEBEN_BASIS[uebung][v]`) und an Attributen. Vom **gewählten Gewicht**
   hängt sie nur ab, wenn die Ansage über `risikoMax` liegt. Das betrifft gemessen **18,4 %**
   aller Versuche. In den übrigen 81,6 % gelingt ein Versuch bei 88 % des Könnens genauso oft
   wie einer bei 99 %. Im echten Gewichtheben ist das Verhältnis von Last zu Tagesform die
   ganze Taktik. Hier fehlt diese Kopplung.
3. **Deshalb gibt es keine Gewichtswahl, sondern nur einen Gewichtswert.** Eröffnung und
   Sprünge rechnet der Motor deterministisch aus dem Attribut ANSAGE (Charisma) und aus dem
   Slot-Plan. Mehr ANSAGE ist ausnahmslos besser. Kein Manager und keine KI wägt irgendwo ab.
   Beide Heber eines Duells bekommen zudem **denselben** Slot-Plan (`a.rolle=b.rolle=plan`).
   Die „Strategie" unterscheidet also nie die beiden Gegner.
4. **Nach einem Fehlversuch geht die Last runter, und das ist regelwidrig.** In **66,7 %** der
   Folgeversuche nach einem Fehlversuch liegt die Last *unter* der verpatzten
   (`HEBEN_FEHL_REDUKTION` = 6 %). Die IWF-Regel sagt, dass die Hantel nie leichter wird.
   Diesen Umbau hat Chris am 06.09. selbst angestoßen („117 nicht geschafft, dann eher 110").
   Die Absicht dahinter ist richtig, die Umsetzung verletzt aber eine Grundregel des Sports.
   Das entscheidet Chris. Ein regelkonformer Weg zu seinem Ziel steht in Vorschlag P3.
5. **Die Nullwertung ist hart, aber fast nie die Folge einer Entscheidung.** Gemessen liegt sie
   bei 1,0 %. Das ist weniger als die 2,6 %, die der Plan selbst aus den IWF-Quoten simuliert
   hat. Die Absenkung nach dem Fehlversuch und der Wiederholungs-Zuschlag (+19 Pp) dämpfen sie
   zusätzlich. Das größte Drama des Sports, „er hat sich verzockt", kann heute nicht entstehen,
   weil sich niemand verzocken kann.
6. **Reißen und Stoßen sind dieselbe Formel zweimal.** Der einzige Unterschied sind die
   Basisquoten und ein ERHOLUNG-Faktor auf das Stoß-Maximum. Einen Techniker-Weg (Reißen) neben
   einem Kraft-Weg (Stoßen) gibt es nicht. Nebenbefund: Das Stoßen/Reißen-Verhältnis liegt im
   Median bei **1,146**, real sind es rund **1,25** (Reißen ≈ 80 % des Stoßens).
7. **Priorität:** **P1** koppelt das Gelingen an die relative Last (plus eine verdeckte
   Tagesform). Das ist das Fundament, ohne das jede Taktik wirkungslos bleibt. **P2** macht den
   Versuchsplan zur Trainer-Entscheidung, am besten über die schon vorhandene
   Intensitätsstufe. **P3** stellt die Reaktion auf einen Fehlversuch regelkonform um. **P4**
   trennt Reißen und Stoßen mechanisch (mehrere Wege). **P5** lässt Nerven in Drucksituationen
   zählen statt nach Versuchsnummer. P6 und P7 sind Aufräum- und Darstellungsarbeit.

---

## (a) Bestandsaufnahme

### A.1 Was gebaut ist, gegen den echten Sport gehalten

| Element | Echtes Gewichtheben (IWF) | Motor (`baueHebenDuelle` / `hebeUebung`) | Urteil |
|---|---|---|---|
| Übungen | Reißen, dann Stoßen, je 3 Versuche, Zweikampf = Summe der Besten | identisch (`rundenN:6`) | ✔ |
| Nullwertung | 3 Fehlversuche in einer Übung → kein Zweikampf | identisch (`u.nullwertung`, Zweikampf 0) | ✔ |
| Gelingensquoten | Ergebnis der **Lastwahl**: V1 ≈ 86–89 %, V3 ≈ 51–59 % (Sci Rep 2024) | **Eingabe** je Versuchsnummer (`HEBEN_BASIS`), gemessen 85,6/78,9/60,5 und 87,6/75,3/60,8 % | Zahl ✔, Ursache ✘ (s. B.1) |
| Eröffnung | taktisch: sicher genug, um nicht zu nullen, hoch genug, um nichts zu verschenken | `plan.eroeffnung` (Slot) + ANSAGE-Zuschlag + Duell-Versatz (B), gedeckelt | gegnerbewusst ✔, aber risikolos ✘ |
| Sprünge | 1. → 2. ≈ 5 kg, 2. → 3. ≈ 2–5 kg (USAW), also ≈ 1,5–3 % | Median **5,0 %**, p90 **8,4 %** | zu groß, v. a. bei hoher ANSAGE |
| Nach Fehlversuch | gleiche Last wiederholen oder höher, **nie tiefer** | Last −6 % (`HEBEN_FEHL_REDUKTION`) | ✘ regelwidrig (B.3) |
| Reihenfolge | strikt nach angesagter Last, leichtere zuerst; Stange wird nie leichter | V1/V2 fest `[a,b]`, V3 nach Ansage, Nachziehen des Zweiten | V3 ✔, sonst ohne Folgen |
| Ansage ändern | zweimal je Versuch, nur nach oben | Zweiter im V3 zieht einmal nach | im Kern ✔ |
| Reaktion auf Rivalen | ab dem 2. Versuch, besonders im Stoßen auf den Reiß-Rückstand | V3 + Zweikampf-Stand (A), Stoß-Eröffnung über Lage (B) | ✔ |
| Gleichstand | wer den Zweikampf **zuerst** erreicht hat | weniger Versuche (`versucheBis`), dann Los | nah genug |
| Reißen : Stoßen | ≈ 80 : 100 (Median über 33.000 Heber; IQR 77–83 %) | 45,5 % Anteil am Tagesmax, dann ×0,94 ERHOLUNG → Median 1 : 1,146 | Stoßen zu schwach |

### A.2 Wer entscheidet was?

Für ein Managerspiel ist das die wichtigste Tabelle. Taktik heißt dort, dass **jemand** zwischen
Alternativen wählt, die unterschiedlich ausgehen können.

| Entscheidung | Wer trifft sie heute? | Ist es eine Abwägung? |
|---|---|---|
| Wer hebt überhaupt (6 aus dem Kader) | Manager | ja, Kaderauswahl |
| Welcher Heber in welchen Slot | Manager | **ja, echt**: bestimmt den Gegner im Duell (Ryder-Cup-Prinzip) |
| Intensität (Schonen/Normal/Push) | Manager | nein: flacher Attributzuschlag (−2,5/0/+4), trifft jeden Versuch gleich |
| Formkarte | Manager | nein: flacher Zuschlag |
| Eröffnungsgewicht | **Motor**, aus Slot-Plan + ANSAGE + Duelllage | nein: unterhalb `risikoMax` kostet es nichts |
| Sprunggröße | **Motor**, aus Slot-Plan × ANSAGE | nein: dasselbe |
| Nach Fehlversuch: wiederholen, senken, steigern? | **Motor**, immer −6 % | nein: feste Regel |
| Dritter Versuch: auf Sieg ziehen? | **Motor**, wenn in Reichweite (≤ 106 % Max) | halb: Reichweite ist eine Schwelle, keine Abwägung |
| Kühner Zuschlag (bis +5 kg) | **Motor**, deterministisch aus ANSAGE | nein |

Der einzige echte taktische Hebel des Managers ist also die **Paarung über den Slot**. Das ist
legitim und wurde bewusst geschützt (Plan 9.5). Alles, was im echten Sport der **Trainer am
Meldetisch** entscheidet, rechnet der Motor automatisch und ohne Alternativen aus.

### A.3 Gemessen (300 Saaten, Standardkader, `main` `254a56c5`)

| Größe | Wert | Einordnung |
|---|---:|---|
| Nullwertung je Heber | **1,0 %** | Plan simulierte 2,6 % aus den Realquoten, Korridor ≤ 3 % |
| Versuche mit Last über `risikoMax` (nur dort kostet die Last Chance) | **18,4 %** | in 81,6 % ist die Gewichtswahl chancenneutral |
| Folgeversuch nach Fehlversuch liegt *tiefer* | **66,7 %** (von 2.612) | real 0 %, regelwidrig |
| Sprung nach gültigem Versuch, p10 / Median / p90 | 0,6 / **5,0** / 8,4 % | real ≈ 1,5–3 % (elite) |
| Eröffnung in % des besten gültigen Versuchs, p10 / Median / p90 | 88,8 / 96,3 / **101,6** % | p90 > 100: Eröffnung verpatzt, dann *leichter* gehoben |
| Stoßen / Reißen, Median | **1,146** | real ≈ 1,25 |
| Gelingen, V3 Reißen: Last < 90 % vs. 95–100 % von `risikoMax` | **48,6 %** vs. **67,4 %** | leichtere dritte Versuche misslingen *öfter* |

Die letzte Zeile ist verzerrt und darf nicht als Kausalität gelesen werden. Heber mit wenig
ANSAGE setzen relativ niedrig an und haben oft auch wenig NERVEN und TECHNIK. Die Aussage, die
diese Zahl stützt, steht aber sauber im Code (B.1): Unterhalb `risikoMax` enthält die
Erfolgsformel **keinen Term für die Last**. Was die Chance bestimmt, sind die Attribute und
die Nummer des Versuchs, nicht die Frage, wie mutig angesagt wurde.

### A.4 Was ausdrücklich gut ist und bleiben soll

- **Der Zweikampf verbindet beide Hälften** (Maßnahme A vom 13.09.). Die Aufholjagd im Stoßen
  nach verlorenem Reißen ist der dramaturgische Kern des Sports (Hou Zhihui, Paris 2024), und
  sie funktioniert.
- **Wer mehr ansagt, hat das letzte Wort** (V3-Reihenfolge seit 06.09.). Das ist die richtige
  Übersetzung der IWF-Reihenfolge für ein Zwei-Personen-Duell. Die volle Reihenfolge über alle
  sechs Versuche wurde am 13.09. zu Recht verworfen, weil der Schwächere dann fertig wäre,
  bevor der Stärkere anfängt. Dem stimme ich zu.
- **Die duellbewusste Eröffnung** (Maßnahme B) ist genau die Trainerlogik, die im Sport zählt:
  Wer hinten liegt, eröffnet mutig (Pizzolato, 212 kg). Sie ist heute nur wirkungslos, weil
  Mut nichts kostet (B.1). Mit P1 wird dieselbe Logik zur echten Abwägung. Sie muss deshalb
  nicht weg, sie wird zur KI-Voreinstellung (P2).
- **Die Nullwertung ist hart** (Plan 9.4, richtig entschieden).
- **Die Paarung über den Slot** bleibt als Aufstellungstaktik stehen.
- **Kühner Versuch und Punktesieg bleiben außerhalb von `u.summe`.** Die Begründung vom 06.09.
  (einziger Hebel, der rho kippt) halte ich für richtig.

---

## (b) Was an echter Gewichtheben-Taktik fehlt

### B.1 Die Last kostet kein Risiko: der Kernbefund

Die Gelingenschance (`hebeUebung`, engine.js ≈ Z. 14816–14833):

```
p = HEBEN_BASIS[uebung][v] + (TECHNIK−50)·k + (NERVEN−50)·k (+ Zuschlag im V3)
    + (Wiederholung ? 0,19 : 0) − max(0, kg/risikoMax − 1) · 6,0
```

Der einzige Term mit `kg` ist der letzte, und der ist **null**, solange `kg ≤ risikoMax`.
`risikoMax` liegt ab ANSAGE 50 bei 100 % des Maximums oder höher und wächst mit ANSAGE weiter,
bei ANSAGE 80 auf 113,5 %. Die sechs Slot-Pläne führen bei neutraler ANSAGE auf Zielgewichte
zwischen 98,6 % (Power Opener) und 99,5 % (Grip Anchor) des Maximums, **alle unterhalb** von
`risikoMax`.

Daraus folgt dreierlei:

1. **Die Versuchsquoten sind eingegeben statt entstanden.** Im Sport misslingt der dritte
   Versuch öfter, *weil* er am Limit liegt. Hier misslingt er öfter, weil er der dritte ist. Ein
   dritter Versuch 1 kg über dem zweiten hat dieselbe Chance von 58,7 % wie einer 6 % darüber.
2. **Eine höhere Ansage ist innerhalb des Fensters ein Gratis-Buff.** Genau deshalb musste
   Maßnahme B am 13.09. mit „Zielgewicht-Invarianz" arbeiten und die Sprünge nachskalieren
   (Kommentar bei `HEBEN_DUELL_EROEFFNUNG_K`: „ein Gratis-Buff, der die Rangtreue verschöbe").
   Die Vorgänger haben das Symptom sauber umgangen. Das Konzeptproblem darunter ist geblieben.
3. **Der Wiederholungs-Zuschlag (+19 Pp) ist ein Pflaster für dieselbe Lücke.** Weil die Last
   die Chance nicht bestimmt, war ein wiederholter Versuch genauso schwer wie der verpatzte,
   und die Nullwertungen stiegen auf 4,4 %. Im Sport ist eine Wiederholung leichter, weil der
   Heber das Gewicht jetzt kennt und oft nur technisch gepatzt hat. Das lässt sich über die
   Last modellieren statt über einen Pauschalzuschlag.

### B.2 Gewichtswahl ist ein Attribut, keine Entscheidung

- **ANSAGE wirkt streng monoton.** Mehr ANSAGE bringt eine höhere Eröffnung, größere Sprünge,
  einen gedehnten `risikoMax` und ein höheres Tagesmax (`HEBEN_TAGESMAX_ANSAGE_K`). Einen Heber,
  der sich *verzockt*, weil er zu viel ansagt, gibt es nur oberhalb von `risikoMax`. Genau
  diesen Bereich dehnt dieselbe ANSAGE aber hinaus. Charisma bleibt damit, was die
  Matrixsperre verlangt (23 Gewichtspunkte, ausgangswirksam). Spielerisch ist es aber eine
  Stärkezahl und kein Temperament.
- **Beide Duellanten fahren denselben Plan.** `a.rolle=b.rolle=plan`: Der Power Opener
  eröffnet gegen einen Power Opener mit derselben Strategie. Die „Slot-Rolle als
  Versuchsstrategie" differenziert deshalb nur zwischen Duellen und nie innerhalb eines Duells.
- **Die Rollen versprechen etwas anderes, als sie tun.** „Safe Lift – sichert Punkte" eröffnet
  mit 0,94 am **höchsten** von allen sechs Plänen. Ein sicherer Plan eröffnet im Sport
  niedrig. „Grip Anchor – hält, wenn es eng wird" hat keinen eigenen Mechanismus für enge
  Lagen. „Pressure Lift – geht aggressiv in schwere Versuche" erreicht ein Ziel von 99,1 %,
  der Safe Lift eines von 98,8 %, und keines der beiden kostet Chance. Sichtbar ist der
  Unterschied zwischen den Rollen kaum, spielerisch gar nicht.

### B.3 Nach dem Fehlversuch runter: regelwidrig

Die IWF-Regel lautet, dass die angesagte Last nicht reduziert wird, sobald sie auf der Stange
liegt und die Uhr läuft. Die Stange wird im Verlauf einer Übung nie leichter. Nach einem
Fehlversuch bleiben also nur **Wiederholen** oder **Steigern**. Die Serien aus Paris 2024, die
der Plan selbst zitiert (155/155/162, 148/152/152), zeigen genau das.

Der Motor senkt nach einem Fehlversuch um 6 %. Gemessen trifft das zwei Drittel aller
Folgeversuche, und in den oberen 10 % der Fälle liegt die Eröffnung über dem besten gültigen
Versuch. Der Heber hat also *weniger* gehoben, als er vorher verpatzt hatte.

**Chris' Absicht war trotzdem richtig.** Sein Fall „Gram verpatzt 117 und versucht dann 127"
beschreibt einen Heber, der nach einem Fehlversuch sinnlos eskaliert. Das ist tatsächlich
falsch. Die reale Antwort darauf ist aber nicht „tiefer", sondern:
(a) **Wiederholen** ist der Normalfall.
(b) Wer merkt, dass die Tagesform nicht reicht, hätte **vorher** konservativer eröffnen müssen.
Genau diese Entscheidung fehlt heute (B.1/B.2). Die Absenkung repariert ein Symptom auf eine
Art, die jeder Kenner des Sports sofort als falsch erkennt. Vorschlag P3.

### B.4 Die Reihenfolge wirkt nur im dritten Versuch

In V1 und V2 hebt immer zuerst die Heimseite (`reihe=[a,b]`), und niemand reagiert. Im Sport
reagiert der Trainer schon ab dem zweiten Versuch. Wer sieht, dass der Rivale die Eröffnung
sauber gemacht hat, erhöht seinen zweiten Versuch. Die Uhr-Taktik (ein Heber hintereinander
bekommt 2 Minuten statt 1, und durch eine geschickte Erhöhung zwingt man den Rivalen mit nur
60 Sekunden zurück auf die Bühne) ist real, aber ein Detail für Kenner.

**Urteil:** Für ein Zwei-Personen-Duell ist „V3 mit letztem Wort" der richtige Kern. Eine
Reaktion schon im V2 wäre ein Gewinn, aber erst, wenn Lastwahl etwas kostet (P1). Vorher würde
sie nur die Kilogramm eines Gratis-Buffs verschieben. Die Uhr-Taktik empfehle ich nicht.

### B.5 Der Nullversuch: vorhanden, aber ohne Urheber

Die Nullwertung existiert und ist hart, das ist gut. Sie entsteht heute aber nur durch
dreimaliges Würfelpech. Durch die Absenkung nach dem Fehlversuch und den
Wiederholungs-Zuschlag liegt sie bei 1,0 % statt der 2,6 %, die der Plan aus den Realquoten
simuliert hat. Die Geschichte, die im Sport eine Nullwertung erzählt, lautet: „Der Trainer hat
zu hoch eröffnet, der Heber hat sich verzockt." Diese Geschichte kann hier nicht entstehen,
weil keine Eröffnung zu hoch sein kann. **Ein Nullversuch sollte die Rechnung für eine
riskante Entscheidung sein und kein bloßes Zufallsereignis.**

### B.6 Reißen und Stoßen: dieselbe Formel zweimal

Beide Übungen laufen durch dieselbe `hebeUebung`-Funktion mit denselben Sub-Skills. Die
Unterschiede sind die Basisquoten, ein Maximum von 45,5 zu 54,5 und der ERHOLUNG-Faktor im
Stoßen. Im Sport sind die Übungen verschiedene Disziplinen:

- **Reißen** ist die technische, schnelle Übung. Der Weg der Hantel ist lang, die Anforderung
  an Beweglichkeit und Timing hoch. Fehlversuche sind meist technisch.
- **Stoßen** ist die Kraftübung (Umsetzen), gefolgt von einem Stabilitäts- und Nervenmoment
  (Ausstoßen, wo viele dritte Versuche scheitern). Der Ermüdungsanteil ist höher.

Heute kann ein Techniker (hohe Dexterity/Speed, mittlere Power) nicht „das Reißen gewinnen und
im Stoßen verteidigen". Ein Kraftpaket kann umgekehrt nicht „im Reißen zurückliegen und im
Stoßen aufholen", zumindest nicht aus einem *anderen Grund* als Würfelglück. Dieses
Mehrwege-Muster hat Chris am 21.09. für alle Disziplinen ausdrücklich eingefordert, und im
Gewichtheben liefert es der Sport von selbst.

### B.7 Druck hängt an der Versuchsnummer, nicht an der Lage

NERVEN wirkt auf jeden Versuch und zusätzlich auf jeden dritten. Echter Druck entsteht aber
situativ:

- **Pflichtversuch:** Zwei Fehlversuche in einer Übung, der dritte entscheidet über die
  Nullwertung.
- **Entscheidungsversuch:** Die letzte Hantel eines engen Duells.
- **Rekordjagd:** kommt im Spiel nicht vor.

Ein dritter Versuch, der bei 60 kg Vorsprung nur noch Kosmetik ist, trägt heute denselben
Nervenzuschlag wie der Pflichtversuch nach zwei Fehlern.

### B.8 Der Manager hat keinen Coaching-Hebel

Die Intensitätsstufe (Schonen/Normal/Push) ist der einzige Schieberegler, und sie ist im
Motor ein flacher Zuschlag (`stufenWert()`: −2,5/0/+4 auf die betroffenen Attribute). Im
Gewichtheben gäbe es für genau diesen Regler eine natürliche, sportlich echte Bedeutung: den
**Versuchsplan**.

---

## (c) Priorisierte Gameplay-Vorschläge (nur Konzept)

Jeder Vorschlag muss vor dem Einbau dieselben Abnahmen bestehen wie jede Mechanik:
rho ≥ 0,80 in einem Spiel (kaderfest), Pp-Abweichung ≤ 25 in zwei Saatstämmen und den
IWF-Korridor aus Plan 6.1. Die Matrix bleibt unangetastet, es verschieben sich nur Rezept und
Mechanik. Alle Zahlen unten sind **Vorschläge** zur Kalibrierung, nicht gemessen.

### P1 — Gelingen an die relative Last koppeln, dazu eine verdeckte Tagesform (Fundament)

**Idee:** Die Gelingenschance ergibt sich aus dem Verhältnis `kg / heutige Kapazität`, nicht
aus der Versuchsnummer. Die IWF-Quoten je Versuch sollen **entstehen**, weil dritte Versuche
typischerweise am Limit liegen, und nicht eingegeben werden.

- **Kapazität heute** = bisheriges Maximum × (1 + ε). ε ist eine verdeckte Tagesform, klein
  und ziehungsfest, als Vorschlag σ ≈ 1,5–2,5 %. Der Trainer kennt nur das Maximum, nicht ε.
- **Chance** als Funktion der relativen Last r, als Vorschlagskurve: r ≤ 0,90 → ≈ 95 %,
  0,95 → ≈ 88 %, 1,00 → ≈ 60 %, 1,03 → ≈ 35 %, 1,06 → ≈ 12 %. TECHNIK und NERVEN verschieben
  die Kurve seitlich, wie heute additiv.
- **Die Eröffnung wird zur Information.** Gelingt sie deutlich (Wurf weit unter der Schwelle),
  ist das ein Hinweis auf einen guten Tag, und der Plan steigert stärker. Gelingt sie knapp
  oder misslingt sie, bleibt der Plan vorsichtig. Das ist Trainerpraxis. Es lässt sich ohne
  neuen Würfel aus dem Abstand zwischen `rr()` und `p` ablesen.
- **Die Wiederholung wird leichter, ohne Pauschale.** Nach einem Fehlversuch zieht der
  Heber ein Stück der ε-Unsicherheit ein (er „kennt das Gewicht jetzt"). Das ersetzt
  `HEBEN_WIEDERHOLUNG`.

**Warum zuerst:** Ohne P1 bleibt jede Taktik (P2, P3, Reaktion im V2) ein Gratis-Buff oder ohne
Wirkung. Mit P1 entsteht die Kern-Abwägung des Sports: „Eröffne ich sicher und verschenke
vielleicht Kilo, oder hoch und riskiere die Null?"

**Risiko für die Abnahme:** ε ist Rauschen, das nicht an der Eignung hängt, und senkt die
Verlässlichkeit. Es **ersetzt** aber einen Teil des heutigen Versuchswürfels, der ebenso
eignungsfremd ist. Netto ist das offen und muss gemessen werden. Stellschraube ist σ. Die
Validität sollte eher steigen, weil ein stärkerer Heber dieselbe Last mit einem kleineren r
hebt und die Last damit endlich etwas bedeutet. Zu prüfen ist außerdem Charisma: Sein Anteil
läuft heute über `risikoMax` und `tagesmax`, und dieser Pfad muss in P1 erhalten bleiben, sonst
kippt die Pp-Abweichung. Die natürliche Übersetzung lautet: ANSAGE verschiebt die Kurve nach
rechts, der Heber hält Grenzlasten besser.

### P2 — Der Versuchsplan wird Trainer-Entscheidung (über die Intensitätsstufe)

**Idee:** Die vorhandene Stufe Schonen/Normal/Push bekommt im Gewichtheben ihre sportliche
Bedeutung, **anstelle** des flachen Zuschlags oder zusätzlich zu ihm:

| Stufe | Eröffnung (Vorschlag) | Sprünge | Wirkung mit P1 |
|---|---|---|---|
| **Sicher** (Schonen) | ≈ 88 % des Maximums | klein | fast nie Null, verschenkt oft 2–4 % |
| **Standard** (Normal) | ≈ 92 % | normal | IWF-typisch |
| **Angriff** (Push) | ≈ 95–96 % | groß | höhere Decke, Null-Risiko spürbar |

- **Keine dominante Option:** Die drei Pläne sollen bei neutralem Duell ungefähr denselben
  erwarteten Zweikampf liefern und sich in der **Streuung** unterscheiden. Dann ist
  „Angriff" richtig, wenn man hinten liegt (man braucht Varianz), und „Sicher", wenn man vorn
  liegt. Das ist die echte Trainerlogik, und sie hängt an der Paarung. Damit verzahnt sich P2
  mit dem einzigen heutigen Manager-Hebel.
- **Die KI-Voreinstellung ist die heutige Maßnahme B.** Die Duelllage bestimmt die Stufe. Nichts
  vom 13.09. geht verloren, es wird nur sichtbar und überschreibbar.
- **Granularität:** zuerst je Disziplin (so gibt es den Regler heute schon), später
  optional je Heber. Je Heber wäre näher am Sport und verdient einen eigenen PR.
- **Folge für die Rollen:** Der Slot bestimmt weiterhin den Gegner. Die Strategie kommt
  aus der Stufe und ist damit nicht mehr für beide Duellanten identisch (B.2).

**Abnahme:** rho wird mit KI-Voreinstellung gemessen. Die Manager-Wahl darf Kilo verschieben,
denn das ist der Sinn einer Entscheidung. Nachzuweisen ist, dass keine Stufe über viele Spiele
dominiert (Spiegeltest je Stufe gegen Stufe).

### P3 — Reaktion auf den Fehlversuch regelkonform (Chris entscheidet)

**Vorschlag:** `HEBEN_FEHL_REDUKTION` fällt weg. Nach einem Fehlversuch gibt es:

- **Wiederholen** (Normalfall), mit der erleichterten Wiederholung aus P1.
- **Steigern**, nur wenn die Duelllage es verlangt (heutige V3-Reaktion) oder der Fehlversuch
  laut P1-Signal „knapp technisch" war.
- **Nie tiefer.**

Chris' Fall mit Gram löst sich dadurch auf zwei Wegen: P1 macht den Fehlversuch bei 117 zu
einem Signal („heute kein guter Tag"), also wird wiederholt und nicht auf 127 gesprungen. P2
lässt einen Trainer, der das vorher ahnt, auf „Sicher" stellen.

**Folge:** Die Nullwertung steigt von 1,0 % Richtung der realistischen ~2,5 %. Der Korridor
(≤ 3 %) erlaubt das ausdrücklich. **Das ist eine Produktentscheidung.** Chris hat die Senkung
selbst gewollt. Beibehalten lässt sie sich als bewusste Hausregel, dann sollte das Dokument sie
aber auch so nennen und nicht als IWF-Realismus ausgeben. Der Kopfkommentar im Motor
(„Nach einem Fehlversuch wird dieselbe Last wiederholt", ≈ Z. 14389) widerspricht dem Code
heute schon.

### P4 — Reißen ≠ Stoßen: zwei Wege zum Zweikampf (mehrere Wege)

**Idee:** Die Sub-Skills wirken je Übung unterschiedlich stark. Das bleibt Pp-neutral, weil
nur zwischen den Übungen umverteilt wird und die Summe gleich bleibt.

| | Reißen (Technik-Weg) | Stoßen (Kraft-Weg) |
|---|---|---|
| Maximum | stärker aus TECHNIK (Dexterity/Speed) als heute | stärker aus LAST (Power/Health) + ERHOLUNG |
| Gelingen | TECHNIK verschiebt die Kurve stärker | NERVEN wirkt stärker (Ausstoßen als Nervenmoment) |
| Typischer Fehlversuch | technisch (Kurve steil) | Ermüdung/Nerven (Kurve flacher, später Abbruch) |

- Ein Techniker hat dann die Chance, im Reißen vorzulegen und im Stoßen zu verteidigen. Ein
  Kraftpaket holt im Stoßen auf. Die Aufholjagd aus Maßnahme A bekommt eine **mechanische
  Ursache**, nicht nur eine zufällige.
- Nebenbei korrigieren: Das Stoßen/Reißen-Verhältnis sollte bei ≈ 1,2–1,25 statt 1,146
  liegen. Heute drückt der ERHOLUNG-Faktor 0,94 das Stoßen bei *jedem* Heber unter den
  Realwert, nicht nur bei schlecht erholten. Vorschlag: Nullpunkt so, dass ERHOLUNG 50 das
  reale Verhältnis trifft.
- Primär-/Nebenweg im Sinne von Chris' Leitlinie: Primärweg zum Zweikampf ist Kraft (LAST),
  Nebenweg Technik. Beide führen zum Ziel, der Nebenweg aber mit niedrigerer Decke.

**Abnahme:** Pp ist die heikle Größe. Dexterity/Speed (Matrix je 6) lasen in einer früheren
Fassung schon einmal zu stark (15,7 % statt 6, `BUEHNE_ART.gewichtheben`-Kommentar). Eine
Umverteilung darf diesen Fehler nicht wiederholen. Sie muss also übungsweise geschehen und
nicht als Gesamtaufwertung.

### P5 — Druckversuche statt Versuchsnummer

**Idee:** Der Nervenzuschlag des dritten Versuchs wird ersetzt durch einen Zuschlag, der an der
**Lage** hängt:

- **Pflichtversuch** (zwei Fehlversuche in dieser Übung): voller Druck.
- **Entscheidungsversuch** (Ausgang des Duells hängt an diesem Versuch): voller Druck.
- **Kosmetischer Versuch** (Duell entschieden): kein Druck.

Das gibt dem Grip Anchor („hält, wenn es eng wird", Will/Determination) und dem Final Attempt
(„lebt vom großen Moment") endlich einen Mechanismus, der zu ihrem Text passt. Diese
Attribute wirken dann über die Nerven-Rolle des Rezepts in den Momenten, die zählen.

**Abnahme:** Die Summe der NERVEN-Wirkung über ein Spiel sollte etwa gleich bleiben (Pp), sie
wird nur anders verteilt. Das Risiko für rho ist klein, weil keine neue Zufallsquelle
entsteht.

### P6 — Slot-Rollen: echt unterscheiden oder ehrlich umbenennen

Mit P2 verlieren die sechs Versuchspläne je Slot ihre Aufgabe. Zwei Wege:

- **(a)** Die Rollen bleiben reine Aufstellungsetiketten (wer gegen wen) und tragen nur den
  Slot-Aufschlag. Die Pläne-Tabelle `HEBEN_ROLLEN` fällt weg.
- **(b)** Die Rollen werden zu **Voreinstellungen** für P2 je Heber: Safe Lift eröffnet
  *niedrig*, Pressure Lift hoch. So stimmt der Text, und der Manager kann überschreiben.

Mindestens der Widerspruch „Safe Lift eröffnet am höchsten" sollte weg. (b) ist die
schönere Lösung, setzt aber P2 je Heber voraus.

### P7 — Die Ansage sichtbar machen (Darstellung, klein)

Die Taktik des Gewichthebens findet im Fernsehen auf der **Anzeigetafel** statt: „Nächster
Versuch: 257 kg. Geändert auf 258." Heute enthüllt `stepBuehne` nur den laufenden Versuch
(Spannungs-Recherche 13.09., Abschnitt 6). Sobald P1/P2 existieren, lohnt eine kleine Tafel
mit angesagter Last, Änderung („zieht nach: +1 kg") und Stufe des Trainers. Ohne P1 wäre das
nur Dekoration.

### Nicht empfohlen (mit Begründung)

- **Volle IWF-Reihenfolge über alle Versuche.** Das wurde am 13.09. verworfen, und ich stimme
  zu: Im Zwei-Personen-Duell zerstört sie das Wechselspiel.
- **Die Uhr-Taktik (1 vs. 2 Minuten).** Sie ist real, aber nur für Kenner sichtbar und im
  Zwei-Personen-Duell ohne dritte Partei kaum wirksam.
- **Paarung nach Stärke.** Das bleibt eine Produktentscheidung (Plan 9.5). Mit P2 wird die
  Slot-Paarung wertvoller, nicht schwächer, weil „Angriff gegen den Favoriten" dann ein Zug
  ist.
- **Belohnung für kühne Versuche in `u.summe`.** Die Begründung vom 06.09. gilt weiter.

---

## Reihenfolge und Abhängigkeiten

| Schritt | Inhalt | hängt ab von | Abnahme |
|---|---|---|---|
| 1 | **P1** Lastkurve + Tagesform, `HEBEN_BASIS`/`HEBEN_WIEDERHOLUNG` ablösen | — | Korridor (Quoten müssen *entstehen*), rho kaderfest, Pp zwei Stämme |
| 2 | **P3** regelkonforme Fehlversuch-Reaktion | P1 (sonst steigt die Null zu stark) | Nullwertung ≤ 3 %, Chris' Freigabe |
| 3 | **P2** Versuchsplan über die Intensität, KI = Maßnahme B | P1 | Spiegeltest je Stufe (keine dominiert), rho mit KI-Voreinstellung |
| 4 | **P5** Druckversuche | P1 | Pp-neutral |
| 5 | **P4** Reißen/Stoßen trennen, Verhältnis 1,2–1,25 | P1 | Pp (Dexterity/Speed nicht überziehen!) |
| 6 | P6, P7 | P2 | Sicht-QA |

P1 ist der einzige Schritt mit echtem rho-Risiko. Alle weiteren bauen auf ihm auf und sind
einzeln kleiner. Scheitert P1 an der Rangtreue, lohnen P2 und P3 nicht in voller Form. Der
Rückfall wäre dann P3 allein (regelkonform, mit etwas mehr Nullwertungen) plus P5.

## Was Chris entscheiden muss

1. **Senkung nach Fehlversuch** (P3): IWF-Regel (nie tiefer) oder bewusste Hausregel?
2. **Soll der Manager den Versuchsplan wählen** (P2)? Wenn ja: je Disziplin über den
   vorhandenen Regler oder je Heber?
3. **Tagesform** (P1): Darf ein Heber an einem Tag ohne erkennbaren Grund 2 % schwächer sein?
   Das ist der Sport, bringt aber eine eignungsfremde Streuung.

---

## Wie gemessen wurde

Ein Wegwerf-Skript (nicht eingecheckt, kein Code-Auftrag) öffnet
`public/mockups/battle-mode.html` im Worktree per Playwright (Chromium 1194) und ruft für
`saat = 5000 + i·7919`, i = 0…299, `window.__arena.spiele("gewichtheben", saat).protokoll` auf.
Aus `LAST/ANSAGE/ERHOLUNG` jedes Protokolleintrags werden `tagesmax`, `maxReissen/maxStossen`
und `risikoMax` mit denselben Konstanten wie in `baueHebenDuelle`/`hebeUebung` nachgerechnet.
Danach wird je Versuch ausgewertet: `kg/risikoMax`, Sprung nach gültigem Versuch, Last nach
einem Fehlversuch, bester gültiger Versuch je Übung und Gelingen je Versuchsnummer und
Lastband. Das Muster entspricht `scripts/diag-gewichtheben-nach-fehlversuch.mjs`. Der Kader ist
der Standardkader des Mockups (12 Heber). Die Zahlen beschreiben die Mechanik, nicht eine
Kaderfamilie.

## Quellen

- IWF, *Technical and Competition Rules & Regulations* (2020/2025): angesagte Last nach
  Uhrstart nicht reduzierbar, zwei Änderungen je Versuch, 1 kg Mindeststeigerung.
  https://iwf.sport/wp-content/uploads/downloads/2020/01/IWF_TCRR_2020.pdf
- British Weight Lifting, *Competitions Explained*; USA Weightlifting, *Counting Attempts*
  (Sprünge, Eröffnung, 60/120-s-Uhr, Änderungen nur nach oben).
  https://britishweightlifting.org/competitions/competitions-explained ·
  https://www.usaweightlifting.org/weightlifting101/counting-attempts
- SportsEdTV, *Weightlifting Rules: The Order of Lifting* (Reihenfolge, Uhr-Taktik).
  https://sportsedtv.com/blog/weightlifting-rules-the-order-of-lifting-or-who-s-up-next-weightlifting
- Reißen/Stoßen-Verhältnis ≈ 80 %, IQR 77–83 % (> 33.000 Heber): OlyFanatics,
  *Weightlifting's Golden Ratio*; Universidad de León, Analyse internationaler Eliteheber.
  https://olyfanatics.com/weightlifting-golden-ratio-of-the-snatch-to-clean-and-jerk/
- Gelingensquoten je Versuch: Scientific Reports 2024 (PMC11564635), wie in
  `gewichtheben-plan.md` 2.2 zitiert.

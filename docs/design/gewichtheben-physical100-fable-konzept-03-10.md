# Gewichtheben, Physical-100-artig: „Die Ladestrecke" — Fable-Konzept an Chris (03.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Chris am 03.10., wörtlich: „mir kam jetzt gerade die
Idee, vielleicht kannst du da mal mit Fable oder Opus ein Konzept erarbeiten, mit Physical 100, weil
die machen ja auch so Gewichthebenaufgaben, das sind meistens sowas wie Tragegewichte von A nach B
oder Überhindernisse und was weiß ich was. Vielleicht können wir sowas nutzen, um die Disziplin so
ein bisschen aktiver zu machen, anstatt dass einfach nur zwei Spieler gegeneinander da, die sich
gegenüberstehen und irgendwelche Zahlen hochfliegen, weil das ist ja auch ziemlich langweilig."

Physical 100 ist hier Inspirationsquelle (Tragen über Distanz, Stufen, Lasten in Position bringen),
nicht Vorlage zum Nachbau. Nichts in diesem Papier ist gebaut oder gemessen am Motor; die einzige
Messung ist eine Offline-Diagnose auf dem echten live-save-Kader (Abschnitt 3.4), außerhalb des
Repos, ohne Simulation.

## 0. Ergebnis vorab

1. **Empfehlung: „Die Ladestrecke" — je Duell einmal, zwischen Reißen und Stoßen.** Beide Heber
   tragen gleichzeitig ihr eigenes Stoßen-Eröffnungsgewicht als Scheibenstapel vom Scheibenständer
   am Bühnenrand über die Plattformstufe auf ihre Plattform. Wer frisch aus dem Reißen kommt, ist
   schneller; wer schwer lädt oder angeschlagen ist, schleppt — und kann an der Stufe stolpern.
2. **Es ist das Bild einer Mechanik, die es schon gibt und die niemand sieht.** `ERHOLUNG`
   (stamina 40 / health 35 / will 25) skaliert heute das Stoßen-Maximum mit
   `0,94 + (ERHOLUNG−50)·0,0012` — im echten Kader 0,900 bis 0,999, also bis zu zehn Prozent des
   Stoßen-Maximums, bei einem 200-kg-Stoßer rund 20 kg. Im Spiel ist davon nichts zu sehen. Die
   Ladestrecke zeigt genau diese „Frische" (und die Höhe der Eröffnung) als Bewegung über die Bühne.
3. **Stufe 1 ist bit-identisch für rho und Pp, per Bauart:** keine neue `rr()`-Ziehung, kein
   Schreiben in `u.summe`/`u.zweikampf`, keine Änderung an `rundenDauer`, `ZEIT_DEHNUNG`,
   `buehneQueue` oder der Gesamtsendezeit (7:11). Die Ladestrecke läuft **innerhalb** des ohnehin
   vorhandenen 6,2-s-Fensters des ersten Stoßversuchs eines Duells, nicht zusätzlich. Das ist
   **Klasse A\*** (Anzeige mit neuer Anzeige-Buchhaltung) — mit der ausdrücklichen Bitte, dass
   Chris diese Einstufung bestätigt, nicht ein Agent (Abschnitt 6, Lehre aus PR #1111/#1117).
4. **Attribute: keine neuen, kein Override.** Die Ladestrecke liest nur die bestehenden Sub-Skills
   `LAST` (Tragekapazität), `ERHOLUNG` (Frische) und — über das Eröffnungsgewicht — `ANSAGE`.
   Die gesperrte Matrix bleibt unangetastet; ein Override nach Football-Muster wird **nicht**
   empfohlen (Abschnitt 4), weil Gewichtheben das Gegenteil des Football-Falls ist (Pp 9,6,
   rho 0,865) und ein Override die Kaderbildschirm-Zahl und den KI-Einkauf verschöbe.
5. **„Mehrere Wege" — ehrlich eingegrenzt.** Der frischere, nach Kraft schwächere Heber gewinnt die
   Ladestrecke in rund 20 % der Duelle (Diagnose 3.4) und bekommt dafür einen sichtbaren Moment
   (Ticker, Badge, Boxscore-Zeile) — **nicht** Kilogramm. Ein Nebenweg, der über die Ladestrecke
   **Duelle** gewinnt, ist bei Matrix-Dosis rechnerisch tot: in 0 von 30 echten Paarungen kippt ein
   15- oder 25-%-ERHOLUNG-Anteil eine von LAST entschiedene Last (3.4). Wer das will, braucht die
   Matrix — und die ist gesperrt.
6. **Stufe 2 (optional, Chris' Wahl, Klasse B/W):** zwei kleine Bisse, die rho/Pp nachweislich nicht
   anfassen können (Los-Ersatz im dritten Versuch, Eröffnungs-Versatz für den Verlierer), plus
   die Anbindung an den Haltungs-Pilot vom 02.10. Ausdrücklich **nicht** empfohlen: ein weiterer
   Malus auf das Stoßen-Maximum — das zählte ERHOLUNG doppelt und drückte stamina/health/will über
   ihr Matrixgewicht.

Abschnitt 9 ist die ausfüllbare Entscheidungsvorlage.

---

## 1. Was heute im Code steht (nachgelesen, Stand `origin/main` nach PR #1133)

Alles in `public/mockups/battle-mode.engine.js`.

**Ablauf.** `baueHebenDuelle()` (`:16319`) paart sechs Duelle über den Slot, `hebeUebung()` (`:16411`)
rechnet je Duell Reißen und Stoßen à drei Versuche vorab, `buehneQueue` (`:16386`) enthüllt die 72
Versuche nacheinander — innerhalb einer Übung hebt die leichtere Ansage zuerst. Je Versuch
`rundenDauer` 1,55 Simulationssekunden (`BUEHNE_ART.gewichtheben`, `:14425`) mal `ZEIT_DEHNUNG`
4 (`:40075`) = 6,2 Zuschausekunden, darin die Phasen `antritt` 0,62 s, `zug` 1,18 s, `hoch` 2,73 s,
`ablage` 1,36 s (`HEBEN_ANTRITT_T` … `:19453`, `stepHeben()` `:19454`), Rest „boden". Gesamt gemessen
7:11 (Audit Runde 2, 30.09.): **Bild steht 95 % der Zeit, bis 30 s am Stück.** Zwischen Reißen und
Stoßen eines Duells gibt es keine Pause und kein Bild — im echten Wettkampf liegen dort zehn
Minuten.

**Die unsichtbare Mechanik.** `u.maxStossen = u.tagesmax·(1−0,455)·(0,94+(u.ERHOLUNG−50)·HEBEN_ERHOLUNG_K)`
(`:16346`, `HEBEN_ERHOLUNG_K` 0,0012). Dazu G4 (01.10.): der Wiederholungsbonus nach einem Fehlversuch
atmet mit ERHOLUNG (`:16599`). Beides ist Mechanik ohne Bild: kein Ticker, keine Tafel, keine
Figur zeigt, dass ein Heber „schlecht erholt" ins Stoßen geht.

**Abnahmezahlen** (`gewichtheben-kalibrierung-ansage-kanal-01-10.md`): rho je Spiel **0,865**
(Median Kaderfamilie), Spannweite 0,143, Saison 0,944; Pp **9,6** im Mittel über fünf Saatströme
bei n=48 (8,5 / 10,0 / 11,4 / 10,1 / 7,9), jedes Attribut innerhalb von rund 2 Pp seines Gewichts.
Korridor: Reißen 85,8/79,9/61,8 %, Stoßen 87,7/76,0/61,5 %, Nullwertungen 1,8 %. Gewichtheben ist
damit die am saubersten kalibrierte Disziplin des Projekts — jede Idee hier muss das halten.

**Matrix (gesperrt):** power 28, charisma 23, health 16, determination 12, will 7, speed 6,
dexterity 6, stamina 2; awareness/intelligence/spirit/torment 0. **Rezept:** LAST {power 60, health 25,
determination 15}, TECHNIK {dexterity 45, speed 70, determination 20, power 5}, NERVEN {charisma 35,
will 35, determination 20, health 10}, ANSAGE {charisma 53, power 8, will 13, dexterity 9, health 10,
speed 7}, ERHOLUNG {stamina 40, health 35, will 25}.

**Was schon vorgedacht ist, und was nicht.** Die Fable-Runde vom 30.09. (`fable-ideen-heben-breaking-
climbing-30-09.md`, G1–G5) hat Mannschaftstafel, Kampfrichterlampen, sichtbare Ansage-Änderung, den
ERHOLUNG-Wiederholungsbonus und die Reißen/Stoßen-Spreizung behandelt — G1, G2, G3, G4 sind gebaut.
Keine der fünf Ideen bringt Bewegung über die Bühne; das Chassis „zwei Figuren auf zwei Plattformen"
blieb unangetastet. Das Opus-Papier vom 02.10. (`manager-risiko-interaktivitaet-konzept-02-10.md`)
nennt Gewichtheben „die toteste Sendung" und schlägt den **Haltungs-Pilot** (Absichern/Normal/
Angreifen) vor — ein Entscheidungsknopf für den Manager, noch nicht entschieden. Chris' heutige Idee
ist etwas anderes: nicht ein Knopf, sondern ein **sichtbarer Vorgang**. Beides verträgt sich, s. 8.3.

**Spoiler-Regel, die jede neue Anzeige einhalten muss** (H1/H2.2, PR #1091 und Folgefund Task #35):
nichts im Bild darf das Urteil eines noch laufenden Versuchs verraten. Die Ladestrecke liest deshalb
nur Attribute, die Ansage (die ohnehin „Nächster: …, X kg" angezeigt wird, `:21748`) und bereits
gezeigte Reiß-Urteile — nie den Ausgang eines kommenden Versuchs.

---

## 2. Die Wahl: eine Ladestrecke je Duell, zwischen Reißen und Stoßen

### 2.1 Was ergänzt wird

Nach dem dritten Reißversuch beider Heber eines Duells, bevor der erste Stoßversuch enthüllt wird:

1. Beide Heber gehen vom Plattformrand zum **Scheibenständer** ihrer Seite (Bühnenrand links/rechts).
2. Jeder nimmt seinen **Scheibenstapel** — so viele Scheiben, wie seine Stoßen-Eröffnung wiegt
   (eine sichtbare Größe: wer 212 kg ansagt, trägt einen höheren Stapel als wer 150 ansagt).
3. Beide tragen gleichzeitig zurück zur Plattform, über die **Plattformstufe** (das Hindernis).
   Tempo aus Frische und Last (3.1). An der Stufe kann ein Heber **stolpern** (3.2): er fängt den
   Stapel, verliert Zeit, kommt angeschlagen an.
4. Wer zuerst oben ist, hat die Ladestrecke gewonnen: Ticker, kurzes Badge, Boxscore-Zeile. Dann
   wird die Hantel geladen, und der erste Stoßversuch läuft wie heute.

Sechs Ladestrecken je Spiel, je rund 2,8 Zuschausekunden mit beiden Figuren in Bewegung — plus
sechsmal der Moment „kommt er über die Stufe?".

### 2.2 Warum genau dort — und nicht anderswo

| Variante | Warum nicht (oder: warum nur als Erweiterung) |
|---|---|
| **Vor jedem Versuch** (72×) | Verdoppelt die Ereignisdichte, ohne etwas Neues zu erzählen; CLAUDE.md: mehr Ereignisse helfen fast nie. Und vor dem dritten Versuch gäbe es keine ehrliche Last-Geschichte — die Hantel steht schon. |
| **Als eigene vierte Phase vor den Versuchen** (Startreihenfolge, Ermüdung, Bonus) | Vor dem Reißen ist niemand müde; eine Ermüdung, die die Ladestrecke erst *erzeugt*, wäre eine neue Mechanik in `summe` (rho-Hebel, 06.09.-Messung) und ein neuer ERHOLUNG-Kanal (Pp-Hebel). Eine Startreihenfolge gibt es im ersten und zweiten Versuch mechanisch nicht (niemand reagiert). Bleibt ein Bonus — und „Zusatzbelohnung außerhalb der gewerteten Summe" ist Regel 4 des 02.10.-Papiers. Nichts davon trägt eine eigene Phase. |
| **Hindernisparcours statt Tragen** (Beweglichkeit) | Liest dexterity/speed. Die Matrix gibt beiden je 6; speed las bis zum 01.10. +5 bis +6 Pp über Matrix und ist gerade erst auf −0,5 gebracht. Ein Parcours, der etwas bewirkt, holt genau diesen Befund zurück. Das Hindernis bleibt deshalb **eine** Stufe, entschieden von Last und Frische, nicht von Wendigkeit. |
| **Festes Bühnengewicht für beide** (Sandsack 120 kg, wer ist schneller) | Dann entscheidet LAST allein, und zwar immer: in den 30 Slot-Paarungen des echten Kaders liegen die Heber im Median 16 LAST-Punkte auseinander, ein 15–25-%-Frische-Anteil kippt **kein einziges** Rennen (3.4). Das wäre ein Rennen, dessen Sieger man an der Ansage schon abliest — tot vor dem ersten Schritt. |
| **Zwischen Reißen und Stoßen** (gewählt) | Die einzige Stelle, an der die Erzählung „wer kommt frisch, wer schleppt" **wahr** ist — die Mechanik dazu (`maxStossen`) existiert seit dem 03.09., unsichtbar. Die Last ist die eigene Ansage, also die Entscheidung des Hebers, nicht ein fremdes Bühnengewicht. Und das Bild steht genau dort heute am längsten still. |

**Erweiterung, nicht Empfehlung:** dasselbe Bild vor dem Reißen als „Laderennen" (die Eröffnung
laden). Dort gibt es keine Frische-Geschichte (ERHOLUNG wirkt nur aufs Stoßen), das Rennen zeigte nur,
wer ambitionierter eröffnet. Erst, wenn Chris nach Stufe 1 mehr Bewegung will (9, Frage 4).

---

## 3. Mechanik der Ladestrecke (Stufe 1 — Anzeige, kein Würfel, kein Kilogramm)

Alles unten ist **Anzeige-Ableitung aus vorhandenen Feldern**. Kein `rr()`, kein Schreiben in
`u.summe`, `u.zweikampf`, `u.runden[]`, `u.maxStossen`, `ansage[]` oder `buehneQueue`.

### 3.1 Tempo

Jeder Heber `u` hat beim Eintritt in die Ladestrecke:

```
frische  = 0,94 + (u.ERHOLUNG − 50) · HEBEN_ERHOLUNG_K      // exakt der maxStossen-Faktor, 0,90..1,00 im Kader
anteil   = u.runden[3].kg / u.maxStossen                     // Eröffnungsanteil des Stoßens, 0,85..0,97
tragZeit = T0 · (1 + kF·(1 − frische)) · (1 + kA·(anteil − 0,90))
```

Startwerte `kF = 4`, `kA = 1,5`, `T0 = 2,0` Zuschausekunden. Damit spannt die Frische das Tempo um
den Faktor 1,0–1,4, die Ansage um 0,93–1,11 — die Frische entscheidet zwei von drei Läufen, die
Ambition einen (3.4). `u.runden[3]` ist der erste Stoßversuch, zum Zeitpunkt der Ladestrecke bereits
berechnet und als „Nächster: …" ohnehin im Bild; `u.maxStossen` und `u.ERHOLUNG` stehen seit
`baueHebenDuelle()` auf dem Teilnehmer.

Die Figur, die früher ankommt, hat gewonnen. Gleichstand (Differenz < 0,05 s): kein Sieger, Ticker
„gleichzeitig oben".

### 3.2 Die Stufe — der Stolperer

Deterministisch, ohne Wurf, aus bereits **gezeigtem** Zustand:

```
stolpert = frische < 0,93  &&  u.runden[2].gueltig === false   // dritter Reißversuch ungültig
```

Also: wer schlecht erholt ist **und** gerade sein letztes Reißen verloren hat, kommt angeschlagen
über die Stufe — fängt den Stapel, +0,8 s, Ticker „stolpert an der Stufe — angeschlagen aus dem
Reißen". Beides ist zu diesem Zeitpunkt bekannt (das Reiß-Urteil ist gelampt, die Frische ist ein
Attribut). Im echten Kader liegt die Frische bei 9 von 60 Hebern unter 0,93 (3.4); zusammen mit
der Reißen-3-Fehlquote von 38 % ergibt das grob **0,5 bis 1 Stolperer je Spiel** — selten genug,
um aufzufallen, häufig genug, um vorzukommen.

Warum kein `rr()`-Wurf: ein zusätzlicher Wurf im Messpfad (`stepHeben` läuft über
`buehnenBewegung()` auch in `disziplinProbe`, Kommentar `:19511`) verschiebt die Zufallsfolge und
nimmt Stufe 1 die Bit-Identität. Ein gewürfelter Stolperer mit festem Verbrauch (Handbuch-Falle 17)
ist Stufe-2-Material (5.2).

### 3.3 Sieg ohne Kilogramm

Der Ladestrecken-Sieger bekommt, in dieser Reihenfolge der Wichtigkeit:

1. **Ticker** am Ankunftsmoment: „Cassandra zuerst oben — Gram schleppt 212 kg", bzw. bei Stolperer
   die Zeile aus 3.2. Eine Zeile je Ladestrecke, nie „big" (Banner-Dosis, Audit Punkt 7).
2. **Badge** auf der Versuchstafel für die Dauer des ersten Stoßversuchs: „Ladestrecke · Cassandra".
3. **Boxscore-Zeile** `ladestreckenSiege` (0..1 je Spiel) im `spieleBuehneHeben()`-Anhang
   (`:44514`), additiv wie `kuehneVersuche` — nie Teil von `wert`.
4. Teambank der Seite klatscht beim Ankommen (die Wippe aus `zeichneHeben()` `:25383`).

Nicht: ein Kilogramm, ein Versatz, ein Bonus in `summe`. Das ist Regel 4 des 02.10.-Papiers und
der gemessene Befund vom 06.09. (nur ein Bonus **in** `summe` bewegt rho).

### 3.4 Offline-Diagnose auf dem echten Kader (keine Simulation)

Gerechnet in einem Scratch-Skript außerhalb des Repos auf `data/generated/kaderfamilie-live-save.json`
(fünf echte Team-Paarungen). Kaderwahl wie die Sonde ohne gesetzte Aufstellung: Top-6 je Seite nach
`d.gewichtheben`, Paarung über den Index wie `baueHebenDuelle()`; Sub-Skills über `mische()`
(gewichtetes Attributmittel, `:5602`) **ohne** Slot-/Form-/Trait-Zuschläge. 30 Paarungen, 60 Heber.
Grob, aber dieselbe Größenordnung wie das Spiel.

| Größe | Wert |
|---|---|
| ΔLAST je Paarung | Median 16, Quartile 10 / 24, max 43; **0 von 30 unter 5**, 8 von 30 unter 10 |
| ΔERHOLUNG je Paarung | Median 15, Quartile 4 / 23 |
| ERHOLUNG im Feld | 17 bis 99, Median 57 → Frische-Faktor **0,900 bis 0,999** |
| stamina im Feld | 3 bis 99, Median 55 |
| r(LAST, ERHOLUNG) | 0,52 (health sitzt in beiden) |

**Fester Sandsack, Tempo = 0,85·LAST + 0,15·ERHOLUNG:** Nebenweg kippt 0 von 30. Bei 0,75/0,25: 0
von 30. Bei 0,65/0,35: 1 von 30. — Ein Kraft-Rennen ist ein LAST-Rennen, und LAST ist schon die
Ansage.

**Relative Last ohne Gewichtung** (reines Verhältnis Eröffnung × Frische): der nach LAST Schwächere
gewinnt 14 von 30, der Frischere nur 15 von 30 — die Ansage-Differenz dominiert in 20 von 30. Das
wäre ein Rennen, das der vorsichtige Eröffner gewinnt: dramaturgisch falsch.

**Vorgeschlagene Tempo-Formel (3.1):**

| kF / kA | Frischerer gewinnt | LAST-Schwächerer gewinnt | knapp (< 3 % Zeit) |
|---|---:|---:|---:|
| 4 / 1,5 (**Startwert**) | 25 / 30 (83 %) | 6 / 30 (20 %) | 4 / 30 |
| 3 / 1,5 | 24 / 30 (80 %) | 7 / 30 (23 %) | 4 / 30 |
| 5 / 1,0 | 26 / 30 (87 %) | 7 / 30 (23 %) | 5 / 30 |
| 4 / 0 (Ansage ohne Wirkung) | 29 / 30 (97 %) | 7 / 30 (23 %) | 9 / 30 |

Stolper-Kandidaten (Frische < 0,93): 9 von 60 Hebern.

Die Formel erzählt also, was sie soll: die Frische entscheidet, die Ambition macht es schwerer, und
in einem von fünf Duellen gewinnt der Schwächere die Strecke — ohne dass es ihm am Zweikampf etwas
bringt. Die Startwerte sind Startwerte; die Abnahme der Kalibrierung ist eine Sonde, die diese drei
Quoten je Spiel zählt (5.1), nicht dieses Papier.

---

## 4. Attribute: derselbe Rezept-Satz, kein Override — und warum

**Gewählt: Weg (a).** Die Ladestrecke liest ausschließlich `LAST` (indirekt, über `maxStossen` als
Nenner der relativen Last), `ERHOLUNG` (Frische) und `ANSAGE` (über die Eröffnungshöhe). Keiner der
fünf Sub-Skills bekommt eine neue Besetzung, die Matrix bleibt byte-identisch, und
`spiel-eignung-overrides.ts` bekommt keinen Eintrag.

**Warum kein Override (Weg b), obwohl „Tragen" nach Ausdauer klingt:**

1. **Der Football-Präzedenzfall ist das Gegenteil dieses Falls.** Football bekam den Override, weil
   Minispiel und Matrix bei rho 0,427 auseinanderlagen und der Rückweg gemessen tot war (rho 0,053,
   Kopfkommentar der Override-Datei). Gewichtheben liest die Matrix mit 9,6 Pp durch und steht bei
   rho 0,865. Es gibt nichts zu retten.
2. **Ein Override ist eine spielersichtbare Zahl.** Kopfkommentar `spiel-eignung-overrides.ts`:
   „EINEN EINTRAG HINZUFUEGEN ist deshalb KEINE Kleinigkeit: er aendert eine spieler-sichtbare Zahl
   im Kaderbildschirm und das, wofuer die KI Geld ausgibt." Ein stamina-Override für Gewichtheben
   hieße: der Kaderbildschirm und der KI-Einkauf bewerten Heber plötzlich nach Ausdauer, obwohl der
   Zweikampf sie nach Kraft wertet.
3. **Chris' zweite Hälfte der Matrix-Entscheidung** (CLAUDE.md, 21.09.): „wenn ich einen Spieler mit
   einer Stat von 80 reinschicke, erwarte ich auch, dass da einer der Top-Leute ist." Ein
   power-80-Heber muss oben stehen. Eine Ladestrecke, die stamina gewichtet und Duelle entscheidet,
   setzte den stamina-99/power-30-Heber vor ihn. Genau das darf nicht sein — und muss es nicht,
   damit der Stamina-Heber trotzdem **seinen** Moment hat.
4. **Die Zahlen sagen, dass es ohnehin nicht geht.** 0 von 30 Kipps bei 15–25 % (3.4): ein
   Wertungs-Nebenweg über Ausdauer bräuchte ein Gewicht, das stamina von 2 auf 20+ hebt. Das ist
   keine Dosis, das ist eine andere Disziplin.

**Wie „mehrere Wege" trotzdem drinsteckt** (CLAUDE.md-Leitlinie, I-Spy 1.6 „Primärweg schlägt
Nebenweg"): Der **Primärweg** zum Duellsieg bleibt die Hantel — LAST setzt die Decke, TECHNIK/NERVEN
das Gelingen, ANSAGE den Mut. Der **Nebenweg** ist die Ladestrecke: ein eigener, sichtbarer Erfolg
für den Heber, der frisch ist, aber nicht der Stärkste — gewinnbar in rund 20 % der Duelle, mit
eigener Belohnung (3.3), die dem Primärweg nichts wegnimmt. Das ist das Muster „dieselbe Aufgabe,
schlechter gestellt" aus I-Spy, übersetzt auf eine Bühne, auf der die Wertung nicht teilbar ist: der
Nebenweg zahlt in Sichtbarkeit, nicht in Kilogramm. Und er ist ehrlich, weil die Frische im Stoßen
ja wirklich zählt (bis 10 % der Decke) — die Ladestrecke behauptet nichts, was der Motor nicht tut.

**Grip Anchor bekommt endlich sein Bild.** Die Slot-Rolle („Hält über Will und Determination, wenn
es eng wird", `:5381`) erzählt seit dem 03.09. die Geschichte des Zähen; G4 hat ihr den
Wiederholungsbonus gegeben. Die Ladestrecke ist die zweite Stelle, an der man den Zähen **sieht**.

---

## 5. rho und Pp — Einschätzung und Prüfweg

### 5.1 Stufe 1: neutral per Bauart, und so wird es belegt

Kein `rr()`, kein Schreiben in gewertete Felder, keine Änderung an Simulationskonstanten. Die
Abnahme ist deshalb kein „Vorher/Nachher innerhalb der Spannweite", sondern **Bit-Identität**,
dasselbe Protokoll wie bei G2/G3 (PR #1094) und der Spoiler-Runde (PR #1091):

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
node scripts/messe-arena-einfluss.mjs gewichtheben 48
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48
node scripts/messe-arena-einfluss.mjs gewichtheben 48 --saat-versatz=20000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 30000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 40000000
node scripts/miss-gewichtheben-korridor.mjs 200
```

Jede Zahl muss **zeichengleich** zu `main` davor sein (0,865 / 0,143 / 0,944; 8,5 / 10,0 / 11,4 /
10,1 / 7,9; Korridorzeilen). Dazu ein Boxscore-Vergleich über `spieleBuehneHeben("gewichtheben",
saat)` für 50 Saaten: `wert`, `seiten`, `gesamtKg` byte-gleich, nur der neue Anhang
`ladestreckenSiege` kommt dazu. Weicht irgendetwas ab, ist der Bau falsch — nicht die Toleranz zu eng.

Zusätzlich eine **Dramaturgie-Sonde** (neue Zeile in `scripts/diag-gewichtheben-spannung.mjs` oder
ein eigenes Skript): je Spiel Ladestrecken-Sieger = frischerer Heber (Ziel 70–85 %), = nach LAST
schwächerer Heber (Ziel 15–30 %), Stolperer je Spiel (Ziel 0,3–1,5), knappe Läufe. Das ist die
Kalibrierung der Startwerte aus 3.1 — eine Gefühlsfrage, keine rho-Frage, und sie gehört vor die
Sichtabnahme, nicht in dieses Papier.

### 5.2 Stufe 2: was ein Biss kosten würde

| Biss | Was | rho-Erwartung | Pp-Erwartung | Klasse | Empfehlung |
|---|---|---|---|---|---|
| **2a Los-Ersatz** | Gleiche Ansage im dritten Versuch: statt `rr()<0,5` (`:16571`) entscheidet der Ladestrecken-Sieger, wer zuerst hebt. Der `rr()`-Wurf wird **weiter gezogen und verworfen** (Falle 17), die Folge bleibt. | Flach: betrifft nur den Gleichstandsfall, Reihenfolge-Varianten lagen am 06.09. bei 0,836–0,850 alle flach. | Null bis Rauschen: kein Attribut neu in einem Kanal. | B | Ja, wenn Chris Stufe 2 will — billigste echte Konsequenz. |
| **2b Eröffnungs-Versatz** | Ladestrecken-Verlierer eröffnet das Stoßen um bis zu 0,02 Anteil sicherer, Sprünge nachskaliert — **Zielgewicht-invariant**, exakt der Mechanismus von Maßnahme B (13.09., `:16478`). Nur der Weg, nie die Decke. | Flach erwartet (Invarianz-Beweis von B), aber nicht bit-identisch: kaderfest n=24/48 Median+Spannweite, dazu `miss-star-paartreue.mjs`. | ERHOLUNG/ANSAGE lesen marginal mehr; stamina hat Luft (−0,5), will/health nicht (+1,2/+0,8). Fünf Ströme n=48, kein Attribut > +2 Pp über heute. Korridor: Stoßen-1 84–90 % muss halten (ein sichereres Eröffnen hilft eher). | W | Nur auf Wunsch, nach 2a. |
| **2c Stolperer per Wurf** | `stolpert` aus einem `rr()`-Wurf mit fester Ziehung je Heber je Ladestrecke (immer gezogen, Falle 17), Chance aus Frische. | Flach erwartet; Folge verschiebt sich, also kaderfest messen. | Null, solange die Folge nur Anzeige ist. | B | Erst, wenn der deterministische Stolperer zu vorhersehbar wirkt (Sichtabnahme). |
| **2d Malus aufs Stoßen-Maximum** | Verlierer/Stolperer: `maxStossen · (1 − 0,01..0,02)`. | +5 % in `summe` war am 06.09. nicht von Null unterscheidbar, −1,5 % also auch nicht. | **Riskant:** ERHOLUNG zählt dann **doppelt** (Frische-Faktor + Malus aus Frische), stamina/health/will steigen gemeinsam, will (+1,2) und health (+0,8) sind schon über Matrix. Dieselbe Fehlerform wie die Sechs-Hebel-ANSAGE vom 01.10. | W | **Nein.** |

Einschätzung in einem Satz: **Stufe 1 ist neutral, 2a/2b sind neutral mit Messpflicht, 2d ist der
einzige Vorschlag, der die Pp-Zahl messbar in die falsche Richtung schieben würde — und genau der
wird nicht empfohlen.**

### 5.3 Was die Diagnose nicht kann

Die Zahlen aus 3.4 sind ohne Slot-/Form-/Trait-Zuschläge und ohne Simulation gerechnet; sie sagen
Größenordnungen (Kipp-Quoten, Stolper-Häufigkeit), keine Nachkommastellen. Die echte Kalibrierung
läuft in der Dramaturgie-Sonde (5.1) auf dem Motor.

---

## 6. Klasse-Einordnung — ausdrücklich, je Variante

Die Klasse hängt nicht an der Idee, sondern daran, **woher die Sekunden kommen.** Drei Wege, drei
Klassen:

| Variante | Woher die Zeit kommt | Gesamtsendezeit | Versuchstakt | Simulation | Klasse |
|---|---|---|---|---|---|
| **β — im Fenster des ersten Stoßversuchs (Empfehlung)** | Die Ladestrecke läuft in den ersten ~2,8 s des 6,2-s-Fensters des **zuerst enthüllten** Stoßen-1 (beide Figuren tragen gleichzeitig); dieser eine Hebeversuch wird in die restlichen ~3,4 s gestaucht (Phasen × 0,55: `hoch` 2,7 → 1,5 s). Der zweite Heber steht bei seiner Enthüllung 6,2 s später längst oben, sein Versuch läuft unverändert. 6 von 72 Versuchen betroffen. | **7:11, unverändert** | 66 von 72 unverändert; 6 Eröffnungsversuche intern gestaucht | bit-identisch (`buehneAkt`, `buehneQueue`, `rundenDauer`, `ZEIT_DEHNUNG`, `done`, `rr()` unberührt) | **A\*** — Anzeige mit neuer Anzeige-Buchhaltung (eine `lastgang`-Phase in `stepHeben`, Positionsinterpolation in `buehnenBewegung`) |
| **γ — eigener Enthüllungs-Slot** | Je Duell ein zusätzlicher `buehneQueue`-Eintrag „Ladestrecke" mit eigener Dauer | **~7:48** (+6 × 6,2 s) | unverändert | bit-identisch für `summe`/`wert()`, aber `buehneQueue`-Länge, `buehneT` und `vorbei()`-Zeit ändern sich; Sonden mit fester Wartezeit betroffen | **T** — mehr Zuschauzeit, die der Zuschauer nicht gewählt hat. Nur Chris. |
| **δ — eigener Slot, Versuche gekürzt** | wie γ, aber `rundenDauer` 1,55 → 1,43, damit die Summe bei 7:11 bleibt | 7:11 | **jeder** Versuch 6,2 → 5,7 s | `rundenDauer` ist eine Simulationskonstante (nur Takt, Ergebnisse bit-identisch), aber Chris hat 6,2 s persönlich gesetzt („4 bis 8 s", 06.09.) | **T-nah** — Chris entscheidet, weil es seinen Takt anfasst. |

**Warum β nicht T ist, Punkt für Punkt** — und warum Chris es trotzdem bestätigen soll:

* Es greift nicht in `loop()`/`speed`/`zeitFaktor()` ein (die T-Definition des Broadcast-Papiers).
* Kein Simulationstick verschiebt sich: `buehneAkt` zählt wie heute, der nächste Versuch kommt nach
  exakt 1,55 Sim-Sekunden, `done` fällt im selben Frame wie heute. `window.__arena.vorbei()` liefert
  denselben Zeitpunkt, `screenshot-disziplin.mjs` (3000 ms nach `#play`) fotografiert weiterhin ein
  laufendes Spiel, kein Skript der 32 muss angefasst werden.
* Die Verteilung der Sendezeit auf sichtbare Momente ändert sich — das ist der Zweck —, die Länge
  nicht.
* **Aber:** Dieselbe Selbsteinstufung („nur Anzeige, nur Umverteilung") lag beim Fechten-Format
  (PR #1111) und bei D7 (PR #1117) zweimal daneben. Deshalb steht β in der Entscheidungsvorlage als
  „Chris bestätigt A\*", nicht als „darf ein Agent ohne Blick bauen". Wenn Chris das Stauchen der
  sechs Eröffnungsversuche als Takt-Eingriff empfindet, ist β für ihn T, und dann gilt T.

Stufe 2a/2c sind **B** (kleine Mechanik ohne Wertungsänderung), 2b/2d **W** (berühren die Wertung
über den Weg bzw. die Decke) — nach dem Schema des 30.09.-Papiers; im Vokabular des 02.10.-Papiers
alle „B, klein, mit Messpflicht".

---

## 7. Wie es aussieht — für den Build-Agenten

Nichts davon ist gebaut. Jede Zahl ist ein Vorschlag für die Sichtabnahme
(`scripts/screenshot-gewichtheben.mjs`), nicht eine Vorgabe.

### 7.1 Bühne

* **Scheibenständer** je Seite am Bühnenrand (x ≈ 70 px links / W−70 rechts, auf Plattformhöhe):
  ein Gestell mit gestapelten Scheiben in den IWF-Farben (rot 25, blau 20, gelb 15, grün 10). Gehört
  in `bodenHeben()` (`:21529`) neben Tribüne/Scheinwerfer — reine Kulisse, immer sichtbar, erzählt
  schon im Standbild „hier wird geladen".
* **Plattformstufe:** die Plattform bekommt eine sichtbare Vorderkante/Stufe (ein bis zwei Zellen
  hoch) zwischen Ständer und Heberposition — das Hindernis, an dem gestolpert wird. Beim
  Hochsteigen eine kleine Hüpf-Interpolation (y-Versatz), sonst nichts.
* **Laufweg:** vom Ständer zur Plattform, auf Plattformhöhe, Heim von links nach rechts, Gast
  spiegelbildlich — beide Figuren laufen **aufeinander zu** zur Mitte, das gibt dem Bild die
  Rennen-Lesbarkeit, die zwei parallele Bahnen nicht hätten.

### 7.2 Figur und Requisite

* Neue `vizPhase` **`lastgang`** in `stepHeben()` (`:19454`), ausgelöst an der Enthüllung des
  ersten Stoßen-1 eines Duells (`u.aktuell===3` und beim Duellpartner `aktuell===2`); beide Heber
  des Duells bekommen sie gleichzeitig, mit je eigener `tragZeit` (3.1) und eigenem `stolpert`
  (3.2). Danach `antritt`→`zug`→`hoch`→`ablage` für den enthüllten Heber mit Phasenfaktor 0,55,
  `boden` für den Partner.
* **Scheibenstapel** als Requisite: zweihändig vor der Brust (Atlas-Stone-Haltung) — exakt der
  Griffpunkt der `zug`-Phase (Front-Rack, `HEBEN_PHASEN.zug.anteil` 0,326, `:449`), nur statt der
  Stange ein Stapel von `n = round(kg/20)` Scheiben, gezeichnet über `hantelAnPunkt()` wie die
  Hantel, aber als Kreisscheiben hintereinander. Stapelhöhe ist damit die Ansage: ein 212-kg-Stapel
  ist sichtbar höher als ein 150-kg-Stapel.
* **Gang:** die vorhandene Lauf-Interpolation aus `buehnenBewegung()` (`:18351`, Eintritt/Gang bei
  Breaking/Eiskunstlauf) auf die x-Achse legen; `tragZeit` ist die Dauer. Bei Stolperer: 0,8 s
  Stopp an der Stufe, Stapel kurz nach unten versetzt, dann weiter.
* **Frische-Ring** über dem Kopf während des Lastgangs, wie der Balance-Ring bei Climbing (Phase 5):
  Füllung = `frische` auf 0,90..1,00 abgebildet, Farbe von Amber (voll) nach Grau (leer). Weg nach
  Ankunft. Das ist die eine Zahl, die der Zuschauer ohne Stats lesen soll: „der ist leer".

### 7.3 Tafel, Ticker, Ton

* **Versuchstafel** (Phase 4) während des Lastgangs: Kopfzeile „LADESTRECKE" statt „REISSEN/
  STOSSEN", darunter je Heber „212 kg · Frische 93 %". Nach Ankunft Badge „Ladestrecke · Name" für
  die Dauer des ersten Stoßversuchs (Platz: die Zeile unter der Versuchsuhr, `:25421`, die dort
  „Zuletzt: …" zeigt — Badge hat Vorrang, bis die erste Lampe fällt).
* **Ticker** (eine Zeile je Ladestrecke, Rang „routine", nie big): „Cassandra zuerst oben — Gram
  schleppt 212 kg" / „Gram stolpert an der Stufe — angeschlagen aus dem Reißen" / „gleichzeitig
  oben". Über `hebenTickerAmUrteil()`-Muster (`:19572`), aber am **Ankunftsmoment**, nicht an der
  Enthüllung.
* **Ton** (`TON_KATALOG.gewichtheben`, prozedural): Schritte im Takt der Interpolation,
  Scheibenklirren beim Aufnehmen und Absetzen, ein kurzer dumpfer Schlag beim Stolperer. Die
  Klatsch-Serie der Teambank beim Ankommen gibt es schon (Wippe in `zeichneHeben()`).
* **Boxscore/Endstand:** `ladestreckenSiege` je Heber als Chip in den Höhepunkten nur, wenn er
  zugleich das Duell verloren hat („gewann die Ladestrecke, verlor den Zweikampf") — das ist die
  Mehrwege-Geschichte in einer Zeile. Sonst nur in der Boxscore-Spalte.

### 7.4 Spoiler-Prüfung des Bildes

Gezeigt wird: Stoßen-Eröffnungsgewicht beider (schon heute als „Nächster: … kg" sichtbar),
Frische (Attribut), Stolperer (aus gelamptem Reiß-Urteil + Attribut). Nicht gezeigt: ob ein
Stoßversuch gelingt, ob ein kühner Versuch kommt, der Duellausgang. Die Prüfung, die der Build-Agent
fahren muss, ist dieselbe wie bei PR #1091: Screenshot-Serie bei 1× über ein ganzes Duell, kein
Urteil vor seiner Lampe.

---

## 8. Empfehlung, Alternativen, Verbindung zum Haltungs-Pilot

### 8.1 Hauptempfehlung

**Stufe 1 (β, A\*) bauen — eine Ladestrecke je Duell zwischen Reißen und Stoßen, deterministisch,
ohne Kilogramm, im bestehenden Zeitfenster**, mit Bit-Identitäts-Abnahme (5.1) und
Dramaturgie-Sonde. Danach Chris schauen lassen. Erst dann über Stufe 2 reden.

Begründung in drei Sätzen: Es ist die einzige Variante, die Bewegung über die Bühne bringt, ohne
die bestbekalibrierte Disziplin des Projekts anzufassen. Sie erzählt nichts, was der Motor nicht
tut — die Frische zählt im Stoßen wirklich. Und sie gibt dem Heber, der nicht der Stärkste ist, den
Moment, den die Mehrwege-Leitlinie verlangt, ohne dem power-80-Heber die Spitze zu nehmen.

### 8.2 Schwächere Alternativen, kurz

* **Nur Tragen, ohne Stufe/Stolperer:** billiger, aber dann ist der einzige Moment „wer ist
  schneller" — und der ist aus Frische-Ring und Stapelhöhe vorher ablesbar. Die Stufe ist das
  Ereignis. Nicht empfohlen, außer als erster Bau-Schritt innerhalb von Stufe 1.
* **Tragen + Hindernisparcours (mehrere Stationen, Beweglichkeit):** Pp-Risiko bei dexterity/speed
  (2.2), und ein Parcours von 2,8 s ist keiner. Nein.
* **Nur bei bestimmten Slots** (z. B. nur Grip Anchor / Final Attempt): macht zwei von sechs Duellen
  anders als die anderen vier, der Zuschauer sieht keine Regel. Nein — aber die **Slot-Rolle darf
  die Ladestrecke einfärben** (Grip Anchor bekommt bei Sieg eine eigene Ticker-Zeile), kostet
  nichts.
* **Festes Bühnengewicht (Sandsack-Rennen):** gemessen tot (3.4). Nein.
* **Laderennen auch vor dem Reißen:** Erweiterung nach Stufe 1 (9, Frage 4), verdoppelt die
  Bewegung, ohne Frische-Geschichte.
* **Eigener Slot (γ/δ):** nur, wenn Chris die 2,8 s als zu kurz empfindet und Sendezeit geben will —
  dann als T mit allem, was das Broadcast-Papier dafür verlangt (Sonden-Schalter, 32 Skripte).

### 8.3 Verbindung zum Haltungs-Pilot (02.10.) — keine Konkurrenz, ein Bild

Der Haltungs-Pilot gibt dem Manager den Knopf Absichern/Normal/Angreifen, der Eröffnungshöhe und
Sprunggröße verschiebt. Die Ladestrecke ist, sobald beides existiert, **das Bild dieses Knopfes**:
„Angreifen" heißt ein höherer Stapel und ein schwererer Gang, „Absichern" ein leichter, schneller.
Der Manager sieht seine Anweisung über die Bühne getragen, bevor die Hantel liegt. Beide Vorhaben
berühren verschiedene Stellen (`lastFuer()`/`ansage[]` bzw. `stepHeben`/`zeichneHeben`) und können
in beliebiger Reihenfolge gebaut werden; zusammen sind sie mehr als einzeln. Wenn Chris nur eines
will: der Haltungs-Pilot gibt dem Manager etwas zu **tun**, die Ladestrecke gibt ihm etwas zu
**sehen** — Chris' Satz von heute („langweilig beim Zuschauen") zeigt auf das zweite.

---

## 9. Entscheidungsvorlage für Chris

Nichts ist vorausgefüllt. Was leer bleibt, wird nicht gebaut.

**Stufe 1 — Die Ladestrecke (Anzeige, bit-identisch)**

* [ ] Nein.
* [ ] Ja, Variante β (im Fenster des ersten Stoßversuchs, 7:11 bleibt) — und ich bestätige die
  Einstufung **A\*** (das Stauchen der sechs Eröffnungsversuche auf ~3,4 s ist für mich kein
  Takt-Eingriff).
* [ ] Ja, aber als eigener Slot (γ, ~7:48, **T**) / mit gekürzten Versuchen (δ, 5,7 s je Versuch,
  **T-nah**) — Chris' Wahl: ____
* Lastgang-Dauer: ____ s (Vorschlag 2,0 + Last-/Frische-Aufschlag, insgesamt ≤ 2,8 s)
* Stolperer deterministisch (Frische < 0,93 und drittes Reißen ungültig): [ ] ja [ ] ohne Stolperer
* Tempo-Startwerte kF ____ (4) / kA ____ (1,5), Abnahme über Dramaturgie-Sonde (5.1): [ ] ja
* Sieger-Belohnung nur Ticker/Badge/Boxscore, kein Kilogramm: [ ] ja (Empfehlung) [ ] nein, ich will
  einen echten Biss → Stufe 2

**Stufe 2 — ein Biss (erst nach Stufe 1 gesehen)**

* [ ] 2a Los-Ersatz im dritten Versuch (B, kaderfest messen)
* [ ] 2b Eröffnungs-Versatz für den Verlierer, zielgewicht-invariant (W, kaderfest + 5 Ströme + Korridor)
* [ ] 2c Stolperer per Wurf mit festem Verbrauch (B)
* [ ] 2d Malus aufs Stoßen-Maximum — **nicht empfohlen**, aber Chris' Wahl

**Attribute**

* [ ] Keine neuen Attribute, kein Override (Empfehlung).
* [ ] Ich will, dass Ausdauer über die Ladestrecke **Duelle** mitentscheidet — dann Override in
  `spiel-eignung-overrides.ts` nach Football-Muster, mit Kaderbildschirm-/KI-Kauf-Folgen; eigener
  Auftrag, eigene Messung. Nicht empfohlen.

**Erweiterungen**

* [ ] Laderennen auch vor dem Reißen (nach Stufe 1): [ ] ja [ ] nein [ ] später
* [ ] Ladestrecke als Bild des Haltungs-Pilots mitdenken (8.3): [ ] ja [ ] getrennt halten

Umsetzung — falls Ja — als eigener Task mit genau diesem Umfang; Produktionscode-Sorgfalt, weil
Gewichtheben live ist (`ARENA_RESOLVED_DISCIPLINE_IDS`). Kein Agent leitet aus diesem Papier eine
Freigabe ab.

---

## 10. Nebenbefunde (gefunden, nicht entschieden)

1. **ERHOLUNG ist die einzige Gewichtheben-Mechanik ohne jedes Bild.** LAST hat die Ansage, TECHNIK/
   NERVEN die Lampen, ANSAGE den kühnen Versuch und die Ansage-Änderung (G3). ERHOLUNG wirkt an
   zwei Stellen (Stoßen-Maximum, Wiederholungsbonus) und erscheint nirgends — nicht einmal im
   Ticker nach einem Fehlversuch. Unabhängig von der Ladestrecke wäre eine Zeile „wiederholt 117 kg
   — gut erholt" (G4-Bonus sichtbar machen) Klasse A, eine halbe Stunde.
2. **Die Sprite-Blätter haben keine Trage-Pose.** Die `zug`-Phase (Front-Rack) ist die nächste
   vorhandene; ein Stapel vor der Brust sitzt dort anatomisch richtig. Eine eigene Pose wäre
   schöner, ist aber eine Sprite-Runde (`docs/design/sprite-handpunkte.md`-Methode), kein
   Motor-Thema.
3. **Die Frische-Spanne 0,900–0,999 ist einseitig.** Bei ERHOLUNG 50 steht der Faktor auf 0,94,
   bei 99 auf 0,999, bei 17 auf 0,900 — der Faktor kann nie über 1. Das ist seit dem 03.09. so
   kalibriert und hat den Reißen-Anteil auf 46,8 % (Ziel 44–47) gebracht; es bedeutet aber, dass
   „frisch" im Bild nie „stärker als am Morgen" heißen darf, nur „nicht müde". Die Beschriftung
   des Frische-Rings sollte das respektieren (kein „+", nur ein Füllstand).
4. **Die Klasse-T-Regel steht weiterhin nicht in `CLAUDE.md`** (Nebenbefund 1 des Broadcast-
   Papiers vom 02.10., unverändert). Dieses Papier hat sie aus dem Broadcast-Papier und den
   Fable-Ideen-Klassen rekonstruiert.

## Quellen im Repo

`public/mockups/battle-mode.engine.js` (Stand `origin/main` `b1bf6c48`): `BUEHNE_ART.gewichtheben`
`:14409–14513`, `HEBEN_ROLLEN` `:16086`, Konstanten `:16104–16306`, `baueHebenDuelle()` `:16319`,
`hebeUebung()` `:16411` (`lastFuer()` `:16507`, Los `:16571`, Erfolgskurve `:16585`),
`HEBEN_PHASEN` `:435`, `HEBEN_ANTRITT_T` … `:19453`, `stepHeben()` `:19454`, `hebenTickerAmUrteil()`
`:19572`, `bodenHeben()` `:21529`, `zeichneHeben()` `:25351`, `buehnenBewegung()` `:18351`,
`stepBuehne()` `:17783`, `ZEIT_DEHNUNG` `:40025–40075`, `spieleBuehneHeben()` `:44500`,
`disziplinProbe()` `:45499`, Slot-Profile `:5376–5383`, `mische()` `:5602`;
`lib/player-generator/official-discipline-weights.ts` (Spalte gewichtheben);
`lib/player-generator/spiel-eignung-overrides.ts` (Kopfkommentar, Football-Eintrag);
`data/generated/kaderfamilie-live-save.json` (Diagnose 3.4);
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (Teil 1 Nr. 1, Designregeln 1–5,
Haltungs-Pilot); `docs/design/fable-ideen-heben-breaking-climbing-30-09.md` (G1–G5, Klassen);
`docs/design/gewichtheben-risiko-versuch-recherche-06-09.md` (Abschnitt 3: Bonus in `summe` vs.
daneben); `docs/design/gewichtheben-spannung-recherche-13-09.md` (Maßnahme B, Zielgewicht-Invarianz);
`docs/design/gewichtheben-kalibrierung-ansage-kanal-01-10.md` und
`gewichtheben-pp-regression-befund-01-10.md` (Pp/rho-Stand, Fünf-Strom-Protokoll);
`docs/design/f1-broadcast-audit-runde-2-30-09.md` (7:11, 95 % Standbild, Spoiler-Punkt 2);
`docs/design/broadcast-d7-a4-fable-empfehlung-02-10.md` (Klasse-T-Umgang, Entscheidungsvorlage);
`docs/design/i-spy-schatzsuche-konzept-21-09.md` 1.6 (Primärweg schlägt Nebenweg);
`docs/design/neue-disziplin-handbuch.md` Falle 17; CLAUDE.md (Abnahmen, Matrixsperre, Mehrwege).

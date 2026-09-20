# Opus-Konvergenz: die Kampfmodell-Debatte, entschieden (20.09.)

**Auftrag von Chris, wörtlich:** „mehrere agents mit pros und cons die sich dann auf ein
gemeinsames ziel verständigen". Vier unabhängige Fachperspektiven haben je die stärkste Version
einer Position ausgearbeitet. Dieses Dokument moderiert sie zu **einer** Entscheidung — keine
Liste, kein „ein bisschen von allem".

**Grundlage.** Alle drei Vordokumente gelesen: `docs/design/universelles-kampfmodell-recherche-20-09.md`
(Fable, PR #971, auf `main`), `docs/pm-briefings/opus-synthese-universelles-kampfmodell-20-09.md`
(Branch `synthese-universelles-kampfmodell-20-09`),
`docs/pm-briefings/opus-gegencheck-kampfmodell-spielsysteme-20-09.md` (Branch
`gegencheck-kampfmodell-spielsysteme-20-09`). Stand `origin/main` = `52082d97`.
**Keine Zeile Code angefasst, keine Messung gefahren.** Was ich selbst am Code nachgeprüft habe,
steht in Abschnitt 1 mit Fundstelle; was ich von den vier Perspektiven übernehme, ist als solches
markiert; wo ich einer widerspreche, steht die Zahl daneben.

---

## 0. Die Entscheidung in einem Absatz

> **Perspektive C gewinnt die Richtung** — der Arena fehlt nicht der Takt und nicht das Subjekt,
> sondern die geschlossene Schleife zwischen Chris' Aufstellung und dem, was er sieht.
> **Perspektive D gewinnt die ersten zwei Bauplätze**, aber nicht als eigenes Programm: A3 und K1
> sind C's Vorbedingung, nicht D's Paket. **Perspektive B behält den Endzustand** — die Runde ist
> der richtige Behälter für die spätere Item-/Zauber-Schicht, nur nicht der nächste Bau.
> **Perspektive A löst sich auf**: ihr wertvollster Bestandteil (PRD) gehört nicht in die Arena,
> sondern zu Football, und was ohne PRD von ihr übrig bleibt, ist durch ihr eigenes stärkstes
> Gegenargument entkräftet.
>
> **Und davor steht ein Schritt, den keine der vier Perspektiven benannt hat und der alle vier
> betrifft: die Arena ist derzeit nicht messbar.** Die Spannweiten sind 0,328 / 0,697 / 0,938 bei
> einer Schranke von 0,80. Jede Wirkung, die A, B oder C sich erhofft, ist kleiner als das eigene
> Rauschen des Messstands. Der A0→A3-Plan ordnet richtig, dass **vor** dem Motorbau eine Messung
> steht — er übersieht nur, dass vor der Messung die **Messbarkeit** steht. Das ist die eine
> Änderung, die ich am bestehenden Plan vornehme, und sie kostet keinen Motor, kein Rezept und
> keine Regie.

Die Reihenfolge, die daraus folgt:

**M0 → A3 → M1 → B0′ → A1.0 → (Fork: C1 oder A1.1) → K1 → S1**, mit **P1 (PRD für Football)** als
unabhängigem Nebenstrang.

Was jeder Buchstabe bedeutet, steht in Abschnitt 4.

---

## 1. Was ich selbst nachgeprüft habe

Der Auftrag verlangt, den vier Perspektiven nicht zu glauben. Acht Stichproben, alle am Code oder
an den Messdokumenten:

| Behauptung | Von | Befund |
|---|---|---|
| Der Host reicht keine Saat durch (A3) | D | **Bestätigt, und härter als formuliert.** `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` hat 551 Zeilen und **null** Treffer für `seed`/`saat`/`Saat`. Der gezeigte Kampf ist nicht der gezählte. |
| Die Sonde misst ohne `place` | C | **Bestätigt.** `data/generated/kaderfamilie-live-save.json` führt je Spieler `{n,c,r,sub,tp,tn,d,groesse,a}` — kein `place`, kein Slot. Der Motor fällt auf seine Eigenordnung zurück (`SLOT_ZUSATZ`: „der beste Spieler bekommt den vordersten Slot"). |
| r(Reihe, Wert) = −0,310 Battlefield, r(Eignung, Reihe) +0,252 / −0,542 / −0,454 | C | **Bestätigt**, wörtlich im `SLOT_ZUSATZ`-Kommentar, `public/mockups/battle-mode.engine.js:5056-5065`. |
| `lineupDrafts` ist durchverdrahtet; `resolve-preview-submission.ts` friert die Aufstellung ein | C | **Bestätigt.** `lineupDrafts` in fünf `lib/`-Modulen; `submitted_preview_lineups_changed` existiert; `arena-aufstellung-adapter.ts` baut daraus `aufstellung[name]={d,slot}`. |
| `zielOf` lebt nur in der Mockup-Tafel | C | **Bestätigt.** Drei Treffer, alle im Tafel-Renderpfad (`:18113`, `:18839`, `:18841`). |
| Chris' Matrix-Satz vom 05.09. | A | **Bestätigt im Wortlaut** (`lib/player-generator/spiel-eignung-overrides.ts:29-30`) — **aber mit einer Einschränkung, die A nicht nennt.** Siehe 2.1. |
| Geschlossener Tempo-Kanal ergibt 0,113 / 0,269 / 0,325 | A, B, Synthese | **Bestätigt** (`docs/design/arena-tempo-schlagfrequenz.md`, Abschnitt 3) — **aber die Lesart ist bei allen dreien unvollständig.** Siehe 1.1. |
| „Vierzehn der zwanzig stehen bei rho ≥ 0,79" | D | **Falsch, es sind dreizehn.** Zwölf bestandene plus Climbing (0,790); Basketball steht bei 0,769. Ändert D's Argument nicht, aber die Zahl ist zu korrigieren. |
| „Football steht bei 0,516 / 0,722" | C | **Vermischt zwei Zahlen.** 0,516 ist rho/Spiel, die zugehörige Saisonzahl ist **0,811** (Verlässlichkeit 0,405, s. B). 0,722 ist Footballs Nach-Override-Zahl aus dem Achten Nachtrag — anderer Kontext. B rechnet hier richtig, C nicht. |

### 1.1 Der Befund, der die ganze Debatte umordnet

Alle drei Perspektiven, die den Tempo-Kanal zitieren, lesen aus
`arena-tempo-schlagfrequenz.md` dieselbe Zahl heraus: geschlossen 0,113 / 0,269 / 0,325, also weit
unter 0,80. Das stimmt. Was keine liest, steht in derselben Tabelle zwei Spalten weiter rechts:

| Disziplin | Δ durch den Kanal | eigene Spannweite | Δ größer als Spannweite? |
|---|---:|---:|---|
| TDM | +0,140 | 0,328 | **nein** |
| Mini-DM | −0,175 | 0,697 | **nein** |
| Battlefield | +0,062 | 0,938 | **nein** |

Die Projektregel dazu steht in `docs/design/stand-aller-disziplinen.md` Abschnitt 1 und ist nicht
meine Erfindung: *„Eine Bewegung, die kleiner ist als die eigene Spannweite einer Disziplin, ist von
Null nicht unterscheidbar."* Die CI-Schranke setzt sie um als `max(0,05; 0,3×Spannweite)` —
für Battlefield sind das **0,28**.

**Keine der drei gemessenen Arena-Bewegungen überschreitet ihre eigene Spannweite. Und sie zeigen
in unterschiedliche Richtungen: derselbe Eingriff hebt TDM, senkt Mini-DM, hebt Battlefield.**
Das ist genau das Muster, das man erwartet, wenn man Rauschen misst.

Daraus folgen drei Sätze, die für jede der vier Perspektiven gelten:

1. **Perspektive A kann nicht beurteilt werden.** Sondenvariante F (AGI + Graze-Band + PRD) würde
   an einem Messstand laufen, dessen Rauschen größer ist als jede erhoffte Wirkung.
2. **Perspektive B widerspricht sich an ihrer eigenen Abnahmezahl.** B schreibt korrekt: „Eine
   Bewegung zählt nur, wenn sie größer ist als die Spannweite — und die ist in der Arena brutal
   (Battlefield 0,938, Mini-DM 0,697)." Und setzt zwei Absätze später als Erfolg: „Mini-DM deutlich
   über 0,50". Von 0,094 auf 0,50 sind **+0,41** — kleiner als Mini-DMs eigene Spannweite von
   0,697. **B's Erfolgskriterium ist nach B's eigener Regel von Null nicht unterscheidbar.** Das
   ist kein Formfehler, das ist der Grund, warum der Rundenpilot heute nicht gebaut werden darf: er
   könnte gelingen und wir wüssten es nicht, oder scheitern und wir wüssten es auch nicht.
3. **Perspektive C's ehrlichstes Gegenargument gegen sich selbst wird dadurch erst beantwortbar** —
   aber auch erst dann. Die Spannweite zwischen optimaler und schlechter Aufstellung ist die Zahl,
   die C selbst fordert; an fünf Kader-Paarungen ist sie nicht ablesbar.

**Das ist kein Grund zu warten, sondern eine Aufgabe.** Der Messstand ist dafür gebaut:
`scripts/miss-alle-disziplinen.mjs` liest die Kader-Familie über die Umgebungsvariable
`OLY_KADER_FAMILIE` (Zeile 50-51), und `scripts/ziehe-kader-familie.ts` erzeugt sie neu. Eine
größere Arena-Familie ist eine Datendatei, kein Motoreingriff, und sie lässt die Basislinie der
siebzehn anderen Disziplinen unberührt. Das ist **M0**.

---

## 2. Würdigung der vier Perspektiven

### 2.1 Perspektive A — Echtzeit + bepreister Substat

**Stärkstes Argument:** Die Zwei-Spalten-Lesart ist korrekt angewandt und trifft. Bei TDM
(0,253/0,217) und Mini-DM (0,094/0,071) sind **beide** Spalten niedrig; nach CLAUDE.md heißt das
„die Mechanik belohnt das Falsche", also Rezept, nicht Uhr. Und A ist die einzige Perspektive, die
den Gegencheck an seiner eigenen Schwachstelle packt: L1/L4/L5/L6/L9 sind ausdrücklich rho-neutral,
**rho-neutral heißt aber auch, dass sie 0,094 um keinen Punkt bewegen.** Das ist ein sauberer
Treffer gegen D. Ebenso richtig: das Regressionsrisiko ist in den drei durchgefallenen
Arena-Disziplinen tatsächlich null, weil dort nichts Heiles steht.

**Größte Schwäche:** A hat sie selbst benannt, und sie trägt. Mini-DMs Rezept speist TMP aus
`dexterity:40, stamina:32, torment:28` und AUS aus `stamina:48, will:32, health:20` — **jedes
einzelne davon ein bepreistes Matrix-Attribut**, Torment mit 24 das schwerste. Chris' Assassine ist
in Mini-DM mechanisch bereits gebaut, genau so, wie A es vorschlägt, und misst die schlechteste Zahl
des Projekts. A's Antwort („die Kanalform ist falsch, nicht die Zutaten") ist eine Hypothese ohne
Zahl — und nach Abschnitt 1.1 eine Hypothese, die **heute keine Zahl bekommen kann**.

**Und ein Einwand, den A nicht kennt:** A stützt die Zulässigkeit eines neuen Subskill-Feldes auf
die zweite Hälfte von Chris' Satz vom 05.09. Diese Hälfte ist im Repo bereits belegt — der
Kommentar an `spiel-eignung-overrides.ts:35-36` beansprucht sie wörtlich für den Override-Mechanismus:
„Was sich ändert, ist NICHT die Matrix, sondern welche Gewichtsquelle eine einzelne Disziplin für
ihre Attribut-Einrechnung benutzt — genau die zweite Hälfte von Chris' Satz." A's Lesart (ein neues
Subskill-**Feld**) ist eine zweite, weitere Auslegung derselben Erlaubnis. Sie ist nicht
offensichtlich falsch, aber sie ist **nicht dasselbe** wie der bereits abgenommene Weg, und A stellt
sie als solchen dar. Das ist eine Frage für Chris, keine, die ein Agent entscheidet (Abschnitt 6).

**Kriterien:** A stark, B schwach (A gibt das selbst zu), **C stark und unterschätzt von den
anderen** — A's Punkt, dass ein Item „+12 AGI" ein bepreistes Ziel hat und „+15 % Krit" keines, ist
das beste Argument gegen eine naive Skill-Schicht, das in der ganzen Debatte fällt. D unbewiesen,
E mittel.

**Urteil: aufgelöst, nicht abgelehnt.** PRD wird aus A herausgelöst und bekommt ein eigenes,
besseres Ziel (2.5). Was übrig bleibt — AGI als Substat — wird hinter M0/M1 geparkt und kommt
gegebenenfalls als **eine Variante unter mehreren** zurück, nicht als Position.

### 2.2 Perspektive B — Rundenmotor + Karten/Sprite-Hybrid

**Stärkstes Argument, und es ist das stärkste Einzelargument der gesamten Debatte:** Ein Skill
braucht einen **Zeitpunkt**, und Echtzeit hat keinen. B belegt es am Code (`const crit=false; //
Krits kommen kuenftig aus dem Skill`, `:19627`) und D räumt es ausdrücklich ein („C spricht
mittelfristig gegen mich"). Wenn Chris' Item-/Zauber-Schicht je kommt — und sie ist sein erklärtes
Ziel („später ggf. auch items zauber etc nutzen") —, dann braucht sie einen diskreten Takt. B hat
damit als einzige Perspektive recht über den **Endzustand**.

Zweitstärkstes: B's Beobachtung, dass der Arena-Nahkampf **deterministisch** ist (zwei lebende
`rr()`-Stellen, beide Fernkampf) und ein Rundenmotor als neuer `MOTOREN`-Eintrag neben dem alten
entsteht. Das Regressionsrisiko von A1.1 ist real klein. B verkauft sich hier unter Wert.

**Größte Schwäche:** die Selbstwidersprüchlichkeit der Abnahmezahl (1.1, Punkt 2), und dahinter
etwas Grundsätzlicheres. B baut einen Motor gegen ein Problem, von dem B selbst sagt, dass der Motor
es nicht löst („D — rho: ehrlich, mein schwächstes Kriterium", „Ich verspreche keinen
Fechten-Sprung"), gegen ein lebendes Gegenbeispiel, das B selbst nennt (Football: die sauberste
Rundenmechanik des Projekts, 0,516 bei Verlässlichkeit 0,405). **Ein Motor, der nach eigener
Auskunft das Messproblem nicht löst, muss sein Dasein aus der Dramaturgie rechtfertigen — und dann
gehört er hinter den Nachweis, dass die Dramaturgie ihn braucht.** Den Nachweis liefert B0, und B
stellt B0 korrekt davor; nur ist B's B0 das falsche B0 (2.3).

**Kriterien:** A stark mit Regie, **B stark — aber B's eigener größter Posten (A3) gehört nicht
B**, C konkurrenzlos, D schwach und selbst eingeräumt, E der größte Umbau der vier.

**Urteil: Endzustand ja, nächster Bau nein.** A1.1 bleibt im Plan, aber hinter M0, M1 und A1.0, und
mit einer Abnahmezahl, die die Spannweite überschreitet statt in ihr zu verschwinden.

### 2.3 Perspektive C — Vorbereitungsphase + Auto-Resolve

**Stärkstes Argument:** C ist die einzige Perspektive, die G1 tatsächlich baut — das Prinzip, das
der Gegencheck selbst an die Spitze seiner sechs stellt („Der Kampf prüft sichtbar eine Entscheidung,
die der Zuschauer kurz vorher getroffen hat. Nimmt man diese Entscheidung weg, bleibt ein
Bildschirmschoner."). Synthese und Gegencheck zitieren P1/G1 beide und bauen dann Regie. C baut die
Entscheidung. Und C's Befund ist **am Code verifiziert und steht in keinem der drei Vordokumente**:
die Vorbereitungsphase existiert vollständig — `lineupDrafts` → `arena-aufstellung-adapter.ts` →
`place`/`order` → `slotFuer` —, sie hat gemessene Wirkung (r(Reihe, Wert) = −0,310), sie hat sogar
schon einen Commit-Moment (`resolve-preview-submission.ts`), und nichts davon ist je gezeigt worden.
**Das ist ein Kabel, das an beiden Enden angelötet ist und in der Mitte nicht sichtbar wird.**

**Der Fund, den C fast macht und nicht ausspricht — und der die Debatte entscheidet:** C stellt
korrekt fest, dass die Sonde ohne `place` misst. C zieht daraus, eine freie Aufstellung sei „per
Konstruktion ein unbepreister Kanal". Die schärfere Folgerung lautet umgekehrt:

> **Die 0,80-Schranke ist noch nie gegen eine menschliche Aufstellung geprüft worden. Was gemessen
> wird, ist die Rangtreue der motoreigenen Optimalaufstellung.** Die Zahl, die dieses Projekt seit
> Monaten als Abnahme führt, setzt genau die Entscheidung bereits voraus, die C dem Spieler geben
> will — sie nimmt sie dem Motor ab und rechnet sie ihm gut.

Damit ist C's eigene „Schere" (eine Entscheidung, die nichts ändert, ist keine; eine, die etwas
ändert, kostet rho) **kein Dilemma, sondern eine Messaufgabe**: die Spannweite zwischen
motoroptimaler und absichtlich schlechter Aufstellung. Diese Zahl existiert nirgends, sie ist unter
einem Tag Arbeit zu haben, und sie ist die informativste verfügbare Zahl der ganzen Debatte. Das ist
**M1**.

**Größte Schwäche:** C's Taktungs-Einwand gegen sich selbst ist echt und darf nicht weggewischt
werden. TFT hat ~30 Vorbereitungsrunden in 35 Minuten mit sofortiger Rückmeldung; wir haben je
Disziplin zwei Einsätze pro Saison. C's eigene Auflösung — die Lernschleife liegt beim **Spieltag**
(~20 Aufstellungen), nicht beim einzelnen Kampf — trägt, ist aber eine Behauptung über Chris'
Erleben, die nur Chris beantworten kann. Zweitens steht C in Spannung zu **L8** des Gegenchecks
(„Keine Größe bekommt Wirkung, bevor sie einen Preis hat"): die Aufstellung ist eine Größe mit
Wirkung und ohne Preis. Die Auflösung, die ich unterschreibe: die Aufstellung ist kein Attribut,
sondern ein **Input-Kanal** — und L3 erlaubt Input-Zufall ausdrücklich gratis. Aber die
Entscheidung ist kein Zufall, sie ist eine Absicht, und deshalb muss ihr Preis gemessen werden,
bevor sie wirksam wird. **M1 ist genau diese Bepreisung.** Drittens: C's Warnung, dass
Zielwahl-Reformen schon zweimal gescheitert sind (`docs/design/arena-zielwahl-umsetzung.md`, beide
Anläufe kaderfest schlechter), gilt auch gegen C selbst, denn Aufstellungswirksamkeit fasst denselben
Mechanismus an.

**Kriterien:** A stark und ohne Ergebnis-Zufall, **B die stärkste der vier**, **C die stärkste der
vier** (die vier Slots aus `roguelike-skill-pool-konzept-17-09.md` *sind* Vorbereitungsentscheidungen
— sie brauchen keinen neuen Ort, sondern den, den C baut), D offen aber messbar gemacht, E mittel
mit bereits bezahlten Teilen.

**Urteil: C gewinnt die Richtung.**

### 2.4 Perspektive D — Präsentation zuerst

**Stärkstes Argument:** D ist als einzige nicht auf Plausibilität angewiesen. Die Rho-Neutralität
ist **konstruktiv beweisbar**, nicht bloß behauptet: die Sonden rufen `stepBuehne()`/`stepFeldspiel()`
in eigener Schleife mit festem 1/60 auf und laufen nie durch `loop()`/`zeitFaktor()`; `renderKader()`
schreibt in keinen Simulationszustand. Nachweis ist `miss-alle-disziplinen.mjs 24` bit-identisch,
keine neue Basislinie. In einem Projekt, das sich zweimal an stillen Messartefakten verbrannt hat
(Formkarten-Bug, Einzelkader-Bug), ist das mehr wert, als es in einer Debatte über Spannung klingt.

Und D liefert den **am besten belegten Einzelbefund der ganzen Runde**: der Host reicht keine Saat
durch, nachgezählt null Treffer in 551 Zeilen. Solange das so ist, schaut Chris einem anderen Kampf
zu als dem gezählten, und **jede** Aussage über Spannung, Bindung oder Aufstellung ist eine Aussage
über ein Video.

**Größte Schwäche:** D's Paket zerfällt bei genauem Hinsehen in zwei sehr ungleiche Hälften, und D
verkauft sie als eine.

- **A3 und K1 sind keine Präsentationsthese.** Sie sind die Vorbedingung für die Positionen B und C
  — für G1 überhaupt. Sie gewinnen, aber nicht als Beleg dafür, dass Präsentation vor Mechanik
  kommt. Sie gewinnen, weil ohne sie nichts anderes messbar oder zeigbar ist.
- **L5 ist die eigentliche These, und sie ist die schwächste Position im Feld.** D's eigenes
  Gegenargument 1 trifft: `big` ist ein handgesetztes Boolean an 15 Stellen, kein Dramatikmaß; ein
  echter Dynamic Highlight Mode braucht ein kontinuierliches Signal, das nirgends existiert, in
  vier Chassis. Das ist Arbeit an **dreizehn bestandenen Disziplinen**, wo der Gewinn rein
  kosmetisch ist, während die drei Arena-Disziplinen unangetastet bei 0,094 / 0,253 / 0,387 stehen
  bleiben. D's eigener Satz dazu ist korrekt und vernichtend: „Meine Position **verschiebt** dieses
  Problem, sie löst es nicht."

**Und der Grund, warum D's Reihenfolge trotzdem nicht ganz gewinnt:** D's Falsifikationstest (B0
zuerst) testet die falsche Hypothese. Dazu 2.6.

**Kriterien:** A selbst eingeräumt schwach („es liefert ‚ich hätte es fast verpasst', nicht ‚das
hätte auch anders laufen können'"), B stark, C neutral bis leicht negativ, **D das stärkste
Kriterium und konstruktiv bewiesen**, E niedrig.

**Urteil: zwei von vier Posten gewinnen, als Vorbedingung. L5 wird verschoben, nicht gestrichen.**

### 2.5 Der Posten, der aus der Debatte herausfällt und trotzdem gewinnt: PRD

A führt PRD als Teil ihres Pakets („meine Position nutzt beide Hebel gleichzeitig"). Das ist ein
Verkaufsargument, kein Sachargument: **PRD braucht A's Substat nicht.** Es ist ein eigenständiges
Werkzeug aus dem Gegencheck (Abschnitt 2.4), und es hat ein besseres Ziel als die Arena.

Die Zwei-Spalten-Regel, auf Football angewandt: **0,516 je Spiel bei 0,811 über die Saison.** Hohe
Saisonzahl, niedrige Einzelspielzahl — nach CLAUDE.md genau der Fall, in dem „die Mechanik das
Richtige belohnt, aber zu laut", und die Verlässlichkeit von **0,405** ist die niedrigste der
zwanzig. PRD senkt exakt diese Größe, bei unverändertem Erwartungswert, also ohne die Validität zu
berühren. Football hat 86 `rr()`-Stellen im Feldspiel und ist bereits rundenbasiert.

**Football ist damit der einzige Ort im ganzen Projekt, an dem ein diagnostiziertes Problem auf ein
passendes Werkzeug trifft — und niemand hat die beiden zusammengebracht.** Die Synthese erwähnt PRD
gar nicht, der Gegencheck nennt Football „den plausibelsten Kandidaten im ganzen Feld" und lässt es
dann als Sondenvariante E in der Arena liegen, wo es nach 1.1 nicht beurteilbar wäre. Das ist
**P1**, ein unabhängiger Nebenstrang, und es ist die billigste ernsthafte rho-Chance der Runde.

### 2.6 B0: alle drei, die es fordern, bauen das falsche

B und D wollen B0 als Falsifikationstest der Präsentationsthese. C will B0 umbauen, so dass es
**mit der Aufstellungstafel beginnt**. Ich entscheide für C, und mit einem Grund, den C nicht nennt:

> **Ein Drehbuch, das einen Kampf zeigt, ohne die Entscheidung zu zeigen, die ihn erzeugt hat,
> beantwortet die Abnahmefrage nicht — egal wie Chris antwortet.** Sagt er ja, haben wir bewiesen,
> dass ein Bildschirmschoner hübsch sein kann. Sagt er nein, wissen wir nicht, ob die Regie zu
> schwach war oder die fehlende Entscheidung. Der Test wäre in beide Richtungen nicht informativ.

Ein B0, das die Aufstellung enthält, testet dagegen genau die eine Frage, an der sich die Debatte
scheidet: **liegt Chris' „das ist kein Spiel" an der Regie oder an der fehlenden Autorschaft?**
Das ist ein Test mit zwei unterscheidbaren Ausgängen. Ich nenne es **B0′**.

Die Auflage des Gegenchecks (5.2) bleibt unverändert und gilt doppelt: **ausdrücklich ohne jeden
Zufall gescriptet, und das dazugeschrieben.** Sonst beweist ein Erfolg das Gegenteil dessen, was er
beweisen soll.

---

## 3. Die konvergierte Entscheidung — und warum die anderen unterliegen

**Gewonnen hat C, weil C's Kernbehauptung als einzige alle vier Eigenschaften zugleich hat:** sie ist
am Code verifiziert, sie ist noch nirgends gemessen, sie ist billig zu messen, und sie ist
gleichzeitig der stärkste Hebel auf die Kriterien A, B und C. Keine andere Position hat mehr als
zwei davon.

**Warum A unterliegt — nicht „auch gut, aber":** A's Mechanik existiert bereits. Mini-DM speist TMP
und AUS ausschließlich aus bepreisten Matrix-Attributen, mit Torment (24) als schwerstem, und misst
0,094. A bietet dafür eine Erklärung ohne Zahl an und schlägt vor, sie durch eine Messung zu prüfen,
die nach 1.1 heute nicht aussagekräftig wäre. Dazu kommt A's ungelöster Kern, den A selbst benennt:
die Normierung über `aufEignung()` stößt bei 1 an, und genau diese Kappung machte 23 von 24 Kämpfen
zu 6:0. **A ist nicht widerlegt — A ist unprüfbar, und zwar heute aus einem behebbaren und morgen
aus einem inhaltlichen Grund.** Ihr bester Bestandteil (PRD) überlebt als P1 mit einem besseren
Ziel; ihr bestes Argument (Items brauchen ein bepreistes Ziel) überlebt als Auflage an S1.

**Warum B unterliegt — als nächster Bau, nicht als Ziel:** B's Abnahmezahl liegt in B's eigenem
Rauschband (1.1). B räumt ein, den Fechten-Sprung nicht zu versprechen. B's eigenes Gegenbeispiel
(Football, 0,516) zeigt, dass Runden für sich keine Rangtreue-Medizin sind. Und B's größter
Bindungsposten (A3) gehört B nicht — B sagt das selbst („der größte Posten gehört gar nicht zum
Umbau"). **Was von B bleibt, wenn man A3 abzieht und die rho-Hoffnung streicht, ist ein
Dramaturgie-Argument** — und das ist ein starkes Argument, das aber hinter den Nachweis gehört,
dass die Dramaturgie den Motor braucht. Den liefert B0′.

**Warum D unterliegt — obwohl D die ersten zwei Bauplätze bekommt:** D's Programm ist L5, und L5 ist
Arbeit an dreizehn Disziplinen, die bestanden haben, während die drei, die mit 0,094 / 0,253 / 0,387
durchgefallen sind, unberührt bleiben. D gibt das zu. A3 und K1 gewinnen nicht als Beleg für D's
These „Präsentation zuerst", sondern weil sie Vorbedingung für alles andere sind: **ohne A3 ist der
gezeigte Lauf nicht der gebuchte, und damit ist jede Aussage über Spannung, Aufstellung oder Bindung
eine Aussage über ein Video.** Das ist ein Argument aus G1, nicht aus der Präsentationsthese.

**Und die Änderung am A0→A3-Plan, die aus der Debatte folgt:** Der Plan ordnet richtig, dass eine
billige Messung (A1.0) vor den Motorbau gehört. Er übersieht, dass vor der Messung die
**Messbarkeit** steht. A1.0's vier Varianten an einem Messstand mit Spannweite 0,697 zu fahren,
erzeugt vier Zahlen, aus denen man nichts schließen darf. **M0 wird vorangestellt, M1 tritt neu
hinzu, B0 wird zu B0′, und A1.0 bekommt M1's Aufstellungs-Variante als fünfte Variante.** Alles
andere im Plan bleibt stehen.

---

## 4. Der Umsetzungsplan

Reihenfolge ist bindend, außer wo „parallel" steht. Jede Stufe hat einen Abbruchpunkt.

### M0 — Den Arena-Messstand messbar machen *(zuerst, blockiert alles Mechanische)*

Die Arena-Kader-Familie von fünf auf etwa fünfundzwanzig echte Paarungen vergrößern
(`scripts/ziehe-kader-familie.ts`, eingespeist über `OLY_KADER_FAMILIE`), und neben Median und
Spannweite die **Streuung des Medians selbst** ausweisen — also die Frage beantworten: wie genau ist
die Zahl, mit der wir seit Monaten argumentieren?

- **Kein Motoreingriff, kein Rezept, keine Regie.** Eine Datendatei und eine Auswertespalte.
- Die Basislinie der siebzehn anderen Disziplinen bleibt unberührt; die neue Familie gilt zunächst
  nur für tdm / mini-dm / battlefield.
- **Abbruchpunkt / Entscheidungstor:** Schrumpft die Spannweite mit mehr Paarungen deutlich, ist die
  Arena messbar und M1 kann starten. Schrumpft sie **nicht**, dann ist Arena-rho keine Schätzung von
  irgendetwas, und die 0,80-Schranke ist auf die Arena in ihrer heutigen Form nicht anwendbar —
  das ist dann eine Feststellung für Chris (Abschnitt 6, Frage 1), keine Panne.

### A3 — Die gebuchte Saat durch den Host reichen *(parallel zu M0, unabhängig)*

Unverändert aus dem bestehenden Plan, mit D's Auflage: **zuerst nachweisen, dass `seedZuZahl()`
produktive Saat-Strings nicht auf 0 kollabiert** (`lib/battle/arena-headless-runner.ts` Z. 67 ff.:
`"seed-eins"` und `"seed-zwei"` ergeben beide 0). Naiv durchgereicht bekämen alle Arena-Spiele
dieselbe Saat — ein stiller Fehler genau der Bauart, an der sich dieses Projekt schon zweimal
verbrannt hat.

**Abnahme:** gezeigter Endstand == gezählter Endstand, an fünf Spieltagen.

### M1 — Was kostet die Aufstellung? *(nach M0, vor jedem Motor und jeder Regie)*

Die Sonde mit gesetztem `place` fahren, in drei Stufungen gegen die heutige Basislinie ohne `place`:

1. Motoroptimale Aufstellung (= heutiger Zustand, Kontrolle).
2. Plausible menschliche Aufstellung.
3. Absichtlich schlechte Aufstellung (Star nach hinten, Bollwerk auf die Flanke).

**Die gesuchte Zahl ist die Spannweite zwischen 1 und 3** — der Preis der Autorschaft in rho. Sie
existiert nirgends und entscheidet C's „Schere" empirisch statt argumentativ.

- **Tor A (grün):** Die Spannweite ist klein genug, dass eine schlechte Aufstellung rho nicht unter
  die Schranke drückt. → C1 wird gebaut, die Aufstellung wird sichtbar und wirksam.
- **Tor B (gelb):** Die Spannweite ist groß, aber die *Exposition* (wer ins Bild und in die
  Schusslinie gerät) lässt sich von der *Höhe* trennen. → C1 wird gebaut, aber die Aufstellung formt
  nur Varianz und Exposition, nicht den Erwartungswert. Das ist C's eigener Vorschlag, dann mit
  Beleg.
- **Tor C (rot):** Die Aufstellung verschiebt den Erwartungswert so stark, dass Autorschaft und
  Schranke unvereinbar sind. → C verliert nachträglich, die Entscheidung geht an Chris zurück
  (Abschnitt 6, Frage 2), und B rückt auf.

### B0′ — Das Drehbuch-Mockup, beginnend bei der Aufstellung *(nach A3, parallel zu M1)*

C's Umbau, nicht B's oder D's Nachbau. Aufbau: Aufstellungstafel mit drei Reihen, echten Portraits,
Befehl je Slot und Zielansage → Klick „Aufstellung abgeben" → Auflösung als Enthüllung **mit
Rückbezug** („Schleicher geht hinten rum — dein Bollwerk steht links"). Echte Sprites, Duell-Bühne
nach `zeichneHeben()`, Höhepunkt-Dosierung über den bestehenden `HIGHLIGHTS`/`callout()`-Pfad,
„zählt für Spieltag 7" sichtbar.

**Ausdrücklich ohne jeden Zufall gescriptet, und das im Mockup dazugeschrieben** (Gegencheck 5.2).

**Abnahmefrage an Chris, wörtlich:** *Fühlt sich das an wie ein Spiel?* — und die Zusatzfrage, die
den Test erst zweiseitig macht: *War es die Aufstellung, oder war es die Inszenierung?*

- **Ja, wegen der Aufstellung** → C1 ist bestätigt, B rückt hinter S1.
- **Ja, wegen der Inszenierung** → D's These lebt, L5 rückt auf.
- **Nein** → beide Präsentationsthesen sind falsifiziert, A1.1 rückt sofort auf, und wir haben einen
  Nachmittag statt einer Runde ausgegeben.

### A1.0 — Die Expositions-Sonde, um zwei Varianten erweitert *(nach M0)*

Unverändert aus dem bestehenden Plan (Varianten A–D), plus:

- **Variante E: alle `rr()`-Wahrscheinlichkeiten PRD-gebunden** — übernommen aus dem Gegencheck.
- **Variante P: `place` gesetzt** — das ist M1, hier als gemeinsamer Lauf, damit Zielwahl und
  Aufstellung im selben 2×2 trennbar bleiben.

Nur Sondenpfad, nichts gemergt, kaderfest auf der M0-Familie, Median **und** Streuung des Medians.
**Eine Bewegung zählt nur, wenn sie die Spannweite der M0-Familie überschreitet** — diese Regel gilt
jetzt auch für B's spätere Abnahmezahl.

### P1 — PRD für Football *(unabhängiger Nebenstrang, jederzeit)*

Die `rr()`-Stellen im Feldspiel auf Pseudo Random Distribution umstellen und Football messen.
Begründung in 2.5. Erwartungswert bleibt, Streuung sinkt, Validität (0,811) unberührt.

**Abnahme:** Football über 0,60 je Spiel bei unveränderter Saisonzahl wäre ein Erfolg; die
Verlässlichkeit müsste von 0,405 messbar steigen. **Und die Isolationspflicht gilt:** die übrigen
neunzehn Disziplinen bit-identisch, `miss-alle-disziplinen.mjs 24` als Nachweis.

### C1 — Die Aufstellung sichtbar und wirksam machen *(nur bei M1-Tor A oder B, und nach B0′)*

Die bereits verdrahtete Schleife schließen: Aufstellungstafel im Produktivpfad, Zielansage aus dem
Spielstand statt aus der Mockup-Tafel (`zielOf` lebt heute nur dort), Aufdecken als inszenierter
Moment auf dem bestehenden `resolve-preview-submission`-Commit.

**Warnung, die C selbst ausspricht und die stehen bleibt:** `docs/design/arena-zielwahl-umsetzung.md`
dokumentiert zwei gescheiterte Zielwahl-Anläufe, beide kaderfest schlechter. C1 fasst denselben
Mechanismus an. Nach jedem Schritt kaderfest messen, auf der M0-Familie.

### K1 — Kachel → Portrait-Karte in `renderKader()` *(parallel, jederzeit nach A3)*

Unverändert aus dem bestehenden Plan. Eine Funktion, alle vier Chassis, 2 984 Portraits liegen
bereit. Nachweis: `miss-alle-disziplinen.mjs 24` bit-identisch. **Ehrlich dazusagen**, wie D es tut:
Sprite und Name stehen dort schon, der Zugewinn ist Portrait und Wiedererkennung, nicht null auf
eins.

### A1.1 — Der Rundenpilot *(nur bei B0′-Ausgang „nein", oder als Vorbereitung auf S1)*

Unverändert in der Bauart (neuer `MOTOREN`-Eintrag neben dem alten, Protokoll mit Runde/Handelndem/
Ziel/Aktion/Ergebnis/Intent), **geändert in der Abnahmezahl**: der Erfolg muss die Spannweite der
M0-Familie überschreiten, nicht „deutlich über 0,50" lauten.

### S1 — Skill-/Item-Ebene *(eigener Strang, Engpass sind die 33 fehlenden Klassenkarten)*

Mit drei Auflagen aus dieser Debatte:

1. **Zuteilung per Saat (Input-Zufall), Wirkung deterministisch oder PRD-gebunden** — nie frei
   gewürfelt (Gegencheck 2.5).
2. **Jeder Item-Effekt braucht ein bepreistes Ziel.** A's bestes Argument, wörtlich übernommen:
   „+12 AGI" hat eines, „+15 % Krit" hat keines. Wenn A's Substat je kommt, kommt er hier und nicht
   in `aufEignung()`.
3. **Folgen gehen in beide Richtungen** (L7): keine Narben ohne Wachstum.

### Verschoben, nicht gestrichen

**L5 (Dynamic Highlight Mode)** und **F1 (Football-Down-Karte)** bleiben im Rückstand. Beide sind
billig und rho-neutral, beide wirken auf Disziplinen, die bereits bestehen. Sie kommen nach C1 oder
nach dem B0′-Ausgang „ja, wegen der Inszenierung" — dann aber mit D's eigener Auflage: `big` ist
kein Dramatikmaß, ein echtes braucht ein kontinuierliches Signal in vier Chassis.

---

## 5. Aufwand, Risiko, Nutzen

| | Aufwand | rho-Risiko | Messrisiko | Nutzen (A/B/C/D) | Abbruchpunkt |
|---|---|---|---|---|---|
| **M0** Messstand | klein, 1 Datenrunde | **null** — keine Mechanik | **senkt es** (das ist der Zweck) | — / — / — / **entscheidend** | Spannweite schrumpft nicht → Schranke auf die Arena nicht anwendbar, zurück an Chris |
| **A3** Saat | klein, 1 PR | gering | gering, `seedZuZahl()` prüfen | **A** / **B stark** / — / — | Saat-Kollaps nicht behebbar → eskalieren |
| **M1** Aufstellungspreis | klein, 1 Messrunde | **null** — Sondenpfad | mittel, hängt an M0 | — / — / — / **entscheidend** | drei Tore, s. 4 |
| **B0′** Drehbuch | klein, 1 Nachmittag | **null** — kein Motor | **null** | **A** / **B** / — / — | „nein" → Präsentationsthesen falsifiziert |
| **A1.0** Sonde A–E+P | klein, 1 Messrunde | **null** — nichts gemergt | mittel | — / — / — / **entscheidend** | nichts trägt → Ursache liegt woanders |
| **P1** PRD Football | klein–mittel, 1 PR | gering, Erwartungswert bleibt | gering, klare Diagnose | — / — / — / **stark** | Verlässlichkeit steigt nicht → PRD-These widerlegt |
| **C1** Aufstellung | mittel, 2–3 PRs | **mittel — der größte Posten** | mittel | **A** / **B stark** / **C stark** / offen | kaderfeste Verschlechterung → zurück |
| **K1** Portrait-Karte | mittel, 1–2 PRs | gering, beweisbar neutral | gering | — / **B** / **C** / — | — |
| **A1.1** Rundenpilot | **groß** | gering (neuer Motor) | **hoch** | **A** / **B** / **C stark** / offen | Abnahmezahl unter M0-Spannweite → Widerlegung |
| **S1** Skills/Items | **groß**, eigener Strang | mittel | mittel | **A** / **B** / **C** / offen | Karten fehlen → Beschaffung, nicht Code |

**Der teuerste Posten des Plans ist C1, und das ist beabsichtigt** — es ist der einzige, der Chris'
Kriterium B (Investition ins eigene Team) an der Wurzel trifft. **Der riskanteste ist A1.1**, und er
steht deshalb hinten. **Die drei billigsten (M0, M1, B0′) entscheiden zusammen über alles
Nachfolgende** und kosten zusammen weniger als eine Umsetzungsrunde.

---

## 6. Was nur Chris entscheiden kann

Vier Fragen. Keine blockiert M0, A3 oder B0′ — der Plan läuft an, während sie offen sind.

1. **Wenn die Arena-Spannweite auch mit fünfundzwanzig Paarungen groß bleibt: gilt die
   0,80-Schranke dort weiter?** Heute sind die Spannweiten 0,328 / 0,697 / 0,938 bei einer Schranke
   von 0,80 — die Zahl, an der die Arena gemessen wird, ist ungenauer als der Abstand, den sie messen
   soll. Entweder die Arena bekommt eine eigene, ehrlichere Abnahme (wie sie CLAUDE.md für Hockey
   schon andenkt: Star auf Rang 1, Paartreue mit Abstand), oder wir akzeptieren, dass ihre Zahl
   wenig aussagt. Beides ist vertretbar, aber es ist deine Entscheidung, nicht unsere.

2. **Darf deine Aufstellung das Ergebnis mitbestimmen — und wenn ja, wie stark?** M1 misst den
   Preis. Aber die Richtung ist Geschmack: Soll eine schlechte Aufstellung dich Spiele kosten
   können (dann ist die Entscheidung echt, und rho sinkt), oder soll sie nur formen, *wie* gewonnen
   wird (dann bleibt rho, und die Entscheidung ist schwächer)? **Ohne deine Antwort ist M1 nur eine
   Zahl ohne Schwelle.**

3. **Nimmst du an, dass Krit und Ausweichen aus Skills kommen und nicht aus Attributen?** Die Frage
   steht seit der Synthese offen und ich schließe mich ihr an — mit einer Ergänzung: die
   Perspektive, die deinem Vorschlag am nächsten kam, hat ihr eigenes bestes Gegenargument selbst
   geliefert. Dein Assassine ist in Mini-DM mechanisch **bereits gebaut**: Torment und Dexterity
   speisen dort Angriff und Tempo, ausschließlich aus bepreisten Attributen — und Mini-DM misst
   0,094, die schlechteste Zahl des Projekts. Der Effekt, den du willst, kommt trotzdem; er kommt
   über S1.

4. **Die Matrix-Erlaubnis von 05.09.:** Dein Satz „wenn dann müssten die Stats und wie sie in die
   Attribute der Diszi einfließen angepasst werden" wird im Repo bereits für den Override-Mechanismus
   beansprucht. Eine der vier Perspektiven liest ihn zusätzlich als Erlaubnis für ein **neues
   Subskill-Feld**. Das ist eine zweite, weitergehende Auslegung derselben Erlaubnis. **Deckt dein
   Satz das mit ab, oder meintest du nur die Gewichtsquelle?** Ein Agent sollte das nicht für dich
   auslegen.

---

## 7. Zusammengefasst für die Hauptsession

- **C gewinnt die Richtung, D die ersten zwei Bauplätze als C's Vorbedingung, B den Endzustand, A
  löst sich auf.** Reihenfolge: **M0 → A3 → M1 → B0′ → A1.0 → C1 → K1 → A1.1 → S1**, mit **P1**
  unabhängig daneben.
- **Die eine Änderung am A0→A3-Plan:** Vor die Messung gehört die **Messbarkeit**. Die
  Arena-Spannweiten (0,328 / 0,697 / 0,938) sind größer als jede in der Debatte erhoffte Wirkung;
  alle drei gemessenen Tempo-Kanal-Bewegungen (+0,140, −0,175, +0,062) liegen unter ihrer eigenen
  Spannweite und zeigen in verschiedene Richtungen. **B's eigenes Erfolgskriterium („Mini-DM deutlich
  über 0,50", also +0,41) liegt innerhalb Mini-DMs Spannweite von 0,697** — es wäre nach B's eigener
  Regel von Null nicht unterscheidbar.
- **Der Fund, der die Debatte entscheidet:** Die Kader-Familie führt kein `place`. **Die
  0,80-Schranke ist nie gegen eine menschliche Aufstellung geprüft worden** — gemessen wird die
  Rangtreue der motoreigenen Optimalaufstellung. C's „Schere" ist damit kein Dilemma, sondern eine
  Messaufgabe (M1), und sie ist unter einem Tag zu haben.
- **PRD wird aus A herausgelöst und auf Football gerichtet** (0,516 je Spiel bei 0,811 Saison,
  Verlässlichkeit 0,405 — die niedrigste der zwanzig). Das ist der einzige Ort im Projekt, an dem
  eine klare Diagnose auf ein passendes Werkzeug trifft, und beide Vordokumente haben sie
  nebeneinander liegen lassen, ohne sie zu verbinden.
- **B0 wird zu B0′:** Es beginnt bei der Aufstellungstafel, nicht beim Kampf. Ein Drehbuch ohne die
  Entscheidung, die den Kampf erzeugt hat, hat keinen informativen Ausgang — in keiner Richtung.
  Zufallsfrei gescriptet und beschriftet, wie der Gegencheck fordert.
- **Korrekturen an den Perspektiven:** D's „vierzehn Disziplinen ≥ 0,79" sind **dreizehn**;
  C's „Football 0,516 / 0,722" vermischt zwei verschiedene Football-Zahlen (die Saisonzahl ist
  0,811); A's Berufung auf Chris' Matrix-Satz ist eine **zweite** Auslegung einer bereits
  beanspruchten Erlaubnis und gehört zu Chris, nicht in eine Umsetzungsskizze.

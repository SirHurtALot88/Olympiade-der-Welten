# Eiskunstlauf-Duett (Paarlauf) — Recherche (08.09.)

**Reine Recherche. Keine Codeänderung an `battle-mode.engine.js`.** Alle Datei-/Zeilenangaben
sind gegen `origin/main` (Stand `b3591f1c`, nach PR #854) geprüft. Ein Scratch-Prototyp
(Abschnitt 5.2) lief gegen denselben Stand über den bestehenden, unveränderten Einstiegspunkt
`window.__arena.disziplinProbe("eiskunstlauf", …)` — keine Zeile Motorcode geändert, kein
Prototyp-Skript Teil dieses Commits.

## 0. Ergebnis vorab

Chris, wörtlich: „ist es möglich bei Eiskunstlauf sie spieler wenn es die gerade zahl ist
möglich im Duett oder so laufen zu lassen dass sie figuren machen etc?"

Ja, machbar — und die Messung in Abschnitt 5 zeigt sogar, dass die naheliegendste Umsetzung
(zwei Werte einfach mitteln oder das Minimum nehmen) genau die Rangtreue beschädigen würde, die
gestern erst über die 0,85-Zielmarke gehoben wurde, während eine zweite, fast ebenso einfache
Variante sie unangetastet lässt. Konkrete Empfehlung:

1. **Auslöser: automatisch, nicht manager-wählbar.** Eiskunstlauf stellt heute so gut wie immer
   genau 6 Läufer je Seite — eine feste Motorkonstante, keine gewürfelte Kadergröße (Abschnitt 1).
   6 ist gerade; Chris' Bedingung ist also der Normalfall, nicht die Ausnahme. Ein manueller
   Schalter würde eine Entscheidung verlangen, die es in praktisch jedem Spiel ohnehin nur in
   eine Richtung geben kann. Der ungerade Sonderfall (ein Manager stellt bewusst nur 5 auf, oder
   der Kader ist zu klein) bleibt einfach: die überzählige Person läuft solo weiter, keine
   Fehlerbehandlung nötig.
2. **Verschmelzung: NICHT Durchschnitt, NICHT Minimum — ein eigen-gewichteter Mix (≈80/20).**
   Jede Person behält ihre bestehende, unveränderte Solo-Punktzahl als Basis und nimmt zusätzlich
   einen kleinen Anteil der Partnerleistung mit in die eigene Wertung. Der ehrgeizigere, „echte"
   Weg — unterschiedliche Rollen wie beim realen Paarlauf (Heber/Flyer, Kraft vs. Grazie) — würde
   eine neue Attributschiene (Power/Health) in ein Rezept ziehen, das heute komplett ohne Kraft
   auskommt (Abschnitt 4.3) und ist deshalb bewusst NICHT Teil dieser Empfehlung.
3. **Solo wird ERSETZT, nicht parallel gefahren.** Anders als bei Mini-DMs 4-Team-FFA (das
   parallel bleiben musste, weil die Grundmechanik dort mit rho 0,094 bereits durchgefallen war)
   ist Eiskunstlaufs Solo-Rangtreue seit gestern komfortabel über der Schranke (0,875). Die
   Messung in Abschnitt 5 zeigt, dass die empfohlene Verschmelzung diesen Puffer nicht auffrisst
   — deshalb kann Duett der Standardpfad werden, sobald die Feldgröße gerade ist, statt eine
   zweite, separat gemessene Struktur danebenzustellen.
4. **Visuell: mit Bordmitteln machbar, kein neues Sprite-Rig nötig.** Das exakte Vorbild dafür
   existiert bereits im selben Chassis — Gewichthebens „zwei Heber Kopf an Kopf" (Abschnitt 6).
5. **Kollisionsrisiko:** `bauBuehne()`/`zeichneBuehne()` bedienen NEUN Disziplinen aus einer
   Funktion. Jede Umsetzung muss über einen eigenen Flag (`art.duett`, analog zu `art.heben`/
   `art.duell`) exklusiv auf `buehneDisc==="eiskunstlauf"` gaten und gegen alle acht
   Geschwister-Disziplinen bit-identisch geprüft werden — genau das Muster aus PR #850/#854
   (Abschnitt 7).

---

## 1. Ist-Zustand: wie Eiskunstlauf heute seine Teilnehmerliste baut

`BUEHNE_ART.eiskunstlauf` (`public/mockups/battle-mode.engine.js:10674-10707`):

```
label:"Eiskunstlauf", jeSeite:6, rundenN:12, rundenDauer:0.425,
failAbzug:0.35, failWort:"stürzt", erfolgWort:"landet sauber",
rezept:{ GRUNDLAGE, SPITZENMOMENT, TECHNIK, PUBLIKUM, NERVEN, AUSDAUER, WAGNIS }
```

`jeSeite:6` ist die entscheidende Zahl für die „gerade Zahl"-Frage — und sie ist, anders als man
vom Wort „Kadergröße" vielleicht erwartet, **keine gewürfelte Feldgröße** wie bei den 17
Feldspiel-Disziplinen (dort 2/4/6 über `buildSeasonPlayerCountByDiscipline`). Sie ist eine feste
Motorkonstante, identisch für alle neun Bühnen-Geschwister (`jeSeite:6` bei jedem Eintrag in
`BUEHNE_ART`, geprüft Zeile für Zeile).

`bauBuehne()` (`:10958-11048`) baut die tatsächliche Startliste so:

```js
const art=BB(), n=art.jeSeite, R=art.rezept;
const gesetzt=inDisc(buehneDisc);                                   // manuell zugewiesen
const ersatz=[...SQUAD].sort((a,b)=>(b.d[buehneDisc]||0)-(a.d[buehneDisc]||0)).slice(0,n);
const mine=(gesetzt.length?gesetzt:ersatz).slice(0,n);
```

Drei Fälle, damit die Frage „wann ist es gerade?" ehrlich beantwortet ist:

| Fall | `mine.length` | Gerade? |
|---|---:|---|
| Kein Manager-Eingriff (Normalfall) — `ersatz` greift, immer exakt `n=6` | 6 | immer |
| Manager stellt explizit **genau 6** auf (`gesetzt.length===6`) | 6 | immer |
| Manager stellt explizit eine **andere** Zahl auf (z. B. 5, weil nur 5 Kader-Mitglieder für
  Eiskunstlauf vorgesehen sind oder verletzungsbedingt fehlen) | `gesetzt.length` (kann `<6` sein,
  `slice(0,6)` deckelt nur nach oben) | nur falls die Zahl selbst gerade ist |

**Praktische Konsequenz:** In der weit überwiegenden Zahl der Spiele — jedes Mal, wenn niemand
eine unvollständige Eiskunstlauf-Aufstellung setzt — ist die Feldgröße bereits gerade, weil sie
eine feste Sechs ist. Chris' Bedingung „wenn es die gerade Zahl ist" trifft also so gut wie immer
zu; der ungerade Fall ist eine seltene, selbstgemachte Ausnahme (bewusst unvollständige
Aufstellung), keine natürliche Kaderschwankung. Das ist der zentrale Fund für Abschnitt 2.

Die sechs Teilnehmer laufen danach als **sechs unabhängige Solo-Auftritte** (`:11030-11045`):
jeder rechnet all `art.rundenN` (=12) Durchgänge für sich, gegen dieselbe Erfolgsformel
(`erfolg=Math.min(0.94,0.15+L.TECHNIK*0.0055+L.NERVEN*0.0035)`), ohne dass ein zweiter Läufer
je in die Rechnung eines anderen eingeht. Ergebnis: `L.summe` (Summe der 12 Runden-Punkte),
gelesen von `M.wert()` (`:21017`, `wert:()=>{... o[u.n]=u.summe ...}`). Der Team-Gesamtscore ist
schlicht die Summe aller sechs `summe`-Werte je Seite (`:11612-11613`) — das ändert sich mit
einer Duett-Fusion (Abschnitt 3) an keiner Stelle, weil die Summe über alle sechs Personen exakt
dieselbe bleibt, egal ob sie einzeln oder paarweise entstanden ist.

**Wichtig für Abschnitt 3:** `L.eig` (die Eignungszahl, gegen die rho gemessen wird) entsteht
VOR und UNABHÄNGIG von der Rundenberechnung (`:11018`, `p.d[buehneDisc]+engP+breitP`) — sie
bleibt für jede hier untersuchte Fusionsvariante unverändert. Nur `L.summe` (die tatsächliche
Spielleistung, die Y-Achse von rho) ist der Ort, an dem ein Duett überhaupt ansetzen kann, ohne
das schon kalibrierte Rezept (`R`, `MATRIX`) anzufassen.

---

## 2. Auslöser: automatisch, aus der tatsächlichen Feldgröße — nicht manager-wählbar

Zwei Optionen standen zur Wahl:

**A — Automatisch bei gerader tatsächlicher Feldgröße.** Kein neuer Schalter: sobald
`mine.length` (Abschnitt 1) gerade ist, paart der Motor die Läufer; ist sie ungerade, bleibt die
letzte Person solo (dieselbe Regel wie bei jeder ungerade-Rest-Situation in diesem Projekt, z. B.
Gleichstand-Teilung in `mini-dm-4-team-ffa-recherche-06-09.md` Abschnitt 4.3).

**B — Manager wählt Duett ODER Solo, unabhängig von der Kadergröße** (wie Fokus-Doppeln in
Basketball, `basketball-doppeln-taktik-pause-recherche-06-09.md` Abschnitt 1.2: derselbe
Fokus-Mechanismus ist heute schon jederzeit manuell an-/abwählbar).

**Empfehlung: A.** Drei Gründe, die zusammen eindeutig auf Automatik zeigen:

1. **Es gibt praktisch nichts zu wählen.** Abschnitt 1 zeigt: `jeSeite` ist fest bei 6, eine feste
   Motorkonstante über alle neun Bühnen-Geschwister. Ohne bewusst unvollständige Aufstellung ist
   die Feldgröße in JEDEM Spiel gerade. Ein manueller Schalter würde eine UI-Entscheidung
   verlangen, die praktisch immer „ja" beantwortet würde — Aufwand ohne Nutzen. Das unterscheidet
   sich fundamental von Fokus-Doppeln, wo die Wahl (wen doppeln?) bei jedem Spiel eine ECHTE,
   inhaltlich unterschiedliche Antwort hat.
2. **Chris' eigene Formulierung ist eine Bedingung, kein Wunsch nach einer Einstellung.** „Wenn es
   die gerade Zahl ist" beschreibt einen Zustand, der automatisch eintritt oder nicht — nicht „ich
   möchte wählen können". Das ist dasselbe Formulierungsmuster wie bei den bereits automatisch
   gelösten Fällen in diesem Projekt (z. B. die Formkarten-Ziehung selbst, keine manuelle Wahl).
3. **Weniger Fläche für den in der Kaderauffüllen-Warnung (CLAUDE.md) beschriebenen
   Klasse-Fehler**: ein Schalter, den ein Manager nie umlegt (weil die Antwort immer „gerade" ist),
   ist ungetesteter Code, der beim seltenen ungeraden Sonderfall zum ersten Mal in Produktion läuft.
   Reine Automatik hat diesen Pfad gar nicht — sie behandelt gerade/ungerade als denselben Ast mit
   einem Rest, nicht als zwei UI-Zustände.

**Ergänzung, kein Widerspruch zu A:** Nichts spricht dagegen, in einer SPÄTEREN Runde einen
Fokus-Doppeln-artigen Override zu ergänzen („dieses Duo lieber wieder solo laufen lassen") — das
ist aber eine eigenständige, kleine Zusatzfunktion für eine spätere Iteration, kein Teil des hier
angefragten Kernmechanismus, und sollte nicht die erste Umsetzung aufhalten.

---

## 3. Paarungsregel: benachbart nach Eignung, nicht zufällig

Wenn `ersatz` greift (Abschnitt 1, der Normalfall), kommt die Sechserliste bereits **absteigend
nach `p.d[buehneDisc]` sortiert** aus `bauBuehne()`. Benachbarte Paarung (Platz 1+2, 3+4, 5+6)
ist damit ohne zusätzlichen Code eine **assortative Paarung** — ähnlich starke Läufer zusammen,
nicht Zufall. Das ist zugleich die realistischere Wahl: echte Paarlauf-Trainer setzen selten den
stärksten Einzelläufer mit dem schwächsten zusammen, sie bilden Paare aus vergleichbarem Niveau.
Für den `gesetzt`-Fall (Manager stellt explizit auf) ist die Reihenfolge nicht garantiert sortiert
— die Umsetzung sollte deshalb VOR der Paarung einmal nach `eig` (oder `p.d[buehneDisc]`) sortieren,
damit dieselbe assortative Regel unabhängig vom Aufstellungsweg gilt. Das ist die Paarungsregel,
die dem Prototyp in Abschnitt 5 zugrunde liegt.

---

## 4. Attribut-Verschmelzung: was mit zwei Läufern in eine gemeinsame Wertung geht

### 4.1 Drei durchdachte, aber zwei davon verworfene Optionen

| Option | Idee | Befund |
|---|---|---|
| **Durchschnitt** | `(summeA+summeB)/2`, beiden zugewiesen | Rangtreue-Schaden real und groß (Abschnitt 5.2) — verworfen |
| **Minimum** | `min(summeA,summeB)`, beiden zugewiesen — „das schwächere Glied entscheidet", wie bei echten synchronen Elementen | Noch größerer Schaden, unterschreitet in der schlechtesten Kader-Variante sogar die 0,80-Schranke (Abschnitt 5.2) — verworfen |
| **Eigen-gewichteter Mix** (empfohlen) | Jede Person behält den Löwenanteil der eigenen Leistung (`p·summeA+(1-p)·summeB`, `p≈0,73-0,80`), nimmt nur einen kleinen Anteil der Partnerleistung mit | Rangtreue bleibt unverändert bis leicht besser (Abschnitt 5.2) |

**Warum Durchschnitt/Minimum trotz realistischer Anmutung verworfen werden:** Beide klingen wie
die naheliegende Paarlauf-Simulation — aber beide zerstören exakt das Signal, an dem rho hängt.
Ein starker Läufer, der zufällig mit einem schwachen gepaart wird, verliert bei Durchschnitt die
Hälfte, bei Minimum praktisch die gesamte eigene Leistung aus seiner Wertung — das ist keine
kleine Verwässerung, sondern ein struktureller Bruch zwischen `eig` (was die Person kann) und
`wert` (was ihr im Spiel angerechnet wird), und genau diesen Bruch misst rho.

### 4.2 Die „echte" Idee — asymmetrische Paarlauf-Rollen — bewusst zurückgestellt

Chris' Formulierung „Figuren machen" erinnert an echte Paarlauf-Elemente: Hebefiguren,
Todesspirale, Wurfsprünge — jedes davon hat im echten Sport tatsächlich zwei unterschiedliche
Rollen (Kraft/Kontrolle beim Hebenden, Flexibilität/Präsentation bei der gehobenen Person). Das
wäre die inhaltlich reichste Umsetzung — und ist genau deshalb NICHT Teil dieser Empfehlung:

`BASIS_JE_DISC.eiskunstlauf` (`:3501`, Kommentar bei `BUEHNE_ART.eiskunstlauf:10675-10676`) trägt
**ausschließlich** `charisma, dexterity, spirit, awareness, speed, intelligence, determination` —
kein `power`, kein `health`, kein `stamina`. Eine Hebefigur, die eine echte „Kraft"-Rolle
bräuchte, zöge zwangsläufig eine neue Attributschiene in ein Rezept, das heute bewusst ohne
Kraftkomponente auskommt (Eiskunstlauf ist im MATRIX-Vergleich die charisma-lastigste der vier
Auftritts-Disziplinen). Das ist eine echte Rezeptänderung — genau die Kategorie Änderung, die laut
CLAUDE.md eine eigene Kalibrierrunde mit Vorher/Nachher-Messung braucht, keine, die man nebenbei
in einer Duett-Recherche mitentscheidet. **Empfehlung: für eine spätere, eigene Runde vormerken**,
nicht in den ersten Wurf packen — der symmetrische Mix aus 4.1 liefert schon jetzt „zwei laufen
zusammen, gemeinsame Wertung", ohne dieses Risiko einzugehen.

---

## 5. Rangtreue-Hebel: gemessen, nicht angenommen

### 5.1 Baseline

```
node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf
```

```
eiskunstlauf   buehne   12   rho je Spiel 0,875   Spannweite 0,075   rho Saison 0,965   Spannweite 0,049   bestanden
```

Bestätigt exakt den in `fechten-eiskunstlauf-breaking-politur-recherche-07-09.md` dokumentierten
Nach-PR-#854-Stand — der Puffer über der 0,80-Schranke ist real und aktuell.

### 5.2 Prototyp: vier Fusionsarten gegen dieselbe Kaderfamilie

**Methodik.** Ein Scratch-Skript rief ausschließlich den bestehenden, unveränderten
`window.__arena.disziplinProbe("eiskunstlauf",{n,kaderFamilie})` auf (48 Spiele × 5 echte
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`, dieselbe Kaderfamilie wie die
offizielle Abnahme) und paarte die zurückgegebenen Roh-Paare `{eig,wert}` **außerhalb des
Motors**, benachbart in der (bereits stärke-sortierten) Sechserliste je Seite, gemäß Abschnitt 3.
`rho()`/`median()`/`spannweite()` sind unverändert aus `scripts/lib/rangtreue-messung.mjs`
importiert — dieselbe Formel wie die offizielle Abnahme. Kein Motorcode geändert, kein Skript
Teil dieses Commits.

| Fusion | rho/Spiel (Median) | schlechteste Kader-Variante | Spannweite | rho/Saison (Median) |
|---|---:|---:|---:|---:|
| Solo (unverändert, Referenz) | 0,881 | 0,863 | 0,073 | 0,972 |
| Durchschnitt | 0,826 | **0,666** | 0,192 | 0,834 |
| Minimum | **0,792** | **0,565** | 0,271 | 0,834 |
| Mix 90/10 | 0,898 | 0,864 | 0,084 | 0,965 |
| **Mix 80/20** | **0,903** | **0,859** | 0,090 | 0,958 |
| Mix 73/27 | 0,900 | 0,843 | 0,101 | 0,944 |
| Mix 60/40 | 0,879 | **0,783** | 0,138 | 0,902 |

(„Mix p/(100-p)" = `p·eigene Leistung+(1-p)·Partnerleistung`, symmetrisch für beide Personen des
Duos angewendet.)

**Lesart:**

- **Durchschnitt und Minimum sind beide keine sichere Wahl.** Über den Median hinweg liegen sie
  zwar noch über 0,80 (Durchschnitt) bzw. knapp darunter (Minimum) — aber die **schlechteste** der
  fünf Kader-Varianten fällt bei Durchschnitt auf 0,666, bei Minimum auf 0,565: beide reißen die
  Schranke in mindestens einer realen Team-Paarung deutlich. Die Saisonzahl fällt in beiden Fällen
  von 0,972 auf 0,834 — ein echter Validitätsschaden (CLAUDE.md: „Sind beide Spalten niedrig,
  belohnt die Mechanik das Falsche"), nicht nur mehr Kaderrauschen. **Chris' eigene Erwartung**
  („das schwächere Glied entscheidet, wie im echten Paarlauf") ist sportlich zutreffend, aber
  genau die Eigenschaft, die dem Ranking-Signal am meisten schadet.
- **Ab einem Partneranteil von 40 % (Mix 60/40) kippt die schlechteste Variante bereits unter
  0,80** (0,783) — das markiert ungefähr die Grenze, ab der ein Duett-Bonus zu groß wird.
- **Mix 80/20 ist der Sweet Spot in dieser Messung:** höchster Median-rho/Spiel aller sieben
  Varianten (0,903, sogar leicht ÜBER der Solo-Referenz von 0,881), schlechteste Variante bei
  0,859 — komfortabel über der Schranke —, Saisonzahl bei 0,958 (nur 0,014 unter der
  Solo-Referenz). Mix 90/10 und 73/27 liegen nah dran und sind ebenfalls sicher; 80/20 hat davon
  die beste Kombination aus Median und Streuung.
- **Warum ein kleiner Partneranteil rho nicht schadet, sondern leicht hilft:** ein 20-%-Zuschlag
  aus der Partnerleistung verhält sich wie ein zusätzlicher, korrelierter Störterm — er glättet
  eher zufällige Ausreißer (ein einzelner schlechter Durchgang wird leicht abgefedert), ohne das
  Grundverhältnis „stärkere Person bekommt höheren Wert" zu untergraben, weil 80 % der eigenen
  Punktzahl dominant bleiben.

**Paartreue nach Abstand** (dieselbe Idee wie CLAUDE.md Abschnitt „Was rho drückt"): bei Solo
werden Paare mit ≥15 Eignungspunkten Abstand zu 97,9 % richtig geordnet, bei Mix 80/20 zu 98,4 %
— unverändert exzellent. Enge Paare (<2 Punkte Abstand) liegen bei allen Varianten zwischen 54,6 %
und 61,5 % — dort dominiert ohnehin das Formkarten-/Zufallsrauschen, wie CLAUDE.md für jede
Disziplin beschreibt; keine der Fusionsarten verschlechtert diesen Bereich spürbar zusätzlich.

### 5.3 Vorbehalt

Das ist ein Scratch-Prototyp außerhalb des Motors, keine Implementierung. Er bestätigt die
RICHTUNG (kleiner Partneranteil sicher, große Anteile riskant) mit echten Kaderdaten und der
offiziellen rho-Formel — er ersetzt aber nicht die reguläre Abnahme
(`scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf` bzw. eine künftige Kaderfamilien-Variante,
die den Motor selbst paart), sobald die Fusion tatsächlich in `bauBuehne()` eingebaut ist — schon
weil eine echte Umsetzung zusätzlich die visuelle/HUD-Seite berührt (Abschnitt 6), die dieser
Prototyp gar nicht anfasst.

---

## 6. Visuelle Identität: mit Bordmitteln machbar

Chris will erkennbar unterschiedliche Disziplinen (derselbe Wunsch, der Breaking/Eiskunstlauf am
07.09. schon die Waffenebene weggenommen hat, `fechten-eiskunstlauf-breaking-politur-recherche-07-09.md`
Abschnitt 3.2). Die gute Nachricht: **das exakte Vorbild für „zwei Figuren, die zusammen etwas
zeigen" existiert bereits im selben Chassis.**

`zeichneHeben()` (`:11862-11936`, Gewichtheben) zeigt „ZWEI HEBER MITTIG, Kopf an Kopf statt in
Reihen übereinander" (Kommentar `:11886-11887`) — zwei `zeichneSprite(ctx,u,x,y,true)`-Aufrufe
mit eng benachbarten x-Positionen, PLUS ein von Hand gezeichnetes gemeinsames Requisit (die
Hantel, reine Canvas-Primitiven, „keine neue Sprite-Pipeline", `:11917-11934`). Das ist exakt die
Bauanleitung für eine Duett-Darstellung:

- **Ohne neue Assets machbar:** zwei `zeichneSprite()`-Aufrufe pro Duo, x-Positionen eng
  zusammengerückt statt über die volle Zeilenbreite verteilt (heutiges Verhalten,
  `:11653-11662`: `x=90+(W-180)*(i/(g.length-1))`, gleichmäßig über die ganze Breite — für ein
  Duo stattdessen ein enger gemeinsamer x-Bereich je Paar). `zeichneSprite()` kennt bereits einen
  „shoot"-Pose-Parameter (der vierte Parameter `feldspiel`, s. Kommentar bei Gewichtheben
  `:11895-11903`) — dieselbe Pose ließe sich für eine „Arme hoch"-Haltung beider Duett-Partner
  wiederverwenden, ohne ein neues Rig zu zeichnen.
- **Bereits vorhandene Infrastruktur für einen gemeinsamen Erfolgsmoment:** `schwebe()`/`floats`
  (`:13885`) zeigt schon heute Text wie „PUNKTESIEG!" an einen `_teilnehmer` gebunden
  (`:11525-11526`). Ein Duett-Erfolg („SYNCHRON!" o. Ä.) ließe sich als zwei an beide Partner-IDs
  gebundene Floats ausgeben — keine neue Text-/Partikel-Pipeline nötig.
- **Was NEUE Assets bräuchte:** eine echte physische Hebefigur-Pose (eine Figur sichtbar über der
  anderen, mit Armkontakt) ist mit dem heutigen Sprite-Baukasten (einzelne, unabhängig
  positionierte Figuren, kein Skelett-Rigging zwischen zwei Einheiten) NICHT abbildbar — genau wie
  die Hantel bei Gewichtheben eine reine Primitiven-Requisite bleibt statt einer echten
  Trage-Animation. Für den ersten Wurf reicht das nicht — Nähe, Synchronität und ein gemeinsamer
  Erfolgs-Callout tragen die „das ist jetzt ein Duett"-Erzählung bereits weit, ohne neue Kunst.
- **EFFEKT_ARTEN/`zeichneEffekte`** (`:2118-2167`, `:18587`) sind elementare Charakter-Auren
  (Feuer/Eis/Magie), keine choreografischen Effekte — für ein Duett nicht direkt einschlägig,
  höchstens als spätere Idee für einen gemeinsamen „Glanz"-Moment am Kür-Höhepunkt.

**Empfehlung:** MVP-Visualisierung ohne neue Assets (enge Positionierung + gemeinsamer
Erfolgs-Float + ggf. gemeinsames Namens-Label „Duett: A & B" über dem Paar). Eine echte
Hebefigur-Pose ist eine spätere, eigenständige Asset-/Rigging-Aufgabe, kein Blocker für die
Kernmechanik.

---

## 7. Kollisionsrisiko: `bauBuehne()`/`zeichneBuehne()` teilen sich neun Disziplinen

`BUEHNE_ART` hat neun Einträge — gewichtheben (`heben:true`), speed-schach/i-spy/tennis/fechten
(`duell:true`), und showcase/eiskunstlauf/breaking/wettessen (keins von beidem, der „normale"
Auftritts-Pfad, den Eiskunstlauf heute läuft). Genau dieser geteilte Code hat dem Projekt laut
`CLAUDE.md` bereits zwei Vorfälle eingebracht (PR #820/#840), seither wird jede Bühnen-Änderung
gegen alle acht Geschwister-Disziplinen bit-identisch geprüft (PR #850/#854 als jüngste Beispiele).

**Für die Duett-Umsetzung heißt das konkret:**

- Ein neuer Flag `art.duett` (analog zu `art.heben`/`art.duell`) MUSS die Paarungs-/
  Fusionslogik exklusiv auf `buehneDisc==="eiskunstlauf"` (bzw. auf Disziplinen mit gesetztem
  Flag) begrenzen — showcase, breaking und wettessen laufen sonst weiterhin exakt den heutigen
  Sechs-Solo-Pfad, unverändert.
- Die drei Stellen, die den `heben`/`duell`-Sonderfall bereits kennen und mit `if(art.heben){…}`/
  `if(art.duell){…}` vor dem generischen Pfad abzweigen (`setz()` in `bauBuehne()` `:11029` und
  `:11057-11058`; `zeichneBuehne()` `:11649-11650`; die Score-Anzeige `:11601-11613`), sind genau
  die Stellen, an denen ein `art.duett`-Zweig ergänzt werden müsste — dasselbe Muster, keine neue
  Architektur.
- **Vor jedem Merge:** ein Spiegeltest wie `scripts/miss-arena-buehne-spiegel.mjs`
  (Vorbild aus `bauBuehne()`s eigenem Kommentar, `:10988-10993`) gegen alle acht
  Geschwister-Disziplinen, um zu belegen, dass ein Eiskunstlauf-spezifischer Flag deren
  Ausgabe bit-identisch lässt — dieselbe Disziplin, mit der PR #850/#854 den letzten
  Rundendauer-Umbau abgesichert haben.

---

## 8. Empfehlung

1. **Auslöser:** automatisch, sobald die tatsächliche Eiskunstlauf-Feldgröße (`mine.length` in
   `bauBuehne()`) gerade ist — kein Manager-Schalter (Abschnitt 2). Ungerader Rest bleibt solo.
2. **Paarung:** benachbart in der nach Eignung sortierten Sechserliste (Platz 1+2, 3+4, 5+6) —
   assortativ, realistisch, ohne zusätzlichen Sortieraufwand im Normalfall (Abschnitt 3).
3. **Fusion:** eigen-gewichteter Mix, **80 % eigene Leistung + 20 % Partnerleistung**, angewendet
   auf `summe` NACH der bestehenden, unveränderten Rundenberechnung — `eig`, `MATRIX` und
   `rezept` bleiben unangetastet (Abschnitt 4.1). Durchschnitt und Minimum sind gemessen
   verworfen (Abschnitt 5.2); echte asymmetrische Paarlauf-Rollen (Heber/Flyer mit
   Kraft-Attribut) sind eine spätere, eigene Kalibrierrunde, kein Teil dieses ersten Wurfs
   (Abschnitt 4.2).
4. **Solo vs. parallel:** Duett ERSETZT Solo im geraden Fall (kein zweites, separat gemessenes
   Format wie bei Mini-DM) — tragbar, weil die Messung in Abschnitt 5.2 zeigt, dass der 80/20-Mix
   die Schranke nicht gefährdet, anders als bei Mini-DMs bereits durchgefallener Grundmechanik.
5. **Visuell:** MVP ohne neue Assets — enge Paarpositionierung plus gemeinsamer Erfolgs-Float,
   nach dem Vorbild von `zeichneHeben()` (Abschnitt 6). Eine echte Hebefigur-Pose ist ein
   späteres Asset-Projekt.
6. **Vor jedem Merge:** eigener `art.duett`-Flag, exklusiv auf Eiskunstlauf begrenzt, plus
   Geschwister-Spiegeltest gegen die anderen acht Bühnen-Disziplinen UND eine offizielle
   `miss-alle-disziplinen.mjs 24 eiskunstlauf`-Nachmessung gegen die reale Implementierung
   (Abschnitt 5.3, 7) — der Scratch-Prototyp dieser Recherche ersetzt diese Abnahme nicht.

---

## Anhang: Quellen und Werkzeuge

**Selbst gelesen** (dieser Stand, `b3591f1c`):
- `public/mockups/battle-mode.engine.js`: `BUEHNE_ART` (10598-10940, insb. `eiskunstlauf`
  10674-10707, `gewichtheben`/`heben`-Flag 10598-10656, `duell`-Flag Beispiele 11058-11066),
  `SLOTS_JE_DISC["eiskunstlauf"]` (3634-3641, die sechs Move-Slots), `BASIS_JE_DISC["eiskunstlauf"]`
  (3501), `istBuehne`/`bauBuehne` (10938-11048), `inDisc` (12478), Score-Anzeige
  (11596-11623), `zeichneBuehne`/`zeichneHeben` (11642-11936), `zeichneSprite`/`EFFEKT_ARTEN`
  (2089-2167), `EFFEKTE`/`zeichneEffekte` (18573-18587), `schwebe`/`floats` (13885, 11519-11526),
  `disziplinProbe` (22128-22205), `MOTOREN.eiskunstlauf.wert()` (21017).
- `data/generated/kaderfamilie-live-save.json`: fünf echte Team-Paarungen, Beispielspieler mit
  vollem `d`-Objekt (alle 19 Disziplin-Eignungen), Kaderquelle für Abschnitt 5.2.
- `docs/design/fechten-eiskunstlauf-breaking-politur-recherche-07-09.md`: Vortagesstand der
  Eiskunstlauf-Rangtreue (0,792→0,875), Rezept-/MATRIX-Herkunft, Waffenebene-Entscheidung.
- `docs/design/mini-dm-4-team-ffa-recherche-06-09.md`: Vorbild für „additiv, parallel zur
  bestehenden Struktur", hier bewusst NICHT übernommen (Abschnitt 8, Punkt 4) — mit Begründung,
  warum der Fall anders liegt.
- `docs/design/basketball-doppeln-taktik-pause-recherche-06-09.md`: Vorbild für einen
  manager-wählbaren Eingriff (Fokus-Doppeln) — hier bewusst NICHT übernommen (Abschnitt 2) — mit
  Begründung, warum der Fall anders liegt.
- `CLAUDE.md`: Abnahme-Schranke (rho je Spiel > 0,80, angestrebt 0,85), „mehr Ereignisse helfen
  fast nie", Paar-mit-Abstand-Lesart, PR #820/#840-Präzedenzfall für geteilten Bühnen-Code.

**Eigene Messung dieser Runde:**
- `node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf` — Baseline (Abschnitt 5.1).
- Scratch-Prototyp (nicht Teil dieses Commits, s. Abschnitt 5.2 Methodik): vier Fusionsarten ×
  fünf Kader-Varianten × 48 Spiele, über den unveränderten `disziplinProbe`-Einstiegspunkt,
  ausgewertet mit den offiziellen `rho()`/`median()`/`spannweite()`-Funktionen aus
  `scripts/lib/rangtreue-messung.mjs`.

**Nicht geprüft / bewusst offengelassen:**
- Ob eine echte Motor-Implementierung (statt der Nachbildung außerhalb des Motors) exakt dieselben
  Zahlen liefert — der Prototyp arbeitet mit denselben Rohdaten, aber eine reale Umsetzung in
  `bauBuehne()` sollte trotzdem eigenständig nachgemessen werden (Abschnitt 5.3, 8.6).
- Wie ein Duett-Erfolg in der Wertungstabelle (`renderWertungTabelle`) und im Boxscore einzeln
  ausgewiesen wird — reine Anzeigefrage, außerhalb des Rangtreue-Fokus dieser Recherche.
- Ob/wie eine spätere asymmetrische Rollen-Variante (Abschnitt 4.2) das MATRIX-Gewichtsschema
  verändern müsste — bewusst für eine eigene, spätere Kalibrierrunde zurückgestellt.

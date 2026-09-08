# Opus-Synthese 08.09. — Eiskunstlauf-Duett (#856) und Breaking-Folter/Survive (#855)

Reine Analyse. **Keine Zeile Produktionscode geändert.** Dieser PR trägt genau diese Datei.

Stand: `origin/main` = `dd980ef1` (nach #855 und #856). Eigener Worktree
(`/tmp/wt-opus-synthese`), nicht der geteilte Arbeitsbaum. Beide gemergten Recherchen messen
gegen `b3591f1c`; `git diff b3591f1c dd980ef1 -- public/mockups/battle-mode.engine.js
lib/lineups/matchday-slot-roles.ts` ist **leer** — der Code, über den beide reden, ist seit ihrer
Messung unverändert, alle Zeilenangaben unten gelten für beide Stände.

**Was hier nachgeprüft ist und was nicht.** Nachgeprüft ist alles Code-Seitige: gelesen,
verglichen, gegriffen (Fundstellen im Anhang). **Nicht** nachgemessen sind die rho-Zahlen beider
Recherchen — `scripts/miss-alle-disziplinen.mjs` startet in dieser Umgebung zwar Chromium, die
Mockup-Seite stürzt aber beim Laden ab (`page.goto: Page crashed`, wiederholt). Die Zahlen 0,875
(Eiskunstlauf) und 0,869 (Breaking) sind hier also **übernommen**, nicht bestätigt; die
Kohärenz-Befunde unten hängen an keiner davon.

---

## 0. Die fünf Sätze vorab

1. **Breakings Zwei-Dateien-Behauptung stimmt — und ist sogar zu schwach formuliert.**
   `lib/lineups/matchday-slot-roles.ts` ist nicht nur „Produktionscode, der die Lineup-Oberfläche
   speist", sondern der **numerische** Rollenkern: das `focus`-Paar jeder Rolle erzeugt über
   `resolveThemeFocus()`/`buildInitialDelta()` das `slotWeightProfile`, gegen das
   `scripts/pruefe-slot-invariante.ts` mit 0,2 Pp Toleranz prüft. Nur `label` und `description`
   dort anfassen ist deshalb keine Stilregel, sondern eine harte Bedingung.
2. **Die beiden Dateien weichen HEUTE schon voneinander ab — in genau einem der Felder, die
   „byte-identisch bleiben" sollen.** `finaleset` trägt im Motor `klein:"stamina"`, in der
   Produktion `focus:["power","torment"]`. Beide Felder sind numerisch wirksam. Eine
   Umsetzungsrunde, die „beim Umbenennen gleich mal angleicht", ändert stillschweigend entweder
   den Trait-Aufschlag im Motor oder die Slot-Gewichte im Spiel.
3. **`breaking.tsx` ist vollständig unabhängig von den sechs Move-Kanälen** — nachgeprüft, nicht
   vermutet: null Treffer für `slot`/`role`/`Move` in allen 187 Zeilen. Es rechnet auf
   Team-Tokens (`RT`, `laneIdx`, `finalMax`), nicht auf Spielern oder Move-Slots. Die
   Move-Umbenennung berührt es nicht.
4. **Eiskunstlaufs zentrale Prämisse trägt im Mockup, aber nicht im Spiel.** `jeSeite:6` ist
   tatsächlich eine feste Motorkonstante (alle neun Bühnen-Einträge). Die **echte** Feldgröße
   einer Saison wird jedoch je Disziplin gleichverteilt aus `{2,3,4,5,6}` gezogen — für alle
   zwanzig, nicht nur die Feldspiele. Eiskunstlauf ist damit in **zwei von fünf Saisons ungerade**
   (3 oder 5), und der Katalogwert der Disziplin ist selbst 3. „Duett ist der Normalfall, ungerade
   die selbstgemachte Ausnahme" ist die eine Aussage der Recherche, die so nicht stehen bleiben
   kann.
5. **Beide Vorhaben kollidieren an genau einer Stelle — zwei Zeilen im `zeichneBuehne()`-
   Dispatcher** (`:11649-11650`). Das ist beherrschbar, aber nicht null: Breaking zuerst mergen,
   Eiskunstlauf darauf rebasen, dann bleibt es ein Ein-Zeilen-Nachbar statt eines Konflikts.

---

## 1. Was die beiden Recherchen entschieden haben

| Recherche | Entscheidung | Zahl / Fundstelle | mein Befund |
|---|---|---|---|
| Eiskunstlauf (#856) | Auslöser **automatisch** bei gerader Feldgröße, kein Manager-Schalter | `jeSeite:6` fest | Richtung richtig, Begründung trägt nicht (Abschnitt 3.1) |
| | Paarung **benachbart** in der eignungssortierten Liste (assortativ) | `ersatz` ist bereits sortiert (`:10975`) | bestätigt |
| | Fusion **80 % eigen / 20 % Partner**, nicht Durchschnitt, nicht Minimum | 0,903 vs. 0,826 / 0,792 | Zahlen übernommen; Ansatzpunkt korrigiert (3.4) |
| | Duett **ersetzt** Solo, kein Parallelformat | Solo-Puffer 0,875 | bestätigt, unter Vorbehalt 3.1 |
| | Visuell MVP ohne neue Assets, Vorbild `zeichneHeben()` | `:11862` | bestätigt |
| Breaking (#855) | Sechs neue Move-Namen: Bruchpunkt, Standhalten, Steingesicht, Aushalten, Zermürbung, Unbroken | nur `label`/`text` | bestätigt, mit Verschärfung (2.1) |
| | Änderung in **zwei** Dateien im selben Schritt, Produktionscode zuerst | `matchday-slot-roles.ts:208-215`, `engine:3602-3609` | bestätigt, plus dritter Fundort (2.3) |
| | Neue Zeichenfunktion `zeichneBreaking()` hinter `art.cypher` | Muster `heben`/`schach` | bestätigt |
| | Rangtreue per Konstruktion neutral | Zeichencode läuft nie durch die Sonde | bestätigt (Kommentar `:11930-11934`) |

---

## 2. Kohärenz-Check Breaking

### 2.1 Die zwei Dateien: gleiche Rollen, zwei verschiedene Rechenwege — und eine echte Abweichung

Beide Listen tragen dieselben sechs `id`s in derselben Reihenfolge, dieselben Labels, dieselben
Beschreibungstexte, dieselbe `mueh`/`fatigueProfile`-Stufe. Sie sind aber **nicht** dieselbe
Datenstruktur, und der Unterschied ist der Punkt:

- **Motor** (`battle-mode.engine.js:3602-3609`): trägt sein Attributgewicht explizit als
  `profil:{…}` aus und zusätzlich `gross`/`klein`/`last`. `gross`/`klein` sind dort **nicht** nur
  Anzeige — `traitVerteilung()` (`:3804`) und die Bahn-Variante (`:3859`) verteilen den
  Trait-Aufschlag über genau dieses Paar; angezeigt werden sie zusätzlich (`:12867`, `:12992`,
  `:19128`).
- **Produktion** (`lib/lineups/matchday-slot-roles.ts:208-215`): trägt **kein** fertiges Profil.
  `roleTheme(...)` (`:281-292`) hält nur das `focus`-Paar, und `resolveThemeFocus()` (`:332-338`)
  plus `buildInitialDelta()` (`:376ff`) bauen daraus das `slotWeightProfile` — die Zahlen, gegen
  die `scripts/pruefe-slot-invariante.ts` mit 0,2 Pp Toleranz für jede Kadergröße 1..6 und alle
  zwanzig Disziplinen prüft.

Damit ist die Regel der Recherche („nur `label`/`text`, alles andere byte-identisch") nicht nur
richtig, sondern die einzige sichere Fassung. Der Fund, der in der Recherche fehlt:

| Rolle | Motor `gross`/`klein` | Produktion `focus` | gleich? |
|---|---|---|---|
| `powermove` | will / torment | ["will","torment"] | ja |
| `footwork` | health / dexterity | ["health","dexterity"] | ja |
| `freezecontrol` | health / determination | ["health","determination"] | ja |
| `musicality` | will / determination | ["will","determination"] | ja |
| `battlenerve` | torment / will | ["torment","will"] | ja |
| **`finaleset`** | **power / stamina** | **["power","torment"]** | **nein** |

Beide Dateien beschreiben `finaleset` im Fließtext als „über Power und Torment" — der Motor
widerspricht seinem eigenen Text, und sein eigenes `profil` (`torment:21,2` vor `stamina:13,5`)
gibt der Produktion recht. Das ist **kein** Auftrag für diese Runde: `klein` zu ändern verschiebt
den Trait-Aufschlag im Motor und damit `eig`, also die x-Achse jeder Rangtreue-Messung. Die
Umsetzung soll die Zeile anfassen, ohne sie anzufassen — Label tauschen, `klein:"stamina"` stehen
lassen. Wer die Angleichung will, macht sie als eigene, gemessene Runde.

### 2.2 `breaking.tsx` referenziert keine Move-Namen — nachgeprüft

`app/foundation/discipline-stage/arena/disciplines/breaking.tsx`, 187 Zeilen, null Treffer für
`slot`, `role` oder `Move`. Die Datei bekommt `DisciplineFieldProps` (`sorted`, `finalMax`, `rt`,
`laneIdx`) und zeichnet **Team**-Tokens, deren Radius aus `score/finalMax` folgt. Sie kennt weder
Spieler noch die sechs Kanäle. Die Move-Umbenennung berührt sie an keiner Stelle — die
Recherche behauptet das auch nicht, aber sie sagt es nirgends ausdrücklich, und die Frage stellt
sich beim Lesen von Abschnitt 1 sofort.

Damit steht auch die Begründung für die Zwei-Hemisphären-Abweichung in Abschnitt 3.3 der
Recherche: `breaking.tsx` ist eine Team-Ansicht mit N Teams, die Battle-Mode-Bühne ein 6-gegen-6
zweier Seiten. Das sind wirklich zwei verschiedene Bilder derselben Idee, keine Inkonsistenz.

### 2.3 Ein dritter Fundort der Labels — klein, aber der Vollständigkeit halber

`lib/player-generator/player-generator-service.ts:1099` schreibt `bestSlotLabel: bestSlot?.role.label`
in den Ausblick eines generierten Spielers (`PlayerGeneratorDraft`, `olyDataTypes.ts:883`). Der
Wert wird bei jeder Generierung neu berechnet, folgt der Umbenennung also von selbst — **aber**
`GameState.playerGeneratorDrafts` (`olyDataTypes.ts:3362`) liegt im Spielstand. In einem
bestehenden Save können also alte Entwürfe weiter „Power Move" tragen, während die
Aufstellungsoberfläche „Bruchpunkt" zeigt. Kein Blocker, keine Migration nötig — nur nichts, was
jemand später als Bug melden soll, ohne dass es hier steht.

### 2.4 Die Zeilenangaben der Breaking-Recherche stimmen nicht

Gegen denselben Commit, den sie selbst nennt (`b3591f1c`): `SLOTS_JE_DISC.breaking` steht bei
**3602**, nicht 3581; `zeichneBuehne()` bei **11642**, nicht 11538; `bodenBuehne()` bei **11625**,
nicht 11521; der Nicht-Wertungs-Kommentar bei **11930-11934**, nicht 11826-11828. Die
**benannten** Anker sind alle richtig, nur die Zahlen sind um 21 bis 104 Zeilen verschoben. Für
die Umsetzung heißt das: nach Namen greifen, nicht nach Zeile. (Die Eiskunstlauf-Recherche ist
hier sauber — `10674`, `10958`, `11642`, `3634` treffen alle exakt.)

---

## 3. Kohärenz-Check Eiskunstlauf

### 3.1 `jeSeite:6` stimmt — und beantwortet trotzdem nicht die Frage, die gestellt war

Bestätigt: `jeSeite:6` steht bei allen neun `BUEHNE_ART`-Einträgen, Eiskunstlauf bei `:10696`,
und `bauBuehne()` liest es als `n` (`:10972`). Im Mockup ist die Feldgröße wirklich fest sechs.

Im **Spiel** ist sie das nicht. `buildSeasonPlayerCountByDiscipline()`
(`lib/season/season-discipline-schedule.ts:107-131`) teilt jeder Kategorie mit genau fünf
Disziplinen eine **Permutation von [2,3,4,5,6]** zu. `lib/data/dataAdapter.ts` hat vier
Kategorien mit je fünf Disziplinen (nachgezählt: power 5, speed 5, mental 5, social 5) — der
balancierte Zweig greift also für **alle zwanzig**. Dieselbe Aussage steht als Kommentar
unabhängig im Produktionscode (`lib/resolve/battle-mode-arena-team-points.ts:433-440`): „die
tatsaechlich GEWUERFELTE Feldgroesse einer Saison liegt fuer JEDE der zwanzig Disziplinen
gleichverteilt zwischen 2 und 6". Eiskunstlauf steht in `social` (`dataAdapter.ts:70`), sein
Katalog-`playerCount` ist **3**.

Daraus folgt hart:

| Feldgröße je Saison | Wahrscheinlichkeit | was Duett dort bedeutet |
|---:|---:|---|
| 2 | 1/5 | die **ganze Seite** ist ein einziges Paar |
| 3 | 1/5 | ein Paar + ein Solo |
| 4 | 1/5 | zwei Paare |
| 5 | 1/5 | zwei Paare + ein Solo |
| 6 | 1/5 | drei Paare (der Fall, den die Recherche gemessen hat) |

**In 40 % der Saisons ist die Feldgröße ungerade**, und der „Rest läuft solo"-Zweig — in der
Recherche als seltene, selbstgemachte Ausnahme abgetan — ist dann der Normalfall neben den
Paaren. Genau der Pfad also, den Abschnitt 2 der Recherche als Argument **gegen** einen
Manager-Schalter anführt („ungetesteter Code, der beim seltenen Sonderfall zum ersten Mal in
Produktion läuft"), ist in Wahrheit ein Pfad, der in zwei von fünf Saisons läuft.

**Die Empfehlung selbst bleibt trotzdem richtig — nur mit anderer Begründung.** Automatik ist
weiterhin die bessere Wahl, weil ein Schalter, dessen Antwort von der gewürfelten Feldgröße
abhängt, dem Manager eine Entscheidung abverlangt, die er nicht beeinflussen kann. Aber der
Solo-Rest ist dann kein Randfall mehr, sondern ein gleichberechtigter zweiter Pfad, der
**mitgemessen und mitgezeichnet** werden muss.

### 3.2 Nachtrag: die beiden Seiten können unterschiedliche Parität haben

`bauBuehne()` baut Heim und Gast **nicht** symmetrisch, wenn keine Aufstellung gesetzt ist:
`mine` fällt auf `ersatz` zurück (die sechs besten, `:10975-10976`), `gegner` dagegen auf `OPP`
(`:10981-10982`). Bei gesetzter Aufstellung nimmt jede Seite ihre eigene Länge. Es ist also
möglich, dass die Heimseite fünf Läufer stellt und die Gastseite sechs. Eine Duett-Umsetzung muss
die Paarung deshalb **je Seite** bilden und darf die Parität nicht einmal für beide Seiten
entscheiden. Der Motor hat für genau diese Klasse Fehler schon einen dokumentierten
Präzedenzfall: der Unterzahl-Fix der Duell-Variante (`:11059-11071`), der `n=art.jeSeite` durch
`Math.min(mine.length,gegner.length)` ersetzen musste, „nachgemessen beim ersten Arena-Testlauf
mit `feldgroesse=2`". Dieselbe Falle, dieselbe Lösung.

### 3.3 Die Abnahme sieht den ungeraden Fall heute nicht — das Werkzeug dafür existiert aber schon

`scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf` misst ohne gesetzte Aufstellung, also immer
mit sechs. Die Standard-Abnahme kann eine Duett-Umsetzung damit **nie** im ungeraden Fall
erwischen. Der Ausweg steht bereits im Skript: `--je-seite=` (`:60`, `:96`) reicht bis in
`disziplinProbe` durch (`:22134-22141`) und akzeptiert jede Zahl, auch 3 und 5. Die Abnahme einer
Duett-Umsetzung ist damit ein Dreizeiler und kein Projekt:

```sh
node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf --je-seite=6
node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf --je-seite=5
node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf --je-seite=2
```

### 3.4 Die 80/20-Fusion kollidiert mit keiner Funktion — aber der Ansatzpunkt in der Recherche stimmt nicht

Gesucht war, ob eine bestehende Funktion im Bühne-Chassis der Fusion in die Quere kommt. Befund:
**keine.** Es gibt keinen zweiten Ort, der `summe` nachträglich umschreibt (der einzige
Kandidat, `u.summe=u.zweikampf` bei `:11306`, hängt an `BB().heben`). Die Teamsumme bleibt
exakt erhalten, weil `0,8a+0,2b + 0,8b+0,2a = a+b` — die Score-Anzeige (`:11612-11613`) und die
`maxSumme`-Normierung (`:11615`, `:11654`) sehen keinen Unterschied.

Was **nicht** stimmt, ist der Satz „angewendet auf `summe` NACH der bestehenden Rundenberechnung".
`bauBuehne()` setzt `summe:0` (`:11020`) und füllt nur `L.runden`; die Summe entsteht erst live,
Enthüllung für Enthüllung, in `stepBuehne()` (`:11505`, `if(!BB().heben)u.summe+=r.punkte`), und
zwar über eine gemeinsame `buehneQueue`, die die Teilnehmer einzeln abarbeitet. Eine Fusion „auf
`summe`" hätte damit zwei Folgeprobleme:

- **Wann?** Nach dem letzten Durchgang wäre der Live-Punktestand während des ganzen Auftritts
  ungefusioniert und würde am Ende springen. Pro Durchgang wäre der Partnerwert oft schon
  eingerechnet, bevor der Partner selbst dran war.
- **Womit inkonsistent?** `WERTUNG_AUFTRITT` (`:11807ff`) zeigt „Pkt" aus `u.summe` (`:11814`),
  aber „Ø" als `summe/r.length` (`:11815`) und „Best"/„Letzt" aus `runden[].punkte`. Fusioniert
  man nur `summe`, ist Ø × Durchgänge ≠ Pkt, und „Best" kann größer sein als jeder Beitrag zur
  angezeigten Summe. Dasselbe gilt für den `+X`-Schwebetext (`:11520`) und `leistungBuehne()`
  (`:11746-11753`).

**Empfehlung: die Fusion in die Rundenwerte legen, nicht in die Summe** — in `bauBuehne()`,
nachdem beide Partner ihre `runden` berechnet haben, paarweise
`punkte' = round(0,8·punkteA + 0,2·punkteB)` je Durchgangsindex. Weil die Fusion linear ist, ist
das Ergebnis auf `summe`-Ebene **dasselbe**, das der Prototyp gemessen hat (bis auf die Rundung
je Durchgang, ≤ 0,5 Punkte × 12 Durchgänge im schlechtesten Fall — genau das gehört in die
Nachmessung aus 3.3). Dafür bleiben Punktesäule, Ticker, Boxscore und Wertungstabelle ohne eine
einzige weitere Änderung konsistent.

### 3.5 Eine dritte Datei, die die Recherche nicht nennt: `eiskunst.tsx`

Was Breaking in `breaking.tsx` hat, hat Eiskunstlauf in
`app/foundation/discipline-stage/arena/disciplines/eiskunst.tsx` (Registry-Eintrag `registry.ts:84`)
— eine produktive, eigenständige Visualisierung („Kür auf der Ruhm-Treppe"). Die
Eiskunstlauf-Recherche erwähnt sie an keiner Stelle. **Handlungsbedarf entsteht daraus nicht:**
wie `breaking.tsx` zeichnet sie Team-Tokens gegen `finalMax`, kennt also weder Spielerpaare noch
Slots. Ein Duett bleibt dort unsichtbar — was vertretbar ist, aber eine bewusste Entscheidung
sein sollte und keine Entdeckung mitten in der Umsetzung.

---

## 4. Kollisionsrisiko beider Vorhaben zusammen

Die gemeinsame Fläche ist kleiner, als die Aufgabenstellung vermutet — und sie sitzt nicht in
`bauBuehne()`:

| Datei / Stelle | Breaking | Eiskunstlauf | Konflikt? |
|---|---|---|---|
| `BUEHNE_ART.breaking` (`:10724`) | `cypher:true` | — | nein |
| `BUEHNE_ART.eiskunstlauf` (`:10696`) | — | `duett:true` | nein (28 Zeilen Abstand) |
| `bauBuehne()` (`:10958-11048`) | — | Paarung + Fusion | nein, allein |
| `zeichneBuehne()`-Dispatcher (`:11649-11650`) | +1 Zeile | +1 Zeile (falls eigene Zeichenfunktion) | **ja, direkte Nachbarn** |
| generischer Zweig (`:11655`, x-Formel) | — | nur falls **kein** eigener Zweig | **ja, 5 Zeilen vom Dispatcher** |
| `matchday-slot-roles.ts` | Labels | — | nein |

Zwei Lehren aus den Präzedenzfällen des Projekts: #820/#840 wurden teuer, weil eine Änderung
**im geteilten Zweig** saß; #850/#854 blieben billig, weil die Änderung hinter einem eigenen Flag
mit Geschwister-Spiegeltest lag.

**Empfohlene Reihenfolge:**

1. **Breaking-Move-Namen zuerst** — berührt den Motor nur in zwei Textfeldern pro Zeile, keine
   Zeichnung, keine Bühne. Läuft echt parallel zu allem anderen.
2. **`zeichneBreaking()` als zweites** — reines Hinzufügen: eine Dispatcher-Zeile plus eine neue
   Funktion, der geteilte Zweig bleibt unberührt.
3. **Eiskunstlauf-Duett als drittes, auf dem gemergten Breaking-Stand rebased.** Und zwar mit
   eigener Zeichenfunktion (`if(art.duett){ zeichneDuett(art); return; }`) statt einer Änderung
   der x-Formel im geteilten Zweig — dann ist die Kollision zwischen beiden Vorhaben auf zwei
   benachbarte Dispatcher-Zeilen reduziert, und der Zweig, den die anderen sieben Bühnen-
   Disziplinen laufen, wird von keinem der beiden PRs angefasst.

Parallelisierbar sind Schritt 1 gegen alles und Schritt 2 gegen Schritt 3, **wenn** beide ihre
eigene Zeichenfunktion bauen. Nacheinander ist es trotzdem sicherer, weil beide denselben
Geschwister-Spiegeltest fahren müssen und ein gemeinsamer Nachweis wertlos ist, wenn nicht klar
ist, welcher der beiden ihn verschoben hat.

---

## 5. Priorisierte nächste Schritte

| # | Schritt | Vorbedingung | Abnahme |
|---|---|---|---|
| 1 | **Breaking-Move-Namen** in `matchday-slot-roles.ts` **und** `battle-mode.engine.js`, ein PR, nur `label`/`description`/`text`. `finaleset`s `klein:"stamina"` **nicht** anfassen (2.1). | keine — umsetzungsreif | `npx tsx scripts/pruefe-slot-invariante.ts` (muss unverändert grün sein), `npm test` |
| 2 | **`zeichneBreaking()`** hinter `art.cypher`, nach dem `heben`/`schach`-Muster. | Schritt 1 gemergt (dieselbe Datei, verschiedene Regionen) | `miss-alle-disziplinen.mjs 24` über alle neun Bühnen, bit-identisch; Screenshot-Skript nach dem Muster `screenshot-speed-schach.mjs` |
| 3 | **Eiskunstlauf-Duett**, Fusion in die **Rundenwerte** (3.4), Paarung je Seite (3.2), eigener `art.duett`-Zweig. | Chris-Entscheidung A und B unten | `--je-seite=6/5/2` (3.3) **plus** Geschwister-Spiegeltest gegen die acht anderen Bühnen |
| 4 | Zurückgestellt, ausdrücklich: asymmetrische Paarlauf-Rollen (Kraft-Attribut), Glide-Animation für die Bühne allgemein, echte Hebefigur-Pose. | eigene Kalibrierrunden | — |

**Umsetzungsreif?**

- **Breaking: ja.** Beide Schritte können sofort starten. Die einzige Ergänzung zur Recherche ist
  die Warnung aus 2.1 (`finaleset` nicht angleichen) und die Zeilennummern aus 2.4.
- **Eiskunstlauf: fast — zwei Entscheidungen fehlen.** Der Mechanismus ist durchgerechnet, aber
  die Prämisse aus 3.1 kippt einen Teil der Erzählung, und daraus folgen zwei Fragen, die keine
  Umsetzung für sich beantworten sollte.

**Offene Chris-Entscheidungen vor Schritt 3:**

- **A — Was passiert bei ungerader Feldgröße (in 2 von 5 Saisons)?** Die Recherche sagt „der
  Übrige läuft solo weiter". Das ist umsetzbar, hat aber einen Beigeschmack: die gepaarten Läufer
  bekommen den glättenden 20-%-Partneranteil, der Solo-Läufer nicht — bei ungeraden Feldern ist
  also ein Teilnehmer nach anderen Regeln bewertet als die übrigen. Alternativen: ein Dreier
  („Trio", jeder 60/20/20), oder der Solo-Läufer bekommt seinen 20-%-Anteil aus dem eigenen
  Durchschnitt (mathematisch identisch zu unverändert, aber ohne Sonderregel). Das ist eine
  Fairness-Frage, keine Motorfrage.
- **B — Soll Duett auch bei Feldgröße 2 greifen?** Dann ist die gesamte Seite ein einziges Paar,
  und die Rangtreue über zwei Personen, die sich gegenseitig 20 % anrechnen, ist eine andere
  Größe als über sechs. Messbar über `--je-seite=2` (3.3) — aber ob es erzählerisch gewollt ist
  („zwei Läufer, die zwangsläufig zusammen laufen"), entscheidet nicht die Messung.

Beides sind Zwei-Satz-Fragen an Chris und kein Rechercheauftrag. Sobald sie beantwortet sind, ist
auch Schritt 3 umsetzungsreif.

---

## Anhang: was für dieses Dokument selbst gelesen wurde

**Selbst gelesen und verglichen** (Stand `dd980ef1`, Code identisch zu `b3591f1c`):
`public/mockups/battle-mode.engine.js` (`BASIS_JE_DISC` 3497/3501, `SLOTS_JE_DISC.breaking`
3602-3609 und `.eiskunstlauf` 3634, `traitVerteilung`/`traitAufschlag` 3791-3870,
`BUEHNE_ART` 10598-10940, `bauBuehne` 10958-11090, `stepBuehne` 11491-11530, Score/`maxSumme`
11600-11620, `zeichneBuehne` 11642-11700, `leistungBuehne` 11746-11753, `WERTUNG_DUELL`/
`WERTUNG_AUFTRITT` 11780-11830, `zeichneHeben` 11862-11990, `keineBuehnenWaffe` 2574, `inDisc`
12478, `disziplinProbe` 22128-22205);
`lib/lineups/matchday-slot-roles.ts` (Typen 15-50, breaking 208-215, `roleTheme` 281-292,
`resolveThemeFocus`/`buildInitialDelta` 332-400);
`app/foundation/discipline-stage/arena/disciplines/breaking.tsx` (vollständig, 187 Zeilen),
`…/eiskunst.tsx` (Kopf), `…/registry.ts`;
`lib/season/season-discipline-schedule.ts:85-131`;
`lib/resolve/battle-mode-arena-team-points.ts` (`ARENA_RESOLVED_DISCIPLINE_IDS` 159-165,
Feldgrößen-Kommentar 433-440, `resolveArenaFieldSizeForMatchday` 849-880);
`lib/data/dataAdapter.ts` (Kategorien, Eiskunstlauf 70);
`lib/player-generator/player-generator-service.ts:1085-1105`; `lib/data/olyDataTypes.ts` (883, 3362);
`scripts/pruefe-slot-invariante.ts`; `scripts/miss-alle-disziplinen.mjs` (Argumente 54-96);
`lib/battle/arena-headless-runner.ts`, `lib/foundation/battle-arena/arena-aufstellung-adapter.ts`
(Aufstellungsweg in die Bühne);
beide Recherchen vollständig; `docs/pm-briefings/pm-gesamtstand-07-09.md` als Vorbild.

**Aus den Recherchen übernommen, hier nicht nachgemessen:** alle rho-Zahlen (Eiskunstlauf 0,875
Solo und die sieben Fusionsvarianten aus #856 Abschnitt 5.2; Breaking 0,869/0,951 aus #855). Der
Grund steht im Kopf: die Messung ist in dieser Umgebung nicht lauffähig (Chromium startet, die
Mockup-Seite stürzt beim Laden ab). Kein Befund dieses Dokuments hängt an einer dieser Zahlen.

**Bewusst offengelassen:** ob die 80/20-Fusion auf Rundenebene (3.4) dieselbe rho-Zahl liefert wie
der Prototyp auf Summenebene — die Rundung je Durchgang ist der einzige Unterschied, und das
gehört in die Nachmessung der Umsetzung, nicht in eine Synthese.

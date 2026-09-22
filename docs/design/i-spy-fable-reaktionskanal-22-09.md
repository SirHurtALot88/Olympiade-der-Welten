# I-Spy Reaktionskanal — Fables Einschätzung zu Opus' Vorschlag „Information statt Zug" (22.09.)

Chris hat auf die Frage, ob der Reaktionskanal nach Opus' Vorschlag umgebaut werden soll,
geantwortet: „Frag fable dazu." Dieses Dokument ist die Antwort. Es bewertet den Vorschlag aus
Design-Sicht, holt Vorbilder aus echten Spielen, entwickelt Alternativen — und **misst sie**,
weil die Sonde (`miss-alle-disziplinen.mjs 24 i-spy`) nur fünf Sekunden braucht und eine
Design-Meinung ohne Zahl in diesem Projekt nichts wert ist. Kein Code ist geändert: alle
Varianten liefen über einen lokalen, wieder entfernten Schalter in einer Engine-Kopie im
Worktree; `main` (`021e1d91`) ist unberührt. Basislinie und Opus' „Reaktion aus" wurden zuerst
auf drei Stellen genau reproduziert (0,730 / 0,221 / 0,902 bzw. 0,752 / +0,029 / 4 von 5), sonst
hätte ich den Zahlen unten nicht getraut.

`engine.js` meint `public/mockups/battle-mode.engine.js`; Zeilen wie im zweiten Gegencheck
(`docs/design/i-spy-opus-gegencheck-2-22-09.md`, Branch `i-spy-opus-gegencheck-2-doku-22-09`).

---

## 0. Fazit vorweg

| # | Frage | Antwort |
|---|---|---|
| 1 | Trägt Opus' Vorschlag Chris' Erzählung? | **Halb.** „Geschickt werden" bleibt, aber ehrlich gezeichnet folgt nur **37 %** der geschickten Läufer der gemeldeten Truhe (424 von 1150 Läufer-Zügen). Der Rest tut etwas anderes — im Ticker stünde dann eine Linie zu einer Truhe, zu der er nicht geht. |
| 2 | Hebt er rho wie erwartet (0,73–0,75)? | **Nein.** Wörtlich gebaut: Median 0,729, paarweise **+0,011**, 3 von 5. Er tauscht ein Verlässlichkeits-Leck gegen ein Validitäts-Leck (Saison 0,902 → 0,874). Netto null. |
| 3 | Wo sitzt der rho-Verlust wirklich? | **Ausschließlich im Geschenk** (Sicht ohne Wurf / Ziel ohne Wahl). Die K-D-Ausnahme allein — Zieltruhe verträgt zwei Besuche, sonst nichts — misst **+0,024 (4/5)**, praktisch gleich „aus" (+0,029). Die Dosis-Wirkung des Geschenks ist monoton: Bonus 0 → +0,024 · 0,15 → +0,022 · 0,30 → +0,019 · 1,0 (Opus) → +0,014. |
| 4 | Was ist die beste Variante mit echter, kausaler Reaktion? | **„Hinweis statt Freilos": nur Tresor-Ereignisse schicken einen Läufer; der bekommt +0,15 auf seine eigene Sichtschwelle für diese eine Truhe, würfelt und wählt (F2) sonst wie jeder andere.** Median **0,750**, paarweise **+0,022**, 4 von 5; Star Top 2 60 → **70 %**, Paartreue 93,0 → **93,8 %**, Pp 10,8 → **8,9** (n=12, gepaart). Ununterscheidbar von „aus", aber mit Erzählung. |
| 5 | Empfehlung | Opus' Richtung **bestätigen, seine Dosis nicht**: Information ja, aber als Hinweis (Schwelle +0,15), nicht als volle Sicht; nur der „krasse Fund" (Tresor) löst den Läufer aus; `r.reaktion` nur, wenn er wirklich hingeht. Bauskizze in 6. |

---

## 1. Was der Kanal heute wirklich tut — drei Dinge, die im Konzept anders klingen

Aus `ispySeiteTick()` (`engine.js:14660-14830`) gelesen, nicht vermutet:

1. **Der Läufer geht nie zur gegnerischen Truhe.** Seit PR 1 hat jede Seite ihre eigene Kopie
   des Raums (`ispyBaueRaum()` je Seite, Kopfkommentar „ARCHITEKTUR-ENTSCHEIDUNG", `:14473-14487`;
   ein geteilter Pool maß 0,53). „Dieselbe Truhe" ist die Truhe am selben Index auf dem
   **eigenen** Brett. Zwischen den Seiten fließt nur Information. Im Bild steht beides auf
   denselben Koordinaten (`ispyFundortXY(art.fundorte[r.fundort])`, `:16184`), also sieht es aus,
   als ginge er hinüber — mechanisch ist die Reaktion **schon heute Theater über das eigene
   Brett.** Das ist keine Kritik, sondern der Rahmen, in dem jede Variante gedacht werden muss:
   das Ereignis drüben sagt über meine Truhe nichts aus.
2. **Der Läufer wird auch zu Akten geschickt — und ohne Stufenprüfung.** S-c meldet Akte-Erfolge
   (`ispySichtbar`, `:14649`), die Seite reagiert auf das wertvollste Ereignis, und der
   Läufer-Zweig (`:14752-14780`) prüft nur `!t.leer`, nicht die Stufe. Der beste
   MENSCHENKENNTNIS-Spieler wird so regelmäßig zu einer 25-Punkte-Akte beordert, während sein
   F2-Zug ihm den 60er-Tresor gebracht hätte — oder, weil der Verhör-Tresor auf `idx 7` nach dem
   Knacken als **Notiz** nachwächst (Gegencheck 2, Abschnitt 3.1), „eilt er zum Tresor" und
   knackt eine 10-Punkte-Notiz mit `r.reaktion:true`. Das ist ein zufälliger **Malus** für den
   Bestgeeigneten, kein Bonus. Er kostet Verlässlichkeit, nicht Validität.
3. **Das Geschenk trifft systematisch die Falschen.** Wo der Läufer einen Tresor bekommt, bekommt
   er ihn ohne Spürwurf. SPÜRSINN ist `intelligence 60` — das Attribut mit der stärksten
   Eignungskorrelation (r = 0,650). Der Läufer wird aber nach dem Knack-Sub-Skill der Rätselart
   gewählt; bei Verhör ist das `torment 22 / charisma 40 / spirit 38` (r = 0,04 / 0,37 / 0,19).
   Der Kanal umgeht also genau das Tor, das die Eignung am besten trägt, zugunsten von
   Spielern, deren Stärke sie am wenigsten trägt. Das kostet Validität.

Punkt 2 erklärt, warum der Ist-Stand eine schlechte Verlässlichkeit (0,655) bei guter Validität
(0,902) hat; Punkt 3 erklärt, warum Opus' wörtlicher Vorschlag die Validität senkt (2.). Beides
zusammen erklärt die gemessene Dosis-Wirkung: jede Form von Zuteilung oder Sichtgeschenk kostet.

---

## 2. Opus' Vorschlag, kritisch

**Die Idee ist richtig, die Dosis ist falsch.** „Der Läufer bekommt Information, keinen Zug"
trifft den Kern: die Reaktion darf keine Punkte verteilen. Aber Opus' konkrete Fassung — die
gemeldete Truhe gilt **ohne Wurf** als gesehen — ist immer noch ein Geschenk, nur ein kleineres:
sie ersetzt eine Sichtchance von 34–78 % (SPÜRSINN 30–85) durch 100 %. Gemessen:

| Variante | rho je Spiel | Spw | Saison | Verlässl. | paarw. Δ | besser | Läufer folgt |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,221 | 0,902 | 0,655 | — | — | — |
| **Opus wörtlich** (Information + TEAMGEIST-Tor) | 0,729 | 0,266 | **0,874** | 0,695 | **+0,011** | 3/5 | **37 %** |
| Opus ohne Tor (jedes Ereignis reagiert) | 0,721 | 0,253 | 0,888 | 0,659 | +0,006 | 2/5 | 34 % |
| Reaktion aus (Opus, reproduziert) | 0,752 | 0,252 | 0,916 | 0,674 | +0,029 | 4/5 | — |

Die Verlässlichkeit steigt (0,655 → 0,695), weil der Akte-Malus aus 1.2 wegfällt; die Validität
fällt (0,902 → 0,874), weil das Sichtgeschenk aus 1.3 jetzt **jedes Mal** greift, wenn das Ziel
ein Tresor ist (F2 sagt dann immer ja). Ein Leck wird gegen das andere getauscht. Opus hatte
das als Erwartung, nicht als Messung markiert — und die Erwartung trägt nicht.

**Zur Erzählung.** Die Sorge aus der Aufgabenstellung ist real und größer als vermutet: nur gut
ein Drittel der geschickten Läufer wählt die gemeldete Truhe. Die Gründe stehen im Code — das
Ziel ist eine Akte, während er einen Tresor sieht; ein Teamkollege war vor ihm in der
Reihenfolge; die Truhe ist eine Notiz geworden; der `_arbeitetTresor`-Filter hat den wahren
Besten aussortiert und den Zweitbesten geschickt. Ein Bild, das in zwei von drei Fällen eine
Linie zu einer Truhe zeichnet, zu der niemand geht, ist nicht „intakte Erzählung", sondern ein
Fehler, den Chris beim ersten Sichtlauf sähe. Die Reparatur ist billig (6.3), aber sie muss
dazu — und sie verändert, was man ehrlicherweise als Reaktionsrate ausweisen kann.

**Was an Opus' Vorschlag bleibt:** kein eigener Läufer-Zweig, F2-Wahl für alle, K-D unverändert,
`rr()`-Verbrauch identisch. Das ist der richtige Umbau; nur der Bonus muss klein sein und der
Auslöser selektiv (4.).

---

## 3. Wie andere Systeme „ein Team sieht etwas und schickt den Besten" lösen

Fünf Vorbilder, und aus ihnen fünf Kriterien, die eine Reaktion vom Rauschen trennen.

- **Stealth-AI (Thief/MGS/Hitman-Schule).** Die Wache, die ein Geräusch hört, wechselt in einen
  Zustand („suspicious", „investigate"), **geht hin und macht dort ihre eigene Wahrnehmungs-
  prüfung** — „if they continue to see the player they will enter a search state else they will
  return to their job" ([Smith, Stealth Design Part 2](https://www.gamedesigndiary.co.uk/post/design-stealth-part-2-ai-behaviours)).
  Die Information ändert den *Zustand* des Reagierenden, nie das *Ergebnis*. Genau das ist der
  Unterschied zwischen „Hinweis" und „Freilos".
- **Scotland Yard.** Mr. X taucht alle paar Züge auf; die Detektive bekommen **nur Information**
  und müssen mit ihren eigenen Tickets hinkommen. Die Rezension bei
  [Meeple Like Us](https://www.meeplelikeus.co.uk/scotland-yard-1983/) beschreibt genau die
  Kehrseite: wenn die Detektive die Information nicht in Bewegung umsetzen können, „the game
  fizzles out" — Information ohne Handlungskapazität ist wertlos. Übertragen: der Hinweis muss
  in der EV-Wahl des Läufers **ankommen**, also die Sichtschwelle berühren, sonst ist er Kulisse.
- **Basketball-„Gravity"/Help-Defense.** Der Star zieht den Doppler, der freie Mann muss den
  Wurf **trotzdem selbst treffen** ([Gravity, NBA.com](https://www.nba.com/inside-the-game/player/gravity);
  [Rotationen](https://u1hoops.com/2026/09/08/defensive-rotations-basketball/)). Die Reaktion
  hat einen **Preis** (jemand verlässt seine Zuordnung) und einen **eigenen Ausgang**. In I-Spy
  ist der Preis heute null (der Läufer verliert nichts), und deshalb ist die Reaktion ein
  reiner Transfer.
- **Football Manager, Manndeckung.** Die Reaktion wird an den geeignetsten Verteidiger gebunden,
  aber ihr Ausgang hängt vom **Attribut-Matchup** ab und kann nach hinten losgehen (tight
  marking gegen den schnelleren Flügel: „set tight marking to never",
  [Passion4FM](https://www.passion4fm.com/using-opposition-instructions-in-football-manager-to-deal-with-players/)).
  Eine Reaktion, die unabhängig vom Matchup immer denselben Gewinn bringt, ist keine Taktik.
- **NBA 2K, Doppeln.** Der Doppler kommt, wenn **Rating-Differenzen** eine Schwelle reißen
  ([OS-Forum zu 2K24](https://forums.operationsports.com/forums/nba-2k-basketball/1014505-ai-double-teams-against-low-post-mismatches-2k24-2.html);
  [2K25 Courtside Report](https://nba.2k.com/2k25/courtside-report/gameplay/)). Das Tor liegt
  auf den *relevanten* Attributen, nicht auf einem separaten Team-Wert.
- **Balancing-Literatur.** Eine Reaktion, die der Seite ohne Fund einen Zug am Wert des Funds
  gibt, ist eine **negative Rückkopplung** (Rubber-Banding): sie „gives everyone a chance …
  no matter their skill level" ([Machinations](https://machinations.io/articles/game-systems-feedback-loops-and-how-they-help-craft-player-experiences);
  [Schreiber/Romero, Game Balance](https://www.routledge.com/Game-Balance/Schreiber-Romero/p/book/9781498799577);
  [CIS125G-Reader](https://computerscience.chemeketa.edu/cis125greader/MechanicsDynamics/FeedbackLoops.html)).
  Genau das ist im Rennspiel gewollt und in einer Rangtreue-Abnahme Gift: weniger
  Skill-Ausdruck heißt hier wörtlich weniger rho. Weil `wert()` je Spieler zählt, erscheint die
  Zwischen-Team-Rückkopplung als Rauschen im Einzelnen.

**Die fünf Kriterien:** (1) Der Auslöser ist selektiv und salient (der „krasse Fund", nicht jeder
Fund). (2) Die Reaktion ändert den **Zustand** des Reagierenden (erhöhte Aufmerksamkeit), nicht
sein Ergebnis. (3) Der Ausgang läuft durch **seine eigenen** Würfe — Sicht und Knacken. (4) Sie
hat einen Preis oder mindestens keinen garantierten Gewinn. (5) Cause und Effect sind im Bild
lesbar: die Linie zeigt dorthin, wo er wirklich hingeht. Der Ist-Stand verletzt 1, 2, 3 und 5;
Opus' Fassung verletzt 2 (volle Sicht) und 5 (37 % Folgequote).

---

## 4. Alternativen und Bewertung

Alle Varianten halten den `rr()`-Verbrauch je Seite je Tick exakt bei `1 + 3·Teilnehmer`
(Handbuch-Falle 17): der Reaktionswurf wird immer gezogen, der Läufer verbraucht wie jeder andere
einen Spür- und zwei Knackwürfe.

| Variante | Mechanik | (a) Erzählung „Bester wird geschickt, kann es verhauen" | (b) Behebt Fremdrauschen (2.2a) und schwaches Tor (2.2b)? |
|---|---|---|---|
| **A „Hinweis statt Freilos"** | Läufer macht seinen normalen Zug; für die gemeldete Truhe liegt seine Sichtschwelle um `+0,15` höher. F2 wählt. | **Ja, und ehrlicher als heute**: er wird alarmiert (Ausrufezeichen), findet die Truhe wahrscheinlicher, geht hin, wenn sie sich für ihn lohnt, und kann am Schloss scheitern. | Weitgehend: das Geschenk schrumpft von „100 % Sicht auf einen 60er" auf „+15 Pp Sichtchance", und es läuft durch seinen eigenen SPÜRSINN-Wurf. TEAMGEIST-Tor kann bleiben (gemessen neutral, s. 5). |
| **B „Nur der krasse Fund"** (S-b für die Reaktion) | Nur Tresor-Erfolg/-Fehlschlag schickt einen Läufer; Akte-Jubel bleibt im Ticker sichtbar, löst aber keinen aus. | **Ja**, das ist Chris' Wortlaut („fetter Fund"). Folgequote steigt, weil das Ziel immer der 60er ist. | Halbiert die Zahl der Fremd-Auslöser (~4,8 → ~3,9 Läufer je Seite je Spiel) und nimmt den Akte-Malus aus 1.2 heraus. |
| **C „Reaktion als Erzählung + K-D"** (Bonus 0) | Läufer wird bestimmt und markiert, bekommt aber **keinen** Sichtvorteil; nur die K-D-Ausnahme bleibt. | Nur bedingt: er folgt in 15–17 % der Fälle „von selbst". Die Linie darf man dann nur zeichnen, wenn er wirklich geht. | **Vollständig** — mechanisch fast „aus" (+0,024 gegen +0,029). Das ist die Rückfallebene, wenn Chris jede Kausalität ablehnt. |
| **D Opus wörtlich** (Bonus 1,0) | Volle Sicht ohne Wurf, F2 wählt. | Halb (37 % Folge). | Nein: tauscht Verlässlichkeits- gegen Validitätsleck (2.). |
| **E Reaktionsrate halbieren** (Opus Weg 3) | `BASIS 0,15 / K 0,003`, sonst Ist. | Ja, nur seltener. | Nein, nur leiser (+0,012 laut Gegencheck 2). Dosis-Knopf, keine Reparatur. |
| **F „Reaktion mit Preis"** (Läufer zuletzt in der Reihenfolge) | Der Läufer kommt als Letzter dran, weil er „von weiter weg" kommt. | Schöner Wettlauf-Beat. | Nein — ändert die Zuteilung nicht, nur ihre Reihenfolge. Nicht gemessen, weil orthogonal; als Politur denkbar. |
| **G Geteiltes Brett** | Beide Seiten spielen um dieselben Truhen. | Wäre die einzig „wahre" Reaktion. | Tot: PR 1 maß 0,53 (Zugriffsreihenfolge dominiert den Sub-Skill). |
| **H TEAMGEIST → Bonushöhe statt Tor** | Tor fällt (jedes Tresor-Ereignis reagiert), `Bonus = 0,15 + ØTEAMGEIST·0,003`. | Ja. | Behebt (b) formal — misst aber nicht besser als A mit Tor (5.). Kein Grund, Chris' Spirit-Kanal zu streichen. |

Empfohlen wird **A + B** zusammen, mit C als dokumentierter Rückfallebene.

---

## 5. Messreihe

Kaderfest, Fünfer-Familie aus `data/generated/kaderfamilie-live-save.json`, 24 Spiele je
Paarung, paarweise gegen den Ist-Stand (gleiche Paarung, gleiche Saaten). „Läufer" zählt Züge, in
denen ein Läufer bestimmt war; „folgt" die davon, in denen er die gemeldete Truhe gewählt hat.

### 5.1 Alle sichtbaren Ereignisse als Auslöser (S-c, wie heute)

| Variante | Spiel | Spw | Saison | Verl. | paarw. Δ | besser | Läufer | folgt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ist-Stand | 0,730 | 0,221 | 0,902 | 0,655 | — | — | — | — |
| Reaktion aus | 0,752 | 0,252 | 0,916 | 0,674 | +0,029 | 4/5 | 0 | — |
| nur K-D (Bonus 0) + Tor | 0,746 | 0,248 | 0,909 | 0,673 | +0,024 | 4/5 | 1111 | 17 % |
| nur K-D (Bonus 0) ohne Tor | 0,746 | 0,245 | 0,909 | 0,674 | +0,022 | 4/5 | 1608 | 14 % |
| Hinweis 0,15 + Tor | 0,741 | 0,282 | 0,909 | 0,664 | +0,017 | 3/5 | 1125 | 26 % |
| Hinweis 0,30 + Tor | 0,733 | 0,275 | 0,902 | 0,659 | +0,014 | 4/5 | 1140 | 33 % |
| Hinweis 0,50 + Tor | 0,729 | 0,269 | 0,874 | 0,695 | +0,014 | 3/5 | 1148 | 37 % |
| Hinweis 0,15 ohne Tor | 0,739 | 0,282 | 0,895 | 0,682 | +0,013 | 3/5 | 1623 | 23 % |
| Hinweis 0,15 + TG·0,003 ohne Tor (H) | 0,732 | 0,271 | 0,888 | 0,680 | +0,017 | 4/5 | 1646 | 31 % |
| Opus wörtlich (Bonus 1,0) + Tor | 0,729 | 0,266 | 0,874 | 0,695 | +0,011 | 3/5 | 1150 | 37 % |
| Opus wörtlich ohne Tor | 0,721 | 0,253 | 0,888 | 0,659 | +0,006 | 2/5 | 1660 | 34 % |

### 5.2 Nur Tresor-Ereignisse als Auslöser (B)

| Variante | Spiel | Spw | Saison | Verl. | paarw. Δ | besser | Läufer | folgt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ist-Stand, nur Tresor | 0,726 | 0,219 | 0,902 | 0,648 | +0,003 | 3/5 | — | — |
| nur K-D ohne Tor, nur Tresor | 0,748 | 0,242 | 0,909 | 0,677 | +0,024 | 4/5 | 1346 | 15 % |
| **Hinweis 0,15 + Tor, nur Tresor (A+B)** | **0,750** | 0,274 | 0,909 | 0,680 | **+0,022** | **4/5** | 938 | **27 %** |
| Hinweis 0,15 ohne Tor, nur Tresor | 0,749 | 0,262 | 0,909 | 0,679 | +0,021 | 4/5 | 1358 | 24 % |
| Hinweis 0,30 + Tor, nur Tresor | 0,743 | 0,272 | 0,902 | 0,679 | +0,019 | 4/5 | 953 | 35 % |
| Hinweis 0,30 ohne Tor, nur Tresor | 0,736 | 0,256 | 0,902 | 0,666 | +0,018 | 4/5 | 1377 | 31 % |
| Opus wörtlich + Tor, nur Tresor | 0,735 | 0,265 | 0,909 | 0,654 | +0,014 | 4/5 | 968 | 39 % |
| Opus wörtlich ohne Tor, nur Tresor | 0,722 | 0,245 | 0,881 | 0,672 | +0,010 | 3/5 | 1400 | 36 % |

Einzelwerte der empfohlenen Variante gegen Ist: vigilante 0,798 → 0,861 · coldsteel 0,728 → 0,755
· goldengladiators 0,735 → 0,727 · mortalsin 0,730 → 0,750 · piratecrew 0,577 → 0,587. Die
Spannweite wächst (0,221 → 0,274), weil die gut ordenbaren Paarungen gewinnen und die kaum
ordenbare (piratecrew, 284 Paare mit ≥ 15 Punkten Abstand) stehen bleibt — dasselbe Muster wie
bei „aus" (0,252).

### 5.3 Zweite Abnahme und Budget, empfohlene Variante

| | Ist-Stand | A+B | „aus" (Gegencheck 2) |
|---|---:|---:|---:|
| Star auf Rang 1 | 40,8 % | **44,2 %** | 41,7 % |
| Star in den ersten zwei | 60,0 % | **70,0 %** | 70,0 % |
| Paartreue (≥ 15 Punkte) | 93,0 % | **93,8 %** | 93,8 % |
| Pp-Abweichung, `messe-arena-einfluss.mjs i-spy 12` (gepaart, gleicher Lauf) | 10,8 | **8,9** | — |
| davon spirit | −2,9 | −1,0 | — |

Drei Lesarten, alle drei wichtig:

- **Die Reaktion kostet nichts mehr, sobald sie nichts mehr schenkt.** A+B (0,750, +0,022) und
  „aus" (0,752, +0,029) liegen innerhalb einer Standardschwankung; die Stern- und Paarzahlen sind
  identisch. Wer die Reaktion behalten will, kann sie behalten — nur nicht in der heutigen Dosis.
- **Das TEAMGEIST-Tor ist unschuldig, sobald das Geschenk klein ist.** Mit und ohne Tor liegen
  alle Varianten paarweise innerhalb von 0,005. Opus' Ursache (b) war real nur, solange das Tor
  60-Punkte-Züge verteilte. Chris' Spirit-Kanal (Idee 4 aus dem ersten Gegencheck) darf bleiben;
  Pp für spirit wird mit A+B sogar besser (−2,9 → −1,0).
- **Die Folgequote ist die neue Erzähl-Kennzahl.** Bei A+B geht gut jeder vierte Läufer wirklich
  hin — das sind ~1 bis 1,5 sichtbare „eilt zum Tresor"-Momente je Seite je Spiel, statt der
  heutigen 4,8, von denen ein Teil zu Notizen führt. Weniger, aber wahr. Wer mehr Bild will,
  bezahlt mit rho (Bonus 0,30: 35 % Folge, +0,019; Bonus 1,0: 39 %, +0,014). Das ist eine
  Entscheidung für Chris, keine für den Motor (7.).

---

## 6. Empfehlung und Bauskizze

**Opus' Vorschlag bestätigen — mit zwei Korrekturen, die aus der Messung folgen:** die Information
ist ein **Hinweis** (Schwelle +0,15), keine volle Sicht; und nur ein **Tresor**-Ereignis schickt
einen Läufer. Dazu die ehrliche Zeichnung: `r.reaktion` nur, wenn er wirklich hingeht.

### 6.1 Logik in `ispySeiteTick()` (Zeilen nach `main` `021e1d91`)

```
// Reaktionswurf: UNVERAENDERT (:14664-14665), immer gezogen, TEAMGEIST-Tor bleibt.
ereignisse = sichtbareEreignisse.filter(e => e.stufe === 3)          // NEU (B): nur Tresor
if (ereignisse.length && wurf < pReaktion) {
  ziel    = wertvollstes Ereignis (wie heute)
  truhe   = truhen.find(idx === ziel.idx && !leer)                   // eigenes Brett, wie heute
  laeufer = bester Sub-Skill(truhe.art) unter Kandidaten             // R-2, Deckel wie heute
  laeufer.reaktionen++ ; zielIdx = truhe.idx
}

// Läufer-Zweig (:14752-14783): ENTFÄLLT. Kein `continue`, kein verworfener rr().
// Normaler Zug für ALLE, mit genau einer Änderung in der Sichtprüfung:
x = rr()
sichtbar(t) = t.stufe === 1
           || x < schwelle(t.stufe) + (u === laeufer && t.idx === zielIdx ? ISPY_HINWEIS_BONUS : 0)
ISPY_HINWEIS_BONUS = 0.15
// F2-Wahl, `belegt`, K-D-Ausnahme (zielIdx verträgt zwei Besuche), Knackwurf, Fortschritt,
// Teilpunkte, Nachfüllen: UNVERAENDERT.
r.reaktion = (u === laeufer && wahl.t.idx === zielIdx) || undefined    // nur wenn er hingeht
r.hinweis  = (u === laeufer) || undefined                              // NEU, additiv, für den Ticker
```

`rr()`-Verbrauch: identisch zu heute (der alte Zweig zog ebenfalls 1 + 2). Isolationsnachweis wie
üblich: `miss-alle-disziplinen.mjs 24` über alle zwanzig, nur die i-spy-Zeile bewegt sich.

### 6.2 Was die Zahl im Kommentar sagen muss

Nach dem Takeshi-Muster („BEWUSST NICHT GESETZT, weil gemessen schädlich") gehören in den
Rezeptkommentar bei `ISPY_HINWEIS_BONUS`: die Dosis-Wirkung 0 / 0,15 / 0,30 / 1,0 → +0,024 /
+0,022 / +0,019 / +0,014 (nur Tresor, mit Tor), und der Satz, dass der alte Läufer-Zweig
(Zuteilung ohne Sichtwurf, auch zu Akten und nachgewachsenen Notizen) 0,730 gegen 0,750 maß.
Sonst wird die Frage in sechs Wochen erneut gestellt.

### 6.3 Präsentation und Ticker (bit-identisch, reine Lesefelder)

- `stepSchatzsuche()` (`:16196-16208`): gestrichelte Linie, Ausrufezeichen und `alarm`-Ton
  weiter an `r.reaktion` — das ist jetzt automatisch nur der Fall, in dem er wirklich geht.
- Neue Ticker-Zeile für `r.hinweis && !r.reaktion` (`ispyTickerZeile()`, `:14877`): „Draco hört den
  Jubel drüben — bleibt bei seiner Akte" / „… findet den Tresor nicht rechtzeitig". Das ist
  Chris' „kann es verhauen", eine Stufe früher als am Schloss, und es erzählt die Entscheidung
  statt sie zu verstecken.
- Optional, ohne Messrisiko: Ausrufezeichen kurz auch für `r.hinweis` (halb transparent), Linie nur
  für `r.reaktion`.

### 6.4 Abnahme

`miss-alle-disziplinen.mjs 24 i-spy` Median ≥ 0,745 und paarweise ≥ +0,015 in mindestens 4 von 5
Paarungen; `miss-star-paartreue.mjs 24 i-spy` Top 2 ≥ 70 %, Paartreue ≥ 93,8 %;
`messe-arena-einfluss.mjs i-spy 48` und `96` ≤ 25 Pp (heute 18,4 / 14,5; n=12 liest 8,9 gegen
10,8); `miss-arena-buehne-spiegel.mjs 200 i-spy` in 45–55; die anderen neunzehn Disziplinen
bit-identisch. Aufwand: ein halber Tag Bau, ein halber Tag Messung.

### 6.5 Reihenfolge gegenüber Opus' anderen Empfehlungen

Zuerst dieser Umbau (alle Zahlen hier sind auf `main` gemessen), **dann** die Nachfüll-Reparatur
aus Gegencheck 2, Abschnitt 3 — sie verändert, welche Position wann ein Tresor ist, und damit
genau die Ereignisse, auf die der Läufer reagiert. Beides in einer PR macht eine Regression
nicht zuordenbar. Die Ausweitung der Nebenwege (Gegencheck 2, Abschnitt 4) ist orthogonal.

---

## 7. Zwei Fragen an Chris

1. **Reicht „Hinweis"?** Der Bestgeeignete wird alarmiert und findet die Truhe leichter, aber nicht
   sicher — und er geht nur, wenn sie sich für ihn lohnt. Das ist mechanisch das Maximum, das die
   Rangtreue verträgt; jede Stufe „sicherer" kostet gemessen rho (5.). Wenn Chris die Reaktion
   lieber als reines Bild will (C, Bonus 0), ist das dieselbe Zahl mit weniger Kausalität.
2. **Nur der krasse Fund?** Akte-Jubel bleibt für den Gegner sichtbar (Ticker), schickt aber
   keinen Läufer mehr. Das ist enger an der Sprachnachricht („fetter Fund") als das heutige S-c
   und misst besser. Falls Chris die Akten dabei haben will: Bonus 0,15 ohne Tresor-Filter liest
   +0,017 (3/5) statt +0,022 (4/5) — vertretbar, aber schlechter.

---

## Quellen

- `public/mockups/battle-mode.engine.js`, `main` `021e1d91`: `BUEHNE_ART["i-spy"]` `:13262-13409`;
  Konstanten `:14495-14548`; `ispyBaueRaum()` `:14622-14644`; `ispySichtbar()` `:14649`;
  `ispySeiteTick()` `:14660-14830` (Reaktionswurf `:14664`, Läufer-Auswahl `:14667-14691`,
  Läufer-Zweig `:14752-14783`, Sichtprüfung `:14788`, K-D-Ausnahme `:14789/:14798`);
  `baueSchatzsuche()` `:14832-14856`; `ispyTickerZeile()` `:14877`; `stepSchatzsuche()`
  `:16170-16222`.
- `docs/design/i-spy-schatzsuche-konzept-21-09.md` (1.3, 1.4, 3.1–3.4, 5.2, 6.2);
  `docs/design/i-spy-opus-gegencheck-21-09.md` (Abschnitt 0 Korrelationen, 4);
  `docs/design/i-spy-opus-gegencheck-2-22-09.md` (1.3, 2, 3, 6, 7); `CLAUDE.md`.
- Messung: eigene Sonde über `scripts/lib/rangtreue-messung.mjs` (`disziplinMessen`, Einzelwerte je
  Paarung) mit einem lokalen `window.ISPY_VARIANTE`-Schalter in der Engine (nach der Messung per
  `git checkout` entfernt, Arbeitsbaum sauber); `scripts/miss-star-paartreue.mjs 24 i-spy`;
  `scripts/messe-arena-einfluss.mjs i-spy 12`.
- Web: [Smith, Stealth Design Part 2 — AI States](https://www.gamedesigndiary.co.uk/post/design-stealth-part-2-ai-behaviours);
  [Meeple Like Us — Scotland Yard](https://www.meeplelikeus.co.uk/scotland-yard-1983/);
  [NBA.com — Player Gravity](https://www.nba.com/inside-the-game/player/gravity);
  [Wikipedia — Gravity (basketball)](https://en.wikipedia.org/wiki/Gravity_(basketball));
  [Unit 1 Hoop Source — Defensive Rotations](https://u1hoops.com/2026/09/08/defensive-rotations-basketball/);
  [Passion4FM — Opposition Instructions](https://www.passion4fm.com/using-opposition-instructions-in-football-manager-to-deal-with-players/);
  [Operation Sports — AI double-teams (2K24)](https://forums.operationsports.com/forums/nba-2k-basketball/1014505-ai-double-teams-against-low-post-mismatches-2k24-2.html);
  [NBA 2K25 Courtside Report — Gameplay](https://nba.2k.com/2k25/courtside-report/gameplay/);
  [Machinations — Feedback Loops](https://machinations.io/articles/game-systems-feedback-loops-and-how-they-help-craft-player-experiences);
  [Schreiber/Romero — Game Balance](https://www.routledge.com/Game-Balance/Schreiber-Romero/p/book/9781498799577);
  [CIS125G Reader — Feedback Loops](https://computerscience.chemeketa.edu/cis125greader/MechanicsDynamics/FeedbackLoops.html).

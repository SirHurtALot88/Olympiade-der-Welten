# I-Spy — Konzeptreview: Gameplay und Taktik vor der nächsten Zahl (Opus, 26.09.)

Chris hat angeordnet, **nicht** weiter an Zahlen zu drehen („balancing bringt noch nichts wenn die
Konzepte nicht perfekt sind"), sondern zuerst das Gameplay- und Taktikkonzept selbst zu prüfen.
Dieses Dokument tut genau das: Es fragt, ob I-Spy echte Entscheidungen enthält, und ob das
rho-Plateau nach mehreren Kalibrierrunden ein Zahlen- oder ein Konzeptproblem ist.

Es ist reines Konzept. Am Motor wurde nichts geändert. Die Diagnosemessungen in Abschnitt 3 liefen
über eine gepatchte **Kopie** der Engine im Worktree, die nach jeder Messung zurückgesetzt wurde
(dasselbe Verfahren wie in beiden Gegenchecks vom 21./22.09.). `engine.js` meint
`public/mockups/battle-mode.engine.js`, Stand `main` `6b471366` (26.09.). Form und Tiefe folgen
`docs/design/climbing-neukonzept-22-09.md`. Alle neuen Zahlen sind als **Vorschlag** markiert; was
gemessen ist, steht mit Befehl daneben.

Vorgänger, alle vollständig gelesen: `i-spy-schatzsuche-konzept-21-09.md` (Fable, Konzept),
`i-spy-opus-gegencheck-21-09.md` (Chris' vier Nachträge), `i-spy-opus-gegencheck-2-22-09.md`
(strukturelle rho-Reserve, Randomizer), `i-spy-fable-reaktionskanal-22-09.md` (Hinweis statt
Freilos), dazu die Commit-Texte der Kalibrierrunden (`021e1d91`, `0f812538`), des
Nachfüll-Fixes (`af9dc3ff`), des Reaktionsumbaus (`edcc6c1e`) und des visuellen Randomizers
(`b00135b5`).

## Kurzfassung

- **Das Bild stimmt, die Auflösung nicht.** Chris' Schatzsuche besteht aus Finden und Knacken,
  Truhen in drei Stufen und drei Rätselarten, sichtbaren Funden und einer Reaktion des Gegners.
  Dieses Bild ist gut, und der Motor belohnt die richtigen Spieler: Die Saison-Validität liegt bei
  **0,909** und ist damit eine der besten aller Bühnen. Schwach ist die Art, wie ein Tick
  aufgelöst wird. Heute ist I-Spy **ein Zugriffslos je Tick mit fester Verteilung**:
  1. Ein einziger Spürwurf entscheidet fast binär, ob ein Spieler Tresore sieht oder nur Notizen.
  2. Eine feste Reihenfolge verteilt das knappe Gut, zwei Tresore je Team und Tick.
  3. Die Wahl, die der Spieler dann trifft, ist eine Formel ohne echte Abwägung.
- **Es gibt heute keine echte taktische Entscheidung.** Durch die Teilpunkte (55 %) ist ein
  gescheiterter Tresor mit **33** Punkten mehr wert als eine geknackte Akte mit **25**. Für jeden
  Spieler, jede Knackchance und jeden Zustand gilt deshalb: Der höchste sichtbare Fundort ist
  immer besser. Ein Risiko gibt es nicht mehr. Die EV-Wahl F2 rechnet trotzdem so, als bringe ein
  Fehlschlag null Punkte. Deshalb wählen Spieler mit Knack-Sub-Skill unter ~41 eine Akte statt
  eines sichtbaren Tresors und bekommen dafür rund die Hälfte der Punkte, die sie haben könnten.
  Diese „Entscheidung" trägt rho nur als Rechenfehler. Wird sie korrekt gerechnet, fällt die
  Validität **0,909 → 0,867** (gemessen, 3.2).
- **Die beiden Teams spielen parallel Solitär.** Jede Seite hat seit PR 1 ihren eigenen Raum, denn
  ein geteilter Raum maß 0,53. Zwischen den Seiten fließt nur ein Hinweis (+0,15 Sicht auf eine
  eigene Truhe). Was drüben gefunden wird, sagt nichts über den eigenen Raum. Die Reaktion ist
  deshalb Theater. Das ist rho-freundlich, aber taktisch leer. Auch Chris' Aufstellung wirkt
  sich im Spiel kaum aus: Die sechs Slots (Observer, Pattern Lock, Social Read, Logic Chain,
  Quiet Move, Reveal) beschreiben Rollen, die im Raum nicht vorkommen. Sie geben nur einen
  kleinen Attributaufschlag.
- **Das Plateau ist konzeptionell, nicht numerisch.** Drei Messungen zeigen das, alle vom 26.09.:
  - Wird der Kern entrauscht (Sicht als Faktor statt Tor, Auszahlung als Erwartungswert), steigt
    die Verlässlichkeit auf **0,924**. Die Validität fällt aber auf **0,804**, rho je Spiel
    landet bei **0,773**.
  - Das Rauschen ist also kein Fehler, sondern ein Pflaster. Es verteilt die knappen Tresore
    zufällig um und verdeckt damit, dass die Punkte heute am **Teamrang** hängen und nicht an der
    absoluten Eignung.
  - Doppelt so viele Ticks bringen auch nach dem Nachfüll-Fix nur +0,011 (Hockey-Lehre
    bestätigt).
  - Keine gemessene Kombination erreicht 0,80. Die beste liegt bei **0,785**.
  - Der Befund aus dem Gegencheck 2 („Validität und Verlässlichkeit tauschen sich gegeneinander
    ein") hat damit eine Ursache: Signal und Rauschen sitzen **im selben Kanal**. Jede Zahl an
    diesem Kanal bewegt sich auf derselben Tauschkurve.
- **Vorschläge, nach Priorität:**
  - **P1 „Spur statt Los"** (entscheidet über die Schranke). Jeder Spieler verfolgt eine
    **eigene** Spur, und der Spürsinn **sammelt sich an**, statt einmal je Tick zu würfeln. Es
    gibt keinen Wettlauf mehr um zwei Tresore je Team. Die eine echte Entscheidung heißt „tiefer
    graben oder jetzt knacken" (Push-your-luck), mit einem Endspiel gegen die Uhr (Score-OL).
    Zwei Konten, Fundpunkte und Lösungspunkte, ersetzen die Teilpunkte ehrlich.
  - **P2 „Slots werden Spielpläne"** (Taktik für Chris). Die sechs Slots werden Pläne nach dem
    Bahn-Muster `planJeSlot`, und die Mehrwege-Leitlinie wandert dorthin, wo die Punkte
    entschieden werden: ins **Finden**, nicht ins Knacken.
  - **P3 „Ein Fall, zwei Räume"** (Gegnerbezug mit Inhalt). Beide Teams lösen denselben Fall.
    Ein Jubel drüben verrät etwas über den eigenen Raum, Pokerface steht gegen
    Menschenkenntnis. Das ist Information, kein Zug durch fremde Hand.
  - **P4 „Indizienkette"** (optional). Ein Finale auf Teamebene nach Fort Boyard. Es fließt in
    den Spielausgang, nicht in `wert()`, wie Tor und Boxscore im Hockey.
- **rho-Erwartung für P1: 0,78–0,84, geschätzt, nicht gemessen.** Deshalb steht vor jedem Bau ein
  Prototyp auf einer Kopie mit Abbruchkriterium (PR 0, Abschnitt 6). Liegt er nicht paarweise
  über dem Ist-Stand, bleibt das heutige Konzept, und Chris entscheidet über die ehrlichere
  Abnahme. Nach der verfehlt I-Spy heute nur noch eine von vier Bedingungen, und zwar knapp
  (Star auf Rang 1 bei 47,5 % gegen 50 %, Abschnitt 3.5).

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Was ein Tick heute tut

`ispySeiteTick()` (`engine.js:15102-15267`), je Seite und Tick, zwölf Truhen auf dem **eigenen**
Brett (`ispyBaueRaum()`, `:15060`):

1. **Reaktionswurf** (`:15106-15133`): ein `rr()`. Gab es drüben im Vortick einen sichtbaren Fund
   (Akte-Erfolg oder Tresor), wird mit `0,30 + Ø TEAMGEIST·0,006` ein Läufer bestimmt. Das ist
   der Beste im Knack-Sub-Skill der gemeldeten Art. Er bekommt für diese eine Truhe **+0,15** auf
   seine Sichtschwelle (`ISPY_HINWEIS_BONUS`, `:14744`).
2. **Reihenfolge** (`:15177-15180`): deterministisch nach `0,3·NERVEN + 0,7·Ø(LOGIK,
   MENSCHENKENNTNIS, FINGERFERTIGKEIT)`.
3. **Je Spieler in dieser Reihenfolge:**
   - **Spürwurf**, ein `x=rr()` für alle drei Stufen (`:15203-15209`). Notizen sind immer
     sichtbar. Eine Akte ist sichtbar, wenn `x < 0,20 + 0,010·SPÜRSINN`, ein Tresor, wenn
     `x < 0,013·SPÜRSINN` (`:14805-14806`).
   - **Wahl F2** (`:15212-15217`): `argmax(Punktwert · Wegfaktor · Knackchance)` unter den
     sichtbaren, **nicht belegten** Truhen. Eine gewählte Truhe ist für den Rest des Ticks
     belegt (`belegt`, `:15184`, Ausnahme: die Zieltruhe des Läufers).
   - **Knackwurf** (2RN, `:15231`): Erfolg bringt den vollen Punktwert (10/25/60) und leert die
     Truhe. Ein Fehlschlag bringt **55 %** davon (`ISPY_TEILPUNKTE_ANTEIL`, `:14776`) und +0,15
     Fortschritt.
4. **Nachfüllen** (`:15256-15265`): Eine geleerte Truhe zieht die nächste Stufe aus ihrer
   art-eigenen Folge (seit `af9dc3ff`).

Acht Ticks, sechs Spieler je Seite, also 48 Züge je Seite. `wert()` ist die Summe der eigenen
Punkte.

### 0.2 Was eine Truhe wirklich auszahlt

| Stufe | Erfolg | Fehlschlag (55 %) | Spanne, die das Knacken entscheidet | EV-Wahl F2 rechnet mit |
|---|---:|---:|---:|---|
| Notiz | 10 | 6 | 4 | `10·p` |
| Akte | 25 | 14 | 11 | `25·p` |
| Tresor | 60 | **33** | 27 | `60·p` |
| Tresor über Nebenweg (0,65) | 39 | 21 | 18 | `39·p` |

Die Spalte „Fehlschlag" ist der Kern der Taktikfrage. Jeder Tresorversuch bringt mindestens 33,
jede Akte höchstens 25, jede Notiz höchstens 10. Die Stufe **dominiert strikt**, unabhängig von
Knackchance, Fortschritt oder Ermüdung. Das Knacken entscheidet nur noch innerhalb einer Stufe,
etwa 45 % ihres Werts. Wie viele Punkte ein Spieler holt, entscheidet vor allem, **welche Stufe er
überhaupt bekommt**.

Knack-Sub-Skill 30 gegen 85, am Tresor: `p` 0,08 gegen 0,645, also 35 gegen 50 Punkte je Versuch.
**Zugang** zum Tresor gegen Akte beim selben 30er: 35 gegen 17. Der Zugang wiegt mehr als das
Können am Schloss.

### 0.3 Der Spürwurf ist fast ein Münzwurf

Nach Kalibrierrunde 2 liegen `sieht2` und `sieht3` für mittlere Spieler praktisch aufeinander:

| SPÜRSINN | sieht Tresor + Akte | sieht nur Akte | sieht nur Notizen |
|---:|---:|---:|---:|
| 40 | 52 % | 8 % | 40 % |
| 60 | 78 % | 2 % | 20 % |
| 80 | 90 % | 5 % | 5 % |

Jeder Tick ist damit für jeden Spieler im Kern eine Münze: „Tresor möglich" (33–60 Punkte, wenn
frei) oder „nur Notiz" (6–10). Der Unterschied beträgt rund **30 Punkte je Tick**. Über acht Ticks
ergibt das bei einem 60er eine Standardabweichung von grob 30·√(8·0,78·0,22) ≈ **35 Punkten**. Der
erwartete Abstand zwischen einem 40er und einem 60er beträgt grob 8·30·0,26 ≈ **62 Punkte**. Für
weit auseinanderliegende Paare reicht das. Für nahe Paare entscheidet die Münze.

### 0.4 Messstand heute (selbst gemessen, 26.09.)

```
node scripts/miss-alle-disziplinen.mjs 24 i-spy
i-spy  buehne  12  rho je Spiel 0.756 (Spw 0.170)  rho Saison 0.909 (Spw 0.184)  knapp

node scripts/miss-star-paartreue.mjs 24 i-spy
Star Rang1 47.5%  Top2 75.8%  Letzter 0.0%  Paartreue(>=15) 95.0% (n=3271)
```

Die Verlässlichkeit ist damit `(0,756/0,909)² = 0,692`. Für 0,80 bei dieser Validität bräuchte
es `(0,80/0,909)² = 0,775`, also **+0,08 Verlässlichkeit ohne einen Punkt Validitätsverlust.**

---

## 1. Bestandsaufnahme: Wie viel Taktik steckt heute drin?

„Taktische Entscheidung" heißt hier: Ein Akteur wählt zwischen Optionen mit unterschiedlichem
Risiko und Ertrag, und die richtige Wahl hängt von etwas ab, das nicht schon vorher feststeht (dem
eigenen Profil, dem Spielstand, dem Gegner). Weil die Olympiade ein Manager-Spiel ist, zählen zwei
Ebenen: die **Figuren im Spiel** (KI) und **Chris vor dem Spiel** (Aufstellung und Slots).

### 1.1 Die fünf Stellen, an denen es Entscheidungen geben könnte

| Ebene | Heute | Echte Entscheidung? |
|---|---|---|
| **Welche Truhe?** (Spieler) | F2: `argmax(Punktwert·p)` | **Nein.** Mit der tatsächlichen Auszahlung (0.2) dominiert immer die höchste sichtbare Stufe. F2 rechnet mit einer Nutzenfunktion, die nicht zur Auszahlung passt. Spieler unter ~41 im Knack-Sub-Skill wählen deshalb „vorsichtig" eine Akte, obwohl der Tresor ihnen doppelt so viel brächte. Das ist keine Abwägung, sondern eine eingebaute Schwäche für schwache Spieler. |
| **Weitermachen oder aufhören?** (Spieler) | gibt es nicht | Jeder Tick ist unabhängig. Fortschritt an einer Truhe ist seitenneutral und wird nicht geplant. Es gibt kein „bleib dran" und kein „lass es". |
| **Wer macht was?** (Team) | feste Reihenfolge, gierige Verteilung (`belegt`) | **Nein.** Eine Serienverteilung nach festem Schlüssel. Niemand spezialisiert sich, niemand deckt ab, niemand hilft. |
| **Was macht der Gegner?** (Team gegen Team) | Hinweis +0,15 auf eine eigene Truhe, 27 % Folgequote | **Kaum.** Die Räume sind getrennt, der Fund drüben verrät über den eigenen Raum nichts (Fable 22.09., Abschnitt 1.1). Wer reagiert, gewinnt nichts, das er nicht auch ohne Reaktion hätte. Gemessen neutral: Reaktion aus 0,757 gegen 0,756. |
| **Wie stelle ich auf?** (Chris) | Slot gibt `slotAufschlag()` bis ±8,5 auf einige Attribute (`engine.js:5459-5466`, `:13872`) | **Schwach.** Die Slotnamen versprechen Rollen, die der Raum nicht kennt. Anders als die Bahn (`planJeSlot`, `:21738`, Sprint/Zeitfahren/Climbing) wählt Chris keinen Spielplan. |

### 1.2 Ehrliches Urteil

I-Spy ist **kein reiner Zufallswurf mit Escape-Room-Kulisse**. Die Wahrscheinlichkeiten hängen am
Können, und die Saison-Validität von 0,909 zeigt, dass die Richtigen vorn liegen. Aber es ist ein
**Glücksrad mit Gewichten**: Wer mehr SPÜRSINN hat, hat breitere Gewinnfelder, und wer in der
Reihenfolge vorn steht, darf zuerst drehen. Es gibt nichts, was ein Spieler oder ein Team anders
machen könnte. Die sichtbaren Bausteine, die nach Taktik aussehen (EV-Wahl, Läufer, Fortschritt,
Nebenweg), sind entweder Formeln ohne Alternative oder wirken so selten, dass sie nicht zählen. Der
Nebenweg wird in 3,71 % der Züge genutzt (Gegencheck 2, Abschnitt 4).

Der Hinweis-Mechanismus ist nach Fables Umbau **rho-sauber**, aber **taktisch zu dünn**. Der Grund
liegt nicht in der Dosis (+0,15 ist gemessen die Obergrenze), sondern in der Architektur. Weil die
Räume getrennt sind, hat die Information keinen Inhalt. Die Figur „hört den Jubel drüben" und
erfährt dabei nichts, was sie über den eigenen Raum nicht schon wüsste. Kein Hinweisspiel
funktioniert so. Bei Cluedo, Scotland Yard und Werwolf ist die Information genau deshalb wertvoll,
weil sie etwas über **dieselbe** verborgene Lösung verrät.

---

## 2. Was Deduktions- und Schatzsuchspiele taktisch trägt

Sieben Vorbilder, jeweils mit dem einen Mechanismus, der für I-Spy zählt:

| Vorbild | Mechanismus | Was er in I-Spy lösen würde |
|---|---|---|
| **Echte Escape-Rooms** (Nicholson 2015, Umfrage unter 175 Anbietern) | Rätsel sind am häufigsten **pfadbasiert** organisiert (45 %): mehrere parallele Rätselketten, deren Ergebnisse in ein **Meta-Rätsel** münden. Sequenziell folgt mit 37 %. „Offen" (viele Rätsel zugleich, jedes liefert ein Stück) kommt nur in 13 % vor. Pfadbasiert gilt als die Form, in der verschiedene Teammitglieder parallel an verschiedenen Pfaden arbeiten. | I-Spy ist heute **offen und ohne Meta-Rätsel**: zwölf gleichzeitig zugängliche Truhen, deren „Stück" nur eine Punktzahl ist. Genau die Form, die im echten Genre die seltenste ist, und die Funde fügen sich zu nichts zusammen. → P1 (Spuren = Pfade), P4 (Meta) |
| **Score-Orientierungslauf / Rogaining** | Posten mit Punktwerten nach Schwierigkeit und Entfernung, freie Reihenfolge, feste Zeit, Strafe für Zuspätkommen. Die Wahl, welche Posten sich für **mich** lohnen, hängt an Fitness und Navigationskönnen. Van Bulck (2026) behandelt dem Titel nach, wie man Kurse zwischen physischen und kognitiven Fähigkeiten auslegt. Das ist die Budget-Frage des Projekts. Den Volltext konnte ich nicht lesen, der Verlag lieferte 403. | Die Zeit ist die Währung, nicht der Würfel. Ein Tresor kostet mehr Ticks, eine Notiz weniger. „Lohnt sich das noch vor dem Pfiff?" ist eine echte Endspielentscheidung. → P1 |
| **Diamant / Incan Gold** (Push-your-luck) | Tiefer in die Höhle bringt mehr, aber das Risiko wächst. Wer zu spät aussteigt, verliert das Gesammelte. | „Tiefer graben" nach der besseren Truhe gegen „jetzt knacken": eine Entscheidung, deren richtige Antwort vom eigenen Profil abhängt. → P1 |
| **The Crystal Maze** | Sechs Kandidaten, vier Spielkategorien (körperlich, geistig, Geschick, Mystery). Das Team **wählt, wer welches Spiel spielt**. Wer im Spiel festsitzt, ist gesperrt. Kristalle werden zu Sekunden im Finale. | Die Kategorien sind fast wörtlich Mechanik/Logik/Verhör plus Suche. Die Zuordnung Person → Aufgabe ist eine Aufstellungsentscheidung, also Chris' Slots. → P2 |
| **The Amazing Race** (Detour/Roadblock) | Detour: eine Wahl zwischen zwei Aufgaben mit verschiedenem Anforderungsprofil (eher körperlich oder eher Denken und Geduld), wechselbar. Roadblock: Das Team bestimmt **vorher**, wer die Aufgabe macht, und kennt dabei nur einen vagen Hinweis. | Die Detour ist der Primär-/Nebenweg der Mehrwege-Leitlinie, als echte Wahl statt Formel. Der Roadblock ist die Slot-Entscheidung unter Unsicherheit. → P2 |
| **Fort Boyard** | Zwei Phasen: Aufgaben bringen Schlüssel (Pflicht) und **Hinweiswörter**. Am Ende muss das Team aus den Hinweisen ein Passwort erschließen. Jeder weitere Hinweis macht das Finale leichter. | „Schatzsuche nach **Informationen**", wörtlich Chris' Satz. Heute ist die Information nur eine Zahl. Bei Fort Boyard ergeben die Funde zusammen etwas. → P4 |
| **Cluedo, Scotland Yard, Werwolf; Clank!** | Die Information betrifft **dieselbe** verborgene Lösung für alle. Wer etwas verrät (eine Frage, ein Gesichtsausdruck, ein Geräusch), gibt dem Gegner Wissen, nicht Züge. Clank!: Wer Schätze einsteckt, macht Lärm und zieht Aufmerksamkeit auf sich. | Chris' „kein Pokerface, er freut sich sichtbar". Bekommt der Jubel Inhalt, wird die Reaktion kausal, ohne dass jemand einen Zug geschenkt bekommt oder verliert. → P3 |

Was sich aus allen sieben ergibt, sind vier Zutaten, die I-Spy heute fehlen:

1. **Zeit als Einsatz.** Eine bessere Truhe kostet Zeit, nicht nur Glück.
2. **Abbruchentscheidungen.** Weitergraben oder jetzt nehmen.
3. **Zuordnung Person → Aufgabe** als Entscheidung des Teams.
4. **Information, die etwas über die eigene Lösung verrät.**

Keine davon verlangt, dass der Gegner Züge nimmt oder schenkt. Das ist die Regel, an der jede
frühere Idee (Gate, Duell am Fundort, Freilos-Läufer) gemessen gescheitert ist.

---

## 3. Diagnose: Konzept- oder Zahlenproblem?

### 3.1 Was schon gedreht wurde

Die Zahlen sind durchgesucht. Aus den Commit-Texten von `021e1d91` und `0f812538` und den beiden
Gegenchecks:

| Schraube | Gemessen | Ergebnis |
|---|---|---|
| Knackformel (K, Stufenabzug, Basis, Deckel) | 15+ Werte | alle ≤ Ist, „lokales Optimum" |
| Punktwerte (7 Varianten flacher, 1 steiler) | alle | alle schlechter |
| Nebenweg-Faktor 0,40–1,00 | 8 Werte | flach |
| Reihenfolge NERVEN-Anteil 0–1 | 7 Werte | flaches Optimum bei 0,3 |
| Sichtkurve (Basis/K, zwei Stufen) | ~15 Paare | **+0,041**, danach lokales Optimum |
| Teilpunkte 0,30–0,60 | 7 Werte | flaches Optimum bei 0,50–0,55 |
| Reaktionsdosis 0/0,15/0,30/1,0 | 4 Werte | monoton; +0,15 gewählt |
| Nachfüllfolge art-eigen | 1 | Voraussetzung, kein Hebel |
| Tickzahl 8 → 12/16/24 (Gegencheck 2) | 3 | ≤ +0,02 |

Jede Richtung ist an ihrem Optimum angekommen. Die einzige Schraube, die spürbar bewegte, war die
Sichtkurve, und die sitzt genau im Kanal, der in 3.3 als Doppelrolle aus Signal und Rauschen
auffällt.

### 3.2 Neue Diagnosemessungen (26.09., Stand `main` `6b471366`)

Kaderfest, fünf Paarungen, 24 Spiele je Paarung, `node scripts/miss-alle-disziplinen.mjs 24 i-spy`
über eine gepatchte Kopie der Engine, danach zurückgesetzt. Median über die Paarungen,
Verlässlichkeit als `(Spiel/Saison)²`:

| Variante | Frage dahinter | rho Spiel | Spw | rho Saison | Verlässl. |
|---|---|---:|---:|---:|---:|
| **Ist-Stand** | — | **0,756** | 0,170 | **0,909** | 0,692 |
| Reaktion aus | Trägt der Hinweis? | 0,757 | 0,183 | 0,909 | 0,694 |
| **16 statt 8 Ticks** | Fehlen Ereignisse, jetzt, wo das Nachfüllen repariert ist? | 0,767 | 0,137 | 0,902 | 0,723 |
| **F2 rational** (EV mit Teilpunkten) | Ist die einzige Wahl eine Abwägung oder ein Rechenfehler? | 0,737 | 0,163 | **0,867** | 0,723 |
| ohne `belegt` | Trägt die Verteilung des knappen Guts? | 0,697 | 0,246 | 0,839 | 0,690 |
| **entrauschter Kern** (Sicht als Faktor auf EV und Chance, Auszahlung = Erwartungswert, Reaktion aus) | Was ordnet die Mechanik ohne Würfel? | **0,773** | 0,123 | **0,804** | **0,924** |
| entrauschter Kern ohne `belegt` | Was kostet die Verteilung, wenn das Rauschen sie nicht mehr verdeckt? | **0,785** | 0,221 | 0,888 | 0,781 |

Vorbehalt: Das sind Mediane über fünf Paarungen. Unterschiede unter ~0,03 im Spielwert sind von
Kaderrauschen nicht zu trennen (`docs/design/messgrundlage-kaderfest.md`). Paarweise Vergleiche
wurden für diese Diagnose nicht gezogen. Tragfähig sind die großen Bewegungen: die Validität unter
Entrauschen (−0,105), unter rationaler Wahl (−0,042) und ohne Verteilung im entrauschten Kern
(+0,084).

### 3.3 Was die Zahlen sagen, in vier Sätzen

**(1) Mehr Ereignisse helfen auch jetzt nicht.** 16 Ticks bringen +0,011 bei doppelter Spielzeit.
Die Hockey-Lehre gilt auch nach dem Nachfüll-Fix, der sie laut Gegencheck 2 hätte verfälschen
können. Die Uhr ist ausgeschlossen.

**(2) Signal und Rauschen sitzen im selben Kanal.** Wird der Spürwurf zum Faktor und die Auszahlung
zum Erwartungswert, steigt die Verlässlichkeit auf 0,924. Das ist fast so hoch wie Showcase
(0,926), die verlässlichste Bühne. Gleichzeitig fällt die Validität von 0,909 auf 0,804. Das
Würfeln am Spürtor ist also nicht nur Lärm. Es **glättet** eine Stufenfunktion. Ohne Würfel greift
jeder Tick dieselbe Rangfolge ab: Der Erste in der Reihenfolge bekommt den Tresor, der Zweite den
anderen, der Rest Akten. Die Punkte hängen dann am **Teamrang**, nicht an der absoluten Eignung.
Der drittbeste Spieler eines starken Teams bekommt Akten, während der beste eines schwachen Teams
Tresore bekommt. Mit Würfel wird aus der Stufe eine Wahrscheinlichkeit, die stetig mit dem Können
wächst, und die korreliert besser mit der linearen Eignung. Genau deshalb tauschen sich Validität
und Verlässlichkeit in jeder bisherigen Messreihe gegeneinander (Gegencheck 2, Abschnitt 6: bester
Stapel 0,892/0,811). **Jede Zahl an diesem Kanal verschiebt nur den Punkt auf derselben Kurve.**

**(3) Die Verteilung des knappen Guts ist der zweite Teil desselben Problems.** Im verrauschten
Spiel hilft `belegt` (0,756 gegen 0,697 ohne), weil die Reihenfolge nach Kompetenz ein Eignungskanal
ist. Im entrauschten Kern schadet es: Validität 0,804 mit, 0,888 ohne. Auch ohne `belegt` bleibt
ein Rest geteilten Zustands. Wer im selben Tick früher knackt, leert die Truhe für die Späteren.
Das erklärt, warum die Verlässlichkeit dort auf 0,781 zurückfällt. **Solange sechs Spieler um
dieselben zwei Tresore konkurrieren, hängt der eigene Punktestand an Würfen der Mitspieler.** Das
ist fremde Hand innerhalb des Teams. Sie wurde bisher nie so benannt, weil sie als „Konkurrenz um
Fundorte" rho-positiv gemessen wurde (Gegencheck 2, 1.3). Positiv war sie aber nur relativ zum
verrauschten Ist-Stand.

**(4) Die einzige Wahl ist eine eingebaute Schwäche, keine Entscheidung.** Rechnet F2 mit der
echten Auszahlung inklusive Teilpunkten, fällt die Validität von 0,909 auf 0,867. Der Rechenfehler
trägt also rund 0,04 Validität. Er tut das, indem er schwache Spieler systematisch zu schlechteren
Truhen schickt, als ihnen zustünden. Das verstärkt den Abstand, ist aber das Gegenteil einer
Taktik. Rechnete man F2 richtig, gäbe es keine Wahl mehr: Alle nähmen immer den höchsten sichtbaren
Fundort (0.2).

### 3.4 Hypothese

**Das rho-Plateau ist ein Konzeptproblem, kein Zahlenproblem.** Genauer: Es ist ein Problem der
**Tick-Auflösung**, nicht des Themas und nicht der Matrix. Drei Eigenschaften des Kerns erzeugen
es gemeinsam:

1. **Ein Tor je Tick trägt Signal und Rauschen zugleich.** Der Spürwurf, fast binär, ±30 Punkte,
   ist der Hauptträger der Eignung (SPÜRSINN = intelligence 60, das Attribut mit der stärksten
   Eignungskorrelation, r = 0,650) und zugleich die Hauptquelle der Streuung.
2. **Die Punkte kommen aus der Verteilung eines knappen, gemeinsamen Guts.** Zwei Tresore je Team
   und Tick, verteilt nach Rang. Das koppelt den Einzelwert an den Teamrang und an Würfe der
   Mitspieler.
3. **Es gibt keine Entscheidung, über die sich das Können zusätzlich ausdrücken könnte.** Nur
   einen Rechenfehler, der wie eine wirkt.

Die Folge: Wer das Rauschen senkt, legt die Rangkopplung frei. Wer die Rangkopplung löst, behält
das Rauschen. Wer beides zugleich versucht, landet gemessen bei 0,785. Das erklärt die flachen
Optima aller Schrauben. **Mit den heutigen Bausteinen ist 0,80 nicht erreichbar.** Das gilt in der
Tendenz, nicht als Beweis: Der Abstand beträgt 0,015–0,045, bei einer Median-Unschärfe von ~0,03.

Was ausdrücklich **nicht** die Ursache ist:

- **Die Matrix.** Sie ist breit (zehn Attribute) und enthält zwei matrixschwere, aber auf dem
  Abnahmekader schwach korrelierte Attribute (torment r = 0,038, spirit r = 0,194). Trotzdem
  erreicht der Motor 0,909 Validität. Die Breite drückt nicht die Validität, sie macht nur viele
  Paare mit kleinem Abstand, die kein Motor ordnen soll (CLAUDE.md). Das Escape-Room-Thema passt
  sogar gut dazu: Verhör = torment/charisma, Team = spirit, Fingerfertigkeit = dexterity/speed.
- **Die Punktwerte, die Knackformel, der Hinweis.** Durchgemessen, am Optimum, bzw. neutral.
- **Zu wenige Ticks.** Siehe (1).

### 3.5 Die Gegenposition, fair gestellt

Man kann auch sagen: **Das Konzept ist gut genug, und die Schranke ist für diese Disziplin die
falsche.** Nach der „ehrlicheren Abnahme" aus CLAUDE.md (Star und Paartreue mit Abstand) steht
I-Spy heute bei:

| Bedingung | Ziel | I-Spy heute |
|---|---|---|
| rho Saison | ≥ 0,85 | **0,909 ✓** |
| Star auf Rang 1 | ≥ 50 % | 47,5 % ✗ |
| Star in den ersten zwei | ≥ 75 % | **75,8 % ✓** |
| Star nie Letzter | 0 % | **0,0 % ✓** |
| Paartreue (≥ 15 Punkte Abstand) | ≥ 95 % | **95,0 % ✓** |

Drei von vier Bedingungen sind erfüllt, die vierte fehlt um 2,5 Prozentpunkte. Hockey, das
Vorzeigebeispiel für diese Abnahme, liest 58 %/78 %. Der Unterschied ist klein. Wer nur nach der
Zahl fragt, könnte I-Spy mit einer Kommentarzeile „abnehmen".

**Das widerspricht dieser Hypothese nicht, es ergänzt sie.** Die Frage, ob I-Spy die Zahl erreicht,
ist nicht dieselbe wie die, ob es ein gutes Spiel ist. Chris hat die zweite gestellt. Die Antwort
darauf (Abschnitt 1) lautet: Es ist ein sauber gewichtetes Glücksrad ohne Entscheidungen. Selbst
wenn eine Abnahmedebatte das Zahlenthema schließt, bleibt das Taktikthema offen. Die Vorschläge
unten zielen auf beides zugleich. Ihr Maßstab ist, dass die Zahl mindestens gleich bleibt, während
die Entscheidungen entstehen.

---

## 4. Vorschläge für einen Gameplay-Umbau, nach Priorität

Leitplanken, die aus der Projektgeschichte folgen und in jedem Vorschlag eingehalten sind:

- Matrix unangetastet, kein `power` (CLAUDE.md, Gegencheck 1).
- Keine Züge durch fremde Hand, weder genommen (Gate, K-C) noch geschenkt (Freilos-Läufer).
- Getrennte Räume je Seite bleiben (ein geteilter Pool maß 0,53).
- Vorab rechenbar, fester `rr()`-Verbrauch (Handbuch-Falle 17).
- Pp ≤ 25 in zwei Saatstämmen.

### P1 — „Spur statt Los": eigene Spuren, angesammelter Spürsinn, eine echte Entscheidung

**Entscheidet über die Schranke. Einziger Vorschlag, der die Diagnose 3.4 direkt angreift.**

**Kernidee.** Jeder Spieler verfolgt zu jedem Zeitpunkt **seine eigene Spur**, einen Fundort, den
nur er bearbeitet. Das ist die pfadbasierte Organisation echter Escape-Rooms (Abschnitt 2). Eine
Spur hat zwei Phasen, und beide sammeln sich über Ticks an, statt einmal je Tick zu würfeln:

1. **Spüren, ansammelnd.** Solange ein Spieler sucht, wächst sein Spurwert je Tick um
   `SPÜRSINN·k·(0,75 + 0,5·rr())` (Vorschlag). Jede überschrittene Schwelle **hebt die Stufe der
   Truhe, die er gefunden hat**: Notiz → Akte → Tresor. Das ist Chris' „schneller analysieren",
   diesmal wörtlich als Zeit. Ein 80er erreicht den Tresor in zwei Ticks, ein 40er in vier. Das
   Rauschen je Tick ist klein gegen den Mittelwert, und über die Ticks mittelt es sich weg: Aus
   einer Münze je Tick wird eine Summe. Diesen Hebel hat die Diagnose gesucht, **mehr
   Einzelereignisse ohne mehr Uhr**.
2. **Knacken.** Hat er gefunden, was er will, knackt er. Das kostet einen Tick, einen Wurf gegen
   den Knack-Sub-Skill der Rätselart, mit Primär- und Nebenweg wie heute. Danach beginnt eine neue
   Spur.

**Die Entscheidung: tiefer graben oder jetzt knacken.** Nach jedem Spürtick fragt die Figur: Nehme
ich, was ich habe, oder grabe ich weiter nach der nächsten Stufe? Das ist Push-your-luck
(Diamant) mit Zeit als Einsatz (Score-OL):

- Weitergraben kostet Ticks und bringt eine wertvollere Truhe mit **niedrigerer** Knackchance.
- Knacken jetzt bringt sichere, kleinere Punkte und eine neue Spur.
- Der **Pfiff** (Tick 8) begrenzt alles. Eine angefangene Tresorspur, die nicht mehr geknackt
  wird, bringt nur ihre Fundpunkte (siehe unten). Das ist das Endspiel, das Rogaining so spannend
  macht.

Die richtige Antwort hängt am **eigenen Profil**:

- Ein starker Spürer mit schwachem Knacken sollte früh nehmen und oft knacken.
- Ein schwacher Spürer mit starkem Knacken sollte lange graben und den Tresor sicher öffnen.
- Ein Allrounder sollte bis zum Tresor graben.

Die KI wählt nach dem echten Erwartungswert je Tick (Punkte pro verbleibender Zeit), also rational
statt wie F2 heute mit dem falschen Nutzen. Das ist rho-sicher, solange die optimale Politik
**monoton im Können** ist: Wer besser ist, hat die bessere Politik zur Verfügung und holt aus ihr
mehr. Genau dafür gibt es die Messung in PR 0.

**Zwei Konten statt Teilpunkten.** Heute bringt ein gescheiterter Tresor 33 Punkte, das sind
Teilpunkte, die in Wahrheit Fundpunkte sind. P1 macht das ehrlich:

- **Fundpunkte** entstehen beim Finden (Notiz 4 / Akte 10 / Tresor 25, Vorschlag) und hängen am
  **Spürsinn**.
- **Lösungspunkte** entstehen beim Knacken (Notiz 6 / Akte 15 / Tresor 35) und hängen am
  **Knack-Sub-Skill**.

Zwei getrennte, jeweils eignungsgetragene Konten sind **additiv** in den beiden Fähigkeiten. Die
Punktformel wird damit der linearen Eignung ähnlicher, statt heute multiplikativ (Sicht × Knacken)
und über ein Maximum. Im Ticker ergibt sich die Erzählung von selbst: „Cassandra findet die
Akte (+10) … bekommt sie aber nicht auf." Das ist Chris' „Schatzsuche nach **Informationen**": Der
Fund selbst ist schon etwas wert.

**Was aus dem knappen Gut wird.** Es verschwindet: Jeder hat seine eigene Spur. Der Raum bleibt als
Bild (zwölf Fundorte, drei Arten, drei Stufen), aber eine Spur **wählt** sich einen freien
Fundort der gewünschten Art. Zwölf Fundorte für sechs Spieler reichen immer. Die Reihenfolge
entscheidet nur noch, wer bei Gleichstand welches Möbelstück bekommt, nicht mehr, wer Tresore
darf. Die Rangkopplung aus 3.3 (3) fällt damit weg. Stellvertretend gemessen („entrauschter Kern
ohne `belegt`") steigt die Validität der Kernmechanik dadurch von 0,804 auf 0,888.

**Welche Art wählt eine Spur?** Die Art, deren Knack-Sub-Skill beim Spieler am höchsten ist, mit
einem Nebenweg-Abschlag, wie heute. Das hält die Matrixanteile der Arten über die Spieler statt
über die Fundortverteilung. Weil die Art dann dem Profil folgt, braucht der Ausgleich eine eigene
Budget-Messung (Pp, zwei Stämme). Der Verteilungsnachweis wandert damit von „Punktmasse der
Fundorte" (Gegencheck 1, 3.2) zu „Punktmasse der Spuren".

**rho-Rechnung (Schätzung, nicht gemessen).** Als Validität des Kerns ohne Rangkopplung nehme ich
die gemessenen 0,888 (entrauschter Kern ohne `belegt`). Die zwei Konten sollten sie eher heben als
senken, weil sie die Formel additiver machen. Als Verlässlichkeit schätze ich 0,80–0,88: Der
ansammelnde Spürsinn liegt zwischen der heutigen Münze (0,69) und dem vollständig entrauschten
Kern (0,92), und die Push-your-luck-Entscheidung bringt eigenes Rauschen zurück. Daraus folgt
`0,888·√0,80 … 0,888·√0,88` = **0,79–0,83**. Nimmt man eine Validität von 0,86 bis 0,91 dazu,
ergibt sich ein Band von **0,78–0,84**. Das reicht nicht, um ohne Prototyp zu bauen. Es reicht, um
einen Prototyp zu rechtfertigen.

**Was P1 von Chris' Konzept behält.** Finden und Knacken, drei Stufen, drei Arten, die Punktwerte
in ihrer Rangfolge, den Mehrwege-Tresor, den Fortschritt (eine angebrochene Truhe, die jemand
anderes übernimmt, wird zu einer Spur mit Vorsprung), das Bühnenbild, die Lupe, den Ton, die Tür
als Bild.

**Was P1 streicht.** Den Spürwurf je Tick, `belegt` als Verteilungsregel, F2 in der heutigen Form,
`ISPY_TEILPUNKTE_ANTEIL` (wird durch die zwei Konten ersetzt).

### P2 — „Slots werden Spielpläne": Chris bekommt Taktik, und die Mehrwege-Leitlinie wandert ins Finden

**Größter Taktikgewinn für Chris. Zweite Priorität, weil er erst auf dem P1-Kern Sinn ergibt.**

**Spielpläne.** Die Bahn-Disziplinen haben das Muster schon: `plaene` plus `planJeSlot`
(Sprint/Zeitfahren/Climbing, `engine.js:21738`, `:26343`, `:26557`, `:26638`). Der Slot bestimmt
den Plan, also **wie** eine Figur läuft. Für I-Spy wären die sechs Slots sechs Haltungen zur
P1-Entscheidung „graben oder knacken" und zu den Nebenwegen (Vorschlag):

| Slot | Plan | Wirkung |
|---|---|---|
| **Observer** | Späher | gräbt länger (höhere Stufenschwelle), sucht bevorzugt Tresore |
| **Logic Chain** | Knacker | nimmt früh, knackt oft, bevorzugt Logik |
| **Pattern Lock** | Kombinierer | bevorzugt, was die Team-Indizienkette (P4) schließt; ohne P4 wie Logic Chain |
| **Social Read** | Leser | liest die Gegenseite (P3): bekommt den Hinweis aus einem fremden Fund, bevorzugt Verhör |
| **Quiet Move** | Schleicher | seine Funde sind für die Gegenseite **nicht** sichtbar (Pokerface, P3), bevorzugt Mechanik |
| **Reveal** | Abräumer | übernimmt angebrochene Truhen des eigenen Teams (Fortschritt), nimmt früh |

Damit wird die Aufstellung, die heute eine Attributrechnung ist, zur Crystal-Maze-Frage: **Wen
schicke ich in welche Rolle?** Ein Späher mit schwachem Knacken verbrennt seine Tresore, ein
Knacker mit Spürsinn 90 verschenkt Stufen. Die Entscheidung hat eine richtige Antwort, die vom
Profil abhängt, genau wie Chris es für alle Disziplinen will.

**Das rho-Risiko ist benennbar.** Ein falsch gesetzter Plan senkt die Punkte eines guten Spielers,
und die Abnahme misst dann Chris' Aufstellung mit. Die Bahn lebt mit demselben Risiko. Die
Abnahme misst mit der Standardaufstellung (`slotFuer()` verteilt der Reihe nach, `:13857`). Dazu
kommt eine eigene Probe „Plan gegen Profil": Jeder Spieler in jedem Plan. Diese Probe muss zeigen,
dass kein Plan einen Spieler **unter** seinen Eignungsrang drückt, wenn er zu seinem Profil passt.

**Mehrwege ins Finden.** CLAUDE.md macht „mehrere Wege zum Erfolg" zur Leitlinie, und I-Spy ist
ihr Präzedenzfall. Heute wird sie gemessen fast nicht genutzt (3,71 %), und zwar strukturell: Die
Wege sitzen im Knacken, das nur rund 45 % des Truhenwerts entscheidet. Das Finden, das über den
Zugang entscheidet, hat genau einen Weg, SPÜRSINN (intelligence/torment/awareness). Wer nicht
intelligent ist, findet keinen Tresor, egal was er sonst kann. Vorschlag: Das Finden bekommt einen
Primärweg und zwei Nebenwege, jeweils mit anderer Attributmischung. Das ist Chris' Satz „jeder
Spieler hat seine eigene Herangehensweise", dort angewandt, wo er zählt:

| Weg | Bild | Attribute (Vorschlag, matrixlegal) | Stellung |
|---|---|---|---|
| **Beobachten** | Lupe, Details im Raum | intelligence, awareness, torment | Primär (voller Spurzuwachs) |
| **Befragen** | Zeuge/Informant im Raum | charisma, torment, spirit | Nebenweg (Zuwachs × 0,8) |
| **Beschatten** | Gegner belauschen, Spuren am Boden | dexterity, speed, will | Nebenweg (Zuwachs × 0,8) |

Die Figur nimmt automatisch den für sie besten Weg (wie `ispyBesterWeg()`), der Plan kann ihn
vorgeben. Das Budget muss zeigen, dass die Summe aus Spür- und Knackwegen die Matrix trifft. Die
Wege verteilen dieselben Attribute um, sie fügen keine hinzu.

### P3 — „Ein Fall, zwei Räume": Die Reaktion bekommt Inhalt

**Repariert, was Fable in der Architektur gefunden hat. Die Reaktion ist heute Theater, weil der
Fund drüben nichts über den eigenen Raum verrät.**

**Kernidee.** Beide Teams lösen **denselben Fall** in zwei baugleichen Räumen. Zu Spielbeginn legt
die Saat fest, in welchem Fundort (je Art einer) das **Schlüsselindiz** liegt. Wer es knackt,
bekommt einen Bonus (Vorschlag: +50 % Lösungspunkte), und es ist in beiden Räumen **an derselben
Stelle**. Ein sichtbarer Jubel drüben an Fundort 7 heißt damit: An Fundort 7 **in meinem Raum**
könnte etwas liegen. Das ist Cluedo- und Scotland-Yard-Information. Sie betrifft dieselbe Lösung,
und ihr Wert ist echt.

- **Wer reagiert,** bekommt keinen Zug geschenkt. Seine Spur bekommt einen **Vorsprung zu diesem
  Fundort**, wie der heutige +0,15-Hinweis, nur dass es jetzt einen Grund gibt. Ob sich der
  Wechsel lohnt, entscheidet seine eigene Rechnung: Wer auf einer fast fertigen Tresorspur sitzt,
  bleibt.
- **Pokerface gegen Menschenkenntnis.** Ob ein Fund sichtbar wird, ist nicht mehr nur eine
  Stufenregel (S-c), sondern ein kleines Duell. Die Beherrschung des Finders (will/spirit, für den
  Schleicher-Plan zusätzlich dexterity) steht gegen das Lesen der Gegenseite (torment/charisma, für
  den Leser-Plan verstärkt). Werwolf in einem Wurf, und Chris' „kein Pokerface" wird eine
  Eigenschaft der Figur statt eine Regel für alle. Der erste Konzeptentwurf (3.1, `leitePers()`)
  hat diese Idee schon notiert und nur wegen der Messbarkeit zurückgestellt. Mit P1 ist der Kanal
  klein genug, um ihn zu messen.
- **Die Regel „keine fremde Hand" hält.** Der Gegner nimmt nie einen Zug und schenkt nie einen. Er
  verändert nur, was die andere Seite weiß. Das sind Fables fünf Kriterien (Reaktionsdokument,
  Abschnitt 3): selektiver Auslöser, Zustand statt Ergebnis, eigener Wurf, kein garantierter
  Gewinn, lesbare Ursache.

**rho-Risiko.** Das Schlüsselindiz ist ein Bonus auf **einen** Fundort je Art, dessen Lage per Saat
wechselt. Das ist Fremdrauschen, denn wer zufällig dort sucht, gewinnt. Deshalb ist der Bonus klein
zu halten und als Dosis-Wirkungskurve zu messen, genau wie Fable es beim Hinweis getan hat (0 / klein
/ mittel). Die Reaktionsdosis des heutigen Hinweises gilt als Obergrenze. Die Informationslage bei
Spielbeginn ist für beide Teams gleich, der Spiegeltest bleibt strukturell symmetrisch.

### P4 — „Indizienkette": das Finale gehört dem Team (optional)

**Taktische Tiefe auf Teamebene, gemessen rho-neutral. Optional, weil es eine Produktfrage an Chris
enthält.**

Die Funde eines Teams ergeben zusammen den Fall. Das ist Fort Boyard und das Meta-Rätsel der
pfadbasierten Escape-Rooms. Jede **vollständige Kette** (ein geknackter Fund je Art: Logik +
Verhör + Mechanik) bringt dem **Team** einen Kettenbonus. Die Stufen der drei Glieder bestimmen
seine Höhe. Nach dem Pfiff kommt ein kurzes Finale: Der beste Kombinierer des Teams
(Pattern-Lock-Plan, LOGIK) „löst den Fall", und seine Chance steigt mit der Zahl der Ketten.

- **Taktik:** Ein Team mit drei Logikern hat viele Punkte, aber keine Ketten. Ein ausgewogenes Team
  schließt Ketten. Chris' Aufstellung entscheidet, und die Figuren haben eine Teamfrage („uns fehlt
  Verhör, ich wechsle"). Das ist zugleich die Leitlinie „jeder hat eine gewisse Expertise":
  Spezialisten werden **gebraucht**, nicht nur gut bezahlt.
- **Der Bonus zählt für das Spielergebnis, nicht für `wert()`.** Das ist die einzige saubere
  Lösung, und sie hat einen Präzedenzfall: Im Hockey entscheidet das Tor das Spiel, der Boxscore
  misst den Spieler. Die Einzelwertung und damit rho bleibt unberührt. Der Kettenbonus ist per
  Konstruktion rho-neutral und misst sich nur im Seitenstand und im Spiegeltest.
- **Die Produktfrage:** Heute ist der Seitenstand die Summe der Einzelpunkte
  (`spieleBuehneAuftritt()`), und die Team-Punkte im Spielstand hängen daran. Ein Teambonus
  außerhalb dieser Summe ist eine neue Kategorie für eine Bühne. Chris muss sagen, ob er das will
  (Frage 4).

---

## 5. Machbarkeit gegen die Schranken

### 5.1 Was sich an der Messung ändert — nichts

P1 bis P3 sind Umbauten in `ispySeiteTick()`/`baueSchatzsuche()`. `stepBuehne()`, `wert()` (eigene
Punkte), `disziplinProbe()`, `miss-alle-disziplinen.mjs`, `miss-star-paartreue.mjs`,
`messe-arena-einfluss.mjs` und `miss-arena-buehne-spiegel.mjs` laufen unverändert. P4 fließt nicht
in `wert()`.

### 5.2 Die Rechnung in den zwei Größen

| | Validität | Verlässlichkeit | rho je Spiel |
|---|---:|---:|---:|
| Heute (gemessen) | 0,909 | 0,692 | 0,756 |
| Entrauschter Kern (gemessen) | 0,804 | 0,924 | 0,773 |
| Entrauschter Kern ohne Verteilung (gemessen) | 0,888 | 0,781 | 0,785 |
| **P1 (geschätzt)** | 0,86–0,91 | 0,80–0,88 | **0,78–0,84** |
| Nötig für 0,80 | 0,909 | ≥ 0,775 | 0,80 |

P1 muss den Punkt auf der Tauschkurve nicht verschieben. Es muss die Kurve **verlassen**, und das
aus zwei Gründen, die es gegenüber der entrauschten Diagnose hat:

1. Die Rangkopplung ist ganz weg, nicht nur `belegt`. Eigene Spuren teilen keinen Zustand.
2. Die Punktformel wird durch die zwei Konten additiver.

Ob das trägt, entscheidet PR 0.

### 5.3 Die drei Risiken, in der Reihenfolge ihrer Wahrscheinlichkeit

1. **Die Push-your-luck-Entscheidung bringt das Rauschen zurück.** Ein Tresor, der am Pfiff
   ungeknackt bleibt, ist eine neue Münze. Gegenmittel: Die Fundpunkte bleiben auch dann erhalten,
   und die Schwellen werden so gesetzt, dass eine Tresorspur für Mittlere drei bis vier Ticks
   dauert, nicht acht.
2. **Die rationale Politik ist nicht monoton im Können.** Beispiel: Ein 90er gräbt immer bis zum
   Tresor und scheitert dort öfter als ein 60er an seinen Akten. Gegenmittel: PR 0 misst
   Star und Paartreue getrennt. Die KI-Politik wird **nicht** kalibriert, sie wird aus dem echten
   Erwartungswert abgeleitet. Ist sie nicht monoton, ist die Punkteverteilung falsch, nicht die
   Politik.
3. **Die Art-Wahl nach Profil verschiebt das Budget.** Wer sich seine Art aussucht, konzentriert
   Punkte auf sein stärkstes Attribut. Gegenmittel: Nebenweg-Abschläge und die Pp-Messung in zwei
   Stämmen, wie bei jeder Disziplin.

### 5.4 Korridor-Kennzahlen, neu

Neben rho, Star/Paartreue, Pp und Spiegel sollte der Korridor (Konzept 6.4) Kennzahlen bekommen,
die nachweisen, dass es die Entscheidungen **gibt**. Ohne sie kann eine Taktik genauso tot sein wie
heute der Nebenweg:

| Kennzahl | Zielkorridor (Vorschlag) |
|---|---|
| Anteil Spuren, die bewusst vor der Höchststufe geknackt werden | 25–50 % |
| Streuung dieses Anteils zwischen Spielern (Profilabhängigkeit) | sichtbar, Spannweite ≥ 30 Pp |
| Nebenwege im Finden + Knacken, Anteil der Züge | 10–25 % |
| Ungeknackte Spuren am Pfiff | 5–15 % |
| Reaktionen, die zu einem Spurwechsel führen (P3) | 20–40 % |
| Ketten je Team (P4) | 1–3 |

---

## 6. Bauplan

Aufwand, eingeordnet: mehr als ein Kalibrierlauf, deutlich weniger als die Football-Migration.
`baueSchatzsuche()` bleibt, `ispySeiteTick()` wird neu geschrieben. Etwa **8–11 Arbeitstage**.
Entscheidend ist PR 0, und die kostet anderthalb Tage.

**PR 0 — Prototyp und Abbruchkriterium (≈ 1,5 Tage, nichts wird committet außer der Zahl in
diesem Dokument).** Nur P1 minimal, auf einer Kopie:

- ansammelnder Spürsinn, eigene Spuren
- rationale Graben-oder-Knacken-Politik
- zwei Konten, keine Reaktion
- Messung: `miss-alle-disziplinen.mjs 24 i-spy` **paarweise** gegen den Ist-Stand (Einzelwerte je
  Paarung), dazu `miss-star-paartreue.mjs 24 i-spy` und `messe-arena-einfluss.mjs i-spy 12`
  (Richtung, nicht Abnahme)

**Abbruchkriterium:** Median ≥ 0,78 **und** paarweise besser in ≥ 4 von 5 Paarungen **und**
Star auf Rang 1 ≥ 47,5 %. Wird das verfehlt, fällt P1. I-Spy bleibt dann beim heutigen Kern, P2
und P3 werden auf diesen Kern hin neu bewertet (P2 ohne Grabenpolitik, nur Nebenwege im Finden),
und Chris bekommt die Abnahmefrage aus 3.5.

**PR 1 — Spur-Kern (≈ 3 Tage).** P1 vollständig, dazu:

- Budget-Kalibrierung (Pp ≤ 25, zwei Stämme)
- Spiegeltest, Kadergrößen 2–6
- Ticker („gräbt tiefer", „nimmt die Akte", „Fund gesichert +10")
- neue Sonde `ispySpurSonde()` für die Korridor-Kennzahlen aus 5.4

Alle anderen neunzehn Disziplinen bit-identisch.

**PR 2 — Spielpläne und Mehrwege im Finden (≈ 2 Tage).** P2, `planJeSlot` für I-Spy, drei Spürwege.
Abnahme: rho mindestens wie PR 1, Plan-gegen-Profil-Probe, Nebenweg-Anteil im Korridor.

**PR 3 — Ein Fall, zwei Räume (≈ 1,5–2 Tage).** P3. Das Schlüsselindiz und das Pokerface-Duell
ersetzen den heutigen Hinweis. Die Dosis-Wirkung wird gemessen, die heutigen Zahlen gelten als
Obergrenze.

**PR 4 — Indizienkette (≈ 1,5 Tage, nur nach Chris' Entscheidung, Frage 4).** P4, Teambonus im
Seitenstand. Die Anbindung an die Team-Punkte im Spielstand ist eine eigene Frage für PR 6.

**PR 5 — Bild und Ton (≈ 1 Tag, bit-identisch).**

- Spurbalken über der Figur (wie weit gegraben)
- Stufen-Aufleuchten beim Überschreiten
- Pokerface/Jubel-Varianten, Kettenanzeige im HUD

**PR 6 — Produktivierung.** Wie im Konzept 7.2 (`ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS`,
PPS-Referenz, roter Test), erst nach genommener Schranke.

Reihenfolge begründet: P1 zuerst, weil es die einzige Änderung ist, die die Diagnose angreift, und
weil P2 bis P4 auf ihrer Entscheidung „graben oder knacken" aufbauen. P2 vor P3, weil es Chris'
eigene Hebel betrifft und das Bahn-Muster schon existiert. P4 zuletzt, weil es eine Produktfrage
enthält.

---

## 7. Offene Fragen an Chris

1. **Umbau des Kerns (P1).** Der Spürwurf je Tick und die Verteilung nach Reihenfolge werden durch
   eigene Spuren mit angesammeltem Spürsinn ersetzt. Das Bild bleibt, die Auflösung ändert sich.
   Einverstanden, zuerst als Prototyp mit Abbruchkriterium?
2. **Zwei Konten.** Soll ein Fund schon Punkte bringen, bevor er geknackt ist („Spur gesichert")?
   Heute tut er das versteckt (Teilpunkte). P1 würde es offen tun.
3. **Slots als Spielpläne (P2).** Sollen die sechs I-Spy-Slots festlegen, **wie** eine Figur spielt
   (Späher/Knacker/Leser/Schleicher/Abräumer/Kombinierer), wie bei Sprint und Climbing? Das gibt
   deiner Aufstellung echtes Gewicht, heißt aber auch: Eine schlechte Aufstellung kostet Punkte.
4. **Teamfinale (P4).** Darf es bei einer Bühnen-Disziplin einen Teambonus geben, der das Spiel
   mitentscheidet, aber nicht in die Einzelwertung des Spielers fließt (wie Tore im Hockey)?
5. **Falls P1 im Prototyp scheitert:** Soll für I-Spy die „ehrlichere Abnahme" aus CLAUDE.md gelten
   (Star/Paartreue)? Nach ihr fehlen heute 2,5 Prozentpunkte an einer von vier Bedingungen
   (Abschnitt 3.5). Diese Frage steht seit dem zweiten Gegencheck offen. Sie gehört gestellt,
   **bevor** eine weitere Zahlenrunde läuft.

---

## 8. Was dieser Review bewusst nicht tut

- **Keine Zahl am Motor gedreht.** Die Messungen in 3.2 sind Diagnose auf einer Kopie, keine
  Kalibrierung. Kein Wert daraus soll übernommen werden.
- **Keine Matrixänderung, kein `power`**, auch nicht als Nebenweg (CLAUDE.md, Gegencheck 1,
  Abschnitt 2.2).
- **Keine geteilten Truhen zwischen den Teams.** Auch P3 teilt nur die **Lösung**, nicht die
  Objekte. Der geteilte Pool maß 0,53, und das bleibt eine harte Grenze.
- **Keine Sperre, kein Gate, kein Helferbonus**, keine Züge durch fremde Hand in beide Richtungen.
- **Keine weitere Uhr-Runde.** 16 Ticks: +0,011, gemessen nach dem Nachfüll-Fix.
- **Kein zweiter Randomizer.** Der visuelle Kartenwechsel (`b00135b5`) bleibt, wie er ist. Er ist
  bit-identisch und liefert den Wiedersehenswert, den Chris wollte.
- **Kein Urteil über das Thema.** Escape-Room/Schatzsuche ist richtig, die Kategorien passen zur
  Matrix. Ob `spybar.tsx` (Nachtsicht-Späh-Zentrale) nachzieht, bleibt die offene Frage 9 aus dem
  Konzept.

---

## Quellen

**Gelesen, im Repo:**

- `CLAUDE.md` (Abnahme, Matrixsperre, Mehrwege-Leitlinie)
- `docs/design/i-spy-schatzsuche-konzept-21-09.md`, `i-spy-opus-gegencheck-21-09.md`,
  `i-spy-opus-gegencheck-2-22-09.md`, `i-spy-fable-reaktionskanal-22-09.md`,
  `climbing-neukonzept-22-09.md` (Form)
- Commit-Texte `021e1d91`, `0f812538`, `af9dc3ff`, `edcc6c1e`, `b00135b5`
- `public/mockups/battle-mode.engine.js` (Stand `6b471366`):
  - `BUEHNE_ART["i-spy"]` `:13428-13581` (Rezept `:13514-13522`, `fundorte` `:13558-13571`)
  - Konstanten `:14723-14896`
  - `ispyKnackChance()` `:15030`, `ispyBesterWeg()` `:15042`, `ispyBaueRaum()` `:15060`,
    `ispySichtbar()` `:15091`
  - `ispySeiteTick()` `:15102-15267`, `baueSchatzsuche()` `:15272-15309`
  - I-Spy-Slots `:5383-5388`, `slotAufschlag()` `:5459-5466`, `bauBuehne()`/`setz()`
    `:13830-13894`
  - Bahn-`planJeSlot` `:21738`, `:26343`, `:26557`, `:26638`
- `lib/lineups/matchday-slot-roles.ts:270-277`

**Gemessen (26.09.):**

- `node scripts/miss-alle-disziplinen.mjs 24 i-spy` (Ist-Stand und sechs Diagnose-Varianten über
  eine gepatchte, danach zurückgesetzte Engine-Kopie)
- `node scripts/miss-star-paartreue.mjs 24 i-spy`
- Kader-Familie `data/generated/kaderfamilie-live-save.json`, fünf Paarungen

**Web:**

- [Nicholson (2015), Peeking Behind the Locked Door: A Survey of Escape Room Facilities](https://scottnicholson.com/pubs/erfacwhite.pdf)
  (Rätselorganisation: pfadbasiert 45 %, sequenziell 37 %, offen 13 %; Meta-Rätsel)
- [Wiemker et al., Escape Room Games](https://thecodex.ca/wp-content/uploads/2016/08/00511Wiemker-et-al-Paper-Escape-Room-Games.pdf)
- [Orienteering USA — What is Rogaining](https://orienteeringusa.org/explore/what-is-rogaining/)
- [GPHXO — Score-O and Rogaine General Description](https://gphxo.org/events/GPHXO_Score-O.htm)
- [Van Bulck (2026), Designing a sports orienteering contest: physical versus cognitive skills in rogaining, ITOR](https://onlinelibrary.wiley.com/doi/10.1111/itor.13591)
- [Wikipedia — The Crystal Maze](https://en.wikipedia.org/wiki/The_Crystal_Maze)
- [Wikipedia — List of The Crystal Maze games](https://en.wikipedia.org/wiki/List_of_The_Crystal_Maze_games)
- [Wikipedia — Fort Boyard (game show)](https://en.wikipedia.org/wiki/Fort_Boyard_(game_show))
- [UKGameshows — Fort Boyard](https://www.ukgameshows.com/ukgs/Fort_Boyard)
- [Amazing Race Wiki — Detour](https://amazingrace.fandom.com/wiki/Detour)
- [Amazing Race Wiki — Roadblock](https://amazingrace.fandom.com/wiki/Roadblock)
- Spielmechaniken ohne eigene Quelle, als bekannt vorausgesetzt: Diamant/Incan Gold
  (Push-your-luck), Cluedo, Scotland Yard, Werwolf, Clank! (Lärm zieht Aufmerksamkeit); dazu die
  von Fable zitierten Quellen zu Stealth-KI und Rückkopplung
  (`i-spy-fable-reaktionskanal-22-09.md`, Abschnitt 3)

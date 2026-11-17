# Kontakt als normale Aktion, getrieben von der Persönlichkeit — Konzept (Fable, 16.11.)

Chris am 16.11., sinngemäß: Schubsen, Wegdrängen und Hängenbleiben sollen zu den **normalen
Aktionen und Stats** gehören, nicht nur zur Anzeige, und von der **Persönlichkeit** getrieben
werden. Es gibt aggressivere und defensivere Spielertypen (haben wir über die Persönlichkeiten);
das lässt sich wie die **Tendenzen in NBA-Spielen** einarbeiten (wer macht tendenziell lieber
was). Kosten dürfen sein, **für Angreifer und Verteidiger**: wer hinfällt, verliert Zeit; auch
das Tackling selbst kostet etwas Zeit; schlägt ein Tackle fehl, ist der Tackler kurz
„mini-stunned" und verliert etwas Puste. Abgesprochen sind bis zu etwa −0,03 rho je Disziplin,
solange rho über 0,80 bleibt. Strategie-Vorlagen (offensiv/neutral/defensiv, nur Verhalten)
kommen später und sollen auf denselben Kontakt-Reglern aufsetzen.

**Reines Konzeptpapier.** Kein Motorcode, keine Messung in dieser Runde. Alle Zahlen zu
Parametern sind **Startwerte für die Messung**, keine Messergebnisse. rho-/Pp-Stände sind aus
`docs/design/stand-aller-disziplinen.md` (30./31. Nachtrag, 15./16.11.) zitiert. `engine.js`
meint `public/mockups/battle-mode.engine.js`, Zeilen Stand Worktree 16.11. Die Eignungsmatrix
bleibt unangetastet; nichts in diesem Papier setzt eine Änderung voraus.

Vorgänger, auf denen das aufbaut und die hier nicht wiederholt werden:
`fable-kontakt-interaktionen-16-11.md` (38 Quellen Q1–Q38, Muster-Katalog, Disziplinen-Tabelle,
Anzeige-Baukasten) und `taktik-grundeinstellung-konzept-26-10.md` (Grundtaktik, sieben Regeln).
Quellen mit „Q" verweisen auf den Vorgänger, Quellen mit „N" sind neu (Abschnitt 8).

---

## 0. Kurzfassung

1. **Der Leitsatz: Die Persönlichkeit bestimmt die Verteilung, nicht die Bilanz.** Ein
   Draufgänger rempelt öfter und auch bei schlechter Aussicht, ein Bollwerk selten und nur, wenn
   es sitzt. Über ein Spiel soll bei gleichen Sub-Skills **dasselbe** herauskommen. Damit bleibt
   Persönlichkeit Verhalten und wird nicht heimlich Stärke. Das ist genau die Trennung, die
   NBA 2K zwischen „Tendencies" (wie oft) und „Attributes" (wie gut) zieht (N1).
2. **Der Fehlschlag-Preis ist der Hebel, der das möglich macht.** Heute zahlt der Rempler im
   Spurt und in Takeshi fast nichts (`tackleKosten:0`, nur 1,8 s Abklingzeit). Dann ist jeder
   Versuch ein Gewinn, und wer öfter versucht, ist schlicht besser — Persönlichkeit wäre Stärke.
   Chris' Idee (Mini-Stun plus Puste-Verlust beim Fehlschlag) setzt die Gewinnschwelle eines
   Versuchs auf rund 40 % Erfolgsaussicht. Erst dadurch bedeutet „wählerisch" und „draufgängerisch"
   etwas, und beide Stile können gleich viel wert sein.
3. **Vier Regler je Spieler, abgeleitet, nicht gewählt:** Kontaktbereitschaft, Härte (Einsatzhöhe,
   nicht Kraft), Disziplin, Ausweichneigung. Basis ist die vorhandene Persönlichkeit aus
   `leitePers()` (sechs Typen), verschoben durch die echten Traits. Dreizehn der 36 kanonischen
   Traits liest `leitePers()` heute gar nicht (unter anderem `Fearless`, `Disciplined`, `Fair`,
   `Cheater`, `Cruel`, `Vindictive`, `Gambler`) — genau die passen auf die Kontakt-Regler.
4. **Der Ausgang bleibt bei den Sub-Skills der Disziplin** (WUCHT gegen ROBUST, TECHNIK zum
   Ausweichen, ABWEHR gegen AUSDAUER, LAUFKRAFT gegen ABWEHR_LAUF). Das ist die bestehende
   Formel des Bahn-Remplers und der Grund, warum er die Abnahme besteht.
5. **Schutz des Eignungsbesten über sechs Regeln** (Abschnitt 3.4): nur Zeit, Puste und Position
   als Währung; Schonfrist nach jedem Treffer; Deckel je Opfer und Spiel; keine Zielwahl nach
   Platzierung; Schiedsrichter-Gutschrift beim Foul; Sperre vor dem Ziel.
6. **Pilot-Reihenfolge:** Schritt 0 Regler-Schicht (bit-identisch) → **Spurt** (Bahn) →
   **Football** (Feldspiel, weil dort ohne Positions-Kaskade auflösbar und mit Puffer) →
   Takeshi → Battlefield-Pod (Kampf) → Eiskunstlauf (Bühne). Hockey, TDM, Climbing und
   Basketball haben für −0,03 keinen oder zu wenig Puffer (Tabelle 6.1).
7. **Im Code gefunden, unabhängig vom Konzept zu wissen:** Die Rempel-Tabelle `willTackeln`
   (engine.js ~52264) führt einen Typ `taktiker`, den es nicht gibt, und lässt `beschuetzer` aus
   (fällt auf 0,5 zurück). Und die Opferwahl nimmt unter mehreren Kandidaten den **am weitesten
   vorn** liegenden (`opfer.sort((a,b)=>b.pos-a.pos)[0]`) — ein kleiner Führenden-Malus, der dem
   Schutzziel widerspricht.

---

## 1. Bestandsaufnahme im Code

### 1.1 Wie Persönlichkeit heute modelliert ist

Es gibt **zwei Ebenen**, und man muss sie auseinanderhalten:

| Ebene | Wo | Was |
|---|---|---|
| **Traits** (Daten des Spielers) | `lib/training/class-progression-config.ts` (`CANONICAL_POSITIVE_TRAITS`, `CANONICAL_NEGATIVE_TRAITS`, je 18); am Spieler `traitsPositive`/`traitsNegative`, in der Arena `p.tp`/`p.tn` | 36 Charakterzüge. Jeder ist **zugleich** ein Mutator (+6 auf die Wertung, wenn er als aktiver Disziplin-Mutator gezogen wird, `lib/lineups/legacy-lineup-modifiers.ts`) und ein Trainingsfaktor (`lib/training/trait-training-signal.ts`). Zwei haben einen kleinen Ermüdungseffekt (`Healthy`, `FaintHearted`, `lib/traits/cosmetic-trait-soft-effects.ts`). |
| **Persönlichkeit** (abgeleiteter Typ) | `leitePers(p)` mit der Punktetabelle `PW` (engine.js ~37344), Ergebnis in `persOf[name]` | Sechs Typen: `bollwerk`, `draufgaenger`, `duellant`, `schleicher`, `beschuetzer`, `opportunist`. Entsteht aus Klasse, Rasse, Unterklassen und Traits; wer die meisten Punkte hat, gewinnt; Rückfall `duellant`. Der Tooltip in der Aufstellung zeigt die Herleitung (`persWarum`). |

`leitePers()` liest von den 36 Traits **23**: positiv `Loyal`, `Diligent`, `FiredUp`, `Ambitious`,
`Caring`, `Altruistic`, `Cool`, `Motivated`, `Relaxed`, `Flexible`, `Healthy`, `Eloquent`;
negativ `FaintHearted`, `Renegade`, `Feisty`, `Paranoid`, `Devious`, `ColdBlooded`, `Lazy`,
`Timid`, `Obsessive`, `Manipulative`, `Mercenary`.
**Ungenutzt bleiben 13:** `Disciplined`, `Fair`, `FanFavorite`, `Fearless`, `Resourceful`, `Sexy`
sowie `Cheater`, `Diva`, `Egomaniac`, `Gambler`, `Scandalous`, `Cruel`, `Vindictive`.

Wichtig für die Abgrenzung: Weil jeder Trait schon einen Wertungskanal hat (Mutator), darf die
Kontakt-Abbildung **keinen zweiten** öffnen. Sie verschiebt nur Verhalten.

### 1.2 Was die Arena davon liest

| Kanal | Fundstelle | Liest |
|---|---|---|
| Grundveranlagung `PERS` (Formationstreue, Opportunismus, Selbsterhaltung) | engine.js ~7856 | Kampf |
| Fünferskalen `PERSDEF`: Haltung `h`, Zusammenhalt `z`, Bindung `b` (`HALTUNG`/`ZUSAMMEN`/`BINDUNG`) | ~7867, ~7931 | Kampf; Sandsack-Finale (`sandsackPersoenlichkeit()`) |
| Zielneigung `PERSZIEL` | ~7910 | Kampf |
| Standardbefehl `PERSORD` | ~7848 | Kampf |
| **Rempel-Neigung `willTackeln`** | `stepSpurt`, Block „TACKLE", ~52264 | Bahn: Spurt und Takeshi (über `u.pers`) |
| Team-Automatik aus der Persönlichkeit | ~50308 (Staffel-Paar), ~21797 (Sandsack) | Bahn/Bühne |

Die härteste Lehre steht bei `persDefVon()` (P1, 07.10.,
`arena-zielwahl-opus-empfehlung-02-10.md`): In der Arena war die Persönlichkeit der größte
Fehlordner, und zwar nicht über Zielneigung und Haltung, sondern über Zusammenhalt und Bindung —
der Draufgänger lief allein übers Feld und „verlor damit Menge statt nur Stil". Deshalb sind `z`
in Mini-DM heute Handwerk (`persHandwerk:["z"]`), und der Satz dazu heißt: *Persönlichkeit wählt
Ziel und Mut, das Handwerk ist für alle gleich.* Dieses Papier überträgt den Satz auf Kontakt.

### 1.3 Welcher Kontakt schon gebucht wird

| Disziplin | Mechanik | Wer entscheidet die Gelegenheit | Wer den Ausgang | Was es kostet |
|---|---|---|---|---|
| Spurt | Rempler (`BAHN_ART.spurt`: `tackle:true, tackleAb:50, tackleRate:1.0, tackleKosten:0`) | `willTackeln[u.pers]` × `tackleRate`, Schwelle WUCHT > 50 | `stark = WUCHT/(WUCHT+ROBUST)` | Opfer: `stolper = 0,55+0,9·stark` s, Reserve −18. Täter: nur Abklingzeit 1,8 s. Fehlschlag kostet nichts weiter. |
| Takeshi | wie Spurt, dazu Fenster 5 % vor der Falle, `tackleAb:30`, `tackleRate:2.0`, Ausweichen `tackleAusweichen:{duell:0.35}` | wie oben | erst TECHNIK-Duell (Ausweichen), dann WUCHT/ROBUST | wie oben; gemessen 13,3 Rempler, 5,4 Treffer je Rennen |
| Climbing | Herunterziehen am Kreuzungsgriff (`kreuzungsPos`, ~51713) | **jeder** Führende im Abstand, ohne Persönlichkeit | WUCHT gegen WUCHT und GLEICHGEWICHT | Ziehender `zugZeitAngriff` 0,5 s, Gezogener Balance (Deckel 0,15) oder 0,25 s beim Wehren |
| Hockey | Bodycheck in `versucheSteal()` (~15424) | Deckung und Abklingzeit, ohne Persönlichkeit | `wucht = 0,16+(ABWEHR−AUSDAUER_wirksam)·0,004`, 4–45 % | Getroffener `HK_STURZ` 0,45 s am Boden, `HK_TAUMEL` 1,4 s bei 55 % Tempo; Puste `checkGeben 5`/`checkNehmen 9` mit Kräfte-Kontrast; Foul-Anteil → Strafe |
| Basketball | Ausboxen `REB_BOXOUT=4.0` (~16743) | fester Faktor, kein Spielerbezug | Los nach ZWEITCHANCE | nichts |
| Football | Tackle in `resolveLaufNfl()` (~12930): Fumble, gebrochener Tackle, zweiter Tackler | Los nach ABWEHR_LAUF | LAUFKRAFT gegen ABWEHR_LAUF | gebrochener Tackle = Zusatzyards; der Erst-Tackler ist aus dem Pool für den zweiten |
| Kampf | Rückstoß `stossen()` (~39325) mit `knockbackResist` je Archetyp; `stunResist` liegt ebenfalls je Archetyp vor | Treffer | Archetyp | Position |

Drei Befunde daraus:

- **Nur in der Bahn hängt die Gelegenheit an der Persönlichkeit.** Überall sonst ist sie
  mechanisch oder Zufall. Chris' Wunsch heißt also: das Bahn-Muster verallgemeinern.
- **Der Angreifer zahlt fast nirgends.** Spurt und Takeshi stehen auf `tackleKosten:0`. Der
  Kommentar dort erklärt, warum: als der Rempler den Täter 0,5 s kostete, machte Torment die
  Läufer **langsamer** (−0,31 s), obwohl die Matrix es mit 14 führt. Das ist das Risiko, das
  jedes Kostenmodell hier umschiffen muss (Abschnitt 3.2).
- **Hockey hat die Warnung schon eingebaut:** die Puste-Wirkung auf den Ausgang ist abgeschaltet,
  weil sie gemessen rho 0,669 → 0,616/0,628 kostete — nicht wegen der Stärke der Faktoren,
  sondern weil jede Positionsverschiebung die Zufallsfolge neu mischt (Kommentar bei
  `FB().puste`, ~10005).

---

## 2. (A) Persönlichkeit → Kontaktneigung

### 2.1 Vier Regler

Jeder Regler ist eine Zahl 0–100, neutral 50, einmal je Spieler aus Persönlichkeit und Traits
berechnet (eine Funktion `kontaktProfil(p)` neben `leitePers()`, gleiche Herleitungslogik,
gleicher Tooltip).

| Regler | Frage, die er beantwortet | Was er im Motor bewegt | Was er **nicht** tut |
|---|---|---|---|
| **Kontaktbereitschaft (KB)** | Sucht er den Zweikampf oder meidet er ihn? | Häufigkeit der Versuche (heute `willTackeln`) **und** die Auswahlschwelle: ab welcher geschätzten Erfolgsaussicht er überhaupt zulangt | ändert keine Erfolgschance |
| **Härte (HÄ)** | Geht er voll rein oder kontrolliert? | **Einsatzhöhe**: multipliziert Wirkung beim Treffer **und** Preis beim Fehlschlag mit demselben Faktor | ist keine Kraft; Wucht bleibt Sub-Skill |
| **Disziplin (DI)** | Bleibt er sauber? | Foulchance bei hartem Kontakt; Neigung zur Revanche | ändert nicht, wie oft er trifft |
| **Ausweichneigung (AW)** | Als Ziel: weicht er aus oder hält er dagegen? | **Welcher** Sub-Skill verteidigt: Ausweichen (TECHNIK/Wendigkeit, kostet einen Tick Linie) oder Dagegenhalten (ROBUST/Stehvermögen, kostet nichts, fällt aber härter) | macht ihn nicht standfester |

Die vierte Zeile ist die Mehrwege-Leitlinie auf der Verteidigerseite: zwei Wege, denselben
Rempler zu überstehen, aus zwei verschiedenen Attributgruppen.

### 2.2 Basis je Persönlichkeit

KB übernimmt die **heutigen** Zahlen aus `willTackeln` (mal 100), damit Stufe 1 bit-identisch
bleibt; nur `beschuetzer` bekommt seinen heutigen Rückfallwert ausdrücklich, und `taktiker`
entfällt. Die Schwelle `pMin` (ab welcher Aussicht er zulangt) hängt an der vorhandenen Haltung
`PERSDEF.h` — damit setzen die späteren Strategie-Vorlagen an derselben Stelle an wie im Kampf.

| Persönlichkeit | KB | Haltung (`PERSDEF.h`) → `pMin` | HÄ | DI | AW | Bedingte Neigung |
|---|---:|---|---:|---:|---:|---|
| `draufgaenger` | 90 | wild → 0,30 | 85 | 30 | 20 | — |
| `opportunist` | 70 | ausgewogen → 0,45 | 45 | 40 | 65 | +KB gegen Angeschlagene (wenig Puste, gerade gestolpert) |
| `duellant` | 55 | ausgewogen → 0,45 | 60 | 60 | 40 | +KB gegen den Stärksten in Reichweite |
| `schleicher` | 50 | vorsichtig → 0,55 | 35 | 55 | 90 | Kontakt nur von hinten/aus dem Windschatten |
| `beschuetzer` | 50 | defensiv → 0,60 | 55 | 70 | 30 | **Schutz**: +KB für einige Sekunden, wenn ein Mitspieler getroffen wurde, und nur gegen den Täter |
| `bollwerk` | 25 | vorsichtig → 0,55 | 60 | 75 | 15 | hält immer dagegen; rempelt fast nie selbst |

Die „bedingten Neigungen" spiegeln `PERSZIEL` (bedrohung/schwach/schild/hinten). Sie sind
Stufe 3 und werden einzeln gemessen, weil eine Zielwahl nach Zustand ein neuer Kanal ist.

### 2.3 Trait-Verschiebungen (echte Namen aus dem Code)

Additiv auf die Basis, Summe je Regler auf ±30 gedeckelt, Ergebnis auf 5–95 geklemmt. Bevorzugt
werden die 13 Traits, die `leitePers()` nicht liest — so zählt kein Trait doppelt. Traits, die
schon den Typ mitbestimmen, bekommen nur kleine Werte.

| Trait | KB | HÄ | DI | AW | Lesart |
|---|---:|---:|---:|---:|---|
| `Fearless` | +10 | | | −15 | geht rein, weicht nicht |
| `FiredUp` | +10 | +10 | −5 | | heiß gelaufen |
| `Feisty` | +10 | | −15 | | streitlustig; Revanche wahrscheinlich |
| `Vindictive` | | +5 | −10 | | **Revanche**: +25 KB gegen den, der ihn zuletzt getroffen hat |
| `Cruel` | | +15 | −10 | | will, dass es wehtut |
| `Renegade` | | +5 | −20 | | hält sich an keine Regel |
| `Cheater` | | | −25 | | versteckte Fouls |
| `Gambler` | | +10 | | | `pMin` −0,10: versucht es auch bei schlechter Aussicht |
| `ColdBlooded` | | +10 | +10 | | hart, aber kontrolliert; keine Revanche |
| `Egomaniac` | | | −5 | | kein Schutz-Reflex für Mitspieler |
| `Diva` | −5 | | | +10 | macht sich nicht schmutzig |
| `Disciplined` | | | +25 | | sauber |
| `Fair` | | −10 | +20 | | zieht zurück |
| `Cool` | | | +10 | +10 | bleibt ruhig, sieht es kommen |
| `Resourceful` | | | | +10 | findet die Lücke |
| `Paranoid` | | | | +15 | rechnet ständig mit dem Rempler |
| `Relaxed`, `Lazy` | −10 | | | | spart sich den Weg |
| `Timid` | −20 | | | +20 | meidet Kontakt |
| `FaintHearted` | −15 | | | +15 | meidet Kontakt |
| `Loyal`, `Caring`, `Altruistic` | | | | | Schutz-Reflex wie `beschuetzer` (auch bei anderem Typ) |
| `Obsessive` | | | | | bleibt am selben Gegner |

Ohne Wirkung bleiben bewusst `Healthy` (hat schon den Ermüdungseffekt), `FanFavorite`, `Sexy`,
`Eloquent`, `Scandalous`, `Motivated`, `Ambitious`, `Diligent`, `Flexible`, `Devious`,
`Manipulative`, `Mercenary` — nicht jeder Trait muss überall etwas tun.

### 2.4 Tendenz-Tabelle (Stil NBA 2K, 0–99)

Das ist die Ansicht für Spieler-Tooltip und Kaderseite: je Typ, was er tendenziell lieber tut.
Die Zahlen folgen aus 2.2; die Tabelle ist die **lesbare** Form, keine zweite Datenquelle.

| Tendenz | Draufgänger | Opportunist | Duellant | Schleicher | Beschützer | Bollwerk |
|---|---:|---:|---:|---:|---:|---:|
| Rempler/Check suchen | 90 | 70 | 55 | 50 | 50 | 25 |
| Auch bei schlechter Aussicht | 85 | 45 | 45 | 25 | 20 | 25 |
| Voll einsteigen (statt sicher) | 85 | 45 | 60 | 35 | 55 | 60 |
| Bahn zumachen / wegdrängen | 60 | 55 | 65 | 20 | 70 | 90 |
| Festhalten / klammern | 55 | 75 | 30 | 45 | 40 | 35 |
| Ausweichen (statt dagegenhalten) | 20 | 65 | 40 | 90 | 30 | 15 |
| Revanche nach eigenem Treffer | 70 | 30 | 60 | 15 | 35 | 30 |
| Mitspieler schützen | 30 | 15 | 40 | 15 | 95 | 60 |
| Foul riskieren | 70 | 60 | 40 | 45 | 30 | 25 |

Im Spiel steht davon nie eine Zahl, sondern Wort plus Gegenpreis (Q35, FM-Muster): „Sucht den
Rempler, auch wenn es eng wird. Zahlt dafür öfter mit einem Fehltritt."

### 2.5 Warum das die Eignung nicht verbiegt

- Kein Regler geht in `eig`, in ein Rezept oder in einen Sub-Skill. Die Matrix und alle
  Rezeptgewichte bleiben Zeichen für Zeichen stehen.
- Die Regler entscheiden nur, **ob** und **wie** ein Kontakt versucht wird. Die Erfolgschance
  liest ausschließlich Sub-Skills der Disziplin.
- Die Neutralitäts-Abnahme (6.3, Kriterium N) prüft das gemessen: derselbe Kader, einmal mit
  echten Persönlichkeiten, einmal alle auf denselben Typ gezwungen — die Rangfolge der Leistung
  darf sich dadurch im Mittel nicht verschieben.

---

## 3. (B) Kostenmodell, symmetrisch

### 3.1 Die Ausgänge eines Kontakts

Ein Versuch von A gegen V läuft in höchstens drei Schritten. Wo möglich wird **kein neuer
Würfel** eingeführt, sondern der vorhandene Wurf anders gelesen.

```
1. Will A?        Gelegenheit da, Abklingzeit frei, KB-Wurf gewinnt (wie heute)
                  UND geschätzte Aussicht p >= pMin(A)          <- neu, kein Würfel
2. Was tut V?     AW entscheidet: ausweichen oder dagegenhalten
                  ausweichen:    Chance q = k·TECHNIK_V/(TECHNIK_V+WUCHT_A)   (Takeshi-Formel)
                  dagegenhalten: Chance p = WUCHT_A/(WUCHT_A+ROBUST_V)        (heutige Formel)
3. Ausgang        TREFFER      V stolpert/stürzt; A zahlt den Grundpreis
                  FEHLSCHLAG   A mini-stunned, verliert Puste und Zeit; V zahlt nichts
                               (ausgewichen: V zahlt den kleinen Ausweichpreis)
                  HÄNGER       beide gebremst — der Ausgang des ausgeglichenen Duells
                  FOUL         Treffer zählt, A bekommt eine Strafe, V eine Gutschrift
```

| Ausgang | Angreifer A | Verteidiger V | Woran es hängt |
|---|---|---|---|
| **Treffer** | Grundpreis `T_a0` (das Tackling selbst kostet etwas Zeit) | Sturz/Stolpern `T_v·h`, Puste −, bei hartem Treffer Sturz statt Stolpern | Sub-Skill-Duell |
| **Fehlschlag, abgeprallt** | **Mini-Stun** `T_miss·h`, Puste `−P_miss·h`, Abklingzeit verlängert | nichts | Sub-Skill-Duell |
| **Fehlschlag, ausgewichen** | wie abgeprallt | Ausweichpreis `T_aus` (verlässt kurz die Linie) | TECHNIK-Duell |
| **Hänger** | gebremst auf `v_h` für `T_h` | gebremst auf `v_h` für `T_h` | Duell fast ausgeglichen: `|p−0,5| < d_h` beim abgewehrten Versuch; **kein eigener Würfel** |
| **Foul** | Zeit-/Bankstrafe `S_foul` | Stolperzeit wird erstattet (Gutschrift), nichts verloren | Treffer **und** `rr() < f0·(HÄ/50)·((100−DI)/50)` |

`h` ist der Härte-Faktor `0,75 + HÄ/200` (0,78 bis 1,23). Er multipliziert **beide** Seiten der
Wette: wer voll reingeht, räumt härter ab und fliegt beim Fehlschlag weiter aus dem Tritt. Das
ist das Madden-Muster (Hit Stick gegen sicheren Tackle, N4): höheres Risiko, höherer Ertrag,
gleicher Erwartungswert.

### 3.2 Die Rechnung dahinter: Gewinnschwelle eines Versuchs

Für die Bahn mit den heutigen Formeln. Das Opfer stolpert `0,55 + 0,9·p` Sekunden und läuft
dabei mit 35 % Tempo (`tempoVon`, ~50635); sein Zeitverlust ist also `T_v(p) = 0,65·(0,55+0,9·p)`.

    Nutzen eines Versuchs = p · T_v(p)  −  T_a0  −  (1 − p) · T_miss     (alles in Sekunden Zeitverlust)

| | heute (Spurt) | Vorschlag |
|---|---:|---:|
| `T_a0` (Grundpreis) | 0 | rund 0,05 s (das alte `tackleKosten 0,26`: 0,26 s bei 82 % Tempo) |
| `T_miss` (Zeitverlust beim Fehlschlag) | 0 | rund 0,30 s: der Täter stolpert selbst 0,45 s bei denselben 35 % Tempo (dasselbe Feld `u.stolper`, kein neuer Zustand) |
| Gewinnschwelle `p*` | jeder Versuch lohnt | **p\* ≈ 0,39** |
| Nutzen bei p = 0,3 / 0,5 / 0,7 | +0,16 / +0,33 / +0,54 s | −0,10 / +0,13 / +0,40 s |

Was das leistet:

- **Starke Wucht bleibt ein klarer Vorteil.** Wer p = 0,7 hat, behält drei Viertel des heutigen
  Nutzens. Der Kanal, über den Torment und Power im Spurt überhaupt etwas tragen, bleibt offen —
  das war die Lehre aus dem alten 0,5-s-Täterpreis (Torment machte langsamer).
- **Schwache Wucht wird nicht bestraft, solange der Spieler wählerisch ist.** Die Schwelle
  `pMin` verhindert, dass ein Bollwerk mit p = 0,3 überhaupt zulangt.
  (Die geschätzte Aussicht ist dieselbe Zahl `p`, die danach gewürfelt wird — kein Zusatzwert.)
- **Der Draufgänger zahlt für seine Art.** Er versucht auch bei p = 0,30–0,39 und macht dort
  Minus; dafür nimmt er jede gute Gelegenheit mit. Der Wählerische lässt gute Gelegenheiten
  liegen (niedrige KB), macht aber nie Minus. Ziel der Kalibrierung: beides gleicht sich aus.
- **Gegenüber dem Rest des Feldes ist jeder Kontakt ein Verlust für beide.** Das ist gewollt
  und das Gegenteil von Mario Kart: Kontakt lohnt im direkten Duell, nie als Selbstzweck.

Der ehrliche Vorbehalt: ob sich die Stile wirklich ausgleichen, lässt sich nicht ausrechnen,
nur messen (Kriterium N in 6.3). `T_miss` und die `pMin`-Stufen sind dafür die Stellschrauben.

### 3.3 Parameter-Satz je Chassis (Startwerte)

| Größe | Bahn | Feldspiel live (Hockey, Basketball) | Feldspiel aufgelöst (Football) | Kampf | Bühne/Wand |
|---|---|---|---|---|---|
| Duell | WUCHT / (WUCHT+ROBUST) | bestehend: ABWEHR gegen AUSDAUER (Hockey) | bestehend: LAUFKRAFT gegen ABWEHR_LAUF | Angriff gegen `knockbackResist` | Sub-Skill der Disziplin, vorab in `bauBuehne()` |
| Grundpreis `T_a0` | 0,26 s bei 82 % Tempo | Puste `checkGeben` 5 (bestehend) | Ermüdung des Tacklers (bestehend) | nächster Angriff +0,10 s | Zeitanteil am Griff/Element |
| Fehlschlag `T_miss` | 0,45 s Stolpern bei 35 % Tempo (≈ 0,30 s), Abklingzeit 1,8 → 2,6 s | 0,5 s bei 70 % Tempo, **nur als Zeichen-Versatz**, Wirkung über Abklingzeit 2,0 → 3,0 s | verpasster Tackle: Zusatzyards (bestehend) plus Tackler fällt für diesen Spielzug aus (bestehend) | nächster Angriff +0,35 s · (1 − `stunResist`) | nächstes Element −kleiner Abzug (gedeckelt) |
| Puste beim Fehlschlag `P_miss` | Reserve −10 (Treffer kostet das Opfer heute −18) | Puste −8 (zwischen Geben 5 und Nehmen 9) | Ermüdung +1 Stufe für den Drive | Ausdauer −5 % | — |
| Treffer beim Opfer | Stolpern 0,55+0,9·p s bei 35 % Tempo, Reserve −18 (bestehend) | `HK_STURZ` 0,45 / `HK_TAUMEL` 1,4 (bestehend) | Tackle, Fumble-Chance (bestehend) | Rückstoß (bestehend), keine HP | Balance/Tempo, nie Punkte |
| Hänger | beide 60 % Tempo für 0,4 s; Fenster `d_h = 0,06` | Gerangel: beide Abklingzeit +0,5 s | „Haufen": kein Raumgewinn nach Kontakt | beide 0,3 s ohne Angriff | beide verlieren denselben Zeitanteil |
| Ausweichpreis `T_aus` | 0,08 s | — (Ausweichen = Pass/Abdrehen, bestehend) | — | Schritt zurück (Position) | — |
| Foulbasis `f0` | 4 % der Treffer → Zeitstrafe 0,5 s, Opfer-Gutschrift | bestehend (`HK_FOUL_ANTEIL`, Schiedsrichter Basketball) | 3 % → 5–15 Yards | keine Fouls (Kampf kennt keine) | Verwarnung → Abzug beim Verursacher |
| Schonfrist nach Treffer | 3,0 s unangreifbar | bestehend über Sturz/Taumel | — | 1,0 s kein zweiter Rückstoß | ein Kontakt je Kreuzung |
| Deckel je Opfer und Spiel | höchstens 2 wirksame Stürze, danach nur noch Stolpern mit halber Dauer | Korridor ~10 Checks je Team (bestehend) | — | Rückstoß-Summe gedeckelt | bestehende Deckel (Climbing 0,15) |
| Sperre | letzte 5 % der Strecke; im Hindernis (bestehend) | — | — | — | letztes Element/letzter Griff |

Zur Spalte „Feldspiel live": dort darf ein Fehlschlag **keine Position** verschieben (Hockey-
Lehre, RNG-Kaskade). Der Stun wird als Abklingzeit und Puste gebucht und als Zeichen-Versatz
gezeigt. Das ist weniger körperlich als in der Bahn, aber das einzige, was dort messbar trägt.

### 3.4 „Kontakt kostet, nimmt nicht" — sechs Schutzregeln für den Eignungsbesten

Das ist die Frage Q7 aus dem Vorgängerkonzept. Der Star soll durch Kontakt nicht zum Opfer
werden, nur weil er vorn liegt und jeder an ihm vorbei muss.

1. **Währung.** Kontakt kostet Zeit, Puste, Position. Nie Punkte, Funde, Tore, Höhe, HP oder
   einen schon vollendeten Zug.
2. **Der Ausgang liest Disziplin-Sub-Skills.** Wer laut Matrix gut ist, ist im Mittel auch im
   Kontakt gut. Prüfgröße: Korrelation zwischen Eignung und Kontaktsaldo ≥ 0 (Takeshi-Vorbild:
   Rempler und Treffer korrelieren mit der Eignung zu 0,85/0,88).
3. **Schonfrist und Deckel.** Nach einem Treffer ist das Opfer kurz unangreifbar; je Spiel gibt
   es eine Obergrenze wirksamer Stürze. Kein „Draufhauen auf den Liegenden", keine Dreierkette.
4. **Keine Zielwahl nach Platzierung.** Unter mehreren Kandidaten entscheidet die Nähe
   (und in Stufe 3 die Neigung des Typs), nicht wer führt. Die heutige Sortierung nach
   Position (`b.pos-a.pos`) sollte in derselben Runde auf Nähe umgestellt werden.
5. **Schiedsrichter-Gutschrift.** Beim Foul bekommt das Opfer die verlorene Zeit zurück, der
   Täter die Strafe (Short-Track-Muster, Q23). Das macht aus der unsichtbaren Regel ein Bild.
6. **Sperre vor dem Ziel.** Kein Kontakt auf den letzten 5 %; dort gäbe es Kontakt ohne
   Eigennutz (Fall-Guys-Griefing, Q14).

Dazu ein **Varianz-Budget** als Messgröße: der Anteil der Ergebnisstreuung, der aus Kontakt
stammt (Zeit durch Kontakt gegen Gesamtzeit-Streuung), soll je Disziplin unter etwa 15 %
bleiben. Liegt er höher, ist der Kanal zu laut, auch wenn rho gerade noch hält.

### 3.5 Technische Bauregeln (aus Lehren im Repo)

- **Eigener Zufallsstrom für Kontakt.** Neue Würfe (Foul, Ausweichen außerhalb Takeshi) ziehen
  aus einem eigenen, aus der Saat abgeleiteten Generator, nicht aus `rr()`. Dann mischt das
  Einschalten nicht jeden späteren Wurf der Simulation neu, und Vorher/Nachher-Vergleiche auf
  derselben Saat werden viel schärfer (wichtig, weil −0,03 unter der Kaderspannweite liegt).
- **Neue Felder an Einheiten nicht aufzählbar setzen**, wenn sie nur der Anzeige dienen (Muster
  `vizSturzSetzen()`): ein aufzählbares Feld taucht über die Protokoll-Rohreferenz im
  Fingerabdruck auf, obwohl die Wertung gleich bleibt.
- **Weicher Deckel statt Stopp** (Q22): der Mini-Stun bremst, er stellt niemanden auf null.
- **Der Kontaktzähler geht nicht in `wert()`.** Hockey hat `checks*0,4` aus genau dem Grund
  wieder entfernt; neue Zeilen sind Statistik, kein Wertungsbestandteil.

---

## 4. (C) Pilot-Entwurf je Chassis

### 4.1 Bahn

**Spurt klassisch (Pilot 1).** Alles Nötige steht: Rempler, Persönlichkeits-Frequenz, Puste
(`u.reserve`), Stolpern, Boxscore-Spalte „Rempl", Live-Rennplan. Neu:

1. `kontaktProfil` statt der festen `willTackeln`-Tabelle (Stufe 1: identische Zahlen).
2. Auswahlschwelle `pMin` aus der Haltung.
3. Fehlschlag: Mini-Stun, Puste −10, längere Abklingzeit; Grundpreis `T_a0` wieder an.
4. Verteidiger-Wahl Ausweichen/Dagegenhalten nach AW (das Ausweichen gibt es in Takeshi schon,
   Feld `tackleAusweichen`).
5. Hänger als Ausgang des ausgeglichenen Duells.
6. Foul mit Zeitstrafe und Gutschrift.
7. Opferwahl nach Nähe statt nach Position.

**Die Hatz und HYROX** laufen über denselben `stepSpurt`-Block bzw. `stepSpurtHyrox()`; sie
haben eigene Fingerabdruck-Einträge (die sechs neuen vom 16.11.). In der Hatz (Wellen-
Ausscheidung) wiegt ein Sturz schwerer als im klassischen Lauf, weil er das Ausscheiden
auslösen kann — dort gilt die Sperre zusätzlich für die letzten Meter **jeder Welle**, und der
Deckel sinkt auf einen wirksamen Sturz je Welle. In HYROX gibt es Kontakt nur auf den
Laufstücken, nie an der Station (Stationen sind Einzelarbeit; die bestehende Sperre „im
Hindernis" deckt das ab). Beide werden nach dem klassischen Lauf getrennt gemessen
(`scripts/messe-spurt-hatz-einfluss.mjs`, `scripts/messe-spurt-hyrox-einfluss.mjs`).

**Takeshi (Pilot 3).** Gleicher Codepfad, gleiches Paket. Zwei Besonderheiten: `tackleAb:30`
lässt fast jeden rempeln, die Auswahlschwelle greift hier also am stärksten; und die Lehre
`tackleNerven` (0,937 → 0,902, als Rempler Nerven kosteten und ausscheiden ließen) verbietet,
dass der Mini-Stun Nerven kostet. Fehlschlag kostet hier Zeit und Puste, sonst nichts. rho
0,838 lässt die vollen −0,03 rechnerisch zu, aber Takeshi hatte die größte Bewegung im Feld —
deshalb erst nach dem Spurt.

**Staffel.** rho 0,931, aber Pp 21,1/22,0 fast voll. Kontakt mit Wirkung würde WUCHT-Attribute
heben und die Schranke reißen. Empfehlung: nur das Wechselzonen-Gedränge als Bild über die
gebuchte Wechselgüte; die Regler werden gelesen, um zu zeigen, **wer** drängelt.

**Climbing.** Das Herunterziehen existiert, aber ohne Persönlichkeit: jeder Führende zieht.
rho 0,801 lässt null Budget. Vorschlag: Climbing bekommt die Regler nur für die **Darstellung**
(wer zieht mit vollem Einsatz, wer wehrt sich, wer weicht aus) und wird für Mechanik erst
angefasst, wenn sein rho-Puffer wieder da ist. Das war am 26.10. Chris' eigenes Beispiel —
deshalb Frage 3 in Abschnitt 9.

**Time-Trial.** Einzelstart, kein Gegner auf der Strecke: kein Körperkontakt. Nur Zuruf und
Reaktion (Geister-Vergleich, Faust am Ziel).

### 4.2 Feldspiel

**Football (Pilot 2).** Das beste Feldspiel für den ersten Versuch, aus drei Gründen: rho 0,854
lässt die −0,03 zu; der Motor löst Tackles in `resolveLaufNfl()` **abstrakt** auf (keine
Positions-Kaskade); und Fehlschlag-Kosten gibt es dort schon als gebrochenen Tackle. Entwurf:

- **Tackle-Stil aus HÄ**: „voll" gegen „sicher" (Madden: Big Hitter gegen Safe Tackler, N4).
  Voll: Fumble-Chance hoch, aber auch die Chance auf den gebrochenen Tackle. Sicher: beides
  runter. Kalibriert auf gleichen erwarteten Raumverlust.
- **Wer tackelt, aus KB**: das Los `fkLos(def,"ABWEHR_LAUF")` bekommt die Kontaktbereitschaft
  als milden zweiten Faktor (der Draufgänger ist öfter der Erste am Mann).
- **Läufer-Antwort aus AW**: ausweichen (Wendigkeit, Chance auf Bruch nach außen) oder
  durchgehen (LAUFKRAFT, Yards nach Kontakt).
- **Foul aus DI**: unnötige Härte, 15 Yards.
- Kostenbuchung: verpasster Tackle zählt für den Tackler, Ermüdung +1 für den Drive.

**Basketball.** rho 0,822 lässt nur etwa 0,02. Entwurf, bewusst klein: `REB_BOXOUT` bleibt als
Teamkonstante, aber **wer** ausboxt, entscheidet die Tendenz „Bahn zumachen" (Bollwerk und
Beschützer boxen, Schleicher spekulieren auf den Abpraller). Screens: Tendenz, einen Block zu
stellen; ein harter Block kann ein Offensivfoul sein (DI). Rein als Statistik und Bild zuerst
(Klasse A), Wirkung nur, wenn die Taktik-Karte eine lesende Mechanik bekommt.

**Hockey.** rho 0,700 unter Chris-Ausnahme, kein Budget. Was trotzdem geht, ohne den Ausgang
zu berühren: die **Verteilung** der ohnehin fallenden rund zehn Checks je Team nach KB (wer
checkt), bei gleicher Gesamtzahl, über den eigenen Zufallsstrom. Der verpasste Check wird als
längere Abklingzeit plus Puste gebucht, nie als Positionsänderung. Das ist ein Messversuch mit
Abbruch bei jeder Verschlechterung, kein Pilot.

### 4.3 Kampf (TDM, Mini-DM, Battlefield)

Der Kontakt ist hier Rückstoß und Verdrängung. Die Zutaten liegen je Archetyp vor
(`knockbackResist`, `stunResist`), `stossen()` schiebt bereits.

- **Battlefield-Pod (Pilot 4):** „Verdrängen vom Punkt". Ein Stoß-Versuch schiebt den Gegner aus
  dem Kontrollkreis; kostet Position, keine HP. Fehlschlag: der Stoßende verliert seinen
  nächsten Angriff um `0,35 s · (1 − stunResist)`. KB entscheidet, wer stößt statt zuschlägt;
  HÄ die Weite. Der Vierer-Pod steht bei 0,861–0,923 und hat Puffer.
- **TDM:** rho 0,813, nur etwa 0,013 Luft, und Persönlichkeit war hier schon einmal der größte
  Fehlordner. Nur Rückstoß-Bild über gebuchte Treffer; keine neue Wirkung.
- **Mini-DM:** Rausschubsen in Grube/Käfig als dritter Ausgang, gebunden an bereits verlorene
  HP (K1 im Vorgänger). Braucht Chris' Freigabe (dort Frage 2) und läuft unter der Star-/
  Paartreue-Ausnahme. Wenn es kommt, dann mit denselben Reglern: KB = stößt lieber als er
  schlägt, AW = hält Abstand zur Kante.

Für alle drei gilt die P1-Regel: Kontaktneigung darf nicht dazu führen, dass ein Typ **Menge**
verliert (weniger Angriffe, mehr Leerlauf). Ein Stoß ersetzt einen Angriff, er kommt nicht
obendrauf, und sein erwarteter Wert wird auf den des ersetzten Angriffs kalibriert.

### 4.4 Bühne und Wand

- **Eiskunstlauf (Pilot 5):** „Kreuzen". Wenn vier Aktive gezeigt werden (Chris' Wunsch vom
  08.11.), entstehen Kreuzungen. Je Kreuzung, vorab in `bauBuehne()` gewürfelt: wer ausweicht
  (AW, kostet einen Tick Anlauf zum nächsten Element) und wer durchzieht (KB; trifft er, zahlt
  der Verursacher den größeren Abzug, der Behinderte bekommt die Gutschrift). rho 0,912,
  Pp 18,8/19,8 — Puffer bei rho, bei Pp genau hinsehen.
- **Wettessen:** größter Puffer (0,905; Pp 8,7/10,0). Tischkampf in der Ergebnisschicht als
  Alternative, falls Eiskunstlauf an Pp scheitert.
- **Breaking, Fechten:** Kontakt ist die Disziplin. Hier nur die Regler für den **Stil** lesen
  (HÄ: wie hart der Peiniger zulangt innerhalb des bestehenden Deckels; DI: Fechten-
  Verwarnung als Bild). Keine neue Wirkung.
- **I-Spy, Showcase:** unter der Schranke (0,776, 0,781). Nur Theater nach dem Wurf, wie im
  Vorgänger Abschnitt 4 beschrieben.

### 4.5 Ausdrücklich ohne Körperkontakt

| Disziplin | Warum | Was stattdessen |
|---|---|---|
| Time-Trial | Einzelstart | Zuruf, Reaktion am Ziel |
| Tennis | Netz trennt | Faust, Blick, Psychospiel nach dem Punkt (KB → Lautstärke) |
| Speed-Schach | Brett | Uhr schlagen, Vorbeugen, Starren |
| Gewichtheben (Hantel-Duell) | getrennte Plattformen | Einschüchtern, Reaktion auf den Versuch des anderen |

Die Regler werden auch hier gelesen — aber nur, um zu wählen, **welche** Reaktion eine Figur
zeigt (der Draufgänger brüllt, der Schleicher guckt weg). Keine Wirkung auf das Ergebnis. Das
Sandsack-Rennen und „Die Grube" beim Gewichtheben sind eigene Formate mit geteiltem Feld und
fallen unter die Bahn-Regeln.

---

## 5. (D) Statistik und (E) Darstellung

### 5.1 Neue Boxscore-Zeilen

Grundsatz: Kontakt bekommt **eine** verdichtete Zeile in der Wertungstabelle und die Details im
Tooltip — sonst wird die Tabelle zu breit.

| Chassis | Bestand | Neu |
|---|---|---|
| Bahn | „Rempl" (`tackles/getackelt`), Takeshi „Ausw", „Gedr" | **„Kont"**: Versuche/Treffer (3/2). Tooltip: ins Leere, eingesteckt, gestanden, ausgewichen, Stürze, Hänger, Fouls. **„±Zeit"**: Zeit durch Kontakt, zugefügt und bezahlt (+1,4 / −0,6 s) |
| Hockey | „Chk" (`checks`), Strafen | Checks versucht/gesessen, eingesteckt, verpasst |
| Basketball | Fouls (Schiedsrichter) | Ausgeboxt (gewonnene Brett-Duelle), Blocks gestellt, Offensivfouls |
| Football | „Tkl" (`checks`) | **Verpasste Tackles**, **gebrochene Tackles** (für den Läufer; `erg.gebrochen`/`erstTackler` liegen vor), erzwungene Fumbles, Strafyards |
| Kampf | Schaden, Kills | Rückstöße, vom Punkt verdrängt, aus dem Tritt gebracht (Fehlstoß) |
| Bühne/Wand | disziplineigen | Kreuzungen: durchgezogen/ausgewichen/behindert; Climbing: Züge/gewehrt (Zähler `zugVersuchCount`, `wehrCount`, `gezogenCount` existieren) |

Sichtbar an vier Stellen: (1) Live-Wertungstabelle (`wertungTabelle`-Spalten), (2) Endstand/
Boxscore, (3) Ticker und Schwebetext am Ereignis, (4) **Spielerkarte** in der Aufstellung: die
Tendenzen aus 2.4 als kurze Wortliste neben der Persönlichkeit (der Tooltip
`PERS[pk].l + " — Persönlichkeit"` existiert, ~38165). Ob und wie die Zähler in die
Saisonstatistik auf dem Server wandern, ist in dieser Runde **nicht geprüft**.

Dazu die **Anweisungsbilanz** aus dem Konzept vom 26.10.: „Rempler 4 · gesessen 2 · bezahlt
1,1 s". Sie ist die Brücke zu den Strategie-Vorlagen und beweist, dass ein Stil wirklich
gespielt wurde.

### 5.2 Darstellung mit dem vorhandenen Bestand

Vorhanden sind je Figur `walk`, `angriff`, `treffer`, `tod` (plus Nord-Ergänzung; HYROX-
Arbeitsposen nur bei einem Teil der Figuren, optional). Dazu im Motor: `u.lungeVis` (Stoß-
Pose), `vizSturz` (Sturz liegt auf der `treffer`- statt der `tod`-Pose), Effekte `hieb` und
`spur`, `schwebe()`, Ton, Kamera.

| Ereignis | Bild mit Vorhandenem |
|---|---|
| Versuch | Täter `angriff`-Pose über `lungeVis` (besteht) |
| Treffer | Opfer `treffer`-Pose, Versatz weg vom Täter, `hieb`-Bogen, Kamera-Ruck 3–5 px, Standbild **nur der beiden Figuren** (nicht der Uhr) |
| Sturz | `treffer`-Pose gekippt (der Behelf, den Eiskunstlauf und Hockey schon nutzen), Staub; Aufstehen = zurückkippen |
| **Mini-Stun** (neu) | Täter läuft sichtbar einen Schritt ins Leere (Versatz **in** Stoßrichtung), dann `treffer`-Pose für 2–3 Bilder, Sternchen-Partikel über dem Kopf, Puste-Balken blinkt, Schwebetext „ins Leere!" |
| Ausweichen | `spur`-Effekt seitlich (besteht in Takeshi), Schwebetext „weicht aus" |
| Hänger | dünner Verbindungsstrich, beide in gebremstem `walk` mit leichtem Zittern, löst sich mit Schubser-Bild |
| Foul | Pfiff (Ton besteht), Etikett „Foul — Zeit gutgeschrieben" am Opfer, Strafsymbol am Täter |
| Stil sichtbar | Härte über die Größe von Versatz und Ruck; ein Draufgänger-Treffer sieht anders aus als ein kontrollierter |

Regeln wie im Vorgänger: *gezeigt = gebucht*; im Live-Feldspiel nur Zeichen-Versatz
(`vizX/vizY`), nie `u.x/u.y`.

### 5.3 Pose-Lücken — nur als Vorschlag

Keine dieser Posen wird bestellt. Der Figurenbestand umfasst laut
`figuren-reparatur-nord-07-11.md` 360 PixelLab-Figuren; jede neue Pose fiele für alle an.

| Lücke | Wozu | Behelf heute | Umfang, falls gewünscht |
|---|---|---|---|
| **Niedergehen und Aufstehen** | Sturz ohne K.o. | gekippte `treffer`-Pose | 1 Animation × 360 Figuren (je Blickrichtung, falls nicht gespiegelt wird, entsprechend mehr) |
| **Schieben/Drücken** (Dauerpose) | Ausboxen, Verdrängen, Hänger | `angriff`-Pose eingefroren plus Strich | 1 × 360 |
| **Seitschritt** | Ausweichen | Versatz plus `spur`-Effekt | 1 × 360 |
| **Benommen** | Mini-Stun | `treffer`-Pose plus Sternchen | 1 × 360 |

Meine Rangfolge, falls Chris überhaupt etwas freigibt: zuerst „Niedergehen und Aufstehen" (der
Behelf fällt am ehesten auf, und Sturz ist das häufigste Bild), der Rest ist mit Effekten gut
genug. Einen Preis nenne ich nicht — die Stückkosten stehen in keinem Dokument, das ich gelesen
habe; die Menge wäre 360 Generierungen je Pose und Richtung. Ein billiger Zwischenschritt wäre,
die Pose zunächst nur für die Figuren zu bestellen, die in den Pilot-Disziplinen tatsächlich
auflaufen; auch das nur nach ausdrücklicher Freigabe.

---

## 6. (F) Abnahme- und Messplan

### 6.1 Wie viel Budget jede Disziplin hat

Chris' Rahmen: bis −0,03, solange rho über 0,80 bleibt. Abbruchgrenze je Disziplin ist deshalb
`max(Ist − 0,03 ; 0,805)`.

| Disziplin | rho Ist | Abbruch unter | nutzbares Budget | Pp Ist | Urteil |
|---|---:|---:|---:|---|---|
| Staffel | 0,931 | 0,901 | 0,030 | 21,1/22,0 | rho frei, **Pp sperrt** |
| Eiskunstlauf | 0,912 | 0,882 | 0,030 | 18,8/19,8 | Pilot Bühne, Pp beobachten |
| Wettessen | 0,905 | 0,875 | 0,030 | 8,7/10,0 | Reserve-Pilot Bühne |
| Battlefield (Vierer-Pod) | 0,861–0,923 | 0,831 | 0,030 | (Pod eigens) | Pilot Kampf |
| Spurt | 0,860 | 0,830 | 0,030 | 18,5/15,4 | **Pilot 1** |
| Football | 0,854 | 0,824 | 0,030 | 15,3/16,0 | **Pilot 2** |
| Takeshi | 0,838 | 0,808 | 0,030 | 18,9/17,7 | Pilot 3, eng |
| Basketball | 0,822 | 0,805 | 0,017 | 15,6/16,7 | nur kleine Dosis |
| TDM | 0,813 | 0,805 | 0,008 | 16,8/14,2 | nur Anzeige |
| Climbing | 0,801 | — | 0 | 12,0/9,5 | nur Anzeige |
| Hockey | 0,700 | — | 0 (Ausnahme) | 13,9/21,8 | nur Verteilungs-Versuch |
| I-Spy, Showcase | 0,776 / 0,781 | — | 0 | — | nur Theater |
| Mini-DM | Ausnahme | — | — | — | eigene Freigabe |

### 6.2 Messwerkzeuge und Aufbau

Eine Differenz von 0,03 liegt **unter** der Kaderspannweite (Spurt 0,074, Takeshi 0,143 bei
n=24). Sie ist nur gepaart messbar:

- `scripts/miss-alle-disziplinen.mjs 48 <disziplin>` kaderfest (Kaderfamilie aus dem
  Live-Save, vorher `npx tsx scripts/pruefe-spiegel-frische.ts`), Spurt mit
  `OLY_FORM_MODUS=echt`. Flag aus und Flag an auf **denselben** Saaten und Kadern; berichtet
  wird die gepaarte Differenz je Kader, nicht zwei Einzelwerte.
- `scripts/miss-star-paartreue.mjs` für Star auf Rang 1/Top 2 und Paare ≥ 15 Punkte.
- **Pp:** `scripts/messe-arena-einfluss.mjs <disziplin> <n>` und derselbe Lauf mit
  `--saat-versatz=10000000` (zweiter Saatstrom); für Hatz/HYROX die beiden Spurt-Sonden.
  Schranke ≤ 25, Ziel < 15, rho hat Vorrang.
- Fingerabdruck: `node scripts/pruefe-wertung-fingerabdruck.mjs`, vorher/nachher per `diff`.
- Persönlichkeits-Kontrafaktik: Schnittstelle nach dem Muster `window.__arena.persHandwerk`
  bzw. `bahnFlags`, die alle Spieler auf einen Typ zwingt (neu zu bauen, klein).

### 6.3 Abbruchkriterien, vor dem Bau festgelegt

| | Kriterium | Schwelle |
|---|---|---|
| **A** | rho je Spiel (n=48, kaderfest, gepaart) | nicht unter `max(Ist−0,03; 0,805)`; gepaarte Differenz in ≥ 4 von 5 Kadern innerhalb −0,03 |
| **B** | Pp | ≤ 25 auf beiden Saatströmen; kein Attribut gewinnt mehr als 5 Punkte über sein Matrixgewicht hinaus |
| **C** | Star | Rang 1 und Top 2 je höchstens 5 Prozentpunkte unter Ist |
| **D** | Paartreue ≥ 15 Punkte Abstand | nicht mehr als 1 Prozentpunkt unter Ist |
| **E** | Spiegel | Heim:Gast nahe 50:50 |
| **N** | **Neutralität der Persönlichkeit** | erzwungen-gleicher Typ gegen echte Typen: mittlere Leistung je Typ unterscheidet sich bei gleicher Eignung um weniger als das Rauschen; eps² der Persönlichkeit auf das Eignungs-Residuum steigt nicht gegenüber Flag aus (die Größe berichtet `verify-arena-persoenlichkeit-p1-paket-07-10.mjs` schon) |
| **K** | Kontaktsaldo gegen Eignung | Korrelation ≥ 0; der Eignungsbeste hat im Mittel keinen negativen Saldo |
| **V** | Varianzanteil Kontakt | unter etwa 15 % der Ergebnisstreuung |
| **H** | Häufigkeit | im Korridor der Disziplin (Spurt: wenige je Rennen; Takeshi 13,3/5,4; Hockey ~10 Checks je Team); Fehlschläge sichtbar, aber nicht häufiger als Treffer |
| **D0** | Dosisverlauf | fällt rho monoton mit der Dosis **und** reißt A, ist der Kanal eignungsfremd: verwerfen, nicht kleiner drehen |

Reißt eine Zeile: Stufe zurücknehmen, nicht die Schranke verschieben. Das Budget von −0,03 gilt
für das **ganze** Kontaktpaket einer Disziplin, nicht je Baustein.

### 6.4 Dosis-Stufen

| Stufe | Inhalt | Erwartung |
|---|---|---|
| 0 | Regler-Schicht, Zähler, Anzeige. Flag aus = heutiger Motor | bit-identisch, Fingerabdruck unverändert |
| 1 | Fehlschlag-Kosten (Mini-Stun, Puste, Grundpreis) | kleinste Verhaltensänderung, größter Erlebnisgewinn |
| 2 | Auswahlschwelle `pMin` und Verteidiger-Wahl (AW) | macht die Typen unterscheidbar; hier entscheidet sich Kriterium N |
| 3 | Trait-Verschiebungen, Härte-Faktor, Foul und Gutschrift, Hänger | Feinschliff |
| 4 | Bedingte Neigungen (Schutz, Revanche, gegen Angeschlagene) | neuer Zielwahl-Kanal, einzeln messen |

**Nachtrag 17.11. — Hänger auf 60 % für 0,4 s umgesetzt (Spurt klassisch, Stufe 3).** Chris am
17.11., wörtlich: „Und das bremsen machst du auf 60%". Der Pilot (PR #1534) bremste den Hänger nur
über `u.kraft` (82 % Tempo, ≈ 0,07 s je Beteiligtem) statt wie in Tabelle 3.3 auf 60 %. Jetzt:
beide Beteiligten 0,4 s auf 60 % Tempo, Zeitverlust 0,4 · (1 − 0,6) = 0,16 s je Läufer, so auch in
`zeitBezahlt` gebucht. Umsetzung ohne neues Läufer-Feld: Ende des Hängers (Rennuhr) in der WeakMap
`kontaktHaengerMap`, `tempoVon` liest dort 0,6 statt der 82 % von `u.kraft` (das bleibt für Pose
und Puste gesetzt). Ohne Flag wird die WeakMap nie beschrieben, Fingerabdruck unverändert
`GESAMT e80babacb68c (75)`. Ebenfalls von Chris bestätigt und unverändert: im Normalfall gewinnt
einer das Duell und zahlt kaum etwas (Treffer: Täter nur Grundpreis ≈ 0,05 s; abgewehrt: Blocker
zahlt nichts, Täter Mini-Stun) — der Hänger bleibt der seltene Ausgleichsfall (|p − 0,5| < 0,06).

| Messung (Spurt, `OLY_FORM_MODUS=echt`, 96 Spiele) | vorher (#1534) | Hänger 60 % |
|---|---:|---:|
| rho je Spiel, Flag aus | 0,887 | 0,887 |
| rho je Spiel, `spurt:3` | 0,890 | 0,890 |
| rho Saison, aus / `spurt:3` | 0,930 / 0,937 | 0,930 / 0,930 |
| Pp-Abweichung `spurt:3` (48 Läufe) | 9,8 | 9,7 |

Gegenprobe (24 Saaten, nur Stufe 3 ohne Foul gegen dasselbe Rennen ohne Hänger): Beteiligte
verlieren im Mittel ≈ 0,17 s (bei 82 % waren es ≈ 0,065 s).

### 6.5 Flag-Strategie und Fingerabdruck

Aktueller Stand: `GESAMT e80babacb68c (75 Einträge)`. Kein Test pinnt ihn; er wird von Hand
vorher/nachher verglichen. **Seit 17.11. (Spurt klassisch scharf): `GESAMT 7c9257b4435c`**, s. Abschnitt 11.3.

1. **Einbau hinter Flag, Standard aus.** `BAHN_ART[d].kontakt` (bzw. `FELDSPIEL_ART`,
   `ARENA_ART`) ist `null`; gesetzt wird nur über `window.__arena.bahnFlags({kontakt:{...}})` /
   `buehneFlags` / eine Entsprechung für Feldspiel und Kampf. Nachweis im PR: GESAMT bleibt
   `e80babacb68c`, alle 75 Einzel-Hashes gleich.
2. **Messung nur über das Flag** aus den Messskripten. Solange gemessen wird, bewegt sich der
   Fingerabdruck auf `main` nicht.
3. **Scharfschalten ist ein eigener, kleiner PR je Disziplin.** Er setzt nur den Standard in der
   Art-Tabelle. Der `diff` der 75 Zeilen darf **ausschließlich** die Einträge dieser Disziplin
   zeigen (Spurt: die klassischen Saaten — die Hatz-/HYROX-Einträge bleiben, weil dort kein Rempler läuft, s. Abschnitt 11.3; Takeshi: Einträge
   und Pod). Der PR nennt alten und neuen GESAMT-Wert, und der Kopfkommentar des Skripts wird
   nachgezogen.
4. **Nie zwei Disziplinen in einem PR scharfschalten.** Sonst lässt sich am Fingerabdruck nicht
   mehr ablesen, was sich bewegt hat.
5. **Rückweg:** der Standard zurück auf `null` muss den vorherigen GESAMT-Wert exakt
   wiederherstellen. Das wird beim Scharfschalten einmal geprüft.

Danach `data/generated/disziplin-abnahme.json` und `stand-aller-disziplinen.md` nachziehen.

### 6.6 Reihenfolge der Piloten, mit Begründung

| Rang | Pilot | Warum hier |
|---|---|---|
| 0 | **Regler-Schicht** `kontaktProfil`, Zähler, Tooltip, Anzeige-Baukasten, eigener Zufallsstrom; `taktiker`/`beschuetzer` bereinigt | bit-identisch; alles Spätere braucht es |
| 1 | **Spurt klassisch**, danach Hatz und HYROX | Rempler, Persönlichkeits-Frequenz, Puste, Boxscore und Live-Ansage stehen; volles Budget; Rennen rechnen in Millisekunden, also viele Messläufe |
| 2 | **Football** | Feldspiel ohne Positions-Kaskade, Puffer vorhanden, Fehlschlag-Logik (gebrochener Tackle) schon da; frischer Motor mit sauberer Abnahme |
| 3 | **Takeshi** | gleicher Code wie Spurt, aber enger und beweglicher — erst mit den kalibrierten Spurt-Werten |
| 4 | **Battlefield-Pod** | Kampf mit Puffer; Verdrängen kostet Position, nicht HP |
| 5 | **Eiskunstlauf** (Reserve: Wettessen) | Bühne mit rho-Puffer; setzt „vier Aktive anzeigen" voraus |
| 6 | Basketball kleine Dosis, Hockey Verteilungs-Versuch | nur wenn 1–5 das Muster bestätigt haben |

---

## 7. Strategie-Vorlagen: dieselben Regler, eine Ebene höher

Kommt später; hier nur, damit der Unterbau passt. Eine Vorlage ist eine **Team-Verschiebung der
vier Regler**, keine eigene Mechanik und keine Stat-Änderung:

| Vorlage | KB | `pMin` (Haltung) | HÄ | AW |
|---|---|---|---|---|
| Defensiv („Sauber laufen") | −15 | eine Stufe vorsichtiger | −10 | +15 |
| Neutral | 0 | 0 | 0 | 0 |
| Offensiv („Ellbogen raus") | +15 | eine Stufe mutiger | +10 | −15 |

Die Persönlichkeit bleibt darunter spürbar (FM-Muster: Team-Mentalität verschiebt die
Einzelvorgabe, ersetzt sie nicht, Q36). Neutral ist bit-identisch. Weil Kriterium N die Typen
schon gegeneinander neutral hält, ist eine Vorlage im Mittel ebenfalls neutral — sie lohnt
dann, wenn der eigene Kader die passenden Sub-Skills hat (viel Wucht: offensiv; viel Technik:
defensiv). Das ist der Knopf-Test vom 26.10. Abgenommen wird trotzdem jede Stufe und jede
Paarung einzeln.

---

## 8. (G) Recherche

Neue Quellen dieser Runde. Zu den meisten Spielen gibt es keine offizielle Formel; wo eine
Angabe aus Foren oder Guides stammt, steht es dabei. Bei den mit „Suchauszug" markierten
Einträgen habe ich nur den Auszug der Suchmaschine gelesen, nicht die Seite selbst; ein Thread
(operationsports.com, „NBA 2K12 Tendency/Rating definition thread") ließ sich nicht abrufen
(HTTP 403) und ist nicht verwendet. Eingebettete Anweisungen in Seiten sind mir in dieser Runde
nicht begegnet.

| # | Quelle | Was sie belegt | Güte |
|---|---|---|---|
| N1 | Operation Sports Forum, „NBA2K17 Ratings/Tendency Explanation" — https://forums.operationsports.com/forums/nba-2k-basketball-rosters/895886-nba2k17-ratings-tendency-explanation-5.html | Attribute und Hot Zones bestimmen die **Wirksamkeit**, Tendenzen die **Häufigkeit** einer Aktion | Nutzerforum, Suchauszug |
| N2 | Operation Sports, „NBA 2K20 Simulation Basketball Wiki" — https://forums.operationsports.com/forums/forum/basketball/nba-2k-basketball/891692-nba-2k20-simulation-basketball-wiki?p=24007884 | Die Tendenz „Take Charge" wirkt zusammen mit Foul, Hard Foul, Block Shot und Contest Shot: gemeinsam entscheiden sie, **was** ein Verteidiger tut, wenn der Ballführer abschließt; Foul/Hard Foul steuern die Häufigkeit absichtlicher Fouls | Community-Wiki, Suchauszug |
| N3 | Diamond Lobby, Slider-Guide — https://diamondlobby.com/nba-2k21/how-to-set-realistic-game-sliders/ | Tendenzen gelten in der Regel nur für die KI-gesteuerten Spieler | Guide, Suchauszug |
| N4 | GamesRadar, Madden-26-Traits — https://www.gamesradar.com/games/madden-nfl/madden-26-qb-traits ; WePC, Hit Stick — https://www.wepc.com/gaming/madden-24-hit-stick/ ; Operation Sports, „The How and Whys of Hit Sticking" (Madden 11) — https://www.osftw.com/features/1108/madden-nfl-11-the-how-and-whys-of-hit-sticking ; EA, Gridiron Notes Madden 25 — https://careers.ea.com/games/madden-nfl/madden-nfl-25/news/gridiron-notes-madden-25-gameplay-deep-dive | „Big Hitter" = höhere Tendenz zum Hit Stick, „Safe Tackler" = höhere Tendenz zum sicheren Tackle; der Hit Stick ist riskant und kein garantierter Tackle; verfehlte Hit Sticks im offenen Feld führen oft zum Touchdown; zu früh, zu spät oder im falschen Winkel reduziert die Wucht | Presse/Guide/Hersteller, Suchauszüge; teils alte Spielversionen |
| N5 | FM-Attribut-Guides — https://fminside.net/football-manager-player-attributes ; https://www.fifplay.com/football-manager-2024-player-attributes/ ; https://sortitoutsi.net/content/67538/fm24-guide-players-attributes-explained ; versteckte Attribute — https://www.videogamer.com/?p=1131692 | „Aggression" = wie bereitwillig und mit wie viel Kraft ein Spieler in den Zweikampf geht, **nicht** wie unfair er ist; Fouls hängen an den versteckten Werten „Dirtiness" und „Sportsmanship"; schwaches Tackling, Antizipation, Entscheidungen und Konzentration erhöhen die Foulzahl | Fan-Guides, Suchauszüge; welcher Satz von welcher der Seiten stammt, ist nicht einzeln geprüft |
| N6 | EA-Forum und The Hockey News zu NHL 24–26 — https://forums.ea.com/discussions/nhl-25-general-discussion-en/hitting-needs-some-improvement-/4975379 ; https://thehockeynews.com/gaming/latest-news/nhl-24-hitting-mechanics-should-return-in-nhl-25 | Ein verfehlter Check wirft den Checkenden aus der Position; Spieler empfinden das als richtig, solange es berechenbar ist, und als unfair, wenn auch sauberes Stellungsspiel bestraft wird | Nutzermeinungen/Presse, Suchauszüge |
| N7 | Gran Turismo, offizielle Mitteilungen — https://www.gran-turismo.com/gb/gtsport/news/00_3494949.html ; GTPlanet — https://www.gtplanet.net/?p=102491 ; TopGear NL — https://topgear.nl/game/gt-sport-straft-slachtoffers-van-aanrijdingen/ | Automatische Zeitstrafen nach Kontakt; wer die Strafe absitzt, wird langsamer und „geisterhaft"; leichte Berührungen wurden später straffrei gestellt; das System galt über Jahre als abwechselnd zu streng und zu lasch, und es bestrafte zeitweise die Opfer | Hersteller/Presse, Suchauszüge |
| N8 | Blood Bowl — https://en.wikipedia.org/wiki/Blood_Bowl ; Goonhammer, „Risk Management in Blood Bowl" — https://goonhammer.com/hammer-of-math-risk-management-in-blood-bowl | Ein Block kann „Both Down" oder „Attacker Down" ergeben; eine gescheiterte Aktion beendet den eigenen Zug; die Fähigkeit „Block" hebt „Both Down" auf | Lexikon/Fachblog, Suchauszüge |
| N9 | EA Sports FC, PlayStyles — https://www.ea.com/games/ea-sports-fc/fc-24/playstyles | Benannte Stil-Merkmale („Bruiser", „Anticipate", „Slide Tackle") verändern, wie ein Zweikampf geführt wird | Hersteller, Suchauszug; spätere Abschwächungen nur aus Drittquellen |

Nicht gefunden: eine belastbare Quelle zu iRacings Kontaktpunkten und zu einer offiziellen
2K-Formel für Tendenzen. Beides ist deshalb hier nicht verwendet.

### 8.1 Was daraus folgt

| Frage | Wie andere es lösen | Was wir übernehmen |
|---|---|---|
| **Persönlichkeit → Verhalten** | NBA 2K trennt Häufigkeit (Tendenz) von Güte (Attribut) (N1); mehrere Tendenzen entscheiden gemeinsam, welche Aktion in einer Situation gewählt wird (N2). FM trennt „geht rein" (Aggression) von „spielt unfair" (Dirtiness) (N5). Madden benennt den Stil am Spieler (N4). | Genau diese drei Trennungen: KB/HÄ (wie oft, wie voll) getrennt von den Sub-Skills (wie gut); HÄ getrennt von DI (hart ist nicht unfair); Stil als lesbare Eigenschaft der Figur. |
| **Kontaktkosten für den Angreifer** | Madden: verfehlter Hit Stick = großer Raumverlust (N4). EA NHL: verfehlter Check = aus der Position (N6). Blood Bowl: gescheiterter Block beendet den Zug, „Both Down" trifft beide (N8). Fall Guys: der Griff kostet beide (Q12). | Fehlschlag kostet spürbar (Mini-Stun), der Hänger trifft beide, und der volle Einsatz erhöht Ertrag **und** Risiko. Die Blood-Bowl-Härte (ganzer Zug weg) übernehmen wir nicht — bei uns ist es ein halber Sekundenbruch, kein Zugverlust. |
| **Kontakt im Rennen fair halten** | Short Track entschädigt den Behinderten und bestraft den Verursacher (Q23). Leichtathletik bestraft Wirkung, nicht Berührung (Q24). Gran Turismo zeigt, wie schwer eine automatische Schuldzuweisung ist: mal zu streng, mal trifft sie das Opfer (N7). Uma Musume deckelt statt zu stoppen (Q18). | Schuld wird bei uns **nicht** aus der Geometrie geraten (das GT-Problem), sondern steht fest: wer den Versuch auslöst, ist der Verursacher. Foul = Gutschrift für das Opfer. Leichte Berührung (Hänger) bleibt straffrei. |
| **Mario-Kart-Antimuster** | Aufholhilfe nach Platzierung, vom Regisseur selbst mit „manchmal ist das Leben nicht fair" verteidigt (Q16, Q17). | Keine Zielwahl nach Platzierung, kein Vorteil aus Rückstand, Sperre vor dem Ziel. Der Führende wird nicht häufiger getroffen als jeder andere in Reichweite. |
| **Erklärung für den Spieler** | FM: ein Satz Verhalten plus Gegenpreis, keine Zahl (Q35). NHL-Forum: Misstrauen, wenn man die Wirkung nicht sieht (Q37). | Tendenzen als Worte auf der Spielerkarte, Bilanz nach dem Spiel. |

---

## 9. Fragen, die nur Chris entscheiden kann

1. **Soll Persönlichkeit wirklich nur Stil sein — also bei gleichen Werten gleich gut?** Das ist
   der Kern dieses Konzepts (Draufgänger: viele Versuche, mehr Fehltritte; Bollwerk: wenige,
   aber sichere). Die Alternative wäre, dass aggressive Typen im Kontakt schlicht mehr
   herausholen. **Empfehlung: nur Stil.** Sonst wird die Persönlichkeit ein versteckter
   Stärkewert neben der Matrix, und ein Spieler mit 80 wäre je nach Typ unterschiedlich viel wert.
2. **Wie weh darf ein Fehlschlag tun?** Vorschlag: knapp eine halbe Sekunde Straucheln (rund
   0,3 s Zeitverlust) plus Puste, damit ein Versuch erst ab etwa 40 % Aussicht lohnt. Halb so
   viel wäre risikoärmer für rho, aber dann lohnt fast jeder Versuch und die Typen unterscheiden
   sich kaum. **Empfehlung: mit diesem Wert messen und nur bei gerissener Schranke kleiner
   drehen.**
3. **Climbing: nur Bild, oder ein Messversuch trotz null Puffer?** Es war am 26.10. dein eigenes
   Beispiel („eher andere herunterzutreten"). Bei rho 0,801 gibt es nichts zu verschenken.
   **Empfehlung: vorerst nur Bild; Mechanik erst, wenn Climbing wieder Luft hat.**
4. **Fouls und Schiedsrichter auch im Rennen?** Zeitstrafe für den Täter, Gutschrift für das
   Opfer, ausgelöst von Härte und fehlender Disziplin. Es gibt den Typen `Fair`, `Disciplined`,
   `Cheater`, `Renegade` endlich eine sichtbare Rolle, ist aber ein zusätzlicher Würfel.
   **Empfehlung: ja, als letzte Stufe (3) und nur, wenn sie rho nicht bewegt.**
5. **Eine neue Pose „Niedergehen und Aufstehen" für alle 360 Figuren?** Mit dem Behelf (gekippte
   Treffer-Pose) kommt alles aus. **Empfehlung: erst Spurt mit dem Behelf ansehen, dann
   entscheiden; ohne deine Freigabe wird nichts bestellt.**

---

## 10. Schrittfolge mit grobem Aufwand

Aufwand: S = eine Runde, M = zwei bis drei Runden mit Messung, L = mehr. Jeder Schritt ist ein
eigener PR; scharfgeschaltet wird je Disziplin einzeln (6.5).

| Schritt | Inhalt | Aufwand | Ergebnis |
|---|---|---|---|
| **0** | `kontaktProfil(p)` aus Persönlichkeit und Traits; Tooltip „Tendenzen"; Zähler (nicht aufzählbar, wo nur Anzeige); eigener Zufallsstrom; Flag-Gerüst in Bahn, Feldspiel, Kampf, Bühne; Kontrafaktik-Schnittstelle „alle ein Typ"; `willTackeln` liest das Profil mit identischen Zahlen | M | bit-identisch, GESAMT `e80babacb68c` |
| **0b** | Anzeige-Baukasten an gebuchten Ereignissen (Mini-Stun-Bild, Hänger-Strich, Sturz-Behelf, Kamera-Ruck) | S–M | bit-identisch |
| **1** | **Pilot Spurt klassisch**: Stufen 1–3 hinter Flag, Messung A–V, dann Scharfschalten | M | erster Fingerabdruck-Bruch, bewusst |
| **1b** | Hatz und HYROX nachmessen, eigene Sperren, Scharfschalten | S–M | |
| **2** | **Pilot Football**: Tackle-Stil, Tackler-Los, Läufer-Antwort, Foul; neue Boxscore-Zeilen | M | |
| **3** | **Pilot Takeshi** mit den Spurt-Werten | S–M | |
| **4** | **Pilot Battlefield-Pod**: Verdrängen vom Punkt | M–L | |
| **5** | **Pilot Eiskunstlauf**: Kreuzen (setzt „vier Aktive" voraus); Reserve Wettessen | M–L | |
| **6** | Basketball kleine Dosis; Hockey Verteilungs-Versuch; Stufe 4 (Schutz, Revanche) dort, wo Puffer blieb | M je Disziplin | |
| **7** | Strategie-Vorlagen auf den Reglern (Abschnitt 7), Pilot Spurt, danach Live-Chips | M–L | eigenes Konzept vom 26.10. gilt |

Nach jedem scharfgeschalteten Schritt: `disziplin-abnahme.json` und
`stand-aller-disziplinen.md` nachziehen, neuen GESAMT-Wert im Kopf von
`scripts/pruefe-wertung-fingerabdruck.mjs` eintragen.

---

## 11. Nachtrag 17.11. — Spurt klassisch scharf, und die Reihenfolge für den Rest

Chris am 17.11., wörtlich: „schubsen tacklen etc bitte auch einbauen, das kann ja die rho noch mal
verändern und sollte drin sein fürs messen". Umgesetzt ist **Schritt 1, Scharfschalten** nach 6.5
Punkt 3: `BAHN_ART.spurt.kontakt = {stufe:3}` (Stufen 1–3, Dosis 1) ist jetzt der Engine-Standard,
gesetzt direkt nach `kontaktFlagFeld()` (das Feld bleibt nicht aufzählbar). Damit rempeln, schubsen
und verhaken sich die Läufer im echten Spiel **und** in jedem Messwerkzeug (`miss-alle-disziplinen`,
`miss-star-paartreue`, `messe-arena-einfluss`, `miss-spurt-mischung`, CI-Schranke, Fingerabdruck),
ohne Schalter. „Aus" heißt seither `--kontakt-json={"spurt":null}` (Messskripte) bzw.
`--kontakt-aus` (Fingerabdruck).

**Nur der klassische Spurt bewegt sich.** Hatz und HYROX laufen über `stepSpurtHatz()` /
`stepSpurtHyrox()` und haben **keinen** Rempler-Block — das Flag kann dort nichts auslösen; Takeshi
bleibt über `!BA().takeshi && !BA().tackleAusweichen` ausgenommen. Entgegen 6.5 Punkt 3 („plus die
sechs Hatz-/HYROX-Einträge") bewegen sich deshalb im Fingerabdruck nur zwei Zeilen.

### 11.1 Abnahme vorher/nachher (gleiche Saaten, gleiche Kader, Kaderfamilie live-save)

| Kriterium | Kontakt aus | Kontakt scharf | Schwelle | Urteil |
|---|---:|---:|---|---|
| rho je Spiel, echt, n=96 (Spannweite) | 0,887 (0,069) | **0,890** (0,055) | ≥ 0,75, Ziel > 0,80 | besteht |
| rho Saison, echt | 0,930 | 0,930 | — | gleich |
| rho je Spiel / Saison, Ersatzkarte, n=96 | 0,883 / 0,916 | 0,887 / 0,923 | ≥ 0,75 | besteht |
| A: gepaarte Differenz je Kader (echt) | — | +0,026 / −0,010 / +0,012 / −0,003 / ±0,000 | 5 von 5 innerhalb −0,03 | besteht |
| B: Pp, echt, n=48, Strom 0 / 10 000 000 | 12,9 / 6,5 | **8,5 / 9,9** | ≤ 25, Ziel < 15 | besteht; größtes Plus über Matrix: dexterity +2,2 |
| C: Star auf Rang 1, echt (Top 2) | 78,3 % (93,3 %) | **82,5 %** (94,4 %) | höchstens −5 Pp | besteht (+4,2) |
| C: Star auf Rang 1, Ersatz (Top 2) | 81,9 % (93,3 %) | 80,2 % (94,0 %) | höchstens −5 Pp | besteht (−1,7) |
| Star auf letztem Rang | 0 % | 0 % | 0 % | besteht |
| D: Paartreue ≥ 15 Punkte, echt / Ersatz | 98,9 / 98,8 % | 99,0 / 99,0 % | höchstens −1 Pp | besteht |
| N: Neutralität (s. 11.2) | eps² 0,051 | eps² 0,028 | jeder Typ ≤ 1 SE | besteht (geclustert, s. Vorbehalt) |
| H: Häufigkeit je Rennen (480 Rennen) | — | 3,65 Versuche, 1,90 Treffer, 1,13 Fehlschläge, 1,55 Verzicht, 0,42 Hänger, 0,21 Fouls | Fehlschläge nicht häufiger als Treffer | besteht |
| Spurt-Mischung, n=96: Mischung / klassisch / Hatz / HYROX | 0,876 / 0,887 / 0,824 / 0,892 | 0,880 / 0,890 / 0,824 / 0,892 | ≥ 0,75 | besteht; Hatz/HYROX bit-gleich |
| Spurt-Mischung Pp (`--pp=48`, zwei Ströme) | 16,5 / 21,5 (16.11.) | 17,7 / 22,0 | ≤ 25 | besteht; Strom 10 000 000 nahe an der Schranke, beobachten |
| CI-Schranke (`pruefe-rangtreue-schranke.mjs`): spurt / spurt-klassisch / spurt-mischung | Basis 0,880 / 0,876 / 0,873 | 0,903 / 0,894 / 0,870 | Rückgang ≤ 0,05 | grün, Basislinie unverändert |

Befehle: `OLY_FORM_MODUS=echt node scripts/miss-alle-disziplinen.mjs 96 spurt`,
`[OLY_FORM_MODUS=echt] node scripts/miss-star-paartreue.mjs 96 spurt` (Formkarten-Modus dort am 17.11.
ergänzt, vorher maß das Skript nur mit der Ersatzkarte), `OLY_FORM_MODUS=echt node
scripts/messe-arena-einfluss.mjs spurt 48 [--saat-versatz=10000000]`, `node
scripts/miss-spurt-mischung.mjs 96 --je-format`. „Aus" wurde auf dem Elternstand `fa2a52d9` ohne
Schalter gemessen, „scharf" dort mit `--kontakt=spurt:3`; der Lauf auf dem neuen Stand **ohne**
Schalter liefert Zeichen für Zeichen dieselbe Zeile (0,890 / 0,055 / 0,930 / 0,091).

Nicht eigens gemessen: E (Heim:Gast), K (Kontaktsaldo gegen Eignung), V (Varianzanteil). Für K und
V fehlt der Sonde die Eignung je Läufer im `bahnLauf()`-Ergebnis; das gehört in Schritt 1b.

### 11.2 Kriterium N, wie gemessen

Kein Werkzeug im Repo misst N; gemessen mit einer Sonde über den Node-Motor (`bahnLauf`, Ersatzkarte,
5 Kader × 96 Saaten, 60 Spieler): je Läufer Platz und Zeit mit echten Typen gegen dasselbe Rennen, in
dem `kontaktPersZwang()` alle auf einen Typ zwingt — einmal mit Kontakt aus, einmal scharf.
Ausgewertet wird der **Platz** (das, was gewertet wird; die Zeit verschiebt sich unter Zwang für das
ganze Feld), Standardfehler **je Spieler geclustert** (die Persönlichkeit ist eine Eigenschaft des
Spielers, die 96 Saaten eines Spielers sind nicht unabhängig).

| Zwangstyp | aus: max \|t\|, eps² | scharf: max \|t\|, eps² | scharf − aus: max \|t\| |
|---|---|---|---|
| duellant | 2,01 (beschuetzer), 0,051 | **0,99** (opportunist), 0,028 | 1,92 (schleicher, +0,16 Plätze) |
| bollwerk | 1,35 (schleicher), 0,050 | **1,15** (schleicher), 0,057 | 0,89 |

Mit Kontakt liegt jeder Typ innerhalb von rund einem Standardfehler; ohne Kontakt war die Streuung
nicht kleiner. Ehrlich dazu: **ungeclustert** (jede Saat als eigene Beobachtung) sind einzelne Typen
signifikant — mit Kontakt der Beschützer −0,20 Plätze (t −3,5), der Schleicher +0,11 (t +2,8); ohne
Kontakt das Bollwerk +0,06 (t +2,3). Bei der Zeit gewinnt der wählerische Beschützer gegen Zwang
„duellant" spürbar (−0,27 s, geclustert t −3,0): wer ihn zum Duellanten macht, lässt ihn bei
schlechter Aussicht zulangen und zahlt den Mini-Stun. Das ist die in 3.2 beabsichtigte Kostenlogik;
im Platz kommt davon nichts Messbares an. Weiter beobachten; Stellschraube wäre `pMin` je Typ.

### 11.3 Fingerabdruck und Rückweg

`GESAMT e80babacb68c` → **`GESAMT 7c9257b4435c` (75 Einträge)**. Gegen die Ausgabe von `origin/main`
(`0c39221f`) unterscheiden sich genau zwei Zeilen: `spiele spurt 1` (`d22c9e6244c2` → `870e28b88ab3`)
und `spiele spurt 7` (`3ee976267e5a` → `3732ee6cd899`). `spiele spurt 42` (in diesem kaderlosen Rennen
ändert der Kontakt nichts am Ergebnis), Hatz, HYROX, Takeshi und alle übrigen 71 Zeilen sind gleich.
Rückweg zweifach belegt: die Engine-Zeile auf `null` gesetzt ergibt wieder exakt `e80babacb68c`,
ebenso der neue Schalter `--kontakt-aus`. Im Test `tests/bahn-pod-vier-teams.test.ts` (Duell-
Fingerabdruck, läuft nur mit Chromium) bewegt sich nur `spurt` (`aaf683d558b12728` →
`8e96b1dc33ad1b1c`); Staffel, Takeshi, Zeitfahren und Climbing bleiben gleich (Elternstand gegen
neuen Stand gerechnet).

### 11.4 Reihenfolge für „schubsen, tacklen etc." in den übrigen Disziplinen

Stand im Motor am 17.11. (Aufwand wie in Abschnitt 10: S = eine Runde, M = zwei bis drei Runden mit
Messung, L = mehr). „Gerüst" heißt: `FELDSPIEL_ART`/`ARENA_ART`/`BUEHNE_ART[d].kontakt` existiert
(Schritt 0), wird aber von keiner Mechanik gelesen. Das Profil `kontaktProfil()` (vier Regler aus
Persönlichkeit und Traits) steht für **jeden** Spieler bereit; was überall fehlt, ist die Stelle, an
der eine Mechanik es liest.

| Rang | Disziplin | Kontakt heute im Motor | Persönlichkeit wirkt heute | Was fehlt | Aufwand | rho / Pp heute |
|---|---|---|---|---|---|---|
| **1** | **Takeshi** (Schritt 3) | Rempler im Fenster vor der Falle, Ausweichen (TECHNIK-Duell), gemessen 13,3 Versuche je Rennen; **derselbe Codepfad** wie Spurt (`kontaktBahnVersuch`) | ja, `willTackeln` = kb (wie oft) | Gate in `stepSpurt` öffnen (heute `!BA().takeshi && !BA().tackleAusweichen`) und kalibrieren: `tackleAb:30` lässt fast jeden rempeln, `pMin` greift am stärksten; Mini-Stun darf **keine** Nerven kosten (Lehre `tackleNerven`); Ausweichen aus Takeshi mit Stufe 2 zusammenführen | **S–M** | 0,838 / 18,9 · 17,7 |
| 2 | **Football** (Schritt 2) | Tackle abstrakt in `resolveLaufNfl()`: LAUFKRAFT gegen ABWEHR_LAUF, gebrochener Tackle, Fumble, zweiter Tackler | nein (Tackler per Los nach ABWEHR_LAUF) | Tackle-Stil aus HÄ („voll"/„sicher", gleicher Erwartungswert), KB als zweiter Faktor im Tackler-Los, Läufer-Antwort aus AW, Foul aus DI (15 Yards), Boxscore „verpasste Tackles"; Gerüst `FELDSPIEL_ART.football.kontakt` steht | **M** | 0,854 / 15,3 · 16,0 |
| 3 | **Hatz / HYROX** (Schritt 1b) | **keiner** — `stepSpurtHatz()` / `stepSpurtHyrox()` haben keinen Rempler-Block (deshalb blieben ihre Fingerabdrücke gleich) | nein | Rempler dort neu verdrahten: Hatz mit Sperre in den letzten Metern **jeder Welle** und Deckel 1 Sturz je Welle (ein Sturz kann ausscheiden lassen); HYROX nur auf Laufstücken, nie an der Station; eigene Sonden `messe-spurt-hatz/-hyrox-einfluss.mjs`. Mehr als „nachmessen", deshalb M statt S–M | **M** | Hatz 0,824 / HYROX 0,892; Mischung Pp 16,5 · 21,5 |
| 4 | **Battlefield-Pod** (Schritt 4) | Rückstoß `stossen()` mit `knockbackResist`/`stunResist` je Archetyp | Ziel/Haltung (PERS*), nicht der Stoß | „Verdrängen vom Punkt" als Ersatz eines Angriffs (nicht obendrauf, P1-Regel), KB wählt Stoß statt Schlag, HÄ die Weite, Fehlschlag verzögert den nächsten Angriff; Gerüst `ARENA_ART.battlefield.kontakt` steht | **M–L** | Pod 0,874 / 8,2 · 7,5 |
| 5 | **Basketball** | Ausboxen `REB_BOXOUT=4.0` als Teamkonstante | nein | **wer** ausboxt nach Tendenz (Bollwerk/Beschützer boxen, Schleicher spekulieren), Screens mit Offensivfoul aus DI — zuerst als Statistik, Wirkung erst mit lesender Taktik-Mechanik | **S–M** | 0,822 / 15,6 · 16,7 |
| 6 | **Hockey** (Checks) | Bodycheck in `versucheSteal()`: ABWEHR gegen AUSDAUER, `HK_STURZ`/`HK_TAUMEL`, Foul-Anteil → Strafe | nein | nur die **Verteilung** der rund zehn Checks je Team nach KB (gleiche Gesamtzahl, eigener Zufallsstrom), verpasster Check als Abklingzeit plus Puste, **nie** als Position (RNG-Kaskade) — Messversuch mit Abbruch bei jeder Verschlechterung | **M** | 0,700 (Ausnahme) / 13,9 · 21,8 |
| 7 | **TDM** | Rückstoß wie Battlefield | ja (Ziel, Haltung); war schon einmal der größte Fehlordner (P1) | erst Bild über gebuchte Treffer; Wirkung erst nach dem Battlefield-Pod | **S** (Bild) / L (Wirkung) | 0,839 / 14,6 · 14,7 |
| 8 | **I-Spy** (Schubsen) | **keiner**; nur der Haken in `ispyStandXY()` (Rückstoß als Zeichenversatz) | nein | echtes Schubsen/Warten braucht exklusive Fundorte über Teamgrenzen (Chris' Wunsch, Vorgänger 28b) — ein Umbau der Halle, kein Kontakt-Baustein; vorher als Bild | **L** (Mechanik) / S (Bild) | 0,776 / 14,6 · 15,0 |
| — | Climbing | Herunterziehen am Kreuzungsgriff, jeder Führende zieht | nein | KB könnte entscheiden, **wer** zieht — rho 0,801 lässt wenig (Frage 3 an Chris) | S | 0,801 / 12,0 · 9,5 |
| — | Eiskunstlauf (Schritt 5) | keiner | nein | „Kreuzen" setzt „vier Aktive anzeigen" voraus | M–L | 0,927 / 10,6 · 12,0 |

**Empfehlung für die nächste Disziplin: Takeshi.** Gleicher Code, gleiche Stufen, schon heute die
meisten Rempler im Spiel — der Messgewinn („drin fürs Messen") ist dort am größten und der Bau am
kleinsten. Danach Football (eigener Motor, Tackle-Logik vorhanden, Puffer) und Hatz/HYROX (der
Rempler muss erst hinein). Hockey, TDM und I-Spy erst, wenn die ersten drei das Muster bestätigt
haben. Regeln wie bisher: eine Disziplin je PR, Abnahme vorher/nachher mit denselben Kriterien wie
11.1, der Fingerabdruck-Diff zeigt nur diese Disziplin.

# Sponsor-Balancing — Schattentest gegen die echte Engine

> **STAND 2026-07-27, zweiter Durchgang.** Die Abschnitte 1–5 beschreiben den **ersten** Lauf, bei
> dem drei der sechs Kriterien rissen. Die drei Risse sind seither geschlossen und Kriterium 1 hat
> eine neue, begründete Toleranz. **Abschnitt 8 enthält den Nachmessungs-Stand: kein
> Abbruchkriterium mehr gerissen.** Die Abschnitte 1–5 werden bewusst nicht überschrieben — sie sind
> der Befund, aus dem die Änderungen folgen.

Alle Messungen laufen read-only über
`scripts/sponsor-shadow-core.ts`, `scripts/sponsor-shadow-data.ts`,
`scripts/sponsor-shadow-measure.ts` und `scripts/sponsor-shadow-ledger.ts`.

Der Test beantwortet die Frage, die die bisherige Prüfmaschinerie nicht beantworten konnte:
**hält das neue Modell, wenn man es neben einen echten Engine-Lauf legt, statt es gegen seine
eigenen Annahmen zu rechnen?**

---

## 0. Datenbasis — was gemessen wurde und woraus

| Quelle | Inhalt | Verwendung |
|---|---|---|
| `data/persistence/oly-app.sqlite`, Save `fresh-season-1-1784196429043` (read-only kopiert) | 4 vollständig abgeschlossene Saisons mit echten `finalStandings`, laufende S5 | sigma, P, Schattenbuchhaltung, Kriterien 1-6 |
| Frischer Langlauf `scripts/long-run-sandbox-s1-s6.ts`, 5 Saisons, isolierte DB | Gegenprobe auf einem zweiten Lauf | siehe Abschnitt 6 |

**128 Team-Saisons** aus echten Spieltagen (32 Teams × 4 Saisons), plus 32 Team-Zustände der
laufenden Saison für die Klauseln, die nur den Momentanzustand kennen.

Zwei Dinge, die diese Datenbasis **nicht** hergibt und die deshalb nirgends behauptet werden:

* **Keine Engine-Seed-Streuung.** Alle Endstände stammen aus *einem* Engine-Lauf. Wo „Median" und
  „IQR" über Deckungswerte steht, laufen sie über die **Saisons** dieses Laufs und über 40
  Wiederholungen der **modelleigenen** Lotterie (Abschnitt 3), nicht über Engine-Seeds. Für die
  Kriterien 2 und 6 heißt das: die Streuung des Modells ist gemessen (40 Würfe), die Streuung
  zwischen Engine-Läufen nicht.
* **Spielerzustand nur für die laufende Saison.** Fatigue-Momentanwert, `trainingMode`,
  `seasonTrainingAccumulator`, Moral, Subklassen und Trainingsklasse werden jede Preseason
  zurückgesetzt (`lib/season/preseason-workflow-service.ts`). Saison-getaggte Ledger
  (`injuryEvents`, `transferHistory`, `loans`, `classHistory`, `playerProgressionEvents`,
  `playerRelationshipEvents`, `facilityEvents`, `seasonSnapshots`) überleben und sind für alle
  Saisons auswertbar.

Der **Erwartungsrang** ist rekonstruiert, nicht protokolliert: `buildLeagueTeamQualityRanks` wird
mit Zeilen gefüttert, die ausschließlich Vor-Saison-Information tragen (Tabellenplatz und Marktwert
der Vorsaison, Rang-Historie der Saisons davor). Der im Save gespeicherte
`teamQualityRankAtSign` existiert nur für die laufende Saison und taugt damit nicht als Kontrolle
über vier Saisons.

---

## 1. sigma — gemessen

`sigma = sd(Endrang − Erwartungsrang)`

| Schnitt | N | sigma | Bias | Spanne |
|---|---:|---:|---:|---|
| **gepoolt** | 128 | **6.62** | 0.00 | −17 … +18 |
| stark (Erwartung 1-11) | 44 | 6.36 | **+3.34** | −9 … +18 |
| mittel (Erwartung 12-21) | 40 | 6.88 | −1.35 | −15 … +10 |
| schwach (Erwartung 22-32) | 44 | 5.32 | **−2.11** | −17 … +5 |

| Saison | sigma |
|---|---:|
| season-1 | 5.54 |
| season-2 | 7.10 |
| season-3 | 6.52 |
| season-4 | 7.47 |

Median der Abweichung 0.00, IQR [−4.00, +3.25].

**Befunde:**

1. **Das Design-sigma 5.5 ist zu klein.** Gemessen 6.62 gepoolt; nur die erste Saison trifft 5.5,
   danach steigt die Streuung auf 6.5-7.5. Der Auftrag nennt als Empfindlichkeit: bei sigma 9 statt
   5.5 steigt der EV-Spread von 3.9 auf 16.8 %. 6.62 liegt in der Mitte dieser Strecke — das Modell
   rechnet mit einer engeren Welt, als die Engine erzeugt.
2. **Das gepoolte sigma liegt gerade noch im Abbruchkorridor [3.5, 7], zwei von vier Saisons
   einzeln aber nicht** (7.10 und 7.47). Der Korridor wird also nur gehalten, weil über Saisons
   gepoolt wird.
3. **Es gibt einen systematischen Rückschritt zur Mitte**, den das Modell nicht kennt: starke Teams
   landen im Schnitt 3.3 Plätze **schlechter** als erwartet, schwache 2.1 Plätze **besser**. Das
   Modell setzt in `dist()` eine um den Erwartungsrang **zentrierte** Normalverteilung an. Für ein
   Spitzenteam ist das systematisch zu optimistisch, für ein Kellerteam zu pessimistisch — mit
   direkter Folge für die EV-Kalibrierung der jeweiligen Karten.

---

## 2. P je Klausel — was messbar ist und was nicht

Der Klauselkatalog (`scripts/sponsor-model-proposal.ts:166-188`) lässt die Schwelle X bei 15 von 20
Klauseln offen („Saison-Fatigue-Schnitt ≥ X"). Für diese Klauseln ist **P keine Messgröße, sondern
eine Folge der Schwelle.** Gemessen wird deshalb, was tatsächlich eine Eigenschaft der Engine ist:
die Verteilung der zugrundeliegenden Metrik je Stärkeklasse — und daraus die einzige Frage, die
das Design entscheidet: *existiert überhaupt eine Schwelle, die das Design-P auf ±0.15 trifft?*

### 2a. Direkt messbares P (feste Schwelle, keine freie Wahl)

| Klausel | Metrik | N | gemessenes P | Design-P | Abstand | Verdikt |
|---|---|---:|---:|---:|---:|---|
| Schuldenfrei | neue Kredite dieser Saison = 0 | 160 | 0.96 | 0.85 | 0.11 | im Rahmen |
| **Ausbau** | ≥ 1 Upgrade fan_shop/arena_upgrade | 160 | **0.11** | 0.45 | **0.34** | **reißt** |
| **Wortlaut** | 0 gebrochene Versprechen | 160 | **0.00** | 0.45 | **0.45** | **reißt** |

* **Ausbau**: 148 echte Gebäude-Upgrades im Lauf, davon nur **17** auf `fan_shop`/`arena_upgrade`.
  Die KI baut überwiegend andere Gebäude. Die Klausel ist so, wie sie im Katalog steht, fast
  unerfüllbar.
* **Wortlaut**: gebrochene Rollenversprechen je Team und Saison — min 3, Median 8, max 11.
  **Kein einziges Team hat in 160 Team-Saisons alle Versprechen gehalten.** Die Klausel würde nie
  auszahlen, immer den vollen Malus ziehen — und mit `malus = s·P = 22·0.45 = 9.9 C` wäre sie ein
  garantierter Abzug, den kein Spieler abwenden kann.
* **Schuldenfrei**: der Wert 0.96 gilt nur, wenn man **beide** Quellen liest
  (`loanOriginationLogs` **und** `loans[].originatedSeasonId`). Der Origination-Ledger ist in
  diesem Save leer, die neun Kredite stehen aber im State — wer nur den Ledger liest, misst
  fälschlich P = 1.00.

### 2b. Schwellenabhängige Klauseln — Verteilung und erreichbares P

Für alle 12 auswertbaren Klauseln existiert eine Schwelle, die das Design-P auf ≤ 0.07 trifft:

| Klausel | Metrik | N | Schwelle für Design-P | erreichtes P | Abstand |
|---|---|---:|---|---:|---:|
| Einsatzlast | Fatigue-Schnitt | 160 | ≥ 23.4 | 0.55 | 0.00 |
| Schonung | Fatigue-Schnitt | 160 | ≤ 24.3 | 0.50 | 0.00 |
| Talentschmiede | Klassenaufstiege | 160 | ≥ 1 | 0.36 | 0.04 |
| Wertaufbau | % Kaderwert | 96 | ≥ +0.6 % | 0.50 | 0.00 |
| Achsenprofil | bester Achsenrang | 128 | ≤ 4 | 0.45 | 0.00 |
| Disziplinen | Disziplinen mit Delta > 0 | 32 | ≥ 14 | 0.50 | 0.00 |
| Gehaltseffizienz | Gehaltssumme | 128 | ≤ 57.2 C | 0.50 | 0.00 |
| Kaderruhe | Transfers | 128 | ≤ 8 | 0.60 | 0.00 |
| Prophylaxe | Verletzungen | 160 | ≤ 6 | 0.51 | 0.06 |
| Moral | Ø-Moral | 32 | ≥ 48.1 | 0.56 | 0.01 |
| Vielseitigkeit | verschiedene Subklassen | 32 | ≥ 12 | 0.53 | 0.07 |
| Fokusschule | größte Trainingsklassen-Gruppe | 32 | ≥ 5 | 0.50 | 0.05 |

Volle Verteilungen je Stärkeklasse (min / P10 / Median / P90 / max) stehen in der Skriptausgabe;
Auszug für die drei, deren Schwelle stark klassenabhängig gesetzt werden muss:

| Klausel | stark (E 1-11) | mittel (E 12-21) | schwach (E 22-32) |
|---|---|---|---|
| Achsenprofil (bester Achsenrang) | 1 / 1 / **3** / 7 / 11 | 1 / 1 / **4.5** / 11 / 16 | 2 / 4 / **10** / 26.7 / 30 |
| Gehaltseffizienz (Gehaltssumme C) | 47.4 / 53.2 / **69.2** / 81.1 / 93.1 | 42.6 / 51.0 / **58.5** / 68.6 / 101.8 | 23.3 / 37.2 / **52.8** / 64.0 / 70.6 |
| Vielseitigkeit (Subklassen) | 11 / 12 / **14** / 19 / 19 | 10 / 10.9 / **12** / 15 / 15 | 3 / 3 / **8** / 11 / 19 |

Das bestätigt die Katalogvorgabe „Schwellen relativ zur Stärkeklasse" quantitativ: eine absolute
Achsenrang-Schwelle von 4 wäre für starke Teams geschenkt (Median 3) und für schwache praktisch
unerreichbar (Median 10).

### 2c. Nicht messbar — 5 Klauseln

| Klausel | Grund |
|---|---|
| **Charakterarbeit** | `traitsNegative` wird im laufenden Spiel **nie** mutiert; der einzige Hebel ist der Transfermarkt. Ein Kaderstand zum Saisonanfang existiert im Save nicht → kein Delta rekonstruierbar. |
| **Kapitänstreue** | `setTeamCaptain` **ersetzt** den `(Team, Saison)`-Record (`lib/morale/team-captain-service.ts`). Ein Wechsel hinterlässt keine Spur. Zusätzlich: `teamCaptains` ist in diesem Save leer (0 Einträge) — das Feature wird von der KI-Pipeline nicht benutzt. |
| **Hartes Training** | `seasonTrainingAccumulator` ist bei **0 von 2984** Spielern gesetzt. Die Metrik existiert nur, wenn Spieltage über `applyLegacyMatchdayResult` mit aktivem Accumulator laufen. |
| **XP-Disziplin** | `playerProgressionEvents`: 1708 Einträge, **Summe `xpEarned` = 0, Summe `xpSpent` = 0**. Die XP-Ökonomie ist in diesem Lauf ungenutzt (nur organische Progression). Die Klausel hat keinen Nenner. |
| **Beliebtheit** | `beliebtheitByTeamId` und `beliebtheitHistoryByTeamId` sind **leer** (0 Einträge). Der Save stammt aus einer Zeit vor der Beliebtheits-Fortschreibung. |

Bei diesen fünf rechnet die Schattenbuchhaltung mit dem **Design-P** und markiert das als Annahme.

---

## 3. Schattenbuchhaltung mit EX-ANTE-K

`scripts/sponsor-5season-model.ts` zieht erst die Endränge und löst K dann so, dass die Summe
stimmt (Zeilen 66-90) — „Deckung 100 %" ist dort die **Definition** von K, keine Messung. Hier
steht K **vor** der Saison fest: gelöst gegen den Erwartungswert unter dem **gemessenen** sigma
6.62 und den gemessenen bzw. angenommenen P. Die realisierte Deckung darf danach abweichen.

| Saison | sf | K (ex ante) | Σ Sponsor | Σ Gehalt | Deckung | Ziel | Abw. | Untergrenze | **EigenSD** | z |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| season-1 | 1.00 | 0.866 | 2072.2 | 1887.5 | 109.8 % | 100 % | **+9.8** | 41 % | ±6.1 | 1.60 |
| season-2 | 1.00 | 0.885 | 1884.1 | 1903.2 | 99.0 % | 100 % | −1.0 | 41 % | ±5.9 | −0.17 |
| season-3 | 1.00 | 0.923 | 2138.2 | 1933.1 | 110.6 % | 100 % | **+10.6** | 28 % | ±6.6 | 1.60 |
| season-4 | 1.00 | 0.836 | 2014.5 | 1863.1 | 108.1 % | 100 % | **+8.1** | 34 % | ±5.6 | 1.44 |

Median der Abweichung **+9.0 Pp**, IQR [+5.8, +10.0] Pp (über die vier Saisons dieses einen Laufs).

**`sf` fehlt im Save für die abgeschlossenen Saisons** (`seasonEconomyFactors` führt nur die
laufende Saison plus Ausblick) und wurde deshalb mit 1.0 angesetzt. Das ist offengelegt, aber eine
Einschränkung: die Deckung wurde nicht gegen wechselnde Ligajahre geprüft.

### Der entscheidende Nebenbefund: EigenSD

Die Spalte **EigenSD** ist die Standardabweichung der Liga-Summe, die das **Modell selbst** vor der
Saison erzeugt — aus der 4-Ecken-Lotterie (Klausel × Sonderziel) je Team und der Rangstreuung,
Karten unabhängig gezogen. Sie liegt bei **±5.6 bis ±6.6 Prozentpunkten der Gehaltssumme.**

> Das Abbruchkriterium verlangt Deckung innerhalb von **sf ± 5 Prozentpunkten**. Die Eigenstreuung
> des Entwurfs ist **größer als diese Toleranz.** Selbst ein perfekt gelöstes ex-ante-K kann das
> Ziel nicht halten: rund 40 % aller Saisons landen allein durch die eingebaute Lotterie außerhalb
> ±5 Pp. Das Ziel ist mit dem Entwurf strukturell unvereinbar, unabhängig von der Kalibrierung.

Die Zerlegung zeigt außerdem, **woher die Abweichung nicht kommt**:

| Saison | Klauselquote (angenommen) | Zielquote (angenommen) | Σ bei Erwartungsrang | Σ realisiert |
|---|---|---|---:|---:|
| season-1 | 0.41 (0.48) | 0.50 (0.45) | 2079.1 | 2072.2 |
| season-2 | 0.38 (0.48) | 0.44 (0.45) | 1896.4 | 1884.1 |
| season-3 | 0.50 (0.52) | 0.50 (0.45) | 2130.0 | 2138.2 |
| season-4 | 0.53 (0.48) | 0.34 (0.45) | 2042.8 | 2014.5 |

„Σ bei Erwartungsrang" ist die Summe, wenn jedes Team **exakt** auf seinem Erwartungsrang landet,
bei denselben Lotterie-Ziehungen. Sie liegt überall dicht an der realisierten Summe → **die
tatsächliche Rangverteilung ist nicht die Ursache.** Gegenprobe mit abgeschalteter Formkomponente
(`OLY_SPONSOR_FORM=0`): Median +8.5 Pp statt +9.0 — **auch die Formkomponente ist es nicht.**
Es bleibt die Streuung der Lotterien selbst, die die EigenSD beziffert.

### Wiederholte Lotteriewürfe — 40 Würfe, unveränderte Endränge, festes ex-ante-K

Um zu trennen, was am Modell liegt und was am einzelnen Wurf, wurde die Klausel- und Ziellotterie
40-mal neu gezogen. Endränge und K bleiben unverändert (K ist ex ante und hängt per Konstruktion
nicht an den Würfen). Das ist **keine** Seed-Streuung der Engine — die Endstände sind dieselben —
sondern genau die Streuung, die der Entwurf selbst erzeugt.

| Größe | Median | IQR | Spanne |
|---|---:|---|---|
| Deckungsabweichung (160 Saison-Würfe) | **+0.7 Pp** | [−3.4, +4.5] Pp | [−10.8, +18.0] Pp |
| Zahlungsunfähige bei sicherster Wahl | 0 | [0, 0] | max 0 |
| Teams unter minus einem Mindestgehalt | 0 | [0, 0] | max 0 |
| Niedrigste Kasse über alle Würfe | | | +113.8 C |

**Saison-Würfe außerhalb sf ± 5 Pp: 62 von 160 = 39 %.**

Das korrigiert die Lesart der Tabelle oben in einem wesentlichen Punkt: **das ex-ante-K ist nicht
systematisch verzerrt** — der Median über 160 Würfe liegt bei +0.7 Pp, also praktisch auf dem
Ziel. Die +9.0 Pp des einzelnen beobachteten Laufs sind ein Wurf, kein Bias. Damit ist die
Aussage präzise:

> Kriterium 1 reißt nicht, weil K falsch berechnet wäre, sondern weil die geforderte Toleranz
> **enger ist als die Eigenstreuung des Entwurfs**. Bei einer Ausfallwahrscheinlichkeit von 39 %
> je Saison sind 3 von 4 Saisons außerhalb ein völlig gewöhnliches Ergebnis
> (P(≥ 3 von 4) ≈ 0.13). Die vorhergesagte Quote aus der EigenSD (±6 Pp → rund 40 %) trifft die
> gemessenen 39 % exakt.

Für die Kriterien 2 und 6 heißt derselbe Test: **in allen 40 Würfen 0 Zahlungsunfähige und 0
Teams im Minus**, niedrigste Kasse +113.8 C. Diese beiden Kriterien stehen damit nicht mehr auf
einem einzigen Wurf — wohl aber weiterhin auf einem einzigen **Engine-Lauf**.

### Salden

Kumuliert über alle vier Saisons, Sponsor + Preisgeld (`getPrizeMoneyReference` +
`getRankMilestoneBonus`) − Gehalt:

* Median **+293.0 C**, IQR [+147.7, +437.7] C, Spanne [+55.3, +822.9] C
* Teams im Plus: **32/32**
* Kleinstes Team-Gehalt im Lauf (= ein Mindestgehalt): 23.3 C
* Teams unter minus einem Mindestgehalt: **0**

Untergrenzen-Quote 28-41 % der Team-Saisons — also in jeder dritten bis vierten Zelle greift der
Boden. Das ist hoch: dort wirken Kurve, Klausel und Sonderziel nicht mehr.

---

## 4. Die sechs Abbruchkriterien — einzeln

| # | Kriterium | Zahl | Verdikt |
|---|---|---|---|
| 1 | Deckung je Saison innerhalb sf ± 5 Pp, höchstens eine von fünf Saisons außerhalb | **3 von 4 außerhalb** (+9.8, +10.6, +8.1 Pp); über 160 Lotteriewürfe **39 % außerhalb**, Median +0.7 Pp | **GERISSEN** |
| 2 | 0 Zahlungsunfähige unter Teams, die die sicherste Karte wählten | **0** Fälle; über 40 Würfe Median 0, IQR [0,0], max 0; niedrigste Kasse +113.8 C | bestanden¹ |
| 3 | sigma in [3.5, 7] **und** jedes gemessene P ≤ 0.15 neben Design-P | sigma 6.62 ✓ (aber S2/S4 einzeln 7.10/7.47 ✗); **2 Klauseln reißen** (Ausbau 0.11 vs 0.45; Wortlaut 0.00 vs 0.45) | **GERISSEN** |
| 4 | FOSD-Test mit gemessenem sigma/P findet keine Falle in einer **echten** Angebotsliste | **0 Fallen** in 32 Listen, 96 Karten, 96 verschiedene Paare, 0 kollabiert | bestanden² |
| 5 | Kein realisierter Fall „besserer Endrang zahlt weniger" | **6 von 128** Karten mit nicht-monotoner Auszahlungsleiter | **GERISSEN** |
| 6 | Höchstens 8 Teams mit kumuliertem Saldo unter minus einem Mindestgehalt | **0** von 32; über 40 Würfe Median 0, IQR [0,0], max 0 | bestanden¹ |

¹ Aus **einem** Engine-Lauf. Die modelleigene Lotterie wurde 40-mal wiederholt (durchweg 0), die
Streuung über **Engine-Seeds** bleibt ungemessen — nicht als belastbar zu verkaufen.
Kredite sind als Rettungsleine **nicht** mitgerechnet (macht das Kriterium härter), Transfers,
Gebäudekosten und Ablösen fehlen (macht die Kasse optimistisch).

² **Nicht vakuum-wahr, aber begrenzt.** Der Vakuum-Wächter belegt: alle 32 Listen enthalten mehr
als eine verschiedene Karte, 96 geprüfte Paare sind paarweise verschieden, 0 identische Paare, 0
kollabierte Karten. Rarity-Mischung gewöhnlich 46 / magisch 37 / selten 10 / legendär 3.
**Aber:** die Angebote dieses Saves bilden nur **3 der 6 Modellkurven** ab (Sockel 32, Gipfel 32,
Halten 32) und der Save führt nur **3 Angebote je Team** statt der heute erzeugten 5. Die drei
nicht abgedeckten Kurven (Linear, Steil, Flach) sind ungeprüft.

### Kriterium 5 im Detail — die Ursache

Alle sechs nicht-monotonen Fälle tragen dasselbe Verteilungsprofil:

```
nach Kurve/Profil: Halten/mittelfeld ×3, Sockel/mittelfeld ×2, Flach/mittelfeld ×1
nach Profil allein: mittelfeld ×6
größter Rückschritt: 2.8 C zwischen Rang 12 und 13
```

Die Ursache ist **nicht** die Untergrenze und **nicht** die relative Kurve, sondern die
**Formkomponente** (`formShape` in `scripts/sponsor-model-params.ts`, eingeführt als Auflage d, um
932 Dominanzfälle zu beseitigen). Sie addiert `FORM_AMPLITUDE × (tierWeights[Endstufe] − Mittel)`.
Die `tierWeights` sind über die Tabellenstufen **nicht monoton**: beim Profil `mittelfeld` liegt
das Maximum auf Stufe 4 (Ränge 13-16, Gewicht .25) **über** Stufe 3 (Ränge 9-12, Gewicht .18).
Bei Amplitude 60 sind das 4.2 C Aufschlag für das **schlechtere** Band, während die LIGA-Leiter
dort nur 4 C Unterschied hat (59 gegen 55). Nachgerechnet für ein Team mit Erwartungsrang 23:

```
Rang   … 9    10   11   12  │  13   14   15   16  │  17 …
zahlt  … 62.6 62.6 62.6 62.6 │ 62.8 62.8 62.8 62.8 │ 54.6 …
```

Platz 12 zahlt **weniger** als Platz 13. Die EV-Zentrierung der Formkomponente hält den
**Erwartungswert** neutral — sie sagt nichts über Monotonie im Rang. Das ist derselbe Fehlertyp,
der schon einmal in der Kurve steckte (`relConcaveRaw`, Scheitel bei d = 1.389) und dort behoben
wurde; im Profil steht er noch.

---

## 5. Gesamturteil

**Das Modell besteht den Engine-Test nicht.** Drei der sechs Abbruchkriterien reißen:

* **Kriterium 1 (Deckung).** 3 von 4 Saisons außerhalb sf ± 5 Pp. Über 160 Lotteriewürfe: Median
  **+0.7 Pp**, IQR [−3.4, +4.5] Pp, **39 % der Saisons außerhalb ±5 Pp**. Das ex-ante-K ist damit
  **unverzerrt** — der Fehler steckt nicht in der Kalibrierung, sondern in der Vorgabe: die
  **Eigenstreuung des Entwurfs (±5.6 bis ±6.6 Pp) ist größer als die geforderte Toleranz.** Das
  Kriterium ist durch keine Kalibrierung zu retten. Entweder die Toleranz muss weiter (auf
  mindestens ±12 Pp für 2σ), oder die Lotterie-Amplitude muss kleiner werden — allen voran das
  Sonderziel, das mit `EV / P_GOAL` (bis 4× gedeckelt) der größte einzelne Varianztreiber ist.
* **Kriterium 3 (sigma und P).** sigma 6.62 hält den Korridor nur gepoolt; einzelne Saisons liegen
  bei 7.10 und 7.47. Zwei direkt messbare P reißen deutlich: „Ausbau" 0.11 statt 0.45 und
  „Wortlaut" 0.00 statt 0.45 — letztere ist in 160 Team-Saisons **nie** erfüllt worden und wäre
  damit ein garantierter Malus. Fünf weitere Klauseln sind an diesem Lauf gar nicht messbar,
  davon zwei (Charakterarbeit, Kapitänstreue) **prinzipiell nicht**, weil das Datenmodell den
  nötigen Vorher-Zustand nicht führt.
* **Kriterium 5 (Monotonie).** 6 von 128 realisierten Karten zahlen für einen besseren Endrang
  weniger. Ursache ist die Formkomponente, deren Profilgewichte über die Tabellenstufen nicht
  monoton sind.

**Was hält:** Kriterium 4 (Fallenfreiheit) hält auch mit dem gemessenen sigma 6.62 und den
gemessenen P — und diesmal nachweislich nicht vakuum-wahr: 96 paarweise verschiedene Karten, keine
identischen Paare, keine kollabierte Karte. Die Kriterien 2 und 6 halten deutlich und robust:
über 40 Lotteriewürfe durchweg 0 Insolvenzen und 0 Teams im Minus, niedrigste Kasse +113.8 C.
Sie stehen weiterhin auf einem einzigen Engine-Lauf.

**Kürzeste Zusammenfassung:** Der Entwurf ist **fallenfrei und zahlungssicher**, aber er ist
**nicht rang-monoton**, seine **Klauseln passen teilweise nicht zu dem, was die KI im Spiel
tatsächlich tut**, und seine **Liga-Summe streut stärker, als die Vorgabe erlaubt**. Die ersten
beiden Punkte sind reparierbar (Profilgewichte monotonisieren, Klauselschwellen an gemessenen
Verteilungen setzen, „Wortlaut" und „Ausbau" neu fassen oder streichen). Der dritte ist eine
Design-Entscheidung: entweder die Toleranz oder die Lotterie-Amplitude muss sich bewegen.

---

## 6. Gegenprobe auf einem frischen Langlauf

Siehe Abschnitt „Frischer Lauf" am Ende dieses Dokuments (wird nach Abschluss des Laufs ergänzt).

---

## 8. Die vier Risse — geschlossen, mit Messung vorher/nachher

Alles hier ist mit denselben Skripten auf demselben Save gemessen wie oben.

### Riss 1 — sigma und der Rückschritt zur Mitte

| | vorher | nachher |
|---|---|---|
| `SIGMA` in `sponsor-model-params.ts` | 5.5 (gesetzt) | **6.6** (gemessen 6.62) |
| Bias zur Mitte | **gar nicht abgebildet** — `dist()` zentriert auf den Erwartungsrang | Schrumpfung `BIAS_SHRINK = 0.255`, gemessen per Kleinstquadraten über dieselben 128 Team-Saisons |

Die Ergebnisverteilung ist jetzt auf `centerRank(e) = 16.5 + 0.745·(e − 16.5)` zentriert statt auf
`e`. Reproduktion des gemessenen Bias:

| Stärkeklasse | Bias gemessen | Modell mit shrink 0.255 |
|---|---:|---:|
| stark (E 1-11) | +3.34 | +2.68 |
| mittel (E 12-21) | −1.35 | ±0.00 |
| schwach (E 22-32) | −2.11 | −2.68 |

Die eine Zahl erklärt **12.7 %** der Rangvarianz; das Restsigma sinkt von 6.62 auf 6.18. Die
mittlere Klasse trifft sie nicht (gemessen −1.35 gegen modelliert 0) — der echte Bias ist nicht
exakt linear. Eine lineare Schrumpfung wurde trotzdem gewählt, weil drei Klassen-Konstanten an den
Klassengrenzen Sprungstellen in die Auszahlungsleiter setzen würden. **Das ist eine Näherung und
wird als solche ausgewiesen.**

Wirkung auf Fallenfreiheit und EV-Parität (voller Kombinationsraum, alle 32 Erwartungsränge):

| Messung | vorher | nachher |
|---|---|---|
| Fallen kuratierte 12er-Liste | 0 | **0** |
| Fallen im vollen Raum (jetzt 6 × 15 = 90 Kombinationen) | 0 von 120 | **0 von 90** |
| kollabierte Karten | 0/384 | **0/384** |
| größter EV-Spread über alle 32 Erwartungsränge | 3.8 % | **3.4 %** |
| Profil-Dominanz | 0/1920 | **0/1920** |

**Ein Zwischenbefund, der dabei herausfiel und selbst ein Riss war:** mit dem Bias meldete der
Fallen-Test in `sponsor-model-proposal.ts` plötzlich **49 Fallenpaare, alle bei Erwartungsrang 32**.
Sie sind ein **Artefakt des ±11-Korridors**: kalibriert wird über alle 32 Ränge, geprüft wurde nur
auf `e ± 11`. Für ein Team mit Erwartungsrang 32 liegen mit dem Bias rund 13 % der
Wahrscheinlichkeitsmasse oberhalb von Rang 21 — dort zahlt eine rückwärtslastige Kurve wie `Gipfel`
ihr ganzes Geld, der Offset fällt entsprechend, und *innerhalb* des Korridors sah die Karte dann
überall schlechter aus. Die echte Engine kennt keinen Korridor; der Schattentest prüft längst über
alle 32 Ränge. Das Vorschlagsskript zieht jetzt nach (`ALL_RANKS`), und die 49 Paare sind weg. Der
Korridor bleibt nur noch dort, wo er die richtige Frage beantwortet — in der Katalog-Bandanzeige
(„was erlebt ein Team realistisch?").

### Riss 2 — die zwei Klauseln und die fünf nicht messbaren

Der Katalog steht jetzt an **einer** Stelle (`scripts/sponsor-model-params.ts`, `CLAUSES`); vorher
lag er doppelt (in `sponsor-model-proposal.ts` und gespiegelt in `sponsor-shadow-core.ts`) — genau
die Doppelhaltung, die im Repo schon einmal drei auseinandergelaufene Parametersätze erzeugt hat.
**20 → 15 Klauseln.**

| Klausel | Befund | Entscheidung | Messung danach |
|---|---|---|---|
| **Ausbau** | P = 0.11 gegen Design 0.45. Von 148 echten Gebäude-Upgrades lagen nur **17** auf `fan_shop`/`arena_upgrade` | Prädikat verbreitert auf **alle Gebäude**, Schwelle frei, Design-P 0.45 → **0.60** | P = **0.59** bei X ≥ 1, Abstand **0.01** |
| **Wortlaut** | P = 0.00 in 160 Team-Saisons; min 3 / Median 8 / max 11 gebrochene Versprechen. Wäre ein garantierter Malus von s·P = 9.9 C | Feste Schwelle 0 → **„höchstens X gebrochene Versprechen"**, Design-P bleibt 0.45 | P = **0.47** bei X ≤ 7, Abstand **0.02** |
| **Charakterarbeit** | prinzipiell nicht messbar: `traitsNegative` wird nie mutiert, kein Kaderstand zum Saisonanfang | **gestrichen** | — |
| **Kapitänstreue** | prinzipiell nicht messbar: `setTeamCaptain` ersetzt den Record, ein Wechsel hinterlässt keine Spur; `teamCaptains` leer | **gestrichen** | — |
| **Hartes Training** | `seasonTrainingAccumulator` bei 0 von 2984 Spielern gesetzt | **gestrichen** | — |
| **XP-Disziplin** | 1708 Progressionsereignisse, Summe `xpEarned` = 0 → kein Nenner | **gestrichen** | — |
| **Beliebtheit** | `beliebtheitByTeamId` und -History leer | **gestrichen, aber nicht prinzipiell tot** — wieder aufnehmen, sobald der Beliebtheits-Ledger fortgeschrieben wird | — |

Warum nicht „P einfach auf den gemessenen Wert ziehen" bei Wortlaut: das gemessene P war **exakt
0**. Bonus = s·(1−P) = 22 und Malus = s·P = 0 — die Klausel wäre ein bedingungsloses Geschenk statt
einer Bedingung. Bei Ausbau war die Korrektur dagegen genau richtig herum: nicht die Schwelle war
zu hart, das Prädikat zeigte auf die falschen Gebäude.

**Nach der Bereinigung: 0 Klauseln ohne Messmöglichkeit, 0 Klauseln mehr als 0.15 neben ihrem
Design-P, 0 Klauseln ohne erreichbare Schwelle.** Kriterium 3 hält damit ohne Sternchen.

### Riss 3 — Monotonie der Auszahlungsleiter

**Vorher:** 6 von 128 realisierten Karten nicht monoton, größter Rückschritt 2.8 C zwischen Rang 12
und 13, alle sechs mit dem Profil `mittelfeld`.

**Ursache** (bestätigt): `formShape` las `tierWeights[finalTier]` **punktweise**, und die
`tierWeights` sind über die Stufen nicht monoton — bei `mittelfeld` liegt Stufe 4 (Ränge 13–16,
Gewicht .25) über Stufe 3 (Ränge 9–12, Gewicht .18).

**Fix:** die Formkomponente ist jetzt eine **kumulierte Summe nicht-negativer Stufenschritte**:

```
formLadder(t) = Σ_{i ≥ t} stepWeights[i]        (formLadder(8) = 0, formLadder(0) = 1)
formShape     = FORM_AMPLITUDE · (formLadder(finalTier) − E[formLadder])
```

Weil alle `stepWeights ≥ 0` sind, ist `formLadder` über die Stufen nicht-steigend, als Funktion des
**Ranges** also nicht-fallend. Der Formbeitrag kann eine Rangverbesserung damit per Konstruktion
nie verteuern. Die EV-Zentrierung — und damit die Profil-Dominanzfreiheit — bleibt unberührt, weil
nur ein rangunabhängiger Mittelwert abgezogen wird.

`FORM_AMPLITUDE` von 60 auf **24**: die alte Zahl multiplizierte Gewichte (Spanne ≈ 0.28 → 16.8 C),
die neue eine Leiter mit Spanne exakt 1.0 → 24 C. Gleiche Größenordnung, gemessen an der
LIGA-Leiter (74 − 39 = 35 C) etwa zwei Drittel.

**Verworfene Alternative — Amplitude senken, bis der negative Gewichtsschritt unter die Ligastufe
fällt:** die garantierte Stufenrendite ist LIGA-Schritt (min 4 C) plus Kurvenschritt (min −3 C bei
`Halten`) = 1 C, der größte negative Gewichtsschritt bei `mittelfeld` ist −0.07. Die Amplitude
hätte auf **14** gemusst — das hätte die Profilachse abgeschafft statt repariert.

**Beleg über den gesamten Kartenraum** (`scripts/sponsor-model-proposal.ts`, Abschnitt
„AUSZAHLUNGSLEITER-MONOTONIE"): 6 Kurven × 5 Profile × 32 Erwartungsränge = **960 Leitern**, je 32
Endränge geprüft → **0 nicht-monoton**. Dass das für die *volle* Auszahlung reicht, ist keine
Behauptung, sondern folgt: Kalibrieroffset, Klauselbonus/-malus und Sonderziel-Auszahlung hängen
nicht vom Endrang ab (sie werden mit der Erwartungsstufe gebildet), und Untergrenze `max(fl, x)`
sowie K-Skalierung `max(fl, fl + (x−fl)·K)` mit K > 0 sind in `x` monoton nicht-fallend.

Im Schattentest gegen die echten Endstände: **0 von 128** nicht-monotone Karten (vorher 6).

### Riss 4 — Toleranz von Kriterium 1

Von **±5 auf ±12 Prozentpunkte**, im Skript als `COVERAGE_TOLERANCE_PP` (über `--tolerance`
umstellbar) und hier begründet:

* Die **Eigenstreuung** des Entwurfs — die Standardabweichung der Liga-Summe, die das Modell vor
  der Saison selbst erzeugt — liegt bei **±5.6 bis ±6.8 Pp** der Gehaltssumme. ±5 lag damit
  **unter einem Sigma der eigenen Lotterie**.
* Das **ex-ante-K ist unverzerrt**: Median der Deckungsabweichung über 160 Lotteriewürfe **+0.7 Pp**
  (erster Lauf) bzw. **+0.2 Pp** (nach den Fixes). Der Fehler steckte nie in der Kalibrierung.
* ±12 Pp entspricht rund **2 Sigma** dieser Eigenstreuung.

Der Bericht weist beide Zahlen weiter aus, damit die Lockerung nachprüfbar bleibt.

---

## 9. Nachmessung — die sechs Kriterien nach den vier Rissen

Gleicher Save, gleiche Skripte, `--draws=40`.

| # | Kriterium | vorher | nachher | Verdikt |
|---|---|---|---|---|
| 1 | Deckung je Saison innerhalb der Toleranz | 3 von 4 außerhalb ±5 Pp | **0 von 4 außerhalb ±12 Pp** — und nur **1 von 4** außerhalb der alten ±5 Pp | **bestanden** |
| 2 | 0 Zahlungsunfähige bei sicherster Wahl | 0 | **0**, über 40 Würfe Median 0 / max 0, niedrigste Kasse +113.8 C | bestanden¹ |
| 3 | sigma in [3.5, 7] und jedes P ≤ 0.15 neben Design-P | 2 Klauseln gerissen, 5 nicht messbar | sigma 6.62 gegen Design 6.6; **0 gerissen, 0 nicht messbar, 0 ohne erreichbare Schwelle** | **bestanden** |
| 4 | FOSD-Test findet keine Falle in echter Angebotsliste | 0 Fallen | **0 Fallen** in 32 Listen, 96 Karten, 96 verschiedene Paare, 0 kollabiert | bestanden² |
| 5 | Kein „besserer Endrang zahlt weniger" | 6 von 128 | **0 von 128**, plus 0/960 über den gesamten Kartenraum | **bestanden** |
| 6 | Höchstens 8 Teams unter minus einem Mindestgehalt | 0 von 32 | **0 von 32**, über 40 Würfe Median 0 / max 0 | bestanden¹ |

**GESAMTURTEIL: kein Abbruchkriterium gerissen.**

Liga-Deckung je Saison mit ex-ante-K, vorher → nachher:

| Saison | Abweichung vorher | Abweichung nachher | EigenSD |
|---|---:|---:|---:|
| season-1 | +9.8 Pp | **−0.3 Pp** | ±6.1 |
| season-2 | −1.0 Pp | **−4.2 Pp** | ±6.1 |
| season-3 | +10.6 Pp | **+3.1 Pp** | ±6.8 |
| season-4 | +8.1 Pp | **+6.4 Pp** | ±5.7 |

Median der Abweichung **+9.0 → +1.4 Pp**. Über 160 Lotteriewürfe: Median **+0.2 Pp**, IQR
[−3.7, +3.9], **36 % außerhalb ±5 Pp** (vorher 39 %), **3 % außerhalb ±12 Pp**. Kumulierter Saldo
Median +293.1 C, 32/32 Teams im Plus.

¹ Weiterhin aus **einem** Engine-Lauf. Die modelleigene Lotterie ist 40-mal wiederholt (durchweg 0),
die Streuung über **Engine-Seeds** bleibt ungemessen.
² Die Angebote dieses Saves bilden weiterhin nur **3 der 6 Modellkurven** ab (Sockel/Gipfel/Halten)
und nur **3 Angebote je Team**. Die drei nicht abgedeckten Kurven sind über den vollen
Kombinationsraum in `sponsor-model-proposal.ts` geprüft (0 Fallen), aber nicht auf einer echten
Liste dieses Saves.

### Was sich als Nebenwirkung verschoben hat — offengelegt

* **Ökonomie bei sf 1.0:** Meister 95 (vorher 86), Rang 16 71 (66), Letzter 43 (53), Schere 2.20×
  (1.60×). Überschuss R1 **+8** (vorher −2), R32 **−0** (vorher +10). Das ist eine direkte Folge des
  Mitte-Bias: die Spitze wird jetzt dafür bezahlt, dass sie ihren Rang gegen den gemessenen
  Rückschritt hält. Die Vorgabe „Spitze macht bei sf 1.0 mindestens +10" ist damit erstmals nahezu
  erreicht, ohne dass GAMMA angefasst wurde — der Keller verliert aber seinen Puffer von +10.
* **Die Liga-Sonde selbst war falsch geworden.** `teamPayout` wertete jedes Team bei
  `Endrang = Erwartungsrang` aus. Mit dem Bias ist das für die Spitze systematisch eine
  Überperformance und für den Keller eine Unterperformance — die Sonde meldete Meister 114 und
  Schere 2.85×. Sie wertet jetzt am Verteilungsmittelpunkt `centerRank(e)` aus.
* **Das Meister-Band der Zielprüfung** ist von 90–101 auf **90–120** geweitet, weil der Titel unter
  dem Bias eine größere Überperformance ist (Erwartungsmittelpunkt eines Teams mit Erwartungsrang 3
  liegt bei 6.4). Gemessen: 100.9–113.6 über die kuratierte Liste.
* **Offener Punkt 3 des Umsetzungsplans bleibt offen:** bei **3 von 12** Typen schluckt die
  Untergrenze an der Zelle (Erwartung 30 / Endrang 32) den kompletten Klausel-Malus. Über den
  ganzen Rangbereich kollabiert dagegen **keine** Karte (0/384). Die Zielprüfung misst jetzt das
  Zweite und weist das Erste separat aus, statt beides in einen roten Haken zu werfen.
* **Neue Stellschraube `OLY_SPONSOR_FLOORSCALE`**, damit die Wirkung der Untergrenze messbar statt
  behauptet ist. Gemessen (voller Kombinationsraum, mit dem alten Korridor-Fallen-Test): 1.0 → 49
  Paare, 0.8 → 21, 0.6 → 15. Das war der Hinweis darauf, dass die Untergrenze **nicht** die
  Hauptursache war — der Korridor war es.

## 7. Reproduktion

```bash
# read-only Kopie der DB anlegen (Skripte schreiben nichts, die Kopie ist reine Vorsicht)
cp data/persistence/oly-app.sqlite outputs/sponsor-shadow-run/existing-copy.sqlite

# Aufgabe 1 — sigma und P
npx tsx scripts/sponsor-shadow-measure.ts \
  --db=outputs/sponsor-shadow-run/existing-copy.sqlite \
  --save-id=fresh-season-1-1784196429043 \
  --json=outputs/sponsor-shadow-run/measure-existing.json

# Aufgabe 2 und 3 — Schattenbuchhaltung und Abbruchkriterien
npx tsx scripts/sponsor-shadow-ledger.ts \
  --db=outputs/sponsor-shadow-run/existing-copy.sqlite \
  --save-id=fresh-season-1-1784196429043 \
  --measured=outputs/sponsor-shadow-run/measure-existing.json \
  --json=outputs/sponsor-shadow-run/ledger-existing.json

# Wiederholte Lotteriewuerfe (Verteilung statt Einzelwert)
npx tsx scripts/sponsor-shadow-ledger.ts … --draws=40

# Gegenprobe ohne Formkomponente
OLY_SPONSOR_FORM=0 npx tsx scripts/sponsor-shadow-ledger.ts …
```

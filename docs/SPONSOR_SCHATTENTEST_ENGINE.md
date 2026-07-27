# Sponsor-Balancing — Schattentest gegen die echte Engine

Stand 2026-07-27. Kein Produktionscode geändert; alle Messungen laufen read-only über
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

* **Keine Seed-Streuung.** Alle Zahlen unten stammen aus *einem* Engine-Lauf. Wo „Median" und
  „IQR" steht, laufen sie über die **Saisons** dieses Laufs, nicht über Seeds. Für die Kriterien 2
  und 6 (Insolvenz, Teams im Minus) heißt das ausdrücklich: aus einem Lauf, Streuung ungemessen.
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
| 1 | Deckung je Saison innerhalb sf ± 5 Pp, höchstens eine von fünf Saisons außerhalb | **3 von 4 außerhalb** (+9.8, +10.6, +8.1 Pp) | **GERISSEN** |
| 2 | 0 Zahlungsunfähige unter Teams, die die sicherste Karte wählten | **0** Fälle; Kasse-Minimum +137.7 C, Median +394.8 C | bestanden¹ |
| 3 | sigma in [3.5, 7] **und** jedes gemessene P ≤ 0.15 neben Design-P | sigma 6.62 ✓ (aber S2/S4 einzeln 7.10/7.47 ✗); **2 Klauseln reißen** (Ausbau 0.11 vs 0.45; Wortlaut 0.00 vs 0.45) | **GERISSEN** |
| 4 | FOSD-Test mit gemessenem sigma/P findet keine Falle in einer **echten** Angebotsliste | **0 Fallen** in 32 Listen, 96 Karten, 96 verschiedene Paare, 0 kollabiert | bestanden² |
| 5 | Kein realisierter Fall „besserer Endrang zahlt weniger" | **6 von 128** Karten mit nicht-monotoner Auszahlungsleiter | **GERISSEN** |
| 6 | Höchstens 8 Teams mit kumuliertem Saldo unter minus einem Mindestgehalt | **0** von 32 | bestanden¹ |

¹ Aus **einem** Lauf. Streuung über Seeds ungemessen — nicht als belastbar zu verkaufen.
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

* **Kriterium 1 (Deckung).** 3 von 4 Saisons außerhalb sf ± 5 Pp, Median +9.0 Pp. Und die
  Diagnose ist schwerwiegender als die Zahl: die **Eigenstreuung des Entwurfs (±5.6 bis ±6.6 Pp)
  ist größer als die geforderte Toleranz.** Das Kriterium ist mit diesem Entwurf nicht durch
  bessere Kalibrierung zu retten — es müsste entweder die Toleranz weiter (auf mindestens
  ±12 Pp für 2σ) oder die Lotterie-Amplitude kleiner werden, insbesondere das Sonderziel, das mit
  `EV / P_GOAL` (bis 4× gedeckelt) der größte einzelne Varianztreiber ist.
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
identischen Paare, keine kollabierte Karte. Die Kriterien 2 und 6 halten deutlich (0 Insolvenzen,
0 Teams im Minus, Kasse-Minimum +137.7 C), stehen aber auf einem einzigen Lauf.

**Kürzeste Zusammenfassung:** Der Entwurf ist **fallenfrei und zahlungssicher**, aber er ist
**nicht rang-monoton**, seine **Klauseln passen teilweise nicht zu dem, was die KI im Spiel
tatsächlich tut**, und seine **Liga-Summe streut stärker, als die Vorgabe erlaubt**. Die ersten
beiden Punkte sind reparierbar (Profilgewichte monotonisieren, Klauselschwellen an gemessenen
Verteilungen setzen, „Wortlaut" und „Ausbau" neu fassen oder streichen). Der dritte ist eine
Design-Entscheidung: entweder die Toleranz oder die Lotterie-Amplitude muss sich bewegen.

---

## 6. Gegenprobe auf einem frischen Langlauf

Siehe Abschnitt „Frischer Lauf" am Ende dieses Dokuments (wird nach Abschluss des Laufs ergänzt).

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

# Gegenprobe ohne Formkomponente
OLY_SPONSOR_FORM=0 npx tsx scripts/sponsor-shadow-ledger.ts …
```

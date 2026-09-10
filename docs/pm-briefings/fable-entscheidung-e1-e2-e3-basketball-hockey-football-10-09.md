# Fable-Entscheidung E1/E2/E3 — Basketball, Hockey, Football (10.09.)

**Auftrag:** Chris hat die drei offenen Entscheidungen aus
`opus-plan-zehn-disziplinen-alle-kategorien-09-10.md` Abschnitt 8 an Fable gegeben. Dieses
Dokument trifft sie. Es aendert **keine Zeile Produktionscode**; alle Fundstellen sind gegen
`main` = `f97e5b48` gelesen, nicht vermutet.

**Rubrik-Grundlage:** `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
Abschnitt 0 — G1 (40) ist die Rangtreue-Stufenleiter (≥0,85 → 40 · 0,80–0,85 → 35 · 0,70–0,80 → 22),
K4 (25) verlangt „Rezept nachweislich kalibriert und die offenen Designfragen entschieden".

---

## 0. Die drei Entscheidungen in drei Saetzen

| | Entscheidung | Kern der Begruendung |
|---|---|---|
| **E1 Basketball** | **Fussnote — aber als MESSBARE Alternativ-Abnahme (G1\*), nicht als Freibrief. Kein Forschungsticket.** | Saison 0,923 / Spiel 0,769 → Verlaesslichkeit 0,69: die Mechanik belohnt das Richtige. CLAUDE.md liefert die Star-/Paartreue-Abnahme genau fuer diesen Fall — nur ist sie fuer Basketball **nie gemessen** worden. Das ist die Luecke, nicht rho. |
| **E2 Hockey** | **Keine „Runde 1" nach dem Football-Muster.** Die Praemisse des Plans ist falsch: Hockey **hat** eine Live-Engine und lost seit dem 02.09. mit κ=3. | `FELDSPIEL_ART.hockey.live` (`engine.js:4673`), Abzweig `:5721` VOR der `gewichtetesLos()`-Schleife. Der Kommentar `:4883` ist veraltet. Alle Football-Hebel sind bei Hockey bereits gezogen oder gemessen gescheitert; die Orakel-Decke der heutigen Ereignisse liegt bei 0,73. |
| **E3 Football** | **Anzeige, Teamstaerke und KI-Kauf ziehen auf die Spiel-Eignung nach — nicht umgekehrt.** Umsetzung ueber eine Override-Tabelle im Rating-Pfad, die Matrix-Datei bleibt byte-identisch. | Der Rueckweg ist gemessen tot (rho 0,053 ohne `spielEignung`). Die 0,800 von PR #884 sind nur dann eine Aussage ueber Football, wenn die Spiel-Eignung die Zielgroesse ist — und dann muss der Manager sie auch sehen. |

Was Chris dazu nicken muss, steht in Abschnitt 4 — drei Zeilen.

---

## 1. E1 — Basketball: Fussnote ja, aber gemessen; kein Forschungsticket

### 1.1 Die zwei Spalten, nachgerechnet

`data/generated/rangtreue-basislinie.json`: Basketball **0,769** je Spiel (Spannweite 0,105),
**0,923** Saison. Nach CLAUDE.mds Formel `rho(Spiel) = rho(Saison) × √Verlaesslichkeit` ist die
Verlaesslichkeit **(0,769/0,923)² = 0,69**.

| | rho Spiel | rho Saison | Verlaesslichkeit | Lesart nach CLAUDE.md |
|---|---:|---:|---:|---|
| Basketball | 0,769 | **0,923** | 0,69 | Saison hoch, Spiel niedrig → **Mechanik belohnt das Richtige, aber zu laut** |
| Hockey (12) | 0,669 | 0,832 | 0,65 | dito |
| Football (neu) | 0,800 | 0,867 | 0,85 | nach #884 der verlaesslichste Feldspiel-Motor |

Basketball hat die **zweithoechste Validitaet des gesamten Feldes** (nur Staffel liegt hoeher). Die
Zwei-Spalten-Regel sagt fuer diesen Fall woertlich: „dann fehlen EREIGNISSE, nicht Rezepte" — und
direkt daneben: „**Mehr Ereignisse helfen fast nie**" (Hockey bei verdoppelter Uhr: flach). Basketball
hat mit ~100 Ballwechseln je Spiel bereits die hoechste Ereignisdichte aller Feldspiele.

### 1.2 Was ein Forschungsticket tun muesste — und warum ich es nicht aufmache

Der Opus-Plan nennt als naechsten Kandidaten `USAGE_KAPPA=2` (`engine.js:4851`). Drei Gruende
dagegen, alle am Code bzw. an Messungen:

1. **Die Konstante steht bewusst flacher.** `USAGE_KAPPA` ist die Steilheit der Pass-KASKADE
   (`offensterMitspieler`, `:7800-7803`), nicht eines Einzelereignisses — der Kommentar `:4849-4850`
   und `battle-mode-nba2k-modell-plan.md` (Zeile 295-303) begruenden die 2 gegen die 3 der
   Einzel-Lotterie. Sie auf 3 zu heben konzentriert den Ball noch staerker auf den einen Schuetzen.
2. **Genau dieser Hebel ist beim Nachbarn gemessen und verworfen.** Hockeys „Pass zum besseren
   Schuetzen lenken" (Usage nach Basketball-Muster) kippte die Sniper-Probe von +0,30 auf −0,25
   (`engine.js:7787-7799`, `hockey-naechster-hebel-recherche-fable.md` 3.4): der bevorzugt
   angespielte Schuetze bekommt mehr, aber schlechtere Gelegenheiten. Basketball hat denselben
   Verteidigungs-Rueckkopplungskanal (`abwehrTeiler`, `offenheitFuerPass`).
3. **Asymmetrisches Risiko am einzigen Live-Motor.** Basketball ist die einzige Feldspiel-Disziplin
   in `ARENA_RESOLVED_DISCIPLINE_IDS`; die CI-Schranke (`pruefe-rangtreue-schranke.mjs`) schlaegt
   bei einem Rueckgang > 0,050 an. Der letzte gemessene Basketball-Hebel (K3, 04.09.) brachte
   +0,015 bei n=24 — die 0,031 sind **zwei K3-Runden**, gegen eine Kader-Spannweite von 0,105.
   Ein Versuch, der die Zahl nicht bewegt, ist wahrscheinlicher als einer, der sie hebt.

**Entscheidung: kein Forschungsticket.** Nicht, weil Forschung verboten waere, sondern weil die
Zahl, die fehlt, eine andere ist.

### 1.3 Die Fussnote — und warum sie nur MIT Messung ehrlich ist

Der Opus-Plan raet von der Fussnote ab, weil sie „genau die Zahl aushoehlt, nach der Chris gefragt
hat". Das trifft die **Freibrief-Fassung** („von Chris abgenommen zaehlt als bestanden"). Es trifft
**nicht** die Fassung, die CLAUDE.md selbst vorgibt:

> „**Die ehrlichere Abnahme fragt deshalb nach dem Star und nach der Paartreue mit Abstand**,
> nicht nach einer nackten Rangkorrelation ueber alle Paare."

Und hier liegt der eigentliche Befund: die CLAUDE.md-Tabelle fuehrt fuer Basketball in der Zeile
„Star auf Rang 1 (kaderfest)" einen **Strich**. Hockey hat 58 % / 78 % / 0 % (Rang 1 / Top 2 /
Letzter) und 99 % Paartreue ≥ 15 Punkte — Basketball hat **nichts davon**. Die Sonde dafuer existiert
nur als Scratchpad-Anhang (`football-erfolgskurve-plan-05-09.md` Anhang B), `miss-star-paartreue.mjs`
wurde dort vorgeschlagen und nie ins Repo uebernommen (`ls scripts | grep star`: leer).

**Entscheidung: G1 bekommt eine Alternativ-Abnahme G1\*, die fuer JEDE Disziplin gilt, nicht nur
fuer Basketball:**

> **G1\* (35 Punkte, wie Stufe 0,80–0,85):** Eine Disziplin mit rho je Spiel in der Stufe 0,70–0,80
> erhaelt 35 statt 22 Punkte, wenn — kaderfest, n ≥ 24 je Paarung, dieselbe Kader-Familie wie die
> Basislinie — **alle vier** Bedingungen halten:
> (a) rho Saison ≥ 0,85 (die Mechanik belohnt das Richtige),
> (b) Star auf Rang 1 ≥ 50 % und in den ersten zwei ≥ 75 %,
> (c) Star auf dem letzten Rang 0 %,
> (d) Paare mit ≥ 15 Eignungspunkten Abstand zu ≥ 95 % richtig geordnet.
> Die Zahlen stehen in `stand-aller-disziplinen.md` neben rho, die Fussnote nennt sie.

Die Schwellen sind Hockeys heutige, gemessene Werte (58/78/0/99), leicht abgerundet — sie sind
also **nicht** auf Basketball zugeschnitten, sondern das, was der einzige vermessene Fall dieser
Klasse liefert. Faellt Basketball bei (b) oder (d) durch, bleibt G1 bei 22 und die Entscheidung ist
trotzdem getroffen: dann fehlt Validitaet in einem Kanal, und **das** waere ein Forschungsticket wert.

**Was zu tun ist (kleiner Mess-PR, keine Motoraenderung):** `scripts/miss-star-paartreue.mjs`
aus Anhang B des Erfolgskurven-Plans ins Repo, einmal ueber Basketball und Hockey fahren, Zahlen in
`stand-aller-disziplinen.md` und CLAUDE.md-Tabelle eintragen (die Hockey-Zeile dort ist laut
`hockey-opus-review-nhl.md` 5.3 ohnehin veraltet). Erwartung ehrlich: Basketball liegt mit
Verlaesslichkeit 0,69 gegen Hockeys 0,65 (Zwoelfer) bzw. 0,77 (Feldspieler) in derselben Klasse —
ich erwarte, dass (b)–(d) halten, verspreche es aber nicht.

---

## 2. E2 — Hockey: die Praemisse ist falsch, deshalb keine „Runde 1"

### 2.1 Der Befund am Code: Hockey faehrt den Live-Motor

Der Opus-Plan (8.2) stuetzt sich auf den Kommentar `engine.js:4883-4886` („Hockey hat noch keine
Live-Engine … die MOTOREN[hockey] rechnet die Partie vorab durch") und schliesst: Hockey lost linear
ueber `gewichtetesLos()` (`:4814`). **Beides ist veraltet.**

| Fundstelle | Was dort steht |
|---|---|
| `engine.js:4673-4674` | `FELDSPIEL_ART.hockey` traegt `live:{perioden:3, periodenDauer:80, …, periodeWort:"Drittel"}` — der Kommentar darueber (`:4665`) nennt es „LIVE-BLOCK (Hockey-Plan 6.3, von Chris entschieden: ‚3 drittel zu 1:20')". |
| `engine.js:4758-4763` | „Eine Disziplin faehrt genau dann den Live-Motor, wenn sie einen `live`-Block in FELDSPIEL_ART hat" — `LIVE()`. |
| `engine.js:5721` | `bauFeldspiel`: `if(art.live){ initFeldspielLive(art); return; }` — **vor** der Vorab-Schleife `:5725-5809`, in der die fuenf `gewichtetesLos()`-Aufrufe (`:5733/5734/5769/5775/5796`) stehen. |
| `engine.js:7362` | `initFeldspielLive`: `if(istHockey())bestimmeTorwaerter();` — hockey-eigener Code im Live-Init. |
| `engine.js:7405` | Live-Start ueber `spielmacherLos()` (`:7655-7660`), das mit `losGewicht(u.AUFBAU)` lost — **κ=3** (`LOS_KAPPA`, `:4846`). |
| `engine.js:8176`, `:8196`, `:9843` | Spielzug-Kandidat, Screener, Rebound-/Puck-Zweikampf: alle `gewichtetesLosNach(…, losGewicht(…))`, κ=3. |
| `engine.js:7800-7803` | Pass-Kaskade `offensterMitspieler`: `losGewicht(m.ABSCHLUSS, USAGE_KAPPA)`, κ=2 — mit hockey-eigenem Torwart-Ausschluss `:7707-7712`. |
| `battle-mode.rezepte.js:398-405` → `:413-415` | Derselbe veraltete Satz („Hockey faehrt heute NICHT den Live-Motor") — und drei Zeilen weiter: „**INZWISCHEN UEBERHOLT**: die Live-Migration (hockey-eigene-erfolgskurve, 02.09.) ist gelaufen". |

**Folge, die ueber Hockey hinausgeht:** Basketball (`:4358`), Football (`:4409`) und Hockey
(`:4673`) haben alle drei einen `live`-Block, Tennis ist auf die Buehne umgezogen (`:4748`). Die
Vorab-Schleife `:5725-5809` mit `gewichtetesLos()` laeuft damit heute **fuer keine einzige
Disziplin mehr**. Der Kommentar `:4841-4844` („sie zu aendern wuerde ausschliesslich Football/Hockey/
Tennis verschieben") sowie `:5719-5720` und `:5813` beschreiben einen Zustand vom August.

### 2.2 Die Duplikat-Pruefung, die der Plan verlangt

`battle-mode.rezepte.js:458-489`, elf Sub-Skills. **Keine zwei sind identisch** — anders als
Footballs TEAMGEIST=LAUFKRAFT / BALLSICHERHEIT=PASSGENAUIGKEIT vor #884:

```
AUFBAU      stamina 57 / speed 23 / awareness 13 / power 7
ABSCHLUSS   power 82 / spirit 18                      (nachjustiert, hockey-rezept-ursache.md)
TECHNIK     awareness 46 / determination 31 / dexterity 23
ZWEITCHANCE health 62 / power 23 / torment 15
ABWEHR      speed 26 / health 24 / will 24 / determination 11 / power 9 / torment 6
TEAMGEIST   torment 53 / spirit 47
AUSDAUER    stamina 57 / health 20 / will 19 / spirit 4
SCHUSS_NAH  health 63 / dexterity 22 / torment 15
SCHUSS_FERN power 47 / awareness 30 / speed 23        (nachjustiert)
LAUFTEMPO   stamina 66 / speed 26 / dexterity 8
PARADE      health 45 / awareness 30 / dexterity 15 / will 10
```

Einziger Hinweis: AUFBAU und LAUFTEMPO sind beide stamina/speed-gefuehrt und damit korreliert —
aber das ist eine Sinkhorn-Nachbarschaft, keine Kopie, und die Sondierung hat AUFBAU ohnehin mit
0 % mechanischem Gewicht gemessen (`hockey-naechster-hebel-recherche-fable.md` 3.4): der Sub-Skill
scheitert an fehlenden Ereignissen, die ihn lesen, nicht an seiner Mischung.

### 2.3 Warum der Football-Sprung bei Hockey nicht wiederholbar ist

Footballs +0,284 kamen aus drei Teilen (`opus-plan-football-gameplay-09-10.md`): Lotterie κ=3
(+0,20), Rezept C gegen zwei Kopien (+0,06), eine fehlende Box-Score-Zeile (+0,025). Bei Hockey:

| Football-Hebel | Stand bei Hockey | Beleg |
|---|---|---|
| Lotterie linear → κ=3 | **schon gezogen** (2.1) | `:7659`, `:8176`, `:8196`, `:9843` |
| Rezept-Kopien aufloesen | **keine Kopien** (2.2); zwei weitere Rezeptrunden gemessen schlechter | `hockey-ueber-080-versuch2.md`: 0,595/0,769, nicht committed |
| fehlende Box-Score-Zeile | **schon getan** (K3: Tore halb als xG, +0,07 Feldspieler) | `hockey-zufriedenstellend.md` 2 |
| naechste Mechanik (Zoneneintritt K1) | gebaut, **Vorzeichen kippt bei n=96**, nicht committed | `hockey-zoneneintritt-umsetzung.md` |

Und die Arithmetik dazu (`hockey-naechster-hebel-recherche-fable.md` 1.3/1.4): ein in-sample-Orakel
ueber alle neun heute gebuchten Posten erreicht **0,73** je Spiel — das ist die Decke der heutigen
Ereignisse. Bei Validitaet 0,818 braeuchte 0,80 eine Verlaesslichkeit von 0,956, „unerreichbar
(lose Pucks, der verlaesslichste Posten, haben 0,86)". Kein Hebel, der nur Rezept, Wertformel oder
Lotterie anfasst, bringt Hockey bei 3 × 80 s ueber 0,80.

**Entscheidung: keine „Hockey-Gameplay Runde 1" nach dem Football-Muster.** Sie wuerde drei bereits
gezogene Hebel ein zweites Mal ziehen, mit dem Messrauschen einer Disziplin, deren Kader-Spannweite
(0,181) groesser ist als der gesuchte Zuwachs.

### 2.4 Was stattdessen — drei kleine Dinge, keine Forschung

1. **Kommentar-Pflege-PR (null Verhaltensaenderung).** Die fuenf veralteten Stellen berichtigen,
   damit der naechste Planer nicht dieselbe Schlussfolgerung zieht: `engine.js:4841-4844`,
   `:4883-4886`, `:5719-5720`, `:5813`, `rezepte.js:398-405`. Dazu ueber der Vorab-Schleife
   `:5723` der Satz, dass sie seit Tennis' Umzug fuer keine Disziplin mehr laeuft. Nicht loeschen —
   der Block ist die Naht fuer eine spaetere Vorab-Disziplin und das Denkduell-Muster; nur
   ehrlich beschriften. Abnahme: `miss-alle-disziplinen.mjs 24` bit-identisch.
2. **G1 fuer Hockey ueber G1\* aus E1 — und das Ergebnis ist heute ein Nein.** Hockey hat die vier
   Zahlen bereits: Star 58 % / 78 % / 0 %, Paartreue 99 % (`hockey-opus-review-nhl.md` 5.3) — (b), (c),
   (d) halten. Aber die Saisonzahl liegt bei **0,832** (Zwoelfer) bzw. **0,818** (Feldspieler), und
   Bedingung (a) verlangt 0,85. Hockey bleibt damit bei G1 22, bis die Validitaet um 0,02–0,03
   steigt — genau das ist der Beweis, dass G1\* keine Fussnote fuer Abgenommenes ist, sondern eine
   zweite Messlatte. Der einzige Hebel, der bei Hockey nur die Validitaet anfasst und ohne neuen
   `rr()`-Wurf auskommt, ist H2 (unten); ob er reicht, ist eine Messung, kein Bau, und gehoert in
   denselben Mess-PR wie E1.
3. **Assets 80 → 100 ist der billige Hebel und bleibt es.** Ton nach Muster #883, Hockey hat mit
   `eisflaeche()` die volle Kulisse. Das ist die Achse, die Hockey wirklich fehlt.

**Optional, ausdruecklich nicht empfohlen fuer jetzt:** der einzige noch offene Hebel ohne neuen
`rr()`-Wurf ist H2 (Torwart auf GSAx statt GSAA, `hockey-opus-review-nhl.md` 6). Er hebt nur die
Zwoelferzahl, nicht die Feldspieler — und die Feldspieler sind die Zahl, an der Hockey ehrlich
gemessen wird. Wer die 0,80 trotzdem erzwingen will, braucht vorher das Messbudget n ≥ 150 fuer K1.

---

## 3. E3 — Football: die Anzeige folgt dem Spiel

### 3.1 Wo die zwei Ordnungen im Code sitzen

**Der Produktionspfad (Anzeige, Teamstaerke, KI-Kauf):**

| Schritt | Fundstelle | Football-Gewichte |
|---|---|---|
| Matrix-Datei | `lib/player-generator/official-discipline-weights.ts` (Spalte `football` in `officialDisciplineWeightTable`) | spirit 25, torment 16, health 14, awareness 11, will 10, determination 8, power 6, stamina 6, charisma 4 |
| Rating-Rechnung | `lib/player-formulas/discipline-rating-engine.ts:26-39` `calculateRawDisciplineScore` liest **die Tabelle direkt**, dann Rang → Stat (`:41-45`), dann `applyLeagueDisciplineRatingsToPlayer` `:217-244` → `player.disciplineRatings` | = `p.d.football` |
| Zweite Kopie in der DB | `lib/db/seed/seedSources.ts:32-46` `disciplineWeightSeedRows` (Quelle `official-weighted-average-matrix-2026-06`) | gelesen ueber `weightPct` von `lib/ai/ai-needs-engine.ts`, `lib/lineups/matchday-slot-roles.ts`, `legacy-lineup-*` |
| Leser von `p.d` | `lib/foundation/battle-arena/arena-kader-adapter.ts:111` (`d: {...player.disciplineRatings}` → Motor), `lib/ai/organic-squad/quality.ts` (KI-Kauf), Transfermarkt-Linse (`TransfermarktV2Client.tsx:326`), `team-powers.ts` (abgeschaltet), Training/Scouting | |
| Motor-Spiegel der Matrix | `engine.js:3592-3613` `BASIS_JE_DISC` — **generiert** aus derselben Tabelle (`scripts/generiere-arena-daten.ts:58-76`), speist Slot-Aufschlag, `betroffeneAttribute` und den Rueckfall in `bauSpieler` | `:3609` |
| Slot-Rollentexte | `lib/lineups/matchday-slot-roles.ts:232-239` — „Line Power: Gewinnt Kontakt ueber Spirit und Torment", „Red Zone: Spirit und Power" | Text zur alten Matrix |

**Der Minispiel-Pfad:**

| Schritt | Fundstelle |
|---|---|
| Spiel-Eignung | `engine.js:4425` `FELDSPIEL_ART.football.spielEignung` — power 22, health 18, speed 14, torment 12, determination 10, awareness 8, stamina 6, dexterity 4, spirit 3, will 3 (PR #803) |
| Lesestelle | `engine.js:5668-5670`: `basisWert = spielE ? gewichtet(p.a, spielE.gewichte) : produktionsWert` → `u.eig` (`:5676`) |
| Was `u.eig` tut | **nur Massstab**: kein Motorpfad liest es, es ist die Zielgroesse der Rangtreue-Sonde und die Boxscore-Spalte (`football-erfolgskurve-plan-05-09.md` 0.2) |
| Rezept C + `fkLos` | gegen genau diese Zielgroesse gebaut und gemessen (PR #884, `:6840ff`) |

**Wie weit die beiden auseinanderliegen:** rho **0,427** zwischen `p.d.football` und `spielEignung`
auf den 110 Spielern der Kader-Familie (`football-erfolgskurve-plan-05-09.md` 2.3); Ser Camelot faellt
1 → 27, Johanna 2 → 25, „Die Liebenden" 4 → 91. Und mit abgeschalteter `spielEignung` misst
Football gegen die Matrix **rho 0,053** je Spiel (`opus-plan-football-gameplay-09-10.md` 3) —
„praktisch unabhaengig".

### 3.2 Die Entscheidung

Es gibt genau zwei Richtungen, und eine davon ist gemessen tot:

* **Minispiel zurueck auf die Matrix:** rho 0,053. Drei Kalibrierrunden (04.09.) haben belegt, dass
  die Matrix von keinem Rezept bedient wird, weil ihr drittschwerstes Attribut (awareness) auf dem
  echten Kader mit **−0,335** gegen ihre eigene Eignung korreliert (`football-matrix-entscheidung.md`).
  Das ist kein Kalibrierproblem, sondern die Matrix selbst.
* **Anzeige/Teamstaerke/KI-Kauf auf die Spiel-Eignung:** Das ist die Richtung, in die das Projekt
  seit #803 faktisch laeuft — die G1-Stufe 35, die Football heute traegt, **setzt bereits voraus**,
  dass die Spiel-Eignung Footballs Zielgroesse ist. Solange der Manager eine andere Zahl sieht,
  ist K4 („offene Designfragen entschieden") nicht erfuellbar, und die KI kauft fuer ein Spiel ein,
  das andere Spieler belohnt.

**Entscheidung: die Anzeige-/Kauf-Seite zieht nach.** Und zwar so, dass Chris' Satz vom 05.09.
(„die Gewichtungsmatrix darf nicht veraendert werden! wenn dann muessten die Stats und wie sie in
die Attribute der Diszi einfliessen angepasst werden") **woertlich** eingehalten bleibt:

### 3.3 Der einfachste Weg — eine Override-Tabelle, ein Leser, alle Folger

1. **Neue Datei `lib/player-generator/spiel-eignung-overrides.ts`** mit genau einem Eintrag,
   `football`, Gewichte 1:1 aus `engine.js:4425`, mit dem Kommentar, warum es sie gibt (dieser
   Abschnitt) und dass sie die **Zielgroesse des Minispiels** ist. `official-discipline-weights.ts`
   bleibt byte-identisch (`git diff` leer — dieselbe Abnahme wie #803).
2. **Ein Leser:** `calculateRawDisciplineScore` (`discipline-rating-engine.ts:26`) nimmt fuer eine
   Disziplin mit Override dessen Gewichte statt der Tabelle. Damit folgen `p.d.football` und **alle**
   Leser von `disciplineRatings` automatisch — Transfermarkt, Kader, KI-Kauf ueber `organic-squad`,
   Teamstaerke, Training, Scouting, und `arena-kader-adapter.ts:111` in den Motor.
3. **Dieselbe Quelle fuer die zwei Kopien:** `seedSources.ts:32-46` und `generiere-arena-daten.ts:58-76`
   lesen den Override ebenfalls → die DB-Zeilen (`weightPct`, KI-Needs, Lineup) und `BASIS_JE_DISC.football`
   im Motor stimmen mit dem Rating ueberein. Danach ist `spielEignung` in `FELDSPIEL_ART.football`
   **redundant** (`produktionsWert` liefert dieselbe Rangfolge) und wird entfernt — eine Quelle
   statt zwei, `bauSpieler` faellt auf die Standardzeile zurueck wie bei jeder anderen Disziplin.
4. **Slot-Rollentexte** `matchday-slot-roles.ts:232-239` auf power/health/speed umschreiben
   (Text ist kein Gewicht; die Slot-Profile werden ueber `resolveSlotRolesForDiscipline` aus der
   Gewichtsquelle abgeleitet und ziehen mit Schritt 3 nach — nachpruefen, `generiere-arena-daten.ts:81-113`).

**Warum nicht einfach die Football-Spalte in der Matrix-Datei aendern?** Das waere technisch noch
kuerzer (eine Zeile, ein Generatorlauf, eine Loeschung) — aber es ist exakt der Weg, den Chris am
05.09. verboten hat, und der geschlossene PR #796 hat ihn schon einmal gegangen. Wenn Chris das
Veto aufhebt, ist das der bessere Weg; bis dahin ist die Override-Tabelle die einzige Fassung, die
Regel und Ziel zugleich erfuellt. Ehrlich gesagt: **funktional ist beides dasselbe** — Footballs
Zielgroesse aendert sich fuer Anzeige und KI. Das ist der Punkt, den Chris nicken muss (Abschnitt 4).

### 3.4 Was das kostet — vier Punkte, die VOR dem Merge geklaert sein muessen

1. **Die 0,800 sind nicht garantiert stabil.** Die Rangtreue-Sonde stellt die Heimseite ohne
   Aufstellung nach `p.d[disc]` auf (`bauFeldspiel`, Rueckfall `ersatz`). Mit neuem `p.d.football`
   treten die sechs Besten nach Spiel-Eignung an, die enger beieinander liegen — der Effekt „F2"
   (`football-erfolgskurve-plan-05-09.md` 4.2): damals 0,516 → 0,476 je Spiel bei 0,811 → 0,853
   Saison, innerhalb der Spannweite. Nach dem Umbau ist `miss-alle-disziplinen.mjs 48 football`
   Pflicht; landet die Zahl unter 0,80, faellt G1 auf 22 und Gameplay auf 82. Das ist der Preis
   dafuer, dass die Messung dann endlich so faehrt, wie ein Manager aufstellt.
2. **Bestehende Spielstaende behalten das alte `p.d.football`.** `rebuildLeagueDisciplineRatings`
   laeuft heute nur beim Charakter-Import (`character-import-service.ts:209`) und als Baseline in
   `season-end-progression-preview.ts:562`; `organic-season-progression.ts` baut die Ratings nicht
   neu (nachgesucht). Es braucht einen einmaligen Rebuild-Schritt fuer laufende Saves — ueber
   `deploy/hetzner/pull-repaired-save.sh`, nie von Hand (CLAUDE.md, WAL).
3. **Die Basislinie** (`rangtreue-basislinie.json`, Football 0,516 — ohnehin stale seit #884) und die
   PPS-Referenz muessen mit dem Vermerk neu gezogen werden, dass sie eine andere Aufstellungsregel
   messen. Der Produktionsanschluss (`ARENA_RESOLVED_DISCIPLINE_IDS`) kommt **danach**, nicht davor —
   sonst zieht man die Referenz auf einem wandernden Massstab (Regel aus dem Arena-Rollout-Plan).
4. **Eine sichtbare Zahl springt fuer den Spieler.** Spieler, die in der Football-Linse oben standen,
   fallen; das ist die Absicht, aber es muss einmal im Kaderbildschirm angesehen werden, bevor es
   live geht (Sicht-QA, kein Messlauf).

Reihenfolge damit: **E3-Umbau → Messung n=48 → Basislinie/PPS → Anschluss.** Der Opus-Plan hat
Football auf Platz 7 mit „braucht Chris' Matrix-Entscheidung" — die ist hiermit getroffen, der
Platz bleibt.

---

## 4. Was Chris nicken muss

1. **E1:** G1\* als messbare Alternativ-Abnahme in die Rubrik (Schwellen 0,85 / 50 % / 75 % / 0 % / 95 %).
   Ein Nein heisst: Basketball bleibt bei Gameplay 82 und ist aus der Zehnerliste draussen — ohne
   dass irgendjemand an der Mechanik dreht.
2. **E2:** Hockey bekommt **keine** Rangtreue-Runde; der Plan wird um den Fund aus 2.1 berichtigt.
3. **E3:** Football-Anzeige und KI-Kauf folgen der Spiel-Eignung; die Matrix-**Datei** bleibt
   unveraendert, die Zielgroesse aendert sich trotzdem. Wer das nicht will, muss Football als
   Schauspiel-Disziplin fuehren (Weg B vom 04.09.) — dann ist G1 35 eine Zahl ohne Bedeutung fuer den
   Spieler, und Football gehoert nicht in die Zehnerliste.

---

## 5. Grenzen dieser Entscheidung

* **Nichts gemessen, alles gelesen.** Keine Sonde gefahren, kein Prototyp gebaut — die Aufgabe hat
  das fuer E2 ausdruecklich freigestellt, und fuer E1/E3 sind die tragenden Zahlen (0,769/0,923,
  0,053, 0,427, F2) aus Dokumenten mit dokumentierter Messmethode uebernommen.
* **Chris' Basketball-Abnahme** ist in drei Dokumenten festgehalten (`gesamtstand … 09-10.md`
  Tabelle, `opus-overseer-plan … 09-09.md` Zeile 105, Opus-Plan 8.1), der Wortlaut selbst liegt nicht
  im Repo. G1\* macht die Abnahme unabhaengig davon nachpruefbar — das ist Absicht.
* **Die G1\*-Schwellen** sind aus einem einzigen vermessenen Fall (Hockey) abgeleitet. Wenn
  Basketball die Sonde durchlaeuft, gibt es zwei; dann kann man sie nachziehen.
* **Kein Zugriff auf den Server** (CLAUDE.md). Die Kader-Familie ist das `live-save`-Abbild vom
  03.09.; die Spiegel-Frische wurde fuer diese Entscheidung nicht neu geprueft.

# Bahn im Pod-Format: Takeshi's Castle und Staffel mit vier Teams (01.11.)

Chris' Freigabe vom 01.11.: je Kernbereich eine 4-Team-Disziplin wie Mini-DM (pow Mini-DM,
spe Staffel, men Takeshi, soc Battlefield), Punkte 2-1-0-0, Gruppen je Disziplin-Event frisch
gelost, zwei Pod-Disziplinen am selben Spieltag erlaubt. Konzept und Größen:
Scratchpad-Recherche „Vier Teams je Bereich" (01.11.). Battlefield läuft seit `1dcf3823` als
PPS-Pod (`VIERER_POD_DISCIPLINE_IDS`).

Dieses Dokument beschreibt den **Motor-Teil** für die zwei Bahn-Disziplinen (Abschnitte 1–5) und
die **Verdrahtung in die Liga** (Abschnitt 6, 02.11.): Takeshi und Staffel stehen seit 02.11. in
`VIERER_POD_DISCIPLINE_IDS`, gebucht wird das echte Vier-Team-Rennen, und die Arena zeigt es.

**Stand 02.11.:** Die Pp-Pflichtprüfung besteht jetzt bei beiden, ohne Ausnahme und ohne
Matrixänderung (Abschnitt 5): Takeshi 18,9 / 16,3, Staffel 9,3 / 10,1 (n = 48, zwei Saatströme).
rho bleibt über 0,80 bei jeder Kadergröße, das Duell ist bit-identisch.

**Stand 02.11. abends:** Liga-Kette fertig (Abschnitt 6) — Runner, Spieltag, Motor-Vorrang im
Pod-Resolve, Referenzen, Vorlauf mit Schalter, Vier-Team-Anzeige in der Arena, Eintrag in
`VIERER_POD_DISCIPLINE_IDS`. Duell weiter bit-identisch (0,937 / 0,898), echter End-to-End-Lauf
über einen Test-Spielstand grün.

## 1. Was gebaut ist

**Das Bahn-Chassis kennt N Seiten** (`public/mockups/battle-mode.engine.js`):

- `bahnPodKader` (Standard `null`) und `bahnSeitenN()`. Im Duell gilt `bahnSeitenN() === 2`.
- `BAHNEN_N()` wächst mit der Seitenzahl. Es gibt weiter eine Bahn je Läufer, deshalb bleibt die
  Rempler- und Bahnwechsel-Dichte je Läufer dieselbe.
- In `bauSpurt()` liegen die Seiten als Liste vor (`seitenListen`). Läufer i von Team s läuft auf
  Bahn `i*N+s`. Die Beinzahl der Staffel gilt je Team, die Startfolge des Zeitfahrens heißt
  `idx*N+s`.
- `stepSpurt()` schreibt den Staffel-Verlaufspuffer je Seite. `staffelBilanz()` hat einen
  Namensrückfall für Seite 2/3. Das ist nur Tickertext; vorher brach hier der Vier-Team-Lauf ab.
- Alles Übrige war schon seitenneutral: Rezepte, Fallen, „jeder gegen jeden"-Rempler
  (`tackleAlleSeiten`), Gedränge, Wechsel und `MOTOREN[bd].wert()`.

**Neue Einstiege**, alle stumm und headless (die sichtbare Vier-Team-Anzeige kam am 02.11. dazu,
Abschnitt 6.6):

| Einstieg | Zweck |
|---|---|
| `__arena.spieleBahnPod(bd, teams, saat, platzJeTeam, {formSaat})` | Produktionsform, gebaut wie `miniDmFfaEvent`. Liefert `teams[s] = {side, wert, zielzeit, eventPlatz, ligaPunkte}` (2-1-0-0, Gleichstand teilt) und einen Boxscore je Läufer mit `side`. Der Boxscore-Wert ist derselbe wie bei `spieleBahn()` im Duell. |
| `__arena.bahnPodSonde(bd, kader, {gruppen, n, versatz, jeSeite})` | Rangtreue-Sonde mit denselben Größen wie `disziplinProbe` (eig ohne Mutator gegen `wert()`, Formkarten je Rennen für alle Teams, Mutatoren je Spiel). |
| `__arena.bahnPodEinfluss(bd, extraTeams, n, plus, versatz)` | Pp-Sonde, rechnet wie `einflussVon`. Gemessen werden die zwölf Personen aus SQUAD/OPP, zwei weitere Teams stellen das Feld. |

So wird ein Pod gewertet:
- **Takeshi:** Summe der Burgpunkte je Team, wie im Duell.
- **Staffel:** Rangfolge der Zieleinläufe der vier Mannschaften. Ein Team ohne Ziel liegt hinten,
  kam in der Messung aber nie vor.
- **Punkte:** Die Tabelle 2-1-0-0 übernimmt `bahnPodLauf()` von Mini-DM (`MINI_DM_FFA_LIGAPUNKTE`).

Nur `takeshis-castle` und `staffel` sind freigegeben (`BAHN_POD_DISZIPLINEN`); andere Bahnen werfen
einen Fehler.

## 2. Das Duell bleibt bit-identisch

Staffel ist mit rho 0,937 die bestabgenommene Disziplin des Spiels. Geprüft wurde dreifach:

1. `tests/bahn-pod-vier-teams.test.ts` hält sha256-Fingerabdrücke von `spieleBahn(bd, saat)` für
   alle fünf Bahnen und fünf Saaten. Gezogen sind sie am Engine-Stand **vor** dem Umbau (Commit
   `7af8e7e1`) und nach dem Umbau unverändert.
2. Ein Vorher/Nachher-Abgleich über `disziplinProbe` (Kader-Familie, alle fünf Bahnen) und
   `spieleBahn` mit Zahl- und Textsaaten ergab byte-identisches JSON.
3. Ein Pod-Lauf hinterlässt nichts im Duell-Zustand: Aufstellung, Persönlichkeiten, Formkarten und
   Bahnzahl stehen danach wieder wie vorher (eigener Test).

## 3. Abnahme im Vier-Team-Format

Werkzeug: `scripts/miss-bahn-pod-abnahme.mjs <disziplin> [spiele] [--je-seite=2..6] [--kontrolle] [--pp[=n]] [--nur-pp] [--stroeme=a,b]`.

- **Kader:** fest, die zehn echten Teams der Kader-Familie. Alle C(10,4) = 210 Vierergruppen
  laufen, zwei Saatströme.
- **Messgröße:** rho je Rennen über alle 4×k Läufer, gemittelt je Gruppe, davon der Median über
  die 210 Gruppen. Im Duell ist es der Median über fünf Paarungen.
- **Kontrolle:** `--kontrolle` fährt dieselbe Sonde mit N = 2 auf den fünf Familienpaarungen.

### Rangtreue (rho je Rennen, Median über 210 Gruppen, Strom 0 / 10 000 000)

| Disziplin | k = 2 | 3 | 4 | 5 | 6 | Duell-Abnahme (16.10.) |
|---|---:|---:|---:|---:|---:|---:|
| Takeshi's Castle | 0,855 / 0,860 | 0,865 / 0,862 | 0,845 / 0,853 | 0,883 / 0,879 | 0,889 / 0,887 | 0,898 |
| Staffel | 0,881 / 0,877 | 0,909 / 0,904 | 0,881 / 0,887 | 0,889 / 0,886 | 0,878 / 0,881 | 0,937 |

(k = 2..5 mit 6 Rennen je Gruppe, k = 6 siehe Abschnitt 3.1.)

**Beide liegen bei jeder Kadergröße über 0,80, fast überall über 0,85.**

### 3.1 Kontrolle mit derselben Sonde (k = 6)

Dieselbe Sonde (`bahnPodSonde`, 6 Rennen je Gruppe) mit N = 2 auf den fünf Familienpaarungen,
gefahren am 01.11. abends mit `--kontrolle`:

| | Duell, N = 2 (5 Paarungen) | Pod, N = 4 (210 Gruppen) |
|---|---:|---:|
| Takeshi rho je Rennen (Strom 0 / 10 000 000) | 0,875 / 0,884 | 0,889 / 0,887 |
| Staffel rho je Rennen | 0,847 / 0,876 | 0,878 / 0,881 |
| Takeshi Star auf Rang 1 / unter den ersten zwei | 80,0 / 96,7 % · 76,7 / 96,7 % | 79,5 / 95,1 % · 80,9 / 94,0 % |
| Staffel Star auf Rang 1 / unter den ersten zwei | 83,3 / 90,0 % · 73,3 / 83,3 % | 68,8 / 90,8 % · 69,4 / 91,6 % |
| Gruppen unter 0,80 (Takeshi / Staffel) | 0/5 · 2/5 | 1/210 · 15/210 bzw. 12/210 |

**Mit derselben Sonde ist der Pod bei beiden Disziplinen nicht schlechter als das Duell.**
Dass die Kontrolle unter der Duell-Abnahme vom 16.10. liegt (0,898 / 0,937), liegt an der Sonde,
nicht an der Mechanik: 6 statt 24 Rennen je Paarung, Formkarten und Mutatoren je Rennen gezogen.
Gegengeprüft: `scripts/miss-alle-disziplinen.mjs 24 staffel takeshis-castle` liefert am Engine-Stand
mit dem Umbau byte-identisch dieselbe Ausgabe wie am Stand `1e207cec` ohne Umbau (0,937 / 0,898).

Die Zahlen sind reproduzierbar: die k = 6-Zeile in der Tabelle oben kam bei einem zweiten,
unabhängigen Lauf auf die dritte Nachkommastelle gleich heraus.

### 3.2 Die ehrlicheren Abnahmen (k = 6, Strom 0)

| | Takeshi Pod | Staffel Pod |
|---|---:|---:|
| Star (höchste Eignung im Rennen) auf Rang 1 von 24 | 79,5 % | 68,8 % |
| Star unter den ersten zwei | 95,1 % | 90,8 % |
| Star auf dem letzten Rang | 0 % | 0 % |
| Paare ab 15 Eignungspunkten Abstand richtig geordnet | 99,6 % | 99,6 % |
| Team-rho (Teameignung gegen Platz) | 0,79 | 0,87 |
| Eignungsstärkstes Team gewinnt den Pod | 72 % | 90 % |
| Laufzeit je Rennen, headless | ~56 ms | ~15 ms |

Das Performance-Risiko aus der Takeshi-Diagnose vom 13.10. betrifft die Zeichnung, nicht die
Simulation: 24 Läufer simulieren headless in etwa 56 ms.

### 3.3 Pp-Abweichung (Budget-Methode)

`--nur-pp --pp=<n>`, Hebung +15, Mutatoren je Lauf, zwei Saatströme. Zum Vergleich das Duell mit
`scripts/messe-arena-einfluss.mjs` am selben Engine-Stand.

| | Duell (einflussVon) | Pod n = 48 | Pod n = 96 |
|---|---:|---:|---:|
| Takeshi (Strom 0 / 10 000 000) | 18,9 / 17,7 (n = 48) | 13,5 / **26,5** | 13,3 / **26,2** |
| Staffel | 20,9 / 21,6 (n = 96) | 22,8 / 24,9 | 25,0 / **25,3** |

Schranke: ≤ 25 in beiden Strömen.

- **Takeshi verfehlt sie im Strom 10 000 000 um gut 1 Pp**, und zwar stabil: n = 96 bestätigt
  n = 48. Das ist also kein Stichprobenrauschen. Muster in diesem Strom: Stamina, Health und
  Speed (Matrix 6/4/4) tragen fast nichts (0,7 / 0,4 / 0 %), Will, Determination und Charisma
  bekommen den Rest (22 / 20 / 18 % statt 22 / 18 / 14). Im Strom 0 ist der Pod mit 13,3 dagegen
  näher an der Matrix als das Duell.
- **Staffel liegt genau auf der Schranke.** Mit n = 48 besteht sie (22,8 / 24,9), mit n = 96 steht
  sie bei 25,0 / 25,3. Gegenüber dem Duell kostet der Pod 3–4 Pp: Speed trägt etwas mehr
  (29 % statt 28, Matrix 24), Charisma bleibt wie im Duell zu leicht (4 % statt 10).

Am Rezept wurde dafür bewusst nichts geändert. Jede Rezeptänderung verschiebt auch das Duell, und
das Duell ist abgenommen (Staffel 0,937, die beste Zahl im Spiel). Ob der Pod mit diesen Pp-Werten
in die Liga darf, entscheidet Chris; s. Abschnitt 4.

**Überholt am 02.11.:** Chris wollte keine Ausnahme, sondern eine Mechanik, die die Attribute
anspricht. Die Anpassung wirkt nur im Pod, das Duell bleibt unberührt. Neue Zahlen: Abschnitt 5.

### 3.4 Messfehler im Skript, behoben

Der erste Staffel-Pp-Lauf blieb hängen: nach einigen Minuten war der Renderer tot
(„Target page, context or browser has been closed“), der Prozess wartete danach ohne CPU-Last.
Ursache war das Messskript, nicht der Motor. Es fehlten die zwei Schutzmaßnahmen aus
`messe-arena-einfluss.mjs`: kein AudioContext und `setTimeout` als No-Op während des langen
synchronen Aufrufs. Ohne sie stapeln sich Audio-Knoten und Timer, bis der Speicher ausgeht.
`spieleBahnPod` selbst leckt nicht: 200 Läufe hintereinander ergaben gleich viele DOM-Knoten,
gleichen Heap und gleiche Laufzeit je Lauf. Beides ist jetzt in `miss-bahn-pod-abnahme.mjs`
eingebaut. Die Werte ändern sich dadurch nicht: Takeshi Strom 10 000 000 kam vorher und nachher
mit 26,5 heraus.

## 4. Was noch fehlte, bis Takeshi/Staffel in der Liga als Pod laufen (erledigt 02.11.)

**Alles aus diesem Abschnitt ist umgesetzt, s. Abschnitt 6.** Der Text bleibt als Plan stehen.

**Zwei Fragen an Chris, bevor die Kette gebaut wird:**

1. ~~**Pp-Abnahme.**~~ **Erledigt am 02.11.** Chris' Antwort war: keine Ausnahme, sondern die
   Mechanik anpassen („die stats die vorgegeben sind sind verdammt wichtig, kannst du die
   benötigten sachen nicht anpassen dass es mehr unsere attribute anspricht? dann würde ich das
   freigeben"). Das ist umgesetzt, beide bestehen (Abschnitt 5).
2. ~~**Live-Bühne.**~~ **Erledigt am 02.11.:** Chris wollte das echte Vier-Team-Rennen, keinen
   Hinweis. Die Arena zeigt es mit Zeichnung, HUD und Farben für vier Seiten (Abschnitt 6.6).

Bewusst **nicht** in diesem Schritt, weil jede Hälfte allein das Spiel verschlechtert:

- **Takeshi oder Staffel nur in `VIERER_POD_DISCIPLINE_IDS` eintragen** würde sie heute über den
  **PPS-Pod** werten, also über den Eignungs-Score statt über den abgenommenen Motor. Grund: der Pod
  hat seit `1dcf3823` Vorrang vor dem Arena-Duell. Das ist genau der Rückschritt, den das Konzept
  ausschließt.
- **Die Live-Bühne** spielt Takeshi/Staffel als Zwei-Team-Rennen gegen den Fixture-Gegner. Beide
  stehen in `ARENA_RESOLVED_DISCIPLINE_IDS`, der Arena-Host spielt sie. Bucht die Liga einen Pod,
  sähe Chris ein Rennen, dessen Ergebnis nicht zur Buchung passt. Das ist dieselbe Fehlerklasse wie
  sein Befund „0:2 bei 4 Teams" vom 19.10.

Die Kette, nach dem Muster der Mini-DM-PRs 4–6:

1. **Runner:** `runBahnPodFixtures()` in `lib/battle/arena-headless-runner.ts`, nach dem Muster von
   `runMiniDmFfaPodFixtures()`. Er ruft `__arena.spieleBahnPod` mit `formSaat = pod.seed` und
   `buildArenaAufstellung` je Team auf.
2. **Spieltag:** `lib/resolve/bahn-pod-matchday.ts`, nach dem Muster von `runMiniDmFfaMatchday()`.
   Pods kommen aus `getPodsForMatchday(..., disciplineId)`, k aus dem Spielplan-Slot, die Teilnahme
   aus der Aufstellung.
3. **Wertung:** ein Rohdaten-Vorrang in `berechneMiniDmPodOverrides()`. Heute ist er
   Mini-DM-exklusiv (`miniDmFfaPodRohdatenByDisciplineId`). Neu käme ein Bahn-Zweig hinzu:
   Platz aus `eventPlatz` des Motors statt aus dem PPS-Score, `wert` über
   `berechneErgebnisNormiertNTeam`.
4. **Referenzen:** neue Referenzen für die vier Bahnen. Das ist m90 der Burgpunkte- bzw.
   Zielzeit-Lücke und Spieler-PP p50/p995 aus dem Boxscore, gezogen wie
   `ziehe-mini-dm-ffa-referenz.mjs`.
5. **Vorlauf:** Anbindung in `lib/battle/arena-vorlauf-service.ts` hinter einem eigenen
   Rollout-Schalter, analog `MINI_DM_FFA_VORLAUF_AKTIV`. Dazu muss das Zweier-Duell für diese
   Disziplin an Pod-Tagen aus `kandidaten` heraus.
6. **Anzeige:** die Live-Bühne zeigt den Vier-Team-Lauf. Das heißt HUD, Farben je Seite und
   `VEREIN[2/3]`; die Zeichnung kennt heute nur zwei Seiten. Übergangsweise ginge ein Hinweis wie
   bei Battlefield („wird als 4-Team-Gruppe gewertet"), dann ohne Zwei-Team-Rennen.
7. Erst danach Takeshi/Staffel in `VIERER_POD_DISCIPLINE_IDS` eintragen und
   `tests/vierer-pod-battlefield.test.ts` entsprechend erweitern.

## 5. Pp-Pflichtprüfung über die Mechanik (02.11.)

Auftrag nach Chris' Antwort auf Frage 1: keine Pp-Ausnahme, sondern die Mechanik so anpassen, dass
sie die Matrixattribute anspricht (Budget-Methode, CLAUDE.md). Drei harte Grenzen galten dabei:

- Die Matrix (`official-discipline-weights.ts`) bleibt unberührt.
- Das Duell bleibt bit-identisch.
- rho im Pod bleibt über 0,80.

Beide Eingriffe greifen deshalb **nur bei gesetztem `bahnPodKader`**, also in `spieleBahnPod`,
`bahnPodSonde` und `bahnPodEinfluss`.

### 5.0 Woher die Abweichung im Pod kam

Die zwei Disziplinen haben **verschiedene Ursachen**. Für die Diagnose wurde zuerst das Duell mit
`messe-arena-einfluss.mjs` daneben gemessen, am selben Engine-Stand und ebenfalls mit n = 48.

| Attribut (Matrix) | Staffel Duell, Strom 0 / 10 Mio. | Staffel Pod, Strom 0 / 10 Mio. |
|---|---:|---:|
| Speed (24) | 27,9 / 29,2 | 28,4 / 29,9 |
| Awareness (12) | 14,8 / 14,3 | 15,1 / 14,8 |
| Dexterity (8) | 11,3 / 10,6 | 11,5 / 11,4 |
| Charisma (10) | 4,2 / 3,3 | 4,2 / 4,4 |
| Health (2) | 0 / 0 | 0 / 0 |
| **Pp** | **20,0 / 22,1** | **22,8 / 24,9** |

- **Staffel: Der Pod hat nichts verzerrt.** Zwischen den Mannschaften gibt es in der Staffel keine
  Wechselwirkung: kein Rempler, kein Windschatten, eigene Bahnen. Der Wert je Läufer (Etappenzeit
  plus Wechselkonto) hängt nicht an der Feldgröße. Deshalb zeigt der Pod dieselben Ausreißer wie das
  Duell. Er liegt nur durch andere Saaten und Formkarten etwas näher an der Schranke. Die Ursache
  sitzt also im Rezept. Ohne das Duell anzufassen, lässt sie sich nur mit einem eigenen Pod-Rezept
  beheben (5.1).
- **Takeshi: Das Gedränge war die Ursache, und es ist pod-spezifisch.** Im Strom 10 Mio. lasen
  Stamina, Health und Speed (Matrix 6/4/4) im Pod 0,7 / 0,4 / 0 %. Das Gedränge an der Falle zählt
  alle Läufer im Umkreis von ±2,5 % der Strecke, und zwar nach Streckenposition, nicht nach Bahn.
  Mit 24 statt 12 Läufern verdoppelt sich der Pulk an jeder Falle. Wer schneller läuft, läuft
  öfter in den Pulk, und so frisst der Pulk-Preis den Tempo-Kanal.

  Geprüft wurde einzeln, im Strom 10 Mio. bei n = 48:

  | Variante | Pp |
  |---|---:|
  | Ohne Eingriff | 26,5 |
  | Nur Pulk auf Duell-Dichte (x 2/N) | **16,3** |
  | Nur Zielbonus auf Duell-Skala (x 2/N) | 28,1 |
  | Beides | 18,2 |

  Der Zielbonus hat im 24er-Feld ebenfalls die doppelte Spannweite, ist aber nicht die Ursache.
  Er bleibt deshalb unverändert, und der Boxscore-Wert bleibt die Duell-Formel.

### 5.1 Staffel: Pod-Rezept (`BAHN_ART.staffel.podRezept`)

**Das Modell.** Unter „Menge aus der Eignung“ (`f = eig / Mittel der sieben Sub-Skills`, bauSpurt)
reicht die Matrix jedes Attribut über `eig` durch. Hätten alle sieben Sub-Skills dieselbe Wirkung,
käme exakt die Matrix heraus. Ein Attribut weicht nur ab, wenn es in einem Sub-Skill sitzt, der mehr
oder weniger trägt als der Schnitt der sieben:

    Anteil(a) ≈ Matrix(a) + Summe_k (p_k − 1/7) × Rezept(k, a)

Dabei ist p_k der Wirkungsanteil des Sub-Skills k. Ein Attribut, das in keinem Sub-Skill steht,
bekommt genau sein Matrixgewicht.

**Die Schätzung.** Aus den vier Messungen oben (Duell und Pod, je zwei Ströme) ergibt sich für
p_k − 1/7 ungefähr:

| Sub-Skill | ANTRITT | ENDTEMPO | TECHNIK | WENDIGKEIT | STEHEN | WUCHT | ROBUST |
|---|---:|---:|---:|---:|---:|---:|---:|
| p_k − 1/7 | +0,18…0,28 | +0,04 | ≈ 0 | −0,04…+0,06 | ≈ 0 | −0,09…−0,17 | −0,11 |

Der Antritt trägt also weit über dem Schnitt, WUCHT und ROBUST fast nichts. Damit lassen sich die
Ausreißer erklären:

- **Charisma** saß zu einem Drittel in WUCHT. Das ergibt −5,5 Pp.
- **Health** saß nur in ROBUST. Das ergibt −2,8 Pp.
- **Speed** saß zu 28 % im starken ANTRITT. Das ergibt +5 Pp.

**Die Gegenprobe.** Der naheliegende erste Versuch scheiterte, und das bestätigt das Modell: mehr
Charisma im Wechsel (TECHNIK aw 30 / dex 24 / cha 46) ergab Pp 26,2 / 29,5, Charisma *fiel* auf
3,5 / 2,7 %. TECHNIK trägt etwa den Schnitt, also bewegt eine Umschichtung innerhalb von TECHNIK
nichts. Sie erhöht aber Charismas Gewicht im Nenner `f`.

**Die drei Eingriffe**, jeder an einem Sub-Skill, die übrigen vier bleiben wie im Duell:

| Sub-Skill | Duell (`rezept`) | Pod (`podRezept`) |
|---|---|---|
| ANTRITT | speed 28, spirit 34, dex 20, aw 18 | speed 26, spirit 32, dex 14, aw 16, **charisma 12** |
| WUCHT („Zug an der Spitze“) | spirit 45, charisma 33, speed 22 | spirit 45, **speed 55** |
| ROBUST („Verlässlichkeit“) | stamina 30, will 26, health 24, spirit 20 | stamina 30, **dex 26, aw 24**, spirit 20 |

Zur Sache: Wer vorne zieht, braucht Beine und Haltung. Verlässlich ist, wer sauber läuft und den
Stab sicher hält. Der fliegende Start in der Wechselzone geht auf Zuruf los. Health und Will kommen
im Pod voll aus der Matrix über `eig`, statt gedämpft aus einem Sub-Skill, der kaum trägt.

Gemessene Zwischenstufen (n = 48, Strom 0 / 10 Mio.):

| Variante | Pp | rho k = 6 |
|---|---:|---:|
| Duell-Rezept | 22,8 / 24,9 | 0,878 / 0,881 |
| WUCHT spirit/speed, ROBUST mit Awareness statt Health | 15,1 / 12,4 | — |
| zusätzlich ROBUST Dexterity statt Will | 11,1 / 10,6 | 0,917 / 0,915 |
| **zusätzlich ANTRITT mit Charisma 12 (gewählt)** | **9,3 / 10,1** | **0,910 / 0,911** |

Gewählt wurde die letzte Stufe. Sie bringt Charisma auf die Matrix (11,4 statt 6,5 %) und kostet
gegenüber der Vorstufe nur 0,005 rho.

### 5.2 Takeshi: Pod-Dichte im Gedränge

`pulk = andere × 2/N` statt `andere` (stepSpurt, Gedränge-Block). Der Engpass an der Falle wird im
Pod so viel breiter wie die Bahn. Das ist dieselbe Regel, nach der `BAHNEN_N` schon mitwächst, und
sie war im Umbau vom 01.11. am Gedränge vergessen worden. Kein `rr()`-Aufruf ändert sich. Im Duell
ist N = 2, der Faktor also 1.

**Zusätzlich verworfen:** ein Takeshi-Pod-Rezept nach dem Staffel-Modell. TECHNIK mit weniger
Intelligence, WUCHT mit Speed 12, ROBUST mit Stamina 20 ergab Pp 29,9 / 12,8. Bei Takeshi stehen
Will und Determination in sechs von sieben Sub-Skills, deshalb ist das Modell dort schlecht
bestimmt; die Schätzungen der p_k kippen zwischen den Strömen. Das passt zu den älteren Befunden
(`bahn-takeshi-pp-paket2-kalibrierung-01-10.md`). Takeshi bleibt beim Duell-Rezept.

### 5.3 Abnahme (Engine-Stand mit beiden Eingriffen)

**Pp-Abweichung** (`miss-bahn-pod-abnahme.mjs --nur-pp`, Schranke ≤ 25):

| | n = 48, Strom 0 / 10 Mio. | n = 48, Strom 20 Mio. / 30 Mio. | n = 96, Strom 0 / 10 Mio. | vorher (n = 48 / 96) |
|---|---:|---:|---:|---:|
| Takeshi | **18,9 / 16,3** | 16,6 / 18,7 | **22,0 / 13,5** | 13,5 / 26,5 · 13,3 / 26,2 |
| Staffel | **9,3 / 10,1** | 11,2 / 9,8 | **9,3 / 9,7** | 22,8 / 24,9 · 25,0 / 25,3 |
| Duell zum Vergleich (`einflussVon`, n = 48) | Takeshi 18,9 / 17,7, Staffel 20,0 / 22,1 | | | |

Takeshi liegt im Pod jetzt auf der Höhe des abgenommenen Duells. Die Staffel liegt im Pod sogar
deutlich unter dem Duell.

**Rangtreue** (rho je Rennen, Median über 210 Gruppen, 6 Rennen je Gruppe, Strom 0 / 10 Mio.):

| Disziplin | k = 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|
| Takeshi, nachher | 0,867 / 0,849 | 0,854 / 0,853 | 0,844 / 0,839 | 0,870 / 0,873 | 0,881 / 0,882 |
| Takeshi, vorher | 0,855 / 0,860 | 0,865 / 0,862 | 0,845 / 0,853 | 0,883 / 0,879 | 0,889 / 0,887 |
| Staffel, nachher | 0,905 / 0,909 | 0,916 / 0,921 | 0,924 / 0,927 | 0,913 / 0,911 | 0,910 / 0,911 |
| Staffel, vorher | 0,881 / 0,877 | 0,909 / 0,904 | 0,881 / 0,887 | 0,889 / 0,886 | 0,878 / 0,881 |

Weitere Kennzahlen bei k = 6, Strom 0 / 10 Mio.:

| | Takeshi nachher (vorher) | Staffel nachher (vorher) |
|---|---|---|
| Star auf Rang 1 | 80,1 / 79,7 % (79,5 / 80,9) | 69,2 / 71,5 % (68,8 / 69,4) |
| Star unter den ersten zwei | 94,3 / 94,8 % (95,1 / 94,0) | 91,8 / 91,2 % (90,8 / 91,6) |
| Paare ab 15 Punkten richtig | 99,5 / 99,6 % | 99,9 / 99,9 % |
| Team-rho | 0,77 / 0,78 (0,79) | 0,91 / 0,91 (0,87) |
| Eignungsstärkstes Team gewinnt | 69 / 70 % (72) | 86 / 86 % (90) |
| Gruppen unter 0,80 | 5 / 3 (1 / 1) | 0 / 0 (15 / 12) |

**Was es kostet:**

- **Takeshi:** Das Gedränge belohnte über `max(WUCHT, TECHNIK)` Attribute, die mit der Eignung
  korrelieren. Mit halbem Pulk kostet das rund 0,01 rho bei k = 3..6. k = 4 liegt jetzt bei
  0,844 / 0,839, also unter den angestrebten 0,85, aber klar über der Pflicht von 0,80. Die
  Star-Treue bleibt gleich.
- **Staffel:** Gewinnt überall, nur „eignungsstärkstes Team gewinnt" sinkt von 90 auf 86 %.

**Das Duell ist unverändert:**

- `miss-alle-disziplinen.mjs 24 staffel takeshis-castle` liefert nach beiden Eingriffen
  0,937 / 0,898. Das ist dieselbe Ausgabe wie vorher.
- `tests/bahn-pod-vier-teams.test.ts`: Die Duell-Fingerabdrücke aller fünf Bahnen sind
  unverändert. Neu sind zwei Pod-Fingerabdrücke, die den abgenommenen Pod-Stand festhalten.
- Das Staffel-Duell nach `einflussVon` liegt weiter bei 20,0.

Ein Hinweis zu `--kontrolle`: Auch der Lauf mit N = 2 setzt `bahnPodKader`, er misst also das
Pod-Rezept mit zwei Teams. Das echte Duell (`spieleBahn`, `disziplinProbe`) setzt `bahnPodKader`
nie.

### 5.4 Was weiter offen ist

- ~~**`VIERER_POD_DISCIPLINE_IDS` bleibt bewusst ohne Takeshi und Staffel.**~~ **Erledigt am
  02.11., Abschnitt 6.** Der folgende Absatz ist der Stand vor der Verdrahtung. Mit Abschnitt 5 ist nur
  die Pp-Frage erledigt. Der Grund aus Abschnitt 4 gilt unverändert, nachgeprüft am 02.11. in
  `legacy-matchday-resolve-engine.ts`: Ein Eintrag würde beide heute über den **PPS-Pod**
  (Eignungs-Score) buchen statt über diesen Motor. Der Motor-Vorrang im Pod-Resolve ist weiterhin
  Mini-DM-exklusiv. Die Live-Bühne spielte außerdem weiter ein Zwei-Team-Rennen gegen den
  Fixture-Gegner; die neue Vier-Team-Anzeige im Arena-Host gilt nur für Battlefield. Frage 2 an
  Chris (Live-Bühne) und die Kette 1–6 aus Abschnitt 4 stehen also noch aus.
- **Folgefrage, nicht in dieser Runde: das Duell-Rezept der Staffel.** Das Duell hat dieselben drei
  Ausreißer (Pp 20,0 / 22,1). Dasselbe Rezept global gesetzt würde dort vermutlich ähnlich viel
  bringen, verschiebt aber die abgenommenen 0,937. Das braucht eine eigene Duell-Messung und
  Chris' Entscheidung. Solange beide Rezepte gelten, laufen dieselben Spieler in Duell und Pod mit
  leicht anderen Sub-Skills.

## 6. Verdrahtung in die Liga (02.11.)

Chris' Auftrag vom 02.11.: Takeshi's Castle und Staffel vollständig als Vier-Team-Disziplin in die
Liga — gebucht wird das **echte Rennen**, nicht ein Eignungs-Score, und die Arena zeigt dieses
Rennen. Vorbild war die Mini-DM-Kette (PR 4–6), mit einem Unterschied: Mini-DM und Battlefield buchen
(teils) über den PPS-Pod, Takeshi/Staffel buchen den Motor, weil er im Vier-Team-Format beide
Pflichtprüfungen ohne Ausnahme besteht (Abschnitt 5.3).

### 6.1 Die Kette

| Glied | Ort | Was es tut |
|---|---|---|
| Motor | `spieleBahnPod(bd, teams, saat, platzJeTeam, {formSaat, k})` | Neu: `optionen.k`. Ein Team ohne Aufstellung läuft mit den besten k statt sechs (`bahnPodJeTeam`). Mit Aufstellung zählt, wen der Manager gesetzt hat. |
| Runner | `runBahnPodFixtures()` in `lib/battle/arena-headless-runner.ts` | Gebaut nach `runMiniDmFfaPodFixtures()`: ein Chromium je Batch, vier Kader als Argumente, je Team `buildArenaAufstellung()`, `formSaat` = Pod-Saat. Ein Pod mit leerem Kader liefert `null` an seiner Position. |
| Saat | `buildBahnPodMatchSeed()` in `lib/battle/arena-seed.ts` | `save:saison:spieltag:arena:<bd>-pod:<podId>`. Wertungssaat, Runner und Arena-Host bauen sie gleich. |
| Spieltag | `runBahnPodMatchday()` in `lib/resolve/bahn-pod-matchday.ts` | Pods kommen aus `getPodsForMatchday(..., bd)`, also aus derselben Quelle wie Spielplan, Resolve und Anzeige. k kommt aus dem Spielplan-Slot. Die Strukturprüfung (`pruefeBahnPodErgebnis`) verwirft ein kaputtes Pod-Ergebnis einzeln. Die Spieler-PP kommen aus dem Boxscore. |
| Buchung | `berechneBahnPodOverrides()` in `lib/resolve/bahn-pod-resolve.ts` | Platz aus dem Rennen (`eventPlatz`). Bei Gleichstand entscheidet der PPS-Score, dann die Team-ID, damit 2-1-0-0 strikt bleibt. `quelle: "bahn"`, `teamWert` (Burgpunkte bzw. Zielzeit). 0–10-Wert über `berechneErgebnisNormiertNTeam` mit m90 je k, Niveau aus dem PPS-Score (wie im Duell dieser beiden Disziplinen). |
| Engine | `legacy-matchday-resolve-engine.ts` | Bahn-Pods mit Rohdaten werden zuerst über das Rennen gebucht. Die übrigen Pods gehen an `berechneMiniDmPodOverrides()` (PPS-Pod). Der Pod schlägt ein Zweier-Duell. Rennzeilen tragen keinen `arenaAusfall`. Spieler-PP aus dem Rennen gelten wie bei Arena und Mini-DM-FFA (`istMotorPodQuelle`). |
| Ledger | `season-points-ledger.ts` | `quelle: "bahn"` vertraut dem persistierten Boxscore-PP-Wert (`battle_mode_bahn_pod_player_score`). |
| Referenzen | `data/generated/bahn-pod-referenz.json` | Gezogen mit `scripts/ziehe-bahn-pod-referenz.mjs`. Je Disziplin und k: m90 der Teamwert-Lücken und p50/p99,5 des Läuferwerts. Kaderfest, 210 Gruppen × 4 Rennen × 2 Saatströme = 1680 Rennen je k. |
| Vorlauf | `lib/battle/arena-vorlauf-service.ts` | An einem Spieltag **mit** Pods (`teileBahnPodDisziplinenAb()`) läuft die Disziplin als Rennen statt als Duell. Es gelten derselbe Semaphor und dieselbe Wiederholung wie bei Mini-DM. Der Eingabe-Hash ist `berechneBahnPodEingabeHash()` (`format: "bahn_pod"`), beim Buchen wird er neu geprüft. **Ohne** Pods (Liga nicht durch 4 teilbar) bleibt es beim Duell. |
| Schalter | `BAHN_POD_VORLAUF_AKTIV` / `OLY_BAHN_POD_VORLAUF=aus` | Notschalter wie bei Mini-DM (`.env`, dann `docker compose up -d`). Abgeschaltet fallen die Pods auf den PPS-Pod zurück. Das Duell kommt damit nicht zurück, weil der Pod Vorrang hat. |
| Anzeige | `echterKader.bahnPodByDisciplineId` (Host) → `bahnPodAnzeige` (Motor) | Abschnitt 6.6. |
| Liste | `VIERER_POD_DISCIPLINE_IDS` | Jetzt `mini-dm`, `battlefield`, `takeshis-castle`, `staffel`. |

**Ausfall:** Liefert das Rennen nichts (Chromium-Absturz, Timeout, kein gültiger Pod), setzt der
Vorlauf `arenaAusfall` für die Disziplin. Die Pods werden dann als PPS-Pod gebucht, sichtbar markiert
(`arena_ausgefallen:…`, Arena-Hinweis „Rennen fiel aus — als 4-Team-Gruppe per Eignungs-Score
gewertet"). Kein Spieltag bleibt ungebucht.

### 6.2 Referenzen (gezogen 02.11.)

`node scripts/ziehe-bahn-pod-referenz.mjs 4`, Kader-Familie, ohne Mutator, je k 1680 Rennen:

| k | Takeshi m90 (Burgpunkte) | Takeshi Läufer p50 / p99,5 | Staffel m90 (s) | Staffel Läufer p50 / p99,5 |
|---:|---:|---:|---:|---:|
| 2 | 11,2 | 12,7 / 25,8 | 1,48 | 4,5 / 8 |
| 3 | 16,6 | 12,3 / 27,7 | 1,43 | 6,5 / 12 |
| 4 | 21,4 | 12,5 / 29,6 | 1,20 | 8,5 / 16 |
| 5 | 28,2 | 12,7 / 31,2 | 1,07 | 10,5 / 20 |
| 6 | 35,8 | 13,0 / 33,1 | 1,03 | 12,5 / 24 |

Die Staffel-Läuferwerte sind Rangpunkte N..1 über alle 4k Läufer. Deshalb liegt p99,5 genau bei
4k: wer die schnellste Etappe läuft, bekommt die vollen Spieler-PP. Takeshi-Burgpunkte wachsen kaum
mit k, der Zielbonus nach Platz verbreitert nur den oberen Rand.

### 6.3 Liga-Abnahme über den Produktionspfad

`scripts/miss-bahn-pod-liga-abnahme.ts --spieltage=2` (Ergebnis in
`data/generated/bahn-pod-liga-abnahme.json`). Das Skript ist das Gegenstück zur Battlefield-Liga-Abnahme,
nur mit dem echten Motor. Es baut einen frischen Battle-Save mit Liga-Split. Je Spieltag laufen
**D1 = Staffel (k) und D2 = Takeshi (k)**, dazu echte KI-Aufstellung, echtes Chromium über
`runBahnPodMatchday()` und die echte Resolve-Engine mit den Rennrohdaten. Gemessen wird für k = 2..6,
zwei disjunkte Spieltagsfenster, je 16 Pods pro Zelle. Ein Rennen braucht rund 5 s je Disziplin und
Spieltag (8 Pods).

**Struktur, in jeder Zelle:** 64/64 Zeilen mit `quelle: "bahn"` gebucht, jeder Pod mit Punktesumme 3.

| Disziplin | k | rho Pod (Median, Fenster 0 / 1) | Star Rang 1 | Star unter den ersten zwei | Paare ab 15 richtig | Team-rho (Eignung gegen Platz) | Sieger ≠ PPS-Pod-Sieger |
|---|---:|---:|---:|---:|---:|---:|---:|
| Takeshi | 2 | 0,85 / 0,82 | 62 % / 56 % | 81 % / 88 % | 100 % / 100 % | 0,70 / 0,65 | 25 % / 38 % |
| Takeshi | 3 | 0,83 / 0,81 | 81 % / 81 % | 94 % / 100 % | 100 % / 97 % | 0,59 / 0,60 | 31 % / 31 % |
| Takeshi | 4 | 0,76 / 0,80 | 62 % / 56 % | 81 % / 81 % | 98 % / 98 % | 0,75 / 0,56 | 38 % / 38 % |
| Takeshi | 5 | 0,83 / 0,86 | 62 % / 69 % | 81 % / 81 % | 97 % / 100 % | 0,82 / 0,69 | 31 % / 12 % |
| Takeshi | 6 | 0,88 / 0,84 | 62 % / 75 % | 88 % / 100 % | 99 % / 99 % | 0,66 / 0,81 | 12 % / 12 % |
| Staffel | 2 | 0,82 / 0,83 | 56 % / 50 % | 81 % / 81 % | 99 % / 98 % | 0,85 / 0,94 | 12 % / 12 % |
| Staffel | 3 | 0,88 / 0,89 | 56 % / 56 % | 81 % / 88 % | 98 % / 100 % | 0,91 / 0,96 | 38 % / 19 % |
| Staffel | 4 | 0,90 / 0,88 | 62 % / 69 % | 81 % / 88 % | 100 % / 98 % | 0,88 / 0,85 | 31 % / 31 % |
| Staffel | 5 | 0,85 / 0,86 | 62 % / 75 % | 88 % / 88 % | 97 % / 98 % | 0,86 / 0,86 | 44 % / 38 % |
| Staffel | 6 | 0,82 / 0,83 | 62 % / 75 % | 81 % / 75 % | 93 % / 93 % | 0,41 / 0,47 | 81 % / 62 % |

So liest sich die Tabelle:

- **rho je Pod** ist hier Spieler-Eignung (`baseValue` der Aufstellung) gegen die *gebuchten*
  Spieler-PP. Die PP-Kurve deckelt (Staffel: wer die schnellste Etappe läuft, hat die vollen
  5,5 PP), und `baseValue` ist nicht genau die Motor-Eignung. Deshalb liegt die Zahl etwas unter der
  kaderfesten Abnahme (Abschnitt 5.3, 0,84–0,93). Die meisten Zellen liegen trotzdem über 0,80.
  Darunter fällt nur Takeshi k = 4 mit 0,76 / 0,80, bei 16 Pods je Zelle. Paare ab 15 Punkten
  werden zu 93–100 % richtig geordnet, der Star landet zu 75–100 % unter den ersten zwei.
- **Sieger ≠ PPS-Pod-Sieger** (12–81 %) zeigt, dass wirklich das Rennen bucht und nicht der
  Eignungs-Score. Battlefield als PPS-Pod hätte hier per Konstruktion 0 %.
- **Team-rho** ist bei Takeshi 0,56–0,82. Bei der Staffel liegt es bei k = 2..5 zwischen 0,85 und
  0,96, bei k = 6 nur bei 0,41 / 0,47. Diese Ausreißerzelle hat eine eigene Ursache:

**Befund: unterbesetzte Staffel gewinnt.** Steht an einem Spieltag D1 = Staffel 6 *und*
D2 = Takeshi 6, braucht ein Team 12 Spieler, und die KI verteilt jeden Spieler nur auf eine Seite.
Mehrere Teams laufen deshalb mit 2–5 statt 6 Läufern. Die Staffel teilt die Strecke nach den
tatsächlich aufgestellten Läufern (`staffelBeine` in bauSpurt, seit PR #1295, damit niemand bei 5/6
stehen bleibt). Ein Team mit zwei Läufern läuft also zwei lange Beine mit **einem** Wechsel statt
sechs kurzen mit fünf Wechseln, und das ist schneller. Diagnoselauf (Spieltag 1, k = 6): Von vier
Pods mit einem 2er- oder 3er-Team gewann dieses dreimal (8,3 s / 9,35 s / 9,7 s gegen
10,2–10,7 s der vollbesetzten). Bei k = 5 kam ein 3er-Team einmal auf Platz 2. Takeshi ist davon
nicht betroffen, dort zählt die Summe der Burgpunkte, und weniger Läufer heißen weniger Punkte.
**Das gilt genauso im Zweier-Duell** und ist keine Folge des Pods; im Pod fällt es nur mehr auf,
weil vier Teams mit verschiedener Besetzung gegeneinander laufen. Ein Manager könnte das sogar
ausnutzen, indem er absichtlich nur zwei Läufer setzt. Eine Lösung ist eine Regelentscheidung für
Chris, s. 6.7. Am Motor wurde dafür bewusst nichts geändert, das Duell ist abgenommen.

### 6.4 Echter End-to-End-Lauf über einen Test-Spielstand

`tests/bahn-pod-e2e-real-chromium.test.ts` fährt einen frischen Battle-Save (solo_1, Liga-Split,
echter Liga-Draft). Spieltag 1 hat **Staffel (D1) und Takeshi (D2)**, also zwei Pod-Disziplinen am
selben Tag mit je eigenen Gruppen. Danach laufen echte KI-Aufstellung, echter Vorlauf
(`stelleArenaVorlaufSicher`, echtes Chromium) und echter Apply (`kickoffArenaMatchdayApply`). Kein
Fake-Motor; der Runner wird nur mitgeschnitten. Geprüft:

- Vorlauf `ready`, beide Disziplinen `status: "arena"`, `format: "bahn_pod"`, ohne Teilwarnung. Für
  Staffel/Takeshi lief **kein** Zweier-Duell.
- Gebucht: je Disziplin 32 Zeilen (8 Pods × 4), alle `mini_dm_pod` mit `quelle: "bahn"`, ohne
  Ausfall-Marker. Je Pod genau 2-1-0-0.
- Der gebuchte Platz ist der Platz im Rennen. Bei eindeutigem `eventPlatz` gilt das exakt, bei
  Gleichstand ist die Reihenfolge nicht vertauscht.
- Der Tabellenbeitrag jedes Teams entspricht seinen Pod-Punkten. Die Spieler-PP stehen im Ledger
  als `battle_mode_bahn_pod_player_score` mit echten playerIds.

Laufzeit des Tests rund 210 s, der größte Teil ist der Liga-Draft. Der Vorlauf selbst braucht für
zwei Disziplinen à 8 Pods wenige Sekunden.

### 6.5 Das Duell bleibt unverändert

- `scripts/miss-alle-disziplinen.mjs 24 staffel takeshis-castle` liefert nach allen Änderungen
  **0,937 / 0,898**, wie vorher.
- `tests/bahn-pod-vier-teams.test.ts`: Duell-Fingerabdrücke aller fünf Bahnen und die zwei
  Pod-Fingerabdrücke des Kalibrierungsstands sind unverändert grün. `optionen.k` ist optional, ohne
  `k` rechnet der Pod wie vorher.
- `MOTOREN[bahn].sichern/vorher/zurueck` führen jetzt den Pod-Zustand mit (`bahnPodKader`,
  `bahnPodJeTeam`). Ein headless Lauf startet damit garantiert ohne Pod, auch wenn die Arena gerade
  ein Vier-Team-Rennen zeigt. Ein eigener Test vergleicht die Duell-Ergebnisse vor, während und
  nach einem sichtbaren Pod.

### 6.6 Die Anzeige: vier Teams auf der Strecke

Gibt es an einem Spieltag für das gewählte Heimteam einen Takeshi- oder Staffel-Pod, reicht
`FoundationBattleArenaHost.tsx` dem Motor `echterKader.bahnPodByDisciplineId[bd]` = {vier Kader in
Pod-Reihenfolge, k, Saat, Aufstellung je Team}. Das sind dieselben Eingaben wie beim zählenden Lauf.
`reset()` baut dann statt des Duells das Rennen der gebuchten Gruppe (`bahnPodAnzeigeBauen`). Der
Pod-Kader bleibt für das ganze sichtbare Rennen gesetzt, weil Bahnzahl, Gedränge und Pod-Rezept ihn
auch im Rennen lesen. Aufstellung, Formkarten und Persönlichkeiten wirken nur beim Bau und werden
sofort zurückgelegt.

Was die Arena im Pod zeigt:

- **Strecke:** 4k Läufer, Teamfarben 0/1 wie bisher, 2/3 Grün/Violett (wie im Battlefield-Pod).
  Streckenband, Takeshi-„noch im Rennen"-Piktogramme und Burgpunkte zeigen alle vier Teams.
- **Vier-Team-Tafel** auf der Leinwand: Platz, Name und Stand je Team (Burgpunkte bzw.
  Streckenanteil, dann Zielzeit), dazu die Uhr.
- **HUD:** Die Kopfzeile nennt den Führenden. Die Staffel-Führung kommt aus dem Vier-Team-Stand;
  das Zeit-Delta Seite 0 gegen 1 bleibt im Pod aus. Score-Bug und Einlauf-Karte (beide nur
  Heim/Gast) sind aus.
- **Kaderleiste und Wertungstabelle:** links Team 0/2, rechts Team 1/3, farbig markiert.
- **Endstand:** Banner mit Sieger und Stand, je Seite zwei Team-Tabellen mit Platz und Teamwert. Die
  Plätze nach dem Ziel rechnen exakt wie der zählende Lauf (`bahnPodErgebnis` +
  `verteilePlatzierungspunkte`). Der Alternativ-Rechner ist im Pod aus (er rechnet Duell-Zweitläufe).
- Der Host nennt unter der Arena die vier Teams der gebuchten Gruppe
  (`data-testid="oly-arena-bahn-pod-<bd>"`).

Für Tests ohne Host gibt es `window.__arena.bahnPodAnzeigen(bd, pod)` (`null` schaltet zurück) und
`bahnPodAnzeigeStand()`.

### 6.7 Was offen bleibt

- **Gezeigt ≈ gebucht, nicht bit-gleich.** Die Arena rechnet das Rennen sichtbar neu, mit der
  Zeitdehnung `ZEIT_DEHNUNG` (Staffel 14,65, Takeshi 2,17) in kleineren dt-Schritten. Der zählende
  Lauf nimmt feste 1/60 s. Eingaben, Saat, Formkarten und Aufstellung sind identisch, die Zufallsfolge
  verschiebt sich aber leicht. Gemessen auf vier Probeläufen: zweimal dieselbe Reihenfolge, je einmal
  Platz 3/4 (Takeshi) bzw. Platz 1/2 (Staffel) vertauscht. **Das ist dieselbe Grenze, die das
  Bahn-Duell seit der Zeitdehnung hat** (Kommentar an `ZEIT_DEHNUNG`: „verschiebt die genaue Abfolge
  der Zufallszüge leicht"). Exakt wäre nur eine Wiedergabe des zählenden Laufs, also Ticks
  aufzeichnen und zeitgedehnt abspielen; das ist ein eigener Umbau. Gebucht wird immer der zählende
  Lauf.
- **Namensgleichheit über Teams.** `place` ist nach Spielernamen geschlüsselt. Tragen zwei Pod-Teams
  einen Spieler mit identischem Namen, überschreibt sich ihre Aufstellung. Das betrifft auch Mini-DM
  und Battlefield und ist im Live-Abbild nicht vorgekommen.
- **Unterbesetzte Staffel ist schneller (6.3), Frage an Chris.** Drei mögliche Regeln:
  (a) Die Beinzahl ist die Kopfzahl des Spielplan-Slots, fehlende Beine laufen die vorhandenen
  Läufer ein zweites Mal (realistisch, braucht Doppel-Einsätze im Motor). (b) Ein fehlendes Bein
  kostet eine Strafzeit, z. B. die Etappenzeit des langsamsten eigenen Läufers. (c) Eine
  unterbesetzte Staffel wird hinter allen vollbesetzten gewertet. Jede Variante gilt für Duell und
  Pod und braucht danach eine neue Duell-Abnahme.
- Die Folgefrage aus 5.4 (Pod-Rezept der Staffel auch im Duell) bleibt offen.

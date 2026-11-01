# Bahn im Pod-Format: Takeshi's Castle und Staffel mit vier Teams (01.11.)

Chris' Freigabe vom 01.11.: je Kernbereich eine 4-Team-Disziplin wie Mini-DM (pow Mini-DM,
spe Staffel, men Takeshi, soc Battlefield), Punkte 2-1-0-0, Gruppen je Disziplin-Event frisch
gelost, zwei Pod-Disziplinen am selben Spieltag erlaubt. Konzept und Größen:
Scratchpad-Recherche „Vier Teams je Bereich" (01.11.). Battlefield läuft seit `1dcf3823` als
PPS-Pod (`VIERER_POD_DISCIPLINE_IDS`).

Dieses Dokument beschreibt den **Motor-Teil** für die zwei Bahn-Disziplinen. Den Stand der
Verdrahtung in die Liga beschreibt Abschnitt 4: Takeshi und Staffel sind **noch nicht** in
`VIERER_POD_DISCIPLINE_IDS` eingetragen.

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

**Neue Einstiege**, alle stumm und nur headless (die Zeichnung bleibt zweiseitig):

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

## 4. Was noch fehlt, bis Takeshi/Staffel in der Liga als Pod laufen

**Zwei Fragen an Chris, bevor die Kette gebaut wird:**

1. **Pp-Abnahme.** rho besteht bei beiden klar (über 0,85). Die Pp-Pflichtprüfung besteht keine
   der beiden sauber: Takeshi verfehlt sie in einem Strom stabil um gut 1 Pp (26,2 bei n = 96),
   Staffel steht genau auf 25 (25,0 / 25,3 bei n = 96, mit n = 48 bestanden). Das ist eine
   Ausnahmefrage wie bei Mini-DM und Battlefield, und die Gründe sind wieder andere: hier geht es
   um die Pp-Schranke, nicht um rho. Das Duell bleibt davon unberührt.
2. **Live-Bühne.** Soll die Bühne an Pod-Tagen das echte Vier-Team-Rennen zeigen (Zeichnung,
   HUD und Farben für vier Seiten), oder übergangsweise nur einen Hinweis wie bei Battlefield?

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

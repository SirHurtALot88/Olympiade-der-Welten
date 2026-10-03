# Gewichtheben Sandsack-Finale — Paket 1 Umsetzung (03.10.)

**Status: gebaut, gemessen, noch nicht in die Arena-Wertung verdrahtet.** Dieses Dokument
berichtet, was aus Chris' Freigabe ("1 ja / 2 3 Stationen / 3 Fable-Koexistenz / 4 Lastenplan
nach Traits", 03.10.) als Paket 1 entstanden ist: die Mechanik headless, die Team-Taktik-
Automatik auf PERSZIEL/PERSDEF, die neue Pp-Pflichtsonde und deren Ergebnisse. Baugrundlage:
`docs/design/gewichtheben-sandsack-rennen-opus-konzept-03-10.md` (mechanische Wahrheit) und
`docs/design/gewichtheben-sandsack-rennen-fable-praesentation-03-10.md` (nur Stationsnamen als
Flavour-Text, keine Mechanik).

---

## 1. Was gebaut wurde

Alles additiv in `public/mockups/battle-mode.engine.js`, direkt nach `baueHebenDuelle()`
eingehängt:

* **`baueSandsackFinale(art,mine,gegner,saat)`** — der Einstiegspunkt, aufgerufen unmittelbar
  nach `baueHebenDuelle()` für jede `art.heben`-Disziplin (heute nur Gewichtheben). Liest
  ausschließlich `u.LAST/u.TECHNIK/u.NERVEN/u.ANSAGE/u.ERHOLUNG` (die vor `baueHebenDuelle()`
  längst auf `TEILNEHMER` stehen) und schreibt nie in `u.summe`, `u.zweikampf`, `u.runden`,
  `u.duellGewonnen`, `ansage[]` oder `buehneQueue` — nur in die neuen, additiven Felder
  `u.lastKg/u.lastSaecke/u.lastRutscher/u.lastPausen/u.lastDoppelt` und das neue, eigene
  Objekt `LASTEN_FINALE`.
* **Drei Stationen** (Chris' Antwort 2): Hof (15·20·25·30·35·40 kg, Doppeln erlaubt), Rampe
  (30·40·50·60·70 kg, Steigfaktor 1,3, Doppeln erlaubt), Ladekante (60·75·90·105 kg, kein
  Doppeln) — exakt Opus 4.1. Jede Station trägt zusätzlich ein `fableLabel` (Depot/Steg/Rampe &
  Silo) als reines Anzeige-Flavourfeld für Paket 2, ohne jede mechanische Wirkung.
* **Formeln Zeichen für Zeichen aus Opus 4.2–4.8**: Traglast `K`, Wagnis-Flex `Kf`, Lasttempo
  `vLast`, Doppeln-Schwelle, Erschöpfung (`E += 60·r²·...`), Pause (deterministisch, Schwelle
  aus NERVEN), Rutscher (gewürfelt, Wahrscheinlichkeit aus `rf`/E/TECHNIK), Wechselkosten
  (0,3 s), Zeitlimit (190 Sim-s) mit Strongman-Medley-Regel.
* **Falle 17**: `sandsackWuerfe(saat,seite)` zieht **immer genau 15** Werte, indiziert nach
  Sack-Position (0..14) in der gesamten Renn-Reihenfolge, **bevor** irgendein Gang simuliert
  wird — unabhängig davon, ob/wie oft gedoppelt wird. Die Funktion nimmt keinen Plan- oder
  Doppeln-Parameter entgegen; sie kann die Ziehungsfolge also gar nicht sehen, geschweige denn
  verschieben. Zusätzlich ein **eigener, lokal seedender Strom** (kein Zugriff auf das globale
  `rr()`/`seed` der Hantel) — damit gibt es nicht nur eine feste Zahl von Ziehungen, sondern gar
  keinen gemeinsamen veränderlichen Zustand mehr mit `baueHebenDuelle()`/`hebeUebung()`.
* **Team-Taktik-Automatik auf PERSZIEL/PERSDEF** (Abschnitt 2).
* **Neue Mess-Infrastruktur**: `spieleSandsackFinale()`, `einflussVonSandsackFinale()`,
  `sandsackFinaleWert()` (alle auf `window.__arena`) und das Skript
  `scripts/miss-sandsack-finale.mjs` (Abschnitt 3).

**Bewusst nicht gebaut (Abschnitt 4):** `seiten` in `spieleBuehneHeben()` bleibt unverändert —
der siebte Mannschaftspunkt fließt noch nicht in die Arena-Tabelle.

---

## 2. Team-Taktik: PERSZIEL/PERSDEF-Ableitung

Chris, 03.10., wörtlich zur Automatik: *"erstmal automatisch vlt auch nach traits und teams ob
sie besser zusammenarbeiten oder mehr ego sind etc. Oder denken sie wären besser als ihre
Kollegen usw."* Das ersetzt Opus' ursprüngliche Stufe 1 (zeitoptimale Trainer-Automatik,
846 Kombinationen durchgerechnet) vollständig durch eine **persönlichkeitsgetriebene** Wahl.
Kein neues Trait-System — die vier Kanäle, die PR #1133 im bestehenden PERSZIEL/PERSDEF-Bund
bereits für die Arena nutzt: Zielneigung, Haltung, Zusammenhalt, Bindung.

### 2.1 Die Ableitungsregel

`sandsackPersoenlichkeit(p)` liest `leitePers(p)` (reine Funktion von Klasse/Rasse/Unterklasse/
Traits, direkt auf das Original-Spielerobjekt angewendet — **nicht** über das globale `persOf`,
das an Arena-Zustand hängt und hier keinen Shared State erzeugen soll) und bildet:

```
team = 0,40·Zusammenhalt + 0,30·Bindung + 0,20·(0,5 − Zielneigung_Ego/2) + 0,10·(0,5 − Haltung_Ego/2)
```

| Kanal | Quelle | Gewicht | Begründung |
|---|---|---:|---|
| **Zusammenhalt** | `PERSDEF[pk].z`, Skala `SK(ZUSAMMEN,·)` | 40 % | direktestes Signal für "wie nah bleibt er bei der Mannschaft" — genau Chris' "besser zusammenarbeiten". |
| **Bindung** | `PERSDEF[pk].b`, Skala `SK(BINDUNG,·)` | 30 % | "denken sie wären besser als ihre Kollegen" ist im Bestandssystem eine geringe Verlässlichkeit/Bindung gegenüber dem Team, hier auf die Werkbank übertragen statt auf den Kampf. |
| **Zielneigung** | `PERSZIEL[pk]` | 20 % | `speer`/`bedrohung` (die Spitze allein aufbrechen / den Stärksten direkt herausfordern) sind Dominanz-/Alleingang-Signale; `schild`/`hinten` (für die eigenen Leute freiräumen / die unauffällige Rand-Rolle) sind Team-Signale; `naechster`/`schwach` werten neutral. |
| **Haltung** | `PERSDEF[pk].h` | 10 % | kleiner Zuschlag: `wild`/`offensiv` (rücksichtslos, kämpft/trägt allein bis zum Ende) hebt den Ego-Wert leicht, `defensiv`/`vorsichtig` senkt ihn. |

`team=0` heißt reiner Alleingang/Ego, `team=1` reiner Mannschaftsspieler. Team-Durchschnitt über
die sechs Spieler: **≥ 0,60 → Staffel, ≤ 0,40 → Anker, dazwischen → Stationen** (die ausgewogene
Mitte — Mehrwege-Leitlinie: ein Team ohne klare Schlagseite bekommt trotzdem einen eigenen,
plausiblen Plan statt eines erzwungenen Extrems).

### 2.2 Die sechs Archetypen, konkret

| Persönlichkeit | Zusammenhalt | Bindung | Zielneigung (Ego) | Haltung (Ego) | **team** | **Neigung** |
|---|---:|---:|---:|---:|---:|---|
| Bollwerk | dicht (1,00) | treu (0,75) | naechster (0) | vorsichtig (−0,5) | **0,800** | Staffel |
| Beschützer | eng (0,75) | ausgewogen (0,50) | schild (−1) | defensiv (−1) | **0,750** | Staffel |
| Duellant | ausgewogen (0,50) | treu (0,75) | bedrohung (0,5) | ausgewogen (0) | **0,525** | Stationen |
| Schleicher | eigen (0,00) | flexibel (0,25) | hinten (−0,5) | vorsichtig (−0,5) | **0,300** | Anker |
| Opportunist | locker (0,25) | opportun (0,00) | schwach (0) | ausgewogen (0) | **0,250** | Anker |
| Draufgänger | eigen (0,00) | opportun (0,00) | speer (1) | wild (1) | **0,000** | Anker |

Das Ergebnis trifft Chris' Satz präzise: die beiden ausdrücklich teamorientierten Typen
(Bollwerk, Beschützer) landen bei Staffel, die beiden ego-/überheblichkeitsnächsten
(Draufgänger, Opportunist) bei Anker, der Schleicher (einzelgängerisch, aber nicht überheblich)
ebenfalls bei Anker, und der Duellant (einzige "ausgewogene" Grundhaltung auf zwei der vier
Kanäle) landet in der Mitte bei Stationen.

### 2.3 Rollenverteilung innerhalb des Plans

Chris' Antwort 4 entscheidet nur den **Plan**. Wer konkret welche Station trägt, ist eine
kleine, dokumentierte Zusatz-Heuristik (kein Auftrag, hierfür ebenfalls auf Leistung zu
verzichten — die Opus-846-Kombinationen-Suche aus Stufe 1 ist durch die trait-gesteuerte
Planwahl bereits ersetzt). **Wichtiger Fund aus der Selbstverifikation:** eine erste Fassung
gewichtete nur die vier Sub-Skills linear (und danach einen 65/35-Mix aus `u.eig` und
Sub-Skills) — beide ließen wiederholt einen Spieler mit sehr niedrigem LAST an der Ladekante
(60–105 kg) landen, weil sein NERVEN/ERHOLUNG den linearen Wert trotzdem hob. `K=30+1,2·LAST`
macht so jemanden an schweren Säcken katastrophal langsam (`r` bis über 1,8), was
`scripts/miss-sandsack-finale.mjs` als **vollständige Favoriten-Umkehr in zwei von fünf
Paarungen** zeigte — ein Team lief sogar ins Zeitlimit. Ein linearer Blend aus Sub-Skills kann
die K-Kapazitätsschwelle grundsätzlich nicht abbilden, egal wie die Gewichte stehen.

**Fix:** keine geratenen Gewichte mehr — die Zuteilung fragt direkt die echte Gang-Formel
(`sandsackGang`, Opus 4.2), wie lange ein Spieler solo für eine Station bräuchte (E=0, kein
Rutscher-Wurf — eine Schätzung für die Zuteilung, nicht die eigentliche Simulation). Der Anker
(Opus 5.1, wörtlich *"Der Beste trägt jeden Sack"*) ist damit, wer die geschätzte Gesamtzeit
über alle drei Stationen minimiert; bei Stationen/Staffel wird pro Station/Paar greedy die
schnellste verfügbare Kombination gewählt. Nach dem Fix: alle vier eindeutigen Paarungen der
Kader-Familie liefen wieder 100 % konsistent mit dem Eignungs-Favoriten (Abschnitt 3.2).

---

## 3. Messungen

Alle Messungen mit `scripts/miss-sandsack-finale.mjs` gegen die echte live-save-Kaderfamilie
(`data/generated/kaderfamilie-live-save.json`, 5 Paarungen, 10 Teams) und, für die Isolation,
gegen `origin/main` `83d02cf1`.

### 3.1 Pp-Abweichung (Pflichtsonde, n=144, zwei unabhängige Saatströme)

```
node scripts/miss-sandsack-finale.mjs 48 144
```

| Attribut | Strom 1 | Strom 2 | Matrix |
|---|---:|---:|---:|
| charisma | 28,1 % | 27,7 % | 23 % |
| power | 22,0 % | 21,1 % | 28 % |
| health | 13,0 % | 12,7 % | 16 % |
| speed | 11,2 % | 12,6 % | 6 % |
| dexterity | 10,7 % | 12,1 % | 6 % |
| will | 10,0 % | 10,2 % | 7 % |
| determination | 4,6 % | 3,1 % | 12 % |
| stamina | 0,5 % | 0,5 % | 2 % |
| intelligence/awareness/spirit/torment | 0 % | 0 % | 0 % |

**Pp-Abweichung: 35,9 (Strom 1) / 41,2 (Strom 2) — über der 25-Pp-Schranke, NICHT bestanden.**

**Ehrlich eingeordnet:** Opus' eigenes Offline-Modell (Abschnitt 6.4 des Konzeptpapiers) maß in
einer rauschfreien EV-Rechnung 13,3 Pp mit denselben Formeln und schrieb dazu selbst: *"Die 13,3
Pp sind eine Modellzahl ohne Rauschen, ohne Slot/Form/Trait und mit n=10 Teams. In echten
Motor-Messungen lagen Pp-Zahlen bisher ÜBER den Modellzahlen."* Genau das zeigt sich hier. Ich
habe **einen** gezielten Kalibrierversuch unternommen (K-Kapazität von LAST stärker abhängig
gemacht, TECHNIK-Hebel auf `vLeer` halbiert, um dexterity/speed zu senken und
power/health/determination zu heben) — das Ergebnis wurde **schlechter** (48,9 Pp bei n=48,
dexterity/speed kollabierten auf 0 %, health schoss auf 27,6 % hoch). Das ist dasselbe
Whack-a-Mole-Muster, das die Hantel selbst in ihrer eigenen Kalibriergeschichte mehrfach
dokumentiert ("GEPRÜFT UND VERWORFEN"-Kommentare bei `BUEHNE_ART.gewichtheben`). Ich habe den
Versuch **zurückgerollt** auf Opus' Startwerte, statt auf Verdacht weiterzudrehen und das Risiko
einzugehen, etwas vorher Besseres schlechter zu machen (CLAUDE.md-Grundsatz). **Die
Pp-Kalibrierung bleibt offen — s. Abschnitt 5.**

### 3.2 Team-Validität und Favorit/eng (n=48 je Paarung)

```
Team-Validität: Spearman(Eignungssumme, −Median-Rennzeit) über 10 Teams = 0,770
(Ziel ≥ 0,80, Opus-Modell 0,915)
```

| Paarung | Eig Heim | Eig Gast | Lücke | Median-Zeit H/G | Favorit-Quote |
|---|---:|---:|---:|---|---:|
| vigilante-armageddon | 356,6 | 261,3 | 30,8 % | 144,7 / 182,5 | 100 % (48/48) |
| coldsteel-direlegion | 330,8 | 261,5 | 23,4 % | 164,2 / 169,0 | 100 % (48/48) |
| goldengladiators-silversoldiers | 318,0 | 317,5 | 0,2 % | 168,0 / 182,8 | 100 % (48/48) |
| **mortalsin-natureswrath** | 242,2 | 230,1 | **5,1 %** | 192,0 / 169,6 | **0 % (0/48)** |
| piratecrew-raginglunatics | 201,8 | 274,1 | 30,4 % | 198,2 / 154,0 | 100 % (48/48) |

Vier von fünf Paarungen sind nach dem Rollen-Fix (3.0) vollständig konsistent mit der
Eignungssumme. Die fünfte (Mortal Sin — Natures Wrath) ist **dieselbe Paarung**, die Opus'
eigenes idealisiertes Modell (Konzeptpapier 6.2) als knapp/umgekehrt beschreibt (dort 36,5 % zu
63,5 %, "Führungswechsel an der Ladekante"): Natures Wrath stellt einen Einzelspieler mit
LAST 90 (weit über dem restlichen Kader), der im Anker-Plan allein das ganze Team trägt und
trotz niedrigerer Eignungs-SUMME gewinnt — exakt die "Mannschaftstiefe/Komposition schlägt
Rohsumme"-Dynamik, die Opus als Feature beschreibt ("Genau dafür ist der Nebenweg da"). Bei n=48
ist die 0 %-Quote hier deterministischer als Opus' Modell vorhersagt (eng statt umgekehrt) — ein
Hinweis, dass die Doppeln-/Rutscher-Varianz bei dieser spezifischen Paarung zu klein ist, um das
Rennen wirklich offen zu halten; eine mögliche Feinkalibrierung für die nächste Runde.

### 3.3 Deskriptiv (Opus-Kalibrierkorridor, 240 Rennen)

| Größe | Gemessen | Opus-Modell | Einordnung |
|---|---:|---:|---|
| Rutscher je Rennen (beide Teams) | 1,10 | 1,27 | im Korridor 0,8–2 |
| Pausen je Rennen (beide Teams) | 1,03 | 1,01 | im Korridor 0,5–2, sehr nah |
| Doppel-Gänge je Rennen (beide) | 2,20 | — | ≥ 1 im Mittel erfüllt |
| Planverteilung (480 Team-Entscheidungen) | Staffel 30 % / Stationen 40 % / Anker 30 % | kein Plan > 60 % | erfüllt |
| Fertig unter Zeitlimit | beide 60 %, einer 40 %, keiner 0 % | ~70 % beide | etwas niedriger, im plausiblen Bereich |

Rutscher- und Pausenhäufigkeit treffen Opus' Kalibrierziel bereits sehr gut — die Formeln selbst
(abseits der Pp-Frage) scheinen gut getroffen.

### 3.4 Isolationsnachweis

```
node scripts/lib-vergleich (Basis origin/main 83d02cf1 vs. dieser Branch)
window.__arena.spiele("gewichtheben", saat)        — Spielerprotokoll
window.__arena.spieleBuehneHeben("gewichtheben", saat) — seiten/gesamtKg/boxscore
```

Für sieben Saaten (1337, 4242, 99991, 2026, 555555, 7919, 104729): **byte-identisch** in beiden
Funktionen, vor UND nach allen Formeländerungen dieses Pakets (erneut verifiziert nach dem
zurückgerollten Kalibrierversuch). `seiten` zählt weiterhin ausschließlich gewonnene Duelle,
`gesamtKg` bleibt die reine Zweikampf-Summe — der neue siebte Punkt ist nirgends eingerechnet.
Zusätzlich: `LASTEN_FINALE` ist additiv in `MOTOREN[bd].sichern()/zurueck()` aufgenommen, damit
ein verschachtelter Messlauf (z. B. in `einflussVon`) keinen Stand einer fremden Simulation
stehen lässt — für jede Nicht-Heben-Bühne bleibt es dauerhaft `null`.

### 3.5 Falle-17-Nachweis

`sandsackWuerfe(saat,seite)` hat die Signatur `(saat, seite) => Zahl[15]` — sie nimmt **keinen**
Plan- oder Doppeln-Parameter entgegen und kann die gewählte Taktik oder die tatsächliche Zahl
der Gänge also strukturell nicht sehen. Zwei Paarungen mit nachweislich unterschiedlicher
Planwahl (Staffel vs. Stationen) wurden mit derselben Saat gegen dieselbe Funktion geprüft: die
15 Ziehungen hängen beweisbar nur an `(saat, seite)`. Das ist stärker als "immer gezogen,
niemals übersprungen" (die wörtliche Falle-17-Vorgabe) — es gibt hier gar keinen Mechanismus,
über den Doppeln oder Planwahl die Ziehung überhaupt beeinflussen könnten.

---

## 4. Bewusst zurückgestellt: `seiten` in die Arena-Wertung

Opus' eigener Umsetzungsplan (Konzeptpapier Abschnitt 10) sequenziert ausdrücklich: *(1)
Pflichtsonde und Formeln headless, noch ohne Bild; (2) Szene, Requisiten, Ticker, Ton; (3) erst
dann `seiten` in die Arena-Wertung; (4) Stufe 2 mit dem Haltungs-Grundgerüst.* Paket 1 deckt
Schritt (1) vollständig ab. Ich habe **bewusst nicht** vorgezogen, den siebten Punkt in
`spieleBuehneHeben()`s `seiten` zu schreiben, aus zwei Gründen:

1. **Das wäre eine Spielablauf-Änderung ohne sichtbares Gegenstück.** Ohne Paket 2 (Bühnenbild,
   Ticker, Banner) gäbe es ein Rennen, das die Tabelle verschiebt, aber niemand sieht es. Das
   ist genau die Art "neue, über das bereits Entschiedene hinausgehende Wall-Clock/
   Spielablauf-Änderung", die ich laut Auftrag flaggen statt bauen soll.
2. **Jede Anzeige, die "Duelle x:y von 6" annimmt, müsste mitgezogen werden** (HUD, Spielbericht,
   Endstand-Banner — Opus 3, ausdrücklich als offene Aufgabe für die Bau-Runde benannt). Das ist
   Anzeigearbeit, die mit Paket 2 zusammengehört, nicht mit der headless-Mechanik.

**Für den Pp-/rho-Nachweis ist das kein Hindernis**: `spieleSandsackFinale()` und
`einflussVonSandsackFinale()` lesen `LASTEN_FINALE` direkt, unabhängig davon, ob es je in
`seiten` einfließt.

---

## 5. Offene Fragen und Risiken (nicht eigenmächtig gelöst)

1. **Pp-Abweichung liegt bei 35,9/41,2, über der 25-Pp-Schranke.** Das ist die wichtigste offene
   Zahl. Mein einziger Kalibrierversuch hat es verschlimmert und wurde zurückgerollt (3.1). Eine
   echte Konvergenz (wie bei der Hantel selbst: 66 → 9,6 Pp über mehrere dokumentierte Runden,
   `docs/design/gewichtheben-pp-regression-befund-01-10.md` und
   `docs/design/gewichtheben-kalibrierung-ansage-kanal-01-10.md`) braucht vermutlich mehrere
   gezielte, einzeln gemessene Anpassungen an den `SANDSACK_*`-Konstanten — eine eigene,
   dedizierte Kalibrierrunde, keine Sache, die sich in diesem Durchgang noch sicher erledigen
   ließ, ohne das Risiko einzugehen, etwas (wie gerade geschehen) schlechter zu machen. Ich habe
   bewusst NICHT am gesperrten `rezept` von `BUEHNE_ART.gewichtheben` gedreht — das ist mit der
   Hantel geteilt und hätte deren eigene, bereits bei 9,6 Pp eingemessene Abnahme riskiert.
2. **Team-Validität 0,770, unter dem 0,80-Ziel, aber nah dran.** Nach dem Rollen-Fix sind vier von
   fünf Paarungen vollständig konsistent; die fünfte ist eine ECHTE enge Paarung (5,1 % Lücke),
   die auch in Opus' eigenem Modell knapp ausfiel. Mit nur 10 Teams (5 Paarungen × 2 Seiten)
   bewegt jede einzelne Paarung die Zahl stark — mehr Paarungen (eine größere Kaderfamilie) wären
   der nächste Schritt, falls Chris eine härtere Zahl will.
3. **CLAUDE.md sagt, rho hat Priorität vor Pp bei Konflikt.** Hier gibt es (noch) keinen echten
   Konflikt zwischen beiden — beide liegen unter ihrem Ziel, keines auf Kosten des anderen. Die
   Reihenfolge einer künftigen Kalibrierrunde sollte entsprechend sein: zuerst an der
   Team-Validität arbeiten (näher am Ziel, direkter mit CLAUDE.md verbunden), dann an Pp.
4. **`seiten` in die Arena-Wertung** ist eine Design-Entscheidung, die ich bewusst Chris
   überlasse (Abschnitt 4) — nicht weil sie schwierig wäre, sondern weil sie laut Auftrag über
   das bereits Entschiedene hinausgeht, solange Paket 2 fehlt.
5. **Die enge Paarung (Mortal Sin — Natures Wrath) ist bei n=48 deterministischer (0 %) als
   Opus' Modell (36,5 %) vorhersagt.** Das deutet darauf hin, dass die Rutscher-/
  Doppeln-Varianz dort zu klein ist, dieses eine Rennen offen zu halten — eine mögliche
  Fein-Kalibrierung, keine strukturelle Lücke (die anderen vier Paarungen sind sauber
  deterministisch-konsistent).

---

## 6. Geänderte/neue Dateien

* `public/mockups/battle-mode.engine.js` — additiv: `LASTEN_FINALE`-Zustand, `SANDSACK_*`-
  Konstanten, `sandsackPersoenlichkeit`/`sandsackLastenplan`/`sandsackZuteilung`/
  `sandsackWuerfe`/`sandsackGang`/`sandsackSeiteLauf`/`baueSandsackFinale`,
  `spieleSandsackFinale`/`einflussVonSandsackFinale`/`sandsackFinaleWert`. Zwei Ein-Zeilen-
  Änderungen an bestehendem Code: der Aufruf von `baueSandsackFinale()` direkt nach
  `baueHebenDuelle()`, und `LASTEN_FINALE` additiv in `MOTOREN[bd].sichern()/zurueck()`
  (generisch für alle Bühnen-Disziplinen, bleibt für jede Nicht-Heben-Bühne `null`).
* `scripts/miss-sandsack-finale.mjs` — die neue Pflichtsonde (Abschnitt 3).
* `docs/design/gewichtheben-sandsack-rennen-opus-konzept-03-10.md`,
  `docs/design/gewichtheben-sandsack-rennen-fable-praesentation-03-10.md` — die beiden
  Konzeptdokumente, bisher nur auf separaten Branches, hier für den Review-Kontext mitgeführt.

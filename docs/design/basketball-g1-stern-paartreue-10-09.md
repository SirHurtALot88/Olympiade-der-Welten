# Basketball — G1*-Sternspieler-/Paartreue-Messung (10.09.)

**Auftrag:** Fables E1-Entscheidung
(`docs/pm-briefings/fable-entscheidung-e1-e2-e3-basketball-hockey-football-10-09.md` Abschnitt 1)
legt fest: Basketball bekommt kein Forschungsticket, sondern eine messbare Alternativ-Abnahme
G1* — analog zur Hockey-Messung in `docs/design/hockey-opus-review-nhl.md` Abschnitt 5.3, die
CLAUDE.md selbst als Vorbild nennt ("Die ehrlichere Abnahme fragt deshalb nach dem Star und nach
der Paartreue mit Abstand"). Die Zahlen dafür waren nie gemessen worden — `ls scripts | grep
star` war leer, das im Football-Erfolgskurven-Plan (Anhang B, 05.09.) skizzierte Skript blieb
Scratchpad. Dieses Dokument holt das nach: neues, committetes Werkzeug
`scripts/miss-star-paartreue.mjs`, gegen Hockey als Kontrollzahl verifiziert, dann auf Basketball
gefahren.

## 0. G1*-Bedingungen (Fable-Entscheidung E1, wörtlich)

> **G1\* (35 Punkte, wie Stufe 0,80–0,85):** Eine Disziplin mit rho je Spiel in der Stufe
> 0,70–0,80 erhält 35 statt 22 Punkte, wenn — kaderfest, n ≥ 24 je Paarung, dieselbe
> Kader-Familie wie die Basislinie — **alle vier** Bedingungen halten:
> (a) rho Saison ≥ 0,85, (b) Star auf Rang 1 ≥ 50 % und in den ersten zwei ≥ 75 %,
> (c) Star auf dem letzten Rang 0 %, (d) Paare mit ≥ 15 Eignungspunkten Abstand zu ≥ 95 %
> richtig geordnet.

## 1. Werkzeug

`scripts/miss-star-paartreue.mjs [spiele] <disziplin> [disziplin ...]` — neu, wiederverwendet
die bestehende kaderfeste Infrastruktur (`window.__arena.disziplinProbe`,
`scripts/lib/rangtreue-messung.mjs`, Kader-Familie aus
`data/generated/kaderfamilie-live-save.json`: fünf echte Team-Paarungen aus dem live-save-Abbild,
dieselbe Quelle, die auch `miss-alle-disziplinen.mjs`/`stand-aller-disziplinen.md` speist). Neu
ist nur die Star-/Paartreue-Auswertung je Einzelspiel:

- **Star** = der Teilnehmer mit der höchsten Eignung (`eig`) *dieses* Spiels (Formkarten bewegen
  `eig` leicht von Spiel zu Spiel).
- **Rang** = sein Impact-Rang (`wert`, absteigend, dichte Rangvergabe bei Gleichstand).
- **Paartreue ≥15** = über alle Paare eines Spiels mit `|eig_a − eig_b| ≥ 15`: der Teilnehmer mit
  der höheren Eignung muss den ≥ Impact-Wert haben (ein exakter Wert-Gleichstand zählt nicht als
  Fehler).
- Bei Hockey wird die Torwart-Rolle ausgeschlossen (eigene Wertformel, Fable-Recherche 1.1/3.1) —
  dieselbe Regel wie die "davon nur Feldspieler"-Zeile in `miss-alle-disziplinen.mjs`.

Aufruf, synchron, ~2 Minuten Laufzeit:

```
node scripts/miss-star-paartreue.mjs 24 hockey basketball
```

## 2. Verifikation gegen die bekannte Kontrollzahl

`docs/design/hockey-opus-review-nhl.md` Abschnitt 5.3 nennt für Hockey, kaderfest,
Feldspieler-only: rho je Spiel **0,719**, rho Saison **0,818**, Star auf Rang 1 **58 %**, in den
ersten zwei **78 %**, auf dem letzten Rang **0 %**. Das neue Skript, über dieselbe Kader-Familie
gefahren (5 Paarungen × 24 Spiele = 120 Spiele), liefert:

| Größe | hockey-opus-review-nhl.md 5.3 | `miss-star-paartreue.mjs` |
|---|---:|---:|
| rho je Spiel (Median) | 0,719 | **0,719** |
| rho Saison (Median) | 0,818 | **0,818** |
| Star auf Rang 1 | 58 % | **57,5 %** |
| Star in den ersten zwei | 78 % | **77,5 %** |
| Star auf dem letzten Rang | 0 % | **0,0 %** |

Vier von fünf Zahlen treffen exakt, die beiden Prozentwerte auf 0,5 Punkte — die Differenz ist
Rundung (58/78 sind selbst schon gerundete Werte aus 5.3). Das Skript reproduziert die bekannte
Kontrollzahl; die Star-/Paartreue-Logik ist also kein Neuerfinden, sondern dieselbe Rechnung wie
5.3, nur committet statt Scratchpad.

**Nebenbefund, offen genannt:** Für die Paartreue ≥15 selbst gibt es in 5.3 keine explizite
Kontrollzahl — nur CLAUDE.mds Fließtext nennt "99 %" für Hockey. Kaderfest über die echte
Fünfer-Kaderfamilie (statt eines einzelnen Testkaders) misst dieses Skript für Hockey
**90,9 %** (n = 2376 Paare). Die 99 % sind vermutlich vor der Kaderfamilie-Umstellung (03.09.,
`docs/design/messgrundlage-kaderfest.md`) auf einem einzelnen Kader gemessen — dieselbe Klasse
von Altzahl, die 5.3 für Star-Rang bereits korrigiert hat (79/94 → 58/78). Das ändert nichts an
der Verifikation oben (rho und Star-Zahlen sind unabhängig davon exakt reproduziert), heißt aber:
CLAUDE.mds "99 %" ist mit derselben Vorsicht zu lesen wie die alten 79/94 %.

## 3. Basketball — Ergebnis

Gleicher Aufruf, gleiche Kader-Familie (5 echte Paarungen aus dem live-save-Abbild), 24 Spiele je
Paarung, 120 Spiele gesamt, keine Torwart-Rolle (alle 12 Teilnehmer je Spiel gezählt):

| Größe | gemessen | G1*-Schwelle | Bedingung |
|---|---:|---:|---|
| (a) rho Saison | **0,923** (Spannw. 0,224) | ≥ 0,85 | **erfüllt** |
| (b) Star auf Rang 1 | **43,3 %** | ≥ 50 % | **nicht erfüllt** |
| (b) Star in den ersten zwei | **64,2 %** | ≥ 75 % | **nicht erfüllt** |
| (c) Star auf dem letzten Rang | **0,0 %** | = 0 % | **erfüllt** |
| (d) Paartreue ≥15 Punkte Abstand | **93,3 %** (n = 4188 Paare) | ≥ 95 % | **nicht erfüllt** |

rho je Spiel (Kontext, nicht Teil von G1*): 0,769 (Median, Spannweite 0,105) — deckungsgleich mit
der Basislinie aus `data/generated/rangtreue-basislinie.json` und dem Fable-Briefing.

Je Kader-Paarung (Rohdaten, zur Einordnung der Streuung):

| Paarung | rho Spiel | rho Saison | Star Rang1 | Star Top2 | Star Letzter | Paartreue≥15 |
|---|---:|---:|---:|---:|---:|---:|
| vigilante-armageddon | 0,769 | 0,762 | 41,7 % | 66,7 % | 0,0 % | 95,5 % |
| coldsteel-direlegion | 0,774 | 0,923 | 37,5 % | 58,3 % | 0,0 % | 93,8 % |
| goldengladiators-silversoldiers | 0,845 | 0,986 | 33,3 % | 62,5 % | 0,0 % | 94,5 % |
| mortalsin-natureswrath | 0,740 | 0,944 | 62,5 % | 62,5 % | 0,0 % | 88,6 % |
| piratecrew-raginglunatics | 0,759 | 0,860 | 41,7 % | 70,8 % | 0,0 % | 95,1 % |

Keine der fünf Paarungen erreicht für sich Star-Rang1 ≥ 50 % **und** Top2 ≥ 75 % gleichzeitig;
nur zwei von fünf erreichen die 95 % Paartreue. Das Bild ist über die Kader-Familie konsistent,
kein Ausreißer einer einzelnen Paarung.

## 4. Ergebnis

**Basketball erfüllt G1\* NICHT.** Bedingung (a) und (c) halten, (b) und (d) nicht — und zwar
klar, nicht knapp (Star-Rang1 43,3 % gegen die geforderten 50 %, Top2 64,2 % gegen 75 %,
Paartreue 93,3 % gegen 95 %). G1 bleibt für Basketball bei der Rangtreue-Stufenleiter regulär: rho
je Spiel 0,769 liegt in der Stufe 0,70–0,80 → **22 Punkte**, nicht 35.

Das ist genau die Konsequenz, die die Fable-Entscheidung selbst offenlässt: "Fällt Basketball bei
(b) oder (d) durch, bleibt G1 bei 22 und die Entscheidung ist trotzdem getroffen: dann fehlt
Validität in einem Kanal, und **das** wäre ein Forschungsticket wert." Basketball fällt bei
**beiden** durch (b) und (d), nicht nur bei einem. Damit ist die in E1 offen gelassene Frage jetzt
beantwortet — mit dem Befund, den E1 als den interessanteren einstufte: nicht "Basketball ist in
Ordnung, nur ungemessen", sondern "Basketball hat tatsächlich eine Validitätslücke gegenüber dem
einzigen bisher vermessenen Vergleichsfall (Hockey)". Da G1\* nicht erfüllt ist, bleibt
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` unverändert (Schritt 4 der
Aufgabe war ausdrücklich an "falls Basketball G1\* erfüllt" geknüpft).

## 5. Reproduzieren

```
node scripts/miss-star-paartreue.mjs 24 hockey basketball
```

Kader-Quelle wird im Kopf der Ausgabe genannt; ohne `data/generated/kaderfamilie-live-save.json`
(z. B. frischer Checkout ohne live-save-Zugriff) fällt das Skript auf den synthetischen
Ausweichkader zurück und die Zahlen sind dann Kompromisswerte, keine Abnahmezahl (wie bei
`miss-alle-disziplinen.mjs`).

# Befund: die Apron-Bremse der KI — erst falsch bemessen, dann zu schwach gehebelt

**Chris:** „aber was heißt kauft munter weiter? sollte der appetit nicht das kaufverhalten
beeinflussen? Können wir das messen wie sehr der bremsfaktor sich real auswirkt?"

Und danach, nach der ersten Messung: „die apron linie ist sonst ja nur in S1 korrekt und danach
immer falsch das ist ein grundproblem — fixe das sonst können wir nix messen und dann miss erneut".

Beides ist beantwortet. Der Reihe nach, weil der zweite Befund erst sichtbar wurde, nachdem der
erste behoben war.

## Was die Bremse tut

`resolveApronTighteningMultiplier` verbietet keinen Kauf. Sie erhöht die Rücklage:

```
ruecklage = erwartetesGehalt × hoard × hoardTightening / apronFaktor + sockel
```

Ein Faktor von 0,83 macht die Rücklage 1/0,83 = 1,20-mal so groß. Ob das ein Kaufverhalten ändert,
hängt allein daran, ob dem Team dadurch **freies Budget** verlorengeht (`cash − rücklage`).

## Wie gemessen wurde

`scripts/apron-bremse-sonde.ts` hängt im Simulationslauf genau eine Zeile vor
`runTransferWindowSession` — der Moment, in dem die KI kauft. Sie schreibt je Team die Rücklage MIT
und OHNE Bremse, beides aus derselben Funktion (`resolveTeamCashRunwayReserve`, Option
`apronBremseAus`).

**Zwei frühere Messungen waren am falschen Stand** und sind zurückgezogen: mitten in der Saison
(dort hat kaum ein Team freies Budget) und am `season_completed`-Stand (dort steht kaum ein Team
über seiner Decke). Beide Male kam „bindet nichts" heraus, und beide Male sagte das nichts über den
Kaufmoment.

## Erster Befund: die Bemessung war falsch — behoben

Im Kaufmoment sind die Verträge gerade ausgelaufen, die Kader stehen bei 8–11 von 10–14 Plätzen.
Dieselbe Liga, dieselbe Saison 4, einmal vor und einmal nach den Käufen gemessen:

| | vor den Käufen | nach den Käufen |
|---|---:|---:|
| Median-Gehalt | 39,7 | **55,2** |
| höchstes Gehalt | 65,0 | 75,5 |
| Linien (1,25 / 1,6) | 49,6 / 63,5 | **69,1 / 88,4** |

Die KI entschied gegen eine Grenze, die 28 % zu tief lag — gerechnet aus einem Kader, den es noch
gar nicht gab. In Saison 1 fällt das nicht auf, weil der Draft die Kader VOR dem Prüfmoment füllt;
ab Saison 2 ist der Prüfmoment immer das Tal.

Behoben in drei Teilen (siehe Commit „Apron-Linien: Anker aus der Vorsaison"):

1. **Linien-Seite.** `resolveSeasonApronLines` verankert im offenen Kauffenster am Median der
   abgerechneten Vorsaison. Kein neuer Speicher — der Snapshot überlebt den Saisonübergang ohnehin
   und fiel nur am `seasonId`-Abgleich durch. Verankert wird der MEDIAN, nicht die fertige Linie:
   ein alter Snapshot trägt die Faktoren von damals.
2. **Team-Seite.** `isTeamOverApronSalaryCeiling` und `resolveApronTighteningMultiplier` messen die
   auf den geplanten Kader hochgerechnete Apron-Basis. Endzustand gegen Endzustand.
3. **Ausnahme.** Unter dem harten Kader-Minimum greift die Bremse nicht. Ohne diese Regel traf die
   Hochrechnung ausgerechnet den Wiederaufbau: ein Team mit 2 von 8 Plätzen wurde auf einen vollen
   Kader hochgerechnet und bekam das Geld weggesperrt, mit dem es spielfähig werden musste.

## Zweiter Befund: der Mechanismus trägt nicht — offen

Gemessen nach dem Umbau, vier Saisons, frischer Spielstand:

| Saison | Anker | Linien | über Decke | entzogenes Kaufbudget | freies Budget der Liga | Anteil |
|---|---:|---|---:|---:|---:|---:|
| S1 | 64,8 | 81,0 / 103,7 | 0/32 | 0,00 | 0,5 | 0,00 % |
| S2 | 64,8 | 81,0 / 103,7 | 1/32 | 0,59 | 2283,3 | 0,03 % |
| S3 | 58,4 | 73,0 / 93,4 | 2/32 | 5,88 | 1661,2 | 0,35 % |
| S4 | 58,6 | 73,3 / 93,8 | 2/32 | 5,51 | 1703,2 | 0,32 % |

**Über vier Saisons: 11,98 entzogen von 5648,3 freiem Kaufbudget — 0,21 Prozent.**

Der Anker sitzt (S2 hält 64,8 statt ins Tal zu fallen), die Ausnahme greift (alle markierten Teams
haben 8+ Spieler, kein Wiederaufbauer ist mehr dabei), und die Bremse trifft die Richtigen: W-L
steht in S3 bei 69,4 gegen eine Decke von 73,0 und wird trotzdem gebremst, weil 9 von 11 Plätzen
auf 84,8 hochrechnen. Genau so ist es gedacht.

**Nur ändert es nichts.** Die Liga geht mit rund 1700–2300 freiem Kaufbudget in jede Vorsaison,
etwa 55–70 pro Team. Eine Rücklage von 30 gegen einen Cash-Bestand von 70 ist kein Hindernis; W-L
kauft in S4 mit 39,8 statt 44,5 ein. Das ist ein Nudge, keine Grenze.

**Daraus folgt: an den Faktoren zu drehen hilft nicht.** Weder 1,25/1,6 noch irgendein anderes Paar
ändert etwas daran, dass der Hebel selbst zu klein ist. Wenn die 2. Linie „wirklich teuer" sein
soll, muss der Hebel ein anderer sein — eine harte Schranke auf NEU aufgenommenes Gehalt statt
einer höheren Rücklage, mit derselben Ausnahme (unter dem Kader-Minimum wird immer gekauft).

Das ist ein Eingriff in die Spielregel und liegt zur Entscheidung bei Chris.

## Offene Nebenpunkte

- **Die Simulationsliga ist ärmer als Chris' Spielstand.** M-M steht dort nach den Käufen bei 72,4,
  auf seinem Save bei 98,7. Die Struktur des Befunds hängt nicht daran, die absoluten Zahlen schon.
- **Chris' Saison-1-Linien tragen die alten Faktoren** (Snapshot vom 19.08., 1,10/1,25 → 70,8/80,5).
  Eingefroren ist eingefroren; ab Saison 2 greifen 1,25/1,6. Ein Nachziehen wäre ein Eingriff in
  eine laufende Saison (`scripts/repariere-apron-linien.ts`) und ist nicht erfolgt.
- **Der Messlauf schreibt Balancing-Konstanten in die Quelle.** `run-resilient-multiseason.ts` ruft
  `long-run-auto-tune-organic.ts --apply`; die getunten Werte landen im Arbeitsbaum und sind einmal
  über ein pauschales `git add -A` in einen Commit gerutscht. Während ein Lauf läuft: kein
  `git add -A`.

## Werkzeuge

- `scripts/apron-bremse-sonde.ts` — Sonde am Kaufmoment (`OLY_MESS_APRON_BREMSE=<pfad.jsonl>`)
- `scripts/werte-apron-sonde-aus.ts` — Auswertung samt Käufen, getrennt nach über/unter Decke
- `scripts/messe-apron-bremswirkung.ts` — Einzelstand
- `tests/apron-linie-vorsaison-anker.test.ts` — der Anker, mit beiden Gegenproben
- `tests/ki-apron-bremse-gegenprobe.test.ts` — die Gegenrechnung kommt aus derselben Rechenstelle

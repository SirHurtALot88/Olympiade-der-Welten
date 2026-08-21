# Befund: die Apron-Bremse der KI greift ins Leere — und zwar aus Zeitgründen

**Frage von Chris:** „aber was heißt kauft munter weiter? sollte der appetit nicht das
kaufverhalten beeinflussen? Können wir das messen wie sehr der bremsfaktor sich real auswirkt?"

Berechtigt. „Kauft munter weiter" war eine Behauptung, keine Messung. Hier ist die Messung.

## Was die Bremse tut

`resolveApronTighteningMultiplier` verbietet keinen Kauf. Sie erhöht die Rücklage:

```
ruecklage = erwartetesGehalt × hoard × hoardTightening / apronFaktor + sockel
```

Ein Faktor von 0,77 macht die Rücklage also 1/0,77 = 1,30-mal so groß. Ob das ein Kaufverhalten
ändert, hängt allein daran, ob dem Team dadurch **freies Budget** verlorengeht (`cash − rücklage`).

## Wie gemessen wurde

`scripts/apron-bremse-sonde.ts` hängt im Simulationslauf genau eine Zeile vor
`runTransferWindowSession` — das ist der Moment, in dem die KI kauft. Sie schreibt je Team die
Rücklage MIT und OHNE Bremse, beides aus derselben Funktion
(`resolveTeamCashRunwayReserve`, Option `apronBremseAus`).

**Zwei frühere Messungen waren am falschen Stand** und sind zurückgezogen: mitten in der Saison
(dort hat ohnehin kaum ein Team freies Budget) und am `season_completed`-Stand (dort steht kaum ein
Team über seiner Decke, weil die Verträge gerade ausgelaufen sind). Beide Male kam „bindet nichts"
heraus, und beide Male sagte das nichts über den Kaufmoment.

## Das Ergebnis, vier Saisons

| Saison | Median-Gehalt | Linien | über der Decke | entzogenes Kaufbudget | freies Budget der Liga |
|---|---:|---|---:|---:|---:|
| S1 | 63,1 | 78,8 / 100,9 | 1/32 | 0,0 | 1,2 |
| S2 | 42,5 | 53,1 / 67,9 | 1/32 | 6,2 | 1962,5 |
| S3 | 39,4 | 49,2 / 63,0 | 2/32 | 4,1 | 2070,2 |
| S4 | 39,7 | 49,6 / 63,5 | 5/32 | 1,9 | ~2000 |

Über vier Saisons nimmt die Bremse der ganzen Liga zusammen **12,2** aus der Hand, bei rund 2000
freiem Kaufbudget je Vorsaison — ein Anteil von 0,1 bis 0,3 Prozent.

Käufe danach, Durchschnitt je Team: über der Decke 0,0 / 1,0 / 1,5 / 1,0 gegen darunter
0,03 / 3,26 / 3,27 / 3,63. Der Unterschied ist echt, aber er misst überwiegend den Kaderbedarf mit:
Teams über ihrer Decke haben in der Regel den volleren Kader.

## Zwei Dinge sind sauber

1. **Sie greift nicht daneben.** Bei Teams *unter* ihrer Decke ist der Entzug in allen vier
   Saisons exakt 0,0.
2. **Sie ist nie hart.** W-L, das am stärksten gebremste Team, geht in S3 mit 49,9 statt 53,7
   einkaufen — und kauft.

## Der Grund ist der Zeitpunkt, nicht die Stärke

Im Kaufmoment sind die Verträge gerade ausgelaufen. Das Median-Gehalt fällt von 63,1 auf rund 40,
die Linien hängen am Median und fallen mit — damit rutscht fast jedes Team unter seine eigene
Decke. Gleichzeitig steht das Cash auf dem Jahres-Maximum, weil die Preisgelder gerade gebucht
sind.

**Die Bremse prüft den Gehaltsstand also in seinem Jahres-Tief, genau in dem Augenblick, in dem
entschieden wird.** Binden würde sie mitten in der Saison — dort kauft aber niemand.

Daraus folgt unmittelbar: die Bremse **stärker** zu machen ändert praktisch nichts. Die Bedingung
„du stehst über deiner Decke" ist im Kaufmoment fast nie wahr, und ein größerer Faktor auf einer
Bedingung, die nicht zutrifft, bleibt wirkungslos.

## Was das für den naheliegenden Gegenvorschlag bedeutet

Der Vorschlag „wer über seiner Ambitions-Decke steht, darf kein NEUES Gehalt aufnehmen" ist
**hiermit zurückgezogen**. Er stellt dieselbe Frage im selben Moment und liefe damit genauso ins
Leere: in S4 hätte er 5 von 32 Teams betroffen, die zusammen kaum etwas ausgeben.

Zwei Richtungen, die am gemessenen Grund ansetzen statt an der Stärke:

- **Gegen das geplante Gehalt prüfen, nicht gegen das aktuelle.** Die Größe existiert bereits:
  `projectExpectedSalaryAtPlannerTarget` rechnet aus, wo die Gehaltssumme nach dem geplanten Kader
  steht, und wird für die Rücklage schon benutzt — nur die Apron-Frage liest sie nicht.
- **Die Linien am abgerechneten Median der Vorsaison verankern**, statt am eingebrochenen der
  laufenden.

Beides ist ein Eingriff in die Regel und keine Messung mehr. Beides gehört vor der Umsetzung an
denselben vier Saisons gemessen.

## Werkzeuge

- `scripts/apron-bremse-sonde.ts` — Sonde am Kaufmoment (`OLY_MESS_APRON_BREMSE=<pfad.jsonl>`)
- `scripts/werte-apron-sonde-aus.ts` — Auswertung samt Käufen, getrennt nach über/unter Decke
- `scripts/messe-apron-bremswirkung.ts` — Einzelstand
- `tests/ki-apron-bremse-gegenprobe.test.ts` — hält fest, dass die Gegenrechnung aus derselben
  Rechenstelle kommt

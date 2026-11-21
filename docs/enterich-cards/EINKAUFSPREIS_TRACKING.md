# Einkaufspreis-Tracking aus dem Billbee-Abgleich (Chris, 21.11.2026)

**Idee:** Chris trägt beim Einkaufen den neuen EK in Billbee ein. LEC liest bei jedem Abgleich (alle 3 Stunden) Bestand und EK und erkennt daraus Einkäufe.

**Regel** (`src/lib/billbee/purchases.ts`, aufgerufen aus `sync.ts` nach dem Neuaufbau der Verkäufe):
- Steigt der Bestand eines aktiven Artikels gegenüber dem vorigen API-Abgleich, ist der Zuwachs ein Einkauf zum **EK nach dem Abgleich**.
- Ändert sich der EK nicht, wurde zum selben Preis eingekauft.
- Stück, die zwischen den Abgleichen verkauft wurden, werden zum Zuwachs addiert (Bestand 4 → 8 mit 2 Verkäufen dazwischen = 6 gekauft).
- Der erste API-Abgleich ist nur Ausgangsbestand. Ohne EK (0 oder leer) wird nichts gebucht.
- Gespeichert wird in `Purchase` mit Quelle „Billbee-Abgleich" (Datum = Zeitpunkt des Abgleichs).

**Wo man es sieht:** Drawer → Lager: „Eingekauft: N Stk · Summe · Ø" ist der gewogene Durchschnitt, die einzelnen Einkäufe stehen in der Bewegungsliste, der EK-Verlauf in „EK-Verlauf". Zusätzlich füllt es das Einkaufstempo auf Finanzen.

**Grenzen:**
- Stornierte Bestellungen oder Rücknahmen erhöhen den Bestand ebenfalls und würden als Einkauf gebucht (zum aktuellen EK).
- Trägst du den EK erst nach dem nächsten Abgleich ein, steht der Einkauf noch zum alten Preis drin.
- Mehrere Einkäufe zwischen zwei Abgleichen erscheinen als ein Einkauf mit dem letzten EK.

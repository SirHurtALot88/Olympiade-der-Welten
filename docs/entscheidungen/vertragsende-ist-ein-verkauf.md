# Ein Vertragsende ist ein Verkauf

**Chris' Entscheidung, 16.08.2026:** „ja gleicher abschlag wie beim verkauf -> du musst es so
sehen dass contract exits im grunde nichts anderes als ein verkauf sind bei uns im spiel."

## Warum die Frage überhaupt aufkam

Beim Nachverfolgen von Meldung `zuxbr3` („VK vs Marktwert zeigt zwei verschiedene Zahlen") kam
heraus, dass der Verkaufsweg den Preis durch `applySellPricingPolicyToBreakdown` schickt —
Saisonstart-Abschlag × Timing × Kaderdruck × Team-Fit — die Auslauf-Tabelle aber nicht.

Der Beleg kam aus der Buchung, nicht aus der Herleitung: Lava Golem wurde am Live-Spielstand
`hwz8fk` zwölf Minuten nach der Meldung verkauft, die Transferhistorie zeigt `fee 28.09`, während
der rohe Breakdown 29,48 sagt. Verhältnis 0,9528 — exakt die Policy.

Die **Anzeige** wurde daraufhin in `contract-negotiation-preview.ts` nachgezogen. Offen blieb die
**Buchung**: `buildContractExitValue` (`contract-renewal-service.ts`) rechnete weiter roh. Damit
hätte die Oberfläche die richtige Zahl gezeigt und die falsche gutgeschrieben — der schlechtere
von zwei Zuständen, weil er unsichtbar ist.

Ob dort derselbe Preis gelten soll, ist keine Reparatur, sondern eine Spielregel. Deshalb lag sie
Chris vor.

## Was die Regel bedeutet

Vertragsende, Auflösung auf Spielerwunsch und der Saisonende-Vertragstick sind wirtschaftlich
Abgänge wie ein Marktverkauf und werden genauso bepreist. Es gibt eine Preisregel, nicht zwei.

**Es ist kein Strafabschlag.** Über die fünf Live-Spielstände gemessen ändert sich die Buchung bei
praktisch jedem Vertrag, aber in beide Richtungen — im gemeldeten Save waren 136 von 336 vorher zu
HOCH, die übrigen zu NIEDRIG. Der Kaderdruck kann aufschlagen statt abzuziehen. Genau darum ist
„gleich wie beim Verkauf" die richtige Formulierung und nicht „etwas abziehen".

| Spielstand | Verträge | Buchung geändert | davon vorher zu hoch | Ø Korrektur | größte |
|---|---|---|---|---|---|
| `hwz8fk` | 336 | 336 | 136 | 1,87 | 14,68 |
| `0kalpx` | 343 | 343 | 275 | 1,30 | 22,25 |
| `1hf25q` | 340 | 340 | 296 | 1,59 | 10,98 |
| `h0z7cl` | 337 | 336 | 268 | 1,11 | 10,68 |
| `n90y4m` | 335 | 335 | 335 | 1,93 | 11,19 |

## Was ausdrücklich NICHT mitwandert

`marketValueAtExit` bleibt der **rohe** Marktwert. Er ist der Vergleichsmaßstab, gegen den die
Auslauf-Tabelle ihren Auf- oder Abschlag ausweist. Verschöbe er sich mit, wäre die angezeigte
Differenz wieder eine andere Zahl als die, die der Spieler sieht — und der Widerspruch aus `zuxbr3`
wäre unter neuem Namen zurück.

## Wo die Regel steht

* `lib/contracts/contract-renewal-service.ts` → `buildContractExitValue` (Buchung, Gutschrift,
  Transferhistorie)
* `lib/market/contract-negotiation-preview.ts` (Anzeige der auslaufenden Verträge)
* `lib/market/transfermarkt-local-service.ts` (Verkaufsvorschau und Ausführung)

Alle drei rufen `applySellPricingPolicyToBreakdown` mit derselben Kaderdruck-Regel: `rosterAfter`
ist die Kadergröße **nach** dem Abgang, sonst bewertete der Malus einen Kader, den es danach nicht
mehr gibt.

Festgehalten in `tests/vertragsende-ist-ein-verkauf.test.ts`.

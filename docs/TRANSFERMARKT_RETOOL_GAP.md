# Transfermarkt Retool Gap

## Ziel

Diese Notiz trennt klar zwischen:

- bereits 1:1 uebernommenen Retool-Elementen
- bewusst read-only portierten Annaeherungen
- noch offenen Luecken

## Matcht bereits gut

- Hauptreihenfolge der Kernspalten:
  - `Bild`
  - `Name`
  - `Marktwert`
  - `Gehalt`
  - `Pow`
  - `Spe`
  - `Men`
  - `Soc`
  - `Klasse`
  - `Fit`
  - `Bracket`
  - `Rasse`
  - `>20`
  - `>40`
  - `>60`
  - `>80`
- Erweiterte Spalten mit Retool-Namen:
  - `Subclass 2`
  - `Subclass 1`
  - `Subclass 3`
  - `Alignment`
  - `Trait+1`
  - `Trait+2`
  - `Trait+3`
  - `Trait-1`
  - `Trait-2`
  - `Trait-3`
  - `Geschlecht`
  - `Marktwert gehalt ratio`
  - `Fit Rasse`
  - `Fit Subclasses`
  - `Fit Traits`
  - `Fit Alignment`
- Rechte Filterlabels wurden an Retool angezogen:
  - `Team`
  - `Spielername`
  - `Rasse`
  - `Klasse`
  - `Subclass`
  - `Kartenfarbe`
  - `Traits+`
  - `Traits-`
  - `Bracket`
  - `Alignment`
  - `Geschlecht`
  - `Power (Pow)-100`
  - `Speed (Spe)-100`
  - `Mental (Men)-100`
  - `Social (Soc)-100`
  - `Reload data`
  - `Alle Filter zuruecksetzen`
- Teamfilter-Verhalten:
  - mit Team werden nur Spieler mit `fit > 0` gezeigt
  - `Mercenary` bleibt immer sichtbar

## Bewusste Approximationen

- `Fit`
  - basiert aktuell auf einer lokalen, Retool-nahen Read-only-Approximation
  - die Struktur ist gleich:
    - `Fit Rasse`
    - `Fit Alignment`
    - `Fit Subclasses`
    - `Fit Traits`
  - die exakten Retool-Matrixquellen liegen lokal aber noch nicht vollstaendig als kanonische DB-Quelle vor
- `Kartenfarbe`
  - Retool zeigt das Feld sichtbar
  - im aktuellen Prisma-/Read-Pfad gibt es dafuer noch keine belastbare Transfermarkt-Quelle
  - deshalb ist das Feld derzeit sichtbar benannt, aber noch nicht fachlich portiert

## Noch offene Luecken

- Retool zeigt zusaetzliche Attributspalten wie:
  - `Hea`
  - `Sta`
  - `Int`
  - `Det`
  - `Awa`
  - `Dex`
  - `Cha`
  - `Wil`
  - `Spi`
  - `Tor`
- Diese Werte sind aktuell nicht als eigene, bestaetigte Transfermarktquelle im neuen Read-Pfad verdrahtet.
- Wishlist-/Package-/Kaufen-Buttons aus Retool sind absichtlich nicht Teil des read-only Markts.

## Sicherheitsregel

Wenn ein Retool-Feld lokal noch keine belastbare Quelle hat:

- nicht stillschweigend erfinden
- nicht per Fake-Default fuellen
- lieber sichtbar als Luecke kennzeichnen


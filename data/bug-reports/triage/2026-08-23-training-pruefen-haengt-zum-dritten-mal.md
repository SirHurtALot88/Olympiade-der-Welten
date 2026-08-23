# „Training prüfen" hängt — zum dritten Mal, und diesmal an der Wurzel

**Gemeldet** 23.08.2026 von Chris, mit Bildschirmfoto des Knopfs „Weiter Training prüfen":

> „und der training prüfen button hängt immernoch bitte fixen"

**Status: behoben.**

## Zweimal vorher „behoben", und beide Male richtig

| Meldung | Was geschlossen wurde |
|---|---|
| `j53iox` | Der **Saisonwechsel** setzt den Trainings-Vorgabewert jetzt auch. |
| `hnbng4` | Der **Direktkauf** setzt ihn jetzt auch. |

Beide Fixes stimmen. Beide helfen Chris nicht — sie setzen den Wert bei **neuen** Vorgängen. Wer
schon ohne Trainingsmodus im Kader steht, steht dort weiter, und **ein einziger solcher Spieler
hält den ganzen Flow auf**.

## Am Live-Abbild vom 23.08. reproduziert

`findPlayersWithoutTrainingMode` je Menschen-Team:

| Spielstand | Team | fehlt | wer |
|---|---|---|---|
| **`swnjlk`** (Chris') | V-W | **1** | **Johanna** |
| `h0z7cl` | T-G | 8 | Fungor, Exsukkator, Rootheart, Spineshard, Mokra, … |
| `n90y4m` | C-C | 2 | Gary the Keeper, King Arlen Morgolor |

**Alle elf kamen über `manual_transfermarkt_buy`** — also genau den Weg, den `hnbng4` geschlossen
hat, nur eben *vor* dem Fix. Johanna wurde am 22.08. gegen 10:00 gekauft, der Fix landete am Abend
desselben Tages. Kein Weg im Spiel setzt den Wert danach noch nach: die Sperre bleibt für immer,
weil sie an einem Datensatz hängt, den niemand mehr anfasst.

## Der Eingriff: heilen statt einen vierten Schreibweg schließen

`applyDefaultTrainingFieldsToRosteredPlayers` läuft jetzt an zwei zusätzlichen Stellen in
`lib/persistence/save-repository.ts`:

1. **Auf dem Ladeweg** (`materializePersistedSave`) — die Stelle, die *jeden* bestehenden
   Spielstand erreicht. Dort stehen bereits vier idempotente Nachzüge derselben Bauart
   (`ensurePlayerBaselines`, `ensurePlayerInjuryHistoryForGameState`,
   `ensurePlayerPotentialForGameState`, `ensureNulaOnProjectSuicide`); dieser ist der fünfte.
2. **Auf dem Schreibweg** (`saveGameState`) — sonst hält der Sitzungs-Cache die Lücke am Leben:
   `saveGameState` legt seinen Rückgabewert in `writeSaveSessionCache`, und ein Lauf, der speichert
   und gleich wieder liest, bekäme weiter den ungeheilten Stand.

Beides ist idempotent: wer einen Modus hat, behält ihn; wer keinen Kaderplatz hat, bekommt keinen.

## Wirkung, am echten Abbild gemessen

`scripts/pruefe-trainingsmodus-luecken.ts` gegen dieselbe Kopie:

```
ohne die Ladeweg-Heilung : 11 Spieler in 3 Spielständen
mit ihr                  : keine Lücke — 9 von 9 Menschen-Teams frei
```

## Eine Selbstkorrektur, damit sie im Beleg steht

Die erste Fassung der Testdatei hatte einen Fall „heilt auch den kalten Ladeweg". **Er hat nichts
geprüft**: Gegenprobe gefahren, blieb er grün, auch als die Ladeweg-Heilung entfernt war — der
Lesepfad baut die Spielerliste nicht allein aus der `players`-Zeile, die der Fall manipulierte. Ein
Test, dessen Scheitern man nie gesehen hat, ist keiner; er ist entfernt statt umgeschrieben. Der
Beleg für die Ladeweg-Heilung ist deshalb die Messung am Live-Abbild, nicht ein Testfall.

## Geprüft

`tests/trainingsmodus-heilt-beim-laden.test.ts`, 3 Fälle (Schreibweg, Idempotenz, keine
Vereinslosen). **Gegenprobe: ohne die Schreibweg-Heilung fallen 2.**

`tsc` leer · `ci:import-exists` (2313) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Persistenz-Suiten (1375) · `NODE_ENV=production npx tsx server.ts` zeigt „Oly Room laeuft".

changelog: 2026-08-23-trainingsmodus-heilt-bestehende-spielstaende.json

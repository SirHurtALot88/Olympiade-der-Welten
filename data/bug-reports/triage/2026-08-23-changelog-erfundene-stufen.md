# Changelog-Reiter: 47 Einträge standen unter „Ohne Einstufung", weil ich Vokabeln erfunden habe

**Nicht gemeldet — beim Bauen von #647 aufgefallen.** Der Generator warnte, mein frischer Eintrag
habe „kein (lesbares) gewicht-Feld", obwohl `"gewicht": "mittel"` daneben stand.

**Status: gebaut.**

## Der Befund

`lib/changelog/changelog.ts:36` führt genau vier Stufen:

```ts
export const CHANGELOG_GEWICHTE = ["grundlegend", "spielblockierend", "behebung", "feinschliff"] as const;
```

`normalisiereChangelogGewicht` (Zeile 48) gibt für **jeden** anderen Wert `null` zurück. Das ist die
richtige Entscheidung — der Kommentar sagt warum: *„Alles andere ist keine Stufe — lieber null als
geraten."* Nur fällt sie lautlos aus: kein Fehler, kein roter Test, kein Typverstoß. Beide Felder
sind freier Text (JSON-Eintrag bzw. Zeile in der Triage-Notiz).

**Nachgezählt am 23.08.2026:** 47 der 400 Einträge trugen ein Wort, das der Quelltext nicht kennt.

| erfunden | Anzahl |
|---|---|
| `normal` | 14 |
| `wichtig` | 9 |
| `klein` | 9 |
| `mittel` | 3 |
| `stoerend`, `hintergrund`, `gross` | je 2 |
| `verbesserung`, `kosmetik` | je 1 |
| Feld auf `null` | 4 |

Dazu 26 Triage-Notizen mit einer `schwere:`, die es im Typ nicht gibt — `schwere` ist laut
`lib/bug-report/bug-report-triage.ts:57` genau `hoch | mittel | niedrig`, im Bestand standen
`klein` (18), `gering` (5), `wunsch` (2), `gross` (1). Die fällt doppelt aus: sie stuft nicht ein
**und** sie trägt nicht zurück, wenn die `gewicht:`-Zeile fehlt.

**Was Chris davon gesehen hat:** einen Abschnitt „Ohne Einstufung" mit über vierzig Zeilen am Ende
des Reiters, während die vier Stufen darüber halb leer standen. Die Sortierung des Reiters ist
Gewicht vor Datum — genau die Einteilung, die die Frage „was war groß?" beantworten soll.

**Alle 47 sind meine.** Der Generator mahnte sie jedes Mal an, in einer Liste, die lang genug
geworden war, dass ich sie überflogen habe.

## Was gebaut ist

1. **Alle 47 Einträge auf eine der vier Stufen gezogen**, nach dem Text eingeordnet:
   Spielblocker → `spielblockierend`, neues/umgebautes System → `grundlegend`, normale Behebung →
   `behebung`, Beschriftung/Farbe/CI-Werkzeug → `feinschliff`.
2. **Das `schwere:`-Vokabular normalisiert:** `klein`/`gering`/`wunsch` → `niedrig`, `gross` →
   `hoch`. Zwei Notizen ohne jede Einstufung (`8sbs35`, `pn7mqj`) haben eine ausdrückliche
   `gewicht: feinschliff`-Zeile bekommen.
3. **Ein Riegel:** `tests/changelog-gewicht-vokabular.test.ts`.

Der Generator meldet danach **keinen** Eintrag mehr ohne Gewichtung (vorher 47).

## Was der Riegel prüft — und was ausdrücklich nicht

Er prüft **Vokabular**, nicht Einstufung. Ob ein Fix wirklich `behebung` und nicht `feinschliff`
ist, kann kein Skript entscheiden; dass jemand ein Wort benutzt, das nirgends definiert ist, sehr
wohl. Ein **fehlendes** Feld bleibt erlaubt — die README nennt das eine dokumentierte Lücke. Ein
dagewesenes, aber unbekanntes Wort ist etwas anderes: da wollte jemand einstufen und hat
danebengegriffen.

Vier Fälle: gepflegte Einträge, Triage-`gewicht:`, Triage-`schwere:`, und die Zahl der Einträge, die
im gebauten `CHANGELOG.json` ohne Stufe stehen (muss 0 bleiben).

**Gegenprobe gefahren:** ein Eintrag zurück auf `"klein"` gesetzt → der erste Fall fällt und nennt
Datei und Wort. Zurückgesetzt.

Der Wächter läuft im Pflicht-Job mit: die `readFileSync(join(process.cwd()`-Aufrufe sind
ausgeschrieben, damit `fahre-quelltext-waechter.ts` ihn einsammelt (Auswahl 135 → 136 Dateien).

## Geprüft

`tsc` leer · `ci:import-exists` (2327) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1976) · Render-Wächter (217) · `ci:quittungen` ok.

changelog: 2026-08-23-changelog-stufen-stimmen-wieder.json

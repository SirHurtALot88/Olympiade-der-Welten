# Fix: Bühnen-Disziplinen paaren jetzt nach Slot, nicht nach Kaderliste

Auftrag von Chris, wörtlich: „Bühnen-Disziplinen nach Slot paaren statt nach Kaderliste".

## Befund

`bauBuehne()` (`public/mockups/battle-mode.engine.js`) baut `mine`/`gegner` aus `inDisc(d)`
bzw. `OPP.filter(...)` — das filtert SQUAD/OPP nur auf "wer ist in dieser Disziplin gesetzt",
ändert aber NICHT die Reihenfolge. Diese Reihenfolge ist die Kaderliste (SQUAD-Array-
Reihenfolge), nicht der Slot, den der Manager in der Einsatzliste tatsächlich zugewiesen hat
(`place[p.n].slot`).

Drei Stellen im selben Motor paaren Teilnehmer trotzdem **per Array-Index** gegeneinander, unter
der (bisher falschen) Annahme, dieser Index SEI bereits der Slot:

1. **`art.duell`-Block** (Speed-Schach, Tennis, Fechten): `mine[i]` gegen `gegner[i]`, `i` wird
   `.brett`. Betrifft auch das Tennis-Doppel (letzte zwei Bretter) und die Fechtstaffel-
   Enthüllungsreihenfolge (F-F1), die beide denselben Index erneut lesen.
2. **`baueHebenDuelle()`** (Gewichtheben): Kommentar dort behauptete ausdrücklich "Beide Seiten
   bekommen ihre Rollen in derselben Listenreihenfolge (slotsVon)" — stimmte im Produktivpfad
   nicht. `HEBEN_ROLLEN[i]` (Eröffnungshöhe, Rollen-Archetyp) hing an genau diesem falschen Index.
3. **`baueGauntlet()`** (Breaking): Kommentar behauptete "`mine`/`gegner` sind die feste
   Aufstellungsreihenfolge (Team-Slot 1..n)" — ebenfalls falsch. Das ist die Kette, die Chris
   am 22.09. ausdrücklich für Slot 6 als "Anker, der noch mal richtig aufholen kann" wollte;
   ohne den Fix war Slot 6 in der Kette irgendein Kaderlisten-Platz, nicht der echte Slot 6.

Die Lücke wurde unabhängig ein zweites Mal gefunden: der Mini-Feld-Agent (PR #1358) stieß beim
Bau der Formations-Geometrie auf denselben Befund und schlug dafür einen eigenen Task vor
(`task_6bcfec28`, dieser Fix macht ihn überflüssig).

## Fix

Eine einzige neue Sortierung in `bauBuehne()`, direkt nach der Definition von `slotFuer()`:

```js
const slotRang=(s)=>{const pos=slotListe.findIndex(x=>x.id===s);return pos>=0?pos:slotListe.length;};
const nachSlotgeordnet=(arr)=>arr.map((p,i)=>({p,r:slotRang(slotFuer(p,i))})).sort((x,y)=>x.r-y.r).map(x=>x.p);
const mineGeordnet=nachSlotgeordnet(mine), gegnerGeordnet=nachSlotgeordnet(gegner);
```

`mine`/`gegner` selbst bleiben unangetastet — sie speisen weiterhin `setz()`/`slotFuer(p,idx)`
für den Slot-Aufschlag und für die Ersatzbank-Rundlauf-Zuweisung (dort ist `idx` der einzige
Slot-Anker; eine Vorab-Umsortierung wäre dort zirkulär). Nur die drei Paarungsstellen oben lesen
jetzt `mineGeordnet`/`gegnerGeordnet` statt `mine`/`gegner`.

Speed-Schach hat weniger Slots (4) als Bretter (6) — dort teilen sich zwangsweise mehrere
Bretter einen Slot-Rang; der stabile Sort lässt sie in ihrer bisherigen Reihenfolge, also kein
Fehlverhalten, nur keine zusätzliche Präzision für diese sechs Bühne.

## Warum die Abnahmezahl sich NICHT bewegt

`scripts/miss-alle-disziplinen.mjs` (die rho-Schranke aus CLAUDE.md) setzt nie eine echte
Einsatzliste — `place[p.n]` bleibt leer, `slotFuer()` fällt sofort auf den Rundlauf-Fallback
zurück, und `nachSlotgeordnet()` ist für diesen Fall ein No-Op (Sortierschlüssel ist bereits der
Array-Index). Nachgemessen: beide Stände (vor/nach dem Fix, `git stash`) liefern bit-identische
Zahlen für alle fünf betroffenen Disziplinen:

| Disziplin | rho je Spiel (Median) | Abnahme |
|---|---:|---|
| Speed-Schach | 0,910 | bestanden |
| Gewichtheben | 0,865 | bestanden |
| Fechten | 0,860 | bestanden |
| Tennis | 0,813 | bestanden |
| Breaking | 0,801 | bestanden |

Der Fix wirkt ausschließlich dort, wo eine ECHTE Einsatzliste steht — also im echten Spiel, nie
in der Messsonde. Pp-Abweichung ist aus demselben Grund unberührt: keine Attribut-zu-Skill-
Formel wurde geändert, nur welche zwei bereits fertig durchgerechneten Teilnehmer gegeneinander
verglichen/gelistet werden.

## Geprüft

- Isolierte Algorithmus-Probe (sechs Spieler je Seite, Slot-Zuweisung bewusst gegen die
  Kaderliste gemischt): vorher 1 von 6 Brettern zufällig slot-gleich, nachher 6 von 6.
- `node --check public/mockups/battle-mode.engine.js` — syntaktisch sauber.
- `miss-alle-disziplinen.mjs` vor/nach `git stash`: bit-identisch (s. Tabelle oben).
- `miss-arena-buehne-spiegel.mjs 200` für alle fünf Disziplinen: Abweichung weiterhin im
  niedrigen einstelligen Prozentbereich, keine neue Seitenschieflage.
- Relevante Vitest-Suiten (`arena-chromium-revision-goldentest`, `battle-mode-pps-duell`,
  `pps-duell-bruecke-score-kanal`, `battle-mode-arena-resolve-engine`, `arena-headless-runner`,
  `arena-kulissen`, `battle-mode-arena-team-points`): 135 bestanden, 0 fehlgeschlagen.

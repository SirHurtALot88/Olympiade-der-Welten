# Der Endstand nach MD10 weicht vom Spieltagsergebnis ab — Meldung, noch nicht untersucht

**Gemeldet von Chris** (Saisonstand, nach Spieltag 10):

> „das endergebnis was mir gezeigt wurde in MD10 hat nichts mit dem zu tun was nun hier steht???
> M-M war dort noch platz 4, H-R blieb auf 2, G-G waren 11. wieso weicht das ab von dem was die
> änderung am spieltagsergebnis angezeigt hat? wenn alle spiele durch sind muss das ja auch das
> endergebnis sein!"

Er hat recht, und die Tabelle bestätigt seine Zahlen selbst.

## Was belegt ist

Die ±-Spalte im Saisonstand rechnet die Bewegung aus `matchdayBaselinePoints` — dem Punktestand
**vor** der letzten Wertung (`lib/foundation/season-standings-matchday-rank-delta.ts:97`). Sie sagt
also, wo ein Team vor MD10 stand. Abgleich mit Chris' Erinnerung:

| Team | Rang jetzt | ± laut Tabelle | daraus: Rang vorher | Chris erinnert |
|---|---|---|---|---|
| Mayhem Mavericks | 2 | ▲ +2 | 4 | **4** ✓ |
| Hell Raisers | 4 | ▼ −2 | 2 | **2** ✓ |
| Golden Gladiators | 6 | ▲ +4 | 10 | 11 (≈) |

Die Zahlen aus dem MD10-Bildschirm sind also nicht falsch *erfunden* — es sind exakt die Ränge
**vor** der Verbuchung von MD10. Der Endstand-Bildschirm zeigte den Stand, als wären die Punkte des
gerade gespielten Spieltags noch nicht gebucht. Genau das widerspricht Chris' berechtigter
Erwartung: sind alle Spiele durch, ist das gezeigte Ergebnis der neue Stand.

## Zwei Spuren, beide noch zu prüfen

1. **Zeigt der Endstand-Bildschirm `currentRank` statt `projectedRank`?** Die Preview-Engine rechnet
   beide (`lib/standings/standings-preview-engine.ts:559` und `:821`) — `currentRank` ist der Stand
   vor dem Spieltag, `projectedRank` der danach. Verwechselt die Ansicht die beiden, entsteht genau
   dieses Bild. Das ist die naheliegendste Erklärung und zuerst zu prüfen.

2. **Zwei Projektionspfade, nur einer ist idempotent.** Der erste rechnet bewusst aus der
   gespeicherten Baseline, „so a forceReplace re-apply of the SAME matchday does not double-count"
   (`standings-preview-engine.ts:479-485`). Der zweite (`:815-818`) rechnet dagegen schlicht
   `currentPoints + pointsDelta`, ohne diese Absicherung. Ist der Spieltag schon gebucht, zählt er
   die Punkte doppelt. Das erklärt Chris' Beobachtung zwar **nicht** (es würde zu hohe, nicht zu
   niedrige Ränge ergeben), ist aber ein eigener Fehler im selben Modul und gehört mituntersucht.

## Vor dem Bauen

Erst nachstellen: den Spielstand vor und nach der MD10-Wertung nebeneinander legen und ausgeben,
was der Endstand-Bildschirm liest und was der Saisonstand liest. Erst wenn die abweichende Quelle
mit Datei:Zeile benannt ist, wird gebaut — hier hängen Punktestand und Rangordnung dran, also gilt
die Regel besonders streng: keine Vermutung als Befund.

Achtung, parallele Arbeit: PR #404 fasst den Spieltagsabschluss an
(`claude/matchday-completion-arena-booking-...`). Vor dem Anfassen abgleichen.

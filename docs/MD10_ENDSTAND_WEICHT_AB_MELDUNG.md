# Der Endstand nach MD10 weicht von der Saisontabelle ab — Ursache und Fix

**Gemeldet von Chris** (Saisonstand, nach Spieltag 10):

> „das endergebnis was mir gezeigt wurde in MD10 hat nichts mit dem zu tun was nun hier steht???
> M-M war dort noch platz 4, H-R blieb auf 2, G-G waren 11. wenn alle spiele durch sind muss das ja
> auch das endergebnis sein!"

Und mit dem entscheidenden Hinweis nachgeschoben:

> „ich weiß nicht ob da vllt noch die bonus punkte nicht berücksichtigt werden oder so aber das war
> eindeutig falsch weil ich schon dachte schade für M-M dass sie es nicht geschafft haben aufs
> treppchen und plötzlich sind sie doch 2."

Der Hinweis war richtig. Es waren die Bonuspunkte.

## Ursache 1 — der Mutator-Bonus fehlte in der Projektion

`resolveProjectedRanksFromMatchday` (`DisciplineStageMatchdayPanel.tsx`) projizierte den neuen
Saison-Rang aus `currentPoints + sum`. `sum` sind aber **nur die beiden Disziplin-Punkte**. Die
Gesamt-Spalte direkt daneben zeigt `total`, und das ist `sum + mutPp` — der Mutator-Bonus des
Spieltags gehört dazu und wird in der Saisontabelle gebucht (dort die Spalte BONUS, im gemeldeten
Bild 6,9 für M-M und 7,5 für H-R).

Die Endtabelle ordnete die Teams also nach einer **anderen Zahl** als der, die am Ende gebucht wird.
Wer viel Bonus holte, stand zu tief — genau M-M. Der Fix rechnet mit `total`.

Formkarten- und Captain-Beitrag stecken bereits in den Disziplin-Punkten (so sagen es die Tooltips
derselben Tabelle) und werden deshalb **nicht** noch einmal addiert. Nur der Mutator-PP steht daneben.

## Ursache 2 — zwei Ranglisten in einer Spalte

Unabhängig davon füllte die Panel-Logik nur die **Lücken**: Teams mit gespeicherter Projektion
behielten den Rang der Engine, alle anderen bekamen den aus den Arena-Ergebnissen abgeleiteten.
Beides sind für sich stimmige Ranglisten — aber es sind zwei, jede über eine andere Teilmenge
durchnummeriert. Zusammen in einer Spalte ergeben sie eine Reihenfolge, die keiner von beiden
entspricht: Ränge doppelt vergeben, andere gar nicht.

Ein Rang ist nur als vollständige Ordnung eine Aussage. Jetzt gilt: entweder alle aus der Engine
(dann ist der Spieltag übernommen und sie ist verbindlich) oder alle abgeleitet. Gemischt wird nicht.

## Tests

`tests/matchday-panel-order.test.ts`, erweitert auf 15 Fälle — darunter Chris' Fall mit den echten
Zahlen (ohne Bonus liegt M-M hinter H-R, mit Bonus davor) und ein Fall gegen das Mischen der
Ranglisten. Gegenprobe **ausgeführt**: ohne den Fix 3 von 15 rot.

## Was dagegen spricht

- Die Projektion bleibt eine Projektion. Sie stimmt jetzt in der Rechengröße mit der Buchung
  überein, aber solange der Spieltag nicht übernommen ist, kann eine spätere Korrektur am Ergebnis
  sie weiterhin verschieben. Verbindlich ist die Saisontabelle.
- **Ungeprüft geblieben:** ob der Bonus auch anderswo in der Arena-Ansicht fehlt (Briefing,
  Team-PP-Panel). Geprüft und behoben ist der Pfad, der den Endstand ordnet.
- Ein zweiter, davon unabhängiger Verdacht steht noch offen: von den zwei Projektionspfaden in
  `standings-preview-engine.ts` sichert nur einer gegen Doppelzählung ab, wenn ein Spieltag bereits
  gebucht ist (`:479-485` mit Baseline, `:815-818` ohne). Das erklärt Chris' Fall nicht, ist aber
  ein eigener Fehler im selben Modul.

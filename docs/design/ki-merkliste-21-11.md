# KI-Merkliste fremder Spieler (21.11.)

Chris, 21.11.: „ja, KI soll eine Merkliste fremder Spieler bekommen“. Damit entsteht die Postfach-Meldung „Interesse an einem Spieler“.

## Ableitung (keine neue Heuristik)

`lib/ai/ki-merkliste.ts` bewertet für jedes KI-Team alle Spieler, die einem **anderen** Team gehören, mit der Funktion, nach der die KI beim Kauf wählt:
`buyUtility(spieler, zustand)` aus `lib/ai/organic-squad/utility.ts`. Der Zustand kommt aus demselben Planrahmen wie beim echten Kauf
(`buildOrganicDraftFrame`: Kader, Bedarf je Disziplin, Kasse, Forecast, Identität, GM-Gewichte, Vorstands-Topf), ohne Zufalls-Saatgut.
Ein Spieler kommt auf die Liste, wenn
1. `buyUtility` größer ist als `stopUtility` desselben Zustands („lieber nichts tun“ verliert), und
2. das Team ihn zahlen könnte (Ablöse höchstens Kasse und höchstens freier Investitionstopf des Vorstands).

Je Team höchstens `KI_MERKLISTE_MAX` = 6, absteigend nach Vorsprung (Gleichstand nach `playerId`). Stufe nach Vorsprung relativ zum besten Kandidaten des
Teams: ab 0,85 Wunschziel (3), ab 0,65 interessiert (2), sonst beobachtet (1). Grund: die Disziplin mit dem größten Bedarf-mal-Wert des Spielers
(Bedarf aus `computeDisciplineNeeds`) und wie viele solide Spieler (> 60) das Team dort schon hat.
Nur Teams mit `controlMode === "ai"` führen eine Liste.

## Speicherort und Zeitpunkt

`seasonState.kiMerkliste[teamId]` (Typ `KiMerklisteEintrag`) und `seasonState.kiMerklisteStand`. Neu gerechnet beim Spieltagsabschluss
(`matchday-progress-service.ts`, nach dem Fortschreiben von Form und Moral, vor dem Einfrieren am Saisonende); `seit` bleibt, solange der
Spieler auf der Liste steht. Scheitert die Rechnung, bleibt die alte Liste, der Abschluss läuft weiter. Abschalten: `OLY_KI_MERKLISTE=0`.
Leseseite ohne Kaderplanung: `lib/ai/ki-merkliste-lesen.ts` (für Postfach und Drawer).

## Wirkung auf Käufe: keine

Die KI kauft ausschließlich aus dem Pool freier Spieler (`executeLocalTransfermarktBuy` mit `fromTeamId: null`); es gibt keinen Kaufweg von Team zu Team.
Ein Merkliste-Spieler lässt sich über die bestehenden Kauf- und Angebotswege deshalb nicht ansprechen, und es gibt keinen sauberen Anknüpfungspunkt, ohne
einen neuen Transferweg zu erfinden. Das Kaufverhalten bleibt unverändert; Wertungs-Fingerabdruck `GESAMT eaafed96150e` unverändert.
Die Meldung sagt das ehrlich: „Ein Hinweis, kein Angebot“.

## Meldung und Drawer

`buildKiInteresseMeldungen` (`lib/foundation/inbox-neue-meldungen.ts`): je Spieler und KI-Team eine Info-Meldung an den Besitzer-Manager
(über das Team, `controlMode` manual; nie hart ein Name), höchstens 5 je Team. Die Stufe steckt in der Kennung: dieselbe Meldung über alle Spieltage,
bei höherer Stufe eine neue (ungelesen). Sie steht in „Im Blick behalten“, hält den Spieltag nie auf, Absender „Markt & Scouting“. Der Text nennt Team, Stufe,
seit wann und den Disziplin-Bedarf des KI-Teams, keine Werte (Scouting-Nebel). Im Kurzprofil eines eigenen Spielers steht eine Zeile „Auf der Merkliste von …“.

## Messung (Kopie des live-save-Abbilds, Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, Spieltag 12)

`scripts/miss-ki-merkliste.ts`: 31 KI-Teams, 834 ms gesamt (27 ms je Team, so viel kommt zum Spieltagsabschluss hinzu), deterministisch.
Längen je Team: 17 Teams voll (6), eines mit 2, 13 mit 0 (nichts bezahlbar oder nichts besser als „nichts tun“). Stufen 1/2/3: 19/33/52.
In dieser Lage steht kein Spieler des menschlichen Teams (Death Peaches) auf einer Liste; für die Aufnahmen rechnet
`scripts/ki-merkliste-aufbau.ts` mit `IB_REICH=1` die Liste einmal mit Kasse x10 (nur in der Kopie), dann erscheinen drei Meldungen.
Nicht gemessen: Stabilität der Liste über mehrere echte Spieltage (die Fortschreibung des Abbilds wäre ein eigener Lauf).

## Abgleich mit dem Mockup

Aufnahmen `docs/design/ki-merkliste-21-11/app-0{1,2}-*-{1920x1080,2560x1440}.png`. Kein Seitenscroll, keine Überlappung. Die Meldung folgt dem Karten- und Briefstil der
übrigen Info-Meldungen (Absender, Titel, Text, Link „Spieler ansehen“). Das Mockup hatte „Interesse an Jorund“ ohne Datenquelle, jetzt aus echter Bewertung. Das Kurzprofil-Band ist nicht aufgenommen.

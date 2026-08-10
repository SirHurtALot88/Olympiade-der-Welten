# „Weiter: Zum nächsten Spieltag", obwohl man schon drin ist — Befund

**Gemeldet von Chris** (mit Bild des roten Haupt-Knopfes):

> „die funktion ist quatsch man ist ja schon im nächsten spieltag, hier müsste man dann zur
> einsatzliste kommen"

## Was der Knopf ist

`lib/foundation/game-flow-controller.ts:881` — der Schritt `advance_to_next_matchday`. Sein Ziel ist
das Cockpit (`targetView: "cockpit"`), nicht die Einsatzliste.

Welcher Schritt als Haupt-Knopf erscheint, entscheidet `chooseCurrentStep` (etwa Zeile 893): der
ERSTE Schritt der Liste mit Status `ready`, `warning` oder `blocked`. In der Liste steht
`set_lineup` (Zeile 750) **vor** `advance_to_next_matchday` (Zeile 881).

## Woran es liegt

Damit Chris den Weiter-Knopf sieht, muss `set_lineup` als `completed` durchgefallen sein. Dessen
Bedingung ist schlicht:

```js
hasLineup ? "completed" : ...
```

Wenn also nach dem Spieltagswechsel noch eine Einsatzliste des ALTEN Spieltags gefunden wird, gilt
der Schritt als erledigt, und der Ablauf fällt bis zum Weiter-Knopf durch — der dann anbietet,
weiterzugehen, obwohl man gerade erst angekommen ist. Genau das beschreibt Chris.

**Zwei Kandidaten, beide noch zu belegen:**

1. `hasLineup` prüft nicht (oder nicht streng genug) gegen den AKTIVEN Spieltag, findet die alte
   Liste und meldet „fertig".
2. Die Einsatzliste wird beim Spieltagswechsel mitgenommen statt zurückgesetzt — dann ist der
   Ablauf korrekt und der Fehler liegt im Wechsel selbst.

Der Unterschied ist wichtig: Im ersten Fall ist es eine Anzeigefrage, im zweiten spielt Chris den
neuen Spieltag womöglich mit der Aufstellung des alten.

## Was zu tun ist

Erst nachmessen — an einem Save direkt nach dem Wechsel ausgeben, was `hasLineup` liefert und auf
welchen Spieltag die gefundene Liste zeigt. Danach:

- Fall 1: `hasLineup` an den aktiven Spieltag binden. Der Ablauf bietet dann von selbst die
  Einsatzliste an, weil `set_lineup` vor dem Weiter-Knopf steht — es braucht keinen neuen Schritt
  und keine Sonderregel, nur die richtige Bedingung.
- Fall 2: gehört in den Spieltagswechsel, nicht in den Ablauf-Controller.

## Was dagegen spricht

Chris' Satz „hier müsste man dann zur einsatzliste kommen" liest sich auch als Wunsch, einfach das
Ziel des Knopfes zu ändern. Das wäre die schlechtere Lösung: Der Knopf heisst „Zum nächsten
Spieltag" und tut genau das — wenn er zur falschen Zeit erscheint, ist nicht sein Ziel falsch,
sondern die Bedingung davor. Ein umgebogenes Ziel würde den echten Fehler verdecken, und im
zweiten Fall oben bliebe die alte Aufstellung trotzdem stehen.

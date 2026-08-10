# Der Setup-Lauf kauft für manuell geführte Teams — Befund

**Gemeldet von Chris** (Saisonende, Team Stronghold Crusaders):

> „Was zur hölle ist passiert mit meinem save am season ende, dass ich plötzlich 3 neue spieler
> habe? Wieso wird für mich gepickt und gedraftet??? Bitte die 3 käufe rückgängig machen, eigentlich
> müsste hier nur verkauft werden auch von den AI teams! käufe erst NACH saisonübergang!!!"

Auf seinem Bild: „Preseason-Markt blockiert · 22/30 Teams · **4 Käufe** · 47 Verkäufe ·
**325 Setup-Aktionen** · 124 blockiert".

## Die Ursache — mit Zeile

`lib/ai/ai-picks-run-service.ts:2494-2503` wählt die Teams für einen Lauf:

```js
const controlMode = getTeamControlSettings(gameState, team.teamId)?.controlMode
  ?? (team.humanControlled ? "manual" : "ai");
if (teamScope === "all" && allowSetupAllTeams) {
  return true;          // <-- hier faellt der Schutz weg
}
return controlMode === "ai";
```

Die letzte Zeile ist der eigentliche Schutz: **nur KI-Teams**. Zwei Zeilen darüber wird er
ausgehebelt — sobald ein Lauf mit `teamScope === "all"` und `allowSetupAllTeams` fährt, gibt der
Filter **jedes** Team frei, auch ein manuell geführtes. Der `controlMode` wird oberhalb sauber
ermittelt und dann für diesen Fall schlicht nicht mehr gelesen.

Die 325 Setup-Aktionen auf Chris' Bild belegen, dass genau so ein Lauf stattgefunden hat. Sein Team
war darunter, und der Lauf hat für ihn gekauft.

## Warum das schwer wiegt

Es ist kein falscher Wert in einer Anzeige, sondern eine **Handlung in seinem Namen**: fremde
Spieler im Kader, Geld ausgegeben, Kaderplätze belegt. Ein manuell geführtes Team ist die eine
Sache, die die Automatik nie anfassen darf — das ist die Grenze zwischen „das Spiel hilft mir" und
„das Spiel spielt für mich".

## Zu tun — zwei getrennte Dinge

**1. Der Code.** Der `allowSetupAllTeams`-Zweig darf den `controlMode`-Schutz nicht aufheben. Ein
Setup-Lauf mag alle Teams *betrachten* dürfen; **kaufen** darf er für ein manuelles Team nie. Zu
klären ist, wofür `allowSetupAllTeams` gedacht war (vermutlich: leere Kader eines frischen Saves
auffüllen) — dann trennt man die beiden Fälle sauber, statt den Schutz pauschal auszuschalten.

**2. Chris' Ansage zum Zeitpunkt.** „käufe erst NACH saisonübergang, eigentlich müsste hier nur
verkauft werden auch von den AI teams." Das ist eine zweite, eigenständige Regel: Im
Saisonende-Fenster wird verkauft, nicht gekauft — auch von der KI. Sie gehört gesondert umgesetzt
und getestet.

**3. Sein Spielstand.** Die drei Käufe sollen zurückgenommen werden. Das ist ein Eingriff in
Live-Daten und braucht Sorgfalt: Kaderzeile entfernen, Geld zurückbuchen, Transferhistorie
bereinigen, und zwar so, dass die Buchhaltung danach aufgeht. Nichts davon gehört nebenbei erledigt
— erst der Code, damit es nicht gleich wieder passiert, dann die Reparatur mit Vorher-/Nachher-Beleg.

## Was dagegen spricht

Der Befund benennt die Stelle, aber **nicht**, welcher Lauf sie ausgelöst hat und ob
`allowSetupAllTeams` dort absichtlich gesetzt war. Bevor der Zweig geändert wird, ist zu klären, wer
ihn benutzt — ein ersatzloses Streichen könnte den Fall kaputtmachen, für den er einmal gebaut wurde
(vermutlich das Befüllen eines frischen Saves, wo es noch gar keine manuellen Teams gibt).

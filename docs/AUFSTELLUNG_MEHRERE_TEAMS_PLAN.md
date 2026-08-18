# Mehrere Teams am Stück aufstellen — Befund und Plan

> Chris: „bisher war es ja so wenn ich das team wechsel dass die seite aktualisiert und die
> aufstellung weg ist" — und der Wunsch dahinter: mehrere Teams von Hand aufstellen, dann EINMAL
> abgeben. Gilt für Solo genauso wie für den Raum.

Alle Zahlen unten sind gemessen; die Stelle steht jeweils dabei.

---

## 1. Befund

### 1.1 Die Sammel-Abgabe gibt es im Solo schon — sie löst aber etwas anderes

Die Kachel „Meine Teams" und ihr Abgabe-Knopf sind **nicht** an den Mehrspieler gebunden: sie
erscheinen, sobald man mehr als ein eigenes Team führt (`MyTeamsReadinessPanel`, Gate
`humanTeamCount <= 1`). Gemessen mit vier eigenen Teams, solo wie im Raum: `humanTeamCount=4`,
Knopf sichtbar.

Nur nimmt der Knopf für die offenen Teams den **KI-Vorschlag**. Für ein Team, das man noch nicht
geöffnet hat, gibt es auch nichts anderes. Wer selbst aufstellen will, ist damit nicht bedient.

### 1.2 Der Teamwechsel wirft die Aufstellung weg — und der Neuaufbau ist überflüssig

`FoundationShellRouterBody.tsx` baut die Einsatzliste über einen Schlüssel auf, in dem die
Team-ID steckt:

```
clientKey={`lineup-${activeSaveId}-${season}-${matchday}-${activeManagerTeamId}-${owner}`}
```

Ändert sich das Team, wechselt der Schlüssel, React baut `LegacyLineupLabClient` **komplett neu
auf** — jede ungespeicherte Auswahl ist weg. Genau der beschriebene Effekt.

**Der Neuaufbau ist dabei nicht nötig:** der Client reagiert längst selbst auf ein von außen
geändertes `defaultTeamId` (Effekt in `LegacyLineupLabClient.tsx`, ~Z. 3585: weicht der Prop von
`params.teamId` ab, ruft er `loadContext` mit dem neuen Team). Und das Auswahlfeld im Panel macht
beides gleichzeitig — es ruft `loadContext` **und** meldet nach oben, was den Neuaufbau auslöst,
der die gerade gestartete Ladung wieder wegräumt.

### 1.3 Was wie „automatisch sichern" heißt, sichert nichts

`skipNextAutoPersistRef` und der Effekt daneben klingen nach Zwischenspeichern. Gemessen: der
Effekt ruft ausschließlich `requestPreview(...)` — die **Vorschau**. Der Entwurf wird nirgends
festgehalten. Es gibt also keinen Ort, aus dem ein Wechsel zurück etwas wiederherstellen könnte.

---

## 2. Entscheidungen

**E1 — Die Team-ID fliegt aus dem Schlüssel.** Sie ist die einzige der fünf Größen darin, für die
der Client einen eigenen Weg hat. Spielstand, Saison, Spieltag und Besitzer bleiben drin: dort ist
ein Neuaufbau richtig.

**E2 — Entwürfe je Team im Gedächtnis.** Wer zwischen zwei Teams wechselt, findet seine Auswahl
wieder. Bewusst im Speicher, nicht in der Ablage: ein Entwurf ist kein Spielstand, und ein
Neuladen der Seite darf ihn weiterhin verwerfen (alles andere wäre eine zweite Wahrheit neben dem
gespeicherten Draft).

**E3 — Die Sammel-Abgabe nimmt ZUERST meinen eigenen Entwurf.** Nur wo keiner vorliegt, kommt der
KI-Vorschlag — und der Knopf sagt weiterhin, was er tut. Das ist der eigentliche Wunsch: mehrere
Teams von Hand, einmal abgeben.

**E4 — Nichts davon ist raum-spezifisch.** Solo und Koop laufen durch dieselbe Kachel und dieselbe
Sammelroute.

---

## 3. Die Pakete

### Paket 1 — Der Entwurf überlebt den Teamwechsel
Team-ID aus dem Schlüssel; Entwürfe je Team im Gedächtnis; die doppelte Arbeit im Auswahlfeld
auflösen.

**Eigenschaften:** Auswahl in Team A setzen, zu B wechseln, zurück zu A → Auswahl steht ·
Gegenprobe: Wechsel von Spielstand/Saison/Spieltag/Besitzer baut weiterhin neu auf ·
Gegenprobe: ein bereits gespeicherter Draft gewinnt beim ersten Öffnen weiterhin.

### Paket 2 — Die Sammel-Abgabe gibt MEINE Aufstellungen ab
Eigener Entwurf vor KI-Vorschlag; die Beschriftung nennt die Mischung ehrlich
(z. B. „2 eigene + 1 KI-Vorschlag abgeben").

**Eigenschaften:** liegen eigene Entwürfe vor, werden GENAU die abgegeben · ohne eigenen Entwurf
bleibt es beim KI-Vorschlag · die Zusammenfassung nennt Teilerfolge weiterhin ehrlich.

### Paket 3 — Der Raumstart sagt, dass er noch baut
60–90 s lang läuft der Liga-Draft; die Oberfläche schweigt. Ein Hinweis oben, **und** der Zusatz,
was schon geht: Sponsor wählen und einkaufen hängen nicht am Draft (zu prüfen, nicht zu behaupten).

### Paket 4 — Der Audit spielt S2 Spieltag 1 zu Ende
Heute endet er bei der Ankunft in Saison 2. Der erste Spieltag der neuen Saison soll noch
gewertet werden, damit sichtbar ist, dass keine Blocker stehengeblieben sind.

---

## 4. Arbeitsregeln

Wie in `MULTIPLAYER_SAISONWECHSEL_PLAN.md` Abschnitt 4. Dazu die Lehre aus diesem Vorhaben:
**sieben Tests hielten den alten Zustand als den richtigen fest.** Wer hier auf eine Prüfung
stößt, die den Neuaufbau beim Teamwechsel als Wahrheit führt, dreht sie um statt sie zu löschen —
mit dem Grund im Kommentar.

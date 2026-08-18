# Mehrspieler mit 1 und 2 Teams pro Spieler — Befund und Plan

> Anschluss an `MULTIPLAYER_SAISONWECHSEL_PLAN.md`. Chris: „es gibt multiplayer auch mit 2 teams
> pro spieler oder 1 team bitte auch hinzufügen".
>
> Ebenfalls von Chris entschieden und hier festgehalten, weil es eine wiederkehrende Frage ist:
> **für menschliche Teams wird NIEMALS mitgedraftet.** Der Ausschluss beider Teamsätze in
> `startRoom` (room-store.ts) ist damit kein offener Punkt mehr, sondern gewollt.

Alle Zahlen unten sind gemessen; die Stelle steht jeweils dabei.

---

## 1. Befund

### 1.1 Es gibt vier Modi, aber nur EINEN für zu zweit

`RoomOwnershipPreset` (types/game.ts:26-30):

| Preset | Chris | Franky |
|---|---|---|
| `chris_1_rest_ai` | 1 | — |
| `chris_2_rest_ai` | 2 | — |
| `chris_4_rest_ai` | 4 | — |
| `chris_4_franky_4_rest_ai` | 4 | 4 |

Wer zu zweit spielen will, hat genau eine Wahl: vier gegen vier. Ein 1+1 oder 2+2 ist nicht
vorgesehen — obwohl die Solo-Seite alle drei Größen kennt.

### 1.2 Die Zuteilung ist eine Ternär-Kette auf EINEN Sonderfall

`buildOwnershipForPreset` (lib/room/online-room-model.ts:297-318) entscheidet so:

```ts
const hostCount   = preset === "chris_1_rest_ai" ? 1 : preset === "chris_2_rest_ai" ? 2 : 4;
const frankyCount = preset === "chris_4_franky_4_rest_ai" && franky ? 4 : 0;
const hostTeamIds = preset === "chris_4_franky_4_rest_ai" ? FOUR_PLUS_FOUR_HOST_TEAM_IDS : teamIds.slice(0, hostCount);
```

Drei Verzweigungen, alle auf denselben einen Preset-Namen. Jeder neue Modus braucht in dieser Form
drei weitere Zweige — und `hostCount` fällt für alles Unbekannte still auf `4` zurück, also auf
eine falsche Zahl statt auf einen Fehler.

### 1.3 Die Modus-Liste steht ZWEIMAL in der Oberfläche

- `app/HomePageClient.tsx:13-16` — Beschriftungen „1 Team für mich, Rest KI" …
- `app/room/[roomCode]/RoomPageClient.tsx:32-35` — dieselben vier Werte, eigene Beschriftungen

Zwei handgepflegte Listen für dieselbe Größe. Ein neuer Modus, der nur in einer landet, ist an der
anderen Stelle unsichtbar — und niemand merkt es.

### 1.4 Der Save-Modus kennt nur „4v4"

`FoundationSaveModePreset` (lib/persistence/foundation-save-mode.ts:3) hat für Mehrspieler genau
`online_4v4`, und `getGameModeOwnershipLimits` (lib/foundation/team-control-settings.ts:190) gibt
dafür `{ chrisMax: 4, frankyMax: 4 }`. `startRoom` schreibt diesen Modus fest (room-store.ts:1069,
1215).

Ein 1+1-Raum liefe damit unter „Multiplayer 4v4" und böte in der Team-Zuteilung vier Plätze je
Seite an — die Obergrenze passte nicht zum gewählten Modus. Kaputt wäre nichts (die Grenze ist ein
Deckel, keine Zuweisung), aber die Anzeige verspräche etwas anderes als der Modus.

---

## 2. Entscheidungen, die ich vorab treffe

**E1 — Eine TABELLE statt der Ternär-Kette.** Preset → `{ hostCount, guestCount, hostTeamIds,
guestTeamIds }`, an einer Stelle. Ein neuer Modus ist danach eine Zeile, kein Eingriff in die
Logik. Die Kette aus 1.2 dreimal zu verlängern wäre die Bauweise, die diesen Plan überhaupt nötig
gemacht hat.

**E2 — Unbekannte Presets fallen auf einen FEHLER, nicht auf 4.** Der heutige Rückfall vergibt
still vier Teams. Nach dem Umbau muss ein unbekannter Modus erkennbar sein; „bei 0 wird erklärt,
nicht versteckt" gilt auch für „diesen Modus kenne ich nicht".

**E3 — Die Modus-Liste wird EINE exportierte Quelle**, aus der beide Oberflächen lesen. Welche
Beschriftung je Stelle gilt, darf verschieden bleiben; die Menge der Modi nicht.

**E4 — Neue Save-Modi `online_1v1` und `online_2v2`.** Sonst zeigt die Team-Zuteilung in einem
1+1-Raum vier Plätze je Seite. Bestehende `online_4v4`-Spielstände bleiben unangetastet — es kommen
Werte dazu, es ändert sich keiner.

**E5 — Die Team-IDs der neuen Modi werden ABGELEITET, nicht erfunden.** `FOUR_PLUS_FOUR_HOST_TEAM_IDS`
und `..._FRANKY_...` sind gesetzt; 1+1 und 2+2 nehmen die ersten n daraus, damit dieselben Teams in
derselben Reihenfolge fallen und es keine zweite Liste gibt.

---

## 3. Die Pakete

Strikt nacheinander, ein Agent je Paket, eigene Tore vor der Übergabe.

### Paket 1 — Die Zuteilung wird eine Tabelle (ohne neue Modi)

Reiner Umbau, Verhalten **unverändert**: `buildOwnershipForPreset` liest aus einer Tabelle, die
genau die heutigen vier Modi abbildet.

**Eigenschaften:** alle vier bestehenden Modi teilen exakt wie vorher zu (Team-IDs zeichengenau) ·
ein unbekannter Modus ist erkennbar, statt still 4 Teams zu vergeben · Gegenprobe: ohne zweiten
Teilnehmer bleibt Frankys Seite leer, wie heute.

### Paket 2 — 1+1 und 2+2

Die neuen Presets, die neuen Save-Modi, und die eine gemeinsame Modus-Liste für beide Oberflächen.

**Eigenschaften:** in einem 1+1-Raum hat jeder genau ein Team, in 2+2 genau zwei · die Team-IDs
sind die ersten n der bestehenden 4+4-Listen · beide Oberflächen bieten dieselbe Menge an Modi ·
der Save-Modus passt zum Raum-Modus, und die Obergrenze der Team-Zuteilung passt zum Save-Modus ·
Gegenprobe: 4+4 und alle Solo-Modi verhalten sich unverändert · Gegenprobe: der Beitritt (#49,
`tests/koop-aufteilung-beim-beitritt.test.ts`) gibt dem Gast auch in den neuen Modi Teams — die
Regel prüft das ERGEBNIS, nicht den Preset-Namen, also muss sie ohne Änderung tragen.

### Paket 3 — Der Zwei-Browser-Test fährt einen der neuen Modi

Heute fährt `scripts/smoke-multiplayer-e2e.ts` fest 4+4. Ein neuer Modus, den kein Tor je
durchläuft, ist genau die Sorte Zusage, die in dieser Session mehrfach still verrottet ist.

**Wichtig:** 1+1 ist der billigere Lauf (weniger Aufstellungen), aber der Test darf nicht auf
1+1 UMGESTELLT werden — 4+4 ist der Modus, den Chris und Franky spielen. Zu klären ist, ob ein
zweiter Lauf die CI-Zeit wert ist; sonst reicht ein Vertrags-Test auf der Zuteilungstabelle.

---

## 4. Arbeitsregeln

Wie in `MULTIPLAYER_SAISONWECHSEL_PLAN.md`, Abschnitt 4 — ein Paket, ein Agent, nacheinander; erst
messen, dann behaupten; der Test hält die Eigenschaft fest, nicht die Bauweise; eine Quelle pro
Größe; Kommentare benennen den Fund und das WARUM.

Dazu eine Lehre aus dem Saisonwechsel-Vorhaben, die hier besonders greift: **es gab vier Tests, die
den alten Zustand als den richtigen festhielten.** Wer die Modus-Liste erweitert, wird auf
Prüfungen stoßen, die „genau vier Modi" oder „4+4" als Wahrheit führen. Die sind umzudrehen, nicht
zu löschen — und im Kommentar gehört hin, warum sie vorher das Gegenteil verlangten.

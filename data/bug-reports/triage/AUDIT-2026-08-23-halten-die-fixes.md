# Audit 23.08.2026 — halten die als behoben abgehakten Meldungen wirklich?

**Ausgelöst von Chris:** *„hast du die anderen bugs auch alle auditiert und geprüft ob sie WIRKLICH
gefixt sind?"*

**Die ehrliche Vorbemerkung:** nein, das war vorher nicht geprüft. Der Bugfixing-Lauf, der alle vier
Stunden feuert, vergleicht zwei Listen — Meldungen gegen Quittungen. Existiert zu `bug-<id>.json`
eine Datei `triage/bug-<id>.md`, gilt die Meldung als erledigt. Das ist Buchhaltung. Ob der Code
noch tut, was die Quittung behauptet, hat der Lauf nie angesehen.

## Zahlen

| | |
|---|---|
| Meldungen im Spiegel | **90** |
| davon als behoben quittiert | **68** |
| davon Befund ohne Eingriff (bewusst nichts geändert) | 13 |
| davon Wunsch/Rückfrage ohne Fix-Behauptung | 9 |
| behobene Meldungen **mit** benanntem Test | **44** |
| behobene Meldungen **ohne** benannten Test | **24** |

## Was geprüft wurde

1. **Nennen die Quittungen noch existierende Dateien?** 94 Quelldatei-Nennungen aus allen
   Fix-Quittungen gegen `main` geprüft — **alle 94 vorhanden**, keine verwaiste Referenz.
2. **Existieren die benannten Testdateien?** 50 verschiedene genannt, **49 vorhanden**. Die eine
   fehlende ist umbenannt worden, nicht gelöscht (siehe unten, `fm2opo`).
3. **Stehen die genannten Bezeichner noch im Quelltext?** 359 Bezeichner aus den Quittungen
   herausgezogen und gesucht. 6 nicht gefunden; jeder einzeln nachgesehen (siehe unten).
4. **Laufen die Tore?** `tsc` leer · `ci:import-exists` (2311) · `ci:client-bundle-lint` ·
   `ci:flow-smoke` (205) · Quelltext-Wächter (1930) · Render-Wächter (217). Alles grün.
5. **Chris' eigene Rückfallmeldungen** — alle Meldungen mit „immernoch", „wieder", „erneut"
   herausgesucht (10 Stück) und einzeln nachgelesen. Das sind seine eigenen Belege dafür, dass ein
   früherer Fix nicht getragen hat.
6. **Am Live-Abbild gemessen**, wo die Behauptung messbar ist: `scripts/pruefe-behauptete-fixes.ts`.

## Befund 1 — `33c172` war nur zur Hälfte behoben. BEHOBEN.

Chris' Meldung: *„anscheinend wurden verkäufe gestoppt wegen spieler minimum -> diesen grund darf es
nicht geben der muss sauber entfernt werden weil beim verkauf gibt es ja kein spieler minimum - das
hatten wir jetzt schon so oft!"*

Die Quittung meldete es als erledigt. **Für die KI-Seite stimmt das** — nachgeprüft: `low_roster_depth`
ist aus `ai-transfermarkt-sell-preview-service.ts` und aus dem Status-Typ entfernt, die beiden
Kandidaten-Warnungen sind weg, `tests/ai-transfermarkt-sell-preview.test.ts` läuft grün (12/12).

**Im Verkaufsdialog des Menschen stand der Grund weiter.** Nicht als Sperre, sondern als
*Begründung einer fremden Sperre*. `FoundationMarketSellShellHost.tsx` fragte zuerst, ob eine
Kadergrößen-Warnung vorliegt, und schrieb dann:

> „Kader ist am Minimum — verkaufen würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz,
> bevor du hier verkaufst."

Der echte Grund aus `blockingReasons` kam erst danach und wurde damit verdeckt.

**Nachgemessen, dass die Verwechslung wirklich möglich ist:** keiner der beiden Verkaufsdienste
kennt eine Kadergrößen-Sperre. `transfermarkt-sell-service.ts:373` und
`transfermarkt-local-service.ts:3166` setzen beide `canSell = blockingReasons.length === 0`, und in
keiner der beiden Listen steht ein Kadergrund — wohl aber `sale_price_missing`,
`active_player_salary_missing` und `active_player_not_active`. Fällt einer davon, während der Kader
klein ist, las Chris „gestoppt wegen Spielerminimum". Der Satz konnte also **nur** dann erscheinen,
wenn etwas anderes sperrte — und schob es dem Kader in die Schuhe.

**Geändert:**

- Die Grundwahl steht jetzt als eine Regel in `transfer-sell-view-labels.ts`
  (`resolveSellDisabledReason`) statt als Fragezeichen-Kette in der Ansicht. Der Kadergrund ist
  daraus entfernt; genannt wird, was der Dienst genannt hat.
- Der ambiente Hinweis am Ende des Dialogs hängt nur noch an der **Sieben**, nicht mehr am
  Team-Minimum. Er behauptet „dann ist keine Aufstellung mehr möglich" — das stimmt unter sieben
  Spielern und stimmt unter dem Team-Minimum nicht.
- Die Kadergrößen-Warnung selbst bleibt in der Warnungsliste. Sie ist ein Hinweis und war nie das
  Problem.

**Test:** `tests/verkaufssperre-nennt-den-echten-grund.test.ts`, 6 Fälle. **Gegenprobe gefahren:**
gegen das alte Verhalten fallen 3 davon.

changelog: 2026-08-23-verkaufssperre-nennt-den-echten-grund.json

## Befund 2 — `nl5eju`: die Ursache ist behoben, die Wirkung ist ausgeblieben. OFFEN, Chris' Entscheidung.

Chris' Meldung: *„in Season 2 hat IMMERNOCH kein einziges team in gebäude investiert"*. Die Quittung
meldete als Ergebnis, die KI-Reserve sei auf 60 % des Kontostands gedeckelt und damit steige „die
Zahl der Teams mit investierbarem Geld je nach Saison von 4 auf 18 bzw. von 20 auf 24".

Das ist eine Aussage über **verfügbares Geld**, nicht über **getätigte Investitionen**. Heute am
Abbild gemessen:

| Spielstand | Saison | Teams mit Gebäudestufe > 0 | Stufen gesamt |
|---|---|---|---|
| `swnjlk` | 2 | **1 / 32** | 2 |
| `hwz8fk` | 2 | **1 / 32** | 1 |
| `89rv3s` | 2 | **1 / 32** | 1 |
| `1hf25q` | 2 | 9 / 32 | 12 |
| `0kalpx` | 1 | 16 / 32 | 54 |
| `n90y4m` | 1 | 25 / 32 | 47 |
| `h0z7cl` | 1 | 1 / 32 | 2 |

In drei von vier Saison-2-Spielständen hat genau **ein** Team überhaupt ein Gebäude. Chris'
ursprüngliche Beobachtung steht damit praktisch unverändert — der Geld-Riegel ist weg, gebaut wird
trotzdem nicht.

**Kein Eingriff auf Verdacht.** Warum die KI trotz Geld nicht baut, ist nicht gemessen: es kann an
der Bewertung der Gebäude in der Investitionsentscheidung liegen, an einer zweiten Sperre, oder
daran, dass Käufe in der Rangfolge immer gewinnen. Das ist eine eigene Messung wert und dann eine
Entscheidung, keine Reparatur nebenbei.

## Befund 3 — 24 behobene Meldungen haben keinen Test. Strukturell, nicht einzeln.

Bei diesen 24 steht die Reparatur im Code, aber nichts hält sie fest. Ein Umbau könnte sie still
entfernen, ohne dass ein Lauf rot wird. Stichprobe `7mjqbg` („Captain wird an eine Disziplin
verschenkt, in die das Team eine negative Formkarte wirft"): die Regel steht in
`ai-legacy-lineup-engine.ts:298` (`concedesByNegativeFormCard`, gespeist aus `negativeFormCardSides`
in Zeile 1514) — **und kein einziger Test nennt sie**.

Das ist die eigentliche Antwort auf Chris' Frage: nicht „ein Fix ist kaputt", sondern „bei 24 von 68
würde man es nicht merken".

## Die sechs nicht auffindbaren Bezeichner — einzeln nachgesehen

| Meldung | Bezeichner | Befund |
|---|---|---|
| `imx650`, `vi7fg4` | `ea89b21e`, `fb6299e2` | Commit-Kürzel, keine Symbole. Kein Befund. |
| `33c172` | `buildAiSellStatus` | **Beleg dafür, dass der Fix hält** — die Quittung nennt sie als das, was entfernt wurde. |
| `c6ick6` | `injuryDaysRemaining` | Steht in der Quittung als Selbstkorrektur („das Feld gibt es nicht"). Kein Befund. |
| `fm2opo` | `MIX_RIEGEL_MINDESTZAHL`, `wendeApronUndMixAn` | Umbenannt in `MIX_RIEGEL_QUOTE` und `wendeLiquiditaetUndMixAn`, weil Chris am 20.08. entschieden hat, die Formwahl über den Kassenstand statt über den Apron-Spielraum zu steuern. Der Code ist dokumentiert, **die Quittung ist veraltet**: ihre `changelog:`-Zeile beschreibt noch die Apron-Fassung. |

## Was dieses Audit NICHT geprüft hat

- **Die 24 ohne Test wurden nicht einzeln nachgestellt.** Geprüft ist, dass die genannten Dateien
  und Bezeichner existieren; dass das Verhalten stimmt, ist damit nicht bewiesen.
- **Der komplette `vitest`-Lauf über alle Suiten** lief über 50 Minuten ohne Ergebnis und wurde
  abgebrochen. Geprüft sind stattdessen die vier CI-Tore und die beiden Wächter — zusammen 2352
  Fälle. Das deckt nicht jede Suite ab.
- **Nichts davon ersetzt Chris' Auge im Spiel.** Ein Fix, der im Test grün ist und sich falsch
  anfühlt, fällt hier nicht auf.

## Vorschlag für die Routine

Der Vier-Stunden-Lauf sollte künftig nicht nur fragen „gibt es eine Quittung", sondern auch „nennt
sie einen Test, und gibt es den". Das hätte `fm2opo` (Test umbenannt) sofort gezeigt und hält die
Zahl der 24 testlosen Fixes sichtbar, statt sie unter einer grünen Bilanz zu begraben.

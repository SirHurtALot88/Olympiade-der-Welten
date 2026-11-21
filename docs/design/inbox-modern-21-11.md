# Inbox als Postfach (Fable, 21.11., Welle 5)

Entwurf: Mockup und Erklärung. `app/`, `components/`, `lib/` und der Motor sind nicht angefasst, bei PixelLab ist
nichts bestellt. Nachfolger von `public/mockups/inbox-modern-18-11.html` (freigegeben am 18.11., noch nicht gebaut);
was Chris dort entschieden hat, gilt weiter: Postfach **nur fürs gewählte Team**, Entscheidungen mit Folgen dürfen
**direkt in der Inbox** fallen, „Franky anstupsen“ kommt.

## Ansehen

| Was | Datei |
|---|---|
| Mockup, klickbar, läuft per Doppelklick | `public/mockups/inbox-modern-21-11.html` |
| Bilder, je 1920×1080 und 2560×1440, einfache Dichte | `docs/design/mockups-21-11/inbox-01` bis `inbox-06` |

Die graue Leiste oben gehört nicht zum UI. Zustände per Adresse: `?team=V-W|P-C`, `?ordner=post|erledigt`,
`?sort=dring|neu|absender`, `?abs=alle|kabine|medizin|vorstand|sponsor|markt|vertrag|spieltag|gebaeude`, `?nur=1`,
`?sel=<id>`, `?leer=1`, `?still=1`.

| Bild | Zustand |
|---|---|
| `inbox-01-posteingang` | Posteingang, geöffnet: „Verletzter Spieler“ mit Rückkehr-Spieltag und Ersatz |
| `inbox-02-trainingswunsch` | „Trainingswunsch: leicht“ (neue Quelle `player_training_wish`) mit drei Optionen und Folgen |
| `inbox-03-vorstand-info` | Info-Bahn: „Vorstand: Freigabe für Saison 2“ (neue Meldungsart) |
| `inbox-04-spieltag-bericht` | Bericht „Spieltag 17 — V-W“ mit Ergebnis im Format „87 : 79 → 7 : 4“, Sortierung „Neueste“ |
| `inbox-05-alles-erledigt` | Handeln-Bahn leer: „Nichts offen — du bist durch.“ |
| `inbox-06-zweites-team-mit-leiste` | zweites eigenes Team (Pirate Crew), mit Mockup-Leiste |

## 1. Zweck

Die heutige Inbox (`inbox-v2/InboxV2NewLook.tsx`) ist eine lange Liste. Das Mockup vom 18.11. hat daraus „entscheiden,
ohne die Seite zu verlassen“ gemacht. Diese Runde ergänzt, was seither dazugekommen ist oder fehlte:

1. **Zwei Bahnen nebeneinander statt einer Liste mit Gruppen.** Links „Handeln“, rechts „Info“. Dringlichkeit ist
   damit Position, nicht nur Farbe, und beide sind gleichzeitig sichtbar. Das ist die Regel aus
   `lib/foundation/inbox-lanes.ts` („Handeln ≠ Wissen“); „Info“ fasst dort die Räume `watch` (Im Blick behalten) und
   `report` (Berichte & Momente) zusammen, im Mockup als zwei Abschnitte derselben Bahn.
2. **Es liest sich wie ein Postfach.** Jede Meldung hat einen Absender (Teamarzt, Kabine, Vorstand, Sponsor, Markt &
   Scouting, Verträge, Liga & Spieltag, Gebäude), einen Zeitpunkt und einen Gelesen-Zustand. Rechts liegt der
   geöffnete Brief.
3. **Jede Meldung trägt ihre Aktion.** In der Handeln-Bahn steht die empfohlene Aktion schon in der Zeile (ein Klick),
   im Brief stehen alle Optionen mit ihren Folgen als kleine Marken („Moral +6“, „Kasse +33,3 C“).

## 2. Aufbau

| Spalte | Inhalt |
|---|---|
| Postfach (links) | Ordner Posteingang / Erledigt, Filter nach Absender mit Zählern, Sortierung (Dringend, Neueste, Absender), Schalter „Nur ungelesene“, eigene Teams als Umschalter, Checkliste des Spieltags, „Am Tisch“ |
| Handeln | Abschnitt „Hält den Spieltag auf“ zuerst, dann „Vor dem Spieltag entscheiden“. Leer ist hier die gute Nachricht |
| Info | „Im Blick behalten“ (Zustände, keine Fristen) und „Berichte & Momente“; „Alle gelesen“ oben rechts |
| Brief (rechts) | Kopf mit Absender, Spieler (Klasse in Klassenfarbe mit Icon), Marken; Text; drei Zahlen; Optionen mit Folgen; Fuß mit „Ungelesen“, „Später“, „Nächste“ |

Der Kopf (Regieband) zeigt Ungelesen, Handeln, Hält auf, Info. Der Taktgeber bleibt gesperrt, solange eine Meldung
den Spieltag aufhält, und springt bei Klick auf die erste davon.

**Verletzung nach Regel vom 18.11.:** die Meldung sagt „nicht einsetzbar“, nennt den Rückkehr-Spieltag, hält den
Spieltag auf, solange der Spieler noch in der Einsatzliste steht, und „Lineup bestätigen“ lässt sich im Mockup erst
abgeben, wenn der Verletzte ersetzt ist. Sie wird nirgends als bloßer Formabzug gezeigt.

**Mehrspieler:** je Team ein Postfach. Links stehen nur die eigenen Teams (im Beispiel zwei von Chris); Franky und
Ramona erscheinen unter „Am Tisch“ mit Schloss, ihre Meldungen sind nicht einsehbar. Die Zahl an der Schiene zählt
über alle eigenen Teams.

## 3. Was es im Spiel schon gibt und was neu wäre

**Echt (Titel, Text, Knopf und Ziel aus `lib/foundation/game-inbox-service.ts`):**

| Meldung im Mockup | Quelle | Bahn laut `inbox-lanes.ts` |
|---|---|---|
| Verletzter Spieler | `player_health_injury` | Handeln |
| Lineup bestätigen | `lineup_drafts` | Handeln |
| Trainingswunsch: leicht / hart / mittel | `player_training_wish` (seit 21.11.) | Handeln |
| Spieler will seinen Vertrag auflösen | `contract_dissolution_offer` | Handeln |
| Verträge laufen aus | `roster_contracts` | Handeln |
| Sponsor-Aktion | `sponsor_event:activation_bonus` | Handeln (über die Schwere) |
| Mitspieler wartet / Ready fehlt | `room_flow_state` | Handeln |
| Gebäude-Zustand kritisch | `facility_condition_forecast` | Handeln nur bei „kritisch“, sonst Info |
| Board-Ziel gefährdet: … | `team_season_objectives` | Info (Im Blick behalten) |
| Hohes Verletzungsrisiko | `player_health_fatigue_risk` | Info |
| Scouting-Fortschritt | `scout_intel_pipeline` | Info |
| Spieltag 17 — V-W | `story:matchday_recap` | Bericht |
| Recovery Center ausgebaut | `facility_events` | Bericht |
| Story Card: Entwicklung zeigt Wirkung | `story:player_progression_discipline_delta` | Bericht |

Ebenfalls vorhanden: die Kategorien (`GameInboxCategory`), der Status offen / erledigt / ausgeblendet, Sprungziel
je Meldung (`targetView`, `targetParams`), die Schnellaktionen (`inbox-quick-action-service.ts`).

**Neu, bräuchte eine Datenquelle (im Mockup lila „neue Meldungsart“):**

| Neu | Was fehlt |
|---|---|
| Gelesen / ungelesen | `GameInboxItem` kennt nur `open / done / dismissed`. Nötig: ein Gelesen-Zustand **je Manager** (nicht je Spielstand), sonst liest Franky Chris' Post „weg“ |
| Absender | heute nur `category` und `source`; der Absender wäre eine feste Zuordnung Quelle → Absender, kein neues Datum |
| „Später“ (wieder vorlegen) | ein Wiedervorlage-Spieltag je Meldung und Manager |
| Moral gekippt: X ist verärgert | Moral und Stufen (80/60/40/20) gibt es; es fehlt die Inbox-Quelle beim Stufenwechsel nach unten |
| Wieder einsetzbar: X | das Verletzungsende steht im Spielstand; es fehlt die Meldung zum Rückkehr-Spieltag |
| Vorstand: Freigabe für Saison N | Vertrauen und Stufe rechnet `vorstand-budgetfreigabe.ts`; es fehlt die Meldung vor dem Saisonwechsel und bei einem Stufenwechsel |
| Interesse an X | **erfunden.** KI-Teams merken heute keine Spieler anderer Teams sichtbar vor. Weil in der Saison nicht gehandelt wird, ist es bewusst eine Info und kein Angebot |

**Erfunden:** welche Meldungen offen sind und alle Zahlen (Moral +6 / −4 beim Trainingswunsch, Eignungen, Beträge).
Die Folgen-Marken an den Optionen müssten im Bau aus den echten Funktionen kommen (gezeigt = gebucht), nicht aus
festen Texten.

## 4. Offene Entscheidungen für Chris

1. **Zwei Bahnen nebeneinander (Handeln | Info) statt der Gruppenliste vom 18.11.?** Empfehlung: ja, es ist die
   Anordnung, die `inbox-lanes.ts` schon vorsieht.
2. **Gelesen / ungelesen einführen?** Empfehlung: ja, je Manager. Ohne das ist „Info“ nach drei Spieltagen ein Stapel.
3. **Trainingswunsch direkt in der Inbox erfüllen oder ablehnen?** Empfehlung: ja, mit den Folgen daneben. Soll ein
   abgelehnter Wunsch verschwinden (Mockup) oder stehen bleiben, bis er sich von selbst erledigt (heutiger Code)?
4. **Welche neuen Meldungsarten willst du?** Vorschlag in dieser Reihenfolge: Wieder einsetzbar, Moral gekippt,
   Vorstand-Freigabe, Interesse an einem Spieler. Die letzte braucht eine neue KI-Funktion, die ersten drei nur eine
   Inbox-Quelle.
5. **Halten Trainingswünsche den Spieltag auf?** Empfehlung: nein, sie stehen unter „Vor dem Spieltag entscheiden“.
6. **Zahl an der Schiene:** ungelesene Meldungen (Mockup) oder nur, was den Spieltag aufhält (Glocke im Band)?
   Empfehlung: Schiene = ungelesen, Glocke = hält auf.
7. **Delegierte Bereiche (Ramona, Halbautomatik):** Meldungen aus einem an die KI gegebenen Bereich ganz ausblenden
   oder als erledigten Bericht zeigen („KI hat den Trainingswunsch erfüllt“)? Empfehlung: als Bericht.

## 5. Prüfung

Beide Größen angesehen: kein Seitenscroll, keine Überlappung, kein abgeschnittener Text, die Fläche ist genutzt
(vier Spalten über die volle Breite). Klassen stehen in Klassenfarbe mit Icon, neben keiner Zahl steht eine
Notenstufe, Gehälter stehen groß je Saison und klein je Spieltag. Die Seite läuft ohne JavaScript-Fehler.
Nicht geprüft: 1710×1112 (MacBook) und Phone.

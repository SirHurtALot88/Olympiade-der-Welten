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


## 6. Entscheidungen Chris 21.11.

Chris, 21.11.: „ja überall deine empfehlungen nehmen, bau das so“. Damit gilt zu Abschnitt 4:

1. Zwei Bahnen nebeneinander, Handeln | Info (Info = „Im Blick behalten“ + „Berichte“).
2. Gelesen/ungelesen je Manager (je Besitzer, im Spielstand: `seasonState.inboxGelesen[ownerId]`; Schreibweg `POST /api/inbox/gelesen` hinter `authorizeServerRoomWrite`).
3. Trainingswünsche direkt erfüllen (Intensität setzen, derselbe Weg wie die Entwicklungsseite) oder ablehnen. Abgelehnt: die Meldung wandert nach „Erledigt“, der Wunsch bleibt beim Spieler bestehen und wirkt weiter auf die Moral (Moral-Logik unverändert).
4. Neue Meldungsarten: Wieder einsetzbar, Moral gekippt, Vorstand-Freigabe gebaut; „Interesse an einem Spieler“ **nicht** gebaut (siehe Offene Punkte).
5. Trainingswünsche halten den Spieltag nie auf.
6. Zahl an der Icon-Schiene = ungelesen, die Glocke bleibt beim „hält den Spieltag auf“.
7. Meldungen aus an die KI delegierten Bereichen (`isBereichDelegiert`) erscheinen als Bericht „KI hat erledigt“.

## 7. Bau (21.11.)

Neu: `app/foundation/inbox-v2/PostfachModern.tsx` + `postfach-modern.css` (Klassen `ibx-*`), Modell `lib/foundation/inbox-postfach.ts`, Gelesen `lib/foundation/inbox-gelesen.ts`, neue Meldungen `lib/foundation/inbox-neue-meldungen.ts`, Route `app/api/inbox/gelesen/route.ts`. Entfernt: `InboxV2NewLook`, `InboxV2Client`, `FoundationInboxV2Host`, `inbox-v2-types`, `use-inbox-v2-derivations`, `inbox-urgency-groups`, alle `.nl-inbox*` in `globals.css`. Tests: `tests/postfach-inbox.test.tsx` (neu), Vertragstests auf das Postfach umgestellt.

Aufnahmen (echte App, Kopie des live-save-Abbilds, Death Peaches, Aufbau mit `scripts/inbox-bau-21-11-aufbau.ts`): `docs/design/inbox-bau-21-11/app-*.png` bei 1920x1080 und 2560x1440; Bildpaare Mockup oben, App unten: `paar-*.jpg`. Kein Seitenscroll, 1710x1112 ebenfalls gemessen (kein Scroll).

### Abgleich Mockup gegen App

| Mockup-Feature | Stand |
|---|---|
| Vier Spalten Postfach, Handeln, Info, Brief | drin |
| Band mit Ungelesen, Handeln, Hält auf, Info | drin (Seiten-Slot des Regiebands) |
| Ordner Posteingang/Erledigt mit Zählern | drin |
| Absender-Filter mit Zählern | drin |
| Sortierung Dringend/Neueste/Absender | drin; „Neueste“ sortiert nach Spieltag, Meldungen eines Spieltags haben dieselbe Zeit |
| „Nur ungelesene“ | drin |
| Meine Teams mit Umschalter und Ungelesen-Zahl | drin (nur eigene Teams des Managers) |
| Checkliste des Spieltags | angepasst: nur die Zeilen, die das Spiel führt (Lineup gesetzt/bestätigt, Formkarten, Training, Kapitän, Sponsor); „Kein Verletzter aufgestellt“ fehlt (keine Datenquelle) |
| Am Tisch (Franky, Ramona) | drin: Name, Team, Delegations-Stufe, ohne ihre Meldungen; auf dem Live-Stand gibt es nur Chris, deshalb nicht im Bild |
| Abschnitte „Hält den Spieltag auf“, „Vor dem Spieltag entscheiden“, „Im Blick behalten“, „Berichte & Momente“ | drin |
| Zeile mit Absender, Art, Marken, Zeit, Aktion | drin; die lila „neue Meldungsart“-Marken waren Entwurfs-Anmerkung und sind weggelassen |
| Brief mit Kopf, Text, drei Kacheln, Optionen mit Folgen | drin; Kacheln und Folgen aus echten Daten/Funktionen (`getTrainingModeDemandTerms`, Moral, Verfügbarkeit, Vorstand) |
| Klasse in Klassenfarbe mit Icon | drin |
| Empfohlene Option „Krolach für Kaylen einsetzen“ | fehlt: keine Ersatz-Empfehlung im Spiel; die Verletzung bietet „Lineup prüfen“ |
| „Franky anstupsen“ | fehlt: kein Anstups-Weg im Spiel |
| Später (Wiedervorlage) | fehlt: kein Wiedervorlage-Zustand; Ablehnen eines Wunsches legt nach „Erledigt“ |
| Ungelesen / Nächste im Brief | drin; dazu „Zurück in den Posteingang“ bei Erledigtem |
| Vorstand: Freigabe für Saison 2 | drin als „Vorstand: Freigabe N %“, nur ab Saison 2 und unter 100 % (Saison 1 gibt der Vorstand immer voll frei); auf dem Live-Stand (Saison 1) nicht aufnehmbar, durch Test belegt |
| Interesse an Jorund | drin seit 21.11. (KI-Merkliste): „Interesse an X: Team“, Info-Bahn, Absender Markt & Scouting; Quelle `ki_interesse`, siehe `docs/design/ki-merkliste-21-11.md` |
| Zahl an der Schiene | drin; erscheint auf Seiten, auf denen das Postfach ohnehin berechnet wird |

### Offene Punkte

- **Interesse an einem Spieler:** gebaut (21.11., Chris: „KI soll eine Merkliste fremder Spieler bekommen“). Die KI-Merkliste ist aus der Kaufbewertung der KI-Kaderplanung abgeleitet, keine neue Heuristik; Details in `docs/design/ki-merkliste-21-11.md`. Aufnahmen: `docs/design/ki-merkliste-21-11/`.
- Meldungstexte älterer Quellen (z. B. „Transfer gekauft“ mit roher Spieler-Kennung) sind unverändert aus dem Dienst und wären ein eigenes Aufräumen.
- Die Glocke im Band wurde nicht angefasst.

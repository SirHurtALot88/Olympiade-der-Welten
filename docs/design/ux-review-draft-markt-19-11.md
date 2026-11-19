# UX-Review 19.11.: Draft und Transfermarkt — eine Klickregel, ein „Mein Kader"

Chris, wörtlich gekürzt: „Lass Fable nochmal auf die Transfermarktseite gucken […] wenn man doch rechts z. B. sein eigenes Team
stehen hat. Rechts muss man auf jeden Fall das Profil direkt öffnen. Wenn ich links einen der drei vorgeschlagenen anklicke, will
ich den erstmal auswählen. Wenn ich den ausgewählten nochmal anklicke, will ich, dass sich das Profil öffnet. Und in der Mitte
sowieso, da will ich auch immer einen auswählen können oder dass sich das Profil öffnet." Nachtrag: „man muss ja die möglichkeit
haben zu skippen oder zu sagen ne bin fertig mit dem draft".

**Nur Review, Mockup und Doku — an der App ist nichts gebaut.** Ablauf wie in CLAUDE.md für größere Konzepte: Chris sieht das
Mockup, sagt „bau das" oder korrigiert, dann baut Sonnet.

- Mockup (klickbar): `public/mockups/ux-draft-markt-19-11.html` — Reiter `#draft`, `#markt`, `#regel`; im Draft oben der
  Schalter „Kader 3 / Kader 9" (nur im Mockup, zeigt „Ich bin fertig" gesperrt und frei)
- Bilder: `docs/design/ux-review-draft-markt-19-11/` — `ist-*.png` (App, 1920×1080, Wegwerf-Spielstand) und `mockup-*.png`
- Aufnahme: `npx tsx scripts/screenshot-ux-review-draft-markt.ts` (`NUR_MOCKUP=1` nur das Mockup)
- Stil: Tokens und Klassen der Mockups vom 17./18.11. übernommen; alle Zahlen im Mockup sind erfunden, Namen/Portraits/Wappen echt

## 1. Die Regel

> **Ein Klick wählt aus. Ein Klick auf das Ausgewählte öffnet das Profil.**
> Wo es nichts auszuwählen gibt (eigener Kader, vergebene Spieler), öffnet schon der erste Klick das Profil.

| Spalte | Element | 1. Klick | Klick auf das Ausgewählte | Heute |
|---|---|---|---|---|
| Links | Draft: Vorschlag des GM (eigener Zug) | auswählen | Profil | wählt aus, zweiter Klick tut nichts (`ist-04`, `ist-05`) |
| Links | Draft: Top 3 der KI, Portraits unter „Danach am Zug" | auswählen (vormerken) | Profil | Karte ohne Klick, nur der Name ist ein Link |
| Mitte | Zeile im Draft-Brett / im Markt | auswählen | Profil | wählt aus, zweiter Klick tut nichts (`ist-06`, `ist-07`, `ist-12`, `ist-13`); im Markt ist der Name kein Link |
| Mitte | Draft „Alle Picks" (vergeben) | Profil | – | nur der Name ist ein Link |
| Mitte | Markt: eigener Kader unter Verkauf / Verträge | auswählen (Verkaufsvorschau) | Profil | kein Weg ins Profil (`ist-14`) |
| Rechts | Bühne des Ausgewählten | Profil | – | Draft: nur der Name. Markt: Knopf „Profil" als fünfter von fünf |
| Rechts | Mein Kader | Profil | – | Draft: Kachel ohne Namen öffnet das Profil (`ist-08`, `ist-09`). Markt: Kader gar nicht zu sehen |
| Rechts | Wunschliste (noch frei) | auswählen | Profil | wählt aus, zweiter Klick tut nichts |
| Unten | Live-Ticker | Profil | – | nur der Name ist ein Link |

Was die Regel trägt, damit sie nicht geraten werden muss:

- **Sichtbarer Zustand, überall gleich:** goldene Kante links und goldener Portraitrahmen in Listen, auf Karten Rahmen plus Schild
  „ausgewählt". Heute sieht „ausgewählt" im Draft-Brett kaum anders aus als Hover, und dreizehn Schilder „vormerken" sehen aus wie
  Knöpfe, sind aber keine (`ist-02`).
- **Der zweite Klick steht als Knopf da:** in der ausgewählten Zeile erscheint „Profil ›" neben „Picken"/„Verhandeln". Wer die
  Regel nicht kennt, findet den Weg trotzdem; auf Touch gibt es keinen Hover.
- **Hover sagt, was der Klick tut:** „Klick wählt aus" bzw. „nochmal klicken · Profil" (Karte: Banderole, Zeile: Text rechts, dazu `title`).
- **Name = Abkürzung:** gepunktet unterstrichen wie heute im Draft, neu auch im Markt; wählt aus *und* öffnet das Profil.
- **Knöpfe in der Zeile** (★, Picken, Verhandeln, Vergleich) tun nur ihre Sache und ändern die Auswahl nicht.
- **Ein Wort:** „ausgewählt" statt heute „vormerken / vorgemerkt / Klick merkt vor" (Draft) und stillem Fokus (Markt).
- **Tastatur:** ↑/↓ bewegt die Auswahl in der mittleren Liste, Enter öffnet das Profil, Esc schließt Profil/Dialog/Vergleich,
  ←/→ blättert im Profil durch die Liste. Gepickt und gekauft wird bewusst nie per Taste. Heute gibt es nur Esc im Profil.

## 2. Ist-Befunde

**Klickverhalten (Code gelesen und am Wegwerf-Spielstand nachgeklickt)**

1. Zweitklick tut nirgends etwas. `DraftLive.tsx` `FavKarte` → `onVormerken(id)` = `setWahl`; Brett-Zeile `onClick={() => k.setWahl(...)}`;
   Markt-Zeile `waehle()` = `setFokusId`. Ins Profil führt im Draft nur der Namens-Link (`.drf-pl`), im Markt nur der Knopf „Profil"
   ganz unten rechts in `FokusSpieler`.
2. Der Namens-Link im Draft öffnet das Profil, **ohne** auszuwählen (`stopPropagation`). Schließt man das Profil, steht rechts
   noch der vorige Spieler.
3. Top-3-Karten sind nur am eigenen Zug klickbar (`onClick={meinZug ? … : undefined}`), sehen aber immer gleich aus
   (`cursor:pointer`, Hover-Rahmen). Bei KI am Zug passiert beim Klick nichts (`ist-01`).
4. Im Brett pickt „Picken" in **jeder** der 13 Zeilen sofort und ohne Rückfrage (`ist-03`). Dreizehn goldene Hauptknöpfe
   konkurrieren mit dem einen großen rechts; ein Fehlklick kostet einen Pick.
5. Transfermarkt Verkauf/Verträge (`KaderAnsichten.tsx`): Zeile wählt aus, es gibt keinen Weg ins Profil des eigenen Spielers.
6. Der Markt wählt immer still die erste Zeile vor (`fokus = … ?? gefiltert[0]`), der Draft am eigenen Zug den GM-Vorschlag
   (`LigaDraftSeite.tsx` Z. 147–153). Mit der neuen Regel öffnet der erste Klick auf *diesen* Spieler also schon das Profil —
   das ist folgerichtig, braucht aber den deutlichen Zustand aus Abschnitt 1 (siehe Entscheidung E1).

**Rechte Spalte „eigenes Team"**

7. Draft: „Mein Kader" sind 14 Kacheln ohne Namen und ohne Werte (`ist-08`). Man sieht, *wie viele* man hat, nicht *wen* und
   nicht, wo die Lücke ist. Nach dem Pick ist die untere Hälfte der Spalte leer (`ist-08`, `ist-10`).
8. Draft: nichts zeigt, was der Ausgewählte im eigenen Kader ändert. Die Ränge stehen einen Reiter weiter („Liga & Ränge"),
   die Rechnung dafür gibt es schon (`draft-liga.ts`, `transfermarkt-kaderstaerke.ts`).
9. Transfermarkt: der eigene Kader steht auf der Markt-Ansicht gar nicht. Links gibt es die Kaderstärke je Disziplin mit
   „mit ihm" (gut), rechts den Kandidaten sehr ausführlich (20 Balken, Wege, Wirkung, Vertrag) — aber nicht die Frage
   „wen verdrängt er?" (`ist-11`).
10. Zu viel Text im Draft rechts: Kasten „Gehaltsbudget: in Saison 1 ohne Vorstandsdeckel …" (zwei Zeilen für „hier gilt
    nichts"), dazu „Kein KI-Team vor dir …" und „Draft-Vertrag: 1 Saison …" als drei getrennte Hinweiszeilen.

**Nicht picken (Nachtrag)**

11. „Ich bin fertig · Pick auslassen" sind zwei kleine Textlinks in Hinweisgröße unter dem Pick-Knopf (`AuslassenFertig` in
    `DraftLive.tsx`); gesperrt sind sie nur blasser, der Grund steht allein im Tooltip (`ist-03`, `ist-08`).
12. Beide lösen **sofort** aus, ohne Rückfrage — „Ich bin fertig" nimmt einen endgültig aus der Reihenfolge.
13. „Überspringen" steht oben in der Tempo-Leiste zwischen Pause/1×/3× und liest sich wie „diesen Pick überspringen", meint aber
    den ganzen Draft (Dialog A/B, der selbst gut ist).

## 3. Vorschläge

Aufwand grob, für Sonnet nach fertigem Entwurf. Nichts davon berührt Wertung, Draft-Logik oder Routen — alles Anzeige und Klick.

### P1 — sofort bauen, klein

| # | Was | Dateien | Aufwand |
|---|---|---|---|
| 1 | **Zweitklick = Profil** in allen auswählbaren Elementen (Vorschlagskarte, Brett-Zeile, Wunschliste; Markt-Zeile; Kaderzeile Verkauf/Verträge). Name wählt zusätzlich aus. Ein gemeinsamer Helfer `klickAuswahlOderProfil(id, gewaehlt, waehle, profil)`. | `draft-modern/DraftLive.tsx`, `transfermarkt-modern/TransfermarktModern.tsx`, `KaderAnsichten.tsx` (braucht `onOpenPlayerDetails` als Prop) | ½ Tag |
| 2 | **Zustand + Hinweis:** einheitliches „ausgewählt" (Kante, Rahmen, Schild), Hover-Text, „Profil ›" in der ausgewählten Zeile, Wort „ausgewählt" statt „vormerken". „Picken"/„Verhandeln" nur noch in der ausgewählten Zeile (E3). | `DraftLive.tsx`, `draft-modern.css`, `TransfermarktModern.tsx`, `transfermarkt-modern.css` | ½ Tag |
| 3 | **Rechts öffnet direkt das Profil:** ganze Bühne des Ausgewählten klickbar (beide Seiten), Kader-Einträge mit Namen im `title` bleiben bis P2 Kacheln. Markt-Zeile: Name als Link. | `DraftLive.tsx` (`MeinDraft`), `TransfermarktModern.tsx` (`FokusSpieler`) | 2 Std. |
| 4 | **Top 3 der KI auswählbar** (gleiche Regel wie am eigenen Zug), Portraits unter „Danach am Zug" ebenso. | `DraftLive.tsx` (`AmZug`, `DanachAmZug`) | 2 Std. |
| 5 | **Nicht picken, klar und auffindbar** (Abschnitt 4): Block „Nicht picken?" mit drei beschrifteten Knöpfen rechts unter dem Pick-Knopf, Sperrgrund sichtbar („ab 8 Spielern · noch N Pflichtplätze"), Bestätigung für „Pick auslassen" und „Ich bin fertig". Knopf oben heißt „Draft überspringen …". | `DraftLive.tsx` (`AuslassenFertig`, Tempo-Leiste), `DraftAnsichten.tsx` (zwei kleine Dialoge nach Muster `AbbruchDialog`), `draft-modern.css` | ½ Tag |
| 6 | **Tastatur:** ↑/↓, Enter, Esc auf beiden Seiten (ein Hook `useListenTasten`), nicht in Eingabefeldern. | neu `app/foundation/shared/…`, beide Seiten | ½ Tag |
| 7 | **Text raus (Draft rechts):** Gehaltsbudget-Kasten in den Tooltip der Kasse, „Draft-Vertrag: 1 Saison" in den Pick-Knopf-Tooltip (steht dort schon), Konkurrenzhinweis nur zeigen, wenn es Konkurrenz gibt. | `DraftLive.tsx` | 1 Std. |

Tests dazu: je Seite ein Klicktest (erster Klick wählt, zweiter öffnet, Kader öffnet direkt, Knöpfe ändern die Auswahl nicht),
Sperrgründe von „Ich bin fertig", Bestätigungen. Die `data-testid`s bleiben, `draft-auslassen`/`draft-fertig` öffnen dann den Dialog
— `scripts/screenshot-draft-mensch-ablauf.ts` und bestehende Tests, die direkt klicken, müssen den Bestätigungsklick ergänzen.

### P2 — der eigentliche Gewinn rechts

| # | Was | Dateien | Aufwand |
|---|---|---|---|
| 8 | **Gemeinsames Panel „Mein Kader in ⟨Disziplin⟩"** für Draft und Markt: eigene Spieler nach Eignung in der gewählten Disziplin, der Ausgewählte golden einsortiert („NEU"), Trennlinie nach Platz 6 („ab hier zählt die Eignung nicht mehr zur Kaderstärke"), der Verdrängte markiert „raus aus Top 6". Klick = Profil. Darunter Zähler Kader `3 → 4 · Pflicht 8 · Wunsch 11 · max. 14` als Streifen statt 14 Kacheln. (`mockup-01`, `mockup-06`) | neu `app/foundation/shared/MeinKaderPanel.tsx`; Daten: `lib/market/transfermarkt-kaderstaerke.ts` (vorhanden), im Draft `kaderMitPicks` aus `draft-liga.ts` | 1½ Tage |
| 9 | **Draft: „Wirkung auf deinen Kader"** wie im Markt (drei Disziplinen mit dem größten Rangsprung, „hebt N von 20"). Rechnung `wirkungMitKandidat` gibt es, im Draft fehlt nur die Vorbereitung mit den Live-Picks. | `DraftLive.tsx`, `draft-liga.ts`, `LigaDraftSeite.tsx` | 1 Tag |
| 10 | **Kasse nach Kauf/Pick als Zahl** („frei nach Pick 147,4 C · davon 38,0 C gebunden" bzw. „reicht nicht · es fehlen 18,2 C") statt nur als Balkensegment; im Markt links unter dem Betrag. | `DraftLive.tsx`, `TransfermarktModern.tsx` | 2 Std. |
| 11 | **Markt rechts entschlacken**, damit Nr. 8 Platz hat: 20-Balken-Diagramm und „Wege zum Erfolg" ziehen ins Profil (dort stehen sie seit #1650 ohnehin), rechts bleiben Bühne, drei Zahlen, Verhandeln, Wirkung, Mein Kader, Kasse (E4). | `TransfermarktModern.tsx` (`FokusSpieler`), `transfermarkt-modern.css` | ½ Tag |

### P3 — später

| # | Was | Aufwand |
|---|---|---|
| 12 | Im Profil ←/→ durch die Liste blättern, aus der man kam; Auswahl dahinter wandert mit; „Zurück" behält Blatt und Scrollstand. | ½ Tag |
| 13 | Lücken-Hinweis oben in „Mein Kader": die zwei schwächsten wichtigen Disziplinen als Schilder, Klick stellt Disziplin und Filter „hebt meinen Rang". | ½ Tag |
| 14 | Verkauf/Verträge im selben Panel-Aufbau wie Markt (rechts dieselbe Bühne, dieselbe Kasse), damit alle drei Markt-Reiter gleich bedient werden. | 1 Tag |
| 15 | Doppelklick-Schutz: zweiter Klick innerhalb von 250 ms nach dem ersten zählt als Doppelklick = Profil (ergibt sich aus der Regel von selbst, nur testen). | – |

## 4. Nicht picken: Auslassen, Fertig, Überspringen

Alle drei gibt es schon; sie sind nur klein, unerklärt und ohne Rückfrage. Im Mockup stehen sie rechts unter dem Pick-Knopf als
Block **„Nicht picken? · drei Wege"** (`mockup-10` bis `mockup-14`), jeder Knopf mit einer Zeile Folge darunter.

| Aktion | Wann geht es | Was passiert | Gesperrt zeigt | Bestätigung |
|---|---|---|---|---|
| **Pick auslassen** | nur am eigenen Zug (`mein.darfAuslassen`) | dieser Pick entfällt, nächste Runde wieder am Platz dran; Kasse und Wunschliste bleiben | der vorhandene Sperrgrund sichtbar unter dem Knopf (nicht am Zug · Auto-Pick an · Nachzug · Runden reichen sonst nicht mehr für 8) | kurz: „Diesen Pick auslassen?" Ja / Zurück |
| **Ich bin fertig** | ab Mindestkader 8 (`mein.darfFertig`) | raus aus der Reihenfolge, kein weiterer Pick, endgültig; nachkaufen am Transfermarkt | gestrichelter Knopf, rot „ab 8 Spielern · noch N Pflichtplätze" | ja, mit Kader, Wunschgröße des GM („dir fehlen 2") und Kasse, die bleibt |
| **Überspringen …** | jederzeit | Dialog wie heute: A „KI fertig picken lassen, ich picke danach" · B „Auto-Draft" | – | der Dialog ist die Bestätigung |

Dazu: der Knopf oben in der Tempo-Leiste heißt „Draft überspringen …" (nicht mehr „Überspringen" neben Pause/1×/3×), und der
Regieband-Taktgeber rechts oben („Noch N Pflichtplätze" / „Draft abschließen") bleibt, wie er ist — er ist heute schon der zweite
Weg zu „Ich bin fertig" und bekommt dieselbe Bestätigung. Gesperrt wird weiter strikt nach `darfAuslassen`/`darfFertig` der Sicht;
die Seite rechnet nichts nach. Die Sperrtexte gibt es schon (`auslassenSperrGrund`, `fertigSperrGrund` in `draft-format.ts`) — sie stehen heute nur im Tooltip und rücken sichtbar unter den Knopf.

## 5. Was Chris entscheiden muss

| # | Frage | Empfehlung |
|---|---|---|
| **E1** | Am eigenen Zug ist der GM-Vorschlag Nr. 1 schon ausgewählt (im Markt die erste Zeile). Ein Klick darauf öffnet dann sofort das Profil. So lassen, oder ohne Vorauswahl starten? | **So lassen.** Der Zustand ist deutlich markiert, und der Pick-Knopf rechts ist sofort scharf. |
| **E2** | Name = direkt ins Profil (ein Klick), auch wenn die Zeile noch nicht ausgewählt ist? | **Ja**, als Abkürzung; er wählt dabei mit aus. |
| **E3** | „Picken" nur noch in der ausgewählten Zeile (statt 13 Knöpfe, die sofort picken)? Kostet für einen Pick aus der Liste einen Klick mehr. | **Ja.** Ein Fehlklick pickt dann nicht mehr; der große Knopf rechts bleibt. |
| **E4** | Markt rechts: „Mein Kader" dauerhaft unter dem Ausgewählten (20 Balken und Wege wandern ins Profil) — oder Umschalter „Spieler / Mein Kader"? | **Dauerhaft.** Die Frage „wen verdrängt er" gehört neben den Kaufknopf. |
| **E5** | Top 3 der KI-Teams auswählbar machen (vormerken), auch wenn man nicht dran ist? | **Ja**, sonst gilt die Regel links nur manchmal. |
| **E6** | „Pick auslassen" mit Rückfrage? (Bei „Ich bin fertig" ist sie gesetzt, weil endgültig.) | **Ja, kurz** — der nächste Zug läuft sofort, zurück geht nicht. |

## 6. Bilder

Ist-Stand (App): `ist-01` KI am Zug · `ist-02` Zeile geklickt („vorgemerkt") · `ist-03` ich bin dran · `ist-04`/`ist-05` Vorschlag
einmal/zweimal geklickt (kein Unterschied) · `ist-06`/`ist-07` Zeile einmal/zweimal geklickt (kein Unterschied) · `ist-08` nach dem
Pick, Kader als Kachel · `ist-09` Kachel öffnet das Profil · `ist-10` Auto-Draft läuft · `ist-11` Markt · `ist-12`/`ist-13` Zeile
einmal/zweimal geklickt · `ist-14` Verkauf · `ist-15` Verträge.

Mockup: `mockup-01` Draft, Vorschlag 1 ausgewählt · `mockup-02` Hover-Hinweis in der Liste · `mockup-03` Vorschlag 2 ausgewählt ·
`mockup-04` zweiter Klick öffnet das Profil · `mockup-05` Kader-Klick öffnet das Profil · `mockup-06`/`mockup-07` Markt mit
„Mein Kader" · `mockup-08` Profil per Enter · `mockup-09` Regel-Blatt · `mockup-10` „Ich bin fertig" gesperrt ·
`mockup-11` Pick auslassen · `mockup-12` Kader 9, „Ich bin fertig" frei · `mockup-13` Bestätigung · `mockup-14` Überspringen.

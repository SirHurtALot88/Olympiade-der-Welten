# UX-Umbau 19.11.: Draft und Transfermarkt nach dem freigegebenen Mockup

Chris, 19.11.: „beide mockups sind sehr gut, bitte genau so umbauen!“ Alle Empfehlungen E1 bis E6 des Reviews
(`docs/design/ux-review-draft-markt-19-11.md`, PR #1653) gelten als angenommen. Gebaut wird in zwei PRs:

| PR | Inhalt | Stand |
|---|---|---|
| **A (P1)** `claude/ux-klickregel-nicht-picken-19-11` | Eine Klickregel, Zustand und Hover, Picken nur in der ausgewählten Zeile, Tastatur, „Nicht picken?“ mit Rückfragen, Text rechts im Draft entfernt | dieser PR |
| **B (P2)** `claude/ux-mein-kader-panel-19-11` | Gemeinsames Panel „Mein Kader in ⟨Disziplin⟩“, „Wirkung auf deinen Kader“ im Draft, Kasse als Zahl, Markt rechts entschlackt | folgt |

Nur Anzeige und Klick. Wertung, Draft-Logik, Matrix, Arena und Routen sind unberührt (Fingerabdruck GESAMT `eaafed96150e`).

## PR A: was gebaut ist

- **Die Regel** steht in `app/foundation/shared/klickregel.ts` (`klickAuswahlOderProfil`, `nameKlickAuswahlUndProfil`, `naechsteAuswahl`,
  `entscheideTaste`, Hooks `useListenTasten` und `useEscSchliesst`). Draft und Transfermarkt rufen dieselben Funktionen.
- **Draft** (`DraftLive.tsx`, `LigaDraftSeite.tsx`): Brett-Zeile, Vorschlag und Top 3 der KI (auch wenn man nicht dran ist, E5), Portraits
  unter „Danach am Zug“ und Wunschliste folgen der Regel; vergebene Spieler (Alle Picks, Ticker) öffnen sofort das Profil; die Bühne rechts
  öffnet das Profil; „Picken“ steht nur in der ausgewählten Zeile (E3), daneben „Profil ›“; am eigenen Zug ist Vorschlag Nr. 1
  ausgewählt (E1, schon vorher so, jetzt deutlich markiert).
- **Transfermarkt** (`TransfermarktModern.tsx`, `KaderAnsichten.tsx`): Markt-Zeile, Name als Link, Bühne rechts (der Knopf „Profil“ ist
  entfallen), Verkauf/Verträge (Zeile, Name, „Profil ›“ im Kopf); „Verhandeln“ steht in der ausgewählten Zeile.
- **Nicht picken?** (E6): drei beschriftete Knöpfe unter dem Pick-Knopf mit sichtbarem Sperrgrund. „Pick auslassen“ und „Ich bin fertig“
  fragen vorher (`AuslassenDialog`, `FertigDialog` in `DraftAnsichten.tsx`), auch der Taktgeber-Knopf „Draft abschließen“. Der Knopf in
  der Tempo-Leiste heißt „Draft überspringen …“.
- **Text raus**: Gehaltsbudget-Kasten (jetzt Tooltip der Kasse), „Draft-Vertrag“-Zeile (steht im Tooltip des Pick-Knopfs),
  „Kein KI-Team vor dir …“ (Hinweis nur noch bei echter Konkurrenz).
- **Tastatur**: ↑/↓ Auswahl in der Liste, Enter Profil, Esc schließt Profil, Rückfragen, Vergleich und Verhandlungstisch. Nie Picken oder
  Kaufen per Taste; in Eingabefeldern und bei offenem Dialog bleibt die Liste still. ←/→ im Profil blättern bleibt P3 (Review Nr. 12).

## Bilder

`docs/design/ux-umbau-19-11/` (1920×1080, Hauptansichten zusätzlich 1710×1112), aufgenommen mit
`npx tsx scripts/screenshot-ux-umbau-draft-markt.ts` (Draft) und `NUR_MARKT=1 …` (Transfermarkt). Zum Vergleichen die Mockup-Bilder in
`docs/design/ux-review-draft-markt-19-11/`.

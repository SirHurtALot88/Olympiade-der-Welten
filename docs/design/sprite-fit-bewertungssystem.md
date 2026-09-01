# Sprite-Fit-Bewertungssystem

Wie gut trifft das im Battle Mode gebaute Sprite-Rezept (`BAU`-Tabelle in
`public/mockups/battle-mode.engine.js`, oder `vollbild:"..."` für eigenständige Illustrationen)
das Konzept-Portrait (`public/portraits/<slug>.jpg`) desselben Charakters? Dieses Dokument legt
eine 1-5-Sterne-Rubrik dafür fest, damit Bewertungen über verschiedene Runden und Bearbeiter
hinweg vergleichbar bleiben — nicht nur ein Gefühl im Kopf eines einzelnen Betrachters.

Ausgangspunkt waren Chris' eigene Kalibrierpunkte (siehe unten); die Definitionen sind so
geschärft, dass sie diese Punkte konsistent reproduzieren.

## Die fünf Stufen

**★★★★★ (5) — Vollständiger Treffer.**
Körpertyp/Rasse/Silhouette stimmen, UND die spezifischen Details, die den Charakter einzigartig
machen — Krone, Requisiten, Rüstungsfarbe/-material, markante Anhängsel, Flügelform, Waffe —
sind im Rezept sichtbar abgebildet. Nichts Charakteristisches fehlt, das ein Betrachter des
Portraits im Sprite vermissen würde.
*Anker:* King Arlen Morgolor — älterer menschlicher König, glänzende goldene Rüstung, Krone: alles
davon ist im Sprite da.

**★★★★ (4) — Grundidentität korrekt, ein Detail fehlt.**
Körpertyp/Rasse/allgemeiner Look ist richtig getroffen, aber GENAU EIN markantes, klar
benennbares Merkmal fehlt oder ist falsch — eine punktuelle Korrektur (ein Layer, eine Textur,
eine Farbe) würde auf 5 Sterne heben. Der Unterschied zu 3 Sternen ist die Zahl der fehlenden
Details: bei 4 Sternen lässt sich der Fix in einem Satz benennen, bei 3 Sternen sind es mehrere
Baustellen oder eine grundsätzlich zu grobe Annäherung.
*Anker:* Krolach — Standard-Construct-Look ohne die Kristallstacheln aus dem Portrait. Mit
Stacheln wäre er eine 5, ohne bleibt er eine 4 — das fehlende Detail lässt sich exakt benennen.

**★★★ (3) — Grobe Kategorie stimmt, spürbar generisch.**
Die grobe Kategorie ist richtig (z.B. "irgendein Monster", "irgendein Ritter", "irgendeine
Magierin"), aber das Rezept ist eine reine Näherung: mehrere charakteristische Details fehlen,
oder es wirkt wie ein austauschbarer Vertreter seiner Kategorie statt wie der spezifische
Charakter. Anders als bei 4 Sternen lässt sich der fehlende Punkt nicht in einer einzigen
Korrektur zusammenfassen.

**★★ (2) — Kategorie verfehlt, aber thematischer Bezug vorhanden.**
Körpertyp/Kategorie passt kaum oder ist stark verfälscht — ein klar nicht-humanoides Konzept wird
z.B. als Standard-Humanoid mit bloßem Kopf-Tausch dargestellt. Es gibt aber noch einen
erkennbaren Bezug: richtige Farbfamilie, thematisch verwandtes Element, grobe Silhouette-Analogie.
Ein Betrachter, der Portrait und Sprite nebeneinanderlegt, erkennt "das soll wohl das sein",
auch wenn die Umsetzung strukturell falsch ist.

**★ (1) — Kein sinnvoller Bezug / strukturell unmöglich.**
Das Portrait zeigt etwas fundamental außerhalb des aktuellen Baukastens — ein echtes Tier, ein
unbelebtes Objekt (Schiff, Maschine), ein rein mechanisches Wesen ohne Humanoid-Analogie — und
das aktuelle Sprite hat keinen erkennbaren Zusammenhang dazu, meist weil es schlicht der
generische Standard-Humanoid ohne jede thematische Anpassung ist.
*Anker:* Vigil (Taube mit Kamera-Objektiv) und ein Schiff-Charakter (Kreischende Kogge) — beides
Konzepte, für die der Humanoid-Baukasten strukturell nichts hergibt.

## Abgrenzung 4 vs. 3 vs. 2 (die schwierigen Übergänge)

- **4 vs. 3**: Lässt sich der Rückstand in EINEM Satz als EIN nachrüstbares Element beschreiben
  ("Kristallstacheln fehlen", "Krone fehlt", "Flügel sind falsche Farbe")? → 4. Braucht es mehrere
  unabhängige Korrekturen oder eine grundsätzlich andere Bauweise? → 3.
- **3 vs. 2**: Ist die grobe Kategorie (Mensch/Monster/Konstrukt/Tier-artig) noch richtig, nur die
  Ausführung generisch? → 3. Ist die Kategorie selbst falsch (nicht-humanoides Wesen wird als
  Standard-Mensch mit Kopf-Swap gebaut, oder umgekehrt)? → 2.
- **2 vs. 1**: Gibt es noch IRGENDEINEN erkennbaren Bezug (Farbe, Thema, grobe Form)? → 2. Ist der
  Bezug komplett verschwunden, weil das Konzept strukturell außerhalb des Systems liegt (Tier,
  Objekt, Maschine) und das Sprite nur der neutrale Standard-Humanoid ist? → 1.

`fehlendesDetail` wird nur bei 3 und 4 Sternen ausgefüllt (bei 4 Sternen so konkret wie möglich,
bei 3 Sternen darf es eine kurze Sammelkategorie sein); bei 1, 2 und 5 Sternen ist es `null`, weil
entweder nichts Punktuelles zu benennen ist (1/2 — der Fehler ist strukturell) oder nichts fehlt (5).

## Anwendung

Für jeden Charakter aus `data/generated/battle-arena-sprite-gallery.json` wird das Portrait
(`public/portraits/<slug>.jpg`) direkt neben der aktuellen Sprite-Vorschau
(`public/sprites/preview/<slug>.png`) betrachtet und nach obiger Rubrik bewertet. Ergebnis:
`data/generated/sprite-fit-bewertung.json`, Liste von:

```json
{ "name": "...", "slug": "...", "sterne": 1-5, "begruendung": "...", "fehlendesDetail": "..." }
```

Die vollständige Auswertung der ersten Bewertungsrunde (Verteilung, Triage-Listen für 1-Stern-
und 4-Stern-Fälle) steht in [`sprite-fit-ergebnisse.md`](./sprite-fit-ergebnisse.md).

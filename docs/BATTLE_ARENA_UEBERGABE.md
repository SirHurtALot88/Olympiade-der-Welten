# Battle Arena — Übergabe an die nächste Sitzung

Stand: 23.08.2026, Branch `claude/ui-ux-upgrades-dat4ys`, PR
[#651](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/651).

Diese Datei existiert aus einem Grund: **der Netzzugang öffnet sich erst in einer neuen
Sitzung.** Chris hat die Netzwerk-Policy der Umgebung auf alle Domains gestellt, aber ein
laufender Container liest sie nur beim Starten. Alles, was Assets, Dropbox-Bilder oder
Sprite-Nachschub braucht, wartet deshalb hier.

---

## Sofort prüfen, wenn die neue Sitzung startet

```sh
curl -sS -o /dev/null -w "%{http_code}\n" https://opengameart.org/
curl -sS -o /dev/null -w "%{http_code}\n" https://www.dropbox.com/
```

`200` statt `000` heißt: der Zugang steht. Dann zuerst die drei Punkte unter
„Wartet auf Netzzugang".

---

## Wartet auf Netzzugang

### 1. Die 599 Spielerbilder aus Chris' Dropbox

Der Dropbox-Connector funktioniert (Suche, Metadaten, Ordner) — **nur die Bilddaten
selbst** kamen nicht durch, weil sie von `dropboxusercontent.com` ausgeliefert werden.

Ordner: `/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/` und `Spieler/fertig/`
(höhere Auflösung). Benannt nach Spielernamen, z. B. `Krolach.jpg`.

**Wozu:** `lib/battle/subclass-archetypes.ts` ordnet jede der 56 Unterklassen MEHREREN
Archetypen zu — nach Chris' ausdrücklicher Regel „im Zweifel alle zuweisen, dann ist der
Skill-Pool größer". Ein Spielerbild verengt diese Auswahl für **diesen einen** Spieler.
Fünf sind schon eingearbeitet (`BILDBEFUNDE`), 594 fehlen.

Ebenfalls dort: `Rassen Klassen Traits.xlsx`, `Oly Player Stats 05-2026.xlsx`,
`Olympiade Player Stats.csv` — noch nie angesehen, könnten die Zuordnung stützen.

### 2. Die fehlenden Lauf-Sprites

**Alle 77 Blätter des Sprite-Baukastens liegen jetzt als PNG-Dateien** unter
`public/sprites/baukasten/` — mit `index.json` (Maße, Bildzahl, Richtungen) und einer
README, die den Aufbau erklärt. Sie sind zusätzlich in `battle-mode.html` eingebettet.
Vorher lagen sie nur als base64 in zwei HTML-Dokumenten.

Den vollen Satz aus Gang, Schlag und Schuss haben aber nur **vier** Ebenen: Körper
(`k_*`), Kopf (`g_*`), Rüstung (`r_*`) und Haar (`h_*`). Krone, Bart, Schultern, Arme,
Beine, Stiefel, Umhang, Hörnerhelm, Visier, Schild, Doppelaxt und die zwanzig Köpfe gibt
es **nur als Schlag-Blatt** (6 Bilder). Für die Animation fehlen deren Gang-Varianten
(9 Bilder), die Schuss-Varianten (13) und **alle `hurt`-Blätter**.

Quelle: Liberated Pixel Cup, dieselben Urheber wie in `CREDITS.csv`. Solange sie fehlen,
zeichnet die **stehende** Figur aus dem vollen Baukasten und der **laufende** Kämpfer aus
dem animierbaren Rest. Kommen die Blätter, fällt die Teilung weg.

Zwei konkrete Lücken darüber hinaus:
- **Krone für die Arena** — King Arlen hat sie in der Kaderliste, im Kampf nicht.
- **Vogel-Sprite für Seraph-11** — sein Bild zeigt einen mechanischen Vogel; er läuft
  derzeit als Metallgestalt mit Flügeln. Steht als Platzhalter im Code.

### 3. Hintergründe für die Disziplinen

TDM in einer tödlichen Kampfarena, Spurt als Hindernislauf im Freien. Bisher gar nicht
angefangen, weil OpenGameArt nicht erreichbar war.

---

## Offene fachliche Punkte

### A. Die Mutatoren drehen das Ergebnis (wichtigster offener Punkt)

In der **reinen Messlage** (ohne Mutatoren, ohne Formkarten, Intensität normal) gewinnen
die Vigilante Wranglers gegen Armageddon Aftermath **6:0 in 24 von 24 Kämpfen** — das ist
richtig so, V-W steht auf TDM-Rang 6, A-A auf 20.

Mit allem eingeschaltet sind es nur **25 %**. Ursache: `TRAIT_PUNKTE = 6` gibt A-A **+60**
Eignungspunkte gegen V-W **+30**. Gemessen: bei `TRAIT_PUNKTE = 3` steht V-W bei 50 %.

**Der eigentliche Zweifel:** Chris' Satz „wenn Renegade triggert, sind das auch +6 Punkte"
meinte vermutlich ein **Auslösen im Kampf**, nicht einen dauerhaften Aufschlag auf die
Disziplinwertung. Daraus wurde ein permanenter Bonus gemacht — das ist wieder eine zweite
Gewichtung neben der ersten. **Vor dem nächsten Balancing mit Chris klären.**

### B. Der Level- und Marktentwurf — Chris' Entscheidung steht

Fable hatte vorgeschlagen, den Marktwert auf Liga-Perzentile umzustellen.
**Chris hat abgelehnt: „nee, Marktwert fassen wir nicht an, die Berechnung bleibt!"**

Sein Weg stattdessen:

- Transfermarkt-Spieler **leveln mit** und bewegen sich auf dem **Median-Level der Liga**
- **Regression**: wer zurückliegt, holt schneller auf
- Grundertrag ~**10 Level je Saison**, mit Regression bis ~15
- Maximallevel 100 → **ausgereizt nach 7–8 Saisons**
- Das **Potential ist die eingebaute Bremse**: der Ligadurchschnitt steigt, bis alle an
  ihrer Grenze stehen, und flacht dann ab. Keine ewige Inflation, sondern eine Anlaufkurve
  und danach ein eingeschwungener Zustand.

**Noch zu messen:** ob Preisgelder und Sponsoreneinnahmen mitwachsen. Wenn die Gehälter
über den Marktwert steigen und die Einnahmen nicht, frieren die Kader ab Saison 4 ein —
nicht weil die Formel falsch ist, sondern weil nur eine Seite mitwächst.

### C. Die Slot-Auswahl beim Levelaufstieg war eine Erfindung

Chris fragte: „woher kommen die gewichteten Slots beim lvl up?" Die ehrliche Antwort:
**von Fable, nicht aus Eslabong.** Eslabong hat **vier** Stats und zeigt **alle vier** —
dort gibt es das Auswahlproblem gar nicht. Es entsteht erst bei unseren zwölf.

Von den Vorgaben hat genau **eine** eine Quelle: *ausgereizte Stats werden nicht
angezeigt* — die kommt von Chris. Alles andere ist zu entscheiden, nicht zu finden.

**Empfehlung (noch nicht bestätigt):** rein zufällig aus den nicht ausgereizten Stats.
Eine Gewichtung nach Klasse drückt jeden Spieler still in seinen Archetyp — das Gegenteil
von „aus verschiedenen Skill-Trees picken" und von „schwächere Spieler holen auf".

Was aus Eslabong wirklich belegt ist (veröffentlichte Patch Notes):
- Maximallevel 100; Fighter starten mit **einer** Fähigkeit
- Fähigkeiten steigen auf Level 10, 12, 14, 16, 18, 20; bis zu **5 Ränge**, **+10 %** je
  Rang auf Stärke, Wirkdauer und Abklingzeit
- Der **Wurf ist über die gewählten Stats geteilt**; kleine Chance auf einen legendären
  Schub
- Speed gibt Abklingzeit-Reduktion, DEF gibt Betäubungswiderstand

Chris' eigene Beobachtung: eine volle Saison Dauereinsatz ergab Level **21–25** — aber ein
Teil davon kam aus einem **Cup, den unsere Olympiade nicht hat**. Steht als
`SAISON_STUFEN_BEOBACHTUNG` in `lib/battle/archetype-registry.ts`.

### D. Die restlichen Klassenkarten

`lib/battle/class-kits.ts` hat **Cleric und Priest**. Es fehlen **33 von 35**. Die beiden
vorliegenden zeigen die Bauart: ein gemeinsamer **Skill-Pool**, aus dem Klassen auswählen
(sie teilen sich neun Skills mit identischen Zahlen), zwei Marken je Skill (Rarität,
Zugang) und **genau zwei garantierte Skills** je Klasse.

Die Priest-Liste ist im Screenshot abgeschnitten (`unvollstaendig: true`).

**Solange die Kits fehlen, tragen alle zwölf Spieler denselben Platzhaltersatz.** Das ist
Absicht: mit gemischten Kits misst jede Serie die Kit-Verteilung statt die Spieler.
Nachgemessen: das Bogenkit liegt bei 12,9 Nutzwert je Sekunde, Slash bei 7,3 — wer als
Einziger den Bogen trägt, entscheidet die Partie über sein Kit.

Deshalb trägt **Cassandra** trotz nachgewiesenem Bogen (Bild!) noch das Nahkampfkit. Ihr
Sprite hat den Bogen, ihr Kit folgt, sobald Bowman und Hunter vorliegen.

### E. Kleinere offene Punkte

- **Mini-DM** als Freiluft-Turnier aus einem Pool aller 16 Teams (max. 6 × 16 Spieler),
  von denen je vier gezogen werden und ein bis zwei weiterkommen — verschoben.
- **Spurt** hat Slot-Rollen im Spiel, die im Entwurf noch nicht abgeschrieben sind.
- **Portraits**: `public/portraits/` ist leer, der Index hat null Einträge. Bis Chris
  Bilder ablegt, greift sichtbar das Kürzel auf farbigem Grund.
- **Krits** sollen laut Chris nur noch an Skills hängen, nicht mehr am Grundschlag —
  Präzision ist bereits entfernt, die Skill-Krits fehlen noch.

---

## Was in dieser Sitzung fertig wurde

**Fünf Fehler zwischen Eignung und Kampf**, jeder einzeln kontrolliert. Ausgangslage: V-W
(Rang 6) verlor gegen A-A (Rang 20) 0:6 in 24 von 24.

| # | Fehler | Beleg |
|---|---|---|
| 1 | Zwei Bauwege statt einem | Spiegelkampf gegen identische Kopie: links verliert 2:6 in 24/24 |
| 2 | Heilen alle 0,3 s statt 1 s + Ansage (Karte) | A-A heilt 758/Kampf, V-W 0 |
| 3 | Tempo verkürzte jede Abklingzeit um 30 % | Karten nennen feste Abklingzeiten |
| 4 | Lauftempo mit Faktor 3,1 | Lava Golem 34 % Ausnutzung → 97 %, 95 → 584 Schaden |
| 5 | Verteidigung wirkte als Steuer auf LP und ANG | Health 99 gab 280 Leben, Health 52 gab 403 |

Dazu: Formkarten wurden **einmal beim Laden** gezogen (24 Kämpfe zeigten dasselbe
Ergebnis); die Führung ist aus der Leistungsrechnung raus (Chris: „sowas gabs im Original
nicht"); fünf Anzeigen rechneten noch mit alten Formeln (1,09 s Abklingzeit für Slash,
Leben × 12 statt × 4).

**Neue Datendateien**, 40 Tests grün:
- `lib/battle/archetype-registry.ts` — 35 Archetypen, Regel `max = round(min × 13/7)`
- `lib/battle/class-kits.ts` — Cleric und Priest, gemeinsamer Skill-Pool
- `lib/battle/subclass-archetypes.ts` — 56 Unterklassen → Archetypen, plus Bildbefunde

**Sprites**: der Sprite-Baukasten (Artefakt
`bea50d43-e66c-4008-aabf-36a293d594fd`) ist in die Arena übernommen — 51 Blätter, vier
Farbkategorien, Ebenenlisten für alle zwölf Spieler. King Arlen mit Krone und goldenem
Harnisch, Draco als Drachenritter mit Doppelaxt.

---

## Verlässliche Einstiegspunkte

| Was | Wo |
|---|---|
| Der Entwurf | `public/mockups/battle-mode.html` (eine Datei, kein Bundle) |
| Reiter im Spiel | `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` |
| Artefakt | https://claude.ai/code/artifact/af3bba05-dc93-4bcc-92f0-5f742f42380e |
| Sprite-Baukasten | https://claude.ai/code/artifact/bea50d43-e66c-4008-aabf-36a293d594fd |
| Messreihe | `node scripts/miss-arena-serie.mjs 24` (aus dem Repo-Wurzelverzeichnis!) |
| Spielstand | `git fetch origin live-save` — siehe `CLAUDE.md` |

Playwright-Skripte **müssen im Repo liegen und von dort laufen**, sonst findet Node das
Modul nicht. Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

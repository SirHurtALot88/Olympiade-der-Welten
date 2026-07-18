# Baseline: Disziplin-Bühne nativ nachbauen (iframe-Ablösung)

**Status:** verbindliche Baseline / Umsetzungs-Backlog.
**Ziel:** Die eingebettete iframe-Arena (20 Canvas-HTML-Szenen + Bridge-Injektion) durch einen **sauberen nativen React-Nachbau** ersetzen — scharf (DPR), responsive, mit den `--nl-*`-Design-Tokens integriert, und über wenige Layout-Primitive auf alle 20 Disziplinen skalierend.

## 1. Warum das iframe-Embed unsauber ist

- **Pixelig — kein DPR-Handling.** Szenen rendern auf ein fixes Canvas (`staffel-oval.html:249`, `width=1180 height=820`) und skalieren per CSS (`.arena canvas{width:100%;height:auto}`). Kein `devicePixelRatio`-Upscaling → auf Retina und bei jeder Breite ≠ 1180 wird der Bitmap-Buffer resampled → weich/pixelig. Die Bridge (`.wrap{max-width:100%}`) streckt das 1180er-Canvas zusätzlich.
- **Größen-Ringen — zwei Layoutsysteme.** Wrapper setzt harte iframe-Maße, Szene fährt intern eigenes Grid/Padding/Breakpoints. Das iframe kann seinen Inhalt weder messen noch beeinflussen → interner Scroll, abgeschnittene Podien, Leerraum.
- **„Aufgesetzt" — doppeltes Designsystem.** Szenen definieren eigene Tokens/Typo/Dark-Mode; CSS-Variablen der App überschreiten die iframe-Grenze nicht → andere Farben/Typo, potenziell falscher Hell/Dunkel-Modus.
- **Fragile Injektion + Doppel-Rendering.** Bridge monkey-patcht szenen-globale Funktionen per Regex; jede Szene generiert erst eine Fake-Welt, dann kommen echte Daten drüber (zwei Wahrheiten). 20× duplizierte Choreografie (~28.000 Zeilen HTML) — jeder Fix muss gegen 20 Varianten robust sein.
- **Verlorene Integration.** Kein Klick auf Spieler → PlayerDetailDrawer; Hovercards/Ticker/Ladder vom App-DOM isoliert; zwei redundante Ranglisten in zwei Optiken.

**Gegengewicht:** Die Choreografie selbst ist gut und über alle Szenen identisch strukturiert (gleiche Funktionsnamen) — sie ist die **Spezifikation für den Port**, nicht wegzuwerfen.

## 2. Native Architektur

```
app/foundation/discipline-stage/
  DisciplineStageArena.tsx        (bleibt: Host/Controls/Daten; iframe-Block raus)
  arena/
    useStageEngine.ts             ← headless State-Machine (Reveal/Tiers/Medaillen/Sound-Cues)
    useStageAudio.ts              ← WebAudio-Port (gun/wumms/star/ping/riser, mute)
    stagePrimitives.ts            ← DISCIPLINE_STAGE_CONFIG: id → {primitive, skin, slotLabels}
    StageArenaFrame.tsx           ← MyTracker, LiveFlag, Spotlight, Flash, Podium, ClickBar, Ticker, Ladder
    primitives/
      TrackStage.tsx              ← geteilter Pfad (Oval/Gerade): Position = Punkte
      LanesStage.tsx              ← 32 eigene Bahnen: Fortschritt = Punkte
      TowersStage.tsx             ← 32 vertikale Türme: Höhe = Punkte
      TiersStage.tsx              ← Etagen nach Rangband (TdM)
    StageToken.tsx                ← Team-Token (Logo-Kreis, Medaillenring, Glow, mine-Ring)
```

- **Engine (headless):** `useStageEngine(payload)` nimmt das heutige Payload unverändert; hält `{phase,round,revealOrder,scores,ranks,roundMedals,lastReveal,impact}`; 1:1-Port von `advance`/`applyReveal`/`computeRoundStandings`/`noteReveal`/`updateRoundMedals` (`staffel-oval.html:899-1146`) — einmal in TS, testbar, für alle 20. Quick-Sim = Engine synchron bis Ende.
- **Rendering: SVG mit `viewBox`** (nicht Canvas). Schärfe gratis auf jedem DPR; Last ist nur 32 Tokens + ~10 Deko-Pfade + 1 animiertes Element (<200 DOM-Knoten), Bewegung via CSS-`transform`-Transition (compositor); Token-Farben `fill="var(--nl-accent)"` etc. (Muster wie `NlRadar`/`nl-tones.ts`); Hover/Click nativ → `onOpenPlayer`; Logos als `<image>`+`clipPath`. Partikel (Mali-Splitter) als 4-6 kurzlebige SVG-Kreise (später optional DPR-Canvas-Overlay).
- **Responsive:** `aspect-ratio` je Primitive + `viewBox`; `ResizeObserver` nur für Breakpoint (Ladder neben/unter Arena). Kein iframe-Höhen-Raten.
- **Reveal + Reduced Motion:** Token-Position = `pos(score)` je Primitive; CSS-Transition auf `transform`; eigener Läufer Slow-Mo via längerer Duration; `usePrefersReducedMotion` setzt Durations 0, deaktiviert Shake/Flash/Partikel — zentral statt 20-fach.
- **Skins statt Szenen:** per-Disziplin-Identität (Oval/Skyline/Eis …) = Skin-Config (Deko-SVG `<defs>` + Farbrampen + Slot-Labels + Vokabular), ~50-150 Zeilen statt ~1.400.

## 3. 20 Disziplinen → 4 Primitive

| Primitive | Disziplinen |
|---|---|
| **track** (9) | staffel (Oval), spurt, takeshis-castle, hockey, wettessen, football, battlefield, mini-dm, i-spy |
| **lanes** (5) | time-trial, speed-schach, fechten, tennis, breaking |
| **towers** (5) | basketball, gewichtheben, climbing, eiskunstlauf, showcase |
| **tiers** (1) | tdm (4 Liga-Etagen + Fahrstuhl) |

Track/Lanes teilen die Mathematik (Fortschritt entlang einer Achse); Towers = dieselbe Mathematik vertikal; nur Tiers ist rang- statt punktepositioniert. → ~1 Engine + 4 Primitive + 20 dünne Skins.

## 4. Wiederverwendung

**Bleibt (schon nativ/szenen-agnostisch):**
- Datenschicht: `discipline-stage-data.ts`, `discipline-stage-from-preview.ts`, arena-base-Fetch, Payload-Bau inkl. Mutator-Trait-Logik.
- Native Overlays: `DisciplineStageEndScreen`, `DisciplineStageTopPlayers`, `DisciplineStageStandingsDelta`, `DisciplineStageHighlights`.
- Host/ErrorBoundary, Mount im Router-Body, Controls (Select, Echt/Random, Quick-Sim, „Spieltag auswerten").
- Design-System: `NlCard`, `StatChip`, `nl-tones.ts`-Muster für SVG-Token-Farben.

**Wird gelöscht (am Ende):** 20 HTML-Szenen (`public/discipline-scenes/*`), `scripts/inject-discipline-stage-bridge.mjs` + npm-Script, iframe + postMessage + `SCENE_BY_DISCIPLINE`.

**Wird portiert (Referenz-Spec = staffel-oval):** Reveal-Flow, Impact-Tiers/Budgets, Ladder, Hover-Karte, Podium, Sounds, Ticker. Die Bridge-Bugfixes (finale Runden-Ränge statt Live-Flackern, Medaillen nur auf aufgedeckte Teams, 1-Dezimal-Rundung) kommen **direkt in die Engine** statt als Patch.

## 5. Migrationsschritte

- **S1 — Headless Engine + Frame (Fundament).** `useStageEngine` (Port + Unit-Tests: Σ-Invariante, Rangfolge==Preview, Tier-Budgets), `useStageAudio`, `usePrefersReducedMotion`, `StageArenaFrame`. Kein Nutzer-sichtbarer Umbau.
- **S2 — Proof: `TrackStage` (Oval) für Staffel, PARALLEL zum iframe.** Umschalter „Nativ (Beta)" / iframe für A/B. **Go/No-Go-Gate:** scharf auf Retina, responsive ohne Scroll-Ringen, Feeling akzeptiert.
- **S3 — Track-Familie (8 Skins):** spurt, takeshi, hockey, wettessen, football, battlefield, mini-dm, i-spy.
- **S4 — `TowersStage` + 5 Skins:** basketball, gewichtheben, climbing, eiskunstlauf, showcase.
- **S5 — `LanesStage` + 5 Skins:** time-trial, speed-schach, fechten, tennis, breaking.
- **S6 — `TiersStage` (tdm)** mit Fahrstuhl-Übergang.
- **S7 — Abriss:** iframe/postMessage/SCENE_BY_DISCIPLINE raus, `public/discipline-scenes/` + Inject-Script + npm-Script löschen.

## 6. Aufwand / Feeling

| Schritt | Aufwand | Risiko |
|---|---|---|
| S1 Engine+Frame | groß | mittel (Choreografie-Port, per Unit-Tests absicherbar) |
| S2 Track-Proof Staffel | mittel | **hoch (Design-Abnahme) — Gate**, parallel zum iframe, rückbaubar |
| S3 8 Track-Skins | mittel | niedrig |
| S4 Towers +5 | mittel | niedrig-mittel (Skala-Dynamik) |
| S5 Lanes +5 | mittel | niedrig |
| S6 Tiers (tdm) | klein-mittel | mittel (Fahrstuhl) |
| S7 Abriss | klein | niedrig (−28k Zeilen) |

**Feeling:** Sound verlustfrei portierbar (reine WebAudio-Synthese, keine Dateien); Shake/Flash/Spotlight/Podium sind schon DOM/CSS → direkt portierbar; einziger Verzicht anfangs: Canvas-Partikel → einfachere SVG/CSS-Effekte (optional später DPR-Partikel-Canvas). **Gewinne:** pixelscharf auf jedem Display, echte Responsivität, ein Theme, klickbare Spieler, EINE Ladder, eine testbare Choreografie (Fix wirkt auf alle Disziplinen).

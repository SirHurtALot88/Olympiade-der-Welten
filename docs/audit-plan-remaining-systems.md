# Audit-Plan — verbleibende Mechaniken (Funktion + Balancing)

Stand: nach der Sponsor-Sterne→Rarität-Runde + dem ersten Season-System-Bug-Hunt (Match-State, Board,
Ökonomie, Season-Lifecycle = clean/gefixt). Dieser Plan deckt ab, was **noch nicht** dediziert getestet ist.

**Vorgehen pro Modul:** READ-ONLY Bug-Hunt (echten Code tracen, Findings mit `datei:zeile` + Repro belegen) für
die Funktion; für Balancing ein/mehrere überwachte Sim-Läufe mit Metriken. Jedes Modul ist ein
eigenständiges Arbeitspaket — nacheinander abarbeitbar, viele parallelisierbar.

**Sequenz-Logik:** Erst die **Funktions-Bug-Hunts** (Phase A) — Balancing ist sinnlos, wenn die Mechanik
falsch rechnet. Dann die **Mehrsaison-Balancing-Läufe** (Phase B), die auf funktions-korrekten Systemen
aufbauen und Drift über Zeit zeigen. Zuletzt die **Design-Entscheidungen** (Phase C), die deine Vorgabe
brauchen, kein Audit.

Legende Aufwand: S = klein (1 Agent/Lauf) · M = mittel · L = groß (mehrstufig).

---

## Phase A — Funktions-Bug-Hunts (parallelisierbar, read-only)

### A1 · AI-Draft / Organic Squad Builder / Roster-Komposition — **L**
**Scope:** Preseason-Kaderaufbau + In-Season-Komposition. Der frühere Plan-Befund („zu viel Backup/Reserve",
Needs-Handoff am Apply-Gate) wurde nie zu Ende gemessen.
**Einstieg:** `lib/ai/organic-squad/`, `lib/ai/market-pick-engine/`, `lib/ai/retool-ai2-pick-engine.ts`,
`lib/ai/chunked-redraft-topup-service.ts`, `lib/ai/season1-draft-cash-planner.ts`,
`lib/ai/season1-draft-spend-policy.ts`, `lib/ai/unified-pick-planner-service.ts`,
`lib/ai/ai-market-plan-apply-service.ts` (Buy-Gate `rankFinalBuyCandidates`).
**Funktion prüfen:** Doppel-Picks/duplicate players; Budget-Überschreitung/negatives Cash beim Draft;
Needs-Prioritäts-Reihenfolge überlebt bis ins Apply-Gate (nicht von Diversitäts-Heuristik zerwürfelt);
Roster-Targets (min/opt/max) korrekt durchgesetzt; Trade-Down/Top-up-Logik; Emergency-Filler.
**Balancing prüfen:** Tier-Verteilung (superstar/star/core/depth/backup/reserve) je Team — kippt es in
Backup/Reserve? Identitäts-Treue: kauft ein Elite-Identitäts-Team wirklich Elite? (Black-Panthers-Symptom)
**Vorhandene Deckung:** Gates `draft_no_duplicates`, `draft_negative_cash`, `draft_pick_coherence`,
`draft_quality_gate`, `draft_roster_targets`, `roster_post_buy`; ~18 Draft/Squad-Tests. Rollen-Spalte im
Long-Run existiert bereits (Kompositions-Metrik).
**Methode:** Bug-Hunt-Agent + kurzer S1-Lauf mit Rollen-Verteilungs-Tabelle vor/nach.
**Pass:** keine Duplicates/Budget-Bugs; Needs-Reihenfolge intakt; gesunde Tier-Verteilung (core+depth+star
dominiert, nicht backup/reserve); Identität sichtbar im Kader.

### A2 · Kern-Match-Modell (Score / Resolve / MVP) — **M**
**Scope:** WIE ein Ergebnis zustande kommt (Score-Engine, Disziplin-Paarung, Tor-/Ergebnis-Ableitung, MVP).
Wir haben *Auflösung + Idempotenz* geprüft, nicht ob die *Ergebnisse realistisch* sind.
**Einstieg:** `lib/lineups/legacy-score-engine.ts`, `lib/resolve/legacy-matchday-resolve-engine.ts`,
`lib/resolve/legacy-matchday-result-mapper.ts`, `lib/season/matchday-mvp-scoring-service.ts`,
`lib/season/season-discipline-schedule.ts`.
**Funktion prüfen:** Score→Ergebnis-Mapping (monoton? deterministisch?); Disziplin-Paarung fair/ohne
Wiederholung; Captain/Intensität/Moral/Form fließen korrekt in den Score; MVP-Auswahl korrekt; keine
Off-by-one in Tor/Punkt-Ableitung.
**Balancing prüfen:** Ergebnis-/Tor-Verteilung realistisch? Heim/Auswärts-Bias? Streuung (dominiert Stärke zu
stark → deterministische Liga, oder zu viel Zufall → Stärke egal)? Punkte-Spreizung Meister↔Absteiger.
**Vorhandene Deckung:** ~35 Match/Score/Standings/MVP-Tests; Standings-Idempotenz gerade gefixt.
**Methode:** Bug-Hunt-Agent + S1-Lauf mit Tor-/Punkte-Verteilungs-Statistik + Stärke↔Platzierungs-Korrelation.
**Pass:** deterministisch+monoton in Stärke, aber mit plausibler Streuung; realistische Tor-/Punkte-Bänder.

### A3 · Spieler-Generierung / Attribute / Potenzial-Ceilings — **M**
**Scope:** Das Basismodell: Attribut-Sheet, hidden attributes, Achsen-Ceilings, Potenzial-Scores. Speist ALLES
(Entwicklung, MW, Score) — wurde nie geprüft.
**Einstieg:** `lib/data/playerAttributeSheet.ts`, `lib/data/playerAttributeSheetData.ts`,
`lib/progression/player-potential-service.ts`, `lib/scouting/player-attribute-ceiling-service.ts`,
`lib/scouting/player-potential-ceiling-service.ts`.
**Funktion prüfen:** Attribut-Klammern (0–99, keine NaN/Negativ); Achsen-Ceiling ≥ aktuelles Attribut;
Potenzial-Score-Ableitung konsistent mit Achsen-Ceilings; Potenzial-Update-Drift (der gerade gefixte
Season-End-Drift) deterministisch + im Rahmen; Klassen-Profile plausibel.
**Balancing prüfen:** Attribut-/Potenzial-Verteilung der generierten Liga realistisch (nicht alle gleich, nicht
alle Extrem)? Talent-Dichte (wie viele echte Talente pot≥80?) — direkt verbunden mit A/Modul B5.
**Vorhandene Deckung:** ~12 Tests; Gate `potential_field_parity`, `training_potential`.
**Methode:** Bug-Hunt + Analyse-Skript über die generierte Liga (Verteilungs-Histogramme).
**Pass:** saubere Klammern; konsistente CA/PO/Ceiling-Kette; realistische Verteilung.

### A4 · Traits (kosmetisch + Soft-Effekte) — **S**
**Scope:** Wie Traits Fatigue/Entwicklung/Score/Verhandlung beeinflussen.
**Einstieg:** `lib/traits/cosmetic-trait-soft-effects.ts` (+ Aufrufer: `getPlayerFatigueLoadMultiplier` in
`fatigue-injury-service.ts`, ggf. Training/Score).
**Funktion prüfen:** Multiplikatoren geklammert/sinnvoll; kein Trait mit Doppel-Anwendung oder fehlender
Anwendung; deterministisch.
**Balancing prüfen:** Sind Trait-Effekte spürbar aber nicht dominant? Kein Trait der einen Spieler „bricht".
**Vorhandene Deckung:** nur ~3 Tests — dünn.
**Methode:** kleiner Bug-Hunt (ein Modul).
**Pass:** alle Trait-Effekte geklammert, einmal angewandt, moderate Magnitude.

### A5 · GM-Archetypen / Identitäts-Treue — **M**
**Scope:** Ob GM-Bias die Kader-/Transfer-/Verhandlungs-Entscheidungen wirklich prägt (der User-Kernwunsch
„Kaufen/Verkaufen muss Team-Identität + Needs berücksichtigen").
**Einstieg:** `lib/foundation/team-general-managers.ts`, `lib/ai/ai-market-quality-profile-service.ts`,
`lib/ai/gm-sell-archetype-modifier.ts`, `lib/foundation/team-identity-settings.ts`,
`lib/foundation/player-identity-meta.ts`.
**Funktion prüfen:** GM-Archetyp wird zugewiesen + gelesen; Bias fließt in quality-profile / sell-modifier /
premiumAppetite; kein toter `?? default`-Pfad, der den Bias verschluckt.
**Balancing prüfen:** Unterscheiden sich Teams sichtbar nach GM-Archetyp (hoarder vs developer vs win-now)?
Kauft ein Elite-Identitäts-Team konzentriert Elite statt breit Diversität? (Black-Panthers-Test)
**Vorhandene Deckung:** ~10 Tests; Gate `gm_assigned`, `identity_coherence`.
**Methode:** Bug-Hunt + S1-Lauf, Team-Lanes + 10 teuerste Spieler je GM-Archetyp vergleichen.
**Pass:** GM-Bias durchgängig wirksam; Teams divergieren nach Identität/Archetyp.

---

## Phase B — Mehrsaison-Balancing-Läufe (sequenziell, brauchen funktions-korrekte Systeme)

> Basis: `scripts/long-run-sandbox-s1-s6.ts` (self-seeding, isolierte SQLite), phased via
> `run-long-run-s10-pipeline.sh`-Muster (S1→S2 messen, dann Vollrun). Report:
> `scripts/generate-balancing-report.ts` + `scripts/export-balancing-save-review.ts`.

### B1 · Mehrsaison-Ökonomie S1–S6 (Schere · Inflation · Cash) — **L** ⭐ höchster Wert
**Scope:** Das ursprüngliche Ziel. Ökonomie über Zeit — jetzt MIT +0,1-Shift raus + neuem Sponsor-System.
**Prüfen:** Liga-MW/Cash-Trajektorie (inflationär/deflationär/stabil?); Top5/Bottom5-Schere (<2× Ziel);
Negative-Cash-Teams (=0); Kreditbedarf; Stagnation einzelner Teams.
**Vorhandene Gates:** `economy_plausible`, `transfer_finance_clean`, `salary_factor_seeded`;
`generate-balancing-report.ts` (Schere, Emergency-Filler %, Negative Cash).
**Pass:** Schere <2× über 6 Saisons; kein Team dauerhaft negativ; MW-Ø driftet nicht davon.

### B2 · Sponsor-Ökonomie mehrsaisonal (NEU — Rarität) — **M**
**Scope:** Das gerade gebaute Rarität-System über mehrere Saisons (bisher nur S1).
**Prüfen:** Rarität-Verteilung über die Liga (gewöhnlich→legendär) stabil? Bekommen schwache Teams durch die
Über-Cap-Glücksstufe gelegentlich bessere? Kurven-Wahl der AI passend zum Endplatz? Sponsor-Cash bleibt
gehaltsverankert (keine Inflation über Saisons)? Beliebtheit→Rarität-Kopplung wirkt?
**Vorhandene Gates:** `sponsor_ready`; die neuen Sponsor-Tests.
**Pass:** bounded Etat über Zeit; sinnvolle Rarität-Streuung; AI wählt zum Platz passende Kurven.

### B3 · Star-Entwicklung / Team-Divergenz — **M**
**Scope:** Entstehen über Saisons echte Stars (gap-getriebene Entwicklung)? Driften Teams auseinander?
**Prüfen:** Peak-P90-Netto über Saisons (Korridor 8–20 gerade neu kalibriert); wie viele Spieler erreichen
pot≥85 CA nach N Saisons; Team-Stärke-Spreizung wächst/schrumpft sinnvoll.
**Vorhandene Gates:** `organic_peak_net_corridor`, `training_potential`.
**Pass:** klare Star-Emergenz über Zeit; Entwicklung folgt der gap-Kurve; keine ligaweite Über-/Unter-Entwicklung.

### B4 · Roster-Komposition über Saisons (Backup/Reserve-Schieflage) — **M**
**Scope:** Der Plan-Phase-4-Befund über Zeit: kippt die Komposition in zu viel Backup/Reserve?
**Prüfen:** Tier-Verteilung je Team über Saisons (die Rollen-Spalte existiert bereits im Long-Run); bleibt
core+depth+star dominant? Organische Hebel (playerOpt, tight-budget-reserve) statt Hard-Limits.
**Pass:** gesunde Tier-Verteilung stabil über Saisons; keine Backup/Reserve-Explosion.

### B5 · Talent-Knappheit — **S/M**
**Scope:** Der früher geflaggte Befund: nur ~2/30 gerosterte Spieler pot≥80. Zu wenig Talent-Nachschub?
**Prüfen:** Talent-Dichte im generierten Pool (Modul A3) vs. wie viel davon gerostert wird; Nachwuchs-Zufluss
je Saison; ob die gap-getriebene Entwicklung an Talent-Mangel verhungert.
**Pass:** genug Talente im Pool + gerostert, damit Entwicklung/Stars greifen.

---

## Phase C — Design-Entscheidungen (brauchen deine Vorgabe, kein Audit)

### C1 · Preisgeld: Preview vs. gutgeschrieben — **Entscheidung**
Aktuell ist Preisgeld NUR Preview/Benchmark (`CASH_PRIZE_BENCHMARK_ONLY=true`), wird NICHT auf `team.cash`
gutgeschrieben — Season-End-Cash = Sponsor − Gehalt. **Frage:** bewusst so (Sponsoren = einzige Einnahme),
oder sollen Teams echtes Preisgeld nach Platzierung bekommen (zweite platzierungs-abhängige Einnahme neben den
Sponsoren)? Wenn ja: ökonomisches Re-Balancing nötig (Sponsor-Etat ggf. senken, damit die Summe passt).

---

## Empfohlene Reihenfolge zum Durcharbeiten
1. **A1–A5 parallel** (5 Funktions-Bug-Hunts, read-only, ~1 Runde) → Findings fixen.
2. **B1** (Mehrsaison-Ökonomie, der große integrative Lauf) — braucht A korrekt.
3. **B2–B4** (Sponsor / Star / Roster über Saisons) — teils aus demselben B1-Lauf ablesbar.
4. **B5** (Talent-Knappheit) — hängt an A3.
5. **C1** klären → ggf. implementieren + in B1 re-messen.

Abhaken je Modul: `[ ]` Funktion clean · `[ ]` Balancing im Band · `[ ]` Findings gefixt + validiert.

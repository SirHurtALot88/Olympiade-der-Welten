# Sponsor-Baukasten-Rework — Design-Dokument

> Status: **Entwurf, zur Implementierung freigegeben** · Stand 2026-07-21
> Vorgänger-Notiz: `docs/design/sponsor-system-v2.md` (V2.5, Sterne→Rarity-Migration bereits gelaufen)
>
> Auslöser (Spieler-Feedback):
> 1. Die drei Risiko-Profile *Sicher / Ausgewogen / Ambitioniert* sind eine Schein-Wahl → **entfernen**.
> 2. **Sonderziele** zahlen zu wenig, lohnen sich nicht.
> 3. „**Überperformance zahlt extra**" nennt keine Zahl; der Verbesserungs-Bonus fühlt sich auf jedem Sponsor gleich an.
> 4. Mehr Varianz + **modulares Baukasten-System**.
> 5. Rarity wirkt kaputt: „Magisch" ~5× in Folge / auf jeder Karte.

Alle Zahlen und Fundstellen unten wurden gegen den aktuellen Code verifiziert (inkl. empirischer Simulation des Rarity-Wurfs mit dem echten Hash aus dem Code).

---

## 1. Rarity-Bug — Diagnose

**Befund: Der Spieler hat recht. Es gibt drei zusammenwirkende Ursachen; die Hauptursache ist ein Korrelations-Bug im deterministischen Hash-Seed.**

### Ursache A (Hauptursache): Die 5 Slot-Würfe sind fast identisch — 94 % aller Slates sind komplett einfarbig

`rollSponsorOfferSlate` (`lib/sponsor/sponsor-tier-pool.ts:194-206`) würfelt die Rarity pro Slot mit

```ts
const roll = getStableUnitHash(`${seasonId}:${teamId}:sponsor-rarity:${slot}`) * weightTotal;
```

`getStableUnitHash` ist FNV-1a (`sponsor-tier-pool.ts:76-83`). Die fünf Seeds unterscheiden sich **nur im letzten Zeichen** (`:0` … `:4`). Bei FNV-1a bewirkt das: der Hash vor dem letzten Zeichen ist identisch, das letzte Zeichen ändert nur die niederwertigen Bits, danach folgt genau **eine** Multiplikation mit 16777619 — die normalisierten Werte benachbarter Slots liegen exakt `16777619 / 2^32 ≈ 0.0039` auseinander.

Empirisch nachgerechnet (Skript mit der 1:1 kopierten Hash- und Draw-Logik, Seeds `season-1..200` × 16 Team-IDs):

- Roh-Rolls eines echten Slates, z. B. `season-3:T-G`: `0.1297, 0.1336, 0.1375, 0.1414, 0.1453` — Abstand konstant 0.0039.
- **94.2 % aller Slates haben alle 5 Slots in derselben Rarity** (Erwartung bei unabhängigen Würfen: ~8 %).

Der Spieler sieht also pro Saison praktisch immer **fünf Karten in einer einzigen Rarity-Farbe**. Die Marginalverteilung pro Slot ist korrekt (siehe Ursache B), aber innerhalb einer Saison gibt es keine Varianz — „jede Karte Magisch" ist damit exakt das erwartete Symptom, sobald der Saison-Roll in den Magisch-Bereich fällt.

**Fix (klein, chirurgisch):** Seed so ändern, dass der Slot **vorne** steht und durch alle folgenden FNV-Runden avalanched:

```ts
// sponsor-tier-pool.ts:195
const roll = getStableUnitHash(`sponsor-rarity:${slot}:${seasonId}:${teamId}`) * weightTotal;
```

Verifiziert: mit Prefix-Seed sinkt die Alle-gleich-Quote von 94.2 % auf 8.0 % (= statistische Erwartung), die Marginalverteilung bleibt unverändert (58.6 % / 35.3 % / 6.1 % beim Magisch-Cap). Alternative (gleichwertig getestet): Padding + Slot vorn im Suffix; **nicht** empfohlen: `getStableUnitHash` global um einen Finalizer erweitern — das würde ALLE deterministischen Züge (Golden-Los, Bonusziel-Picker, Marken-Picker) über Saves hinweg verschieben.

Achtung, gleiche Bug-Klasse woanders: die Kurvenform-Sortierung (`sponsor-tier-pool.ts:210-214`) hängt Shape-Namen als Suffix an — die Namen unterscheiden sich stark genug, unkritisch. `resolveChallengeSlotIndex` und `pickBonusObjective` (`sponsor-special-objectives.ts:66-68, 948`) sind Einzelzüge bzw. haben nach dem Slot noch `:bonus-objective` als Suffix — unkritisch. Nur der Rarity-Loop ist betroffen.

### Ursache B: Für die obere Tabellenhälfte kollabiert das Ergebnis auf „gewöhnlich oder magisch"

`getMaxTierBucketForQualityRank` (`lib/sponsor/sponsor-team-quality-rank.ts:160-168`): qualityRank ≤ 4 → Cap legendär, ≤ 10 → selten, ≤ 18 → **magisch**, sonst gewöhnlich. Ein Mittelfeld-Team (qualityRank 11–18) zieht also aus Kandidaten `[gewöhnlich 50, magisch 30, selten(Über-Cap-Glück) 5]` (`RARITY_WEIGHT` in `sponsor-curve-shapes.ts:140-145`, `RARITY_OVERCAP_LUCK_WEIGHT = 5` in `sponsor-tier-pool.ts:40`):

| Cap (maxRarity) | gewöhnlich | magisch | selten | legendär |
|---|---|---|---|---|
| gewöhnlich (qr > 18) | 90.9 % | 9.1 % | — | — |
| **magisch (qr 11–18)** | **58.8 %** | **35.3 %** | 5.9 % | — |
| selten (qr 5–10) | 50.5 % | 30.3 % | 14.1 % | 5.1 % |
| legendär (qr ≤ 4) | 50.0 % | 30.0 % | 14.0 % | 6.0 % |

Kombiniert mit Ursache A ist eine Mittelfeld-Saison zu ~59 % ein All-Gewöhnlich- und zu ~35 % ein All-Magisch-Slate. Mehrere Saisons hintereinander „alles Magisch" sind damit völlig plausibel. Diese Verteilung ist per se Design (Cap nach Teamstärke) — aber ohne den Fix aus A wird sie als „kaputt" wahrgenommen, und selbst mit Fix A ist ein *effektiv zweistufiges* System für die halbe Liga dünn (siehe Baukasten, §3: Rarity steuert künftig auch Modul-Anzahl, nicht nur ±10 % Etat).

### Ursache C: Der Anzeige-Fallback und die Save-Migration defaulten beide auf „magisch"

- Karte: `const rarity = offer.rarity ?? "magisch"` (`components/foundation/sponsor/SponsorOfferCardNewLook.tsx:235`), ebenso `FoundationSponsorsNewLook.tsx:139, 293, 354, 709`.
- Save-Migration: `mapStarTierToRarity(readLegacyStarTier(offer))` (`lib/persistence/save-repository.ts:251, 269`) — und `mapStarTierToRarity` defaultet fehlenden Sternrang auf `t = 3` → **magisch** (`sponsor-curve-shapes.ts:182-188`).
- `ensureSeasonSponsorOffers` behält persistierte Slates derselben Saison unverändert (`sponsor-offer-service.ts:477-484`) — Angebote, die von einem älteren Build ohne `rarity` erzeugt wurden, bleiben die ganze Saison ohne Feld und rendern als Magisch.

Ein Save aus der Prä-Rarity-Zeit zeigt also **garantiert auf jeder Karte „Magisch"**. Zusätzlich inkonsistent: das Settlement fällt auf `"gewöhnlich"` zurück (`sponsor-settlement-service.ts:111`, `sponsor-economy-calibration.ts:566`) — Anzeige (magisch) ≠ Abrechnung (gewöhnlich) für Alt-Verträge.

**Fixes C:** (1) Anzeige-Fallback auf `"gewöhnlich"` vereinheitlichen (konservativ, deckungsgleich mit Settlement); (2) `mapStarTierToRarity`-Default von `t=3` auf `t=2` (→ gewöhnlich) senken oder in der Migration explizit `"gewöhnlich"` backfillen, wenn gar kein Sternrang existiert.

### Test-Absicherung

`tests/sponsor-tier-pool.test.ts` testet Determinismus, Cap+1 und Distinct-Shapes, aber **keine Intra-Slate-Varianz**. Neu: Verteilungstest über ≥ 500 (seasonId, teamId)-Paare — Anteil einfarbiger Slates < 15 %, Marginalverteilung ±5 pp an den Soll-Gewichten.

---

## 2. Entfernen der Risiko-Profile (Sicher / Ausgewogen / Ambitioniert)

### Warum die Wahl fake ist (Verifikation)

`PROFILE_COMPONENT_FACTORS` (`lib/sponsor/sponsor-negotiation.ts:33-37`): safe `{baseMult 1.05, upsideMult 0.85, penaltyMult 0.5, targetShift +2}`, balanced `{1,1,1,0}`, ambitious `{0.88, 1.25, 2.0, −1}`. Die Basis ist mit Abstand die größte Komponente (~40–48 C garantiert, gegen ~5–25 C erreichbare Rang-Upside + ~3 C Sonderziel). +5 % auf die Basis, garantiert, schlägt fast immer +25 % auf eine unsichere kleine Upside — zusätzlich halbiert safe den Malus. Nur ein sicherer Titelkandidat rechnet sich ambitious schön; für 90 % der Liga dominiert safe. Erschwerend: die Karte verkauft die Wahl als flachen Cash-Faktor („−5 % Cash" / „+8 % Cash", `SponsorOfferCardNewLook.tsx:94-96`) und `getSponsorNegotiationMultiplier` ist ohnehin als deprecated markiert (`sponsor-negotiation.ts:62-68`). → **Achse komplett streichen**, wie vom Spieler gewünscht.

### Vollständige Fundstellen-Liste (grep-verifiziert)

**Kern / Logik**
| Fundstelle | Was dort passiert | Aktion |
|---|---|---|
| `lib/sponsor/sponsor-negotiation.ts` (ganze Datei) | Profil-Faktortabelle, `applySponsorNegotiationToComponents/Offer/Contract`, `getSponsorNegotiationCashFactor`, `getSponsorProfileMultiplier`, `defaultAiSponsorNegotiation` | Datei auf `getSponsorTermMultiplier` + einen Legacy-Shim (s. u.) eindampfen |
| `lib/sponsor/sponsor-offer-service.ts:30-31, 562, 573, 613, 620` | `chooseSponsorOffer` nimmt `negotiationProfile`, default `"balanced"`, wendet es auf den Vertrag an | Parameter + `applySponsorNegotiationToContract`-Aufruf entfernen |
| `lib/sponsor/sponsor-offer-service.ts:748-765` | AI wählt Profil über `defaultAiSponsorNegotiation` | entfernen (AI-Scoring `scoreOfferForAi` bleibt) |
| `lib/sponsor/sponsor-settlement-service.ts:14, 125, 155-161` | Settlement multipliziert das Rang-Residual mit `upsideMult` und rekonstruiert die Balanced-Basis über `baseMult` | Für Neuverträge streichen (×1.0); Legacy-Pfad s. Migration |
| `lib/sponsor/sponsor-offer-service.ts:231-234` | Kommentar: Rang-Malus-Deckel „ambitious-penaltyMult ×2 on top" | Kommentar bereinigen |
| `app/api/sponsor/choose/route.ts:21, 115` | Request-Body-Feld | Feld entfernen (eingehende Alt-Requests ignorieren, nicht 400en) |
| `lib/data/olyDataTypes.ts:1249, 1285, 1346` | `SponsorNegotiationProfile`-Typ + optionale Felder auf `SponsorOffer` / `TeamSponsorContract` | Typ deprecaten; Felder **optional behalten** (Alt-Saves), nie mehr schreiben |

**UI**
| Fundstelle | Was dort passiert | Aktion |
|---|---|---|
| `components/foundation/sponsor/SponsorOfferCardNewLook.tsx:88-97, 329-352` | `NEGOTIATION_PROFILES`-Array + Dreifach-Toggle + „Cash-Faktor ×…"-Live-Zeile | Toggle-Block ersatzlos raus; „Gesamt"-Summe bleibt |
| `SponsorOfferCardNewLook.tsx:45-58, 218-230` | Props `negotiationProfile`, `multiplier`, `onNegotiationProfileChange`, `adjustedComponents` | Props entfernen; Karte rendert `offer.components` direkt |
| `app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx:288-316, 704-718` | pro Karte `applySponsorNegotiationToComponents` + `getSponsorNegotiationMultiplier` | entfernen |
| `FoundationSponsorsNewLook.tsx:176, 192` | Vertragsansicht zeigt „· Profil {…}" | Zeile entfernen (bei Alt-Vertrag optional als Legacy-Chip) |
| `app/foundation/sponsors-v2/FoundationSponsorsPanel.tsx:19-28` | Prop-Typen für die beiden Funktionen | entfernen |
| `lib/foundation/tabs/use-foundation-page-state.ts:579, 969` | `sponsorChoiceProfiles`-State | entfernen |
| `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:216, 4938-4949, 10185-10186, 10455-10456, 11218, 11278` | Import/Durchreichung + Profil in `chooseTeamSponsor`-POST | entfernen |
| `app/foundation/foundation-page-client-exports.ts:155`, `app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx:364-371, 497-504` | Re-Exports/Prop-Weiterreichung | entfernen |

**Tests**
- `tests/sponsor-v26.test.ts:10, 148-160, 192` — signiert mit `"ambitious"` und erwartet profil-adjustierte Komponenten → Test umschreiben: Signieren ohne Profil, Komponenten == Angebots-Komponenten (Identität statt Adjustierung).
- `tests/sponsor-economy-balance.test.ts:33, 683` — Profil-Ordnungstest (safe < balanced < ambitious bei Titel etc.) → ersatzlos streichen bzw. durch Modul-Invarianten ersetzen (§7).
- `tests/sponsor-event-service.test.ts:51` — Fixture-Feld `negotiationProfile: "balanced"` → Feld entfernen.

**Nebeneffekt beachten:** `applySponsorNegotiationToOffer/Contract` überschreibt heute `demandProfile` (`sponsor-negotiation.ts:151, 172`). Nach dem Entfernen ist `demandProfile` wieder rein rarity-abgeleitet (`getDemandProfileForRarity`, `sponsor-offer-service.ts:87-98`) — gewollt.

### Migrations-/Balancing-Plan

1. **Baseline = balanced.** Balanced ist die Identität (alle Faktoren 1.0, Shift 0). Entfernen heißt: alle Angebote/Verträge verhalten sich exakt wie heute mit „Ausgewogen". Kein Rebalancing nötig; die Ökonomie-Kalibrierung (`buildOfferCashAmounts`, Kurven-Leiter) ist bereits auf balanced geeicht.
2. **Was upside/penalty/targetShift ersetzt:** nichts Gleichartiges — die Risiko-Achse wandert in den Baukasten (§3): Risiko ist künftig eine Eigenschaft des *Sponsors* (Modul-Mix: viel Basis vs. viel Bonus), nicht ein Nachverhandlungs-Regler. Das ist eine echte Wahl zwischen fünf verschiedenen Karten statt einer Schein-Wahl auf jeder Karte.
3. **Alt-Verträge** (laufende Saison, `termSeasons` ist fest 1): Verträge mit gespeichertem `safe`/`ambitious` wurden beim Signieren bereits komponenten-adjustiert. Einziger noch aktiver Settle-Zeit-Effekt ist `upsideMult` auf dem Rang-Residual (`sponsor-settlement-service.ts:161`) und die `baseMult`-Rekonstruktion im Ladder-losen Legacy-Zweig (`:155-157`). → Einen minimalen Read-only-Shim `getLegacyProfileFactors(profile)` im Settlement behalten, der nur für Verträge mit gesetztem `negotiationProfile !== "balanced"` greift; eine Saison nach Release löschen.
4. `SPONSOR_RANK_MILESTONES`-Malus-Deckel (`sponsor-offer-service.ts:234`) bleibt unverändert (war balanced-relativ kalibriert).

---

## 3. Das modulare „Baukasten"-Modell (Kern des Reworks)

### Problem heute

Jeder Sponsor ist dasselbe 4+2-Template: `buildOffer` (`sponsor-offer-service.ts:217-252`) baut IMMER `base` + `rank` + `improvement` + `special` + (fast immer) `fan_infrastructure` + (meist) `beat_expected_rank`. Unterschiede sind nur Skalare (Kurvenform verteilt die Rang-Leiter, Rarity ±10 % Etat). Ergebnis: „jeder Sponsor gibt irgendwie dasselbe Extra" — exakt die Spieler-Beschwerde. Der Verbesserungs-Bonus ist wörtlich auf jedem Sponsor dieselbe Formel `totalAtMaxRank * 0.04` (`sponsor-offer-service.ts:155`).

### Zielbild

Ein Sponsor = **Marke/Flavor** (bleibt: `sponsor-brand-catalog.ts` / `-parents` / `-variants`) + **Kurvenform-Familie** (bleibt: die 11 Shapes aus `sponsor-curve-shapes.ts` als „Persönlichkeit") + **2–5 Module aus einem Katalog**. Nicht jeder Sponsor hat jede Säule; welche Module er hat und wie groß sie sind, IST die Differenzierung.

### Modul-Typen (TypeScript-Shape, Design-Level)

```ts
// lib/sponsor/sponsor-modules.ts (neu)
export type SponsorModuleKind =
  | "base_income"        // garantierter Sockel (Pflichtmodul, Größe variiert S/M/L/XL)
  | "rank_ladder"        // Gewinnstufen über die Kurvenform (heutige rank-Komponente)
  | "overperformance"    // expliziter €/Platz-über-Erwartung-Bonus (NEU, §5)
  | "improvement"        // Tabellenziel: €/verbesserten Platz statt Binärziel (§5)
  | "special_objective"  // Sonderziel aus dem 14+6-Katalog (sponsor-special-objectives.ts)
  | "clause"             // Malus-/Bedingungsklausel (z. B. Abstiegs-Malus, Gehaltsdeckel) — kauft Budget frei
  | "perk";              // Nicht-Cash-Flavor (Spotlight-Boost, Beliebtheits-Impuls, Fan-Shop-Rabatt)

export type SponsorModuleDef = {
  id: string;                              // z. B. "overperf-steep", "base-xl"
  kind: SponsorModuleKind;
  labelDe: string;
  /** Familien, zu denen das Modul passt (steuert Auswahl-Gewichte). */
  families: SponsorCurveFamily[] | "all";
  minRarity: SponsorRarity;                // z. B. overperf-steep erst ab "selten"
  /** Anteil am Erwartungs-Budget des Angebots, den das Modul bindet (EV-Buchhaltung, s. u.). */
  evShare: { min: number; max: number };
  /** Baut die konkrete(n) SponsorOfferComponent(s) aus dem Kontext. */
  build(ctx: SponsorModuleBuildContext): SponsorOfferComponent[];
};

export type SponsorModuleBuildContext = {
  gameState: GameState; team: Team;
  rarity: SponsorRarity; curveShape: SponsorCurveShape;
  expectedRank: number | null;             // teamQualityRank
  anchors: SponsorEconomyAnchors;          // effectiveBaseFloor etc. (sponsor-economy-calibration.ts:255)
  evBudget: number;                        // Erwartungs-Budget dieses Angebots (s. u.)
  attainProbability(kind, params): number; // kalibrierte Erreichens-Wahrscheinlichkeiten (aus Sim-Daten)
  seedHash(salt: string): number;          // getStableUnitHash-Wrapper, Slot-präfixiert (§1-Fix!)
};

export function composeSponsorOffer(input: {
  ctx: SponsorModuleBuildContext;
  slotIndex: number;
  moduleCatalog: SponsorModuleDef[];
}): SponsorOffer;
```

`SponsorOffer.components` bleibt das Persistenz-/Settlement-Format (kein Save-Bruch); neu ist nur `SponsorOffer.moduleIds: string[]` für Anzeige/Debug. `SponsorOfferComponent` bekommt zwei neue `kind`-Werte: `"overperformance"` (§5) und behält `"improvement"`; der `clause`-Ausgang ist eine Komponente mit `rewardCash: 0` + `penaltyCash`.

### Budget-Invariante (das Herzstück der Balance)

Jedes Angebot hat ein **Erwartungs-Budget**: `evBudget = E[Payout am expectedRank]` aus der heutigen Kurven-Kalibrierung, d. h. `getSponsorCurveShapePayout(expectedRank, …)` (`sponsor-economy-calibration.ts:417-443`) — gehaltsgeankert, rarity-skaliert (etatFactor 0.90–1.15), quality-rebalanced. **Module verteilen dieses Budget um, sie erhöhen es nicht.** Ein Bonus-Modul mit Erreichens-Wahrscheinlichkeit p und Reward R bindet `p × R` Budget, plus eine **Risikoprämie** von 1.25: Wer Geld hinter ein Ziel legt, bekommt 25 % EV-Aufschlag als Kompensation fürs Risiko (das macht Bonus-lastige Sponsoren attraktiv, ohne safe-Dominanz wie bei den alten Profilen — der Sockelverlust ist real). `clause`-Module haben negativen EV-Share und kaufen Budget frei (höhere Basis im Tausch gegen echten Malus).

### Rarity → Modul-Anzahl & -Qualität (macht Rarity endlich fühlbar)

| Rarity | Module gesamt | davon Bonus-Module | Beispiel-Silhouette |
|---|---|---|---|
| gewöhnlich | 2 | 1 | Basis L + (Rang-Leiter S ODER 1 Sonderziel) |
| magisch | 3 | 2 | Basis M + Rang-Leiter M + 1 Sonderziel |
| selten | 4 | 3 | Basis M + Rang-Leiter M + Overperf ODER Improvement + Sonderziel |
| legendär | 5 | 3–4 + Perk | Basis S–M + Rang-Leiter L + Overperf + Sonderziel + Perk |

Heute unterscheidet Rarity nur ±10 % Etat und ±0.28 Milestone-Mult — nach §1-Fix sieht der Spieler zwar wieder Farbvielfalt, aber erst die Modul-Staffel macht „Legendär" zu einem sichtbar reicheren Vertrag. Der etatFactor (0.90/1.0/1.07/1.15, `sponsor-curve-shapes.ts:147-152`) bleibt als Budget-Dial bestehen.

### Kurvenform-Familie → Modul-Gewichte

- `titel`/`europa` (→ heutige „performance"): hohe Gewichte auf `rank_ladder` steil + `overperformance`; Basis klein.
- `stetig`/`aufstieg` (→ „identity"): Gewichte auf `improvement` + identitäts-Sonderziele (Fan/Rivale/Eigengewächs).
- `sicherheit` (→ „security"): Basis XL, `clause`-Module, security-Sonderziele (Solvenz/Gehalt); **kein** Overperf-Modul (§5).

Die Sonderziel-Archetyp-Buckets (`SPONSOR_BONUS_OBJECTIVE_ARCHETYPE`, `sponsor-special-objectives.ts:515-530`) bleiben 1:1 nutzbar (`mapCurveShapeToArchetype`). Golden bleibt orthogonal: ersetzt das Sonderziel-Modul durch ein Golden-Ziel und boostet die Rang-Leiter gedeckelt wie heute (`getGoldenMilestoneBonus`, `sponsor-economy-calibration.ts:350-357`).

### Vier Beispiel-Sponsoren (beweist die Varianz)

Referenz-Zahlen: effectiveBaseFloor ≈ 40, expectedRank 14, evBudget ≈ 55 (magisch, Mittelfeld).

1. **„Granitwerk Nord" — gewöhnlich · Klassenerhalt (sicherheit)**
   `base-xl` (52 C garantiert) + `clause-relegation` (Malus −6 C bei Platz ≥ 29). Keine Rang-Leiter, kein Sonderziel. Karte: „Zahlt fast alles sofort — will nur nicht mit dir absteigen."
2. **„Nova Energy" — selten · Titeljäger (titel)**
   `base-s` (34 C) + `rank-ladder-steil` (bis +26 C bei Meister) + `overperf-steep` (**+1.8 C pro Platz über Erwartungsrang #14, max +14 C** — explizite Zahl auf der Karte, §5) + Sonderziel `momentum_series` (12 C, staged 40/70/100 %).
3. **„Heimathafen Brauerei" — magisch · Aufsteiger (aufstieg)**
   `base-m` (42 C) + `improvement-perplace` (**+1.5 C pro verbessertem Platz ggü. Startrang, max 6 Plätze = +9 C**) + Sonderziel `fan_infrastructure` (8 C, skaliert mit Income-Gebäudestufe wie heute).
4. **„Aurum Interstellar" — legendär · Meisterschale (titel), Golden**
   `base-m` (45 C) + `rank-ladder-l` (bis +30 C) + `overperf-steep` (+2.2 C/Platz, max +16 C) + Golden-Ziel `golden_title_shock` (18 C, staged) + Perk „Spotlight ×2" (Beliebtheits-Impuls verdoppelt).

Vier Karten, vier fühlbar verschiedene Verträge — statt fünfmal dieselben vier Kacheln mit anderen Zahlen.

### Was das Kompositions-Verfahren ersetzt

`buildOffer` (`sponsor-offer-service.ts:100-274`) wird zu: Slate-Wurf (rarity + shape, wie heute) → `composeSponsorOffer` wählt Module deterministisch (seed-präfixiert!, ≥ 1 Basis, Familien-Gewichte, EV-Budget-Abrechnung) → Marken-Pick unverändert. Settlement (`sponsor-settlement-service.ts:69-227`) behandelt Komponenten bereits generisch pro `kind` — es kommen nur zwei neue `kind`-Zweige hinzu (`overperformance`, per-Platz-`improvement`); die gelockte Rang-Leiter (`lockedRankPayoutLadder`, `chooseSponsorOffer` `sponsor-offer-service.ts:584-594`) bleibt der Mechanismus für die Rang-Leiter.

---

## 4. Sonderziele-Buff

### Ist-Zustand (zitierte Formeln)

- `specialCash`-Basis: `cashAmounts.specialCash = totalAtMaxRank * 0.04` (`sponsor-economy-calibration.ts:541`), mit totalAtMaxRank ≈ 75–90 C also **≈ 3.0–3.6 C**.
- Standard-Angebot: `max(specialCash*0.65, specialCash*0.35)` → **≈ 2.0–2.4 C** (`sponsor-offer-service.ts:157-159`), dann Floor `min(Gebäude-Unterhalt*0.5, 6) * salaryFactor` (`:164-166`) → real **2.5–6 C**.
- Staged-Ziele zahlen davon anteilig 40/70/100 % (`threeStage`, `sponsor-special-objectives.ts:503-509`; Settlement `sponsor-settlement-service.ts:200-223`).

Gegen eine garantierte Basis von 40–52 C ist ein voll erfülltes Sonderziel **5–12 % der Basis** — zu wenig, um dafür die Saison zu steuern. Diagnose bestätigt.

### Soll-Zustand

Sonderziel-Reward wird rarity-gestaffelt und deutlich angehoben:

```
specialCash = totalAtMaxRank × (0.06 + 0.03 × rarityOrder)   // Order 0..3, sponsor-curve-shapes.ts:147-152
```

| Rarity | Anteil | typischer Reward (totalAtMaxRank ≈ 85) | heute |
|---|---|---|---|
| gewöhnlich | 6 % | ≈ 5 C | 2.5–3 C |
| magisch | 9 % | ≈ 8 C | ~3 C |
| selten | 12 % | ≈ 10 C | ~3.5 C |
| legendär | 15 % | ≈ 13 C | ~4 C |

- Golden-Ziele ×1.25 obendrauf (ersetzt weiterhin das Standard-Special, `sponsor-offer-service.ts:205-209`).
- Der Gebäude-Unterhalts-Floor (`upkeepSpecialFloor`, `:164-166`) bleibt als Untergrenze bestehen.
- Challenge-Slot: `max(specialCash, totalAtMaxRank * 0.08)` statt `0.05` (`:158`), Malus-Formel unverändert.

**Balance-Ratio (Invariante):** volles Sonderziel ≤ 30 % der Basis-Komponente; Erwartungswert (Sim-Erfüllungsquote × Reward, Quote heute laut Staging ~40–60 %) ≈ 5–9 % des Saison-Gesamtpayouts. Gegenfinanzierung im Baukasten automatisch über das EV-Budget (§3); bis der Baukasten live ist (Phase 3), Übergangs-Gegenmaßnahme: `SPONSOR_MILESTONE_LADDER_SCALE` 0.82 → 0.79 ODER Basis −2 %, final per `scripts/sponsor-economy-dryrun.ts` gegen das 38–44-Survival-Band (Kommentar `sponsor-economy-calibration.ts:30-36`) kalibrieren. AI-Gewichtung `estimateExpectedPayout` bewertet Specials mit Faktor 0.12 (`sponsor-economy-calibration.ts:605`) → auf 0.4–0.5 anheben, sonst ignoriert die AI die gebufften Ziele.

---

## 5. Überperformance & Verbesserung: explizit und differenziert

### Befund: „Überperformance zahlt extra" ist auf Neuverträgen faktisch eine Falschaussage

1. Der Feed-2-Bonus (`SPONSOR_OVERPERFORMANCE_SHARE = 0.6`, `sponsor-economy-calibration.ts:337`) lebt NUR in `getSponsorPayoutForFinalRankAndTier` (`:394-403`) und zahlt nur bei `archetype === "performance"` **und** gesetztem `expectedRank`.
2. Neuverträge werden aber über die **beim Signieren gelockte Leiter** abgerechnet (`lockedRankPayoutLadder`, Settlement `sponsor-settlement-service.ts:120-130`), und die Leiter wird aus `getSponsorCurveShapePayout` gebaut (`buildLockedRankPayoutLadder`, `sponsor-economy-calibration.ts:453-476`) — **dort existiert kein Überperformance-Term**. Der 0.6-Share greift nur noch im Ladder-losen Altsave-Fallback (`sponsor-settlement-service.ts:137-151`).
3. Die Karte rendert den Hinweis trotzdem für jeden titel-Familie-Sponsor (`SponsorOfferCardNewLook.tsx:414-426`) — ohne Zahl, und der beschriebene Bonus wird nie ausgezahlt. Das einzige, was tatsächlich zahlt, ist das binäre `beat_expected_rank`-Special über **3 × salaryFactor C** (`overachieveReward`, `sponsor-offer-service.ts:173-178`, Margin 3).
4. Verbesserungs-Bonus: identische Formel auf jedem Sponsor — `improvementCash = totalAtMaxRank * 0.04` ≈ 3–3.6 C, Ziel `improvementBase + (selten/legendär ? 1 : 0)` (`sponsor-offer-service.ts:125-126, 155`). „Fühlt sich überall gleich an" ist damit wörtlich wahr.

### Soll-Zustand: eigenes, sichtbares Modul mit Familien-Rate

Neue Komponente `kind: "overperformance"` (ersetzt Feed-2-Implizit-Bonus UND `beat_expected_rank`-Special):

```
payout = min(capC, ratePerRankC × max(0, expectedRankAtSign − finalRank))
```

- `expectedRankAtSign` = eingefrorener `teamQualityRank` (wie heute `teamQualityRankAtSign`, `sponsor-offer-service.ts:615`).
- **Familien-Differenzierung** (Default-Raten, ENV-tunebar, × salaryFactor):

| Familie | ratePerRankC | capC | Gegengewicht |
|---|---|---|---|
| titel | 1.8 | 14 | kleinste Basis (base-s) |
| europa | 1.2 | 10 | — |
| stetig | 0.8 | 6 | — |
| aufstieg | 0.6 | 5 | dafür Improvement-Modul (s. u.) |
| sicherheit | **0 (kein Modul)** | — | dafür Basis XL |

- Rarity skaliert die Rate ×(1 + 0.1 × order). Monotonie bleibt gewahrt: der Bonus wächst streng mit besserem Endrang, addiert auf die monotone Rang-Leiter → kein Tanking-Anreiz (dieselbe Invariante wie im Feed-2-Kommentar `sponsor-economy-calibration.ts:386-393`).
- **Lock beim Signieren:** Rate, Cap und expectedRank werden in der Komponente eingefroren (targetValue = expectedRank, zwei neue Felder oder Encoding wie bei `title_shock:<rank>`), Settlement rechnet nur `min(cap, rate × Δ)` — Anzeige == Settlement per Konstruktion.

**Improvement wird per-Platz statt binär** (fühlbar verschieden statt identisch): `+X C pro Platz besser als Startrang, max M Plätze`; X und M variieren pro Sponsor (aufstieg-Familie X hoch, titel-Familie Modul oft gar nicht vorhanden). Ersetzt `improvement`-Binärlogik im Settlement (`sponsor-settlement-service.ts:181-198`) durch `min(M, max(0, startRank − finalRank)) × X`.

### Karten-Text (ersetzt die vage Zeile)

> **Überperformance:** +1.8 C pro Platz über Erwartung (#14) · max +14 C
> ~~Überperformance zahlt extra.~~

Sponsoren ohne Modul zeigen die Zeile **gar nicht** — Abwesenheit ist jetzt ehrlich statt generisch versprochen.

---

## 6. Karten-/UI-Auswirkungen (`SponsorOfferCardNewLook.tsx`)

1. **Raus:** Dreifach-Toggle + „Cash-Faktor ×…" (`:88-97, 329-352`); Props `negotiationProfile/multiplier/onNegotiationProfileChange/adjustedComponents` (§2). Frei werdender Platz → Modul-Liste.
2. **Rein: Modul-Zeilen statt fixer 4-Kachel-Matrix.** Die Karte rendert `offer.components` generisch pro `kind` (tut sie fast schon, `:354-461`); neue Kachel-Typen `overperformance` (Zeile mit Rate/Cap/Erwartungsrang, s. §5-Text) und per-Platz-`improvement` („+1.5 C je Platz, max 6"). Sponsoren mit 2 Modulen zeigen 2 Kacheln — unterschiedliche Kartenlängen sind gewollt (Varianz sichtbar machen).
3. **Overperf-Hint** (`:411-426`) ersetzen durch die Zahl aus der Komponente; Bedingung nicht mehr `archetype === "performance"`, sondern „Komponente vorhanden".
4. **Rarity:** `?? "magisch"` → `?? "gewöhnlich"` (`:235`, plus die vier Stellen in `FoundationSponsorsNewLook.tsx`, §1C). RarityPill unverändert; nach §1-Fix zeigt ein Slate wieder echte Farb-Mischung. Optional: kleines „Module: 3/5"-Chip neben der Pill als Rarity-Wertigkeits-Signal.
5. Sonderziel-Kachel: unverändert (StageLadder `:182-216` passt), nur größere Beträge; Presenter-Fallbacks (`sponsor-offer-presenter.ts:93-115`) decken den Katalog bereits ab. Veraltetes 5-stufiges `SPONSOR_RARITY_LABELS` (`sponsor-offer-presenter.ts:295-305`) bei der Gelegenheit entsorgen (nutzt noch das alte 1–5-Schema inkl. falschem „Episch").

---

## 7. Balancing & Tests

**Sim-Skripte (müssen nach jeder Phase laufen):**
- `scripts/sponsor-economy-dryrun.ts` — Bänder-Check: Rang-32-Boden im Survival-Band 38–44, Spitze 85–95 (Kommentare `sponsor-economy-calibration.ts:30-36, 294-299`); Fallback `rarity ?? "magisch"` in Zeile 214 auf `"gewöhnlich"` angleichen.
- `scripts/sponsor-5year-sim.ts` — Top5/Bottom5-Schere < 2× über 5 Saisons; neu zusätzlich ausweisen: Rarity-Verteilung pro Saison (validiert §1-Fix), Sonderziel-Erfüllungsquote und -EV-Anteil, Overperf-Auszahlungssumme pro Familie.

**Invarianten (nicht verhandelbar):**
1. **Anzeige == Settlement** — Kartenbeträge sind exakt die gelockten/abgerechneten Beträge (Leitmotiv des ganzen Moduls, vgl. `sponsor-offer-service.ts:63-67, 390-399`). Neue Module müssen ihre Parameter beim Signieren einfrieren.
2. **Monotonie / kein Tanking:** Gesamt-Payout streng nicht-fallend in besserem Endrang (Kurven-Shapes sind monoton, `sponsor-curve-shapes.ts:18-20`; Overperf-Modul ist additiv-monoton).
3. **Gehalts-Anker dominiert:** alles skaliert über `effectiveBaseFloor` (`resolveSponsorEconomyAnchors`, `sponsor-economy-calibration.ts:255-273`); kein Modul zahlt absolute, anker-freie Beträge (Ausnahme: bestehender flat `SPONSOR_BUILDING_COST_OFFSET_C`).
4. **EV-Budget:** Σ (p × Reward) aller Module ≈ Kurven-EV × (1 + Risikoprämien-Anteil); liga-weite Gesamtausschüttung ±5 % zur heutigen Baseline (Dryrun-Vergleich vorher/nachher).
5. Slate-Regeln: 5 distinct Shapes, ≤ 2/Familie, Rarity ≤ Cap+1, max. 1 Golden (bestehende Tests `tests/sponsor-tier-pool.test.ts`).

**Test-Änderungen:**
- `sponsor-tier-pool.test.ts`: + Intra-Slate-Varianz-Test (§1), bestehende Determinismus-Tests bekommen durch den Seed-Fix neue erwartete Slates (Snapshot-Update).
- `sponsor-v26.test.ts`, `sponsor-economy-balance.test.ts:683`, `sponsor-event-service.test.ts:51`: Profil-Entfernung (§2).
- `sponsor-settlement-service.test.ts`: + Fälle `overperformance`-Komponente (unter/über Erwartung, Cap) und per-Platz-Improvement; Legacy-Vertrag mit `"ambitious"` settelt weiterhin über den Shim.
- `sponsor-offer-service.test.ts` / `sponsor-offer-ui-contract.test.ts`: Komponentenzahl ist nicht mehr fix 5–6 → gegen Modul-Regeln testen (≥ 1 base, Rarity→Modulanzahl-Tabelle §3).
- Neu `sponsor-modules.test.ts`: EV-Budget-Invariante, `minRarity`-Gates, Familien-Gewichte, Determinismus der Komposition.

---

## 8. Phasenplan (jede Phase einzeln shipbar)

**Phase 0 — Rarity-Fix (Quick Win, ~1 Tag)**
Seed-Präfix-Fix in `rollSponsorOfferSlate` (§1A); Anzeige-Fallbacks magisch→gewöhnlich (§1C); `mapStarTierToRarity`-Default; Varianz-Test. Sichtbarer Effekt sofort: bunte Slates.

**Phase 1 — Risiko-Profile entfernen (Quick Win, 1–2 Tage)**
Alle Fundstellen aus §2, Settlement-Shim für Alt-Verträge, Tests umbauen. Ökonomie unverändert (balanced-Identität).

**Phase 2 — Sonderziel-Buff + ehrliche Overperf-Zeile (klein)**
Neue `specialCash`-Formel (§4) + AI-Gewicht 0.12→0.45; Karten-Hint nur noch rendern, wenn er zahlt — Übergangsweise heißt das: Hint an `beat_expected_rank`-Komponente koppeln und deren Reward beziffern („+3 C bei Platz ≤ #11"). Dryrun-Rekalibrierung (Ladder-Scale/Basis-Trim).

**Phase 3 — Overperformance-/Improvement-Module (mittel)**
Neue Komponenten-Kinds + Settlement-Zweige + Lock-beim-Signieren + Kartenkacheln (§5, §6.2-3); `beat_expected_rank` und Feed-2-Restpfad ablösen. Familien-Raten per Dryrun kalibrieren.

**Phase 4 — Baukasten-Komposition (groß)**
`sponsor-modules.ts` + `composeSponsorOffer` ersetzt den fixen Block in `buildOffer`; Rarity→Modulanzahl; clause/perk-Module; 5-Jahres-Sim-Abnahme gegen alle §7-Invarianten. Marken-/Flavor-Schicht und Slate-Roller bleiben unangetastet.

**Phase 5 — Feinschliff**
Perk-Effekte (Spotlight ×2 etc.), Modul-Chip-UI, Entfernen des Settlement-Shims aus Phase 1, Doku-Update `sponsor-system-v2.md` → verweist hierher.

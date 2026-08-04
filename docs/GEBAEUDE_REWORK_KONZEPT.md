# Gebäude-Rework: Analytics Room und Specialist Wing

Stand: 2026-08-04 · Anlass: Bug-Report `vcnv6r` von Chris, Seite „Team · Gebäude":
„Analytics Room + Specialist Wing brauchen einen richtigen Purpose so dass es sich auch lohnt die zu
bauen! bitte fable mal ein rework machen lassen was zu unseren mechaniken passt"

Dieses Dokument ist ein Konzept. Es ändert keinen Code und keine Balance-Zahl. Es misst zuerst, was
die beiden Gebäude heute tatsächlich tun, vergleicht sie mit den sechs Gebäuden, die sich lohnen, und
schlägt dann Umbauten vor, die ausschließlich vorhandene Mechaniken benutzen. Jeder Vorschlag hat
einen eigenen Abschnitt „Was dagegen spricht"; am Ende steht, welche Vorschläge in bestehende
Spielstände eingreifen.

---

## 1. Kurzfassung des Befundes

Der Bug-Report vermutet, die beiden Gebäude seien zu schwach. Die Messung zeigt etwas anderes und
Schlimmeres: **beide Gebäude haben ihren im Katalog beschriebenen Effekt gar nicht.**

Der **Analytics Room** verkauft „Forecast Quality" (`facility-catalog.ts:119-131`). Es gibt im ganzen
Repository keine Stelle, an der ein Analytics-Level eine Prognosezahl, eine Streuung oder eine
Sichtbarkeit verändert. Der Effekt wird an genau zwei Stellen gelesen — und beide erzeugen nur einen
Text: ein Label für einen UI-Chip (`use-foundation-cross-tab-training.ts:480`) und einen
Audit-String in einer Vorschau, die im Spiel nicht aufgerufen wird
(`season-end-progression-preview.ts:710`). Der reale Nutzen des Gebäudes besteht heute ausschließlich
aus zwei Team-Powers, die bei Level 2 und Level 4 freigeschaltet werden
(`team-powers.ts:294-297`). Die Level 1, 3 und 5 kosten Geld und tun nichts.

Der **Specialist Wing** verkauft „Reduziert nur Upgrade-Kosten der aktiven Spezialisten-Variante"
(`facility-catalog.ts:200`). Dieser Rabatt läuft ins Leere: er wirkt nur auf das
XP-Upgrade-Kostensystem (`facility-effects.ts:252-272`), und dieses System ist abgeschafft — der
einzige Aufrufer, `getSeasonEndUpgradeCost` (`season-end-progression-preview.ts:245`), hängt an
`buildSeasonEndProgressionPreview` (`season-end-progression-preview.ts:515`), das nur noch aus
`scripts/` und `tests/` aufgerufen wird, nie aus `app/` oder `lib/foundation/`. Damit ist auch die
Variantenwahl (Power Gym / Agility Track / Mind Lab / Social Studio) folgenlos: die Variante wird
ausschließlich in diesem toten Pfad gelesen (`facility-effects.ts:227-229`), und sie ist nach dem Bau
unwiderruflich (`facility-upgrade-service.ts:244-245`). Der Spieler trifft eine endgültige
Entscheidung, die nichts bewirkt.

Was der Specialist Wing stattdessen *wirklich* tut, steht nirgends in seiner Beschreibung: er senkt
den Saison-Unterhalt **aller** Gebäude um 3–12 % (`facility-effects.ts:232-250`, real angewandt in
`facility-season-end-service.ts:110`). Und dieser versteckte Effekt ist rechnerisch nutzlos bis
schädlich — siehe Abschnitt 2.3: er ist nicht monoton, Level 4 und 5 sind schlechter als Level 3, und
selbst im theoretischen Bestfall amortisiert sich ein Level-5-Flügel nach über tausend Saisons.

Kurz: Der Analytics Room ist ein Gebäude ohne Effekt. Der Specialist Wing ist ein Gebäude, dessen
beworbener Effekt tot ist und dessen tatsächlicher, unbeworbener Effekt negativ rechnet.

---

## 2. Messung: was die beiden Gebäude heute tun

### 2.1 Analytics Room

**Definition** (`lib/facilities/facility-catalog.ts:118-132`):

| Level | Beschreibung im Katalog | Baukosten | Unterhalt/Saison | Zahlenfeld |
|---|---|---|---|---|
| 1 | „einfache Forecasts" | 5 | 0.5 | — |
| 2 | „bessere XP-Prognose" | 10 | 0.9 | — |
| 3 | „bessere Slot-Fit-Prognose" | 17 | 1.5 | — |
| 4 | „bessere Salary-/MW-Warnings" | 27 | 2.4 | — |
| 5 | „sehr genaue Season-Forecasts" | 42 | 3.6 | — |

Die Spalte „Zahlenfeld" ist der erste Befund. Jede andere Facility trägt entweder `modifierPct`,
`discountPct` oder `seasonIncome` in ihren Leveln. Der Analytics Room trägt **nichts** — er hat als
einziges Gebäude neben dem Scouting Office reine Textstufen. Beim Scouting Office ist das in Ordnung,
weil die Zahlen dort in einer eigenen Leiter liegen
(`player-potential-service.ts:121-147`, `facility-scout-pipeline-service.ts:22-29`). Für den
Analytics Room existiert keine solche Leiter.

**Wo der Effekt gelesen wird.** Die einzige Auswertefunktion ist `getAnalyticsForecastQuality`
(`facility-effects.ts:282-288`). Sie gibt `{ level, label }` zurück — das Label ist wörtlich der
Katalogtext von oben. Aufrufer:

1. `lib/foundation/tabs/use-foundation-cross-tab-training.ts:480` — schreibt das Label in das
   Trainings-Panel und setzt bei Level > 0 den Warnstring
   `"forecast_uncertainty_reduced_no_fake_values"` (`:490`). Keine Zahl im Panel ändert sich dadurch.
2. `lib/training/season-end-progression-preview.ts:710` — hängt bei Level > 0 den String
   `"analytics_room_forecast_accuracy_visible:no_fake_values"` an eine `appliedEffects`-Liste. Diese
   Vorschau wird im Spiel nicht gebaut (Aufrufer nur `scripts/export-performance-audit.ts:1119`,
   `scripts/season-transition-s1-s2-run.ts:147`, `scripts/perf-regression-smoke.ts:127` und Tests).

**Gegenprobe an der Prognose-Pipeline.** Weder `lib/training/player-progression-forecast.ts` noch
`lib/training/training-forecast-display.ts` noch `lib/foundation/training-player-row-view.ts`
enthalten das Wort „analytics". Die reale Saison-Progression
(`lib/training/organic-season-progression.ts`) liest genau zwei Gebäude: `training_center`
(`:365-379`, `:584-588`) und `academy` (`:962`). Der Analytics Room kommt dort nicht vor. Es gibt in
der Prognose-Pipeline überhaupt keinen Unsicherheits- oder Konfidenzbegriff, an den ein
„Forecast Quality"-Effekt andocken könnte.

**Der einzige reale Effekt.** `lib/lineups/team-powers.ts:294-297` definiert zwei Team-Powers für den
Analytics Room:

- ab Level 2: „Forecast Edge", Kategorie `mental`, `self_boost`, Modifier +4
- ab Level 4: „Perfect Read", Kategorie `mental`, `field_debuff` auf bis zu 3 Gegner, Modifier +6

Diese werden in `buildFacilityPowers` (`team-powers.ts:446-484`) real erzeugt, mit je 2 Ladungen
(`FACILITY_POWER_CHARGES = 2`, `team-powers.ts:45`). Das ist echter Spieltags-Nutzen — aber er hängt
an den Schwellen 2 und 4, nicht am Gebäude-Thema. Die kumulierten Baukosten bis Level 2 betragen
15 Cash, bis Level 4 59 Cash. **Level 1, 3 und 5 sind reine Kosten ohne Gegenwert** — Level 5 kostet
42 Cash zusätzlich und 1,2 Cash mehr Unterhalt pro Saison für exakt null zusätzliche Wirkung.

**Bewertung im Rest des Systems.** Die KI bewertet den Analytics Room wortwörtlich wie das Scouting
Office — dieselbe Score-Zeile, dieselbe Begründung („Kaderlücken und Vertragswellen erhöhen den
Informationswert", `ai-team-management-preview-service.ts:831-836`). Die KI kauft also ein Gebäude,
weil sie glaubt, es liefere Informationen wie ein Scouting Office. Es liefert keine.

### 2.2 Specialist Wing

**Definition** (`lib/facilities/facility-catalog.ts:197-211`):

| Level | Beschreibung | Baukosten | Unterhalt/Saison | `discountPct` |
|---|---|---|---|---|
| 1 | „passende Upgrades -3%" | 6 | 0.6 | 3 |
| 2 | „passende Upgrades -5%" | 12 | 1.1 | 5 |
| 3 | „passende Upgrades -7%" | 20 | 1.8 | 7 |
| 4 | „passende Upgrades -9%" | 32 | 2.8 | 9 |
| 5 | „passende Upgrades -12%" | 50 | 4.2 | 12 |

**Effekt 1 — der beworbene, tote.** `getSpecialistDiscountPct` (`facility-effects.ts:224-230`) prüft,
ob das zu steigernde Attribut zur aktiven Variante gehört
(`SPECIALIST_WING_VARIANTS`, `facility-catalog.ts:45-65`), und liefert den Rabatt. Verwendet wird das
nur in `applyUpgradeCostFacilityModifiers` (`facility-effects.ts:252-272`). Deren einziger Aufrufer
außerhalb der Tests ist `getSeasonEndUpgradeCost` (`season-end-progression-preview.ts:245-267`), das
wiederum nur aus `buildSeasonEndProgressionPreview` (`:638`) stammt. Dieses Modul wird vom Spiel nicht
mehr aufgerufen. Der Katalog sagt das für die Academy sogar ausdrücklich selbst
(`facility-catalog.ts:183-188`): „Der alte Upgrade-Kosten-Rabatt (`discountPct`) war tot — das
XP-Kostensystem ist abgeschafft, der reale Season-End-Apply läuft über die organische Progression zu
Kosten 0." Für die Academy wurde daraufhin ein neuer, realer Effekt gebaut
(`getAcademyDevelopmentBoostPct`, `facility-effects.ts:206-216`, angewandt in
`organic-season-progression.ts:962` und `:1014-1022`). **Für den Specialist Wing wurde derselbe
Schritt nie gemacht.** Der Specialist Wing ist der Rest der Academy-Reparatur, den niemand aufgeräumt
hat.

**Folge: die Variantenwahl ist Dekoration.** Vier Varianten mit klaren Attributgruppen — Power Gym
(power/health/stamina/torment), Agility Track (speed/dexterity/awareness), Mind Lab
(intelligence/will/determination), Social Studio (charisma/spirit/awareness) — werden beim Bau
abgefragt (`facility-upgrade-service.ts:241-242`, UI in `facility-ui-shared.tsx:209-225`) und sind
danach unwiderruflich (`facility-upgrade-service.ts:244-245`, Fehlertext in
`cockpit-ui-helpers.ts:95`). Gelesen wird die Variante ausschließlich in der toten Rabattfunktion.
Auch die Team-Powers des Flügels ignorieren sie: beide sind Kategorie `flex`, `self_boost`, ohne
jeden Variantenbezug (`team-powers.ts:310-313`). Die KI wählt deshalb konsequenterweise immer
`"mind_lab"` als Platzhalter (`ai-manager-apply-service.ts:247`, `:323`, `:703-709`) — im Code steht
das als Konstante, nicht als Entscheidung.

**Effekt 2 — der reale, unbeworbene.** `getSpecialistWingUpkeepDiscountPct`
(`facility-effects.ts:232-236`) liefert denselben `discountPct`, aber **ohne** Variantenprüfung. Er
wird in `calculateFacilitySeasonUpkeep` (`facility-effects.ts:238-250`) auf den Unterhalt **jedes**
Gebäudes angewandt und wirkt am Saisonende real aufs Cash (`facility-season-end-service.ts:110`) sowie
in der Portfolio-Anzeige (`FacilitiesV2NewLook.tsx:669-676`). Das ist der einzige Zahleneffekt, den
der Flügel heute hat — und er steht in keiner Beschreibung, in keinem Chip-Label
(`FacilitiesV2NewLook.tsx:281` sagt „Specialist-Attribut-Rabatt") und in keinem Levelt-Text.

**Effekt 3 — Team-Powers.** Wie beim Analytics Room: ab Level 2 „Specialist Package" (+4), ab Level 4
„Specialist Breakthrough" (+6), beide `flex`/`self_boost` (`team-powers.ts:310-313`). Auch hier sind
Level 1, 3 und 5 wirkungslose Zwischenstufen.

### 2.3 Die Rechnung zum Unterhaltsrabatt

Sei `U` der Basis-Unterhalt aller übrigen Gebäude, `u` der Eigenunterhalt des Flügels und `d` sein
Rabattsatz. Der Portfolio-Unterhalt mit Flügel ist `(U + u) · (1 − d)`, ohne Flügel schlicht `U`. Der
Flügel spart also `U·d − u·(1−d)` — er zahlt seinen eigenen Unterhalt aus dem Rabatt, den er auf sich
selbst gewährt, mit.

Bestfall, alle sieben anderen Gebäude auf Level 5 (`U = 31,70`, das theoretische Maximum):

| Flügel-Level | Portfolio-Unterhalt | Ersparnis/Saison | kum. Baukosten | Amortisation |
|---|---|---|---|---|
| 0 | 31.700 | — | 0 | — |
| 1 | 31.331 | 0.369 | 6 | 16 Saisons |
| 2 | 31.160 | 0.540 | 18 | 33 Saisons |
| 3 | 31.155 | 0.545 | 38 | 70 Saisons |
| 4 | 31.395 | 0.305 | 70 | 230 Saisons |
| 5 | 31.592 | 0.108 | 120 | 1111 Saisons |

Zwei Dinge stehen da. Erstens: **die Ersparnis ist nicht monoton.** Sie erreicht bei Level 3 ihr
Maximum und fällt danach wieder, weil der Eigenunterhalt (0.6 → 4.2) schneller wächst als der
Rabattsatz (3 % → 12 %). Ein Level-5-Flügel ist als Sparmaßnahme schlechter als ein Level-3-Flügel und
kostet 82 Cash mehr. Zweitens: die Break-even-Bedingung lautet `U > u·(1−d)/d`, also 19.4 / 20.9 /
23.9 / 28.3 / **30.8** Cash Fremdunterhalt für Level 1 bis 5. Der maximal mögliche Fremdunterhalt
beträgt 31.7. Ein Level-5-Flügel rechnet sich also überhaupt nur in dem einen Zustand, in dem
buchstäblich alle sieben anderen Gebäude auf Maximalstufe stehen — und selbst dann mit vierstelliger
Amortisationsdauer.

Realistisches Mittelspiel-Portfolio (Trainingszentrum L3, Recovery L3, Scouting L2, Fan Shop L2,
Arena L1, Academy L1 → `U = 7,90`):

| Flügel-Level | Netto-Effekt auf den Saison-Unterhalt |
|---|---|
| 1 | −0.35 |
| 2 | −0.65 |
| 3 | −1.12 |
| 4 | −1.84 |
| 5 | −2.75 |

Der Flügel **erhöht** hier die laufenden Kosten auf jeder Stufe, zusätzlich zu den Baukosten. Über den
gesamten realistischen Spielraum ist der einzige lebende Effekt des Specialist Wing negativ.

### 2.4 Was diese Messung heißt

Chris' Formulierung „zu schwach, lohnt sich nicht" trifft es nicht ganz. Präziser:

- Analytics Room: **Effekt existiert nicht.** Das Gebäude ist ein Preisschild an zwei Team-Powers.
- Specialist Wing: **beworbener Effekt existiert nicht, realer Effekt ist negativ**, und die einzige
  echte Spielerentscheidung am Gebäude — die unwiderrufliche Variantenwahl — ist folgenlos.

Beides sind keine Balance-Fragen. Balance-Zahlen zu drehen würde hier nichts ändern, weil es nichts
gibt, das man drehen könnte.

---

## 3. Vergleich: was ein Gebäude attraktiv macht

Die sechs anderen Gebäude zerfallen in drei Muster.

**Muster A — die Zahl fließt in eine Formel, die jede Saison läuft.** Das Trainingszentrum liefert
`modifierPct` direkt in den Trainingsbudget-Multiplikator
(`organic-season-progression.ts:365-379`, angewandt in `:1014-1022`), und ab Level 4 schaltet es
zusätzlich eine zweite Trainingsklasse frei (`:584-588`) — eine echte Schwelle, die die Kaderplanung
verändert. Das Recovery Center liefert einen flachen absoluten Bonus auf die Spieltags-Regeneration
(`facility-effects.ts:155-165`) und zusätzlich eine Trainings-Fatigue-Senkung (`:184-187`). Die
Academy beschleunigt das organische Trainingsbudget von F/E/D-Spielern
(`facility-effects.ts:206-216`). Alle drei Gebäude haben eine Zahl, die man in einer Prognose sofort
größer werden sieht.

**Muster B — das Gebäude verkauft Cash gegen Cash, nachrechenbar.** Fan Shop und Arena Upgrade tragen
`seasonIncome` (`facility-catalog.ts:145-151`, `:168-174`). Beide wurden explizit auf Amortisation
kalibriert; die Kommentare nennen die Zielzahl („marginale Amortisation jetzt ~3–8.5 Saisons",
„~8 Saisons", `facility-catalog.ts:140-144`, `:160-167`). Der Fan Shop ist flach und sicher, die Arena
skaliert mit der Beliebtheit (`facility-season-end-service.ts:104`, `:152-154`) — zwei verschiedene
Risikoprofile für dieselbe Frage. Die Entscheidung ist trivial nachzurechnen und deshalb befriedigend.

**Muster C — das Gebäude kauft Information, die eine Entscheidung ändert.** Das Scouting Office ist
das einzige reine Informationsgebäude, das funktioniert, und es lohnt sich, weil die Information an
*mehreren* Stellen zu einer harten Zahl wird: die Unsicherheitsspanne des Potentials schrumpft von ±16
auf ±3 (`player-potential-service.ts:121-130`), die Konfidenz steigt von 20 % auf 90 % und **deckelt
den Marktwert-Potential-Aufschlag** (`:133-147`, `:604-610`), und die Scout-Pipeline gibt mehr Slots,
schnelleren Erkenntnisgewinn und passive Slots (`facility-scout-pipeline-service.ts:22-29`). Ein
Level-5-Scouting-Office macht ein Fokusziel sofort lesbar statt in fünf Spieltagen (`:8-14`). Der
Spieler sieht den Unterschied beim nächsten Transfer.

**Woran es den beiden fehlt — konkret.**

| | Analytics Room | Specialist Wing |
|---|---|---|
| Effekt greift in eine Mechanik ein | nein (nur Label + Team-Powers) | nein (toter Rabatt) / ja, aber negativ (Unterhalt) |
| Wirkung sichtbar | nein, nichts ändert sich | nein, der reale Effekt steht nirgends |
| Preis vertretbar | ja, die Stufen sind billig | ja, aber der Gegenwert ist ≤ 0 |
| Effekt zu schwach | nicht messbar, weil nicht vorhanden | Level 4/5 sind schwächer als Level 3 |
| Entscheidung dahinter | keine | eine, aber folgenlos und unwiderruflich |

Es ist also weder ein Preis- noch ein Stärkeproblem. Der Analytics Room braucht überhaupt erst einen
Einhakpunkt; der Specialist Wing hat einen (die Variante), der ins Nichts führt.

Ein Nebenbefund, der zur Wahrnehmung beiträgt: der Analytics Room steht in der Home-Übersicht ganz
vorn (`home-v2-ui-helpers.ts:11-17`, dritte Position der fünf gezeigten Gebäude), der Specialist Wing
gar nicht. Das Gebäude ohne Wirkung ist also prominent platziert, was den Eindruck „ich habe gebaut,
und nichts ist passiert" verstärkt.

---

## 4. Vorschläge Analytics Room

Alle drei Vorschläge lösen dasselbe Problem: „Forecast Quality" braucht eine Größe, die sich
verändern kann. Sie schließen einander nicht aus, aber A1 und A2 zusammen wären zu viel für ein
Gebäude dieser Preisklasse.

### A1 — Prognose als Spanne statt als Punktwert (Spiegelbild des Scouting Office)

**Idee.** Die Trainings- und Saisonprognosen zeigen heute für jeden Spieler exakte Zahlen, unabhängig
davon, ob ein Analytics Room existiert. Der Vorschlag: Die Prognose bekommt eine Anzeigebreite, die
vom Analytics-Level abhängt — analog zu `getScoutingUncertainty`
(`player-potential-service.ts:121-130`), die genau dasselbe für das Potential tut. Ohne Analytics Room
sieht der Spieler eine breite Spanne („+18 bis +34 Setpoints"), auf Level 5 den Punktwert. Der real
berechnete Wert in `buildOrganicSeasonProgression` bleibt unverändert — es wird nichts erfunden,
sondern nur unschärfer dargestellt, was auch die vorhandenen Marker
`"forecast_uncertainty_reduced_no_fake_values"` (`use-foundation-cross-tab-training.ts:490`) und
`"analytics_room_forecast_accuracy_visible:no_fake_values"`
(`season-end-progression-preview.ts:710`) offensichtlich immer schon gemeint haben. Die Leiter kann
sich an der Scouting-Leiter orientieren (dort ±16 → ±3 über fünf Stufen); die konkreten Zahlen sind
Balance-Arbeit und gehören nicht in dieses Konzept.

**Welche Entscheidung wird interessanter.** Die Wahl des Trainingsmodus (leicht/mittel/hart) und der
Setpoint-Verteilung. Heute rechnet der Spieler die optimale Belastung exakt aus, weil ihm die Prognose
den Endwert verrät. Mit Spannen wird die Frage „wie viel Fatigue-Risiko gehe ich für wie viel
erwartete Entwicklung ein" wieder eine Abwägung — und der Analytics Room ist das Gebäude, das diese
Abwägung schärft. Das entspricht der Rolle, die das Scouting Office beim Transfer hat.

**Was er kostet.** Die vorhandene Preisleiter (5/10/17/27/42 Cash, kumuliert 101, Unterhalt 3.6 auf
L5) bleibt unangetastet und wird dadurch erst plausibel: sie liegt bewusst unter dem Scouting Office
(6/12/20/32/50, kumuliert 120), weil Prognoseschärfe weniger wert ist als Transferwissen.

**Was er kaputtmachen könnte.** Die Prognose-Chips sind an vielen Stellen verdrahtet
(`training-forecast-display.ts`, `training-player-row-view.ts`, das Trainings-Panel in
`use-foundation-cross-tab-training.ts`). Eine Spanne statt einer Zahl berührt jede dieser Stellen und
jeden Test, der auf einen exakten Prognosewert prüft. Außerdem darf die Spanne nirgends in eine
Rechnung fließen — sonst wäre der Anzeigewert plötzlich ein Gameplay-Wert, und der Grundsatz aus
`docs/GAMEPLAY_SOURCES_POLICY.md` („Keine Fake-Werte in Resolve, Preisgeld oder AI-Empfehlungen")
wäre verletzt.

**Was dagegen spricht.** Das ist ein **Nerf für jeden bestehenden Spielstand.** Alle Teams sehen heute
exakte Prognosen umsonst; nach A1 sehen Teams ohne Analytics Room weniger als vorher. Das ist der
ehrlichste Weg, ein Informationsgebäude relevant zu machen — Information hat nur dann Wert, wenn ihr
Fehlen wehtut —, aber es fühlt sich für Chris beim ersten Laden wie ein Rückschritt an, nicht wie ein
neues Gebäude. Zweitens ist es der teuerste Vorschlag in Umsetzungsaufwand: die Unsicherheitsschicht
existiert für Prognosen noch überhaupt nicht, während sie für Scouting fertig ist. Drittens
verschiebt es das Gebäude in die reine Bequemlichkeitsecke: ein sehr guter Spieler kann die Prognose
im Kopf abschätzen und braucht den Raum nie. Genau dieses Problem hat das Scouting Office nicht, weil
es dort neben der Anzeige auch harte Effekte gibt (Pipeline-Slots, Marktwert-Deckel).

### A2 — Analytics Room steuert die Formkarten-Ladungen

**Idee.** Team-Powers aus Gebäuden haben heute pauschal zwei Ladungen: `FACILITY_POWER_CHARGES = 2`
(`team-powers.ts:45`), unabhängig von Gebäude, Level und Team. Der Vorschlag: Der Analytics Room
bestimmt, wie viele Ladungen die **Gebäude-Powers des Teams insgesamt** haben — etwa Level 0/1 = 2
(Status quo), und die höheren Stufen heben das schrittweise an. Das Gebäude wird damit vom
„Informationslieferanten" zum **Planungsgebäude**: wer analytisch arbeitet, kann seine Karten in mehr
Spieltagen ausspielen. Thematisch passt es zu den vorhandenen Power-Namen („Forecast Edge",
„Perfect Read") und zur Kategorie `mental`, die der Raum schon hat (`team-powers.ts:294-297`).

**Welche Entscheidung wird interessanter.** Der Formkarten-Saisonplan. Der Plan wird pro Saison
einmal aufgestellt und nur kurzfristig umgebucht (`room-flow-controller.ts:43`, `:75-78`,
`ai-form-card-season-plan.ts:9`). Mehr Ladungen heißt: der Plan darf gröber sein, weil man später
nachsteuern kann. Weniger Ladungen zwingt zur frühen Festlegung. Das ist eine echte Wahl zwischen
Flexibilität und Investition, und sie hängt an einem Gebäude statt an einer Konstante.

**Was er kostet.** Die Preisleiter bleibt. Der Analytics Room würde damit zum zweitwichtigsten
Gebäude für Teams, die ihre Spieltage aktiv managen, und bliebe für passive Teams verzichtbar — eine
gesunde Spreizung.

**Was er kaputtmachen könnte.** Ladungen sind ein Multiplikator auf alle Gebäude-Powers gleichzeitig
(`buildFacilityPowers` vergibt `chargesTotal` an jede Power, `team-powers.ts:480`). Ein Team mit vielen
Gebäuden auf Level 4 bekommt dadurch überproportional viel — der Effekt skaliert mit dem übrigen
Portfolio, nicht mit dem Analytics Room allein. Wenn das nicht gewollt ist, müsste die Erhöhung auf die
beiden Analytics-eigenen Powers begrenzt werden, was den Vorschlag deutlich schwächer macht.

**Was dagegen spricht.** Es hat mit „Forecast Quality" nichts zu tun. Der Raum bekäme einen Zweck, aber
einen thematisch fremden — genau die Sorte Umwidmung, die bei der Academy schon einmal einen
Beschreibungstext zurückgelassen hat, der nicht mehr stimmt (`FacilitiesV2NewLook.tsx:280` zeigt bis
heute „F/E/D Upgrade-Rabatt", obwohl der Effekt seit der Umwidmung ein Entwicklungs-Boost ist).
Zweitens greift der Vorschlag in ein Spieltagssystem ein, das laut
`docs/GAMEPLAY_SOURCES_POLICY.md` bewusst manuell gehalten ist — mehr Ladungen heißt mehr manuelle
Klicks pro Saison, was für ein Spiel mit 32 Teams eine Zumutung sein kann. Drittens ist der Effekt in
den ersten zwei Saisons unsichtbar, solange kaum ein Gebäude Level 2 erreicht hat.

### A3 — Analytics Room zeigt den Live-Fortschritt auf Sponsor-Achsen und Board-Zielen

**Idee.** Die Sponsor-Achsen messen den Fortschritt gegen eine bei Vertragsabschluss eingefrorene
Ausgangslage (`sponsor-v4-axes.ts:1-26`), und `evaluateSponsorV4Axis` (`:348`) kann diesen Fortschritt
jederzeit während der Saison berechnen — aufgerufen wird sie aber nur aus dem
Settlement-Pfad (`sponsor-objective-evaluator.ts:671`). Der Spieler erfährt also erst am Saisonende,
ob er sein Sponsorziel erreicht hat. Der Vorschlag: Der Analytics Room schaltet diese Live-Anzeige
stufenweise frei — niedrige Stufen zeigen nur eine grobe Ampel, hohe den genauen Zwischenstand samt
Restbedarf; dasselbe für die Board-Ziele (`lib/board/team-season-objectives-service.ts`).

**Welche Entscheidung wird interessanter.** Die Steuerung *innerhalb* der Saison. Wer bei der Achse
`frische` (Anteil Spieler unter Fatigue 45, `sponsor-v4-axes.ts:148-172`) im Rückstand liegt, muss den
Trainingsmodus drosseln oder rotieren; wer bei `ausbau` (Summe aller Gebäudestufen, `:228-249`) zwei
Stufen fehlt, baut noch ein billiges Level. Ohne Live-Anzeige sind das Blindflüge. Das macht auch die
**Sponsorwahl** in der Vorsaison interessanter, weil man sich zutraut, eine engere Achse zu nehmen,
wenn man sie nachsteuern kann.

**Was er kostet.** Die Preisleiter bleibt. Inhaltlich passt der Raum zum Preis: er ist billiger als
das Scouting Office, und Zielfortschritt ist weniger wert als Transferwissen.

**Was er kaputtmachen könnte.** Wenig am Regelwerk — die Berechnung existiert und ist geprüft
(`tests/sponsor-v4-achsen.test.ts`). Das Risiko liegt in der Erwartungshaltung: sobald der
Zwischenstand sichtbar ist, wird jeder Wert daran gemessen. Die Achse `wachstum` etwa ist in Saison 1
wegen eines Methodenwechsels bei der Marktwertberechnung systematisch negativ und wird deshalb gar
nicht angeboten (`sponsor-v4-axes.ts:191-215`) — solche Eigenheiten werden sichtbar, sobald man live
mitliest, und erzeugen Bug-Reports.

**Was dagegen spricht.** Es ist ein reines Anzeige-Feature. Ein Gebäude, das nur Auskunft gibt, wird
sich für Chris möglicherweise erneut wie „lohnt sich nicht" anfühlen — dieselbe Kritik, die zu diesem
Dokument geführt hat. Es rettet den Analytics Room nur, wenn die Sponsor-Ziele wirklich eng sind; sind
sie leicht erfüllbar, ist die Information wertlos. Die Messung in
`docs/analyse/sponsor-achsen-messung.md` deutet in beide Richtungen: `entwicklung` und `soliditaet`
lagen vor der Nachkalibrierung bei ~100 % Erfüllung, `kaderpflege` bei 44 %. Zweitens gilt derselbe
thematische Einwand wie bei A2 in abgeschwächter Form: „Forecast" ist im Katalog bislang die
*Spieler*-Prognose, nicht der Zielfortschritt.

---

## 5. Vorschläge Specialist Wing

Die Vorschläge S1 und S2 geben der Variantenwahl Bedeutung; S3 ist die ehrliche Minimallösung, die die
Variante streicht. S1 und S2 sind kombinierbar, S3 schließt beide aus.

### S1 — Die Variante wird die Trainings-Fokusachse des Teams

**Idee.** Es gibt bereits eine Team-Fokusachse: `resolveTeamTrainingFocusAxis`
(`organic-season-progression.ts:414-423`) liest `aiManagerTrainingSettings[teamId].trainingFocus` als
POW/SPE/MEN/SOC, und `getDevelopmentRouteBonusMultiplier` (`development-route-bonus.ts:10-20`) gibt
Spielern, deren Entwicklungsroute zur Achse passt, den Faktor 1.08 auf ihr Trainingsbudget — angewandt
in `organic-season-progression.ts:1012` und `:1014-1022`. Die vier Flügel-Varianten bilden diese vier
Achsen exakt ab: Power Gym → POW, Agility Track → SPE, Mind Lab → MEN, Social Studio → SOC. Der
Vorschlag: Der Specialist Wing hebt den Routenbonus für **seine** Achse stufenweise über die 1.08
hinaus. Die Variante wird damit zur Aussage „wir sind ein Kraftteam / ein Kopfteam" — dauerhaft,
unwiderruflich, und genau deshalb bedeutsam.

**Welche Entscheidung wird interessanter.** Gleich drei, und sie hängen zusammen. Erstens die
Variantenwahl selbst: sie ist unwiderruflich (`facility-upgrade-service.ts:244-245`) und legt für den
Rest des Spielstands fest, welche Sorte Spieler bei diesem Team am besten wächst. Zweitens die
Kaderplanung: Spieler mit passender Klasse (`classNameToDevelopmentRoute`,
`organic-season-progression.ts:406-413` — Berserker/Warlord/Tank/Badass = POW, Sprinter/Rogue/Charger =
SPE, usw.) werden für dieses Team mehr wert als für andere, was Transfers und Draft-Prioritäten
verändert. Drittens die Trainings-Fokusachse: sie muss zum Flügel passen, sonst zahlt man für einen
Bonus, den man nicht abruft.

**Was er kostet.** Die vorhandene Preisleiter (6/12/20/32/50, kumuliert 120, Unterhalt 4.2 auf L5)
bleibt und wäre dann die zweitteuerste im Katalog nach der Arena — angemessen für ein Gebäude, das
die Kaderstrategie eines ganzen Spielstands prägt. Der vorhandene Unterhaltsrabatt müsste
verschwinden, sonst hat der Flügel zwei unabhängige Effekte und wird schwer bepreisbar.

**Was er kaputtmachen könnte.** Zwei Dinge. Erstens: Der Routenbonus multipliziert in dieselbe Formel
wie Trainingszentrum, Academy, Trait-Signal und Potential-Beschleuniger
(`organic-season-progression.ts:1014-1022`). Fünf multiplikative Faktoren stapeln sich schnell; ein
Team mit Trainingszentrum L5 (+70 %), Academy L5 (+30 % für F/E/D) und einem starken Flügelbonus auf
passenden Spielern läuft der Liga davon. Der Aufschlag muss deshalb klein bleiben — die vorhandenen
1.08 sind der Maßstab, nicht der Startpunkt. Zweitens: Der Bonus greift nur, wenn die Fokusachse
gesetzt ist; `resolveTeamTrainingFocusAxis` gibt `null` zurück, wenn `aiManagerTrainingSettings` für
das Team fehlt. Für manuell geführte Teams muss geklärt sein, ob die Flügelvariante die Achse
**ersetzt** (dann ist der Effekt garantiert) oder nur **verstärkt, wenn beide übereinstimmen** (dann
ist er an eine zweite Einstellung gekoppelt, die der Spieler übersehen kann). Ich halte „ersetzt" für
robuster; „verstärkt" ist die interessantere, aber fehleranfälligere Variante.

**Was dagegen spricht.** Der Vorschlag macht die Liga **weniger** vielfältig, nicht mehr: wenn ein
Flügel eine Achse begünstigt, laufen alle Teams mit Flügel auf Achsen-Monokulturen zu, und Spieler
mit „falscher" Klasse verlieren im Transfermarkt an Wert. Das kann gewollt sein (Teams bekommen
Profil) oder eine Verarmung (jedes Team hat elf Berserker). Zweitens ist die Unwiderruflichkeit ein
Risiko: heute ist sie harmlos, weil die Wahl folgenlos ist; nach S1 kann ein Spieler sich in Saison 2
dauerhaft in die falsche Achse einbauen und hat keinen Rückweg — das wird ein Bug-Report werden.
Drittens: der Effekt ist am langsamsten sichtbar von allen Vorschlägen. Trainingsbudget-Prozente
zeigen sich erst am Saisonende in den Attributen, und der Flügel würde damit dasselbe
Wahrnehmungsproblem erben, das die Academy hat.

### S2 — Der Flügel senkt die negativen Trainings-Nebenwirkungen seiner Attributgruppe

**Idee.** Jede Trainingsklasse hat negative Gewichte: `distributeByClassProfile`
(`organic-season-progression.ts:558-581`) zieht mit `NEGATIVE_TRAINING_SIDE_EFFECT_SHARE = 0.14`
(`:195`) einen Teil des Budgets von den Attributen wieder ab, die das Klassenprofil abwertet. Der
Vorschlag: Für Attribute, die zur Variante des Flügels gehören (`SPECIALIST_WING_VARIANTS`,
`facility-catalog.ts:45-65`), wird dieser Abzug stufenweise gedämpft. Ein Power Gym schützt also
power/health/stamina/torment davor, durch Kopf- oder Sozialtraining wegzuerodieren.

**Welche Entscheidung wird interessanter.** Die Kombination aus Trainingsklasse und Kaderprofil. Heute
ist der Nebenwirkungs-Abzug ein stiller Malus, den niemand steuern kann. Mit dem Flügel wird er
steuerbar: ein Team, das seine Athletik konservieren will, während es an den Köpfen arbeitet, baut ein
Power Gym. Das ist eine Verteidigungs-Entscheidung, und sie ergänzt S1 gut (S1 beschleunigt eine
Achse, S2 schützt eine).

**Was er kostet.** Preisleiter bleibt. Der Effekt ist von Natur aus kleiner als S1 — er hebt keine
Obergrenze, sondern verringert einen Verlust — und wäre damit für die Preisklasse eher zu wenig; das
spricht dafür, S2 als *Ergänzung* zu S1 zu denken, nicht als Alternative.

**Was er kaputtmachen könnte.** Der Nebenwirkungs-Abzug ist eine Balance-Bremse: er verhindert, dass
ein Spieler in alle zwölf Attribute gleichzeitig wächst. Wer ihn dämpft, hebt indirekt die Gesamt-
Wachstumsrate und schiebt damit Marktwerte, Sponsor-Achse `wachstum` und die Regression
(`organic-season-progression.ts:1057-1075`) mit. Das ist ein Eingriff in die Ökonomie, nicht nur in
ein Gebäude.

**Was dagegen spricht.** Der Effekt ist praktisch unsichtbar. Ein gedämpfter Abzug erscheint nirgends
als eigene Zahl; der Spieler sieht nur, dass ein Attribut etwas weniger gefallen ist als es gefallen
wäre — gegen einen Zustand, den er nie zu sehen bekommt. Das ist genau das Problem, das den
Analytics Room heute unattraktiv macht, nur in kleiner. Zweitens überschneiden sich zwei Varianten in
`awareness` (Agility Track und Social Studio, `facility-catalog.ts:56` und `:63`), was bei einem
Schutz-Effekt zu erklärungsbedürftigen Sonderfällen führt.

### S3 — Ehrliche Minimallösung: der Flügel wird das Betriebsgebäude, die Varianten fallen weg

**Idee.** Der Flügel behält seinen einzigen realen Effekt — den Unterhaltsrabatt auf alle Gebäude
(`facility-effects.ts:232-250`) —, aber er wird (a) korrekt beschrieben, (b) monoton skaliert, und (c)
auf die Instandhaltungskosten ausgeweitet (`calculateFacilityMaintenanceCost`,
`facility-condition.ts:36-48`), die heute gar nicht rabattiert werden, obwohl sie bei 8 %
Verschleiß pro bezahlter Saison (`facility-condition.ts:5`) über die Zeit die größere Position sind.
Die vier Varianten und die Unwiderruflichkeit entfallen ersatzlos, weil sie zu einem Betriebsgebäude
nicht passen. Der Flügel wird damit zu dem, was er faktisch schon ist, nur richtig gerechnet: das
Gebäude für Teams mit großem Portfolio.

**Welche Entscheidung wird interessanter.** Die Reihenfolge des Portfolio-Ausbaus. Der Rabatt lohnt
sich erst ab einer bestimmten Portfolio-Größe (Break-even `U > u·(1−d)/d`, siehe 2.3); wer breit baut,
baut ihn früh, wer schmal baut, nie. Das ist eine echte, nachrechenbare Schwelle und liegt im selben
Muster wie Fan Shop und Arena — Cash gegen Cash mit klarer Amortisation. Zusätzlich wird der Flügel
damit zum natürlichen Partner der Sponsor-Achse `ausbau` (Summe aller Gebäudestufen,
`sponsor-v4-axes.ts:228-249`), die heute laut Messung von keinem einzigen Team unterschrieben wird.

**Was er kostet.** Die Preisleiter müsste sinken oder die Rabattkurve steigen, sonst bleibt die
Rechnung aus 2.3 negativ. Konkret: `u·(1−d)/d` muss unter den realistischen Fremdunterhalt fallen, und
die Ersparnis muss über alle fünf Stufen monoton wachsen. Beides ist reine Zahlenarbeit an
`facility-catalog.ts:204-210` und gehört nicht in dieses Konzept.

**Was er kaputtmachen könnte.** Am wenigsten von allen Vorschlägen — der Effekt existiert bereits,
läuft bereits durch `facility-season-end-service.ts:110` und wird bereits im Portfolio-Chip angezeigt
(`FacilitiesV2NewLook.tsx:669-676`). Risiko ist der Verlust der Varianten: `activeVariant` steckt im
gespeicherten Zustand (`facility-effects.ts:43`), in der Upgrade-Vorschau
(`facility-upgrade-service.ts:188-202`), in der UI (`facility-ui-shared.tsx:209-232`) und in
KI-Aufrufen (`ai-manager-apply-service.ts:247`, `:323`, `:703-709`). Das ist Aufräumarbeit, aber
absehbare.

**Was dagegen spricht.** Es löst Chris' Anliegen nur zur Hälfte. Der Flügel würde sich *rechnen*, aber
er bliebe ein Buchhaltungsgebäude ohne Spielgefühl — ein zweiter Fan Shop mit negativem Vorzeichen. Vor
allem wirft der Vorschlag die vier Varianten weg, die das einzige Stück Charakter am Gebäude sind und
die als Struktur (POW/SPE/MEN/SOC) exakt auf die Fokusachsen des Trainingssystems passen. Etwas
wegzuwerfen, das genau in eine vorhandene Mechanik greift, um stattdessen eine Zahl zu drehen, ist die
konservative, aber ärmere Entscheidung. Zweitens bleibt der Flügel damit dauerhaft ein spätes
Gebäude — vor dem vierten oder fünften Bau lohnt er nie —, was ihn für neue Spielstände über mehrere
Saisons irrelevant hält.

---

## 6. Auswirkung auf bestehende Spielstände

Der gespeicherte Gebäudezustand (`seasonState.teamFacilities[teamId].facilities`, gelesen in
`facility-effects.ts:30-52`) enthält pro Gebäude `level`, `enabled`, `conditionPct`, `activeVariant`
und `lastPaidSeasonId`. Kein Vorschlag erfordert ein neues Feld. Trotzdem greifen einige spürbar in
laufende Spiele ein:

**Verändert bestehende Spielstände deutlich:**

- **A1 (Prognose-Spannen).** Jedes Team ohne Analytics Room sieht ab dem Update weniger als vorher.
  Das ist ein Nerf am Informationsstand aller 32 Teams gleichzeitig und die auffälligste Änderung im
  ganzen Dokument. Sollte, wenn überhaupt, mit einem Umschalter versehen werden — Vorbild:
  `isBoardObjectivesV2Enabled()` in `board-objectives-config.ts:12-14`, das genau für diesen Fall
  („V2 ist verhaltensändernd, Golden-Master-Tests verschieben sich absichtlich") existiert.
- **S1 (Variante = Fokusachse).** Alle bereits gebauten Flügel haben eine Variante — und weil die KI
  immer `"mind_lab"` übergibt (`ai-manager-apply-service.ts:247`), tragen praktisch alle KI-Teams
  denselben MEN-Fokus. Nach S1 bekämen sie diesen Bonus rückwirkend, ohne ihn je gewählt zu haben. Das
  ist keine bloße Balance-Verschiebung, sondern eine stille Massen-Entscheidung, die das Spiel für die
  Teams getroffen hat. Entweder muss die KI-Variantenwahl vorher echt werden, oder bestehende Flügel
  müssten bei der Migration eine Neuwahl bekommen.
- **S3 (Varianten entfallen).** `activeVariant` wird in alten Spielständen zu totem Feld. Technisch
  harmlos (das Feld ist optional), aber die Anzeige „Power Gym" in einem Bestandsspiel verschwindet
  ohne Ersatz.

**Verändert bestehende Spielstände moderat:**

- **A2 (Ladungen).** Teams mit vielen Gebäuden auf Level 2/4 bekommen sofort mehr Ladungen, ohne etwas
  getan zu haben. Innerhalb einer laufenden Saison kann das den bereits aufgestellten Formkarten-Plan
  entwerten oder aufwerten. Sauber wäre, den neuen Ladungswert erst zur nächsten Saison greifen zu
  lassen — die Powers werden ohnehin pro Saison neu erzeugt (`ensureLocalTeamPowersForSeason`,
  `team-powers.ts:513`).
- **S2 (Nebenwirkungs-Dämpfung).** Wirkt ab der nächsten Saison-Progression, verschiebt aber
  Attributverläufe und damit Marktwerte über die ganze Liga.

**Praktisch folgenlos für bestehende Spielstände:**

- **A3 (Live-Fortschritt).** Reine Anzeige über eine bereits vorhandene, bereits getestete Rechnung.
  Kein gespeicherter Wert ändert sich, keine Entscheidung wird rückwirkend anders bewertet.

Unabhängig von der Auswahl gilt: Werden Effekte umgewidmet, müssen die Beschreibungstexte mitgehen.
Der Katalog (`facility-catalog.ts:121`, `:200`), die Level-Texte und die Chip-Labels
(`FacilitiesV2NewLook.tsx:273-282`) sind heute an drei Stellen falsch — die Academy zeigt seit ihrer
Umwidmung „F/E/D Upgrade-Rabatt" statt Entwicklungs-Boost, der Specialist Wing zeigt einen Rabatt, den
es nicht gibt, und der Analytics Room zeigt eine Qualität, die nirgends gemessen wird. Diese Texte
sind der eigentliche Grund, warum der Bug-Report so klingt, wie er klingt: Chris hat gelesen, was die
Gebäude versprechen, und dann nichts passieren sehen.

---

## 7. Empfehlung

**Specialist Wing: S1.** Er ist der einzige Vorschlag im Dokument, der eine bereits existierende, aber
folgenlose Spielerentscheidung — die unwiderrufliche Variantenwahl — mit einer bereits existierenden,
aber unterbenutzten Mechanik verbindet: der Fokusachse POW/SPE/MEN/SOC, die heute nur einen einzigen
Faktor 1.08 antreibt (`development-route-bonus.ts:19`). Die Zuordnung ist eins zu eins und muss nicht
erfunden werden; die Unwiderruflichkeit wird von einer Kuriosität zur Pointe. S1 sollte aber nur
zusammen mit einer echten KI-Variantenwahl kommen, sonst erbt die halbe Liga rückwirkend einen
MEN-Fokus, den niemand gewählt hat.

**Analytics Room: A3 als erster Schritt, A1 als Ziel.** A1 ist die inhaltlich richtige Antwort — das
Gebäude heißt „Forecast Quality" und sollte Prognosequalität liefern, spiegelbildlich zum funktionierenden
Scouting Office. Aber A1 ist ein spürbarer Nerf für alle laufenden Spielstände und braucht eine
Unsicherheitsschicht, die es in der Prognose-Pipeline noch gar nicht gibt. A3 kostet fast nichts,
nutzt eine fertige und getestete Rechnung (`evaluateSponsorV4Axis`), nimmt niemandem etwas weg und
gibt dem Gebäude sofort einen nachweisbaren Zweck. Wenn A3 in der Praxis zu dünn bleibt, ist A1 der
nächste Schritt — und dann hinter einem Umschalter nach dem Vorbild von
`isBoardObjectivesV2Enabled()`.

Was in jedem Fall zuerst passieren sollte, unabhängig von der Rework-Entscheidung: **die drei falschen
Beschreibungstexte korrigieren und die wirkungslosen Zwischenstufen benennen.** Dass der Analytics
Room auf Level 1, 3 und 5 nichts tut und der Specialist Wing auf Level 4 und 5 schlechter rechnet als
auf Level 3, ist heute für den Spieler nicht erkennbar — und das ist ein größerer Schaden als der
fehlende Effekt selbst.

# PM-Gesamtstand 06.09.2026 — was steht, was fehlt, was als Nächstes

Reine Recherche und Analyse. **Keine Zeile Code geändert, kein Commit, kein PR.**

Messstand: `origin/main` = `6da7f9f5` (nach PR #812). Alle rho-Zahlen unten sind an diesem Stand
**heute frisch gemessen** mit `node scripts/miss-alle-disziplinen.mjs 24` (kaderfest, fünf echte
Paarungen aus `kaderfamilie-live-save.json`, 24 Spiele je Paarung) — nicht aus Dokumenten
übernommen. Die beiden Spiegel (`live-save`, `bug-reports`) sind frisch (0,1 h bzw. 0,2 h,
`scripts/pruefe-spiegel-frische.ts`).

---

## 0. Die fünf Sätze vorab

1. **Der Projektstand ist deutlich besser, als die Doku sagt: 11 bestanden / 3 knapp / 6
   durchgefallen**, nicht 9/3/8. `docs/design/stand-aller-disziplinen.md` ist an vier Stellen
   überholt — Staffel (0,681 → **0,915**), Takeshi's Castle (0,697 → **0,886**), Spurt (0,857 →
   0,871), Football (0,468 → **0,516**).
2. **Takeshi's Castle besteht bereits ohne PR #813** (0,886 auf `main`). #813 ist damit kein
   Rangtreue-Rettungs-PR mehr, sondern ein Gameplay-/Optik-PR. Das ändert seine Dringlichkeit,
   nicht seine Berechtigung.
3. **Die CI-Rangtreue-Schranke schützt die Gewinne der letzten drei Tage nicht.**
   `data/generated/rangtreue-basislinie.json` steht auf dem 04.09.; Staffel, Takeshi, Spurt und
   Football dürften bis auf ihren alten, schlechten Stand zurückfallen, ohne dass die CI rot wird.
4. **Der größte Abstand zwischen Arbeit und Spiel ist nicht rho, sondern die Produktivierung.**
   17 von 20 Disziplinen laufen in Chris' echtem Spielstand weiter über den alten PPS-Rangpfad.
   Elf davon haben die Schranke bestanden — die Arbeit kommt bei Chris nicht an.
5. **Multiplayer ist fertiger als gedacht**: der Room-Flow läuft in der CI (`app:smoke-multiplayer-e2e`,
   `app:smoke-coop-sync`). Was fehlt, ist **kein Bau**, sondern ein Server-Schalter
   (`OLY_AUTH_ENABLED=1` plus drei Geheimnisse in `deploy/hetzner/.env`) — das kann nur Chris.

---

## 1. Rangtreue aller zwanzig — frisch gemessen, 06.09.

| # | Disziplin | Chassis | rho je Spiel | Spannweite | rho Saison | Abnahme | Doku sagt |
|---:|---|---|---:|---:|---:|---|---|
| 1 | Staffel | Bahn | **0,915** | 0,089 | 0,951 | 🟢 bestanden | 0,681 durchgefallen ❌ |
| 2 | Speed-Schach | Bühne | 0,889 | 0,060 | 0,979 | 🟢 bestanden | stimmt |
| 3 | Gewichtheben | Bühne | 0,887 | 0,224 | 0,944 | 🟢 bestanden | stimmt |
| 4 | Takeshi's Castle | Bahn | **0,886** | 0,073 | 0,951 | 🟢 bestanden | 0,697 durchgefallen ❌ |
| 5 | Showcase | Bühne | 0,880 | 0,140 | 0,944 | 🟢 bestanden | stimmt |
| 6 | Spurt | Bahn | **0,871** | 0,236 | 0,905 | 🟢 bestanden | 0,857 (nah) |
| 7 | Time-Trial | Bahn | 0,867 | 0,050 | 0,909 | 🟢 bestanden | stimmt |
| 8 | Wettessen | Bühne | 0,844 | 0,233 | 0,916 | 🟢 bestanden | stimmt |
| 9 | Fechten | Bühne | 0,840 | 0,230 | 0,874 | 🟢 bestanden | stimmt |
| 10 | Tennis | Bühne | 0,814 | 0,176 | 0,839 | 🟢 bestanden | stimmt |
| 11 | Breaking | Bühne | 0,801 | 0,114 | 0,874 | 🟢 bestanden | stimmt |
| 12 | Climbing | Bahn | 0,790 | 0,192 | 0,851 | 🟡 knapp | stimmt |
| 13 | Basketball | Feldspiel | 0,772 | 0,088 | 0,923 | 🟡 knapp | stimmt |
| 14 | Eiskunstlauf | Bühne | 0,757 | 0,125 | 0,958 | 🟡 knapp | stimmt |
| 15 | I-Spy | Bühne | 0,692 | 0,384 | 0,727 | 🔴 durchgefallen | stimmt |
| 16 | Hockey (alle 12) | Feldspiel | 0,669 | 0,181 | 0,832 | 🔴 durchgefallen | stimmt — von Chris **akzeptiert** |
| ↳ | Hockey, nur Feldspieler | Feldspiel | 0,719 | 0,182 | 0,818 | 🟡 knapp | stimmt |
| 17 | Football | Feldspiel | **0,516** | 0,172 | **0,811** | 🔴 durchgefallen | 0,468 ❌ |
| 18 | Battlefield | Arena | **0,387** | 0,938 | 0,595 | 🔴 durchgefallen | 0,325 ❌ |
| 19 | TDM | Arena | **0,253** | 0,328 | 0,217 | 🔴 durchgefallen | 0,113 ❌ |
| 20 | Mini-DM | Arena | **0,094** | 0,697 | 0,071 | 🔴 durchgefallen | 0,269 ❌ |

**Bilanz: 11 bestanden · 3 knapp · 6 durchgefallen.** (Hockey zählt als eine Disziplin.)

### 1a. Die Arena ist nicht nur schlecht, sie ist unmessbar

Battlefield, Mini-DM und TDM haben eine **Kader-Spannweite größer als ihr eigener Median**
(0,938 bei Median 0,387; 0,697 bei 0,094). Nach der projekteigenen Faustregel ist damit **keine**
Bewegung dieser drei von Null unterscheidbar — auch die scheinbaren Sprünge gegenüber der
Basislinie (TDM +0,140, Mini-DM −0,175, Battlefield +0,062) sind vermutlich Rauschen, kein Befund.
`docs/design/staffel-offene-fragen-plus-takeshis-castle-05-09.md` (3.5) hat dieselbe Drift schon am
05.09. gesehen und ausdrücklich als „nicht dieser Patch, sondern heutiger `main`" isoliert.

**Konsequenz für die Planung:** eine Arena-Runde, die mit n = 24 × 5 gemessen wird, kann ihren
eigenen Erfolg nicht nachweisen. Wer die Arena angeht, braucht **zuerst** eine größere Stichprobe
(n ≥ 96–150), sonst wird die Runde so enden wie Hockeys Zoneneintritt: gewinnend bei n=24,
gekippt bei n=96, nicht committet.

---

## 2. Was Chris in dieser Feedback-Runde gesagt hat — und was davon offen ist

Die Runde 05./06.09. entstand aus Playwright-Screenshots. Fünf Aufträge, drei ganz erledigt.

| Chris' Auftrag (wörtlich, gekürzt) | Stand | Rest |
|---|---|---|
| „du musst die Wertungstabelle IMMER nutzen! die muss auch in jeder diszi adaptiert werden!" | 🟡 Welle 1 gemergt (#808) | **Welle 2 + 3 offen** — s. 2a |
| „Time-Trial … Wertung als Einzelzeitfahren" | 🟢 #807: Rang-Punkte für Time-Trial/Spurt/Climbing + Endstand-Overlay | Staffel und Takeshi haben **keine** Punkte-je-Läufer-Wertung (Overlay zeigt dort „–") |
| „zur Darstellung von Schach … das soll cool aussehen" | 🟢 #809: eigenes Bühnenbild, Fokus-Brett, Uhren, Bewertungsbalken | — |
| „Takeshi … mehr Assets … Seeds … Punkt wenn geschafft" | 🟡 #810 Burgpunkte/3 Kurse/10 Fallen, #813 Route+Chaos offen | **#813 offen** (Review vergeben, nicht anfassen) |
| „takeshis castle soll chaotisch sein … outsmarten" | 🟡 in #813 | 5 offene Chris-Entscheidungen, s. 2b |

### 2a. Wertungstabelle Welle 2 — der sichtbarste Restposten

Welle 1 hat alle 14 Standbilder beseitigt. **Was Chris beim nächsten Blick auf die drei
produktiven Disziplinen sieht, ist aber weiter falsch** (`wertungstabelle-je-disziplin-plan-05-09.md`
Abschnitt 5):

- **Hockey** zeigt Eishockey-Ereignisse unter **Basketball-Wörtern** (Reb = Abpraller, Blk = Blocks
  *und* Torwart-Paraden, FG = Schüsse). Strafminuten und Checks werden gezählt, aber nicht gezeigt.
  Der Torwart hat keine eigene Zeile (Par / GT / SV%).
- **Football** ist nach 76 Spielsekunden bis auf den Touchdown-Scorer **leer** — Yards, Tackles und
  Sacks werden an der Einheit gezählt, aber `fsBisher()` kennt sie nicht.
- Die Spalte **„Imp" ist bei allen Feldspielen die Basketball-Formel**, nicht `feldspielWert()` — der
  Kommentar in Z. 14102 behauptet das Gegenteil. Hockeys Torwart und Footballs Yards sind für die
  Anzeige unsichtbar, obwohl der Motor sie längst bewertet.

Dazu die Abnahme-Sonde aus Abschnitt 7 des Plans (`scripts/sonde-wertungstabelle.mjs`) — **nicht
eingecheckt**, obwohl der Plan sie als Regressionsschutz vorschlägt.

### 2b. Drei Kleinstfunde aus der Runde, benannt und liegengeblieben

Alle drei aus `time-trial-einzelzeitfahren-wertung-plan-05-09.md` Abschnitt 1.5, alle sichtbar:

1. Der Ticker-Zeitstempel (`feed()`, Z. 15950) schreibt `"0:"+floor(sekunden)` **ohne
   Minutenumbruch** — auf der Bahn steht „0:66" und „0:99", während die Kopfzeile korrekt „1:39"
   zeigt.
2. „Plan der KI" (`#arenaplan`) zeigt im Time-Trial den **TDM-Text** („Mauer schieben — kein
   Ausreißer …").
3. Fünf offene Chris-Entscheidungen zu Takeshis Chaos (`takeshi-chaos-tackle-plan-06-09.md`
   Abschnitt 9): jeder-gegen-jeden ja/nein, Ausweichen ja/nein, Chaos je Kurs, Ticker-Dichte,
   Wortwahl. Vermutlich in #813 vorentschieden — aber als **Chris-Fragen** notiert, nicht als
   Umsetzerentscheidungen.

### 2c. Was NICHT offen ist

Die In-Game-Meldungen sind **leer**. Der `bug-reports`-Spiegel trägt 92 Dateien, die **neueste vom
25.08.** — der Commit „92 Meldung(en) vom Live-Server" von heute ist ein voller Re-Push, kein
Zulauf. Die letzten beiden Meldungen überhaupt (Arena-Audio, Arena-Rollenprofile) sind triagierte
Feature-Lücken, kein Ein-Zeilen-Fix.

---

## 3. Die größten technischen Risiken

| Risiko | Schwere | Warum |
|---|---|---|
| **Basislinie schützt nichts** | 🔴 hoch | `rangtreue-basislinie.json` steht auf 04.09. Staffel darf von 0,915 auf 0,681, Takeshi von 0,886 auf 0,697, Spurt von 0,871 auf 0,652, Football von 0,516 auf 0,468 fallen — CI bleibt grün. Drei Tage Arbeit sind ungesichert. Fix: `node scripts/baue-rangtreue-basislinie.mjs 24`, ein Commit. |
| **`buildSeasonPlayerCount` schließt die Basiszahl aus** | 🔴 hoch, alle 20 | `lib/season/season-discipline-schedule.ts:64–75` würfelt 2–6 und verschiebt **nur bei Treffer** um ±1. Damit ist die konfigurierte Basis die einzige Größe, die **nie** gespielt wird: Staffel (3) läuft 2/4/5/6, Spurt (2) läuft 3/4/5/6, Takeshi (4) läuft 2/3/5/6. Eine „Vierer-Staffel" — die sportliche — ist heute ausgeschlossen. Gefunden 05.09., als Chris-Entscheidung notiert, **nicht bearbeitet**. |
| **Football: Anzeige und Spiel widersprechen sich** | 🟠 mittel | PR #803 gab Football eine eigene `spielEignung` im Motor (Chris' Vorgabe: Matrix nicht anfassen). Folge, im Commit selbst als „bekannter, akzeptierter Nebeneffekt" notiert: Rating-Anzeige, Teamstärke und **KI-Kauf** ordnen Football nach der alten Tabelle, das Minispiel nach der neuen. Die KI kauft für Football die falschen Spieler, und Chris' Kaderbildschirm lügt. Offene Design-Frage, **Chris' Entscheidung**. |
| **Stand-Doku überholt** | 🟠 mittel | Vier falsche Zeilen (s. 1). Wer sie liest, priorisiert Takeshi und Staffel als Baustellen, die längst stehen — genau der Fehler, den dieses Briefing korrigiert. |
| **`rr()`-LCG-Falle** | 🟡 niedrig, aber scharf | `battle-mode.engine.js:~12758`. Der erste Zug nach `seed = Zahl` trägt dieselbe Einzelschritt-Schwäche wie der reparierte Kurs-Mischer. Heute folgenlos, weil alle Produktionsaufrufer Text-Saaten schicken (FNV-1a-normalisiert). **Das ist eine Falle, kein Fehler** — sie schlägt zu, sobald jemand eine Zahlen-Saat einführt. Dieselbe Fehlerklasse hat dieses Projekt schon zweimal getroffen (Formkarten `z % n`, Kurs-Mischer). |
| **Drei gestapelte Takeshi-PRs** | 🟡 niedrig, aber verwirrend | #813 **enthält** #810 und #811 vollständig (per `git merge-base` geprüft). #810 und #811 stehen trotzdem offen und nicht als Draft. Wer #810 nach #813 mergt, mergt dieselben Commits zweimal. Aufräumen: nach #813 schließen. |
| **Multiplayer ungeprüft?** | 🟢 entkräftet | Der Room-Flow läuft **in der CI** (`app:smoke-multiplayer-e2e`, `app:smoke-coop-sync`, `.github/workflows/ci.yml` Z. 150/214), mit vier Chris- und vier Franky-Teams, Sitz-Tokens, Verbotsprüfung und Arena-Sync. 20+ Room-Tests unter `tests/`. Der offene Rest ist **Betrieb, nicht Bau**. |

---

## 4. Der größte Hebel, den niemand auf der Liste hat: Produktivierung

`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts:141`) enthält genau
drei Einträge: `basketball`, `gewichtheben`, `hockey`. **Die anderen 17 Disziplinen rechnen in
Chris' echtem Spielstand weiter über `legacy-matchday-resolve-engine.ts`** — den alten
PPS-Rangpfad, der von den Motoren, Rezepten und Rangtreue-Runden der letzten drei Wochen nichts
weiß.

Das heißt konkret: **elf Disziplinen haben die 0,80-Schranke bestanden, und keine einzige davon
außer Gewichtheben zahlt in Chris' Saison ein.** Speed-Schach 0,889, Staffel 0,915, Takeshi 0,886,
Showcase 0,880, Spurt 0,871, Time-Trial 0,867, Wettessen, Fechten, Tennis, Breaking — alle im
Mockup, alle unsichtbar im Spielstand.

Der Code ist ausdrücklich dafür gebaut. Der Kommentar über der Menge sagt es wörtlich: jede
weitere Disziplin ist „eine reine Konfigurationsänderung (Eintrag plus eigene PPS-Referenz/
Kurvenkonstanten)". Hockey hat das am 04.09. bewiesen — ohne eine einzige Zeile Optik.

**Das ist der Punkt, an dem drei Wochen Rangtreue-Arbeit im Spiel ankommen oder nicht.**

---

## 5. Bewertung der vier genannten Folgeaufträge

| Auftrag | Aufwand | Nutzen | Risiko für rho | Art |
|---|---|---|---|---|
| **A — Verletzungen bei Chaos-Aktionen** (Tackle/Push, Fatigue-gekoppelt, Stats −50 % wie `lib/fatigue/fatigue-injury-service.ts`) | mittel–groß | mittel | **hoch** | Fable-Recherche |
| **B — Manager-einstellbarer Spielstil je Spieler** | klein (Arena) / groß (übrige) | hoch | niedrig | Recherche + Chris-Entscheidung |
| **C — Keine Kurs-Wiederholung in einer Saison** | klein | klein–mittel | keins | Umsetzung, **aber erst nach #813** |
| **D — Multiplayer Chris + Franky** | sehr klein | **sehr hoch** | keins | **Chris-Aktion am Server** |

**Zu A (Verletzungen).** Der teuerste und riskanteste der vier. Eine In-Race-Verletzung ist genau
das, woran Hockeys Zoneneintritt gescheitert ist: **ein neuer `rr()`-Wurf im Tick-Loop**, der die
gesamte RNG-Kaskade verschiebt und jede Vorher/Nachher-Messung unbrauchbar macht. Dazu koppelt
sie zwei Systeme, die heute getrennt sind (Saison-Fatigue in TypeScript, Rennen im Mockup-Motor).
Und ein −50 %-Malus mitten im Rennen ist eine **Rangtreue-Waffe**: er bestraft den Getroffenen
unabhängig von seiner Eignung. Takeshi steht bei 0,886 mit einer Spannweite von 0,073 — das ist
der schmalste Puffer aller Bestandenen. Empfehlung: **nicht jetzt**, und wenn, dann als Recherche
mit ausdrücklichem rho-Korridor und n ≥ 96 vor jedem Commit.

**Zu B (Spielstil).** Der Auftrag unterschätzt, was schon da ist, und zielt auf die falsche Datei.
`lib/foundation/team-strategy-profiles.ts` ist ein **Transfer**-Profil (buyStyle, sellStyle,
contractStyle, Archetyp-Präferenzen) — Vorderbüro, nicht Taktik. Der richtige Anker ist der Motor:
`PERS` / `PERSDEF` / `PERSZIEL` / `PERSORD` (`battle-mode.engine.js:3357–3427`) führen bereits
sieben Persönlichkeiten (Bollwerk, Draufgänger, Duellant, Opportunist, Beschützer, Schleicher,
Taktiker), abgeleitet aus Klasse/Rasse/Subklasse/Traits, jede mit Haltung, Zielwahl und Bindung.
**Und es gibt bereits eine UI dafür**: Z. 12311 setzt `takt[p.n][key]` per `<select>` und
rendert neu. Was fehlt, ist (a) Persistenz in den Spielstand statt nur im Mockup-Speicher und
(b) Ausdehnung auf Bühne/Bahn/Feldspiel, wo `u.pers` heute nur an zwei Stellen gelesen wird
(Z. 15626, 16040). Damit ist B für die Arena **klein** und für den Rest ein eigenes Vorhaben.
Nebenbefund mit eigenem Wert: `PERSZIEL` führt für den Duellanten schon `ziel:"bedrohung"` — die
Zielwahl-nach-Bedrohung, die als größter Arena-Hebel dokumentiert ist, existiert als Option und
ist nur nicht Standard.

**Zu C (Kurs-Wiederholung).** Sauber begrenzt, aber **heute nicht baubar**: die drei Takeshi-Kurse
gibt es auf `main` nicht (`grep` nach „Nordhof"/„Sumpfpfad" ist leer) — sie kommen erst mit #810,
das in #813 steckt. Vorher gibt es nichts, dessen Wiederholung man verhindern könnte. Zweitens
liegt die Kurswahl **im Motor an der Renn-Saat**, nicht in `season-discipline-schedule.ts` (dort
gibt es keinen Kurs-Begriff). Der Auftrag ist richtig gedacht, aber in der Reihenfolge falsch
eingehängt. Er gehört außerdem sachlich zu demselben Ort wie der `buildSeasonPlayerCount`-Fund —
beides ist „was der Saisonplan je Disziplin würfelt".

**Zu D (Multiplayer).** Der mit Abstand beste Nutzen-pro-Aufwand der Liste, und der einzige, den
**Chris aktiv erfragt hat**. Gebaut und CI-geprüft ist alles; produktiv fehlt nur der Schalter
(`deploy/hetzner/README.md`, Abschnitt „Login aktivieren"): vier Variablen in
`deploy/hetzner/.env`, ein `docker compose up -d --build`. Solange `OLY_AUTH_ENABLED` aus ist,
weiß der Server nicht, wer spielt, und Franky sieht Chris' Teams. Das ist kein rho-Thema — aber es
ist das einzige Thema auf dieser Liste, bei dem am Ende ein *Mensch mehr* am Spiel sitzt.

---

## 6. Empfehlung: die nächsten fünf Schritte, in dieser Reihenfolge

### 1. Basislinie neu ziehen und Stand-Doku nachziehen 🔴
**Warum jetzt:** Drei Tage Gewinne (Staffel, Takeshi, Spurt, Football) sind ungesichert; die
Doku führt zwei bestandene Disziplinen als durchgefallen und lenkt damit jede Priorisierung
falsch. **Aufwand:** klein (¼ Tag). **rho-Risiko:** keins, reine Messgrundlage. **Art:** direkte
Umsetzung. **Abnahme:** `node scripts/baue-rangtreue-basislinie.mjs 24`, danach
`scripts/pruefe-rangtreue-schranke.mjs` grün; Tabelle in Abschnitt 1 dieses Briefings als Vorlage.
*Wenn #813 kurz vor dem Merge steht, danach machen — sonst zweimal.*

### 2. Multiplayer scharf schalten (Chris + Franky) 🟢
**Warum jetzt:** Chris hat danach gefragt, es ist gebaut, es ist CI-geprüft, und es ist der
einzige Punkt der Liste, der das Produkt statt der Zahlen verbessert. **Aufwand:** sehr klein
(vier Zeilen `.env` + Redeploy + eine begleitete Sitzung). **rho-Risiko:** keins. **Art:**
**Chris-Aktion am Server** — Agenten kommen nicht heran. Danach eine echte Sitzung zu zweit als
Abnahme, nicht die CI. **Risiko dabei:** mit aktivem Login greifen Pfade, die im Alltag bisher
aus waren (Sitzungs-`ownerId` in `room-store.ts`, `server-authoritative-write-guard.ts`) — eine
Sicherung des Spielstands vorher ist Pflicht.

### 3. Produktivierungswelle: die bestandenen Bühnen- und Bahn-Disziplinen live schalten 🔴
**Warum jetzt:** elf Disziplinen sind über der Schranke, drei sind im Spiel. Das ist der größte
Abstand zwischen geleisteter Arbeit und Chris' Erlebnis im ganzen Projekt — und laut Code-Kommentar
je Disziplin eine reine Konfigurationsänderung plus eigene PPS-Referenz. Hockey hat den Weg am
04.09. bewiesen. **Aufwand:** mittel (je Disziplin klein, aber Referenzziehung und Korridorprüfung
je Disziplin; sinnvoll in Wellen zu dritt). **rho-Risiko:** keins am Motor — aber das
Pp-Verhalten im Spielstand ändert sich sichtbar, also erst gegen ein `live-save`-Abbild
gegenprüfen (`OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite`). **Art:** Umsetzung, mit **einer
Chris-Vorentscheidung**: welche Reihenfolge, und ob mitten in der laufenden Saison oder zum
Saisonwechsel.

### 4. Wertungstabelle Welle 2 + die drei Kleinstfunde 🟠
**Warum jetzt:** Es ist der unerledigte Rest eines Auftrags, den Chris in Großbuchstaben gestellt
hat („IMMER nutzen"), und er betrifft ausgerechnet die drei Disziplinen, die **wirklich live sind**.
Football zeigt heute fünf von sechs Zeilen leer. Dazu die drei Kleinstfunde aus 2b (Ticker „0:66",
TDM-Text im Time-Trial, Endstand-Punkte für Staffel/Takeshi). **Aufwand:** klein–mittel, alles
Anzeige. **rho-Risiko:** keins (Welle 1 war beweisbar bit-identisch; dasselbe Muster). **Art:**
direkte Umsetzung. **Zugabe:** die im Plan beschriebene Abnahme-Sonde als
`scripts/sonde-wertungstabelle.mjs` einchecken, damit das nicht wieder still zurückfällt.

### 5. Saisonplan-Auslosung: `buildSeasonPlayerCount` + Kurswahl in einem Auftrag 🟠
**Warum jetzt:** Zwei Befunde, ein Ort, eine Chris-Frage. Heute wird die konfigurierte Basisgröße
jeder Disziplin **nie gespielt** — betrifft alle zwanzig, nicht nur Takeshi. Die Kurs-Wiederholung
(Folgeauftrag C) ist derselbe Themenkreis und gehört in denselben Auftrag, sobald #813 gemergt ist.
**Aufwand:** klein. **rho-Risiko:** indirekt relevant — wir messen bei sechs je Seite, gespielt
werden 2–6; die Bahnen sind bei 2/3/5 nachgemessen (0,86–0,92), die Bühnen **nicht**. **Art:**
erst **Chris-Entscheidung** („Basis ± 1" oder „2–6 ohne Basis"?), dann Umsetzung.

### Bewusst NICHT auf dieser Liste

- **Arena (TDM/Mini-DM/Battlefield)** — dokumentiert als „größter ungehobener Hebel", aber bei einer
  Kader-Spannweite größer als der eigene Median ist jede Runde unbeweisbar. Vorstufe wäre eine
  Messmethode, die für die Arena trägt (n ≥ 96–150), nicht ein Rezept. Das ist ein eigener,
  ehrlicher Auftrag — und er sollte vor dem Rezept kommen, nicht danach.
- **In-Race-Verletzungen (A)** — s. 5; hohes rho-Risiko bei geringem sichtbaren Gewinn, und Takeshi
  hat den schmalsten Puffer aller Bestandenen.
- **PR #813** — Review ist bereits vergeben.
- **Football-Matrix** — von Chris ausdrücklich gesperrt („die Gewichtungsmatrix darf nicht verändert
  werden!"). Was stattdessen offen ist, ist die **Design-Frage aus 3**: Anzeige und Spiel ordnen
  Football verschieden. Die gehört Chris, nicht einer weiteren Rezeptrunde.

---

## 7. Methodik und Grenzen

- Alle zwanzig Zeilen in Abschnitt 1 sind heute an `6da7f9f5` gemessen, in zwei Läufen
  (`miss-alle-disziplinen.mjs 24 <liste>`), zusammengesetzt. Kein Wert stammt aus einem Dokument.
- PR #813 ist **nicht** gemessen und **nicht** gelesen worden — die Takeshi-Zahl 0,886 ist der Stand
  **ohne** #813.
- Nicht geprüft: ob die elf bestandenen Disziplinen bei den Kadergrößen 2/3/4/5 ebenfalls bestehen
  (für die Bahnen liegt das vor, für die Bühnen nicht) — s. Schritt 5.
- Nicht geprüft: der tatsächliche Zustand des Room-Flows gegen den **Produktionsserver**. Geprüft
  ist nur, dass er in der CI grün ist.

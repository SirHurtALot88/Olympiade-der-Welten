/**
 * DIE EINE SEED-NORMALISIERUNG DER ARENA (A3, docs/pm-briefings/
 * opus-synthese-echtzeit-vs-rundenbasiert-19-09.md Abschnitt 5.3 / opus-synthese-
 * universelles-kampfmodell-20-09.md Abschnitt 4.3 — "Was Chris zuschaut, ist nicht das
 * Spiel, das gezählt hat").
 *
 * ZWEI AUFRUFER, ZWEI LAUFZEITEN, EINE FUNKTION:
 *   - `lib/battle/arena-headless-runner.ts` (Node/Playwright) — rechnet den Spieltag
 *     headless zu Ende und bucht damit das ZAEHLENDE Ergebnis.
 *   - `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` ("use client", Browser-
 *     Bundle) — zeigt den Kampf Chris beim Zuschauen live an.
 * Vor A3 kannte NUR der erste Aufrufer ueberhaupt eine Saat (`grep -in 'saat|seed'
 * FoundationBattleArenaHost.tsx` fand null Treffer) — der Host wuerfelte beim Aufbau
 * faktisch neu (`build()` ohne Argument in battle-mode.engine.js faellt auf die feste
 * Ersatzsaat 1337 zurueck, s. dortiger `normalisiereSaat()`-Kommentar). Diese Datei ist
 * bewusst der EINZIGE Ort fuer die Hash-Funktion und den Seed-String-Bau, damit beide
 * Aufrufer importieren statt zu duplizieren:
 *
 *   - `seedZuZahl()` ist BYTE-IDENTISCH zu der Funktion, die vor A3 nur lokal in
 *     `arena-headless-runner.ts` stand (dort seit PR6 unveraendert) — hierher verschoben,
 *     NICHT umgeschrieben, damit ein Client-Bundle sie importieren kann, ohne
 *     `arena-headless-runner.ts`s Playwright-/`node:fs`-Importe mitzuziehen (die wuerden
 *     einen Client-Build brechen). `arena-headless-runner.ts` importiert sie jetzt von
 *     hier zurueck, s. dortiger Kommentar.
 *   - `buildArenaMatchSeed()` ist ebenso byte-identisch zur bisherigen Definition in
 *     `lib/resolve/battle-mode-arena-team-points.ts` (WEG-B-Disziplin im Seed, s. dortiger
 *     ausfuehrlicher Kommentar) — diese Datei re-exportiert sie von hier, damit bestehende
 *     Importe (`@/lib/resolve/battle-mode-arena-team-points`) unveraendert weiterlaufen,
 *     waehrend der Host sie direkt von hier zieht, ohne die ~15 PPS-Referenz-JSONs jener
 *     Datei in den Client-Bundle zu ziehen (dort nur Bequemlichkeit, hier vermeidbares
 *     Gewicht).
 *
 * WARUM DAS WICHTIG IST (Chris' eigener Massstab, s. CLAUDE.md "Kader auffuellen"-Abschnitt
 * und die Formkarten-/Eignungsluecken-Funde): zwei Implementierungen, die heute
 * uebereinstimmen, aber unabhaengig voneinander gepflegt werden, sind genau die Bugklasse,
 * die dieses Projekt zweimal teuer erwischt hat (Formkarten-LCG-Bits, `p.d`-Eignungsluecke
 * in allen vier Chassis). Eine dritte Instanz wird hier bewusst vermieden.
 */
export function seedZuZahl(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed;
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministischer Seed pro Duell — Plan (Abschnitt 3.3c) plus `disciplineId` (WEG B,
 * N-Team-Infrastruktur-Audit 13.09., Chris' Entscheidung 15.09.). `seedZuZahl()` haesht
 * einen Text-Seed selbst in eine Zahl um, diese Funktion muss also NICHT selbst hashen.
 *
 * Voller Herleitungs-Kommentar (WEG-B-Notwendigkeit von `disciplineId`) steht bei der
 * re-exportierenden Stelle in `lib/resolve/battle-mode-arena-team-points.ts` — hier nur
 * die Implementierung, damit beide Aufrufer exakt denselben String bauen.
 */
export function buildArenaMatchSeed(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  disciplineId: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  return `${input.saveId}:${input.seasonId}:${input.matchdayId}:arena:${input.disciplineId}:${input.homeTeamId}:${input.awayTeamId}`;
}

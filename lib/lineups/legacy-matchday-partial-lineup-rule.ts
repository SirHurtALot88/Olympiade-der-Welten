/**
 * Owner decision (2026-07, replaces the old `LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7` hard floor):
 * "wenn ein team nur 5 spieler hat kann es diese ja auch einsetzen und wenn alle Spieler
 * eingesetzt sind die das team zur Verfügung hat ist es auch grün" — a team must be allowed to
 * field however many available (uninjured, on-roster) players it has. A lineup that uses ALL of
 * a team's available players counts as complete/ready, even if that is fewer than the discipline
 * slots require — 5, 3, whatever is left.
 *
 * There is NO hard floor below which a matchday is blocked anymore. The previous floor made the
 * season stall permanently (`resolve_status:incomplete_lineups`) once a team's roster oscillated
 * near it, and — combined with `FIXED_ROSTER_MIN = 8` — meant only ONE injury per team per
 * matchday could ever be tolerated before the gate slammed shut. Do not reintroduce a floor here.
 *
 * Empty slots that genuinely cannot be filled must degrade the team's score naturally (fewer
 * scoring players => a worse result) — that is the intended sporting penalty. This helper only
 * decides whether a SHORT lineup (fewer selected players than the discipline slots require)
 * should be treated as "complete" for readiness/apply purposes. It never invents players, slots,
 * or score compensation.
 *
 * Single source of truth: shared by `lib/resolve/legacy-matchday-readiness.ts`,
 * `lib/resolve/legacy-matchday-resolve-engine.ts`, and `lib/lineups/legacy-matchday-readiness.ts`
 * so the readiness/preview path and the result-apply path can never diverge on this rule again
 * (a prior divergence here once caused every team to be written as `invalid_lineup`).
 */
/**
 * GEZAEHLT WIRD, WER AUFGESTELLT **UND** NOCH VERFUEGBAR IST.
 *
 * Das Feld hiess `selectedPlayerCount` und trug die ROHE Zahl der Namen im Entwurf. Sobald ein
 * aufgestellter Spieler waehrend des Spieltags ausfiel, war die Regel unerfuellbar:
 *
 *   Ein Team mit 9 verfuegbaren Spielern stellt alle 9 auf (gefordert waeren 12) -> vollstaendig.
 *   In D1 verletzt sich einer. Der abgegebene Entwurf nennt weiterhin 9 Namen, verfuegbar sind
 *   noch 8. Die Regel verglich 9 mit 8 -> NICHT vollstaendig, und zwar fuer immer.
 *
 * Folge: D1 war gebucht, D2 galt dauerhaft als `resolve_status:incomplete_lineups`. Die Arena
 * kommt aus diesem Zustand nicht heraus — sie ueberschreibt bestehende Aufstellungen bewusst
 * nicht (sonst wuerde sie andere Aufstellungen buchen als die, gegen die gerade gespielt wurde)
 * und laesst Warn-Aufstellungen bewusst nicht zu. Der Spieltag haengt in Disziplin 2, ohne
 * Ausweg auf dem Schirm.
 *
 * Die Absicht der Regel war nie die rohe Zahl, sondern: „das Team setzt alle ein, die es hat".
 * Ein Verletzter ist keiner, den es hat. Verglichen wird deshalb die Schnittmenge aus
 * Aufgestellten und Verfuegbaren.
 *
 * Die Namen der Ausgefallenen bleiben im Entwurf stehen — das ist richtig so: sie belegen, wer
 * aufgestellt WAR, und die bereits gebuchte D1 rechnet mit ihnen weiter (siehe #505, wo genau
 * dieses Herausfiltern die Disziplinwerte der D1 zerstoert hatte).
 */
export function isPartialLineupComplete(input: {
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  selectedAvailablePlayerCount: number;
}): boolean {
  return (
    input.activePlayersCount < input.requiredTotalUniquePlayers &&
    input.selectedAvailablePlayerCount === input.activePlayersCount
  );
}

/**
 * Die Schnittmenge aus „steht im Entwurf" und „kann heute spielen" — einmal geschrieben, damit
 * die drei Aufrufer (Resolve-Vorschau, Resolve-Readiness, Aufstellungs-Readiness) sie nicht je
 * einzeln nachbauen und dabei auseinanderlaufen.
 */
export function countSelectedAvailablePlayers(
  selectedPlayerIds: Iterable<string>,
  availablePlayerIds: Iterable<string>,
): number {
  const verfuegbar = new Set(availablePlayerIds);
  const getroffen = new Set<string>();
  for (const playerId of selectedPlayerIds) {
    if (verfuegbar.has(playerId)) {
      getroffen.add(playerId);
    }
  }
  return getroffen.size;
}

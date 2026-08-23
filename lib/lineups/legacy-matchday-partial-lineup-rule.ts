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
/**
 * ZWEITE HAELFTE DESSELBEN FEHLERS: Spieler fallen nicht nur AUS, sie kommen auch ZURUECK.
 *
 * CHRIS: „wir haben doch wieder das D2 problem an MD10!!! … an MD8 schon gehabt und haengt jetzt
 * wieder. Was ist das denn fuer ein Blocker der immer wieder greift?"
 *
 * Nachgemessen an seinem Spielstand (season-1, matchday-10): genau EIN Team blockierte, V-W.
 *
 *   Beim Sperren der Aufstellung : 8 verfuegbar, alle 8 aufgestellt -> vollstaendig.
 *   Waehrend D1                  : King Arlen Morgolor und Evie fallen aus.
 *   Ebenfalls waehrenddessen     : Xelara wird wieder spielfaehig.
 *   Danach                       : 7 verfuegbar, davon 6 im Entwurf.
 *
 * Die Regel verglich 6 mit 7 und urteilte „nicht vollstaendig" — dauerhaft. Xelara kann nicht mehr
 * in den Entwurf: er ist `locked`, D1 ist gebucht, und die Arena ueberschreibt eine gesperrte
 * Aufstellung bewusst nicht (sonst buchte sie andere Aufstellungen als die, gegen die gespielt
 * wurde). Ein Blocker ohne Ausweg ist kein Schutz, sondern ein Stillstand.
 *
 * Der Kommentar oben beschreibt die Reparatur fuer die eine Richtung (Aufgestellte fallen aus, die
 * Schnittmenge faengt das ab). Die andere Richtung fehlte: wird jemand NACH dem Sperren wieder
 * spielfaehig, waechst `activePlayersCount`, waehrend der Entwurf nicht mehr wachsen kann.
 *
 * CHRIS' ENTSCHEIDUNG, und die geht weiter als der Einzelfall: „verletzungen duerfen ein lineup
 * niemals blockieren erst recht nicht beim scoring da ist der spieltag ja schon gelaufen und
 * spieler aus D1 sind eh nie in D2 drin! deswegen ist der blocker einfach quatsch".
 *
 * BEIDES NACHGEPRUEFT, BEIDES STIMMT. An V-W, matchday-10:
 *
 *   D1 (bereits gebucht): Jorund, Midorina, [King Arlen Morgolor], Lulu, [Evie]   <- beide Ausfaelle
 *   D2 (haengt):          Patience, Scorpion King, XR-KAROT-01                     <- alle drei fit
 *   Spieler in BEIDEN Disziplinen: 0
 *
 * DIE DISJUNKTHEIT IST STRUKTURELL, NICHT ZUFALL (Chris: „D1 und D2 finden in der logik parallel
 * statt deswegen KANN ein spieler gar nicht in beiden gleichzeitig antreten"). Ein Ausfall in D1
 * kann die D2-Aufstellung also nie betreffen — er kann ihr nicht einmal einen Spieler nehmen.
 *
 * D2 wurde also von Verletzungen blockiert, die in D1 passiert sind, bei Spielern, die in D2 gar
 * nicht antreten. Die Regel misst `activePlayersCount` und `requiredTotalUniquePlayers` ueber BEIDE
 * Disziplinen zusammen, obwohl die Seiten disjunkt besetzt und getrennt gewertet werden — ein
 * Ausfall in D1 senkt damit die Zahl, an der D2 gemessen wird.
 *
 * ZWEI BEDINGUNGEN, DIE DAS SCHLIESSEN:
 *
 * 1. EIN GESPERRTER ENTWURF WIRD NICHT MEHR AN DER VERFUEGBARKEIT GEMESSEN. Er kann sich nicht mehr
 *    aendern — die Arena ueberschreibt ihn bewusst nicht, sonst buchte sie andere Aufstellungen als
 *    die, gegen die gespielt wurde. Eine Forderung, die niemand mehr erfuellen kann, ist kein
 *    Schutz, sondern ein Stillstand. Fehlende Spieler bestrafen sich ohnehin selbst: weniger
 *    Wertende, schlechteres Ergebnis — genau die sportliche Strafe, die der Kopf dieser Datei als
 *    gewollt beschreibt.
 *
 * 2. SOLANGE DER ENTWURF OFFEN IST, bleibt die Forderung — aber verglichen wird jetzt die Zahl der
 *    AUFGESTELLTEN gegen die der Verfuegbaren. Wer mindestens so viele Namen aufgestellt hat, wie er
 *    verfuegbare Spieler hat, hat nicht zu wenige aufgestellt; die Differenz ist Fluktuation.
 *    Nebenwirkung, und sie ist erwuenscht: eine Verletzung SENKT `activePlayersCount` und macht die
 *    Bedingung damit leichter erfuellbar. Verletzungen koennen so nicht mehr blockieren, in keiner
 *    Richtung.
 *
 * WAS WEITERHIN BLOCKIERT: ein offener Entwurf, in dem schlicht zu wenige stehen — 3 Namen bei 11
 * Verfuegbaren bleiben 3 < 11. Und ein fehlender Entwurf ist ohnehin ein eigener Status
 * (`missing_lineup`). Die Sperre gegen halb gesetzte Aufstellungen bleibt also erhalten; weg faellt
 * nur der Fall, in dem es keinen Ausweg gibt.
 */
export function isPartialLineupComplete(input: {
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  selectedAvailablePlayerCount: number;
  /** Alle im Entwurf genannten Spieler, auch die inzwischen ausgefallenen. */
  selectedPlayerCount?: number;
  /** Gesperrter Entwurf — nach dem Sperren ist keine Aenderung mehr moeglich. */
  istGesperrt?: boolean;
}): boolean {
  if (input.activePlayersCount >= input.requiredTotalUniquePlayers) return false;
  if (input.istGesperrt) return true;
  if (input.selectedAvailablePlayerCount === input.activePlayersCount) return true;
  return (input.selectedPlayerCount ?? 0) >= input.activePlayersCount;
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

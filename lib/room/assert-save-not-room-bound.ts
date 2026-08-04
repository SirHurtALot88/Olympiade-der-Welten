import { getActiveRoomBySaveId } from "@/lib/room/room-store";

/**
 * HARTER Schreib-Stopp fuer Admin-/KI-/Simulationswerkzeuge auf einem raumgebundenen Save.
 *
 * WARUM DAS EIN EIGENER, HARTER GUARD IST UND KEIN FALL FUER `authorizeServerRoomWrite`:
 *
 * `authorizeServerRoomWrite` beantwortet "darf DIESER Teilnehmer DIESES Team beschreiben" —
 * es kennt Team-Besitz, Host-Level-Aktionen und einen Sandbox-Host-Override
 * (`server-authoritative-write-guard.ts:225-233`). Die Werkzeuge hier (Saison-Simulation,
 * Season-Start-Reset, KI-Picks-Import/-Audit-Reset, Season-Snapshot) sind aber keine
 * Team-Aktionen — sie kennen gar kein `teamId`, sie ersetzen ganze Saison-/Save-Zustaende auf
 * einen Schlag. Fuer so ein Werkzeug gibt es in einem laufenden Koop-Raum keine sinnvolle
 * Autorisierungsfrage ("darf Host X das tun?"), weil das Werkzeug selbst mit einem laufenden
 * Zwei-Spieler-Raum unvertraeglich ist: es springt Spieltage/Saisons vor, tauscht Kader aus oder
 * ersetzt Snapshots, ohne Ready-Gates zu pruefen, Team-Besitz zu respektieren oder
 * `notifyRoomGameplayWrite` auszuloesen. Der gemeldete Unfall war genau das: ein Klick auf
 * "Saison simulieren" schob den Stand auf Saisonende, waehrend der Mitspieler noch Spieltag 3
 * sah — kein Fehler in der Team-Autorisierung, sondern ein Werkzeug, das am ganzen Koop-Modell
 * vorbeischreibt (docs/design/coop-absicherung.md, Risiko R4).
 *
 * DESHALB KEIN HOST-SONDERWEG. Man koennte versucht sein, dem Host ("der hat doch das Recht,
 * seinen eigenen Raum zu verwalten") einen Override zu geben — aber der Host ist nicht allein im
 * Raum. Season-Simulation & Co. veraendern Spieltag, Kader und Kasse fuer ALLE Teilnehmer
 * gleichzeitig, nicht nur fuer den Host. Ein Host-Override wuerde genau den gemeldeten Unfall
 * wieder erlauben, nur "mit Absicht" statt aus Versehen. Diese Werkzeuge sind fuer Solo-Saves
 * und Entwicklung/QA gebaut; sobald ein Save an einen aktiven Raum gebunden ist, gibt es fuer sie
 * keinen sicheren Ausfuehrungspfad — nur einen sauberen Fehler.
 *
 * KEINE ZUSAETZLICHE SANDBOX-AUSNAHME: `isSandboxLikeSave`/`isSandboxRoomSave`
 * (server-authoritative-write-guard.ts:82-84, room-flow-controller.ts:116-118) lockern die
 * PER-TEAM-Pruefung fuer Test-/Sandbox-Raeume, aendern aber nichts an der Raum-BINDUNG selbst:
 * `getActiveRoomBySaveId` liefert fuer einen Save ohne aktiven Raum ohnehin `null` — ein
 * Sandbox-Save ohne Raum passiert diese Pruefung also automatisch. Ist ein Sandbox-Save
 * TATSAECHLICH an einen laufenden Raum gebunden (z. B. ein Coop-Test mit zwei echten
 * Sitzungen), gilt exakt dasselbe Argument wie oben: ein zweiter Teilnehmer kann im Raum sein,
 * und "sandbox" im Save-Namen aendert daran nichts. Eine Ausnahme hier wuerde nur den Fall
 * verstecken, den dieser Guard eigentlich zeigen soll.
 */
export type SaveNotRoomBoundResult =
  | { blocked: false }
  | {
      blocked: true;
      status: 409;
      /** Maschinenlesbar, im Stil der bestehenden Guard-Reasons; `<werkzeug>` identifiziert den Aufrufer. */
      reason: `admin_write_blocked_room_bound_save:${string}`;
      roomCode: string;
    };

/**
 * Prueft, ob `saveId` an einen aktiven Koop-Raum gebunden ist, und lehnt in diesem Fall hart ab.
 *
 * Aufrufer stellen sicher, dass diese Pruefung VOR jedem tatsaechlichen Schreibvorgang laeuft —
 * Preview-/Dry-Run-Zweige, die nie persistieren, muessen sie nicht aufrufen (siehe Kommentare an
 * den jeweiligen Routen fuer den genauen Aufrufpunkt).
 */
export function assertSaveNotRoomBound(saveId: string, werkzeug: string): SaveNotRoomBoundResult {
  const activeRoom = getActiveRoomBySaveId(saveId);
  if (!activeRoom) {
    return { blocked: false };
  }
  return {
    blocked: true,
    status: 409,
    reason: `admin_write_blocked_room_bound_save:${werkzeug}`,
    roomCode: activeRoom.roomCode,
  };
}

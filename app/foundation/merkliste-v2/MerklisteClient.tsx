"use client";

import { formatNlNumber } from "@/components/foundation/new-look";
import type { MerklistenAnsicht } from "@/lib/merkliste/merkliste-ansicht";

/**
 * DIE MERKLISTE ZUM NACHSCHAUEN.
 *
 * GEWUENSCHT (Chris): „man sollte sich aussuchen können welche teams getrackt werden, dass man so
 * ne wishlist option bei teams und spielern hat wie so lesezeichen und sich die dann noch mal
 * angucken kann".
 *
 * Der letzte Halbsatz ist diese Ansicht. Sie zeichnet nur — was drinsteht und in welcher
 * Reihenfolge, entscheidet `baueMerklistenAnsicht` (lib/merkliste/merkliste-ansicht.ts), damit es
 * ohne React pruefbar bleibt.
 *
 * KEINE LEERE TABELLE. Ist nichts gemerkt, steht hier ein Satz, der sagt, wo man Sterne setzt —
 * dieselbe Regel, an der die alten leeren Kaesten auf der Arena-Tafel gescheitert sind.
 */
export type MerklisteClientProps = {
  ansicht: MerklistenAnsicht;
  onOpenTeam?: (teamId: string) => void;
  onOpenPlayer?: (playerId: string) => void;
  /** Nimmt einen Eintrag wieder von der Liste. Fehlt der Rueckruf, erscheint kein Stern. */
  onEntfernenTeam?: (teamId: string) => void;
  onEntfernenSpieler?: (playerId: string) => void;
};

function EntfernenStern({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) {
    return null;
  }
  return (
    <button type="button" className="nl-merk-stern is-gemerkt" onClick={onClick} aria-pressed title={label}>
      ★
    </button>
  );
}

export default function MerklisteClient({
  ansicht,
  onOpenTeam,
  onOpenPlayer,
  onEntfernenTeam,
  onEntfernenSpieler,
}: MerklisteClientProps) {
  return (
    <div className="merkliste-view" data-testid="merkliste-view">
      <div className="merkliste-head">
        <div>
          <span className="merkliste-eyebrow">Merkliste</span>
          <h2 className="merkliste-title">Was du im Auge behältst</h2>
          <p className="merkliste-sub">
            Gemerkte Teams stehen zusätzlich zu den menschlich geführten vor jedem Spieltag in der
            Arena. Die Liste gehört dir allein — im Koop führt jeder seine eigene.
          </p>
        </div>
        <span className="merkliste-count nl-tnum">
          {ansicht.gesamt === 1 ? "1 Eintrag" : `${formatNlNumber(ansicht.gesamt, 0)} Einträge`}
        </span>
      </div>

      {ansicht.gesamt === 0 ? (
        <p className="merkliste-leer">
          Noch nichts gemerkt. Der Stern neben einem Teamnamen oder neben einem Spieler in der
          Kadertabelle legt einen Eintrag an — hier findest du ihn wieder.
        </p>
      ) : null}

      {ansicht.teams.length > 0 ? (
        <section className="merkliste-block" aria-label="Gemerkte Teams">
          <h3 className="merkliste-block-title">
            Teams <span className="merkliste-block-count nl-tnum">{formatNlNumber(ansicht.teams.length, 0)}</span>
          </h3>
          <div className="merkliste-scroll">
            <table className="nl-tnum">
              <thead>
                <tr>
                  <th className="is-num">Saisonrang</th>
                  <th>Team</th>
                  <th className="is-num">Punkte</th>
                  <th aria-label="Von der Merkliste nehmen" />
                </tr>
              </thead>
              <tbody>
                {ansicht.teams.map((zeile) => (
                  <tr
                    key={zeile.teamId}
                    onClick={onOpenTeam && !zeile.fehlt ? () => onOpenTeam(zeile.teamId) : undefined}
                    style={onOpenTeam && !zeile.fehlt ? { cursor: "pointer" } : undefined}
                    title={onOpenTeam && !zeile.fehlt ? `${zeile.name} öffnen` : undefined}
                  >
                    <td className="is-num">{zeile.rank != null ? zeile.rank : "—"}</td>
                    <td>
                      {zeile.name} · {zeile.code}
                      {zeile.fehlt ? <span className="merkliste-fehlt">nicht mehr im Spielstand</span> : null}
                    </td>
                    <td className="is-num">{zeile.points != null ? formatNlNumber(zeile.points, 1) : "—"}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <EntfernenStern
                        label={`${zeile.name} von der Merkliste nehmen`}
                        onClick={onEntfernenTeam ? () => onEntfernenTeam(zeile.teamId) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {ansicht.spieler.length > 0 ? (
        <section className="merkliste-block" aria-label="Gemerkte Spieler">
          <h3 className="merkliste-block-title">
            Spieler <span className="merkliste-block-count nl-tnum">{formatNlNumber(ansicht.spieler.length, 0)}</span>
          </h3>
          <div className="merkliste-scroll">
            <table className="nl-tnum">
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th>Klasse</th>
                  <th>Team</th>
                  <th aria-label="Von der Merkliste nehmen" />
                </tr>
              </thead>
              <tbody>
                {ansicht.spieler.map((zeile) => (
                  <tr
                    key={zeile.playerId}
                    onClick={onOpenPlayer && !zeile.fehlt ? () => onOpenPlayer(zeile.playerId) : undefined}
                    style={onOpenPlayer && !zeile.fehlt ? { cursor: "pointer" } : undefined}
                    title={onOpenPlayer && !zeile.fehlt ? `${zeile.name} öffnen` : undefined}
                  >
                    <td>
                      {zeile.name}
                      {zeile.fehlt ? <span className="merkliste-fehlt">nicht mehr im Spielstand</span> : null}
                    </td>
                    <td>{zeile.className ?? "—"}</td>
                    {/* Vertragslos ist kein Fehler, sondern ein Zustand — deshalb ein eigenes Wort
                        und nicht derselbe Gedankenstrich wie bei einer fehlenden Angabe. */}
                    <td>{zeile.teamName ?? (zeile.fehlt ? "—" : "ohne Team")}</td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <EntfernenStern
                        label={`${zeile.name} von der Merkliste nehmen`}
                        onClick={onEntfernenSpieler ? () => onEntfernenSpieler(zeile.playerId) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import { figurPoseUrl, getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { wirkungMitKandidat, type TeamVorbereitung } from "@/lib/market/transfermarkt-kaderstaerke";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { MARKT_ACHSEN, type SpielerSicht } from "@/lib/market/transfermarkt-sicht";

import { betragC, de, jeSpieltag, rangText } from "./tm-format";

type Zeile = { item: TransfermarktFreeAgentItem; sicht: SpielerSicht };

type ReihenDef = {
  schluessel: string;
  gruppe?: string;
  label?: string;
  /** Wert, nach dem der „beste" bestimmt wird (nur sichtbare Größen). `null` = nicht vergleichbar. */
  zahl?: (z: Zeile) => number | null;
  besser?: "hoch" | "tief";
  text?: (z: Zeile) => string;
  balken?: (z: Zeile) => number | null;
  rang?: (z: Zeile) => ReturnType<typeof wirkungMitKandidat> | null;
  disziplinId?: string;
};

export default function VergleichDialog(props: {
  zeilen: Zeile[];
  disziplinIds: string[];
  disziplinNamen: Record<string, string>;
  vorbereitung: TeamVorbereitung;
  disziplin: string;
  kulisse: string | null;
  cash: number | null;
  onEntfernen: (id: string) => void;
  onVerhandeln: (id: string) => void;
  onSchliessen: () => void;
}) {
  const { zeilen, disziplinIds, disziplinNamen } = props;
  const reihen: ReihenDef[] = [
    { schluessel: "g-kosten", gruppe: "Kosten" },
    { schluessel: "abloese", label: "Ablöse", zahl: (z) => z.item.marketValue, besser: "tief", text: (z) => betragC(z.item.marketValue) },
    { schluessel: "saison", label: "Gehalt je Saison", zahl: (z) => z.item.salary, besser: "tief", text: (z) => betragC(z.item.salary) },
    { schluessel: "st", label: "Gehalt je Spieltag", zahl: (z) => z.item.salary, besser: "tief", text: (z) => betragC(jeSpieltag(z.item.salary), 2) },
    { schluessel: "g-profil", gruppe: "Profil (so weit gescoutet)" },
    {
      schluessel: "potenzial",
      label: "Potenzial",
      zahl: (z) => (z.item.potentialRange ? (z.item.potentialRange.min + z.item.potentialRange.max) / 2 : null),
      besser: "hoch",
      text: (z) => (z.item.potentialRange ? `${z.item.potentialRange.min}–${z.item.potentialRange.max}` : "—"),
    },
    ...MARKT_ACHSEN.map<ReihenDef>((a) => ({
      schluessel: `achse-${a}`,
      label: a.toUpperCase(),
      zahl: (z) => z.sicht.achsen[a].sortWert,
      besser: "hoch",
      text: (z) => z.sicht.achsen[a].anzeige ?? "?",
    })),
    { schluessel: "g-disz", gruppe: "Eignung und Kaderrang" },
    ...disziplinIds.map<ReihenDef>((d) => ({
      schluessel: `d-${d}`,
      disziplinId: d,
      label: disziplinNamen[d],
      zahl: (z) => z.sicht.disziplinen[d]?.schaetzung ?? null,
      besser: "hoch",
      text: (z) => {
        const w = z.sicht.disziplinen[d];
        return w ? w.text : "?";
      },
      balken: (z) => z.sicht.disziplinen[d]?.schaetzung ?? null,
      rang: (z) => {
        const w = z.sicht.disziplinen[d];
        return wirkungMitKandidat(
          props.vorbereitung,
          d,
          w && w.schaetzung != null && w.von != null && w.bis != null ? { von: w.von, mitte: w.schaetzung, bis: w.bis } : null,
        );
      },
    })),
  ];

  /** Alle Spalten mit dem besten SICHTBAREN Wert (gleiche Stufe = gleichauf, alle gold). */
  function istBester(r: ReihenDef, spalte: number): boolean {
    if (!r.zahl) return false;
    const werte = zeilen.map((z) => r.zahl!(z));
    const gueltig = werte.filter((w): w is number => w != null);
    if (gueltig.length < 2) return false;
    const ziel = r.besser === "tief" ? Math.min(...gueltig) : Math.max(...gueltig);
    if (gueltig.every((w) => w === ziel)) return false;
    return werte[spalte] === ziel;
  }

  return (
    <div className="schleier" role="dialog" aria-modal="true" aria-label="Vergleich" data-testid="tm-vergleich">
      <div className="dlg">
        <div className="dk">
          <em>Vergleich</em>
          <h2>{zeilen.length} Spieler nebeneinander</h2>
          <span className="sp" />
          <span className="gk">Bester sichtbarer Wert je Zeile in Gold · fremde Werte als Stufen</span>
          <button type="button" className="zu" onClick={props.onSchliessen} aria-label="Schließen">×</button>
        </div>
        <div className="vg" style={{ ["--n" as string]: zeilen.length }}>
          <div className="lab">
            <div className="kopfk">Ablöse und Gehalt gegen deine Kasse{props.cash != null ? ` (${de(props.cash, 1)} C)` : ""}</div>
            {reihen.map((r) => (r.gruppe ? <div key={r.schluessel} className="vz gr">{r.gruppe}</div> : <div key={r.schluessel} className="vz">{r.label}</div>))}
          </div>
          {zeilen.map((z, spalte) => {
            const sprite = getFigurSpriteForPlayer(z.item.playerId);
            return (
              <div key={z.item.playerId}>
                <div className="kopfk" style={props.kulisse ? { backgroundImage: `url(${props.kulisse})` } : undefined}>
                  <button type="button" className="knopf klein" onClick={() => props.onEntfernen(z.item.playerId)}>Entfernen</button>
                  {sprite && <img className="fig" src={figurPoseUrl(sprite, "south")} alt="" />}
                  <div className="txt">
                    <h3>{z.item.name}</h3>
                    <small>{z.item.className} · {z.item.race}</small>
                    <div><button type="button" className="knopf klein" onClick={() => props.onVerhandeln(z.item.playerId)}>Verhandeln</button></div>
                  </div>
                </div>
                {reihen.map((r) => {
                  if (r.gruppe) return <div key={r.schluessel} className="vz gr" />;
                  const bester = istBester(r, spalte);
                  const w = r.rang?.(z) ?? null;
                  return (
                    <div key={r.schluessel} className={`vz${bester ? " best" : ""}`}>
                      <b className="t">{r.text?.(z)}</b>
                      {r.balken && <span className="bal"><i style={{ width: `${r.balken(z) ?? 0}%` }} /></span>}
                      {w && (
                        <span className="rg t">
                          <s>{w.vorher}.</s><u>→</u>
                          <b className={w.nachherBest < w.vorher ? "auf" : w.nachherSchlecht > w.vorher ? "ab" : "gl"}>{rangText(w.nachherBest, w.nachherSchlecht)}</b>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

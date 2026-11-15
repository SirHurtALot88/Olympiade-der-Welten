"use client";

import { useMemo, useState } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { capitalByGroup } from "@/lib/dashboard/kennzahlen";
import { formatEuro } from "@/lib/format";

const eur = (v: number) => `${formatEuro(v)} €`;
const de1 = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Gebundenes Kapital und Umschlag je Ordner oder Kartenart (TODO.md Punkt 1); zeigt, wie viel Geld in Ladenhütern steckt. */
export function KapitalPanel({ rows }: { rows: SortimentRow[] }) {
  const [by, setBy] = useState<"ordner" | "kartenart">("ordner");
  const [open, setOpen] = useState(false);
  const groups = useMemo(
    () =>
      capitalByGroup(
        rows.map((r) => ({
          active: r.active,
          hidden: r.hidden === true,
          stock: r.stock,
          ek: r.ek,
          ekMissing: r.ekMissing,
          units365: r.windows["365"]?.qty ?? 0,
          lifecycle: r.lifecycle ?? null,
          group: (by === "ordner" ? r.ordner : r.kartenart) ?? "ohne Zuordnung",
        }))
      ),
    [rows, by]
  );
  const total = groups.reduce((n, g) => n + g.capital, 0);
  const stuck = groups.reduce((n, g) => n + g.stuckCapital, 0);

  return (
    <section className="bd-grp" aria-label="Kapitalbindung">
      <button type="button" className="bd-grp-h" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="bd-grp-caret">{open ? "▾" : "▸"}</span>
        Kapitalbindung · {eur(total)} gebunden, davon {eur(stuck)} in Artikeln mit Maßnahme ({total > 0 ? Math.round((stuck / total) * 100) : 0} %)
      </button>
      {open && (
        <div>
          <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
            <button type="button" className={`chip${by === "ordner" ? " on" : ""}`} onClick={() => setBy("ordner")}>
              nach Ordner
            </button>
            <button type="button" className={`chip${by === "kartenart" ? " on" : ""}`} onClick={() => setBy("kartenart")}>
              nach Kartenart
            </button>
          </div>
          <table className="bd-dt-t">
            <thead>
              <tr>
                <th>{by === "ordner" ? "Ordner" : "Kartenart"}</th>
                <th className="r">Artikel</th>
                <th className="r">Stück</th>
                <th className="r">Kapital (EK)</th>
                <th className="r">davon Maßnahme</th>
                <th className="r">Umschlag/Jahr</th>
                <th className="r">Reichweite</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.group}>
                  <td>{g.group}</td>
                  <td className="r">{g.articles}</td>
                  <td className="r">{g.units}</td>
                  <td className="r" title={g.withoutEk > 0 ? `${g.withoutEk} Artikel ohne EK fehlen in dieser Summe` : undefined}>
                    {eur(g.capital)}
                    {g.withoutEk > 0 ? " *" : ""}
                  </td>
                  <td className="r">
                    {eur(g.stuckCapital)} ({Math.round(g.stuckShare * 100)} %)
                  </td>
                  <td className="r">{g.turnsPerYear === null ? "—" : `${de1(g.turnsPerYear)}×`}</td>
                  <td className="r">{g.daysOfCover === null ? "—" : g.daysOfCover > 1500 ? "> 4 Jahre" : `${de1(g.daysOfCover / 30.4)} Mon`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bd-dt-note">Umschlag = Wareneinsatz der letzten 365 Tage ÷ gebundenes Kapital. „Maßnahme“ heißt Preis senken, Auslaufen oder Auslisten. * = Artikel ohne EK fehlen in der Summe.</p>
        </div>
      )}
    </section>
  );
}

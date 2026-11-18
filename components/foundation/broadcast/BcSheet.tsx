import type { HTMLAttributes, ReactNode } from "react";

import { BcIcon } from "./BcIcon";
import "./broadcast.css";

/**
 * BLATT: eine Tafel, die auf dem Phone von unten hochfährt (Schleier dahinter, Ziehgriff oben).
 *
 *  - `modal` = false (Standard): am Desktop bleibt es eine NORMALE Tafel im Raster, nur unter 760 px
 *    wird es zum Blatt. So lebt dieselbe Spalte (Kader, Kontext) auf beiden Geräten.
 *  - `modal` = true: auch am Desktop ein Dialog in der Mitte (für Seltenes: Team- und Spieltagswahl).
 */
export function BcSheet({
  offen,
  onSchliessen,
  titel,
  modal = false,
  children,
  className,
  kopfInhalt,
  ...rest
}: {
  offen: boolean;
  onSchliessen: () => void;
  titel?: ReactNode;
  modal?: boolean;
  children: ReactNode;
  className?: string;
  kopfInhalt?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  return (
    <>
      <div
        className={`bc-schleier${modal ? " bc-schleier--modal" : ""}${offen ? " is-offen" : ""}`}
        onClick={onSchliessen}
        aria-hidden="true"
      />
      <section
        className={`bc-pan bc-blatt${modal ? " bc-blatt--modal" : ""}${offen ? " is-offen" : ""}${className ? ` ${className}` : ""}`}
        role={modal ? "dialog" : undefined}
        aria-modal={modal && offen ? true : undefined}
        {...rest}
      >
        <div className="bc-ziehgriff" aria-hidden="true" />
        {titel || kopfInhalt ? (
          <header className="bc-pan__kopf">
            {titel ? <h2 className="bc-pan__titel">{titel}</h2> : null}
            {kopfInhalt}
            <button
              type="button"
              className={`bc-btn bc-btn--klein${modal ? "" : " bc-nurphone"}`}
              style={{ marginLeft: "auto" }}
              aria-label="Schließen"
              onClick={onSchliessen}
            >
              <BcIcon name="x" />
            </button>
          </header>
        ) : null}
        {children}
      </section>
    </>
  );
}

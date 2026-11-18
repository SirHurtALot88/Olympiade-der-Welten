"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Seiten-Slot des Regiebands (18.11., App-Rahmen modern). Das Band hat in der Mitte einen Platz, den die
 * jeweilige Seite füllt (Start: Rang/Punkte/Form, Einsatzliste: D1/D2-Füllstand, Saisonstand: Liga-Reiter).
 * Die Seite rendert `<FoundationBandSlot>…</FoundationBandSlot>` irgendwo in ihrem Baum; der Inhalt landet per
 * Portal im Band. Ohne Band (Tests, Seite ohne Shell) wird nichts gerendert.
 */
const BandSlotContext = createContext<{ element: HTMLElement | null; setElement: (el: HTMLElement | null) => void }>({
  element: null,
  setElement: () => {},
});

export function FoundationBandSlotProvider({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return <BandSlotContext.Provider value={{ element, setElement }}>{children}</BandSlotContext.Provider>;
}

/** Der Platz im Band selbst; nur die Shell setzt ihn. */
export function FoundationBandSlotTarget() {
  const { setElement } = useContext(BandSlotContext);
  return <div className="fb-slot" data-testid="foundation-band-slot" ref={setElement} />;
}

/** Von Seiten benutzt: bringt `children` ins Band. */
export function FoundationBandSlot({ children }: { children: ReactNode }) {
  const { element } = useContext(BandSlotContext);
  return element ? createPortal(children, element) : null;
}

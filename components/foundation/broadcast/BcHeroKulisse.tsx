"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kulissen-Hintergrund des Hero-Kopfs mit weichem Uebergang: wechselt das Bild, blendet die neue Lage
 * ueber der alten ein (CSS-Animation `bc-kul-ein`), danach faellt die alte weg. Ohne Bild: Farbverlauf.
 * Bild als CSS-Hintergrund in einer absolut liegenden Lage -- keine Layoutverschiebung.
 */
export function BcHeroKulisse({ url }: { url: string | null | undefined }) {
  const [lagen, setLagen] = useState<string[]>(url ? [url] : []);
  const letzte = useRef<string | null>(url ?? null);

  useEffect(() => {
    const neu = url ?? null;
    if (neu === letzte.current) return;
    letzte.current = neu;
    setLagen((alt) => (neu ? [...alt.slice(-1), neu] : []));
    if (!neu) return;
    const t = setTimeout(() => setLagen((alt) => alt.filter((u) => u === neu)), 700);
    return () => clearTimeout(t);
  }, [url]);

  if (lagen.length === 0) return <div className="bc-hero__kul is-farbe" aria-hidden="true" />;
  return (
    <>
      {lagen.map((u, i) => (
        <div
          key={u}
          className={`bc-hero__kul${i > 0 ? " is-neu" : ""}`}
          style={{ backgroundImage: `url("${u}")` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

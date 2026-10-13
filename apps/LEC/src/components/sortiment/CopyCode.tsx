"use client";

import { useState } from "react";
import { cardmarketCode } from "@/lib/dashboard/board";

/** Set-Code als Knopf: Klick kopiert den Cardmarket-Suchcode (ohne DE/EN) in die Zwischenablage. */
export function CopyCode({ setCode, withIcon = false }: { setCode: string; withIcon?: boolean }) {
  const [done, setDone] = useState(false);
  const code = cardmarketCode(setCode);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const t = document.createElement("textarea");
      t.value = code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  }

  return (
    <button type="button" className={`bd-code bd-copy${done ? " is-done" : ""}`} onClick={copy} title={`Kopiert „${code}“ für die Cardmarket-Suche (ohne DE/EN)`}>
      {done ? "kopiert ✓" : withIcon ? `${setCode} · ${code} ⧉` : setCode}
    </button>
  );
}

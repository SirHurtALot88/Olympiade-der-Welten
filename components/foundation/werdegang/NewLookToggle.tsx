"use client";

import { useNewLook } from "@/lib/ui/new-look-preference";

/**
 * Unobtrusive "Neuer Look" switch for the foundation context bar.
 * Self-contained (owns its hook) so host components stay untouched
 * beyond a single render call.
 */
export default function NewLookToggle({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useNewLook();

  return (
    <button
      type="button"
      className={`werdegang-new-look-toggle${enabled ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      role="switch"
      aria-checked={enabled}
      title="Neuer Look: aktiviert zusätzliche, überarbeitete Ansichten (z. B. Werdegang-Panel)."
      data-testid="new-look-toggle"
      onClick={() => setEnabled(!enabled)}
    >
      <span className="werdegang-new-look-track" aria-hidden="true">
        <span className="werdegang-new-look-thumb" />
      </span>
      <span className="werdegang-new-look-label">Neuer Look</span>
    </button>
  );
}

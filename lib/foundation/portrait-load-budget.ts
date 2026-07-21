const DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS = 4;

let activePortraitLoads = 0;
const waitQueue: Array<() => void> = [];

export function getPortraitLoadBudgetLimit() {
  return DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS;
}

/**
 * Reserviert einen Portrait-Ladeslot und gibt eine `release`-Funktion zurück.
 *
 * Wichtig: `release()` MUSS aufgerufen werden, wenn das Bild wirklich fertig
 * geladen ist (oder gescheitert ist) — nicht schon beim Setzen der `src`.
 * Sonst wird der Slot freigegeben, bevor die eigentliche Netzwerkarbeit läuft,
 * und der 4er-Deckel ist wirkungslos (alle sichtbaren Portraits feuern
 * gleichzeitig). `release()` ist idempotent.
 */
export async function acquirePortraitLoadSlot(): Promise<() => void> {
  if (activePortraitLoads >= DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS) {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }

  activePortraitLoads += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activePortraitLoads = Math.max(0, activePortraitLoads - 1);
    const next = waitQueue.shift();
    if (next) {
      next();
    }
  };
}

/**
 * Backwards-kompatibler Wrapper: hält den Slot nur für die Dauer von `task`.
 * Für Bild-Loads NICHT geeignet — dort `acquirePortraitLoadSlot` verwenden und
 * erst bei `onLoad`/`onError` freigeben.
 */
export async function withPortraitLoadBudget<T>(task: () => Promise<T> | T): Promise<T> {
  const release = await acquirePortraitLoadSlot();
  try {
    return await task();
  } finally {
    release();
  }
}

export function getActivePortraitLoadCountForTests() {
  return activePortraitLoads;
}

export function resetPortraitLoadBudgetForTests() {
  activePortraitLoads = 0;
  waitQueue.length = 0;
}

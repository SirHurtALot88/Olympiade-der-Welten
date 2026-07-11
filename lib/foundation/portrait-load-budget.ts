const DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS = 4;

let activePortraitLoads = 0;
const waitQueue: Array<() => void> = [];

export function getPortraitLoadBudgetLimit() {
  return DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS;
}

export async function withPortraitLoadBudget<T>(task: () => Promise<T> | T): Promise<T> {
  if (activePortraitLoads >= DEFAULT_MAX_CONCURRENT_PORTRAIT_LOADS) {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }

  activePortraitLoads += 1;
  try {
    return await task();
  } finally {
    activePortraitLoads = Math.max(0, activePortraitLoads - 1);
    const next = waitQueue.shift();
    if (next) {
      next();
    }
  }
}

export function resetPortraitLoadBudgetForTests() {
  activePortraitLoads = 0;
  waitQueue.length = 0;
}

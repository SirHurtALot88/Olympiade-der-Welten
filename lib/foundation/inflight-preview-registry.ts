const inflightControllers = new Set<AbortController>();

export function registerInflightPreview(controller: AbortController) {
  inflightControllers.add(controller);
  return () => {
    inflightControllers.delete(controller);
  };
}

export function abortAllInflightPreviews() {
  for (const controller of inflightControllers) {
    controller.abort();
  }
  inflightControllers.clear();
}

export async function fetchWithInflightPreview(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const unregister = registerInflightPreview(controller);

  const parentSignal = init?.signal;
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    unregister();
  }
}

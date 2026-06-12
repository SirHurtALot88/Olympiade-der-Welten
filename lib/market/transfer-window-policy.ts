export const LOCAL_TRANSFER_WINDOW_PHASE = "manual_transfer_window";

export type LocalTransferWindowPhase = typeof LOCAL_TRANSFER_WINDOW_PHASE;

export function isExplicitLocalTransferWindowPhase(value: string | null | undefined): value is LocalTransferWindowPhase {
  return value === LOCAL_TRANSFER_WINDOW_PHASE;
}

export function attachDebugSettle(settle: (mode?: number) => void): void {
  if (!import.meta.env.DEV) return
  ;(window as Window & { debugSettle?: (mode?: number) => void }).debugSettle = settle
}

export function detachDebugSettle(): void {
  if (!import.meta.env.DEV) return
  const target = window as Window & { debugSettle?: (mode?: number) => void }
  delete target.debugSettle
}

export function getNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function getBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) === true
  } catch {
    return fallback
  }
}

export function getJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getString(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw
  } catch {
    return fallback
  }
}

export function setValue(key: string, value: string | number | boolean | object): void {
  try {
    if (typeof value === 'string') {
      localStorage.setItem(key, value)
      return
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      localStorage.setItem(key, String(value))
      return
    }

    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // no-op
  }
}

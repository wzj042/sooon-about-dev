function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

export function toPublicUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '')
  return `${getBaseUrl()}${normalized}`
}

export function normalizePublicAssetUrl(source: string): string {
  const trimmed = source.trim()
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('assets/')) {
    return toPublicUrl(trimmed)
  }
  return trimmed
}

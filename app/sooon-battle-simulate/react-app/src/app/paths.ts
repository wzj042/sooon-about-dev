export const APP_BASE_URL = import.meta.env.BASE_URL || '/'

export const APP_ROUTES = {
  home: '/',
  homeHtml: '/index.html',
  game: '/game',
  queuePractice: '/queue-practice',
  about: '/about',
  questionBank: '/question-bank',
} as const

export function normalizeRouterBasename(baseUrl: string): string {
  const trimmed = (baseUrl || '/').trim()
  if (trimmed === '' || trimmed === '/') return '/'
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

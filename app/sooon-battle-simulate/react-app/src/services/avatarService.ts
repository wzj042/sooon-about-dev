import { avataaars, bigSmile, icons, micah } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'

import type { AvatarData } from '../domain/types'

const STYLE_MAP: Record<string, unknown> = {
  icons,
  avataaars,
  'big-smile': bigSmile,
  micah,
}

const FALLBACK_COLORS = ['#B5F4BC', '#ECE2E1', '#C0EB75', '#FFC078', '#FCF7D1', '#66D9E8', '#C4DDD6', '#E599F7']

type AvatarStyle = 'icons' | 'avataaars' | 'big-smile' | 'micah'

function randomItem<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 12)
}

function fallbackSvg(size: number, label: string): string {
  const color = randomItem(FALLBACK_COLORS)
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${color}"/><text x="${size / 2}" y="${size / 2 + 8}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="700">${label}</text></svg>`
}

export async function generateRandomAvatar(options?: {
  style?: AvatarStyle
  seed?: string
  size?: number
}): Promise<AvatarData> {
  const size = options?.size ?? 64
  const style = options?.style ?? randomItem(Object.keys(STYLE_MAP) as AvatarStyle[])
  const seed = options?.seed ?? randomSeed()

  try {
    const background = randomItem(FALLBACK_COLORS).replace('#', '')
    const styleModule = STYLE_MAP[style] as Parameters<typeof createAvatar>[0]
    const svg = createAvatar(styleModule, {
      seed,
      size,
      radius: 25,
      backgroundColor: [background],
      backgroundType: ['solid'],
      scale: style === 'icons' ? 100 : undefined,
    }).toString()

    return {
      svg,
      style,
      seed,
      size,
      isFallback: false,
      timestamp: Date.now(),
    }
  } catch {
    return {
      svg: fallbackSvg(size, 'AI'),
      style,
      seed,
      size,
      isFallback: true,
      timestamp: Date.now(),
    }
  }
}

export function avatarToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`
}

export function parseImportedAvatarText(raw: string): AvatarData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const candidate = (parsed.avatar ?? parsed) as Record<string, unknown>
    if (typeof candidate.svg !== 'string' || candidate.svg.length === 0) return null

    return {
      svg: candidate.svg,
      style: typeof candidate.style === 'string' ? candidate.style : 'imported',
      seed: typeof candidate.seed === 'string' ? candidate.seed : `import-${Date.now()}`,
      size: typeof candidate.size === 'number' ? candidate.size : 64,
      isFallback: Boolean(candidate.isFallback),
      timestamp: typeof candidate.timestamp === 'number' ? candidate.timestamp : Date.now(),
    }
  } catch {
    return null
  }
}

export function buildAvatarExport(avatar: AvatarData, source: 'current' | 'saved'): string {
  return JSON.stringify(
    {
      version: '1.0',
      source,
      timestamp: Date.now(),
      avatar,
    },
    null,
    2,
  )
}


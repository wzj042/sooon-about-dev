import { toPublicUrl } from '../utils/publicAsset'

export const DEFAULT_AVATAR_SRC = toPublicUrl('assets/imgs/anyone.svg')

const IMAGE_PATH_PATTERN = /\.(svg|png|jpe?g|gif|webp|avif|bmp|ico)([?#].*)?$/i

export function isImageAvatarSource(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  if (trimmed.startsWith('data:image/')) return true
  if (/^blob:/i.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return true

  return IMAGE_PATH_PATTERN.test(trimmed)
}

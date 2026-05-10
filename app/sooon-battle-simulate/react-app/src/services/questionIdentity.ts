import type { QuestionItem } from '../domain/types'

export interface QuestionReference {
  questionHash: string
  sourceId?: string
  updatedAt?: string
}

const QUESTION_HASH_PATTERN = /^q_[0-9a-f]{28}$/i

function normalizeQuestionText(question: string): string {
  return question.trim()
}

function cyrb53(value: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ charCode, 2654435761)
    h2 = Math.imul(h2 ^ charCode, 1597334677)
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function toHex(value: number): string {
  return Math.max(0, value).toString(16).padStart(14, '0')
}

export function buildQuestionHash(question: string): string {
  const normalized = normalizeQuestionText(question)
  if (normalized.length === 0) return ''

  return `q_${toHex(cyrb53(normalized, 0))}${toHex(cyrb53(normalized, 1))}`
}

export function isQuestionHash(value: string): boolean {
  return QUESTION_HASH_PATTERN.test(value.trim())
}

export function buildQuestionReference(item: Pick<QuestionItem, 'question' | 'sourceId' | 'updatedAt'>): QuestionReference | null {
  const questionHash = buildQuestionHash(item.question)
  if (questionHash.length === 0) return null

  const sourceId = typeof item.sourceId === 'string' ? item.sourceId.trim() : ''
  const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt.trim() : ''

  return {
    questionHash,
    sourceId: sourceId.length > 0 ? sourceId : undefined,
    updatedAt: updatedAt.length > 0 ? updatedAt : undefined,
  }
}

export function isQuestionReference(value: unknown): value is QuestionReference {
  if (!value || typeof value !== 'object') return false

  const reference = value as Partial<QuestionReference>
  return typeof reference.questionHash === 'string' && reference.questionHash.length > 0
}

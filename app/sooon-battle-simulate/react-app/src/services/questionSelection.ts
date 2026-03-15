import type { QuestionItem, QuestionSelectionStrategy } from '../domain/types'
import { averageResponseMs, getQuestionStat, isCommonSenseType, isEthicsType, type QuestionStatsMap } from './questionStats'

export type QuestionSelectionCounts = Record<QuestionSelectionStrategy, number>

export const DEFAULT_QUESTION_SELECTION_COUNTS: QuestionSelectionCounts = {
  all_questions: 0,
  unseen_first: 0,
  mistake_focused: 0,
  slow_thinking_focused: 0,
  common_sense_only: 0,
  ethics_only: 0,
  unmastered_only: 0,
  mastered_only: 0,
}

function dedupeQuestionBank(bank: QuestionItem[]): QuestionItem[] {
  const used = new Set<string>()
  const deduped: QuestionItem[] = []

  for (const item of bank) {
    if (!item.question || used.has(item.question)) continue
    used.add(item.question)
    deduped.push(item)
  }

  return deduped
}

function compareQuestions(left: QuestionItem, right: QuestionItem): number {
  return left.question.localeCompare(right.question, 'zh-CN')
}

export function buildQuestionSelectionPool(
  bank: QuestionItem[],
  strategy: QuestionSelectionStrategy,
  statsMap: QuestionStatsMap,
): QuestionItem[] {
  const deduped = dedupeQuestionBank(bank)

  if (strategy === 'all_questions') return deduped

  if (strategy === 'unseen_first') {
    return deduped.filter((item) => (getQuestionStat(item.question, statsMap)?.seenCount ?? 0) <= 0)
  }

  if (strategy === 'mistake_focused') {
    return deduped
      .filter((item) => (getQuestionStat(item.question, statsMap)?.wrongCount ?? 0) > 0)
      .sort((left, right) => {
        const leftEntry = getQuestionStat(left.question, statsMap)
        const rightEntry = getQuestionStat(right.question, statsMap)
        const leftWrong = leftEntry?.wrongCount ?? 0
        const rightWrong = rightEntry?.wrongCount ?? 0
        if (leftWrong !== rightWrong) return rightWrong - leftWrong
        const leftAnswered = leftEntry?.answeredCount ?? 0
        const rightAnswered = rightEntry?.answeredCount ?? 0
        if (leftAnswered !== rightAnswered) return rightAnswered - leftAnswered
        return compareQuestions(left, right)
      })
  }

  if (strategy === 'slow_thinking_focused') {
    return deduped
      .filter((item) => (getQuestionStat(item.question, statsMap)?.answeredCount ?? 0) > 0)
      .sort((left, right) => {
        const leftMs = averageResponseMs(getQuestionStat(left.question, statsMap))
        const rightMs = averageResponseMs(getQuestionStat(right.question, statsMap))
        if (leftMs !== rightMs) return rightMs - leftMs
        return compareQuestions(left, right)
      })
  }

  if (strategy === 'common_sense_only') {
    return deduped.filter((item) => isCommonSenseType(item.type))
  }

  if (strategy === 'ethics_only') {
    return deduped.filter((item) => isEthicsType(item.type))
  }

  if (strategy === 'unmastered_only') {
    return deduped.filter((item) => getQuestionStat(item.question, statsMap)?.mastered !== true)
  }

  return deduped.filter((item) => getQuestionStat(item.question, statsMap)?.mastered === true)
}

export function buildQuestionSelectionCounts(bank: QuestionItem[], statsMap: QuestionStatsMap): QuestionSelectionCounts {
  return {
    all_questions: buildQuestionSelectionPool(bank, 'all_questions', statsMap).length,
    unseen_first: buildQuestionSelectionPool(bank, 'unseen_first', statsMap).length,
    mistake_focused: buildQuestionSelectionPool(bank, 'mistake_focused', statsMap).length,
    slow_thinking_focused: buildQuestionSelectionPool(bank, 'slow_thinking_focused', statsMap).length,
    common_sense_only: buildQuestionSelectionPool(bank, 'common_sense_only', statsMap).length,
    ethics_only: buildQuestionSelectionPool(bank, 'ethics_only', statsMap).length,
    unmastered_only: buildQuestionSelectionPool(bank, 'unmastered_only', statsMap).length,
    mastered_only: buildQuestionSelectionPool(bank, 'mastered_only', statsMap).length,
  }
}

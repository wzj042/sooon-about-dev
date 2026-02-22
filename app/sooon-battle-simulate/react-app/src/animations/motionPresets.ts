import type { Variants } from 'framer-motion'

import { MOTION_DURATIONS, MOTION_EASE } from './transitions'

const OPTION_ENTRANCE_BASE_DELAY = 1.7
const OPTION_ENTRANCE_STAGGER = 0.1
const OPTION_EXIT_STAGGER = 0.08
const QUESTION_TEXT_DURATION = 1.6

export const rankTextVariants: Variants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: {
    opacity: [0, 1, 1, 0],
    scale: [0.5, 1, 1, 1],
    transition: {
      duration: MOTION_DURATIONS.rankText,
      ease: MOTION_EASE.inOut,
      times: [0, 0.25, 0.75, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 1,
    transition: { duration: 0.05, ease: MOTION_EASE.inOut },
  },
}

export const questionTextVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: [0, 1, 1, 1],
    scale: [0.8, 1, 1, 1],
    transition: {
      duration: QUESTION_TEXT_DURATION,
      ease: MOTION_EASE.inOut,
      times: [0, 0.25, 0.75, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 1,
    transition: { duration: 0.2, ease: MOTION_EASE.inOut },
  },
}

export const optionListVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      delayChildren: OPTION_ENTRANCE_BASE_DELAY,
      staggerChildren: OPTION_ENTRANCE_STAGGER,
      staggerDirection: 1,
    },
  },
  exit: {
    transition: {
      staggerChildren: OPTION_EXIT_STAGGER,
      staggerDirection: 1,
    },
  },
}

export const optionVariants: Variants = {
  initial: { opacity: 0, scale: 2.5 },
  animate: {
    opacity: [0, 0.18, 0.25, 0.48, 0.58, 0.78, 1],
    scale: [2.5, 1.8, 1.2, 0.95, 1],
    transition: {
      duration: MOTION_DURATIONS.optionIn,
      ease: MOTION_EASE.spring,
      times: [0, 0.16, 0.4, 0.66, 1],
    },
  },
  exit: {
    opacity: [0.8, 0],
    y: [0, -12],
    transition: {
      duration: MOTION_DURATIONS.optionOut,
      ease: MOTION_EASE.inOut,
      times: [0, 1],
    },
  },
}

export const scoreFlyVariants: Variants = {
  initial: { opacity: 0, y: 0, scale: 0.8 },
  animate: (isPlayer: boolean) => ({
    opacity: [0, 1, 1, 0],
    x: isPlayer ? -130 : 130,
    y: [0, -10, -25, -35],
    scale: [0.85, 1, 1, 0.9],
    transition: {
      duration: MOTION_DURATIONS.scoreFly,
      ease: MOTION_EASE.inOut,
    },
  }),
}

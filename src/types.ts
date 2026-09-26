export type Intonation = 'fall' | 'rise' | 'flat' | 'rise-fall' | 'fall-rise'
export type StressLevel = 0 | 1 | 2 | 3

export interface SenseGroup {
  id: string
  text: string
  stressWords: string[]
  stressLevel: StressLevel
  pauseMs: number
  intonation: Intonation
  note: string
  /** 非空表示已归档：退出进度与错词统计，但正文与记录保留在练习历史中 */
  archivedAt: string | null
}

export interface GroupScore {
  groupId: string
  accuracy: number
  rhythm: number
  deviation: number
  note: string
}

export interface WordIssue {
  id: string
  groupId: string
  word: string
  category: string
  note: string
}

export interface SegmentFeedback {
  id: string
  groupId: string
  teacher: string
  text: string
  createdAt: string
}

export interface Attempt {
  id: string
  number: number
  label: string
  createdAt: string
  duration: number
  audioBlob?: Blob
  audioMime: string
  simulated: boolean
  rangeStart: number
  rangeEnd: number
  scores: GroupScore[]
  wordIssues: WordIssue[]
  feedback: SegmentFeedback[]
  selfNote: string
}

export interface PracticeProject {
  title: string
  sentence: string
  translation: string
  teacher: string
  targetAttempts: number
  targetDuration: number
  groups: SenseGroup[]
  attempts: Attempt[]
  errorCategories: string[]
  updatedAt: string
}

export interface PersistedPractice {
  project: PracticeProject
  version: number
}

/** 当前持久化结构版本：v2 起意群带 archivedAt，记录随意群归档而非悬空 */
export const PRACTICE_VERSION = 2

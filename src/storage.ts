import type { PersistedPractice, PracticeProject } from './types'

const DB_NAME = 'sologsb-1018-prosody'
const STORE = 'practice'
const KEY = 'current'
const FALLBACK_KEY = 'sologsb-1018-fallback'
const SAVE_VERSION = 2

// 旧版本练习缺少 archivedGroups，且可能残留已删意群的评分/错词/反馈。
// 打开时补齐结构并清掉孤儿记录，让它们退出进度与错词统计；录音与标注保持不变。
export function migratePractice(project: PracticeProject): PracticeProject {
  const migrated: PracticeProject = {
    ...project,
    groups: Array.isArray(project.groups) ? project.groups : [],
    archivedGroups: Array.isArray(project.archivedGroups) ? project.archivedGroups : [],
    attempts: (Array.isArray(project.attempts) ? project.attempts : []).map((attempt) => ({
      ...attempt,
      scores: Array.isArray(attempt.scores) ? attempt.scores : [],
      wordIssues: Array.isArray(attempt.wordIssues) ? attempt.wordIssues : [],
      feedback: Array.isArray(attempt.feedback) ? attempt.feedback : []
    }))
  }
  const groupIds = new Set(migrated.groups.map((group) => group.id))
  migrated.attempts.forEach((attempt) => {
    attempt.scores = attempt.scores.filter((score) => groupIds.has(score.groupId))
    attempt.wordIssues = attempt.wordIssues.filter((issue) => groupIds.has(issue.groupId))
    attempt.feedback = attempt.feedback.filter((item) => groupIds.has(item.groupId))
  })
  return migrated
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadPractice(): Promise<PracticeProject | null> {
  try {
    const db = await openDb()
    const value = await new Promise<PersistedPractice | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly')
      const request = transaction.objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve(request.result as PersistedPractice | undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (value?.project) return migratePractice(value.project)
  } catch {
    const raw = localStorage.getItem(FALLBACK_KEY)
    if (raw) return migratePractice(JSON.parse(raw) as PracticeProject)
  }
  return null
}

export async function savePractice(project: PracticeProject): Promise<'indexeddb' | 'localstorage'> {
  const value: PersistedPractice = { project, version: SAVE_VERSION }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(value, KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    return 'indexeddb'
  } catch {
    const fallback = { ...project, attempts: project.attempts.map((attempt) => ({ ...attempt, audioBlob: undefined })) }
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(fallback))
    return 'localstorage'
  }
}

export async function clearPractice(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).delete(KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  } catch {
    // Ignore cleanup errors and clear the fallback below.
  }
  localStorage.removeItem(FALLBACK_KEY)
}

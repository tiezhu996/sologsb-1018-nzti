import { migratePractice } from './migrate'
import { PRACTICE_VERSION, type PersistedPractice, type PracticeProject } from './types'

const DB_NAME = 'sologsb-1018-prosody'
const STORE = 'practice'
const KEY = 'current'
const FALLBACK_KEY = 'sologsb-1018-fallback'

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

function loadFallback(): PracticeProject | null {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    return raw ? migratePractice(JSON.parse(raw)) : null
  } catch {
    return null
  }
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
    const migrated = migratePractice(value)
    if (migrated) return migrated
  } catch {
    // IndexedDB 不可用（隐私模式等），退回本地备份。
  }
  return loadFallback()
}

export async function savePractice(project: PracticeProject): Promise<'indexeddb' | 'localstorage'> {
  const value: PersistedPractice = { project, version: PRACTICE_VERSION }
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
    const fallback: PersistedPractice = {
      version: PRACTICE_VERSION,
      project: { ...project, attempts: project.attempts.map((attempt) => ({ ...attempt, audioBlob: undefined })) }
    }
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

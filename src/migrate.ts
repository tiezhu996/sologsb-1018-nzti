import type { Attempt, PracticeProject, SenseGroup } from './types'

/**
 * 把任意历史版本的持久化数据升级为当前结构。
 * - 接受 { project, version } 包装或旧版 localStorage 直接存的裸 project
 * - v1 的意群没有 archivedAt，一律补 null
 * - v1 删除意群是硬删，各轮尝试里可能残留悬空记录（groupId 找不到意群），
 *   这里为它们补一个已归档的占位意群：记录保留在练习历史中，但不再计入统计
 * 迁移只重排字段引用，不触碰 audioBlob，录音与标注原样保留。
 */
export function migratePractice(value: unknown): PracticeProject | null {
  if (!value || typeof value !== 'object') return null
  const wrapped = value as { project?: unknown }
  const project = (wrapped.project ?? value) as Partial<PracticeProject>
  if (!project || !Array.isArray(project.groups) || !Array.isArray(project.attempts)) return null

  const groups: SenseGroup[] = project.groups.map((group) => ({ ...group, archivedAt: group.archivedAt ?? null }))
  const attempts: Attempt[] = project.attempts.map((attempt) => ({
    ...attempt,
    scores: attempt.scores ?? [],
    wordIssues: attempt.wordIssues ?? [],
    feedback: attempt.feedback ?? []
  }))

  const known = new Set(groups.map((group) => group.id))
  const orphans = new Set<string>()
  for (const attempt of attempts) {
    for (const score of attempt.scores) if (!known.has(score.groupId)) orphans.add(score.groupId)
    for (const issue of attempt.wordIssues) if (!known.has(issue.groupId)) orphans.add(issue.groupId)
    for (const item of attempt.feedback) if (!known.has(item.groupId)) orphans.add(item.groupId)
  }
  if (orphans.size) {
    const stamp = project.updatedAt ?? new Date().toISOString()
    for (const id of orphans) {
      groups.push({
        id,
        text: '已移除的意群（历史记录）',
        stressWords: [],
        stressLevel: 1,
        pauseMs: 300,
        intonation: 'flat',
        note: '',
        archivedAt: stamp
      })
    }
  }

  return { ...(project as PracticeProject), groups, attempts }
}

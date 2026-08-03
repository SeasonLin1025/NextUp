import { Task } from './types'
import {
  TASKS_KEY,
  SEEN_OVERDUE_KEY,
  DISMISSED_MUST_START_KEY,
  DISMISSED_STAGNANT_KEY,
  EXPLANATIONS_KEY,
} from './storage'

// ─────────────────────────────────────────────
// 数据导出 / 导入 / 合并（纯本地逻辑）
// ─────────────────────────────────────────────

export interface BackupData {
  tasks: Task[]
  seenOverdueIds: string[]
  dismissedMustStart: Record<string, string>
  dismissedStagnant: Record<string, number>
  explanations: Record<string, string>
}

export interface BackupFile {
  app: 'NextUp'
  version: number
  exportedAt: string
  data: BackupData
}

// ─── 工具：读取 / 写入 localStorage ──────────

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

// ─── 字段兜底（旧版本数据缺 updatedAt / lastProgressUpdatedAt）───

function normalizeTask(t: Task, now: number): Task {
  const createdMs =
    typeof t.createdAt === 'number' && !isNaN(t.createdAt) ? t.createdAt : now
  const fallbackISO = new Date(createdMs).toISOString()
  return {
    ...t,
    createdAt: createdMs,
    progress: t.progress ?? 0,
    originalEstimate: t.originalEstimate ?? t.estimateMinutes,
    lastProgressUpdatedAt: t.lastProgressUpdatedAt ?? fallbackISO,
    updatedAt: t.updatedAt ?? fallbackISO,
    abandoned: t.abandoned ?? false,
    rescheduleCount: t.rescheduleCount ?? 0,
  }
}

/** 取任务的新旧比较时间（ms）：updatedAt 优先，缺失用 createdAt 兜底 */
function taskVersionMs(t: Task): number {
  if (t.updatedAt) {
    const ms = new Date(t.updatedAt).getTime()
    if (!isNaN(ms)) return ms
  }
  if (typeof t.createdAt === 'number' && !isNaN(t.createdAt)) return t.createdAt
  return 0
}

// ─── 导出 ────────────────────────────────────

export function buildBackup(): BackupFile {
  return {
    app: 'NextUp',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      tasks: readJSON<Task[]>(TASKS_KEY, []),
      seenOverdueIds: readJSON<string[]>(SEEN_OVERDUE_KEY, []),
      dismissedMustStart: readJSON<Record<string, string>>(DISMISSED_MUST_START_KEY, {}),
      dismissedStagnant: readJSON<Record<string, number>>(DISMISSED_STAGNANT_KEY, {}),
      explanations: readJSON<Record<string, string>>(EXPLANATIONS_KEY, {}),
    },
  }
}

// ─── 校验 ────────────────────────────────────

export function validateBackup(parsed: unknown): parsed is BackupFile {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  if (p.app !== 'NextUp') return false
  const data = p.data as Record<string, unknown> | undefined
  if (!data || !Array.isArray(data.tasks)) return false
  return true
}

/** 校验通过后取出完整数据，缺失的可选字段用空值兜底，任务字段做兼容归一化 */
export function extractBackupData(backup: BackupFile): BackupData {
  const now = Date.now()
  const d = backup.data
  return {
    tasks: (d.tasks ?? []).map((t) => normalizeTask(t, now)),
    seenOverdueIds: Array.isArray(d.seenOverdueIds) ? d.seenOverdueIds : [],
    dismissedMustStart: d.dismissedMustStart ?? {},
    dismissedStagnant: d.dismissedStagnant ?? {},
    explanations: d.explanations ?? {},
  }
}

// ─── 合并 ────────────────────────────────────

export interface MergeResult {
  tasks: Task[]
  added: number    // 备份中新增的任务数
  updated: number  // 冲突且备份较新、替换掉本地的任务数
}

/**
 * 合并任务：以 id 为唯一标识
 * - id 不存在于本地 → 新增
 * - id 冲突 → 比较 updatedAt（缺失用 createdAt），保留较晚的一份（整条替换）
 * - updatedAt 相同 → 保留本地版本
 */
export function mergeTasks(current: Task[], incoming: Task[]): MergeResult {
  const now = Date.now()
  const map = new Map<string, Task>()
  for (const t of current) map.set(t.id, normalizeTask(t, now))

  let added = 0
  let updated = 0
  for (const raw of incoming) {
    const inc = normalizeTask(raw, now)
    const local = map.get(inc.id)
    if (!local) {
      map.set(inc.id, inc)
      added++
    } else {
      const localMs = taskVersionMs(local)
      const incMs = taskVersionMs(inc)
      if (incMs > localMs) {
        map.set(inc.id, inc)
        updated++
      }
      // incMs <= localMs：保留本地，不动
    }
  }

  return { tasks: Array.from(map.values()), added, updated }
}

/** 合并 dismiss 类记录：按 id 取并集（本地优先，备份补充缺失项） */
export function mergeRecords<T>(current: Record<string, T>, incoming: Record<string, T>): Record<string, T> {
  return { ...incoming, ...current }
}

export function mergeStringArrays(current: string[], incoming: string[]): string[] {
  return Array.from(new Set([...current, ...incoming]))
}

// ─── 应用导入结果到 localStorage ──────────────

export function applyMerge(incoming: BackupData): MergeResult {
  const currentTasks = readJSON<Task[]>(TASKS_KEY, [])
  const result = mergeTasks(currentTasks, incoming.tasks)

  writeJSON(TASKS_KEY, result.tasks)
  writeJSON(
    SEEN_OVERDUE_KEY,
    mergeStringArrays(readJSON<string[]>(SEEN_OVERDUE_KEY, []), incoming.seenOverdueIds)
  )
  writeJSON(
    DISMISSED_MUST_START_KEY,
    mergeRecords(readJSON<Record<string, string>>(DISMISSED_MUST_START_KEY, {}), incoming.dismissedMustStart)
  )
  writeJSON(
    DISMISSED_STAGNANT_KEY,
    mergeRecords(readJSON<Record<string, number>>(DISMISSED_STAGNANT_KEY, {}), incoming.dismissedStagnant)
  )
  writeJSON(
    EXPLANATIONS_KEY,
    mergeRecords(readJSON<Record<string, string>>(EXPLANATIONS_KEY, {}), incoming.explanations)
  )
  return result
}

export function applyOverwrite(incoming: BackupData): void {
  writeJSON(TASKS_KEY, incoming.tasks)
  writeJSON(SEEN_OVERDUE_KEY, incoming.seenOverdueIds)
  writeJSON(DISMISSED_MUST_START_KEY, incoming.dismissedMustStart)
  writeJSON(DISMISSED_STAGNANT_KEY, incoming.dismissedStagnant)
  writeJSON(EXPLANATIONS_KEY, incoming.explanations)
}

/** 统计当前数据与备份的重复任务数（按 id） */
export function countConflicts(incoming: Task[]): number {
  const currentTasks = readJSON<Task[]>(TASKS_KEY, [])
  const ids = new Set(currentTasks.map((t) => t.id))
  return incoming.filter((t) => ids.has(t.id)).length
}

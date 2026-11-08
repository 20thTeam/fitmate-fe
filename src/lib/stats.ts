// 저장된 실제 세션만으로 계산하는 요약 통계 (F-YBENHN). 기록이 없으면 0을 돌려준다.

import type { WorkoutSession } from '../types/domain'

const DAY_MS = 86_400_000
const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)

export const totalValidReps = (s: WorkoutSession) => s.records.reduce((a, r) => a + r.validReps, 0)

export function completionRate(s: WorkoutSession) {
  if (s.records.length === 0) return 0
  return Math.round((s.records.filter((r) => r.completed).length / s.records.length) * 100)
}

export function summarize(sessions: WorkoutSession[], now = Date.now()) {
  const weekAgo = startOfDay(now) - 6 * DAY_MS
  const days = new Set(sessions.map((s) => startOfDay(s.endedAt)))

  // 오늘(또는 어제)부터 거꾸로 이어진 운동일 수
  let streak = 0
  let cursor = startOfDay(now)
  if (!days.has(cursor)) cursor -= DAY_MS
  while (days.has(cursor)) {
    streak++
    cursor -= DAY_MS
  }

  return {
    count: sessions.length,
    weekCount: sessions.filter((s) => s.endedAt >= weekAgo).length,
    streakDays: streak,
    totalActiveMs: sessions.reduce((a, s) => a + s.activeMs, 0),
    totalReps: sessions.reduce((a, s) => a + totalValidReps(s), 0),
  }
}

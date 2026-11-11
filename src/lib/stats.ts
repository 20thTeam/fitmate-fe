// 저장된 실제 세션만으로 계산하는 요약 통계 (F-YBENHN). 기록이 없으면 0을 돌려준다.

import type { ExerciseRecord, WorkoutSession } from '../types/domain'

const DAY_MS = 86_400_000
const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)

// 자세 인식이 안 된 운동의 0회는 실제 수행량이 아니라서 합계에서 뺀다. 예전 기록(상태 없음)은 측정한 것으로 본다
const isMeasured = (r: ExerciseRecord) => r.measurementStatus !== 'NOT_MEASURED'

/** 한 운동이라도 실제로 측정했는지. false면 횟수를 0이 아니라 '측정 못 함'으로 보여준다 */
export const hasMeasuredRecord = (s: WorkoutSession) => s.records.some(isMeasured)

export const totalValidReps = (s: WorkoutSession) => s.records.filter(isMeasured).reduce((a, r) => a + r.validReps, 0)

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
    /** 측정한 운동이 있는 세션이 하나라도 있는지 */
    hasMeasuredReps: sessions.some(hasMeasuredRecord),
  }
}

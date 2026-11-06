// 규칙 기반 추천 (F-UZFEMP 권장안: 규칙 기반).
// 백엔드/AI 담당 로직이 준비되면 RoutineService 구현만 바꾸면 되고, 이 파일은 로컬 폴백으로 남는다.

import {
  PROVISIONAL_GOOD_RATIO,
  PROVISIONAL_INCREASE,
  PROVISIONAL_ROUTINES,
} from '../config/provisional'
import type { GoalId, Routine, RoutineItem, WorkoutSession } from '../types/domain'

const newId = () => crypto.randomUUID()

export function buildFirstRoutine(userId: string, goal: GoalId): Routine {
  return {
    routineId: newId(),
    userId,
    round: 1,
    goal,
    items: PROVISIONAL_ROUTINES[goal].map((it, i) => ({ ...it, order: i + 1 })),
    provisional: true,
  }
}

/** 운동 1개의 목표 대비 유효 수행 비율. 판정 근거가 없으면 null. */
function ratioOf(item: RoutineItem, session: WorkoutSession): number | null {
  const rec = session.records.find((r) => r.exerciseId === item.exerciseId)
  if (!rec) return null
  if (item.targetReps) return rec.validReps / (item.targetReps * item.sets)
  if (item.targetSeconds) return rec.validSeconds / (item.targetSeconds * item.sets)
  return null
}

export function buildNextRoutine(prev: Routine, session: WorkoutSession): Routine {
  const reasons: string[] = []
  const items = prev.items.map((it) => {
    const ratio = ratioOf(it, session)
    if (ratio === null) {
      reasons.push(`${it.name}: 기록이 부족해 현재 난도를 유지합니다.`)
      return it
    }
    const pct = Math.round(ratio * 100)
    if (ratio < PROVISIONAL_GOOD_RATIO) {
      reasons.push(`${it.name}: 목표의 ${pct}%를 수행해 현재 난도를 유지합니다.`)
      return it
    }
    if (it.targetReps) {
      const next = Math.min(
        PROVISIONAL_INCREASE.maxReps,
        Math.ceil(it.targetReps * (1 + PROVISIONAL_INCREASE.repsRatio)),
      )
      reasons.push(
        next > it.targetReps
          ? `${it.name}: 목표의 ${pct}%를 수행해 ${it.targetReps}회 → ${next}회로 늘립니다.`
          : `${it.name}: 안전 상한에 도달해 유지합니다.`,
      )
      return { ...it, targetReps: next }
    }
    const cur = it.targetSeconds ?? 0
    const next = Math.min(PROVISIONAL_INCREASE.maxSeconds, cur + PROVISIONAL_INCREASE.secondsStep)
    reasons.push(
      next > cur
        ? `${it.name}: 목표의 ${pct}%를 수행해 ${cur}초 → ${next}초로 늘립니다.`
        : `${it.name}: 안전 상한에 도달해 유지합니다.`,
    )
    return { ...it, targetSeconds: next }
  })

  return {
    routineId: newId(),
    userId: prev.userId,
    round: prev.round + 1,
    goal: prev.goal,
    items,
    basedOnSessionId: session.sessionId,
    changeReasons: reasons,
    provisional: true,
  }
}

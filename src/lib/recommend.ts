// 규칙 기반 추천 (F-UZFEMP 권장안: 규칙 기반).
// 백엔드/AI 담당 로직이 준비되면 RoutineService 구현만 바꾸면 되고, 이 파일은 로컬 폴백으로 남는다.

import { PROVISIONAL_GOOD_RATIO, PROVISIONAL_INCREASE, PROVISIONAL_ROUTINES } from '../config/provisional'
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
  // 측정 못 한 운동의 0회는 실제 수행량이 아니다 (PL-SOBVBH: 근거 없으면 유지)
  if (!rec || rec.measurementStatus === 'NOT_MEASURED') return null
  if (item.targetReps) return rec.validReps / (item.targetReps * item.sets)
  if (item.targetSeconds) return rec.validSeconds / (item.targetSeconds * item.sets)
  return null
}

function increase(it: RoutineItem): { next: RoutineItem; reason: string } | null {
  if (it.targetReps) {
    const reps = Math.min(PROVISIONAL_INCREASE.maxReps, Math.ceil(it.targetReps * (1 + PROVISIONAL_INCREASE.repsRatio)))
    if (reps <= it.targetReps) return null
    return { next: { ...it, targetReps: reps }, reason: `${it.targetReps}회 → ${reps}회로 늘렸어요.` }
  }
  const cur = it.targetSeconds ?? 0
  const sec = Math.min(PROVISIONAL_INCREASE.maxSeconds, cur + PROVISIONAL_INCREASE.secondsStep)
  if (sec <= cur) return null
  return { next: { ...it, targetSeconds: sec }, reason: `${cur}초 → ${sec}초로 늘렸어요.` }
}

/** 수행이 충분하면 안전 상한 안에서 올리고, 부족하거나 근거가 없으면 유지한다 (PL-SOBVBH). */
export function buildNextRoutine(prev: Routine, session: WorkoutSession): Routine {
  const reasons: string[] = []
  const items = prev.items.map((it) => {
    const ratio = ratioOf(it, session)
    if (ratio === null) {
      reasons.push(`${it.name}: 기록이 부족해 같은 난도를 유지해요.`)
      return it
    }
    const pct = Math.round(ratio * 100)
    if (ratio < PROVISIONAL_GOOD_RATIO) {
      reasons.push(`${it.name}: 목표의 ${pct}%를 수행해 같은 난도를 유지해요.`)
      return it
    }
    const up = increase(it)
    if (!up) {
      reasons.push(`${it.name}: 안전 상한에 도달해 같은 난도를 유지해요.`)
      return it
    }
    reasons.push(`${it.name}: 목표의 ${pct}%를 수행해 ${up.reason}`)
    return up.next
  })

  return {
    routineId: newId(),
    userId: prev.userId,
    round: prev.round + 1,
    goal: prev.goal,
    items,
    prevRoutineId: prev.routineId,
    basedOnSessionId: session.sessionId,
    changeReasons: reasons,
    provisional: true,
  }
}

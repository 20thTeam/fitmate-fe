// 서버 값 ↔ 프론트 도메인 값 변환.
// 운동 ID는 자세 판정(lib/pose)·가이드(config/exercises)가 쓰는 프론트 ID로 바꿔 둔다.

import type { ExerciseRecord, GoalId, Routine, RoutineItem } from '../../types/domain'
import type { ApiGoal, ExerciseRecordRequest, ExerciseRecordResponse, RoutineExerciseResponse, RoutineResponse } from './types'

const EXERCISE_ID_BY_CODE: Record<string, string> = {
  SQUAT: 'squat',
  HIP_HINGE_DEADLIFT: 'hip_hinge',
  LUNGE: 'lunge',
  PLANK: 'plank',
  JUMPING_JACK: 'jumping_jack',
  HIGH_KNEES: 'high_knees',
}

export const exerciseIdOf = (code: string) => EXERCISE_ID_BY_CODE[code] ?? code.toLowerCase()

export const toApiGoal = (goal: GoalId) => goal.toUpperCase() as ApiGoal
export const fromApiGoal = (goal: ApiGoal) => goal.toLowerCase() as GoalId

// 캐릭터 코드는 BE 예시(CHARACTER_01) 형식에 맞춘다. char-1 ↔ CHARACTER_01
export function toCharacterCode(characterId: string) {
  const n = /^char-(\d+)$/.exec(characterId)?.[1]
  return n ? `CHARACTER_${n.padStart(2, '0')}` : characterId
}

export function fromCharacterCode(code: string) {
  const n = /^CHARACTER_(\d+)$/.exec(code)?.[1]
  return n ? `char-${Number(n)}` : code
}

function toRoutineItem(e: RoutineExerciseResponse): RoutineItem {
  const isTimed = e.measureType === 'TIME'
  return {
    exerciseId: exerciseIdOf(e.exerciseCode),
    name: e.name,
    tag: e.tag ?? '',
    order: e.sortOrder,
    sets: e.targetSets,
    targetReps: isTimed ? undefined : (e.targetCount ?? undefined),
    targetSeconds: isTimed ? (e.targetSeconds ?? undefined) : undefined,
  }
}

export function toRoutine(r: RoutineResponse, userId: string): Routine {
  return {
    routineId: String(r.routineId),
    userId,
    round: r.roundNo,
    goal: fromApiGoal(r.goal),
    items: [...r.exercises].sort((a, b) => a.sortOrder - b.sortOrder).map(toRoutineItem),
    prevRoutineId: r.previousRoutineId == null ? undefined : String(r.previousRoutineId),
    basedOnSessionId: r.basedOnWorkoutId == null ? undefined : String(r.basedOnWorkoutId),
    changeReasons: r.adjustmentReasons?.length ? r.adjustmentReasons : undefined,
    // 다음 회차 판정 기준·증가 폭은 서버도 시연용 임시 규칙이다 (PL-SOBVBH)
    provisional: r.adjustmentType != null,
  }
}

/**
 * 운동 1개 수행 기록을 서버 형식으로 바꾼다.
 * 측정 못 한 운동은 값을 모두 비운다 (서버가 NOT_MEASURED에 값이 있으면 400-4로 거절한다).
 */
export function toRecordRequest(e: RoutineExerciseResponse, rec: ExerciseRecord | undefined): ExerciseRecordRequest {
  const empty: ExerciseRecordRequest = {
    routineExerciseId: e.routineExerciseId,
    measurementStatus: 'NOT_MEASURED',
    validCount: null,
    belowStandardCount: null,
    undeterminedCount: null,
    actualSeconds: null,
    performedSets: null,
    postureResult: null,
  }
  if (!rec || rec.measurementStatus !== 'MEASURED') return empty
  const isTimed = e.measureType === 'TIME'
  return {
    ...empty,
    measurementStatus: 'MEASURED',
    validCount: isTimed ? null : rec.validReps,
    // 시간형은 유효 유지 시간, 횟수형은 실제로 운동한 시간
    actualSeconds: isTimed ? rec.validSeconds : Math.round(rec.durationMs / 1000),
    // 자세 판정 형식이 정해질 때까지 프론트 피드백을 그대로 보낸다
    postureResult: { postureNotes: rec.postureNotes },
  }
}

function postureNotesOf(v: unknown): ExerciseRecord['postureNotes'] {
  if (typeof v !== 'object' || v === null || !('postureNotes' in v) || !Array.isArray(v.postureNotes)) return []
  return v.postureNotes.filter(
    (n): n is ExerciseRecord['postureNotes'][number] =>
      typeof n === 'object' && n !== null && (n.kind === 'good' || n.kind === 'fix') && typeof n.text === 'string',
  )
}

/** 서버에 확정된 기록을 화면용으로 바꾼다. 서버에 없는 값(운동 시간 등)은 base에서 가져온다. */
export function fromRecordResponse(r: ExerciseRecordResponse, base: ExerciseRecord | undefined, item: RoutineItem | undefined): ExerciseRecord {
  const isMeasured = r.measurementStatus === 'MEASURED'
  const isTimed = r.measureType === 'TIME'
  const validReps = isMeasured && !isTimed ? (r.validCount ?? 0) : 0
  const validSeconds = isMeasured && isTimed ? (r.actualSeconds ?? 0) : 0
  const goal = item ? ((isTimed ? item.targetSeconds : item.targetReps) ?? 0) * item.sets : 0
  return {
    exerciseId: exerciseIdOf(r.exerciseCode),
    name: r.exerciseName,
    measurementStatus: r.measurementStatus,
    validReps,
    validSeconds,
    durationMs: base?.durationMs ?? (isMeasured && !isTimed ? (r.actualSeconds ?? 0) * 1000 : validSeconds * 1000),
    completed: goal > 0 && (isTimed ? validSeconds : validReps) >= goal,
    postureNotes: postureNotesOf(r.postureResult),
  }
}

/** 시간대 없는 서버 시각(KST)을 ms로 바꾼다 */
export function parseServerTime(s: string | null): number | null {
  if (!s) return null
  const t = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}+09:00`)
  return Number.isNaN(t) ? null : t
}

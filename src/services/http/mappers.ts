// 서버 값 ↔ 프론트 도메인 값 변환.
// 운동 ID는 자세 판정(lib/pose)·가이드(config/exercises)가 쓰는 프론트 ID로 바꿔 둔다.

import type { ExerciseRecord, GoalId, Participant, ParticipantStatus, Routine, RoutineItem } from '../../types/domain'
import type {
  ApiGoal,
  ExerciseRecordRequest,
  ExerciseRecordResponse,
  PublicPartyFinishRequest,
  RoutineExerciseResponse,
  RoutineResponse,
  RtParticipantView,
  RtProgressStatus,
  RtStatusPayload,
} from './types'

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

/** 공개 파티(선셋) 점핑잭 기록을 서버 형식으로 바꾼다. 측정 못 했으면 값을 모두 비운다 (친구 운동방과 같은 규칙) */
export function toPublicPartyFinishRequest(rec: ExerciseRecord | undefined): PublicPartyFinishRequest {
  const empty: PublicPartyFinishRequest = {
    measurementStatus: 'NOT_MEASURED',
    validCount: null,
    belowStandardCount: null,
    undeterminedCount: null,
    actualSeconds: null,
    postureResult: null,
  }
  if (!rec || rec.measurementStatus !== 'MEASURED') return empty
  return {
    ...empty,
    measurementStatus: 'MEASURED',
    validCount: rec.validReps,
    actualSeconds: Math.round(rec.durationMs / 1000),
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

// ───── 운동방 실시간 연결 ─────

// 서버는 진행 상태를 5가지만 안다. 준비 완료·일시정지·유효 횟수는 아직 서버로 전달되지 않는다 (BE 요청 대상)
const TO_RT_STATUS: Record<ParticipantStatus, RtProgressStatus> = {
  waiting: 'WAITING',
  ready: 'WAITING',
  exercising: 'EXERCISING',
  paused: 'RESTING',
  resting: 'RESTING',
  done: 'FINISHED',
}

const FROM_RT_STATUS: Record<RtProgressStatus, ParticipantStatus> = {
  WAITING: 'waiting',
  EXERCISING: 'exercising',
  RESTING: 'resting',
  FINISHED: 'done',
  // 카메라를 못 쓰는 친구는 운동이 멈춘 상태로 보여 준다
  CAMERA_ERROR: 'paused',
}

/** 서버 운동 이름 최대 길이 */
const RT_EXERCISE_NAME_MAX = 50

export function toRtStatus(p: Pick<Participant, 'status' | 'currentExercise'>): RtStatusPayload {
  return {
    // 서버 운동 ID는 숫자인데 FE 운동 ID는 문자열이라 보내지 않는다. 화면에는 이름만 쓴다
    exerciseId: null,
    exerciseName: p.currentExercise ? p.currentExercise.slice(0, RT_EXERCISE_NAME_MAX) : null,
    progressStatus: TO_RT_STATUS[p.status],
  }
}

export function fromRtStatus(s: RtStatusPayload): Pick<Participant, 'status' | 'currentExercise'> {
  return { status: FROM_RT_STATUS[s.progressStatus] ?? 'waiting', currentExercise: s.exerciseName ?? undefined }
}

export function fromRtParticipant(v: RtParticipantView): Participant {
  return {
    userId: String(v.participantId),
    nickname: v.nickname,
    characterId: fromCharacterCode(v.characterCode),
    ...fromRtStatus(v),
    lastSeenAt: 0,
  }
}

// 서버 리액션 코드는 영문 대문자·숫자·밑줄만 된다. 화면은 이모지를 쓴다
const REACTION_CODES: Record<string, string> = { '🔥': 'FIRE', '👏': 'CLAP', '💪': 'MUSCLE' }

export function toReactionCode(reaction: string) {
  if (REACTION_CODES[reaction]) return REACTION_CODES[reaction]
  return /^[A-Z0-9_]{1,30}$/.test(reaction) ? reaction : 'FIRE'
}

export function fromReactionCode(code: string) {
  return Object.keys(REACTION_CODES).find((emoji) => REACTION_CODES[emoji] === code) ?? '🔥'
}

/** 관절 좌표: FE는 [x, y, z, v] × 33 한 줄, 서버는 관절별 배열. 소수 3자리(가시성 2자리)로 줄여 2KB 한도 안에 둔다 */
export function toRtLandmarks(flat: ArrayLike<number>): number[][] | null {
  if (flat.length === 0 || flat.length % 4 !== 0 || flat.length > 33 * 4) return null
  const out: number[][] = []
  for (let i = 0; i < flat.length; i += 4) {
    const x = flat[i], y = flat[i + 1], z = flat[i + 2], v = flat[i + 3]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(v)) return null
    out.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(z * 1000) / 1000, Math.round(v * 100) / 100])
  }
  return out
}

export function fromRtLandmarks(nested: number[][]): number[] {
  const out: number[] = []
  for (const lm of nested) out.push(lm[0] ?? 0, lm[1] ?? 0, lm[2] ?? 0, lm[3] ?? 1)
  return out
}

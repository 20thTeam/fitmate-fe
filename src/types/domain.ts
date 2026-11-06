// 도메인 타입. manyfast 기능명세의 dataSpec 슬롯을 기준으로 정의했다.
// 백엔드가 붙으면 API 응답 타입도 이 파일을 기준으로 맞춘다.

export type GoalId = 'weight_loss' | 'posture' | 'strength' | 'stamina'

export const GOALS: { id: GoalId; label: string }[] = [
  { id: 'weight_loss', label: '체중 감량' },
  { id: 'posture', label: '자세 개선' },
  { id: 'strength', label: '근력 강화' },
  { id: 'stamina', label: '체력 증진' },
]

/** 임시 사용자 (F-MZLVEJ). 정식 회원가입 없음. */
export interface Profile {
  userId: string
  nickname: string
  characterId: string
}

/** 루틴의 운동 1개. 횟수형 또는 시간형. */
export interface RoutineItem {
  exerciseId: string
  name: string
  order: number
  sets: number
  /** 횟수형이면 targetReps, 시간형이면 targetSeconds 중 하나만 채운다. */
  targetReps?: number
  targetSeconds?: number
}

/** 회차별 루틴 (F-UZFEMP, F-SYGFQC). */
export interface Routine {
  routineId: string
  userId: string
  round: number
  goal: GoalId
  items: RoutineItem[]
  /** 2회차 이상: 근거가 된 이전 세션과 변경 이유 */
  basedOnSessionId?: string
  changeReasons?: string[]
  /** 시연용 임시 규칙으로 만들어졌는지. true면 화면에 임시 표시를 한다. */
  provisional: boolean
}

/** 운동 1개의 실제 수행 기록 (F-XNIIJM dataSpec). */
export interface ExerciseRecord {
  exerciseId: string
  validReps: number
  validSeconds: number
  durationMs: number
  completed: boolean
  /** 측정된 자세 피드백만 담는다. 없으면 빈 배열. */
  postureNotes: string[]
}

/** 한 회차 운동 세션 결과 (F-XXCKUD). */
export interface WorkoutSession {
  sessionId: string
  userId: string
  roomId: string
  routineId: string
  round: number
  goal: GoalId
  startedAt: number
  endedAt: number
  records: ExerciseRecord[]
}

export type ParticipantStatus = 'waiting' | 'exercising' | 'resting' | 'done'

/** 운동방 참가자 상태 (F-ERSUOK, F-WJAOCO). */
export interface Participant {
  userId: string
  nickname: string
  characterId: string
  currentExercise?: string
  status: ParticipantStatus
  /** 마지막 메시지 수신 시각. 오래되면 '연결 불안정'으로 표시한다. */
  lastSeenAt: number
}

/** 3D 캐릭터에 반영할 관절 좌표. MediaPipe Pose 33개 랜드마크 기준. */
export interface PoseFrame {
  userId: string
  t: number
  /** [x, y, z, visibility] * 33 */
  landmarks: number[]
}

/** 응원 이벤트 (F-HEIEZC dataSpec). */
export interface CheerEvent {
  fromUserId: string
  toUserId: string
  reaction: string
  at: number
}

/** 팀 경험치. 산식 미정이라 값이 없을 수 있다 (F-WFAMYP). */
export interface TeamProgress {
  teamId: string
  /** 산식이 확정되기 전에는 null → 화면에 '산정 기준 준비 중'으로 표시 */
  gainedXp: number | null
  totalXp: number | null
  level: number | null
}

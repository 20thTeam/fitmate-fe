// 팀 백엔드 API 형식 (Swagger /v3/api-docs 기준, 2026-11-12 확인). BE와 정한 형식을 그대로 옮겨 적는다.
// 공개 파티 오픈 상태(GET /api/public-parties/current)와 실시간 partyId 입장은 BE main 코드 기준이다 (2026-11-12 배포 서버에는 아직 없음).

export type ApiGoal = 'WEIGHT_LOSS' | 'POSTURE' | 'STRENGTH' | 'STAMINA'
export type ApiMeasureType = 'COUNT' | 'TIME'
export type ApiMeasurementStatus = 'MEASURED' | 'NOT_MEASURED'
/** ROUTINE 루틴 운동(친구 운동방), PUBLIC_PARTY 공개 파티(선셋) */
export type ApiWorkoutKind = 'ROUTINE' | 'PUBLIC_PARTY'

export interface ParticipantCreateResponse {
  participantId: number
  clientToken: string
  nickname: string
  characterCode: string
}

export interface ParticipantResponse {
  participantId: number
  nickname: string
  characterCode: string
  roomId: number | null
}

export interface RoomResponse {
  roomId: number
  name: string
  capacity: number
  teamId: number
  teamName: string
}

export interface RoutineExerciseResponse {
  routineExerciseId: number
  exerciseId: number
  exerciseCode: string
  name: string
  tag: string | null
  measureType: ApiMeasureType
  sortOrder: number
  targetCount: number | null
  targetSeconds: number | null
  targetSets: number
}

export interface RoutineResponse {
  routineId: number
  roundNo: number
  goal: ApiGoal
  goalName: string
  status: 'PREPARING' | 'COMPLETED' | 'UNAVAILABLE'
  exercises: RoutineExerciseResponse[]
  // 아래는 다음 회차 추천에서 채워진다 (첫 회차는 null·빈 목록). 예전에 이 브라우저에 보관한 응답에는 없을 수 있다
  previousRoutineId?: number | null
  basedOnWorkoutId?: number | null
  /** UP 상향, KEEP 유지, UNAVAILABLE 기록이 없어 분석 불가(올리지 않음) */
  adjustmentType?: 'UP' | 'KEEP' | 'UNAVAILABLE' | null
  /** 운동별 조정 사유 (순서대로) */
  adjustmentReasons?: string[]
}

export interface NextRoundCreateRequest {
  workoutId: number
}

export interface ExerciseRecordRequest {
  routineExerciseId: number
  measurementStatus: ApiMeasurementStatus
  /** 횟수형 측정 시 필수. 시간형·미측정은 null */
  validCount: number | null
  belowStandardCount: number | null
  undeterminedCount: number | null
  /** 시간형 측정 시 필수 (유효 유지 시간) */
  actualSeconds: number | null
  performedSets: number | null
  /** 형식 미정이라 프론트 자세 피드백을 그대로 담는다. 미측정은 null */
  postureResult: unknown
}

export interface ExerciseRecordResponse {
  recordId: number
  /** 공개 파티 기록은 null */
  routineExerciseId: number | null
  exerciseCode: string
  exerciseName: string
  measureType: ApiMeasureType
  measurementStatus: ApiMeasurementStatus
  validCount: number | null
  belowStandardCount: number | null
  undeterminedCount: number | null
  actualSeconds: number | null
  performedSets: number | null
  postureResult: unknown
}

export interface WorkoutResponse {
  workoutId: number
  kind: ApiWorkoutKind
  /** 공개 파티면 null */
  routineId: number | null
  /** 입장 전이거나 공개 파티면 null */
  roomId: number | null
  status: 'IN_PROGRESS' | 'FINISHED'
  /** 시간대 없는 서버 시각 (KST) */
  startedAt: string
  finishedAt: string | null
  records: ExerciseRecordResponse[]
}

export interface TeamXpChangeResponse {
  status: 'ACCRUED' | 'FORMULA_UNDECIDED' | 'NO_TEAM' | 'NOT_FINISHED'
  teamId: number | null
  teamName: string | null
  earnedXp: number | null
  totalXp: number | null
  level: number | null
  leveledUp: boolean | null
}

export interface WorkoutResultResponse {
  workout: WorkoutResponse
  teamXp: TeamXpChangeResponse
}

/** 내 성장 기록 (GET /api/participants/me/history). 종료한 운동만, 최근 종료 순 */
export interface HistoryWorkoutResponse {
  workoutId: number
  kind: ApiWorkoutKind
  // 아래 넷은 공개 파티면 null
  routineId: number | null
  roundNo: number | null
  goal: ApiGoal | null
  goalName: string | null
  /** 시간대 없는 서버 시각 (KST) */
  startedAt: string
  finishedAt: string
  /** 시작~종료 시간(초). 쉬는 시간 포함 */
  elapsedSeconds: number
  /** 운동별 실제 소요 시간 합(초). 보낸 값이 없으면 null */
  exerciseSeconds: number | null
  /** 측정된 운동의 유효 횟수 합. 측정된 횟수형 운동이 없으면 null(0이 아님) */
  totalValidCount: number | null
  adjustmentType: 'UP' | 'KEEP' | 'UNAVAILABLE' | null
  adjustmentReasons: string[]
  earnedXp: number | null
  records: ExerciseRecordResponse[]
  nextRoutine: {
    routineId: number
    roundNo: number
    adjustmentType: 'UP' | 'KEEP' | 'UNAVAILABLE'
    adjustmentReasons: string[]
  } | null
}

export interface HistoryResponse {
  summary: {
    workoutCount: number
    totalElapsedSeconds: number
    totalExerciseSeconds: number | null
    totalValidCount: number | null
    totalEarnedXp: number | null
  }
  workouts: HistoryWorkoutResponse[]
}

/** 공개 파티 운동 종료 (POST /api/public-parties/workouts/{id}/finish). 본인 점핑잭 기록 하나 */
export interface PublicPartyFinishRequest {
  measurementStatus: ApiMeasurementStatus
  /** 측정됨이면 필수. 미측정은 null (0으로 보내지 않는다) */
  validCount: number | null
  belowStandardCount: number | null
  undeterminedCount: number | null
  /** 일시정지를 뺀 실제 운동 시간(초). 모르면 null */
  actualSeconds: number | null
  /** 형식 미정이라 프론트 자세 피드백을 그대로 담는다. 미측정은 null */
  postureResult: unknown
}

/** 공개 파티 오픈 상태 (GET /api/public-parties/current) */
export interface PublicPartyResponse {
  /** 실시간 JOIN의 partyId */
  partyId: number
  name: string
  status: 'OPEN' | 'CLOSED'
  /** 열려 있으면 이번에 연 시각, 닫혀 있으면 다음에 여는 시각 (오프셋 포함, 예: 2026-11-11T22:00:00+09:00) */
  opensAt: string
  /** opensAt 구간이 닫히는 시각 */
  closesAt: string
  /** 지금 실시간 방에 있는 인원 (재접속 대기 포함) */
  participantCount: number
}

export interface TeamXpResponse {
  teamId: number
  teamName: string
  formulaDecided: boolean
  totalXp: number | null
  level: number | null
  levelMinXp: number | null
  nextLevelXp: number | null
  maxLevel: boolean | null
}

// ───── 운동방 실시간 연결 (/ws). BE docs/실시간_메시지_형식.md 기준 ─────

export type RtProgressStatus = 'WAITING' | 'EXERCISING' | 'RESTING' | 'FINISHED' | 'CAMERA_ERROR'
export type RtConnectionStatus = 'CONNECTED' | 'UNSTABLE'

export interface RtParticipantView {
  participantId: number
  nickname: string
  characterCode: string
  exerciseId: number | null
  exerciseName: string | null
  progressStatus: RtProgressStatus
  connectionStatus: RtConnectionStatus
}

export interface RtStatusPayload {
  exerciseId: number | null
  exerciseName: string | null
  progressStatus: RtProgressStatus
}

export interface RtCheerPayload {
  targetParticipantId: number
  reaction: string
}

export interface RtErrorPayload {
  code: string
  message: string
  closed: boolean
}

/** 서버 → 클라이언트 공통 봉투. 친구 운동방이면 roomId, 공개 파티면 partyId만 채워진다 */
export type RtServerMessage = { roomId: number | null; partyId?: number | null; participantId: number | null; sentAt: string } & (
  /** 공개 파티는 정원이 없어 capacity가 null */
  | { type: 'ROOM_SNAPSHOT'; payload: { capacity: number | null; participants: RtParticipantView[] } }
  | { type: 'PARTICIPANT_JOINED'; payload: RtParticipantView }
  | { type: 'PARTICIPANT_LEFT'; payload: { reason: 'LEFT' | 'TIMEOUT' } }
  | { type: 'PARTICIPANT_STATUS'; payload: RtStatusPayload }
  | { type: 'PARTICIPANT_POSE'; payload: { landmarks: number[][] } }
  | { type: 'CHEER_RECEIVED' | 'CHEER_SENT'; payload: RtCheerPayload }
  | { type: 'CONNECTION_STATUS'; payload: { connectionStatus: RtConnectionStatus } }
  | { type: 'PONG'; payload: null }
  | { type: 'ERROR'; payload: RtErrorPayload }
)

/**
 * JOIN 대상. 친구 운동방(REST 입장 필요)·공개 파티(REST 입장 없음)·학교 대항 챌린지 판 중 하나만 보낸다.
 * 챌린지 판은 참가자 토큰 없이 판 참가 API가 준 playerId로 들어간다 (fitmate-be#34 댓글로 요청한 형식, 서버 배포 전)
 */
export type RtJoinTarget = { roomId: number } | { partyId: number } | { contestGameId: string; playerId: string }

/** 클라이언트 → 서버 */
export type RtClientMessage =
  | { type: 'JOIN'; payload: { token?: string } & RtJoinTarget }
  | { type: 'STATUS'; payload: RtStatusPayload }
  | { type: 'POSE'; payload: { landmarks: number[][] } }
  | { type: 'CHEER'; payload: RtCheerPayload }
  | { type: 'PING' }
  | { type: 'LEAVE' }

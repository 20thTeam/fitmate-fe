// 팀 백엔드 API 형식 (Swagger /v3/api-docs 기준, 2026-11-11 확인). BE와 정한 형식을 그대로 옮겨 적는다.

export type ApiGoal = 'WEIGHT_LOSS' | 'POSTURE' | 'STRENGTH' | 'STAMINA'
export type ApiMeasureType = 'COUNT' | 'TIME'
export type ApiMeasurementStatus = 'MEASURED' | 'NOT_MEASURED'

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
  routineExerciseId: number
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
  routineId: number | null
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

// 도메인 타입. manyfast 기능명세의 dataSpec 슬롯을 기준으로 정의했다.
// 백엔드가 붙으면 API 응답 타입도 이 파일을 기준으로 맞춘다.

export type GoalId = 'weight_loss' | 'posture' | 'strength' | 'stamina'

// 화면 문구는 Figma 목표 선택 시안을 따른다. id는 백엔드 계약이라 그대로 둔다.
// posture는 시안에 '스트레칭'이었지만 서버·임시 루틴 모두 스쿼트·힙 힌지·플랭크라서 실제 내용에 맞춰 '자세 개선'으로 쓴다
export const GOALS: { id: GoalId; label: string; desc: string }[] = [
  { id: 'strength', label: '근력 운동', desc: '전신 근육을 탄탄하게!' },
  { id: 'stamina', label: '유산소 운동', desc: '더 가볍게, 더 건강하게!' },
  { id: 'posture', label: '자세 개선', desc: '바른 자세로 가볍게!' },
  { id: 'weight_loss', label: '다이어트 운동', desc: '지금 바로 시작해요!' },
]

export const goalLabel = (g: GoalId | null | undefined) => GOALS.find((x) => x.id === g)?.label ?? ''

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
  /** 운동 설명 태그 (예: '자세 개선 · 하체 근력 강화') */
  tag: string
  order: number
  sets: number
  /** 횟수형이면 targetReps, 시간형이면 targetSeconds 중 하나만 채운다. (세트당 목표) */
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
  /** 2회차 이상: 근거가 된 이전 루틴·세션과 변경 이유 */
  prevRoutineId?: string
  basedOnSessionId?: string
  changeReasons?: string[]
  /** 1회차부터 목표량을 몇 번 올렸는지. 난이도 표시에만 쓰는 화면 값이라 서버 계약에는 없다. 없으면 0 */
  difficultyStep?: number
  /** 시연용 임시 규칙으로 만들어졌는지. true면 화면에 임시 표시를 한다. */
  provisional: boolean
  /** 서버 추천을 받지 못해 규칙 기반 추천(lib/recommend)으로 대신 만들었는지. 이 루틴의 기록은 서버에 저장되지 않는다. */
  isFallback?: boolean
}

/** 운동 1개를 카메라·자세 인식으로 실제 측정했는지 (BE 수행 기록 형식과 같은 값) */
export type MeasurementStatus = 'MEASURED' | 'NOT_MEASURED'

/** 운동 1개의 실제 수행 기록 (F-XNIIJM dataSpec). */
export interface ExerciseRecord {
  exerciseId: string
  name: string
  /** 자세 인식이 한 번도 안 된 운동은 NOT_MEASURED. 이때 횟수·시간은 0이어도 기록으로 보여주지 않는다. 예전 기록에는 없다. */
  measurementStatus?: MeasurementStatus
  validReps: number
  validSeconds: number
  /** 실제 운동한 시간 (일시정지 제외) */
  durationMs: number
  completed: boolean
  /** 측정된 자세 피드백만 담는다. 없으면 빈 배열. */
  postureNotes: { kind: 'good' | 'fix'; text: string }[]
}

export type SessionKind = 'party' | 'sunset'

/** 공개 운동방(선셋 에어로빅) 운영 상태 (F-DXORMB). 운영 시각은 PM 확정 전 임시값이다. */
/**
 * 공개 운동방 운영 모드 (운영 화면에서 바꾼다). AUTO: 운영 시각대로, OPEN·CLOSED: 시각과 상관없이 열거나 닫는다.
 * 시연 시간이 운영 시각과 다를 때 쓴다.
 */
export type PublicPartyMode = 'AUTO' | 'OPEN' | 'CLOSED'

/** 공개 운동방 운영 시각 (한국 시간, 매일). 운영 화면에서 바꾼다 (#41) */
export interface PublicPartySchedule {
  /** 여는 시각 'HH:mm' (예: '22:00') */
  openTime: string
  /** 여는 시간(분) */
  durationMin: number
}

export interface SunsetStatus {
  isOpen: boolean
  /** 열려 있으면 이번에 연 시각, 닫혀 있으면 다음 오픈 시각 */
  nextOpenAt: number
  /** 열려 있을 때 닫히는 시각. 닫혀 있거나, 운영 화면에서 강제로 연 동안은 null */
  closesAt: number | null
  /** 서버가 알려 준 지금 참가 인원. 서버 값이 없으면 null (인원을 지어내지 않는다) */
  participantCount: number | null
  /** 매일 운영 시각. 서버가 알려 주지 않으면 임시 운영 시각 */
  schedule: PublicPartySchedule
}

/**
 * 친구 운동방 하나 (F-STRTHT). 방마다 실시간 연결과 참가자 목록이 따로다.
 * 시연 당일 여러 팀이 동시에 쓰도록 방을 여러 개 둔다.
 */
export interface FriendRoom {
  roomId: string
  name: string
  /** 정원. 친구 파티는 5명 (PARTY_MAX) */
  capacity: number
}

/** 한 회차 운동 세션 결과 (F-XXCKUD). */
export interface WorkoutSession {
  sessionId: string
  kind: SessionKind
  userId: string
  roomId: string
  /** 선셋은 루틴이 없다 */
  routineId: string | null
  round: number | null
  goal: GoalId | null
  startedAt: number
  endedAt: number
  /** 일시정지를 뺀 실제 운동 시간 */
  activeMs: number
  records: ExerciseRecord[]
}

export type ParticipantStatus = 'waiting' | 'ready' | 'exercising' | 'paused' | 'resting' | 'done'

/** 운동방 참가자 상태 (F-ERSUOK, F-WJAOCO). 모두 실제 참가자가 보낸 값. */
export interface Participant {
  userId: string
  nickname: string
  characterId: string
  goal?: GoalId
  /** 대기실에서 보여줄 이번 회차 운동 요약 */
  routineSummary?: string
  currentExercise?: string
  /** 현재 운동의 유효 횟수 */
  validReps?: number
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
  nextLevelXp: number | null
}

// ── 학교 대항 스쿼트 챌린지 (/univ-contest). manyfast 기획에 없는 시연 당일 이벤트라 기능 ID가 없다 ──

/**
 * 한 판의 진행 상태. 서버 시각 기준으로 정한다.
 * - WAITING   : 참가자를 모으는 중 (누구나 시작 가능)
 * - COUNTDOWN : 시작을 눌러 카운트다운 중
 * - RUNNING   : 운동 중
 * - FINISHED  : 모두 결과를 냈거나 제출 마감이 지남
 */
export type ContestGameStatus = 'WAITING' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED'

export interface ContestPlayer {
  playerId: string
  nickname: string
  schoolId: string
  /** 제출 전이거나 자세가 한 번도 인식되지 않았으면 null. null은 순위·학교 합계에 넣지 않는다 */
  reps: number | null
  hasSubmitted: boolean
}

export interface ContestGame {
  gameId: string
  status: ContestGameStatus
  /** 운동 시작 시각(epoch ms, 서버 시계). 시작 전이면 null */
  startAt: number | null
  durationMs: number
  maxPlayers: number
  players: ContestPlayer[]
  /** 응답을 만든 서버 시각. 브라우저 시계와의 차이를 맞추는 데 쓴다 */
  serverNow: number
}

export interface ContestSchoolStanding {
  schoolId: string
  /** 측정된 판 결과의 합 */
  totalReps: number
  /** 결과를 낸 참가 횟수 */
  entryCount: number
}

export interface ContestTopPlayer {
  nickname: string
  schoolId: string
  reps: number
}

export interface ContestStandings {
  schools: ContestSchoolStanding[]
  /** 한 판 기록 기준 개인 상위 */
  topPlayers: ContestTopPlayer[]
  gameCount: number
}

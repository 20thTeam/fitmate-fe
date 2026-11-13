// 프론트가 백엔드에 기대하는 계약(인터페이스).
// 화면 코드는 이 인터페이스만 쓰고, 실제 구현은 services/index.ts 에서 고른다.
//   - local : 브라우저 안에서만 동작 (localStorage + BroadcastChannel). 백엔드 없이 개발/시연용.
//   - http  : 팀 백엔드가 준비되면 여기에 구현을 추가한다 (services/http/*).

import type {
  CheerEvent,
  ContestGame,
  ContestStandings,
  GoalId,
  Participant,
  PoseFrame,
  Profile,
  Routine,
  SessionKind,
  SunsetStatus,
  TeamProgress,
  WorkoutSession,
} from '../types/domain'

export interface ProfileService {
  /** 같은 브라우저의 기존 임시 사용자를 복원한다. 없으면 null. */
  restore(): Promise<Profile | null>
  create(input: { nickname: string; characterId: string }): Promise<Profile>
}

export interface RoutineService {
  /** 1회차 추천 (F-UZFEMP) */
  recommendFirst(userId: string, goal: GoalId): Promise<Routine>
  /** 직전 파티 세션 기반 다음 회차 추천 (F-SYGFQC). 같은 세션이면 같은 결과를 돌려준다. */
  recommendNext(session: WorkoutSession): Promise<Routine>
  get(routineId: string): Promise<Routine | null>
}

export interface RecordService {
  /**
   * 운동을 시작하며 기록 ID(sessionId)를 받는다.
   * 같은 루틴(선셋은 진행 중인 공개 파티 기록)이 있으면 같은 ID를 돌려준다 (재접속 시 이어 하기).
   */
  startSession(input: { kind: SessionKind; routineId: string | null }): Promise<string>
  /**
   * startSession으로 받은 sessionId로 기록을 확정한다.
   * sessionId 기준으로 중복 저장하지 않고, 이미 확정된 기록이면 성공으로 본다.
   */
  saveSession(session: WorkoutSession): Promise<void>
  getSession(sessionId: string): Promise<WorkoutSession | null>
  /** 본인 기록만 반환 (F-YBENHN) */
  listSessions(userId: string): Promise<WorkoutSession[]>
}

export interface PublicPartyService {
  /** 공개 운동방(선셋) 운영 상태 (F-DXORMB). 서버가 답하지 않으면 임시 운영 시각으로 계산한다 */
  getStatus(): Promise<SunsetStatus>
}

export interface TeamService {
  /** 세션 기록을 팀 경험치에 반영. 같은 sessionId는 중복 적립하지 않는다. */
  applySession(roomId: string, session: WorkoutSession): Promise<TeamProgress>
  get(roomId: string): Promise<TeamProgress>
}

/**
 * 내 실시간 연결 상태. 친구의 연결 상태는 Participant.lastSeenAt으로 따로 판단한다.
 * - connected    : 정상
 * - slow         : 연결은 있지만 서버 응답이 늦음
 * - reconnecting : 끊겨서 다시 연결하는 중 (친구 상태는 최신이 아닐 수 있음)
 * - replaced     : 같은 프로필로 다른 창에서 입장해 이 창 연결이 닫힘. 자동으로 다시 붙지 않는다
 * - closed       : 다시 연결할 수 없음 (정원 초과·참가자 없음 등). 사용자가 다시 시도해야 함
 */
export type ConnectionState = 'connected' | 'slow' | 'reconnecting' | 'replaced' | 'closed'

/** 실시간 운동방 연결 (F-STRTHT, F-ERSUOK, F-JENTLD, F-HEIEZC, F-DXORMB) */
export interface RoomConnection {
  readonly roomId: string
  readonly selfId: string
  updateSelf(patch: Partial<Omit<Participant, 'userId' | 'lastSeenAt'>>): void
  publishPose(frame: Omit<PoseFrame, 'userId'>): void
  sendCheer(toUserId: string, reaction: string): void
  onParticipants(cb: (list: Participant[]) => void): () => void
  onPose(cb: (frame: PoseFrame) => void): () => void
  onCheer(cb: (ev: CheerEvent) => void): () => void
  /** 등록하자마자 지금 상태를 한 번 알려 준다 */
  onConnection(cb: (state: ConnectionState) => void): () => void
  leave(): void
}

export type JoinResult =
  | { ok: true; conn: RoomConnection }
  | { ok: false; reason: 'full' | 'network' }

export interface JoinOptions {
  /** 친구 파티는 5명, 선셋 공개 파티는 제한 없음(null) */
  maxParticipants: number | null
  /** 입장 시 바로 알릴 내 상태 */
  initial?: Partial<Omit<Participant, 'userId' | 'lastSeenAt'>>
}

export interface RealtimeService {
  join(roomId: string, me: Profile, options: JoinOptions): Promise<JoinResult>
}

/** 운영 화면(/admin)에 보여줄 서버 운동방 한 개 */
export interface AdminRoom {
  roomId: string
  name: string
  capacity: number
  teamName: string
  /** 팀 경험치. 조회에 실패하면 null. 산식 미정이면 안의 값이 null (F-WFAMYP) */
  team: TeamProgress | null
}

/**
 * 운영 화면(/admin)용. manyfast 기획에 없는 화면이라 기능 ID가 없다.
 * 서버에 운영용 API(전체 참가자·전체 기록·접속자·초기화)가 아직 없어서 지금 있는 공개 API만 쓴다.
 */
export interface AdminService {
  readonly backend: 'local' | 'http'
  /** 서버 운동방과 팀 경험치. local은 서버 방이 없어서 빈 배열 */
  listRooms(): Promise<AdminRoom[]>
  /** 이 브라우저에 보관한 참가자·루틴·기록을 지운다. 서버 데이터는 그대로 남는다 */
  clearDevice(): Promise<void>
}

/**
 * 학교 대항 스쿼트 챌린지 (/univ-contest). 노트북 여러 대가 서버의 같은 판에 들어와 동시에 20초 스쿼트를 한다.
 * manyfast 기획에 없는 시연 당일 이벤트라 기능 ID가 없다. 판 상태는 서버 시각(startAt, serverNow) 기준이다.
 */
export interface ContestService {
  /**
   * 집계가 저장되는 곳. http 구현은 서버에 챌린지 API가 없으면(404) 이 브라우저 저장으로 바꾼다.
   * 첫 호출이 끝나기 전에는 'unknown'
   */
  storage(): 'server' | 'device' | 'unknown'
  /** 학교별 누적 횟수와 개인 상위 기록 */
  getStandings(): Promise<ContestStandings>
  /** 모집 중인 판에 들어간다. 없거나 가득 찼으면 새 판을 만든다 */
  joinGame(input: { nickname: string; schoolId: string }): Promise<{ playerId: string; game: ContestGame }>
  getGame(gameId: string): Promise<ContestGame>
  /** 누구나 시작할 수 있다. 이미 시작된 판이면 그대로 돌려준다 */
  startGame(gameId: string, playerId: string): Promise<ContestGame>
  /** 내 결과. 자세가 한 번도 인식되지 않았으면 reps=null (측정 안 함, 합계에 넣지 않는다) */
  submitResult(gameId: string, playerId: string, reps: number | null): Promise<ContestGame>
  /** 시작 전에 판에서 나간다 */
  leaveGame(gameId: string, playerId: string): Promise<void>
}

export interface Services {
  admin: AdminService
  contest: ContestService
  profile: ProfileService
  routine: RoutineService
  record: RecordService
  team: TeamService
  realtime: RealtimeService
  publicParty: PublicPartyService
}

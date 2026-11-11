// 프론트가 백엔드에 기대하는 계약(인터페이스).
// 화면 코드는 이 인터페이스만 쓰고, 실제 구현은 services/index.ts 에서 고른다.
//   - local : 브라우저 안에서만 동작 (localStorage + BroadcastChannel). 백엔드 없이 개발/시연용.
//   - http  : 팀 백엔드가 준비되면 여기에 구현을 추가한다 (services/http/*).

import type {
  CheerEvent,
  GoalId,
  Participant,
  PoseFrame,
  Profile,
  Routine,
  SessionKind,
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
   * 같은 루틴으로 진행 중인 기록이 있으면 같은 ID를 돌려준다 (재접속 시 이어 하기).
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

export interface Services {
  profile: ProfileService
  routine: RoutineService
  record: RecordService
  team: TeamService
  realtime: RealtimeService
}

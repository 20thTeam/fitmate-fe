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
  /** 직전 세션 기반 다음 회차 추천 (F-SYGFQC) */
  recommendNext(session: WorkoutSession): Promise<Routine>
  get(routineId: string): Promise<Routine | null>
}

export interface RecordService {
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

/** 실시간 운동방 연결 (F-STRTHT, F-ERSUOK, F-JENTLD, F-HEIEZC) */
export interface RoomConnection {
  readonly roomId: string
  readonly selfId: string
  updateSelf(patch: Partial<Omit<Participant, 'userId' | 'lastSeenAt'>>): void
  publishPose(frame: Omit<PoseFrame, 'userId'>): void
  sendCheer(toUserId: string, reaction: string): void
  onParticipants(cb: (list: Participant[]) => void): () => void
  onPose(cb: (frame: PoseFrame) => void): () => void
  onCheer(cb: (ev: CheerEvent) => void): () => void
  leave(): void
}

export type JoinResult =
  | { ok: true; conn: RoomConnection }
  | { ok: false; reason: 'full' | 'network' }

export interface RealtimeService {
  join(roomId: string, me: Profile): Promise<JoinResult>
}

export interface Services {
  profile: ProfileService
  routine: RoutineService
  record: RecordService
  team: TeamService
  realtime: RealtimeService
}

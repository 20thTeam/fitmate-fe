// 팀 백엔드(VITE_API_URL) 어댑터.
// - 참가자: 서버가 발급한 재방문 토큰을 이 브라우저에 보관하고 모든 요청 헤더에 담는다.
// - 루틴: 1회차는 서버 추천. 서버가 실패하면 규칙 기반 추천(lib/recommend)으로 대신 만든다.
//   다음 회차 추천 API는 아직 없어서 규칙 기반으로 만들고, 그 루틴의 기록은 이 브라우저에만 저장한다.
// - 기록: 시작할 때 서버 운동 기록 ID를 받아 sessionId로 쓰고, 끝날 때 그 ID로 확정한다.
//   서버에 없는 화면용 값(운동 종류·일시정지 뺀 시간 등)은 이 브라우저에 같이 보관한다.
// - 실시간 운동방은 서버 연결 전이라 로컬(BroadcastChannel)을 그대로 쓴다.

import type { Profile, Routine, TeamProgress, WorkoutSession } from '../../types/domain'
import type { ProfileService, RecordService, RoutineService, Services, TeamService } from '../ports'
import { buildFirstRoutine, buildNextRoutine } from '../../lib/recommend'
import { readJson, uid, writeJson } from '../local/storage'
import { localRealtime } from '../local/realtime'
import { ApiError, request } from './client'
import { exerciseIdOf, fromCharacterCode, fromRecordResponse, parseServerTime, toApiGoal, toCharacterCode, toRecordRequest, toRoutine } from './mappers'
import type {
  ParticipantCreateResponse,
  ParticipantResponse,
  RoomResponse,
  RoutineResponse,
  TeamXpResponse,
  WorkoutResponse,
  WorkoutResultResponse,
} from './types'

const KEY = {
  auth: 'fitmate.http.auth',
  serverRoutines: 'fitmate.http.serverRoutines',
  localRoutines: 'fitmate.http.localRoutines',
  sessions: 'fitmate.http.sessions',
}

/** 앱 첫 화면이 이 확인을 기다리므로 짧게 둔다 */
const RESTORE_TIMEOUT_MS = 3000

interface Auth {
  profile: Profile
  token: string
}

/** 서버가 발급한 ID는 숫자다. 규칙 기반으로 만든 루틴·기기에만 저장한 기록은 UUID다. */
const isServerId = (id: string | null | undefined): id is string => !!id && /^\d+$/.test(id)

const readAuth = () => readJson<Auth | null>(KEY.auth, null)

function tokenOf() {
  const auth = readAuth()
  if (!auth) throw new ApiError('http', '참가자 정보가 없어요. 프로필을 다시 만들어 주세요.', 404, '404-2')
  return auth.token
}

// ───── 참가자 ─────

const profile: ProfileService = {
  async restore() {
    const auth = readAuth()
    if (!auth) return null
    try {
      const me = await request<ParticipantResponse>('/api/participants/me', { token: auth.token, timeoutMs: RESTORE_TIMEOUT_MS })
      const p: Profile = { userId: String(me.participantId), nickname: me.nickname, characterId: fromCharacterCode(me.characterCode) }
      writeJson(KEY.auth, { ...auth, profile: p })
      return p
    } catch (e) {
      // 서버가 토큰을 모르면(데이터 초기화 등) 프로필을 다시 만들게 한다
      if (e instanceof ApiError && e.status === 404) {
        writeJson(KEY.auth, null)
        return null
      }
      // 서버가 잠깐 안 될 때는 보관한 프로필로 들어간다
      return auth.profile
    }
  },
  async create({ nickname, characterId }) {
    const res = await request<ParticipantCreateResponse>('/api/participants', {
      method: 'POST',
      body: { nickname, characterCode: toCharacterCode(characterId) },
    })
    const p: Profile = { userId: String(res.participantId), nickname: res.nickname, characterId }
    writeJson(KEY.auth, { profile: p, token: res.clientToken } satisfies Auth)
    return p
  },
}

// ───── 루틴 ─────

const readServerRoutines = () => readJson<Record<string, RoutineResponse>>(KEY.serverRoutines, {})
const readLocalRoutines = () => readJson<Record<string, Routine>>(KEY.localRoutines, {})

function cacheServerRoutine(r: RoutineResponse) {
  writeJson(KEY.serverRoutines, { ...readServerRoutines(), [String(r.routineId)]: r })
  return r
}

function saveLocalRoutine(r: Routine) {
  writeJson(KEY.localRoutines, { ...readLocalRoutines(), [r.routineId]: r })
  return r
}

/** 서버 루틴 원본 (기록 확정에 routineExerciseId가 필요하다) */
async function fetchServerRoutine(routineId: string): Promise<RoutineResponse> {
  try {
    return cacheServerRoutine(await request<RoutineResponse>(`/api/routines/${routineId}`, { token: tokenOf() }))
  } catch (e) {
    const cached = readServerRoutines()[routineId]
    if (cached && !(e instanceof ApiError && e.status === 404)) return cached
    throw e
  }
}

const userIdOf = () => readAuth()?.profile.userId ?? ''

const routine: RoutineService = {
  async recommendFirst(userId, goal) {
    try {
      const res = await request<RoutineResponse>('/api/routines', { method: 'POST', body: { goal: toApiGoal(goal) }, token: tokenOf() })
      if (res.status === 'COMPLETED' && res.exercises.length > 0) return toRoutine(cacheServerRoutine(res), userId)
    } catch {
      // 아래 규칙 기반 추천으로 넘어간다
    }
    // 서버 추천 실패·추천 불가 → 규칙 기반 추천 (F-UZFEMP 대비 흐름)
    return saveLocalRoutine({ ...buildFirstRoutine(userId, goal), isFallback: true })
  },
  async recommendNext(session) {
    // 같은 세션으로 이미 만든 추천이 있으면 그대로 돌려준다 (결과 화면 재방문 대비)
    const existing = Object.values(readLocalRoutines()).find((r) => r.basedOnSessionId === session.sessionId)
    if (existing) return existing
    if (!session.routineId) throw new Error('루틴이 없는 세션은 다음 회차 추천에 쓰지 않아요')
    const prev = await routine.get(session.routineId)
    if (!prev) throw new Error('이전 루틴을 찾을 수 없어요')
    return saveLocalRoutine(buildNextRoutine(prev, session))
  },
  async get(routineId) {
    if (!isServerId(routineId)) return readLocalRoutines()[routineId] ?? null
    try {
      return toRoutine(await fetchServerRoutine(routineId), userIdOf())
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },
}

// ───── 운동 기록 ─────

const readSessions = () => readJson<WorkoutSession[]>(KEY.sessions, [])

function cacheSession(s: WorkoutSession) {
  writeJson(KEY.sessions, [...readSessions().filter((x) => x.sessionId !== s.sessionId), s])
}

let roomPromise: Promise<RoomResponse> | null = null

/** 시연은 지정 운동방 하나다 (GET /api/rooms 의 첫 번째 방) */
function demoRoom() {
  roomPromise ??= request<RoomResponse[]>('/api/rooms').then((rooms) => {
    if (!rooms[0]) throw new ApiError('http', '운동방이 없어요', 404, '404-4')
    return rooms[0]
  })
  roomPromise.catch(() => {
    roomPromise = null
  })
  return roomPromise
}

// 결과 화면이 기록과 팀 경험치를 같이 불러서 같은 요청을 잠깐 나눠 쓴다
const resultRequests = new Map<string, Promise<WorkoutResultResponse>>()

function fetchResult(sessionId: string) {
  let p = resultRequests.get(sessionId)
  if (!p) {
    p = request<WorkoutResultResponse>(`/api/workouts/${sessionId}/result`, { token: tokenOf() })
    resultRequests.set(sessionId, p)
    const clear = () => setTimeout(() => resultRequests.delete(sessionId), 3000)
    p.then(clear, () => resultRequests.delete(sessionId))
  }
  return p
}

async function mergeResult(res: WorkoutResultResponse, cached: WorkoutSession | undefined): Promise<WorkoutSession | null> {
  const w = res.workout
  if (w.status !== 'FINISHED') return cached ?? null
  const routineId = w.routineId === null ? null : String(w.routineId)
  const r = routineId ? await routine.get(routineId).catch(() => null) : null
  const startedAt = parseServerTime(w.startedAt) ?? cached?.startedAt ?? Date.now()
  const endedAt = parseServerTime(w.finishedAt) ?? cached?.endedAt ?? startedAt
  const records = w.records.map((rec, i) => {
    const id = exerciseIdOf(rec.exerciseCode)
    const base = cached?.records[i]?.exerciseId === id ? cached.records[i] : cached?.records.find((x) => x.exerciseId === id)
    return fromRecordResponse(rec, base, r?.items.find((it) => it.exerciseId === id))
  })
  return {
    sessionId: String(w.workoutId),
    kind: cached?.kind ?? 'party',
    userId: userIdOf(),
    roomId: cached?.roomId ?? String(w.roomId ?? ''),
    routineId,
    round: r?.round ?? cached?.round ?? null,
    goal: r?.goal ?? cached?.goal ?? null,
    startedAt,
    endedAt,
    // 서버는 일시정지 시간을 모른다. 이 기기 기록이 없으면 시작~종료 시간으로 보여준다
    activeMs: cached?.activeMs ?? Math.max(0, endedAt - startedAt),
    records,
  }
}

const record: RecordService = {
  async startSession({ routineId }) {
    // 선셋(루틴 없음)과 규칙 기반 루틴은 서버 기록이 없어서 이 기기 ID를 쓴다
    if (!isServerId(routineId)) return uid()
    const token = tokenOf()
    // 운동 기록에 지금 입장한 방이 남도록 먼저 입장한다 (팀 경험치 적립 대상)
    const room = await demoRoom()
    await request<RoomResponse>(`/api/rooms/${room.roomId}/enter`, { method: 'POST', token })
    const w = await request<WorkoutResponse>('/api/workouts', { method: 'POST', body: { routineId: Number(routineId) }, token })
    return String(w.workoutId)
  },
  async saveSession(s) {
    if (isServerId(s.sessionId) && isServerId(s.routineId)) {
      const r = await fetchServerRoutine(s.routineId)
      const exercises = [...r.exercises].sort((a, b) => a.sortOrder - b.sortOrder)
      const records = exercises.map((e, i) => {
        const id = exerciseIdOf(e.exerciseCode)
        const rec = s.records[i]?.exerciseId === id ? s.records[i] : s.records.find((x) => x.exerciseId === id)
        return toRecordRequest(e, rec)
      })
      try {
        await request<WorkoutResponse>(`/api/workouts/${s.sessionId}/finish`, { method: 'POST', body: { records }, token: tokenOf() })
      } catch (e) {
        // 409-1: 이미 확정된 기록 (응답이 늦어 다시 누른 경우 등). 중복 저장하지 않고 성공으로 본다
        if (!(e instanceof ApiError && e.status === 409)) throw e
      }
    }
    cacheSession(s)
  },
  async getSession(id) {
    const cached = readSessions().find((s) => s.sessionId === id)
    if (!isServerId(id)) return cached ?? null
    try {
      return await mergeResult(await fetchResult(id), cached)
    } catch (e) {
      if (cached) return cached
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },
  async listSessions(userId) {
    // 서버에 내 기록 목록 API가 아직 없어서 이 기기에 보관한 기록을 보여준다
    return readSessions().filter((s) => s.userId === userId)
  },
}

// ───── 팀 경험치 ─────

const noTeamXp = (teamId: string): TeamProgress => ({ teamId, gainedXp: null, totalXp: null, level: null, nextLevelXp: null })

async function fetchTeamXp(teamId: number) {
  return request<TeamXpResponse>(`/api/teams/${teamId}/xp`)
}

const team: TeamService = {
  // 경험치 적립은 서버가 운동 종료 때 한다. 여기서는 이번 운동으로 바뀐 값을 읽기만 한다
  async applySession(roomId, session) {
    if (!isServerId(session.sessionId)) return noTeamXp(roomId)
    const { teamXp } = await fetchResult(session.sessionId)
    // 산식 미정·팀 없음이면 수치를 만들지 않는다 (F-WFAMYP)
    if (teamXp.status !== 'ACCRUED' || teamXp.teamId === null) return noTeamXp(roomId)
    const xp = await fetchTeamXp(teamXp.teamId).catch(() => null)
    return {
      teamId: String(teamXp.teamId),
      gainedXp: teamXp.earnedXp,
      totalXp: teamXp.totalXp,
      level: teamXp.level,
      nextLevelXp: xp?.nextLevelXp ?? null,
    }
  },
  // 프론트 운동방 ID(DEMO_ROOM_ID)와 서버 방 ID가 달라서 서버의 지정 운동방 팀을 쓴다
  async get() {
    const room = await demoRoom()
    const xp = await fetchTeamXp(room.teamId)
    if (!xp.formulaDecided) return noTeamXp(String(room.teamId))
    return { teamId: String(xp.teamId), gainedXp: null, totalXp: xp.totalXp, level: xp.level, nextLevelXp: xp.nextLevelXp }
  },
}

export const httpServices: Services = { profile, routine, record, team, realtime: localRealtime }

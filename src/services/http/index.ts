// 팀 백엔드(VITE_API_URL) 어댑터.
// - 참가자: 서버가 발급한 재방문 토큰을 이 브라우저에 보관하고 모든 요청 헤더에 담는다.
// - 루틴: 1회차·다음 회차 모두 서버 추천. 서버가 추천 불가를 주면 규칙 기반 추천(lib/recommend)으로 대신 만들고,
//   그 루틴의 기록은 이 브라우저에만 저장한다.
// - 기록: 시작할 때 서버 운동 기록 ID를 받아 sessionId로 쓰고, 끝날 때 그 ID로 확정한다.
//   서버에 없는 화면용 값(운동 종류·일시정지 뺀 시간 등)은 이 브라우저에 같이 보관한다.
// - 공개 운동방(선셋): 루틴 없이 공개 파티 기록을 시작·종료한다(/api/public-parties/workouts). 팀 경험치는 쌓이지 않는다.
//   오픈 상태(/api/public-parties/current)와 실시간 partyId 입장은 서버에 있으면 쓰고,
//   없는 서버(2026-11-12 배포본)면 임시 운영 시각(lib/sunset)과 같은 브라우저 탭끼리 연결(BroadcastChannel)로 대신한다.
// - 실시간: 친구 운동방은 서버 웹소켓(/ws)으로 다른 PC와 연결한다(http/realtime.ts).

import type { ExerciseRecord, Profile, Routine, SunsetStatus, TeamProgress, WorkoutSession } from '../../types/domain'
import type { AdminPublicParty, AdminService, ProfileService, PublicPartyService, RealtimeService, RecordService, RoutineService, Services, TeamService } from '../ports'
import { buildFirstRoutine, buildNextRoutine } from '../../lib/recommend'
import { clearAll, readJson, uid, writeJson } from '../local/storage'
import { localRealtime } from '../local/realtime'
import { DEMO_ROOM_ID, SUNSET_ROOM_ID } from '../../store/app'
import { SUNSET_EXERCISE } from '../../config/provisional'
import { devSunsetOverride, getSunsetStatus } from '../../lib/sunset'
import { ApiError, request, WS_URL } from './client'
import { createWsRealtime } from './realtime'
import { httpContest } from './contest'
import {
  exerciseIdOf,
  fromApiGoal,
  fromCharacterCode,
  fromRecordResponse,
  parseServerTime,
  toApiGoal,
  toCharacterCode,
  toPublicPartyFinishRequest,
  toRecordRequest,
  toRoutine,
} from './mappers'
import type {
  HistoryResponse,
  HistoryWorkoutResponse,
  NextRoundCreateRequest,
  ParticipantCreateResponse,
  ParticipantResponse,
  PublicPartyResponse,
  AdminPublicPartyResponse,
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
  difficultySteps: 'fitmate.http.difficultySteps',
  sessions: 'fitmate.http.sessions',
}

/** 앱 첫 화면이 이 확인을 기다리므로 짧게 둔다 */
const RESTORE_TIMEOUT_MS = 3000
/** 선셋 화면은 임시 운영 시각으로 먼저 그리고 서버 값을 기다리므로 짧게 둔다 */
const PARTY_STATUS_TIMEOUT_MS = 4000

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

// 난이도 표시는 화면 값이라 서버에 없다. 서버 루틴별로 이 브라우저에 보관한다
const readDifficultySteps = () => readJson<Record<string, number>>(KEY.difficultySteps, {})

function serverRoutineOf(r: RoutineResponse): Routine {
  const routineId = String(r.routineId)
  return { ...toRoutine(r, userIdOf()), difficultyStep: readDifficultySteps()[routineId] ?? 0 }
}

const isUsable = (r: RoutineResponse) => r.status === 'COMPLETED' && r.exercises.length > 0

/** 서버 다음 회차 추천 (F-SYGFQC). 같은 운동 기록으로 다시 요청하면 서버가 처음 만든 추천을 돌려준다. */
async function recommendNextOnServer(session: WorkoutSession, prev: Routine): Promise<Routine | null> {
  let res: RoutineResponse
  try {
    res = await request<RoutineResponse>('/api/routines/next-round', {
      method: 'POST',
      body: { workoutId: Number(session.sessionId) } satisfies NextRoundCreateRequest,
      token: tokenOf(),
    })
  } catch (e) {
    // 서버가 잠깐 안 될 때는 이전에 받아 둔 추천을 쓴다. 없으면 결과 화면이 다시 시도를 보여준다
    const cached = Object.values(readServerRoutines()).find((r) => String(r.basedOnWorkoutId) === session.sessionId)
    // 404·409처럼 서버가 거절한 요청은 보관본으로 덮지 않는다
    if (cached && !(e instanceof ApiError && e.kind === 'http' && e.status < 500)) return serverRoutineOf(cached)
    throw e
  }
  if (!isUsable(res)) return null
  cacheServerRoutine(res)
  const routineId = String(res.routineId)
  const steps = readDifficultySteps()
  if (steps[routineId] === undefined) {
    // 회차가 늘어도 목표량을 올리지 않았으면 난이도도 그대로다
    writeJson(KEY.difficultySteps, { ...steps, [routineId]: (prev.difficultyStep ?? 0) + (res.adjustmentType === 'UP' ? 1 : 0) })
  }
  return serverRoutineOf(res)
}

const routine: RoutineService = {
  async recommendFirst(userId, goal) {
    try {
      const res = await request<RoutineResponse>('/api/routines', { method: 'POST', body: { goal: toApiGoal(goal) }, token: tokenOf() })
      if (isUsable(res)) return toRoutine(cacheServerRoutine(res), userId)
    } catch {
      // 아래 규칙 기반 추천으로 넘어간다
    }
    // 서버 추천 실패·추천 불가 → 규칙 기반 추천 (F-UZFEMP 대비 흐름)
    return saveLocalRoutine({ ...buildFirstRoutine(userId, goal), isFallback: true })
  },
  async recommendNext(session) {
    if (!session.routineId) throw new Error('루틴이 없는 세션은 다음 회차 추천에 쓰지 않아요')
    const prev = await routine.get(session.routineId)
    if (!prev) throw new Error('이전 루틴을 찾을 수 없어요')
    // 서버에 기록된 운동이면 서버가 추천한다. 그래야 다음 회차 기록도 서버에 남는다
    if (isServerId(session.sessionId) && isServerId(session.routineId)) {
      const next = await recommendNextOnServer(session, prev)
      if (next) return next
    }
    // 서버 기록이 없거나 서버가 추천 불가를 줬을 때만 규칙 기반 추천. 같은 세션이면 이미 만든 추천을 돌려준다
    const existing = Object.values(readLocalRoutines()).find((r) => r.basedOnSessionId === session.sessionId)
    if (existing) return existing
    return saveLocalRoutine({ ...buildNextRoutine(prev, session), isFallback: true })
  },
  async get(routineId) {
    if (!isServerId(routineId)) return readLocalRoutines()[routineId] ?? null
    try {
      return serverRoutineOf(await fetchServerRoutine(routineId))
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

/** 공개 파티 기록은 서버 운동 코드(JUMPING_JACK)를 선셋 동작 ID로 맞추고, 목표량이 없어 인정된 동작이 있으면 완료로 본다 (Sunset.tsx와 같은 규칙) */
function toSunsetRecord(r: ExerciseRecord): ExerciseRecord {
  return { ...r, exerciseId: SUNSET_EXERCISE.exerciseId, completed: r.measurementStatus === 'MEASURED' && r.validReps > 0 }
}

async function mergeResult(res: WorkoutResultResponse, cached: WorkoutSession | undefined): Promise<WorkoutSession | null> {
  const w = res.workout
  if (w.status !== 'FINISHED') return cached ?? null
  const isSunset = w.kind === 'PUBLIC_PARTY'
  const routineId = w.routineId === null ? null : String(w.routineId)
  const r = routineId ? await routine.get(routineId).catch(() => null) : null
  const startedAt = parseServerTime(w.startedAt) ?? cached?.startedAt ?? Date.now()
  const endedAt = parseServerTime(w.finishedAt) ?? cached?.endedAt ?? startedAt
  const records = w.records.map((rec, i) => {
    if (isSunset) return toSunsetRecord(fromRecordResponse(rec, cached?.records[i], undefined))
    const id = exerciseIdOf(rec.exerciseCode)
    const base = cached?.records[i]?.exerciseId === id ? cached.records[i] : cached?.records.find((x) => x.exerciseId === id)
    return fromRecordResponse(rec, base, r?.items.find((it) => it.exerciseId === id))
  })
  // 선셋은 보낸 운동 시간(일시정지 제외)이 있으면 그 값을 쓴다
  const sunsetMs = isSunset ? records.reduce((sum, x) => sum + x.durationMs, 0) : 0
  return {
    sessionId: String(w.workoutId),
    kind: isSunset ? 'sunset' : 'party',
    userId: userIdOf(),
    roomId: isSunset ? SUNSET_ROOM_ID : (cached?.roomId ?? String(w.roomId ?? '')),
    routineId,
    round: r?.round ?? cached?.round ?? null,
    goal: r?.goal ?? cached?.goal ?? null,
    startedAt,
    endedAt,
    // 서버는 일시정지 시간을 모른다. 이 기기 기록이 없으면 시작~종료 시간으로 보여준다
    activeMs: cached?.activeMs ?? (sunsetMs || Math.max(0, endedAt - startedAt)),
    records,
  }
}

/** 서버 성장 기록 1건을 화면용 세션으로 바꾼다. 서버에 없는 값(일시정지 뺀 시간·운동 종류 등)은 이 기기 보관본에서 가져온다 */
function fromHistoryWorkout(w: HistoryWorkoutResponse, cached: WorkoutSession | undefined, userId: string): WorkoutSession {
  const startedAt = parseServerTime(w.startedAt) ?? cached?.startedAt ?? Date.now()
  const endedAt = parseServerTime(w.finishedAt) ?? cached?.endedAt ?? startedAt
  const isSunset = w.kind === 'PUBLIC_PARTY'
  const records = w.records.map((rec, i) => {
    if (isSunset) return toSunsetRecord(fromRecordResponse(rec, cached?.records[i], undefined))
    const id = exerciseIdOf(rec.exerciseCode)
    const base = cached?.records.find((x) => x.exerciseId === id)
    const r = fromRecordResponse(rec, base, undefined)
    // 목록 응답에는 목표량이 없어서 목표 달성 여부는 이 기기 기록이 있을 때만 쓴다
    return { ...r, completed: base?.completed ?? false }
  })
  return {
    sessionId: String(w.workoutId),
    kind: isSunset ? 'sunset' : 'party',
    userId,
    roomId: isSunset ? SUNSET_ROOM_ID : (cached?.roomId ?? DEMO_ROOM_ID),
    routineId: w.routineId === null ? null : String(w.routineId),
    round: w.roundNo,
    goal: w.goal ? fromApiGoal(w.goal) : null,
    startedAt,
    endedAt,
    // 서버는 일시정지 시간을 모른다. 이 기기 기록이 없으면 운동별 소요 시간 합, 그것도 없으면 시작~종료 시간으로 보여준다
    activeMs: cached?.activeMs ?? (w.exerciseSeconds ?? w.elapsedSeconds) * 1000,
    records,
  }
}

/** 기록 확정. 409-1(이미 확정됨: 응답이 늦어 다시 누른 경우 등)은 중복 저장하지 않고 성공으로 본다 */
async function finishOnce(path: string, body: unknown) {
  try {
    await request<WorkoutResponse>(path, { method: 'POST', body, token: tokenOf() })
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e
  }
}

const record: RecordService = {
  async startSession({ kind, routineId }) {
    // 선셋은 루틴 없이 공개 파티 기록을 만든다. 진행 중인 공개 파티 기록이 있으면 서버가 그 기록을 돌려준다(새로고침해도 하나)
    if (kind === 'sunset') {
      const w = await request<WorkoutResponse>('/api/public-parties/workouts', { method: 'POST', token: tokenOf() })
      return String(w.workoutId)
    }
    // 규칙 기반 루틴은 서버 기록이 없어서 이 기기 ID를 쓴다
    if (!isServerId(routineId)) return uid()
    const token = tokenOf()
    // 운동 기록에 지금 입장한 방이 남도록 먼저 입장한다 (팀 경험치 적립 대상)
    const room = await demoRoom()
    await request<RoomResponse>(`/api/rooms/${room.roomId}/enter`, { method: 'POST', token })
    const w = await request<WorkoutResponse>('/api/workouts', { method: 'POST', body: { routineId: Number(routineId) }, token })
    return String(w.workoutId)
  },
  async saveSession(s) {
    if (s.kind === 'sunset' && isServerId(s.sessionId)) {
      // 측정 못 했으면 NOT_MEASURED로 보내고 횟수는 비운다 (0으로 보내지 않는다)
      await finishOnce(`/api/public-parties/workouts/${s.sessionId}/finish`, toPublicPartyFinishRequest(s.records[0]))
    } else if (isServerId(s.sessionId) && isServerId(s.routineId)) {
      const r = await fetchServerRoutine(s.routineId)
      const exercises = [...r.exercises].sort((a, b) => a.sortOrder - b.sortOrder)
      const records = exercises.map((e, i) => {
        const id = exerciseIdOf(e.exerciseCode)
        const rec = s.records[i]?.exerciseId === id ? s.records[i] : s.records.find((x) => x.exerciseId === id)
        return toRecordRequest(e, rec)
      })
      await finishOnce(`/api/workouts/${s.sessionId}/finish`, { records })
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
    const cached = readSessions().filter((s) => s.userId === userId)
    let res: HistoryResponse
    try {
      res = await request<HistoryResponse>('/api/participants/me/history', { token: tokenOf() })
    } catch (e) {
      // 서버가 잠깐 안 될 때는 이 기기 기록을 보여준다. 이 기기에 기록이 없으면 '기록 없음' 대신 다시 시도를 띄운다
      if (cached.length > 0) return cached
      throw e
    }
    // 서버 기록이 기준이다 (다른 기기·브라우저에서 한 운동·공개 파티 포함, F-YBENHN). 규칙 기반 루틴과 예전 선셋 기록은 서버에 없어서 이 기기 보관본을 붙인다
    const byId = new Map(cached.map((s) => [s.sessionId, s]))
    const server = res.workouts.map((w) => fromHistoryWorkout(w, byId.get(String(w.workoutId)), userId))
    return [...server, ...cached.filter((s) => !isServerId(s.sessionId))]
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
    // 공개 파티는 서버가 팀 경험치를 쌓지 않는다
    if (session.kind === 'sunset' || !isServerId(session.sessionId)) return noTeamXp(roomId)
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

// ───── 실시간 운동방 ─────

const getToken = () => readAuth()?.token ?? null

const wsRealtime = createWsRealtime({
  getToken,
  async joinTarget(token) {
    // 서버는 REST 입장을 마친 방에만 실시간 입장을 받는다. 같은 방에 다시 들어가도 그대로다
    const room = await demoRoom()
    await request<RoomResponse>(`/api/rooms/${room.roomId}/enter`, { method: 'POST', token })
    return { roomId: room.roomId }
  },
})

const partyRealtime = createWsRealtime({
  getToken,
  async joinTarget() {
    // 공개 파티는 REST 입장이 없다. 다시 연결할 때는 처음 받은 partyId를 쓴다
    if (partyIdCache !== null) return { partyId: partyIdCache }
    const p = await fetchPublicParty()
    if (!p) throw new ApiError('http', '공개 파티가 없어요', 404)
    return { partyId: p.partyId }
  },
})

const realtime: RealtimeService = {
  async join(roomId, me, options) {
    if (roomId === DEMO_ROOM_ID && WS_URL) return wsRealtime.join(roomId, me, options)
    if (roomId === SUNSET_ROOM_ID && WS_URL) {
      let party: PublicPartyResponse | null
      try {
        party = await fetchPublicParty()
      } catch {
        // 서버가 안 되거나 늦으면 혼자 따로 연결하지 않고 다시 시도 화면을 띄운다 (다른 PC 참가자와 갈라지지 않게)
        return { ok: false, reason: 'network' }
      }
      // 열려 있으면 다른 PC 참가자와 연결한다. 오픈 상태 API가 없는 서버이거나,
      // 닫힌 시간에 개발용으로 연 경우(?sunset=open)는 같은 브라우저 탭끼리만 연결한다
      if (party?.status === 'OPEN') return partyRealtime.join(roomId, me, options)
    }
    return localRealtime.join(roomId, me, options)
  },
}

// ───── 공개 운동방 운영 상태 ─────

let partyIdCache: number | null = null

/** 서버 공개 파티 상태. 오픈 상태 API가 없는 서버면 null, 서버가 안 되면 오류 */
async function fetchPublicParty(): Promise<PublicPartyResponse | null> {
  try {
    const p = await request<PublicPartyResponse>('/api/public-parties/current', { timeoutMs: PARTY_STATUS_TIMEOUT_MS })
    partyIdCache = p.partyId
    return p
  } catch (e) {
    // 404-1: 아직 오픈 상태 API가 배포되지 않은 서버
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

function toSunsetStatus(p: PublicPartyResponse): SunsetStatus | null {
  const opensAt = Date.parse(p.opensAt)
  // 운영 화면에서 강제로 연 동안은 닫는 시각이 없다
  const closesAt = p.closesAt === null ? null : Date.parse(p.closesAt)
  if (Number.isNaN(opensAt) || (closesAt !== null && Number.isNaN(closesAt))) return null
  const isOpen = p.status === 'OPEN'
  return { isOpen, nextOpenAt: opensAt, closesAt: isOpen ? closesAt : null, participantCount: p.participantCount }
}

function toAdminPublicParty(p: AdminPublicPartyResponse): AdminPublicParty {
  const status = toSunsetStatus(p)
  if (!status) throw new ApiError('http', '공개 파티 시각 형식이 올바르지 않아요')
  return { mode: p.mode, status }
}

const publicParty: PublicPartyService = {
  async getStatus() {
    const forced = devSunsetOverride()
    if (forced) return forced
    const p = await fetchPublicParty().catch(() => null)
    // 서버가 안 되거나 오픈 상태 API가 없으면 임시 운영 시각으로 계산한다
    return (p && toSunsetStatus(p)) ?? getSunsetStatus()
  },
}


// ───── 운영 화면 ─────

const admin: AdminService = {
  backend: 'http',
  async listRooms() {
    const rooms = await request<RoomResponse[]>('/api/rooms')
    return Promise.all(
      rooms.map(async (room) => {
        const xp = await fetchTeamXp(room.teamId).catch(() => null)
        // 산식 미정이면 수치를 만들지 않는다 (F-WFAMYP)
        const team = !xp
          ? null
          : !xp.formulaDecided
            ? noTeamXp(String(room.teamId))
            : { teamId: String(xp.teamId), gainedXp: null, totalXp: xp.totalXp, level: xp.level, nextLevelXp: xp.nextLevelXp }
        return { roomId: String(room.roomId), name: room.name, capacity: room.capacity, teamName: room.teamName, team }
      }),
    )
  },
  needsAdminKey: true,
  async getPublicParty(adminKey) {
    try {
      return toAdminPublicParty(await request<AdminPublicPartyResponse>('/api/admin/public-party', { adminKey }))
    } catch (e) {
      // 아직 이 운영 API가 배포되지 않은 서버
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },
  async setPublicPartyMode(mode, adminKey) {
    return toAdminPublicParty(await request<AdminPublicPartyResponse>('/api/admin/public-party', { method: 'PUT', body: { mode }, adminKey }))
  },
  async clearDevice() {
    clearAll()
  },
}

export const httpServices: Services = { admin, contest: httpContest, profile, routine, record, team, realtime, publicParty }

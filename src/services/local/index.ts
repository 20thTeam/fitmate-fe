// 백엔드 없이 동작하는 로컬 구현.
// 실시간은 BroadcastChannel이라 "같은 브라우저의 여러 탭" 사이에서만 연결된다.
// 서로 다른 PC 연결은 팀 백엔드(WebSocket 등)가 붙어야 한다.

import type { GoalId, Profile, Routine, TeamProgress, WorkoutSession } from '../../types/domain'
import type { AdminService, ProfileService, PublicPartyService, RecordService, RoutineService, Services, TeamService } from '../ports'
import { buildFirstRoutine, buildNextRoutine } from '../../lib/recommend'
import { clearAll, readJson, uid, writeJson } from './storage'
import { localRealtime } from './realtime'
import { clearLocalContest, localContest } from './contest'
import { localRooms } from './rooms'
import { devSunsetOverride, readLocalSunsetMode, readLocalSunsetSchedule, sunsetStatusWithMode, writeLocalSunsetMode, writeLocalSunsetSchedule } from '../../lib/sunset'

const KEY = {
  profile: 'fitmate.profile',
  routines: 'fitmate.routines',
  sessions: 'fitmate.sessions',
}

const profile: ProfileService = {
  async restore() {
    return readJson<Profile | null>(KEY.profile, null)
  },
  async create({ nickname, characterId }) {
    const p: Profile = { userId: uid(), nickname, characterId }
    writeJson(KEY.profile, p)
    return p
  },
}

const readRoutines = () => readJson<Record<string, Routine>>(KEY.routines, {})

function saveRoutine(r: Routine) {
  const all = readRoutines()
  all[r.routineId] = r
  writeJson(KEY.routines, all)
  return r
}

const routine: RoutineService = {
  async recommendFirst(userId: string, goal: GoalId) {
    return saveRoutine(buildFirstRoutine(userId, goal))
  },
  async recommendNext(session) {
    // 같은 세션으로 이미 만든 추천이 있으면 그대로 돌려준다 (결과 화면 재방문 대비)
    const existing = Object.values(readRoutines()).find((r) => r.basedOnSessionId === session.sessionId)
    if (existing) return existing
    if (!session.routineId) throw new Error('루틴이 없는 세션은 다음 회차 추천에 쓰지 않아요')
    const prev = readRoutines()[session.routineId]
    if (!prev) throw new Error('이전 루틴을 찾을 수 없어요')
    return saveRoutine(buildNextRoutine(prev, session))
  },
  async get(routineId) {
    return readRoutines()[routineId] ?? null
  },
}

const readSessions = () => readJson<WorkoutSession[]>(KEY.sessions, [])

const record: RecordService = {
  async startSession() {
    return uid()
  },
  async saveSession(s) {
    const all = readSessions()
    if (!all.some((x) => x.sessionId === s.sessionId)) all.push(s)
    writeJson(KEY.sessions, all)
  },
  async getSession(id) {
    return readSessions().find((s) => s.sessionId === id) ?? null
  },
  async listSessions(userId) {
    return readSessions().filter((s) => s.userId === userId)
  },
}

// 팀 경험치 산식이 미정(F-WFAMYP)이라 로컬 구현은 수치를 만들지 않는다.
const team: TeamService = {
  async applySession(roomId) {
    return team.get(roomId)
  },
  async get(roomId) {
    const empty: TeamProgress = { teamId: roomId, gainedXp: null, totalXp: null, level: null, nextLevelXp: null }
    return empty
  },
}

function localAdminPublicParty() {
  const mode = readLocalSunsetMode()
  return { mode, status: sunsetStatusWithMode(mode, readLocalSunsetSchedule()), canEditSchedule: true }
}

const publicParty: PublicPartyService = {
  async getStatus() {
    const schedule = readLocalSunsetSchedule()
    return devSunsetOverride(Date.now(), schedule) ?? sunsetStatusWithMode(readLocalSunsetMode(), schedule)
  },
}


const admin: AdminService = {
  backend: 'local',
  // 이 브라우저에서 만든 친구 운동방. 팀 경험치는 산식 미정이라 만들지 않는다 (F-WFAMYP)
  async listRooms() {
    const rooms = await localRooms.list()
    return Promise.all(rooms.map(async (r) => ({ roomId: r.roomId, name: r.name, capacity: r.capacity, teamName: r.name, team: await team.get(r.roomId) })))
  },
  async clearDevice() {
    clearAll()
  },
  needsAdminKey: false,
  async getPublicParty() {
    return localAdminPublicParty()
  },
  async setPublicPartyMode(mode) {
    writeLocalSunsetMode(mode)
    return localAdminPublicParty()
  },
  async setPublicPartySchedule(schedule) {
    writeLocalSunsetSchedule(schedule)
    return localAdminPublicParty()
  },
  async resetContest() {
    clearLocalContest()
    return 'done'
  },
}

export const localServices: Services = { admin, contest: localContest, profile, routine, record, team, realtime: localRealtime, publicParty, rooms: localRooms }

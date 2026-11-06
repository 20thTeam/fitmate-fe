// 백엔드 없이 동작하는 로컬 구현.
// 실시간은 BroadcastChannel이라 "같은 브라우저의 여러 탭" 사이에서만 연결된다.
// 서로 다른 PC 연결은 팀 백엔드(WebSocket 등)가 붙어야 한다.

import type { GoalId, Profile, Routine, TeamProgress, WorkoutSession } from '../../types/domain'
import type { RecordService, ProfileService, RoutineService, Services, TeamService } from '../ports'
import { buildFirstRoutine, buildNextRoutine } from '../../lib/recommend'
import { readJson, uid, writeJson } from './storage'
import { localRealtime } from './realtime'

const K = {
  profile: 'fitmate.profile',
  routines: 'fitmate.routines',
  sessions: 'fitmate.sessions',
  team: (roomId: string) => `fitmate.team.${roomId}`,
}

const profile: ProfileService = {
  async restore() {
    return readJson<Profile | null>(K.profile, null)
  },
  async create({ nickname, characterId }) {
    const p: Profile = { userId: uid(), nickname, characterId }
    writeJson(K.profile, p)
    return p
  },
}

function saveRoutine(r: Routine) {
  const all = readJson<Record<string, Routine>>(K.routines, {})
  all[r.routineId] = r
  writeJson(K.routines, all)
  return r
}

const routine: RoutineService = {
  async recommendFirst(userId: string, goal: GoalId) {
    return saveRoutine(buildFirstRoutine(userId, goal))
  },
  async recommendNext(session) {
    // 같은 세션으로 이미 만든 추천이 있으면 그대로 돌려준다 (결과 화면 재방문 대비)
    const existing = Object.values(readJson<Record<string, Routine>>(K.routines, {})).find(
      (r) => r.basedOnSessionId === session.sessionId,
    )
    if (existing) return existing
    const prev = await routine.get(session.routineId)
    if (!prev) throw new Error('이전 루틴을 찾을 수 없습니다')
    return saveRoutine(buildNextRoutine(prev, session))
  },
  async get(routineId) {
    return readJson<Record<string, Routine>>(K.routines, {})[routineId] ?? null
  },
}

const record: RecordService = {
  async saveSession(s) {
    const all = readJson<WorkoutSession[]>(K.sessions, [])
    if (!all.some((x) => x.sessionId === s.sessionId)) all.push(s)
    writeJson(K.sessions, all)
  },
  async getSession(id) {
    return readJson<WorkoutSession[]>(K.sessions, []).find((s) => s.sessionId === id) ?? null
  },
  async listSessions(userId) {
    return readJson<WorkoutSession[]>(K.sessions, []).filter((s) => s.userId === userId)
  },
}

// 팀 경험치 산식이 미정(F-WFAMYP)이라 로컬 구현은 수치를 만들지 않는다.
const team: TeamService = {
  async applySession(roomId) {
    return team.get(roomId)
  },
  async get(roomId) {
    return readJson<TeamProgress>(K.team(roomId), {
      teamId: roomId,
      gainedXp: null,
      totalXp: null,
      level: null,
    })
  },
}

export const localServices: Services = { profile, routine, record, team, realtime: localRealtime }

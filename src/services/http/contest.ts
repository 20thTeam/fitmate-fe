// 학교 대항 스쿼트 챌린지 서버 연결 (/api/univ-contest/*). 서버 API는 BE에 요청한 형식이다 (아직 배포 전).
// 서버가 404(챌린지 API 없음)를 주면 이 브라우저 저장(local)으로 바꾸고 화면에 '이 브라우저에만 저장' 표시를 한다.
// 시연 중에 저장 위치가 섞이지 않게, 한 번 정한 저장 위치는 새로고침 전까지 바꾸지 않는다.

import type { ContestGame, ContestStandings } from '../../types/domain'
import type { ContestService } from '../ports'
import { localContest } from '../local/contest'
import { ApiError, request } from './client'

interface ContestPlayerResponse {
  playerId: string
  nickname: string
  schoolId: string
  reps: number | null
  submitted: boolean
}

interface ContestGameResponse {
  gameId: string
  status: ContestGame['status']
  /** ISO 8601. 시작 전이면 null */
  startAt: string | null
  durationSeconds: number
  maxPlayers: number
  serverNow: string
  players: ContestPlayerResponse[]
}

const toGame = (g: ContestGameResponse): ContestGame => ({
  gameId: String(g.gameId),
  status: g.status,
  startAt: g.startAt ? Date.parse(g.startAt) : null,
  durationMs: g.durationSeconds * 1000,
  maxPlayers: g.maxPlayers,
  serverNow: Date.parse(g.serverNow),
  players: g.players.map((p) => ({
    playerId: String(p.playerId),
    nickname: p.nickname,
    schoolId: p.schoolId,
    reps: p.reps,
    hasSubmitted: p.submitted,
  })),
})

const BASE = '/api/univ-contest'

let storage: 'server' | 'device' | 'unknown' = 'unknown'

const isMissingApi = (e: unknown) => e instanceof ApiError && e.kind === 'http' && e.status === 404

export const httpContest: ContestService = {
  storage: () => storage,
  async getStandings() {
    if (storage === 'device') return localContest.getStandings()
    try {
      const s = await request<ContestStandings>(`${BASE}/standings`)
      storage = 'server'
      return s
    } catch (e) {
      // 첫 확인에서만 대체한다. 서버를 쓰던 중 생긴 오류는 그대로 실패로 보여준다
      if (storage === 'unknown' && isMissingApi(e)) {
        storage = 'device'
        return localContest.getStandings()
      }
      throw e
    }
  },
  async joinGame(input) {
    if (storage === 'device') return localContest.joinGame(input)
    const r = await request<{ playerId: string; game: ContestGameResponse }>(`${BASE}/games/join`, { method: 'POST', body: input })
    return { playerId: String(r.playerId), game: toGame(r.game) }
  },
  async getGame(gameId) {
    if (storage === 'device') return localContest.getGame(gameId)
    return toGame(await request<ContestGameResponse>(`${BASE}/games/${gameId}`, { timeoutMs: 4000 }))
  },
  async startGame(gameId, playerId) {
    if (storage === 'device') return localContest.startGame(gameId, playerId)
    return toGame(await request<ContestGameResponse>(`${BASE}/games/${gameId}/start`, { method: 'POST', body: { playerId } }))
  },
  async submitResult(gameId, playerId, reps) {
    if (storage === 'device') return localContest.submitResult(gameId, playerId, reps)
    return toGame(await request<ContestGameResponse>(`${BASE}/games/${gameId}/result`, { method: 'POST', body: { playerId, reps } }))
  },
  async leaveGame(gameId, playerId) {
    if (storage === 'device') return localContest.leaveGame(gameId, playerId)
    await request<unknown>(`${BASE}/games/${gameId}/leave`, { method: 'POST', body: { playerId } })
  },
}

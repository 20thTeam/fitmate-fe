// 학교 대항 스쿼트 챌린지 로컬 구현. 같은 브라우저의 탭끼리만 같은 판을 본다 (localStorage를 같이 읽는다).
// 서버 챌린지 API가 없을 때 http 구현도 이걸 쓴다.

import { CONTEST_RULES } from '../../config/contest'
import { buildContestStandings, contestStatusAt } from '../../lib/contest'
import type { ContestGame } from '../../types/domain'
import type { ContestService } from '../ports'
import { localRealtime } from './realtime'
import { readJson, uid, writeJson } from './storage'

const KEY = 'fitmate.contestGames'

type StoredGame = Omit<ContestGame, 'status' | 'serverNow'>

const readGames = () => readJson<StoredGame[]>(KEY, [])

const withStatus = (g: StoredGame): ContestGame => {
  const now = Date.now()
  return { ...g, status: contestStatusAt(g, now), serverNow: now }
}

function updateGame(gameId: string, fn: (g: StoredGame) => StoredGame): ContestGame {
  const games = readGames()
  const i = games.findIndex((g) => g.gameId === gameId)
  if (i < 0) throw new Error('판을 찾을 수 없어요')
  games[i] = fn(games[i])
  writeJson(KEY, games)
  return withStatus(games[i])
}

/** 이 브라우저에 보관한 챌린지 판을 모두 지운다 (운영 화면의 기록 초기화) */
export function clearLocalContest() {
  writeJson(KEY, [])
}

export const localContest: ContestService = {
  storage: () => 'device',
  // 같은 브라우저 탭끼리만 연결된다 (BroadcastChannel)
  liveRealtime: () => localRealtime,
  async getStandings() {
    return buildContestStandings(readGames().map(withStatus).filter((g) => g.status === 'FINISHED'))
  },
  async joinGame({ nickname, schoolId }) {
    const games = readGames()
    const playerId = uid()
    const player = { playerId, nickname, schoolId, reps: null, hasSubmitted: false }
    const open = games.find((g) => g.startAt === null && g.players.length < g.maxPlayers)
    if (open) {
      open.players.push(player)
      writeJson(KEY, games)
      return { playerId, game: withStatus(open) }
    }
    const game: StoredGame = {
      gameId: uid(),
      startAt: null,
      durationMs: CONTEST_RULES.durationMs,
      maxPlayers: CONTEST_RULES.maxPlayers,
      players: [player],
    }
    writeJson(KEY, [...games, game])
    return { playerId, game: withStatus(game) }
  },
  async getGame(gameId) {
    const g = readGames().find((x) => x.gameId === gameId)
    if (!g) throw new Error('판을 찾을 수 없어요')
    return withStatus(g)
  },
  async startGame(gameId) {
    return updateGame(gameId, (g) => (g.startAt !== null ? g : { ...g, startAt: Date.now() + CONTEST_RULES.countdownMs }))
  },
  async submitResult(gameId, playerId, reps) {
    return updateGame(gameId, (g) => ({
      ...g,
      players: g.players.map((p) => (p.playerId === playerId && !p.hasSubmitted ? { ...p, reps, hasSubmitted: true } : p)),
    }))
  },
  async leaveGame(gameId, playerId) {
    const games = readGames()
    const g = games.find((x) => x.gameId === gameId)
    if (!g || g.startAt !== null) return
    g.players = g.players.filter((p) => p.playerId !== playerId)
    writeJson(KEY, games.filter((x) => x.players.length > 0))
  },
}

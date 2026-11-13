// 학교 대항 스쿼트 챌린지 계산 (순수 함수). 로컬 구현과 화면이 같이 쓴다.

import { CONTEST_RULES } from '../config/contest'
import type { ContestGame, ContestGameStatus, ContestPlayer, ContestStandings } from '../types/domain'

/** 시작 시각·제출 상태로 판 상태를 정한다 */
export function contestStatusAt(game: Pick<ContestGame, 'startAt' | 'durationMs' | 'players'>, now: number): ContestGameStatus {
  if (game.startAt === null) return 'WAITING'
  if (now < game.startAt) return 'COUNTDOWN'
  const endAt = game.startAt + game.durationMs
  if (now < endAt) return 'RUNNING'
  const isAllSubmitted = game.players.length > 0 && game.players.every((p) => p.hasSubmitted)
  return isAllSubmitted || now >= endAt + CONTEST_RULES.submitGraceMs ? 'FINISHED' : 'RUNNING'
}

/** 측정된 기록만 많은 순으로. 같으면 먼저 들어온 순 */
export function rankContestPlayers(players: ContestPlayer[]): (ContestPlayer & { reps: number })[] {
  return players
    .filter((p): p is ContestPlayer & { reps: number } => p.reps !== null)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.reps - a.p.reps || a.i - b.i)
    .map(({ p }) => p)
}

/** 끝난 판들로 학교 합계와 개인 상위를 만든다 */
export function buildContestStandings(games: ContestGame[]): ContestStandings {
  const bySchool = new Map<string, { totalReps: number; entryCount: number }>()
  const entries: { nickname: string; schoolId: string; reps: number }[] = []
  let gameCount = 0
  for (const g of games) {
    const measured = rankContestPlayers(g.players)
    if (measured.length === 0) continue
    gameCount++
    for (const p of measured) {
      const s = bySchool.get(p.schoolId) ?? { totalReps: 0, entryCount: 0 }
      s.totalReps += p.reps
      s.entryCount++
      bySchool.set(p.schoolId, s)
      entries.push({ nickname: p.nickname, schoolId: p.schoolId, reps: p.reps })
    }
  }
  return {
    schools: [...bySchool].map(([schoolId, s]) => ({ schoolId, ...s })).sort((a, b) => b.totalReps - a.totalReps),
    topPlayers: entries.sort((a, b) => b.reps - a.reps).slice(0, CONTEST_RULES.topPlayerCount),
    gameCount,
  }
}

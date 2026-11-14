// 학교 대항 스쿼트 챌린지 계산 (순수 함수). 로컬 구현과 화면이 같이 쓴다.

import { CONTEST_RULES } from '../config/contest'
import type { ContestGame, ContestGameStatus, ContestPlayer, ContestPlayerBest, ContestStandings, ContestTrend, ContestTrendBucket } from '../types/domain'

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
  // 참가자별 최고 기록. 로그인 없이 참가하므로 이름·학교가 같으면 한 사람으로 본다 (서버와 같은 규칙)
  const byPlayer = new Map<string, ContestPlayerBest>()
  for (const e of entries) {
    const key = `${e.nickname}\u0000${e.schoolId}`
    const p = byPlayer.get(key)
    if (p) {
      p.bestReps = Math.max(p.bestReps, e.reps)
      p.entryCount++
    } else {
      byPlayer.set(key, { nickname: e.nickname, schoolId: e.schoolId, bestReps: e.reps, entryCount: 1 })
    }
  }
  return {
    schools: [...bySchool].map(([schoolId, s]) => ({ schoolId, ...s })).sort((a, b) => b.totalReps - a.totalReps),
    topPlayers: [...entries].sort((a, b) => b.reps - a.reps).slice(0, CONTEST_RULES.topPlayerCount),
    gameCount,
    players: [...byPlayer.values()].sort((a, b) => b.bestReps - a.bestReps),
  }
}

const HOUR_MS = 3_600_000
/** 한국 시간 = UTC+9 (서머타임 없음) */
const KST_OFFSET_MS = 9 * HOUR_MS
/** 서버(fitmate-be#43)와 같이 최근 24시간까지만 나눈다 */
const TREND_MAX_BUCKETS = 24

/** 시각이 속한 한국 시간 1시간 구간의 시작 (epoch ms) */
export const kstHourStart = (t: number) => Math.floor((t + KST_OFFSET_MS) / HOUR_MS) * HOUR_MS - KST_OFFSET_MS

/**
 * 끝난 판들로 학교별 누적 횟수·순위의 1시간 추이를 만든다. 서버 GET /api/univ-contest/trend와 같은 규칙이다.
 * 판은 시작 시각이 속한 시간에 넣고, 첫 판의 시간부터 지금 시간까지 빈 시간 없이 만든다.
 * 순위는 누적 큰 순, 같으면 학교 식별값 순이라 겹치지 않는다.
 */
export function buildContestTrend(finishedGames: ContestGame[], now: number): ContestTrend {
  const byHour = new Map<number, Map<string, number>>()
  for (const g of finishedGames) {
    if (g.startAt === null) continue
    const hour = kstHourStart(g.startAt)
    for (const p of g.players) {
      if (p.reps === null) continue
      const m = byHour.get(hour) ?? new Map<string, number>()
      m.set(p.schoolId, (m.get(p.schoolId) ?? 0) + p.reps)
      byHour.set(hour, m)
    }
  }
  if (byHour.size === 0) return { buckets: [] }

  const last = kstHourStart(now)
  const first = Math.max(Math.min(...byHour.keys()), last - (TREND_MAX_BUCKETS - 1) * HOUR_MS)
  const totals = new Map<string, number>()
  for (const [hour, m] of byHour) {
    if (hour < first) m.forEach((reps, schoolId) => totals.set(schoolId, (totals.get(schoolId) ?? 0) + reps))
  }
  const buckets: ContestTrendBucket[] = []
  for (let hour = first; hour <= last; hour += HOUR_MS) {
    const added = byHour.get(hour) ?? new Map<string, number>()
    added.forEach((reps, schoolId) => totals.set(schoolId, (totals.get(schoolId) ?? 0) + reps))
    const ranked = [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)! || (a < b ? -1 : a > b ? 1 : 0))
    buckets.push({
      startAt: hour,
      hour: new Date(hour + KST_OFFSET_MS).getUTCHours(),
      schools: ranked.map((schoolId, i) => ({ schoolId, totalReps: totals.get(schoolId)!, hourReps: added.get(schoolId) ?? 0, rank: i + 1 })),
    })
  }
  return { buckets }
}

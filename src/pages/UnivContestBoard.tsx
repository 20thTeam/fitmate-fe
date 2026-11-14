// /univ-contest/board — 학교 대항 챌린지 순위 전광판 (시연장 아이패드 전용).
// 첫 화면은 시상대. '순위 자세히 보기'를 누르면 막대·참가자 상세 ↔ 추이 그래프를 화살표·밀기·←/→로 넘겨 본다. 추이 그래프 ↔ 막대·참가자 상세를 화살표·밀기·←/→로 넘기고 5초마다 새로 받는다.
// 노트북 참가 화면(/univ-contest)과 같은 서버 기록을 본다.

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { services } from '../services'
import type { ContestStandings, ContestTrend } from '../types/domain'
import Backdrop from '../components/Backdrop'
import { Logo } from '../components/ui'
import { BarsPanel, ContestStage, PageArrow, PodiumPanel, TrendPanel, TrophyTitle } from '../components/contest/ContestRanking'
import { useArrowKeys } from '../hooks/useArrowKeys'

type BoardPage = 'podium' | 'bars' | 'trend'
/** '순위 자세히 보기'로 들어가 옆으로 넘겨 보는 두 화면 (막대·참가자 상세가 먼저). 시상대는 넘기기에 넣지 않는다 */
const DETAIL_PAGES: BoardPage[] = ['bars', 'trend']
/** 새 기록을 받는 주기 (/univ-contest 현황과 같다) */
const REFRESH_MS = 5000
/** 이만큼 넘게 밀면 페이지를 넘긴다 (화면 px) */
const SWIPE_MIN_PX = 60

const errorText = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 났어요')

export default function UnivContestBoard() {
  const [page, setPage] = useState<BoardPage>('podium')
  const [standings, setStandings] = useState<ContestStandings | null>(null)
  const [trend, setTrend] = useState<ContestTrend | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    // 한 번 실패해도 보여주던 화면은 지우지 않고, 처음부터 못 받았을 때만 오류를 띄운다
    services.contest.getStandings().then(
      (s) => {
        setStandings(s)
        setError('')
      },
      (e: unknown) => setError(errorText(e)),
    )
    services.contest.getTrend().then(setTrend, () => {})
  }, [])

  // 운영 화면에서 스크롤한 채로 넘어오면 로고가 화면 밖에 걸리므로 맨 위에서 시작한다
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const index = DETAIL_PAGES.indexOf(page)
  const prev = index > 0 ? () => setPage(DETAIL_PAGES[index - 1]) : null
  const next = index >= 0 && index < DETAIL_PAGES.length - 1 ? () => setPage(DETAIL_PAGES[index + 1]) : null
  useArrowKeys(prev, next)

  // 손가락으로 좌우로 밀어 넘기기
  const swipeFrom = useRef<number | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    swipeFrom.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    if (swipeFrom.current === null) return
    const dx = e.clientX - swipeFrom.current
    swipeFrom.current = null
    if (dx <= -SWIPE_MIN_PX) next?.()
    if (dx >= SWIPE_MIN_PX) prev?.()
  }

  const storage = services.contest.storage()

  return (
    <Backdrop theme="public">
      <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipeFrom.current = null }} style={{ touchAction: 'pan-y' }}>
        <ContestStage>
          {/* 시안대로 시상대 페이지만 제목이 조금 아래(202px)에 있다 */}
          <TrophyTitle top={page === 'podium' ? 202 : undefined}>학교별 누적 스쿼트 순위</TrophyTitle>
          {!standings && (
            <div className="contest-panel col center" style={{ marginTop: 31, width: 1251, height: 643, gap: 16 }} role={error ? 'alert' : 'status'}>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{error ? `순위를 불러오지 못했어요. ${error}` : '순위를 불러오는 중…'}</p>
              {error && <button type="button" className="contest-btn" onClick={load}>다시 시도</button>}
            </div>
          )}
          {standings && page === 'podium' && (
            <>
              <PodiumPanel standings={standings} />
              <div className="contest-actions" style={{ marginTop: 32 }}>
                <button type="button" className="contest-btn is-dark" onClick={() => setPage('bars')}>순위 자세히 보기</button>
              </div>
            </>
          )}
          {standings && page === 'trend' && <TrendPanel trend={trend} standings={standings} />}
          {standings && page === 'bars' && <BarsPanel standings={standings} />}
          {storage === 'device' && (
            <span className="chip chip-provisional" style={{ position: 'absolute', top: 40 }}>서버 연결 안 됨 · 이 기기에 저장된 기록만 보여요</span>
          )}
          {prev && <PageArrow dir="prev" onClick={prev} label="이전 화면" />}
          {next && <PageArrow dir="next" onClick={next} label="다음 화면" />}
        </ContestStage>
      </div>
      <Logo isLight />
    </Backdrop>
  )
}

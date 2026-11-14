// 학교 대항 챌린지 순위 화면 조각 (/univ-contest 현황·결과·순위 자세히 보기).
// Figma '1호선톤' 파일의 대항전 시안(대항전 첫페이지 241:2, 대항전 마지막 페이지 241:60·246:355·250:683·244:137)을 옮겼다.
// 시안이 1440×1024 기준이라 ContestStage가 그 크기로 그린 뒤 화면에 맞춰 줄인다 (시연 태블릿·노트북 어디서나 같은 비율).

import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { CONTEST_SCHOOLS, schoolColor, schoolLogo, schoolName, schoolShortName } from '../../config/contest'
import type { ContestPlayerBest, ContestStandings, ContestTopPlayer, ContestTrend } from '../../types/domain'
import trophyIcon from '../../assets/contest/trophy.png'
import crownIcon from '../../assets/contest/crown.svg'

const STAGE_W = 1440
const STAGE_H = 1024

/** 시안 크기(1440×1024)로 그린 내용을 화면에 맞춰 줄이거나 키운다. 가로세로 비율은 유지하고 가운데에 둔다 */
export function ContestStage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="contest-stage-frame">
      <div className="contest-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

/** 트로피 두 개 사이의 큰 제목 (시안: 48px Heavy, 트로피 44px) */
export function TrophyTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="contest-title">
      <img src={trophyIcon} alt="" width={44} height={44} />
      <span>{children}</span>
      <img src={trophyIcon} alt="" width={44} height={44} />
    </h1>
  )
}

/** 순위 동그라미. 1등 노랑, 2등 하늘, 3등 분홍, 그 아래 연보라 */
function RankBadge({ rank, size }: { rank: number; size: 'lg' | 'sm' }) {
  const tone = rank === 1 ? 'is-gold' : rank === 2 ? 'is-sky' : rank === 3 ? 'is-rose' : 'is-lilac'
  return <span className={`contest-rank contest-rank-${size} ${tone}`} aria-label={`${rank}위`}>{rank}</span>
}

function SchoolLogo({ schoolId, size }: { schoolId: string; size: number }) {
  const src = schoolLogo(schoolId)
  return (
    <span className="contest-logo" style={{ width: size, height: size, background: src ? '#fff' : schoolColor(schoolId) }} aria-hidden>
      {src && <img src={src} alt="" />}
    </span>
  )
}

// ───────── 현황 (첫 화면·판 결과 아래) ─────────

/** 학교별 누적 상위 3개와 한 판 최고 기록. 시안 '대항전 첫페이지' 목록형 */
export function StandingsPanels({ standings }: { standings: ContestStandings }) {
  const top = standings.schools.slice(0, 3)
  const max = Math.max(...top.map((s) => s.totalReps), 1)
  return (
    <div className="contest-panels">
      <section className="contest-panel contest-schools" aria-label="학교별 누적 스쿼트">
        <header className="contest-panel-head">
          <h2>학교별 누적 스쿼트</h2>
          <span className="contest-note">끝난 판 {standings.gameCount}개 기준 · 자세가 인식되지 않은 기록은 빼고 더해요</span>
        </header>
        <ol className="contest-school-list">
          {[0, 1, 2].map((i) => {
            const s = top[i]
            const rank = i + 1
            if (!s) {
              return (
                <li key={`empty-${i}`} className="contest-school is-empty">
                  <div className="contest-school-row">
                    <RankBadge rank={rank} size="lg" />
                    <strong className="contest-school-name">-</strong>
                    <span className="contest-sub">아직 집계된 기록이 없어요</span>
                  </div>
                </li>
              )
            }
            return (
              <li key={s.schoolId} className={`contest-school${rank === 1 ? ' is-first' : ''}`}>
                <div className="contest-school-row">
                  <RankBadge rank={rank} size="lg" />
                  {rank === 1 && <img className="contest-crown" src={crownIcon} alt="" width={34} height={34} />}
                  <strong className="contest-school-name">{schoolName(s.schoolId)}</strong>
                  <span className="contest-sub">{s.entryCount}명 참가</span>
                  <span className="contest-reps"><b>{s.totalReps}</b>회</span>
                </div>
                <div className="contest-bar"><div className="contest-bar-fill" style={{ width: `${(s.totalReps / max) * 100}%` }} /></div>
              </li>
            )
          })}
        </ol>
      </section>
      <section className="contest-panel contest-players" aria-label="한 판 최고 기록">
        <h2>한 판 최고 기록</h2>
        {standings.topPlayers.length === 0 ? (
          <p className="contest-sub">아직 끝난 판이 없어요. 첫 판을 시작해 보세요.</p>
        ) : (
          <ol className="contest-player-list">
            {standings.topPlayers.map((p: ContestTopPlayer, i) => (
              <li key={`${p.nickname}-${i}`} className="contest-player">
                <RankBadge rank={i + 1} size="sm" />
                <span className="contest-player-who">
                  <strong>{p.nickname}</strong>
                  <span>{schoolName(p.schoolId)}</span>
                </span>
                <b className="contest-player-reps">{p.reps}회</b>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/** 판 결과 화면 맨 위 한 줄. 시안 '대항전 마지막 페이지'의 안내 띠 */
export function ResultNotice({ icon, title, sub, badge }: { icon: string; title: string; sub: string; badge: string }) {
  return (
    <section className="contest-notice" aria-label="이번 판 결과">
      <span className="contest-notice-icon" aria-hidden>{icon}</span>
      <div className="contest-notice-text">
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
      <span className="contest-notice-badge">{badge}</span>
    </section>
  )
}

// ───────── 순위 자세히 보기 ① 추이 그래프 ─────────

type TrendMode = 'reps' | 'rank'

/** 학교 칩 순서: 지금 순위대로, 기록 없는 학교는 뒤에 가나다순 */
function orderedSchools(standings: ContestStandings | null) {
  const ranked = standings?.schools.map((s) => s.schoolId) ?? []
  return [...ranked, ...CONTEST_SCHOOLS.map((s) => s.schoolId).filter((id) => !ranked.includes(id))]
}

/** 눈금 간격. 최대값을 8칸 안쪽으로 나누는 보기 좋은 수 */
function niceStep(max: number) {
  const raw = Math.max(max, 1) / 8
  const base = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * base) return m * base
  return 10 * base
}

// 그래프 그리는 영역 (SVG 좌표). 패널 1251×643 안, 칩 줄 아래
const PLOT = { w: 1251, h: 560, left: 122, right: 1130, top: 28, bottom: 498 }

export function TrendPanel({ trend, standings }: { trend: ContestTrend | null; standings: ContestStandings | null }) {
  const [mode, setMode] = useState<TrendMode>('reps')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const schools = orderedSchools(standings)
  const withData = new Set(trend?.buckets.at(-1)?.schools.map((s) => s.schoolId) ?? [])

  // 구간이 하나뿐이면 선이 안 보이니 앞에 0회 시작점을 하나 둔다 (기록 모드만)
  const buckets = useMemo(() => {
    const b = trend?.buckets ?? []
    if (b.length !== 1) return b
    const first = b[0]
    return [{ startAt: first.startAt - 3_600_000, hour: (first.hour + 23) % 24, schools: first.schools.map((s) => ({ ...s, totalReps: 0, hourReps: 0 })) }, first]
  }, [trend])
  const shown = mode === 'reps' ? buckets : trend?.buckets ?? []

  const n = shown.length
  const xOf = (i: number) => (n <= 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + ((PLOT.right - PLOT.left) * i) / (n - 1))
  const maxReps = Math.max(0, ...shown.flatMap((b) => b.schools.map((s) => s.totalReps)))
  const step = niceStep(maxReps)
  const top = Math.max(step * Math.ceil(maxReps / step), step)
  const rankCount = CONTEST_SCHOOLS.length
  const yOf = (v: number) =>
    mode === 'reps'
      ? PLOT.bottom - ((PLOT.bottom - PLOT.top) * v) / top
      : PLOT.top + ((PLOT.bottom - PLOT.top) * (v - 1)) / (rankCount - 1)
  const ticks = mode === 'reps'
    ? Array.from({ length: Math.round(top / step) + 1 }, (_, i) => ({ v: i * step, label: `${i * step}회` }))
    : Array.from({ length: rankCount }, (_, i) => ({ v: i + 1, label: `${i + 1}위` }))
  const labelEvery = n > 12 ? 2 : 1

  const series = schools
    .filter((id) => withData.has(id) && !hidden.has(id))
    .map((id) => ({
      id,
      points: shown.flatMap((b, i) => {
        const s = b.schools.find((p) => p.schoolId === id)
        return s ? [{ x: xOf(i), y: yOf(mode === 'reps' ? s.totalReps : s.rank), value: s.totalReps, rank: s.rank }] : []
      }),
    }))
  // 선끼리 겹칠 때 1위가 위에 보이게 뒤에서부터 그린다
  const drawOrder = [...series].reverse()
  const dataKey = `${mode}-${n}-${series.map((s) => s.points.at(-1)?.value).join(',')}`

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className="contest-panel contest-trend" aria-label="학교별 누적 스쿼트 추이">
      <div className="contest-trend-head">
        <div className="contest-chips" role="group" aria-label="그래프에 보일 학교">
          {schools.map((id) => {
            const isOn = withData.has(id) && !hidden.has(id)
            return (
              <button
                key={id}
                type="button"
                className={`contest-chip${isOn ? ' is-on' : ''}`}
                aria-pressed={isOn}
                disabled={!withData.has(id)}
                onClick={() => toggle(id)}
              >
                <SchoolLogo schoolId={id} size={24} />
                {schoolShortName(id)}
              </button>
            )
          })}
        </div>
        <div className="contest-toggle" role="radiogroup" aria-label="그래프 기준">
          <button type="button" role="radio" aria-checked={mode === 'reps'} className={mode === 'reps' ? 'is-on' : ''} onClick={() => setMode('reps')}>기록(회)</button>
          <button type="button" role="radio" aria-checked={mode === 'rank'} className={mode === 'rank' ? 'is-on' : ''} onClick={() => setMode('rank')}>순위</button>
        </div>
      </div>

      {n === 0 ? (
        <p className="contest-empty">아직 끝난 판이 없어요. 판이 끝나면 시간마다 학교 점수가 여기 쌓여요.</p>
      ) : (
        <svg className="contest-trend-svg" viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} role="img" aria-label={`${mode === 'reps' ? '누적 횟수' : '순위'} 추이 그래프`}>
          <defs>
            <clipPath id="contest-logo-clip"><circle cx="0" cy="0" r="10.5" /></clipPath>
          </defs>
          {ticks.map((t) => (
            <g key={t.label}>
              <line x1={PLOT.left - 30} x2={PLOT.right + 50} y1={yOf(t.v)} y2={yOf(t.v)} className="contest-grid" />
              <text x={PLOT.left - 46} y={yOf(t.v)} className="contest-axis" textAnchor="end" dominantBaseline="central">{t.label}</text>
            </g>
          ))}
          {shown.map((b, i) => (i % labelEvery === 0 || i === n - 1) && (
            <text key={b.startAt} x={xOf(i)} y={PLOT.bottom + 44} className="contest-axis" textAnchor="middle">{b.hour}시</text>
          ))}
          <g key={dataKey}>
            {drawOrder.map((s) => (
              <polyline
                key={s.id}
                points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={schoolColor(s.id)}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="contest-line"
              />
            ))}
            {drawOrder.map((s) => s.points.map((p, i) => {
              const isLast = i === s.points.length - 1
              const logo = schoolLogo(s.id)
              return (
                // 위치는 바깥 g, 나타나는 효과는 안쪽 g에 줘서 CSS 애니메이션이 위치를 덮어쓰지 않게 한다
                <g key={`${s.id}-${i}`} transform={`translate(${p.x} ${p.y})`}>
                  <g className={isLast ? 'contest-point is-last' : 'contest-point'}>
                    {isLast && <circle r={18} fill={schoolColor(s.id)} className="contest-pulse" />}
                    <circle r={11.5} fill="#fff" stroke={schoolColor(s.id)} strokeWidth={2} />
                    {logo
                      ? <image href={logo} x={-10.5} y={-10.5} width={21} height={21} clipPath="url(#contest-logo-clip)" preserveAspectRatio="xMidYMid meet" />
                      : <circle r={7} fill={schoolColor(s.id)} />}
                  </g>
                </g>
              )
            }))}
            {series.map((s) => {
              const last = s.points.at(-1)
              if (!last) return null
              return (
                <text key={`${s.id}-label`} x={last.x + 20} y={last.y} className="contest-end-label" fill={schoolColor(s.id)} dominantBaseline="central">
                  {mode === 'reps' ? `${last.value}회` : `${last.rank}위`}
                </text>
              )
            })}
          </g>
        </svg>
      )}
    </section>
  )
}

// ───────── 순위 자세히 보기 ② 막대 + 참가자 상세 ─────────

export function BarsPanel({ standings }: { standings: ContestStandings | null }) {
  const [filter, setFilter] = useState<string>('all')
  const bySchool = new Map(standings?.schools.map((s) => [s.schoolId, s]) ?? [])
  const schools = orderedSchools(standings)
  const max = Math.max(1, ...(standings?.schools.map((s) => s.totalReps) ?? []))
  const players: ContestPlayerBest[] = (standings?.players ?? []).filter((p) => filter === 'all' || p.schoolId === filter)

  return (
    <>
      <section className="contest-panel contest-bars" aria-label="학교별 누적 막대">
        <ol className="contest-bar-cols">
          {schools.map((id, i) => {
            const s = bySchool.get(id)
            const reps = s?.totalReps ?? 0
            return (
              <li key={id} className={`contest-bar-col${s ? '' : ' is-empty'}`}>
                <div className="contest-bar-area">
                  {i === 0 && s && <img className="contest-bar-crown" src={crownIcon} alt="" width={24} height={24} />}
                  <b className="contest-bar-value">{reps}회</b>
                  <div className="contest-bar-block" style={{ height: s ? Math.max(9, (reps / max) * 214) : 9, background: schoolColor(id) }} />
                </div>
                <span className="contest-bar-name">{i + 1}. {schoolShortName(id)}</span>
                <span className="contest-bar-sub">{s ? `${s.entryCount}명 참여` : '기록 없음'}</span>
              </li>
            )
          })}
        </ol>
      </section>
      <section className="contest-panel contest-detail" aria-label="참가자 상세">
        <div className="contest-detail-head">
          <h2>참가자 상세</h2>
          <div className="contest-chips" role="radiogroup" aria-label="학교로 거르기">
            {['all', ...CONTEST_SCHOOLS.map((s) => s.schoolId)].map((id) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} className={`contest-chip${filter === id ? ' is-on' : ''}`} onClick={() => setFilter(id)}>
                {id === 'all' ? '전체' : schoolShortName(id)}
              </button>
            ))}
          </div>
        </div>
        <div className="contest-table-wrap">
          <table className="contest-table">
            <thead><tr><th>순위</th><th>이름</th><th>학교</th><th>최고기록</th></tr></thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan={4} className="contest-sub">아직 기록이 없어요</td></tr>
              ) : players.map((p, i) => (
                <tr key={`${p.nickname}-${p.schoolId}`}>
                  <td>{i + 1}</td>
                  <td>{p.nickname}</td>
                  <td>{schoolShortName(p.schoolId)}</td>
                  <td>{p.bestReps}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/** 페이지 넘기기 화살표 (태블릿에서 손가락으로 누르기 좋게 크게) */
export function PageArrow({ dir, onClick, label }: { dir: 'prev' | 'next'; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`contest-arrow is-${dir}`} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden>
        <path d={dir === 'prev' ? 'M15 4 7 12l8 8' : 'm9 4 8 8-8 8'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

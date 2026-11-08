import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { goalLabel, type WorkoutSession } from '../types/domain'
import { durationLabel, relativeDay } from '../lib/format'
import { summarize, totalValidReps } from '../lib/stats'
import Backdrop from '../components/Backdrop'
import { CenterMessage, Logo, StatCard } from '../components/ui'

// F-YBENHN · Figma '내 성장 기록'
// 저장된 실제 기록만 쓴다. 시안의 '자세 점수 흐름'은 자세 점수를 아직 측정하지 않아서
// 실제로 있는 유효 횟수로 그린다 (측정하지 않은 값을 보여주지 않는 원칙).

type Feedback = { label: string; tone: 'good' | 'improving' | 'effort' } | null

/** 저장된 자세 피드백 개수로 나누는 단순 분류. 피드백이 없으면 표시하지 않는다. */
function feedbackOf(s: WorkoutSession): Feedback {
  const notes = s.records.flatMap((r) => r.postureNotes)
  if (notes.length === 0) return null
  const good = notes.filter((n) => n.kind === 'good').length
  const fix = notes.length - good
  if (good > fix) return { label: '좋음', tone: 'good' }
  if (good > 0) return { label: '개선 중', tone: 'improving' }
  return { label: '노력필요', tone: 'effort' }
}

const roundLabel = (s: WorkoutSession) => (s.kind === 'sunset' ? '공개' : `${s.round}회차`)

const COLUMNS = '0.7fr 1.4fr 1fr 1fr 1fr 1fr'

function RepsChart({ sessions }: { sessions: WorkoutSession[] }) {
  const data = [...sessions].sort((a, b) => a.endedAt - b.endedAt).slice(-8)
  const max = Math.max(1, ...data.map(totalValidReps))
  const W = 1200
  const H = 150
  const PAD_X = 70
  const TOP = 36
  const xOf = (i: number) => (data.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (data.length - 1))
  const yOf = (v: number) => TOP + H - (v / max) * H
  const points = data.map((s, i) => `${xOf(i)},${yOf(totalValidReps(s))}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${TOP + H + 40}`} width="100%" role="img" aria-label="회차별 유효 횟수 흐름">
      {[0, 0.5, 1].map((r) => (
        <line key={r} x1={PAD_X - 20} x2={W - PAD_X + 20} y1={TOP + H * r} y2={TOP + H * r} stroke="rgba(255,255,255,0.75)" strokeDasharray="10 8" strokeWidth={1.5} />
      ))}
      <polyline points={points} fill="none" stroke="var(--c-chart)" strokeWidth={5} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.2))' }} />
      {data.map((s, i) => {
        const v = totalValidReps(s)
        return (
          <g key={s.sessionId}>
            <circle cx={xOf(i)} cy={yOf(v)} r={10} fill="#fff" stroke="var(--c-chart)" strokeWidth={5} />
            <text x={xOf(i)} y={yOf(v) - 18} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">{v}</text>
            <text x={xOf(i)} y={TOP + H + 30} textAnchor="middle" fontSize={14} fill="#fff">{roundLabel(s)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function History() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [isOpeningNext, setIsOpeningNext] = useState(false)

  useEffect(() => {
    services.record
      .listSessions(profile.userId)
      .then((s) => setSessions(s.sort((a, b) => b.endedAt - a.endedAt)))
      .catch(() => setHasError(true))
  }, [profile.userId, retryKey])

  if (hasError) return <CenterMessage title="기록을 불러오지 못했어요" action={<button className="btn btn-primary" onClick={() => { setHasError(false); setRetryKey((k) => k + 1) }}>다시 시도</button>} />
  if (!sessions) return <CenterMessage title="기록을 불러오는 중…" />

  const stats = summarize(sessions)
  const latestParty = sessions.find((s) => s.kind === 'party')

  const handleOpenNext = async () => {
    if (!latestParty) return nav('/goal')
    setIsOpeningNext(true)
    try {
      const r = await services.routine.recommendNext(latestParty)
      nav(`/room/${r.routineId}`)
    } catch {
      setIsOpeningNext(false)
      nav('/goal')
    }
  }

  return (
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-narrow" style={{ gap: 14 }}>
        <h1 className="t-display" style={{ textAlign: 'center', marginTop: 44, marginBottom: 18 }}>내 성장 기록</h1>

        {sessions.length === 0 ? (
          <section className="card col center" style={{ gap: 16, padding: 64, marginTop: 24 }}>
            <p className="t-h2">아직 운동 기록이 없어요</p>
            <p className="t-soft">첫 운동을 마치면 회차별 결과와 성장 흐름이 여기에 쌓여요.</p>
            <button className="btn btn-primary btn-lg" onClick={() => nav('/goal')}>첫 운동 시작하기</button>
          </section>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
              <StatCard label="총 운동 시간" value={durationLabel(stats.totalActiveMs)} />
              <StatCard label="누적 운동 횟수" value={`${stats.totalReps.toLocaleString()}회`} />
              <StatCard label="연속 운동일" value={`${stats.streakDays}일째`} />
            </div>

            <section className="card col" style={{ gap: 8 }}>
              <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>회차별 운동 결과</h2>
              <div role="table" aria-label="회차별 운동 결과" className="col" style={{ gap: 0 }}>
                <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNS, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: 'var(--c-th)', textAlign: 'center' }}>
                  <span role="columnheader">회차</span><span role="columnheader">운동 목표</span><span role="columnheader">총 시간</span><span role="columnheader">유효 횟수</span><span role="columnheader">자세 피드백</span><span role="columnheader">수행일</span>
                </div>
                <div className="dashed-list" style={{ borderTop: '1px dashed rgba(255,255,255,0.55)', borderBottom: '1px dashed rgba(255,255,255,0.55)' }}>
                  {sessions.map((s, i) => {
                    const fb = feedbackOf(s)
                    return (
                      <button
                        key={s.sessionId}
                        role="row"
                        onClick={() => nav(`/result/${s.sessionId}`)}
                        style={{ display: 'grid', gridTemplateColumns: COLUMNS, width: '100%', padding: '6px 12px', fontSize: 15, textAlign: 'center', alignItems: 'center', background: i === 0 ? 'var(--c-row-highlight)' : undefined }}
                        title="결과 자세히 보기"
                      >
                        <span role="cell">{roundLabel(s)}</span>
                        <span role="cell">{s.goal ? goalLabel(s.goal) : '선셋 에어로빅'}</span>
                        <span role="cell">{durationLabel(s.activeMs)}</span>
                        <span role="cell">{totalValidReps(s)}회</span>
                        <span role="cell">{fb ? <span className={`chip chip-${fb.tone}`} style={{ fontSize: 10 }}>{fb.label}</span> : <span className="t-muted">-</span>}</span>
                        <span role="cell">{relativeDay(s.endedAt)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className="card col" style={{ gap: 4 }}>
              <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>유효 횟수 흐름</h2>
              <p className="t-small t-soft">회차가 쌓일수록 실제로 인정된 운동 횟수가 어떻게 달라졌는지 보여줘요.</p>
              <RepsChart sessions={sessions} />
            </section>
          </>
        )}

        <div className="row center" style={{ gap: 22, marginTop: 8 }}>
          <button className="btn btn-secondary btn-lg" style={{ width: 306, height: 64 }} onClick={() => nav('/home')}>홈으로 돌아가기</button>
          {sessions.length > 0 && (
            <button className="btn btn-primary btn-lg" style={{ width: 306, height: 64 }} disabled={isOpeningNext} onClick={handleOpenNext}>
              {latestParty ? '다음 회차 시작' : '친구 운동 시작하기'}
            </button>
          )}
        </div>
      </div>
    </Backdrop>
  )
}

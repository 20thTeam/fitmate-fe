import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { services } from '../services'
import type { Routine, TeamProgress, WorkoutSession } from '../types/domain'
import RoutineList from '../components/RoutineList'

// F-XXCKUD 결과 요약, F-SYGFQC 2회차 추천, F-WFAMYP 팀 경험치
export default function Result() {
  const { sessionId = '' } = useParams()
  const nav = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null | undefined>(undefined)
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [team, setTeam] = useState<TeamProgress | null>(null)
  const [next, setNext] = useState<Routine | 'loading' | 'error'>('loading')

  useEffect(() => {
    ;(async () => {
      const s = await services.record.getSession(sessionId)
      setSession(s)
      if (!s) return
      setRoutine(await services.routine.get(s.routineId))
      setTeam(await services.team.applySession(s.roomId, s))
      try {
        setNext(await services.routine.recommendNext(s))
      } catch {
        setNext('error')
      }
    })()
  }, [sessionId])

  if (session === undefined) return <main className="page page-center">결과를 불러오는 중…</main>
  if (session === null) {
    return (
      <main className="page page-center">
        <h2 className="title">결과를 찾을 수 없어요</h2>
        <Link to="/home" className="btn">홈으로</Link>
      </main>
    )
  }

  const totalMs = session.endedAt - session.startedAt
  const min = Math.floor(totalMs / 60000)
  const sec = Math.floor((totalMs % 60000) / 1000)
  const completed = session.records.filter((r) => r.completed).length
  const nameOf = (id: string) => routine?.items.find((i) => i.exerciseId === id)
  const totalSets = (id: string) => nameOf(id)?.sets ?? 1

  return (
    <main className="page">
      <h1 className="title">{session.round}회차 운동 결과</h1>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card"><small className="muted">총 운동 시간</small><div style={{ fontSize: 32 }}>{min}분 {sec}초</div></div>
        <div className="card"><small className="muted">완료한 운동</small><div style={{ fontSize: 32 }}>{completed} / {session.records.length}개</div></div>
        <div className="card">
          <small className="muted">팀 경험치</small>
          {/* 산식 미정이면 수치를 만들지 않는다 */}
          <div style={{ fontSize: 20 }}>
            {team?.gainedXp != null ? `+${team.gainedXp} XP` : '산정 기준 준비 중'}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>운동별 수행 결과</h3>
          {session.records.map((r) => {
            const it = nameOf(r.exerciseId)
            const target = it?.targetReps
              ? `${r.validReps}회 / 목표 ${it.targetReps * totalSets(r.exerciseId)}회`
              : `${r.validSeconds}초 / 목표 ${(it?.targetSeconds ?? 0) * totalSets(r.exerciseId)}초`
            return (
              <div key={r.exerciseId} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <strong>{it?.name ?? r.exerciseId}</strong>
                <span>{target} {r.completed ? '✅' : ''}</span>
              </div>
            )
          })}
        </section>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>다음 회차 추천</h3>
          {next === 'loading' && <p className="muted">추천을 만드는 중…</p>}
          {next === 'error' && <p style={{ color: 'var(--c-danger)' }}>추천을 만들지 못했어요. 새로고침해 다시 시도해 주세요.</p>}
          {typeof next === 'object' && (
            <>
              {next.provisional && <span className="badge badge-warn">시연용 임시 규칙</span>}
              <ul>{next.changeReasons?.map((r) => <li key={r}>{r}</li>)}</ul>
              <RoutineList routine={next} />
            </>
          )}
        </section>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/home" className="btn">홈</Link>
        <Link to="/history" className="btn">성장 기록</Link>
        <button
          className="btn btn-primary btn-lg"
          disabled={typeof next !== 'object'}
          onClick={() => typeof next === 'object' && nav(`/routine/${next.routineId}`)}
        >
          {session.round + 1}회차 시작
        </button>
      </div>
    </main>
  )
}

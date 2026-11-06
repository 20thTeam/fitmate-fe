import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { GOALS, type WorkoutSession } from '../types/domain'

// F-YBENHN: 개인 성장 기록. 저장된 실제 기록만 보여준다.
export default function History() {
  const profile = useApp((s) => s.profile)!
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null)

  useEffect(() => {
    services.record.listSessions(profile.userId).then((s) => setSessions(s.sort((a, b) => b.endedAt - a.endedAt)))
  }, [profile.userId])

  if (!sessions) return <main className="page page-center">불러오는 중…</main>

  return (
    <main className="page" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="title">{profile.nickname}님의 성장 기록</h1>
        <Link to="/home" className="btn">홈</Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card page-center" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 48 }}>
          <p className="muted">아직 운동 기록이 없어요.</p>
          <Link to="/goal" className="btn btn-primary">첫 운동 시작하기</Link>
        </div>
      ) : (
        sessions.map((s) => {
          const reps = s.records.reduce((a, r) => a + r.validReps, 0)
          const done = s.records.filter((r) => r.completed).length
          return (
            <Link key={s.sessionId} to={`/result/${s.sessionId}`} className="card row" style={{ justifyContent: 'space-between', color: 'inherit', textDecoration: 'none' }}>
              <strong>{s.round}회차 · {GOALS.find((g) => g.id === s.goal)?.label}</strong>
              <span className="muted">{new Date(s.endedAt).toLocaleString('ko-KR')}</span>
              <span>유효 {reps}회 · 완료 {done}/{s.records.length}</span>
            </Link>
          )
        })
      )}
    </main>
  )
}

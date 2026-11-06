import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { services } from '../services'
import type { Routine } from '../types/domain'
import { GOALS } from '../types/domain'
import RoutineList from '../components/RoutineList'

// F-WBCAEC: 추천 루틴 확인 및 운동방 입장
export default function RoutineConfirm() {
  const { routineId = '' } = useParams()
  const nav = useNavigate()
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined)

  useEffect(() => {
    services.routine.get(routineId).then(setRoutine)
  }, [routineId])

  if (routine === undefined) return <main className="page page-center">불러오는 중…</main>
  if (routine === null) {
    // 추천 불가 시 입장 제한 (F-WBCAEC 권장안)
    return (
      <main className="page page-center">
        <h2 className="title">루틴을 찾을 수 없어요</h2>
        <button className="btn btn-primary" onClick={() => nav('/goal')}>다시 추천받기</button>
      </main>
    )
  }

  const goalLabel = GOALS.find((g) => g.id === routine.goal)?.label

  return (
    <main className="page" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div className="row">
        <h1 className="title">{routine.round}회차 오늘의 루틴</h1>
        {routine.provisional && <span className="badge badge-warn">시연용 임시 루틴</span>}
      </div>
      <p className="subtitle">목표: {goalLabel}</p>

      {routine.changeReasons && (
        <div className="card">
          <strong>지난 회차 기록으로 바뀐 점</strong>
          <ul>{routine.changeReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      <RoutineList routine={routine} />

      <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center' }} onClick={() => nav(`/room/${routine.routineId}`)}>
        운동방 입장
      </button>
    </main>
  )
}

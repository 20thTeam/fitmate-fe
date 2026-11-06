import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { GOALS, type GoalId } from '../types/domain'

// F-FTENXM: 운동 목표 선택 + 루틴 추천 로딩
export default function GoalSelect() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!
  const setGoal = useApp((s) => s.setGoal)
  const setRoutine = useApp((s) => s.setRoutine)
  const [goal, pick] = useState<GoalId | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function recommend() {
    if (!goal) return
    setState('loading')
    try {
      const r = await services.routine.recommendFirst(profile.userId, goal)
      setGoal(goal)
      setRoutine(r.routineId)
      nav(`/routine/${r.routineId}`)
    } catch {
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <main className="page page-center">
        <h2 className="title">루틴을 준비하고 있어요</h2>
        <p className="subtitle">선택한 목표에 맞는 운동을 고르는 중…</p>
      </main>
    )
  }

  return (
    <main className="page page-center">
      <h1 className="title">오늘의 운동 목표는?</h1>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 280px)' }}>
        {GOALS.map((g) => (
          <button
            key={g.id}
            className={`card selectable ${goal === g.id ? 'selected' : ''}`}
            style={{ height: 140, fontSize: 24, fontWeight: 700 }}
            onClick={() => pick(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {state === 'error' && <p style={{ color: 'var(--c-danger)' }}>추천을 만들지 못했어요. 다시 시도해 주세요.</p>}
      {/* 목표 미선택 시 버튼 비활성 (F-FTENXM 권장안) */}
      <button className="btn btn-primary btn-lg" disabled={!goal} onClick={recommend}>
        루틴 추천받기
      </button>
    </main>
  )
}

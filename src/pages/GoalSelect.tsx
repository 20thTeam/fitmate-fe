import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { GOALS, type GoalId } from '../types/domain'
import Backdrop from '../components/Backdrop'
import GoalIcon from '../components/GoalIcon'
import { Logo } from '../components/ui'

// F-FTENXM, F-UZFEMP · Figma '오늘의 어떤 운동을 할까요?'
// 카드 선택 → '운동 시작하기' → 1회차 루틴 추천 → 친구 운동방 입장 대기

/** 로딩 표시가 깜빡이고 사라지지 않게 최소한으로 보여주는 시간 */
const MIN_LOADING_MS = 900

/** 시안처럼 설명을 두 줄로 나눈다 (쉼표가 있으면 쉼표 뒤, 없으면 마지막 띄어쓰기) */
function splitTwoLines(text: string) {
  const comma = text.indexOf(', ')
  const at = comma >= 0 ? comma + 1 : text.lastIndexOf(' ')
  return at > 0 ? [text.slice(0, at), text.slice(at + 1)] : [text]
}

export default function GoalSelect() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const profile = useApp((s) => s.profile)!
  const setGoal = useApp((s) => s.setGoal)
  const preset = GOALS.find((g) => g.id === params.get('pick'))?.id ?? null
  const [picked, setPicked] = useState<GoalId | null>(preset)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  const handleStart = async () => {
    if (!picked) return
    setState('loading')
    try {
      const [r] = await Promise.all([
        services.routine.recommendFirst(profile.userId, picked),
        new Promise((res) => setTimeout(res, MIN_LOADING_MS)),
      ])
      setGoal(picked)
      nav(`/room/${r.routineId}`)
    } catch {
      setState('error')
    }
  }

  const isLoading = state === 'loading'

  return (
    <Backdrop>
      <Logo />
      <div className="backdrop-body is-center" style={{ gap: 0, paddingTop: 120 }}>
        <div className="col center" style={{ gap: 10 }}>
          <h1 style={{ fontSize: 46, fontWeight: 700, textShadow: '0 2px 12px rgba(120,60,120,0.25)' }}>오늘의 어떤 운동을 할까요?</h1>
          <p style={{ fontSize: 22 }}>원하는 운동을 선택하고, 함께 시작해요!</p>
        </div>

        <div className="row" role="radiogroup" aria-label="운동 목표" style={{ gap: 45, marginTop: 64 }}>
          {GOALS.map((g) => {
            const isSelected = picked === g.id
            return (
              <button
                key={g.id}
                role="radio"
                aria-checked={isSelected}
                className={`goal-card ${isSelected ? 'is-selected' : ''}`}
                disabled={isLoading}
                onClick={() => setPicked(g.id)}
              >
                <div className="col center" style={{ height: 110 }}>
                  <GoalIcon goal={g.id} />
                </div>
                <span className="goal-card-title">{g.label}</span>
                <span className="goal-card-desc">{splitTwoLines(g.desc).map((line) => <span key={line} style={{ display: 'block' }}>{line}</span>)}</span>
              </button>
            )
          })}
        </div>

        <button className="btn btn-plum btn-xl" style={{ marginTop: 106 }} disabled={!picked || isLoading} onClick={handleStart}>
          <span style={{ flex: 1, textAlign: 'center' }}>{isLoading ? '나에게 맞는 루틴을 만드는 중…' : '운동 시작하기'}</span>
          <span aria-hidden>{isLoading ? '' : '>'}</span>
        </button>
        <p role="status" style={{ minHeight: 24, marginTop: 14, fontWeight: 600 }}>
          {state === 'error' ? '루틴을 추천하지 못했어요. 다시 눌러 주세요.' : !picked ? '운동을 하나 골라 주세요' : ''}
        </p>
      </div>
    </Backdrop>
  )
}

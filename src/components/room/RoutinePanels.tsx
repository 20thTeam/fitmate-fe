// 운동방의 루틴 목록 두 가지.
// - RoutineOrderPanel: 입장 대기 화면 왼쪽 아래 '오늘의 운동 순서'
// - RoutineStepBar: 운동 중 스크린 위 '오늘의 운동' 진행 바 (지금 하는 운동을 강조)
import { shortAmountLabel, twoDigits } from '../../lib/format'

export interface RoutineRowItem {
  exerciseId: string
  name: string
  tag?: string
  sets: number
  targetReps?: number
  targetSeconds?: number
}

const amountOf = (it: RoutineRowItem) => (it.targetReps || it.targetSeconds ? shortAmountLabel(it) : '자유 진행')

export function RoutineOrderPanel({ items, title = '오늘의 운동 순서', sub = '오늘의 맞춤 루틴' }: { items: RoutineRowItem[]; title?: string; sub?: string }) {
  return (
    <section className="glass col" style={{ gap: 8, padding: '14px 12px' }} aria-label={title}>
      <div className="col" style={{ gap: 2, paddingLeft: 4 }}>
        <h2 className="panel-title" style={{ fontSize: 15 }}>{title}</h2>
        <span className="panel-sub">{sub}</span>
      </div>
      <ol className="list-plain col" style={{ gap: 6 }}>
        {items.map((it, i) => (
          <li key={`${it.exerciseId}-${i}`} className="routine-row">
            <span className="routine-no">{twoDigits(i + 1)}</span>
            <span className="routine-name">{it.name}</span>
            <span className="routine-amount">{amountOf(it)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

interface StepBarProps {
  items: RoutineRowItem[]
  activeIndex: number
  /** 지금 운동의 몇 번째 세트인지. 휴식 중이면 비운다 */
  setNo?: number
  /** 휴식 중이면 activeIndex는 다음에 할 운동이다 */
  isResting?: boolean
}

/**
 * 운동 중 스크린 위 '오늘의 운동' 진행 바. 2m 떨어져서도 보이게 크게 그린다.
 * 지금 운동은 세트 점(●○○)으로, 끝난 운동은 체크로 보여준다.
 */
export function RoutineStepBar({ items, activeIndex, setNo, isResting }: StepBarProps) {
  return (
    <nav className="step-bar" aria-label="오늘의 운동 진행">
      <ol className="list-plain step-bar-list">
        {items.map((it, i) => {
          const isActive = i === activeIndex
          const isDone = i < activeIndex
          return (
            <li
              key={`${it.exerciseId}-${i}`}
              className={`step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="step-no" aria-hidden>{isDone ? '✓' : i + 1}</span>
              <span className="col" style={{ gap: 4 }}>
                <span className="step-name">{it.name}</span>
                {isActive && isResting && <span className="step-sub">휴식 후 시작</span>}
                {isActive && !isResting && setNo != null && it.sets > 1 && (
                  <span className="step-sets" aria-label={`세트 ${setNo} / ${it.sets}`}>
                    {Array.from({ length: it.sets }, (_, s) => (
                      <i key={s} className={s < setNo - 1 ? 'is-done' : s === setNo - 1 ? 'is-now' : ''} />
                    ))}
                  </span>
                )}
                {!isActive && <span className="step-sub">{amountOf(it)}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

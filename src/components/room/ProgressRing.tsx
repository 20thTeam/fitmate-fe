// 운동 중 횟수 링 (Figma: '07 / 12회'). max가 없으면 링을 비워 두고 숫자만 보여준다.
import type { CSSProperties } from 'react'
import { twoDigits } from '../../lib/format'

const R = 60
const C = 2 * Math.PI * R

/** 세트 완료 때 링 둘레로 튀는 조각 수 */
const BURST = Array.from({ length: 12 }, (_, i) => i)

interface Props {
  value: number
  max?: number
  unit: string
  /** 이번 세트 목표를 채움 → 초록 링으로 바꿔 다음 단계로 넘어가라고 알린다 */
  isDone?: boolean
  /** 횟수가 올라갈 때마다 바뀌는 값. 바뀌면 숫자가 튀고 링이 번쩍인다 (0이면 효과 없음) */
  bumpId?: number
}

export default function ProgressRing({ value, max, unit, isDone, bumpId = 0 }: Props) {
  const ratio = max ? Math.min(1, value / max) : 0
  return (
    <div className={`ring ${isDone ? 'is-done' : ''}`} role="img" aria-label={max ? `${max}${unit} 중 ${value}${unit}` : `${value}${unit}`}>
      {/* key가 바뀌면 다시 그려져 애니메이션이 처음부터 돈다 */}
      {bumpId > 0 && <span key={`flash-${bumpId}`} className="ring-flash" aria-hidden />}
      {isDone && (
        <span className="ring-burst" aria-hidden>
          {BURST.map((i) => <i key={i} style={{ '--a': `${i * 30}deg` } as CSSProperties} />)}
        </span>
      )}
      <svg viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--c-ring-track)" strokeWidth="14" />
        {ratio > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke={isDone ? 'var(--c-ring-done)' : 'var(--c-ring)'} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * ratio} ${C}`} style={{ transition: 'stroke-dasharray 0.3s' }} />}
      </svg>
      <div className="ring-text">
        <span key={bumpId} className={`ring-value ${bumpId > 0 ? 'is-bump' : ''}`}>{twoDigits(value)}</span>
        <span className="ring-max">{isDone ? '세트 완료' : max ? `/ ${max}${unit}` : unit}</span>
      </div>
    </div>
  )
}

// 운동 중 횟수 링 (Figma: '07 / 12회'). max가 없으면 링을 비워 두고 숫자만 보여준다.
import { twoDigits } from '../../lib/format'

const R = 60
const C = 2 * Math.PI * R

/** isDone: 이번 세트 목표를 채움 → 초록 링으로 바꿔 다음 단계로 넘어가라고 알린다 */
export default function ProgressRing({ value, max, unit, isDone }: { value: number; max?: number; unit: string; isDone?: boolean }) {
  const ratio = max ? Math.min(1, value / max) : 0
  return (
    <div className={`ring ${isDone ? 'is-done' : ''}`} role="img" aria-label={max ? `${max}${unit} 중 ${value}${unit}` : `${value}${unit}`}>
      <svg viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--c-ring-track)" strokeWidth="14" />
        {ratio > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke={isDone ? 'var(--c-ring-done)' : 'var(--c-ring)'} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * ratio} ${C}`} style={{ transition: 'stroke-dasharray 0.3s' }} />}
      </svg>
      <div className="ring-text">
        <span className="ring-value">{twoDigits(value)}</span>
        <span className="ring-max">{isDone ? '세트 완료' : max ? `/ ${max}${unit}` : unit}</span>
      </div>
    </div>
  )
}

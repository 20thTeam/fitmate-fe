// 세트 완료·휴식 끝 카드. 코치 말풍선 자리(눈높이)에 크게 띄운다 (F-SZCKIV: 다음 단계는 직접 누른다).
// 2m 떨어져 있으면 마우스까지 오기 번거로워 스페이스바·엔터로도 넘어가게 한다.
import { useEffect, useRef } from 'react'

interface Props {
  title: string
  /** 제목 옆 짧은 설명 (예: '25 / 25회') */
  sub?: string
  actionLabel: string
  onAction: () => void
  onEnd: () => void
  isDisabled?: boolean
  /** 다른 창(끝내기 확인·자세 가이드 등)이 떠 있으면 false로 꺼서 키가 엉뚱하게 먹지 않게 한다 */
  isKeyEnabled: boolean
}

export default function StepDoneCard({ title, sub, actionLabel, onAction, onEnd, isDisabled, isKeyEnabled }: Props) {
  // 키 입력 핸들러를 한 번만 달고 최신 값을 읽는다
  const latest = useRef({ onAction, isDisabled, isKeyEnabled })
  useEffect(() => {
    latest.current = { onAction, isDisabled, isKeyEnabled }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      const { onAction: act, isDisabled: off, isKeyEnabled: on } = latest.current
      if (!on || off || e.repeat) return
      // 버튼·입력칸에 포커스가 있으면 브라우저 기본 동작(그 버튼 누르기)을 그대로 둔다
      const el = e.target
      if (el instanceof HTMLElement && el !== document.body && el.closest('button, input, textarea, select, a, [contenteditable]')) return
      e.preventDefault()
      act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="coach-bubble-wrap">
      <section className="step-done is-pop" role="status" aria-label={title}>
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <span className="step-done-title">
            <span className="coach-bubble-icon" aria-hidden>✓</span>
            <span className="col" style={{ gap: 2 }}>
              {title}
              {sub && <small>{sub}</small>}
            </span>
          </span>
          <button className="btn step-done-action" disabled={isDisabled} onClick={onAction}>
            {actionLabel}<span aria-hidden>&gt;</span>
          </button>
        </div>
        <div className="row between" style={{ gap: 12 }}>
          <span className="step-done-hint">스페이스바를 눌러도 넘어가요</span>
          <button className="step-done-end" onClick={onEnd}>운동 끝내기</button>
        </div>
      </section>
    </div>
  )
}

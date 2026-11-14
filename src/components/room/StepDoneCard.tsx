// 세트 완료·휴식 끝 카드. 코치 말풍선 자리(눈높이)에 크게 띄운다.
// 2m 떨어져 있으면 마우스까지 오기 번거로워 스페이스바·엔터로도 넘어가고,
// autoSeconds를 주면 카운트다운 뒤 자동으로 넘어간다 (#70, F-SZCKIV 변경 — PM 확인 필요).
// 카운트다운 중 스페이스바·휴식하기는 '멈추기'다. 멈추면 카드는 사라지고, 하단 패널 버튼이나 스페이스바로 넘어간다.
// 운동 끝내기는 하단 패널에 늘 있어서 카드에는 두지 않는다.
import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  /** 제목 옆 짧은 설명 (예: '25 / 25회') */
  sub?: string
  actionLabel: string
  onAction: () => void
  isDisabled?: boolean
  /** 다른 창(끝내기 확인 등)이 떠 있으면 false로 꺼서 키가 엉뚱하게 먹지 않게 한다. 자동 넘어가기도 이동안 멈춘다 */
  isKeyEnabled: boolean
  /** 이 초가 지나면 onAction을 자동으로 부른다. 없으면 직접 눌러야 넘어간다 */
  autoSeconds?: number
}

export default function StepDoneCard({ title, sub, actionLabel, onAction, isDisabled, isKeyEnabled, autoSeconds }: Props) {
  const [leftSec, setLeftSec] = useState(autoSeconds ?? 0)
  const [isPaused, setIsPaused] = useState(false)
  const isAuto = autoSeconds !== undefined
  // 다른 창이 떠 있거나 넘어갈 수 없는 동안(카메라 꺼짐·저장 중)에는 세지 않고 기다린다
  const isCounting = isAuto && !isPaused && !isDisabled && isKeyEnabled && leftSec > 0
  const isAutoRunning = isAuto && !isPaused

  // 키 입력 핸들러를 한 번만 달고 최신 값을 읽는다
  const latest = useRef({ onAction, isDisabled, isKeyEnabled, isAutoRunning })
  useEffect(() => {
    latest.current = { onAction, isDisabled, isKeyEnabled, isAutoRunning }
  })


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      const { onAction: act, isDisabled: off, isKeyEnabled: on, isAutoRunning } = latest.current
      if (!on || off || e.repeat) return
      // 버튼·입력칸에 포커스가 있으면 브라우저 기본 동작(그 버튼 누르기)을 그대로 둔다
      const el = e.target
      if (el instanceof HTMLElement && el !== document.body && el.closest('button, input, textarea, select, a, [contenteditable]')) return
      e.preventDefault()
      if (isAutoRunning) setIsPaused(true)
      else act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isCounting) return
    const timer = setTimeout(() => setLeftSec((sec) => sec - 1), 1000)
    return () => clearTimeout(timer)
  }, [isCounting, leftSec])

  // 0이 되는 순간 한 번만 넘어간다. 카드는 단계가 바뀌면 새로 그려져 카운트다운도 처음부터 다시 센다
  const hasFired = useRef(false)
  useEffect(() => {
    if (!isAuto || isPaused || leftSec > 0 || hasFired.current) return
    const { onAction: act, isDisabled: off, isKeyEnabled: on } = latest.current
    if (off || !on) return
    hasFired.current = true
    act()
  }, [isAuto, isPaused, leftSec, isDisabled, isKeyEnabled])

  // '다음 세트' → '다음 세트 시작', '런지 시작' → '런지 시작'
  const startLabel = actionLabel.endsWith(' 시작') ? actionLabel : `${actionLabel} 시작`

  // 휴식하기를 누르면 카드를 숨긴다. 하단 패널에 같은 '다음 세트' 버튼이 있어서 겹치지 않게 하고,
  // 컴포넌트는 남겨 두어 스페이스바로 넘어가기는 그대로 된다
  if (isAuto && isPaused) return null

  return (
    <div className="step-done-wrap">
      <section className="step-done glass is-lined is-pop" role="status" aria-label={title}>
        {isAutoRunning ? (
          <>
            <p className="step-done-title">
              {title}
              {sub && <small>{sub}</small>}
            </p>
            <p className="step-done-count" role="timer">
              {startLabel} <strong>{leftSec}</strong>초 전
            </p>
            <button className="btn btn-dark step-done-rest" onClick={() => setIsPaused(true)}>휴식하기</button>
          </>
        ) : (
          <>
            <button className="btn btn-brown step-done-action" disabled={isDisabled} onClick={onAction}>
              {actionLabel}<span aria-hidden>&gt;</span>
            </button>
            <span className="step-done-hint">스페이스바를 눌러도 넘어가요</span>
          </>
        )}
      </section>
    </div>
  )
}

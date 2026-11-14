// 무대 위 AI 코치 말풍선 (F-WLBEFJ 측정된 피드백만, F-XNIIJM 인식 안 되면 안내).
// 2m 떨어져서 보므로 글자를 크게 하고, 진행 바와 스크린 사이 눈높이에 띄운다 (스크린·캐릭터를 가리지 않게).
// - 인식 상태 안내(물러서 주세요, 준비 중, 실패)는 해결될 때까지 계속 보인다
// - 자세 교정·칭찬은 판정이 날 때만 잠깐 보인다. 같은 문구가 이어지면 새로 띄우지 않고 시간만 늘린다
import { useEffect, useRef, useState } from 'react'
import type { ExerciseRecord } from '../../types/domain'
import { poseNotice } from '../../lib/pose/poseNotice'
import type { PoseModelState } from '../../hooks/usePose'

type Note = ExerciseRecord['postureNotes'][number]

/** 교정·칭찬 말풍선이 떠 있는 시간 */
const NOTE_SHOW_MS = 3500

interface Props {
  notes: Note[]
  modelState: PoseModelState
  isTracking: boolean
  isSupported: boolean
  setupHint: string
  isRunning: boolean
  onRetry: () => void
}

export default function CoachBubble({ notes, onRetry, ...pose }: Props) {
  const latest = notes.length > 0 ? notes[notes.length - 1] : null
  // 처음 그릴 때 이미 있던 피드백은 다시 띄우지 않는다
  const seen = useRef(latest)
  const [shown, setShown] = useState<{ note: Note; id: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!latest || latest === seen.current) return
    seen.current = latest
    // 판정 이벤트가 올 때만 바뀐다 (매 프레임 아님)
    setShown((prev) => (prev && prev.note.text === latest.text ? { note: latest, id: prev.id } : { note: latest, id: (prev?.id ?? 0) + 1 }))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(null), NOTE_SHOW_MS)
  }, [latest])

  const notice = poseNotice(pose)

  // 교정·칭찬은 인식 중에만 오므로 떠 있는 동안은 그것을 먼저 보여준다
  let body
  if (shown) {
    const isGood = shown.note.kind === 'good'
    body = (
      <div key={shown.id} className={`coach-bubble is-${isGood ? 'good' : 'fix'} is-pop`} role="status">
        <span className="coach-bubble-icon" aria-hidden>{isGood ? '✓' : '!'}</span>
        <span>{shown.note.text}</span>
      </div>
    )
  } else if (notice) {
    body = (
      <div className={`coach-bubble is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
        <span className="coach-bubble-icon" aria-hidden>{notice.tone === 'info' ? '…' : '!'}</span>
        <span>{notice.text}</span>
        {notice.canRetry && <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>다시 시도</button>}
      </div>
    )
  } else {
    body = <div className="coach-bubble is-idle" role="status">AI 코치가 자세를 보고 있어요</div>
  }

  return <div className="coach-bubble-wrap" aria-live="polite">{body}</div>
}

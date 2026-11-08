// 내 카메라 아래쪽 자세 인식 상태 (F-XNIIJM exceptions: 인식이 안 되면 세지 않고 안내한다).
import type { PoseModelState } from '../../hooks/usePose'

interface Props {
  modelState: PoseModelState
  isTracking: boolean
  isSupported: boolean
  setupHint: string
  isRunning: boolean
  onRetry: () => void
}

export default function PoseStatus({ modelState, isTracking, isSupported, setupHint, isRunning, onRetry }: Props) {
  if (!isSupported) return <p className="pose-status" role="status">이 운동은 아직 자동 인식을 지원하지 않아요</p>
  if (modelState === 'error') {
    return (
      <p className="pose-status is-error" role="alert">
        자세 인식을 불러오지 못했어요. 지금은 횟수가 올라가지 않아요.
        <button type="button" onClick={onRetry}>다시 시도</button>
      </p>
    )
  }
  if (modelState !== 'ready') return <p className="pose-status" role="status">자세 인식 준비 중…</p>
  if (!isRunning) return <p className="pose-status" role="status">일시정지 중에는 횟수를 세지 않아요</p>
  if (!isTracking) return <p className="pose-status is-warn" role="status">{setupHint}</p>
  return null
}

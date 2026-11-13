// 카메라 아래 자세 인식 상태 (학교 대항 화면). 문구는 poseNotice가 정한다.
import { poseNotice, type PoseState } from '../../lib/pose/poseNotice'

export default function PoseStatus({ onRetry, ...state }: PoseState & { onRetry: () => void }) {
  const notice = poseNotice(state)
  if (!notice) return null
  const className = `pose-status${notice.tone === 'info' ? '' : ` is-${notice.tone}`}`
  return (
    <p className={className} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.text}
      {notice.canRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
    </p>
  )
}

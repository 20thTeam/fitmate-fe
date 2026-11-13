// 자세 인식 상태 안내 문구 (F-XNIIJM exceptions: 인식이 안 되면 세지 않고 안내한다).
// 운동방은 무대 위 코치 말풍선, 학교 대항은 카메라 아래에 띄운다.
import type { PoseModelState } from '../../hooks/usePose'

export interface PoseState {
  modelState: PoseModelState
  isTracking: boolean
  isSupported: boolean
  setupHint: string
  isRunning: boolean
}

export interface PoseNotice {
  tone: 'info' | 'warn' | 'error'
  text: string
  /** 모델을 다시 불러올 수 있으면 true */
  canRetry?: boolean
}

/** 지금 보여줄 인식 상태 안내. 정상적으로 인식 중이면 null */
export function poseNotice({ modelState, isTracking, isSupported, setupHint, isRunning }: PoseState): PoseNotice | null {
  if (!isSupported) return { tone: 'info', text: '이 운동은 아직 자동 인식을 지원하지 않아요' }
  if (modelState === 'error') return { tone: 'error', text: '자세 인식을 불러오지 못했어요. 지금은 횟수가 올라가지 않아요.', canRetry: true }
  if (modelState !== 'ready') return { tone: 'info', text: '자세 인식 준비 중…' }
  if (!isRunning) return { tone: 'info', text: '일시정지 중에는 횟수를 세지 않아요' }
  if (!isTracking) return { tone: 'warn', text: setupHint }
  return null
}

// 카메라 권한·스트림 관리 (F-ZGIFAX). 영상은 브라우저 안에서만 쓰고 서버로 보내지 않는다
// (PL-XJUIRF 권장안: 기기 내 분석).

import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'off' | 'requesting' | 'on' | 'denied' | 'unavailable'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('off')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setState('off')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable')
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      // 장치가 빠지면 오류 상태로
      stream.getVideoTracks()[0]?.addEventListener('ended', () => setState('unavailable'))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState('on')
    } catch (e) {
      const name = (e as DOMException).name
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, state, start, stop }
}

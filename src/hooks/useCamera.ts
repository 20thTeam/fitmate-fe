// 카메라 권한·스트림·장치 선택 (F-ZGIFAX). 영상은 브라우저 안에서만 쓰고 서버로 보내지 않는다
// (PL-XJUIRF 권장안: 기기 내 분석).

import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'off' | 'requesting' | 'on' | 'denied' | 'unavailable'

export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('off')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    setState('off')
  }, [])

  const start = useCallback(async (id?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable')
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setState('requesting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, ...(id ? { deviceId: { exact: id } } : { facingMode: 'user' }) },
        audio: false,
      })
      streamRef.current = s
      setStream(s)
      // 장치가 빠지면 오류 상태로
      s.getVideoTracks()[0]?.addEventListener('ended', () => setState('unavailable'))
      // 권한을 받은 뒤에야 장치 이름이 보인다
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
      setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId ?? id ?? '')
      setState('on')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [])

  useEffect(() => stop, [stop])

  return { stream, state, devices, deviceId, start, stop, isOn: state === 'on' }
}

export const CAMERA_MESSAGE: Record<CameraState, string> = {
  off: '카메라가 꺼져 있어요',
  requesting: '카메라 권한을 요청하고 있어요…',
  on: '카메라가 정상 작동 중입니다',
  denied: '카메라 권한이 거부됐어요. 주소창 왼쪽 자물쇠 아이콘에서 카메라를 허용한 뒤 다시 시도해 주세요.',
  unavailable: '사용할 수 있는 카메라가 없어요. 카메라 연결을 확인해 주세요.',
}

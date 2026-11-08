// 카메라 확인 화면 (Figma '카메라 확인', F-ZGIFAX).
// 사용자가 직접 허용해야 하고, 거부·장치 없음이면 재시도 방법을 안내한다.
// 권한을 아직 안 정했으면 안내 창을 먼저 띄우고, 차단돼 있으면 허용 방법을 보여 준다.
// '카메라 연결'만 실제 상태로 판정하고, 나머지 자세·거리·밝기는 아직 자동 판정이 없어
// 사용자가 직접 확인하고 누르는 항목으로 둔다 (측정하지 않은 값을 통과처럼 보이지 않게).
import { useEffect, useState } from 'react'
import { CAMERA_MESSAGE, queryCameraPermission, watchCameraPermission, type CameraPermission, type useCamera } from '../hooks/useCamera'
import Backdrop, { type Theme } from './Backdrop'
import { CameraBlockedDialog, CameraIntroDialog } from './CameraPermissionDialogs'
import { CameraPreview } from './ui'
import checkGreen from '../assets/icons/check-green.png'
import checkGray from '../assets/icons/check-gray.png'

type Camera = ReturnType<typeof useCamera>

const SELF_CHECKS = ['전신이 화면에 보여요', '카메라와 거리가 적당해요', '밝기가 충분해요'] as const

interface Props {
  camera: Camera
  theme: Theme
  onBack: () => void
  onConfirm: () => void
  confirmLabel?: string
}

export default function CameraCheck({ camera, theme, onBack, onConfirm, confirmLabel = '운동 시작하기' }: Props) {
  const { state, start, stop } = camera
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const isOn = state === 'on'
  /** 들어올 때 확인한 권한. null이면 아직 확인 중 */
  const [permission, setPermission] = useState<CameraPermission | null>(null)
  const [isIntroDone, setIsIntroDone] = useState(false)
  const [isBlockedClosed, setIsBlockedClosed] = useState(false)

  // 이미 허용했으면 바로 켜고, 아니면 안내 창부터 보여 준다
  useEffect(() => {
    if (state !== 'off') return
    const ctl = new AbortController()
    queryCameraPermission().then((p) => {
      if (ctl.signal.aborted) return
      setPermission(p)
      if (p === 'granted') start()
    })
    return () => ctl.abort()
    // 처음 한 번만
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 브라우저 설정에서 허용으로 바꾸면 바로 다시 켠다
  useEffect(() => watchCameraPermission(() => start(camera.deviceId || undefined)), [start]) // eslint-disable-line react-hooks/exhaustive-deps

  const isIntroOpen = !isIntroDone && state === 'off' && (permission === 'prompt' || permission === 'unknown')
  const isBlockedOpen = !isBlockedClosed && !isOn && state !== 'requesting' && (state === 'denied' || (state === 'off' && permission === 'denied'))

  const handleAllow = () => {
    setIsIntroDone(true)
    start()
  }

  const handleRetry = () => {
    setIsBlockedClosed(false)
    start(camera.deviceId || undefined)
  }

  const toggleCheck = (label: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const handleToggleCamera = () => (isOn ? stop() : start(camera.deviceId || undefined))

  return (
    <Backdrop theme={theme} isDim>
      <div className="backdrop-body is-center" style={{ gap: 28 }}>
        <div className="col center" style={{ gap: 10 }}>
          <h1 className="t-display">카메라 확인</h1>
          <p className="t-h3 t-soft" style={{ fontWeight: 600 }}>AI가 전신이 잘 보이는지 확인해요. 안내에 따라 위치를 맞춰 주세요!</p>
        </div>

        <section className="card col" style={{ width: 654, padding: 32, gap: 18, alignItems: 'center' }}>
          <div className="camera-box" style={{ width: '100%', height: 304 }}>
            <button className={`toggle camera-box-chip ${isOn ? 'is-on' : ''}`} role="switch" aria-checked={isOn} onClick={handleToggleCamera}>
              {isOn ? '카메라 끄기' : '카메라 켜기'}<span className="toggle-track" />
            </button>
            <CameraPreview stream={camera.stream} emptyText={state === 'requesting' ? '카메라 권한을 기다리고 있어요…' : '카메라가 꺼져 있어요'} />
          </div>

          {(state === 'denied' || state === 'unavailable') && (
            <p className="t-danger t-small" role="alert" style={{ textAlign: 'center', lineHeight: 1.5 }}>
              {CAMERA_MESSAGE[state]}
              {state === 'denied' && <> <button className="t-small" style={{ textDecoration: 'underline', color: 'inherit' }} onClick={() => setIsBlockedClosed(false)}>허용 방법 보기</button></>}
            </p>
          )}

          {camera.devices.length > 1 && (
            <label className="row" style={{ gap: 10, fontSize: 13 }}>
              <span className="t-soft">카메라 선택</span>
              <select value={camera.deviceId} onChange={(e) => start(e.target.value)} style={{ borderRadius: 8, padding: '4px 8px' }}>
                {camera.devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `카메라 ${i + 1}`}</option>
                ))}
              </select>
            </label>
          )}

          <div className="col center" style={{ gap: 8 }}>
            <h2 className="t-h3">확인 목록</h2>
            <span className="check-item">
              <img src={isOn ? checkGreen : checkGray} alt="" />
              카메라 연결{!isOn && ` · ${state === 'requesting' ? '연결 중' : '안 됨'}`}
            </span>
            {SELF_CHECKS.map((label) => {
              const isChecked = checked.has(label)
              return (
                <button key={label} className="check-item" role="checkbox" aria-checked={isChecked} onClick={() => toggleCheck(label)}>
                  <img src={isChecked ? checkGreen : checkGray} alt="" />
                  {label}
                </button>
              )
            })}
            <span className="t-xs t-soft">눌러서 직접 확인해 주세요</span>
          </div>

          <div className="row" style={{ gap: 14, marginTop: 4 }}>
            <button className="btn btn-secondary" style={{ width: 205 }} onClick={handleRetry}>재확인하기</button>
            <button className="btn btn-primary" style={{ width: 205 }} disabled={!isOn} onClick={onConfirm}>{confirmLabel}</button>
          </div>
          <button className="t-small t-soft" style={{ textDecoration: 'underline' }} onClick={onBack}>운동방으로 돌아가기</button>
        </section>
      </div>

      {isIntroOpen && <CameraIntroDialog onAllow={handleAllow} onLater={onBack} />}
      {isBlockedOpen && <CameraBlockedDialog onRetry={handleRetry} onBack={onBack} onClose={() => setIsBlockedClosed(true)} />}
    </Backdrop>
  )
}

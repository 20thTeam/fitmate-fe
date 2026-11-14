// 카메라 확인 화면 (Figma '카메라 확인', F-ZGIFAX).
// 사용자가 직접 허용해야 하고, 거부·장치 없음이면 재시도 방법을 안내한다.
// 권한을 아직 안 정했으면 안내 창을 먼저 띄우고, 차단돼 있으면 허용 방법을 보여 준다.
// 확인 목록은 실제로 잰 값으로만 체크한다 (#7). 전신·거리는 자세 인식, 밝기는 영상 평균 밝기로 본다.
// 자세 인식 모델을 못 불러오면 측정할 수 없으니 사용자가 직접 눌러 확인하는 방식으로 돌아간다.
// 여기서 모델을 미리 불러 두면 운동방 입장 때 기다리지 않는다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBrightness } from '../hooks/useBrightness'
import { CAMERA_MESSAGE, queryCameraPermission, watchCameraPermission, type CameraPermission, type useCamera } from '../hooks/useCamera'
import { usePose } from '../hooks/usePose'
import { checkFraming, type Framing } from '../lib/pose/framing'
import type { PoseInput } from '../lib/pose/repCounter'
import Backdrop, { type Theme } from './Backdrop'
import { CameraBlockedDialog, CameraIntroDialog } from './CameraPermissionDialogs'
import { CameraPreview } from './ui'
import checkGreen from '../assets/icons/check-green.png'
import checkGray from '../assets/icons/check-gray.png'

type Camera = ReturnType<typeof useCamera>

const SELF_CHECKS = ['전신이 화면에 보여요', '카메라와 거리가 적당해요', '밝기가 충분해요'] as const
/** 이만큼 연속으로 같은 판정이 나와야 화면에 반영한다 (깜빡임 방지) */
const STABLE_FRAMES = 8

const FRAMING_HINT: Record<Exclude<Framing, 'ok'>, string> = {
  partial: '머리부터 발끝까지 화면에 들어오게 서 주세요',
  far: '조금 더 가까이 와 주세요',
  near: '조금 뒤로 물러나 주세요',
}

interface Check {
  label: string
  isOk: boolean
  hint?: string
}

interface Props {
  camera: Camera
  theme: Theme
  onBack: () => void
  onConfirm: () => void
  confirmLabel?: string
  /** 횟수를 세는 방인지. 권한 안내 문구가 달라진다 */
  isCounting?: boolean
}

export default function CameraCheck({ camera, theme, onBack, onConfirm, confirmLabel = '운동 시작하기', isCounting = true }: Props) {
  const { state, start, stop } = camera
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const isOn = state === 'on'
  /** 들어올 때 확인한 권한. null이면 아직 확인 중 */
  const [permission, setPermission] = useState<CameraPermission | null>(null)
  const [isIntroDone, setIsIntroDone] = useState(false)
  const [isBlockedClosed, setIsBlockedClosed] = useState(false)

  // 전신·거리: 매 프레임 판정하되 상태는 판정이 바뀌어 자리 잡았을 때만 바꾼다
  const [framing, setFraming] = useState<Framing | null>(null)
  const pending = useRef<{ value: Framing | null; count: number }>({ value: null, count: 0 })
  const onFrame = useCallback((input: PoseInput) => {
    const next = checkFraming(input.image)
    const p = pending.current
    if (p.value === next) p.count++
    else {
      p.value = next
      p.count = 1
    }
    if (p.count === STABLE_FRAMES) setFraming(next)
    return next !== 'partial'
  }, [])
  const pose = usePose({ stream: camera.stream, shouldLoad: isOn, isActive: isOn, onFrame, canvasRef: poseCanvasRef })
  const brightness = useBrightness(isOn ? camera.stream : null)
  const isAuto = pose.modelState !== 'error'

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

  const isBodyVisible = isOn && pose.isTracking
  const autoChecks: Check[] = [
    { label: SELF_CHECKS[0], isOk: isBodyVisible, hint: isOn && pose.modelState === 'ready' && !isBodyVisible ? FRAMING_HINT.partial : undefined },
    {
      label: SELF_CHECKS[1],
      isOk: isBodyVisible && framing === 'ok',
      hint: isBodyVisible && (framing === 'far' || framing === 'near') ? FRAMING_HINT[framing] : undefined,
    },
    { label: SELF_CHECKS[2], isOk: brightness === 'ok', hint: brightness === 'dark' ? '화면이 어두워요. 방 불을 켜 주세요' : undefined },
  ]
  const autoNote = !isOn ? '카메라를 켜면 자동으로 확인해요' : pose.modelState === 'ready' ? '자동으로 확인하고 있어요' : '자세 인식 준비 중…'

  const handleToggleCamera = () => (isOn ? stop() : start(camera.deviceId || undefined))

  return (
    <Backdrop theme={theme} isDim>
      <div className="backdrop-body is-center" style={{ gap: 28 }}>
        <div className="col center" style={{ gap: 10 }}>
          <h1 className="t-display">카메라 확인</h1>
          <p className="t-h3 t-soft" style={{ fontWeight: 600 }}>AI가 전신이 잘 보이는지 확인해요. 안내에 따라 위치를 맞춰 주세요!</p>
        </div>

        <section className="card col" style={{ width: 654, padding: 32, gap: 18, alignItems: 'center' }}>
          <div className="camera-box is-whole" style={{ width: '100%', height: 304 }}>
            <button className={`toggle camera-box-chip ${isOn ? 'is-on' : ''}`} role="switch" aria-checked={isOn} onClick={handleToggleCamera}>
              {isOn ? '카메라 끄기' : '카메라 켜기'}<span className="toggle-track" />
            </button>
            <CameraPreview stream={camera.stream} emptyText={state === 'requesting' ? '카메라 권한을 기다리고 있어요…' : '카메라가 꺼져 있어요'} />
            {isOn && <canvas ref={poseCanvasRef} className="pose-overlay" aria-hidden />}
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
            {isAuto
              ? autoChecks.map((c) => (
                <span key={c.label} className="col center" style={{ gap: 2 }}>
                  <span className="check-item">
                    <img src={c.isOk ? checkGreen : checkGray} alt="" />
                    {c.label}
                  </span>
                  {c.hint && <span className="check-hint" role="status">{c.hint}</span>}
                </span>
              ))
              : SELF_CHECKS.map((label) => {
                const isChecked = checked.has(label)
                return (
                  <button key={label} className="check-item" role="checkbox" aria-checked={isChecked} onClick={() => toggleCheck(label)}>
                    <img src={isChecked ? checkGreen : checkGray} alt="" />
                    {label}
                  </button>
                )
              })}
            {isAuto
              ? <span className="t-xs t-soft">{autoNote}</span>
              : (
                <span className="t-xs t-soft">
                  자동 확인을 못 해서 눌러서 직접 확인해 주세요 · <button className="t-xs t-soft" style={{ textDecoration: 'underline' }} onClick={pose.retry}>다시 시도</button>
                </span>
              )}
          </div>

          <div className="row" style={{ gap: 14, marginTop: 4 }}>
            <button className="btn btn-secondary" style={{ width: 205 }} onClick={handleRetry}>재확인하기</button>
            <button className="btn btn-primary" style={{ width: 205 }} disabled={!isOn} onClick={onConfirm}>{confirmLabel}</button>
          </div>
          <button className="t-small t-soft" style={{ textDecoration: 'underline' }} onClick={onBack}>운동방으로 돌아가기</button>
        </section>
      </div>

      {isIntroOpen && <CameraIntroDialog onAllow={handleAllow} onLater={onBack} isCounting={isCounting} />}
      {isBlockedOpen && <CameraBlockedDialog onRetry={handleRetry} onBack={onBack} onClose={() => setIsBlockedClosed(true)} isCounting={isCounting} />}
    </Backdrop>
  )
}

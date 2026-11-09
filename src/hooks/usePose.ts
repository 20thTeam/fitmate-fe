// 카메라 영상에서 관절 33개를 찾는다 (MediaPipe Pose Landmarker, F-XNIIJM).
// 영상은 브라우저 안에서만 분석하고 밖으로 보내지 않는다 (PL-XJUIRF).
// 매 프레임 결과는 콜백(ref)으로만 넘기고 React 상태는 '인식 중/놓침'이 바뀔 때만 바꾼다.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
// 가벼운 모델(약 5.8MB). 3D 무대와 같이 돌아야 해서 정확도보다 속도를 택했다.
// 시연장 인터넷이 불안해도 되도록 외부 서버가 아닌 우리 배포에서 받는다 (#4).
// 원본: storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1
import modelUrl from '../assets/models/pose_landmarker_lite.task?url'
import type { Lm } from '../lib/pose/landmarks'
import type { PoseInput } from '../lib/pose/repCounter'
/** 이만큼 연속으로 못 찾으면 '놓침'으로 바꾼다 (잠깐 가려지는 건 무시) */
const LOST_AFTER_FRAMES = 12
const FOUND_AFTER_FRAMES = 3

export type PoseModelState = 'idle' | 'loading' | 'ready' | 'error'

// 모델은 한 번만 불러와 여러 화면이 같이 쓴다
let landmarker: PoseLandmarker | null = null
let loading: Promise<PoseLandmarker> | null = null

function loadPoseModel() {
  if (landmarker) return Promise.resolve(landmarker)
  if (!loading) {
    loading = (async () => {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const create = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions({ wasmLoaderPath, wasmBinaryPath }, {
          baseOptions: { modelAssetPath: modelUrl, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
      // GPU가 안 되는 브라우저는 CPU로 다시 시도
      const created = await create('GPU').catch(() => create('CPU'))
      landmarker = created
      return created
    })()
    loading.catch(() => {
      loading = null // 다시 시도할 수 있게
    })
  }
  return loading
}

interface Options {
  stream: MediaStream | null
  /** true가 되면 모델을 미리 불러온다 (입장 로딩 중에 받아 두기) */
  shouldLoad: boolean
  /** true일 때만 매 프레임 분석한다 (일시정지·휴식 중에는 쉰다) */
  isActive: boolean
  /** 매 프레임 관절 입력 (같은 객체를 고쳐 쓴다). 판정에 쓸 관절이 보였으면 true를 돌려준다. */
  onFrame: (input: PoseInput) => boolean
  /** 내 카메라 위에 뼈대를 그릴 캔버스 */
  canvasRef?: RefObject<HTMLCanvasElement | null>
}

export function usePose({ stream, shouldLoad, isActive, onFrame, canvasRef }: Options) {
  const [isLoaded, setIsLoaded] = useState(!!landmarker)
  const [loadKey, setLoadKey] = useState(0)
  /** 실패한 시도 번호. 다시 시도하면 loadKey가 바뀌어 '불러오는 중'으로 돌아간다 */
  const [failedKey, setFailedKey] = useState(-1)
  const [isTracking, setIsTracking] = useState(false)
  const modelState: PoseModelState = isLoaded ? 'ready' : failedKey === loadKey ? 'error' : shouldLoad ? 'loading' : 'idle'
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  useEffect(() => {
    if (!shouldLoad || isLoaded) return
    const ctl = new AbortController()
    loadPoseModel()
      .then(() => !ctl.signal.aborted && setIsLoaded(true))
      .catch(() => !ctl.signal.aborted && setFailedKey(loadKey))
    return () => ctl.abort()
  }, [shouldLoad, isLoaded, loadKey])

  const retry = useCallback(() => setLoadKey((k) => k + 1), [])

  useEffect(() => {
    const model = landmarker
    if (!isActive || !stream || modelState !== 'ready' || !model) return
    // 화면에 보이는 미리보기와 따로 분석용 video를 둔다
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    video.play().catch(() => {})

    const canvas = canvasRef?.current ?? null
    const ctx = canvas?.getContext('2d') ?? null
    const ctl = new AbortController()
    let lastVideoTime = -1
    let hits = 0
    let misses = 0
    let isFound = false
    const input: PoseInput = { world: [], image: [], aspect: 4 / 3, t: 0 }

    const draw = (points: Lm[] | undefined, isOk: boolean) => {
      if (!canvas || !ctx) return
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!points) return
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.strokeStyle = isOk ? 'rgba(186, 255, 140, 0.9)' : 'rgba(255, 255, 255, 0.55)'
      ctx.beginPath()
      for (const c of BONES) {
        const a = points[c[0]]
        const b = points[c[1]]
        if (a.visibility < 0.5 || b.visibility < 0.5) continue
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height)
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height)
      }
      ctx.stroke()
    }

    const loop = () => {
      if (ctl.signal.aborted) return
      requestAnimationFrame(loop)
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime
      const t = performance.now()
      let isOk = false
      try {
        const result = model.detectForVideo(video, t)
        const world = result.worldLandmarks[0]
        const image = result.landmarks[0]
        if (world && image) {
          input.world = world
          input.image = image
          input.aspect = video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3
          input.t = t
          isOk = onFrameRef.current(input)
        }
        draw(image, isOk)
      } catch {
        // 프레임 하나 실패는 건너뛴다 (판정하지 않음)
      }
      if (isOk) {
        misses = 0
        hits++
        if (!isFound && hits >= FOUND_AFTER_FRAMES) {
          isFound = true
          setIsTracking(true)
        }
      } else {
        hits = 0
        misses++
        if (isFound && misses >= LOST_AFTER_FRAMES) {
          isFound = false
          setIsTracking(false)
        }
      }
    }
    // 멈출 때는 ctl.abort()로 다음 프레임에서 빠져나온다
    requestAnimationFrame(loop)

    return () => {
      ctl.abort()
      video.pause()
      video.srcObject = null
      setIsTracking(false)
      if (canvas) ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [isActive, stream, modelState, canvasRef])

  return { modelState, isTracking, retry }
}

/** 뼈대 선 (얼굴은 빼고 몸통·팔·다리만) */
const BONES: readonly (readonly [number, number])[] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
]

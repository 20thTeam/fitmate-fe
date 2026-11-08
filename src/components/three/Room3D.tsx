// 3D 운동방 캔버스. 이 파일은 lazy로 불러서 운동방에 들어갈 때만 three.js를 받는다.
// 스크린 내용과 이름표는 캔버스 위에 DOM으로 겹치고, 매 프레임 3D 위치에 맞춰 옮긴다.
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Participant } from '../../types/domain'
import type { Theme } from '../Backdrop'
import Environment from './Environment'
import Characters3D from './Characters3D'
import { PALETTES } from './palette'
import { SCREEN_CENTER, SCREEN_CORNERS, SCREEN_FACE_Z, SCREEN_PX_H, SCREEN_PX_W, ROW_Z, TAG_Y, figureX, projectToPx, quadToMatrix3d } from './layout'

/** tour: 대기 중 정면 + 드래그로 둘러보기·휠로 확대, front: 운동 중 스크린 정면 고정. 구도는 Figma 1:5 */
export type CameraView = 'tour' | 'front'

// tour: 눈높이를 스크린 가운데보다 조금 낮게 두면 무대 뒤 가장자리가 화면 높이의 약 68%에 온다 (시안과 같음)
// front: 운동 중에는 하단 패널이 커서, 조금 위에서 내려다봐 스크린을 위로 올리고 캐릭터 자리를 만든다
const SHOT: Record<CameraView, { eyeY: number; lookY: number }> = {
  tour: { eyeY: SCREEN_CENTER[1] - 0.2, lookY: SCREEN_CENTER[1] - 0.2 },
  front: { eyeY: 3.6, lookY: 1.9 },
}
// 시안 프레임 1440×1024 기준 거리. 이보다 좁은 화면이면 물러나서 스크린 폭 비율을 지킨다
const BASE_DIST = 16.4
const DESIGN_ASPECT = 1440 / 1024
const isReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// 드래그로 둘러보기 (대기 화면만). 좌우는 한 바퀴 다 돌 수 있고, 위아래는 조금만 움직인다.
// 손을 떼고 잠시 뒤 가까운 쪽으로 돌아 시안 정면 구도로 돌아온다.
const DRAG_MIN_PITCH = -0.03
const DRAG_MAX_PITCH = 0.12
const RETURN_DELAY_MS = 4000
// 휠 확대·축소 (대기 화면만). 1 = 시안 구도 거리. 확대한 거리는 운동을 시작할 때 기본으로 돌아간다.
const ZOOM_MIN = 0.7
const ZOOM_MAX = 1.35
const ZOOM_SPEED = 0.0015

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** 각도를 -π~π로 맞춘다 (정면으로 돌아올 때 가까운 쪽으로 돌게) */
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function CameraRig({ view }: { view: CameraView }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  // 매 프레임 재사용하는 벡터 (새 객체를 만들지 않는다)
  const goal = useMemo(() => new Vector3(), [])
  const lookGoal = useMemo(() => new Vector3(), [])
  const look = useRef(new Vector3(SCREEN_CENTER[0], SHOT[view].lookY, SCREEN_CENTER[2]))
  // 드래그 상태는 ref에만 둔다 (매 프레임 읽고, React 상태로 다시 그리지 않는다)
  const drag = useRef({ isDragging: false, startX: 0, startY: 0, baseAzimuth: 0, basePitch: 0, azimuth: 0, pitch: 0, releasedAt: 0, zoom: 1, zoomGoal: 1 })
  const canDrag = view === 'tour'

  useEffect(() => {
    const el = gl.domElement
    const d = drag.current
    el.classList.toggle('is-draggable', canDrag)
    if (!canDrag) {
      d.isDragging = false
      d.zoomGoal = 1
      el.classList.remove('is-dragging')
      return
    }
    const handleDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      d.isDragging = true
      d.startX = e.clientX
      d.startY = e.clientY
      d.azimuth = wrapAngle(d.azimuth)
      d.baseAzimuth = d.azimuth
      d.basePitch = d.pitch
      el.classList.add('is-dragging')
      el.setPointerCapture(e.pointerId)
    }
    const handleMove = (e: PointerEvent) => {
      if (!d.isDragging) return
      // 무대를 잡고 끄는 느낌: 오른쪽으로 끌면 카메라는 왼쪽으로 돈다
      d.azimuth = d.baseAzimuth - ((e.clientX - d.startX) / el.clientWidth) * Math.PI * 1.6
      d.pitch = clamp(d.basePitch + ((e.clientY - d.startY) / el.clientHeight) * 0.5, DRAG_MIN_PITCH, DRAG_MAX_PITCH)
    }
    const handleUp = (e: PointerEvent) => {
      if (!d.isDragging) return
      d.isDragging = false
      d.releasedAt = performance.now()
      el.classList.remove('is-dragging')
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    // 스크린 내용 위에서 굴려도 확대되게 캔버스와 스크린이 함께 든 층에 건다 (패널 위는 제외)
    const wheelTarget = el.closest('.scene-stage') ?? el
    const handleWheel = (e: Event) => {
      if (!(e instanceof WheelEvent)) return
      // 페이지 스크롤·트랙패드 핀치(브라우저 확대) 대신 무대만 확대한다
      e.preventDefault()
      d.zoomGoal = clamp(d.zoomGoal * Math.exp(e.deltaY * ZOOM_SPEED), ZOOM_MIN, ZOOM_MAX)
    }
    wheelTarget.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('pointerdown', handleDown)
    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleUp)
    return () => {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
      wheelTarget.removeEventListener('wheel', handleWheel)
      el.classList.remove('is-draggable', 'is-dragging')
    }
  }, [gl, canDrag])

  useFrame((state, delta) => {
    const d = drag.current
    // 운동 중이거나 손을 뗀 지 잠시 지나면 정면으로 천천히 돌아온다
    if (!canDrag || (!d.isDragging && performance.now() - d.releasedAt > RETURN_DELAY_MS)) {
      const back = 1 - Math.exp(-delta * 1.5)
      d.azimuth = wrapAngle(d.azimuth)
      d.azimuth -= d.azimuth * back
      d.pitch -= d.pitch * back
    }
    d.zoom += (d.zoomGoal - d.zoom) * (1 - Math.exp(-delta * 6))
    const aspect = size.width / size.height
    const dist = BASE_DIST * Math.max(1, DESIGN_ASPECT / aspect) * d.zoom
    const swing = canDrag && !isReducedMotion ? Math.sin(state.clock.elapsedTime * 0.2) * 0.07 : 0
    // 마우스를 따라 아주 조금 움직여 입체감을 준다 (드래그 중에는 끔)
    const parallaxX = d.isDragging ? 0 : state.pointer.x * 0.05
    const parallaxY = d.isDragging ? 0 : state.pointer.y * 0.15
    const azimuth = swing + d.azimuth + parallaxX
    const shot = SHOT[view]
    lookGoal.set(SCREEN_CENTER[0], shot.lookY, SCREEN_CENTER[2])
    goal.set(
      lookGoal.x + Math.sin(azimuth) * dist,
      shot.eyeY + Math.sin(d.pitch) * dist + parallaxY,
      lookGoal.z + Math.cos(azimuth) * dist,
    )
    // 드래그 중에는 손을 바로 따라오게 빠르게 맞춘다
    const k = 1 - Math.exp(-delta * (d.isDragging ? 10 : 1.8))
    camera.position.lerp(goal, k)
    look.current.lerp(lookGoal, k)
    camera.lookAt(look.current)
  })
  return null
}

interface OverlayProps {
  screenRef: RefObject<HTMLDivElement | null>
  tagRefs: RefObject<Map<string, HTMLElement>>
  tagIds: string[]
  rowZ: number
}

/** 스크린 내용·이름표 DOM을 3D 위치에 맞춘다. CameraRig 다음에 두어 같은 프레임의 카메라를 쓴다. */
function OverlayProjector({ screenRef, tagRefs, tagIds, rowZ }: OverlayProps) {
  const temp = useMemo(() => new Vector3(), [])
  const point = useMemo(() => new Vector3(), [])
  const quad = useMemo(() => [0, 0, 0, 0, 0, 0, 0, 0], [])

  useFrame(({ camera, size }) => {
    const screen = screenRef.current
    if (screen) {
      let isVisible = true
      SCREEN_CORNERS.forEach((corner, i) => {
        isVisible = projectToPx(corner, camera, size.width, size.height, temp, quad, i * 2) && isVisible
      })
      // 스크린 뒤로 돌아가면 내용이 거울처럼 비치지 않게 숨긴다
      if (camera.position.z < SCREEN_FACE_Z) isVisible = false
      screen.style.visibility = isVisible ? 'visible' : 'hidden'
      if (isVisible) screen.style.transform = quadToMatrix3d(quad, SCREEN_PX_W, SCREEN_PX_H)
    }
    tagIds.forEach((id, i) => {
      const tag = tagRefs.current.get(id)
      if (!tag) return
      point.set(figureX(i, tagIds.length), TAG_Y, rowZ)
      // 캐릭터는 스크린 앞에 서 있어서 스크린 뒤에서는 가려진다
      const isVisible = projectToPx(point, camera, size.width, size.height, temp, quad) && camera.position.z >= SCREEN_FACE_Z
      tag.style.visibility = isVisible ? 'visible' : 'hidden'
      tag.style.transform = `translate(${quad[0]}px, ${quad[1]}px) translate(-50%, -50%)`
    })
  })
  return null
}

interface Props {
  theme: Theme
  screen?: ReactNode
  participants: Participant[]
  selfId?: string
  onCheer?: (p: Participant) => void
  maxShown?: number
  view: CameraView
}

export default function Room3D({ theme, screen, participants, selfId, onCheer, maxShown = 6, view }: Props) {
  const palette = PALETTES[theme]
  const screenRef = useRef<HTMLDivElement>(null)
  const tagRefs = useRef(new Map<string, HTMLElement>())
  const shown = selfId ? participants.slice(0, maxShown) : []
  const tagIds = shown.map((p) => p.userId)

  return (
    <>
      <Canvas
        className="scene-canvas"
        dpr={[1, 1.75]}
        shadows
        flat
        camera={{ fov: 38, position: [0, 2.45, 13.8], near: 0.1, far: 120 }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.sky, 36, 95]} />
        <hemisphereLight args={[palette.hemiSky, palette.hemiGround, 1.7]} />
        <directionalLight
          position={[6, 11, 8]}
          intensity={1.5}
          color={palette.sun}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={10}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0004}
        />
        <Environment theme={theme} palette={palette} />
        {selfId && <Characters3D participants={shown} selfId={selfId} rowZ={ROW_Z[view]} onCheer={onCheer} />}
        <CameraRig view={view} />
        <OverlayProjector screenRef={screenRef} tagRefs={tagRefs} tagIds={tagIds} rowZ={ROW_Z[view]} />
      </Canvas>

      {screen && (
        <div ref={screenRef} className="screen-3d" style={{ width: SCREEN_PX_W, height: SCREEN_PX_H }}>
          {screen}
        </div>
      )}
      <div className="scene-tags" aria-hidden>
        {shown.map((p) => (
          <span
            key={p.userId}
            className="figure-tag"
            ref={(el) => {
              if (el) tagRefs.current.set(p.userId, el)
              else tagRefs.current.delete(p.userId)
            }}
          >
            {p.nickname}{p.userId === selfId && ' (나)'}
          </span>
        ))}
      </div>
    </>
  )
}

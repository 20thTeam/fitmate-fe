// 3D 운동방 캔버스. 이 파일은 lazy로 불러서 운동방에 들어갈 때만 three.js를 받는다.
// 스크린 내용과 이름표는 캔버스 위에 DOM으로 겹치고, 매 프레임 3D 위치에 맞춰 옮긴다.
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Participant } from '../../types/domain'
import type { Theme } from '../Backdrop'
import Environment from './Environment'
import Characters3D from './Characters3D'
import { PALETTES } from './palette'
import { SCREEN_CENTER, SCREEN_CORNERS, SCREEN_PX_H, SCREEN_PX_W, ROW_Z, TAG_Y, figureX, projectToPx, quadToMatrix3d } from './layout'

/** tour: 대기 중 왼쪽↔오른쪽 시점을 천천히 오간다 (Figma 1:1620 ↔ 1:1622), front: 운동 중 스크린 정면 (1:533) */
export type CameraView = 'tour' | 'front'

const LOOK_AT = new Vector3(SCREEN_CENTER[0], SCREEN_CENTER[1] - 0.7, SCREEN_CENTER[2] + 1)
const isReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function CameraRig({ view }: { view: CameraView }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  // 매 프레임 재사용하는 벡터 (새 객체를 만들지 않는다)
  const goal = useMemo(() => new Vector3(), [])
  const look = useRef(LOOK_AT.clone())

  useFrame((state, delta) => {
    const aspect = size.width / size.height
    // 화면이 좁으면 뒤로 물러나서 스크린이 잘리지 않게 한다
    const dist = 18 * Math.max(1, 1.75 / aspect)
    const swing = view === 'tour' && !isReducedMotion ? Math.sin(state.clock.elapsedTime * 0.16) * 0.4 : 0
    // 마우스를 따라 아주 조금 움직여 입체감을 준다
    const azimuth = swing + state.pointer.x * 0.05
    goal.set(
      LOOK_AT.x + Math.sin(azimuth) * dist,
      4.4 + state.pointer.y * 0.25,
      LOOK_AT.z + Math.cos(azimuth) * dist,
    )
    const k = 1 - Math.exp(-delta * 1.8)
    camera.position.lerp(goal, k)
    look.current.lerp(LOOK_AT, k)
    camera.lookAt(look.current)
  })
  return null
}

interface OverlayProps {
  screenRef: RefObject<HTMLDivElement | null>
  tagRefs: RefObject<Map<string, HTMLElement>>
  tagIds: string[]
}

/** 스크린 내용·이름표 DOM을 3D 위치에 맞춘다. CameraRig 다음에 두어 같은 프레임의 카메라를 쓴다. */
function OverlayProjector({ screenRef, tagRefs, tagIds }: OverlayProps) {
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
      screen.style.visibility = isVisible ? 'visible' : 'hidden'
      if (isVisible) screen.style.transform = quadToMatrix3d(quad, SCREEN_PX_W, SCREEN_PX_H)
    }
    tagIds.forEach((id, i) => {
      const tag = tagRefs.current.get(id)
      if (!tag) return
      point.set(figureX(i, tagIds.length), TAG_Y, ROW_Z)
      const isVisible = projectToPx(point, camera, size.width, size.height, temp, quad)
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
        camera={{ fov: 38, position: [0, 4.4, 16], near: 0.1, far: 120 }}
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
        {selfId && <Characters3D participants={shown} selfId={selfId} onCheer={onCheer} />}
        <CameraRig view={view} />
        <OverlayProjector screenRef={screenRef} tagRefs={tagRefs} tagIds={tagIds} />
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

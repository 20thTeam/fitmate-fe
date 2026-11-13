// 무대 위 3D 캐릭터. 프로필 캐릭터에 3D 모델(GLB)이 있으면 모델을, 없으면 말랑한 공 모양을 세운다.
// 실제 참가자만 세우고, 운동 중인 사람만 움직인다 (가짜 참가자·자동 모션 금지).
// 내 캐릭터는 내 카메라 관절 좌표(livePose)로 팔다리를 움직인다 (#10). 친구 캐릭터는 아직 상태(운동 중/대기)만 반영한다.
// 이름표는 Room3D가 DOM으로 겹친다.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, Color, SphereGeometry, type Group, type Material, type Mesh } from 'three'
import type { Participant } from '../../types/domain'
import { characterOf } from '../../config/characters'
import { hasFreshLivePose, livePose } from '../../lib/pose/livePose'
import ThreeBoundary from './ThreeBoundary'
import { useCharacterModel } from './useCharacterModel'
import { BODY_R, figureX } from './layout'

/** 운동 중 통통 튀는 높이 */
const BOUNCE_H = BODY_R * 0.4
/** 대기 중(본인 제외) 캐릭터를 조금 흐리게 */
const IDLE_OPACITY = 0.85

/** 위→아래 그라데이션을 꼭짓점 색으로 칠한 공 (2D 캐릭터 그림과 같은 색) */
function useGradientBody(characterId: string) {
  const geometry = useMemo(() => {
    const [top, bottom] = characterOf(characterId).gradient
    const g = new SphereGeometry(BODY_R, 40, 28)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const a = new Color(top)
    const b = new Color(bottom)
    const c = new Color()
    for (let i = 0; i < pos.count; i++) {
      c.copy(b).lerp(a, (pos.getY(i) + BODY_R) / (BODY_R * 2))
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    return g
  }, [characterId])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

interface BodyProps {
  characterId: string
  index: number
  isExercising: boolean
  isFaded: boolean
}

/** 모델이 없거나 불러오는 중·실패했을 때의 공 모양 몸 */
function BallBody({ characterId, index, isExercising, isFaded }: BodyProps) {
  const body = useGradientBody(characterId)
  const bodyRef = useRef<Mesh>(null)

  useFrame((state) => {
    const mesh = bodyRef.current
    if (!mesh) return
    const t = state.clock.elapsedTime + index * 0.7
    if (isExercising) {
      const bounce = Math.abs(Math.sin(t * 3.2))
      mesh.scale.set(1 + (1 - bounce) * 0.08, 0.92 + bounce * 0.1, 1 + (1 - bounce) * 0.08)
    } else {
      const breath = Math.sin(t * 1.6) * 0.025
      mesh.scale.set(1 - breath * 0.5, 0.94 + breath, 1 - breath * 0.5)
    }
  })

  return (
    <>
      <mesh ref={bodyRef} geometry={body} position={[0, BODY_R, 0]} castShadow>
        <meshStandardMaterial vertexColors emissive={characterOf(characterId).gradient[1]} emissiveIntensity={0.18} roughness={0.45} transparent={isFaded} opacity={isFaded ? IDLE_OPACITY : 1} />
      </mesh>
      {[-0.31, 0.31].map((k) => (
        <mesh key={k} position={[k * BODY_R, BODY_R * 1.18, BODY_R * 0.88]}>
          <sphereGeometry args={[BODY_R * 0.12, 12, 10]} />
          <meshStandardMaterial color="#3a2a39" roughness={0.3} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((k) => (
        <mesh key={k} position={[k * BODY_R, BODY_R * 0.9, BODY_R * 0.8]} scale={[1, 0.6, 0.4]}>
          <sphereGeometry args={[BODY_R * 0.145, 10, 8]} />
          <meshStandardMaterial color="#ff8fb1" transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  )
}

function ModelBody({ url, index, isExercising, isFaded, isSelf }: BodyProps & { url: string; isSelf: boolean }) {
  const { model, rig } = useCharacterModel(url)
  const bodyRef = useRef<Group>(null)
  const isPosedRef = useRef(false)

  useEffect(() => {
    bodyRef.current?.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      const m = mesh.material as Material
      m.transparent = isFaded
      m.opacity = isFaded ? IDLE_OPACITY : 1
      m.needsUpdate = true
    })
  }, [model, isFaded])

  // 공 모양과 같은 리듬으로 살짝 늘었다 줄었다 한다. 모델은 형태가 있어 폭을 작게 둔다
  useFrame((state) => {
    const body = bodyRef.current
    if (!body) return
    // 내 카메라에서 관절이 잡히는 동안은 그 자세를 그대로 따라 한다
    const now = performance.now()
    if (isSelf && rig && hasFreshLivePose(now)) {
      body.scale.set(1, 1, 1)
      rig.apply(livePose.world, now)
      isPosedRef.current = true
      return
    }
    if (isPosedRef.current) {
      rig?.relax()
      isPosedRef.current = false
    }
    const t = state.clock.elapsedTime + index * 0.7
    if (isExercising) {
      const bounce = Math.abs(Math.sin(t * 3.2))
      body.scale.set(1 + (1 - bounce) * 0.03, 0.97 + bounce * 0.04, 1)
    } else {
      body.scale.set(1, 1 + Math.sin(t * 1.6) * 0.012, 1)
    }
  })

  return (
    <group ref={bodyRef}>
      <primitive object={model} />
    </group>
  )
}

interface FigureProps {
  participant: Participant
  x: number
  z: number
  index: number
  isSelf: boolean
  onCheer?: (p: Participant) => void
}

function Figure({ participant, x, z, index, isSelf, onCheer }: FigureProps) {
  const rootRef = useRef<Group>(null)
  const isExercising = participant.status === 'exercising'
  const canCheer = !!onCheer && !isSelf
  const modelUrl = characterOf(participant.characterId).modelUrl
  const bodyProps: BodyProps = { characterId: participant.characterId, index, isExercising, isFaded: !isExercising && !isSelf }

  // 매 프레임: ref만 바꾸고 새 객체를 만들지 않는다 (AGENTS.md 성능 규칙)
  useFrame((state) => {
    const root = rootRef.current
    if (!root) return
    const t = state.clock.elapsedTime + index * 0.7
    // 카메라 자세를 따라 하는 중이면 튀지 않는다 (발을 바닥에 붙여 둔다)
    const isPosed = isSelf && !!modelUrl && hasFreshLivePose(performance.now())
    root.position.y = isExercising && !isPosed ? Math.abs(Math.sin(t * 3.2)) * BOUNCE_H : 0
  })

  // 캔버스의 기본 커서(드래그용 grab)를 캐릭터 위에서만 손가락으로 바꾼다
  const setCursor = (target: EventTarget | null, cursor: string) => {
    if (canCheer && target instanceof HTMLElement) target.style.cursor = cursor
  }

  const ball = <BallBody {...bodyProps} />

  return (
    <group position={[x, 0, z]}>
      {isSelf && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[BODY_R * 1.13, BODY_R * 1.35, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      )}
      <group
        ref={rootRef}
        onClick={(e) => {
          // 무대를 돌리려고 끈 거면 응원으로 치지 않는다
          if (!canCheer || e.delta > 6) return
          e.stopPropagation()
          onCheer(participant)
        }}
        onPointerOver={(e) => setCursor(e.nativeEvent.target, 'pointer')}
        onPointerOut={(e) => setCursor(e.nativeEvent.target, '')}
      >
        {modelUrl ? (
          // 모델을 받는 동안·받지 못했을 때는 공 모양으로 대신 세운다
          <ThreeBoundary fallback={ball}>
            <Suspense fallback={ball}>
              <ModelBody url={modelUrl} isSelf={isSelf} {...bodyProps} />
            </Suspense>
          </ThreeBoundary>
        ) : (
          ball
        )}
      </group>
    </group>
  )
}

interface Props {
  participants: Participant[]
  selfId: string
  rowZ: number
  maxShown?: number
  onCheer?: (p: Participant) => void
}

export default function Characters3D({ participants, selfId, rowZ, maxShown = 6, onCheer }: Props) {
  const shown = participants.slice(0, maxShown)
  return (
    <>
      {shown.map((p, i) => (
        <Figure
          key={p.userId}
          participant={p}
          index={i}
          x={figureX(i, shown.length)}
          z={rowZ}
          isSelf={p.userId === selfId}
          onCheer={onCheer}
        />
      ))}
    </>
  )
}

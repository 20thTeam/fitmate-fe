// 무대 위 3D 캐릭터. 프로필 캐릭터에 3D 모델(GLB)이 있으면 모델을, 없으면 말랑한 공 모양을 세운다.
// 실제 참가자만 세우고, 운동 중인 사람만 움직인다 (가짜 참가자·자동 모션 금지).
// 관절 좌표(PoseFrame)로 동작을 맞추는 건 다음 단계 — 지금은 상태(운동 중/대기)만 반영한다.
// 이름표는 Room3D가 DOM으로 겹친다.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Box3, BufferAttribute, Color, SphereGeometry, type Group, type Material, type Mesh } from 'three'
import type { Participant } from '../../types/domain'
import { characterOf } from '../../config/characters'
import ThreeBoundary from './ThreeBoundary'
import { relaxArms } from './rig'

import { BODY_R, MODEL_H, figureX } from './layout'

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

/**
 * GLB를 참가자마다 복제해서 쓴다. 같은 캐릭터를 여러 명이 골라도 뼈대가 따로 움직여야 해서
 * 뼈대까지 복제하고, 흐리게 하는 값이 서로 번지지 않게 재질도 복제한다.
 */
function useCharacterModel(url: string) {
  const { scene } = useGLTF(url, false, false)
  const { model, materials } = useMemo(() => {
    const root = cloneSkinned(scene)
    const cloned: Material[] = []
    root.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const own = (mesh.material as Material).clone()
      mesh.material = own
      cloned.push(own)
    })
    // 키는 T자세에서 재고(팔을 내려도 키는 같다), 발바닥을 바닥(y=0)에 맞춘다
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root)
    const scale = MODEL_H / Math.max(box.max.y - box.min.y, 0.001)
    relaxArms(root)
    root.scale.setScalar(scale)
    root.position.y = -box.min.y * scale
    return { model: root, materials: cloned }
  }, [scene])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  return { model, materials }
}

function ModelBody({ url, index, isExercising, isFaded }: BodyProps & { url: string }) {
  const { model } = useCharacterModel(url)
  const bodyRef = useRef<Group>(null)

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
    root.position.y = isExercising ? Math.abs(Math.sin(t * 3.2)) * BOUNCE_H : 0
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
              <ModelBody url={modelUrl} {...bodyProps} />
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

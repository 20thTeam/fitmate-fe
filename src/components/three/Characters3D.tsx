// 무대 위 3D 캐릭터. 프로필 캐릭터(그라데이션 동그라미)를 말랑한 공 모양으로 세운다.
// 실제 참가자만 세우고, 운동 중인 사람만 움직인다 (가짜 참가자·자동 모션 금지).
// 관절 좌표(PoseFrame)로 동작을 맞추는 건 다음 단계 — 지금은 상태(운동 중/대기)만 반영한다.
// 이름표는 Room3D가 DOM으로 겹친다.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, Color, SphereGeometry, type Group, type Mesh } from 'three'
import type { Participant } from '../../types/domain'
import { characterOf } from '../../config/characters'

import { BODY_R, figureX } from './layout'

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

interface FigureProps {
  participant: Participant
  x: number
  z: number
  index: number
  isSelf: boolean
  onCheer?: (p: Participant) => void
}

function Figure({ participant, x, z, index, isSelf, onCheer }: FigureProps) {
  const body = useGradientBody(participant.characterId)
  const rootRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const isExercising = participant.status === 'exercising'
  const canCheer = !!onCheer && !isSelf

  // 매 프레임: ref만 바꾸고 새 객체를 만들지 않는다 (AGENTS.md 성능 규칙)
  useFrame((state) => {
    const root = rootRef.current
    const mesh = bodyRef.current
    if (!root || !mesh) return
    const t = state.clock.elapsedTime + index * 0.7
    if (isExercising) {
      const bounce = Math.abs(Math.sin(t * 3.2))
      root.position.y = bounce * BODY_R * 0.4
      mesh.scale.set(1 + (1 - bounce) * 0.08, 0.92 + bounce * 0.1, 1 + (1 - bounce) * 0.08)
    } else {
      root.position.y = 0
      const breath = Math.sin(t * 1.6) * 0.025
      mesh.scale.set(1 - breath * 0.5, 0.94 + breath, 1 - breath * 0.5)
    }
  })

  // 캔버스의 기본 커서(드래그용 grab)를 캐릭터 위에서만 손가락으로 바꾼다
  const setCursor = (target: EventTarget | null, cursor: string) => {
    if (canCheer && target instanceof HTMLElement) target.style.cursor = cursor
  }

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
        <mesh ref={bodyRef} geometry={body} position={[0, BODY_R, 0]} castShadow>
          <meshStandardMaterial vertexColors emissive={characterOf(participant.characterId).gradient[1]} emissiveIntensity={0.18} roughness={0.45} transparent={!isExercising && !isSelf} opacity={!isExercising && !isSelf ? 0.85 : 1} />
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

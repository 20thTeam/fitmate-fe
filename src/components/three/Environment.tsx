// 운동방 3D 배경: 무대 바닥 · 큰 스크린 · 가로등 · 덤불 · 나무 · 바위 · 뒤쪽 배경 그림.
// 구도는 Figma 1:5(추천 루틴 확인·친구) 정면 시안에 맞췄다: 스크린이 무대 뒤 가장자리에 붙고,
// 무대가 화면 아래를 채우며 좌우로 넘어가고, 무대 뒤로 덤불·바위, 양끝에 나무가 살짝 보인다.
import { useMemo, useRef } from 'react'
import { BackSide, MirroredRepeatWrapping, SRGBColorSpace, type Object3D } from 'three'
import { RoundedBox, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { RoomPalette } from './palette'
import { SCREEN_CENTER, SCREEN_H, SCREEN_W } from './layout'
import { foliageGeometry, type Blob } from './foliage'
import type { Theme } from '../Backdrop'

const GROUND_Y = -0.6

// 배경 벽은 한 바퀴(360°)를 감는다. 그림 한 장이 120°를 덮고, 좌우를 번갈아 뒤집어 3장을 이어 붙여
// 이음새가 자연스럽다. 가운데 장(뒤집힌 장)이 정면에 오는데, 벽 안쪽에서 보면 다시 뒤집혀 원래 방향이 된다.
// 1장과 3장이 만나는 이음새는 처음 카메라 바로 뒤(+z)라 거기에 큰 나무를 세워 가린다.
const WALL_RADIUS = 34
const WALL_TILES = 3

function BackdropWall({ palette }: { palette: RoomPalette }) {
  const source = useTexture(palette.backdrop)
  const texture = useMemo(() => {
    const t = source.clone()
    t.colorSpace = SRGBColorSpace
    t.wrapS = MirroredRepeatWrapping
    t.repeat.set(WALL_TILES, 1 - palette.backdropCropBottom)
    t.offset.set(0, palette.backdropCropBottom)
    t.needsUpdate = true
    return t
  }, [source, palette.backdropCropBottom])
  const image = source.image as { width: number; height: number }
  // 그림 비율을 지키도록 벽 높이를 정한다
  const tileArc = (Math.PI * 2) / WALL_TILES
  const height = ((WALL_RADIUS * tileArc) / image.width) * image.height * (1 - palette.backdropCropBottom)
  return (
    <mesh position={[0, palette.backdropBottom + height / 2, 0]}>
      <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, height, 96, 1, true]} />
      <meshBasicMaterial map={texture} side={BackSide} fog={false} toneMapped={false} />
    </mesh>
  )
}

function Lamp({ position, palette }: { position: [number, number, number]; palette: RoomPalette }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.2, 16]} />
        <meshStandardMaterial color={palette.lampPost} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 2.8, 12]} />
        <meshStandardMaterial color={palette.lampPost} roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[0.62, 0.5, 0.62]} />
        <meshStandardMaterial color={palette.lampGlow} emissive={palette.lampGlow} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3, 0.4]} color={palette.lampGlow} intensity={6} distance={7} decay={2} />
    </group>
  )
}

// Figma 배경 그림의 나무: 굵은 분홍 줄기가 두 갈래로 갈라지고, 큰 잎 덩어리 4~5개가 겹친다
const TREE_BLOBS: Blob[] = [
  [-0.45, 3.55, 0, 1.25],
  [0.95, 3.15, 0.15, 1.05],
  [-1.15, 2.65, 0.35, 0.95],
  [0.25, 4.25, -0.45, 0.95],
  [0.25, 2.75, 0.85, 0.8],
]
// 줄기에서 갈라지는 가지: 시작점, 끝점, 굵기
const TREE_BRANCHES: [[number, number], [number, number], number][] = [
  [[0, 1.5], [-0.95, 2.55], 0.13],
  [[0.05, 1.7], [0.85, 2.6], 0.11],
]

function Branch({ from, to, radius, color }: { from: [number, number]; to: [number, number]; radius: number; color: string }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy)
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0]} rotation={[0, 0, -Math.atan2(dx, dy)]} castShadow>
      <cylinderGeometry args={[radius * 0.75, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

function Tree({ position, scale = 1, palette }: { position: [number, number, number]; scale?: number; palette: RoomPalette }) {
  const leaves = foliageGeometry('tree', TREE_BLOBS, palette.foliage)
  return (
    <group position={position} scale={scale} name={PROP_NAME} userData={{ cullRadius: 2.6 * scale }}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.36, 2.4, 12]} />
        <meshStandardMaterial color={palette.trunk} roughness={0.85} />
      </mesh>
      {TREE_BRANCHES.map(([from, to, r], i) => (
        <Branch key={i} from={from} to={to} radius={r} color={palette.trunk} />
      ))}
      <mesh geometry={leaves} castShadow>
        <meshStandardMaterial vertexColors roughness={1} emissive={palette.foliage.light} emissiveIntensity={0.16} />
      </mesh>
    </group>
  )
}

// 공개방(바다)은 야자수. 줄기는 마디를 조금씩 휘게 쌓고, 잎은 끝이 처지는 길쭉한 잎 7장.
const PALM_SEGMENTS = Array.from({ length: 6 }, (_, i) => ({ x: 0.035 * i * i, y: 0.45 + i * 0.85 }))
const PALM_TOP = { x: 0.035 * 25 + 0.1, y: 0.45 + 5 * 0.85 + 0.45 }
const PALM_LEAVES = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2 + 0.3)
// 잎 한 장은 두 마디로 꺾어 끝이 아래로 처지게 한다
const PALM_LEAF_PARTS: { offset: number; tilt: number; len: number }[] = [
  { offset: 0.75, tilt: 0.15, len: 0.8 },
  { offset: 1.95, tilt: 0.75, len: 0.75 },
]

function Palm({ position, isMirrored = false, palette }: { position: [number, number, number]; isMirrored?: boolean; palette: RoomPalette }) {
  const crown = foliageGeometry('palm-crown', [[PALM_TOP.x, PALM_TOP.y - 0.1, 0, 0.42]], palette.foliage)
  return (
    <group position={position} scale={[isMirrored ? -1 : 1, 1, 1]} name={PROP_NAME} userData={{ cullRadius: 3 }}>
      {PALM_SEGMENTS.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, -0.06 * i]} castShadow>
          <cylinderGeometry args={[0.15 - i * 0.01, 0.21 - i * 0.012, 0.9, 10]} />
          <meshStandardMaterial color={i % 2 ? palette.trunk : '#c99a6c'} roughness={0.9} />
        </mesh>
      ))}
      <mesh geometry={crown} castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {PALM_LEAVES.map((a, i) => (
        <group key={i} position={[PALM_TOP.x, PALM_TOP.y, 0]} rotation={[0, -a, 0]}>
          {PALM_LEAF_PARTS.map((part, j) => (
            <mesh
              key={j}
              position={[part.offset, -0.15 - j * 0.45, 0]}
              rotation={[0, 0, -part.tilt]}
              scale={[part.len, 0.06, 0.32 - j * 0.08]}
              castShadow
            >
              <sphereGeometry args={[1, 16, 8]} />
              <meshStandardMaterial color={j === 0 ? palette.foliage.base : palette.foliage.light} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 둥글고 각진 바위 (그림의 연보라 바위) */
function Rock({ position, scale = 1, palette }: { position: [number, number, number]; scale?: number; palette: RoomPalette }) {
  return (
    <mesh position={position} scale={[1.35 * scale, 0.8 * scale, scale]} rotation={[0.1, 0.6, 0]} castShadow receiveShadow name={PROP_NAME} userData={{ cullRadius: 1.4 * scale }}>
      <icosahedronGeometry args={[0.75, 1]} />
      <meshStandardMaterial color={palette.rock} roughness={0.7} flatShading emissive={palette.rock} emissiveIntensity={0.12} />
    </mesh>
  )
}

const BUSH_BLOBS: Blob[] = [
  [0, 0.5, 0, 0.72],
  [0.75, 0.38, 0.15, 0.55],
  [-0.72, 0.36, 0.1, 0.52],
  [0.25, 0.85, -0.2, 0.5],
  [-0.25, 0.3, 0.5, 0.42],
]

function Bush({ position, scale = 1, palette, hasFlowers = false }: { position: [number, number, number]; scale?: number; palette: RoomPalette; hasFlowers?: boolean }) {
  const leaves = foliageGeometry('bush', BUSH_BLOBS, palette.foliage)
  return (
    <group position={position} scale={scale} name={PROP_NAME} userData={{ cullRadius: 1.6 * scale }}>
      <mesh geometry={leaves} castShadow>
        <meshStandardMaterial vertexColors roughness={1} emissive={palette.foliage.light} emissiveIntensity={0.16} />
      </mesh>
      {hasFlowers && [[-0.3, 0.8, 0.45], [0.5, 0.65, 0.5], [0.05, 1.05, 0.3]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={i === 1 ? '#fff4c2' : '#f59ab5'} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** 스크린 틀과 빈 판. 안의 내용은 Room3D가 DOM으로 겹친다. */
function Screen({ palette }: { palette: RoomPalette }) {
  const [x, y, z] = SCREEN_CENTER
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[SCREEN_W + 0.4, SCREEN_H + 0.4, 0.28]} radius={0.12} castShadow>
        <meshStandardMaterial color={palette.frame} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.145]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshStandardMaterial color={palette.panel} emissive={palette.panel} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {/* 스크린 다리 */}
      {[-SCREEN_W / 3, SCREEN_W / 3].map((px) => (
        <mesh key={px} position={[px, -(SCREEN_H / 2 + y) / 2, -0.02]} castShadow>
          <boxGeometry args={[0.18, y - SCREEN_H / 2, 0.14]} />
          <meshStandardMaterial color={palette.frame} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// 무대 뒤 가장자리를 따라 놓는 덤불 (x, z, 크기). 스크린 바로 뒤는 가려지니 비워 둔다.
const BACK_BUSHES: [number, number, number][] = [
  [-16, -5.8, 3.4], [-12.6, -5.4, 2.9], [-9.4, -5.1, 2.5], [-7.2, -4.7, 1.8], [-5.3, -4.9, 1.5],
  [5.5, -4.9, 1.5], [7.4, -4.7, 1.8], [9.6, -5.1, 2.5], [12.8, -5.4, 2.9], [16.2, -5.8, 3.4],
]

// 무대 옆·뒤를 두르는 나무·덤불·바위. 정면 시안 구도(스크린 뒤쪽 ±55°)는 위에서 따로 배치했으니 비운다.
// 각도 a: 0 = 처음 카메라 뒤(+z), π = 스크린 뒤(-z). 무대(직사각형) 바깥에 오도록 무대 가장자리까지 거리 + 여유로 둔다.
const STAGE_HALF_W = 20
const STAGE_FRONT_Z = 21.8
const STAGE_BACK_Z = 4
const FRONT_GAP = 0.95

/** 무대 가운데에서 a 방향으로 무대 가장자리까지 거리 */
function stageEdge(a: number) {
  const sx = Math.abs(Math.sin(a))
  const cz = Math.cos(a)
  const zLimit = cz >= 0 ? STAGE_FRONT_Z : STAGE_BACK_Z
  return Math.min(sx > 0.001 ? STAGE_HALF_W / sx : Infinity, Math.abs(cz) > 0.001 ? zLimit / Math.abs(cz) : Infinity)
}

/** 같은 값이 나오는 0~1 흔들림 (배치가 매번 같게) */
const jitter = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

type Prop = { kind: 'tree' | 'bush' | 'rock'; x: number; z: number; scale: number }

const RING_PROPS: Prop[] = (() => {
  const props: Prop[] = []
  const count = 34
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (jitter(i) - 0.5) * 0.1
    // 스크린 뒤쪽 정면 구간은 비운다
    if (Math.abs(a - Math.PI) < FRONT_GAP) continue
    const kind: Prop['kind'] = i % 3 === 0 ? 'tree' : i % 7 === 2 ? 'rock' : 'bush'
    const gap = kind === 'tree' ? 4.5 : 2
    const r = Math.min(WALL_RADIUS - 3.5, stageEdge(a) + gap + jitter(i + 7) * 2)
    const scale = kind === 'tree' ? 1.4 + jitter(i + 3) * 0.5 : kind === 'rock' ? 1.2 : 1.6 + jitter(i + 5) * 0.8
    props.push({ kind, x: Math.sin(a) * r, z: Math.cos(a) * r, scale })
  }
  // 배경 벽 이음새(+z 정면) 가리개
  props.push({ kind: 'tree', x: 0.5, z: WALL_RADIUS - 5, scale: 2.4 })
  props.push({ kind: 'bush', x: -3, z: WALL_RADIUS - 4.5, scale: 2.6 }, { kind: 'bush', x: 3.5, z: WALL_RADIUS - 4.5, scale: 2.4 })
  return props
})()

function RingProps({ isFriend, palette }: { isFriend: boolean; palette: RoomPalette }) {
  return (
    <>
      {RING_PROPS.map((p, i) => {
        const position: [number, number, number] = [p.x, GROUND_Y, p.z]
        if (p.kind === 'tree') {
          return isFriend
            ? <Tree key={i} position={position} scale={p.scale} palette={palette} />
            : <Palm key={i} position={position} isMirrored={p.x < 0} palette={palette} />
        }
        if (p.kind === 'rock') return <Rock key={i} position={[p.x, GROUND_Y + 0.3, p.z]} scale={p.scale} palette={palette} />
        return <Bush key={i} position={position} scale={p.scale} palette={palette} hasFlowers={!isFriend} />
      })}
    </>
  )
}

// 무대를 한 바퀴 돌 때 카메라가 나무·덤불 속을 지나가면 화면이 잎으로 덮인다.
// 카메라와 가까운(바닥 기준 거리) 소품은 그동안만 숨긴다.
const PROP_NAME = 'room-prop'

function NearPropCuller() {
  const scene = useThree((s) => s.scene)
  const props = useRef<Object3D[]>([])
  const childCount = useRef(-1)

  useFrame(({ camera }) => {
    // 장면이 다 올라오거나 바뀌었을 때만 소품 목록을 다시 모은다
    if (childCount.current !== scene.children.length) {
      childCount.current = scene.children.length
      props.current = scene.getObjectsByProperty('name', PROP_NAME)
    }
    for (const obj of props.current) {
      const dx = obj.position.x - camera.position.x
      const dz = obj.position.z - camera.position.z
      const r = (obj.userData.cullRadius as number | undefined) ?? 2
      obj.visible = dx * dx + dz * dz > r * r
    }
  })
  return null
}

export default function Environment({ theme, palette }: { theme: Theme; palette: RoomPalette }) {
  const isFriend = theme === 'friend'
  return (
    <>
      <BackdropWall palette={palette} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color={palette.ground} roughness={isFriend ? 0.9 : 0.3} />
      </mesh>

      {/* 무대 바닥: 뒤 가장자리는 스크린 바로 뒤, 앞은 카메라 밑까지 이어져 화면 아래를 채운다 */}
      <RoundedBox args={[40, 0.7, 26]} radius={0.18} position={[0, -0.35, 8.8]} receiveShadow>
        <meshStandardMaterial color={palette.platform} emissive={palette.platform} emissiveIntensity={0.3} roughness={0.3} />
      </RoundedBox>

      <Screen palette={palette} />

      <Lamp position={[-6.4, 0, -2.3]} palette={palette} />
      <Lamp position={[6.4, 0, -2.3]} palette={palette} />

      {BACK_BUSHES.map(([x, z, k]) => (
        <Bush key={x} position={[x, GROUND_Y, z]} scale={k * 0.8} palette={palette} hasFlowers={!isFriend} />
      ))}

      {isFriend ? (
        <>
          <Tree position={[-11, GROUND_Y, -6.2]} scale={1.55} palette={palette} />
          <Tree position={[11.2, GROUND_Y, -6.4]} scale={1.5} palette={palette} />
          <Tree position={[-17, GROUND_Y, -11]} scale={1.5} palette={palette} />
          <Tree position={[17.5, GROUND_Y, -11.5]} scale={1.45} palette={palette} />
        </>
      ) : (
        <>
          <Palm position={[-10.4, GROUND_Y, -5.6]} isMirrored palette={palette} />
          <Palm position={[10.6, GROUND_Y, -5.8]} palette={palette} />
        </>
      )}

      <Rock position={[-8.4, -0.1, -4.4]} scale={1.1} palette={palette} />
      <Rock position={[10.6, -0.1, -4.5]} scale={1.2} palette={palette} />
      <Rock position={[-15.5, -0.1, -4.8]} scale={1.3} palette={palette} />

      <RingProps isFriend={isFriend} palette={palette} />
      <NearPropCuller />
    </>
  )
}

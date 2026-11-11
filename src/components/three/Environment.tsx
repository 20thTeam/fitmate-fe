// 운동방 3D 배경: 무대 바닥 · 큰 스크린 · 가로등 · 덤불 · 나무 · 바위 · 뒤쪽 배경 그림.
// 구도는 Figma 1:5(추천 루틴 확인·친구) 정면 시안에 맞췄다: 스크린이 무대 뒤 가장자리에 붙고,
// 무대가 화면 아래를 채우며 좌우로 넘어가고, 무대 뒤로 덤불·바위, 양끝에 나무가 살짝 보인다.
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, Box3, CanvasTexture, Color, MirroredRepeatWrapping, SRGBColorSpace, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { MeshReflectorMaterial, RoundedBox, useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { RoomPalette } from './palette'
import { SCREEN_CENTER, SCREEN_H, SCREEN_W } from './layout'
import type { Theme } from '../Backdrop'
// 나무·덤불·바위 모델: Quaternius "Stylized Nature MegaKit" (CC0). 원본에서 노멀맵을 빼고 그림을 512px로 줄였다
import tree1Model from '../../assets/props/CommonTree_1.glb?url'
import tree2Model from '../../assets/props/CommonTree_3.glb?url'
import bush1Model from '../../assets/props/Bush_Common.glb?url'
import bush2Model from '../../assets/props/Bush_Common_Flowers.glb?url'
import rock1Model from '../../assets/props/Rock_Medium_1.glb?url'
import rock2Model from '../../assets/props/Rock_Medium_3.glb?url'

const PROP_MODELS = { tree: [tree1Model, tree2Model], bush: [bush1Model, bush2Model], rock: [rock1Model, rock2Model] }
type PropKind = keyof typeof PROP_MODELS
/** 모델 원래 색이 노을 배경보다 차가워서 따뜻한 분홍빛을 곱한다 */
const PROP_TINT = new Color('#ffcdbd')
const TINTED = 'isSunsetTinted'

/** 모델을 원하는 높이로 맞추고 바닥을 position.y에 붙여 세운다. 같은 종류가 똑같아 보이지 않게 위치로 모양·방향을 고른다 */
function ModelProp({ kind, position, height, cullRadius }: { kind: PropKind; position: [number, number, number]; height: number; cullRadius: number }) {
  const seed = Math.abs(Math.round(position[0] * 7 + position[2] * 13))
  const urls = PROP_MODELS[kind]
  const { scene } = useGLTF(urls[seed % urls.length], false, false)
  const model = useMemo(() => {
    const root = scene.clone()
    root.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = kind === 'rock'
      // 재질은 복제본끼리 같이 쓰니 색은 한 번만 입힌다
      const m = mesh.material as MeshStandardMaterial
      if (!m.userData[TINTED]) {
        m.color.multiply(PROP_TINT)
        // 그늘진 면이 배경보다 어둡게 가라앉지 않도록 제 색으로 살짝 밝힌다
        m.emissiveMap = m.map
        m.emissive.copy(PROP_TINT)
        m.emissiveIntensity = 0.3
        m.userData[TINTED] = true
      }
    })
    const box = new Box3().setFromObject(root)
    const k = height / Math.max(box.max.y - box.min.y, 0.001)
    root.scale.setScalar(k)
    root.position.y = -box.min.y * k
    return root
  }, [scene, height, kind])
  return (
    <group position={position} rotation={[0, seed * 1.7, 0]} name={PROP_NAME} userData={{ cullRadius }}>
      <primitive object={model} />
    </group>
  )
}

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

function Lamp({ position, palette, hasHalo = false }: { position: [number, number, number]; palette: RoomPalette; hasHalo?: boolean }) {
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
      {hasHalo && (
        <>
          {/* 시안처럼 머리 위아래에 짙은 테를 둘러 밝은 하늘 앞에서도 가로등 머리가 보이게 한다 */}
          <mesh position={[0, 3.41, 0]}>
            <boxGeometry args={[0.74, 0.12, 0.74]} />
            <meshStandardMaterial color={palette.lampPost} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <boxGeometry args={[0.5, 0.1, 0.5]} />
            <meshStandardMaterial color={palette.lampPost} roughness={0.6} />
          </mesh>
        </>
      )}
      {hasHalo && (
        <sprite position={[0, 3.1, 0]} scale={[2.4, 2.4, 1]}>
          <spriteMaterial map={getGlowTexture()} color={palette.lampGlow} blending={AdditiveBlending} transparent depthWrite={false} opacity={0.9} fog={false} />
        </sprite>
      )}
      <pointLight position={[0, 3, 0.4]} color={palette.lampGlow} intensity={6} distance={7} decay={2} />
    </group>
  )
}

let glowTexture: CanvasTexture | null = null

/** 가로등 둘레에 번지는 빛. 블룸(후처리) 대신 가운데가 밝은 둥근 그림을 겹친다 */
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  glowTexture = new CanvasTexture(canvas)
  glowTexture.colorSpace = SRGBColorSpace
  return glowTexture
}

interface PropProps {
  /** 바닥에 닿는 자리 */
  position: [number, number, number]
  scale?: number
}

function Tree({ position, scale = 1 }: PropProps) {
  return <ModelProp kind="tree" position={position} height={5.2 * scale} cullRadius={2.6 * scale} />
}

/** 바닥에 살짝 묻어 얹힌 느낌을 준다 */
function Rock({ position, scale = 1 }: PropProps) {
  return <ModelProp kind="rock" position={[position[0], position[1] - 0.08 * scale, position[2]]} height={1.3 * scale} cullRadius={1.4 * scale} />
}

function Bush({ position, scale = 1 }: PropProps) {
  return <ModelProp kind="bush" position={position} height={1.35 * scale} cullRadius={1.6 * scale} />
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

type Prop = { kind: PropKind; x: number; z: number; scale: number }

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

function RingProps() {
  return (
    <>
      {RING_PROPS.map((p, i) => {
        const Item = p.kind === 'tree' ? Tree : p.kind === 'rock' ? Rock : Bush
        return <Item key={i} position={[p.x, GROUND_Y, p.z]} scale={p.scale} />
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

// 공개방 무대 (Figma 바닷가 무대 시안). 스크린보다 조금 넓은 단상이라 옆 가장자리와 계단이 화면 양끝에 보인다.
// 앞쪽은 카메라 밑까지 이어진다. 단상 높이 0.6을 계단 4칸(0.15씩)으로 내려간다.
const PUBLIC_STAGE_HALF_W = 5.8
const PUBLIC_STAGE_BACK_Z = -4.4
const PUBLIC_STAGE_FRONT_Z = 21.8
const STAIR_Z = -2.4
const STAIR_LEN = 2.6
const STEP_RISE = 0.15
const STEP_RUN = 0.45

function PublicStage({ palette }: { palette: RoomPalette }) {
  const depth = PUBLIC_STAGE_FRONT_Z - PUBLIC_STAGE_BACK_Z
  const centerZ = (PUBLIC_STAGE_FRONT_Z + PUBLIC_STAGE_BACK_Z) / 2
  const width = PUBLIC_STAGE_HALF_W * 2
  return (
    <>
      <RoundedBox args={[width, 0.7, depth]} radius={0.12} position={[0, -0.35, centerZ]} receiveShadow>
        <meshStandardMaterial color={palette.stageSide} roughness={0.3} />
      </RoundedBox>
      {/* 윗면: 스크린·가로등·캐릭터가 흐릿하게 비치는 반짝이는 바닥. 반사 그림은 512px로 낮춰 부담을 줄인다 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, centerZ]} receiveShadow>
        <planeGeometry args={[width - 0.2, depth - 0.2]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[60, 420]}
          mixBlur={0.9}
          mixStrength={0.7}
          mixContrast={1}
          mirror={0.25}
          color={palette.platform}
          roughness={0.45}
          metalness={0.05}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {[0, 1, 2].map((i) => {
            const top = -STEP_RISE * (i + 1)
            const h = top - GROUND_Y
            return (
              <mesh key={i} position={[side * (PUBLIC_STAGE_HALF_W + STEP_RUN * (i + 0.5)), GROUND_Y + h / 2, STAIR_Z]} receiveShadow castShadow>
                <boxGeometry args={[STEP_RUN, h, STAIR_LEN]} />
                <meshStandardMaterial color={i % 2 ? palette.platform : palette.stageSide} roughness={0.3} />
              </mesh>
            )
          })}
        </group>
      ))}
    </>
  )
}

export default function Environment({ theme, palette }: { theme: Theme; palette: RoomPalette }) {
  const isFriend = theme === 'friend'
  return (
    <>
      <BackdropWall palette={palette} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        {isFriend
          ? <meshStandardMaterial color={palette.ground} roughness={0.9} />
          : <meshStandardMaterial color={palette.ground} emissive={palette.ground} emissiveIntensity={0.3} roughness={0.2} metalness={0.05} />}
      </mesh>

      {isFriend ? (
        // 무대 바닥: 뒤 가장자리는 스크린 바로 뒤, 앞은 카메라 밑까지 이어져 화면 아래를 채운다
        <RoundedBox args={[40, 0.7, 26]} radius={0.18} position={[0, -0.35, 8.8]} receiveShadow>
          <meshStandardMaterial color={palette.platform} emissive={palette.platform} emissiveIntensity={0.08} roughness={0.18} metalness={0.08} />
        </RoundedBox>
      ) : (
        <>
          <PublicStage palette={palette} />
          <Lamp position={[-5.3, 0, -2.6]} palette={palette} hasHalo />
          <Lamp position={[5.3, 0, -2.6]} palette={palette} hasHalo />
        </>
      )}

      <Screen palette={palette} />

      {isFriend && (
        <>
          <Lamp position={[-6.4, 0, -2.3]} palette={palette} />
          <Lamp position={[6.4, 0, -2.3]} palette={palette} />

          {BACK_BUSHES.map(([x, z, k]) => (
            <Bush key={x} position={[x, GROUND_Y, z]} scale={k * 0.8} />
          ))}

          <Tree position={[-11, GROUND_Y, -6.2]} scale={1.55} />
          <Tree position={[11.2, GROUND_Y, -6.4]} scale={1.5} />
          <Tree position={[-17, GROUND_Y, -11]} scale={1.5} />
          <Tree position={[17.5, GROUND_Y, -11.5]} scale={1.45} />

          <Rock position={[-8.4, GROUND_Y, -4.4]} scale={1.1} />
          <Rock position={[10.6, GROUND_Y, -4.5]} scale={1.2} />
          <Rock position={[-15.5, GROUND_Y, -4.8]} scale={1.3} />

          <RingProps />
          <NearPropCuller />
        </>
      )}
    </>
  )
}

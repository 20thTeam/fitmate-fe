// 운동방 3D 배경: 무대 바닥 · 큰 스크린 · 가로등 · 나무 · 바위 · 뒤쪽 배경 그림.
// Figma 1:1620(왼쪽) / 1:533(정면) / 1:1622(오른쪽) 시안을 한 장면으로 옮겼다.
import { useMemo } from 'react'
import { BackSide, RepeatWrapping, SRGBColorSpace } from 'three'
import { RoundedBox, useTexture } from '@react-three/drei'
import type { RoomPalette } from './palette'
import { SCREEN_CENTER, SCREEN_H, SCREEN_W } from './layout'
import type { Theme } from '../Backdrop'

const GROUND_Y = -0.6

function BackdropWall({ palette }: { palette: RoomPalette }) {
  const source = useTexture(palette.backdrop)
  const radius = 34
  const arc = (130 * Math.PI) / 180
  const texture = useMemo(() => {
    const t = source.clone()
    t.colorSpace = SRGBColorSpace
    // 안쪽에서 보면 좌우가 뒤집혀서 다시 뒤집는다
    t.wrapS = RepeatWrapping
    t.repeat.set(-1, 1 - palette.backdropCropBottom)
    t.offset.set(1, palette.backdropCropBottom)
    t.needsUpdate = true
    return t
  }, [source, palette.backdropCropBottom])
  const image = source.image as { width: number; height: number }
  // 그림 비율을 지키도록 벽 높이를 정한다
  const height = ((radius * arc) / image.width) * image.height * (1 - palette.backdropCropBottom)
  return (
    <mesh position={[0, GROUND_Y - 1 + height / 2, 0]}>
      <cylinderGeometry args={[radius, radius, height, 48, 1, true, Math.PI - arc / 2, arc]} />
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
      <mesh position={[0, 3.05, 0]}>
        <boxGeometry args={[0.46, 0.38, 0.46]} />
        <meshStandardMaterial color={palette.lampGlow} emissive={palette.lampGlow} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3, 0.4]} color={palette.lampGlow} intensity={6} distance={7} decay={2} />
    </group>
  )
}

const TREE_BLOBS: [number, number, number, number][] = [
  [0, 2.7, 0, 1.15],
  [0.85, 2.35, 0.25, 0.85],
  [-0.8, 2.25, 0.15, 0.8],
  [0.2, 3.45, -0.1, 0.8],
]

function Tree({ position, scale = 1, palette }: { position: [number, number, number]; scale?: number; palette: RoomPalette }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.34, 2.2, 10]} />
        <meshStandardMaterial color={palette.trunk} roughness={0.9} />
      </mesh>
      {TREE_BLOBS.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 24, 18]} />
          <meshStandardMaterial color={palette.foliage[i % 2]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

// 공개방(바다)은 야자수. 줄기는 마디를 조금씩 휘게 쌓고, 잎은 납작한 타원 6장.
const PALM_SEGMENTS = Array.from({ length: 6 }, (_, i) => ({ x: 0.035 * i * i, y: 0.45 + i * 0.85 }))
const PALM_TOP = { x: 0.035 * 25 + 0.1, y: 0.45 + 5 * 0.85 + 0.45 }
const PALM_LEAVES = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2)

function Palm({ position, isMirrored = false, palette }: { position: [number, number, number]; isMirrored?: boolean; palette: RoomPalette }) {
  return (
    <group position={position} scale={[isMirrored ? -1 : 1, 1, 1]}>
      {PALM_SEGMENTS.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, -0.06 * i]} castShadow>
          <cylinderGeometry args={[0.17 - i * 0.012, 0.21 - i * 0.012, 0.9, 10]} />
          <meshStandardMaterial color={palette.trunk} roughness={0.9} />
        </mesh>
      ))}
      {PALM_LEAVES.map((a, i) => (
        <mesh key={i} position={[PALM_TOP.x + Math.cos(a) * 1, PALM_TOP.y - 0.3, Math.sin(a) * 1]} rotation={[0, -a, -0.45]} scale={[1.3, 0.07, 0.34]} castShadow>
          <sphereGeometry args={[1, 20, 10]} />
          <meshStandardMaterial color={palette.foliage[i % 2]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Rock({ position, scale = 1, palette }: { position: [number, number, number]; scale?: number; palette: RoomPalette }) {
  return (
    <mesh position={position} scale={[1.3 * scale, 0.75 * scale, scale]} rotation={[0, 0.6, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color={palette.rock} roughness={0.8} flatShading />
    </mesh>
  )
}

const BUSH_BLOBS: [number, number, number, number][] = [
  [0, 0.35, 0, 0.6],
  [0.6, 0.25, 0.15, 0.45],
  [-0.55, 0.22, 0.1, 0.42],
]

function Bush({ position, palette, hasFlowers = false }: { position: [number, number, number]; palette: RoomPalette; hasFlowers?: boolean }) {
  return (
    <group position={position}>
      {BUSH_BLOBS.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 18, 14]} />
          <meshStandardMaterial color={palette.foliage[(i + 1) % 2]} roughness={0.95} />
        </mesh>
      ))}
      {hasFlowers && [[-0.3, 0.7, 0.35], [0.45, 0.55, 0.45], [0.05, 0.85, 0.25]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.11, 10, 8]} />
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

export default function Environment({ theme, palette }: { theme: Theme; palette: RoomPalette }) {
  const isFriend = theme === 'friend'
  return (
    <>
      <BackdropWall palette={palette} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color={palette.ground} roughness={isFriend ? 0.9 : 0.3} />
      </mesh>

      {/* 무대 바닥 */}
      <RoundedBox args={[18, 0.7, 10.5]} radius={0.18} position={[0, -0.35, 0.4]} receiveShadow>
        <meshStandardMaterial color={palette.platform} roughness={0.35} />
      </RoundedBox>

      <Screen palette={palette} />

      <Lamp position={[-6.2, 0, -2.4]} palette={palette} />
      <Lamp position={[6.2, 0, -2.4]} palette={palette} />

      {isFriend ? (
        <>
          <Tree position={[-10.6, GROUND_Y, -3.2]} scale={1.15} palette={palette} />
          <Tree position={[10.8, GROUND_Y, -3.6]} scale={1.05} palette={palette} />
          <Tree position={[-14, GROUND_Y, -9]} scale={1.3} palette={palette} />
          <Tree position={[14.5, GROUND_Y, -9.5]} scale={1.2} palette={palette} />
          <Bush position={[-9.6, GROUND_Y, 0.2]} palette={palette} />
          <Bush position={[9.8, GROUND_Y, 0.8]} palette={palette} />
          <Bush position={[-10.2, GROUND_Y, 3.4]} palette={palette} />
        </>
      ) : (
        <>
          <Palm position={[-10.4, GROUND_Y, -3.2]} isMirrored palette={palette} />
          <Palm position={[10.6, GROUND_Y, -3.6]} palette={palette} />
          <Bush position={[-9.6, GROUND_Y, 0.2]} palette={palette} hasFlowers />
          <Bush position={[9.8, GROUND_Y, 0.8]} palette={palette} hasFlowers />
          <Bush position={[10.2, GROUND_Y, 3.6]} palette={palette} hasFlowers />
        </>
      )}

      <Rock position={[-7.8, 0.25, -3.4]} palette={palette} />
      <Rock position={[8, 0.2, -3.6]} scale={0.8} palette={palette} />
    </>
  )
}

// 나무·덤불 잎 덩어리 만들기. 여러 공을 살짝 울퉁불퉁하게 만든 뒤 한 도형으로 합치고,
// 위는 밝은 연두 → 아래는 분홍빛 올리브로 꼭짓점 색을 칠한다 (Figma 배경 그림의 나무 느낌).
// 도형은 한 번 만들어 재사용한다 (장면이 바뀌어도 다시 만들지 않음).
import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry } from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/** x, y, z, 반지름 */
export type Blob = [number, number, number, number]

export interface FoliageColors {
  /** 아래쪽 그늘 (분홍빛이 도는 올리브) */
  shade: string
  /** 가운데 */
  base: string
  /** 위쪽 빛 받는 면 */
  light: string
}

const cache = new Map<string, BufferGeometry>()

/** 위치마다 같은 값이 나오는 부드러운 흔들림 (-1~1). 같은 꼭짓점이 갈라지지 않게 위치로만 계산한다 */
const wobble = (x: number, y: number, z: number, seed: number) =>
  Math.sin(x * 2.3 + seed) * Math.sin(y * 2.9 + seed * 1.7) * Math.sin(z * 2.1 + seed * 0.6)

function lumpyBall([cx, cy, cz, r]: Blob, seed: number) {
  // detail 3이면 매끈하면서도 그림처럼 아주 살짝 각이 보인다
  const raw = new IcosahedronGeometry(r, 3)
  raw.deleteAttribute('normal')
  raw.deleteAttribute('uv')
  const g = mergeVertices(raw)
  raw.dispose()
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = 1 + 0.07 * wobble(x / r, y / r, z / r, seed)
    // 아랫면은 조금 눌러서 덩어리가 얹힌 느낌을 준다
    const squash = y < 0 ? 0.88 : 1
    pos.setXYZ(i, cx + x * k, cy + y * k * squash, cz + z * k)
  }
  g.computeVertexNormals()
  return g
}

export function foliageGeometry(key: string, blobs: Blob[], colors: FoliageColors) {
  const cacheKey = `${key}|${colors.shade}|${colors.base}|${colors.light}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const parts = blobs.map((b, i) => lumpyBall(b, i * 1.37 + 0.5))
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  if (!merged) throw new Error('foliage merge failed')

  const pos = merged.attributes.position
  const nor = merged.attributes.normal
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i))
    maxY = Math.max(maxY, pos.getY(i))
  }
  const shade = new Color(colors.shade)
  const base = new Color(colors.base)
  const light = new Color(colors.light)
  const c = new Color()
  const out = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const h = (pos.getY(i) - minY) / Math.max(0.001, maxY - minY)
    // 높이로 기본 그라데이션, 위를 향한 면은 더 밝게
    const up = Math.max(0, nor.getY(i))
    const t = Math.min(1, h * 0.75 + up * 0.45)
    if (t < 0.5) c.copy(shade).lerp(base, t / 0.5)
    else c.copy(base).lerp(light, (t - 0.5) / 0.5)
    out.set([c.r, c.g, c.b], i * 3)
  }
  merged.setAttribute('color', new BufferAttribute(out, 3))
  cache.set(cacheKey, merged)
  return merged
}

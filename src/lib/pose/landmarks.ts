// MediaPipe Pose 33개 관절 번호와 각도 계산. 매 프레임 불리므로 새 객체를 만들지 않는다.

/** MediaPipe NormalizedLandmark·Landmark와 같은 모양 */
export interface Lm {
  x: number
  y: number
  z: number
  visibility: number
}

export const LM = {
  nose: 0,
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
} as const

/** 0 = 왼쪽, 1 = 오른쪽 (사람 기준) */
export type Side = 0 | 1

/** b를 꼭짓점으로 한 a-b-c 각도 (도). 3D 좌표로 계산해서 정면 카메라에서도 굽힘이 덜 왜곡된다. */
export function angleDeg(a: Lm, b: Lm, c: Lm) {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const abz = a.z - b.z
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const cbz = c.z - b.z
  const dot = abx * cbx + aby * cby + abz * cbz
  const len = Math.hypot(abx, aby, abz) * Math.hypot(cbx, cby, cbz)
  if (len === 0) return 180
  return (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI
}

export const dist = (a: Lm, b: Lm) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** 주어진 관절이 모두 보이는지 */
export function isVisible(lm: Lm[], ids: readonly number[], minVisibility: number) {
  for (const i of ids) {
    const p = lm[i]
    if (!p || p.visibility < minVisibility) return false
  }
  return true
}

/** 어깨-엉덩이-무릎-발목 중 더 잘 보이는 쪽 (옆에서 찍으면 한쪽이 가려진다) */
export function betterSide(lm: Lm[]): Side {
  const score = (s: Side) => lm[LM.shoulder[s]].visibility + lm[LM.hip[s]].visibility + lm[LM.knee[s]].visibility + lm[LM.ankle[s]].visibility
  return score(0) >= score(1) ? 0 : 1
}

/** 0~1로 자른 선형 보간 비율 */
export const ratio = (value: number, from: number, to: number) => Math.max(0, Math.min(1, (value - from) / (to - from)))

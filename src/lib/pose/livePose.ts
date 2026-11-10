// 내 카메라의 최신 관절 좌표를 3D 캐릭터에 넘기는 공유 칸.
// 매 프레임 바뀌는 값이라 React 상태·zustand 대신 숫자 배열 하나를 고쳐 쓴다 (AGENTS.md 성능 규칙).
// usePose가 쓰고, 운동방 3D의 내 캐릭터가 useFrame에서 읽는다. 브라우저 밖으로 나가지 않는다.
import type { Lm } from './landmarks'

const COUNT = 33
/** 이 시간 넘게 새 좌표가 없으면 캐릭터를 기본 자세로 돌린다 */
const STALE_MS = 400

export const livePose = {
  /** [x, y, z, visibility] × 33. MediaPipe 3D 좌표(미터, 엉덩이 가운데 기준, y는 아래쪽) */
  world: new Float32Array(COUNT * 4),
  /** 마지막으로 쓴 시각 (performance.now). 0이면 없음 */
  t: 0,
}

export function writeLivePose(world: Lm[], t: number) {
  const out = livePose.world
  for (let i = 0; i < COUNT; i++) {
    const p = world[i]
    if (!p) return
    out[i * 4] = p.x
    out[i * 4 + 1] = p.y
    out[i * 4 + 2] = p.z
    out[i * 4 + 3] = p.visibility
  }
  livePose.t = t
}

export function clearLivePose() {
  livePose.t = 0
}

export const hasFreshLivePose = (now: number) => livePose.t > 0 && now - livePose.t < STALE_MS

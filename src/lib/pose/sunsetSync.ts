// 공개 운동방 싱크로율 (#110). 따라하기 영상의 지금 동작을 내가 하고 있는지 1초마다 판정한다.
// 영상 강사는 블록 캐릭터라 자세 인식이 팔다리를 자주 놓쳐서, 강사 자세와 직접 비교하지 않고
// 영상 구간표(20초씩 6동작)로 지금 동작을 알고, 그 동작의 핵심 움직임을 내 자세에서 찾는다.
// 박자까지 맞췄는지는 보지 않는다. 매 프레임 불리므로 새 객체를 만들지 않는다 (AGENTS.md 성능 규칙).
// 좌표: MediaPipe 월드 좌표 (미터, 엉덩이 가운데 기준, y 아래, 사람의 왼쪽 = +x)
import { PROVISIONAL_SUNSET_SYNC as T } from '../../config/provisional'
import { LM, isVisible, type Lm } from './landmarks'

type MoveId = 'walk' | 'step_touch' | 'arm_open' | 'knee_up' | 'arm_reach' | 'cool_down'

/** 따라하기 영상(sunset-aerobic.mp4) 구간표. 영상을 바꾸면 같이 고친다 */
export const SUNSET_MOVES: readonly { id: MoveId; name: string; tip: string }[] = [
  { id: 'walk', name: '제자리 걷기', tip: '발을 번갈아 들어요' },
  { id: 'step_touch', name: '좌우 스텝 터치', tip: '옆으로 한 걸음씩 벌렸다 모아요' },
  { id: 'arm_open', name: '팔 벌리고 모으기', tip: '팔을 어깨 높이까지 크게 벌려요' },
  { id: 'knee_up', name: '무릎 번갈아 올리기', tip: '무릎을 번갈아 올려요' },
  { id: 'arm_reach', name: '좌우 한팔 뻗기', tip: '한 팔씩 옆으로 쭉 뻗어요' },
  { id: 'cool_down', name: '천천히 마무리', tip: '가볍게 걸으며 숨을 골라요' },
]
const MOVE_SEC = 20

/** 다리 움직임으로 판정하는 동작 (다리가 화면에 보여야 한다) */
export const isLegMove = (id: MoveId) => id !== 'arm_open' && id !== 'arm_reach'

/** 영상 재생 위치(초)의 동작 순서 (0~5) */
export const moveIndexAt = (videoTime: number) => Math.min(SUNSET_MOVES.length - 1, Math.max(0, Math.floor(videoTime / MOVE_SEC)))

/**
 * good: 지금 동작을 했어요, miss: 안 했어요, unseen: 이 동작에 필요한 팔·다리가 화면에 안 보여요,
 * none: 사람을 못 찾았어요. unseen·none은 싱크로율 계산에서 뺀다.
 */
export type SyncJudge = 'good' | 'miss' | 'unseen' | 'none'

const LEG_IDS = [LM.hip[0], LM.hip[1], LM.knee[0], LM.knee[1], LM.ankle[0], LM.ankle[1]]
const ARM_IDS = [LM.shoulder[0], LM.shoulder[1], LM.wrist[0], LM.wrist[1]]
const MIN_VISIBILITY = 0.5
/** 30fps × 2초. 판정 구간(1.5초)보다 넉넉하게 */
const CAP = 64
/** 좌표 떨림(1~2cm)이 움직임 폭으로 잡히지 않게 장면마다 값을 부드럽게 한다 */
const SMOOTH = 0.4

export function createSunsetSync() {
  // 장면마다 핵심 값만 고리 버퍼에 쌓는다
  const time = new Float64Array(CAP)
  const hasLegs = new Uint8Array(CAP)
  const hasArms = new Uint8Array(CAP)
  const ankleDiff = new Float64Array(CAP)
  const kneeDiff = new Float64Array(CAP)
  const footSpread = new Float64Array(CAP)
  const wristSpread = new Float64Array(CAP)
  const armSwap = new Float64Array(CAP)
  // 부드럽게 한 직전 값 (ankleDiff, kneeDiff, footSpread, wristSpread, armSwap)
  const prev = new Float64Array(5)
  let hasPrev = false
  let head = 0
  let size = 0
  let judged = 0
  let matched = 0

  const smooth = (k: number, v: number) => {
    prev[k] = hasPrev ? prev[k] + (v - prev[k]) * SMOOTH : v
    return prev[k]
  }

  const push = (w: Lm[], t: number) => {
    const legs = isVisible(w, LEG_IDS, MIN_VISIBILITY)
    const arms = isVisible(w, ARM_IDS, MIN_VISIBILITY)
    time[head] = t
    hasLegs[head] = legs ? 1 : 0
    hasArms[head] = arms ? 1 : 0
    ankleDiff[head] = smooth(0, w[LM.ankle[0]].y - w[LM.ankle[1]].y)
    kneeDiff[head] = smooth(1, w[LM.knee[0]].y - w[LM.knee[1]].y)
    footSpread[head] = smooth(2, Math.abs(w[LM.ankle[0]].x - w[LM.ankle[1]].x))
    wristSpread[head] = smooth(3, Math.abs(w[LM.wrist[0]].x - w[LM.wrist[1]].x))
    // 왼팔만 뻗으면 +, 오른팔만 뻗으면 -, 양팔을 같이 벌리면 0 근처
    armSwap[head] = smooth(4, Math.abs(w[LM.wrist[0]].x - w[LM.shoulder[0]].x) - Math.abs(w[LM.wrist[1]].x - w[LM.shoulder[1]].x))
    hasPrev = true
    head = (head + 1) % CAP
    if (size < CAP) size++
  }

  /** 최근 windowMs 안에서 mask가 1인 장면의 값 폭(최대-최소)을 outRange에 쓴다. 장면 수가 모자라면 false */
  let outRange = 0
  const scan = (values: Float64Array, mask: Uint8Array, now: number) => {
    let n = 0
    let lo = Infinity
    let hi = -Infinity
    for (let k = 0; k < size; k++) {
      const i = (head - 1 - k + CAP) % CAP
      if (now - time[i] > T.windowMs) break
      if (!mask[i]) continue
      n++
      if (values[i] < lo) lo = values[i]
      if (values[i] > hi) hi = values[i]
    }
    if (n < T.minFrames) return false
    outRange = hi - lo
    return true
  }

  /** 이 동작을 했는지. 필요한 팔·다리가 안 보이면 null */
  const isDoing = (id: MoveId, now: number): boolean | null => {
    switch (id) {
      case 'walk':
        return scan(ankleDiff, hasLegs, now) ? outRange >= T.walkM : null
      case 'cool_down':
        // 마무리는 가볍게 걷기라 기준을 절반으로 둔다
        return scan(ankleDiff, hasLegs, now) ? outRange >= T.walkM / 2 : null
      case 'step_touch':
        return scan(footSpread, hasLegs, now) ? outRange >= T.stepSpreadM : null
      case 'knee_up':
        return scan(kneeDiff, hasLegs, now) ? outRange >= T.kneeLiftM : null
      case 'arm_open': {
        // 양팔을 같이 벌려야 한다. 한 팔씩 뻗기도 손목 사이가 벌어지니 좌우 차이가 더 크면 아니다
        if (!scan(wristSpread, hasArms, now)) return null
        const spread = outRange
        scan(armSwap, hasArms, now)
        return spread >= T.armSpreadM && outRange < spread
      }
      case 'arm_reach':
        return scan(armSwap, hasArms, now) ? outRange >= T.reachSwapM : null
    }
  }

  /** 1초마다 부른다. 판정 결과를 싱크로율에 쌓고 돌려준다 */
  const judge = (videoTime: number, now: number): SyncJudge => {
    const latest = (head - 1 + CAP) % CAP
    if (size === 0 || now - time[latest] > T.windowMs) return 'none'
    const index = moveIndexAt(videoTime)
    let result = isDoing(SUNSET_MOVES[index].id, now)
    // 동작이 막 바뀌었으면 앞 동작을 하고 있어도 맞음으로 본다
    if (result !== true && index > 0 && videoTime - index * MOVE_SEC < T.graceSec) {
      const prev = isDoing(SUNSET_MOVES[index - 1].id, now)
      if (prev === true) result = true
    }
    if (result === null) return 'unseen'
    judged++
    if (result) matched++
    return result ? 'good' : 'miss'
  }

  /** 지금까지 싱크로율(0~100). 판정이 적으면 null */
  const rate = () => (judged >= T.minJudgedSec ? Math.round((matched / judged) * 100) : null)

  return { push, judge, rate }
}

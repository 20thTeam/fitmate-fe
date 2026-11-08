// 운동별 유효 횟수 판정 (F-XNIIJM, F-WLBEFJ, PL-OEFFCN).
// 시작 자세에서 벗어났다가 돌아오는 한 번의 움직임마다
//  - 목표 자세까지 갔으면 유효 1회
//  - 중간에 멈췄으면 세지 않고 자세 피드백
//  - 관절이 안 보이면 판정 보류 (진행 중이던 동작도 버린다)
// 매 프레임 불리므로 이벤트가 있을 때만 객체를 만든다.

import { PROVISIONAL_POSE_RULES as R } from '../../config/provisional'
import { LM, angleDeg, betterSide, dist, isVisible, ratio, type Lm, type Side } from './landmarks'

export type CounterEvent =
  | { kind: 'rep' }
  | { kind: 'seconds'; seconds: number }
  | { kind: 'fix'; text: string }
  | { kind: 'good'; text: string }

/** 한 프레임 입력. usePose가 객체 하나를 계속 고쳐 써서 매 프레임 새로 만들지 않는다 */
export interface PoseInput {
  /** 3D 관절 (미터, 엉덩이 중심). 각도 계산용 */
  world: Lm[]
  /** 화면 관절 (0~1). 바닥과 평행한지처럼 카메라 기준 방향을 볼 때 쓴다 */
  image: Lm[]
  /** 화면 가로 ÷ 세로 (image x를 y와 같은 단위로 맞출 때) */
  aspect: number
  t: number
}

export interface RepCounter {
  /** 관절 인식 실패 시 안내 문구 */
  setupHint: string
  /** 관절이 충분히 보이면 true. 판정 결과는 emit으로 알린다. */
  update: (input: PoseInput, emit: (e: CounterEvent) => void) => boolean
  /** 일시정지·운동 전환 때 진행 중인 동작을 버린다 */
  reset: () => void
}

/** 0 = 시작 자세, 1 = 목표 자세. 부족하면 fix 문구로 안내한다. */
interface Part {
  progress: (lm: Lm[]) => number
  fix: string
}

interface Track {
  joints: (lm: Lm[]) => readonly number[]
  parts: Part[]
  /** 이 트랙만의 최소 간격 (하이 니처럼 빠른 동작) */
  minRepMs?: number
  /** 움직이는 동안 지켜야 할 자세. 어기면 문구를 돌려준다. */
  checkForm?: (lm: Lm[]) => string | null
}

interface RepSpec {
  setupHint: string
  good: string
  tracks: Track[]
}

const STAND_HINT = '머리부터 발끝까지 화면에 보이게 한두 걸음 물러서 주세요'

/**
 * 움직임 시작·끝 판정 (흔들림에 반응하지 않게 간격을 둔다).
 * 끝 판정이 너무 엄격하면 다 일어서기 전에 다음 동작을 시작할 때 두 번이 한 번으로 합쳐진다.
 */
const START_AT = 0.45
const END_AT = 0.3
/** 부드럽게 따라가는 비율. 클수록 빠르게 반응한다 */
const SMOOTH = 0.6
/** 목표 자세 판정은 원래 값으로 하되, 튀는 값 하나에 속지 않게 두 프레임 연속으로 닿아야 인정한다 */
const REACHED = 1

const side = (lm: Lm[]) => betterSide(lm)
/** 한쪽 몸(어깨·엉덩이·무릎·발목). 매 프레임 배열을 만들지 않게 미리 둔다 */
const SIDE_BODY = [
  [LM.shoulder[0], LM.hip[0], LM.knee[0], LM.ankle[0]],
  [LM.shoulder[1], LM.hip[1], LM.knee[1], LM.ankle[1]],
] as const
const sideBody = (lm: Lm[]) => SIDE_BODY[side(lm)]
const BOTH_LEGS = [LM.hip[0], LM.knee[0], LM.ankle[0], LM.hip[1], LM.knee[1], LM.ankle[1]]
const JACK_JOINTS = [...LM.shoulder, ...LM.wrist, ...LM.hip, ...LM.ankle]
const kneeAngle = (lm: Lm[], s: Side) => angleDeg(lm[LM.hip[s]], lm[LM.knee[s]], lm[LM.ankle[s]])
const hipAngle = (lm: Lm[], s: Side) => angleDeg(lm[LM.shoulder[s]], lm[LM.hip[s]], lm[LM.knee[s]])
const toDeg = (r: number) => (r * 180) / Math.PI

/**
 * 몸통이 세로에서 기운 각도 (0 = 똑바로 섬). 양쪽 어깨·엉덩이 가운데를 이어서 본다.
 * 무릎을 얼마나 굽혔는지와 상관없어서 데드리프트처럼 무릎이 같이 굽는 동작도 잡힌다.
 */
function torsoLean(lm: Lm[]) {
  const [s0, s1] = LM.shoulder
  const [h0, h1] = LM.hip
  const dx = (lm[s0].x + lm[s1].x - lm[h0].x - lm[h1].x) / 2
  const dy = (lm[s0].y + lm[s1].y - lm[h0].y - lm[h1].y) / 2
  const dz = (lm[s0].z + lm[s1].z - lm[h0].z - lm[h1].z) / 2
  // y는 아래가 +라서 위쪽은 -dy
  return toDeg(Math.atan2(Math.hypot(dx, dz), -dy))
}

const SQUAT: RepSpec = {
  setupHint: STAND_HINT,
  good: '스쿼트 깊이가 좋아요',
  tracks: [{
    joints: sideBody,
    parts: [{ progress: (lm) => ratio(kneeAngle(lm, side(lm)), R.squat.kneeStand, R.squat.kneeDown), fix: '조금 더 깊이 앉아 주세요' }],
  }],
}

const LUNGE: RepSpec = {
  setupHint: STAND_HINT,
  good: '런지 깊이가 좋아요',
  tracks: [{
    joints: () => BOTH_LEGS,
    parts: [{
      progress: (lm) => ratio(Math.min(kneeAngle(lm, 0), kneeAngle(lm, 1)), R.lunge.kneeStand, R.lunge.kneeDown),
      fix: '무릎이 90도가 되도록 더 내려가 주세요',
    }],
  }],
}

const HIP_HINGE: RepSpec = {
  setupHint: '옆으로 서서 머리부터 발끝까지 보이게 해 주세요',
  good: '엉덩이 접기가 좋아요',
  tracks: [{
    joints: sideBody,
    parts: [{ progress: (lm) => ratio(torsoLean(lm), R.hipHinge.leanStand, R.hipHinge.leanDown), fix: '엉덩이를 뒤로 빼며 상체를 더 숙여 주세요' }],
    // 이보다 더 앉으면 스쿼트로 본다
    checkForm: (lm) => (kneeAngle(lm, side(lm)) < R.hipHinge.kneeMin ? '앉지 말고 엉덩이를 뒤로 빼며 숙여 주세요' : null),
  }],
}

const shoulderWidth = (lm: Lm[]) => Math.max(0.01, dist(lm[LM.shoulder[0]], lm[LM.shoulder[1]]))
const armAngle = (lm: Lm[], s: Side) => angleDeg(lm[LM.hip[s]], lm[LM.shoulder[s]], lm[LM.wrist[s]])

const JUMPING_JACK: RepSpec = {
  setupHint: STAND_HINT,
  good: '팔과 다리를 끝까지 벌렸어요',
  tracks: [{
    joints: () => JACK_JOINTS,
    parts: [
      { progress: (lm) => ratio(Math.min(armAngle(lm, 0), armAngle(lm, 1)), R.jumpingJack.armDown, R.jumpingJack.armUp), fix: '양팔을 머리 위까지 올려 주세요' },
      { progress: (lm) => ratio(dist(lm[LM.ankle[0]], lm[LM.ankle[1]]) / shoulderWidth(lm), R.jumpingJack.feetClosed, R.jumpingJack.feetOpen), fix: '발을 어깨보다 넓게 벌려 주세요' },
    ],
  }],
}

const kneeLift = (s: Side): Track => {
  const joints = [LM.shoulder[s], LM.hip[s], LM.knee[s]]
  return {
  joints: () => joints,
  parts: [{ progress: (lm) => ratio(hipAngle(lm, s), R.highKnees.hipStand, R.highKnees.hipUp), fix: '무릎을 허리 높이까지 올려 주세요' }],
  minRepMs: R.highKnees.minRepMs,
  }
}

const HIGH_KNEES: RepSpec = {
  setupHint: STAND_HINT,
  good: '무릎을 충분히 올렸어요',
  tracks: [kneeLift(0), kneeLift(1)],
}

const REP_SPECS: Record<string, RepSpec> = {
  squat: SQUAT,
  lunge: LUNGE,
  hip_hinge: HIP_HINGE,
  jumping_jack: JUMPING_JACK,
  aerobic_jumping_jack: JUMPING_JACK,
  high_knees: HIGH_KNEES,
}

function createRepCycleCounter(spec: RepSpec): RepCounter {
  // 트랙마다: 움직이는 중인지, 부분별 부드러운 값과 최고값, 자세 문제, 마지막 인정 시각
  const state = spec.tracks.map((tr) => ({
    isMoving: false,
    smooth: tr.parts.map(() => 0),
    peak: tr.parts.map(() => 0),
    /** 직전 프레임 원래 값 (두 프레임 연속 판정용) */
    prevRaw: tr.parts.map(() => 0),
    formIssue: null as string | null,
    lastRepAt: -Infinity,
    hasValue: false,
    /** 관절을 놓쳤다가 다시 찾으면 시작 자세로 한 번 돌아온 뒤부터 센다 (반쪽 동작 판정 방지) */
    needsRest: true,
  }))
  let needsGood = true

  const reset = () => {
    for (const s of state) {
      s.isMoving = false
      s.hasValue = false
      s.needsRest = true
      s.formIssue = null
      s.smooth.fill(0)
      s.peak.fill(0)
      s.prevRaw.fill(0)
    }
  }

  const update = ({ world: lm, t }: PoseInput, emit: (e: CounterEvent) => void) => {
    let isAnyVisible = false
    for (let ti = 0; ti < spec.tracks.length; ti++) {
      const tr = spec.tracks[ti]
      const s = state[ti]
      if (!isVisible(lm, tr.joints(lm), R.minVisibility)) {
        // 판정 보류: 진행 중이던 동작은 세지도, 피드백하지도 않는다
        s.isMoving = false
        s.hasValue = false
        s.needsRest = true
        continue
      }
      isAnyVisible = true
      let level = 0
      for (let pi = 0; pi < tr.parts.length; pi++) {
        const raw = tr.parts[pi].progress(lm)
        s.smooth[pi] = s.hasValue ? s.smooth[pi] + (raw - s.smooth[pi]) * SMOOTH : raw
        if (s.isMoving) s.peak[pi] = Math.max(s.peak[pi], Math.min(raw, s.prevRaw[pi]))
        s.prevRaw[pi] = raw
        level = Math.max(level, s.smooth[pi])
      }
      s.hasValue = true
      if (s.needsRest) {
        if (level < END_AT) s.needsRest = false
        continue
      }

      if (!s.isMoving) {
        if (level < START_AT) continue
        s.isMoving = true
        s.peak.fill(0)
        s.formIssue = null
      }
      if (tr.checkForm && !s.formIssue) s.formIssue = tr.checkForm(lm)
      if (level > END_AT) continue

      // 시작 자세로 돌아왔다 → 이번 동작 판정
      s.isMoving = false
      let fix: string | null = null
      for (let pi = 0; pi < tr.parts.length && !fix; pi++) if (s.peak[pi] < REACHED) fix = tr.parts[pi].fix
      fix ??= s.formIssue
      if (fix) {
        emit({ kind: 'fix', text: fix })
        needsGood = true
        continue
      }
      if (t - s.lastRepAt < (tr.minRepMs ?? R.minRepMs)) continue
      s.lastRepAt = t
      emit({ kind: 'rep' })
      // 첫 유효 동작과 고친 뒤 처음 성공한 동작만 칭찬한다 (피드백 과다 방지)
      if (needsGood) {
        needsGood = false
        emit({ kind: 'good', text: spec.good })
      }
    }
    return isAnyVisible
  }

  return { setupHint: spec.setupHint, update, reset }
}

/** 플랭크에 필요한 관절 (어깨·팔꿈치·엉덩이·발목, 한쪽) */
const PLANK_JOINTS = [
  [LM.shoulder[0], LM.elbow[0], LM.hip[0], LM.ankle[0]],
  [LM.shoulder[1], LM.elbow[1], LM.hip[1], LM.ankle[1]],
] as const

/**
 * 플랭크: 엎드려서 몸을 일직선으로 유지한 시간만 1초 단위로 센다.
 * 엎드림은 화면 좌표로 본다 (3D 깊이 추정은 흔들려서 서 있어도 누운 걸로 착각할 수 있다).
 *  - 어깨~발목이 화면에서 거의 가로
 *  - 어깨가 팔꿈치 위에 있어 팔로 몸을 받치고 있음 (바닥에 그냥 누운 것과 구분)
 *  - 어깨-엉덩이-발목이 일직선
 * 이 상태가 잠깐 유지된 뒤부터 센다.
 */
function createPlankCounter(): RepCounter {
  let heldMs = 0
  let lastT: number | null = null
  let validSince: number | null = null
  let lastFixAt = -Infinity
  let needsGood = true
  /** 같은 안내가 계속 쌓이지 않게 하는 간격 */
  const FIX_EVERY_MS = 4000
  /** 프레임이 이보다 오래 끊기면 그 사이 시간은 세지 않는다 */
  const MAX_GAP_MS = 300

  const stopHold = () => {
    heldMs = 0
    lastT = null
    validSince = null
  }

  const update = ({ world, image, aspect, t }: PoseInput, emit: (e: CounterEvent) => void) => {
    const s = betterSide(image)
    if (!isVisible(image, PLANK_JOINTS[s], R.minVisibility)) {
      stopHold()
      return false
    }
    const sh = image[LM.shoulder[s]]
    const el = image[LM.elbow[s]]
    const an = image[LM.ankle[s]]
    // 몸이 화면 가로선과 이루는 각 (서 있으면 90도에 가깝다)
    const bodyTilt = toDeg(Math.atan2(Math.abs(an.y - sh.y), Math.abs(an.x - sh.x) * aspect))
    // 위팔이 세로에서 기운 각 (팔꿈치가 어깨 아래에 있으면 0에 가깝다)
    const armTilt = el.y > sh.y ? toDeg(Math.atan2(Math.abs(el.x - sh.x) * aspect, el.y - sh.y)) : 180
    if (bodyTilt > R.plank.maxBodyTilt || armTilt > R.plank.maxArmTilt) {
      stopHold()
      return true
    }
    const line = angleDeg(world[LM.shoulder[s]], world[LM.hip[s]], world[LM.ankle[s]])
    if (line < R.plank.lineMin) {
      stopHold()
      if (t - lastFixAt > FIX_EVERY_MS) {
        lastFixAt = t
        needsGood = true
        emit({ kind: 'fix', text: '엉덩이가 처지거나 들리지 않게 일직선을 유지해 주세요' })
      }
      return true
    }
    validSince ??= t
    const dt = lastT === null ? 0 : Math.min(t - lastT, MAX_GAP_MS)
    lastT = t
    if (t - validSince < R.plank.settleMs) return true
    heldMs += dt
    if (heldMs >= 1000) {
      const sec = Math.floor(heldMs / 1000)
      heldMs -= sec * 1000
      emit({ kind: 'seconds', seconds: sec })
      if (needsGood) {
        needsGood = false
        emit({ kind: 'good', text: '몸이 일직선으로 잘 유지되고 있어요' })
      }
    }
    return true
  }

  return { setupHint: '카메라 옆쪽에서 머리부터 발끝까지 보이게 엎드려 주세요', update, reset: stopHold }
}

/** 자동 판정을 지원하지 않는 운동이면 null */
export function createRepCounter(exerciseId: string): RepCounter | null {
  if (exerciseId === 'plank') return createPlankCounter()
  const spec = REP_SPECS[exerciseId]
  return spec ? createRepCycleCounter(spec) : null
}

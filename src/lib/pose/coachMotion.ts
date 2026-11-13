// AI 코치 시범 동작. Mixamo 동작 파일이 있는 운동은 그 애니메이션을 재생하고,
// 없는 운동(런지·하이니)은 시간에 따라 관절 좌표를 만들어 livePose와 같은 형식으로 쓴다 (시연용 임시).
// 매 프레임 불리므로 새 객체를 만들지 않는다 (AGENTS.md 성능 규칙). 코치 동작은 유효 횟수에 들어가지 않는다.
// 좌표: MediaPipe 월드 좌표와 같다. 미터, 엉덩이 가운데 기준, y 아래, z 카메라 반대쪽(앞 = -z), 사람의 왼쪽 = +x.
import { LM } from './landmarks'

const HIP_HALF = 0.1
const SHOULDER_HALF = 0.18
const TORSO = 0.5
const THIGH = 0.42
const SHIN = 0.42
const UPPER_ARM = 0.28
const FOREARM = 0.26

/** coach.glb 안의 Mixamo 동작 이름. 에어로빅 점핑잭은 점핑잭 동작을 같이 쓴다 */
const COACH_CLIPS: Record<string, string> = {
  squat: 'squat',
  hip_hinge: 'hip_hinge',
  plank: 'plank',
  jumping_jack: 'jumping_jack',
  aerobic_jumping_jack: 'jumping_jack',
}
/** Mixamo 동작이 있으면 그 이름, 없으면 undefined (코드로 만든 임시 동작을 쓴다) */
export const coachClipOf = (exerciseId: string): string | undefined => COACH_CLIPS[exerciseId]

/** 한 번 반복하는 데 걸리는 시간(초) */
const PERIOD: Record<string, number> = {
  squat: 2.4,
  lunge: 2.6,
  hip_hinge: 2.6,
  plank: 4,
  jumping_jack: 1,
  aerobic_jumping_jack: 1.1,
  high_knees: 0.9,
}

/** 코치를 바라보는 각도 (0 = 정면). 숙이거나 다리를 앞뒤로 벌리는 동작은 옆에서 봐야 잘 보인다 */
const VIEW_YAW: Record<string, number> = { plank: Math.PI / 2, hip_hinge: Math.PI / 2, lunge: 1.1 }
export const coachYaw = (exerciseId: string) => VIEW_YAW[exerciseId] ?? 0.5

/** 엎드린 자세는 발을 바닥에 평평하게 두지 않고 발끝으로 짚게 한다 */
export const isCoachFeetFlat = (exerciseId: string) => exerciseId !== 'plank'

/** 0 → 1 → 0 으로 부드럽게 오가는 값 */
const wave = (t: number, period: number) => (1 - Math.cos((2 * Math.PI * t) / period)) / 2

/** 점핑잭은 발을 바닥에 붙이는 뼈대 계산 밖에서 몸 전체를 띄운다 */
export function coachBounce(exerciseId: string, t: number) {
  if (exerciseId !== 'jumping_jack' && exerciseId !== 'aerobic_jumping_jack') return 0
  return Math.abs(Math.sin((Math.PI * t) / (PERIOD[exerciseId] / 2))) * 0.12
}

function setJoint(out: Float32Array, i: number, x: number, y: number, z: number) {
  out[i * 4] = x
  out[i * 4 + 1] = y
  out[i * 4 + 2] = z
  out[i * 4 + 3] = 1
}

/**
 * 팔다리 한 마디. from 관절에서 길이 len만큼 뻗는다.
 * forward: 아래 방향에서 앞으로 든 각도(뒤는 음수), open: 몸 바깥쪽으로 벌린 각도. side: 왼쪽 +1, 오른쪽 -1
 */
function limb(out: Float32Array, from: number, to: number, len: number, forward: number, open: number, side: number) {
  const o = from * 4
  const c = Math.cos(open)
  setJoint(out, to, out[o] + side * Math.sin(open) * len, out[o + 1] + Math.cos(forward) * c * len, out[o + 2] - Math.sin(forward) * c * len)
}

interface Body {
  lean: number
  thigh: number
  shin: number
  legOpen: number
  arm: number
  forearm: number
  armOpen: number
}

// 왼쪽·오른쪽 값을 따로 받는 칸. 매 프레임 재사용한다
const left: Body = { lean: 0, thigh: 0, shin: 0, legOpen: 0, arm: 0, forearm: 0, armOpen: 0 }
const right: Body = { ...left }

function setBoth(lean: number, thigh: number, shin: number, legOpen: number, arm: number, forearm: number, armOpen: number) {
  left.lean = right.lean = lean
  left.thigh = right.thigh = thigh
  left.shin = right.shin = shin
  left.legOpen = right.legOpen = legOpen
  left.arm = right.arm = arm
  left.forearm = right.forearm = forearm
  left.armOpen = right.armOpen = armOpen
}

/** exerciseId 운동의 t초 시점 자세를 out([x, y, z, visibility] × 33)에 쓴다. 모르는 운동은 스쿼트로 보여준다 */
export function writeCoachPose(exerciseId: string, t: number, out: Float32Array) {
  const id = exerciseId in PERIOD ? exerciseId : 'squat'
  const s = wave(t, PERIOD[id])

  switch (id) {
    case 'lunge':
      // 왼발이 앞, 오른발이 뒤. 앞 무릎 90도, 뒷무릎은 바닥 쪽으로
      setBoth(0.1 * s, 0, 0, 0.08, 0.1, 0.1, 0.12)
      left.thigh = 1.35 * s
      left.shin = -0.1 * s
      right.thigh = -0.35 * s
      right.shin = -1.5 * s
      break
    case 'hip_hinge':
      // 허리를 편 채 상체를 숙이고, 팔은 바닥 쪽으로 늘어뜨린다
      setBoth(1.2 * s, 0.25 * s, -0.05 * s, 0.1, 0.15 * s, 0.15 * s, 0.05)
      break
    case 'plank':
      // 팔을 편 하이 플랭크로 자세 유지. 머리가 큰 캐릭터라 상체를 조금 세워야 웅크린 것처럼 보이지 않는다.
      // 숨 쉬듯 아주 조금만 움직인다
      setBoth(Math.PI / 2 - 0.2 - 0.04 * s, -(Math.PI / 2 - 0.12), -(Math.PI / 2 - 0.12), 0.06, 0, 0, 0.1)
      break
    case 'jumping_jack':
      setBoth(0, 0, 0, 0.05 + 0.3 * s, 0, 0, 0.25 + 2.6 * s)
      break
    case 'aerobic_jumping_jack':
      setBoth(0, 0.25, -0.2, 0.08 + 0.25 * s, 0, 0, 0.25 + 2.6 * s)
      break
    case 'high_knees': {
      const phase = Math.sin((2 * Math.PI * t) / PERIOD[id])
      const leftUp = Math.max(0, phase)
      const rightUp = Math.max(0, -phase)
      setBoth(0, 0, 0, 0.08, 0, 0, 0.12)
      left.thigh = 1.5 * leftUp
      right.thigh = 1.5 * rightUp
      // 팔은 반대쪽 다리와 함께 앞으로 흔든다
      left.arm = 0.9 * rightUp - 0.3 * leftUp
      right.arm = 0.9 * leftUp - 0.3 * rightUp
      left.forearm = left.arm + 1.2
      right.forearm = right.arm + 1.2
      break
    }
    default:
      // 스쿼트: 엉덩이를 뒤로 빼며 앉고, 균형을 잡으려 팔을 앞으로 든다
      setBoth(0.6 * s, 1.35 * s, -0.5 * s, 0.12, 1.45 * s, 1.45 * s, 0.05)
  }

  // 몸통
  const lean = left.lean
  setJoint(out, LM.hip[0], HIP_HALF, 0, 0)
  setJoint(out, LM.hip[1], -HIP_HALF, 0, 0)
  const sy = -Math.cos(lean) * TORSO
  const sz = -Math.sin(lean) * TORSO
  setJoint(out, LM.shoulder[0], SHOULDER_HALF, sy, sz)
  setJoint(out, LM.shoulder[1], -SHOULDER_HALF, sy, sz)
  // 코는 쓰지 않지만 빈 값이 남지 않게 어깨 위에 둔다
  setJoint(out, LM.nose, 0, sy - 0.2, sz)

  // 팔다리 (0 = 왼쪽, 1 = 오른쪽)
  for (let k = 0; k < 2; k++) {
    const b = k === 0 ? left : right
    const side = k === 0 ? 1 : -1
    limb(out, LM.hip[k], LM.knee[k], THIGH, b.thigh, b.legOpen, side)
    limb(out, LM.knee[k], LM.ankle[k], SHIN, b.shin, b.legOpen, side)
    limb(out, LM.shoulder[k], LM.elbow[k], UPPER_ARM, b.arm, b.armOpen, side)
    limb(out, LM.elbow[k], LM.wrist[k], FOREARM, b.forearm, b.armOpen, side)
  }
}

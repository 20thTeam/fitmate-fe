// Mixamo 뼈대를 다루는 도우미. three로 불러오면 뼈 이름의 ':'가 빠진다 (mixamorig:LeftArm → mixamorigLeftArm).
import { Quaternion, Vector3, type Object3D } from 'three'
import { LM } from '../../lib/pose/landmarks'

export const BONE = {
  spine: 'mixamorigSpine',
  neck: 'mixamorigNeck',
  leftArm: 'mixamorigLeftArm',
  leftForeArm: 'mixamorigLeftForeArm',
  leftHand: 'mixamorigLeftHand',
  rightArm: 'mixamorigRightArm',
  rightForeArm: 'mixamorigRightForeArm',
  rightHand: 'mixamorigRightHand',
  leftUpLeg: 'mixamorigLeftUpLeg',
  leftLeg: 'mixamorigLeftLeg',
  leftFoot: 'mixamorigLeftFoot',
  rightUpLeg: 'mixamorigRightUpLeg',
  rightLeg: 'mixamorigRightLeg',
  rightFoot: 'mixamorigRightFoot',
  leftToeEnd: 'mixamorigLeftToe_End',
  rightToeEnd: 'mixamorigRightToe_End',
} as const

const from = new Vector3()
const to = new Vector3()
const delta = new Quaternion()
const boneWorld = new Quaternion()
const parentWorld = new Quaternion()

/** bone → child 방향이 월드 기준 dir을 향하도록 bone을 돌린다. 부모 뼈를 먼저 돌려야 한다. */
export function aimBone(bone: Object3D, child: Object3D, dir: Vector3) {
  if (!bone.parent) return
  child.getWorldPosition(from).sub(bone.getWorldPosition(to)).normalize()
  delta.setFromUnitVectors(from, to.copy(dir).normalize())
  bone.getWorldQuaternion(boneWorld)
  bone.parent.getWorldQuaternion(parentWorld)
  // 새 월드 회전 = delta × 지금 월드 회전, 이를 부모 기준(로컬)으로 바꾼다
  bone.quaternion.copy(parentWorld.invert().multiply(delta).multiply(boneWorld))
  bone.updateMatrixWorld(true)
}

/** T자세로 벌린 팔을 몸 옆으로 내린다. 캐릭터는 +z를 바라보고, 왼쪽은 +x다. */
export function relaxArms(root: Object3D) {
  root.updateMatrixWorld(true)
  const pairs = [
    [BONE.leftArm, BONE.leftForeArm, new Vector3(0.32, -1, 0.06)],
    [BONE.rightArm, BONE.rightForeArm, new Vector3(-0.32, -1, 0.06)],
  ] as const
  for (const [boneName, childName, dir] of pairs) {
    const bone = root.getObjectByName(boneName)
    const child = root.getObjectByName(childName)
    if (bone && child) aimBone(bone, child, dir)
  }
}

/**
 * 관절 좌표로 움직일 뼈. 부모 → 자식 순서여야 한다.
 * 카메라 미리보기가 거울처럼 뒤집혀 있어서 캐릭터도 거울처럼 움직인다:
 * 사람의 오른쪽 관절로 캐릭터의 왼쪽(화면 오른쪽) 뼈를 움직인다.
 */
const SEGMENTS: readonly { bone: string; child: string; from: readonly number[]; to: readonly number[] }[] = [
  { bone: BONE.spine, child: BONE.neck, from: LM.hip, to: LM.shoulder },
  { bone: BONE.leftArm, child: BONE.leftForeArm, from: [LM.shoulder[1]], to: [LM.elbow[1]] },
  { bone: BONE.leftForeArm, child: BONE.leftHand, from: [LM.elbow[1]], to: [LM.wrist[1]] },
  { bone: BONE.rightArm, child: BONE.rightForeArm, from: [LM.shoulder[0]], to: [LM.elbow[0]] },
  { bone: BONE.rightForeArm, child: BONE.rightHand, from: [LM.elbow[0]], to: [LM.wrist[0]] },
  { bone: BONE.leftUpLeg, child: BONE.leftLeg, from: [LM.hip[1]], to: [LM.knee[1]] },
  { bone: BONE.leftLeg, child: BONE.leftFoot, from: [LM.knee[1]], to: [LM.ankle[1]] },
  { bone: BONE.rightUpLeg, child: BONE.rightLeg, from: [LM.hip[0]], to: [LM.knee[0]] },
  { bone: BONE.rightLeg, child: BONE.rightFoot, from: [LM.knee[0]], to: [LM.ankle[0]] },
]

/** 관절이 이보다 덜 보이면 그 부위는 기본 자세로 둔다 */
const MIN_VISIBILITY = 0.5
/** 떨림을 줄이는 정도. 0이면 그대로, 1에 가까울수록 느리게 따라간다 */
const SMOOTHING = 0.45

const footPos = new Vector3()
const basePos = new Vector3()

export interface PoseRig {
  /** world: livePose.world 형식 ([x, y, z, visibility] × 33). 매 프레임 불러도 새 객체를 만들지 않는다 */
  apply: (world: Float32Array) => void
  /** 팔을 내린 기본 자세로 돌린다 */
  relax: () => void
}

/** 모델 하나에 관절 좌표를 입히는 도구. 준비할 때 한 번 만든다 (뼈를 찾고 기본 자세를 기억한다). */
export function createPoseRig(model: Object3D): PoseRig | null {
  const parts = SEGMENTS.map((s) => {
    const bone = model.getObjectByName(s.bone)
    const child = model.getObjectByName(s.child)
    return bone && child ? { ...s, bone, child, rest: bone.quaternion.clone(), dir: new Vector3(), hasDir: false } : null
  })
  if (parts.some((p) => !p)) return null
  const segs = parts.filter((p) => p !== null)
  const toes = [BONE.leftToeEnd, BONE.rightToeEnd, BONE.leftFoot, BONE.rightFoot]
    .map((n) => model.getObjectByName(n))
    .filter((o) => o !== undefined)
  const baseY = model.position.y
  // 기본 자세에서 발끝이 모델 부모 기준으로 어디 있는지 (자세가 바뀌어도 발을 바닥에 붙이는 기준)
  const lowestFoot = () => {
    let min = Infinity
    for (const t of toes) min = Math.min(min, t.getWorldPosition(footPos).y)
    return min - (model.parent ? model.parent.getWorldPosition(basePos).y : 0)
  }
  model.updateMatrixWorld(true)
  const restFoot = lowestFoot()
  const target = new Vector3()

  const relax = () => {
    for (const s of segs) {
      s.bone.quaternion.copy(s.rest)
      s.hasDir = false
    }
    model.position.y = baseY
  }

  const apply = (w: Float32Array) => {
    for (const s of segs) {
      // 시작·끝 관절(여러 개면 가운데)이 다 보여야 움직인다
      let isSeen = true
      let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0
      for (const i of s.from) {
        if (w[i * 4 + 3] < MIN_VISIBILITY) isSeen = false
        fx += w[i * 4]; fy += w[i * 4 + 1]; fz += w[i * 4 + 2]
      }
      for (const i of s.to) {
        if (w[i * 4 + 3] < MIN_VISIBILITY) isSeen = false
        tx += w[i * 4]; ty += w[i * 4 + 1]; tz += w[i * 4 + 2]
      }
      s.bone.quaternion.copy(s.rest)
      s.bone.updateMatrixWorld(true)
      if (!isSeen) {
        s.hasDir = false
        continue
      }
      const nf = s.from.length
      const nt = s.to.length
      // MediaPipe(x 오른쪽, y 아래, z 카메라 반대쪽) → 화면 속 캐릭터(거울): x 반전, y 반전, z 반전
      target.set(-(tx / nt - fx / nf), -(ty / nt - fy / nf), -(tz / nt - fz / nf))
      if (target.lengthSq() < 1e-8) continue
      target.normalize()
      if (s.hasDir) s.dir.lerp(target, 1 - SMOOTHING).normalize()
      else s.dir.copy(target)
      s.hasDir = true
      aimBone(s.bone, s.child, s.dir)
    }
    // 다리를 굽히면 발이 떠서, 발끝이 기본 자세 높이에 오도록 몸을 내린다
    model.position.y += restFoot - lowestFoot()
  }

  return { apply, relax }
}

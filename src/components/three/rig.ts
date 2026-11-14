// Mixamo 뼈대를 다루는 도우미. three로 불러오면 뼈 이름의 ':'가 빠진다 (mixamorig:LeftArm → mixamorigLeftArm).
import { Quaternion, Vector3, type Object3D } from 'three'
import { LM } from '../../lib/pose/landmarks'

export const BONE = {
  hips: 'mixamorigHips',
  spine: 'mixamorigSpine',
  neck: 'mixamorigNeck',
  head: 'mixamorigHead',
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
 * 앞뒤 깊이를 얼마나 믿을지. 카메라 한 대로 잰 깊이는 위아래·좌우보다 흔들리지만,
 * 허리 숙이기·스쿼트에서 무릎이 앞으로 나가는 건 거의 깊이 방향이라 몸통·다리는 그대로 쓴다
 * (횟수 판정의 각도도 같은 값을 쓴다). 흔들림은 아래 '작은 흔들림 무시'로 거른다.
 * 팔은 앞으로 뻗는 동작보다 흔들림이 더 거슬려서 조금 줄인다.
 */
const ARM_DEPTH = 0.6
const LEG_DEPTH = 1
const TORSO_DEPTH = 1

/** 떨림을 줄이는 정도. 0이면 그대로, 1에 가까울수록 느리게 따라간다 */
const ARM_SMOOTHING = 0.45
/**
 * 다리 따라가는 속도. 0.7로 두면 에어로빅처럼 작고 빠른 다리 동작(옆으로 벌리기)이 42%만 남아서 낮췄다.
 * 0.4 + 아래 1~5° 기준이면 82%가 남고, 서 있을 때 떨림은 화면에서 1픽셀 아래다 (#91)
 */
const LEG_SMOOTHING = 0.4
const TORSO_SMOOTHING = 0.5
/** 몸 방향(옆으로 돈 각도)은 엉덩이·어깨 깊이 차이로 재서 흔들림이 커, 가장 느리게 따라간다 */
const YAW_SMOOTHING = 0.8
/** 뒤돌면 왼쪽·오른쪽을 헷갈려서 이 각도까지만 돈다 */
const MAX_YAW = (100 * Math.PI) / 180
/**
 * 무릎이 STRAIGHT_ON(도)보다 펴지면 곧은 다리로 보고 엉덩이 → 발목 한 방향으로 세운다 (무릎 떨림 방지).
 * 한번 곧은 다리가 되면 STRAIGHT_OFF보다 굽혀야 풀린다. 숙이면 다리가 가려져 무릎 각도가 출렁여서 여유를 둔다.
 */
const STRAIGHT_ON_DEG = 165
const STRAIGHT_OFF_DEG = 155
/**
 * 작은 흔들림은 무시하고 큰 움직임만 빨리 따라간다. 목표와 지금 방향 차이가 STILL_DEG 이하면 거의 안 움직이고,
 * MOVE_DEG 이상이면 부위별 기본 속도로 따라간다. 그 사이는 차이에 비례한다.
 */
const STILL_DEG = 4
const MOVE_DEG = 16
/** 다리는 옆으로 벌리기·무릎 들기가 10~30°라 팔보다 좁게 잡는다. 넓으면 이 동작들이 '흔들림'으로 지워진다 (#91) */
const LEG_STILL_DEG = 1
const LEG_MOVE_DEG = 5
const STILL_FOLLOW = 0.03
/** 몸 방향이 이 각도보다 작으면 정면으로 본다. 정면에 서 있을 때 몸이 좌우로 비틀거리지 않게 한다 */
const YAW_DEADZONE_DEG = 12
const YAW_FULL_DEG = 24

/** 처음 잡을 때는 이만큼 보여야 하고, 이미 잡은 관절은 이보다 낮아질 때까지 놓지 않는다 (경계에서 깜빡임 방지) */
const SEEN_VISIBILITY = 0.5
const KEEP_VISIBILITY = 0.3
/** 관절을 잠깐 놓쳐도 이 시간 동안은 마지막 방향을 유지한다 (툭툭 끊김 방지) */
const HOLD_MS = 300

interface Segment {
  bone: string
  child: string
  from: readonly number[]
  to: readonly number[]
  depth: number
  smoothing: number
  /** 기운 정도 중 이 뼈가 맡는 몫 (1 = 전부). 허리는 골반이 반, 등이 나머지를 굽힌다 */
  share: number
  /** 다리면 [엉덩이, 무릎, 발목] 관절 번호. 곧은 다리 판정과, 안 보일 때 곧게 세우는 데 쓴다 */
  leg?: readonly [number, number, number]
}

const leftLeg = [LM.hip[1], LM.knee[1], LM.ankle[1]] as const
const rightLeg = [LM.hip[0], LM.knee[0], LM.ankle[0]] as const

/**
 * 관절 좌표로 움직일 뼈. 부모 → 자식 순서여야 한다.
 * 카메라 미리보기가 거울처럼 뒤집혀 있어서 캐릭터도 거울처럼 움직인다:
 * 사람의 오른쪽 관절로 캐릭터의 왼쪽(화면 오른쪽) 뼈를 움직인다.
 */
const SEGMENTS: readonly Segment[] = [
  { bone: BONE.hips, child: BONE.neck, from: LM.hip, to: LM.shoulder, depth: TORSO_DEPTH, smoothing: TORSO_SMOOTHING, share: 0.5 },
  { bone: BONE.spine, child: BONE.neck, from: LM.hip, to: LM.shoulder, depth: TORSO_DEPTH, smoothing: TORSO_SMOOTHING, share: 1 },
  { bone: BONE.leftArm, child: BONE.leftForeArm, from: [LM.shoulder[1]], to: [LM.elbow[1]], depth: ARM_DEPTH, smoothing: ARM_SMOOTHING, share: 1 },
  { bone: BONE.leftForeArm, child: BONE.leftHand, from: [LM.elbow[1]], to: [LM.wrist[1]], depth: ARM_DEPTH, smoothing: ARM_SMOOTHING, share: 1 },
  { bone: BONE.rightArm, child: BONE.rightForeArm, from: [LM.shoulder[0]], to: [LM.elbow[0]], depth: ARM_DEPTH, smoothing: ARM_SMOOTHING, share: 1 },
  { bone: BONE.rightForeArm, child: BONE.rightHand, from: [LM.elbow[0]], to: [LM.wrist[0]], depth: ARM_DEPTH, smoothing: ARM_SMOOTHING, share: 1 },
  { bone: BONE.leftUpLeg, child: BONE.leftLeg, from: [LM.hip[1]], to: [LM.knee[1]], depth: LEG_DEPTH, smoothing: LEG_SMOOTHING, share: 1, leg: leftLeg },
  { bone: BONE.leftLeg, child: BONE.leftFoot, from: [LM.knee[1]], to: [LM.ankle[1]], depth: LEG_DEPTH, smoothing: LEG_SMOOTHING, share: 1, leg: leftLeg },
  { bone: BONE.rightUpLeg, child: BONE.rightLeg, from: [LM.hip[0]], to: [LM.knee[0]], depth: LEG_DEPTH, smoothing: LEG_SMOOTHING, share: 1, leg: rightLeg },
  { bone: BONE.rightLeg, child: BONE.rightFoot, from: [LM.knee[0]], to: [LM.ankle[0]], depth: LEG_DEPTH, smoothing: LEG_SMOOTHING, share: 1, leg: rightLeg },
]

const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)
const footPos = new Vector3()
const basePos = new Vector3()

/** 무릎 각도 (도). b를 꼭짓점으로 한 a-b-c */
const toRad = (deg: number) => (deg * Math.PI) / 180
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function kneeDeg(w: Float32Array, a: number, b: number, c: number) {
  const abx = w[a * 4] - w[b * 4], aby = w[a * 4 + 1] - w[b * 4 + 1], abz = w[a * 4 + 2] - w[b * 4 + 2]
  const cbx = w[c * 4] - w[b * 4], cby = w[c * 4 + 1] - w[b * 4 + 1], cbz = w[c * 4 + 2] - w[b * 4 + 2]
  const len = Math.hypot(abx, aby, abz) * Math.hypot(cbx, cby, cbz)
  if (len === 0) return 180
  return (Math.acos(Math.max(-1, Math.min(1, (abx * cbx + aby * cby + abz * cbz) / len))) * 180) / Math.PI
}

export interface PoseRig {
  /**
   * world: livePose.world 형식 ([x, y, z, visibility] × 33), now: performance.now(). 매 프레임 불러도 새 객체를 만들지 않는다.
   * isFeetFlat: 발을 바닥에 평평하게 둔다. 엎드린 자세(플랭크)는 끄면 발끝이 바닥을 짚는다
   */
  apply: (world: Float32Array, now: number, isFeetFlat?: boolean) => void
  /** 팔을 내린 기본 자세로 돌린다 */
  relax: () => void
}

/**
 * 모델 하나에 관절 좌표를 입히는 도구. 준비할 때 한 번 만든다 (뼈를 찾고 기본 자세를 기억한다).
 * isSmoothed: 카메라 좌표의 떨림을 거른다. 코드로 만든 매끄러운 좌표(AI 코치 시범)는 끄면 늦지 않고 그대로 따라간다
 */
export function createPoseRig(model: Object3D, { isSmoothed = true }: { isSmoothed?: boolean } = {}): PoseRig | null {
  const parts = SEGMENTS.map((s) => {
    const bone = model.getObjectByName(s.bone)
    const child = model.getObjectByName(s.child)
    if (!bone || !child) return null
    // 곧은 다리일 때 쓸 엉덩이 → 발목 관절 (매 프레임 배열을 만들지 않게 미리 만든다)
    const straightFrom = s.leg ? [s.leg[0]] : s.from
    const straightTo = s.leg ? [s.leg[2]] : s.to
    return { ...s, bone, child, straightFrom, straightTo, rest: bone.quaternion.clone(), dir: new Vector3(), hasDir: false, seenAt: 0 }
  })
  if (parts.some((p) => !p)) return null
  const segs = parts.filter((p) => p !== null)
  const toes = [BONE.leftToeEnd, BONE.rightToeEnd, BONE.leftFoot, BONE.rightFoot]
    .map((n) => model.getObjectByName(n))
    .filter((o) => o !== undefined)
  const baseY = model.position.y
  // 기본 자세에서 발끝이 모델 부모 기준으로 어디 있는지 (자세가 바뀌어도 발을 바닥에 붙이는 기준)
  // 발은 바닥에 평평하게 둔다. 정강이를 따라 기울면 스쿼트에서 발끝이 바닥을 파고들거나 뒤꿈치가 뜬다.
  // 기본 자세에서 발이 모델 기준으로 어떻게 놓였는지 기억해 두고 매 프레임 그 방향으로 되돌린다
  model.updateMatrixWorld(true)
  const modelWorld = new Quaternion()
  const feet = [BONE.leftFoot, BONE.rightFoot]
    .map((n) => model.getObjectByName(n))
    .filter((o) => o !== undefined)
    .map((foot) => ({ foot, flat: model.getWorldQuaternion(modelWorld).clone().invert().multiply(foot.getWorldQuaternion(new Quaternion())) }))
  const footWant = new Quaternion()
  const footParent = new Quaternion()
  const keepFeetFlat = () => {
    model.getWorldQuaternion(modelWorld)
    for (const { foot, flat } of feet) {
      if (!foot.parent) continue
      footWant.copy(modelWorld).multiply(flat)
      foot.parent.getWorldQuaternion(footParent)
      foot.quaternion.copy(footParent.invert().multiply(footWant))
      foot.updateMatrixWorld(true)
    }
  }
  // 두 발목 가운데를 바닥 위 같은 자리에 둔다. 스쿼트에서 발이 앞으로 미끄러지지 않고 엉덩이가 뒤로 빠진다
  const footMid = new Vector3()
  const parentPos = new Vector3()
  const feetCenter = (out: Vector3) => {
    out.set(0, 0, 0)
    for (const { foot } of feet) out.add(foot.getWorldPosition(footPos))
    out.divideScalar(Math.max(feet.length, 1))
    if (model.parent) out.sub(model.parent.getWorldPosition(parentPos))
    return out
  }
  const lowestFoot = () => {
    let min = Infinity
    for (const t of toes) min = Math.min(min, t.getWorldPosition(footPos).y)
    return min - (model.parent ? model.parent.getWorldPosition(basePos).y : 0)
  }
  model.updateMatrixWorld(true)
  const restFoot = lowestFoot()
  const restFeetCenter = feetCenter(new Vector3())
  const baseX = model.position.x
  const baseZ = model.position.z
  const target = new Vector3()
  const aim = new Vector3()
  let yaw = 0
  let hasYaw = false
  // 다리별로 곧은 다리인지 기억한다 (허벅지·종아리가 같은 판정을 쓴다)
  const straight = new Map<readonly number[], boolean>([[leftLeg, true], [rightLeg, true]])
  const isStraightLeg = (w: Float32Array, leg: readonly [number, number, number]) => {
    const deg = kneeDeg(w, leg[0], leg[1], leg[2])
    const was = straight.get(leg) ?? true
    const now = was ? deg > STRAIGHT_OFF_DEG : deg > STRAIGHT_ON_DEG
    straight.set(leg, now)
    return now
  }

  // share가 1보다 작으면 똑바로 선 방향(위)과 목표 방향 사이까지만 돌린다
  const aimShare = (s: (typeof segs)[number]) => {
    if (s.share >= 1) aimBone(s.bone, s.child, s.dir)
    else aimBone(s.bone, s.child, aim.copy(UP).lerp(s.dir, s.share).normalize())
  }

  const isVisible = (w: Float32Array, i: number, wasSeen: boolean) => w[i * 4 + 3] >= (wasSeen ? KEEP_VISIBILITY : SEEN_VISIBILITY)

  /**
   * 옆으로 돈 각도. 엉덩이·어깨의 오른쪽 → 왼쪽 선이 화면 가로선에서 얼마나 돌았는지 본다.
   * 좌표를 캐릭터 쪽(거울)으로 바꾼 뒤 재서 팔다리와 같은 쪽으로 돈다.
   */
  const updateYaw = (w: Float32Array) => {
    const [ls, rs] = LM.shoulder
    const [lh, rh] = LM.hip
    if (!isVisible(w, ls, hasYaw) || !isVisible(w, rs, hasYaw) || !isVisible(w, lh, hasYaw) || !isVisible(w, rh, hasYaw)) return
    const vx = -(w[rs * 4] - w[ls * 4] + w[rh * 4] - w[lh * 4])
    const vz = -(w[rs * 4 + 2] - w[ls * 4 + 2] + w[rh * 4 + 2] - w[lh * 4 + 2]) * TORSO_DEPTH
    if (vx * vx + vz * vz < 1e-6) return
    const raw = Math.max(-MAX_YAW, Math.min(MAX_YAW, Math.atan2(-vz, vx)))
    // 정면 근처의 작은 각도는 0으로 눌러서, 서 있기만 해도 몸이 돌았다 왔다 하지 않게 한다
    const next = raw * smoothstep(toRad(YAW_DEADZONE_DEG), toRad(YAW_FULL_DEG), Math.abs(raw))
    yaw = hasYaw ? yaw + (next - yaw) * (1 - YAW_SMOOTHING) : next
    hasYaw = true
  }

  const footRest = feet.map(({ foot }) => foot.quaternion.clone())
  const relax = () => {
    feet.forEach(({ foot }, i) => foot.quaternion.copy(footRest[i]))
    for (const s of segs) {
      s.bone.quaternion.copy(s.rest)
      s.hasDir = false
    }
    hasYaw = false
    yaw = 0
    model.rotation.y = 0
    model.position.set(baseX, baseY, baseZ)
  }

  const apply = (w: Float32Array, now: number, isFeetFlat = true) => {
    // 몸 방향을 먼저 돌려 두면 팔다리는 월드 방향으로 맞추니 같이 따라온다
    updateYaw(w)
    model.rotation.y = yaw
    // 모든 뼈를 먼저 기본 자세로 돌려 놓고 시작한다. 골반은 목까지의 방향으로 맞추는데,
    // 등뼈가 지난 프레임 자세로 남아 있으면 그 값이 다시 골반에 들어가 골반·다리가 계속 출렁인다
    for (const s of segs) s.bone.quaternion.copy(s.rest)
    model.updateMatrixWorld(true)
    for (const s of segs) {
      // 시작·끝 관절(여러 개면 가운데)이 다 보여야 움직인다
      let isSeen = true
      for (const i of s.from) if (!isVisible(w, i, s.hasDir)) isSeen = false
      for (const i of s.to) if (!isVisible(w, i, s.hasDir)) isSeen = false
      if (!isSeen) {
        // 잠깐 가려진 거면 마지막 방향을 유지하고, 오래 안 보이면 기본 자세로 둔다
        if (s.hasDir && now - s.seenAt < HOLD_MS) aimShare(s)
        else {
          s.hasDir = false
          // 골반이 기울어도 화면 밖 다리는 바닥 쪽으로 곧게 둔다
          if (s.leg) aimBone(s.bone, s.child, DOWN)
        }
        continue
      }
      let from = s.from
      let to = s.to
      // 곧은 다리면 허벅지·종아리 모두 엉덩이 → 발목 방향으로 맞춰 무릎이 혼자 떨리지 않게 한다
      if (s.leg && isVisible(w, s.leg[2], s.hasDir) && isStraightLeg(w, s.leg)) {
        from = s.straightFrom
        to = s.straightTo
      }
      let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0
      for (const i of from) { fx += w[i * 4]; fy += w[i * 4 + 1]; fz += w[i * 4 + 2] }
      for (const i of to) { tx += w[i * 4]; ty += w[i * 4 + 1]; tz += w[i * 4 + 2] }
      const nf = from.length
      const nt = to.length
      // MediaPipe(x 오른쪽, y 아래, z 카메라 반대쪽) → 화면 속 캐릭터(거울): x 반전, y 반전, z 반전
      target.set(-(tx / nt - fx / nf), -(ty / nt - fy / nf), -(tz / nt - fz / nf) * s.depth)
      if (target.lengthSq() < 1e-8) continue
      target.normalize()
      if (s.hasDir && isSmoothed) {
        // 방향 차이가 작으면(가만히 있을 때의 흔들림) 거의 안 따라가고, 크면 빨리 따라간다
        const gap = s.dir.angleTo(target)
        const follow = STILL_FOLLOW + (1 - s.smoothing - STILL_FOLLOW) * (s.leg ? smoothstep(toRad(LEG_STILL_DEG), toRad(LEG_MOVE_DEG), gap) : smoothstep(toRad(STILL_DEG), toRad(MOVE_DEG), gap))
        s.dir.lerp(target, follow).normalize()
      }
      else s.dir.copy(target)
      s.hasDir = true
      s.seenAt = now
      aimShare(s)
    }
    if (isFeetFlat) keepFeetFlat()
    else feet.forEach(({ foot }, i) => foot.quaternion.copy(footRest[i]))
    // 다리를 굽히면 발이 떠서, 발끝이 기본 자세 높이에 오도록 몸을 내린다
    model.position.y += restFoot - lowestFoot()
    feetCenter(footMid)
    model.position.x += restFeetCenter.x - footMid.x
    model.position.z += restFeetCenter.z - footMid.z
  }

  return { apply, relax }
}

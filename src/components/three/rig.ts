// Mixamo 뼈대를 다루는 도우미. three로 불러오면 뼈 이름의 ':'가 빠진다 (mixamorig:LeftArm → mixamorigLeftArm).
// 관절 좌표(PoseFrame)로 동작을 맞출 때도 aimBone을 그대로 쓴다.
import { Quaternion, Vector3, type Object3D } from 'three'

export const BONE = {
  leftArm: 'mixamorigLeftArm',
  leftForeArm: 'mixamorigLeftForeArm',
  rightArm: 'mixamorigRightArm',
  rightForeArm: 'mixamorigRightForeArm',
} as const

const from = new Vector3()
const to = new Vector3()
const delta = new Quaternion()
const boneWorld = new Quaternion()
const parentWorld = new Quaternion()

/** bone → child 방향이 월드 기준 dir을 향하도록 bone을 돌린다. 호출 전에 root.updateMatrixWorld(true)가 필요하다. */
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

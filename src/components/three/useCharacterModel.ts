// 캐릭터 GLB를 불러와 무대에 세울 준비를 한다 (무대 위 참가자, AI 코치 시범이 같이 쓴다).
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Box3, type Material, type Mesh } from 'three'
import { BONE, createPoseRig, relaxArms } from './rig'
import { MODEL_H } from './layout'

/** 원본 모델의 머리 크기 대비 비율. 줄일수록 같은 키 안에서 몸이 커진다 */
const HEAD_SCALE = 0.78
/**
 * 다리(허벅지부터 발목까지)를 늘리는 비율 (#73). 모델 다리가 짧고 무릎 관절이 낮아서
 * 스쿼트를 해도 무릎 굽힘이 잘 안 보였다. 키는 그대로라 늘린 만큼 상체·머리가 조금 작아진다
 */
const LEG_SCALE = 1.6

/**
 * GLB를 참가자마다 복제해서 쓴다. 같은 캐릭터를 여러 명이 골라도 뼈대가 따로 움직여야 해서
 * 뼈대까지 복제하고, 흐리게 하는 값이 서로 번지지 않게 재질도 복제한다.
 */
export function useCharacterModel(url: string, { isSmoothed = true, headScale = HEAD_SCALE, legScale = LEG_SCALE }: { isSmoothed?: boolean; headScale?: number; legScale?: number } = {}) {
  const { scene } = useGLTF(url, false, false)
  const { model, materials, rig } = useMemo(() => {
    const root = cloneSkinned(scene)
    const cloned: Material[] = []
    root.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const own = (mesh.material as Material).clone()
      mesh.material = own
      cloned.push(own)
    })
    // 머리를 줄인 뒤 키를 맞추면, 같은 키 안에서 몸통·팔다리가 그만큼 커진다
    root.getObjectByName(BONE.head)?.scale.setScalar(headScale)
    // 무릎·발목 관절을 뼈 방향으로 더 멀리 옮겨 허벅지·정강이를 늘린다.
    // 뼈 크기(scale)를 키우면 다리가 길어지기보다 바지·다리가 뚱뚱해져서 위치만 옮긴다
    for (const name of [BONE.leftLeg, BONE.leftFoot, BONE.rightLeg, BONE.rightFoot]) {
      root.getObjectByName(name)?.position.multiplyScalar(legScale)
    }
    // 키는 T자세에서 재고(팔을 내려도 키는 같다), 발바닥을 바닥(y=0)에 맞춘다
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root)
    const scale = MODEL_H / Math.max(box.max.y - box.min.y, 0.001)
    relaxArms(root)
    root.scale.setScalar(scale)
    root.position.y = -box.min.y * scale
    // 팔을 내린 자세를 기본 자세로 기억한다
    return { model: root, materials: cloned, rig: createPoseRig(root, { isSmoothed }) }
  }, [scene, isSmoothed, headScale, legScale])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  return { model, rig }
}

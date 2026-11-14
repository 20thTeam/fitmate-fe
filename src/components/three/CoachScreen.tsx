// 무대 뒤 스크린 왼쪽 칸에 AI 코치가 운동 동작을 반복하는 모습을 그린다 (친구 운동방, 운동·휴식 중).
// 스크린 DOM 안에 캔버스를 또 넣으면 matrix3d 변환 때문에 크기가 틀어져서, 같은 3D 장면 안의 판에 따로 찍은 그림(RenderTexture)을 붙인다.
// 코치는 Mixamo 캐릭터다. 스쿼트·힙 힌지·플랭크·점핑잭은 Mixamo 동작을 재생하고,
// 런지·하이니는 코드로 만든 임시 동작을 같은 코치에 입힌다 (시연용 임시). 코치 동작은 유효 횟수에 들어가지 않는다.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, RenderTexture, useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { AnimationMixer, Box3, type Group } from 'three'
import coachModelUrl from '../../assets/coach/coach.glb?url'
import { coachBounce, coachClipOf, coachYaw, isCoachFeetFlat, writeCoachPose } from '../../lib/pose/coachMotion'
import { useCharacterModel } from './useCharacterModel'
import ThreeBoundary from './ThreeBoundary'
import { COACH_SCREEN_RATIO, MODEL_H, SCREEN_CENTER, SCREEN_H, SCREEN_W } from './layout'

const PANE_W = SCREEN_W * COACH_SCREEN_RATIO
const PANE_H = SCREEN_H
const TEXTURE_W = 640
const TEXTURE_H = Math.round((TEXTURE_W * PANE_H) / PANE_W)
/** 스크린 판 앞면(가운데 z + 0.145)보다 살짝 앞 */
const PANE_Z = SCREEN_CENTER[2] + 0.152
const POSE_LENGTH = 33 * 4
/** 코치를 찍는 카메라 거리·높이와 바라보는 높이 */
const CAMERA_DIST = 4.6
const CAMERA_Y = 1.1
const LOOK_Y = 1.0

/**
 * 운동마다 보기 좋은 각도로 카메라를 코치 둘레에 둔다.
 * 코치를 돌리면 뼈대의 발 위치 맞춤이 어긋나 코치가 밀려나서, 코치는 그대로 두고 카메라를 돌린다
 */
function CoachCamera({ exerciseId }: { exerciseId: string }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const yaw = coachYaw(exerciseId)
    camera.position.set(Math.sin(yaw) * CAMERA_DIST, CAMERA_Y, Math.cos(yaw) * CAMERA_DIST)
    camera.lookAt(0, LOOK_Y, 0)
  }, [camera, exerciseId])
  return null
}

/** Mixamo 동작을 그대로 반복 재생한다 */
function CoachClip({ clipName }: { clipName: string }) {
  // useCharacterModel과 같은 인자로 불러야 파일을 한 번만 받는다
  const { scene, animations } = useGLTF(coachModelUrl, false, false)
  const { model, mixer } = useMemo(() => {
    const root = cloneSkinned(scene)
    // T자세에서 키를 재서 무대 캐릭터와 같은 키로 맞추고 발바닥을 바닥(y=0)에 둔다
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root)
    const scale = MODEL_H / Math.max(box.max.y - box.min.y, 0.001)
    root.scale.setScalar(scale)
    root.position.y = -box.min.y * scale
    return { model: root, mixer: new AnimationMixer(root) }
  }, [scene])

  useEffect(() => {
    const clip = animations.find((a) => a.name === clipName)
    if (!clip) return
    const action = mixer.clipAction(clip).play()
    return () => {
      action.stop()
      mixer.uncacheClip(clip)
    }
  }, [mixer, animations, clipName])

  useFrame((_, delta) => mixer.update(delta))

  return <primitive object={model} />
}

/** Mixamo 동작이 없는 운동은 코드로 만든 관절 좌표를 뼈대에 입힌다 */
function CoachRigged({ exerciseId }: { exerciseId: string }) {
  // 사람 비율 모델이라 머리를 줄이거나 다리를 늘리지 않는다
  const { model, rig } = useCharacterModel(coachModelUrl, { isSmoothed: false, headScale: 1, legScale: 1 })
  const groupRef = useRef<Group>(null)
  // 매 프레임 고쳐 쓰는 관절 좌표 칸 (새 배열을 만들지 않는다)
  const pose = useMemo(() => new Float32Array(POSE_LENGTH), [])

  useEffect(() => () => rig?.relax(), [rig])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    writeCoachPose(exerciseId, t, pose)
    rig?.apply(pose, performance.now(), isCoachFeetFlat(exerciseId))
    // 뼈대 계산이 발을 바닥에 붙여서, 점프는 바깥 group을 띄워 보여준다
    if (groupRef.current) groupRef.current.position.y = coachBounce(exerciseId, t)
  })

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  )
}

interface Props {
  exerciseId: string
  background: string
}

export default function CoachScreen({ exerciseId, background }: Props) {
  const x = SCREEN_CENTER[0] - SCREEN_W / 2 + PANE_W / 2
  const clipName = coachClipOf(exerciseId)

  return (
    <mesh position={[x, SCREEN_CENTER[1], PANE_Z]}>
      <planeGeometry args={[PANE_W, PANE_H]} />
      <meshBasicMaterial toneMapped={false}>
        <RenderTexture attach="map" width={TEXTURE_W} height={TEXTURE_H}>
          <PerspectiveCamera makeDefault fov={30} />
          <CoachCamera exerciseId={exerciseId} />
          <color attach="background" args={[background]} />
          <hemisphereLight args={['#ffffff', '#d9c7d6', 2]} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} />
          {/* 모델을 못 받으면 빈 칸으로 둔다 (오른쪽 설명은 그대로 보인다) */}
          <ThreeBoundary fallback={null}>
            <Suspense fallback={null}>
              {clipName ? <CoachClip key={clipName} clipName={clipName} /> : <CoachRigged exerciseId={exerciseId} />}
            </Suspense>
          </ThreeBoundary>
        </RenderTexture>
      </meshBasicMaterial>
    </mesh>
  )
}

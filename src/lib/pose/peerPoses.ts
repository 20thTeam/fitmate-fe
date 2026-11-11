// 친구들의 최신 관절 좌표를 3D 캐릭터에 넘기는 공유 칸 (livePose의 친구 버전).
// 초당 10번 넘게 바뀌는 값이라 React 상태·zustand에 두지 않고, 친구마다 숫자 배열 하나를 고쳐 쓴다 (AGENTS.md 성능 규칙).
// useRoom이 받은 PoseFrame을 쓰고, 운동방 3D의 친구 캐릭터가 useFrame에서 읽는다.

const COUNT = 33
/**
 * 이 시간 넘게 새 좌표가 없으면 친구 캐릭터를 기본 자세로 돌린다.
 * 네트워크로 초당 12번쯤 오므로 내 카메라(400ms)보다 넉넉히 둔다. 그 사이엔 마지막 자세에 멈춰 있고 움직임을 지어내지 않는다.
 */
const STALE_MS = 1500

interface PeerPose {
  /** [x, y, z, visibility] × 33. livePose.world와 같은 형식 */
  world: Float32Array
  /** 마지막으로 받은 시각 (performance.now) */
  t: number
}

const poses = new Map<string, PeerPose>()

export function writePeerPose(userId: string, landmarks: ArrayLike<number>) {
  if (landmarks.length < COUNT * 4) return
  let pose = poses.get(userId)
  if (!pose) {
    pose = { world: new Float32Array(COUNT * 4), t: 0 }
    poses.set(userId, pose)
  }
  for (let i = 0; i < COUNT * 4; i++) pose.world[i] = landmarks[i]
  pose.t = performance.now()
}

/** 새 좌표가 있으면 그 배열을, 없거나 오래됐으면 null */
export function freshPeerPose(userId: string, now: number): Float32Array | null {
  const pose = poses.get(userId)
  return pose && now - pose.t < STALE_MS ? pose.world : null
}

/** 방을 나간 친구, 또는 운동방을 떠날 때 비운다 */
export function clearPeerPoses(keepUserIds?: ReadonlySet<string>) {
  for (const id of poses.keys()) if (!keepUserIds?.has(id)) poses.delete(id)
}

// 실시간 운동방 입장·참가자·응원 수신을 묶은 훅. 친구 파티와 선셋이 같이 쓴다.
// 내 관절 좌표(livePose)를 친구에게 보내고, 받은 친구 좌표는 peerPoses에 써서 3D 캐릭터가 읽게 한다.

import { useCallback, useEffect, useRef, useState } from 'react'
import { services, type ConnectionState, type JoinOptions, type RealtimeService, type RoomConnection } from '../services'
import { CHEER_COOLDOWN_MS, STALE_PEER_MS } from '../config/provisional'
import type { Participant, Profile } from '../types/domain'
import { hasFreshLivePose, livePose } from '../lib/pose/livePose'
import { clearPeerPoses, writePeerPose } from '../lib/pose/peerPoses'

export type RoomState = 'joining' | 'joined' | 'full' | 'network'

export const isStale = (p: Participant, now = Date.now()) => now - p.lastSeenAt > STALE_PEER_MS

const CHEER_TOAST_MS = 2500
/** 내 관절 좌표를 보내는 간격. 서버 중계 상한(초당 15개)보다 적게 보낸다 */
const POSE_SEND_MS = 1000 / 12

/** realtime: 친구 파티·선셋은 기본 연결, 학교 대항 챌린지는 판 전용 연결을 넘긴다 */
export function useRoom(roomId: string | null, me: Profile, options: JoinOptions, realtime: RealtimeService = services.realtime) {
  const [state, setState] = useState<RoomState>('joining')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [cheerToast, setCheerToast] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connected')
  const connectionRef = useRef<ConnectionState>('connected')
  const connRef = useRef<RoomConnection | null>(null)
  const participantsRef = useRef<Participant[]>([])
  const lastCheerAt = useRef(new Map<string, number>())
  const [retryKey, setRetryKey] = useState(0)

  // options는 입장 시점 값만 쓴다
  const optionsRef = useRef(options)

  useEffect(() => {
    if (!roomId) return
    // 언마운트 뒤 늦게 도착한 입장 결과를 버리기 위한 표시
    const life = { isAlive: true }
    let conn: RoomConnection | null = null
    let toastTimer: ReturnType<typeof setTimeout> | undefined
    let poseTimer: ReturnType<typeof setInterval> | undefined

    realtime
      .join(roomId, me, optionsRef.current)
      .then((res) => {
        if (!life.isAlive) {
          if (res.ok) res.conn.leave()
          return
        }
        if (!res.ok) return setState(res.reason)
        conn = res.conn
        connRef.current = conn
        conn.onParticipants((list) => {
          participantsRef.current = list
          setParticipants(list)
          // 나간 친구의 마지막 자세가 남지 않게 지운다
          clearPeerPoses(new Set(list.map((p) => p.userId)))
        })
        conn.onPose((f) => writePeerPose(f.userId, f.landmarks))
        conn.onConnection((s) => {
          connectionRef.current = s
          setConnection(s)
        })
        // 카메라에서 관절이 잡히는 동안만 보낸다. 잡히지 않으면 보내지 않고, 친구 화면은 마지막 자세에 멈춘다
        let lastSentT = 0
        poseTimer = setInterval(() => {
          if (!hasFreshLivePose(performance.now()) || livePose.t === lastSentT) return
          lastSentT = livePose.t
          conn?.publishPose({ t: Date.now(), landmarks: Array.from(livePose.world) })
        }, POSE_SEND_MS)
        conn.onCheer((e) => {
          const from = participantsRef.current.find((p) => p.userId === e.fromUserId)
          setCheerToast(`${from?.nickname ?? '친구'}님이 응원을 보냈어요 ${e.reaction}`)
          clearTimeout(toastTimer)
          toastTimer = setTimeout(() => setCheerToast(null), CHEER_TOAST_MS)
        })
        setState('joined')
      })
      .catch(() => life.isAlive && setState('network'))

    return () => {
      life.isAlive = false
      clearTimeout(toastTimer)
      clearInterval(poseTimer)
      conn?.leave()
      connRef.current = null
      clearPeerPoses()
      connectionRef.current = 'connected'
      setConnection('connected')
    }
  }, [roomId, me, retryKey, realtime])

  // 효과(useEffect) 안에서 불러도 매 렌더 다시 실행되지 않게 같은 함수를 돌려준다
  const updateSelf = useCallback((patch: Parameters<RoomConnection['updateSelf']>[0]) => connRef.current?.updateSelf(patch), [])

  /** 연타는 쿨다운으로 막는다 (F-HEIEZC 권장안). 보냈으면 true. */
  const sendCheer = (toUserId: string, reaction = '🔥') => {
    // 연결이 끊긴 동안에는 보내지 못하므로 '보냈어요'라고 하지 않는다
    if (connectionRef.current !== 'connected' && connectionRef.current !== 'slow') return false
    const now = Date.now()
    if (now - (lastCheerAt.current.get(toUserId) ?? 0) < CHEER_COOLDOWN_MS) return false
    lastCheerAt.current.set(toUserId, now)
    connRef.current?.sendCheer(toUserId, reaction)
    return true
  }

  return {
    state,
    /** 내 실시간 연결 상태. 입장 뒤 끊김·지연 표시에 쓴다 */
    connection,
    participants,
    cheerToast,
    sendCheer,
    updateSelf,
    retry: () => {
      setState('joining')
      setRetryKey((k) => k + 1)
    },
    /** 운동 화면을 유지한 채 다시 입장한다 (다른 창에 밀렸거나 연결을 잃었을 때) */
    reconnect: () => setRetryKey((k) => k + 1),
  }
}

// 실시간 운동방 입장·참가자·응원 수신을 묶은 훅. 친구 파티와 선셋이 같이 쓴다.

import { useEffect, useRef, useState } from 'react'
import { services, type JoinOptions, type RoomConnection } from '../services'
import { CHEER_COOLDOWN_MS, STALE_PEER_MS } from '../config/provisional'
import type { Participant, Profile } from '../types/domain'

export type RoomState = 'joining' | 'joined' | 'full' | 'network'

export const isStale = (p: Participant, now = Date.now()) => now - p.lastSeenAt > STALE_PEER_MS

const CHEER_TOAST_MS = 2500

export function useRoom(roomId: string | null, me: Profile, options: JoinOptions) {
  const [state, setState] = useState<RoomState>('joining')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [cheerToast, setCheerToast] = useState<string | null>(null)
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

    services.realtime
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
        })
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
      conn?.leave()
      connRef.current = null
    }
  }, [roomId, me, retryKey])

  /** 연타는 쿨다운으로 막는다 (F-HEIEZC 권장안). 보냈으면 true. */
  const sendCheer = (toUserId: string, reaction = '🔥') => {
    const now = Date.now()
    if (now - (lastCheerAt.current.get(toUserId) ?? 0) < CHEER_COOLDOWN_MS) return false
    lastCheerAt.current.set(toUserId, now)
    connRef.current?.sendCheer(toUserId, reaction)
    return true
  }

  return {
    state,
    participants,
    cheerToast,
    sendCheer,
    updateSelf: (patch: Parameters<RoomConnection['updateSelf']>[0]) => connRef.current?.updateSelf(patch),
    retry: () => {
      setState('joining')
      setRetryKey((k) => k + 1)
    },
  }
}

// BroadcastChannel 기반 운동방. 같은 브라우저 탭끼리 실제 데이터를 주고받는다.
// 메시지 형식은 나중에 WebSocket 서버로 옮겨도 그대로 쓸 수 있게 단순 JSON으로 둔다.

import { PARTY_MAX, STALE_PEER_MS } from '../../config/provisional'
import type { CheerEvent, Participant, PoseFrame, Profile } from '../../types/domain'
import type { JoinResult, RealtimeService, RoomConnection } from '../ports'

type Msg =
  | { type: 'hello' | 'state'; p: Participant }
  | { type: 'bye'; userId: string }
  | { type: 'pose'; f: PoseFrame }
  | { type: 'cheer'; e: CheerEvent }

const HEARTBEAT_MS = 1000

export const localRealtime: RealtimeService = {
  async join(roomId: string, me: Profile): Promise<JoinResult> {
    const ch = new BroadcastChannel(`fitmate.room.${roomId}`)
    const peers = new Map<string, Participant>()
    const self: Participant = {
      userId: me.userId,
      nickname: me.nickname,
      characterId: me.characterId,
      status: 'waiting',
      lastSeenAt: Date.now(),
    }

    const partListeners = new Set<(l: Participant[]) => void>()
    const poseListeners = new Set<(f: PoseFrame) => void>()
    const cheerListeners = new Set<(e: CheerEvent) => void>()

    const send = (m: Msg) => ch.postMessage(m)
    const emitParticipants = () => {
      const list = [self, ...peers.values()]
      partListeners.forEach((cb) => cb(list))
    }

    ch.onmessage = (ev: MessageEvent<Msg>) => {
      const m = ev.data
      switch (m.type) {
        case 'hello':
        case 'state':
          if (m.p.userId === self.userId) return
          peers.set(m.p.userId, { ...m.p, lastSeenAt: Date.now() })
          if (m.type === 'hello') send({ type: 'state', p: { ...self, lastSeenAt: Date.now() } })
          emitParticipants()
          break
        case 'bye':
          peers.delete(m.userId)
          emitParticipants()
          break
        case 'pose':
          if (m.f.userId !== self.userId) poseListeners.forEach((cb) => cb(m.f))
          break
        case 'cheer':
          if (m.e.toUserId === self.userId) cheerListeners.forEach((cb) => cb(m.e))
          break
      }
    }

    send({ type: 'hello', p: self })

    // 기존 참가자 응답을 잠깐 기다린 뒤 인원 확인
    await new Promise((r) => setTimeout(r, 300))
    if (peers.size >= PARTY_MAX) {
      send({ type: 'bye', userId: self.userId })
      ch.close()
      return { ok: false, reason: 'full' }
    }

    const beat = setInterval(() => {
      send({ type: 'state', p: { ...self, lastSeenAt: Date.now() } })
      emitParticipants() // 마지막 수신 시각 기준으로 '연결 불안정' 표시를 갱신하기 위해
    }, HEARTBEAT_MS)

    const onUnload = () => send({ type: 'bye', userId: self.userId })
    window.addEventListener('beforeunload', onUnload)

    const conn: RoomConnection = {
      roomId,
      selfId: self.userId,
      updateSelf(patch) {
        Object.assign(self, patch)
        send({ type: 'state', p: { ...self, lastSeenAt: Date.now() } })
        emitParticipants()
      },
      publishPose(f) {
        send({ type: 'pose', f: { ...f, userId: self.userId } })
      },
      sendCheer(toUserId, reaction) {
        send({ type: 'cheer', e: { fromUserId: self.userId, toUserId, reaction, at: Date.now() } })
      },
      onParticipants(cb) {
        partListeners.add(cb)
        cb([self, ...peers.values()])
        return () => partListeners.delete(cb)
      },
      onPose(cb) {
        poseListeners.add(cb)
        return () => poseListeners.delete(cb)
      },
      onCheer(cb) {
        cheerListeners.add(cb)
        return () => cheerListeners.delete(cb)
      },
      leave() {
        clearInterval(beat)
        window.removeEventListener('beforeunload', onUnload)
        send({ type: 'bye', userId: self.userId })
        ch.close()
      },
    }
    return { ok: true, conn }
  },
}

export const isStale = (p: Participant, now = Date.now()) => now - p.lastSeenAt > STALE_PEER_MS

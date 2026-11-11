// BroadcastChannel 기반 운동방. 같은 브라우저 탭끼리 실제 데이터를 주고받는다.
// 메시지 형식은 나중에 WebSocket 서버로 옮겨도 그대로 쓸 수 있게 단순 JSON으로 둔다.

import type { CheerEvent, Participant, PoseFrame, Profile } from '../../types/domain'
import type { JoinResult, RealtimeService, RoomConnection } from '../ports'

type Msg =
  | { type: 'hello' | 'state'; p: Participant }
  | { type: 'bye'; userId: string }
  | { type: 'pose'; f: PoseFrame }
  | { type: 'cheer'; e: CheerEvent }

const HEARTBEAT_MS = 1000
/** 기존 참가자의 응답을 기다리는 시간 */
const HELLO_WAIT_MS = 300

export const localRealtime: RealtimeService = {
  async join(roomId: string, me: Profile, options): Promise<JoinResult> {
    const ch = new BroadcastChannel(`fitmate.room.${roomId}`)
    const peers = new Map<string, Participant>()
    const self: Participant = {
      userId: me.userId,
      nickname: me.nickname,
      characterId: me.characterId,
      status: 'waiting',
      ...options.initial,
      lastSeenAt: Date.now(),
    }

    const partListeners = new Set<(l: Participant[]) => void>()
    const poseListeners = new Set<(f: PoseFrame) => void>()
    const cheerListeners = new Set<(e: CheerEvent) => void>()

    const send = (m: Msg) => ch.postMessage(m)
    const snapshot = () => [self, ...peers.values()]
    const emitParticipants = () => {
      const list = snapshot()
      partListeners.forEach((cb) => cb(list))
    }

    ch.onmessage = (ev: MessageEvent<Msg>) => {
      const m = ev.data
      switch (m.type) {
        case 'hello':
        case 'state':
          // 같은 사용자가 다른 탭에서 들어온 경우도 다른 참가자로 보이지 않게 무시
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
    await new Promise((r) => setTimeout(r, HELLO_WAIT_MS))

    if (options.maxParticipants !== null && peers.size >= options.maxParticipants) {
      send({ type: 'bye', userId: self.userId })
      ch.close()
      return { ok: false, reason: 'full' }
    }

    const beat = setInterval(() => {
      send({ type: 'state', p: { ...self, lastSeenAt: Date.now() } })
      emitParticipants() // 마지막 수신 시각 기준 '연결 불안정' 표시 갱신
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
        cb(snapshot())
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
      onConnection(cb) {
        // 같은 브라우저 안이라 끊길 일이 없다
        cb('connected')
        return () => {}
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

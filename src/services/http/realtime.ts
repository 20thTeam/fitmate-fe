// 팀 백엔드 운동방 실시간 연결 (/ws, 브라우저 기본 WebSocket + JSON). 다른 PC끼리 같은 방에서 서로 보인다.
// 메시지 형식은 BE docs/실시간_메시지_형식.md, 관절 좌표 형식은 docs/동작정보_형식.md 를 따른다.
// - 친구 운동방 입장: REST 입장(POST /api/rooms/{id}/enter) → 연결 → JOIN { roomId } → ROOM_SNAPSHOT
// - 공개 파티(선셋) 입장: REST 입장 없이 연결 → JOIN { partyId } → ROOM_SNAPSHOT. 정원 없음, 열려 있을 때만 입장된다
// - 끊기면 같은 토큰으로 다시 JOIN 한다. 서버가 30초 동안 자리를 남겨 두고 진행 상태도 유지한다.
// - 카메라 영상은 보내지 않는다. 관절 좌표(POSE)만 보내고, 서버는 저장하지 않고 중계만 한다.

import type { CheerEvent, Participant, PoseFrame, Profile } from '../../types/domain'
import type { ConnectionState, JoinResult, RealtimeService, RoomConnection } from '../ports'
import { WS_URL } from './client'
import { fromReactionCode, fromRtLandmarks, fromRtParticipant, fromRtStatus, toReactionCode, toRtLandmarks, toRtStatus } from './mappers'
import type { RtClientMessage, RtJoinTarget, RtServerMessage } from './types'

/** 연결 후 ROOM_SNAPSHOT까지 기다리는 시간 (서버 JOIN 대기 10초보다 짧게) */
const JOIN_WAIT_MS = 8000
/** 서버 권장은 10초. 응답 지연을 빨리 알아채려고 더 자주 보낸다 */
const PING_MS = 4000
/** PONG이 이보다 늦으면 '연결이 느려요'로 표시한다 */
const SLOW_MS = 2500
/** PONG이 이만큼 없으면 끊긴 것으로 보고 다시 연결한다 (서버 응답 없음 판정 30초보다 짧게) */
const DEAD_MS = 12000
const RECONNECT_MIN_MS = 1000
const RECONNECT_MAX_MS = 5000
/** 서버는 참가자당 1초에 15개까지만 중계한다. 여유를 두고 12개로 보낸다 */
const POSE_MIN_INTERVAL_MS = 1000 / 12
/** 친구 '연결 불안정' 표시(lastSeenAt 기준)를 갱신하는 주기. STALE_PEER_MS보다 짧아야 한다 */
const REFRESH_MS = 2000

/** 다시 연결해도 소용없는 오류. 공개 파티는 닫힌 뒤 재접속도 거부된다 (이미 하던 운동은 끝까지 할 수 있다) */
const FATAL_ERRORS = new Set(['PARTICIPANT_NOT_FOUND', 'ROOM_NOT_FOUND', 'ROOM_FULL', 'PUBLIC_PARTY_NOT_FOUND', 'PUBLIC_PARTY_CLOSED'])

type JoinOutcome = 'ok' | 'full' | 'fatal' | 'network'

interface Deps {
  /** 이 브라우저에 보관한 재방문 토큰 */
  getToken(): string | null
  /** JOIN 대상을 정한다. 친구 운동방은 REST 입장까지 마친 뒤 돌려준다 */
  joinTarget(token: string): Promise<RtJoinTarget>
}

function parse(data: unknown): RtServerMessage | null {
  if (typeof data !== 'string') return null
  try {
    const m: unknown = JSON.parse(data)
    return typeof m === 'object' && m !== null && 'type' in m ? (m as RtServerMessage) : null
  } catch {
    return null
  }
}

export function createWsRealtime(deps: Deps): RealtimeService {
  return {
    async join(roomId: string, me: Profile, options): Promise<JoinResult> {
      const self: Participant = {
        userId: me.userId,
        nickname: me.nickname,
        characterId: me.characterId,
        status: 'waiting',
        ...options.initial,
        lastSeenAt: Date.now(),
      }
      const peers = new Map<string, { p: Participant; isUnstable: boolean }>()

      const partListeners = new Set<(l: Participant[]) => void>()
      const poseListeners = new Set<(f: PoseFrame) => void>()
      const cheerListeners = new Set<(e: CheerEvent) => void>()
      const connListeners = new Set<(s: ConnectionState) => void>()

      let ws: WebSocket | null = null
      let state: ConnectionState = 'connected'
      let isLeft = false
      let attempt = 0
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      let pingTimer: ReturnType<typeof setInterval> | undefined
      let refreshTimer: ReturnType<typeof setInterval> | undefined
      let pingSentAt = 0
      let lastPongAt = 0
      let lastPoseAt = 0
      let lastStatusJson = ''
      /** 서버가 연결을 닫기 직전에 보낸 오류 코드 */
      let closingError = ''

      const isLive = () => state === 'connected' || state === 'slow'

      const emitParticipants = () => {
        const now = Date.now()
        // 내 연결이 끊긴 동안 친구 상태는 최신이 아니므로 모두 '연결 불안정'으로 보인다
        const list = [
          { ...self, lastSeenAt: now },
          ...[...peers.values()].map(({ p, isUnstable }) => ({ ...p, lastSeenAt: isUnstable || !isLive() ? 0 : now })),
        ]
        partListeners.forEach((cb) => cb(list))
      }

      const setState = (next: ConnectionState) => {
        if (state === next) return
        state = next
        connListeners.forEach((cb) => cb(next))
        emitParticipants()
      }

      const send = (m: RtClientMessage) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
      }

      /** 상태가 바뀔 때만 보낸다. 유효 횟수가 오를 때마다 updateSelf가 불려도 서버로는 같은 값이다 */
      const sendStatus = (isForced = false) => {
        const payload = toRtStatus(self)
        const json = JSON.stringify(payload)
        if (!isForced && json === lastStatusJson) return
        lastStatusJson = json
        send({ type: 'STATUS', payload })
      }

      const handle = (m: RtServerMessage) => {
        const from = m.participantId === null ? '' : String(m.participantId)
        switch (m.type) {
          case 'PARTICIPANT_JOINED':
            if (from !== self.userId) peers.set(from, { p: fromRtParticipant(m.payload), isUnstable: m.payload.connectionStatus === 'UNSTABLE' })
            emitParticipants()
            break
          case 'PARTICIPANT_LEFT':
            peers.delete(from)
            emitParticipants()
            break
          case 'PARTICIPANT_STATUS': {
            const peer = peers.get(from)
            if (peer) peer.p = { ...peer.p, ...fromRtStatus(m.payload) }
            emitParticipants()
            break
          }
          case 'CONNECTION_STATUS': {
            const peer = peers.get(from)
            if (peer) peer.isUnstable = m.payload.connectionStatus === 'UNSTABLE'
            emitParticipants()
            break
          }
          case 'PARTICIPANT_POSE':
            if (from !== self.userId && Array.isArray(m.payload?.landmarks)) {
              const frame: PoseFrame = { userId: from, t: Date.now(), landmarks: fromRtLandmarks(m.payload.landmarks) }
              poseListeners.forEach((cb) => cb(frame))
            }
            break
          case 'CHEER_RECEIVED': {
            const ev: CheerEvent = { fromUserId: from, toUserId: self.userId, reaction: fromReactionCode(m.payload.reaction), at: Date.parse(m.sentAt) || Date.now() }
            cheerListeners.forEach((cb) => cb(ev))
            break
          }
          case 'PONG':
            lastPongAt = Date.now()
            setState(lastPongAt - pingSentAt > SLOW_MS ? 'slow' : 'connected')
            break
          case 'ERROR':
            if (m.payload.closed) closingError = m.payload.code
            // 응원 대상이 막 나간 경우 등. 운동 화면은 그대로 둔다
            else if (import.meta.env.DEV) console.warn('[realtime]', m.payload.code, m.payload.message)
            break
        }
      }

      const stopPing = () => clearInterval(pingTimer)

      const startPing = () => {
        stopPing()
        pingSentAt = Date.now()
        lastPongAt = pingSentAt
        pingTimer = setInterval(() => {
          const now = Date.now()
          const isWaiting = lastPongAt < pingSentAt
          if (isWaiting && now - pingSentAt > DEAD_MS) {
            // 브라우저가 끊김을 늦게 알아챌 때가 있어 직접 끊고 다시 붙는다
            const dead = ws
            ws = null
            if (dead) {
              dead.onclose = null
              dead.close()
            }
            handleLost()
            return
          }
          if (isWaiting && now - pingSentAt > SLOW_MS) setState('slow')
          if (!isWaiting && now - pingSentAt >= PING_MS) {
            pingSentAt = now
            send({ type: 'PING' })
          }
        }, 1000)
      }

      /** 연결 하나를 열고 JOIN 결과를 기다린다. 성공하면 ws에 붙여 둔다 */
      const connect = async (): Promise<JoinOutcome> => {
        const token = deps.getToken()
        if (!token) return 'fatal'
        let target: RtJoinTarget
        try {
          target = await deps.joinTarget(token)
        } catch {
          return 'network'
        }
        return new Promise<JoinOutcome>((resolve) => {
          let socket: WebSocket
          try {
            socket = new WebSocket(WS_URL)
          } catch {
            return resolve('network')
          }
          let isSettled = false
          const settle = (o: JoinOutcome) => {
            if (isSettled) return
            isSettled = true
            clearTimeout(timer)
            resolve(o)
          }
          const timer = setTimeout(() => {
            settle('network')
            socket.close()
          }, JOIN_WAIT_MS)

          socket.onopen = () => socket.send(JSON.stringify({ type: 'JOIN', payload: { token, ...target } } satisfies RtClientMessage))
          socket.onmessage = (ev) => {
            const m = parse(ev.data)
            if (!m) return
            if (!isSettled) {
              if (m.type === 'ROOM_SNAPSHOT') {
                ws = socket
                closingError = ''
                peers.clear()
                for (const v of m.payload.participants) {
                  const id = String(v.participantId)
                  if (id !== self.userId && id !== String(m.participantId)) peers.set(id, { p: fromRtParticipant(v), isUnstable: v.connectionStatus === 'UNSTABLE' })
                }
                settle('ok')
              } else if (m.type === 'ERROR' && m.payload.closed) {
                settle(m.payload.code === 'ROOM_FULL' ? 'full' : FATAL_ERRORS.has(m.payload.code) ? 'fatal' : 'network')
              }
              return
            }
            if (ws === socket) handle(m)
          }
          socket.onclose = (ev) => {
            settle('network')
            if (ws !== socket) return
            ws = null
            const reason = closingError || ev.reason
            if (isLeft) return
            stopPing()
            if (reason === 'SESSION_REPLACED') return setState('replaced')
            if (FATAL_ERRORS.has(reason)) return setState('closed')
            handleLost()
          }
        })
      }

      const handleLost = () => {
        stopPing()
        if (isLeft) return
        setState('reconnecting')
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempt)
        attempt++
        clearTimeout(retryTimer)
        retryTimer = setTimeout(async () => {
          const outcome = await connect()
          if (isLeft) {
            closeSocket()
            return
          }
          if (outcome === 'ok') {
            attempt = 0
            startPing()
            setState('connected')
            // 재접속 대기 시간이 지나 새로 입장했으면 서버가 대기 상태로 알고 있으니 다시 알린다
            sendStatus(true)
            emitParticipants()
          } else if (outcome === 'network') {
            handleLost()
          } else {
            setState('closed')
          }
        }, delay)
      }

      const closeSocket = () => {
        const socket = ws
        ws = null
        if (!socket) return
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'LEAVE' } satisfies RtClientMessage))
        socket.onclose = null
        socket.close(1000)
      }

      const outcome = await connect()
      if (outcome !== 'ok') {
        closeSocket()
        return { ok: false, reason: outcome === 'full' ? 'full' : 'network' }
      }
      startPing()
      sendStatus(true)
      refreshTimer = setInterval(emitParticipants, REFRESH_MS)

      // 탭을 닫으면 바로 나간다. 보내지 못하면 서버가 30초 뒤 퇴장 처리한다
      const onUnload = () => send({ type: 'LEAVE' })
      window.addEventListener('beforeunload', onUnload)

      const conn: RoomConnection = {
        roomId,
        selfId: self.userId,
        updateSelf(patch) {
          Object.assign(self, patch)
          sendStatus()
          emitParticipants()
        },
        publishPose(frame) {
          const now = Date.now()
          if (now - lastPoseAt < POSE_MIN_INTERVAL_MS || !isLive()) return
          const landmarks = toRtLandmarks(frame.landmarks)
          if (!landmarks) return
          lastPoseAt = now
          send({ type: 'POSE', payload: { landmarks } })
        },
        sendCheer(toUserId, reaction) {
          const target = Number(toUserId)
          if (!Number.isInteger(target) || target <= 0) return
          send({ type: 'CHEER', payload: { targetParticipantId: target, reaction: toReactionCode(reaction) } })
        },
        onParticipants(cb) {
          partListeners.add(cb)
          emitParticipants()
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
          connListeners.add(cb)
          cb(state)
          return () => connListeners.delete(cb)
        },
        leave() {
          isLeft = true
          clearTimeout(retryTimer)
          clearInterval(refreshTimer)
          stopPing()
          window.removeEventListener('beforeunload', onUnload)
          closeSocket()
          partListeners.clear()
          poseListeners.clear()
          cheerListeners.clear()
          connListeners.clear()
        },
      }
      return { ok: true, conn }
    },
  }
}

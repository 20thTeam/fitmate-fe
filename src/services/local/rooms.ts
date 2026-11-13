// 친구 운동방 목록과 마지막 방 기억 (로컬). 방 목록은 이 브라우저에만 저장돼서 같은 브라우저의 탭끼리만 같은 방을 본다.
// 실시간 채널(BroadcastChannel)이 방 ID마다 따로라서 방끼리 참가자·관절 좌표가 섞이지 않는다.

import type { FriendRoom } from '../../types/domain'
import type { FriendRoomService } from '../ports'
import { PARTY_MAX, PROVISIONAL_MAX_ROOMS } from '../../config/provisional'
import { DEMO_ROOM_ID } from '../../store/app'
import { readJson, writeJson } from './storage'

const KEY = {
  rooms: 'fitmate.rooms',
  /** { [userId]: roomId | null }. null은 '방 나가기'를 한 상태 */
  lastRoom: 'fitmate.lastRoom',
}

/** 예전부터 쓰던 지정 운동방. 지워지지 않는다 (PL-MLHPJO) */
const DEFAULT_ROOM: FriendRoom = { roomId: DEMO_ROOM_ID, name: 'FITMATE 운동방', capacity: PARTY_MAX }

const readRooms = () => [DEFAULT_ROOM, ...readJson<FriendRoom[]>(KEY.rooms, [])]

/** 초대 링크에 들어가는 ID라 짧게 만든다 */
const newRoomId = () => `r-${crypto.randomUUID().slice(0, 8)}`

export class RoomLimitError extends Error {
  constructor() {
    super(`운동방은 최대 ${PROVISIONAL_MAX_ROOMS}개까지 만들 수 있어요`)
    this.name = 'RoomLimitError'
  }
}

/** 마지막 방 기억은 http 구현도 같은 방식으로 이 브라우저에 둔다 */
export function createLastRoomStore(key: string) {
  const read = () => readJson<Record<string, string | null>>(key, {})
  return {
    /** 기록이 없으면 undefined, 나가기를 했으면 null */
    get: (userId: string): string | null | undefined => read()[userId],
    set: (userId: string, roomId: string | null) => writeJson(key, { ...read(), [userId]: roomId }),
  }
}

const lastRoom = createLastRoomStore(KEY.lastRoom)

export const localRooms: FriendRoomService = {
  async list() {
    return readRooms()
  },
  async get(roomId) {
    return readRooms().find((r) => r.roomId === roomId) ?? null
  },
  canCreate: true,
  async create({ name }) {
    const rooms = readRooms()
    if (rooms.length >= PROVISIONAL_MAX_ROOMS) throw new RoomLimitError()
    const room: FriendRoom = { roomId: newRoomId(), name, capacity: PARTY_MAX }
    writeJson(KEY.rooms, [...rooms.slice(1), room])
    return room
  },
  async getLast(userId) {
    return lastRoom.get(userId) ?? null
  },
  async remember(userId, roomId) {
    lastRoom.set(userId, roomId)
  },
  async leave(userId) {
    lastRoom.set(userId, null)
  },
}

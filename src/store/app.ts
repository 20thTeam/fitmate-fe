// 화면 사이에 유지할 클라이언트 상태. 영구 데이터는 services 쪽에 둔다.

import { create } from 'zustand'
import type { GoalId, Profile } from '../types/domain'

/** 기본 친구 운동방 (PL-MLHPJO 지정 운동방). 방을 여러 개 운영해도 이 방은 늘 있다 (local) */
export const DEMO_ROOM_ID = 'demo-party'
export const SUNSET_ROOM_ID = 'sunset-public'

interface AppState {
  profile: Profile | null
  goal: GoalId | null
  /** 공개 운동방에서 '친구 운동방' 탭을 누르면 돌아갈 마지막 루틴 */
  lastRoutineId: string | null
  /** 초대 링크로 받은 방. 프로필·목표 선택을 거친 뒤 친구 운동방에 들어갈 때 이 방으로 간다 */
  invitedRoomId: string | null
  setProfile: (p: Profile) => void
  setGoal: (g: GoalId) => void
  setLastRoutineId: (id: string) => void
  setInvitedRoomId: (id: string | null) => void
}

export const useApp = create<AppState>((set) => ({
  profile: null,
  goal: null,
  lastRoutineId: null,
  invitedRoomId: null,
  setProfile: (profile) => set({ profile }),
  setGoal: (goal) => set({ goal }),
  setLastRoutineId: (lastRoutineId) => set({ lastRoutineId }),
  setInvitedRoomId: (invitedRoomId) => set({ invitedRoomId }),
}))

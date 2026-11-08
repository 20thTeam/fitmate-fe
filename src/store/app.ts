// 화면 사이에 유지할 클라이언트 상태. 영구 데이터는 services 쪽에 둔다.

import { create } from 'zustand'
import type { GoalId, Profile } from '../types/domain'

/** 시연 범위: 초대 없이 지정된 운동방 하나 (PL-MLHPJO) */
export const DEMO_ROOM_ID = 'demo-party'
export const SUNSET_ROOM_ID = 'sunset-public'

interface AppState {
  profile: Profile | null
  goal: GoalId | null
  /** 공개 운동방에서 '친구 운동방' 탭을 누르면 돌아갈 마지막 루틴 */
  lastRoutineId: string | null
  setProfile: (p: Profile) => void
  setGoal: (g: GoalId) => void
  setLastRoutineId: (id: string) => void
}

export const useApp = create<AppState>((set) => ({
  profile: null,
  goal: null,
  lastRoutineId: null,
  setProfile: (profile) => set({ profile }),
  setGoal: (goal) => set({ goal }),
  setLastRoutineId: (lastRoutineId) => set({ lastRoutineId }),
}))

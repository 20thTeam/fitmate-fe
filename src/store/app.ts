// 화면 사이에 유지할 클라이언트 상태. 영구 데이터는 services 쪽에 둔다.

import { create } from 'zustand'
import type { GoalId, Profile } from '../types/domain'

/** 시연 범위: 초대 없이 지정된 운동방 하나 (PL-MLHPJO) */
export const DEMO_ROOM_ID = 'demo-party'
export const SUNSET_ROOM_ID = 'sunset-public'

interface AppState {
  profile: Profile | null
  goal: GoalId | null
  currentRoutineId: string | null
  setProfile: (p: Profile) => void
  setGoal: (g: GoalId) => void
  setRoutine: (id: string) => void
}

export const useApp = create<AppState>((set) => ({
  profile: null,
  goal: null,
  currentRoutineId: null,
  setProfile: (profile) => set({ profile }),
  setGoal: (goal) => set({ goal }),
  setRoutine: (currentRoutineId) => set({ currentRoutineId }),
}))

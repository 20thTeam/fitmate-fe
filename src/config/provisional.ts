// ⚠️ 시연용 임시값 모음 (manyfast 정책 PL-TGNVCJ "미정 사항 임시값 처리 정책")
// 여기 있는 값은 모두 PM 승인 전 임시값이다. 확정되면 이 파일만 고치거나
// 백엔드 응답으로 대체한다. 화면에서는 provisional=true 루틴에 '임시' 표시를 한다.

import type { GoalId, RoutineItem } from '../types/domain'

/** 미정: 목표별 운동 목록·횟수·세트 (F-UZFEMP 질문) */
export const PROVISIONAL_ROUTINES: Record<GoalId, Omit<RoutineItem, 'order'>[]> = {
  weight_loss: [
    { exerciseId: 'jumping_jack', name: '점핑잭', sets: 2, targetReps: 20 },
    { exerciseId: 'squat', name: '스쿼트', sets: 2, targetReps: 15 },
    { exerciseId: 'lunge', name: '런지', sets: 2, targetReps: 12 },
  ],
  posture: [
    { exerciseId: 'wall_angel', name: '월 엔젤', sets: 2, targetReps: 12 },
    { exerciseId: 'plank', name: '플랭크', sets: 2, targetSeconds: 30 },
  ],
  strength: [
    { exerciseId: 'squat', name: '스쿼트', sets: 3, targetReps: 15 },
    { exerciseId: 'lunge', name: '런지', sets: 2, targetReps: 12 },
    { exerciseId: 'plank', name: '플랭크', sets: 2, targetSeconds: 30 },
  ],
  stamina: [
    { exerciseId: 'jumping_jack', name: '점핑잭', sets: 3, targetReps: 20 },
    { exerciseId: 'high_knees', name: '하이 니', sets: 2, targetReps: 20 },
  ],
}

/** 미정: '잘했다' 판정 기준 (PL-SOBVBH). 유효 비율이 이 값 이상이면 상향 후보. */
export const PROVISIONAL_GOOD_RATIO = 0.9

/** 미정: 상향 폭과 안전 상한 */
export const PROVISIONAL_INCREASE = { repsRatio: 0.15, secondsStep: 10, maxReps: 30, maxSeconds: 60 }

/** 친구 파티 최대 인원 (PRD 확정: 2~5명) */
export const PARTY_MAX = 5

/** 연결 불안정 판정까지의 시간. 미정 → 개발팀 제안값 */
export const STALE_PEER_MS = 5000

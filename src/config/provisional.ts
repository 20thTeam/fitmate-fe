// ⚠️ 시연용 임시값 모음 (manyfast 정책 PL-TGNVCJ "미정 사항 임시값 처리 정책")
// 여기 있는 값은 모두 PM 승인 전 임시값이다. 확정되면 이 파일만 고치거나
// 백엔드 응답으로 대체한다. 화면에서는 provisional=true 루틴에 '임시' 표시를 한다.

import type { GoalId, RoutineItem } from '../types/domain'

/** 미정: 목표별 운동 목록·횟수·세트 (F-UZFEMP 질문). 자세 개선은 와이어프레임 v3 예시를 따름. */
export const PROVISIONAL_ROUTINES: Record<GoalId, Omit<RoutineItem, 'order'>[]> = {
  weight_loss: [
    { exerciseId: 'jumping_jack', name: '점핑잭', tag: '체중 감량 · 전신 유산소', sets: 3, targetReps: 20 },
    { exerciseId: 'squat', name: '스쿼트', tag: '체중 감량 · 하체 근력', sets: 3, targetReps: 12 },
    { exerciseId: 'lunge', name: '런지', tag: '체중 감량 · 하체 균형', sets: 2, targetReps: 10 },
  ],
  posture: [
    { exerciseId: 'squat', name: '스쿼트', tag: '자세 개선 · 하체 근력 강화', sets: 3, targetReps: 12 },
    { exerciseId: 'hip_hinge', name: '힙 힌지 데드리프트', tag: '자세 개선 · 후면 사슬 강화', sets: 3, targetReps: 10 },
    { exerciseId: 'plank', name: '플랭크', tag: '코어 안정화 · 자세 유지력', sets: 3, targetSeconds: 30 },
  ],
  strength: [
    { exerciseId: 'squat', name: '스쿼트', tag: '근력 강화 · 하체', sets: 3, targetReps: 15 },
    { exerciseId: 'lunge', name: '런지', tag: '근력 강화 · 하체 균형', sets: 3, targetReps: 12 },
    { exerciseId: 'plank', name: '플랭크', tag: '근력 강화 · 코어', sets: 3, targetSeconds: 30 },
  ],
  stamina: [
    { exerciseId: 'jumping_jack', name: '점핑잭', tag: '체력 증진 · 유산소', sets: 3, targetReps: 25 },
    { exerciseId: 'high_knees', name: '하이 니', tag: '체력 증진 · 인터벌', sets: 3, targetReps: 20 },
    { exerciseId: 'squat', name: '스쿼트', tag: '체력 증진 · 하체 지구력', sets: 2, targetReps: 15 },
  ],
}

/** 미정: '잘했다' 판정 기준 (PL-SOBVBH). 목표 대비 유효 비율이 이 값 이상이면 상향 후보. */
export const PROVISIONAL_GOOD_RATIO = 0.9

/** 미정: 상향 폭과 안전 상한 */
export const PROVISIONAL_INCREASE = { repsRatio: 0.15, secondsStep: 10, maxReps: 30, maxSeconds: 60 }

/** 미정: 운동 간 휴식 길이. 와이어프레임 v3 예시(00:30)를 임시로 사용. 자동 전환은 하지 않는다. */
export const PROVISIONAL_REST_SECONDS = 30

/** 미정: 선셋 운영 (F-DXORMB). 권장안 = 매일 · 한국 시간. 종료 시각은 미정이라 임시 1시간. */
export const PROVISIONAL_SUNSET = { openHourKst: 22, durationMin: 60 }

/** 선셋 에어로빅 동작 */
export const SUNSET_EXERCISE = { exerciseId: 'aerobic_jumping_jack', name: '점핑잭' }

/** 친구 파티 최대 인원 (PRD 확정: 2~5명) */
export const PARTY_MAX = 5

/** 연결 불안정 판정까지의 시간. 미정 → 개발팀 제안값 */
export const STALE_PEER_MS = 5000

/** 응원 연타 쿨다운 (F-HEIEZC 권장안: 쿨다운). 길이는 개발팀 제안값 */
export const CHEER_COOLDOWN_MS = 1500

/** 미정: 운동방 아래 요약 바의 예상 시간·칼로리 계산 기준 (Figma 시안에 있는 항목). 화면에 '시연용 임시'로 표시한다. */
export const PROVISIONAL_ESTIMATE = {
  /** 횟수형 1회에 걸리는 시간 */
  secondsPerRep: 3,
  /** 세트 사이 휴식 */
  restBetweenSetsSeconds: 20,
  /** 분당 소모 칼로리 */
  kcalPerMinute: 5,
}

/** 미정: 회차별 난이도 이름. 난이도 기준이 정해지면 루틴 응답 값으로 바꾼다. */
export const provisionalDifficulty = (round: number) => (round <= 1 ? '쉬움' : round === 2 ? '보통' : '도전')

/**
 * 미정: 운동방 가운데 스크린에 틀 따라하기 영상(YouTube 영상 ID).
 * 영상이 정해지면 exerciseId별로 채운다. 비어 있으면 동작 안내 카드를 보여준다.
 */
export const PROVISIONAL_GUIDE_VIDEOS: Record<string, string> = {}

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

/**
 * 미정: 동작 1회 인정 기준 (F-XNIIJM, PL-OEFFCN). 관절 3D 각도(도)와 거리 비율.
 * 개발팀이 시연 운동으로 맞춘 임시값이라 실제 촬영 사례로 검증한 뒤 PM 승인을 받아야 한다.
 * 각 운동은 '시작 자세 → 목표 자세 → 시작 자세'를 1회로 센다.
 */
export const PROVISIONAL_POSE_RULES = {
  /** 관절 인식 신뢰도. 이보다 낮으면 판정 보류 (근거 없는 카운트 금지) */
  minVisibility: 0.5,
  /** 같은 동작이 두 번 세지지 않게 하는 최소 간격 */
  minRepMs: 500,
  /** 무릎 각도: 서 있을 때 → 앉았을 때 */
  squat: { kneeStand: 160, kneeDown: 110 },
  /** 두 무릎 중 더 굽힌 쪽 각도 */
  lunge: { kneeStand: 160, kneeDown: 110 },
  /** 몸통이 세로에서 기운 각도. 무릎을 kneeMin보다 많이 굽히면 스쿼트로 본다 */
  hipHinge: { leanStand: 15, leanDown: 45, kneeMin: 100 },
  /** 팔 각도(엉덩이-어깨-손목), 발 간격 ÷ 어깨 너비 */
  jumpingJack: { armDown: 45, armUp: 140, feetClosed: 0.9, feetOpen: 1.5 },
  /** 엉덩이 각도. 다리마다 1회씩 센다 */
  highKnees: { hipStand: 165, hipUp: 115, minRepMs: 200 },
  /**
   * 어깨-엉덩이-발목이 lineMin 이상이면 일직선. 화면에서 몸이 가로선과 maxBodyTilt 이하,
   * 위팔이 세로선과 maxArmTilt 이하이면 엎드려 팔로 받친 자세. settleMs 동안 유지된 뒤부터 센다
   */
  plank: { lineMin: 155, maxBodyTilt: 30, maxArmTilt: 40, settleMs: 700 },
}

/**
 * 미정: 카메라 확인 화면 자동 판정 기준 (F-ZGIFAX). 개발팀 제안값.
 * 몸 길이 = 코~발목 세로 길이 ÷ 화면 높이. 밝기는 0~255 평균 밝기.
 */
export const PROVISIONAL_CAMERA_CHECK = {
  minVisibility: 0.5,
  /** 관절이 화면 가장자리에서 이만큼 안쪽이어야 잘리지 않은 것으로 본다 */
  edgeMargin: 0.02,
  minBodySpan: 0.45,
  maxBodySpan: 0.92,
  minBrightness: 60,
}

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

/** 미정: 난이도 이름. 목표량을 올린 횟수로 정한다. 난이도 기준이 정해지면 루틴 응답 값으로 바꾼다. */
export const provisionalDifficulty = (difficultyStep = 0) => (difficultyStep <= 0 ? '쉬움' : difficultyStep === 1 ? '보통' : '도전')

/**
 * 미정: 운동방 가운데 스크린에 틀 따라하기 영상(YouTube 영상 ID).
 * 영상이 정해지면 exerciseId별로 채운다. 비어 있으면 동작 안내 카드를 보여준다.
 */
/** 시연 확인용으로 모든 운동에 같은 영상을 넣어 둔다. 운동별 영상이 정해지면 바꾼다 */
const TEST_GUIDE_VIDEO = 'jpTQdM7okkI'
export const PROVISIONAL_GUIDE_VIDEOS: Record<string, string> = {
  squat: TEST_GUIDE_VIDEO,
  lunge: TEST_GUIDE_VIDEO,
  hip_hinge: TEST_GUIDE_VIDEO,
  plank: TEST_GUIDE_VIDEO,
  jumping_jack: TEST_GUIDE_VIDEO,
  high_knees: TEST_GUIDE_VIDEO,
  aerobic_jumping_jack: TEST_GUIDE_VIDEO,
}

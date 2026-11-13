// 학교 대항 스쿼트 챌린지 진행 규칙 (/univ-contest). 시연 운영진이 정한 값이다.

export const CONTEST_RULES = {
  exerciseId: 'squat',
  exerciseName: '스쿼트',
  /** 한 판 운동 시간 */
  durationMs: 20_000,
  /** 노트북 4대, 1인 1대 */
  maxPlayers: 4,
  /** 시작을 누른 뒤 모두 자리 잡을 시간 */
  countdownMs: 5_000,
  /** 운동이 끝나고 이 시간 안에 결과를 내지 않은 사람은 빼고 판을 마친다 */
  submitGraceMs: 10_000,
  /** 개인 순위 표시 인원 */
  topPlayerCount: 5,
  /** 대기·결과를 다시 확인하는 주기 */
  pollMs: 1_000,
  /** 남은 시간이 이 아래면 화면을 주황으로 바꿔 서두르게 한다 */
  hurrySeconds: 10,
  /** 남은 시간이 이 아래면 빨강·깜빡임·매초 알림음 */
  finalSeconds: 5,
}

/**
 * 참가 학교 (시연 운영진 확정 목록, 가나다순).
 * schoolId는 서버에 그대로 저장되니 한 번 정한 뒤에는 바꾸지 않는다.
 */
export const CONTEST_SCHOOLS: { schoolId: string; name: string }[] = [
  { schoolId: 'catholic', name: '가톨릭대학교' },
  { schoolId: 'khu', name: '경희대학교' },
  { schoolId: 'kw', name: '광운대학교' },
  { schoolId: 'seoultech', name: '서울과학기술대학교' },
  { schoolId: 'skhu', name: '성공회대학교' },
  { schoolId: 'shinhan', name: '신한대학교' },
  { schoolId: 'ptu', name: '평택대학교' },
  { schoolId: 'hufs', name: '한국외국어대학교' },
]

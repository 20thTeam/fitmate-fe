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
 * shortName·color는 순위 화면(그래프·막대) 표시용으로 Figma '대항전 마지막 페이지' 시안 값이다.
 */
export const CONTEST_SCHOOLS: { schoolId: string; name: string; shortName: string; color: string }[] = [
  { schoolId: 'catholic', name: '가톨릭대학교', shortName: '가톨릭대', color: '#7da6ff' },
  { schoolId: 'khu', name: '경희대학교', shortName: '경희대', color: '#a47195' },
  { schoolId: 'kw', name: '광운대학교', shortName: '광운대', color: '#c57979' },
  { schoolId: 'seoultech', name: '서울과학기술대학교', shortName: '서울과학기술대', color: '#5fd3b0' },
  { schoolId: 'skhu', name: '성공회대학교', shortName: '성공회대', color: '#e3bf8c' },
  { schoolId: 'shinhan', name: '신한대학교', shortName: '신한대', color: '#a6baff' },
  { schoolId: 'ptu', name: '평택대학교', shortName: '평택대', color: '#adda9e' },
  { schoolId: 'hufs', name: '한국외국어대학교', shortName: '한국외대', color: '#ac90be' },
]

const schoolOf = (id: string) => CONTEST_SCHOOLS.find((s) => s.schoolId === id)
export const schoolName = (id: string) => schoolOf(id)?.name ?? id
export const schoolShortName = (id: string) => schoolOf(id)?.shortName ?? id
export const schoolColor = (id: string) => schoolOf(id)?.color ?? '#a2a7b5'

// 학교 로고. src/assets/schools/{schoolId}.svg(또는 .png·.webp·.jpg·.jpeg)를 넣으면 학교 고르기 버튼에 자동으로 붙는다.
// 파일이 없는 학교는 이름만 보인다
const SCHOOL_LOGO_FILES = import.meta.glob<string>('../assets/schools/*.{svg,png,webp,jpg,jpeg}', { eager: true, import: 'default' })

const SCHOOL_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(SCHOOL_LOGO_FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.')), url]),
)

export const schoolLogo = (schoolId: string): string | undefined => SCHOOL_LOGOS[schoolId]

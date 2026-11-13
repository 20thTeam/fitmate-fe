// 선셋 공개 파티 운영 상태 계산 (F-DXORMB).
// 서버가 오픈 상태를 알려 주면 그 값을 쓰고(services/http), 이 계산은 서버가 답하지 않을 때·로컬 모드의 대비다.
// 운영 시각은 운영 화면에서 바꾸고(#41), 정해진 값이 없으면 config의 임시값을 쓴다.
import { PROVISIONAL_SUNSET } from '../config/provisional'
import type { PublicPartyMode, PublicPartySchedule, SunsetStatus } from '../types/domain'

const KST_OFFSET_MS = 9 * 3_600_000
const DAY_MS = 86_400_000

/** 운영 화면에서 고를 수 있는 운영 시간(분) 범위 */
export const SCHEDULE_DURATION_RANGE = { min: 10, max: 720 }

const pad2 = (n: number) => String(n).padStart(2, '0')

export const DEFAULT_SUNSET_SCHEDULE: PublicPartySchedule = {
  openTime: `${pad2(PROVISIONAL_SUNSET.openHourKst)}:00`,
  durationMin: PROVISIONAL_SUNSET.durationMin,
}

/** 'HH:mm' → 자정부터 지난 분. 형식이 틀리면 null */
export function parseOpenTime(openTime: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(openTime.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** 운영 화면이나 서버가 정한 시각이 아니라 임시 운영 시각인지. 대체값은 항상 이 상수 그대로 넘긴다 */
export const isProvisionalSchedule = (s: PublicPartySchedule) => s === DEFAULT_SUNSET_SCHEDULE

export function isValidSchedule(s: PublicPartySchedule) {
  return parseOpenTime(s.openTime) !== null
    && Number.isInteger(s.durationMin)
    && s.durationMin >= SCHEDULE_DURATION_RANGE.min
    && s.durationMin <= SCHEDULE_DURATION_RANGE.max
}

/** 개발 중에는 ?sunset=open|closed 로 상태를 바꿔 볼 수 있다. 바꾸지 않았으면 null */
export function devSunsetOverride(now = Date.now(), schedule = DEFAULT_SUNSET_SCHEDULE): SunsetStatus | null {
  if (!import.meta.env.DEV) return null
  const force = new URLSearchParams(location.search).get('sunset') ?? sessionStorage.getItem('fitmate.sunset')
  if (force !== 'open' && force !== 'closed') return null
  sessionStorage.setItem('fitmate.sunset', force)
  if (force === 'open') return { isOpen: true, nextOpenAt: now, closesAt: now + schedule.durationMin * 60_000, participantCount: null, schedule }
  return { ...scheduleAt(now, schedule), isOpen: false, closesAt: null }
}

function scheduleAt(now: number, schedule: PublicPartySchedule): SunsetStatus {
  const valid = isValidSchedule(schedule) ? schedule : DEFAULT_SUNSET_SCHEDULE
  const openMin = parseOpenTime(valid.openTime) ?? 0
  const kstNow = now + KST_OFFSET_MS
  const kstDayStart = Math.floor(kstNow / DAY_MS) * DAY_MS
  const toUtc = (t: number) => t - KST_OFFSET_MS
  const base = { participantCount: null, schedule: valid }

  // 자정을 넘기는 운영 시각(예: 23:30부터 1시간)은 어제 연 구간이 아직 열려 있을 수 있다
  for (const dayStart of [kstDayStart - DAY_MS, kstDayStart]) {
    const openKst = dayStart + openMin * 60_000
    const closeKst = openKst + valid.durationMin * 60_000
    if (kstNow >= openKst && kstNow < closeKst) return { ...base, isOpen: true, nextOpenAt: toUtc(openKst), closesAt: toUtc(closeKst) }
  }
  const todayOpen = kstDayStart + openMin * 60_000
  const next = kstNow < todayOpen ? todayOpen : todayOpen + DAY_MS
  return { ...base, isOpen: false, nextOpenAt: toUtc(next), closesAt: null }
}

export function getSunsetStatus(now = Date.now(), schedule = DEFAULT_SUNSET_SCHEDULE): SunsetStatus {
  return devSunsetOverride(now, schedule) ?? scheduleAt(now, schedule)
}

/**
 * 운영 모드를 반영한 상태. OPEN은 운영자가 닫을 때까지 열어 두니 닫는 시각이 없다.
 * CLOSED는 지금이 운영 시각 안이어도 닫고, 다음 오픈은 그다음 운영 시각으로 알린다.
 */
export function sunsetStatusWithMode(mode: PublicPartyMode, schedule = DEFAULT_SUNSET_SCHEDULE, now = Date.now()): SunsetStatus {
  const scheduled = scheduleAt(now, schedule)
  if (mode === 'OPEN') return { ...scheduled, isOpen: true, nextOpenAt: now, closesAt: null }
  if (mode === 'AUTO' || !scheduled.isOpen) return scheduled
  return { ...scheduled, isOpen: false, nextOpenAt: scheduled.nextOpenAt + DAY_MS, closesAt: null }
}

// 로컬 모드(서버 없이)에서 운영 화면이 정한 운영 모드·운영 시각. 같은 브라우저 안에서만 통한다
const LOCAL_MODE_KEY = 'fitmate.sunsetMode'
const LOCAL_SCHEDULE_KEY = 'fitmate.sunsetSchedule'

export function readLocalSunsetMode(): PublicPartyMode {
  try {
    const v = localStorage.getItem(LOCAL_MODE_KEY)
    return v === 'OPEN' || v === 'CLOSED' ? v : 'AUTO'
  } catch {
    return 'AUTO'
  }
}

export function writeLocalSunsetMode(mode: PublicPartyMode) {
  try {
    if (mode === 'AUTO') localStorage.removeItem(LOCAL_MODE_KEY)
    else localStorage.setItem(LOCAL_MODE_KEY, mode)
  } catch {
    /* 저장이 막혀 있으면 운영 시각대로 둔다 */
  }
}

export function readLocalSunsetSchedule(): PublicPartySchedule {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LOCAL_SCHEDULE_KEY) ?? 'null')
    if (raw && typeof raw === 'object' && 'openTime' in raw && 'durationMin' in raw) {
      const s = { openTime: String(raw.openTime), durationMin: Number(raw.durationMin) }
      if (isValidSchedule(s)) return s
    }
  } catch {
    /* 읽을 수 없으면 임시 운영 시각 */
  }
  return DEFAULT_SUNSET_SCHEDULE
}

export function writeLocalSunsetSchedule(schedule: PublicPartySchedule) {
  try {
    localStorage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(schedule))
  } catch {
    /* 저장이 막혀 있으면 임시 운영 시각대로 둔다 */
  }
}

/** 자정부터 지난 분 → '밤 10시', '오후 2시 30분' */
function clockLabel(totalMin: number) {
  const min = ((totalMin % 1440) + 1440) % 1440
  const h = Math.floor(min / 60)
  const m = min % 60
  // 자정 무렵(0시대)은 '새벽 12시'보다 '밤 12시'가 익숙하다
  const part = h < 1 ? '밤' : h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${part} ${h12}시${m ? ` ${m}분` : ''}`
}

/** 60 → '1시간', 90 → '1시간 30분', 30 → '30분' */
export function durationLabel(durationMin: number) {
  const h = Math.floor(durationMin / 60)
  const m = durationMin % 60
  return [h ? `${h}시간` : '', m ? `${m}분` : ''].filter(Boolean).join(' ')
}

/** 요약 바처럼 좁은 자리에 쓰는 짧은 운영 시각 (예: '밤 10시~11시') */
export function sunsetHourLabel(schedule: PublicPartySchedule) {
  const open = parseOpenTime(schedule.openTime) ?? 0
  const start = clockLabel(open)
  const end = clockLabel(open + schedule.durationMin)
  // 같은 때(밤·오후 등)면 끝 시각의 '밤'을 빼서 짧게 쓴다
  const startPart = start.split(' ')[0]
  return `${start}~${end.startsWith(`${startPart} `) ? end.slice(startPart.length + 1) : end}`
}

export const sunsetOpenLabel = (schedule: PublicPartySchedule) => `매일 ${sunsetHourLabel(schedule)} 운영 · 한국 시간 기준`

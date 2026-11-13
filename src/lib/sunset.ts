// 선셋 공개 파티 운영 상태 계산 (F-DXORMB). 시각은 config의 임시값을 쓴다.
// 서버가 오픈 상태를 알려 주면 그 값을 쓰고(services/http), 이 계산은 서버가 답하지 않을 때의 대비다.
import { PROVISIONAL_SUNSET } from '../config/provisional'
import type { PublicPartyMode, SunsetStatus } from '../types/domain'

const KST_OFFSET_MS = 9 * 3_600_000

/** 개발 중에는 ?sunset=open|closed 로 상태를 바꿔 볼 수 있다. 바꾸지 않았으면 null */
export function devSunsetOverride(now = Date.now()): SunsetStatus | null {
  if (!import.meta.env.DEV) return null
  const force = new URLSearchParams(location.search).get('sunset') ?? sessionStorage.getItem('fitmate.sunset')
  if (force !== 'open' && force !== 'closed') return null
  sessionStorage.setItem('fitmate.sunset', force)
  if (force === 'open') return { isOpen: true, nextOpenAt: now, closesAt: now + PROVISIONAL_SUNSET.durationMin * 60_000, participantCount: null }
  return { ...scheduleAt(now), isOpen: false, closesAt: null }
}

function scheduleAt(now: number): SunsetStatus {
  const kstNow = now + KST_OFFSET_MS
  const kstDayStart = Math.floor(kstNow / 86_400_000) * 86_400_000
  const openKst = kstDayStart + PROVISIONAL_SUNSET.openHourKst * 3_600_000
  const closeKst = openKst + PROVISIONAL_SUNSET.durationMin * 60_000
  const toUtc = (t: number) => t - KST_OFFSET_MS

  if (kstNow >= openKst && kstNow < closeKst) return { isOpen: true, nextOpenAt: toUtc(openKst), closesAt: toUtc(closeKst), participantCount: null }
  const next = kstNow < openKst ? openKst : openKst + 86_400_000
  return { isOpen: false, nextOpenAt: toUtc(next), closesAt: null, participantCount: null }
}

export function getSunsetStatus(now = Date.now()): SunsetStatus {
  return devSunsetOverride(now) ?? scheduleAt(now)
}

/**
 * 운영 모드를 반영한 상태. OPEN은 운영자가 닫을 때까지 열어 두니 닫는 시각이 없다.
 * CLOSED는 지금이 운영 시각 안이어도 닫고, 다음 오픈은 그다음 운영 시각으로 알린다.
 */
export function sunsetStatusWithMode(mode: PublicPartyMode, now = Date.now()): SunsetStatus {
  if (mode === 'OPEN') return { isOpen: true, nextOpenAt: now, closesAt: null, participantCount: null }
  const scheduled = scheduleAt(now)
  if (mode === 'AUTO' || !scheduled.isOpen) return scheduled
  return { isOpen: false, nextOpenAt: scheduled.nextOpenAt + 86_400_000, closesAt: null, participantCount: null }
}

// 로컬 모드(서버 없이)에서 운영 화면이 정한 운영 모드. 같은 브라우저 안에서만 통한다
const LOCAL_MODE_KEY = 'fitmate.sunsetMode'

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

export const sunsetOpenLabel = () => `매일 밤 ${PROVISIONAL_SUNSET.openHourKst - 12}시경 운영 · 한국 시간 기준`

/** 요약 바처럼 좁은 자리에 쓰는 짧은 운영 시각 (예: '밤 10시경') */
export const sunsetHourLabel = () => `밤 ${PROVISIONAL_SUNSET.openHourKst - 12}시경`

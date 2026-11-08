// 선셋 공개 파티 운영 상태 계산 (F-DXORMB). 시각은 config의 임시값을 쓴다.
import { PROVISIONAL_SUNSET } from '../config/provisional'

const KST_OFFSET_MS = 9 * 3_600_000

export interface SunsetStatus {
  isOpen: boolean
  /** 다음 오픈 시각 (닫혀 있을 때) */
  nextOpenAt: number
  closesAt: number | null
}

export function getSunsetStatus(now = Date.now()): SunsetStatus {
  // 개발 중에는 ?sunset=open|closed 로 상태를 바꿔 볼 수 있다
  if (import.meta.env.DEV) {
    const force = new URLSearchParams(location.search).get('sunset') ?? sessionStorage.getItem('fitmate.sunset')
    if (force === 'open' || force === 'closed') {
      sessionStorage.setItem('fitmate.sunset', force)
      if (force === 'open') return { isOpen: true, nextOpenAt: now, closesAt: now + PROVISIONAL_SUNSET.durationMin * 60_000 }
    }
  }

  const kstNow = now + KST_OFFSET_MS
  const kstDayStart = Math.floor(kstNow / 86_400_000) * 86_400_000
  const openKst = kstDayStart + PROVISIONAL_SUNSET.openHourKst * 3_600_000
  const closeKst = openKst + PROVISIONAL_SUNSET.durationMin * 60_000
  const toUtc = (t: number) => t - KST_OFFSET_MS

  if (kstNow >= openKst && kstNow < closeKst) return { isOpen: true, nextOpenAt: toUtc(openKst), closesAt: toUtc(closeKst) }
  const next = kstNow < openKst ? openKst : openKst + 86_400_000
  return { isOpen: false, nextOpenAt: toUtc(next), closesAt: null }
}

export const sunsetOpenLabel = () => `매일 밤 ${PROVISIONAL_SUNSET.openHourKst - 12}시경 운영 · 한국 시간 기준`

/** 요약 바처럼 좁은 자리에 쓰는 짧은 운영 시각 (예: '밤 10시경') */
export const sunsetHourLabel = () => `밤 ${PROVISIONAL_SUNSET.openHourKst - 12}시경`

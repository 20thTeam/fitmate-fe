import type { RoutineItem } from '../types/domain'

/** 세트당 목표 수행량 (예: '3세트 × 12회') */
export function amountLabel(it: Pick<RoutineItem, 'targetReps' | 'targetSeconds' | 'sets'>) {
  const per = it.targetReps ? `${it.targetReps}회` : `${it.targetSeconds}초`
  return `${it.sets}세트 × ${per}`
}

/** 세트당 목표 (예: '12회', '30초') */
export const targetLabel = (it: Pick<RoutineItem, 'targetReps' | 'targetSeconds'>) =>
  it.targetReps ? `${it.targetReps}회` : `${it.targetSeconds}초`

export function durationLabel(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

/** mm:ss */
export function clockLabel(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`
}

export function relativeDay(ts: number, now = Date.now()) {
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((day(now) - day(ts)) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  return `${diff}일 전`
}

/** 시안의 짧은 표기 (예: '10회 X 2') */
export const shortAmountLabel = (it: Pick<RoutineItem, 'targetReps' | 'targetSeconds' | 'sets'>) => `${targetLabel(it)} X ${it.sets}`

/** 다음 회차 추천 표기 (예: '15회 X 3세트') */
export const setAmountLabel = (it: Pick<RoutineItem, 'targetReps' | 'targetSeconds' | 'sets'>) => `${targetLabel(it)} X ${it.sets}세트`

/** 두 자리 번호 (예: 1 → '01') */
export const twoDigits = (n: number) => String(n).padStart(2, '0')

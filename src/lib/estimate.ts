// 운동방 요약 바의 예상 시간·칼로리. 모두 임시 기준(PROVISIONAL_ESTIMATE)으로 계산한 추정값이라
// 화면에 '시연용 임시' 표시를 같이 붙인다 (PL-TGNVCJ).
import { PROVISIONAL_ESTIMATE } from '../config/provisional'
import type { RoutineItem } from '../types/domain'

type Item = Pick<RoutineItem, 'sets' | 'targetReps' | 'targetSeconds'>

export function estimateSeconds(items: Item[]) {
  const { secondsPerRep, restBetweenSetsSeconds } = PROVISIONAL_ESTIMATE
  return items.reduce((sum, it) => {
    const perSet = it.targetReps ? it.targetReps * secondsPerRep : (it.targetSeconds ?? 0)
    return sum + perSet * it.sets + restBetweenSetsSeconds * Math.max(0, it.sets - 1)
  }, 0)
}

export const estimateMinutes = (items: Item[]) => Math.max(1, Math.round(estimateSeconds(items) / 60))

export const estimateKcal = (items: Item[]) => Math.round((estimateSeconds(items) / 60) * PROVISIONAL_ESTIMATE.kcalPerMinute)

export function amountLabel(it: { targetReps?: number; targetSeconds?: number; sets: number }) {
  const per = it.targetReps ? `${it.targetReps}회` : `${it.targetSeconds}초`
  return `${per} × ${it.sets}세트`
}

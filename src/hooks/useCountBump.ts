// 횟수가 올라간 순간을 알려 준다. 판정으로 값이 바뀔 때만 다시 그려지고(매 프레임 아님),
// id를 key로 써서 같은 애니메이션을 매번 처음부터 다시 튼다.
import { useState } from 'react'

/**
 * scope가 바뀌면(운동 → 휴식 타이머 등) 값이 달라져도 올라간 걸로 보지 않는다.
 * 돌려준 bump는 지금 scope에서 생긴 것일 때만 isFresh가 true다.
 */
export function useCountBump(value: number, scope: string) {
  const [prev, setPrev] = useState({ value, scope })
  const [bump, setBump] = useState({ id: 0, delta: 0, scope })
  // 렌더 중에 이전 값과 비교한다 (effect로 한 박자 늦게 그리지 않게)
  if (value !== prev.value || scope !== prev.scope) {
    setPrev({ value, scope })
    // 줄어드는 건(휴식 타이머, 세트 넘김) 효과 없음
    if (scope === prev.scope && value > prev.value) setBump({ id: bump.id + 1, delta: value - prev.value, scope })
  }
  return { id: bump.id, delta: bump.delta, isFresh: bump.id > 0 && bump.scope === scope }
}

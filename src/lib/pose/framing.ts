// 카메라 확인 화면에서 '전신이 보이는지', '거리가 적당한지'를 판정한다 (F-ZGIFAX).
// 매 프레임 불리므로 새 객체를 만들지 않는다.
import { PROVISIONAL_CAMERA_CHECK } from '../../config/provisional'
import type { Lm } from './landmarks'

/** ok: 적당함, partial: 몸이 잘림, far: 너무 멂, near: 너무 가까움 */
export type Framing = 'ok' | 'partial' | 'far' | 'near'

/** 코, 어깨, 엉덩이, 무릎, 발목 */
const FULL_BODY = [0, 11, 12, 23, 24, 25, 26, 27, 28] as const

export function checkFraming(image: Lm[]): Framing {
  const { minVisibility, edgeMargin, minBodySpan, maxBodySpan } = PROVISIONAL_CAMERA_CHECK
  let top = 1
  let bottom = 0
  for (const i of FULL_BODY) {
    const p = image[i]
    if (!p || p.visibility < minVisibility) return 'partial'
    if (p.x < edgeMargin || p.x > 1 - edgeMargin || p.y < edgeMargin || p.y > 1 - edgeMargin) return 'partial'
    if (p.y < top) top = p.y
    if (p.y > bottom) bottom = p.y
  }
  const span = bottom - top
  if (span < minBodySpan) return 'far'
  if (span > maxBodySpan) return 'near'
  return 'ok'
}

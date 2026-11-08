// 목표 카드 아이콘. 한 장짜리 그림(sprite)에서 시안과 같은 영역을 잘라 보여준다.
import sprite from '../assets/goal/sprite.png'
import type { GoalId } from '../types/domain'

// Figma 목표 선택 시안의 이미지 크롭 값 (상자 크기 + 그림 위치·배율, %)
const CROP: Record<GoalId, { w: number; h: number; img: { w: string; h: string; left: string; top: string } }> = {
  strength: { w: 124, h: 108, img: { w: '486.26%', h: '371.01%', left: '-10.48%', top: '-142.39%' } },
  stamina: { w: 118, h: 94, img: { w: '506.93%', h: '424.73%', left: '-218.48%', top: '-170.92%' } },
  posture: { w: 114, h: 79, img: { w: '468.29%', h: '451.24%', left: '-291.77%', top: '-186.94%' } },
  weight_loss: { w: 81, h: 92, img: { w: '680.86%', h: '400.28%', left: '-569.86%', top: '-152.88%' } },
}

export default function GoalIcon({ goal }: { goal: GoalId }) {
  const c = CROP[goal]
  return (
    <span className="goal-icon" style={{ width: c.w, height: c.h }} aria-hidden>
      <img src={sprite} alt="" style={{ width: c.img.w, height: c.img.h, left: c.img.left, top: c.img.top }} />
    </span>
  )
}

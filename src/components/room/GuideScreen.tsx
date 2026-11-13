// 운동방 가운데 큰 스크린에 들어가는 내용.
// 운동 중에는 동작 안내 카드를 보여준다. 가이드 시범은 내 유효 횟수에 포함되지 않는다.
import { guideOf, photoOf } from '../../config/exercises'
import { coachClipOf } from '../../lib/pose/coachMotion'
import { COACH_SCREEN_RATIO } from '../three/layout'
import { ProvisionalBadge } from '../ui'

interface Props {
  exerciseId?: string
  name?: string
  /** 운동 전(입장 대기)에 보여줄 안내 */
  idleTitle?: string
  idleDesc?: string
  /** 왼쪽 칸에 3D AI 코치가 그려진다. 그 칸은 비워 두고 오른쪽에 이름·설명만 둔다 */
  hasCoach?: boolean
}

export default function GuideScreen({ exerciseId, name, idleTitle, idleDesc, hasCoach = false }: Props) {
  if (exerciseId && hasCoach) {
    return (
      <div className="row" style={{ width: '100%', height: '100%', alignItems: 'stretch', color: '#5a4757' }}>
        {/* 코치는 3D 판에 그려지니 이 칸은 투명하게 두고 표시만 얹는다 */}
        <div style={{ width: `${COACH_SCREEN_RATIO * 100}%`, position: 'relative' }}>
          <div className="row" style={{ position: 'absolute', top: '6%', left: '5%', gap: 6 }}>
            <span style={{ fontSize: 'clamp(10px, 1cqw, 13px)', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: 'rgba(90, 71, 87, 0.12)' }}>AI 코치 시범</span>
            {/* Mixamo 동작이 없는 운동은 코드로 만든 임시 동작이다 */}
            {!coachClipOf(exerciseId) && <ProvisionalBadge />}
          </div>
        </div>
        <div className="col" style={{ flex: 1, justifyContent: 'center', gap: 10, padding: '0 6% 0 4%' }}>
          <strong style={{ fontSize: 'clamp(20px, 2.4cqw, 34px)' }}>{name}</strong>
          <span style={{ fontSize: 'clamp(12px, 1.2cqw, 17px)', lineHeight: 1.5 }}>{guideOf(exerciseId)}</span>
        </div>
      </div>
    )
  }

  if (!exerciseId) {
    return (
      <div className="col center" style={{ gap: 10, color: '#6b5568', padding: 24 }}>
        <strong style={{ fontSize: 'clamp(18px, 2.2cqw, 30px)' }}>{idleTitle}</strong>
        {idleDesc && <span style={{ fontSize: 'clamp(12px, 1.2cqw, 16px)' }}>{idleDesc}</span>}
      </div>
    )
  }

  const photo = photoOf(exerciseId)
  return (
    <div className="row" style={{ gap: '4%', padding: '0 6%', width: '100%', color: '#5a4757' }}>
      {photo && <img src={photo} alt={`${name} 동작`} style={{ width: '38%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12 }} />}
      <div className="col" style={{ gap: 10, textAlign: photo ? 'left' : 'center', flex: 1 }}>
        <span style={{ fontSize: 'clamp(11px, 1cqw, 14px)', fontWeight: 700, opacity: 0.7 }}>AI 가이드 시범</span>
        <strong style={{ fontSize: 'clamp(20px, 2.4cqw, 34px)' }}>{name}</strong>
        <span style={{ fontSize: 'clamp(12px, 1.2cqw, 17px)', lineHeight: 1.5 }}>{guideOf(exerciseId)}</span>
      </div>
    </div>
  )
}

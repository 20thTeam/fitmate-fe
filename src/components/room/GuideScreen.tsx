// 운동방 가운데 큰 스크린에 들어가는 내용.
// 따라하기 영상 ID가 정해진 운동은 YouTube를 틀고, 없으면 동작 안내 카드를 보여준다.
// 가이드 시범은 내 유효 횟수에 포함되지 않는다.
import { PROVISIONAL_GUIDE_VIDEOS } from '../../config/provisional'
import { guideOf, photoOf } from '../../config/exercises'

interface Props {
  exerciseId?: string
  name?: string
  /** 운동 전(입장 대기)에 보여줄 안내 */
  idleTitle?: string
  idleDesc?: string
}

export default function GuideScreen({ exerciseId, name, idleTitle, idleDesc }: Props) {
  const videoId = exerciseId ? PROVISIONAL_GUIDE_VIDEOS[exerciseId] : undefined

  if (videoId) {
    return (
      <iframe
        title={`${name ?? '운동'} 따라하기 영상`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
        allow="autoplay; encrypted-media; picture-in-picture"
        style={{ width: '100%', height: '100%', border: 0 }}
      />
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

// 운동 중 하단 패널 세 개. 2m 떨어져서 보는 화면이라 글자·버튼을 크게 쓴다.
// [지금 운동 · 횟수 링] [친구 현황] [다음 단계 버튼]
// 동작 설명은 가운데 스크린에, 자세 피드백은 무대 위 코치 말풍선(CoachBubble)에, 내 카메라는 오른쪽 위에 둔다.
import type { ReactNode } from 'react'
import { photoOf } from '../../config/exercises'
import ProgressRing from './ProgressRing'
import starIcon from '../../assets/icons/star.png'

interface Props {
  exerciseId: string
  name: string
  /** 이름 아래 보조 정보 (예: '세트 1 / 3 · 목표 25회') */
  meta?: ReactNode
  ring: { value: number; max?: number; unit: string; isDone?: boolean }
  /** 지금 운동 패널의 버튼들 (자세 가이드·일시정지 등) */
  controls: ReactNode
  friendsTitle: ReactNode
  /** 친구 현황 (FriendStrip) */
  friends: ReactNode
  /** 다음 단계 큰 버튼 (다음 세트·다음 운동·운동 마치기) */
  action?: ReactNode
  /** 작은 보조 버튼 (운동 끝내기) */
  subAction: ReactNode
  /** [개발용] 버튼. 패널 바깥 위쪽에 띄운다 */
  devTools?: ReactNode
}

function Photo({ exerciseId, name }: { exerciseId: string; name: string }) {
  const src = photoOf(exerciseId)
  if (src) return <img className="hud-photo" src={src} alt={`${name} 동작`} />
  // 사진이 없는 운동은 기본 그림
  return (
    <div className="hud-photo col center" style={{ background: 'rgba(255,255,255,0.12)', gap: 6 }}>
      <img src={starIcon} alt="" width={40} height={40} />
    </div>
  )
}

export default function WorkoutHud({ exerciseId, name, meta, ring, controls, friendsTitle, friends, action, subAction, devTools }: Props) {
  return (
    <div className="hud">
      {devTools && <div className="row" style={{ position: 'absolute', left: 4, bottom: '100%', marginBottom: 8, gap: 6 }}>{devTools}</div>}
      {/* 지금 운동 */}
      <section className="glass is-lined hud-panel row" style={{ flex: 1, minWidth: 0, gap: 22 }} aria-label="지금 하는 운동">
        <Photo exerciseId={exerciseId} name={name} />
        <div className="col grow" style={{ gap: 8, minWidth: 0 }}>
          <h2 className="hud-name">{name}</h2>
          {meta && <span className="hud-meta">{meta}</span>}
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>{controls}</div>
        </div>
        <ProgressRing value={ring.value} max={ring.max} unit={ring.unit} isDone={ring.isDone} />
      </section>

      {/* 친구 현황 (F-WJAOCO) */}
      <section className="glass is-lined hud-panel col" style={{ width: 420, flex: 'none', gap: 12 }} aria-label="친구 현황">
        <h2 className="hud-title">{friendsTitle}</h2>
        {friends}
      </section>

      {/* 다음 단계 */}
      <section className="glass is-lined hud-panel col" style={{ width: 280, flex: 'none', gap: 10, justifyContent: 'center' }} aria-label="다음 단계">
        {action}
        {subAction}
      </section>
    </div>
  )
}

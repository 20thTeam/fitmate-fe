// 운동방 바닥 위 캐릭터 자리. three.js 캐릭터가 들어오기 전까지 실제 참가자만 캐릭터 원으로 세운다.
// 가짜 참가자나 자동 모션은 넣지 않는다 (PRD 차별점: 실제 사용자로 오인 금지).
import type { Participant } from '../../types/domain'
import { characterOf } from '../../config/characters'
import type { Theme } from '../Backdrop'

interface Props {
  theme: Theme
  participants: Participant[]
  selfId: string
  maxShown?: number
  onCheer?: (p: Participant) => void
}

export default function CharacterFloor({ theme, participants, selfId, maxShown = 6, onCheer }: Props) {
  // 바닥 높이는 배경 그림마다 다르다 (그림 기준 비율)
  const top = theme === 'friend' ? '70%' : '60%'
  return (
    <div className="row center" style={{ position: 'absolute', left: '28%', right: '28%', top, gap: '3%', alignItems: 'flex-end' }}>
      {participants.slice(0, maxShown).map((p) => {
        const isSelf = p.userId === selfId
        const canCheer = !!onCheer && !isSelf
        return (
          <button
            key={p.userId}
            className={`figure ${isSelf ? 'is-self' : ''} ${canCheer ? 'is-clickable' : ''} ${p.status === 'exercising' ? '' : 'is-idle'}`}
            title={canCheer ? `${p.nickname}님에게 응원 보내기` : undefined}
            disabled={!canCheer}
            onClick={() => canCheer && onCheer(p)}
          >
            <img src={characterOf(p.characterId).image} alt="" />
            <span>{p.nickname}{isSelf && ' (나)'}</span>
          </button>
        )
      })}
    </div>
  )
}

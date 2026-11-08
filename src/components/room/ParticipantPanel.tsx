// 운동방 오른쪽 친구·참가자 목록 (F-WJAOCO 상태 표시, F-HEIEZC 응원).
// 실제 접속한 사람만 보여준다. 가짜 참가자는 넣지 않는다.
import type { ReactNode } from 'react'
import type { Participant } from '../../types/domain'
import { isStale } from '../../hooks/useRoom'
import { Avatar } from '../ui'

const STATUS_LABEL: Record<Participant['status'], string> = {
  waiting: '대기 중',
  ready: '준비 완료',
  exercising: '운동 중',
  paused: '일시정지',
  resting: '휴식 중',
  done: '운동 완료',
}

type Tone = 'online' | 'away' | 'offline'

const toneOf = (p: Participant, isSelf: boolean): Tone => {
  if (!isSelf && isStale(p)) return 'offline'
  if (p.status === 'paused' || p.status === 'resting') return 'away'
  return 'online'
}

function statusText(p: Participant, tone: Tone) {
  if (tone === 'offline') return '연결 불안정'
  const reps = p.status === 'exercising' && p.validReps != null ? ` ${p.validReps}회` : ''
  const exercise = p.currentExercise && p.status !== 'done' && p.status !== 'waiting' ? ` • ${p.currentExercise}` : ''
  return `${STATUS_LABEL[p.status]}${reps}${exercise}`
}

interface Props {
  title: ReactNode
  participants: Participant[]
  selfId: string
  /** 화면에 그릴 최대 인원. 넘치면 '+N명 참가 중'으로 줄인다 (F-DXORMB) */
  maxShown?: number
  onCheer?: (p: Participant) => void
  headerRight?: ReactNode
  footer?: ReactNode
  emptyText?: string
}

export default function ParticipantPanel({ title, participants, selfId, maxShown = 5, onCheer, headerRight, footer, emptyText }: Props) {
  const shown = participants.slice(0, maxShown)
  const hidden = participants.length - shown.length
  const others = participants.filter((p) => p.userId !== selfId)

  return (
    <section className="glass col" style={{ gap: 12 }} aria-label="참가자">
      <div className="row between" style={{ gap: 8 }}>
        {title}
        {headerRight}
      </div>
      <ul className="people list-plain">
        {shown.map((p) => {
          const isSelf = p.userId === selfId
          const tone = toneOf(p, isSelf)
          const canCheer = !!onCheer && !isSelf
          return (
            <li key={p.userId}>
              <button
                className={`person ${canCheer ? 'is-clickable' : ''}`}
                disabled={!canCheer}
                style={{ cursor: canCheer ? 'pointer' : 'default' }}
                title={canCheer ? `${p.nickname}님에게 응원 보내기` : undefined}
                onClick={() => canCheer && onCheer(p)}
              >
                <Avatar characterId={p.characterId} name={p.nickname} />
                <span className="col" style={{ gap: 3, minWidth: 0 }}>
                  <span className="person-name">{p.nickname}{isSelf && ' (나)'}</span>
                  <span className="person-status">
                    <i className={`dot is-${tone}`} />
                    {statusText(p, tone)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {hidden > 0 && <span className="t-small" style={{ fontWeight: 700 }}>+ {hidden}명 참가 중</span>}
      {others.length === 0 && emptyText && <p className="t-xs t-soft" style={{ lineHeight: 1.5 }}>{emptyText}</p>}
      {onCheer && others.length > 0 && <p className="t-xs t-soft">이름을 누르면 응원을 보내요</p>}
      {footer}
    </section>
  )
}

/** 패널 머리의 '5명 온라인' 표시 */
export function OnlineCount({ participants, selfId }: { participants: Participant[]; selfId: string }) {
  const online = participants.filter((p) => p.userId === selfId || !isStale(p)).length
  return (
    <span className="person-status" style={{ fontSize: 9 }}>
      <i className="dot is-online" />{online}명 온라인
    </span>
  )
}
